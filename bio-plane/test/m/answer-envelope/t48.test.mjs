/* answer-envelope T48 (T48-65; N996, K3101; N1039, K3147; K3280): R17, the family order beside ai-accounts' file, and R18,
   the tables built on first read, driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { M } from "./load.mjs";
import * as AI from "../../../src/ai-accounts/checks.mjs";
import * as CR from "../../../src/credentials/checks.mjs";
import * as FT from "../../../src/filing-templates/checks.mjs";
import * as FI from "../../../src/filings/checks.mjs";

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const families = (ns) => Object.entries(ns).filter(([k, v]) => isFamily(k, v));
const paths = () => M.CHECK_FAMILY_FILES.map(([p]) => p);
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);

test("R17 (T48; N996, K3101; amends R7, R14): CHECK_FAMILY_FILES reads src/ai-accounts/checks.mjs directly before src/credentials/checks.mjs (after project-roster's), its place in build/modules.json, each moved row decorating with its own code, check and translation, read from ai-accounts' family (negative control: credentials' file, read first, would hold none of them)", () => {
  const p = paths();
  const i = p.indexOf("src/ai-accounts/checks.mjs");
  assert.ok(i > 0);
  assert.equal(p[i + 1], "src/credentials/checks.mjs");
  assert.equal(p[i - 1], "src/project-roster/checks.mjs");
  assert.equal(p.filter((x) => x === "src/ai-accounts/checks.mjs").length, 1);
  assert.ok(MODULES.indexOf("ai-accounts") >= 0 && MODULES.indexOf("ai-accounts") < MODULES.indexOf("credentials"), "modules.json order");
  /* the file is the one namespace listed, the family its AI_ACCOUNT_CHECKS */
  assert.equal(M.CHECK_FAMILY_FILES[i][1], AI);
  const moved = Object.entries(AI.AI_ACCOUNT_CHECKS);
  assert.ok(moved.length >= 20, String(moved.length));
  for (const [code, row] of moved) {
    assert.equal(M.CHECK_FAMILIES.AI_ACCOUNT_CHECKS[code], row, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
    assert.match(row.check, /^C-29\./, code);
    /* no row of credentials' own families holds the code: the move left none behind */
    for (const [, f] of families(CR)) assert.equal(Object.hasOwn(f, code), false, code);
  }
  /* DISCLOSURE_DUE's C-29.40 is among them (R14) */
  assert.equal(M.CHECK_FAMILIES.AI_ACCOUNT_CHECKS.DISCLOSURE_DUE.check, "C-29.40");
  assert.equal(M.dec49Row("DISCLOSURE_DUE").check, "C-29.40");
  /* control: credentials' own rows (C-29.1–.5 among them) still decorate from its family */
  const own = families(CR).flatMap(([name, f]) => Object.entries(f).map(([code, row]) => [name, code, row]));
  assert.ok(own.some(([, , row]) => /^C-29\.[1-5]$/.test(row.check)));
  for (const [name, code, row] of own) {
    assert.equal(M.CHECK_FAMILIES[name]?.[code], row, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  }
  /* negative control: the rows are told apart from credentials' own by family */
  assert.equal(Object.keys(M.CHECK_FAMILIES).includes("AI_ACCOUNT_CHECKS"), true);
  assert.equal(moved.some(([code]) => own.some(([, c]) => c === code)), false);
});

test("R7, R17 (T48; K3280): C-115.47 RFC_QUOTING_MISSING decorates from filing-templates' table (its R33), filings' table holding no row for it (negative control: a code neither holds has no row)", () => {
  const row = FT.FILING_TEMPLATE_CHECKS.RFC_QUOTING_MISSING;
  assert.equal(row.check, "C-115.47");
  assert.equal(M.CHECK_FAMILIES.FILING_TEMPLATE_CHECKS.RFC_QUOTING_MISSING, row);
  assert.deepEqual(M.dec49Row("RFC_QUOTING_MISSING"), { check: "C-115.47", translation: row.translation });
  for (const [, f] of families(FI)) assert.equal(Object.hasOwn(f, "RFC_QUOTING_MISSING"), false);
  assert.equal(Object.values(M.CHECK_FAMILIES).filter((f) => Object.hasOwn(f, "RFC_QUOTING_MISSING")).length, 1);
  assert.equal(M.dec49Row("NO_SUCH_CODE_ANYWHERE"), null);
});

/* R18: a fresh process counts the freezes of family tables and of file-list entries (what building them does), after the
   import and after each first read. */
const PROBE = `
import { registerHooks } from "node:module";
registerHooks({ resolve(spec, ctx, next) {
  if (spec === "cloudflare:workers") return { url: "data:text/javascript,export class DurableObject{};export const env={};", shortCircuit: true };
  return next(spec, ctx); } });
let fam = 0, files = 0;
const freeze = Object.freeze;
Object.freeze = (o) => {
  if (Array.isArray(o) && o.length === 2 && typeof o[0] === "string" && /^src\\/.*\\.mjs$/.test(o[0])) files++;
  else if (o && typeof o === "object" && !Array.isArray(o)) { const v = Object.values(o)[0]; if (v && typeof v === "object" && typeof v.check === "string") fam++; }
  return freeze(o);
};
const M = await import(process.argv[1]);
const marks = {};
const mark = (k) => { marks[k] = [fam, files]; };
mark("import");
M.json({ ok: true }); M.json({ ok: false }); mark("json");
M.dispatchRow("UNKNOWN_OP"); M.requiredArgumentRow("REQUIRED_ARGUMENT_MISSING"); mark("rows");
const row = M.dec49Row("NO_FINDINGS"); mark("dec49Row");
const again = M.dec49Row("NO_FINDINGS"); mark("again");
const names = Object.keys(M.CHECK_FAMILIES).length, count = M.CHECK_FAMILY_FILES.length; mark("tables");
console.log(JSON.stringify({ marks, row, same: JSON.stringify(row) === JSON.stringify(again), names, count,
  frozen: Object.isFrozen(M.CHECK_FAMILIES) && Object.isFrozen(M.CHECK_FAMILY_FILES) && Object.values(M.CHECK_FAMILIES).every(Object.isFrozen),
  isArray: Array.isArray(M.CHECK_FAMILY_FILES) }));
`;

test("R18 (T48; N1039, K3147; amends R7): CHECK_FAMILIES, CHECK_FAMILY_FILES and the row table are built on first read, not at import: a fresh import, answers that decorate no refusal, and a dispatch row, build nothing; the first read of a code's row builds the families once, the first read of the file list builds it once, a second read builds nothing again, and every table then reads frozen as before (control: the first read does build them)", () => {
  const url = new URL("../../../src/answer-envelope/index.mjs", import.meta.url).href;
  const out = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", PROBE, url], { encoding: "utf8" }).trim().split("\n").pop());
  const m = out.marks;
  assert.deepEqual(m.json, m.import, "answers that read no row build nothing");
  assert.deepEqual(m.rows, m.import, "dispatch rows read the doors' own table, not the families");
  assert.equal(m.dec49Row[0] > m.rows[0], true, "the first read builds the families");
  assert.equal(m.dec49Row[1], 0, "the file list is its own table, built only when it is read");
  assert.deepEqual(m.again, m.dec49Row, "a second read builds nothing again");
  assert.equal(m.tables[0], m.dec49Row[0], "the families are built once");
  assert.equal(m.tables[1], 90, "the file list is built by its first read, one frozen entry each");
  assert.equal(out.same, true);
  assert.deepEqual(out.row.check, "C-113.6");
  assert.ok(out.names > 100 && out.count === 90, `${out.names} ${out.count}`);
  assert.equal(out.frozen, true);
  assert.equal(out.isArray, true);
});

test("R18 (T48; N1039): the lazy tables read as the plain ones did: entries, length, frozenness, prototype and a write refused in strict code, identical across reads", () => {
  const f1 = M.CHECK_FAMILY_FILES, f2 = M.CHECK_FAMILY_FILES;
  assert.equal(f1, f2);
  assert.ok(Array.isArray(f1) && f1.length === 90 && Object.isFrozen(f1));
  assert.ok(f1.every((e) => Object.isFrozen(e) && e.length === 2 && typeof e[0] === "string"));
  assert.equal(f1[f1.length - 1][0], "src/answer-envelope/checks.mjs");
  assert.equal(Object.getPrototypeOf(f1), Array.prototype);
  assert.equal(Object.getPrototypeOf(M.CHECK_FAMILIES), Object.prototype);
  assert.throws(() => { "use strict"; f1.push(["x", {}]); }, TypeError);
  assert.throws(() => { "use strict"; M.CHECK_FAMILIES.NEW_CHECKS = {}; }, TypeError);
  assert.throws(() => { "use strict"; delete M.CHECK_FAMILIES.AI_ACCOUNT_CHECKS; }, TypeError);
  assert.ok("AI_ACCOUNT_CHECKS" in M.CHECK_FAMILIES);
  assert.equal(M.CHECK_FAMILIES.AI_ACCOUNT_CHECKS, M.CHECK_FAMILIES.AI_ACCOUNT_CHECKS);
  assert.deepEqual(Object.keys(M.CHECK_FAMILIES), Object.keys({ ...M.CHECK_FAMILIES }));
  assert.equal(JSON.stringify(M.CHECK_FAMILIES).length > 100000, true);
});
