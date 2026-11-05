/* agent-model (T53) — the world the provider-interface tests run in.
 *
 * The catalogue is `ai-catalogue`'s own: its test builders (`entry`, `plan`, `profile`, `payload`) and a copy seeded
 * through its real code (`seeded`), so every entry, plan and profile the module reads is one `ai-catalogue` accepted.
 * The made-up providers and hosts are `fakeco` (direct), `fakeroute` (an aggregator), `fakegate` (a gateway),
 * `fakebuiltin` and `fakelocal`. The provider at the other end is the module's own scripted fake (R44). */

import { entry, plan, profile, payload, provider, seeded, claim, OPEN, ev } from "../../bio-plane/test/m/ai-catalogue/fixture.mjs";
import { fakeProvider } from "../src/provider/kit.mjs";
import { makeProvider } from "../src/provider/index.mjs";

export { fakeProvider, claim, OPEN };

export const SECRET = "sk-sentinel-0123456789abcdefghijklmnop";
export const MSG = "messages_fake";
export const GEN = "openai_compatible";

export const PROFILES = {
  messages: profile({ id: "fake-messages", adapter_type: "anthropic_messages", base_url: "https://api.fakeco.example/v1",
    allowed_hosts: ["api.fakeco.example"], auth_style: "header:x-api-key", idempotency: "honoured", reasoning_billing: "in_output" }),
  generic: profile({ id: "fakeco-profile", adapter_type: GEN, idempotency: "honoured",
    served_report: { host: "provider", model: "model" } }),
  generic2: profile({ id: "fakeco-other", adapter_type: GEN, base_url: "https://other.fake.example/v2", allowed_hosts: ["other.fake.example"],
    auth_style: "header:x-fake-key", mappings: { max_output_field: "max_completion_tokens", path: "/complete",
      usage: { input_tokens: "usage.in", output_tokens: "usage.out" } } }),
  openrouter: profile({ id: "openrouter", adapter_type: GEN, base_url: "https://route.fake.example/api/v1", allowed_hosts: ["route.fake.example"],
    pin_map: { field: "provider", only: "only", allow_fallbacks: "allow_fallbacks", deny_collection: { field: "data_collection", value: "deny" },
      zero_retention: "zdr", require_parameters: "require_parameters" }, served_report: { host: "provider", model: "model" } }),
  workers_ai: profile({ id: "workers_ai", adapter_type: GEN, base_url: "https://ai.fake.example/v1", allowed_hosts: ["ai.fake.example"],
    auth_style: "binding" }),
  ai_gateway: profile({ id: "ai_gateway", adapter_type: GEN, base_url: "https://gw.fake.example/v1/compat", allowed_hosts: ["gw.fake.example"],
    auth_style: "bearer" }),
  custom: profile({ id: "custom", adapter_type: GEN, base_url: "https://local.fake.example/v1", allowed_hosts: ["local.fake.example"] }),
  outside: profile({ id: "fakeco-outside", adapter_type: GEN, base_url: "https://evil.fake.example/v1", allowed_hosts: ["api.fake.example"] }),
};

const gen = (id, over = {}) => entry(id, { adapter_type: GEN, profile: { id: "fakeco-profile", min_version: 1 }, ...over });
const caps = (over) => ({ ...entry("x").capabilities, ...over });

export const ENTRIES = {
  messages: entry("msg-one", { plan_ids: ["fakeco-api", "fakeco-signin", "fakeco-sealedonly"], adapter_type: "anthropic_messages", profile: { id: "fake-messages", min_version: 1 },
    capabilities: caps({ caching: claim("explicit"), schema_with_tools: claim(true) }), zero_retention: claim(true) }),
  generic: gen("gen-one"),
  generic2: gen("gen-two", { profile: { id: "fakeco-other", min_version: 1 } }),
  noimage: gen("gen-noimage", { capabilities: caps({ image_input: claim(false) }) }),
  openimage: gen("gen-openimage", { capabilities: caps({ image_input: OPEN }) }),
  dialless: gen("gen-dialless", { effort_set: { values: [], default: null, ev: ev() }, effort_classes: undefined }),
  lohi: gen("gen-lohi", { effort_set: { values: ["lo", "hi"], default: "hi", ev: ev() }, effort_classes: { low: "lo", medium: "hi", ev: ev() } }),
  cheap: gen("gen-cheap", { prices: { unit: "usd_per_million_tokens", input: 0.1, output: 0.2, cache_read: 0.01, cache_write: null, date: "2026-10-01", ev: ev() } }),
  measured: gen("gen-measured", { standard_task_costs: { unit: "usd", price_date: "2026-10-01", by_part: { ask: { low: 0.02, high: 0.05 } }, ev: ev() } }),
  unpriced: gen("gen-unpriced", { prices: OPEN }),
  retired: gen("gen-retired", { lifecycle: "retired" }),
  provstate: gen("gen-state", { capabilities: caps({ session: claim("provider_state") }) }),
  zr: gen("gen-zr", { zero_retention: claim(true) }),
  routed: entry("route-one", { host: "fakeroute", plan_ids: ["fakeroute-api"], adapter_type: GEN, profile: { id: "openrouter", min_version: 1 },
    zero_retention: claim(true), served_ids: ["fake-model-route-one"],
    pin: { only: ["fakeco"], allow_fallbacks: false, deny_collection: true, require_parameters: true, zero_retention: true } }),
  workers: entry("builtin-one", { host: "fakebuiltin", plan_ids: ["fakebuiltin-plan"], adapter_type: GEN, profile: { id: "workers_ai", min_version: 1 } }),
  gateway: entry("gw-one", { host: "fakegate", plan_ids: ["fakegate-plan"], adapter_type: GEN, profile: { id: "ai_gateway", min_version: 1 },
    pin: { only: ["fakeco"], allow_fallbacks: false, deny_collection: true, require_parameters: true } }),
  custom: entry("local-one", { host: "fakelocal", plan_ids: ["fakelocal-plan"], adapter_type: GEN, profile: { id: "custom", min_version: 1 }, lifecycle: "lapsed", characterization: undefined }),
  customListed: entry("local-listed", { host: "fakelocal", plan_ids: ["fakelocal-plan"], adapter_type: GEN, profile: { id: "custom", min_version: 1 } }),
  outside: gen("gen-outside", { profile: { id: "fakeco-outside", min_version: 1 } }),
  memberonly: gen("gen-memberrt", { plan_ids: ["fakeco-member"] }),
};

export const PLANS = [
  plan("fakeco-api", { means_allowed: claim(["gateway", "sealed", "reference"]), runtimes: claim(["shared_worker", "member_runtime"]) }),
  plan("fakeco-member", { runtimes: claim(["member_runtime"]), means_allowed: claim(["sealed"]) }),
  plan("fakeco-sealedonly", { means_allowed: claim(["sealed"]) }),
  plan("fakeco-signin", { credential_kind: "signin_token", connection_ways: ["provider_signin"], means_allowed: claim(["issued", "sealed"]) }),
  plan("fakeroute-api", { provider: "fakeroute", kind: "aggregator", means_allowed: claim(["sealed"]) }),
  plan("fakebuiltin-plan", { provider: "fakebuiltin", kind: "builtin", credential_kind: "none", means_allowed: claim(["none"]) }),
  plan("fakegate-plan", { provider: "fakegate", kind: "gateway", means_allowed: claim(["gateway", "sealed"]) }),
  plan("fakelocal-plan", { provider: "fakelocal", kind: "custom", means_allowed: claim(["sealed"]) }),
];

let cached = null;
/** The seeded catalogue (once per process: the catalogue is read only). */
export async function catalogue() {
  if (cached) return cached;
  const doc = payload({
    providers: [provider("fakeco"), provider("fakeroute", "aggregator"), provider("fakegate", "gateway"), provider("fakebuiltin", "builtin"),
      provider("fakelocal", "custom")],
    profiles: Object.values(PROFILES), plans: PLANS, entries: Object.values(ENTRIES).map((e) => JSON.parse(JSON.stringify(e))),
  });
  const w = await seeded(doc);
  cached = w.cat;
  return cached;
}

export const DH = Object.freeze({ zero_retention: "off", host_pin: "off", provider_state: "forbidden" });
export const account = (over = {}) => ({ account_id: "acct-1", level: "member", means: "sealed", secret: SECRET, plan_id: "fakeco-api", ...over });
export const req = (entry_id, over = {}) => ({ account: account(), entry_id, messages: [{ role: "system", content: "system words" },
  { role: "user", content: "a question" }], max_output: 100, timeout_ms: 1000, idempotency_key: "key-1", runtime: "shared_worker",
  data_handling: DH, ...over });

export const handle = () => { const m = new Map(); return { m, get: (k) => m.get(k), put: (k, v) => { m.set(k, v); } }; };

/** A provider bound to the seeded catalogue and a fake (or the fetch given). */
export async function world(script = [], over = {}) {
  const cat = await catalogue();
  const fake = fakeProvider(script);
  /* the turn's time bound fires only for the attempts a test names in `clock.expire` (a count), else never */
  const clock = { t: Date.parse("2026-11-05T10:00:00Z"), slept: [], expire: 0 };
  const deps = { catalogue: cat, fetch: fake.fetch, now: () => clock.t, sleep: async (ms) => { clock.slept.push(ms); clock.t += ms; },
    timeout: () => (clock.expire > 0 ? (clock.expire -= 1, Promise.resolve()) : new Promise(() => {})), random: () => 0.5, ...over };
  return { cat, fake, clock, deps, p: makeProvider(deps) };
}

/* ------------------------------------------------------------------ provider answers, in each provider's own shape */

export const msgAnswer = ({ text = "", tool_calls = [], usage = { input_tokens: 10, output_tokens: 5 }, stop = null, model = "fake-model-msg-one", thinking } = {}) => ({
  id: "msg_1", type: "message", role: "assistant", model,
  content: [...(thinking ? [{ type: "thinking", thinking: "t", signature: thinking }] : []), ...(text ? [{ type: "text", text }] : []),
    ...tool_calls.map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.input }))],
  stop_reason: stop ?? (tool_calls.length ? "tool_use" : "end_turn"), ...(usage ? { usage } : {}) });
export const msgError = (status, type, message) => ({ status, body: { type: "error", error: { type, message } } });

export const genAnswer = ({ text = "", tool_calls = [], usage = { prompt_tokens: 10, completion_tokens: 5 }, finish = null, model, host, reasoning, cost } = {}) => ({
  id: "gen_1", model, ...(host ? { provider: host } : {}),
  choices: [{ index: 0, message: { role: "assistant", content: text, ...(tool_calls.length ? { tool_calls: tool_calls.map((t) => ({ id: t.id, type: "function",
    function: { name: t.name, arguments: JSON.stringify(t.input) } })) } : {}), ...(reasoning ? { reasoning_details: reasoning } : {}) },
  finish_reason: finish ?? (tool_calls.length ? "tool_calls" : "stop") }], ...(usage ? { usage: { ...usage, ...(cost != null ? { cost } : {}) } } : {}) });
export const genError = (status, code, message) => ({ status, body: { error: { code, message } } });

/** The R44 fakes for the two adapters. */
export const MSG_FAKE = (entryRow) => ({ entry: entryRow,
  answer: ({ text, tool_calls, usage, served } = {}) => msgAnswer({ text, tool_calls: tool_calls || [], usage: usage === undefined ? { input_tokens: 1, output_tokens: 1 } : usage,
    model: served?.model ?? entryRow.served_ids[0] }),
  error: msgError, spentCap: () => msgError(429, "enforced_spend_limit_reached", "spent"),
  refusal: (words) => ({ ...msgAnswer({ text: words }), stop_reason: "refusal" }),
  golden: (b) => b.model === entryRow.model && b.max_tokens === 100 && b.system?.[0]?.text === "kit system" && b.messages?.[0]?.role === "user"
    && b.tools?.[0]?.input_schema?.type === "object" });
export const GEN_FAKE = (entryRow) => ({ entry: entryRow,
  answer: ({ text, tool_calls, usage, served } = {}) => genAnswer({ text, tool_calls: tool_calls || [],
    usage: usage === undefined ? { prompt_tokens: 1, completion_tokens: 1 } : usage === null ? null : { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens },
    model: served?.model ?? entryRow.served_ids[0], host: served?.host ?? entryRow.host }),
  error: genError, spentCap: () => genError(402, "insufficient_credits", "spent"),
  refusal: (words) => ({ ...genAnswer({ text: words }), choices: [{ index: 0, message: { role: "assistant", content: words, refusal: words }, finish_reason: "stop" }] }),
  golden: (b) => b.model === entryRow.model && b.max_tokens === 100 && b.messages?.[0]?.role === "system" && b.tools?.[0]?.function?.parameters?.type === "object" });
