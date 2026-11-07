/* agent-worker — T47 (T47-24, T47-80; N949, N1001; K3060 D10, K1874, K3087) as F2 leaves it (coordinator ruling
 * 5 Nov 2026; agent-runner R13, K5576): `agent-runner`'s remote session is gone and this member binds no runner, so the
 * `/signin` relay (R81, R83, R85) and every conversation on a member's own sign-in no longer run. What stays testable:
 * `/signin` answers RUNNER_NOT_CONFIGURED with `trace` and the member's words (R84, F2); a `signin` account with no held
 * secret is SIGNIN_NOT_HELD (R82); one with its secret is refused ASSISTANT_REMOTE_NOT_READY before any model call (F2);
 * an API-key account is unchanged; and the suggestions switch is read from the wire's account (R56). Driven AT THE
 * MEMBER'S INTERFACE: the default export `fetch(request, env)`, in this process, with `REMOTE` and `RUNNER` bound to a
 * namespace that records and throws on any use, a recording plane binding, the global `fetch` replaced by a scripted
 * model API, and the console captured. Nothing here reads any module's source text.
 *
 * Every arm that admits has its refusing counterpart beside it (K874).
 */
import worker from "../src/index.mjs";
import { SIGNIN_CODES } from "../src/signin.mjs";
import { MEMBER } from "./account.mjs";
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
const TRACE = "trace-t47-door-0001";
const REF = "a1b2c3d4e5f6";
const NEVER = /\b(plane|instance|copy|server|container|runner|binding)\b/i;

/** Every console line written while `fn` runs. */
async function captured(fn) {
  const lines = [], saved = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) { saved[k] = console[k]; console[k] = (...a) => lines.push(a.map(String).join(" ")); }
  try { return { result: await fn(), lines }; } finally { for (const k of Object.keys(saved)) console[k] = saved[k]; }
}
const parsedLines = (lines) => lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

/** A recording namespace whose every use throws: bound as `REMOTE` and `RUNNER`, it shows that nothing is reached. */
function untouched() {
  const calls = [];
  const touch = (what) => { calls.push(what); throw new Error(`runner binding touched: ${what}`); };
  return { calls, binding: { idFromName: () => touch("idFromName"), newUniqueId: () => touch("newUniqueId"), get: () => touch("get"),
                             fetch: () => touch("fetch") } };
}

/* ================================================================================================ /signin */

async function signin(body, { headers = {} } = {}) {
  const r = untouched();
  const plane = [];
  const env = { VERSION: "t47", PLANE: { fetch: async (u) => { plane.push(String(u)); return Response.json({ ok: false }, { status: 500 }); } },
                REMOTE: r.binding };
  const w = await captured(async () => {
    const res = await worker.fetch(new Request("http://agent-worker/signin", { method: "POST", headers,
      body: typeof body === "string" ? body : JSON.stringify(body) }), env);
    const text = await res.text();
    let out = null; try { out = JSON.parse(text); } catch { out = null; }
    return { status: res.status, text, out };
  });
  const json = parsedLines(w.lines).filter((l) => l.event === "signin.worker");
  return { ...w.result, runner: r.calls, plane, lines: w.lines, signinLines: json };
}
const codeOf = (r) => [r.status, r.out?.code];
const DOOR = { [`x-civicsmith-trace`]: TRACE, [`x-civicsmith-member-ref`]: REF };

section("F2, R84 · /signin binds no runner: RUNNER_NOT_CONFIGURED, with the door's trace and the member's words");
{
  for (const body of [{ member: MEMBER, step: "code", code: CODE, hold: true }, { member: MEMBER, step: "start" }, "{nope"]) {
    const r = await signin(body, { headers: DOOR });
    const label = typeof body === "string" ? "a body not JSON" : `step ${body.step}`;
    t(`F2, R84: ${label}: 503 RUNNER_NOT_CONFIGURED carrying the door's trace and a member-readable detail with no place word`,
      [codeOf(r), r.out?.trace, typeof r.out?.detail === "string" && r.out.detail.length > 20 && r.out.detail.length <= 300,
       NEVER.test(r.out?.detail ?? ""), /your team's Civicsmith|Anthropic's page/i.test(r.out?.detail ?? "")],
      [[503, "RUNNER_NOT_CONFIGURED"], TRACE, true, false, true]);
    t(`F2: ${label}: neither REMOTE nor RUNNER is touched, no plane call`, [r.runner, r.plane.length], [[], 0]);
    t(`F2, R83: ${label}: one signin.worker line, outcome failed, the door's trace and member reference, no code or token`,
      [r.signinLines.map((l) => [l.outcome, l.code, l.trace, l.member_ref]), r.lines.some((x) => x.includes(CODE) || x.includes(TOKEN))],
      [[["failed", "RUNNER_NOT_CONFIGURED", TRACE, REF]], false]);
  }
  const minted = await signin({ member: MEMBER, step: "state" });
  t("F2, R83: with no trace header a trace is minted, the same in the line and the answer",
    [typeof minted.out?.trace, minted.out?.trace?.length > 8, minted.signinLines[0]?.trace === minted.out?.trace], ["string", true, true]);
  t("R84: SIGNIN_CODES is frozen and names RUNNER_NOT_CONFIGURED", [Object.isFrozen(SIGNIN_CODES), SIGNIN_CODES.includes("RUNNER_NOT_CONFIGURED")], [true, true]);
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
async function drive(path, body) {
  const p = plane(), r = untouched();
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
        { VERSION: "t47", PLANE: p.binding, REMOTE: r.binding });
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

section("F2, R82 · a signin account: refused before any model call, its held token nowhere");
{
  for (const [path, body] of Object.entries(BODIES)) {
    const r = await drive(path, body(SIGNIN()));
    const out = JSON.parse(r.text);
    t(`F2 (/${path}): a signin account with its held secret is 503 ASSISTANT_REMOTE_NOT_READY, why absent, no model call, no runner touched`,
      [r.status, out.code, out.why, r.api.length, r.runner.calls], [503, "ASSISTANT_REMOTE_NOT_READY", "absent", 0, []]);
    t(`F2, R36 (/${path}): the secret is in no answer, no log line and no plane call`,
      [r.text.includes(TOKEN), r.lines.some((l) => l.includes(TOKEN)), r.plane.some((c) => c.raw.includes(TOKEN))], [false, false, false]);
  }
  for (const [path, body] of Object.entries(BODIES)) {
    for (const [label, account] of [["no secret", SIGNIN(false, { secret: undefined })], ["an empty secret", SIGNIN(false, { secret: "" })]]) {
      const r = await drive(path, body(account));
      const out = JSON.parse(r.text);
      t(`R82 (/${path}): a signin account with ${label} is 409 SIGNIN_NOT_HELD, no plane call, no runner touched, no model call`,
        [r.status, out.code, out.reason, r.plane.length, r.runner.calls.length, r.api.length], [409, "SIGNIN_NOT_HELD", "SIGNIN_NOT_HELD", 0, 0, 0]);
      t(`R82 (/${path}): its detail is the record's word for it (refusal.SIGNIN_NOT_HELD: the sign-in is signed in again by the member it belongs to), with no place word`,
        [out.detail === word("refusal.SIGNIN_NOT_HELD"), /\b(plane|instance|copy|server)\b/i.test(out.detail ?? "")], [true, false]);
    }
    const bad = await drive(path, body(SIGNIN(false, { secret: { token: TOKEN } })));
    t(`R82 (/${path}, control): a secret that is not a string is 400 BAD_ACCOUNT and is not echoed`,
      [bad.status, JSON.parse(bad.text).code, bad.text.includes(TOKEN), bad.plane.length], [400, "BAD_ACCOUNT", false, 0]);
  }
  for (const [path, body] of Object.entries(BODIES)) {
    const k = await drive(path, body(KEY));
    t(`R82 (/${path}, control): an apikey account is unchanged: served on the API under its key, no runner touched`,
      [k.status, k.api.length > 0, k.runner.calls.length, k.text.includes(KEY_SECRET)], [200, true, 0, false]);
  }
}

section("R56 (T47) · the suggestions switch is read from the wire's account");
{
  const loaded = (r) => r.api.some((b) => b.includes("SUGGESTIONS-LAYER-WORDS"));
  const keyOn = await drive("draft", BODIES.draft({ ...KEY, suggestions: true }));
  const keyOff = await drive("draft", BODIES.draft({ ...KEY, suggestions: false }));
  const keyAbsent = await drive("draft", BODIES.draft(KEY));
  t("R56: a draft whose account's own switch is on loads the suggestions layer", [keyOn.status, loaded(keyOn)], [200, true]);
  t("R56 (control): off, or absent, it is not loaded", [keyOff.status, loaded(keyOff), keyAbsent.status, loaded(keyAbsent)], [200, false, 200, false]);
}

console.log(`\nt47: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
