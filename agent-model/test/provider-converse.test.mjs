/* agent-model (T53) — `converse` built on `turn` at the module's interface: its endings and keys (R6), record text as
 * data through each adapter (R12), the one hand-back of a refused final call (R18), the effort class (R19) and what it
 * answers (R21). Catalogue: `ai-catalogue`'s own, seeded through its code; provider: the module's scripted fake. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { world, account, ENTRIES, msgAnswer, genAnswer, DH } from "./provider-world.mjs";
import { segmentMeter } from "../src/model.mjs";
import { makeProvider } from "../src/provider/index.mjs";
import { MAX_TURNS_DEFAULT } from "../src/provider/params.mjs";

const MSG = ENTRIES.messages.entry_id;
const GEN = ENTRIES.generic.entry_id;
const FINAL = { name: "answer", description: "the answer", input_schema: { type: "object", properties: { v: { type: "string" } } } };
const LOOK = { name: "look", description: "look something up", input_schema: { type: "object", properties: { q: { type: "string" } } } };
const args = (entry_id, over = {}) => ({ account: account(), entry_id, runtime: "shared_worker", data_handling: DH, mode: "ask",
  meter: segmentMeter({ turnsBound: 50, bytesBound: 1e9 }), system: "pack words", messages: [{ role: "user", content: "the ask" }],
  tools: [LOOK, FINAL], finalTool: "answer", onTool: async () => ({ content: "looked" }), idempotency_base: "run-1:step-2", ...over });
const msgCall = (name, input, id = `c-${name}`) => ({ status: 200, body: msgAnswer({ tool_calls: [{ id, name, input }] }) });
const genCall = (name, input, id = `c-${name}`) => ({ status: 200, body: genAnswer({ tool_calls: [{ id, name, input }] }) });

test("R6 a fake turn shows the four endings; calls equal the fake provider's requests; two runs with the same base send the same keys; an injected turn touches no adapter; control: a finalTool call on turn one ends it with one call", async () => {
  const w = await world([msgCall("look", { q: "a" }), msgCall("answer", { v: "done" })]);
  const out = await w.p.converse(args(MSG));
  assert.deepEqual(out.answer, { v: "done" });
  assert.equal(out.calls, w.fake.requests.length);
  assert.deepEqual(w.fake.requests.map((r) => r.headers["idempotency-key"]), ["run-1:step-2:1", "run-1:step-2:2"]);
  const w2 = await world([msgCall("look", { q: "a" }), msgCall("answer", { v: "done" })]);
  await w2.p.converse(args(MSG));
  assert.deepEqual(w2.fake.requests.map((r) => r.headers["idempotency-key"]), w.fake.requests.map((r) => r.headers["idempotency-key"]));

  const seen = [];
  const scripted = (answers) => async (request) => { seen.push(request); const a = answers.shift(); return a; };
  const okTurn = (tool_calls) => ({ result: { text: "", tool_calls, stop: "tool_call", continuation: null },
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: null, cache_creation_input_tokens: null, reasoning_tokens: null, calls: 1, cost_reported: null, cost_estimated: null, unstated: [] },
    served: { provider: null, host: "h", model_version: "v", request_id: null, fingerprint: null }, label: {}, entry_id: GEN });
  const bare = await world([], { adapters: {} });
  const inj = (answers) => makeProvider({ ...bare.deps, turn: scripted(answers) });
  const stoppedTurns = await inj([]).converse(args(GEN, { meter: segmentMeter({ turnsBound: 0, bytesBound: 1e9 }) }));
  assert.deepEqual(stoppedTurns, { stopped: "turns" });
  const stoppedBytes = await inj([]).converse(args(GEN, { meter: segmentMeter({ turnsBound: 5, bytesBound: 10 }) }));
  assert.deepEqual(stoppedBytes, { stopped: "bytes" });
  const looping = Array.from({ length: 3 }, () => okTurn([{ id: "l", name: "look", input: {} }]));
  const ex = await inj(looping).converse(args(GEN, { maxTurns: 3 }));
  assert.deepEqual([ex.exhausted, ex.calls], [true, 3]);
  const refusedTurn = await inj([{ refused: { type: "UNSUPPORTED_CONTROL", control: "tools" }, usage: null, events: [] }]).converse(args(GEN));
  assert.deepEqual([refusedTurn.refused.type, refusedTurn.calls], ["UNSUPPORTED_CONTROL", 0]);
  assert.equal(bare.fake.requests.length, 0, "no adapter and no provider were touched");
  seen.length = 0;
  const one = await inj([okTurn([{ id: "f", name: "answer", input: { v: "1" } }])]).converse(args(GEN));
  assert.deepEqual([one.answer, one.calls, seen.length], [{ v: "1" }, 1, 1]);
  assert.ok(MAX_TURNS_DEFAULT > 0);
});

const SENTINEL = "RECORD-TEXT-SENTINEL";
/* where the sentinel sits in a request body, per adapter: inside a tool-result block, or elsewhere */
function placement(body, kind) {
  const inResult = [];
  const elsewhere = [];
  const visit = (v, inside) => { const s = JSON.stringify(v); if (s.includes(SENTINEL)) (inside ? inResult : elsewhere).push(s); };
  if (kind === "msg") {
    visit(body.system ?? null, false);
    for (const m of body.messages) for (const b of m.content) visit(b, b.type === "tool_result");
  } else for (const m of body.messages) visit(m, m.role === "tool");
  return { inResult: inResult.length, elsewhere: elsewhere.length };
}

test("R12 a sentinel in every record field and in an onTool answer is found, through each adapter's fake, only in the tool-result position; control: a sentinel in the pack's own text is allowed in system", async () => {
  const answers = [{ content: `plain ${SENTINEL}` }, { search_results: [{ source: `src ${SENTINEL}`, title: `t ${SENTINEL}`, content: [`c ${SENTINEL}`] }] }];
  for (const [kind, entry, call] of [["msg", MSG, msgCall], ["gen", GEN, genCall]]) {
    for (const a of answers) {
      const w = await world([call("look", { q: "a" }), call("answer", { v: "x" })]);
      await w.p.converse(args(entry, { onTool: async () => a }));
      const p = placement(w.fake.requests[1].body, kind);
      assert.ok(p.inResult >= 1, `${kind}: the record text reached the model`);
      assert.equal(p.elsewhere, 0, `${kind}: only in the tool-result position`);
    }
    const w = await world([call("answer", { v: "x" })]);
    await w.p.converse(args(entry, { system: `pack ${SENTINEL}` }));
    assert.ok(JSON.stringify(w.fake.requests[0].body).includes(SENTINEL), "the pack's own text may be system text");
  }
});

test("R18 over a fake on two adapters, a first refused and a second accepted final call return the second's input after one hand-back; control: two refused calls return the second's input and no third turn is taken", async () => {
  for (const [entry, call] of [[MSG, msgCall], [GEN, genCall]]) {
    const checkFinal = async (input) => (input.v === "bad" ? { code: "FINAL_REFUSED", detail: "say it again" } : null);
    const w = await world([call("answer", { v: "bad" }, "f1"), call("answer", { v: "good" }, "f2")]);
    const out = await w.p.converse(args(entry, { checkFinal }));
    assert.deepEqual(out.answer, { v: "good" });
    assert.equal(w.fake.requests.length, 2);
    assert.ok(JSON.stringify(w.fake.requests[1].body).includes("FINAL_REFUSED"));
    const w2 = await world([call("answer", { v: "bad" }, "f1"), call("answer", { v: "bad" }, "f2"), call("answer", { v: "third" }, "f3")]);
    const out2 = await w2.p.converse(args(entry, { checkFinal }));
    assert.deepEqual(out2.answer, { v: "bad" });
    assert.equal(w2.fake.requests.length, 2);
  }
});

test("R19 over an entry with effort set {lo, hi} and classes {low: lo, medium: hi}, a sub-session request carries lo and another hi; a dial-less entry's request carries no effort", async () => {
  const e = ENTRIES.lohi.entry_id;
  const w = await world([genCall("answer", { v: "s" }), genCall("answer", { v: "c" }), genCall("answer", { v: "d" })]);
  await w.p.converse(args(e, { role: "subsession" }));
  await w.p.converse(args(e));
  await w.p.converse(args(ENTRIES.dialless.entry_id));
  assert.deepEqual(w.fake.requests.map((r) => r.body.reasoning_effort ?? null), ["lo", "hi", null]);
});

test("R21 converse answers entry_id, served, label and effort beside usage and calls: a sub-session's carries its entry, served and lo, a coordinating one hi; control: a dial-less entry answers effort null", async () => {
  const e = ENTRIES.lohi.entry_id;
  const id = ENTRIES.lohi.served_ids[0];
  const call = { status: 200, body: genAnswer({ tool_calls: [{ id: "f", name: "answer", input: { v: "1" } }], host: "fakeco", model: id }) };
  const w = await world([call, call]);
  const sub = await w.p.converse(args(e, { role: "subsession" }));
  assert.deepEqual([sub.entry_id, sub.served.host, sub.served.model_version, sub.effort, sub.label.effort], [e, "fakeco", id, "lo", "lo"]);
  assert.ok(sub.usage && sub.calls === 1);
  const coord = await w.p.converse(args(e));
  assert.equal(coord.effort, "hi");
  w.fake.steps.push({ status: 200, body: genAnswer({ tool_calls: [{ id: "f", name: "answer", input: { v: "1" } }], host: "fakeco", model: ENTRIES.dialless.served_ids[0] }) });
  const dl = await w.p.converse(args(ENTRIES.dialless.entry_id));
  assert.equal(dl.effort, null);
});
