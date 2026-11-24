/* store-assembly's copy of plane's T47 test: T47's composition (T47-66; N908, N955, N961, N981, N993, N1002; K3030, K3084, K3089, K3137): instance-setup's
   disclosure read registered with credentials (R35); case-inputs' and action-records' maps spread before their source
   modules' and the route map re-pinned to T47's ops (R36; plane R48); a draft grant's `op=rule` read opened with the draft use (answers R35).
   (The Store's `dispatchMemberRun` RPC, plane R46, the plane's global scope against bundler R31's budget, R43, and the composed page, R48, stay with plane.) R52 is t46.test.mjs' (the sign-in's held token on the wire). Each test
   drives the assembled store at its interface (construction over a storage, the object's door) and
   carries a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store } from "./fixture.mjs";
import { MODULE_MAPS, ownMaps, servedThroughDoor } from "./maps.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { instanceSetupOf, ASSISTANT_DISCLOSURE } from "../../../src/setup.mjs";
import { caseInputsOf, caseInputsOps } from "../../../src/case-inputs/index.mjs";
import { caseAuthoringOf, caseAuthoringOps } from "../../../src/case-authoring/index.mjs";
import { actionRecordsOf, actionRecordsOps } from "../../../src/action-records/index.mjs";
import { actionsOf } from "../../../src/actions/index.mjs";
import { actionClocksOf } from "../../../src/action-clocks/index.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { draftOnObject } from "../../../src/store-assembly/ask.mjs";

/* Instants and minted ids differ between two objects; everything else must not. */
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');
const SESSION = "s".repeat(64);
const member = (x, id, role = "member") => x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status,
  capabilities, created, updated) VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);

/* ===== R35 (T47; N981; K3030; credentials R64) ===== */

test("R35 (T47; N981; credentials R64, R22; instance-setup R54): at start the plane registers instance-setup's disclosureOf with credentials once, so through the door a member with no disclosure recorded is refused DISCLOSURE_DUE at accountreferenceset and admitted once disclosureshown records it; a second registration is refused LISTENER_DECLARED", async () => {
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t47-test" } });
  member(x, "ann");
  const set = async () => JSON.parse(await (await x.fetch("/accountreferenceset?by=member:ann&viewer=member:ann",
    { method: "POST", body: JSON.stringify({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann" }) })).text());
  const refused = await set();
  assert.equal(refused.result.ok, false, JSON.stringify(refused));
  assert.equal(refused.result.reason, "DISCLOSURE_DUE", JSON.stringify(refused));
  assert.equal(credentialsOf(x.ctx).accountReferenceState({ member: "member:ann", viewer: "member:ann" }).reference ?? null, null,
               "nothing was set");
  /* the read is instance-setup's, on this object's one instance */
  assert.equal(credentialsOf(x.ctx).disclosureDue({ member: "member:ann" }).reason, "DISCLOSURE_DUE");
  const shown = JSON.parse(await (await x.fetch("/disclosureshown?by=member:ann&viewer=member:ann",
    { method: "POST", body: JSON.stringify({ member: "member:ann", version: ASSISTANT_DISCLOSURE.version }) })).text());
  assert.equal(shown.result.ok, true, JSON.stringify(shown));
  assert.equal(instanceSetupOf(x.ctx).disclosureOf({ member: "member:ann" }).shown, true);
  const admitted = await set();
  assert.equal(admitted.result.ok, true, JSON.stringify(admitted));
  /* the plane's registration is held: a second, whoever makes it, is refused */
  const again = credentialsOf(x.ctx).registerDisclosureRead("zz-probe", () => ({ shown: true }));
  assert.deepEqual([again.ok, again.reason], [false, "LISTENER_DECLARED"], JSON.stringify(again));
  /* negative control: another member, never shown it, is still refused */
  member(x, "bob");
  assert.equal(credentialsOf(x.ctx).disclosureDue({ member: "member:bob" }).reason, "DISCLOSURE_DUE");
});

/* ===== R36, plane R48 (T47; N908, N961; op-declarations R57–R59, R61; tasks R19): the route map ===== */

test("R36 (T47; N908, N961; case-inputs R16, action-records R15): case-inputs' map is spread directly before case-authoring's and action-records' directly before actions', each over the one instance its source module's factory creates, so statementack, whatchangedpropose, whatchangeddrafts and action-records' acts answer through the door what that instance's map answers; control: case-authoring's map no longer holds case-inputs' ops", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const names = MODULE_MAPS.map(([m]) => m);
  assert.equal(names.indexOf("case-inputs"), names.indexOf("case-authoring") - 1, "case-inputs directly before case-authoring");
  assert.equal(names.indexOf("action-records"), names.indexOf("actions") - 1, "action-records directly before actions");
  assert.equal(caseAuthoringOf(x.ctx).inputs, caseInputsOf(x.ctx), "case-authoring's own case-inputs is the one routed");
  assert.equal(actionsOf(x.ctx).records, actionRecordsOf(x.ctx), "actions' own action-records is the one routed");
  const keys = Object.keys(x.s.routes(u, null));
  const ci = Object.keys(caseInputsOps(caseInputsOf(x.ctx), u, null));
  const ar = Object.keys(actionRecordsOps(actionRecordsOf(x.ctx), u, null));
  /* K3268: the arms are read from case-inputs' own map; the three of T47 are among them (R27, R29 added more) */
  for (const op of ["whatchangedpropose", "whatchangeddrafts", "statementack"]) assert.ok(ci.includes(op), `${op} is case-inputs'`);
  /* R41 (T50; K3746): the arms are read from action-records' own map, never counted here; T50's two are among them */
  for (const op of ["actionstake", "actioninquiry"]) assert.ok(ar.includes(op), `${op} is action-records'`);
  assert.ok(ar.length > 0 && new Set(ar).size === ar.length, "its arms, each once");
  /* at their places: case-inputs' ops directly before case-authoring's first own op */
  const firstCa = Object.keys(caseAuthoringOps(caseAuthoringOf(x.ctx), u, null))[0];
  assert.deepEqual(keys.slice(keys.indexOf(firstCa) - ci.length, keys.indexOf(firstCa)), ci);
  const at = keys.indexOf(ar[0]);
  assert.deepEqual(keys.slice(at, at + ar.length), ar, "action-records' acts at its place");
  for (const op of ci) assert.equal(Object.hasOwn(caseAuthoringOps(caseAuthoringOf(x.ctx), u, null), op), false, op);
  const paths = [...ci.map((op) => [caseInputsOps, caseInputsOf, `${op}?case=CASE-2026-none&draft=D-none&edition=1&viewer=member:nobody&author=member:nobody`]),
                 ...ar.map((op) => [actionRecordsOps, actionRecordsOf, `${op}?target=ACTN-2026-0009-none&viewer=member:nobody&author=member:nobody&proposer=member:nobody`])];
  for (const [ops, of, path] of paths) {
    const op = path.split("?")[0];
    const res = await x.fetch(`/${path}`, { method: "POST", body: "{}" });
    const direct = await ops(of(twin.ctx), new URL(`http://do/${path}`), {})[op]();
    assert.equal(res.status, 200, op);
    assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct ?? null }))), op);
  }
  /* negative control: an op of neither map is no route */
  assert.equal(keys.includes("statementackzz"), false);
});

/* T47's new ops are served by these owners' maps (op-declarations R57–R59, R61; tasks R19; R36's list): the ops are read from
   the owners' own maps (K3268), never listed here. `signintrace` is the Worker door's own (control-plane R87), never a store
   route. */
const T47_OWNERS = ["project-roster", "citation", "basis-versions", "strength", "monitoring", "people", "credentials", "instance-setup",
                    "store-door"];

test("R36, R48 (T47; op-declarations R57–R59, R61; tasks R19): the route map is re-pinned to T47's new ops: each is in the map of the module that serves it, in the route map, and answers through control-plane's door what that map answers called directly; an op no map serves is no route", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(u, null));
  const { failed } = await servedThroughDoor(x, twin, T47_OWNERS);
  assert.deepEqual(failed, []);
  assert.equal(keys.includes("signintrace"), false, "the sign-in trace is the Worker door's, no store route");
  assert.equal(keys.includes("zzprobe47"), false);
});


/* ===== answers R35 (T47; K3089): a draft grant's `op=rule` read ===== */

test("R49 (T47; K3089; answers R35, R30): a grant the draft path minted whose first read is op=rule opens its read log with use `draft`, the plane's stamp, whatever use the caller's address names; control: an ask's grant opens it with `ask`", async () => {
  const asks = [];
  const env = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t47-test", AGENT_WORKER: { fetch: async (u, init) => {
    asks.push([u, JSON.parse(init.body)]);
    return new Response(JSON.stringify({ ok: true, draft: { text: "t" }, label: { kind: "machine" } }), { status: 200 }); } } };
  const { deployed, GATE_FLAGS, GATE_SET, GATE_PARTS } = await import("./fixture.mjs");
  const { assistantGateOf } = await import("../../../src/store-assembly/ask.mjs");
  const x = await store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });
  await deployed(x.ctx, GATE_PARTS);
  member(x, "ada", "admin");
  member(x, "ann");
  const c = credentialsOf(x.ctx);
  assert.equal(c.aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  x.ctx.storage.sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
                         createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  assert.equal(instanceSetupOf(x.ctx).disclosureShown({ member: "member:ann", version: ASSISTANT_DISCLOSURE.version, by: "member:ann" }).ok, true);
  assert.equal((await c.accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" })).ok, true);
  assert.equal((await c.accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" })).ok, true);
  assert.equal(answersOf(x.ctx).ruleServicesSwitch({ on: true, by: "member:ada" }).ok, true);
  const d = await (await draftOnObject(x.ctx, x.env, { op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason" })).json();
  assert.match(d.grant, /^[0-9a-f]{64}$/, JSON.stringify(d));
  const rule = (grant) => x.fetch("/rule?service=profiles&viewer=member:ann&use=ask", { method: "POST", headers: { "x-bio-grant": grant }, body: "{}" });
  const rr = await rule(d.grant);
  assert.equal(rr.status, 200);
  assert.equal(JSON.parse(await rr.text()).result.ok, true, "the rule service answered");
  assert.equal(answersOf(x.ctx).readLog(d.grant).use, "draft", "the draft grant's log opened as a draft");
  /* control: an ask's grant */
  const g = await c.aiGrantMint({ member: "member:ann", by: "member:ann", session: SESSION });
  assert.equal(g.ok, true, JSON.stringify(g));
  await rule(g.token);
  assert.equal(answersOf(x.ctx).readLog(g.token).use, "ask");
});


/* ===== R36 (T47; K3150; control-plane R71): the owner map's action-clocks getter ===== */

test("R36, R31 (T47; K3150; control-plane R71): `clockpropose`, served by control-plane's owner map, reaches the plane's one action-clocks instance through its `actionClocks` getter and answers through the door what that instance answers called directly; control: the instance is the plane's own (a spy on it is reached)", async () => {
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(new URL("http://do/"), null));
  assert.ok(keys.includes("clockpropose"), "the route map lacks clockpropose");
  const path = "clockpropose?target=ACTN-2026-0009-none&rule=R-none&proposer=member:nobody&viewer=member:nobody";
  const via = JSON.parse(mask(await (await x.fetch(`/${path}`, { method: "POST", body: "{}" })).text()));
  const twinAnswer = await twin.s.routes(new URL(`http://do/${path}`), {}).clockpropose();
  assert.deepEqual(via, JSON.parse(mask(JSON.stringify({ ok: true, result: twinAnswer ?? null }))));
  const ac = actionClocksOf(x.ctx), was = ac.clockPropose.bind(ac);
  let hit = 0;
  ac.clockPropose = (q) => { hit++; return was(q); };
  try { await x.fetch(`/${path}`, { method: "POST", body: "{}" }); } finally { ac.clockPropose = was; }
  assert.equal(hit, 1, "the plane's action-clocks instance answered");
});

/* ===== R37 (T47; K3143; signin-door R2, R4, R5) ===== */

test("R37 (T47; K3143; signin-door R2, R4, R5): signin-door's store-internal map is spread whole directly after credentials' map, over the plane's one credentials instance: signindisclosuredue answers credentials' DISCLOSURE_DUE through the door (R35's registration in force), signintokenhold holds a token without answering it, and none of the five has an op spec, so no caller is served one; control: an op neither map holds is no route", async () => {
  const { signinDoorOps } = await import("../../../src/signin-door/ops.mjs");
  const { OPS } = await import("../../../src/op-declarations/index.mjs");
  const u = new URL("http://do/");
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t47-test" } });
  member(x, "ann");
  const own = Object.keys(signinDoorOps(credentialsOf(x.ctx), u, null, x.env));
  assert.deepEqual([...own].sort(), ["signindisclosuredue", "signintokenhold", "signintokenrefused", "signintracekeep", "signintraceread"]);
  const keys = Object.keys(x.s.routes(u, null));
  const cred = Object.keys(MODULE_MAPS.find(([m]) => m === "credentials")[1](x.ctx, u, null, x.env));
  const at = keys.indexOf(cred.at(-1)) + 1;
  assert.deepEqual(keys.slice(at, at + own.length), own, "directly after credentials' map");
  for (const op of own) assert.equal(Object.hasOwn(OPS, op), false, `${op} has no op spec: never served to a caller`);
  const via = async (path, body = {}) => JSON.parse(await (await x.fetch(`/${path}`, { method: "POST", body: JSON.stringify(body) })).text());
  const due = await via("signindisclosuredue?by=member:ann");
  assert.equal(due.result.reason, "DISCLOSURE_DUE", JSON.stringify(due));
  assert.equal(instanceSetupOf(x.ctx).disclosureShown({ member: "member:ann", version: ASSISTANT_DISCLOSURE.version, by: "member:ann" }).ok, true);
  assert.deepEqual((await via("signindisclosuredue?by=member:ann")).result, { ok: true });
  const TOKEN = "sk-ant-oat01-SENTINEL-r49-held-token";
  const held = await via("signintokenhold?by=member:ann", { token: TOKEN });
  assert.equal(held.result.ok, true, JSON.stringify(held));
  assert.equal(JSON.stringify(held).includes(TOKEN), false, "the token is never answered");
  assert.equal(credentialsOf(x.ctx).accountReferenceState({ member: "member:ann", viewer: "member:ann" }).subscription.held, true);
  assert.equal((await via("signintokenrefused?by=member:ann")).result.dropped, true);
  /* negative control */
  assert.equal(keys.includes("signinzz"), false);
});
