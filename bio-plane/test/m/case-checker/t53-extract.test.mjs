/* case-checker T53 (N1259; K4403 (3)(4)): a cited register row travels as a labelled extract in its material row
   (`case-grammar` R38, R39), and the source file does not. R29: the checker checks the extract against what it can see,
   each fault a `differs` (or a `missing`) entry naming its field; R8 as amended: such a row is presentable with
   `included: false`. R30: a limited register's notice must be present. R31: the answer says plainly, per extract, that the
   row's presence in the source file cannot be re-derived from the package. R32: the standalone program carries all of it.
   Every extract here is built by `case-grammar`'s own `registerExtractRow` (fixture `extractRow`), never by hand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as CC from "../../../src/case-checker/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { buildProgram } from "../../../src/case-checker/build-program.mjs";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { caseFile, withExtract, extractRow, byId, like, W, A, B, C, MINUTES, EXT, EXT2, REDUCED_SHA, USE_LIMIT } from "./fixture.mjs";

const run = async (opts, args = {}) => CC.checkCaseFile({ parts: caseFile(opts).parts, ...args });
const fieldsOf = (list) => list.filter((e) => e.check === "extract").map((e) => e.field).sort();
const dropLine = (field) => (doc) => doc.split("\n").filter((l) => !l.trimStart().startsWith(`${field}:`)).join("\n");
/** An extract case whose built row is changed after `case-grammar` built it (a field it would refuse to build). */
const bent = (after, quoted) => withExtract({ rows: [extractRow({}, (r) => { after(r); return r; })], ...(quoted ? { quoted } : {}) });

test("R29 R8: a good extract passes: every finding recreates, the load-bearing chain reaching it with included: false asks for no file of the segment or the source", async () => {
  const a = await run(withExtract());
  assert.deepEqual(a.findings.map((f) => [f.finding, f.result]), [[A, "recreated"], [C, "recreated"], [B, "recreated"]]);
  assert.equal(a.integrity.intact, true);
  assert.equal(a.integrity.files.some((f) => f.path.includes(EXT) || f.sha256 === REDUCED_SHA), false, "no file of the extract travels");
  assert.deepEqual(a.integrity.documents.wanted, []);
});

test("R29 (a): a changed byte in the extract's row, and a moved cell, differ at text_sha; a row with another number of cells than its header differs at extract_row; each only for the finding whose chain reaches it", async () => {
  const changed = byId(await run(bent((r) => { r.extract.row = ["L-17", "Pine Cp"]; })));
  assert.deepEqual(fieldsOf(changed[A].differs), ["text_sha"]);
  assert.ok(changed[A].differs.some((e) => e.check === "extract" && e.ref === EXT && like("case-checker.check.extract_field_differs", { ref: EXT, field: "text_sha" }).test(e.detail)));
  assert.equal(changed[A].result, "did_not_recreate");
  assert.equal(changed[C].result, "recreated", "a finding whose chain does not reach the extract is not asked");
  const moved = byId(await run(bent((r) => { r.extract.row = ["Pine Co", "L-17"]; })));
  assert.deepEqual(fieldsOf(moved[A].differs), ["text_sha"]);
  const extra = byId(await run(bent((r) => { r.extract.row = ["L-17", "Pine Co", "1 Mill Lane"]; })));
  assert.deepEqual(fieldsOf(extra[A].differs), ["extract_row", "text_sha"]);
});

test("R29 (b): a passage relied on from the extract is found in its cells and its content id recomputes from the reduced segment's sha; a passage not in the extract differs", async () => {
  const good = byId(await run(withExtract({ quoted: "L-17" })));
  assert.equal(good[A].result, "recreated");
  const gone = byId(await run(withExtract({ quoted: "Oak Ltd" })));
  assert.ok(gone[A].differs.some((e) => e.check === "passage" && like("case-checker.check.passage_not_in_extract").test(e.detail)));
  assert.equal(gone[A].result, "did_not_recreate");
});

test("R29 (c): a short digest, a date that is none and a src_row of 0 each differ by name", async () => {
  for (const [field, after] of [
    ["extract_reduced_sha256", (r) => { r.extract.reduced_sha256 = REDUCED_SHA.slice(1); }],
    ["extract_original_sha256", (r) => { r.extract.original_sha256 = "abc"; }],
    ["extract_source_date", (r) => { r.extract.source_date = "last Tuesday"; }],
    ["extract_imported_at", (r) => { r.extract.imported_at = "2026-02-30"; }],
    ["extract_src_row", (r) => { r.extract.src_row = 0; }]]) {
    const f = byId(await run(bent(after)));
    assert.deepEqual(fieldsOf(f[A].differs), [field], field);
    assert.equal(f[A].result, "did_not_recreate", field);
  }
});

test("R29 (d): a removed label differs at extract_label_key; R29: an extract whose header is not stated is missing, not differing", async () => {
  const unlabelled = byId(await run(withExtract({ more: { docEdit: dropLine("extract_label_key") } })));
  assert.deepEqual(fieldsOf(unlabelled[A].differs), ["extract_label_key"]);
  const headless = byId(await run(withExtract({ more: { docEdit: dropLine("extract_header") } })));
  assert.ok(headless[A].missing.some((e) => e.field === "extract_header" && like("case-checker.check.extract_not_carried", { ref: EXT, field: "extract_header" }).test(e.detail)));
  assert.ok(headless[A].missing.some((e) => e.check === "passage" && like("case-checker.check.passage_extract_not_carried").test(e.detail)));
  assert.deepEqual(fieldsOf(headless[A].differs), []);
  assert.equal(headless[A].result, "recreated_in_part");
});

test("R29 (control): a changed byte in an unrelated material still fails as before, and the extract adds nothing", async () => {
  const P = CG.caseFilePath;
  const f = byId(await run(withExtract({ more: { edit: (b) => { const x = Buffer.from(b.get(P("document", MINUTES))); x[3] ^= 1; b.set(P("document", MINUTES), x); } } })));
  assert.ok(f[A].differs.some((e) => e.check === "integrity" && e.about === P("document", MINUTES)));
  assert.equal(f[A].result, "did_not_recreate");
  assert.deepEqual(fieldsOf(f[A].differs), []);
});

test("R30: a limited register's extract carrying its notice passes; the notice removed differs naming it; restored it passes. Control: a limit-free extract needs none", async () => {
  const limited = withExtract({ rows: [extractRow({ use_limit: USE_LIMIT })] });
  assert.equal(byId(await run(limited))[A].result, "recreated");
  const removed = byId(await run({ ...limited, docEdit: dropLine("extract_use_limit_text_key") }));
  assert.deepEqual(fieldsOf(removed[A].differs), ["extract_use_limit_text_key"]);
  assert.ok(removed[A].differs.some((e) => like("case-checker.check.extract_notice_absent", { ref: EXT, field: "extract_use_limit_text_key" }).test(e.detail)));
  assert.equal(byId(await run(limited))[A].result, "recreated", "restored, it passes");
  assert.equal(byId(await run(withExtract()))[A].result, "recreated", "a limit-free extract needs no notice");
});

const two = () => withExtract({ rows: [extractRow(), extractRow({ ref: EXT2, title: "Licence L-18", src_row: 18, row: ["L-18", "Oak Ltd"] })] });

test("R31: a case with two extracts lists two unverifiable entries, the row's presence in its source file, by ref; a case with none has no unverifiable key", async () => {
  const a = await run(two());
  assert.deepEqual(a.unverifiable.map((u) => [u.ref, u.what]), [[EXT, "row_in_source_file"], [EXT2, "row_in_source_file"]]);
  for (const u of a.unverifiable) assert.equal(u.why, W("case-checker.check.unverifiable_row"));
  assert.deepEqual(a.findings.map((f) => f.result), ["recreated", "recreated", "recreated"], "two rows of one segment's sha, distinct refs");
  assert.equal(Object.hasOwn(await run({}), "unverifiable"), false);
});

test("R32 R13: the program built from this code, run offline on a case with extracts, prints each finding's result, then each extract's unverifiable line, then the same answer checkCaseFile gives, R29 and R30's entries among it; its SHA-256 is the rebuild's. Control: a case with no extract prints no such line", async () => {
  const built = await buildProgram();
  assert.equal(CC.caseCheckerProgramText().sha256, built.sha256, "program.mjs is the rebuild");
  const dir = mkdtempSync(join(tmpdir(), "case-checker-t53-"));
  try {
    writeFileSync(join(dir, "case-checker.mjs"), built.text);
    const runIt = (file) => execFileSync(process.execPath, ["case-checker.mjs", file], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH } });
    const cases = [["two.zip", two()], ["bad.zip", { ...withExtract({ rows: [extractRow({ use_limit: USE_LIMIT })] }), docEdit: dropLine("extract_use_limit_text_key") }], ["none.zip", {}]];
    for (const [file, opts] of cases) {
      const cf = caseFile(opts);
      writeFileSync(join(dir, file), cf.parts[0]);
      const out = runIt(file);
      const expected = await CC.checkCaseFile({ parts: cf.parts });
      const lines = out.split("\n");
      expected.findings.forEach((f, i) => assert.equal(lines[i], `${f.finding}: ${CC.RESULT_WORDS[f.result]}`, file));
      const after = expected.unverifiable ?? [];
      after.forEach((u, i) => assert.equal(lines[expected.findings.length + i], `${u.ref}: ${u.why}`, file));
      assert.equal(lines[expected.findings.length + after.length], "", `${file}: nothing else between the findings and the statement`);
      assert.equal(canonicalJson(JSON.parse(out.slice(out.indexOf("{")))), canonicalJson(expected), file);
    }
    const bad = JSON.parse(runIt("bad.zip").replace(/^[^{]*/s, ""));
    assert.deepEqual(fieldsOf(bad.findings.find((f) => f.finding === A).differs), ["extract_use_limit_text_key"]);
    assert.equal(Object.hasOwn(JSON.parse(runIt("none.zip").replace(/^[^{]*/s, "")), "unverifiable"), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R14 R15: the specification of every case-file format names bio-case-document/10, every extract field, its presentability and the unverifiable row", () => {
  for (const v of CC.CASE_FILE_SPEC_VERSIONS) {
    const spec = CC.CASE_FILE_SPECS[v];
    for (const w of ["bio-case-document/10", ...CG.MATERIAL_EXTRACT_FIELDS, ...CG.MATERIAL_EXTRACT_USE_LIMIT_FIELDS, CG.EXTRACT_LABEL_KEY,
                     "unverifiable", "row_in_source_file"]) assert.ok(spec.includes(`\`${w}\``), `${v}: ${w}`);
    assert.match(spec, /A row stating an extract \(section 4\) is presentable with `included: false`/, v);
  }
});
