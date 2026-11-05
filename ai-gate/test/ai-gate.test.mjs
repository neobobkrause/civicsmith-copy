/* ai-gate — its requirements, tested at its interface (`src/index.mjs`). Each test names its requirement id in its
 * title. Keys are generated per run, for the test only: no key is held or committed. Ids not met are named in
 * `unmet.test.mjs` as test.todo (K208). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

import * as G from "../src/index.mjs";
import { signSshsig, signerPublicLine } from "../../bio-plane/scripts/sign-sshsig.mjs";
import { NS_RELEASE_NOTICE, NS_AI_CATALOGUE, NS_AI_ADVISORY, NS_AI_RUN, NS_RELEASE, NS_RATIFY, NS_FLEET, NS_NOTICE,
  NS_DOCKET } from "../../bio-plane/src/sshsig.mjs";
import { CIVICSMITH_TEST_SET, GATE_PARTS, checkGateRecord } from "../../bio-plane/src/run-rules/index.mjs";
import { ADVISORY_REASONS } from "../../bio-plane/src/ai-catalogue/lifecycle.mjs";
import { canonicalJson } from "../../bio-plane/src/record-grammar/index.mjs";

const SRC = new URL("../src/", import.meta.url);
const srcText = (f) => readFileSync(new URL(f, SRC), "utf8");
const te = new TextEncoder();
const td = new TextDecoder();

/* A throwaway test signing key, made for this run only. */
const envelope = () => `BIOKEY-RAW1.test.${randomBytes(32).toString("base64")}`;
const signDoc = (env, doc, ns = G.NS_GATE_SUITE) => ({ doc, signature: signSshsig(env, G.suiteStatement(doc), ns) });
const clone = (v) => structuredClone(v);

const ENTRY = Object.freeze({ entry_id: "test-entry", model: "m-1", host: "api.example.test",
  capabilities: { tools: true, schema_output: true, image_input: true, streaming: true, parallel_tools: true, caching: false } });
const VERSIONS = G.suiteVersions({ image: "sha256:" + "a".repeat(64) });
const SEED = "seed-one";
const NONCE = "n".repeat(32);

/* A table with a floor for every (group, part) that GROUP_NEEDS marks needed. */
const floors = (floor = 0.5, compares = "rate") => ({ kind: "thresholds", version: "thresholds-test", floors: Object.fromEntries(
  Object.entries(G.GROUP_NEEDS).flatMap(([p, row]) => Object.entries(row).filter(([, v]) => v === "needed")
    .map(([g]) => [`${g}:${p}`, { floor, compares }]))) });

/* Outcomes for every item of a T2 plan of `parts`: `fail(group, part)` decides which fail. */
function outcomesFor(parts, fail = () => false) {
  const plan = G.planRun({ entry: ENTRY, tiers: ["T0", "T2"], parts, nonce: NONCE, selection_seed: SEED, bank: G.PUBLIC_BANK, suiteVersions: VERSIONS });
  return plan.tiers.flatMap((t) => t.items).flatMap(({ item_id }) => {
    const it = G.itemById(G.PUBLIC_BANK, item_id);
    return it.parts.filter((p) => parts.includes(p)).map((part) => ({ group: it.group, part,
      outcome: it.group === "G8" ? null : fail(it.group, part) ? "fail" : "pass" }));
  });
}

/* ================================================================== the suite and its versions */

test("R1: four string versions; a good signed bank loads; another namespace, a changed byte and no signature are refused with distinct codes", async () => {
  const v = G.suiteVersions();
  assert.deepEqual(Object.keys(v).sort(), ["bank", "image", "scorer", "thresholds"]);
  for (const k of Object.keys(v)) assert.equal(typeof v[k], "string");
  for (const ns of [NS_RELEASE_NOTICE, NS_AI_CATALOGUE, NS_AI_ADVISORY, NS_AI_RUN, NS_RELEASE, NS_RATIFY, NS_FLEET, NS_NOTICE, NS_DOCKET])
    assert.notEqual(G.NS_GATE_SUITE, ns);
  const env = envelope(), keys = [signerPublicLine(env, "gate-test")];
  const good = await G.loadSuite(signDoc(env, clone(G.PUBLIC_BANK)), keys);
  assert.equal(good.ok, true);
  assert.equal(good.bank.version, G.PUBLIC_BANK.version);
  const wrongNs = await G.loadSuite(signDoc(env, clone(G.PUBLIC_BANK), NS_RELEASE_NOTICE), keys);
  const signed = signDoc(env, clone(G.PUBLIC_BANK));
  const altered = await G.loadSuite({ ...signed, doc: { ...signed.doc, version: signed.doc.version + "x" } }, keys);
  const unsigned = await G.loadSuite({ doc: clone(G.PUBLIC_BANK) }, keys);
  const codes = [wrongNs, altered, unsigned].map((r) => (assert.equal(r.ok, false), r.code));
  assert.equal(new Set(codes).size, 3);
  /* a threshold table loads the same way, and every record and bundle names all four versions */
  const t = await G.loadSuite(signDoc(env, floors()), keys);
  assert.equal(t.ok, true);
  assert.equal(G.suiteVersions({ thresholds: t.thresholds }).thresholds, "thresholds-test");
});

test("R1 control, R39: a new bank version leaves a stored verdict record unchanged", () => {
  const rec = G.gateRecord({ entry_id: "e", part: "ask", verdict: "not_yet_rated", suiteVersions: VERSIONS, tier: "T2",
    run_ref: "run-1", grade: "REPRODUCED", source: "civicsmith", at: "2026-11-01T00:00:00Z" }).record;
  const before = canonicalJson(rec);
  const next = { ...clone(G.PUBLIC_BANK), version: "bank-2" };
  G.selectItems(next, SEED, "T2", ["ask"]);
  assert.equal(canonicalJson(rec), before);
  assert.deepEqual(G.testedOn(rec, "bank-2"), { tested_on: G.PUBLIC_BANK.version });
  assert.equal(G.testedOn(rec, G.PUBLIC_BANK.version), null);
});

test("R2: publicBank carries no key of the private part; the private part carries them for every answer-bound item", () => {
  const pub = G.publicBank(G.PUBLIC_BANK);
  for (const it of pub.items) for (const k of ["answer", "expected", "states"]) assert.ok(!(k in it), `${it.id} has ${k}`);
  const priv = { ...clone(G.PUBLIC_BANK), items: G.PUBLIC_BANK.items.map((i) => (i.answer_bound ? { ...i, expected: { state: "x" } } : { ...i })) };
  const stripped = G.publicBank(priv);
  for (const it of stripped.items) assert.equal(G.hasPrivate(it), false);
  for (const it of priv.items.filter((i) => i.answer_bound)) assert.equal(G.hasPrivate(it), true);
  assert.ok(priv.items.some((i) => i.answer_bound));
});

test("R3: an item without the synthetic mark is refused by name; the lint finds a team-record id or an address; the shipped bank is clean", async () => {
  const env = envelope(), keys = [signerPublicLine(env)];
  const bank = clone(G.PUBLIC_BANK);
  bank.items[3] = { ...bank.items[3], synthetic: false };
  const r = await G.loadSuite(signDoc(env, bank), keys);
  assert.equal(r.code, "SUITE_ITEM_NOT_SYNTHETIC");
  assert.equal(r.item, bank.items[3].id);
  assert.notEqual(G.lintFixture({ text: "see INFO-2026-0042" }), null);
  assert.notEqual(G.lintFixture({ text: "write to someone@example.org" }), null);
  for (const it of G.PUBLIC_BANK.items) { assert.equal(it.synthetic, true); assert.equal(G.lintFixture(it.fixture), null); }
  const clean = clone(G.PUBLIC_BANK);
  assert.equal((await G.loadSuite(signDoc(env, clean), keys)).ok, true);
});

test("R4: ten groups; every item's group is one; every scorer named is a callable; a missing scorer fails the load", async () => {
  assert.deepEqual(G.GROUP_IDS, ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"]);
  for (const it of G.PUBLIC_BANK.items) assert.ok(G.GROUP_IDS.includes(it.group));
  for (const [g, def] of Object.entries(G.GROUPS)) {
    assert.ok(["plane", "suite-only"].includes(def.scorer.kind), g);
    if (def.scorer.kind === "plane") { assert.ok(def.scorer.module); assert.match(def.scorer.r, /^R\d+$/); }
    assert.equal(typeof G.SCORERS[def.scorer.fn], "function", g);
  }
  const env = envelope(), keys = [signerPublicLine(env)];
  const bank = clone(G.PUBLIC_BANK);
  bank.groups.G1 = "scoreNothingAtAll";
  const r = await G.loadSuite(signDoc(env, bank), keys);
  assert.equal(r.code, "SUITE_SCORER_MISSING");
  assert.equal(r.group, "G1");
});

test("R5: G9 needed for ask, draft, read, run and account, not for transcribe; every part has a row; a part without one answers ok: false", () => {
  for (const p of ["ask", "draft", "read", "run", "account"]) assert.equal(G.GROUP_NEEDS[p].G9, "needed", p);
  assert.notEqual(G.GROUP_NEEDS.transcribe.G9, "needed");
  for (const p of GATE_PARTS) { assert.equal(G.needsOf(p).ok, true); assert.ok(Array.isArray(G.rolesOf(p))); }
  assert.deepEqual(G.needsOf("explore"), { ok: false, code: "GATE_PART_UNKNOWN", part: "explore" });
  const noRow = { ...G.GROUP_NEEDS }; delete noRow.ask;
  assert.equal(G.partVerdict({ entry: ENTRY, part: "ask", figures: {}, thresholds: floors(), needs: noRow }).ok, false);
  assert.equal(G.PARTIAL_COVERAGE.run, true);
  assert.equal(G.partVerdict({ entry: ENTRY, part: "run", figures: {}, thresholds: null }).partial_coverage, true);
  assert.equal(G.partVerdict({ entry: ENTRY, part: "ask", figures: {}, thresholds: null }).partial_coverage, false);
});

test("R6: selectItems is a function of bank version, seed, tier and parts alone; a tier's list lies in the next tier's pool", () => {
  const a = G.selectItems(G.PUBLIC_BANK, SEED, "T1", ["ask", "run"]);
  assert.deepEqual(a, G.selectItems(G.PUBLIC_BANK, SEED, "T1", ["ask", "run"]));
  assert.notDeepEqual(G.selectItems(G.PUBLIC_BANK, "seed-two", "T1", ["ask", "run"]), a);
  const pool2 = G.tierPool(G.PUBLIC_BANK, "T2", ["ask", "run"]);
  for (const id of a) assert.ok(pool2.includes(id), id);
  /* control: nothing else changes it — other bank members, extra arguments */
  const other = { ...clone(G.PUBLIC_BANK), groups: {}, group_needs: {}, retired_items: [{ id: "x" }] };
  assert.deepEqual(G.selectItems(other, SEED, "T1", ["ask", "run"], "extra", { more: 1 }), a);
  assert.notDeepEqual(G.selectItems({ ...clone(G.PUBLIC_BANK), version: "bank-9" }, SEED, "T1", ["ask", "run"]), a);
});

test("R7: an item used ROTATE_AFTER_USES times is retired, never selected, and still re-scores; one below stays", () => {
  const limit = G.GATE_PARAMS.ROTATE_AFTER_USES;
  const r = G.rotate(G.PUBLIC_BANK, { "g1-tool-args-run": limit, "g2-report-shape-run": limit - 1 }, { ROTATE_AFTER_USES: limit });
  const t2 = G.selectItems(r, SEED, "T2", ["run"]);
  assert.ok(!t2.includes("g1-tool-args-run"));
  assert.ok(t2.includes("g2-report-shape-run"));
  assert.ok(r.retired_items.some((i) => i.id === "g1-tool-args-run"));
  const it = G.itemById(r, "g1-tool-args-run");
  const s = G.scoreItem({ item: it, exchange: { calls: [] }, stub_log: [] });
  assert.equal(s.ok, true);
  assert.equal(s.outcome, "pass");
});

/* ================================================================== running: the plan */

test("R10: planRun fixes the items, order, repeats and sampling; equal inputs give an identical plan; an early end records its reason", () => {
  const args = { entry: { ...ENTRY, sampling: { temperature: 0.2, effort: "low", max_output: 2000 }, capabilities: { ...ENTRY.capabilities, seed: true } },
    tiers: ["T0", "T1", "T2"], parts: ["ask"], nonce: NONCE, selection_seed: SEED, bank: G.PUBLIC_BANK, suiteVersions: VERSIONS };
  const p = G.planRun(args);
  assert.equal(p.ok, true);
  assert.deepEqual(G.planRun(args), p);
  assert.deepEqual(p.tiers.map((t) => t.tier), ["T0", "T1", "T2"]);
  assert.equal(p.sampling.temperature, 0.2);
  assert.equal(typeof p.sampling.seed, "number");
  assert.equal(G.planRun({ ...args, entry: ENTRY }).sampling.seed, null);
  assert.deepEqual(G.endedEarly("ceiling_spend", "T2"), { ended_early: true, reason: "ceiling_spend", at_tier: "T2" });
  assert.equal(G.endedEarly("bored", "T2").ok, false);
  /* control: the plan is fixed; nothing adds an item to it */
  assert.throws(() => p.tiers[2].items.push({ item_id: "x" }), TypeError);
  assert.equal(G.planRun({ ...args, tiers: ["T3"] }).code, "GATE_TIER_NOT_A_RUN");
});

test("R11: every repeat has its own session key; an item with repeats 1 has one", () => {
  const p = G.planRun({ entry: ENTRY, tiers: ["T1", "T2"], parts: ["ask", "run"], nonce: NONCE, selection_seed: SEED, bank: G.PUBLIC_BANK, suiteVersions: VERSIONS });
  const keys = p.tiers.flatMap((t) => t.items.flatMap((i) => i.sessions));
  assert.equal(new Set(keys).size, keys.length);
  for (const i of p.tiers[0].items) { assert.equal(i.repeats, G.GATE_PARAMS.REPEATS.T1); assert.equal(i.sessions.length, i.repeats); }
  assert.deepEqual(Object.keys(G.GATE_PARAMS.REPEATS).sort(), ["T1", "T2", "canary", "consistency"]);
});

test("R12: each BR26 class left after retries yields its outcome; identity is counted apart; a malformed answer is a fail", () => {
  const item = G.itemById(G.PUBLIC_BANK, "g1-tool-args-ask");
  const expect = { rate_limit: "not_run", spend_cap: "not_run", overload: "not_run", timeout: "not_run", auth_revoked: "not_run",
    ceiling: "not_run", content_refusal: "fail", malformed: "fail", privacy_pin: "identity_mismatch", unsupported_control: "not_applicable" };
  for (const [cls, out] of Object.entries(expect))
    assert.equal(G.scoreItem({ item, exchange: { error_class: cls, calls: [] }, stub_log: [] }).outcome, out, cls);
  const figs = G.groupFigures([{ group: "G1", part: "ask", outcome: "pass" }, { group: "G1", part: "ask", outcome: "not_run" }]);
  assert.equal(figs.ask.G1.n, 1);
  assert.equal(figs.ask.G1.not_run, 1);
  assert.notEqual(G.classifyOutcome("malformed"), "not_run");
});

test("R13: tiers run in order; a T0 stop allows no T1; a completed T1 allows T2; T3 refused for an entry that passed no part", () => {
  assert.equal(G.nextTier({ tier: "T0", completed: true, early_stop: { reason: "early_stop_identity" } }).ok, false);
  assert.equal(G.nextTier({ tier: "T0", completed: false }).ok, false);
  assert.deepEqual(G.nextTier({ tier: "T1", completed: true }), { ok: true, tier: "T2" });
  assert.equal(G.nextTier({ tier: "T2", completed: true, verdicts: { ask: "not_suitable" } }).code, "GATE_T3_NOT_ADMITTED");
  assert.deepEqual(G.nextTier({ tier: "T2", completed: true, verdicts: { ask: "passes" } }), { ok: true, tier: "T3" });
});

test("R15: the T1 plan has repeats REPEATS.T1 for every item and one item per group and part; T2 has REPEATS.T2", () => {
  const p = G.planRun({ entry: ENTRY, tiers: ["T1", "T2"], parts: ["ask"], nonce: NONCE, selection_seed: SEED, bank: G.PUBLIC_BANK, suiteVersions: VERSIONS });
  const [t1, t2] = p.tiers;
  for (const i of t1.items) assert.equal(i.repeats, G.GATE_PARAMS.REPEATS.T1);
  const groups = t1.items.map((i) => i.group);
  assert.equal(new Set(groups).size, groups.length);
  assert.ok(!t1.items.some((i) => G.itemById(G.PUBLIC_BANK, i.item_id).content_kind === "long_context"));
  for (const i of t2.items.filter((x) => x.group !== "G6")) assert.equal(i.repeats, G.GATE_PARAMS.REPEATS.T2);
  for (const i of t2.items.filter((x) => x.group === "G6")) assert.equal(i.repeats, G.GATE_PARAMS.REPEATS.consistency);
});

test("R16: a T2 plan for ask holds no transcription item; one for transcribe does", () => {
  const items = (parts) => G.planRun({ entry: ENTRY, tiers: ["T2"], parts, nonce: NONCE, selection_seed: SEED, bank: G.PUBLIC_BANK, suiteVersions: VERSIONS })
    .tiers[0].items.map((i) => G.itemById(G.PUBLIC_BANK, i.item_id));
  assert.ok(!items(["ask"]).some((i) => i.content_kind === "page_image"));
  assert.ok(items(["transcribe"]).some((i) => i.content_kind === "page_image"));
  assert.ok(items(["ask"]).some((i) => i.content_kind === "long_context"));
  assert.ok(!items(["draft"]).some((i) => i.group === "G5"));
});

test("R17: an entry with only not_suitable verdicts is refused T3 by name; one part passed admits it", () => {
  assert.equal(G.admitT3([{ part: "ask", verdict: "not_suitable" }, { part: "run", verdict: "not_yet_rated" }]).code, "GATE_T3_NOT_ADMITTED");
  assert.equal(G.admitT3([{ part: "ask", verdict: "not_suitable" }, { part: "run", verdict: "passes_with_limits" }]).ok, true);
});

test("R18: a wrong identity, an unhonoured pin or no tools stops at T0; failing every G2 item stops G5 of that part; one G2 pass does not", () => {
  assert.deepEqual(G.earlyStops({ t0: { identity_ok: false, pin_ok: true, tools_ok: true } }).map((s) => s.reason), ["early_stop_identity"]);
  assert.deepEqual(G.earlyStops({ t0: { identity_ok: true, pin_ok: false, tools_ok: true } }).map((s) => s.reason), ["early_stop_pin"]);
  assert.deepEqual(G.earlyStops({ t0: { identity_ok: true, pin_ok: true, tools_ok: false } }).map((s) => s.reason), ["early_stop_no_tools"]);
  const allFail = [{ group: "G2", part: "read", outcome: "fail" }, { group: "G2", part: "read", outcome: "fail" }];
  const s = G.earlyStops({ outcomes: allFail });
  assert.deepEqual(s.map((x) => [x.group, x.part]), [["G5", "read"]]);
  assert.deepEqual(G.earlyStops({ outcomes: [...allFail, { group: "G2", part: "read", outcome: "pass" }] }), []);
});

test("R20: an address is refused on the cloudflare route and accepted on machine; a public DNS name is accepted on both", () => {
  const d = (host, route) => ({ provider: "p", host, model: "m", plan: "pl", scope_declared: "team", route });
  assert.equal(G.checkDeclared(d("10.0.0.5", "cloudflare")).ok, false);
  assert.equal(G.checkDeclared(d("10.0.0.5", "machine")).ok, true);
  assert.equal(G.checkDeclared(d("api.provider.example", "cloudflare")).ok, true);
  assert.equal(G.checkDeclared(d("api.provider.example", "machine")).ok, true);
  assert.equal(G.checkDeclared(d("*.provider.example", "cloudflare")).code, "GATE_DECLARED_HOST");
  assert.equal(G.checkDeclared(d("http://api.provider.example", "cloudflare")).code, "GATE_DECLARED_HOST");
  assert.equal(G.checkDeclared(d("ai-issuer.believeinoakland.workers.dev", "cloudflare")).reason, "issuer");
  assert.equal(G.checkDeclared(d("model.internal", "team")).reason, "private_name");
  assert.equal(G.checkDeclared(d("model.internal", "machine")).ok, true);
});

/* ================================================================== scoring */

test("R25: a quote differing only by a curly quote and a double space passes; a changed word fails", () => {
  const src = "The board said “no new levy”  this year — final.";
  assert.equal(G.normaliseQuote("The board said \"no new levy\" this year - final."), G.normaliseQuote(src));
  assert.notEqual(G.normaliseQuote("The board said \"a new levy\" this year - final."), G.normaliseQuote(src));
  assert.equal(G.normaliseQuote("Case Kept"), "Case Kept");
  assert.ok(!srcText("score.mjs").includes("checkSentences"));
  const item = { ...G.itemById(G.PUBLIC_BANK, "g3-quote-ask"), fixture: { synthetic: true, passages: { p1: src } } };
  const ex = (text) => ({ output: { quotes: [{ text, passage: "p1" }] } });
  const priv = { expected: { planted_tokens: [] } };
  assert.equal(G.scoreItem({ item, exchange: ex("said \"no new levy\" this year"), stub_log: [], privateItem: priv }).outcome, "pass");
  assert.equal(G.scoreItem({ item, exchange: ex("said \"a new levy\" this year"), stub_log: [], privateItem: priv }).outcome, "fail");
});

test("R31: scoreItem is pure (byte-identical twice); a v2 scorer re-scores stored exchanges with no model call; a different exchange differs", () => {
  const item = G.itemById(G.PUBLIC_BANK, "g9-civic-ask");
  const exchange = { stop_reason: "end_turn", completed: true, calls: [{ tool: "read", args: {}, result: {} }] };
  const priv = { expected: {} };
  const a = G.scoreItem({ item, exchange, stub_log: [], privateItem: priv });
  assert.equal(canonicalJson(G.scoreItem({ item, exchange, stub_log: [], privateItem: priv })), canonicalJson(a));
  let called = 0;
  const v2 = { ...G.SCORERS, scoreCivicWork: () => { called++; return [{ check: "v2", ok: false, answer_free: true }]; } };
  const b = G.scoreItem({ item, exchange, stub_log: [], privateItem: priv, scorers: v2, scorerVersion: "scorer-2" });
  assert.equal(called, 1);
  assert.equal(b.scorer, "scorer-2");
  assert.equal(b.outcome, "fail");
  for (const f of readdirSync(SRC)) assert.ok(!/agent-model/.test(srcText(f).split("\n").filter((l) => l.startsWith("import")).join("\n")), f);
  assert.notEqual(canonicalJson(G.scoreItem({ item, exchange: { ...exchange, stop_reason: "refusal" }, stub_log: [], privateItem: priv })), canonicalJson(a));
});

test("R32: scoreAnswerFree runs with no private bank and is labelled preliminary; an answer-bound check without it answers ok: false", () => {
  const item = G.itemById(G.PUBLIC_BANK, "g1-tool-args-ask");
  const pre = G.scoreAnswerFree(item, { calls: [{ tool: "x", args: {}, result: {} }] }, [{ op: "read", allowed: true }]);
  assert.equal(pre.preliminary, true);
  assert.equal(pre.outcome, "pass");
  assert.ok(pre.checks.every((c) => c.answer_free));
  const bound = G.itemById(G.PUBLIC_BANK, "g7-absence-ask");
  assert.equal(bound.answer_bound, true);
  assert.deepEqual(G.scoreItem({ item: bound, exchange: { output: { state: "LOOKED_ABSENT" } }, stub_log: [] }),
    { ok: false, code: "GATE_PRIVATE_BANK_NEEDED", item: bound.id });
  assert.equal(G.scoreItem({ item: bound, exchange: { output: { state: "LOOKED_ABSENT" } }, stub_log: [],
    privateItem: { expected: { state: "LOOKED_ABSENT" } } }).outcome, "pass");
});

/* ================================================================== figures and verdicts */

test("R33: groupFigures gives counts and Wilson intervals at CI_LEVEL; not_run items are outside n", () => {
  const o = (k, n, extra = 0) => [...Array(k).fill("pass"), ...Array(n - k).fill("fail"), ...Array(extra).fill("not_run")]
    .map((outcome) => ({ group: "G1", part: "ask", outcome }));
  const f0 = G.groupFigures(o(0, 5)).ask.G1, f5 = G.groupFigures(o(5, 5, 2)).ask.G1;
  assert.deepEqual([f0.k, f0.n], [0, 5]);
  assert.equal(f0.wilson_low, 0);
  assert.ok(Math.abs(f0.wilson_high - 0.43448) < 1e-4);
  assert.deepEqual([f5.k, f5.n, f5.not_run], [5, 5, 2]);
  assert.ok(Math.abs(f5.wilson_low - 0.56552) < 1e-4);
  assert.equal(f5.wilson_high, 1);
  assert.equal(G.GATE_PARAMS.CI_LEVEL, 95);
});

test("R34: the shipped table is empty and with it every part is not_yet_rated with its figures; a table with floors gives a verdict", () => {
  assert.deepEqual(G.GATE_THRESHOLDS.floors, {});
  const figures = G.groupFigures(outcomesFor([...GATE_PARTS]));
  for (const v of G.verdictsFor(ENTRY, { figures, thresholds: G.GATE_THRESHOLDS })) {
    assert.equal(v.verdict, "not_yet_rated", v.part);
    assert.ok(Object.keys(v.figures).length > 0);
  }
  assert.ok(G.verdictsFor(ENTRY, { figures, thresholds: floors() }).every((v) => v.verdict === "passes"));
  /* no number of Bob's in code: the verdict file holds no floor value */
  assert.ok(!/floor:\s*\d/.test(srcText("verdict.mjs")));
});

test("R35: failing only G4 gives not_suitable for ask and passes for transcribe; passing everything gives passes; a verdict per part", () => {
  const figures = G.groupFigures(outcomesFor(["ask", "transcribe"], (g) => g === "G4"));
  assert.equal(G.partVerdict({ entry: ENTRY, part: "ask", figures, thresholds: floors() }).verdict, "not_suitable");
  assert.equal(G.partVerdict({ entry: ENTRY, part: "transcribe", figures, thresholds: floors() }).verdict, "passes");
  const all = G.groupFigures(outcomesFor(["ask", "transcribe"]));
  assert.equal(G.partVerdict({ entry: ENTRY, part: "ask", figures: all, thresholds: floors() }).verdict, "passes");
  assert.deepEqual(G.verdictsFor(ENTRY, { figures: all, thresholds: floors() }).map((v) => v.part), [...GATE_PARTS]);
  /* the `lower` comparison reads the interval's low bound */
  assert.equal(G.partVerdict({ entry: ENTRY, part: "ask", figures: all, thresholds: floors(0.6, "lower") }).verdict, "not_suitable");
});

test("R36: an entry without image input has no_image_input for read and none for run; a full entry has none", () => {
  const noImage = { ...ENTRY, capabilities: { ...ENTRY.capabilities, image_input: false } };
  assert.deepEqual(G.deriveLimits(noImage, "read").map((l) => l.kind), ["no_image_input"]);
  assert.deepEqual(G.deriveLimits(noImage, "run"), []);
  for (const p of GATE_PARTS) assert.deepEqual(G.deriveLimits(ENTRY, p), []);
  for (const l of G.deriveLimits({ capabilities: { image_input: false, streaming: false, parallel_tools: false, context_window: 200000 } }, "read",
    { context_effective: 64000 })) assert.ok(G.LIMIT_KINDS.includes(l.kind));
  const figures = G.groupFigures(outcomesFor(["read"]));
  assert.equal(G.partVerdict({ entry: noImage, part: "read", figures, thresholds: floors() }).verdict, "passes_with_limits");
});

test("R37: the gate record names entry, part and the four versions and is the shape run-rules reads; without an entry id it is refused", () => {
  const r = G.gateRecord({ entry_id: "e1", part: "ask", verdict: "passes", suiteVersions: VERSIONS, tier: "T2", run_ref: "run-1",
    grade: "REPRODUCED", source: "civicsmith", at: "2026-11-01T00:00:00Z",
    set: { set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version, false_alarm_rate: 0, graded_by: "ai-gate" } });
  assert.equal(r.ok, true);
  assert.equal(r.record.entry_id, "e1");
  assert.equal(r.record.part, "ask");
  assert.deepEqual(r.record.suiteVersions, VERSIONS);
  assert.equal(r.record.set, CIVICSMITH_TEST_SET.id);
  assert.equal(checkGateRecord(r.record), null);
  assert.deepEqual(G.gateRecord({ part: "ask", verdict: "passes", suiteVersions: VERSIONS, tier: "T2", run_ref: "r", grade: "REPRODUCED",
    source: "civicsmith", at: "2026-11-01T00:00:00Z" }), { ok: false, code: "GATE_RECORD_UNFIT", field: "entry_id" });
});

test("R38: a bundle draws on the bank only, Civicsmith's runs on both; a bundle selection holds no matter of the set", () => {
  assert.deepEqual(G.itemSources("bundle").sources, ["synthetic_bank"]);
  assert.deepEqual(G.itemSources("civicsmith").sources, ["civicsmith_set", "synthetic_bank"]);
  const ids = new Set(CIVICSMITH_TEST_SET.matters.map((m) => m.id));
  for (const t of ["T0", "T1", "T2"]) for (const id of G.selectItems(G.PUBLIC_BANK, SEED, t, [...GATE_PARTS])) {
    assert.ok(!ids.has(id));
    assert.equal(G.itemById(G.PUBLIC_BANK, id).synthetic, true);
  }
});

test("R39: a new threshold table re-rates stored figures with no model call; the old record is unchanged", () => {
  const figures = G.groupFigures(outcomesFor(["ask"]));
  const stored = G.gateRecord({ entry_id: "e", part: "ask", verdict: "not_yet_rated", figures: figures.ask, suiteVersions: VERSIONS,
    tier: "T2", run_ref: "r", grade: "REPRODUCED", source: "civicsmith", at: "2026-11-01T00:00:00Z" }).record;
  const before = canonicalJson(stored);
  const rr = G.rerate(figures, floors(), { entry: ENTRY, parts: ["ask"] });
  assert.equal(rr[0].verdict, "passes");
  assert.equal(canonicalJson(stored), before);
  assert.ok(!/\.turn\(|fetch\(/.test(G.rerate.toString()));
});

test("R40: a reading note changes no verdict, record or row; the verdict path takes no note; the note carries its reviewer and date", () => {
  const figures = G.groupFigures(outcomesFor(["ask"]));
  const run = () => {
    const v = G.partVerdict({ entry: ENTRY, part: "ask", figures, thresholds: floors() });
    const rec = G.gateRecord({ entry_id: "e", part: "ask", verdict: v.verdict, figures: v.figures, suiteVersions: VERSIONS, tier: "T2",
      run_ref: "r", grade: "REPRODUCED", source: "civicsmith", at: "2026-11-01T00:00:00Z" });
    const row = G.resultRow({ subject_id: "e", verdicts: [v], grade: "REPRODUCED", suiteVersions: VERSIONS, tested_at: "2026-11-01T00:00:00Z", tested_by: "civicsmith" });
    return canonicalJson([v, rec, row]);
  };
  const a = run();
  const n1 = G.readingNote({ entry_id: "e", part: "ask", rubric_version: "r1", sample_ids: ["s1"], outcome: "reasonable", reviewer: "rev-1", at: "2026-11-02T00:00:00Z" });
  const n2 = G.readingNote({ entry_id: "e", part: "ask", rubric_version: "r1", sample_ids: ["s1"], outcome: "unreasonable", reviewer: "rev-2", at: "2026-11-03T00:00:00Z" });
  assert.equal(run(), a);
  for (const f of [G.partVerdict, G.groupFigures, G.gateRecord, G.verdictsFor, G.resultRow]) assert.ok(!/note/.test(f.toString()), f.name);
  assert.equal(n1.note.reviewer, "rev-1");
  assert.equal(n1.note.at, "2026-11-02T00:00:00Z");
  assert.equal(n1.note.grade, "REPORTED");
  assert.equal(n2.note.words, "gate.note.reasonableness");
});

/* ================================================================== characterization */

const CONDS = { endpoint: "api.example.test", window: { from: "2026-11-01T00:00:00Z", to: "2026-11-02T00:00:00Z" },
  adapter_version: "a1", profile_version: "p1", model_version: "m1", subject: "test-entry", suiteVersions: VERSIONS };

test("R41: a record lacking any condition is refused; a changed adapter version marks it stale; no samples reads OPEN", () => {
  const ok = G.charRecord({ property: "latency", value: 1, method: "CH2", samples: 3, conditions: CONDS, ev: { grade: "REPRODUCED", source: "run-1", date: "2026-11-02" } });
  assert.equal(ok.ok, true);
  for (const c of Object.keys(CONDS)) {
    const cs = { ...CONDS }; delete cs[c];
    assert.equal(G.charRecord({ property: "latency", value: 1, method: "CH2", samples: 3, conditions: cs }).condition, c);
  }
  const cur = { model_version: "m1", profile_version: "p1", adapter_version: "a1", at: "2026-11-03T00:00:00Z" };
  assert.equal(G.isStale(ok.record, cur), false);
  assert.equal(G.isStale(ok.record, { ...cur, adapter_version: "a2" }), true);
  assert.equal(G.isStale(ok.record, { ...cur, at: "2027-03-01T00:00:00Z" }), true);
  assert.equal(G.charRecord({ property: "latency", value: 9, method: "CH2", samples: 0, conditions: CONDS }).record.value, "OPEN");
});

test("R43: too few turns, or all in one window, is OPEN with the shortfall; the full count across days gives a value", () => {
  const min = G.GATE_PARAMS.LATENCY_TURNS_MIN, wins = G.GATE_PARAMS.LATENCY_WINDOWS_MIN;
  const turns = (n, days) => Array.from({ length: n }, (_, i) => ({ ms: 100 + i, streaming: false, region: "r1",
    at: `2026-11-0${1 + (i % days)}T10:00:00Z` }));
  assert.deepEqual(G.latencyFigure(turns(min - 1, wins)).non_streaming, { value: "OPEN", shortfall: { turns: 1, windows: 0 } });
  assert.deepEqual(G.latencyFigure(turns(min, 1)).non_streaming.shortfall, { turns: 0, windows: wins - 1 });
  const v = G.latencyFigure(turns(min, wins)).non_streaming;
  assert.equal(typeof v.value.median_ms, "number");
  assert.ok(v.value.p90_ms >= v.value.median_ms);
  assert.equal(v.windows.length, wins);
});

test("R44: error counts from a fake provider's calls match, each k of n with its interval; a clean run gives zeros with n stated", () => {
  const calls = [{ error_class: "rate_limit" }, { error_class: "rate_limit" }, { error_class: "timeout" }, {}, {}];
  const e = G.errorBehaviour(calls);
  assert.deepEqual([e.rate_limit.k, e.rate_limit.n, e.timeout.k], [2, 5, 1]);
  assert.ok(e.rate_limit.wilson_low > 0 && e.rate_limit.wilson_high < 1);
  const clean = G.errorBehaviour([{}, {}, {}]);
  for (const c of G.ERROR_CLASSES) assert.deepEqual([clean[c].k, clean[c].n], [0, 3]);
});

test("R45: recall to 64K of a stated 200K gives effective 64K and the context_depth limit; a full-window stub gives the stated value", () => {
  const curve = [{ depth: 8000, k: 5, n: 5 }, { depth: 32000, k: 5, n: 5 }, { depth: 64000, k: 5, n: 5 }, { depth: 128000, k: 1, n: 5 }];
  const e = G.effectiveWindow(curve, { floor: 0.8, stated: 200000 });
  assert.equal(e.effective, 64000);
  assert.deepEqual(e.limit, { kind: "context_depth", value: 64000 });
  const full = G.effectiveWindow([...curve.slice(0, 3), { depth: 200000, k: 5, n: 5 }], { floor: 0.8, stated: 200000 });
  assert.equal(full.effective, 200000);
  assert.equal(full.limit, null);
  const none = G.effectiveWindow(curve, { stated: 200000 });
  assert.equal(none.effective, null);
  assert.equal(none.curve.length, 4);
});

test("R47: an uptime value without a period is refused; three labelled sources are accepted side by side", () => {
  const p = { from: "2026-10-01", to: "2026-10-31" };
  assert.equal(G.uptimeEvidence([{ kind: "sla", value: 0.999, source: "https://p.example/sla" }]).field, "period");
  assert.equal(G.uptimeEvidence([{ kind: "sla", value: 0.999, period: p }]).field, "source");
  const r = G.uptimeEvidence([{ kind: "sla", value: 0.999, source: "sla", period: p }, { kind: "status_page", value: 0.998, source: "status", period: p },
    { kind: "canary", value: 1, source: "canary-runs", period: p }]);
  assert.deepEqual(r.evidence.map((x) => x.grade), ["STATED", "REPORTED", "REPRODUCED"]);
});

test("R48: plan scope and privacy are links to the catalogue, never measured; a missing answer reads OPEN", () => {
  let asked = 0;
  const r = G.catalogueLinks("e1", (id, kind) => { asked++; return kind === "privacy" ? { grade: "STATED" } : null; });
  assert.equal(asked, 2);
  assert.equal(r.privacy.grade, "STATED");
  assert.equal(r.plan_scope.grade, "OPEN");
  assert.deepEqual(r.plan_scope.link, { entry_id: "e1", kind: "plan_scope" });
});

/* ================================================================== cost estimate and ceiling */

const COST_BANK = { version: "bank-cost", groups: {}, group_needs: {}, retired_items: [], items: [
  { id: "c1", group: "G1", parts: ["ask"], tiers: ["T2"], token_profile: { input: 1000, output: 100 }, synthetic: true, fixture: { synthetic: true } },
  { id: "c2", group: "G2", parts: ["ask"], tiers: ["T2"], token_profile: { input: 2000, output: 200 }, synthetic: true, fixture: { synthetic: true } },
] };
const PRICE = { unit: "USD", input_per_mtok: 1, output_per_mtok: 10, cached_input_per_mtok: 0.1, date: "2026-11-01", grade: "STATED" };

test("R49: the estimate is hand-computable from token profiles × price × repeats with session start, retries and the claimed cache", () => {
  const entry = { ...ENTRY, session_start: { input: 100, output: 0 }, capabilities: { ...ENTRY.capabilities, caching: true } };
  const base = { entry, tiers: ["T2"], parts: ["ask"], nonce: NONCE, selection_seed: SEED, bank: COST_BANK, suiteVersions: VERSIONS };
  const e = G.estimateRun({ ...base, price: PRICE });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
  near(e.expected, 5 * (2100 + 4100) / 1e6);
  near(e.low, 5 * (2010 + 4010) / 1e6);
  near(e.high, e.expected * (1 + G.GATE_PARAMS.RETRY_ALLOWANCE));
  assert.equal(e.unit, "USD");
  assert.equal(e.basis.price_date, "2026-11-01");
  const lc = G.estimateRun({ ...base, price: { ...PRICE, long_context: { above_tokens: 1500, input_per_mtok: 2, output_per_mtok: 20 } } });
  assert.ok(lc.high > e.high);
  const declared = G.estimateRun({ ...base, entry: null, declared: { provider: "p" }, declaredPrice: PRICE });
  assert.equal(declared.basis.price_from, "declared_by_person");
  const none = G.estimateRun({ ...base, price: null });
  assert.equal(none.unit, null);
  assert.ok(!("expected" in none));
  assert.equal(none.measure.calls, 10);
});

test("R50: usage at the ceiling answers stop; one unit below answers ok; a ceiling under the low estimate is shown with its warning", () => {
  const c = { spend: 10, calls: 100, seconds: 600 };
  assert.equal(G.meter({ spend_reported: 10, calls: 1, seconds: 1 }, c).decision, "stop");
  assert.equal(G.meter({ spend_reported: 9, calls: 1, seconds: 1 }, c).decision, "ok");
  assert.equal(G.meter({ spend_estimated: 10 }, c).reason, "ceiling_spend");
  assert.equal(G.meter({ spend_reported: 1, calls: 100 }, c).reason, "ceiling_calls");
  assert.equal(G.meter({ spend_reported: 1, seconds: 600 }, c).reason, "ceiling_time");
  assert.equal(G.meter({}, { spend: 1 }).code, "GATE_CEILING_REQUIRED");
  assert.deepEqual(G.ceilingCheck({ low: 20 }, c).warnings, ["gate.warn.ceiling_low"]);
  assert.deepEqual(G.ceilingCheck({ low: 5 }, c).warnings, []);
  assert.equal(G.meter({ spend_reported: 1 }, c, { price: PRICE, callHigh: 0.01 }).next_max_output, 1000);
});

test("R51: no consent record without a person's explicit consent; with it the record holds the estimate shown", () => {
  const est = { low: 1, expected: 2, high: 3, unit: "USD" };
  const args = { at: "2026-11-05T00:00:00Z", estimate: est, ceiling: { spend: 3, calls: 10, seconds: 60 }, plan: "p", tiers: ["T1"] };
  assert.equal(G.consentRecord(args).code, "GATE_CONSENT_MISSING");
  assert.equal(G.consentRecord({ ...args, who: { person_id: "p1" } }).code, "GATE_CONSENT_MISSING");
  const r = G.consentRecord({ ...args, who: { person_id: "p1", consented: true } });
  assert.deepEqual(r.record.estimate, est);
  const err = G.estimateError(est, 2.5);
  assert.equal(err.difference, 0.5);
  assert.equal(err.within, true);
});

/* ================================================================== canaries and lifecycle */

const fig = (k, n) => ({ k, n, ...((w) => ({ wilson_low: w.low, wilson_high: w.high }))(G.wilson(k, n)) });

test("R52: the canary is the fixed subset at REPEATS.canary; overlapping intervals are same, a drop below is diverged; lapsed or retest-off refused", () => {
  const ok = G.canaryPlan(ENTRY, { bank: G.PUBLIC_BANK, account_kind: "civicsmith", retestAllowed: true });
  assert.deepEqual(ok.items, G.GATE_PARAMS.CANARY_ITEMS);
  assert.equal(ok.repeats, G.GATE_PARAMS.REPEATS.canary);
  for (const id of ok.items) assert.ok(G.itemById(G.PUBLIC_BANK, id).tiers.some((t) => t === "T1" || t === "T2"));
  assert.equal(G.canaryPlan({ ...ENTRY, state: "lapsed" }, { bank: G.PUBLIC_BANK, account_kind: "civicsmith", retestAllowed: true }).code, "GATE_CANARY_LAPSED");
  assert.equal(G.canaryPlan(ENTRY, { bank: G.PUBLIC_BANK, account_kind: "civicsmith", retestAllowed: false }).code, "GATE_CANARY_RETEST_OFF");
  assert.equal(G.canaryPlan(ENTRY, { bank: G.PUBLIC_BANK, account_kind: "team", retestAllowed: true }).code, "GATE_CANARY_NOT_CIVICSMITH");
  const baseline = { ask: { G1: fig(48, 50) } };
  assert.equal(G.canaryCompare(baseline, { ask: { G1: fig(13, 15) } }).result, "same");
  const d = G.canaryCompare(baseline, { ask: { G1: fig(5, 15) } });
  assert.equal(d.result, "diverged");
  assert.deepEqual(d.moved.map((m) => [m.part, m.group, m.direction]), [["ask", "G1", "down"]]);
});

test("R53: each trigger yields its signal and reason; drift alone never proposes lapsed; a same canary yields none", () => {
  const e = { ...ENTRY };
  const diverged = { result: "diverged", moved: [{ part: "ask", group: "G1" }] };
  const one = (input) => G.lifecycleSignal({ entry: e, ...input });
  assert.deepEqual(one({ canary: diverged }).map((s) => [s.proposed, s.reason]), [["watch", "canary_drift"]]);
  assert.deepEqual(one({ served_model: "m-2" }).map((s) => [s.proposed, s.reason]), [["watch", "served_mismatch"]]);
  assert.deepEqual(one({ bundles: diverged }).map((s) => [s.proposed, s.reason]), [["watch", "team_divergence"]]);
  assert.deepEqual(one({ deprecation_date: "2027-01-01" }).map((s) => [s.proposed, s.reason, s.evidence.date]), [["watch", "deprecation", "2027-01-01"]]);
  const days = G.GATE_PARAMS.HEALTH_WINDOW_DAYS;
  assert.deepEqual(one({ health: { errors: { k: 40, n: 100 }, window_days: days }, baseline_errors: { k: 2, n: 100 } }).map((s) => [s.proposed, s.reason]), [["watch", "health"]]);
  assert.deepEqual(one({ health: { errors: { k: 3, n: 100 }, window_days: days }, baseline_errors: { k: 2, n: 100 } }), []);
  assert.deepEqual(one({ provider_error: "model_not_found" }).map((s) => s.proposed), ["lapsed"]);
  const drift = one({ canary: diverged, bundles: diverged, served_model: "m-2", health: { errors: { k: 90, n: 100 }, window_days: days }, baseline_errors: { k: 1, n: 100 } });
  assert.ok(drift.every((s) => s.proposed === "watch"));
  for (const s of [...drift, ...one({ provider_error: "model_not_found" })]) assert.ok(ADVISORY_REASONS.includes(s.reason), s.reason);
  assert.deepEqual(one({ canary: { result: "same", moved: [] } }), []);
});

test("R62: divergence compares a verified bundle's figures with the baseline by interval overlap", () => {
  const baseline = { run: { G3: fig(45, 50) } };
  assert.equal(G.divergence({ run: { G3: fig(9, 10) } }, baseline).result, "same");
  assert.equal(G.divergence({ run: { G3: fig(2, 10) } }, baseline).result, "diverged");
});

/* ================================================================== the bundle */

async function sealingPair() {
  const kp = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { key_id: `seal-test-${randomBytes(3).toString("hex")}`, public_key: Buffer.from(raw).toString("base64"), private_key: kp.privateKey };
}
const runPair = () => crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);

function payloadFixture({ usage = 30, secret = "" } = {}) {
  const call = (i) => ({ request: { body: { messages: [{ role: "user", content: `synthetic task ${i}${secret}` }] } },
    response: { body: { content: "done" } }, status: 200, headers: { "x-request-id": `req-${i}` },
    timings: { sent: "2026-11-05T10:00:00.000Z", first_byte: "2026-11-05T10:00:00.100Z", last_byte: "2026-11-05T10:00:00.300Z" },
    usage: { reported: { input_tokens: 10, output_tokens: 5 }, normalised: { input_tokens: 10, output_tokens: 5 } },
    outcome: "result", error_class: null, item_id: "g1-tool-args-ask", repeat: i, nonce: NONCE, request_id: `req-${i}` });
  return {
    calls: [call(0), call(1), call(2)],
    run: { image_digest: "sha256:" + "a".repeat(64), suiteVersions: VERSIONS, adapter_version: "a1", profile_version: "p1",
      subject: { entry_id: "test-entry" }, challenge: { challenge_id: "ch-1" }, estimate: { expected: 1 }, ceiling: { spend: 2, calls: 10, seconds: 60 },
      actual: { spend: 0.5 }, started_at: "2026-11-05T10:00:00Z", ended_at: "2026-11-05T10:05:00Z", region: "r1", early_stops: [],
      refused_egress: [], usage_total: { input_tokens: usage, output_tokens: 15 } },
    stub_logs: { "g1-tool-args-ask": [{ op: "read", allowed: true }] },
    preliminary: { preliminary: true, figures: {} },
  };
}

async function makeBundle({ payload = payloadFixture(), seal, run, manifestPatch = {}, signWith = null } = {}) {
  const runPublicKey = await G.runPublicLine(run.publicKey);
  const m = G.buildManifest({ payload, suiteVersions: VERSIONS, image_digest_declared: "sha256:" + "a".repeat(64), nonce: NONCE,
    challenge_id: "ch-1", declared: { provider: "prov", host: "api.example.test", plan: "plan-1", model: "m-1" },
    served: { provider: "prov", host: "api.example.test", model: "m-1" }, region: "r1", started_at: "2026-11-05T10:00:00Z",
    ended_at: "2026-11-05T10:05:00Z", tiers: [{ tier: "T1", completed: true }], spend: { estimate: 1, ceiling: 2, actual: 0.5 },
    run_public_key: runPublicKey, sealed_to: seal.key_id });
  const manifest = { ...m.manifest, ...manifestPatch };
  const manifestBytes = te.encode(canonicalJson(manifest));
  const s = await G.sealPayload(payload, seal);
  const sig = await G.signBundle(manifestBytes, s.sha256, signWith ?? run);
  return { bytes: G.encodeBundle({ manifestBytes, signature: sig.signature, sealed: s.sealed }), manifest, runPublicKey, sealed: s };
}

function ctxFor(seal, runPublicKey, over = {}) {
  return { open: (sealed) => G.openSealed(sealed, seal),
    issuedNonce: async (id) => (id === "ch-1" ? { nonce: NONCE, provider: "prov", plan: "plan-1", run_public_key: runPublicKey, bank_version: G.BANK_VERSION } : null),
    nonceUsed: async () => false, releasedDigests: ["sha256:" + "a".repeat(64)], keyShapes: ["sk-[A-Za-z0-9]{20,}"], ...over };
}

test("R54: the manifest holds every field, as canonical JSON, with no payload member and no secret; a manifest with a grade is refused by the verifier", async () => {
  const seal = await sealingPair(), run = await runPair();
  const b = await makeBundle({ seal, run });
  const m = b.manifest;
  for (const k of G.MANIFEST_KEYS) assert.ok(k in m, k);
  for (const k of G.PAYLOAD_MEMBERS) assert.ok(!(k in m), k);
  assert.equal(m.attestation, null);
  assert.ok(!("grade" in m));
  assert.equal(m.schema, "bio-gate-bundle/1");
  assert.deepEqual(m.suiteVersions, VERSIONS);
  assert.equal(G.buildManifest({ payload: payloadFixture() }).ok, false);
  assert.equal(G.scanForSecrets(m, ["sk-[A-Za-z0-9]{20,}"]).clean, true);
  const graded = await makeBundle({ seal, run, manifestPatch: { grade: "REPRODUCED" } });
  const v = await G.verifyBundle(graded.bytes, ctxFor(seal, graded.runPublicKey));
  assert.equal(v.status, "unverified");
  assert.ok(v.failing.includes("manifest_shape"));
});

test("R55: a built payload has exactly the members named; an extra member, or a team's record, fails checkPayload", () => {
  assert.equal(G.checkPayload(payloadFixture()), null);
  assert.equal(G.checkPayload({ ...payloadFixture(), records: [] }), "records");
  const p = payloadFixture(); p.calls[0].member_name = "x";
  assert.equal(G.checkPayload(p), "calls.member_name");
  const q = payloadFixture(); q.stub_logs.x = [{ op: "read", text: "INFO-2026-0042" }];
  assert.equal(G.checkPayload(q), "team_records");
  const r = payloadFixture(); delete r.preliminary;
  assert.equal(G.checkPayload(r), "preliminary");
});

test("R56: a payload sealed to a test key opens with its private half and no other; the run signature verifies; a flipped byte breaks it", async () => {
  const seal = await sealingPair(), other = await sealingPair(), run = await runPair();
  const b = await makeBundle({ seal, run });
  const parts = G.parseBundle(b.bytes);
  const opened = await G.openSealed(parts.payload, seal);
  assert.equal(td.decode(opened), canonicalJson(payloadFixture()));
  assert.equal(await G.openSealed(parts.payload, { ...other, key_id: seal.key_id, public_key: seal.public_key }), null);
  assert.equal(await G.openSealed(parts.payload, other), null);
  const ok = await G.verifyBundle(b.bytes, ctxFor(seal, b.runPublicKey));
  assert.equal(ok.status, "verified");
  const flip = (label) => {
    const bytes = G.parseBundle(b.bytes);
    const copy = new Uint8Array(bytes[label]); copy[label === "payload" ? copy.length - 1 : 10] ^= 1;
    return G.encodeBundle({ manifestBytes: label === "manifest" ? copy : bytes.manifest, signature: td.decode(bytes.signature),
      sealed: label === "payload" ? copy : bytes.payload });
  };
  for (const label of ["manifest", "payload"]) {
    const v = await G.verifyBundle(flip(label), ctxFor(seal, b.runPublicKey));
    assert.notEqual(v.status, "verified", label);
  }
  const otherNonce = await makeBundle({ seal, run, manifestPatch: { nonce: "m".repeat(32) } });
  const resigned = G.encodeBundle({ manifestBytes: G.parseBundle(otherNonce.bytes).manifest, signature: td.decode(parts.signature), sealed: parts.payload });
  assert.ok((await G.verifyBundle(resigned, ctxFor(seal, b.runPublicKey))).failing.includes("signature"));
  assert.ok(srcText("bundle.mjs").includes("bio-gate-bundle/1"));
});

test("R57: readManifest reads the manifest with no key in scope and never decrypts", async () => {
  const seal = await sealingPair(), run = await runPair();
  const b = await makeBundle({ seal, run });
  const r = G.readManifest(b.bytes);
  assert.equal(r.ok, true);
  assert.deepEqual(r.manifest, JSON.parse(canonicalJson(b.manifest)));
  assert.equal(G.readManifest.length, 1);
  assert.ok(!/decrypt|open/.test(G.readManifest.toString()));
  /* nothing opens a payload without an injected key or `open` */
  const v = await G.verifyBundle(b.bytes, ctxFor(seal, b.runPublicKey, { open: undefined }));
  assert.ok(v.failing.includes("payload_opens"));
});

test("R58: the sentinel key, its base64 and an sk-shaped string are each found; a clean payload passes; the name rule holds", () => {
  const key = "SENTINELkey0123456789abcdef";
  const shapes = ["sk-[A-Za-z0-9]{20,}"];
  assert.equal(G.scanForSecrets(payloadFixture({ secret: key }), shapes, [key]).hits[0].form, "plain");
  for (const pre of ["", "a", "ab"]) {
    const b64 = Buffer.from(pre + key + "tail").toString("base64");
    const hit = G.scanForSecrets({ header: `Basic ${b64}` }, [], [key]);
    assert.equal(hit.clean, false, pre);
  }
  assert.equal(G.scanForSecrets({ url: `https://x.example/?k=${encodeURIComponent(key + "/=")}` }, [], [key + "/="]).clean, false);
  assert.equal(G.scanForSecrets({ body: "token sk-ABCDEFGHIJKLMNOPQRSTUV" }, shapes, []).clean, false);
  const clean = G.scanForSecrets(payloadFixture(), shapes, [key]);
  assert.equal(clean.clean, true);
  assert.ok(!JSON.stringify(G.scanForSecrets(payloadFixture({ secret: key }), shapes, [key])).includes(key));
  const name = G.bundleName({ provider: "Prov", model: "M 1", date: "2026-11-05", sha256: "ab".repeat(32) });
  assert.equal(name, "prov-m_1-2026-11-05-abababab.bundle");
  assert.equal(G.checkBundleName(name), true);
  assert.equal(G.checkBundleName("prov-m-2026-11-05-sk-abc.bundle"), false);
});

test("R59: each failure is unverified with its check named; a planted secret is rejected; an untouched bundle is verified", async () => {
  const seal = await sealingPair(), run = await runPair(), wrong = await runPair();
  const b = await makeBundle({ seal, run });
  assert.equal((await G.verifyBundle(b.bytes, ctxFor(seal, b.runPublicKey))).status, "verified");
  const failing = async (bytes, over = {}, pk = b.runPublicKey) => (await G.verifyBundle(bytes, ctxFor(seal, pk, over))).failing ?? [];
  /* altered transcript: same manifest and signature, a payload re-sealed with one response changed */
  const p2 = payloadFixture(); p2.calls[1].response.body.content = "changed";
  const parts = G.parseBundle(b.bytes);
  const altered = G.encodeBundle({ manifestBytes: parts.manifest, signature: td.decode(parts.signature), sealed: (await G.sealPayload(p2, seal)).sealed });
  assert.ok((await failing(altered)).includes("payload_hashes"));
  assert.ok((await failing(b.bytes, { nonceUsed: async () => true })).includes("nonce_unused"));
  assert.ok((await failing(b.bytes, { releasedDigests: ["sha256:" + "b".repeat(64)] })).includes("image_digest"));
  const wrongKey = await makeBundle({ seal, run, signWith: wrong });
  assert.ok((await failing(wrongKey.bytes, {}, wrongKey.runPublicKey)).includes("signature"));
  const badUsage = await makeBundle({ seal, run, payload: payloadFixture({ usage: 31 }) });
  assert.ok((await failing(badUsage.bytes, {}, badUsage.runPublicKey)).includes("usage_consistent"));
  const attested = await makeBundle({ seal, run, manifestPatch: { attestation: { kind: "x" } } });
  assert.ok((await failing(attested.bytes, {}, attested.runPublicKey)).includes("manifest_shape"));
  const secret = await makeBundle({ seal, run, payload: payloadFixture({ secret: " sk-ABCDEFGHIJKLMNOPQRSTUVWX" }) });
  assert.equal((await G.verifyBundle(secret.bytes, ctxFor(seal, secret.runPublicKey))).status, "rejected");
  assert.equal((await G.verifyBundle(new Uint8Array([1, 2, 3]), ctxFor(seal, b.runPublicKey))).status, "rejected");
  for (const v of [await G.verifyBundle(altered, ctxFor(seal, b.runPublicKey))]) assert.notEqual(v.status, "failed");
});

test("R60: a challenge for another bank version, an expired one and one with a short nonce are each refused; a matching one is accepted", () => {
  const ch = { challenge_id: "ch-1", nonce: "A".repeat(22), bank_version: G.BANK_VERSION, selection_seed: SEED,
    issued_at: "2026-11-05T10:00:00Z", expires_at: "2026-11-05T11:00:00Z" };
  const at = "2026-11-05T10:30:00Z";
  assert.deepEqual(G.verifyChallenge(ch, { bank_version: G.BANK_VERSION, at }), { ok: true, challenge_id: "ch-1", selection_seed: SEED });
  assert.equal(G.verifyChallenge({ ...ch, bank_version: "bank-0" }, { bank_version: G.BANK_VERSION, at }).code, "CHALLENGE_BANK_VERSION");
  assert.equal(G.verifyChallenge(ch, { bank_version: G.BANK_VERSION, at: "2026-11-05T11:00:01Z" }).code, "CHALLENGE_EXPIRED");
  assert.equal(G.verifyChallenge({ ...ch, nonce: "A".repeat(21) }, { bank_version: G.BANK_VERSION, at }).code, "CHALLENGE_NONCE_SHORT");
  assert.equal(G.verifyChallenge({ ...ch, selection_seed: "" }, { bank_version: G.BANK_VERSION, at }).code, "CHALLENGE_MALFORMED");
  const items = G.selectItems(G.PUBLIC_BANK, ch.selection_seed, "T1", ["ask"]);
  assert.ok(items.length > 0);
});

/* ================================================================== grade and the library */

test("R61: a bundle is REPORTED whatever its manifest says; a Civicsmith run REPRODUCED; both kept side by side", () => {
  assert.equal(G.gradeOf("bundle"), "REPORTED");
  assert.equal(G.gradeOf("civicsmith"), "REPRODUCED");
  assert.equal(G.gradeOf({ grade: "REPRODUCED" }), null);
  assert.equal(G.gateRecord({ entry_id: "e", part: "ask", verdict: "passes", suiteVersions: VERSIONS, tier: "T2", run_ref: "r",
    grade: "REPRODUCED", source: "bundle", at: "2026-11-01T00:00:00Z" }).field, "grade");
  const rep = { subject_id: "e", grade: "REPORTED", suiteVersions: VERSIONS, tested_at: "2026-11-01T00:00:00Z" };
  assert.equal(G.awaitingReproduction([rep]).length, 1);
  const both = [rep, { ...rep, grade: "REPRODUCED" }];
  assert.equal(G.awaitingReproduction(both).length, 0);
  assert.equal(both.length, 2);
});

test("R63: a row from a bundle for an unlisted AI has no team, exchange, request or response key; with consent it has team_name; an unverified bundle builds none", () => {
  const v = [{ part: "ask", verdict: "not_yet_rated", limits: [] }];
  const base = { subject_id: "tested-ai-1", verdicts: v, grade: "REPORTED", suiteVersions: VERSIONS, tested_at: "2026-11-01T00:00:00Z", tested_by: "team",
    speed: { median_ms: 900, p90_ms: 2000, window: "w" }, task_cost: { low: 1, high: 2, unit: "USD", price_date: "2026-11-01" } };
  const r = G.resultRow({ ...base, verification: "verified" });
  for (const k of ["team", "team_name", "exchange", "request", "response", "figures"]) assert.ok(!(k in r.row), k);
  assert.deepEqual(r.row.parts, { ask: { verdict: "not_yet_rated", limits: [] } });
  assert.equal(G.resultRow({ ...base, verification: "verified", consent_ref: "c-1", team_name: "Team A" }).row.team_name, "Team A");
  assert.equal(G.resultRow({ ...base, verification: "unverified" }).code, "GATE_ROW_UNVERIFIED");
});

test("R67: results {4,5} and {5,5} pool to {9,10} with its interval; a seven-month-old result is left out; one alone gives its own", () => {
  const res = (k, tested_at, grade = "REPORTED") => ({ subject_id: "e", tested_at, grade, suiteVersions: VERSIONS,
    figures: { ask: { G1: { k, n: 5 } } }, limits: { ask: [] }, speed: { median_ms: 1000 + k, p90_ms: 2000 + k }, task_cost: { low: k, high: k + 1, unit: "USD" } });
  const opts = { at: "2026-11-05T00:00:00Z", activeMonths: 6, suiteVersions: VERSIONS, thresholds: G.GATE_THRESHOLDS };
  const c = G.combineResults([res(4, "2026-10-01T00:00:00Z"), res(5, "2026-09-01T00:00:00Z"), res(5, "2026-04-01T00:00:00Z")], opts);
  const rec = c.records[0];
  assert.deepEqual([rec.groups.G1.k, rec.groups.G1.n], [9, 10]);
  const w = G.wilson(9, 10);
  assert.equal(rec.groups.G1.wilson_low, w.low);
  assert.equal(rec.results.total, 2);
  assert.equal(rec.confirmed, false);
  assert.deepEqual([rec.task_cost.low, rec.task_cost.high, rec.speed.p90_ms], [4, 6, 2005]);
  const alone = G.combineResults([res(4, "2026-10-01T00:00:00Z", "REPRODUCED")], opts).records[0];
  assert.deepEqual([alone.groups.G1.k, alone.groups.G1.n], [4, 5]);
  assert.equal(alone.confirmed, true);
  const older = { ...res(4, "2026-10-01T00:00:00Z"), suiteVersions: { ...VERSIONS, bank: "bank-0" } };
  assert.equal(G.combineResults([older], opts).left_out, 1);
  assert.equal(G.combineResults([older], { ...opts, rescore: (r) => ({ ...r, suiteVersions: VERSIONS }) }).records.length, 1);
});

test("R64: an entry with ask not_suitable and transcribe passes is refused ask; passes_with_limits is not refused", () => {
  const gate = Object.fromEntries(GATE_PARTS.map((p) => [p, { verdict: "passes" }]));
  const entry = { entry_id: "e1", gate: { ...gate, ask: { verdict: "not_suitable" }, read: { verdict: "passes_with_limits" } } };
  const r = G.partsRefused(entry);
  assert.deepEqual(r.map((x) => x.part), ["ask"]);
  assert.equal(r[0].words, "ai.refused.partnotpassed");
  assert.equal(r[0].entry_id, "e1");
});
