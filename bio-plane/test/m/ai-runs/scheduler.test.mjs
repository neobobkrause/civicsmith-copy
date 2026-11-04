/* ai-runs R15–R18, R41: the reaper, the wake through the registered wait source, and the woken run's resume. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, sha, agentWorker, SIGNIN_TOKEN } from "./world.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

const at = (s) => Date.parse(`2026-07-01T${s}Z`);
const logOf = (w, run = "R1") => w.rows(`SELECT * FROM observation_log WHERE authority_kind='run' AND authority=? ORDER BY seq`, run);

/** A wait source over plain maps (`capture-requests`' registration in shape): requests per run, each
 *  `{request, state, expires, woken}`; `state` "pending" is outstanding, anything else a completion. */
function waitSource(reqs, { tickMs = 5000, configured = true } = {}) {
  const calls = [];
  const src = {
    tickMs: () => tickMs,
    configured: () => configured,
    holds: (iso, limit) => { calls.push(["holds", iso, limit]);
      return Object.entries(reqs).map(([run, rs]) => ({ run, outstanding: rs.filter((q) => q.state === "pending" && q.expires > iso).length }))
        .filter((h) => h.outstanding > 0).slice(0, limit); },
    woken: (limit) => { calls.push(["woken", limit]);
      return Object.entries(reqs).filter(([, rs]) => rs.some((q) => q.state !== "pending" && !q.woken)).map(([run]) => run).slice(0, limit); },
    completions: (run, limit) => { calls.push(["completions", run, limit]);
      return (reqs[run] || []).filter((q) => q.state !== "pending" && !q.woken).slice(0, limit).map((q) => ({ request: q.request, state: q.state })); },
    markWoken: (ids, iso) => { calls.push(["markWoken", ids, iso]);
      for (const rs of Object.values(reqs)) for (const q of rs) if (ids.includes(q.request)) q.woken = iso; },
  };
  return { src, calls };
}

async function schedWorld(env = {}) {
  const w = world({ env });
  await w.group("ann");
  w.bundle(INQ);
  await w.runs.open(OPEN({ at: "2026-07-01T00:00:00Z", leaseMs: 60000 }));
  await w.runs.open(OPEN({ run: "R2", at: "2026-07-01T00:00:00Z", leaseMs: 600000, bounds: [{ bound: "fetches", allowed: 1 }] }));
  return w;
}

test("R15: reapDue counts lapsed running runs; reapWake is the earliest expiry never before now, or null; reap ends each lapsed run with bound lease through R14", async () => {
  const w = await schedWorld();
  assert.equal(w.runs.reapDue(at("00:00:30")), 0);
  assert.equal(w.runs.reapWake(at("00:00:30")), at("00:01:00"));
  assert.equal(w.runs.reapWake(at("00:05:00")), at("00:05:00"), "never before now");
  assert.equal(w.runs.reapDue(at("00:02:00")), 1);
  const r = w.runs.reap(at("00:02:00"));
  assert.deepEqual(r, { at: "2026-07-01T00:02:00Z", lapsed: 1, reaped: [{ run: "R1", terminated: true, bound: "lease" }] });
  const term = logOf(w).pop();
  assert.deepEqual([term.terminal, term.bound, term.state], [1, "lease", "LOOKED_INDETERMINATE"]);
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run='R1'`).status, "stopped");
  /* an exhausted budget names itself, not the lease, when the killed run is reaped */
  await w.runs.tick({ run: "R2", viewer: "admin", caller: ORG, at: "2026-07-01T00:01:00Z", consume: { fetches: 0 } });
  w.sql.exec(`UPDATE ai_run_bounds SET consumed = 1 WHERE run='R2' AND bound='fetches'`);
  assert.deepEqual(w.runs.reap(at("02:00:00")).reaped, [{ run: "R2", terminated: true, bound: "fetches" }]);
  assert.equal(w.runs.reapWake(at("02:00:00")), null, "no run in flight");
  assert.equal(w.runs.reapDue(at("02:00:00")), 0);
});

test("R17: with no wait source registered, wakeDue is 0 and nothing is held or woken", async () => {
  const w = await schedWorld();
  assert.equal(w.runs.wakeDue(at("00:00:10")), 0);
  assert.equal(w.runs.wakeWake(at("00:00:10")), null);
  const before = w.dump();
  assert.deepEqual(await w.runs.wake(at("00:00:10")), { at: "2026-07-01T00:00:10Z", held: 0, holds: [], woken: 0, wakes: [], dispatched: 0 });
  assert.equal(w.dump(), before);
});

test("R41: registerWaitSource takes one well-formed source; a second is WAIT_SOURCE_DECLARED, a malformed one WAIT_SOURCE_MALFORMED", async () => {
  const w = await schedWorld();
  const { src } = waitSource({});
  for (const [m, s] of [["", src], [null, src], ["capture-requests", null], ["capture-requests", { ...src, markWoken: 1 }],
                        ["capture-requests", { tickMs: src.tickMs, holds: src.holds, woken: src.woken, completions: src.completions }]])
    assert.equal(w.runs.registerWaitSource(m, s).reason, "WAIT_SOURCE_MALFORMED");
  assert.deepEqual(w.runs.registerWaitSource("capture-requests", src), { ok: true, module: "capture-requests" });
  const again = w.runs.registerWaitSource("agent-worker", waitSource({}).src);
  assert.deepEqual([again.ok, again.reason, again.declaredBy], [false, "WAIT_SOURCE_DECLARED", "capture-requests"]);
});

test("R16: through the wait source — an outstanding request extends the lease; completions get one internet-level entry with the counts and the decision, the lease extended and the completions marked woken, in one step; at most 25 per tick", async () => {
  const w = await schedWorld();
  const reqs = {
    R1: [{ request: "q1", state: "pending", expires: "2026-07-01T05:00:00Z" }],
    R2: [{ request: "q2", state: "captured" }, { request: "q3", state: "refused" }, { request: "q5", state: "expired" },
         { request: "q4", state: "pending", expires: "2026-07-01T00:00:01Z" }],
    GONE: [{ request: "q9", state: "captured" }],
  };
  const { src, calls } = waitSource(reqs);
  w.runs.registerWaitSource("capture-requests", src);
  assert.equal(w.runs.wakeDue(at("00:00:10")), 2, "one held (R1), one to wake (R2); a run not held here is neither");
  assert.equal(w.runs.wakeWake(at("00:00:10")), at("00:00:10") + 5000, "the producer's cadence");
  const r = await w.runs.wake(at("00:00:10"));
  assert.deepEqual([r.held, r.woken, r.dispatched], [1, 1, 0]);
  assert.deepEqual(r.holds, [{ run: "R1", outstanding: 1, expires: "2026-07-01T00:10:10Z" }]);
  assert.deepEqual([r.wakes[0].run, r.wakes[0].completions, r.wakes[0].captured, r.wakes[0].refused, r.wakes[0].expired, r.wakes[0].woken, r.wakes[0].resume],
                   ["R2", 3, 1, 1, 1, true, "AGENT_WORKER_UNBOUND"]);
  assert.equal(w.row(`SELECT expires FROM ai_runs WHERE run='R1'`).expires, "2026-07-01T00:10:10Z");
  assert.equal(w.row(`SELECT updated FROM ai_runs WHERE run='R1'`).updated, "2026-07-01T00:00:00Z", "a hold is not the run acting");
  const e = logOf(w, "R2");
  assert.equal(e.length, 1);
  assert.deepEqual([e[0].level, e[0].terminal, e[0].actor, e[0].subject], ["internet", 0, null, INQ]);
  assert.equal(e[0].state, "LOOKED_INDETERMINATE", "a run with no look yet restates no NEVER_LOOKED (observation-log R3)");
  assert.match(e[0].detail, /3 capture request\(s\).*1 captured, 1 refused, 1 expired.*Resumption: NOT dispatched/);
  assert.deepEqual(reqs.R2.map((q) => !!q.woken), [true, true, true, false]);
  assert.ok(calls.some(([f, , l]) => f === "holds" && l === 25));
  assert.ok(calls.some(([f, l]) => f === "woken" && l === 25));
  /* woken once: a second tick holds R1 again and wakes nothing */
  const again = await w.runs.wake(at("00:00:20"));
  assert.deepEqual([again.held, again.woken], [1, 0]);
  /* nothing drains: the hold is inert and nothing is due */
  const w2 = await schedWorld();
  w2.runs.registerWaitSource("capture-requests", waitSource(reqs, { configured: false }).src);
  assert.equal((await w2.runs.wake(at("00:00:10"))).held, 0);
  /* the batch: at most 25 runs held per tick */
  const w3 = await schedWorld();
  const many = {};
  for (let i = 0; i < 30; i++) {
    await w3.runs.open(OPEN({ run: `M${String(i).padStart(2, "0")}` }));
    many[`M${String(i).padStart(2, "0")}`] = [{ request: `m${i}`, state: "pending", expires: "2026-07-02T00:00:00Z" }];
  }
  w3.runs.registerWaitSource("capture-requests", waitSource(many).src);
  assert.equal((await w3.runs.wake(at("00:00:10"))).held, 25);
});

test("R18, R52, R79 (K1514, K1615, K1755; T47, K3068): a woken run is dispatched only when its principal is the instance's organisation ai credential, on record and unrevoked, carrying the account ai-accounts.accountFor answers for its member's act (their own reference, else their own held sign-in with its token as secret, else the group's API key) and no instance account; otherwise the decision is withheld and named (NO_ACCOUNT when no account serves the member); the call is bounded and no secret enters the record", async () => {
  const TOKEN = "instance-ai-secret-value-7f3c";
  const bound = (w, store = "bio") => { w.ctx.id = { equals: (x) => x === `id:${store}` }; };
  const env = (aw, extra = {}) => ({ AGENT_WORKER: aw, INSTANCE_AI_TOKEN: TOKEN, INSTANCE_CLAUDE_TOKEN: "claude-account-x",
                                      STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50", ...extra });
  const setup = async (e, { principal = ORG, mint = "organisation", revoke = false, store = "bio", kind = null, groupKey = false,
                            signin = false } = {}) => {
    const w = world({ env: e });
    await w.group("ann", groupKey || signin ? { noAccount: ["ann"] } : {});
    if (kind) await w.account("ann", kind, `${kind}-secret-of-ann`);
    /* ai-accounts R18, R19 (T47; K3084): ann connected through her Claude subscription's own sign-in, its token held, no
       reference */
    if (signin) await w.signin("ann");
    /* K1755: the group's API key, set and switched on by an administrator, its notice read by ann (ai-accounts R5, R8) */
    if (groupKey) await w.team({ members: ["ann"] });
    w.bundle(INQ);
    if (mint) {
      const m = w.credentials.aiCredentialMint({ who: mint === "member" ? "ann" : "admin", tokenId: "tok-org", secretSha: sha(TOKEN),
        principalKind: mint, taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
      assert.equal(m.ok, true, JSON.stringify(m));
      if (revoke) w.credentials.aiCredentialRevoke({ who: "admin", tokenId: "tok-org" });
    }
    bound(w, store);
    await w.runs.open(OPEN({ principalPlane: principal }));
    const reqs = { R1: [{ request: "q1", state: "captured" }] };
    w.runs.registerWaitSource("capture-requests", waitSource(reqs).src);
    return w;
  };
  const decision = async (w) => (await w.runs.wake(at("00:00:10"))).wakes[0];
  /* the one comparison: stamps equal → dispatched, the body carrying the credential and no more */
  const aw = agentWorker();
  const w = await setup(env(aw));
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const stamp = `${cred.principal}/${cred.tokenId}`;
  const w1 = await setup(env(aw), { principal: stamp });
  const d = await decision(w1);
  assert.deepEqual([d.resume, d.dispatch.state], ["DISPATCH", "DISPATCHED"]);
  assert.equal(aw.calls.length, 1);
  /* the run member's own reference (ai-accounts R7, level member), and no instance Claude account, whatever the copy's
     bindings hold */
  /* (T53; agent-worker R6) the account as ai-accounts.accountFor answers it, never a secret */
  assert.deepEqual(aw.calls[0].body, { run_id: "R1", store: "bio", credential: TOKEN, account: await w1.served("ann") });
  assert.equal(JSON.stringify(aw.calls[0].body.account).includes("secret"), false);
  for (const secret of [TOKEN, "secret-of-ann", "claude-account-x"]) {
    assert.equal(JSON.stringify(w1.rows(`SELECT * FROM observation_log`)).includes(secret), false, "no secret enters the record");
    assert.equal(JSON.stringify(w1.rows(`SELECT * FROM ai_runs`)).includes(secret), false);
    assert.equal(JSON.stringify(d).includes(secret), false);
  }
  /* (T38; K2283, K2290) a member connected through their subscription (ai-accounts R18) with no reference travels as
     their own sign-in, `{kind: "signin", level: "member", member, suggestions: false}`, never re-labelled an API key
     (K1553); (T47; R79, ai-accounts R19) its held token carried as `secret`, as an API key's is */
  const sub = await setup(env(aw), { principal: stamp, signin: true });
  assert.equal((await decision(sub)).dispatch.state, "DISPATCHED");
  assert.deepEqual(aw.calls[1].body.account, await sub.served("ann"));
  assert.deepEqual([aw.calls[1].body.account.personal, aw.calls[1].body.account.suggestions], [true, false]);
  /* K1615 (agent-worker R56): the member's own suggestions switch rides with the reference — on when they turned it on */
  const on = await setup(env(aw), { principal: stamp });
  /* (K2437, K2445) set by ai-accounts' one act, `accountUsesSet` (its R14), `accountSwitchSet` retired */
  on.uses("member:ann", "suggestions", true, "ann");
  assert.equal((await decision(on)).dispatch.state, "DISPATCHED");
  assert.equal(aw.calls[2].body.account.suggestions, true);
  /* K1755: a member with no account of their own is served by the group's API key while it is held and on; the run is
     still that member's (`member` names them). (T41; ai-accounts R9, R14) The group key's own `suggestions` switch,
     set by an administrator through `accountUsesSet`, rides with it, read through `groupKeySwitches()`: off by default
     (control), on when set */
  const grpOff = await setup(env(aw), { principal: stamp, groupKey: true });
  assert.equal((await decision(grpOff)).dispatch.state, "DISPATCHED");
  assert.deepEqual(aw.calls[3].body.account, await grpOff.served("ann"));
  assert.deepEqual([aw.calls[3].body.account.level, aw.calls[3].body.account.suggestions], ["group", false]);
  const grp = await setup(env(aw), { principal: stamp, groupKey: true });
  grp.uses("group", "suggestions", true, "admin");
  assert.equal((await decision(grp)).dispatch.state, "DISPATCHED");
  assert.deepEqual(aw.calls[4].body.account, await grp.served("ann"));
  assert.deepEqual([aw.calls[4].body.account.level, aw.calls[4].body.account.suggestions], ["group", true]);
  /* and a sign-in's own switch (ai-accounts R14 closes K2275's gap): on when ann sets it */
  const subOn = await setup(env(aw), { principal: stamp, signin: true });
  subOn.uses("member:ann", "suggestions", true, "ann");
  assert.equal((await decision(subOn)).dispatch.state, "DISPATCHED");
  assert.deepEqual(aw.calls[5].body.account, await subOn.served("ann"));
  assert.equal(aw.calls[5].body.account.suggestions, true);
  for (const t of ["observation_log", "ai_runs"])
    assert.equal(JSON.stringify(subOn.rows(`SELECT * FROM ${t}`)).includes(SIGNIN_TOKEN("ann")), false, "the sign-in's token enters no record");
  for (const t of ["observation_log", "ai_runs"])
    assert.equal(JSON.stringify(grp.rows(`SELECT * FROM ${t}`)).includes("team-key-secret-0123456789"), false, "the team's key enters no record");
  /* and switched off, nothing serves her: withheld NO_ACCOUNT, the binding not called */
  const off = await setup(env(aw), { principal: stamp, groupKey: true });
  off.switchAll("group", false, "admin");
  assert.equal((await decision(off)).resume, "NO_ACCOUNT");
  assert.equal(aw.calls.length, 6);
  /* every withheld ground, each named, none calling the binding */
  const calls = aw.calls.length;
  const gone = await setup(env(aw), { principal: stamp });
  await gone.removeAll("member:ann", "ann");
  const noAcct = await decision(gone);
  assert.equal(noAcct.resume, "NO_ACCOUNT");
  assert.match(logOf(gone)[0].detail, /Resumption: NOT dispatched — no Claude account serves the member whose act started this run/);
  assert.equal((await decision(await setup(env(aw), { principal: "member:ann/tok-m" }))).resume, "MEMBER_PRINCIPAL_RUN");
  assert.equal((await decision(await setup(env(aw), { principal: "class:ai/other" }))).resume, "NOT_THE_INSTANCE_CREDENTIALS_RUN");
  assert.equal((await decision(await setup(env(null), { principal: stamp }))).resume, "AGENT_WORKER_UNBOUND");
  assert.equal((await decision(await setup(env(aw, { INSTANCE_AI_TOKEN: "" }), { principal: stamp }))).resume, "NO_INSTANCE_AI_CREDENTIAL");
  assert.equal((await decision(await setup(env(aw), { principal: stamp, store: "elsewhere" }))).resume, "NAMESPACE_UNDETERMINED");
  assert.equal((await decision(await setup(env(aw), { principal: stamp, mint: null }))).resume, "INSTANCE_AI_CREDENTIAL_NOT_ON_RECORD");
  assert.equal((await decision(await setup(env(aw), { principal: stamp, revoke: true }))).resume, "INSTANCE_AI_CREDENTIAL_REVOKED");
  assert.equal((await decision(await setup(env(aw), { principal: "member:ann/tok-org", mint: "member" }))).resume, "MEMBER_PRINCIPAL_RUN");
  const memberKey = await setup(env(aw), { principal: "class:ai/tok-org", mint: "member" });
  assert.equal((await decision(memberKey)).resume, "INSTANCE_AI_CREDENTIAL_NOT_ORGANISATION");
  const silent = { get: () => ({ fetch: async () => new Response("{}", { status: 500 }) }), idFromName: (n) => `id:${n}` };
  assert.equal((await decision(await setup(env(aw, { STORE: silent }), { principal: stamp, store: "scratch" }))).resume, "CREDENTIAL_RECORD_SILENT");
  assert.equal(aw.calls.length, calls, "no withheld run reached the binding");
  /* a refused or silent dispatch appends one entry saying the run is still resumable; the wait is bounded (R82), and a
     worker that has not accepted at the bound is a call that did not complete: SILENT, with its entry */
  // fixtures-contract: agent-worker dispatch-refusal
  for (const answer of [{ status: 400, body: { ok: false, reason: "BAD_BODY", code: "BAD_BODY", worker: "agent-worker", detail: "d" } }, "throw"]) {
    const x = await setup(env(agentWorker(answer)), { principal: stamp });
    const o = await decision(x);
    assert.equal(o.dispatch.state, answer === "throw" ? "SILENT" : "REFUSED");
    const rows = logOf(x);
    assert.equal(rows.length, 2);
    assert.match(rows[1].detail, /did not complete .*still resumable/);
  }
  const slow = await setup(env(agentWorker("hang")), { principal: stamp });
  const started = Date.now();
  const running = await slow.runs.wake(at("00:00:10"));
  assert.ok(Date.now() - started < 5000, "the wait is bounded");
  assert.deepEqual([running.wakes[0].dispatch.state, running.dispatched, logOf(slow).length], ["SILENT", 0, 2]);
  assert.match(logOf(slow)[1].detail, /did not complete .*still resumable/);
});
