/* agent-model (T53, R44) — THE ADAPTER TEST KIT and THE FAKE PROVIDER.
 *
 * `fakeProvider(script)` is a scripted server: each request is recorded (url, headers, parsed body) and answered by
 * the next script step `{status, body, headers, late}` (`late: true` holds the answer until a later request arrives,
 * so the caller's timeout abandons it). `adapterKit(adapter, profile, fake)` runs one adapter through every check R44
 * names and answers `{pass, checks: {name: {ok, detail}}}`. The `fake` describes the provider's own shapes: `entry` (a
 * catalogue entry of the adapter's type), `answer({text, tool_calls, usage, served})` and `error(status, code, message)`
 * in the provider's answer shape, `spentCap()`, `refusal(words)`, `golden(body)` (true when a request body maps the
 * kit's neutral request), and `sseBody?`. */

import { turn } from "./turn.mjs";
import { TOKEN_FIGURES } from "./neutral.mjs";

export const KIT_SECRET = "kit-sentinel-secret-0123456789abcdef";
export const KIT_CHECKS = Object.freeze(["mapping", "error_classes", "usage_null", "no_secret", "unsupported_control",
  "host_pin", "idempotent_retry"]);

/** A scripted provider. `fetch` answers each request with the next step; `requests` records what it received. */
export function fakeProvider(script = []) {
  const steps = [...script];
  const requests = [];
  const held = [];
  const fetch = async (url, init = {}) => {
    let body = null;
    try { body = JSON.parse(init.body); } catch { body = init.body ?? null; }
    requests.push({ url, headers: { ...(init.headers || {}) }, body });
    while (held.length) held.shift()();
    const step = steps.length ? steps.shift() : { status: 200, body: {} };
    const respond = () => new Response(typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? null),
      { status: step.status ?? 200, headers: { "content-type": "application/json", ...(step.headers || {}) } });
    if (step.late) return new Promise((resolve) => { held.push(() => resolve(respond())); });
    return respond();
  };
  return { fetch, requests, steps };
}

const ACCOUNT = Object.freeze({ account_id: "kit-account", level: "member", means: "sealed", secret: KIT_SECRET });
const DH = Object.freeze({ zero_retention: "off", host_pin: "off", provider_state: "forbidden" });
export const KIT_TOOL = Object.freeze({ name: "kit_tool", description: "a kit tool",
  input_schema: Object.freeze({ type: "object", properties: Object.freeze({ q: Object.freeze({ type: "string" }) }) }) });
const request = (fake, over = {}) => ({ account: ACCOUNT, entry_id: fake.entry.entry_id, messages: [
  { role: "system", content: "kit system" }, { role: "user", content: "kit question" }], tools: [KIT_TOOL],
  max_output: 100, timeout_ms: 1000, idempotency_key: "kit-key", runtime: "shared_worker", data_handling: DH, ...over });

function depsFor(adapter, profile, fake, provider, entry = fake.entry) {
  return { catalogue: { entryOf: (id) => (id === entry.entry_id ? entry : null), profileOf: (id) => (id === profile.id ? profile : null),
    plansOf: () => [] }, adapters: { [adapter.adapter_type]: adapter }, fetch: provider.fetch, sleep: async () => {}, timeout: () => new Promise(() => {}), random: () => 0.5 };
}
const response = (step, profile, entry) => ({ status: step.status ?? 200, headers: { "content-type": "application/json", ...(step.headers || {}) },
  text: typeof step.body === "string" ? step.body : JSON.stringify(step.body ?? null), profile, entry });

const holds = (value, needle) => { try { return JSON.stringify(value).includes(needle); } catch { return true; } };

/** R44: every check, for one adapter. */
export async function adapterKit(adapter, profile, fake) {
  const checks = {};
  const record = (name, ok, detail = null) => { checks[name] = { ok: !!ok, detail }; };
  const entry = fake.entry;
  const tryIt = async (name, fn) => { try { await fn(); } catch (e) { record(name, false, String(e?.message ?? e)); } };

  await tryIt("mapping", async () => {
    const p = fakeProvider([{ status: 200, body: fake.answer({ text: "kit answer", tool_calls: [{ id: "t1", name: "kit_tool", input: { q: "x" } }],
      usage: { input_tokens: 3, output_tokens: 4 } }) }]);
    const out = await turn(request(fake), depsFor(adapter, profile, fake, p));
    const ok = p.requests.length === 1 && fake.golden(p.requests[0].body) && !!out.result && out.result.text === "kit answer"
      && out.result.tool_calls.length === 1 && out.result.tool_calls[0].name === "kit_tool" && out.result.tool_calls[0].input.q === "x";
    record("mapping", ok, ok ? null : JSON.stringify(out).slice(0, 200));
  });

  await tryIt("error_classes", async () => {
    const cases = [["rate_limit", fake.error(429, "rate_limit_error", "slow down")], ["provider_limit", fake.spentCap()],
      ["overload", fake.error(500, "api_error", "busy")], ["auth", fake.error(401, "authentication_error", "no")],
      ["model_gone", fake.error(404, "not_found_error", "gone")], ["request_rejected", fake.error(400, "invalid_request_error", "bad")],
      ["malformed", { status: 200, body: "not json" }], ["content_refusal", { status: 200, body: fake.refusal("I will not") }]];
    const wrong = cases.filter(([cls, step]) => adapter.classify(response(step, profile, entry)) !== cls).map(([c]) => c);
    if (adapter.classify({ fault: "timeout" }) !== "timeout") wrong.push("timeout");
    record("error_classes", !wrong.length, wrong.join(",") || null);
  });

  await tryIt("usage_null", async () => {
    const d = adapter.decode(response({ status: 200, body: fake.answer({ text: "x", usage: null }) }, profile, entry));
    const zeroed = TOKEN_FIGURES.filter((k) => d?.stated?.[k] === 0);
    const p = fakeProvider([{ status: 200, body: fake.answer({ text: "x", usage: null }) }]);
    const out = await turn(request(fake), depsFor(adapter, profile, fake, p));
    const nulls = out.usage && TOKEN_FIGURES.every((k) => out.usage[k] === null && out.usage.unstated.includes(k));
    record("usage_null", !zeroed.length && nulls, zeroed.join(",") || (nulls ? null : "figures not null"));
  });

  await tryIt("no_secret", async () => {
    /* what the adapter itself returns, with a provider that never echoes the secret, must not hold it */
    const enc = adapter.encode({ messages: request(fake).messages, max_output: 10, idempotency_key: "k" }, entry, profile, { secret: KIT_SECRET, means: "sealed" });
    const own = [adapter.decode(response(fake.error(400, "invalid_request_error", "plain"), profile, entry)),
      adapter.decode(response({ status: 200, body: fake.answer({ text: "plain" }) }, profile, entry))];
    const leaksOwn = own.some((v) => holds(v, KIT_SECRET));
    const p = fakeProvider([{ status: 400, body: fake.error(400, "invalid_request_error", `echo ${KIT_SECRET}`).body, headers: { "x-echo": KIT_SECRET } },
      { status: 200, body: fake.answer({ text: `echo ${KIT_SECRET}` }) }]);
    const a = await turn(request(fake), depsFor(adapter, profile, fake, p));
    const b = await turn(request(fake), depsFor(adapter, profile, fake, p));
    const inBody = holds(enc.body ?? "", KIT_SECRET);
    const ok = !leaksOwn && !inBody && !holds(a, KIT_SECRET.slice(0, 12)) && !holds(b, KIT_SECRET.slice(0, 12));
    record("no_secret", ok, ok ? null : leaksOwn ? "adapter output" : inBody ? "request body" : "outcome");
  });

  await tryIt("unsupported_control", async () => {
    const lacking = { ...entry, capabilities: { ...entry.capabilities, image_input: { value: false } } };
    const p = fakeProvider([]);
    const out = await turn(request(fake, { messages: [{ role: "user", content: [{ type: "image", media_type: "image/png", data: "AAAA" }] }] }),
      depsFor(adapter, profile, fake, p, lacking));
    const ok = out.refused?.type === "UNSUPPORTED_CONTROL" && out.refused.control === "image_input" && p.requests.length === 0;
    record("unsupported_control", ok, ok ? null : JSON.stringify(out.refused ?? out).slice(0, 120));
  });

  await tryIt("host_pin", async () => {
    const p = fakeProvider([{ status: 200, body: fake.answer({ text: "x", served: { host: "elsewhere", model: "other-model" } }) }]);
    const out = await turn(request(fake, { data_handling: { ...DH, host_pin: "required" } }), depsFor(adapter, profile, fake, p));
    const ok = out.refused?.type === "PRIVACY_PIN_VIOLATION" && out.events.some((e) => e.kind === "pin_violation") && !holds(out, "\"x\"");
    record("host_pin", ok, ok ? null : JSON.stringify(out.refused ?? out.result ?? out).slice(0, 120));
  });

  await tryIt("idempotent_retry", async () => {
    const p = fakeProvider([{ status: 503, body: fake.error(503, "overloaded_error", "busy").body }, { status: 200, body: fake.answer({ text: "ok" }) }]);
    const out = await turn(request(fake), depsFor(adapter, profile, fake, p));
    const keys = p.requests.map((r) => JSON.stringify(Object.entries(r.headers).filter(([k]) => /idempotency/i.test(k))));
    const ok = !!out.result && p.requests.length === 2 && keys[0] === keys[1] && out.usage.calls === 2;
    record("idempotent_retry", ok, ok ? null : `${p.requests.length} requests`);
  });

  return { pass: KIT_CHECKS.every((c) => checks[c]?.ok), checks };
}
