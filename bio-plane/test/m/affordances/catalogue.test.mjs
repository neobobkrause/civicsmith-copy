/* affordances: the catalogue (R1, R4–R6), the rung backing that can be read off the tables (R19's structural half), the
   totality over the control plane's table and the owners' op maps (R12), the decorated shape's rung totality (R24) and
   the no-place rule (R25), each at the module's exports. The grades themselves (RUNGS, RUNG_ABSENT, NON_ACTS,
   MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS) are `op-grades`' (its R1–R32), their content pinned
   in its own tests (N891: the copies this suite held are dropped); what is asserted here of them is what this module
   answers over them: the totality (R12), the backing of a rung by its owner's refusal (R19), the machine set (R20) and
   the decorated shape (R24). What the acting modules answer when the acts are performed (R18–R20) is driven through the
   plane in `plane.test.mjs`. */
import "./register-owners.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as A from "../../../src/affordances.mjs";
import * as G from "../../../src/op-grades/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/* The grammars the catalogue reads (T19): the record's (states, grades) and the action document's (kinds and the action
   vocabularies), each the module whose refusals run on it. */
import { STATES, BASIS_GRADES, EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE } from "../../../src/record-grammar/index.mjs";
import * as actionGrammar from "../../../src/action-grammar/index.mjs";
import * as inquiry from "../../../src/inquiry/index.mjs";
import * as entities from "../../../src/entities/index.mjs";
import * as progressions from "../../../src/progressions/index.mjs";
import * as promotion from "../../../src/promotion/index.mjs";
import * as recordCore from "../../../src/record-core/index.mjs";
import * as basisVersions from "../../../src/basis-versions/index.mjs";
import * as content from "../../../src/content/index.mjs";
import * as ratification from "../../../src/ratification/index.mjs";
import * as contradiction from "../../../src/contradiction/index.mjs";
import * as filingTemplates from "../../../src/filing-templates/index.mjs";
import * as localFacts from "../../../src/local-facts/index.mjs";
import * as docket from "../../../src/docket/index.mjs";
import * as actionClocks from "../../../src/action-clocks/index.mjs";
import * as actionPlans from "../../../src/action-plans/index.mjs";
import * as planWork from "../../../src/plan-work/index.mjs";
import * as consequences from "../../../src/consequences/index.mjs";
import * as projectRoster from "../../../src/project-roster/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { list as profiles, get as profile } from "../../../../jurisdictions/index.mjs";

const { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS, VOCABULARIES } = A;
const { NON_ACTS, RUNGS, RUNG_ABSENT, RUNG_LADDER, RUNG_ABSENCE_GROUNDS, IRREVERSIBLE_CORRECTION_KEY, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS } = G;
const ids = (xs) => xs.map((a) => a.id).sort();
/* R51 (T45), R52 (T46): the acts an action offers are derived, not listed: every ACTS row whose `types` name an action,
   beside R1's own four (actionmove, actioncorrespond, actionlaws, actionrisktier). That each is an op its owner serves
   is asserted against the owners' op maps in the tests below. */
const R1_ACTION_ACTS = ["actionmove", "actioncorrespond", "actionlaws", "actionrisktier"];
const ACTION_ACTS = ACTS.filter((a) => a.types.includes("action")).map((a) => a.id);
const R51_R52_ACTS = ACTION_ACTS.filter((id) => !R1_ACTION_ACTS.includes(id));
test("R1 R51 R52: ACTS holds exactly the object-directed acts, each at its weight", () => {
  const W = {
    refuse: ["release", "retire", "dispose", "sever", "reinstate"],
    report: ["cite"],
    single: ["conclude", "reopen", "publish", "inquirydivide", "inquiryground", "actionmove", "actioncorrespond",
      "actionlaws", "actionrisktier", "versionaccept", "versionreject", "versionconsider", "versionrevert",
      "versioncurrent", "withdrawconclusion", "versionhide", "projectinvite", "projectjoin", "projectleave",
      "projectremove", "projectowneradd", "projectownerremove", "projectownerrescue", "projectvisibilityset",
      "contradictionresolve" /* N345 */, "sourceconsent" /* N364 (K530): its prompt rides it, R5 */,
      /* R51 (T45): every act directed at an action T45's owners serve */
      ...R51_R52_ACTS],
  };
  const want = Object.entries(W).flatMap(([w, xs]) => xs.map((id) => [id, w])).sort();
  assert.deepEqual(ACTS.map((a) => [a.id, a.weight]).sort(), want);
  assert.equal(new Set(ACTS.map((a) => a.id)).size, ACTS.length);
  for (const a of ACTS) {
    assert.equal(typeof a.label, "string"); assert.ok(a.label.length > 0);
    assert.ok(Array.isArray(a.types) && a.types.length > 0); assert.equal(typeof a.applies, "function");
  }
});

/* citeproject-inquiry's share (T18 convert): the types each citation act declares are what op=affordances publishes as
   `appliesTo` (R17, the once-loaded shape a surface builds its offer set from), and `deriveActs` reads none of them, so
   they are asserted against R9's own text here rather than against the catalogue that holds them. */
test("R9 R17: cite, sever and reinstate each declare exactly the types R9 offers them on — an information bundle, a "
   + "project and an inquiry", () => {
  for (const id of ["cite", "sever", "reinstate"])
    assert.deepEqual([...ACTS.find((a) => a.id === id).types].sort(), ["information", "inquiry", "project"], id);
});

test("R1: CAPTURE_ACTS holds attest, monitor and attesttext, with no weight", () => {
  assert.deepEqual(ids(CAPTURE_ACTS), ["attest", "attesttext", "monitor"]);
  for (const a of CAPTURE_ACTS) { assert.equal(a.weight, undefined); assert.ok(a.label.length > 0); }
});

test("R1: PER_ITEM_ACTS holds the four set acts, weight per-item, set key items, with their identity groups and shareable fields", () => {
  assert.deepEqual(PER_ITEM_ACTS.map((a) => [a.id, a.weight, a.set_key, a.item_keys, a.shared_keys]), [
    ["proposedispose", "per-item", "items", [["key"], ["progressionKey", "stageKey"], ["project", "finding"]],
     ["to", "reason", "kind", "definitionVersion"]],
    ["taskresolve", "per-item", "items", [["id"]], []],
    ["taskforward", "per-item", "items", [["id"]], ["to"]],
    ["resolve", "per-item", "items", [["captureSha"], ["captureSha", "ref"]], ["ref"]],
  ]);
});

test("R12 R24: against a table of every op the catalogue classifies, with each rung-classified op mutating, nothing is "
   + "unaccounted — the tables are consistent with one another — and every act carries a rung or a stated absence", () => {
  const ops = new Set([...Object.keys(NON_ACTS), ...ACTS.map((a) => a.id), ...Object.keys(RUNGS), ...Object.keys(RUNG_ABSENT)]);
  const table = [...ops].map((op) => ({ op, mutating: Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op),
    gated: Object.hasOwn(NON_ACTS, op) || ACTS.some((a) => a.id === op) }));
  assert.deepEqual(A.unaccounted(table), { unpublished: [], unranked: [], stale: [] });
  assert.deepEqual(ACTS.map((a) => a.id).filter((id) => !Object.hasOwn(RUNGS, id) && !Object.hasOwn(RUNG_ABSENT, id)), []);
});

test("R4 R36 R51: VOCABULARIES carries exactly the named vocabularies", () => {
  assert.deepEqual(Object.keys(VOCABULARIES).sort(), ["action_kind", "law_levels", "dispositions", "subject_positions",
    "basis_roles", "entity_kinds", "relation_kinds", "stage_requiredness", "action_basis_kinds",
    "correspondence_directions", "correspondence_stages", "correspondence_outcomes", "resolutions", "risk_tiers",
    "version_states", "version_edges", "version_reason_required", "rung_ladder", "rung_correction_key",
    "rung_absence_grounds", "rung_consequences" /* op-grades R4 */, "sufficiency_claim_states", "content_mint_states",
    /* N345 */ "contradiction_coordinates", "plurality_differences", "resolution_kinds", "norm_canons",
    "dismissal_reasons",
    /* R30 */ "template_states", "template_uses", "template_review_outcomes", "local_fact_acts",
    "local_fact_statuses",
    /* R34 */ "docket_shelves", "docket_entry_kinds", "docket_proposals", "docket_pressure_kinds",
    /* R36 */ "larger_screen_acts", /* R4 (op-grades R21; DEC-143) */ "irreversible_weight",
    /* R51 */ "override_grounds", "phrasing_kinds", "assertion_resolutions", "press_record_terms", "found_elsewhere_kinds",
    "bearings", "promise_kinds", "clock_owed_by", "clock_basis_kinds", "plan_states", "matter_states", "addressed_words",
    "project_scopes"].sort());
});

test("R4 R51: each fixed value is the very object its enforcing module refuses against — the same reference, never a copy", () => {
  const same = [
    ["law_levels", actionGrammar.LAW_LEVELS], ["dispositions", inquiry.DISPOSITIONS],
    ["subject_positions", ratification.SUBJECT_POSITIONS], ["basis_roles", inquiry.BASIS_ROLES],
    ["entity_kinds", entities.ENTITY_KINDS], ["relation_kinds", entities.RELATION_KINDS],
    ["stage_requiredness", progressions.STAGE_REQUIREDNESS], ["action_basis_kinds", actionGrammar.ACTION_BASIS_KINDS],
    ["correspondence_directions", actionGrammar.CORRESPONDENCE_DIRECTIONS],
    ["correspondence_stages", actionGrammar.CORRESPONDENCE_STAGES], ["correspondence_outcomes", actionGrammar.CORRESPONDENCE_OUTCOMES],
    ["resolutions", actionGrammar.RESOLUTIONS], ["risk_tiers", actionGrammar.RISK_TIERS],
    ["version_states", basisVersions.VERSION_MACHINE.legal], ["version_edges", basisVersions.VERSION_MACHINE.edges],
    ["version_reason_required", basisVersions.VERSION_REASON_REQUIRED], ["rung_ladder", RUNG_LADDER],
    ["rung_correction_key", IRREVERSIBLE_CORRECTION_KEY], ["rung_absence_grounds", RUNG_ABSENCE_GROUNDS],
    ["rung_consequences", G.CONSEQUENCE_STATEMENTS] /* R4: op-grades' (its R4, R21) */,
    ["sufficiency_claim_states", basisVersions.SUFFICIENCY_CLAIM_STATES], ["content_mint_states", content.CONTENT_MINT_STATES],
    /* N345: inquiry R46's frozen vocabularies and contradiction R31's dismissal reasons */
    ["contradiction_coordinates", inquiry.CONTRADICTION_COORDINATES], ["plurality_differences", inquiry.PLURALITY_DIFFERENCES],
    ["resolution_kinds", inquiry.RESOLUTION_KINDS], ["norm_canons", inquiry.NORM_CANONS],
    ["dismissal_reasons", contradiction.DISMISSAL_REASONS],
    /* R30: filing-templates R21's three and local-facts R7's two */
    ["template_states", filingTemplates.TEMPLATE_STATES], ["template_uses", filingTemplates.TEMPLATE_USES],
    ["template_review_outcomes", filingTemplates.REVIEW_OUTCOMES], ["local_fact_acts", localFacts.LOCAL_FACT_ACTS],
    ["local_fact_statuses", localFacts.LOCAL_FACT_STATUSES],
    /* R34: docket R1, R2, R6's four */
    ["docket_shelves", docket.SHELVES], ["docket_entry_kinds", docket.ENTRY_KINDS], ["docket_proposals", docket.PROPOSALS],
    ["docket_pressure_kinds", docket.PRESSURE_KINDS],
    ["larger_screen_acts", G.LARGER_SCREEN_ACTS] /* R36: op-grades' (its R18) */,
    ["irreversible_weight", G.IRREVERSIBLE_WEIGHT] /* R4: op-grades' (its R21) */,
    /* R51 (T45): action-grammar's T45 vocabularies (its R2), action-clocks' five bases, action-plans' plan states,
       plan-work's matter states, consequences' harm words and project-roster's scopes */
    ["override_grounds", actionGrammar.OVERRIDE_GROUNDS], ["phrasing_kinds", actionGrammar.PHRASING_KINDS],
    ["assertion_resolutions", actionGrammar.ASSERTION_RESOLUTIONS], ["press_record_terms", actionGrammar.PRESS_RECORD_TERMS],
    ["found_elsewhere_kinds", actionGrammar.FOUND_ELSEWHERE_KINDS], ["bearings", actionGrammar.BEARINGS],
    ["promise_kinds", actionGrammar.PROMISE_KINDS], ["clock_owed_by", actionGrammar.CLOCK_OWED_BY],
    ["clock_basis_kinds", actionClocks.BASIS_KINDS], ["plan_states", actionPlans.PLAN_STATES],
    ["matter_states", planWork.MATTER_STATES], ["addressed_words", consequences.ADDRESSED_WORDS],
    ["project_scopes", projectRoster.ProjectRoster.PROJECT_SCOPES],
  ];
  assert.deepEqual(same.filter(([k, v]) => VOCABULARIES[k] !== v).map(([k]) => k), []);
  assert.equal(same.length + 1, Object.keys(VOCABULARIES).length, "every key but action_kind is a fixed value checked here");
});

/* R26: the kinds come from actions at the moment of the call (its R10, R40), through action-grammar's `actionKinds` (its
   R1), the reader actions answers with; the tiers are action-grammar's (K768). Every
   profile the jurisdictions module lists is taken alone and all together, so a view that adds kinds is exercised. */
const views = () => {
  const ids = profiles().map((p) => p.id);
  const out = [["no profile active", null]];
  for (const id of ids) { const c = combine([id]); if (c && c.ok) out.push([id, c.view]); }
  const all = combine(ids); if (all && all.ok) out.push([ids.join("+"), all.view]);
  return out;
};
test("R26 R4: risk_tiers is action-grammar's RISK_TIERS (the same reference), and action_kind, with no instance to ask, "
   + "is actions' answer with no profile active — the product's kinds alone, no kind held here", () => {
  assert.equal(VOCABULARIES.risk_tiers, actionGrammar.RISK_TIERS);
  assert.deepEqual(VOCABULARIES.action_kind, actionGrammar.actionKinds(null));
  assert.equal(VOCABULARIES.action_kind, actionGrammar.PRODUCT_KINDS);
});

test("R26 R4: vocabulariesFor(kinds) publishes as action_kind exactly the kinds actions answers for the instance's view, "
   + "the product's kinds then the profiles', and every other vocabulary as the same object", () => {
  const vs = views();
  assert.ok(vs.some(([, v]) => actionGrammar.actionKinds(v).length > actionGrammar.PRODUCT_KINDS.length),
    "some profile adds a kind, so the instrument sees the view");
  for (const [name, view] of vs) {
    const kinds = actionGrammar.actionKinds(view);
    const v = A.vocabulariesFor(kinds);
    assert.deepEqual(v.action_kind, kinds, name);
    assert.deepEqual(v.action_kind.slice(0, actionGrammar.PRODUCT_KINDS.length), [...actionGrammar.PRODUCT_KINDS], name);
    /* R39: beside VOCABULARIES' keys, only the composed owners' T33 vocabularies (t33.test.mjs) */
    assert.deepEqual(Object.keys(v).slice(0, Object.keys(VOCABULARIES).length), Object.keys(VOCABULARIES), name);
    for (const k of Object.keys(VOCABULARIES)) if (k !== "action_kind") assert.equal(v[k], VOCABULARIES[k], `${name}: ${k}`);
  }
  for (const bad of [undefined, null, [], "records_request", [1], [""], [null]])
    assert.equal(A.vocabulariesFor(bad).action_kind, actionGrammar.PRODUCT_KINDS, JSON.stringify(bad));
});

test("R26: no action kind is held in this module — none of the action grammar's own kinds beyond the product's, and no profile's, appears in its "
   + "published text or tables", () => {
  const local = actionGrammar.ACTION_KINDS.filter((k) => !actionGrammar.PRODUCT_KINDS.includes(k));
  const fromProfiles = views().flatMap(([, v]) => actionGrammar.actionKinds(v)).filter((k) => !actionGrammar.PRODUCT_KINDS.includes(k));
  const kinds = [...new Set([...local, ...fromProfiles])];
  assert.ok(kinds.length > 0, "the instrument has kinds to look for");
  const text = JSON.stringify(outward());
  assert.deepEqual(kinds.filter((k) => text.includes(k)), []);
});

test("R5: inquirydivide carries DIVIDE_PROMPT, inquiryground GROUND_PROMPT, attest ATTEST_FENCE, publish "
   + "SELF_ATTESTED_PROMPT and sourceconsent CONSENT_PROMPT, and every other act's prompt is null", () => {
  const prompts = Object.fromEntries([...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS]
    .map((a) => [a.id, A.decorate(a, null).prompt]));
  const WANT = { inquirydivide: A.DIVIDE_PROMPT, inquiryground: A.GROUND_PROMPT, attest: A.ATTEST_FENCE,
                 publish: A.SELF_ATTESTED_PROMPT, sourceconsent: A.CONSENT_PROMPT };
  for (const [id, p] of Object.entries(WANT)) assert.equal(prompts[id], p, id);
  assert.deepEqual(Object.entries(prompts).filter(([id, p]) => !(id in WANT) && p !== null).map(([id]) => id), []);
  for (const p of Object.values(WANT)) assert.ok(typeof p === "string" && p.length > 100);
});

/* R28 (N364): DEC-81 item 3's sentence "stated for readers", read out of DECISIONS.md, and the very string
   case-authoring's case document prints beside a self-attested capture (its R36). */
import * as caseAuthoring from "../../../src/case-authoring/index.mjs";
import * as sources from "../../../src/sources/index.mjs";
const DECISIONS = () => readFileSync(fileURLToPath(new URL("../../../../docs/development/DECISIONS.md", import.meta.url)), "utf8");
test("R28: SELF_ATTESTED_PROMPT is DEC-81 item 3's reader sentence, verbatim, and case-authoring's own string (R36)", () => {
  const dec = DECISIONS();
  const at = dec.indexOf("### DEC-81");
  assert.ok(at > 0, "DEC-81 is in DECISIONS.md");
  const lead = "Why it matters, stated for readers: ";
  const from = dec.indexOf(lead, at);
  assert.ok(from > at && from < dec.indexOf("### DEC-82"), "item 3's reader sentence is in DEC-81");
  const rest = dec.slice(from + lead.length);
  const sentence = rest.slice(0, rest.indexOf("\n")).trim();
  assert.equal(A.SELF_ATTESTED_PROMPT, sentence[0].toUpperCase() + sentence.slice(1));
  assert.equal(A.SELF_ATTESTED_PROMPT, caseAuthoring.SELF_ATTESTED_SENTENCE, "the same string, not a copy that agrees");
  assert.equal(ACTS.find((a) => a.id === "publish").prompt, A.SELF_ATTESTED_PROMPT);
});

/* R29 (N364): DEC-78 item 5(d), stated in the two sentences sources' consent acts answer with (its R7). */
test("R29: CONSENT_PROMPT states that consent to publish is permanent for what is published, and that a withdrawal "
   + "binds only later publications — sources' own two statements", () => {
  const p = A.CONSENT_PROMPT;
  assert.match(p, /consent is permanent for anything published under it/);
  assert.match(p, /stays published, even if the consent is later withdrawn/);
  assert.match(p, /withdrawal binds only later publications/);
  assert.equal(p, `${sources.CONSENT_STATEMENT} ${sources.WITHDRAWAL_STATEMENT}`);
  assert.equal(ACTS.find((a) => a.id === "sourceconsent").prompt, p);
  const dec = DECISIONS();
  assert.match(dec.slice(dec.indexOf("### DEC-78"), dec.indexOf("### DEC-79")),
    /\(d\) Consent to go public is asked at the moment of publishing, stated as permanent; a source may withdraw consent for future publications, and what is published stays published\./);
});

test("R5: ATTEST_FENCE is DEC-39's wording verbatim, its two letters composed from the capture ceiling and the grade above it", () => {
  const dec = readFileSync(fileURLToPath(new URL("../../../../docs/development/DECISIONS.md", import.meta.url)), "utf8");
  const at = dec.indexOf("> **What co-attestation answers:**");
  assert.ok(at > 0, "DEC-39's wording is in DECISIONS.md");
  const lines = dec.slice(at).split("\n").map((l) => l.trimStart());
  const quote = lines.slice(0, lines.findIndex((l) => !l.startsWith(">"))).map((l) => l.replace(/^>\s?/, "")).join(" ").replace(/\*\*?/g, "").replace(/\s+/g, " ").trim();
  const above = BASIS_GRADES[BASIS_GRADES.indexOf(EARNED_CAPTURE_CEILING) - 1];
  assert.equal(UNREACHABLE_CAPTURE_GRADE, above);
  assert.equal(A.ATTEST_FENCE, A.attestFence(EARNED_CAPTURE_CEILING, above));
  assert.equal(A.attestFence("B", "A"), quote, "Bob's sentence at the ruled letters");
  assert.equal(A.attestFence("C", "B"), quote.replace("Grade B capture", "Grade C capture").replace("Grade A", "Grade B"));
});

test("R5: the fence's composer throws when either letter is absent; op=acquire's note is capture's and no copy of it "
   + "is held here (N80)", () => {
  for (const [c, u] of [[null, "A"], ["B", null], [undefined, undefined], ["", "A"], ["B", ""]])
    assert.throws(() => A.attestFence(c, u));
  assert.equal(A.acquireGradeNote, undefined);
  assert.equal(A.ACQUIRE_GRADE_NOTE, undefined);
});

test("R5: GROUND_PROMPT and every label use none of AND, OR, disjunction, branch or ground (DEC-32 clause 1)", () => {
  const texts = [["GROUND_PROMPT", A.GROUND_PROMPT], ...[...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].map((a) => [a.id, a.label])];
  const bad = texts.filter(([, t]) => /\bAND\b|\bOR\b/.test(t) || /\bdisjunctions?\b|\bbranch(es)?\b|\bground(s|ed|ing)?\b/i.test(t));
  assert.deepEqual(bad, []);
});

test("R6: DISPOSITIONS is inquiry's, STAGE_REQUIREDNESS progressions', ENTITY_KINDS and RELATION_KINDS entities', "
   + "REOPENABLE_FROM promotion's and PER_ITEM_MAX record-core's, re-exported unchanged", () => {
  assert.equal(A.DISPOSITIONS, inquiry.DISPOSITIONS);
  assert.equal(A.STAGE_REQUIREDNESS, progressions.STAGE_REQUIREDNESS);
  assert.equal(A.ENTITY_KINDS, entities.ENTITY_KINDS);
  assert.equal(A.RELATION_KINDS, entities.RELATION_KINDS);
  assert.equal(A.REOPENABLE_FROM, promotion.REOPENABLE_FROM);
  assert.equal(A.PER_ITEM_MAX, recordCore.PER_ITEM_MAX);
  assert.equal(A.PER_ITEM_MAX, 100);
});

test("R1 R12: NON_ACTS names no act, and a reason begins `capture-directed:` exactly for the members of CAPTURE_ACTS", () => {
  assert.deepEqual(ACTS.map((a) => a.id).filter((id) => Object.hasOwn(NON_ACTS, id)), []);
  assert.deepEqual(Object.keys(NON_ACTS).filter((op) => NON_ACTS[op].startsWith("capture-directed:")).sort(),
    ids(CAPTURE_ACTS));
});

test("R19: `terminal` is given only while STATES.information.edges.retired is empty — retire among it — and "
   + "`irreversible` only to the two that set when a signed case edition publishes, publishat and publishatmove (K3147: "
   + "publish now prepares and case-check's publishcheck is graded as it, both `terminal`); IRREVERSIBLE_WEIGHT is "
   + "op-grades' four", () => {
  /* N891: the closed set of `terminal` ops is op-grades' content, pinned in its tests */
  assert.deepEqual(STATES.information.edges.retired, []);
  assert.equal(RUNGS.retire, "terminal");
  for (const op of ["publish", "publishcheck"]) assert.equal(RUNGS[op], "terminal", op);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => RUNGS[op] === "irreversible").sort(), ["publishat", "publishatmove"]);
  assert.deepEqual([...G.IRREVERSIBLE_WEIGHT].sort(), ["personexpunge", "publishat", "publishatmove", "standardrelease"]);
});

/* N891: the family's content (each code the reasoned ops refuse with, and the exclusions) is op-grades' own, pinned in
   `test/m/op-grades/pins.test.mjs` ("R1 (N891): JUSTIFICATION_REFUSALS holds only codes that ask the member's account");
   what is asserted here is the form of the family and the owners' rows, below. */
test("R19: the justification family is a set of upper-case codes, none twice, and holds a source act's evidence", () => {
  for (const c of JUSTIFICATION_REFUSALS) assert.match(c, /^[A-Z_]+$/);
  assert.equal(new Set(JUSTIFICATION_REFUSALS).size, JUSTIFICATION_REFUSALS.length);
  assert.ok(JUSTIFICATION_REFUSALS.includes("NO_EVIDENCE"), "N364 (op-grades R1): a source act's account is its evidence");
});

test("R24: no decorated act, capture act or set act reaches a caller with a null rung and a null rung_absence", () => {
  const all = [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].map((a) => A.decorate(a, null));
  assert.deepEqual(all.filter((d) => d.rung === null && d.rung_absence === null).map((d) => d.id), []);
  assert.deepEqual(all.filter((d) => d.rung !== null && d.rung_absence !== null).map((d) => d.id), []);
});

/* R25: the places come from the jurisdiction profiles' own data, never a list typed here. */
const placeTerms = () => {
  const terms = new Set();
  for (const { id } of profiles()) {
    const p = profile(id);
    for (const c of p.covers ?? []) {
      terms.add(c);
      terms.add(c.replace(/^(City|County|Town|Port) of /, "").replace(/ (County|City)$/, ""));
    }
    const walk = (o, d = 0) => {
      if (!o || typeof o !== "object" || d > 4) return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && /^(name|label)$/.test(k)) {
          for (const m of v.matchAll(/\(([^)]+)\)/g)) terms.add(m[1]);
          const lead = /^([A-Z][A-Za-z.]+),/.exec(v); if (lead) terms.add(lead[1]);
        } else walk(v, d + 1);
      }
    };
    walk(p.spaces); walk(p.systems);
  }
  return [...terms].filter((t) => t.length > 2);
};
const outward = () => {
  const out = [];
  const add = (where, v) => { if (typeof v === "string") out.push([where, v]);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) add(`${where}.${k}`, x); };
  for (const a of [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS]) { add(`${a.id}.label`, a.label); add(`${a.id}.prompt`, a.prompt); }
  add("NON_ACTS", NON_ACTS); add("RUNG_ABSENT", RUNG_ABSENT); add("RUNG_ABSENCE_GROUNDS", RUNG_ABSENCE_GROUNDS);
  add("IRREVERSIBLE_CORRECTION_KEY", IRREVERSIBLE_CORRECTION_KEY);
  add("VOCABULARIES", VOCABULARIES); add("MACHINE_REFUSALS", MACHINE_REFUSALS);
  /* R48, R49: what each act does, published with the no-target answer, is outward text too */
  add("ACT_HELP", A.ACT_HELP);
  return out;
};
test("R25 R48: no place any jurisdiction profile names appears in this module's outward text, NON_ACTS.idmatch and ACT_HELP included", () => {
  const terms = placeTerms();
  assert.ok(terms.includes("Oakland") && terms.includes("Legistar") && terms.includes("APN") && terms.includes("C.M.S."),
    `the instrument reads the profiles (${terms.join(", ")})`);
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits = [];
  for (const [where, text] of outward())
    for (const t of terms) if (new RegExp(`(^|[^A-Za-z])${esc(t)}([^A-Za-z]|$)`).test(text)) hits.push(`${where}: ${t}`);
  assert.deepEqual(hits, []);
  assert.ok(typeof NON_ACTS.idmatch === "string" && NON_ACTS.idmatch.length > 40);
});

/* K208 (2), K264, T9 with N216: every op layers 7–10 add is accounted for. The ops are read from each owner's own op map
   (never listed here); the control plane's row for an op is derived from the registries (op-grades' tables and this
   module's acts): `mutating` is an entry in RUNGS or RUNG_ABSENT, `gated` an entry in NON_ACTS or a published act
   (ACTS, CAPTURE_ACTS, PER_ITEM_ACTS). The grades, rungs and grounds are pinned in op-grades' tests (N891); only their
   keys are read here. */
import { standardsOps } from "../../../src/standards/index.mjs";
import { conformanceOps } from "../../../src/conformance/index.mjs";
import { consequencesOps } from "../../../src/consequences/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { planWorkOps } from "../../../src/plan-work/index.mjs";
import { caseCheckOps } from "../../../src/case-check/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
/* T47 (N961 §5): action-records holds the actions acts the split moved; its op map is read directly. T48 (actions R103; K3280):
   `actionsOps` no longer spreads it, so each module's map counts its own ops, once. */
import { actionRecordsOps } from "../../../src/action-records/index.mjs";
import { contradictionOps } from "../../../src/contradiction/index.mjs";
import { sourcesOps } from "../../../src/sources/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
/* T42 (N826; K2656): the doorbell's routes are `doorbell`'s map (its R3, R13, R15, R18, R19), capture's copy deleted in T43 */
import { doorbellOps } from "../../../src/doorbell/index.mjs";
import { caseAuthoringOps } from "../../../src/case-authoring/index.mjs";
/* T47 (N908 §5): case-inputs, split from case-authoring by copy (K3112, K3116): its namespace, op map and checks. */
import * as caseInputs from "../../../src/case-inputs/index.mjs";
const { caseInputsOps } = caseInputs;
import { filingTemplatesOps } from "../../../src/filing-templates/index.mjs";
import { localFactsOps } from "../../../src/local-facts/index.mjs";
const MAPS = () => {
  const url = new URL("http://x/");
  const keys = (f) => Object.keys(f({}, url, {}, {}));
  return { standards: keys(standardsOps), conformance: keys(conformanceOps), consequences: keys(consequencesOps),
    filings: keys(filingsOps), actions: keys(actionsOps), actionHolds: keys(actionHoldsOps), actionPlans: keys(actionPlansOps),
    actionClocks: keys(actionClocksOps), escalation: keys(escalationOps), actionReplies: keys(actionRepliesOps),
    planWork: keys(planWorkOps), caseCheck: keys(caseCheckOps), projectRoster: keys(projectRosterOps),
    actionRecords: keys(actionRecordsOps), contradiction: keys(contradictionOps), sources: keys(sourcesOps),
    capture: keys(captureOps), doorbell: keys(doorbellOps), caseAuthoring: keys(caseAuthoringOps),
    entities: keys(entities.entitiesOps), filingTemplates: keys(filingTemplatesOps), localFacts: keys(localFactsOps) };
};
/* the ops of the named owners, once each, from their own maps */
const opsOf = (...owners) => { const m = MAPS(); return [...new Set(owners.flatMap((o) => m[o]))].sort(); };
const isAct = (op) => [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op);
const isMutating = (op) => Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op);
const isGated = (op) => Object.hasOwn(NON_ACTS, op) || isAct(op);
const rowOf = (op) => ({ op, mutating: isMutating(op), gated: isGated(op) });
/* R24: an op decorates with a rung or a stated absence, never both and never neither */
const ranked = (op) => { const d = A.decorate({ id: op, label: "x" }, null); return (d.rung === null) !== (d.rung_absence === null); };
/* R12 over derived rows: with the registries' own classification of each op nothing is unaccounted; and the negative controls, run
   over the real ops: carried by no row a named op reads stale (K4279: a NON_ACT carried ungated, an owner's declared read, does not),
   an op no registry names is reported unpublished (gated) and unranked (mutating), and a made-up op, `unnamed`, is both. */
function totality(ops, unnamed) {
  assert.ok(ops.length > 0, "the owners' maps hold ops");
  const table = ops.map(rowOf);
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ops.includes(op)), []);
  const bare = A.unaccounted([]).stale;
  assert.deepEqual(ops.filter((op) => (Object.hasOwn(NON_ACTS, op) || isMutating(op)) && !bare.includes(op)), []);
  for (const op of ops) {
    if (Object.hasOwn(NON_ACTS, op)) assert.ok(!A.unaccounted([{ op, mutating: isMutating(op), gated: false }]).stale.includes(op), op);
    if (isMutating(op)) assert.ok(A.unaccounted([{ op, mutating: false, gated: false }]).stale.includes(op), op);
  }
  for (const op of ops.filter((o) => !isGated(o))) assert.deepEqual(A.unaccounted([{ op, mutating: false, gated: true }]).unpublished, [op], op);
  for (const op of ops.filter((o) => !isMutating(o))) assert.deepEqual(A.unaccounted([{ op, mutating: true, gated: isGated(op) }]).unranked, [op], op);
  const left = A.unaccounted([...table, { op: unnamed, mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [[unnamed], [unnamed]]);
}
const LAYER9 = ["standards", "conformance", "consequences", "filings", "escalation", "actionPlans", "actionClocks", "actions",
  "actionHolds", "actionReplies", "planWork", "caseCheck", "projectRoster", "actionRecords"];
test("R1 R12: layer 9's ops, read from the owners' own op maps — with the control plane's rows derived from the registries "
   + "nothing is unaccounted; a gated read carried ungated, an ungated read carried gated and an op named nowhere are each seen", () => {
  const ops = opsOf(...LAYER9);
  /* the controls bite: the owners hold gated reads (a NON_ACTS row, no grade) and ungated reads (named by no registry) */
  assert.ok(ops.some((op) => Object.hasOwn(NON_ACTS, op) && !isMutating(op)));
  assert.ok(ops.some((op) => !isGated(op) && !isMutating(op)));
  totality(ops, "layernineunnamed");
});

const T45_OWNERS = ["actionRecords", "actions", "actionHolds", "actionReplies", "planWork", "caseCheck", "consequences",
  "conformance", "actionPlans", "actionClocks", "filings", "projectRoster"];
test("R1 R12 R24 R51: T45's layer 8–9 owners' ops — every act directed at an action is an op its owner's map serves; each write "
   + "decorates with a rung or a stated absence, never both; the acts R51 offers on an action are acts and never non-acts, every "
   + "other write of those owners an act of another type or a non-act; with the control plane's rows nothing is unaccounted; an op left out is seen", () => {
  const m = MAPS();
  const ops = opsOf(...T45_OWNERS);
  /* R51, R52: each act directed at an action beyond R1's four is an op some owner serves */
  const served = new Set(opsOf(...T45_OWNERS, "escalation"));
  assert.ok(R51_R52_ACTS.length > 0);
  assert.deepEqual(R51_R52_ACTS.filter((id) => !served.has(id)), []);
  /* actions R103: its map holds none of action-records' ops (each routed once) */
  assert.ok(m.actionRecords.length > 0);
  assert.deepEqual(m.actionRecords.filter((op) => m.actions.includes(op)), []);
  for (const op of ops.filter(isMutating)) {
    assert.ok(ranked(op), `R24: ${op}`);
    /* an act is an ACTS row and no non-act (the roster's project acts are ACTS rows of this owner set too); every write
       that is no act is a non-act */
    if (ACTION_ACTS.includes(op)) assert.ok(isAct(op) && !Object.hasOwn(NON_ACTS, op), op);
    else if (isAct(op)) assert.ok(!Object.hasOwn(NON_ACTS, op), op);
    else assert.ok(Object.hasOwn(NON_ACTS, op), op);
  }
  totality(ops, "actionunnamed");
});

test("R1 R12 R24 R52: T46's layer 9 ops — escalation's and action-clocks' maps serve the stop, the reopening and the adoption "
   + "as acts on an action (R52), never non-acts, each decorating with a rung or a stated absence; clockproposals is a gated "
   + "read and no act; with the control plane's rows nothing is unaccounted; an op left out is seen", () => {
  const ops = opsOf("escalation", "actionClocks");
  for (const op of ["escalationstoppursuing", "escalationreopen", "clockadopt"]) {
    assert.ok(ops.includes(op), op);
    assert.ok(ACTION_ACTS.includes(op) && isAct(op) && !Object.hasOwn(NON_ACTS, op), op);
    assert.ok(ranked(op), `R24: ${op}`);
  }
  assert.ok(ops.includes("clockproposals"));
  assert.ok(!isAct("clockproposals") && Object.hasOwn(NON_ACTS, "clockproposals") && !isMutating("clockproposals"));
  for (const op of ops.filter(isMutating)) {
    assert.ok(ranked(op), `R24: ${op}`);
    if (ACTION_ACTS.includes(op)) assert.ok(isAct(op) && !Object.hasOwn(NON_ACTS, op), op);
  }
  totality(ops, "escalationunnamed");
});

/* N321 (T13, K424): `op=projectstage` (publication R44) is a read stamping `viewer`, carried as every project read is:
   not mutating and with no `NEEDS` row, `op=profiles`' precedent (K416). So it takes no rung (op-grades R2 grades the ops
   that write) and no `NON_ACTS` row (a row for an ungated op reads `stale`, R12), and no registry names it. */
test("R12: op=projectstage, an ungated read, is named in no registry, and a table carrying it as one leaves "
   + "nothing unaccounted; carried as mutating or gated, it would be named", () => {
  const named = (op) => Object.hasOwn(NON_ACTS, op) || Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op)
    || [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op);
  assert.equal(named("projectstage"), false);
  const row = { op: "projectstage", mutating: false, gated: false };
  assert.deepEqual(A.unaccounted([row]), A.unaccounted([]));
  const base = A.unaccounted([]);
  const r = A.unaccounted([{ ...row, gated: true }]);
  assert.deepEqual(r.unpublished, ["projectstage"]);
  assert.deepEqual(A.unaccounted([{ ...row, mutating: true }]).unranked, ["projectstage"]);
  assert.deepEqual(r.stale, base.stale);
});

/* N345 (K481, K490): contradiction's ops (its op map), entities' `resolutiondefect` (K485) and case-authoring's
   `publishtensions` (K498), read from their owners' maps. The ops that write are graded in op-grades (its R1, R2) and each
   carries a `NON_ACTS` reason unless an act (op-grades R5); the reads carry a `NON_ACTS` reason, so the control plane gates
   each with a `NEEDS` row, as it gates `contradictionpairs` (R12). */
test("R1 R12 R24: N345's ops — contradiction's op map, with resolutiondefect and publishtensions from their owners': "
   + "contradictionresolve is an act and never a non-act too, each write decorates with a rung or a stated absence, each read "
   + "is gated — and with the control plane's rows nothing is unaccounted; carried ungated, a read is not stale (K4279)", () => {
  const m = MAPS();
  assert.ok(m.entities.includes("resolutiondefect"));
  assert.ok(m.caseAuthoring.includes("publishtensions"));
  const ops = [...opsOf("contradiction"), "resolutiondefect", "publishtensions"];
  assert.ok(ops.includes("contradictionresolve"));
  assert.ok(ACTS.some((a) => a.id === "contradictionresolve"));
  assert.ok(!Object.hasOwn(NON_ACTS, "contradictionresolve"), "an ACTS row, never a non-act too");
  for (const op of ops.filter(isMutating)) assert.ok(ranked(op), `R24: ${op}`);
  assert.deepEqual(ops.filter((op) => !isGated(op)), []);
  totality(ops, "contradictionunnamed");
  /* K4279 (R12): an owner's declared read carried ungated is not stale; carried by no row it is (op-grades R5) */
  assert.ok(!A.unaccounted([{ op: "publishtensions", mutating: false, gated: false }]).stale.includes("publishtensions"));
  assert.ok(A.unaccounted([]).stale.includes("publishtensions"));
});

/* K516: contradiction's measures (its R39, R40) are in-process and no op, so no registry names them. */
test("R12: contradiction's measures are no op and are named in no registry", () => {
  assert.ok(!Object.keys(contradictionOps({}, new URL("http://x/"), {})).includes("contradictionmeasures"));
  for (const t of [NON_ACTS, RUNGS, RUNG_ABSENT]) assert.ok(!Object.hasOwn(t, "contradictionmeasures"));
  assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === "contradictionmeasures"));
});

/* N891: the family's codes for contradiction's acts, and the codes that stay out of it, are pinned in op-grades' own
   `pins.test.mjs` (R1); here each of contradiction's `reasoned` ops is backed by a row of the owner's own check tables
   that is in the family. */
import { CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS } from "../../../src/contradiction/checks.mjs";
test("R19: contradiction's reasoned acts are backed by codes its own check tables hold, in the justification family", () => {
  const rows = [...Object.keys(CONTRADICTION_PAIR_CHECKS), ...Object.keys(CONTRADICTION_CANDIDATE_CHECKS)];
  const family = rows.filter((c) => JUSTIFICATION_REFUSALS.includes(c));
  /* contradictionresolve concludes through basis-versions (its R36), whose refusal is not this owner's row */
  const reasoned = opsOf("contradiction").filter((op) => RUNGS[op] === "reasoned" && op !== "contradictionresolve");
  assert.ok(reasoned.length > 0);
  assert.ok(family.length >= reasoned.length, `${family.length} family codes for ${reasoned.length} reasoned acts`);
});

/* N364 (K530): the ops sources, capture, the doorbell and case-authoring's pre-flight add, read from their owners' op
   maps (membership's signer pair is routed by the control plane alone, so it has no map to read). Each op that writes is
   graded in op-grades (its R1, R2); each carries a `NON_ACTS` reason (op-grades R5; R12) except `sourceconsent`, an act, and
   the ops that hold no account and so have no `NEEDS` row (`knockerconsent`, as `knock`), which no registry names as gated. */
test("R1 R12: N364's ops — the op maps of sources, capture, the doorbell and case-authoring hold them, sourceconsent is "
   + "an act and never a non-act — and with the control plane's rows nothing is unaccounted; an ungated read, an ungated "
   + "write and an op left out are each seen", () => {
  const m = MAPS();
  assert.ok(m.sources.includes("sourceconsent"));
  assert.ok(m.caseAuthoring.includes("publishpreflight"));
  const ops = [...opsOf("sources", "capture", "doorbell"), "publishpreflight"];
  assert.ok(ACTS.some((a) => a.id === "sourceconsent") && !Object.hasOwn(NON_ACTS, "sourceconsent"));
  for (const op of ops.filter(isMutating)) assert.ok(ranked(op), `R24: ${op}`);
  /* a write that holds no account has no NEEDS row, so no registry gates it: carried gated it reads unpublished */
  const ungatedWrites = ops.filter((op) => isMutating(op) && !isGated(op));
  assert.ok(ungatedWrites.length > 0, "the owners hold a write no registry gates, as knockerconsent");
  for (const op of ungatedWrites) assert.deepEqual(A.unaccounted([{ op, mutating: true, gated: true }]).unpublished, [op], op);
  totality(ops, "sourceunnamed");
});

/* R51 (T45): the hold acts, now `action-holds`' (K2781 (1)), are acts on an action: offered where their refusals admit
   the caller (derive.test.mjs, and driven in t45.test.mjs); each decorates with its rung, and a machine is withheld them
   (R20). The release's consequence statement stays published by reference (R4). */
test("R1 R4 R12 R24 R51: actionhold and actionholdrelease — action-holds' op map holds them and their two reads, both are "
   + "acts and no non-act, each decorates with a rung and never a bare null, the release's consequence statement is "
   + "published by reference; with the control plane's rows nothing is unaccounted", () => {
  const ops = Object.keys(actionHoldsOps({}, new URL("http://x/"), {}));
  for (const op of ["actionhold", "actionholdrelease", "actionholdpreview", "projectholds"]) assert.ok(ops.includes(op), op);
  for (const op of ["actionhold", "actionholdrelease"]) {
    assert.ok(ACTS.some((a) => a.id === op) && !Object.hasOwn(NON_ACTS, op), op);
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.ok(d.rung !== null && d.rung_absence === null, `R24: ${op}`);
  }
  assert.equal(VOCABULARIES.rung_consequences.actionholdrelease, G.CONSEQUENCE_STATEMENTS.actionholdrelease);
  const table = [{ op: "actionhold", mutating: true, gated: true }, { op: "actionholdrelease", mutating: true, gated: true },
    ...["actionholdpreview", "projectholds"].map((op) => ({ op, mutating: false, gated: true }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  /* K4279 (R12): an owner's declared read carried ungated is not stale; carried by no row it is */
  assert.ok(!A.unaccounted([{ op: "projectholds", mutating: false, gated: false }]).stale.includes("projectholds"));
  assert.ok(A.unaccounted([]).stale.includes("projectholds"));
});

/* K921, K922 (3), T21: the ops of `filing-templates` and `local-facts`, read from their op maps, graded in op-grades (its
   R6; local-facts' four T45 rule acts, its R10–R13, by its R32); every op, the reads included, carries its `NON_ACTS`
   reason, so the control plane gates each with a `NEEDS` row. Their grades and reasons are pinned in op-grades' tests
   (N891); their vocabularies (R30) are R4's test. */
test("R1 R12 R24: the op maps of filing-templates and local-facts, read from their owners; none is an act; each write "
   + "decorates with a rung or a stated absence; every write is gated; and with the control plane's rows for them nothing is "
   + "unaccounted", () => {
  const ops = opsOf("filingTemplates", "localFacts");
  assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => ops.includes(a.id)));
  /* R24: each write decorates with a rung or a stated absence, never both and never neither */
  const writes = ops.filter(isMutating);
  assert.ok(writes.length > 0);
  for (const op of writes) assert.ok(ranked(op), op);
  /* the control plane's rows: every write has a NON_ACTS reason and so is gated; a read with no NEEDS row is named nowhere */
  assert.deepEqual(writes.filter((op) => !isGated(op)), []);
  totality(ops, "templateunnamed");
});

test("R19: TEMPLATE_REASON_REFUSED and FACT_HOW_REFUSED are each a code its owner answers with (its own checks table), "
   + "in the justification family", () => {
  assert.ok(Object.hasOwn(filingTemplates.FILING_TEMPLATE_CHECKS, "TEMPLATE_REASON_REFUSED"));
  assert.ok(Object.hasOwn(localFacts.LOCAL_FACTS_CHECKS, "FACT_HOW_REFUSED"));
  for (const c of ["TEMPLATE_REASON_REFUSED", "FACT_HOW_REFUSED"]) assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
});

/* op-grades R4 (DEC-88 (4); K1038): the judgement calls' consequence statements, published beside the ladder as
   `VOCABULARIES.rung_consequences`, the very object `CONSEQUENCE_STATEMENTS` (R4); no key added to the decorated act
   (R11), so op=affordances and a queue item's options keep their shape. The statements, their friction and their ops'
   rungs are pinned in op-grades' tests. */
test("R4 R11 R25: CONSEQUENCE_STATEMENTS is published as VOCABULARIES.rung_consequences by reference, in the static "
   + "vocabularies, vocabulariesFor and the no-target answer; the decorated act's keys are unchanged by it; and its "
   + "statements are outward text", () => {
  const C = G.CONSEQUENCE_STATEMENTS;
  assert.ok(Object.keys(C).length > 0, "the instrument has statements to publish");
  assert.equal(VOCABULARIES.rung_consequences, C, "the same object, never a copy");
  assert.equal(A.vocabulariesFor(["x"]).rung_consequences, C);
  assert.equal(A.affordancesAnswer({ kinds: null, gate: null }).vocabularies.rung_consequences, C);
  /* R11: the decorated shape is unchanged — no consequence key on any act */
  const KEYS = ["id", "label", "weight", "needs", "mode", "rung", "rung_absence", "prompt", "phone" /* R36 */];
  for (const a of [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS]) assert.deepEqual(Object.keys(A.decorate(a, null)), KEYS, a.id);
  for (const op of Object.keys(C)) assert.deepEqual(Object.keys(A.decorate({ id: op, label: "x" }, null)), KEYS, op);
  /* and no place is named in them (R25: outward text) */
  assert.ok(outward().some(([w]) => w.startsWith("VOCABULARIES.rung_consequences.")));
});

/* K1019, K1023, K1037 (T22; plan layer 11): the ops escalation, capture and monitoring added, keyed to their op maps.
   The four writes are `reasoned` (op-grades R1) with a NON_ACTS reason; capture's three reads carry a NON_ACTS reason
   (each has a present `NEEDS` row in op-declarations, as capture's other reads); escalation's status read has no `NEEDS`
   row (`escalationsdue`'s shape), so no registry names it; `doorbellrefused` is store-internal and named nowhere. T23's
   ops (escalationreasondraft, whatchangedpropose, whatchangeddrafts among them) are op-grades R7's, in the test after
   this one. */
import { escalationOps } from "../../../src/escalation/index.mjs";
import { monitoringOps } from "../../../src/monitoring/index.mjs";
test("R12: T22's new ops — escalation's, capture's, the doorbell's and monitoring's op maps hold them, the four writes "
   + "and capture's three reads named in NON_ACTS, escalationstatus and doorbellrefused named nowhere — and with the "
   + "control plane's rows for them nothing is unaccounted", () => {
  const url = new URL("http://x/");
  const esc = Object.keys(escalationOps({}, url, {})), cap = Object.keys(captureOps({}, url, {}, {})),
        mon = Object.keys(monitoringOps({}, url, {})), door = Object.keys(doorbellOps({}, url, {}));
  for (const op of ["declinetoescalate", "escalationstatus"]) assert.ok(esc.includes(op), op);
  for (const op of ["heldsetaside", "heldrestore", "heldcaptures", "gradenote"]) assert.ok(cap.includes(op), op);
  /* T42 (N826): the tally and the Worker's refused count are the doorbell's (its R19) */
  for (const op of ["doorbelltally", "doorbellrefused"]) assert.ok(door.includes(op), op);
  assert.ok(mon.includes("addressfrequencyset"));
  const named = (op) => Object.hasOwn(NON_ACTS, op) || Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op)
    || [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op);
  const WRITES = ["declinetoescalate", "heldsetaside", "heldrestore", "addressfrequencyset"];
  const READS = ["heldcaptures", "gradenote", "doorbelltally"];
  for (const op of ["escalationstatus", "doorbellrefused"]) assert.equal(named(op), false, op);
  const table = [...WRITES.map((op) => ({ op, mutating: true, gated: true })),
    ...READS.map((op) => ({ op, mutating: false, gated: true })), { op: "escalationstatus", mutating: false, gated: false }];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => table.some((t) => t.op === op)), []);
  /* carried gated, escalationstatus would read unpublished; carried by no row, each named op reads stale */
  assert.deepEqual(A.unaccounted([{ op: "escalationstatus", mutating: false, gated: true }]).unpublished, ["escalationstatus"]);
  assert.deepEqual([...WRITES, ...READS].filter((op) => !A.unaccounted([]).stale.includes(op)), []);
});

/* op-grades R7 (N485: K1025, K1035; K1094; DEC-111, K1100; T23): the ops T23 adds, and R12's totality with them.
   case-inputs' (T47, N908 §5: `whatchangedpropose` and `whatchangeddrafts` left case-authoring's map with the split) and
   escalation's are read from their op maps; `sweeps` left monitoring's for link-sweep's at T24's L10
   (N506, link-sweep R1–R12), and link-sweep is not in this module's uses, so it is named as op-grades R7 names it;
   network-notices is not in this module's uses, so its four ops (its op map: `noticeprepare`, `noticepost`, `notices`,
   `directorysubmission`) and its three public reads (registered through public-read R18) are named as its record states
   them (build/jobs/T23/network-notices.md; K1150). op-grades R7 names no grade or reason for `directorysubmission`, so it
   is not asserted here either way. The grades and reasons are pinned in op-grades' tests. */
const T23_WRITES = ["whatchangedpropose", "noticepost"];
const T23_READS = ["escalationreasondraft", "whatchangeddrafts", "sweeps", "noticeprepare", "notices"];
const T23_PUBLIC = ["activitymethod", "noticespublic", "groupkeyspublic"];
test("R1 R12 R24: T23's ops — case-inputs' and escalation's op maps hold theirs, each write decorates with a rung "
   + "or a stated absence, none is an act — and with the control plane's rows for them nothing is unaccounted; an "
   + "ungated read is not stale (K4279) and an op left out is seen", () => {
  const url = new URL("http://x/");
  const ca = Object.keys(caseInputsOps({}, url, {})), esc = Object.keys(escalationOps({}, url, {}));
  for (const op of ["whatchangedpropose", "whatchangeddrafts"]) assert.ok(!Object.keys(caseAuthoringOps({}, url, {})).includes(op), op);
  for (const op of ["whatchangedpropose", "whatchangeddrafts"]) assert.ok(ca.includes(op), op);
  assert.ok(esc.includes("escalationreasondraft"));
  /* R24: each write decorates with a rung or a stated absence, never both and never neither */
  for (const op of T23_WRITES) {
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.equal((d.rung === null) !== (d.rung_absence === null), true, op);
  }
  const ALL = [...T23_WRITES, ...T23_READS, ...T23_PUBLIC];
  assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => ALL.includes(a.id)));
  /* the control plane's rows (op-declarations R10): the two writes mutating, every op gated (each has a NON_ACTS reason) */
  const table = [...T23_WRITES.map((op) => ({ op, mutating: true, gated: true })),
    ...[...T23_READS, ...T23_PUBLIC].map((op) => ({ op, mutating: false, gated: true }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ALL.includes(op)), []);
  /* negative controls: carried by no row (the real table before op-declarations' merge), each reads stale; a read
     carried ungated reads stale; a new op the catalogue leaves out reads unpublished and unranked */
  assert.deepEqual(ALL.filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  /* K4279 (R12): a read carried ungated is not stale, a NON_ACT's owner-declared read */
  for (const op of [...T23_READS, ...T23_PUBLIC])
    assert.ok(!A.unaccounted([{ op, mutating: false, gated: false }]).stale.includes(op), op);
  const left = A.unaccounted([...table, { op: "noticeunnamed", mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [["noticeunnamed"], ["noticeunnamed"]]);
});

/* T47 (N908 §5; split map `case-authoring-split-2.md` §5): case-inputs' namespace, op map and checks, split from
   case-authoring by copy (K3112) and its copies deleted there (K3116). Its three ops keep their names, grades and reasons
   (op-grades' rows are unchanged by the split); none is an act. The reasoned acknowledgement's backing is driven at
   case-inputs' interface in backing.test.mjs. */
test("R1 R12 R19 R24: case-inputs' ops — its op map holds every op it declares but the ones public-read serves, "
   + "case-authoring's none of them; STATEMENT_ACK_NO_REASON is a row of case-inputs' checks in the justification family; each "
   + "write decorates with the rung or ground it declares, none is an act — and with the control plane's rows nothing is "
   + "unaccounted; an op left out is seen", () => {
  const url = new URL("http://x/");
  const declared = caseInputs.DECLARED_OPS;
  const mapOps = Object.keys(caseInputsOps({}, url, {})).sort();
  /* K4225: the op set is the owner's, read from its ops map and its DECLARED_OPS, never a list kept here. A declared op
     the map lacks is a read the public-read door serves (case-inputs R24); a map op the owner does not declare is one
     whose grade a hand row holds. */
  const served = Object.keys(declared).filter((op) => !mapOps.includes(op));
  for (const op of served) assert.deepEqual([declared[op].mutating, declared[op].weight], [false, "read"], `${op} is a read the door serves`);
  const unlisted = mapOps.filter((op) => !Object.hasOwn(declared, op));
  for (const op of unlisted) assert.ok([RUNGS, RUNG_ABSENT, NON_ACTS].some((t) => Object.hasOwn(t, op)), `${op}: a hand grade`);
  const left = Object.keys(caseAuthoringOps({}, url, {}));
  for (const op of mapOps) assert.ok(!left.includes(op), op);
  assert.equal(typeof caseInputs.caseInputsOf, "function", "the namespace answers its factory");
  assert.ok(Object.hasOwn(caseInputs.STATEMENT_ACK_CHECKS, "STATEMENT_ACK_NO_REASON"), "a row of case-inputs' checks");
  assert.ok(JUSTIFICATION_REFUSALS.includes("STATEMENT_ACK_NO_REASON"));
  const mutates = (op) => (Object.hasOwn(declared, op) ? declared[op].mutating : Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op));
  const WRITES = mapOps.filter(mutates), READS = mapOps.filter((op) => !mutates(op));
  assert.ok(WRITES.length > 0 && READS.length > 0, "the owner has writes and reads");
  for (const op of WRITES) {
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.equal((d.rung === null) !== (d.rung_absence === null), true, `R24: ${op}`);
    /* the grade is the one the owner declares, as op-grades R49 registers it */
    if (Object.hasOwn(declared, op)) assert.equal(d.rung ?? d.rung_absence, declared[op].weight, `${op}: the declared weight`);
  }
  assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => [...WRITES, ...READS, ...served].includes(a.id)));
  /* the control plane's rows (op-declarations): every write mutating, every op gated — `statementack` has a NEEDS row since
     K3041, and op-grades names it in NON_ACTS (K3164) */
  const table = [...WRITES.map((op) => ({ op, mutating: true, gated: true })),
    ...[...READS, ...served].map((op) => ({ op, mutating: false, gated: true }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => [...WRITES, ...READS, ...served].includes(op)), []);
  /* negative controls (K4279, R12): an op a NON_ACTS row names is not stale carried ungated; carried by no row, each reads stale */
  for (const op of [...WRITES, ...READS, ...served].filter((o) => Object.hasOwn(NON_ACTS, o)))
    assert.ok(!A.unaccounted([{ op, mutating: mutates(op), gated: false }]).stale.includes(op), op);
  assert.deepEqual([...WRITES, ...READS, ...served].filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  const out = A.unaccounted([...table, { op: "inputsunnamed", mutating: true, gated: true }]);
  assert.deepEqual([out.unpublished, out.unranked], [["inputsunnamed"], ["inputsunnamed"]]);
});

/* N512 (T25): the provenance split. `provenancechain`, `provenanceroute` and the read `provenanceroutes` left
   provenance's op map (its R53) for provenance-routes' (its R9), and `op=attest` is answered by attestation's door arm
   (`attestOp`, attestation R1–R3) with the code it reaches. No grade or reason moves with them (provenance-routes' and
   attestation's requirements change no meaning): the two route writes keep `substrate` and their `document-directed:`
   reasons, `attest` keeps its grade (op-grades' tests) and its CAPTURE_ACTS row with the fence, and the
   read carries no `NEEDS` row (op-declarations, not in this module's uses, so the rows are written out here as its
   table carries them), so it is named nowhere (R12). */
import { provenanceRouteOps } from "../../../src/provenance-routes/index.mjs";
import { attestOp } from "../../../src/attestation/index.mjs";
test("R1 R5 R12 (N512): provenance-routes' op map holds its three ops and attestation answers `attest` — the two route "
   + "writes no act, `attest` a capture act with the fence and no ACTS row — and with the control plane's rows nothing is "
   + "unaccounted; an unnamed op is seen", () => {
  const routeOps = Object.keys(provenanceRouteOps({}, new URL("http://x/"), {})).sort();
  assert.deepEqual(routeOps, ["provenancechain", "provenanceroute", "provenanceroutes"]);
  assert.equal(typeof attestOp, "function");
  const WRITES = ["provenancechain", "provenanceroute"];
  for (const op of WRITES) assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op), op);
  assert.deepEqual(CAPTURE_ACTS.find((a) => a.id === "attest"), { id: "attest", label: word("act.attest.name"), prompt: A.ATTEST_FENCE });
  assert.ok(!ACTS.some((a) => a.id === "attest"));
  /* the control plane's rows: the two writes and `attest` mutating and gated, the read neither */
  const table = [...WRITES, "attest"].map((op) => ({ op, mutating: true, gated: true }))
    .concat([{ op: "provenanceroutes", mutating: false, gated: false }]);
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => [...routeOps, "attest"].includes(op)), []);
  /* negative controls: carried gated, the owner's declared read is a NON_ACT whether or not it is gated (R12, K4279), so it
     reads published; carried by no row, each write reads stale; an op the catalogue leaves out reads unpublished and unranked */
  assert.deepEqual(A.unaccounted([{ op: "provenanceroutes", mutating: false, gated: true }]).unpublished, []);
  assert.deepEqual([...WRITES, "attest"].filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  const left = A.unaccounted([...table, { op: "provenanceunnamed", mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [["provenanceunnamed"], ["provenanceunnamed"]]);
});

/* R19 (DEC-88, K1025): the justification family gains each newly reasoned op's code, read from the owner's own checks
   table where it keeps one, and the four words-as-reason codes. */
import * as provenanceChecks from "../../../src/provenance/checks.mjs";
import * as contentChecks from "../../../src/content/checks.mjs";
import * as obsChecks from "../../../src/observation-log/checks.mjs";
import * as entitiesChecks from "../../../src/entities/checks.mjs";
import * as captureChecks from "../../../src/capture/checks.mjs";
/* T42 (N826): RESOLVE_NO_REASON (C-118.7) is the doorbell's row (its R3, R21), the very object capture's table holds until T43 */
import * as doorbellChecks from "../../../src/doorbell/checks.mjs";
import * as monitoringChecks from "../../../src/monitoring/checks.mjs";
import * as biasChecks from "../../../src/bias/checks.mjs";
/* K1643: ATTRIBUTION_NO_REASON's row is case-tensions' (its R9), the split's copy from publication. */
import * as caseTensionsChecks from "../../../src/case-tensions/checks.mjs";
import * as strengthChecks from "../../../src/strength/checks.mjs";
import * as intentChecks from "../../../src/intent/checks.mjs";
import * as standardsChecks from "../../../src/standards/checks.mjs";
import * as filingsChecks from "../../../src/filings/checks.mjs";
/* T47 (N908 §5): STATEMENT_ACK_NO_REASON's row moved with `statementack` to case-inputs (its checks, K3116). */
import * as caseInputsChecks from "../../../src/case-inputs/checks.mjs";
import * as reevaluationChecks from "../../../src/reevaluation/checks.mjs";
import * as consequencesChecks from "../../../src/consequences/checks.mjs";
/* NO_BASIS is a shared act row, held by record-grammar (C-33.40), which progressions and entities answer with. */
import { SHARED_ACT_CHECKS } from "../../../src/record-grammar/index.mjs";
test("R19: the justification family holds DEC-88's and T22's codes, each a row its owner's checks table keeps", () => {
  const OWNERS = {
    TESTIMONY_NO_WORDS: provenanceChecks, TRANSCRIBE_NO_TEXT: contentChecks, ATTEST_NO_NOTE: contentChecks,
    LEAD_NO_WORDS: obsChecks, LEAD_LOOK_NO_DETAIL: obsChecks, LEAD_SHARE_NO_REASON: obsChecks,
    ENTITY_NO_NOTE: entitiesChecks, NO_BASIS: { SHARED_ACT_CHECKS }, RESOLVE_NO_REASON: doorbellChecks,
    SET_ASIDE_NO_REASON: captureChecks, FREQUENCY_NO_REASON: monitoringChecks, BIAS_ADOPTION_NO_REASON: biasChecks,
    ATTRIBUTION_NO_REASON: caseTensionsChecks, BAR_NO_REASON: strengthChecks, PURSUIT_UNSTATED: intentChecks,
    NO_NOTE: intentChecks, INTENT_NO_REASON: intentChecks, STANDARD_NO_REASON: standardsChecks,
    PACKET_NO_REASON: filingsChecks, STATEMENT_ACK_NO_REASON: caseInputsChecks,
    VERSION_ADOPT_NO_REASON: reevaluationChecks, NO_RATIONALE: consequencesChecks,
  };
  const rowIn = (mod, code) => Object.values(mod).some((t) => t && typeof t === "object" && Object.hasOwn(t, code));
  for (const [code, mod] of Object.entries(OWNERS)) {
    assert.ok(JUSTIFICATION_REFUSALS.includes(code), code);
    assert.ok(rowIn(mod, code), `${code} is a row of its owner's checks`);
  }
});

/* R34 (DEC-116, DEC-100; N520; T27): the docket's ops, keyed to docket's op map (its `docketOps`), and its two public
   reads (docket R14, R15, registered through public-read, not in this module's uses, so named as op-grades R9 names
   them). op-declarations R13 carries their rows. Their grades are op-grades R9's, pinned in its tests; their four
   vocabularies are R34's, here. The reasoned pair's backing and the post's signature are driven at docket's interface
   in backing.test.mjs. */
const DOCKET_WRITES = ["docketfile", "docketdecline", "docketpost", "docketpressure"];
const DOCKET_READS = ["docket", "docketprepare", "docketinvitation"];
const DOCKET_PUBLIC = ["docketpublic", "docketfeed"];
test("R1 R4 R12 R19 R24 R34: the docket's ops — docket's op map holds exactly them, DOCKET_NO_REASON is a row of its "
   + "owner's checks, each write decorates with a rung or a stated absence, none is an act, its four vocabularies are "
   + "the owner's objects — and with the control plane's rows nothing is unaccounted; an op left out is seen", () => {
  const ops = Object.keys(docket.docketOps({}, new URL("http://x/"), {})).sort();
  assert.deepEqual(ops, [...DOCKET_WRITES, ...DOCKET_READS].sort(), "docket's op map holds exactly these");
  assert.ok(Object.hasOwn(docket.DOCKET_CHECKS, "DOCKET_NO_REASON"), "a row of its owner's checks");
  assert.ok(JUSTIFICATION_REFUSALS.includes("DOCKET_NO_REASON"), "in the family");
  for (const op of DOCKET_WRITES) {
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.equal((d.rung === null) !== (d.rung_absence === null), true, `R24: ${op}`);
  }
  const ALL = [...DOCKET_WRITES, ...DOCKET_READS, ...DOCKET_PUBLIC];
  assert.ok(![...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => ALL.includes(a.id)));
  /* R4, R34: the four vocabularies, docket's own objects (its DOCKET_VOCABULARIES), by reference */
  for (const [k, v] of Object.entries(docket.DOCKET_VOCABULARIES)) assert.equal(VOCABULARIES[k], v, k);
  /* the control plane's rows (op-declarations R13): the four writes mutating, every op gated */
  const table = [...DOCKET_WRITES.map((op) => ({ op, mutating: true, gated: true })),
    ...[...DOCKET_READS, ...DOCKET_PUBLIC].map((op) => ({ op, mutating: false, gated: true }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ALL.includes(op)), []);
  assert.deepEqual(ALL.filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  const left = A.unaccounted([...table, { op: "docketunnamed", mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [["docketunnamed"], ["docketunnamed"]]);
});

/* op-grades R10 (DEC-112 (6), DEC-96 items 1, 2; N520, N522; T28): case-import's eight ops, keyed to its op map
   (`caseImportOps`), and case-checker's two public reads (its R15, registered through public-read R18; case-checker is
   not in this module's uses, so they are named as op-grades R10 names them). op-declarations R14 carries their rows.
   Their grades are pinned in op-grades' tests. The four reasoned acts' backing is driven at case-import's interface in
   backing.test.mjs. */
import { caseImportOps, CASE_IMPORT_CHECKS, DECLARED_OPS } from "../../../src/case-import/index.mjs";
const IMPORT_PUBLIC = ["casechecker", "casefilespec"];
test("R1 R4 R12 R19 R24: case-import's ops — its op map holds every op it declares, the codes its declared refusals name "
   + "are rows of its own checks in the justification family, each write decorates with the rung or ground it declares, "
   + "none is an act, no vocabulary is added — and with the control plane's rows nothing is unaccounted; an op left out is "
   + "seen", () => {
  const declared = DECLARED_OPS;
  const isAct = (op) => [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].some((a) => a.id === op);
  /* K4225: the op set is the owner's, read from its ops map and its DECLARED_OPS, never a list kept here. op-grades R12's
     watch acts (T31) are acts, held in t31.test.mjs; they are told by being published, not by name. */
  const mapOps = Object.keys(caseImportOps({}, new URL("http://x/"), {})).filter((op) => !isAct(op)).sort();
  for (const op of Object.keys(declared).filter((o) => !isAct(o))) assert.ok(mapOps.includes(op), `${op}: declared, so in the map`);
  const unlisted = mapOps.filter((op) => !Object.hasOwn(declared, op));
  for (const op of unlisted) assert.ok([RUNGS, RUNG_ABSENT, NON_ACTS].some((t) => Object.hasOwn(t, op)), `${op}: a hand grade`);
  /* R19: each code a declared refusal names is a row of its owner's checks, in the family; no other code of them is */
  const codes = [...new Set(Object.values(declared).map((r) => r.refusal).filter(Boolean))];
  assert.ok(codes.length > 0);
  for (const c of codes) {
    assert.ok(Object.hasOwn(CASE_IMPORT_CHECKS, c), `${c} is a row of its owner's checks`);
    assert.ok(JUSTIFICATION_REFUSALS.includes(c), c);
  }
  for (const c of Object.keys(CASE_IMPORT_CHECKS).filter((k) => !codes.includes(k))) assert.ok(!JUSTIFICATION_REFUSALS.includes(c), `${c} stays out`);
  const mutates = (op) => (Object.hasOwn(declared, op) ? declared[op].mutating : Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op));
  const IMPORT_WRITES = mapOps.filter(mutates), IMPORT_READS = mapOps.filter((op) => !mutates(op));
  assert.ok(IMPORT_WRITES.length > 0 && IMPORT_READS.length > 0, "the owner has writes and reads");
  for (const op of IMPORT_WRITES) {
    const d = A.decorate({ id: op, label: "x" }, null);
    assert.equal((d.rung === null) !== (d.rung_absence === null), true, `R24: ${op}`);
    /* the grade is the one the owner declares, as op-grades R49 registers it */
    if (Object.hasOwn(declared, op)) assert.equal(d.rung ?? d.rung_absence, declared[op].weight, `${op}: the declared weight`);
  }
  const ALL = [...IMPORT_WRITES, ...IMPORT_READS, ...IMPORT_PUBLIC];
  assert.ok(!ALL.some(isAct));
  /* R4: no vocabulary is added, and none names an import */
  assert.deepEqual(Object.keys(VOCABULARIES).filter((k) => /import|checker|case_file/.test(k)), []);
  /* the control plane's rows (op-declarations R14): every write mutating, every op gated */
  const table = [...IMPORT_WRITES.map((op) => ({ op, mutating: true, gated: true })),
    ...[...IMPORT_READS, ...IMPORT_PUBLIC].map((op) => ({ op, mutating: false, gated: true }))];
  const r = A.unaccounted(table);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.deepEqual(r.stale.filter((op) => ALL.includes(op)), []);
  /* negative controls: carried by no row, each reads stale; a read carried ungated is not stale (K4279); an op left out reads
     unpublished and unranked */
  assert.deepEqual(ALL.filter((op) => !A.unaccounted([]).stale.includes(op)), []);
  /* K4279 (R12): a read carried ungated is not stale, a NON_ACT's owner-declared read */
  for (const op of [...IMPORT_READS, ...IMPORT_PUBLIC])
    assert.ok(!A.unaccounted([{ op, mutating: false, gated: false }]).stale.includes(op), op);
  const left = A.unaccounted([...table, { op: "importunnamed", mutating: true, gated: true }]);
  assert.deepEqual([left.unpublished, left.unranked], [["importunnamed"], ["importunnamed"]]);
});

/* ---- R64 (T50; N1108, N1125; DEC-253; K3366): the acts' names and the prompts, read by key --------------------------------- */
test("R64: each act's label is word(act.<id>.name) over the 57 ACTS and the 3 CAPTURE_ACTS, and a set act's word(act.<id>.name.selected) "
   + "over the 4 PER_ITEM_ACTS; the four ids DEC-309 added are keyed; no label is held here as English", () => {
  assert.equal(ACTS.length, 57);
  assert.equal(CAPTURE_ACTS.length, 3);
  assert.equal(PER_ITEM_ACTS.length, 4);
  for (const a of [...ACTS, ...CAPTURE_ACTS]) assert.equal(a.label, word(`act.${a.id}.name`), a.id);
  for (const a of PER_ITEM_ACTS) assert.equal(a.label, word(`act.${a.id}.name.selected`), a.id);
  for (const id of ["retire", "conclude", "reopen", "projectleave"]) assert.equal(ACTS.find((a) => a.id === id).label, word(`act.${id}.name`), id);
  /* the decorated act (R11) and the catalogue answer carry the same words */
  const { catalog, capture_acts, set_acts } = A.affordancesAnswer({ kinds: null, gate: null });
  for (const d of [...catalog, ...capture_acts]) assert.equal(d.label, word(`act.${d.id}.name`), d.id);
  for (const d of set_acts) assert.equal(d.label, word(`act.${d.id}.name.selected`), d.id);
  /* control: an act with no `act.<id>.name` word fails by its id, so the plane never publishes an act it cannot name */
  assert.throws(() => A.actName("noact"), /NO_ACT_NAME: act noact/);
  assert.throws(() => A.actName("release", true), /NO_ACT_NAME: act release/, "the .selected word is a set act's only");
});

test("R64 R5: the prompts are read by key — prompt.inquirydivide, prompt.inquiryground and prompt.attest.fence (its {ceiling} and "
   + "{unreachable} the two grade letters, R5) — while SELF_ATTESTED_PROMPT and CONSENT_PROMPT stay their owners' sentences", () => {
  assert.equal(A.DIVIDE_PROMPT, word("prompt.inquirydivide"));
  assert.equal(A.GROUND_PROMPT, word("prompt.inquiryground"));
  assert.equal(A.ATTEST_FENCE, word("prompt.attest.fence", { ceiling: EARNED_CAPTURE_CEILING, unreachable: UNREACHABLE_CAPTURE_GRADE }));
  assert.equal(A.attestFence("C", "B"), word("prompt.attest.fence", { ceiling: "C", unreachable: "B" }));
  assert.equal(A.SELF_ATTESTED_PROMPT, caseAuthoring.SELF_ATTESTED_SENTENCE);
  assert.equal(A.CONSENT_PROMPT, `${sources.CONSENT_STATEMENT} ${sources.WITHDRAWAL_STATEMENT}`);
  /* control: the fence refuses to compose without both letters, as before */
  assert.throws(() => A.attestFence("B", null));
});

test("R64 R41: the sentence explainRefusal gives for a code no catalogue row holds is the word refusal.uncatalogued, and the module no longer "
   + "composes one (NOT_CATALOGUED is gone)", () => {
  const e = A.explainRefusal({ op: "conclude", code: "SOMETHING_NEW", rowOf: () => null });
  assert.deepEqual([e.translation, e.check, e.detail], [null, null, word("refusal.uncatalogued")]);
  assert.equal(A.NOT_CATALOGUED, undefined);
  /* control: a catalogued code answers its row and no detail */
  const c = A.explainRefusal({ op: "conclude", code: "NO_CONCLUSION", rowOf: () => ({ translation: "x", check: "C-1" }) });
  assert.deepEqual([c.translation, c.check, c.detail], ["x", "C-1", null]);
});
