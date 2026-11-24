/* contradiction R39–R41 (the measures), R17, R42 and R47 (what is kept, and how a purge takes it), R19, R23, R48, and the
   thirteen N345 routes, driven at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { MACHINE, sha } from "./fixture.mjs";
import { seeded, cand, recommend, RUN, PRINCIPAL, IQ, INFO, CID, M1 } from "./seed.mjs";
import { contradictionOps, CONTRADICTION_TABLES, ACCEPTANCE_REVIEW, RECOMMEND_PROMPT, RECOMMEND_PROMPT_SHA256,
         CONTRADICTION_ABSENCE, CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS, NOTICE_SENTENCE, NOTICE_NAMED_SENTENCE } from "../../../src/contradiction/index.mjs";

test("R39: acceptance per coordinate — offered, accepted, chosen unaided, chose otherwise — counts only; review due at 95% over at least 30 offered, PROVISIONAL", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const [scope, time] = recommend(w, duty, [{ coordinate: "scope", reason: "r" }, { coordinate: "time_or_occasion", reason: "r" }])
    .recommendations.map((r) => r.recommendation);
  w.clock.now = "2026-09-28T01:00:00Z";
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope", "meaning"], accepted: [scope], explanation: "x", viewer: M1, author: M1 });
  w.clock.now = "2026-09-28T02:00:00Z";
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["time_or_occasion"], explanation: "y", viewer: M1, author: M1 });
  void time;
  const r = w.c.acceptanceRates({});
  const by = Object.fromEntries(r.coordinates.map((c) => [c.coordinate, c]));
  assert.deepEqual(by.scope, { coordinate: "scope", offered: 2, accepted: 1, chosen_unaided: 0, chose_otherwise: 1, review_due: false });
  assert.deepEqual(by.time_or_occasion, { coordinate: "time_or_occasion", offered: 2, accepted: 0, chosen_unaided: 1, chose_otherwise: 1, review_due: false });
  assert.deepEqual(by.meaning, { coordinate: "meaning", offered: 0, accepted: 0, chosen_unaided: 1, chose_otherwise: 0, review_due: false });
  assert.deepEqual(r.threshold, { rate: 0.95, min_offered: 30, status: "PROVISIONAL" });
  assert.deepEqual(ACCEPTANCE_REVIEW, r.threshold);
  assert.ok(!JSON.stringify(r).includes("%"));
  assert.deepEqual(w.c.acceptanceRates({ coordinate: "scope" }).coordinates.map((c) => c.coordinate), ["scope"]);
  assert.equal(w.c.acceptanceRates({ since: "2026-09-28T01:30:00Z" }).coordinates.find((c) => c.coordinate === "scope").offered, 1);
  /* review due: 30 offered, all accepted */
  const m = seeded();
  for (let i = 0; i < 30; i++) {
    m.version(IQ.b, `v${i + 2}`, { claim: `the fee fell ${i}` });
  }
  const pairs = m.c.pairs({ key: "K2", viewer: MACHINE }).pairs;
  for (const p of pairs.slice(0, 30)) {
    const id = m.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
                             proposals: [{ key: "K2", a: p.a, b: p.b, label: "record", reason: "r" }] }).candidates[0].candidate;
    const rec = recommend(m, id, [{ coordinate: "scope", reason: "r" }]).recommendations[0].recommendation;
    assert.equal(m.c.clarify({ candidate: id, choice: "differs", coordinates: ["scope"], accepted: [rec], viewer: M1, author: M1 }).ok, true);
  }
  const due = m.c.acceptanceRates({ coordinate: "scope" }).coordinates[0];
  assert.deepEqual([due.offered, due.accepted, due.review_due], [30, 30, true]);
  assert.doesNotThrow(() => w.c.acceptanceRates({ coordinate: {}, since: 3 }));
});

test("R40: dismissed leads counted by reason, by key and by label; false_conflicts counts only the first two reasons", () => {
  const w = seeded();
  w.c.dismiss({ candidate: cand(w, "K4", "world"), reason: "same_fact_different_precision", viewer: M1, author: M1 });
  w.c.dismiss({ candidate: cand(w, "K1", "undetermined"), reason: "real_conflict_not_pursued", viewer: M1, author: M1 });
  const r = w.c.dismissalMeasure({});
  assert.deepEqual([r.dismissed, r.by_reason, r.by_key, r.by_label, r.false_conflicts], [2,
    { same_fact_different_precision: 1, not_same_matter: 0, real_conflict_not_pursued: 1 }, { K4: 1, K1: 1 }, { world: 1, undetermined: 1 }, 1]);
  assert.match(r.says, /never counted as a false conflict/);
  assert.equal(w.c.dismissalMeasure({ since: "2099-01-01" }).dismissed, 0);
  assert.doesNotThrow(() => w.c.dismissalMeasure({ since: {} }));
});

test("R41: the recommender's prompt is pinned by the digest its blind fixture was measured under", { todo: "no model is reachable from this job to run the blind fixture of dissolved pairs; RECOMMEND_PROMPT_SHA256 stays null, which says the prompt passed no measurement (K488)" }, () => {});

test("R41 (as far as it can be checked without a run): the prompt exists and claims no measurement", () => {
  assert.equal(typeof RECOMMEND_PROMPT, "string");
  assert.equal(RECOMMEND_PROMPT_SHA256, null);
  assert.ok(RECOMMEND_PROMPT.includes("Never say which side is wrong"));
});

test("R17, R42: append-only — acts, recommendations, opt-ins and responses are only ever added; a repeated act adds a row and changes none", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  recommend(w, duty, [{ coordinate: "scope", reason: "r" }]);
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "first", viewer: M1, author: M1 });
  const snap = (t) => JSON.stringify(w.rows(`SELECT * FROM ${t} ORDER BY seq`));
  const before = { acts: snap("contradiction_acts"), recs: snap("contradiction_recommendations"), cands: snap("contradiction_candidates") };
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "second", viewer: M1, author: M1 });
  recommend(w, duty, [{ coordinate: "scope", reason: "again" }]);
  assert.ok(snap("contradiction_acts").startsWith(before.acts.slice(0, -1)));
  assert.equal(w.count("contradiction_acts"), 2);
  assert.equal(snap("contradiction_recommendations"), before.recs);
  assert.equal(snap("contradiction_candidates"), before.cands);
});

test("R47, R22: every table is declared to record-core's purge by both sides' bundles; opt-ins and responses also by their project", () => {
  const w = seeded();
  assert.deepEqual([...CONTRADICTION_TABLES], ["contradiction_candidates", "contradiction_acts", "contradiction_recommendations",
                                               "contradiction_optins", "contradiction_responses"]);
  const duty = cand(w, "K4", "record");
  recommend(w, duty, [{ coordinate: "scope", reason: "r" }]);
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", viewer: M1, author: M1 });
  const P = "PROJ-2026-0001-a";
  w.project(P, ["m1"]);
  const row = w.one(`SELECT a_bundle_id, b_bundle_id FROM contradiction_candidates WHERE candidate=?`, duty);
  w.st.sql.exec(`INSERT INTO contradiction_optins (optin, candidate, kind, project_id, author, at, seq, a_bundle_id, b_bundle_id)
                 VALUES ('o1', ?, 'optin', ?, ?, 't', 1, 'X', 'Y')`, duty, P, M1);
  w.st.sql.exec(`INSERT INTO contradiction_responses (response, candidate, project_id, author, at, seq, text, a_bundle_id, b_bundle_id)
                 VALUES ('r1', ?, ?, ?, 't', 1, 'text', 'X', 'Y')`, duty, P, M1);
  /* a project's purge takes its opt-ins and responses */
  w.record.purge({ bundleId: P });
  assert.deepEqual([w.count("contradiction_optins"), w.count("contradiction_responses")], [0, 0]);
  /* either side's bundle takes every row of the candidate */
  w.record.purge({ bundleId: row.b_bundle_id });
  for (const t of ["contradiction_candidates", "contradiction_acts", "contradiction_recommendations"]) assert.equal(w.count(t), 0, t);
  const report = w.record.purge({});
  for (const t of CONTRADICTION_TABLES) assert.ok(JSON.stringify(report).includes(t), t);
  void row.a_bundle_id;
});

test("R48: no key pairs an aspiration: a side living in one forms no pair", () => {
  const w = seeded();
  w.bundle("ASP-2026-0001-hope", { type: "aspiration", subject: "E1" });
  w.version("ASP-2026-0001-hope", "v1", { claim: "the fee should fall" });
  w.leg("ASP-2026-0001-hope", 0, "supports", { content: CID.a, target: INFO.a });
  w.leg("ASP-2026-0001-hope", 1, "cuts_against", { content: CID.b, target: INFO.b });
  w.versionLeg("ASP-2026-0001-hope", "v1", 0, { content: CID.a, target: INFO.a });
  w.versionLeg(IQ.a, "v1", 0, { content: CID.a, target: INFO.a });
  const all = JSON.stringify(w.c.pairs({ viewer: MACHINE }).pairs);
  assert.ok(!all.includes("ASP-2026-0001-hope"));
  assert.equal(w.c.pairs({ key: "K2", viewer: MACHINE }).pairs_formed, 1);     /* the two inquiries still pair */
});

test("R19: no act edits, grades or deletes a side; only a member's act says what a candidate was; nothing is shown but through R25–R29 and R50", () => {
  const w = seeded();
  const tables = ["inquiry_basis", "inquiry_basis_versions", "inquiry_basis_version_legs", "content", "readings", "resolutions"];
  const snap = () => JSON.stringify(tables.map((t) => w.rows(`SELECT * FROM ${t} ORDER BY 1, 2`)));
  const before = snap();
  const duty = cand(w, "K2", "record"), lead = cand(w, "K4", "world"), k1 = cand(w, "K1", "record");
  recommend(w, duty, [{ coordinate: "scope", reason: "r" }]);
  w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: "wrong", viewer: M1, author: M1 });
  w.c.dismiss({ candidate: lead, reason: "not_same_matter", viewer: M1, author: M1 });
  w.c.clarify({ candidate: k1, choice: "differs", coordinates: ["scope"], explanation: "x", evidence: [{ fact: "subject" }], viewer: M1, author: M1 });
  assert.equal(snap(), before);
  /* the pairing read shows no candidate */
  assert.doesNotMatch(JSON.stringify(w.c.pairs({ viewer: MACHINE })), /"candidate"|"weight"|"label"/);
});

test("R23: no place is named in the module's behaviour or outward text, the N345 answers and rows included", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const texts = [JSON.stringify(w.c.candidatesFor({ on: { candidate: duty }, viewer: M1 })), JSON.stringify(CONTRADICTION_ABSENCE),
                 JSON.stringify(CONTRADICTION_PAIR_CHECKS), JSON.stringify(CONTRADICTION_CANDIDATE_CHECKS), NOTICE_SENTENCE, NOTICE_NAMED_SENTENCE,
                 RECOMMEND_PROMPT, JSON.stringify(w.c.dismiss({ candidate: duty, reason: "x", viewer: M1, author: M1 }))];
  for (const t of texts) assert.doesNotMatch(t, /oakland|alameda|california|berkeley|san francisco|\bcounty of\b|\bcity of\b/i);
});

test("the N345 routes: each op reads its own fields from the body or query and the control plane's stamps only from the query", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const url = (q) => new URL(`https://plane/?${new URLSearchParams(q)}`);
  const ops = (q, body) => contradictionOps(w.c, url(q), body);
  const forged = { author: "member:forged", viewer: "class:admin", proposedBy: "forged", principal: "forged" };
  assert.equal(ops({ viewer: M1, candidate: duty }, forged).contradictioncandidates().candidates[0].candidate, duty);
  assert.equal(ops({ viewer: M1 }, { on: { inquiry: IQ.a } }).contradictioncandidates().candidates.length, 1);
  assert.equal(ops({ viewer: M1 }, { referents: [{ ref: `${IQ.a}|v1`, version: sha("the fee rose") }] }).contradictiontensions().referents[0].marks[0].mark, "in_tension");
  assert.equal(ops({ viewer: M1 }, { candidate: duty }).contradictionfacts().ok, true);
  /* a stamp in the body is never read: no author stamped, the act is a machine's */
  assert.equal(ops({ viewer: M1 }, { candidate: duty, ...forged, choice: "one_wrong", wrongSide: "a", reason: "r" }).contradictionclarify().code, "MACHINE_CANNOT_ACT_ON_CANDIDATE");
  const rec = ops({ viewer: MACHINE, proposedBy: "class:ai/t", principal: PRINCIPAL },
                  { run: RUN, candidate: duty, coordinates: [{ coordinate: "scope", reason: "r" }], ...forged }).contradictionrecommend();
  assert.deepEqual([rec.ok, rec.recommendations[0].proposed_by], [true, "class:ai/t"]);
  const cl = ops({ viewer: M1, author: M1 }, { candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x" }).contradictionclarify();
  assert.equal(cl.ok, true);
  const up = ops({ viewer: M1, author: M1 }, { candidate: duty, question: "Q?", frame: "a" }).contradictiontakeup();
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
  const res = ops({ viewer: M1, author: M1 }, { inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "both conclusions stand" }).contradictionresolve();
  assert.equal(res.ok, true, JSON.stringify(res).slice(0, 300));
  const lead = cand(w, "K4", "world");
  assert.equal(ops({ viewer: M1, author: M1 }, { candidate: lead, reason: "not_same_matter" }).contradictiondismiss().ok, true);
  for (const op of ["contradictionnotices", "contradictionoptin", "contradictionrespond", "contradictionresponses"])
    assert.equal(ops({ viewer: M1, author: M1, project: "PROJ-2026-0404-x" }, { candidate: duty, text: "t" })[op]().code, "NO_SUCH_PROJECT", op);
  /* the module's own route map: fifteen ops (R61's `contradictionflag` among them), each a contradiction op and a function (their names are op-declarations', not listed here) */
  const routes = ops({}, null);
  assert.equal(Object.keys(routes).length, 15);
  for (const [name, handler] of Object.entries(routes)) assert.ok(name.startsWith("contradiction") && typeof handler === "function", name);
});
