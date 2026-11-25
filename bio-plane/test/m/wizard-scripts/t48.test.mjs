/* wizard-scripts at T48 (N847, N1036, N1047; DEC-218, DEC-220, DEC-221, DEC-226, DEC-227; K2591, K3189, K3190, K3192, K3195):
   the sixth door and the pointer's answered shape (R37), the registry and library re-taken at PR #34's merge (R38). The
   listing to every member (R39) is tested in reads.test.mjs. Every test drives the module at its interface, over the
   carried registry and library and the vendored design files they are held equal to. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { world, step, V } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const F = V("frank");
const src = (f) => readFileSync(new URL(`./source/${f}`, import.meta.url), "utf8");
const REG_FILE = JSON.parse(src("registry.json")), LIB_T48 = JSON.parse(src("library-4664e8efd4.json"));
const LIB_T47 = JSON.parse(src("library-f90b187c7b.json")), REG_T47 = JSON.parse(src("registry-f90b187c7b.json"));
const REG_T48 = JSON.parse(src("registry-4664e8efd4.json"));   /* PR #34's registry, as R38 re-took it; R41 re-takes it again (the file `registry.json` is the later) */
const OWED = /^owed:([a-z][a-z0-9]*)(?:\s+(DEC-\d+|K\d+))?$/;
const opOf = (a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op);
/* every op the registry names, owed ones as their op: the member op table once each owed op is declared */
const ALL_OPS = [...new Set(REG_FILE.screens.flatMap((s) => s.acts.map(opOf)))];
const by = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === n);
const UPDATE_OPS = ["updatestart", "updatelater", "updateskip"];

/* A world over the carried registry and library (or `library`), every op declared but those `lacking`, with a front door's
   pointer when one is given. */
function real({ lacking = [], library = undefined, door = undefined, ...opts } = {}) {
  const w = world({ register: false, ...opts });
  w.member("frank");
  w.member("erin", { role: "admin" });
  const r = w.wz.wizardRegister({ ops: ALL_OPS.filter((o) => !lacking.includes(o)), ...(library ? { library } : {}), ...(door ? { door } : {}) });
  assert.equal(r.ok, true, JSON.stringify(r));
  return w;
}
const check = (w, steps) => wz.wizardScriptsOps(w.wz, new URL(`https://x/?viewer=${encodeURIComponent(F)}`), { steps }).wizardcheck()
  .refusals.map((x) => [x.code, x.step]);
const SIXTH = { door: "elsewhere", scripts: [], opens: "elsewhere" };

test("R37 (T48; N847; DEC-227 (1); K2591, K3190) startFrom's doors end with a sixth, {door: \"elsewhere\", scripts: [], opens: \"elsewhere\"}, after the five R33 carries, frozen data because library.json holds none at PR #34's merge; answered to every viewer whatever is offered; with every script offered the doors are the five then elsewhere; control: with no script offered the doors are the sixth alone, and so for a viewer the rule admits to nothing", () => {
  assert.deepEqual(wz.ELSEWHERE_DOOR, SIXTH);
  assert.ok(Object.isFrozen(wz.ELSEWHERE_DOOR) && Object.isFrozen(wz.ELSEWHERE_DOOR.scripts));
  assert.equal(LIB_T48.doors.some((d) => d.door === "elsewhere"), false, "library.json holds no sixth door at PR #34's merge, so it is carried as frozen data");
  assert.deepEqual(wz.FRONT_DOORS.map((d) => d.door), ["problem", "person", "money", "read", "tip"], "the five of R33, unchanged");
  assert.deepEqual(LIB_T48.doors, LIB_T47.doors, "the file's five doors are those R33 carries");
  const w = real();
  const before = w.snapshot();
  const doors = w.wz.startFrom({ viewer: F }).doors;
  assert.deepEqual(doors.map((d) => d.door), ["problem", "person", "money", "read", "tip", "elsewhere"]);
  assert.deepEqual(doors.slice(0, 5), wz.FRONT_DOORS.map((d) => ({ door: d.door, scripts: [...d.scripts] })));
  assert.deepEqual(doors[5], SIXTH);
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  /* control: nothing offered, or a viewer admitted to nothing: the sixth door alone, never left out */
  assert.deepEqual(real({ library: [] }).wz.startFrom({ viewer: F }).doors, [SIXTH], "no script offered");
  assert.deepEqual(w.wz.startFrom({ viewer: "nobody" }).doors, [SIXTH], "a viewer the rule admits to nothing");
  /* R23's and R33's rule holds for the five: a door with none offered is left out, the sixth stays */
  const money = by(word("wizard.WIZ-df0b5c4d0ffcdde7.name")), get = by(word("wizard.WIZ-cb0ad18a17a04233.name"));
  const left = real({ library: wz.CIVICSMITH_LIBRARY.filter((e) => e.id !== money.id), templates: "unreviewed" }).wz.startFrom({ viewer: F }).doors;
  assert.deepEqual(left.map((d) => d.door), ["problem", "person", "read", "tip", "elsewhere"]);
  assert.ok(!left.some((d) => d.scripts.includes(get.id) || d.scripts.includes(money.id)));
  /* through the op, as the door answers it */
  const viaOp = wz.wizardScriptsOps(w.wz, new URL(`https://x/?op=startfrom&viewer=${encodeURIComponent(F)}`), {}).startfrom();
  assert.deepEqual(viaOp.doors[5], SIXTH);
  /* no place, law or venue enters it (R20) */
  for (const local of [/oakland/i, /california/i, /court/i, /council/i]) assert.ok(!local.test(JSON.stringify(wz.ELSEWHERE_DOOR)), String(local));
});

test("R37 (T48; N847; DEC-227 (4); K3190) the elsewhere route's pointer is the registered door.pointer(viewer)'s answer when that is {places, pointers}: places a list of names ([] when the group follows none), pointers a list of objects passed through as given; controls: a string, a provider that throws, none registered, and any other answer give pointer null", () => {
  const route = (w, viewer = F) => w.wz.startFrom({ viewer }).routes.find((r) => r.route === "elsewhere");
  const given = [{ text: "A pointer", kind: "x", nested: { a: 1 } }, { other: true }];
  const w = real({ door: { pointer: (viewer) => ({ places: ["P", "Q"], pointers: given.map((x) => ({ ...x, for: viewer })) }) } });
  assert.deepEqual(route(w), { route: "elsewhere", pointer: { places: ["P", "Q"], pointers: given.map((x) => ({ ...x, for: F })) } }, "as given, each pointer whole");
  assert.deepEqual(route(real({ door: { pointer: () => ({ places: [], pointers: [] }) } })).pointer, { places: [], pointers: [] }, "no place followed: []");
  assert.deepEqual(route(real({ door: { pointer: () => ({ places: ["P"], pointers: [] }) } })).pointer, { places: ["P"], pointers: [] });
  /* the provider is asked as the viewer */
  const asked = [];
  const x = real({ door: { pointer: (v) => { asked.push(v); return { places: [], pointers: [] }; } } });
  route(x, F); route(x, V("erin"));
  assert.deepEqual(asked, [F, V("erin")]);
  /* the sixth door carries no pointer: the route does */
  assert.equal("pointer" in w.wz.startFrom({ viewer: F }).doors[5], false);
  /* controls: anything else is null */
  for (const answer of ["a string, which the old shape accepted", "", 7, true, null, undefined, [], [{ places: [], pointers: [] }], {}, { text: "old shape" },
                        { places: "P", pointers: [] }, { places: ["P"], pointers: "x" }, { places: ["P"] }, { pointers: [] },
                        { places: [1], pointers: [] }, { places: [null], pointers: [] }, { places: ["P"], pointers: ["not an object"] },
                        { places: ["P"], pointers: [null] }, { places: ["P"], pointers: [[]] }])
    assert.equal(route(real({ door: { pointer: () => answer } })).pointer, null, JSON.stringify(answer));
  assert.equal(route(real({ door: { pointer: () => { throw new Error("down"); } } })).pointer, null, "a provider that throws");
  assert.equal(route(real()).pointer, null, "no provider registered");
  assert.equal(route(real({ door: { findExisting: () => [] } })).pointer, null, "a door with no pointer");
  /* the answer is a copy: the provider's lists are not handed on */
  const own = { places: ["P"], pointers: [{ text: "x" }] };
  const out = route(real({ door: { pointer: () => own } })).pointer;
  assert.notEqual(out.places, own.places);
  assert.deepEqual(out, own);
});

test("R38 (T48; DEC-226, DEC-227, DEC-218; K2241, K3190, K3192 D1; amends R13, R35; R41) the registry is re-taken at PR #34's merge (4664e8efd4): 67 screens and 329 acts, five owed, and again at the design commit named at T50's START (7be06eb4cb), named as the source: 71 screens and 413 acts, sixteen owed; registeredScreens() lists elsewhere with no act and updates; dash-home is gone; owed acts updatestart, updatelater and updateskip are registered as those ops once declared, updatelater on queue too; controls: not while the op table lacks them, wizardsAt(\"elsewhere\") answers []", () => {
  assert.deepEqual(wz.SCREEN_REGISTRY_SOURCE, { commit: "b1adf4236d", path: "docs/development/ux-substrate/screens/registry.json",
                                                sha256: createHash("sha256").update(src("registry.json"), "utf8").digest("hex") });
  assert.equal(REG_T48.screens.length, 67);
  assert.equal(REG_T48.screens.reduce((n, s) => n + s.acts.length, 0), 329);
  assert.equal(REG_T48.screens.flatMap((s) => s.acts).filter((a) => a.status === "owed").length, 5, "five owed at PR #34: passwordresetlink and the update acts");
  assert.equal(wz.SCREEN_REGISTRY.length, 91, "R50: 84 at b1adf4236d");
  assert.equal(REG_FILE.screens.reduce((n, s) => n + s.acts.length, 0), 656, "R53: the file at b1adf4236d, 92 acts more than R49's 564 (projectjoin, scanmirror, T52's owed acts and DEC-438's five standard acts, less taskresolve on dash-action)");
  assert.equal(REG_FILE.screens.flatMap((s) => s.acts).filter((a) => a.status === "owed").length, 121, "R52: 121 owed at b1adf4236d");
  assert.deepEqual(wz.SCREEN_REGISTRY.map((s) => s.id), REG_FILE.screens.map((f) => f.id));
  assert.equal(REG_T48.screens.length - REG_T47.screens.length, 1, "PR #34 has one screen more than PR #33's head");
  assert.deepEqual(REG_FILE.screens.map((s) => s.id).filter((id) => !REG_T48.screens.some((x) => x.id === id)).sort(), ["about-knocker", "actionnew", "aiconnect", "aimine", "aimoments", "aiproject", "aiproviders", "airesults", "aitest", "bias", "contradiction", "counsel", "docket-public", "glossary", "grouprules", "hold", "holdnotice", "leads", "more", "objective", "registers", "teamai", "theme", "watching"], "new since R38 (R41 and R44)");
  const ids = new Set(wz.SCREEN_REGISTRY.map((s) => s.id));
  assert.ok(ids.has("elsewhere") && ids.has("updates"));
  assert.ok(!ids.has("dash-home"), "control: no registered screen is dash-home (DEC-218)");
  assert.ok(REG_T47.screens.some((s) => s.id === "dash-home"), "control: PR #33's head had it");
  const w = real();
  const reg = new Map(w.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual(reg.get("elsewhere"), [], "elsewhere: a working frame with no act");
  assert.deepEqual(reg.get("updates"), REG_FILE.screens.find((f) => f.id === "updates").acts.map(opOf), "updates: its acts, once declared, in the file's order (R45: the design adds three declared acts after the update three)");
  assert.deepEqual(reg.get("updates").slice(0, UPDATE_OPS.length), UPDATE_OPS, "the three update acts lead");
  assert.ok(reg.get("queue").includes("updatelater"), "queue gains updatelater");
  assert.equal(REG_FILE.screens.find((s) => s.id === "elsewhere").acts.length, 0);
  assert.equal(reg.has("dash-home"), false);
  /* control: not registered while the op table lacks them (R13) */
  for (const op of UPDATE_OPS) {
    const lacking = new Map(real({ lacking: [op] }).wz.registeredScreens().map((s) => [s.id, s.acts]));
    assert.ok(!lacking.get("updates").includes(op), `${op}: not while undeclared`);
    assert.ok(!lacking.get("queue").includes(op), `${op}: not on queue either`);
  }
  assert.deepEqual(real({ lacking: UPDATE_OPS }).wz.registeredScreens().find((s) => s.id === "updates").acts, REG_FILE.screens.find((f) => f.id === "updates").acts.filter((a) => a.status !== "owed").map((a) => a.op), "only the update three are lacking: the declared acts the design added (R45) stay");
  /* the order of queue's acts is the file's, updatelater at its place */
  const q = REG_FILE.screens.find((s) => s.id === "queue").acts.map(opOf);
  assert.deepEqual(reg.get("queue"), q);
  /* no step names an act on elsewhere (it lists none), and a script cannot start there */
  assert.deepEqual(check(w, [step("elsewhere", "updatestart"), step("elsewhere", null)]), [["WIZARD_ACT_UNKNOWN", 1]], "control: no act on elsewhere");
  assert.deepEqual(check(w, [step("dash-home", null), step("dash-home", null)]).map(([c]) => c), ["WIZARD_SCREEN_UNKNOWN", "WIZARD_SCREEN_UNKNOWN"], "control: dash-home is no screen");
  assert.deepEqual(w.wz.wizardsAt({ screen: "elsewhere", viewer: F }), { ok: true, screen: "elsewhere", scripts: [] }, "wizardsAt(elsewhere) answers none");
  assert.deepEqual(w.wz.wizardsAt({ screen: "dash-home", viewer: F }).scripts, []);
});

test("R38 (T48; DEC-226 (5), DEC-220, DEC-221; K2241, K3192 D1) the library is re-taken at PR #34's merge: Update your group's Civicsmith (since renamed Update your team's Civicsmith and re-taken, R42) is carried at version 1, required false, approved by BOB under K2241 and authored by the Civicsmith library, its step on owed:updatestart carrying updatestart and passing R12 once that op is declared (withheld until then, K1883); Set up and claim gains version 4 (step 3 with no act) and Start and send version 3 (DEC-221's spelling), each approved by BOB, the earlier updated; every other script keeps its version", () => {
  const BOB = { by: "BOB", at: "2026-10-14", ruling: "K2241" };
  assert.deepEqual(wz.CIVICSMITH_LIBRARY_ADOPTED_SOURCES.at(-5), { commit: "4664e8efd4", path: "docs/development/ux-substrate/screens/library.json",
                                                                   sha256: createHash("sha256").update(src("library-4664e8efd4.json"), "utf8").digest("hex") });
  assert.equal(wz.CIVICSMITH_LIBRARY.length, 23);
  const file = LIB_T48.scripts.find((s) => s.name === "Update your group's Civicsmith");
  const u = by(word("wizard.WIZ-7de505135a9ecd4f.name"));
  /* version 1, as R38 carried it from 4664e8efd4 and kept whole since (R42's re-take made version 2 of it) */
  const u1 = { version: 1, ...u.earlier[0] };
  assert.deepEqual([u.id, u.start, u.origin, u.scope, u.required, u.version, u.author, u.approved, u.source],
                   [file.id, "updates", "civicsmith", "group", false, 2, "civicsmith", { by: "BOB", at: "2026-10-17", ruling: "K2241" }, "2a64c5ae77"]);
  assert.deepEqual([u1.version, u1.author, u1.approved, u1.source], [1, "civicsmith", BOB, "4664e8efd4"]);
  assert.deepEqual(u1.steps.map((t) => [t.screen, t.act]), file.versions[0].steps.map((t) => [t.screen, OWED.test(t.act ?? "") ? OWED.exec(t.act)[1] : t.act]));
  assert.ok(file.versions[0].steps.some((t) => /^owed:updatestart/.test(t.act ?? "")), "the file marks the step owed");
  assert.deepEqual(u1.steps.map((t) => t.act), [null, "updatestart", "bootstrap"]);
  assert.deepEqual(u.steps.map((t) => t.act), [null, "updatestart", "bootstrap"], "version 2 walks the same acts");
  assert.ok(!u.steps.some((t) => String(t.act).startsWith("owed:")));
  /* R12 once declared; withheld until then, and none required so R14 is unmoved */
  const w = real();
  assert.deepEqual(w.wz.wizardsAt({ screen: "updates", viewer: F }).scripts.map((s) => [s.id, s.name]), [[u.id, u.name]], "offered once updatestart is registered");
  assert.deepEqual(wz.checkScript(u1.steps, { screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: [], machineDrafts: [], offered: [] }).refusals, [], "version 1 passes too");
  assert.deepEqual(wz.checkScript(u.steps, { screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: [], machineDrafts: [], offered: [] }).refusals, []);
  const undeclared = real({ lacking: ["updatestart"] });
  assert.deepEqual(undeclared.wz.wizardsAt({ screen: "updates", viewer: F }).scripts, [], "control: withheld while updatestart is undeclared (K1883)");
  assert.deepEqual(wz.checkScript(u.steps, { screens: wz.SCREEN_REGISTRY, ops: ALL_OPS.filter((o) => o !== "updatestart"), machineRefused: [], machineDrafts: [], offered: [] })
    .refusals.map((f) => [f.code, f.step]), [["WIZARD_ACT_UNKNOWN", 2]]);
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS.filter((o) => o !== "updatestart"), machineRefused: ["publish"], machineDrafts: [],
                                         irreversible: ["publish", "publishat", "publishatmove"], library: wz.CIVICSMITH_LIBRARY }), [], "R14: not required, so not blocking");
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: ["publish"], machineDrafts: [],
                                         irreversible: ["publish", "publishat", "publishatmove"], library: wz.CIVICSMITH_LIBRARY }), [], "the required flows pass");
  /* every write refused as R9 says */
  assert.equal(w.wz.wizardRetire({ script: u.id, reason: "r", by: F, viewer: F }).code, "WIZARD_NOT_THE_GROUPS");
  /* Set up and claim version 4: step 3 with no act, the self-test within install (DEC-220) */
  const setup = by(word("wizard.WIZ-c887066cc553dd41.name"));
  const f4 = LIB_T48.scripts.find((s) => s.name === word("wizard.WIZ-c887066cc553dd41.name"));
  const v4 = { version: 4, ...setup.earlier[3] };   /* R38's version, kept whole under R42's version 5 */
  assert.deepEqual([setup.id, setup.name, setup.start, setup.required, v4.version, v4.source, v4.approved], [f4.id, f4.name, f4.start, true, 4, "4664e8efd4", BOB]);
  assert.deepEqual(setup.earlier.map((v) => v.version), [1, 2, 3, 4]);
  assert.deepEqual([v4.steps[2].screen, v4.steps[2].act], ["install", null], "step 3 names no act");
  assert.deepEqual([setup.steps[2].screen, setup.steps[2].act], ["install", null], "and so does version 5's");
  assert.equal(setup.earlier[2].steps[2].act, "selftest", "control: version 3's step 3 named the self-test act, which install no longer lists");
  assert.equal(REG_FILE.screens.find((s) => s.id === "install").acts.some((a) => a.op === "selftest"), false);
  assert.deepEqual(v4.steps.filter((_, i) => i !== 2), setup.earlier[2].steps.filter((_, i) => i !== 2), "no other step changed");
  /* Start and send version 3: DEC-221's spelling */
  const send = by(word("wizard.WIZ-a8c349d7d71b6bb0.name"));
  const s3 = { version: 3, ...send.earlier[2] };   /* R38's version, kept whole under R42's version 4 */
  assert.deepEqual([s3.version, s3.source, s3.approved, send.required], [3, "4664e8efd4", BOB, false]);
  assert.deepEqual(send.earlier.map((v) => v.version), [1, 2, 3]);
  const text = (steps) => steps.map((t) => `${t.what} ${t.why}`).join(" ");
  assert.ok(/labeled/.test(text(s3.steps)) && !/labelled/.test(text(s3.steps)), "labeled");
  assert.ok(/labelled/.test(text(send.earlier[1].steps)), "control: version 2 said labelled, and stays as it was");
  assert.deepEqual(s3.steps.map((t) => t.act), send.earlier[1].steps.map((t) => t.act));
  /* each: the earlier versions updated, naming their successors, readable and not offered */
  for (const [e, screen] of [[setup, "install"], [send, "plan"]]) {
    assert.deepEqual(w.wz.wizardsAt({ screen, viewer: F }).scripts.filter((s) => s.id === e.id).map((s) => s.version), [`${e.id}@${e.version}`], e.name);
    for (let n = 1; n < e.version; n++) {
      const r = w.wz.wizardRead({ script: e.id, version: `${e.id}@${n}`, viewer: F });
      assert.deepEqual([r.version.state, r.version.updated_by, r.offered], ["updated", `${e.id}@${n + 1}`, false], `${e.name} v${n}`);
    }
  }
  /* every other script keeps the version it had at PR #33's head, but for R42's re-take (T50) of those whose content the file at the
     design commit changed: Connect, Publication ceremony, Invite and Welcome gained one (Welcome a second in the fix round, R45); Check a claim and Follow a proceeding did not */
  const had = { [word("wizard.WIZ-74328804ddae3503.name")]: 4, [word("wizard.WIZ-426b9c2e8b128b6b.name")]: 4, [word("wizard.WIZ-33b5887790b7561b.name")]: 2, [word("wizard.WIZ-a15d174f7a2c1dc5.name")]: 2, [word("wizard.WIZ-8e7e2fac33d069f8.name")]: 3, [word("wizard.WIZ-7db08189cc0e58c3.name")]: 3 };
  for (const [n, v] of Object.entries(had)) assert.equal(by(n).version, v, n);
  assert.deepEqual(LIB_T48.scripts.map((s) => s.name).filter((n) => !LIB_T47.scripts.some((x) => x.name === n)), ["Update your group's Civicsmith"], "the one script PR #34 adds");
  assert.ok(!JSON.stringify(wz.CIVICSMITH_LIBRARY).includes("owed:"));
});
