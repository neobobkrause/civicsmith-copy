/* ai-accounts' accounts (R1–R3, R5, R6, R9, R10, R14–R17, R19, R40, R43, R44, R45, R46 (an account's own entries), R47,
 * R60, R69): an account is an owner's plan at a provider, reached by one of five means, with an ordered allow-list of
 * entries of `ai-catalogue`'s signed list. Who may act on it, what is stored of it (a secret only sealed, a reference only
 * as a pointer, a gateway account no key at all), its switches for each kind of use, its history, and the credential acts
 * (a gateway key entered or attested, a sign-in token held or refused, a key sealed, a credential that failed). Which
 * account serves an act is `serving.mjs`'s; the lists they stand on are `lists.mjs`'s. */
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { listenerRefusal } from "../membership/index.mjs";
import { AiAccountsLimits } from "./limits.mjs";
import { AiAccountsBase } from "./base.mjs";
import { AI_ACCOUNT_CHECKS } from "./checks.mjs";
import { MEANS, LEVEL_RANK, SCOPE_RANK, REFERENCE_MAX_CHARS, USE_SWITCHES, USE_DEFAULTS, GATEWAY_ROUTES, SIGNIN_TOKEN_LENGTH,
  HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX, DAY_MS, stampSecond, levelOf, ownerSpelled, LEVEL_WORD } from "./constants.mjs";

const M = AiAccountsBase;

export class AiAccountsAccounts extends AiAccountsLimits {
  /* ===== the rows ===== */

  _account(accountId) {
    return typeof accountId === "string" && accountId !== "" ? this._one(`SELECT * FROM ai_accounts WHERE account_id=?`, accountId) : null;
  }

  _accountsOwnedBy(owner) { return this._rows(`SELECT * FROM ai_accounts WHERE owner=? ORDER BY seq`, owner); }

  static _entriesOf(row) {
    try { const a = JSON.parse(row?.entries ?? "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
  }

  /* R40: the next account id: `acct-<n>`, n the account table's own sequence, so a removed account's id is never reused. */
  _nextAccountId() {
    const s = this._one(`SELECT seq FROM sqlite_sequence WHERE name='ai_accounts'`);
    return `acct-${Number(s?.seq ?? 0) + 1}`;
  }

  /* R42: a personal subscription, from the plan the catalogue states: kind `subscription` whose scope is `member` or
     `unconfirmed`; held on the row so the checks that read it never depend on the catalogue being readable (R48). */
  static _isPersonalPlan(plan) {
    return plan?.kind === "subscription" && (plan.scope === "member" || plan.scope === "unconfirmed");
  }

  /* R2, R5, R10: the share flag the owner level carries (R49): the team's `share_with_lists`, a member's own API account's
     `share_with_projects`; none for a project's account and none for a personal subscription. */
  static _flagOf(row) {
    if (row.personal) return null;
    if (row.owner === "group") return "share_with_lists";
    if (row.owner.startsWith("member:")) return "share_with_projects";
    return null;
  }

  /* R2: an account as its owners read it, never a secret or a digest of one. */
  _stateOf(row) {
    const flag = AiAccountsAccounts._flagOf(row);
    return { account_id: row.account_id, owner: row.owner, provider: row.provider, plan: row.plan, means: row.means,
             entries: AiAccountsAccounts._entriesOf(row), on: !!row.is_on, held: !!row.held, flagged: !!row.flagged,
             flagged_at: row.flagged ? row.flagged_at ?? null : null,   /* F6 (screens-ai R4): the instant of the payer stop */
             ...(row.flagged ? { flag_cause: row.flag_cause ?? null } : {}),
             health: this._healthOf(row),
             opt_in: flag ? { flag, on: !!row.share_flag } : null, set_at: row.set_at,
             personal: !!row.personal, switches: M._usesOf(row) };
  }

  /* F6 (screens-ai R1): an account's health, from what is stored of it alone, `{state, since}`: the first that holds of
     `stopped` (the payer flag, R45, since its flag), `failed` (the provider refused or could not resolve its credential,
     R60, since then), `expired` (an issued token past its `valid_until`, R19, since then), `no_credential` (nothing held:
     a gateway key not entered, an issued token dropped), `off` (its switch, R5), else `ready`. It reads no provider and
     never carries a secret; a screen draws it by key. */
  _healthOf(row) {
    if (row.flagged) return { state: "stopped", since: row.flagged_at ?? null };
    if (!row.held && row.refused_at) return { state: "failed", since: row.refused_at };
    if (row.means === "issued" && row.held && row.valid_until && Date.parse(row.valid_until) <= this._nowMs())
      return { state: "expired", since: row.valid_until };
    if (!row.held) return { state: "no_credential", since: null };
    if (!row.is_on) return { state: "off", since: null };
    return { state: "ready", since: row.held_since ?? null };
  }

  /* R6: an account as a member who is not its owner reads it: the team's `{account_id, provider, plan, entries, on}`, a
     project's participants' `{account_id, provider, plan, on}`. */
  static _partialOf(row, withEntries) {
    return { account_id: row.account_id, provider: row.provider, plan: row.plan,
             ...(withEntries ? { entries: AiAccountsAccounts._entriesOf(row) } : {}), on: !!row.is_on };
  }

  /* R37: the account an act names, with its owner's authority asked: `{row}` or `{refusal}`. A request naming no account,
     or one that is none held, is NOT_YOUR_ACCOUNT naming `account_id` (a machine caller keeps
     MACHINE_CANNOT_HOLD_ACCOUNT); else the owner's refusals (R1, R5, R10). `machineFirst`: R41's, R68's and R69's rule. */
  _accountAct(accountId, by, act, opts = {}) {
    const row = this._account(accountId);
    if (!row) {
      if (this._isMachine(by)) return { refusal: this._accountBar(null, by) };
      return { refusal: M._row(AI_ACCOUNT_CHECKS, "NOT_YOUR_ACCOUNT", localize("ai-accounts.index.the_request_names_no_account", "the account_id {account_id} is not an account of yours, so nothing was written.", { account_id: typeof accountId === "string" ? accountId.slice(0, 80) : "none" }), { account_id: typeof accountId === "string" ? accountId.slice(0, 80) : null }) };
    }
    const bar = this._ownerAuthority(row.owner, by, act, opts);
    return bar ? { refusal: bar } : { row };
  }

  /* ===== R40: setting an account ===== */

  /* R40 `accountSet` (`op=aiaccountadd`, `aiownadd`): an owner holds an account, refusing, writing nothing and in this order:
     the owner's authority (R1, R5, R10); UNKNOWN_PLAN or CATALOGUE_UNAVAILABLE; PERSONAL_SUBSCRIPTION_LEVEL or
     PLAN_SCOPE_REFUSED (R42); MEANS_NOT_ALLOWED and the means' own refusals (R43, R44, R19); ENTRY_NOT_ALLOWED and
     ENTRIES_EMPTY (R46); DISCLOSURE_DUE for a member (R1, R23). It answers `{ok, account_id, owner, provider, plan, means,
     entries, on, held, set_at}`, never a secret, appends a new account to its owner's list (R41) and records it (R16).
     With `account_id` it replaces that account's credential, entries or means (the same owner and plan). */
  async accountSet({ owner = null, provider = null, plan = null, means = null, entries = null, secret = null, reference = null,
                     terms_version = null, account_id = null, by = null } = {}) {
    const bar = this._ownerAuthority(owner, by, localize("ai-accounts.index.holding_an_ai_account", "holding an AI account"));
    if (bar) return bar;
    let existing = null;
    if (account_id !== null && account_id !== undefined) {
      existing = this._account(account_id);
      if (!existing || existing.owner !== owner || existing.provider !== provider || existing.plan !== plan)
        return AiAccountsAccounts._notYours(localize("ai-accounts.index.that_account_is_not_this_owners", "that account is not this owner's account of this plan. Nothing was written."));
    }
    const p = this._plan(provider, plan);
    if (p.refusal) return p.refusal;
    const level = levelOf(owner);
    const personal = AiAccountsAccounts._isPersonalPlan(p.plan);
    if (personal && level !== "member")
      return this._refuse("PERSONAL_SUBSCRIPTION_LEVEL", { plan: String(plan), level: LEVEL_WORD[level] }, { plan, level });
    if (!personal && Number.isFinite(SCOPE_RANK[p.plan.scope]) && LEVEL_RANK[level] > SCOPE_RANK[p.plan.scope])
      return this._refuse("PLAN_SCOPE_REFUSED", { plan: String(plan), level: LEVEL_WORD[level] }, { plan, level });
    const allowed = Array.isArray(p.plan.means_allowed) ? p.plan.means_allowed : [];
    const given = typeof means === "string" ? means : null;
    const chosen = given ?? (existing ? existing.means
      : reference && !secret && allowed.includes("reference") ? "reference"
      : level !== "member" && allowed.includes("gateway") ? "gateway"
      : level === "member" && allowed.includes("sealed") ? "sealed" : (allowed[0] ?? null));
    if (!MEANS.includes(chosen) || !allowed.includes(chosen))
      return this._refuse("MEANS_NOT_ALLOWED", { plan: String(plan), means: String(chosen) }, { plan, means: chosen });
    const cred = await this._credentialFor({ owner, chosen, plan: p.plan, secret, reference, existing });
    if (cred.refusal) return cred.refusal;
    const ents = this._entriesFor(p.plan, plan, entries, existing);
    if (ents.refusal) return ents.refusal;
    /* R1 (T47; N981, K231): asked after every refusal above, through R23's one site, for a member's own account */
    if (level === "member" && chosen !== "none") {
      const due = this.disclosureDue({ member: by });
      if (due) return due;
    }
    const at = this._at();
    const id = existing ? existing.account_id : this._nextAccountId();
    this._tx(() => {
      const held = cred.held ? 1 : 0;
      const gatewayId = chosen === "gateway" ? (cred.gateway_id ?? existing?.gateway_id ?? null) : null;
      if (existing) {
        this.sql.exec(`UPDATE ai_accounts SET means=?, entries=?, sealed=?, iv=?, seal_owner=?, reference=?, gateway_id=?, held=?,
            held_since=?, refused_at=NULL, valid_until=?, route=?, set_by=?, set_at=? WHERE account_id=?`,
          chosen, JSON.stringify(ents.entries), cred.sealed ?? null, cred.iv ?? null, cred.seal_owner ?? null, cred.reference ?? null, gatewayId,
          held, held ? at : null, cred.valid_until ?? null, chosen === "gateway" ? existing.route : null,
          M._memberOf(by), at, id);
        if (existing.means !== chosen) this.sql.exec(`DELETE FROM ai_free_tier WHERE account_id=?`, id);
      } else {
        this.sql.exec(`INSERT INTO ai_accounts (account_id, owner, project_id, provider, plan, means, entries, is_on, held, sealed, iv,
            reference, gateway_id, held_since, valid_until, personal, set_by, set_at) VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?)`,
          id, owner, owner.startsWith("project:") ? owner.slice(8) : null, provider, plan, chosen,
          JSON.stringify(ents.entries), held, cred.sealed ?? null, cred.iv ?? null, cred.reference ?? null, gatewayId,
          held ? at : null, cred.valid_until ?? null, personal ? 1 : 0, M._memberOf(by), at);
        this._listAppend(owner, id, null, at);
      }
      if (personal) {   /* R47: who, when, which plan, the catalogue's terms version then, in the same act */
        this.sql.exec(`INSERT INTO ai_personal_choices (account_id, member_id, plan, terms_version, chosen_at) VALUES (?,?,?,?,?)
                       ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan, terms_version=excluded.terms_version,
                         chosen_at=excluded.chosen_at`,
          id, M._memberOf(by), plan, typeof terms_version === "string" && terms_version !== "" ? terms_version
            : (p.plan.terms_version ?? null), at);
        this._change(owner, "personal_choice", { account_id: id, plan, terms_version: terms_version ?? p.plan.terms_version ?? null }, by, null, at);
      }
      if (level === "member") this._recipientsSeen(M._memberOf(by), ents.entries, at);   /* R51: connecting records them */
      this._change(owner, "account_set", { account_id: id, provider, plan, means: chosen, entries: ents.entries,
        replaced: !!existing, ...(existing && existing.means !== chosen ? { old_means: existing.means } : {}) }, by, null, at);   /* R16 */
    });
    const row = this._account(id);
    return { ok: true, account_id: id, owner, provider, plan, means: chosen, entries: ents.entries, on: !!row.is_on,
             held: !!row.held, set_at: row.set_at };
  }

  /* R43: what the means stores, `{sealed, iv}`, `{reference}`, `{gateway_id}`, `{held}` for the means given, or the refusal
     that means gives: NO_SECRET, ISSUED_TOKEN_MALFORMED, ACCOUNT_SEAL_UNAVAILABLE, REFERENCE_MALFORMED,
     GATEWAY_UNAVAILABLE. A replacement without a new credential keeps the one held. */
  async _credentialFor({ owner, chosen, plan, secret, reference, existing }) {
    const keep = existing && existing.means === chosen;
    if (chosen === "sealed" || chosen === "issued") {
      if (keep && (secret === null || secret === undefined)) return { sealed: existing.sealed, iv: existing.iv, held: !!existing.held,
        valid_until: existing.valid_until, seal_owner: existing.seal_owner ?? null };
      const empty = M._noSecret(secret);
      if (empty) return { refusal: empty };
      if (chosen === "issued") {
        const b = AiAccountsAccounts._tokenBounds(plan);
        if (secret.length < b.min || secret.length > b.max)
          return { refusal: this._refuse("ISSUED_TOKEN_MALFORMED", { min: b.min, max: b.max }, { min: b.min, max: b.max }) };
      }
      const unsealable = this._seal();
      if (unsealable) return { refusal: unsealable };
      return { ...(await this._encrypt(owner, chosen === "issued" ? "signin" : "apikey", secret)), held: true };
    }
    if (chosen === "reference") {
      if (keep && (reference === null || reference === undefined)) return { reference: existing.reference, held: true };
      const ok = reference && typeof reference === "object" && !Array.isArray(reference)
        && ["store", "locator"].every((k) => typeof reference[k] === "string" && reference[k].trim() !== "" && reference[k].length <= REFERENCE_MAX_CHARS);
      if (!ok) return { refusal: this._refuse("REFERENCE_MALFORMED") };
      return { reference: JSON.stringify({ store: reference.store, locator: reference.locator }), held: true };
    }
    if (chosen === "gateway") {
      const port = this._gatewayPort;
      if (!port) return { refusal: this._refuse("GATEWAY_UNAVAILABLE", {}, { extra: { grant_by: "hosting_account" } }) };
      if (keep && existing.gateway_id) return { gateway_id: existing.gateway_id, held: !!existing.held };
      let gid = null;
      try { gid = await port.create(); } catch { gid = null; }
      if (typeof gid !== "string" || gid === "") return { refusal: this._refuse("GATEWAY_STORE_REFUSED") };
      return { gateway_id: gid, held: false };
    }
    return { held: true };   /* none: nothing is stored or resolved (R43) */
  }

  /* R19: a token's length bounds from the plan, else the module's. */
  static _tokenBounds(plan) {
    const b = plan?.token_bounds;
    const min = Number.isInteger(b?.min_length) ? b.min_length : SIGNIN_TOKEN_LENGTH.min;
    const max = Number.isInteger(b?.max_length) ? b.max_length : SIGNIN_TOKEN_LENGTH.max;
    return { min, max };
  }

  /* R46: an account's entries, `{entries}` or `{refusal}`: omitted, the plan's catalogue entries in catalogue order;
     given, non-empty (ENTRIES_EMPTY) and each an entry of the plan (ENTRY_NOT_ALLOWED). */
  _entriesFor(plan, planId, entries, existing) {
    if (entries === null || entries === undefined) {
      if (existing) return { entries: AiAccountsAccounts._entriesOf(existing) };
      const all = this._planEntries(planId);
      if (all === null) return { refusal: this._catalogueUnavailable() };
      return all.length ? { entries: all } : { refusal: this._refuse("ENTRIES_EMPTY") };
    }
    if (!Array.isArray(entries) || entries.length === 0) return { refusal: this._refuse("ENTRIES_EMPTY") };
    const out = [];
    for (const e of entries) {
      const found = typeof e === "string" ? this._entry(e) : { entry: null };
      if (found.unreadable) return { refusal: this._catalogueUnavailable() };
      const ok = found.entry && Array.isArray(found.entry.plan_ids) && found.entry.plan_ids.includes(planId) && !out.includes(e);
      if (!ok) return { refusal: this._refuse("ENTRY_NOT_ALLOWED", { entry: String(e) }, { entry: typeof e === "string" ? e : null }) };
      out.push(e);
    }
    return { entries: out };
  }

  /* R46 `accountEntriesSet` (`op=aimineuse` and the screens' list of entries): replaces an account's ordered allow-list,
     by its owner's authority. */
  accountEntriesSet({ account_id = null, entries = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.changing_an_accounts_entries", "changing an AI account's list of AIs"));
    if (t.refusal) return t.refusal;
    const p = this._planOfRow(t.row);
    if (p.refusal) return p.refusal;
    const ents = this._entriesFor(p.plan, t.row.plan, entries, null);
    if (ents.refusal) return ents.refusal;
    this._tx(() => {
      this.sql.exec(`UPDATE ai_accounts SET entries=? WHERE account_id=?`, JSON.stringify(ents.entries), t.row.account_id);
      this._change(t.row.owner, "entries_set", { account_id: t.row.account_id, entries: ents.entries }, by);   /* R16 */
    });
    return { ok: true, account_id: t.row.account_id, entries: ents.entries };
  }

  /* ===== removing and switching ===== */

  /* R1, R5, R10 `accountRemove` (`op=aiaccountremove`): removes one account and takes it out of every list (R41); no secret
     remains anywhere; the owner's other accounts are left alone (R31); R26's listeners are told once (`removed`). */
  accountRemove({ account_id = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.removing_an_ai_account", "removing an AI account"));
    if (t.refusal) return t.refusal;
    this._tx(() => this._dropAccount(t.row, by, "removed"));
    return { ok: true, account_id: t.row.account_id, removed: true };
  }

  /* One account gone: its row, its places in every list, its acceptance; a change (R16); R26's listeners told with `why`.
     The caller's transaction. */
  _dropAccount(row, by, why, at = this._at()) {
    const others = this._rows(`SELECT account_id FROM ai_accounts WHERE owner=? AND account_id<>? AND held=1 AND is_on=1`, row.owner, row.account_id);
    this.sql.exec(`DELETE FROM ai_account_lists WHERE account_id=?`, row.account_id);
    this.sql.exec(`DELETE FROM ai_free_tier WHERE account_id=?`, row.account_id);
    this.sql.exec(`DELETE FROM ai_accounts WHERE account_id=?`, row.account_id);
    this._renumber(row.owner);
    this._change(row.owner, "account_removed", { account_id: row.account_id, provider: row.provider, plan: row.plan, means: row.means, why }, by, null, at);
    this._cleared({ account_id: row.account_id, owner: row.owner, member: row.owner.startsWith("member:") ? row.owner.slice(7) : null,
      means: row.means, by: by ?? null, why, other_account_serves: others.length > 0 });
  }

  /* R5, R10 `accountSwitch` (`op=aiaccountswitch`): the account's master switch, by its owner's authority; only `true` or
     `false`. An account is off when first set. */
  accountSwitch({ account_id = null, on = undefined, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.switching_an_ai_account", "switching an AI account on or off"));
    if (t.refusal) return t.refusal;
    if (typeof on !== "boolean") return M._valueInvalid("the account's switch", [true, false], { switch: "on" });
    this._tx(() => {
      this.sql.exec(`UPDATE ai_accounts SET is_on=? WHERE account_id=?`, on ? 1 : 0, t.row.account_id);
      this._change(t.row.owner, "switched", { account_id: t.row.account_id, on }, by);   /* R16 */
    });
    return { ok: true, account_id: t.row.account_id, on };
  }

  /* ===== reading ===== */

  /* R2, R6 `accountState`: an owner reads the account whole; any other active member the team's `{account_id, provider,
     plan, entries, on}`, a project's participants `{account_id, provider, plan, on}`; anyone else is refused as
     `NOT_YOUR_ACCOUNT`. Never a secret or a digest of one. */
  accountState({ account_id = null, viewer = null } = {}) {
    const row = this._account(account_id);
    if (!row) return AiAccountsAccounts._notYours(localize("ai-accounts.index.that_account_is_not_yours", "that account is not yours to read. Nothing was read."));
    const seen = this._seeing(row, viewer);
    if (seen === "owner") return { ok: true, ...this._stateOf(row) };
    if (seen === "partial") return { ok: true, ...AiAccountsAccounts._partialOf(row, row.owner === "group") };
    return AiAccountsAccounts._notYours(localize("ai-accounts.index.that_account_is_not_yours", "that account is not yours to read. Nothing was read."));
  }

  /* How `viewer` sees `row`: `owner` (its owners), `partial` (an active member of the team for the team's account, a joined
     participant for a project's), or null. */
  _seeing(row, viewer) {
    const id = M._memberOf(viewer);
    if (id === null || isMachineIdentity(viewer)) return null;
    if (this._ownerAuthority(row.owner, viewer, "reading an account") === null) return "owner";
    if (row.owner === "group") return this._memberFacts(id)?.status === "active" ? "partial" : null;
    if (row.owner.startsWith("project:")) {
      const unseen = this._unseen(row.owner.slice(8), `member:${id}`);
      return !unseen && this._isJoined(row.owner.slice(8), id) ? "partial" : null;
    }
    return null;
  }

  /* R2 `accountsOf`: the owner's accounts in list order (R41: each account on the list, the owner's own and the ones placed
     there, then the owner's own that stand off it, `position` null), as `accountState` reads each, to that owner's
     authority; the team's to any active member, a project's to its joined participants, as `accountState` reads them. */
  accountsOf({ owner = null, viewer = null } = {}) {
    if (!ownerSpelled(owner)) return AiAccountsAccounts._notYours(localize("ai-accounts.index.that_owner_is_not_yours", "that owner is not yours to read. Nothing was read."));
    const full = this._ownerAuthority(owner, viewer, "reading an owner's accounts") === null;
    let partial = false;
    if (!full) {
      const id = M._memberOf(viewer);
      if (id !== null && !isMachineIdentity(viewer)) {
        if (owner === "group") partial = this._memberFacts(id)?.status === "active";
        else if (owner.startsWith("project:")) {
          const unseen = this._unseen(owner.slice(8), `member:${id}`);
          partial = !unseen && this._isJoined(owner.slice(8), id);
        }
      }
    }
    if (!full && !partial) {
      return owner.startsWith("project:") ? this._unseen(owner.slice(8), viewer) ?? this._notTheOwner(viewer, owner.slice(8))
        : AiAccountsAccounts._notYours(localize("ai-accounts.index.that_owner_is_not_yours", "that owner is not yours to read. Nothing was read."));
    }
    const listed = this._rows(`SELECT a.*, l.position AS pos, l.placed_by AS placed_by FROM ai_account_lists l
                               JOIN ai_accounts a ON a.account_id=l.account_id WHERE l.owner=? ORDER BY l.position`, owner);
    const unlisted = this._rows(`SELECT a.*, NULL AS pos, NULL AS placed_by FROM ai_accounts a WHERE a.owner=? AND a.account_id NOT IN
                                 (SELECT account_id FROM ai_account_lists WHERE owner=?) ORDER BY a.seq`, owner, owner);
    /* an account of another owner on this list is read as any member reads it, never as its owners do: its owner's settings are its own */
    const shape = (r) => {
      const own = full && r.owner === owner;
      const st = own ? this._stateOf(r) : AiAccountsAccounts._partialOf(r, r.owner === "group" || own);
      return { ...st, position: r.pos ?? null, ...(r.owner !== owner ? { placed_here: true, placed_by: r.placed_by ?? null } : {}) };
    };
    const rows = full ? [...listed, ...unlisted] : listed;
    return { ok: true, owner, accounts: rows.map(shape) };
  }

  /* R3 `accountSecretFor`: unseals a member-owned account's credential only for an act that member runs: `act` `{kind,
     member, project?}` with `act.member` the owner; any other act `NOT_YOUR_ACCOUNT`; none held `NO_ACCOUNT`. The secret
     serves the one call and is kept by no caller. A reference answers its pointer and a gateway account its gateway id;
     neither answers a secret. A team or project account's secret is unsealed only through `accountFor` (R7). */
  async accountSecretFor({ account_id = null, act = null } = {}) {
    const away = this.aiKeptAway({ project: act && typeof act === "object" ? act.project ?? null : null, use: act && typeof act === "object" ? act.kind : null });
    if (away) return away;
    const row = this._account(account_id);
    const who = act && typeof act === "object" ? M._memberOf(act.member) : null;
    if (!row || !row.owner.startsWith("member:") || who === null || isMachineIdentity(act.member) || row.owner !== `member:${who}`)
      return M._notYours(localize("ai-accounts.index.a_members_account_serves_only", "a member's AI account serves only that member's own acts. Nothing was used."));
    if (!this._holderActive(who))
      return M._row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.only_an_active_member_holds", "only an active member holds a Claude account reference. Nothing was written."));
    if (!row.held) return this._noAccount(who, "account");
    return this._credentialOf(row);
  }

  /* R3, R7: the credential the account's means names, for the one call: `{ok, account_id, means, secret}`, `{reference}`,
     `{gateway_id}`, or nothing for `none`; ACCOUNT_SEAL_UNAVAILABLE when a sealed secret does not open. */
  async _credentialOf(row) {
    const base = { ok: true, account_id: row.account_id, means: row.means };
    if (row.means === "sealed" || row.means === "issued") {
      const unsealable = this._seal();
      if (unsealable) return unsealable;
      const secret = row.sealed ? await this._decrypt(row.seal_owner ?? row.owner, row.means === "issued" ? "signin" : "apikey", row.sealed, row.iv) : null;
      if (secret === null)
        return M._sealRefusal(localize("ai-accounts.index.the_credential_does_not_open", "the credential does not open under the seal secret of your team's Civicsmith, which has changed; an administrator sets it again. Nothing was used."));
      return { ...base, secret };
    }
    if (row.means === "reference") { let ref = null; try { ref = JSON.parse(row.reference); } catch { ref = null; } return { ...base, reference: ref }; }
    if (row.means === "gateway") return { ...base, gateway_id: row.gateway_id };
    return base;
  }

  /* R9 `accountSwitchesOf`: an in-plane read reached by no route, `{on, suggestions, standing}` for one account, never a
     secret; `{unreadable: true}` when it cannot be read (fail closed: no switch reads as on). */
  accountSwitchesOf({ account_id = null } = {}) {
    try {
      const r = this._account(account_id);
      return r ? { on: !!r.is_on, suggestions: !!r.suggestions, standing: !!r.standing } : { on: false, suggestions: false, standing: false };
    } catch { return { unreadable: true }; }
  }

  /* ===== R14: an account's switches for each kind of use ===== */

  /* R14 `accountUsesSet` (`op=accountusesset`): one switch of one account, by its owner's authority. Refusals in order: the
     owner's, UNKNOWN_SWITCH, SWITCH_VALUE_INVALID, each writing nothing. */
  accountUsesSet({ account_id = null, switch: name = null, on, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.setting_an_ai_accounts_uses", "setting an AI account's settings"));
    if (t.refusal) return t.refusal;
    const unknown = M._switchName(name, USE_SWITCHES);
    if (unknown) return unknown;
    const bad = M._switchValueFault(name, on);
    if (bad) return bad;
    this._tx(() => {
      this.sql.exec(`UPDATE ai_accounts SET ${M._USE_COLUMN[name]}=? WHERE account_id=?`, M._stored(name, on), t.row.account_id);
      this._change(t.row.owner, "use_set", { account_id: t.row.account_id, switch: name, value: on }, by);   /* R16 */
    });
    return { ok: true, account_id: t.row.account_id, switch: name, on };
  }

  /* R22, R15: every material limit that can bind the account, on or off: the team's, and a project's own for its account. */
  _limitsFor(owner) {
    const g = this.aiKeepAwayState();
    const out = [{ scope: "group", on: g.on, uses: g.uses, reason: g.reason, set_by: g.set_by, set_at: g.set_at }];
    if (owner.startsWith("project:")) {
      let lim;
      try { lim = this._projectLimit(owner.slice(8)); }
      catch { lim = { on: null, uses: null, reason: null, set_by: null, set_at: null }; }
      out.push({ scope: "project", project: owner.slice(8), on: lim.on, uses: lim.uses, reason: lim.reason, set_by: lim.set_by, set_at: lim.set_at });
    }
    return out;
  }

  /* R15 `accountUses` (`op=accountuses`): one account's uses and keep-aways, to its owners alone: `{account_id, owner, held,
     uses, keptAway}`. Never a secret; writes nothing; never throws. */
  accountUses({ account_id = null, viewer = null } = {}) {
    try {
      const t = this._accountAct(account_id, viewer, localize("ai-accounts.index.reading_an_ai_accounts_uses", "reading an AI account's settings"));
      if (t.refusal) return t.refusal;
      return { ok: true, account_id: t.row.account_id, owner: t.row.owner, held: !!t.row.held, uses: M._usesOf(t.row),
               keptAway: this._limitsFor(t.row.owner) };
    } catch {
      return { ok: true, account_id: typeof account_id === "string" ? account_id : null, owner: null, held: null, uses: null, keptAway: null, unreadable: true };
    }
  }

  /* R17 `accountUsesOf`: an in-plane read, taking no viewer, `{account_id, owner, held, uses}` as R15 answers it to owners;
     `held: null, uses: null, unreadable: true` when unreadable (no switch reads as on); a revoked member's account answers
     `held: false, uses: null` (K2620). The read an in-plane caller (`ai-use`) uses for an account it does not own. */
  accountUsesOf({ account_id = null } = {}) {
    const said = typeof account_id === "string" ? account_id : null;
    try {
      const r = this._account(account_id);
      if (!r) return { ok: true, account_id: said, owner: null, held: false, uses: null };
      if (r.owner.startsWith("member:") && this.membership.memberFacts(r.owner.slice(7))?.status === "revoked")
        return { ok: true, account_id: said, owner: r.owner, held: false, uses: null };
      return { ok: true, account_id: said, owner: r.owner, held: !!r.held, uses: M._usesOf(r) };
    } catch { return { ok: true, account_id: said, owner: null, held: null, uses: null, unreadable: true }; }
  }

  /* R16 `accountHistory` (`op=accounthistory`): the changes of the owner's accounts and lists, to that owner's authority
     alone, in the order made, each `{at, by, change, level, …}`, capped as `credentials` R15's with a measured `truncated`.
     Writes nothing; never throws. */
  accountHistory({ owner = null, viewer = null, limit = null } = {}) {
    try {
      const bar = this._ownerBar(owner, viewer);
      if (bar) return bar;
      const asked = Number(limit);
      const cap = Number.isFinite(asked) && asked > 0 ? Math.min(HISTORY_LIMIT_MAX, Math.floor(asked)) : HISTORY_LIMIT_DEFAULT;
      const found = this._rows(`SELECT at, by, change, detail FROM account_changes WHERE owner=? ORDER BY seq LIMIT ?`, owner, cap + 1);
      const level = levelOf(owner);
      const changes = found.slice(0, cap).map((r) => {
        let d = {};
        try { d = r.detail ? JSON.parse(r.detail) : {}; } catch { d = {}; }
        return { ...d, at: r.at, by: r.by, change: r.change, level };
      });
      return { ok: true, owner, count: changes.length, limit: cap, truncated: found.length > cap, changes };
    } catch {
      return { ok: true, owner: typeof owner === "string" ? owner : null, count: 0, limit: null, truncated: false, changes: [], unreadable: true };
    }
  }

  /* ===== R44: the gateway ===== */

  /* R44: the gateway port, registered once at start by the composition root (Cloudflare's calls are not this module's):
     `registerGatewayStore(module, {create, put, exists})`; a malformed registration, or a second, is refused through
     membership's R81. */
  _gatewayPort = null;   // {module, create, put, exists}

  registerGatewayStore(module, port) {
    const ok = port && typeof port === "object" && typeof port.create === "function" && typeof port.put === "function"
      && typeof port.exists === "function";
    const held = this._gatewayPort ? { module: this._gatewayPort.module } : null;
    const refused = listenerRefusal(held, module, ok ? port.put : null);
    if (refused) return refused;
    this._gatewayPort = { module, create: port.create, put: port.put, exists: port.exists };
    return { ok: true, module };
  }

  /* R44 (a) `gatewayKeyEnter` (`op=aikeyenter`): hands the key to the port's `put(gateway_id, key)` and keeps nothing: the
     key is in no table, history row, log, error, export or answer, nor a digest. A port refusal is GATEWAY_STORE_REFUSED,
     writing nothing; no port, GATEWAY_UNAVAILABLE. Records `held: true` and the route `screen`; clears no payer flag. */
  async gatewayKeyEnter({ account_id = null, key = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.entering_an_ai_accounts_key", "entering an AI account's key"));
    if (t.refusal) return t.refusal;
    if (t.row.means !== "gateway") return this._refuse("MEANS_NOT_ALLOWED", { plan: String(t.row.plan), means: "gateway" }, { plan: t.row.plan, means: "gateway" });
    if (!this._gatewayPort) return this._refuse("GATEWAY_UNAVAILABLE", {}, { extra: { grant_by: "hosting_account" } });
    const empty = M._noSecret(key);
    if (empty) return empty;
    let stored = false;
    try { const r = await this._gatewayPort.put(t.row.gateway_id, key); stored = r !== false && !(r && r.ok === false); } catch { stored = false; }
    if (!stored) return this._refuse("GATEWAY_STORE_REFUSED");
    return this._gatewayHeld(t.row, "screen", by);
  }

  /* R44 (b) `gatewayKeyAttest` (`op=aikeycloudflare`): records that an administrator entered the key in the Cloudflare
     dashboard, only when the port's `exists(gateway_id)` says so, else GATEWAY_KEY_ABSENT; the key never touches this
     module. Records `held: true` and the route `dashboard`. */
  async gatewayKeyAttest({ account_id = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.attesting_an_ai_accounts_key", "confirming an AI account's key"));
    if (t.refusal) return t.refusal;
    if (t.row.means !== "gateway") return this._refuse("MEANS_NOT_ALLOWED", { plan: String(t.row.plan), means: "gateway" }, { plan: t.row.plan, means: "gateway" });
    if (!this._gatewayPort) return this._refuse("GATEWAY_UNAVAILABLE", {}, { extra: { grant_by: "hosting_account" } });
    let there = false;
    try { there = (await this._gatewayPort.exists(t.row.gateway_id)) === true; } catch { there = false; }
    if (!there) return this._refuse("GATEWAY_KEY_ABSENT");
    return this._gatewayHeld(t.row, "dashboard", by);
  }

  _gatewayHeld(row, route, by) {
    const at = this._at();
    this._tx(() => {
      this.sql.exec(`UPDATE ai_accounts SET held=1, route=?, held_since=?, refused_at=NULL WHERE account_id=?`, route, at, row.account_id);
      this._change(row.owner, "gateway_key", { account_id: row.account_id, route }, by, null, at);   /* R16, never the key */
    });
    return { ok: true, account_id: row.account_id, held: true, route, since: at };
  }

  /* ===== R19: an issued account's token ===== */

  /* R19 `issuedTokenHold`: an `issued` account's token, from a provider's documented sign-in flow, held sealed: in-plane
     only, reached by no route, replaces any earlier token, answers `{ok, since}` and never the token or a digest; refuses
     ACCOUNT_MEMBER_NOT_ACTIVE (the claimed founder counts as active) and ISSUED_TOKEN_MALFORMED outside the plan's bounds. */
  async issuedTokenHold({ account_id = null, token = null, valid_until = null } = {}) {
    const row = this._account(account_id);
    if (!row || row.means !== "issued") return M._notYours(localize("ai-accounts.index.that_is_not_an_issued_account", "that is not an account that holds a sign-in token. Nothing was recorded."));
    const holder = row.owner.startsWith("member:") ? row.owner.slice(7) : null;
    if (holder !== null && (isMachineIdentity(holder) || !this._holderActive(holder)))
      return M._row(AI_ACCOUNT_CHECKS, "ACCOUNT_MEMBER_NOT_ACTIVE", localize("ai-accounts.index.only_an_active_member_or", "only an active member, or the founder, holds a sign-in. Nothing was recorded."));
    const p = this._planOfRow(row);
    if (p.refusal) return p.refusal;
    const b = AiAccountsAccounts._tokenBounds(p.plan);
    if (typeof token !== "string" || token.length < b.min || token.length > b.max)
      return this._refuse("ISSUED_TOKEN_MALFORMED", { min: b.min, max: b.max }, { min: b.min, max: b.max });
    const unsealable = this._seal();
    if (unsealable) return unsealable;
    const { sealed, iv } = await this._encrypt(row.owner, "signin", token);
    const now = this._nowMs();
    const since = stampSecond(now);
    const until = AiAccountsAccounts._validUntil(valid_until, now);
    this._tx(() => {
      this.sql.exec(`UPDATE ai_accounts SET sealed=?, iv=?, held=1, held_since=?, valid_until=?, refused_at=NULL WHERE account_id=?`,
        sealed, iv, since, until, row.account_id);
      this._change(row.owner, "account_set", { account_id: row.account_id, provider: row.provider, plan: row.plan, means: "issued", token: "held" }, holder, null, since);   /* R16, never the token */
    });
    return { ok: true, since };
  }

  /* R19: the instant `validFor` reaches from `now` when the provider stated a whole number of days or years ("1 year",
     "30 days"; a bare whole number is days), else null. */
  static _validUntil(validFor, now) {
    const m = typeof validFor === "number" ? [null, String(validFor), "day"]
      : typeof validFor === "string" ? /^\s*(\d{1,4})\s*(day|year)s?\s*$/i.exec(validFor) : null;
    if (!m || !Number.isSafeInteger(Number(m[1])) || Number(m[1]) < 1) return null;
    const n = Number(m[1]);
    if (m[2].toLowerCase() === "day") return stampSecond(now + n * DAY_MS);
    const d = new Date(now);
    d.setUTCFullYear(d.getUTCFullYear() + n);
    return stampSecond(d.getTime());
  }

  /* R19 `issuedTokenRefused`: in-plane, drops the token when the provider refuses it, records `refused_at` and tells the
     listeners (R26, `why: "refused"`). Answers `{ok: true, dropped}`; never throws. */
  issuedTokenRefused({ account_id = null } = {}) {
    try {
      const row = this._account(account_id);
      if (!row || row.means !== "issued" || !row.sealed) return { ok: true, dropped: false };
      this._tx(() => this._dropToken(row, null, "refused"));
      return { ok: true, dropped: true };
    } catch { return { ok: false, dropped: false, unreadable: true }; }
  }

  /* R19: the owner disconnects an issued account: the token is dropped, the account stays (held: false), R26's listeners
     are told `disconnected`. By the owner's authority. */
  issuedTokenDrop({ account_id = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.disconnecting_an_ai_account", "disconnecting an AI account's sign-in"));
    if (t.refusal) return t.refusal;
    const dropped = !!t.row.sealed && t.row.means === "issued";
    if (dropped) this._tx(() => this._dropToken(t.row, by, "disconnected"));
    return { ok: true, account_id: t.row.account_id, disconnected: dropped };
  }

  /* One issued token dropped, a change (R16), the listeners told (R26). The caller's transaction. */
  _dropToken(row, by, why, at = this._at()) {
    const others = this._rows(`SELECT account_id FROM ai_accounts WHERE owner=? AND account_id<>? AND held=1 AND is_on=1`, row.owner, row.account_id);
    this.sql.exec(`UPDATE ai_accounts SET sealed=NULL, iv=NULL, held=0, valid_until=NULL, refused_at=? WHERE account_id=?`,
      why === "refused" ? at : null, row.account_id);
    this._change(row.owner, "account_removed", { account_id: row.account_id, provider: row.provider, plan: row.plan, means: row.means, token: "dropped", why }, by, null, at);
    this._cleared({ account_id: row.account_id, owner: row.owner, member: row.owner.startsWith("member:") ? row.owner.slice(7) : null,
      means: row.means, by: by ?? null, why, other_account_serves: others.length > 0 });
  }

  /* ===== R69: the sealed hold ===== */

  /* R69 `aiKeySeal` (`op=aikeyseal`): replaces the credential of an existing account with a sealed one, means `sealed`, the
     secret sealed under the account's owner, read only through `accountFor` (R7) or `accountSecretFor` (R3) for the act
     that runs; never shown again. It is `accountSet({account_id, secret, means: "sealed", by})` and refuses exactly as it
     does and in its order; an account that does not exist or is another owner's is NOT_YOUR_ACCOUNT. Answers `{ok,
     account_id, means: "sealed", held: true, since}`. */
  async aiKeySeal({ account_id = null, secret = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.sealing_an_ai_accounts_key", "keeping an AI account's key sealed"), { machineFirst: true });
    if (t.refusal) return t.refusal;
    const r = await this.accountSet({ owner: t.row.owner, provider: t.row.provider, plan: t.row.plan, means: "sealed", secret: secret ?? "",
      account_id: t.row.account_id, by });
    if (!r.ok) return r;
    const row = this._account(t.row.account_id);
    return { ok: true, account_id: r.account_id, means: "sealed", held: true, since: row.held_since ?? row.set_at };
  }

  /* F6 (screens-ai R5, R14; `op=aikeyreference`): aiconnect step 3's way "by reference": replaces the credential of an
     existing account with a pointer `{store, locator}` (R43), means `reference`; nothing it points at is resolved or stored
     here. It is `accountSet({account_id, reference, means: "reference", by})` and refuses exactly as it does and in its
     order (the owner's authority, MEANS_NOT_ALLOWED, REFERENCE_MALFORMED, DISCLOSURE_DUE for a member); an account that does
     not exist or is another owner's is NOT_YOUR_ACCOUNT. Answers `{ok, account_id, means: "reference", held: true, since}`. */
  async aiKeyReference({ account_id = null, reference = null, by = null } = {}) {
    const t = this._accountAct(account_id, by, localize("ai-accounts.index.referencing_an_ai_accounts_key", "pointing an AI account at a key kept elsewhere"), { machineFirst: true });
    if (t.refusal) return t.refusal;
    const r = await this.accountSet({ owner: t.row.owner, provider: t.row.provider, plan: t.row.plan, means: "reference",
      reference: reference ?? {}, account_id: t.row.account_id, by });
    if (!r.ok) return r;
    const row = this._account(t.row.account_id);
    return { ok: true, account_id: r.account_id, means: "reference", held: true, since: row.held_since ?? row.set_at };
  }

  /* F6 (screens-ai R5, R14; `op=aisignin`): aiconnect step 3's way "the provider's own sign-in": the token the provider's
     documented sign-in flow issued (the adapter's connect flow behind `agent-model`) is held sealed on an account of means
     `issued` (R19), never answered, logged or echoed. With `account_id` it replaces that account's credential; without, it
     sets a new account of `{owner, provider, plan}` (R40; a member's own when `owner` is the member). Either is
     `accountSet({…, means: "issued", secret: token, by})` and refuses exactly as it does and in its order (the owner's
     authority, UNKNOWN_PLAN, the scope rules of R42, MEANS_NOT_ALLOWED, NO_SECRET, ISSUED_TOKEN_MALFORMED, DISCLOSURE_DUE for
     a member). `valid_until` the provider's stated life ("1 year", "30 days"), as R19 reads it. Answers `{ok, account_id,
     means: "issued", held: true, since}`. */
  async aiSignin({ account_id = null, owner = null, provider = null, plan = null, token = null, valid_until = null, by = null } = {}) {
    let target = { owner, provider, plan };
    if (account_id !== null && account_id !== undefined) {
      const t = this._accountAct(account_id, by, localize("ai-accounts.index.signing_an_ai_account_in", "signing an AI account in with its provider"), { machineFirst: true });
      if (t.refusal) return t.refusal;
      target = { owner: t.row.owner, provider: t.row.provider, plan: t.row.plan, account_id: t.row.account_id };
    }
    const r = await this.accountSet({ ...target, means: "issued", secret: typeof token === "string" ? token : "", by });
    if (!r.ok) return r;
    const until = AiAccountsAccounts._validUntil(valid_until, this._nowMs());
    if (until !== null) this.sql.exec(`UPDATE ai_accounts SET valid_until=? WHERE account_id=?`, until, r.account_id);
    const row = this._account(r.account_id);
    return { ok: true, account_id: r.account_id, means: "issued", held: true, since: row.held_since ?? row.set_at };
  }

  /* ===== R60: a credential that failed ===== */

  /* R60 `accountCredentialFailed`: in-plane, reached by the Worker through `op=aicredentialfailed` (R67) when the provider
     refuses an account's credential (`refused`) or it resolves to nothing (`unresolved`: a reference's target gone, a
     gateway key removed). It records the change (R16), drops an issued token (R19), marks the account `held: false` and
     tells the listeners (R26). An account with nothing held changes nothing and tells no one. Never throws. */
  accountCredentialFailed({ account_id = null, why = null } = {}) {
    try {
      const row = this._account(account_id);
      if (!row || (why !== "refused" && why !== "unresolved") || !row.held) return { ok: true, dropped: false };
      const at = this._at();
      this._tx(() => {
        if (row.means === "issued" && row.sealed) { this._dropToken(row, null, why); return; }
        this.sql.exec(`UPDATE ai_accounts SET held=0, refused_at=? WHERE account_id=?`, at, row.account_id);
        this._change(row.owner, "account_removed", { account_id: row.account_id, provider: row.provider, plan: row.plan, means: row.means, credential: "failed", why }, null, null, at);
        const others = this._rows(`SELECT account_id FROM ai_accounts WHERE owner=? AND account_id<>? AND held=1 AND is_on=1`, row.owner, row.account_id);
        this._cleared({ account_id: row.account_id, owner: row.owner, member: row.owner.startsWith("member:") ? row.owner.slice(7) : null,
          means: row.means, by: null, why, other_account_serves: others.length > 0 });
      });
      return { ok: true, dropped: true };
    } catch { return { ok: false, dropped: false, unreadable: true }; }
  }

  /* ===== R26: onAccountCleared ===== */

  /* R26 `onAccountCleared`: one registration per module, each refused through membership's R81. Each `fn` is called once,
     inside the act, in registration order, with `{account_id, owner, member, means, by, why, other_account_serves}`. A
     listener's answer is ignored, and one that throws changes nothing of the act or of another listener's notice. */
  _clearedListeners = [];   // [{module, fn}]

  onAccountCleared(module, fn) {
    const refused = listenerRefusal(this._clearedListeners, module, fn);
    if (refused) return refused;
    this._clearedListeners.push({ module, fn });
    return { ok: true, module };
  }

  _cleared(notice) {
    for (const { fn } of this._clearedListeners) {
      try { fn({ ...notice }); } catch { /* the act stands */ }
    }
  }

  /* ===== R41: the lists' small helpers, used by the acts above ===== */

  /* A new account at the foot of its owner's list. The caller's transaction. */
  _listAppend(owner, accountId, placedBy, at) {
    const n = Number(this._one(`SELECT COALESCE(MAX(position),0) AS m FROM ai_account_lists WHERE owner=?`, owner).m) + 1;
    this.sql.exec(`INSERT OR IGNORE INTO ai_account_lists (owner, project_id, account_id, position, placed_by, placed_at) VALUES (?,?,?,?,?,?)`,
      owner, owner.startsWith("project:") ? owner.slice(8) : null, accountId, n, placedBy, placedBy ? at : null);
  }

  /* A list's positions made 1..n again after a removal. */
  _renumber(owner) {
    let n = 0;
    for (const r of this._rows(`SELECT account_id FROM ai_account_lists WHERE owner=? ORDER BY position`, owner))
      this.sql.exec(`UPDATE ai_account_lists SET position=? WHERE owner=? AND account_id=?`, ++n, owner, r.account_id);
  }

  /* R51: the recipients of these entries recorded seen by the member, in the act that connects her own account. */
  _recipientsSeen(member, entries, at) {
    for (const e of entries) {
      const f = this._entry(e);
      if (!f.entry) continue;
      const r = M._recipientOf(f.entry);
      if (r.provider === "" && r.host === "") continue;
      this.sql.exec(`INSERT OR IGNORE INTO ai_recipients_seen (member_id, provider, host, seen_at) VALUES (?,?,?,?)`, member, r.provider, r.host, at);
    }
  }
}

export { USE_DEFAULTS, GATEWAY_ROUTES };
