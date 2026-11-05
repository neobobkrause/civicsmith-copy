/* reading-guides — what to look for in one kind of document (requirements: `build/requirements/reading-guides.md`
 * R1–R20; D8, D24, D65; K2405, K2418, K2472; v0.2 rule 11; T53: N1257, N858).
 *
 * A guide is a short list of items, each a label, what to look for and, if given, where: by hand a checklist, for the
 * assistant what to read for, so the two are one text (D65). Civicsmith's library ships with the release (R1,
 * `library.mjs`); each group keeps its own (R2, R3); guides are offered across groups and reviewed before adoption (R6).
 * A guide says what to look for, never how the assistant may behave (D24): `checkGuide` (R4, `check.mjs`) runs at every
 * draft, review, adoption and offer here, and again at every render (`skills` R40). A guide never grades, concludes or
 * names a body's conduct (R10): it has no field for any of these, and each item opens as a look-for statement.
 *
 * STATES. A member's draft is `usable_by_author` at once (R2); another member's approval makes it the group's (`group`,
 * R3), a refusal keeps it its author's with the reason. An adopted guide enters as `draft`, usable by no one until R3's
 * review in this group approves it (R6). `retired` guides stay readable (R7). Every act is a row of the history, in the
 * order written; nothing is deleted. A machine never drafts, reviews or approves: it proposes, apart (R12), and only a
 * member's R2 act naming the proposal (`based_on`) makes a guide of it.
 *
 * PROCEDURE GUIDES (R13; v0.2 rule 11). A guide's `purpose` is `reading` (the default) or `procedure`: a group's own
 * guide to the routes of one kind of action, its `kind` an `action_kinds` kind of the active profiles' view, its items
 * `{route, expect?, citation}`, checked by R4 narrowed for that purpose. R2, R3, R6–R8 and R12 hold for it as for a
 * reading guide; R5 answers reading guides only. `procedureGuidesFor` answers the profile's guide for a kind
 * (`jurisdictions` R80, through `combine`) first, then the group's approved procedure guides in the order approved,
 * unranked, every answer labeled legal information, not legal advice.
 *
 * SIGHT (R8, R9). A group guide, in any state, and a proposal are the group's: seen by a viewer membership admits as an
 * active member or an administrator, by a machine credential, and by an internal call with no viewer. Any other
 * viewer (one `viewerPredicate` denies, a member not active) sees Civicsmith's alone.
 *
 * REACHED as `readingGuidesOf(host, deps)` (K61): one instance per host, created on the first call with `deps`. At
 * creation it creates its tables and declares them with their classes (R9). `deps`:
 *   record, membership   the modules it uses, through their factories on the same host unless a test passes its own.
 *   groupSlug    `() → string|null`, the group's slug an offer is labeled with (R6; the plane composes it from
 *                `promotion`'s `producingGroup` fact). Absent or blank, an offer is refused `GUIDE_NO_GROUP_SLUG`.
 *   civicsmith   Civicsmith's library (default `CIVICSMITH_GUIDES`); a test passes entries of its own.
 *   now          the module's clock, an ISO instant (default: the wall clock).
 *   profileView  `() → view`, the active profiles combined (R13; default: `jurisdictions.combine` over record-core's
 *                `jurisdiction_profiles` setting; none combining, an empty view).
 *   profileList  `() → [id | profile]`, the active profiles and layers themselves (R17; default: record-core's
 *                `jurisdiction_profiles` setting), combined for the view and read layer by layer for the guides.
 *
 * LAYERS (R17, R18; T53). A kind's procedure guide from each active layer is answered beside the others, each naming its
 * layer, unranked: a layer's own guide is read from that layer (so two layers giving one kind never conflict here, and
 * whatever `combine` keeps of them is not read twice). A group guide drafted from a layer's guide records `layer`.
 *
 * OFFERED ONLY WITH ALL THREE (R19, R20; T53). A profile guide is answered only when `jurisdictions`' `attributionLacks`
 * answers none for it; else it is named in `not_offered` with what it lacks. A team's own guide is answered as before;
 * the team's sole member may opt it out of review (`guideOptOut`), and it then answers `not_reviewed` until a counted
 * professional review and R3's second approval are both recorded.
 *
 * No place is named here (R11). */
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { lawProposalState } from "../record-grammar/labels.mjs";
import { isGuideId } from "../record-grammar/ids.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { combine as combineProfiles, get as getProfile, attributionLacks, countedReview, textStanding } from "../../../jurisdictions/index.mjs";
import { READING_GUIDES_WORDS, refusal } from "./checks.mjs";
import { checkGuide, GUIDE_PURPOSES } from "./check.mjs";
import { CIVICSMITH_GUIDES, GUIDE_KINDS } from "./library.mjs";
import { READING_GUIDES_TABLE_CLASSES, migrateReadingGuides } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { READING_GUIDES_CHECKS, READING_GUIDES_WORDS } from "./checks.mjs";
export { checkGuide, registerConductCheck, conductCheckHolder, LOOK_FOR_OPENERS, CONDUCT_LISTS, ITEMS_MAX, LABEL_MAX,
         LOOK_FOR_MAX, WHERE_MAX, ITEM_FIELDS, GUIDE_PURPOSES, PROCEDURE_ITEM_FIELDS, ROUTE_MAX, EXPECT_MAX, CITATION_MAX,
         PROCEDURE_CONDUCT_LISTS } from "./check.mjs";
export { CIVICSMITH_GUIDES, GUIDE_KINDS, civicsmithGuideProblems, freezeLibrary } from "./library.mjs";
export { READING_GUIDES_SCHEMA, READING_GUIDES_TABLES, READING_GUIDES_TABLE_CLASSES } from "./schema.mjs";

/** The terms: a guide's origins and states. */
export const GUIDE_ORIGINS = Object.freeze(["civicsmith", "group", "adopted"]);
export const GUIDE_STATES = Object.freeze(["draft", "usable_by_author", "group", "retired"]);
/** R3: a review's two verdicts. */
export const GUIDE_VERDICTS = Object.freeze(["approve", "refuse"]);
/** R8: the most guides one list answers. */
export const GUIDES_MAX = 200;
/** R3, R7: a reason's length; R12: a run's name. */
export const REASON_MAX = 500, RUN_MAX = 200;
/** R6: the formats of an offer between groups and of a proposal for Civicsmith's library. */
export const GUIDE_OFFER_FORMAT = "bio-reading-guide-offer/1";
export const GUIDE_LIBRARY_PROPOSAL_FORMAT = "bio-reading-guide-library-proposal/1";

/** R13, R14: the label every procedure-guide answer carries, keyed for the surface, in canon's words (v0.2 rule 11):
 *  `words.json`'s `guide.procedure.legalinfo` (protected), read by that key, never a copy. */
export const PROCEDURE_GUIDE_LABEL = Object.freeze({ key: "guide.procedure.legalinfo",
                                                     says: READING_GUIDES_WORDS["guide.procedure.legalinfo"] });

/** R20: the statement every guide opted out of review carries, keyed for the surface (a word need of the design stream;
 *  the word table wins once it holds the key). */
export const NOT_REVIEWED_LABEL = Object.freeze({ key: "guide.procedure.notreviewed",
                                                  says: localize("guide.procedure.notreviewed", "This guide was not reviewed.") });

/** R12: what a proposal's label says, in each of `record-grammar`'s three proposal states (shaped as its
 *  `proposalLabel` answers; `lawProposalState` decides the state). */
export const GUIDE_PROPOSAL_STATES = Object.freeze({
  machine_proposed: word("reading-guides.machine_credential_proposed"),
  member_proposed: word("reading-guides.member_proposed_reading"),
  unstated: word("reading-guides.proposed_reading_guide"),
});

/** R12: a proposal's label, `{by, state, machine_work, says}`. */
export function guideProposalLabel(proposedBy) {
  const state = lawProposalState(proposedBy);
  return { by: proposedBy ?? null, state, machine_work: state === "machine_proposed", says: GUIDE_PROPOSAL_STATES[state] };
}

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };
const argsOf = (a) => (isObj(a) ? a : {});

export class ReadingGuides {
  #sql; #record; #membership; #now; #groupSlug; #civicsmith; #profileView; #profileList; #channel = null;

  constructor({ storage, record, membership, now = null, groupSlug = null, civicsmith = CIVICSMITH_GUIDES,
                profileView = null, profileList = null } = {}) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
    this.#groupSlug = typeof groupSlug === "function" ? groupSlug : () => null;
    this.#civicsmith = Array.isArray(civicsmith) ? civicsmith : CIVICSMITH_GUIDES;
    this.#profileView = typeof profileView === "function" ? profileView : null;
    this.#profileList = typeof profileList === "function" ? profileList : null;
    migrateReadingGuides(this.#sql);   // the tables exist once the instance does, so no caller migrates
  }

  /** The module's tables, created at construction; kept, idempotent, for the composition root's migration pass. */
  migrate() { migrateReadingGuides(this.#sql); }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { return this.#rows(q, ...a)[0] ?? null; }
  #instant() { return stampInstant("second", Date.parse(this.#now())); }

  /* ================================================================ who acts, who sees */

  /* The member `who` names when that member is active or an administrator, else null (a machine, a blank stamp, a
     viewer naming no member, a member not active). */
  #member(who) {
    if (!str(who) || isMachineIdentity(str(who))) return null;
    let m = null;
    /* the founder's own viewer, `admin`, names the founder (`member:admin` is the founder's session) */
    if (str(who) === "admin") m = "admin";
    else try { m = this.#membership.positionalMember(null, str(who)); } catch { m = null; }
    if (!str(m)) return null;
    try {
      if (this.#membership.isAdministrator(m)) return m;
      return this.#membership.memberFacts(m)?.status === "active" ? m : null;
    } catch { return null; }
  }

  /* R8, R9: whether `viewer` sees the group's guides and proposals. */
  #seesGroup(viewer) {
    if (viewer === undefined || viewer === null) return true;
    const g = viewerPredicate(viewer);
    if (g.scope === "DENY") return false;
    if (!g.member && g.scope === "member") return true;   // a machine credential
    return this.#member(viewer) !== null;
  }

  #civic(id) { return this.#civicsmith.find((g) => g.id === id) ?? null; }

  /* R13, R17: the active profiles and layers, as ids or profiles, or [] when none is set. */
  #profiles() {
    try {
      const l = this.#profileList ? this.#profileList() : this.#record.getSetting("jurisdiction_profiles");
      return Array.isArray(l) ? l : [];
    } catch { return []; }
  }

  /* R13: the active profiles combined (`jurisdictions` R12–R16), or an empty view when none is set or none combines. */
  #view() {
    try {
      if (this.#profileView) { const v = this.#profileView(); return isObj(v) ? v : {}; }
      const list = this.#profiles();
      if (!list.length) return {};
      const c = combineProfiles(list);
      return c && c.ok && isObj(c.view) ? c.view : {};
    } catch { return {}; }
  }

  /* R17: each profile guide for `kind`, `{pg, layer}`: every active layer's own (`layer` its id), in the view's order of
     layers, then the view's guides that no active layer holds (a profile that is no layer; `layer` null). */
  #profileGuides(view, kind) {
    const byId = new Map(this.#profiles().filter(isObj).map((p) => [p.id, p]));
    const layerOf = (id) => { if (byId.has(id)) return byId.get(id); try { return getProfile(id); } catch { return null; } };
    const layers = (Array.isArray(view.layers) ? view.layers : []).map((l) => (isObj(l) ? l.id : null)).filter((x) => typeof x === "string");
    const ids = new Set(layers), out = [];
    const mine = (g) => isObj(g) && g.kind === kind && Array.isArray(g.items);
    for (const id of layers) {
      const p = layerOf(id);
      for (const g of isObj(p) && Array.isArray(p.procedure_guides) ? p.procedure_guides : []) if (mine(g)) out.push({ pg: g, layer: id });
    }
    for (const g of Array.isArray(view.procedure_guides) ? view.procedure_guides : [])
      if (mine(g) && !ids.has(g.layer) && !ids.has(g.profile)) out.push({ pg: g, layer: null });
    return out;
  }

  /* R13: the action kinds of the active profiles' view. */
  #actionKinds(view = this.#view()) {
    return Array.isArray(view.action_kinds) ? view.action_kinds.map((k) => (isObj(k) ? k.kind : null)).filter((k) => typeof k === "string") : [];
  }

  /* R2, R13: `kind`'s refusal for `purpose`, or null when the kind is one of that purpose's. */
  #kindRefused(kind, purpose) {
    if (purpose === "reading") return GUIDE_KINDS.includes(kind) ? null : kindRefusal(kind, purpose, GUIDE_KINDS);
    if (purpose === "procedure") { const k = this.#actionKinds(); return k.includes(kind) ? null : kindRefusal(kind, purpose, k); }
    return kindRefusal(kind, purpose, null);
  }

  /* A held group guide's row, or null. */
  #held(id) { return isGuideId(id) ? this.#one(`SELECT * FROM reading_guides WHERE guide_id=?`, id) : null; }

  /* The guide an act names, or its refusal: Civicsmith's are read-only, a retired one is done with. */
  #actOn(id) {
    if (isGuideId(id) && this.#civic(id)) return { refused: readOnly(id) };
    const row = this.#held(id);
    if (!row) return { refused: noSuchGuide(id) };
    if (row.state === "retired") return { refused: retiredRefusal(id) };
    return { row };
  }

  #history(id, act, state, by, reason, at) {
    this.#sql.exec(`INSERT INTO reading_guide_history (guide_id, act, state, by_member, reason, at) VALUES (?,?,?,?,?,?)`,
      id, act, state, by, reason ?? null, at);
  }

  #mint(at) {
    const r = this.#record.allocId("GUD", at.slice(0, 4));
    return r && typeof r.id === "string" ? { id: r.id } : { refused: r };
  }

  /* ================================================================ R2: a member's draft */

  /** R2, R13, R18: `{kind, items, purpose?, based_on?, layer?, by}`. Usable by its author at once. `purpose` `reading`
   *  (the default) or `procedure`. `based_on`, when given, names a guide the author sees, one of Civicsmith's, or a
   *  proposal (R12). `layer` (R18), for a procedure guide drafted from a layer's guide, names an active layer that gives
   *  a guide for `kind`, and is recorded (else `GUIDE_BASED_ON_UNKNOWN`); without it the guide is the team's for the kind
   *  in every layer. Answers `{ok, guide, state, purpose, layer?}`. */
  guideDraft(args) {
    const { kind, items, purpose: p, based_on: basedOn, layer: l, by } = argsOf(args);
    const member = this.#member(by);
    if (!member) return memberRefusal(localize("reading-guides.index.writing_a_reading_guide", "writing a reading guide"));
    const purpose = purposeOf(p);
    const badKind = this.#kindRefused(kind, purpose);
    if (badKind) return badKind;
    const checked = checkGuide(items, purpose);
    if (!checked.ok) return checked;
    const basis = basedOn === undefined || basedOn === null || basedOn === "" ? null : basedOn;
    const layer = l === undefined || l === null || l === "" ? null : l;
    const layerKnown = layer === null || (purpose === "procedure" && typeof layer === "string"
      && this.#profileGuides(this.#view(), kind).some((x) => x.layer === layer));
    /* DEC-49 REGION is-guide-basis */
    if ((basis !== null && !(isGuideId(basis) && (this.#civic(basis) || this.#held(basis)
        || this.#one(`SELECT 1 AS x FROM reading_guide_proposals WHERE proposal_id=?`, basis)))) || !layerKnown)
      return refusal("GUIDE_BASED_ON_UNKNOWN", localize("reading-guides.index.the_guide_or_proposal_named", "the guide or proposal named as this guide's basis is not one you can see. Nothing was written."), { based_on: typeof basis === "string" ? basis.slice(0, 100) : null, ...(layerKnown ? {} : { layer: typeof layer === "string" ? layer.slice(0, 100) : null }) });
    /* END DEC-49 REGION is-guide-basis */
    const at = this.#instant();
    return this.#record.transact(() => {
      const m = this.#mint(at);
      if (m.refused) return m.refused;
      this.#sql.exec(`INSERT INTO reading_guides (guide_id, kind, purpose, origin, items_json, state, author, reviewed_by,
                        based_on, offered_by, layer, created_at, updated_at) VALUES (?,?,?,'group',?,'usable_by_author',?,NULL,?,NULL,?,?,?)`,
        m.id, kind, purpose, canonicalJson(checked.items), member, basis, layer, at, at);
      this.#history(m.id, "draft", "usable_by_author", member, null, at);
      return { ok: true, guide: m.id, state: "usable_by_author", purpose, ...(layer !== null ? { layer } : {}), at };
    });
  }

  /* ================================================================ R12: a machine's proposal, apart */

  /** R12, R13: `{kind, items, purpose?, run, by}`, `by` a machine credential and `run` the run that proposed it. Stored
   *  apart from the guides, labeled; it is no guide. Answers `{ok, proposal, purpose, label}`. */
  guidePropose(args) {
    const { kind, items, purpose: p, run, by } = argsOf(args);
    /* DEC-49 REGION is-guide-machine */
    if (!str(by) || !isMachineIdentity(str(by)))
      return refusal("GUIDE_PROPOSAL_NOT_MACHINE", localize("reading-guides.index.a_proposed_guide_is_a", "a proposed guide is a machine credential's work; a member writes a guide directly. Nothing was written."));
    /* END DEC-49 REGION is-guide-machine */
    /* DEC-49 REGION is-guide-run */
    if (!str(run) || str(run).length > RUN_MAX)
      return refusal("GUIDE_RUN_MISSING", localize("reading-guides.index.a_proposed_guide_names_the", "a proposed guide names the run that proposed it, in at most {RUN_MAX} characters. Nothing was written.", { RUN_MAX: String(RUN_MAX) }));
    /* END DEC-49 REGION is-guide-run */
    const purpose = purposeOf(p);
    const badKind = this.#kindRefused(kind, purpose);
    if (badKind) return badKind;
    const checked = checkGuide(items, purpose);
    if (!checked.ok) return checked;
    const at = this.#instant();
    return this.#record.transact(() => {
      const m = this.#mint(at);
      if (m.refused) return m.refused;
      this.#sql.exec(`INSERT INTO reading_guide_proposals (proposal_id, kind, purpose, items_json, run, proposed_by, at)
                      VALUES (?,?,?,?,?,?,?)`, m.id, kind, purpose, canonicalJson(checked.items), str(run), str(by), at);
      return { ok: true, proposal: m.id, purpose, label: guideProposalLabel(str(by)), at };
    });
  }

  /** R12: the proposals the viewer may see, newest first, at most 200 (`truncated`), each with its label. */
  guideProposals(args) {
    try {
      const { kind, viewer, limit } = argsOf(args);
      if (!this.#seesGroup(viewer)) return { ok: true, proposals: [], truncated: false };
      const n = capOf(limit);
      const rows = kind === undefined || kind === null
        ? this.#rows(`SELECT * FROM reading_guide_proposals ORDER BY at DESC, proposal_id LIMIT ?`, n + 1)
        : this.#rows(`SELECT * FROM reading_guide_proposals WHERE kind=? ORDER BY at DESC, proposal_id LIMIT ?`, String(kind), n + 1);
      return { ok: true, truncated: rows.length > n,
               proposals: rows.slice(0, n).map((r) => ({ proposal: r.proposal_id, kind: r.kind, purpose: r.purpose, items: safeJson(r.items_json),
                 run: r.run, at: r.at, label: guideProposalLabel(r.proposed_by) })) };
    } catch {
      return { ok: true, proposals: [], truncated: false };
    }
  }

  /* ================================================================ R3: review */

  /** R3: `{guide, verdict, reason, by}` by an active member other than the guide's author. `approve` makes it the
   *  group's; `refuse` keeps it as it was (its author's, or an adopted guide still unusable) with the reason, which a
   *  refusal must give. R4 runs again over its items. R20: an approval may record a professional's review of the guide
   *  as it stands, `professional: {reviewer, organisation, credential, outcome, scope?, at}` (`jurisdictions` R40's
   *  shape, its `reviewed_text_sha` the guide's items' hash, taken here); whether it counts is `jurisdictions`'
   *  `countedReview`. Answers `{ok, guide, verdict, state}`. */
  guideReview(args) {
    const { guide, verdict, reason, by, professional } = argsOf(args);
    const member = this.#member(by);
    if (!member) return memberRefusal(localize("reading-guides.index.reviewing_a_reading_guide", "reviewing a reading guide"));
    const { row, refused } = this.#actOn(guide);
    if (refused) return refused;
    /* DEC-49 REGION is-guide-reviewable */
    if (row.state !== "usable_by_author" && row.state !== "draft")
      return refusal("GUIDE_NOT_REVIEWABLE", localize("reading-guides.index.guide_id_is_already_the", "{guide_id} is already the team's. Nothing was written.", { guide_id: String(row.guide_id) }), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-reviewable */
    /* DEC-49 REGION is-guide-reviewer */
    if (row.author === member)
      return refusal("GUIDE_REVIEW_BY_AUTHOR", localize("reading-guides.index.guide_id_was_written_or", "{guide_id} was written or adopted by the member reviewing it. Nothing was written.", { guide_id: String(row.guide_id) }), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-reviewer */
    /* DEC-49 REGION is-guide-verdict */
    if (!GUIDE_VERDICTS.includes(verdict))
      return refusal("GUIDE_VERDICT_UNKNOWN", localize("reading-guides.index.a_reviews_verdict_is_approve", "a review's verdict is approve or refuse. Nothing was written."), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-verdict */
    const why = str(reason);
    if (verdict === "refuse" || why) {
      const bad = reasonRefusal(why, verdict === "refuse");
      if (bad) return bad;
    }
    const checked = checkGuide(safeJson(row.items_json), row.purpose);
    if (!checked.ok) return { ...checked, guide: row.guide_id };
    const at = this.#instant();
    const state = verdict === "approve" ? "group" : row.state;
    const pro = verdict === "approve" && isObj(professional) ? professionalReview(professional, checked.items) : null;
    return this.#record.transact(() => {
      if (verdict === "approve")
        this.#sql.exec(`UPDATE reading_guides SET state='group', reviewed_by=?, updated_at=? WHERE guide_id=?`, member, at, row.guide_id);
      if (pro) {
        const held = safeJson(row.reviews_json);
        this.#sql.exec(`UPDATE reading_guides SET reviews_json=? WHERE guide_id=?`,
          canonicalJson([...(Array.isArray(held) ? held : []), pro]), row.guide_id);
      }
      this.#history(row.guide_id, verdict, state, member, why || null, at);
      return { ok: true, guide: row.guide_id, verdict, state, at };
    });
  }

  /* ================================================================ R20: a sole member's opt-out of review */

  /** R20 (K5508, K5527): `{guide, viewer}`. The one member of a team opts the team's own guide out of the professional
   *  review and the separate approver, both, and of nothing else; recorded on the guide as `review_opt_out: {member, at}`
   *  and in its history. Refused `MACHINE_CANNOT_OPT_OUT` to a machine, `GUIDE_MEMBER_ACT` to a viewer who is no active
   *  member, `OPT_OUT_NOT_OWN_GUIDE` for any guide but the team's own procedure guide (an adopted guide and a reading
   *  guide are not), and `OPT_OUT_NOT_SOLE_MEMBER` while the team has more than one active member (the founder, once
   *  the instance is claimed, counted as one); each records nothing. A
   *  guide already opted out answers its record (`already: true`). The record stays when the team grows. */
  guideOptOut(args) {
    const { guide, viewer } = argsOf(args);
    /* DEC-49 REGION is-guide-person */
    if (str(viewer) && isMachineIdentity(str(viewer)))
      return refusal("MACHINE_CANNOT_OPT_OUT", localize("reading-guides.index.a_machine_cannot_opt_out", "a machine cannot opt a guide out of review. Nothing was written."), { guide: typeof guide === "string" ? guide.slice(0, 100) : null });
    /* END DEC-49 REGION is-guide-person */
    const member = this.#member(viewer);
    if (!member) return memberRefusal(localize("reading-guides.index.opting_a_guide_out_of_review", "opting a guide out of review"));
    const { row, refused } = this.#actOn(guide);
    if (refused) return refused;
    /* DEC-49 REGION is-guide-team-procedure */
    if (row.origin !== "group" || row.purpose !== "procedure")
      return refusal("OPT_OUT_NOT_OWN_GUIDE", localize("reading-guides.index.only_a_teams_own_procedure", "{guide_id} is not the team's own procedure guide, so it cannot be opted out of review. Nothing was written.", { guide_id: String(row.guide_id) }), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-team-procedure */
    const held = safeJson(row.review_opt_json);
    if (isObj(held)) return { ok: true, already: true, guide: row.guide_id, review_opt_out: { member: held.member, at: held.at } };
    let members = null;
    try { members = this.#membership.memberList({}).members.filter((m) => m && m.status === "active").length; } catch { members = null; }
    /* DEC-49 REGION is-guide-sole-member */
    if (members !== 1)
      return refusal("OPT_OUT_NOT_SOLE_MEMBER", localize("reading-guides.index.only_a_teams_one_member", "only the one member of a team may opt out of the review of its guide; this team has {n}. Nothing was written.", { n: String(members ?? "?") }), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-sole-member */
    const at = this.#instant();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE reading_guides SET review_opt_json=?, updated_at=? WHERE guide_id=?`, canonicalJson({ member, at }), at, row.guide_id);
      this.#history(row.guide_id, "opt_out", row.state, member, null, at);
      return { ok: true, guide: row.guide_id, review_opt_out: { member, at }, at };
    });
  }

  /* ================================================================ R7: retire */

  /** R7: `{guide, reason, by}`. A guide that is its author's (`usable_by_author`, or an adopted `draft`) is retired by
   *  its author; a group's guide by any active member other than its author (R3's approvers). The guide stays
   *  readable. Answers `{ok, guide, state: "retired"}`. */
  guideRetire(args) {
    const { guide, reason, by } = argsOf(args);
    const member = this.#member(by);
    if (!member) return memberRefusal(localize("reading-guides.index.retiring_a_reading_guide", "retiring a reading guide"));
    const { row, refused } = this.#actOn(guide);
    if (refused) return refused;
    const approver = row.state === "group" ? row.author !== member : row.author === member;
    /* DEC-49 REGION is-guide-approver */
    if (!approver)
      return refusal("GUIDE_RETIRE_NOT_APPROVER", row.state === "group"
        ? localize("reading-guides.index.guide_id_is_the_teams", "{guide_id} is the team's, and is retired by a member other than its author. Nothing was written.", { guide_id: String(row.guide_id) })
        : localize("reading-guides.index.guide_id_is_its_authors", "{guide_id} is its author's, and is retired by its author. Nothing was written.", { guide_id: String(row.guide_id) }), { guide: row.guide_id });
    /* END DEC-49 REGION is-guide-approver */
    const bad = reasonRefusal(str(reason), true);
    if (bad) return bad;
    const at = this.#instant();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE reading_guides SET state='retired', updated_at=? WHERE guide_id=?`, at, row.guide_id);
      this.#history(row.guide_id, "retire", "retired", member, str(reason), at);
      return { ok: true, guide: row.guide_id, state: "retired", at };
    });
  }

  /* ================================================================ R6: across groups */

  /** R6 (K31's pattern): the one channel between groups (`network-notices`, later; BOB's). `fn(offer)` is handed each
   *  offer and each proposal for Civicsmith's library once made; its answer is reported, its failure changes nothing. */
  registerGuideChannel(module, fn) {
    if (typeof module !== "string" || !module || typeof fn !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED", detail: "a channel names the module that registers it and its function" };
    if (this.#channel)
      return { ok: false, reason: "PROVIDER_DECLARED", module, detail: localize("reading-guides.index.module_already_provides_the_channel", "{module} already provides the channel between teams", { module: String(this.#channel.module) }) };
    this.#channel = { module, fn };
    return { ok: true, module };
  }

  /** R6: `{guide, by}` by an active member: the group's guide as canonical bytes and their digest, labeled with this
   *  group's slug, for another group to adopt. Answers `{ok, guide, bytes, digest, group, channel?}`. */
  guideOffer(args) { return this.#export(argsOf(args), GUIDE_OFFER_FORMAT, "offer"); }

  /** R6: the same export, marked as a proposal for Civicsmith's library. Its adoption there is a release's. */
  guideProposeToCivicsmith(args) { return this.#export(argsOf(args), GUIDE_LIBRARY_PROPOSAL_FORMAT, "propose_to_civicsmith"); }

  #export({ guide, by }, format, act) {
    const member = this.#member(by);
    if (!member) return memberRefusal(localize("reading-guides.index.offering_a_reading_guide", "offering a reading guide"));
    const { row, refused } = this.#actOn(guide);
    if (refused) return refused;
    const off = offerable(row);
    if (off) return off;
    const items = safeJson(row.items_json);
    const checked = checkGuide(items, row.purpose);
    if (!checked.ok) return { ...checked, guide: row.guide_id };
    let slug = null;
    try { slug = str(this.#groupSlug()); } catch { slug = null; }
    if (!slug) return slugRefusal();
    /* a reading guide's bytes are as before R13; a procedure guide's carry its purpose */
    const bytes = canonicalJson({ format, group: slug, guide: row.guide_id, kind: row.kind, items: checked.items,
                                  ...(row.purpose === "procedure" ? { purpose: "procedure" } : {}) });
    const digest = `sha256:${sha256HexSync(bytes)}`;
    const at = this.#instant();
    this.#record.transact(() => { this.#history(row.guide_id, act, row.state, member, null, at); });
    const out = { ok: true, guide: row.guide_id, bytes, digest, group: slug, at };
    if (this.#channel) {
      try {
        const sent = this.#channel.fn({ format, bytes, digest, group: slug, guide: row.guide_id });
        if (sent && typeof sent.then === "function") { sent.then(null, () => {}); out.channel = { module: this.#channel.module, pending: true }; }
        else out.channel = { module: this.#channel.module, answer: sent ?? null };
      } catch (e) {
        out.channel = { module: this.#channel.module, failed: String(e && e.message ? e.message : e).slice(0, 200) };
      }
    }
    return out;
  }

  /** R6, R13: `{bytes, by}`: another group's offer, imported as `adopted`, `based_on` the offer's digest, `draft` until
   *  R3's review here approves it; a procedure guide's kind must be an action kind of this group's view. An offer
   *  already adopted and not retired answers that guide (`already: true`). Answers `{ok, guide, state: "draft",
   *  purpose, based_on, offered_by}`. */
  guideAdopt(args) {
    const { bytes, by } = argsOf(args);
    const member = this.#member(by);
    if (!member) return memberRefusal(localize("reading-guides.index.adopting_a_reading_guide", "adopting a reading guide"));
    const offer = typeof bytes === "string" && bytes.length <= 200000 ? safeJson(bytes) : null;
    const whole = isObj(offer) && canonicalJson(offer) === bytes && offer.format === GUIDE_OFFER_FORMAT
      && str(offer.group) !== "" && str(offer.group).length <= 100 && isGuideId(offer.guide)
      && (Object.keys(offer).sort().join() === "format,group,guide,items,kind"
          || (Object.keys(offer).sort().join() === "format,group,guide,items,kind,purpose" && offer.purpose === "procedure"));
    /* DEC-49 REGION is-guide-offer */
    if (!whole)
      return refusal("GUIDE_OFFER_UNREADABLE", localize("reading-guides.index.what_was_given_is_not", "what was given is not another team's offer of a reading guide, byte for byte as offered. Nothing was written."));
    /* END DEC-49 REGION is-guide-offer */
    const purpose = purposeOf(offer.purpose);
    const badKind = this.#kindRefused(offer.kind, purpose);
    if (badKind) return badKind;
    const checked = checkGuide(offer.items, purpose);
    if (!checked.ok) return checked;
    const digest = `sha256:${sha256HexSync(bytes)}`;
    const held = this.#one(`SELECT guide_id, state FROM reading_guides WHERE origin='adopted' AND based_on=? AND state<>'retired'
                            ORDER BY created_at, guide_id LIMIT 1`, digest);
    if (held) return { ok: true, already: true, guide: held.guide_id, state: held.state, purpose, based_on: digest, offered_by: str(offer.group) };
    const at = this.#instant();
    return this.#record.transact(() => {
      const m = this.#mint(at);
      if (m.refused) return m.refused;
      this.#sql.exec(`INSERT INTO reading_guides (guide_id, kind, purpose, origin, items_json, state, author, reviewed_by,
                        based_on, offered_by, created_at, updated_at) VALUES (?,?,?,'adopted',?,'draft',?,NULL,?,?,?,?)`,
        m.id, offer.kind, purpose, canonicalJson(checked.items), member, digest, str(offer.group), at, at);
      this.#history(m.id, "adopt", "draft", member, null, at);
      return { ok: true, guide: m.id, state: "draft", purpose, based_on: digest, offered_by: str(offer.group), at };
    });
  }

  /* ================================================================ R5, R8: reads */

  /** R5: the reading guide in force for `kind`: the viewer's own usable guide, else the group's, else Civicsmith's, else none;
   *  each candidate passes R4 again, and one that no longer does is passed over and named in `withheld`. Answers
   *  `{ok: true, kind, guide, origin, withheld}`, `guide` null with `origin` null for none. Never throws. */
  guideFor(args) {
    const none = (kind, withheld = []) => ({ ok: true, kind: typeof kind === "string" ? kind : null, guide: null, origin: null, withheld });
    try {
      const { kind, viewer } = argsOf(args);
      if (!GUIDE_KINDS.includes(kind)) return none(kind);
      const withheld = [];
      const pass = (g) => {
        if (!g) return null;
        const c = checkGuide(g.items);
        if (c.ok) return g;
        withheld.push({ guide: g.id, origin: g.origin, reason: c.reason, item: c.item ?? null });
        return null;
      };
      const sees = this.#seesGroup(viewer);
      const member = viewer === undefined || viewer === null ? null : this.#member(viewer);
      if (sees && member) {
        for (const r of this.#rows(`SELECT * FROM reading_guides WHERE kind=? AND purpose='reading' AND state='usable_by_author'
                                     AND author=? ORDER BY updated_at DESC, guide_id`, kind, member)) {
          const g = pass(viewOf(r));
          if (g) return { ok: true, kind, guide: g, origin: g.origin, withheld };
        }
      }
      if (sees) {
        for (const r of this.#rows(`SELECT * FROM reading_guides WHERE kind=? AND purpose='reading' AND state='group'
                                     ORDER BY updated_at DESC, guide_id`, kind)) {
          const g = pass(viewOf(r));
          if (g) return { ok: true, kind, guide: g, origin: g.origin, withheld };
        }
      }
      for (const c of this.#civicsmith.filter((x) => x.kind === kind)) {
        const g = pass(civicView(c));
        if (g) return { ok: true, kind, guide: g, origin: "civicsmith", withheld };
      }
      return none(kind, withheld);
    } catch {
      return none(null);
    }
  }

  /** R8, R13: `{kind?, state?, purpose?, viewer, limit?}`: the guides the viewer may see, Civicsmith's first, then the
   *  group's in the order made; at most 200 (`limit` may lower it), `truncated` when more were held. `purpose` narrows
   *  to reading or procedure guides (Civicsmith's are reading guides). Never throws. */
  guidesOf(args) {
    try {
      const { kind, state, purpose, viewer, limit } = argsOf(args);
      const n = capOf(limit);
      const purposeOk = purpose === undefined || purpose === null || GUIDE_PURPOSES.includes(purpose);
      const kindOk = kind === undefined || kind === null
        || (typeof kind === "string" && (GUIDE_KINDS.includes(kind) || (purpose !== "reading" && this.#actionKinds().includes(kind))));
      const stateOk = state === undefined || state === null || GUIDE_STATES.includes(state);
      if (!kindOk || !stateOk || !purposeOk) return { ok: true, guides: [], truncated: false };
      const civic = purpose === "procedure" ? []
        : this.#civicsmith.filter((g) => (kind == null || g.kind === kind) && (state == null || g.state === state)).map(civicView);
      let group = [];
      if (this.#seesGroup(viewer)) {
        const where = [], a = [];
        if (kind != null) { where.push("kind=?"); a.push(kind); }
        if (state != null) { where.push("state=?"); a.push(state); }
        if (purpose != null) { where.push("purpose=?"); a.push(purpose); }
        group = this.#rows(`SELECT * FROM reading_guides ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                            ORDER BY created_at, guide_id LIMIT ?`, ...a, n + 1).map(viewOf);
      }
      const all = [...civic, ...group];
      return { ok: true, guides: all.slice(0, n), truncated: all.length > n };
    } catch {
      return { ok: true, guides: [], truncated: false };
    }
  }

  /** R13 (K2820), R15, R17-R20: the procedure guides for an action `kind`, side by side and unranked.
   *  The profile's first (R17): each active layer's own guide for the kind, `{origin: "profile", layer, items, status,
   *  basis, reviewed, statements}` (`layer` the layer's id, absent for a profile that is no layer; `reviewed` and
   *  `statements` `jurisdictions`' `textStanding` on the day: "reviewed by", a changed source, the 12-month line), its
   *  items as R80 holds them, `after` included; a profile guide is answered only when `attributionLacks` answers none
   *  for it (R19), else it is named in `not_offered: [{kind, layer?, lacks}]` (present only when one is), and one
   *  layer's guide not offered hides no other's. Then the group's (the group's when the viewer sees the group, R8), each
   *  `{guide, origin, items, layer?, approved_by, approved_at, reviewed?}`: the approved in the order approved, then the
   *  ones its sole member opted out of review (R20) not yet approved; an opted-out guide answers `not_reviewed:
   *  {member, at}` and the statement `label` (`NOT_REVIEWED_LABEL`), never `reviewed`, until a counted professional
   *  review and R3's approval are both recorded, which give `reviewed` instead. Each passes R4's procedure check again;
   *  one that no longer does is passed over and named in `withheld`. Every answer carries `label`
   *  (`PROCEDURE_GUIDE_LABEL`). Answers `{ok: true, kind, guides, withheld, label, not_offered?}`; served by
   *  `op=procedureguides`. Never throws. */
  procedureGuidesFor(args) {
    const label = { ...PROCEDURE_GUIDE_LABEL };
    try {
      const { kind, viewer } = argsOf(args);
      const view = this.#view();
      if (typeof kind !== "string" || !this.#actionKinds(view).includes(kind))
        return { ok: true, kind: typeof kind === "string" ? kind.slice(0, 100) : null, guides: [], withheld: [], label };
      const guides = [], withheld = [], notOffered = [];
      const pass = (g, items) => {
        const c = checkGuide(items, "procedure");
        const { profile, ...answer } = g;
        if (c.ok) guides.push(answer);
        else withheld.push({ guide: g.guide ?? null, origin: g.origin, profile: profile ?? null, ...(g.layer ? { layer: g.layer } : {}), reason: c.reason, item: c.item ?? null });
      };
      const today = String(this.#now()).slice(0, 10);
      for (const { pg, layer } of this.#profileGuides(view, kind)) {
        const lacks = attributionLacks(pg);
        if (lacks.length) { notOffered.push({ kind, ...(layer ? { layer } : {}), lacks }); continue; }
        const items = pg.items.map((it) => (isObj(it) ? { ...it, ...(Array.isArray(it.after) ? { after: [...it.after] } : {}) } : it));
        const { reviewed, statements } = textStanding(pg, today);
        /* R80's `after` (R87 (d)) is the profile's own field, carried as given; the check reads the route's texts */
        pass({ origin: "profile", ...(layer ? { layer } : {}), items, status: pg.status ?? null, basis: pg.basis ?? null, reviewed,
               statements, profile: layer ?? pg.profile ?? null },
             items.map((it) => (isObj(it) ? Object.fromEntries(Object.entries(it).filter(([k]) => k !== "after")) : it)));
      }
      if (this.#seesGroup(viewer)) {
        const rows = this.#rows(`SELECT g.*, a.seq AS approved_seq, h.at AS approved_at FROM reading_guides g
                                   LEFT JOIN (SELECT guide_id, MIN(seq) AS seq FROM reading_guide_history WHERE act='approve' GROUP BY guide_id) a
                                     ON a.guide_id = g.guide_id
                                   LEFT JOIN reading_guide_history h ON h.seq = a.seq
                                 WHERE g.kind=? AND g.purpose='procedure'
                                   AND ((g.state='group' AND a.seq IS NOT NULL) OR (g.state<>'retired' AND g.review_opt_json IS NOT NULL))
                                 ORDER BY (a.seq IS NULL OR g.state<>'group'), a.seq, g.updated_at, g.guide_id`, kind);
        for (const r of rows) {
          const g = viewOf(r);
          const approved = r.state === "group" && r.approved_seq !== null && r.approved_seq !== undefined;
          const reviews = safeJson(r.reviews_json);
          const counted = countedReview({ items: g.items, reviews: Array.isArray(reviews) ? reviews : [] });
          const answer = { guide: g.id, origin: g.origin, items: g.items, ...(g.layer ? { layer: g.layer } : {}),
                           ...(approved ? { approved_by: g.reviewed_by, approved_at: String(r.approved_at).slice(0, 10) } : {}) };
          if (g.review_opt_out && !(approved && counted)) {
            answer.not_reviewed = { ...g.review_opt_out };
            answer.label = { ...NOT_REVIEWED_LABEL };
          } else if (counted) answer.reviewed = { name: counted.reviewer, organisation: counted.organisation, at: counted.at };
          pass(answer, g.items);
        }
      }
      return { ok: true, kind, guides, withheld, label, ...(notOffered.length ? { not_offered: notOffered } : {}) };
    } catch {
      return { ok: true, kind: null, guides: [], withheld: [], label };
    }
  }

  /** R3, R7: one guide the viewer may see, with its history in the order written (`{act, state, by, reason, at}`), or
   *  `NO_SUCH_GUIDE`. Civicsmith's carry no history here. */
  guideRead(args) {
    const { guide, viewer } = argsOf(args);
    const c = isGuideId(guide) ? this.#civic(guide) : null;
    if (c) return { ok: true, guide: civicView(c), history: [] };
    const row = this.#seesGroup(viewer) ? this.#held(guide) : null;
    if (!row) return noSuchGuide(guide);
    const history = this.#rows(`SELECT act, state, by_member, reason, at FROM reading_guide_history WHERE guide_id=? ORDER BY seq`, row.guide_id)
      .map((h) => ({ act: h.act, state: h.state, by: h.by_member, reason: h.reason ?? null, at: h.at }));
    return { ok: true, guide: viewOf(row), history };
  }
}

/* ================================================================ views */

/* R18, R20: `layer` and `review_opt_out` are answered only when held, so a guide written before T53 answers as before. */
function viewOf(r) {
  const opt = typeof r.review_opt_json === "string" ? safeJson(r.review_opt_json) : null;
  return { id: r.guide_id, kind: r.kind, purpose: r.purpose ?? "reading", origin: r.origin, items: safeJson(r.items_json), state: r.state, author: r.author,
           reviewed_by: r.reviewed_by ?? null, based_on: r.based_on ?? null, offered_by: r.offered_by ?? null,
           ...(typeof r.layer === "string" && r.layer ? { layer: r.layer } : {}),
           ...(isObj(opt) ? { review_opt_out: { member: opt.member ?? null, at: opt.at ?? null } } : {}) };
}

/* R20: a professional's review as R3's approval records it, in `jurisdictions` R40's shape: its text fields kept when
   they are short text, `kind` professional, and `reviewed_text_sha` the hash of the items as they stand (K5528 T2). */
function professionalReview(p, items) {
  const out = { kind: "professional" };
  for (const f of ["reviewer", "organisation", "credential", "scope", "outcome", "at"])
    if (typeof p[f] === "string" && p[f].trim() && p[f].length <= 200) out[f] = p[f].trim();
  out.reviewed_text_sha = sha256HexSync(canonicalJson(items));
  return out;
}

function civicView(g) {
  return { id: g.id, kind: g.kind, purpose: "reading", origin: "civicsmith", items: g.items.map((it) => ({ ...it })), state: g.state, author: g.author,
           reviewed_by: g.reviewed_by, based_on: g.based_on ?? null, approved_by: g.approved_by,
           measured_use: { ...g.measured_use } };
}

/* R13: a guide's purpose as given, `reading` when absent; anything else is kept, for its refusal. */
const purposeOf = (p) => (p === undefined || p === null || p === "" ? "reading" : p);

const capOf = (limit) => (Number.isInteger(limit) && limit >= 1 && limit < GUIDES_MAX ? limit : GUIDES_MAX);

/* ================================================================ refusals minted at one site each (DEC-49) */

/* R2, R3, R6, R7: every act on a guide is an active member's. */
function memberRefusal(act) {
  /* DEC-49 REGION is-guide-member */
  return refusal("GUIDE_MEMBER_ACT", localize("reading-guides.index.act_is_an_active_members", "{act} is an active member's act; an assistant may propose a guide for a member to take up. Nothing was written.", { act: String(act) }));
  /* END DEC-49 REGION is-guide-member */
}

/* R2, R13: a kind outside its purpose's kinds (`kinds`), or a purpose outside `GUIDE_PURPOSES` (`kinds` null). */
function kindRefusal(kind, purpose, kinds) {
  const detail = !kinds ? localize("reading-guides.index.a_guides_purpose_is_reading", "a guide's purpose is reading or procedure. Nothing was written.")
    : purpose === "procedure"
      ? (kinds.length ? localize("reading-guides.index.a_procedure_guide_is_for_one_of", "a procedure guide is for one of the action kinds of the team's jurisdiction profiles: {kinds}. Nothing was written.", { kinds: String(kinds.join(", ")) })
                      : localize("reading-guides.index.a_procedure_guide_is_for_an_action", "a procedure guide is for an action kind of the team's jurisdiction profiles, and they list none. Nothing was written."))
      : localize("reading-guides.index.a_reading_guide_is_for", "a reading guide is for one of these kinds of document: {kinds}. Nothing was written.", { kinds: String(kinds.join(", ")) });
  /* DEC-49 REGION is-guide-kind */
  return refusal("GUIDE_KIND_UNKNOWN", detail,
    { kind: typeof kind === "string" ? kind.slice(0, 100) : null, ...(kinds ? {} : { purpose: typeof purpose === "string" ? purpose.slice(0, 100) : null }) });
  /* END DEC-49 REGION is-guide-kind */
}

function noSuchGuide(id) {
  /* DEC-49 REGION is-guide-held */
  return refusal("NO_SUCH_GUIDE", localize("reading-guides.index.no_reading_guide_you_can", "no reading guide you can see answers to that id. Nothing was written."),
    { guide: typeof id === "string" ? id.slice(0, 100) : null });
  /* END DEC-49 REGION is-guide-held */
}

function readOnly(id) {
  /* DEC-49 REGION is-guide-ours */
  return refusal("GUIDE_READ_ONLY", localize("reading-guides.index.id_comes_with_every_copy", "{id} comes with every copy of Civicsmith and no team can change it. Nothing was written.", { id: String(id) }),
    { guide: id });
  /* END DEC-49 REGION is-guide-ours */
}

function retiredRefusal(id) {
  /* DEC-49 REGION is-guide-live */
  return refusal("GUIDE_RETIRED", localize("reading-guides.index.id_has_been_retired", "{id} has been retired. Nothing was written.", { id: String(id) }), { guide: id });
  /* END DEC-49 REGION is-guide-live */
}

/* R3, R7: a reason, required for a refusal and a retirement, at most 500 characters wherever given. */
function reasonRefusal(why, required) {
  /* DEC-49 REGION is-guide-reason */
  if ((required && !why) || why.length > REASON_MAX)
    return refusal("GUIDE_REASON_MISSING", localize("reading-guides.index.a_reason_is_given_in", "a reason is given in at most {REASON_MAX} characters. Nothing was written.", { REASON_MAX: String(REASON_MAX) }));
  /* END DEC-49 REGION is-guide-reason */
  return null;
}

/* R6: only the group's guide is offered. */
function offerable(row) {
  /* DEC-49 REGION is-guide-offerable */
  if (row.state !== "group")
    return refusal("GUIDE_NOT_OFFERABLE", localize("reading-guides.index.guide_id_is_not_yet", "{guide_id} is not yet the team's. Nothing was sent.", { guide_id: String(row.guide_id) }), { guide: row.guide_id });
  /* END DEC-49 REGION is-guide-offerable */
  return null;
}

function slugRefusal() {
  /* DEC-49 REGION is-guide-slug */
  return refusal("GUIDE_NO_GROUP_SLUG", localize("reading-guides.index.no_team_slug_is_recorded", "no team slug is recorded, so an offer cannot be labeled. Nothing was sent."));
  /* END DEC-49 REGION is-guide-slug */
}

/** The ops whose handlers are this module's (K3): the control plane routes, authenticates and stamps them (`by` in the
 *  body; `viewer` in the URL, read after the body so a body cannot set it). `plane` composes them, once
 *  `op-declarations` declares them (their L11 jobs). */
export function readingGuidesOps(s, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = isObj(body) ? body : {};
  return {
    guidedraft: () => s.guideDraft(b),
    guidepropose: () => s.guidePropose(b),
    guidereview: () => s.guideReview(b),
    guideretire: () => s.guideRetire(b),
    guideoffer: () => s.guideOffer(b),
    guideadopt: () => s.guideAdopt(b),
    guideproposetocivicsmith: () => s.guideProposeToCivicsmith(b),
    guidefor: () => s.guideFor({ kind: qp("kind") ?? b.kind, viewer: qp("viewer") }),
    guides: () => s.guidesOf({ kind: qp("kind") ?? b.kind, state: qp("state") ?? b.state, viewer: qp("viewer") }),
    guide: () => s.guideRead({ guide: qp("guide") ?? b.guide, viewer: qp("viewer") }),
    guideproposals: () => s.guideProposals({ kind: qp("kind") ?? b.kind, viewer: qp("viewer") }),
    procedureguides: () => s.procedureGuidesFor({ kind: qp("kind") ?? b.kind, viewer: qp("viewer") }),   // R13 (K2820)
    guideoptout: () => s.guideOptOut({ guide: qp("guide") ?? b.guide, viewer: qp("viewer") }),              // R20
  };
}

/* R16 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  procedureguides: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("reading-guides.declared.procedureguides", "read: the procedure guides for a kind of action and their items, with each guide's origin; writes nothing"),
    fields: { accepts: ["kind"], requires: [] } },
  /* R20 (T53; K5508): the sole member's opt-out of review, a member's act on the team's own guide; the viewer is the stamp */
  guideoptout: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: null, weight: "reversible", description: localize("reading-guides.declared.guideoptout", "the team's one member opts its own guide out of the professional review and the separate approver; the guide then says it was not reviewed"),
    fields: { accepts: ["guide"], requires: ["guide"] } },
});

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. Its tables are created with it and declared
 *  with their classes (R9, record-core R21). */
export function readingGuidesOf(host, deps) {
  let s = instances.get(host);
  if (!s) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    s = new ReadingGuides({ ...d, storage, record, membership });
    instances.set(host, s);
    record.declareTable("reading-guides", READING_GUIDES_TABLE_CLASSES.map((e) => ({ ...e, keys: [...e.keys] })));
  }
  return s;
}
