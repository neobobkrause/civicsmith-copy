/* The ask driven at this member's interface, for the provider notices on its usage report (agent-steps:185, ai-use:105):
 * the default export `fetch(request, env)`, a recording `PLANE` binding answering the ask's ops, and the global `fetch`
 * replaced by a scripted model API (agent-model's API-key path) that states `usage` on every call. Answers the plane
 * calls the ask made, so a test reads the `askusage` bodies it sent. NOT a `.test.mjs`: an instrument the notice
 * suites share. */
import worker from "../src/index.mjs";
import { MEMBER } from "./account.mjs";

const GRANT = "aig-notice-usage-grant-never-echoed";
const KEY = "sk-ant-notice-usage-key-never-echoed";
export const APIKEY = Object.freeze({ kind: "apikey", level: "member", secret: KEY, member: MEMBER, suggestions: false });
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@notice-usage",
  resident: { objective: { text: "answer from the record" }, disclosable: [] }, disclosed: { ask: LAYER("closed book") } };
export const MODEL_USAGE = Object.freeze({ input_tokens: 3, output_tokens: 2 });

function plane() {
  const calls = [];
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai", version: "notice" });
  return { calls, binding: { async fetch(url, init) {
    const op = new URL(url).searchParams.get("op") || "";
    let body = null; try { body = typeof init?.body === "string" ? JSON.parse(init.body) : null; } catch { body = null; }
    calls.push({ op, body });
    switch (op) {
      case "agentpack": return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
      case "askceiling": return ok({ ok: true, reached: false });
      case "askcheck": return ok({ ok: true, answer: body?.answer ?? {}, withheld: [] });
      case "askusage": return ok({ ok: true });
      default: return ok({ op, rows: [] });
    }
  } } };
}

function answerFor(names) {
  if (names.includes("done_reading")) return ["done_reading", { question_as_read: "who held the seat" }];
  if (names.includes("answer"))
    return ["answer", { question_as_read: "who held the seat", clarifying: null, summary: null, sentences: [], holdings: [],
      rules: [], looks: [], bound: null, truncated: false, out_of_view: false, lens: null, not_established: [], query: null,
      next_acts: [], label: "machine work" }];
  return [names[0], {}];
}

/** One ask over the API-key path: `{status, lines, plane, modelCalls, usageBodies}`. */
export async function askOnce() {
  const p = plane();
  let modelCalls = 0;
  const saved = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    modelCalls++;
    const body = JSON.parse(init.body);
    const [name, input] = answerFor((body.tools || []).map((x) => x.name));
    return Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `u${modelCalls}`, name, input }], usage: { ...MODEL_USAGE } });
  };
  try {
    const res = await worker.fetch(new Request("http://agent-worker/ask", { method: "POST",
      body: JSON.stringify({ question: "Who held the seat?", grant: GRANT, account: APIKEY }) }),
      { VERSION: "notice", PLANE: p.binding });
    const text = await res.text();
    const lines = text.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } });
    return { status: res.status, lines, plane: p.calls, modelCalls,
             usageBodies: p.calls.filter((c) => c.op === "askusage").map((c) => c.body) };
  } finally { globalThis.fetch = saved; }
}
