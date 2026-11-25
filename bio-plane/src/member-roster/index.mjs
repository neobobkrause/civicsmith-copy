/* member-roster — who the members are and what each may do: the founder, administrators and their votes, invitations and
 * enrolment, the two doors, handles, capabilities, expertise, the hosting-access record, the group's settings and
 * description, the Home mark, the viewer's spelling, the one list of module order, and the refusals and listener slots
 * every later module registers through. It reads no bundle and no project.
 *
 * Requirements: build/requirements/member-roster.md (R1–R75). A new module, split by copy from `membership` at T51
 * (T51-145; K624, K657, K1043, K3268, K3946; the split map is build/extraction/membership-split-T51.md). The code and the
 * comments are `membership`'s, moved as they stood: a requirement id a comment cites without a module's name is the id
 * `membership` held (the requirements file maps each old id to its new one, "was membership R<old>"). Until
 * `membership`'s CR-4 swaps it in, nothing composes this module: its refusal rows are not exported from here and not
 * registered with the row census (one code, one site: R68), and its tables are not declared with record-core (R55, R66).
 *
 * SHAPE (K61). `membersOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql` and
 * nothing else (R74); it reaches no record-core, reads no `bundles` table and no project table, and `memberList` is given
 * the projects of a member by its caller (R71). The tables, the exempt list and the declared rows it owns are exported
 * from `schema.mjs`, for the composition that declares them.
 */
import { MACHINE_CLASS_PREFIX, MACHINE_STAMP_PREFIXES, sha256HexSync } from "../record-grammar/index.mjs";
import { MEMBER_SCHEMA, MEMBER_ADDITIVE_COLUMNS } from "./schema.mjs";
export { MEMBER_SCHEMA, MEMBER_ADDITIVE_COLUMNS, MEMBER_EXEMPT_TABLES, MEMBER_DECLARED_TABLES } from "./schema.mjs";
import { MEMBER_ROSTER_ROWS } from "./checks.mjs";
const { MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS } = MEMBER_ROSTER_ROWS;
import { keyed, rowKey, SENTENCE_KEYS } from "./words.mjs";
import { MODULE_IDS } from "./order.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R70: every key this module reads, each held by `setup-words` (`hasWord`): its rows' (`refusal.<CODE>`, or the key
   `words.mjs` names) and the sentences it answers beside them. */
export const WORD_KEYS = Object.freeze([...new Set([
  ...[MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS].flatMap((table) => Object.keys(table).map(rowKey)),
  ...SENTENCE_KEYS])]);

/* The founder's internal member id (R29's list, R23): exported for a caller that must name her (N1067). */
export const ROOT_ADMIN = "admin";

/* R73 (T51; K624; split map §3 seam 3). THE SPELLING OF A VIEWER, as pure functions with no table read: nothing is
   trimmed or case-folded. The pattern is the one `membership`'s `viewerPredicate` holds (R43): a machine credential
   (`MACHINE_CLASS_PREFIX` and exactly admin, member, probe, daemon or ai), `member:<id>` (1 to 128 of letters, digits,
   `.`, `_`, `:`, `-`) and the founder's bare `admin`. */
const CLS = MACHINE_CLASS_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VIEWER = new RegExp(`^(${CLS}(admin|member|probe|daemon|ai)|member:([A-Za-z0-9._:-]{1,128})|admin)$`);
const CARRIED = /^(member:[A-Za-z0-9._:-]{1,128}|admin)@([\s\S]+)$/;

/** The viewer without the project it carries: who is asking, as distinct from what the project reaches. */
export function baseViewer(viewer) {
  const m = typeof viewer === "string" ? CARRIED.exec(viewer) : null;
  return m ? m[1] : viewer;
}

/** The project a viewer carries (`member:<id>@<project>`, `admin@<project>`), or null. */
export function carriedProject(viewer) {
  const m = typeof viewer === "string" ? CARRIED.exec(viewer) : null;
  return m ? m[2] : null;
}

/** The member id a viewer spelling names: `identity` is read when it is a non-empty string, else `viewer`; the id in
 *  `member:<id>` (with or without a carried project), so `member:admin` answers `admin`; null for the founder's bare
 *  spelling, for a machine credential and for any other spelling. */
export function viewerMember(viewer, identity = null) {
  const asked = typeof identity === "string" && identity !== "" ? identity : viewer;
  if (typeof asked !== "string") return null;
  const m = VIEWER.exec(baseViewer(asked));
  return m ? m[3] || null : null;
}

/* Whether the spelling is one this module recognises at all (what `membership`'s gate calls anything but DENY). */
const viewerKnown = (v) => typeof v === "string" && VIEWER.test(baseViewer(v));


/* R84 (N324, K275, K403; N327, DEC-83). THE ONE ANSWER TO ONE CONDITION: the stamped caller `by` is not an administrator
   (R64) where the act is an administrator's. Every act refusing that condition answers through here (R6, R7, R9, R10,
   R11, R12, R20, R22 and R75, `project-roster` R5; T34's R98–R100, R102, R103, R107 and R109; credentials' R6, R7 and R13; monitoring's R30, intent's R9, bias's R11), so
   `NOT_AN_ADMIN` is minted at one site and its one row is this module's (C-96.1). Who is admitted stays each act's own
   rule; this only answers the refusal. `act` is the caller's fixed phrase for its act, never a request's words; the
   detail is one fixed sentence around it. `extra` adds a caller's own fields beside these and never replaces one of them. An act with a
   next step or an alternative passes it as `extra.remedy`, one fixed sentence: the answer keeps it as `remedy`, and its
   member-facing `message` is the row's translation, a space, then the remedy (DEC-83: the standard sentence first, then
   what to do next or instead). `message` is this function's own, never a caller's; with no remedy there is none.
   Writes nothing and never throws. */
const NOT_AN_ADMIN_FIXED = new Set(["ok", "reason", "code", "check", "translation", "by", "detail", "message"]);
export function notAnAdmin(by, act, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NOT_AN_ADMIN_FIXED.has(k));
  } catch { own = []; }
  /* A remedy is a sentence: anything else a caller passes under the name adds nothing. */
  const given = own.find(([k]) => k === "remedy");
  const remedy = given && typeof given[1] === "string" && given[1].trim() ? given[1].trim().slice(0, 400) : null;
  own = own.filter(([k]) => k !== "remedy");
  const what = typeof act === "string" && act.trim() ? act.trim().slice(0, 120) : "this act";
  /* DEC-49 REGION is-custodial-admin */
  const row = MEMBERSHIP_CHECKS.NOT_AN_ADMIN;
  return { ok: false, reason: "NOT_AN_ADMIN", code: "NOT_AN_ADMIN", check: row.check, translation: row.translation,
           by: by ?? null, ...Object.fromEntries(own),
           ...(remedy ? { remedy, message: `${row.translation} ${remedy}` } : {}),
           detail: localize("membership.index.what_is_an_administrators_act", "{what} is an administrator's act (Membership Architecture v2 §4.9), and your team's Civicsmith takes who is asking from the signed-in session rather than from the caller. This caller is not one of the active administrators. Nothing was changed.", { what: String(what) }) };
  /* END DEC-49 REGION is-custodial-admin */
}


/* N793 (K231; T38-4). THE ONE ANSWER TO ONE CONDITION: no member answers to the id (or name) a caller was given. This
   module owns `members`, so `NO_SUCH_MEMBER` is minted here alone and its one row is this module's (C-96.47; K2279); every act
   of any module refusing that condition answers through here (this module's eight; credentials, tasks,
   instance-setup and control-plane in their own jobs; `setup-page` retired at T48). `member` is the id as asked (null when none); the detail is one
   fixed sentence, the same for every caller. `extra` adds a caller's own fields beside these and never replaces one of
   them. Writes nothing and never throws. */
const NO_SUCH_MEMBER_DETAIL = localize("membership.index.no_member_of_your_team", "no member of your team answers to that id here. Nothing was changed.");
const NO_SUCH_MEMBER_FIXED = new Set(["ok", "reason", "code", "check", "translation", "member", "detail"]);
export function noSuchMember(memberId, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NO_SUCH_MEMBER_FIXED.has(k));
  } catch { own = []; }
  let member = null;
  try { member = memberId === null || memberId === undefined ? null : String(memberId).slice(0, 200); } catch { member = null; }
  /* DEC-49 REGION is-no-such-member */
  const row = MEMBERSHIP_CHECKS.NO_SUCH_MEMBER;
  return { ok: false, reason: "NO_SUCH_MEMBER", code: "NO_SUCH_MEMBER", check: row.check,
           translation: row.translation, member, ...Object.fromEntries(own), detail: NO_SUCH_MEMBER_DETAIL };
  /* END DEC-49 REGION is-no-such-member */
}


const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);


/* R83, R146 (K289; N1115, N1171; K657, K3268): the modules' total order, `build/modules.json`'s ids in the file's order
   (which is its layer order, K270). Product code cannot read `build/` at run time, so the list is made from the file at
   build: `order.mjs` is written by `order-build.mjs` (its `--check` finds it stale), never by hand, so a module added,
   moved or dropped in the file changes the list with no edit here. `moduleOrderFrom(modules)` answers the frozen list for a
   parsed copy of the file (a test hands it a changed one), and `MODULE_ORDER`, the one list every module orders its
   listeners by (this module's R79; promotion, provenance and the later modules import it), is its answer for the file
   itself. A module the file lists before its job has built it is in the list in its place all the same; which are not yet
   built is the file's to say (those without `paths`), never this module's. */
export function moduleOrderFrom(modules) {
  const list = Array.isArray(modules) ? modules : isObj(modules) && Array.isArray(modules.modules) ? modules.modules : [];
  const ids = [];
  for (const m of list) if (isObj(m) && typeof m.id === "string" && m.id && !ids.includes(m.id)) ids.push(m.id);
  return Object.freeze(ids);
}
export const MODULE_ORDER = moduleOrderFrom(MODULE_IDS.map((id) => ({ id })));

const LISTENER_REFUSAL_FIELDS = new Set(["ok", "reason", "code", "detail", "module", "check", "translation"]);

/** R81 (N202, K231, K285; moved from promotion's R49, membership being the earliest module that registers listeners,
 *  K275): the one site that mints LISTENER_MALFORMED and LISTENER_DECLARED. Every registration of a listener asks it
 *  before recording the registration: this module's (R79), promotion's (through its R49) and every later module's.
 *  `held` is what the caller already holds for the slot: a list of `{module}`, or, for a slot that takes one
 *  registration whoever makes it, that one registration or null. Answers the refusal, with `extra` (the caller's own
 *  fields) beside its own and never replacing them, and its row's `check` and `translation` (this module's C-102.11
 *  and C-102.12, N128); else null. Writes nothing and never throws. (Promotion's built text, moved as it was, K285.) */
export function listenerRefusal(held, module, fn, extra) {
  const refuse = (code, detail, fields) => {
    const row = MEMBERSHIP_CHECKS[code];
    /* The refusal's own fields, its row's `check` and `translation` among them, are never the caller's. */
    let own = {};
    try {
      if (isObj(extra)) own = Object.fromEntries(Object.entries(extra).filter(([k]) => !LISTENER_REFUSAL_FIELDS.has(k)));
    } catch { own = {}; }
    return { ...own, ok: false, reason: code, code, detail, ...fields, check: row.check, translation: row.translation };
  };
  /* DEC-49 REGION is-listener-registration */
  /* Each code is written once (one site per code, K275), and every branch below answers through these two. */
  const malformed = (detail) => refuse("LISTENER_MALFORMED", detail, {});
  const declared = (detail, holder) => refuse("LISTENER_DECLARED", detail, { module: holder });
  try {
    if (typeof module !== "string" || !module || typeof fn !== "function")
      return malformed(localize("member-roster.index.a_listener_names_the_module", "a listener names the module that registers it and its function"));
    if (Array.isArray(held)) {
      if (held.some((h) => isObj(h) && h.module === module))
        return declared(localize("member-roster.index.module_has_already_registered_its_listener", "{module} has already registered its listener", { module: String(module) }), module);
      return null;
    }
    if (isObj(held)) {
      const holder = typeof held.module === "string" ? held.module : null;
      return declared(holder
        ? localize("member-roster.index.this_listener_is_already_registered_by", "this listener is already registered by {holder}, and it takes one registration", { holder: String(holder) })
        : localize("member-roster.index.this_listener_is_already_registered", "this listener is already registered, and it takes one registration"), holder);
    }
    return null;
  } catch (e) {
    return malformed(localize("member-roster.index.the_registration_could_not_be_read", "the registration could not be read: {reason}", { reason: String(String(e && e.message ? e.message : e).slice(0, 200)) }));
  }
  /* END DEC-49 REGION is-listener-registration */
}


export class Members {
  constructor({ sql, now = null } = {}) {
    this.sql = sql;
    this.now = typeof now === "function" ? now : null;   /* R82: the clock handed in, else the store's environment, else the wall clock */
    this.env = null;   /* R82: the store's environment, set by `membersOps` (`#nowMs`) */
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* R82 (T51 fix round 10; STORE-REQUEST #5 J14; K5132's rule, `credentials`' `#nowMs`): the instance clock. A clock handed
     in (`now`, a function of milliseconds) answers first; else the store's environment (`env.BIO_NOW_MS`, handed in by
     `membersOps`); else the wall clock. Every instant this module records, and every judgement of one, reads it. */
  #nowMs() {
    if (this.now) {
      const handed = Number(this.now());
      if (Number.isFinite(handed) && handed >= 0) return handed;
    }
    const raw = this.env ? this.env.BIO_NOW_MS : undefined;
    if (raw !== undefined && raw !== null && raw !== "") {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
    return Date.now();
  }

  /* The instant, as an ISO string, of the instance clock (or of `ms`). */
  #instant(ms = this.#nowMs()) { return new Date(ms).toISOString(); }

  /* This module's tables, at every boot (R21, R66, R74), idempotent: `members.name` renamed to `cover` (2026-07-24);
     every table and index created if absent; the additive columns an older store lacks added; the vestigial
     `members.expertise` column dropped (K57: `member_expertise` is the record, R17–R20). It declares nothing to
     record-core and reads no bundle: the composition declares `schema.mjs`'s tables, and reindexes project sight. */
  migrate() {
    const cols = (t) => [...this.sql.exec(`PRAGMA table_info(${t})`)].map((r) => r.name);
    const memberCols = cols("members");
    if (memberCols.includes("name") && !memberCols.includes("cover"))
      this.sql.exec(`ALTER TABLE members RENAME COLUMN name TO cover`);
    for (const [table, column, decl] of MEMBER_ADDITIVE_COLUMNS) {
      const have = cols(table);
      if (have.length && !have.includes(column)) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }   // before the CREATE INDEX statements, which name added columns (REC-143's lesson)
    const bare = MEMBER_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    if (cols("members").includes("expertise")) this.sql.exec(`ALTER TABLE members DROP COLUMN expertise`);
  }


  /* REC-132 / D-422 / C-55: A MEMBER HOLDING THE RESERVED ID IS REPORTED BY THE AUDIT, NEVER RENAMED (moved from the
     legacy store's `auditPass`, T19, through record-core's R68 seam). `memberAdd` refuses the id `admin` (R9), but an
     instance that enrolled one before the reservation still holds it, and every name-keyed check reads it as the
     founder. Renaming it would rewrite who the record says acted, so the audit SAYS it and an administrator decides.
     Always answered under the key `membership`, so "none held" and "this build does not look" never read alike; a
     stated finding, never a conformance error. It names only the reserved id, which is public, and that row's role
     and status. Registered once with record-core by `membership` (split map §3 seam 1), which asks this
     module for the finding; a host whose record-core does not offer the seam registers nothing. */
  reservedIdFinding() {
    const id = Members.ROOT_ADMIN;
    const m = this.#one(`SELECT role, status FROM members WHERE member_id = ?`, id);
    return {
      reservedId: id, held: !!m, role: m ? m.role : null, status: m ? m.status : null,
      check: MEMBER_ID_CHECKS.MEMBER_ID_RESERVED.check,
      says: m
        ? word("membership.says.member_enrolled_under", { id, role: m.role, status: m.status })
        : word("membership.says.member_holds_reserved", { id }),
    };
  }


  /* ===== R79 (N123, K159, K285) — THE REVOCATION NOTICE (K31's pattern) =====
   *
   * A later module that holds something a member's standing grants (capture-sources' `member` credentials, its R63)
   * registers once at start, and is told the moment a member is revoked, inside the revoking act: R8's carried
   * removal and R20's revocation. The notice is `{memberId, by, at}`, the act's own actor and time. It is called after
   * the act's writes, in the caller's transaction, once per listener in the modules' total order (`MODULE_ORDER`; an
   * unknown module last, in the order it registered). A listener's answer is not read, and one that throws changes
   * neither the revocation, its answer, nor another listener's notice: the listener's module still meets the revoked
   * status at its own next read (capture-sources R63), so a failure here is never a credential kept. A write that
   * leaves a revoked member revoked notifies nobody. Registration's refusals are R81's. */
  #revokedListeners = [];   // {module, fn, seq}

  onRevoked(module, fn) {
    const refused = listenerRefusal(this.#revokedListeners, module, fn);
    if (refused) return refused;
    this.#revokedListeners.push({ module, fn, seq: this.#revokedListeners.length });
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.#revokedListeners.sort((a, b) => (rank(a.module) - rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }

  #announceRevoked(memberId, by, at) {
    for (const l of this.#revokedListeners) {
      try {
        const r = l.fn({ memberId, by: by ?? null, at });
        if (r && typeof r.then === "function") r.then(null, () => {});
      } catch { /* a listener's failure never changes the revocation or another listener's notice */ }
    }
  }

  /* ===== Services later modules read (K57, R64–R73), and the canon rules N18 built (R10, R11, R18, R19) ===== */

  /* R64: the founder (`admin`, once the instance is claimed) and every active member with role `admin`. */
  isAdministrator(memberId) {
    if (memberId === Members.ROOT_ADMIN) return this.#claimed();
    if (typeof memberId !== "string" || memberId === "") return false;
    const m = this.#one(`SELECT role, status FROM members WHERE member_id=?`, memberId);
    return !!m && m.role === "admin" && m.status === "active";
  }

  /* ===== R94 (K637) — WHETHER THE INSTANCE IS CLAIMED, A FACT `credentials` STATES (its R17) =====
   *
   * The founder is an administrator, and first in R86's list, exactly when the instance is claimed: the founder's
   * credential is held. That credential is `credentials`', so membership never reads it; one later module registers,
   * once at start, the function that answers it, and R64 and R86 ask that function. Anything but `true`, a throw, or
   * no registration at all reads as not claimed (fail closed: the founder is then no administrator here). The slot
   * takes one registration whoever makes it, so its refusals are R81's, naming the holder. */
  #claimedSource = null;   // {module, fn}

  registerClaimed(module, fn) {
    const refused = listenerRefusal(this.#claimedSource, module, fn);
    if (refused) return refused;
    this.#claimedSource = { module, fn };
    return { ok: true, module };
  }

  /* ===== R95 (K774) — THE PASSWORD AN ENROLMENT SETS, A WRITE `credentials` MAKES (its R20) =====
   *
   * Enrolment (R16) is one act: the member chooses a handle and a password, becomes active and spends the invitation.
   * The password is `credentials`', so membership never stores one; one module registers, once, the setter `enroll`
   * calls inside its act, `fn({role, password})`. Its refusals are R81's: a setter that is not a function is
   * LISTENER_MALFORMED, a second registration LISTENER_DECLARED naming the holder (`module`, when the registrant names
   * itself). */
  #passwordSetter = null;   // {module, fn}

  registerPasswordSetter(fn, module = "credentials") {
    const refused = listenerRefusal(this.#passwordSetter, typeof module === "string" && module ? module : "credentials", fn);
    if (refused) return refused;
    this.#passwordSetter = { module, fn };
    return { ok: true, module };
  }

  /* The enrolment's password write: the registered setter, answering true when it wrote; with none registered,
     nothing can be written, and the enrolment is refused before membership writes anything. */
  async #setEnrolmentPassword(role, password) {
    const setter = this.#passwordSetter;
    if (!setter) return false;
    try {
      const r = await setter.fn({ role, password });
      return !(r && typeof r === "object" && r.ok === false);
    } catch { return false; }
  }

  #claimed() {
    const source = this.#claimedSource;
    if (!source) return false;
    try { return source.fn() === true; } catch { return false; }
  }

  /* R68: a member's cover, handle, role and status, or null; never a credential, key or expertise. */
  memberFacts(memberId) {
    const m = this.#one(`SELECT cover, handle, role, status FROM members WHERE member_id=?`, memberId);
    if (m) return { cover: m.cover, handle: m.handle ?? null, role: m.role, status: m.status };
    return this.#founderMember(memberId);
  }

  /* R76 (T51; C80): the founder has no members row, so once the instance is claimed (R94) she is answered as the member her
     roster row (R147) says she is: no cover, the handle she holds or null, an administrator, active. Null for any other id
     and while the instance is not claimed; a members row holding the id `admin` is read as it is and never replaced. */
  #founderMember(memberId) {
    if (memberId !== Members.ROOT_ADMIN || !this.#claimed()) return null;
    return { cover: null, handle: this.founderHandle(), role: "admin", status: "active" };
  }

  /** R152 (T50; N1124, K3624): the instant `memberId`'s status last changed, an ISO string, or null when none is recorded
   *  (a status set before this was recorded is never back-filled) and for an id naming no member. Every status-changing
   *  write sets it and no other write moves it. Writes nothing; never throws. */
  memberStatusSince(memberId) {
    try {
      if (typeof memberId !== "string" || !memberId) return null;
      return this.#one(`SELECT status_at FROM members WHERE member_id=?`, memberId)?.status_at ?? null;
    } catch { return null; }
  }

  /* R10 (section 4.5; DEC-134 (4)): an administrator — never the founder, whose standing is the hosting account's
     (4.6) — resigns, becoming an ordinary member, unless they are the last administrator R86 lists (the founder counted
     once the instance is claimed). The refusal at two (`RESIGN_AT_TWO`, C-96.10) is retired: one administrator is
     enough (DEC-134 (1)), and only the group left with none is refused (`LAST_ADMIN`, C-96.22). */
  adminResign({ by = null } = {}) {
    if (by === Members.ROOT_ADMIN)
      return { ok: false, reason: "ROOT_OF_TRUST",
               detail: localize("membership.index.the_founding_administrator_holds_admin", "the founding administrator holds ADMIN_TOKEN and does not resign inside the application; the remedy is at the hosting account (section 4.6). Nothing was written.") };
    const m = typeof by === "string" && by ? this.#one(`SELECT role, status FROM members WHERE member_id=?`, by) : null;
    if (!m || m.role !== "admin" || m.status !== "active") return notAnAdmin(by, localize("member-roster.index.resigning_administrator_status", "resigning administrator status"));   /* R84 */
    const admins = this.activeAdmins();
    /* DEC-49 REGION is-admin-resign-last */
    if (admins.length <= 1)
      return Members.#rowRefusal("LAST_ADMIN",
        localize("membership.index.the_team_would_be_left", "the team would be left with no administrator, so its last one does not step down (DEC-134 (4)). Add another administrator first. Nothing was written."), { administrators: admins.length });
    /* END DEC-49 REGION is-admin-resign-last */
    const now = this.#instant();
    this.sql.exec(`UPDATE members SET role='member', status_by=?, updated=? WHERE member_id=?`, by, now, by);
    return { ok: true, memberId: by, role: "member", administrators: admins.length - 1,
             detail: localize("membership.index.resigned_an_ordinary_member_now", "resigned: an ordinary member now, holding the capabilities an administrator last set for them.") };
  }

  /* R11 (section 4.8; DEC-134 (3)): the group's answer to who holds hosting access. It is asked at setup
     (the setup screen's act, `screens-entry` R6, and the group's settings, `screens-settings` R18; the setup page's
     `setup-page` R15 is retired, K1851), never on adding an administrator, so `memberAdd` asks nothing about it. The group's answer, recorded by an administrator; append-only, the latest record is the answer. */
  hostingAccessSet({ holders = null, note = null, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.recording_who_holds_hosting_access", "recording who holds hosting access (4.8)"));   /* R84 */
    const refusal = (code, detail, extra) => Members.#custodialRefusal(code, detail, extra);   /* C-96.11 */
    /* DEC-49 REGION is-hosting-access-holders — N195: the whole refusal, the holders' reading with it. */
    const h = String(holders ?? "").trim().slice(0, 500);
    if (!h)
      return refusal("NO_HOLDERS",
        localize("membership.index.name_who_holds_hosting_access", "name who holds hosting access: the record keeps the team's answer as it was given, and an empty answer records nobody. Nothing was written."));
    /* END DEC-49 REGION is-hosting-access-holders */
    const at = this.#instant();
    const n = note === null || note === undefined || String(note).trim() === "" ? null : String(note).slice(0, 280);
    this.sql.exec(`INSERT INTO hosting_access (holders, note, recorded_by, at) VALUES (?,?,?,?)`, h, n, by, at);
    return { ok: true, holders: h, note: n, recorded_by: by, at };
  }

  /* N70: BOUNDED, AND THE BOUND IS PUBLISHED (R48's shape): the history grows with every answer the group records, so
     `limit` is the cap applied (the caller may lower it, never raise it), `truncated` is measured by reading one row
     past it, and the page is the first `limit` records in the order they were recorded. `current`, the latest
     record, is read on its own, so a cut history never changes what the answer is. */
  hostingAccess({ limit = null } = {}) {
    const cap = Math.max(1, Math.min(Number(limit) || Members.HOSTING_ACCESS_LIMIT, Members.HOSTING_ACCESS_LIMIT));
    const found = this.#rows(`SELECT holders, note, recorded_by, at FROM hosting_access ORDER BY seq LIMIT ?`, cap + 1);
    const truncated = found.length > cap;
    const current = this.#one(`SELECT holders, note, recorded_by, at FROM hosting_access ORDER BY seq DESC LIMIT 1`);
    return { ok: true, recorded: current !== null, current, history: truncated ? found.slice(0, cap) : found,
             limit: cap, truncated };
  }

  /* N70: the history's page size, a chosen ceiling (the directory's reasoning, now `project-roster`'s): generous enough that a
     group reading who holds its hosting access rarely meets it, published whenever it cuts. */
  static HOSTING_ACCESS_LIMIT = 200;

  /* R19 (section 3, "Pairing"): whether a member's cover-and-handle pairing is published is a per-member decision
     the member or an administrator may make. The roster's cover stays an administrator's view (R17); the published
     pairings are read with `memberPairings`. */
  memberPairingSet({ memberId, published, by = null } = {}) {
    const m = this.#one(`SELECT member_id FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    const refusal = (code, detail, extra) => Members.#custodialRefusal(code, detail, extra);   /* C-96.12 */
    /* DEC-49 REGION is-pairing-yours */
    if (by !== memberId && !this.isAdministrator(by))
      return refusal("PAIRING_NOT_YOURS",
        localize("membership.index.whether_a_pairing_is_published", "whether a pairing is published is the member's own decision or an administrator's (section 3). Nothing was written."), { by });
    /* END DEC-49 REGION is-pairing-yours */
    const want = published === true || published === 1 || published === "1" || published === "true";
    this.sql.exec(`UPDATE members SET pairing_published=?, updated=? WHERE member_id=?`,
      want ? 1 : 0, this.#instant(), memberId);
    return { ok: true, memberId, published: want, by };
  }

  /* R19 (N85, K124): what each viewer may see of the pairings. A published pairing reaches every caller; one its
     member has not published reaches only that member and the administrators. `viewer` is the control plane's viewer
     stamp and `administer` its administer stamp (memberList's, D-157): an administrator is one the stamp says
     administers, the founder's viewer once the instance is claimed, or a viewer naming an active administrator.
     Fails closed: with neither stamp a caller is shown the published pairings alone. */
  /* N70: bounded as `hostingAccess` is: the first `limit` pairings by handle (200 at most, the caller's to lower),
     `truncated` measured by reading one row past the cap. */
  memberPairings({ viewer = null, administer = null, limit = null } = {}) {
    const self = viewerMember(viewer);
    const admin = administer === true || administer === "1"
      || (baseViewer(viewer) === Members.ROOT_ADMIN && this.isAdministrator(Members.ROOT_ADMIN))
      || (self !== null && this.isAdministrator(self));
    const cap = Math.max(1, Math.min(Number(limit) || Members.MEMBER_PAIRINGS_LIMIT, Members.MEMBER_PAIRINGS_LIMIT));
    const found = this.#rows(
      `SELECT handle, cover, pairing_published FROM members
        WHERE handle IS NOT NULL AND (pairing_published=1 OR ? OR member_id=?) ORDER BY handle LIMIT ?`,
      admin ? 1 : 0, self, cap + 1).map((r) => ({ handle: r.handle, cover: r.cover, published: r.pairing_published === 1 }));
    const truncated = found.length > cap;
    return { ok: true, pairings: truncated ? found.slice(0, cap) : found, limit: cap, truncated };
  }

  static MEMBER_PAIRINGS_LIMIT = 200;

  static async #sha256(v) {
    const b = await crypto.subtle.digest("SHA-256", Members.#enc.encode(v));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  static #enc = new TextEncoder();

  static #rand(n = 32) {
    return [...crypto.getRandomValues(new Uint8Array(n))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* What a session may DO. Membership Architecture v2 section 5.
   *
   * Resolved HERE, at the point the session is read, rather than cached on the
   * session row: a capability change has to take effect on the next request and
   * not on the next login, or an administrator revoking `publish` from someone
   * mid-incident would be revoking it in eight hours' time.
   *
   * THE FOUNDER HOLDS EVERYTHING, and that is 4.6 rather than convenience. The
   * holders of ADMIN_TOKEN are the root of trust and every rule in the
   * membership model sits beneath them. 4.6 also forbids any interface implying
   * otherwise, so reporting them as capability-bounded would be a lie in the
   * one place it matters.
   *
   * AN IN-APP ADMINISTRATOR HOLDS EVERY WORKING CAPABILITY. v2 section 5,
   * confirmed 2026-07-26. Not read from their row, and deliberately: `memberCaps`
   * refuses to touch an administrator's row at all, to protect 4.4, so if the row
   * were consulted an administrator's powers would be frozen forever at whatever
   * their invitation happened to set, and an administrator invited with the
   * default `["contribute"]` could never publish and could never be granted
   * permission to. A field nobody can edit is not a variable. Reading it as not
   * consulted is the only reading with no trap in it.
   *
   * FAIL CLOSED everywhere else. An unrecognised role, a member row that is
   * gone, or a member whose status is not active resolves to NO capabilities
   * rather than to the member default. Revocation already deletes sessions; this
   * is what covers the race between the delete and an in-flight request.
   *
   * R92 (K637): a named service, `credentials`' `session` reads it for every session (its R5). It writes nothing and
   * never throws: a read it cannot make holds no rights.
   */
  sessionRights(role) {
    const none = { capabilities: [], administer: false, member: null, handle: null, rootOfTrust: false };
    try { return this.#rightsOf(role, none); } catch { return none; }
  }

  #rightsOf(role, none) {
    if (role === Members.ROOT_ADMIN)
      return { capabilities: [...Members.CAPABILITIES], administer: true,
               member: Members.ROOT_ADMIN, handle: this.founderHandle(), rootOfTrust: true };   /* R92, R144 */
    if (typeof role !== "string" || !role.startsWith("member:")) return none;
    const id = role.slice(7);
    const m = this.#one(
      `SELECT member_id, handle, role, status, capabilities FROM members WHERE member_id=?`, id);
    if (!m || m.status !== "active") return { ...none, member: id };
    const admin = m.role === "admin";
    return {
      capabilities: admin ? [...Members.CAPABILITIES] : this.#capsOf(m),
      administer: admin, member: id, handle: m.handle ?? null, rootOfTrust: false,
    };
  }

  /* R119 (N783): the member whose handle is exactly `handle`, `{member_id, handle, status}`, or null. R32, R36 and
     `project-roster` R3–R5 and R12 resolve a handle through it. Writes nothing and never throws. */
  memberByHandle(handle) {
    if (typeof handle !== "string" || handle === "") return null;
    try {
      const r = this.#one(`SELECT member_id, handle, status FROM members WHERE handle=?`, handle);
      return r ? { member_id: r.member_id, handle: r.handle, status: r.status } : null;
    } catch { return null; }
  }

  /* ---- section 1.3: declared expertise, confirmed licenses ----
   *
   * TWO CLAIMS BY TWO PEOPLE, kept apart for the same reason the intake doctrine
   * keeps who ISSUED a document separate from how faithfully it was CAPTURED.
   * The member says what they hold. An administrator says whether the group has
   * satisfied itself that they hold it. Neither stands in for the other.
   *
   * WRITE AUTHORITY IS SPLIT BY COLUMN. A member writes `label` and never the
   * confirmation events; an administrator writes the confirmation events and can
   * never introduce a label the member did not declare. That is what keeps
   * confirmation a confirmation rather than an assignment.
   *
   * AND IT GATES NOTHING. An unconfirmed entry costs its holder no capability,
   * no visibility and no access. It appears in no session, is consulted by no
   * op, and must never enter the enforcement path. Section 5 in v2: it informs
   * humans; it gates nothing, confirmed or not. */
  static #normLabel(label) {
    return String(label ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  }

  #expertiseState(memberId, label) {
    const r = this.#one(
      `SELECT event, actor, created FROM member_expertise WHERE member_id=? AND label=?
       ORDER BY seq DESC LIMIT 1`, memberId, label);
    return r ? r.event : null;
  }

  /* R17, R72: EXPERTISE_NO_LABEL is minted here alone; the declaration and the holders' read answer through it, each with
     its own detail. */
  static #noLabel(detail) {
    /* DEC-49 REGION is-expertise-labelled */
    const row = MEMBERSHIP_CHECKS.EXPERTISE_NO_LABEL;
    return { ok: false, reason: "EXPERTISE_NO_LABEL", code: "EXPERTISE_NO_LABEL", check: row.check,
             translation: row.translation, detail };
    /* END DEC-49 REGION is-expertise-labelled */
  }

  /* R76: the member an expertise act is about: a members row, else the founder once the instance is claimed. */
  #expertiseSubject(memberId) {
    const m = this.#one(`SELECT member_id, status FROM members WHERE member_id=?`, memberId);
    return m || (this.#founderMember(memberId) ? { member_id: Members.ROOT_ADMIN, status: "active" } : null);
  }

  /** The member's own statement about themselves. */
  expertiseDeclare({ memberId, label } = {}) {
    const m = this.#expertiseSubject(memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    if (m.status !== "active") return { ok: false, reason: "NOT_ACTIVE" };
    const lab = Members.#normLabel(label);
    /* N285 (K275, K343): R21's refusal is its own condition, an expertise declared without a readable name, so it has
       its own code and its own row (C-96.13), no longer the `NO_LABEL` progressions and entities mint for theirs. */
    if (!lab) return Members.#noLabel("a declaration needs a label, such as 'CPA'");
    const cur = this.#expertiseState(memberId, lab);
    if (cur === "declared" || cur === "confirmed")
      return { ok: false, reason: "ALREADY_DECLARED", label: lab, state: cur };
    this.sql.exec(
      `INSERT INTO member_expertise (member_id,label,event,actor,created) VALUES (?,?,'declared',?,?)`,
      memberId, lab, memberId, this.#instant());
    return { ok: true, memberId, label: lab, state: "declared", confirmed: false,
             detail: localize("member-roster.index.declared_and_unconfirmed_which_costs_nothing", "declared and unconfirmed, which costs nothing: an unconfirmed entry carries the same capabilities, visibility and access as a confirmed one") };
  }

  /** An administrator vouching, INCLUDING for another administrator (4.9). */
  expertiseConfirm({ memberId, label, by, withdraw = false } = {}) {
    /* R84 (N327, DEC-83). */
    if (!this.isAdministrator(by))
      return notAnAdmin(by, localize("member-roster.index.confirming_or_withdrawing_a_members_declared", "confirming or withdrawing a member's declared expertise"),
        { remedy: word("membership.remedy.active_administrator_group_confirm") });   /* R151 */
    const m = this.#expertiseSubject(memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    const lab = Members.#normLabel(label);
    const cur = this.#expertiseState(memberId, lab);
    /* An administrator cannot introduce a label. Confirming something never
       declared would make this an assignment rather than a confirmation, and the
       whole point of 1.3 is that the two statements have two different authors. */
    /* R79 (DEC-376): a withdrawal took the declaration back with the confirmation, so a withdrawn label is confirmed only
       after the member declares it again. */
    if (cur === null || (cur === "withdrawn" && !withdraw))
      return { ok: false, reason: "NOT_DECLARED", label: lab,
               detail: localize("member-roster.index.this_member_has_not_declared", "this member has not declared that. An administrator confirms what a member claims and never introduces the claim, or it would be an assignment rather than a confirmation.") };
    if (!withdraw && cur === "confirmed") return { ok: false, reason: "ALREADY_CONFIRMED", label: lab };
    if (withdraw && cur !== "confirmed") return { ok: false, reason: "NOT_CONFIRMED", label: lab, state: cur };
    /* Supersede, never overwrite: the earlier confirmation stays readable. */
    this.sql.exec(
      `INSERT INTO member_expertise (member_id,label,event,actor,created) VALUES (?,?,?,?,?)`,
      memberId, lab, withdraw ? "withdrawn" : "confirmed", by, this.#instant());
    return { ok: true, memberId, label: lab, state: withdraw ? "withdrawn" : "confirmed",
             confirmed: !withdraw, by };
  }

  /** R79 (T51; DEC-386, DEC-376; `op=expertisewithdraw`): an administrator withdraws a confirmed expertise with a reason.
   *  The one `withdrawn` entry takes back the confirmation and the declaration together (the label then reads neither
   *  declared nor confirmed), and the earlier entries stay in its history (R19). */
  expertiseWithdraw({ memberId, label, reason, by } = {}) {
    if (!this.isAdministrator(by))
      return notAnAdmin(by, localize("member-roster.index.withdrawing_a_members_confirmed_expertise", "withdrawing a member's confirmed expertise"));   /* R28 */
    if (!this.#expertiseSubject(memberId)) return noSuchMember(memberId);   /* R49 */
    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("member-roster.index.a_withdrawal_is_recorded_with_a", "a withdrawal is recorded with a reason") };
    const lab = Members.#normLabel(label);
    const cur = this.#expertiseState(memberId, lab);
    if (cur === null)
      return { ok: false, reason: "NOT_DECLARED", label: lab,
               detail: localize("member-roster.index.this_member_has_not_declared", "this member has not declared that. An administrator confirms what a member claims and never introduces the claim, or it would be an assignment rather than a confirmation.") };
    if (cur !== "confirmed") return { ok: false, reason: "NOT_CONFIRMED", label: lab, state: cur };
    this.sql.exec(
      `INSERT INTO member_expertise (member_id,label,event,actor,created,reason) VALUES (?,?,'withdrawn',?,?,?)`,
      memberId, lab, by, this.#instant(), why);
    return { ok: true, memberId, label: lab, state: "withdrawn", confirmed: false, by, reason: why };
  }

  /** The roster view: current state per label, with the history behind it. */
  expertiseList({ memberId } = {}) {
    const rows = this.#rows(
      `SELECT seq, label, event, actor, created, reason FROM member_expertise WHERE member_id=? ORDER BY seq`,
      memberId);
    const cur = new Map();
    for (const r of rows) cur.set(r.label, r);
    return { ok: true, memberId,
      expertise: [...cur.values()].map((r) => ({
        label: r.label, state: r.event, confirmed: r.event === "confirmed",
        by: r.actor, at: r.created,
        /* Both are surfaced so an interface can show WHICH of the two claims it
           is looking at, which is the entire function of the distinction. */
        history: rows.filter((h) => h.label === r.label)
          .map((h) => ({ event: h.event, actor: h.actor, at: h.created, ...(h.reason ? { reason: h.reason } : {}) })),   /* R79 */
      })).sort((a, b) => a.label.localeCompare(b.label)),
      gates: "nothing" };
  }

  /* ---- the membership model's member half, Architecture sections 3 to 6 ----
   *
   * The arithmetic of section 4.7 lives in ONE place, `adminArithmetic`, and
   * every rule below reads it rather than restating it. The table in the
   * architecture document is the specification and R5's test (`test/m/membership/`)
   * asserts it row by row, because this is the part of the design that is cheap
   * to get subtly wrong and expensive to discover wrong.
   */
  static CAPABILITIES = ["contribute", "publish", "create_projects"];

  /** Removal takes a MAJORITY OF ALL ADMINISTRATORS, counting the target in the
   *  denominator but not letting them vote, and ties do not eject.
   *
   *  That one sentence is what makes removal impossible at two without needing a
   *  special case, demands unanimity while the group is small enough for
   *  unanimity to be reasonable, and loosens as the group grows. A lone captured
   *  administrator can never eject anyone at any size. It fails only to a
   *  colluding majority, and nothing survives a colluding majority. */
  static adminMath(n) {
    const votesNeeded = Math.floor(n / 2) + 1;
    const eligibleVoters = Math.max(0, n - 1);
    return { administrators: n, votesNeeded, eligibleVoters, possible: votesNeeded <= eligibleVoters };
  }

  /** The table, computed rather than transcribed, so the code and the document
   *  cannot drift. Exposed as an op because a UI must be able to tell a group
   *  what it would take BEFORE they start a removal. */
  adminArithmetic() {
    const table = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) table.push(Members.adminMath(n));
    return { ok: true, table, live: Members.adminMath(this.activeAdmins().length) };
  }

  /* Who counts as an administrator.
   *
   * The FOUNDING administrator has no members row. They claimed the instance by
   * spending ADMIN_TOKEN, which is what 4.1 describes: the solo participant is
   * the administrator, and the whole membership apparatus stays invisible until
   * a second person exists. Counting only member rows made a claimed instance
   * with one invited administrator look like a group of one, so the second
   * invitation was issued unilaterally when it should have needed consensus.
   * Found by the existing members suite failing, not by the new one.
   *
   * The founder is named `admin`, the credentials role they hold, and they
   * cannot be removed by vote: per 4.6 the holders of ADMIN_TOKEN are the root
   * of trust and every rule in the membership model sits beneath them.
   * Membership does not and cannot constrain them, and an interface that
   * implied otherwise would be lying. */
  static ROOT_ADMIN = ROOT_ADMIN;

  /* R86 (N329): the administrators in a stated order: the founder first once the instance is claimed, then every active
     member with role `admin` in the order their member rows were created, ties broken by member id (`tasks` R1's
     "earliest active administrator" is the first after the founder). Writes nothing and never throws. */
  activeAdmins() {
    const rows = this.#rows(`SELECT member_id FROM members WHERE role='admin' AND status='active'
                              ORDER BY created, member_id`)
      .map((r) => r.member_id);
    return this.#claimed() ? [Members.ROOT_ADMIN, ...rows] : rows;   /* R94 */
  }

  /* REC-159 — THE ROSTER ANSWERS §4.9's CUSTODIAL ACTS, and it is asked BEFORE anything is looked up,
   * so a caller with no standing learns nothing about the member or key it named. `by` is the control
   * plane's STAMP (op-declarations' `CUSTODIAL_ACTIONS`, applied by control-plane), relayed from the query and
   * never from a body.
   * THREE SHAPES AND THREE ANSWERS, each true of the caller:
   *   - a member's id — a signed-in session: admitted only if they are an ACTIVE administrator, else
   *     NOT_AN_ADMIN, by name, answered through `notAnAdmin` (R84), as at `memberCaps`;
   *   - `class:<cls>` — the operator's bearer, which BOB #22 RULED keeps these acts; the plane's
   *     `machineClasses` decides which classes reach here, and the record names the credential;
   *   - absent — a route with no plane in front of it. Nothing is attributed, and the row records
   *     `not recorded`, which is what it is.
   * ANSWERS NULL when the act may proceed. */
  #custodialBar(by, act) {
    if (by === null || by === undefined || by === "") return null;
    if (String(by).startsWith(MACHINE_CLASS_PREFIX)) return null;
    if (this.activeAdmins().includes(by)) return null;
    return notAnAdmin(by, act);   /* R84 (N324): C-96.1 minted at its one site */
  }

  /* D-134 / DEC-49 — THE CUSTODIAL ACTS' REFUSALS, BUILT FROM C-96's ROWS. `reason` AND `code` carry the
   * same literal, `#leadRefusal`'s precedent: every existing caller reads `reason`, the guard and the
   * surfaces read `code`. The code is a STRING LITERAL at each call site, never a variable. */
  static #custodialRefusal(code, detail, extra) {
    const row = CUSTODIAL_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation,
             ...(extra || {}), detail };
  }

  /* REC-159: the stored actor, or the stated absence of one. */
  static #statusBy(v) { return typeof v === "string" && v !== "" ? v : "not recorded"; }

  #capsOf(row) {
    try { const v = JSON.parse(row.capabilities || "[]"); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }

  /** Set a member's capabilities. NOT a route to administrator status: that is
   *  granted and removed only by the section 4 process, and 4.4 says no
   *  administrator may strip another, so this refuses to touch either side of
   *  that line. */
  /*  D-136 ADDS `by`, AND IT IS READ RATHER THAN RECORDED. Section 4.9 makes
   *  setting capabilities a custodial act of an ADMINISTRATOR, and the control
   *  plane now stamps `by` from the session (op-declarations' `GOVERNANCE_ACTIONS`, applied by control-plane).
   *  A stamp nothing consults is a mechanism believed on the strength of its
   *  EXISTENCE rather than its behaviour, so the check sits here beside
   *  `adminEndorse`'s and `adminRemove`'s, which asked the same question of the
   *  same roster before this item and were whole except for who supplied the
   *  answer. A bearer credential stamps `class:<cls>`, which is in no roster,
   *  so it is refused here even if the control plane's fence in front of it were
   *  removed (R9's test in `test/m/membership/not-an-admin-visibility.test.mjs`
   *  asks it with a bearer's stamp and no fence in front).
   *
   *  IT IS ASKED BEFORE `NO_SUCH_MEMBER`, deliberately: who may ask is settled
   *  before the record answers whether a member exists, so a caller with no
   *  standing cannot use this op to enumerate the roster. */
  memberCaps({ memberId, capabilities, by } = {}) {
    const admins = this.activeAdmins();
    if (!by || !admins.includes(by)) return notAnAdmin(by, localize("member-roster.index.setting_a_members_capabilities", "setting a member's capabilities"));   /* R84 */
    const m = this.#one(`SELECT member_id, role FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    const want = Array.isArray(capabilities) ? capabilities : null;
    if (!want) return { ok: false, reason: "BAD_CAPABILITY", detail: localize("member-roster.index.capabilities_is_an_array", "capabilities is an array") };
    if (want.includes("administer") || m.role === "admin")
      return { ok: false, reason: "NOT_A_CAPABILITY_GRANT",
               detail: localize("membership.index.administrator_status_is_granted_and", "administrator status is granted and removed only by the section 4 process, never by editing a field. 4.4: no administrator may strip another.") };
    const bad = want.filter((c) => !Members.CAPABILITIES.includes(c));
    if (bad.length) return { ok: false, reason: "BAD_CAPABILITY", got: bad, known: Members.CAPABILITIES };
    this.sql.exec(`UPDATE members SET capabilities=?, updated=? WHERE member_id=?`,
      JSON.stringify(want), this.#instant(), memberId);
    /* `by` travels back in the answer for `adminRemove`'s reason — an act the
       record attributes to a person should say whom it attributed it to, at the
       moment it is performed, so a caller can see the server's answer rather
       than its own. */
    return { ok: true, memberId, capabilities: want, by };
  }

  /** Endorse a proposed administrator. Addition above the second requires the
   *  CONSENSUS of every existing administrator, and that is the load-bearing
   *  half of 4.7: without it a captured administrator recruits confederates and
   *  manufactures the majority that ejects the honest ones. */
  async adminEndorse({ memberId, by } = {}) {
    /* R6 (T38, K2276): the caller's standing first, so no one who may not act learns whether a member exists. */
    const admins = this.activeAdmins();
    if (!by || !admins.includes(by)) return notAnAdmin(by, localize("member-roster.index.endorsing_a_proposed_administrator", "endorsing a proposed administrator"));   /* R84 */
    const m = this.#one(`SELECT member_id, status, role, invite_days FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    /* N335: C-96.14, this module's row (K275). */
    /* DEC-49 REGION is-endorse-proposed */
    if (m.status !== "proposed") {
      const row = MEMBERSHIP_CHECKS.NOT_PROPOSED;
      return { ok: false, reason: "NOT_PROPOSED", code: "NOT_PROPOSED", check: row.check, translation: row.translation,
               status: m.status,
               detail: localize("membership.index.only_a_member_whose_status", "only a member whose status is 'proposed' is endorsed as an administrator (4.7), and this member's is not. Nothing was written.") };
    }
    /* END DEC-49 REGION is-endorse-proposed */
    const now = this.#instant();
    this.sql.exec(`INSERT OR REPLACE INTO admin_votes (kind,target,voter,reason,created) VALUES ('add',?,?,?,?)`,
      memberId, by, null, now);
    const have = this.#rows(`SELECT voter FROM admin_votes WHERE kind='add' AND target=?`, memberId)
      .map((r) => r.voter).filter((v) => admins.includes(v));
    const awaiting = admins.filter((a) => !have.includes(a));
    if (awaiting.length)
      return { ok: false, reason: "CONSENSUS_REQUIRED", memberId, have: have.sort(), awaiting: awaiting.sort(),
               detail: localize("member-roster.index.every_existing_administrator_must_endorse", "every existing administrator must endorse an addition beyond the second") };
    /* Consensus reached: the invitation is issued now, and the plaintext code
       appears exactly once, here, as it does for any other invitation. */
    const invite = Members.#rand(16);
    const hash = await Members.#sha256(invite);
    /* R97: the invitation expires as R13's does, after the days chosen at `memberAdd` (kept on the proposal), or 7. */
    const days = Number.isInteger(m.invite_days) ? m.invite_days : Members.INVITE_DAYS_DEFAULT;
    const expires = Members.#expiresAt(now, days);
    /* D-610 (BOB #35, 2026-09-25): the transition is the act of the administrator whose vote COMPLETED
       the consensus, so `status_by` names `by` — not the proposer the row carried from `memberAdd`. */
    this.sql.exec(`UPDATE members SET status='invited', invite_hash=?, invite_expires=?, status_by=?, status_at=?, updated=? WHERE member_id=?`,
      hash, expires, by, now, now, memberId);
    return { ok: true, memberId, invite, expires, endorsedBy: have.sort() };
  }

  /** Vote to remove an administrator. Section 4.7. */
  adminRemove({ memberId, by, reason } = {}) {
    /* R7 (T38, K2276): the caller's standing first, before any fact about the target, so no one who may not act
       learns whether a member exists, is an administrator, or is the founder. */
    const admins = this.activeAdmins();
    if (!by || !admins.includes(by)) return notAnAdmin(by, localize("member-roster.index.voting_to_remove_an_administrator", "voting to remove an administrator"));   /* R84 */
    /* The founding administrator is the root of trust (4.6) and is not
       removable by the membership model, because the membership model runs on
       an instance they control. Saying so plainly is an obligation of 4.6: no
       interface may describe the administrator model as though it bounds this
       power, because it does not. The escape hatch in the other direction is
       replacing ADMIN_TOKEN in the hosting dashboard, which returns the
       instance to unclaimed. */
    if (memberId === Members.ROOT_ADMIN)
      return { ok: false, reason: "ROOT_OF_TRUST",
               detail: localize("membership.index.the_founding_administrator_holds_admin_2", "the founding administrator holds ADMIN_TOKEN and cannot be removed from inside the application. Whoever can set ADMIN_TOKEN can take the team over, and there is no arrangement in which nobody holds that power, because your team's Civicsmith runs in somebody's hosting account. The remedy is at the hosting account, not here (section 4.6).") };
    const m = this.#one(`SELECT member_id, role, status FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    /* D-134: the TARGET is not an administrator — a different fact from the CALLER not being one, which is
       what NOT_AN_ADMIN says at every other site, so it carries its own code and its own canned sentence. */
    const refusal = (code, detail, extra) => Members.#custodialRefusal(code, detail, extra);
    /* DEC-49 REGION is-remove-target-admin */
    if (m.role !== "admin")
      return refusal("TARGET_NOT_AN_ADMIN",
        "this member is not an administrator, so there is no administrator to remove; an ordinary member "
      + "is deactivated with op=memberset", { memberId });
    /* END DEC-49 REGION is-remove-target-admin */
    if (memberId === by) return { ok: false, reason: "TARGET_CANNOT_VOTE",
      detail: localize("member-roster.index.the_target_is_counted_in_the", "the target is counted in the denominator but does not vote") };
    const why = String(reason ?? "").trim();
    if (!why) return { ok: false, reason: "NO_REASON", detail: localize("member-roster.index.removals_are_recorded_with_a_reason", "removals are recorded with a reason") };

    const math = Members.adminMath(admins.length);
    if (!math.possible)
      return { ok: false, reason: "IMPOSSIBLE_AT_TWO", ...math,
               detail: localize("membership.index.removal_takes_votesneeded_of_administrators", "removal takes {votesNeeded} of {administrators} administrators and only {eligibleVoters} may vote, so it cannot be carried. That is the rule working, not a defect: a lone administrator must never be able to eject the other.", { votesNeeded: String(math.votesNeeded), administrators: String(math.administrators), eligibleVoters: String(math.eligibleVoters) }) };

    if (this.#one(`SELECT voter FROM admin_votes WHERE kind='remove' AND target=? AND voter=?`, memberId, by))
      return { ok: false, reason: "ALREADY_VOTED", by };
    const now = this.#instant();
    this.sql.exec(`INSERT INTO admin_votes (kind,target,voter,reason,created) VALUES ('remove',?,?,?,?)`,
      memberId, by, why, now);

    const votes = this.#rows(`SELECT voter, reason FROM admin_votes WHERE kind='remove' AND target=?`, memberId)
      .filter((v) => admins.includes(v.voter) && v.voter !== memberId);
    if (votes.length < math.votesNeeded)
      return { ok: false, reason: "VOTES_SHORT", memberId, have: votes.length, need: math.votesNeeded,
               ...math, deciders: votes.map((v) => v.voter).sort() };

    /* Carried. Revocation is immediate and takes sessions and signing keys with it, exactly as an ordinary
       revocation does: R79's listeners are told in this act, and `credentials`' (its R16) ends the sessions and
       revokes the keys, naming the same actor. */
    /* D-610 (BOB #35, 2026-09-25): the removal is recorded under the administrator whose vote CARRIED it. */
    this.sql.exec(`UPDATE members SET status='revoked', status_by=?, status_at=?, updated=? WHERE member_id=?`, by, now, now, memberId);
    if (m.status !== "revoked") this.#announceRevoked(memberId, by, now);   /* N123, R8 */
    return { ok: true, memberId, removed: true, ...math,
             deciders: votes.map((v) => v.voter).sort(), reasons: votes.map((v) => v.reason).filter(Boolean),
             alsoDo: word("membership.also_do") };   /* R151 */
  }

  async memberAdd({ memberId, cover, role = "member", capabilities = null,
                    expertise = null, expiresInDays = undefined, by = null } = {}) {
    /* REC-159: the roster first — before the id is judged or looked up. */
    const barAdd = this.#custodialBar(by, localize("member-roster.index.adding_a_member", "adding a member"));
    if (barAdd) return barAdd;
    /* K57: the field is a cover, and `name` is no longer read as an alias of it (two words for one thing is how
       drift starts; a legal name is the exposure the cover exists to prevent). */
    const label = typeof cover === "string" && cover.trim() ? cover : null;
    /* D-134: C-55's row answers as it always did; every other refusal here is C-96's (DEC-49). */
    const refusal = (code, detail, extra) => {
      if (!(code in MEMBER_ID_CHECKS)) return Members.#custodialRefusal(code, detail, extra);
      const row = MEMBER_ID_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, memberId };
    };
    /* DEC-49 REGION is-member-add-id */
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(memberId || ""))
      return refusal("BAD_MEMBER_ID", localize("member-roster.index.lowercase_letters_digits_and_dashes", "lowercase letters, digits and dashes, 2 to 41 characters"));
    /* END DEC-49 REGION is-member-add-id */
    /* REC-132 / D-422 / C-55.1: the founder's name is not an id anybody else may hold.
       The pattern above admits it and nothing else reserved it, so a member enrolled as
       `admin` would have been read as the founder by every name-keyed check
       (`isAdministrator`, `activeAdmins`). Refused BEFORE the EXISTS test and before
       anything is written, whoever asks and whatever role is asked for. */
    /* DEC-49 REGION is-member-id-reserved */
    if (memberId === Members.ROOT_ADMIN)
      return refusal("MEMBER_ID_RESERVED",
        localize("membership.index.root_admin_names_the_founding", "'{ROOT_ADMIN}' names the founding administrator of your team's Civicsmith; no member may be enrolled under it", { ROOT_ADMIN: String(Members.ROOT_ADMIN) }));
    /* END DEC-49 REGION is-member-id-reserved */
    /* DEC-49 REGION is-member-add-shape */
    if (!label || typeof label !== "string")
      return refusal("NO_COVER",
        localize("member-roster.index.a_cover_is_the_label_you", "a cover is the label you use to tell participants apart; it need not be, and often should not be, a legal name"));
    if (this.#one(`SELECT member_id FROM members WHERE member_id=?`, memberId))
      return refusal("EXISTS", localize("membership.index.a_member_row_already_holds", "a member row already holds the id '{memberId}'; nothing was written", { memberId: String(memberId) }), { memberId });
    /* END DEC-49 REGION is-member-add-shape */

    /* D-51. v1.4 let an administrator ASSIGN expertise when creating the
       invitation, and v2 1.3 forbids exactly that: a member declares what they
       hold and an administrator confirms it, and an administrator who could
       introduce the label would be making an assignment wearing a
       confirmation's name. Refused rather than ignored, because silently
       dropping a caller's argument is how the two copies drifted apart in the
       first place. */
    if (expertise !== null && expertise !== undefined)
      return { ok: false, reason: "EXPERTISE_IS_NOT_ASSIGNED",
               detail: "expertise is declared by the member and then confirmed by an administrator "
                     + "(section 1.3). It is not set when the invitation is created, because an "
                     + "administrator who could introduce the label would be assigning it rather than "
                     + "confirming it. Use op=expertisedeclare and op=expertiseconfirm." };
    /* R97 (DEC-133 (2)): how long the invitation lasts, judged last (R12's order). */
    const days = Members.#expiryRefusal(expiresInDays);
    if (typeof days !== "number") return days;

    const wantAdmin = role === "admin";
    const admins = this.activeAdmins();
    /* DEC-134 (1), (7): one administrator is enough, and an ordinary member may be invited from the start. The old
       floor (`ADMINS_FIRST`, C-96.5: no ordinary member until two administrators exist) is retired; a second
       administrator is a recommendation setup makes once (`instance-setup`), never a gate here. */

    const caps = Array.isArray(capabilities) ? capabilities.filter((c) => Members.CAPABILITIES.includes(c))
                                             : ["contribute"];
    const now = this.#instant();

    /* 4.7 addition. The first administrator may add a second unilaterally,
       because a group of one has nobody to consult. Every subsequent addition
       needs the consensus of all existing administrators: without that, a
       captured administrator recruits confederates and manufactures the majority
       that ejects the honest ones. */
    /* D-134 (BOB #35): the stamped actor is the INVITER, on every path. */
    const inviter = by || null;
    if (wantAdmin && admins.length >= 2) {
      this.sql.exec(
        `INSERT INTO members (member_id,cover,handle,role,status,invite_hash,capabilities,created,updated,status_by,invited_by,
                              invite_days,door)
         VALUES (?,?,NULL,'admin','proposed',NULL,?,?,?,?,?,?,'administrator')`,
        memberId, label, JSON.stringify(caps), now, now, by || null, inviter, days);
      /* REC-156: `by` is the control plane's STAMP, relayed from the query by the
         dispatch and never taken from the caller's body — so this row is the
         PROPOSER'S own endorsement. The founder's session is stamped `admin`; a
         bearer is stamped `class:<cls>`, which no roster holds, so it records none. */
      if (by && admins.includes(by))
        this.sql.exec(`INSERT OR REPLACE INTO admin_votes (kind,target,voter,reason,created) VALUES ('add',?,?,NULL,?)`,
          memberId, by, now);
      const have = this.#rows(`SELECT voter FROM admin_votes WHERE kind='add' AND target=?`, memberId)
        .map((r) => r.voter).filter((v) => admins.includes(v));
      /* DEC-49 REGION is-admin-consensus */
      return refusal("CONSENSUS_REQUIRED",
        localize("membership.index.adding_an_administrator_beyond_the", "adding an administrator beyond the second requires the consensus of every existing administrator. No invitation is issued until they have all endorsed it."),
        { memberId, proposed: true, have: have.sort(), awaiting: admins.filter((a) => !have.includes(a)).sort() });
      /* END DEC-49 REGION is-admin-consensus */
    }

    const invite = Members.#rand(16);
    const hash = await Members.#sha256(invite);
    const expires = Members.#expiresAt(now, days);
    this.sql.exec(
      `INSERT INTO members (member_id,cover,handle,role,status,invite_hash,capabilities,created,updated,status_by,invited_by,
                            invite_expires,door)
       VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,'administrator')`,
      memberId, label, wantAdmin ? "admin" : "member", "invited", hash,
      JSON.stringify(caps), now, now, by || null, inviter, expires);
    /* The plaintext invite appears exactly once, here, for handing to the
       person. It is never readable again. R11 (DEC-134 (3)): no hosting-access question rides on it. */
    return { ok: true, memberId, invite, expires, role: wantAdmin ? "admin" : "member", capabilities: caps,
             invited_by: Members.#statusBy(inviter) };
  }

  /* An invitation is a BURNER: the token in the URL is the whole credential, and
   * after use the URL resolves to nothing and carries no record of what it
   * formerly addressed (Membership Architecture section 6).
   *
   * The previous scheme put `<memberId>:<code>` in the link, so anyone who saw a
   * leaked or archived one learned who had been invited. The token is now opaque
   * and the member id is never in it, never returned by this lookup, and never
   * needed to enrol.
   *
   * A SPENT token and a token that never existed return byte-identical answers.
   * That is the security property and not tidiness: a response distinguishing
   * them would confirm to whoever found the archived link that it had once
   * addressed somebody real, which is exactly what the burner is for. */
  static #INVITE_MISS = { ok: false, reason: "NO_SUCH_INVITATION",
    detail: localize("membership.index.this_invitation_is_not_live", "this invitation is not live. An invitation is spent the moment it is used, and a spent one cannot be told apart from one that never existed, nor from one that expired or was withdrawn.") };

  async #invited(invite) {
    if (typeof invite !== "string" || !/^[0-9a-f]{16,64}$/.test(invite)) return null;
    const hash = await Members.#sha256(invite);
    /* Looked up BY HASH, so the store never holds a usable invitation and a
       leaked database is not a set of live credentials. */
    const m = this.#one(
      `SELECT member_id, cover, role, status, capabilities, invite_expires
       FROM members WHERE invite_hash=? AND status='invited'`, hash);
    /* R97: an expired invitation answers as a spent one, byte for byte, and nothing revives it (no act moves an
       expiry). One made before invitations expired (NULL) stays as it was made. */
    return m && !Members.#expired(m.invite_expires, this.#nowMs()) ? m : null;
  }

  /** What a burner URL resolves to. Unauthenticated by necessity: the invitee
   *  holds no credential yet, which is what the invitation is for. */
  async inviteLook({ invite } = {}) {
    const m = await this.#invited(invite);
    if (!m) return { ...Members.#INVITE_MISS };
    /* The cover and capabilities are shown because the invitee is entitled to
       see what they are being asked to join as. The member id is NOT: it is the
       administrator's handle on them inside the roster, and the record will show
       the handle they are about to choose instead. */
    /* K57 (R15): `expertise` is the member's own record as R24 answers it (`member_expertise`), which for an
       invitee is empty: expertise is declared by an active member and never assigned by an invitation. */
    return { ok: true, cover: m.cover, role: m.role, capabilities: this.#capsOf(m),
             expertise: this.expertiseList({ memberId: m.member_id }).expertise };
  }

  async enroll({ invite, handle, password } = {}) {
    /* No member id. The token identifies the invitation, and requiring the id as
       well meant the link had to carry it, which is what leaked the invitee. */
    const m = await this.#invited(invite);
    if (!m) return { ...Members.#INVITE_MISS };
    /* The handle is the member's OWN name and the one the record shows, so it is
       chosen here and not by the administrator who issued the invitation. Unique
       across the instance, because a roster in which two people can answer to one
       name defeats the purpose of having one. */
    const h = String(handle ?? "").trim();
    const refused = this.#handleRefusal(h, m.member_id);
    if (refused) return refused;
    if (typeof password !== "string" || password.length < 12)
      return { ok: false, reason: "PASSWORD_TOO_SHORT", minimum: 12 };
    /* R95 (K774): the password is set by the registered setter, inside this act and before anything here is
       written, so a setter that did not write leaves the invitation live and the member as they were. */
    if (!(await this.#setEnrolmentPassword(`member:${m.member_id}`, password))) return Members.#enrolNotRecorded();
    /* Cover, capabilities and role are the administrator's and are NOT read from
       this call. An invitee who posts their own is ignored rather than refused,
       because the fields are not theirs to send and naming them in an error
       would teach a caller to try. Section 6: already attached, not editable.
       The invite hash is cleared, so the burner URL resolves to nothing
       afterwards and a leaked or archived link is inert. */
    /* D-610 (BOB #35, 2026-09-25): enrolment is the MEMBER'S own act, so `status_by` names them and no
       longer carries the inviter's stamp onto a status the inviter did not set. */
    this.sql.exec(`UPDATE members SET status='active', handle=?, invite_hash=NULL, status_by=?, status_at=?, updated=? WHERE member_id=?`,
      h, m.member_id, this.#instant(), this.#instant(), m.member_id);
    /* R108 (DEC-136 (1)): while the group chose to tell its members, the joining statement, given here once (an
       enrolment succeeds once per member); otherwise the key is absent. */
    return { ok: true, memberId: m.member_id, handle: h,
             ...(this.courtNotice().choice === "tell" ? { courtStatement: Members.COURT_STATEMENT } : {}) };
  }

  /* R16, R144: the one judgment of a chosen handle, `h` already trimmed, for an enrolment and for the founder's set:
     `NO_HANDLE`, `BAD_HANDLE` (R12's pattern), then `HANDLE_TAKEN` (R16 (T40, T46; DEC-184 (1), DEC-186 (2), DEC-196): taken
     when another member holds it now, whatever their status (a member who has left keeps theirs), or held it before, the
     founder's included, R144; `admin` always, R141). `self` is the member who may keep it, none for the founder. Null when
     the handle is free. */
  #handleRefusal(h, self) {
    if (!h) return { ok: false, reason: "NO_HANDLE",
      detail: localize("membership.index.choose_a_handle_it_is", "choose a handle. It is what the record shows: the author of a promotion, the attestor of a ratification, the participant list of a project. It is yours, not the label the administrator used to invite you.") };
    if (!Members.HANDLE_PATTERN.test(h))
      return { ok: false, reason: "BAD_HANDLE", detail: localize("member-roster.index.lowercase_letters_digits_and_dashes", "lowercase letters, digits and dashes, 2 to 41 characters") };
    if (this.#heldByAnother(h, self)) return { ok: false, reason: "HANDLE_TAKEN", handle: h };
    return null;
  }

  /* R95: the enrolment whose password could not be set. Nothing was written, the invitation is still live, and the
     answer says so; its row is this module's C-96.18. */
  static #enrolNotRecorded() {
    /* DEC-49 REGION is-enrol-password-set */
    const row = MEMBERSHIP_CHECKS.ENROL_NOT_RECORDED;
    return { ok: false, reason: "ENROL_NOT_RECORDED", code: "ENROL_NOT_RECORDED", check: row.check,
             translation: row.translation,
             detail: localize("membership.index.the_password_could_not_be", "the password could not be recorded, so the enrolment did not happen: the member is not active and the invitation is still live. Nothing was written.") };
    /* END DEC-49 REGION is-enrol-password-set */
  }

  static #projects(projectsOf, memberId, viewer) {
    if (typeof projectsOf !== "function") return [];
    try { const got = projectsOf(memberId, viewer); return Array.isArray(got) ? got : []; } catch { return []; }
  }

  /* R71 (T51; K624; split map §3 seam 4): the projects of a member are given by the caller, never read here.
     `projectsOf(memberId, viewer)` answers the list `membership` R18's rule gives that member for that viewer; it is called
     only for an administrator's roster (`administer`), for each row and for the founder's, in that order. Without a
     function, when it answers anything but a list, or when it throws, a row's `projects` is `[]`. */
  memberList({ administer, viewer = null, projectsOf = null } = {}) {
    /* THE COVER↔HANDLE PROJECTION (Membership Architecture v1 §3 and v2 §3,
       identical and unambiguous: "Pairing. Only administrators see cover and
       handle together"), and it is a PROJECTION rather than a refusal, because
       the same section says "Members and the public see handles". A member
       legitimately needs this roster — the participant list of a project, the
       author of a promotion, the attestor of a ratification — so the answer is
       the handle roster with the pairing withheld, never a closed door.
       D-157, MEASURED 2026-08-02: before this, an ordinary member's session and
       the shared MEMBER_TOKEN each received `handle` AND `cover` for every
       member, byte-identical to the administrator's view, while three comments
       in this source said the op was admin-only.

       THE STAKE, said here because this is the line that keeps it. schema.mjs
       on `members.cover`: the cover-and-handle split exists precisely so that a
       roster seized or subpoenaed does not deanonymise the group. A handle is
       already public — the record shows it. A cover is the administrator's
       private label for a person. Either one alone is inert; TOGETHER they are
       the map from the public record back to the people in it, and withholding
       that map from everyone who is not an administrator is the whole mechanism.
       This is the rare defect whose blast radius is OUTSIDE the project: the
       people in the roster are the ones it costs.

       `cover` is therefore NOT SELECTED for a caller who does not administer.
       The key is ABSENT from the row, not null and not blank — a key that is
       present and empty still confirms to whoever is asking that a pairing
       exists to be compelled.

       FAIL CLOSED. `administer` is stamped by the CONTROL PLANE from the
       credential that authenticated (control-plane, beside the D-15 viewer stamp)
       and is never taken from the request, the same impostor rule `viewer`,
       `author`, `by` and `owner` follow. Anything that is not the affirmative
       stamp — absent, blank, a caller's invention, a direct-DO route that
       forgot it — yields the handle roster, so a bypass of the stamp loses the
       pairing rather than leaking it. */
    const pairs = administer === true || administer === "1";
    const rows = this.#rows(
      `SELECT member_id, ${pairs ? "cover, " : ""}handle, role, status, status_by, invited_by, capabilities, pairing_published, created, updated,
              CASE WHEN invite_hash IS NULL THEN 0 ELSE 1 END AS invite_pending,
              door, approved_by, invite_expires, invite_withdrawn
       FROM members ORDER BY member_id`).map(({ door, approved_by, invite_expires, invite_withdrawn, ...r }) => ({
         ...r, capabilities: this.#capsOf(r),
         status_by: Members.#statusBy(r.status_by),   /* REC-159: who set the status, or `not recorded` */
         invited_by: Members.#statusBy(r.invited_by), /* D-134 (BOB #35): who invited them, or `not recorded` */
         /* D-51: served from `member_expertise`, not from the dead column on
            this row. Two places answering the same question, one of them never
            updated, is the shape that produces a roster nobody can trust. */
         expertise: this.expertiseList({ memberId: r.member_id }).expertise,
         /* R17 (T46; DEC-197): no `formerly` key: a handle is chosen at joining and never changed. */
         pairing_published: r.pairing_published === 1,              /* R19 */
         ...(pairs ? { projects: Members.#projects(projectsOf, r.member_id, viewer),   /* R18, R71: an administrator's roster */
                       /* R105: how each came in and their invitation, for an administrator's roster only. */
                       door: door ?? "administrator", approvedBy: approved_by ?? null,
                       expires: r.status === "proposed" ? null : invite_expires ?? null,
                       invitation: Members.#invitationState(r, invite_expires, invite_withdrawn, this.#nowMs()),
                       /* R83 (T52): a proposed administrator's endorsements, as R3 answers them; no other row has the key. */
                       ...(r.status === "proposed" && r.role === "admin" ? { endorsements: this.#endorsements(r.member_id) } : {}) } : {}) }));
    /* R147 (T50; N1119, K3369; amends R17, R86): once the instance is claimed (R94) the founder is listed, first, as R86
       orders her. She has no members row, so the row is built here: her id `admin` is `member_id` only, her `handle` the
       one she holds (R144) or null, `founder: true` on her row alone; never a cover, a door or an invitation. */
    const founder = this.#claimed() ? [{
      member_id: Members.ROOT_ADMIN, handle: this.founderHandle(), founder: true, role: "admin", status: "active",
      status_by: Members.#statusBy(null), invited_by: Members.#statusBy(null), capabilities: [...Members.CAPABILITIES],
      pairing_published: false, created: null, updated: null, invite_pending: 0, expertise: [],
      ...(pairs ? { projects: Members.#projects(projectsOf, Members.ROOT_ADMIN, viewer) } : {}),
    }] : [];
    return { members: [...founder, ...rows] };
  }

  /* ===== T40 (T40-M; N797, N799; DEC-184, DEC-186, Bob's "S18: B"; K1881, K2394) — A MEMBER'S HANDLE, CHECKED AS IT
   * IS TYPED; T46 (T46-4; N934; DEC-196, DEC-197; K2903) — AND NEVER CHANGED =====
   *
   * A handle is unique in the group and never reused (R16): every member's handle stays taken whatever the member's
   * status, a member who has left included, and so does every handle `handle_history` holds, the earlier handles of the
   * changes made before R124 was retired (append-only and never deleted, R57). The check (R123) says only free, taken or
   * not allowed, never who holds a handle or that it was someone's earlier one, and counts every call against a window
   * per invitation or member (K1881's protective limit). A handle is chosen at joining and never changed (DEC-197):
   * `handleChange` (R129) refuses every call `HANDLE_FIXED`, reading and writing nothing. R125's guard slot stands, so
   * reopening a change is one requirement, but no act here calls it. */

  static HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;

  /* R123 (K1881): 60 checks in any 10 minutes, per invitation or per member, by a two-bucket sliding window
     (`credentials` R38's form; `capture` R31's). */
  static HANDLE_CHECK_WINDOW = Object.freeze({ perKey: 60, windowMs: 10 * 60_000 });

  static HANDLE_CHECK_STATED = word("membership.handle_check_stated",
    { per_key: Members.HANDLE_CHECK_WINDOW.perKey, minutes: Members.HANDLE_CHECK_WINDOW.windowMs / 60_000 });

  /* Whether another member than `self` holds `handle` now, whatever their status, or held it before (R16); and R141
     (T47; K3076; credentials R67): `admin` is the founder's, so it is always taken, for enrolment and every check. */
  #heldByAnother(handle, self) {
    if (handle === Members.ROOT_ADMIN || handle === this.founderHandle()) return true;   /* R141, R144 */
    return !!this.#one(`SELECT 1 AS x FROM members WHERE handle=? AND member_id<>?
                        UNION ALL SELECT 1 AS x FROM handle_history WHERE from_handle=? AND member_id<>? LIMIT 1`,
      handle, self ?? "", handle, self ?? "");
  }

  /* R123: what in a typed handle does not fit R12's pattern: `length` (2 to 41), `start` (a letter or digit) and
     `characters`, naming each character outside lower-case letters, digits and hyphens, once, in the order typed. */
  static #handleProblems(h) {
    const problems = [];
    if (h.length < 2 || h.length > 41) problems.push({ problem: "length", min: 2, max: 41 });
    if (h.length && !/^[a-z0-9]/.test(h)) problems.push({ problem: "start" });
    const odd = [...new Set([...h].filter((c) => !/[a-z0-9-]/.test(c)))].slice(0, 20);
    if (odd.length) problems.push({ problem: "characters", characters: odd });
    return problems;
  }

  /* R123: the smallest `<handle>-2`, `-3`, … that R12's pattern admits and no member but `self` holds or held; null when
     none fits 41 characters. The handles so far taken under that stem are read once. */
  #suggestion(h, self) {
    const stem = `${h}-`;
    const founder = this.founderHandle();   /* R144: the founder's handle is taken to everyone */
    const taken = new Set(this.#rows(
      `SELECT handle AS h FROM members WHERE substr(handle, 1, ?) = ? AND member_id<>?
       UNION SELECT from_handle AS h FROM handle_history WHERE substr(from_handle, 1, ?) = ? AND member_id<>?`,
      stem.length, stem, self ?? "", stem.length, stem, self ?? "").map((r) => r.h));
    if (founder) taken.add(founder);
    for (let n = 2; ; n++) {
      const cand = `${stem}${n}`;
      if (cand.length > 41) return null;
      if (!taken.has(cand)) return cand;
    }
  }

  /* R123's window for one key at `now`: `prev × (1 − elapsed/W) + cur`. */
  #handleCheckEstimate(key, now) {
    const W = Members.HANDLE_CHECK_WINDOW.windowMs;
    const win = Math.floor(now / W);
    const at = (w) => Number(this.#one(`SELECT count FROM handle_check_window WHERE key=? AND win=?`, key, w)?.count ?? 0);
    return { prev: at(win - 1), cur: at(win), win, f: (now - win * W) / W };
  }

  /* Whole seconds until the estimate falls below the bound, no further check counted. */
  static #handleCheckRetry({ prev, cur, f }) {
    const W = Members.HANDLE_CHECK_WINDOW.windowMs, N = Members.HANDLE_CHECK_WINDOW.perKey;
    let ms;
    if (cur < N && prev > 0 && 1 - (N - cur) / prev < 1) ms = Math.max(0, (1 - (N - cur) / prev - f) * W);
    else ms = (1 - f) * W + Math.max(0, 1 - N / Math.max(cur, 1)) * W;
    return Math.max(1, Math.ceil(ms / 1000) + 1);
  }

  /* R123 (DEC-188 (7)): the paused answer's fields: `stated`, `retryAfter` in whole seconds, and `minutes`, the whole
     minutes until then, rounded up, which the translation's `{minutes}` names. */
  static #pausedFor(retryAfter) {
    return { stated: Members.HANDLE_CHECK_STATED, retryAfter, minutes: Math.ceil(retryAfter / 60) };
  }

  /** R123 (DEC-184 (2), (3), DEC-186 (3); K1881; `op=handlecheck`): whether `handle` could be taken in this group now,
   *  as a person types it, asked with a live invitation or by an active member (`viewer`, a member checking a handle;
   *  T46: no handle is changed, R129). Free, taken (with a
   *  suggestion) or not allowed (naming what does not fit), never who holds it. Writes only its count; never throws. */
  async handleCheck({ invite = null, handle = null, viewer = null } = {}) {
    try {
      /* Who asks: a live invitation (R15's reading), else an active member's own viewer; else R15's answer. */
      let key = null, self = null;
      const m = invite !== null && invite !== undefined ? await this.#invited(invite) : null;
      if (m) { key = `invite:${await Members.#sha256(invite)}`; self = m.member_id; }
      else {
        const who = viewerMember(viewer);
        const row = who && who !== Members.ROOT_ADMIN
          ? this.#one(`SELECT member_id, status FROM members WHERE member_id=?`, who) : null;
        /* R142 (1) (T47; K3078): a member's own current and earlier handles are taken to them too (handles are fixed for
           good, DEC-197), so the viewer arm excludes no one: `self` stays null. */
        if (row && row.status === "active") key = `member:${row.member_id}`;
      }
      if (!key) return { ...Members.#INVITE_MISS };
      const now = this.#nowMs();
      const est = this.#handleCheckEstimate(key, now);
      /* DEC-49 REGION is-handle-check-window */
      if (est.prev * (1 - est.f) + est.cur >= Members.HANDLE_CHECK_WINDOW.perKey)
        return Members.#rowRefusal("HANDLE_CHECK_PAUSED",
          localize("membership.index.too_many_handles_were_checked", "too many handles were checked for this invitation or member in the last few minutes, so this one was not read. Nothing was changed."),
          Members.#pausedFor(Members.#handleCheckRetry(est)));
      /* END DEC-49 REGION is-handle-check-window */
      this.sql.exec(`INSERT INTO handle_check_window (key, win, count) VALUES (?,?,1)
                     ON CONFLICT(key, win) DO UPDATE SET count=count+1`, key, est.win);
      this.sql.exec(`DELETE FROM handle_check_window WHERE win < ?`, est.win - 1);
      const h = String(handle ?? "").trim();
      const shown = h.slice(0, 80);
      const words = (k, names = []) => ({ key: k, en: keyed(k, names) });   /* R123, R151: placeholders left for the screen */
      if (!Members.HANDLE_PATTERN.test(h))
        return { ok: true, handle: shown, state: "not_allowed", problems: Members.#handleProblems(h), suggestion: null,
                 words: words("handle.characters") };
      if (this.#heldByAnother(h, self))
        return { ok: true, handle: shown, state: "taken", problems: [], suggestion: this.#suggestion(h, self),
                 words: words("handle.taken", ["handle", "group", "suggestion"]) };
      return { ok: true, handle: shown, state: "free", problems: [], suggestion: null, words: words("handle.free", ["handle", "group"]) };
    } catch { return { ...Members.#INVITE_MISS }; }
  }

  /* R125 (DEC-186 (1); K2376 (4); R116's form): the one guard a change of handle would ask whether a member's work is in
     a published case. One later module (`publication`, its R76) registers once at start; the slot takes one
     registration whoever makes it, so its refusals are R81's, naming the holder. T46 (DEC-197): while no handle is
     changed (R129), no act of this module calls it; the slot stands so that reopening a change is one requirement. */
  #handleGuard = null;   // {module, fn}

  registerHandleGuard(module, fn) {
    const refused = listenerRefusal(this.#handleGuard, module, fn);
    if (refused) return refused;
    this.#handleGuard = { module, fn };
    return { ok: true, module };
  }

  /** R129 (T46; DEC-197, DEC-196; N934, K2903; `op=handlechange`): a handle is chosen when a member joins and is never
   *  changed, by the member or anyone. The op stays declared and routed, and every call is refused HANDLE_FIXED before
   *  anything is read: whoever asks and whatever `handle` names, one answer, and nothing is written (no handle, no
   *  handle-history row). Its arguments are taken and not read, so reopening a change is one requirement. */
  handleChange() {
    return Members.#handleFixed(localize("member-roster.index.a_handle_is_chosen_when_a", "a handle is chosen when a member joins and is never changed, by the member or anyone (DEC-197). Nothing was written."));
  }

  /* R129, R144: HANDLE_FIXED is minted here alone; `handleChange` and a second `founderHandleSet` answer through it. */
  static #handleFixed(detail) {
    /* DEC-49 REGION is-handle-fixed */
    return Members.#rowRefusal("HANDLE_FIXED", detail);
    /* END DEC-49 REGION is-handle-fixed */
  }

  /* ===== T49 (T49-1; N1072; Bob's K3265) — THE FOUNDER'S OWN HANDLE (R144) =====
   *
   * The founder has no members row, so the handle she signs in and is known by is held in a table of its own, one row at
   * most. It is chosen once and never changed (a second set is HANDLE_FIXED, R129's row). Her member id stays `admin` in
   * every viewer, stamp and participation row (R43, R44, R64, R86, R94); the id is a reserved name, the handle of no one
   * (R141). */


  /** R144: the founder's held handle, or null while none is held. Writes nothing; never throws. */
  founderHandle() {
    try { return this.#one(`SELECT handle FROM founder_handle WHERE id=1`)?.handle ?? null; } catch { return null; }
  }

  /** R144 (`op=founderhandleset`; called in-plane by `credentials`' claim inside its act): records the handle the founder
   *  signs in and is known by. Refusals in order, each writing nothing: a `by` that is not the founder (`admin` or
   *  `member:admin`) is FOUNDER_HANDLE_NOT_FOUNDER (a machine credential included); a handle already held is
   *  HANDLE_FIXED; then R16's NO_HANDLE, BAD_HANDLE and HANDLE_TAKEN. Answers `{ok: true, handle}`. */
  founderHandleSet(args = {}) {
    const { handle = null, by = null } = isObj(args) ? args : {};
    /* DEC-49 REGION is-founder-handle-founder */
    if (by !== Members.ROOT_ADMIN && by !== `member:${Members.ROOT_ADMIN}`)
      return Members.#rowRefusal("FOUNDER_HANDLE_NOT_FOUNDER",
        localize("membership.index.the_founders_handle_is_chosen", "the founder's handle is chosen by the founder, under the founder's own session, and the caller is not the founder. Nothing was written."), { by: Members.#echo(by ?? null) });
    /* END DEC-49 REGION is-founder-handle-founder */
    if (this.founderHandle() !== null)
      return Members.#handleFixed(localize("membership.index.the_founders_handle_is_chosen_2", "the founder's handle is chosen once and never changed (DEC-197), and one is held. Nothing was written."));
    const h = String(handle ?? "").trim();
    const refused = this.#handleRefusal(h, null);
    if (refused) return refused;
    /* a write that fails throws into the caller's transaction (the claim's act), which then writes nothing */
    this.sql.exec(`INSERT INTO founder_handle (id, handle, at) VALUES (1,?,?)`, h, this.#instant());
    return { ok: true, handle: h };
  }

  memberSet({ memberId, status, by = null } = {}) {
    /* REC-159: the roster first, before any lookup; `by` is the plane's stamp. */
    const barSet = this.#custodialBar(by, localize("member-roster.index.setting_a_members_status", "setting a member's status"));
    if (barSet) return barSet;
    if (!["active", "revoked"].includes(status)) return { ok: false, reason: "BAD_STATUS" };
    const m = this.#one(`SELECT status, role FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    /* 4.4: administrator status cannot be taken away by another administrator.
       Revoking an administrator IS taking it away, so it goes through the
       section 4.7 vote or it does not happen. This is what stops an instance
       being captured by whoever acts first in a dispute. */
    const refusal = (code, detail, extra) => Members.#custodialRefusal(code, detail, extra);   /* D-134 / C-96 */
    /* DEC-49 REGION is-admin-requires-vote */
    if (m.role === "admin" && status === "revoked")
      return refusal("ADMIN_REQUIRES_VOTE",
        localize("member-roster.index.an_administrator_is_removed_by", "an administrator is removed by a majority of all administrators, counting the target in the denominator but not letting them vote (section 4.7). No administrator may strip another unilaterally."));
    /* END DEC-49 REGION is-admin-requires-vote */
    /* 4.9: reactivating a former administrator must NOT restore their
       administrator status.
     *
     * A 4.7 removal sets status='revoked' and leaves role='admin' on the row,
     * because the vote ejects them from the office and does not erase the
     * person. Before this rule, any administrator could call memberset(active)
     * and put an ejected administrator straight back with the office intact,
     * undoing a group decision with one call. That defeats 4.7's
     * consensus-on-addition, which exists precisely so administrators cannot be
     * manufactured unilaterally.
     *
     * So they come back as an ordinary MEMBER. Reactivating the person is a
     * single administrator's call; restoring the office goes through the 4.7
     * addition process like any other appointment. */
    const demoted = status === "active" && m.role === "admin" && m.status !== "active";
    const now = this.#instant();
    const actor = by || null;   /* REC-159: `status_by`, NULL (read `not recorded`) when nothing was stamped */
    /* R152: the instant is moved only by a write that changes the status */
    const at = m.status !== status ? now : null;
    if (demoted)
      this.sql.exec(`UPDATE members SET status=?, role='member', status_by=?, status_at=COALESCE(?, status_at), updated=? WHERE member_id=?`,
        status, actor, at, now, memberId);
    else
      this.sql.exec(`UPDATE members SET status=?, status_by=?, status_at=COALESCE(?, status_at), updated=? WHERE member_id=?`,
        status, actor, at, now, memberId);
    /* Revocation is immediate: R79's listeners are told in this act, and `credentials`' (its R16) ends the
       member's live sessions and revokes their keys, naming this act's actor (REC-159). */
    if (status === "revoked" && m.status !== "revoked") this.#announceRevoked(memberId, actor, now);   /* N123, R20 */
    return { ok: true, memberId, status, by: Members.#statusBy(actor), ...(demoted ? { demoted: true,
      detail: localize("membership.index.reactivated_as_an_ordinary_member", "reactivated as an ordinary member. Administrator status is not restored by reactivation: the team voted them out under 4.7, and putting them back is an appointment, which needs the consensus of all existing administrators like any other.") } : {}) };
  }

  /* ===== T34 (T34-10; DEC-132 to DEC-136, Bob's; K1745) — INVITATIONS THAT EXPIRE, THE GROUP'S TWO DOORS, ADDRESSING
   * A CHECK, AND THE GROUP'S OWN SETTINGS =====
   *
   * Every new refusal is a row of this module's (C-96.22–.38) answered through `#rowRefusal`, its code a literal at
   * the one region its row's `where` names; the administrator's refusal is R84's. A secret this module hands out (an
   * invitation, a website key, a join link) is returned once and held only as its hash (R111). No service here sends a
   * message (R105): an invitation reaches its person only through the answer to its caller. */

  static INVITE_DAYS_DEFAULT = 7;

  static INVITE_DAYS_MAX = 30;

  /* A refusal carrying its row from MEMBERSHIP_CHECKS: `reason` and `code` the same literal, `#custodialRefusal`'s
     shape. The caller's fields sit beside the row's and never replace them. */
  static #rowRefusal(code, detail, extra) {
    const row = MEMBERSHIP_CHECKS[code];
    return { ...(extra || {}), ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
  }

  /* R97: the days an invitation lasts: 7 when not given, else a whole number from 1 to 30; anything else BAD_EXPIRY.
     Answers the number, or the refusal. One judgment for R12, R99, R100, R102 and R103. */
  static #expiryRefusal(v) {
    if (v === undefined || v === null) return Members.INVITE_DAYS_DEFAULT;
    if (Number.isInteger(v) && v >= 1 && v <= Members.INVITE_DAYS_MAX) return v;
    /* DEC-49 REGION is-invitation-expiry */
    return Members.#rowRefusal("BAD_EXPIRY",
      localize("membership.index.an_invitation_lasts_a_whole", "an invitation lasts a whole number of days from 1 to {INVITE_DAYS_MAX} (seven when none is chosen), and the number given is not one. Nothing was written.", { INVITE_DAYS_MAX: String(Members.INVITE_DAYS_MAX) }), { expiresInDays: Members.#echo(v) });
    /* END DEC-49 REGION is-invitation-expiry */
  }

  /* R99: the daily number of invitations a door may make, a whole number of at least 1, which the administrator sets;
     `required` when nothing stands for it yet (a creation or an enabling). Answers the number, or the refusal. */
  static #dailyCapRefusal(v, required) {
    if (!required && (v === undefined || v === null)) return null;
    if (Number.isInteger(v) && v >= 1) return v;
    /* DEC-49 REGION is-door-daily-cap */
    return Members.#rowRefusal("BAD_DAILY_CAP",
      localize("membership.index.a_door_makes_at_most", "a door makes at most a daily number of invitations the administrator sets: a whole number, at least 1, with no default. Nothing was written."), { dailyCap: Members.#echo(v) });
    /* END DEC-49 REGION is-door-daily-cap */
  }

  /* R99 "BAD_CAPABILITY as R9": the door's capabilities, `["contribute"]` when not given; a non-array or a word outside
     the vocabulary (`administer` among them) is R9's refusal, naming the words and the vocabulary. Answers the list
     (each word once, in the order given), or the refusal. */
  static #doorCapabilities(v, required) {
    if (v === undefined || v === null) return required ? ["contribute"] : null;
    if (!Array.isArray(v)) return { ok: false, reason: "BAD_CAPABILITY", detail: localize("member-roster.index.capabilities_is_an_array", "capabilities is an array") };
    const bad = v.filter((c) => !Members.CAPABILITIES.includes(c));
    if (bad.length) return { ok: false, reason: "BAD_CAPABILITY", got: bad.map(Members.#echo), known: Members.CAPABILITIES };
    return [...new Set(v)];
  }

  /* A caller's value echoed back in a refusal: never more than it can carry safely. */
  static #echo(v) {
    try { return typeof v === "string" ? v.slice(0, 40) : typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v).slice(0, 40); }
    catch { return null; }
  }

  static #expiresAt(nowIso, days) { return new Date(Date.parse(nowIso) + days * 86_400_000).toISOString(); }

  static #expired(expires, nowMs) { return typeof expires === "string" && Date.parse(expires) <= nowMs; }   /* R82 */

  /* R105: an invitation's state on an administrator's roster. A proposed administrator has none yet. */
  static #invitationState(r, expires, withdrawn, nowMs) {   /* R82: judged at `nowMs` */
    if (r.status === "proposed") return null;
    if (withdrawn) return "withdrawn";
    if (r.status === "invited") return r.invite_pending ? (Members.#expired(expires, nowMs) ? "expired" : "live") : "expired";
    if (r.status === "revoked" && !r.handle) return "withdrawn";   /* revoked (R20) before it was used */
    return "spent";
  }

  /* ---- R98 (DEC-133 (3)): withdrawing an unused invitation ---- */

  inviteWithdraw({ memberId, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.withdrawing_an_invitation", "withdrawing an invitation"));   /* R84 */
    const m = this.#one(`SELECT status, invite_hash FROM members WHERE member_id=?`, memberId);
    if (!m) return noSuchMember(memberId);   /* R121 (N793): C-96.47 minted at its one site */
    /* DEC-49 REGION is-invitation-unused */
    if (m.status !== "invited" || !m.invite_hash)
      return Members.#rowRefusal("NO_UNUSED_INVITATION",
        localize("membership.index.only_an_invitation_that_has", "only an invitation that has not been used, live or expired, is withdrawn, and this member holds none: they have joined, theirs was withdrawn, or none was made yet. Nothing was written."), { memberId, status: m.status });
    /* END DEC-49 REGION is-invitation-unused */
    const now = this.#instant();
    /* Dead at once (the hash goes, so R15 answers NO_SUCH_INVITATION), and the member is revoked, told as R20 tells. */
    this.sql.exec(`UPDATE members SET status='revoked', invite_hash=NULL, invite_withdrawn=?, status_by=?, status_at=?, updated=?
                    WHERE member_id=?`, now, by, now, now, memberId);
    this.#announceRevoked(memberId, by, now);
    return { ok: true, memberId, status: "revoked", invitation: "withdrawn", by, at: now };
  }

  /* ---- R99-R105 (DEC-133): the group's two doors ---- */

  static DOOR_WARNING = word("membership.door_warning");

  static #DOOR = {
    website: { door: "website", start: "create", stop: "revoke", actor: "website" },
    link: { door: "join link", start: "enable", stop: "off", actor: "join-link" },
  };

  /* A door's latest row, and whether it is live (its latest row neither a revocation nor a switching off). */
  #doorNow(kind) {
    const d = Members.#DOOR[kind];
    const r = this.#one(`SELECT door_id, event, secret_hash, capabilities, daily_cap, expires_days FROM join_doors
                          WHERE door=? ORDER BY seq DESC LIMIT 1`, d.door);
    if (!r || r.event === d.stop) return null;
    return { id: r.door_id, hash: r.secret_hash, capabilities: this.#capsOf(r), dailyCap: r.daily_cap,
             expiresInDays: r.expires_days };
  }

  #doorAppend(kind, id, event, hash, s, by, at) {
    this.sql.exec(`INSERT INTO join_doors (door, door_id, event, secret_hash, capabilities, daily_cap, expires_days, set_by, at)
                   VALUES (?,?,?,?,?,?,?,?,?)`, Members.#DOOR[kind].door, id, event, hash,
      JSON.stringify(s.capabilities), s.dailyCap, s.expiresInDays, by, at);
  }

  /* A door's settings, each judged as R99 judges it: `required` at a creation or an enabling (capabilities default,
     the cap required, the days default), else each left as `held` has it when not given. Answers the settings, or the
     first refusal in R99's order. */
  static #doorSettings({ capabilities, dailyCap, expiresInDays }, held) {
    const required = !held;
    const caps = Members.#doorCapabilities(capabilities, required);
    if (caps && !Array.isArray(caps)) return caps;
    const cap = Members.#dailyCapRefusal(dailyCap, required);
    if (cap && typeof cap !== "number") return cap;
    let days = held ? held.expiresInDays : Members.INVITE_DAYS_DEFAULT;
    if (expiresInDays !== undefined && expiresInDays !== null || required) {
      days = Members.#expiryRefusal(expiresInDays);
      if (typeof days !== "number") return days;
    }
    return { ok: true, capabilities: caps ?? held.capabilities, dailyCap: cap ?? held.dailyCap, expiresInDays: days };
  }

  static #secret() { return Members.#rand(32); }

  static #doorIdOf() { return Members.#rand(8); }

  /* R100's refusal when no key is live, and R103's when no link is: each minted in its one region. */
  #liveWebsiteKey(act) {
    const now = this.#doorNow("website");
    if (now) return now;
    /* DEC-49 REGION is-website-key-live */
    return Members.#rowRefusal("NO_WEBSITE_KEY",
      localize("membership.index.act_acts_on_the_teams", "{act} acts on the team's live website key, and there is none. Nothing was written.", { act: String(act) }));
    /* END DEC-49 REGION is-website-key-live */
  }

  #liveJoinLink(act) {
    const now = this.#doorNow("link");
    if (now) return now;
    /* DEC-49 REGION is-join-link-live */
    return Members.#rowRefusal("JOIN_LINK_OFF",
      localize("membership.index.act_acts_on_the_teams_2", "{act} acts on the team's join link, and it is off. Nothing was written.", { act: String(act) }));
    /* END DEC-49 REGION is-join-link-live */
  }

  /** R99: an administrator creates the website key, at most one live. The key is answered once and never again. */
  websiteKeyCreate({ capabilities, dailyCap, expiresInDays, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.creating_the_teams_website_key", "creating the team's website key"));   /* R84 */
    /* DEC-49 REGION is-website-key-one */
    if (this.#doorNow("website"))
      return Members.#rowRefusal("WEBSITE_KEY_EXISTS",
        localize("membership.index.the_team_holds_one_live", "the team holds one live website key at a time (DEC-133). Nothing was created."));
    /* END DEC-49 REGION is-website-key-one */
    const s = Members.#doorSettings({ capabilities, dailyCap, expiresInDays }, null);
    if (!s.ok) return s;
    const key = Members.#secret(), keyId = Members.#doorIdOf(), at = this.#instant();
    this.#doorAppend("website", keyId, "create", sha256HexSync(key), s, by, at);
    return { ok: true, keyId, key, capabilities: s.capabilities, dailyCap: s.dailyCap, expiresInDays: s.expiresInDays,
             warning: Members.DOOR_WARNING };
  }

  /** R100: the live key's scope, cap or invitation days changed, each as R99 judges it, each kept when not given. */
  websiteKeySet({ capabilities, dailyCap, expiresInDays, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.changing_the_teams_website_key", "changing the team's website key"));   /* R84 */
    const live = this.#liveWebsiteKey(localize("member-roster.index.changing_the_website_key", "changing the website key"));
    if (live.ok === false) return live;
    const s = Members.#doorSettings({ capabilities, dailyCap, expiresInDays }, live);
    if (!s.ok) return s;
    const at = this.#instant();
    this.#doorAppend("website", live.id, "set", live.hash, s, by, at);
    return { ok: true, keyId: live.id, capabilities: s.capabilities, dailyCap: s.dailyCap, expiresInDays: s.expiresInDays,
             by, at };
  }

  /** R100: the live key is dead at once; the invitations it made stay as they are (R98 withdraws them). */
  websiteKeyRevoke({ by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.switching_off_the_teams_website_key", "switching off the team's website key"));   /* R84 */
    const live = this.#liveWebsiteKey(localize("member-roster.index.switching_off_the_website_key", "switching off the website key"));
    if (live.ok === false) return live;
    const at = this.#instant();
    this.#doorAppend("website", live.id, "revoke", null, live, by, at);
    return { ok: true, keyId: live.id, revoked: true, by, at };
  }

  /* The live door whose secret this is, or null: a secret that is not 64 lowercase hex characters names none, and is
     never hashed against the log. */
  #doorFor(kind, secret) {
    if (typeof secret !== "string" || !/^[0-9a-f]{64}$/.test(secret)) return null;
    const live = this.#doorNow(kind);
    return live && live.hash === sha256HexSync(secret) ? live : null;
  }

  /* The cover a door's caller gives: a non-empty string, or null. */
  static #doorCover(cover) { return typeof cover === "string" && cover.trim() ? cover : null; }

  /* How many invitations this door's actor made in the 24 hours before now. */
  #doorToday(actor) {
    const since = this.#instant(this.#nowMs() - 86_400_000);
    return this.#one(`SELECT COUNT(*) AS n FROM members WHERE invited_by=? AND created>?`, actor, since).n;
  }

  /* R101, R104, R105: an ordinary member made through a door: role `member`, `invited` (never proposed), under a fresh
     member id R12's pattern admits and nothing in the request derives, `invited_by` and `status_by` the door's actor,
     the door's capabilities, an invitation that expires after the door's days. Answers `{invite, expires}` once. */
  async #doorMember(kind, live, cover, approvedBy) {
    const d = Members.#DOOR[kind];
    const actor = `${d.actor}:${live.id}`;
    let memberId;
    do memberId = `m-${Members.#rand(10)}`;
    while (this.#one(`SELECT member_id FROM members WHERE member_id=?`, memberId));
    const invite = Members.#rand(16);
    const now = this.#instant();
    const expires = Members.#expiresAt(now, live.expiresInDays);
    this.sql.exec(
      `INSERT INTO members (member_id,cover,handle,role,status,invite_hash,capabilities,created,updated,status_by,invited_by,
                            invite_expires,door,approved_by)
       VALUES (?,?,NULL,'member','invited',?,?,?,?,?,?,?,?,?)`,
      memberId, cover, await Members.#sha256(invite), JSON.stringify(live.capabilities), now, now, actor, actor,
      expires, d.door, approvedBy);
    return { ok: true, invite, expires };
  }

  /** R101: the website's call: one invitation for one cover name, with the approver's name as the website reports it. */
  async websiteInvite({ key, cover, approvedBy = null } = {}) {
    const live = this.#doorFor("website", key);
    /* DEC-49 REGION is-website-key-known */
    if (!live)
      return Members.#rowRefusal("WEBSITE_KEY_UNKNOWN",
        localize("membership.index.this_key_opens_no_door", "this key opens no door of this team: it was never made, was switched off, or is not a key, and the answer is the same for each. Nothing was written."));
    /* END DEC-49 REGION is-website-key-known */
    const label = Members.#doorCover(cover);
    if (!label) return Members.#custodialRefusal("NO_COVER",
      localize("membership.index.the_website_names_the_person", "the website names the person by the cover the team will know them by. Nothing was written."));
    /* DEC-49 REGION is-website-daily-cap */
    if (this.#doorToday(`website:${live.id}`) >= live.dailyCap)
      return Members.#rowRefusal("WEBSITE_DAILY_CAP",
        localize("membership.index.the_website_key_has_made", "the website key has made its daily number of invitations in the last 24 hours. Nothing was written."),
        { dailyCap: live.dailyCap });
    /* END DEC-49 REGION is-website-daily-cap */
    const a = approvedBy === null || approvedBy === undefined ? "" : String(approvedBy).trim().slice(0, 120);
    return this.#doorMember("website", live, label, a || null);
  }

  /** R102: an administrator switches the join link on, at most one live. The link is answered once and never again. */
  joinLinkEnable({ capabilities, dailyCap, expiresInDays, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.switching_on_the_teams_join_link", "switching on the team's join link"));   /* R84 */
    /* DEC-49 REGION is-join-link-one */
    if (this.#doorNow("link"))
      return Members.#rowRefusal("JOIN_LINK_ON",
        localize("membership.index.the_team_holds_one_live_2", "the team holds one live join link at a time (DEC-133 (6)). Nothing was changed."));
    /* END DEC-49 REGION is-join-link-one */
    const s = Members.#doorSettings({ capabilities, dailyCap, expiresInDays }, null);
    if (!s.ok) return s;
    const link = Members.#secret(), linkId = Members.#doorIdOf(), at = this.#instant();
    this.#doorAppend("link", linkId, "enable", sha256HexSync(link), s, by, at);
    return { ok: true, linkId, link, capabilities: s.capabilities, dailyCap: s.dailyCap, expiresInDays: s.expiresInDays,
             warning: Members.DOOR_WARNING };
  }

  /** R103: the live link's settings changed, as R100 changes the key's. */
  joinLinkSet({ capabilities, dailyCap, expiresInDays, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.changing_the_teams_join_link", "changing the team's join link"));   /* R84 */
    const live = this.#liveJoinLink(localize("member-roster.index.changing_the_join_link", "changing the join link"));
    if (live.ok === false) return live;
    const s = Members.#doorSettings({ capabilities, dailyCap, expiresInDays }, live);
    if (!s.ok) return s;
    const at = this.#instant();
    this.#doorAppend("link", live.id, "set", live.hash, s, by, at);
    return { ok: true, linkId: live.id, capabilities: s.capabilities, dailyCap: s.dailyCap, expiresInDays: s.expiresInDays,
             by, at };
  }

  /** R103: a new link, answered once, its settings kept; the old one is dead at once. */
  joinLinkReplace({ by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.replacing_the_teams_join_link", "replacing the team's join link"));   /* R84 */
    const live = this.#liveJoinLink(localize("member-roster.index.replacing_the_join_link", "replacing the join link"));
    if (live.ok === false) return live;
    const link = Members.#secret(), linkId = Members.#doorIdOf(), at = this.#instant();
    this.#doorAppend("link", linkId, "replace", sha256HexSync(link), live, by, at);
    return { ok: true, linkId, link, replaced: live.id, capabilities: live.capabilities, dailyCap: live.dailyCap,
             expiresInDays: live.expiresInDays, by, at };
  }

  /** R103: the live link is dead at once. */
  joinLinkOff({ by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.switching_off_the_teams_join_link", "switching off the team's join link"));   /* R84 */
    const live = this.#liveJoinLink(localize("member-roster.index.switching_off_the_join_link", "switching off the join link"));
    if (live.ok === false) return live;
    const at = this.#instant();
    this.#doorAppend("link", live.id, "off", null, live, by, at);
    return { ok: true, linkId: live.id, off: true, by, at };
  }

  /** R104: the join page's call: one invitation for the cover the person chose; enrolment is R16's. */
  async joinLinkInvite({ link, cover } = {}) {
    const live = this.#doorFor("link", link);
    /* DEC-49 REGION is-join-link-known */
    if (!live)
      return Members.#rowRefusal("NO_SUCH_JOIN_LINK",
        localize("membership.index.this_link_opens_no_door", "this link opens no door of this team: it was never made, was replaced or switched off, or is not a link, and the answer is the same for each. Nothing was written."));
    /* END DEC-49 REGION is-join-link-known */
    const label = Members.#doorCover(cover);
    if (!label) return Members.#custodialRefusal("NO_COVER",
      localize("member-roster.index.choose_the_name_the_team_will", "choose the name the team will know you by: it need not be, and often should not be, a legal name. Nothing was written."));
    /* DEC-49 REGION is-join-link-daily-cap */
    if (this.#doorToday(`join-link:${live.id}`) >= live.dailyCap)
      return Members.#rowRefusal("JOIN_LINK_DAILY_CAP",
        localize("membership.index.the_join_link_has_let", "the join link has let in its daily number of people in the last 24 hours. Nothing was written."),
        { dailyCap: live.dailyCap });
    /* END DEC-49 REGION is-join-link-daily-cap */
    return this.#doorMember("link", live, label, null);
  }

  /* ---- R130 (T46; N654, K1752): the doors' settings and history, for an administrator ---- */

  /* R130's bound: R113's rule, at most 200 records, lowered never raised. */
  static JOIN_DOORS_LIMIT = 200;

  /** R130 (`op=joindoors`): the settings and history of the group's two doors, to an administrator (R64), never their
   *  secrets. Each door answers `{live, current, history, limit, truncated}`: `current` the live door's settings, its
   *  id the one its invitations' actor names (R105), `since` and `by` its latest record's; `history` every record R100
   *  and R103 appended for it, in the order recorded, the first `limit` of them, `truncated` read one row past. No
   *  column holding a secret's hash is selected, and no invitation a door made is read. Writes nothing, never throws. */
  joinDoors(args = {}) {
    const { by = null, limit = null } = isObj(args) ? args : {};
    try {
      if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.reading_the_teams_website_key_and", "reading the team's website key and join link"));   /* R84 */
      const cap = Math.max(1, Math.min(Number(limit) || Members.JOIN_DOORS_LIMIT, Members.JOIN_DOORS_LIMIT));
      const record = (r) => ({ id: r.door_id, event: r.event, capabilities: this.#capsOf(r), dailyCap: r.daily_cap,
                               expiresInDays: r.expires_days, by: r.set_by, at: r.at });
      const door = (kind) => {
        const d = Members.#DOOR[kind];
        const found = this.#rows(`SELECT door_id, event, capabilities, daily_cap, expires_days, set_by, at FROM join_doors
                                   WHERE door=? ORDER BY seq LIMIT ?`, d.door, cap + 1).map(record);
        const last = this.#one(`SELECT door_id, event, capabilities, daily_cap, expires_days, set_by, at FROM join_doors
                                 WHERE door=? ORDER BY seq DESC LIMIT 1`, d.door);
        const live = !!last && last.event !== d.stop;
        const truncated = found.length > cap;
        return { live, current: live ? { id: last.door_id, capabilities: this.#capsOf(last), dailyCap: last.daily_cap,
                                         expiresInDays: last.expires_days, since: last.at, by: last.set_by } : null,
                 history: truncated ? found.slice(0, cap) : found, limit: cap, truncated };
      };
      return { ok: true, websiteKey: door("website"), joinLink: door("link") };
    } catch {
      /* a read that could not be made answers no door, as `courtNotice` answers no choice */
      const none = { live: false, current: null, history: [], limit: Members.JOIN_DOORS_LIMIT, truncated: false };
      return { ok: true, websiteKey: { ...none }, joinLink: { ...none } };
    }
  }

  /* ---- R75 (T51; K624, K3946; was membership R153; N1248, K3861, DEC-332 A72): the removals under way, read ---- */

  /** `adminRemovalsOpen({by})` answers an administrator `{ok: true, removals}`: one entry for each administrator who is the
   *  target of at least one recorded `remove` vote and is not yet revoked, `{target, voters, awaiting, have, need}`.
   *  `voters` are the administrators who have voted on that target (the target never counted), in the order cast,
   *  `{voter, at}`; `awaiting` the administrators who may vote on it and have not, in R29's order; `have` the votes as
   *  R4 counts them; `need` `adminMath(administrators).votesNeeded`. No reason is answered. A caller who is not an
   *  administrator, a machine credential included, is refused NOT_AN_ADMIN (R28). Writes nothing; never throws. */
  adminRemovalsOpen(args = {}) {
    const { by = null } = isObj(args) ? args : {};
    try {
      if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.reading_the_administrator_removals_under_way", "reading the administrator removals under way"));   /* R28 */
      const admins = this.activeAdmins();
      const need = Members.adminMath(admins.length).votesNeeded;
      const targets = this.#rows(
        `SELECT v.target AS target FROM admin_votes v JOIN members m ON m.member_id = v.target
          WHERE v.kind='remove' AND m.role='admin' AND m.status<>'revoked'
          GROUP BY v.target ORDER BY MIN(v.created), v.target`).map((r) => r.target);
      const removals = targets.map((target) => {
        const voters = this.#rows(
          `SELECT voter, created FROM admin_votes WHERE kind='remove' AND target=? ORDER BY created, rowid`, target)
          .filter((v) => admins.includes(v.voter) && v.voter !== target)
          .map((v) => ({ voter: v.voter, at: v.created }));
        const voted = voters.map((v) => v.voter);
        return { target, voters, awaiting: admins.filter((a) => a !== target && !voted.includes(a)),
                 have: voters.length, need };
      });
      return { ok: true, removals };
    } catch { return { ok: true, removals: [] }; }
  }

  /* ---- R72 (T51; K624; split map §3 seam 5): who currently holds an expertise ---- */

  /** Every active member whose latest entry for `label` is declared or confirmed (a withdrawn one is neither, R19), each
   *  `{memberId, handle, state}`, in member-id order; `[]` for a label nobody holds and when a read fails. `label` is
   *  normalised as R17 does; an empty one is refused `EXPERTISE_NO_LABEL`. It reads this module's tables only, asks no
   *  sight, grants none (R20), writes nothing and never throws. (`membership`'s `checkAddressees` asks it and applies its
   *  R80 to each holder.) */
  expertiseHolders(label) {
    try {
      const lab = Members.#normLabel(label);
      if (!lab) return Members.#noLabel("a check request is addressed by a label, such as 'CPA'");
      /* each member's latest entry for the label (R19's log), the member active */
      const holders = this.#rows(
        `SELECT x.member_id, m.handle, x.event FROM member_expertise x JOIN members m ON m.member_id = x.member_id
          WHERE x.label=? AND m.status='active'
            AND x.seq = (SELECT MAX(y.seq) FROM member_expertise y WHERE y.member_id = x.member_id AND y.label = x.label)
          ORDER BY x.member_id`, lab)
        .filter((r) => r.event === "declared" || r.event === "confirmed")
        .map((r) => ({ memberId: r.member_id, handle: r.handle ?? null, state: r.event }));
      /* R76: the founder, once the instance is claimed, holds an expertise as a member does; she has no members row to join */
      const hasRow = !!this.#one(`SELECT 1 AS x FROM members WHERE member_id=?`, Members.ROOT_ADMIN);
      const founder = this.#founderMember(Members.ROOT_ADMIN) && !hasRow
        ? this.#one(`SELECT event FROM member_expertise WHERE member_id=? AND label=? ORDER BY seq DESC LIMIT 1`, Members.ROOT_ADMIN, lab) : null;
      if (founder && (founder.event === "declared" || founder.event === "confirmed")) {
        holders.push({ memberId: Members.ROOT_ADMIN, handle: this.founderHandle(), state: founder.event });
        holders.sort((a, b) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0));
      }
      return holders;
    } catch { return []; }
  }

  /* ---- R77, R78 (T51; K4169; UC-046): the decisions the record owes an administrator, read ---- */

  /* The published bound of both reads: the first 50 rows, `truncated` (not enumerable, so an empty answer is the plain
     `[]`) true exactly when a row past the 50th was found. */
  static OWED_LIMIT = 50;

  static #bounded(found) {
    const rows = found.slice(0, Members.OWED_LIMIT);
    Object.defineProperty(rows, "truncated", { value: found.length > Members.OWED_LIMIT, enumerable: false });
    return rows;
  }

  /** R83: `{have, awaiting}` of a proposed administrator, the active administrators (sorted) who have and have not endorsed. */
  #endorsements(memberId) {
    const admins = this.activeAdmins();
    const have = this.#rows(`SELECT voter FROM admin_votes WHERE kind='add' AND target=?`, memberId)
      .map((v) => v.voter).filter((v) => admins.includes(v)).sort();
    return { have, awaiting: admins.filter((a) => !have.includes(a)).sort() };
  }

  /** R77: each `proposed` member `by` may endorse and has not (an active administrator's list, R23), oldest proposal
   *  first, `[{memberId, handle, proposed_by, proposed_at, have, awaiting}]`; `[]` for any other caller and when a read
   *  fails. Writes nothing; never throws. */
  endorsementsOwed(args = {}) {
    const { by = null } = isObj(args) ? args : {};
    try {
      const admins = this.activeAdmins();
      if (typeof by !== "string" || !by || !admins.includes(by)) return [];
      const found = [];
      for (const r of this.#rows(`SELECT member_id, handle, invited_by, created FROM members WHERE status='proposed'
                                   ORDER BY created, member_id`)) {
        const have = this.#rows(`SELECT voter FROM admin_votes WHERE kind='add' AND target=?`, r.member_id)
          .map((v) => v.voter).filter((v) => admins.includes(v)).sort();
        if (have.includes(by) || r.invited_by === by) continue;
        found.push({ memberId: r.member_id, handle: r.handle ?? null, proposed_by: Members.#statusBy(r.invited_by),
                     proposed_at: r.created, have, awaiting: admins.filter((a) => !have.includes(a)).sort() });
        if (found.length > Members.OWED_LIMIT) break;
      }
      return Members.#bounded(found);
    } catch { return Members.#bounded([]); }
  }

  /** R78: each (active member, label) whose latest entry is `declared`, to an active administrator `by`, oldest
   *  declaration first, `[{memberId, handle, label, declared_at}]`; `[]` for any other caller and when a read fails.
   *  Writes nothing; never throws. */
  expertiseAwaitingConfirmation(args = {}) {
    const { by = null } = isObj(args) ? args : {};
    try {
      if (typeof by !== "string" || !by || !this.activeAdmins().includes(by)) return [];
      const latest = `x.event='declared' AND x.seq = (SELECT MAX(y.seq) FROM member_expertise y WHERE y.member_id = x.member_id AND y.label = x.label)`;
      const found = this.#rows(
        `SELECT x.member_id, m.handle, x.label, x.created, x.seq FROM member_expertise x JOIN members m ON m.member_id = x.member_id
          WHERE m.status='active' AND ${latest} ORDER BY x.created, x.member_id, x.label LIMIT ?`, Members.OWED_LIMIT + 1);
      /* R76: the founder, once the instance is claimed, has no members row to join */
      if (this.#founderMember(Members.ROOT_ADMIN) && !this.#one(`SELECT 1 AS x FROM members WHERE member_id=?`, Members.ROOT_ADMIN))
        found.push(...this.#rows(
          `SELECT x.member_id, NULL AS handle, x.label, x.created, x.seq FROM member_expertise x
            WHERE x.member_id=? AND ${latest} ORDER BY x.created, x.label LIMIT ?`, Members.ROOT_ADMIN, Members.OWED_LIMIT + 1)
          .map((r) => ({ ...r, handle: this.founderHandle() })));
      const key = (r) => [r.created, r.member_id, r.label];
      found.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
      return Members.#bounded(found.map((r) => ({ memberId: r.member_id, handle: r.handle ?? null, label: r.label, declared_at: r.created })));
    } catch { return Members.#bounded([]); }
  }


  /* ---- R107, R108 (DEC-136 (1)): whether members are told what a court can reach ---- */

  static COURT_STATEMENT = word("court.statement");

  /** R107: an administrator's choice, `tell` or `dont`, the same act at setup and in the settings; appended. */
  courtNoticeSet({ choice, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.choosing_whether_members_are_told", "choosing whether members are told what a court can reach"));   /* R84 */
    /* DEC-49 REGION is-court-notice-choice */
    if (choice !== "tell" && choice !== "dont")
      return Members.#rowRefusal("COURT_NOTICE_UNKNOWN_CHOICE",
        localize("membership.index.the_choice_is_tell_or", "the choice is `tell` or `dont`, and nothing else. Nothing was written."), { choice: Members.#echo(choice ?? null) });
    /* END DEC-49 REGION is-court-notice-choice */
    const at = this.#instant();
    this.sql.exec(`INSERT INTO court_notice (choice, set_by, at) VALUES (?,?,?)`, choice, by, at);
    return { ok: true, choice, by, at };
  }

  /** R107: the setting and its history; `choice` null until an administrator has chosen, and null reads as not telling. */
  courtNotice() {
    try {
      const history = this.#rows(`SELECT choice, set_by AS by, at FROM court_notice ORDER BY seq`);
      return { choice: history.length ? history[history.length - 1].choice : null, history };
    } catch { return { choice: null, history: [] }; }
  }

  /* ---- R143 (T48; N1036; DEC-218, K3146, K3189): when a member last looked at Home ---- */

  /* R143, R148: the member whose Home mark `by` names, or null. Only an active member (`ann` or `member:ann`) or the founder
     (`admin`, once the instance is claimed, R94) has a mark; an absent `by`, a machine credential, an operator token and a
     member not active have none. */
  #markHolder(by) {
    const raw = typeof by === "string" ? by.trim() : "";
    if (!raw || MACHINE_STAMP_PREFIXES.some((p) => raw.toLowerCase().startsWith(p))) return null;
    const id = raw.startsWith("member:") ? raw.slice(7) : raw;
    if (!id) return null;
    if (id === Members.ROOT_ADMIN) return this.#claimed() ? id : null;
    return this.#one(`SELECT status FROM members WHERE member_id=?`, id)?.status === "active" ? id : null;
  }

  /** R143: `{since}`, the instant `by`'s previous look was recorded (null when none was), recording this call's instant as
   *  the new mark in the same act. A `by` without a mark records nothing and answers `{since: null}` (#markHolder).
   *  Answers only the caller's own mark; never throws. */
  lookedSince(args = {}) {
    try {
      const id = this.#markHolder(isObj(args) ? args.by : null);
      if (id === null) return { since: null };
      const prev = this.#one(`SELECT at FROM home_looks WHERE member_id=?`, id);
      const now = this.#instant();
      this.sql.exec(`INSERT INTO home_looks (member_id, at) VALUES (?,?) ON CONFLICT(member_id) DO UPDATE SET at=excluded.at`,
        id, now);
      return { since: prev ? prev.at : null };
    } catch { return { since: null }; }
  }

  /** R148 (`op=lookedat`, a read; N1092, DEC-238): `{since}`, the instant of `by`'s last recorded look at Home, the one
   *  R143's next `lookedSince` would answer, or null when none was recorded. It records nothing and moves no mark. Who has
   *  a mark is R143's rule (#markHolder); any other `by` is answered `{since: null}`. Never throws. */
  lookedAt(args = {}) {
    try {
      const id = this.#markHolder(isObj(args) ? args.by : null);
      if (id === null) return { since: null };
      const prev = this.#one(`SELECT at FROM home_looks WHERE member_id=?`, id);
      return { since: prev ? prev.at : null };
    } catch { return { since: null }; }
  }

  /* ---- R109, R110 (DEC-132): the group's optional self-description ---- */

  static GROUP_KINDS = Object.freeze(["professional", "issue", "community", "catch-all", "other"]);

  /* A text field: trimmed, empty reads as null. */
  static #text(v) {
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t ? t : null;
  }

  /** R109: an administrator records the description; each call appends a whole record and overwrites none. */
  groupDescriptionSet({ kinds, otherKind = null, focus = null, purpose = null, visibility = null, by = null } = {}) {
    if (!this.isAdministrator(by)) return notAnAdmin(by, localize("member-roster.index.describing_the_team", "describing the team"));   /* R84 */
    const refuse = (code, detail, extra) => Members.#rowRefusal(code, localize("membership.index.detail_nothing_was_written", "{detail} Nothing was written.", { detail: String(detail) }), extra);
    /* DEC-49 REGION is-group-description */
    if (!Array.isArray(kinds) || kinds.some((k) => !Members.GROUP_KINDS.includes(k)))
      return refuse("GROUP_KIND_UNKNOWN", localize("membership.index.the_kinds_are_a_list", "the kinds are a list drawn from {GROUP_KINDS}, and may be empty.", { GROUP_KINDS: String(Members.GROUP_KINDS.join(", ")) }));
    const ks = [...new Set(kinds)];
    const other = ks.includes("other") ? Members.#text(otherKind) : null;
    if (ks.includes("other") && !other)
      return refuse("GROUP_KIND_OTHER_EMPTY", localize("membership.index.other_was_chosen_and_the", "`other` was chosen, and the kind it describes was left empty."));
    const f = Members.#text(focus), p = Members.#text(purpose);
    for (const [name, v, max] of [["otherKind", other, 120], ["focus", f, 1000], ["purpose", p, 4000]])
      if (v !== null && v.length > max)
        return refuse("GROUP_DESCRIPTION_TOO_LONG", localize("membership.index.name_is_at_most_max", "{name} is at most {max} characters.", { name: String(name), max: String(max) }), { field: name, max });
    const vis = visibility === undefined || visibility === null ? "members" : visibility;
    if (vis !== "members" && vis !== "public")
      return refuse("GROUP_VISIBILITY_UNKNOWN", localize("membership.index.the_description_is_seen_by", "the description is seen by `members` or by the `public` too."));
    /* END DEC-49 REGION is-group-description */
    const at = this.#instant();
    this.sql.exec(`INSERT INTO group_description (kinds, other_kind, focus, purpose, visibility, set_by, at)
                   VALUES (?,?,?,?,?,?,?)`, JSON.stringify(ks), other, f, p, vis, by, at);
    return { ok: true, kinds: ks, otherKind: other, focus: f, purpose: p, visibility: vis, by, at };
  }

  /* Who reads the description and its history: an active member, the founder once claimed, a machine credential. */
  #insider(viewer) {
    viewer = baseViewer(viewer);
    if (!viewerKnown(viewer)) return false;
    const who = viewerMember(viewer);
    if (who === null) return viewer !== Members.ROOT_ADMIN || this.isAdministrator(Members.ROOT_ADMIN);
    if (who === Members.ROOT_ADMIN) return this.isAdministrator(Members.ROOT_ADMIN);
    const m = this.#one(`SELECT status FROM members WHERE member_id=?`, who);
    return !!m && m.status === "active";
  }

  /** R110: the description and its history to an insider; to anyone else, the public, only the four texts, and only
   *  while the latest visibility is `public`. Writes nothing, never throws. */
  groupDescription({ viewer = null } = {}) {
    try {
      const history = this.#rows(`SELECT kinds, other_kind, focus, purpose, visibility, set_by, at
                                    FROM group_description ORDER BY seq`).map((r) => ({
        kinds: JSON.parse(r.kinds), otherKind: r.other_kind, focus: r.focus, purpose: r.purpose,
        visibility: r.visibility, by: r.set_by, at: r.at }));
      const last = history.length ? history[history.length - 1] : null;
      /* one with no kind, focus or purpose reads as none */
      const description = last && (last.kinds.length || last.focus || last.purpose) ? last : null;
      if (this.#insider(viewer)) return { description, history };
      if (!description || description.visibility !== "public") return { description: null };
      const { kinds, otherKind, focus, purpose } = description;
      return { description: { kinds, otherKind, focus, purpose } };
    } catch { return { description: null }; }
  }

}


/* R1, R2: the vocabulary and the arithmetic, as the class states them, for a caller that reads them without an instance. */
export const CAPABILITIES = Members.CAPABILITIES;
export const adminMath = (n) => Members.adminMath(n);

/* K61: the one Members of a Durable Object's storage, made on first use over its `sql` (R74). */
const OF = new WeakMap();
export function membersOf(ctx) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let m = OF.get(storage);
  if (!m) { m = new Members({ sql: storage.sql }); OF.set(storage, m); }
  return m;
}

/* The ops this module answers, as entries of the plane's op map (`membership` spreads them in, R74). `url` is the request
   URL, whose query carries the control plane's stamps (`by`, `viewer`, `administer`); `body` the parsed body; `env` the
   host's environment. Each stamp is read from the query AFTER the body is spread, so a caller's own copy never wins
   (D-136). `memberlist` is given no `projectsOf` here (R71): `membership`'s own `memberlist` replaces it with its own. */
export function membersOps(m, url, body, env) {
  /* R82: the store's environment is the instance clock's source (`BIO_NOW_MS`), so every op this map answers reads it */
  if (env && typeof env === "object") m.env = env;
  return {
        /* REC-156 — `memberadd`'s `by` COMES FROM THE QUERY TOO: spread the body, THEN set `by`; `memberAdd` writes the
           proposer's `admin_votes` ('add') row from it, and a voter a caller can name is not a voter. A call with no
           stamp gets `null`, which `memberAdd` reads as NO endorsement — never the body's. */
        memberadd: () => m.memberAdd({ ...(body || {}), by: url.searchParams.get("by") }),
        enroll: () => m.enroll(body || {}),
        /* T40 (R50; R53 since T46): the invitation and the handle from the body, never the address; `viewer` the control
           plane's stamp from the query. */
        handlecheck: () => m.handleCheck({ invite: body?.invite ?? null, handle: body?.handle ?? null,
                                           viewer: url.searchParams.get("viewer") }),
        /* R53 (T46; DEC-197): declared and routed, and refusing every call; nothing it is sent is read. */
        handlechange: () => m.handleChange({ handle: body?.handle ?? null, by: url.searchParams.get("by") }),
        /* R59 (T49; N1072): the founder's own handle, from the body; `by` the control plane's stamp from the query, so a
           body's copy never names the founder. */
        founderhandleset: () => m.founderHandleSet({ handle: body?.handle ?? null, by: url.searchParams.get("by") }),
        invitelook: () => m.inviteLook(body || {}),
        /* R14: `administer` and `viewer` are the control plane's stamps. */
        memberlist: () => m.memberList({ administer: url.searchParams.get("administer"),
                                         viewer: url.searchParams.get("viewer") }),
        memberset: () => m.memberSet({ ...(body || {}), by: url.searchParams.get("by") }),
        /* D-136 — `by` COMES FROM THE QUERY, AND THE OVERRIDE IS LAST SO A BODY CANNOT WIN: spread-then-override, so no
           field added to a payload can reintroduce the caller's own answer. A direct call with no stamp gets `null` and
           is refused by name (the fail-closed direction: the store never guesses a voter). */
        membercaps: () => m.memberCaps({ ...(body || {}), by: url.searchParams.get("by") }),
        adminendorse: () => m.adminEndorse({ ...(body || {}), by: url.searchParams.get("by") }),
        adminremove: () => m.adminRemove({ ...(body || {}), by: url.searchParams.get("by") }),
        adminarith: () => m.adminArithmetic(),
        /* R75 (N1248): the removals under way; `by` the stamp. Its op is declared by `op-declarations`, routed by `plane`. */
        adminremovalsopen: () => m.adminRemovalsOpen({ by: url.searchParams.get("by") }),
        expertisedeclare: () => m.expertiseDeclare(body || {}),
        expertiseconfirm: () => m.expertiseConfirm(body || {}),
        /* R79 (DEC-386): the withdrawal of a confirmed expertise, its own act; `by` the stamp from the query, read after the
           body so a body's copy never wins. */
        expertisewithdraw: () => m.expertiseWithdraw({ ...(body || {}), by: url.searchParams.get("by") }),
        expertiselist: () => m.expertiseList({ memberId: url.searchParams.get("memberId") }),
        adminresign: () => m.adminResign({ by: url.searchParams.get("by") }),
        hostingaccessset: () => m.hostingAccessSet({ ...(body || {}), by: url.searchParams.get("by") }),
        hostingaccess: () => m.hostingAccess({ limit: url.searchParams.get("limit") }),   /* N70 */
        memberpairingset: () => m.memberPairingSet({ ...(body || {}), by: url.searchParams.get("by") }),
        /* N85 (K124): the viewer and administer stamps decide what each caller sees; absent, the published alone. */
        memberpairings: () => m.memberPairings({ viewer: url.searchParams.get("viewer"),
          administer: url.searchParams.get("administer"), limit: url.searchParams.get("limit") }),   /* N70 */
        /* T34 (DEC-132 to DEC-136): the stamps (`by`, `viewer`) from the query, read after the body so a body's copy never
           wins; the secrets (a key, a link) and the texts from the body, never the URL. */
        invitewithdraw: () => m.inviteWithdraw({ ...(body || {}), by: url.searchParams.get("by") }),
        websitekeycreate: () => m.websiteKeyCreate({ ...(body || {}), by: url.searchParams.get("by") }),
        websitekeyset: () => m.websiteKeySet({ ...(body || {}), by: url.searchParams.get("by") }),
        websitekeyrevoke: () => m.websiteKeyRevoke({ by: url.searchParams.get("by") }),
        websiteinvite: () => m.websiteInvite({ key: body?.key, cover: body?.cover, approvedBy: body?.approvedBy }),
        joinlinkenable: () => m.joinLinkEnable({ ...(body || {}), by: url.searchParams.get("by") }),
        joinlinkset: () => m.joinLinkSet({ ...(body || {}), by: url.searchParams.get("by") }),
        joinlinkreplace: () => m.joinLinkReplace({ by: url.searchParams.get("by") }),
        joinlinkoff: () => m.joinLinkOff({ by: url.searchParams.get("by") }),
        joinlinkinvite: () => m.joinLinkInvite({ link: body?.link, cover: body?.cover }),
        /* R54 (T46; N654): `by` the control plane's stamp; `limit` the caller's, lowered never raised. */
        joindoors: () => m.joinDoors({ by: url.searchParams.get("by"), limit: url.searchParams.get("limit") }),
        courtnoticeset: () => m.courtNoticeSet({ ...(body || {}), by: url.searchParams.get("by") }),
        courtnotice: () => m.courtNotice(),
        groupdescriptionset: () => m.groupDescriptionSet({ ...(body || {}), by: url.searchParams.get("by") }),
        groupdescription: () => m.groupDescription({ viewer: url.searchParams.get("viewer") }),
        /* R58 (T48; N1036; K3211): the member's own Home mark, read and recorded in one act. `by` is the control plane's
           stamp, and nothing the body says is read, so no caller names whose mark it moves. */
        lookedsince: () => m.lookedSince({ by: url.searchParams.get("by") }),
        /* R63 (T50; N1092): the same mark read without moving it; `by` the stamp, as `lookedsince`'s. */
        lookedat: () => m.lookedAt({ by: url.searchParams.get("by") }),
  };
}

/* R80, R81 (T51; K4168, K4202; op-declarations R80, R81; op-grades R49, R50): the ops this module serves that a screen sends,
   and `expertisewithdraw`, which this tranche adds, each declared beside the ops map. `classes`, `machineClasses`, `mutating`,
   `weight` and `description` are copied from the op's rows in `op-declarations` and `op-grades` (`expertisewithdraw`'s from the
   design, DEC-386: reasoned, its words `act.owed_expertisewithdraw.does`); `fields` is read from the op's arm. Four readings:
   `expertisedeclare`'s `memberId` is stamped into the body by the control plane (the declaring member), so a caller sends the
   label alone; `expertiseconfirm` accepts `withdraw` (R79 keeps it); `handlecheck`'s invitee must send her `invite` (a
   member's own check rides her session's `viewer` stamp, and no screen sends one); `memberadd` refuses an `expertise`
   (R9), so it does not accept one. */
export const DECLARED_OPS = Object.freeze({
  adminendorse: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.adminendorse", "section 4.7 governance — the subject is a proposed administrator, not a bundle"),
    fields: { accepts: ["memberId"], requires: ["memberId"] } },
  adminremove: { classes: ["admin", "member", "probe"], mutating: true, weight: "reasoned", description: localize("member-roster.declared.adminremove", "section 4.7 governance — the subject is an administrator's standing, not a bundle"), refusal: "NO_REASON",
    fields: { accepts: ["memberId", "reason"], requires: ["memberId", "reason"] } },
  courtnoticeset: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "substrate", description: localize("member-roster.declared.courtnoticeset", "the group's setting: whether members are told what a court can reach; an administrator's, not an act on an object"),
    fields: { accepts: ["choice"], requires: ["choice"] } },
  enroll: { classes: null, mutating: true, weight: "credential", description: localize("member-roster.declared.enroll", "an invitee becoming a member"),
    fields: { accepts: ["invite", "handle", "password"], requires: ["invite", "handle", "password"] } },
  expertiseconfirm: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.expertiseconfirm", "administrator act on a declaration, class-gated"),
    fields: { accepts: ["memberId", "label", "withdraw"], requires: ["memberId", "label"] } },
  expertisedeclare: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.expertisedeclare", "a member's own declaration, not a corpus act"),
    fields: { accepts: ["label"], requires: ["label"] } },
  expertisewithdraw: { classes: ["admin", "member", "probe"], mutating: true, weight: "reasoned", description: "act.owed_expertisewithdraw.does", refusal: "NO_REASON", stamps: ["viewer", "by"], needs: null,
    fields: { accepts: ["memberId", "label", "reason"], requires: ["memberId", "label", "reason"] } },
  founderhandleset: { classes: ["admin"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("member-roster.declared.founderhandleset", "member-directed: the founder's own handle, the one she signs in and is known by, chosen once and never changed (`HANDLE_FIXED`); writes no record and moves no bundle"),
    fields: { accepts: ["handle"], requires: ["handle"] } },
  groupdescriptionset: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "substrate", description: localize("member-roster.declared.groupdescriptionset", "the group's description of itself — the subject is the group's identity, not a bundle; an administrator's"),
    fields: { accepts: ["kinds", "otherKind", "focus", "purpose", "visibility"], requires: ["kinds"] } },
  handlecheck: { classes: null, mutating: false, weight: "read", description: localize("member-roster.declared.handlecheck", "read: whether a handle is free, taken or not allowed, never who holds it"),
    fields: { accepts: ["invite", "handle"], requires: ["invite"] } },
  hostingaccessset: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.hostingaccessset", "operator record of who holds hosting access — the subject is the instance's operators, not a bundle"),
    fields: { accepts: ["holders", "note"], requires: ["holders"] } },
  invitelook: { classes: null, mutating: false, weight: "read", description: localize("member-roster.declared.invitelook", "read: what a live invitation offers the invitee (the cover, the role, the capabilities and the declared expertise), never the member's id"),
    fields: { accepts: ["invite"], requires: ["invite"] } },
  invitewithdraw: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.invitewithdraw", "roster governance: an administrator's withdrawal of an invitation; the subject is who may join, not a bundle"),
    fields: { accepts: ["memberId"], requires: ["memberId"] } },
  joinlinkenable: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.joinlinkenable", "roster governance: the join link, an administrator's; the subject is who may join, not a bundle"),
    fields: { accepts: ["capabilities", "dailyCap", "expiresInDays"], requires: ["dailyCap"] } },
  joinlinkinvite: { classes: null, mutating: true, weight: "credential", description: localize("member-roster.declared.joinlinkinvite", "a person holding the join link asks to be invited under a cover name (membership R104)"),
    fields: { accepts: ["link", "cover"], requires: ["link", "cover"] } },
  memberadd: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.memberadd", "roster governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)"),
    fields: { accepts: ["memberId", "cover", "role", "capabilities", "expiresInDays"], requires: ["memberId", "cover"] } },
  membercaps: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.membercaps", "roster governance — the subject is a member's capabilities, not a bundle (4.9)"),
    fields: { accepts: ["memberId", "capabilities"], requires: ["memberId", "capabilities"] } },
  memberpairingset: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.memberpairingset", "a member's published cover-and-handle pairing — the subject is how a member is shown, not a bundle"),
    fields: { accepts: ["memberId", "published"], requires: ["memberId"] } },
  memberset: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.memberset", "roster governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)"),
    fields: { accepts: ["memberId", "status"], requires: ["memberId", "status"] } },
  websitekeycreate: { classes: ["admin", "member", "probe"], machineClasses: ["admin", "probe"], mutating: true, weight: "credential", description: localize("member-roster.declared.websitekeycreate", "roster governance: the website's key, an administrator's; the subject is who may join, not a bundle"),
    fields: { accepts: ["capabilities", "dailyCap", "expiresInDays"], requires: ["dailyCap"] } },
});
