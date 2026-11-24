/* wizard-scripts at T50 (N1122, N1130, N1194; DEC-266, DEC-279, DEC-281; K2241, K3674, K3745): the registry and the library re-taken
   as generated artifacts from the design commit named at START (R41, R42), the doors read from the same file, and a saved
   draft listed (R43). Every test drives the module at its interface, over the carried data and the vendored design files
   it is held equal to; the generator is run as a command. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { world, seeded, draft, V, step, STEPS } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { GENERATED, SOURCES } from "../../../src/wizard-scripts/build-data.mjs";

const F = V("frank"), G = V("gwen"), A = V("alice"), E = V("erin"), D = V("dave");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = join(HERE, "source");
const GEN_DIR = fileURLToPath(new URL("../../../src/wizard-scripts/", import.meta.url));
const src = (f) => readFileSync(join(SOURCE_DIR, f), "utf8");
const REG_FILE = JSON.parse(src("registry.json")), LIB_T50 = JSON.parse(src("library-7be06eb4cb.json"));
const COMMIT = "2a64c5ae77";
const FIX = "1cc4a957f0";   /* R45: the fix round re-takes the doors and the library again */
const LIB_R45 = JSON.parse(src("library-1cc4a957f0.json"));
const REG_COMMIT = "b1adf4236d";   /* the registry's pin, moved by R44, R45, DEC-389 (R41) and DEC-402 (R49) and DEC-419 (R50) */
const OWED = /^owed:([a-z][a-z0-9]*)(?:\s+(DEC-\d+|K\d+))?$/;
const status = (s) => REG_FILE.screens.flatMap((f) => f.acts.filter((a) => a.status === s).map((a) => [f.id, a.op]));
const OWED_OPS = [...new Set(status("owed").map(([, op]) => OWED.exec(op)[1]))];
const INSTALL = ["installupdate", "installalongside", "installremove", "installremoveconfirm"];
/* the owed acts the file names at the design commit (R41; R44 adds DEC-330's and DEC-340's seven), each registered once its op is declared (R13) */
const T50_OWED = ["watchitem", "secondlook", "projectstakeset", "actionstake", "actioninquiry", "aliaswithdraw", "updatestart", "updatelater", "updateskip",
                  "founderhandleset", "passwordresetlink", "revisioncompare", "hashcopy", "linkopen", "reviewexport", "pubfloorset", "pubfloorclear", "pubprint"];
/* R45: every owed act the file names now (DEC-374 to DEC-383 add owed acts), apart from the installer's four; T50's are among them */
const OWED_NOW = OWED_OPS.filter((op) => !INSTALL.includes(op));
/* every declared and function act of the file: the member op table once the owed acts are not yet declared */
const DECLARED_OPS = [...new Set(REG_FILE.screens.flatMap((f) => f.acts.filter((a) => a.status !== "owed").map((a) => a.op)))];
const ALL_OPS = [...DECLARED_OPS, ...OWED_OPS];
const by = (n) => wz.CIVICSMITH_LIBRARY.find((e) => e.name === n);

const run = (...args) => spawnSync(process.execPath, [join(GEN_DIR, "build-data.mjs"), ...args], { encoding: "utf8" });
const flip = (text) => { const i = Math.floor(text.length / 2); return text.slice(0, i) + (text[i] === "a" ? "b" : "a") + text.slice(i + 1); };
function scratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), "wizard-scripts-"));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const copy = (from, to, names) => { for (const n of names) copyFileSync(join(from, n), join(to, n)); };

/* A world over the carried registry and library, with the ops of `ops` declared. */
function real({ ops = ALL_OPS, ...opts } = {}) {
  const w = world({ register: false, ...opts });
  w.member("frank");
  w.member("erin", { role: "admin" });
  const r = w.wz.wizardRegister({ ops });
  assert.equal(r.ok, true, JSON.stringify(r));
  return w;
}

test("R41 (T50; N1130; DEC-266, DEC-279, DEC-281; K2241) build-data.mjs --check passes on the committed generated files and fails after a one-byte change to any one of them, to either design file it generates them from, or to a file's absence; and written afresh it writes exactly what is committed", () => {
  const ok = run("--check");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /match their sources/);
  scratch((out) => {
    copy(GEN_DIR, out, GENERATED);
    assert.equal(run("--check", "--out", out).status, 0, "a copy of the committed files");
    for (const name of GENERATED) {
      const text = readFileSync(join(out, name), "utf8");
      writeFileSync(join(out, name), flip(text));
      const r = run("--check", "--out", out);
      assert.equal(r.status, 1, `${name}: one byte changed`);
      assert.ok(r.stderr.includes(name) && /stale/.test(r.stderr), `${name}: named in what it says: ${r.stderr.slice(0, 200)}`);
      assert.ok(GENERATED.filter((n) => n !== name).every((n) => !r.stderr.includes(n)), `${name}: and no other`);
      writeFileSync(join(out, name), text);
    }
    assert.equal(run("--check", "--out", out).status, 0, "restored");
    rmSync(join(out, "front-doors.mjs"));
    const gone = run("--check", "--out", out);
    assert.equal(gone.status, 1, "a file absent");
    assert.match(gone.stderr, /front-doors\.mjs is stale: the generated file is absent/);
  });
  /* the sources: a byte changed in the registry makes its generated file stale, in the library the other two */
  scratch((from) => {
    const files = readdirSync(SOURCE_DIR);
    copy(SOURCE_DIR, from, files);
    assert.equal(run("--check", "--from", from).status, 0, "a copy of the sources");
    writeFileSync(join(from, SOURCES.registry.file), flip(src(SOURCES.registry.file)));
    const reg = run("--check", "--from", from);
    assert.equal(reg.status, 1);
    assert.ok(reg.stderr.includes("screen-registry.mjs") || /not valid JSON|JSON/.test(reg.stderr), reg.stderr.slice(0, 200));
    copyFileSync(join(SOURCE_DIR, SOURCES.registry.file), join(from, SOURCES.registry.file));
    const newest = SOURCES.newer.at(-1).file;
    writeFileSync(join(from, newest), src(newest).replace("Check you have what is needed", "Check you have what is neededs"));
    const lib = run("--check", "--from", from);
    assert.equal(lib.status, 1, "the library re-taken from the design commit, one byte changed");
    assert.ok(lib.stderr.includes("civicsmith-library.mjs") && lib.stderr.includes("front-doors.mjs"), lib.stderr.slice(0, 300));
  });
  /* written afresh, byte for byte */
  scratch((out) => {
    const w = run("--out", out);
    assert.equal(w.status, 0, w.stderr);
    for (const name of GENERATED) assert.equal(readFileSync(join(out, name), "utf8"), readFileSync(join(GEN_DIR, name), "utf8"), `${name}: what the command writes is what is committed`);
  });
  /* each generated file names the source it comes from: the commit, the path and the file's SHA-256 */
  const sha = (f) => createHash("sha256").update(src(f), "utf8").digest("hex");
  assert.deepEqual(wz.SCREEN_REGISTRY_SOURCE, { commit: REG_COMMIT, path: "docs/development/ux-substrate/screens/registry.json", sha256: sha("registry.json") });
  assert.deepEqual(wz.FRONT_DOORS_SOURCE, { commit: FIX, path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-1cc4a957f0.json") });
  assert.deepEqual(wz.CIVICSMITH_LIBRARY_ADOPTED_SOURCES.at(-1), { commit: FIX, path: "docs/development/ux-substrate/screens/library.json", sha256: sha("library-1cc4a957f0.json") });
  assert.ok(!existsSync(join(GEN_DIR, "front-doors.mjs.orig")));
});

test("R41 (T50; DEC-266, DEC-279, DEC-281) SCREEN_REGISTRY is the registry at the design commit named at START, screen by screen and act by act: 71 screens and 413 acts, 269 declared, 128 function and 16 owed naming 15 ops; the four screens new since R38 are docket-public, more, teamai and theme; control: the earlier commit's registry is not it", () => {
  assert.equal(wz.SCREEN_REGISTRY_SOURCE.commit, REG_COMMIT);
  assert.equal(wz.SCREEN_REGISTRY.length, 91);
  assert.deepEqual(wz.SCREEN_REGISTRY.map((s) => s.id), REG_FILE.screens.map((f) => f.id), "the file's order");
  const acts = REG_FILE.screens.flatMap((f) => f.acts);
  assert.deepEqual([acts.length, acts.filter((a) => a.status === "declared").length, acts.filter((a) => a.status === "function").length, acts.filter((a) => a.status === "owed").length],
                   [656, 452, 83, 121]);
  assert.equal(OWED_OPS.length, 105, "121 owed acts name 105 ops: updatelater, taskdecide and others are owed on more than one screen");
  REG_FILE.screens.forEach((f, i) => {
    const s = wz.SCREEN_REGISTRY[i];
    assert.deepEqual([s.id, s.name, s.purpose], [f.id, f.name, f.purpose], f.id);
    assert.deepEqual(s.acts, [...new Set(f.acts.filter((a) => a.status !== "owed").map((a) => a.op))], `${f.id}: its declared and function acts, in the file's order`);
    assert.deepEqual(s.owed.map((o) => o.op), f.acts.filter((a) => a.status === "owed").map((a) => OWED.exec(a.op)[1]), `${f.id}: its owed acts`);
  });
  const before = JSON.parse(src("registry-4664e8efd4.json")).screens.map((s) => s.id);
  assert.deepEqual(wz.SCREEN_REGISTRY.map((s) => s.id).filter((id) => !before.includes(id)).sort(), ["about-knocker", "actionnew", "aiconnect", "aimine", "aimoments", "aiproject", "aiproviders", "airesults", "aitest", "bias", "contradiction", "counsel", "docket-public", "glossary", "grouprules", "hold", "holdnotice", "leads", "more", "objective", "registers", "teamai", "theme", "watching"]);
  assert.ok(!before.includes("teamai") && wz.SCREEN_REGISTRY.some((s) => s.id === "teamai"), "control: PR #34's registry has no teamai");
  /* registered as the plane registers it: the screens, and with no op table the declared and function acts */
  const w = world({ register: false });
  assert.equal(w.wz.wizardRegister({ library: [] }).screens, 91);
  assert.deepEqual(w.wz.registeredScreens().map((s) => s.id), wz.SCREEN_REGISTRY.map((s) => s.id));
  assert.deepEqual(w.wz.registeredScreens().find((s) => s.id === "docket-public").acts, [], "docket-public lists no act");
  assert.deepEqual(w.wz.registeredScreens().find((s) => s.id === "theme").acts, ["themeread", "themedeclare", "themeplace", "themewithdraw"]);
});

test("R41 (T50; N1130; K3674) the check that every registry act has a declaration: with the member op table and the aliases, an act the file marks declared or function that the table lacks is named, screen and act, and so is an owed act whose op is undeclared, but never one of the installer's four routes (installupdate, installalongside, installremove, installremoveconfirm); control: with every op declared there is no gap, and a function act removed from the table is the one gap, by name", () => {
  assert.deepEqual(wz.INSTALLER_ROUTES, INSTALL);
  assert.deepEqual(status("owed").map(([, op]) => OWED.exec(op)[1]).filter((op) => INSTALL.includes(op)), INSTALL, "the file owes the four");
  /* every function act is an op in the table or an alias: here, the table is the file's own acts */
  const functions = status("function");
  assert.equal(functions.length, 83);
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: DECLARED_OPS }).filter((g) => !g.owed), [], "every declared and function act has its declaration");
  for (const [screen, op] of functions) assert.ok(DECLARED_OPS.includes(op), `${screen}/${op}`);
  /* owed acts: gaps until declared, the installer's four never */
  const owedGaps = wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: DECLARED_OPS });
  assert.deepEqual(owedGaps.every((g) => g.owed), true);
  assert.deepEqual([...new Set(owedGaps.map((g) => g.act))].sort(), [...OWED_NOW].sort(), "the owed acts that wait for a declaration, none of the installer's");
  assert.deepEqual(owedGaps.filter((g) => g.act === "updatelater").map((g) => g.screen).sort(), ["queue", "updates"], "updatelater is owed on two screens");
  assert.ok(!owedGaps.some((g) => INSTALL.includes(g.act)), "control: the installer's routes are excluded by name");
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: [...DECLARED_OPS, ...OWED_NOW] }), [], "declared, no gap remains");
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: new Set(ALL_OPS) }), []);
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: Object.fromEntries(ALL_OPS.map((o) => [o, true])) }), [], "an object keyed by op is a table too");
  /* control: a registry act with no declaration, other than the four named, fails by name */
  const [, op] = functions[functions.length - 1];
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: ALL_OPS.filter((o) => o !== op) }),
                   functions.filter(([, o]) => o === op).map(([screen]) => ({ screen, act: op, owed: false })), "named on each screen that lists it");
  const some = wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: ALL_OPS.filter((o) => o !== "reauth" && o !== "installremove") });
  assert.deepEqual(some, [{ screen: "connect", act: "reauth", owed: false }], "reauth is a gap; installremove, a route of the installer's, is not");
  assert.deepEqual(wz.registryActGaps(), []);
  assert.deepEqual(wz.registryActGaps({ screens: null, declared: null }), []);
  /* an act the table holds only as an alias counts: the caller hands the aliases in with the ops */
  assert.deepEqual(wz.registryActGaps({ screens: wz.SCREEN_REGISTRY, declared: [...ALL_OPS.filter((o) => o !== "passwordreset"), "passwordreset"] }), []);
});

test("R41 (T50; N1130; R13) each of the owed acts the file names is registered as its op once the op table declares it, at its place in the file's order, and not before: watchitem, secondlook, projectstakeset, actionstake and actioninquiry, with aliaswithdraw, updatestart, updatelater, updateskip, founderhandleset and passwordresetlink; the installer's four are registered only if a table were to declare them", () => {
  const where = (op) => status("owed").filter(([, o]) => OWED.exec(o)[1] === op).map(([screen]) => screen);
  const base = real({ ops: DECLARED_OPS });
  const none = new Map(base.wz.registeredScreens().map((s) => [s.id, s.acts]));
  for (const op of OWED_NOW) {
    assert.ok(where(op).length > 0, `${op}: the file owes it`);
    for (const screen of where(op)) assert.ok(!none.get(screen).includes(op), `${screen}/${op}: not registered while undeclared`);
    const w = real({ ops: [...DECLARED_OPS, op] });
    const reg = new Map(w.wz.registeredScreens().map((s) => [s.id, s.acts]));
    for (const screen of where(op)) {
      assert.ok(reg.get(screen).includes(op), `${screen}/${op}: registered once declared`);
      const file = [...new Set(REG_FILE.screens.find((f) => f.id === screen).acts.map((a) => (a.status === "owed" ? OWED.exec(a.op)[1] : a.op)))];
      assert.deepEqual(reg.get(screen), file.filter((o) => o === op || DECLARED_OPS.includes(o)), `${screen}: in the file's order`);
    }
    /* and a step naming it passes R12 only then */
    const s = where(op)[0];
    const steps = [step(s, op), step(s, null)];
    const check = (x) => wz.wizardScriptsOps(x.wz, new URL(`https://x/?viewer=${encodeURIComponent(F)}`), { steps }).wizardcheck().refusals.map((r) => [r.code, r.step]);
    assert.deepEqual(check(w), [], `${op}: admitted once declared`);
    assert.deepEqual(check(base), [["WIZARD_ACT_UNKNOWN", 1]], `${op}: refused while undeclared`);
  }
  assert.equal(new Set(OWED_NOW).size, 101, "R52: 105 owed ops at b1adf4236d less the installer's four");
  assert.ok(T50_OWED.every((op) => OWED_NOW.includes(op)), "T50's owed acts are still owed or declared in the file");
  /* aliaswithdraw is the entities' op, declared already (K3674): a table that holds it registers it now */
  assert.ok(where("aliaswithdraw").length > 0);
  for (const op of INSTALL) assert.ok(!base.wz.registeredScreens().some((s) => s.acts.includes(op)), `${op}: no plane op, not registered`);
});

test("R41 (T50; N1130; R37) the front doors are regenerated from the file's doors, which now end with the sixth: FRONT_DOORS are its five, in its order, and ELSEWHERE_DOOR is the file's sixth, {door: \"elsewhere\", scripts: [], opens: \"elsewhere\"}, read from the file and still answered to every viewer; control: with the sixth door gone from the file the frozen data answers the same", () => {
  assert.equal(wz.FRONT_DOORS_SOURCE.commit, FIX);
  const sixth = LIB_T50.doors.find((d) => d.door === "elsewhere");
  assert.deepEqual(sixth, { door: "elsewhere", scripts: [], opens: "elsewhere" }, "the file holds the sixth door");
  assert.deepEqual(LIB_T50.doors.map((d) => d.door), ["problem", "person", "money", "read", "tip", "elsewhere"]);
  assert.deepEqual(wz.FRONT_DOORS, LIB_T50.doors.filter((d) => d.door !== "elsewhere").map((d) => ({ door: d.door, scripts: d.scripts })));
  assert.deepEqual(wz.ELSEWHERE_DOOR, sixth);
  assert.ok(Object.isFrozen(wz.ELSEWHERE_DOOR) && Object.isFrozen(wz.ELSEWHERE_DOOR.scripts));
  const w = real();
  const doors = w.wz.startFrom({ viewer: F }).doors;
  assert.deepEqual(doors.map((d) => d.door), ["problem", "person", "money", "read", "tip", "elsewhere"]);
  assert.deepEqual(doors[5], sixth);
  for (const viewer of [F, E, D, "nobody"]) assert.deepEqual(w.wz.startFrom({ viewer }).doors.at(-1), sixth, `${viewer}: the way out is always visible`);
  /* control: a file without the sixth door gives the frozen data, which is the same door */
  scratch((from) => {
    copy(SOURCE_DIR, from, readdirSync(SOURCE_DIR));
    const without = { ...LIB_T50, doors: LIB_T50.doors.filter((d) => d.door !== "elsewhere") };
    writeFileSync(join(from, SOURCES.newer.at(-1).file), JSON.stringify(without));
    scratch((out) => {
      assert.equal(run("--from", from, "--out", out).status, 0);
      const text = readFileSync(join(out, "front-doors.mjs"), "utf8");
      assert.match(text, /export const ELSEWHERE_DOOR = deepFreeze\(\{"door":"elsewhere","scripts":\[\],"opens":"elsewhere"\}\)/);
      assert.match(text, /DEC-227 \(1\)'s frozen data/);
    });
  });
});

test("R42 (T50; N1130; DEC-266, DEC-279, DEC-281; K2241) the library is re-taken from the file's content: CIVICSMITH_LIBRARY is the 23 scripts of library.json at the design commit, the latest version of each equal to the file's, script by script and step by step; sixteen differed (four by name, the scripts DEC-281's team pass renamed) and gained the file's content as their next version, approved by BOB under K2241 and authored by the Civicsmith library, the earlier version updated; seven are the same and keep their version; the four renamed scripts carry the file's names", () => {
  assert.equal(wz.CIVICSMITH_LIBRARY.length, 23);
  const idOf = Object.fromEntries(LIB_T50.scripts.map((s) => [s.name, s.id]));
  const fileSteps = (k) => k.versions[0].steps.map((t) => {
    const m = typeof t.act === "string" ? OWED.exec(t.act) : null;
    return { screen: t.screen, act: m ? m[1] : t.act, what: t.what, why: t.why, ...(t.draft ? { draft: t.draft } : {}), ...(t.via ? { via: idOf[t.via] } : {}) };
  });
  assert.deepEqual(LIB_T50.scripts.map((k) => k.versions.length), LIB_T50.scripts.map(() => 1), "one version in the file each");
  LIB_R45.scripts.forEach((k, i) => {
    const e = wz.CIVICSMITH_LIBRARY[i];
    assert.deepEqual([e.id, e.name, e.start, e.steps], [k.id, k.name, k.start, fileSteps(k)], `${k.name}: the latest version is the file's, step by step`);
  });
  const gained = wz.CIVICSMITH_LIBRARY.filter((e) => e.source === COMMIT), same = wz.CIVICSMITH_LIBRARY.filter((e) => e.source !== COMMIT && e.source !== FIX);
  assert.equal(gained.length, 15, "sixteen at T50; the welcome wizard gained a later version in the fix round (R45)");
  assert.deepEqual(wz.CIVICSMITH_LIBRARY.filter((e) => e.source === FIX).map((e) => e.id), ["WIZ-7db08189cc0e58c3"]);
  assert.deepEqual(same.map((e) => e.name).sort(), ["Build a timeline", "Check a claim", "Follow a proceeding", "Follow the money", "Keep asking this", "Pick up a plan", "Your first question"]);
  for (const e of gained) {
    assert.deepEqual([e.author, e.approved, e.origin, e.scope], ["civicsmith", { by: "BOB", at: "2026-10-17", ruling: "K2241" }, "civicsmith", "group"], e.name);
    assert.ok(e.earlier.length >= 1 && e.earlier.at(-1).version === e.version - 1, `${e.name}: the version it follows kept`);
    assert.notDeepEqual(e.earlier.at(-1).steps, e.steps, `${e.name}: it differs from the one it follows`);
  }
  for (const e of same) assert.deepEqual([e.source === COMMIT, e.approved.at === "2026-10-17"], [false, false], `${e.name}: kept as it was`);
  /* the four renamed scripts */
  const renamed = { "Say who your team is": "Say who your group is", "Update your team's Civicsmith": "Update your group's Civicsmith",
                    "Use another team's case": "Use another group's case", "Comment for the team": "Comment for the group" };
  for (const [now, was] of Object.entries(renamed)) {
    const e = by(now);
    assert.ok(e && gained.includes(e), `${now}: carried under the file's name and gained a version`);
    assert.ok(!wz.CIVICSMITH_LIBRARY.some((x) => x.name === was), `${was}: no longer a name in the library`);
    assert.equal(LIB_T50.scripts.find((k) => k.id === e.id).name, now);
  }
  /* read as the plane serves it: the latest approved by BOB, the version before it updated, naming it and not offered */
  const w = real();
  for (const e of gained) {
    const latest = w.wz.wizardRead({ script: e.id, viewer: F });
    assert.deepEqual([latest.version.id, latest.version.state, latest.version.author, latest.version.approved],
                     [`${e.id}@${e.version}`, "approved", { name: "civicsmith" }, { by: { name: "BOB" }, at: "2026-10-17", ruling: "K2241" }], e.name);
    const prior = w.wz.wizardRead({ script: e.id, version: `${e.id}@${e.version - 1}`, viewer: F });
    assert.deepEqual([prior.version.state, prior.version.updated_by, prior.offered], ["updated", `${e.id}@${e.version}`, false], `${e.name}: the version before`);
  }
  /* the only owed op a library step carries is updatestart (R38) */
  assert.deepEqual(wz.CIVICSMITH_LIBRARY.flatMap((e) => e.steps.map((t) => t.act)).filter((a) => OWED_OPS.includes(a)), ["updatestart"]);
  assert.ok(!JSON.stringify(wz.CIVICSMITH_LIBRARY).includes("owed:"));
  /* a script's name and steps are read from the file: this module holds no sentence of its own */
  for (const e of wz.CIVICSMITH_LIBRARY) for (const t of e.steps) {
    const k = LIB_R45.scripts.find((x) => x.id === e.id);
    assert.ok(k.versions[0].steps.some((u) => u.what === t.what && u.why === t.why), `${e.name}: ${t.what.slice(0, 40)}`);
  }
});

test("R42 control: a step naming an op that is neither declared nor owed fails R14's walk by name: a required script with a step on an op no table holds is named with its refusal and step; an offered one with the same step is withheld (R11); the carried library, walked against every op the file names, fails nothing", () => {
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: ["publish"], machineDrafts: [],
                                         irreversible: ["publish", "publishat", "publishatmove"], library: wz.CIVICSMITH_LIBRARY }), []);
  const setup = by("Set up and claim");
  const broken = (id, steps) => wz.CIVICSMITH_LIBRARY.map((e) => (e.id === id ? { ...e, steps } : e));
  const bad = [...setup.steps.slice(0, 4), step("install", "nosuchop"), ...setup.steps.slice(4)];
  const fails = wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, machineRefused: ["publish"], machineDrafts: [],
                                      irreversible: ["publish", "publishat", "publishatmove"], library: broken(setup.id, bad) });
  assert.deepEqual(fails.map((f) => [f.name, f.refusal.code, f.refusal.step]), [["Set up and claim", "WIZARD_ACT_UNKNOWN", 5]]);
  /* an op owed and not yet declared is no better: the update script's step on updatestart fails R12 until it is declared, and, being optional, blocks no release */
  const update = by("Update your team's Civicsmith");
  assert.deepEqual(wz.requiredFailures({ screens: wz.SCREEN_REGISTRY, ops: DECLARED_OPS, machineRefused: [], machineDrafts: [], irreversible: [], library: wz.CIVICSMITH_LIBRARY }), [],
                   "the required flows walk no owed op");
  assert.deepEqual(wz.checkScript(update.steps, { screens: wz.SCREEN_REGISTRY, ops: DECLARED_OPS, offered: [] }).refusals.map((f) => [f.code, f.step]), [["WIZARD_ACT_UNKNOWN", 2]]);
  assert.deepEqual(wz.checkScript(update.steps, { screens: wz.SCREEN_REGISTRY, ops: ALL_OPS, offered: [] }).refusals, []);
  /* offered: the group's world withholds the script with the unknown op */
  const w = world({ register: false });
  w.member("frank");
  w.wz.wizardRegister({ ops: ALL_OPS, library: broken(by("Your ties").id, [step("ties", "nosuchop"), step("ties", null)]) });
  assert.ok(!w.wz.wizardsAt({ screen: "ties", viewer: F }).scripts.some((s) => s.id === by("Your ties").id), "withheld");
});

test("R43 (T50; N1194; amends R10) a saved draft is listed: wizards({state: \"draft\"}) lists it to its author, to the owners of its project and to administrators who may see the project, and to no other member; controls: a second member of the project does not list it, a member outside the project does not, an administrator neither invited nor joined to a hidden project does not (D54), and a draft never saved (a refused start, a refused revision) lists to no one", () => {
  const w = seeded();
  w.member("gwen"); w.join(w.P, "gwen");
  w.join(w.P, "erin", "invited");   /* D54: the administrator is invited, so she may see the hidden project */
  const ids = (viewer) => w.wz.wizards({ state: "draft", viewer }).scripts.map((s) => s.id);
  /* she saves a draft: a recording, then a revision of its steps */
  const saved = draft(w, { who: "frank", name: "Frank's saved draft" });
  const listed = w.wz.wizards({ state: "draft", viewer: F });
  assert.deepEqual([listed.ok, listed.state, listed.scripts.map((s) => s.id), listed.truncated], [true, "draft", [saved.script], false], "its author lists it");
  const v = listed.scripts[0].versions[0];
  assert.deepEqual([v.id, v.state, v.author.id, v.start], [saved.version, "draft", "frank", "case-home"]);
  assert.deepEqual(ids(A), [saved.script], "the project's owner lists it");
  assert.deepEqual(ids(V("bob")), [saved.script], "so does its other owner");
  assert.deepEqual(ids(E), [saved.script], "the administrator, who may see the project");
  /* controls: a second member of the project, one outside it, and a machine */
  assert.deepEqual(ids(G), [], "gwen, joined, not an owner, not the author");
  assert.deepEqual(ids(V("carol")), [], "carol, invited, not joined");
  assert.deepEqual(ids(D), [], "dave, outside the project");
  assert.deepEqual(w.wz.wizards({ state: "draft", viewer: "class:ai" }).scripts, [], "a machine");
  assert.deepEqual(w.wz.wizards({ state: "draft", viewer: "nobody" }).scripts, []);
  /* D54: a hidden project's draft is listed to no administrator who is neither invited nor joined to it */
  const x = seeded();
  const hidden = draft(x, { who: "frank", name: "Hidden project's draft" });
  assert.deepEqual(x.wz.wizards({ state: "draft", viewer: E }).scripts.map((s) => s.id), [], "D54: erin is uninvited to the hidden project");
  assert.deepEqual(x.wz.wizards({ state: "draft", viewer: F }).scripts.map((s) => s.id), [hidden.script], "control: its author lists it");
  /* a draft never saved lists to no one: a blank start without the advanced editor, a revision that adds a pair, a recording carrying a value */
  const before = w.snapshot();
  const blank = w.wz.wizardDraft({ project: w.P, name: "Never saved", author: G, viewer: G });
  assert.deepEqual([blank.ok, blank.code], [false, "WIZARD_EDITOR_NOT_GRANTED"]);
  const carried = w.wz.wizardDraft({ project: w.P, name: "Never saved either", recorded: [{ screen: "case-home", act: "casenote", text: "typed" }], author: G, viewer: G });
  assert.deepEqual([carried.ok, carried.code], [false, "WIZARD_RECORDING_CARRIES_VALUES"]);
  const mine = draft(w, { who: "gwen", name: "Gwen's saved draft", steps: [STEPS[0]] });
  const added = w.wz.wizardRevise({ version: mine.version, steps: [STEPS[0], step("publish", "publish")], author: G, viewer: G });
  assert.deepEqual([added.ok, added.code], [false, "WIZARD_EDITOR_NOT_GRANTED"]);
  assert.deepEqual(ids(G), [mine.script], "gwen lists only the draft she saved");
  assert.deepEqual(ids(A).sort(), [saved.script, mine.script].sort(), "the owner lists both saved drafts and nothing of the refused starts");
  assert.deepEqual(ids(E).sort(), [saved.script, mine.script].sort());
  assert.deepEqual(w.snapshot()["wiz_scripts"], JSON.stringify(w.rows(`SELECT * FROM wiz_scripts`)), "the refused calls left no script behind");
  assert.notDeepEqual(before, w.snapshot());
  /* a draft that is submitted or withdrawn is no longer a draft of this list */
  w.wz.wizardSubmit({ version: saved.version, author: F, viewer: F });
  assert.deepEqual(ids(F), [], "submitted: no longer a draft");
  assert.deepEqual(ids(A), [mine.script]);
  /* the op, through the ops table, from a member's session */
  const viaOp = wz.wizardScriptsOps(w.wz, new URL(`https://x/?op=wizards&state=draft&viewer=${encodeURIComponent(G)}`), null).wizards();
  assert.deepEqual(viaOp.scripts.map((s) => s.id), [mine.script]);
  assert.deepEqual(w.wz.wizards({ state: "draft", viewer: G }), viaOp);
});
