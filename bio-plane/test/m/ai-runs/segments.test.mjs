/* ai-runs T53 (K5457): a run's segments, its hops and what holds it — R83, R84, R90–R98, R101–R103, R105, and R52 after a
   hop — at the module's interface over the real modules it uses (./world.mjs), a member's run dispatched to a stub
   agent-worker binding that accepts each segment (agent-worker R91: 202 {accepted: true}). Where a requirement's own test
   names a stub (`hopFor`, `aipathready`), the stub stands at that one seam and answers in the provider's stated shape. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, T0, ENTRY, ENTRIES, LABEL, agentWorker } from "./world.mjs";
import { AiRuns, DECLARED_OPS, aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";

const ACCEPT = { status: 202, body: { accepted: true, run_id: "R1" } };
const STORE = { idFromName: (n) => `id:${n}` };
const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const TICK = { caller: "member:ann", viewer: "member:ann", actor: "member:ann" };
const at = (m) => new Date(Date.parse(T0) + m * 60000).toISOString().replace(/\.\d+Z$/, "Z");

/** A world where ann's own run R1 over her project (bob cannot see it) is dispatched once on her first own account, each
 *  of her `own` accounts holding the one entry claude-a, so a hop is a move to another account. */
async function segWorld({ own = 2, team = false, env = {}, open = {} } = {}) {
  const aw = agentWorker(ACCEPT);
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50", ...env } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  for (let i = 0; i < own; i++) await w.account("ann", "apikey", `secret-${i}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  if (team) await w.team({ members: ["ann"] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann");
  const o = await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, at: T0, ...ANN, ...open }));
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 });
  assert.equal(d.dispatched, true, JSON.stringify(d).slice(0, 300));
  return { w, aw };
}
const stop = (w, reason, more = {}, m = 1) => w.runs.tickAndContinue({ run: "R1", ...TICK, at: at(m),
  segment_end: { by: "ai", done: false, refusals: [], ai_stop: { reason, class: "rate_limit", ...more } } });
const segs = (w) => w.rows(`SELECT * FROM ai_run_segments WHERE run = 'R1' ORDER BY n`);
const log = (w) => w.rows(`SELECT detail, level FROM observation_log WHERE authority = 'R1' ORDER BY seq`);
/** ai-accounts R50's answer for a next pair, onto the team's account held in `w`, as a stub of the one seam R93 names. */
const teamHop = (w) => ({ ok: true, account_id: w.accountsOf("group")[0], entry_id: ENTRIES.a, level: "group", owner: "group",
                          means: "sealed", payer_change: { from_owner: "member:ann", to_owner: "group" } });

test("R91, R92, R101 (T53; AIR25, BR19, DEC-466 U2): a two-segment run lists both rows and its labels to its member — the first written at the first dispatch, the second by a limit hop onto her next account, recorded with its reason, the accounts and entries and no payer change; each segment keeps its first conversation's label and its account as {level, provider, plan}; control: a viewer outside the run's sight reads found: false", async () => {
  const { w, aw } = await segWorld();
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(0), usage: [ENTRY("check", {}, 1, { label: { effort: "low" } }), ENTRY()] }).ticked, true);
  const hop = await stop(w, "limit");
  assert.equal(hop.segment_end.stop.decision, "hopped", JSON.stringify(hop.segment_end).slice(0, 400));
  assert.equal(aw.calls.length, 2);
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(2), usage: [ENTRY("check", {}, 1, { label: { effort: "high" } })] }).ticked, true);
  const rows = segs(w);
  assert.deepEqual(rows.map((r) => r.n), [1, 2]);
  const [a1, a2] = w.accountsOf("member:ann");
  assert.deepEqual(rows.map((r) => r.account_id), [a1, a2]);
  assert.deepEqual(rows.map((r) => [r.level, r.provider, r.plan]), [["member", "anthropic", "api-member"], ["member", "anthropic", "api-member"]]);
  assert.equal(rows[0].hop_in, null);
  const h = JSON.parse(rows[1].hop_in);
  assert.deepEqual([h.reason, h.from.account_id, h.to.account_id, h.from.entry_id, h.to.entry_id, h.payer_change], ["limit", a1, a2, ENTRIES.a, ENTRIES.a, null]);
  assert.equal(JSON.parse(rows[0].label).effort, "low", "the first conversation's label");
  assert.equal(JSON.parse(rows[1].label).effort, "high");
  assert.equal(JSON.parse(rows[0].label).effort, "low", "the first part's label is not rewritten when the second dispatches");
  const s = (await w.runs.read({ run: "R1", viewer: "member:ann" })).session;
  assert.deepEqual(s.segments.map((x) => [x.n, x.account_id, x.hop_in && x.hop_in.reason]), [[1, a1, null], [2, a2, "limit"]]);
  assert.deepEqual(s.labels.map((l) => [l.label.effort, l.segments]), [["low", [1]], [null, [1]], ["high", [2]]]);
  assert.equal(JSON.stringify(s.segments).includes("secret"), false, "no secret in a segment");
  const unseen = await w.runs.read({ run: "R1", viewer: "member:bob" });
  assert.deepEqual([unseen.found, unseen.session], [false, null]);
});

test("R92 (T53) control: a resume on the same account records no hop — a segment ending on its own bound, the run not done, is dispatched again on the account it ran on with hop_in null", async () => {
  const { w, aw } = await segWorld();
  const t = await w.runs.tickAndContinue({ run: "R1", ...TICK, at: at(1), segment_end: { by: null, done: false, refusals: [] } });
  assert.equal(t.segment_end.dispatch.dispatched, true, JSON.stringify(t.segment_end));
  assert.equal(aw.calls.length, 2);
  assert.deepEqual(segs(w).map((r) => [r.n, r.account_id, r.hop_in]), [[1, w.accountsOf("member:ann")[0], null], [2, w.accountsOf("member:ann")[0], null]]);
});

test("R84 (T53; AIR25, AIR28): a segment's end with ai_stop is appended at level meaning with its reason and class in detail, and R84 does not dispatch it again — R93 decides; control: a segment ending on its own bound is dispatched again as before", async () => {
  const { w, aw } = await segWorld({ own: 1 });
  const t = await stop(w, "unavailable", { class: "circuit_open" });
  assert.equal(t.segment_end.next, "stop");
  assert.notEqual(t.segment_end.stop.decision, "continued");
  const e = log(w).find((r) => /ai_stop unavailable \(circuit_open\)/.test(r.detail));
  assert.ok(e, JSON.stringify(log(w)));
  assert.equal(e.level, "meaning");
  assert.equal(aw.calls.length, 1, "not dispatched again by R84");
});

test("R93 (T53; AIR27, BR18): the hop is ai-accounts' decision — a next account answered by hopFor is dispatched; LIST_EXHAUSTED holds the run with the key's words in its log, never looped or closed; control: a use switched off gets the refusal and no dispatch", async () => {
  const one = await segWorld({ own: 1 });
  const held = await stop(one.w, "limit");
  assert.deepEqual([held.segment_end.stop.decision, held.segment_end.stop.code], ["held", "LIST_EXHAUSTED"]);
  assert.equal(one.aw.calls.length, 1);
  assert.ok(log(one.w).some((r) => r.detail.includes(word("ai.refused.listexhausted"))), "the refusal is in the log");
  assert.equal(one.w.row(`SELECT status FROM ai_runs WHERE run='R1'`).status, "running", "held, not closed");
  const off = await segWorld();
  off.w.uses("member:ann", "run", false, "ann");
  const r = await stop(off.w, "limit");
  assert.deepEqual([r.segment_end.stop.decision, r.segment_end.stop.code], ["held", "AI_USE_SWITCHED_OFF"]);
  assert.equal(off.aw.calls.length, 1, "no dispatch");
  /* a stub hopFor answering a next account (here the team's, the same payer for the test's sake) dispatches it */
  const s = await segWorld({ team: true });
  s.w.aiAccounts.hopFor = () => ({ ...teamHop(s.w), payer_change: null });
  assert.equal((await stop(s.w, "auth")).segment_end.stop.decision, "hopped");
  assert.equal(s.aw.calls.length, 2);
  assert.equal(s.aw.calls[1].body.account.account_id, s.w.accountsOf("group")[0]);
});

test("R94, R102 (T53; BR19, AD37, K5477): a payer-changing hop waits for the member — no dispatch until her aicontinue, another member's answer AI_RUN_NOT_PRINCIPAL; accepted, it dispatches and records the hop with payer_change {from_level: member, to_level: group}; her aistop instead ends the run cancelled with its partial results kept and writes end_refusal on the segment she would have continued from; control: aicontinue writes no end_refusal", async () => {
  const { w, aw } = await segWorld({ own: 1, team: true });
  w.runs.tick({ run: "R1", ...TICK, at: at(0), log: [{ level: "document", subject: PROJ, state: "LOOKED_ABSENT", detail: "found nothing yet" }] });
  w.aiAccounts.hopFor = () => teamHop(w);
  const t = await stop(w, "limit");
  assert.equal(t.segment_end.stop.decision, "offered");
  assert.deepEqual(t.segment_end.stop.payer_change, { from_level: "member", to_level: "group" });
  assert.equal(aw.calls.length, 1, "waits for her");
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: "member:ann" })).session.held.choices, ["aicontinue", "aistop"]);
  const other = await w.op("aicontinue", { actor: "member:bob", viewer: "member:bob" }, { run: "R1" });
  assert.notEqual(other.acted, true);
  const ok = await w.op("aicontinue", { actor: "member:ann", viewer: "member:ann" }, { run: "R1" });
  assert.equal(ok.dispatched, true, JSON.stringify(ok));
  assert.equal(aw.calls.length, 2);
  const parts = w.runs.runParts({ run: "R1", viewer: "member:ann" });
  assert.deepEqual(parts.parts.map((p) => p.hop_in && p.hop_in.payer_change), [null, { from_level: "member", to_level: "group" }]);
  assert.deepEqual(parts.parts.map((p) => p.end_refusal), [null, null], "aicontinue writes none");
  /* her aistop instead */
  const d = await segWorld({ own: 1, team: true });
  d.w.runs.tick({ run: "R1", ...TICK, at: at(0), log: [{ level: "document", subject: PROJ, state: "LOOKED_ABSENT", detail: "partial" }] });
  d.w.aiAccounts.hopFor = () => teamHop(d.w);
  await stop(d.w, "limit");
  const declined = await d.w.op("aistop", { actor: "member:ann", viewer: "member:ann" }, { run: "R1" });
  assert.deepEqual([declined.acted, declined.bound], [true, "cancelled"], JSON.stringify(declined));
  assert.equal(d.aw.calls.length, 1);
  assert.ok(log(d.w).some((r) => r.detail === "partial"), "partial results kept");
  const dp = d.w.runs.runParts({ run: "R1", viewer: "member:ann" }).parts;
  assert.deepEqual([dp.length, dp[0].end_refusal.by, dp[0].end_refusal.reason, dp[0].end_refusal.payer_change],
                   [1, "member:ann", "limit", { from_level: "member", to_level: "group" }]);
  assert.deepEqual([dp[0].end_refusal.from.level, dp[0].end_refusal.to.level], ["member", "group"]);
});

test("R103 (T53; DEC-466 U2): runParts answers how a run went to its member and the paying owner — parts in order with their labels, account levels and instants, the hop that began each; a one-part run answers one part with hop_in null; control: a member who cannot see the run gets found: false and no part, a body naming a viewer is ignored, nothing in the answer is an id or a secret, an unreadable store answers unreadable", async () => {
  const one = await segWorld();
  const p1 = one.w.runs.runParts({ run: "R1", viewer: "member:ann" });
  assert.deepEqual([p1.found, p1.parts.length, p1.parts[0].hop_in, p1.truncated], [true, 1, null, false]);
  const { w } = await segWorld({ own: 3 });
  w.runs.tick({ run: "R1", ...TICK, at: at(0), usage: [ENTRY()] });
  await stop(w, "limit", {}, 1);
  await stop(w, "unavailable", {}, 2);
  const p = await w.op("airunparts", { viewer: "member:ann" }, { run: "R1", viewer: "member:bob" });
  assert.deepEqual([p.found, p.status, p.parts.map((x) => x.n)], [true, "running", [1, 2, 3]]);
  assert.deepEqual(p.parts.map((x) => x.hop_in && x.hop_in.reason), [null, "limit", "unavailable"]);
  assert.deepEqual(p.parts[0].label, { display_name: w.catalogue.entryOf(ENTRIES.a).display_name, provider: "anthropic", model_version: "model-claude-a" });
  assert.deepEqual(p.parts.map((x) => [x.account.level, x.account.provider, x.account.plan, x.account.own]),
                   [["member", "anthropic", "api-member", true], ["member", "anthropic", "api-member", true], ["member", "anthropic", "api-member", true]]);
  assert.ok(p.parts.slice(0, 2).every((x) => typeof x.from === "string" && typeof x.to === "string"));
  const text = JSON.stringify(p);
  for (const id of w.accountsOf("member:ann")) assert.equal(text.includes(id), false, "no account id");
  assert.equal(/secret/i.test(text), false, "no secret");
  assert.deepEqual(await w.op("airunparts", { viewer: "member:bob" }, { run: "R1" }), { found: false, parts: [] });
  w.sql.exec(`DROP TABLE ai_run_segments`);
  assert.deepEqual(w.runs.runParts({ run: "R1", viewer: "member:ann" }), { unreadable: true, parts: null });
});

test("R95, R98 (T53; AIR27, AIR28, BR28): a non-interactive run held after a stop with nowhere to go resumes by itself when op=aipathready answers ready — the probe dispatches nothing while it answers open, once when ready; a run a member started is held with her three choices, never resumed by the probe, and aiwithout closes it with its partial results; with nothing held wake is null", async () => {
  /* an exploring run (non-interactive): check verified live, so investigate's chain holds */
  const aw = agentWorker(ACCEPT);
  const st = stepsWorld();
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50" }, steps: st.steps });
  await w.group("ann", { noAccount: ["ann"] });
  await w.account("ann", "apikey", undefined, { entries: [ENTRIES.a] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ run: "V", at: T0 }))).started, true);
  assert.equal(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  const x = await w.runs.open(OPEN({ run: "R1", origin: "explore", place: st.place, work: "find the fee schedule", at: T0, ...ANN }));
  assert.equal(x.started, true, JSON.stringify(x).slice(0, 300));
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  const probe = w.runs.healthProbe();
  assert.equal(probe.wake(Date.parse(T0)), null, "nothing held: wake is null");
  const states = { s: "open" };
  w.setPath(() => ({ state: states.s }));
  assert.equal((await stop(w, "unavailable")).segment_end.stop.decision, "held");
  const now = Date.parse(at(1));
  assert.equal(probe.due(now), 1);
  assert.deepEqual(await probe.tick(now), { probed: 1, resumed: 0, still_down: 1, remaining: 0 });
  assert.equal(aw.calls.length, 1, "open: nothing dispatched");
  assert.equal(probe.due(now), 0, "probed again only after the interval");
  states.s = "half_open";
  const later = now + AiRuns.PROBE_INTERVAL_MS;
  assert.deepEqual(await probe.tick(later), { probed: 1, resumed: 1, still_down: 0, remaining: 0 });
  assert.equal(aw.calls.length, 2, "ready: dispatched once");
  assert.equal(probe.wake(later), null);
  /* a run a member started: held with her three choices, never resumed by the probe */
  const m = await segWorld({ own: 1 });
  m.w.setPath(() => ({ state: "ok" }));
  await stop(m.w, "unavailable");
  const held = (await m.w.runs.read({ run: "R1", viewer: "member:ann" })).session.held;
  assert.deepEqual([held.kind, held.choices], ["pause", ["ai.choice.wait", "ai.choice.switch", "ai.choice.without_ai"]]);
  const mp = m.w.runs.healthProbe();
  await mp.tick(Date.parse(at(5)));
  assert.equal(m.aw.calls.length, 1, "never resumed by the probe");
  m.w.runs.tick({ run: "R1", ...TICK, at: at(5), log: [{ level: "document", subject: PROJ, state: "LOOKED_ABSENT", detail: "partial" }] });
  const without = await m.w.op("aiwithout", { actor: "member:ann" }, { run: "R1" });
  assert.deepEqual([without.acted, without.bound], [true, "cancelled"]);
  assert.ok(log(m.w).some((r) => r.detail === "partial"));
});

test("R98 (T53; scheduler R8): the consumer is ai-health-probe under the answer key aihealthprobe, registered once into the scheduler's slot; an open pair is not probed before its reset_at; at most PROBE_BATCH pairs a firing", async () => {
  const { w } = await segWorld({ own: 1 });
  const held = [];
  const slot = { register: (module, c) => (held.some((h) => h.c.name === c.name) ? { ok: false, reason: "CONSUMER_DECLARED", module, name: c.name }
                                                                                    : (held.push({ module, c }), { ok: true, module, name: c.name, key: c.key })) };
  assert.deepEqual(w.runs.registerHealthProbe(slot), { ok: true, module: "ai-runs", name: "ai-health-probe", key: "aihealthprobe" });
  assert.equal(w.runs.registerHealthProbe(slot).reason, "CONSUMER_DECLARED");
  w.setPath(() => ({ state: "open" }));
  await stop(w, "limit", { retry_after: at(30) });
  const probe = w.runs.healthProbe();
  assert.equal(probe.due(Date.parse(at(10))), 0, "not before its reset_at");
  assert.equal(probe.wake(Date.parse(at(10))), Date.parse(at(30)));
  assert.equal(probe.due(Date.parse(at(30))), 1);
  assert.equal(AiRuns.PROBE_BATCH, 10);
});

test("R96 (T53; AD14, AD37): a notice before a new recipient holds the run — an ai_stop disclosure holds it; a dispatch is withheld RECIPIENT_NOTICE_DUE while ai-accounts records the notice unread, nothing sent; control: after her aisend (ai-accounts' act) it is dispatched once", async () => {
  const { w, aw } = await segWorld({ own: 1 });
  const t = await stop(w, "disclosure", { recipient: { provider: "anthropic", host: "anthropic" } });
  assert.deepEqual([t.segment_end.stop.decision, t.segment_end.stop.hold], ["held", "disclosure"]);
  /* the notice unread, as ai-accounts' record answers it (its R51) */
  const real = w.aiAccounts.recipientNoticeDue.bind(w.aiAccounts);
  w.aiAccounts.recipientNoticeDue = () => ({ ok: false, code: "RECIPIENT_NOTICE_DUE", recipient: { provider: "anthropic", host: "anthropic" } });
  const withheld = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(2) });
  assert.deepEqual([withheld.dispatched, withheld.dispatch.state, withheld.dispatch.withheld], [false, "WITHHELD", "RECIPIENT_NOTICE_DUE"]);
  assert.equal(aw.calls.length, 1, "nothing sent");
  w.aiAccounts.recipientNoticeDue = real;
  /* her aisend is ai-accounts' act (its R51), recording the notice read; the next dispatch then goes on */
  assert.equal(w.aiAccounts.recipientNoticeSeen({ member: "ann", provider: "anthropic", host: "anthropic", by: "ann" }).ok, true);
  const sent = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(3) });
  assert.equal(sent.dispatched, true, JSON.stringify(sent));
  assert.equal(aw.calls.length, 2, "one dispatch");
  assert.equal((await w.runs.read({ run: "R1", viewer: "member:ann" })).session.held, null, "the hold is cleared");
});

test("R97 (T53; AIR28): an AI path not ready withholds the dispatch — a stub aipathready answering auth_failed appends the resumable entry and the run is not dispatched, named AI_PATH_NOT_READY; control: ready dispatches", async () => {
  const { w, aw } = await segWorld({ own: 1 });
  const state = { s: "auth_failed" };
  w.setPath(() => ({ state: state.s }));
  const before = log(w).length;
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(1) });
  assert.deepEqual([r.dispatched, r.dispatch.withheld], [false, "AI_PATH_NOT_READY"]);
  assert.equal(aw.calls.length, 1);
  const added = log(w).slice(before);
  assert.equal(added.length, 1);
  assert.match(added[0].detail, /still resumable/);
  state.s = "ok";
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(2) })).dispatched, true);
  assert.equal(aw.calls.length, 2);
});

test("R105 (T53; K5489, DEC-475): wait a set time, then switch — a wait that ends still down switches with reason unavailable; a provider that recovers within the wait continues with no switch; a switch to another owner's account still waits for aicontinue; control: a wait not in WAIT_THEN_SWITCH_CHOICES is WAIT_INVALID and another member's choice is refused", async () => {
  assert.deepEqual(AiRuns.WAIT_THEN_SWITCH_CHOICES, [5, 15, 60]);
  const { w, aw } = await segWorld();
  const st = { s: "open" };
  w.setPath(() => ({ state: st.s }));
  await stop(w, "unavailable", {}, 1);
  /* the stop hopped already (a next account answers); hold it on the second account as a member's wait */
  assert.equal((await w.op("aiwaitswitch", { actor: "member:ann" }, { run: "R1", wait: 7 })).code, "WAIT_INVALID");
  assert.notEqual((await w.op("aiwaitswitch", { actor: "member:bob" }, { run: "R1", wait: 5 })).acted, true);
  /* a fresh run on ann's first of two accounts, its provider down: she waits 5 minutes then switches */
  const x = await segWorld();
  const first = x.w.accountsOf("member:ann")[0];
  x.w.setPath(({ account_id }) => ({ state: account_id === first ? st.s : "ok" }));
  const ws = x.w.runs.waitThenSwitch({ run: "R1", member: "member:ann", wait: 5, at: at(1) });
  assert.deepEqual([ws.acted, ws.wait_choice.wait, ws.wait_choice.member], [true, 5, "member:ann"]);
  assert.deepEqual(JSON.parse(x.w.row(`SELECT wait_choice FROM ai_runs WHERE run='R1'`).wait_choice).wait, 5);
  const probe = x.w.runs.healthProbe();
  await probe.tick(Date.parse(at(2)));
  assert.equal(x.aw.calls.length, 1, "within the wait, still down: no switch yet");
  await probe.tick(Date.parse(at(7)));
  assert.equal(x.aw.calls.length, 2, "the wait ended still down: switched");
  assert.equal(JSON.parse(segs(x.w)[1].hop_in).reason, "unavailable");
  /* recovered within the wait: continues on the same account, nothing switches */
  const y = await segWorld();
  const ys = { s: "open" };
  y.w.setPath(() => ({ state: ys.s }));
  y.w.runs.waitThenSwitch({ run: "R1", member: "member:ann", wait: 15, at: at(1) });
  ys.s = "ok";
  await y.w.runs.healthProbe().tick(Date.parse(at(3)));
  assert.equal(y.aw.calls.length, 2);
  assert.deepEqual(segs(y.w).map((r) => r.hop_in), [null, null], "no switch");
  /* a switch to another owner's account still waits for aicontinue */
  const z = await segWorld({ own: 1, team: true });
  z.w.setPath(() => ({ state: "open" }));
  z.w.aiAccounts.hopFor = () => teamHop(z.w);
  z.w.runs.waitThenSwitch({ run: "R1", member: "member:ann", wait: 5, at: at(1) });
  await z.w.runs.healthProbe().tick(Date.parse(at(7)));
  assert.equal(z.aw.calls.length, 1, "waits for her aicontinue");
  assert.equal((await z.w.runs.read({ run: "R1", viewer: "member:ann" })).session.held.kind, "hop_offer");
  void aw;
});

test("R83 (T53; AIR28): a held run's lease is extended up to pause_max from its stop — it survives past RUN_LEASE_MS; past pause_max it is reaped lease; control: a run not held is reaped at RUN_LEASE_MS", async () => {
  const { w } = await segWorld({ own: 1 });
  await stop(w, "limit", {}, 1);
  const stopped = Date.parse(at(1));
  assert.equal(w.runs.reap(stopped + AiRuns.RUN_LEASE_MS + 60000).reaped.length, 0, "survives past the lease");
  const r = w.runs.reap(stopped + AiRuns.PAUSE_MAX_MS + 60000);
  assert.deepEqual(r.reaped.map((x) => [x.run, x.bound]), [["R1", "lease"]]);
  const plain = await segWorld({ own: 1 });
  plain.w.runs.tick({ run: "R1", ...TICK, at: at(1) });
  assert.deepEqual(plain.w.runs.reap(Date.parse(at(1)) + AiRuns.RUN_LEASE_MS + 1000).reaped.map((x) => x.bound), ["lease"]);
});

test("R52 (T53; AIR26, BR19): after a hop the next account's own limits apply, never the first's — the team's limit spent refuses her tick once the run moved onto its account, her own spent limit does not; control: both under limit proceed", async () => {
  const { w } = await segWorld({ own: 1, team: true });
  w.aiAccounts.hopFor = () => teamHop(w);
  await stop(w, "limit", {}, 1);
  assert.equal((await w.op("aicontinue", { actor: "member:ann" }, { run: "R1" })).dispatched, true);
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(2), usage: [ENTRY()] }).ticked, true, "control: both under limit");
  const use = aiUseOf(w.ctx);
  assert.equal(use.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann", at: T0 }).ok, true);
  use.countUsage({ owner: "member:ann", member: "member:ann", use: "ask", mode: "ask", usage: ENTRY().usage, calls: 1, at: at(2) });
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(3) }).ticked, true, "the first account's limit does not hold it");
  assert.equal(use.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 1, by: "admin", at: T0 }).ok, true);
  const capped = w.runs.tick({ run: "R1", ...TICK, at: at(4) });
  assert.deepEqual([capped.ticked, capped.code], [false, "AI_LIMIT_REACHED"]);
  assert.equal(capped.whose, "group");
});

test("R90 (T53; T51, K4168): the module declares the assistant ops it serves — each held true against its arm by declaredOpHolds: with only its requires, without each, and with a field outside its accepts", async () => {
  /* aisend is ai-accounts' op (its R51, R61), so it is not declared twice */
  assert.equal("aisend" in DECLARED_OPS, false);
  for (const op of ["aicontinue", "aistop", "aiwait", "aiswitchaccount", "aiwithout", "aisendrefuse", "airunparts", "aiwaitswitch"]) {
    assert.ok(DECLARED_OPS[op], op);
    await declaredOpHolds({ op, declaration: DECLARED_OPS[op],
      call: async (fields) => { const { w } = await segWorld({ own: 1 });
        const url = new URL(`http://x/?${new URLSearchParams({ actor: "member:ann", viewer: "member:ann" })}`);
        return aiRunsOps(w.runs, url, fields)[op](); },
      refusedNaming: (answer, field) => (field === "run" && answer && answer.found === false) || (field === "wait" && answer && answer.code === "WAIT_INVALID"),
      values: { run: "R1", wait: 5 },
      /* the outcome, not the instants the clock stamped on it */
      same: (x, y) => !!x && !!y && x.acted === y.acted && x.found === y.found && x.code === y.code && x.dispatched === y.dispatched });
  }
});

test("R107 (T53; AIR25, BR29; agent-steps R56): a tick's report entry keeps who produced it — a run hopping between two entries appends entries naming each producer in the log, deduplicated; control: an entry made by a script has produced_by null, and one with a malformed label is refused AI_RUN_CONSUME_INVALID with the others appended", async () => {
  const aw = agentWorker(ACCEPT);
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", { noAccount: ["ann"] });
  await w.account("ann", "apikey", "secret-a-of-ann-0123456789", { entries: [ENTRIES.a] });
  await w.account("ann", "apikey", "secret-b-of-ann-0123456789", { entries: [ENTRIES.b] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ at: T0, ...ANN }))).started, true);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  const look = (detail, produced_by) => ({ level: "document", subject: INQ, state: "LOOKED_ABSENT", detail, ...(produced_by ? { produced_by } : {}) });
  const A = LABEL(ENTRIES.a), B = LABEL(ENTRIES.b);
  const t1 = w.runs.tick({ run: "R1", ...TICK, at: at(0), log: [look("by a", [A, A]), look("by a script")] });
  assert.deepEqual([t1.appended, t1.refused.length], [2, 0]);
  await stop(w, "limit", {}, 1);
  const t2 = w.runs.tick({ run: "R1", ...TICK, at: at(2), log: [look("by b", [B]), look("bad", [{ ...B, display_name: "Someone else" }]), look("by b too", [B])] });
  assert.deepEqual([t2.appended, t2.refused.map((r) => r.code)], [2, ["AI_RUN_CONSUME_INVALID"]]);
  const entries = w.runs.log({ run: "R1", viewer: "member:ann" }).entries.filter((e) => /^by /.test(e.detail));
  assert.deepEqual(entries.map((e) => [e.detail, e.produced_by && e.produced_by.map((l) => l.display_name)]),
                   [["by a", [A.display_name]], ["by a script", null], ["by b", [B.display_name]], ["by b too", [B.display_name]]]);
});
