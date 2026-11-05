/* case-checker R29-R32 (T53; N1259; K4403 (3)(4)): a register extract, checked against what the checker can see, and what
   it cannot. The extract's material row is `case-grammar`'s own (`registerExtractRow`, its R38, R39), never hand-built;
   a whole case file is driven through `checkCaseFile` and through the standalone program built from the same code. */
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
import { contentIdFor } from "../../../src/content/extent.mjs";
import { caseFile, A, MEMO } from "./fixture.mjs";
import { extractCase, extractRow, regPassage, regLeg, LIMIT, ORIGINAL, EXTENT, REG, REG2 } from "./extract-fixture.mjs";

const run = (opts) => CC.checkCaseFile({ parts: extractCase(opts).parts });
const of = (answer, id = A) => answer.findings.find((f) => f.finding === id);
const fields = (list) => list.filter((e) => e.field).map((e) => e.field);

test("R29: a good extract, carried in its row with included: false, recreates its finding; the passage is found in it and no source file is asked", async () => {
  const a = await run();
  assert.deepEqual(a.publication_checks.findings.filter((x) => x.severity === "error").map((x) => x.check), []);
  assert.deepEqual([of(a).result, of(a).missing, of(a).differs], ["recreated", [], []]);
  assert.ok(a.findings.every((f) => f.result === "recreated"), JSON.stringify(a.findings.map((f) => [f.finding, f.differs, f.missing])));
});

test("R29 (a): a changed cell (the extract no longer the text its row fingerprints) and a moved cell (header and row of different lengths) each differ by name", async () => {
  const changed = await run({ editDoc: (doc) => doc.replace("Lakeshore Holdings", "Lakeshore Holding5") });
  assert.equal(of(changed).result, "did_not_recreate");
  assert.ok(fields(of(changed).differs).includes("text_sha"), JSON.stringify(of(changed).differs));
  const moved = await run({ editDoc: (doc) => doc.replace(/(extract_row: ')\[([^\]]*)\]/, (_, k, cells) => `${k}[${cells},"x"]`) });
  assert.equal(of(moved).result, "did_not_recreate");
  assert.ok(fields(of(moved).differs).includes("extract_row"), JSON.stringify(of(moved).differs));
});

test("R29 (b): a passage whose quoted text is not in the extract differs; one whose content id does not recompute from the reduced segment's sha differs", async () => {
  const notThere = await run({ passage: regPassage({ quoted: "Someone Else 9999" }) });
  assert.equal(of(notThere).result, "did_not_recreate");
  assert.ok(of(notThere).differs.some((e) => e.check === "passage" && e.field === "extract_row"), JSON.stringify(of(notThere).differs));
  const otherId = await run({ passage: regPassage({ content_id: contentIdFor(ORIGINAL, EXTENT, null) }) });
  assert.equal(of(otherId).result, "did_not_recreate");
  assert.ok(of(otherId).differs.some((e) => e.check === "passage"));
});

test("R29 (c) (d): a short digest, a reduced digest not the row's, a non-date source date, a src_row of 0 and a removed label each differ, naming the field", async () => {
  const cases = [
    ["extract_original_sha256", (doc) => doc.replace(`"${ORIGINAL}"`, `"${ORIGINAL.slice(0, 40)}"`)],
    ["extract_reduced_sha256", (doc) => doc.replace(/(extract_reduced_sha256: '")[0-9a-f]{64}/, `$1${ORIGINAL}`)],
    ["extract_source_date", (doc) => doc.replace('"2026-08-01"', '"last summer"')],
    ["extract_src_row", (doc) => doc.replace("extract_src_row: 17", "extract_src_row: 0")],
    ["extract_label_key", (doc) => doc.replace(/\n\s+extract_label_key: [^\n]*/, "")],
  ];
  for (const [field, editDoc] of cases) {
    const a = await run({ editDoc });
    assert.equal(of(a).result, "did_not_recreate", field);
    assert.ok(fields(of(a).differs).includes(field), `${field}: ${JSON.stringify(of(a).differs)}`);
  }
});

test("R29: an extract not carried in its row is missing, not differing", async () => {
  const a = await run({ editDoc: (doc) => doc.replace(/\n\s+extract_header: [^\n]*/, "").replace(/\n\s+extract_row: [^\n]*/, "") });
  assert.ok(of(a).missing.some((e) => e.field === "extract_header"), JSON.stringify(of(a).missing));
  assert.ok(!fields(of(a).differs).some((f) => f.startsWith("extract_") && f !== "extract_row"), JSON.stringify(of(a).differs));
});

test("R29 control: a changed byte in an unrelated material still fails as before, and the extract adds nothing to it", async () => {
  const a = CC.checkCaseFile({ parts: extractCase().parts });
  const tampered = await CC.checkCaseFile({ parts: caseFile({ edit: (b) => b.set(CG.caseFilePath("document", MEMO), Buffer.from("%PDF-1.7 another memo")) }).parts });
  assert.equal(of(tampered).result, "did_not_recreate");
  assert.equal(of(await a).result, "recreated");
});

test("R30: a limited register's extract whose notice is removed differs, naming it; restored, it passes; a limit-free extract needs none", async () => {
  const limited = await run({ rows: [extractRow({ use_limit: LIMIT })] });
  assert.equal(of(limited).result, "recreated", JSON.stringify(of(limited).differs));
  const removed = await run({ rows: [extractRow({ use_limit: LIMIT })], editDoc: (doc) => doc.replace(/\n\s+extract_use_limit_text_key: [^\n]*/, "") });
  assert.equal(of(removed).result, "did_not_recreate");
  assert.ok(fields(of(removed).differs).includes("extract_use_limit_text_key"), JSON.stringify(of(removed).differs));
  const free = await run();
  assert.equal(of(free).result, "recreated");
});

test("R31: a case with two extracts lists two unverifiable entries; a case with none has no unverifiable key and the other answers are unchanged", async () => {
  const two = await run({ rows: [extractRow(), extractRow({ ref: REG2 })], legs: [regLeg(), regLeg(REG2)] });
  assert.deepEqual(two.unverifiable.map((u) => [u.ref, u.what]), [[REG, "row_in_source_file"], [REG2, "row_in_source_file"]]);
  for (const u of two.unverifiable) assert.ok(typeof u.why === "string" && u.why.length > 0);
  const none = await CC.checkCaseFile({ parts: caseFile().parts });
  assert.equal(Object.hasOwn(none, "unverifiable"), false);
  assert.equal(of(none).result, "recreated");
});

test("R32: the standalone program, built from the same code with these checks, prints R29-R31's results after the findings, byte-identical to checkCaseFile; the same build gives the same bytes", async () => {
  const one = await buildProgram();
  const two = await buildProgram();
  assert.equal(one.sha256, two.sha256);
  const dir = mkdtempSync(join(tmpdir(), "case-checker-extract-"));
  try {
    writeFileSync(join(dir, "case-checker.mjs"), one.text);
    const runProg = (name) => execFileSync(process.execPath, ["case-checker.mjs", name], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH } });
    const good = extractCase({ rows: [extractRow({ use_limit: LIMIT })] });
    const bad = extractCase({ rows: [extractRow({ use_limit: LIMIT })], editDoc: (doc) => doc.replace(/\n\s+extract_use_limit_text_key: [^\n]*/, "") });
    for (const [name, cf] of [["good.zip", good], ["bad.zip", bad]]) {
      writeFileSync(join(dir, name), cf.parts[0]);
      const out = runProg(name);
      const expected = await CC.checkCaseFile({ parts: cf.parts });
      const lines = out.split("\n");
      expected.findings.forEach((f, i) => assert.equal(lines[i], `${f.finding}: ${CC.RESULT_WORDS[f.result]}`));
      assert.equal(lines[expected.findings.length], `${REG}: ${expected.unverifiable[0].why}`);
      assert.equal(canonicalJson(JSON.parse(out.slice(out.indexOf("{")))), canonicalJson(expected));
    }
    /* control: a case with no extract prints no unverifiable line, and its answer carries no such key */
    writeFileSync(join(dir, "plain.zip"), caseFile().parts[0]);
    const plain = runProg("plain.zip");
    const expected = await CC.checkCaseFile({ parts: caseFile().parts });
    assert.equal(plain.split("\n")[expected.findings.length], "");
    assert.equal(canonicalJson(JSON.parse(plain.slice(plain.indexOf("{")))), canonicalJson(expected));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R29 (R14, R15): the specification served by casefilespec names bio-case-document/10 and each of the extract's fields", () => {
  const spec = CC.caseFileSpec(CC.CASE_FILE_SPEC_VERSIONS.at(-1));
  assert.equal(spec.held, true);
  assert.ok(spec.text.includes("`bio-case-document/10`"));
  for (const f of [...CG.MATERIAL_EXTRACT_FIELDS, ...CG.MATERIAL_EXTRACT_USE_LIMIT_FIELDS]) assert.ok(spec.text.includes(`\`${f}\``), f);
  assert.ok(spec.text.includes("`unverifiable`"));
});

/* Provider notice case-catalogue:224 (its R7): C-41.18 joins a `/10` document's passages to its grading-facts rows by
   `(finding, ord)`; here the register row's leg holds no grade, so the passage must be listed under `ungraded_passages:`. */
test("notice case-catalogue:224 (R7, R29): a /10 case whose register passage's leg holds no grade recreates when the passage is listed as ungraded, and answers C-41.18, a differs entry for the case, when it is not", async () => {
  const ungradedLeg = { ...regLeg(), grade: null, grade_axis: null, grade_source: "ungraded" };
  const p = regPassage();
  const listed = ["ungraded_passages:", `  - finding: '"${A}"'`, "    ord: 1", `    content_id: '"${p.content_id}"'`];
  const withRow = await run({ legs: [ungradedLeg], docLines: listed });
  assert.deepEqual(withRow.publication_checks.findings.filter((x) => x.severity === "error").map((x) => x.check), []);
  assert.equal(of(withRow).result, "recreated", JSON.stringify(of(withRow).differs));
  const without = await run({ legs: [ungradedLeg] });
  assert.deepEqual(without.publication_checks.findings.filter((x) => x.severity === "error").map((x) => x.check), ["C-41.18"]);
  assert.ok(without.findings.every((f) => f.result === "did_not_recreate" && f.differs.some((e) => e.check === "publication")));
});
