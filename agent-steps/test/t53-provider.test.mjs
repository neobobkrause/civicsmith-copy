/* T53 (K5457) — a segment on `agent-model`'s provider interface: an entry per conversation (R50, R23, R26), the tick's
 * usage list (R14), Gate 1 before any turn (R51), a stop at the step boundary (R52, R34), a notice before a new
 * recipient (R53), idempotent writes and turns (R54), the run record as the only source of a turn (R55), labels on
 * every machine result (R56) and never a silent degrade (R57).
 *
 * Every arm drives `driveHarness` over the suite's fake plane and `agent-model`'s real provider (`makeProvider`, through
 * `providerFor`), bound to a catalogue seeded by `ai-catalogue`'s real code; the provider at the other end answers in
 * its adapter's own wire shape (`t53-world.mjs`). Each admitting arm has its refusing or absent control beside it. */
import { segment, account, answers, reading, catalogue, FAKECO, genError, remote } from "./t53-world.mjs";
import * as steps from "../src/index.mjs";
import { makeProvider } from "../../agent-model/src/provider/index.mjs";
import { segmentMeter } from "../../agent-model/src/model.mjs";
import { SECRET } from "../../agent-model/test/provider-world.mjs";
import { circuitRecord, BREAKER_FAILURES } from "../../agent-model/src/health.mjs";
import { ROLE_NEEDS } from "../../agent-harness/src/harness.mjs";
/* R54's writes, as the requirement names them */
const WRITE_OPS = new Set(["airunspawn", "capturerequest", "suggest", "optionpropose", "airuntick", "airunclose"]);
const { modelHalf, SEGMENT_END_BY } = steps;
const talk = steps.talk ?? (async () => ({}));
const providerFor = steps.providerFor ?? makeProvider;
import { SCOPED } from "./world.mjs";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1; else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};
const writes = (rec) => rec.calls.filter((c) => WRITE_OPS.has(c.op));
const recorder = (log) => (p) => ({ ...p, entryFor: async (account, role, need) => { log.push({ role, need }); return p.entryFor(account, role, need); } });

console.log("\n--- R50, R23 · an entry per conversation, asked with the role's need; sub-sessions by cost low ---");
{
  const asked = [];
  const r = await segment({ remoteCfg: { answer: answers() }, spy: recorder(asked) });
  t("R50: each conversation of a check run asks entryFor with its role and ROLE_NEEDS[role]; the sub-sessions with their capabilities at cost low (R23)",
    asked.map((a) => [a.role, a.need]),
    [["check:plan", ROLE_NEEDS["check:plan"]],
     ...Array(4).fill(["subsession", { capabilities: [...ROLE_NEEDS.subsession.capabilities], cost: "low" }]),
     ["check:compose", ROLE_NEEDS["check:compose"]], ["check:dedup", ROLE_NEEDS["check:dedup"]]]);
  t("R23: the four sub-sessions pass cost low and the plan row standard", [asked.filter((a) => a.need.cost === "low" && a.role === "subsession").length, asked[0]?.need?.cost], [4, "standard"]);
  t("R23 (control): no call passes a model name: every need is {capabilities, cost} and every request names the entry's own model from the catalogue",
    [asked.every((a) => JSON.stringify(Object.keys(a.need)) === '["capabilities","cost"]'), [...new Set(r.requests.map((q) => q.body.model))]], [true, ["fake-model-gen-one"]]);
  t("R50: the entry chosen is the one in its usage entry", [...new Set(r.rec.ticks.flatMap((k) => k.usage || []).map((u) => u.entry_id))], ["gen-one"]);
}
{
  /* every deployed mode's rows are in ROLE_NEEDS, so the door is driven directly, over the same provider */
  const far = remote({ answer: answers() });
  const model = modelHalf({ account: account(), meter: segmentMeter({ turnsBound: 5, bytesBound: 1e9 }), provider: providerFor({ catalogue: await catalogue(), fetch: far.fetch }) });
  const got = await talk(model, { role: "check:nonesuch", mode: "check", system: "s", messages: [{ role: "user", content: "q" }], tools: [], finalTool: "judge_nonesuch", idem: "RUN-W:0:nonesuch:turn" });
  t("R50 (control): a conversation for a role absent from ROLE_NEEDS is refused AI_ROLE_UNKNOWN before any call",
    [got.roleUnknown, far.requests.length], [{ code: "AI_ROLE_UNKNOWN", role: "check:nonesuch" }, 0]);
}

console.log("\n--- R26, R14 · each usage entry names its own entry and label; one entry per conversation ---");
{
  const r = await segment({ acct: account({ entries: ["gen-one", "gen-cheap"] }), remoteCfg: { answer: answers() } });
  const ticks = r.rec.ticks.filter((k) => Array.isArray(k.usage));
  const usage = ticks.flatMap((k) => k.usage);
  /* ROLE_NEEDS gives check:dedup cost low too (agent-harness R20), so its entry is the cheap one */
  t("R26: coordinating entries name E1 (the head) and sub-session entries E2 (the cheap one), with each conversation's own label",
    usage.map((u) => [u.entry_id, u.label?.model_version, u.label?.effort]),
    [["gen-one", "fake-model-gen-one", "medium"], ...Array(4).fill(["gen-cheap", "fake-model-gen-cheap", "low"]),
     ["gen-one", "fake-model-gen-one", "medium"], ["gen-cheap", "fake-model-gen-cheap", "medium"]]);
  t("R14: the fan-out's tick carries one entry per conversation (four), never the step as one; each with mode, entry_id, label, usage and calls",
    [ticks.map((k) => k.usage.length), Object.keys(usage[1] ?? {})], [[1, 4, 1, 1], ["mode", "entry_id", "label", "usage", "calls"]]);
  t("R14 (control): a figure the provider did not state stays null, never 0", [usage[0]?.usage?.cache_read_input_tokens, usage[0]?.usage?.reasoning_tokens], [null, null]);
  t("R14 (control): a tick after no conversation carries no usage", r.rec.ticks.filter((k) => !("usage" in k)).length > 0, true);
}
{
  const r = await segment({ remoteCfg: { answer: answers() }, deps: { catalogue: { ...(await catalogue()), entryOf: async () => null } } });
  t("R26 (control): a conversation whose provider answered no label leaves no invented one (the turn is refused; nothing is labelled)",
    r.rec.ticks.flatMap((k) => k.usage || []).filter((u) => u.label && u.label.model_version).length, 0);
}

console.log("\n--- R51 · Gate 1 per part, before any turn ---");
{
  const r = await segment({ plane: { session: { state: null } }, acct: account({ verdict: "not_suitable" }), remoteCfg: { answer: answers() } });
  t("R51: no entry passed the run part: 409 PART_NOT_PASSED naming the part and the entries, no turn and no plane write beyond the reads",
    [r.status, r.refusal?.code, r.refusal?.part, r.refusal?.entries, r.requests.length, writes(r.rec).length],
    [409, "PART_NOT_PASSED", "run", [{ entry_id: "gen-one", verdict: "not_suitable" }], 0, 0]);
  const n = await segment({ acct: account({ entries: ["gen-notools"] }), remoteCfg: { answer: answers() } });
  t("R51: a capability the role needs (tools, for a sub-session) missing on every entry that passed: 409 AI_CAPABILITY_MISSING, no turn",
    [n.status, n.refusal?.code, n.refusal?.capability, n.requests.length], [409, "AI_CAPABILITY_MISSING", "tools", 0]);
  const ok = await segment({ acct: account({ verdict: { verdict: "passes_with_limits", limits: ["G4"] } }), remoteCfg: { answer: answers() } });
  t("R51 (control): passes_with_limits proceeds, and the limit is in the segment's answer",
    [ok.status, ok.out.ended?.by, ok.out.gateLimits], [null, SEGMENT_END_BY.table, [{ entry_id: "gen-one", part: "run", verdict: "passes_with_limits", limits: ["G4"] }]]);
}

console.log("\n--- R34 · a refusal at dispatch closes the run, logged; an AI stop leaves it resumable ---");
{
  const held = { ...SCOPED, step: "submit", queue: [{ name: "queued-one", level: "meaning", description: "q" }] };
  const r = await segment({ plane: { session: { state: held } }, acct: account({ verdict: "not_suitable" }) });
  t("R34: PART_NOT_PASSED on a run that has done work: its queued candidate is written, the run closed not completed, the refusal logged",
    [r.refusal?.code, r.rec.wrote, r.rec.closed, r.rec.log.some((e) => e.subject === "dispatch -> refused" && e.detail.includes("PART_NOT_PASSED"))],
    ["PART_NOT_PASSED", ["queued-one"], "lease", true]);
  const atDedup = { ...SCOPED, step: "dedup", candidates: [{ name: "composed-one", level: "meaning", description: "c" }] };
  const s = await segment({ plane: { session: { state: atDedup } }, remoteCfg: { answer: answers(), fail: () => genError(500, "overloaded", "busy") } });
  t("R34 (control): an ai_stop is not a refusal: no close, the run left resumable", [s.status, s.out.aiStop?.reason, s.rec.closed], [null, "unavailable", null]);
}

console.log("\n--- R52 · a stop at the step boundary, for each class ---");
{
  const atCompose = (fault) => (ctx) => (ctx.final === "judge_compose" ? fault : null);
  const classes = [
    ["overload", genError(503, "overloaded", "busy"), "unavailable"],
    ["rate_limit", { ...genError(429, "rate_limited", "slow down"), headers: { "retry-after": "3600" } }, "unavailable"],
    ["spend", genError(402, "insufficient_credits", "spent"), "limit"],
    ["model_gone", genError(404, "model_not_found", "gone"), "lapsed"],
    ["auth", genError(401, "invalid_api_key", "no"), "auth"],
  ];
  for (const [cls, fault, reason] of classes) {
    const r = await segment({ remoteCfg: { answer: answers(), fail: atCompose(fault) } });
    const composeTick = r.rec.ticks.some((k) => (k.log || []).some((e) => String(e.subject).startsWith("compose ->")) || (k.state && k.state.step === "dedup"));
    t(`R52: ${cls} mid-compose ends the segment with ai_stop.reason ${reason}, ended.by "${SEGMENT_END_BY.ai}", no suggest and no tick of compose`,
      [r.status, r.out.aiStop?.reason, r.out.aiStop?.class, r.out.ended?.by, r.out.segmentEnd?.ai_stop?.reason, r.rec.calls.some((c) => c.op === "suggest"), composeTick],
      [null, reason, cls === "spend" ? "spend" : cls, SEGMENT_END_BY.ai, reason, false, false]);
  }
  const ra = await segment({ remoteCfg: { answer: answers(), fail: atCompose({ ...genError(429, "rate_limited", "slow down"), headers: { "retry-after": "3600" } }) } });
  t("R52: a rate limit past the wait carries retry_after", ra.out.aiStop?.retry_after, 3600);
  /* circuit_open: the breaker for (account, entry) is open before compose's turn is sent */
  const m = new Map(); const circuit = { get: (k) => m.get(k), put: (k, v) => { m.set(k, v); } };
  const acct = account();
  const now = Date.parse("2026-11-05T10:00:00Z");
  for (let i = 0; i < BREAKER_FAILURES; i += 1) await circuitRecord(circuit, acct, "gen-one", "overload", { now });
  const co = await segment({ acct, deps: { circuit }, remoteCfg: { answer: answers() } });
  t("R52: circuit_open (no call made) stops the segment as unavailable before the first turn", [co.out.aiStop?.reason, co.out.aiStop?.class, co.requests.length], ["unavailable", "circuit_open", 0]);
  const cr = await segment({ remoteCfg: { answer: answers(), fail: (ctx) => (ctx.final === "judge_compose"
    ? { status: 200, body: { id: "gen_1", choices: [{ index: 0, message: { role: "assistant", content: "no", refusal: "I won't" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } } } : null) } });
  t("R52 (control): a content refusal is the model's answer and no stop", [cr.status, cr.refusal?.code, cr.out.aiStop ?? null], [502, "MODEL_REFUSED", null]);
  const rj = await segment({ remoteCfg: { answer: answers(), fail: atCompose(genError(400, "invalid_request", "bad")) } });
  t("R52 (control): a rejected request is no stop and never a turn that judged nothing: the model's refusal, naming its class, and no suggest",
    [rj.status, rj.refusal?.code, rj.refusal?.model_error, rj.out.aiStop ?? null, rj.rec.calls.some((c) => c.op === "suggest")], [502, "MODEL_REFUSED", "request_rejected", null, false]);
}
{
  /* the fan-out's third level (document) fails; the segment is resumed at the state its last tick published */
  const failDoc = (ctx) => (ctx.final === "report" && ctx.level === "document" ? genError(503, "overloaded", "busy") : null);
  const one = await segment({ remoteCfg: { answer: answers(), fail: failDoc } });
  const last = [...one.rec.ticks].reverse().find((k) => k.state)?.state;
  t("R52: a fan-out whose third level fails stops there; the reports already taken stay in the log",
    [one.out.aiStop?.reason, one.rec.log.filter((e) => /^sub-session \w+ -> report$/.test(e.subject)).map((e) => e.level)], ["unavailable", ["meaning", "content"]]);
  const two = await segment({ plane: { session: { state: last } }, remoteCfg: { answer: answers() } });
  t("R52: resumed, the fan-out asks only the third and fourth levels, and the run completes with all four reports",
    [two.requests.filter((q) => q.final === "report").map((q) => q.level), two.out.reportsTaken, two.out.ended?.by], [["document", "internet"], 4, SEGMENT_END_BY.table]);

  console.log("\n--- R54 · retried turns never duplicate writes ---");
  const keys = (rec, op) => rec.calls.filter((c) => c.op === op).map((c) => c.body?.idem ?? c.query?.idem);
  t("R54: every write of a step carries idem <run>:<pass>:<step>:<n>", writes(two.rec).every((c) => /^RUN-W:\d+:[a-z-]+:\d+\.[0-9a-f]{8}$/.test(c.body?.idem ?? c.query?.idem)), true);
  t("R54: the step re-run after the stop sends its writes under the same keys (the four spawns)", keys(two.rec, "airunspawn"), keys(one.rec, "airunspawn"));
  t("R54: and its model requests the same idempotency keys (the third level's turn)",
    [one.requests.find((q) => q.level === "document")?.headers["idempotency-key"], two.requests.find((q) => q.level === "document")?.headers["idempotency-key"]],
    ["RUN-W:0:fanout:document:turn:1", "RUN-W:0:fanout:document:turn:1"]);
  const a = await segment({ remoteCfg: { answer: answers([{ name: "c-a", description: "a", level: "meaning" }]) } });
  const b = await segment({ remoteCfg: { answer: answers([{ name: "c-b", description: "b", level: "meaning" }]) } });
  t("R54 (control): a changed candidate carries a new idem; the same one the same", [keys(a.rec, "suggest")[0] !== keys(b.rec, "suggest")[0],
    keys(a.rec, "suggest")[0] === keys((await segment({ remoteCfg: { answer: answers([{ name: "c-a", description: "a", level: "meaning" }]) } })).rec, "suggest")[0]], [true, true]);
}

console.log("\n--- R53 · a notice before a new recipient ---");
{
  const r = await segment({ acct: account({ entries: ["gen-one", "route-cheap"] }), remoteCfg: { answer: answers() } });
  t("R53: a sub-session entry chosen by cost on an undisclosed host stops the segment before its call, naming the recipient; nothing is written by the step",
    [r.out.aiStop?.reason, r.out.aiStop?.recipient, r.requests.map((q) => q.final), r.requests.some((q) => q.url.includes("route.")), r.rec.log.some((e) => /sub-session/.test(e.subject))],
    ["disclosure", { provider: "fakeco", host: "fakeroute" }, ["judge_plan"], false, false]);
  const ok = await segment({ acct: account({ entries: ["gen-one", "route-cheap"], disclosed: [FAKECO, { provider: "fakeco", host: "fakeroute" }] }), remoteCfg: { answer: answers() } });
  t("R53 (control): a disclosed host proceeds", [ok.out.aiStop, ok.requests.filter((q) => q.url.includes("route.")).length > 0], [null, true]);
}

console.log("\n--- R55 · the run record is the source of truth ---");
{
  const run = (entries, plane = {}, extra = {}, maxSteps = 400) => segment({ acct: account({ entries }), plane, maxSteps, remoteCfg: { answer: answers(), extra } });
  const whole = await run(["gen-one"]);
  const begun = await run(["gen-one"], {}, {}, 3);
  const at = [...begun.rec.ticks].reverse().find((k) => k.state)?.state;
  const ended = await run(["msg-one"], { session: { state: at } });
  /* labels excepted: they name the adapter that served, which is the point of the hop */
  const unlabelled = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === "produced_by" ? undefined : x)));
  const strip = (e) => { const { seq: _s, ...rest } = unlabelled(e); return rest; };
  const lastState = (rec) => [...rec.ticks].reverse().find((k) => k.state)?.state;
  t("R55: a run begun on one adapter (openai-compatible) and resumed on another (messages) gives the same published state, log entries and candidates as one run on the first",
    [unlabelled(lastState(ended.rec)), [...begun.rec.log, ...ended.rec.log].map(strip), [...begun.rec.wrote, ...ended.rec.wrote]],
    [unlabelled(lastState(whole.rec)), whole.rec.log.map(strip), whole.rec.wrote]);
  t("R55: the second adapter served the resumed segment", [...new Set(ended.requests.map((q) => q.url.includes("/messages")))], [true]);
  const sess = await run(["gen-one"], {}, { session_id: "sess-PROVIDER-HELD", conversation_id: "conv-PROVIDER-HELD", previous_response_id: "resp-PROVIDER-HELD" });
  t("R55 (control): an adapter answering a session, conversation and response id leaves none in any tick, and no request asks the host to hold state",
    [JSON.stringify(sess.rec.ticks).includes("PROVIDER-HELD"), sess.requests.some((q) => "session_key" in q.body || "store" in q.body && q.body.store === true)], [false, false]);
}

console.log("\n--- R56 · labels travel with the result, and survive a hop ---");
{
  const label = (rec) => (rec.suggested || []).map((s) => [s.name, (s.produced_by || []).map((l) => l.model_version)]);
  const before = await segment({ acct: account({ entries: ["gen-one"] }), remoteCfg: { answer: answers([{ name: "before-hop", description: "b", level: "meaning" }]) } });
  const after = await segment({ acct: account({ entries: ["gen-two"], account_id: "acct-2" }), remoteCfg: { answer: answers([{ name: "after-hop", description: "a", level: "meaning" }]) } });
  t("R56: a candidate names the conversation that produced it, the old producer before the hop and the new after",
    [label(before.rec), label(after.rec)], [[["before-hop", ["fake-model-gen-one"]]], [["after-hop", ["fake-model-gen-two"]]]]);
  t("R56: the label is the one agent-model answered, copied unchanged",
    JSON.stringify(before.rec.suggested?.[0]?.produced_by?.[0]) === JSON.stringify(before.rec.ticks.find((k) => k.usage)?.usage[0].label), true);
  t("R56: a report's log entry carries produced_by", before.rec.log.filter((e) => /sub-session/.test(e.subject)).every((e) => Array.isArray(e.produced_by) && e.produced_by.length === 1), true);
  const empty = await segment({ remoteCfg: { answer: reading("LOOKED_ABSENT", [{ name: "judged-one", description: "j", level: "content" }]) } });
  const le = (empty.rec.suggested || []).filter((s) => /^level-empty-/.test(s.name));
  t("R56 (control): a script-made candidate (level-empty) names no AI, beside a judged one that does",
    [le.length > 0, le.every((s) => !("produced_by" in s)), (empty.rec.suggested || []).find((s) => s.name === "judged-one")?.produced_by?.length], [true, true, 1]);
}

console.log("\n--- R57 · never a silent degrade ---");
{
  const at = { ...SCOPED, step: "compose", pass: 0 };
  const r = await segment({ plane: { session: { state: at } }, acct: account({ entries: ["gen-notools", "gen-one"] }), remoteCfg: { answer: answers() } });
  t("R57: an entry without tools stops compose (reason capability) and runs it under no other prompt or entry",
    [r.out.aiStop?.reason, r.out.aiStop?.control, r.requests.length, r.rec.calls.some((c) => c.op === "suggest")], ["capability", "tools", 0, false]);
  const ok = await segment({ plane: { session: { state: at } }, acct: account({ entries: ["gen-one", "gen-notools"] }), remoteCfg: { answer: answers() } });
  t("R57 (control): a capable entry runs it", [ok.out.aiStop, ok.requests.map((q) => q.final)[0]], [null, "judge_compose"]);
}

/* the secret handed with the account reaches only the provider's own header */
t("no tick carries the account's secret", [segment].length === 1 && !JSON.stringify((await segment({ remoteCfg: { answer: answers() } })).rec.ticks).includes(SECRET), true);

console.log(`\nt53 provider: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
