/* ai-runs' shares of the old suites converted in T18 (build/jobs/T17/legacy-tests.md's rows; the old suites were
   deleted in T20): `airuns` (R22), `d260-resume` (R16, R18), `run-conditions` (R20, R21, R23, R24), `airun` (R14, R19),
   `observation-log` (R12, R14, R15, R24), `project-disclosure` (R10–R12), `extractrun` and `skillpack` (R9, R40), and
   `rec173-migration-replay` (R25, R26). The shares proving the moved rules (R1–R8, R44, R45's figure) are run-rules'. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0, sha, inquiryMd } from "./world.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { RUN_BOUNDS, RUN_ENDINGS, STANDARD_BASIS, OBSERVATION_COVERAGE_UNDETERMINED } from "../../../src/run-rules/index.mjs";

const CAP = "c".repeat(64);
const HIDDEN = "PROJ-2026-0009", INQ2 = "INQ-2026-0002";
const T = (m) => `2026-07-01T00:${String(m).padStart(2, "0")}:00Z`;
const at = (s) => Date.parse(`2026-07-01T${s}Z`);
const logOf = (w, run = "R1") => w.rows(`SELECT * FROM observation_log WHERE authority_kind='run' AND authority=? ORDER BY seq`, run);
const look = (state, extra = {}) => ({ level: "content", subject: CAP, state, detail: state, ...extra });

async function base() {
  const w = world();
  await w.group("ann", "bob", "dan", "eve");
  w.bundle(INQ); w.bundle(INQ2);
  w.project(PROJ, "ann", { joined: ["bob"], invited: ["eve"] });
  w.project(HIDDEN, "ann");
  return w;
}

test("R22 (convert airuns): truncated counts only runs the viewer may see; a joined member lists a project's runs; a padded well-formed request is trimmed; the withheld answer carries the applied limit", async () => {
  const w = await base();
  for (const run of ["H1", "H2", "H3"])
    await w.runs.open(OPEN({ run, contextType: "project", contextId: HIDDEN, actor: "ann", viewer: "member:ann", principalPlane: "member:ann" }));
  await w.runs.open(OPEN({ run: "P1", contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" }));
  /* two or more hidden runs at limit 1: the bound is applied behind the gate, so nothing reads as cut */
  const hidden = await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "member:dan", limit: 1 });
  assert.deepEqual([hidden.ok, hidden.count, hidden.runs, hidden.limit, hidden.truncated], [true, 0, [], 1, false]);
  const seen = await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "member:ann", limit: 1 });
  assert.deepEqual([seen.count, seen.truncated], [1, true], "control: the same page is cut for a viewer who sees them");
  /* D54 (K2442): the founder, neither invited nor joined, sees a hidden project at EXISTENCE only: nothing listed, nothing cut */
  const founder = await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "admin", limit: 1 });
  assert.deepEqual([founder.count, founder.runs, founder.truncated], [0, [], false], "D54: the founder lists no hidden project's runs");
  /* a permitted member lists a project's runs; one outside it gets the empty list */
  const bob = await w.runs.listInContext({ contextType: "project", contextId: PROJ, viewer: "member:bob" });
  assert.deepEqual(bob.runs.map((r) => r.id), ["P1"]);
  assert.equal((await w.runs.listInContext({ contextType: "project", contextId: PROJ, viewer: "member:dan" })).count, 0);
  /* a padded request is trimmed, and the context echoed normalised */
  await w.runs.open(OPEN());
  const padded = await w.runs.listInContext({ contextType: "  INQUIRY ", contextId: `  ${INQ}  `, viewer: "admin" });
  assert.deepEqual([padded.ok, padded.context, padded.runs.map((r) => r.id)], [true, { type: "inquiry", id: INQ }, ["R1"]]);
  /* the withheld answer's limit is the clamped one, as the empty answer's */
  for (const [limit, applied] of [[0, 200], [5000, 1000], [3, 3]])
    assert.equal((await w.runs.listInContext({ contextType: "project", contextId: HIDDEN, viewer: "member:dan", limit })).limit, applied);
});

/** A wait source over plain maps: requests per run; "pending" is outstanding, anything else a completion. */
function waitSource(reqs) {
  return {
    tickMs: () => 5000, configured: () => true,
    holds: (iso, limit) => Object.entries(reqs).map(([run, rs]) => ({ run, outstanding: rs.filter((q) => q.state === "pending").length }))
      .filter((h) => h.outstanding > 0).slice(0, limit),
    woken: (limit) => Object.entries(reqs).filter(([, rs]) => rs.some((q) => q.state !== "pending" && !q.woken)).map(([r]) => r).slice(0, limit),
    completions: (run, limit) => (reqs[run] || []).filter((q) => q.state !== "pending" && !q.woken).slice(0, limit)
      .map((q) => ({ request: q.request, state: q.state })),
    markWoken: (ids, iso) => { for (const rs of Object.values(reqs)) for (const q of rs) if (ids.includes(q.request)) q.woken = iso; },
  };
}

test("R16, R18 (convert d260-resume): each withheld resumption's wake entry says why in its own words; the dispatched one says it was handed over, once, by POST /run; a refused dispatch carries agent-worker's code; withheld runs keep running untouched; neither secret reaches any read", async () => {
  const TOKEN = "instance-ai-secret-value-7f3c", CLAUDE = "claude-account-secret-9q";
  const calls = [];
  let answer = { status: 200, body: { ok: true } };
  const AW = { fetch: async (url, init) => { calls.push({ url, method: init.method, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(answer.body), { status: answer.status }); } };
  const env = { AGENT_WORKER: AW, INSTANCE_AI_TOKEN: TOKEN, INSTANCE_CLAUDE_TOKEN: CLAUDE, STORE: { idFromName: (n) => `id:${n}` } };
  const w = world({ env });
  await w.group("ann");
  w.bundle(INQ);
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const stamp = `${cred.principal}/${cred.tokenId}`;
  const runs = { INST: stamp, MEM: "member:ann/tok-m", OTHER: "class:ai/other" };
  for (const [run, principalPlane] of Object.entries(runs)) await w.runs.open(OPEN({ run, principalPlane }));
  const reqs = { INST: [{ request: "q1", state: "captured" }], MEM: [{ request: "q2", state: "captured" }],
                 OTHER: [{ request: "q3", state: "refused" }] };
  w.runs.registerWaitSource("capture-requests", waitSource(reqs));
  const a1 = await w.runs.wake(at("00:00:10"));
  const wakes = Object.fromEntries(a1.wakes.map((x) => [x.run, x]));
  assert.deepEqual([a1.woken, a1.dispatched, calls.length], [3, 1, 1], "one dispatch over three woken runs, one call at the binding");
  assert.deepEqual([calls[0].method, new URL(calls[0].url).pathname, calls[0].body.run_id, calls[0].body.store], ["POST", "/run", "INST", "bio"]);
  assert.deepEqual(Object.keys(calls[0].body), ["run_id", "store", "credential", "account"], "no instance Claude account (K1514)");
  assert.deepEqual([wakes.MEM.resume, wakes.OTHER.resume, wakes.INST.resume, wakes.INST.dispatch.state],
                   ["MEMBER_PRINCIPAL_RUN", "NOT_THE_INSTANCE_CREDENTIALS_RUN", "DISPATCH", "DISPATCHED"]);
  const wakeEntry = (run) => logOf(w, run).find((e) => /the daemon answered/.test(e.detail));
  assert.match(wakeEntry("MEM").detail, /Resumption: NOT dispatched — a member's credential opened it/);
  assert.ok(wakeEntry("OTHER").detail.includes(word("ai-runs.says.resumption_dispatched", { why: word("ai-runs.text.principal_opened_organization") })));
  assert.ok(wakeEntry("INST").detail.includes(word("ai-runs.says.resumption_handed_agent", { token_id: "tok-org" })));
  /* withheld runs: still running, woken, and nothing after their wake entry */
  for (const run of ["MEM", "OTHER"]) {
    assert.equal((await w.runs.read({ run, viewer: "admin" })).session.status, "running");
    const l = logOf(w, run);
    assert.equal(l[l.length - 1].detail, wakeEntry(run).detail);
  }
  /* exactly once */
  const a2 = await w.runs.wake(at("00:00:20"));
  assert.deepEqual([a2.woken, calls.length], [0, 1]);
  /* nothing can be resumed here: said in the entry, with the reason */
  const u = world({ env: { ...env, AGENT_WORKER: null } });
  await u.group("ann"); u.bundle(INQ);
  await u.runs.open(OPEN({ principalPlane: stamp }));
  u.runs.registerWaitSource("capture-requests", waitSource({ R1: [{ request: "q", state: "captured" }] }));
  await u.runs.wake(at("00:00:10"));
  assert.ok(logOf(u)[0].detail.includes(word("ai-runs.says.resumption_dispatched",
    { why: word("ai-runs.text.group_civicsmith_resume", { withheld: "AGENT_WORKER_UNBOUND" }) })));
  /* a dispatch agent-worker refuses carries its code, in the answer and in the run's own last entry */
  answer = { status: 409, body: { ok: false, reason: "RUN_NAMES_A_DIFFERENT_PAYER" } };
  await w.runs.open(OPEN({ run: "PAYER", principalPlane: stamp }));
  reqs.PAYER = [{ request: "q4", state: "captured" }];
  const a3 = await w.runs.wake(at("00:00:30"));
  const p = a3.wakes.find((x) => x.run === "PAYER");
  assert.deepEqual([p.dispatch.state, p.dispatch.reason, p.dispatch.status], ["REFUSED", "RUN_NAMES_A_DIFFERENT_PAYER", 409]);
  assert.match(logOf(w, "PAYER").pop().detail,
    /^Resumption: the dispatch to agent-worker did not complete \(REFUSED: RUN_NAMES_A_DIFFERENT_PAYER\)\. The run was woken and is still resumable/);
  /* neither secret reaches a read, a log or an answer (over a corpus that is not empty) */
  const reads = [JSON.stringify(a1), JSON.stringify(a2), JSON.stringify(a3)];
  for (const run of [...Object.keys(runs), "PAYER"]) {
    reads.push(JSON.stringify(await w.runs.read({ run, viewer: "admin" })), JSON.stringify(w.runs.log({ run, viewer: "admin" })),
               JSON.stringify(await w.runs.spawnPayload({ run, viewer: "admin", half: "compose" })));
  }
  const blob = reads.join("\n") + JSON.stringify(w.rows(`SELECT * FROM ai_runs`)) + JSON.stringify(w.rows(`SELECT * FROM observation_log`));
  assert.ok(blob.length > 4000);
  assert.deepEqual([blob.includes(TOKEN), blob.includes(CLAUDE)], [false, false]);
});

test("R20, R21, R23, R24 (convert run-conditions): the read and both spawn halves publish one bar block for every basis, every basis reached and none outside the vocabulary; the lens at the open names its instant; the log withholds the run's own cells", async () => {
  const w = await base();
  const proj = { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" };
  const cases = { bar: [proj, '{"capture":"B","connection":"C"}'], none: [proj, null], noProject: [{}, null],
                  noAxis: [{}, '{"other":"x"}'], unreadable: [{}, "{broken"] };
  const bases = [];
  for (const [run, [o, standardPair]] of Object.entries(cases)) {
    await w.runs.open(OPEN({ run, ...o, standardPair, at: "2026-07-01T00:07:00Z" }));
    /* bob, joined to PROJ, reads every case (D54: the founder no longer reads a hidden project's runs) */
    const r = (await w.runs.read({ run, viewer: "member:bob" })).session;
    const s = await w.runs.spawnPayload({ run, viewer: "member:bob", half: "search" });
    const c = await w.runs.spawnPayload({ run, viewer: "member:bob", half: "compose" });
    if (o.contextId === PROJ)
      assert.deepEqual([(await w.runs.read({ run, viewer: "admin" })).found, (await w.runs.spawnPayload({ run, viewer: "admin" })).found],
        [false, false], `${run}: D54, the founder outside PROJ reads its runs as absent`);
    assert.deepEqual(s.payload.standard, r.standard, `${run}: search half`);
    assert.deepEqual(c.payload.standard, r.standard, `${run}: compose half`);
    assert.equal(r.standard.stated, STANDARD_BASIS[r.standard.basis]);
    bases.push(r.standard.basis);
    assert.equal(r.bias.at_open.at, "2026-07-01T00:07:00Z", "R20: the lens at the open names the open's instant");
  }
  assert.deepEqual([...bases].sort(), Object.keys(STANDARD_BASIS).sort(), "every basis reached, and none outside the vocabulary");
  /* the log answers about the search: none of the run's own cells travel on it */
  const SENT = { label: "sentinel-label-7", principalAiRef: "sentinel-ref-7", skillVersion: "sentinel@7",
                 biasManifest: '{"statements_sha":"sentinel-sha-7"}', standardPair: '{"capture":"sentinel-bar-7"}' };
  await w.runs.open(OPEN({ run: "M", ...SENT, state: { sentinel: "sentinel-state-7" }, rerunOf: "noProject" }));
  await w.runs.tick({ run: "M", viewer: "admin", caller: ORG, log: [look("LOOKED_ABSENT")] });
  const l = w.runs.log({ run: "M", viewer: "admin" });
  assert.deepEqual(Object.keys(l), ["run", "found", "status", "entries", "limit", "truncated", "stopped", "vocabulary"]);
  const text = JSON.stringify(l);
  for (const v of ["sentinel-label-7", "sentinel-ref-7", "sentinel@7", "sentinel-sha-7", "sentinel-bar-7", "sentinel-state-7",
                   "noProject", "instance", "2026-07-01T01:00:00Z"])
    assert.equal(text.includes(v), false, `the log withholds ${v}`);
  assert.ok(JSON.stringify(await w.runs.read({ run: "M", viewer: "admin" })).includes("sentinel-label-7"), "control: the read publishes it");
});

test("R14, R15 (convert airun, observation-log): the terminal entry's sentence names the bound or the ending; the rollup points at the latest PRESENT; a reaped run that looked keeps its PRESENT", async () => {
  const sentence = async (bound, { reap = false, entries = [] } = {}) => {
    const w = world();
    await w.group("ann"); w.bundle(INQ);
    await w.runs.open(OPEN({ leaseMs: 60000, bounds: [{ bound: "fetches", allowed: 9 }] }));
    if (entries.length) await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: T0, leaseMs: 60000, log: entries });
    if (reap) w.runs.reap(at("01:00:00"));
    else await w.runs.close({ run: "R1", bound, viewer: "admin", caller: ORG, at: T(9) });
    const rows = logOf(w);
    return { term: rows[rows.length - 1], rows };
  };
  assert.equal((await sentence("fetches")).term.detail, `the run stopped because the 'fetches' bound was reached (${RUN_BOUNDS.fetches})`);
  for (const ending of Object.keys(RUN_ENDINGS))
    assert.equal((await sentence(ending)).term.detail, `the run ended: ${RUN_ENDINGS[ending]}`, ending);
  const reaped = await sentence(null, { reap: true });
  assert.deepEqual([reaped.term.bound, reaped.term.detail], ["lease", `the run stopped because the 'lease' bound was reached (${RUN_BOUNDS.lease})`]);
  /* the rollup's referent is the LATEST non-terminal PRESENT */
  const two = await sentence("completed", { entries: [look("PRESENT", { result_kind: "capture", result_ref: CAP }), look("LOOKED_ABSENT"),
                                                        look("PRESENT", { result_kind: "capture", result_ref: CAP })] });
  assert.deepEqual([two.term.state, two.term.result_kind, two.term.result_ref], ["PRESENT", "observation", String(two.rows[2].seq)]);
  /* a killed run that found something: the reaper's terminal entry is PRESENT with its referent, never demoted */
  const k = await sentence(null, { reap: true, entries: [look("PRESENT", { result_kind: "capture", result_ref: CAP })] });
  assert.deepEqual([k.term.state, k.term.bound, k.term.result_kind, k.term.result_ref], ["PRESENT", "lease", "observation", String(k.rows[0].seq)]);
});

test("R12, R24 (convert observation-log): a run's PRESENT naming nothing is refused C-22.10 at the tick and returned, the others appended; coverage is backed, none_owed, or undetermined for a bare PRESENT stored before the rule", async () => {
  const w = world();
  await w.group("ann"); w.bundle(INQ);
  await w.runs.open(OPEN());
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG,
    log: [look("LOOKED_ABSENT"), look("PRESENT"), look("PRESENT", { result_kind: "capture", result_ref: CAP })] });
  assert.deepEqual([t.ticked, t.appended, t.refused.length], [true, 2, 1]);
  assert.deepEqual([t.refused[0].code, t.refused[0].check], ["OBS_PRESENT_NO_REFERENT", "C-22.10"]);
  /* a legacy bare run PRESENT, as stored before C-22.10 reached the run authority */
  w.sql.exec(`INSERT INTO observation_log (at, actor_class, actor, authority_kind, authority, level, subject_kind, subject, state,
              governed, terminal, detail) VALUES (?, 'machine', NULL, 'run', 'R1', 'content', 'unstated', ?, 'PRESENT', 0, 0, 'legacy')`, T0, CAP);
  const l = w.runs.log({ run: "R1", viewer: "admin" });
  assert.deepEqual(l.entries.map((e) => [e.state, e.coverage]),
    [["LOOKED_ABSENT", "none_owed"], ["PRESENT", "backed"], ["PRESENT", OBSERVATION_COVERAGE_UNDETERMINED]]);
});

test("R19 (convert airun): a project run's questions leave out one the project severed, and a project citing none publishes questions []", async () => {
  const w = await base();
  const P2 = "PROJ-2026-0002", P3 = "PROJ-2026-0003";
  const md = `---\nid: ${P2}\nreferences:\n  - rel: "cites"\n    target: "${INQ}"\n  - rel: "cites"\n    target: "${INQ2}"\n    status: "severed"\n---\n`;
  w.bundle(P2, "project", md);
  w.membership.projectClaimOwner({ projectId: P2, memberId: "ann" });
  w.membership.reindexProjectSight(P2);
  w.cites(P2, INQ); w.cites(P2, INQ2);
  w.project(P3, "ann");
  const principal = { actor: "ann", viewer: "member:ann", principalPlane: "member:ann" };
  await w.runs.open(OPEN({ run: "S", contextType: "project", contextId: P2, ...principal }));
  await w.runs.open(OPEN({ run: "N", contextType: "project", contextId: P3, ...principal }));
  assert.deepEqual((await w.runs.read({ run: "S", viewer: "member:ann" })).session.context, { type: "project", id: P2, questions: [INQ] });
  assert.deepEqual((await w.runs.read({ run: "N", viewer: "member:ann" })).session.context, { type: "project", id: P3, questions: [] });
});

test("R10, R11, R12 (convert project-disclosure): the stated project count is the citing projects the viewer sees — invited, joined and administrator alike — and a hidden project citing the question changes neither the open's answer nor the tick's gate", async () => {
  const w = await base();
  w.cites(PROJ, INQ);
  const count = async (viewer, run) => (await w.runs.open(OPEN({ run, viewer, at: T0 }))).projectGate;
  const seen = (viewer) => [PROJ, HIDDEN].filter((p) => w.membership.inSight(p, viewer)).length;
  w.cites(HIDDEN, INQ);
  /* D54 (K2442): an administrator, the founder included, neither invited nor joined, sees neither hidden project and
     counts none; an administrator invited to PROJ (control) counts it */
  w.membership.projectInvite({ projectId: PROJ, handle: "second", by: "ann" });
  w.membership.reindexProjectSight(PROJ);
  for (const [viewer, n] of [["member:eve", 1], ["member:bob", 1], ["member:dan", 0], ["admin", 0], ["member:second", 1],
                             ["member:ann", 2]]) {
    const g = await count(viewer, `C-${viewer}`);
    assert.equal(g.projects, seen(viewer), viewer);
    assert.equal(g.projects, n, `${viewer}: invited ${viewer === "member:eve"}`);
  }
  /* byte-identical before and after a project hidden from the viewer cites the question */
  const v = world();
  await v.group("ann", "dan");
  v.bundle(INQ);
  v.project(HIDDEN, "ann");
  const open = async (run) => { const a = await v.runs.open(OPEN({ run, viewer: "member:dan", actor: "dan", principalPlane: "member:dan" }));
    return JSON.stringify({ ...a, run: null }); };
  const tick = async () => JSON.stringify((await v.runs.tick({ run: "B1", viewer: "member:dan", actor: "dan", caller: "member:dan", at: T0 })).projectGate);
  const before = await open("B1");
  const tBefore = await tick();
  v.cites(HIDDEN, INQ);
  assert.equal(await open("B2"), before, "the open's answer");
  assert.equal(await tick(), tBefore, "the tick's gate");
  assert.equal((await v.runs.open(OPEN({ run: "B3", viewer: "member:ann" }))).projectGate.projects, 1, "control: the cite is there");
  assert.equal((await v.runs.open(OPEN({ run: "B4", viewer: "admin" }))).projectGate.projects, 0, "D54: the founder does not count it");
});

test("R9, R40 (convert extractrun, skillpack): the mode refusal echoes the mode asked (cut at 60) and the deployed modes; the skill-version refusal's note quotes the value", async () => {
  const w = world();
  await w.group("ann"); w.bundle(INQ);
  const r = await w.runs.open(OPEN({ mode: "extract" }));
  assert.deepEqual([r.started, r.code, r.mode, r.deployed], [false, "AI_RUN_MODE_NOT_DEPLOYED", "extract", ["check", "plan"]]);
  /* run-rules R14 (T46; K2892): plan deployed by its own flag, its bar held in this world */
  assert.equal(r.note, word("ai-runs.note.mode_deployed_group", { mode: "extract", deployed: "check, plan", are: "are" }));
  const long = await w.runs.open(OPEN({ mode: "m".repeat(80) }));
  assert.equal(long.mode, "m".repeat(60));
  const s = await w.runs.open(OPEN({ skillVersion: "3" }));
  assert.deepEqual([s.started, s.code], [false, "AI_RUN_SKILL_VERSION_UNNAMED"]);
  assert.match(s.note, /^'3' names no pack/);
  assert.equal(w.count("ai_runs"), 0);
});

test("R25, R26 (convert rec173-migration-replay): a creation carrying no assistant stamp (a member's, or a verified replay's, whose stamp the control plane deletes) is not asked for a run and writes no surfacing row", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ bounds: [{ bound: "surfaces", allowed: 1 }] }))).started, true);
  const r = w.promotion.promote({ bundleId: "INQ-2026-0100", base: null, files: [{ path: "bundle.md", text: inquiryMd("INQ-2026-0100") }],
    meta: {}, snapKey: "replay", author: "member:ann", run: "R1", actorViewer: "admin" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.surfaced_in ?? null, null);
  assert.equal(w.count("inquiry_run_surfacings"), 0);
  assert.deepEqual(w.runs.boundOf("R1", "surfaces"), { allowed: 1, consumed: 0 });
  /* control: the stamped creation is asked, and spends */
  assert.equal(w.surface("INQ-2026-0101").ok, true);
  assert.deepEqual(w.runs.boundOf("R1", "surfaces"), { allowed: 1, consumed: 1 });
});

/* R54 (DEC-149; BOB's review item 1): the sweep's five rows, each named and pinned word for word where a member reads it —
   :895 the mode refusal's `note`, and :1688, :1694, :1698, :1699 the resumption's `says`, which the wake writes into the
   run's log and `op=airunlog` serves (R24). None says "copy", "instance", "plane" or "server" for the group's Civicsmith;
   the codes (`withheld`'s values) stay. */
test("R54: every member-facing string the sweep names says \"your group's Civicsmith\" — index.mjs:895 (AI_RUN_MODE_NOT_DEPLOYED's note), :1688 (dispatched), :1694 (a member's run), :1698 (another principal's run), :1699 (nothing can be resumed), the last four as op=airunlog serves them", async () => {
  const OLD = /\b(copy|instance|plane|server)\b/i;
  /* :895 */
  const w0 = world();
  await w0.group("ann"); w0.bundle(INQ);
  const m = await w0.runs.open(OPEN({ mode: "extract" }));
  assert.equal(m.note, word("ai-runs.note.mode_deployed_group", { mode: "extract", deployed: "check, plan", are: "are" }), "index.mjs:895");
  assert.equal(OLD.test(m.note), false, m.note);
  /* :1688, :1694, :1698 */
  const TOKEN = "instance-ai-secret-value-r54";
  const AW = { fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }) };
  const env = { AGENT_WORKER: AW, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` } };
  const w = world({ env });
  await w.group("ann"); w.bundle(INQ);
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: word("ai.run.cost.on.team") });
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const runs = { INST: `${cred.principal}/${cred.tokenId}`, MEM: "member:ann/tok-m", OTHER: "class:ai/other" };
  for (const [run, principalPlane] of Object.entries(runs)) await w.runs.open(OPEN({ run, principalPlane }));
  w.runs.registerWaitSource("capture-requests", waitSource({ INST: [{ request: "q1", state: "captured" }],
    MEM: [{ request: "q2", state: "captured" }], OTHER: [{ request: "q3", state: "captured" }] }));
  await w.runs.wake(at("00:00:10"));
  const served = (u, run) => u.runs.log({ run, viewer: "admin" }).entries.map((e) => e.detail).find((d) => /Resumption:/.test(d));
  const says = (d) => d.slice(d.indexOf("Resumption:"));
  const rows = {
    "index.mjs:1688": [served(w, "INST"), word("ai-runs.says.resumption_handed_agent", { token_id: "tok-org" })],
    "index.mjs:1694": [served(w, "MEM"), word("ai-runs.says.resumption_dispatched", { why: localize("ai-runs.index.a_members_credential_opened_it",
      "a member's credential opened it, and your team's Civicsmith resumes only runs its own organisation credential opened (D-260, DEC-55 (4): continuing a member's run under the team's key would re-attribute its acts). It waits for its own principal") })],
    "index.mjs:1698": [served(w, "OTHER"), word("ai-runs.says.resumption_dispatched", { why: word("ai-runs.text.principal_opened_organization") })],
  };
  /* :1699 */
  const u = world({ env: { ...env, AGENT_WORKER: null } });
  await u.group("ann"); u.bundle(INQ);
  await u.runs.open(OPEN({ principalPlane: runs.INST }));
  u.runs.registerWaitSource("capture-requests", waitSource({ R1: [{ request: "q", state: "captured" }] }));
  await u.runs.wake(at("00:00:10"));
  rows["index.mjs:1699"] = [served(u, "R1"), word("ai-runs.says.resumption_dispatched",
    { why: word("ai-runs.text.group_civicsmith_resume", { withheld: "AGENT_WORKER_UNBOUND" }) })];
  for (const [row, [detail, want]] of Object.entries(rows)) {
    assert.equal(typeof detail, "string", `${row}: served in the run's log`);
    assert.equal(says(detail), want, row);
    assert.equal(OLD.test(says(detail)), false, `${row}: ${says(detail)}`);
  }
});
