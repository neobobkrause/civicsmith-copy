/* contradiction R57 (N394; proposed, BOB's to rule): the over-strictness gate (CONTRADICTION-IDENTIFY-DESIGN §7, M-118,
   M-162), with R1, R2, R4 and R11 as the gate reads them and R13–R16 over its corpus. Converted from the old suite
   `test/contradiction-overstrict.test.mjs` (K572, K573): the same labelled corpus (`gate-corpus.mjs`), the same
   measure and gate (`gate-measure.mjs`), the same lexical baseline (`gate-baseline.mjs`) and the same recorded machine
   judgement (`gate-recorded.mjs`), each copied here unchanged but for its header. The corpus is laid down as a record in
   the fixture, and every pair the gate scores is one `pairs` forms; the judgement's input is `renderJudgementInput`'s;
   the recorded answers enter through `propose`. A live model is not reachable from a test: the recording is the
   measurement, and a moved prompt digest (R2) leaves pairs it cannot answer, which the gate fails by name. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { world, MACHINE, MEMBER } from "./fixture.mjs";
import { K1, K2, K3, K4, REQUIRED_SHAPES } from "./gate-corpus.mjs";
import { measure, gate, pairId, handleOf, KEYS, LABELS, THRESHOLD } from "./gate-measure.mjs";
import { judgeBaseline } from "./gate-baseline.mjs";
import { RUNS, ANSWERS, PROMPT_SHA256, recordedJudge } from "./gate-recorded.mjs";
import { CONTRADICTION_LABELS, CONTRADICTION_CANDIDATE_CHECKS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256,
         renderJudgementInput } from "../../../src/contradiction/index.mjs";

const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const RUN = "RUN-2026-0925-contradiction";
const PRINCIPAL = "member:m1";
const ALL = [...K1.map((e) => ["K1", e]), ...K2.map((e) => ["K2", e]), ...K3.map((e) => ["K3", e]),
             ...K4.map((e) => ["K4", e])];

/* The corpus as a record. Each entry is laid down so that exactly its own key forms it and no other key forms anything:
   K1 an inquiry with a supports and a cuts_against leg on two passages; K2 two inquiries on one subject, each with an
   accepted claim; K3 two inquiries whose accepted claims rest on one passage; K4 two cited passages of two captures,
   read with the corpus's doctype and date, resolving (established) to one entity. Answers the world with the side text
   by capture (a member reads the passage; the pairing names only its capture), K3's passage by pair, and the gold map. */
function corpus(opts) {
  const w = world(opts);
  w.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  const text = new Map(), passage = new Map(), gold = new Map();
  let n = 0;
  const part = (id, t) => { const cap = sha(`m071-${id}`); w.content(`c-${id}`, cap, `INFO-${id}`); text.set(cap, t); return cap; };
  for (const e of K1) {
    const inq = `INQ-2026-0071-${e.id}`;
    const a = part(`${e.id}-a`, e.a), b = part(`${e.id}-b`, e.b);
    w.inquiry(inq);
    w.leg(inq, 0, "supports", { content: `c-${e.id}-a`, target: `INFO-${e.id}-a` });
    w.leg(inq, 1, "cuts_against", { content: `c-${e.id}-b`, target: `INFO-${e.id}-b` });
    gold.set(pairId("K1", a, b), { id: e.id, shape: e.shape, label: e.label });
  }
  for (const e of K2) {
    const ent = `E-${7100 + (++n)}`;
    const side = (s, claim) => { const inq = `INQ-2026-0071-${e.id}-${s}`; w.inquiry(inq, { subject: ent });
                                 w.version(inq, `reading ${s}`, { claim }); return `${inq}|reading ${s}`; };
    gold.set(pairId("K2", side("a", e.a), side("b", e.b)), { id: e.id, shape: e.shape, label: e.label });
  }
  for (const e of K3) {
    part(e.id, e.passage);
    const side = (s, claim) => { const inq = `INQ-2026-0071-${e.id}-${s}`; w.inquiry(inq);
                                 w.version(inq, `reading ${s}`, { claim });
                                 w.versionLeg(inq, `reading ${s}`, 0, { content: `c-${e.id}`, target: `INFO-${e.id}` });
                                 return `${inq}|reading ${s}`; };
    const id = pairId("K3", side("a", e.a), side("b", e.b));
    gold.set(id, { id: e.id, shape: e.shape, label: e.label });
    passage.set(id, e.passage);
  }
  for (const e of K4) {
    const ent = `E-${71000 + (++n)}`, inq = `INQ-2026-0071-${e.id}`;
    const doc = (s, d) => { const cap = part(`${e.id}-${s}`, d.text);
                            w.reading(cap, `INFO-${e.id}-${s}`, { contentType: d.doctype, date: d.date });
                            w.resolution(cap, `INFO-${e.id}-${s}`, ent); return cap; };
    const a = doc("a", e.a), b = doc("b", e.b);
    w.inquiry(inq);
    w.leg(inq, 0, "supports", { content: `c-${e.id}-a`, target: `INFO-${e.id}-a` });
    w.leg(inq, 1, "supports", { content: `c-${e.id}-b`, target: `INFO-${e.id}-b` });
    gold.set(pairId("K4", a, b), { id: e.id, shape: e.shape, label: e.label });
  }
  /* A side as the judgement is shown it (R3's fields): a claim's text, or a passage with its stated doctype, date and
     role. The context is K3's passage, the one both claims rest on. */
  const sideOf = (s) => (s?.kind === "claim" ? { text: s.claim }
    : { text: text.get(s?.capture_sha) ?? "", doctype: s?.doctype ?? null, date: s?.date ?? null, role: s?.role ?? null });
  const idOf = (p) => pairId(p.key, handleOf(p.a), handleOf(p.b));
  const contextOf = (p) => passage.get(idOf(p)) ?? null;
  return { w, gold, sideOf, contextOf, idOf, read: () => w.c.pairs({ viewer: MACHINE }) };
}

/* The gold-labelled pairs the pairing formed, and a proposal for each from the recorded run R1. */
function proposalsOf(g, read = g.read()) {
  const judge = recordedJudge("R1");
  const formed = read.pairs.filter((p) => g.gold.has(g.idOf(p)));
  const prop = (p) => { const o = judge({ key: p.key, a: g.sideOf(p.a), b: g.sideOf(p.b) });
                        return { key: p.key, a: p.a, b: p.b, label: o?.label, reason: o?.reason }; };
  return { formed, prop, all: formed.map(prop) };
}
const propose = (g, proposals, extra = {}) =>
  g.w.c.propose({ run: RUN, proposals, proposedBy: "class:ai/tok1", viewer: MACHINE, caller: PRINCIPAL, ...extra });

test("R57, R11: an empty record is no rate — the gate refuses NOTHING_COMPARED and carries each key's own empty level (§6 case (a))", () => {
  const w = world();
  const read = w.c.pairs({ viewer: MACHINE });
  const m = measure({ read, gold: new Map(), sideOf: () => ({}), judge: judgeBaseline });
  assert.deepEqual(gate(m), { pass: false, fails: ["NOTHING_COMPARED"] });
  assert.equal(m.empty.case, "a");
  assert.deepEqual(m.empty.levels, { K1: "inquiry", K2: "inquiry", K3: "inquiry", K4: "content", K5: "inquiry", K6: "money_fact" });
  assert.match(m.empty.says, /NOTHING WAS COMPARED/);
});

test("R57: the corpus is floored (26 pairs, at least 6 per key), carries every shape §7 requires, a negative and a conflict on every key, and only R1's labels", () => {
  assert.equal(ALL.length, 26);
  assert.ok(KEYS.every((k) => ALL.filter(([x]) => x === k).length >= 6));
  assert.deepEqual(REQUIRED_SHAPES.filter((s) => !ALL.some(([, e]) => e.shape === s)), []);
  for (const k of KEYS) {
    assert.ok(ALL.some(([x, e]) => x === k && (e.label === "precision" || e.label === "unrelated")), `${k} negative`);
    assert.ok(ALL.some(([x, e]) => x === k && (e.label === "world" || e.label === "record")), `${k} conflict`);
  }
  assert.ok(ALL.every(([, e]) => CONTRADICTION_LABELS.includes(e.label)));
  assert.equal(new Set(ALL.map(([, e]) => e.id)).size, ALL.length);
});

test("R57, R8: the pairing forms every corpus pair by its own key, and nothing the corpus does not label; no key is cut at its bound", () => {
  const g = corpus();
  const read = g.read();
  assert.equal(g.gold.size, ALL.length);
  assert.deepEqual(KEYS.map((k) => read.keys.find((x) => x.key === k).truncated), [false, false, false, false]);
  const m = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: judgeBaseline, context: g.contextOf });
  for (const k of KEYS) {
    assert.deepEqual([m.per[k].compared, m.per[k].missing], [ALL.filter(([x]) => x === k).length, []], k);
    assert.deepEqual(m.per[k].unlabelled, [], k);
  }
  assert.equal(read.pairs.length, ALL.length);
  assert.equal(read.keys.find((x) => x.key === "K5").formed, 0);
  /* a key disabled is a key not compared, and the gate names it */
  const noK2 = { ...read, pairs: read.pairs.filter((p) => p.key !== "K2") };
  assert.ok(gate(measure({ read: noK2, gold: g.gold, sideOf: g.sideOf, judge: judgeBaseline })).fails.includes("KEY_NOT_COMPARED:K2"));
});

test("R57: the lexical baseline passes the gate at the threshold M-118 set (0), over the whole corpus, every pair answered with an R1 label", () => {
  const g = corpus();
  const m = measure({ read: g.read(), gold: g.gold, sideOf: g.sideOf, judge: judgeBaseline, context: g.contextOf });
  assert.equal(THRESHOLD, 0);
  assert.deepEqual(gate(m), { pass: true, fails: [] });
  assert.ok(KEYS.every((k) => m.per[k].absent.length === 0));
  assert.equal(m.all.false_conflicts, 0);
  assert.equal(m.all.compared, ALL.length);
});

test("R57: the gate can fail, by name — always-world fails FALSE_CONFLICT on every key and over all, a silent judgement JUDGEMENT_ABSENT — and a correct one passes", () => {
  const g = corpus();
  const read = g.read();
  const world_ = gate(measure({ read, gold: g.gold, sideOf: g.sideOf, judge: () => ({ label: "world", reason: "armed" }) }));
  assert.equal(world_.pass, false);
  for (const k of [...KEYS, "ALL"]) assert.ok(world_.fails.includes(`FALSE_CONFLICT:${k}`), k);
  const off = gate(measure({ read, gold: g.gold, sideOf: g.sideOf, judge: () => undefined }));
  assert.equal(off.pass, false);
  for (const k of KEYS) assert.ok(off.fails.includes(`JUDGEMENT_ABSENT:${k}`), k);
  /* the over-strictness of the gate itself: every pair given its gold label passes */
  const oracle = gate(measure({ read, gold: g.gold, sideOf: (s, p) => ({ ...g.sideOf(s), __gold: g.gold.get(g.idOf(p))?.label }),
                                judge: (i) => ({ label: i.a.__gold, reason: "oracle" }) }));
  assert.deepEqual(oracle, { pass: true, fails: [] });
  /* what the gate cannot see, asserted: an always-precision judgement passes it with recall 0, so recall is stated beside it */
  const lenient = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: () => ({ label: "precision" }) });
  assert.deepEqual([gate(lenient).pass, lenient.all.recall], [true, 0]);
  /* a rate equal to the threshold passes; one above it fails */
  const one = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: judgeBaseline });
  assert.equal(gate(one, 0).pass, true);
  const planted = measure({ read, gold: g.gold, sideOf: g.sideOf,
                            judge: (i) => (i.a.text === K1[0].a || i.b.text === K1[0].a ? { label: "world", reason: "planted" } : judgeBaseline(i)) });
  assert.deepEqual([planted.per.K1.false_conflicts, gate(planted).fails], [1, ["FALSE_CONFLICT:K1", "FALSE_CONFLICT:ALL"]]);
});

test("R57, R1, R2: the prompt measured is the prompt shipped, and the labels scored are R1's, in its order", () => {
  assert.equal(sha(JUDGEMENT_PROMPT), JUDGEMENT_PROMPT_SHA256);
  assert.equal(JUDGEMENT_PROMPT_SHA256, PROMPT_SHA256);
  assert.deepEqual([...CONTRADICTION_LABELS], LABELS);
});

test("R57, R4: the judgement's input carries every formed pair, numbered, K3's passage as context, and no gold label or fixture id", () => {
  const g = corpus();
  const formed = g.read().pairs.filter((p) => g.gold.has(g.idOf(p)))
    .map((p) => ({ key: p.key, context: g.contextOf(p), a: g.sideOf(p.a), b: g.sideOf(p.b) }));
  const rendered = renderJudgementInput(formed);
  assert.equal(formed.length, ALL.length);
  assert.equal((rendered.match(/^PAIR \d+ · key K\d$/gm) || []).length, ALL.length);
  assert.equal((rendered.match(/^ {2}context \(the source passage both claims rest on\): /gm) || []).length, K3.length);
  assert.ok(rendered.startsWith(JUDGEMENT_PROMPT));
  assert.equal([...g.gold.values()].some((x) => rendered.includes(x.id) || rendered.includes(x.shape)), false);
  /* the recording answers exactly the pairs the pairing forms: one recorded row per formed pair, by its text */
  assert.equal(ANSWERS.length, ALL.length);
  const judge = recordedJudge("R1");
  assert.ok(formed.every((p) => judge(p) !== undefined));
});

test("R57: each recorded run of the machine judgement passes the gate, every pair answered, and its recall is stated and beats the lexical baseline's", () => {
  const g = corpus();
  const read = g.read();
  const base = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: judgeBaseline, context: g.contextOf }).all;
  assert.deepEqual(RUNS.map((r) => r.id), ["R1", "R2", "R3"]);
  for (const r of RUNS) {
    const m = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: recordedJudge(r.id), context: g.contextOf });
    assert.deepEqual(gate(m), { pass: true, fails: [] }, r.id);
    assert.equal(m.all.false_conflicts, 0, r.id);
    assert.equal(m.all.positives, base.positives, r.id);
    assert.ok(m.all.recall !== null && m.all.correct > base.correct, `${r.id}: recall ${m.all.correct}/${m.all.positives} against ${base.correct}`);
  }
  /* a recording answers only the text it was made over: a changed side leaves its pair unanswered, and the gate says so */
  const moved = (i) => recordedJudge("R1")({ ...i, a: { ...i.a, text: `${i.a.text} ` } });
  assert.ok(gate(measure({ read, gold: g.gold, sideOf: g.sideOf, judge: moved })).fails.includes("JUDGEMENT_ABSENT:K1"));
  /* an abstaining judgement passes the gate and only recall sees it */
  const abstain = measure({ read, gold: g.gold, sideOf: g.sideOf, judge: () => ({ label: "precision", reason: "abstain" }) });
  assert.deepEqual([gate(abstain).pass, abstain.all.correct > base.correct], [true, false]);
});

test("R13, R15, R16: the recorded judgement enters through propose as one proposed machine row per formed pair, each naming both referents at their versions, the key, the run, the label and its reason", () => {
  const g = corpus();
  const { all } = proposalsOf(g);
  const r = propose(g, all, { at: "2026-09-23T01:00:00Z" });
  assert.deepEqual([r.ok, r.proposed, r.written, r.unchanged], [true, ALL.length, ALL.length, 0]);
  for (const c of r.candidates) {
    assert.equal(c.new, true);
    assert.ok(KEYS.includes(c.key));
    for (const f of ["a_ref", "a_version", "b_ref", "b_version", "a_kind", "b_kind"]) assert.ok(c[f], f);
    assert.deepEqual([c.run, c.state, c.origin, c.proposed_by], [RUN, "proposed", "machine", "class:ai/tok1"]);
    assert.ok(LABELS.includes(c.label) && typeof c.reason === "string" && c.reason.length > 0);
    assert.match(c.a_version, /^[0-9a-f]{64}$/);
    assert.match(c.b_version, /^[0-9a-f]{64}$/);
  }
  /* the labels written are the judgement's, pair for pair: 8 conflicts proposed, 18 not (the re-measured run, T51) */
  assert.equal(r.candidates.filter((c) => c.label === "world" || c.label === "record").length, 8);
  assert.match(r.says, /never a finding/);
});

test("R14, R15: a claim side is versioned by its text's digest, a passage by its capture; a re-run writes nothing; a different label over the same referents is no new candidate", () => {
  const g = corpus();
  const { all } = proposalsOf(g);
  const first = propose(g, all);
  for (const c of first.candidates) for (const s of ["a", "b"]) {
    const side = JSON.parse(c[`${s}_side`]);
    assert.equal(c[`${s}_version`], side.kind === "claim" ? sha(side.claim) : side.capture_sha);
  }
  const again = propose(g, all);
  assert.deepEqual([again.ok, again.written, again.unchanged, again.candidates.every((c) => c.new === false)],
                   [true, 0, ALL.length, true]);
  const flipped = propose(g, [{ ...all[0], label: "undetermined", reason: "a later run said otherwise" }]);
  assert.deepEqual([flipped.written, flipped.candidates[0].label, flipped.candidates[0].reason],
                   [0, first.candidates[0].label, first.candidates[0].reason]);
});

test("R14, R13: a changed side is a new candidate and the old stays; a proposal over text the record does not hold is C-93.7", () => {
  const g = corpus();
  const { all, formed } = proposalsOf(g);
  const first = propose(g, all);
  const e = K2[0];
  const inq = `INQ-2026-0071-${e.id}-a`;
  g.w.version(inq, "reading a2", { claim: `${e.a} Restated.` });
  const moved = g.read().pairs.filter((p) => p.key === "K2" && [p.a, p.b].some((x) => x.inquiry === inq && x.version === "reading a2"));
  assert.equal(moved.length, 1);
  const changed = propose(g, moved.map((p) => ({ key: p.key, a: p.a, b: p.b, label: "record", reason: "restated claim, judged again" })));
  const before = new Set(first.candidates.map((c) => c.candidate));
  assert.deepEqual([changed.ok, changed.written], [true, 1]);
  assert.ok(changed.candidates.every((c) => !before.has(c.candidate)));
  assert.deepEqual([propose(g, all).written, propose(g, all).unchanged], [0, ALL.length]);
  const k2 = formed.find((p) => p.key === "K2");
  const forged = { ...all[formed.indexOf(k2)], a: { ...k2.a, claim: `${k2.a.claim} (not what the record holds)` } };
  const stale = propose(g, [forged]);
  assert.deepEqual([stale.ok, stale.code, stale.check], [false, "CANDIDATE_PAIR_NOT_FORMED", "C-93.7"]);
});

test("R13: over the corpus, each refusal by its C-93 name with its translation, before anything is written, a bad proposal anywhere in a batch writing none of it", () => {
  const g = corpus();
  g.w.runs.set("RUN-ended", { status: "ended", principal: PRINCIPAL });
  const { all } = proposalsOf(g);
  const one = all[1];
  const count = () => g.w.count("contradiction_candidates");
  const cases = [
    ["no proposer stamped", { proposedBy: "" }, [one], "CANDIDATE_NO_PROPOSER"],
    ["no run named", { run: "RUN-nope" }, [one], "CANDIDATE_NO_RUN"],
    ["a caller who does not hold the run", { caller: "member:ira147" }, [one], "AI_RUN_NOT_PRINCIPAL"],
    ["an ended run", { run: "RUN-ended" }, [one], "CANDIDATE_RUN_NOT_RUNNING"],
    ["no proposals", {}, [], "CANDIDATE_NO_PROPOSALS"],
    ["a sixth label", {}, [{ ...one, label: "contradiction" }], "CANDIDATE_LABEL_UNKNOWN"],
    ["no reason", {}, [{ ...one, reason: "  " }], "CANDIDATE_NO_REASON"],
    ["an invented pair", {}, [{ ...one, key: one.key === "K1" ? "K4" : "K1" }], "CANDIDATE_PAIR_NOT_FORMED"],
    ["one bad proposal in a batch", {}, [{ ...all[2], reason: "fresh" }, { ...one, label: "nope" }], "CANDIDATE_LABEL_UNKNOWN"],
  ];
  for (const [what, extra, proposals, code] of cases) {
    const r = propose(g, proposals, extra);
    assert.deepEqual([r.ok, r.code], [false, code], what);
    if (code === "AI_RUN_NOT_PRINCIPAL") assert.equal(r.check, "C-22.12");
    else {
      assert.equal(r.check, CONTRADICTION_CANDIDATE_CHECKS[code].check, what);
      assert.equal(r.translation, CONTRADICTION_CANDIDATE_CHECKS[code].translation, what);
      assert.ok(r.translation.length > 60, what);
    }
    assert.equal(count(), 0, what);
  }
  /* and the same corpus proposes cleanly once the refusals are past */
  assert.equal(propose(g, all, { viewer: MEMBER }).written, ALL.length);
});
