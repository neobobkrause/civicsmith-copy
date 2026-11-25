/* case-grammar at its interface: R11, the `method:` block; R12, the `materials:` and `material_attestations:` blocks;
   R16, the `accepted_work:` and `accepted_work_flags:` blocks, each written and read back with its negative controls;
   R1, a `/6` document stating every block, and the withheld source's spelling; R13, the case file's manifest and its
   check. Driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha, NOW, V } from "./helpers.mjs";
import { manifestFor, caseFileFixture, digest, editionInput } from "./casefile-fixture.mjs";

const V6 = "bio-case-document/6";
const OLDER = ["bio-case-document/5", "bio-case-document/4", "bio-case-document/3", "bio-case-document/2",
               "bio-case-document/1", null];
const fmOf = (text) => parseFrontmatter(text).data;
const clean = (text) => assert.deepEqual(parseFrontmatter(text).findings, [], "the grammar reads every line");

/* ===== R11 ===== */

test("R11 the method: block round-trips the grading method's version and the catalogue version, as signed", () => {
  assert.deepEqual([...CG.METHOD_FIELDS], ["grading", "checks"]);
  const lines = CG.methodBlockLines({ grading: "bio-grading/1", checks: "1.61.0" });
  assert.deepEqual(lines, ["method:", '  grading: "bio-grading/1"', '  checks: "1.61.0"']);
  const text = doc(V6, lines);
  clean(text);
  assert.deepEqual(CG.methodOf(fmOf(text)), { grading: "bio-grading/1", checks: "1.61.0" });
  /* a value with a quote or a line break is written on one line and read back as written */
  assert.deepEqual(CG.methodOf(fmOf(doc(V6, CG.methodBlockLines({ grading: 'g"1\n2', checks: "c" })))),
                   { grading: "g'1 2", checks: "c" });
  /* a version not stated is null, undetermined, never filled */
  assert.deepEqual(CG.methodOf(fmOf(doc(V6, CG.methodBlockLines({ grading: "bio-grading/1" })))),
                   { grading: "bio-grading/1", checks: null });
  assert.deepEqual(CG.methodBlockLines(), ["method:", "  grading: null", "  checks: null"]);
});

test("R11 negative controls: a /6 document without the block, an older format carrying it, a list in its place and odd input answer null; never throws", () => {
  assert.equal(CG.methodOf(fmOf(doc(V6))), null);
  for (const format of OLDER)
    assert.equal(CG.methodOf(fmOf(doc(format, CG.methodBlockLines({ grading: "bio-grading/1", checks: "1" })))), null, `format ${format}`);
  assert.equal(CG.methodOf({ format: V6, method: ["x"] }), null);
  for (const odd of [null, undefined, 7, "x", {}, [], { get format() { throw new Error("boom"); } },
                     { format: V6, get method() { throw new Error("boom"); } }])
    assert.equal(CG.methodOf(odd), null);
});

/* ===== R12 ===== */

const DOC_SHA = sha("the minutes' bytes");
const OBS = "INFO-2026-0099-observation";
const MATERIALS = [
  { ref: "INFO-2026-0001-minutes", kind: "document", sha: DOC_SHA, text_sha: sha("the minutes' text"),
    origin: "https://records.example/minutes.pdf", archived_copy: "https://archive.example/minutes", included: true,
    rests_under: "load_bearing" },
  { ref: OBS, kind: "observation", sha: sha("an observation"), text_sha: null, origin: "a member's observation",
    archived_copy: null, included: true, rests_under: "supporting" },
  { ref: "INFO-2026-0002-agenda", kind: "document", sha: sha("agenda"), text_sha: null, origin: "https://x.example/a",
    archived_copy: "https://archive.example/a", included: false, rests_under: "supporting" },
];
const ATTESTATIONS = [
  { ref: "INFO-2026-0001-minutes", by_kind: "member", by: V("olive"), level: "name", at: NOW, signature: "SIG-OLIVE", recorded_in: null },
  { ref: "INFO-2026-0001-minutes", by_kind: "member", by: V("heron"), level: "group", at: NOW, signature: "SIG-HERON", recorded_in: null },
  { ref: "INFO-2026-0001-minutes", by_kind: "member", by: V("wren"), level: "project", at: NOW, signature: "SIG-WREN", recorded_in: null },
  { ref: "INFO-2026-0001-minutes", by_kind: "co_attestation", by: "a trusted timestamp", level: "name", at: NOW, signature: "TST", recorded_in: "TSA-1" },
  { ref: "INFO-2026-0001-minutes", by_kind: "project", by: "PROJ-2026-0001-parks", level: null, at: NOW, signature: "forged", recorded_in: "INFO-2026-0001-minutes" },
  { ref: "INFO-2026-0001-minutes", by_kind: "group", by: "lakeshore-tenants", level: null, at: NOW, signature: "anything", recorded_in: null },
  { ref: OBS, by_kind: "member", by: V("olive"), level: "cover", at: NOW, signature: null, recorded_in: null },
];

test("R12 the materials: and material_attestations: blocks round-trip as flat rows, in the document's order, each kind's rule applied", () => {
  assert.deepEqual([...CG.MATERIAL_FIELDS], ["ref", "kind", "sha", "text_sha", "origin", "archived_copy", "included", "rests_under"]);
  assert.deepEqual([...CG.MATERIAL_ATTESTATION_FIELDS], ["ref", "by_kind", "by", "level", "at", "signature", "recorded_in"]);
  assert.deepEqual([...CG.MATERIAL_KINDS], ["document", "observation"]);
  assert.deepEqual([...CG.ATTESTATION_BY_KINDS], ["member", "co_attestation", "project", "group"]);
  assert.deepEqual([...CG.ATTESTATION_LEVELS], ["group", "project", "cover", "name"]);
  assert.equal(CG.GROUP_ATTESTATION_SIGNATURE, "case");
  const text = doc(V6, CG.materialBlockLines({ materials: MATERIALS, attestations: ATTESTATIONS }));
  clean(text);
  const fm = fmOf(text);
  assert.deepEqual(fm.materials.map((r) => Object.keys(r)), MATERIALS.map(() => [...CG.MATERIAL_FIELDS]), "flat rows");
  assert.deepEqual(fm.material_attestations.map((r) => Object.keys(r)), ATTESTATIONS.map(() => [...CG.MATERIAL_ATTESTATION_FIELDS]),
                   "a row handed no sha is written with the seven fields it always had (G47)");
  const m = CG.materialsOf(fm);
  assert.deepEqual(m.materials, MATERIALS.map((r) => ({ ...r, title: null, obscured: null })),
                   "every material as written, included and rests_under as handed; a row stating no obscured answers null");
  assert.deepEqual(m.attestations, [
    ATTESTATIONS[0],
    { ...ATTESTATIONS[1], by: null, signature: null },
    { ...ATTESTATIONS[2], by: null, signature: null },
    { ...ATTESTATIONS[3], level: null },
    { ...ATTESTATIONS[4], signature: null },
    { ...ATTESTATIONS[5], signature: "case" },
    ATTESTATIONS[6]].map((r) => ({ ...r, sha: null })), "G47: every row reads the capture it names, null when it names none");
  /* a member at group or project is never named in the bytes: no handle, no key, no signature */
  for (const secret of ["heron", "wren", "SIG-HERON", "SIG-WREN"]) assert.equal(text.includes(secret), false, secret);
  /* a material whose source's identity is withheld is listed like any other */
  assert.equal(m.materials[0].ref, "INFO-2026-0001-minutes");
});

test("R12 the writer says nothing it was not handed: a kind or rests_under outside its words is null, included is true only when handed true, empty blocks are []", () => {
  const odd = CG.materialsOf(fmOf(doc(V6, CG.materialBlockLines({
    materials: [{ ref: "R", kind: "rumour", included: "yes", rests_under: "central" }, null, 7],
    attestations: [{ ref: "R", by_kind: "friend", by: "x", level: "name", signature: "s" },
                   { ref: "R", by_kind: "member", by: "y", level: "boss", signature: "t" }] }))));
  assert.deepEqual(odd.materials, [{ ref: "R", kind: null, sha: null, text_sha: null, origin: null, archived_copy: null,
                                     included: false, rests_under: null, title: null, obscured: null }]);
  assert.deepEqual(odd.attestations, [
    { ref: "R", by_kind: null, by: "x", level: null, at: null, signature: "s", recorded_in: null, sha: null },
    { ref: "R", by_kind: "member", by: null, level: null, at: null, signature: null, recorded_in: null, sha: null }],
    "K1317 (6): a member row with no level chosen states none and carries no identity");
  assert.deepEqual(CG.materialBlockLines(), ["materials: []", "material_attestations: []"]);
  assert.deepEqual(CG.materialsOf(fmOf(doc(V6, CG.materialBlockLines()))), { materials: [], attestations: [] });
});

test("R12 negative controls: a /6 document without the blocks, an older format carrying them and odd input answer null; a block missing reads null beside the other; included reads true only when the bytes say true; never throws", () => {
  assert.equal(CG.materialsOf(fmOf(doc(V6))), null);
  for (const format of OLDER)
    assert.equal(CG.materialsOf(fmOf(doc(format, CG.materialBlockLines({ materials: MATERIALS })))), null, `format ${format}`);
  const onlyMaterials = CG.materialsOf({ format: V6, materials: [{ ref: "R", included: "true" }, { ref: "S", included: 1 }] });
  assert.deepEqual(onlyMaterials.materials.map((x) => x.included), [true, false]);
  assert.equal(onlyMaterials.attestations, null);
  assert.equal(CG.materialsOf({ format: V6, material_attestations: [] }).materials, null);
  for (const odd of [null, undefined, 7, "x", {}, [], { get format() { throw new Error("boom"); } },
                     { format: V6, get materials() { throw new Error("boom"); } }])
    assert.equal(CG.materialsOf(odd), null);
});

/* ===== R16 ===== */

const REF = `imported:${sha("an import")}/INQ-2026-0042-lease`;
const ROWS = [
  { member: "INQ-2026-0001-a", leg_of: "INQ-2026-0001-a", ref: REF, group: "riverside-watch", case: "CASE-2026-0007",
    edition: 2, finding: "INQ-2026-0042-lease", manifest_sha: sha("their manifest"),
    pair: { capture: { state: "graded", grade: "B" }, connection: { state: "undetermined", grade: null } },
    result: "recreated_in_part", gaps: ["the 2019 contract, not yet fetched", "a passage, unchecked"],
    accepted_by: V("olive"), accepted_at: NOW, reason: "We read it, \"twice\"." },
  { member: "INQ-2026-0003-c", leg_of: "INQ-2026-0002-b", ref: REF, group: "riverside-watch", case: "CASE-2026-0007",
    edition: 2, finding: "INQ-2026-0042-lease", manifest_sha: sha("their manifest"),
    pair: { capture: "A", connection: "C", testimony: { state: "unrated" } }, result: "recreated", gaps: null,
    accepted_by: V("olive"), accepted_at: NOW, reason: "Recreated whole." },
];
const FLAGS = [{ ref: REF, edition: 2, flag: "FLAG-1", issue: "The lease date may be wrong.", flagged_at: NOW,
                 words: "We disclose it and rely on the rest.", acknowledged_by: V("olive"), acknowledged_at: NOW }];

test("R16 the accepted_work: and accepted_work_flags: blocks round-trip, one row per (member, leg), the pair per axis on one line", () => {
  assert.deepEqual([...CG.ACCEPTED_WORK_FIELDS], ["member", "leg_of", "ref", "group", "case", "edition", "finding",
    "manifest_sha", "pair", "result", "gaps", "accepted_by", "accepted_at", "reason"]);
  assert.deepEqual([...CG.ACCEPTED_WORK_FLAG_FIELDS], ["ref", "edition", "flag", "issue", "flagged_at", "words",
    "acknowledged_by", "acknowledged_at"]);
  const lines = CG.acceptedWorkBlockLines({ rows: ROWS, flags: FLAGS });
  assert.equal(lines.includes("    pair: [capture:B, connection:undetermined]"), true);
  assert.equal(lines.includes("    pair: [capture:A, connection:C, testimony:unrated]"), true);
  const text = doc(V6, lines);
  clean(text);
  const fm = fmOf(text);
  assert.deepEqual(fm.accepted_work.map((r) => Object.keys(r)), ROWS.map(() => [...CG.ACCEPTED_WORK_FIELDS]), "flat rows");
  const back = CG.acceptedWorkOf(fm);
  assert.deepEqual(back.rows, [
    { ...ROWS[0], gaps: "the 2019 contract, not yet fetched; a passage, unchecked", reason: "We read it, 'twice'." },
    { ...ROWS[1], pair: { capture: { state: "graded", grade: "A" }, connection: { state: "graded", grade: "C" },
                          testimony: { state: "unrated", grade: null } } }]);
  assert.deepEqual(back.flags, FLAGS);
  /* pairLine and pairOf are inverse over every axis value */
  for (const c of ["A", "B", "C", "D", "unrated", "undetermined"]) for (const k of ["A", "D", "unrated", "undetermined"]) {
    const pair = { capture: c, connection: { state: ["unrated", "undetermined"].includes(k) ? k : "graded", grade: k } };
    const read = CG.pairOf(parseFrontmatter(doc(V6, [`p: ${CG.pairLine(pair)}`])).data.p);
    assert.deepEqual(read.capture, ["unrated", "undetermined"].includes(c) ? { state: c, grade: null } : { state: "graded", grade: c });
    assert.deepEqual(read.connection, ["unrated", "undetermined"].includes(k) ? { state: k, grade: null } : { state: "graded", grade: k });
  }
});

test("R16 negative controls: a document without the blocks answers empty lists, any format and odd input alike; no block is written when no chain reaches a ref; a pair that is not the inline list reads null; never throws", () => {
  assert.deepEqual(CG.acceptedWorkBlockLines(), [], "neither block is required when no chain reaches a ref");
  assert.deepEqual(CG.acceptedWorkBlockLines({ rows: [null, 7], flags: [] }), []);
  assert.deepEqual(CG.acceptedWorkOf(fmOf(doc(V6))), { rows: [], flags: [] });
  for (const format of OLDER) assert.deepEqual(CG.acceptedWorkOf(fmOf(doc(format))), { rows: [], flags: [] });
  for (const odd of [null, undefined, 7, "x", {}, [], { get accepted_work() { throw new Error("boom"); } }])
    assert.deepEqual(CG.acceptedWorkOf(odd), { rows: [], flags: [] });
  /* only flags: the rows block is written empty beside them */
  assert.deepEqual(CG.acceptedWorkBlockLines({ flags: FLAGS }).slice(0, 2), ["accepted_work: []", "accepted_work_flags:"]);
  /* a pair or edition the grammar does not hold reads null, undetermined */
  const bad = CG.acceptedWorkOf({ accepted_work: [{ ref: REF, pair: "capture B", edition: "two" },
                                                  { ref: REF, pair: ["capture:E", "connection:B"], edition: -1 },
                                                  { ref: REF, pair: ["capture:B"], edition: 1 },
                                                  { ref: REF, pair: ["capture:B", "capture:C", "connection:B"] },
                                                  { ref: REF, pair: ["capture:graded", "connection:B"] }] });
  assert.deepEqual(bad.rows.map((r) => [r.pair, r.edition]), [[null, null], [null, null], [null, 1], [null, null], [null, null]]);
  assert.equal(CG.pairLine(null), "[capture:undetermined, connection:undetermined]", "an axis not handed is undetermined, never a guess");
  assert.equal(CG.pairLine({ capture: { state: "unrated", grade: "B" }, connection: "Z" }), "[capture:unrated, connection:undetermined]");
});

/* ===== R1: a /6 document stating every block, and the withheld source ===== */

test("R1 a /6 document states every /5 block and R11's, R12's and R16's, each read back by its own reader; a /5 document reads as written, with no method or materials", () => {
  const blocks = [...CG.methodBlockLines({ grading: "bio-grading/1", checks: "1.61.0" }),
    ...CG.materialBlockLines({ materials: MATERIALS, attestations: ATTESTATIONS }),
    ...CG.acceptedWorkBlockLines({ rows: ROWS, flags: FLAGS }),
    ...CG.captureBlockLines([{ capture: DOC_SHA, member: "INQ-2026-0001-a", grade: "B" }]),
    ...CG.sourceBlockLines([{ capture: DOC_SHA, stated: CG.withheldSourceStatement({ capture: DOC_SHA, received: NOW }), basis: null }]),
    ...CG.whatChangedBlockLines({ statement: "s", began_as: "member" }), ...CG.lensBlockLines([]),
    ...CG.workingOnLines("NOTE-2026-0001"), "case_tensions: []", "case_citations: []"];
  const text = doc(V6, blocks, ["", ...CG.whatChangedSectionLines("s"), "## Scope", ""]);
  clean(text);
  const fm = fmOf(text);
  assert.equal(CG.caseDocumentRequiresMaterials(fm), true);
  assert.deepEqual(CG.methodOf(fm), { grading: "bio-grading/1", checks: "1.61.0" });
  assert.equal(CG.materialsOf(fm).materials.length, 3);
  assert.equal(CG.acceptedWorkOf(fm).rows.length, 2);
  assert.deepEqual([CG.caseDocumentBlocks(text).detail, CG.caseDocumentBlocks(text).sources[0].basis], [null, null]);
  assert.equal(CG.whatChangedOf(fm, parseFrontmatter(text).body).statement, "s");
  assert.deepEqual(CG.lensOf(fm), { statements: [] });
  assert.equal(CG.workingOnOf(fm), "NOTE-2026-0001");
  assert.deepEqual([CG.caseTensionsOf(text).tensions, CG.signedCitations(text).state], [[], "signed"]);
  /* the same blocks under /5: every /5 reader as before, the /6 blocks not read */
  const v5 = fmOf(doc("bio-case-document/5", blocks));
  assert.deepEqual([CG.methodOf(v5), CG.materialsOf(v5), CG.workingOnOf(v5)], [null, null, "NOTE-2026-0001"]);
  assert.equal(CG.caseDocumentBlocks(doc("bio-case-document/5", blocks)).detail, null);
});

test("R1 DEC-119 a source whose identity is withheld is stated as Withheld with its reason and the receipt, never what was withheld; sourceRowsStanding holds it, and the older unnamed statement, as the capture's", () => {
  assert.equal(CG.WITHHELD_SOURCE_LABEL, "Withheld");
  assert.equal(sha(CG.WITHHELD_SOURCE_REASON), "fe04f4e5dace936d4477351b47f5da136b5c1215014a814b365a0b04eaff97ea", "the bytes are pinned");
  assert.equal(CG.withheldSourceStatement({ capture: DOC_SHA, received: NOW }),
               `Withheld: the source has not consented to being named, and no public record names them; received as ${DOC_SHA} at ${NOW}`);
  assert.equal(CG.withheldSourceStatement(), "Withheld: the source has not consented to being named, and no public record "
    + "names them; received as an undetermined digest at an undetermined time");
  const publishable = (c) => (c === DOC_SHA ? { entries: [], received: NOW } : null);
  const rows = [{ capture: DOC_SHA, stated: CG.withheldSourceStatement({ capture: DOC_SHA, received: NOW }), basis: null },
                { capture: DOC_SHA, stated: CG.unnamedSourceStatement({ capture: DOC_SHA, received: NOW }), basis: null }];
  assert.deepEqual(CG.sourceRowsStanding(rows, publishable), []);
  const stale = [{ capture: DOC_SHA, stated: CG.withheldSourceStatement({ capture: DOC_SHA, received: "2020-01-01T00:00:00Z" }), basis: null },
                 { capture: DOC_SHA, stated: CG.withheldSourceStatement({ capture: DOC_SHA, received: NOW }), basis: "consent" }];
  assert.deepEqual(CG.sourceRowsStanding(stale, publishable), stale, "another receipt, or a basis, does not hold");
  assert.deepEqual(rows.map(CG.sourceRowWithheld), [true, true]);
  assert.deepEqual([{ capture: DOC_SHA, stated: "name: Pat", basis: "consent" }, { capture: DOC_SHA, stated: "", basis: null },
                    null, 7].map(CG.sourceRowWithheld), [false, false, false, false]);
});

/* ===== R13 ===== */

test("R13 K1318 the case file's format: its token, its kinds, one path per kind read back, and a part fingerprinted over its files", () => {
  assert.equal(CG.CASE_FILE_FORMAT, "bio-case-file/3");
  assert.equal(CG.CASE_FILE_FORMAT_V2, "bio-case-file/2");
  assert.deepEqual([...CG.CASE_FILE_FORMATS_ACCEPTED], ["bio-case-file/4", "bio-case-file/3", "bio-case-file/2", "bio-case-file/1"]);
  assert.deepEqual([...CG.CASE_FILE_V2_KINDS], ["archive", "container", "criteria"]);
  assert.deepEqual([...CG.CASE_FILE_V3_KINDS], ["obscured"]);
  assert.equal(CG.CASE_FILE_MANIFEST_PATH, "manifest.json");
  assert.deepEqual([...CG.CASE_FILE_KINDS], ["case_document", "case_signature", "complete_edition", "finding",
    "finding_signature", "grading_facts", "passages", "document", "extracted_text", "observation", "attestation",
    "calculation", "archive", "container", "criteria", "obscured"]);
  assert.deepEqual([...CG.CASE_FILE_MANIFEST_FIELDS], ["format", "group", "case", "edition", "case_document_sha", "keys", "parts", "files"]);
  assert.deepEqual([...CG.CASE_FILE_FILE_FIELDS], ["path", "sha256", "bytes", "part", "kind"]);
  assert.deepEqual([...CG.CASE_FILE_PART_FIELDS], ["index", "sha256", "bytes"]);
  assert.deepEqual([...CG.CASE_FILE_KEY_FIELDS], ["key", "fingerprint"]);
  const F = "INQ-2026-0001-a";
  const R = "INFO-2026-0001-minutes";
  const spelled = {
    case_document: [null, "case.md"], case_signature: [null, "case.md.sig"], complete_edition: [null, "complete-edition.html"],
    finding: [F, `findings/${F}/finding.md`], finding_signature: [F, `findings/${F}/finding.md.sig`],
    grading_facts: [F, `findings/${F}/grading-facts.json`], passages: [F, `findings/${F}/passages.json`],
    document: [R, `materials/${R}/document`], extracted_text: [R, `materials/${R}/extracted.txt`],
    observation: [R, `materials/${R}/observation.md`], attestation: [[R, "account-1.txt"], `attestations/${R}/account-1.txt`],
    calculation: ["CALC-2026-0001", "calculations/CALC-2026-0001/calculation.json"],
    archive: [[R, sha("zip")], `materials/${R}/archives/${sha("zip")}`],
    container: [[R, sha("member")], `materials/${R}/containers/${sha("member")}.json`],
    criteria: [null, "criteria.json"], obscured: [R, `materials/${R}/obscured`] };
  assert.deepEqual(Object.keys(spelled), [...CG.CASE_FILE_KINDS], "every kind has its path");
  for (const [kind, [key, path]] of Object.entries(spelled)) {
    assert.equal(CG.caseFilePath(kind, key), path, kind);
    const e = CG.caseFileEntryOf(path);
    assert.equal(e.kind, kind);
    if (["finding", "finding_signature", "grading_facts", "passages"].includes(kind)) assert.equal(e.finding, F);
    if (["document", "extracted_text", "observation", "archive", "container", "obscured"].includes(kind)) assert.equal(e.ref, R);
  }
  assert.equal(CG.caseFileEntryOf(`materials/${R}/archives/${sha("zip")}`).archive, sha("zip"));
  assert.equal(CG.caseFileEntryOf(`materials/${R}/containers/${sha("member")}.json`).member, sha("member"));
  for (const [kind, key] of [["finding", "../x"], ["finding", ""], ["document", "a/b"], ["attestation", "x"], ["nope", "x"],
                             ["finding", null], ["attestation", ["a", "../b"]], ["archive", R], ["archive", [R, "ABC"]],
                             ["container", ["../x", sha("m")]], ["container", [R, sha("m"), 1]], ["obscured", "../x"],
                             ["obscured", [R, "c"]]])
    assert.equal(CG.caseFilePath(kind, key), null, `${kind} ${key}`);
  for (const path of ["manifest.json", "/case.md", "findings/x/other.md", "findings/../x/finding.md", "materials/r/document/x",
                      "attestations/r/../x", "case.MD", "", null, 7, "findings/.x/finding.md",
                      `materials/r/archives/${sha("z")}.json`, `materials/r/containers/${sha("m")}`, "materials/r/archives/abc",
                      `materials/r/other/${sha("z")}`, "criteria.JSON", `materials/r/obscured/${sha("c")}`, "materials/r/obscured.jpg"])
    assert.equal(CG.caseFileEntryOf(path), null, String(path));
  /* K1318: the part's fingerprint: one line per file of the part, in path order, and the sum of their sizes */
  const files = [{ path: "b", sha256: sha("b"), bytes: 2, part: 1 }, { path: "a", sha256: sha("a"), bytes: 3, part: 1 },
                 { path: "c", sha256: sha("c"), bytes: 5, part: 2 }];
  assert.deepEqual(CG.casePartDigest(files, 1), { sha256: sha(`a ${sha("a")} 3\nb ${sha("b")} 2\n`), bytes: 5 });
  assert.deepEqual(CG.casePartDigest(files, 2), digest(files, 2));
  assert.deepEqual(CG.casePartDigest([...files].reverse(), 1), CG.casePartDigest(files, 1), "path order, whatever the order handed");
  assert.deepEqual(CG.casePartDigest(null, 1), { sha256: sha(""), bytes: 0 });
});

test("R13 caseFileManifestCheck answers none for a manifest that meets the rule, split into parts or not", () => {
  const { manifest } = caseFileFixture();
  assert.deepEqual(CG.caseFileManifestCheck(manifest), []);
  const split = manifestFor(manifest.files.map((f) => ({ ...f, part: f.kind === "document" ? 2 : 1 })));
  assert.equal(split.parts.length, 2);
  assert.deepEqual(CG.caseFileManifestCheck(split), []);
});

test("R13 caseFileManifestCheck names every way a manifest departs from the rule, each one, and never throws", () => {
  const { manifest } = caseFileFixture();
  const rules = (m) => CG.caseFileManifestCheck(m).map((d) => `${d.at}:${d.rule}`);
  const set = (k, v) => ({ ...manifest, [k]: v });
  const file = (i, over) => ({ ...manifest, files: manifest.files.map((f, j) => (j === i ? { ...f, ...over } : f)) });
  const doc0 = manifest.files.findIndex((f) => f.kind === "case_document");
  const cases = [
    [set("format", "bio-case-file/5"), "format:format"],
    [set("group", "Lakeshore Tenants"), "group:group"],
    [set("case", ""), "case:case"],
    [set("edition", 0), "edition:edition"],
    [set("case_document_sha", "ABC"), "case_document_sha:sha256"],
    [set("keys", []), "keys:keys"],
    [set("keys", [{ key: "ssh-ed25519 AAAA", fingerprint: "MD5:00" }]), "keys[0].fingerprint:fingerprint"],
    [set("keys", [{ key: "", fingerprint: manifest.keys[0].fingerprint }]), "keys[0].key:key"],
    [set("keys", [manifest.keys[0], manifest.keys[0]]), "keys[1].fingerprint:key_twice"],
    [set("keys", [{ ...manifest.keys[0], extra: 1 }]), "keys[0].extra:unknown_field"],
    [set("extra", 1), "extra:unknown_field"],
    [set("parts", []), "parts:parts"],
    [set("parts", [{ ...manifest.parts[0], index: 2 }]), "parts[0].index:part_index"],
    [set("parts", [{ ...manifest.parts[0], sha256: sha("x") }]), "parts[0].sha256:part_sha256"],
    [set("parts", [{ ...manifest.parts[0], bytes: 1 }]), "parts[0].bytes:part_bytes"],
    [set("parts", [manifest.parts[0], { index: 2, sha256: sha(""), bytes: 0 }]), "parts[1]:part_empty"],
    [set("files", null), "files:files"],
    [file(1, { kind: "novel" }), "files[1].kind:kind"],
    [file(1, { path: "elsewhere/x" }), "files[1].path:path"],
    [file(doc0, { kind: "complete_edition" }), "files:case_document"],
    [file(1, { sha256: "nope" }), "files[1].sha256:sha256"],
    [file(1, { bytes: -1 }), "files[1].bytes:bytes"],
    [file(1, { part: 3 }), "files[1].part:part"],
    [file(1, { extra: true }), "files[1].extra:unknown_field"],
    [set("files", [...manifest.files].reverse()), "files[1]:file_order"],
    [set("files", [...manifest.files, manifest.files[manifest.files.length - 1]]), `files[${manifest.files.length}].path:path_twice`],
    [set("files", manifest.files.filter((f) => f.kind !== "complete_edition")), "files:complete_edition"],
    [set("case_document_sha", sha("another document")), "case_document_sha:case_document_sha"],
  ];
  for (const [m, want] of cases) assert.equal(rules(m).includes(want), true, `${want} in ${JSON.stringify(rules(m))}`);
  /* every departure is named with a sentence */
  for (const [m] of cases) for (const d of CG.caseFileManifestCheck(m))
    assert.equal(typeof d.detail === "string" && d.detail.length > 10 && typeof d.at === "string" && typeof d.rule === "string", true);
  for (const odd of [null, undefined, 7, "x", [], { get format() { throw new Error("boom"); } }]) {
    assert.doesNotThrow(() => CG.caseFileManifestCheck(odd));
    assert.equal(CG.caseFileManifestCheck(odd).length > 0, true, "an odd manifest is never clean");
  }
  /* pure: the same answer twice, the manifest untouched */
  const before = JSON.stringify(manifest);
  assert.deepEqual(CG.caseFileManifestCheck(manifest), CG.caseFileManifestCheck(manifest));
  assert.equal(JSON.stringify(manifest), before);
});

/* ===== R13: bio-case-file/2's kinds, and a /1 file read as written (N717, K2004) ===== */

const R = "INFO-2026-0001-minutes";
const ZIP = "the outer zip's bytes";
const INNER = "the inner zip's bytes";
/* A `/2` manifest: the fixture's files, plus a member's chain (its container record and its archive, then the archive's
   own container record and its archive, outward) under the minutes' ref, and the edition's criteria. */
const v2Files = (manifest, extra = []) => [...manifest.files,
  { path: CG.caseFilePath("container", [R, sha("the minutes' bytes")]), sha256: sha("rec1"), bytes: 4, part: 1, kind: "container" },
  { path: CG.caseFilePath("archive", [R, sha(INNER)]), sha256: sha(INNER), bytes: 21, part: 1, kind: "archive" },
  { path: CG.caseFilePath("container", [R, sha(INNER)]), sha256: sha("rec2"), bytes: 4, part: 1, kind: "container" },
  { path: CG.caseFilePath("archive", [R, sha(ZIP)]), sha256: sha(ZIP), bytes: 21, part: 1, kind: "archive" },
  { path: CG.caseFilePath("criteria"), sha256: sha("[]"), bytes: 2, part: 1, kind: "criteria" }, ...extra];

test("R13 a bio-case-file/2 manifest carrying each new kind (archive, container, criteria) meets the rule, read as written, and so does a /3 one; one with none of them does too", () => {
  const { manifest } = caseFileFixture();
  for (const format of [CG.CASE_FILE_FORMAT_V2, CG.CASE_FILE_FORMAT]) {
    assert.deepEqual(CG.caseFileManifestCheck(manifestFor(v2Files(manifest), { format })), [], format);
    assert.deepEqual(CG.caseFileManifestCheck(manifestFor(v2Files(manifest), { format }), { materials: [] }), [], `${format} with its rows`);
    assert.deepEqual(CG.caseFileManifestCheck(manifestFor(manifest.files, { format })), [], format);
  }
  const v2 = manifestFor(v2Files(manifest), { format: CG.CASE_FILE_FORMAT_V2 });
  /* split into parts: the chain in its own part */
  const split = manifestFor(v2.files.map((f) => ({ ...f, part: CG.CASE_FILE_V2_KINDS.includes(f.kind) ? 2 : 1 })), { format: CG.CASE_FILE_FORMAT_V2 });
  assert.deepEqual(CG.caseFileManifestCheck(split), []);
  /* every path read back names its kind, ref and hash */
  const read = v2.files.filter((f) => CG.CASE_FILE_V2_KINDS.includes(f.kind)).map((f) => JSON.stringify(CG.caseFileEntryOf(f.path)));
  assert.deepEqual(new Set(read), new Set([{ kind: "archive", ref: R, archive: sha(INNER) }, { kind: "archive", ref: R, archive: sha(ZIP) },
    { kind: "container", ref: R, member: sha(INNER) }, { kind: "container", ref: R, member: sha("the minutes' bytes") },
    { kind: "criteria" }].map((e) => JSON.stringify(e))));
});

test("R13 the /2 departures: an archive or container under a ref that carries no document, two criteria files, an archive listed under another hash; each named", () => {
  const { manifest } = caseFileFixture();
  const rules = (files, format = CG.CASE_FILE_FORMAT_V2) => CG.caseFileManifestCheck(manifestFor(files, { format })).map((d) => d.rule);
  const O = "INFO-2026-0009-observation";
  for (const [kind, key] of [["archive", [O, sha("x")]], ["container", [O, sha("y")]], ["archive", ["INFO-2026-0077-gone", sha("x")]]]) {
    const f = { path: CG.caseFilePath(kind, key), sha256: kind === "archive" ? key[1] : sha("r"), bytes: 1, part: 1, kind };
    const got = CG.caseFileManifestCheck(manifestFor(v2Files(manifest, [f]), { format: CG.CASE_FILE_FORMAT_V2 }));
    assert.deepEqual(got.map((d) => d.rule), ["chain_without_document"], `${kind} under ${key[0]}`);
    assert.match(got[0].detail, /carries no document under that ref/);
  }
  const twice = v2Files(manifest).flatMap((f) => (f.kind === "criteria" ? [f, { ...f }] : [f]));
  assert.equal(rules(twice).includes("criteria"), true, "at most one criteria file");
  assert.equal(rules(twice).includes("path_twice"), true);
  const misnamed = v2Files(manifest).map((f) => (f.kind === "archive" ? { ...f, sha256: sha("other") } : f));
  assert.equal(rules(misnamed).includes("archive_sha"), true, "an archive is named by its own SHA-256");
  /* a container at an archive's path, or the reverse, is a path_kind departure */
  const swapped = v2Files(manifest).map((f) => (f.kind === "container" ? { ...f, kind: "archive" } : f));
  assert.equal(rules(swapped).includes("path_kind"), true);
});

test("R13 a bio-case-file/1 case file is read as written: one naming none of /2's kinds meets the rule, one naming any is a departure", () => {
  const { manifest } = caseFileFixture();
  assert.equal(manifest.format, CG.CASE_FILE_FORMAT_V1);
  assert.deepEqual(CG.caseFileManifestCheck(manifest), [], "an older /1 manifest still passes");
  for (const kind of CG.CASE_FILE_V2_KINDS) {
    const files = v2Files(manifest).filter((f) => !CG.CASE_FILE_V2_KINDS.includes(f.kind) || f.kind === kind);
    const got = CG.caseFileManifestCheck(manifestFor(files, { format: CG.CASE_FILE_FORMAT_V1 }));
    assert.equal(got.some((d) => d.rule === "kind_format" && d.detail.includes(kind) && d.detail.includes("bio-case-file/2's")), true, `${kind} in a /1 manifest`);
    assert.equal(got.every((d) => d.rule === "kind_format"), true, JSON.stringify(got));
  }
});

test("R13 R14 the complete edition renders from the case file's other files only: adding the /2 kinds leaves its bytes unchanged", () => {
  const { manifest, files } = caseFileFixture();
  const base = CG.completeEditionOf(editionInput(manifest, files));
  const more = new Map(files);
  const v2 = manifestFor(v2Files(manifest), { format: CG.CASE_FILE_FORMAT_V2 });
  for (const f of v2.files) if (!more.has(f.path)) more.set(f.path, f.kind === "criteria" ? "[]" : "bytes");
  assert.equal(CG.completeEditionOf(editionInput(v2, more)), base);
});
