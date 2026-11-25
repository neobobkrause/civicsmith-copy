/* affordances — the FACTS behind op=affordances (R13–R16, R23), and only the facts: what this object is, where its
 * state machine stands, which citation edges touch it, and where the caller stands towards it. The DERIVATION (which
 * acts those facts admit) is `deriveActs` in `../affordances.mjs`, and this file holds no copy of any act rule.
 *
 * Extracted from the legacy store (T9, K225, N45, N176): `store.mjs` `affordanceFacts` and the three joined-project
 * predicates `#joinedCitingProjectOf`, `#concludedForJoinedProjectOf`, `#editionWarrantedForJoinedProjectOf`, whose
 * only caller it was. The legacy comments moved with them, shortened where they only restated the code.
 *
 * EVERY FACT IS ASKED THROUGH THE PREDICATE THE CORRESPONDING ACT'S REFUSAL RUNS (R14), never a second copy of the
 * same question, so a published act and the refusal it fronts cannot disagree (DEC-8): live citations through
 * `connections.citesInto` (retire's CITED guard), reinstatable edges through `citation.retiredNotCitable`
 * (`#edgeTransition`'s), what rests on a question through `inquiry.restsOnLive` (divide's CITED guard), the case
 * relation through `case-tensions.caseRelation` (its R1; N597), a project's conclusion through `basis-versions.conclusionOf` and
 * `ratification.caseConclusionFor` / `editionsRecordingConclusion` (publishCase()'s gates), whether the viewer sees both
 * sides of a contradiction inquiry's candidate through `contradiction.candidateSidesSeen` (resolve's C-93.27 check), and
 * every position through `membership`'s predicates.
 *
 * FACTS ARE COUNTS, NEVER IDS (R16): op=affordances answers about the TARGET, and handing back WHICH bundles cite it,
 * or rest on it, would be §7.9's reverse-edge walk arriving by a new door. `op=backlinks` is the gated read that
 * answers that question.
 *
 * THREE-VALUED POSITIONS (R10, R15): a positional fact is null on a target of the wrong type and for a caller with no
 * roster position (a `class:*` credential); the catalogue never narrows on a null and offers a roster act only on a
 * stated `true`. Never writes (R22).
 *
 * REACHED as `affordancesOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`). The modules it
 * asks are reached through their factories on the same host at the moment of the call, when the Durable Object has
 * already made each of them with its own options; `deps` (a test's) replaces any of `record`, `membership`,
 * `connections`, `citation`, `inquiry`, `caseTensions`, `basisVersions`, `ratification`, `contradiction`, `wizardScripts`, `actions` (and `combine`, R67).
 *
 * R67, R68 (T51): the third route, `op=affordancevocab`, answers what only the instance's active profiles know of the
 * vocabularies the answer publishes (`profileVocabularies`).
 *
 * R37 (N528): the second route, `op=affordancescreens`, answers what the untargeted `op=affordances` publishes of
 * `wizard-scripts`: the registered screens and, for each, the offered scripts that start there for this viewer. */

import { normalizeType, parseFrontmatter, isMachineIdentity, isMachineStamp } from "../record-grammar/index.mjs";
import { recordOf, SETTING_UNREADABLE } from "../record-core/index.mjs";
import { membershipOf, Membership } from "../membership/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { citationOf } from "../citation/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { ratificationOf } from "../ratification/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { wizardScriptsOf } from "../wizard-scripts/index.mjs";
/* R51 (T45): the owners of the acts an action offers, each asked through the read its acts' refusals run. */
import { actionsOf } from "../actions/index.mjs";
import { actionHoldsOf } from "../action-holds/index.mjs";
import { escalationOf, STOPPED as ESCALATION_STOPPED, ACCOUNTABILITY_PURPOSES } from "../escalation/index.mjs";
import { conformanceOf } from "../conformance/index.mjs";
import { filingsOf } from "../filings/index.mjs";
import { actionClocksOf, CLOSED_ACTION_STATES, REMINDERS_PER_ACTION_MAX } from "../action-clocks/index.mjs";
import { PRODUCT_KINDS } from "../action-grammar/index.mjs";
import { combine } from "../../../jurisdictions/index.mjs";
import { explainRefusal } from "../affordances.mjs";
import { composedVocabularies, EVENTS_VOCABULARY_KEYS } from "./words.mjs";

/* R15: the `by` a roster position is asked of, or null when none can be: no stamp sent, or a credential's stamp (N874). */
const rosterActor = (by) => {
  const actor = typeof by === "string" && by.trim() ? by.trim() : null;
  return actor === null || isMachineStamp(actor) ? null : actor;
};

class AffordanceFacts {
  constructor(host, deps) {
    this.host = host;
    const d = deps || {};
    const of = (name, make) => () => d[name] || make(host);
    this.record = of("record", recordOf);
    this.membership = of("membership", membershipOf);
    this.connections = of("connections", connectionsOf);
    this.citation = of("citation", citationOf);
    this.inquiry = of("inquiry", inquiryOf);
    this.caseTensions = of("caseTensions", caseTensionsOf);
    this.basisVersions = of("basisVersions", basisVersionsOf);
    this.ratification = of("ratification", ratificationOf);
    this.contradiction = of("contradiction", contradictionOf);
    this.wizardScripts = of("wizardScripts", wizardScriptsOf);
    this.actions = of("actions", actionsOf);
    this.actionHolds = of("actionHolds", actionHoldsOf);
    this.escalation = of("escalation", escalationOf);
    this.conformance = of("conformance", conformanceOf);
    this.filings = of("filings", filingsOf);
    this.actionClocks = of("actionClocks", actionClocksOf);
    const storage = host && host.storage ? host.storage : host;
    this.sql = d.sql || (storage && storage.sql);
    /* R67: `jurisdictions.combine` of the active profiles, replaced by a test's stand-in through `deps.combine` */
    this.combine = d.combine || combine;
  }

  /* One row of record-core's `bundles` read contract (its R37: `bundle_id`, `object_type`, `current_state`,
     `criticality`). */
  #bundle(id) {
    const rows = [...this.sql.exec(
      `SELECT bundle_id, object_type, current_state, criticality FROM bundles WHERE bundle_id=?`, id)];
    return rows.length ? rows[0] : null;
  }

  #isProject(id) {
    const b = this.#bundle(id);
    return !!b && normalizeType(b.object_type) === "project";
  }

  /* The projects that LIVE-cite `inquiryId`, that `viewer` can see and that `memberId` has joined: the three
     conditions `conclude()` runs on the project it is named (the one live-cites predicate — a SEVERED edge is a project
     that no longer draws on the question — the project gate, and C-56's joined rule). A question also writes
     `rel: cites` into its references (REC-37), and a citing question is no project, so the type goes through
     `normalizeType`. R23: asked only for the caller's own member id, over projects the viewer can see. */
  #joinedCitingProjects(inquiryId, viewer, memberId) {
    const m = this.membership();
    return this.connections().citesInto(inquiryId).confirmed
      .filter((pid) => this.#isProject(pid) && m.inSight(pid, viewer) && m.isJoinedParticipant(pid, memberId));
  }

  /* R14, R15 (REC-142 / INVESTIGATIVE-SESSION.md §7.1 item 8): MAY THIS MEMBER CONCLUDE THIS QUESTION FOR SOME PROJECT?
     "Some project", D-310's `ownsAnyProject` shape: the project is `conclude`'s PARAMETER, so the pre-flight narrows
     the act to exactly the class for which NO `project=` could succeed. */
  #concludesForProject(inquiryId, viewer, memberId) {
    return this.#joinedCitingProjects(inquiryId, viewer, memberId).length > 0;
  }

  /* R14, R15 (REC-135 / §7.1 item 4): DOES A PROJECT THIS CALLER HAS JOINED STAND ON A CONCLUSION OF THIS QUESTION?
     Asked through `basis-versions.conclusionOf`, the reader `publishCase()`'s own gate runs. A FACT and never a rule: it
     says SOME joined project concluded here, not that this caller may publish for THAT project (D-311's per-pair
     question), and the act still refuses on its own terms. */
  #concludedForProject(inquiryId, viewer, memberId) {
    const bv = this.basisVersions();
    return this.#joinedCitingProjects(inquiryId, viewer, memberId).some((pid) => !!bv.conclusionOf(pid, inquiryId, viewer));
  }

  /* R14, R15 (REC-157 / §7.1 item 9): COULD A PROJECT THIS CALLER HAS JOINED PUBLISH A NEW EDITION OF A FINDING A CASE
     ALREADY PINS — its conclusion having moved since every edition pinning these bytes? The two questions
     `publishCase()` asks of the project a caller names, through the SAME two readers (ratification R1): the
     relationship is CONCLUDED, and no edition pinning these bytes already records that conclusion. Only a case member is
     walked: a finding no case pins is offered `publish` by `!case_member` already. */
  #editionWarrantedForProject(inquiryId, viewer, memberId, currentState) {
    const rel = this.caseTensions().caseRelation(inquiryId);
    if (!rel.member) return false;
    const r = this.ratification();
    return this.#joinedCitingProjects(inquiryId, viewer, memberId).some((pid) => {
      const conc = r.caseConclusionFor(pid, inquiryId, viewer, currentState);
      return conc.state === "concluded" && !r.editionsRecordingConclusion(inquiryId, rel, conc).same.length;
    });
  }

  /* R14, R15, R18 (D-311, N45): THE CALLER'S ROSTER POSITION IN THIS PROJECT — the PAIR (this target, this caller),
     asked of `by`, the string the roster acts themselves receive, so the pre-flight asks the question of the same caller
     the act will. Each field is read through the predicate its act's refusal runs:
       owner                  `isProjectOwner` (invite, remove, owner-add, owner-remove: NOT_THE_OWNER)
       state                  `participation` (join's NOT_INVITED, leave's NOT_A_PARTICIPANT / NOT_JOINED)
       owner_floor_clear      owner-remove's floor for EVERY target: `ownerMath` over the owners (LAST_OWNER, R40),
                              and at least one owner committed — with every owner leaving, removing any of them leaves
                              only leaving owners, which R40 refuses (LAST_COMMITTED_OWNER)
       other_owner_committed  leave's floor (membership R35, REC-224): some owner other than `by` has not asked to leave;
                              an owner who is the last committed one is refused LAST_COMMITTED_OWNER
       rescue_open            `rescueRefusal` is null (the rescue's three caller-and-project conditions, R75)
     "Committed" is R35's: an owner whose participation is not `leaving` (R65's owners, R74's state). Null on a target
     that is not a project, when no `by` was sent (a DO-internal call), and (R15) for a caller with no roster position:
     a stamp the control plane mints for a credential (`isMachineStamp`: `class:<cls>` for a bearer, `class:ai` or, since
     control-plane R17, `class:ai/<tokenId>` for an assistant; N874), which no participation row names. Every act these
     facts offer asks a stated `true`, so the null offers nothing, as a stamp's answers did. */
  #roster(projectId, by) {
    const actor = rosterActor(by);
    if (actor === null) return null;
    const m = this.membership();
    const p = m.participation(projectId, actor);
    const owners = m.projectOwners(projectId);
    const committed = owners.filter((o) => m.participation(projectId, o)?.state !== "leaving");
    return { owner: m.isProjectOwner(projectId, actor),
             state: p ? p.state : null,
             owner_floor_clear: Membership.ownerMath(owners.length).possible && committed.length > 0,
             other_owner_committed: committed.some((o) => o !== actor),
             rescue_open: m.rescueRefusal(projectId, actor) === null };
  }

  /* R14, R51 (T45; v0.2 rule 1; DEC-8): THE FACTS THE ACTS AN ACTION OFFERS RUN ON, each asked through the read its act's
     refusal runs, and each null where that read could not answer (a null offers nothing that needs it, R10):
       closed               filings' and action-clocks' ACTION_CLOSED: the action's state is resolved or abandoned
       request_for_comment  action-replies' BEARING_NOT_RFC: the action's kind
       entries {all, sent, received, received_unmarked}
                            the ledger, counted: a hold's or a receipt's place (HOLD_PLACE_REFUSED, RECEIPT_NOT_ON_SENT), a
                            bearing's and a link's received entry (BEARING_NOT_RFC, AROSE_FROM_NOT_A_RESPONSE), and pressure's
                            unmarked received entry (PRESSURE_NOT_RECEIVED, PRESSURE_MARKED), through action-holds' own marks
       holds_in_place       action-holds' `holdsOf`: the places on this action (the whole, and each entry) whose hold is in
                            place (HOLD_ALREADY_RELEASED, HOLD_NOT_IN_PLACE, plan-work's NO_SUCH_ITEM for a hold)
       preparable           filings' `templatesForAction`: the governing tier is 1 or 2 (FILING_TIER_UNDETERMINED,
                            TIER3_COUNSEL_PACKET)
       drafts {unapproved, approved_unsent}
                            filings' `filingsFor`: a draft of the group's voice not yet approved (ALREADY_APPROVED,
                            NOT_THE_GROUPS_ACT), and one approved, not yet sent and (R52; filings R50) answered
                            `second_needed: false` (NOT_APPROVED, ALREADY_SENT, SECOND_APPROVAL_NEEDED)
       clock {entries, dated, reminders_room, proposals}
                            the action's clock entries, those dated (REMINDER_REFUSED arm `entry`; plan-work's NO_SUCH_ITEM for
                            a clock), whether its standing reminders are under action-clocks' bound (arm `bound`), and (R52)
                            the keys of the standing proposals `clockProposalsFor` answers with a date (NO_SUCH_CLOCK_PROPOSAL,
                            CLOCK_PROPOSAL_UNDETERMINED): a proposal's key names a rule and its proposer, never a bundle (R16)
       escalation {openable, attachable, attach_purposes, stoppable, reopenable}
                            escalation's `#pursuable` asked through its parts: a determination this action rests on, read
                            through conformance (live, not void, noncompliant), whose project the author has joined
                            (`projectAuthority`) and with no escalation open, suspended or stopped (ALREADY_OPEN); an escalation of
                            such a determination, not ended, at a stage that takes an action (2, 5 or 7), the action a breach
                            action resting on it and attached to none (ALREADY_ATTACHED), at stage 7 (R52) only with a
                            purpose `attachConditions` answers not refused for the action's addressee (COUNTERPARTY_NOT_*),
                            those purposes being `attach_purposes`; and (R52; escalation R31) an escalation of a determination
                            it rests on standing `open` or `suspended` (stop; NOT_OPEN) or `stopped_pursuing` (reopen;
                            NOT_STOPPED), each read from its state as the viewer sees it
     Never ids (R16). Never writes (R22). */
  #actionFacts(id, viewer, author) {
    const ask = (f) => { try { return f(); } catch { return null; } };
    const a = ask(() => this.actions().actionRead({ id, viewer }));
    if (!a || a.ok !== true) return null;
    const corr = Array.isArray(a.correspondence) ? a.correspondence : [];
    const received = corr.filter((e) => e && e.direction === "received");
    const h = this.actionHolds();
    const marked = ask(() => {
      const r = h.pressureFor({ action: id, viewer });
      return r && r.ok === true ? new Set(r.items.map((i) => i?.arrived?.ord)) : null;
    });
    const inPlace = (ord) => ask(() => { const r = h.holdsOf({ target: id, ...(ord === null ? {} : { ord }), viewer });
      return r && r.ok === true ? r.hold === "in_place" : null; });
    const places = [inPlace(null), ...corr.map((e) => inPlace(e.ord))];
    const holds = places.some((x) => x === null) ? null : places.filter(Boolean).length;
    const preparable = ask(() => {
      const r = this.filings().templatesForAction({ action: id, viewer });
      if (r && r.ok === true) return r.governing?.tier === 1 || r.governing?.tier === 2;
      return r && ["FILING_TIER_UNDETERMINED", "TIER3_COUNSEL_PACKET"].includes(r.reason) ? false : null;
    });
    const drafts = ask(() => {
      const r = this.filings().filingsFor({ action: id, viewer });
      if (!r || r.ok !== true || r.drafts_truncated) return null;
      const ours = r.drafts.filter((d) => d && d.voice !== "self");
      /* R52 (filings R50): a draft still waiting for a second approval offers no send; only a stated `false` sends */
      return { unapproved: ours.filter((d) => !d.approval).length,
               approved_unsent: ours.filter((d) => d.approval && !d.sending && d.second_needed === false).length };
    });
    const clock = Array.isArray(a.clock) ? a.clock : [];
    const room = ask(() => { const r = this.actionClocks().remindersFor({ action: id, viewer });
      return r && r.ok !== false && Array.isArray(r.reminders) && !r.truncated
        ? r.reminders.filter((x) => x.state !== "answered").length < REMINDERS_PER_ACTION_MAX : null; });
    /* R52 (action-clocks R20, R13): the standing proposals the viewer may see, each by the key `clockadopt` adopts it by;
       an undated one is refused CLOCK_PROPOSAL_UNDETERMINED, so it is not offered */
    const proposals = ask(() => { const r = this.actionClocks().clockProposalsFor({ action: id, viewer });
      return r && r.ok === true && Array.isArray(r.proposals)
        ? r.proposals.filter((p) => p && typeof p.key === "string" && typeof p.date === "string" && p.date).map((p) => p.key)
        : null; });
    return { closed: CLOSED_ACTION_STATES.includes(a.current_state),
             request_for_comment: a.kind === "request_for_comment",
             entries: { all: corr.length, sent: corr.filter((e) => e && e.direction === "sent").length,
                        received: received.length,
                        received_unmarked: marked === null ? null : received.filter((e) => !marked.has(e.ord)).length },
             holds_in_place: holds,
             preparable,
             drafts,
             clock: { entries: clock.length,
                      dated: clock.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? ""))).length,
                      reminders_room: room, proposals },
             escalation: ask(() => this.#escalationFacts(a, viewer, author))
               ?? { openable: null, attachable: null, attach_purposes: null, stoppable: null, reopenable: null } };
  }

  /* R51, R52: the escalation half of the action's facts, each condition one of `escalationOpen`'s, `escalationAttach`'s,
     `escalationStopPursuing`'s or `escalationReopen`'s refusals asked through the read it runs. A determination this
     action rests on that the viewer cannot read may hold an escalation the action is attached to, which no read here may
     name or count (escalation R34), so attachment is then unknown (null) and not offered. */
  #escalationFacts(a, viewer, author) {
    const legs = (Array.isArray(a.legs) ? a.legs : []).filter((l) => l && l.kind === "rests_on" && typeof l.target === "string");
    const who = typeof author === "string" && author.trim() ? author.trim() : null;
    const m = this.membership(), esc = this.escalation(), conf = this.conformance();
    let openable = false, attachedAnywhere = false, unseen = false, stoppable = false, reopenable = false, early = false;
    const purposes = new Set();
    for (const leg of new Set(legs.map((l) => l.target))) {
      let d = null;
      try { d = conf.determinationRead({ id: leg, viewer }); } catch { d = null; }
      if (!d || d.ok === false) { unseen = true; continue; }
      const items = esc.escalationsFor({ determination: leg, viewer });
      if (!items || items.ok === false) return null;
      /* R52 (escalation R31): stop what stands open or suspended, reopen what stopped */
      if (items.items.some((e) => e.state === "open" || e.state === "suspended")) stoppable = true;
      if (items.items.some((e) => e.state === ESCALATION_STOPPED)) reopenable = true;
      for (const e of items.items) {
        const r = esc.escalationRead({ id: e.id, viewer });
        if (r && r.ok !== false && (r.actions ?? []).some((x) => x && x.action === a.id)) attachedAnywhere = true;
      }
      if (d.live !== true || (d.void && typeof d.void === "object")) continue;
      const outcomes = Array.isArray(d.outcomes) ? d.outcomes : [];
      if (!outcomes.some((o) => o && o.outcome === "noncompliant")) continue;
      /* escalation R1, R31: one escalation of a determination stands at a time, a stopped one among them (ALREADY_OPEN) */
      const live = items.items.filter((e) => e.state === "open" || e.state === "suspended" || e.state === ESCALATION_STOPPED);
      if (!live.length && who !== null && m.projectAuthority(d.project, who, "joined", "escalationOpen") === null) openable = true;
      for (const e of items.items) {
        const r = esc.escalationRead({ id: e.id, viewer });
        if (!r || r.ok === false || r.state === "ended") continue;
        if (r.stage === 2 || r.stage === 5) early = true;
        /* R52 (escalation R34): at stage 7, the purposes R9 would admit for this action's addressee; one refused is not
           offered, one undetermined is (R9 lands it), and testimony and enforcing legislation ask nothing */
        if (r.stage === 7) {
          const c = esc.attachConditions({ id: e.id, action: a.id, viewer });
          if (!c || c.ok !== true || !c.purposes) continue;
          for (const p of ACCOUNTABILITY_PURPOSES) if (c.purposes[p] && c.purposes[p].state !== "refused") purposes.add(p);
        }
      }
    }
    const breach = a.breach === true && !attachedAnywhere;
    const attach_purposes = breach && purposes.size ? ACCOUNTABILITY_PURPOSES.filter((p) => purposes.has(p)) : null;
    return { openable: who === null ? null : openable,
             attachable: unseen ? null : breach && (early || attach_purposes !== null),
             attach_purposes: unseen ? null : attach_purposes,
             stoppable: who === null ? null : stoppable,
             reopenable: who === null ? null : reopenable };
  }

  /* R13, R14 (D54; K2408; J1): an administrator (the founder included) neither invited nor joined to a HIDDEN project
     sees it at EXISTENCE (membership R44): its id, name and owners, never its contents. The one act membership keeps
     reachable for it there is the owner rescue (membership R60, project-roster R5), so the facts answer R14's keys with
     every content fact null, the caller's own positions as R15 asks them, and `roster` carrying only `rescue_open`, asked of `by` through `rescueRefusal`, the
     predicate the rescue runs: the pre-flight offers the rescue exactly where the act accepts it (R18) and nothing
     else (R10: a null fact offers nothing). The floors stay null: whether owners are leaving is the project's contents.
     A member at a discoverable project's EXISTENCE, and every NONE, answers null here: R13's NO_SUCH_BUNDLE. */
  #existenceFacts(target, viewer, identity, author, by) {
    const m = this.membership();
    if (typeof target !== "string" || m.sight(target, viewer) !== Membership.SIGHT_EXISTENCE
        || m.visibilityOf(target) !== "hidden") return null;
    const actor = rosterActor(by);
    /* The caller's own positions, as R15 asks them; the pair facts are false, never null, for a caller with no member
       position (the founder): at this EXISTENCE the administrator is neither invited nor joined, and a null would
       offer `cite`, which the act refuses there (R10, R18). */
    const who = m.positionalMember(viewer, identity);
    return { ok: true, target, object_type: "project", declared_type: null, current_state: null, criticality: null,
             case_member: null, project_owner: who === null ? null : m.ownsAnyProject(who),
             project_target_owner: who === null ? false : m.isProjectOwner(target, who),
             project_participant: who === null ? false : m.isJoinedParticipant(target, who),
             roster: actor === null ? null
               : { owner: false, state: null, owner_floor_clear: null, other_owner_committed: null,
                   rescue_open: m.rescueRefusal(target, actor) === null },
             actor_is_machine: author === null ? null
               : (() => { const a = String(author).trim(); return !a || isMachineIdentity(a); })(),
             concludes_for_project: null, concluded_for_project: null, edition_warranted_for_project: null,
             basis_legs: null, contradiction_inquiry: null, contradiction_sides_seen: null,
             rested_on: { working: null, frozen: null, severed: null }, basis_version_states: null, basis_versions: null,
             cites_in: { confirmed: null, severed: null },
             cites_out: { confirmed: null, severed: null, severed_reinstatable: null },
             cited_by_case: { confirmed: null, severed: null }, legs_in: { live: null, severed: null }, action: null };
  }

  /* R14, R55 (T47; N977; citation R15): THE QUESTIONS HOLDING A LEG ON THIS INFORMATION, counted by the leg's status, among
     those the viewer may see — `sever` and `reinstate` act on a question's own legs (citation R15), and ask no joined
     project. Asked through `inquiry.restsOnLive` (leg-earning R5), which reads a leg's status as citation R15 does
     (`connections.edgeSevered` over the question's references, whatever the entry's relation) and skips a divided
     question. A question whose document cannot be revised (divided, or frozen in a case) is refused there as any write
     to it is (inquiry R11), so it is counted in neither: `frozen` legs are not live, and a severed leg's question is
     counted only when no case pins it (`case-tensions.caseRelation`, the predicate inquiry's refusal runs). Counts of
     questions, never ids (R16). */
  #legsIn(id, viewer) {
    const m = this.membership();
    const rests = this.inquiry().restsOnLive(id);
    const seen = (q) => m.inSight(q, viewer);
    const live = new Set(rests.confirmed.map((l) => l.bundle_id).filter(seen));
    const severed = new Set(rests.severed.map((l) => l.bundle_id).filter(seen)
      .filter((q) => !this.caseTensions().caseRelation(q).member));
    return { live: live.size, severed: severed.size };
  }

  /** R13–R16: the facts for one target as the caller stands. `viewer` is what the caller may see, `identity` who it
   *  is (a session's member; an `ai` credential's member principal), `author` the stamp an act would be signed with,
   *  `by` the roster stamp. */
  affordanceFacts({ target, viewer = null, identity = null, author = null, by = null } = {}) {
    if (!target) return { ok: false, reason: "NO_TARGET",
      detail: "affordances are asked of an object: pass target=<record id>" };
    /* R13 (REC-25 / F-8): an object the viewer may not see answers NO_SUCH_BUNDLE — the SAME shape a truly absent id
       answers, so the refusal discloses nothing. Sight is membership's one rule (R80), and an absent viewer sees
       nothing. */
    const m = this.membership();
    const b = m.inSight(target, viewer) ? this.#bundle(target) : null;
    if (!b) return this.#existenceFacts(target, viewer, identity, author, by) || { ok: false, reason: "NO_SUCH_BUNDLE", target };
    const type = normalizeType(b.object_type);
    const id = b.bundle_id;

    /* Edges INTO the target, live and severed, counted (R16, N176). HOW MANY OF THOSE CITERS ARE CASES is a fact of
       its own (REC-72): `sever` and `reinstate` move an edge on a CASE's document and refuse a citer that is not a
       project (NOT_A_PROJECT), while a question also writes `rel: cites` when it takes a basis leg. */
    const citesIn = this.connections().citesInto(id);
    const citedByCase = {
      confirmed: citesIn.confirmed.filter((c) => this.#isProject(c)).length,
      severed: citesIn.severed.filter((c) => this.#isProject(c)).length,
    };

    /* The document, for a project's own edge statuses and (REC-13) for the DECLARED object_type: `bundles.object_type`
       is the NORMALIZED type, and the derivation must consult the machine the document was authored under. */
    const md = this.record().readFile(id, "bundle.md");
    const docFm = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data || {}) : {};

    /* A project's OWN citation edges by status, and (D-444) how many severed ones could be put back, asked through
       `retiredNotCitable`, the predicate `#edgeTransition` runs. A non-string target cannot be moved by the op, so it
       is not counted reinstatable. */
    const citesOut = { confirmed: 0, severed: 0, severed_reinstatable: 0 };
    if (type === "project") {
      const citation = this.citation();
      for (const r of (Array.isArray(docFm.references) ? docFm.references : []))
        if (r && typeof r === "object" && r.rel === "cites") {
          if (r.status !== "severed") { citesOut.confirmed++; continue; }
          citesOut.severed++;
          if (typeof r.target === "string" && !citation.retiredNotCitable(r.target)) citesOut.severed_reinstatable++;
        }
    }

    /* REC-17: WHAT RESTS ON THIS QUESTION, working and frozen apart (divide refuses on the working set alone). */
    const rested = type === "inquiry" ? this.inquiry().restsOnLive(id) : { confirmed: [], frozen: [], severed: [] };

    /* R15: positional facts are asked of who the caller is (`identity`), never of what it may see. */
    const who = m.positionalMember(viewer, identity);
    const versions = Array.isArray(docFm.basis_versions) ? docFm.basis_versions : [];
    return { ok: true, target: id, object_type: b.object_type,
             declared_type: typeof docFm.object_type === "string" ? docFm.object_type : b.object_type,
             current_state: b.current_state, criticality: b.criticality ?? null,
             /* CASE-4 / DEC-72: the case relation, through the one predicate the refusals run (case-tensions R1; N597,
                never publication's delegate). */
             case_member: type === "inquiry" ? !!this.caseTensions().caseRelation(id).member : false,
             /* D-310 / DEC-72 clause 5: owner of SOME project (the project is a PARAMETER of op=publish). */
             project_owner: who === null ? null : m.ownsAnyProject(who),
             /* REC-149: the PAIR — does the caller own THIS project (`projectVisibilitySet`'s refusal). */
             project_target_owner: type !== "project" || who === null ? null : m.isProjectOwner(id, who),
             /* REC-134 / C-56: has the caller JOINED this project (cite, sever, reinstate's refusal). */
             project_participant: type !== "project" || who === null ? null : m.isJoinedParticipant(id, who),
             roster: type === "project" ? this.#roster(id, by) : null,
             /* D-311: would the act be signed by a machine — `!who || isMachineIdentity(who)` on the author stamp,
                REC-46's one predicate, which the machine fences run. Null when no `author` was sent. */
             actor_is_machine: author === null ? null
               : (() => { const a = String(author).trim(); return !a || isMachineIdentity(a); })(),
             concludes_for_project: type !== "inquiry" || who === null ? null
               : this.#concludesForProject(id, viewer, who),
             concluded_for_project: type !== "inquiry" || who === null ? null
               : this.#concludedForProject(id, viewer, who),
             edition_warranted_for_project: type !== "inquiry" || who === null ? null
               : this.#editionWarrantedForProject(id, viewer, who, b.current_state),
             /* REC-16: how many legs this question rests on, read from the document (inquiry_basis projects it). */
             basis_legs: Array.isArray(docFm.basis) ? docFm.basis.filter((l) => l && typeof l === "object").length : 0,
             /* N345 (R14): a contradiction inquiry is one whose document carries `contradiction` (inquiry R47), read from
                the front matter; null on a type that is not an inquiry. */
             contradiction_inquiry: type !== "inquiry" ? null
               : docFm.contradiction !== undefined && docFm.contradiction !== null,
             /* N365 (R14, R8): whether the VIEWER may see both sides of the candidate that contradiction inquiry names,
                asked through the one predicate `contradictionresolve` refuses on (contradiction R56, its C-93.27 check),
                so the offer and the act cannot disagree. Null wherever `contradiction_inquiry` is not true. */
             contradiction_sides_seen: type !== "inquiry" || docFm.contradiction === undefined || docFm.contradiction === null
               ? null : this.contradiction().candidateSidesSeen({ inquiry: id, viewer }) === true,
             rested_on: { working: rested.confirmed.length, frozen: rested.frozen.length, severed: rested.severed.length },
             /* PL-2 / IS-2: which states this question's readings are in, from the document. */
             basis_version_states: versions.filter((v) => v && typeof v === "object" && typeof v.state === "string")
               .map((v) => v.state.trim()),
             basis_versions: versions.filter((v) => v && typeof v === "object").length,
             cites_in: { confirmed: citesIn.confirmed.length, severed: citesIn.severed.length },
             cites_out: citesOut, cited_by_case: citedByCase,
             /* R55 (T47): the questions holding a leg on an information target, by the leg's status; null on any other type */
             legs_in: type === "information" ? this.#legsIn(id, viewer) : { live: null, severed: null },
             /* R51 (T45): an action's own facts, null on any other type */
             action: type === "action" ? this.#actionFacts(id, viewer, author) : null };
  }

  /** R67, R68 (T51; N1236, K3771; DEC-329 (5), K3806): WHAT THE ACTIVE PROFILES ADD TO THE VOCABULARIES, read at the moment of the
   *  call as `action_kind` is (R26) and never held. `proceeding_kinds`: `[{kind, label, forum_kind}]` of `jurisdictions.combine`'s
   *  view over the instance's `jurisdiction_profiles` (`jurisdictions` R51), in the combined view's order, every kind once, an
   *  entry without a string `kind` left out; `[]` with no profile active. `action_kind_labels`: from the view `actions.kinds()`
   *  reads (`actions.governingView`, so that this map and `action_kind` cannot disagree), each `action_kinds` entry whose kind is
   *  not among the product's own and whose `label` is a non-empty string, kind to label; `{}` with no profile active. A view that
   *  cannot be read leaves its key out (absent, never empty), so a surface can tell "none" from "could not ask". The label is the
   *  profile's own text as record data, not a word of this module's. A read: writes nothing (R22) and never throws. */
  profileVocabularies() {
    let ids = null, readable = true;
    try { ids = this.record().getSetting("jurisdiction_profiles", { strict: true }); } catch { readable = false; }
    if (ids === SETTING_UNREADABLE) readable = false;
    if (typeof ids === "string") { try { ids = JSON.parse(ids); } catch { readable = false; } }
    const active = !readable ? null : Array.isArray(ids) ? ids : ids === null || ids === undefined ? [] : null;
    const out = { ok: true };
    if (active !== null) {
      if (!active.length) out.proceeding_kinds = [];
      else {
        let view = null;
        try { const c = this.combine(active); view = c && c.ok ? c.view : null; } catch { view = null; }
        if (view) {
          const seen = new Set();
          out.proceeding_kinds = (Array.isArray(view.proceeding_kinds) ? view.proceeding_kinds : [])
            .filter((k) => k && typeof k.kind === "string" && !seen.has(k.kind) && seen.add(k.kind))
            .map((k) => ({ kind: k.kind, label: typeof k.label === "string" ? k.label : null, forum_kind: k.forum_kind ?? null }));
        }
      }
    }
    let governing = null;
    try { governing = this.actions().governingView(); } catch { governing = null; }
    if (governing && typeof governing === "object") {
      out.action_kind_labels = {};
      for (const k of Array.isArray(governing.action_kinds) ? governing.action_kinds : [])
        if (k && typeof k.kind === "string" && !PRODUCT_KINDS.includes(k.kind) && typeof k.label === "string" && k.label.trim()
            && !Object.hasOwn(out.action_kind_labels, k.kind)) out.action_kind_labels[k.kind] = k.label;
    } else if (active !== null && !active.length) out.action_kind_labels = {};
    /* R39 (E14, T51 fix round 5): `events` registers as a connection owner at its `start`, which runs here, in the Durable
       Object, and not in the Worker isolate that composes the door's answer; so its five vocabularies, composed here where
       the owner is registered (with the owner's words), travel with this answer. */
    try {
      const composed = composedVocabularies();
      out.events_vocabularies = Object.fromEntries(EVENTS_VOCABULARY_KEYS.filter((k) => composed[k]).map((k) => [k, composed[k]]));
    } catch { /* left out: the door then composes what its own isolate has */ }
    return out;
  }

  /** R41 (Q1-7): a refusal an op gave, explained from its catalogue row (`rowOf`, handed in) and, with a target, a dry
   *  run of the acts this caller may take on it now: R13–R14's facts asked as the acts would be, `deriveActs` over them,
   *  nothing performed. Never throws. */
  explainRefusal(arg) {
    const { op = null, code = null, target = null, viewer = null, identity = null, author = null, by = null, gate = null,
            rowOf = null } = arg && typeof arg === "object" ? arg : {};
    let facts = null;
    if (target) {
      try { facts = this.affordanceFacts({ target, viewer, identity, author, by }); }
      catch { facts = { ok: false, reason: "NO_SUCH_BUNDLE" }; }
    }
    return explainRefusal({ op, code, facts, gate, rowOf });
  }

  /** R37 (DEC-120, DEC-121; N528): the screen registry as `wizard-scripts` registered it (its R13, `[]` before
   *  registration) and the offered scripts for `viewer`: for each registered screen in registry order, its R11 answer
   *  passed in unchanged, the caller's own drafts (`draft: true`) left out — R37 publishes the offered scripts. A read. */
  screens({ viewer = null } = {}) {
    const w = this.wizardScripts();
    const screens = w.registeredScreens();
    const wizard_scripts = [];
    for (const { id } of screens) {
      const at = w.wizardsAt({ screen: id, viewer });
      for (const s of (at && Array.isArray(at.scripts) ? at.scripts : [])) if (s.draft !== true) wizard_scripts.push(s);
    }
    /* R44 (K1861 (1)): the acts on which writing help is refused, as `wizard-scripts` R24 holds and registers them,
       passed through unchanged (its named list and the registered sets; `[]` before registration). */
    return { ok: true, screens, wizard_scripts, writing_help_refused: w.writingHelpRefused() };
  }
}

const instances = new WeakMap();

export function affordancesOf(host, deps) {
  let a = instances.get(host);
  if (!a) { a = new AffordanceFacts(host, deps); instances.set(host, a); }
  return a;
}

/* N13's share (`legacy-store`'s map §4.1): the route this module answers, `op=affordancefacts` (R13–R16), as an op map
   the composition root spreads into the durable object's one route map, as every other module's is. The stamps arrive
   on the query exactly as the acts receive them; an absent one reads null (R15). */
export function affordancesOps(a, url) {
  const q = (k) => url.searchParams.get(k);
  return {
    affordancefacts: () => a.affordanceFacts({ target: q("target"), viewer: q("viewer"), identity: q("identity"),
                                               author: q("author"), by: q("by") }),
    /* R37: the screens and the offered wizard scripts the untargeted answer publishes, for the stamped viewer. */
    affordancescreens: () => a.screens({ viewer: q("viewer") }),
    /* R67, R68: what the active profiles add to the vocabularies, asked beside the kinds on both arms of the answer. */
    affordancevocab: () => a.profileVocabularies(),
  };
}
