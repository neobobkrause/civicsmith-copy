/* project-roster — the acts on a project's working group that follow its setup: the roster and its removals record,
 * the owners' votes and an administrator's rescue, the visibility history and the directory, and requests to join.
 *
 * Requirements: build/requirements/project-roster.md (R1–R42; fix round 3 adds R42, `question_count` and `shared_drafts` on the list; T51 adds R35 `projectInvitations`, R36 the list's cursor, R37 `member_id` on requests, R38 `mine` and `scope` on the list; fix round 10 adds R43, `by` read in the door's form (`actorOf`), and R44, the requester told the answer and `projectRequestsAnswered`). T45 adds a project's scope (R21–R23: a counsel matter, a
 * member's own project; the guard membership calls before an invitation or a visibility change, its R128) and the
 * second-approval setting (R24), the acts it names checked against the active profiles' `action_kinds`; T46 (R25)
 * reads their refusals' words by key from `words.json` (`checks.mjs`' `said`); T47 (R26) lists the
 * projects a viewer sees at FULL with each one's recorded stage, R27 each one's opener and R28 its members and recent
 * activity. Split from membership for
 * size at T38 (N783; K617, K624, K2270: variant C1′ of `build/plan/membership-split.md`), by copy: each act's
 * behaviour is membership's as T37 left it, its answers byte for byte. Inviting, joining, leaving and removing, the
 * visibility setting, what a caller may see of a project, the fence and the participation record stay `membership`'s.
 * Design: docs/architecture/BIO_Membership_Architecture_v2.md §7.
 *
 * SHAPE (K61). `projectRosterOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`,
 * reaching record-core by `recordOf(ctx)` and membership by `membershipOf(ctx)` on the same `ctx`; a test may pass its
 * own as `projectRosterOf(ctx, { record, membership, clock })`. This module writes only its own five tables (`schema.mjs`).
 * It reads membership's tables only through membership's stated read contract (its R120) and writes them only through
 * `participationWrite` (its R118); it joins record-core's `bundles` and `manifest` only on its read contract
 * (record-core R37) and asks every other bundle fact of `core.bundleInfo` (R34). Calls go one way: membership never calls this module but
 * through the two notice slots and the one guard this module registers in (membership R116, R117, R128). */
import { MACHINE_CLASS_PREFIX, parseFrontmatter, LEGACY_TYPE_ALIASES } from "../record-grammar/index.mjs";
import { combine } from "../../../jurisdictions/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { Membership, membershipOf, noSuchProject, viewerPredicate } from "../membership/index.mjs";
import { hasWord, word, localize } from "../setup-words/index.mjs";
import { PROJECT_ROSTER_SCHEMA, PROJECT_ROSTER_TABLES } from "./schema.mjs";
import { PROJECT_ROSTER_CHECKS, PROJECT_JOIN_REQUEST_CHECKS, PROJECT_SCOPE_CHECKS } from "./checks.mjs";
export { PROJECT_ROSTER_TABLES } from "./schema.mjs";
export { PROJECT_ROSTER_CHECKS, PROJECT_JOIN_REQUEST_CHECKS, PROJECT_SCOPE_CHECKS } from "./checks.mjs";

const ROOT_ADMIN = Membership.ROOT_ADMIN;

/** R43 (fix round 10; K5157): THE ACTOR `by` IN THE FORM THE DOOR STAMPS IT. A declared act arrives with `by` in the
 *  viewer's form (`member:<id>`; the founder's is the bare `admin`), a legacy act with the bare member id; membership's
 *  reads (`isProjectOwner`, `participation`, `isAdministrator`) take the member id. This is the one place the form is read:
 *  `member:<id>` answers `<id>`, anything else (a bare id, the founder's `admin`, a machine `class:<cls>`, a non-string)
 *  as it came, so a prefix is never added to one already there. */
const MEMBER_FORM = /^member:([A-Za-z0-9._:-]{1,128})$/;
export function actorOf(by) {
  const m = typeof by === "string" ? MEMBER_FORM.exec(by) : null;
  return m ? m[1] : by;
}

/** R31 (T50; `action-records` R17): THE STAKE'S TWO REFUSALS, pure. `null` for a member's stamp and a stake that is
 *  `null` or trimmed text of 1 to 1,000 characters on one line with no control character; else the one refusal, its
 *  C-147 row and word by key (`of: "action"` reads `refusal.STAKE_MALFORMED.action`; null while the list lacks it).
 *  `projectId`, when given, rides on the answer as `projectStakeSet` answers it. */
export function stakeFault({ by, stake, of = "project", projectId = null } = {}) {
  const row = (code, detail, translation) => ({ ok: false, reason: code, code, check: PROJECT_SCOPE_CHECKS[code].check,
    translation, detail, project: projectId ?? null });
  if (typeof by !== "string" || !by || by.startsWith(MACHINE_CLASS_PREFIX) || !/^[A-Za-z0-9._:-]{1,128}$/.test(by))
    return row("MACHINE_CANNOT_SET_STAKE", localize("project-roster.index.a_stake_is_a_members", "a stake is a member's own words, set by a signed-in member. Nothing was written."),
      PROJECT_SCOPE_CHECKS.MACHINE_CANNOT_SET_STAKE.translation);
  if (stake !== null && ProjectRoster.stakeText(stake) === undefined)
    return row("STAKE_MALFORMED", localize("project-roster.index.the_stake_is_some_text", "the stake is some text of 1 to 1,000 characters on one line, or null to clear it. Nothing was written."), of === "action"
      ? (hasWord("refusal.STAKE_MALFORMED.action") ? word("refusal.STAKE_MALFORMED.action") : null)
      : PROJECT_SCOPE_CHECKS.STAKE_MALFORMED.translation);
  return null;
}

export class ProjectRoster {
  constructor({ sql, core = null, membership, clock = null } = {}) {
    this.sql = sql;
    this.core = core;
    this.m = membership;
    /* R28: the server's instant, `() => milliseconds`; the host may configure it, a request never does. */
    this.clock = typeof clock === "function" ? clock : () => Date.now();
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* A bundle's type and title, asked of record-core (its R34). */
  #bundle(bundleId) {
    const info = this.core && typeof this.core.bundleInfo === "function" ? this.core.bundleInfo(bundleId) : null;
    return info ? { type: info.type, title: typeof info.title === "string" ? info.title : null } : null;
  }

  /* This module's tables, at every boot, idempotent: every table and index created if absent (a store written before
     the split already holds them, as membership made them), then R18's purge declaration. Run by the host inside its
     boot, after membership's. */
  migrate() {
    const bare = PROJECT_ROSTER_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    this.declareTables();
  }

  /* R18, through record-core's `declarePurge` (its R21, R46): each table keyed to a bundle (the project) by
     `project_id`. A refusal is thrown, as membership's is: a purge that silently skipped these tables would leave the
     project's votes and requests behind. */
  declareTables() {
    if (this.#declared) return false;
    const answer = this.core.declarePurge("project-roster",
      PROJECT_ROSTER_TABLES.map((name) => ({ name, keys: ["project_id"] })));
    if (answer && answer.ok === false)
      throw new Error(`project-roster: record-core refused its purge declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }
  #declared = false;

  /* ===== R15, R16 — THE TWO NOTICES THIS MODULE TAKES FROM MEMBERSHIP (its R116, R117; R79's form) =====
   *
   * An invitation answers the invitee's open request to join (REC-226), and hiding a project lapses every open request
   * to it (REC-150). Both acts are membership's and the requests are this module's, so membership tells the one
   * registered listener inside its act, after its writes, and reads the number answered back: R116 puts
   * `request: "granted"` on its answer when it is at least 1, R117 puts it as `requests_lapsed`. Registered once, at
   * start (`projectRosterOf` calls it once per storage); each answer is membership's R81. Until membership offers a
   * slot there is nothing to register with, and its answer reads null. R22 (T45) registers the scope's guard in
   * membership's project-act guard (its R128) the same way. */
  start() {
    const invited = typeof this.m.onProjectInvited === "function"
      ? this.m.onProjectInvited("project-roster", (notice) => this.#invited(notice)) : null;
    const hidden = typeof this.m.onProjectHidden === "function"
      ? this.m.onProjectHidden("project-roster", (notice) => this.#hidden(notice)) : null;
    const guard = typeof this.m.registerProjectActGuard === "function"
      ? this.m.registerProjectActGuard("project-roster", (notice) => this.#guard(notice)) : null;
    return { invited, hidden, guard };
  }

  /* R15: the invitee's open request to that project, closed `granted` by the inviting owner at the act's time. A
     notice naming no member closes nothing: the statement below closes every open request of the project when the
     member is null, which is the lapse's form and never an invitation's. */
  #invited({ projectId, memberId, by = null, at = null } = {}) {
    if (typeof projectId !== "string" || !projectId || typeof memberId !== "string" || !memberId) return 0;
    return this.#closeJoinRequests(projectId, memberId, "granted", by ?? null, null, at ?? new Date().toISOString());
  }

  /* R16: every open request to the hidden project, closed `lapsed`, recorded with the owner who hid it and the date. */
  #hidden({ projectId, by = null, at = null } = {}) {
    if (typeof projectId !== "string" || !projectId) return 0;
    return this.#closeJoinRequests(projectId, null, "lapsed", by ?? null, null, at ?? new Date().toISOString());
  }

  /* ===== R17 (K861; plane R10) — THIS MODULE'S SHARE OF THE INSTANCE'S FIGURES =====
   *
   * The pending owner votes, so a purge can PROVE it took them (REC-27, D-137), shaped as record-core R63's
   * `counts(hid)` with its key list, which `plane` registers under this module's name; this module registers nothing
   * itself. `hid` is R63's: membership's `hiddenBundles(viewer)` (its R88), or null for a caller that sees every bundle
   * and for the direct internal call, which count whole. The table drops the rows whose `project_id` is in `hid` (D-464:
   * a count over rows the caller could not all read is a disclosure of existence). `COALESCE(project_id, '')`: a NULL
   * key names no bundle, and `NULL NOT IN (…)` is NULL, so without it the row would be dropped. Writes nothing. */
  static COUNT_KEYS = Object.freeze(["projectOwnerVotes"]);

  counts(hid = null) {
    const n = (table) => (hid
      ? this.#one(`SELECT count(*) c FROM ${table} WHERE COALESCE(project_id, '') NOT IN ${hid.sql}`, ...hid.args)
      : this.#one(`SELECT count(*) c FROM ${table}`)).c;
    return { projectOwnerVotes: n("project_owner_votes") };
  }

  /* ===== R19 — SIGHT BEFORE POSITION, AT EVERY ACT (membership R44, R61, R77) =====
   *
   * Every act naming a project asks, in this order: membership's `existenceAct` (C-70.1 at EXISTENCE, minted there and
   * relayed here), then whether the caller sees the project at all, answered as an id that names nothing
   * (`noSuchProject`, membership R78) when not, and only then the caller's position. Asked the other way round, the
   * positional refusal is the oracle. The roster acts' form of the sight question is membership's `rosterInSight`,
   * stated again here over `inSight` rather than imported: an ABSENT viewer (the parameter not sent: an internal caller,
   * a fixture, setup) is not asked; ANY viewer that was sent, an empty one included, is asked and fails closed. */
  #rosterInSight(projectId, viewer) {
    return viewer === null || viewer === undefined || this.m.inSight(projectId, viewer);
  }

  /* The project an owner's act names, or its refusal: C-70.1, the absent answer, or NOT_A_PROJECT. */
  #ownedProject(projectId, viewer, notAProject) {
    const b = this.#bundle(projectId);
    { const existence = b ? this.m.existenceAct(projectId, viewer) : null; if (existence) return existence; }
    if (!b || !this.#rosterInSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.type !== "project") return notAProject;
    return null;
  }

  /* D54 (K2408, K2409): an ADMINISTRATOR's sight of a project, asked of membership's one rule (its R43) for the member
     `by` names, never of a second copy of it: FULL of a discoverable project, and of a hidden one only when invited or
     joined. The founder is spelled `member:admin`, which R43 reads as the founder's viewer. For the reads that carry
     no viewer (R1) or must not trust a viewer for another person (R14). */
  #adminAtFull(projectId, by) {
    return this.m.isAdministrator(by) && this.m.inSight(projectId, `member:${by}`);
  }

  /* R5 (T41; D54): the rescue is the one act an administrator holds that is reachable at an administrator's EXISTENCE of
     a hidden project (membership R44, R60). That EXISTENCE is the only one a HIDDEN project has (membership R44: a
     member outside a hidden project is at NONE), so it is asked as EXISTENCE of a hidden project, a sight membership
     answers, and never as a second reading of who is an administrator. A viewer never sent is not asked. */
  #rescueAtExistence(projectId, viewer) {
    if (viewer === null || viewer === undefined) return false;
    const b = this.#bundle(projectId);
    return !!b && b.type === "project" && this.m.sight(projectId, viewer) === Membership.SIGHT_EXISTENCE
      && this.m.visibilityOf(projectId) === "hidden";
  }

  /* ===== R1, R2, R6 — THE ROSTER AND ITS RECORD (§7.7, §7.8, §7.10, §7.13; Bob's ruling of 2026-09-26) =====
   *
   * §7.8: every participant sees the handles of all other participants, and an administrator sees them of every project
   * it sees at FULL (D54: of a hidden project, only when invited or joined, so never a hidden project's participants
   * otherwise; membership R43). Anyone else sees nothing, and is told the same thing whether the project exists or not, because §7.9 says an
   * uninvited member cannot see that a project EXISTS. The ownership decisions (R6) and the removals an owner made (R2,
   * membership R36 writes them) are read here beside the participants, by the same readers. */
  projectParticipants({ projectId, by } = {}) {
    by = actorOf(by);
    const mine = this.m.participation(projectId, by);
    if (!mine && !this.#adminAtFull(projectId, by)) return noSuchProject(projectId);   /* membership R78 */
    /* R29: a name given to a reader is a handle, the founder's the one membership holds for her (null while none). */
    const handleOf = (id) => this.#handleOf(id);
    /* The founder, a participant once invited (D54) with no roster row, is listed by `founderHandle()` with
       `founder: true` (R29), never by her id. */
    /* T50 (R1; N1124): `joined_at`, membership's `since` (R127), and `owner_since`, the instant of the decision that made
       her an owner (R6; a rescue's), her `joined_at` for a founding owner, `null` for a non-owner and where none was
       recorded. `created` is neither. */
    const since = new Map(this.m.joinedParticipants(projectId).map((x) => [x.member, x.since ?? null]));
    const ownedAt = new Map(this.#rows(`SELECT target, at FROM project_owner_decisions
                                         WHERE project_id=? AND kind IN ('add','rescue') ORDER BY seq`, projectId)
      .map((d) => [d.target, d.at]));
    return { ok: true, projectId, participants: this.#roster([projectId]).get(projectId)
      .map((x) => ({ handle: x.handle, ...(x.founder ? { founder: true } : {}), state: x.state, owner: x.owner,
                     comment: x.comment, created: x.created, joined_at: since.get(x.member) ?? null,
                     owner_since: x.owner ? (ownedAt.get(x.member) ?? since.get(x.member) ?? null) : null })),
      /* R6: every ownership decision, with its deciders and reasons, in the order it was carried. */
      ownership: this.#rows(`SELECT kind, target, deciders, reasons, at FROM project_owner_decisions
                              WHERE project_id=? ORDER BY seq`, projectId).map((d) => ({
        kind: d.kind, handle: handleOf(d.target), deciders: JSON.parse(d.deciders).map(handleOf),
        reasons: JSON.parse(d.reasons), at: d.at })),
      /* R2: every removal an owner made: who removed whom, when, and the owner's reason. */
      removals: this.#rows(`SELECT member_id, removed_by, comment, at FROM project_removals
                             WHERE project_id=? ORDER BY seq`, projectId).map((x) => ({
        handle: handleOf(x.member_id), removedBy: handleOf(x.removed_by), reason: x.comment, at: x.at })),
      /* R21, R24 (T45): the scope's history and the second-approval setting's, each act with who made it and why. */
      scopes: this.#rows(`SELECT scope, reason, set_by, at FROM project_scopes WHERE project_id=? ORDER BY seq`, projectId)
        .map((x) => ({ scope: x.scope, reason: x.reason, by: handleOf(x.set_by), at: x.at })),
      approvals: this.#rows(`SELECT needs, reason, set_by, at FROM project_approval_settings WHERE project_id=?
                              ORDER BY seq`, projectId)
        .map((x) => ({ needs: JSON.parse(x.needs), reason: x.reason, by: handleOf(x.set_by), at: x.at })) };
  }

  /* R29: a member id shown where a handle is read: the founder's held handle (null while none), others by handle. */
  #handleOf(id) { return id === ROOT_ADMIN ? this.#founderHandle() : (this.m.memberFacts(id)?.handle ?? id); }

  /* R29: the founder's own handle, membership's (its R144); null while she holds none, and when membership offers none. */
  #founderHandle() {
    try {
      const h = typeof this.m.founderHandle === "function" ? this.m.founderHandle() : null;
      return typeof h === "string" && h !== "" ? h : null;
    } catch { return null; }
  }

  /* R45: a handle resolved to its member, the founder's held handle answering the founder (`admin`, active), so it never
     answers NO_SUCH_HANDLE; any other handle is membership's, null when no one holds it. */
  #memberOfHandle(handle) {
    const fh = this.#founderHandle();
    if (fh !== null && handle === fh) return { member_id: ROOT_ADMIN, handle: fh, status: "active" };
    return this.m.memberByHandle(handle);
  }

  /* R29: a member id shown where a handle is read: the founder's held handle (null while none), others as they are. */
  #nm(id) { return id === ROOT_ADMIN ? this.#founderHandle() : id; }

  /* R29: `{member, handle}` as a reader sees a member; the founder carries `founder: true` and her held handle, `null`
     while she holds none, never her id. */
  #person(member, handle) {
    return member === ROOT_ADMIN ? { member, handle: this.#founderHandle(), founder: true } : { member, handle };
  }

  /* R1, R28: every participant of each of `ids`, any state, as a Map project -> rows in R1's order (owners first, then
     by handle, the founder, who has none until she holds one, after the handles; then by id). Each row is
     `{member, handle, founder?, state, owner, comment, created}`; the founder has no roster row and is the one participant
     listed without one (D54). Membership's read contract (its R120): `project_participants` joined to `members`. */
  #roster(ids) {
    const out = new Map(ids.map((id) => [id, []]));
    if (!ids.length) return out;
    const fh = this.#founderHandle();
    for (const r of this.#rows(
      `SELECT p.project_id AS project, p.member_id AS member, m.handle AS handle, p.state, p.owner, p.comment, p.created
         FROM project_participants p LEFT JOIN members m ON m.member_id = p.member_id
        WHERE p.project_id IN (${ids.map(() => "?").join(",")}) AND (m.member_id IS NOT NULL OR p.member_id = ?)`,
      ...ids, ROOT_ADMIN))
      out.get(r.project).push(r.member === ROOT_ADMIN
        ? { member: r.member, handle: fh, founder: true, state: r.state, owner: r.owner, comment: r.comment, created: r.created }
        : { member: r.member, handle: r.handle ?? r.member, state: r.state, owner: r.owner, comment: r.comment, created: r.created });
    const key = (x) => (x.handle === null ? "￿" : x.handle);
    const less = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    for (const rows of out.values())
      rows.sort((a, b) => (b.owner - a.owner) || less(key(a), key(b)) || less(a.member, b.member));
    return out;
  }

  /* ===== R3–R7 — OWNERSHIP (§7.10, §7.13) =====
   *
   * Authority over a project belongs to its OWNERS, and to nobody else. An administrator sees every discoverable
   * project, and of a hidden one its id, name and owners unless added (§7.3, §7.8; D54), and directs none of them (§4.9), the single exception being §7.13, the rescue of a project whose owners are
   * all inactive (R5). The arithmetic is membership's `ownerMath` (its R38), read and never restated. */

  /* R3 (§7.10 addition). The sole owner may add a second unilaterally; every addition past that needs the consensus of
     ALL existing owners. Consensus on addition is the load-bearing half, exactly as in §4.7: without it one owner
     recruits confederates and manufactures the majority that then removes the others. */
  projectOwnerAdd({ projectId, handle, by, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT" }); if (refused) return refused; }
    if (!this.m.isProjectOwner(projectId, by))
      return { ok: false, reason: "NOT_THE_OWNER",
               detail: localize("project-roster.index.owner_add_needs_an_owner", "only an owner of this project may propose another owner of it") };
    const target = this.#memberOfHandle(handle);
    if (!target) return { ok: false, reason: "NO_SUCH_HANDLE", handle };
    if (target.status !== "active") return { ok: false, reason: "NOT_ACTIVE", handle };
    const p = this.m.participation(projectId, target.member_id);
    /* An owner is a JOINED participant with the owner flag. An invited member has not accepted a place in the project
       at all, so making them an owner would also make them joined without their act; one who has asked to leave is on
       the way out. Both, and a member with no participation, are refused as not joined: C-56.5. */
    /* DEC-49 REGION is-owner-target-joined */
    if (!p || p.state !== "joined") {
      const row = PROJECT_ROSTER_CHECKS.TARGET_NOT_JOINED;
      return { ok: false, reason: "TARGET_NOT_JOINED", code: "TARGET_NOT_JOINED", check: row.check,
               translation: row.translation, handle, ...(p ? { state: p.state } : {}),
               detail: localize("project-roster.index.owner_must_be_joined_first", "an owner is a joined participant with the owner flag, so the member joins the project first") };
    }
    /* END DEC-49 REGION is-owner-target-joined */
    if (p.owner) return { ok: false, reason: "ALREADY_AN_OWNER", handle };

    const owners = this.m.projectOwners(projectId);
    const now = this.#iso();
    this.sql.exec(
      `INSERT OR REPLACE INTO project_owner_votes (project_id,kind,target,voter,reason,created)
       VALUES (?,'add',?,?,NULL,?)`, projectId, target.member_id, by, now);

    /* The sole owner acts alone. Past that, every existing owner must have voted, and votes from members who are no
       longer owners do not count (R7). */
    if (owners.length > 1) {
      const have = this.#ownerVotes(projectId, "add", target.member_id, owners).map((v) => v.voter);
      const awaiting = owners.filter((o) => !have.includes(o));
      if (awaiting.length)
        return { ok: false, reason: "CONSENSUS_REQUIRED", projectId, handle,
                 have: have.sort().map((x) => this.#nm(x)), awaiting: awaiting.sort().map((x) => this.#nm(x)),
                 detail: localize("project-roster.index.owner_add_needs_every_owner", "every existing owner must agree to an addition beyond the second") };
    }
    const deciders = this.#ownerVotes(projectId, "add", target.member_id, owners).map((v) => v.voter).sort();
    this.m.participationWrite("ownerOn", { projectId, memberId: target.member_id, by, at: now });   /* membership R118 */
    this.#recordOwnerDecision(projectId, "add", target.member_id, deciders, [], now);
    this.sql.exec(`DELETE FROM project_owner_votes WHERE project_id=? AND kind='add' AND target=?`,
      projectId, target.member_id);
    return { ok: true, projectId, handle, owner: true, owners: this.m.projectOwners(projectId).sort().map((x) => this.#nm(x)),
             deciders: deciders.map((x) => this.#nm(x)) };
  }

  /* R5 (§7.13): the ONE participation power an administrator has, and its condition. Only owners manage participation,
     and administrators may deactivate members; together those strand a project whose only owner was deactivated. THE
     CONDITION IS EVERY OWNER, NOT ANY OWNER, so it cannot be manufactured piecemeal, and IT ADDS RATHER THAN REPLACES:
     the inactive owners keep their rows, so a reactivated one is an owner again alongside the added one, and nothing
     about this exception strips anyone. Its caller-and-project refusals are membership's `rescueRefusal` (its R75),
     asked here so the offer (affordances) and the act cannot disagree. */
  projectOwnerRescue({ projectId, handle, by, reason, viewer = null } = {}) {
    by = actorOf(by);
    /* Sight before position — so NOT_AN_ADMIN is said only to a member who can already see the project (an invited
       one). An administrator sees a discoverable project at FULL, and a hidden one it is not in at EXISTENCE, where
       the rescue alone stays reachable (D54; membership R60): there every answer below names only what that EXISTENCE
       shows (the id, the owners in `active` and `owners`) and the member named, never contents or other participants. */
    if (!this.#rescueAtExistence(projectId, viewer)) {
      const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT" });
      if (refused) return refused;
    }
    /* R22 (T45; Bob, K2782): a member's own project is never rescued. Asked after NOT_AN_ADMIN, so only an
       administrator learns it, and before the rescue's own refusals; it names nothing beyond the project's id. */
    const blocked = this.m.rescueRefusal(projectId, by);
    if (blocked && blocked.reason === "NOT_AN_ADMIN") return blocked;
    const named = (r) => { if (!r || typeof r !== "object") return r;
      const o = { ...r }; for (const k of ["active", "owners"]) if (Array.isArray(o[k])) o[k] = o[k].map((x) => this.#nm(x)); return o; };
    if (this.projectScope(projectId).scope === "own") return this.#scopeOwn(projectId, "rescue");
    if (blocked) return named(blocked);
    const why = String(reason ?? "").trim();
    if (!why) return { ok: false, reason: "NO_REASON", detail: localize("project-roster.index.rescue_needs_a_reason", "authority changes are recorded with a reason") };
    const target = this.#memberOfHandle(handle);
    if (!target) return { ok: false, reason: "NO_SUCH_HANDLE", handle };
    if (target.status !== "active") return { ok: false, reason: "NOT_ACTIVE", handle };

    const now = this.#iso();
    /* Recorded, and visible to every participant, like every other authority change: the §7.10 vote log with its own
       kind, so the project's ownership history reads in one place. */
    this.sql.exec(
      `INSERT OR REPLACE INTO project_owner_votes (project_id,kind,target,voter,reason,created)
       VALUES (?,'rescue',?,?,?,?)`, projectId, target.member_id, by, why, now);
    this.m.participationWrite("rescue", { projectId, memberId: target.member_id, by, comment: why, at: now });   /* R118 */
    this.#recordOwnerDecision(projectId, "rescue", target.member_id, [by], [why], now);
    return { ok: true, projectId, handle, by: this.#nm(by), reason: why, owner: true,
             owners: this.m.projectOwners(projectId).sort().map((x) => this.#nm(x)), addedNotReplaced: true,
             detail: localize("project-roster.index.the_inactive_owners_keep_their", "the inactive owners keep their rows. If one is reactivated they are an owner again alongside this one, and removing them is then the ordinary 7.10 process.") };
  }

  /* R4 (§7.10 removal). A majority of all owners, the target in the denominator and not voting, EXCEPT at exactly two
     owners where both must agree and the target is one of them. The floor is one owner. */
  projectOwnerRemove({ projectId, handle, by, reason, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT" }); if (refused) return refused; }
    if (!this.m.isProjectOwner(projectId, by))
      return { ok: false, reason: "NOT_THE_OWNER",
               detail: localize("project-roster.index.owner_remove_needs_an_owner", "only an owner of this project votes on its ownership") };
    const target = this.#memberOfHandle(handle);
    if (!target) return { ok: false, reason: "NO_SUCH_HANDLE", handle };
    if (!this.m.isProjectOwner(projectId, target.member_id))
      return { ok: false, reason: "NOT_AN_OWNER", handle };
    const why = String(reason ?? "").trim();
    if (!why) return { ok: false, reason: "NO_REASON", detail: localize("project-roster.index.owner_remove_needs_a_reason", "ownership changes are recorded with a reason") };

    /* DEC-49 REGION is-owner-floor — REC-64/C-33.28. */
    const owners = this.m.projectOwners(projectId);
    const math = Membership.ownerMath(owners.length);
    if (!math.possible)
      return { ok: false, reason: "LAST_OWNER", ...math,
               detail: localize("project-roster.index.one_owner_is_the_floor", "one owner is the floor, so the last owner of a project is not removable. Add another owner first, or deactivate the project (7.11).") };
    /* END DEC-49 REGION is-owner-floor */
    /* REC-224: a removal that would leave the project with owners who have ALL asked to leave is refused, naming them:
       the project would be left with nobody committed to running it. The code's row is membership's C-33.48. */
    const remaining = owners.filter((o) => o !== target.member_id);
    const committed = this.#committedOwners(projectId).filter((o) => o !== target.member_id);
    if (!committed.length)
      return { ok: false, reason: "LAST_COMMITTED_OWNER", ...math, leaving: remaining.sort().map((x) => this.#nm(x)),
               detail: localize("project-roster.index.removing_this_owner_would_leave", "removing this owner would leave only owners who have asked to leave ({map}), so nobody would be committed to the project. Add another owner first (7.10), or deactivate the project (7.11). Nothing was written.", { map: String(remaining.map((x) => this.#nm(x)).join(", ")) }) };
    /* At three and above the target does not vote. At two they must, which is the whole divergence from §4.7. */
    if (!math.targetMayVote && by === target.member_id)
      return { ok: false, reason: "TARGET_CANNOT_VOTE", ...math,
               detail: localize("project-roster.index.owner_remove_target_cannot_vote", "the target is counted in the denominator but does not vote") };

    if (this.#one(
      `SELECT voter FROM project_owner_votes WHERE project_id=? AND kind='remove' AND target=? AND voter=?`,
      projectId, target.member_id, by))
      return { ok: false, reason: "ALREADY_VOTED", by };
    const now = this.#iso();
    this.sql.exec(
      `INSERT INTO project_owner_votes (project_id,kind,target,voter,reason,created) VALUES (?,'remove',?,?,?,?)`,
      projectId, target.member_id, by, why, now);

    const counted = this.#ownerVotes(projectId, "remove", target.member_id, owners)
      .filter((v) => math.targetMayVote || v.voter !== target.member_id);
    const votes = counted.map((v) => v.voter);
    if (votes.length < math.votesNeeded)
      return { ok: false, reason: "VOTES_SHORT", projectId, handle,
               have: votes.length, need: math.votesNeeded, ...math, deciders: votes.sort().map((x) => this.#nm(x)) };

    /* Carried. They stay a PARTICIPANT: §7.10 says removing ownership leaves them on the project, and removing them
       from it entirely is then §7.7 (membership's `projectRemove`). */
    const reasons = counted.map((v) => v.reason).filter(Boolean);
    this.m.participationWrite("ownerOff", { projectId, memberId: target.member_id, by, at: now });   /* R118 */
    this.#recordOwnerDecision(projectId, "remove", target.member_id, [...votes].sort(), reasons, now);
    this.sql.exec(`DELETE FROM project_owner_votes WHERE project_id=? AND kind='remove' AND target=?`,
      projectId, target.member_id);
    return { ok: true, projectId, handle, owner: false, stillAParticipant: true,
             owners: this.m.projectOwners(projectId).sort().map((x) => this.#nm(x)),
             deciders: votes.sort().map((x) => this.#nm(x)), reasons };
  }

  /** R30 (T49; N1091; DEC-237 (3)): THE OWNER CHANGES NOT YET CARRIED, to a viewer at FULL of the project: each addition
   *  or removal that has a counted vote and is still short, `{change, target, proposed_by, proposed_at, agreed,
   *  awaiting}`, in the order first proposed. `agreed` is the owners whose votes count (R7), `awaiting` the owners whose
   *  vote would still count and is not in, as R3's `CONSENSUS_REQUIRED` and R4's count them (R4's target does not vote at
   *  three owners or more); `proposed_by` and `proposed_at` the first counted vote. Members are named by handle, the
   *  founder by `founderHandle()` (R29). A rescue is carried at once and is never pending. Any other viewer, existence
   *  only included, gets the absent answer. Writes nothing and never throws. */
  projectOwnerVotes({ projectId, viewer = null } = {}) {
    try {
      const b = this.#bundle(projectId);
      if (!b || !this.m.inSight(projectId, viewer)) return noSuchProject(projectId);
      if (b.type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
      const nameOf = (id) => this.#handleOf(id);
      const owners = this.m.projectOwners(projectId);
      const math = Membership.ownerMath(owners.length);
      const proposals = new Map();
      for (const v of this.#rows(
        `SELECT kind, target FROM project_owner_votes WHERE project_id=? AND kind IN ('add','remove')
          GROUP BY kind, target ORDER BY MIN(created), MIN(rowid)`, projectId)) {
        const stale = v.kind === "add" ? owners.includes(v.target) : !owners.includes(v.target);
        if (stale) continue;
        const counted = this.#ownerVotes(projectId, v.kind, v.target, owners)
          .filter((x) => v.kind === "add" || math.targetMayVote || x.voter !== v.target);
        if (!counted.length) continue;
        const voted = counted.map((x) => x.voter);
        const first = this.#one(
          `SELECT voter, created FROM project_owner_votes WHERE project_id=? AND kind=? AND target=? AND voter IN (${
            voted.map(() => "?").join(",")}) ORDER BY created, voter LIMIT 1`, projectId, v.kind, v.target, ...voted);
        const eligible = v.kind === "add" || math.targetMayVote ? owners : owners.filter((o) => o !== v.target);
        proposals.set(`${v.kind}\u0000${v.target}`, { change: v.kind, target: nameOf(v.target),
          proposed_by: nameOf(first.voter), proposed_at: first.created,
          agreed: [...voted].sort().map(nameOf), awaiting: eligible.filter((o) => !voted.includes(o)).sort().map(nameOf) });
      }
      return { ok: true, projectId, changes: [...proposals.values()] };
    } catch { return noSuchProject(projectId); }
  }

  /* The owners committed to the project: every owner who has not asked to leave (R4), read through membership's read
     contract (its R120). */
  #committedOwners(projectId) {
    return this.#rows(`SELECT member_id FROM project_participants WHERE project_id=? AND owner=1 AND state<>'leaving'`,
      projectId).map((r) => r.member_id);
  }

  /* R7 (N70): THE VOTES THAT COUNT on one proposal, `{voter, reason}` in voter order: those of the current `owners` (a
     former owner's vote does not count), joined in SQL to the participation (membership R120) and bounded by the owner
     count, which cuts nothing, since the table holds one row per voter per proposal (its key). */
  #ownerVotes(projectId, kind, target, owners) {
    return this.#rows(
      `SELECT v.voter, v.reason FROM project_owner_votes v
         JOIN project_participants p ON p.project_id = v.project_id AND p.member_id = v.voter AND p.owner = 1
        WHERE v.project_id=? AND v.kind=? AND v.target=? ORDER BY v.voter LIMIT ?`,
      projectId, kind, target, owners.length);
  }

  /* R6: a carried ownership decision, kept with its deciders and reasons. */
  #recordOwnerDecision(projectId, kind, target, deciders, reasons, at) {
    this.sql.exec(`INSERT INTO project_owner_decisions (project_id, kind, target, deciders, reasons, at)
                   VALUES (?,?,?,?,?,?)`, projectId, kind, target, JSON.stringify(deciders), JSON.stringify(reasons), at);
  }

  /* ===== R21–R24 (T45; Actions D4, D27; v0.2 rules 9, 15, 20) — A PROJECT'S SCOPE AND ITS SECOND APPROVAL =====
   *
   * Two settings on a project, each a member's act with a reason, appended and never rewritten; the latest governs.
   *   SCOPE     `counsel_matter` (its members alone see counsel's correspondence and dates; never published or used as
   *             evidence) or `own` (a member's own hidden project: her source role, her own text and its check), or
   *             `none`. Only a hidden project takes one. A scope is read at the act that would publish, cite or send,
   *             by the producers (R23), and never applied to anything already done.
   *   GUARD     membership asks this module before an invitation and a visibility change (its R128): an `own` project
   *             takes no invitation, and neither scope may be made discoverable. Its rescue is refused here (R22).
   *   APPROVAL  the acts that need a second member's approval before sending, set by an owner; enforced by `filings`.
   * Neither setting names a member: each is a fact about the project. */
  static PROJECT_SCOPES = Object.freeze(["counsel_matter", "own", "none"]);
  static REASON_MAX = 2000;

  /* A refusal with its C-147 row. */
  static #scopeRefusal(code, projectId, detail, extra = {}) {
    const row = PROJECT_SCOPE_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
             project: projectId ?? null, ...extra };
  }

  /* R21, R24: a reason is required, and bounded. Answers the trimmed reason, or null for absent, blank or too long. */
  static #reason(reason) {
    if (typeof reason !== "string") return null;
    const why = reason.trim();
    return why && why.length <= ProjectRoster.REASON_MAX ? why : null;
  }

  static #noReason(detail) {
    return { ok: false, reason: "NO_REASON", detail };
  }

  /* R22: PROJECT_SCOPE_OWN, minted here for the guard's invitation and relayed by the rescue (R5). It names the
     project's id and nothing else, so the rescue at an administrator's EXISTENCE says no more than that sight shows. */
  #scopeOwn(projectId, act) {
    /* DEC-49 REGION is-project-scope-guard */
    return ProjectRoster.#scopeRefusal("PROJECT_SCOPE_OWN", projectId, act === "rescue"
      ? localize("project-roster.index.this_is_a_members_own", "this is a member's own project (Action v0.2 rule 15), and it is never rescued: her source role and her own text stay hers, even when she can no longer act. Nothing was written.")
      : localize("project-roster.index.this_is_a_members_own_2", "this is a member's own project (Action v0.2 rule 15): nobody else is invited to it. Nothing was written."));
    /* END DEC-49 REGION is-project-scope-guard */
  }

  /* R22: THE GUARD membership calls inside an invitation (its R32) and a visibility change (its R45), after their own
     refusals and before any write (its R128). Answers a refusal, or null to let the act proceed. */
  #guard({ act, projectId, setting } = {}) {
    const { scope } = this.projectScope(projectId);
    if (act === "invite" && scope === "own") return this.#scopeOwn(projectId, "invite");
    /* DEC-49 REGION is-project-scope-guard */
    if (act === "visibility" && setting === "discoverable" && (scope === "counsel_matter" || scope === "own"))
      return ProjectRoster.#scopeRefusal("PROJECT_SCOPE_KEEPS_HIDDEN", projectId,
        localize("project-roster.index.this_project_is_v1_and", "this project is {v1}, and that scope keeps it hidden (Action v0.2 rule 15). Remove the scope first if it should be discoverable. Nothing was written.", { v1: String(scope === "own" ? "a member's own project" : "a counsel matter") }),
        { scope });
    /* END DEC-49 REGION is-project-scope-guard */
    return null;
  }

  /** R23: THE SCOPE, `{scope, since, by}`, the latest record's; `none` with no record and for an id that names no
   *  project. It asks no viewer (it states only the scope, as membership's `visibilityOf` states only the setting; its
   *  callers gate by sight), writes nothing and never throws. */
  projectScope(projectId) {
    try {
      if (typeof projectId !== "string" || !projectId) return { scope: "none", since: null, by: null };
      const r = this.#one(`SELECT scope, set_by, at FROM project_scopes WHERE project_id=? ORDER BY seq DESC LIMIT 1`,
        projectId);
      return r ? { scope: r.scope, since: r.at, by: r.set_by } : { scope: "none", since: null, by: null };
    } catch { return { scope: "none", since: null, by: null }; }
  }

  /** R21: SET A PROJECT'S SCOPE. Sight first (the Terms'), then position, then the scope's own refusals, each writing
   *  nothing. The participant is asked of membership's fence (its R55, `joined`) as the member `by` names, so a caller
   *  that is no member of the project, a machine credential or the founder included, is refused there. */
  projectScopeSet({ projectId, scope, reason, by, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT", project: projectId });
      if (refused) return refused; }
    const who = typeof by === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(by) ? by : "unnamed:caller";
    { const denied = this.m.projectAuthority(projectId, `member:${who}`, "joined", "projectscopeset");
      if (denied) return denied; }
    const refusal = (code, detail, extra) => ProjectRoster.#scopeRefusal(code, projectId, detail, extra);
    const current = this.projectScope(projectId).scope;
    /* DEC-49 REGION is-project-scope-set */
    if (!ProjectRoster.PROJECT_SCOPES.includes(scope))
      return refusal("PROJECT_SCOPE_UNKNOWN",
        localize("project-roster.index.stringify_is_not_a_scope", "{stringify} is not a scope: a project is a counsel matter (counsel_matter), a member's own project (own), or neither (none). Nothing was written.", { stringify: String(JSON.stringify(String(scope ?? "").slice(0, 40))) }));
    const why = ProjectRoster.#reason(reason);
    if (!why) return ProjectRoster.#noReason(
      localize("project-roster.index.scope_set_needs_a_reason", "a project's scope is set with a reason of at most {max} characters. Nothing was written.", { max: String(ProjectRoster.REASON_MAX) }));
    if (this.m.visibilityOf(projectId) !== "hidden")
      return refusal("PROJECT_SCOPE_NEEDS_HIDDEN",
        localize("project-roster.index.scope_needs_a_hidden_project", "a scope is set only on a hidden project (Action v0.2 rule 15); its owners set it hidden first. Nothing was written."));
    if (scope === "own" || current === "own") {
      const participants = this.#one(`SELECT COUNT(*) AS n FROM project_participants WHERE project_id=?`, projectId).n;
      if (!this.m.isProjectOwner(projectId, by) || participants !== 1)
        return refusal("PROJECT_SCOPE_OWN_NOT_SOLE",
          localize("project-roster.index.a_project_becomes_or_stops", "a project becomes, or stops being, a member's own project only by its owner while that owner is its one participant, in any state. Nothing was written."));
    }
    if (scope === current)
      return refusal("PROJECT_SCOPE_UNCHANGED", localize("project-roster.index.the_projects_scope_is_already", "the project's scope is already {scope}. Nothing was written.", { scope: String(scope) }));
    /* END DEC-49 REGION is-project-scope-set */
    const at = new Date().toISOString();
    this.sql.exec(`INSERT INTO project_scopes (project_id, scope, reason, set_by, at) VALUES (?,?,?,?,?)`,
      projectId, scope, why, by, at);
    return { ok: true, projectId, scope, previous: current, reason: why, by, at,
             detail: localize("project-roster.index.the_scope_applies_from_now", "the scope applies from now on, to every act that would publish, cite or send; nothing already published, sent or cited changes.") };
  }

  /* R24: the active profiles' view (record-core's `getSetting`, `jurisdictions.combine`), for its `{kind}` entries;
     an empty view when none is active or the setting cannot be read, so every kind is then unknown. */
  #actionKinds() {
    let ids = null;
    try { ids = this.core && typeof this.core.getSetting === "function" ? this.core.getSetting("jurisdiction_profiles") : null; }
    catch { ids = null; }
    const c = combine(Array.isArray(ids) ? ids : []);
    const kinds = c && c.ok && Array.isArray(c.view.action_kinds) ? c.view.action_kinds : [];
    return new Set(kinds.map((k) => k && k.kind).filter((k) => typeof k === "string"));
  }

  /* R24: an entry is exactly one of `{kind}`, `{tier}` (1, 2 or 3) or `{public: true}`; answers it normalised, or null. */
  static #approvalEntry(e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    const keys = Object.keys(e);
    if (keys.length !== 1) return null;
    if (keys[0] === "kind") return typeof e.kind === "string" && /^[a-z][a-z0-9_]*$/.test(e.kind) ? { kind: e.kind } : null;
    if (keys[0] === "tier") return [1, 2, 3].includes(e.tier) ? { tier: e.tier } : null;
    if (keys[0] === "public") return e.public === true ? { public: true } : null;
    return null;
  }

  /** R24: SET WHICH ACTS NEED A SECOND MEMBER'S APPROVAL. An owner's act (administrators and the founder included, as
   *  R3), after sight; each entry checked, then each kind against the active profiles' view, then the reason. */
  projectApprovalSet({ projectId, needs, reason, by, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT", project: projectId });
      if (refused) return refused; }
    if (!this.m.isProjectOwner(projectId, by))
      return { ok: false, reason: "NOT_THE_OWNER",
               detail: localize("project-roster.index.approval_set_needs_an_owner", "only an owner of this project sets which of its acts need a second member's approval") };
    const refusal = (code, detail, extra) => ProjectRoster.#scopeRefusal(code, projectId, detail, extra);
    /* DEC-49 REGION is-project-approval-set */
    if (!Array.isArray(needs))
      return refusal("APPROVAL_RULE_INVALID", localize("project-roster.index.approval_rules_are_a_list", "the rules are a list, empty to restore one member's approval. Nothing was written."),
        { entry: null, index: null });
    const clean = [];
    for (const [i, e] of needs.entries()) {
      const n = ProjectRoster.#approvalEntry(e);
      if (!n)
        return refusal("APPROVAL_RULE_INVALID", localize("project-roster.index.approval_rule_is_not_valid", "rule {n} is not one of {kind}, {tier} (1, 2 or 3) or {public: true}. Nothing was written.", { n: String(i + 1), kind: "{kind}", tier: "{tier}" }),
          { entry: e ?? null, index: i });
      clean.push(n);
    }
    const held = clean.some((n) => n.kind) ? this.#actionKinds() : new Set();
    for (const [i, n] of clean.entries())
      if (n.kind && !held.has(n.kind))
        return refusal("APPROVAL_KIND_UNKNOWN", localize("project-roster.index.stringify_is_not_a_kind", "{stringify} is not a kind of action in your team's active jurisdiction profiles. Nothing was written.", { stringify: String(JSON.stringify(n.kind)) }), { entry: n, index: i });
    /* END DEC-49 REGION is-project-approval-set */
    const why = ProjectRoster.#reason(reason);
    if (!why) return ProjectRoster.#noReason(
      localize("project-roster.index.approval_set_needs_a_reason", "a project's approval setting is set with a reason of at most {max} characters. Nothing was written.", { max: String(ProjectRoster.REASON_MAX) }));
    const at = new Date().toISOString();
    this.sql.exec(`INSERT INTO project_approval_settings (project_id, needs, reason, set_by, at) VALUES (?,?,?,?,?)`,
      projectId, JSON.stringify(clean), why, by, at);
    return { ok: true, projectId, needs: clean, reason: why, by, at,
             detail: clean.length ? localize("project-roster.index.the_acts_these_rules_match", "the acts these rules match need a second member's approval before sending.")
               : localize("project-roster.index.one_member_approves_every_act", "one member approves every act, the default.") };
  }

  /** R24: DOES AN ACT NEED A SECOND APPROVAL? `{needed, matched}`, `matched` the latest setting's entries that apply:
   *  a `{kind}` entry naming `kind`; a `{tier}` entry equal to `tier`, and every `{tier}` entry when the tier is null
   *  or undetermined (anything but 1, 2 or 3: an undetermined tier is never read as Tier 1, v0.2 §6); `{public: true}`
   *  when `public` is true. No setting, or an id naming nothing, needs none. Writes nothing and never throws. */
  secondApprovalNeeded({ projectId, kind = null, tier = null, public: audience = false } = {}) {
    try {
      const r = typeof projectId === "string" && projectId
        ? this.#one(`SELECT needs FROM project_approval_settings WHERE project_id=? ORDER BY seq DESC LIMIT 1`, projectId)
        : null;
      const needs = r ? JSON.parse(r.needs) : [];
      const undetermined = ![1, 2, 3].includes(tier);
      const matched = needs.filter((n) => ("kind" in n && n.kind === kind)
        || ("tier" in n && (undetermined || n.tier === tier))
        || ("public" in n && audience === true));
      return { needed: matched.length > 0, matched };
    } catch { return { needed: false, matched: [] }; }
  }

  /* ===== R31, R32 (T50; N933; K3230) — THE PROJECT'S DECLARED STAKE =====
   *
   * The team's own words on what it has at stake in this matter beyond its usual stake (`instance-setup` R77), appended
   * with who set it and when; the latest entry is the stake, `null` clears it. It is read at the act that sends or
   * publishes, never applied to anything already signed, sent or published. */
  static STAKE_MAX = 1000;

  /* R31: trimmed text of 1 to 1,000 characters on one line, no control characters; answers it, or undefined. */
  static stakeText(stake) {
    if (typeof stake !== "string") return undefined;
    const t = stake.trim();
    return t.length >= 1 && t.length <= ProjectRoster.STAKE_MAX && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(t)
      ? t : undefined;
  }

  /** R31: SET OR CLEAR THE PROJECT'S STAKE. Sight first (the Terms'), then a machine credential, then position (joined,
   *  or an administrator at FULL sight), then the text; each refusal writes nothing. */
  projectStakeSet({ projectId, stake, by, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT", project: projectId });
      if (refused) return refused; }
    /* DEC-49 REGION is-project-stake-set */
    const fault = stakeFault({ by, stake, of: "project", projectId });
    if (fault && fault.reason === "MACHINE_CANNOT_SET_STAKE") return fault;
    if (!this.#adminAtFull(projectId, by)) {
      const denied = this.m.projectAuthority(projectId, `member:${by}`, "joined", "projectstakeset");
      if (denied) return denied;
    }
    if (fault) return fault;
    const text = stake === null ? null : ProjectRoster.stakeText(stake);
    /* END DEC-49 REGION is-project-stake-set */
    const at = this.#iso();
    this.sql.exec(`INSERT INTO project_stakes (project_id, stake, set_by, at) VALUES (?,?,?,?)`, projectId, text, by, at);
    return { ok: true, projectId, stake: text, by: this.#handleOf(by), at };
  }

  /** R32: THE STAKE, `{stake, set_by, set_at, history}`, history oldest first, each `{stake, set_by, set_at}`; none for
   *  a project with no record and for an id naming nothing; `"undetermined"` for a record that cannot be read. Asks no
   *  viewer (its callers gate by sight), writes nothing, never throws. */
  projectStake(projectId) {
    const none = { stake: null, set_by: null, set_at: null, history: [] };
    try {
      if (typeof projectId !== "string" || !projectId) return none;
      const rows = this.#rows(`SELECT stake, set_by, at FROM project_stakes WHERE project_id=? ORDER BY seq`, projectId);
      if (rows.some((r) => r.stake !== null && typeof r.stake !== "string")) return { ...none, stake: "undetermined" };
      const history = rows.map((r) => ({ stake: r.stake, set_by: this.#handleOf(r.set_by), set_at: r.at }));
      const last = history.at(-1);
      return last ? { stake: last.stake, set_by: last.set_by, set_at: last.set_at, history } : none;
    } catch { return { ...none, stake: "undetermined" }; }
  }

  /** R32: EVERY PARTICIPANT READS THE HISTORY, as R8 reads visibility: a caller at FULL gets it, any other the absent answer. */
  projectStakeHistory({ projectId, viewer = null } = {}) {
    const b = this.#bundle(projectId);
    if (!b || !this.m.inSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
    return { ok: true, projectId, ...this.projectStake(projectId) };
  }

  /** R33 (T50; N1124): WHETHER THE PROJECT'S OWNERS ARE ALL GONE, to a caller who may be offered R5's rescue: an active
   *  administrator or the founder, at FULL sight or at an administrator's EXISTENCE of a hidden project. `gone` is
   *  membership's `rescueRefusal` (R75) null; `since` the later of the owners' last status instants, null when not gone
   *  or not recorded. Any other caller and a project naming nothing: the absent answer. Writes nothing, never throws. */
  projectOwnersGone({ projectId, viewer = null } = {}) {
    try {
      const b = this.#bundle(projectId);
      const asker = viewer === ROOT_ADMIN ? ROOT_ADMIN : viewerPredicate(viewer).member;
      if (!b || !asker || !this.m.isAdministrator(asker)) return noSuchProject(projectId);
      if (!this.m.inSight(projectId, viewer) && !this.#rescueAtExistence(projectId, viewer)) return noSuchProject(projectId);
      if (b.type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
      const gone = this.m.rescueRefusal(projectId, asker) === null;
      return { ok: true, projectId, gone, since: gone ? this.#inactiveSince(this.m.projectOwners(projectId)) : null };
    } catch { return noSuchProject(projectId); }
  }

  /* R33 (K3624): the instant the last of `ids` stopped being active: the latest of membership's `memberStatusSince`
     (its R152), null when any owner's is null (or membership offers none), no other instant standing in for it. */
  #inactiveSince(ids) {
    if (typeof this.m.memberStatusSince !== "function") return null;
    const at = ids.map((id) => this.m.memberStatusSince(id));
    if (!at.length || at.some((x) => typeof x !== "string")) return null;
    return at.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
  }

  /* ===== R8, R9 — THE VISIBILITY HISTORY AND THE DIRECTORY (§7.14) ===== */

  /** R8: THE SETTING AND ITS HISTORY, for a caller with FULL sight (a participant, an administrator, the founder:
   *  §7.14, "administrators and the founder see the setting and its history"). A READ, so it does not widen: a caller
   *  without full sight is answered as for a project that does not exist. The setting is membership's `visibilityOf`
   *  (its R85), the one reading of the sight index; the history its act log (its R120). */
  projectVisibility({ projectId, viewer = null } = {}) {
    const b = this.#bundle(projectId);
    if (!b || !this.m.inSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
    /* T50 (R8; N1124): `set_by` by handle, the founder as R29 names her, never her id `admin`. */
    const history = this.#rows(
      `SELECT setting, set_by, reason, at FROM project_visibility WHERE project_id=? ORDER BY seq`, projectId)
      .map((h) => ({ ...h, set_by: this.#handleOf(h.set_by) }));
    return { ok: true, projectId, setting: this.m.visibilityOf(projectId), recorded: history.length > 0, history,
             note: history.length ? undefined : word("project-roster.note.owner_set_project") };
  }

  /** R9: THE DIRECTORY (§7.14 "The directory"): for a member session, the DISCOVERABLE projects it does not see at FULL,
   *  each with its id and name and the state of the caller's OWN latest request to it (null only where it has never
   *  asked). A hidden project is never in it, so its absence is one answer for "hidden" and "does not exist". A viewer
   *  naming no member has no directory: it is refused by name, never answered empty.
   *
   *  ONE STATEMENT, BOUNDED ON WHAT GROWS (D-479, D-497). The DISCOVERABLE half joins membership's sight index
   *  (`project_sight`, its R120), the same rows its `visibilityOf` reads, so the rule about what an owner's acts mean is
   *  stated once (membership's `reindexProjectSight`) and read here. The NOT-FULL half is membership's own compiled
   *  `viewerPredicate` (its R43), NEGATED — never a hand copy: over rows already fixed to existing projects, `NOT (gate)`
   *  is exactly sight below FULL, and never NULL (each disjunct is a comparison FALSE for a project, or an EXISTS). The
   *  member refusal guarantees the gate is never `0=1`; it is `1=1` only for the founder's `member:admin`, who sees
   *  every project at FULL, so `NOT (1=1)` lists none, which is the answer. Under D54 (membership R43) the founder's and an
   *  administrator's gate withholds only hidden projects they are not in, and a hidden project is never listed here, so
   *  they too are listed none.
   *
   *  R44 (fix round 10; K5157): `request` is the latest in ANY state, `{state, asked, closed, closed_comment}`, the last two
   *  null until it is answered, so a requester whose request was declined is told, and with the owner's word.
   *
   *  `limit` is the cap APPLIED, the caller's to lower and never to raise; `truncated` is MEASURED by reading one row
   *  past it, never derived from the page (a full page and a complete answer read alike). The page is the first `limit`
   *  in `bundle_id` order, so a page means the same thing twice. */
  projectDirectory({ viewer = null, limit = null } = {}) {
    /* T50 (R9; N1129): the founder's viewer, bare `admin` or `member:admin`, names a member here. */
    const gate = viewerPredicate(viewer === ROOT_ADMIN ? `member:${ROOT_ADMIN}` : viewer);
    const member = gate.member;
    const refusal = (code, detail) => {
      const row = PROJECT_ROSTER_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail };
    };
    /* DEC-49 REGION is-project-directory-member */
    if (!member)
      return refusal("PROJECT_DIRECTORY_NEEDS_A_MEMBER",
        localize("project-roster.index.the_project_directory_lists_the", "the project directory lists the discoverable projects a MEMBER is not in, so it is asked by a signed-in member. A credential with no member behind it is outside no project, and an empty list would say something untrue about the record."));
    /* END DEC-49 REGION is-project-directory-member */
    const cap = ProjectRoster.#cap(limit, ProjectRoster.PROJECT_DIRECTORY_LIMIT);
    /* `request` is the caller's own latest request to each listed project, joined in the SAME statement, so the page
       and its requests cannot disagree. Only the caller's own row is joined: whose else has asked is not a fact the
       directory holds. A granted request never appears: a grant makes the caller a participant, at FULL sight. */
    const projects = this.#rows(
      `SELECT b.bundle_id AS id, r.state AS rstate, r.asked_at AS rasked, r.closed_at AS rclosed,
              r.closed_comment AS rcomment
         FROM bundles b JOIN project_sight s ON s.project_id = b.bundle_id
         LEFT JOIN project_join_requests r
           ON r.seq = (SELECT MAX(r2.seq) FROM project_join_requests r2
                        WHERE r2.member_id = ? AND r2.project_id = b.bundle_id)
        WHERE b.object_type = 'project' AND s.setting = 'discoverable' AND NOT (${gate.sql})
        ORDER BY b.bundle_id
        LIMIT ?`, member, ...gate.args, cap + 1)
      .map((r) => ({ id: r.id, name: this.#bundle(r.id)?.title ?? null,
                     request: r.rstate ? { state: r.rstate, asked: r.rasked, closed: r.rclosed ?? null, closed_comment: r.rcomment ?? null } : null }));
    const truncated = projects.length > cap;
    /* Cut by a slice at the published cap, so the collection `truncated` was measured over stays beside the page. */
    const page = truncated ? projects.slice(0, cap) : projects;
    return { ok: true, projects: page, count: page.length, limit: cap, truncated };
  }

  /* D-479: THE DIRECTORY'S PAGE SIZE, a chosen ceiling and never a finding: generous enough that a member browsing for
     one project to ask to join rarely meets it, published whenever it cuts. It may be lowered, never raised (R9). */
  static PROJECT_DIRECTORY_LIMIT = 200;

  /** R26 (T47; N972): THE PROJECTS A VIEWER SEES AT FULL, each `{id, name, stage}`, in id order: the read Home draws
   *  "What the group is working on" from, and the complement of R9's directory. Which projects is membership's one rule
   *  (its R43, compiled by `viewerPredicate`), never a copy: a member's own projects in any state, an active
   *  administrator's and the founder's discoverable ones too (and a hidden one only when invited or joined, D54), every
   *  project for a machine credential, and none for a viewer the rule admits to nothing (none sent, or unrecognised),
   *  which is an empty list and never a refusal: an empty list is true of what that viewer sees.
   *
   *  `stage` is the project document's recorded `current_state` (record-core R37) as recorded, null when none is: not
   *  `project-stage`'s derived stage, a later module this one cannot use. `name` is its title (record-core R34). The
   *  question count is R42's (it was Home's, from basis-versions' read, one per project). `limit` and `truncated` are
   *  R9's rule. Writes nothing.
   *
   *  R27 (T47; DEC-201 `projects`): each project's `owner`, the member who opened it (its first author, as the record
   *  states), `{member, handle}`, the founder's as R29 names her, or null when that opener is no
   *  longer an active member or names none; nothing else about them.
   *
   *  R34 (T50): each row's `participation`, the viewer's own state.
   *
   *  R38 (T51; N1184, DEC-340): each row's `mine`, `{in, owner}` (the viewer's own stamp only: `in` joined to it, `owner`
   *  holding its owner flag, membership R54, R65) and `scope` (R23's, `none`, `own` or `counsel_matter`).
   *
   *  R42 (fix round 3; C14): each row's `question_count` (`#questionCounts`) and `shared_drafts` `{count, newest}` from
   *  the `sharedDraftsOf` reader the caller hands in (`null` on every row when none is), both null on a row seen only
   *  at an administrator's EXISTENCE (R39).
   *
   *  R28 (T47; N1025; DEC-214 (3)): each project's `members`, eight weeks' `activity` and `lastChange`, by the viewer's
   *  sight (`#projectFacts`). */
  projectList(asked = {}) {
    const { viewer = null, limit = null, after = null, sharedDraftsOf = null } = asked && typeof asked === "object" ? asked : {};
    const gate = viewerPredicate(viewer);
    /* R36: `after` is a project id, read only when a non-empty string; anything else starts from the first. */
    const cursor = typeof after === "string" && after !== "" ? after : null;
    const cap = ProjectRoster.#cap(limit, ProjectRoster.PROJECT_LIST_LIMIT);
    /* R27: the opener joined in the same statement, so the page and its owners cannot disagree: the project's first
       manifest entry's `author` (record-core R37: `manifest`, first by `created`, then `rowid`, the order it recorded
       them), matched to an ACTIVE row of membership's `members` (its R120). The founder has no roster row and is
       answered as the founder, by her handle (R29; K3074). An opener revoked or not yet active, a
       machine's creation (whose author names no member) and a project with no entry join nothing, and answer null. */
    const rows = this.#rows(
      `SELECT b.bundle_id AS id, b.current_state AS state, o.member_id AS owner, o.handle AS owner_handle,
              b.opener = ? AS founder
         FROM (SELECT b.*, (SELECT x.author FROM manifest x WHERE x.bundle_id = b.bundle_id
                             ORDER BY x.created, x.rowid LIMIT 1) AS opener
                 FROM bundles b WHERE b.object_type = 'project') b
         LEFT JOIN members o ON o.status = 'active' AND o.member_id = b.opener
        WHERE b.object_type = 'project' AND (${gate.sql}) AND (? IS NULL OR b.bundle_id > ?)
        ORDER BY b.bundle_id
        LIMIT ?`, ROOT_ADMIN, ...gate.args, cursor, cursor, cap + 1);
    /* R39 (T51 fix round; C84): an administrator's list also holds each hidden project the rescue is open to her for,
       merged into R26's rows in id order, so paging counts them as it counts any row. */
    const asker = viewer === ROOT_ADMIN ? ROOT_ADMIN : gate.member;
    const admin = !!asker && this.m.isAdministrator(asker);
    const rescue = admin ? this.#rescueOpenRows(asker, viewer, gate, cursor, cap + 1) : [];
    const merged = rescue.length ? [...rows, ...rescue].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, cap + 1) : rows;
    const truncated = merged.length > cap;
    const both = truncated ? merged.slice(0, cap) : merged;
    const open = new Set(rescue.map((r) => r.id));
    const page = both.filter((r) => !open.has(r.id));
    const { members, activity, lastChange } = this.#projectFacts(page.map((r) => r.id), gate);
    /* R42 (fix round 3; C14, P2.2): each project's question count, for the page in two statements, and its shared drafts,
       from the reader the caller handed in, asked once for the page. */
    const questions = this.#questionCounts(page.map((r) => r.id), gate);
    const shared = this.#sharedDrafts(sharedDraftsOf, page.map((r) => r.id), viewer);
    /* R34 (T50; N1118): the viewer's own state in each project as membership records it; null for a non-participant. */
    const me = viewer === ROOT_ADMIN ? ROOT_ADMIN : gate.member;
    const own = new Map(me && page.length ? this.#rows(
      `SELECT project_id, state, owner FROM project_participants WHERE member_id=? AND project_id IN (${page.map(() => "?").join(",")})`,
      me, ...page.map((r) => r.id)).map((x) => [x.project_id, x]) : []);
    /* R38 (T51; N1184): each project's scope, the latest record's (R23's rule, read for the page in one statement). */
    const scopes = new Map(page.length ? this.#rows(
      `SELECT project_id, scope FROM project_scopes WHERE project_id IN (${page.map(() => "?").join(",")}) ORDER BY seq`,
      ...page.map((r) => r.id)).map((x) => [x.project_id, x.scope]) : []);
    const projects = both.map((r) => open.has(r.id)
      /* R39: at an administrator's EXISTENCE of the project, nothing of it beyond its id and name, and the mark. */
      ? { id: r.id, participation: null, mine: { in: false, owner: false }, scope: null, name: this.#bundle(r.id)?.title ?? null,
          stage: null, owner: null, members: [], activity: Array(ProjectRoster.ACTIVITY_WEEKS).fill(0), lastChange: null,
          rescue_open: true, question_count: null, shared_drafts: null }
      : { id: r.id, participation: own.get(r.id)?.state ?? null,
      mine: { in: own.get(r.id)?.state === "joined", owner: !!own.get(r.id)?.owner },
      scope: scopes.get(r.id) ?? "none",
      name: this.#bundle(r.id)?.title ?? null, stage: typeof r.state === "string" && r.state !== "" ? r.state : null,
      owner: r.founder ? this.#person(ROOT_ADMIN, null)
        : r.owner ? { member: r.owner, handle: r.owner_handle ?? null } : null,
      members: members.get(r.id) ?? [], activity: activity.get(r.id) ?? Array(ProjectRoster.ACTIVITY_WEEKS).fill(0),
      lastChange: lastChange.get(r.id) ?? null, ...(admin ? { rescue_open: false } : {}),
      question_count: questions.get(r.id) ?? 0, shared_drafts: shared === null ? null : shared.get(r.id) ?? { count: 0, newest: null } });
    return { ok: true, projects, count: projects.length, limit: cap, truncated,
             next: truncated ? projects[projects.length - 1].id : null };
  }

  /* R39 (T51 fix round; C84): THE HIDDEN PROJECTS THE RESCUE IS OPEN TO `asker` FOR, up to `n`, in id order after `cursor`:
     the project is hidden and `viewer`'s sight of it is EXISTENCE (`#rescueAtExistence`, R5's), membership's
     `rescueRefusal` answers null (an administrator, owner rows, every owner inactive) and its scope is not `own` (R22).
     The statement only narrows what is read to hidden projects below FULL sight whose owners are all inactive; each is
     then asked of the act's own predicates, so the mark and the act cannot disagree. Writes nothing. */
  #rescueOpenRows(asker, viewer, gate, cursor, n) {
    const out = [];
    for (const c of this.#rows(
      `SELECT b.bundle_id AS id FROM bundles b JOIN project_sight s ON s.project_id = b.bundle_id
        WHERE b.object_type = 'project' AND s.setting = 'hidden' AND NOT (${gate.sql}) AND (? IS NULL OR b.bundle_id > ?)
          AND EXISTS (SELECT 1 FROM project_participants o WHERE o.project_id = b.bundle_id AND o.owner = 1)
          AND NOT EXISTS (SELECT 1 FROM project_participants o JOIN members om ON om.member_id = o.member_id AND om.status = 'active'
                           WHERE o.project_id = b.bundle_id AND o.owner = 1)
        ORDER BY b.bundle_id`, ...gate.args, cursor, cursor)) {
      if (out.length >= n) break;
      if (!this.#rescueAtExistence(c.id, viewer) || this.m.rescueRefusal(c.id, asker) !== null
          || this.projectScope(c.id).scope === "own") continue;
      out.push({ id: c.id });
    }
    return out;
  }

  /** R42 (fix round 3; C14, P2.2): THE QUESTION COUNT of each of `ids` (already those the viewer sees at FULL), a Map project
   *  -> count, in two statements however many projects there are: the inquiries the project draws on, by basis-versions
   *  R41's own test (its document holds a `cites` reference to the inquiry not marked `severed`), restated here over
   *  record-core's read contract (R37: `files.content` of `bundle.md`, `bundles.object_type`), since that module is a
   *  later one. A target counts when the record holds it as an inquiry and the viewer's sight (`gate`, membership R43, the
   *  rule R50 applies) admits it; distinct targets once. A store without the table, an unreadable document or a failing
   *  statement reads as none. Writes nothing; never throws. */
  #questionCounts(ids, gate) {
    const counts = new Map();
    if (!ids.length) return counts;
    try {
      const cited = new Map();
      for (const d of this.#rows(`SELECT bundle_id AS project, content FROM files WHERE path='bundle.md' AND bundle_id IN (${
        ids.map(() => "?").join(",")})`, ...ids)) {
        let fm = {};
        try { fm = typeof d.content === "string" ? parseFrontmatter(d.content).data || {} : {}; } catch { fm = {}; }
        const live = [...new Set((Array.isArray(fm.references) ? fm.references : [])
          .filter((x) => x && typeof x === "object" && x.rel === "cites" && x.status !== "severed")
          .map((x) => String(x.target ?? "").trim()).filter(Boolean))];
        if (live.length) cited.set(d.project, live);
      }
      const targets = [...new Set([...cited.values()].flat())];
      if (!targets.length) return counts;
      const seen = new Set(this.#rows(
        `SELECT b.bundle_id AS bundle_id FROM bundles b WHERE b.bundle_id IN (SELECT value FROM json_each(?))
            AND b.object_type IN (SELECT value FROM json_each(?)) AND (${gate.sql})`,
        JSON.stringify(targets), ProjectRoster.INQUIRY_TYPES, ...gate.args).map((r) => r.bundle_id));
      for (const [project, live] of cited) counts.set(project, live.filter((t) => seen.has(t)).length);
    } catch { counts.clear(); }
    return counts;
  }

  /** R42: THE SHARED DRAFTS of each of `ids`, a Map project -> `{count, newest}`, from `reader`, the one the caller hands
   *  in (`review` R43's `sharedDraftsByProject({projectIds, viewer})`, wired by the door, control-plane R118), asked once
   *  for the whole page. `null` (not a Map) when no reader was handed in or it failed, so every row answers `null`. An
   *  entry the reader leaves out, or cannot be read as `{count, newest}`, is `{count: 0, newest: null}`. Never throws. */
  #sharedDrafts(reader, ids, viewer) {
    if (typeof reader !== "function") return null;
    const out = new Map();
    if (!ids.length) return out;
    let got = null;
    try { got = reader({ projectIds: ids, viewer }); } catch { return null; }
    if (!got || typeof got !== "object") return null;
    for (const id of ids) {
      const e = Object.hasOwn(got, id) ? got[id] : null;
      out.set(id, e && Number.isInteger(e.count) && e.count > 0
        ? { count: e.count, newest: typeof e.newest === "string" ? e.newest : null } : { count: 0, newest: null });
    }
    return out;
  }

  /* Every stored `object_type` spelling of an inquiry, the declared one and its legacy aliases (basis-versions' own). */
  static INQUIRY_TYPES = JSON.stringify(["inquiry", ...Object.keys(LEGACY_TYPE_ALIASES)
    .filter((t) => LEGACY_TYPE_ALIASES[t] === "inquiry")]);

  /** R35 (T51; N1209): THE VIEWER'S OWN INVITATIONS, each project where her participation is `invited`, `{projectId, name,
   *  invited_by, invited_at}` in project id order; `invited_by` is `{member, handle}` (the founder as R29 names her) or
   *  null when none was recorded or it names no member. Only her own rows; a viewer naming no active member gets an empty
   *  list. Paged as R36 pages (`after`, `next`). Writes nothing, never throws. */
  projectInvitations(asked = {}) {
    const { viewer = null, limit = null, after = null } = asked && typeof asked === "object" ? asked : {};
    const cap = ProjectRoster.#cap(limit, ProjectRoster.PROJECT_INVITATIONS_LIMIT);
    const empty = { ok: true, invitations: [], count: 0, limit: cap, truncated: false, next: null };
    try {
      const me = viewer === ROOT_ADMIN ? ROOT_ADMIN : viewerPredicate(viewer).member;
      if (!me || !this.#activeMemberRow(me)) return empty;
      const cursor = typeof after === "string" && after !== "" ? after : null;
      /* `invited_by` is part of membership's read contract (its R120, amended T51, K3838); read here and nowhere else. */
      const rows = this.#rows(
        `SELECT p.project_id AS id, p.created AS at, p.invited_by AS by_id, i.member_id AS inviter, i.handle AS inviter_handle
           FROM project_participants p JOIN bundles b ON b.bundle_id = p.project_id AND b.object_type = 'project'
           LEFT JOIN members i ON i.member_id = p.invited_by
          WHERE p.member_id = ? AND p.state = 'invited' AND (? IS NULL OR p.project_id > ?)
          ORDER BY p.project_id LIMIT ?`, me, cursor, cursor, cap + 1);
      const truncated = rows.length > cap;
      const page = truncated ? rows.slice(0, cap) : rows;
      const invitations = page.map((r) => ({ projectId: r.id, name: this.#bundle(r.id)?.title ?? null,
        invited_by: r.by_id === ROOT_ADMIN ? this.#person(ROOT_ADMIN, null)
          : r.inviter ? { member: r.inviter, handle: r.inviter_handle ?? null } : null,
        invited_at: r.at ?? null }));
      return { ok: true, invitations, count: invitations.length, limit: cap, truncated,
               next: truncated ? invitations[invitations.length - 1].projectId : null };
    } catch { return empty; }
  }

  static PROJECT_INVITATIONS_LIMIT = 200;

  /* R26's page size, R9's rule: a chosen ceiling, lowered by the caller and never raised. */
  static PROJECT_LIST_LIMIT = 200;

  /* R28 (T47; N1025; DEC-214 (3)): eight weeks of activity, oldest first, each week seven days back from the server's
     instant, never a caller's. */
  static ACTIVITY_WEEKS = 8;
  static WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  /* The server's instant in milliseconds: the host's clock when it gave one that reads as a finite number, else now. */
  #iso() { return new Date(this.#now()).toISOString(); }

  #now() {
    let t;
    try { t = Number(this.clock()); } catch { t = NaN; }
    return Number.isFinite(t) ? Math.trunc(t) : Date.now();
  }

  /** R28: FOR THE LISTED PROJECTS (`ids`, already those the viewer sees at FULL), each one's `members`, `activity` and
   *  `lastChange`, by the viewer's sight (`gate`, membership's compiled R43):
   *    MEMBERS     every participant, any state, as R1 lists them to a viewer at FULL (membership R120's
   *                `project_participants` joined to `members`), `{member, handle}`, owners first, then by handle; the
   *                founder, who has no roster row, as R27 names it. A project is listed only at FULL, where R1 already
   *                shows that viewer every participant, so no member here is one the viewer may not see.
   *    ACTS        one per `manifest` entry (record-core R37; one per commit) on the project's own bundle or on a bundle
   *                its `bundles.project` names (record-core R34), each counted only when the gate admits that bundle:
   *                an act on a record the viewer may not see (a hidden project recorded as belonging to this one) moves
   *                nothing. Instants are compared as instants (`julianday`), never as strings.
   *    ACTIVITY    week k back (0 the newest) holds the acts in (now − (k+1)·7d, now − k·7d]; answered oldest first. An
   *                act after now, or one whose instant cannot be read, is in no week.
   *    LASTCHANGE  the `created` of the newest such act, as recorded, ties to the later recorded; null when none.
   *  Writes nothing. */
  #projectFacts(ids, gate) {
    const members = new Map(), activity = new Map(), lastChange = new Map();
    if (!ids.length) return { members, activity, lastChange };
    const list = `(${ids.map(() => "?").join(",")})`;
    for (const [project, rows] of this.#roster(ids))
      if (rows.length) members.set(project, rows.map((x) => this.#person(x.member, x.handle)));
    const timed = `WITH acts AS (
        SELECT b.bundle_id AS project, x.created, x.rowid AS rid
          FROM manifest x JOIN bundles b ON b.bundle_id = x.bundle_id
         WHERE b.object_type = 'project' AND b.bundle_id IN ${list} AND (${gate.sql})
        UNION ALL
        SELECT b.project AS project, x.created, x.rowid AS rid
          FROM manifest x JOIN bundles b ON b.bundle_id = x.bundle_id
         WHERE b.project IN ${list} AND b.bundle_id <> b.project AND (${gate.sql})),
      timed AS (SELECT project, created, rid,
                       CAST(ROUND((julianday(created) - 2440587.5) * 86400000.0) AS INTEGER) AS ms
                  FROM acts)`;
    const args = [...ids, ...gate.args, ...ids, ...gate.args];
    const now = this.#now(), W = ProjectRoster.WEEK_MS, N = ProjectRoster.ACTIVITY_WEEKS;
    for (const r of this.#rows(
      `${timed} SELECT project, CAST((? - ms) / ? AS INTEGER) AS k, COUNT(*) AS n FROM timed
        WHERE ms IS NOT NULL AND ms <= ? AND ms > ? GROUP BY project, k`, ...args, now, W, now, now - N * W)) {
      if (!activity.has(r.project)) activity.set(r.project, Array(N).fill(0));
      if (r.k >= 0 && r.k < N) activity.get(r.project)[N - 1 - r.k] = r.n;
    }
    for (const r of this.#rows(
      `${timed} SELECT project, created FROM (
          SELECT project, created, ROW_NUMBER() OVER (PARTITION BY project ORDER BY ms DESC, rid DESC) AS rn
            FROM timed WHERE ms IS NOT NULL) WHERE rn = 1`, ...args))
      lastChange.set(r.project, r.created);
    return { members, activity, lastChange };
  }

  /* The cap APPLIED for an asked `limit` under a ceiling (R9, R14, R26): the ceiling when none is asked or it is not a
     positive number, never more than it, never less than one. Reads any value without throwing. */
  static #cap(limit, ceiling) {
    let n;
    try { n = Number(limit); } catch { n = NaN; }
    return Math.max(1, Math.min(n || ceiling, ceiling));
  }

  /* ===== R10–R16 — THE REQUEST TO JOIN (§7.14, "The request to join"; Bob, 2026-09-18: *"somebody who sees the
   * project can ask to be added as a member"*) =====
   *   ASK       `projectRequest` — a member SESSION at EXISTENCE sight, at most ONE OPEN request per member per project,
   *             an optional short comment. A hidden project, or one the caller cannot see, is answered as absent.
   *   WITHDRAW  `projectRequestWithdraw` — the requester's own open request. After it they may ask again.
   *   ANSWER    `projectRequestAnswer` — an OWNER's (§7.2: only owners invite). GRANT IS AN INVITATION, written
   *             `invited` through membership's `participationWrite` (its R118), NEVER `joined` (§7.4). DECLINE is
   *             recorded with an optional comment. Administrators and the founder see requests and answer none.
   *   CLOSE     R15 (an invitation, membership R32) and R16 (the project set hidden, membership R45), through the
   *             notices this module registers for.
   *   READ      `projectRequests` — a project's requests to its owners and administrators; with no project, the
   *             caller's OWN requests, which it keeps sight of after a lapse, naming only what it already saw.
   * The record is `project_join_requests` (`schema.mjs`): append-only at the field (R13). */
  static JOIN_REQUEST_ANSWERS = Object.freeze(["grant", "decline"]);

  /* The member a request is ABOUT is the server-stamped `by`, never a name the caller supplies; a machine credential
     stamps `class:<cls>` and names nobody, so it resolves to no member. The FOUNDER is a person with no roster row, so
     "no member behind this credential" would be false about them: they are answered as the person they are, at FULL
     sight, so the ask is C-95.2 like any administrator's. A member's standing is membership's `memberFacts` (its R68). */
  #activeMemberRow(memberId) {
    if (memberId === null || memberId === undefined || String(memberId).startsWith(MACHINE_CLASS_PREFIX)) return null;
    if (memberId === ROOT_ADMIN) return { member_id: ROOT_ADMIN, handle: null, status: "active" };
    const f = this.m.memberFacts(memberId);
    return f && f.status === "active" ? { member_id: memberId, handle: f.handle, status: f.status } : null;
  }

  /* THE PERSON ASKING: the stamped `by` names an active member AND the stamped viewer names the SAME person — the
     control plane stamps both from one session, so a disagreement is a caller that is not a member session and asks
     nothing. The founder's viewer is spelled bare `admin` or `member:admin` (membership R43); every other member is
     matched by `viewerPredicate`'s own parse, never a second one. */
  #requester(by, viewer) {
    const me = this.#activeMemberRow(actorOf(by));
    if (!me) return null;
    if (me.member_id === ROOT_ADMIN)
      return viewer === ROOT_ADMIN || viewerPredicate(viewer).member === ROOT_ADMIN ? me : null;
    return viewerPredicate(viewer).member === me.member_id ? me : null;
  }

  /* C-95.1 and C-95.4 are each said at more than one act, so each is minted in ONE governed region and every act
     RELAYS it: one row, one `where`. The DETAIL is the act's own sentence, handed in; the code is the literal here. */
  #joinRequestRefusal(code, projectId, detail, extra = {}) {
    const row = PROJECT_JOIN_REQUEST_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
             project: projectId ?? null, ...extra };
  }

  #noRequester(projectId, detail) {
    const refusal = (code, d) => this.#joinRequestRefusal(code, projectId, d);
    /* DEC-49 REGION is-join-request-member */
    return refusal("PROJECT_REQUEST_NEEDS_A_MEMBER",
      localize("project-roster.index.detail_a_request_to_join", "{detail} A request to join is a PERSON's act: it is made, withdrawn and read back by the member who asked, signed in as themselves (Membership Architecture v2 §7.14), and a machine credential, the operator's bearer and the member bearer have nobody behind them to ask.", { detail: String(detail) }));
    /* END DEC-49 REGION is-join-request-member */
  }

  #noOpenRequest(projectId, detail, extra = {}) {
    const refusal = (code, d) => this.#joinRequestRefusal(code, projectId, d, extra);
    /* DEC-49 REGION is-join-request-none-open */
    return refusal("PROJECT_REQUEST_NONE_OPEN",
      localize("project-roster.index.detail_a_request_is_open", "{detail} A request is open until it is granted, declined, withdrawn, or lapsed by its project going hidden (Membership Architecture v2 §7.14), and each of those closes it for good; the member may ask again.", { detail: String(detail) }));
    /* END DEC-49 REGION is-join-request-none-open */
  }

  #openJoinRequest(projectId, memberId) {
    return this.#one(`SELECT seq, comment, asked_at FROM project_join_requests
                       WHERE project_id=? AND member_id=? AND state='open'`, projectId, memberId);
  }

  /* R13: THE ONE STATEMENT THAT CLOSES A REQUEST. Every terminal state is written here, and only an OPEN row moves: the
     `WHERE state='open'` is what makes the closing fields write-once, so an answered request cannot be answered twice
     and a withdrawn one cannot then be granted. A null `memberId` closes every open request of the project (R16's
     lapse). Answers the number of rows closed. */
  #closeJoinRequests(projectId, memberId, state, by, comment, at) {
    const before = this.#one(`SELECT COUNT(*) AS n FROM project_join_requests
                               WHERE project_id=? AND (? IS NULL OR member_id=?) AND state='open'`,
      projectId, memberId, memberId).n;
    this.sql.exec(`UPDATE project_join_requests SET state=?, closed_by=?, closed_comment=?, closed_at=?
                    WHERE project_id=? AND (? IS NULL OR member_id=?) AND state='open'`,
      state, by, comment, at, projectId, memberId, memberId);
    return before;
  }

  static #requestComment(comment) {
    return comment === null || comment === undefined || String(comment).trim() === ""
      ? null : String(comment).slice(0, 280);
  }

  /** R10: ASK TO JOIN (§7.14 "Who may ask"). The one act a member at EXISTENCE may take. Who asks is settled first
   *  (a fact about the caller, saying nothing about any project); then sight, which says nothing a caller did not
   *  already know: NONE is the absent answer byte for byte; FULL is refused positionally. Only at EXISTENCE is a request
   *  written, with the name the caller was shown. */
  projectRequest({ projectId, comment = null, by, viewer = null } = {}) {
    const refusal = (code, detail, extra = {}) => {
      const row = PROJECT_JOIN_REQUEST_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId ?? null, ...extra };
    };
    /* DEC-49 REGION is-join-request-ask */
    const me = this.#requester(by, viewer);
    if (!me)
      return this.#noRequester(projectId,
        localize("project-roster.index.asking_to_join_a_project", "asking to join a project is a signed-in member's own act (Membership Architecture v2 §7.14). A credential with no active member behind it asks nothing. Nothing was written."));
    /* Only a PROJECT is asked to join: any other bundle is visible to every member (§7.9), so its sight would read
       FULL and misname it a project the caller is in. It is answered as what it is — no project by that id. */
    const b = this.#bundle(projectId);
    const shown = b ? b.title : null;
    const sight = b && b.type === "project" ? this.m.sight(projectId, viewer) : Membership.SIGHT_NONE;
    if (sight === Membership.SIGHT_NONE) return noSuchProject(projectId);
    /* The ask is open only at a DISCOVERABLE project's EXISTENCE (§7.14: a member outside a discoverable project asks).
       The other EXISTENCE, an administrator's of a hidden project it is not in (D54; membership R44), is answered as
       every caller at EXISTENCE is, membership's C-70.1 with its owners: hiding lapses every request (R16), so a
       hidden project holds none open, and its owners add an administrator by inviting them. */
    if (sight === Membership.SIGHT_EXISTENCE && this.m.visibilityOf(projectId) !== "discoverable")
      return this.m.existenceAct(projectId, viewer);
    if (sight === Membership.SIGHT_FULL)
      return refusal("PROJECT_REQUEST_NOT_OUTSIDE",
        localize("project-roster.index.you_can_already_see_this", "you can already see this project, so there is nothing to ask: a participant is already in it (an invited one joins by the checkbox, §7.4), and an administrator's sight of a project is not a position in it (§7.3). Nothing was written."));
    const open = this.#openJoinRequest(projectId, me.member_id);
    if (open)
      return refusal("PROJECT_REQUEST_ALREADY_OPEN",
        localize("project-roster.index.you_already_have_an_open", "you already have an open request to join this project. One is open at a time: withdraw it to ask again. Nothing was written."), { asked: open.asked_at });
    /* END DEC-49 REGION is-join-request-ask */
    const c = ProjectRoster.#requestComment(comment);
    const at = new Date().toISOString();
    this.sql.exec(
      `INSERT INTO project_join_requests (project_id, member_id, project_name, comment, asked_at, state)
       VALUES (?,?,?,?,?,'open')`, projectId, me.member_id, shown, c, at);
    return { ok: true, projectId, name: shown, state: "open", comment: c, asked: at,
             detail: localize("project-roster.index.your_request_is_open_the", "your request is open. The project's owners answer it; until they do it stays open.") };
  }

  /** R11: WITHDRAW (§7.14: "The requester may withdraw an open request"). The requester's own act on their own record,
   *  so it asks no sight of the project: a caller with no open request to that id is answered ONE way whether the
   *  project is discoverable, hidden or absent. */
  projectRequestWithdraw({ projectId, by, viewer = null } = {}) {
    const me = this.#requester(by, viewer);
    if (!me)
      return this.#noRequester(projectId,
        localize("project-roster.index.withdrawing_a_request_to_join", "withdrawing a request to join is the requester's own act, and a credential with no active member behind it made none. Nothing was written."));
    if (!this.#openJoinRequest(projectId, me.member_id))
      return this.#noOpenRequest(projectId,
        localize("project-roster.index.you_have_no_open_request", "you have no open request to join a project by that id, so there is nothing to withdraw. This answer is the same whatever that id names. Nothing was written."));
    const at = new Date().toISOString();
    this.#closeJoinRequests(projectId, me.member_id, "withdrawn", me.member_id, null, at);
    return { ok: true, projectId, state: "withdrawn", closed: at };
  }

  /** R12: AN OWNER ANSWERS (§7.14 "Who answers"). Sight before position, as every roster act; then ownership, through
   *  membership's `isProjectOwner` (§7's one owner predicate), so an administrator, the founder and every machine
   *  credential are refused by name. GRANT writes `invited`, `invited_by` the granting owner — never `joined` (§7.4).
   *  DECLINE is recorded with the owner's optional comment. A refused grant leaves the request open. */
  projectRequestAnswer({ projectId, handle, answer, comment = null, by, viewer = null } = {}) {
    by = actorOf(by);
    { const refused = this.#ownedProject(projectId, viewer, { ok: false, reason: "NOT_A_PROJECT", project: projectId });
      if (refused) return refused; }
    const want = String(answer ?? "");
    const refusal = (code, detail, extra = {}) => {
      const row = PROJECT_JOIN_REQUEST_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId, ...extra };
    };
    /* DEC-49 REGION is-join-request-answer */
    if (!this.m.isProjectOwner(projectId, by))
      return refusal("PROJECT_REQUEST_ANSWER_NOT_THE_OWNER",
        localize("project-roster.index.a_request_to_join_string", "a request to join {String} is answered by its OWNERS (Membership Architecture v2 §7.14; only owners invite, §7.2), and {String_2} is not one of them. Administrators see requests and answer none. Nothing was written.", { String: String(String(projectId).slice(0, 80)), String_2: String(String(this.#nm(by) ?? localize("project-roster.index.an_unnamed_caller", "an unnamed caller")).slice(0, 80)) }));
    if (!ProjectRoster.JOIN_REQUEST_ANSWERS.includes(want))
      return refusal("PROJECT_REQUEST_UNKNOWN_ANSWER",
        localize("project-roster.index.stringify_is_not_an_answer", "{stringify} is not an answer: a request is granted or declined, and nothing else. Nothing was written.", { stringify: String(JSON.stringify(want.slice(0, 40))) }));
    const target = this.m.memberByHandle(handle);
    const open = target ? this.#openJoinRequest(projectId, target.member_id) : null;
    if (!open)
      return this.#noOpenRequest(projectId,
        localize("project-roster.index.stringify_has_no_open_request", "{stringify} has no open request to join this project, so there is nothing to answer. Nothing was written.", { stringify: String(JSON.stringify(String(handle ?? "").slice(0, 80))) }), { handle: handle ?? null });
    if (want === "grant" && target.status !== "active")
      return refusal("PROJECT_REQUEST_REQUESTER_INACTIVE",
        localize("project-roster.index.stringify_is_not_an_active", "{stringify} is not an active member, and a grant is an invitation (§7.2), which goes to an active member. The request stays open. Nothing was written.", { stringify: String(JSON.stringify(target.handle)) }), { handle: target.handle });
    if (want === "grant" && this.m.participation(projectId, target.member_id))
      return refusal("PROJECT_REQUEST_REQUESTER_ALREADY_A_PARTICIPANT",
        localize("project-roster.index.stringify_is_already_a_participant", "{stringify} is already a participant of this project, so a grant would invite nobody new. The request stays open: decline it, or the requester withdraws it. Nothing was written.", { stringify: String(JSON.stringify(target.handle)) }),
        { handle: target.handle });
    /* END DEC-49 REGION is-join-request-answer */
    const c = ProjectRoster.#requestComment(comment);
    const at = new Date().toISOString();
    /* THE SAME ROW §7.2's invitation writes: `invited`, not an owner, invited_by the owner who granted. */
    if (want === "grant") this.m.participationWrite("invite", { projectId, memberId: target.member_id, by, at });   /* R118 */
    this.#closeJoinRequests(projectId, target.member_id, want === "grant" ? "granted" : "declined", by, c, at);
    return { ok: true, projectId, handle: target.handle, state: want === "grant" ? "granted" : "declined",
             comment: c, closed: at,
             ...(want === "grant"
               ? { participation: "invited",
                   detail: localize("project-roster.index.granted_as_an_invitation_the", "granted as an invitation: the member is INVITED, and joins by the checkbox (§7.4).") }
               : {}) };
  }

  /** R14: WHO SEES A REQUEST (§7.14): the requester (their own, always), the project's owners, and administrators; not
   *  other participants, because a pending requester is not a participant (§7.8). WITH `projectId`: that project's
   *  requests, to an owner or an administrator (the founder included) at FULL sight of it (D54), after sight: an
   *  administrator at a hidden project's EXISTENCE is answered C-70.1 first, as every caller at EXISTENCE. WITHOUT it: the caller's OWN
   *  requests, every project and every state, each naming the project by the id and the name the caller was shown when
   *  asking — so a request LAPSED by a project going hidden is still the requester's to read, and names nothing they had
   *  not already seen. Its answering owner is NOT in the requester's view: who owns a project is contents. Both lists
   *  are bounded as R9's directory is (the first `limit` in the order made). */
  projectRequests({ projectId = null, by, viewer = null, limit = null } = {}) {   /* R37: rows carry `member_id` */
    by = actorOf(by);
    const cap = ProjectRoster.#cap(limit, ProjectRoster.PROJECT_REQUESTS_LIMIT);
    const refusal = (code, detail) => {
      const row = PROJECT_JOIN_REQUEST_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               project: projectId ?? null };
    };
    if (projectId === null || projectId === undefined || projectId === "") {
      const me = this.#requester(by, viewer);
      if (!me)
        return this.#noRequester(null,
          localize("project-roster.index.a_members_own_requests_to", "a member's own requests to join are read by that member, signed in. A credential with no active member behind it has made none."));
      const mine = this.#rows(
        `SELECT project_id AS project, member_id, project_name AS name, comment, state, asked_at AS asked,
                closed_comment, closed_at AS closed
           FROM project_join_requests WHERE member_id=? ORDER BY seq LIMIT ?`, me.member_id, cap + 1);
      const mineCut = mine.length > cap;
      const minePage = mineCut ? mine.slice(0, cap) : mine;
      return { ok: true, own: true, requests: minePage, count: minePage.length, limit: cap, truncated: mineCut };
    }
    const b = this.#bundle(projectId);
    { const existence = b ? this.m.existenceAct(projectId, viewer) : null; if (existence) return existence; }
    if (!b || !this.m.inSight(projectId, viewer)) return noSuchProject(projectId);
    if (b.type !== "project") return { ok: false, reason: "NOT_A_PROJECT", project: projectId };
    /* DEC-49 REGION is-join-requests-project */
    if (!this.m.isProjectOwner(projectId, by) && !this.#adminAtFull(projectId, by))
      return refusal("PROJECT_REQUESTS_NOT_VISIBLE",
        localize("project-roster.index.a_projects_requests_to_join", "a project's requests to join are seen by the requester, the project's owners and administrators (Membership Architecture v2 §7.14), and not by other participants: a pending requester is not a participant (§7.8). Your own requests are read without naming a project."));
    /* END DEC-49 REGION is-join-requests-project */
    const theirs = this.#rows(
      `SELECT m.handle, r.member_id, r.comment, r.state, r.asked_at AS asked, cb.handle AS closed_by,
              r.closed_comment, r.closed_at AS closed
         FROM project_join_requests r JOIN members m ON m.member_id = r.member_id
         LEFT JOIN members cb ON cb.member_id = r.closed_by
        WHERE r.project_id=? ORDER BY r.seq LIMIT ?`, projectId, cap + 1);
    const theirsCut = theirs.length > cap;
    const theirsPage = theirsCut ? theirs.slice(0, cap) : theirs;
    return { ok: true, own: false, projectId, requests: theirsPage, count: theirsPage.length, limit: cap,
             truncated: theirsCut };
  }

  /** R44 (fix round 10; K5157): THE REQUESTS A MEMBER ANSWERED, `{ok, answered, count, limit, truncated}`, `answered`
   *  newest first (by the instant closed), each `{projectId, name, requester: {member, handle}, answer, comment,
   *  closed}`: the join requests closed `granted` or `declined` with `closed_by` that member (a withdrawal is the
   *  requester's own and a lapse the one who hid the project: neither is an answer), only for projects she sees at FULL
   *  (membership R43, the rule every list here applies), so a project she is out of names nothing. `by` and `viewer`
   *  must name one active member, as R14's own list asks (`PROJECT_REQUEST_NEEDS_A_MEMBER`). Capped as R14; writes
   *  nothing; for `queue`'s answered list, which reads it in process. */
  projectRequestsAnswered({ by, viewer = null, limit = null } = {}) {
    const me = this.#requester(by, viewer);
    if (!me)
      return this.#noRequester(null,
        localize("project-roster.index.the_requests_you_answered_are", "the requests a member answered are read by that member, signed in. A credential with no active member behind it answered none."));
    const cap = ProjectRoster.#cap(limit, ProjectRoster.PROJECT_REQUESTS_LIMIT);
    const gate = viewerPredicate(me.member_id === ROOT_ADMIN ? ROOT_ADMIN : viewer);
    const rows = this.#rows(
      `SELECT r.project_id AS id, r.member_id AS member, m.handle AS handle, r.state AS answer, r.closed_comment AS comment,
              r.closed_at AS closed
         FROM project_join_requests r JOIN bundles b ON b.bundle_id = r.project_id AND b.object_type = 'project'
         JOIN members m ON m.member_id = r.member_id
        WHERE r.closed_by = ? AND r.state IN ('granted','declined') AND (${gate.sql})
        ORDER BY r.closed_at DESC, r.seq DESC LIMIT ?`, me.member_id, ...gate.args, cap + 1);
    const truncated = rows.length > cap;
    const page = (truncated ? rows.slice(0, cap) : rows).map((x) => ({ projectId: x.id, name: this.#bundle(x.id)?.title ?? null,
      requester: { member: x.member, handle: x.handle }, answer: x.answer, comment: x.comment ?? null, closed: x.closed }));
    return { ok: true, answered: page, count: page.length, limit: cap, truncated };
  }

  /* THE REQUESTS READ'S PAGE SIZE, a chosen ceiling as R9's: a list a person reads to answer or to recall their own
     asks, generous enough that a legitimate caller rarely meets it, published whenever it cuts. */
  static PROJECT_REQUESTS_LIMIT = 200;
}

/* K61: the one ProjectRoster of a Durable Object's storage, made on first use over its `sql`, reaching record-core by
   `recordOf(ctx)` and membership by `membershipOf(ctx)` on the same `ctx`, and started once (R15, R16). `record` and
   `membership` (a test's own) and `clock` (the host's, R28) are read on the first call only. */
const OF = new WeakMap();
export function projectRosterOf(ctx, { record = null, membership = null, clock = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let r = OF.get(storage);
  if (!r) {
    r = new ProjectRoster({ sql: storage.sql, core: record ?? recordOf(ctx),
                            membership: membership ?? membershipOf(ctx, { record }), clock });
    OF.set(storage, r);
    r.start();
  }
  return r;
}

/* The ops this module answers, as entries of the plane's op map (the composition root, `plane`, spreads them in after
   membership's; their names, declarations and grades are unchanged by the split). `url` is the request URL, whose query
   carries the control plane's stamps (`by`, `viewer`); every parameter is read from it, never from a body. */
const parseList = (v) => { try { return JSON.parse(v); } catch { return v; } };

/* R31: the query carries `stake` as text; the exact word `null` clears it, a missing parameter is malformed. */
const stakeParam = (url) => (!url.searchParams.has("stake") ? undefined
  : url.searchParams.get("stake") === "null" ? null : url.searchParams.get("stake"));

/* R40, R41 (T51 fix round; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that the screens send,
   declared by their owner beside the ops map: each row's class, weight and description are the op's existing rows' (the
   hand rows of `op-declarations` and `op-grades`, with which they agree), its fields are what the arm below reads from
   the request (the stamps `by` and `viewer` excluded). `reason` is accepted where the arm reads one of its own. */
export const DECLARED_OPS = Object.freeze({
  projectowneradd: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("project-roster.declared.projectowneradd", "roster act on a project"),
    fields: { accepts: ["projectId", "handle"], requires: ["projectId", "handle"] } },
  projectownerremove: { classes: ["admin", "member", "probe"], mutating: true, weight: "reasoned",
    description: "act.projectownerremove.does",
    fields: { accepts: ["projectId", "handle", "reason"], requires: ["projectId", "handle", "reason"] } },
  projectownerrescue: { classes: ["admin", "member", "probe"], mutating: true, weight: "reasoned",
    description: "act.projectownerrescue.does",
    fields: { accepts: ["projectId", "handle", "reason"], requires: ["projectId", "handle", "reason"] } },
  projectrequest: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("project-roster.declared.projectrequest", "request to join (§7.14): made at EXISTENCE sight, where no object is before the caller — reached from op=projectdirectory's row, not from a target's control strip"),
    fields: { accepts: ["projectId", "comment"], requires: ["projectId"] } },
  projectrequestwithdraw: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("project-roster.declared.projectrequestwithdraw", "request to join (§7.14): the requester's act on their own REQUEST, not on a bundle — listed by op=projectrequests"),
    fields: { accepts: ["projectId"], requires: ["projectId"] } },
  projectrequestanswer: { classes: ["admin", "member", "probe"], mutating: true, weight: "credential",
    description: localize("project-roster.declared.projectrequestanswer", "request to join (§7.14): an owner's grant or decline of a REQUEST, not a state of the project — listed in the owner's queue by op=projectrequests"),
    fields: { accepts: ["projectId", "handle", "answer", "comment"], requires: ["projectId", "handle", "answer"] } },
  projectstakeset: { classes: ["admin", "member", "probe"], mutating: true, weight: "reversible",
    description: localize("project-roster.declared.projectstakeset", "project-directed: a project's declared stake, every value kept, keyed by project; moves no bundle"),
    fields: { accepts: ["projectId", "stake"], requires: ["projectId", "stake"] } },
});

export function projectRosterOps(r, url, body, env) {
  const q = (k) => url.searchParams.get(k);
  return {
    /* REC-138: `viewer` is the control plane's stamp (sight before position, R19). */
    projectowneradd: () => r.projectOwnerAdd({ projectId: q("projectId"), handle: q("handle"), by: q("by"),
      viewer: q("viewer") }),
    projectownerremove: () => r.projectOwnerRemove({ projectId: q("projectId"), handle: q("handle"), by: q("by"),
      reason: q("reason"), viewer: q("viewer") }),
    projectownerrescue: () => r.projectOwnerRescue({ projectId: q("projectId"), handle: q("handle"), by: q("by"),
      reason: q("reason"), viewer: q("viewer") }),
    projectvisibility: () => r.projectVisibility({ projectId: q("projectId"), viewer: q("viewer") }),
    /* T49 (R30): a read; `viewer` is the control plane's stamp. */
    projectownervotes: () => r.projectOwnerVotes({ projectId: q("projectId"), viewer: q("viewer") }),
    /* D-479: `limit` reaches the directory's page (the cap is the caller's to LOWER, not to raise). */
    /* T50 (R31–R33): the stake, its history, and whether a project's owners are gone. */
    projectstakeset: () => r.projectStakeSet({ projectId: q("projectId"), stake: stakeParam(url), by: q("by"),
      viewer: q("viewer") }),
    projectstake: () => r.projectStakeHistory({ projectId: q("projectId"), viewer: q("viewer") }),
    projectownersgone: () => r.projectOwnersGone({ projectId: q("projectId"), viewer: q("viewer") }),
    projectdirectory: () => r.projectDirectory({ viewer: q("viewer"), limit: q("limit") }),
    /* T47 (R26–R28): the projects the stamped viewer sees at FULL, with each one's recorded stage, opener, members and
       activity; the instant is the server's, never a query's. */
    projectlist: () => r.projectList({ viewer: q("viewer"), limit: q("limit"), after: q("after"),
      sharedDraftsOf: env && typeof env.sharedDraftsOf === "function" ? env.sharedDraftsOf : null }),
    /* T51 (R35): the stamped viewer's own invitations. */
    projectinvitations: () => r.projectInvitations({ viewer: q("viewer"), limit: q("limit"), after: q("after") }),
    projectparticipants: () => r.projectParticipants({ projectId: q("projectId"), by: q("by") }),
    /* REC-150: `by` and `viewer` are the control plane's stamps. */
    projectrequest: () => r.projectRequest({ projectId: q("projectId"), comment: q("comment"), by: q("by"),
      viewer: q("viewer") }),
    projectrequestwithdraw: () => r.projectRequestWithdraw({ projectId: q("projectId"), by: q("by"),
      viewer: q("viewer") }),
    projectrequestanswer: () => r.projectRequestAnswer({ projectId: q("projectId"), handle: q("handle"),
      answer: q("answer"), comment: q("comment"), by: q("by"), viewer: q("viewer") }),
    projectrequests: () => r.projectRequests({ projectId: q("projectId"), by: q("by"), viewer: q("viewer"),
      limit: q("limit") }),
    /* T45 (R21, R24): `needs` is the list as JSON; anything that is not JSON reaches the service as given and is
       refused APPROVAL_RULE_INVALID there. */
    projectscopeset: () => r.projectScopeSet({ projectId: q("projectId"), scope: q("scope"), reason: q("reason"),
      by: q("by"), viewer: q("viewer") }),
    projectapprovalset: () => r.projectApprovalSet({ projectId: q("projectId"), needs: parseList(q("needs")),
      reason: q("reason"), by: q("by"), viewer: q("viewer") }),
  };
}
