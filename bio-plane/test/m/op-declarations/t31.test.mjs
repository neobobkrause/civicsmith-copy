/* op-declarations R15 and R16: the specs of `wizard-scripts`' ops (N528; DEC-120, DEC-121; wizard-scripts R3–R16) and of
   `case-import`'s watch ops (N534; DEC-101 (3); case-import R17) — each compared whole with the stamps its lists name,
   both session sets and its NEEDS row, in the form of R14's tests in `t28.test.mjs`. Each comparison has a negative
   control: a drifted table is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { caseImportOps } from "../../../src/case-import/index.mjs";
import { wizardScriptsOps } from "../../../src/wizard-scripts/index.mjs";
import { REGISTERED } from "./register-owners.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (spec) => ({ ...spec, ...(Array.isArray(spec.classes) ? { classes: [...spec.classes] } : {}),
                           ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
const SESSION_ONLY = { classes: ["admin", "member"], machineClasses: [], mutating: false };
const ANY = { classes: ["admin", "member", "probe"], mutating: false };
const admitsBearer = (op, cls) => Array.isArray(OPS[op].classes)
  && (Array.isArray(OPS[op].machineClasses) ? OPS[op].machineClasses : OPS[op].classes).includes(cls);
/* An agent credential is admitted only to an op a member reaches with no machineClasses and no bearer fence (R2). */
const agentReachable = (op) => Array.isArray(OPS[op].classes) && OPS[op].classes.includes("member")
  && !Array.isArray(OPS[op].machineClasses) && !O.GOVERNANCE_ACTIONS.includes(op) && !O.IDENTITY_ACTIONS.includes(op);

/* The stamps each list confers at the door (control-plane reads the lists, its R50, R52). */
const STAMPS = { WIZARD_SCRIPTS_ACTIONS: ["viewer"], WIZARD_SCRIPTS_AUTHOR: ["author"], WIZARD_SCRIPTS_BY: ["by"],
                 WIZARD_PROPOSAL_ACTIONS: ["proposer"], WIZARD_PROGRESS_ACTIONS: [], WIZARD_SCRIPTS_READS: ["viewer"],
                 WIZARD_CHECK_READS: [], CASE_IMPORT_ACTIONS: ["viewer"], CASE_IMPORT_BY: ["by"] };
const stampsOf = (op, lists = listsHolding(op)) => [...new Set(lists.flatMap((l) => STAMPS[l] ?? []))].sort();

/* R15's ops as it lists them: spec, lists, stamps, NEEDS row, and whether an `ai` credential may reach it. */
const MEMBER_ACT = (lists, stamps) => ({ spec: { ...SESSION_ONLY, mutating: true }, needs: "contribute", lists, stamps, ai: false });
const READ = { spec: SESSION_ONLY, needs: null, lists: ["WIZARD_SCRIPTS_READS"], stamps: ["viewer"], ai: false };
const R15 = {
  wizarddraft:   MEMBER_ACT(["WIZARD_SCRIPTS_ACTIONS", "WIZARD_SCRIPTS_AUTHOR"], ["author", "viewer"]),
  wizardrevise:  MEMBER_ACT(["WIZARD_SCRIPTS_ACTIONS", "WIZARD_SCRIPTS_AUTHOR"], ["author", "viewer"]),
  wizardsubmit:  MEMBER_ACT(["WIZARD_SCRIPTS_ACTIONS", "WIZARD_SCRIPTS_AUTHOR"], ["author", "viewer"]),
  wizardapprove: MEMBER_ACT(["WIZARD_SCRIPTS_ACTIONS", "WIZARD_SCRIPTS_BY"], ["by", "viewer"]),
  wizardretire:  MEMBER_ACT(["WIZARD_SCRIPTS_ACTIONS", "WIZARD_SCRIPTS_BY"], ["by", "viewer"]),
  wizardeditorgrant:  { spec: { ...SESSION_ONLY, mutating: true }, needs: null, lists: ["WIZARD_SCRIPTS_BY"], stamps: ["by"], ai: false },
  wizardeditorrevoke: { spec: { ...SESSION_ONLY, mutating: true }, needs: null, lists: ["WIZARD_SCRIPTS_BY"], stamps: ["by"], ai: false },
  wizardpropose: { spec: { ...ANY, mutating: true }, like: "templatepropose", needs: "contribute",
                   lists: ["WIZARD_PROPOSAL_ACTIONS", "WIZARD_SCRIPTS_ACTIONS"], stamps: ["proposer", "viewer"], ai: true },
  wizardprogress: { spec: { ...SESSION_ONLY, mutating: true }, needs: null, lists: ["WIZARD_PROGRESS_ACTIONS"], stamps: [], ai: false },
  wizards: READ, wizardread: READ, wizardsat: READ, wizarduse: READ, wizardcandidates: READ,
  wizardcheck: { spec: ANY, needs: null, lists: ["WIZARD_CHECK_READS"], stamps: [], ai: true },
};
const R16 = {
  importwatch:   { spec: { ...SESSION_ONLY, mutating: true }, like: "importaccept", needs: "contribute",
                   lists: ["CASE_IMPORT_ACTIONS", "CASE_IMPORT_BY"], stamps: ["by", "viewer"], ai: false },
  importunwatch: { spec: { ...SESSION_ONLY, mutating: true }, like: "importaccept", needs: "contribute",
                   lists: ["CASE_IMPORT_ACTIONS", "CASE_IMPORT_BY"], stamps: ["by", "viewer"], ai: false },
};

for (const [R, ops, n] of [["R15", R15, 15], ["R16", R16, 2]]) {
  test(`${R}, R2: OPS holds the spec ${R} gives each of its ops — compared whole, none naming ai; only the ops ${R} opens to any credential admit a bearer or an agent credential (negative control: a drifted spec is seen)`, () => {
    assert.equal(Object.keys(ops).length, n);
    for (const [op, want] of Object.entries(ops)) {
      assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
      assert.deepEqual(plain(OPS[op]), want.spec, op);
      if (want.like) assert.deepEqual(plain(OPS[op]), plain(OPS[want.like]), `${op} as ${want.like}`);
      assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
      assert.equal(agentReachable(op), want.ai, `${op}: agent credential`);
      for (const cls of ["admin", "member", "probe"]) assert.equal(admitsBearer(op, cls), want.ai, `${op}: ${cls}`);
      assert.equal(admitsBearer(op, "daemon"), false, op);
      assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
    }
    const [first] = Object.keys(ops);
    assert.notDeepEqual(plain({ ...OPS[first], machineClasses: ["admin"] }), ops[first].spec);
    assert.notDeepEqual(plain({ ...OPS[first], mutating: !OPS[first].mutating }), ops[first].spec);
  });

  test(`${R}, R3: each of ${R}'s ops is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session) with the NEEDS row ${R} gives it — contribute for its member acts, a present null otherwise — and none is unattended (negative control: an op with no row reads as needing nothing)`, () => {
    for (const [op, want] of Object.entries(ops)) {
      assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
      assert.equal(ACT_GATE.mode(op), "session", op);
      assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
      assert.equal(NEEDS[op], want.needs, op);
      assert.equal(ACT_GATE.needs(op), want.needs, op);
      assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    }
    assert.equal(Object.hasOwn(NEEDS, "wizardnosuch"), false);
    assert.equal(ACT_GATE.needs("wizardnosuch"), null);
    assert.equal(ACT_GATE.mode("wizardnosuch"), "machine");
  });

  test(`${R}, R4: the act lists name each of ${R}'s ops' stamps, and no list of another module names one (negative control: a stamped op moved out of a list loses that stamp)`, () => {
    for (const [op, want] of Object.entries(ops)) {
      assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
      assert.deepEqual(stampsOf(op), want.stamps, op);
    }
    const [first] = Object.keys(ops);
    assert.deepEqual(stampsOf(first, []), []);
    assert.deepEqual(stampsOf("nosuchop"), []);
  });
}

test("R15, R4: the wizard lists are exactly R15's ops — the progress tally and the check stamp nothing that names a member, the proposal names its proposer and never an author", () => {
  assert.deepEqual([...O.WIZARD_SCRIPTS_ACTIONS], ["wizarddraft", "wizardrevise", "wizardsubmit", "wizardapprove", "wizardretire",
                                                   "wizardpropose"]);
  assert.deepEqual([...O.WIZARD_SCRIPTS_AUTHOR], ["wizarddraft", "wizardrevise", "wizardsubmit"]);
  assert.deepEqual([...O.WIZARD_SCRIPTS_BY], ["wizardapprove", "wizardretire", "wizardeditorgrant", "wizardeditorrevoke"]);
  assert.deepEqual([...O.WIZARD_PROPOSAL_ACTIONS], ["wizardpropose"]);
  assert.deepEqual([...O.WIZARD_PROGRESS_ACTIONS], ["wizardprogress"]);
  assert.deepEqual([...O.WIZARD_SCRIPTS_READS], ["wizards", "wizardread", "wizardsat", "wizarduse", "wizardcandidates"]);
  assert.deepEqual([...O.WIZARD_CHECK_READS], ["wizardcheck"]);
  const wizardLists = LISTS.filter(([name]) => name.startsWith("WIZARD_"));
  assert.deepEqual([...new Set(wizardLists.flatMap(([, l]) => l))].sort(), Object.keys(R15).sort());
  for (const op of ["wizardprogress", "wizardcheck"])
    for (const s of ["author", "by", "viewer", "proposer"]) assert.ok(!stampsOf(op).includes(s), `${op}: ${s}`);
  assert.ok(!stampsOf("wizardpropose").includes("author") && !O.QUERY_AUTHOR_ACTIONS.includes("wizardpropose"));
});

test("R16, R6: every op case-import's ops map serves has a spec and is named by the tables, the watch ops among them; case-import's acts list names exactly the map's mutating ops (negative control: an op added to the map without a spec is seen)", () => {
  const served = Object.keys(caseImportOps({}, new URL("https://instance.invalid/"), {}));
  for (const op of Object.keys(R16)) assert.ok(served.includes(op), `${op} is not served`);
  /* an op case-import declares that no act list names is stamped by its declaration (R80, K3268): read, not listed */
  const DECLARED = Object.keys(REGISTERED["case-import"]);
  const declaredOnly = (op) => DECLARED.includes(op) && listsHolding(op).length === 0;
  for (const op of served) {
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op), `${op}: no spec or NEEDS row`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), op);
    if (declaredOnly(op)) assert.deepEqual([...O.OP_STAMPS[op]].sort(), [...(REGISTERED["case-import"][op].stamps ?? ["viewer"])].sort(), op);
  }
  assert.deepEqual([...O.CASE_IMPORT_ACTIONS].sort(), served.filter((op) => OPS[op].mutating && !declaredOnly(op)).sort());
  assert.deepEqual([...O.CASE_IMPORT_BY].sort(), served.filter((op) => OPS[op].mutating && !declaredOnly(op)).sort());
  assert.deepEqual([...served, "importwatchall"].filter((op) => !Object.hasOwn(OPS, op)), ["importwatchall"]);
});

test("R15, R6: every op R15 declares is a name the door can answer and is named by OPS, NEEDS, an act list and both session sets; the names wizard-scripts does not serve are no op", () => {
  for (const op of Object.keys(R15)) {
    assert.match(op, /^[a-z]+$/, op);
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op), op);
    assert.ok(listsHolding(op).length > 0, `${op} is in no act list`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), op);
  }
  /* Only R15's fifteen are wizard ops: no abandon event (wizard-scripts R15), no delete (R9: retired, never deleted). */
  assert.deepEqual(Object.keys(OPS).filter((op) => op.startsWith("wizard")).sort(), Object.keys(R15).sort());
  for (const op of ["wizardabandon", "wizarddelete", "wizardedit", "recipes"]) assert.ok(!Object.hasOwn(OPS, op), op);
});

test("R15, R6: every op wizard-scripts' ops map serves has a spec and is named by the tables, and the map serves exactly R15's fifteen beside its T34 family (`startfrom`, `baseupdates`; R15, R28) — the wizard lists name exactly the fifteen, its mutating ops the acts and its reads the reads (negative control: an op added to the map without a spec is seen)", () => {
  const all = Object.keys(wizardScriptsOps({}, new URL("https://instance.invalid/"), {}));
  const family = Object.keys(O.OP_FAMILIES["wizard-scripts"].kinds);
  for (const op of all.filter((o) => family.includes(o))) assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(O.OP_STAMPS, op), op);
  assert.deepEqual(all.filter((o) => family.includes(o)).sort(), ["baseupdates", "startfrom"]);
  const served = all.filter((o) => !family.includes(o));
  assert.deepEqual([...served].sort(), Object.keys(R15).sort());
  for (const op of served) {
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op), `${op}: no spec or NEEDS row`);
    assert.ok(listsHolding(op).some((l) => l.startsWith("WIZARD_")), `${op} is in no wizard list`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), op);
  }
  const wizardOps = (re) => [...new Set(LISTS.filter(([name]) => re.test(name)).flatMap(([, l]) => l))].sort();
  assert.deepEqual(wizardOps(/^WIZARD_.*(ACTIONS|AUTHOR|BY)$/), served.filter((op) => OPS[op].mutating).sort());
  assert.deepEqual(wizardOps(/^WIZARD_.*READS$/), served.filter((op) => !OPS[op].mutating).sort());
  /* The tally route the door calls from within itself is no op of the map and has no spec (R6; K1396). */
  assert.ok(!served.includes("wizardrefusaltally") && !Object.hasOwn(OPS, "wizardrefusaltally"));
  assert.deepEqual([...served, "wizarddelete"].filter((op) => !Object.hasOwn(OPS, op)), ["wizarddelete"]);
});
