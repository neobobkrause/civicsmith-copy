/* case-checker: the readable specification (R14), the two public reads (R15) and the outward text (R17). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as CC from "../../../src/case-checker/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { PublicRead } from "../../../src/public-read/index.mjs";
import { STRENGTH_AXES } from "../../../src/strength/arithmetic.mjs";
import { W } from "./fixture.mjs";

const V1 = "bio-case-file/1", V2 = "bio-case-file/2", V3 = "bio-case-file/3", V4 = "bio-case-file/4";
/* Every word a specification spells as code: each backticked span's identifiers. */
const codeOf = (spec) => new Set([...spec.matchAll(/`([^`]+)`/g)].flatMap((m) => [m[1], ...m[1].split(/[^A-Za-z0-9_./-]+/)]));

test("R14: the specifications of bio-case-file/1, /2 and /3 are held with this module, oldest first, each version naming the format it specifies; /3 is the current format", () => {
  assert.deepEqual(CC.CASE_FILE_SPEC_VERSIONS, [V1, V2, V3, V4]);
  assert.equal(CG.CASE_FILE_FORMAT, V3);
  for (const v of CC.CASE_FILE_SPEC_VERSIONS) {
    assert.ok(CC.CASE_FILE_SPECS[v].startsWith(`# The case file, format ${v}\n`), v);
    assert.ok(CC.CASE_FILE_SPECS[v].includes(`\`format\`: \`${v}\`.`), v);
    for (const other of [V1, V2, V3, V4].filter((x) => x !== v)) assert.equal(CC.CASE_FILE_SPECS[v].includes(`\`format\`: \`${other}\`.`), false, `${v} names ${other}`);
  }
  /* /2 says how a /1 case file is read: as written, its manifest naming none of the kinds /2 adds */
  assert.match(CC.CASE_FILE_SPECS[V2], /A `bio-case-file\/1` case file is read as written, by its own specification, which is held beside this one: its manifest names none of the kinds version 2 adds/);
  assert.equal(CC.CASE_FILE_SPECS[V1].includes("bio-case-file/2"), false);
  /* (T37; K2206) /3 says how /2 and /1 case files are read: as written, a /2 manifest naming no obscured file */
  assert.match(CC.CASE_FILE_SPECS[V3], /A `bio-case-file\/2` or `bio-case-file\/1` case file is read as written, by its own specification, each held beside this one: a `bio-case-file\/2` manifest names no `obscured` file, a `bio-case-file\/1` manifest none of the kinds versions 2 and 3 add, and a manifest naming a kind its format lacks departs from its format/);
  for (const v of [V1, V2]) assert.equal(CC.CASE_FILE_SPECS[v].includes("bio-case-file/3") || CC.CASE_FILE_SPECS[v].includes("obscured"), false, v);
});

for (const v of [V1, V2, V3]) test(`R14 R20: the specification of ${v} states every field, kind and rule a checker needs, from case-grammar R11–R13 and R16–R18`, () => {
  const SPEC = CC.CASE_FILE_SPECS[v];
  const CODE = codeOf(SPEC);
  const named = (word) => CODE.has(word);
  /* the kinds /2 adds are /2's and /3's, and /3's its alone (case-grammar R13: a manifest naming a kind its format lacks departs) */
  const added = { [V1]: [], [V2]: ["archive", "container", "criteria"], [V3]: ["archive", "container", "criteria", "obscured"] };
  assert.deepEqual(added[V3].filter((k) => CG.CASE_FILE_KINDS.includes(k)), added[V3]);
  const words = [
    ...CG.CASE_FILE_MANIFEST_FIELDS, ...CG.CASE_FILE_KEY_FIELDS, ...CG.CASE_FILE_PART_FIELDS, ...CG.CASE_FILE_FILE_FIELDS,
    ...CG.CASE_FILE_KINDS.filter((k) => added[v].includes(k) || !added[V3].includes(k)), ...CG.METHOD_FIELDS, ...CG.MATERIAL_FIELDS, ...CG.MATERIAL_ATTESTATION_FIELDS, ...CG.ATTESTATION_BY_KINDS,
    ...CG.ACCEPTED_WORK_FIELDS, ...CG.GRADING_FACT_FIELDS, ...CG.PASSAGE_FIELDS, ...CG.CALCULATION_FIELDS, ...CG.RECOMPUTE_STATUSES,
    ...CG.TIMELINE_FIELDS, ...CG.TIMELINE_LANES, ...CG.MATERIAL_KINDS, ...CG.MATERIAL_RESTS_UNDER, ...STRENGTH_AXES,
    CG.CASE_FILE_MANIFEST_PATH, CG.GROUP_ATTESTATION_SIGNATURE,
    "case_id", "case_edition", "case_findings", "case_roles", "case_strength", "required_strength", "capture_accounts",
    "observation_attributions", "content_id", "capture_sha", "extent", "chain", "quoted", "legs", "answer",
    "load_bearing", "supporting", "recreated", "recreated_in_part", "did_not_recreate", "bio-ratify", "ssh-ed25519",
    /* R20: the calculations block (case-grammar R18) and its answers */
    "calculations", "calc", "recipe", "inputs", "method_version", "results", "result_key", "recompute", "disclosed", "bio-calc/1",
    "agrees", "differs", "unbound", "not_recomputed", "calculation", "timeline",
  ];
  const missing = [...new Set(words)].filter((w) => !named(w));
  assert.deepEqual(missing, []);
  /* every path the format spells, and each statement a signature is over */
  for (const p of [CG.caseFilePath("case_document"), CG.caseFilePath("case_signature"), CG.caseFilePath("complete_edition"),
                   CG.caseFilePath("finding", "<finding>"), CG.caseFilePath("finding_signature", "<finding>"),
                   CG.caseFilePath("grading_facts", "<finding>"), CG.caseFilePath("passages", "<finding>")].filter(Boolean))
    assert.ok(SPEC.includes(p), p);
  /* the calculation kind's three paths, and the rule that an input is named by its SHA-256 (case-grammar R13, R18, R19) */
  const H = "a".repeat(64);
  for (const p of [CG.caseFilePath("calculation", "CALC-1").replace("CALC-1", "<calc>"),
                   CG.caseFilePath("calculation", ["CALC-1", H]).replace("CALC-1", "<calc>").replace(H, "<sha256>"),
                   CG.caseFilePath("calculation", "prov")])
    assert.ok(SPEC.includes(p), p);
  assert.match(SPEC, /named by its SHA-256 \(the manifest lists it with that SHA-256, or it departs: the input_sha rule\)/);
  for (const s of ["bio-ratify-case <case_id> <case_edition> <case_document_sha>", "bio-ratify <finding id> <version_sha>",
                   "bio-capture-account <capture sha>"]) assert.ok(SPEC.includes(s), s);
  /* the checks, one numbered rule each: integrity, signatures, passages, grades, the bar, publication checks,
     presentability, completion, the complete edition, another group's work, calculations (R20) */
  for (const h of ["Integrity", "Signatures", "Passages", "Grades", "The bar", "Publication checks", "Presentability", "Completion",
                   "The complete edition", "Another team's work", "Calculations"]) assert.match(SPEC, new RegExp(`\\n\\d+\\. ${h}\\.`), h);
  /* the case document formats it reads, and the product name the complete edition renders by format (DEC-124) */
  for (const w of ["bio-case-document/9", "bio-case-document/8", "bio-case-document/7", "bio-case-document/6", "CivicOS", "Civicsmith"]) assert.ok(named(w), w);
  assert.match(SPEC, /`bio-case-document\/6` document, or an earlier one, renders `CivicOS`, and a `bio-case-document\/7` document renders `Civicsmith`/);
});

for (const v of [V2, V3]) test(`R14 R22 (K2129): ${v} states the kinds /2 adds with their paths, the criteria row's fields, the member's subject, and the check of the standards' use with its codes and words`, () => {
  const SPEC = CC.CASE_FILE_SPECS[v];
  const named = (word) => codeOf(SPEC).has(word);
  /* each kind at the path case-grammar spells it, as the spec writes the path's parts */
  const H = "a".repeat(64), H2 = "b".repeat(64);
  const shown = (p) => p.replace("REF-1", "<ref>").replace(H, "<sha256>").replace(H2, "<sha256>");
  for (const [kind, key] of [["archive", ["REF-1", H]], ["container", ["REF-1", H2]], ["criteria", null]]) {
    const p = CG.caseFilePath(kind, key);
    assert.ok(p, kind);
    assert.ok(SPEC.includes(`\`${kind}\` at \`${shown(p)}\``), `${kind} at ${shown(p)}`);
    assert.deepEqual(CG.caseFileEntryOf(p).kind, kind);
  }
  assert.match(SPEC, /An `archive` or `container` file under a `ref` that carries no `document` departs/);
  assert.match(SPEC, /`criteria` at `criteria\.json`, at most once/);
  assert.ok(SPEC.includes('`stated: "not held"`'));
  /* the criteria row as publication R72 freezes it and public-read R31 serves it */
  for (const w of ["standard", "portion", "designation", "edition", "issuer", "citation", "access", "body", "binds", "passages", "label",
                   "access_words", "content", "text", "free", "reading_room", "paywalled", "subject_entity", "case_conclusions:",
                   "claim", "claim_detail", "case_scope", "statement"]) assert.ok(named(w), w);
  /* rule 12: the three checks by their codes, the words a benchmark-only member never uses, and the unjudged offline arm */
  assert.match(SPEC, /\n12\. Standards' use\./);
  for (const code of CC.STANDARDS_USE_CODES.filter((c) => c !== "MALFORMED")) assert.ok(named(code), code);
  for (const w of CC.NONCONFORMING_WORDS) assert.ok(named(w), w);
  if (v === V2) assert.match(SPEC, /this is not judged offline: each such row is named as not judged for this check/);
  assert.match(SPEC, /it changes no finding's result/);
  /* /2 keeps every rule of /1 */
  for (const h of ["Integrity", "Signatures", "Passages", "Grades", "The bar", "Publication checks", "Presentability", "Completion",
                   "The complete edition", "Another team's work", "Calculations", "Standards' use"]) assert.match(SPEC, new RegExp(`\\n\\d+\\. ${h}\\.`), h);
});

test("R14 R8 R22 (T37; N757, N763; K2206): bio-case-file/3 states the obscured kind at its path with its departures, the materials row's obscured fields, the presentability of a photo carried as its copy, the complete edition's listing of it, and the criteria rows' captures over which the copyrighted arms are judged offline", () => {
  const SPEC = CC.CASE_FILE_SPECS[V3];
  const named = (word) => codeOf(SPEC).has(word);
  const p = CG.caseFilePath("obscured", "REF-1");
  assert.equal(CG.caseFileEntryOf(p).kind, "obscured");
  assert.ok(SPEC.includes(`\`obscured\` at \`${p.replace("REF-1", "<ref>")}\``), p);
  for (const w of ["obscured", "obscured_copy", "obscured_label", "captures", "included: false"]) assert.ok(named(w), w);
  /* the departures case-grammar R13 names */
  assert.match(SPEC, /An `obscured` file no row names, a row naming a copy no file carries at that SHA-256, and, for a row stating `obscured_copy`, a `document`, `extracted_text`, `archive` or `container` file under its `ref` at the original's fingerprints \(the original never travels\) each depart \(rule 1\)/);
  /* the materials row (case-grammar R12): the original's fingerprints stay, the copy and its label */
  assert.match(SPEC, /The row then states `included: false`, and its `sha`, `text_sha`, `origin` and `archived_copy` stay the original's; `obscured_copy` is the SHA-256 of the copy and `obscured_label` the sentence the published case shows beside the material/);
  /* R8: presentable when the copy is carried at its digest, else missing; its label stated in the answer */
  assert.match(SPEC, /\n7\. Presentability\.[^\n]*A row stating `obscured_copy` \(a photo or a member document carried as its copy\) is presentable when the case file carries an `obscured` file at that SHA-256 under its `ref`, whose bytes rule 1 checks; else the copy is missing[^\n]*Its extracted text and the original's bytes are not asked[^\n]*`\{ref, sha, copy, label\}`/);
  /* case-grammar R14: the complete edition lists the copy */
  assert.match(SPEC, /A material carried as its copy \(a photo, or a member document's cleaned copy\) is listed with the original's fingerprint, the copy's fingerprint and its label, word for word, when it has one/);
  /* R22 (N763): the criteria rows' captures, only those the edition carries; a row recorded before them is not judged for COPYRIGHTED_TEXT_CARRIED */
  assert.ok(SPEC.includes("binds, passages, captures, label, access_words}`"));
  assert.match(SPEC, /`captures` is the SHA-256 of each capture holding one of the row's `passages` that the edition's `materials:` lists `included: true`, each once, in the order first met: a capture the edition does not carry is never stated/);
  assert.match(SPEC, /Those captures are its row's `captures`\. A row with no `captures` field \(recorded before them\) is not judged for this check, and its standard is named as not judged for it\./);
  assert.equal(SPEC.includes("this is not judged offline"), false);
  /* /3 keeps every rule of /2 */
  for (const h of ["Integrity", "Signatures", "Passages", "Grades", "The bar", "Publication checks", "Presentability", "Completion",
                   "The complete edition", "Another team's work", "Calculations", "Standards' use"]) assert.match(SPEC, new RegExp(`\\n\\d+\\. ${h}\\.`), h);
});

test("R14 (T39; N806; K2333, K2343): bio-case-file/3 names a member document's cleaned copy beside a photo's copy as material the obscured kind carries in place of its original, at every place it speaks of the copy, with no format change", () => {
  const SPEC = CC.CASE_FILE_SPECS[V3];
  const at = (from, to) => SPEC.slice(SPEC.indexOf(from), SPEC.indexOf(to, SPEC.indexOf(from)));
  /* section 3, the kind: both copies, each said for what it carries */
  const kind = at("- `obscured` at `materials/<ref>/obscured`:", "\n");
  assert.match(kind, /the copy of a material carried in place of its original: a photo's copy, carrying nothing of the original but its pixels, its marked areas, if any, covered solid; or a member document's cleaned copy, every picture in it and the document itself carrying none of their details/);
  assert.match(kind, /at the SHA-256 the material's `materials:` row names as `obscured_copy`/);
  /* section 4, the materials row: a member document travels as its copy, and the case states it for each */
  const row = at("- `materials:`", "\n");
  assert.match(row, /the material travels as its copy, never whole: a photo with the areas a member marked obscured, or a document a member supplied with the details of who made it, and of its pictures, removed/);
  assert.match(row, /A published case states it for every photo it carries and for every member document it carries as its copy/);
  /* rules 3 and 7 speak of the material, not only a photo */
  assert.match(at("\n7. Presentability.", "\n8."), /\(a photo or a member document carried as its copy\)[^\n]*a passage relied on in such material cannot be found/);
  /* nowhere is the obscured kind still a photo's alone */
  for (const old of ["the copy of a photo carried in place of its original", "the photo travels as a copy", "A photo carried as its copy is", "(a photo carried as its copy)", "in such a photo"])
    assert.equal(SPEC.includes(old), false, old);
  /* words only: the format, its kinds and the row's fields are as /3 had them */
  assert.equal(CG.CASE_FILE_FORMAT, V3);
  assert.ok(SPEC.includes("- `format`: `bio-case-file/3`."));
  for (const w of ["obscured", "obscured_copy", "obscured_label"]) assert.ok(codeOf(SPEC).has(w), w);
  for (const v of [V1, V2]) assert.equal(CC.CASE_FILE_SPECS[v].includes("member document"), false, v);
});

test("R14 (T40; N798; DEC-185 (1); K2394): bio-case-file/3 names an unmarked photo's copy as labeled (published), told from a marked one by obscured_marked, by its label when absent, with no format change", () => {
  const SPEC = CC.CASE_FILE_SPECS[V3];
  const row = SPEC.slice(SPEC.indexOf("- `materials:`"), SPEC.indexOf("\n", SPEC.indexOf("- `materials:`")));
  /* every photo a case carries is labeled: a marked copy obscured, an unmarked copy published, a member document cleaned */
  assert.match(row, /a member document's copy is labeled cleaned, a photo's copy with marked areas covered is labeled obscured, and an unmarked photo's copy \(nothing covered, no metadata\) is labeled published, so every photo a case carries is labeled/);
  /* obscured_marked tells them apart, and a row without it is read by its label */
  assert.ok(codeOf(SPEC).has("obscured_marked"));
  assert.match(row, /The row may also state `obscured_marked`, whether the photo's copy covers areas a member marked, which tells a marked copy from an unmarked one; a row without it is read by its label \(a label stated, marked; none, unmarked, as in an edition signed before unmarked copies were labeled\)/);
  /* negative control: the words that an unmarked copy has no label are gone */
  assert.equal(SPEC.includes("an unmarked photo's copy has none"), false);
  /* words only: the format and the versions held are as before; /1 and /2 say nothing of it */
  assert.equal(CG.CASE_FILE_FORMAT, V3);
  assert.deepEqual(CC.CASE_FILE_SPEC_VERSIONS, [V1, V2, V3, V4]);
  for (const v of [V1, V2]) assert.equal(CC.CASE_FILE_SPECS[v].includes("obscured_marked"), false, v);
});

test("R14 (K3261; DEC-221): every specification held spells the word as labeled, never labelled", () => {
  for (const v of CC.CASE_FILE_SPEC_VERSIONS) assert.equal(/labell/i.test(CC.CASE_FILE_SPECS[v]), false, v);
  /* control: /3 still states its labels, in the one spelling */
  assert.match(CC.CASE_FILE_SPECS[V3], /is labeled published/);
});

test("R15 (DEC-149): at start the module registers casechecker and casefilespec with public-read, credential-free; a second registration is refused", async () => {
  const pr = new PublicRead({ storage: { sql: null }, publication: null, docket: null });
  const host = {};
  const answer = CC.registerCaseCheckerPublicReads(host, { publicRead: pr });
  assert.deepEqual(answer, { ok: true, module: "case-checker", names: ["casechecker", "casefilespec"] });
  assert.equal(CC.registerCaseCheckerPublicReads(host, { publicRead: pr }), answer);   /* once per host */
  assert.deepEqual(pr.publicReads(), [{ name: "casechecker", module: "case-checker", params: [] },
                                      { name: "casefilespec", module: "case-checker", params: ["version"] }]);
  const program = pr.publicRead("casechecker", { token: "secret", viewer: "x" });
  assert.equal(program.ok, true);
  assert.equal(program.result.program, CC.caseCheckerProgramText().text);
  assert.equal(program.result.sha256, CC.caseCheckerProgramText().sha256);
  for (const v of [V1, V2, V3, V4]) {
    const spec = pr.publicRead("casefilespec", { version: v });
    assert.deepEqual([spec.ok, spec.result.held, spec.result.version, spec.result.text, spec.result.versions], [true, true, v, CC.CASE_FILE_SPECS[v], [V1, V2, V3, V4]]);
  }
  /* an unknown or absent version is answered with the versions held */
  for (const q of [{ version: "bio-case-file/9" }, {}]) {
    const r = pr.publicRead("casefilespec", q);
    assert.equal(r.ok, true);
    assert.equal(r.result.held, false);
    assert.deepEqual(r.result.versions, [V1, V2, V3, V4]);
    assert.equal("text" in r.result, false);
  }
  /* DEC-149 (T34-87; K1821): the reader has no credential, so the detail speaks of this group's Civicsmith, never "this copy" */
  const unknown = pr.publicRead("casefilespec", { version: "bio-case-file/9" }).result.detail;
  const held = CC.CASE_FILE_SPEC_VERSIONS;
  assert.equal(unknown, W("case-checker.index.holds_several", { reason: W("case-checker.index.no_specification"), head: held.slice(0, -1).join(", "), last: held.at(-1) }));
  assert.equal(CC.caseFileSpec(null).detail, W("case-checker.index.holds_several", { reason: W("case-checker.index.no_version_named"), head: held.slice(0, -1).join(", "), last: held.at(-1) }));
  assert.equal(/this (copy|plane|instance)/.test(unknown + CC.caseFileSpec(null).detail), false);
  /* another module cannot take the names */
  const again = new PublicRead({ storage: { sql: null } });
  again.registerPublicReads("someone-else", { casechecker: () => 1 });
  assert.equal(CC.registerCaseCheckerPublicReads({}, { publicRead: again }).reason, "PROVIDER_DECLARED");
});

test("R17: no place is named in this module's behaviour or outward text", async () => {
  const outward = JSON.stringify([
    Object.fromEntries(Object.entries(CC).filter(([k, v]) => typeof v !== "function")),
    CC.CHECKS_VERSION_STATEMENT("1.0.0", "2.0.0"), CC.caseFileSpec("x"), await CC.checkCaseFile({ parts: [] }),
    await CC.runProgram([], async () => null),
  ]);
  for (const place of ["Oakland", "California", "Alameda", "Berkeley", "San Francisco", "Sacramento", "Brown Act", "CPRA",
                       "United States", "County", "City of"])
    assert.equal(outward.includes(place), false, `names ${place}`);
});
