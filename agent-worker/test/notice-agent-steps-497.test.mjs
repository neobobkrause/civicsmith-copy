/* agent-worker over agent-steps PR 497 (its source only, no requirement text): `driveHarness` no longer publishes a
 * table state that holds a provider's session, response, conversation or continuation id (agent-harness R23's
 * `STATE_HOLDS_PROVIDER_STATE`); it publishes no state on that tick and names the refusal in its `refusals`, at
 * `airuntick.state`, with its `code`. This member passes `drive.refusals` through as R28's `refusals` and names each
 * `code` once in R91's `segment_end.refusals` (`refusalCodes` reads `code`), so the new entry needs no change here:
 * confirmed, no code change. Driven at the member's interface, `POST /run` over this suite's own fake plane and a model
 * whose every answer carries provider-held ids (`session_id`, `conversation_id`, `previous_response_id`): every state
 * the segment publishes is free of keys shaped as provider-held state, and nothing in R28's answer or the
 * `segment_end` tick reports the state as refused. Control: the segment still ends by the table, its state published.
 *
 * A confirmation: agent-steps' change keeps such ids out of the state before they reach this member, so this test
 * passes with PR 497 reverted too (named for the reviewer by `--exempt-revert`). */
import "../../bio-plane/test/sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { ACCOUNT, MEMBER } from "./account.mjs";
import { PROVIDER_STATE_KEY } from "../../agent-harness/src/harness.mjs";

const AIK = "aik-" + "d".repeat(64);
const RUN = "RUN-notice-497";
const PACK_VERSION = "investigative-session@n497+0000000000000000";
const PACK = { id: "investigative-session", edition: "n497", version: PACK_VERSION,
               resident: { objective: { text: "find what the record holds" }, disclosable: [] }, disclosed: {} };
const WIDE = [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
              { bound: "wallclock", allowed: 500000 }, { bound: "runtime", allowed: 5000 }];
const HELD = { session_id: "sess-PROVIDER-HELD", conversation_id: "conv-PROVIDER-HELD",
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

async function segment() {
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

const ticks = (rec) => rec.calls.filter((c) => c.op === "airuntick" && c.body);
const heldKeys = (s) => (s && typeof s === "object" ? Object.keys(s).filter((k) => PROVIDER_STATE_KEY.test(k)) : []);

test("notice agent-steps:497 (R28, R91): over a provider answering session, conversation and response ids, no published state holds one and none is reported refused", async () => {
  const { status, out, rec } = await segment();
  assert.equal(status, 200, JSON.stringify(out).slice(0, 400));
  assert.equal(out.judgement_source, "model");
  const states = ticks(rec).filter((c) => c.body.state).map((c) => c.body.state);
  assert.ok(states.length > 0, "the segment published states at its resumable ticks");
  assert.deepEqual(states.flatMap(heldKeys), [], "no published state holds a key shaped as provider-held state");
  assert.deepEqual((out.refusals || []).filter((r) => r?.at === "airuntick.state"), [], "R28: no state refused");
  const end = ticks(rec).find((c) => c.body.segment_end)?.body.segment_end;
  assert.ok(end, "R91: the segment_end tick was sent");
  assert.ok(!end.refusals.includes("STATE_HOLDS_PROVIDER_STATE"), "R91: segment_end names no state refusal");
  assert.ok(!JSON.stringify(rec.calls).includes("PROVIDER-HELD"), "no provider id reached the plane");
});

test("notice agent-steps:497 (control, R28): the segment ends by the table, every refusal code it reports named once in segment_end", async () => {
  const { out, rec } = await segment();
  assert.equal(out.ended?.by ?? null, "the table");
  const end = ticks(rec).find((c) => c.body.segment_end)?.body.segment_end;
  assert.deepEqual(end.refusals, [...new Set((out.refusals || []).map((r) => r.code ?? r.reason).filter(Boolean))]);
});
