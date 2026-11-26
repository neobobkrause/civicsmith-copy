/* record-grammar at its interface: the document grammar moved at T19 (R30–R36): the heading sets, the state
   machines, the type-keyed vocabulary lookup, the case-member predicate, the section slicer and the inquiry title rule,
   each pinned whole as the catalogue held it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEADINGS, HEADINGS_WHEN, STATES, vocabFor, isCaseMemberBytes, sectionText, INQUIRY_TITLE_MAX, deriveInquiryTitle,
  inquiryQuestionOf, OBJECT_TYPES, normalizeType } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const FOCUS_HEADINGS = ["## Statement", "## Why It Matters", "## Open Questions", "## Session Log", "## Review Notes"];

test("R32 HEADINGS: the literal heading set per type; problem is the same array as focus", () => {
  assert.deepEqual({ ...HEADINGS }, {
    information: ["## Summary", "## Provenance Notes", "## Session Log", "## Review Notes"],
    inquiry: ["## Question", word("conformance.rests"), "## Conclusion", word("conformance.falsify"), "## Session Log", "## Review Notes"],
    focus: FOCUS_HEADINGS,
    project: ["## Thesis Summary", "## Open Questions", "## Ruled Out", "## Session Log", "## Review Notes"],
    action: ["## Plan", "## Status", "## Correspondence", "## Session Log", "## Review Notes"],
    bias: ["## Statements", "## Adoption", "## What This Does Not Enforce", "## Session Log", "## Review Notes"],
    problem: FOCUS_HEADINGS });
  assert.ok(HEADINGS.problem === HEADINGS.focus);
  assert.ok(!Object.isFrozen(HEADINGS));
});

test("R33 HEADINGS_WHEN: the inquiry's exclusion heading, owed by a case member; none for the legacy spellings", () => {
  assert.deepEqual({ ...HEADINGS_WHEN }, { inquiry: [{ heading: "## What This Excludes", whenCaseMember: true }], problem: [], focus: [] });
  assert.ok(HEADINGS_WHEN.problem === HEADINGS_WHEN.focus);
  assert.ok(!Object.isFrozen(HEADINGS_WHEN));
});

/** A type's state machine as R35 names it. @typedef {{legal: string[], legacy?: string[], edges: {[state: string]: string[]}}} Machine */
/** @param {string[]} legal @param {{[state: string]: string[]}} edges @param {string[]} [legacy] @returns {Machine} */
const M = (legal, edges, legacy) => {
  if (legacy) {
    /** @type {Machine} */
    const withLegacy = { legal, legacy, edges };
    return withLegacy;
  }
  /** @type {Machine} */
  const machine = { legal, edges };
  return machine;
};
const FOCUS = M(["surfaced", "elevated", "deferred", "dismissed"], { surfaced: ["elevated", "deferred", "dismissed"],
  deferred: ["surfaced", "elevated", "dismissed"], dismissed: ["surfaced", "elevated", "deferred"], elevated: [] });
const ONE = M(["recorded"], { recorded: [] });

test("R35 R57 R58 R59 STATES: every type's legal states and edges, inquiry's legacy `published`, project's legacy `investigating` and `matured`, escalation's `stopped_pursuing`, action_plan's `paused`, success_record's `recorded`, and problem the same machine as focus", () => {
  /** @type {{[type: string]: Machine}} */
  const MACHINES = {
    information: M(["collected", "verified", "retired"], { collected: ["verified"], verified: ["retired"], retired: [] }),
    inquiry: M(["open", "deferred", "dismissed", "surfaced", "concluded", "divided"], {
      open: ["deferred", "dismissed", "concluded", "divided"], surfaced: ["deferred", "dismissed", "concluded", "divided"],
      deferred: ["open", "surfaced", "dismissed"], dismissed: ["open", "surfaced", "deferred"],
      concluded: ["open", "surfaced", "deferred", "dismissed", "divided"], published: ["open", "surfaced"], divided: [] }, ["published"]),
    focus: FOCUS,
    project: M(["forming", "closed"], { forming: ["closed"], investigating: ["closed"], matured: ["closed"], closed: ["forming"] },
      ["investigating", "matured"]),
    action: M(["planned", "active", "awaiting_response", "resolved", "abandoned"], { planned: ["active", "abandoned"],
      active: ["awaiting_response", "resolved", "abandoned"], awaiting_response: ["active", "resolved", "abandoned"],
      resolved: [], abandoned: [] }),
    bias: M(["draft", "proposed", "adopted", "retired"], { draft: ["proposed", "retired"], proposed: ["draft", "adopted", "retired"],
      adopted: ["retired"], retired: [] }),
    standard: ONE, determination: ONE, consequence: ONE,
    escalation: M(["open", "suspended", "ended", "stopped_pursuing"], { open: ["suspended", "ended", "stopped_pursuing"],
      suspended: ["open", "ended", "stopped_pursuing"], ended: [], stopped_pursuing: ["open"] }),
    aspiration: M(["held", "retired"], { held: ["retired"], retired: [] }),
    goal: M(["open", "closed"], { open: ["closed"], closed: [] }),
    action_plan: M(["open", "paused", "closed"], { open: ["paused", "closed"], paused: ["open", "closed"], closed: [] }),
    success_record: ONE,
    problem: FOCUS };
  assert.deepEqual({ ...STATES }, MACHINES);
  assert.ok(STATES.problem === STATES.focus);
  assert.ok(!Object.isFrozen(STATES));
  /* Every bundle type has a machine, every edge lands on a state its machine reads, and nothing enters a legacy state.
     T33's new objects are table rows, not bundles, and have none (R3); T46's success record, promoted with history, has a
     machine and no headings (R59). */
  const BUNDLE = ["INFO", "PROB", "FOCUS", "INQ", "PROJ", "ACTN", "BIAS", "STD", "CONF", "CONS", "ESC", "ASP", "GOAL", "PLN"];
  /** @type {{[prefix: string]: string}} */
  const TYPE_OF = {
    INFO: OBJECT_TYPES.INFO, PROB: OBJECT_TYPES.PROB, FOCUS: OBJECT_TYPES.FOCUS, INQ: OBJECT_TYPES.INQ, PROJ: OBJECT_TYPES.PROJ, ACTN: OBJECT_TYPES.ACTN, BIAS: OBJECT_TYPES.BIAS,
    STD: OBJECT_TYPES.STD, CONF: OBJECT_TYPES.CONF, CONS: OBJECT_TYPES.CONS, ESC: OBJECT_TYPES.ESC, ASP: OBJECT_TYPES.ASP, GOAL: OBJECT_TYPES.GOAL, PLN: OBJECT_TYPES.PLN,
    CALC: OBJECT_TYPES.CALC, EVT: OBJECT_TYPES.EVT, LIN: OBJECT_TYPES.LIN, MNY: OBJECT_TYPES.MNY, MSR: OBJECT_TYPES.MSR, PFA: OBJECT_TYPES.PFA, IDC: OBJECT_TYPES.IDC,
    MTI: OBJECT_TYPES.MTI, CHK: OBJECT_TYPES.CHK, HYP: OBJECT_TYPES.HYP, DUT: OBJECT_TYPES.DUT, STQ: OBJECT_TYPES.STQ, SUC: OBJECT_TYPES.SUC };
  assert.deepEqual(Object.keys(TYPE_OF).sort(), Object.keys(OBJECT_TYPES).sort());
  for (const t of new Set(BUNDLE.map((p) => TYPE_OF[p] ?? ""))) assert.ok(MACHINES[t], t);
  for (const [p, t] of Object.entries(TYPE_OF))
    if (!BUNDLE.includes(p)) assert.ok((p === "SUC") === (t in STATES) && !(t in HEADINGS), t);
  for (const [t, m] of Object.entries(MACHINES)) {
    const readable = [...m.legal, ...(m.legacy || [])];
    assert.deepEqual(Object.keys(m.edges).sort(), [...readable].sort(), t);
    for (const to of Object.values(m.edges).flat()) assert.ok(m.legal.includes(to), `${t} -> ${to}`);
  }
  assert.equal(STATES.inquiry.legal[0], "open");
  assert.equal(STATES.project.legal[0], "forming");
  /* Only inquiry and project carry `legacy` (K904, form (b)). */
  assert.deepEqual(Object.keys(MACHINES).filter((t) => "legacy" in (MACHINES[t] ?? {})), ["inquiry", "project"]);
});

test("R34 vocabFor: the declared spelling first, then the normalized type, else undefined", () => {
  assert.equal(vocabFor({ problem: STATES.problem, focus: STATES.focus, inquiry: STATES.inquiry }, "problem"), STATES.focus);
  assert.equal(vocabFor({ information: HEADINGS.information, focus: HEADINGS.focus, problem: HEADINGS.problem }, "focus"), HEADINGS.focus);
  assert.equal(vocabFor({ focus: STATES.focus, inquiry: STATES.inquiry }, "inquiry"), STATES.inquiry);
  /** @type {{[type: string]: number}} */
  const t = { inquiry: 1, x: 0 };
  assert.equal(vocabFor(t, "problem"), 1);
  assert.equal(vocabFor(t, "focus"), 1);
  assert.equal(vocabFor(t, "x"), 0);
  for (const odd of ["memo", undefined, null]) assert.equal(vocabFor({ inquiry: 1 }, odd), undefined);
  /* An inherited key is `table[t]` too, and only a missing table throws. */
  assert.equal(vocabFor({}, "constructor"), Object);
  assert.equal(vocabFor({ focus: STATES.focus }, "toString"), Object.prototype.toString);
  for (const t of [null, undefined]) assert.throws(() => vocabFor(t, "inquiry"), TypeError);
});

test("R33 isCaseMemberBytes: a frozen array of at least two axis objects; fails closed on any other shape", () => {
  /** @param {unknown} a */
  const ax = (a) => ({ axis: a });
  assert.equal(isCaseMemberBytes({ published_strength: [ax("capture"), ax("connection")] }), true);
  assert.equal(isCaseMemberBytes({ published_strength: [ax("capture"), ax("connection"), ax("testimony")] }), true);
  assert.equal(isCaseMemberBytes({ published_strength: [ax("x"), ax("y")] }), true);
  for (const fm of [undefined, null, {}, { published_strength: [] }, { published_strength: [null, ax("a")] }, { published_strength: [ax("capture")] },
    { published_strength: "two" }, { published_strength: [ax("a"), null] }, { published_strength: [ax("a"), { axis: 1 }] },
    { published_strength: [ax("a"), "b"] }]) assert.equal(isCaseMemberBytes(fm), false, JSON.stringify(fm));
});

test("R36 sectionText: from the heading to the next `## ` line or the end; null when the heading is absent", () => {
  const body = "## A\na1\n### sub\n## B\nb1\n## C";
  assert.equal(sectionText(body, "## A"), "## A\na1\n### sub");
  assert.equal(sectionText(body, "## B"), "## B\nb1");
  assert.equal(sectionText(body, "## C"), "## C");
  assert.equal(sectionText(body, "## D"), null);
  assert.equal(sectionText("", "## A"), null);
  assert.equal(sectionText("x ## A\n## B", "## A"), "## A");
  assert.equal(sectionText("## A\n## A2\n## B", "## A"), "## A");
  for (const b of [undefined, null, 1, {}]) assert.throws(() => sectionText(b, "## A"), TypeError);
});

/* T46 (P8): R36 says only a non-string throws, and only a string is sliced. An array or a String object answered indexOf
   and slice too, and was sliced as if it were text; each is a TypeError now. */
test("R36 sectionText throws a TypeError for every non-string body, an array and a String object among them; a string never throws", () => {
  for (const b of [["## A", "x"], ["## A"], [], new String("## A\nx"), { indexOf: () => 0, slice: () => "## A" }, Symbol("s"), 10n, true])
    assert.throws(() => sectionText(b, "## A"), TypeError, String(typeof b));
  /* Control: the same text as a string is sliced. */
  assert.equal(sectionText("## A\nx", "## A"), "## A\nx");
  for (const b of ["", "## A", "no heading", "\n## A\n## A"]) assert.doesNotThrow(() => sectionText(b, "## A"));
});

test("R30 deriveInquiryTitle: the first non-empty line, whitespace collapsed, cut at a word boundary before 120 with an ellipsis", () => {
  assert.equal(INQUIRY_TITLE_MAX, 120);
  assert.equal(deriveInquiryTitle("  Why   is it\tso?  \nmore"), "Why is it so?");
  assert.equal(deriveInquiryTitle("\n \n second"), "second");
  for (const v of [undefined, null, "", "  \n\t"]) assert.equal(deriveInquiryTitle(v), null);
  assert.equal(deriveInquiryTitle(12), "12");
  const exact = "a".repeat(120);
  assert.equal(deriveInquiryTitle(exact), exact);
  const words = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
  const cut = words.slice(0, 120);
  assert.equal(deriveInquiryTitle(words), cut.slice(0, cut.lastIndexOf(" ")) + "…");
  assert.equal(deriveInquiryTitle("b".repeat(130)), "b".repeat(120) + "…");
  for (let n = 100; n < 140; n++) {
    const t = deriveInquiryTitle(("xy ").repeat(n));
    assert.ok(t !== null && t.length <= 121 && (t.length <= 120 || t.endsWith("…")), String(n));
  }
});

test("R31 inquiryQuestionOf: the `## Question` section's text, or '' when the document has none", () => {
  assert.equal(inquiryQuestionOf("## Question\nWhy?\n## What It Rests On\nx"), "Why?");
  assert.equal(inquiryQuestionOf("intro\n## Question  \nline 1\nline 2\n"), "line 1\nline 2\n");
  assert.equal(inquiryQuestionOf("## Question\nonly"), "only");
  for (const v of [undefined, null, "", "## Statement\nx", "## Questions\nx"]) assert.equal(inquiryQuestionOf(v), "");
  assert.equal(deriveInquiryTitle(inquiryQuestionOf("## Question\n  What  happened?\nDetail.\n## B")), "What happened?");
});

test("R30 deriveInquiryTitle is closure-free: its source text, evaluated alone, gives the same answers", () => {
  const alone = (0, eval)(`(${deriveInquiryTitle.toString()})`);
  const inputs = [undefined, null, "", " \n ", "Why?", "  a \t b \n c", "x".repeat(130), ("word ").repeat(40), 7, true,
    { toString: () => "  from an object  " }, "\n\nthird line first"];
  for (const v of inputs) assert.equal(alone(v), deriveInquiryTitle(v), String(v));
});

test("R30 R31 never throw, whatever they are handed that String() accepts", () => {
  for (const v of [undefined, null, 0, NaN, [], [1, 2], {}, Symbol.iterator.description, "## Question\n\n## B"]) {
    assert.doesNotThrow(() => deriveInquiryTitle(v));
    assert.doesNotThrow(() => inquiryQuestionOf(v));
  }
  assert.equal(inquiryQuestionOf("## Question\t \nq"), "q");
  assert.equal(inquiryQuestionOf("## Question x\nq"), "");
});

/* T46 (P8): R31's heading line may end in spaces or tabs and nothing else. It took any white space but a newline. */
test("R31 inquiryQuestionOf: a `## Question` line ending in spaces or tabs only, then \\n or \\r\\n, is the heading; any other trailing character is not", () => {
  for (const tail of ["", " ", "\t", " \t  ", "\r", " \t\r"]) assert.equal(inquiryQuestionOf(`x\n## Question${tail}\nq\n## B`), "q", JSON.stringify(tail));
  for (const tail of ["\f", "\v", "\u00a0", "\u2003", "\u3000", "\ufeff", "\u2028", " \f", "\r\r", "\r ", "x", " ?"])
    assert.equal(inquiryQuestionOf(`x\n## Question${tail}\nq\n## B`), "", JSON.stringify(tail));
  /* Control: a CRLF document's question is read, the CR of its own lines kept as written. */
  assert.equal(inquiryQuestionOf("## Question\r\nWhy?\r\n## B"), "Why?\r");
});

/* T46 (R57; N910): an escalation the group stops pursuing (escalation R31). Each new state and edge by name, with the
   controls (K874): `ended` is not reachable from it, nothing but `open` leaves it, and the earlier states keep every edge. */
test("R57 STATES.escalation: legal open suspended ended stopped_pursuing; open and suspended reach stopped_pursuing; stopped_pursuing reaches open alone; ended none", () => {
  const e = STATES.escalation;
  assert.deepEqual(e.legal, ["open", "suspended", "ended", "stopped_pursuing"]);
  assert.equal(e.legal[0], "open");
  assert.ok(!("legacy" in e));
  assert.deepEqual(e.edges.open, ["suspended", "ended", "stopped_pursuing"]);
  assert.deepEqual(e.edges.suspended, ["open", "ended", "stopped_pursuing"]);
  assert.deepEqual(e.edges.stopped_pursuing, ["open"]);
  assert.deepEqual(e.edges.ended, []);
  /* Negative controls: a stopped escalation is never ended or suspended from there, and nothing leaves ended. */
  for (const to of ["ended", "suspended", "stopped_pursuing"]) assert.ok(!e.edges.stopped_pursuing.includes(to), to);
  /** @type {readonly string[]} */
  const fromEnded = e.edges.ended;
  assert.ok(!fromEnded.includes("stopped_pursuing") && !fromEnded.includes("open"));
  /* The edges before R57, each kept. */
  assert.ok(e.edges.open.includes("suspended"), "open -> suspended");
  assert.ok(e.edges.open.includes("ended"), "open -> ended");
  assert.ok(e.edges.suspended.includes("open"), "suspended -> open");
  assert.ok(e.edges.suspended.includes("ended"), "suspended -> ended");
});

/* T46 (R58; N914): a paused action plan (action-plans R40). `goal`, which shared the machine's shape, keeps its own. */
test("R58 STATES.action_plan: legal open paused closed; open reaches paused and closed; paused reaches open and closed; closed none; goal keeps open to closed", () => {
  const p = STATES.action_plan;
  assert.deepEqual(p.legal, ["open", "paused", "closed"]);
  assert.equal(p.legal[0], "open");
  assert.ok(!("legacy" in p));
  assert.deepEqual(p.edges, { open: ["paused", "closed"], paused: ["open", "closed"], closed: [] });
  /* Negative controls: nothing reopens a closed plan, nor pauses it; goal gains no pause. */
  assert.deepEqual(p.edges.closed, []);
  assert.deepEqual(STATES.goal, { legal: ["open", "closed"], edges: { open: ["closed"], closed: [] } });
  assert.ok(!STATES.goal.legal.includes("paused") && STATES.goal !== p);
});
