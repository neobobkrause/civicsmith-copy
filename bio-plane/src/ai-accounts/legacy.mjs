/* ai-accounts' compatibility seam (F1; coordinator, 4 Nov). T53 replaced the one-table-per-kind accounts with the account
 * model of R40 on, and with them the names its users still called. Each name here is DEPRECATED: it is kept only until its
 * callers (`ai-runs`, `ai-use`, `question-explorer`, `answers` and their test worlds) re-point to the T53 interface in their
 * own jobs, and then it goes. Each is implemented over the T53 model and nothing else, with the meaning `migrate` (R59)
 * already gives the rows the old name wrote: a member's API key, the team's key and a project's key are accounts of the
 * catalogue's Anthropic API plan, means `sealed`; a member's sign-in is an account of the catalogue's subscription plan,
 * means `issued`. So every old act asks the T53 refusals (the owner's authority, the catalogue, the plan's scope, the means,
 * the disclosure), and an unreadable catalogue refuses (R63: fail closed). The T53 interface is unchanged: the two old forms
 * of `accountUsesOf` and `accountFor` answer beside the new ones, never in place of them.
 *
 * The "key" account an old name reads or replaces is the owner's first account, in list order (R41), whose means is
 * `sealed` and which is no personal subscription; the "sign-in" is the member's first `issued` account. */
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { notAnAdmin } from "../membership/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { AiAccountsLifecycle } from "./lifecycle.mjs";
import { AiAccountsBase } from "./base.mjs";
import { USE_DEFAULTS, ownerSpelled } from "./constants.mjs";

const M = AiAccountsBase;
/* R59: the provider every pre-T53 account is of. */
const PROVIDER = "anthropic";

export class AiAccountsLegacy extends AiAccountsLifecycle {
  /* ===== the rows an old name reads ===== */

  /* The owner's accounts, in list order (R41), then any of its accounts not on its list. */
  _legacyRows(owner) {
    const listed = this._seqRows(owner);
    const ids = new Set(listed.map((r) => r.account_id));
    return [...listed, ...this._accountsOwnedBy(owner).filter((r) => !ids.has(r.account_id))];
  }

  /* The owner's "key": its first sealed account that is no personal subscription, or null. */
  _legacyKey(owner) { return this._legacyRows(owner).find((r) => r.means === "sealed" && !r.personal) ?? null; }

  /* A member's "sign-in": her first issued account, or null. */
  _legacySignin(owner) { return this._legacyRows(owner).find((r) => r.means === "issued") ?? null; }

  /* The catalogue's plan an old row converts to (R59), or null when the catalogue cannot give it. */
  _legacyPlan(kind) { return this._migrationPlan(kind)?.plan ?? null; }
  static _planId(plan) { return plan ? (plan.plan_id ?? plan.id ?? null) : null; }

  /* An old "set a key" act over `accountSet` (R40): the owner's key account of the API plan is replaced when it is held,
     else a new one is set. Without the plan, `accountSet` is asked with none, so its refusals keep their order (the owner's
     authority first, then CATALOGUE_UNAVAILABLE or UNKNOWN_PLAN). `on` turns a NEW account on, as `migrate` converts a
     member's key (R59). Answers `accountSet`'s answer, or its refusal. */
  async _legacyKeySet(owner, secret, by, { on = false } = {}) {
    const planId = AiAccountsLegacy._planId(this._legacyPlan("api"));
    const held = planId === null ? null : this._legacyKey(owner);
    const replace = held && held.plan === planId ? held.account_id : null;
    const set = await this.accountSet({ owner, provider: PROVIDER, plan: planId, means: "sealed", secret, by,
                                        ...(replace ? { account_id: replace } : {}) });
    if (!set.ok) return set;
    if (on && !replace) {
      const s = this.accountSwitch({ account_id: set.account_id, on: true, by });
      if (!s.ok) return s;
    }
    return set;
  }

  static _owner(prefix, x) {
    const id = M._memberOf(x);
    return prefix === "member" ? (id === null ? null : `member:${id}`) : (typeof x === "string" && x !== "" ? `project:${x}` : null);
  }

  /* ===== a member's own key (was R1, R2) ===== */

  /** @deprecated F1: use `accountSet({owner: "member:<id>", provider, plan, means: "sealed", secret, by})` (R1, R40) and
   *  `accountSwitch`. Was R1's `accountReferenceSet`: the member's own API key, replacing any earlier one, served once set.
   *  Here: the member's sealed account of the catalogue's Anthropic API plan (R59's conversion), replaced when held, a new one
   *  switched on. `kind` other than `apikey` is MEANS_NOT_ALLOWED (a subscription is an issued account, R19), asked after the
   *  member's authority. Answers `{ok, kind, set_at, account_id}`, never the secret. */
  async accountReferenceSet({ member = null, kind = null, secret = null, by = null } = {}) {
    const owner = AiAccountsLegacy._owner("member", member);
    if (kind !== "apikey") {
      const bar = this._ownerAuthority(owner, by, "holding an AI account");
      if (bar) return bar;
      return this._refuse("MEANS_NOT_ALLOWED", { plan: String(AiAccountsLegacy._planId(this._legacyPlan("api"))), means: String(kind) },
        { plan: AiAccountsLegacy._planId(this._legacyPlan("api")), means: typeof kind === "string" ? kind : null });
    }
    const set = await this._legacyKeySet(owner, secret, by, { on: true });
    return set.ok ? { ok: true, kind: "apikey", set_at: set.set_at, account_id: set.account_id } : set;
  }

  /** @deprecated F1: use `accountsOf({owner: "member:<id>", viewer})` and `accountState` (R2). Was R2's
   *  `accountReferenceState`: to the member alone, `{ok, held, kind, set_at, suggestions, standing, uses, subscription:
   *  {connected, since, held, valid_until?, refused_at?, uses}}`, the key her first sealed account, the subscription her first
   *  issued one (connected while its token is held). Anyone else NOT_YOUR_ACCOUNT. Never a secret; writes nothing. */
  accountReferenceState({ member = null, viewer = null } = {}) {
    const owner = AiAccountsLegacy._owner("member", member);
    if (owner === null || typeof member !== "string" || M._memberOf(viewer) !== M._memberOf(member) || isMachineIdentity(viewer))
      return M._notYours("a member's Claude account is seen only by that member. Nothing was read.");
    const r = this._legacyKey(owner);
    const s = this._legacySignin(owner);
    const sub = s && s.held ? s : null;
    return { ok: true, held: !!(r && r.held), kind: r ? "apikey" : null, set_at: r ? r.set_at : null, account_id: r ? r.account_id : null,
             suggestions: !!(r && r.suggestions), standing: !!(r && r.standing), uses: r ? M._usesOf(r) : null,
             subscription: { connected: !!sub, since: sub ? (sub.held_since ?? sub.set_at) : null, held: !!sub,
                             account_id: s ? s.account_id : null,
                             ...(sub && sub.valid_until ? { valid_until: sub.valid_until } : {}),
                             ...(s && s.refused_at && !sub ? { refused_at: s.refused_at } : {}),
                             uses: sub ? M._usesOf(sub) : null } };
  }

  /* ===== the team's key (was R5, R6, R9) ===== */

  /** @deprecated F1: use `accountSet({owner: "group", …})` (R5, R40). Was R5's `groupKeySet`: the team's one key, replacing
   *  any earlier one, off when first set (a replacement keeps its switch). Here: the team's sealed account of the catalogue's
   *  Anthropic API plan, by an active administrator. Answers `{ok, set_at, account_id}`, never the key. */
  async groupKeySet({ key = null, by = null } = {}) {
    const set = await this._legacyKeySet("group", key, by);
    return set.ok ? { ok: true, set_at: set.set_at, account_id: set.account_id } : set;
  }

  /** @deprecated F1: use `accountState` and `accountsOf({owner: "group"})` (R2, R6). Was R6's `groupKeyState`: an active
   *  administrator reads `{held, on, set_at, by, suggestions, standing, uses}` of the team's key account, any other active
   *  member `{on}`; anyone else is refused as a non-administrator. Never the key; writes nothing. */
  groupKeyState({ viewer = null } = {}) {
    const id = M._memberOf(viewer);
    const machine = isMachineIdentity(viewer);
    const f = this._legacyKeyFacts();
    let admin = false;
    try { admin = id !== null && !machine && this.membership.isAdministrator(id) === true; } catch { admin = false; }
    if (admin) return { ok: true, ...f };
    if (id !== null && !machine && this._memberFacts(id)?.status === "active") return { ok: true, on: f.on };
    return notAnAdmin(viewer ?? null, "reading the team's Anthropic API key");
  }

  /* The team's key account as R6 answered it: held, on only while held and switched on; the defaults before any. */
  _legacyKeyFacts() {
    const r = this._legacyKey("group");
    const held = !!(r && r.held);
    return { held, on: held && !!r.is_on, set_at: held ? r.set_at : null, by: held ? (r.set_by ?? null) : null,
             account_id: r ? r.account_id : null, suggestions: !!(r && r.suggestions), standing: !!(r && r.standing),
             uses: r ? M._usesOf(r) : { ...USE_DEFAULTS } };
  }

  /** @deprecated F1: use `accountSwitchesOf({account_id})` (R9) for the account `accountFor` answered. Was R9's
   *  `groupKeySwitches()`: the team's key account's `{on, suggestions, standing}`, in-plane, reached by no route. Never the
   *  key; writes nothing; never throws (an unreadable store answers every switch off). */
  groupKeySwitches() {
    try {
      const f = this._legacyKeyFacts();
      return { on: f.on, suggestions: f.suggestions, standing: f.standing };
    } catch { return { on: false, suggestions: false, standing: false }; }
  }

  /* ===== a project's key (was R10) ===== */

  /** @deprecated F1: use `accountSet({owner: "project:<id>", …})` (R10, R40). Was R10's `projectKeySet`: a project owner
   *  holds an Anthropic API key for the project, replacing any earlier one, off when first set. Here: the project's sealed
   *  account of the catalogue's Anthropic API plan, by one of its owners (R10's refusals). Answers `{ok, project, kind:
   *  "apikey", set_at, account_id}`, never the key. */
  async projectKeySet({ project = null, key = null, by = null } = {}) {
    const set = await this._legacyKeySet(AiAccountsLegacy._owner("project", project), key, by);
    return set.ok ? { ok: true, project, kind: "apikey", set_at: set.set_at, account_id: set.account_id } : set;
  }

  /* ===== a member's sign-in token (was R19) ===== */

  /** @deprecated F1: use `accountSet({owner: "member:<id>", plan, means: "issued", secret: token, by})` and `issuedTokenHold`
   *  (R19, R40). Was R19's `subscriptionTokenHold`: an in-plane call, reached by no route, holding a member's sign-in token
   *  sealed, replacing any earlier one; the claimed founder counts as active. Here: the token held on her first issued
   *  account (`issuedTokenHold`), or, with none, a new issued account of the catalogue's subscription plan (R59's
   *  conversion), set by her own act and switched on. `validFor` as R19's ("1 year", "30 days", a whole number of days).
   *  Answers `{ok, since, account_id}`, never the token. */
  async subscriptionTokenHold({ member = null, token = null, validFor = null } = {}) {
    const id = M._memberOf(member);
    if (id === null || isMachineIdentity(member) || isMachineIdentity(id) || !this._holderActive(id))
      return this.accountMemberNotActive(localize("ai-accounts.index.only_an_active_member_or", "only an active member, or the founder, holds a sign-in. Nothing was recorded."));
    const owner = `member:${id}`;
    const held = this._legacySignin(owner);
    if (held) {
      const h = await this.issuedTokenHold({ account_id: held.account_id, token, valid_until: validFor });
      return h.ok ? { ok: true, since: h.since, account_id: held.account_id } : h;
    }
    const planId = AiAccountsLegacy._planId(this._legacyPlan("subscription"));
    const set = await this.accountSet({ owner, provider: PROVIDER, plan: planId, means: "issued", secret: token, by: id });
    if (!set.ok) return set;
    if (validFor !== null && validFor !== undefined) {
      const h = await this.issuedTokenHold({ account_id: set.account_id, token, valid_until: validFor });
      if (!h.ok) return h;
    }
    const on = this.accountSwitch({ account_id: set.account_id, on: true, by: id });
    if (!on.ok) return on;
    const row = this._account(set.account_id);
    return { ok: true, since: row?.held_since ?? set.set_at, account_id: set.account_id };
  }

  /* ===== the names BOB's ruling of 05:02 (4 Nov) added to F1 ===== */

  /* The owner's head account, as an old name keyed by owner reads it: its first held account in list order, else its first. */
  _legacyHead(owner) {
    const rows = this._legacyRows(owner);
    return rows.find((r) => r.held) ?? rows[0] ?? null;
  }

  /* An owner holding none of what an old act names: the owner's authority's refusal first, else NO_ACCOUNT for the owner. */
  _legacyNone(owner, by, what) { return this._ownerAuthority(owner, by, what) ?? this._noAccount(null, "owner"); }

  /** @deprecated F1: use `accountUsesSet({account_id, switch, on, by})` (R14). The old form `{owner, switch, on, by}`,
   *  answered when the call names an `owner` and no `account_id`: sets the switch on the owner's head account, with R14's
   *  refusals unchanged. An owner holding no account is refused by its authority, else NO_ACCOUNT, writing nothing. */
  accountUsesSet(args = {}) {
    const a = args && typeof args === "object" ? args : {};
    if (a.account_id !== undefined || a.owner === undefined) return super.accountUsesSet(a);
    const { owner, ...rest } = a;
    const head = ownerSpelled(owner) ? this._legacyHead(owner) : null;
    if (!head) return this._legacyNone(owner, a.by ?? null, "setting an AI account's settings");
    return super.accountUsesSet({ ...rest, account_id: head.account_id });
  }

  /** @deprecated F1: use `accountUses({account_id, viewer})` (R15). The old form `{owner, viewer}`: the owner's head account
   *  as R15 answers it, plus `kind` (`apikey` sealed, `signin` issued, else null) and, for a member, `accounts: {reference,
   *  signin}`, each `{held, uses}`, as `ai-use` (#isSignin) and `ai-runs` (the dispatch's `suggestions`) read them; an owner
   *  holding none answers its owners `held: false` (the team its defaults); anyone else R15's refusal. Never a secret; writes
   *  nothing; never throws (unreadable: `held: null, uses: null, unreadable: true`). */
  accountUses(args = {}) {
    const a = args && typeof args === "object" ? args : {};
    if (a.account_id !== undefined || a.owner === undefined) return super.accountUses(a);
    const { owner, viewer = null } = a;
    try {
      const bar = this._ownerAuthority(owner, viewer, "reading an AI account's settings");
      if (bar) return bar;
      const head = this._legacyHead(owner);
      const kindOf = (r) => (r ? (r.means === "sealed" ? "apikey" : r.means === "issued" ? "signin" : null) : null);
      const one = (r) => ({ held: !!(r && r.held), uses: r && r.held ? M._usesOf(r) : null });
      const base = head ? super.accountUses({ account_id: head.account_id, viewer })
        : { ok: true, account_id: null, owner, held: false, uses: owner === "group" ? { ...USE_DEFAULTS } : null, keptAway: this._limitsFor(owner) };
      if (!base.ok || base.unreadable) return base;
      return { ...base, kind: kindOf(head),
               ...(owner.startsWith("member:") ? { accounts: { reference: one(this._legacyKey(owner)), signin: one(this._legacySignin(owner)) } } : {}) };
    } catch {
      return { ok: true, account_id: null, owner: typeof owner === "string" ? owner : null, held: null, uses: null, keptAway: null, unreadable: true };
    }
  }

  /** @deprecated F1: use `accountSwitch({account_id, on, by})` (R5). Was R5's `groupKeySwitch`: the team's key on or off, by
   *  an active administrator. Here: the master switch of the team's key account (its first sealed account). Answers `{ok,
   *  account_id, on}`; with no key held, NOT_AN_ADMIN for a non-administrator, else NO_ACCOUNT, writing nothing. */
  groupKeySwitch({ on = undefined, by = null } = {}) {
    const key = this._legacyKey("group");
    if (!key) return this._legacyNone("group", by, "switching the team's AI account");
    return this.accountSwitch({ account_id: key.account_id, on, by });
  }

  /** @deprecated F1: use `accountSwitch({account_id, on, by})` (R10). Was R10's `projectAccountSwitch`: a project's account
   *  on or off, by one of its owners. Here: the master switch of the project's head account. Answers `{ok, account_id, on}`;
   *  with none held, R10's refusal for a non-owner, else NO_ACCOUNT, writing nothing. */
  projectAccountSwitch({ project = null, on = undefined, by = null } = {}) {
    const owner = AiAccountsLegacy._owner("project", project);
    const head = owner ? this._legacyHead(owner) : null;
    if (!head) return this._legacyNone(owner, by, "switching a project's AI account");
    return this.accountSwitch({ account_id: head.account_id, on, by });
  }

  /** @deprecated F1: use `accountsOf({owner: "project:<id>", viewer})` and `accountState` (R2, R10). Was R10's
   *  `projectAccountState`: a project's owners read `{ok, project, account_id, held, on, kind, set_at}` of its head account
   *  (`held: false` with none); its joined participants `{ok, project, account_id, on}`; anyone else `accountsOf`'s refusal
   *  (an invisible project as absent). Never a secret; writes nothing. */
  projectAccountState({ project = null, viewer = null } = {}) {
    const owner = AiAccountsLegacy._owner("project", project);
    const list = this.accountsOf({ owner, viewer });
    if (!list || list.ok !== true) return list;
    const head = this._legacyHead(owner);
    const on = !!(head && head.held && head.is_on);
    if (this._ownerAuthority(owner, viewer, "reading a project's AI account") !== null)
      return { ok: true, project, account_id: head ? head.account_id : null, on };
    return { ok: true, project, account_id: head ? head.account_id : null, held: !!(head && head.held), on,
             kind: head ? (head.means === "sealed" ? "apikey" : head.means === "issued" ? "signin" : null) : null,
             set_at: head ? head.set_at : null };
  }

  /** @deprecated F1: use `accountRemove({account_id, by})` (R1). Was R1's `accountReferenceRemove`: the member's own API key
   *  removed, by her own act. Here: her key account (her first sealed account) removed by `accountRemove`, with its
   *  refusals; with none held, R1's refusal for anyone else, else NO_ACCOUNT, writing nothing. */
  accountReferenceRemove({ member = null, by = null } = {}) {
    const owner = AiAccountsLegacy._owner("member", member);
    const key = owner ? this._legacyKey(owner) : null;
    if (!key) return this._accountBar(owner, by) ?? this._noAccount(M._memberOf(member), "owner");
    return this.accountRemove({ account_id: key.account_id, by });
  }

  /* R51 for the old key notices: the recipients (provider and host) of the catalogue's Anthropic API plan's entries, the plan
     every pre-T53 key converts to (R59), each recorded seen by `recipientNoticeSeen`, the member's own act. */
  _legacyNoticeSeen(member, by) {
    const bar = this._accountBar(member, by);
    if (bar) return bar;
    const plan = this._migrationPlan("api");
    if (!plan) return this._catalogueUnavailable();
    const recipients = new Map();
    for (const e of plan.entries) {
      const f = this._entry(e);
      if (!f.entry) continue;
      const r = M._recipientOf(f.entry);
      if (r.provider !== "" && r.host !== "") recipients.set(`${r.provider}|${r.host}`, r);
    }
    for (const r of recipients.values()) {
      const s = this.recipientNoticeSeen({ member, provider: r.provider, host: r.host, by });
      if (!s.ok) return s;
    }
    return { ok: true, seen: true, recipients: [...recipients.values()].map((r) => ({ ...r })) };
  }

  /** @deprecated F1: use `recipientNoticeSeen({member, provider, host, by})` (R51). Was R8's `groupKeyNoticeSeen`: the
   *  member has seen the notice that the team's key sends her material to Anthropic. Here: every recipient of the
   *  catalogue's Anthropic API plan recorded seen, as `migrate` carries a seen key notice (R59). The member's own act (R1's
   *  refusals); an unreadable catalogue CATALOGUE_UNAVAILABLE (R63). Answers `{ok, seen, recipients}`. */
  groupKeyNoticeSeen({ member = null, by = null } = {}) { return this._legacyNoticeSeen(member, by); }

  /** @deprecated F1: use `recipientNoticeSeen` (R51). Was R12's `projectKeyNoticeSeen`: as `groupKeyNoticeSeen`, for a
   *  project's key. A notice is now per recipient, never per project, so `project` changes nothing of the act. */
  projectKeyNoticeSeen({ member = null, project = null, by = null } = {}) { void project; return this._legacyNoticeSeen(member, by); }

  /** @deprecated F1: use `accountSet({owner: "member:<id>", plan, means: "issued", secret: token, by})` and `issuedTokenHold`
   *  (R19, R40). Was R18's `subscriptionConnected`: an in-plane fact that a member's sign-in is connected, which served
   *  nothing until its token was held (`subscriptionTokenHold`). R59 gives that fact alone, with no token, `held: false`:
   *  it serves nothing. So nothing is written: the member is checked active (the claimed founder counts), and the answer
   *  says whether a token is held on her first issued account. Answers `{ok, connected, held, account_id}`. */
  subscriptionConnected({ member = null } = {}) {
    const id = M._memberOf(member);
    if (id === null || isMachineIdentity(member) || isMachineIdentity(id) || !this._holderActive(id))
      return this.accountMemberNotActive(localize("ai-accounts.index.only_an_active_member_or", "only an active member, or the founder, holds a sign-in. Nothing was recorded."));
    const s = this._legacySignin(`member:${id}`);
    return { ok: true, connected: true, held: !!(s && s.held), account_id: s ? s.account_id : null };
  }

  /* ===== the old forms of two T53 reads ===== */

  /** R17, and (deprecated, F1) its old form `accountUsesOf({owner})`, answered when the call names an `owner` and no
   *  `account_id`: the owner's head account (its first held account in list order, else its first) as R17 answers it,
   *  `{ok, owner, account_id, held, uses}`; a member's also `accounts: {reference, signin}`, each `{held, uses}`; the team with
   *  none its defaults with `held: false`; an owner not spelled as R14's, or a revoked member's, `held: false, uses: null`
   *  (K2620); unreadable `held: null, uses: null, unreadable: true`. Never a secret; writes nothing; never throws. */
  accountUsesOf(args = {}) {
    const a = args && typeof args === "object" ? args : {};
    if (a.account_id !== undefined || a.owner === undefined) return super.accountUsesOf(a);
    const owner = a.owner;
    const said = typeof owner === "string" ? owner : null;
    try {
      if (!ownerSpelled(owner) || (owner.startsWith("member:") && isMachineIdentity(owner.slice(7))))
        return { ok: true, owner: said, held: false, uses: null };
      const none = { held: false, uses: null };
      if (owner.startsWith("member:") && this.membership.memberFacts(owner.slice(7))?.status === "revoked")
        return { ok: true, owner, ...none, accounts: { reference: { ...none }, signin: { ...none } } };
      const rows = this._legacyRows(owner);
      const head = rows.find((r) => r.held) ?? rows[0] ?? null;
      const one = (r) => ({ held: !!(r && r.held), uses: r && r.held ? M._usesOf(r) : null });
      const uses = head ? M._usesOf(head) : owner === "group" ? { ...USE_DEFAULTS } : null;
      return { ok: true, owner, account_id: head ? head.account_id : null, held: !!(head && head.held), uses,
               ...(owner.startsWith("member:") ? { accounts: { reference: one(this._legacyKey(owner)), signin: one(this._legacySignin(owner)) } } : {}) };
    } catch {
      return { ok: true, owner: said, held: null, uses: null, unreadable: true };
    }
  }

  /** R7, and (deprecated, F1) its old `{key}` form beside the new answer: a served account whose means hands a secret
   *  (`sealed`, `issued`) also answers it as `key`, and `kind` `apikey` (sealed) or `signin` (issued), as R7 answered before
   *  T53. The two are non-enumerable, so R7's answer as T53 states it is unchanged (its own fields, compared, spread or
   *  serialised, are exactly R7's) and an old caller reading `.key` and `.kind` finds them. Nothing else of R7's answer or
   *  its refusals changes; the caller keeps neither for more than the one call. */
  async accountFor(args = {}) {
    const r = await super.accountFor(args);
    if (!r || r.ok !== true || typeof r.secret !== "string") return r;
    return Object.defineProperties(r, {
      kind: { value: r.means === "issued" ? "signin" : "apikey", enumerable: false },
      key: { value: r.secret, enumerable: false },
    });
  }
}
