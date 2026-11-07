/* The T53 world for this module's suites (NOT a `.test.mjs`): a segment driven over the suite's fake plane (`world.mjs`)
 * and `agent-model`'s own provider, bound by its real `makeProvider` (through this module's `providerFor`) to a catalogue
 * `ai-catalogue`'s real code seeded from its test builders, as `agent-model`'s provider world builds its own (K4990: no
 * hand-built answer of another module's). The provider at the other end answers in each adapter's own wire shape, built
 * with `agent-model`'s fixture builders (`genAnswer`, `msgAnswer`, `genError`); it decides only which tool to call. */
import { entry, payload, provider, seeded, claim } from "../../bio-plane/test/m/ai-catalogue/fixture.mjs";
import { PROFILES, PLANS, ENTRIES, SECRET, genAnswer, genError, msgAnswer } from "../../agent-model/test/provider-world.mjs";
import { segmentMeter } from "../../agent-model/src/model.mjs";
/* as a namespace, so this world loads whatever the module exports: a module without the T53 door fails these suites by
   their assertions, never at import (the revert check) */
import * as steps from "../src/index.mjs";
import { makeProvider } from "../../agent-model/src/provider/index.mjs";
const { driveHarness, modelHalf } = steps;
const providerFor = steps.providerFor ?? makeProvider;
import { HOST } from "./shell.mjs";
import { world as planeWorld } from "./world.mjs";
import { MEMBER } from "./account.mjs";

const caps = (over) => ({ ...entry("x").capabilities, ...over });
const gen = (id, over = {}) => entry(id, { adapter_type: "openai_compatible", profile: { id: "fakeco-profile", min_version: 1 }, ...over });
/* Entries of this suite beside agent-model's: one that cannot call tools, and a cheap one at another host. */
export const OWN = {
  notools: gen("gen-notools", { capabilities: caps({ tools: claim(false) }) }),
  farcheap: entry("route-cheap", { ...JSON.parse(JSON.stringify(ENTRIES.routed)), entry_id: "route-cheap",
    served_ids: ["fake-model-route-cheap"], prices: { ...ENTRIES.cheap.prices } }),
};

let cached = null;
export async function catalogue() {
  if (cached) return cached;
  const doc = payload({
    providers: [provider("fakeco"), provider("fakeroute", "aggregator"), provider("fakegate", "gateway"), provider("fakebuiltin", "builtin"),
      provider("fakelocal", "custom")],
    profiles: Object.values(PROFILES), plans: PLANS,
    entries: [...Object.values(ENTRIES), ...Object.values(OWN)].map((e) => JSON.parse(JSON.stringify(e))),
  });
  cached = (await seeded(doc)).cat;
  return cached;
}

export const FAKECO = { provider: "fakeco", host: "fakeco" };
/** The account handle a T53 shell hands (`agent-worker` R33), with the fields this module reads beside it: the member
 *  whose act it serves, the recipients disclosed to them and each entry's Gate 1 verdicts. */
export const account = ({ entries = ["gen-one"], head = entries[0], verdict = "passes", disclosed = [FAKECO], ...over } = {}) => ({
  account_id: "acct-1", level: "member", means: "sealed", secret: SECRET, plan_id: "fakeco-api", owner: MEMBER, member: MEMBER,
  entry_id: head, entries, disclosed,
  verdicts: Object.fromEntries(entries.map((id) => [id, { run: typeof verdict === "function" ? verdict(id) : verdict }])), ...over });

const textOf = (c) => (typeof c === "string" ? c : JSON.stringify(c ?? ""));
/** What the provider is asked for, read off the wire request: `{final, level, step}`. */
export function asked(url, body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const system = [body?.system, ...messages.filter((m) => m.role === "system").map((m) => m.content)].map(textOf).join(" ");
  const names = (body?.tools || []).map((t) => t?.function?.name ?? t?.name);
  /* a sub-session's turn after its opening's one tool result has read something */
  const results = messages.filter((m) => m.role === "tool" || (m.role === "user" && Array.isArray(m.content) && m.content.some((c) => c?.type === "tool_result"))).length;
  if (names.includes("report")) return { final: "report", level: (/\\?"level\\?":\\?"(\w+)/.exec(system) || [])[1] ?? null, step: "fanout", read: results > 1 };
  const users = messages.filter((m) => m.role === "user");
  const step = (/judge_(\w+)/.exec(textOf(users[users.length - 1]?.content)) || [])[1] ?? null;
  return { final: step ? `judge_${step}` : null, level: null, step };
}

/** A provider at the other end: `answer({final, level, step, n})` gives the final tool's input, `fail(ctx)` a wire
 *  failure `{status, body, headers}` or null, `extra` fields added to every answer body. Records every request. */
export function remote({ answer = () => ({}), fail = () => null, extra = {} } = {}) {
  const requests = [];
  const fetch = async (url, init = {}) => {
    const body = JSON.parse(init.body);
    const ctx = { ...asked(url, body), url: String(url), n: requests.length + 1, headers: { ...(init.headers || {}) }, body };
    requests.push(ctx);
    const f = fail(ctx);
    if (f) return new Response(JSON.stringify(f.body ?? null), { status: f.status ?? 500, headers: { "content-type": "application/json", ...(f.headers || {}) } });
    /* an answer `{tool, input}` calls that tool instead of the final one (a sub-session's read, before it reports) */
    const said = answer(ctx) ?? {};
    const call = said && typeof said.tool === "string" ? { id: `call_${ctx.n}`, name: said.tool, input: said.input ?? {} }
      : { id: `call_${ctx.n}`, name: ctx.final ?? "judge_plan", input: said };
    const messages = String(url).includes("/messages");
    const out = messages ? msgAnswer({ tool_calls: [call], model: body.model })
      : genAnswer({ tool_calls: [call], model: body.model, host: String(url).includes("route.") ? "fakeroute" : "fakeco" });
    return new Response(JSON.stringify({ ...out, ...extra }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { fetch, requests };
}
export { genError };

/** One segment: the plane (`planeWorld` cfg), the remote, the account; answers `{out, rec, requests, model, plane}`. */
export async function segment({ plane = {}, remoteCfg = {}, acct = account(), turns = 120, maxSteps = 400, spy = null, deps = {} } = {}) {
  const cat = await catalogue();
  const far = remote(remoteCfg);
  const clock = { t: Date.parse("2026-11-05T10:00:00Z") };
  const bound = providerFor({ catalogue: cat, fetch: far.fetch, now: () => clock.t, sleep: async (ms) => { clock.t += ms; },
    timeout: () => new Promise(() => {}), random: () => 0.5, ...deps });
  const prov = spy ? spy(bound) : bound;
  const P = planeWorld(plane);
  const model = modelHalf({ account: acct, meter: segmentMeter({ turnsBound: turns, bytesBound: 1e9 }), provider: prov, suggestions: false });
  const out = await driveHarness(HOST, { PLANE: { fetch: P.fetch } }, { runId: "RUN-W", store: "scratch", credential: "aik-" + "c".repeat(64),
    judgements: [], maxSteps, account: acct, model, deadline: null, progress: null });
  const body = out.refusal ? await out.refusal.clone().json() : null;
  return { out, refusal: body, status: out.refusal?.status ?? null, rec: P.rec, requests: far.requests, model };
}

/** The check run's answers: a plan naming no targets, each level reporting absent, a compose forming `candidates`. */
export const answers = (candidates = [{ name: "c-one", description: "one", level: "meaning" }]) => (ctx) => {
  if (ctx.final === "report") return { state: "LOOKED_INDETERMINATE", summary: `looked at ${ctx.level}`, citations: [] };
  if (ctx.final === "judge_compose") return { candidates };
  return {};
};

/** As `answers`, each sub-session reading its level once (so the plane states the level's scope) and then reporting
 *  `state`. */
export const reading = (state, candidates = []) => (ctx) => {
  if (ctx.final === "report") return ctx.read ? { state, summary: `looked at ${ctx.level}`, citations: [] }
    : { tool: "meaningrows", input: { q: "", rows: "leg", limit: 5 } };
  if (ctx.final === "judge_compose") return { candidates };
  return {};
};
