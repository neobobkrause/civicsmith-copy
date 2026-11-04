/* case-grammar at its interface, T53 (R35–R39; DEC-461, DEC-464; N1259; K4403 (3)(4)): the `/10` format, the passages
   published without a grade, the typed passages with who typed and who checked them as of signing, and a cited register
   row as a labelled extract carrying its register's limit. Each clause with its control (K874). The `/8` and `/9`
   editions are pinned to digests recorded from the code before R35 (`./complete-v8-v9-golden.json`, never regenerated). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha } from "./helpers.mjs";

const fmOf = (text) => { const p = parseFrontmatter(text); assert.deepEqual(p.findings, [], "the grammar reads every line"); return p.data; };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const V8 = "bio-case-document/8";
const V9 = "bio-case-document/9";
const V10 = "bio-case-document/10";

/* the stored /7 case file (never regenerated) and its case document, its format line set to `format`, `extra` front-matter
   lines added before the closing `---` */
const V7 = JSON.parse(readFileSync(new URL("./complete-v7-golden.json", import.meta.url), "utf8"));
const PINNED = JSON.parse(readFileSync(new URL("./complete-v8-v9-golden.json", import.meta.url), "utf8"));
const caseFileAs = (format, extra = []) => ({ ...V7.input, files: V7.input.files.map((f) => {
  if (f.path !== "case.md") return f;
  const lines = f.content.replace(/\nformat: bio-case-document\/7\n/, `\nformat: ${format}\n`).split("\n");
  const end = lines.indexOf("---", 1);
  return { ...f, content: [...lines.slice(0, end), ...extra, ...lines.slice(end)].join("\n") };
}) });
const render = (format, extra) => CG.completeEditionOf(caseFileAs(format, extra));
/* the case document's own SHA-256, which the identifying notice prints */
const docShaOf = (format, extra) => sha256(caseFileAs(format, extra).files.find((f) => f.path === "case.md").content);
/* a render with `extra` lines, its case document's digest put back to the document's without them: the bytes the block adds */
const besides = (format, extra) => render(format, extra).split(docShaOf(format, extra)).join(docShaOf(format));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/* the one passage the stored case relies on */
const LEASE = "INQ-2026-0001-lease";
const PASSAGE = { finding: LEASE, ord: 1, content_id: "0886b051075687c18a9ae5075383feb8400fbe4328c6e4bd45b77b30f1e73b54" };
const W = CG.PASSAGE_WORDS_V10;

/* ===== R35 ===== */

test("R35 the format in force is /10 and caseDocumentFormatFor answers it always; /9 and every earlier format stay accepted; every predicate holds for /10 as for /9", () => {
  assert.equal(CG.CASE_DOCUMENT_FORMAT, V10);
  assert.equal(CG.caseDocumentFormatFor([]), V10);
  assert.equal(CG.caseDocumentFormatFor([{ ref: "R", by_kind: "member", sha: sha("a capture") }]), V10, "with a sha row");
  for (const odd of [undefined, null, "x", [null], [{ get sha() { throw new Error("boom"); } }]]) assert.equal(CG.caseDocumentFormatFor(odd), V10);
  for (const v of [9, 8, 7, 6, 5, 4, 3, 2, 1]) assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED.includes(`bio-case-document/${v}`), true, String(v));
  assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED[0], V10);
  for (const p of [CG.caseDocumentStatesMemberBlocks, CG.caseDocumentRequiresDisclosures, CG.caseDocumentRequiresV4Disclosures,
                   CG.caseDocumentRequiresTensionSection, CG.caseDocumentRequiresMaterials])
    assert.equal(p({ format: V10 }), p({ format: V9 }), p.name);
  assert.equal(CG.caseWordsOf({ format: V10 }), "team");
  assert.equal(CG.editionProductOf({ format: V10 }), "Civicsmith");
});

test("R35 caseDocumentStatesUngradedAndTyped is true for /10 and later, false for /9 and earlier and for anything else; never throws", () => {
  const f = (v) => ({ format: `bio-case-document/${v}` });
  assert.deepEqual([10, 11, 12].map((v) => CG.caseDocumentStatesUngradedAndTyped(f(v))), [true, true, true]);
  assert.deepEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((v) => CG.caseDocumentStatesUngradedAndTyped(f(v))), Array(10).fill(false));
  for (const odd of [null, undefined, 7, "x", {}, [], { format: null }, { format: "bio-case-document/10 " }, { format: "Bio-case-document/10" },
                     { format: "bio-case-document/010" }, { format: 10 }, { get format() { throw new Error("boom"); } }])
    assert.equal(CG.caseDocumentStatesUngradedAndTyped(odd), false);
});

test("R35 control: a stored /8 and /9 case file re-render byte for byte to the digests recorded before /10", () => {
  assert.equal(sha256(render(V8)), PINNED.v8.sha256);
  assert.equal(sha256(render(V9)), PINNED.v9.sha256);
  assert.equal(sha256(CG.completeEditionOf(V7.input)), V7.sha256, "and the /7 golden");
});

/* ===== R36 ===== */

const UNGRADED = [{ finding: "INQ-A", ord: 1, content_id: sha("one") }, { finding: "INQ-A", ord: 3, content_id: sha("two") }];

test("R36 a round trip of two rows; a /10 document without the block states none; the writer writes nothing for none", () => {
  const lines = CG.ungradedPassagesLines(UNGRADED);
  assert.equal(lines[0], "ungraded_passages:");
  assert.deepEqual(CG.ungradedPassagesOf(fmOf(doc(V10, lines))), { state: "stated", rows: UNGRADED, detail: null });
  assert.deepEqual(CG.ungradedPassagesOf(fmOf(doc(V10))), { state: "stated", rows: [], detail: null });
  assert.deepEqual(CG.ungradedPassagesLines([]), []);
  assert.deepEqual(CG.ungradedPassagesLines("x"), []);
  assert.deepEqual([...CG.UNGRADED_PASSAGE_FIELDS], ["finding", "ord", "content_id"]);
});

test("R36 a /9 document carrying the key predates (never read); a scalar value is unreadable; the two sentences are exported", () => {
  const lines = CG.ungradedPassagesLines(UNGRADED);
  for (const format of [V9, V8, "bio-case-document/7", "bio-case-document/5", null])
    assert.deepEqual(CG.ungradedPassagesOf(fmOf(doc(format, lines))), { state: "predates", rows: null, detail: CG.UNGRADED_PREDATE_SENTENCE }, String(format));
  assert.deepEqual(CG.ungradedPassagesOf(fmOf(doc(V10, ["ungraded_passages: 3"]))),
                   { state: "unreadable", rows: null, detail: CG.UNGRADED_UNREADABLE_SENTENCE });
  assert.match(CG.UNGRADED_PREDATE_SENTENCE, /predates the statement of passages published without a grade, so it states none; that is not a statement that there were none$/);
  assert.match(CG.UNGRADED_UNREADABLE_SENTENCE, /declares a format that states .*, but carries no readable block, so what it stated is undetermined$/);
  for (const odd of [null, 7, { format: V10, get ungraded_passages() { throw new Error("boom"); } }])
    assert.doesNotThrow(() => CG.ungradedPassagesOf(odd));
});

test("R36 ungradedPassagesFrom lists, roster then ord order, each relied-on passage whose grading-facts row shows no grade", () => {
  const facts = [{ finding: "B", ord: 1, grade: null }, { finding: "A", ord: 2, grade: null }, { finding: "A", ord: 1, grade: "B" },
                 { finding: "A", ord: 3 }];
  const passages = [{ finding: "A", ord: 3, content_id: "a3" }, { finding: "A", ord: 1, content_id: "a1" }, { finding: "B", ord: 1, content_id: "b1" },
                    { finding: "A", ord: 2, content_id: "a2" }, { finding: "A", ord: 4, content_id: "a4-no-facts" }];
  assert.deepEqual(CG.ungradedPassagesFrom(["B", "A"], facts, passages), [
    { finding: "B", ord: 1, content_id: "b1" }, { finding: "A", ord: 2, content_id: "a2" }, { finding: "A", ord: 3, content_id: "a3" }]);
  /* control: all graded, none listed, nothing written */
  assert.deepEqual(CG.ungradedPassagesFrom(["A"], [{ finding: "A", ord: 1, grade: "C" }], [{ finding: "A", ord: 1, content_id: "x" }]), []);
  assert.deepEqual(CG.ungradedPassagesFrom(null, "x", 7), []);
});

test("R36 R14 a /10 edition with a listed passage prints the head once before the claims and the sentence beside the passage; with none listed its bytes equal the render without the block", () => {
  const html = render(V10, CG.ungradedPassagesLines([PASSAGE]));
  assert.equal(html.split(esc(W["case.ungraded.head"])).length - 1, 1, "the head once");
  assert.ok(html.indexOf(esc(W["case.ungraded.head"])) < html.indexOf("<h2>1. "), "before item 1");
  const findings = html.slice(html.indexOf("The findings"), html.indexOf("<h2>", html.indexOf("The findings")));
  assert.ok(findings.includes(esc(W["case.ungraded.passage"])), "beside the passage, in item 2");
  assert.equal(html.split(esc(W["case.ungraded.passage"])).length - 1, 1);
  /* control: all graded (no block) renders as with the block removed; a block naming no relied-on passage adds nothing beside one */
  const bare = render(V10);
  assert.equal(bare.includes(esc(W["case.ungraded.passage"])) || bare.includes(esc(W["case.ungraded.head"])), false);
  assert.equal(render(V10, CG.ungradedPassagesLines([])), bare);
  /* control: a /9 case file carrying the block re-renders byte for byte */
  assert.equal(sha256(besides(V9, CG.ungradedPassagesLines([PASSAGE]))), PINNED.v9.sha256, "the block adds nothing but its own lines' digest");
});

/* ===== R37 ===== */

const A_ID = "member:alder-7f3a";
const B_ID = "member:birch-91c2";
const TYPED = { ...PASSAGE, typed_at: "2026-10-02T10:00:00Z", typist_level: "group", typist_shown: "Alder Quill", member: A_ID, handle: "alder",
  checkers: [{ level: "name", shown: "Birch Ames", at: "2026-10-03T09:00:00Z", member: B_ID, key: "ssh-ed25519 AAAAB" }] };

test("R37 a passage typed by A (group) and checked by B (name): one row, read back, no member id, handle or key written", () => {
  const lines = CG.typedPassagesLines([TYPED]);
  const text = lines.join("\n");
  for (const secret of [A_ID, B_ID, "alder", "Alder Quill", "ssh-ed25519"]) assert.equal(text.includes(secret), false, secret);
  assert.deepEqual(CG.typedPassagesOf(fmOf(doc(V10, lines))), { state: "stated", detail: null, rows: [{ ...PASSAGE, checked: true,
    typed_at: "2026-10-02T10:00:00Z", typist_level: "group", typist_shown: null,
    checkers: [{ level: "name", shown: "Birch Ames", at: "2026-10-03T09:00:00Z" }] }] });
  assert.deepEqual([...CG.TYPED_PASSAGE_FIELDS], ["finding", "ord", "content_id", "checked", "typed_at", "typist_level", "typist_shown", "checkers"]);
});

test("R37 checkers are written in time order; shown only at cover and name; checked true exactly when a checker is listed; a level outside R2's is null", () => {
  const row = { ...PASSAGE, typed_at: "2026-10-01T00:00:00Z", typist_level: "cover", typist_shown: "Heron", checked: true, checkers: [
    { level: "name", shown: "Late", at: "2026-10-05T00:00:00Z" }, { level: "project", shown: "Hidden", at: "2026-10-02T00:00:00Z" },
    { level: "boss", shown: "Odd", at: "2026-10-03T00:00:00Z" }] };
  const back = CG.typedPassagesOf(fmOf(doc(V10, CG.typedPassagesLines([row, { ...PASSAGE, ord: 2, typist_level: "name", typist_shown: "Ivy", checked: true }])))).rows;
  assert.equal(back[0].typist_shown, "Heron");
  assert.deepEqual(back[0].checkers, [{ level: "project", shown: null, at: "2026-10-02T00:00:00Z" },
    { level: null, shown: null, at: "2026-10-03T00:00:00Z" }, { level: "name", shown: "Late", at: "2026-10-05T00:00:00Z" }]);
  assert.equal(back[1].checked, false, "handed checked true with no checker: not checked");
  assert.equal(back[1].typist_shown, "Ivy");
});

test("R37 the three states: a /9 block is not read; a scalar is unreadable; a /10 document without it states none; writes nothing for none", () => {
  const lines = CG.typedPassagesLines([TYPED]);
  assert.deepEqual(CG.typedPassagesOf(fmOf(doc(V9, lines))), { state: "predates", rows: null, detail: CG.TYPED_PREDATE_SENTENCE });
  assert.deepEqual(CG.typedPassagesOf(fmOf(doc(V10, ['typed_passages: "x"']))), { state: "unreadable", rows: null, detail: CG.TYPED_UNREADABLE_SENTENCE });
  assert.deepEqual(CG.typedPassagesOf(fmOf(doc(V10))), { state: "stated", rows: [], detail: null });
  assert.deepEqual(CG.typedPassagesLines([]), []);
  assert.notEqual(CG.TYPED_PREDATE_SENTENCE, CG.UNGRADED_PREDATE_SENTENCE);
  assert.notEqual(CG.TYPED_UNREADABLE_SENTENCE, CG.UNGRADED_UNREADABLE_SENTENCE);
});

test("R37 R14 the render labels a typed passage as typed words, names A as a member of the team and B by name, no id; the same bytes twice", () => {
  const html = render(V10, CG.typedPassagesLines([TYPED]));
  const findings = html.slice(html.indexOf("The findings"), html.indexOf("<h2>", html.indexOf("The findings")));
  assert.ok(findings.includes(esc(W["case.typed.label"])), "labelled as typed words");
  assert.ok(findings.includes(esc(W["case.typed.checked"]("a member of the team", "Birch Ames"))));
  assert.equal(W["case.typed.credit.group"](), "a member of the team");
  for (const secret of [A_ID, B_ID, "Alder Quill"]) assert.equal(html.includes(secret), false, secret);
  assert.equal(/Civicsmith read|original/i.test(W["case.typed.label"]), false, "the label never says the product read it nor calls it the original");
  assert.equal(render(V10, CG.typedPassagesLines([TYPED])), html, "the same bytes twice");
  /* unchecked: the unchecked sentence */
  const unchecked = render(V10, CG.typedPassagesLines([{ ...TYPED, checkers: [] }]));
  assert.ok(unchecked.includes(esc(W["case.typed.unchecked"]("a member of the team"))));
  assert.equal(unchecked.includes(esc(W["case.typed.checked"]("a member of the team", "Birch Ames"))), false);
});

test("R37 controls: no typed passage, no block, render unchanged; a block in a /9 document is not read", () => {
  assert.equal(CG.typedPassagesLines([]).length, 0);
  assert.equal(render(V10, CG.typedPassagesLines([])), render(V10));
  assert.equal(render(V10).includes(esc(W["case.typed.label"])), false);
  assert.equal(sha256(besides(V9, CG.typedPassagesLines([TYPED]))), PINNED.v9.sha256, "the block adds nothing but its own lines' digest");
});

/* ===== R38, R39 ===== */

const REDUCED = sha("the reduced segment");
const EXTRACT = { ref: sha("content of the cited row"), origin: "https://www.fec.gov/data/", rests_under: "load_bearing", title: "Receipts",
  register: "fec-receipts", file: "indiv24.zip", reduced_sha256: REDUCED, original_sha256: sha("the original piece"),
  original_covers: "contributions received in the 2023-2024 cycle", source_date: "2026-09-01", imported_at: "2026-10-12T14:00:00Z",
  src_row: 1442, kept_columns: ["NAME", "CITY", "TRANSACTION_AMT"], roles: ["name", "place", "amount"], dropped_columns: ["EMPLOYER"],
  header: ["NAME", "CITY", "TRANSACTION_AMT"], row: ["SMITH, JO \"JJ\"", "O'Fallon, IL", "250"] };
const LIMIT = { key: "fec-sale-use", citation: "52 U.S.C. 30111(a)(4)", text_key: "register.use_limit.fec" };
const rowOf = (args) => { const r = CG.registerExtractRow(args); assert.equal(r.ok, true, JSON.stringify(r)); return r.row; };

test("R38 a built row round-trips through materialsOf: kind document, sha the reduced segment's, text_sha the extract text's, archived_copy null, included false", () => {
  const row = rowOf({ ...EXTRACT, included: true, archived_copy: "https://archive.example/x" });
  assert.equal(row.kind, "document");
  assert.equal(row.sha, REDUCED);
  assert.equal(row.text_sha, sha(CG.extractTextOf(EXTRACT.header, EXTRACT.row)));
  const back = CG.materialsOf(fmOf(doc(V10, CG.materialsLines([row])))).materials[0];
  assert.deepEqual(back, { ref: EXTRACT.ref, kind: "document", sha: REDUCED, text_sha: row.text_sha, origin: EXTRACT.origin, archived_copy: null,
    included: false, rests_under: "load_bearing", title: "Receipts", obscured: null, extract: {
      register: "fec-receipts", file: "indiv24.zip", reduced_sha256: REDUCED, original_sha256: EXTRACT.original_sha256,
      original_covers: EXTRACT.original_covers, source_date: "2026-09-01", imported_at: "2026-10-12T14:00:00Z", src_row: 1442,
      kept_columns: EXTRACT.kept_columns, roles: EXTRACT.roles, dropped_columns: ["EMPLOYER"], header: EXTRACT.header, row: EXTRACT.row,
      label_key: "register.extract", use_limit: null } });
  /* the fields are flat, after title, in BOB's names */
  const lines = CG.materialsLines([row]);
  const names = lines.slice(1).map((l) => l.replace(/^\s+-?\s*/, "").split(":")[0]);
  assert.deepEqual(names, [...CG.MATERIAL_FIELDS, "title", ...CG.MATERIAL_EXTRACT_FIELDS]);
  assert.equal(CG.EXTRACT_LABEL_KEY, "register.extract");
});

test("R38 each field absent, a short digest, a non-date source_date and a src_row of 0 are refused EXTRACT_INVALID naming the field", () => {
  for (const k of ["register", "file", "reduced_sha256", "original_sha256", "original_covers", "source_date", "imported_at", "src_row",
                   "kept_columns", "roles", "dropped_columns", "header", "row"]) {
    const { [k]: _gone, ...rest } = EXTRACT;
    assert.deepEqual(CG.registerExtractRow(rest), { ok: false, code: "EXTRACT_INVALID", field: `extract_${k}` }, k);
  }
  assert.deepEqual(CG.registerExtractRow({ ...EXTRACT, ref: undefined }), { ok: false, code: "EXTRACT_INVALID", field: "ref" });
  assert.equal(CG.registerExtractRow({ ...EXTRACT, reduced_sha256: "abc123" }).field, "extract_reduced_sha256");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, original_sha256: REDUCED.slice(1) }).field, "extract_original_sha256");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, source_date: "last Tuesday" }).field, "extract_source_date");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, source_date: "2026-02-30" }).field, "extract_source_date");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, src_row: 0 }).field, "extract_src_row");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, row: ["one"] }).field, "extract_row", "a row's cells are the kept columns'");
  assert.equal(CG.registerExtractRow({ ...EXTRACT, use_limit: { key: "k", citation: "" , text_key: "t" } }).field, "extract_use_limit_citation");
  for (const odd of [null, undefined, 7, "x", [], { get ref() { throw new Error("boom"); } }])
    assert.equal(CG.registerExtractRow(odd).code, "EXTRACT_INVALID");
});

test("R38 two rows cited from one segment are two rows of one sha and distinct refs; a document with an extract is /10", () => {
  const a = rowOf(EXTRACT);
  const b = rowOf({ ...EXTRACT, ref: sha("content of another row"), src_row: 1443, row: ["DOE, AL", "Peoria, IL", "40"] });
  assert.equal(a.sha, b.sha);
  assert.notEqual(a.ref, b.ref);
  assert.notEqual(a.text_sha, b.text_sha);
  const read = CG.materialsOf(fmOf(doc(V10, CG.materialsLines([a, b])))).materials;
  assert.deepEqual(read.map((r) => [r.ref, r.sha]), [[a.ref, REDUCED], [b.ref, REDUCED]]);
  assert.equal(CG.caseDocumentFormatFor([]), V10, "the document states its extracts at /10");
});

test("R38 controls: a document row and an obscured row are written and read as before; the existing goldens are byte-equal", () => {
  const plain = { ref: "INFO-2026-0001-minutes", kind: "document", sha: sha("m"), text_sha: sha("t"), origin: "o", archived_copy: "a",
    included: true, rests_under: "supporting" };
  const obscured = { ...plain, ref: "INFO-2026-0004-photo", obscured: { copy: sha("copy"), label: "L" } };
  const lines = CG.materialsLines([plain, obscured]);
  assert.equal(lines.some((l) => l.includes("extract_")), false);
  const back = CG.materialsOf(fmOf(doc(V10, lines))).materials;
  assert.equal(back.some((r) => "extract" in r), false, "read exactly as before: no extract key");
  assert.equal(back[0].included, true);
  assert.equal(back[1].obscured.copy, sha("copy"));
  /* an obscured row handed an extract is still an obscured row: the extract is not written on it */
  assert.equal(CG.materialsLines([{ ...obscured, extract: rowOf(EXTRACT).extract }]).some((l) => l.includes("extract_")), false);
  assert.equal(sha256(CG.completeEditionOf(V7.input)), V7.sha256);
});

test("R39 a limited register's extract carries its limit, read back as extract.use_limit; a limit-free one holds none; removing it reads none", () => {
  const limited = rowOf({ ...EXTRACT, use_limit: LIMIT });
  const lines = CG.materialsLines([limited]);
  assert.deepEqual(lines.slice(-3).map((l) => l.trim().split(":")[0]), [...CG.MATERIAL_EXTRACT_USE_LIMIT_FIELDS]);
  assert.deepEqual(CG.materialsOf(fmOf(doc(V10, lines))).materials[0].extract.use_limit, LIMIT);
  assert.equal(CG.materialsOf(fmOf(doc(V10, CG.materialsLines([rowOf(EXTRACT)])))).materials[0].extract.use_limit, null);
  /* control: the same extract with its limit removed reads no limit (what case-checker R30 refuses) */
  const removed = lines.filter((l) => !l.includes("extract_use_limit_"));
  const read = CG.materialsOf(fmOf(doc(V10, removed))).materials[0].extract;
  assert.equal(read.use_limit, null);
  assert.equal(read.register, "fec-receipts");
});
