/* case-grammar at its interface, T37 (N757; DEC-180 (4); K2206): R12's `obscured` on a `document` row (a material
   carried as its copy: a photo's, or since T39 a member document's cleaned copy, N806, K2333), R13's `bio-case-file/3` with its `obscured` kind and that kind's three departures, a `/2` file
   read as written, and R14's complete edition listing the copy with its label, an edition stating no `obscured`
   rendering the bytes it rendered before T37 (`./complete-v7-pre-t37-golden.json`). Each clause has its own test and
   its negative controls (K874); the T39 tests, at the end, drive a member document's cleaned copy through all three. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha } from "./helpers.mjs";
import { manifestFor, caseFileFixture, editionInput, PHOTO, PHOTO_ROW, PHOTO_BYTES, PHOTO_COPY_BYTES, OBSCURED_LABEL,
         MINUTES, PLAIN_PHOTO, PLAIN_PHOTO_ROW, PLAIN_PHOTO_BYTES, PLAIN_PHOTO_COPY_BYTES, MEMBER_DOC, MEMBER_DOC_ROW,
         MEMBER_DOC_BYTES, MEMBER_DOC_COPY_BYTES, COPY_CLEANED_LABEL, memberDocRow, memberDocCopyBytes } from "./casefile-fixture.mjs";

const fmOf = (text) => parseFrontmatter(text).data;
const clean = (text) => assert.deepEqual(parseFrontmatter(text).findings, [], "the grammar reads every line");
const COPY = sha(PHOTO_COPY_BYTES);
const WHOLE = { ref: MINUTES, kind: "document", sha: sha("m"), text_sha: sha("t"), origin: "https://records.example/m.pdf",
                archived_copy: "https://archive.example/m", included: true, rests_under: "load_bearing" };

/* ===== R12 ===== */

test("R12 (T37) a document row stating obscured is written flat as obscured_copy and obscured_label, included false, the original's sha, text_sha, origin and archived_copy kept, and read back as obscured: {copy, label}", () => {
  assert.deepEqual([...CG.MATERIAL_OBSCURED_FIELDS], ["obscured_copy", "obscured_label"]);
  for (const format of [CG.CASE_DOCUMENT_FORMAT, CG.CASE_DOCUMENT_FORMAT_V6]) {
    /* handed included: true, it is written false: the original never travels */
    const lines = CG.materialsLines([{ ...PHOTO_ROW, included: true }]);
    assert.deepEqual(lines, ["materials:", `  - ref: "${PHOTO}"`, '    kind: "document"', `    sha: "${sha(PHOTO_BYTES)}"`,
      `    text_sha: "${sha("the photo's text")}"`, `    origin: "a member's capture"`, "    archived_copy: null",
      "    included: false", '    rests_under: "load_bearing"', `    obscured_copy: "${COPY}"`, `    obscured_label: "${OBSCURED_LABEL}"`]);
    const text = doc(format, [...lines, "material_attestations: []"]);
    clean(text);
    const fm = fmOf(text);
    assert.deepEqual(Object.keys(fm.materials[0]), [...CG.MATERIAL_FIELDS, ...CG.MATERIAL_OBSCURED_FIELDS], "one flat row");
    const [row] = CG.materialsOf(fm).materials;
    assert.deepEqual(row, { ...PHOTO_ROW, included: false, title: null, obscured: { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: null } }, format);
    assert.equal(row.sha, sha(PHOTO_BYTES), "the original's fingerprint is kept");
  }
  /* in the document's order, beside rows that state none */
  const text = doc(CG.CASE_DOCUMENT_FORMAT, CG.materialBlockLines({ materials: [WHOLE, PHOTO_ROW], attestations: [] }));
  assert.deepEqual(CG.materialsOf(fmOf(text)).materials.map((r) => [r.ref, r.obscured]),
                   [[MINUTES, null], [PHOTO, { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: null }]]);
});

test("R12 (T37) negative controls: a row without obscured is written byte for byte as before T37 and reads obscured: null; an observation row never states it; a malformed copy or label is written null, never guessed; never throws", () => {
  /* the lines of a row stating none are exactly the eight fields, as before T37 */
  assert.deepEqual(CG.materialsLines([WHOLE]), ["materials:", `  - ref: "${MINUTES}"`, '    kind: "document"', `    sha: "${sha("m")}"`,
    `    text_sha: "${sha("t")}"`, '    origin: "https://records.example/m.pdf"', '    archived_copy: "https://archive.example/m"',
    "    included: true", '    rests_under: "load_bearing"']);
  for (const absent of [undefined, null, "a copy", ["x"]])
    assert.deepEqual(CG.materialsLines([{ ...WHOLE, obscured: absent }]), CG.materialsLines([WHOLE]), String(absent));
  assert.equal(CG.materialsOf(fmOf(doc(CG.CASE_DOCUMENT_FORMAT, CG.materialsLines([WHOLE])))).materials[0].obscured, null);
  /* only a document row (a photo, or a member document) is carried as its copy */
  const obsLines = CG.materialsLines([{ ...PHOTO_ROW, kind: "observation", included: true }]);
  assert.equal(obsLines.some((l) => l.includes("obscured")), false);
  assert.equal(obsLines.includes("    included: true"), true);
  const handWritten = { format: CG.CASE_DOCUMENT_FORMAT, materials: [{ ref: "O", kind: "observation", included: "false",
    obscured_copy: COPY, obscured_label: OBSCURED_LABEL }] };
  assert.equal(CG.materialsOf(handWritten).materials[0].obscured, null, "an observation row's fields are not read");
  /* a copy that is not a SHA-256, or a label that is no sentence, is null: the copy is then missing (R13), never guessed */
  const bad = CG.materialsOf(fmOf(doc(CG.CASE_DOCUMENT_FORMAT, CG.materialsLines([{ ...PHOTO_ROW, obscured: { copy: "ABC", label: "  " } }]))));
  assert.deepEqual(bad.materials[0].obscured, { copy: null, label: null, marked: false, kind: null });
  assert.equal(bad.materials[0].included, false);
  /* one field stated states it, the other read null (undetermined) */
  assert.deepEqual(CG.materialsOf({ format: CG.CASE_DOCUMENT_FORMAT, materials: [{ ref: PHOTO, kind: "document", obscured_label: "L" }] })
    .materials[0].obscured, { copy: null, label: "L", marked: true, kind: null });
  /* an older format carries no materials at all */
  assert.equal(CG.materialsOf(fmOf(doc("bio-case-document/5", CG.materialsLines([PHOTO_ROW])))), null);
  for (const odd of [null, 7, { format: CG.CASE_DOCUMENT_FORMAT, materials: [{ kind: "document", get obscured_copy() { throw new Error("boom"); } }] }])
    assert.doesNotThrow(() => CG.materialsOf(odd));
  assert.doesNotThrow(() => CG.materialsLines([{ ...PHOTO_ROW, obscured: { get copy() { return 7; }, label: 3 } }]));
});

/* ===== R13 ===== */

const rowsOf = (manifest, files) => CG.materialsOf(fmOf(files.get("case.md"))).materials;
const rules = (manifest, materials) => CG.caseFileManifestCheck(manifest, materials === undefined ? undefined : { materials }).map((d) => d.rule);

test("R13 (T37) a bio-case-file/3 case file carrying a photo as its copy meets the rule: the obscured file under the row's ref at the copy's SHA-256, no file of the original", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(manifest.format, "bio-case-file/3");
  const copy = manifest.files.find((f) => f.kind === "obscured");
  assert.deepEqual(copy && [copy.path, copy.sha256], [`materials/${PHOTO}/obscured`, COPY]);
  assert.deepEqual(CG.caseFileEntryOf(copy.path), { kind: "obscured", ref: PHOTO });
  assert.equal(manifest.files.some((f) => f.path.startsWith(`materials/${PHOTO}/`) && f.kind !== "obscured"), false);
  const rows = rowsOf(manifest, files);
  assert.deepEqual(rows.find((r) => r.ref === PHOTO).obscured, { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: null });
  assert.deepEqual(CG.caseFileManifestCheck(manifest, { materials: rows }), []);
  assert.deepEqual(CG.caseFileManifestCheck(manifest), [], "the manifest alone");
});

test("R13 (T37) negative control: an obscured file no row names is a departure (no row states obscured, or the row names another copy)", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  const rows = rowsOf(manifest, files);
  const plain = rows.map((r) => (r.ref === PHOTO ? { ...r, obscured: null } : r));
  assert.deepEqual(rules(manifest, plain), ["obscured_unnamed"], "the row states no obscured");
  assert.deepEqual(rules(manifest, rows.filter((r) => r.ref !== PHOTO)), ["obscured_unnamed"], "no row for the ref");
  const other = rows.map((r) => (r.ref === PHOTO ? { ...r, obscured: { ...r.obscured, copy: sha("another copy") } } : r));
  assert.deepEqual(rules(manifest, other), ["obscured_unnamed", "obscured_copy_missing"], "the row names another copy");
  const d = CG.caseFileManifestCheck(manifest, { materials: plain })[0];
  assert.match(d.detail, /no row of the case document's materials names a copy/);
});

test("R13 (T37) negative control: a row naming a copy no file carries at that SHA-256 is a departure (no file, a file at another digest, a copy not stated)", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  const rows = rowsOf(manifest, files);
  const without = manifestFor(manifest.files.filter((f) => f.kind !== "obscured"), { format: CG.CASE_FILE_FORMAT });
  assert.deepEqual(rules(without, rows), ["obscured_copy_missing"], "no obscured file");
  assert.match(CG.caseFileManifestCheck(without, { materials: rows })[0].detail, new RegExp(COPY));
  const elsewhere = manifestFor(manifest.files.map((f) => (f.kind === "obscured" ? { ...f, sha256: sha("x") } : f)), { format: CG.CASE_FILE_FORMAT });
  assert.deepEqual(rules(elsewhere, rows), ["obscured_unnamed", "obscured_copy_missing"], "a file at another digest");
  const unstated = rows.map((r) => (r.ref === PHOTO ? { ...r, obscured: { copy: null, label: OBSCURED_LABEL } } : r));
  assert.deepEqual(rules(without, unstated), ["obscured_copy_missing"], "a copy the row does not state is never carried");
});

test("R13 (T37) negative control: for a row stating obscured, a document, extracted_text, archive or container file under its ref (the original) is a departure, each named", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  const rows = rowsOf(manifest, files);
  assert.deepEqual([...CG.CASE_FILE_ORIGINAL_KINDS], ["document", "extracted_text", "archive", "container"]);
  const original = {
    document: [PHOTO, sha(PHOTO_BYTES)], extracted_text: [PHOTO, sha("the photo's text")],
    archive: [[PHOTO, sha("zip")], sha("zip")], container: [[PHOTO, sha(PHOTO_BYTES)], sha("record")] };
  assert.deepEqual(Object.keys(original), [...CG.CASE_FILE_ORIGINAL_KINDS]);
  for (const [kind, [key, digest]] of Object.entries(original)) {
    const f = { path: CG.caseFilePath(kind, key), sha256: digest, bytes: 9, part: 1, kind };
    const m = manifestFor([...manifest.files, f], { format: CG.CASE_FILE_FORMAT });
    /* an archive or container under a ref with no document is also R13's chain departure (K2004) */
    const got = rules(m, rows).filter((r) => r !== "chain_without_document");
    assert.deepEqual(got, ["original_carried"], kind);
    assert.match(CG.caseFileManifestCheck(m, { materials: rows }).find((d) => d.rule === "original_carried").detail, /the original never travels/);
    /* the same file under a row carried whole is no departure of this rule */
    const whole = rows.map((r) => (r.ref === PHOTO ? { ...r, obscured: null } : r));
    assert.equal(rules(m, whole).includes("original_carried"), false, `${kind} under a row carried whole`);
  }
  /* a file of another material is untouched: the minutes' document stays */
  assert.equal(manifest.files.some((f) => f.kind === "document" && f.path.includes(MINUTES)), true);
});

test("R13 (T37) the obscured kind is /3's: a /2 or /1 manifest naming it is a departure; a /2 manifest is read as written; without the rows, the row-relative rules are not judged", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  for (const format of [CG.CASE_FILE_FORMAT_V2, CG.CASE_FILE_FORMAT_V1]) {
    const older = { ...manifest, format };
    const got = CG.caseFileManifestCheck(older);
    assert.deepEqual(got.map((d) => d.rule), ["kind_format"], format);
    assert.match(got[0].detail, new RegExp(`a ${format} case file carries no obscured: that kind is bio-case-file/3's`));
  }
  /* a /2 case file as T36 wrote it, with no photo, still meets the rule, with or without its rows */
  const v2 = caseFileFixture({ fileFormat: CG.CASE_FILE_FORMAT_V2 });
  assert.equal(v2.manifest.format, "bio-case-file/2");
  assert.deepEqual(CG.caseFileManifestCheck(v2.manifest), []);
  assert.deepEqual(CG.caseFileManifestCheck(v2.manifest, { materials: rowsOf(v2.manifest, v2.files) }), []);
  /* the manifest alone cannot tell a row: an unnamed copy passes there, and is named once the rows are handed */
  assert.deepEqual(CG.caseFileManifestCheck(manifest, {}), []);
  assert.deepEqual(CG.caseFileManifestCheck(manifest, { materials: null }), []);
  assert.deepEqual(rules(manifest, []), ["obscured_unnamed"]);
  for (const odd of [7, "x", { materials: [null, 7, { ref: PHOTO, obscured: "x" }] }, { get materials() { throw new Error("boom"); } }])
    assert.doesNotThrow(() => CG.caseFileManifestCheck(manifest, odd));
  assert.deepEqual(rowsOf(manifest, files).filter((r) => r.obscured).length, 1);
});

/* ===== R14 ===== */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const materialsSection = (html) => html.slice(html.indexOf("<h2>3. "), html.indexOf("<h2>4. "));

test("R14 (T37) a photo carried as its copy is listed with the original's fingerprint, the copy's fingerprint and its label, word for word, in the document's order", () => {
  const { manifest, files } = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  const html = CG.completeEditionOf(editionInput(manifest, files));
  assert.equal(files.get("complete-edition.html"), html);
  const mats = materialsSection(html);
  const photo = mats.slice(mats.indexOf(`<h3>${PHOTO} (document)</h3>`));
  assert.equal(photo.length > 0 && photo.length < mats.length, true);
  const lis = [...photo.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(lis.slice(0, 6), [esc(`${CG.OBSCURED_WORDS.original}${sha(PHOTO_BYTES)}`),
    esc(CG.SENTENCES.textFingerprint(sha("the photo's text"))), esc("Origin: a member's capture"), esc("Archived copy: none recorded"),
    esc(`${CG.OBSCURED_WORDS.copy}${COPY}`), esc(OBSCURED_LABEL)], "the original's fingerprint, the copy's, and its label");
  assert.equal(photo.includes(esc(CG.SENTENCES.includedWhole)) || photo.includes(esc("Not included: only its fingerprint")), false);
  assert.equal(mats.indexOf(MINUTES) < mats.indexOf(PHOTO), true, "in the document's order");
  /* the label is the row's, word for word, whatever it says; a copy with no label lists none (T38, below) */
  const other = CG.materialsLines([{ ...PHOTO_ROW, obscured: { copy: COPY, label: "Another label & its <words>" } }]);
  const swapped = new Map(files);
  swapped.set("case.md", files.get("case.md").replace(CG.materialsLines([PHOTO_ROW]).slice(1).join("\n"), other.slice(1).join("\n")));
  assert.notEqual(swapped.get("case.md"), files.get("case.md"));
  const html2 = CG.completeEditionOf(editionInput(manifest, swapped));
  assert.equal(materialsSection(html2).includes(`<li>${esc("Another label & its <words>")}</li>`), true);
  /* the same case file gives the same bytes */
  assert.equal(CG.completeEditionOf(editionInput(manifest, files)), html);
});

const GOLDEN = JSON.parse(readFileSync(new URL("./complete-v7-pre-t37-golden.json", import.meta.url), "utf8"));

test("R14 (T37) negative control: an edition whose document states no obscured renders exactly the bytes it rendered before T37 (pinned /7 case files, with and without the T33 blocks)", () => {
  for (const [name, opts] of [["v7", {}], ["v7_t33", { t33: true }]]) {
    const g = GOLDEN[name];
    assert.equal(createHash("sha256").update(g.html).digest("hex"), g.sha256, name);
    assert.match(g.input.files.find((f) => f.path === "case.md").content, /\nformat: bio-case-document\/7\n/);
    assert.equal(g.html.includes("obscured"), false);
    assert.equal(CG.completeEditionOf(g.input), g.html, `${name}: the pinned input renders byte for byte`);
    const { manifest, files } = caseFileFixture(opts);
    assert.equal(CG.completeEditionOf(editionInput(manifest, files)), g.html, `${name}: this module's fixture gives the pinned bytes`);
    /* carried in a /3 case file, it still renders the same bytes */
    const v3 = caseFileFixture({ ...opts, fileFormat: CG.CASE_FILE_FORMAT });
    assert.equal(CG.completeEditionOf(editionInput(v3.manifest, v3.files)), g.html, `${name} in a /3 case file`);
  }
  assert.equal(GOLDEN.v7.sha256, "c4236f0fe9eb73adac975e9257a47712ded3933682f6ccf3ce6f3d965d5182d8");
  assert.equal(GOLDEN.v7_t33.sha256, "9a38ae7f2bd030f746e3d5e099383fd16f9beab87af5e41265b332b08ecc8d8e");
});

/* ===== T38 (N779; K2248, K2303): every photo a published case carries travels as its copy, marked or not ===== */

const PLAIN_COPY = sha(PLAIN_PHOTO_COPY_BYTES);

test("R12 (T38) an unmarked photo is stated obscured too: its row written included false, its copy's SHA-256, its label null, the original's sha, text_sha, origin and archived_copy kept, read back as obscured: {copy, label: null}", () => {
  const lines = CG.materialsLines([{ ...PLAIN_PHOTO_ROW, included: true }]);
  assert.deepEqual(lines, ["materials:", `  - ref: "${PLAIN_PHOTO}"`, '    kind: "document"', `    sha: "${sha(PLAIN_PHOTO_BYTES)}"`,
    "    text_sha: null", `    origin: "a member's capture"`, "    archived_copy: null", "    included: false",
    '    rests_under: "supporting"', `    obscured_copy: "${PLAIN_COPY}"`, "    obscured_label: null"]);
  for (const format of [CG.CASE_DOCUMENT_FORMAT, CG.CASE_DOCUMENT_FORMAT_V6]) {
    const text = doc(format, [...lines, "material_attestations: []"]);
    clean(text);
    const [row] = CG.materialsOf(fmOf(text)).materials;
    assert.deepEqual(row, { ...PLAIN_PHOTO_ROW, included: false, title: null, obscured: { copy: PLAIN_COPY, label: null, marked: false, kind: null } }, format);
    assert.equal(row.sha, sha(PLAIN_PHOTO_BYTES), "the original's fingerprint is kept");
  }
  /* a copy handed with no label, a null one or a blank one is written with the label null: a copy with nothing covered */
  for (const label of [undefined, null, "", "   "])
    assert.deepEqual(CG.materialsLines([{ ...PLAIN_PHOTO_ROW, obscured: { copy: PLAIN_COPY, label } }]), lines, String(label));
  /* no format change: an absent label line reads null, as a written null does */
  const absent = doc(CG.CASE_DOCUMENT_FORMAT, lines.filter((l) => !l.includes("obscured_label")));
  assert.deepEqual(CG.materialsOf(fmOf(absent)).materials[0].obscured, { copy: PLAIN_COPY, label: null, marked: false, kind: null });
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CG.CASE_FILE_FORMAT, "bio-case-file/3");
});

test("R12 (T38) the label is case-carriage's OBSCURED_LABEL when the photo is marked, word for word, else null: a case carrying a marked and an unmarked photo states both obscured, in the document's order", () => {
  const { manifest, files } = caseFileFixture({ photo: true, plainPhoto: true, fileFormat: CG.CASE_FILE_FORMAT });
  clean(files.get("case.md"));
  const rows = CG.materialsOf(fmOf(files.get("case.md"))).materials;
  assert.deepEqual(rows.map((r) => [r.ref, r.included, r.obscured]), [
    [MINUTES, true, null], ["INFO-2026-0009-observation", false, null],
    [PHOTO, false, { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: null }], [PLAIN_PHOTO, false, { copy: PLAIN_COPY, label: null, marked: false, kind: null }]]);
  /* every photo it carries is stated obscured, and travels as its copy alone: R13's rule holds for both */
  assert.deepEqual(CG.caseFileManifestCheck(manifest, { materials: rows }), []);
  assert.deepEqual(manifest.files.filter((f) => f.path.startsWith("materials/INFO-2026-000")).map((f) => [f.path, f.kind]).sort(),
    [[`materials/${MINUTES}/document`, "document"], [`materials/${MINUTES}/extracted.txt`, "extracted_text"],
     [`materials/${PHOTO}/obscured`, "obscured"], [`materials/${PLAIN_PHOTO}/obscured`, "obscured"]].sort());
  /* negative controls: the unmarked photo's row stating no obscured, or its original carried, each departs */
  const whole = rows.map((r) => (r.ref === PLAIN_PHOTO ? { ...r, obscured: null } : r));
  assert.deepEqual(rules(manifest, whole), ["obscured_unnamed"], "a photo's copy no row names");
  const original = { path: CG.caseFilePath("document", PLAIN_PHOTO), sha256: sha(PLAIN_PHOTO_BYTES), bytes: 9, part: 1, kind: "document" };
  assert.deepEqual(rules(manifestFor([...manifest.files, original], { format: CG.CASE_FILE_FORMAT }), rows), ["original_carried"],
                   "an unmarked photo's original never travels either");
});

test("R14 (T38) an unmarked photo's copy is listed with the original's fingerprint and the copy's, and no label; a marked photo's lists its label word for word, its edition the bytes it rendered before T38", () => {
  assert.deepEqual(Object.keys(CG.OBSCURED_WORDS), ["original", "copy", "unmarked", "cleaned"]);
  const { manifest, files } = caseFileFixture({ photo: true, plainPhoto: true, fileFormat: CG.CASE_FILE_FORMAT });
  const html = CG.completeEditionOf(editionInput(manifest, files));
  assert.equal(files.get("complete-edition.html"), html);
  const mats = materialsSection(html);
  const plain = mats.slice(mats.indexOf(`<h3>${PLAIN_PHOTO} (document)</h3>`));
  const lis = (part) => [...part.slice(0, part.indexOf("</ul>")).matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(lis(plain), [esc(`${CG.OBSCURED_WORDS.original}${sha(PLAIN_PHOTO_BYTES)}`), esc("Origin: a member's capture"),
    esc("Archived copy: none recorded"), esc(`${CG.OBSCURED_WORDS.unmarked}${PLAIN_COPY}`), esc(CG.SENTENCES.onlySupporting)],
    "the original's fingerprint and the copy's; no label, and no line saying whether it is included");
  assert.equal(plain.includes("label") || plain.includes("marked areas covered"), false);
  const marked = mats.slice(mats.indexOf(`<h3>${PHOTO} (document)</h3>`), mats.indexOf(`<h3>${PLAIN_PHOTO} (document)</h3>`));
  assert.deepEqual(lis(marked).slice(4, 6), [esc(`${CG.OBSCURED_WORDS.copy}${COPY}`), esc(OBSCURED_LABEL)], "the label, word for word");
  assert.equal(mats.indexOf(PHOTO) < mats.indexOf(PLAIN_PHOTO), true, "in the document's order");
  /* an absent label line renders as a written null: no label */
  const absent = new Map(files);
  absent.set("case.md", files.get("case.md").replace(`    obscured_copy: "${PLAIN_COPY}"\n    obscured_label: null\n`, `    obscured_copy: "${PLAIN_COPY}"\n`));
  assert.notEqual(absent.get("case.md"), files.get("case.md"));
  assert.equal(materialsSection(CG.completeEditionOf(editionInput(manifest, absent))), mats);
  /* negative control: a marked photo's edition renders the bytes it rendered before T38 (pinned from tranche/T38's
     opening code) */
  const t37 = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(createHash("sha256").update(CG.completeEditionOf(editionInput(t37.manifest, t37.files))).digest("hex"),
               "910634ae4b5ee876b270213a84d13eafa65e717db54d8360ff5b1449e2c53a35");
  assert.equal(CG.completeEditionOf(editionInput(manifest, files)), html, "the same case file gives the same bytes");
});

/* ===== T39 (N806; K2315, K2333): a member document carried as its cleaned copy ===== */

const DOC_COPY = sha(MEMBER_DOC_COPY_BYTES);

test("R12 (T39) a member document's cleaned copy row: written flat as obscured_copy and obscured_label (COPY_CLEANED_LABEL, as handed), included false, the original's sha, text_sha, origin and archived_copy kept, and read back as obscured: {copy, label}", () => {
  /* handed included: true, it is written false: the original never travels */
  const lines = CG.materialsLines([{ ...MEMBER_DOC_ROW, included: true }]);
  assert.deepEqual(lines, ["materials:", `  - ref: "${MEMBER_DOC}"`, '    kind: "document"', `    sha: "${sha(MEMBER_DOC_BYTES)}"`,
    `    text_sha: "${sha("the lease draft's text")}"`, `    origin: "a member's file"`, "    archived_copy: null",
    "    included: false", '    rests_under: "load_bearing"', `    obscured_copy: "${DOC_COPY}"`, `    obscured_label: "${COPY_CLEANED_LABEL}"`]);
  for (const format of [CG.CASE_DOCUMENT_FORMAT, CG.CASE_DOCUMENT_FORMAT_V6]) {
    const text = doc(format, [...lines, "material_attestations: []"]);
    clean(text);
    const fm = fmOf(text);
    assert.deepEqual(Object.keys(fm.materials[0]), [...CG.MATERIAL_FIELDS, ...CG.MATERIAL_OBSCURED_FIELDS], "one flat row");
    const [row] = CG.materialsOf(fm).materials;
    assert.deepEqual(row, { ...MEMBER_DOC_ROW, included: false, title: null, obscured: { copy: DOC_COPY, label: COPY_CLEANED_LABEL, marked: true, kind: null } }, format);
    assert.equal(row.sha, sha(MEMBER_DOC_BYTES), "the original's fingerprint is kept");
  }
  /* no new block or field: the case file is still /3 (the format written is /10, R35, whose new blocks are carried inside the document) */
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CG.CASE_FILE_FORMAT, "bio-case-file/3");
  /* beside a marked and an unmarked photo, each read back as written, in the document's order */
  const { files } = caseFileFixture({ photo: true, plainPhoto: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  clean(files.get("case.md"));
  assert.deepEqual(CG.materialsOf(fmOf(files.get("case.md"))).materials.filter((r) => r.obscured).map((r) => [r.ref, r.included, r.obscured]), [
    [PHOTO, false, { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: null }], [PLAIN_PHOTO, false, { copy: sha(PLAIN_PHOTO_COPY_BYTES), label: null, marked: false, kind: null }],
    [MEMBER_DOC, false, { copy: DOC_COPY, label: COPY_CLEANED_LABEL, marked: true, kind: null }]]);
  /* negative control: the same row handed no obscured travels as handed, and reads obscured: null */
  const { obscured, ...whole } = MEMBER_DOC_ROW;
  const back = CG.materialsOf(fmOf(doc(CG.CASE_DOCUMENT_FORMAT, CG.materialsLines([{ ...whole, included: true }])))).materials[0];
  assert.deepEqual([back.included, back.obscured], [true, null]);
});

test("R13 (T39) a bio-case-file/3 case file carrying a member document as its cleaned copy meets the rule; its copy no row names, a copy not carried, or its original carried, each departs", () => {
  for (const as of ["pdf", "ooxml"]) {
    const { manifest, files } = caseFileFixture({ memberDoc: as, fileFormat: CG.CASE_FILE_FORMAT });
    const copy = sha(memberDocCopyBytes(as));
    const f = manifest.files.find((x) => x.kind === "obscured");
    assert.deepEqual(f && [f.path, f.sha256], [`materials/${MEMBER_DOC}/obscured`, copy], as);
    assert.equal(manifest.files.some((x) => x.path.startsWith(`materials/${MEMBER_DOC}/`) && x.kind !== "obscured"), false, "no file of the original");
    const rows = rowsOf(manifest, files);
    assert.deepEqual(rows.find((r) => r.ref === MEMBER_DOC).obscured, { copy, label: COPY_CLEANED_LABEL, marked: true, kind: null });
    assert.deepEqual(CG.caseFileManifestCheck(manifest, { materials: rows }), [], as);
    /* negative controls, each named */
    const unnamed = rows.map((r) => (r.ref === MEMBER_DOC ? { ...r, obscured: null } : r));
    assert.deepEqual(rules(manifest, unnamed), ["obscured_unnamed"]);
    assert.match(CG.caseFileManifestCheck(manifest, { materials: unnamed })[0].detail, /a copy carried in its original's place/);
    const without = manifestFor(manifest.files.filter((x) => x.kind !== "obscured"), { format: CG.CASE_FILE_FORMAT });
    assert.deepEqual(rules(without, rows), ["obscured_copy_missing"]);
    for (const kind of CG.CASE_FILE_ORIGINAL_KINDS) {
      const key = kind === "archive" ? [MEMBER_DOC, sha("zip")] : kind === "container" ? [MEMBER_DOC, sha(MEMBER_DOC_BYTES)] : MEMBER_DOC;
      const orig = { path: CG.caseFilePath(kind, key), sha256: kind === "archive" ? sha("zip") : sha(MEMBER_DOC_BYTES), bytes: 9, part: 1, kind };
      const m = manifestFor([...manifest.files, orig], { format: CG.CASE_FILE_FORMAT });
      assert.deepEqual(rules(m, rows).filter((r) => r !== "chain_without_document"), ["original_carried"], `${as} ${kind}`);
      assert.match(CG.caseFileManifestCheck(m, { materials: rows }).find((d) => d.rule === "original_carried").detail,
                   /whose material the case carries as its copy: the original never travels/);
    }
  }
});

test("R14 (T39) a member document carried as its cleaned copy is listed with the original's fingerprint, the copy's fingerprint, the cleaned-copy line and its label word for word; a photo's copy in the same edition is listed as before", () => {
  assert.equal(CG.OBSCURED_WORDS.cleaned, "Carried as a cleaned copy, with none of the details of who made it or of its pictures; the copy's fingerprint (SHA-256): ");
  const lis = (part) => [...part.slice(0, part.indexOf("</ul>")).matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
  const sectionAt = (html, ref) => { const m = materialsSection(html); return m.slice(m.indexOf(`<h3>${ref} (document)</h3>`)); };
  for (const as of ["pdf", "ooxml"]) {
    const { manifest, files } = caseFileFixture({ memberDoc: as, fileFormat: CG.CASE_FILE_FORMAT });
    const html = CG.completeEditionOf(editionInput(manifest, files));
    assert.equal(files.get("complete-edition.html"), html);
    assert.deepEqual(lis(sectionAt(html, MEMBER_DOC)), [esc(`${CG.OBSCURED_WORDS.original}${sha(MEMBER_DOC_BYTES)}`),
      esc(CG.SENTENCES.textFingerprint(sha("the lease draft's text"))), esc("Origin: a member's file"), esc("Archived copy: none recorded"),
      esc(`${CG.OBSCURED_WORDS.cleaned}${sha(memberDocCopyBytes(as))}`), esc(COPY_CLEANED_LABEL), esc(CG.SENTENCES.reliesOn)], as);
    const docPart = sectionAt(html, MEMBER_DOC);
    for (const not of [CG.OBSCURED_WORDS.copy, CG.OBSCURED_WORDS.unmarked, "marked areas covered", CG.SENTENCES.includedWhole])
      assert.equal(docPart.includes(esc(not)), false, `never "${not.slice(0, 30)}"`);
    /* content handed as bytes renders the same */
    const input = editionInput(manifest, files);
    assert.equal(CG.completeEditionOf({ ...input, files: input.files.map((f) => ({ ...f, content: new TextEncoder().encode(f.content) })) }), html);
    assert.equal(CG.completeEditionOf(editionInput(manifest, files)), html, "the same case file gives the same bytes");
  }
  /* beside a marked and an unmarked photo: each photo is listed as before T39, and the photos' edition keeps its bytes */
  const all = caseFileFixture({ photo: true, plainPhoto: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  const html = CG.completeEditionOf(editionInput(all.manifest, all.files));
  const photos = caseFileFixture({ photo: true, plainPhoto: true, fileFormat: CG.CASE_FILE_FORMAT });
  const before = CG.completeEditionOf(editionInput(photos.manifest, photos.files));
  const listed = (h, ref, next) => { const m = materialsSection(h); const at = m.indexOf(`<h3>${ref} (document)</h3>`);
    return m.slice(at, next ? m.indexOf(`<h3>${next} (document)</h3>`) : m.indexOf("</ul>", at) + 5); };
  assert.equal(listed(html, PHOTO, PLAIN_PHOTO), listed(before, PHOTO, PLAIN_PHOTO), "a marked photo, as before");
  assert.equal(listed(html, PLAIN_PHOTO), listed(before, PLAIN_PHOTO), "an unmarked photo, as before");
  const t37 = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(createHash("sha256").update(CG.completeEditionOf(editionInput(t37.manifest, t37.files))).digest("hex"),
               "910634ae4b5ee876b270213a84d13eafa65e717db54d8360ff5b1449e2c53a35", "a marked photo's edition, pinned before T38");
});

test("R14 (T39) negative controls: for a row stating no kind (R32), the cleaned-copy line is chosen by the copy's own bytes, a PDF or zip package; an image copy with the same row, or a copy not handed, is listed as a photo's", () => {
  const { manifest, files } = caseFileFixture({ memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  const path = CG.caseFilePath("obscured", MEMBER_DOC);
  const lineOf = (m) => { const h = materialsSection(CG.completeEditionOf(editionInput(manifest, m)));
    return h.slice(h.indexOf(`<h3>${MEMBER_DOC} (document)</h3>`)); };
  /* the same row, its copy's bytes an image: a photo's copy line, the label as handed */
  for (const image of ["\xff\xd8\xffJPEG", "\x89PNG\r\n", "RIFF....WEBP", "%PDF", "PK\x03", "pk\x03\x04", "JPEG %PDF-"]) {
    const m = new Map(files); m.set(path, image);
    const part = lineOf(m);
    assert.equal(part.includes(esc(CG.OBSCURED_WORDS.cleaned)), false, JSON.stringify(image));
    assert.equal(part.includes(esc(`${CG.OBSCURED_WORDS.copy}${DOC_COPY}`)), true, JSON.stringify(image));
  }
  /* a copy not handed: listed as a photo's, never guessed a document */
  const input = editionInput(manifest, files);
  const html = CG.completeEditionOf({ ...input, files: input.files.filter((f) => f.path !== path) });
  assert.equal(materialsSection(html).includes(esc(CG.OBSCURED_WORDS.cleaned)), false);
  /* a cleaned copy with no label lists the cleaned-copy line alone; an edition stating no obscured renders as before */
  const nolabel = new Map(files);
  nolabel.set("case.md", files.get("case.md").replace(`    obscured_label: "${COPY_CLEANED_LABEL}"`, "    obscured_label: null"));
  assert.notEqual(nolabel.get("case.md"), files.get("case.md"));
  const part = lineOf(nolabel);
  assert.equal(part.includes(esc(CG.OBSCURED_WORDS.cleaned)), true);
  assert.equal(part.includes(esc(COPY_CLEANED_LABEL)), false);
  const plain = caseFileFixture({ fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(CG.completeEditionOf(editionInput(plain.manifest, plain.files)), JSON.parse(readFileSync(new URL("./complete-v7-pre-t37-golden.json", import.meta.url), "utf8")).v7.html);
  for (const odd of [7, null, new Uint8Array(0), new Uint8Array([0x25, 0x50])]) {
    const m = new Map(files); m.set(path, odd);
    assert.doesNotThrow(() => CG.completeEditionOf(editionInput(manifest, m)));
  }
});
