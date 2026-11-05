/* agent-model (T53) — the adapters and host profiles at the module's interface: the generic OpenAI-compatible adapter
 * and its profiles (R38–R42), the Anthropic adapter behind the same contract (R43), the adapter test kit (R44, R8's
 * control), and the gateway's payer check (R47, R48). Catalogue: `ai-catalogue`'s own, seeded through its code; the
 * provider and gateway are the module's scripted fake (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { world, req, account, ENTRIES, PROFILES, genAnswer, genError, msgAnswer, handle, DH, SECRET, MSG_FAKE, GEN_FAKE, fakeProvider } from "./provider-world.mjs";
import { adapterKit, KIT_CHECKS } from "../src/provider/kit.mjs";
import { anthropicAdapter } from "../src/provider/adapters/anthropic.mjs";
import { openaiAdapter } from "../src/provider/adapters/openai.mjs";
import { payerReset } from "../src/provider/index.mjs";
import { circuitReset } from "../src/health.mjs";
import { LOG_REREADS } from "../src/provider/params.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const holds = (v, s) => JSON.stringify(v).includes(s);
const GEN = ENTRIES.generic.entry_id;

test("R38 two fake profiles over one fake server (different base URL, auth style and field names) yield the same neutral outcome for the same request; a profile with a mapping this adapter lacks is refused; control: the first profile's request body differs from the second's", async () => {
  const w = await world([{ status: 200, body: genAnswer({ text: "same", tool_calls: [{ id: "c", name: "t", input: { a: 1 } }], usage: { prompt_tokens: 4, completion_tokens: 2 } }) },
    { status: 200, body: { ...genAnswer({ text: "same", tool_calls: [{ id: "c", name: "t", input: { a: 1 } }], usage: null }), usage: { in: 4, out: 2 } } }]);
  const a = await w.p.turn(req(GEN));
  const b = await w.p.turn(req(ENTRIES.generic2.entry_id));
  assert.deepEqual(a.result, b.result);
  assert.deepEqual([a.usage.input_tokens, a.usage.output_tokens], [b.usage.input_tokens, b.usage.output_tokens]);
  const [r1, r2] = w.fake.requests;
  assert.notDeepEqual(r1.body, r2.body);
  assert.equal(r1.body.max_tokens, 100);
  assert.equal(r2.body.max_completion_tokens, 100);
  assert.equal(r1.headers.authorization, `Bearer ${SECRET}`);
  assert.equal(r2.headers["x-fake-key"], SECRET);
  assert.ok(r2.url.startsWith("https://other.fake.example/v2/complete"));
  const cat = w.cat;
  const { makeProvider } = await import("../src/provider/index.mjs");
  const odd = { ...cat.profileOf("fakeco-profile"), mappings: { teleport_field: "x" } };
  const w2 = await world([]);
  const p2 = makeProvider({ ...w2.deps, catalogue: { entryOf: (id) => cat.entryOf(id), plansOf: (o) => cat.plansOf(o), profileOf: (id) => (id === "fakeco-profile" ? odd : cat.profileOf(id)) } });
  assert.equal((await p2.turn(req(GEN))).refused.type, "ADAPTER_MISSING");
  assert.equal(w2.fake.requests.length, 0);
});

test("R39 profile openrouter: each request carries the pin only the vetted provider, allow_fallbacks false, data_collection deny, zdr where the entry has zero retention and require_parameters true; an answer from another host is refused, and a pinned host made unavailable answering from another is refused, not returned; control: an answer naming the pinned host is returned", async () => {
  const id = ENTRIES.routed.served_ids[0];
  const a = account({ plan_id: "fakeroute-api" });
  const w = await world([{ status: 200, body: genAnswer({ text: "ok", host: "fakeco", model: id }) },
    { status: 200, body: genAnswer({ text: "elsewhere", host: "fakeother", model: id }) },
    { status: 200, body: genAnswer({ text: "fell through", host: "fakeother", model: id }) }]);
  const ok = await w.p.turn(req(ENTRIES.routed.entry_id, { account: a, data_handling: { ...DH, host_pin: "required" } }));
  assert.equal(ok.result.text, "ok");
  assert.deepEqual(w.fake.requests[0].body.provider, { only: ["fakeco"], allow_fallbacks: false, data_collection: "deny", zdr: true, require_parameters: true });
  const other = await w.p.turn(req(ENTRIES.routed.entry_id, { account: a }));
  assert.deepEqual([other.refused.type, other.refused.got], ["PRIVACY_PIN_VIOLATION", "fakeother"]);
  const fell = await w.p.turn(req(ENTRIES.routed.entry_id, { account: a, data_handling: { ...DH, host_pin: "required" } }));
  assert.equal(fell.refused.type, "PRIVACY_PIN_VIOLATION");
  assert.ok(!holds(fell, "fell through"));
});

test("R40 profile workers_ai: no credential is read or sent; the call goes through the binding the account names; a binding answering no usage yields usage null with unstated naming them; control: a binding stating usage yields numbers", async () => {
  const fake = fakeProvider([{ status: 200, body: genAnswer({ text: "a", usage: null }) }, { status: 200, body: genAnswer({ text: "b" }) }]);
  const resolved = [];
  const w = await world([], { bindings: { AI: { fetch: fake.fetch } }, resolveCredential: async (q) => { resolved.push(q); return SECRET; } });
  const a = account({ means: "none", secret: undefined, binding: "AI", plan_id: "fakebuiltin-plan" });
  delete a.secret;
  const one = await w.p.turn(req(ENTRIES.workers.entry_id, { account: a }));
  assert.equal(one.result.text, "a");
  assert.ok(one.usage.unstated.includes("input_tokens") && one.usage.input_tokens === null);
  assert.equal(fake.requests[0].headers.authorization, undefined);
  assert.equal(resolved.length, 0);
  assert.equal(w.fake.requests.length, 0, "nothing went by the shared fetch");
  const two = await w.p.turn(req(ENTRIES.workers.entry_id, { account: a }));
  assert.deepEqual([two.usage.input_tokens, two.usage.output_tokens], [10, 5]);
});

const gatewayWorld = async (logs, script, over = {}) => {
  const fake = fakeProvider(script);
  const served = [];
  const binding = { fetch: async (url, init) => {
      const r = await fake.fetch(url, init);
      const id = `log-${fake.requests.length}`;
      const h = new Headers(r.headers);
      if (!over.loggingOff) h.set("cf-aig-log-id", id);
      return new Response(await r.text(), { status: r.status, headers: h });
    }, getLog: async (id) => logs[id] ?? null };
  const circuit = handle();
  const w = await world([], { bindings: { GW: binding, GW2: over.second ?? binding }, circuit, gatewayServed: (r) => served.push(r), ...over.deps });
  return { ...w, gw: fake, served, circuit };
};
const gwAccount = (over = {}) => { const a = account({ means: "gateway", gateway_id: "gw-a", binding: "GW", plan_id: "fakegate-plan", ...over }); delete a.secret; return a; };
const OWN = { byok: "default", wholesale: false, gateway_id: "gw-a", cost: { amount: 0.5, unit: "usd" } };

test("R41 profile ai_gateway: under means gateway the fake gateway sees no Authorization header (a fake that would use a sent key proves it); under sealed it sees the key in the profile's header only; control: a gateway request carrying a key header would be answered with the sent key", async () => {
  const id = ENTRIES.gateway.served_ids[0];
  const keyed = (init) => (init.headers.authorization ? genAnswer({ text: "used the sent key", host: "fakeco", model: id }) : genAnswer({ text: "used the stored key", host: "fakeco", model: id }));
  const w = await gatewayWorld({ "log-1": OWN, "log-2": OWN }, []);
  const realFetch = w.gw.fetch;
  w.gw.steps.push({ status: 200, body: genAnswer({ text: "x" }) }, { status: 200, body: genAnswer({ text: "y" }) });
  const out = await w.p.turn(req(ENTRIES.gateway.entry_id, { account: gwAccount() }));
  assert.equal(w.gw.requests[0].headers.authorization, undefined);
  assert.ok(!Object.values(w.gw.requests[0].headers).some((v) => String(v).includes(SECRET)));
  assert.equal(keyed({ headers: w.gw.requests[0].headers }).choices[0].message.content, "used the stored key");
  assert.ok(out.result);
  const sealed = account({ means: "sealed", gateway_id: "gw-a", binding: "GW", plan_id: "fakegate-plan" });
  await w.p.turn(req(ENTRIES.gateway.entry_id, { account: sealed }));
  assert.equal(w.gw.requests[1].headers.authorization, `Bearer ${SECRET}`);
  assert.equal(keyed({ headers: w.gw.requests[1].headers }).choices[0].message.content, "used the sent key", "control");
  assert.ok(realFetch);
});

test("R47 a gateway log stating the account's own stored key returns the answer; one stating Cloudflare credits (or an unreadable log) returns its answer, records the event, flags it through op=aigatewayserved, and the next turn is refused PAYER_NOT_VERIFIED with the gateway unreached; control: after the clear and reset a verified call leaves the pair ok", async () => {
  const id = ENTRIES.gateway.served_ids[0];
  const answer = (t) => ({ status: 200, body: genAnswer({ text: t, host: "fakeco", model: id, usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
  const w = await gatewayWorld({ "log-1": OWN, "log-2": { byok: null, wholesale: true, gateway_id: "gw-a" }, "log-3": OWN }, [answer("own"), answer("credits"), answer("again")]);
  const a = gwAccount();
  const e = ENTRIES.gateway.entry_id;
  const one = await w.p.turn(req(e, { account: a }));
  assert.equal(one.result.text, "own");
  assert.deepEqual(one.usage.cost_reported, { amount: 0.5, unit: "usd", source: "gateway_log" });
  assert.equal(w.served.length, 0);
  const two = await w.p.turn(req(e, { account: a }));
  assert.equal(two.result.text, "credits", "the answer is kept");
  assert.ok(two.events.some((x) => x.kind === "payer_unverified"));
  assert.deepEqual(w.served[0], { gateway_id: "gw-a", own_key_served: false, platform_credits_used: true });
  assert.equal((await w.p.health(a, e)).state, "payer_unverified");
  const three = await w.p.turn(req(e, { account: a }));
  assert.equal(three.refused.type, "PAYER_NOT_VERIFIED");
  assert.equal(w.gw.requests.length, 2);
  await payerReset(w.circuit, a);
  await circuitReset(w.circuit, a, e);
  assert.equal((await w.p.turn(req(e, { account: a }))).result.text, "again");
  assert.equal((await w.p.health(a, e)).state, "ok");
  const u = await gatewayWorld({}, [answer("unread")]);
  const unread = await u.p.turn(req(e, { account: a }));
  assert.equal(unread.result.text, "unread");
  assert.ok(unread.events.some((x) => x.kind === "payer_unverified"));
  assert.equal(u.clock.slept.length, LOG_REREADS);
  const off = await gatewayWorld({}, [answer("nolog")], { loggingOff: true });
  const first = await off.p.turn(req(e, { account: a }));
  assert.equal(first.refused.type, "PAYER_NOT_VERIFIED");
  assert.ok(!holds(first, "nolog"));
});

test("R48 two accounts on two gateways each reach their own; a log naming another gateway is payer_unverified; a gateway account without a gateway_id is ACCOUNT_REFERENCE_UNUSABLE; control: a log naming the account's gateway verifies", async () => {
  const id = ENTRIES.gateway.served_ids[0];
  const answer = (t) => ({ status: 200, body: genAnswer({ text: t, host: "fakeco", model: id }) });
  const second = fakeProvider([answer("from gw-b")]);
  const secondBinding = { fetch: async (url, init) => { const r = await second.fetch(url, init); const h = new Headers(r.headers); h.set("cf-aig-log-id", "b-1"); return new Response(await r.text(), { status: r.status, headers: h }); },
    getLog: async () => ({ byok: "default", wholesale: false, gateway_id: "gw-b" }) };
  const w = await gatewayWorld({ "log-1": OWN, "log-2": { ...OWN, gateway_id: "gw-b" } }, [answer("from gw-a"), answer("wrong log")], { second: secondBinding });
  const e = ENTRIES.gateway.entry_id;
  const a = await w.p.turn(req(e, { account: gwAccount() }));
  const b = await w.p.turn(req(e, { account: gwAccount({ account_id: "acct-2", gateway_id: "gw-b", binding: "GW2" }) }));
  assert.deepEqual([a.result.text, b.result.text], ["from gw-a", "from gw-b"]);
  assert.ok(!a.events.length && !b.events.length);
  assert.equal(second.requests.length, 1);
  const wrong = await w.p.turn(req(e, { account: gwAccount() }));
  assert.ok(wrong.events.some((x) => x.kind === "payer_unverified"));
  const noId = await w.p.turn(req(e, { account: gwAccount({ account_id: "acct-3", gateway_id: undefined }) }));
  assert.equal(noId.refused.type, "ACCOUNT_REFERENCE_UNUSABLE");
});

test("R42 profile custom is usable only through the test flow until listed: refused ENTRY_NOT_LISTED without the flag, sent with it; a declared plan handed whole needs the flag; control: a listed entry on any profile needs no flag", async () => {
  const w = await world(Array(4).fill({ status: 200, body: genAnswer({ text: "ok" }) }));
  const a = account({ plan_id: "fakelocal-plan" });
  const e = ENTRIES.custom.entry_id;
  assert.equal((await w.p.turn(req(e, { account: a }))).refused.type, "ENTRY_NOT_LISTED");
  assert.equal(w.fake.requests.length, 0);
  assert.ok((await w.p.turn(req(e, { account: a, test_flow: true }))).result);
  const declared = { ...w.cat.entryOf(ENTRIES.customListed.entry_id), entry_id: "declared-1", host_profile: w.cat.profileOf("custom") };
  assert.equal((await w.p.turn(req(declared, { account: a }))).refused.type, "ENTRY_NOT_LISTED");
  assert.ok((await w.p.turn(req(declared, { account: a, test_flow: true }))).result);
  assert.ok((await w.p.turn(req(ENTRIES.customListed.entry_id, { account: a }))).result);
});

test("R43 the Anthropic adapter carries the API-key path behind R37's contract (provider-turn.test.mjs R2, R4, R5 run through turn); control: a scan finds no provider name outside the adapters and test fixtures of the provider interface", () => {
  assert.deepEqual(Object.keys(anthropicAdapter).sort(), ["adapter_type", "classify", "decode", "encode"]);
  assert.deepEqual(Object.keys(openaiAdapter).sort(), ["adapter_type", "classify", "decode", "encode"]);
  const dir = join(here, "../src/provider");
  const hits = readdirSync(dir).filter((f) => f.endsWith(".mjs"))
    .filter((f) => /anthropic|openai|openrouter|claude-|opus-|sonnet-/i.test(readFileSync(join(dir, f), "utf8").replace(/openai_compatible/g, "")));
  assert.deepEqual(hits, []);
});

/* R44's deliberately broken adapter: it keeps the credential it encoded with and echoes it in an error, and reports 0
   for a figure the provider did not state. */
function broken(base, { leak = true, zero = true } = {}) {
  let kept = null;
  return { adapter_type: base.adapter_type,
    encode: (n, e, p, cred) => { kept = cred?.secret ?? kept; return base.encode(n, e, p, cred); },
    decode: (r) => {
      const d = base.decode(r);
      const stated = zero ? Object.fromEntries(Object.keys({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, reasoning_tokens: 0 })
        .map((k) => [k, d.stated?.[k] ?? 0])) : d.stated;
      return { ...d, stated, message: leak && kept ? `${d.message} (${kept})` : d.message };
    },
    classify: base.classify };
}

test("R44 the Anthropic and generic adapters pass the kit; a deliberately broken adapter that echoes the secret in an error and reports 0 for an unstated figure fails on exactly those two checks; control: removing either defect makes that check pass", async () => {
  const w = await world([]);
  const msgEntry = w.cat.entryOf(ENTRIES.messages.entry_id);
  const genEntry = w.cat.entryOf(GEN);
  const msgProfile = w.cat.profileOf(PROFILES.messages.id);
  const genProfile = w.cat.profileOf(PROFILES.generic.id);
  const m = await adapterKit(anthropicAdapter, msgProfile, MSG_FAKE(msgEntry));
  assert.ok(m.pass, JSON.stringify(m.checks));
  const g = await adapterKit(openaiAdapter, genProfile, GEN_FAKE(genEntry));
  assert.ok(g.pass, JSON.stringify(g.checks));
  const bad = await adapterKit(broken(anthropicAdapter), msgProfile, MSG_FAKE(msgEntry));
  assert.equal(bad.pass, false);
  assert.deepEqual(KIT_CHECKS.filter((c) => !bad.checks[c].ok), ["usage_null", "no_secret"]);
  const noLeak = await adapterKit(broken(anthropicAdapter, { leak: false }), msgProfile, MSG_FAKE(msgEntry));
  assert.deepEqual(KIT_CHECKS.filter((c) => !noLeak.checks[c].ok), ["usage_null"]);
  const noZero = await adapterKit(broken(anthropicAdapter, { zero: false }), msgProfile, MSG_FAKE(msgEntry));
  assert.deepEqual(KIT_CHECKS.filter((c) => !noZero.checks[c].ok), ["no_secret"]);
});

test("R8 (control) the broken adapter of R44, which keeps the credential and echoes it, is caught by the kit's no_secret check", async () => {
  const w = await world([]);
  const kit = await adapterKit(broken(openaiAdapter, { zero: false }), w.cat.profileOf(PROFILES.generic.id), GEN_FAKE(w.cat.entryOf(GEN)));
  assert.equal(kit.checks.no_secret.ok, false);
  assert.equal(kit.checks.no_secret.detail, "adapter output");
});
