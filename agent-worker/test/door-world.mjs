/* agent-worker — the door's world for T48's suites (R86, R87): a recording plane, a scripted model API, the bodies of
 * each path, and `drive`, at the member's interface (the default export `fetch(request, env)`). Shared by
 * `t48.test.mjs` and `trace-child.mjs`, which loads it after replacing `agent-model`'s `converse` with a recording one.
 * NOT a `.test.mjs`. */
import worker from "../src/index.mjs";
import { MEMBER } from "./account.mjs";

export const TOKEN = "sk-ant-oat01-T48-HELD-TOKEN-SENTINEL-abcdefghijklmnopqrstuvwxyz0123456789";
export const AIK = "aik-" + "8".repeat(64);
export const GRANT = "aig-t48-fixture-grant-never-echoed";
export const KEY_SECRET = "sk-ant-t48-apikey-fixture-never-echoed";
export const KEY = { kind: "apikey", level: "member", secret: KEY_SECRET, member: MEMBER };
export const SIGNIN = { kind: "signin", level: "member", member: MEMBER, secret: TOKEN, suggestions: false };
export const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
export const ABSENT = { load_when: "never, in this edition", sourcing: "absent", body: {}, absent_because: "not written yet" };
export const PACK = { id: "investigative-session", version: "pack@t48",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("SUGGESTIONS-LAYER-WORDS"),
               writing_help: LAYER("WRITING-HELP-WORDS"), reading_translation: LAYER("READING-TRANSLATION-WORDS") } };
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("PICTURE-T48".repeat(4))]).toString("base64");
export const TRACE = "trace-t48-door-0001";
export const REF = "a1b2c3d4e5f6";
export const DOOR = { "x-civicsmith-trace": TRACE, "x-civicsmith-member-ref": REF };

export function plane() {
  const calls = [];
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai", version: "t48" });
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
      case "airun": return ok({ found: true, session: { id: "RUN-48", mode: "check", status: "running", max_passes: 1,
        context: { type: "inquiry", id: "INQ-1" }, principal: { plane: `${MEMBER}/TOK`, claude: MEMBER, ref: MEMBER, skill: PACK.version }, state: null,
        budget: [{ bound: "fetches", allowed: 9 }, { bound: "subsessions", allowed: 9 }, { bound: "wallclock", allowed: 9e5 },
                 { bound: "runtime", allowed: 5000 }].map((b) => ({ ...b, consumed: 0 })) } });
      case "airunlog": return ok({ found: true, entries: [], truncated: false });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: "RUN-48", context: { type: "inquiry", id: "INQ-1" }, mode: "check", skill: PACK.version, standard_pair: null } });
      case "basisversions": return ok({ versions: [] });
      case "airuntick": return ok({ ticked: true, appended: (body?.log || []).length, refused: [] });
      case "airunclose": return ok({ terminated: true });
      default: return ok({ op, rows: [{ id: "EVT-1" }] });
    }
  } } };
}
export function answerFor(names, prompt) {
  if (names.includes("done_reading")) return ["done_reading", { question_as_read: "who held the seat" }];
  if (names.includes("answer")) return ["answer", { question_as_read: "who held the seat", clarifying: null, summary: "S",
    sentences: [{ text: "Ruth held it.", kind: "quote", support: ["EVT-1"] }], label: "machine work" }];
  if (names.includes("report")) return ["report", { state: "LOOKED_ABSENT", summary: "nothing" }];
  if (names.includes("draft")) return ["draft", { text: "drafted" }];
  if (names.includes("read_page")) return ["read_page", {}];
  const judge = [...String(prompt).matchAll(/calling (judge_\w+)/g)].pop()?.[1];
  return [judge && names.includes(judge) ? judge : names.find((n) => n.startsWith("judge_")), {}];
}
/** Drives one path. `model(body)` scripts the model API's answer to one request: `[toolName, input]`. */
export async function drive(path, body, headers = {}, model = null) {
  const p = plane();
  const api = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    api.push({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers || {})), body: String(init?.body ?? "") });
    const b = JSON.parse(init.body);
    const [name, input] = model ? model(b, api.length)
      : answerFor((b.tools || []).map((x) => x.name), JSON.stringify(b.messages));
    const out = name === "read_page" ? ["transcription", { text: "the words" }] : [name, input];
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${api.length}`, name: out[0], input: out[1] }], usage: { input_tokens: 3, output_tokens: 2 } });
  };
  const lines = [], kept = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) { kept[k] = console[k]; console[k] = (...a) => lines.push(a.map(String).join(" ")); }
  try {
    const res = await worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
      { VERSION: "t48", PLANE: p.binding });
    const text = await res.text();
    const parsed = text.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } });
    return { status: res.status, text, out: parsed[parsed.length - 1], plane: p.calls, api, lines };
  } finally {
    globalThis.fetch = saved;
    for (const k of Object.keys(kept)) console[k] = kept[k];
  }
}

export const READ = (extra = {}) => ({ op: "readtranslate", language: "es", text: "The group meets on Tuesdays.", ...extra });
export const readBody = (task = READ(), extra = {}) => ({ task, account: KEY, pack: PACK, ...extra });
export const BODIES = {
  ask: (account) => ({ question: "Who held the seat?", grant: GRANT, account }),
  run: (account) => ({ run_id: "RUN-48", store: "scratch", credential: AIK, account }),
  draft: (account) => ({ task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote.", account, pack: PACK }),
  "draft (readtranslate)": (account) => ({ task: READ(), account, pack: PACK }),
  transcribe: (account) => ({ capture_sha: "c".repeat(64), pages: [{ page: 0, media_type: "image/png", data: PNG }], account }),
};
export const pathOf = (k) => k.split(" ")[0];
