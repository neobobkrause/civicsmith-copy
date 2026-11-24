/* wizard-scripts: the carried data, the screen registry (R13) and the first Civicsmith library (R22), the required flows'
   release check over them (R14) and the home's "Start from…" (R23), at the module's interface. The design files are
   vendored under `source/` as they stand at the commit the job's START names; the tests hold the carried data equal
   to them, screen by screen, act by act, script by script and step by step. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { seeded, approved, draft, world, registration, V, MACHINE, STEPS, step, SCREENS, OPS, MACHINE_REFUSED, MACHINE_DRAFTS, LIBRARY } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = V("alice"), F = V("frank"), E = V("erin"), D = V("dave");
const src = (f) => readFileSync(new URL(`./source/${f}`, import.meta.url), "utf8");
const REG_FILE = JSON.parse(src("registry.json")), LIB_FILE = JSON.parse(src("library.json"));
/* PR #14's library, from which BOB adopted version 2 of four scripts (T37), and PR #19's, of two more (T41) (R22; K2241). */
const LIB_NEW = JSON.parse(src("library-e08cd35ecb.json"));
const LIB_T41 = JSON.parse(src("library-3660c18803.json"));
/* PR #28's library (`3f40899950`, on main at T46's L11 START), from which BOB adopted Start and send's version 2 and
   added DEC-194 (5)'s five scripts (R30; K2241). */
const LIB_T46 = JSON.parse(src("library-3f40899950.json"));
/* T47: PR #31's library (`a0fab7abf0`, DEC-198, DEC-199), from which BOB adopted Connect's version 3 (R32) and whose doors
   are the front doors (R33); and PR #33's head as merged into tranche/T47 at L11's START (`f90b187c7b`), from which BOB
   adopted the newest Set up and claim and Publication ceremony (R36), its registry the snapshot's source (R35). */
const LIB_T47A = JSON.parse(src("library-a0fab7abf0.json"));
const LIB_T47 = JSON.parse(src("library-f90b187c7b.json"));
/* T48: PR #34's merge (`4664e8efd4`, K3190), from which BOB adopted Set up and claim's version 4 and Start and send's version 3
   and added Update your group's Civicsmith (R38); the registry here is PR #34's, the snapshot's source */
const LIB_T48 = JSON.parse(src("library-4664e8efd4.json"));
const ADDED_T48 = ["Update your group's Civicsmith"];
/* T50 (R41, R42; DEC-266, DEC-279, DEC-281): the design commit named at START (`7be06eb4cb`), the registry here and the library
   BOB re-takes whole (K2241): 23 scripts, one version in the file each; DEC-281's team pass renamed four. */
const LIB_T50 = JSON.parse(src("library-7be06eb4cb.json"));
const T50 = { by: "BOB", at: "2026-10-17", ruling: "K2241" };
const LIB_R45 = JSON.parse(src("library-1cc4a957f0.json"));   /* R45: the fix round re-takes the library again */
const R45 = { by: "BOB", at: "2026-10-20", ruling: "K2241" };
const RENAMED = { "Say who your group is": word("wizard.WIZ-4d42b0233d48913f.name"), "Update your group's Civicsmith": word("wizard.WIZ-7de505135a9ecd4f.name"),
                  "Use another group's case": word("wizard.WIZ-4cdbd26939d4cc6d.name"), "Comment for the group": word("wizard.WIZ-f06504b9133b8d61.name") };
const nameNow = (n) => RENAMED[n] ?? n;
const ADOPTED_T37 = [word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-426b9c2e8b128b6b.name"), word("wizard.WIZ-33b5887790b7561b.name"), word("wizard.WIZ-a15d174f7a2c1dc5.name")];
const ADOPTED_T41 = [word("wizard.WIZ-74328804ddae3503.name"), word("wizard.WIZ-8e7e2fac33d069f8.name")];
const ADOPTED_T46 = [word("wizard.WIZ-a8c349d7d71b6bb0.name")];
const ADOPTED = [...ADOPTED_T37, ...ADOPTED_T41, ...ADOPTED_T46];
const ADDED_T46 = ["Comment for the group", word("wizard.WIZ-bd7bde2c61b6badb.name"), word("wizard.WIZ-33cece8a68e76f58.name"), word("wizard.WIZ-d0cdcee9437b213b.name"), word("wizard.WIZ-a17835c4d8235f65.name")];
const T37 = { by: "BOB", at: "2026-10-08", ruling: "K2241" }, T41 = { by: "BOB", at: "2026-10-10", ruling: "K2241" };
const T46 = { by: "BOB", at: "2026-10-12", ruling: "K2241" }, T47 = { by: "BOB", at: "2026-10-14", ruling: "K2241" };
const T48 = { by: "BOB", at: "2026-10-14", ruling: "K2241" };
const V1 = { by: "Bob", at: "2026-10-06" };
/* each adopted script's versions after its version 1, oldest first: the version, the file and commit it comes from, and
   its adoption (R22, R30, R32, R36; K2241) */
const CHAINS = {
  [word("wizard.WIZ-c887066cc553dd41.name")]: [[2, LIB_NEW, "e08cd35ecb", T37], [3, LIB_T47, "f90b187c7b", T47], [4, LIB_T48, "4664e8efd4", T48]],
  [word("wizard.WIZ-426b9c2e8b128b6b.name")]: [[2, LIB_NEW, "e08cd35ecb", T37], [3, LIB_T47, "f90b187c7b", T47]],
  [word("wizard.WIZ-33b5887790b7561b.name")]: [[2, LIB_NEW, "e08cd35ecb", T37]],
  [word("wizard.WIZ-a15d174f7a2c1dc5.name")]: [[2, LIB_NEW, "e08cd35ecb", T37]],
  [word("wizard.WIZ-74328804ddae3503.name")]: [[2, LIB_T41, "3660c18803", T41], [3, LIB_T47A, "a0fab7abf0", T47]],
  [word("wizard.WIZ-8e7e2fac33d069f8.name")]: [[2, LIB_T41, "3660c18803", T41]],
  [word("wizard.WIZ-a8c349d7d71b6bb0.name")]: [[2, LIB_T46, "3f40899950", T46], [3, LIB_T48, "4664e8efd4", T48]],
};
/* each adopted script: the version it offers, the file and commit that version comes from, and its adoption */
const adoption = (name) => { const [version, file, commit, approved] = CHAINS[name][CHAINS[name].length - 1]; return { version, file, commit, approved }; };
/* DEC-188 (8): the acts PR #19 removed from the registry */
const RETIRED_ACTS = ["aiceilingset", "aicopyceilingset", "accountswitchset", "groupswitchset"];
const OWED = /^owed:([a-z][a-z0-9]*)(?:\s+(DEC-\d+|K\d+))?$/;   /* a ruling owes it: a DEC or a K (PR #13) */
/* Every op the registry names, owed ones as their op: the member op table once each owed op is declared. */
const ALL_OPS = [...new Set(REG_FILE.screens.flatMap((s) => s.acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op))))];
const OWED_OPS = [...new Set(REG_FILE.screens.flatMap((s) => s.acts.filter((a) => a.status === "owed").map((a) => OWED.exec(a.op)[1])))];
/* A screen's acts in the registry file's order, owed ones as their op: what the registry names, read from the file (K3268: other modules' ops are not hand-listed). */
const fileOps = (id) => REG_FILE.screens.find((f) => f.id === id).acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op));
const REFUSED = ["release", "conclude", "withdrawconclusion", "reopen", "publish"];
/* R30: the acts PR #28 owes (K2780) that the added scripts walk, and the script walking each */
const OWED_T46 = { escalationstoppursuing: word("wizard.WIZ-33cece8a68e76f58.name"), actionscope: word("wizard.WIZ-d0cdcee9437b213b.name"), itemtakeup: word("wizard.WIZ-a17835c4d8235f65.name") };
const real = (x = {}) => ({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: REFUSED, machineDrafts: [...MACHINE_DRAFTS, "writinghelp", "groupdescriptiondraft"],
                            irreversible: ["publish", "publishat", "publishatmove"], library: wz.CIVICSMITH_LIBRARY, ...x });
const row = (c) => wz.WIZARD_SCRIPTS_CHECKS[c];
const refused = (r, c, why = "") => {
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, c, c, row(c).check, row(c).translation], `${why} ${JSON.stringify(r).slice(0, 300)}`);
  return r;
};

test("R13 SCREEN_REGISTRY is DEC-139's registry as the file holds it, screen by screen and act by act: [{id, name, purpose, acts}], acts the declared and function ops in the file's order, owed acts apart; frozen; its source the vendored file", () => {
  const sha = createHash("sha256").update(src("registry.json"), "utf8").digest("hex");
  assert.deepEqual(wz.SCREEN_REGISTRY_SOURCE, { commit: "b1adf4236d", path: "docs/development/ux-substrate/screens/registry.json", sha256: sha });
  assert.equal(wz.SCREEN_REGISTRY.length, REG_FILE.screens.length);
  assert.equal(wz.SCREEN_REGISTRY.length, 91, "R50: the file at b1adf4236d, the design commit of DEC-419 (G53)");
  REG_FILE.screens.forEach((f, i) => {
    const s = wz.SCREEN_REGISTRY[i];
    assert.deepEqual([s.id, s.name, s.purpose], [f.id, f.name, f.purpose], f.id);
    assert.deepEqual(s.acts, [...new Set(f.acts.filter((a) => a.status === "declared" || a.status === "function").map((a) => a.op))], `${f.id} acts (R45: an op two acts share is one act)`);
    const owed = [];
    const seen = new Set();
    for (const a of f.acts) {
      if (a.status === "owed") { const m = OWED.exec(a.op); owed.push({ op: m[1], dec: m[2], at: seen.size }); } else seen.add(a.op);
    }
    assert.deepEqual(s.owed, owed, `${f.id} owed`);
    for (const a of s.acts) assert.ok(!a.startsWith("owed:"), "an owed act names no op among acts");
  });
  assert.ok(Object.isFrozen(wz.SCREEN_REGISTRY) && Object.isFrozen(wz.SCREEN_REGISTRY[0]) && Object.isFrozen(wz.SCREEN_REGISTRY[0].acts));
});

test("R13 (T41; DEC-188; K2484) the registry keeps PR #19's screen projectai (re-taken since, R29, R31, R35); aiceilingset, aicopyceilingset, accountswitchset and groupswitchset appear nowhere in it; ailimitset, accountusesset, projectkeyset, projectsigninset and (DEC-217) projectaikeepaway, owed at PR #19 and declared or function acts since, are registered as their ops once the op table holds them and not before", () => {
  const projectai = wz.SCREEN_REGISTRY.find((s) => s.id === "projectai");
  assert.deepEqual([projectai.name, projectai.acts], [word("screen.projectai.name"), fileOps("projectai")]);
  assert.deepEqual(projectai.owed, [], "DEC-217: the owed mark off projectaikeepaway, a declared act");
  const text = JSON.stringify(wz.SCREEN_REGISTRY);
  for (const op of RETIRED_ACTS) assert.ok(!text.includes(`"${op}"`), `${op} gone`);
  for (const op of ["aiceilingset", "accountswitchset"]) assert.ok(src("library-e08cd35ecb.json").includes(`"${op}"`), `control: ${op} was named before PR #19`);
  /* registered once declared (op-declarations R41), at the file's place; undeclared, not registered */
  /* DEC-188's acts: projectai's, but projectjoin (a function act of PR #34), plus exploreapprove */
  const DEC188 = [...fileOps("projectai").filter((op) => op !== "projectjoin"), "exploreapprove"];
  const declared = seeded({ register: false });
  declared.wz.wizardRegister({ ops: ALL_OPS, library: [] });
  const by = Object.fromEntries(declared.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual(by.projectai, [...projectai.acts]);
  assert.deepEqual(by.connect, fileOps("connect"));
  assert.deepEqual(by.setup.slice(9, 12), ["groupkeyset", "groupkeyswitch", "ailimitset"], "in aicopyceilingset's old place");
  assert.ok(by.teamai.includes("accountusesset") && by.teamai.includes("ailimitset"), "the team's assistant (teamai) holds them since DEC-281's pass");
  for (const op of RETIRED_ACTS) assert.ok(!Object.values(by).some((acts) => acts.includes(op)), op);
  const undeclared = seeded({ register: false });
  undeclared.wz.wizardRegister({ ops: ALL_OPS.filter((o) => !DEC188.includes(o)), library: [] });
  const un = Object.fromEntries(undeclared.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual(un.projectai, ["projectjoin"], "negative control: none of DEC-188's declared, none registered; projectjoin, a function act of PR #34 on, is not among them and stays");
  for (const op of DEC188) assert.ok(!Object.values(un).some((acts) => acts.includes(op)), `${op} undeclared`);
  assert.deepEqual(wz.checkScript([step("connect", "ailimitset"), step("connect", null)], real()).refusals, []);
  assert.deepEqual(wz.checkScript([step("connect", "ailimitset"), step("connect", null)], real({ ops: ALL_OPS.filter((o) => o !== "ailimitset") })).refusals.map((x) => x.code),
                   ["WIZARD_ACT_UNKNOWN"]);
  assert.deepEqual(wz.checkScript([step("connect", "aiceilingset"), step("connect", null)], real({ ops: [...ALL_OPS, "aiceilingset"] })).refusals.map((x) => x.code),
                   ["WIZARD_ACT_UNKNOWN"], "a retired act is no act of its screen, declared or not");
});

test("R13 (T37; K2171) the registry is re-taken from PR #14's merge onward: connect is still \"The assistant\", setup no longer offers assistantset, and the library keeps its own commit (R22): each file names its own", () => {
  assert.deepEqual(REG_FILE.screens.find((f) => f.id === "connect").name, "The assistant", "the vendored file is PR #14's");
  const setup = wz.SCREEN_REGISTRY.find((s) => s.id === "setup");
  assert.ok(!setup.acts.includes("assistantset") && !REG_FILE.screens.find((f) => f.id === "setup").acts.some((a) => a.op === "assistantset"),
            "PR #14 drops assistantset (DEC-182 (3))");
  assert.deepEqual(wz.SCREEN_REGISTRY.find((s) => s.id === "proceeding").acts[0], "entitycreate", "DEC-182 (1): registerproceeding re-pointed");
  const connect = wz.SCREEN_REGISTRY.find((s) => s.id === "connect");
  assert.equal(connect.name, "The assistant");
  const w = seeded({ register: false });
  w.wz.wizardRegister({ library: [] });
  assert.deepEqual(w.wz.registeredScreens().find((s) => s.id === "connect").acts, [...connect.acts], "registered by default");
  assert.ok(!JSON.stringify(wz.SCREEN_REGISTRY).includes("The assistant and your account"), "the old name is gone");
  assert.equal(wz.CIVICSMITH_LIBRARY_SOURCE.commit, "d129238bf3", "the library's version 1 is not re-taken (R22)");
});

test("R13 a registration without screens registers SCREEN_REGISTRY; an owed act is registered as its op, in the file's order, only once the member op table declares it; with no op table none is", () => {
  /* the acts the file still owes (R35, R38, R41): the installer's four routes, `founderhandleset`, members' `passwordresetlink` after
     memberadd, DEC-226's three update acts and the six T50 adds (K3674 among them); fifteen ops, `updatelater` on two screens */
  assert.equal(OWED_OPS.length, 105, "R50: 105 owed ops at b1adf4236d (42 at R48's 654a735535, and T52's owed acts since)");
  for (const op of ["installupdate", "installalongside", "installremove", "installremoveconfirm", "founderhandleset", "passwordresetlink", "updatestart", "updatelater", "updateskip"])
    assert.ok(OWED_OPS.includes(op), op);
  const w = seeded({ register: false });
  const r = w.wz.wizardRegister({ ops: ALL_OPS.filter((o) => !OWED_OPS.includes(o)), library: [] });
  assert.deepEqual([r.ok, r.screens], [true, 91]);
  const by = Object.fromEntries(w.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual(by.members.slice(0, 3), ["memberadd", "signerset", "signeradd"], "passwordresetlink undeclared: not registered");
  const all = seeded({ register: false });
  all.wz.wizardRegister({ ops: ALL_OPS, library: [] });
  const byAll = Object.fromEntries(all.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual(byAll.members.slice(0, 3), ["memberadd", "passwordresetlink", "signerset"], "declared: registered at its place, between two declared acts");
  /* every registered act is the file's, in the file's order */
  for (const f of REG_FILE.screens) {
    const want = [...new Set(f.acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op)))];   /* an op two acts share is registered once */
    assert.deepEqual(byAll[f.id], want, f.id);
    assert.deepEqual(by[f.id], want.filter((op) => !OWED_OPS.includes(op)), f.id);
  }
  /* acts the file owed before and serves by name since (R31, R35) are no longer owed (declared, or a function's op as the file names it) */
  assert.deepEqual(["plan/itemtakeup", "start-send/filingsecondapprove", "connect/subscriptionsignin", "account/infolevelset", "matter/escalationstoppursuing",
                    "group/grouplogoset", "group/grouplanguagesset", "reset/passwordreset", "ceremony/signrequest", "projectai/projectaikeepaway"]
    .filter((x) => { const [sc, op] = x.split("/"); return REG_FILE.screens.find((f) => f.id === sc).acts.find((a) => a.op === op)?.status === "owed"; }), []);
  /* no op table: owed acts stay unregistered (negative control) */
  const w2 = seeded({ register: false });
  w2.wz.wizardRegister({ library: [] });
  const by2 = Object.fromEntries(w2.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.deepEqual([by2.members.includes("passwordresetlink"), by2.plan.includes("itemtakeup")], [false, true]);
  assert.deepEqual(w2.wz.registeredScreens().map((s) => s.acts), wz.SCREEN_REGISTRY.map((s) => [...new Set(s.acts)]));
  /* and a registered owed act is checked as any act is */
  assert.deepEqual(wz.checkScript([step("members", "passwordresetlink"), step("members", null)], real()).refusals, []);
  assert.deepEqual(wz.checkScript([step("members", "passwordresetlink")], real({ ops: ALL_OPS.filter((o) => o !== "passwordresetlink") })).refusals.map((x) => x.code),
                   ["WIZARD_ACT_UNKNOWN"]);
});

test("R29 (T46; N897 (1); DEC-139 (5), DEC-197) Your account (account) lists no handlechange, its setpassword and memberlanguageset are declared (and, since R31, infolevelset, registered only while the op table holds it); control: wizardsAt(\"account\") offers no script walking handlechange and op=wizardcheck refuses it (WIZARD_ACT_UNKNOWN), a declared act passing", () => {
  const account = wz.SCREEN_REGISTRY.find((s) => s.id === "account");
  assert.deepEqual([account.name, account.acts, account.owed],
                   ["Your account", fileOps("account"), []]);
  assert.deepEqual(["setpassword", "memberlanguageset", "infolevelset"].map((op) => REG_FILE.screens.find((f) => f.id === "account").acts.find((a) => a.op === op).status),
                   ["declared", "declared", "declared"]);
  assert.ok(!JSON.stringify(wz.SCREEN_REGISTRY).includes("handlechange"), "handlechange is no act of any screen (DEC-197)");
  /* an op table lacking infolevelset does not register it (R13, T37) */
  const reg = (ops, library = []) => { const w = world({ register: false }); w.member("frank"); w.wz.wizardRegister({ ops, library }); return w; };
  const acts = (w) => w.wz.registeredScreens().find((s) => s.id === "account").acts;
  assert.deepEqual(acts(reg(ALL_OPS)), [...account.acts]);
  assert.deepEqual(acts(reg(ALL_OPS.filter((o) => o !== "infolevelset"))), account.acts.filter((a) => a !== "infolevelset"));
  assert.deepEqual(acts(reg(null)), account.acts, "with no op table, the declared acts, setpassword and memberlanguageset among them");
  /* control: one registry for wizardsAt and op=wizardcheck, even with handlechange in the op table */
  const ops = [...ALL_OPS, "handlechange"];
  const entry = (id, act) => ({ id, name: id, required: false, version: 1, author: "civicsmith", approved: { by: "Bob", at: "2026-10-06" },
                                steps: [step("account", act), step("account", null)] });
  const w = reg(ops, [entry("WIZ-t46-handle", "handlechange"), entry("WIZ-t46-password", "setpassword")]);
  assert.deepEqual(w.wz.wizardsAt({ screen: "account", viewer: F }).scripts.map((x) => x.id), ["WIZ-t46-password"], "a script walking handlechange is withheld");
  const check = (act) => wz.wizardScriptsOps(w.wz, new URL(`https://x/?viewer=${encodeURIComponent(F)}`), { steps: [step("account", act), step("account", null)] })
    .wizardcheck().refusals.map((x) => [x.code, x.step]);
  assert.deepEqual(check("handlechange"), [["WIZARD_ACT_UNKNOWN", 1]]);
  assert.deepEqual(check("setpassword"), [], "negative control: a declared act of account passes");
  assert.deepEqual(check("memberlanguageset"), []);
});

test("R13 (T37; N776) with an op table registered, a declared or function act whose op the table lacks is not registered, as an owed act whose op is undeclared is not: registeredScreens, the registry form, wizardsAt and op=wizardcheck answer one registry, every listed act passing R12 and every unlisted one refused; with no op table every declared and function act stays registered", () => {
  const lacking = ["groupkeyswitch", "knock", "calculationcreate"];   /* declared on setup, function on doorbell, declared on finder */
  const ops = ALL_OPS.filter((o) => !lacking.includes(o));
  const w = world({ register: false });
  w.member("frank");
  w.wz.wizardRegister({ ops, library: [] });
  const by = Object.fromEntries(w.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.ok(!by.setup.includes("groupkeyswitch") && by.setup.includes("groupkeyset"), "the declared act the table lacks, gone; its neighbour kept");
  assert.ok(!by.doorbell.includes("knock"), "a function act the table lacks");
  assert.ok(!by.finder.includes("calculationcreate"));
  for (const f of REG_FILE.screens) {
    const want = [...new Set(f.acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op)))].filter((op) => ops.includes(op));
    assert.deepEqual(by[f.id], want, `${f.id}: the file's acts the table holds, in the file's order`);
  }
  assert.deepEqual(w.wz.wizardRegistry({ viewer: F }).screens.map((s) => [s.id, s.acts]), w.wz.registeredScreens().map((s) => [s.id, s.acts]));
  /* one registry: every registered act passes R12 through op=wizardcheck, every act the file lists and the table lacks is refused */
  const check = (screen, act) => wz.wizardScriptsOps(w.wz, new URL(`https://x/?viewer=${encodeURIComponent(F)}`), { steps: [step(screen, act), step(screen, null)] })
    .wizardcheck().refusals.map((x) => x.code);
  for (const sc of w.wz.registeredScreens()) for (const act of sc.acts) assert.deepEqual(check(sc.id, act), [], `${sc.id}/${act}`);
  for (const [screen, act] of [["setup", "groupkeyswitch"], ["doorbell", "knock"], ["finder", "calculationcreate"]])
    assert.deepEqual(check(screen, act), ["WIZARD_ACT_UNKNOWN"], `${screen}/${act}`);
  /* wizardsAt offers no script on an act the registry does not list: a group's draft naming one is refused at submit */
  assert.deepEqual(w.wz.wizardsAt({ screen: "doorbell", viewer: F }).scripts, []);
  /* negative control: with no op table every declared and function act is registered */
  const w0 = world({ register: false });
  w0.wz.wizardRegister({ library: [] });
  const by0 = Object.fromEntries(w0.wz.registeredScreens().map((s) => [s.id, s.acts]));
  assert.ok(by0.setup.includes("groupkeyswitch") && by0.doorbell.includes("knock") && by0.finder.includes("calculationcreate"));
  /* the test registry too: an op table lacking an act a screen lists */
  const t = seeded({ register: false });
  t.wz.wizardRegister(registration({ ops: OPS.filter((o) => o !== "casejoin") }));
  assert.deepEqual(t.wz.registeredScreens().find((s) => s.id === "case-home").acts, ["casenote"]);
  assert.deepEqual(t.wz.wizardCheck({ steps: [step("case-home", "casejoin"), STEPS[0]], viewer: F }).refusals.map((x) => [x.code, x.step]), [["WIZARD_ACT_UNKNOWN", 1]]);
});

/* R22, R42: each script's versions as they stood before T50's re-take, oldest first: `[version, file, commit, approved]`. A script
   is found in each file by its id (a name may have changed, DEC-281); the names it had at T48 are the file's at 4664e8efd4. */
const chainBefore = (k) => {
  const old = LIB_T48.scripts.find((x) => x.id === k.id).name;
  if (ADDED_T48.includes(old)) return [[1, LIB_T48, "4664e8efd4", T48]];
  if (ADDED_T46.includes(old)) return [[1, LIB_T46, "3f40899950", T46]];
  if (ADOPTED.includes(old)) return [[1, LIB_FILE, "d129238bf3", V1], ...CHAINS[old]];
  return [[1, LIB_FILE, "d129238bf3", V1]];
};
const stepsIn = (file, id) => {
  const idOf = Object.fromEntries(file.scripts.map((s) => [s.name, s.id]));
  return file.scripts.find((x) => x.id === id).versions.at(-1).steps.map((t) => {
    const m = typeof t.act === "string" ? OWED.exec(t.act) : null;
    return { screen: t.screen, act: m ? m[1] : t.act, what: t.what, why: t.why, ...(t.draft ? { draft: t.draft } : {}), ...(t.via ? { via: idOf[t.via] } : {}) };
  });
};

/* R42: what the re-take makes of a script: its versions before it (`chain`), whether it differed (name or steps) and so gained the
   file's content as the next version, and the version, source and approval the library then offers. */
const afterT50 = (k) => {
  const chain = chainBefore(k);
  const [pv, pfile, pcommit, papproved] = chain.at(-1);
  const changed = pfile.scripts.find((x) => x.id === k.id).name !== k.name || JSON.stringify(stepsIn(pfile, k.id)) !== JSON.stringify(stepsIn(LIB_T50, k.id));
  return { chain, changed, version: changed ? pv + 1 : pv, source: changed ? "2a64c5ae77" : pcommit, approved: changed ? T50 : papproved };
};
const onT50 = (e) => afterT50(LIB_T50.scripts.find((k) => k.id === e.id));
/* R45: what the fix round's re-take makes of it: the next version, approved on 2026-10-20, when the fix round's file differs from T50's */
const onR45 = (e) => {
  const t = onT50(e), a = LIB_T50.scripts.find((k) => k.id === e.id), b = LIB_R45.scripts.find((k) => k.id === e.id);
  return a.name !== b.name || JSON.stringify(stepsIn(LIB_T50, e.id)) !== JSON.stringify(stepsIn(LIB_R45, e.id)) ? { ...t, version: t.version + 1, approved: R45 } : t;
};

test("R22, R30, R32, R36, R42 CIVICSMITH_LIBRARY is the 23 scripts of library.json at the design commit 7be06eb4cb, in the file's order, each with the file's id, name, start and steps (screen, act, what, why, draft), a side trip as the named script's id and an owed act as its op: the latest version of every script is the file's content, script by script and step by step; a script whose name or steps differed from its latest carried version gained the file's as its next version, approved by BOB under K2241 on 2026-10-17, the earlier versions kept in earlier, oldest first; a script that did not differ keeps its version; the file's notes not carried", () => {
  const sha = (f) => createHash("sha256").update(src(f), "utf8").digest("hex");
  assert.deepEqual(wz.CIVICSMITH_LIBRARY_SOURCE, { commit: "d129238bf3", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library.json") });
  assert.deepEqual(wz.CIVICSMITH_LIBRARY_ADOPTED_SOURCES, [
    { commit: "e08cd35ecb", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-e08cd35ecb.json") },
    { commit: "3660c18803", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-3660c18803.json") },
    { commit: "3f40899950", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-3f40899950.json") },
    { commit: "a0fab7abf0", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-a0fab7abf0.json") },
    { commit: "f90b187c7b", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-f90b187c7b.json") },
    { commit: "4664e8efd4", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-4664e8efd4.json") },
    { commit: "7be06eb4cb", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-7be06eb4cb.json") },
    { commit: "20c8001300", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-20c8001300.json") },
    { commit: "2a64c5ae77", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-2a64c5ae77.json") },
    { commit: "1cc4a957f0", path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-1cc4a957f0.json") }]);
  const lib = wz.CIVICSMITH_LIBRARY;
  assert.equal(lib.length, 23);
  assert.equal(LIB_T50.scripts.length, 23);
  assert.deepEqual(lib.map((e) => e.id), LIB_T50.scripts.map((s) => s.id), "the design commit's order");
  assert.deepEqual(LIB_T50.scripts.map((s) => s.id), LIB_T48.scripts.map((s) => s.id), "the file at the design commit adds and moves no script");
  assert.deepEqual(LIB_T47.scripts.map((s) => s.id), LIB_T46.scripts.map((s) => s.id), "PR #33's head adds and moves no script");
  assert.deepEqual(LIB_T48.scripts.filter((s) => !ADDED_T48.includes(s.name)).map((s) => s.id), LIB_T47.scripts.map((s) => s.id), "PR #34 adds the update script and moves none");
  assert.deepEqual(lib.map((e) => e.id).filter((id) => LIB_FILE.scripts.some((s) => s.id === id)), LIB_FILE.scripts.map((s) => s.id), "the seventeen keep their order");
  const retaken = [];
  const second = [];
  LIB_T50.scripts.forEach((k, i) => {
    const e = lib[i];
    const k2 = LIB_R45.scripts.find((x) => x.id === k.id);
    assert.deepEqual([e.id, e.name, e.start], [k2.id, k2.name, k2.start], k.name);
    for (const key of ["note", "journeys", "versions"]) assert.equal(key in e, false, `${k.name}: ${key} not carried`);
    assert.deepEqual(e.steps, stepsIn(LIB_R45, k.id), `${k.name}: the latest version is the fix round's design commit content, step by step (R42, R45)`);
    assert.equal(e.required, [word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-7db08189cc0e58c3.name"), word("wizard.WIZ-426b9c2e8b128b6b.name")].includes(k.name), k.name);
    const chain = chainBefore(k);
    const [pv, pfile, pcommit, papproved] = chain.at(-1);
    const was = pfile.scripts.find((x) => x.id === k.id);
    const changed = was.name !== k.name || JSON.stringify(stepsIn(pfile, k.id)) !== JSON.stringify(stepsIn(LIB_T50, k.id));
    let held = (changed ? chain : chain.slice(0, -1)).map(([v, fl, c, approved]) => ({ version: v, steps: stepsIn(fl, k.id), author: "civicsmith", approved, source: c }));
    if (changed) retaken.push(k.name);
    let want = changed ? [pv + 1, "2a64c5ae77", T50] : [pv, pcommit, papproved];
    /* R45: a script whose name or steps differ again in the fix round's file gains it as the next version; the T50 latest is kept whole */
    if (k2.name !== k.name || JSON.stringify(stepsIn(LIB_R45, k.id)) !== JSON.stringify(stepsIn(LIB_T50, k.id))) {
      second.push(k2.name);
      held = [...held, { version: want[0], steps: stepsIn(LIB_T50, k.id), author: "civicsmith", approved: want[2], source: want[1] }];
      want = [want[0] + 1, "1cc4a957f0", R45];
    }
    assert.deepEqual([e.version, e.source, e.approved], want, `${k.name}: version`);
    if (held.length) assert.deepEqual(e.earlier, held, `${k.name}: every earlier version kept whole, oldest first`);
    else assert.equal("earlier" in e, false, k.name);
    const all = [...held.map((x) => x.steps), e.steps].map((x) => JSON.stringify(x));
    assert.equal(new Set(all).size, all.length, `${k.name}: each version differs from the others`);
  });
  assert.deepEqual(second, [word("wizard.WIZ-7db08189cc0e58c3.name")], "R45: only the welcome wizard changed in the fix round (DEC-384; step 4)");
  /* R42: sixteen of the 23 differed, four by name (DEC-281's team pass) */
  assert.equal(retaken.length, 16);
  assert.deepEqual(retaken.filter((n) => Object.values(RENAMED).includes(n)).sort(), Object.values(RENAMED).sort(), "the four renamed scripts carry the file's names");
  assert.deepEqual(LIB_T50.scripts.map((s) => s.name).filter((n) => !retaken.includes(n)).sort(),
                   [word("wizard.WIZ-9f2b79390d6940a0.name"), word("wizard.WIZ-33b5887790b7561b.name"), word("wizard.WIZ-a15d174f7a2c1dc5.name"), word("wizard.WIZ-df0b5c4d0ffcdde7.name"), word("wizard.WIZ-55930f07cb4e9499.name"), word("wizard.WIZ-a17835c4d8235f65.name"), word("wizard.WIZ-86b7f4007e3b0e3c.name")], "the seven that are the same");
  for (const [was, now] of Object.entries(RENAMED)) {
    assert.ok(!lib.some((e) => e.name === was), `${was}: gone`);
    assert.ok(lib.some((e) => e.name === now), `${now}: carried`);
  }
  /* the side trips and the owed acts, named */
  const vias = lib.flatMap((e) => e.steps.filter((s) => s.via).map((s) => [e.name, lib.find((x) => x.id === s.via).name]));
  assert.deepEqual(vias, [[word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-4d42b0233d48913f.name")], [word("wizard.WIZ-7db08189cc0e58c3.name"), word("wizard.WIZ-74328804ddae3503.name")],
                          [word("wizard.WIZ-7db08189cc0e58c3.name"), "Your ties"], [word("wizard.WIZ-33b5887790b7561b.name"), word("wizard.WIZ-cb0ad18a17a04233.name")]]);
  /* the acts a ruling owed when each version was written, carried as their ops; PR #33's head serves each by name */
  const OWED_ONCE = ["actionscope", "escalationstoppursuing", "itemtakeup", "subscriptionsignin"];
  assert.deepEqual([...new Set(lib.flatMap((e) => e.steps.map((s) => s.act)).filter((a) => OWED_ONCE.includes(a)))].sort(), OWED_ONCE);
  assert.deepEqual(lib.flatMap((e) => e.steps.map((s) => s.act)).filter((a) => OWED_OPS.includes(a)), ["updatestart"], "the only act still owed that an offered version walks is the update script's (R38, R42)");
  /* the offered versions name no act PR #19 removed (DEC-188 (8)); Connect's version 1, kept readable, still does */
  for (const op of RETIRED_ACTS) assert.ok(!lib.some((e) => e.steps.some((s) => s.act === op)), `${op}: no offered version`);
  const connect = lib.find((e) => e.name === word("wizard.WIZ-74328804ddae3503.name"));
  assert.deepEqual(connect.earlier[0].steps.map((s) => s.act).filter((a) => RETIRED_ACTS.includes(a)), ["aiceilingset", "accountswitchset"]);
  assert.ok(!JSON.stringify(lib).includes("owed:"), "no owed: prefix is carried");
  assert.ok(Object.isFrozen(lib) && Object.isFrozen(lib[0]) && Object.isFrozen(lib[0].steps[0]));
});

test("R30 (T46; DEC-194 (4), (5); N913; K2241) the five scripts DEC-194 (5) wrote are adopted, each required: false at version 1, approved by BOB on the date of the adoption and authored by the Civicsmith library, none placing a template, each preparing step saying to start from the group's own template; a step on an act PR #28 owes (escalationstoppursuing, actionscope, itemtakeup, K2780) passes R12 only once its op is declared, the script withheld until then and blocking no release; Start and send's version 2 names no template on communicationprepare and is offered with no filing template offered, its version 1 updated and withheld (control)", () => {
  const by = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === nameNow(n));
  for (const n of ADDED_T46) {
    const e = by(n), first = e.earlier ? e.earlier[0] : e;   /* version 1, whatever the re-take (R42) made of it since */
    assert.deepEqual([e.origin, e.scope, e.required, first.version, e.author, first.approved], ["civicsmith", "group", false, 1, "civicsmith", T46], n);
    assert.ok([e, ...(e.earlier || [])].every((v) => !v.steps.some((t) => t.draft)), `${n}: no step places a draft`);
  }
  const preparing = [...ADDED_T46, word("wizard.WIZ-a8c349d7d71b6bb0.name")].flatMap((n) => by(n).steps.filter((t) => t.act === "communicationprepare").map((t) => [n, t]));
  assert.deepEqual(preparing.map(([n]) => n), ["Comment for the group", word("wizard.WIZ-bd7bde2c61b6badb.name"), word("wizard.WIZ-d0cdcee9437b213b.name"), word("wizard.WIZ-a8c349d7d71b6bb0.name")]);
  for (const [n, t] of preparing) {
    assert.match(t.what, /[Ss]tart from your (group's|team's) (\w+ )*template/, n);
    assert.equal(t.draft, undefined, `${n}: no {template} draft`);
  }
  const send = by(word("wizard.WIZ-a8c349d7d71b6bb0.name"));
  assert.deepEqual([send.version, send.approved, send.required], [4, T50, false], "version 4 re-taken at the design commit (R42), after version 3 (R38)");
  const step4 = (steps) => steps.find((t) => t.act === "communicationprepare");
  assert.deepEqual(step4(send.earlier[0].steps).draft, { template: "@communication" }, "version 1 named @communication");
  assert.deepEqual(send.earlier[2].steps.map((t) => t.act), send.earlier[0].steps.map((t) => t.act), "only step 4's words and draft changed, to version 3");
  assert.ok(!JSON.stringify(wz.CIVICSMITH_LIBRARY.map((e) => e.steps)).includes("@communication"), "no offered version names @communication");
  /* owed acts: withheld until declared; none required, so R14 is unmoved */
  const reg = (ops, x = {}) => { const w = world({ register: false, ...x }); w.member("frank"); w.wz.wizardRegister({ ops }); return w; };
  const all = reg(ALL_OPS);
  for (const [op, n] of Object.entries(OWED_T46)) {
    assert.ok(by(n).steps.some((t) => t.act === op), `${n} walks ${op}`);
    const w = reg(ALL_OPS.filter((o) => o !== op));
    assert.ok(!w.wz.wizardsAt({ screen: by(n).start, viewer: F }).scripts.some((x) => x.id === by(n).id), `${n} withheld while ${op} is undeclared`);
    assert.deepEqual(wz.requiredFailures(real({ ops: ALL_OPS.filter((o) => o !== op) })), [], `${op}: no release blocked`);
    assert.ok(all.wz.wizardsAt({ screen: by(n).start, viewer: F }).scripts.some((x) => x.id === by(n).id), `${n} offered once ${op} is declared`);
  }
  /* control: with no filing template offered at all, Start and send's version 2 is offered on plan; version 1 was withheld */
  const bare = reg(ALL_OPS, { templates: "unreviewed" });
  const onPlan = bare.wz.wizardsAt({ screen: "plan", viewer: F }).scripts;
  assert.deepEqual(onPlan.filter((x) => x.id === send.id).map((x) => x.version), [`${send.id}@4`]);
  for (const n of ["Comment for the group", word("wizard.WIZ-bd7bde2c61b6badb.name"), word("wizard.WIZ-d0cdcee9437b213b.name"), word("wizard.WIZ-a17835c4d8235f65.name")])
    assert.ok(onPlan.some((x) => x.id === by(n).id), `${n} on plan`);
  assert.ok(bare.wz.wizardsAt({ screen: "matter", viewer: F }).scripts.some((x) => x.id === by(word("wizard.WIZ-33cece8a68e76f58.name")).id));
  const one = bare.wz.wizardRead({ script: send.id, version: `${send.id}@1`, viewer: F });
  assert.deepEqual([one.version.state, one.version.updated_by, one.offered], ["updated", `${send.id}@2`, false]);
  const two = bare.wz.wizardRead({ script: send.id, version: `${send.id}@2`, viewer: F });
  assert.deepEqual([two.version.state, two.version.updated_by, two.offered], ["updated", `${send.id}@3`, false], "R38: version 2 followed by version 3");
  const three = bare.wz.wizardRead({ script: send.id, version: `${send.id}@3`, viewer: F });
  assert.deepEqual([three.version.state, three.version.updated_by, three.offered], ["updated", `${send.id}@4`, false], "R42: version 3 followed by version 4");
  const v1 = world({ register: false, templates: "unreviewed" });
  v1.member("frank");
  v1.wz.wizardRegister({ ops: ALL_OPS, library: [{ id: send.id, name: send.name, required: false, ...send.earlier[0] }] });
  assert.deepEqual(v1.wz.wizardsAt({ screen: "plan", viewer: F }).scripts.filter((x) => x.id === send.id), [], "version 1 alone: withheld for want of @communication");
});

test("R22 each library script is origin civicsmith, scope group, authored by the Civicsmith library: version 1 approved by Bob on 2026-10-06, for the four T37 names version 2 adopted by BOB on 2026-10-08 under K2241, for the two T41 names (Connect, Invite) on 2026-10-10 under K2241, (R30) for Start and send version 2 and the five added scripts' version 1 on 2026-10-12 under K2241, (R32, R36) for Connect, Set up and claim and Publication ceremony version 3 on 2026-10-14 under K2241; exactly the three DEC-148 names are required; read so by every member", () => {
  const lib = wz.CIVICSMITH_LIBRARY;
  for (const e of lib) {
    const now = onR45(e);   /* R42, R45: the version the re-takes left it at, and who approved that version, when */
    assert.deepEqual([e.origin, e.scope, e.author, e.version, e.approved], ["civicsmith", "group", "civicsmith", now.version, now.approved], e.name);
  }
  assert.deepEqual(lib.filter((e) => e.required).map((e) => e.name), [word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-7db08189cc0e58c3.name"), word("wizard.WIZ-426b9c2e8b128b6b.name")]);
  assert.equal(lib.filter((e) => !e.required).length, 20);
  /* registered by default, read as R1 holds it */
  const w = seeded({ register: false });
  w.wz.wizardRegister({ ops: ALL_OPS });
  const welcome = lib.find((e) => e.name === word("wizard.WIZ-7db08189cc0e58c3.name"));
  for (const viewer of [F, D, E]) {
    const r = w.wz.wizardRead({ script: welcome.id, viewer });
    assert.deepEqual([r.ok, r.script.origin, r.script.scope, r.script.required, r.script.based_on, r.script.start], [true, "civicsmith", "group", true, null, "join"]);
    assert.deepEqual([r.version.id, r.version.state, r.version.author, r.version.approved, r.offered],
                     [`${welcome.id}@${welcome.version}`, "approved", { name: "civicsmith" }, { by: { name: "BOB" }, at: "2026-10-20", ruling: "K2241" }, true]);
    assert.equal(welcome.version, 3, "R42, R45: the welcome wizard's version 1 (Bob, 2026-10-06) is followed by the file's content at T50 and again by DEC-384's step 4");
    assert.deepEqual(r.version.steps, welcome.steps);
  }
  assert.equal(w.wz.wizardRead({ script: welcome.id, viewer: "nobody" }).reason, "NO_SUCH_WIZARD");
  /* the welcome wizard starts on join, the ceremony on ceremony (R11) */
  assert.ok(w.wz.wizardsAt({ screen: "join", viewer: F }).scripts.some((s) => s.id === welcome.id));
  assert.ok(w.wz.wizardsAt({ screen: "ceremony", viewer: D }).scripts.some((s) => s.name === word("wizard.WIZ-426b9c2e8b128b6b.name")));
});

test("R22 every write on a library script, either version, is refused WIZARD_NOT_THE_GROUPS (R9), and R14 is run on them: with every op the registry names declared, no required flow fails and every script passes R12", () => {
  const w = seeded({ register: false });
  w.wz.wizardRegister({ ops: ALL_OPS });
  for (const e of [wz.CIVICSMITH_LIBRARY[1], wz.CIVICSMITH_LIBRARY.find((x) => x.name === word("wizard.WIZ-c887066cc553dd41.name"))])
    for (const v of [`${e.id}@1`, `${e.id}@${e.version}`]) {
      refused(w.wz.wizardDraft({ from: v, author: F, viewer: F }), "WIZARD_NOT_THE_GROUPS");
      refused(w.wz.wizardRevise({ version: v, steps: STEPS, author: F, viewer: F }), "WIZARD_NOT_THE_GROUPS");
      refused(w.wz.wizardSubmit({ version: v, author: F, viewer: F }), "WIZARD_NOT_THE_GROUPS");
      refused(w.wz.wizardApprove({ version: v, by: E, viewer: E }), "WIZARD_NOT_THE_GROUPS");
      refused(w.wz.wizardApprove({ version: v, widen: true, by: E, viewer: E }), "WIZARD_NOT_THE_GROUPS");
      refused(w.wz.wizardRetire({ version: v, reason: "r", by: E, viewer: E }), "WIZARD_NOT_THE_GROUPS");
    }
  const e = wz.CIVICSMITH_LIBRARY[1];
  refused(w.wz.wizardPropose({ script: e.id, steps: STEPS, why: "w", proposer: F, viewer: F }), "WIZARD_NOT_THE_GROUPS");
  refused(w.wz.wizardRetire({ script: e.id, reason: "r", by: E, viewer: E }), "WIZARD_NOT_THE_GROUPS");
  assert.deepEqual(wz.requiredFailures(real()), [], "Set up and claim's version 5 walks hostingaccessset and no selftest (R36, R38, R42)");
  const offered = wz.CIVICSMITH_LIBRARY.map((x) => ({ id: x.id, steps: x.steps }));
  for (const x of wz.CIVICSMITH_LIBRARY) assert.deepEqual(wz.checkScript(x.steps, { ...real(), offered, self: x.id }).refusals, [], x.name);
  /* the earlier versions of Set up and claim would fail (negative controls): R14 is judged on the version offered */
  const setup = wz.CIVICSMITH_LIBRARY.find((x) => x.name === word("wizard.WIZ-c887066cc553dd41.name"));
  assert.deepEqual(setup.earlier.map((v) => wz.checkScript(v.steps, { ...real(), offered, self: setup.id }).refusals.map((f) => [f.code, f.step])),
                   [[["WIZARD_ACT_UNKNOWN", 3], ["WIZARD_ACT_UNKNOWN", 11], ["WIZARD_ACT_UNKNOWN", 14]], [["WIZARD_ACT_UNKNOWN", 3], ["WIZARD_ACT_UNKNOWN", 14]], [["WIZARD_ACT_UNKNOWN", 3]], []],
                   "version 1 on selftest, assistantset and hostingaccess, version 2 on selftest and hostingaccess, version 3 on selftest, which install no longer lists (R35, R38); version 4 passes the registry still");
});

test("R22 (T37, T41; K2241), R30 the seven adopted scripts carry version 2 in place of version 1: \"Set up and claim\" on aikeepaway then groupkeyset, no assistantset; \"Publication ceremony\" with its Photos step on obscuremark; \"Check a claim\" with DEC-178's wording; \"Follow a proceeding\" on entitycreate; (T41; DEC-188 (8), DEC-184) \"Connect your Claude account\" on ailimitset and accountusesset in place of aiceilingset and accountswitchset; \"Invite a member\" as PR #19 words it (an invitation's short id; the member chooses her handle); (T46) \"Start and send\" with no template on communicationprepare; each keeps its id, name, required and start, its version 1 updated, naming version 2, readable and not offered", () => {
  const by = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === n);
  const acts = (n) => by(n).steps.map((t) => t.act);
  /* Connect's version 2 (T41), kept readable under version 3 (R32) */
  const connect = by(word("wizard.WIZ-74328804ddae3503.name")).earlier[1].steps.map((t) => t.act), connect1 = by(word("wizard.WIZ-74328804ddae3503.name")).earlier[0].steps.map((t) => t.act);
  assert.deepEqual([connect[4], connect[5]], ["ailimitset", "accountusesset"]);
  assert.deepEqual([connect1[4], connect1[5]], ["aiceilingset", "accountswitchset"], "version 1 as it was");
  assert.deepEqual(connect.filter((_, i) => i !== 4 && i !== 5), connect1.filter((_, i) => i !== 4 && i !== 5), "no other act changed");
  const invite = by(word("wizard.WIZ-8e7e2fac33d069f8.name"));
  assert.match(invite.steps[0].what, /a short id for the invitation/);
  assert.match(invite.steps[0].why, /choose their own handle/);
  assert.match(invite.earlier[0].steps[0].what, /their handle/);
  assert.deepEqual(invite.steps.map((t) => t.act), invite.earlier[0].steps.map((t) => t.act), "Invite's acts unchanged: its words only");
  for (const steps of [by(word("wizard.WIZ-c887066cc553dd41.name")).steps, by(word("wizard.WIZ-c887066cc553dd41.name")).earlier[1].steps]) {   /* version 2's change, kept in version 3 */
    const setup = steps.map((t) => t.act);
    assert.ok(!setup.includes("assistantset") && setup.indexOf("aikeepaway") >= 0 && setup.indexOf("groupkeyset") === setup.indexOf("aikeepaway") + 1, setup.join());
  }
  assert.ok(acts(word("wizard.WIZ-426b9c2e8b128b6b.name")).includes("obscuremark") && by(word("wizard.WIZ-426b9c2e8b128b6b.name")).earlier[1].steps.some((t) => t.act === "obscuremark"));
  assert.ok(acts(word("wizard.WIZ-a15d174f7a2c1dc5.name")).includes("entitycreate") && !acts(word("wizard.WIZ-a15d174f7a2c1dc5.name")).includes("registerproceeding"));
  assert.notDeepEqual(by(word("wizard.WIZ-33b5887790b7561b.name")).steps.map((t) => [t.what, t.why]), by(word("wizard.WIZ-33b5887790b7561b.name")).earlier[0].steps.map((t) => [t.what, t.why]), "the wording changed");
  for (const n of ADOPTED) {
    const f = LIB_FILE.scripts.find((x) => x.name === n);
    assert.deepEqual([by(n).id, by(n).name, by(n).required, by(n).start], [f.id, f.name, [word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-426b9c2e8b128b6b.name")].includes(n), f.start], n);
  }
  const w = world({ register: false });
  w.member("frank");
  w.member("erin", { role: "admin" });
  w.wz.wizardRegister({ ops: ALL_OPS });
  for (const e of wz.CIVICSMITH_LIBRARY) {
    const r = w.wz.wizardRead({ script: e.id, viewer: F });
    assert.deepEqual([r.version.id, r.version.state, r.version.updated_by, r.offered],
                     [`${e.id}@${e.version}`, "approved", null, true], e.name);
    if (!e.earlier) { assert.equal(w.wz.wizardRead({ script: e.id, version: `${e.id}@2`, viewer: F }).reason, "NO_SUCH_WIZARD", e.name); continue; }
    e.earlier.forEach((v, i) => {
      const next = i + 1 < e.earlier.length ? e.earlier[i + 1].version : e.version;
      const one = w.wz.wizardRead({ script: e.id, version: `${e.id}@${v.version}`, viewer: F });
      assert.deepEqual([one.ok, one.version.state, one.version.updated_by, one.offered, one.version.approved],
                       [true, "updated", `${e.id}@${next}`, false, { by: { name: v.approved.by }, at: v.approved.at, ...(v.approved.ruling ? { ruling: v.approved.ruling } : {}) }],
                       `${e.name}: version ${v.version} readable, updated, naming its successor`);
      assert.deepEqual(one.version.steps, v.steps);
    });
    assert.deepEqual(r.version.approved, { by: { name: "BOB" }, at: onR45(e).approved.at, ruling: "K2241" });
    const at = w.wz.wizardsAt({ screen: e.start, viewer: F }).scripts.filter((s) => s.id === e.id).map((s) => s.version);
    assert.deepEqual(at, [`${e.id}@${e.version}`], `${e.name}: only the latest version offered`);
    const listed = w.wz.wizards({ viewer: V("erin") }).scripts.find((s) => s.id === e.id);
    assert.deepEqual(listed.versions.map((v) => [v.id, v.state]), [[`${e.id}@${e.version}`, "approved"]], `${e.name}: the offered version listed (R10)`);
  }
});

test("R14 over the real library: while an owed act its required flows walk is undeclared, requiredFailures names the flow with its first refusal; an optional flow is never named", () => {
  const without = (ops) => wz.requiredFailures(real({ ops: ALL_OPS.filter((o) => !ops.includes(o)) }))
    .map((f) => [f.name, f.refusal.code, f.refusal.step, f.version]);
  const id = (name) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === name).id;
  const ver = (name) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === name).version;
  assert.deepEqual(without(["memberlanguageset", "publishat"]), [
    [word("wizard.WIZ-7db08189cc0e58c3.name"), "WIZARD_ACT_UNKNOWN", 1, `${id("Welcome a new member")}@${ver("Welcome a new member")}`],
    [word("wizard.WIZ-426b9c2e8b128b6b.name"), "WIZARD_ACT_UNKNOWN", 11, `${id("Publication ceremony")}@${ver("Publication ceremony")}`]], "the version offered (R36, R42)");
  assert.deepEqual(without(["startfrom"]), [[word("wizard.WIZ-7db08189cc0e58c3.name"), "WIZARD_ACT_UNKNOWN", 7, `${id("Welcome a new member")}@${ver("Welcome a new member")}`]]);
  assert.deepEqual(without(["translationdraft", "translationadopt", "translationconfirm", "subscriptionsignin"]), [], "owed acts of optional flows block nothing");
  assert.deepEqual(wz.requiredFailures(real({ ops: ALL_OPS.filter((o) => o !== "claim") })).map((f) => [f.name, f.refusal.step]), [[word("wizard.WIZ-c887066cc553dd41.name"), 5]],
                   "its first refusal named: step 5's claim, before step 11");
  /* the registration plane makes today (no screens of the new interface): every required flow is named */
  assert.deepEqual(wz.requiredFailures(real({ screens: [] })).map((f) => f.name), [word("wizard.WIZ-c887066cc553dd41.name"), word("wizard.WIZ-7db08189cc0e58c3.name"), word("wizard.WIZ-426b9c2e8b128b6b.name")]);
});

test("R23 startFrom answers the offered scripts this viewer may start, the library's that are not required and the group's own, each {id, version, name, start}, with doors naming offered scripts only (a door none of whose scripts is offered left out: none, with the test library, but the sixth, always answered, R37); no AI and no key; starts nothing, writes nothing", () => {
  const w = seeded({ register: false });
  w.wz.wizardRegister({ screens: SCREENS, ops: OPS, machineRefused: MACHINE_REFUSED, machineDrafts: MACHINE_DRAFTS, library: LIBRARY });
  const a = approved(w, { name: "Ours" });
  const d = draft(w, { name: "A draft" });
  const before = w.snapshot();
  const r = w.wz.startFrom({ viewer: F });
  assert.deepEqual([r.ok, r.doors, r.scripts], [true, [{ door: "elsewhere", scripts: [], opens: "elsewhere" }], [
    { id: LIBRARY[1].id, version: `${LIBRARY[1].id}@1`, name: "Publish", start: "publish" },
    { id: a.script, version: a.version, name: "Ours", start: "case-home" }]]);
  assert.ok(!r.scripts.some((s) => s.id === LIBRARY[0].id), "a required library script is not a first step");
  assert.ok(!r.scripts.some((s) => s.id === d.script), "a draft is not offered");
  assert.deepEqual(w.wz.startFrom({ viewer: D }).scripts.map((s) => s.id), [LIBRARY[1].id], "dave cannot see P");
  assert.deepEqual(w.wz.startFrom({ viewer: "nobody" }).scripts, []);
  assert.ok(wz.FRONT_DOORS.length > 0 && !wz.FRONT_DOORS.some((d) => d.scripts.some((id) => LIBRARY.some((l) => l.id === id))),
            "control: the doors are given, and name none of the test library's scripts");
  /* through the op table, from a member's session alone */
  assert.deepEqual(wz.wizardScriptsOps(w.wz, new URL("https://x/?op=startfrom&viewer=member%3Afrank"), null).startfrom(), r);
  assert.deepEqual(w.snapshot(), before, "writes nothing, records no use");
  /* the real library: the nineteen optional scripts */
  const w2 = world({ register: false });
  w2.member("frank");
  w2.wz.wizardRegister({ ops: ALL_OPS });
  assert.deepEqual(w2.wz.startFrom({ viewer: F }).scripts.map((s) => s.name),
                   wz.CIVICSMITH_LIBRARY.filter((e) => !e.required).map((e) => e.name),
                   "every optional script, Follow a proceeding's version 2, Get a record, Start and send's version 2 and the five added (R30) included");
});

test("R11 (K1883) a library script that fails R12 against the registration is not offered until it passes, as R13 withholds a group's: absent from wizardsAt, the registry form, startFrom and the offered reads; a passing one offered; the library data unchanged", () => {
  const name = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === n);
  const reg = (ops) => { const w = world({ register: false }); w.member("frank"); w.member("erin", { role: "admin" }); w.wz.wizardRegister({ ops }); return w; };
  const missing = ["subscriptionsignin", "translationdraft", "translationadopt", "translationconfirm"];
  const w = reg(ALL_OPS.filter((o) => !missing.includes(o)));
  const connect = name(word("wizard.WIZ-74328804ddae3503.name")), translate = name(word("wizard.WIZ-af4c9fafc3713f26.name")), ties = name("Your ties");
  for (const [e, screen] of [[connect, "connect"], [translate, "translations"]]) {
    assert.ok(!w.wz.wizardsAt({ screen, viewer: F }).scripts.some((s) => s.id === e.id), `${e.name} withheld`);
    assert.equal(w.wz.wizardRead({ script: e.id, viewer: F }).offered, false, "still readable, not offered");
    assert.ok(!w.wz.wizardRegistry({ viewer: F }).screens.some((sc) => sc.scripts.some((x) => x.id === e.id)), "not in the registry form");
    assert.ok(!w.wz.startFrom({ viewer: F }).scripts.some((s) => s.id === e.id));
    assert.ok(!w.wz.wizards({ viewer: E }).scripts.some((s) => s.id === e.id), "not among the offered versions");
  }
  assert.ok(w.wz.wizardsAt({ screen: "ties", viewer: F }).scripts.some((s) => s.id === ties.id), "a passing one is offered");
  /* a required flow is judged on its own steps: the welcome wizard stays offered though a script it visits is withheld */
  assert.ok(w.wz.wizardsAt({ screen: "join", viewer: F }).scripts.some((s) => s.name === word("wizard.WIZ-7db08189cc0e58c3.name")));
  /* the published scripts name only registered screens and acts (what skills R10 checks) */
  const screens = new Map(w.wz.registeredScreens().map((s) => [s.id, new Set(s.acts)]));
  for (const sc of w.wz.wizardRegistry({ viewer: F }).screens)
    for (const x of sc.scripts) for (const t of x.steps) assert.ok(screens.has(t.screen) && (t.act === null || screens.get(t.screen).has(t.act)), `${x.name}: ${t.screen}/${t.act}`);
  /* once the ops are declared, both are offered */
  const all = reg(ALL_OPS);
  assert.ok(all.wz.wizardsAt({ screen: "connect", viewer: F }).scripts.some((s) => s.id === connect.id));
  assert.ok(all.wz.wizardsAt({ screen: "translations", viewer: F }).scripts.some((s) => s.id === translate.id));
  /* a required flow failing on its own act is withheld too, and R14 names it */
  const nol = reg(ALL_OPS.filter((o) => o !== "memberlanguageset"));
  assert.ok(!nol.wz.wizardsAt({ screen: "join", viewer: F }).scripts.some((s) => s.name === word("wizard.WIZ-7db08189cc0e58c3.name")));
  assert.equal(wz.CIVICSMITH_LIBRARY.length, 23, "the data is untouched");
});
