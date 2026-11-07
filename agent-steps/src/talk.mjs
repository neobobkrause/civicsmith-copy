/* agent-steps (T53) — ONE DOOR FOR EVERY CONVERSATION A SEGMENT HOLDS (R23, R26, R47, R50, R52, R53, R55, R57), and Gate 1
 * before the first turn (R51).
 *
 * A model half carries the account handle the shell resolved (`agent-worker` R33) and, beside it, the provider the shell
 * bound (`agent-model`'s `makeProvider`, wrapped by `providerFor` so the recipient of an entry is read from the same
 * catalogue). Each conversation asks `entryFor` for the entry its role's need picks (R50), stops at the step boundary
 * before a recipient the member was not told of (R53), runs on the provider's `converse` with an idempotency base the
 * step fixes (R54) and no provider-held state (R55), and answers either the conversation's outcome or an `aiStop`
 * (R52). No model string is chosen here and no account is called but the one handed in.
 *
 * A model half with no provider is a shell not yet on T53 (`agent-worker` R33, R127 not yet met): its conversations go
 * through `agent-model`'s earlier `converse` exactly as before, and none of the T53 gates applies to it. */
import { ROLE_NEEDS, needOf, partOf, disclosureGate, flowFor, PLAN_FLOW } from "../../agent-harness/src/harness.mjs";
import { converse as legacyConverse } from "../../agent-model/src/model.mjs";
import { makeProvider } from "../../agent-model/src/provider/index.mjs";

/** R23: a check's sub-sessions run as `subsession` and choose by cost `low`; no other conversation is given that role. */
export const SUBSESSION_ROLE = "subsession";
export const subsessionNeed = () => ({ capabilities: [...ROLE_NEEDS[SUBSESSION_ROLE].capabilities], cost: "low" });

/** R50: the role of a judged row's conversation, `<mode>:<row>` as `agent-harness` R20 keys it. */
export const rowRole = (mode, step) => `${mode}:${step}`;

/** The data handling a run's conversations ask for when the shell names none: no provider-held state (R55). */
export const RUN_DATA_HANDLING = Object.freeze({ zero_retention: "off", host_pin: "off", provider_state: "forbidden" });
export const RUN_RUNTIME = "shared_worker";

/** The provider a shell hands a model half: `agent-model`'s bound services, and the recipient `{provider, host}` of an
 *  entry read from the same catalogue (`agent-harness` R22: "the recipient of an entry is read from the catalogue by
 *  the caller"). `deps` is what `makeProvider` takes. */
export function providerFor(deps = {}) {
  const p = makeProvider(deps);
  return { ...p, recipient: async (entry_id) => {
    try {
      const e = await deps.catalogue?.entryOf?.(entry_id);
      return e && typeof e === "object" ? { provider: e.provider ?? null, host: e.host ?? null } : null;
    } catch { return null; }
  } };
}

/* R52: the outcome classes that end a segment at the step boundary, with the reason each is stopped for. */
const UNAVAILABLE = new Set(["rate_limit", "overload", "timeout", "circuit_open"]);
const STOP_OF_ERROR = { model_gone: "lapsed", auth: "auth" };

/** R52, R57: the `ai_stop` a conversation's outcome makes, or null when it is no stop (an answer, a content refusal, a
 *  silence, the meter's bound). `{reason, class, retry_after?}`. Pure. */
export function aiStopOf(out) {
  if (!out || typeof out !== "object") return null;
  const later = (v) => (v == null ? {} : { retry_after: v });
  if (out.error && typeof out.error === "object") {
    const cls = String(out.error.class ?? "");
    if (UNAVAILABLE.has(cls)) return { reason: "unavailable", class: cls, ...later(out.error.retry_after ?? out.error.retry_at) };
    if (STOP_OF_ERROR[cls]) return { reason: STOP_OF_ERROR[cls], class: cls };
    return null;
  }
  if (out.limit && typeof out.limit === "object")
    return { reason: "limit", class: String(out.limit.kind ?? "limit"), ...later(out.limit.resets_at) };
  if (out.refused && typeof out.refused === "object") {
    if (out.refused.type === "PAYER_NOT_VERIFIED") return { reason: "unavailable", class: "PAYER_NOT_VERIFIED" };
    if (out.refused.type === "UNSUPPORTED_CONTROL")
      return { reason: "capability", class: "unsupported_control", ...(out.refused.control ? { control: out.refused.control } : {}) };
  }
  return null;
}

/* R55: an opaque continuation lives only inside the conversation that made it; the parent's transcript, which spans
   rows, keeps none of it. */
function dropContinuations(messages) {
  for (const m of Array.isArray(messages) ? messages : []) if (m && typeof m === "object" && "continuation" in m) delete m.continuation;
}

/* The openings `agent-model` builds (`openRow`, `subsessionOpening`) are in the Messages API's shape; the provider's
   `converse` takes neutral messages (its R25). Rewritten in place, once: a neutral message is left as it is. */
export function neutralize(messages) {
  if (!Array.isArray(messages)) return messages;
  const out = [];
  for (const m of messages) {
    const blocks = m && Array.isArray(m.content) ? m.content : null;
    if (m?.role === "assistant" && blocks && !Array.isArray(m.tool_calls)) {
      const text = blocks.filter((b) => b?.type === "text").map((b) => b.text).join("");
      out.push({ role: "assistant", content: text,
        tool_calls: blocks.filter((b) => b?.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} })) });
    } else if (m?.role === "user" && blocks && blocks.length && blocks.every((b) => b?.type === "tool_result")) {
      for (const b of blocks) out.push({ role: "tool_result", tool_call_id: b.tool_use_id,
        content: Array.isArray(b.content) ? b.content : [{ type: "text", text: String(b.content ?? "") }], ...(b.is_error ? { is_error: true } : {}) });
    } else out.push(m);
  }
  messages.splice(0, messages.length, ...out);
  return messages;
}

/** One conversation. `{role, need?, mode, system, messages, tools, finalTool, onTool, checkFinal, idem}`: `idem` the
 *  step's idempotency base (R54). Answers the conversation's outcome (`answer`, `stopped`, `exhausted`, `silent`,
 *  `refused`, ...) with its usage kept on the model half (R47), or `{aiStop}` (R52, R53, R57), or `{roleUnknown}`
 *  (R50). Never throws past the provider. */
export async function talk(model, { role, need = null, mode, system, messages, tools, finalTool, onTool, checkFinal, idem }) {
  if (!model.provider) {
    const got = await legacyConverse({
      reference: model.legacy?.reference, runner: model.legacy?.runner, mode, meter: model.meter, ...model.traced,
      system, messages, tools, finalTool, checkFinal, onTool, ...(role === SUBSESSION_ROLE ? { role } : {}) });
    model.spent(got, mode);
    return got;
  }
  /* R50: the need is the table's for the role; a role the table does not hold is refused before any call. */
  const asked = need ?? needOf(role);
  if (!asked) return { roleUnknown: { code: "AI_ROLE_UNKNOWN", role: String(role) } };
  const chosen = await model.provider.entryFor(model.account, role, asked);
  /* R57: a need no entry of the account serves is never run with less: the step stops for the capability. */
  if (!chosen || typeof chosen.entry_id !== "string")
    return { aiStop: { reason: "capability", class: chosen?.refused?.type === "UNSUPPORTED_CONTROL" ? "unsupported_control" : "no_entry_offered",
                       ...(chosen?.refused?.control ? { control: chosen.refused.control } : {}) } };
  /* R53: a recipient the member was not told of stops the segment before any call, interactive or not. */
  const recipient = typeof model.provider.recipient === "function" ? await model.provider.recipient(chosen.entry_id) : null;
  const told = disclosureGate(model.account, recipient);
  if (!told.ok) return { aiStop: { reason: "disclosure", class: "disclosure", recipient: told.recipient } };
  neutralize(messages);
  const got = await model.provider.converse({
    account: model.account, entry_id: chosen.entry_id, runtime: model.runtime, data_handling: model.data_handling,
    mode, meter: model.meter, system, messages, tools, finalTool, onTool, checkFinal,
    ...(role === SUBSESSION_ROLE ? { role } : {}), idempotency_base: idem });
  dropContinuations(messages);
  model.spent(got, mode);
  const stop = aiStopOf(got);
  if (stop) return { ...got, aiStop: stop };
  /* An error of a class that is no stop (`request_rejected`) is the provider refusing the request: it is named as the
     model's refusal, never read as a turn that judged nothing. */
  if (got && got.error && typeof got.error === "object" && !got.refused)
    return { ...got, refused: { status: got.error.status ?? null, type: String(got.error.class ?? "error"), message: got.error.message ?? null } };
  return got;
}

/** R51 — GATE 1 PER PART, BEFORE ANY TURN. The roles the mode's rows converse in (each judged row but `collect`, and the
 *  sub-sessions of a table that fans out), each checked against the account's entries: none whose verdict for the
 *  role's part passed is `PART_NOT_PASSED` naming `part` and `entries`; a capability the role needs missing on every
 *  entry that passed is `AI_CAPABILITY_MISSING` naming it. The verdicts are the account's (`account.verdicts`,
 *  `{[entry_id]: {[part]: verdict | {verdict, limits}}}`). Answers `{ok: true, limits}` (each entry passing with
 *  limits, named) or `{refused: {code, part, entries, ...}}`. */
export const PASSED = new Set(["passes", "passes_with_limits"]);
export function rolesOf(mode) {
  const flow = flowFor(mode);
  const rows = Object.keys(flow).filter((r) => flow[r].judged && r !== "collect").map((r) => rowRole(mode, r));
  return flow === PLAN_FLOW ? rows : [...rows, SUBSESSION_ROLE];
}
const verdictOf = (account, entry_id, part) => {
  const v = account?.verdicts?.[entry_id]?.[part];
  return v && typeof v === "object" ? { verdict: v.verdict ?? null, limits: v.limits ?? null } : { verdict: v ?? null, limits: null };
};
export async function gateOne(model, mode) {
  const entries = Array.isArray(model.account?.entries) ? model.account.entries.filter((x) => typeof x === "string") : [];
  const limits = [];
  for (const role of rolesOf(mode)) {
    const part = partOf(role) ?? partOf(mode);
    const need = role === SUBSESSION_ROLE ? subsessionNeed() : needOf(role);
    if (!need) continue;
    const passed = entries.filter((id) => PASSED.has(verdictOf(model.account, id, part).verdict));
    if (!passed.length)
      return { refused: { code: "PART_NOT_PASSED", part, role, entries: entries.map((id) => ({ entry_id: id, verdict: verdictOf(model.account, id, part).verdict })) } };
    let lacking = null, serving = 0;
    for (const id of passed) {
      const s = typeof model.provider.serves === "function" ? await model.provider.serves(id, need) : { ok: true };
      if (s && s.ok) serving += 1; else if (!lacking) lacking = (s?.lacks && s.lacks[0]) ?? s?.refused?.control ?? null;
    }
    if (!serving) return { refused: { code: "AI_CAPABILITY_MISSING", part, role, capability: lacking, entries: passed } };
    for (const id of passed) {
      const v = verdictOf(model.account, id, part);
      if (v.verdict === "passes_with_limits" && !limits.some((l) => l.entry_id === id && l.part === part))
        limits.push({ entry_id: id, part, verdict: v.verdict, limits: v.limits });
    }
  }
  return { ok: true, limits };
}
