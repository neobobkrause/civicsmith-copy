/* ai-runs T50 (T50-13; N1082, N1168, N1186; K3297, K3501 (f), K3557): R87, a member's dispatch carries the door's `trace` and
   `memberRef` as headers and nowhere else; R88, each usage entry's `effort` beside its `model`, and the run's cost by model and
   effort; R89, the project a run is opened in, recorded at the open and carried by the run's credential (credentials R79).
   Every refusal has a control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ANN, ORG, sha, agentWorker, USAGE, ENTRY } from "./world.mjs";
import { aiUseOf, AI_USE_TABLES } from "../../../src/ai-use/index.mjs";

const AW = (aw) => ({ AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" });
const SHAPE = /^aik-[0-9a-f]{64}$/;
const PA = "PROJ-2026-0001", PB = "PROJ-2026-0002";
const TRACE_H = "x-civicsmith-trace", REF_H = "x-civicsmith-member-ref";
const everything = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table'`)
  .map((t) => JSON.stringify(w.rows(`SELECT * FROM "${t.name}"`))).join("\n");
const runCreds = (w, run = "R1") => w.rows(`SELECT token_id, secret_sha, principal, project, run FROM ai_credentials WHERE run = ? ORDER BY rowid`, run);

/** `second` (an administrator) holds her own sign-in; INQ is drawn on by A and B, both of which she has joined; one record belongs
 *  to each project and one to none. Her run R1 is opened by her own session, in `project` when given. */
async function projectWorld(aw, { project, open = true, env = {}, ...opts } = {}) {
  const w = world({ env: { ...AW(aw), ...env }, ...opts });
  await w.group("ann", "bob", { noAccount: ["second"] });
  await w.signin("second");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  w.project(PA, "ann", { joined: ["second"] });
  w.project(PB, "ann", { joined: ["second"] });
  w.cites(PA, INQ); w.cites(PB, INQ);
  for (const [id, p] of [["recA", PA], ["recB", PB], ["recNone", null]]) w.bundle(id, "finding", null, p);
  const mine = { principalPlane: "member:second", principalAi: "member:second", actor: "member:second", viewer: "member:second" };
  if (open) {
    const o = await w.runs.open(OPEN({ ...mine, ...(project === undefined ? {} : { project }) }));
    assert.equal(o.started, true, JSON.stringify(o));
  }
  return { w, mine };
}
const seen = (w, viewer) => ["recA", "recB", "recNone"].map((id) => w.membership.inSight(id, viewer));

/* ---- R87 ---- */

test("R87: dispatchMemberRun carries the door's trace and memberRef in x-civicsmith-trace and x-civicsmith-member-ref, in no body or address; neither value is written to the run, its log or any answer; control: with none handed neither header is sent", async () => {
  const aw = agentWorker();
  const { w } = await projectWorld(aw);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:second", trace: "tr-0123456789abcdef", memberRef: "mref-fedcba9876543210" });
  assert.equal(d.dispatched, true, JSON.stringify(d));
  assert.equal(aw.calls.length, 1);
  assert.equal(aw.calls[0].headers[TRACE_H], "tr-0123456789abcdef");
  assert.equal(aw.calls[0].headers[REF_H], "mref-fedcba9876543210");
  assert.equal(aw.calls[0].headers["content-type"], "application/json");
  const text = JSON.stringify(aw.calls[0].body) + aw.calls[0].url;
  assert.equal(/tr-0123456789abcdef|mref-fedcba9876543210/.test(text), false, "neither is in the body or the address");
  assert.equal(/tr-0123456789abcdef|mref-fedcba9876543210/.test(everything(w)), false, "no row of any table holds either");
  assert.equal(/tr-0123456789abcdef|mref-fedcba9876543210/.test(JSON.stringify(d)), false, "no answer does");
  assert.equal(JSON.stringify(w.runs.log({ run: "R1", viewer: "admin" })).includes("tr-0123456789abcdef"), false);
  /* control: none handed, neither header */
  const aw2 = agentWorker();
  const c = await projectWorld(aw2);
  assert.equal((await c.w.runs.dispatchMemberRun({ run: "R1", by: "member:second" })).dispatched, true);
  assert.deepEqual(Object.keys(aw2.calls[0].headers), ["content-type"]);
});

test("R87 (controls): a value that is not a non-empty printable string of at most 200 characters is not sent, the other header still is; the continuation (R84) and the wake hand none and send neither", async () => {
  const aw = agentWorker();
  const { w } = await projectWorld(aw);
  for (const bad of ["", " ", "has space", "tab\there", "é".repeat(3), "x".repeat(201), 7, {}, ["a"], null, undefined]) {
    aw.calls.length = 0;
    await w.runs.dispatchMemberRun({ run: "R1", by: "member:second", trace: bad, memberRef: "ok-ref" });
    assert.deepEqual(Object.keys(aw.calls[0].headers).sort(), ["content-type", REF_H].sort(), JSON.stringify(bad));
  }
  aw.calls.length = 0;
  await w.runs.dispatchMemberRun({ run: "R1", by: "member:second", trace: "x".repeat(200), memberRef: "y" });
  assert.equal(aw.calls[0].headers[TRACE_H].length, 200, "200 characters are allowed");
  /* R84's continuation hands the door's values on to no one: a segment ending on its own bound is dispatched again with neither */
  aw.calls.length = 0;
  const stamp = "member:second";
  const t = await w.runs.tickAndContinue({ run: "R1", segment_end: { by: null, done: false, refusals: [] }, caller: stamp, viewer: stamp, actor: stamp });
  assert.equal(t.segment_end.dispatch.dispatched, true, JSON.stringify(t.segment_end));
  assert.equal(aw.calls.length, 1);
  assert.deepEqual(Object.keys(aw.calls[0].headers), ["content-type"], "the continuation sends neither header");
  /* the wake's dispatch of an organisation run: neither */
  const TOKEN = "instance-ai-secret-value-r87";
  const aw2 = agentWorker();
  const x = world({ env: { ...AW(aw2), INSTANCE_AI_TOKEN: TOKEN } });
  await x.group("ann");
  x.bundle(INQ);
  x.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  const cred = x.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  x.ctx.id = { equals: (v) => v === "id:bio" };
  await x.runs.open(OPEN({ principalPlane: `${cred.principal}/${cred.tokenId}` }));
  const reqs = [{ request: "q1", state: "captured" }];
  x.runs.registerWaitSource("capture-requests", { tickMs: () => 5000, holds: () => [], woken: () => (reqs[0].woken ? [] : ["R1"]),
    completions: () => reqs.filter((q) => !q.woken), markWoken: () => { reqs[0].woken = true; } });
  await x.runs.wake(Date.parse("2026-07-01T00:00:10Z"));
  assert.equal(aw2.calls.length, 1);
  assert.deepEqual(Object.keys(aw2.calls[0].headers), ["content-type"], "the wake sends neither header");
});

/* ---- R88 ---- (ai-use R15, merged: the real module, reached through its factory on the world's storage) */

/* (T53; R72, R104) the model and effort ride on the conversation's label (agent-model R26) */
const entry = (model, effort, calls = 1) => ENTRY("check", {}, calls, { label: { model_version: model, effort: effort === undefined ? null : effort } });
const at = (s) => `2026-07-01T${s}Z`;

test("R88: each usage entry's effort is passed to ai-use.countUsage beside its model, an entry stating none as null; session.cost and the close's cost carry ai-use's by_entry, to the paying account's owner alone; nothing of it reaches the run's log", async () => {
  const w = world();
  await w.group("ann", "bob"); w.bundle(INQ);
  aiUseOf(w.ctx);
  assert.equal((await w.runs.open(OPEN())).started, true);
  const logBefore = w.rows(`SELECT * FROM observation_log`);
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"),
    usage: [entry("claude-sonnet-5-5", "low", 2), entry("claude-opus-5-5", "medium"), entry("claude-sonnet-5-5", "low"), entry("claude-haiku-5-5")] });
  assert.deepEqual([t.ticked, t.counted], [true, 4], JSON.stringify(t));
  assert.deepEqual(w.rows(`SELECT * FROM observation_log`), logBefore, "no entry for the conversations");
  assert.equal(/claude-opus-5-5|medium/.test(JSON.stringify(w.rows(`SELECT * FROM ai_runs`))), false, "nothing of it on the run");
  const owner = (await w.runs.read({ run: "R1", viewer: ANN })).session.cost;
  /* (ai-use T53, its R15) the conversations as by_entry, each {entry_id, label, calls}: the model and effort on its label */
  assert.deepEqual(owner.by_entry.map((e) => [e.entry_id, e.label.model_version, e.label.effort, e.calls]),
                   [["claude-a", "claude-sonnet-5-5", "low", 3], ["claude-a", "claude-opus-5-5", "medium", 1], ["claude-a", "claude-haiku-5-5", null, 1]]);
  assert.equal(owner.calls, 5, "their calls sum to the cost's calls");
  /* a non-owner who sees the run reads no cost at all */
  for (const viewer of ["member:bob", "admin"]) assert.equal("cost" in (await w.runs.read({ run: "R1", viewer })).session, false, viewer);
  const closed = await w.runs.close({ run: "R1", bound: "completed", caller: ORG, viewer: ANN, at: at("00:06:00") });
  assert.deepEqual([closed.terminated, closed.cost.final, closed.cost.by_entry.length], [true, true, 3]);
  /* control: a close read by another member carries no cost, hence no by_entry */
  await w.runs.open(OPEN({ run: "R2" }));
  await w.runs.tick({ run: "R2", viewer: "admin", caller: ORG, at: at("00:07:00"), usage: [entry("claude-sonnet-5-5", "low")] });
  assert.equal("cost" in (await w.runs.close({ run: "R2", bound: "completed", caller: ORG, viewer: "member:bob", at: at("00:08:00") })), false);
});

test("R88 (control): an entry whose effort is not a lowercase word is refused AI_RUN_CONSUME_INVALID by ai-use, the whole tick counting and writing nothing; an entry stating neither model nor effort is kept as null and null", async () => {
  const w = world();
  await w.group("ann"); w.bundle(INQ);
  aiUseOf(w.ctx);
  await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 9 }] }));
  const all = () => `${w.dump()}\n${AI_USE_TABLES.map((t) => JSON.stringify(w.rows(`SELECT * FROM ${t.name} ORDER BY rowid`))).join("\n")}`;
  const before = all();
  for (const effort of ["Low!", "LOW", "low medium", "", 3, "x".repeat(17), {}]) {
    const r = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"),
      consume: { fetches: 1 }, usage: [entry("claude-sonnet-5-5", "low"), entry("claude-opus-5-5", effort)] });
    assert.deepEqual([r.ticked, r.code], [false, "AI_RUN_CONSUME_INVALID"], JSON.stringify(effort));
    assert.match(r.detail, /^usage entry 2:/);
  }
  assert.equal(all(), before, "nothing written: no entry, no figure, no tick, nothing counted");
  const kept = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:06:00"),
    usage: [ENTRY("check", {}, 1, { label: { model_version: null } })] });
  assert.equal(kept.ticked, true, JSON.stringify(kept));
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: ANN })).session.cost.by_entry.map((e) => [e.label.model_version, e.label.effort, e.calls]), [[null, null, 1]]);
});

/* ---- R89 ---- */

test("R89: a run opened in project A on a question A and B both draw on records A; read and runFor answer it; the run's credential, minted for an administrator, makes a viewer that sees A's records and not B's nor those of no project", async () => {
  const aw = agentWorker();
  const { w } = await projectWorld(aw, { project: PA });
  assert.equal(w.row(`SELECT project FROM ai_runs WHERE run='R1'`).project, PA, "recorded at the open");
  assert.equal((await w.runs.read({ run: "R1", viewer: "member:second" })).session.project, PA);
  assert.equal(w.runs.runFor("R1", "member:second").project, PA);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:second" });
  assert.equal(d.dispatched, true, JSON.stringify(d));
  const sent = aw.calls[0].body.credential;
  assert.match(sent, SHAPE);
  const c = w.credentials.aiCredentialLook({ secretSha: sha(sent) }).credential;
  assert.equal(c.project, PA);
  assert.deepEqual(seen(w, c.principal), [true, false, false], "A's records only: not B's, not a record of no project");
  assert.deepEqual(runCreds(w).map((r) => r.project), [PA]);
  /* never changes: a second dispatch is the same project; the run's row is as it was */
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:second" })).dispatched, true);
  assert.deepEqual(runCreds(w).map((r) => r.project), [PA, PA]);
  assert.equal(JSON.stringify(d).includes(sent), false);
  /* B is as good: the project is the opener's word, of the projects she has joined that draw on the question */
  const b = await projectWorld(agentWorker(), { open: false });
  assert.equal((await b.w.runs.open(OPEN({ ...b.mine, project: PB }))).project, PB, "the open's answer states it");
});

test("R89: a run over a project is in that project whatever is sent; control: a run opened with no project records none and its credential carries none, the viewer plain and sees B's records", async () => {
  const aw = agentWorker();
  const none = await projectWorld(aw);
  assert.equal(none.w.row(`SELECT project FROM ai_runs WHERE run='R1'`).project, null);
  assert.equal(none.w.runs.runFor("R1", "member:second").project, null);
  assert.equal((await none.w.runs.read({ run: "R1", viewer: "member:second" })).session.project, null);
  assert.equal((await none.w.runs.dispatchMemberRun({ run: "R1", by: "member:second" })).dispatched, true);
  const c = none.w.credentials.aiCredentialLook({ secretSha: sha(aw.calls[0].body.credential) }).credential;
  assert.deepEqual([c.project, c.principal], [null, "member:second"]);
  assert.deepEqual(seen(none.w, c.principal), [true, true, true]);
  assert.deepEqual(runCreds(none.w).map((r) => r.project), [null]);
  /* a project context: that project, whatever `project` carries (a project other than the context is not read) */
  const p = await projectWorld(agentWorker(), { open: false });
  const o = await p.w.runs.open(OPEN({ ...p.mine, run: "RP", contextType: "project", contextId: PA, project: PB }));
  assert.equal(o.started, true, JSON.stringify(o));
  assert.equal(o.project, PA);
  assert.equal(p.w.row(`SELECT project FROM ai_runs WHERE run='RP'`).project, PA);
});

test("R89 (controls): a project the member has not joined, one that does not draw on the question, one that is absent, and a machine's naming one are each refused AI_RUN_NOT_PROJECT_MEMBER and no run is written; the project the member has joined opens", async () => {
  const aw = agentWorker();
  const { w, mine } = await projectWorld(aw, { open: false });
  const PC = "PROJ-2026-0003", PD = "PROJ-2026-0004";
  w.project(PC, "ann", { joined: [], invited: ["second"], discoverable: true });   // drawn on, invited only
  w.cites(PC, INQ);
  w.project(PD, "ann", { joined: ["second"] });                                     // joined, but draws on nothing here
  const before = w.dump();
  for (const [what, project, over] of [["not joined", PC, {}], ["not drawn on", PD, {}], ["absent", "PROJ-2099-0001", {}],
                                       ["a machine's", PA, { actor: "", principalPlane: ORG, principalAi: undefined, viewer: "admin" }],
                                       ["a member who never joined", PA, { actor: "member:bob", principalPlane: "member:bob", principalAi: "member:bob", viewer: "member:bob" }]]) {
    const r = await w.runs.open(OPEN({ ...mine, project, ...over }));
    assert.deepEqual([what, r.started, r.code], [what, false, "AI_RUN_NOT_PROJECT_MEMBER"], JSON.stringify(r).slice(0, 200));
    assert.equal(typeof r.translation, "string");
  }
  assert.equal(w.dump(), before, "no run, bound or log entry on any refusal");
  assert.equal(w.count("ai_runs"), 0);
  /* control: the project she has joined and that draws on the question opens */
  assert.equal((await w.runs.open(OPEN({ ...mine, project: PA }))).started, true);
});

test("R89 (controls): a mint refused leaves the answer unchanged and nothing sent; a run whose member left the project is refused by the mint (PROJECT_ACT_NOT_A_PARTICIPANT), not dispatched under a wider viewer", async () => {
  const aw = agentWorker();
  const { w } = await projectWorld(aw, { project: PA });
  const refusal = { ok: false, code: "PROJECT_ACT_NOT_A_PARTICIPANT", check: "C-x", translation: "t", detail: "d", reason: "PROJECT_ACT_NOT_A_PARTICIPANT" };
  w.credentials.aiRunCredentialMint = (a) => { assert.equal(a.project, PA, "the mint is asked with the run's project"); return refusal; };
  const before = w.dump();
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:second" });
  assert.deepEqual([r.dispatched, r.code], [false, "PROJECT_ACT_NOT_A_PARTICIPANT"]);
  assert.equal(aw.calls.length, 0, "nothing sent");
  assert.equal(w.dump(), before);
});
