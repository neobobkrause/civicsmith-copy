/* agent-worker — `POST /ask` (R54–R56), the ask's reach (R55, R37), the suggestions switch on a run (R56), and the
 * account and usage a run's model half carries (R36, R58), AT THE MEMBER'S INTERFACE: its default export
 * `fetch(request, env)`, driven in this process with a recording plane binding and the global `fetch` replaced by a
 * scripted model API (agent-model's API-key path). Nothing here reads the member's source text.
 *
 * The plane's own lists are imported from their modules: `answers`' `ASK_SCOPE` (its R1) and `credentials'
 * `AI_GRANT_OPS` (its R28), equal since N580 (K1603, K1609), `rule` included. */
import { readFileSync } from "node:fs";
import worker from "../src/index.mjs";
import { ASK_OPS, ASK_PLANE_OPS, PLANE_OPS, GRANT_ONLY_OPS } from "../src/ops.mjs";
import { AI_GRANT_OPS } from "../../bio-plane/src/credentials/index.mjs";
import { ASK_SCOPE } from "../../bio-plane/src/answers/scope.mjs";
import { ASK_BOUNDS } from "../../bio-plane/src/run-rules/index.mjs";
import { MODEL_ENDPOINT, MODEL_FOR_MODE, USAGE_FIGURES } from "../../agent-model/src/model.mjs";
import { ESTIMATE } from "../../agent-model/src/outcome.mjs";
import { ceilingRefusal } from "../../bio-plane/test/m/ai-use/fixtures.mjs";
import { MEMBER } from "./account.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

const GRANT = "aig-ask-fixture-grant-never-echoed";
const SECRET = "sk-ant-ask-fixture-key-never-echoed";
const ACCOUNT = { kind: "apikey", level: "member", secret: SECRET, member: MEMBER };
/* K1755: the group's API key, serving the same member's ask (credentials R35). */
const GROUP_SECRET = "sk-ant-ask-group-key-fixture-never-echoed";
const GROUP = { kind: "apikey", level: "group", secret: GROUP_SECRET, member: MEMBER };
const AIK = "aik-" + "d".repeat(64);
/* R82 (T47; K3060 D10): the token credentials holds for the member's own sign-in, a `signin` account's `secret`. */
const SIGNIN_TOKEN = "sk-ant-oat-ask-signin-fixture-never-echoed";
const PACK = { id: "investigative-session", version: "pack@ask", resident: { objective: "answer from the record" },
               disclosed: { ask: { body: "closed book" }, suggestions: { body: "labelled suggestions only" } } };
/* ai-use's real refusal for a use over its spent daily ceiling (fix round 10; the provider's published fixture). */
const CEILING = await ceilingRefusal();

/* The plane: records every call; answers the ask's own ops, its reads, and a run's ops. */
function plane(cfg = {}) {
  const calls = [];
  const ok = (result) => Response.json({ ok: true, result, tokenClass: "ai", version: "ask-test" });
  const S = { status: "running" };
  return { calls, binding: { async fetch(url, init) {
    const u = new URL(url);
    const op = u.searchParams.get("op");
    let body = null; try { body = init?.body ? JSON.parse(init.body) : null; } catch { body = null; }
    calls.push({ op, token: String(init?.headers?.authorization ?? "").replace(/^Bearer /, "") || null, store: u.searchParams.get("store"), query: Object.fromEntries(u.searchParams), body, raw: String(url) + (init?.body ?? "") });
    if (cfg.silent?.includes(op)) return new Response("<html>", { status: 502 });
    switch (op) {
      case "askceiling": return cfg.ceiling ? ok(CEILING) : ok({ ok: true, reached: false });
      /* control-plane R41: the door answers `agentpack` at the envelope's top level */
      case "agentpack": return Response.json({ ok: true, fences: [], ...(cfg.noPack ? { pack: null, pack_absent: "no fences" } : { pack: PACK }), tokenClass: "ai" });
      case "askcheck":
        if (cfg.checkRefused) return Response.json({ ok: false, reason: "GRANT_EXPIRED", check: "C-29.30" }, { status: 403 });
        return ok({ ok: true, answer: { ...(body?.answer || {}), sentences: [] },
                    withheld: [{ sentence: 0, code: "ANSWER_CITES_UNREAD", translation: "a quote was not read" }] });
      case "askusage": return ok({ ok: true });
      case "whoami": return ok({ tokenClass: "ai", session: false, member: null });
      case "airun": return ok({ found: true, session: { id: "RUN-A", mode: "check", status: S.status, max_passes: 1,
        principal: { plane: MEMBER, claude: MEMBER, ref: MEMBER, skill: PACK.version }, context: { type: "inquiry", id: "INQ-1" },
        budget: [{ bound: "fetches", allowed: 9 }, { bound: "subsessions", allowed: 9 }, { bound: "wallclock", allowed: 9e5 },
                 { bound: "runtime", allowed: 900 }].map((b) => ({ ...b, consumed: 0 })) } });
      case "airunlog": return ok({ found: true, entries: [], truncated: false });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: "RUN-A", context: { type: "inquiry", id: "INQ-1" },
                                                                            mode: "check", skill: PACK.version, standard_pair: null } });
      case "basisversions": return ok({ versions: [] });
      case "airuntick": return ok({ ticked: true, appended: (body?.log || []).length, refused: [] });
      case "airunclose": S.status = "finished"; return ok({ terminated: true });
      default:
        if (ASK_OPS.includes(op) || op === "meaningrows" || op === "search") return ok({ op, rows: [{ id: "EVT-1" }] });
        return Response.json({ ok: false, reason: "UNKNOWN_OP" }, { status: 400 });
    }
  } } };
}

/* The model API (agent-model's API-key path): scripted per conversation, recording every request. */
function model(script = {}) {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), key: init.headers["x-api-key"], body, raw: init.body });
    if (script.refuse) return Response.json({ type: "error", error: { type: "overloaded_error", message: "busy" } }, { status: 529 });
    const names = (body.tools || []).map((x) => x.name);
    /* R61: a judged row opens with the facts as `read_facts`' result (ids `facts_…`); that is not a turn the model took. */
    const results = body.messages.filter((m) => Array.isArray(m.content)
      && m.content.some((b) => b.type === "tool_result" && !String(b.tool_use_id).startsWith("facts_")));
    const use = (name, input) => Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${calls.length}`, name, input }], usage: { input_tokens: 3, output_tokens: 2 } });
    if (names.includes("done_reading")) {
      const plan = script.reading || [["load_layer", { name: "ask" }], ["read", { op: "sources", args: {} }],
                                       ["read", { op: "eventsfor", args: { entity: "ENT-1" } }]];
      const n = results.length;
      if (n < plan.length && plan[n][0] === "batch")
        return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use", usage: { input_tokens: 3, output_tokens: 2 },
          content: plan[n][1].map(([name, input], i) => ({ type: "tool_use", id: `u${calls.length}_${i}`, name, input })) });
      if (n < plan.length) return use(...plan[n]);
      return use("done_reading", { question_as_read: "who held the seat in March" });
    }
    if (names.includes("answer"))
      return use("answer", { question_as_read: "who held the seat in March", clarifying: null, summary: "S1",
                             sentences: [{ text: "Ruth held it.", kind: "quote", support: ["EVT-1"] }], label: "machine work" });
    /* a run's parent: load the suggestions layer once, then answer the judge tool it is asked for */
    if (names.includes("load_layer") && results.length === 0 && script.runLoad)
      return use("load_layer", { name: "suggestions" });
    const judge = names.find((x) => x.startsWith("judge_") && body.messages.some((m) => JSON.stringify(m.content).includes(`calling ${x}`)));
    if (names.includes("report"))
      return use("report", { state: "LOOKED_ABSENT", summary: "nothing" });
    return use(judge || names.find((x) => x.startsWith("judge_")), {});
  };
  return { calls, fn };
}

async function drive(path, body, { planeCfg = {}, modelScript = {}, env = {} } = {}) {
  const p = plane(planeCfg), m = model(modelScript);
  const saved = globalThis.fetch;
  globalThis.fetch = m.fn;
  try {
    const res = await worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body) }), { VERSION: "ask", PLANE: p.binding, ...env });
    const text = await res.text();
    const lines = res.headers.get("content-type") === "application/x-ndjson"
      ? text.trim().split("\n").map((l) => JSON.parse(l)) : null;
    let out = null; if (!lines) try { out = JSON.parse(text); } catch { out = null; }
    return { status: res.status, type: res.headers.get("content-type"), text, lines, out, plane: p.calls, model: m.calls };
  } finally { globalThis.fetch = saved; }
}
const ask = (extra = {}, opts) => drive("ask", { question: "Who held the seat in March?", grant: GRANT, account: ACCOUNT, ...extra }, opts);
const last = (r) => (r.lines ? r.lines[r.lines.length - 1] : null);
const TRANSCRIPTS = [];

section("R54 · refusals before any model call, each by its code, as plain JSON");
{
  const cases = [
    ["no PLANE binding (as R1)", () => drive("ask", { question: "q", grant: GRANT, account: ACCOUNT }, { env: { PLANE: undefined } }), 503, "PLANE_NOT_CONFIGURED"],
    ["a body that is not JSON (as R2)", () => drive("ask", "{{{"), 400, "BAD_BODY"],
    ["no question", () => ask({ question: "" }), 400, "BAD_QUESTION"],
    ["no grant", () => ask({ grant: undefined }), 401, "NO_GRANT"],
    ["an empty grant", () => ask({ grant: "" }), 401, "NO_GRANT"],
    ["no account", () => ask({ account: undefined }), 409, "NO_ACCOUNT"],
    ["an account naming no member", () => ask({ account: { kind: "apikey", level: "member", secret: SECRET } }), 400, "BAD_ACCOUNT"],
    ["an account naming no level", () => ask({ account: { kind: "apikey", secret: SECRET, member: MEMBER } }), 400, "BAD_ACCOUNT"],
    ["the team's account as a subscription", () => ask({ account: { ...GROUP, kind: "subscription" } }), 400, "BAD_ACCOUNT"],
    ["(T38) a member's own subscription, retired", () => ask({ account: { ...ACCOUNT, kind: "subscription" } }), 400, "BAD_ACCOUNT"],
    ["(T47, R82) a sign-in carrying no secret", () => ask({ account: { kind: "signin", level: "member", member: MEMBER } }), 409, "SIGNIN_NOT_HELD"],
    ["(T47, R82) a sign-in carrying an empty secret", () => ask({ account: { kind: "signin", level: "member", member: MEMBER, secret: "" } }), 409, "SIGNIN_NOT_HELD"],
    ["(T38) a sign-in at the group level", () => ask({ account: { kind: "signin", level: "group", member: MEMBER, secret: SIGNIN_TOKEN } }), 400, "BAD_ACCOUNT"],
    ["(T46) a sign-in with suggestions not a boolean", () => ask({ account: { kind: "signin", level: "member", member: MEMBER, secret: SIGNIN_TOKEN, suggestions: "yes" } }), 400, "BAD_ACCOUNT"],
    ["the team's account with an empty key", () => ask({ account: { ...GROUP, secret: "" } }), 409, "NO_ACCOUNT"],
    ["a namespace no instance holds", () => ask({ store: "biosmoke" }), 400, "NAMESPACE_UNKNOWN"],
    ["a conversation that is not this ask's turns", () => ask({ conversation: [{ role: "system", content: "x" }] }), 400, "BAD_CONVERSATION"],
  ];
  for (const [label, run, status, code] of cases) {
    const r = await run();
    t(`R54: ${label} -> ${status} ${code}, no plane call, no model call, not a stream`,
      [r.status, r.out?.code, r.out?.reason, r.plane.length, r.model.length, r.lines], [status, code, code, 0, 0, null]);
  }
  const c = await ask({}, { planeCfg: { ceiling: true } });
  t("R54: a member over the use ceiling, as the plane answers it, is relayed unchanged (R43), before any model call",
    [c.status, c.out?.reason, c.out?.plane?.result, c.plane.map((x) => x.op), c.model.length],
    [403, "PLANE_REFUSED", CEILING, ["askceiling"], 0]);
  const s = await ask({}, { planeCfg: { silent: ["askceiling"] } });
  t("R54: a silent plane at the ceiling -> 502 PLANE_SILENT, no model call", [s.status, s.out?.code, s.model.length], [502, "PLANE_SILENT", 0]);
  const np = await ask({}, { planeCfg: { noPack: true } });
  t("R54, R48: no pack published -> refused PACK_UNDETERMINED, no model call", [np.status, np.out?.code, np.model.length], [502, "PACK_UNDETERMINED", 0]);
}

section("R54 · interpret, read through the grant, compose, check, and return only what the checks pass");
{
  const r = await ask();
  TRANSCRIPTS.push(r);
  t("R54: a 200 NDJSON stream", [r.status, r.type], [200, "application/x-ndjson"]);
  t("R54: progress is streamed as each step begins: interpreting, each read with its op, composing, checking, then the answer",
    r.lines.map((l) => l.event === "step" ? l.step : l.event === "read" ? `read ${l.op}` : l.event),
    ["interpreting", "read eventsfor", "composing", "checking", "answer"]);
  t("R54, R113: no progress event carries text the checks have not passed: a step's name, a read's op and record, counts, nothing more",
    r.lines.slice(0, -1).map((l) => Object.keys(l).sort().join(",")), ["event,step", "event,op,record", "count,event,found", "count,event"]);
  const check = r.plane.find((x) => x.op === "askcheck");
  t("R54: the composed answer was handed to the plane's answers checks, with the question",
    [check?.body?.question, check?.body?.answer?.summary, check?.body?.answer?.label], ["Who held the seat in March?", "S1", "machine work"]);
  t("R54: what is returned is what the checks passed, and what they withheld is named",
    [last(r).event, last(r).ok, last(r).answer.sentences, last(r).withheld.map((w) => w.code)],
    ["answer", true, [], ["ANSWER_CITES_UNREAD"]]);
  t("R54: the model's own sentence never reached the member: only the checked answer did", r.text.includes("Ruth held it."), false);
  t("R54: the calls, in order: the ceiling, the pack, the reads, the usage, the checks",
    r.plane.map((x) => x.op), ["askceiling", "agentpack", "eventsfor", "askusage", "askusage", "askcheck"]);
  t("R54: every plane call went under the grant and nothing else", [...new Set(r.plane.map((x) => x.token))], [GRANT]);
  t("R54: it writes no run row and no observation: no run op was called",
    r.plane.filter((x) => PLANE_OPS[x.op] && !["agentpack", "search", "meaningrows", "standard", "profiles"].includes(x.op)).map((x) => x.op), []);
  const usage = r.plane.filter((x) => x.op === "askusage").map((x) => x.body);
  /* agent-model R6: on the API-key path each request answered counts one call, so each conversation's `calls` is the
     number of requests the model API received for it (reading's offer `done_reading`, composing's `answer`). */
  const requests = (tool) => r.model.filter((c) => (c.body.tools || []).some((x) => x.name === tool)).length;
  /* agent-model R13 (T40; K2376): on the API-key path its usage adds the copy's estimate beside the five figures. */
  const FIGURES = [...USAGE_FIGURES, ESTIMATE];
  t("R54 (N588): each conversation's usage is reported for mode ask, with its figures (agent-model R13's "
    + "estimate on the API-key path included) and its calls exactly as agent-model R6 answers them (one per model call "
    + "that reached the provider)",
    usage.map((u) => [u.mode, Object.keys(u.usage), u.calls]),
    [["ask", FIGURES, requests("done_reading")],
     ["ask", FIGURES, requests("answer")]]);
  /* R112 (T53; BR22): each report is `{mode, entry_id, label, usage, calls}`, `entry_id` and `label` as `agent-model`
     answered them (null where it stated none, never invented), and never a model filled in here. */
  t("R112 (T53): each ask usage report is exactly {mode, entry_id, label, usage, calls}, naming no model, its entry and label null where agent-model stated none",
    usage.map((u) => [Object.keys(u).join(","), u.entry_id, u.label]),
    usage.map(() => ["mode,entry_id,label,usage,calls", null, null]));
  t("R54: the turns ran through agent-model under the member's own reference, mode ask's model",
    [[...new Set(r.model.map((c) => c.url))], [...new Set(r.model.map((c) => c.key))], [...new Set(r.model.map((c) => c.body.model))]],
    [[MODEL_ENDPOINT], [SECRET], [MODEL_FOR_MODE.ask]]);
  t("R54: an ask naming no namespace sends none (the plane's default)", r.plane.every((x) => x.store === null), true);
  const named = await ask({ store: "scratch" });
  t("R54: an ask naming one sends it on every call", [...new Set(named.plane.map((x) => x.store))], ["scratch"]);
  const grp = await ask({ account: GROUP });
  TRANSCRIPTS.push(grp);
  t("R54 (K1755): an ask the group's API key serves runs the same way, its turns under the group's key, and is still the "
    + "member's ask: answered, checked, and its usage reported under the member's grant",
    [grp.status, last(grp).event, [...new Set(grp.model.map((c) => c.key))], grp.plane.filter((x) => x.op === "askusage").length,
     [...new Set(grp.plane.map((x) => x.token))]],
    [200, "answer", [GROUP_SECRET], 2, [GRANT]]);
  const conv = await ask({ conversation: [{ role: "user", content: "earlier question" }, { role: "assistant", content: "earlier answer" }] });
  t("R54: the earlier turns the member's device holds are carried into the conversation, before the question",
    conv.model[0].body.messages.slice(0, 2).map((m) => [m.role, typeof m.content === "string" ? m.content : m.content.map((c) => c.text).join("")]),
    [["user", "earlier question"], ["assistant", "earlier answer"]]);
}

section("R54 · after the stream begins, a failure ends it as a refusal, and nothing unchecked is returned");
{
  const ref = await ask({}, { planeCfg: { checkRefused: true } });
  t("R54: the checks refused -> the last event is a refusal carrying the plane's body; no answer",
    [last(ref).event, last(ref).code, last(ref).plane?.reason, ref.lines.some((l) => l.event === "answer")],
    ["refused", "PLANE_REFUSED", "GRANT_EXPIRED", false]);
  const sil = await ask({}, { planeCfg: { silent: ["askcheck"] } });
  t("R54: the checks silent -> refused PLANE_SILENT, no answer", [last(sil).code, sil.lines.some((l) => l.event === "answer")], ["PLANE_SILENT", false]);
  const mr = await ask({}, { modelScript: { refuse: true } });
  t("R54: the model refused -> refused MODEL_REFUSED with its status and type", [last(mr).code, last(mr).model_status, last(mr).model_error],
    ["MODEL_REFUSED", 529, "overloaded_error"]);
  const many = [["batch", Array.from({ length: ASK_BOUNDS.reads.default + 3 }, () => ["read", { op: "timeline", args: {} }])]];
  const bound = await ask({}, { modelScript: { reading: many } });
  t("R54 (run-rules R17): the reads bound stops reading at its figure; the read past it is refused to the model, never sent",
    [bound.plane.filter((x) => x.op === "timeline").length,
     JSON.stringify(bound.model[1]?.body?.messages ?? []).includes("ASK_BOUND_REACHED")],
    [ASK_BOUNDS.reads.default, true]);
}

section("R55 · the ask's whole reach is ASK_OPS, equal to answers' ASK_SCOPE and credentials' AI_GRANT_OPS");
{
  const scope = ASK_SCOPE.map((e) => e.op);
  t("R55: ASK_OPS equals answers' ASK_SCOPE, both ways", [ASK_OPS.filter((o) => !scope.includes(o)), scope.filter((o) => !ASK_OPS.includes(o))], [[], []]);
  t("R55: and credentials' AI_GRANT_OPS less GRANT_ONLY_OPS (answers:103), both ways, `rule` included (N580; K1603, K1609)",
    [ASK_OPS.filter((o) => !AI_GRANT_OPS.includes(o)), AI_GRANT_OPS.filter((o) => !ASK_OPS.includes(o) && !GRANT_ONLY_OPS.includes(o))], [[], []]);
  t("R55: never a sources op, member history, an administrative op, an export, or a write",
    ASK_OPS.filter((o) => /^sources|history|admin|export|purge|suggest|tick|close|propose|capture|set$/.test(o)), []);
  t("R55, R37: an ask's reach is not PLANE_OPS: the run's ops are unchanged, and no write of a run is an ask's op",
    [Object.keys(PLANE_OPS).filter((o) => PLANE_OPS[o].mutating).filter((o) => ASK_OPS.includes(o)), Object.keys(PLANE_OPS).length], [[], 25]);
  t("R55: the ask's own calls are not reads of the record, and none is in ASK_OPS",
    Object.keys(ASK_PLANE_OPS).filter((o) => ASK_OPS.includes(o)), []);
  const r = TRANSCRIPTS[0];
  t("R55: a tool call naming another op is refused here, before any plane call",
    r.plane.some((x) => x.op === "sources"), false);
  const refusedResult = r.model.flatMap((c) => c.body.messages).flatMap((m) => Array.isArray(m.content) ? m.content : [])
    .find((b) => b.type === "tool_result" && /ASK_OP_REFUSED/.test(String(b.content)));
  t("R55: and the refusal is returned to the model as the tool's result, marked an error", [!!refusedResult, refusedResult?.is_error], [true, true]);
  const args = await ask({}, { modelScript: { reading: [["read", { op: "timeline", args: { token: "x" } }],
                                                        ["read", { op: "timeline", args: { nested: { a: 1 } } }]] } });
  t("R55: a read whose arguments would carry a token, a namespace or a structure is refused, never sent",
    args.plane.filter((x) => x.op === "timeline").length, 0);
  t("R55: every op the ask's reads reached the plane with is in ASK_OPS",
    TRANSCRIPTS.concat([args]).flatMap((x) => x.plane.map((c) => c.op)).filter((o) => !ASK_OPS.includes(o) && !(o in ASK_PLANE_OPS)), []);
}

section("R56 · the member's own suggestions switch: off by default, the layer loaded only when it is on");
{
  const tools = (r) => r.model[0].body.tools.find((x) => x.name === "load_layer").input_schema.properties.name.enum;
  const off = await ask({}, { modelScript: { reading: [["load_layer", { name: "suggestions" }]] } });
  t("R56: off (absent): the ask's load_layer does not offer the suggestions layer", tools(off), ["ask"]);
  const offResult = off.model[1].body.messages.flatMap((m) => Array.isArray(m.content) ? m.content : [])
    .find((b) => b.type === "tool_result");
  t("R56: off: a call naming it is refused, and the layer's words never reach the model",
    [offResult?.is_error, off.model.some((c) => c.raw.includes("labelled suggestions only"))], [true, false]);
  const on = await ask({ account: { ...ACCOUNT, suggestions: true } }, { modelScript: { reading: [["load_layer", { name: "suggestions" }]] } });
  t("R56: on: it is offered and loaded", [tools(on), on.model.some((c) => c.raw.includes("labelled suggestions only"))],
    [["ask", "suggestions"], true]);
  const runBody = (account) => ({ run_id: "RUN-A", store: "scratch", credential: AIK, account });
  const runOff = await drive("run", runBody(ACCOUNT), { modelScript: { runLoad: true } });
  const runOn = await drive("run", runBody({ ...ACCOUNT, suggestions: true }), { modelScript: { runLoad: true } });
  const layerOf = (r) => r.model[0].body.tools.find((x) => x.name === "load_layer").input_schema.properties.name.enum;
  t("R56: a run started by that member honours the same switch: off, not offered and never loaded; on, offered and loaded",
    [runOff.status, layerOf(runOff), runOff.model.some((c) => c.raw.includes("labelled suggestions only")),
     runOn.status, layerOf(runOn), runOn.model.some((c) => c.raw.includes("labelled suggestions only"))],
    [200, ["ask"], false, 200, ["ask", "suggestions"], true]);
  TRANSCRIPTS.push(runOff, runOn);
}

section("R58, R36 · a run's model half: turns through agent-model, usage reported, no secret anywhere");
{
  const r = TRANSCRIPTS[TRANSCRIPTS.length - 1];
  t("R58: a run whose member's reference arrived and whose caller supplied no judgements runs its turns, and says so",
    [r.status, JSON.parse(r.text).judgement_source, JSON.parse(r.text).turns_run === r.model.length, r.model.length > 0], [200, "model", true, true]);
  const ticks = r.plane.filter((x) => x.op === "airuntick" && x.body?.log !== undefined && x.body?.consume !== undefined);
  const entries = ticks.flatMap((x) => x.body?.usage || []);
  t("R26, R58 (N588; ai-runs R48): each tick carries the usage of the conversations since the last, each exactly "
    + "{mode, entry_id, label, usage, calls} (R112 as T53 amends it)",
    [entries.length > 0, [...new Set(entries.map((e) => Object.keys(e).join(",")))], [...new Set(entries.map((e) => e.mode))]],
    [true, ["mode,entry_id,label,usage,calls"], ["check"]]);
  t("R26 (N588): `calls` is agent-model R6's, so the calls summed over every entry are the model calls that reached the "
    + "provider (each API-key request one), never a conversation counted as one",
    entries.reduce((n, e) => n + (Number.isInteger(e.calls) ? e.calls : NaN), 0), r.model.length);
  /* F2: the sign-in path's half of R26 (the runner's stated turns) went with the runner: no runner is bound, and a run's
     model turns on the member's own sign-in are refused before any model call or plane write. */
  const SIGNIN = { kind: "signin", level: "member", member: MEMBER, secret: SIGNIN_TOKEN, suggestions: false };
  const si = await drive("run", { run_id: "RUN-A", store: "scratch", credential: AIK, account: SIGNIN });
  TRANSCRIPTS.push(si);
  t("F2: a run's model turns on the member's own sign-in are refused ASSISTANT_REMOTE_NOT_READY (absent), no model call, "
    + "no plane write",
    [si.status, JSON.parse(si.text).code, JSON.parse(si.text).why, si.model.length, si.plane.map((x) => x.op).filter((op) => op !== "whoami")],
    [503, "ASSISTANT_REMOTE_NOT_READY", "absent", 0, []]);
  t("R26: a tick after no conversation carries no `usage`",
    ticks.filter((x) => !x.body.usage).length > 0 && ticks.filter((x) => x.body.usage).every((x) => x.body.usage.length > 0), true);
  const v = await (await worker.fetch(new Request("http://agent-worker/version"), { VERSION: "ask", PLANE: plane().binding })).json();
  t("R58: GET /version answers the one statement of when model turns run",
    /exactly when the Claude account that serves the member's act \(the member's own reference or sign-in, a project's account, or the team's API key\) arrives/
      .test(v.model_turns ?? ""), true);
  const all = TRANSCRIPTS;
  t("R36: no answer or event carried the grant, the ai credential, the member's secret or the group's key",
    all.filter((x) => [GRANT, SECRET, GROUP_SECRET, AIK, SIGNIN_TOKEN].some((v) => x.text.includes(v))).length, 0);
  t("R36, R82: the held token went to the plane in no call", all.some((x) => x.plane.some((c) => c.raw.includes(SIGNIN_TOKEN))), false);
  t("R36: the member's secret and the group's key went only in the model API's key header: never to the plane, never in "
    + "a request body",
    [all.some((x) => x.plane.some((c) => c.raw.includes(SECRET) || c.raw.includes(GROUP_SECRET))),
     all.some((x) => x.model.some((c) => c.raw.includes(SECRET) || c.raw.includes(GROUP_SECRET)))], [false, false]);
  t("R36: the grant went only to the plane, never to the model", all.some((x) => x.model.some((c) => c.raw.includes(GRANT))), false);
}

console.log(`\nask: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
