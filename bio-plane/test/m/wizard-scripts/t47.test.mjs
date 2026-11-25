/* wizard-scripts at T47 (N984, N992; DEC-198, DEC-199, DEC-200–DEC-217; K3062, K3127, K3137): the registry re-taken at PR
   #31's merge and again at PR #33's head (R31, R35), Connect's version 3 (R32), the front doors (R33), the writing help's
   test-instance label (R34) and the newest required flows (R36). Every test drives the module at its interface, over the
   carried registry and library and the vendored design files they are held equal to. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { world, seeded, registration, step, V } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const F = V("frank"), E = V("erin");
const src = (f) => readFileSync(new URL(`./source/${f}`, import.meta.url), "utf8");
const REG_FILE = JSON.parse(src("registry.json"));
const LIB_T47A = JSON.parse(src("library-a0fab7abf0.json")), LIB_T47 = JSON.parse(src("library-f90b187c7b.json"));
const LIB_T50 = JSON.parse(src("library-7be06eb4cb.json"));   /* the design commit named at T50's START (R41, R42) */
const OWED = /^owed:([a-z][a-z0-9]*)(?:\s+(DEC-\d+|K\d+))?$/;
/* every op the registry names, owed ones as their op: the member op table once each owed op is declared */
const ALL_OPS = [...new Set(REG_FILE.screens.flatMap((s) => s.acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op))))];
const by = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === n);
/* the five scripted front doors of R33, without the sixth, the way out (R37) */
const five = (doors) => doors.filter((d) => d.door !== "elsewhere");
const fileStep = (file, name, i) => file.scripts.find((s) => s.name === name).versions[0].steps[i];
const ON = { on: true, account: { kind: "own", level: "member" } };
const TEST_ENV = Object.freeze({ CIVICSMITH_TEST_INSTANCE: "biotest1", INSTANCE_NAME: "biotest1" });

/* A world over the carried registry and library (or `library`), every op declared but those `lacking`. */
function real({ lacking = [], library = undefined, ...opts } = {}) {
  const w = world({ register: false, ...opts });
  w.member("frank");
  w.member("erin", { role: "admin" });
  const r = w.wz.wizardRegister({ ops: ALL_OPS.filter((o) => !lacking.includes(o)), ...(library ? { library } : {}) });
  assert.equal(r.ok, true, JSON.stringify(r));
  return w;
}
/* op=wizardcheck through the op table, as any credential asks it: each refusal's code and step */
const check = (w, steps) => wz.wizardScriptsOps(w.wz, new URL(`https://x/?viewer=${encodeURIComponent(F)}`), { steps }).wizardcheck()
  .refusals.map((x) => [x.code, x.step]);
/* a one-off library script, so wizardsAt can be asked what it offers on a screen */
const entry = (id, steps) => ({ id, name: id, required: false, version: 1, author: "civicsmith", approved: { by: "Bob", at: "2026-10-06" }, steps });

test("R31 (T47; N992; DEC-198 (1), DEC-199 (6)) the registry carries DEC-198's and DEC-199's acts: capture lists captureupload; connect lists subscriptionsignin and subscriptiondisconnect beside accountreferenceset and accountreferenceremove; answers lists ask and ruleanswer; matter lists escalationreopen; itemtakeup, actionscope, filingsecondapprove, escalationstoppursuing, infolevelset and subscriptionsignin are declared acts under their own names; control: op=wizardcheck admits captureupload on capture and refuses capture there (WIZARD_ACT_UNKNOWN)", () => {
  const acts = (id) => wz.SCREEN_REGISTRY.find((s) => s.id === id).acts;
  assert.ok(acts("capture").includes("captureupload") && !acts("capture").includes("capture"));
  for (const op of ["subscriptionsignin", "subscriptiondisconnect", "accountreferenceset", "accountreferenceremove"]) assert.ok(acts("connect").includes(op), op);
  assert.ok(acts("connect").indexOf("subscriptiondisconnect") > acts("connect").indexOf("accountreferenceset"), "beside the API key's acts, in the file's order");
  assert.ok(acts("answers").includes("ask") && acts("answers").includes("ruleanswer"));
  assert.ok(acts("matter").includes("escalationreopen"));
  for (const [screen, op] of [["plan", "itemtakeup"], ["action", "actionscope"], ["start-send", "filingsecondapprove"], ["matter", "escalationstoppursuing"],
                              ["account", "infolevelset"], ["connect", "subscriptionsignin"]]) {
    assert.ok(acts(screen).includes(op), `${screen}/${op}`);
    assert.equal(REG_FILE.screens.find((f) => f.id === screen).acts.find((a) => a.op === op).status, "declared", `${op} under its own name`);
  }
  const w = real();
  assert.deepEqual(check(w, [step("capture", "captureupload"), step("capture", null)]), []);
  assert.deepEqual(check(w, [step("capture", "capture"), step("capture", null)]), [["WIZARD_ACT_UNKNOWN", 1]], "control: capture is no act of capture");
  /* R13's rules unchanged: an op table lacking captureupload registers it no more */
  assert.deepEqual(check(real({ lacking: ["captureupload"] }), [step("capture", "captureupload"), step("capture", null)]), [["WIZARD_ACT_UNKNOWN", 1]]);
});

test("R35 (K3062, K3127, K3137; DEC-200–DEC-217; amended by R38, R41) the registry as PR #33's head held it, re-taken at the design commit named at T50's START (7be06eb4cb), named as the source: 71 screens, the two remaining dash-* treatments registered (dash-home is gone, R38); the owed acts passwordreset, passwordresetlink, grouplanguagesset, grouplogoset and signrequest registered as those ops once declared, projectaikeepaway as today; wizardsAt(\"group\") and op=wizardcheck admit grouplogoset; control: hostingaccess on setup is refused", () => {
  /* R44 moved the pin on to 8c5e692e19 and its 77 screens; this test's own claim is the registry the file then held, now the carried one */
  assert.deepEqual(wz.SCREEN_REGISTRY_SOURCE, { commit: "b1adf4236d", path: "docs/development/ux-substrate/screens/registry.json",
                                                sha256: createHash("sha256").update(src("registry.json"), "utf8").digest("hex") });
  assert.equal(wz.SCREEN_REGISTRY.length, 91);
  assert.deepEqual(wz.SCREEN_REGISTRY.map((s) => s.id), REG_FILE.screens.map((f) => f.id));
  const w = real();
  const registered = new Map(w.wz.registeredScreens().map((s) => [s.id, s.acts]));
  for (const id of ["dash-action", "dash-project"]) assert.ok(registered.get(id)?.length > 0, `${id}: registered, with its acts`);
  /* each act R35 names: registered as its op once declared, not while the op table lacks it */
  const NAMED = [["reset", "passwordreset"], ["members", "passwordresetlink"], ["group", "grouplanguagesset"], ["group", "grouplogoset"],
                 ["ceremony", "signrequest"], ["projectai", "projectaikeepaway"]];
  for (const [screen, op] of NAMED) {
    assert.ok(registered.get(screen).includes(op), `${screen}/${op} registered once declared`);
    const lacking = real({ lacking: [op] });
    assert.ok(!lacking.wz.registeredScreens().find((s) => s.id === screen).acts.includes(op), `${screen}/${op} not while undeclared`);
  }
  /* grouplogoset: offered on group, admitted by op=wizardcheck */
  const steps = [step("group", "grouplogoset"), step("group", null)];
  const g = real({ library: [entry("WIZ-t47-logo", steps)] });
  assert.deepEqual(g.wz.wizardsAt({ screen: "group", viewer: F }).scripts.map((x) => x.id), ["WIZ-t47-logo"]);
  assert.deepEqual(check(g, steps), []);
  /* control: setup's act is hostingaccessset (DEC-205 (3)); hostingaccess is refused, and a script walking it withheld */
  assert.ok(registered.get("setup").includes("hostingaccessset") && !registered.get("setup").includes("hostingaccess"));
  const bad = [step("setup", "hostingaccess"), step("setup", null)];
  assert.deepEqual(check(g, bad), [["WIZARD_ACT_UNKNOWN", 1]]);
  const h = real({ library: [entry("WIZ-t47-hosting", bad)] });
  assert.deepEqual(h.wz.wizardsAt({ screen: "setup", viewer: F }).scripts, []);
  assert.deepEqual(check(h, [step("setup", "hostingaccessset"), step("setup", null)]), [], "negative control: the served act passes");
});

test("R32 (T47; N992; DEC-198 (2); K2241) Connect your Claude account's version 3, from a0fab7abf0, approved by BOB on the date of the adoption and authored by the Civicsmith library: its code step sends the code by subscriptionsignin, a step for an API key (accountreferenceset) follows, and its last step disconnects by subscriptiondisconnect, as the file words them; id, name, required and start kept; version 2 updated, naming it, readable and not offered; control: wizardsAt(\"connect\") answers the latest version (4 since the re-take, R42), version 3 readable and updated, and no offered version's last step is accountreferenceremove", () => {
  const c = by(word("wizard.WIZ-74328804ddae3503.name"));
  const file = LIB_T47A.scripts.find((s) => s.name === c.name);
  const v3 = { version: 3, ...c.earlier[2] };   /* R42's re-take made version 4 of it, version 3 kept whole */
  assert.deepEqual([c.id, c.name, c.required, c.start, v3.version, v3.source, v3.author, v3.approved],
                   [file.id, file.name, false, "connect", 3, "a0fab7abf0", "civicsmith", { by: "BOB", at: "2026-10-14", ruling: "K2241" }]);
  const code = v3.steps.findIndex((t) => /code/i.test(t.what) && t.act === "subscriptionsignin");
  assert.ok(code > 0, "the code step, sent by subscriptionsignin");
  assert.deepEqual(v3.steps[code].what, fileStep(LIB_T47A, c.name, code).what, "as the file words it");
  assert.equal(v3.steps[code + 1].act, "accountreferenceset", "a step for an API key follows");
  assert.match(v3.steps[code + 1].what, /API key/);
  assert.equal(v3.steps[v3.steps.length - 1].act, "subscriptiondisconnect", "the last step disconnects");
  assert.deepEqual(v3.steps.map((t) => [t.screen, t.act, t.what, t.why]), file.versions[0].steps.map((t) => [t.screen, t.act, t.what, t.why]), "the file's steps, step by step");
  const w = real();
  assert.deepEqual(w.wz.wizardsAt({ screen: "connect", viewer: F }).scripts.filter((s) => s.id === c.id).map((s) => s.version), [`${c.id}@${c.version}`]);
  assert.equal(c.version, 4);
  const three = w.wz.wizardRead({ script: c.id, version: `${c.id}@3`, viewer: F });
  assert.deepEqual([three.version.state, three.version.updated_by, three.offered], ["updated", `${c.id}@4`, false]);
  const two = w.wz.wizardRead({ script: c.id, version: `${c.id}@2`, viewer: F });
  assert.deepEqual([two.version.state, two.version.updated_by, two.offered], ["updated", `${c.id}@3`, false]);
  assert.equal(two.version.steps[two.version.steps.length - 1].act, "accountreferenceremove", "control: version 2 ended on accountreferenceremove");
  /* no offered version, anywhere, ends on accountreferenceremove */
  const offered = w.wz.wizardRegistry({ viewer: F }).screens.flatMap((s) => s.scripts);
  assert.ok(offered.length >= 20);
  for (const x of offered) assert.notEqual(x.steps[x.steps.length - 1].act, "accountreferenceremove", x.name);
});

test("R33 (T47; N992; DEC-198 (4); R41) FRONT_DOORS are library.json's doors at the design commit named at T50's START (7be06eb4cb; the same five as at a0fab7abf0), frozen: five, problem, person, money, read and tip, each {door, scripts} naming the file's script ids in its order; with every named script offered startFrom answers the five in that order; with Follow the money withdrawn, money names only Get a record; with Get a record withheld too (no @records-request template offered), money is left out", () => {
  assert.deepEqual(wz.FRONT_DOORS_SOURCE, { commit: "1cc4a957f0", path: "docs/development/ux-substrate/screens/library.json",
                                            sha256: createHash("sha256").update(src("library-1cc4a957f0.json"), "utf8").digest("hex") });
  assert.deepEqual(wz.FRONT_DOORS, LIB_T50.doors.filter((d) => d.door !== "elsewhere").map((d) => ({ door: d.door, scripts: d.scripts })));
  assert.deepEqual(wz.FRONT_DOORS, LIB_T47A.doors.map((d) => ({ door: d.door, scripts: d.scripts })), "the five are those of a0fab7abf0");
  assert.deepEqual(LIB_T47.doors, LIB_T47A.doors, "the same at PR #33's head");
  assert.deepEqual(JSON.parse(src("library-4664e8efd4.json")).doors, LIB_T47A.doors, "the same at PR #34's merge, which holds no sixth door (R37)");
  assert.deepEqual(wz.FRONT_DOORS.map((d) => d.door), ["problem", "person", "money", "read", "tip"]);
  assert.ok(Object.isFrozen(wz.FRONT_DOORS) && Object.isFrozen(wz.FRONT_DOORS[0]) && Object.isFrozen(wz.FRONT_DOORS[0].scripts));
  const ids = new Set(wz.CIVICSMITH_LIBRARY.map((e) => e.id));
  for (const d of wz.FRONT_DOORS) for (const id of d.scripts) assert.ok(ids.has(id), `${d.door}: ${id} is a carried script`);
  assert.ok(!JSON.stringify(wz.FRONT_DOORS).includes("door.front"), "the doors' words are the interface's, not carried");
  const names = (doors) => doors.map((d) => [d.door, d.scripts.map((id) => wz.CIVICSMITH_LIBRARY.find((e) => e.id === id).name)]);
  /* every named script offered (the test profile offers "Records request") */
  const all = real();
  const before = all.snapshot();
  assert.deepEqual(five(all.wz.startFrom({ viewer: F }).doors), wz.FRONT_DOORS.map((d) => ({ door: d.door, scripts: [...d.scripts] })));
  assert.deepEqual(all.snapshot(), before, "writes nothing");
  /* Follow the money withdrawn (not in the library registered) */
  const money = by(word("wizard.WIZ-df0b5c4d0ffcdde7.name")), get = by(word("wizard.WIZ-cb0ad18a17a04233.name"));
  const without = real({ library: wz.CIVICSMITH_LIBRARY.filter((e) => e.id !== money.id) });
  const doors = five(without.wz.startFrom({ viewer: F }).doors);
  assert.deepEqual(names(doors), [["problem", [word("wizard.WIZ-86b7f4007e3b0e3c.name"), word("wizard.WIZ-cb0ad18a17a04233.name"), word("wizard.WIZ-33b5887790b7561b.name")]], ["person", [word("wizard.WIZ-86b7f4007e3b0e3c.name"), word("wizard.WIZ-9f2b79390d6940a0.name")]],
                                  [word("label.connectionkinds.money_flow"), [word("wizard.WIZ-cb0ad18a17a04233.name")]], ["read", [word("wizard.WIZ-33b5887790b7561b.name"), word("wizard.WIZ-a15d174f7a2c1dc5.name"), word("wizard.WIZ-4cdbd26939d4cc6d.name")]],
                                  ["tip", [word("wizard.WIZ-33b5887790b7561b.name"), word("wizard.WIZ-9f2b79390d6940a0.name")]]]);
  /* Get a record withheld too: no @records-request template offered */
  const neither = real({ library: wz.CIVICSMITH_LIBRARY.filter((e) => e.id !== money.id), templates: "unreviewed" });
  const left = five(neither.wz.startFrom({ viewer: F }).doors);
  assert.deepEqual(left.map((d) => d.door), ["problem", "person", "read", "tip"], "money is left out");
  assert.ok(!left.some((d) => d.scripts.includes(get.id) || d.scripts.includes(money.id)));
  assert.deepEqual(neither.wz.startFrom({ viewer: "nobody" }).doors.map((d) => d.door), ["elsewhere"], "a viewer the rule admits to nothing is offered no script door, only the way out (R37)");
  /* a door names any offered script, a required one included, though the guided starts leave it out */
  const req = real({ library: wz.CIVICSMITH_LIBRARY.map((e) => (e.name === word("wizard.WIZ-33b5887790b7561b.name") ? { ...e, required: true } : e)) });
  const answered = req.wz.startFrom({ viewer: F });
  const check = by(word("wizard.WIZ-33b5887790b7561b.name"));
  assert.ok(!answered.scripts.some((x) => x.id === check.id), "a required script is no guided start");
  assert.deepEqual(five(answered.doors).filter((d) => d.scripts.includes(check.id)).map((d) => d.door), ["problem", "read", "tip"], "it stays behind its doors");
});

test("R34 (T47; N984; K3027; ai-runs R78, run-rules R29) on a test instance whose own-words part has not passed its bar, writingHelp's answer past every refusal carries untested, the label as ai-runs answers it; the same request off a test instance carries none; no refusal carries it; nothing is written", () => {
  const ask = (w, x = {}) => w.wz.writingHelp({ op: "notewrite", field: "text", told: "The gate was locked.", assistant: ON, by: F, viewer: F, ...x });
  const LABEL = { kind: "untested", part: "draft:own_words", set: "civicsmith", set_version: 1, words: "ai.label.untested" };
  assert.equal(wz.WRITING_HELP_PART, "draft:own_words");
  const on = seeded({ env: TEST_ENV });
  const before = on.snapshot();
  const r = ask(on);
  assert.deepEqual([r.ok, r.code, r.untested], [false, "ASSISTANT_DRAFT_UNAVAILABLE", LABEL]);
  assert.ok(Object.isFrozen(r.untested), "the label as given, never composed here");
  assert.deepEqual(ask(on, { op: "testify", field: "observation" }).untested, LABEL, "a firsthand field too");
  /* refusals carry none, on a test instance */
  for (const [x, code] of [[{ op: "publish" }, "WRITING_HELP_REFUSED"], [{ field: "reason" }, "WRITING_HELP_REASON_FIELD"],
                           [{ draftHeld: true }, "WRITING_HELP_DRAFT_HELD"], [{ told: "" }, "WRITING_HELP_NOTHING_TOLD"],
                           [{ assistant: { on: true } }, "AI_NO_ACCOUNT"]]) {
    const k = ask(on, x);
    assert.deepEqual([k.code, "untested" in k], [code, false], code);
  }
  assert.deepEqual(on.snapshot(), before, "writes nothing");
  /* control: the same request off a test instance (the pair unequal, empty, absent) carries none */
  for (const env of [{ CIVICSMITH_TEST_INSTANCE: "biotest2", INSTANCE_NAME: "biotest1" }, { CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "" }, undefined]) {
    const k = ask(seeded({ env }));
    assert.deepEqual([k.code, "untested" in k], ["ASSISTANT_DRAFT_UNAVAILABLE", false], JSON.stringify(env));
  }
  /* the body never reaches it: a test-instance field sent with the request is not read */
  const off = seeded();
  assert.equal("untested" in ask(off, { CIVICSMITH_TEST_INSTANCE: "x", env: TEST_ENV }), false);
});

test("R34 the label follows ai-runs' admission, read at each call: a part the bar admits carries none on a test instance; a read that throws, or a part not admitted, answers run-rules' label exactly when ai-runs.testInstance() answers true (on a test instance an output is never left unmarked); an ai-runs that cannot be reached answers none", () => {
  const w = seeded({ register: false });
  const LABEL = Object.freeze({ kind: "untested", part: "draft:own_words", set: "civicsmith", set_version: 1, words: "ai.label.untested" });
  const asked = [];
  const make = (aiRuns) => {
    const x = new wz.WizardScripts({ storage: w.st, record: w.record, membership: w.membership, filingTemplates: w.filingTemplates,
                                     accounts: w.accounts, aiRuns, now: () => Date.parse(w.clock.now) });
    x.migrate();
    x.wizardRegister(registration());
    return (o = {}) => x.writingHelp({ op: "notewrite", field: "text", told: "The gate was locked.", assistant: ON, by: F, viewer: F, ...o });
  };
  const said = { admitted: true, untested: LABEL };
  const ai = { partAdmitted: (p) => { asked.push(p); return said; }, testInstance: () => true };
  const ask = make(ai);
  assert.equal(ask().untested, LABEL, "as ai-runs answers it, the same object");
  assert.deepEqual(asked, ["draft:own_words"]);
  said.untested = null;
  assert.equal("untested" in ask(), false, "admitted by the bar: none, though this is a test instance");
  said.admitted = false; said.untested = null;
  assert.deepEqual(ask().untested, LABEL, "not admitted (as ai-runs answers a record it cannot read), on a test instance: run-rules' label");
  const notTest = make({ partAdmitted: () => ({ admitted: false, untested: null }), testInstance: () => false });
  assert.equal("untested" in notTest(), false, "control: not admitted, off a test instance: none");
  said.admitted = true; said.untested = LABEL;
  assert.equal(ask().untested, LABEL, "read at each call");
  /* a read that throws */
  const throws = (testInstance) => make({ partAdmitted: () => { throw new Error("unreadable"); }, testInstance })();
  assert.deepEqual(throws(() => true).untested, LABEL, "on a test instance an output is never left unmarked");
  assert.equal("untested" in throws(() => false), false);
  assert.equal("untested" in throws(() => { throw new Error("x"); }), false);
  /* ai-runs unreachable */
  assert.equal("untested" in make(() => { throw new Error("no ai-runs"); })(), false);
  assert.equal(make(() => { throw new Error("no ai-runs"); })().code, "ASSISTANT_DRAFT_UNAVAILABLE", "the answer otherwise unchanged");
});

test("R36 (K2241; DEC-205 (3), DEC-207 (10), DEC-208 (2), DEC-213 (1)) Set up and claim and Publication ceremony as PR #33's head (f90b187c7b) worded them are adopted as version 3 (Set up and claim's since followed by versions 4 and 5, R38, R42; the ceremony's by version 4, R42), approved by BOB: Set up and claim's step 1 names the Workers Paid plan and its step 14 is hostingaccessset; the ceremony's steps 9–11 as the file re-words them; each keeps its id, name, required and start; versions 1 and 2 updated, each naming its successor, readable and not offered", () => {
  const BOB = { by: "BOB", at: "2026-10-14", ruling: "K2241" };
  const setup = by(word("wizard.WIZ-c887066cc553dd41.name")), ceremony = by(word("wizard.WIZ-426b9c2e8b128b6b.name"));
  for (const e of [setup, ceremony]) {
    const f = LIB_T47.scripts.find((s) => s.name === e.name);
    /* the version R36 adopts: the entry's own for the ceremony, the earlier version 3 of Set up and claim (R38's version 4 follows it) */
    const v3 = { version: 3, ...e.earlier[2] };
    assert.deepEqual([e.id, e.name, e.required, e.start], [f.id, f.name, true, f.start], e.name);
    assert.deepEqual([v3.version, v3.source, v3.approved], [3, "f90b187c7b", BOB], e.name);
    assert.deepEqual(e.earlier.map((v) => v.version), e === setup ? [1, 2, 3, 4] : [1, 2, 3]);
  }
  const setup3 = setup.earlier[2];
  assert.match(setup3.steps[0].what, /Workers Paid plan/);
  assert.ok(!/free plan works/i.test(setup3.steps[0].why), "DEC-213 (1): no longer the free plan");
  assert.match(setup.earlier[1].steps[0].why, /free plan works/i, "control: version 2 said so");
  assert.deepEqual([setup3.steps[13].screen, setup3.steps[13].act], ["setup", "hostingaccessset"]);
  assert.equal(setup.earlier[1].steps[13].act, "hostingaccess", "control: version 2's step 14");
  for (const i of [8, 9, 10]) {
    const want = fileStep(LIB_T47, word("wizard.WIZ-426b9c2e8b128b6b.name"), i);
    const c3 = ceremony.earlier[2].steps[i];   /* version 3, the one R36 adopts */
    assert.deepEqual([c3.act, c3.what, c3.why], [want.act, want.what, want.why], `step ${i + 1}`);
    assert.notDeepEqual([c3.what, c3.why], [ceremony.earlier[1].steps[i].what, ceremony.earlier[1].steps[i].why], `step ${i + 1} re-worded`);
  }
  assert.deepEqual(ceremony.earlier[2].steps.slice(0, 8), ceremony.earlier[1].steps.slice(0, 8), "steps 1–8 unchanged");
  const w = real();
  for (const [e, screen] of [[setup, "install"], [ceremony, "ceremony"]]) {
    assert.deepEqual(w.wz.wizardsAt({ screen, viewer: F }).scripts.filter((s) => s.id === e.id).map((s) => s.version), [`${e.id}@${e.version}`], e.name);
    for (const [n, next] of [[1, 2], [2, 3], [3, 4], [4, 5]].filter(([n]) => n < e.version)) {
      const r = w.wz.wizardRead({ script: e.id, version: `${e.id}@${n}`, viewer: F });
      assert.deepEqual([r.version.state, r.version.updated_by, r.offered], ["updated", `${e.id}@${next}`, false], `${e.name} v${n}`);
    }
  }
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: ["publish"], machineDrafts: [],
                                         irreversible: ["publish", "publishat", "publishatmove"], library: wz.CIVICSMITH_LIBRARY }), [], "R14: the required flows pass");
  assert.equal(w.wz.wizards({ viewer: E }).scripts.find((s) => s.id === setup.id).versions.length, 1, "R10: the offered version alone listed");
});
