/* agent-worker — T47 (T47-24, T47-80; N949, N1001; K3060 D10, K1874, K3087): R81 (a `code` answer's token relayed only
 * under the door's `hold`), R82 (a `signin` account carries its held token as `secret`; `SIGNIN_NOT_HELD`), R83 (one
 * JSON line per `/signin` step, the trace and member-ref headers passed on, `RUNNER_SILENT` with the runner's status and
 * text head), R84 (`trace` on every `/signin` answer, the member's words on its own refusals, `SIGNIN_CODES`), R85 (a
 * code's `attempt` passed on; `SIGNIN_CODES` proven by driving) and R56 (the suggestions switch read from the wire's
 * account, a sign-in's as a reference's), AT THE MEMBER'S INTERFACE: the default export `fetch(request, env)`, driven in
 * this process with a recording `RUNNER` namespace (each instance named, each request or conversation frame recorded), a
 * recording plane binding, the global `fetch` replaced by a scripted model API, and the console captured. Nothing here
 * reads any module's source text.
 *
 * Every arm that admits has its refusing counterpart beside it (K874).
 */
import worker from "../src/index.mjs";
import { SIGNIN_CODES } from "../src/signin.mjs";
import { runnerRefusal } from "../../agent-runner/test/fixtures.mjs";
import { MEMBER } from "./account.mjs";
import { remoteBindings } from "./remote.mjs";
import { word } from "../../bio-plane/src/setup-words/index.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

const CODE = "ANTHROPIC-PAGE-CODE-T47-SENTINEL#state-9";
const TOKEN = "sk-ant-oat01-T47-HELD-TOKEN-SENTINEL-abcdefghijklmnopqrstuvwxyz0123456789";
const ADDRESS = "https://claude.ai/oauth/authorize?code=true&state=T47-ADDRESS-SENTINEL";
const ATTEMPT = "6f1c2a52-7d0e-4b8e-9a51-3c1d0e2f4a77";
const TRACE = "trace-t47-door-0001";
const REF = "a1b2c3d4e5f6";
const NEVER = /\b(plane|instance|copy|server|container|runner|binding)\b/i;
const ROUTES = { start: "/signin", code: "/signin/code", state: "/signin/state", signout: "/signout" };

/** Every console line written while `fn` runs. */
async function captured(fn) {
  const lines = [], saved = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) { saved[k] = console[k]; console[k] = (...a) => lines.push(a.map(String).join(" ")); }
  try { return { result: await fn(), lines }; } finally { for (const k of Object.keys(saved)) console[k] = saved[k]; }
}
const parsedLines = (lines) => lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

/* ================================================================================================ /signin */

/** A recording `RUNNER` namespace for `/signin`: `answer(path, body)` gives the instance's `Response`, or throws. */
function signinRunner(answer) {
  const calls = [], named = [];
  return { calls, named, binding: {
    idFromName: (name) => { named.push(name); return { name }; },
    get: (id) => ({ fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      calls.push({ instance: id.name, path: u.pathname + u.search, headers: { ...(init.headers || {}) }, body: init.body ?? null });
      return answer(u.pathname, JSON.parse(init.body ?? "null"));
    } }) } };
}
/** agent-runner's T47 answers (R27, R31): `start` answers its attempt, `code` the token once. */
const honest = (path, body) => {
  if (path === "/signin") return Response.json({ ok: true, address: ADDRESS, attempt: ATTEMPT, trace_detail: { ms: 3, cold: false, uptime_s: 9 } });
  if (path === "/signin/code") return Response.json({ ok: true, connected: true, member: body.member, attempt: ATTEMPT, token: TOKEN, valid_for: "1 year" });
  if (path === "/signin/state") return Response.json({ ok: true, connected: false, waiting: false, member: body.member });
  return Response.json({ ok: true, connected: false, member: body.member });
};

async function signin(body, { answer = honest, headers = {}, noRunner = false } = {}) {
  const r = signinRunner(answer);
  const plane = [];
  const env = { VERSION: "t47", PLANE: { fetch: async (u) => { plane.push(String(u)); return Response.json({ ok: false }, { status: 500 }); } },
                ...(noRunner ? {} : { ...remoteBindings(r.binding) }) };
  const w = await captured(async () => {
    const res = await worker.fetch(new Request("http://agent-worker/signin", { method: "POST", headers,
      body: typeof body === "string" ? body : JSON.stringify(body) }), env);
    const text = await res.text();
    let out = null; try { out = JSON.parse(text); } catch { out = null; }
    return { status: res.status, text, out };
  });
  const json = parsedLines(w.lines).filter((l) => l.event === "signin.worker");
  return { ...w.result, runner: r.calls, named: r.named, plane, lines: w.lines, signinLines: json };
}
const codeOf = (r) => [r.status, r.out?.code];
const bare = (o) => { if (o === null || typeof o !== "object") return o; const { trace: _t, ...rest } = o; return rest; };
const DOOR = { [`x-civicsmith-trace`]: TRACE, [`x-civicsmith-member-ref`]: REF };

section("R81 · a code answer's token goes to the door once, and only under its hold");
{
  const held = await signin({ member: MEMBER, step: "code", code: CODE, hold: true }, { headers: DOOR });
  t("R81: with hold: true, the runner's code answer is relayed unchanged (but for trace), the token in it",
    [held.status, bare(held.out)], [200, { ok: true, connected: true, member: MEMBER, attempt: ATTEMPT, token: TOKEN, valid_for: "1 year" }]);
  t("R81: the token is in the answer exactly once", held.text.split(TOKEN).length - 1, 1);
  t("R81: and in no log line", held.lines.filter((l) => l.includes(TOKEN)).length, 0);
  t("R81, R83: the line says the token was held", held.signinLines.map((l) => [l.outcome, l.held]), [["ok", true]]);

  for (const [label, extra] of [["absent", {}], ["false", { hold: false }], ["the string \"true\"", { hold: "true" }], ["1", { hold: 1 }]]) {
    const r = await signin({ member: MEMBER, step: "code", code: CODE, ...extra });
    t(`R81: hold ${label}: the token and valid_for are removed and the answer says held: false`,
      [r.status, bare(r.out)], [200, { ok: true, connected: true, member: MEMBER, attempt: ATTEMPT, held: false }]);
    t(`R81: hold ${label}: the token is in no answer and no log line`, [r.text.includes(TOKEN), r.lines.some((l) => l.includes(TOKEN))], [false, false]);
    t(`R81, R83: hold ${label}: the line says held: false`, r.signinLines.map((l) => l.held), [false]);
  }
  t("R81: the door's hold is not sent to the runner (the runner's body is {member, code} only)",
    JSON.parse(held.runner[0].body), { member: MEMBER, code: CODE });

  const start = await signin({ member: MEMBER, step: "start", hold: true });
  t("R81 (control): a start answer is relayed unchanged (but for trace), with no held field",
    [start.status, bare(start.out)], [200, { ok: true, address: ADDRESS, attempt: ATTEMPT, trace_detail: { ms: 3, cold: false, uptime_s: 9 } }]);
  const refused = await signin({ member: MEMBER, step: "code", code: CODE },
    { answer: () => Response.json({ ok: false, reason: "SIGNIN_REFUSED", code: "SIGNIN_REFUSED", detail: "Anthropic did not accept the code." }, { status: 409 }) });
  t("R81 (control): a code refused carries no token and no held field: relayed unchanged but for trace",
    [refused.status, bare(refused.out)], [409, { ok: false, reason: "SIGNIN_REFUSED", code: "SIGNIN_REFUSED", detail: "Anthropic did not accept the code." }]);
  const nothing = [held, start, refused];
  t("R81: no step sent the token anywhere: to the plane or to the runner", nothing.some((r) => r.plane.length || r.runner.some((c) => JSON.stringify(c).includes(TOKEN))), false);
}

section("R83 · one JSON line per /signin step; the door's trace and member reference passed on");
{
  const r = await signin({ member: MEMBER, step: "code", code: CODE, hold: true }, { headers: DOOR });
  t("R83: exactly one signin.worker line, and no other line", [r.signinLines.length, r.lines.length], [1, 1]);
  const l = r.signinLines[0] ?? {};
  t("R83: the line's fields are the named ones",
    Object.keys(l).sort(), ["event", "held", "member_ref", "ms_runner", "outcome", "runner_content_type", "runner_status", "runner_text_bytes", "step", "trace"]);
  t("R83: the trace and member reference are the door's; the step, outcome and runner's status are stated",
    [l.trace, l.member_ref, l.step, l.outcome, l.runner_status, l.runner_content_type, typeof l.ms_runner, l.runner_text_bytes > 0],
    [TRACE, REF, "code", "ok", 200, "application/json", "number", true]);
  t("R83: both headers are passed on to the runner, the trace in the answer too",
    [r.runner[0].headers["x-civicsmith-trace"], r.runner[0].headers["x-civicsmith-member-ref"], r.out?.trace], [TRACE, REF, TRACE]);
  t("R83: no other header reaches the runner but the content type",
    Object.keys(r.runner[0].headers).sort(), ["content-type", "x-civicsmith-member-ref", "x-civicsmith-trace"]);
  t("R83: the sentinel code and token are in no line", r.lines.some((x) => x.includes(CODE) || x.includes(TOKEN)), false);
  t("R83: the member's bare id is in no line", r.lines.some((x) => x.includes(MEMBER)), false);

  const minted = await signin({ member: MEMBER, step: "state" });
  const ml = minted.signinLines[0] ?? {};
  t("R83: with no trace header a trace is minted, the same in the line, the runner's request and the answer",
    [typeof ml.trace, ml.trace?.length > 8, minted.runner[0].headers["x-civicsmith-trace"] === ml.trace, minted.out?.trace === ml.trace],
    ["string", true, true, true]);
  t("R83: with no member reference header the line's is null, and none is sent on",
    [ml.member_ref, "x-civicsmith-member-ref" in minted.runner[0].headers], [null, false]);
  const odd = await signin({ member: MEMBER, step: "state" }, { headers: { "x-civicsmith-trace": "a b\u0007" + "x".repeat(300), "x-civicsmith-member-ref": "has space" } });
  t("R83 (control): a header that is not a short name is not used: the trace is minted, the reference null",
    [odd.signinLines[0]?.trace === "a b\u0007" + "x".repeat(300), odd.signinLines[0]?.member_ref], [false, null]);

  const plain500 = await signin({ member: MEMBER, step: "code", code: CODE },
    { headers: DOOR, answer: () => new Response(`Failed to start container: ${CODE} at https://x.example/p?token=${TOKEN} ${TOKEN}`,
                                                  { status: 500, headers: { "content-type": "text/plain" } }) });
  const pl = plain500.signinLines[0] ?? {};
  t("R83: a runner answering text/plain 500 is logged with its status, content type and head",
    [pl.outcome, pl.code, pl.runner_status, pl.runner_content_type, typeof pl.runner_text_head], ["failed", "RUNNER_SILENT", 500, "text/plain", "string"]);
  t("R83: and answered 502 RUNNER_SILENT carrying both", [codeOf(plain500), plain500.out?.runner_status, plain500.out?.runner_text_head === pl.runner_text_head],
    [[502, "RUNNER_SILENT"], 500, true]);
  t("R83: the head is at most 120 characters, begins with the runner's words, and carries no code, no URL query and nothing token-shaped",
    [pl.runner_text_head.length <= 120, pl.runner_text_head.startsWith("Failed to start container:"),
     plain500.text.includes(CODE) || plain500.lines.some((x) => x.includes(CODE)),
     plain500.text.includes(TOKEN) || plain500.lines.some((x) => x.includes(TOKEN)), /\?token=/.test(pl.runner_text_head)],
    [true, true, false, false, false]);

  const RAW = "Q7rT".repeat(10), JWT = "eyJhbGciOi.eyJzdWIiOiJ0.c2lnbmF0dXJl";
  const shapes = await signin({ member: MEMBER, step: "state" },
    { answer: () => new Response(`oops ${RAW} and ${JWT} end`, { status: 503, headers: { "content-type": "text/plain" } }) });
  t("R83: the head has every run of 32 or more token characters and every JWT removed, the runner's other words kept",
    [shapes.out?.runner_text_head.includes(RAW), shapes.out?.runner_text_head.includes(JWT), shapes.out?.runner_text_head.startsWith("oops "),
     shapes.out?.runner_text_head.endsWith(" end"), shapes.lines.some((l) => l.includes(RAW) || l.includes(JWT))],
    [false, false, true, true, false]);
  const own = await signin({ member: "", step: "code", code: CODE }, { headers: DOOR });
  t("R83: a refusal made before any runner call is one line too, naming its code, with no runner fields",
    own.signinLines.map((x) => [x.outcome, x.code, x.runner_status, x.trace]), [["refused", "BAD_MEMBER", null, TRACE]]);
  const relayed = await signin({ member: MEMBER, step: "start" },
    { answer: () => Response.json({ ok: false, code: "NOT_THIS_MEMBER", detail: "Another member's sign-in is waiting here." }, { status: 409 }) });
  t("R83: a runner refusal is a refused line naming its code and status", relayed.signinLines.map((x) => [x.outcome, x.code, x.runner_status]),
    [["refused", "NOT_THIS_MEMBER", 409]]);
}

section("R84 · trace on every /signin answer; the member's words on every refusal this module makes; SIGNIN_CODES");
{
  const own = [
    ["RUNNER_NOT_CONFIGURED", await signin({ member: MEMBER, step: "start" }, { noRunner: true, headers: DOOR }), 503],
    ["BAD_BODY", await signin("{nope", { headers: DOOR }), 400],
    ["BAD_MEMBER", await signin({ member: 7, step: "start" }, { headers: DOOR }), 400],
    ["BAD_STEP", await signin({ member: MEMBER, step: "login" }, { headers: DOOR }), 400],
    ["BAD_CODE", await signin({ member: MEMBER, step: "code" }, { headers: DOOR }), 400],
    ["RUNNER_SILENT", await signin({ member: MEMBER, step: "start" }, { headers: DOOR, answer: () => { throw new Error("container is starting"); } }), 502],
    ["RUNNER_SILENT", await signin({ member: MEMBER, step: "state" }, { headers: DOOR, answer: () => new Response("<html>bad gateway</html>", { status: 502 }) }), 502],
  ];
  for (const [code, r, status] of own) {
    t(`R84: ${code} carries the door's trace and a member-readable detail naming your group's Civicsmith or the thing itself, with no place word`,
      [codeOf(r), r.out?.trace, typeof r.out?.detail === "string" && r.out.detail.length > 20 && r.out.detail.length <= 300,
       NEVER.test(r.out?.detail ?? ""), /your team's Civicsmith|Anthropic's page/i.test(r.out?.detail ?? "")],
      [[status, code], TRACE, true, false, true]);
  }
  const success = await signin({ member: MEMBER, step: "signout" }, { headers: DOOR });
  t("R84: a success carries trace too", [success.status, success.out?.trace], [200, TRACE]);
  const theirs = { ok: false, reason: "ATTEMPT_SUPERSEDED", code: "ATTEMPT_SUPERSEDED", detail: "A newer sign-in was started.", trace: "runner-own-trace" };
  const kept = await signin({ member: MEMBER, step: "code", code: CODE, attempt: "old" }, { headers: DOOR, answer: () => Response.json(theirs, { status: 409 }) });
  t("R84, R43: a runner answer that already carries a trace is relayed byte-for-byte as the runner gave it",
    [kept.status, kept.out], [409, theirs]);

  /* R85: SIGNIN_CODES proven by driving, never by reading another module's source. */
  const RUNNER_REQUIREMENT_CODES = {
    "R17": ["BAD_REQUEST", "BAD_MEMBER", "NOT_THIS_MEMBER", "SIGNIN_ADDRESS_UNEXPECTED", "SIGNIN_UNAVAILABLE"],
    "R18": ["NO_SIGNIN_WAITING", "BAD_CODE", "SIGNIN_REFUSED"],
    "R20": ["SIGNOUT_FAILED"], "R26": ["RUNNER_NOT_STARTED"], "R27": ["SIGNIN_REFUSED"],
    "R28": ["SIGNIN_NOT_HELD", "SIGNIN_TOKEN_REFUSED"], "R31": ["ATTEMPT_SUPERSEDED"],
  };
  const NOT_FROM_THE_IMAGE = new Set(["SIGNOUT_FAILED", "RUNNER_NOT_STARTED"]);
  const produced = new Set(own.map(([code]) => code));
  for (const [rid, codes] of Object.entries(RUNNER_REQUIREMENT_CODES)) {
    for (const code of codes) {
      /* The image's own answer, from agent-runner's published fixture; the two codes it never sends from a route are made up here. */
      // fixtures-generic: SIGNOUT_FAILED
      // fixtures-generic: RUNNER_NOT_STARTED
      const given = NOT_FROM_THE_IMAGE.has(code) ? { status: 409, body: { ok: false, code, detail: "Words for the member." } } : await runnerRefusal(code);
      const { body } = given, status = given.status ?? 409; /* a conversation frame has no HTTP status of its own: the wire here carries it as a 409 */
      const r = await signin({ member: MEMBER, step: "code", code: CODE }, { headers: DOOR, answer: () => Response.json(body, { status }) });
      t(`R84, R85: the runner's ${code} (agent-runner ${rid}) is relayed unchanged but for trace, and is in SIGNIN_CODES`,
        [r.status, bare(r.out), r.out?.trace, SIGNIN_CODES.includes(r.out?.code)], [status, bare(body), body.trace ?? TRACE, true]);
      produced.add(r.out?.code);
    }
  }
  t("R84, R85: SIGNIN_CODES equals exactly the codes driven above: this module's own refusals and the runner's",
    [...SIGNIN_CODES].sort(), [...produced].sort());
  t("R84: SIGNIN_CODES is frozen", Object.isFrozen(SIGNIN_CODES), true);
}

section("R85 · a code's attempt is passed on unchanged; start's attempt reaches the door unchanged");
{
  const withAttempt = await signin({ member: MEMBER, step: "code", code: CODE, attempt: ATTEMPT, hold: true });
  t("R85: the code step relays {member, code, attempt}, the attempt unchanged",
    JSON.parse(withAttempt.runner[0].body), { member: MEMBER, code: CODE, attempt: ATTEMPT });
  const long = await signin({ member: MEMBER, step: "code", code: CODE, attempt: "a".repeat(200) });
  t("R85: an attempt of exactly 200 characters is passed on", JSON.parse(long.runner[0].body).attempt, "a".repeat(200));
  for (const [label, attempt] of [["of 201 characters", "a".repeat(201)], ["a number", 7], ["an object", { id: ATTEMPT }], ["null", null]]) {
    const r = await signin({ member: MEMBER, step: "code", code: CODE, attempt });
    t(`R85 (control): an attempt ${label} is not passed, and the step is still sent`,
      [r.runner.length, JSON.parse(r.runner[0]?.body ?? "{}")], [1, { member: MEMBER, code: CODE }]);
  }
  const start = await signin({ member: MEMBER, step: "start", attempt: ATTEMPT });
  t("R85: start's own body is {member}, an attempt sent with it not passed", JSON.parse(start.runner[0].body), { member: MEMBER });
  t("R85: start's attempt reaches the door in the runner's answer unchanged", start.out?.attempt, ATTEMPT);
  const state = await signin({ member: MEMBER, step: "state", attempt: ATTEMPT });
  t("R85 (control): state and signout send {member} only", JSON.parse(state.runner[0].body), { member: MEMBER });
}

/* ================================================================================================ R82, R56 */

const AIK = "aik-" + "7".repeat(64);
const GRANT = "aig-t47-fixture-grant-never-echoed";
const KEY_SECRET = "sk-ant-t47-apikey-fixture-never-echoed";
const KEY = { kind: "apikey", level: "member", secret: KEY_SECRET, member: MEMBER };
const SIGNIN = (suggestions = false, extra = {}) => ({ kind: "signin", level: "member", member: MEMBER, secret: TOKEN, suggestions, ...extra });
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@t47",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("SUGGESTIONS-LAYER-WORDS"), writing_help: LAYER("WRITING-HELP-WORDS") } };
const PICTURE = "PICTURE-T47";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(PICTURE.repeat(4))]).toString("base64");

function plane() {
  const calls = [];
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai", version: "t47" });
  return { calls, binding: { async fetch(url, init) {
    const u = new URL(url);
    const op = u.searchParams.get("op") || "";
    let body = null; try { body = typeof init?.body === "string" ? JSON.parse(init.body) : null; } catch { body = null; }
    calls.push({ op, raw: String(url) + JSON.stringify(init?.headers ?? {}) + (typeof init?.body === "string" ? init.body : "") });
    switch (op) {
      case "whoami": return ok({ tokenClass: "ai", session: false, member: null });
      case "agentpack": return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
      case "askceiling": return ok({ ok: true, reached: false });
      case "askcheck": return ok({ ok: true, answer: { ...(body?.answer || {}) }, withheld: [] });
      case "askusage": return ok({ ok: true });
      case "airun": return ok({ found: true, session: { id: "RUN-47", mode: "check", status: "running", max_passes: 1,
        context: { type: "inquiry", id: "INQ-1" }, principal: { plane: `${MEMBER}/TOK`, claude: MEMBER, ref: MEMBER, skill: PACK.version }, state: null,
        budget: [{ bound: "fetches", allowed: 9 }, { bound: "subsessions", allowed: 9 }, { bound: "wallclock", allowed: 9e5 },
                 { bound: "runtime", allowed: 5000 }].map((b) => ({ ...b, consumed: 0 })) } });
      case "airunlog": return ok({ found: true, entries: [], truncated: false });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: "RUN-47", context: { type: "inquiry", id: "INQ-1" }, mode: "check", skill: PACK.version, standard_pair: null } });
      case "basisversions": return ok({ versions: [] });
      case "airuntick": return ok({ ticked: true, appended: (body?.log || []).length, refused: [] });
      case "airunclose": return ok({ terminated: true });
      default: return ok({ op, rows: [{ id: "EVT-1" }] });
    }
  } } };
}
function answerFor(names, prompt) {
  if (names.includes("done_reading")) return ["done_reading", { question_as_read: "who held the seat" }];
  if (names.includes("answer")) return ["answer", { question_as_read: "who held the seat", clarifying: null, summary: "S",
    sentences: [{ text: "Ruth held it.", kind: "quote", support: ["EVT-1"] }], label: "machine work" }];
  if (names.includes("report")) return ["report", { state: "LOOKED_ABSENT", summary: "nothing" }];
  if (names.includes("draft")) return ["draft", { text: "drafted" }];
  if (names.includes("read_page")) return ["read_page", {}];
  const judge = [...String(prompt).matchAll(/calling (judge_\w+)/g)].pop()?.[1];
  return [judge && names.includes(judge) ? judge : names.find((n) => n.startsWith("judge_")), {}];
}
/* The Container namespace `RUNNER` (agent-runner's wire): every frame recorded, the first of each conversation apart. */
function convRunner() {
  const firsts = [], frames = [], named = [];
  const connect = async (url) => {
    if (String(url).endsWith("/version")) return Response.json({ ok: true, name: "agent-runner", version: "t47", capabilities: ["image"] });
    const on = {};
    const emit = (m) => setTimeout(() => (on.message || []).forEach((f) => f({ data: JSON.stringify(m) })), 0);
    let first = null, step = 0;
    const ws = { accept() {}, close() {}, addEventListener(type, fn) { (on[type] ||= []).push(fn); },
      send(text) {
        frames.push(text);
        const m = JSON.parse(text);
        if (!first) {
          first = m; firsts.push(m);
          const [name, input] = answerFor((m.tools || []).map((x) => x.name), m.prompt);
          return emit({ tool_use: { id: "c1", name, input } });
        }
        step += 1;
        if (first.tools?.some((x) => x.name === "transcription") && step === 1)
          return emit({ tool_use: { id: "c2", name: "transcription", input: { text: "the words" } } });
        return emit({ ok: true, result: "", stop_reason: "end_turn", usage: { input_tokens: 2, output_tokens: 1 }, num_turns: 1 });
      } };
    return { status: 101, webSocket: ws };
  };
  return { firsts, frames, named, idFromName: (n) => { named.push(n); return { name: n }; },
           newUniqueId: () => { named.push("<unique>"); return { name: "<unique>" }; }, get: () => ({ fetch: connect }) };
}
async function drive(path, body) {
  const p = plane(), r = convRunner();
  const api = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    api.push(String(init?.body ?? ""));
    const b = JSON.parse(init.body);
    const [name, input] = answerFor((b.tools || []).map((x) => x.name), JSON.stringify(b.messages));
    const out = name === "read_page" ? ["transcription", { text: "the words" }] : [name, input];
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${api.length}`, name: out[0], input: out[1] }], usage: { input_tokens: 3, output_tokens: 2 } });
  };
  try {
    const w = await captured(async () => {
      const res = await worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", body: JSON.stringify(body) }),
        { VERSION: "t47", PLANE: p.binding, ...remoteBindings(r) });
      return { status: res.status, text: await res.text() };
    });
    const lines = w.result.text.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } });
    return { ...w.result, last: lines[lines.length - 1], plane: p.calls, runner: r, api, lines: w.lines };
  } finally { globalThis.fetch = saved; }
}
const BODIES = {
  ask: (account) => ({ question: "Who held the seat?", grant: GRANT, account }),
  run: (account) => ({ run_id: "RUN-47", store: "scratch", credential: AIK, account }),
  draft: (account) => ({ task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote.", account, pack: PACK }),
  transcribe: (account) => ({ capture_sha: "c".repeat(64), pages: [{ page: 0, media_type: "image/png", data: PNG }], account }),
};

section("R82 · a signin account carries its held token as secret: to the member's own runner's first frame and nowhere else");
{
  for (const [path, body] of Object.entries(BODIES)) {
    const r = await drive(path, body(SIGNIN()));
    t(`R82 (/${path}): a signin account with a sentinel secret is served`, r.status, 200);
    t(`R82 (/${path}): its conversations run on the member's own instance only, and no API call is made`,
      [[...new Set(r.runner.named)], r.runner.firsts.length > 0, r.api.length], [[MEMBER], true, 0]);
    t(`R82 (/${path}): every conversation's first frame carries the credential {kind: signin, member, secret} (agent-model R16)`,
      [...new Set(r.runner.firsts.map((m) => JSON.stringify(m.credential)))], [JSON.stringify({ kind: "signin", member: MEMBER, secret: TOKEN })]);
    t(`R82 (/${path}): the secret is in no later frame, no answer, no log line and no plane call`,
      [r.runner.frames.filter((f) => f.includes(TOKEN)).length === r.runner.firsts.length, r.text.includes(TOKEN),
       r.lines.some((l) => l.includes(TOKEN)), r.plane.some((c) => c.raw.includes(TOKEN))], [true, false, false, false]);
  }
  for (const [path, body] of Object.entries(BODIES)) {
    for (const [label, account] of [["no secret", SIGNIN(false, { secret: undefined })], ["an empty secret", SIGNIN(false, { secret: "" })]]) {
      const r = await drive(path, body(account));
      const out = JSON.parse(r.text);
      t(`R82 (/${path}): a signin account with ${label} is 409 SIGNIN_NOT_HELD, no plane call, no runner named, no model call`,
        [r.status, out.code, out.reason, r.plane.length, r.runner.named.length, r.api.length], [409, "SIGNIN_NOT_HELD", "SIGNIN_NOT_HELD", 0, 0, 0]);
      t(`R82 (/${path}): its detail is the record's word for it (refusal.SIGNIN_NOT_HELD: the sign-in is signed in again by the member it belongs to), with no place word`,
        [out.detail === word("refusal.SIGNIN_NOT_HELD"), /\b(plane|instance|copy|server)\b/i.test(out.detail ?? "")], [true, false]);
    }
    const bad = await drive(path, body(SIGNIN(false, { secret: { token: TOKEN } })));
    t(`R82 (/${path}, control): a secret that is not a string is 400 BAD_ACCOUNT and is not echoed`,
      [bad.status, JSON.parse(bad.text).code, bad.text.includes(TOKEN), bad.plane.length], [400, "BAD_ACCOUNT", false, 0]);
  }
  for (const [path, body] of Object.entries(BODIES)) {
    const k = await drive(path, body(KEY));
    t(`R82 (/${path}, control): an apikey account is unchanged: served on the API under its key, no runner named`,
      [k.status, k.api.length > 0, k.runner.named.length, k.text.includes(KEY_SECRET)], [200, true, 0, false]);
  }
}

section("R56 (T47) · the suggestions switch is read from the wire's account, a sign-in's as a reference's");
{
  const sys = (r) => r.runner.firsts.map((m) => JSON.stringify(m.system ?? "")).join("\n");
  const on = await drive("draft", BODIES.draft(SIGNIN(true)));
  const off = await drive("draft", BODIES.draft(SIGNIN(false)));
  const absent = await drive("draft", BODIES.draft(SIGNIN(false, { suggestions: undefined })));
  t("R56: a draft on a sign-in whose own switch is on loads the suggestions layer", [on.status, sys(on).includes("SUGGESTIONS-LAYER-WORDS")], [200, true]);
  t("R56 (control): off, or absent, it is not loaded", [off.status, sys(off).includes("SUGGESTIONS-LAYER-WORDS"), absent.status, sys(absent).includes("SUGGESTIONS-LAYER-WORDS")],
    [200, false, 200, false]);
  const layers = (r) => r.runner.firsts.map((m) => m.tools?.find((x) => x.name === "load_layer")?.input_schema?.properties?.name?.enum ?? []);
  const askOn = await drive("ask", BODIES.ask(SIGNIN(true)));
  const askOff = await drive("ask", BODIES.ask(SIGNIN(false)));
  t("R56: an ask on a sign-in offers the suggestions layer exactly when its own switch is on",
    [layers(askOn).every((l) => l.includes("suggestions")), layers(askOff).some((l) => l.includes("suggestions"))], [true, false]);
  const keyOn = await drive("draft", BODIES.draft({ ...KEY, suggestions: true }));
  t("R56 (control): a reference's switch is read the same way", [keyOn.status, keyOn.api.some((b) => b.includes("SUGGESTIONS-LAYER-WORDS"))], [200, true]);
}

console.log(`\nt47: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
