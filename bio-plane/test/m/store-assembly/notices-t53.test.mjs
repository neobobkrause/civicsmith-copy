/* store-assembly: the T53 provider notices this module answers by confirmation (attempt 3, 4 Nov). Each provider changed
   its own code or requirements; what this module does with each is compose it (R1, R2, R6, R83). Each test drives the
   assembled store, the real modules, and asserts what this module's requirements say about that provider after its
   change. No code of this module changed for them, so they are confirmations (job complete names --exempt-revert). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { store, disclosed } from "./fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { aiAccountsOf, aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { aiUseOf, aiUseOps, AI_USE_ADDED_COLUMNS, DECLARED_OPS as AI_USE_DECLARED } from "../../../src/ai-use/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { questionExplorerOf } from "../../../src/question-explorer/index.mjs";
import { planWorkOf, planWorkOps, DECLARED_OPS as PLAN_WORK_DECLARED } from "../../../src/plan-work/index.mjs";
import { legEarningOf, legEarningOps } from "../../../src/leg-earning/index.mjs";
import { moneyOf, moneyOps, DECLARED_OPS as MONEY_DECLARED } from "../../../src/money/index.mjs";
import { strengthOf, strengthOps, DECLARED_OPS as STRENGTH_DECLARED } from "../../../src/strength/index.mjs";
import { admissionOf, admissionOps } from "../../../src/admission/window.mjs";
import { signinDoorOps } from "../../../src/signin-door/ops.mjs";
import { STORE_ROUTES } from "../../../src/signin-door/index.mjs";
import { SCREEN_REGISTRY, ADMIN_ACTS, ADMIN_SCREENS } from "../../../src/wizard-scripts/index.mjs";
import { wizardRegistration } from "../../../src/store-assembly/wizards.mjs";

const u = new URL("http://do/x?viewer=member:nobody&by=nobody");
const SEAL = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-notices-test-0123" };
const keysOf = (ops) => Object.keys(ops);
/* R6, R47: every op of the owner's own map (iterated from its export, never hand-listed) is a key of the route map */
function reaches(x, own, label) {
  const map = x.s.routes(u, {});
  assert.ok(own.length > 0, `${label} serves ops`);
  for (const op of own) assert.ok(Object.hasOwn(map, op), `${label}: op=${op} is in the route map`);
}
/* R83: every op the owner declares is in the assembled op table */
function declared(rows, label) {
  for (const op of Object.keys(rows)) assert.ok(Object.hasOwn(OPS, op), `${label}: ${op} declared in the assembled table`);
}
const member = (x, id) => x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
  VALUES ('${id}', 'Cover ${id}', 'h_${id}', 'member', 'active', '["contribute"]', 't', 't')`);
const door = async (x, path, init) => (await x.fetch(path, init)).json();
const OWN = { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-sentinel-sealed-ann-0123456789abcdef" };

test("notice question-explorer:90 (R27, R29): the assembly's question-explorer reads the store's one ai-accounts and ai-use, so the account it now names to exploreAllowed and exploreAsk is the store's; control: another storage has other instances", async () => {
  const x = await store();
  const q = questionExplorerOf(x.ctx);
  assert.equal(q.aiAccounts, aiAccountsOf(x.ctx), "ai-accounts, one instance per host");
  assert.equal(q.aiUse, aiUseOf(x.ctx), "ai-use, R29's one instance");
  const y = await store();
  assert.notEqual(questionExplorerOf(y.ctx).aiAccounts, q.aiAccounts);
  const u0 = q.aiAccounts.accountUsesOf({ owner: "group" });
  assert.ok(u0 && typeof u0 === "object", "the in-plane read answers through the store's instance");
});

test("notice op-declarations:95 (R6, R35, R40): the route map serves none of the retired account ops (accountreferenceset, groupkeyset and the rest answer unknown op), every T53 account op ai-accounts serves is routed, and a member's own account act is refused DISCLOSURE_DUE until her disclosure is recorded, then answered on her own account", async () => {
  const x = await store({ env: SEAL });
  const map = x.s.routes(u, {});
  for (const op of ["accountreferenceset", "accountreferenceremove", "accountreference", "groupkeyset", "groupkeyremove",
                    "groupkeyswitch", "groupkeystate", "groupkeynoticeseen", "subscriptiondisconnect"]) {
    assert.equal(Object.hasOwn(OPS, op), false, `${op} retired in op-declarations`);
    assert.equal(Object.hasOwn(map, op), false, `${op} is in no owner's map`);
  }
  reaches(x, keysOf(aiAccountsOps(aiAccountsOf(x.ctx), u, {}, {})), "ai-accounts");
  member(x, "ann");
  const before = await door(x, "/aiownadd?by=member:ann&viewer=member:ann", { method: "POST", body: JSON.stringify(OWN) });
  assert.equal(before.result?.code, "DISCLOSURE_DUE", JSON.stringify(before).slice(0, 300));
  await disclosed(x.ctx);
  const after = await door(x, "/aiownadd?by=member:ann&viewer=member:ann", { method: "POST", body: JSON.stringify(OWN) });
  assert.deepEqual([after.result?.ok, after.result?.owner], [true, "member:ann"], JSON.stringify(after).slice(0, 300));
  const retired = await door(x, "/accountreferenceset?by=member:ann&viewer=member:ann", { method: "POST", body: JSON.stringify(OWN) });
  assert.equal(retired.ok, false, "the retired op answers no account act");
});

test("notice ai-accounts:188 (R7, R86; ai-accounts F2): through the store's door, which stamps by as member:<id>, a member's own aiownadd sets owner member:ann, never member:member:ann; control: the stamp, not the body, names the owner", async () => {
  const x = await store({ env: SEAL });
  member(x, "ann"); member(x, "bob");
  await disclosed(x.ctx); await disclosed(x.ctx, "member:bob");
  const set = await door(x, "/aiownadd?by=member:ann&viewer=member:ann", { method: "POST", body: JSON.stringify(OWN) });
  assert.deepEqual([set.result?.ok, set.result?.owner], [true, "member:ann"], JSON.stringify(set).slice(0, 300));
  assert.equal([...x.ctx.storage.sql.exec(`SELECT account_id FROM ai_accounts WHERE owner LIKE 'member:member:%'`)].length, 0);
  const sneaky = await door(x, "/aiownadd?by=member:bob&viewer=member:bob", { method: "POST",
    body: JSON.stringify({ ...OWN, owner: "member:ann", secret: "sk-sentinel-sealed-bob-0123456789abcdef" }) });
  assert.equal(sneaky.result?.owner, "member:bob");
  const list = await door(x, "/accountsof?owner=member:ann&viewer=member:ann", { method: "GET" });
  assert.deepEqual(list.result?.accounts?.map((a) => a.owner), ["member:ann"]);
});

test("notice signin-door:153 (R37): the store spreads signin-door's store-internal map over the store's ai-accounts, and the T53 read its door now asks (STORE_ROUTES.state, accountsof) is served by ai-accounts' own map; signindisclosuredue answers through ai-accounts: due before the disclosure, {ok: true} after", async () => {
  const x = await store({ env: SEAL });
  assert.equal(STORE_ROUTES.state, "accountsof");
  reaches(x, keysOf(signinDoorOps(aiAccountsOf(x.ctx), u, {}, x.env)), "signin-door");
  const map = x.s.routes(u, {});
  assert.ok(Object.hasOwn(map, STORE_ROUTES.state), "the door's state read is routed");
  assert.ok(keysOf(aiAccountsOps(aiAccountsOf(x.ctx), u, {}, {})).includes(STORE_ROUTES.state), "by ai-accounts' own map");
  member(x, "ann");
  const due = await door(x, "/signindisclosuredue?by=member:ann", { method: "POST", body: "{}" });
  assert.equal(due.result?.code, "DISCLOSURE_DUE", JSON.stringify(due).slice(0, 200));
  await disclosed(x.ctx);
  const shown = await door(x, "/signindisclosuredue?by=member:ann", { method: "POST", body: "{}" });
  assert.deepEqual(shown.result, { ok: true });
});

test("notice ai-use:105 (R3, R29): the store migrates ai-use's added columns on a fresh store, routes every op of aiUseOps over its one instance, and holds every op ai-use declares", async () => {
  const x = await store();
  for (const [table, col] of AI_USE_ADDED_COLUMNS) {
    const cols = [...x.ctx.storage.sql.exec(`PRAGMA table_info(${table})`)].map((c) => c.name);
    assert.ok(cols.includes(col), `${table}.${col}`);
  }
  reaches(x, keysOf(aiUseOps(aiUseOf(x.ctx), u, {})), "ai-use");
  declared(AI_USE_DECLARED, "ai-use");
});

test("notice plan-work:184 (R34): plan-work is built with the store's one ai-runs, whose open it now calls with principalAi; its ops are routed and declared", async () => {
  const x = await store();
  assert.equal(planWorkOf(x.ctx).aiRuns, aiRunsOf(x.ctx, x.env), "the store's one ai-runs");
  reaches(x, keysOf(planWorkOps(planWorkOf(x.ctx), u, {})), "plan-work");
  declared(PLAN_WORK_DECLARED, "plan-work");
});

test("notice leg-earning:138 (R20, R86): leg-earning's ops map and the owner map's projectsshownon reach its one instance", async () => {
  const x = await store();
  reaches(x, [...keysOf(legEarningOps(legEarningOf(x.ctx), u)), "projectsshownon"], "leg-earning");
});

test("notice money:154 (R20, R83): money's ops are routed and every op its DECLARED_OPS (its R27) names is in the assembled table", async () => {
  const x = await store();
  reaches(x, keysOf(moneyOps(moneyOf(x.ctx), u, {})), "money");
  declared(MONEY_DECLARED, "money");
});

test("notice strength:176 (R14, R83): strength's ops are routed and declared", async () => {
  const x = await store();
  reaches(x, keysOf(strengthOps(strengthOf(x.ctx), u, {})), "strength");
  declared(STRENGTH_DECLARED, "strength");
});

test("notice admission:171 (R6): admission's window ops are routed over its one instance", async () => {
  const x = await store();
  reaches(x, keysOf(admissionOps(admissionOf(x.ctx), u, {})), "admission");
});

test("notice wizard-scripts:98 (R17, R18, R23): the registration hands wizard-scripts' own SCREEN_REGISTRY (re-taken at its R54), ADMIN_ACTS and ADMIN_SCREENS: the registry the object itself, the two lists with exactly wizard-scripts' members", () => {
  const reg = wizardRegistration({});
  assert.equal(reg.screens, SCREEN_REGISTRY, "the registry itself, never a copy");
  assert.deepEqual(new Set(reg.adminActs), new Set(ADMIN_ACTS));
  assert.deepEqual(new Set(reg.adminScreens), new Set(ADMIN_SCREENS));
  assert.ok(reg.screens.some((s) => s.id === "setup"), "the re-taken registry holds setup");
});

test("notice wizard-scripts:163 (R23): no source of this module names a screen or act wizard-scripts retired; the screens registry is read from wizard-scripts alone", () => {
  const dir = new URL("../../../src/store-assembly/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    assert.equal(/(import|readFileSync)[^\n]*registry\.json/.test(src), false, `${f} reads no registry file of its own`);
    assert.equal(/["'](groupkeyset|accountreferenceset|teamai|connect)["']/.test(src), false, `${f} names no retired act or screen`);
  }
});

test("notice case-grammar:202 (R96): this module imports nothing of case-grammar, so its new format (/10) reaches the store only through the owners that read it", () => {
  const dir = new URL("../../../src/store-assembly/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs")))
    assert.equal(/from\s+["']\.\.\/case-grammar\//.test(readFileSync(new URL(f, dir), "utf8")), false, f);
});
