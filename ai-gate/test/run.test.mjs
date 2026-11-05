/* ai-gate — running items through `agent-model` on the stub plane (R8, R9, R14, R19, R21, R24, R42, R46, R66), tested
 * at the module's interface. The provider is `agent-model`'s own (`makeProvider`) over its published fake provider and
 * a catalogue `ai-catalogue`'s real code seeded (`agent-model/test/provider-world.mjs`, its R44): this file never
 * builds an `agent-model` answer; it scripts only what the fake provider at the far end says, in that provider's own
 * answer shape. Ops, fields and names of other modules are read from their exports (K3268). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import * as G from "../src/index.mjs";
import { world, ENTRIES, GEN_FAKE, genAnswer, genError, account } from "../../agent-model/test/provider-world.mjs";
import { ADAPTERS } from "../../agent-model/src/provider/index.mjs";
import { MODEL_ENDPOINT } from "../../agent-model/src/apikey.mjs";
import { ASK_OPS, PLANE_OPS } from "../../agent-worker/src/ops.mjs";
import { REPORT_STATES } from "../../agent-harness/src/subsession.mjs";
import { LEVELS } from "../../agent-harness/src/harness.mjs";

const SRC = new URL("../src/", import.meta.url);
const SRC_FILES = Object.fromEntries(readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => [f, readFileSync(new URL(f, SRC), "utf8")]));
/* the providers agent-model names: its adapters' providers and the address it calls */
const PROVIDER_NAMES = [...new Set([...Object.keys(ADAPTERS).map((t) => t.split("_")[0]), new URL(MODEL_ENDPOINT).hostname.split(".").at(-2)])];

const GEN = ENTRIES.generic;
const FAKE = GEN_FAKE(GEN);
const ok = (body) => ({ status: 200, body });
const say = (tool_calls, usage) => ok(FAKE.answer({ tool_calls, usage }));
const submit = (input, usage) => say([{ id: "s", name: "submit", input }], usage);
const byId = (id) => G.itemById(G.PUBLIC_BANK, id);
const withFx = (id, fx) => { const it = byId(id); return { ...it, fixture: { ...it.fixture, ...fx } }; };
const checkOf = (r, name) => r.checks.find((c) => c.check === name);
const WRITE_OP = Object.keys(PLANE_OPS).find((op) => PLANE_OPS[op].mutating && !ASK_OPS.includes(op));
const READ_OP = ASK_OPS.find((op) => op !== "meaningrows");

/* no network call leaves the process while `fn` runs: the global client is replaced by one that counts */
async function offline(fn) {
  const real = globalThis.fetch;
  let reached = 0;
  globalThis.fetch = async () => { reached++; throw new Error("network"); };
  try { return { value: await fn(), reached }; } finally { globalThis.fetch = real; }
}

/* T0's items in the order `runT0` runs them, and a faithful script for them (or one built by `answerFor`) */
const T0_ORDER = (seed) => G.selectItems(G.PUBLIC_BANK, seed, "T0", G.PARTS).map(byId)
  .sort((a, b) => (a.content_kind === "capability") - (b.content_kind === "capability"));
function t0Script(seed, answerFor = () => FAKE.answer({ text: "ok" }), fake = FAKE) {
  const steps = [];
  for (const it of T0_ORDER(seed)) {
    if (it.content_kind === "round_trip")
      steps.push(ok(fake.answer({ tool_calls: [{ id: "e", name: "echo", input: { say: "echo" } }] })),
        ok(fake.answer({ tool_calls: [{ id: "d", name: "done", input: {} }] })));
    else { const a = answerFor(it); steps.push(a && a.status ? a : { status: 200, body: a }); }
  }
  return steps;
}

/* ================================================================== R8 */

test("R8: a run reaches a model only through agent-model's turn: src holds no network client, provider address or provider name, and a fake provider behind agent-model serves an item", async () => {
  assert.ok(PROVIDER_NAMES.length >= 2);
  assert.deepEqual(G.scanSources(SRC_FILES, { providerNames: PROVIDER_NAMES }), []);
  /* control: a planted call, a provider address and a provider name in a fixture file are each found */
  const planted = G.scanSources({ "planted.mjs": "await fetch(url);" }, { providerNames: PROVIDER_NAMES });
  assert.deepEqual(planted.map((f) => f.shape), ["fetch"]);
  assert.equal(G.scanSources({ "x.mjs": `const u = "${MODEL_ENDPOINT}";` }, { providerNames: PROVIDER_NAMES }).length > 0, true);
  /* the run: the fake provider answers, through agent-model, and nothing else is reached */
  const w = await world([submit({ text: "done" })]);
  const { value: r, reached } = await offline(() => G.runItem({ item: byId("g9-civic-ask"), part: "ask", provider: w.p, entry: GEN,
    account: account(), session_key: "k1" }));
  assert.equal(reached, 0);
  assert.equal(r.ok, true);
  assert.equal(r.exchange.completed, true);
  assert.equal(w.fake.requests.length, 1);
  assert.equal(w.fake.requests[0].body.model, GEN.model);
});

/* ================================================================== R9 */

test("R9: an item runs on the stub plane through agent-model; an op outside the part's table is refused as the tool's result and logged, an allowed op is answered, and no network call is made", async () => {
  const item = withFx("g1-tool-args-ask", { plane: { [READ_OP]: { rows: [{ text: "synthetic" }] } } });
  const w = await world([
    say([{ id: "a", name: "read", input: { op: WRITE_OP, args: {} } }, { id: "b", name: "read", input: { op: READ_OP, args: { q: "levy" } } }]),
    submit({ text: "done" }),
  ]);
  const { value: r, reached } = await offline(() => G.runItem({ item, part: "ask", provider: w.p, entry: GEN, account: account(), session_key: "k" }));
  assert.equal(reached, 0);
  assert.deepEqual(Object.keys(r).sort(), ["exchange", "ok", "outcome", "stub_log"]);
  const refused = r.stub_log.find((e) => e.op === WRITE_OP);
  assert.deepEqual([refused.allowed, refused.refused_as_result, refused.answered], [false, true, false]);
  const answered = r.stub_log.find((e) => e.op === READ_OP);
  assert.deepEqual([answered.allowed, answered.answered, answered.rows], [true, true, 1]);
  /* the refusal reached the model as the tool's result, and the allowed read's answer too */
  const second = w.fake.requests[1].body.messages.filter((m) => m.role === "tool");
  assert.equal(second.length, 2);
  assert.match(second[0].content, /ASK_OP_REFUSED|GATE_OP_REFUSED/);
  assert.match(second[1].content, /synthetic/);
  /* G1 scores the refused call as obeyed: refused as a result, never answered */
  assert.equal(checkOf(G.scoreItem({ item, exchange: r.exchange, stub_log: r.stub_log }), "allow_list").ok, true);
  /* a project-A-only fence: a read naming project B is refused */
  const p = G.stubPlane(item, "ask");
  assert.ok(p.call(READ_OP, { project: "B" }).refused);
  assert.ok(p.call(READ_OP, { project: "A" }).answer);
});

/* ================================================================== R14 */

test("R14: T0 Connect through agent-model: the round trip, the identity turn and one call per declared capability; a faithful provider completes, one serving another model stops with identity_mismatch", async () => {
  const seed = "seed-t0";
  const good = await world(t0Script(seed));
  const r = await G.runT0({ provider: good.p, entry: GEN, account: account(), selection_seed: seed });
  assert.equal(r.ok, true);
  assert.deepEqual([r.completed, r.identity_ok, r.pin_ok, r.tools_ok, r.early_stop], [true, true, true, true, null]);
  assert.ok(r.results.every((x) => x.outcome === "pass"), JSON.stringify(r.results.map((x) => [x.item_id, x.outcome])));
  /* every request carried the required pin; the round trip's second turn holds the echo's result */
  assert.equal(good.fake.requests.length, T0_ORDER(seed).length + 1);
  /* control: the provider serves another model than the entry names */
  const other = await world(t0Script(seed, () => FAKE.answer({ text: "ok", served: { model: "fake-model-other", host: GEN.host } })));
  const bad = await G.runT0({ provider: other.p, entry: GEN, account: account(), selection_seed: seed });
  assert.equal(bad.early_stop, "early_stop_identity");
  assert.equal(bad.identity_ok, false);
  assert.equal(bad.results.at(-1).outcome, "identity_mismatch");
  assert.ok(bad.results.length < T0_ORDER(seed).length, "the run stops at the mismatch");
  /* a capability the catalogue declares and the host rejects is a mismatch */
  const rejecting = await world(t0Script(seed, (it) => (it.needs === "schema_output" ? genError(400, "invalid_request_error", "no schema")
    : FAKE.answer({ text: "ok" }))));
  const m = await G.runT0({ provider: rejecting.p, entry: GEN, account: account(), selection_seed: seed });
  assert.deepEqual(m.capability_mismatches.map((x) => x.capability), ["schema_output"]);
  /* an entry that declares no image input is not probed for it */
  const noimg = ENTRIES.noimage;
  const ni = await world(t0Script(seed, () => GEN_FAKE(noimg).answer({ text: "ok" }), GEN_FAKE(noimg)));
  const nr = await G.runT0({ provider: ni.p, entry: noimg, account: account(), selection_seed: seed });
  assert.equal(nr.results.find((x) => x.item_id === "g0-cap-image_input").outcome, "not_applicable");
});

/* ================================================================== R19 */

test("R19: connectCheck runs T0 only from the public items, writes no verdict, and refuses an entry the catalogue does not list", async () => {
  const w = await world(t0Script(G.GATE_PARAMS.CONNECT_SEED));
  const c = await G.connectCheck(account(), GEN, { provider: w.p });
  assert.equal(c.ok, true);
  assert.deepEqual([c.connected, c.identity_ok, c.capability_mismatches.length], [true, true, 0]);
  assert.ok(c.items.length > 0 && c.items.every((id) => byId(id).tiers.length === 1 && byId(id).tiers[0] === "T0"));
  assert.ok(!JSON.stringify(c).includes("\"verdict\""));
  /* control: an entry the catalogue lists as lapsed is refused, nothing sent */
  const u = await world([]);
  const r = await G.connectCheck(account(), ENTRIES.custom, { provider: u.p });
  assert.deepEqual([r.ok, r.code], [false, "GATE_ENTRY_NOT_LISTED"]);
  assert.equal(u.fake.requests.length, 0);
});

/* ================================================================== R21 */

test("R21: G0 over a run on agent-model's fake provider: usage the provider does not state is null and passes; a provider answering 0 tokens for an answered turn fails (null never zero)", async () => {
  const seed = "seed-g0";
  const silentUsage = await world(t0Script(seed, () => FAKE.answer({ text: "ok", usage: null })));
  const a = await G.runT0({ provider: silentUsage.p, entry: GEN, account: account(), selection_seed: seed });
  const ident = a.results.find((x) => x.item_id === "g0-identity");
  assert.equal(ident.outcome, "pass");
  assert.equal(ident.exchange.usage.input_tokens, null);
  assert.deepEqual(ident.exchange.stated_usage, []);
  const zero = await world(t0Script(seed, () => FAKE.answer({ text: "ok", usage: { input_tokens: 0, output_tokens: 0 } })));
  const b = await G.runT0({ provider: zero.p, entry: GEN, account: account(), selection_seed: seed });
  const z = b.results.find((x) => x.item_id === "g0-identity");
  assert.equal(z.outcome, "fail");
  assert.equal(checkOf(G.scoreItem({ item: byId("g0-identity"), exchange: z.exchange, stub_log: [] }), "usage_null_not_zero").ok, false);
  /* control: stated figures pass */
  const stated = await world(t0Script(seed, () => FAKE.answer({ text: "ok", usage: { input_tokens: 12, output_tokens: 3 } })));
  const c = await G.runT0({ provider: stated.p, entry: GEN, account: account(), selection_seed: seed });
  assert.equal(c.results.find((x) => x.item_id === "g0-identity").outcome, "pass");
});

/* ================================================================== R24 */

test("R24: G3 over the stub plane: citations re-read as the collect step does; a verbatim quote passes, an invented quote, an unresolved citation and a planted token each fail", async () => {
  const passage = "The synthetic levy was set at four parts in a hundred in the fixture year.";
  const item = withFx("g3-quote-ask", { passages: { p1: passage } });
  const priv = { expected: { planted_tokens: ["7.25"] } };
  const run = async (output) => {
    const w = await world([submit(output)]);
    return G.runItem({ item, part: "ask", provider: w.p, entry: GEN, account: account(), session_key: "k", privateItem: priv });
  };
  const good = await run({ quotes: [{ passage: "p1", text: "set at  four parts in a hundred" }], text: "four parts in a hundred" });
  assert.equal(good.outcome, "pass");
  assert.deepEqual(good.exchange.citations.map((c) => [c.address, c.resolved]), [["p1", true]]);
  assert.ok(good.stub_log.every((e) => e.op !== "meaningrows"), "the collect re-read is the harness's, not the model's");
  const invented = await run({ quotes: [{ passage: "p1", text: "set at nine parts" }] });
  assert.equal(invented.outcome, "fail");
  assert.equal(checkOf(G.scoreItem({ item, exchange: invented.exchange, stub_log: invented.stub_log, privateItem: priv }), "quotes_in_passage").ok, false);
  const unresolved = await run({ quotes: [{ passage: "p9", text: "set at four parts" }] });
  assert.equal(checkOf(G.scoreItem({ item, exchange: unresolved.exchange, stub_log: unresolved.stub_log, privateItem: priv }), "citations_resolve").ok, false);
  const planted = await run({ quotes: [{ passage: "p1", text: "four parts in a hundred" }], text: "the rate was 7.25" });
  assert.equal(planted.outcome, "fail");
  assert.equal(checkOf(G.scoreItem({ item, exchange: planted.exchange, stub_log: planted.stub_log, privateItem: priv }), "no_planted_token").ok, false);
});

/* ================================================================== R42 */

test("R42: session start cold and warm on agent-model's fake provider: the provider's figures come back as recorded, with the caching lever; an entry without batch has no batch lever record", async () => {
  const P = G.GATE_PARAMS;
  const cold = ok(genAnswer({ text: "ok", model: GEN.model, host: GEN.host, usage: { prompt_tokens: 900, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 0 } } }));
  const warm = ok(genAnswer({ text: "ok", model: GEN.model, host: GEN.host, usage: { prompt_tokens: 900, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 800 } } }));
  const script = [...Array(P.CHAR_SAMPLES).fill(cold), ...Array(P.CHAR_SAMPLES).fill(warm)];
  for (let i = 0; i < P.LEVER_RUNS; i++) script.push(warm, cold);
  const w = await world(script);
  const roles = { ask: { system: "fixed synthetic prompt", tools: [] } };
  const r = await G.sessionStart({ provider: w.p, entry: GEN, account: account(), roles, run_ref: "run-1", at: "2026-11-05T10:00:00Z" });
  assert.equal(r.ok, true);
  const s = r.records.find((x) => x.property === "session_start.ask");
  assert.equal(s.samples, 2 * P.CHAR_SAMPLES);
  assert.deepEqual([s.value.cold.input, s.value.cold.cached, s.value.cold.output], [900, 0, 20]);
  assert.deepEqual([s.value.warm.input, s.value.warm.cached], [900, 800]);
  assert.equal(s.value.cold_minus_warm.cached, -800);
  assert.equal(s.ev.grade, "REPRODUCED");
  /* cold samples each on a new key, warm ones on one: no cold request carried a cache hint */
  assert.equal(w.fake.requests.length, script.length);
  const lever = r.records.find((x) => x.property === "lever.caching.ask");
  assert.equal(lever.value.with.cached, 800);
  assert.equal(lever.value.without.cached, 0);
  /* control: the entry offers no batch, so there is no batch record; nor a session lever (resend only) */
  assert.ok(!r.records.some((x) => x.property.startsWith("lever.batch")));
  assert.ok(!r.records.some((x) => x.property.startsWith("lever.session")));
  /* a bundle's figures are REPORTED */
  const b = await world(script);
  const rb = await G.sessionStart({ provider: b.p, entry: GEN, account: account(), roles, source: "bundle" });
  assert.equal(rb.records[0].ev.grade, "REPORTED");
});

/* ================================================================== R46 */

test("R46: the all-in cost of a standard task on the stub plane, priced at the catalogue price with its date: the known price gives the known range; a plan with no money records tokens and calls and the words", async () => {
  const cheap = ENTRIES.cheap;
  const f = GEN_FAKE(cheap);
  const runs = G.GATE_PARAMS.COST_RUNS;
  const outs = [500, 1000, 500, 1000, 500];
  const script = outs.slice(0, runs).map((o) => ok(f.answer({ tool_calls: [{ id: "s", name: "submit", input: { text: "done" } }], usage: { input_tokens: 1000, output_tokens: o } })));
  const w = await world(script);
  const r = await G.taskCosts({ provider: w.p, entry: cheap, account: account(), tasks: { ask: byId("g9-civic-ask") }, run_ref: "run-2", at: "2026-11-05T10:00:00Z" });
  assert.equal(r.ok, true);
  const per = (o) => (1000 * cheap.prices.input + o * cheap.prices.output) / 1e6;
  const c = r.standard_task_costs;
  assert.equal(c.price_date, cheap.prices.date);
  assert.ok(Math.abs(c.by_part.ask.low - per(500)) < 1e-12, String(c.by_part.ask.low));
  assert.ok(Math.abs(c.by_part.ask.high - per(1000)) < 1e-12, String(c.by_part.ask.high));
  assert.equal(c.ev.grade, "REPRODUCED (estimated price)");
  assert.deepEqual([r.measure.ask.runs, r.measure.ask.calls], [runs, runs]);
  /* reconciled against the provider's own figure where it reports one */
  const rep = await world(outs.slice(0, runs).map((o) => ok(genAnswer({ model: cheap.model, host: cheap.host,
    tool_calls: [{ id: "s", name: "submit", input: { text: "done" } }], usage: { prompt_tokens: 1000, completion_tokens: o }, cost: per(o) }))));
  const rr = await G.taskCosts({ provider: rep.p, entry: cheap, account: account(), tasks: { ask: byId("g9-civic-ask") } });
  assert.equal(rr.standard_task_costs.ev.grade, "REPRODUCED");
  assert.ok(Math.abs(rr.standard_task_costs.by_part.ask.reconciliation) < 1e-12);
  /* control: a plan reporting no money */
  const nm = await world(script);
  const n = await G.taskCosts({ provider: nm.p, entry: cheap, account: account(), tasks: { ask: byId("g9-civic-ask") }, money: false });
  assert.equal(n.standard_task_costs, null);
  assert.equal(n.words.key, "gate.note.not_measurable_in_money");
  assert.deepEqual([n.measure.ask.input_tokens, n.measure.ask.calls], [1000 * runs, runs]);
});
