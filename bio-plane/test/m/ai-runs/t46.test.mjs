/* ai-runs T46 (T46-14): R78, the test-instance exception (`testInstance`, `partAdmitted`, the `untested` label recorded at
   the open and answered by R10, R19 and R28); R18 as amended, a member's own sign-in run dispatched for her alone at her
   own act (`dispatchMemberRun`), every other R18 refusal standing; (T47-20) under a segment credential the plane mints
   (credentials R63), the page-held one retired, the run's end revoking them (R14), the sign-in's held token carried (R79). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0, sha, agentWorker, SIGNIN_TOKEN, ENTRIES } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { AI_RUN_MODE_WRITES } from "../../../src/ai-runs/index.mjs";
import { AI_RUN_WRITES } from "../../../src/credentials/index.mjs";
import { AI_RUNS_CHECKS, CIVICSMITH_TEST_SET, untestedLabel } from "../../../src/run-rules/index.mjs";

const PAIR = { CIVICSMITH_TEST_INSTANCE: "biosmoke7", INSTANCE_NAME: "biosmoke7" };
const EMPTY = CIVICSMITH_TEST_SET;          // Civicsmith's own set, v1 with no matters: no bar can be held on it
const refusedMode = (r) => assert.deepEqual([r.started, r.code, r.check], [false, "AI_RUN_MODE_NOT_DEPLOYED", "C-109.1"],
  JSON.stringify(r).slice(0, 300));

async function testWorld(env, opts = {}) {
  const w = world({ env, testSet: EMPTY, bars: [], ...opts });
  await w.group("ann");
  w.bundle(INQ);
  return w;
}

test("R78: testInstance() is true exactly when the environment's CIVICSMITH_TEST_INSTANCE is a string equal to its INSTANCE_NAME, both non-empty; false otherwise and when either cannot be read", async () => {
  const cases = [
    [PAIR, true],
    [{ CIVICSMITH_TEST_INSTANCE: "biosmoke8", INSTANCE_NAME: "biosmoke7" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "biosmoke7" }, false],
    [{ INSTANCE_NAME: "biosmoke7" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: "biosmoke7" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: "BIOSMOKE7", INSTANCE_NAME: "biosmoke7" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: true, INSTANCE_NAME: "true" }, false],
    [{ CIVICSMITH_TEST_INSTANCE: ["biosmoke7"], INSTANCE_NAME: "biosmoke7" }, false],
    [{}, false],
  ];
  for (const [env, want] of cases) assert.equal(world({ env }).runs.testInstance(), want, JSON.stringify(env));
  /* an environment that cannot be read answers false, never throws */
  const unreadable = {};
  Object.defineProperty(unreadable, "CIVICSMITH_TEST_INSTANCE", { get() { throw new Error("unreadable"); } });
  unreadable.INSTANCE_NAME = "biosmoke7";
  assert.equal(world({ env: unreadable }).runs.testInstance(), false);
});

test("R78: partAdmitted answers run-rules' partAdmittedOn on what this record holds with the instance's testInstance — on an empty set, admitted with the label only on a test instance; a bar held admits unlabelled on either; the chain is never lifted", async () => {
  const off = await testWorld({});
  assert.deepEqual(off.runs.partAdmitted("check"), { admitted: false, untested: null });
  const on = await testWorld(PAIR);
  assert.deepEqual(on.runs.partAdmitted("check"), { admitted: true, untested: untestedLabel("check") });
  assert.equal(on.runs.partAdmitted("check").untested.kind, "untested");
  /* the chain stands: investigate is not admitted until check is verified live, even on a test instance */
  assert.deepEqual(on.runs.partAdmitted("investigate"), { admitted: false, untested: null });
  /* (T53) a Gate 1 verdict held for the entry: admitted unlabelled whatever the instance (the label follows the bar, not
     the instance); with no entry named, nothing is admitted outside a test instance (run-rules R29) */
  for (const env of [{}, PAIR]) {
    const held = world({ env });
    assert.deepEqual(held.runs.partAdmitted("check", ENTRIES.a), { admitted: true, untested: null }, JSON.stringify(env));
    assert.deepEqual(held.runs.partAdmitted("check", { entry_id: ENTRIES.a }), { admitted: true, untested: null });
  }
  assert.deepEqual(world({ env: {} }).runs.partAdmitted("check"), { admitted: false, untested: null });
});

test("R78, R40, R10, R19, R28: an open in mode check on Civicsmith's empty set on a test instance opens, recording and answering the untested label at the open; read and runFor answer it; control: the variable biosmoke8, empty or absent is refused C-109.1 with nothing written", async () => {
  const w = await testWorld(PAIR);
  const label = untestedLabel("check");
  const o = await w.runs.open(OPEN());
  assert.equal(o.started, true, JSON.stringify(o));
  assert.deepEqual(o.untested, label, "R10's answer carries the label");
  assert.deepEqual(JSON.parse(w.row(`SELECT untested FROM ai_runs WHERE run='R1'`).untested), { ...label },
    "recorded at the open (R32)");
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: "admin" })).session.untested, label, "R19's session.untested");
  assert.deepEqual(w.runs.runFor("R1", "admin").untested, label, "R28's runFor carries the label");
  /* recorded, never derived later: the instance ceasing to be a test instance does not remove the run's label */
  w.runs.env = {};
  assert.deepEqual((await w.runs.read({ run: "R1", viewer: "admin" })).session.untested, label);
  assert.deepEqual(w.runs.runFor("R1", "admin").untested, label);
  /* controls: not a test instance, refused C-109.1, nothing written */
  for (const env of [{ CIVICSMITH_TEST_INSTANCE: "biosmoke8", INSTANCE_NAME: "biosmoke7" },
                     { CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "biosmoke7" },
                     { INSTANCE_NAME: "biosmoke7" }]) {
    const x = await testWorld(env);
    const before = x.dump();
    refusedMode(await x.runs.open(OPEN()));
    assert.equal(x.dump(), before, `nothing written (${JSON.stringify(env)})`);
    assert.equal(x.count("ai_runs"), 0);
  }
});

test("R78: a CIVICSMITH_TEST_INSTANCE (or INSTANCE_NAME) in the open's body or query is ignored — only the Worker environment is read", async () => {
  const w = await testWorld({ INSTANCE_NAME: "biosmoke7" });
  const before = w.dump();
  refusedMode(await w.op("airunopen", { principal: ORG, viewer: "admin", CIVICSMITH_TEST_INSTANCE: "biosmoke7" },
    { ...OPEN({ principalPlane: undefined, viewer: undefined }), ...PAIR, env: PAIR }));
  refusedMode(await w.runs.open({ ...OPEN(), ...PAIR }));
  assert.equal(w.dump(), before, "nothing written");
  assert.equal(w.runs.testInstance(), false);
});

test("R78, R10, R19, R28: a run the bar admitted carries no label — untested is null on the open's answer, the read and runFor, on a test instance too", async () => {
  const w = world({ env: PAIR });
  await w.group("ann"); w.bundle(INQ);
  const o = await w.runs.open(OPEN());
  assert.deepEqual([o.started, o.untested], [true, null]);
  assert.equal((await w.runs.read({ run: "R1", viewer: "admin" })).session.untested, null);
  assert.equal(w.runs.runFor("R1", "admin").untested, null);
  assert.equal(w.row(`SELECT untested FROM ai_runs WHERE run='R1'`).untested, null);
});

test("R78, R23's input: an exploring run's origin is judged with investigate's admission through partAdmitted — refused while check is unverified even on a test instance; once check is verified live, admitted on the exception; control: the same record on a non-test instance stays refused", async () => {
  const own = { origin: "explore", enabledBy: "member:ann", place: stepsWorld().place, work: "find the fee schedule" };
  for (const [env, opens] of [[PAIR, true], [{}, false]]) {
    const w = world({ env, testSet: EMPTY, bars: [], steps: stepsWorld().steps });
    await w.group("ann"); w.bundle(INQ);
    assert.equal((await w.runs.open(OPEN({ run: "S", ...own }))).code, env === PAIR ? "AI_RUN_EXPLORE_NOT_DEPLOYABLE" : "AI_RUN_MODE_NOT_DEPLOYED");
    if (env !== PAIR) { assert.equal(w.runs.partAdmitted("investigate").admitted, false); continue; }
    await w.runs.open(OPEN({ run: "V" }));
    assert.equal(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
    assert.deepEqual(w.runs.partAdmitted("investigate"), { admitted: true, untested: untestedLabel("investigate") });
    const x = await w.runs.open(OPEN({ run: "X", ...own }));
    assert.equal(x.started, opens, JSON.stringify(x));
  }
  /* control: with check verified on a non-test instance holding no bar, investigate is still not admitted */
  const plain = world({ env: {}, testSet: EMPTY, bars: [], deployedModes: ["check"] });
  await plain.group("ann"); plain.bundle(INQ);
  assert.equal(plain.runs.partAdmitted("investigate").admitted, false);
});

/* ---- R18 (T46; N919; Bob's, K2892; T47, N955): a member's own sign-in run, dispatched for her alone at her act, under a
   credential minted for the segment (credentials R63) ---- */

const TOKEN_M = `aik-${"a".repeat(64)}`;
const SHAPE = /^aik-[0-9a-f]{64}$/;

/** A world where ann's run is hers (`principal` `member:ann`, opened by her session, or `member:ann/tok-m`, on a credential
 *  of hers minted before T47), with the agent-worker binding `aw`; `account` is how ann's act is served: her own held
 *  sign-in (`signin`), her API-key reference (`apikey`), or the group's key (`group`). */
async function memberWorld(aw, { account = "signin", mode = "check", principal = "session", env = {}, opts = {} } = {}) {
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50", ...env },
                    ...(mode === "plan" ? { deployedModes: ["check", "plan"] } : {}), ...opts });
  await w.group("ann", "bob", { noAccount: ["ann", "bob"] });
  if (account === "signin") await w.signin("ann");
  if (account === "apikey") await w.account("ann");
  if (account === "group") await w.team({ members: ["ann"] });
  await w.account("bob");
  let stamp = "member:ann";
  if (principal === "credential") {
    const m = w.credentials.aiCredentialMint({ who: "ann", tokenId: "tok-m", secretSha: sha(TOKEN_M), principalKind: "member",
      taskScope: "investigative", writes: ["airuntick"], note: "ann's own key" });
    assert.equal(m.ok, true, JSON.stringify(m));
    const c = w.credentials.aiCredentialLook({ secretSha: sha(TOKEN_M) }).credential;
    stamp = `${c.principal}/${c.tokenId}`;
  }
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  if (mode === "plan") {
    w.project(PROJ, "ann");
    assert.equal(w.runs.registerOpenCheck("action-plans", "plan", () => null).ok, true);
    const o = await w.runs.open(OPEN({ mode: "plan", plan: "PLN-2026-0001", contextType: "project", contextId: PROJ,
      principalPlane: stamp, principalAi: "member:ann", actor: "ann", viewer: "member:ann" }));
    assert.equal(o.started, true, JSON.stringify(o));
  } else {
    const o = await w.runs.open(OPEN({ mode, principalPlane: stamp, principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" }));
    assert.equal(o.started, true, JSON.stringify(o));
  }
  return { w, stamp };
}
const runLog = (w) => w.rows(`SELECT * FROM observation_log WHERE authority_kind='run' AND authority='R1' ORDER BY seq`);
/** The run credentials credentials R63 recorded for `run`, oldest first. */
const runCreds = (w, run = "R1") => w.rows(`SELECT token_id, secret_sha, principal, scope_writes, run, revoked_at FROM ai_credentials
                                             WHERE run = ? ORDER BY rowid`, run);
/** Every row of every table the dispatch could touch, for "the token enters no record". */
const everything = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table'`)
  .map((t) => JSON.stringify(w.rows(`SELECT * FROM "${t.name}"`))).join("\n");

test("R18 (T47; N955; credentials R63): a check run opened by her session is dispatched at her act once with a credential minted for that segment — its writes the mode's, its run the run's — reaching the binding with her own sign-in and no other member's; the token is never answered, logged or written", async () => {
  const aw = agentWorker();
  const { w } = await memberWorld(aw);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: "2026-07-01T00:01:00Z" });
  assert.deepEqual([d.found, d.dispatched, d.dispatch.state], [true, true, "DISPATCHED"], JSON.stringify(d));
  assert.equal(aw.calls.length, 1);
  assert.equal(aw.calls[0].url, "https://agent-worker/run");
  const sent = aw.calls[0].body;
  assert.match(sent.credential, SHAPE, "the minted token in the gate's shape");
  /* (T53; agent-worker R6) the account ai-accounts.accountFor answers for her act, her personal subscription, never a secret */
  assert.deepEqual({ ...sent, credential: "·" }, { run_id: "R1", store: "bio", credential: "·", account: await w.served("ann") });
  assert.deepEqual([sent.account.personal, sent.account.level, "secret" in sent.account, "kind" in sent.account], [true, "member", false, false]);
  assert.equal(JSON.stringify(sent).includes(SIGNIN_TOKEN("ann")), false, "no secret is carried");
  const creds = runCreds(w);
  assert.equal(creds.length, 1, "one credential minted for the segment");
  assert.deepEqual([creds[0].principal, creds[0].run, creds[0].secret_sha, JSON.parse(creds[0].scope_writes), creds[0].revoked_at],
                   ["member:ann", "R1", sha(sent.credential), [...AI_RUN_MODE_WRITES.check], null]);
  const look = w.credentials.aiCredentialLook({ secretSha: sha(sent.credential) }).credential;
  assert.deepEqual([look.principal, look.principalKind, look.run, look.revoked], ["member:ann", "member", "R1", false]);
  assert.equal(JSON.stringify(sent).includes("bob"), false, "no other member's account or credential");
  assert.equal(JSON.stringify(d).includes(sent.credential), false, "the token is never answered");
  assert.equal(everything(w).includes(sent.credential), false, "the token enters no record, the log included");
});

test("R18 (T47): a second dispatch mints anew, revoking the run's earlier segment credential; the run's own earlier member credential (opened before T47) is hers as well", async () => {
  const aw = agentWorker();
  const { w } = await memberWorld(aw, { principal: "credential" });
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).dispatched, true);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).dispatched, true);
  assert.equal(aw.calls.length, 2);
  assert.notEqual(aw.calls[0].body.credential, aw.calls[1].body.credential, "minted anew");
  const creds = runCreds(w);
  assert.equal(creds.length, 2);
  assert.deepEqual(creds.map((c) => c.revoked_at !== null), [true, false], "at most one live per run");
  assert.deepEqual(creds.map((c) => c.secret_sha), aw.calls.map((c) => sha(c.body.credential)));
  /* her pre-T47 credential is not what the segment carries */
  assert.equal(aw.calls.some((c) => c.body.credential === TOKEN_M), false);
});

test("R18 (T47): a plan run's segment credential holds exactly airuntick, optionpropose, airunclose; AI_RUN_MODE_WRITES is frozen and every write it names is one of credentials' AI_RUN_WRITES", async () => {
  assert.deepEqual(AI_RUN_MODE_WRITES, { check: ["airuntick", "suggest", "capturerequest", "airunclose"],
                                         plan: ["airuntick", "optionpropose", "airunclose"] });
  assert.ok(Object.isFrozen(AI_RUN_MODE_WRITES) && Object.isFrozen(AI_RUN_MODE_WRITES.check) && Object.isFrozen(AI_RUN_MODE_WRITES.plan));
  for (const w of [...AI_RUN_MODE_WRITES.check, ...AI_RUN_MODE_WRITES.plan]) assert.ok(AI_RUN_WRITES.includes(w), w);
  const aw = agentWorker();
  const { w } = await memberWorld(aw, { mode: "plan" });
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.equal(d.dispatched, true, JSON.stringify(d));
  assert.deepEqual(aw.calls.map((c) => c.body.account), [await w.served("ann", { project: PROJ })]);
  assert.deepEqual(JSON.parse(runCreds(w)[0].scope_writes).sort(), ["airunclose", "airuntick", "optionpropose"]);
});

test("R18 (T47) controls: a `credential` in the request changes nothing and is never read; a mint refused AI_KEPT_AWAY is answered unchanged and sends nothing; a mint that throws or answers nothing is withheld CREDENTIAL_RECORD_SILENT", async () => {
  /* a credential given (another member's, or nonsense) is ignored: the dispatch mints its own */
  const aw = agentWorker();
  const { w } = await memberWorld(aw);
  for (const credential of [TOKEN_M, "not-a-token", { toString() { throw new Error("read"); } }]) {
    const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", credential });
    assert.equal(d.dispatched, true, JSON.stringify(d));
  }
  assert.equal(aw.calls.length, 3);
  assert.ok(aw.calls.every((c) => SHAPE.test(c.body.credential) && c.body.credential !== TOKEN_M));
  /* the group's keep-away (ai-accounts R7, R20): the mint's refusal, unchanged, nothing sent, nothing written */
  const kAw = agentWorker();
  const k = await memberWorld(kAw);
  const set = k.w.aiAccounts.aiKeepAwaySet({ on: true, reason: "The group's material stays away from every assistant for now.", by: "admin" });
  assert.equal(set.ok, true, JSON.stringify(set));
  const before = k.w.dump();
  const credsBefore = runCreds(k.w).length;
  const r = await k.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  const kept = k.w.credentials.aiRunCredentialMint({ member: "member:ann", run: "R1", writes: ["airuntick"] });
  assert.equal(kept.code, "AI_KEPT_AWAY");
  assert.deepEqual([r.found, r.dispatched, r.code, r.check, r.translation], [true, false, kept.code, kept.check, kept.translation]);
  assert.equal(k.w.dump(), before, "nothing written");
  assert.equal(runCreds(k.w).length, credsBefore, "nothing minted");
  assert.equal(kAw.calls.length, 0, "nothing sent");
  /* the mint itself refused AI_KEPT_AWAY (the keep-away turned on between the account's read and the mint): answered
     unchanged, nothing sent, nothing written */
  const mAw = agentWorker();
  const m = await memberWorld(mAw);
  const refusal = { ok: false, reason: "AI_KEPT_AWAY", code: "AI_KEPT_AWAY", check: kept.check, translation: kept.translation,
                    detail: "kept away" };
  m.w.credentials.aiRunCredentialMint = () => refusal;
  const mb = m.w.dump();
  const mr = await m.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([mr.dispatched, mr.code, mr.check, mr.translation, mr.detail, mr.reason],
                   [false, "AI_KEPT_AWAY", kept.check, kept.translation, "kept away", "AI_KEPT_AWAY"]);
  assert.equal(m.w.dump(), mb);
  assert.equal(mAw.calls.length, 0, "nothing sent");
  /* a mint that throws, or answers nothing */
  for (const broken of [() => { throw new Error("store gone"); }, () => undefined]) {
    const xAw = agentWorker();
    const x = await memberWorld(xAw);
    x.w.credentials.aiRunCredentialMint = broken;
    const s = await x.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
    assert.deepEqual([s.dispatched, s.withheld], [false, "CREDENTIAL_RECORD_SILENT"]);
    assert.equal(xAw.calls.length, 0, "nothing sent");
  }
});

test("R18 (T46, T47, T53) controls: another member's `by` is AI_RUN_NOT_PRINCIPAL; absent or invisible {found: false}; an ended run {dispatched: false, status}; AGENT_WORKER_UNBOUND, NAMESPACE_UNDETERMINED — no call counted and nothing minted on any; (T53) the same member on the team's account or her own API account is dispatched once with that account and no secret; with none, NO_ACCOUNT", async () => {
  const aw = agentWorker();
  const { w, stamp } = await memberWorld(aw);
  const before = w.dump();
  const disp = (o) => w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", ...o });
  const notPrincipal = await disp({ by: "member:bob" });
  assert.deepEqual([notPrincipal.dispatched, notPrincipal.code, notPrincipal.check],
                   [false, "AI_RUN_NOT_PRINCIPAL", AI_RUNS_CHECKS.AI_RUN_NOT_PRINCIPAL.check]);
  assert.equal((await disp({ by: ORG, viewer: "member:ann" })).code, "AI_RUN_NOT_PRINCIPAL", "a machine is no member");
  assert.deepEqual(await disp({ run: "NOPE" }), { run: "NOPE", found: false, note: word("ai-runs.note.run_either_existed") });
  assert.equal((await disp({ run: "" })).found, false);
  const hidden = await disp({ viewer: "who-knows" });
  assert.deepEqual(hidden, { run: "R1", found: false, note: word("ai-runs.note.run_either_existed") });
  assert.equal(w.dump(), before, "nothing written");
  assert.equal(runCreds(w).length, 0, "nothing minted");
  assert.equal(aw.calls.length, 0, "no call counted");
  /* (T53; AIR41) the same member on the team's account, or on her own API account: dispatched once on that account, as
     ai-accounts answers it, no secret */
  for (const account of ["group", "apikey"]) {
    const xAw = agentWorker();
    const x = await memberWorld(xAw, { account });
    const r = await x.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
    assert.equal(r.dispatched, true, `${account}: ${JSON.stringify(r)}`);
    assert.equal(xAw.calls.length, 1, account);
    assert.deepEqual(xAw.calls[0].body.account, await x.w.served("ann"), account);
    assert.equal(xAw.calls[0].body.account.level, account === "group" ? "group" : "member");
    assert.equal(JSON.stringify(xAw.calls[0].body).includes("secret"), false, `${account}: no secret`);
  }
  /* no account serves her act: withheld NO_ACCOUNT, nothing sent, nothing minted */
  const nAw = agentWorker();
  const n = await memberWorld(nAw);
  await n.w.removeAll("member:ann", "ann");
  const nb = n.w.dump();
  assert.deepEqual([(await n.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).withheld, nAw.calls.length], ["NO_ACCOUNT", 0]);
  assert.equal(n.w.dump(), nb);
  assert.equal(runCreds(n.w).length, 0);
  assert.equal(aw.calls.length, 0, "no call counted");
  /* every other R18 ground stands */
  const unbound = await memberWorld(null);
  assert.equal((await unbound.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).withheld, "AGENT_WORKER_UNBOUND");
  assert.equal(runCreds(unbound.w).length, 0);
  const elsewhere = await memberWorld(aw);
  elsewhere.w.ctx.id = { equals: () => false };
  assert.equal((await elsewhere.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" })).withheld, "NAMESPACE_UNDETERMINED");
  assert.equal(runCreds(elsewhere.w).length, 0);
  assert.equal(aw.calls.length, 0);
  /* an ended run */
  assert.equal((await w.runs.close({ run: "R1", bound: "completed", caller: stamp, viewer: "member:ann", actor: "member:ann" })).terminated, true);
  const ended = await disp({});
  assert.deepEqual([ended.found, ended.dispatched, ended.status], [true, false, "finished"]);
  assert.equal(aw.calls.length, 0);
});

test("R18 (T46; K2920): a run of a mode other than check or plan on her own sign-in is withheld MEMBER_RUN_MODE_NOT_ADMITTED, nothing sent", async () => {
  const aw = agentWorker();
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` } }, deployedModes: ["check", "investigate"] });
  await w.group("ann", { noAccount: ["ann"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  await w.runs.open(OPEN({ run: "V" }));
  assert.equal(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  const o = await w.runs.open(OPEN({ mode: "investigate", principalPlane: "member:ann", principalAi: "member:ann",
                                     actor: "member:ann", viewer: "member:ann" }));
  assert.equal(o.started, true, JSON.stringify(o));
  const before = w.dump();
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([r.dispatched, r.code, r.mode], [false, "MEMBER_RUN_MODE_NOT_ADMITTED", "investigate"]);
  /* its row, run-rules R32 (C-22.30), read by key (B3) */
  assert.deepEqual([r.check, r.translation], [AI_RUNS_CHECKS.MEMBER_RUN_MODE_NOT_ADMITTED.check, AI_RUNS_CHECKS.MEMBER_RUN_MODE_NOT_ADMITTED.translation]);
  assert.equal(r.check, "C-22.30");
  assert.equal(w.dump(), before);
  assert.equal(runCreds(w).length, 0);
  assert.equal(aw.calls.length, 0);
});

test("R18 (T46): the wake still withholds a member's own sign-in run as MEMBER_PRINCIPAL_RUN, no call counted; and a dispatch at her act whose call is refused or incomplete appends the wake's one entry saying the run is still resumable, one still running at the bound appends nothing", async () => {
  const aw = agentWorker();
  const { w } = await memberWorld(aw);
  const reqs = { R1: [{ request: "q1", state: "captured" }] };
  w.runs.registerWaitSource("capture-requests", { tickMs: () => 5000, holds: () => [], woken: () => (reqs.R1[0].woken ? [] : ["R1"]),
    completions: () => reqs.R1.filter((q) => !q.woken), markWoken: () => { reqs.R1[0].woken = true; } });
  const woke = await w.runs.wake(Date.parse("2026-07-01T00:00:10Z"));
  assert.deepEqual([woke.wakes[0].resume, woke.dispatched], ["MEMBER_PRINCIPAL_RUN", 0]);
  assert.equal(aw.calls.length, 0);
  assert.equal(runCreds(w).length, 0, "the wake mints nothing");
  // fixtures-contract: agent-worker dispatch-refusal
  for (const answer of [{ status: 400, body: { ok: false, reason: "BAD_BODY", code: "BAD_BODY", worker: "agent-worker", detail: "d" } }, "throw"]) {
    const x = await memberWorld(agentWorker(answer));
    const r = await x.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
    assert.deepEqual([r.dispatched, r.dispatch.state], [false, answer === "throw" ? "SILENT" : "REFUSED"]);
    const rows = runLog(x.w);
    assert.equal(rows.length, 1);
    assert.match(rows[0].detail, /did not complete .*still resumable/);
  }
  const slow = await memberWorld(agentWorker("hang"));
  const r = await slow.w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.deepEqual([r.dispatched, r.dispatch.state, runLog(slow.w).length], [false, "SILENT", 1], "R82: no acceptance within the bound");
  assert.match(runLog(slow.w)[0].detail, /did not complete .*still resumable/);
});

test("R14 (T47; N955; credentials R63): after the exit commits a run's ending, every segment credential minted for it is revoked — by a close, a tick that exhausts a bound, and the reaper alike; another run's stays live; a credentials call that throws never changes the exit or its answer", async () => {
  const aw = agentWorker();
  const { w, stamp } = await memberWorld(aw);
  await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  const o2 = await w.runs.open(OPEN({ run: "R2", principalPlane: stamp, principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" }));
  assert.equal(o2.started, true);
  await w.runs.dispatchMemberRun({ run: "R2", by: "member:ann" });
  assert.deepEqual([runCreds(w, "R1")[0].revoked_at, runCreds(w, "R2")[0].revoked_at], [null, null]);
  const c = await w.runs.close({ run: "R1", bound: "completed", caller: stamp, viewer: "member:ann", actor: "member:ann" });
  assert.equal(c.terminated, true);
  assert.notEqual(runCreds(w, "R1")[0].revoked_at, null, "the close revokes R1's");
  assert.equal(runCreds(w, "R2")[0].revoked_at, null, "another run's stays live");
  assert.equal(w.credentials.aiCredentialLook({ secretSha: runCreds(w, "R1")[0].secret_sha }).credential.revoked, true);
  /* the reaper's ending (the dispatch extended R2's lease from the real clock, R83) */
  assert.equal(w.runs.reap(Date.now() + 3600000).reaped.find((x) => x.run === "R2").terminated, true);
  assert.notEqual(runCreds(w, "R2")[0].revoked_at, null);
  /* a tick that exhausts a bound */
  const t = await memberWorld(agentWorker());
  const o3 = await t.w.runs.open(OPEN({ run: "R3", principalPlane: t.stamp, principalAi: "member:ann", actor: "member:ann",
                                         viewer: "member:ann", bounds: [{ bound: "fetches", allowed: 1 }] }));
  assert.equal(o3.started, true);
  await t.w.runs.dispatchMemberRun({ run: "R3", by: "member:ann" });
  const tk = await t.w.runs.tick({ run: "R3", consume: { fetches: 1 }, caller: t.stamp, viewer: "member:ann", actor: "member:ann" });
  assert.equal(tk.ended && tk.ended.terminated, true, JSON.stringify(tk));
  assert.notEqual(runCreds(t.w, "R3")[0].revoked_at, null);
  /* control: the credentials call throws — the ending and its answer are as they would be */
  const x = await memberWorld(agentWorker());
  x.w.credentials.aiRunCredentialsEnd = () => { throw new Error("store gone"); };
  const ok = await x.w.runs.close({ run: "R1", bound: "completed", caller: x.stamp, viewer: "member:ann", actor: "member:ann" });
  assert.deepEqual([ok.terminated, ok.status, ok.bound], [true, "finished", "completed"]);
  assert.equal(x.w.row(`SELECT status FROM ai_runs WHERE run='R1'`).status, "finished");
});

test("R18 (T53; R79 retired, K5457; agent-worker R6, R127): the dispatch carries no secret — a sentinel token held for her personal subscription reaches neither the stub agent-worker nor any record or answer; the wake's dispatch of an organisation run carries the account as ai-accounts answers it, no secret either", async () => {
  const aw = agentWorker();
  const { w } = await memberWorld(aw);
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  assert.equal(d.dispatched, true);
  assert.equal(JSON.stringify(aw.calls).includes(SIGNIN_TOKEN("ann")), false, "the sentinel reaches no binding");
  assert.equal(everything(w).includes(SIGNIN_TOKEN("ann")), false, "the sentinel enters no record");
  assert.equal(JSON.stringify(d).includes(SIGNIN_TOKEN("ann")), false, "nor the answer");
  const TOKEN = "instance-ai-secret-value-7f3c";
  const aw2 = agentWorker();
  const x = world({ env: { AGENT_WORKER: aw2, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
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
  assert.deepEqual(aw2.calls[0].body.account, await x.served("ann"));
  assert.equal(JSON.stringify(aw2.calls[0].body.account).includes("secret-of-ann"), false);
});
