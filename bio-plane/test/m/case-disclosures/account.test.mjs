/* case-disclosures (T41; N820; D56–D59, D63; K2405, K2418, K2471, K2472): the account and the bias applications.
   R30: `accountJudged` judges every sentence of the account and of the four statements through `case-checker.checkAccount`
   (its R24, a stand-in at its ruled input here: case-checker's T41 entry builds it), with `printed` the statements
   `bias.statementInForce` (its R49; the fixture's `lensStandIn`) answers in force in this case's lens; its departures in
   R30's arm order, a check that cannot be run failing closed, and each `account_check` flag the member has not answered.
   R31: `biasApplicationsOf` answers `case-grammar` R24's rows for every finding a member's chain reaches, and refuses an
   application not in force through inquiry's one test and spelling (its R61, `biasNotInForce`), over the real inquiry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { CASE_DISCLOSURE_CHECKS, ACCOUNT_ARMS, checkerCited } from "../../../src/case-disclosures/index.mjs";
import { INQUIRY_BIAS_CHECKS } from "../../../src/inquiry/checks.mjs";
import { CASE_DOCUMENT_FORMAT, accountLines, accountOf, biasApplicationsLines, biasApplicationsOf } from "../../../src/case-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { checkAccountMalformed } from "../case-checker/fixtures.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q", Q3 = "INQ-2026-0003-q";
const LENS = { type: "project", id: "PROJ-2026-0001" };
/* `case-grammar` R23's cites, `{kind, ref, ord}` */
const H1 = { kind: "passage", ref: "CNT-2026-0001" , ord: null }, H2 = { kind: "finding", ref: "INQ-2026-0001-q" , ord: null };
function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.reason, r.code, r.check, r.translation],
    [code, code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation]);
}
const ACCOUNT = [
  { ord: 1, text: "The council awarded the contract on 3 May.", cites: [H1], kind: "account", began_as: "member" },
  { ord: 2, text: "Read through the lens of procurement scrutiny, the timing stands out.", cites: [], kind: "account",
    bias_statement: "S-scrutiny", began_as: "member" },
  { ord: 3, text: "The award followed the minutes.", cites: [H2], kind: "account", began_as: "machine_draft" },
];
const STATEMENTS = [
  { ord: 4, text: "The case says the award followed the minutes.", cites: [H2], kind: "statement" },
  { ord: 5, text: "The subject was chosen for its spending.", cites: [H1], kind: "subject_justification" },
  { ord: 6, text: "Nothing was left out.", cites: [], kind: "excluded" },
  { ord: 7, text: "First edition.", cites: [], kind: "what_changed" },
];
/* `case-checker.checkAccount` at its ruled input (its R24), scripted: `departures` answered, each call kept */
function checker(departures = []) {
  const c = { calls: [], answer: null };
  c.checkAccount = (args) => { c.calls.push(args); return c.answer ?? { ok: true, departures }; };
  return c;
}
function setup(departures) {
  const ck = checker(departures);
  const w = world({ deps: { caseChecker: ck } });
  w.member("alice");
  return { w, ck };
}
const judge = (w, extra = {}) => w.cd.accountJudged({ account: ACCOUNT, statements: STATEMENTS, cited: { holdings: [] },
  lens: LENS, conclusions: [{ finding: Q, claim: "the award followed the minutes" }], viewer: V("alice"), ...extra });

test("R30: accountJudged hands case-checker's checkAccount every sentence of the account and of the four statements, what they cite as the caller read it, the record's conclusions, and printed — the statements the sentences frame by that bias.statementInForce answers in force in this case's lens, asked as the viewer; it writes nothing", () => {
  const { w, ck } = setup([]);
  w.lens.byScope.set(LENS.id, new Set(["S-scrutiny"]));
  const before = w.snapshot();
  const r = judge(w);
  assert.deepEqual(r.refusals, []);
  assert.equal(ck.calls.length, 1);
  assert.deepEqual(ck.calls[0].account.map((x) => [x.ord, x.kind, x.text]),
    [...ACCOUNT, ...STATEMENTS].map((x) => [x.ord, x.kind, x.text]), "the account and the four statements, every sentence");
  assert.deepEqual(ck.calls[0].cited, [], "case-account's {holdings: []} handed on in checkAccount's shape (T46)");
  assert.deepEqual(ck.calls[0].conclusions, [{ finding: Q, claim: "the award followed the minutes" }]);
  assert.deepEqual([ck.calls[0].printed, r.printed], [["S-scrutiny"], ["S-scrutiny"]]);
  assert.deepEqual(w.lens.asked, [{ statement: "S-scrutiny", scope: LENS, viewer: V("alice") }]);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* negative control: a statement not in this case's lens is not printed */
  const n = setup([]); n.w.lens.byScope.set(LENS.id, new Set(["S-other"]));
  judge(n.w);
  assert.deepEqual(n.ck.calls[0].printed, []);
  const u = setup([]); u.w.lens.read = () => ({ ok: true, in_force: null });
  judge(u.w);
  assert.deepEqual(u.ck.calls[0].printed, [], "an undetermined lens prints nothing");
});

test("R30 (ACCOUNT_SENTENCE_UNSUPPORTED, ACCOUNT_FACT_NOT_IN_CITED, ACCOUNT_CONTRADICTED_BY_RECORD, ACCOUNT_BIAS_NOT_PRINTED, ACCOUNT_CLAIM_NOT_BIAS): each arm checkAccount departs on is refused with its C-120 row, naming each sentence (its ord, kind and text), in R30's order whatever the departures' order; a sentence that departs on two arms is named under each; none departing, nothing is refused", () => {
  assert.deepEqual(ACCOUNT_ARMS, ["ACCOUNT_SENTENCE_UNSUPPORTED", "ACCOUNT_FACT_NOT_IN_CITED", "ACCOUNT_CONTRADICTED_BY_RECORD",
    "ACCOUNT_BIAS_NOT_PRINTED", "ACCOUNT_CLAIM_NOT_BIAS"]);
  for (const code of ACCOUNT_ARMS) {
    const { w } = setup([{ ord: 3, code }, { ord: 1, code }, { ord: 3, code }]);
    const r = judge(w);
    assert.equal(r.refusals.length, 1, code);
    refused(r.refusals[0], code);
    assert.deepEqual(r.refusals[0].sentences, [{ ord: 3, kind: "account", text: ACCOUNT[2].text },
      { ord: 1, kind: "account", text: ACCOUNT[0].text }], code);
    if (code !== "ACCOUNT_SENTENCE_UNSUPPORTED")
      assert.deepEqual(judge(setup([{ ord: 6, code }]).w).refusals[0].sentences.map((x) => x.kind), ["excluded"],
        `${code} judges a statement's sentence too`);
    assert.ok(r.refusals[0].detail.includes("sentence 3") && r.refusals[0].detail.endsWith(word("consequences.nothing")), code);
    /* negative control: the same account, nothing departing */
    assert.deepEqual(judge(setup([]).w).refusals, [], code);
  }
  const { w } = setup([...ACCOUNT_ARMS].reverse().map((code, i) => ({ ord: 1 + (i % 3), code })).concat([{ ord: 2, code: "ACCOUNT_CLAIM_NOT_BIAS" }]));
  const r = judge(w);
  assert.deepEqual(r.refusals.map((x) => x.reason), ACCOUNT_ARMS);
  assert.deepEqual(r.refusals[4].sentences.map((x) => x.ord), [1, 2]);
});

test("R30 (ACCOUNT_CHECK_UNDETERMINED): a check that cannot be run — no checkAccount, one that throws, a refusal, an answer of another shape, a departure on a code that is no arm's or on a sentence the account does not hold — fails closed, alone among the arms, naming every sentence; an empty account asks nothing to stand", () => {
  const answers = {
    "no checkAccount": null,
    throws: () => { throw new Error("down"); },
    refuses: () => checkAccountMalformed(),
    "another shape": () => ({ ok: true }),
    "an unknown code": () => ({ ok: true, departures: [{ ord: 1, code: "ANSWER_CITES_UNREAD" }] }),
    "an unknown sentence": () => ({ ok: true, departures: [{ ord: 99, code: "ACCOUNT_SENTENCE_UNSUPPORTED" }] }),
  };
  for (const [why, fn] of Object.entries(answers)) {
    const w = world({ deps: { caseChecker: fn ? { checkAccount: fn } : {} } });
    const r = judge(w);
    assert.equal(r.refusals.length, 1, why);
    refused(r.refusals[0], "ACCOUNT_CHECK_UNDETERMINED");
    assert.deepEqual(r.refusals[0].sentences.map((x) => x.ord), [1, 2, 3, 4, 5, 6, 7], why);
  }
  assert.deepEqual(world({ deps: { caseChecker: {} } }).cd.accountJudged({ account: [], cited: {} }).refusals, []);
  /* negative control: the check run, nothing departing */
  assert.deepEqual(judge(setup([]).w).refusals, []);
});

test("R30 (ACCOUNT_FLAG_UNANSWERED): each account_check flag (run-rules R25's draft kind) whose sentence still stands as flagged — its text, citing nothing it did not cite when flagged — is refused after the arms, naming the sentence; removing the sentence or tying it to evidence it did not cite answers the flag; a malformed flags list is BAD_COMPLETENESS naming the field, alone", () => {
  const flag = (text, cites) => ({ kind: "account_check", ord: 1, text, cites });
  const { w } = setup([{ ord: 1, code: "ACCOUNT_FACT_NOT_IN_CITED" }]);
  const r = judge(w, { flags: [flag(ACCOUNT[0].text, [H1]), flag(ACCOUNT[2].text, [H2])] });
  assert.deepEqual(r.refusals.map((x) => x.reason), ["ACCOUNT_FACT_NOT_IN_CITED", "ACCOUNT_FLAG_UNANSWERED"]);
  refused(r.refusals[1], "ACCOUNT_FLAG_UNANSWERED");
  assert.deepEqual(r.refusals[1].sentences, [{ ord: 1, kind: "account", text: ACCOUNT[0].text }, { ord: 3, kind: "account", text: ACCOUNT[2].text }]);
  /* answered: removed, or tied to evidence it did not cite */
  const ok = setup([]).w;
  assert.deepEqual(judge(ok, { flags: [flag("A sentence since removed.", []), flag(ACCOUNT[0].text, [])] }).refusals, []);
  /* malformed */
  for (const [flags, field] of [["x", "flags"], [[null], "flags[0]"], [[{ kind: "case_account", text: "t", cites: [] }], "flags[0]"],
                                [[{ kind: "account_check", text: "", cites: [] }], "flags[0]"], [[{ kind: "account_check", text: "t", cites: H1 }], "flags[0]"]]) {
    const b = judge(setup([]).w, { flags });
    assert.deepEqual([b.refusals.length, b.refusals[0].reason, b.refusals[0].field], [1, "BAD_COMPLETENESS", field], JSON.stringify(flags));
  }
});

test("R30: a malformed account or statements list is BAD_COMPLETENESS naming the field, alone, and checkAccount is not asked; the sentences answered carry their ord, cites and bias statement as given", () => {
  for (const [args, field] of [[{ account: "x" }, "account"], [{ account: [{ ord: 1, text: "" }] }, "account[0]"],
                               [{ account: [{ ord: 1, text: "t", cites: H1 }] }, "account[0]"],
                               [{ account: [{ ord: 1, text: "t", cites: [], bias_statement: 3 }] }, "account[0]"],
                               [{ account: ACCOUNT, statements: {} }, "statements"]]) {
    const { w, ck } = setup([]);
    const r = w.cd.accountJudged({ cited: {}, ...args });
    assert.deepEqual([r.refusals.length, r.refusals[0].reason, r.refusals[0].field, ck.calls.length], [1, "BAD_COMPLETENESS", field, 0], field);
  }
  const { w } = setup([]);
  const r = w.cd.accountJudged({ account: ACCOUNT, cited: {} });
  assert.deepEqual(r.sentences.map((x) => [x.ord, x.cites, x.bias_statement]), [[1, [H1], null], [2, [], "S-scrutiny"], [3, [H2], null]]);
});

test("R31: biasApplicationsOf answers case-grammar R24's rows {finding, ord, target: leg, statement, effect, from, to} for every application on a leg of every finding a member's chain reaches, as the viewer sees the record; each statement in force (inquiry R61's test, at the finding's scope) is not refused; it writes nothing", () => {
  const w = world(); w.member("alice");
  w.lens.inForce = new Set(["S1", "S2"]);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q2, [{ target: DOC2, bias_1_statement: "S2", bias_1_effect: "grade_lowered", bias_1_from: "A", bias_1_to: "B" }]);
  w.finding(Q, [{ target: DOC, bias_1_statement: "S1", bias_1_effect: "leg_excluded" }, { target: Q2 }]);
  const before = w.snapshot(), asked = w.lens.asked.length;
  const r = w.cd.biasApplicationsOf(w.prepared([Q]), V("alice"));
  assert.deepEqual(r.refusals, []);
  assert.deepEqual(r.unread, []);
  assert.deepEqual(r.rows, [
    { finding: Q, ord: 0, target: "leg", statement: "S1", effect: "leg_excluded", from: null, to: null },
    { finding: Q2, ord: 0, target: "leg", statement: "S2", effect: "grade_lowered", from: "A", to: "B" }]);
  assert.deepEqual(w.lens.asked.slice(asked).map((a) => [a.statement, a.viewer]), [["S1", V("alice")], ["S2", V("alice")]],
    "inquiry's test asked, as the viewer");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* negative control: no finding reached carries an application */
  const n = world(); n.member("alice"); n.doc(DOC); n.finding(Q3, [{ target: DOC }]);
  assert.deepEqual(n.cd.biasApplicationsOf(n.prepared([Q3]), V("alice")), { refusals: [], rows: [], unread: [] });
});

test("R31 (BIAS_APPLICATION_NOT_IN_FORCE): an application whose statement is no longer in force, or whose standing cannot be read, is named and refused through inquiry's biasNotInForce (its R61: its row C-2.19, never re-derived here), naming the finding, the leg and the statement; a test that cannot be had fails closed the same way", () => {
  const w = world(); w.member("alice");
  w.lens.inForce = new Set(["S1", "S2"]);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q2, [{ target: DOC2, bias_1_statement: "S2", bias_1_effect: "leg_excluded" }]);
  w.finding(Q, [{ target: DOC, bias_1_statement: "S1", bias_1_effect: "leg_excluded" }, { target: Q2 }]);
  w.lens.inForce = new Set(["S1"]);
  const r = w.cd.biasApplicationsOf(w.prepared([Q]), V("alice"));
  assert.equal(r.refusals.length, 1);
  const x = r.refusals[0];
  assert.deepEqual([x.ok, x.reason, x.code, x.check, x.translation, x.finding, x.statement, x.where, x.in_force],
    [false, "BIAS_APPLICATION_NOT_IN_FORCE", "BIAS_APPLICATION_NOT_IN_FORCE", INQUIRY_BIAS_CHECKS.BIAS_APPLICATION_NOT_IN_FORCE.check,
     INQUIRY_BIAS_CHECKS.BIAS_APPLICATION_NOT_IN_FORCE.translation, Q2, "S2", "basis[0].bias_applied[0]", false]);
  assert.equal(r.rows.length, 2, "the rows are answered beside the refusal");
  /* undetermined standing */
  w.lens.read = () => ({ ok: true, in_force: null });
  assert.deepEqual(w.cd.biasApplicationsOf(w.prepared([Q]), V("alice")).refusals.map((y) => [y.finding, y.statement, y.in_force]),
    [[Q, "S1", null], [Q2, "S2", null]]);
  /* no test to be had: inquiry's test throws */
  const t = world({ deps: { inquiry: { biasAppliedFindings: () => { throw new Error("down"); } } } });
  t.member("alice"); t.lens.inForce = new Set(["S1"]); t.doc(DOC);
  t.finding(Q, [{ target: DOC, bias_1_statement: "S1", bias_1_effect: "leg_excluded" }]);
  assert.deepEqual(t.cd.biasApplicationsOf(t.prepared([Q]), V("alice")).refusals.map((y) => [y.reason, y.check, y.statement, y.in_force]),
    [["BIAS_APPLICATION_NOT_IN_FORCE", "C-2.19", "S1", null]]);
  /* negative control: back in force */
  w.lens.read = null; w.lens.inForce = new Set(["S1", "S2"]);
  assert.deepEqual(w.cd.biasApplicationsOf(w.prepared([Q]), V("alice")).refusals, []);
});

test("R31: a finding the chain reaches that the viewer may not see is not followed and its applications are not answered (R8, R17; the members are case-authoring R4's, already seen); one whose document cannot be read is stated unread, never filled", () => {
  const w = world(); w.member("alice"); w.member("bo");
  w.lens.inForce = new Set(["S1", "S2"]);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q2, [{ target: DOC2, bias_1_statement: "S2", bias_1_effect: "leg_excluded" }]);
  w.finding(Q, [{ target: DOC, bias_1_statement: "S1", bias_1_effect: "leg_excluded" }, { target: Q2 }]);
  const H = w.project("Hidden", "bo", []);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, H, Q2);
  assert.deepEqual(w.cd.biasApplicationsOf(w.prepared([Q]), V("alice")).rows.map((x) => x.finding), [Q],
    "alice does not see H's finding: not followed, its application not answered");
  assert.deepEqual(w.cd.biasApplicationsOf(w.prepared([Q]), V("bo")).rows.map((x) => x.finding), [Q, Q2],
    "negative control: bo sees it");
  const u = world({ deps: { record: { readFile: () => { throw new Error("down"); } } } });
  u.member("alice"); u.doc(DOC); u.finding(Q, [{ target: DOC }]);
  assert.deepEqual(u.cd.biasApplicationsOf(u.prepared([Q]), V("alice")).unread.map((x) => x.finding), [Q]);
});

test("R30 (K2533): ACCOUNT_SENTENCE_UNSUPPORTED refuses account sentences only — a statement's sentence citing nothing is not refused by it, and the other arms still judge it", () => {
  const { w } = setup([{ ord: 6, code: "ACCOUNT_SENTENCE_UNSUPPORTED" }, { ord: 7, code: "ACCOUNT_SENTENCE_UNSUPPORTED" },
                      { ord: 6, code: "ACCOUNT_CLAIM_NOT_BIAS" }]);
  const r = judge(w);
  assert.deepEqual(r.refusals.map((x) => x.reason), ["ACCOUNT_CLAIM_NOT_BIAS"]);
  assert.deepEqual(r.refusals[0].sentences.map((x) => [x.ord, x.kind]), [[6, "excluded"]]);
  /* negative control: an account sentence citing nothing is refused by it */
  const a = setup([{ ord: 2, code: "ACCOUNT_SENTENCE_UNSUPPORTED" }]);
  refused(judge(a.w).refusals[0], "ACCOUNT_SENTENCE_UNSUPPORTED");
});

test("R31 (K2531): a conclusion's applications, passed by the caller as basis-versions' conclusionRecordOf answers them, are answered as rows with ord null and target conclusion, and judged by inquiry's same test at the conclusion's project scope; one not in force is refused through biasNotInForce at `conclusion`; a malformed list is BAD_COMPLETENESS, alone", () => {
  const w = world(); w.member("alice");
  w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  w.lens.byScope.set("PROJ-2026-0001", new Set(["S1"]));
  const conclusions = [{ finding: Q, project: "PROJ-2026-0001",
    bias_applied: [{ statement: "S1", effect: "inference_refused" }, { statement: "S9", effect: "inference_refused" }] }];
  const r = w.cd.biasApplicationsOf(w.prepared([Q]), V("alice"), conclusions);
  assert.deepEqual(r.rows, [
    { finding: Q, ord: null, target: "conclusion", statement: "S1", effect: "inference_refused", from: null, to: null },
    { finding: Q, ord: null, target: "conclusion", statement: "S9", effect: "inference_refused", from: null, to: null }]);
  assert.deepEqual(r.refusals.map((x) => [x.reason, x.check, x.finding, x.statement, x.where]),
    [["BIAS_APPLICATION_NOT_IN_FORCE", "C-2.19", Q, "S9", "conclusion.bias_applied[1]"]]);
  assert.deepEqual(w.lens.asked.slice(-2).map((a) => [a.statement, a.scope]),
    [["S1", { type: "project", id: "PROJ-2026-0001" }], ["S9", { type: "project", id: "PROJ-2026-0001" }]]);
  /* negative control: both in force */
  w.lens.byScope.set("PROJ-2026-0001", new Set(["S1", "S9"]));
  assert.deepEqual(w.cd.biasApplicationsOf(w.prepared([Q]), V("alice"), conclusions).refusals, []);
  for (const bad of ["x", [null], [{ project: "P" }], [{ finding: Q, bias_applied: "S1" }], [{ finding: Q, bias_applied: [{ statement: "S1", note: "x" }] }]]) {
    const b = w.cd.biasApplicationsOf(w.prepared([Q]), V("alice"), bad);
    assert.deepEqual([b.refusals.length, b.refusals[0].reason, b.refusals[0].field], [1, "BAD_COMPLETENESS", "conclusions"], JSON.stringify(bad));
  }
});

test("R30, R31 over case-grammar's real blocks (its R23, R24): an account written by accountLines and read back by accountOf is judged as given, its cites as R23 spells them; biasApplicationsOf's rows are R24's, written by biasApplicationsLines and read back by biasApplicationsOf unchanged", () => {
  const doc = (lines) => ({ fm: null, text: ["---", `format: ${CASE_DOCUMENT_FORMAT}`, ...lines, "---", ""].join("\n") });
  const { w, ck } = setup([{ ord: 2, code: "ACCOUNT_BIAS_NOT_PRINTED" }]);
  const read = accountOf(w.fm(doc(accountLines([...ACCOUNT, ...STATEMENTS])).text));
  assert.equal(read.length, 7);
  const r = w.cd.accountJudged({ account: read.filter((x) => x.kind === "account"), statements: read.filter((x) => x.kind !== "account"),
    cited: {}, lens: LENS, flags: [{ kind: "account_check", ord: 3, text: ACCOUNT[2].text, cites: [H2] }], viewer: V("alice") });
  assert.deepEqual(ck.calls[0].account.map((x) => [x.ord, x.cites]), read.map((x) => [x.ord, x.cites]), "cites as R23 reads them");
  assert.deepEqual(r.refusals.map((x) => x.reason), ["ACCOUNT_BIAS_NOT_PRINTED", "ACCOUNT_FLAG_UNANSWERED"]);
  assert.deepEqual(r.refusals[1].sentences.map((x) => x.ord), [3], "a flag on R23's cites compares them by kind, ref and ord");
  /* R31 */
  const b = world(); b.member("alice"); b.lens.inForce = new Set(["S1"]); b.doc(DOC);
  b.finding(Q, [{ target: DOC, bias_1_statement: "S1", bias_1_effect: "grade_lowered", bias_1_from: "A", bias_1_to: "B" }]);
  const out = b.cd.biasApplicationsOf(b.prepared([Q]), V("alice"), [{ finding: Q, project: null, bias_applied: [{ statement: "S1", effect: "scrutiny_raised" }] }]);
  assert.deepEqual(out.refusals, []);
  assert.deepEqual(biasApplicationsOf(b.fm(doc(biasApplicationsLines(out.rows)).text)), out.rows);
  assert.deepEqual(out.rows.map((x) => [x.target, x.ord, x.effect]), [["leg", 0, "grade_lowered"], ["conclusion", null, "scrutiny_raised"]]);
});

test("R30 over the real case-checker.checkAccount (its R24, K2531): the five arms as it judges them, printed from this case's lens, a statement's uncited sentence not refused by the first arm (K2533), and an account that holds refused nothing", () => {
  const w = world(); w.member("alice");                      /* no stand-in: the real case-checker */
  w.lens.byScope.set(LENS.id, new Set(["S1"]));
  const PASSAGE = "The lease was approved without a vote on March 3, 2024, for $4,200, by Jane Doe of the Parks Board.";
  const P1 = { kind: "passage", ref: "P1", ord: null };
  const cited = { holdings: [{ address: "passage:P1", quote: PASSAGE }], rules: [], looks: [] };   /* case-account R6's shape */
  const row = (ord, text, cites, more = {}) => ({ ord, text, cites, kind: "account", began_as: "member", ...more });
  const account = [
    row(1, "The lease was approved without a vote.", [P1]),
    row(2, "The lease was approved for $9,999.", [P1]),
    row(3, "The vendor was favoured.", []),
    row(4, "This group expects a vendor to be favoured.", [], { bias_statement: "S7" }),
    row(5, "Jane Doe favoured the vendor.", [], { bias_statement: "S1" }),
  ];
  const statements = [{ ord: 6, text: "This case looks at one lease.", cites: [], kind: "statement", began_as: "member" }];
  const r = w.cd.accountJudged({ account, statements, cited, lens: LENS, conclusions: [], viewer: V("alice") });
  assert.deepEqual(r.printed, ["S1"]);
  assert.deepEqual(r.refusals.map((x) => [x.reason, x.sentences.map((s) => s.ord)]), [
    ["ACCOUNT_SENTENCE_UNSUPPORTED", [3]], ["ACCOUNT_FACT_NOT_IN_CITED", [2]], ["ACCOUNT_BIAS_NOT_PRINTED", [4]],
    ["ACCOUNT_CLAIM_NOT_BIAS", [5]]]);
  for (const x of r.refusals) refused(x, x.reason);
  /* negative control: the account that holds, with S7 printed */
  w.lens.byScope.set(LENS.id, new Set(["S1", "S7"]));
  assert.deepEqual(w.cd.accountJudged({ account: [account[0], account[3]], statements, cited, lens: LENS, conclusions: [], viewer: V("alice") }).refusals, []);
});

test("R30 (T46; N901): cited arrives as case-account R6 builds it, answers R33's {holdings, rules, looks}, and is translated at this one site into checkAccount's cited (case-checker R24): one {kind, ref, ord?, text} per holding, kind and ref read from its address kind:ref, a leg's ord from the #ord after it, text its quote", () => {
  const IMP = "imported:" + "a".repeat(64) + "/INQ-2026-0042-x";
  const cited = { holdings: [
    { address: `finding:${Q}`, quote: "the finding's text" },
    { address: `leg:${Q}#2`, quote: '{"ord":1}' },
    { address: "passage:CNT-2026-0001", quote: "a passage" },
    { address: `material:${DOC}`, quote: "the material's text" },
    { address: `finding:${IMP}`, quote: "an imported finding" },
    { address: "finding:INQ-2026-0009-q#3", quote: "a # kept off a leg" },
  ], rules: [{ address: "rule:1", quote: "a rule" }], looks: [] };
  const want = [
    { kind: "finding", ref: Q, text: "the finding's text" },
    { kind: "leg", ref: Q, ord: 2, text: '{"ord":1}' },
    { kind: "passage", ref: "CNT-2026-0001", text: "a passage" },
    { kind: "material", ref: DOC, text: "the material's text" },
    { kind: "finding", ref: IMP, text: "an imported finding" },
    { kind: "finding", ref: "INQ-2026-0009-q#3", text: "a # kept off a leg" },
  ];
  assert.deepEqual(checkerCited(cited), want);
  const { w, ck } = setup([]);
  judge(w, { cited });
  assert.deepEqual(ck.calls[0].cited, want, "accountJudged hands checkAccount the translation");
  /* a holding no sentence can cite is not handed on: no kind of case-grammar R23's, no ref, a leg without its ord, no address */
  assert.deepEqual(checkerCited({ holdings: [{ address: "rule:1", quote: "r" }, { address: "finding:", quote: "x" },
    { address: `leg:${Q}`, quote: "x" }, { address: "INQ-2026-0001-q", quote: "x" }, { quote: "x" }, null] }), []);
  /* negative control: any other cited is handed on as given, for checkAccount to judge */
  for (const other of [null, {}, [{ kind: "passage", ref: "P1", text: "t" }]]) assert.equal(checkerCited(other), other);
});

test("R30 (T46; N901; K2829) control, over the real case-checker.checkAccount: an account sentence citing a held finding, its cited read as case-account R6 builds it (address finding:<id>, quote the finding's live text), passes when the finding's words hold its facts; the same sentence whose cite was not read (no holding) answers ACCOUNT_SENTENCE_UNSUPPORTED", () => {
  const w = world(); w.member("alice");                      /* the real case-checker */
  w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const text = w.record.readFile(Q, "bundle.md").text;
  assert.ok(text.includes("the award followed the minutes"));
  const account = [{ ord: 1, text: 'The finding reads "the award followed the minutes".', kind: "account",
                     cites: [{ kind: "finding", ref: Q, ord: null }], began_as: "member" }];
  const held = { holdings: [{ address: `finding:${Q}`, quote: text }], rules: [], looks: [] };
  const conclusions = [{ finding: Q, claim: "the award followed the minutes", legs: [] }];
  const ok = w.cd.accountJudged({ account, cited: held, lens: LENS, conclusions, viewer: V("alice") });
  assert.deepEqual(ok.refusals, [], "the cite read, its words holding the quotation: nothing refused");
  const unread = w.cd.accountJudged({ account, cited: { holdings: [], rules: [], looks: [] }, lens: LENS, conclusions,
                                      viewer: V("alice") });
  assert.deepEqual(unread.refusals.map((x) => [x.reason, x.sentences.map((s) => s.ord)]), [["ACCOUNT_SENTENCE_UNSUPPORTED", [1]]]);
  refused(unread.refusals[0], "ACCOUNT_SENTENCE_UNSUPPORTED");
  /* the quotation not in what it cites is a fact not held: the cite is read, the words judged */
  const other = w.cd.accountJudged({ account: [{ ...account[0], text: 'The finding reads "the award broke the rules".' }],
    cited: held, lens: LENS, conclusions, viewer: V("alice") });
  assert.deepEqual(other.refusals.map((x) => x.reason), ["ACCOUNT_FACT_NOT_IN_CITED"]);
});
