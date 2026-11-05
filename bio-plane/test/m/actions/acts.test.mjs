/* actions' acts at its interface: move, correspond, laws, proposals, tier, quotes (R13–R19, R22–R24, R27, R28, R34). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, actionMd, CP, mintedIn } from "./fixture.mjs";
import * as grammar from "../../../src/action-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "ACTN-2026-0001-a";
const M = V("alice");
const reasons = (list) => list.map((r) => r.reason);
/* the codes `action-records` mints (its R7, R16), named through the rows action-grammar holds for them */
const RECORDS = mintedIn("action-records");

test("R13 R14 actionMove: refusals in order, then one state_history entry and a promotion; the clock is untouched", () => {
  const w = world();
  w.action(A, ["clock:", '  - text: "t"', '    description: "d"', "    date: 2020-01-01", "    basis: s", "    status: pending"]);
  const mv = (x) => w.a.actionMove({ target: A, to: "active", reason: "go", viewer: M, author: M, ...x });
  assert.deepEqual(reasons([mv({ author: MACHINE }), mv({ author: "" }), mv({ reason: "" }), mv({ reason: 'a"b' }),
    mv({ reason: "x".repeat(501) }), mv({ target: "" }), mv({ target: "ACTN-2026-0404-no" }), mv({ to: "flying" }),
    mv({ to: "resolved" })]),
    ["MACHINE_CANNOT_MOVE_ACTION", "MACHINE_CANNOT_MOVE_ACTION", "ACTION_MOVE_NO_REASON", "BAD_REASON", "BAD_REASON",
     "NO_TARGET", "NO_SUCH_BUNDLE", "BAD_TARGET_STATE", "ILLEGAL_TRANSITION"]);
  assert.equal(mv({ author: MACHINE }).check, "C-32.3");
  /* N217, K275: the move's own condition under its own code and row, never the shared `NO_REASON`. */
  const nr = mv({ reason: "  " });
  assert.deepEqual([nr.reason, nr.code, nr.check], ["ACTION_MOVE_NO_REASON", "ACTION_MOVE_NO_REASON", "C-117.4"]);
  assert.ok(nr.translation.length > 40);
  w.doc("INFO-2026-0001-d");
  assert.equal(mv({ target: "INFO-2026-0001-d" }).reason, "NOT_AN_ACTION");
  const on = mv({});
  assert.deepEqual([on.ok, on.from, on.to, on.weight], [true, "planned", "active", "single"]);
  assert.equal(mv({ to: "resolved", resolution: "" }).reason, "NO_RESOLUTION");
  assert.equal(mv({ to: "awaiting_response", resolution: "complied" }).reason, "RESOLUTION_WITHOUT_RESOLVING");
  const done = mv({ to: "resolved", resolution: "complied" });
  assert.equal(done.ok, true);
  const fm = w.fm(A);
  assert.deepEqual([fm.current_state, fm.prior_state, fm.resolution], ["resolved", "active", "complied"]);
  assert.equal(fm.state_history.length, 2);
  assert.equal(fm.clock[0].status, "pending", "never touches the clock");
});

test("R15 R16 R34 actionCorrespond: refusals in order; one entry appended with the server's stamps; the lease is released", () => {
  const w = world();
  const s = w.doc("INFO-2026-0001-d");
  w.action(A);
  const c = (x) => w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-09-02", account: "we asked", viewer: M, author: M, ...x });
  assert.deepEqual(reasons([c({ author: MACHINE }), c({ target: "" }), c({ direction: "up" }), c({ at: "2 Sept" }),
    c({ artifactSha: s }), c({ account: "" }), c({ account: "", artifactSha: "zz" }),
    c({ direction: "no_response", account: "", artifactSha: s }), c({ account: 'a"b' }), c({ medium: "x\ny" }),
    c({ party: "p\\q" }), c({ stage: "request", exemptions: 'a"b' }), c({ stage: "Request!" }),
    c({ direction: "received", account: "", artifactSha: s, quoteAmount: "1", quoteCurrency: 'U"SD', quoteAnswers: "0" }),
    c({ target: "ACTN-2026-0404-no" }), c({ target: "INFO-2026-0001-d" }), c({ account: "", artifactSha: "d".repeat(64) })]),
    [RECORDS.MACHINE_CANNOT_CORRESPOND, "NO_TARGET", "BAD_DIRECTION", RECORDS.BAD_DATE, RECORDS.CAPTURE_AND_TESTIMONY,
     RECORDS.NEITHER_CAPTURE_NOR_TESTIMONY, "BAD_SHA", "NO_RESPONSE_HAS_NO_BYTES", "BAD_ACCOUNT", "BAD_MEDIUM", "BAD_PARTY",
     "LIFECYCLE_TEXT_UNWRITABLE", "LIFECYCLE_TOKEN_MALFORMED", "QUOTE_TEXT_UNWRITABLE", "NO_SUCH_BUNDLE", "NOT_AN_ACTION",
     RECORDS.UNREGISTERED_ARTIFACT]);
  w.record.acquireLease(A, V("bob"), 60000);
  assert.equal(c({}).reason, "LEASE_HELD");
  w.record.acquireLease(A, V("bob"), 0);
  const before = w.text(A);
  const e = c({});
  assert.deepEqual([e.ok, e.ord, e.held_as, e.author, e.weight], [true, 0, "testimony", M, "single"]);
  assert.equal(e.recorded_at, "2026-09-28T12:00:00Z");
  assert.ok(w.text(A).startsWith(before.split("\n---\n")[0].split("\n").slice(0, 3).join("\n")));
  assert.ok(!("quote" in e) && !("lifecycle" in e), "an entry with neither key writes the bytes it wrote before");
  assert.equal(c({ direction: "received", account: "", artifactSha: s, author: V("bob") }).ok, true, "the lease was released");
  assert.equal(w.fm(A).correspondence.length, 2, "append-only: the first entry stands");
  assert.equal(w.fm(A).correspondence[0].account, "we asked");
});

test("R17 a received capture of another bundle gains one responds_to edge naming the action, once", () => {
  const w = world();
  const s = w.doc("INFO-2026-0001-d");
  w.action(A);
  const r1 = w.a.actionCorrespond({ target: A, direction: "received", at: "2026-09-03", artifactSha: s, viewer: M, author: M });
  assert.deepEqual(r1.responds_to, { bundle_id: "INFO-2026-0001-d", already: false });
  assert.equal(w.fm("INFO-2026-0001-d").references.filter((x) => x.rel === "responds_to" && x.target === A).length, 1);
  const r2 = w.a.actionCorrespond({ target: A, direction: "received", at: "2026-09-04", artifactSha: s, viewer: M, author: M });
  assert.deepEqual(r2.responds_to, { bundle_id: "INFO-2026-0001-d", already: true });
  const sent = w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-09-05", artifactSha: s, viewer: M, author: M });
  assert.equal(sent.responds_to, undefined, "a sent artifact responds to nothing");
});

test("R18 R25 actionLaws: refusals in order; the whole list replaced, stamped and logged; a proposal stored apart (action-records R1) never sets it, and the read answers it beside the list", () => {
  const w = world();
  w.action(A);
  const L = (laws, x) => w.a.actionLaws({ target: A, laws, viewer: M, author: M, ...x });
  const ok = [{ level: "state", citation: "Act s.1" }];
  assert.deepEqual(reasons([L(ok, { author: MACHINE }), L(ok, { target: "" }), L([]), L(Array(13).fill(0).map((_, i) => ({ level: "city", citation: `B${i}` }))),
    L([{ level: "local", citation: "x" }]), L([{ level: "city", citation: "" }]), L([{ level: "city", citation: "a" }, { level: "city", citation: "A" }]),
    L(ok, { target: "ACTN-2026-0404-no" })]),
    ["MACHINE_CANNOT_SET_LAWS", "NO_TARGET", RECORDS.NO_LAWS, RECORDS.TOO_MANY_LAWS, RECORDS.BAD_LAW_LEVEL, RECORDS.BAD_CITATION,
     RECORDS.BAD_CITATION, "NO_SUCH_BUNDLE"]);
  const lvl = L([{ level: "local", citation: "x" }]);
  assert.equal(lvl.check, "C-73.3");
  /* N246: the translation names the levels LAW_LEVELS holds (jurisdictions R31), and no other. */
  for (const l of grammar.LAW_LEVELS) assert.ok(lvl.translation.includes(l), l);
  assert.deepEqual(lvl.legal, [...grammar.LAW_LEVELS]);
  assert.doesNotMatch(lvl.translation, /\blocal\b|three levels/);
  const lv = world(); lv.action(A);
  for (const l of grammar.LAW_LEVELS)
    assert.equal(lv.a.actionLaws({ target: A, laws: [{ level: l, citation: `Code ${l}` }], viewer: M, author: M }).ok, true, `${l} is a level`);
  const set = L(ok);
  assert.deepEqual([set.ok, set.by, set.replaced], [true, M, null]);
  const fm = w.fm(A);
  assert.equal(fm.governing_laws_by, M); assert.equal(fm.governing_laws.length, 1);
  const two = L([{ level: "county", citation: "C 1" }, { level: "city", citation: "B 2" }]);
  /* F1: the list replaced is read through action-grammar's one reader (governingLawsOf); its R31 adds `layer`
     (null when none is stored). Where the reader answers the key, each entry is {level, citation, layer: null};
     where it does not yet, the entry is {level, citation}. */
  const layered = two.replaced.every((l) => Object.hasOwn(l, "layer"));
  assert.deepEqual(two.replaced, layered ? ok.map((l) => ({ ...l, layer: null })) : ok);
  /* the proposals stored apart are action-records' (its R1); the read answers them beside the member's list */
  assert.equal(w.a.records.actionLawsPropose({ target: A, laws: [{ level: "state", citation: "Other" }], proposer: MACHINE, viewer: MACHINE }).ok, true);
  assert.equal(w.fm(A).governing_laws.length, 2, "never changes the list");
  w.a.records.actionLawsPropose({ target: A, laws: [{ level: "city", citation: "Mine" }], proposer: M, viewer: M });
  const read = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual(read.governing_laws_proposals, w.a.records.lawProposalsFor(A), "read through action-records, unchanged");
  assert.equal(read.governing_laws_proposals.proposals.length, 2);
  assert.equal(read.governing_laws.laws.length, 2, "the member's list, apart");
});

test("R18 (T47) the list's shape is judged by action-records.lawEntries (its R7), the one site of C-73.2–C-73.5, at its place among the act's refusals", () => {
  const w = world();
  w.action(A);
  const bad = [[], "not json", Array(13).fill(0).map((_, i) => ({ level: "city", citation: `B${i}` })), [{ level: "local", citation: "x" }],
    [{ level: "city", citation: "" }], [{ level: "city", citation: "a" }, { level: "city", citation: "A" }]];
  for (const laws of bad) {
    const act = w.a.actionLaws({ target: A, laws, viewer: M, author: M });
    const judged = w.a.records.lawEntries(laws);
    assert.deepEqual([act.reason, act.check, act.translation, act.detail], [judged.reason, judged.check, judged.translation, judged.detail],
      JSON.stringify(laws).slice(0, 60));
    assert.match(grammar.GOVERNING_LAW_CHECKS[act.reason].where, /^src\/action-records\/index\.mjs lawEntries > /, "one site");
  }
  /* after the machine fence and the target, before the action is looked for */
  assert.equal(w.a.actionLaws({ target: A, laws: [], viewer: MACHINE, author: MACHINE }).reason, "MACHINE_CANNOT_SET_LAWS");
  assert.equal(w.a.actionLaws({ target: "", laws: [], viewer: M, author: M }).reason, "NO_TARGET");
  assert.equal(w.a.actionLaws({ target: "ACTN-2026-0404-no", laws: [], viewer: M, author: M }).reason, "NO_LAWS");
  /* the control: a well-formed list is the entries the judgment answers, written as given */
  const ok = [{ level: "state", citation: "Act s.1" }];
  assert.deepEqual(w.a.actionLaws({ target: A, laws: ok, viewer: M, author: M }).laws, w.a.records.lawEntries(ok).entries);
});

test("R15 R22 the act refuses by action-grammar's quote and lifecycle grammar (its R4, R5), first found, then DUE_CITE_NOT_GOVERNING; no due date computed", () => {
  const w = world();
  const s = w.doc("INFO-2026-0001-d");
  w.action(A);
  const c = (x) => w.a.actionCorrespond({ target: A, at: "2026-09-02", viewer: M, author: M, ...x });
  assert.equal(c({ direction: "sent", account: "asked", quoteAmount: "5", quoteCurrency: "USD", quoteAnswers: "0" }).reason, "QUOTE_NOT_ON_RECEIVED");
  assert.equal(c({ direction: "sent", account: "asked", stage: "request" }).ok, true);
  const rq = (x) => c({ direction: "received", artifactSha: s, ...x });
  assert.equal(rq({ quoteAmount: "five", quoteCurrency: "USD", quoteAnswers: "0" }).reason, "QUOTE_AMOUNT_NOT_A_NUMBER");
  assert.equal(rq({ quoteAmount: "5", quoteAnswers: "0" }).reason, "QUOTE_NO_CURRENCY");
  assert.equal(rq({ quoteAmount: "5", quoteCurrency: "USD", quoteAnswers: "9" }).reason, "QUOTE_ANSWERS_NO_SENT");
  assert.equal(rq({ quoteAmount: "5", quoteCurrency: "USD", quoteAnswers: "0", quoteRevises: "0" }).reason, "QUOTE_REVISES_NO_QUOTE");
  assert.equal(rq({ stage: "appeal", follows: "0" }).reason, "STAGE_NOT_OF_DIRECTION");
  assert.equal(rq({ stage: "production", follows: "7" }).reason, "FOLLOWS_NO_ENTRY");
  assert.equal(rq({ stage: "denial", follows: "0" }).reason, "DECISION_WITHOUT_OUTCOME");
  assert.equal(rq({ stage: "denial", follows: "0", outcome: "maybe" }).reason, "OUTCOME_NOT_IN_VOCABULARY");
  assert.equal(rq({ stage: "fee_estimate", follows: "0" }).reason, "FEE_ESTIMATE_WITHOUT_QUOTE");
  assert.equal(rq({ stage: "acknowledgement", follows: "0", dueBy: "2026-10-01" }).reason, "DUE_HALF_STATED");
  assert.equal(rq({ stage: "acknowledgement", follows: "0", dueBy: "soon", dueCite: "x" }).reason, "DUE_NOT_A_DATE");
  assert.equal(rq({ stage: "acknowledgement", follows: "0", dueBy: "2026-10-01", dueCite: "Act s.1" }).reason, "DUE_CITE_NOT_GOVERNING");
  assert.equal(c({ direction: "sent", account: "x", stage: "appeal", follows: "0" }).reason, "APPEAL_NAMES_NO_DECISION");
  assert.equal(c({ direction: "sent", account: "x", outcome: "granted" }).reason, "OUTCOME_NOT_ON_RECEIVED");
  const tok = c({ direction: "sent", account: "x", stage: "request", follows: "x".repeat(41) });
  assert.deepEqual([tok.reason, tok.check], ["LIFECYCLE_TOKEN_MALFORMED", "C-94.12"]);
  const txt = c({ direction: "received", artifactSha: s, exemptions: "x".repeat(501) });
  assert.deepEqual([txt.reason, txt.check], ["LIFECYCLE_TEXT_UNWRITABLE", "C-94.11"]);
  assert.equal(c({ direction: "received", artifactSha: s, dueBy: "2026-10-01", dueCite: "C".repeat(201) }).reason, "LIFECYCLE_TEXT_UNWRITABLE");
  const q = rq({ quoteAmount: "1,083.00", quoteCurrency: "USD", quoteAnswers: "0", stage: "fee_estimate", follows: "0" });
  assert.equal(q.ok, true); assert.deepEqual(q.quote.quote_amount, "1,083.00");
  const w2 = rq({ quoteAmount: "0", quoteCurrency: "USD", quoteAnswers: "0", quoteRevises: "1" });
  assert.equal(w2.ok, true, "a waiver is a revision to zero; both stand");
  const life = w.a.actionRead({ id: A, viewer: M }).lifecycle;
  assert.ok(life.entries.every((e) => e.due.state === "undetermined"), "no due date is computed");
});

test("R23 R24 actionRiskTier: refusals in order; one appended history entry; the answer states prior and words", () => {
  const w = world();
  w.action(A, ["risk_tier: 1"]);
  const t = (x) => w.a.actionRiskTier({ target: A, tier: 2, reason: "exposure", viewer: M, author: M, ...x });
  assert.deepEqual(reasons([t({ author: MACHINE }), t({ target: "" }), t({ target: "ACTN-2026-0404-x" }), t({ tier: 4 }),
    t({ tier: "undetermined" }), t({ reason: "" }), t({ reason: "x".repeat(501) }), t({ tier: 1 })]),
    ["MACHINE_CANNOT_SET_RISK_TIER", "NO_TARGET", "NO_SUCH_BUNDLE", "BAD_RISK_TIER", "BAD_RISK_TIER",
     "RISK_TIER_REASON_REFUSED", "RISK_TIER_REASON_REFUSED", "RISK_TIER_UNCHANGED"]);
  assert.deepEqual([t({ tier: 4 }).check, t({ tier: 1 }).check], ["C-90.2", "C-90.4"]);
  const r = t({ tier: "2" });
  assert.deepEqual([r.ok, r.risk_tier, r.prior, r.risk_tier_words, r.by], [true, 2, 1, word("risk.tier.2"), M]);
  const r2 = t({ tier: 3, reason: "counsel" });
  assert.equal(r2.risk_tier_history.revisions.length, 2);
  assert.deepEqual(r2.risk_tier_history.revisions[0], r.risk_tier_history.revisions[0], "never edits an earlier entry");
});

test("R23 (T47) BAD_RISK_TIER is answered by action-records.badRiskTier (its R8), the one site of C-90.2, in its place among the act's refusals", () => {
  const w = world();
  w.action(A, ["risk_tier: 1"]);
  for (const tier of [4, 0, "undetermined", "x", null]) {
    const act = w.a.actionRiskTier({ target: A, tier, reason: "exposure", viewer: M, author: M });
    assert.deepEqual(act, w.a.records.badRiskTier(A, tier, "the act"), String(tier));
    assert.equal(act.check, "C-90.2");
  }
  assert.equal(grammar.RISK_TIER_REVISION_CHECKS.BAD_RISK_TIER.where, "src/action-records/index.mjs badRiskTier > is-bad-risk-tier");
  /* after NOT_AN_ACTION, before the reason is judged; the control: 1, 2 or 3 is not refused by it */
  assert.equal(w.a.actionRiskTier({ target: "ACTN-2026-0404-x", tier: 4, reason: "", viewer: M, author: M }).reason, "NO_SUCH_BUNDLE");
  assert.equal(w.a.actionRiskTier({ target: A, tier: 4, reason: "", viewer: M, author: M }).reason, "BAD_RISK_TIER");
  assert.equal(w.a.actionRiskTier({ target: A, tier: 2, reason: "", viewer: M, author: M }).reason, "RISK_TIER_REASON_REFUSED");
});

test("R27 actionQuotes: one axis; by request with absence levels; by counterparty exactly; at most 500", () => {
  const w = world();
  const s = w.doc("INFO-2026-0001-d");
  w.action(A);
  const Q = (x) => w.a.actionQuotes({ viewer: M, ...x });
  assert.equal(Q({}).reason, "QUOTE_READ_UNASKED"); assert.equal(Q({ request: A, counterparty: "x" }).check, "C-72.7");
  assert.equal(Q({ request: A, answers: "one" }).reason, "QUOTE_ANSWERS_NOT_AN_ORD");
  assert.equal(Q({ request: "ACTN-2026-0404-x" }).reason, "NO_SUCH_BUNDLE");
  assert.equal(Q({ request: "INFO-2026-0001-d" }).reason, "NOT_AN_ACTION");
  assert.equal(Q({ request: A }).absence.level, "no_request");
  w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-09-02", account: "asked", viewer: M, author: M });
  assert.equal(Q({ request: A }).absence.level, "no_reply");
  w.a.actionCorrespond({ target: A, direction: "received", at: "2026-09-03", artifactSha: s, viewer: M, author: M });
  assert.equal(Q({ request: A }).absence.level, "no_quote");
  w.a.actionCorrespond({ target: A, direction: "received", at: "2026-09-04", artifactSha: s, quoteAmount: "10", quoteCurrency: "USD", quoteAnswers: "0", viewer: M, author: M });
  const by = Q({ request: A });
  assert.equal(by.count, 1); assert.equal(by.max, 500); assert.equal(by.truncated, false);
  assert.deepEqual([by.quotes[0].amount, by.quotes[0].value, by.quotes[0].held_as, by.quotes[0].answers.ord], ["10", 10, "capture", 0]);
  assert.equal(Q({ counterparty: "Town Clerk, Town of Port Ellery" }).count, 1);
  assert.equal(Q({ counterparty: "town clerk" }).absence.level, "no_quote_by_name");
  assert.equal(Q({ counterparty: "Town Clerk, Town of Port Ellery", viewer: "nobody" }).count, 0, "gated by the viewer");
  assert.ok(!Object.keys(by.quotes[0]).some((k) => /compar|exceed|rank/.test(k)), "no field compares quotes");
});

test("R25 the read answers the tier proposals action-records holds (its R2), apart from the member's tier, at most 12, newest first", () => {
  const w = world();
  w.action(A, ["risk_tier: 1"]);
  const P = (x) => w.a.records.actionRiskPropose({ target: A, tier: 3, basis: "the office is a court", proposer: MACHINE, viewer: MACHINE, ...x });
  const before = w.text(A);
  assert.equal(P({}).ok, true);
  assert.equal(w.text(A), before, "the proposal writes no file and never touches the tier");
  for (let i = 0; i < 13; i++) { w.clock.ms += 1000; P({ proposer: V(`m${i}`), viewer: V(`m${i}`) }); }
  const read = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual(read.risk_tier_proposals, w.a.records.riskProposalsFor(A), "read through action-records, unchanged");
  assert.deepEqual([read.risk_tier_proposals.proposals.length, read.risk_tier_proposals.truncated], [12, true]);
  assert.equal(read.risk_tier_proposals.proposals[0].by, V("m12"), "newest first");
  assert.equal(read.risk_tier, 1, "the member's tier, apart");
  const empty = world(); empty.action(A);
  assert.match(empty.a.actionRead({ id: A, viewer: M }).risk_tier_proposals.says, /no proposal/);
});
