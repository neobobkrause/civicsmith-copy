/* agent-model (T53, R6, R12, R18, R19, R21) — ONE CONVERSATION, BUILT ONLY ON `turn`.
 *
 * `converseTurns(args, {turn, capabilities})` runs a conversation in neutral messages: every request goes through the
 * `turn` it is handed (the module's own by default, an injected one in a test, which shows it touches no adapter). The
 * harness's table decides every tool call through `onTool`; the model is a callee. Record text (a tool's answer)
 * reaches the model only as a `tool_result` message (R12): nothing of it is moved into `system` or another message.
 * The caller's `messages` array is the transcript: each turn's assistant message and tool results are appended to it. */

import { localize } from "../../../bio-plane/src/setup-words/index.mjs";
import { finalRefusal, factsOf, toolInput, READ_FACTS } from "../outcome.mjs";
import { sumUsage } from "./neutral.mjs";
import { MAX_TURNS_DEFAULT, MAX_OUTPUT_DEFAULT, TURN_TIMEOUT_MS } from "./params.mjs";

/** R19: the effort class of a sub-session, and of every other conversation. */
export const SUBSESSION_ROLE = "subsession";
export const EFFORT_CLASS_SUBSESSION = "low";
export const EFFORT_CLASS_DEFAULT = "medium";

const utf8 = new TextEncoder();
const textOf = (v) => (typeof v === "string" ? v : JSON.stringify(v ?? null));

/** R12: a tool's answer as a neutral tool result's content: `search_result` blocks where the caller marks them, the
 *  caller's own blocks (text, image), else one text block. */
export function resultBlocks(answer) {
  if (answer && Array.isArray(answer.search_results) && answer.search_results.length)
    return answer.search_results.map((r) => ({ type: "search_result", source: String(r?.source ?? ""), title: String(r?.title ?? ""),
      content: (Array.isArray(r?.content) ? r.content : [r?.content]).map((c) => ({ type: "text", text: textOf(c) })) }));
  if (answer && Array.isArray(answer.blocks)) return answer.blocks;
  return [{ type: "text", text: JSON.stringify(answer?.content ?? null) }];
}

/* The neutral `read_facts` answer: the transcript's opening facts (R12), as blocks. */
function factsAgain(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    const use = m.tool_calls.find((t) => t.name === READ_FACTS.name);
    if (!use) continue;
    const r = messages.slice(i + 1).find((x) => x?.role === "tool_result" && x.tool_call_id === use.id);
    if (r) return { blocks: Array.isArray(r.content) ? r.content : [{ type: "text", text: textOf(r.content) }] };
  }
  const legacy = factsOf([]);
  return { blocks: [{ type: "text", text: textOf(legacy.content) }], error: true };
}

const neutralTool = (t) => ({ name: t.name, description: t.description, input_schema: t.input_schema ?? t.parameters });

/** R6: `converse({account, entry_id, runtime, data_handling, mode, meter, system, messages, tools, finalTool, onTool,
 *  maxTurns, role?, session_key?, idempotency_base, onProgress?, checkFinal?})`. */
export async function converseTurns(args, { turn, capabilities } = {}) {
  const { account, entry_id, runtime, data_handling, meter, system, tools = [], finalTool, onTool, checkFinal, role,
    session_key, idempotency_base, onProgress, interactive, cache_hints } = args || {};
  const maxTurns = Number.isSafeInteger(args?.maxTurns) && args.maxTurns > 0 ? args.maxTurns : MAX_TURNS_DEFAULT;
  const messages = Array.isArray(args?.messages) ? args.messages : [];

  /* R19: the class maps to the entry's own effort set; a dial-less entry carries none */
  const caps = typeof capabilities === "function" ? await capabilities(entry_id) : null;
  const cls = role === SUBSESSION_ROLE ? EFFORT_CLASS_SUBSESSION : EFFORT_CLASS_DEFAULT;
  const effort = caps && caps.effort_set && caps.effort_classes && typeof caps.effort_classes[cls] === "string"
    ? caps.effort_classes[cls] : caps && caps.effort_set ? caps.effort_default : null;
  const max_output = Math.min(caps && Number.isSafeInteger(caps.max_output) ? caps.max_output : MAX_OUTPUT_DEFAULT, MAX_OUTPUT_DEFAULT);

  const offered = [...tools.map(neutralTool)];
  let usage = null;
  let calls = 0;
  let served = null;
  let label = null;
  let handedBack = false;
  const tally = (out) => {
    if (out && out.usage) { usage = sumUsage(usage, out.usage); calls += out.usage.calls ?? 0; }
    if (out && out.served) { served = out.served; label = out.label; }
  };

  for (let n = 1; n <= maxTurns; n += 1) {
    const request = {
      account, entry_id, runtime, data_handling,
      messages: [...(system != null && system !== "" ? [{ role: "system", content: system }] : []), ...messages],
      tools: offered, tool_choice: "auto", max_output, timeout_ms: TURN_TIMEOUT_MS,
      idempotency_key: `${idempotency_base}:${n}`,
      ...(effort ? { effort } : {}), ...(session_key ? { session_key } : {}), ...(cache_hints ? { cache_hints } : {}),
      ...(interactive === true ? { interactive: true } : {}), ...(typeof onProgress === "function" ? { onProgress } : {}),
    };
    /* the meter: a request is counted before it is sent, and one that would pass a bound is not sent (bytes are the
       neutral request's serialized length, so a bound means the same for every adapter) */
    const { account: _a, onProgress: _p, ...counted } = request;
    const bytes = utf8.encode(JSON.stringify(counted)).length;
    if (meter) {
      if (meter.turns + 1 > meter.turnsBound) { meter.stopped = "turns"; return { stopped: "turns" }; }
      if (meter.bytes + bytes > meter.bytesBound) { meter.stopped = "bytes"; return { stopped: "bytes" }; }
      meter.turns += 1;
      meter.bytes += bytes;
    }
    const out = await turn(request);
    tally(out);
    if (!out || !out.result) return { ...out, usage, calls };
    const r = out.result;
    const uses = Array.isArray(r.tool_calls) ? r.tool_calls : [];
    messages.push({ role: "assistant", content: r.text ?? "", tool_calls: uses, ...(r.continuation ? { continuation: r.continuation } : {}) });
    const final = uses.find((u) => u.name === finalTool);
    const refusedFinal = final && !handedBack ? await finalRefusal(checkFinal, final.input) : null;
    if (refusedFinal) {
      handedBack = true;
      for (const u of uses) messages.push({ role: "tool_result", tool_call_id: u.id, is_error: true,
        content: [{ type: "text", text: u === final ? refusedFinal
          : localize("agent-model.model.not_performed_the_answer_was", "not performed: the answer was handed back") }] });
      continue;
    }
    if (final) {
      for (const u of uses) messages.push({ role: "tool_result", tool_call_id: u.id,
        content: [{ type: "text", text: u === final ? "received"
          : localize("agent-model.model.not_performed_the_answer_ended", "not performed: the answer ended this step") }] });
      return { answer: final.input && typeof final.input === "object" ? final.input : {}, usage, calls,
        served: out.served, label: out.label, effort, entry_id: out.entry_id ?? (typeof entry_id === "string" ? entry_id : null) };
    }
    if (!uses.length) {
      messages.push({ role: "user", content: localize("agent-model.model.answer_by_calling_the_finaltool",
        "Answer by calling the `{finalTool}` tool.", { finalTool: String(finalTool) }) });
      continue;
    }
    for (const u of uses) {
      const a = u.name === READ_FACTS.name ? factsAgain(messages) : await onTool(u.name, toolInput(u.name, u.input || {}));
      if (a && a.halt) return a.halt;
      messages.push({ role: "tool_result", tool_call_id: u.id, content: resultBlocks(a), ...(a?.error ? { is_error: true } : {}) });
    }
  }
  return { exhausted: true, usage, calls, served, label };
}
