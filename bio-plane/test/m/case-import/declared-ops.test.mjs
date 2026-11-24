/* case-import R33 (T51 fix round; K4168, K4202): each op this module declares in DECLARED_OPS is held true against the op as
   the door runs it (test-support R15): only its requires raise no refusal naming a declared field, a call without each
   required one is refused naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, CASE_IMPORT_OPS } from "../../../src/case-import/index.mjs";
import { importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { seeded, imp, caseFile, door, V, F1 } from "./fixture.mjs";

const PROJECT = "PRJ-2026-0001-rerun", OWN = "INQ-2026-0101-own";
/* a refusal names a field in its code or detail as a whole word, or as the list the act refuses in (`missing`, `findings`) */
const names = (answer, field) => {
  if (!answer || typeof answer !== "object" || answer.ok !== false) return false;
  const text = [answer.code, answer.detail].map((v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  if (new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test(text)) return true;
  if (Array.isArray(answer.missing) && answer.missing.includes(field)) return true;
  return field === "findings" && Array.isArray(answer.findings);
};
const sameVerdict = (x, y) => x?.ok === y?.ok && (x.code ?? x.reason) === (y.code ?? y.reason);

async function world() {
  const w = seeded();
  const a = await imp(w);
  w.project(PROJECT, { owner: "alice" });
  w.ownFinding(PROJECT, OWN, { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } });
  const as = { viewer: V("alice"), by: V("alice") };
  return { w, a, as };
}
const hold = (op, call, values, extra = {}) =>
  declaredOpHolds({ op, declaration: DECLARED_OPS[op], call, values, refusedNaming: names, same: sameVerdict, ...extra });

test("R33 DECLARED_OPS declares the nine ops this module serves that a screen sends or this tranche adds, each of its ops map, with the rows the hand tables hold", () => {
  assert.deepEqual(Object.keys(DECLARED_OPS).sort(), ["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importregrade",
    "importwatch", "rerunpair", "rerunread", "rerunstart"]);
  for (const op of ["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importwatch"]) assert.ok(CASE_IMPORT_OPS.includes(op), op);
  /* the hand rows (op-declarations, op-grades): classes admin and member, no machine class; the weights of op-grades */
  const row = (op) => DECLARED_OPS[op];
  for (const op of Object.keys(DECLARED_OPS)) {
    assert.deepEqual(row(op).classes, ["admin", "member"], op);
    assert.deepEqual(row(op).machineClasses, [], op);
    assert.ok(Array.isArray(row(op).fields.accepts) && Array.isArray(row(op).fields.requires), op);
    assert.equal(typeof row(op).description, "string", op);
  }
  /* the five with hand rows carry op-grades' act help for them, which a declaration must equal (its R50); the four new ones, their own sentence */
  const handHelp = new Set(["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importwatch"].map((op) => row(op).description));
  assert.equal(handHelp.size, 1);
  for (const op of ["importregrade", "rerunstart", "rerunpair", "rerunread"]) assert.equal(hasWord(row(op).description), false, `${op} has no design key yet: its sentence is written once`);
  assert.deepEqual(["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importwatch"].map((op) => [row(op).mutating, row(op).weight]),
    [[true, "undetermined"], [true, "reasoned"], [true, "reasoned"], [true, "reasoned"], [true, "reversible"]]);
  /* R32's table of the four new ops */
  assert.deepEqual(["importregrade", "rerunstart", "rerunpair", "rerunread"].map((op) => [row(op).mutating, row(op).weight]),
    [[false, "read"], [true, "reversible"], [true, "reversible"], [false, "read"]]);
  for (const op of ["rerunstart", "rerunpair"]) assert.deepEqual([row(op).stamps, row(op).needs], [["viewer", "by"], "contribute"], op);
  for (const op of ["importregrade", "rerunread"]) assert.deepEqual([row(op).stamps, row(op).needs], [["viewer"], null], op);
  assert.deepEqual(row("rerunpair").fields, { accepts: ["project", "source_finding", "own_finding", "edition", "withdraw"],
                                              requires: ["project", "source_finding", "own_finding"] });
  /* the reasoned acts name the refusal an absent reason gets */
  assert.deepEqual(["importaccept", "importacceptwithdraw", "importflag"].map((op) => row(op).refusal),
    ["IMPORT_ACCEPT_NO_REASON", "IMPORT_ACCEPT_NO_REASON", "IMPORT_FLAG_NO_ISSUE"]);
});

test("R33 caseimport declares its fields: its parts alone raise no refusal naming a declared field, a call without parts is refused naming it, and a field outside accepts is dropped", async () => {
  const w = seeded();
  await hold("caseimport", (f) => door(w, "caseimport", { viewer: V("alice"), by: V("alice"), ...f }), { parts: caseFile().parts });
});

test("R33 importaccept declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  await hold("importaccept", (f) => door(w, "importaccept", { ...as, ...f }),
    { import: a.import, edition: 1, findings: [F1], checked: "every passage", reason: "the chain holds" });
});

test("R33 importacceptwithdraw declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  /* each call finds an acceptance in force, as the first did */
  const accept = () => w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  await hold("importacceptwithdraw", (f) => { accept(); return door(w, "importacceptwithdraw", { ...as, ...f }); },
    { import: a.import, edition: 1, reason: "the source corrected it" });
});

test("R33 importflag declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  await hold("importflag", (f) => door(w, "importflag", { ...as, ...f }), { import: a.import, edition: 1, issue: "the date is off" },
    { same: (x, y) => x?.ok === y?.ok });
});

test("R33 importwatch declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  await hold("importwatch", (f) => door(w, "importwatch", { ...as, ...f }), { import: a.import, publisher: "https://example.org/civicsmith" });
});

test("R33 importregrade declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  await hold("importregrade", (f) => door(w, "importregrade", { viewer: as.viewer, ...f }), { import: a.import, edition: 1, lens: "removed" });
});

test("R33 rerunstart declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  /* each call finds the project not yet declared a rerun, as the first did */
  await hold("rerunstart", (f) => { w.st.sql.exec(`DELETE FROM case_import_reruns`); return door(w, "rerunstart", { ...as, ...f }); },
    { project: PROJECT, import: a.import, edition: 1 });
});

test("R33 rerunpair declares its fields: its requires alone raise no refusal naming a declared field, a call without each is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, a, as } = await world();
  assert.equal((await door(w, "rerunstart", { ...as, project: PROJECT, import: a.import, edition: 1 })).ok, true);
  await hold("rerunpair", (f) => door(w, "rerunpair", { ...as, ...f }),
    { project: PROJECT, source_finding: importedFindingRef(a.import, F1), own_finding: OWN });
});

test("R33 rerunread declares its fields: its requires alone raise no refusal naming a declared field, a call without the project is refused naming it, and a field outside accepts is dropped", async () => {
  const { w, as } = await world();
  await hold("rerunread", (f) => door(w, "rerunread", { viewer: as.viewer, ...f }), { project: PROJECT });
});

test("R33 the declaration is accepted by op-declarations (R80, R81) and op-grades (R49, R50): the five ops with hand rows agree with them, the four new ones register", () => {
  /* a fresh process, since each registration is once and before the first read of any export */
  const src = `
    import { DECLARED_OPS } from ${JSON.stringify(new URL("../../../src/case-import/index.mjs", import.meta.url).href)};
    const od = await import(${JSON.stringify(new URL("../../../src/op-declarations/index.mjs", import.meta.url).href)});
    const og = await import(${JSON.stringify(new URL("../../../src/op-grades/index.mjs", import.meta.url).href)});
    od.registerDeclaredOps({ "case-import": DECLARED_OPS });
    const r = og.registerDeclaredOps({ "case-import": DECLARED_OPS });
    console.log(JSON.stringify({ registered: r.registered, agreed: r.agreed, fields: od.declaredFields("rerunpair"), needs: od.NEEDS.rerunstart,
      stamps: od.OP_STAMPS.rerunpair, mutating: od.OPS.rerunread.mutating, held: od.OPS.caseimport.mutating }));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", src], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  const out = JSON.parse(run.stdout.trim().split("\n").at(-1));
  assert.deepEqual(out.registered.sort(), ["importregrade", "rerunpair", "rerunread", "rerunstart"]);
  assert.deepEqual(out.agreed.sort(), ["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importwatch"]);
  assert.deepEqual([out.needs, out.stamps, out.mutating, out.held], ["contribute", ["viewer", "by"], false, true]);
  assert.deepEqual(out.fields.requires, ["project", "source_finding", "own_finding"]);
  /* control: a row that disagrees with a hand row is refused, naming the op */
  const bad = `
    import { DECLARED_OPS } from ${JSON.stringify(new URL("../../../src/case-import/index.mjs", import.meta.url).href)};
    const og = await import(${JSON.stringify(new URL("../../../src/op-grades/index.mjs", import.meta.url).href)});
    try { const { refusal, ...row } = DECLARED_OPS.importaccept; og.registerDeclaredOps({ "case-import": { importaccept: { ...row, weight: "terminal" } } }); console.log("accepted"); }
    catch (e) { console.log(e.message); }`;
  const refused = spawnSync(process.execPath, ["--input-type=module", "-e", bad], { encoding: "utf8" });
  assert.match(refused.stdout, /DECLARED_OP_DISAGREES: importaccept/);
});
