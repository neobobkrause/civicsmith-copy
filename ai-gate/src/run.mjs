/* ai-gate — running items: the stub plane, one item through `agent-model`, T0 Connect, the connect check, session
 * start and the cost of standard tasks (R8, R9, R11, R12, R14, R19, R21, R24, R42, R46).
 *
 * A model is reached only through the provider interface `agent-model` hands (`makeProvider(deps)`: `turn`,
 * `converse`, `capabilities`), by entry id, with the adapter and host profile production uses. This file holds no
 * network client, no provider address and no model name (R8): the caller hands the provider, and a test hands one
 * bound to `agent-model`'s fake provider (its R44).
 *
 * The STUB PLANE (R9) is in memory and built from the item's synthetic case: `fixture.plane` maps an op to what it
 * answers, `fixture.passages` maps an address to its passage (read as `meaningrows` rows), `fixture.project` names
 * the one project it answers for (`A` by default). An op outside the part's table is refused and the refusal is the
 * tool's result (`agent-worker` R37, R53, R55; an ask's read through `agent-worker`'s own `admitRead`). Its log is
 * every op the model's tool calls reached, in the shape `score.mjs` reads. */
import { canonicalJson } from "../../bio-plane/src/record-grammar/index.mjs";
import { checkReport } from "../../agent-harness/src/subsession.mjs";
import { PLANE_OPS } from "../../agent-worker/src/ops.mjs";
import { admitRead, readTool } from "../../agent-worker/src/ask.mjs";
import { MEANING_ARM } from "../../agent-steps/src/names.mjs";
import { GATE_PARAMS, GRADES, deepFreeze, refuse, isObj, isNonBlank } from "./params.mjs";
import { PARTS } from "./groups.mjs";
import { selectItems, itemById, PUBLIC_BANK } from "./bank.mjs";
import { scoreItem, scoreAnswerFree, reachOf } from "./score.mjs";
import { gradeOf } from "./verdict.mjs";
import { gateWords } from "./words.mjs";

const list = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ------------------------------------------------------------------ R8: no network of its own */

/* The shapes a network client or a provider address takes in source text, built from pieces so this file does not
   match itself. */
const NETWORK_SHAPES = Object.freeze([
  ["fetch", new RegExp("\\bfe" + "tch\\s*\\(")],
  ["https_address", new RegExp("htt" + "ps:\\/\\/[A-Za-z0-9]")],
  ["http_address", new RegExp("htt" + "p:\\/\\/[A-Za-z0-9]")],
]);

/** R8 — scan source files `{name: text}` for a network call, a provider address, or a provider name of
 *  `providerNames` (the caller reads them from `agent-model`, which names its providers). Answers the findings,
 *  `[{file, shape}]`, empty when clean. */
export function scanSources(files, { providerNames = [] } = {}) {
  const found = [];
  for (const [file, text] of Object.entries(isObj(files) ? files : {})) {
    const s = String(text ?? "");
    for (const [shape, re] of NETWORK_SHAPES) if (re.test(s)) found.push({ file, shape });
    for (const name of list(providerNames))
      if (isNonBlank(name) && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s))
        found.push({ file, shape: `provider:${name}` });
  }
  return deepFreeze(found);
}

/* ------------------------------------------------------------------ R9: the stub plane */

/** R9 — the stub plane for one item and part. `call(op, args, step)` answers `{answer}` or `{refused}`, and logs
 *  `{op, allowed, refused_as_result, answered, write, step, address, rows, repeated}` for every op reached. */
export function stubPlane(item, part) {
  const fx = isObj(item?.fixture) ? item.fixture : {};
  const answers = isObj(fx.plane) ? fx.plane : {};
  const passages = isObj(fx.passages) ? fx.passages : {};
  const project = isNonBlank(fx.project) ? fx.project : "A";
  const reach = reachOf(item);
  const table = reach ?? new Set(Object.keys(PLANE_OPS));
  const log = [];
  const seen = new Set();
  const rowsAt = (address) => ({ rows: typeof passages[address] === "string" ? [{ address, text: passages[address] }] : [] });
  /* R24: the collect step's own re-read of a cited address (`agent-steps` R8): the harness's read, not the model's,
     so it is kept apart from the log of what the model's calls reached */
  const reread = (address) => rowsAt(address).rows.length > 0;
  const call = (op, args = {}, step = "read") => {
    const a = isObj(args) ? args : {};
    const key = canonicalJson([op, a]);
    const repeated = seen.has(key);
    seen.add(key);
    const address = isNonBlank(a.address) ? a.address : isNonBlank(a.ids) ? a.ids : isNonBlank(a.id) ? a.id : null;
    const write = PLANE_OPS[op]?.mutating === true;
    /* an ask reads only through agent-worker's own door (R55) */
    let allowed = table.has(op);
    let refusal = null;
    if (part === "ask") {
      const admitted = admitRead({ op, args: a });
      if (admitted.refused) { allowed = false; refusal = admitted.refused; }
    }
    if (!allowed) refusal ??= { code: "GATE_OP_REFUSED", op };
    else if (a.project != null && a.project !== project) refusal = { code: "PROJECT_FENCE", op };
    if (refusal) {
      /* a refused write wrote nothing: it is logged as reached, not as a write */
      log.push({ op, allowed, refused_as_result: true, answered: false, write: false, step, address, rows: null, repeated });
      return { refused: refusal };
    }
    const answer = op === "meaningrows" && address !== null ? rowsAt(address)
      : Object.prototype.hasOwnProperty.call(answers, op) ? answers[op] : { rows: [] };
    const rows = Array.isArray(answer?.rows) ? answer.rows.length : null;
    log.push({ op, allowed: true, refused_as_result: false, answered: true, write, step, address, rows, repeated });
    return { answer: structuredClone(answer) };
  };
  return { call, reread, log, project };
}

/* ------------------------------------------------------------------ R9, R11, R12: one item through agent-model */

const FINAL_TOOL = "submit";
const SUBMIT_TOOL = Object.freeze({ name: FINAL_TOOL, description: FINAL_TOOL,
  input_schema: Object.freeze({ type: "object" }) });
const TOKEN_FIGURES = Object.freeze(["input_tokens", "output_tokens", "cache_read_input_tokens",
  "cache_creation_input_tokens", "reasoning_tokens"]);

/** R11 — every repeat on a fresh session: no provider-held state, the host pin required (BR12). */
export const GATE_DATA_HANDLING = deepFreeze({ zero_retention: "off", host_pin: "required", provider_state: "forbidden" });
const RUNTIME = "shared_worker";

/** R12 — the error class an `agent-model` outcome leaves, in this module's names (`ERROR_OUTCOME`), or null. */
export function errorClassOf(out) {
  if (!isObj(out)) return "malformed";
  if (out.stopped) return "ceiling";
  if (isObj(out.limit)) return "spend_cap";
  if (isObj(out.error)) {
    const c = out.error.class;
    return { rate_limit: "rate_limit", overload: "overload", timeout: "timeout", auth: "auth_revoked",
      model_gone: "model_not_found", circuit_open: "circuit_open", malformed: "malformed" }[c] ?? "request_rejected";
  }
  if (isObj(out.refused)) {
    const t = out.refused.type;
    if (t === "PRIVACY_PIN_VIOLATION") return "identity";
    if (t === "UNSUPPORTED_CONTROL") return "unsupported_control";
    if (t === "refusal" || t === "filtered") return null;
    return "request_refused";
  }
  if (isObj(out.silent)) return ["malformed", "stop_unmapped"].includes(out.silent.detail) ? "malformed" : "network";
  return null;
}

/* The usage of a conversation as the exchange keeps it: the token figures, null where unstated (`agent-model` R5). */
function usageOf(u) {
  const usage = Object.fromEntries(TOKEN_FIGURES.map((k) => [k, num(u?.[k])]));
  const unstated = new Set(list(u?.unstated));
  return { usage, stated: TOKEN_FIGURES.filter((k) => !unstated.has(k) && usage[k] !== null) };
}

/* The served identity, and what the entry names, as G0 compares them. */
const servedOfOut = (s) => ({ model: s?.model_version ?? null, host: s?.host ?? null });
const entryIdentity = (entry) => ({ model: entry?.model ?? null, host: entry?.host ?? null,
  served_ids: [...list(entry?.served_ids)], hosts: isObj(entry?.pin) ? [...list(entry.pin.only)] : [] });

/** R24 — citation resolution as `agent-steps`' collect step does it (its R8): each distinct cited address, at most
 *  `CITATIONS_REREAD_MAX`, re-read by address (`meaningrows`, `rows` the meaning arm, `ids` the address); a citation
 *  resolves when the re-read answers a row. Answers `[{address, op, rows, resolved}]`. */
export function resolveCitations(plane, output, params = GATE_PARAMS) {
  const cited = [...new Set(list(output?.quotes).map((q) => q?.passage).filter(isNonBlank))].slice(0, params.CITATIONS_REREAD_MAX);
  return cited.map((address) => ({ address, op: "meaningrows", rows: MEANING_ARM, resolved: plane.reread(address) }));
}

/** R9 — run one item once through `provider.converse` (agent-model R6, built only on `turn`) on its stub plane, and
 *  answer `{outcome, exchange, stub_log}`. `entry` is the catalogue entry; `privateItem`, where given, scores the
 *  item whole (Civicsmith's side), else the outcome is the answer-free one (R32). Never throws. */
export async function runItem({ item, part, provider, entry, account, session_key, nonce = "run", repeat = 0,
  privateItem = null, maxTurns = 6, cache_hints = null } = {}) {
  try {
    if (!isObj(item) || !PARTS.includes(part) || !provider || typeof provider.converse !== "function" || !isObj(entry))
      return refuse("GATE_RUN_INPUT");
    const plane = stubPlane(item, part);
    const fx = isObj(item.fixture) ? item.fixture : {};
    const extra = list(fx.tools).filter((t) => isNonBlank(t?.name) && t.name !== "read")
      .map((t) => ({ name: t.name, description: t.name, input_schema: isObj(t.schema) ? t.schema : { type: "object" } }));
    const tools = [readTool(), ...extra, SUBMIT_TOOL];
    const calls = [];
    const submissions = [];
    const messages = [{ role: "user", content: canonicalJson({ case: fx.case ?? null, item: item.id, part,
      prompt: fx.prompt ?? null, passages: fx.passages ?? null }) }];
    const out = await provider.converse({
      account, entry_id: entry.entry_id, runtime: RUNTIME, data_handling: GATE_DATA_HANDLING, system: fx.system ?? null,
      messages, tools, finalTool: FINAL_TOOL, maxTurns, session_key, cache_hints: cache_hints ?? undefined,
      idempotency_base: `${nonce}:${item.id}:${repeat}`,
      /* G2: a report is held to agent-harness' contract, and handed back once (agent-model R18) */
      checkFinal: (input) => { submissions.push(input); return isObj(input?.report) ? checkReport(input.report) : null; },
      onTool: async (name, input) => {
        const op = name === "read" ? String(input?.op ?? "") : name;
        const args = name === "read" ? (isObj(input?.args) ? input.args : {}) : (isObj(input) ? input : {});
        const got = plane.call(op, args, "read");
        const result = got.refused ? { refused: got.refused } : got.answer;
        calls.push({ tool: name, args: input ?? null, result });
        return got.refused ? { content: got.refused, error: true } : { content: got.answer };
      },
    });
    const error_class = errorClassOf(out);
    const output = isObj(out?.answer) ? out.answer : {};
    const citations = out?.answer ? resolveCitations(plane, output) : [];
    if (out?.answer && submissions.length && submissions.at(-1) !== out.answer) submissions.push(out.answer);
    const { usage, stated } = usageOf(out?.usage);
    const refusedType = out?.refused?.type;
    const exchange = {
      served: servedOfOut(out?.served), entry: entryIdentity(entry), error_class,
      stop_reason: refusedType === "refusal" || refusedType === "filtered" ? refusedType : out?.answer ? "end" : null,
      completed: !!out?.answer, usage, stated_usage: stated, calls, output, citations, offered: tools.map((t) => t.name),
      reports: submissions.filter((s) => isObj(s?.report)).map((s) => s.report),
      turns: num(out?.calls) ?? num(out?.usage?.calls), session_key: session_key ?? null,
      cost_reported: num(out?.usage?.cost_reported?.amount), cost_estimated: num(out?.usage?.cost_estimated?.amount),
      refused: isObj(out?.refused) ? { type: out.refused.type, field: out.refused.field ?? null, control: out.refused.control ?? null } : null,
      transcript: messages,
    };
    const scored = privateItem ? scoreItem({ item, exchange, stub_log: plane.log, privateItem })
      : scoreAnswerFree(item, exchange, plane.log);
    return { ok: true, outcome: scored?.ok ? scored.outcome : null, exchange, stub_log: plane.log };
  } catch {
    return refuse("GATE_RUN_INPUT");
  }
}

/** R11, R28 — an item's repeats, each on its own fresh session key (`planRun`'s), joined: the first exchange, with
 *  every repeat's answer, verdict and citations for G6. */
export async function runRepeats({ sessions, ...args } = {}) {
  const keys = list(sessions).length ? list(sessions) : [`${args.nonce ?? "run"}:${args.item?.id}:0`];
  const runs = [];
  for (const [r, session_key] of keys.entries()) runs.push(await runItem({ ...args, session_key, repeat: r }));
  const first = runs[0];
  if (!first?.ok) return first;
  const exchange = { ...first.exchange, repeats: runs.map((x) => x.exchange?.output?.answer ?? x.exchange?.output ?? null),
    repeat_verdicts: runs.map((x) => x.exchange?.output?.verdict ?? null),
    repeat_citations: runs.map((x) => list(x.exchange?.output?.quotes).map((q) => q?.passage)),
    sessions: runs.map((x) => x.exchange?.session_key ?? null) };
  return { ok: true, outcome: first.outcome, exchange, stub_log: first.stub_log, runs };
}

/* ------------------------------------------------------------------ R14: T0 Connect */

/* One synthetic page picture for the image probe (a few bytes; never a team's). */
const PROBE_IMAGE = Object.freeze({ type: "image", media_type: "image/png", data: "AAAA" });
const ECHO_TOOL = Object.freeze({ name: "echo", description: "echo", input_schema: Object.freeze({ type: "object" }) });
const DONE_TOOL = Object.freeze({ name: "done", description: "done", input_schema: Object.freeze({ type: "object" }) });
const hasCap = (caps, name) => caps?.[name] === true || (typeof caps?.[name] === "string" && caps[name] !== "none");

function turnRequest(entry, account, item, over = {}) {
  return { account, entry_id: entry.entry_id, runtime: RUNTIME, data_handling: GATE_DATA_HANDLING,
    messages: [{ role: "user", content: canonicalJson({ item: item.id, probe: item.needs ?? item.content_kind }) }],
    max_output: GATE_PARAMS.PROBE_MAX_OUTPUT, timeout_ms: GATE_PARAMS.PROBE_TIMEOUT_MS,
    idempotency_key: `${over.nonce ?? "t0"}:${item.id}`, ...over.request };
}

/* An exchange from one turn's outcome. */
function turnExchange(entry, out) {
  const { usage, stated } = usageOf(out?.usage);
  return { served: servedOfOut(out?.served), entry: entryIdentity(entry), error_class: errorClassOf(out),
    stop_reason: isObj(out?.result) ? (out.result.stop ?? "end") : out?.refused?.type ?? null, completed: isObj(out?.result),
    usage, stated_usage: stated, calls: [], output: { text: out?.result?.text ?? null }, turns: 1,
    cost_reported: num(out?.usage?.cost_reported?.amount), cost_estimated: num(out?.usage?.cost_estimated?.amount),
    refused: isObj(out?.refused) ? { type: out.refused.type, field: out.refused.field ?? null, control: out.refused.control ?? null } : null };
}

/* R14 — one T0 item: the round trip ("echo", then "done"), the plain identity turn, or the probe of one declared
   capability. Answers `{item_id, outcome, exchange, mismatch?}`. */
async function runT0Item(item, { provider, entry, account, caps, nonce }) {
  if (item.content_kind === "round_trip") {
    const calls = [];
    const out = await provider.converse({ account, entry_id: entry.entry_id, runtime: RUNTIME, data_handling: GATE_DATA_HANDLING,
      messages: [{ role: "user", content: canonicalJson({ item: item.id, probe: "round_trip" }) }], tools: [ECHO_TOOL, DONE_TOOL],
      finalTool: "done", maxTurns: 3, idempotency_base: `${nonce}:${item.id}`,
      onTool: async (name, input) => { calls.push({ tool: name, args: input ?? null, result: input ?? null }); return { content: input ?? null }; } });
    const { usage, stated } = usageOf(out?.usage);
    const exchange = { served: servedOfOut(out?.served), entry: entryIdentity(entry), error_class: errorClassOf(out),
      stop_reason: out?.answer ? "end" : out?.refused?.type ?? null, usage, stated_usage: stated, calls,
      completed: !!out?.answer && calls.some((c) => c.tool === "echo"), output: { done: out?.answer ?? null },
      turns: num(out?.calls), cost_reported: num(out?.usage?.cost_reported?.amount), cost_estimated: num(out?.usage?.cost_estimated?.amount),
      refused: isObj(out?.refused) ? { type: out.refused.type, field: out.refused.field ?? null } : null };
    const s = scoreItem({ item, exchange, stub_log: [] });
    const outcome = exchange.error_class ? s.outcome : exchange.completed && s.outcome === "pass" ? "pass" : "fail";
    return { item_id: item.id, outcome, exchange };
  }
  if (item.content_kind === "capability") {
    const cap = item.needs;
    if (!hasCap(caps, cap)) return { item_id: item.id, outcome: "not_applicable", exchange: null };
    const request = cap === "tools" ? { tools: [ECHO_TOOL] }
      : cap === "schema_output" ? { output_schema: { type: "object" } }
        : cap === "image_input" ? { messages: [{ role: "user", content: [PROBE_IMAGE] }] }
          : cap === "streaming" ? { onProgress: () => {} } : {};
    const out = await provider.turn(turnRequest(entry, account, item, { nonce, request }));
    const exchange = turnExchange(entry, out);
    const answered = isObj(out?.result);
    const rejected = exchange.error_class === "unsupported_control" || exchange.error_class === "request_rejected";
    const s = scoreItem({ item, exchange, stub_log: [] });
    return { item_id: item.id, outcome: rejected ? "fail" : s.outcome, exchange,
      ...(rejected || (!answered && !exchange.error_class) ? { mismatch: { capability: cap, catalogue: caps[cap], answered: false } } : {}) };
  }
  const out = await provider.turn(turnRequest(entry, account, item, { nonce }));
  const exchange = turnExchange(entry, out);
  return { item_id: item.id, outcome: scoreItem({ item, exchange, stub_log: [] }).outcome, exchange };
}

/** R14, R18 — T0 Connect for `entry` through `provider`: one call per capability the entry declares, the two-turn
 *  round trip and the identity turn; served identity and host pin checked by `agent-model` (its R45, BR12) under a
 *  required pin; the capability answers compared with the catalogue's (`provider.capabilities`, its R30). A wrong
 *  served identity or an unhonoured pin stops the run (R18). Answers `{ok, tier, completed, early_stop, identity_ok,
 *  pin_ok, tools_ok, capability_mismatches, results}`. */
export async function runT0({ provider, entry, account, bank = PUBLIC_BANK, selection_seed, nonce = "t0" } = {}) {
  if (!provider || typeof provider.turn !== "function" || !isObj(entry)) return refuse("GATE_RUN_INPUT");
  const caps = await provider.capabilities(entry.entry_id);
  if (!isObj(caps) || caps.refused) return refuse("GATE_ENTRY_NOT_LISTED");
  const ids = selectItems(bank, selection_seed, "T0", PARTS);
  if (!Array.isArray(ids)) return ids;
  /* the round trip and the identity turn first, then the probes */
  const items = ids.map((id) => itemById(bank, id)).sort((a, b) => (a.content_kind === "capability") - (b.content_kind === "capability"));
  const results = [];
  let early_stop = null;
  for (const item of items) {
    const r = await runT0Item(item, { provider, entry, account, caps, nonce });
    results.push(r);
    const ref = r.exchange?.refused;
    if (r.exchange?.error_class === "identity") {
      early_stop = ref?.field === "host" ? "early_stop_pin" : "early_stop_identity";
      r.outcome = "identity_mismatch";
      break;
    }
  }
  const identity_ok = !results.some((r) => r.exchange?.error_class === "identity" && r.exchange?.refused?.field !== "host");
  const pin_ok = !results.some((r) => r.exchange?.error_class === "identity" && r.exchange?.refused?.field === "host");
  const echo = results.find((r) => itemById(bank, r.item_id)?.content_kind === "round_trip");
  const tools_ok = echo ? echo.outcome === "pass" : null;
  return deepFreeze({ ok: true, tier: "T0", completed: early_stop === null, early_stop, identity_ok, pin_ok, tools_ok,
    capability_mismatches: results.filter((r) => r.mismatch).map((r) => r.mismatch), results });
}

/** R19 — a team's connect check: T0 only, from the public T0 items (no challenge, no answers), for an entry the
 *  catalogue lists; no verdict, no bundle. Answers `{ok, connected, identity_ok, capability_mismatches, items}`; an
 *  entry the catalogue does not list answers `GATE_ENTRY_NOT_LISTED` (an unlisted plan goes through R20). */
export async function connectCheck(account, entry, { provider, bank = PUBLIC_BANK } = {}) {
  if (!isObj(entry) || !["listed", "watch"].includes(entry.lifecycle)) return refuse("GATE_ENTRY_NOT_LISTED");
  const t0 = await runT0({ provider, entry, account, bank, selection_seed: GATE_PARAMS.CONNECT_SEED, nonce: "connect" });
  if (!t0.ok) return t0;
  return deepFreeze({ ok: true, connected: t0.results.some((r) => r.exchange?.completed === true), identity_ok: t0.identity_ok && t0.pin_ok,
    capability_mismatches: t0.capability_mismatches, items: t0.results.map((r) => r.item_id) });
}

/* ------------------------------------------------------------------ R42: session start, cold and warm */

const median = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const sumOf = (xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a + b, 0));

/* One sample: a turn of the role's fixed prompt, tool set and pack, its figures. */
async function sample(provider, entry, account, role, spec, { session_key, cache_hints, key, now }) {
  const t = now();
  /* R42's time to first byte: the first progress after the turn starts ("reading", the response's first bytes),
     which `agent-model` sends only where the entry streams; a turn-level "turn_done" is the whole turn, so a
     non-streaming entry records null (not measured), never the whole turn's time. */
  let first = null;
  const onProgress = (e) => { if (first === null && e?.kind !== "turn_started" && e?.kind !== "turn_done") first = now(); };
  const out = await provider.turn({ account, entry_id: entry.entry_id, runtime: RUNTIME, onProgress,
    data_handling: { ...GATE_DATA_HANDLING, ...(session_key ? { provider_state: "allowed" } : {}) },
    messages: [{ role: "system", content: spec.system }, ...list(spec.messages)], tools: list(spec.tools),
    max_output: GATE_PARAMS.PROBE_MAX_OUTPUT, timeout_ms: GATE_PARAMS.PROBE_TIMEOUT_MS, idempotency_key: key,
    ...(session_key ? { session_key } : {}), ...(cache_hints ? { cache_hints } : {}) });
  const u = out?.usage ?? {};
  return { input: num(u.input_tokens), cached: num(u.cache_read_input_tokens), output: num(u.output_tokens),
    cost: num(u.cost_reported?.amount) ?? num(u.cost_estimated?.amount), first_byte_ms: first === null ? null : Math.max(0, first - t),
    ms: Math.max(0, now() - t), ok: isObj(out?.result) };
}
const summary = (ss) => ({ input: median(ss.map((s) => s.input)), cached: median(ss.map((s) => s.cached)),
  output: median(ss.map((s) => s.output)), cost: median(ss.map((s) => s.cost)),
  first_byte_ms: median(ss.map((s) => s.first_byte_ms)), ms: median(ss.map((s) => s.ms)) });

/** R42 — session start per role: the fixed prompt, tool set and pack (`roles: {role: {system, tools, messages}}`)
 *  sent cold (a new session key each, no cache) and warm (one session key, the cache hints), `CHAR_SAMPLES` each,
 *  recording input, cached and output tokens, cost, time to first byte (`first_byte_ms`), whole-turn time (`ms`) and
 *  cold minus warm; then each efficiency lever the entry
 *  offers (`caching`, `session`; `batch` recorded OPEN, since `agent-model` sends no batch) with and without,
 *  `LEVER_RUNS` runs each. Answers R41 records (`charRecord` shape) graded by `source` (R61). */
export async function sessionStart({ provider, entry, account, roles, source = "civicsmith", run_ref = null, at = null,
  params = GATE_PARAMS, now = Date.now } = {}) {
  if (!provider || typeof provider.turn !== "function" || !isObj(entry) || !isObj(roles)) return refuse("GATE_RUN_INPUT");
  const caps = await provider.capabilities(entry.entry_id);
  if (!isObj(caps) || caps.refused) return refuse("GATE_ENTRY_NOT_LISTED");
  const ev = { grade: gradeOf(source), source: run_ref, date: at };
  const records = [];
  const hints = { prefix: "system" };
  for (const [role, spec] of Object.entries(roles)) {
    if (!isObj(spec) || !isNonBlank(spec.system)) return refuse("GATE_RUN_INPUT");
    const cold = [], warm = [];
    for (let i = 0; i < params.CHAR_SAMPLES; i++)
      cold.push(await sample(provider, entry, account, role, spec, { key: `cold:${role}:${i}`, now }));
    for (let i = 0; i < params.CHAR_SAMPLES; i++)
      warm.push(await sample(provider, entry, account, role, spec, { session_key: `warm:${role}`, cache_hints: hints, key: `warm:${role}:${i}`, now }));
    const c = summary(cold), w = summary(warm);
    const minus = Object.fromEntries(Object.keys(c).map((k) => [k, c[k] === null || w[k] === null ? null : c[k] - w[k]]));
    records.push({ property: `session_start.${role}`, method: "cold_and_warm", samples: cold.length + warm.length,
      value: { cold: c, warm: w, cold_minus_warm: minus, per_sample: { cold, warm } }, ev });
    const levers = [];
    if (caps.caching === "automatic" || caps.caching === "explicit") levers.push(["caching", { cache_hints: hints }]);
    if (caps.session === "provider_state") levers.push(["session", { session_key: `lever:${role}` }]);
    for (const [lever, on] of levers) {
      const with_ = [], without = [];
      for (let i = 0; i < params.LEVER_RUNS; i++) {
        with_.push(await sample(provider, entry, account, role, spec, { ...on, key: `lever:${lever}:${role}:on:${i}`, now }));
        without.push(await sample(provider, entry, account, role, spec, { key: `lever:${lever}:${role}:off:${i}`, now }));
      }
      records.push({ property: `lever.${lever}.${role}`, method: "with_and_without", samples: with_.length + without.length,
        value: { with: summary(with_), without: summary(without) }, ev });
    }
    if (caps.batch === true)
      records.push({ property: `lever.batch.${role}`, method: "with_and_without", samples: 0, value: GRADES.OPEN,
        ev: { grade: GRADES.OPEN, source: null, date: null } });
  }
  return deepFreeze({ ok: true, records });
}

/* ------------------------------------------------------------------ R46: the all-in cost of standard tasks */

/* R46 — a run's tokens priced at the catalogue's per-million rates; null when input or output is unstated (never
   priced as zero). A cache figure the provider did not state is named in `unstated`. */
const RATE_OF = Object.freeze({ input_tokens: "input", output_tokens: "output", cache_read_input_tokens: "cache_read",
  cache_creation_input_tokens: "cache_write" });
function priceOf(usage, prices) {
  if (usage.input_tokens === null || usage.output_tokens === null) return null;
  let amount = 0;
  for (const [k, rate] of Object.entries(RATE_OF))
    if (usage[k] !== null && typeof prices[rate] === "number") amount += (usage[k] * prices[rate]) / 1e6;
  return amount;
}

/** R46 — each part's standard task (`tasks: {part: item}`, a fixed T2 case) run `COST_RUNS` times through
 *  `runItem` on its stub plane, each run's tokens and calls (retries and session start included, as `agent-model`
 *  counts them) priced at the catalogue price with its date, reconciled against
 *  the provider's own figure where every run reports one. A range per part, recorded as the entry's
 *  `standard_task_costs` (`ai-catalogue` R4). Without a reconciled figure the grade says the price is estimated; a
 *  plan that reports no money records tokens and calls and the words `not measurable in money`. */
export async function taskCosts({ provider, entry, account, tasks, money = true, source = "civicsmith", run_ref = null,
  at = null, params = GATE_PARAMS, nonce = "cost" } = {}) {
  if (!provider || !isObj(entry) || !isObj(tasks)) return refuse("GATE_RUN_INPUT");
  const prices = isObj(entry.prices) && entry.prices.open !== true ? entry.prices : null;
  const priced = money && prices !== null;
  const by_part = {}, measure = {};
  let reconciled = priced;
  for (const [part, item] of Object.entries(tasks)) {
    if (!PARTS.includes(part) || !isObj(item)) return refuse("GATE_PART_UNKNOWN");
    const runs = [];
    for (let i = 0; i < params.COST_RUNS; i++) {
      const r = await runItem({ item, part, provider, entry, account, session_key: `${nonce}:${part}:${i}`, nonce, repeat: i });
      if (!r.ok) return r;
      runs.push(r.exchange);
    }
    measure[part] = { runs: runs.length, calls: sumOf(runs.map((x) => x.turns)),
      input_tokens: sumOf(runs.map((x) => x.usage.input_tokens)), output_tokens: sumOf(runs.map((x) => x.usage.output_tokens)) };
    if (!priced) continue;
    const est = runs.map((x) => priceOf(x.usage, prices));
    const rep = runs.map((x) => x.cost_reported);
    if (rep.some((v) => v === null)) reconciled = false;
    const costs = est.every((v) => v !== null) ? est : null;
    by_part[part] = costs ? { low: Math.min(...costs), high: Math.max(...costs),
      unstated: [...new Set(runs.flatMap((x) => Object.keys(RATE_OF).filter((k) => x.usage[k] === null)))],
      reconciliation: rep.every((v) => v !== null) ? sumOf(rep) - sumOf(costs) : null } : { low: null, high: null, reconciliation: null };
  }
  const grade = gradeOf(source);
  if (!priced)
    return deepFreeze({ ok: true, standard_task_costs: null, measure, words: gateWords("note", "not_measurable_in_money"),
      ev: { grade, source: run_ref, date: at } });
  return deepFreeze({ ok: true, measure,
    standard_task_costs: { unit: "usd", price_date: prices.date ?? null, by_part,
      ev: { grade: reconciled ? grade : `${grade} (estimated price)`, source: run_ref, date: at } } });
}
