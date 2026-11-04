/* ai-runs T48 (T48-30; N996 §5; K3195): the account a run carries and its switches are read from `ai-accounts` — its
   `accountFor` (R52, R18, R79), `accountReferenceState` and `groupKeyState` (the wake's decision, R18, R52), `accountUses`
   and `groupKeySwitches` (the dispatch's `suggestions`, R18) — and `credentials` is reached only for the run's own
   credentials and the `ai` credential's row (`aiRunCredentialMint`, `aiRunCredentialsEnd`, `aiCredentialLook`; R14, R18).
   Shown at the interface: with every one of `credentials`' account delegates (its R72) made to throw, each path answers
   as before; control: the same read made to fail in `ai-accounts` changes the answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, sha, agentWorker, SIGNIN_TOKEN } from "./world.mjs";

const TOKEN = "instance-ai-secret-value-t48";
const DELEGATES = ["accountFor", "accountReferenceState", "groupKeyState", "groupKeySwitches", "accountUses", "accountUsesOf",
                   "accountReferenceFor", "aiKeptAway", "servingAccountOf"];
/** `credentials`' account delegates (its R72), each made to throw: a read that still goes through one fails loudly. */
function silenceDelegates(w) {
  const asked = [];
  for (const name of DELEGATES) w.credentials[name] = () => { asked.push(name); throw new Error(`credentials.${name} asked`); };
  return asked;
}
const at = (s) => Date.parse(`2026-07-01T${s}Z`);

/** An organisation run over INQ, carried by ann's act, woken once through a wait source, with the binding `aw`. */
async function wakeWorld(aw, { account = "apikey", suggestions = false } = {}) {
  const w = world({ env: { AGENT_WORKER: aw, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` },
                           AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", account === "apikey" ? {} : { noAccount: ["ann"] });
  if (account === "group") {
    await w.team({ members: ["ann"] });
    if (suggestions) w.uses("group", "suggestions", true, "admin");
  } else if (suggestions) w.uses("member:ann", "suggestions", true, "ann");
  w.bundle(INQ);
  w.ctx.id = { equals: (x) => x === "id:bio" };
  assert.equal(w.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" }).ok, true);
  const cred = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  const stamp = `${cred.principal}/${cred.tokenId}`;
  const reqs = [{ request: "q1", state: "captured" }];
  w.runs.registerWaitSource("capture-requests", { tickMs: () => 5000, configured: () => true, holds: () => [],
    woken: () => (reqs[0].woken ? [] : ["R1"]), completions: () => reqs.filter((q) => !q.woken), markWoken: () => { reqs[0].woken = true; } });
  return { w, stamp };
}

test("R52 (T48; N996 §5): the open asks ai-accounts.accountFor for the act of the member who started it — every credentials account delegate silenced, a run opens on her own key, on the group's key, and is refused AI_NO_ACCOUNT with none, as before; control: ai-accounts' accountFor failing is AI_NO_ACCOUNT, nothing written", async () => {
  const w = world();
  await w.group("ann", "dan", { noAccount: ["dan"] });
  w.bundle(INQ);
  const asked = silenceDelegates(w);
  const own = await w.runs.open(OPEN());
  assert.equal(own.started, true, JSON.stringify(own).slice(0, 300));
  assert.deepEqual({ ...w.row(`SELECT principal_claude, principal_claude_ref FROM ai_runs WHERE run='R1'`) },
                   { principal_claude: "member:ann", principal_claude_ref: "member:ann" });
  assert.equal((await w.runs.open(OPEN({ run: "D0", principalClaude: "member:dan" }))).code, "AI_NO_ACCOUNT");
  await w.team({ members: ["dan"] });
  assert.equal((await w.runs.open(OPEN({ run: "D1", principalClaude: "member:dan" }))).started, true);
  assert.equal(w.row(`SELECT principal_claude FROM ai_runs WHERE run='D1'`).principal_claude, "group");
  assert.deepEqual(asked, [], "no credentials account delegate was asked");
  /* control: the read is ai-accounts' — made to fail there, ann's open is refused by name and nothing is written */
  w.aiAccounts.accountFor = async () => { throw new Error("ai-accounts unreadable"); };
  const before = w.dump();
  const refused = await w.runs.open(OPEN({ run: "R2" }));
  assert.deepEqual([refused.started, refused.code], [false, "AI_NO_ACCOUNT"]);
  assert.equal(w.dump(), before);
});

test("R18, R52 (T48; T53): the wake's decision and dispatch read ai-accounts alone — the account (its accountFor, never a secret carried), whether one serves (servingAccountOf) and the suggestions switch (on the account itself); with credentials' delegates silenced each dispatches as before; control: whether one serves failing in ai-accounts withholds NO_ACCOUNT", async () => {
  for (const [account, suggestions] of [["apikey", false], ["apikey", true], ["group", false], ["group", true]]) {
    const aw = agentWorker();
    const { w, stamp } = await wakeWorld(aw, { account, suggestions });
    await w.runs.open(OPEN({ principalPlane: stamp }));
    const asked = silenceDelegates(w);
    const k = await w.runs.wake(at("00:00:10"));
    assert.deepEqual([k.wakes[0].resume, k.wakes[0].dispatch.state], ["DISPATCH", "DISPATCHED"], `${account} ${suggestions}`);
    const want = await w.served("ann");
    assert.deepEqual(aw.calls[0].body.account, want, `${account} ${suggestions}`);
    assert.deepEqual([want.level, want.suggestions], [account === "group" ? "group" : "member", suggestions]);
    assert.equal(JSON.stringify(aw.calls[0].body.account).includes("secret"), false, "no secret carried");
    assert.deepEqual(asked, [], `${account} ${suggestions}: no credentials account delegate was asked`);
  }
  /* control: whether an account serves is ai-accounts' — its read failing, the woken run is withheld NO_ACCOUNT */
  const aw2 = agentWorker();
  const n = await wakeWorld(aw2);
  await n.w.runs.open(OPEN({ principalPlane: n.stamp }));
  n.w.aiAccounts.servingAccountOf = () => { throw new Error("x"); };
  assert.equal((await n.w.runs.wake(at("00:00:10"))).wakes[0].resume, "NO_ACCOUNT");
  assert.equal(aw2.calls.length, 0);
});

test("R18, R14 (T48; T53): a member's run dispatched at her act reads her personal subscription from ai-accounts and keeps credentials for the segment's credential alone — minted, and ended with the run; with credentials' account delegates silenced it dispatches and ends as before", async () => {
  const aw = agentWorker();
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", { noAccount: ["ann"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN({ principalPlane: "member:ann", principalClaude: "member:ann", actor: "member:ann",
                                         viewer: "member:ann" }))).started, true);
  const asked = silenceDelegates(w);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([d.dispatched, d.dispatch.state], [true, "DISPATCHED"], JSON.stringify(d).slice(0, 300));
  assert.deepEqual(aw.calls[0].body.account, await w.served("ann"));
  assert.equal(JSON.stringify(aw.calls[0].body).includes(SIGNIN_TOKEN("ann")), false, "no secret carried");
  const minted = w.credentials.aiCredentialLook({ secretSha: sha(aw.calls[0].body.credential) }).credential;
  assert.deepEqual([minted.run, minted.revoked], ["R1", false], "the segment's credential is credentials'");
  const c = await w.runs.close({ run: "R1", bound: "completed", caller: "member:ann", viewer: "member:ann", actor: "member:ann" });
  assert.equal(c.terminated, true);
  assert.equal(w.credentials.aiCredentialLook({ secretSha: sha(aw.calls[0].body.credential) }).credential.revoked, true,
    "R14: ended with the run, through credentials");
  assert.deepEqual(asked, [], "no credentials account delegate was asked");
  void ORG;
});
