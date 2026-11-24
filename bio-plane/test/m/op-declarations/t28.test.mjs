/* op-declarations R14: the specs of the ops `case-import` and `case-checker` add (N520, N522; DEC-112 (3)(6), DEC-96
   items 1, 2; case-import R1–R8; case-checker R15; public-read R18) — each compared whole with the stamps its lists name,
   both session sets and its NEEDS row, in the form of R13's tests in `t27.test.mjs` — and `publish` and
   `publishpreflight` unchanged, `flagsDisclosed` a body field and never a stamp. Each comparison has a negative control:
   a drifted table is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { caseImportOps } from "../../../src/case-import/index.mjs";
import { REGISTERED } from "./register-owners.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (spec) => ({ ...spec, ...(Array.isArray(spec.classes) ? { classes: [...spec.classes] } : {}),
                           ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
const SESSION_ONLY = { classes: ["admin", "member"], machineClasses: [], mutating: false };
const PUBLIC = { classes: null, mutating: false };

/* The stamps each list confers at the door (control-plane reads the lists): `viewer` for case-import's acts and reads,
   `by` for the six acts a member performs in their own name; a public read's list stamps nothing. The lists that name
   `publish` and `publishpreflight` today, with theirs: `STATE_ACTIONS` confers `author`, `owner` and `viewer`. */
const STAMPS = { CASE_IMPORT_ACTIONS: ["viewer"], CASE_IMPORT_READS: ["viewer"], CASE_IMPORT_BY: ["by"],
                 CASE_CHECKER_PUBLIC_READS: [], STATE_ACTIONS: ["author", "owner", "viewer"] };
const stampsOf = (op, lists = listsHolding(op)) => [...new Set(lists.flatMap((l) => STAMPS[l] ?? []))].sort();

/* R14's ops as it lists them: the spec, the op it is declared as (`like`), the lists that name it, its stamps and its
   NEEDS row. Every member op is a member session's only (`knocksof`'s fence, docket's shape); the reads and the public
   reads carry a present null row (affordances R35 names each). */
const ACT = { spec: { ...SESSION_ONLY, mutating: true }, like: "docketpost", needs: "contribute",
              lists: ["CASE_IMPORT_ACTIONS", "CASE_IMPORT_BY"], stamps: ["by", "viewer"] };
const READ = { spec: SESSION_ONLY, like: "docket", needs: null, lists: ["CASE_IMPORT_READS"], stamps: ["viewer"] };
const PUB = { spec: PUBLIC, like: "docketpublic", needs: null, lists: ["CASE_CHECKER_PUBLIC_READS"], stamps: [] };
const R14 = {
  caseimport: ACT, caseimportdocument: ACT, importaccept: ACT, importacceptwithdraw: ACT, importflag: ACT,
  importflagclear: ACT, importedcases: READ, importedcase: READ, casechecker: PUB, casefilespec: PUB,
};
const PUBLIC_OPS = Object.keys(R14).filter((op) => R14[op].spec.classes === null);
const SESSION_REACHED = Object.keys(R14).filter((op) => R14[op].spec.classes !== null);
const admitsBearer = (op, cls) => Array.isArray(OPS[op].classes)
  && (Array.isArray(OPS[op].machineClasses) ? OPS[op].machineClasses : OPS[op].classes).includes(cls);

test("R14, R2: OPS holds a spec for each op case-import and case-checker add — caseimport, caseimportdocument, importaccept, importacceptwithdraw, importflag and importflagclear mutating, importedcases and importedcase reads, each admin and member with machineClasses []; casechecker and casefilespec classes null, not mutating — none naming ai (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R14).length, 10);
  for (const [op, want] of Object.entries(R14)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want.spec, op);
    assert.deepEqual(plain(OPS[op]), plain(OPS[want.like]), `${op} as ${want.like}`);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  }
  assert.notDeepEqual(plain({ ...OPS.importaccept, machineClasses: ["admin"] }), R14.importaccept.spec);
  assert.notDeepEqual(plain({ ...OPS.importedcase, mutating: true }), R14.importedcase.spec);
  assert.notDeepEqual(plain({ ...OPS.casechecker, classes: ["admin"] }), R14.casechecker.spec);
});

test("R14, R2: no machine class, agent credential or operator token imports, completes, accepts, withdraws, flags, clears or reads an import — machineClasses [] on each of the eight, so every bearer (admin, member, probe, daemon) is refused and only a session's kind is admitted", () => {
  assert.equal(SESSION_REACHED.length, 8);
  for (const op of SESSION_REACHED) {
    assert.deepEqual([...OPS[op].machineClasses], [], op);
    for (const cls of ["admin", "member", "probe", "daemon"]) assert.equal(admitsBearer(op, cls), false, `${op}: ${cls}`);
    /* An agent credential is admitted only to an op a member reaches with no machineClasses (R2): not these. */
    assert.ok("machineClasses" in OPS[op], op);
    assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
  }
  /* Negative control: an op without the fence admits a bearer. */
  assert.equal(admitsBearer("publish", "probe"), true);
});

test("R14, R3: each case-import op is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session), the public reads in neither (machine); NEEDS is contribute exactly for the six mutating ops and a present null for the two reads and the two public reads; none is unattended", () => {
  for (const op of SESSION_REACHED) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
  }
  for (const op of PUBLIC_OPS) {
    assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), `${op} is in a session set`);
    assert.equal(ACT_GATE.mode(op), "machine", op);
  }
  assert.deepEqual(PUBLIC_OPS.sort(), ["casechecker", "casefilespec"]);
  for (const [op, want] of Object.entries(R14)) {
    assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
    assert.equal(NEEDS[op], want.needs, op);
    assert.equal(ACT_GATE.needs(op), want.needs, op);
    /* contribute exactly for every mutating op a member's session reaches */
    assert.equal(NEEDS[op] === "contribute", OPS[op].mutating && SESSION_OPS.member.has(op), op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  /* Negative control: an op with no row reads as needing nothing, so each null above is a row of R14's own. */
  assert.equal(Object.hasOwn(NEEDS, "nosuchop"), false);
  assert.equal(ACT_GATE.needs("nosuchop"), null);
});

test("R14, R4: the act lists name each op's stamps — by and viewer for caseimport, caseimportdocument, importaccept, importacceptwithdraw, importflag and importflagclear; viewer for importedcases and importedcase; nothing for casechecker and casefilespec", () => {
  for (const [op, want] of Object.entries(R14)) {
    assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
    assert.deepEqual(stampsOf(op), want.stamps, op);
  }
  /* R16's watch ops follow R14's six in the same lists (`t31.test.mjs`). */
  assert.deepEqual([...O.CASE_IMPORT_ACTIONS], ["caseimport", "caseimportdocument", "importaccept", "importacceptwithdraw",
                                                "importflag", "importflagclear", "importwatch", "importunwatch"]);
  assert.deepEqual([...O.CASE_IMPORT_READS], ["importedcases", "importedcase"]);
  assert.deepEqual([...O.CASE_IMPORT_BY], [...O.CASE_IMPORT_ACTIONS]);
  assert.deepEqual([...O.CASE_CHECKER_PUBLIC_READS], ["casechecker", "casefilespec"]);
  /* No op of R14 is in another module's list: no action-layer author or viewer stamp, no other module's `by`. */
  for (const op of Object.keys(R14)) assert.ok(listsHolding(op).every((l) => /^CASE_(IMPORT|CHECKER)_/.test(l)), op);
  /* Negative control: an op in no list is stamped nothing; a stamped op moved out of its list loses its stamp. */
  assert.deepEqual(stampsOf("nosuchop"), []);
  assert.deepEqual(stampsOf("importaccept", ["CASE_IMPORT_ACTIONS"]), ["viewer"]);
});

test("R14: publish and publishpreflight keep their specs, NEEDS rows and lists — flagsDisclosed is a body field, named by no act list as a stamp and by no table", () => {
  assert.deepEqual(plain(OPS.publish), { classes: ["admin", "member", "probe"], mutating: true });
  assert.deepEqual(plain(OPS.publishpreflight), { classes: ["admin", "member", "probe"], mutating: false });
  assert.equal(NEEDS.publish, "publish");
  assert.ok(Object.hasOwn(NEEDS, "publishpreflight") && NEEDS.publishpreflight === null);
  assert.deepEqual(listsHolding("publish"), ["STATE_ACTIONS"]);
  assert.deepEqual(listsHolding("publishpreflight"), []);
  assert.deepEqual(stampsOf("publish"), ["author", "owner", "viewer"]);
  assert.ok(SESSION_OPS.member.has("publish") && SESSION_OPS.admin.has("publish"));
  /* No table, list or spec names flagsDisclosed (or tensionsDisclosed, the body field it is read as). */
  const text = JSON.stringify([OPS, NEEDS, UNATTENDED_BY_DECISION, PLAN_RUN_SCOPE, [...SESSION_OPS.member],
                               [...SESSION_OPS.admin], LISTS]);
  for (const field of ["flagsDisclosed", "tensionsDisclosed"]) assert.ok(!text.includes(field), field);
  for (const [name] of LISTS) assert.ok(!(STAMPS[name] ?? []).includes("flagsDisclosed"), name);
  /* Negative control: the scan sees a name a table carries. */
  assert.ok(text.includes("publishpreflight"));
});

test("R14, R6: every op case-import's ops map serves has a spec the door answers by name, and the tables name each one — OPS, NEEDS, an act list and both session sets; case-checker's two public reads (its R15) are specced and in neither set (negative control: an op added to the map without a spec is seen)", () => {
  const served = Object.keys(caseImportOps({}, new URL("https://instance.invalid/"), {}));
  /* The map also serves R16's two watch ops (N534), declared and tested in `t31.test.mjs`, and the ops case-import declares
     (R33, T51 fix round), read from its registered declarations and never listed here (K3268, R80). */
  const DECLARED = Object.keys(REGISTERED["case-import"]);
  assert.deepEqual([...served].sort(), [...new Set([...SESSION_REACHED, "importwatch", "importunwatch", ...DECLARED])].sort());
  /* An op its owner declares and no act list names is stamped by the declaration, as R80 registers it. */
  const declaredOnly = (op) => DECLARED.includes(op) && listsHolding(op).length === 0;
  for (const op of [...served, ...PUBLIC_OPS]) {
    assert.match(op, /^[a-z]+$/, op);
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op), `${op}: no spec or NEEDS row`);
    if (declaredOnly(op)) assert.deepEqual([...O.OP_STAMPS[op]].sort(), [...(REGISTERED["case-import"][op].stamps ?? ["viewer"])].sort(), op);
    else assert.ok(listsHolding(op).length > 0, `${op} is in no act list`);
    assert.equal(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), OPS[op].classes !== null, op);
  }
  /* case-import's lists name exactly its map's ops that no declaration stamps: the mutating ops its acts, the rest its reads. */
  assert.deepEqual([...O.CASE_IMPORT_ACTIONS].sort(), served.filter((op) => OPS[op].mutating && !declaredOnly(op)).sort());
  assert.deepEqual([...O.CASE_IMPORT_READS].sort(), served.filter((op) => !OPS[op].mutating && !declaredOnly(op)).sort());
  /* Negative control: a map that serves an op with no spec is seen; names the modules do not serve are no op. */
  assert.deepEqual([...served, "importdelete"].filter((op) => !Object.hasOwn(OPS, op)), ["importdelete"]);
  /* (T45: case-check's `casecheck` is a declared op since R49, so it is no control here) */
  for (const op of ["importedit", "caseimportcheck", "caseimports"]) assert.ok(!Object.hasOwn(OPS, op), op);
  /* Control (K3268): an op in no hand table and no owner's declaration is refused — no spec, no session set, the gate answers machine. */
  assert.equal(Object.hasOwn(OPS, "importnosuchop"), false);
  assert.equal(SESSION_OPS.member.has("importnosuchop"), false);
  assert.equal(ACT_GATE.mode("importnosuchop"), "machine");
});
