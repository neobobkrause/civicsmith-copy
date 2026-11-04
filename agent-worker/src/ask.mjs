/* R54–R56 — `POST /ask`: ONE MEMBER'S QUESTION, ANSWERED UNDER THAT MEMBER'S GRANT AND THE ACCOUNT THAT SERVES THEIR
 * ASK, AND CHECKED BY THE
 * PLANE BEFORE ANY WORD OF IT IS RETURNED (Q1-4; ladders §9.4 L1; K1450, K1474, K1479, K1502, K1601).
 *
 * WHAT IT IS. A member asks; the plane mints the member a short-lived, read-only `ai` grant (credentials R27) and hands
 * this member the question, the grant and the Claude account that serves that member's ask (R6's shape, as
 * `credentials.accountFor` answers it: the member's own reference, else the group's API key while held and on, K1755),
 * with the earlier turns of this one ask, which the member's device holds (nothing is kept here or in the plane,
 * K1450). An ask the group's key serves is still the member's own ask. This member then:
 *
 *   1. asks the plane whether the member is over their use ceiling (`op=askceiling`, ai-runs R50), before any model
 *      call, relaying a refusal unchanged (R43);
 *   2. reads the pack the ask is instructed by (`op=agentpack`, R48), whose `ask` layer carries the closed-book rule;
 *   3. INTERPRETS and READS: one conversation in which the model reads the question (asking at most one clarifying
 *      question, answers R3) and writes its queries, reading the record only through the grant and only the ops of
 *      `ASK_OPS` (R55) — a tool call naming any other op is refused here, before any plane call, and the refusal is
 *      the tool's result;
 *   4. COMPOSES: the same transcript, with reading closed, answered in `answers`' contract (its R3);
 *   5. CHECKS: hands the answer to the plane's `answers` checks (`op=askcheck`, `checkAnswer` over the read log the
 *      plane holds for the grant, its R4) and returns ONLY what they pass, with what they withheld named.
 *
 * It writes no run row and no observation; it reports each conversation's `usage` to the plane (`op=askusage`, ai-runs
 * R48's `countAskUsage`), with `calls`, the model calls that usage covers, exactly as `agent-model` R6 answers them
 * (N588; a `calls` it did not state is passed as `null`). Progress is streamed as each step begins, and no
 * progress event carries text the checks have not passed: a step's name, and a read's op, nothing more.
 *
 * THE STREAM (K1601 (5); R113, T50; N1195, K3602, DEC-298): NDJSON (`application/x-ndjson`), one object per line, each
 * written the moment its step begins and held for nothing: `{event: "step", step: "interpreting"}` before the first model
 * turn; `{event: "read", op, record}` before each read, `record` the id of the record that read names (null when it
 * names none), so a screen draws "Reading {document}" from a field; `{event: "composing", found, count}` when reading
 * closes, `count` the passages the reads found and `found` whether there is at least one; `{event: "checking", count}`
 * before the plane's check is asked, `count` the passages the composed answer cites; one `{event: "checked", passage,
 * found}` for each cited passage as the check answers, `found` whether the check passed it; and last exactly one of
 * `{event: "answer", ok: true, answer, withheld, untested?}` (R79: the test-instance label the door sent, unchanged),
 * `{event: "refused", code: "ASK_CHECK_FAILED", cited, found: 0}` (the answer cites holdings and the check withheld
 * every one: no `answer` follows, so no word the check did not pass reaches the member) or `{event: "refused",
 * …refusal}`. No event before the last carries text the model wrote. A refusal made before any model call (R1, R2,
 * `NO_GRANT`, `NO_ACCOUNT`, `ASSISTANT_REMOTE_NOT_READY`, the ceiling) is answered as plain JSON with its status, not
 * as a stream.
 *
 * THE BOUNDS are `run-rules`' `ASK_BOUNDS` (its R17), their provisional defaults (M-Q7 measures them): `turns` model
 * turns, `bytes` of the record's answers read into the model, `wall_ms` from start to answer, `reads` of the record. */
import { ASK_BOUNDS, askBoundReached } from "../../bio-plane/src/run-rules/index.mjs";
import { ANSWER_FIELDS, ANSWER_LABEL } from "../../bio-plane/src/answers/check.mjs";
import { ASK_OPS } from "./ops.mjs";
import { toolContent } from "../../agent-steps/src/index.mjs";
import { untestedOf, UNTESTED_BAD } from "./untested.mjs";
import { doorTrace } from "./signin.mjs";
import { remoteOf } from "./remote.mjs";
import { word, localize } from "../../bio-plane/src/setup-words/index.mjs";

/** The ask's bounds: `ASK_BOUNDS`' defaults, the figure an ask declares when it starts (run-rules R17). */
export const ASK_DECLARED = Object.freeze(Object.fromEntries(Object.entries(ASK_BOUNDS).map(([k, v]) => [k, v.default])));
export const QUESTION_MAX = 4000;
export const CONVERSATION_MAX = 40;
const ARG_MAX = 500;

/** R55, R59 — the one read tool an ask or a draft is offered: an op of `ASK_OPS` (`answers`' `ASK_SCOPE`), its arguments
 *  as plain values, read under the member's grant. */
export function readTool() {
  return {
    name: "read",
    description: localize("agent-worker.ask.read_the_record_through_the", "read the record through the plane, under the member's grant: one op of the ask's list, with its arguments as plain values. Nothing is answered from your own knowledge: what is not read is not held."),
    input_schema: { type: "object", properties: {
      op: { type: "string", enum: [...ASK_OPS] },
      args: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } } },
      required: ["op"], additionalProperties: false },
  };
}

/** The ask's model tools: `read` (only `ASK_OPS`) and `done_reading` for the first conversation; `answer` (answers
 *  R3's shape) for the second; `load_layer` in both, gated by the switch that governs the ask (R56). */
export function askTools(layers, contract = { fields: ANSWER_FIELDS, label: ANSWER_LABEL }) {
  const load = {
    name: "load_layer", description: localize("agent-worker.ask.load_one_of_the_skill", "load one of the skill pack's disclosed layers when the work needs it"),
    input_schema: { type: "object", properties: { name: { type: "string", enum: layers } }, required: ["name"],
                    additionalProperties: false },
  };
  const read = readTool();
  const done = {
    name: "done_reading",
    description: localize("agent-worker.ask.end_reading_the_question_as", "end reading: the question as you read it, and at most one clarifying question when it cannot be answered without one"),
    input_schema: { type: "object", properties: {
      question_as_read: { type: "string" }, clarifying: { type: ["string", "null"] } },
      required: ["question_as_read"], additionalProperties: false },
  };
  /* R89: the tool asks for the whole contract. Its fields and the label are `answers`' own, read from its export and
     never listed here; the type hints below only describe a field, they add and drop none. */
  const hint = { question_as_read: { type: "string" }, clarifying: { type: ["string", "null"] },
    sentences: { type: "array" }, holdings: { type: "array" }, rules: { type: "array" }, looks: { type: "array" },
    label: { type: "string", enum: [contract.label] } };
  const answer = {
    name: "answer",
    description: localize("agent-worker.ask.the_answer_in_the_answers", "the answer, in the answers contract: every sentence rests on what was read, quotes are exact, an absence names its level, and every rule is the plane's"),
    input_schema: { type: "object",
      properties: Object.fromEntries(contract.fields.map((k) => [k, hint[k] ?? {}])),
      required: [...contract.fields], additionalProperties: false },
  };
  return { reading: [load, read, done], composing: [load, answer] };
}

/** R55 — the one door a read comes through: an op in `ASK_OPS` with scalar arguments, or the refusal the model is
 *  handed as the tool's result. No plane call is made for a refused one. */
export function admitRead(input) {
  const op = String(input?.op ?? "");
  if (!ASK_OPS.includes(op))
    return { refused: { code: "ASK_OP_REFUSED", op: op.slice(0, 60),
      detail: localize("agent-worker.ask.op_is_not_a_read", "'{op}' is not a read an ask may make; an ask reads only {ASK_OPS}", { op: String(op.slice(0, 60)), ASK_OPS: String(ASK_OPS.join(", ")) }) } };
  const args = input?.args == null ? {} : input.args;
  if (typeof args !== "object" || Array.isArray(args))
    return { refused: { code: "ASK_ARGS_REFUSED", op, detail: localize("agent-worker.ask.a_reads_arguments_are_a", "a read's arguments are a map of plain values") } };
  const query = {};
  for (const [k, v] of Object.entries(args)) {
    if (["op", "token", "store"].includes(k) || !/^[a-z_][a-z0-9_]{0,40}$/i.test(k)
        || !["string", "number", "boolean"].includes(typeof v) || String(v).length > ARG_MAX)
      return { refused: { code: "ASK_ARGS_REFUSED", op,
        detail: localize("agent-worker.ask.the_argument_k_is_not", "the argument '{k}' is not one a read may carry: a name, and a plain value of at most {ARG_MAX} characters", { k: String(k.slice(0, 40)), ARG_MAX: String(ARG_MAX) }) } };
    query[k] = v;
  }
  return { op, query };
}

/* The earlier turns of this one ask, as the member's device holds them: `[{role: "user"|"assistant", content}]`. */
function conversationOf(c) {
  if (c == null) return { turns: [] };
  if (!Array.isArray(c) || c.length > CONVERSATION_MAX
      || !c.every((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string"
                         && t.content.length <= QUESTION_MAX * 4))
    return { bad: true };
  return { turns: c.map((t) => ({ role: t.role, content: t.content })) };
}

/** R113 — the record a read names, as an id the event may carry: the value of the read's `id`, `record`, `bundle_id`
 *  or `address` argument, else the id in a `q` of the form `id:<record>`; null when it names none or the value is not
 *  shaped like an id (a name of at most 200 characters, never a sentence the model wrote). */
const RECORD_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/#¶-]{0,199}$/;
export function recordOf(query) {
  const q = query && typeof query === "object" ? query : {};
  const named = ["id", "record", "bundle_id", "address"].map((k) => q[k]).find((v) => typeof v === "string" && v.trim());
  const viaQ = typeof q.q === "string" ? /(?:^|\s)id:"?([^"\s]+)"?/.exec(q.q)?.[1] : undefined;
  const id = (named ?? viaQ ?? "").trim();
  return RECORD_SHAPE.test(id) ? id : null;
}

/** R113 — the passages a read's answer found: the elements of its result lists (`hits`, `rows`, `passages`), each
 *  counted once by its own identity within the ask. `seen` is the ask's set. */
const PASSAGE_LISTS = ["hits", "rows", "passages"];
export function newPassages(answer, seen) {
  const a = answer && typeof answer === "object" ? answer : {};
  let added = 0;
  for (const k of PASSAGE_LISTS)
    for (const e of Array.isArray(a[k]) ? a[k] : []) {
      const id = JSON.stringify(e ?? null);
      if (!seen.has(id)) { seen.add(id); added += 1; }
    }
  return added;
}

/** R113 — a cited passage as a `checked` event names it: the holding's address when it is shaped like one, else its
 *  place in the answer's list (`h1` the first), the plane's own name for it. */
const passageOf = (holding, i) => (typeof holding?.address === "string" && RECORD_SHAPE.test(holding.address.trim())
  ? holding.address.trim() : `h${i + 1}`);

/** `POST /ask`. `deps` are the shell's own pieces (index.mjs), so the plane is reached by one route and every refusal
 *  is made by one helper. */
export async function handleAsk(req, env, deps) {
  const { refusal, json, askPlane, planeAnswer, publishedPack, accountOf, cascadeToken, modelHalf, loadableLayers,
          loadLayer, converse, segmentMeter, NAMESPACES, DEFAULT_MAX_SEGMENT_BYTES, assistantReady,
          now = () => Date.now() } = deps;
  if (typeof env.PLANE?.fetch !== "function")
    return refusal("PLANE_NOT_CONFIGURED",
      localize("agent-worker.ask.this_member_reaches_the_record", "this member reaches the record only through the plane service binding, and the binding is absent, so no question can be answered and none was sent anywhere."), 503);
  const body = await req.json().catch(() => null);
  if (body == null || typeof body !== "object" || Array.isArray(body))
    return refusal("BAD_BODY", localize("agent-worker.ask.the_request_body_could_not", "the request body could not be read as a JSON object."), 400);
  /* R79 (T46): the test-instance label, when the door sends one, rides on the last answer event unchanged. */
  const untested = untestedOf(body);
  if (untested.bad) return refusal("BAD_BODY", UNTESTED_BAD, 400);

  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > QUESTION_MAX)
    return refusal("BAD_QUESTION", localize("agent-worker.ask.an_ask_carries_one_question", "an ask carries one question in words, of at most {QUESTION_MAX} characters.", { QUESTION_MAX: String(QUESTION_MAX) }), 400);
  /* K1601 (5): an ask names its namespace or not; one it names is held to R4, one it does not is the plane's default. */
  let store = null;
  if (body.store !== undefined) {
    if (typeof body.store !== "string")
      return refusal("BAD_STORE", localize("agent-worker.ask.store_when_an_ask_names", "store, when an ask names one, is the namespace's name."), 400);
    if (!NAMESPACES.includes(body.store))
      return refusal("NAMESPACE_UNKNOWN", word("refusal.NAMESPACE_UNKNOWN"), 400,
        { asked: body.store.slice(0, 80), namespaces: [...NAMESPACES] });
    store = body.store;
  }
  const grant = typeof body.grant === "string" ? body.grant : "";
  if (!grant)
    return refusal("NO_GRANT",
      localize("agent-worker.ask.an_ask_is_read_only", "an ask is read only under the asking member's own short-lived, read-only grant, and none arrived. This member holds no credential of its own, so nothing was read and no model was called."), 401);
  const acct = await accountOf(body);
  if (acct.refusal) return acct.refusal;
  const { account } = acct;
  const conv = conversationOf(body.conversation);
  if (conv.bad)
    return refusal("BAD_CONVERSATION",
      localize("agent-worker.ask.conversation_when_present_is_this", "conversation, when present, is this ask's earlier turns: at most {CONVERSATION_MAX}, each {shape}.", { CONVERSATION_MAX: String(CONVERSATION_MAX), shape: "{role: user or assistant, content: words}" }), 400);
  /* R110: past the shape checks and before any plane call or model turn (the ceiling is asked after). */
  const blocked = await assistantReady(env, account);
  if (blocked) return blocked;

  /* Every call this ask makes reaches the plane under the GRANT and nothing else. */
  const call = (op, query, post) => askPlane(env, op, grant, store, query, post);
  const relayed = (asked, at) => json({ ok: false, reason: "PLANE_REFUSED", code: "PLANE_REFUSED",
    worker: "agent-worker", at,
    detail: localize("agent-worker.ask.the_record_refused_this_ask", "the record refused this ask under the member's grant. Its refusal is passed through exactly as it was worded."), plane_status: asked.status ?? null, plane: asked.body ?? null }, 403);
  const silentNow = (asked) => refusal("PLANE_SILENT",
    localize("agent-worker.ask.the_record_could_not_be_reached_so", "the record could not be reached, so nothing was read and no model was called. A failure to answer is not an answer."), 502, { detail_from_binding: asked.detail ?? null });

  /* (1) THE CEILING, BEFORE ANY MODEL CALL (ai-runs R50), its refusal relayed unchanged (R43). */
  const ceiling = await call("askceiling");
  if (!ceiling.reached) return silentNow(ceiling);
  if (planeAnswer(ceiling, "askceiling").refused) return relayed(ceiling, "askceiling");

  /* (2) THE PACK (R48): its `ask` layer instructs the ask. A pack the plane did not publish whole is not used. */
  const pub = await call("agentpack");
  if (!pub.reached) return silentNow(pub);
  const pubAnswer = planeAnswer(pub, "agentpack");
  if (pubAnswer.refused) return relayed(pub, "agentpack");
  const pack = publishedPack(pubAnswer.result);
  if (!pack.ok)
    return refusal("PACK_UNDETERMINED",
      localize("agent-worker.ask.no_skill_pack_this_ask", "no skill pack this ask can be instructed by was published, so no model was called: an ask answered without the pack's closed-book rule would answer from the model's own knowledge ({why}).", { why: String(pack.why) }), 502);

  const reference = (await cascadeToken(account)).reference;
  /* R87: the door's trace and member reference, when sent, reach both conversations (`agent-model` R16). */
  const traced = doorTrace(req);
  const meter = segmentMeter({ turnsBound: ASK_DECLARED.turns, bytesBound: DEFAULT_MAX_SEGMENT_BYTES });
  const model = modelHalf({ reference, runner: remoteOf(env), meter, suggestions: account.suggestions });
  model.pack = pack.pack;
  model.layers = loadableLayers(pack.pack, model.suggestions);
  const tools = askTools(model.layers);
  const started = now();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();
  const emit = (o) => writer.write(enc.encode(`${JSON.stringify(o)}\n`));

  (async () => {
    const used = { turns: 0, bytes: 0, wall_ms: 0, reads: 0 };
    const found = { count: 0, seen: new Set() };
    const reached = () => { used.turns = meter.turns; used.wall_ms = Math.max(0, now() - started);
                            return askBoundReached(ASK_DECLARED, used); };
    const report = async (got) => {
      if (!got || !got.usage) return;
      const entries = model.drain();
      for (const e of entries)
        await call("askusage", null, { mode: "ask", entry_id: e.entry_id, label: e.label, usage: e.usage, calls: e.calls });
    };
    const spend = (got) => model.spent(got, "ask");
    const finish = async (o) => { await emit(o); await writer.close(); };
    const refusedEvent = (code, detail, extra) => ({ event: "refused", ok: false, reason: code, code, detail,
                                                     worker: "agent-worker", ...(extra || {}) });
    const modelEnded = (got) => {
      if (got.stopped || got.exhausted)
        return refusedEvent("ASK_BOUND_REACHED",
          localize("agent-worker.ask.the_ask_reached_its_v1", "the ask reached its {v1} bound before it was answered, so nothing is returned.", { v1: String(got.stopped ?? "turns") }),
          { bound: got.stopped ?? "turns" });
      if (got.silent)
        return refusedEvent("MODEL_SILENT", localize("agent-worker.ask.the_model_could_not_be", "the model could not be reached, so nothing is returned."),
          { detail_from_model: got.silent.detail ?? null });
      return refusedEvent("MODEL_REFUSED",
        localize("agent-worker.ask.the_models_provider_refused_the", "the model's provider refused the call, or the model declined, so nothing is returned. Its own error type and status are beside this, unchanged."),
        { model_status: got.refused?.status ?? null, model_error: got.refused?.type ?? null,
          model_message: got.refused?.message ?? null });
    };
    try {
      const messages = [...conv.turns, { role: "user", content: `QUESTION: ${body.question}` }];
      const system = localize("agent-worker.ask.you_answer_one_members_question", "You answer one member's question from the BIO record and nothing else. Read what the record holds through the read tool, under the member's grant, then end reading; you will then compose the answer. You never answer from your own knowledge. The instructions you work under are this skill pack, version {String}.\n\nRESIDENT LAYER:\n{stringify}\n\nDisclosed layers, loaded with load_layer: {layers}. Load the ask layer before you read.", { String: String(String(pack.pack.version)), stringify: String(JSON.stringify(pack.pack.resident)), layers: String(model.layers.join(", ")) });

      /* (3) INTERPRETING, AND READING THROUGH THE GRANT. */
      await emit({ event: "step", step: "interpreting" });
      const reading = await converse({
        reference, runner: model.runner, mode: "ask", meter, system, messages, tools: tools.reading,
        finalTool: "done_reading", maxTurns: ASK_DECLARED.turns, ...traced,
        onTool: async (name, input) => {
          if (name === "load_layer") return loadLayer(model, input);
          if (name !== "read") return { content: localize("agent-worker.ask.string_is_not_a_tool", "'{String}' is not a tool of this step", { String: String(String(name).slice(0, 40)) }), error: true };
          const bound = reached();
          if (bound) return { content: { code: "ASK_BOUND_REACHED", bound,
                                         detail: localize("agent-worker.ask.the_asks_bound_bound_is", "the ask's {bound} bound is reached; end reading", { bound: String(bound) }) }, error: true };
          const admitted = admitRead(input);
          if (admitted.refused) return { content: admitted.refused, error: true };
          used.reads += 1;
          await emit({ event: "read", op: admitted.op, record: recordOf(admitted.query) });
          const got = await call(admitted.op, admitted.query);
          if (!got.reached) return { content: { code: "PLANE_SILENT", detail: localize("agent-worker.ask.the_plane_did_not_answer", "the plane did not answer this read; what it would have answered is not held") }, error: true };
          const a = planeAnswer(got, admitted.op);
          if (!a.refused) found.count += newPassages(a.result, found.seen);
          /* R63: the model is handed the readers' text and `active` lists only; a field holding bytes is dropped and
             the drop told beside the answer. */
          const { content } = toolContent(a.refused ? (a.refused.plane ?? { code: a.refused.code }) : a.result);
          used.bytes += JSON.stringify(content ?? null).length;
          return a.refused ? { content, error: true } : { content };
        },
      });
      spend(reading);
      await report(reading);
      if (!reading.answer) return await finish(modelEnded(reading));

      /* (4) COMPOSING, reading closed. A clarifying question is still an answer, and still checked. */
      await emit({ event: "composing", found: found.count >= 1, count: found.count });
      const bound = reached();
      if (bound) return await finish(refusedEvent("ASK_BOUND_REACHED",
        localize("agent-worker.ask.the_ask_reached_its_bound", "the ask reached its {bound} bound before it was answered, so nothing is returned.", { bound: String(bound) }), { bound }));
      messages.push({ role: "user", content: localize("agent-worker.ask.reading_is_closed_compose_the", "Reading is closed. Compose the answer by calling the answer tool, in the answers contract, resting every sentence on what was read.") });
      const composed = await converse({
        reference, runner: model.runner, mode: "ask", meter, system, messages, tools: tools.composing,
        finalTool: "answer", maxTurns: ASK_DECLARED.turns, ...traced,
        onTool: async (name, input) => (name === "load_layer" ? loadLayer(model, input)
          : { content: localize("agent-worker.ask.reading_is_closed_answer_with", "reading is closed; answer with the answer tool"), error: true }),
      });
      spend(composed);
      await report(composed);
      if (!composed.answer) return await finish(modelEnded(composed));

      /* (5) CHECKING: only what answers' checks pass is returned (answers R4). */
      const cited = Array.isArray(composed.answer?.holdings) ? composed.answer.holdings : [];
      await emit({ event: "checking", count: cited.length });
      const checked = await call("askcheck", null, { question: body.question, answer: composed.answer });
      if (!checked.reached)
        return await finish(refusedEvent("PLANE_SILENT",
          localize("agent-worker.ask.the_record_could_not_be_reached_to", "the record could not be reached to check the answer, so nothing is returned: an unchecked answer is never shown."), { detail_from_binding: checked.detail ?? null }));
      const c = planeAnswer(checked, "askcheck");
      if (c.refused)
        return await finish(refusedEvent("PLANE_REFUSED",
          localize("agent-worker.ask.the_record_refused_to_check", "the record refused to check the answer, so nothing is returned. Its refusal is passed through exactly as it was worded."), { at: "askcheck", plane: c.refused.plane ?? null }));
      const r = c.result || {};
      if (!r.answer || typeof r.answer !== "object")
        return await finish(refusedEvent("ASK_UNCHECKED",
          localize("agent-worker.ask.the_records_checks_answered_without", "the record's checks answered without a checked answer, so nothing is returned: an unchecked answer is never shown.")));
      /* R113: one `checked` event per cited passage as the check answers, before the last event; the check marks a
         holding it withheld as null in the answer it returns. */
      const kept = Array.isArray(r.answer.holdings) ? r.answer.holdings : [];
      let passed = 0;
      for (const [i, h] of cited.entries()) {
        const ok = kept[i] != null;
        if (ok) passed += 1;
        await emit({ event: "checked", passage: passageOf(h, i), found: ok });
      }
      /* R113: the answer cites holdings and the check withheld every one: nothing it wrote is shown. */
      if (cited.length && !passed)
        return await finish(refusedEvent("ASK_CHECK_FAILED", word("ai.progress.check.failed"), { cited: cited.length, found: 0 }));
      await finish({ event: "answer", ok: true, answer: r.answer, withheld: Array.isArray(r.withheld) ? r.withheld : [],
                     ...(untested.label ? { untested: untested.label } : {}) });
    } catch (e) {
      await finish(refusedEvent("ASK_FAILED", localize("agent-worker.ask.the_ask_failed_inside_this", "the ask failed inside this member, so nothing is returned."),
        { detail_from_member: String(e?.message ?? e).slice(0, 200) })).catch(() => {});
    }
  })();

  return new Response(stream.readable, { status: 200, headers: { "content-type": "application/x-ndjson" } });
}
