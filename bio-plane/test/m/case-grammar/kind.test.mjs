/* case-grammar at its interface, T47 (N953): R31's `obscured_kind` on a `document` row carried as its copy, optional and
   flat, `photo` or `document`, read back as `obscured: {copy, label, marked, kind}`, a row stating none reading `kind:
   null`, so every earlier edition reads and renders byte for byte; the stored marker, never a label's words, tells a
   cleaned copy from a photo's. Each clause with the controls the requirement names (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha } from "./helpers.mjs";
import { caseFileFixture, editionInput, PHOTO, PHOTO_ROW, PHOTO_COPY_BYTES, OBSCURED_LABEL, MEMBER_DOC, MEMBER_DOC_ROW,
         COPY_CLEANED_LABEL } from "./casefile-fixture.mjs";

const fmOf = (text) => { const p = parseFrontmatter(text); assert.deepEqual(p.findings, [], "the grammar reads every line"); return p.data; };
const V7 = CG.CASE_DOCUMENT_FORMAT;
const COPY = sha(PHOTO_COPY_BYTES);
const withKind = (row, kind, extra = {}) => ({ ...row, obscured: { ...row.obscured, ...extra, kind } });
const back = (rows, format = V7) => CG.materialsOf(fmOf(doc(format, CG.materialsLines(rows)))).materials;
const obscuredLines = (lines) => lines.filter((l) => l.includes("obscured"));

test("R31 obscured_kind is written flat after obscured_label (and obscured_marked), and each kind round-trips as obscured: {copy, label, marked, kind}", () => {
  assert.equal(CG.MATERIAL_OBSCURED_KIND_FIELD, "obscured_kind");
  assert.deepEqual([...CG.MATERIAL_OBSCURED_KINDS], ["photo", "document"]);
  assert.equal(Object.isFrozen(CG.MATERIAL_OBSCURED_KINDS), true);
  const photo = withKind(PHOTO_ROW, "photo");
  const cleaned = withKind(MEMBER_DOC_ROW, "document", { marked: true });
  const lines = CG.materialsLines([photo, cleaned]);
  assert.deepEqual(obscuredLines(lines), [`    obscured_copy: "${COPY}"`, `    obscured_label: "${OBSCURED_LABEL}"`, '    obscured_kind: "photo"',
    `    obscured_copy: "${MEMBER_DOC_ROW.obscured.copy}"`, `    obscured_label: "${COPY_CLEANED_LABEL}"`, "    obscured_marked: true",
    '    obscured_kind: "document"']);
  for (const format of [V7, CG.CASE_DOCUMENT_FORMAT_V6]) {
    const fm = fmOf(doc(format, lines));
    assert.deepEqual(Object.keys(fm.materials[0]), [...CG.MATERIAL_FIELDS, ...CG.MATERIAL_OBSCURED_FIELDS, CG.MATERIAL_OBSCURED_KIND_FIELD], "one flat row");
    assert.deepEqual(Object.keys(fm.materials[1]),
      [...CG.MATERIAL_FIELDS, ...CG.MATERIAL_OBSCURED_FIELDS, CG.MATERIAL_OBSCURED_MARKED_FIELD, CG.MATERIAL_OBSCURED_KIND_FIELD]);
    assert.deepEqual(CG.materialsOf(fm).materials.map((r) => r.obscured), [
      { copy: COPY, label: OBSCURED_LABEL, marked: true, kind: "photo" },
      { copy: MEMBER_DOC_ROW.obscured.copy, label: COPY_CLEANED_LABEL, marked: true, kind: "document" }], format);
  }
  /* each kind on either row: the marker is what is stated, never inferred from the row's label or copy */
  for (const kind of CG.MATERIAL_OBSCURED_KINDS)
    for (const row of [PHOTO_ROW, MEMBER_DOC_ROW]) assert.equal(back([withKind(row, kind)])[0].obscured.kind, kind, `${row.ref} ${kind}`);
  /* the rest of the row is as before: included false, the original's fingerprint kept */
  const [r] = back([cleaned]);
  assert.deepEqual([r.included, r.sha, r.text_sha], [false, MEMBER_DOC_ROW.sha, MEMBER_DOC_ROW.text_sha]);
});

test("R31 control: a row stating no kind reads kind: null, and a row handed none is written byte for byte as before T47; no format change", () => {
  /* handed no kind (absent, or undefined) the row's lines are exactly those written before T47 */
  for (const row of [PHOTO_ROW, MEMBER_DOC_ROW, withKind(PHOTO_ROW, undefined)])
    assert.equal(CG.materialsLines([row]).some((l) => l.includes("obscured_kind")), false);
  assert.deepEqual(CG.materialsLines([withKind(PHOTO_ROW, undefined)]), CG.materialsLines([PHOTO_ROW]));
  assert.deepEqual(CG.materialsLines([PHOTO_ROW]), ["materials:", `  - ref: "${PHOTO}"`, '    kind: "document"', `    sha: "${PHOTO_ROW.sha}"`,
    `    text_sha: "${PHOTO_ROW.text_sha}"`, `    origin: "a member's capture"`, "    archived_copy: null", "    included: false",
    '    rests_under: "load_bearing"', `    obscured_copy: "${COPY}"`, `    obscured_label: "${OBSCURED_LABEL}"`], "pinned as T37 wrote it");
  /* read back: kind null on every row that states none */
  assert.deepEqual(back([PHOTO_ROW, MEMBER_DOC_ROW]).map((r) => r.obscured.kind), [null, null]);
  /* every earlier edition reads and renders byte for byte: the marked photo's edition pinned before T38 */
  const t37 = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(createHash("sha256").update(CG.completeEditionOf(editionInput(t37.manifest, t37.files))).digest("hex"),
               "910634ae4b5ee876b270213a84d13eafa65e717db54d8360ff5b1449e2c53a35");
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CG.CASE_FILE_FORMAT, "bio-case-file/3");
});

test("R31 control: a row handed another value writes obscured_kind null, undetermined, and reads it null; a value written outside the two words reads null; never throws", () => {
  for (const other of [null, "Photo", "image", "pdf", "", 7, true, {}, ["photo"]]) {
    const lines = CG.materialsLines([withKind(PHOTO_ROW, other)]);
    assert.equal(lines.at(-1), "    obscured_kind: null", JSON.stringify(other));
    assert.equal(back([withKind(PHOTO_ROW, other)])[0].obscured.kind, null, JSON.stringify(other));
  }
  /* bytes another hand wrote: only the two words, as written, are a kind */
  const hand = (v) => CG.materialsOf({ format: V7, materials: [{ ref: PHOTO, kind: "document", obscured_copy: COPY, obscured_label: "L",
    obscured_kind: v }] }).materials[0].obscured.kind;
  assert.deepEqual(["photo", "document", "null", "Photo", "video", 7, true, null, undefined].map(hand),
                   ["photo", "document", null, null, null, null, null, null, null]);
  /* an observation row is never carried as its copy: the marker is neither written nor read for it */
  assert.equal(CG.materialsLines([{ ...withKind(PHOTO_ROW, "photo"), kind: "observation" }]).some((l) => l.includes("obscured")), false);
  assert.equal(CG.materialsOf({ format: V7, materials: [{ ref: "O", kind: "observation", obscured_copy: COPY, obscured_kind: "photo" }] })
    .materials[0].obscured, null);
  /* a kind that cannot be read: the row is still listed, its copy and label null, never a guess */
  const hostile = { ...PHOTO_ROW, obscured: { copy: COPY, label: OBSCURED_LABEL, get kind() { throw new Error("boom"); } } };
  assert.doesNotThrow(() => CG.materialsLines([hostile]));
  assert.deepEqual(back([hostile])[0].obscured, { copy: null, label: null, marked: false, kind: null });
  assert.doesNotThrow(() => CG.materialsOf({ format: V7, materials: [{ kind: "document", obscured_copy: COPY, get obscured_kind() { throw new Error("boom"); } }] }));
});

test("R31 the stored marker, never a label's words, tells a cleaned copy from a photo's: a re-worded label leaves the kind as signed; the case file's rule holds with it", () => {
  /* re-word either label, or swap the two: the kind read is the one stated */
  for (const label of [COPY_CLEANED_LABEL, OBSCURED_LABEL, "Some new words the design stream chose", null]) {
    assert.equal(back([withKind({ ...MEMBER_DOC_ROW, obscured: { ...MEMBER_DOC_ROW.obscured, label } }, "document")])[0].obscured.kind, "document", String(label));
    assert.equal(back([withKind({ ...PHOTO_ROW, obscured: { ...PHOTO_ROW.obscured, label } }, "photo")])[0].obscured.kind, "photo", String(label));
  }
  /* a case file whose rows state the marker meets R13's rule as before, and lists each material the same way */
  const { manifest, files } = caseFileFixture({ photo: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  const marked = new Map(files);
  marked.set("case.md", files.get("case.md")
    .replace(CG.materialsLines([PHOTO_ROW]).slice(1).join("\n"), CG.materialsLines([withKind(PHOTO_ROW, "photo")]).slice(1).join("\n"))
    .replace(CG.materialsLines([MEMBER_DOC_ROW]).slice(1).join("\n"), CG.materialsLines([withKind(MEMBER_DOC_ROW, "document")]).slice(1).join("\n")));
  assert.notEqual(marked.get("case.md"), files.get("case.md"));
  const rows = CG.materialsOf(fmOf(marked.get("case.md"))).materials;
  assert.deepEqual(rows.filter((r) => r.obscured).map((r) => [r.ref, r.obscured.kind]), [[PHOTO, "photo"], [MEMBER_DOC, "document"]]);
  assert.deepEqual(CG.caseFileManifestCheck(manifest, { materials: rows }), []);
  const section = (html) => html.slice(html.indexOf("<h2>3. "), html.indexOf("<h2>4. "));
  assert.equal(section(CG.completeEditionOf(editionInput(manifest, marked))), section(CG.completeEditionOf(editionInput(manifest, files))),
               "the materials are listed as before");
});

/* ===== R32 (T48; N1016; K3111): the complete edition reads R31's stored kind first ===== */
const MEMBER_PATH = CG.caseFilePath("obscured", MEMBER_DOC);
const PHOTO_PATH = CG.caseFilePath("obscured", PHOTO);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/* the fixture's case document with `obscured_kind` stated on the row of `label`; the copy's bytes replaced when handed */
const edition = (fixture, { stating, label, ref, bytes }) => {
  const files = new Map(fixture.files);
  if (stating !== undefined) {
    const was = files.get("case.md");
    files.set("case.md", was.replace(`    obscured_label: "${label}"`, `    obscured_label: "${label}"\n    obscured_kind: ${stating === null ? "null" : `"${stating}"`}`));
    assert.notEqual(files.get("case.md"), was);
  }
  if (bytes !== undefined) files.set(CG.caseFilePath("obscured", ref), bytes);
  const input = editionInput(fixture.manifest, files);
  return CG.completeEditionOf(bytes === null ? { ...input, files: input.files.filter((f) => f.path !== CG.caseFilePath("obscured", ref)) } : input);
};
const rowListing = (html, ref) => { const at = html.indexOf(`<h3>${ref} (document)</h3>`); return html.slice(at, html.indexOf("</ul>", at)); };
const IMAGE = "\xff\xd8\xffJPEG";
const PDF = "%PDF-1.7 a cleaned member document";

test("R32 a row stating kind: \"photo\" whose copy is a PDF is listed as a photo's copy; a row stating kind: \"document\" whose copy is an image is listed as a cleaned copy", () => {
  const fx = caseFileFixture({ photo: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  const cleaned = esc(CG.OBSCURED_WORDS.cleaned), copy = esc(CG.OBSCURED_WORDS.copy);
  /* the member document's copy is a PDF, yet the row states a photo: the photo's copy line, the label as handed */
  const asPhoto = rowListing(edition(fx, { stating: "photo", label: COPY_CLEANED_LABEL, ref: MEMBER_DOC }), MEMBER_DOC);
  assert.equal(asPhoto.includes(cleaned), false);
  assert.equal(asPhoto.includes(esc(`${CG.OBSCURED_WORDS.copy}${MEMBER_DOC_ROW.obscured.copy}`)), true);
  assert.equal(asPhoto.includes(esc(COPY_CLEANED_LABEL)), true, "the label is still printed word for word");
  /* the photo's copy is an image, yet the row states a document: the cleaned-copy line */
  const asDoc = rowListing(edition(fx, { stating: "document", label: OBSCURED_LABEL, ref: PHOTO }), PHOTO);
  assert.equal(asDoc.includes(copy), false);
  assert.equal(asDoc.includes(esc(`${CG.OBSCURED_WORDS.cleaned}${COPY}`)), true);
  assert.equal(asDoc.includes(esc(OBSCURED_LABEL)), true);
  /* the stored kind agreeing with the bytes lists the same lines as the bytes alone gave
     (the case document's own hash differs, since the stated kind is in its bytes; the materials are the same) */
  const materials = (h) => h.slice(h.indexOf("<h2>3. "), h.indexOf("<h2>4. "));
  assert.equal(materials(edition(fx, { stating: "document", label: COPY_CLEANED_LABEL, ref: MEMBER_DOC })), materials(edition(fx, {})));
  assert.equal(materials(edition(fx, { stating: "photo", label: OBSCURED_LABEL, ref: PHOTO })), materials(edition(fx, {})));
});

test("R32 a row stating a kind is never re-read from its bytes: no copy handed, an empty or odd copy, an image or a PDF all list by the kind", () => {
  const fx = caseFileFixture({ photo: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  for (const bytes of [null, "", IMAGE, PDF, "PK\x03\x04zip", new Uint8Array(0)]) {
    const doc1 = rowListing(edition(fx, { stating: "document", label: COPY_CLEANED_LABEL, ref: MEMBER_DOC, bytes }), MEMBER_DOC);
    assert.equal(doc1.includes(esc(CG.OBSCURED_WORDS.cleaned)), true, `document, ${JSON.stringify(bytes)}`);
    const photo = rowListing(edition(fx, { stating: "photo", label: COPY_CLEANED_LABEL, ref: MEMBER_DOC, bytes }), MEMBER_DOC);
    assert.equal(photo.includes(esc(CG.OBSCURED_WORDS.cleaned)), false, `photo, ${JSON.stringify(bytes)}`);
    assert.equal(photo.includes(esc(CG.OBSCURED_WORDS.copy)), true, `photo, ${JSON.stringify(bytes)}`);
  }
  assert.doesNotThrow(() => edition(fx, { stating: "photo", label: OBSCURED_LABEL, ref: PHOTO, bytes: 7 }));
});

test("R32 a row stating none (kind: null, or no obscured_kind at all) keeps T39's choice by the copy's bytes, and an edition signed before T47 renders byte for byte as before", () => {
  const fx = caseFileFixture({ photo: true, memberDoc: true, fileFormat: CG.CASE_FILE_FORMAT });
  for (const stating of [undefined, null, "other"]) {
    const html = edition(fx, { stating, label: COPY_CLEANED_LABEL, ref: MEMBER_DOC });
    assert.equal(rowListing(html, MEMBER_DOC).includes(esc(CG.OBSCURED_WORDS.cleaned)), true, `a PDF copy, ${stating}`);
    const image = rowListing(edition(fx, { stating, label: COPY_CLEANED_LABEL, ref: MEMBER_DOC, bytes: IMAGE }), MEMBER_DOC);
    assert.equal(image.includes(esc(CG.OBSCURED_WORDS.cleaned)), false, `an image copy, ${stating}`);
    assert.equal(image.includes(esc(CG.OBSCURED_WORDS.copy)), true, `an image copy, ${stating}`);
    const none = rowListing(edition(fx, { stating, label: COPY_CLEANED_LABEL, ref: MEMBER_DOC, bytes: null }), MEMBER_DOC);
    assert.equal(none.includes(esc(CG.OBSCURED_WORDS.cleaned)), false, `no copy handed, ${stating}`);
  }
  const t37 = caseFileFixture({ photo: true, fileFormat: CG.CASE_FILE_FORMAT });
  assert.equal(createHash("sha256").update(CG.completeEditionOf(editionInput(t37.manifest, t37.files))).digest("hex"),
               "910634ae4b5ee876b270213a84d13eafa65e717db54d8360ff5b1449e2c53a35");
});
