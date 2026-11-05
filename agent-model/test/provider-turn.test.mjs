/* agent-model (T53) — `turn` at the module's interface: the request (R25), the boundary refusals (R29–R31, R14, R36),
 * the Anthropic adapter's key, caching and usage (R2–R5, R16), the outcome envelope and stops (R26, R27), continuations
 * (R28), idempotency and retry (R32, R51), progress (R33), adapter selection (R37), the pin (R45), means (R46), classes
 * (R50), limits (R52), the circuit (R53), usage across attempts (R54), and the credential rules (R8–R11, R49).
 *
 * The catalogue is `ai-catalogue`'s own, seeded through its code (provider-world.mjs); the provider is the module's
 * scripted fake (R44). The clock is pinned. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { world, req, account, SECRET, ENTRIES, msgAnswer, msgError, genAnswer, genError, handle, DH } from "./provider-world.mjs";
import { REQUEST_FIELDS } from "../src/provider/index.mjs";
import { RETRY_ATTEMPTS, RETRY_AFTER_WAIT_MAX_MS, BREAKER_FAILURES, BREAKER_COOLDOWN_MS, PROVIDER_MESSAGE_CHARS_MAX,
  DETAIL_CHARS_MAX, INTERACTIVE_ATTEMPTS } from "../src/provider/params.mjs";
import { TOKEN_FIGURES } from "../src/provider/neutral.mjs";

const holds = (v, s) => JSON.stringify(v).includes(s);
const MSG = ENTRIES.messages.entry_id;
const GEN = ENTRIES.generic.entry_id;

test("R25 each malformed request is refused with its type and the fake provider receives nothing; an entry_id equal to the fake's provider model string is ENTRY_UNKNOWN; control: the well-formed request is sent", async () => {
  const w = await world([{ status: 200, body: msgAnswer({ text: "ok" }) }]);
  const cases = [
    [req(MSG, { account: undefined }), "ACCOUNT_REFERENCE_UNUSABLE"],
    [req(MSG, { account: account({ level: "planet" }) }), "ACCOUNT_REFERENCE_UNUSABLE"],
    [req(MSG, { idempotency_key: "" }), "REQUEST_INVALID", "idempotency_key"],
    [req(MSG, { max_output: 0 }), "REQUEST_INVALID", "max_output"],
    [req(MSG, { timeout_ms: 1.5 }), "REQUEST_INVALID", "timeout_ms"],
    [req(MSG, { model: "x" }), "REQUEST_INVALID", "model"],
    [req(ENTRIES.messages.model), "ENTRY_UNKNOWN"],
    [req(ENTRIES.retired.entry_id), "ENTRY_RETIRED"],
  ];
  for (const [r, type, field] of cases) {
    const out = await w.p.turn(r);
    assert.equal(out.refused?.type, type, JSON.stringify(r).slice(0, 80));
    if (field) assert.equal(out.refused.field, field);
    assert.equal(out.usage, null);
  }
  assert.equal(w.fake.requests.length, 0);
  assert.ok((await w.p.turn(req(MSG))).result);
  assert.equal(w.fake.requests.length, 1);
  assert.ok(REQUEST_FIELDS.includes("test_flow") && REQUEST_FIELDS.includes("onProgress"));
});

test("R2 the Anthropic adapter sends the key in the profile's header only; no secret, or a means the plan does not allow, refuses with no call; control: a valid account is sent", async () => {
  const w = await world([{ status: 200, body: msgAnswer({ text: "ok" }) }]);
  for (const a of [account({ secret: "" }), account({ means: "teleport" }), account({ means: "issued", plan_id: "fakeco-sealedonly" })]) {
    const out = await w.p.turn(req(MSG, { account: a }));
    assert.ok(out.refused, JSON.stringify(a));
  }
  assert.equal(w.fake.requests.length, 0);
  const out = await w.p.turn(req(MSG));
  assert.ok(out.result);
  const sent = w.fake.requests[0];
  assert.equal(sent.headers["x-api-key"], SECRET);
  assert.ok(!holds(sent.body, SECRET));
  assert.deepEqual(Object.entries(sent.headers).filter(([, v]) => String(v).includes(SECRET)).map(([k]) => k), ["x-api-key"]);
  assert.ok(sent.url.startsWith("https://api.fakeco.example/"));
});

test("R3 a throw, a non-JSON body, a 500 with a long message, a 429 for a spent cap and a refusal stop each yield their outcome; never throws; control: a 200 yields result", async () => {
  const long = "x".repeat(PROVIDER_MESSAGE_CHARS_MAX * 2);
  const w1 = await world([], { fetch: async () => { throw new Error("y".repeat(DETAIL_CHARS_MAX * 2)); } });
  const thrown = await w1.p.turn(req(MSG));
  assert.ok(thrown.silent);
  assert.ok(thrown.silent.detail.length <= DETAIL_CHARS_MAX);
  const w = await world([{ status: 200, body: "not json" },
    ...Array(RETRY_ATTEMPTS).fill(msgError(500, "api_error", long)),
    msgError(429, "enforced_spend_limit_reached", "cap"),
    { status: 200, body: { ...msgAnswer({ text: "I will not" }), stop_reason: "refusal", stop_details: { explanation: "their own words" } } },
    { status: 200, body: msgAnswer({ text: "fine" }) }]);
  assert.ok((await w.p.turn(req(MSG))).silent);
  const five = await w.p.turn(req(MSG));
  assert.equal(five.error.class, "overload");
  assert.equal(five.error.message.length, PROVIDER_MESSAGE_CHARS_MAX);
  assert.equal((await w.p.turn(req(MSG))).limit.kind, "spend");
  const ref = await w.p.turn(req(MSG));
  assert.deepEqual([ref.refused.type, ref.refused.message], ["refusal", "their own words"]);
  assert.equal((await w.p.turn(req(MSG))).result.text, "fine");
  assert.ok((await w.p.turn(null)).refused, "a non-object request is an outcome, not a throw");
});

test("R4 the Anthropic request marks cache_control at the hinted boundary (tools, system, the resident layer's last message); control: with no hint, none", async () => {
  const w = await world([{ status: 200, body: msgAnswer({ text: "a" }) }, { status: 200, body: msgAnswer({ text: "b" }) }]);
  const tools = [{ name: "t1", description: "d", input_schema: { type: "object" } }, { name: "t2", description: "d", input_schema: { type: "object" } }];
  const messages = [{ role: "system", content: "pack" }, { role: "user", content: "resident layer" }, { role: "user", content: "the ask" }];
  await w.p.turn(req(MSG, { tools, messages, cache_hints: { boundary: 1 } }));
  const b = w.fake.requests[0].body;
  assert.deepEqual(b.tools.map((t) => !!t.cache_control), [false, true]);
  assert.ok(b.system.at(-1).cache_control);
  assert.ok(b.messages[0].content.at(-1).cache_control);
  assert.ok(!b.messages[1].content.at(-1).cache_control);
  await w.p.turn(req(MSG, { tools, messages }));
  assert.ok(!JSON.stringify(w.fake.requests[1].body).includes("cache_control"));
});

test("R5 a fake stating no cache figures yields them null and named in unstated; one stating a cost yields cost_reported with its unit and source; control: a fake stating every figure yields numbers and an empty unstated", async () => {
  const w = await world([{ status: 200, body: msgAnswer({ text: "a", usage: { input_tokens: 3, output_tokens: 4 } }) },
    { status: 200, body: msgAnswer({ text: "b", usage: { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 1, cache_creation_input_tokens: 2, reasoning_tokens: 5 } }) }]);
  const a = await w.p.turn(req(MSG));
  assert.equal(a.usage.cache_read_input_tokens, null);
  assert.deepEqual(a.usage.unstated, ["cache_read_input_tokens", "cache_creation_input_tokens", "reasoning_tokens"]);
  assert.equal(a.usage.cost_reported, null);
  const b = await w.p.turn(req(MSG));
  assert.deepEqual(TOKEN_FIGURES.map((k) => b.usage[k]), [3, 4, 1, 2, 5]);
  assert.deepEqual(b.usage.unstated, []);
  const g = await world([{ status: 200, body: genAnswer({ text: "c", cost: 0.25, model: ENTRIES.generic.served_ids[0], host: "fakeco" }) }]);
  const c = await g.p.turn(req(GEN));
  assert.deepEqual(c.usage.cost_reported, { amount: 0.25, unit: "usd", source: "provider" });
  assert.ok(c.usage.cost_estimated === null || typeof c.usage.cost_estimated.amount === "number", "kept apart, never added");
});

test("R14 an image block on an image-capable fake reaches it in the tool-result position, base64 unchanged; on one lacking it, refused naming image_input with nothing sent; control: no image, no refusal", async () => {
  const img = { type: "image", media_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUg==" };
  const messages = [{ role: "user", content: "read the page" }, { role: "assistant", content: "", tool_calls: [{ id: "c1", name: "page", input: {} }] },
    { role: "tool_result", tool_call_id: "c1", content: [img] }];
  const w = await world([{ status: 200, body: msgAnswer({ text: "seen" }) }]);
  assert.ok((await w.p.turn(req(MSG, { messages }))).result);
  const sent = w.fake.requests[0].body.messages.at(-1).content[0];
  assert.equal(sent.type, "tool_result");
  assert.equal(sent.content[0].source.data, img.data);
  const out = await w.p.turn(req(ENTRIES.noimage.entry_id, { messages }));
  assert.deepEqual([out.refused.type, out.refused.control], ["UNSUPPORTED_CONTROL", "image_input"]);
  assert.equal(w.fake.requests.length, 1);
  const g = await world([{ status: 200, body: genAnswer({ text: "x", model: ENTRIES.noimage.served_ids[0], host: "fakeco" }) }]);
  assert.ok((await g.p.turn(req(ENTRIES.noimage.entry_id))).result);
});

test("R16 an issued token reaches the Anthropic fake's request only; no outcome or event carries it; absent, ACCOUNT_REFERENCE_UNUSABLE with no call; control: a sealed key account is unchanged", async () => {
  const token = "issued-token-sentinel-abcdefghijklmnop";
  const w = await world([{ status: 400, body: { type: "error", error: { type: "invalid_request_error", message: `bad ${token}` } } },
    { status: 200, body: msgAnswer({ text: `echo ${token}` }) }, { status: 200, body: msgAnswer({ text: "k" }) }]);
  const a = account({ means: "issued", plan_id: "fakeco-signin", secret: token });
  const bad = await w.p.turn(req(MSG, { account: a }));
  const ok = await w.p.turn(req(MSG, { account: a }));
  assert.equal(w.fake.requests[0].headers["x-api-key"], token);
  assert.ok(!holds(bad, token.slice(0, 10)) && !holds(ok, token.slice(0, 10)));
  const none = await w.p.turn(req(MSG, { account: account({ means: "issued", plan_id: "fakeco-signin", secret: "" }) }));
  assert.equal(none.refused.type, "ACCOUNT_REFERENCE_UNUSABLE");
  assert.equal(w.fake.requests.length, 2);
  assert.ok((await w.p.turn(req(MSG))).result);
  assert.equal(w.fake.requests[2].headers["x-api-key"], SECRET);
});

test("R26 a fake answer with no served host, no request id and no rate-limit headers yields those fields null; a fake that throws inside the adapter yields silent; control: a fake stating them yields them", async () => {
  const w = await world([{ status: 200, body: { ...genAnswer({ text: "x" }), id: undefined } },
    { status: 200, body: genAnswer({ text: "y", model: ENTRIES.generic.served_ids[0], host: "fakeco" }),
      headers: { "x-request-id": "req-9", "x-ratelimit-remaining-requests": "7", "retry-after": "2" } }]);
  const a = await w.p.turn(req(GEN));
  assert.deepEqual(a.served, { provider: null, host: null, model_version: null, request_id: null, fingerprint: null });
  assert.deepEqual(a.limits, { remaining: null, reset_at: null, retry_after: null });
  assert.deepEqual(Object.keys(a).sort(), ["entry_id", "events", "label", "limits", "result", "served", "usage"]);
  const b = await w.p.turn(req(GEN));
  assert.deepEqual([b.served.host, b.served.model_version, b.served.request_id], ["fakeco", ENTRIES.generic.served_ids[0], "req-9"]);
  assert.deepEqual([b.limits.remaining, b.limits.retry_after], [7, 2]);
  assert.deepEqual(b.label, { provider: null, host: "fakeco", model_version: ENTRIES.generic.served_ids[0], effort: "medium", account_level: "member", owner: null });
  const throwing = { adapter_type: "openai_compatible", encode: () => ({ url: "https://api.fake.example/v1/x", method: "POST", headers: {}, body: "{}" }),
    classify: () => null, decode: () => { throw new Error("inside"); } };
  const t = await world([{ status: 200, body: {} }], { adapters: { openai_compatible: throwing } });
  assert.ok((await t.p.turn(req(GEN))).silent);
});

test("R27 each provider reason in the profile's table yields its neutral stop; an unlisted reason yields silent stop_unmapped; control: length yields result with stop length", async () => {
  const reasons = { end_turn: "end", tool_use: "tool_call", max_tokens: "length" };
  const w = await world([...Object.keys(reasons).map((r) => ({ status: 200, body: { ...msgAnswer({ text: "t" }), stop_reason: r } })),
    { status: 200, body: { ...msgAnswer({ text: "t" }), stop_reason: "pause_turn" } }]);
  for (const stop of Object.values(reasons)) assert.equal((await w.p.turn(req(MSG))).result.stop, stop);
  const u = await w.p.turn(req(MSG));
  assert.equal(u.silent.detail, "stop_unmapped");
  const g = await world([{ status: 200, body: genAnswer({ text: "x", finish: "content_filter" }) }]);
  assert.equal((await g.p.turn(req(GEN))).refused.type, "filtered");
});

test("R28 a fake echoing a reasoning blob receives it back unchanged on turn two; presented for a different entry it is absent and continuation_dropped is recorded; control: the same entry's continuation is sent", async () => {
  const w = await world([{ status: 200, body: msgAnswer({ text: "one", thinking: "sig-123" }) }, { status: 200, body: msgAnswer({ text: "two" }) },
    { status: 200, body: msgAnswer({ text: "three" }) }]);
  const first = await w.p.turn(req(MSG));
  const c = first.result.continuation;
  assert.deepEqual([c.adapter, c.entry_id], ["anthropic_messages", MSG]);
  const next = (cont) => req(MSG, { messages: [{ role: "user", content: "q" }, { role: "assistant", content: "one", continuation: cont }, { role: "user", content: "q2" }] });
  const two = await w.p.turn(next(c));
  assert.deepEqual(w.fake.requests[1].body.messages[1].content[0], c.data[0]);
  assert.ok(!two.events.some((e) => e.kind === "continuation_dropped"));
  const three = await w.p.turn(next({ ...c, entry_id: "another-entry" }));
  assert.ok(!JSON.stringify(w.fake.requests[2].body).includes("sig-123"));
  assert.ok(three.events.some((e) => e.kind === "continuation_dropped"));
});

test("R29 an effort outside the set, any effort on a dial-less entry, an image on an entry without image input and schema_output with tools where the entry cannot each refuse naming the control with nothing sent; control: each is accepted where the entry has it", async () => {
  const w = await world(Array(6).fill({ status: 200, body: genAnswer({ text: "ok" }) }));
  const tools = [{ name: "t", description: "d", input_schema: { type: "object" } }];
  const img = [{ role: "user", content: [{ type: "image", media_type: "image/png", data: "AA==" }] }];
  const refusals = [[req(GEN, { effort: "maximal" }), "effort_value"], [req(ENTRIES.dialless.entry_id, { effort: "low" }), "effort"],
    [req(ENTRIES.noimage.entry_id, { messages: img }), "image_input"], [req(GEN, { tools, output_schema: { type: "object" } }), "schema_with_tools"],
    [req(GEN, { data_handling: { ...DH, zero_retention: "required" } }), "zero_retention"]];
  for (const [r, control] of refusals) {
    const out = await w.p.turn(r);
    assert.deepEqual([out.refused?.type, out.refused?.control], ["UNSUPPORTED_CONTROL", control]);
  }
  assert.equal(w.fake.requests.length, 0);
  for (const r of [req(GEN, { effort: "high" }), req(ENTRIES.dialless.entry_id), req(GEN, { messages: img }), req(MSG, { tools, output_schema: { type: "object" } })])
    assert.ok(!(await w.p.turn(r)).refused, JSON.stringify(r.entry_id));
  assert.equal(w.fake.requests[1].body.reasoning_effort, undefined, "a dial-less entry carries no effort");
});

test("R31 provider_state forbidden sends no session key and no state flag; allowed sends it where the entry has session provider_state; required zero retention on an entry without it is refused; control: on an entry with it, sent with the host's zero-retention setting", async () => {
  const profileState = { session_field: "previous_response_id", state_flag: { store: true }, zero_retention: { zdr: true } };
  const w = await world(Array(4).fill({ status: 200, body: genAnswer({ text: "ok" }) }));
  const cat = w.cat;
  const prof = cat.profileOf("fakeco-profile");
  const withMap = { ...w.deps, catalogue: { ...cat, entryOf: (id) => cat.entryOf(id), plansOf: (o) => cat.plansOf(o),
    profileOf: (id) => (id === "fakeco-profile" ? { ...prof, mappings: profileState } : cat.profileOf(id)) } };
  const { makeProvider } = await import("../src/provider/index.mjs");
  const p = makeProvider(withMap);
  const st = ENTRIES.provstate.entry_id;
  await p.turn(req(st, { session_key: "sess-1" }));
  assert.ok(!("previous_response_id" in w.fake.requests[0].body) && !("store" in w.fake.requests[0].body));
  await p.turn(req(st, { session_key: "sess-1", data_handling: { ...DH, provider_state: "allowed" } }));
  assert.equal(w.fake.requests[1].body.previous_response_id, "sess-1");
  await p.turn(req(GEN, { session_key: "sess-1", data_handling: { ...DH, provider_state: "allowed" } }));
  assert.ok(!("previous_response_id" in w.fake.requests[2].body), "an entry answering resend_only gets no key");
  const refusedZr = await p.turn(req(GEN, { data_handling: { ...DH, zero_retention: "required" } }));
  assert.equal(refusedZr.refused.control, "zero_retention");
  await p.turn(req(ENTRIES.zr.entry_id, { data_handling: { ...DH, zero_retention: "required" } }));
  assert.equal(w.fake.requests[3].body.zdr, true);
});

test("R32 a fake answering the first attempt after its timeout and the second at once yields one outcome; both attempts carry the same key; the late answer's tool call is absent; control: no fault, one attempt", async () => {
  const late = genAnswer({ text: "late", tool_calls: [{ id: "x", name: "late_tool", input: {} }] });
  const w = await world([{ status: 200, body: late, late: true }, { status: 200, body: genAnswer({ text: "prompt" }) }, { status: 200, body: genAnswer({ text: "once" }) }]);
  w.clock.expire = 1;
  const out = await w.p.turn(req(GEN));
  assert.equal(out.result.text, "prompt");
  assert.ok(!holds(out, "late_tool"));
  assert.equal(w.fake.requests.length, 2);
  assert.equal(w.fake.requests[0].headers["idempotency-key"], "key-1");
  assert.equal(w.fake.requests[1].headers["idempotency-key"], "key-1");
  assert.equal(out.usage.calls, 2);
  assert.equal((await w.p.turn(req(GEN, { idempotency_key: "key-2" }))).result.text, "once");
  assert.equal(w.fake.requests.length, 3);
});

test("R33 a fake streaming a sentinel yields progress events not containing it, in order; a non-streaming entry yields exactly the two turn-level events and capabilities answers streaming none; control: the sentinel is in the result text", async () => {
  const sentinel = "STREAMED-SENTINEL-WORDS";
  const sse = [{ id: "s", choices: [{ index: 0, delta: { content: sentinel.slice(0, 8) } }] },
    { choices: [{ index: 0, delta: { content: sentinel.slice(8) }, finish_reason: "stop" }], usage: { prompt_tokens: 2, completion_tokens: 3 } }]
    .map((d) => `data: ${JSON.stringify(d)}\n\n`).join("") + "data: [DONE]\n\n";
  const w = await world([{ status: 200, body: sse, headers: { "content-type": "text/event-stream" } }]);
  const events = [];
  const out = await w.p.turn(req(GEN, { onProgress: (e) => events.push(e) }));
  assert.equal(out.result.text, sentinel);
  assert.equal(w.fake.requests[0].body.stream, true);
  assert.ok(!holds(events, sentinel.slice(0, 8)));
  assert.deepEqual(events.map((e) => e.kind), ["turn_started", "reading", "composing", "turn_done"]);
  assert.ok(events.every((e) => Object.keys(e).length === 1));
  const { makeProvider } = await import("../src/provider/index.mjs");
  const cat = w.cat;
  const quiet = { ...cat.entryOf(GEN), capabilities: { ...cat.entryOf(GEN).capabilities, streaming: { value: "none" } } };
  const w2 = await world([{ status: 200, body: genAnswer({ text: "plain" }) }]);
  const p2 = makeProvider({ ...w2.deps, catalogue: { entryOf: (id) => (id === GEN ? quiet : cat.entryOf(id)), profileOf: (id) => cat.profileOf(id), plansOf: (o) => cat.plansOf(o) } });
  const ev2 = [];
  await p2.turn(req(GEN, { onProgress: (e) => ev2.push(e.kind) }));
  assert.deepEqual(ev2, ["turn_started", "turn_done"]);
  assert.equal((await p2.capabilities(GEN)).streaming, "none");
  assert.ok(!("stream" in w2.fake.requests[0].body));
});

test("R36 a plan allowing only member_runtime refuses shared_worker with nothing sent; the same account marked personal is sent; control: an allowed runtime is sent", async () => {
  const w = await world(Array(2).fill({ status: 200, body: genAnswer({ text: "ok" }) }));
  const e = ENTRIES.memberonly.entry_id;
  const a = account({ plan_id: "fakeco-member" });
  const out = await w.p.turn(req(e, { account: a }));
  assert.deepEqual([out.refused.type, out.refused.field], ["RUNTIME_CONSTRAINT_UNMET", "runtime"]);
  assert.equal(w.fake.requests.length, 0);
  assert.ok((await w.p.turn(req(e, { account: { ...a, personal: true } }))).result);
  assert.ok((await w.p.turn(req(e, { account: a, runtime: "member_runtime" }))).result);
});

test("R37 a fake adapter that records what it was handed is called with neutral inputs only (no provider model string before encode); an unknown adapter type or a profile option this copy lacks is refused ADAPTER_MISSING; control: a known type is selected", async () => {
  const seen = [];
  const recorder = { adapter_type: "openai_compatible",
    encode: (neutral, entry, profile, cred) => { seen.push(neutral); return { url: "https://api.fake.example/v1/x", method: "POST", headers: {}, body: "{}" }; },
    decode: () => ({ stated: {}, served: {}, limits: {}, outcome: { result: { text: "r", tool_calls: [], stop: "end", continuation: null } } }),
    classify: () => null };
  const w = await world([{ status: 200, body: {} }], { adapters: { openai_compatible: recorder } });
  assert.ok((await w.p.turn(req(GEN))).result);
  assert.equal(seen.length, 1);
  assert.ok(!holds(seen[0], ENTRIES.generic.model), "the neutral request names no provider model");
  const none = await world([], { adapters: {} });
  assert.equal((await none.p.turn(req(GEN))).refused.type, "ADAPTER_MISSING");
  const cat = w.cat;
  const odd = { ...cat.profileOf("fakeco-profile"), quirks: ["teleport_tokens"] };
  const w3 = await world([]);
  const { makeProvider } = await import("../src/provider/index.mjs");
  const p3 = makeProvider({ ...w3.deps, catalogue: { entryOf: (id) => cat.entryOf(id), plansOf: (o) => cat.plansOf(o), profileOf: (id) => (id === "fakeco-profile" ? odd : cat.profileOf(id)) } });
  const missing = await p3.turn(req(GEN));
  assert.deepEqual([missing.refused.type, missing.refused.option], ["ADAPTER_MISSING", "quirk:teleport_tokens"]);
  assert.equal(w3.fake.requests.length, 0);
});

test("R37 at start the module registers each adapter type and profile version it serves with ai-catalogue, so its entries read served", async () => {
  const { world: catWorld } = await import("../../bio-plane/test/m/ai-catalogue/fixture.mjs");
  const { registerAdapters } = await import("../src/provider/index.mjs");
  const w = await world([]);
  const r = registerAdapters(w.cat, ["fake-messages", "fakeco-profile", "openrouter"]);
  assert.equal(r.ok, true);
  assert.ok(r.types.includes("anthropic_messages") && r.types.includes("openai_compatible"));
  assert.equal(w.cat.entryOf(MSG).needs_newer_release, false);
  const fresh = await catWorld({ adapters: false });
  assert.equal(registerAdapters(fresh.cat, []), null, "nothing to register without a profile");
});

test("R45 a fake answering from a non-vetted host, one answering a different model version, and one stating neither with host_pin required are each refused and recorded, usage kept; with off the last passes with served nulls; control: the pinned host and an accepted version are returned", async () => {
  const id = ENTRIES.generic.served_ids[0];
  const w = await world([{ status: 200, body: genAnswer({ text: "w1", host: "elsewhere", model: id }) },
    { status: 200, body: genAnswer({ text: "w2", host: "fakeco", model: "other-model" }) },
    { status: 200, body: genAnswer({ text: "w3" }) }, { status: 200, body: genAnswer({ text: "w4" }) },
    { status: 200, body: genAnswer({ text: "w5", host: "fakeco", model: id }) }]);
  const required = { ...DH, host_pin: "required" };
  const a = await w.p.turn(req(GEN, { data_handling: required }));
  assert.deepEqual([a.refused.type, a.refused.field, a.refused.expected, a.refused.got], ["PRIVACY_PIN_VIOLATION", "host", "fakeco", "elsewhere"]);
  assert.ok(!holds(a, "w1") && a.events.some((e) => e.kind === "pin_violation") && a.usage.input_tokens === 10);
  const b = await w.p.turn(req(GEN, { data_handling: required }));
  assert.deepEqual([b.refused.field, b.refused.got], ["model_version", "other-model"]);
  const c = await w.p.turn(req(GEN, { data_handling: required }));
  assert.deepEqual([c.refused.type, c.refused.got], ["PRIVACY_PIN_VIOLATION", null]);
  const d = await w.p.turn(req(GEN));
  assert.equal(d.result.text, "w4");
  assert.equal(d.served.host, null);
  assert.equal((await w.p.turn(req(GEN, { data_handling: required }))).result.text, "w5");
});

test("R46 the resolver is called once per turn, not per attempt; a reference resolving to null is class auth with the provider unreached; issued on a plan allowing only sealed is refused MEANS_NOT_ALLOWED; control: an allowed means is sent", async () => {
  const calls = [];
  const resolveCredential = async (q) => { calls.push(q); return q.means === "reference" && q.reference === "lost" ? null : SECRET; };
  const failed = [];
  const w = await world([msgError(503, "overloaded_error", "busy"), { status: 200, body: msgAnswer({ text: "ok" }) }],
    { resolveCredential, credentialFailed: (r) => failed.push(r) });
  const sealedNoSecret = account({ secret: undefined });
  delete sealedNoSecret.secret;
  const out = await w.p.turn(req(MSG, { account: sealedNoSecret }));
  assert.ok(out.result);
  assert.equal(w.fake.requests.length, 2);
  assert.equal(calls.length, 1);
  assert.equal(w.fake.requests[1].headers["x-api-key"], SECRET);
  const ref = await w.p.turn(req(MSG, { account: account({ means: "reference", reference: "lost", secret: undefined }) }));
  assert.deepEqual([ref.error.class, ref.error.detail], ["auth", "reference_unresolved"]);
  assert.equal(w.fake.requests.length, 2);
  assert.equal(failed.length, 1);
  const issued = await w.p.turn(req(MSG, { account: account({ means: "issued", plan_id: "fakeco-sealedonly" }) }));
  assert.equal(issued.refused.type, "MEANS_NOT_ALLOWED");
  assert.equal(w.fake.requests.length, 2);
});

test("R50 the fake scripts one fault per class; each yields its class, handling and outcome; provider_limit and request_rejected are never retried; auth reports op=aicredentialfailed; model_gone records its event; control: a 200 yields result", async () => {
  const failed = [];
  const w = await world([], { credentialFailed: (r) => failed.push(r), circuit: handle() });
  const run = async (steps) => { w.fake.steps.push(...steps); const before = w.fake.requests.length; const out = await w.p.turn(req(MSG)); return { out, sent: w.fake.requests.length - before }; };
  let r = await run(Array(RETRY_ATTEMPTS).fill(msgError(429, "rate_limit_error", "slow")));
  assert.deepEqual([r.out.error.class, r.sent], ["rate_limit", RETRY_ATTEMPTS]);
  r = await run([msgError(429, "enforced_spend_limit_reached", "cap")]);
  assert.deepEqual([Object.keys(r.out.limit).sort().join(), r.sent], ["kind,resets_at,scope", 1]);
  r = await run([msgError(400, "invalid_request_error", "no")]);
  assert.deepEqual([r.out.error.class, r.sent], ["request_rejected", 1]);
  r = await run([{ status: 200, body: "<html>" }]);
  assert.ok(r.out.silent);
  r = await run([{ status: 200, body: { ...msgAnswer({ text: "no" }), stop_reason: "refusal" } }]);
  assert.equal(r.out.refused.type, "refusal");
  r = await run([msgError(404, "not_found_error", "gone")]);
  assert.deepEqual([r.out.error.class, r.sent], ["model_gone", 1]);
  assert.ok(r.out.events.some((e) => e.kind === "model_gone"));
  const w2 = await world([msgError(401, "authentication_error", "revoked")], { credentialFailed: (x) => failed.push(x), circuit: handle() });
  const auth = await w2.p.turn(req(MSG));
  assert.equal(auth.error.class, "auth");
  assert.equal(w2.fake.requests.length, 1);
  assert.equal(failed.length, 1);
  assert.equal((await w2.p.health(account(), MSG)).state, "auth_failed");
  const w3 = await world([{ status: 200, body: msgAnswer({ text: "fine" }) }]);
  assert.ok((await w3.p.turn(req(MSG))).result);
});

test("R51 a 429 with a retry-after below the bound then 200 is retried after at least that wait; one above it is not waited and returns error carrying retry_after; a 4xx other than 429 is not retried; interactive turns allow fewer attempts; control: RETRY_ATTEMPTS 5xx end in error after exactly that many", async () => {
  const w = await world([{ ...msgError(429, "rate_limit_error", "wait"), headers: { "retry-after": "3" } }, { status: 200, body: msgAnswer({ text: "ok" }) }]);
  const ok = await w.p.turn(req(MSG));
  assert.ok(ok.result);
  assert.ok(w.clock.slept[0] >= 3000);
  const over = String(RETRY_AFTER_WAIT_MAX_MS / 1000 + 10);
  const w2 = await world([{ ...msgError(429, "rate_limit_error", "wait"), headers: { "retry-after": over } }]);
  const long = await w2.p.turn(req(MSG));
  assert.deepEqual([long.error.class, long.error.retry_after, w2.fake.requests.length], ["rate_limit", Number(over), 1]);
  const w3 = await world([msgError(422, "invalid_request_error", "no")]);
  await w3.p.turn(req(MSG));
  assert.equal(w3.fake.requests.length, 1);
  const w4 = await world(Array(RETRY_ATTEMPTS + 2).fill(msgError(500, "api_error", "down")));
  const five = await w4.p.turn(req(MSG));
  assert.deepEqual([five.error.class, w4.fake.requests.length], ["overload", RETRY_ATTEMPTS]);
  const w5 = await world(Array(RETRY_ATTEMPTS + 2).fill(msgError(500, "api_error", "down")));
  await w5.p.turn(req(MSG, { interactive: true }));
  assert.equal(w5.fake.requests.length, INTERACTIVE_ATTEMPTS);
});

test("R52 a spent-cap 429 yields limit with its reset time, one attempt, the circuit unchanged; a plain rate-limit 429 yields retries; control: BREAKER_FAILURES spent-cap answers do not open the circuit", async () => {
  const circuit = handle();
  const cap = { ...msgError(429, "enforced_spend_limit_reached", "spent"), headers: { "anthropic-ratelimit-tokens-reset": "2026-11-06T00:00:00Z" } };
  const w = await world(Array(BREAKER_FAILURES + 1).fill(cap), { circuit });
  const out = await w.p.turn(req(MSG));
  assert.deepEqual(out.limit, { kind: "spend", scope: "account", resets_at: "2026-11-06T00:00:00Z" });
  assert.equal(w.fake.requests.length, 1);
  for (let i = 0; i < BREAKER_FAILURES; i++) await w.p.turn(req(MSG));
  assert.notEqual((await w.p.health(account(), MSG)).state, "open");
  const w2 = await world(Array(RETRY_ATTEMPTS).fill(msgError(429, "rate_limit_error", "slow")));
  await w2.p.turn(req(MSG));
  assert.equal(w2.fake.requests.length, RETRY_ATTEMPTS);
});

test("R53 BREAKER_FAILURES counted failures open the circuit; the next call reaches the fake zero times; after the cooldown one probe reaches it and a 200 closes it; a failed probe reopens; control: one fewer failure then a success leaves it closed", async () => {
  const circuit = handle();
  const fails = Array(RETRY_ATTEMPTS).fill(msgError(500, "api_error", "down"));
  const w = await world([], { circuit });
  for (let i = 0; i < BREAKER_FAILURES; i++) { w.fake.steps.push(...fails); await w.p.turn(req(MSG)); }
  const sent = w.fake.requests.length;
  const shut = await w.p.turn(req(MSG));
  assert.equal(shut.error.class, "circuit_open");
  assert.ok(shut.error.retry_at);
  assert.equal(w.fake.requests.length, sent);
  w.clock.t += BREAKER_COOLDOWN_MS + 1;
  w.fake.steps.push(...fails);
  await w.p.turn(req(MSG));
  assert.equal(w.fake.requests.length, sent + RETRY_ATTEMPTS, "the probe reached it");
  assert.equal((await w.p.turn(req(MSG))).error.class, "circuit_open", "a failed probe reopens");
  w.clock.t += BREAKER_COOLDOWN_MS + 1;
  w.fake.steps.push({ status: 200, body: msgAnswer({ text: "back" }) });
  assert.ok((await w.p.turn(req(MSG))).result);
  assert.equal((await w.p.health(account(), MSG)).state, "ok");
  const c2 = handle();
  const w2 = await world([], { circuit: c2 });
  for (let i = 0; i < BREAKER_FAILURES - 1; i++) { w2.fake.steps.push(...fails); await w2.p.turn(req(MSG)); }
  w2.fake.steps.push({ status: 200, body: msgAnswer({ text: "ok" }) });
  assert.ok((await w2.p.turn(req(MSG))).result);
  assert.equal((await w2.p.health(account(), MSG)).state, "ok");
  const w3 = await world([]);
  assert.equal((await w3.p.health(account(), MSG)).state, "unknown", "no handle: unknown");
});

test("R54 a fake that fails once with a stated usage then succeeds yields calls 2 and summed figures; a timed-out first attempt yields figures null and calls 2; control: a refused request yields usage null", async () => {
  const w = await world([{ status: 503, body: { type: "error", error: { type: "overloaded_error", message: "x" }, usage: { input_tokens: 4, output_tokens: 0 } } },
    { status: 200, body: msgAnswer({ text: "ok", usage: { input_tokens: 6, output_tokens: 2 } }) }]);
  const a = await w.p.turn(req(MSG));
  assert.deepEqual([a.usage.calls, a.usage.input_tokens, a.usage.output_tokens], [2, 10, 2]);
  const w2 = await world([{ status: 200, body: msgAnswer({ text: "late" }), late: true }, { status: 200, body: msgAnswer({ text: "ok" }) }]);
  w2.clock.expire = 1;
  const b = await w2.p.turn(req(MSG));
  assert.deepEqual([b.usage.calls, b.usage.input_tokens], [2, null]);
  const c = await w2.p.turn(req(GEN, { effort: "nope" }));
  assert.equal(c.usage, null);
});

test("R8 a sentinel secret on each means is found in no returned value, event or console output, even when the fake echoes it; control: the broken adapter of R44 is caught (provider-profiles.test.mjs)", async () => {
  const logged = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...a) => logged.push(a.join(" "));
  try {
    const echo = (s) => [{ status: 401, body: { type: "error", error: { type: "authentication_error", message: `bad key ${s}` } }, headers: { "x-echo": s } },
      { status: 200, body: msgAnswer({ text: `you sent ${s}` }) }];
    for (const means of ["sealed", "reference"]) {
      const w = await world(echo(SECRET), { resolveCredential: async () => SECRET });
      const a = account(means === "reference" ? { means, reference: "ref-1", secret: undefined } : {});
      const outs = [await w.p.turn(req(MSG, { account: a })), await w.p.turn(req(MSG, { account: a }))];
      assert.ok(!holds(outs, SECRET.slice(0, 12)), means);
    }
    const w = await world([]);
    await w.p.turn(req(MSG, { account: undefined }));
    assert.equal(w.fake.requests.length, 0);
  } finally { Object.assign(console, orig); }
  assert.ok(!logged.some((l) => l.includes(SECRET)));
});

test("R9 with a key present in env and no account secret, every call is refused ACCOUNT_REFERENCE_UNUSABLE and nothing is sent; with both, only the account's is sent; control: the account's own secret is sent", async () => {
  const envKey = "sk-env-sentinel-ambient-0123456789";
  const env = { INSTANCE_CLAUDE_TOKEN: envKey, ANTHROPIC_API_KEY: envKey };
  const w = await world([{ status: 200, body: msgAnswer({ text: "ok" }) }], { env, bindings: env });
  const out = await w.p.turn(req(MSG, { account: account({ secret: "" }) }));
  assert.equal(out.refused.type, "ACCOUNT_REFERENCE_UNUSABLE");
  assert.equal(w.fake.requests.length, 0);
  await w.p.turn(req(MSG));
  assert.ok(!holds(w.fake.requests, envKey));
  assert.equal(w.fake.requests[0].headers["x-api-key"], SECRET);
});

test("R10 a profile whose base URL is outside its allowed hosts is refused with nothing sent; control: an allowed host is sent", async () => {
  const w = await world([{ status: 200, body: genAnswer({ text: "ok" }) }]);
  const out = await w.p.turn(req(ENTRIES.outside.entry_id));
  assert.equal(out.refused.type, "HOST_NOT_ALLOWED");
  assert.equal(w.fake.requests.length, 0);
  assert.ok((await w.p.turn(req(GEN))).result);
  assert.equal(new URL(w.fake.requests[0].url).hostname, "api.fake.example");
});

test("R11 each level with an allowed means is sent identically; an unknown level, or means none without a binding, is refused ACCOUNT_REFERENCE_UNUSABLE with no call; control: the unknown level made known is sent", async () => {
  const w = await world(Array(4).fill({ status: 200, body: msgAnswer({ text: "ok" }) }));
  for (const level of ["member", "project", "group"]) assert.ok((await w.p.turn(req(MSG, { account: account({ level }) }))).result);
  const bodies = w.fake.requests.map((r) => JSON.stringify([r.body, r.headers]));
  assert.equal(new Set(bodies).size, 1);
  assert.equal((await w.p.turn(req(MSG, { account: account({ level: "planet" }) }))).refused.type, "ACCOUNT_REFERENCE_UNUSABLE");
  const none = await w.p.turn(req(ENTRIES.workers.entry_id, { account: account({ means: "none", secret: undefined, plan_id: "fakebuiltin-plan" }) }));
  assert.equal(none.refused.type, "ACCOUNT_REFERENCE_UNUSABLE");
  assert.equal(w.fake.requests.length, 3);
});

test("R49 a fake that echoes the secret in its error body, headers and a 200 answer yields outcomes and events in which a scan finds no sentinel or long substring of it; control: a non-secret substring is kept", async () => {
  const part = SECRET.slice(5, 20);
  const w = await world([{ status: 400, body: { type: "error", error: { type: "invalid_request_error", message: `fragment ${part} keep-me` } }, headers: { "x-key": SECRET } },
    { status: 200, body: msgAnswer({ text: `whole ${SECRET} keep-me` }) }]);
  const a = await w.p.turn(req(MSG));
  const b = await w.p.turn(req(MSG));
  for (const o of [a, b]) {
    assert.ok(!holds(o, part) && !holds(o, SECRET));
    assert.ok(holds(o, "keep-me"));
    assert.ok(o.events.every((e) => Object.values(e).every((v) => typeof v !== "string" || !v.includes(part))));
  }
});
