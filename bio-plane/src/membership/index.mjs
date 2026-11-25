/* membership — projects as working groups: their setup, participation, sight and the fence. Who the members are is
 * `member-roster`'s (T51, CR-4): each name whose requirement moved there is a delegate here, so no user re-points (K3268).
 *
 * Requirements: build/requirements/membership.md (R18, R31–R36, R38, R43–R45, R47, R54–R56, R60, R61, R65–R67, R69,
 * R71, R74–R78, R80, R85, R87, R88, R106, R112, R114–R118, R120, R122, R127, R128, R132, R133, R149–R151 and R154).
 * Design: docs/architecture/BIO_Membership_Architecture_v2.md.
 *
 * SHAPE (K61). `membershipOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`, and
 * reaches record-core by `recordOf(ctx)` on the same `ctx` (`bundleInfo`, `declarePurge`, …) and builds its member-roster
 * half on its own clock (R156); a test may pass its own record-core as `membershipOf(ctx, { record })`. This module's SQL joins
 * record-core's `bundles` only on the stated read contract, `bundle_id` and `object_type` (record-core R37), and reads
 * `members` only for `member_id`, `role` and `status` (`member-roster` R67); every other bundle fact (a project's title) is
 * asked of `core.bundleInfo` (R34).
 */
import { MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { MEMBERSHIP_PROJECT_SCHEMA, MEMBERSHIP_ADDITIVE_COLUMNS, MEMBERSHIP_PROJECT_TABLES } from "./schema.mjs";
export { MEMBERSHIP_PROJECT_TABLES } from "./schema.mjs";
import { Members, membersOps, ROOT_ADMIN, CAPABILITIES, adminMath, listenerRefusal, notAnAdmin, noSuchMember,
         MODULE_ORDER, moduleOrderFrom, viewerMember, carriedProject, baseViewer,
         MEMBER_EXEMPT_TABLES, MEMBER_DECLARED_TABLES } from "../member-roster/index.mjs";
import { MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS, PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS,
         CASE_AUTHORITY_CHECKS } from "./checks.mjs";
import { rowKey, SENTENCE_KEYS } from "./words.mjs";
import { MEMBER_ROSTER_ROWS } from "../member-roster/checks.mjs";

/* R154: the refusal-row tables, each the union of this module's rows and `member-roster`'s, every code one row (K231). */
export { MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS, PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS,
         CASE_AUTHORITY_CHECKS } from "./checks.mjs";
/* R154: the moved names, re-exported so a user's import still resolves. */
export { listenerRefusal, notAnAdmin, noSuchMember, MODULE_ORDER, moduleOrderFrom };
export const MEMBERSHIP_EXEMPT_TABLES = MEMBER_EXEMPT_TABLES;
export const MEMBERSHIP_DECLARED_TABLES = MEMBER_DECLARED_TABLES;

/* R151: every key this module reads, each held by `setup-words` (`hasWord`): its own rows' (`refusal.<CODE>`, or the key
   `words.mjs` names) and the sentences it answers beside them. `member-roster` reads its own rows, so its keys are its
   `WORD_KEYS` (DEC-345), not these; the membership table's codes that are member-roster's are left out here. */
const MEMBER_ROSTER_CODES = new Set(Object.keys(MEMBER_ROSTER_ROWS.MEMBERSHIP_CHECKS));
export const WORD_KEYS = Object.freeze([...new Set([
  ...[MEMBERSHIP_CHECKS, PROJECT_AUTHORITY_CHECKS, PROJECT_VISIBILITY_CHECKS, CASE_AUTHORITY_CHECKS]
      .flatMap((table) => Object.keys(table).filter((code) => !MEMBER_ROSTER_CODES.has(code)).map(rowKey)),
  ...SENTENCE_KEYS])]);
import { recordOf } from "../record-core/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* The marker every generated statement carries (moved from query.mjs with `viewerPredicate`, K57). It is a SQL
   comment, so it changes nothing about what runs; the runtime test asserts each gated statement contains it. */
export const GATE_MARK = "/*viewer-gate*/";

/* R43. THE ONE RULE OF WHAT A VIEWER MAY SEE (Membership Architecture v2 §7.9), moved here from query.mjs (K57).
   A machine credential (the four token classes and an organisation-scoped `ai` credential) sees every bundle; a
   `member:<id>` viewer sees every bundle that is not a project, and a project only as a participant (any state) or as
   an active administrator; any other viewer sees nothing (fail closed).
   The predicate is written over the alias `b`, bound to record-core's `bundles` (its R37 read contract). `member`
   is the viewer's member id, null for every arm that is not an identified session (D-310).
   N357 (K494, W1): the founder's viewer is spelled bare `admin` or `member:admin` (the founder's positional
   spelling, `resolveSession`'s identity); both see what the founder's arm admits, and only the second names a member,
   `admin`. The founder has no roster row; its participation rows, when it owns or joined a project, are `admin`'s.
   N426 (K704, K710): THE PROJECT FENCE. A bundle that belongs to a project (record-core R34's `project`, which promotion
   writes from the document) is seen exactly when its project is: so an escalation's, a plan's or any project record's
   bundle read record-wide is fenced by the same arms that fence the project itself. The project a row is judged
   by is its own id for a project, and its `project` column for anything else (an empty one names none).
   D54 (Bob's "D54: B", K2408; hidden projects only, K2409; T41-3): an administrator, the founder included, sees a HIDDEN
   project, and every bundle belonging to it, only as a participant (invited or joined); a DISCOVERABLE project stays
   seen whole by administrators. The setting is read from `project_sight` (R85's index, the owners' latest act), so a
   project the index does not hold, and a bundle naming a project that is not one, reads hidden: seen by its
   participants and machine credentials alone (fail closed). At a hidden project's EXISTENCE an administrator learns
   its id, name and owners and nothing else (R44, R77). */
/* A machine credential's viewer: the four token classes and an organisation-scoped `ai` credential (R43). */
const MACHINE_VIEWER = new RegExp(`^${MACHINE_CLASS_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(admin|member|probe|daemon|ai)$`);
const OWN_PROJECT = `(CASE WHEN b.object_type = 'project' THEN b.bundle_id ELSE b.project END)`;
export function viewerPredicate(viewer, reach = null) {
  const v = typeof viewer === "string" ? viewer : "";
  /* R149: a viewer that carries a project (`projectViewer`) is the member's own viewer narrowed to the project's reach. */
  const carried = carriedProject(v);
  if (carried !== null) return projectGate(v, carried, reach);
  /* R154: the spelling is `member-roster` R73's (`viewerMember`): the id in `member:<id>`, null for the founder's bare
     `admin` and for a machine credential, which this gate tells from a spelling it refuses. */
  const memberId = viewerMember(v);
  const founder = v === ROOT_ADMIN || memberId === ROOT_ADMIN;
  if (!memberId && !founder && !MACHINE_VIEWER.test(v))
    return { sql: `${GATE_MARK} 0=1`, args: [], viewer: null, scope: "DENY", member: null };
  if (!memberId && !founder)
    return { sql: `${GATE_MARK} 1=1`, args: [], viewer: v, scope: "member", member: null };
  /* The two arms every session shares: a bundle outside every project, and a project the viewer participates in. */
  const outside = `(b.object_type <> 'project' AND COALESCE(b.project, '') = '')`;
  const participant = `EXISTS (SELECT 1 FROM project_participants pp WHERE pp.project_id = ${OWN_PROJECT} AND pp.member_id = ?)`;
  const discoverable = `EXISTS (SELECT 1 FROM project_sight ps WHERE ps.project_id = ${OWN_PROJECT}
                                  AND ps.setting = 'discoverable')`;
  /* The administrator's arm (D54): a discoverable project only; the founder's viewer holds it always, an enrolled
     member while they are an active administrator. */
  const administers = founder ? discoverable
    : `(EXISTS (SELECT 1 FROM members am WHERE am.member_id = ? AND am.role = 'admin' AND am.status = 'active')
            AND ${discoverable})`;
  const who = founder ? ROOT_ADMIN : memberId;
  return {
    member: memberId,
    sql: localize("membership.index.gate_mark_outside_or_participant", "{GATE_MARK} ({outside} OR {participant} OR {administers})", { GATE_MARK: String(GATE_MARK), outside: String(outside), participant: String(participant), administers: String(administers) }),
    args: founder ? [who] : [who, who],
    viewer: v, scope: "participant",
  };
}

/* R149 (T50; N1186, K3557). A VIEWER THAT CARRIES A PROJECT. `projectViewer(viewer, project)` spells it `<viewer>@<project>`
   for a viewer that names a member (`member:<id>`, or the founder's bare `admin`): a member id is `a-z0-9-` (R12) and
   `viewerPredicate`'s pattern admits no `@` in one, so the first `@` splits the two and the old reading of `member:<id>`
   is intact. A machine credential, a viewer R43 admits to nothing, an absent or empty project and a viewer that already
   carries one are answered unchanged: a viewer with no project is exactly as R43 states, and a carried project is never
   re-scoped. Writes nothing and never throws. */
export function projectViewer(viewer, project) {
  if (typeof viewer !== "string" || typeof project !== "string" || !project) return viewer;
  if (carriedProject(viewer) !== null || (viewerMember(viewer) === null && viewer !== ROOT_ADMIN)) return viewer;
  return `${viewer}@${project}`;
}

/* R149, R150: the gate of a viewer carrying `project`: R43's gate for the member's own viewer, and the bundle in the
   project's reach: the project's own bundle, every bundle that belongs to it (`record-core` R34's `project`), and the
   `reach` ids the registered readers add (the instance's `viewerGate` reads them, R150). The ids travel as one JSON array,
   one bound parameter however many, so the statement stays under the host's bound-parameter limit. A bundle outside the
   reach is not admitted though the member sees it, and one the member's own gate refuses is not admitted though it is in
   the reach: the reach narrows, never widens. */
function projectGate(v, project, reach) {
  const base = viewerPredicate(baseViewer(v));
  if (base.scope === "DENY" || base.scope === "member") return base;
  const ids = Array.isArray(reach) ? reach.filter((id) => typeof id === "string" && id) : [];
  return {
    member: base.member,
    sql: `${GATE_MARK} (${base.sql.replace(GATE_MARK, "")}) AND (b.bundle_id = ? OR b.project = ?
            OR b.bundle_id IN (SELECT value FROM json_each(?)))`,
    args: [...base.args, project, project, JSON.stringify(ids)],
    viewer: v, scope: "participant", project,
  };
}

/* R88 (N352, K477). THE COMPLEMENT OF R43's RULE, spelled once: the bundles a viewer may NOT see, as a set to subtract
   (D-464, D-486). `null` when R43 lets the viewer see every bundle (its machine arm, scope `member`; since D54 no longer
   the founder's viewer, which is withheld the hidden projects it is not in), so there is nothing to subtract;
   otherwise `{sql, args}`, a parenthesised subquery over record-core's `bundles` (its R37 read contract) naming every
   bundle R43's compiled gate does not pass: every bundle, for a viewer R43 refuses; for the founder's viewer and an
   active administrator's, the hidden projects R43 withholds from them and the bundles belonging to them. It is
   the gate negated as a set, never a second rule, so a count taken through it and a read taken through
   `viewerPredicate` cannot disagree about who is hidden. A caller subtracts with `<key> NOT IN ${sql}` and binds `args`.
   What an absent viewer means stays the caller's: asked, it is R43's refusal and hides everything; an internal
   caller reads whole by not asking. Writes nothing and never throws. */
export function hiddenBundles(viewer, reach = null) {
  const gate = viewerPredicate(viewer, reach);
  if (gate.scope === "member") return null;
  return { sql: `(SELECT bundle_id FROM bundles EXCEPT SELECT b.bundle_id FROM bundles b WHERE (${gate.sql}))`,
           args: [...gate.args] };
}

/* R78 (N208, N146, K238, K275). THE ONE ANSWER TO ONE CONDITION: no project answers to `projectId`, or the caller's
   sight of it is not FULL (after R77's existence answer), answered as absent (R61, Membership Architecture v2 §7.9).
   Every act of any module answering that condition answers through here, so `NO_SUCH_PROJECT` is minted at one site
   and its one row is this module's (C-70.5). The detail is one fixed sentence, the same for every caller, so an absent
   id and a hidden one can never be told apart by it. `extra` adds a caller's own fields (such as `finding`) beside
   these and never replaces one of them. Writes nothing and never throws. */
const NO_SUCH_PROJECT_DETAIL = "no project answers to that id here. A project you cannot see is answered exactly as one "
  + "that does not exist (Membership Architecture v2 §7.9), so this is not a hint either way.";
const NO_SUCH_PROJECT_FIXED = new Set(["ok", "reason", "code", "check", "translation", "project", "detail"]);
export function noSuchProject(projectId, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NO_SUCH_PROJECT_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-project-seen */
  const row = MEMBERSHIP_CHECKS.NO_SUCH_PROJECT;
  return { ok: false, reason: "NO_SUCH_PROJECT", code: "NO_SUCH_PROJECT", check: row.check,
           translation: row.translation, project: projectId ?? null, ...Object.fromEntries(own),
           detail: NO_SUCH_PROJECT_DETAIL };
  /* END DEC-49 REGION is-project-seen */
}

/* R87 (N335, K275). THE ONE ANSWER TO ONE CONDITION: the caller `by` holds no participation in the project (Membership
   Architecture v2 §7.12). `projectLeave` (R35) here and promotion's fork (its R43) answer through it, so
   `NOT_A_PARTICIPANT` is minted at one site and its one row is this module's (C-56.3). A named TARGET holding none, or
   one not joined, is a different condition with its own code (R36, R39). `project` is the id as asked (null when none);
   the detail is one fixed sentence, the same for every caller. `extra` adds a caller's own fields beside these and never
   replaces one of them. Writes nothing and never throws. */
const NOT_A_PARTICIPANT_DETAIL = "the caller holds no participation in this project, and this act is taken by one of its "
  + "participants (Membership Architecture v2 §7). Nothing was changed.";
const NOT_A_PARTICIPANT_FIXED = new Set(["ok", "reason", "code", "check", "translation", "project", "detail"]);
export function notAParticipant(projectId, by, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NOT_A_PARTICIPANT_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-not-a-participant */
  const row = MEMBERSHIP_CHECKS.NOT_A_PARTICIPANT;
  return { ok: false, reason: "NOT_A_PARTICIPANT", code: "NOT_A_PARTICIPANT", check: row.check,
           translation: row.translation, project: projectId ?? null, ...Object.fromEntries(own),
           detail: NOT_A_PARTICIPANT_DETAIL };
  /* END DEC-49 REGION is-not-a-participant */
}

/* R122 (N812; K231). THE ONE ANSWER TO ONE CONDITION: the caller `by` is not an owner of the project where the act is
   an owner's. `projectAuthority` (R55) here and `credentials` (its R54–R57) answer through it, so
   `PROJECT_ACT_NOT_THE_OWNER` is minted at one site and its one row is this module's (C-56.2). Shaped as R84's
   `notAnAdmin`: `by` as given (null when none), `project` the id as asked (null when none), `detail` one fixed sentence,
   the same for every caller; `extra` adds a caller's own fields (such as `act` and `needs`) and never replaces these, and
   a caller with a next step passes `remedy`, one sentence, kept as `remedy` with `message` the row's translation, a
   space, then the remedy (DEC-83). Who is an owner stays each act's own rule (R54); this only answers the refusal.
   Writes nothing and never throws. */
const NOT_THE_OWNER_DETAIL = "this is an act an owner of the project performs, and the caller is not one of its owners. "
  + "Seeing a project is not directing it: an administrator directs no project, whatever it sees (Membership "
  + "Architecture v2 §4.9, §7). Nothing was changed.";
const NOT_THE_OWNER_FIXED = new Set(["ok", "reason", "code", "check", "translation", "by", "project", "detail", "message"]);
export function notTheOwner(by, projectId, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !NOT_THE_OWNER_FIXED.has(k));
  } catch { own = []; }
  const given = own.find(([k]) => k === "remedy");
  const remedy = given && typeof given[1] === "string" && given[1].trim() ? given[1].trim().slice(0, 400) : null;
  own = own.filter(([k]) => k !== "remedy");
  const echo = (v) => { try { return v === null || v === undefined ? null : String(v).slice(0, 200); } catch { return null; } };
  /* DEC-49 REGION is-not-the-owner */
  const row = PROJECT_AUTHORITY_CHECKS.PROJECT_ACT_NOT_THE_OWNER;
  return { ok: false, reason: "PROJECT_ACT_NOT_THE_OWNER", code: "PROJECT_ACT_NOT_THE_OWNER", check: row.check,
           translation: row.translation, by: echo(by), project: echo(projectId), ...Object.fromEntries(own),
           ...(remedy ? { remedy, message: `${row.translation} ${remedy}` } : {}),
           detail: NOT_THE_OWNER_DETAIL };
  /* END DEC-49 REGION is-not-the-owner */
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

export class Membership {
  constructor({ sql, core = null, members = null, now = null } = {}) {
    this.sql = sql;
    this.core = core;
    this.now = typeof now === "function" ? now : null;   /* R156: the clock handed in, else the store's environment, else the wall clock */
    this.env = null;   /* R156: the store's environment, set by `membershipOps` through `membersOps` (`#nowMs`) */
    /* R154: the members half, `member-roster`'s `Members` over the same storage. R156 (K5202): it reads this instance's clock,
       so member-roster's instants follow the store's environment as membership's own do; a `members` handed in is left as handed. */
    this.members = members ?? new Members({ sql, now: () => this.#nowMs() });
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* R156 (T51 fix round 10; MEMBER-ROSTER #6 J9; K5132's rule, `credentials`' `#nowMs`): the instance clock. A clock handed in
     (`now`, a function of milliseconds) answers first; else the store's environment (`env.BIO_NOW_MS`, set by `membershipOps`
     through `membersOps`); else the wall clock. Every instant this module records, and every judgement of one, reads it. */
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

  /* The instant, as an ISO string, of the instance clock. */
  #nowIso() { return new Date(this.#nowMs()).toISOString(); }

  /* A project's title, asked of record-core (R34): membership's SQL reads no bundle column but the R37 contract. */
  #titleOf(bundleId) {
    const info = this.core && typeof this.core.bundleInfo === "function" ? this.core.bundleInfo(bundleId) : null;
    return info && typeof info.title === "string" ? info.title : null;
  }


  /* This module's tables, at every boot (R114, R115), idempotent: `member-roster`'s tables first (its R74), then the
     project tables (the additive columns an older store lacks added before the indexes that name them, REC-143's lesson);
     the tables declared to record-core's purge when its `declarePurge` is present; and the sight index recomputed whole
     from the owners' acts (D-497: a derivation, so an index that disagreed with `project_visibility` cannot survive a
     restart). Run by the host inside its boot, after record-core's schema. */
  migrate() {
    this.members.migrate();
    const cols = (t) => [...this.sql.exec(`PRAGMA table_info(${t})`)].map((r) => r.name);
    for (const [table, column, decl] of MEMBERSHIP_ADDITIVE_COLUMNS) {
      const have = cols(table);
      if (have.length && !have.includes(column)) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
    const bare = MEMBERSHIP_PROJECT_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    this.declareTables();
    this.#registerReservedIdFinding();
    /* No `bundles` table yet means no project to index (a host whose record-core has not made its schema). */
    if (cols("bundles").length) this.reindexProjectSight();
  }

  /* R115 (was R59), through record-core's `declarePurge` (its R21's default form); R131 (T46) through its `declareTable`. */
  declareTables() {
    if (this.#declared) return false;
    /* record-core R21/R46: the project-keyed tables, keyed to a bundle (the project) by `project_id`, and the
       exempt ones named once, as exempt, in the default form; R131: `join_doors` with its own classes (`export: never`),
       so it is left out of the default form. Each answer is read: a refusal (a table another module declared) is
       thrown, because a purge that silently skipped these tables would leave the participation graph behind, and an
       export that took the doors' hashes would carry what R111 holds back. */
    /* A host whose record-core offers no `declareTable` (a test's stand-in; record-core R21 provides it on every real
       host) declares these tables in the default form, as before R131: it states their purge class, all it can state. */
    const explicit = typeof this.core.declareTable === "function";
    const own = new Set(explicit ? MEMBERSHIP_DECLARED_TABLES.map((t) => t.name) : []);
    const answers = [
      this.core.declarePurge("membership", MEMBERSHIP_PROJECT_TABLES.map((name) => ({ name, keys: ["project_id"] })),
        { exempt: MEMBERSHIP_EXEMPT_TABLES.filter((t) => !own.has(t)) }),
      ...(explicit ? [this.core.declareTable("membership", MEMBERSHIP_DECLARED_TABLES.map((t) => ({ ...t })))] : []),
    ];
    for (const answer of answers)
      if (answer && answer.ok === false)
        throw new Error(`membership: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }
  #declared = false;

  /* ===== R114 (was R96's participation half; K861; plane R10) — THIS MODULE'S SHARE OF THE INSTANCE'S FIGURES =====
   *
   * The figures `op=stats` and purge's proof report of this module's project-keyed tables (REC-27, D-137: the
   * participation graph and the pending owner votes, so a purge can PROVE it took them), shaped as record-core R63's
   * `counts(hid)` with its key list, which `plane` registers under this module's name (`registerCounts("membership",
   * [...Membership.COUNT_KEYS], (hid) => m.counts(hid))`, plane R10), so this module registers nothing itself and no
   * figure is registered twice. `hid` is R63's: R88's `hiddenBundles(viewer)`, the bundles the caller may not see, or
   * null for a caller that sees every bundle and for the direct internal call (purge's proof among them), which count
   * whole. Each table drops the rows whose `project_id` is in `hid` (D-464: a count over
   * rows the caller could not all read is a disclosure of existence). `COALESCE(project_id, '')`: a NULL key names no
   * bundle, and `NULL NOT IN (…)` is NULL, so without it the row would be dropped. Synchronous; writes nothing. */
  static COUNT_KEYS = Object.freeze(["projectParticipants"]);

  counts(hid = null) {
    const n = (table) => (hid
      ? this.#one(`SELECT count(*) c FROM ${table} WHERE COALESCE(project_id, '') NOT IN ${hid.sql}`, ...hid.args)
      : this.#one(`SELECT count(*) c FROM ${table}`)).c;
    return { projectParticipants: n("project_participants") };
  }

  /* REC-132 / D-422 / C-55: the audit's finding for a member holding the reserved id is `member-roster`'s
     (`reservedIdFinding`); the registration with record-core's R68 seam is made here, under the key `membership`, so the
     audit reads as before. Registered once; a host whose record-core does not offer the seam registers nothing. */
  #registerReservedIdFinding() {
    if (this.#findingRegistered || !this.core || typeof this.core.registerAuditFinding !== "function") return;
    this.core.registerAuditFinding("membership", "membership", () => this.members.reservedIdFinding());
    this.#findingRegistered = true;
  }
  #findingRegistered = false;

  /* R69: the member ids of the project's participants who have joined (not leaving, not invited) and are active. */
  activeParticipants(projectId) {
    return this.#rows(`SELECT p.member_id FROM project_participants p JOIN members m ON m.member_id = p.member_id
                        WHERE p.project_id=? AND p.state='joined' AND m.status='active' ORDER BY p.member_id`,
      projectId).map((r) => r.member_id);
  }

  /* R71: what `promotion` calls when a promotion creates a project, inside the caller's transaction: `ownerId`
     (a member; a machine-created project has no owner, §7.1) becomes the sole initial owner as R31 makes one,
     the creation visibility is recorded as the first R45 record, and the project's sight is reindexed. */
  projectCreated({ projectId, ownerId = null, visibility = null, by = null } = {}) {
    if (visibility !== null && visibility !== undefined) {
      const bad = this.visibilitySettingRefusal(visibility, projectId);
      if (bad) return bad;
    }
    const at = this.#nowIso();
    let owner = null;
    if (ownerId) {
      const claimed = this.projectClaimOwner({ projectId, memberId: ownerId });
      if (!claimed.ok) return claimed;
      owner = ownerId;
    }
    if (visibility !== null && visibility !== undefined)
      this.sql.exec(`INSERT INTO project_visibility (project_id, setting, set_by, reason, at) VALUES (?,?,?,?,?)`,
        projectId, String(visibility), by ?? ownerId ?? "not recorded", "chosen at creation", at);
    this.reindexProjectSight(projectId);
    return { ok: true, projectId, owner, setting: this.visibilityOf(projectId) };
  }

  /* R18 (section 7.8; D54, T41-3): the projects a member participates in, for an administrator's roster, as the
     administrator reading it (`viewer`) sees them: each project that administrator sees at FULL (R44), and, of a
     hidden project it does not, only the member's ownership, which that administrator's EXISTENCE already shows
     (`{project, state: null, owner: true, existence: true}`); a hidden project's other participants are never listed
     to an administrator neither invited nor joined to it. With no viewer stamped, the roster is read as an
     administrator in no project would read it (fail closed): discoverable projects whole, hidden ones by owner only. */
  #projectsOf(memberId, viewer) {
    const full = (p) => (viewer === null || viewer === undefined
      ? this.visibilityOf(p) === "discoverable" : this.inSight(p, viewer));
    const out = [];
    for (const p of this.#rows(`SELECT project_id, state, owner FROM project_participants WHERE member_id=?
                                 ORDER BY project_id`, memberId)) {
      if (full(p.project_id)) out.push({ project: p.project_id, state: p.state, owner: !!p.owner });
      else if (p.owner && this.visibilityOf(p.project_id) === "hidden")
        out.push({ project: p.project_id, state: null, owner: true, existence: true });
    }
    return out;
  }

  /** R76 (REC-132 / D-422) — WHO IS ASKING, as distinct from WHAT THEY MAY SEE: the member id R43 reads for `identity`
   *  when it is a non-empty string, else for `viewer`, through `member-roster` R73's spelling; null for a machine
   *  credential and for a viewer or identity R43 admits to nothing. Writes nothing; never throws. */
  positionalMember(viewer, identity = null) {
    return viewerMember(viewer, identity);
  }

  /* ===== R118 (N783) — THE ONE WRITE OF A PARTICIPATION ROW A LATER MODULE MAKES =====
   *
   * `project-roster`'s acts (its R3–R5, R12) have made every check of their own; this writes their row in the caller's
   * transaction and asks nothing (R120: no later module writes `project_participants` but through here). `invite` adds
   * the member `invited`, not an owner; `ownerOn` sets an existing participant's owner flag, next in R65's order;
   * `ownerOff` clears it, the member staying a participant; `rescue` makes the member a `joined` owner, next in R65's
   * order, adding the row when they hold none and changing no other row. True when it wrote; false, writing nothing, for
   * an unknown kind, an `invite` whose row exists, and an `ownerOn`/`ownerOff` whose row does not. Never throws. */
  participationWrite(kind, args = {}) {
    try {
      const { projectId, memberId, by = null, comment = null, at = null } = args && typeof args === "object" ? args : {};
      if (typeof projectId !== "string" || !projectId || typeof memberId !== "string" || !memberId) return false;
      const when = typeof at === "string" && at ? at : this.#nowIso();
      const held = !!this.#one(`SELECT 1 AS x FROM project_participants WHERE project_id=? AND member_id=?`,
        projectId, memberId);
      const nextOrder = `(SELECT COALESCE(MAX(owner_order), 0) + 1 FROM project_participants WHERE project_id=?)`;
      if (kind === "invite") {
        if (held) return false;
        this.sql.exec(`INSERT INTO project_participants (project_id,member_id,state,owner,invited_by,created,updated)
                       VALUES (?,?,'invited',0,?,?,?)`, projectId, memberId, by, when, when);
        return true;
      }
      if (kind === "ownerOn") {
        if (!held) return false;
        this.sql.exec(`UPDATE project_participants SET owner=1, owner_order=${nextOrder}, updated=?
                        WHERE project_id=? AND member_id=?`, projectId, when, projectId, memberId);
        return true;
      }
      if (kind === "ownerOff") {
        if (!held) return false;
        this.sql.exec(`UPDATE project_participants SET owner=0, owner_order=NULL, updated=?
                        WHERE project_id=? AND member_id=?`, when, projectId, memberId);
        return true;
      }
      if (kind === "rescue") {
        const c = comment === null || comment === undefined ? null : String(comment);
        this.sql.exec(
          `INSERT INTO project_participants (project_id,member_id,state,owner,owner_order,invited_by,comment,created,updated,
                                            joined_at)
           VALUES (?,?,'joined',1,${nextOrder},?,?,?,?,?)
           ON CONFLICT(project_id,member_id) DO UPDATE SET owner=1, owner_order=excluded.owner_order,
             joined_at=CASE WHEN project_participants.state='joined' THEN project_participants.joined_at
                            ELSE excluded.joined_at END,
             state='joined', updated=excluded.updated`,
          projectId, memberId, projectId, by, c, when, when, when);   /* R127: a rescue joins */
        return true;
      }
      return false;
    } catch { return false; }
  }

  /* ===== R150 (T50; N1186, K3557; R79's, R128's form) — THE REACH BEYOND A PROJECT'S OWN RECORDS =====
   *
   * A viewer that carries a project (R149) reaches the project's own bundle and the bundles belonging to it, which this
   * module's layer reads. What it cannot read, the captures a project's records hold (`provenance`) and the records they
   * cite (`connections`), later modules register a reader for, once each, `fn({project})` answering a list of bundle ids.
   * The registered readers are asked in `MODULE_ORDER` and their ids joined; a reader that throws, answers a promise or
   * anything but a list of bundle ids adds nothing (the reach narrows, never widens), and an id is admitted only if R43
   * admits the member's own viewer to it (the gate ANDs, `projectGate`). With none registered the reach is the project's
   * own. The union is bounded (`PROJECT_REACH_LIMIT`), the first ids in that order kept. This module never reads another
   * module's tables to decide it. Registration's refusals are R81's. */
  #reachReaders = [];   // {module, fn, seq}

  static PROJECT_REACH_LIMIT = 5000;

  registerProjectReach(module, fn) {
    const refused = listenerRefusal(this.#reachReaders, module, fn);
    if (refused) return refused;
    this.#reachReaders.push({ module, fn, seq: this.#reachReaders.length });
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.#reachReaders.sort((a, b) => (rank(a.module) - rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }

  /** R150: the bundle ids the registered readers add to `project`'s reach, each once, in the readers' order. Writes
   *  nothing; never throws. */
  projectReach(project) {
    const ids = new Set();
    if (typeof project !== "string" || !project) return [];
    for (const r of this.#reachReaders) {
      let got;
      try {
        got = r.fn({ project });
        if (got && typeof got.then === "function") { got.then(null, () => {}); continue; }
      } catch { continue; }
      if (!Array.isArray(got) || !got.every((id) => typeof id === "string" && id !== "")) continue;
      for (const id of got) if (ids.size < Membership.PROJECT_REACH_LIMIT) ids.add(id);
    }
    return [...ids];
  }

  /** R43, R149: the gate for `viewer` as this instance answers it: `viewerPredicate`, with the reach the registered
   *  readers add (R150) when the viewer carries a project. `inSight` and `sight` ask it. Never throws. */
  viewerGate(viewer) {
    const carried = carriedProject(viewer);
    return viewerPredicate(viewer, carried === null ? null : this.projectReach(carried));
  }

  /** R88, R149: `hiddenBundles` with the reach this instance's readers add, for a viewer that carries a project. */
  hiddenBundlesFor(viewer) {
    const carried = carriedProject(viewer);
    return hiddenBundles(viewer, carried === null ? null : this.projectReach(carried));
  }

  /* ===== R116, R117 (N783, K624; R79's form) — THE TWO NOTICES `project-roster` HEARS =====
   *
   * Requests to join are `project-roster`'s (its R10–R14), but two setup acts that stay here change them: an invitation
   * (R32) closes the invitee's open request `granted` (R33), and setting a project hidden (R45) lapses its open requests.
   * Each slot takes one registration, whoever makes it (R81's refusals, naming the holder); it is called once, inside the
   * act and after its writes, in the caller's transaction. A whole number of at least 1 is the count the listener
   * closed; anything else, a throw, or no listener reads as none, and the act and its answer stand either way. */
  #invitedListener = null;   // {module, fn}
  #hiddenListener = null;    // {module, fn}

  onProjectInvited(module, fn) {
    const refused = listenerRefusal(this.#invitedListener, module, fn);
    if (refused) return refused;
    this.#invitedListener = { module, fn };
    return { ok: true, module };
  }

  onProjectHidden(module, fn) {
    const refused = listenerRefusal(this.#hiddenListener, module, fn);
    if (refused) return refused;
    this.#hiddenListener = { module, fn };
    return { ok: true, module };
  }

  static #tell(listener, notice) {
    if (!listener) return 0;
    try {
      const r = listener.fn(notice);
      return Number.isInteger(r) && r >= 1 ? r : 0;
    } catch { return 0; }
  }

  /* ===== R128 (T45; Actions D4; v0.2 rule 15; R125's form) — THE ONE GUARD ON A PROJECT'S SETUP ACTS =====
   *
   * A project's scope (`project-roster` R21–R22: a counsel matter, a member's own project) limits who may be invited to it
   * and whether it may be set discoverable; that rule is `project-roster`'s, so membership never reads its tables. One
   * later module registers, once at start, the guard R32 and R45 call synchronously inside their act, after their own
   * refusals and before any write: `fn({act, projectId, by, setting?})`, `act` `invite` or `visibility`. A refusal it
   * answers is answered unchanged and nothing is written; null lets the act proceed; a throw, a promise or anything else
   * refuses PROJECT_GUARD_UNCHECKED (fail closed). With none registered the acts proceed as before. The slot
   * takes one registration whoever makes it, so its refusals are R81's, naming the holder. */
  #projectActGuard = null;   // {module, fn}

  registerProjectActGuard(module, fn) {
    const refused = listenerRefusal(this.#projectActGuard, module, fn);
    if (refused) return refused;
    this.#projectActGuard = { module, fn };
    return { ok: true, module };
  }

  /* R128: null to proceed, the guard's own refusal, or PROJECT_GUARD_UNCHECKED. */
  #projectActGuarded(act, projectId, by, setting) {
    const guard = this.#projectActGuard;
    if (!guard) return null;
    let r;
    try {
      r = guard.fn({ act, projectId, by: by ?? null, ...(act === "visibility" ? { setting } : {}) });
      if (r === null) return null;
      if (r && typeof r.then === "function") r.then(null, () => {});
      else if (isObj(r) && r.ok === false && typeof r.reason === "string" && r.reason) return r;
    } catch { /* fail closed below */ }
    /* DEC-49 REGION is-project-guard-checked */
    return Membership.#rowRefusal("PROJECT_GUARD_UNCHECKED",
      localize("membership.index.whether_this_projects_own_rules", "whether this project's own rules allow the act could not be read, so it was not made: a project act is not made on a guess. Nothing was written."), { project: Membership.#echo(projectId ?? null), act });
    /* END DEC-49 REGION is-project-guard-checked */
  }
/* Membership Architecture v2 section 7: authority over a project belongs to its
   OWNERS, and to nobody else. An administrator sees every discoverable project, and
   a hidden one only as a participant (7.3, 7.8, 7.9 as D54 amended them), and
   directs none of them (v2 4.9), the single exception being 7.13, the rescue of a
   project whose owners are all inactive (`project-roster`'s `projectOwnerRescue`, its R5).

   This REVERSES v1.4 7.7, which gave removal to administrators and denied it to
   owners, in those words, reasoning from Design Requirement 1 that authority
   over people belongs to the custodial role. v2 reasons instead that
   participation in a project is a working relationship rather than a membership
   one, and the people who can judge it are the people doing the work. Authority
   over MEMBERSHIP itself is untouched and stays custodial.

   In one helper so the two call sites cannot drift apart, which is how the
   admin bypass came to sit on invite and remove with different shapes. */

  isProjectOwner(projectId, memberId) {
    const p = this.participation(projectId, memberId);
    return !!(p && p.owner);
  }

  /** REC-134: does this member hold the WORKING position in this project — a JOINED
   *  participant (§7.5: *"An invited member who has not joined has view rights only. A
   *  joined member has the working rights their capabilities allow"*). `leaving` counts:
   *  §7.6 says a request to leave *"does not remove them"*, and BOB #14's lead ruling
   *  already reads joined-or-leaving as the two states of full participation
   *  (`#leadReach`). An owner is a joined participant with the owner flag (§7.10), so
   *  every owner passes. `invited` does not. */
  isJoinedParticipant(projectId, memberId) {
    const p = this.participation(projectId, memberId);
    return !!(p && (p.state === "joined" || p.state === "leaving"));
  }

  /* ===== REC-134 / C-56 — SIGHT IS NOT AUTHORITY, AT EVERY ACT ON A PROJECT ================
   *
   * Membership Architecture v2 §7, *"SIGHT IS NOT AUTHORITY — and this is Bob's doctrine,
   * not a new ruling"* (BOB #15, 2026-09-18), quoting §4.9: *"the custodial role can audit
   * everything and direct nothing"*. The defect it closes, found by REC-132 and measured by
   * REC-134 through the ops: several acts that change a project took the VISIBILITY gate as
   * their only barrier (or had none at all), and every administrator — enrolled, and since
   * IC-149 the founder — passes that gate for every project. So an administrator who was
   * never invited could revise a project's document, move its citation edges, move what it
   * stands on, record a judgement in its feed, and adopt a bias set into its scope.
   *
   * THE QUESTION IS ASKED OF WHO THE ACTOR IS, NEVER OF WHAT IT MAY SEE. `identity` is the
   * POSITIONAL half of the control plane's one session resolver (`resolveSession`, IC-149):
   * `member:<id>` for a signed-in session (the founder's is `member:admin`), a member-scoped
   * `ai` credential's principal, and `class:<cls>` for every instance credential. It is read
   * through `positionalMember`, the one place a viewer-shaped string becomes a member, so a
   * `class:*` credential answers null and is NOT ASKED — machine credentials hold no roster
   * position, and their fences are their own and unchanged (DEC-63's reasoning at the run
   * verbs, and the brief's). An ABSENT identity is also not asked: that is every internal
   * caller (`cite` promoting its own edit, `forkProject`, the version pointer's own write),
   * and the control plane stamps it on every enumerated act, deleted first so a caller can
   * never name one.
   *
   * WHAT IT DOES NOT TOUCH, and each is deliberate: §7.13's add-an-owner (`project-roster`'s `projectOwnerRescue`)
   * is the ONE administrator path and keeps its condition, its vote and its record — it never
   * calls this. The roster acts, publication, the review copy, the run verbs and the lead share
   * already asked a position and still ask their own. Sight is unchanged: nothing here is a
   * visibility predicate and no read calls it.
   *
   * Returns null to proceed, or the refusal. C-56.1's CODE is written HERE and only here, as a
   * literal inside the region DEC-49's guard reads; C-56.2's is `notTheOwner`'s (R122, T40), answered
   * through it with this act's `act` and `needs`; the call sites RELAY both (`projectGate`'s
   * precedent at the run verbs). */
  projectAuthority(projectId, identity, need, act) {
    const who = this.positionalMember(null, identity);
    if (who === null) return null;
    const refusal = (code, detail) => {
      const row = PROJECT_AUTHORITY_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId, act, needs: need };
    };
    /* R55, R122 (T40; K2394 Z8): the owner refusal is `notTheOwner`'s, its code minted there alone. */
    if (need === "owner" && !this.isProjectOwner(projectId, who))
      return notTheOwner(who, projectId, { act, needs: need });
    /* DEC-49 REGION is-project-authority */
    if (need === "joined" && !this.isJoinedParticipant(projectId, who))
      return refusal("PROJECT_ACT_NOT_A_PARTICIPANT",
        localize("membership.index.act_on_string_is_work", "{act} on {String} is work inside that project, and {who} has not joined it (§7.5: an invited member has view rights only; an uninvited one, none). Seeing a project is not directing it: an administrator directs no project, whatever it sees (§4.9, §7). Nothing was written.", { act: String(act), String: String(String(projectId).slice(0, 80)), who: String(who) }));
    /* END DEC-49 REGION is-project-authority */
    return null;
  }

  /* ===== REC-137 / REC-140 — WHO AUTHORISES A PUBLICATION IN A PROJECT'S NAME, AND WHO MAY CARRY IT IN ==
   *
   * Membership Architecture v2 §7, *"A CASE RATIFICATION: who AUTHORISES it and who may DELIVER it"*
   * (BOB #15). REC-137 built the two questions inside `ratifyCaseDocument`; REC-140 (D-429, Publication
   * rule 2 as BOB #15 applied it) MOVED them here because `op=ratify` asks them too, of a finding a
   * ratified case pins — one rule with two doors, never a second copy of it. Asked in this order:
   *
   * (1) DELIVERY IS CARRIAGE, NOT DIRECTION (AI Roles §3 rule 4: the record states signer and
   *     deliverer apart). A member with a role in the project may deliver, and so may the FOUNDER, as
   *     DEC-33's interim publishing route; an enrolled administrator with no role in the project may
   *     NOT — administrators direct nothing (§4.9). The member half is REC-134's ONE positional check,
   *     consumed and never restated: `deliveredBy` is the control plane's reading of the SESSION ROW
   *     (`deliveringPrincipal`, REC-128), `member:<id>` for a member's session and `founder` for the
   *     founder's. The founder is told apart HERE by that principal and never by the folded name: a
   *     member ENROLLED as `admin` delivers as `member:admin`, is asked, and is not the founder. An
   *     ABSENT deliverer is every internal caller (a store-level committer, the legacy arms), not
   *     asked, as at every REC-134 act. A project-less subject is (2)'s to refuse, by name.
   * (2) THE AUTHORITY IS THE SIGNATURE, AND IT MUST BE AN OWNER'S (DEC-72 clause 5: publishing is the
   *     project owner's act). Asked through `isProjectOwner`, §7's one owner predicate. A subject
   *     naming no project has no owner to sign it and is refused by the same rule — DEC-72 removed the
   *     project-less case, so it is a legacy document, and an absent publisher is not a publisher of
   *     none.
   *
   * Returns null to proceed, or the refusal. `extra` carries the caller's own identifying fields,
   * placed where `ratifyCaseDocument`'s refusal always carried them, so its answer is unchanged. */
  caseAuthority({ project, deliveredBy = null, signer = null, act, subject, extra = {} }) {
    if (project && deliveredBy !== "founder") {
      const denied = this.projectAuthority(project, deliveredBy, "joined", act);
      if (denied) return denied;
    }
    const refusal = (code, detail) => {
      const row = CASE_AUTHORITY_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               ...extra, project, signer: signer ?? null };
    };
    /* DEC-49 REGION is-case-signer-owner */
    if (!project || !this.isProjectOwner(project, signer))
      return refusal("CASE_SIGNER_NOT_AN_OWNER",
        localize("membership.index.subject_is_v1_production_and", "{subject} is {v1} production, and publishing is an act of an OWNER of the publishing project (DEC-72 clause 5). The signature is {v2}'s, who is not an owner of it. Being a registered signer in your team's Civicsmith is not authority over a project. Nothing was committed.", { subject: String(subject), v1: String(project ? `${String(project).slice(0, 80)}'s` : "a project-less"), v2: String(signer ?? "an unnamed signer") }));
    /* END DEC-49 REGION is-case-signer-owner */
    return null;
  }

  /* ===== REC-138 / D-426 — A PROJECT YOU CANNOT SEE IS A PROJECT THAT DOES NOT EXIST, AT EVERY ACT ==
   *
   * Membership Architecture v2 §7.9: an UNINVITED member sees nothing of a project — *"Not its
   * existence, not its name, not its references, not its participants."* The reads have honoured
   * that since REC-25 (`viewerPredicate`, D-15's one compilation point). The ACTS did not: `cite`,
   * `sever`, `reinstate`, `promote`'s revision arm, four roster acts, `forkProject` and the run
   * gate's project arm resolved their project with a bare lookup, so they answered a nonexistent id
   * one way and an existing one another — an existence oracle for project ids. REC-134 closed the
   * EDIT (C-56) and its own refusal became the signal; before it, the edit itself was.
   *
   * TWO PIECES, AND EACH IS THE ONLY ONE OF ITS KIND.
   *   `inSight(id, viewer)` asks `viewerPredicate` — never a second rule — whether this viewer may
   *   see this bundle. Only PROJECT rows are ever filtered, so for anything else it answers true to
   *   every recognised viewer; an absent or unrecognised viewer sees NOTHING (fail closed, the gate's
   *   own posture), which is why every act that calls it has its viewer stamped by the control plane.
   *   `noSuchProject(project)` (R78, a module-level function, every module's) is THE answer a project-targeted
   *   act gives when there is no project it may name — returned by the absent branch and the hidden branch alike, and in every
   *   caller by ONE condition (`!p || !this.inSight(...)`), so the two cannot drift: there is no
   *   second string to keep in step. IC-141's `#noCaseDocument` is the precedent, one object over.
   *
   * THE ORDER IS THE RULE: SIGHT BEFORE POSITION. Every caller asks `inSight` BEFORE
   * `projectAuthority` or its own owner test, so C-56 and NOT_THE_OWNER are only ever said to a
   * caller who can already see the project (an invited member, or an administrator, §7.3) — and
   * say nothing a caller did not already know. Asked the other way round, the positional refusal is
   * the oracle (R61; `test/m/membership/sight.test.mjs`'s R61 test holds that an outsider never learns ownership). */
  /* N142: a named service (the layer-6 modules gate with it and `viewerPredicate`), so it is total: an id that is not
     a non-empty string names no bundle, and nothing it is handed makes it throw. */
  inSight(bundleId, viewer) {
    if (typeof bundleId !== "string" || !bundleId) return false;
    const g = this.viewerGate(viewer);
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${g.sql})`, bundleId, ...g.args);
  }

  /* ===== REC-149 — SIGHT HAS THREE LEVELS, AND IT IS STILL ONE PREDICATE (Membership v2 §7, item 7.14) =====
   *
   * Bob, 2026-09-18: *"The project's contents might be private, though the existence of the project may not
   * be"*, and *"each project chooses"*. So a project is DISCOVERABLE or HIDDEN, and `sight` answers:
   *   SIGHT_NONE      — nothing: an absent id, or a project the caller cannot see at all. §7.9 exactly.
   *   SIGHT_EXISTENCE — the project's id and name and the request to join, and nothing else: a DISCOVERABLE
   *                     project, asked by a member SESSION (a viewer naming a member) outside its participants.
   *   SIGHT_FULL      — what `viewerPredicate` admits (invited, joined, an administrator or the founder at a
   *                     discoverable project, every machine credential): its SQL is asked first and alone decides FULL.
   * EXISTENCE is asked only where FULL was refused, only of a PROJECT, and only of a viewer the gate reads as
   * a member — so a machine credential (already FULL) is unchanged, an absent or unrecognised viewer stays NONE
   * (fail closed), and a HIDDEN project stays NONE for everybody who could not already see it but an administrator
   * (D54, T41-3: its second form, below). `viewerPredicate` IS NOT CHANGED: every record read, search, citation list,
   * reverse edge and run report still compiles only FULL sight, because those reads return CONTENTS.
   * `inSight` IS the FULL level, asked first and unchanged, so every existing caller keeps its meaning; the
   * acts ask `existenceAct` just BEFORE their REC-138 line, so NONE still reaches that line and its answer. */
  static SIGHT_NONE = "none";

  static SIGHT_EXISTENCE = "existence";

  static SIGHT_FULL = "full";

  /* D54 (K2408, K2409; T41-3): EXISTENCE has a second form. An administrator (the founder's viewer, either spelling, or
     an active administrator's) whom R43 does not admit to a HIDDEN project, being neither invited nor joined, sees that
     it exists: its id, its name and its owners' handles (R77), so a legal hold or a complaint can name it; never its
     contents. A discoverable project's EXISTENCE is unchanged, and administrators are FULL there already. */
  sight(bundleId, viewer) {
    if (this.inSight(bundleId, viewer)) return Membership.SIGHT_FULL;
    /* R149: a viewer carrying a project sees at most that project's existence, the member's own sight of it, and every
       other project as nothing, so no other project's existence is shown to it. */
    const carried = carriedProject(viewer);
    if (carried !== null && bundleId !== carried) return Membership.SIGHT_NONE;
    viewer = baseViewer(viewer);
    if (typeof bundleId !== "string" || (!this.#administratorView(viewer) && !viewerPredicate(viewer).member))
      return Membership.SIGHT_NONE;
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, bundleId);
    if (!b || b.object_type !== "project") return Membership.SIGHT_NONE;
    if (this.visibilityOf(bundleId) === "discoverable") return Membership.SIGHT_EXISTENCE;
    return this.#administratorView(viewer) ? Membership.SIGHT_EXISTENCE : Membership.SIGHT_NONE;
  }

  /* R43's administrator arms, as a viewer names them: the founder's viewer (bare `admin` or `member:admin`), or a
     `member:<id>` viewer naming an active administrator. A machine credential is neither: it sees every bundle. */
  #administratorView(viewer) {
    viewer = baseViewer(viewer);
    const g = viewerPredicate(viewer);
    if (g.scope === "DENY" || g.scope === "member") return false;
    if (viewer === ROOT_ADMIN || g.member === ROOT_ADMIN) return true;
    const m = this.#one(`SELECT role, status FROM members WHERE member_id=?`, g.member);
    return !!m && m.role === "admin" && m.status === "active";
  }

  /* R85 (N332, K412): a named service (`store-door` R2's existence read calls it), asking no viewer: it states only
     the setting, and its callers gate what they show by R44. Total: an id the index does not hold, or one that is not
     a string, reads `hidden`, and nothing it is handed makes it throw.
     The CURRENT setting, READ FROM THE SIGHT INDEX (D-497) rather than recomputed from the act log here.
     `project_sight` holds one row per project carrying exactly what `reindexProjectSight` derived, so this
     predicate and the directory's SQL read THE SAME ROWS instead of two copies of one rule — which is the
     whole of D-497 and the reason the directory can bound its candidates in SQL at all.
     THE `hidden` BELOW IS NOT THE DEFAULT FOR AN OWNER WHO HAS NOT ACTED. That default is in the derivation's
     own CASE, one method down, and every project carries a row for it: the index is recomputed at every boot,
     at every promotion, and at every owner's act. This branch is reached only by an id the index does not hold
     — a bundle that is not a project, or one purged between the two reads — and it fails closed. */
  visibilityOf(projectId) {
    const r = this.#one(`SELECT setting FROM project_sight WHERE project_id=?`,
      typeof projectId === "string" ? projectId : null);   /* R85: an id that is not a string names no row */
    return r && r.setting === "discoverable" ? "discoverable" : "hidden";
  }

  /* ===== D-497 — THE DERIVATION, AND IT IS THE ONLY PLACE THE RULE IS STATED (Membership v2 §7, item 7.14).
   *
   * WHAT THIS EXISTS FOR. `sight` was a JS predicate with no row source, so `projectDirectory` established
   * "this caller sees none of them" by asking it about every project in the group one at a time: each statement
   * bounded, the NUMBER of statements growing with the record. D-479 bounded what the directory PUBLISHES and
   * reported this half as a row of its own, in these words — *"bounding that needs a row source the sight
   * predicate itself READS, not a second copy of its rule"*. This is that row source.
   *
   * THE RULE, STATED ONCE: a project's setting is its OWNERS' LATEST ACT, and HIDDEN where they have never
   * acted — every project that existed before REC-149 (each created under §7.9's promise that the uninvited see
   * not its existence), every creation that carried no setting, and everything a machine created. It is the
   * CASE below and nowhere else. `visibilityOf` reads the answer; the directory joins the same table; nobody
   * restates the default. REC-149's first build DID restate it — its directory took candidates from the
   * visibility table — and its own `default-discoverable` control arm caught that by flipping the default and
   * watching the directory not move.
   *
   * DERIVED, NEVER AUTHORED. `project_visibility` stays the record: append-only, one row per owner's act. This
   * table is a projection of it that a statement can join, recomputed WHOLE at every boot (the `#seedMintLedger`
   * precedent) and per project wherever a project or an act changes — so a row that disagreed with the log,
   * for any reason including a landing that moved the rule, does not survive a restart.
   *
   * THE ROW IS project_id AND setting AND NOTHING ELSE, AND THAT IS THE FIX TO A DEFECT THIS LANDING'S OWN
   * FIRST DRAFT HAD. It carried a third column, `at`, a fresh timestamp written on every recompute — so an
   * UNCHANGED boot rewrote every row with different bytes, and A RESTART PLUS A PURE READ THEN MOVED A TABLE.
   * `versionnotice.test.mjs`'s no-write WITNESS caught it by name on the first full battery (`WITNESS QUIET`
   * and `NOTHING WRITTEN (the whole store)`, both naming `project_sight`): a live verification's no-write guarantee
   * rests on the record's tables reading the same before and after, so a derivation that writes on every boot
   * costs that guarantee.
   * Two narrower fixes were tried at the STATEMENT and BOTH ARE REFUSED BY WORKERD with
   * `Error: incomplete input: SQLITE_ERROR` — a `WHERE` on the conflict action, and the same guard moved into
   * a LEFT JOIN against the index — while `node:sqlite` prepares each of them without complaint, which is the
   * receipt for driving the plane's own engine rather than a local one. So the column went instead: a
   * projection needs no date of its own, the act log carries every date there is, and an unchanged recompute
   * now writes rows BYTE-IDENTICAL to the ones it found, and it costs nothing (`test/m/membership/t19-enrol-boot.test.mjs`
   * holds a second boot's index idempotent at the byte, R45 and R85).
   *
   * COST, STATED. Two statements. Given a projectId both address ONE row through a primary key and an indexed
   * lookup; given none, both run once over the projects in `bundles` — inside SQLite, nothing per row in JS,
   * at boot only, reached by no op. The work is inside SQL, so it is stated here rather than left for a reader of
   * this file's JS loops to miss. */
  reindexProjectSight(projectId = null) {
    /* A bundle that is no longer a project (or never was) holds no sight row. Written as a correlated NOT
       EXISTS rather than `NOT IN (SELECT …)` so the per-project form stays one indexed lookup. */
    this.sql.exec(
      `DELETE FROM project_sight
        WHERE (? IS NULL OR project_id = ?)
          AND NOT EXISTS (SELECT 1 FROM bundles b
                           WHERE b.bundle_id = project_sight.project_id AND b.object_type = 'project')`,
      projectId, projectId);
    this.sql.exec(
      `INSERT INTO project_sight (project_id, setting)
       SELECT b.bundle_id,
              CASE WHEN (SELECT pv.setting FROM project_visibility pv
                          WHERE pv.project_id = b.bundle_id
                          ORDER BY pv.seq DESC LIMIT 1) = 'discoverable'
                   THEN 'discoverable' ELSE 'hidden' END
         FROM bundles b
        WHERE b.object_type = 'project' AND (? IS NULL OR b.bundle_id = ?)
       ON CONFLICT(project_id) DO UPDATE SET setting = excluded.setting`,
      projectId, projectId);
  }

  /* THE ANSWER AN ACT GIVES AT EXISTENCE, asked in ONE place so no act can say a second thing: C-70.1 when the
     caller's sight of this id is EXISTENCE, else null — and then the act's own REC-138 line runs unchanged, so
     NONE is still answered exactly as an id naming nothing (byte for byte) and FULL proceeds. Every act that
     names a project asks this immediately before its sight line. A viewer never SENT is not asked
     (`rosterInSight`'s precedent): it is an internal caller, and NONE's line decides for it as before. */
  existenceAct(projectId, viewer) {
    if (viewer === null || viewer === undefined) return null;
    try {
      return this.sight(projectId, viewer) === Membership.SIGHT_EXISTENCE ? this.#existenceOnly(projectId) : null;
    } catch { return null; }
  }

  /* C-70.1, minted here and only here; every act RELAYS it through `existenceAct`. Its two forms (R77, D54): at a
     discoverable project's EXISTENCE, the id and the name, which the directory already showed this caller, and nothing
     else; at a hidden project's, which only an administrator neither invited nor joined reaches (R44), the id, the name
     and `owners`, the owners' current handles in R65's order (null for an owner with none; the founder's is her own handle once she holds one, R144, never `admin`), so a hold or a
     complaint can name who to ask. No act, no state, no other participant, ever. */
  #existenceOnly(projectId) {
    const title = this.#titleOf(projectId);
    const hidden = this.visibilityOf(projectId) === "hidden";
    const refusal = (code, detail) => {
      const row = PROJECT_VISIBILITY_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId, name: title,
               ...(hidden ? { owners: this.projectOwners(projectId).map((o) => this.#handleOf(o)) } : {}) };
    };
    /* DEC-49 REGION is-project-existence-only */
    return refusal("PROJECT_SEEN_NOT_A_PARTICIPANT", hidden
      ? localize("membership.index.this_project_is_hidden_and", "this project is hidden and you are neither invited to it nor joined to it. As an administrator you see its id, its name and its owners, and nothing inside it; its owners can add you (Membership Architecture v2 §7.9).")
      : localize("membership.index.this_project_is_discoverable_and", "this project is discoverable and you are not one of its participants. Its existence and name are all it shows you; asking to join is the one act open to you (Membership Architecture v2 §7.14)."));
    /* END DEC-49 REGION is-project-existence-only */
  }

  /** REC-149 — THE SETTING, an OWNER'S recorded act (§7.14 "The setting"). Append-only: every act is a row with
   *  the owner, the date and an optional reason, and the current setting is the latest. Sight before position:
   *  a caller who cannot see the project is answered as for one that does not exist, a caller at EXISTENCE gets
   *  C-70.1, and only then is ownership asked — through `isProjectOwner`, §7's one owner predicate, so an
   *  administrator, the founder and every machine credential are refused (administrators direct nothing, §4.9,
   *  and §7.13's rescue does not set it). A viewer never SENT is not asked, `rosterInSight`'s precedent. */
  projectVisibilitySet({ projectId, setting, reason = null, by, viewer = null } = {}) {
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, projectId);
    const existence = b ? this.existenceAct(projectId, viewer) : null;
    if (existence) return existence;
    if (!b || !this.rosterInSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.object_type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
    const want = String(setting ?? "");
    const refusal = (code, detail) => {
      const row = PROJECT_VISIBILITY_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId };
    };
    /* DEC-49 REGION is-project-visibility-owner */
    if (!this.isProjectOwner(projectId, by))
      return refusal("PROJECT_VISIBILITY_NOT_THE_OWNER",
        localize("membership.index.whether_string_can_be_found", "whether {String} can be found is its OWNERS' choice (Membership Architecture v2 §7.14), and {String_2} is not one of them. Seeing a project is not directing it. Nothing was written.", { String: String(String(projectId).slice(0, 80)), String_2: String(String(by ?? "an unnamed caller").slice(0, 80)) }));
    /* END DEC-49 REGION is-project-visibility-owner */
    /* REC-197: the value check moved into ONE helper, which a creation's `visibility` asks too, so the two
       doors cannot disagree about what a setting is. Still asked AFTER the owner check here, as before. */
    { const unknown = this.visibilitySettingRefusal(want, projectId); if (unknown) return unknown; }
    { const guarded = this.#projectActGuarded("visibility", projectId, by, want); if (guarded) return guarded; }   /* R128 */
    const why = reason === null || reason === undefined || String(reason).trim() === ""
      ? null : String(reason).slice(0, 280);
    const at = this.#nowIso();
    this.sql.exec(`INSERT INTO project_visibility (project_id, setting, set_by, reason, at) VALUES (?,?,?,?,?)`,
      projectId, want, by, why, at);
    /* D-497: the act is the record; the sight index is its derivation, re-derived for THIS project from the
       log that just gained a row. Never written from `want` directly — that would be the second copy of
       "the latest act wins", and it is the copy that would agree for free until the day the rule moved. */
    this.reindexProjectSight(projectId);
    /* REC-150, R45, R117 (§7.14, "The request to join"; N783): SETTING A PROJECT HIDDEN LAPSES EVERY OPEN REQUEST TO
       IT, recorded as lapsed with the owner who hid it and the same date, by R117's listener (`project-roster`, its
       R16), told after the record and the reindex. Setting it discoverable notifies nobody and reopens nothing. */
    const lapsed = want === "hidden"
      ? Membership.#tell(this.#hiddenListener, { projectId, by: by ?? null, at }) : 0;
    return { ok: true, projectId, setting: want, set_by: by, reason: why, at,
             ...(want === "hidden" ? { requests_lapsed: lapsed } : {}) };
  }

  /* REC-197 — WHAT A SETTING IS, asked in ONE place by both doors that take one: the owner's act above and a
     creation's `visibility` (`promote`, which a fork reaches through). "discoverable" or "hidden" and nothing
     else, compared exactly — a spelling the vocabulary does not write is not quietly read as either. Null when
     the value is a setting. `projectId` is echoed when the door has one (the owner's act); a creation has none. */
  visibilitySettingRefusal(value, projectId) {
    const want = String(value ?? "");
    const refusal = (code, detail) => {
      const row = PROJECT_VISIBILITY_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               ...(projectId !== null ? { project: projectId } : {}) };
    };
    /* DEC-49 REGION is-project-visibility-setting */
    if (want !== "discoverable" && want !== "hidden")
      return refusal("PROJECT_VISIBILITY_UNKNOWN_SETTING",
        localize("membership.index.stringify_is_not_a_setting", "{stringify} is not a setting: a project is \"discoverable\" or \"hidden\", and nothing else. Nothing was written.", { stringify: String(JSON.stringify(want.slice(0, 40))) }));
    /* END DEC-49 REGION is-project-visibility-setting */
    return null;
  }

  /* THE ROSTER ACTS' form of the same question, and the one difference is stated rather than hidden.
     Their positional half is `by`, and they have always been driven straight at the store by callers
     that are not requests (setup, fixtures, the store's own suites) — the same population
     `projectAuthority` answers "not asked" for an ABSENT identity. So an ABSENT viewer (the
     parameter not sent at all: null) is NOT ASKED here, on that precedent; ANY viewer that was sent,
     including an empty one, is asked through `inSight` and fails closed. The control plane stamps
     every roster act (`PROJECT_ACTIONS`): without the stamp these acts would fall back to disclosing. */
  rosterInSight(projectId, viewer) {
    return viewer === null || viewer === undefined || this.inSight(projectId, viewer);
  }

  /** D-310: DOES THIS MEMBER HOLD THE OWNER POSITION ANYWHERE — the question
   *  `op=affordances` has to answer before it offers `publish`, because the
   *  project is a PARAMETER of that act and the pre-flight cannot know which one
   *  a caller will name. `publishCase()` refuses the per-PAIR question
   *  (`NOT_THE_PROJECT_OWNER`, DEC-72 clause 5); this is the weakest fact that
   *  makes the two unable to disagree, and nothing weaker would close it.
   *
   *  THE RULE IS `isProjectOwner`'s AND IS NOT RESTATED. This selects the
   *  member's own participations off the `pp_member` index and asks THAT
   *  predicate about each — the same one publishCase()'s fence runs — so a
   *  change to what "owner" means is made once. Writing `AND owner=1` here
   *  would be a second implementation of the owner rule, which is this
   *  repository's most-repeated defect class and is named as such at the fence
   *  itself.
   *
   *  AND IT IS A PREDICATE RATHER THAN A SCAN INSIDE `affordanceFacts`, for the
   *  reason `#citesInto` and `#restsOnLive` are: that method STATES FACTS and
   *  assembles no SQL of its own, and every row question it asks goes through a
   *  predicate a refusal also runs. A LIMIT is deliberately NOT taken — a bound
   *  that stopped before an owner row would withhold the act from a genuine
   *  owner, the over-strictness failure, and what bounds this set is roster ACTS
   *  (an invite, a join) and never a corpus. */
  ownsAnyProject(memberId) {
    return this.#rows(`SELECT project_id FROM project_participants WHERE member_id=?`, memberId)
               .some((p) => this.isProjectOwner(p.project_id, memberId));
  }

  /* REC-133 / BIO_Publication §6A.2: THE PROJECT'S EDIT PERMISSION, positional half.
     Membership v2 §7.5: *"A joined member has the working rights their capabilities
     allow"*, and an invited member who has not joined has VIEW rights only; a member
     who has asked to leave (7.6) has asked to stop working. So: an OWNER (the rule
     `isProjectOwner` states, consumed rather than restated) or a participant whose
     state is `joined`, read through `participation`, the record's one membership
     predicate. The CAPABILITY half, `contribute` (*"create and revise bundles in the
     working corpus"*, §5), is a SESSION's and is enforced at the control plane's
     NEEDS table, where every other corpus write is gated. An administrator gains
     nothing here: sight of every project is not a position in any of them (§7.3).
     No new right is minted; this is §7.5 said once. */
  isProjectEditor(projectId, memberId) {
    if (this.isProjectOwner(projectId, memberId)) return true;
    const p = this.participation(projectId, memberId);
    return !!(p && p.state === "joined");
  }

  /* R127 (K2404; for `credentials` R54, R59): every participant `joined` or `leaving` (R54's set), whatever the member's
     status, in member-id order: `{member, owner, since}`, `since` the instant the row last became `joined` (null for a row
     joined before T40 recorded it). An unknown project answers []. Writes nothing and never throws. */
  joinedParticipants(projectId) {
    try {
      if (typeof projectId !== "string" || !projectId) return [];
      return this.#rows(`SELECT member_id, owner, joined_at FROM project_participants
                          WHERE project_id=? AND state IN ('joined','leaving') ORDER BY member_id`, projectId)
        .map((r) => ({ member: r.member_id, owner: r.owner === 1, since: r.joined_at ?? null }));
    } catch { return []; }
  }

  /* R74: one member's participation in one project, `{state, owner}`, or null (promotion's forkProject reads it). */
  participation(projectId, memberId) {
    const p = this.#one(`SELECT state, owner FROM project_participants WHERE project_id=? AND member_id=?`,
      projectId, memberId);
    return p ? { state: p.state, owner: p.owner === 1 } : null;
  }

  /** 7.1: the creator is the owner. Called when a project bundle is promoted by
   *  an identified member; a project created by a machine credential has no
   *  owner row, which is honest rather than inventing one. */
  projectClaimOwner({ projectId, memberId } = {}) {
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, projectId);
    if (!b) return noSuchProject(projectId);   /* R78 */
    if (b.object_type !== "project") return { ok: false, reason: "NOT_A_PROJECT" };
    if (this.#one(`SELECT member_id FROM project_participants WHERE project_id=? AND owner=1`, projectId))
      return { ok: false, reason: "OWNED" };
    const now = this.#nowIso();
    this.sql.exec(
      `INSERT OR REPLACE INTO project_participants (project_id,member_id,state,owner,owner_order,invited_by,created,updated,
                                                    joined_at)
       VALUES (?,?,'joined',1,1,NULL,?,?,?)`, projectId, memberId, now, now, now);   /* R127: joined at creation */
    return { ok: true, projectId, owner: memberId };
  }

  /** 7.2: the owner invites by handle, and only an owner (the code below). CORRECTED 2026-09-23
   *  (D-311): this read "Administrators may also invite, because 7.7 already gives them authority
   *  over participation" — v1.4's 7.7, which Membership Architecture v2 REVERSED; its §11 item 5
   *  requires such a comment corrected rather than left to disagree in silence. */
  projectInvite({ projectId, handle, by, viewer = null } = {}) {
    const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, projectId);
    /* REC-138 / D-426: sight BEFORE position (see `inSight`). */
    { const existence = b ? this.existenceAct(projectId, viewer) : null; if (existence) return existence; }   /* REC-149 */
    if (!b || !this.rosterInSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.object_type !== "project") return { ok: false, reason: "NOT_A_PROJECT" };
    if (!this.isProjectOwner(projectId, by))
      return { ok: false, reason: "NOT_THE_OWNER",
               detail: localize("membership.index.only_an_owner_of_this", "only an owner of this project invites participants to it. An administrator directs no project, whatever it sees.") };
    /* R157 (T52; W4, A-K8 (b) (c); amends R32): the founder's held handle (`member-roster` R59) answers the founder,
       whose member id is `admin`, so it never answers NO_SUCH_HANDLE; `memberByHandle` itself stays (R48). */
    const fh = this.founderHandle();
    const target = typeof handle === "string" && handle !== "" && handle === fh
      ? { member_id: ROOT_ADMIN, handle, status: "active" }
      : this.memberByHandle(handle);
    if (!target) return { ok: false, reason: "NO_SUCH_HANDLE", handle };
    if (target.member_id === by || (typeof by === "string" && by === `member:${target.member_id}`))
      return { ok: false, reason: "THAT_IS_YOU", handle,
               detail: localize("membership.index.that_handle_is_yours", "that handle is yours; you cannot invite yourself to a project") };
    if (target.status !== "active") return { ok: false, reason: "NOT_ACTIVE", handle };
    const held = this.participation(projectId, target.member_id);
    if (held && held.state === "invited")
      return { ok: false, reason: "ALREADY_INVITED", handle,
               detail: localize("membership.index.that_member_is_already_invited", "that member is already invited to this project and has not joined yet") };
    if (held)
      return { ok: false, reason: "ALREADY_A_PARTICIPANT", handle,
               detail: localize("membership.index.that_member_is_already_in", "that member is already a participant of this project") };
    { const guarded = this.#projectActGuarded("invite", projectId, by); if (guarded) return guarded; }   /* R128 */
    const now = this.#nowIso();
    this.participationWrite("invite", { projectId, memberId: target.member_id, by, at: now });
    /* R33, R116 (REC-226; N783): the same act answers the invitee's open request to join, if they have one: R116's
       listener (`project-roster`, its R15) closes it `granted`, by the owner who invited, so a request never stays open
       beside the invitation that met it. */
    const granted = Membership.#tell(this.#invitedListener,
      { projectId, memberId: target.member_id, by: by ?? null, at: now });
    return { ok: true, projectId, handle, state: "invited", ...(granted ? { request: "granted" } : {}) };
  }

  /** 7.4: joining is selecting the checkbox. There is no acceptance ceremony. */
  projectJoin({ projectId, by, viewer = null } = {}) {
    /* REC-149: at EXISTENCE (a discoverable project, a member outside it) the positional C-70.1; otherwise the
       answer below is unchanged, and it already says the same thing for an absent id and a hidden one. */
    { const existence = this.existenceAct(projectId, viewer); if (existence) return existence; }
    const p = this.participation(projectId, by);
    if (!p) return { ok: false, reason: "NOT_INVITED",
      detail: localize("membership.index.a_member_joins_a_project", "a member joins a project they were invited to. Being uninvited is not a refusal you can see.") };
    /* R127 (K2404): the instant the row becomes `joined`; a row already joined keeps the instant it joined. */
    const now = this.#nowIso();
    this.sql.exec(`UPDATE project_participants SET joined_at=CASE WHEN state='joined' THEN joined_at ELSE ? END,
                     state='joined', comment=NULL, updated=? WHERE project_id=? AND member_id=?`, now, now, projectId, by);
    return { ok: true, projectId, state: "joined" };
  }

  /** 7.6: unchecking the box is a REQUEST to leave. It greys the checkmark and
   *  removes nobody; removal is 7.7's, which v2 gives to an OWNER of the project
   *  (CORRECTED 2026-09-23 by D-311 — this read "to administrators alone", v1.4's rule). */
  projectLeave({ projectId, by, comment = null, viewer = null } = {}) {
    /* REC-149: at EXISTENCE (a discoverable project, a member outside it) the positional C-70.1; otherwise the
       answer below is unchanged, and it already says the same thing for an absent id and a hidden one. */
    { const existence = this.existenceAct(projectId, viewer); if (existence) return existence; }
    const p = this.participation(projectId, by);
    if (!p) return notAParticipant(projectId, by);   /* R87 (N335): C-56.3 minted at its one site */
    if (p.state !== "joined") return { ok: false, reason: "NOT_JOINED", state: p.state };
    /* REC-186 (BOB #31's ruling of 2026-09-23 21:37Z on Membership v2 §7.6 and §7.10): THE PROJECT'S ONLY
       OWNER DOES NOT ASK TO LEAVE. An owner's request can be honoured only by the 7.10 removal (7.7 refuses
       an owner, `OWNER`), and 7.10's floor refuses that removal at one owner, so a request from the last owner
       would record a departure the record can never carry out — an overclaim. The floor is asked through the
       SAME arithmetic `project-roster`'s `projectOwnerRemove`'s LAST_OWNER ran; R35 (below) has since replaced that count with the
       committed owners, which that act's LAST_COMMITTED_OWNER also reads. Nothing is written. */
    /* DEC-49 REGION is-leave-owner-floor — REC-186/C-33.48. */
    /* R35 (REC-224): an owner may ask to leave only while ANOTHER owner stays committed — an owner who has not
       asked to leave. Counting every owner (the old LAST_OWNER_CANNOT_LEAVE) let two owners both ask to leave and
       strand the project with nobody committed to it. */
    if (p.owner) {
      const committed = this.#committedOwners(projectId).filter((o) => o !== by);
      if (!committed.length)
        return { ok: false, reason: "LAST_COMMITTED_OWNER", owners: this.projectOwners(projectId).sort(),
                 detail: localize("membership.index.no_other_owner_of_this", "no other owner of this project is committed to it (every other owner has asked to leave, or there is none), and one committed owner is the floor, so a request to leave could never be carried out. Transfer ownership first: add another owner (7.10), then ask to leave; or deactivate the project (7.11). Nothing was written.") };
    }
    /* END DEC-49 REGION is-leave-owner-floor */
    const c = comment === null ? null : String(comment).slice(0, 280);
    this.sql.exec(`UPDATE project_participants SET state='leaving', comment=?, updated=? WHERE project_id=? AND member_id=?`,
      c, this.#nowIso(), projectId, by);
    return { ok: true, projectId, state: "leaving", comment: c,
             detail: localize("membership.index.recorded_as_a_request_to", "recorded as a request to leave. An owner of this project removes participants; this does not.") };
  }

  /** 7.7, REVERSED in Membership Architecture v2: only an OWNER of the project
   *  removes a participant, request outstanding or not, and an administrator does
   *  not. CORRECTED 2026-09-23 by D-311 — this comment still stated v1.4's rule
   *  ("only an administrator removes … Project owners invite; they do not remove")
   *  over code that has enforced v2's since the reversal; §11 item 5 requires it
   *  corrected rather than left to disagree in silence. */
  projectRemove({ projectId, handle, by, comment = null, viewer = null } = {}) {
    /* REC-149: at EXISTENCE (a discoverable project, a member outside it) the positional C-70.1; otherwise the
       answer below is unchanged, and it already says the same thing for an absent id and a hidden one. */
    { const existence = this.existenceAct(projectId, viewer); if (existence) return existence; }
    if (!this.isProjectOwner(projectId, by))
      return { ok: false, reason: "NOT_THE_OWNER",
               detail: localize("membership.index.only_an_owner_of_this_2", "only an owner of this project removes a participant from it. This REVERSES the earlier rule, under which an administrator removed and an owner could not.") };
    const target = this.memberByHandle(handle);
    if (!target) return { ok: false, reason: "NO_SUCH_HANDLE", handle };
    const p = this.participation(projectId, target.member_id);
    /* N335: the NAMED member holds no participation, a different condition from the caller holding none (R87), so it
       has its own code and row, C-56.4 (`TARGET_NOT_AN_ADMIN`'s precedent). */
    /* DEC-49 REGION is-remove-target-participant */
    if (!p) {
      const row = MEMBERSHIP_CHECKS.TARGET_NOT_A_PARTICIPANT;
      return { ok: false, reason: "TARGET_NOT_A_PARTICIPANT", code: "TARGET_NOT_A_PARTICIPANT", check: row.check,
               translation: row.translation, handle,
               detail: localize("membership.index.the_member_named_holds_no", "the member named holds no participation in this project, so there is nobody to remove (7.7). Nothing was written.") };
    }
    /* END DEC-49 REGION is-remove-target-participant */
    if (p.owner) return { ok: false, reason: "OWNER",
      detail: localize("membership.index.an_owner_is_not_removed", "an owner is not removed from a project by this action. Ownership changes by the section 7.10 process, and removal from the project follows once they are no longer an owner.") };
    const why = comment === null || comment === undefined ? null : String(comment).slice(0, 280);
    const at = this.#nowIso();
    this.sql.exec(`DELETE FROM project_participants WHERE project_id=? AND member_id=?`, projectId, target.member_id);
    /* R63 (Bob, 2026-09-26): the removal stays in the record — who removed whom, when, and the owner's reason —
       and every participant reads it (`project-roster`'s roster read, its `removals`). */
    this.sql.exec(`INSERT INTO project_removals (project_id, member_id, removed_by, comment, at) VALUES (?,?,?,?,?)`,
      projectId, target.member_id, by, why, at);
    return { ok: true, projectId, handle, removed: true, comment: why, by, at };
  }

  /** D-311: THE RESCUE'S CALLER-AND-PROJECT CONDITIONS, extracted from `projectOwnerRescue` (now `project-roster`'s, its R5) so
   *  `op=affordances` asks the SAME predicate the act refuses on (the `#citesInto` discipline):
   *  the caller is an administrator, the project has owner rows, and EVERY owner is inactive.
   *  Returns the refusal the act answers, byte for byte as it answered before the extraction, or
   *  null. What it leaves to the act is what turns on a PARAMETER (the reason, the handle). */
  rescueRefusal(projectId, by) {
    /* R84 (N327, DEC-83): the rescue is the single exception to administrators holding no authority over projects,
       and an administrator's to use; the remedy names who acts instead. */
    if (!this.isAdministrator(by))
      return notAnAdmin(by, localize("membership.index.adding_an_owner_to_a_project_whose_owners", "adding an owner to a project whose owners are all inactive (7.13)"),
        { remedy: word("membership.remedy.active_administrator_group") });   /* R151 */
    const owners = this.projectOwners(projectId);
    if (!owners.length)
      return { ok: false, reason: "NO_OWNERS",
               detail: localize("membership.index.this_project_has_no_owner_rows", "this project has no owner rows at all, which is a project created by a machine credential rather than a stranded one") };
    /* EVERY owner, not any. */
    const active = owners.filter((o) => {
      const m = this.#one(`SELECT status FROM members WHERE member_id=?`, o);
      return m && m.status === "active";
    });
    if (active.length)
      return { ok: false, reason: "OWNERS_ARE_ACTIVE", active: active.sort(),
               detail: localize("membership.index.an_administrator_may_add_an", "an administrator may add an owner only when EVERY owner of the project is inactive. While one is active the project is theirs to run, and 7.10 is the route.") };
    return null;
  }

  /* Section 7.10. Ownership of a project is a SET, and it follows 4.7 with one
     deliberate divergence and one relaxed floor.
   *
   * DO NOT REUSE adminMath HERE. It diverges at exactly one row, n=2, and that
   * row is the one a shared implementation gets wrong by reuse.
   *
   * For administrators, removal at two is IMPOSSIBLE and the impossibility is
   * the point: it stops a capture at the smallest size, and 4.2's floor of two
   * means a group never has to go below it. Projects have a floor of ONE, so if
   * removal at two were impossible the floor would be reachable only by never
   * adding a second owner, and a second owner would be permanent.
   *
   * At two, the target MAY vote, so removal is unanimity including them. That
   * describes what the act actually is at that size: one owner resigning with
   * the other's assent. It opens nothing, because the only removal it permits is
   * one the target has agreed to, and a hostile removal at two stays impossible
   * exactly as in 4.7. */
  static ownerMath(n) {
    if (n <= 1)
      return { owners: n, votesNeeded: 0, eligibleVoters: 0, targetMayVote: false, possible: false,
               why: word("membership.why.owner_floor_last") };
    if (n === 2)
      return { owners: 2, votesNeeded: 2, eligibleVoters: 2, targetMayVote: true, possible: true,
               why: word("membership.why.both_owners_agree") };
    const votesNeeded = Math.floor(n / 2) + 1;
    const eligibleVoters = n - 1;
    return { owners: n, votesNeeded, eligibleVoters, targetMayVote: false,
             possible: votesNeeded <= eligibleVoters,
             why: word("membership.why.majority_all_owners") };
  }

  /** REC-30: the TABLE is arithmetic and belongs to everyone. The LIVE arm reads
   *  a named project's owner count, and an owner count is existence: asking for
   *  a project nobody invited you to would have answered `owners: 3` where an
   *  invented id answers `owners: 0`, which is precisely the "not even that it
   *  exists" 7.9 forbids. Gated through the ONE compilation point (`inSight`,
   *  which is false for an absent bundle AND for an invisible one), so an
   *  invisible project now answers exactly what a nonexistent one answers —
   *  ownerMath(0) — rather than a refusal that would itself be a signal. */
  projectOwnerArithmetic({ projectId, viewer = null } = {}) {
    const table = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) table.push(Membership.ownerMath(n));
    const live = projectId
      ? Membership.ownerMath(this.inSight(projectId, viewer) ? this.projectOwners(projectId).length : 0)
      : null;
    return { ok: true, table, live, projectId: projectId ?? null };
  }

  /* R65: the owners' member ids in the order they became owners (`owner_order`, the project's owner counter; a row
     written before that column existed orders first, by its creation, then id); [] for no owner or no such project. */
  projectOwners(projectId) {
    return this.#rows(`SELECT member_id FROM project_participants WHERE project_id=? AND owner=1
                        ORDER BY COALESCE(owner_order, 0), created, member_id`, projectId)
      .map((r) => r.member_id);
  }

  /* The owners committed to the project: every owner who has not asked to leave (R35; `project-roster` R4 reads the same set). */
  #committedOwners(projectId) {
    return this.#rows(`SELECT member_id FROM project_participants WHERE project_id=? AND owner=1 AND state<>'leaving'`,
      projectId).map((r) => r.member_id);
  }

  /* A refusal carrying its row from MEMBERSHIP_CHECKS: `reason` and `code` the same literal. The caller's fields sit
     beside the row's and never replace them. */
  static #rowRefusal(code, detail, extra) {
    const row = MEMBERSHIP_CHECKS[code];
    return { ...(extra || {}), ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
  }

  /* A caller's value echoed back in a refusal: never more than it can carry safely. */
  static #echo(v) {
    try { return typeof v === "string" ? v.slice(0, 40) : typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v).slice(0, 40); }
    catch { return null; }
  }

  /* An owner's current handle as a reader sees it (R77): a member's, or the founder's own once she holds one, and never the
     founder's id `admin`; null for an owner with none. */
  #handleOf(memberId) {
    return memberId === ROOT_ADMIN ? this.members.founderHandle() : this.members.memberFacts(memberId)?.handle ?? null;
  }

  /* ===== R154 — EACH MOVED NAME ANSWERS WHAT `member-roster` ANSWERS (K3268: no user re-points) =====
   * Each name whose requirement moved to `member-roster` is a delegate of the same name and shape; the class statics are
   * its aliases. */
  static ROOT_ADMIN = ROOT_ADMIN;
  static CAPABILITIES = CAPABILITIES;
  static adminMath = adminMath;
  static HOSTING_ACCESS_LIMIT = Members.HOSTING_ACCESS_LIMIT;
  static MEMBER_PAIRINGS_LIMIT = Members.MEMBER_PAIRINGS_LIMIT;
  static HANDLE_PATTERN = Members.HANDLE_PATTERN;
  static HANDLE_CHECK_WINDOW = Members.HANDLE_CHECK_WINDOW;
  static HANDLE_CHECK_STATED = Members.HANDLE_CHECK_STATED;
  static INVITE_DAYS_DEFAULT = Members.INVITE_DAYS_DEFAULT;
  static INVITE_DAYS_MAX = Members.INVITE_DAYS_MAX;
  static DOOR_WARNING = Members.DOOR_WARNING;
  static JOIN_DOORS_LIMIT = Members.JOIN_DOORS_LIMIT;
  static COURT_STATEMENT = Members.COURT_STATEMENT;
  static GROUP_KINDS = Members.GROUP_KINDS;

  onRevoked(...a) { return this.members.onRevoked(...a); }
  registerClaimed(...a) { return this.members.registerClaimed(...a); }
  registerPasswordSetter(...a) { return this.members.registerPasswordSetter(...a); }
  registerHandleGuard(...a) { return this.members.registerHandleGuard(...a); }
  isAdministrator(...a) { return this.members.isAdministrator(...a); }
  activeAdmins(...a) { return this.members.activeAdmins(...a); }
  memberFacts(...a) { return this.members.memberFacts(...a); }
  memberStatusSince(...a) { return this.members.memberStatusSince(...a); }
  memberByHandle(...a) { return this.members.memberByHandle(...a); }
  sessionRights(...a) { return this.members.sessionRights(...a); }
  adminResign(...a) { return this.members.adminResign(...a); }
  adminArithmetic(...a) { return this.members.adminArithmetic(...a); }
  adminEndorse(...a) { return this.members.adminEndorse(...a); }
  adminRemove(...a) { return this.members.adminRemove(...a); }
  adminRemovalsOpen(...a) { return this.members.adminRemovalsOpen(...a); }
  hostingAccessSet(...a) { return this.members.hostingAccessSet(...a); }
  hostingAccess(...a) { return this.members.hostingAccess(...a); }
  memberPairingSet(...a) { return this.members.memberPairingSet(...a); }
  memberPairings(...a) { return this.members.memberPairings(...a); }
  memberCaps(...a) { return this.members.memberCaps(...a); }
  memberAdd(...a) { return this.members.memberAdd(...a); }
  memberSet(...a) { return this.members.memberSet(...a); }
  inviteLook(...a) { return this.members.inviteLook(...a); }
  inviteWithdraw(...a) { return this.members.inviteWithdraw(...a); }
  enroll(...a) { return this.members.enroll(...a); }
  expertiseDeclare(...a) { return this.members.expertiseDeclare(...a); }
  expertiseConfirm(...a) { return this.members.expertiseConfirm(...a); }
  expertiseList(...a) { return this.members.expertiseList(...a); }
  expertiseWithdraw(...a) { return this.members.expertiseWithdraw(...a); }
  expertiseAwaitingConfirmation(...a) { return this.members.expertiseAwaitingConfirmation(...a); }
  endorsementsOwed(...a) { return this.members.endorsementsOwed(...a); }
  handleCheck(...a) { return this.members.handleCheck(...a); }
  handleChange(...a) { return this.members.handleChange(...a); }
  founderHandle(...a) { return this.members.founderHandle(...a); }
  founderHandleSet(...a) { return this.members.founderHandleSet(...a); }
  websiteKeyCreate(...a) { return this.members.websiteKeyCreate(...a); }
  websiteKeySet(...a) { return this.members.websiteKeySet(...a); }
  websiteKeyRevoke(...a) { return this.members.websiteKeyRevoke(...a); }
  websiteInvite(...a) { return this.members.websiteInvite(...a); }
  joinLinkEnable(...a) { return this.members.joinLinkEnable(...a); }
  joinLinkSet(...a) { return this.members.joinLinkSet(...a); }
  joinLinkReplace(...a) { return this.members.joinLinkReplace(...a); }
  joinLinkOff(...a) { return this.members.joinLinkOff(...a); }
  joinLinkInvite(...a) { return this.members.joinLinkInvite(...a); }
  joinDoors(...a) { return this.members.joinDoors(...a); }
  courtNoticeSet(...a) { return this.members.courtNoticeSet(...a); }
  courtNotice(...a) { return this.members.courtNotice(...a); }
  lookedSince(...a) { return this.members.lookedSince(...a); }
  lookedAt(...a) { return this.members.lookedAt(...a); }
  groupDescriptionSet(...a) { return this.members.groupDescriptionSet(...a); }
  groupDescription(...a) { return this.members.groupDescription(...a); }

  /* R14, R71 (`member-roster`): the roster, given this module's own rule for the projects of a member (R18). */
  memberList({ administer, viewer = null } = {}) {
    return this.members.memberList({ administer, viewer, projectsOf: (memberId, v) => this.#projectsOf(memberId, v) });
  }

  /* ---- R106 (DEC-135 (2), (5)): who a check request reaches ---- */

  /** Every active member whose current state for `label` is declared or confirmed (`member-roster` R72) and whom R80
   *  admits to `target`, in member-id order. It addresses only: writes nothing, grants nothing, and never throws. */
  checkAddressees({ target, label } = {}) {
    try {
      const holders = this.members.expertiseHolders(label);
      if (!Array.isArray(holders)) return holders;   // EXPERTISE_NO_LABEL, R72's refusal
      if (typeof target !== "string" || !target) return [];
      return holders.filter((h) => this.inSight(target, `member:${h.memberId}`));
    } catch { return []; }
  }
}

/* K61: the one Membership of a Durable Object's storage, made on first use over its `sql`, reaching record-core by
   `recordOf(ctx)` on the same `ctx`. Its member-roster half is its own `Members`, built on this instance's clock (R156,
   K5202), so an instant member-roster records follows the store's environment; `membersOf(ctx)` stays member-roster's
   reads. `record` (a test's own record-core) is read on the first call only. */
const OF = new WeakMap();
export function membershipOf(ctx, { record = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let m = OF.get(storage);
  if (!m) { m = new Membership({ sql: storage.sql, core: record ?? recordOf(ctx) }); OF.set(storage, m); }
  return m;
}

/* The ops this module answers, as entries of the plane's op map (the composition root, `plane`, spreads them in): the
   member ops are `member-roster`'s `membersOps` over this module (so `memberlist` passes the projects of a member, and
   `adminremovalsopen` is answered here, R154), beside the project ops. `url` is the request URL, whose query carries the
   control plane's stamps (`by`, `viewer`, `who`, `administer`); `body` the parsed body; `env` the host's environment. Each
   stamp is read from the query AFTER the body is spread, so a caller's own copy never wins (D-136). */
export function membershipOps(m, url, body, env) {
  return {
    ...membersOps(m, url, body, env),
    projectclaimowner: () => m.projectClaimOwner(body || {}),
    /* REC-138: `viewer` is the control plane's stamp (sight before position, `inSight`). */
    projectownerarith: () => m.projectOwnerArithmetic({ projectId: url.searchParams.get("projectId"),
                                                        viewer: url.searchParams.get("viewer") }),
    projectinvite: () => m.projectInvite({ projectId: url.searchParams.get("projectId"),
      handle: url.searchParams.get("handle"), by: url.searchParams.get("by"),
      viewer: url.searchParams.get("viewer") }),   /* REC-138 */
    /* REC-149: the three take the stamped viewer too, and ask it ONLY for EXISTENCE (C-70.1). */
    projectjoin: () => m.projectJoin({ projectId: url.searchParams.get("projectId"),
      by: url.searchParams.get("by"), viewer: url.searchParams.get("viewer") }),
    projectleave: () => m.projectLeave({ projectId: url.searchParams.get("projectId"),
      by: url.searchParams.get("by"), comment: url.searchParams.get("comment"),
      viewer: url.searchParams.get("viewer") }),
    projectremove: () => m.projectRemove({ projectId: url.searchParams.get("projectId"),
      handle: url.searchParams.get("handle"), by: url.searchParams.get("by"),
      comment: url.searchParams.get("comment"), viewer: url.searchParams.get("viewer") }),
    /* REC-149 (Membership v2 §7.14): the owner's setting. `by` and `viewer` are the control plane's stamps. */
    projectvisibilityset: () => m.projectVisibilitySet({ projectId: url.searchParams.get("projectId"),
      setting: url.searchParams.get("setting"), reason: url.searchParams.get("reason"),
      by: url.searchParams.get("by"), viewer: url.searchParams.get("viewer") }),
    checkaddressees: () => m.checkAddressees({ target: url.searchParams.get("target"),
      label: url.searchParams.get("label") }),
  };
}

/* R155 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  projectinvite: { classes: ["admin","member","probe"], mutating: true, weight: "credential", description: localize("membership.declared.projectinvite", "roster act on a project, position-enforced by the store"),
    fields: { accepts: ["projectId","handle"], requires: ["projectId","handle"] } },
  projectjoin: { classes: ["admin","member","probe"], mutating: true, weight: "credential", description: localize("membership.declared.projectjoin", "roster act on a project"),
    fields: { accepts: ["projectId"], requires: ["projectId"] } },
  projectleave: { classes: ["admin","member","probe"], mutating: true, weight: "credential", description: localize("membership.declared.projectleave", "roster act on a project"),
    fields: { accepts: ["projectId","comment"], requires: ["projectId"] } },
  projectremove: { classes: ["admin","member","probe"], mutating: true, weight: "credential", description: localize("membership.declared.projectremove", "roster act on a project"),
    fields: { accepts: ["projectId","handle","comment"], requires: ["projectId","handle"] } },
  projectvisibilityset: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.projectvisibilityset.does",
    fields: { accepts: ["projectId","setting","reason"], requires: ["projectId","setting"] } },
});
