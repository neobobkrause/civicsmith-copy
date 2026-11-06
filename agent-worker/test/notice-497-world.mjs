/* The world of notice agent-steps:497's test (agent-worker's own fake plane and model; NOT a `.test.mjs`): `segment()`
 * drives one `POST /run` of a check run over the API-key path and answers its status, its body and the plane's calls. */
import "../../bio-plane/test/sandbox.mjs";
import worker from "../src/index.mjs";
import { ACCOUNT, MEMBER } from "./account.mjs";

const AIK = "aik-" + "d".repeat(64);
const RUN = "RUN-notice-497";
const PACK_VERSION = "investigative-session@n497+0000000000000000";
const PACK = { id: "investigative-session", edition: "n497", version: PACK_VERSION,
               resident: { objective: { text: "find what the record holds" }, disclosable: [] }, disclosed: {} };
const WIDE = [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
              { bound: "wallclock", allowed: 500000 }, { bound: "runtime", allowed: 5000 }];
export const HELD = { session_id: "sess-PROVIDER-HELD", conversation_id: "conv-PROVIDER-HELD",
               previous_response_id: "resp-PROVIDER-HELD" };

/** This suite's fake plane: it answers the run's ops as the plane's wire does and records every call. */
function plane(rec) {
  const ok = (result) => Response.json({ ok: true, result, store: "scratch", tokenClass: "ai", version: "n497" });
  return { fetch: async (url, init) => {
    const u = new URL(url);
    const op = u.searchParams.get("op") || "";
    const body = init && typeof init.body === "string" ? JSON.parse(init.body) : null;
    rec.calls.push({ op, body });
    switch (op) {
      case "whoami": return ok({ tokenClass: "ai", session: false, member: null });
      case "airun": return ok({ run: RUN, found: true, session: {
        id: RUN, mode: "check", status: "running", context: { type: "inquiry", id: "INQ-497" }, max_passes: 1,
        principal: { plane: MEMBER, claude: MEMBER, ref: MEMBER, skill: PACK_VERSION },
        state: null, budget: WIDE.map((b) => ({ ...b, consumed: 0, unit: null })) } });
      case "airunlog": return ok({ run: RUN, found: true, entries: [], limit: 200, truncated: false });
      case "agentpack": return Response.json({ ok: true, fences: [], pack: PACK, store: "scratch", tokenClass: "ai" });
      case "airunspawn": return ok({ found: true, half: "search", payload: { run: RUN,
        context: { type: "inquiry", id: "INQ-497" }, mode: "check", skill: PACK_VERSION, standard_pair: null } });
      case "meaningrows": return ok({ ok: true, arm: "leg", rows: [], scope: { documents: 3, documents_with_rows: 0, documents_without_rows: 3 }, count: 0 });
      case "basisversions": return ok({ id: u.searchParams.get("id"), versions: [], limit: 50, truncated: false });
      case "search": return ok({ hits: [] });
      case "versionchain": return ok({ address_norm: null, total: 0, truncated: false, versions: [] });
      case "suggest": return ok({ wrote: true });
      case "airuntick": return ok({ run: RUN, found: true, ticked: true, status: "running",
                                    appended: Array.isArray(body?.log) ? body.log.length : 0, refused: [] });
      case "airunclose": return ok({ terminated: true, bound: body?.bound ?? null });
      default: return Response.json({ ok: false, error: "unknown op: " + op }, { status: 400 });
    }
  } };
}

/** The model: each sub-session reports an indeterminate look; each judgement row answers its own tool. */
function answer(sent) {
  const names = (sent.tools || []).map((x) => x.name);
  if (names.includes("report"))
    return [{ type: "tool_use", id: "r", name: "report", input: { state: "LOOKED_INDETERMINATE", summary: "nothing here" } }];
  const prompt = [...sent.messages].reverse().map((m) => (m.role !== "user" ? "" : typeof m.content === "string"
    ? m.content : (Array.isArray(m.content) ? m.content.filter((c) => c.type === "text").map((c) => c.text).join("") : "")))
    .find((c) => /judge_/.test(c)) || "";
  const step = (/Answer by calling judge_([a-z]+)/.exec(prompt) || [])[1] || "";
  const input = step === "plan" ? { level: "document", observed: "LOOKED_INDETERMINATE" } : {};
  return [{ type: "tool_use", id: "j", name: `judge_${step}`, input }];
}

export async function segment() {
  const rec = { calls: [] };
  const saved = globalThis.fetch;
  globalThis.fetch = async (_url, init) => Response.json({ id: "msg", type: "message", role: "assistant", ...HELD,
    content: answer(JSON.parse(init.body)), stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
  try {
    const res = await worker.fetch(new Request("http://agent-worker/run", { method: "POST", body: JSON.stringify({
      run_id: RUN, store: "scratch", credential: AIK, account: ACCOUNT }) }), { VERSION: "n497", PLANE: plane(rec) });
    return { status: res.status, out: await res.json(), rec };
  } finally { globalThis.fetch = saved; }
}

