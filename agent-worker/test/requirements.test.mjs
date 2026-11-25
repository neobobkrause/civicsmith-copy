/* agent-worker — ITS REQUIREMENTS, ONE BY ONE, AT ITS INTERFACE (`build/requirements/agent-worker.md`).
 *
 * Every live id R1–R49 is named by a test here, in its title, and each test checks the whole requirement. The
 * member is driven through `POST /run` and `GET /version` inside workerd, over a real service binding to a plane
 * mock, with its one other egress — the model API (R58, agent-harness R7) — answered by a scripted model mock that
 * miniflare's `outboundService` puts behind every global `fetch`. The pure exports the requirements name
 * (`CONTROL_FLOW`, `nextStep`, `checkReport`, `resolveClaudeCascade`, `cascadeToken`, `SURFACE`) are driven
 * directly. The plane's own vocabularies are IMPORTED from the plane's modules, never retyped (R44), and the one
 * thing only the real plane can answer — what `op=agentpack` serves, and which namespaces exist — is asked of
 * the real plane, stood up here in workerd.
 *
 * Both mocks are reconfigured between arms through `/__mock/reset` and `/__model/reset`, so one workerd instance
 * serves most of the suite; arms that need a different ENVIRONMENT (no binding, a segment bound) get their own. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONTROL_FLOW, FIRST_STEP, LEVELS, MODES, REPORTING_LEVEL, JUDGEABLE, NOT_JUDGEABLE, BUDGET_BOUNDS, nextStep, stopBecause, applyJudgement, runContextTarget, stepLog, publishableState, stateBytes, resumableState } from "../../agent-harness/src/harness.mjs";
import { PLANE_OPS } from "../src/ops.mjs";
import {
  REPORT_KEYS, REPORT_STATES, SUMMARY_MAX, ADDRESS_MAX, CITATIONS_MAX, REPORT_MAX_BYTES, SPAWN_KEYS,
  checkReport, documentHoldings,
} from "../../agent-harness/src/subsession.mjs";
import {
  CASCADE_ORDER, resolveClaudeCascade, cascadeToken,
} from "../src/cascade.mjs";
import { MODEL_ENDPOINT, DEFAULT_MAX_SEGMENT_BYTES } from "../../agent-model/src/model.mjs";
import { MEMBER, withAccount } from "./account.mjs";
import { SURFACE } from "../src/index.mjs";
import { meaningRowsBranch } from "../../agent-steps/test/plane-meaning.mjs";
import { versionReadBranches } from "../../agent-steps/test/plane-versions.mjs";
import { PLANE_OPS_PINNED } from "./owners.mjs";
import { suggestBranch } from "../../agent-steps/test/plane-suggest.mjs";
import { captureRequestBranch } from "../../agent-steps/test/plane-capturerequest.mjs";
import { meaningRowsUnknownArm } from "../../bio-plane/test/m/retrieval/fixtures.mjs";
import { versionChainNoSuchVersion } from "../../bio-plane/test/m/provenance/fixtures.mjs";
import { tickStateTooLarge } from "../../bio-plane/test/m/ai-runs/fixtures.mjs";
import { suggestRefusals } from "../../bio-plane/test/m/run-productions/fixtures.mjs";

/* THE PLANE'S OWN VOCABULARIES AND THE SKILL PACK, from their modules (uses: ai-runs, skills, legacy-checks). */
import { OBSERVATION_LEVELS, OBSERVATION_STATES, RUN_ENDINGS, RUN_BOUNDS, runStatusFor } from "../../bio-plane/src/run-rules/index.mjs";
import * as RUN_RULES from "../../bio-plane/src/run-rules/index.mjs";
import { DEPLOYMENT_SEQUENCE, GATE_ADDRESS, DEPLOYED_MODES } from "../../bio-plane/src/run-rules/index.mjs";
import { reportsAs } from "../../bio-plane/src/skilldoctrine.mjs";
import * as HARNESS from "../../agent-harness/src/harness.mjs";
import { discoverMembers, verifyStatic, verifyFresh } from "../../bio-plane/scripts/fleet-bundle.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);
/* agent-model R4: the API-key path sends the system prompt as cache-marked blocks; its text is what a test reads. */
const sysText = (b) => (Array.isArray(b.system) ? b.system.map((x) => x.text).join("") : String(b.system ?? ""));

const WORKER_SRC = fileURLToPath(new URL("../src/index.mjs", import.meta.url));
const WRANGLER = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const WRANGLER_CFG = JSON.parse(WRANGLER);
const MANIFEST = JSON.parse(readFileSync(fileURLToPath(new URL("../fleet-member.json", import.meta.url)), "utf8"));
const PLANE_ENTRY = fileURLToPath(new URL("../../bio-plane/src/plane/index.mjs", import.meta.url));

const AIK = "aik-" + "a".repeat(64);
const REVOKED = "aik-" + "c".repeat(64);
const CLAUDE_TOKEN = "sk-ant-requirements-fixture-never-echoed";
/* R6 (K1601 (1), K1755): the account that serves the member's act, as the plane sends it (here the member's own,
   `level: "member"`); with no `judgements`, model turns run (R58). */
const ACCOUNTS = Object.freeze({ kind: "apikey", level: "member", secret: CLAUDE_TOKEN, member: MEMBER });
/* K1755: the group's API key, serving the same member's act. */
const GROUP_ACCOUNT = Object.freeze({ kind: "apikey", level: "group", secret: CLAUDE_TOKEN, member: MEMBER });
/* T38 (N785, K2200): the member's own sign-in, credentials R35's sign-in answer, as R6 carries it; (T47, R82) its
   `secret` the token credentials holds for the member. */
const SIGNIN_TOKEN = "sk-ant-oat-requirements-signin-fixture-never-echoed";
const SIGNIN = Object.freeze({ kind: "signin", level: "member", member: MEMBER, secret: SIGNIN_TOKEN, suggestions: false });
const wide = [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
              { bound: "wallclock", allowed: 500000 }, { bound: "runtime", allowed: 5000 }];

/* ============================================================ THE REAL PLANE, asked what only it can answer */
const real = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: PLANE_ENTRY, script: readFileSync(PLANE_ENTRY, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: "adm-req", PROBE_TOKEN: "prb-req", VERSION: "test" },
});
/* The real plane is asked as an enrolled member signed in with their own password: the shared member token is retired
   (C-38.11), and a credential travels in the Authorization header only (C-38.10). */
const realPost = async (op, token, body) => { const j = await (await real.dispatchFetch(`http://x/api/?op=${op}`, { method: "POST",
  headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) })).json();
  return j && typeof j === "object" && "result" in j ? j.result : j; };
const invited = await realPost("memberadd", "adm-req", { memberId: "rosa", cover: "c-rosa", role: "member", capabilities: ["contribute"] });
await realPost("enroll", null, { invite: invited.invite, handle: "rosa", password: "rosa-passphrase-1" });
const MEM_SESSION = (await realPost("login", null, { handle: "rosa", password: "rosa-passphrase-1" })).token;
const PUBLISHED = (await (await real.dispatchFetch("http://x/api/?op=agentpack",
  { headers: { authorization: `Bearer ${MEM_SESSION}` } })).json());
const PUBLISHED_ANSWER = PUBLISHED && typeof PUBLISHED === "object" && "result" in PUBLISHED ? PUBLISHED.result : PUBLISHED;
/* R48 (N157, §1a; T36, N695): the member reads the pack the plane renders and serves apart on `op=agentpack` (`pack`,
   control-plane R41) and renders nothing itself. The answer here is the real plane's with a STUB pack in place of the one
   it renders, carrying what the member reads (version, resident, disclosed), so a run's recorded skill can name it. */
const PACK = Object.freeze({
  id: "investigative-session", edition: "stub", version: "investigative-session@stub+0123456789abcdef",
  resident: { objective: { text: "find what the record holds, and state what it does not" },
              disclosable: [{ layer: "prohibitions", load_when: "before composing a version" }] },
  disclosed: { prohibitions: { load_when: "before composing a version", sourcing: "authored",
                               body: [{ text: "no single confidence score" }] } },
});
const PUBLISHED_WITH_PACK = { ...PUBLISHED_ANSWER, pack: PACK };
/* The real answer with no pack at all: the real plane serves one, so R48's no-pack arm takes the key away rather than
   relying on the plane to omit it. */
const { pack: _realPack, pack_absent: _realAbsent, ...PUBLISHED_NO_PACK } = PUBLISHED_ANSWER || {};
const planeNamespaces = (await (await real.dispatchFetch("http://x/api/?op=whoami&store=biosmoke", { headers: { authorization: `Bearer ${MEM_SESSION}` } })).json()).namespaces;
await real.dispose();

/* ============================================================ THE PLANE MOCK, reconfigurable per arm */
const STATUS_BY_BOUND = Object.fromEntries(
  [...Object.keys(RUN_BOUNDS), ...Object.keys(RUN_ENDINGS)].map((b) => [b, runStatusFor(b)]));
const PLANE_MOCK = `
const STATUS_BY_BOUND = ${JSON.stringify(STATUS_BY_BOUND)};
let CFG = {}, S = null;
function reset(cfg) {
  CFG = cfg || {};
  S = { log: [], runlog: (CFG.priorLog || []).slice(), seq: (CFG.priorLog || []).length,
        budget: Object.fromEntries((CFG.budget || []).map((b) => [b.bound, { allowed: b.allowed, consumed: b.consumed || 0 }])),
        refusals: new Map(), status: "running", ended: null, suggested: [], requests: [], spawns: 0, bvIds: [],
        /* ai-runs R10, R12, R19: a run opens with the empty scratch, a tick that hands a state replaces it, and
           op=airun publishes it (null when it cannot be read back). */
        state: CFG.state === undefined ? {} : CFG.state };
}
reset({});
/* the canonical bytes \`plane-suggest.mjs\`'s F10 branch keys a verbatim resubmit on */
const canon = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
};
const runCtx = (CFG) => (CFG.contextType || "inquiry") === "project"
  ? { type: "project", id: CFG.target || "INQ-1", questions: CFG.questions || CFG.cites || [] }
  : { type: CFG.contextType || "inquiry", id: CFG.target || "INQ-1" };
export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/__mock/reset") { reset(await req.json()); return Response.json({ ok: true }); }
    if (url.pathname === "/__mock/state")
      return Response.json({ log: S.log, runlog: S.runlog, budget: S.budget, status: S.status, ended: S.ended, state: S.state,
                             suggested: S.suggested, requests: S.requests, spawns: S.spawns, bvIds: S.bvIds,
                             repeats: [...S.refusals.values()].map((r) => r.repeats) });
    const op = url.searchParams.get("op") || "";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "") || "";
    let body = null;
    if (req.method === "POST") { try { body = await req.json(); } catch { body = null; } }
    S.log.push({ op, token, store: url.searchParams.get("store"), method: req.method, body,
                 query: Object.fromEntries(url.searchParams.entries()) });
    if ((CFG.silent || []).includes(op)) return new Response("<html>not json</html>", { status: 500 });
    const staged = (CFG.refuse_op || {})[op];
    if (staged) return Response.json(staged.body, { status: staged.status ?? 200 });
    if (token === ${JSON.stringify(REVOKED)})
      return Response.json({ ok: false, reason: "AI_CREDENTIAL_REVOKED", code: "AI_CREDENTIAL_REVOKED", check: "C-29.7",
        translation: "This agent credential has been withdrawn by a member of the group, so it no longer reaches anything here." },
        { status: 403 });
    if (op === "whoami")
      return Response.json({ ok: true, result: { tokenClass: "ai", session: false, member: null },
                             store: url.searchParams.get("store"), tokenClass: "ai", version: "plane-test" });
    if (op === "airun") {
      if (CFG.noSession) return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: false } });
      return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: true, session: {
        id: url.searchParams.get("run"), mode: CFG.mode === undefined ? "check" : CFG.mode, status: S.status, context: runCtx(CFG),
        ...(CFG.maxPasses != null ? { max_passes: CFG.maxPasses } : {}),
        principal: { plane: "member:ruth", claude: CFG.owner ?? CFG.payer ?? "member:ruth", ref: CFG.payer ?? "member:ruth", skill: CFG.skill ?? null },
        state: S.state,
        budget: Object.entries(S.budget).map(([bound, b]) => ({ bound, allowed: b.allowed, consumed: b.consumed, unit: null })),
      } } });
    }
    if (op === "airunlog")
      return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: true,
        entries: S.runlog, limit: 200, truncated: false } });
    if (op === "airunspawn") {
      S.spawns += 1;
      if (CFG.noPayload) return Response.json({ ok: true, result: { found: true, half: "search" } });
      const payload = { run: url.searchParams.get("run"), context: runCtx(CFG), mode: CFG.mode === undefined ? "check" : CFG.mode,
                        skill: CFG.skill ?? null, standard_pair: null, budget: [] };
      if (CFG.leakBias) payload.bias = { in_force: true, manifest: { statements_sha: "LENS-REQ" } };
      return Response.json({ ok: true, result: { found: true, half: "search", payload } });
    }
    /* control-plane R41: the door answers \`agentpack\` at the envelope's top level, as the real plane does above */
    if (op === "agentpack") return Response.json({ ...(CFG.published ?? {}), ok: true });
    ${meaningRowsBranch("CFG.meaningRows || []")}
    ${versionReadBranches()}
    if (op === "basisversions") {
      S.bvIds.push(url.searchParams.get("id"));
      return Response.json({ ok: true, result: { id: url.searchParams.get("id"),
        versions: (CFG.heldVersions || []).map((n) => ({ name: n })), limit: 50, truncated: false } });
    }
    if (op === "airuntick") {
      if (S.status !== "running") return Response.json({ ok: true, result: { ticked: false, status: S.status } });
      /* ai-runs R45 (N293), when the arm names the ceiling: a larger state refuses the whole tick, nothing written. */
      if (CFG.stateMax && body && body.state != null) {
        const bytes = new TextEncoder().encode(JSON.stringify(body.state)).length;
        if (bytes > CFG.stateMax)
          return Response.json({ ok: true, result: { ok: false, code: "AI_RUN_STATE_TOO_LARGE", reason: "AI_RUN_STATE_TOO_LARGE",
                                                     check: "C-22.18", bytes, limit: CFG.stateMax } });
      }
      /* observation-log R3, as the plane's \`checkObservation\` applies it to a member's entry: NEVER_LOOKED and an
         absent state are refused, per entry, the rest appended. */
      let appended = 0; const refused = [];
      for (const e of Array.isArray(body && body.log) ? body.log : []) {
        if (CFG.refuseEntries) refused.push(CFG.refuseEntries);
        else if (!e || typeof e.state !== "string" || e.state === "NEVER_LOOKED")
          refused.push({ ok: false, code: "AI_LOG_STATE_UNKNOWN", check: "C-22.1", detail: "NEVER_LOOKED is never stored" });
        else { S.runlog.push({ seq: ++S.seq, ...e }); appended += 1; }
      }
      for (const [k, v] of Object.entries((body && body.consume) || {}))
        if (S.budget[k]) S.budget[k].consumed += Number(v) || 0;
      if (body && body.state != null) S.state = body.state;
      const hit = ["fetches","subsessions","wallclock","runtime","lease"]
        .find((b) => S.budget[b] && S.budget[b].allowed > 0 && S.budget[b].consumed >= S.budget[b].allowed);
      if (hit) {
        const condition = hit === "runtime" ? "runtime-ceiling-reached" : null;
        S.runlog.push({ seq: ++S.seq, level: "document", state: "LOOKED_INDETERMINATE", terminal: 1, bound: hit, condition });
        S.status = "stopped"; S.ended = { bound: hit, condition };
        return Response.json({ ok: true, result: { ticked: true, appended, refused, status: "stopped",
                                                   ended: { terminated: true, bound: hit, condition } } });
      }
      return Response.json({ ok: true, result: { ticked: true, appended, refused, status: "running" } });
    }
    if (op === "airunclose") {
      const bound = (body && body.bound) || null;
      if (CFG.refuseClose)
        return Response.json({ ok: true, result: { ok: false, terminated: false, code: "AI_RUN_BOUND_UNKNOWN", check: "C-22.15" } });
      S.runlog.push({ seq: ++S.seq, level: "document", state: "LOOKED_INDETERMINATE", terminal: 1, bound, condition: null });
      S.status = STATUS_BY_BOUND[bound] || "finished"; S.ended = { bound, condition: null };
      return Response.json({ ok: true, result: { terminated: true, bound, condition: null } });
    }
    ${captureRequestBranch({ run: { principal: JSON.stringify(AIK), status: "S.status" } })}
    ${suggestBranch({ f10: true, run: { context: "runCtx(CFG)", cites: "(CFG.cites || [])",
                                        principal: JSON.stringify(AIK), status: "S.status" } })}
    return Response.json({ ok: false, error: "unknown op: " + op }, { status: 400 });
  },
};
`;

/* ============================================================ THE MODEL MOCK, behind every global fetch */
const MODEL_MOCK = `
let CFG = {}, M = { calls: [] };
export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/__model/reset") { CFG = await req.json(); M = { calls: [] }; return Response.json({ ok: true }); }
    if (url.pathname === "/__model/state") return Response.json(M);
    const raw = await req.text();
    M.calls.push({ url: req.url, method: req.method, key: req.headers.get("x-api-key"),
                   version: req.headers.get("anthropic-version"), bytes: raw.length, raw });
    if (CFG.silent) return new Response("<html>gateway</html>", { status: 502 });
    if (CFG.status) return Response.json({ type: "error", error: { type: CFG.errorType || "overloaded_error",
                                                                  message: "fixture failure" } }, { status: CFG.status });
    const body = JSON.parse(raw);
    /* The API refuses a request with no message; so does this mock. */
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages[0].role !== "user")
      return Response.json({ type: "error", error: { type: "invalid_request_error", message: "messages: at least one user message first" } }, { status: 400 });
    const n = M.calls.length;
    const reply = (content) => Response.json({ id: "msg_" + n, type: "message", role: "assistant", model: body.model,
      content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 } });
    const names = (body.tools || []).map((x) => x.name);
    const last = body.messages[body.messages.length - 1];
    /* …and every tool_use must be answered by a tool_result in the next message, as the API requires. */
    for (let i = 0; i < body.messages.length - 1; i++) {
      const uses = (Array.isArray(body.messages[i].content) ? body.messages[i].content : []).filter((b) => b.type === "tool_use");
      const next = body.messages[i + 1];
      const answered = new Set((Array.isArray(next.content) ? next.content : []).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id));
      if (uses.some((u) => !answered.has(u.id)))
        return Response.json({ type: "error", error: { type: "invalid_request_error", message: "tool_use without tool_result" } }, { status: 400 });
    }
    /* R61: a judged row opens with the facts as \`read_facts\`' result (ids \`facts_…\`); that is not a turn the model took. */
    const lastIsResult = Array.isArray(last.content)
      && last.content.some((b) => b.type === "tool_result" && !String(b.tool_use_id).startsWith("facts_"));
    if (names.includes("report")) {
      const sys = Array.isArray(body.system) ? body.system.map((x) => x.text).join("") : String(body.system);
      const contract = JSON.parse(sys.split("YOUR SPAWN CONTRACT:\\n")[1]);
      const rep = (CFG.reports || {})[contract.level];
      if (!lastIsResult && CFG.subQuery !== false)
        return reply([{ type: "tool_use", id: "q" + n, name: "meaningrows", input: { rows: "leg", q: "", limit: 5 } }]);
      if (rep === "silent") return reply([{ type: "text", text: "nothing to say" }]);
      return reply([{ type: "tool_use", id: "r" + n, name: "report",
                      input: rep ?? { state: "LOOKED_ABSENT", summary: "nothing supportable at " + contract.level } }]);
    }
    const prompt = [...body.messages].reverse().map((m) => (m.role !== "user" ? null : typeof m.content === "string" ? { content: m.content } : Array.isArray(m.content) && m.content.find((c) => c.type === "text") ? { content: m.content.filter((c) => c.type === "text").map((c) => c.text).join("") } : null)).find((m) => m && /judge_/.test(m.content));
    const step = (/Answer by calling judge_([a-z]+)/.exec(prompt ? prompt.content : "") || [])[1] || "";
    if (CFG.refuseAt === step)
      return Response.json({ id: "m", type: "message", role: "assistant", content: [], stop_reason: "refusal",
                             stop_details: { type: "refusal", category: null, explanation: "fixture decline" } });
    if (CFG.loadLayer && step === "plan" && !lastIsResult)
      return reply([{ type: "tool_use", id: "l" + n, name: "load_layer", input: { name: CFG.loadLayer } }]);
    return reply([{ type: "tool_use", id: "j" + n, name: "judge_" + step, input: (CFG.judge || {})[step] ?? {} }]);
  },
};
`;

const newMf = (vars = {}, opts = {}) => new Miniflare({
  workers: [
    { name: "agent-worker", modules: true, modulesRoot: "/", scriptPath: WORKER_SRC,
      modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
      bindings: { VERSION: "req-test", ...vars },
      ...(opts.noPlane ? {} : { serviceBindings: { PLANE: "plane-mock" } }),
      outboundService: "model-mock" },
    { name: "plane-mock", modules: true, script: PLANE_MOCK,
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] },
    { name: "model-mock", modules: true, script: MODEL_MOCK,
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"] },
  ],
});

/* EVERY ANSWER THE MEMBER GIVES in this suite is kept, for the arms that are about every answer (R36, R46, R47). */
const ANSWERS = [];
const call = async (mf, path, init) => {
  const res = await mf.dispatchFetch(`http://agent-worker/${path}`, init);
  const text = await res.text();
  let out = null; try { out = JSON.parse(text); } catch { out = null; }
  ANSWERS.push({ status: res.status, headers: Object.fromEntries(res.headers.entries()), text });
  return { status: res.status, out: out ?? {}, headers: Object.fromEntries(res.headers.entries()) };
};
const runOp = (mf, body) => call(mf, "run", { method: "POST", body: JSON.stringify(withAccount(body)) });
const reset = async (mf, plane = {}, model = {}) => {
  await (await mf.getWorker("plane-mock")).fetch("http://plane/__mock/reset",
    { method: "POST", body: JSON.stringify({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-1",
                                             skill: PACK.version, published: PUBLISHED_WITH_PACK, ...plane }) });
  await (await mf.getWorker("model-mock")).fetch("http://model/__model/reset", { method: "POST", body: JSON.stringify(model) });
};
const planeState = async (mf) => (await (await (await mf.getWorker("plane-mock")).fetch("http://plane/__mock/state")).json());
const modelState = async (mf) => (await (await (await mf.getWorker("model-mock")).fetch("http://model/__model/state")).json());
const base = { run_id: "run-1", store: "scratch", credential: AIK };
/* The supplied mode's judgements for one pass: plan, collect, compose, dedup (adjust only when a refusal comes). */
const J = (reports = [], candidates = []) => [{ targets: [] }, { reports }, { candidates }, {}];
/* agent-harness R15: a pass that adds nothing new closes the run, so a run meant to go on for its pass limit
   submits a new candidate in every pass: `JN(n)` is n such passes' judgements, each with a candidate of its own name. */
const JN = (n) => Array.from({ length: n }, (_, i) =>
  J([], [{ kind: "basis-version", name: `pass-${i + 1}`, description: `the reading of pass ${i + 1}, in full` }])).flat();
const OPS_SEEN = new Set();
const seen = async (mf) => { for (const l of (await planeState(mf)).log) OPS_SEEN.add(l.op); };

const mf = newMf();

/* ============================================================ POST /run: the checks before any plane call */
section("R1 · no plane binding: 503 PLANE_NOT_CONFIGURED, before the body is read");
{
  const bare = newMf({}, { noPlane: true });
  const a = await call(bare, "run", { method: "POST", body: JSON.stringify(base) });
  const b = await call(bare, "run", { method: "POST", body: "{{{ not json" });
  t("R1: env.PLANE.fetch absent -> 503 PLANE_NOT_CONFIGURED, and an unreadable body gets the same answer (not read)",
    [a.status, a.out.code, b.status, b.out.code], [503, "PLANE_NOT_CONFIGURED", 503, "PLANE_NOT_CONFIGURED"]);
  t("R1: the refusal has the member's shape: {ok:false, reason, code, detail, worker} with reason equal to code",
    [a.out.ok, a.out.reason === a.out.code, typeof a.out.detail, a.out.worker], [false, true, "string", "agent-worker"]);
  await bare.dispose();
}

section("R2–R7 · each malformed request refused by its code, in order, with no plane call made");
{
  await reset(mf);
  const cases = [
    ["R2", "a body that is not JSON", "{{{", 400, "BAD_BODY"],
    ["R3", "run_id absent", { store: "scratch", credential: AIK }, 400, "BAD_RUN_ID"],
    ["R3", "run_id not a string", { run_id: 7, store: "scratch", credential: AIK }, 400, "BAD_RUN_ID"],
    ["R3", "run_id empty", { run_id: "", store: "scratch", credential: AIK }, 400, "BAD_RUN_ID"],
    ["R3", "run_id of 201 characters", { run_id: "r".repeat(201), store: "scratch", credential: AIK }, 400, "BAD_RUN_ID"],
    ["R4", "store absent", { run_id: "r", credential: AIK }, 400, "BAD_STORE"],
    ["R4", "store not a string", { run_id: "r", store: 1, credential: AIK }, 400, "BAD_STORE"],
    ["R4", "store empty", { run_id: "r", store: "", credential: AIK }, 400, "NAMESPACE_UNKNOWN"],
    ["R4", "store in another case", { run_id: "r", store: "Scratch", credential: AIK }, 400, "NAMESPACE_UNKNOWN"],
    ["R4", "store padded", { run_id: "r", store: "bio ", credential: AIK }, 400, "NAMESPACE_UNKNOWN"],
    ["R4", "store no instance holds", { run_id: "r", store: "biosmoke", credential: AIK }, 400, "NAMESPACE_UNKNOWN"],
    ["R5", "credential absent", { run_id: "r", store: "scratch" }, 401, "NO_CREDENTIAL"],
    ["R5", "credential empty", { run_id: "r", store: "scratch", credential: "" }, 401, "NO_CREDENTIAL"],
    ["R5", "credential of another shape", { run_id: "r", store: "scratch", credential: "hunter2" }, 400, "BAD_CREDENTIAL_SHAPE"],
    ["R5", "credential with upper-case hex", { run_id: "r", store: "scratch", credential: "aik-" + "A".repeat(64) }, 400, "BAD_CREDENTIAL_SHAPE"],
    ["R5", "credential one hex short", { run_id: "r", store: "scratch", credential: "aik-" + "a".repeat(63) }, 400, "BAD_CREDENTIAL_SHAPE"],
    ["R6", "account absent", { ...base, account: undefined }, 409, "NO_ACCOUNT"],
    ["R6", "account null", { ...base, account: null }, 409, "NO_ACCOUNT"],
    ["R6", "account an array", { ...base, account: [] }, 400, "BAD_ACCOUNT"],
    ["R6", "account a string", { ...base, account: "x" }, 400, "BAD_ACCOUNT"],
    ["R6", "account of a kind agent-model does not take", { ...base, account: { ...ACCOUNTS, kind: "password" } }, 400, "BAD_ACCOUNT"],
    ["R6", "account naming no member", { ...base, account: { kind: "apikey", level: "member", secret: CLAUDE_TOKEN } }, 400, "BAD_ACCOUNT"],
    ["R6", "account naming no level", { ...base, account: { kind: "apikey", secret: CLAUDE_TOKEN, member: MEMBER } }, 400, "BAD_ACCOUNT"],
    ["R6, R71", "account at the project level naming no project", { ...base, account: { ...ACCOUNTS, level: "project" } }, 400, "BAD_ACCOUNT"],
    ["R6", "account at the instance level (there is none)", { ...base, account: { ...ACCOUNTS, level: "instance" } }, 400, "BAD_ACCOUNT"],
    ["R6", "the team's account as a subscription (the group's is an API key only)", { ...base, account: { ...GROUP_ACCOUNT, kind: "subscription" } }, 400, "BAD_ACCOUNT"],
    ["R6", "the team's account with an empty secret", { ...base, account: { ...GROUP_ACCOUNT, secret: "" } }, 409, "NO_ACCOUNT"],
    ["R6", "a body still carrying claude_accounts", { ...base, account: ACCOUNTS, claude_accounts: {} }, 400, "BAD_ACCOUNT"],
    ["R6", "account with an empty secret", { ...base, account: { ...ACCOUNTS, secret: "" } }, 409, "NO_ACCOUNT"],
    ["R6", "(T38) a member's own subscription, retired (credentials R22)", { ...base, account: { ...ACCOUNTS, kind: "subscription" } }, 400, "BAD_ACCOUNT"],
    ["R6", "(T47, R82) a sign-in carrying no secret", { ...base, account: { ...SIGNIN, secret: undefined } }, 409, "SIGNIN_NOT_HELD"],
    ["R6", "(T47, R82) a sign-in carrying an empty secret", { ...base, account: { ...SIGNIN, secret: "" } }, 409, "SIGNIN_NOT_HELD"],
    ["R6", "(T47, R82) a sign-in whose secret is not a string", { ...base, account: { ...SIGNIN, secret: ["x"] } }, 400, "BAD_ACCOUNT"],
    ["R6", "(T46) a sign-in with suggestions not a boolean", { ...base, account: { ...SIGNIN, suggestions: "no" } }, 400, "BAD_ACCOUNT"],
    ["R6", "(T38) a sign-in at the group level (the group's is an API key only)", { ...base, account: { ...SIGNIN, level: "group" } }, 400, "BAD_ACCOUNT"],
    ["R6", "(T38) a sign-in naming no member", { ...base, account: { kind: "signin", level: "member", suggestions: false } }, 400, "BAD_ACCOUNT"],
    ["R6", "(T38) a sign-in naming an empty member", { ...base, account: { ...SIGNIN, member: "" } }, 400, "BAD_ACCOUNT"],
    ["R7", "turns zero", { ...base, turns: 0 }, 400, "BAD_TURNS"],
    ["R7", "turns negative", { ...base, turns: -3 }, 400, "BAD_TURNS"],
    ["R7", "turns not a number", { ...base, turns: "many" }, 400, "BAD_TURNS"],
    ["R7", "turns above the bound", { ...base, turns: 121 }, 400, "SEGMENT_OVER_BOUND"],
  ];
  for (const [id, label, body, status, code] of cases) {
    const r = await call(mf, "run", { method: "POST", body: typeof body === "string" ? body
      : JSON.stringify(id === "R6" ? { judgements: [], ...body } : withAccount(body)) });
    t(`${id}: ${label} -> ${status} ${code}`, [r.status, r.out.code, r.out.reason], [status, code, code]);
  }
  t("R2–R7: and not one of those requests reached the plane", (await planeState(mf)).log, []);

  const ns = await runOp(mf, { run_id: "r", store: "n".repeat(100), credential: AIK });
  t("R4: NAMESPACE_UNKNOWN carries `asked` cut to 80 characters and `namespaces`, the two in order",
    [ns.out.asked, ns.out.namespaces], ["n".repeat(80), ["bio", "scratch"]]);
  t("R4: the set equals the plane's — the REAL plane's own refusal lists the same namespaces", ns.out.namespaces, planeNamespaces);
  const none = await call(mf, "run", { method: "POST", body: JSON.stringify({ ...base, judgements: [] }) });
  t("R6: NO_ACCOUNT carries capability 'unavailable', and is refused before any plane call (D-260 as K1503 reads it)",
    [none.status, none.out.code, none.out.capability, (await planeState(mf)).log.length], [409, "NO_ACCOUNT", "unavailable", 0]);
  const old = await runOp(mf, { ...base, account: ACCOUNTS, claude_accounts: { member: { token: CLAUDE_TOKEN } } });
  t("R6: a body still carrying claude_accounts is refused BAD_ACCOUNT naming the field", [old.out.code, old.out.field],
    ["BAD_ACCOUNT", "claude_accounts"]);
  const over = await runOp(mf, { ...base, turns: 400 });
  t("R7: SEGMENT_OVER_BOUND names turns_requested, turns_bound and bound_source; refused, never clamped",
    [over.out.turns_requested, over.out.turns_bound, typeof over.out.bound_source === "string" && over.out.bound_source.length > 0],
    [400, 120, true]);
  t("R7: its detail names the CPU ceiling the bound keeps clear of, and no memory ceiling",
    [/CPU/.test(over.out.detail ?? ""), /MEMORY/i.test(over.out.detail ?? "")], [true, false]);
  await reset(mf);
  const omitted = await runOp(mf, { ...base, judgements: J() });
  const exact = await runOp(mf, { ...base, turns: 120, judgements: J() });
  t("R7: `turns` absent means the bound (120 by default), and exactly the bound is accepted",
    [omitted.out.segment?.turns_requested, omitted.out.segment?.turns_bound, exact.status], [120, 120, 200]);
  for (const [v, want] of [["40", 40], ["0", 120], ["-5", 120], ["abc", 120]]) {
    const m = newMf({ MAX_TURNS_PER_SEGMENT: v });
    await reset(m);
    const r = await runOp(m, { ...base, turns: want + 1 });
    t(`R7: env.MAX_TURNS_PER_SEGMENT=${JSON.stringify(v)} -> the bound is ${want} (a positive number, else 120)`,
      [r.out.code, r.out.turns_bound], ["SEGMENT_OVER_BOUND", want]);
    await m.dispose();
  }
}

section("R8 · op=whoami under the credential: silent 502, refused 403 with the plane's body");
{
  await reset(mf, { silent: ["whoami"] });
  const s = await runOp(mf, base);
  t("R8: a silent plane (a body that is not JSON) -> 502 PLANE_SILENT with detail_from_binding",
    [s.status, s.out.code, typeof s.out.detail_from_binding], [502, "PLANE_SILENT", "string"]);
  await reset(mf);
  const r = await runOp(mf, { ...base, credential: REVOKED });
  t("R8: a refused credential -> 403 PLANE_REFUSED with run_id, store, plane_status and the plane's body unchanged",
    [r.status, r.out.reason, r.out.run_id, r.out.store, r.out.plane_status, r.out.plane?.code, r.out.plane?.check,
     r.out.plane?.translation],
    [403, "PLANE_REFUSED", "run-1", "scratch", 403, "AI_CREDENTIAL_REVOKED", "C-29.7",
     "This agent credential has been withdrawn by a member of the group, so it no longer reaches anything here."]);
  t("R8: whoami was the first and only call", (await planeState(mf)).log.map((l) => l.op), ["whoami"]);
}

/* ============================================================ the run's facts come from the record */
section("R9 · op=airun: silent, refused, no such run; the record's mode, never the body's");
{
  await reset(mf, { silent: ["airun"] });
  t("R9: airun silent -> 502 PLANE_SILENT", [(await runOp(mf, base)).out.code], ["PLANE_SILENT"]);
  await reset(mf, { refuse_op: { airun: { body: { ok: true, result: { ok: false, reason: "AI_RUN_NOT_VISIBLE", check: "C-22.9" } } } } });
  const r = await runOp(mf, base);
  t("R9: airun refused (inside `result`) -> 403 PLANE_REFUSED carrying the plane's body",
    [r.status, r.out.reason, r.out.plane?.result?.reason], [403, "PLANE_REFUSED", "AI_RUN_NOT_VISIBLE"]);
  await reset(mf, { noSession: true });
  const n = await runOp(mf, base);
  t("R9: no session -> 404 NO_SUCH_RUN with the run id", [n.status, n.out.code, n.out.run_id], [404, "NO_SUCH_RUN", "run-1"]);
  await reset(mf, { mode: "investigate" });
  const m = await runOp(mf, { ...base, mode: "check", judgements: J() });
  t("R9: a `mode` in the body has no effect — the record says investigate and the run closes at the gate",
    [m.out.mode, m.out.ended?.bound], ["investigate", "mode-not-deployed"]);
  await reset(mf, { maxPasses: 2, budget: [{ bound: "fetches", allowed: 1, consumed: 1 }] });
  const b = await runOp(mf, { ...base, judgements: J() });
  t("R9: the budget is the record's — a spent `fetches` allowance ends the run before any fan-out",
    [b.out.ended?.bound, (await planeState(mf)).spawns], ["fetches", 0]);
}

section("R10, R57 · the run's recorded account holder must be the member whose reference arrived");
{
  await reset(mf, { payer: "member:sam" });
  const r = await runOp(mf, { ...base, account: ACCOUNTS });
  const st = await planeState(mf);
  t("R10: recorded member:sam, Ruth's reference supplied -> 409 RUN_NAMES_A_DIFFERENT_PAYER with recorded and supplied (ids, never a secret)",
    [r.status, r.out.code, r.out.recorded, r.out.supplied, JSON.stringify(r.out).includes(CLAUDE_TOKEN)],
    [409, "RUN_NAMES_A_DIFFERENT_PAYER", "member:sam", MEMBER, false]);
  t("R10, R57: before any step — only whoami and airun were asked, and nothing was written", st.log.map((l) => l.op), ["whoami", "airun"]);
  t("R10: and no model turn was taken", (await modelState(mf)).calls.length, 0);
  await reset(mf, { payer: "member:sam" });
  const supplied = await runOp(mf, { ...base, account: ACCOUNTS, judgements: J() });
  t("R10, R57: the stubbed path is held to the same check", [supplied.status, supplied.out.code], [409, "RUN_NAMES_A_DIFFERENT_PAYER"]);
  await reset(mf, { payer: "member:sam" });
  const own = await runOp(mf, { ...base, account: { ...ACCOUNTS, member: "member:sam" }, judgements: J() });
  t("R10 (control): the starter's own reference drives", own.status, 200);
  await reset(mf, { payer: "member:sam" });
  const group = await runOp(mf, { ...base, account: GROUP_ACCOUNT, judgements: J() });
  t("R10, R57 (K1755): the group's API key serving Ruth's act, on Sam's run -> refused the same way: the group key serves "
    + "a member's act, never the team's own",
    [group.status, group.out.code, group.out.recorded, group.out.supplied, JSON.stringify(group.out).includes(CLAUDE_TOKEN)],
    [409, "RUN_NAMES_A_DIFFERENT_PAYER", "member:sam", MEMBER, false]);
  await reset(mf, { payer: "member:sam" });
  const groupOwn = await runOp(mf, { ...base, account: { ...GROUP_ACCOUNT, member: "member:sam" }, judgements: J() });
  t("R10, R57 (control): the group's API key serving Sam's own act on Sam's run drives, still Sam's act",
    [groupOwn.status, groupOwn.out.claude_account], [200, { available: true, kind: "apikey", level: "group", member: "member:sam" }]);
}

section("R11 · op=airunlog: silent 502, refused 403; resumed_from counts its entries");
{
  await reset(mf, { silent: ["airunlog"] });
  t("R11: airunlog silent -> 502 PLANE_SILENT", (await runOp(mf, base)).out.code, "PLANE_SILENT");
  await reset(mf, { refuse_op: { airunlog: { status: 403, body: { ok: false, reason: "AI_RUN_NOT_PRINCIPAL", check: "C-22.12" } } } });
  const r = await runOp(mf, base);
  t("R11: airunlog refused -> 403 PLANE_REFUSED", [r.status, r.out.reason, r.out.plane?.reason], [403, "PLANE_REFUSED", "AI_RUN_NOT_PRINCIPAL"]);
  const prior = Array.from({ length: 5 }, (_, i) => ({ seq: i + 1, level: "document", state: "LOOKED_ABSENT", subject: "earlier" }));
  await reset(mf, { priorLog: prior });
  const c = await runOp(mf, { ...base, judgements: J() });
  t("R11: resumed_from is the number of entries the log holds, and the resume row continues rather than restarting",
    [c.out.resumed_from, /continuing rather than restarting/.test(c.out.trace?.find((x) => x.step === "resume")?.why ?? "")],
    [5, true]);

  /* N153: the state op=airun publishes (ai-runs R19) is where a resumed run continues. */
  const hop = (out) => (out.trace || []).map((x) => `${x.step}>${x.to}`);
  /* R91 (R085): a segment also sends one closing tick, `segment_end`, beside its step ticks; this counts step ticks. */
  const ticks = (st) => st.log.filter((l) => l.op === "airuntick" && !("segment_end" in (l.body || {})));
  await reset(mf);
  const fresh = await runOp(mf, { ...base, judgements: J() });
  const freshTicks = ticks(await planeState(mf));
  t("R11: a run whose published state is the empty scratch it opened with starts from the resume row: resume -> plan",
    [hop(fresh.out).slice(0, 3), /names no step yet/.test(fresh.out.trace?.[1]?.why ?? "")],
    [["gate-mode>resume", "resume>plan", "plan>fanout"], true]);
  t("R11: every tick after the gate publishes the table's state at the step it moves to; the gate's publishes none",
    [freshTicks.length, "state" in (freshTicks[0].body || {}),
     freshTicks.slice(1).every((k, i) => k.body?.state?.step === fresh.out.trace[i + 1].to)],
    [fresh.out.trace.length, false, true]);
  t("R11: the published state carries the table's fields and never the run's mode, target, pass limit or budget",
    Object.keys(freshTicks[1].body.state).sort(),
    ["adjusted", "candidates", "composed", "holdings", "pass", "passAdded", "queue", "refusal", "refusedSubmission", "reportsRefused",
     "reports", "rereads", "step", "submission", "targets", "kept", "wrote", "disagreed", "scope"].sort());

  /* Two segments of one run: the first stops at its step bound mid-pass, the second continues where it stopped. */
  const REPORTS = [{ level: "meaning", state: "LOOKED_ABSENT", observed_at: "log:1" }];
  await reset(mf, { budget: wide });
  const seg1 = await runOp(mf, { ...base, max_steps: 4, judgements: J(REPORTS) });
  const mid = await planeState(mf);
  t("R11: a segment stopped by its step bound mid-pass leaves the state at the step it did not reach",
    [hop(seg1.out), seg1.out.ended, mid.state?.step, mid.state?.pass, mid.spawns],
    [["gate-mode>resume", "resume>plan", "plan>fanout", "fanout>collect"], null, "collect", 0, 4]);
  const seg2 = await (async () => {
    await (await mf.getWorker("plane-mock")).fetch("http://plane/__mock/reset", { method: "POST", body: JSON.stringify({
      mode: "check", maxPasses: 1, budget: wide, target: "INQ-1", skill: PACK.version, published: PUBLISHED_WITH_PACK,
      state: mid.state, priorLog: mid.runlog }) });
    return runOp(mf, { ...base, judgements: [{ reports: REPORTS }, { candidates: [] }, {}] });
  })();
  const after2 = await planeState(mf);
  t("R11: the next segment continues at that state — resume -> collect, no second fan-out — and finishes the run",
    [hop(seg2.out).slice(0, 3), after2.spawns, seg2.out.passes, seg2.out.ended?.bound, seg2.out.resumed_from],
    [["gate-mode>resume", "resume>collect", "collect>compose"], 0, 1, "completed", mid.runlog.length]);
  t("R11: …and the resume row says where it continued", /published its state at 'collect'/.test(seg2.out.trace?.[1]?.why ?? ""), true);

  await reset(mf, { maxPasses: 1, state: { step: "plan", pass: 1, queue: [] } });
  const done = await runOp(mf, { ...base, judgements: J() });
  t("R11: the pass count is the state's: one pass done of one closes at the resume row, spawning nothing",
    [hop(done.out), done.out.passes, done.out.ended?.bound, (await planeState(mf)).spawns],
    [["gate-mode>resume", "resume>close"], 1, "completed", 0]);

  await reset(mf, { mode: "investigate", state: { step: "dedup", pass: 0 } });
  t("R11: the gate still comes first — a published state never carries a run past a mode that is not deployed",
    hop((await runOp(mf, { ...base, judgements: J() })).out), ["gate-mode>close"]);

  await reset(mf, { target: "INQ-1", state: { step: "compose", pass: 0, mode: "investigate", target: "INQ-OTHER",
                                             maxPasses: 9, budget: { fetches: { allowed: 1, consumed: 1 } } } });
  const foreign = await runOp(mf, { ...base, judgements: [{ candidates: [] }, {}] });
  t("R11: mode, target, pass limit and budget in a published state have no effect; the record's hold",
    [foreign.out.mode, foreign.out.target?.id, hop(foreign.out).slice(0, 2), foreign.out.ended?.bound, foreign.out.passes],
    ["check", "INQ-1", ["gate-mode>resume", "resume>compose"], "completed", 1]);

  for (const [label, st] of [["a step no row holds", { step: "wat", pass: 0 }], ["the gate", { step: "gate-mode", pass: 0 }],
                             ["a negative pass", { step: "dedup", pass: -1 }], ["a state that is not an object", "dedup"]]) {
    await reset(mf, { state: st });
    const r = await runOp(mf, { ...base, judgements: J() });
    t(`R11: a published state naming ${label} is not continued from: resume -> plan, and it says so`,
      [hop(r.out)[1], /UNDETERMINED|names no step/.test(r.out.trace?.[1]?.why ?? "")], ["resume>plan", true]);
  }
  await reset(mf, { state: null });
  const unread = await runOp(mf, { ...base, judgements: J() });
  t("R11: a state the plane cannot read back (null) starts from the resume row, and says so",
    [hop(unread.out)[1], /publishes no state/.test(unread.out.trace?.[1]?.why ?? "")], ["resume>plan", true]);
}

section("R12 · the target is the run's context, never a project id");
{
  await reset(mf, { target: "INQ-R12" });
  t("R12: an inquiry context's id is the target", (await runOp(mf, { ...base, judgements: J() })).out.target,
    { id: "INQ-R12", basis: localize("agent-harness.harness.the_runs_context_question", "the run's context question") });
  await reset(mf, { contextType: "project", target: "PROJ-R12", questions: ["INQ-ONE"] });
  t("R12: a project context's one published question is the target",
    (await runOp(mf, { ...base, judgements: J() })).out.target?.id, "INQ-ONE");
  await reset(mf, { contextType: "project", target: "PROJ-R12", questions: ["INQ-A", "INQ-B"] });
  const several = (await runOp(mf, { ...base, judgements: J() })).out.target;
  t("R12: several questions -> null, the basis UNDETERMINED and never the project id",
    [several?.id, /^UNDETERMINED/.test(several?.basis ?? "")], [null, true]);
  const at = (ctx) => runContextTarget({ context: ctx });
  t("R12: none, not published, an unread kind and no id -> null, each with an UNDETERMINED basis",
    [at({ type: "project", id: "P", questions: [] }), at({ type: "project", id: "P" }), at({ type: "bundle", id: "B" }),
     at({ type: "inquiry" })].map((x) => [x.target, /^UNDETERMINED/.test(x.basis)]),
    [[null, true], [null, true], [null, true], [null, true]]);
}

/* ============================================================ the control-flow table, pure */
section("agent-harness R1 · the rows, their declared edges, and nextStep held to them");
{
  t("agent-harness R1: the rows are exactly gate-mode, resume, plan, fanout, collect, compose, dedup, submit, adjust, next-pass, close",
    Object.keys(CONTROL_FLOW), ["gate-mode", "resume", "plan", "fanout", "collect", "compose", "dedup", "submit",
                                "adjust", "next-pass", "close"]);
  const illegal = [];
  for (const step of Object.keys(CONTROL_FLOW))
    for (const mode of ["check", "investigate", "", "wat"])
      for (const pass of [0, 1, 3]) for (const maxPasses of [0, 1, 3])
        for (const refusal of [null, { code: "X" }]) for (const adjusted of [false, true])
          for (const q of [0, 1, 2]) for (const budget of [null, { fetches: { allowed: 1, consumed: 1 } }])
          for (const resumeAt of [null, "collect", "adjust", "gate-mode", "wat"]) {
            const d = nextStep({ step, mode, pass, maxPasses, refusal, adjusted, budget, resumeAt,
                                 queue: Array.from({ length: q }, (_, i) => ({ name: `c${i}` })) });
            if (!CONTROL_FLOW[step].to.includes(d.step) && !(step === "close" && d.step === "close")) illegal.push([step, d.step]);
          }
  t("agent-harness R1: nextStep never returns a step outside its row's declared `to`, over every combination walked", illegal, []);
  t("agent-harness R1: there is no edge from compose to submit", CONTROL_FLOW.compose.to.includes("submit"), false);
  t("agent-harness R1: a refused submit goes to adjust, never back to submit",
    nextStep({ step: "submit", mode: "check", pass: 0, maxPasses: 3, refusal: { code: "X" }, queue: [{ name: "a" }] }).step, "adjust");
  const unknown = nextStep({ step: "nowhere", pass: 0, maxPasses: 3 });
  t("agent-harness R1: an unknown step closes with `completed` and says so",
    [unknown.step, unknown.bound, /not a row/.test(unknown.why)], ["close", "completed", true]);
}

section("agent-harness R2 · gate-mode is first; an undeployed mode closes mode-not-deployed before anything is spent");
{
  /* skillsequencing's agent-worker share (T17 convert): every held mode not deployed, an ABSENT mode and a mis-spelled
     one each close mode-not-deployed; plan (R53) is deployed since T46 (Bob's K2892), so it is not among them. */
  for (const mode of ["investigate", "extract", "sorcery", null, "", "Check"]) {
    await reset(mf, { mode });
    const r = await runOp(mf, { ...base, judgements: J() });
    const st = await planeState(mf);
    t(`agent-harness R2: mode '${mode}' -> closed at its first step, bound mode-not-deployed, after only the run and log reads`,
      [r.out.trace?.map((x) => x.step), r.out.ended?.bound, st.log.map((l) => l.op), st.spawns, st.suggested.length],
      /* R91 (R085): the last call is the segment's own `segment_end` tick, after the close. */
      [["gate-mode"], "mode-not-deployed", ["whoami", "airun", "airunlog", "airuntick", "airunclose", "airuntick"], 0, 0]);
    const why = r.out.trace?.[0]?.why ?? "";
    t(`agent-harness R2: its why ${MODES[mode] ? "says the table holds it and has not deployed it" : "says the table does not hold the word"}, and names the deployed modes`,
      [MODES[mode] ? /not deployed yet/.test(why) : /no mode this table knows/.test(why), /deployed now: check/.test(why)],
      [true, true]);
    t(`agent-harness R2: …and the close was written (${mode})`, st.ended?.bound, "mode-not-deployed");
  }
  t("agent-harness R2, R53 (T46): the first step is gate-mode, and check and plan are deployed while investigate and extract are not",
    /* read with `?.`: a deleted row FAILS this arm instead of killing the suite (found by harness.control E2, T21) */
    [FIRST_STEP, MODES.check?.deployed, MODES.investigate?.deployed, MODES.extract?.deployed, MODES.plan?.deployed],
    ["gate-mode", true, false, false, true]);
  t("agent-harness R2 (skillsequencing): MODES is exactly the recorded set, the one deployment order's members",
    Object.keys(MODES), DEPLOYMENT_SEQUENCE.order);
}

section("agent-harness R3 · stopBecause: fetches, subsessions, wallclock, then the pass limit");
{
  const full = { fetches: { allowed: 1, consumed: 1 }, subsessions: { allowed: 1, consumed: 1 }, wallclock: { allowed: 1, consumed: 1 } };
  t("agent-harness R3: the bounds are asked in order fetches, subsessions, wallclock, and the first spent one closes",
    [stopBecause({ budget: full, pass: 0, maxPasses: 3 }),
     stopBecause({ budget: { ...full, fetches: { allowed: 2, consumed: 1 } }, pass: 0, maxPasses: 3 }),
     stopBecause({ budget: { wallclock: full.wallclock }, pass: 0, maxPasses: 3 })],
    ["fetches", "subsessions", "wallclock"]);
  t("agent-harness R3: an absent or non-positive allowance never stops a run",
    [stopBecause({ budget: {}, pass: 0, maxPasses: 3 }),
     stopBecause({ budget: { fetches: { allowed: 0, consumed: 9 }, subsessions: { allowed: -1, consumed: 9 } }, pass: 0, maxPasses: 3 })],
    [null, null]);
  t("agent-harness R3: then pass count >= the pass limit closes `completed`",
    [stopBecause({ pass: 3, maxPasses: 3 }), stopBecause({ pass: 2, maxPasses: 3 })], ["completed", null]);
  await reset(mf, { maxPasses: 2 });
  const two = await runOp(mf, { ...base, judgements: JN(2) });
  t("agent-harness R3: the limit is the run's max_passes when positive (2 -> two passes, each counted at next-pass)",
    [two.out.passes, two.out.trace?.filter((x) => x.step === "next-pass").length, two.out.ended?.bound], [2, 2, "completed"]);
  await reset(mf, { maxPasses: null });
  const dflt = await runOp(mf, { ...base, judgements: JN(3) });
  t("agent-harness R3: and 3 when the run names none", dflt.out.passes, 3);
}

section("agent-harness R4 · judgements taken in order, one per judged row; a judgement reaching control flow refused");
{
  const judged = Object.keys(CONTROL_FLOW).filter((s) => CONTROL_FLOW[s].judged);
  t("agent-harness R4: the judged rows are plan, collect, compose, dedup, adjust", judged, ["plan", "collect", "compose", "dedup", "adjust"]);
  t("agent-harness R4: the fields a judgement may set are exactly these, and the ones it may not are exactly these",
    [JUDGEABLE, NOT_JUDGEABLE],
    [["targets", "reports", "candidates", "queue", "adjusted", "submission", "level", "observed", "governed", "condition", "disagreements"],
     ["pass", "maxPasses", "step", "budget", "mode", "bound", "run", "store", "target"]]);
  t("agent-harness R4: every NOT_JUDGEABLE field is refused and named, pure",
    NOT_JUDGEABLE.map((f) => applyJudgement({}, { [f]: 1 }).overreach), NOT_JUDGEABLE.map((f) => [f]));
  t("agent-harness R4: only JUDGEABLE fields are applied; anything else is ignored, not stored",
    applyJudgement({ pass: 1 }, { candidates: [1], whimsy: 2 }).state, { pass: 1, candidates: [1] });
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: [{ targets: [] }, { reports: [], target: "INQ-OTHER", mode: "x" }] });
  t("agent-harness R4: through the op, a judgement naming target and mode at collect -> 400 JUDGEMENT_OVERREACH with step and fields",
    [r.status, r.out.code, r.out.step, r.out.fields], [400, "JUDGEMENT_OVERREACH", "collect", ["target", "mode"]]);
  await reset(mf);
  const ok = await runOp(mf, { ...base, judgements: [{ targets: [] }] });
  t("agent-harness R4: a judged row with no judgement left carries the state on (the run completes)", [ok.status, ok.out.ended?.bound], [200, "completed"]);
}

/* ============================================================ what each row does against the plane */
section("R17 · fanout: one spawn per level, the contract built key by key, 4 sub-sessions spent");
{
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: J() });
  const st = await planeState(mf);
  const spawns = st.log.filter((l) => l.op === "airunspawn");
  t("R17: one op=airunspawn (half=search) per level", [spawns.length, [...new Set(spawns.map((l) => l.query.half))]], [4, ["search"]]);
  t("R17: the contracts are one per level, in meaning, content, document, internet order",
    r.out.fanout?.contracts?.map((c) => c.level), ["meaning", "content", "document", "internet"]);
  t("R17: each contract has exactly the keys level, run, context, mode, skill, standard_pair, standard, scope, returns",
    [...new Set((r.out.fanout?.contracts || []).map((c) => Object.keys(c).join(",")))], [SPAWN_KEYS.join(",")]);
  t("R17: each is scoped [\"meaningrows\"], and the scope is published", [r.out.fanout?.scope,
    [...new Set((r.out.fanout?.contracts || []).map((c) => JSON.stringify(c.scope)))]], [["meaningrows"], ['["meaningrows"]']]);
  t("R17: the fanout spends 4 subsessions", st.budget.subsessions.consumed, 4);
  await reset(mf, { leakBias: true });
  const lens = await runOp(mf, { ...base, judgements: J() });
  t("R17: a payload carrying `bias` -> 502 SPAWN_PAYLOAD_CARRIES_LENS naming the level",
    [lens.status, lens.out.code, lens.out.level], [502, "SPAWN_PAYLOAD_CARRIES_LENS", "meaning"]);
  await reset(mf, { noPayload: true });
  const none = await runOp(mf, { ...base, judgements: J() });
  t("R17: no payload -> 502 SPAWN_PAYLOAD_MISSING", [none.status, none.out.code], [502, "SPAWN_PAYLOAD_MISSING"]);
  await reset(mf, { refuse_op: { airunspawn: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", check: "C-29.9" } } } });
  const ref = await runOp(mf, { ...base, judgements: J() });
  t("R17: a refused spawn -> 403 PLANE_REFUSED with the plane's body", [ref.status, ref.out.reason, ref.out.plane?.reason],
    [403, "PLANE_REFUSED", "AI_BEYOND_TASK_SCOPE"]);
  const { spawnContracts } = await import("../../agent-harness/src/subsession.mjs");
  const cs = spawnContracts({ run: "r", context: { type: "inquiry", id: "I" } }).contracts;
  t("R17: the contracts are frozen and share no object", [cs.every((c) => Object.isFrozen(c) && Object.isFrozen(c.context)),
    new Set(cs.map((c) => c.context)).size, new Set(cs.map((c) => c.returns)).size], [true, 4, 4]);
}

section("R18 · fanout, the internet level: one op=capturerequest per judged target, by address; one fetch each");
{
  await reset(mf, { target: "INQ-R18" });
  const r = await runOp(mf, { ...base, judgements: [
    { targets: [{ level: "internet", url: "https://example.org/a" }, { level: "internet", url: "https://example.org/b", target: "INQ-R18" },
                { level: "internet", url: "http://localhost/x" }, { level: "meaning", target: "INQ-R18" }] },
    { reports: [] }, { candidates: [] }, {}] });
  const st = await planeState(mf);
  t("R18: one request per internet-level target, {run, target, address}, its own target else the run's",
    st.log.filter((l) => l.op === "capturerequest").map((l) => l.body),
    [{ run: "run-1", target: "INQ-R18", address: "https://example.org/a" },
     { run: "run-1", target: "INQ-R18", address: "https://example.org/b" },
     { run: "run-1", target: "INQ-R18", address: "http://localhost/x" }]);
  t("R18: each refusal is published", (r.out.refusals || []).filter((x) => x.at === "capturerequest").map((x) => x.code),
    ["CAPTURE_REQUEST_NOT_PUBLIC"]);
  t("R18: one fetch is spent per request", st.budget.fetches.consumed, 3);
}

section("R19 · collect: every report held to agent-harness R5; each cited address re-read by address");
{
  await reset(mf);
  const reports = [
    { level: "meaning", state: "PRESENT", observed_at: "log:1", citations: [{ address: "bundle:a" }, { address: "bundle:b" }] },
    { level: "content", state: "LOOKED_ABSENT", observed_at: "log:2", text: "the document" },
    { level: "document", state: "partial", observed_at: "log:3", citations: [{ address: "bundle:a" }] },
  ];
  const r = await runOp(mf, { ...base, judgements: J(reports) });
  const reads = (await planeState(mf)).log.filter((l) => l.op === "meaningrows" && Array.isArray(l.body?.ids));
  t("R19: a refused report is published in reports_refused with its level and code, and never becomes an absence",
    [r.out.reports_refused?.map((x) => [x.level, x.code]), r.out.reports_taken,
     (await planeState(mf)).suggested.some((s) => s.name === "level-empty-content")],
    [[["content", "REPORT_UNKNOWN_FIELD"]], 2, false]);
  t("R19: each DISTINCT cited address re-read once through op=meaningrows (rows=leg, ids=[address])",
    reads.map((l) => [l.query.rows, l.body.ids]), [["leg", ["bundle:a"]], ["leg", ["bundle:b"]]]);
  t("R19: citations_reread counts reads that answered", r.out.citations_reread, 2);
  await reset(mf);
  const many = await runOp(mf, { ...base, judgements: J([{ level: "meaning", state: "PRESENT", observed_at: "log:1",
    citations: Array.from({ length: 20 }, (_, i) => ({ address: `bundle:${i}` })) },
    { level: "content", state: "PRESENT", observed_at: "log:2", citations: [{ address: "bundle:extra" }] }]) });
  t("R19: at most 20 addresses are re-read", many.out.citations_reread, 20);
  await reset(mf, { refuse_op: { meaningrows: { body: { ok: true, result: await meaningRowsUnknownArm() } } } });
  const refused = await runOp(mf, { ...base, judgements: J([reports[0]]) });
  t("R19: a read that did not answer is not counted", refused.out.citations_reread, 0);
}

section("agent-harness R5 · the report contract, each breach refused by its own code");
{
  const good = { level: "document", state: "PRESENT", observed_at: "log:7", summary: "s", citations: [{ address: "a" }] };
  t("agent-harness R5: a report with exactly the contract's keys is accepted", checkReport(good), null);
  t("agent-harness R5: the keys are level, state, observed_at, summary, citations, governed, condition",
    Object.keys(REPORT_KEYS), ["level", "state", "observed_at", "summary", "citations", "governed", "condition"]);
  const cases = [
    [{ ...good, bytes: "x" }, "REPORT_UNKNOWN_FIELD"],
    [{ state: "PRESENT" }, "REPORT_INCOMPLETE"],
    [{ level: "meaning" }, "REPORT_INCOMPLETE"],
    [{ ...good, level: "gossip" }, "REPORT_LEVEL_UNKNOWN"],
    [{ ...good, state: "FOUND" }, "REPORT_STATE_UNKNOWN"],
    ...["LOOKED_ABSENT", "LOOKED_INDETERMINATE", "PRESENT", "partial"].map((s) =>
      [{ level: "meaning", state: s, citations: [{ address: "a" }] }, "REPORT_UNLOCATED"]),
    [{ ...good, citations: [] }, "REPORT_NO_CITATION"],
    [{ ...good, state: "partial", citations: undefined }, "REPORT_NO_CITATION"],
    [{ ...good, citations: Array.from({ length: CITATIONS_MAX + 1 }, (_, i) => ({ address: `a${i}` })) }, "REPORT_OVER_BOUND"],
    [{ ...good, citations: [{ address: "a", text: "x" }] }, "REPORT_CITATION_NOT_AN_ADDRESS"],
    [{ ...good, citations: [{ address: "" }] }, "REPORT_CITATION_NOT_AN_ADDRESS"],
    [{ ...good, citations: [{ address: "a".repeat(ADDRESS_MAX + 1) }] }, "REPORT_OVER_BOUND"],
    [{ ...good, summary: "s".repeat(SUMMARY_MAX + 1) }, "REPORT_OVER_BOUND"],
    [{ ...good, summary: { pages: [] } }, "REPORT_SUMMARY_NOT_PROSE"],
  ];
  t("agent-harness R5: every breach refused by its own code", cases.map(([r]) => checkReport(r)?.code), cases.map(([, c]) => c));
  t("agent-harness R5: NEVER_LOOKED needs no observed_at, and an absence no citation",
    [checkReport({ level: "meaning", state: "NEVER_LOOKED" }), checkReport({ level: "meaning", state: "LOOKED_ABSENT", observed_at: "l" })],
    [null, null]);
  t("agent-harness R5: at the bounds exactly (20 citations of 200 characters, a 500-character summary) is accepted, inside REPORT_MAX_BYTES",
    checkReport({ ...good, summary: "s".repeat(SUMMARY_MAX),
      citations: Array.from({ length: CITATIONS_MAX }, (_, i) => ({ address: String(i).padEnd(ADDRESS_MAX, "x") })) }), null);
  t("agent-harness R5: the whole-report ceiling is REPORT_MAX_BYTES", REPORT_MAX_BYTES > SUMMARY_MAX + CITATIONS_MAX * ADDRESS_MAX, true);
  t("agent-harness R5: the states are D-129's five", Object.keys(REPORT_STATES), ["NEVER_LOOKED", "LOOKED_ABSENT", "LOOKED_INDETERMINATE", "PRESENT", "partial"]);
}

section("R21 · collect, holdings: each citation resolved to its document by address_norm");
{
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: J([{ level: "document", state: "PRESENT", observed_at: "log:1",
    citations: [{ address: "https://example.org/cal" }, { address: "bundle:x" }] }]) });
  const st = await planeState(mf);
  t("R21: each cited address looked up as a held bundle (op=search, id:\"…\") and read through op=versionchain",
    [st.log.filter((l) => l.op === "search").map((l) => l.query.q), st.log.filter((l) => l.op === "versionchain").map((l) => l.query.address)],
    [['id:"https://example.org/cal"', 'id:"bundle:x"'], ["https://example.org/cal", "bundle:x"]]);
  t("R21: an item with no chain counts as itself", [r.out.holdings?.documents, r.out.holdings?.unchained], [0, 2]);
  /* N458 (K899 (1)): the reason a member reads for a cited record that names no source address says "record". */
  // fixtures-contract: control-plane ask-wire
  await reset(mf, { refuse_op: { search: { body: { ok: true, result: { hits: [{ bundle_id: "bundle:x" }] } } } } });
  const noSource = await runOp(mf, { ...base, judgements: J([{ level: "document", state: "PRESENT", observed_at: "log:1",
    citations: [{ address: "bundle:x" }] }]) });
  t("R21: a cited record that names no source address is read through no chain, counted as itself, and its reason says so",
    [(await planeState(mf)).log.filter((l) => l.op === "versionchain").length, noSource.out.holdings?.unchained,
     noSource.out.holdings?.unchained_items?.[0]?.reason],
    [0, 1, localize("agent-steps.work.the_cited_record_names_no_source", "the cited record names no source address, so no version chain can hold it")]);
  const h = documentHoldings([
    { citation: "b1", bundle: "b1", address: "https://x/cal", chain: { address_norm: "x/cal", total: 3, versions: [{ bundle_id: "b1" }, { bundle_id: "b2" }] } },
    { citation: "b2", bundle: "b2", address: "https://x/cal", chain: { address_norm: "x/cal", total: 3, versions: [{ bundle_id: "b1" }, { bundle_id: "b2" }] } },
    { citation: "b3", bundle: "b3", address: "https://y/cal", chain: { address_norm: "y/cal", total: 1, versions: [{ bundle_id: "b3" }] } },
  ]);
  t("R21: holdings count each document once by the record's address_norm (two citations of one calendar are one document)",
    [h.documents, h.by_document.map((d) => [d.address_norm, d.versions_cited.length])], [2, [["x/cal", 2], ["y/cal", 1]]]);
  // fixtures-contract: control-plane ask-wire (the door's envelope; the result in it is provenance's real answer)
  await reset(mf, { refuse_op: { versionchain: { body: { ok: true, result: await versionChainNoSuchVersion() } } } });
  const u = await runOp(mf, { ...base, judgements: J([{ level: "document", state: "PRESENT", observed_at: "log:1",
    citations: [{ address: "https://example.org/cal" }] }]) });
  t("R21: a refused read leaves that citation's document UNDETERMINED, and published",
    [u.out.holdings?.undetermined, u.out.holdings?.documents, (u.out.refusals || []).some((x) => x.code === "VERSION_CHAIN_NO_SUCH_VERSION")],
    [1, 0, true]);
}

section("R22 · compose: one meaning read; its note never a false zero; level-empty candidates made by the table");
{
  /* agent-harness R18 (T50): this run takes its judgements from the body, so the scope its absences need is published state. */
  await reset(mf, { target: "INQ-R22", meaningRows: [{ ord: 0 }, { ord: 1 }], state: { step: "plan", pass: 0, scope: Object.fromEntries(
    LEVELS.map((l) => [l, { reads: 1, documents: 3 }])) } });
  const r = await runOp(mf, { ...base, judgements: J([
    { level: "document", state: "LOOKED_ABSENT", observed_at: "log:3", summary: "nothing in the packets" },
    { level: "meaning", state: "LOOKED_INDETERMINATE", observed_at: "log:1" }]) });
  const st = await planeState(mf);
  const reads = st.log.filter((l) => l.op === "meaningrows" && !l.body);
  t("R22: compose makes one op=meaningrows read at rows=leg, and its note counts the rows",
    [reads.map((l) => l.query.rows), /^2 meaning-grain row\(s\) queried at the 'leg' grain/.test(r.out.trace?.find((x) => x.step === "compose")?.note ?? "")],
    [["leg"], true]);
  const le = st.log.find((l) => l.op === "suggest" && l.body?.kind === "level-empty")?.body ?? {};
  t("R22: one level-empty candidate per LOOKED_ABSENT level: level in the suggestion spelling, its name, observed_at, the run's target",
    [st.suggested.filter((s) => s.kind === "level-empty").map((s) => s.name), le.level, le.observed_at, le.target],
    [["level-empty-documents"], "documents", "log:3", "INQ-R22"]);
  t("R22: its description is composed from those facts alone; the report's summary is not appended (agent-harness R14)",
    [/documents level of this question/.test(le.description ?? "") && !/INQ-R22/.test(le.description ?? ""), /at log:3/.test(le.description ?? ""),
     /The sub-session reported/.test(le.description ?? "") || /nothing in the packets/.test(le.description ?? "")], [true, true, false]);
  await reset(mf, { refuse_op: { meaningrows: { body: { ok: true, result: await meaningRowsUnknownArm() } } } });
  const refused = await runOp(mf, { ...base, judgements: J() });
  t("R22: a refused read -> the note says the meaning layer was NOT READ, never zero",
    [/NOT READ/.test(refused.out.trace?.find((x) => x.step === "compose")?.note ?? ""),
     /^0 meaning-grain/.test(refused.out.trace?.find((x) => x.step === "compose")?.note ?? "")], [true, false]);
  await reset(mf, { refuse_op: { meaningrows: { body: { ok: true, result: { ok: true, arm: "leg" } } } } });
  const norows = await runOp(mf, { ...base, judgements: J() });
  t("R22: no rows list -> UNDETERMINED", /UNDETERMINED/.test(norows.out.trace?.find((x) => x.step === "compose")?.note ?? ""), true);
}

section("R23 · dedup before any write: held names on the target dropped; others go on uncompared");
{
  await reset(mf, { target: "INQ-R23", heldVersions: ["held"], cites: ["INQ-OTHER"] });
  const cands = [{ kind: "basis-version", name: "held", description: "a reading the record already holds" },
                 { kind: "basis-version", name: "fresh", description: "a reading the record does not hold" },
                 { kind: "basis-version", name: "held", target: "INQ-OTHER", description: "the same name aimed at another question" }];
  const r = await runOp(mf, { ...base, judgements: J([], cands) });
  const st = await planeState(mf);
  t("R23: op=basisversions read for the run's target before any suggest",
    [st.bvIds, st.log.findIndex((l) => l.op === "basisversions") < st.log.findIndex((l) => l.op === "suggest")], [["INQ-R23"], true]);
  t("R23: the candidate aimed at the target whose name is held was dropped; the others went on",
    st.log.filter((l) => l.op === "suggest").map((l) => `${l.body.name}@${l.body.target}`), ["fresh@INQ-R23", "held@INQ-OTHER"]);
  t("R23: the note counts the candidates aimed at another question as not compared",
    /1 named a question other than the run's target and were NOT compared/.test(r.out.trace?.find((x) => x.step === "dedup")?.note ?? ""), true);
  await reset(mf, { target: "INQ-R23", refuse_op: { basisversions: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", check: "C-29.9" } } } });
  const refused = await runOp(mf, { ...base, judgements: J([], cands.slice(0, 2)) });
  t("R23: a refused read sends every candidate on, and the note says they were compared against nothing",
    [(await planeState(mf)).log.filter((l) => l.op === "suggest").length,
     /compared its 2 candidate\(s\) against NOTHING/.test(refused.out.trace?.find((x) => x.step === "dedup")?.note ?? "")], [2, true]);
}

section("R24 · submit: one candidate at a time, as formed; a refusal to adjust; verbatim resubmits counted");
{
  await reset(mf, { target: "INQ-R24" });
  const r = await runOp(mf, { ...base, judgements: J([], [
    { kind: "basis-version", name: "a", description: "the first reading, in full" },
    { kind: "basis-version", name: "b", description: "the second reading, in full" }]) });
  const st = await planeState(mf);
  t("R24: each candidate its own op=suggest with the run and the target, each followed by its own tick",
    [st.log.filter((l) => l.op === "suggest").map((l) => [l.body.name, l.body.run, l.body.target]),
     st.log.map((l) => l.op).filter((o, i, a) => o === "suggest" && a[i + 1] === "airuntick").length, r.out.submitted],
    [[["a", "run-1", "INQ-R24"], ["b", "run-1", "INQ-R24"]], 2, 2]);
  await reset(mf, { target: "INQ-R24", refuse: { v1: "SUGGEST_UNWRITABLE_STATE" } });
  const f = await runOp(mf, { ...base, judgements: [...J([], [{ kind: "basis-version", name: "v1",
    description: "a reading the plane refuses" }]), { submission: { kind: "basis-version", name: "v1", description: "changed words, in full" } }] });
  t("R24: a refusal goes to adjust", (f.out.trace || []).some((x) => x.step === "submit" && x.to === "adjust"), true);
  /* The plane's F10 keys a verbatim resubmit on the canonical submission: the same bytes formed again in a later
     pass (a second segment no longer re-forms them: it continues at the published state, R11). */
  await reset(mf, { target: "INQ-R24", maxPasses: 2 });
  const same = () => J([], [{ kind: "basis-version", name: "v1", description: "TBD" }]);
  const again = await runOp(mf, { ...base, judgements: [...same(), {}, ...same(), {}] });
  t("R24: a verbatim resubmit the plane reports (repeated: true) is counted in verbatim_resubmits",
    [again.out.verbatim_resubmits, (await planeState(mf)).repeats, again.out.passes], [1, [1], 2]);
}

section("R25 · adjust: resend only changed bytes; an unchanged submission dropped, the rest still written");
{
  await reset(mf, { target: "INQ-R25", refuse: { v1: "SUGGEST_UNWRITABLE_STATE" } });
  const same = { kind: "basis-version", name: "v1", description: "a reading the plane refuses" };
  const r = await runOp(mf, { ...base, judgements: [...J([], [same, { kind: "basis-version", name: "v2",
    description: "the reading behind it in the queue" }]), { submission: { ...same, description: "a reading the plane refuses" } }] });
  const st = await planeState(mf);
  t("R25: the unchanged submission is dropped and never resent, and the next candidate is still written",
    [st.log.filter((l) => l.op === "suggest").map((l) => l.body.name), r.out.adjusted, st.suggested.map((s) => s.name)],
    [["v1", "v2"], 0, ["v2"]]);
  await reset(mf, { target: "INQ-R25", boilerplate: ["TBD"] });
  const c = await runOp(mf, { ...base, judgements: [...J([], [{ kind: "basis-version", name: "v1", description: "TBD" }]),
    { submission: { kind: "basis-version", name: "v1", description: "what changed, and why, in full" } }] });
  t("R25: a changed submission is resent, once", [(await planeState(mf)).log.filter((l) => l.op === "suggest").length, c.out.adjusted,
    (await planeState(mf)).suggested.map((s) => s.name)], [2, 1, ["v1"]]);
}

section("R26 · after every step one tick: the spend, and an entry only when the step's judgement states a look");
{
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: [{ targets: [], level: "document", observed: "PRESENT" },
    { reports: [] }, { candidates: [], level: "meaning", observed: "LOOKED_ABSENT", governed: false }, {}] });
  const st = await planeState(mf);
  /* R91 (R085): beside the segment's one closing `segment_end` tick, which is no step's. */
  const ticks = st.log.filter((l) => l.op === "airuntick" && !("segment_end" in (l.body || {})));
  t("R26: one op=airuntick per step", ticks.length, (r.out.trace || []).length);
  t("R26: only the two steps whose judgement stated a look sent an entry; no entry carries NEVER_LOOKED",
    [ticks.filter((l) => (l.body.log || []).length).map((l) => l.body.log[0].subject), ticks.flatMap((l) => l.body.log || []).filter((e) => e.state === "NEVER_LOOKED").length],
    [["plan -> fanout", "compose -> dedup"], 0]);
  const e = ticks.find((l) => (l.body.log || []).length && l.body.log[0].subject === "compose -> dedup").body.log[0];
  t("R26: an entry is {level, subject, state, governed, condition, terminal, bound, detail}, detail at most 500",
    [Object.keys(e), e.state, e.level, e.detail.length <= 500], [["level", "subject", "state", "governed", "condition", "terminal", "bound", "detail"], "LOOKED_ABSENT", "meaning", true]);
  const p = ticks.find((l) => (l.body.log || []).length && l.body.log[0].subject === "plan -> fanout").body.log[0];
  t("R26: a step judged PRESENT is logged LOOKED_INDETERMINATE with the reason stated, counted in present_unbacked",
    [p.state, p.detail.startsWith("the model judged PRESENT"), r.out.present_unbacked], ["LOOKED_INDETERMINATE", true, 1]);
  t("R26: runtime = the plane calls of that step + 1 (fanout: 4 spawns, + the tick)",
    ticks.map((l) => l.body.consume.runtime)[(r.out.trace || []).findIndex((x) => x.step === "fanout")], 5);
  t("R26: logged counts what the plane appended", r.out.logged, 2);
  await reset(mf);
  const bad = await runOp(mf, { ...base, judgements: [{ targets: [], observed: "NEVER_LOOKED" }] });
  t("R26: a judgement stating NEVER_LOOKED is no look — no entry is sent, so none is refused",
    [bad.out.log_refused, bad.out.logged], [[], 0]);
  await reset(mf, { budget: [{ bound: "runtime", allowed: 4 }] });
  const ended = await runOp(mf, { ...base, judgements: J() });
  t("R26: when a tick reports the run ended, the segment stops and ended.by is the plane's own exit",
    [ended.out.ended?.bound, ended.out.ended?.by, (await planeState(mf)).log.filter((l) => l.op === "airunclose").length],
    ["runtime", "the plane's own exit", 0]);
  const stub = stepLog({ step: "plan", level: "meaning", observed: "LOOKED_ABSENT" }, { step: "fanout", why: "w".repeat(900) });
  t("R26: detail is cut at 500 characters", stub.detail.length, 500);
}

section("R26 · an entry the plane refuses is in log_refused and refusals, and not counted");
{
  await reset(mf, { refuseEntries: { ok: false, code: "AI_RUN_CONDITION_UNKNOWN", check: "C-22.4" } });
  const r = await runOp(mf, { ...base, judgements: [{ targets: [], observed: "LOOKED_INDETERMINATE", condition: "odd" }] });
  t("R26: the refused entry is named with its step in log_refused and in refusals; logged stays 0",
    [r.out.log_refused?.map((x) => [x.step, x.code, x.check]), (r.out.refusals || []).filter((x) => x.at === "airuntick.log").length, r.out.logged],
    [[["plan", "AI_RUN_CONDITION_UNKNOWN", "C-22.4"]], 1, 0]);
}

section("R49 · the state a tick publishes stays within ai-runs' AI_RUN_STATE_MAX_BYTES; its refusal is a refusal");
{
  /* The figure ai-runs R45 provides; the member reads the name from ai-runs' own file (below), never this number. */
  const LIMIT = 262144;
  const big = (n, ch = "x") => Array.from({ length: n }, (_, i) =>
    ({ kind: "basis-version", name: `c${i}`, description: ch.repeat(4000) }));
  const small = { step: "submit", pass: 1, queue: [{ name: "a" }], candidates: [{ name: "a" }] };
  const fits = publishableState(small, LIMIT);
  t("R49: a state within the ceiling is published whole, measured as the UTF-8 length of its JSON",
    [fits.state, fits.bytes, fits.restarted], [resumableState(small), new TextEncoder().encode(JSON.stringify(resumableState(small))).length, null]);
  const over = { step: "submit", pass: 2, candidates: big(70), queue: big(70), reports: [{ level: "meaning" }],
                 submission: { name: "c0" }, adjusted: true };
  const cut = publishableState(over, LIMIT);
  t("R49: a state over the ceiling is published as its pass restarted at plan: the pass kept, every working field null",
    [cut.state, cut.restarted?.at, cut.restarted?.limit, cut.restarted?.bytes > LIMIT, cut.bytes <= LIMIT],
    [resumableState({ step: "plan", pass: 2, adjusted: false }), "plan", LIMIT, true, true]);
  t("R49: next-pass and close keep their own step when restarted",
    ["next-pass", "close", "fanout", "adjust"].map((step) => publishableState({ ...over, step }, LIMIT).state.step),
    ["next-pass", "close", "plan", "plan"]);
  const wide2 = { step: "dedup", pass: 0, candidates: big(40, "é") };
  t("R49: the measure is UTF-8 bytes, not characters: a state under the ceiling in characters and over it in bytes is cut",
    [JSON.stringify(resumableState(wide2)).length <= LIMIT, stateBytes(resumableState(wide2)) > LIMIT,
     publishableState(wide2, LIMIT).restarted?.at], [true, true, "plan"]);
  t("R49: with no ceiling published, the state is published whole",
    [undefined, 0, -1].map((l) => publishableState(over, l).restarted), [null, null, null]);

  /* THROUGH THE OP, at the plane's ceiling: a mock that refuses as ai-runs R45 does receives no state it refuses. */
  const CEILING = RUN_RULES.AI_RUN_STATE_MAX_BYTES;
  {
    t("R49: the ceiling the member applies is ai-runs' own, the figure its R45 provides", CEILING, LIMIT);
    await reset(mf, { target: "INQ-R49", stateMax: CEILING });
    const r = await runOp(mf, { ...base, judgements: [{ targets: [] }, { reports: [] }, { candidates: big(80) }, {}] });
    const st = await planeState(mf);
    const states = st.log.filter((l) => l.op === "airuntick" && l.body?.state).map((l) => l.body.state);
    t("R49: through the op, no tick carried a state over the ceiling and none was refused for it; the run completed",
      [states.every((x) => stateBytes(x) <= CEILING), (r.out.refusals || []).filter((x) => x.code === "AI_RUN_STATE_TOO_LARGE").length,
       r.out.ended?.bound], [true, 0, "completed"]);
    t("R49: the tick whose state would not fit published the pass restarted at plan, and the step's trace says so",
      [states.some((x) => x.step === "plan" && x.candidates === null && x.queue === null),
       (r.out.trace || []).some((x) => /ai-runs R45/.test(x.note ?? ""))], [true, true]);
  }

  /* A tick refused AI_RUN_STATE_TOO_LARGE is a refusal, recorded, and never the plane failing. */
  const refusedTick = { ok: true, result: (await tickStateTooLarge()).answer };
  await reset(mf, { refuse_op: { airuntick: { body: refusedTick } } });
  const r = await runOp(mf, { ...base, judgements: J() });
  const at = (r.out.refusals || []).filter((x) => x.at === "airuntick");
  t("R49: a tick refused AI_RUN_STATE_TOO_LARGE is in refusals at airuntick with its code, its check and the plane's body",
    [at.length, at.length === (r.out.trace || []).length, [...new Set(at.map((x) => `${x.code} ${x.check}`))],
     JSON.stringify(at[0]?.plane) === JSON.stringify(refusedTick)],
    [(r.out.trace || []).length, true, ["AI_RUN_STATE_TOO_LARGE C-22.18"], true]);
  t("R49: …and never read as a failure of the plane: 200, no PLANE_SILENT or PLANE_REFUSED, the table still closes the run",
    [r.status, r.out.ok, r.out.ended, r.out.logged], [200, true, { bound: "completed", by: "the table" }, 0]);
}

section("R27 · close: op=airunclose names the bound; ended only when the plane accepted; max_steps");
{
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: J() });
  const st = await planeState(mf);
  t("R27: op=airunclose names the table's bound, and ended is {bound, by: 'the table'}",
    [st.log.filter((l) => l.op === "airunclose").map((l) => l.body.bound), r.out.ended], [["completed"], { bound: "completed", by: "the table" }]);
  await reset(mf, { refuseClose: true });
  const refused = await runOp(mf, { ...base, judgements: J() });
  t("R27: a refused close -> ended null, the refusal published", [refused.out.ended, (refused.out.refusals || []).some((x) => x.at === "airunclose")],
    [null, true]);
  await reset(mf);
  const short = await runOp(mf, { ...base, judgements: J(), max_steps: 3 });
  t("R27: max_steps bounds one invocation and is never reported as a run's bound",
    [(short.out.trace || []).length, short.out.ended, (await planeState(mf)).log.some((l) => l.op === "airunclose")], [3, null, false]);
  await reset(mf, { maxPasses: 200, budget: [{ bound: "subsessions", allowed: 100000 }, { bound: "runtime", allowed: 100000 }] });
  const capped = await runOp(mf, { ...base, judgements: JN(150), max_steps: 5000 });
  t("R27: max_steps is at most 400", (capped.out.trace || []).length, 400);
}

/* ============================================================ the answer */
section("R28 · the 200 answer carries exactly its fields");
{
  await reset(mf);
  const r = await runOp(mf, { ...base, judgements: J() });
  t("R28: the answer's keys, in order",
    Object.keys(r.out), ["ok", "run_id", "store", "stage", "turns_run", "judgement_source", "judgement_note", "claude_account",
      "mode", "trace", "passes", "ended", "logged", "log_refused", "present_unbacked", "submitted", "refusals", "adjusted",
      "verbatim_resubmits", "resumed_from", "target", "fanout", "reports_taken", "reports_refused", "citations_reread",
      "holdings", "budget", "segment", "plane_says", "principal", "principal_source", "plane", "worker"]);
  t("R28: ok, stage, target {id, basis}, fanout {of_pass, levels, scope, contracts}, plane_says, plane and worker",
    [r.out.ok, r.out.stage, Object.keys(r.out.target), Object.keys(r.out.fanout), Object.keys(r.out.plane_says),
     r.out.plane, r.out.worker],
    [true, "harness", ["id", "basis"], ["of_pass", "levels", "scope", "contracts"], ["token_class", "store", "session"],
     { version: "plane-test", op: "whoami" }, { name: "agent-worker", version: "req-test" }]);
  /* R99: the wallclock bound is measured, so its consumption is the segment's elapsed milliseconds, not zero. */
  const wallBudget = r.out.budget.find((b) => b.bound === "wallclock");
  t("R28: budget lists the three spendable bounds as the record holds them after the segment",
    r.out.budget.map((b) => (b.bound === "wallclock" ? { ...b, consumed: 0 } : b)),
    BUDGET_BOUNDS.map((b) => ({ bound: b, ...{ fetches: { allowed: 50, consumed: 0 }, subsessions: { allowed: 50, consumed: 4 },
      wallclock: { allowed: 500000, consumed: 0 } }[b] })));
  t("R28, R99: …and the wallclock consumed is a non-negative whole number of milliseconds",
    [Number.isInteger(wallBudget.consumed), wallBudget.consumed >= 0], [true, true]);
}

section("R29 · claude_account and principal");
{
  await reset(mf);
  const a = await runOp(mf, { ...base, judgements: J(), account: ACCOUNTS });
  t("R29: the member's reference arrived -> {available: true, kind, level, member}, never the secret", a.out.claude_account,
    { available: true, kind: "apikey", level: "member", member: MEMBER });
  await reset(mf);
  const s = await runOp(mf, { ...base, judgements: J(), account: SIGNIN });
  t("R6, R29 (T38): the member's own sign-in is carried and named as one, at the member level, for that member",
    [s.status, s.out.claude_account], [200, { available: true, kind: "signin", level: "member", member: MEMBER }]);
  await reset(mf);
  const sb = await runOp(mf, { ...base, judgements: J(), account: { kind: "signin", level: "member", member: MEMBER, secret: SIGNIN_TOKEN } });
  t("R6 (T38): a sign-in with no suggestions field is carried, the switch read as off (R56)",
    [sb.status, sb.out.claude_account?.kind], [200, "signin"]);
  await reset(mf);
  const st = await runOp(mf, { ...base, judgements: J(), account: { ...SIGNIN, suggestions: true } });
  t("R6 (T46): a sign-in with suggestions true is carried (the sign-in's own switch, no longer refused)",
    [st.status, st.out.claude_account?.kind], [200, "signin"]);
  await reset(mf, { payer: "member:sam" });
  const ss = await runOp(mf, { ...base, judgements: J(), account: SIGNIN });
  t("R10 (T38): Ruth's sign-in on Sam's run is refused as any account serving another member's act",
    [ss.status, ss.out.code, ss.out.recorded, ss.out.supplied], [409, "RUN_NAMES_A_DIFFERENT_PAYER", "member:sam", MEMBER]);
  await reset(mf);
  const g = await runOp(mf, { ...base, judgements: J(), account: GROUP_ACCOUNT });
  t("R29 (K1755): the group's API key is named at its level, with the member whose act it serves, never the secret",
    [g.out.claude_account, JSON.stringify(g.out).includes(CLAUDE_TOKEN)],
    [{ available: true, kind: "apikey", level: "group", member: MEMBER }, false]);
  const n = await call(mf, "run", { method: "POST", body: JSON.stringify({ ...base, judgements: J() }) });
  t("R29: with none, the answer is never a 200: R6 refused it before any step, {available: false} never reaches the wire",
    [n.status, n.out.code, "claude_account" in n.out], [409, "NO_ACCOUNT", false]);
  t("R29: principal is null and principal_source states no op an ai credential may call publishes it",
    [a.out.principal, /no read op an ai credential may call states its own principal/.test(a.out.principal_source)], [null, true]);
}

section("R30, R31 · GET /version; anything else 404 UNKNOWN");
{
  const v = await call(mf, "version", { method: "GET" });
  t("R30, R58: GET /version -> 200 {ok, name, version: env.VERSION} and the one statement of when model turns run",
    [v.status, v.out.ok, v.out.name, v.out.version, /through agent-model exactly when the Claude account that serves the member's act \(the member's own reference or sign-in, a project's account, or the team's API key\) arrives/.test(v.out.model_turns)],
    [200, true, "agent-worker", "req-test", true]);
  const bare = newMf({ VERSION: "" });
  t("R30: and \"0.0.0\" when env.VERSION is empty", (await call(bare, "version", { method: "GET" })).out.version, "0.0.0");
  await bare.dispose();
  const others = [["GET", "run"], ["GET", ""], ["POST", "version"], ["PUT", "run"], ["GET", "nope"], ["POST", "run/extra"],
                  ["GET", "ask"], ["PUT", "ask"], ["POST", "ask/extra"]];
  const got = [];
  for (const [method, path] of others) {
    const r = await call(mf, path, { method, ...(method === "GET" ? {} : { body: "{}" }) });
    got.push([r.status, r.out.code]);
  }
  t("R31: every other path or method -> 404 UNKNOWN", got, others.map(() => [404, "UNKNOWN"]));
  const empty = await call(mf, "", { method: "POST", body: JSON.stringify({ run_id: "r", store: "nope", credential: AIK }) });
  t("R31: POST to the empty path is /run", empty.out.code, "NAMESPACE_UNKNOWN");
}

/* ============================================================ the cascade, pure */
section("R32, R33 · the cascade: the one account that arrived, at its own level (project, member or group)");
{
  const PUBLISHED_VALUE = readFileSync(fileURLToPath(new URL("../../bio-plane/dist/SECRETS.txt", import.meta.url)), "utf8")
    .split("\n").find((l) => l.startsWith("ADMIN_TOKEN=")).split("=")[1].trim();
  const st = async (a) => (await resolveClaudeCascade(a)).levels.map((l) => `${l.level}:${l.state}`);
  t("R32, R71: three levels, a project's, the member's own and the group's, in credentials' order; no instance level is judged, held or answered", [...CASCADE_ORDER], ["project", "member", "group"]);
  t("R32: unset (no non-empty secret), revoked_by_publication, or available, at the account's own level — no shape check "
    + "beyond agent-model's kinds (the group's an API key only); (T38) a sign-in available by its member, subscription retired",
    [await st({ ...ACCOUNTS, secret: "" }), await st({ ...ACCOUNTS, secret: PUBLISHED_VALUE }),
     await st(SIGNIN), await st({ ...ACCOUNTS, kind: "other", secret: "x" }),
     await st(GROUP_ACCOUNT), await st({ ...GROUP_ACCOUNT, secret: "" }), await st({ ...GROUP_ACCOUNT, secret: PUBLISHED_VALUE }),
     await st({ ...GROUP_ACCOUNT, kind: "subscription" }), await st({ ...ACCOUNTS, level: "project" }),
     await st({ ...ACCOUNTS, kind: "subscription", secret: "x" }), await st({ ...SIGNIN, member: "" }),
     await st({ kind: "signin", level: "member" }), await st({ ...SIGNIN, level: "group" }),
     await st({ ...SIGNIN, secret: "" }), await st({ ...SIGNIN, secret: PUBLISHED_VALUE })],
    [["member:unset"], ["member:revoked_by_publication"], ["member:available"], ["member:unset"],
     ["group:available"], ["group:unset"], ["group:revoked_by_publication"], ["group:unset"], ["project:unset"],
     ["member:unset"], ["member:unset"], ["member:unset"], ["group:unset"], ["member:unset"], ["member:revoked_by_publication"]]);
  const si = await resolveClaudeCascade(SIGNIN);
  t("R32 (T38): a sign-in resolves with its kind, its level and the wire's member", [si.available, si.level, si.kind, si.member],
    [true, "member", "signin", MEMBER]);
  const r = await resolveClaudeCascade(ACCOUNTS);
  t("R32: available resolves with its kind and level", [r.available, r.level, r.kind, r.member], [true, "member", "apikey", MEMBER]);
  const rg = await resolveClaudeCascade(GROUP_ACCOUNT);
  t("R32 (K1755): the group's API key resolves at the group level, for the member whose act it serves",
    [rg.available, rg.level, rg.kind, rg.member], [true, "group", "apikey", MEMBER]);
  const none = await resolveClaudeCascade({ ...ACCOUNTS, secret: PUBLISHED_VALUE });
  t("R32: anything else -> {available:false, reason:NO_ACCOUNT, level (the account's own), detail}",
    [none.available, none.reason, none.level, typeof none.detail], [false, "NO_ACCOUNT", "member", "string"]);
  const noneG = await resolveClaudeCascade({ ...GROUP_ACCOUNT, secret: "" });
  t("R32: …at the group level for the group's account", [noneG.available, noneG.reason, noneG.level], [false, "NO_ACCOUNT", "group"]);
  const absent = await resolveClaudeCascade(undefined);
  t("R32: …and member when none arrived", [absent.available, absent.reason, absent.level], [false, "NO_ACCOUNT", "member"]);
  t("R32: the status never carries a secret", [r, rg, none, noneG, si].some((x) => JSON.stringify(x).includes(CLAUDE_TOKEN)
    || JSON.stringify(x).includes(SIGNIN_TOKEN)), false);
  t("R33: cascadeToken returns {level, reference} in agent-model's terms, level the account's own, exactly when R32 "
    + "resolves, else null",
    [await cascadeToken(ACCOUNTS), await cascadeToken(SIGNIN), await cascadeToken(GROUP_ACCOUNT),
     await cascadeToken({ ...ACCOUNTS, secret: PUBLISHED_VALUE }), await cascadeToken({ ...GROUP_ACCOUNT, kind: "subscription" }),
     await cascadeToken(undefined), await cascadeToken({ ...ACCOUNTS, kind: "subscription" }), await cascadeToken({ ...SIGNIN, member: "" })],
    [{ level: "member", reference: { kind: "apikey", key: CLAUDE_TOKEN } },
     { level: "member", reference: { kind: "signin", member: MEMBER, secret: SIGNIN_TOKEN } },
     { level: "group", reference: { kind: "apikey", key: CLAUDE_TOKEN } }, null, null, null, null, null]);
}

section("R34 · SURFACE and fleet-member.json");
{
  t("R34, R54, R59, R66, R72: SURFACE is {run: POST, ask: POST, draft: POST, signin: POST, transcribe: POST, version: GET}, every one mutating: false (K1601 (5))", SURFACE,
    { run: { method: "POST", mutating: false }, ask: { method: "POST", mutating: false },
      draft: { method: "POST", mutating: false }, signin: { method: "POST", mutating: false },
      transcribe: { method: "POST", mutating: false }, version: { method: "GET", mutating: false } });
  t("R34: the manifest names the entry, the surface, the test directory and the bundle recipe",
    [MANIFEST.entry, MANIFEST.surface, MANIFEST.testDir, MANIFEST.bundle?.entry, MANIFEST.bundle?.outfile, MANIFEST.bundle?.manifest],
    ["src/index.mjs", "SURFACE", "test", "src/index.mjs", "dist/agent-worker.bundled.mjs", "dist/agent-worker.bundle.json"]);
}

/* ============================================================ R58, agent-harness R7, R48: model turns */
section("R48 · in the model mode the pack is the one the plane serves on op=agentpack, and a run under another pack is refused before any turn");
{
  t("R48: the REAL plane's op=agentpack answers {ok: true, fences, pack} apart, the pack with its version, resident and disclosed layers",
    [PUBLISHED?.ok, PUBLISHED_ANSWER?.ok, Array.isArray(PUBLISHED_ANSWER?.fences), typeof PUBLISHED_ANSWER?.pack?.version,
     typeof PUBLISHED_ANSWER?.pack?.resident, typeof PUBLISHED_ANSWER?.pack?.disclosed],
    [true, true, true, "string", "object", "object"]);
  await reset(mf, { skill: "investigative-session@1+0000000000000000" });
  const r = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R48: the recorded skill version is not the published pack's -> 409 SKILL_VERSION_MISMATCH carrying both",
    [r.status, r.out.code, r.out.recorded, r.out.rendered], [409, "SKILL_VERSION_MISMATCH", "investigative-session@1+0000000000000000", PACK.version]);
  t("R48: refused before any turn, after the payer check (R10), from op=agentpack read under the run's credential, never op=affordances",
    [(await modelState(mf)).calls.length, (await planeState(mf)).log.map((l) => l.op),
     (await planeState(mf)).log.filter((l) => l.op === "agentpack").map((l) => l.token)],
    [0, ["whoami", "airun", "agentpack"], [AIK]]);
  await reset(mf, { refuse_op: { agentpack: { status: 403, body: { ok: false, reason: "AI_BEYOND_TASK_SCOPE", check: "C-29.9" } } } });
  const ref = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R48: a refused op=agentpack -> 403 PLANE_REFUSED, no turn", [ref.status, ref.out.reason, (await modelState(mf)).calls.length], [403, "PLANE_REFUSED", 0]);
  await reset(mf, { published: { ...PUBLISHED_ANSWER, pack: null, pack_absent: "renderPack: no fences published" } });
  const absent = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R48: an answer whose pack the plane could not render -> 409 carrying both versions, the published one UNDETERMINED, no turn",
    [absent.status, absent.out.code, absent.out.recorded, absent.out.rendered, absent.out.rendered_basis, absent.out.pack_absent,
     (await modelState(mf)).calls.length],
    [409, "SKILL_VERSION_MISMATCH", PACK.version, null, "UNDETERMINED", "renderPack: no fences published", 0]);
  await reset(mf, { published: PUBLISHED_NO_PACK });
  const none = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R48: an answer carrying no pack at all -> 409, its version UNDETERMINED, no turn",
    ["pack" in PUBLISHED_NO_PACK, none.status, none.out.code, none.out.rendered, none.out.rendered_basis,
     (await modelState(mf)).calls.length],
    [false, 409, "SKILL_VERSION_MISMATCH", null, "UNDETERMINED", 0]);
  await reset(mf, { published: { ...PUBLISHED_ANSWER, pack: { version: PACK.version } } });
  const partial = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R48: a partial pack (a version and no layers) is never used: 409, UNDETERMINED, no turn",
    [partial.status, partial.out.rendered, (await modelState(mf)).calls.length], [409, null, 0]);
  await reset(mf, {});
  await runOp(mf, { ...base, account: ACCOUNTS, judgements: J() });
  t("R48: until turns run it changes nothing: the supplied mode never asks for the pack",
    (await planeState(mf)).log.some((l) => l.op === "agentpack" || l.op === "affordances"), false);
  const bundle = JSON.parse(readFileSync(fileURLToPath(new URL("../dist/agent-worker.bundle.json", import.meta.url)), "utf8"));
  const inputs = (bundle.inputs || []).map((i) => String(i.path ?? i.file ?? i));
  t("R48: it renders nothing and imports neither the check catalogue nor skills' code: no such input in its bundle",
    [inputs.length > 0, inputs.filter((f) => /bio-checks\.mjs$|skillpack\.mjs$|skilldoctrine\.mjs$/.test(f))], [true, []]);
}

section("R58 · model turns run under the resolved account and the run's pack, within the segment bound");
{
  await reset(mf, { target: "INQ-R40" }, {
    loadLayer: "prohibitions",
    judge: { compose: { candidates: [{ kind: "basis-version", name: "model-made", description: "the reading the model composed, in full" }] } } });
  const r = await runOp(mf, { ...base, account: ACCOUNTS });
  const calls = (await modelState(mf)).calls;
  const bodies = calls.map((c) => JSON.parse(c.raw));
  const parent = bodies.filter((b) => !(b.tools || []).some((x) => x.name === "report"));
  t("R58: the run completed with judgements the model made: the model's candidate landed",
    [r.status, r.out.judgement_source, (await planeState(mf)).suggested.map((s) => s.name).includes("model-made")], [200, "model", true]);
  t("R58: every model call went to the model API with the resolved account's token and the API version",
    [[...new Set(calls.map((c) => c.url))], [...new Set(calls.map((c) => c.key))], [...new Set(calls.map((c) => c.version))]],
    [[MODEL_ENDPOINT], [CLAUDE_TOKEN], ["2023-06-01"]]);
  t("R58: turns_run counts the model calls, within the segment", [r.out.turns_run, r.out.segment?.turns_run], [calls.length, calls.length]);
  t("R58: the parent is instructed by the run's pack: its system names the pack's version and carries the resident layer",
    [parent.every((b) => sysText(b).includes(PACK.version)), parent.every((b) => sysText(b).includes(JSON.stringify(PACK.resident)))], [true, true]);
  t("R58: a disclosed layer the model asked for was loaded from the pack",
    parent.some((b) => b.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "tool_result"
      && c.content === JSON.stringify(PACK.disclosed.prohibitions)))), true);
  t("R58: the parent judged plan, compose, dedup — collect's judgements are the sub-sessions' reports",
    [...new Set(parent.map((b) => (/Answer by calling judge_([a-z]+)/.exec([...b.messages].reverse()
      .map((m) => (m.role !== "user" ? "" : typeof m.content === "string" ? m.content
        : Array.isArray(m.content) ? m.content.filter((c) => c.type === "text").map((c) => c.text).join("") : ""))
      .find((c) => /judge_/.test(c)) ?? "") || [])[1]))], ["plan", "compose", "dedup"]);
  t("R58: the segment publishes what it sent the model", [r.out.segment?.bytes_sent, r.out.segment?.bytes_bound, r.out.segment?.stopped],
    [calls.reduce((n, c) => n + c.bytes, 0), DEFAULT_MAX_SEGMENT_BYTES, null]);

  await reset(mf, {});
  const three = await runOp(mf, { ...base, account: ACCOUNTS, turns: 3 });
  t("R58: the turn bound stops the SEGMENT, never the run: ended null, stopped 'turns', no close, 3 turns",
    [three.status, three.out.ended, three.out.segment?.stopped, three.out.turns_run, (await planeState(mf)).log.some((l) => l.op === "airunclose")],
    [200, null, "turns", 3, false]);

  /* The bound is half of what the whole run above sent, so it bites mid-run whatever the pack's size. */
  const half = Math.floor(calls.reduce((n, c) => n + c.bytes, 0) / 2);
  const small = newMf({ MAX_SEGMENT_BYTES: String(half) });
  await reset(small, {});
  const b = await runOp(small, { ...base, account: ACCOUNTS });
  const sent = (await modelState(small)).calls.reduce((n, c) => n + c.bytes, 0);
  t("R58 (D-611): the byte bound stops the segment before a request would carry it past the bound",
    [b.out.segment?.stopped, b.out.ended, sent <= half, b.out.segment?.bytes_sent === sent, b.out.segment?.bytes_bound], ["bytes", null, true, true, half]);
  await small.dispose();

  await reset(mf, {}, { status: 529, errorType: "overloaded_error" });
  const refused = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R58: a model call the API refuses -> 502 MODEL_REFUSED with its status and error type, no token",
    [refused.status, refused.out.code, refused.out.model_status, refused.out.model_error], [502, "MODEL_REFUSED", 529, "overloaded_error"]);
  await reset(mf, {}, { refuseAt: "plan" });
  const declined = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R58: a model that declines -> 502 MODEL_REFUSED, type refusal", [declined.out.code, declined.out.model_error], ["MODEL_REFUSED", "refusal"]);
  await reset(mf, {}, { silent: true });
  const silent = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R58: a model API that does not answer JSON -> 502 MODEL_SILENT", [silent.status, silent.out.code], [502, "MODEL_SILENT"]);
  await reset(mf, {}, { judge: { plan: { targets: [], maxPasses: 9 } } });
  const over = await runOp(mf, { ...base, account: ACCOUNTS });
  t("R58 (agent-harness R4): a model judgement reaching for control flow is refused as any judgement is",
    [over.status, over.out.code, over.out.fields], [400, "JUDGEMENT_OVERREACH", ["maxPasses"]]);
}

section("agent-harness R7 · sub-sessions run, one per level, each under its contract, returning only reports");
{
  await reset(mf, { target: "INQ-R41" }, { reports: {
    meaning: { state: "PRESENT", summary: "a leg already reaches this", citations: [{ address: "bundle:m1" }] },
    content: { state: "LOOKED_ABSENT", summary: "nothing extracted says so" },
    document: { state: "LOOKED_INDETERMINATE", summary: "the packets could not be read", bytes: "%PDF the packet" },
    internet: "silent" } });
  const r = await runOp(mf, { ...base, account: ACCOUNTS });
  const calls = (await modelState(mf)).calls.map((c) => JSON.parse(c.raw));
  const subs = calls.filter((b) => (b.tools || []).some((x) => x.name === "report"));
  /* agent-model R12 (T35, K1987): a sub-session's opening is three turns, its own words, a `read_facts` call and that
     call's result, which holds the contract's fields from the record; its system carries only the table's own fields
     (level, scope, returns). So a first request is one whose transcript is that opening, and its brief is the two put
     back together. */
  const firsts = subs.filter((b) => b.messages.length === 3);
  const factsOfOpening = (b) => JSON.parse(b.messages[2].content[0].content.map((c) => c.text).join(""));
  t("agent-harness R7: one sub-session per level, each starting its own conversation (nothing shared with the parent or another level)",
    firsts.map((b) => JSON.parse(sysText(b).split("YOUR SPAWN CONTRACT:\n")[1]).level), LEVELS);
  t("agent-harness R7, R61: each is briefed with its own spawn contract, exactly as published: the table's fields in its system, the record's as read_facts' result",
    firsts.map((b) => JSON.stringify(Object.fromEntries(Object.entries({ ...JSON.parse(sysText(b).split("YOUR SPAWN CONTRACT:\n")[1]),
                                                                          ...factsOfOpening(b) }).sort(([a], [c]) => a.localeCompare(c))))),
    (r.out.fanout?.contracts || []).map((c) => JSON.stringify(Object.fromEntries(Object.entries(c).sort(([a], [d]) => a.localeCompare(d))))));
  t("agent-harness R7: its tools are its contract's scope, `report` and agent-model's `read_facts`, nothing else",
    [...new Set(subs.map((b) => b.tools.map((x) => x.name).join(",")))], ["meaningrows,report,read_facts"]);
  t("agent-harness R7: no sub-session was handed the lens or a credential", subs.some((b) => /LENS|aik-|sk-ant/.test(JSON.stringify(b))), false);
  const st = await planeState(mf);
  t("agent-harness R7: a sub-session's meaningrows reached the plane through the parent's reader",
    st.log.filter((l) => l.op === "meaningrows" && l.query.limit === "5").length >= 4, true);
  const looks = st.runlog.filter((e) => /^sub-session /.test(e.subject ?? ""));
  t("agent-harness R7: each sub-session that looked was logged at its level (PRESENT as LOOKED_INDETERMINATE)",
    looks.map((e) => [e.level, e.state]), [["meaning", "LOOKED_INDETERMINATE"], ["content", "LOOKED_ABSENT"], ["document", "LOOKED_INDETERMINATE"]]);
  t("agent-harness R7: its report's observed_at is that entry's address, log:<seq>, and the level-empty candidate cites it",
    st.log.find((l) => l.op === "suggest" && l.body?.kind === "level-empty")?.body?.observed_at,
    `log:${looks.find((e) => e.level === "content")?.seq}`);
  t("agent-harness R7: reports are held to agent-harness R5 at collect: the one carrying bytes refused, the silent one named, neither an absence",
    [r.out.reports_taken, (r.out.reports_refused || []).map((x) => [x.level, x.code]).sort()],
    [2, [["document", "REPORT_UNKNOWN_FIELD"], ["internet", "SUBSESSION_NO_REPORT"]]]);
  t("agent-harness R7: the cited address was re-read by the parent", r.out.citations_reread, 1);
}

/* ============================================================ the invariants */
section("R35 · its only binding is PLANE; the plane is reached by no other route");
{
  /* R91 (R085): and this member's own segment driver, one object per run, holding nothing of the record. */
  t("R35, R91, R109: wrangler declares exactly one service binding, PLANE, the remote class's DO binding cross-script (REMOTE; no RUNNER), the "
    + "segment driver SEGMENTS (its own SegmentDriver), and no other Durable Object, R2, KV, D1, queue or secret binding",
    [WRANGLER_CFG.services, WRANGLER_CFG.durable_objects, ["r2_buckets", "kv_namespaces", "d1_databases", "queues",
      "secrets_store_secrets", "secrets", "containers"].filter((k) => k in WRANGLER_CFG)],
    [[{ binding: "PLANE", service: "bio-plane" }],
     { bindings: [{ name: "REMOTE", class_name: "RemoteSession", script_name: "agent-runner" },
                  { name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }] }, []]);
  t("R35: its vars hold no token and no plane URL", Object.keys(WRANGLER_CFG.vars), ["VERSION"]);
  await reset(mf, {});
  await runOp(mf, { ...base, account: ACCOUNTS });
  t("R35: across a whole model-mode run, every global fetch went to the model API and nowhere else",
    [...new Set((await modelState(mf)).calls.map((c) => c.url))], [MODEL_ENDPOINT]);
}

section("R36 · it holds no credential; nothing it answers carries a token");
{
  t("R36: no answer this suite received carried the ai credential or the Claude token",
    ANSWERS.filter((a) => a.text.includes(AIK) || a.text.includes(CLAUDE_TOKEN) || a.text.includes(SIGNIN_TOKEN)).length, 0);
  await reset(mf, {});
  await runOp(mf, { ...base, account: ACCOUNTS });
  const st = await planeState(mf);
  const m = await modelState(mf);
  t("R36: the Claude token went only in the model API's key header: never to the plane, never in a model request body",
    [JSON.stringify(st.log).includes(CLAUDE_TOKEN), m.calls.some((c) => c.raw.includes(CLAUDE_TOKEN)), m.calls.every((c) => c.key === CLAUDE_TOKEN)],
    [false, false, true]);
  t("R36: the ai credential went only to the plane, never to the model", m.calls.some((c) => c.raw.includes(AIK)), false);
  await reset(mf, {});
  const again = await runOp(mf, { ...base, account: { ...ACCOUNTS, secret: "sk-ant-second" } });
  t("R36: a second call's material is its own: nothing of the first was retained", [again.status, (await modelState(mf)).calls.every((c) => c.key === "sk-ant-second")],
    [200, true]);
}

section("R37 · it judges no scope; PLANE_OPS is exactly its ops, and it calls no other");
{
  /* R53 (K660) adds mode plan's: plan, plans, the R51 reads, and the write optionpropose. */
  t("R37, R53, R78: PLANE_OPS is exactly the reads and the writes the plane makes",
    [Object.keys(PLANE_OPS).filter((o) => !PLANE_OPS[o].mutating).sort(), Object.keys(PLANE_OPS).filter((o) => PLANE_OPS[o].mutating).sort()],
    PLANE_OPS_PINNED);  /* N1073: ai-runs', capture-requests' and action-plans' ops are read from their owners (owners.mjs) */
  await seen(mf);
  t("R37: the ops the member called across this suite's last run are all in PLANE_OPS",
    [...OPS_SEEN].filter((o) => !PLANE_OPS[o]), []);
  t("R37: none of its ops returns document bytes: no answer this suite received carries a data URL or a long base64 run",
    ANSWERS.filter((a) => /data:[\w/+.-]+;base64,|[A-Za-z0-9+/]{400,}={0,2}/.test(a.text)).length, 0);
}

section("R38 · it never writes runtime-ceiling-reached or any ending itself");
{
  await reset(mf, { budget: [...wide.slice(0, 3), { bound: "runtime", allowed: 6 }] });
  const r = await runOp(mf, { ...base, judgements: J() });
  const st = await planeState(mf);
  t("R38: the run ended on runtime, and the condition was the plane's: no request this member sent carried it",
    [r.out.ended?.condition, st.log.filter((l) => /runtime-ceiling-reached/.test(JSON.stringify(l.body ?? null))).length],
    ["runtime-ceiling-reached", 0]);
  t("R38: no tick it sent named an ending as a bound or condition",
    st.log.filter((l) => l.op === "airuntick").flatMap((l) => l.body.log || []).filter((e) => e.condition || (e.bound && e.bound !== "completed")).length, 0);
}

section("R39 · no model judgement sets mode, step, pass count or limit, budget, bound, run, namespace or target");
{
  for (const f of ["mode", "step", "pass", "maxPasses", "budget", "bound", "run", "store", "target"])
    t(`R39: a judgement setting ${f} is refused`, applyJudgement({}, { [f]: "x" }).ok, false);
}

section("R42 · enabling a mode is an edit to MODES, never a request parameter");
{
  await reset(mf, { mode: "investigate" });
  const r = await runOp(mf, { ...base, mode: "check", modes: { investigate: { deployed: true } }, deployed: true, judgements: J() });
  t("R42: no request field enables an undeployed mode", r.out.ended?.bound, "mode-not-deployed");
  t("R42, R53 (T46): MODES holds which modes are deployed: check, and plan by its own reviewed act", Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.deployed])),
    { check: true, investigate: false, extract: false, plan: true });
}

section("R43 · a refusal reaching the member is never reworded");
{
  const plane = { ok: false, reason: "AI_CREDENTIAL_REVOKED", code: "AI_CREDENTIAL_REVOKED", check: "C-29.7",
    translation: "This agent credential has been withdrawn by a member of the group, so it no longer reaches anything here." };
  await reset(mf);
  t("R43 (R8): the plane's refusal body passed through whole", (await runOp(mf, { ...base, credential: REVOKED })).out.plane, plane);
  const inner = suggestRefusals().unwritableState;
  for (const op of ["airun", "airunlog", "airunspawn", "basisversions", "suggest", "airuntick", "airunclose"]) {
    const body = { ok: true, result: inner };
    await reset(mf, { target: "INQ-R43", refuse_op: { [op]: { body } } });
    const r = await runOp(mf, { ...base, judgements: J([], [{ kind: "basis-version", name: "v", description: "a reading in full" }]) });
    const carried = [r.out.plane, ...(r.out.refusals || []).map((x) => x.plane)].filter(Boolean);
    t(`R43: a refusal of op=${op} carries the plane's body unchanged`,
      carried.some((p) => JSON.stringify(p) === JSON.stringify(body) || JSON.stringify(p) === JSON.stringify(body.result)), true);
  }
}

section("R44 · its copies equal their sources, both ways");
{
  t("R44: LEVELS is the key order of OBSERVATION_LEVELS", LEVELS, Object.keys(OBSERVATION_LEVELS));
  t("R44: REPORT_STATES' keys are OBSERVATION_STATES'", Object.keys(REPORT_STATES), Object.keys(OBSERVATION_STATES));
  t("R44: REPORTING_LEVEL is total over LEVELS and agrees with skills' reportsAs",
    [Object.keys(REPORTING_LEVEL), LEVELS.map((l) => REPORTING_LEVEL[l] === reportsAs(l))], [LEVELS, LEVELS.map(() => true)]);
  t("R44: NAMESPACES is the plane's (the member's refusal and the real plane's list the same set)",
    (await runOp(mf, { run_id: "r", store: "x", credential: AIK })).out.namespaces, planeNamespaces);
  /* R44 as R53 reads it since T46 (Bob's K2892; run-rules R14): the order's first member and plan are deployed, by
     plan's own reviewed act: MODES' deployed set is run-rules' DEPLOYED_MODES among the order's modes, both ways
     (DEPLOYED_MODES also names ask and draft, which are not run modes). */
  t("R44, R53 (T46): MODES' keys are DEPLOYMENT_SEQUENCE.order, and its deployed modes are run-rules' DEPLOYED_MODES' run modes: check and plan",
    [Object.keys(MODES), Object.keys(MODES).filter((k) => MODES[k].deployed),
     DEPLOYMENT_SEQUENCE.order.filter((m) => DEPLOYED_MODES.includes(m))],
    [DEPLOYMENT_SEQUENCE.order, ["check", "plan"], ["check", "plan"]]);
  t("R44, R53 (T46): plan is the order's last member and deploys apart, its flag and MODES.plan set together",
    [DEPLOYMENT_SEQUENCE.order.at(-1), DEPLOYMENT_SEQUENCE.deploys_apart?.plan?.deployed, MODES.plan?.deployed], ["plan", true, true]);
  t("R44: the mode-not-deployed ending is one of the plane's RUN_ENDINGS", Object.keys(RUN_ENDINGS).includes("mode-not-deployed"), true);
}

section("N53 · the skills doctrine's pins on this member, owned here (agent-harness R2, R44)");
{
  /* Moved from `bio-plane/test/skillsequencing.test.mjs` BLOCKS B and D (N53, K81): the skills doctrine cites this
     member's gate by address, and this member's own suite holds the address true. */
  t("R44 (N53): every export GATE_ADDRESS names exists here, and its row is a row of the table",
    [typeof HARNESS[GATE_ADDRESS.modes_export], typeof HARNESS[GATE_ADDRESS.table_export],
     typeof HARNESS[GATE_ADDRESS.first_step_export], typeof HARNESS[GATE_ADDRESS.decision_function],
     Object.prototype.hasOwnProperty.call(CONTROL_FLOW, GATE_ADDRESS.row), GATE_ADDRESS.file],
    /* T34-32 (N586; K1603, K1615): run-rules' GATE_ADDRESS names agent-harness' file, where the gate's code lives;
       agent-worker's `src/harness.mjs` is only a re-export until its importers re-point (T35). */
    ["object", "object", "string", "function", true, "agent-harness/src/harness.mjs"]);
  t("agent-harness R2 (N53): the gate is the first row every run takes, and nothing in it is judged",
    [FIRST_STEP === GATE_ADDRESS.row, CONTROL_FLOW[GATE_ADDRESS.row].judged], [true, null]);
  t("agent-harness R2 (N53): the gate is reached before any bound — an undeployed mode with a spent budget still stops on the mode",
    nextStep({ step: "gate-mode", mode: "investigate", pass: 9, maxPasses: 3,
               budget: { fetches: { allowed: 1, consumed: 999 } } }).bound, "mode-not-deployed");
  t("agent-harness R2 (N53): a mis-spelled deployed mode is refused too — the gate is not a denylist of one word",
    [nextStep({ step: "gate-mode", mode: "CHECK ", pass: 0, maxPasses: 3 }).bound,
     nextStep({ step: "gate-mode", mode: "check", pass: 0, maxPasses: 3 }).step], ["mode-not-deployed", "resume"]);
}

section("R45 · the committed bundle is a fresh build of src/index.mjs, its manifest naming every input");
{
  const member = discoverMembers().find((m) => m.name === "agent-worker");
  const stat = verifyStatic(member);
  t("R45: the static check finds nothing", stat.findings, []);
  const fresh = await verifyFresh(member, stat.committed);
  t("R45: a fresh build is byte-identical to the committed bundle", [fresh.checked, fresh.findings], [true, []]);
  const inputs = (stat.manifest?.inputs || []).map((i) => i.path);
  t("R45, R119: the manifest names every input, bio-plane/src/tokens.mjs and the agent-steps files included",
    ["../bio-plane/src/tokens.mjs", "src/index.mjs", "src/cascade.mjs", "src/ops.mjs", "src/ask.mjs", "src/draft.mjs",
     "../agent-steps/src/index.mjs", "../agent-steps/src/drive.mjs", "../agent-steps/src/work.mjs",
     "../agent-harness/src/harness.mjs", "../agent-harness/src/subsession.mjs", "../agent-model/src/model.mjs"]
      .filter((p) => !inputs.includes(p)), []);
}

section("R46 · no place is named in its behaviour or outward text; its account is the project's");
{
  const PLACES = /Oakland|Alameda|California|Berkeley|San Francisco/i;
  t("R46: no answer this suite received names a place", ANSWERS.filter((a) => PLACES.test(a.text.replace(/"[^"]*(?:ruth|believe-in-oakland)[^"]*"/g, ""))).length, 0);
  t("R46: no instruction it sends the model names a place",
    (await modelState(mf)).calls.some((c) => PLACES.test(sysText(JSON.parse(c.raw)).replace(JSON.stringify(PACK.resident), ""))), false);
  t("R46: its account_id is the project's one Cloudflare account", WRANGLER_CFG.account_id, "20b533579290b9b93168345edd3b7f72");
}

section("R47 · reachable only through the plane's service binding");
{
  t("R47: wrangler sets workers_dev false and preview_urls false", [WRANGLER_CFG.workers_dev, WRANGLER_CFG.preview_urls], [false, false]);
  t("R47: and it declares no route", ["routes", "route"].filter((k) => k in WRANGLER_CFG), []);
  t("R47: no answer this suite received carries access-control-allow-origin",
    [ANSWERS.length > 50, ANSWERS.filter((a) => "access-control-allow-origin" in a.headers).length], [true, 0]);
}

await mf.dispose();
console.log(`\nrequirements: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
