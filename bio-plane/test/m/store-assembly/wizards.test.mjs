/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R17 (N528; DEC-120, DEC-121 (1), (5); K1363 B11, K1396): the composition of `wizard-scripts`. It is built on the
   object's storage first in layer 11, its migration runs in R3's pass, its tables are declared to purge, its ops map is
   routed through control-plane's door, and before the first request it is registered (its R13) with the screen registry
   and the Civicsmith library the bundle carries, the member op table (`op-declarations`' `OPS`), the acts a machine is
   refused (`op-grades`' `MACHINE_REFUSALS`), the labelled machine drafts (`case-authoring` R39's, and since T34
   `groupdescriptiondraft` and `writinghelp`, DEC-152, DEC-153) and the acts `op-grades` grades `irreversible`. The release
   suite, holding `requiredFailures` empty for that registration, is `release.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store } from "./fixture.mjs";
import { MACHINE_DRAFTS, wizardRegistration, irreversibleActs } from "../../../src/store-assembly/wizards.mjs";
import { caseCheckOf, caseCheckOps } from "../../../src/case-check/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { reviewOf, reviewOps } from "../../../src/review/index.mjs";
import { wizardScriptsOf, wizardScriptsOps, WIZARD_SCRIPTS_TABLES, CIVICSMITH_LIBRARY, SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { MACHINE_REFUSALS, RUNGS } from "../../../src/op-grades/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { ADMIN_ACTS, ADMIN_SCREENS } from "../../../src/wizard-scripts/index.mjs";

const WZ = [...WIZARD_SCRIPTS_TABLES];
const tableNames = (x) => [...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name);
const codes = (list) => list.map((f) => f.code);
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

/* Every module that declared a table to purge, in declaration order (record-core R21), each named once. */
function declarers(x) {
  const rc = recordOf(x.ctx), out = [];
  for (const t of Object.keys(rc.purge().removed)) {
    const m = rc.declarePurge("zz-probe", [t]).declaredBy;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

test("R17: wizard-scripts is built first in layer 11, creating its tables and declaring them to purge under its own name", async () => {
  const x = await store();
  for (const t of WZ) assert.ok(tableNames(x).includes(t), `table ${t}`);
  const rc = recordOf(x.ctx);
  for (const t of WZ) assert.equal(rc.declarePurge("zz-probe", [t]).declaredBy, "wizard-scripts", t);
  const order = declarers(x);
  const at = (m) => { const i = order.indexOf(m); assert.notEqual(i, -1, `${m} declared: ${order.join()}`); return i; };
  assert.ok(at("filing-templates") < at("wizard-scripts") && at("monitoring") < at("wizard-scripts"), "after layers 9 and 10");
  /* negative control: a table no module declared is free to a probe */
  assert.equal(rc.declarePurge("zz-probe", ["zz_none"]).ok, true);
});

test("R17, R3: a store written before wizard-scripts opens with its tables, and a second construction changes nothing", async () => {
  const db = new DatabaseSync(":memory:");
  const first = await store({ db });
  for (const t of WZ) db.exec(`DROP TABLE IF EXISTS ${t}`);
  assert.equal(WZ.some((t) => tableNames(first).includes(t)), false);
  const old = await store({ db });
  for (const t of WZ) assert.ok(tableNames(old).includes(t), `table ${t}`);
  const shape = (x) => [...x.ctx.storage.sql.exec(`SELECT type, name, sql FROM sqlite_master WHERE name LIKE 'wiz_%' ORDER BY name`)].map((r) => ({ ...r }));
  const was = shape(old);
  assert.ok(was.length >= WZ.length);
  assert.deepEqual(shape(await store({ db })), was);
});

test("R17 (T34; DEC-152, DEC-153; K1818): before the first request it is registered once with the bundle's screens and library, the member op table, the acts a machine is refused, the labelled machine drafts (groupdescriptiondraft and writinghelp among them) and the irreversible acts", async () => {
  const x = await store();
  const w = wizardScriptsOf(x.ctx);
  /* once: a second registration is refused, so the plane's stands */
  const again = w.wizardRegister(wizardRegistration());
  assert.equal(again.ok, false);
  assert.equal(again.reason, "WIZARD_ALREADY_REGISTERED");
  /* the registration is exactly R19's parts */
  /* (T45; K2880) the infraction draft, declared by op-declarations R49 */
  const drafts = ["whatchangedpropose", "escalationreasondraft", "groupdescriptiondraft", "writinghelp", "infractiondraft"];
  const graded = Object.keys(RUNGS).filter((op) => RUNGS[op] === "irreversible");
  assert.deepEqual(wizardRegistration(), { screens: SCREEN_REGISTRY, ops: OPS, machineRefused: Object.keys(MACHINE_REFUSALS),
                                           machineDrafts: drafts, irreversible: graded, library: CIVICSMITH_LIBRARY,
                                           adminActs: [...ADMIN_ACTS], adminScreens: [...ADMIN_SCREENS] });
  assert.deepEqual(MACHINE_DRAFTS, drafts);
  /* the irreversible acts are op-grades' grading, read whole, never a copy of it: (T47; op-grades R37, K3147) `publish`
     prepares and is re-graded, so the irreversible acts are the scheduled edition's two */
  assert.deepEqual(graded, ["publishat", "publishatmove"], graded.join());
  assert.deepEqual(irreversibleActs(), graded);
  assert.deepEqual(irreversibleActs({ a: "irreversible", b: "reasoned", c: "irreversible" }), ["a", "c"], "follows the grading it is given");
  /* the registry's screens (K1869 (2)), each with at least the acts it carries (an owed act whose op is declared is
     registered as well, wizard-scripts R13) */
  const held = w.registeredScreens();
  assert.deepEqual(held.map((s) => s.id), SCREEN_REGISTRY.map((s) => s.id), "the registry's screens (K1869 (2))");
  for (const s of SCREEN_REGISTRY)
    for (const a of s.acts) assert.ok(held.find((h) => h.id === s.id).acts.includes(a), `${s.id}: ${a}`);
  assert.deepEqual(new Set(w.reg.ops), new Set(Object.keys(OPS)), "the member op table");
  assert.deepEqual(w.reg.library.map((e) => e.id), CIVICSMITH_LIBRARY.map((e) => e.id), "the Civicsmith library");
  /* behaviour through the door (`op=wizardcheck`, wizard-scripts R12) over what was registered */
  const check = async (steps) => {
    const r = await (await x.fetch("/wizardcheck?viewer=member:ann", { method: "POST", body: JSON.stringify({ steps }) })).json();
    assert.equal(r.ok, true, JSON.stringify(r));
    return codes(r.result.refusals);
  };
  const refused = Object.keys(MACHINE_REFUSALS)[0];
  const step = (x) => ({ screen: "nowhere", act: null, what: "Read the page", why: "To see what is there", ...x });
  /* the acts a machine is refused: a draft from the script's own words is never placed on one */
  assert.ok((await check([step({ act: refused, draft: { text: "words" } })])).includes("WIZARD_STEP_CONCLUDES"));
  assert.ok(!(await check([step({ act: "zz-not-refused", draft: { text: "words" } })])).includes("WIZARD_STEP_CONCLUDES"));
  /* the labelled machine drafts: each registered one is allowed; case-authoring's even on a refused act, while the
     assistant's writing help (groupdescriptiondraft, writinghelp) is never placed on an act refused to a machine or
     graded irreversible (wizard-scripts R24, over what was registered); any other draft is refused */
  const help = ["groupdescriptiondraft", "writinghelp"];
  for (const op of MACHINE_DRAFTS) {
    const on = await check([step({ act: refused, draft: { machine: op } })]);
    const off = await check([step({ act: "zz-not-refused", draft: { machine: op } })]);
    assert.ok(!off.includes("WIZARD_DRAFT_REFUSED") && !off.includes("WIZARD_STEP_CONCLUDES"), `${op}: ${off}`);
    assert.equal(on.includes("WIZARD_STEP_CONCLUDES"), help.includes(op), `${op} on ${refused}: ${on}`);
    assert.ok(!on.includes("WIZARD_DRAFT_REFUSED"), `${op}: ${on}`);
  }
  for (const act of irreversibleActs())
    assert.ok((await check([step({ act, draft: { machine: "writinghelp" } })])).includes("WIZARD_STEP_CONCLUDES"), `irreversible ${act}`);
  assert.ok((await check([step({ draft: { machine: "zz-not-a-draft" } })])).includes("WIZARD_DRAFT_REFUSED"));
  /* the screens: one the registry does not hold is unknown, never guessed (R24) */
  assert.ok((await check([step({})])).includes("WIZARD_SCREEN_UNKNOWN"));
});

test("R17, R6, R34: every op of wizard-scripts' map is in the route map, after review's and case-check's (T45), and answers through control-plane's door what its own map answers called directly", async () => {
  const u = new URL("http://do/");
  const ops = Object.keys(wizardScriptsOps(null, u, null));
  assert.ok(ops.length >= 15 && ops.includes("wizardsat") && ops.includes("wizardcheck"), ops.join());
  const x = await store(), twin = await store();
  const map = Object.keys(x.s.routes(u, null));
  const rev = Object.keys(reviewOps(reviewOf(x.ctx), u, null));
  const chk = Object.keys(caseCheckOps(caseCheckOf(x.ctx), u, null));
  assert.deepEqual(map.slice(map.indexOf(rev[rev.length - 1]) + 1).slice(0, chk.length), chk, "case-check's map directly after review's");
  assert.deepEqual(map.slice(map.indexOf(chk[chk.length - 1]) + 1).slice(0, ops.length), ops, "at its place, in its own order");
  for (const op of ops) {
    const path = `${op}?viewer=member:nobody&author=member:nobody&script=WIZ-none&version=WIZ-none@1&screen=nowhere`;
    const res = await x.fetch(`/${path}`, { method: "POST", body: "{}" });
    const direct = await wizardScriptsOps(wizardScriptsOf(twin.ctx), new URL(`http://do/${path}`), {})[op]();
    assert.equal(res.status, 200, op);
    assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct }))), op);
  }
  /* negative control: a machine's draft is wizard-scripts' own refusal, inside the door's envelope */
  const machine = await (await x.fetch("/wizarddraft?viewer=class:ai&author=class:ai", { method: "POST", body: "{}" })).json();
  assert.deepEqual([machine.ok, machine.result.ok, machine.result.reason], [true, false, "MACHINE_CANNOT_DRAFT_WIZARD"]);
});

test("R18 (R085-34; K874; wizard-scripts R40): the registration the plane builds carries the administrator's acts and screens; through the live store, a plain member's startFrom omits the three group-setup scripts and an administrator's lists them", async () => {
  const named = (r) => r.scripts.map((s) => s.name);
  const reg = wizardRegistration();
  assert.deepEqual(reg.adminActs, [...ADMIN_ACTS], "the administrator's acts, from wizard-scripts (its R51)");
  assert.deepEqual(reg.adminScreens, [...ADMIN_SCREENS], "the administrator's screens, from wizard-scripts (its R51)");
  const x = await store();
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  const w = wizardScriptsOf(x.ctx);
  const member = named(w.startFrom({ viewer: "member:ann" }));
  const admin = named(w.startFrom({ viewer: "member:ada" }));
  /* the group-setup scripts are the ones wizard-scripts offers an administrator and withholds from a plain member: read
     from its own answers, never typed here (its names change with the design's words) */
  const SETUP = admin.filter((n) => !member.includes(n));
  assert.equal(SETUP.length, 3, `the three group-setup scripts: ${SETUP.join(" | ")}`);
  for (const n of SETUP) {
    assert.ok(!member.includes(n), `${n} is withheld from a plain member`);
    assert.ok(admin.includes(n), `${n} is offered to an administrator`);
  }
  /* negative control (K874): the plain member is offered the scripts she may take, so the withholding is the setup scripts' alone */
  assert.ok(member.length > 0 && member.length === admin.length - SETUP.length, "a plain member keeps the scripts she may take");
});
