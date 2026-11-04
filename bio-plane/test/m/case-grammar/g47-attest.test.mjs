/* case-grammar at its interface, fix round 6 (G47; K4669, K4672): R12's optional `sha` on a `material_attestations:` row,
   the capture the attestation is of, so the public page (R14) joins it to a material by capture when the row has one and
   by `ref` otherwise; and R1's `/9`, the format a document declares when any row carries a `sha`, so an old checker answers
   "no specification" and never a wrong verdict. Each clause with its control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha, NOW } from "./helpers.mjs";

const fmOf = (text) => { const p = parseFrontmatter(text); assert.deepEqual(p.findings, [], "the grammar reads every line"); return p.data; };
const V8 = "bio-case-document/8";
const V10 = CG.CASE_DOCUMENT_FORMAT;
const V9 = "bio-case-document/9";
const SOURCE = "INFO-2026-0001-faq";
const CAPS = [sha("capture one"), sha("capture two"), sha("capture three")];
const WHEN = ["2026-01-11T00:00:00Z", "2026-02-22T00:00:00Z", "2026-03-30T00:00:00Z"];
const MAT = (i) => ({ ref: SOURCE, kind: "document", sha: CAPS[i], text_sha: sha(`text ${i}`), origin: "https://www.foia.gov/faq.html",
  archived_copy: `https://archive.example/${i}`, included: true, rests_under: "load_bearing", title: "FOIA: frequently asked questions" });
const ATT = (i, over = {}) => [
  { ref: SOURCE, by_kind: "member", by: null, level: "group", at: WHEN[i], signature: null, recorded_in: null, ...over },
  { ref: SOURCE, by_kind: "co_attestation", by: `archive-${i + 1}`, level: null, at: WHEN[i], signature: "TST", recorded_in: `TSA-${i + 1}`, ...over }];
const OLD_ROW = { ref: SOURCE, by_kind: "member", by: null, level: "group", at: NOW, signature: null, recorded_in: null };
/* the lines a row without a `sha` is written as, spelled out: the bytes of a case signed before this field */
const OLD_LINES = ["material_attestations:",
  `  - ref: "${SOURCE}"`, '    by_kind: "member"', "    by: null", '    level: "group"', `    at: "${NOW}"`, "    signature: null", "    recorded_in: null"];

test("R12 (G47) a row handed a sha is written with it after recorded_in and read back with it; the field list is unchanged", () => {
  assert.deepEqual([...CG.MATERIAL_ATTESTATION_FIELDS], ["ref", "by_kind", "by", "level", "at", "signature", "recorded_in"]);
  assert.equal(CG.MATERIAL_ATTESTATION_SHA_FIELD, "sha");
  const lines = CG.materialAttestationLines([{ ...OLD_ROW, sha: CAPS[1] }]);
  assert.deepEqual(lines, [...OLD_LINES, `    sha: "${CAPS[1]}"`]);
  const back = CG.materialsOf(fmOf(doc(V9, [...CG.materialsLines([MAT(1)]), ...lines]))).attestations;
  assert.deepEqual(back, [{ ...OLD_ROW, sha: CAPS[1] }]);
  /* a row of every kind carries it the same way */
  const all = [...ATT(0, { sha: CAPS[0] }), { ref: SOURCE, by_kind: "group", by: "lakeshore-tenants", sha: CAPS[0] },
               { ref: SOURCE, by_kind: "project", by: "PROJ-2026-0001-parks", at: NOW, recorded_in: SOURCE, sha: CAPS[0] }];
  const read = CG.materialsOf(fmOf(doc(V9, [...CG.materialsLines([MAT(0)]), ...CG.materialAttestationLines(all)]))).attestations;
  assert.deepEqual(read.map((r) => r.sha), [CAPS[0], CAPS[0], CAPS[0], CAPS[0]]);
});

test("R12 (G47) control: a row without a sha is written byte for byte as before and read with sha null; a sha that is null, empty or not a sentence is not written", () => {
  assert.deepEqual(CG.materialAttestationLines([OLD_ROW]), OLD_LINES);
  assert.deepEqual(CG.materialAttestationLines([{ ...OLD_ROW, sha: undefined }]), OLD_LINES);
  for (const odd of [null, "", "  ", 7, true, {}, ["x"]])
    assert.deepEqual(CG.materialAttestationLines([{ ...OLD_ROW, sha: odd }]), OLD_LINES, JSON.stringify(odd));
  assert.equal(CG.materialAttestationLines([]).join("\n"), "material_attestations: []");
  /* in one block, a row with and a row without: each is written as its own kind of row */
  const mixed = CG.materialAttestationLines([OLD_ROW, { ...OLD_ROW, sha: CAPS[0] }, OLD_ROW]);
  assert.equal(mixed.filter((l) => l.includes("sha:")).length, 1);
  assert.deepEqual(CG.materialsOf(fmOf(doc(V8, [...CG.materialsLines([MAT(0)]), ...mixed]))).attestations.map((r) => r.sha), [null, CAPS[0], null]);
  /* a case signed before the field reads sha null on every row, whatever the row's kind */
  const old = CG.materialsOf(fmOf(doc(V8, [...CG.materialsLines([MAT(0)]), ...CG.materialAttestationLines(ATT(0))]))).attestations;
  assert.deepEqual(old.map((r) => r.sha), [null, null]);
  assert.equal(CG.materialsOf({ format: V8, material_attestations: [{ ref: "R", sha: "null" }, { ref: "S", sha: 4 }] })
    .attestations.map((r) => r.sha).join("|"), "|");
  assert.doesNotThrow(() => CG.materialsOf({ format: V8, material_attestations: [{ ref: "R", get sha() { throw new Error("boom"); } }] }));
  assert.doesNotThrow(() => CG.materialAttestationLines([{ ...OLD_ROW, get sha() { throw new Error("boom"); } }]));
});

test("R1 R12 R35 (G47, T53) every document declares bio-case-document/10, whatever its attestation rows carry; /9 and /8 stay accepted and every predicate holds for /9 and /10 as for /8", () => {
  /* R35 amends G47's rule: the format in force is /10 and caseDocumentFormatFor answers it always */
  assert.equal(V10, "bio-case-document/10");
  assert.equal(CG.CASE_DOCUMENT_FORMAT_V9, V9);
  assert.equal(CG.caseDocumentFormatFor([{ ...OLD_ROW, sha: CAPS[0] }]), V10);
  assert.equal(CG.caseDocumentFormatFor([OLD_ROW, { ...OLD_ROW, sha: CAPS[2] }, OLD_ROW]), V10, "any one row");
  assert.equal(CG.caseDocumentFormatFor([OLD_ROW]), V10);
  assert.equal(CG.caseDocumentFormatFor([]), V10);
  for (const odd of [undefined, null, 7, "x", {}, [null, 7], [{ ...OLD_ROW, sha: "" }], [{ ...OLD_ROW, sha: 7 }], [{ get sha() { throw new Error("boom"); } }]])
    assert.equal(CG.caseDocumentFormatFor(odd), V10);
  assert.deepEqual([...CG.CASE_DOCUMENT_FORMATS_ACCEPTED], [V10, V9, V8, "bio-case-document/7", "bio-case-document/6", "bio-case-document/5",
    "bio-case-document/4", "bio-case-document/3", "bio-case-document/2", "bio-case-document/1"]);
  const preds = [CG.caseDocumentStatesMemberBlocks, CG.caseDocumentRequiresDisclosures, CG.caseDocumentRequiresV4Disclosures,
                 CG.caseDocumentRequiresTensionSection, CG.caseDocumentRequiresMaterials];
  for (const p of preds) { assert.equal(p({ format: V9 }), p({ format: V8 }), p.name); assert.equal(p({ format: V10 }), p({ format: V8 }), p.name); }
  assert.equal(CG.caseDocumentRequiresMaterials({ format: V9 }), true);
  for (const p of preds) assert.equal(p({ format: "bio-case-document/11" }), false);
  /* the words and the name /8 states: team words, Civicsmith */
  assert.equal(CG.caseWordsOf({ format: V9 }), "team");
  assert.equal(CG.editionProductOf({ format: V9 }), CG.PRODUCT_NAMES.current);
  assert.equal(CG.caseWordsOf({ format: V10 }), "team");
  assert.equal(CG.editionProductOf({ format: V10 }), CG.PRODUCT_NAMES.current);
  /* control: a /9 document's blocks are read, an older format's still are not */
  assert.notEqual(CG.materialsOf(fmOf(doc(V9, [...CG.materialsLines([MAT(0)]), ...CG.materialAttestationLines(ATT(0, { sha: CAPS[0] }))]))), null);
  assert.equal(CG.materialsOf(fmOf(doc("bio-case-document/5", CG.materialAttestationLines(ATT(0, { sha: CAPS[0] }))))), null);
});

/* a case file of three captures of one source, as the complete edition reads it */
const editionOf = (format, attestations, materials = [0, 1, 2].map(MAT)) => {
  const text = doc(format, [...CG.materialsLines(materials), ...CG.materialAttestationLines(attestations)]);
  return CG.completeEditionOf({ format: "bio-case-file/3", group: "lakeshore-tenants", case: "CASE-2026-0001", edition: 1,
    case_document_sha: sha(text), keys: [], files: [{ path: CG.caseFilePath("case_document"), sha256: sha(text), bytes: text.length, content: text }] });
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const materialsPart = (html) => html.slice(html.indexOf("<h2>3. "), html.indexOf("<h2>4. "));
const entriesOf = (html) => materialsPart(html).split("<h3>").slice(1);
const WORDS = CG.WORDS.team;

test("R14 R12 (G47) the page of three captures of one source shows each capture its own attestations and no other's", () => {
  const rows = [0, 1, 2].flatMap((i) => ATT(i, { sha: CAPS[i] }));
  /* the join is by the row's own field, whatever format the page is rendered as */
  for (const format of [V9, V8]) entriesOf(editionOf(format, rows)).forEach((entry, i) => {
    assert.ok(entry.includes(`archive-${i + 1}`) && !entry.includes(`archive-${(i + 1) % 3 + 1}`), `${format} entry ${i}`);
  });
  const entries = entriesOf(editionOf(V9, rows));
  assert.equal(entries.length, 3, "one entry per capture");
  entries.forEach((entry, i) => {
    assert.ok(entry.includes(esc(`Fingerprint (SHA-256): ${CAPS[i]}`)), `entry ${i} is capture ${i}`);
    assert.ok(entry.includes(`archive-${i + 1}`) && entry.includes(`TSA-${i + 1}`), `entry ${i}: its own co-attestation`);
    assert.ok(entry.includes(esc(WORDS.attestedMember(WORDS.levelWord("group"), `, on ${WHEN[i]}`))), `entry ${i}: its own member line`);
    for (const j of [0, 1, 2].filter((k) => k !== i)) {
      assert.equal(entry.includes(`archive-${j + 1}`), false, `entry ${i} shows nothing of capture ${j}'s co-archive`);
      assert.equal(entry.includes(WHEN[j]), false, `entry ${i} shows nothing of capture ${j}'s timestamp`);
    }
    assert.equal((entry.match(/<li>/g) || []).length, 8, "its own six lines and its two attestations, once each");
  });
});

test("R14 R12 (G47) controls: a document whose rows carry no sha joins by ref as before (a mixed document joins each row its own way); three sources keep their own lines", () => {
  /* no sha: the ref join, every capture of the source shows every row of the ref, in the document's order, as it always did */
  const bare = entriesOf(editionOf(V8, [0, 1, 2].flatMap((i) => ATT(i))));
  assert.equal(bare.length, 3);
  for (const entry of bare) {
    const lines = [...entry.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]).filter((l) => WHEN.some((w) => l.includes(w)));
    assert.equal(lines.length, 6, "the three captures' lines, under each");
    for (const i of [0, 1, 2]) assert.ok(entry.includes(`archive-${i + 1}`) && entry.includes(WHEN[i]));
  }
  /* mixed: a row with a sha is joined to its capture alone, a row without by ref */
  const mixed = entriesOf(editionOf(V9, [...ATT(0, { sha: CAPS[0] }), ...ATT(1)]));
  assert.ok(mixed[0].includes("archive-1") && mixed[0].includes("archive-2"), "capture 0: its own and the ref's");
  assert.equal(mixed[1].includes("archive-1"), false, "capture 1: not capture 0's");
  assert.ok(mixed[1].includes("archive-2") && mixed[2].includes("archive-2"));
  /* three sources, one capture each, no sha: each its own lines, and the sha-free bytes are what a sha-free document renders */
  const three = [0, 1, 2].map((i) => ({ ...MAT(i), ref: `${SOURCE}-${i}` }));
  const own = entriesOf(editionOf(V8, [0, 1, 2].flatMap((i) => ATT(i, { ref: `${SOURCE}-${i}` })), three));
  own.forEach((entry, i) => {
    assert.ok(entry.includes(`archive-${i + 1}`));
    for (const j of [0, 1, 2].filter((k) => k !== i)) assert.equal(entry.includes(`archive-${j + 1}`), false);
  });
  const withSha = entriesOf(editionOf(V9, [0, 1, 2].flatMap((i) => ATT(i, { ref: `${SOURCE}-${i}`, sha: CAPS[i] })), three));
  assert.deepEqual(withSha, own, "joined by capture or by ref, three sources read the same");
  /* an attestation carrying a sha no material holds belongs to no material, never to the ref's */
  const stray = entriesOf(editionOf(V9, ATT(0, { sha: sha("not a capture of this case") })));
  for (const entry of stray) assert.equal(entry.includes("archive-1"), false);
});
