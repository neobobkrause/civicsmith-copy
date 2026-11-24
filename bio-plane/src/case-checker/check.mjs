/* case-checker — the one checker of a case file (requirements: `build/requirements/case-checker.md` R1–R12, R16–R18, R20, R22;
 * DEC-112 (3)(5)(6); `BIO_Publication_v0_1.md` §5C).
 *
 * `checkCaseFile({parts, documents?, keys?, lens?})` reads a case file's parts and recreates each finding from what they carry:
 * the integrity of every part and file (R2), the signatures and attestations (R3), the passages (R4), each grade
 * recomputed at the stated method version (R5), the bar (R6), the publication checks (R7), presentability (R8),
 * completion by documents supplied later (R9), the complete edition (R10) and each calculation recomputed by
 * `calc-grammar`'s evaluator (R20), composed into one result per finding (R11); beside them, how the case uses the
 * standards it measures against, judged offline over a carried `criteria` file (R22, through R21); the account's sentences
 * judged against what they cite (R24, `./account.mjs`); and each finding's pair under the lens asked for (R23,
 * `./lens.mjs`). It is built only from
 * pure code: `case-grammar`'s format, `case-catalogue`'s case-document checks (`checks.mjs`), `strength`'s method
 * (`method.mjs`), `content`'s extent grammar, `signatures`' verifier, `calc-grammar`'s evaluator, `answers`' sentence
 * checks (`sentences.mjs`) and this module's R21,
 * so the standalone program (R13) is this file and those, bundled. It reads nothing but its arguments, writes nothing, makes
 * no request and never throws (R1, R16); it answers a promise because a signature is verified by WebCrypto.
 *
 * Recreating shows a case intact and consistent, never true (R12): no answer composes a case-level strength, a single
 * verdict or an endorsement. Pairs are per finding and per axis. No place is named in this module's text (R17). */

import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { createSha256, b64ToBytes } from "../record-grammar/sha256.mjs";
import { GRADE_AXES } from "../record-grammar/grades.mjs";
import { verifySshsig, ratifyStatement, caseRatifyStatement, captureAccountStatement, NS_RATIFY, normalizeKey,
         parseSshsig } from "../sshsig.mjs";
import { contentIdFor, extentRelation } from "../content/extent.mjs";
import { recomputePair, GRADING_METHOD_VERSIONS } from "../strength/method.mjs";
import { checkCaseDocument } from "../case-catalogue/checks.mjs";
import { caseFileManifestCheck, caseFileEntryOf, casePartDigest, CASE_FILE_MANIFEST_PATH, methodOf, materialsOf,
         acceptedWorkOf, standingOf, completeEditionOf, gradingFactsOf, passagesOf, GRADING_FACT_FIELDS,
         PASSAGE_FIELDS, calculationsOf, calculationFileText, provOf, CASE_FILE_PROV_PATH, lensOf, accountOf,
         biasApplicationsOf } from "../case-grammar/index.mjs";
import { evaluate, resultKey, METHOD as CALC_METHOD } from "../calc-grammar/index.mjs";
import { CATALOG_VERSION } from "../gate.mjs";
import { readStoredZip, asBytes } from "./zip.mjs";
import { checkStandardsUse } from "./standards.mjs";
import { checkAccount, listOfField, citeOf } from "./account.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { LENS_LIMIT_STATEMENT, lensOfArg, applicationOf, pairsUnderLens } from "./lens.mjs";

/* ============================================================ the words (R1, R11, R18; the UX stream's, until it gives them) */

/** R1: the sentence every answer carries (R27: the design's words, read by key). */
export const RECREATION_STATEMENT = word("case-checker.recreation_statement");
/** R18: the sentence beside the findings another group published that a finding rests on. */
export const REST_ON_ANOTHER_GROUP_STATEMENT = word("case-checker.rest_on_another_group_statement");
/** R3: the sentence an answer carries when no published keys were given. */
export const KEYS_NOT_CHECKED_STATEMENT = word("case-checker.keys_not_checked_statement");
/** R7: the sentence when the stated catalogue version is not this checker's. */
export const CHECKS_VERSION_STATEMENT = (stated, own) => word("case-checker.text.publication_checks_ran",
  { own, stated: stated === null || stated === undefined ? localize("case-checker.check.none", "none") : String(stated) });

/** R20 (K1448): the sentence beside a calculation this checker does not recompute (a workbook, or a value from a third
 *  party's engine). */
export const NOT_RECOMPUTED_STATEMENT = word("case-checker.not_recomputed_statement");
/** R20: the three answers for a calculation. */
export const CALCULATION_RESULTS = Object.freeze(["agrees", "differs", "not_recomputed"]);

/** R1: the three results. */
export const RESULTS = Object.freeze(["recreated", "recreated_in_part", "did_not_recreate"]);
/** R13: each result in words, as the standalone program prints it (the design's words, read by key). */
export const RESULT_WORDS = Object.freeze({ recreated: word("screen.imported.result.yes"),
  recreated_in_part: word("screen.imported.result.part"), did_not_recreate: word("screen.imported.result.no") });
/** R1: the checker's versions, stated in every answer. */
export const CHECKER_VERSIONS = Object.freeze({ grading_versions: [...GRADING_METHOD_VERSIONS], checks_version: CATALOG_VERSION,
                                                calc_versions: [CALC_METHOD] });
const versionsOut = () => ({ ...CHECKER_VERSIONS, grading_versions: [...CHECKER_VERSIONS.grading_versions],
                             calc_versions: [...CHECKER_VERSIONS.calc_versions] });

/* R3: the account statement a capturing member signs is `signatures.captureAccountStatement` (its R41), the one
   spelling `capture` signs and checks too (N530); it is pure, so the standalone program carries it. Stated in this
   module's readable specification (R14). `accountStatement` is that very function, kept under its earlier name. */
export const accountStatement = captureAccountStatement;
const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: false });

/* ============================================================ small pure helpers */

const HEX64 = /^[0-9a-f]{64}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v : null);
const shaOf = (bytes) => createSha256().update(bytes).hex();
const textOf = (bytes) => (bytes ? td.decode(bytes) : null);
const jsonOf = (bytes) => { try { return bytes ? JSON.parse(td.decode(bytes)) : null; } catch { return undefined; } };
const b64 = (bytes) => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < bytes.length ? A[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? A[n & 63] : "=");
  }
  return out;
};

/** An entry of `missing[]` or `differs[]` (R11): which check, what it is about, and a sentence a reader can act on. */
const entry = (check, about, detail, more = {}) => ({ check, about, ...more, detail });

const NOTHING = () => localize("case-checker.check.nothing", "nothing");
/** R9, R11: what a reader does to supply a material: "fetch the document whose SHA-256 is …, from … (archived at …)". */
const fetchMaterial = (mat, kind) => localize("case-checker.check.fetch_material", "fetch the {kind} whose SHA-256 is {sha}",
  { kind: kind === "observation" ? localize("case-checker.check.kind_observation", "observation") : localize("case-checker.check.kind_document", "document"),
    sha: String(mat.sha) })
  + (mat.origin ? `, ${localize("case-checker.check.from_origin", "from {origin}", { origin: mat.origin })}` : "")
  + (mat.archived_copy ? ` (${localize("case-checker.check.archived_at", "archived at {copy}", { copy: mat.archived_copy })})` : "");

/* ============================================================ the case file read (R1, R2, R9) */

/** The SSH fingerprint of a wire key (`SHA256:` and the unpadded base64 of its digest), as `ssh-keygen -l` prints it. */
export function keyFingerprint(keyB64) {
  try { return "SHA256:" + b64(asBytes(hexBytes(shaOf(b64ToBytes(keyB64))))).replace(/=+$/, ""); } catch { return null; }
}
function hexBytes(hex) { const o = new Uint8Array(hex.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16); return o; }

const entryOf = (path) => { const e = caseFileEntryOf(path); return isObj(e) ? e : null; };
const departureWords = (d) => (typeof d === "string" ? d : isObj(d) && (d.detail || d.message)
  ? `${d.at ? `${d.at}: ` : ""}${String(d.detail || d.message)}` : canonicalJson(d));

/** R19: the one reader of a case file. `parts` are the parts' bytes (`public-read` R6's stored ZIPs). Answers
 *  `{manifest, files: [{path, kind, sha256, bytes, content, state, part, finding, ref}], departures}`: `manifest` the
 *  parsed manifest (the same in every part), or null; each file the manifest lists, `content` its bytes when it is
 *  carried and matches its row, else null, and `state` one of `intact`, `missing` or `differs` (`finding` and `ref` read
 *  from its path by `case-grammar`'s `caseFileEntryOf`); `departures` every way the parts depart from `case-grammar`
 *  R13, each a sentence. Pure; never throws. */
export function readCaseFile(parts) {
  try { return readParts(parts); }
  catch (e) { return { manifest: null, files: [], departures: [word("case-checker.departures", { e: String(e && e.message ? e.message : e).slice(0, 200) })], parts: [] }; }
}

function readParts(parts) {
  const departures = [];
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) departures.push(word("case-checker.push.part_case_file"));
  const zips = [];
  list.forEach((p, i) => {
    const z = readStoredZip(p);
    const given = (problem) => localize("case-checker.check.part_given_problem", "part {given} given: {problem}", { given: i + 1, problem });
    if (!z.ok) { departures.push(given(z.problem)); return; }
    for (const pr of z.problems) departures.push(given(pr));
    zips.push({ given: i + 1, entries: z.entries });
  });
  const mpath = CASE_FILE_MANIFEST_PATH;
  let manifestText = null;
  for (const z of zips) {
    const mb = z.entries.get(mpath);
    if (!mb) { departures.push(word("case-checker.push.part_given_carries", { given: z.given, mpath })); continue; }
    const t = textOf(mb);
    if (manifestText === null) manifestText = t;
    else if (t !== manifestText) departures.push(word("case-checker.push.part_given_carries_manifest", { given: z.given }));
  }
  let manifest = null;
  if (manifestText !== null) {
    try { manifest = JSON.parse(manifestText); } catch { departures.push(word("case-checker.push.manifest_json")); }
    if (manifest !== null && !isObj(manifest)) { departures.push(word("case-checker.push.manifest_json_object")); manifest = null; }
  }
  const manifestAt = departures.length;     /* the manifest's own departures are named here, once the files are read */
  const m = manifest || {};
  const listedParts = Array.isArray(m.parts) ? m.parts.filter(isObj) : [];
  const files = (Array.isArray(m.files) ? m.files.filter(isObj) : []).map((f) => {
    const e = entryOf(f.path) || {};
    return { path: str(f.path) || "", kind: str(f.kind) || "", sha256: str(f.sha256) || "",
             bytes: Number.isSafeInteger(f.bytes) ? f.bytes : null, content: null, state: "missing",
             part: Number.isSafeInteger(f.part) ? f.part : null, finding: str(e.finding), ref: str(e.ref), capture: str(e.capture),
             calc: str(e.calc), input: str(e.input), detail: null };
  });
  /* Which given ZIP is which listed part: the one carrying every file the manifest puts in it. */
  const partOf = new Map();
  for (const lp of listedParts) {
    const rows = files.filter((f) => f.part === lp.index);
    const z = zips.find((zz) => rows.length > 0 && rows.every((f) => zz.entries.has(f.path)) && ![...partOf.values()].includes(zz))
      || zips.find((zz) => rows.some((f) => zz.entries.has(f.path)) && ![...partOf.values()].includes(zz));
    if (z) partOf.set(lp.index, z);
  }
  const partStates = listedParts.map((lp) => {
    const z = partOf.get(lp.index);
    const rows = files.filter((f) => f.part === lp.index);
    if (!z) return { index: lp.index, sha256: str(lp.sha256), state: "missing" };
    if (!rows.every((f) => z.entries.has(f.path))) return { index: lp.index, sha256: str(lp.sha256), state: "incomplete" };
    const carried = rows.map((f) => { const b = z.entries.get(f.path); return { path: f.path, sha256: shaOf(b), bytes: b.length, part: lp.index }; });
    const d = casePartDigest(carried, lp.index);
    const ok = d.sha256 === lp.sha256 && d.bytes === lp.bytes;
    return { index: lp.index, sha256: str(lp.sha256), state: ok ? "intact" : "differs" };
  });
  for (const f of files) {
    const z = f.part !== null ? partOf.get(f.part) : null;
    const b = z ? z.entries.get(f.path) : null;
    if (!b) continue;
    const sha = shaOf(b);
    if (sha !== f.sha256 || b.length !== f.bytes) {
      f.state = "differs";
      f.detail = localize("case-checker.check.file_differs_manifest", "{path} does not match the manifest: it has SHA-256 {sha} and {bytes} bytes, where the manifest lists {listed_sha} and {listed_bytes} bytes",
        { path: f.path, sha, bytes: b.length, listed_sha: f.sha256, listed_bytes: String(f.bytes) });
    } else { f.state = "intact"; f.content = b; }
  }
  /* A part whose files differ is answered by those files' own entries, for the findings that need them; only a part
     whose every file matches its row and still does not recompute its listed fingerprint departs as a whole. */
  for (const ps of partStates) if (ps.state === "differs" && files.filter((f) => f.part === ps.index).every((f) => f.state === "intact"))
    departures.push(word("case-checker.push.part_files_recompute", { index: String(ps.index), sha256: String(ps.sha256) }));
  const listedNames = new Set(files.map((f) => f.path));
  for (const z of zips) for (const name of z.entries.keys())
    if (name !== mpath && !listedNames.has(name)) departures.push(word("case-checker.push.part_given_carries_manifest_list", { given: z.given, name }));
  /* `case-grammar` R13: the manifest's departures, those relative to the case document's `materials:` rows (an
     `obscured` copy and its row) among them when the case document is carried as the manifest lists it. */
  if (manifest) {
    const named = caseFileManifestCheck(manifest, { materials: carriedMaterials(files) });
    departures.splice(manifestAt, 0, ...(Array.isArray(named) ? named : []).map(departureWords));
  }
  return { manifest, files, departures, parts: partStates };
}

/** G50: whether a file's path states no capture, or the capture whose SHA-256 is `sha` (both compared in lower case). */
const ownsCapture = (f, sha) => f.capture === null || f.capture === lowerSha(sha);
const lowerSha = (v) => (typeof v === "string" ? v.toLowerCase() : null);

/* The case document's `materials:` rows (`case-grammar` R12), read from the carried case document when it is the bytes
   the manifest lists; null otherwise, so only what the manifest alone shows is checked. */
function carriedMaterials(files) {
  const doc = files.find((f) => f.kind === "case_document" && f.content);
  if (!doc) return null;
  const p = parseFrontmatter(textOf(doc.content));
  const read = isObj(p.data) ? materialsOf(p.data) : null;
  return isObj(read) && Array.isArray(read.materials) ? read.materials.filter(isObj) : null;
}

/** R8 (`case-grammar` R12's `obscured`): the copy a material row travels as, `{copy, label}`, or null. */
const obscuredOf = (mat) => (isObj(mat) && isObj(mat.obscured) && typeof mat.obscured.copy === "string" ? mat.obscured : null);

/* ============================================================ the chain a finding rests on */

/* One finding's grading facts, as `strength` R35 answers them and R32 reads them: `{legs, levels?}`. */
/* Two lists of rows say the same: each row's `fields` (but `finding` and `ord`, which the file's place states), a field
   absent read as null and a list or map field as its value, compared as canonical JSON. */
const rowsKey = (list, fields) => canonicalJson(list.map((r) => {
  const x = factFields(isObj(r) ? r : {});
  return Object.fromEntries(fields.filter((f) => f !== "finding" && f !== "ord").map((f) => [f, x[f] === undefined ? null : x[f]]));
}));
const sameRows = (a, b, fields) => rowsKey(a, fields) === rowsKey(b, fields);
/* A leg's list and map fields, carried in the document's flat rows as canonical JSON in one value (`case-grammar` R17),
   read back as values; a field already a value is kept. */
const factFields = (leg) => {
  if (!isObj(leg)) return leg;
  const out = { ...leg };
  for (const k of ["answer", "origins", "captures", "another_groups", "extent", "chain"])
    if (typeof out[k] === "string" && /^[[{]/.test(out[k])) { try { out[k] = JSON.parse(out[k]); } catch { /* kept as given */ } }
  return out;
};

/* ============================================================ the passages (R4) */

/** R4: the text at an extent of a document's carried extracted text. The extracted text is `case-grammar`'s one
 *  spelling (its R17, `extractedTextOf`): the canonical JSON of the reading's units, each `{extent, ref, text}`. The text
 *  at an extent is every unit's text whose extent overlaps it by `content.extentRelation` (the same place, one inside
 *  the other), in the units' order; null when no unit does or the text is not that spelling. */
export function textAtExtent(extracted, extent) {
  let units;
  try { units = JSON.parse(extracted); } catch { return null; }
  if (!Array.isArray(units)) return null;
  const e = isObj(extent) ? extent : { kind: "document" };
  const hit = units.filter((u) => isObj(u) && typeof u.text === "string" && isObj(u.extent)
    && ["same", "narrower", "wider"].includes(extentRelation(u.extent, e)));
  return hit.length ? hit.map((u) => u.text).join("\n") : null;
}
const squash = (s) => String(s).replace(/\s+/g, " ").trim();

/* ============================================================ the answer */

/** R1: check a case file. Never throws; answers the whole answer, a malformed input included. */
export async function checkCaseFile(args) {
  try { return await check(isObj(args) ? args : {}); }
  catch (e) {
    return malformed([localize("case-checker.check.input_unreadable", "the check could not read this input: {error}", { error: String(e && e.message ? e.message : e).slice(0, 200) })], null);
  }
}

/* R1: malformed input names each departure, and every finding it can name does not recreate. */
function malformed(departures, manifest) {
  const m = isObj(manifest) ? manifest : {};
  const members = Array.isArray(m.files) ? [...new Set(m.files.filter((f) => isObj(f) && f.kind === "finding" && typeof f.finding === "string").map((f) => f.finding))] : [];
  return {
    format: str(m.format), case: str(m.case), edition: Number.isInteger(m.edition) ? m.edition : null, group: str(m.group),
    checker: versionsOut(),
    integrity: { intact: false, departures, parts: [], files: [], documents: { used: [], unmatched: [], wanted: [] } },
    signatures: { case: null, findings: [], attestations: [], keys_checked: false, keys_statement: KEYS_NOT_CHECKED_STATEMENT },
    publication_checks: { ran: false, findings: [], unasked: [], stated_version: null, checker_version: CATALOG_VERSION, statement: null },
    calculations: [], standards_use: null, obscured: [], account: null,
    lens: { name: "as_published", statements: null, departure: null, not_applied: [] }, lens_statement: LENS_LIMIT_STATEMENT,
    findings: members.map((f) => ({ finding: f, role: null, result: "did_not_recreate", missing: [],
      differs: departures.map((d) => entry("integrity", "case file", d)), pair: null, bar_met: null })),
    complete_edition: { equal: null, detail: localize("case-checker.check.edition_not_compared", "the case file could not be read, so its complete edition was not compared") },
    rests_on_another_group: [], rests_on_another_group_statement: REST_ON_ANOTHER_GROUP_STATEMENT,
    statement: RECREATION_STATEMENT,
  };
}

async function check({ parts, documents = [], keys = null, lens: lensArg = undefined }) {
  const lens = lensOfArg(lensArg);
  const parentDiffers = {};    // finding → entries from the findings it rests on (R5)
  const read = readCaseFile(parts);
  if (!read.manifest) return malformed(read.departures, read.manifest);
  const m = read.manifest;
  const files = read.files;
  const caseLevel = { missing: [], differs: [] };
  for (const d of read.departures) caseLevel.differs.push(entry("integrity", "case file", d));
  for (const f of files) if (f.state === "differs") f.entry = entry("integrity", f.path, f.detail, { sha256: f.sha256 });

  /* R9: bytes supplied later fill a gap when their SHA-256 is a missing file's recorded fingerprint, or a calculation
     input's stated SHA-256 that the case file lacks (R20 settles that below, so which documents were used is answered
     after the calculations). */
  const supplied = [];
  for (const d of Array.isArray(documents) ? documents : []) {
    const b = asBytes(d);
    if (!b) { supplied.push({ sha: null, bytes: null, used: false }); continue; }
    const doc = { sha: shaOf(b), bytes: b, used: false };
    supplied.push(doc);
    for (const g of files.filter((f) => f.state === "missing" && f.sha256 === doc.sha)) { g.state = "supplied"; g.content = b; doc.used = true; }
  }
  const fileOf = (kind, key, value) => files.find((f) => f.kind === kind && (key === null || f[key] === value)) || null;
  /* G50 (R2, R8, R19): the file of a material row. Under `bio-case-file/4` a `ref` on several rows has one file of each kind
     for each row, at a path that states the row's capture, so a file that states one belongs to the row whose `sha` it
     names (compared in lower case); a file that states none (every path of `/1`-`/3`, and a one-row `ref` of `/4`) is read
     by its `ref`, as it always was. */
  const fileOfMaterial = (kind, mat) => files.find((f) => f.kind === kind && f.ref === mat.ref && ownsCapture(f, mat.sha)) || null;
  const filesOf = (kind) => files.filter((f) => f.kind === kind);

  /* The case document and its front matter. */
  const docFile = fileOf("case_document", null);
  const docText = docFile && docFile.content ? textOf(docFile.content) : null;
  let fm = null, body = null;
  if (docText !== null) {
    const p = parseFrontmatter(docText);
    fm = isObj(p.data) ? p.data : null;
    body = typeof p.body === "string" ? p.body : null;
    if (!fm) caseLevel.differs.push(entry("integrity", docFile.path, localize("case-checker.check.no_front_matter", "the case document carries no front matter this checker can read")));
  }
  const docSha = docFile && docFile.content ? docFile.sha256 : null;
  if (!docFile) caseLevel.differs.push(entry("integrity", "case document", localize("case-checker.check.manifest_lists_no_case_document", "the manifest lists no case document")));
  else if (docFile.state === "missing") caseLevel.missing.push(entry("integrity", docFile.path, localize("case-checker.check.case_document_not_carried_fetch", "the case document is not carried; fetch the file whose SHA-256 is {sha}", { sha: docFile.sha256 }), { sha256: docFile.sha256 }));
  else if (docFile.entry) caseLevel.differs.push(docFile.entry);
  if (docSha && str(m.case_document_sha) && docSha !== m.case_document_sha)
    caseLevel.differs.push(entry("integrity", "case document", localize("case-checker.check.case_document_sha_differs", "the case document's SHA-256 is {sha}, where the manifest names {named}", { sha: docSha, named: m.case_document_sha })));
  if (fm && str(m.case) && fm.case_id !== m.case)
    caseLevel.differs.push(entry("integrity", "case document", localize("case-checker.check.case_document_names_case", "the case document names case {case}, where the manifest names {named}", { case: String(fm.case_id), named: m.case })));
  if (fm && Number.isInteger(m.edition) && fm.case_edition !== m.edition)
    caseLevel.differs.push(entry("integrity", "case document", localize("case-checker.check.case_document_names_edition", "the case document names edition {edition}, where the manifest names {named}", { edition: String(fm.case_edition), named: m.edition })));

  const method = fm ? methodOf(fm) : null;
  const materialsRead = fm ? materialsOf(fm) : null;
  const materials = isObj(materialsRead) && Array.isArray(materialsRead.materials) ? materialsRead.materials.filter(isObj) : [];
  const attestations = isObj(materialsRead) && Array.isArray(materialsRead.attestations) ? materialsRead.attestations.filter(isObj) : [];
  const grading = gradingContextOf(fm);
  const { acceptedRows } = grading;

  /* The roster and its roles, as the signed document states them. */
  const roster = fm && Array.isArray(fm.case_findings) ? fm.case_findings.map(String) : [];
  const roleRows = fm && Array.isArray(fm.case_roles) ? fm.case_roles.filter(isObj) : [];
  const roleOf = new Map(roleRows.map((r) => [String(r.target ?? ""), r]));

  /* ---------------------------------------------------------- R3: signatures */
  const manifestKeys = (Array.isArray(m.keys) ? m.keys : []).filter(isObj).map((k) => ({ key: normalizeKey(k.key), fingerprint: str(k.fingerprint) }));
  for (const k of manifestKeys) if (k.key && k.fingerprint && keyFingerprint(k.key) !== k.fingerprint)
    caseLevel.differs.push(entry("signature", "signing keys", localize("case-checker.check.key_fingerprint_differs", "the case file lists a key whose fingerprint is {fingerprint}, beside the fingerprint {listed}", { fingerprint: String(keyFingerprint(k.key)), listed: k.fingerprint })));
  const allowed = manifestKeys.map((k) => k.key).filter(Boolean);
  const published = Array.isArray(keys) ? keys.map((k) => normalizeKey(isObj(k) ? k.key : k)).filter(Boolean) : null;
  const keyFacts = (keyB64) => ({ key_fingerprint: keyB64 ? keyFingerprint(keyB64) : null,
    listed_in_case_file: keyB64 ? allowed.includes(keyB64) : null,
    ...(published ? { among_published_keys: keyB64 ? published.includes(keyB64) : null } : {}) });
  const embedded = (armored) => { try { return parseSshsig(armored).pubB64; } catch { return null; } };
  const sigWords = (v) => (v.ok ? localize("case-checker.check.verifies", "verifies") : v.reason === "UNKNOWN_KEY" ? word("case-checker.text.made_key_case")
    : v.reason === "BAD_SIGNATURE" ? word("case-checker.text.verify_over_signs") : v.reason === "NAMESPACE" ? word("case-checker.text.made_purpose")
    : word("case-checker.text.read_signature"));
  async function verifyOver(armored, message) {
    const v = await verifySshsig(armored, message, NS_RATIFY, allowed);
    const key = v.keyB64 || embedded(armored);
    const pubOk = published && key ? published.includes(key) : true;
    return { verified: v.ok === true && pubOk, reason: v.ok ? (pubOk ? null : "NOT_PUBLISHED_KEY") : v.reason, ...keyFacts(key),
             words: v.ok && !pubOk ? localize("case-checker.check.not_published_key", "was made with a key that is not among the team's published keys") : sigWords(v) };
  }

  const sigCase = { file: null, verified: false, reason: null };
  const caseSig = fileOf("case_signature", null);
  if (!caseSig) caseLevel.differs.push(entry("signature", "case document", localize("case-checker.check.no_case_signature", "the case file carries no signature of the case document, so nobody can be shown to have signed it")));
  else if (!caseSig.content) {
    if (caseSig.state === "missing") caseLevel.missing.push(entry("signature", caseSig.path, localize("case-checker.check.case_signature_not_carried_fetch", "the case document's signature is not carried; fetch the file whose SHA-256 is {sha}", { sha: caseSig.sha256 }), { sha256: caseSig.sha256 }));
    else caseLevel.differs.push(caseSig.entry);
  } else if (fm && docSha) {
    const v = await verifyOver(textOf(caseSig.content), caseRatifyStatement(fm.case_id, fm.case_edition, docSha));
    Object.assign(sigCase, { file: caseSig.path, ...v });
    if (!v.verified) caseLevel.differs.push(entry("signature", "case document",
      localize("case-checker.check.case_signature_says", "the case document's signature {words}", { words: v.words })));
  }

  /* ---------------------------------------------------------- the findings and their chains */
  const findingIds = [];
  const addFinding = (id) => { if (id && !findingIds.includes(id)) findingIds.push(id); };
  for (const id of roster) addFinding(id);
  const facts = new Map();       // finding → grading facts, or undefined when unreadable
  const reachedBy = new Map();   // finding → [parent findings]
  const restsOn = [];
  const legAnswers = new Map();  // finding → [{from, answer}] (a leg's stated answer for a finding it rests on)
  /* The grading facts and passages the signed document states (`case-grammar` R17) are what recomputation reads; a
     finding's carried file (R13) must say the same, since only the document is signed. Without the blocks (a document
     that predates them), the files are read. */
  const signedFacts = fm ? gradingFactsOf(fm) : null;
  const signedPassages = fm ? passagesOf(fm) : null;
  const factsDiffer = new Set(), passagesDiffer = new Set();
  const listOf = (raw, key) => (Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw[key]) ? raw[key] : null);
  for (let i = 0; i < findingIds.length; i++) {
    const id = findingIds[i];
    const gf = fileOf("grading_facts", "finding", id);
    const raw = gf && gf.content ? jsonOf(gf.content) : null;
    const fileLegs = raw === undefined ? undefined : raw === null ? null : listOf(raw, "legs") ?? undefined;
    let fx;
    if (signedFacts) {
      const docLegs = signedFacts[id] || [];
      fx = { legs: docLegs };
      if (Array.isArray(fileLegs) && !sameRows(fileLegs, docLegs, GRADING_FACT_FIELDS)) factsDiffer.add(id);
      if (fileLegs === undefined) factsDiffer.add(id);
    } else fx = fileLegs === undefined ? undefined : fileLegs === null ? null : { legs: fileLegs };
    facts.set(id, fx);
    for (const leg of fx ? fx.legs.filter(isObj) : []) {
      const target = str(leg.target);
      if (leg.kind === "inquiry" && target) {
        addFinding(target);
        reachedBy.set(target, [...(reachedBy.get(target) || []), id]);
        if (isObj(leg.answer)) legAnswers.set(target, [...(legAnswers.get(target) || []), { from: id, answer: leg.answer }]);
      }
    }
  }
  /* The materials a finding's chain reaches, through the findings it rests on (cycle-safe), and the imported legs. */
  /* G47: with several captures of one source (all of one `ref`), a leg that names captures reaches those, not the first
     material of the ref; a leg that names none of them reaches the first material of its ref, as before. */
  const materialsOfLeg = (leg) => {
    const ofRef = materials.filter((x) => x.ref === leg.target);
    const named = ofRef.filter((x) => Array.isArray(leg.captures) && leg.captures.includes(x.sha));
    if (named.length) return named;
    if (ofRef.length) return ofRef.slice(0, 1);
    return materials.filter((x) => Array.isArray(leg.captures) && leg.captures.includes(x.sha)).slice(0, 1);
  };
  function chainOf(id, seen = new Set()) {
    if (seen.has(id)) return { mats: [], refs: [], unlisted: [], calcs: [] };
    seen.add(id);
    const out = { mats: [], refs: [], unlisted: [], calcs: [] };
    const fx = facts.get(id);
    for (const leg of fx ? fx.legs.filter(isObj) : []) {
      if (leg.kind === "imported") { out.refs.push({ from: id, leg }); continue; }   /* R18: not followed past */
      if (leg.kind === "inquiry") { const c = chainOf(String(leg.target ?? ""), seen); out.mats.push(...c.mats); out.refs.push(...c.refs); out.unlisted.push(...c.unlisted); out.calcs.push(...c.calcs); continue; }
      if (leg.kind === "calculation") { const t = String(leg.target ?? ""); if (!out.calcs.includes(t)) out.calcs.push(t); continue; }   /* R20 */
      if (leg.kind === "document" || leg.kind === "observation") {
        const mats = materialsOfLeg(leg);
        if (mats.length) { for (const mat of mats) if (!out.mats.includes(mat)) out.mats.push(mat); }
        else out.unlisted.push({ from: id, target: String(leg.target ?? ""), kind: leg.kind });
      }
    }
    return out;
  }

  /* ---------------------------------------------------------- R3: the attestations, by kind */
  const accountRows = fm && Array.isArray(fm.capture_accounts) ? fm.capture_accounts.filter(isObj) : [];
  const attestationAnswers = [];
  /* R3 (G47): a row that states a capture's `sha` is joined to that capture's material and keyed by (ref, sha), so with
     several captures of one source a failure of one is reported against it alone; a row without `sha` (an earlier
     document) is joined and keyed by `ref` as before, and reaches every material of that ref. */
  const attestKey = (ref, sha) => (sha ? `${ref}\u0000${sha}` : ref);
  const attestationFails = new Map();   // attestKey → [entry]
  const attestationGaps = new Map();
  const attestationsOf = (map, mat) => [...(map.get(mat.ref) || []), ...(mat.sha ? map.get(attestKey(mat.ref, mat.sha)) || [] : [])];
  for (const row of attestations) {
    const ref = str(row.ref) || "";
    const rowSha = str(row.sha);
    const key = attestKey(ref, rowSha);
    const mat = (rowSha ? materials.find((x) => x.ref === ref && x.sha === rowSha) : materials.find((x) => x.ref === ref)) || null;
    const a = { ref, ...(rowSha ? { sha: rowSha } : {}), by_kind: str(row.by_kind), by: row.level === "group" || row.level === "project" ? null : str(row.by), state: "checked", detail: null };
    const fail = (detail) => { a.state = "fails"; a.detail = detail; attestationFails.set(key, [...(attestationFails.get(key) || []), entry("signature", ref, detail, rowSha ? { sha256: rowSha } : {})]); };
    const gap = (detail) => { a.state = "not_carried"; a.detail = detail; attestationGaps.set(key, [...(attestationGaps.get(key) || []), entry("signature", ref, detail, rowSha ? { sha256: rowSha } : {})]); };
    if (!mat) fail(localize("case-checker.check.attestation_names_material", "an attestation names material {ref}, which the case document's materials do not list", { ref }));
    else if (row.by_kind === "member") {
      if (row.signature == null || row.signature === "") { a.state = "unsigned"; a.detail = word("case-checker.detail.member_attestation_carries"); }
      else {
        const acct = accountRows.find((x) => String(x.capture ?? "") === mat.sha && String(x.by ?? "") === String(row.by ?? ""));
        let text = null, armored = String(row.signature);
        try { if (acct && typeof acct.text_b64 === "string") text = td.decode(b64ToBytes(acct.text_b64)); } catch { text = null; }
        try { if (!/BEGIN SSH SIGNATURE/.test(armored)) armored = td.decode(b64ToBytes(armored)); } catch { /* left as given */ }
        if (text === null) gap(word("case-checker.gap.signed_account_attesting", { ref }));
        else {
          const v = await verifyOver(armored, captureAccountStatement(mat.sha, text));
          Object.assign(a, { key_fingerprint: v.key_fingerprint, listed_in_case_file: v.listed_in_case_file,
            ...(published ? { among_published_keys: v.among_published_keys } : {}) });
          if (!v.verified) fail(localize("case-checker.check.member_account_says", "the member's signed account attesting {ref} {words}", { ref, words: v.words }));
        }
      }
    } else if (row.by_kind === "group") {
      if (row.signature !== "case") fail(localize("case-checker.check.group_attestation_other_signature", "a team attestation of {ref} names a signature other than the case document's own", { ref }));
      else if (caseSig && !caseSig.content && caseSig.state === "missing") gap(word("case-checker.gap.group_attestation_case", { ref }));
      else if (!sigCase.verified) fail(localize("case-checker.check.group_attestation_fails", "the team's attestation of {ref} is the case document's signature, which {why}",
        { ref, why: caseSig ? localize("case-checker.check.does_not_verify", "does not verify") : localize("case-checker.check.case_file_does_not_carry", "the case file does not carry") }));
    } else if (row.by_kind === "project" || row.by_kind === "co_attestation") {
      const carried = mat.included !== true || files.some((f) => f.ref === ref && (!rowSha || ownsCapture(f, rowSha)));
      if (!carried) fail(row.by_kind === "project"
        ? localize("case-checker.check.project_attestation_unlisted", "a project attestation names {ref}, which the case file's manifest does not list", { ref })
        : localize("case-checker.check.co_attestation_unlisted", "a co-attestation names {ref}, which the case file's manifest does not list", { ref }));
    } else fail(localize("case-checker.check.attestation_unknown_kind", "an attestation of {ref} names a kind this checker does not know ({kind})", { ref, kind: String(row.by_kind) }));
    attestationAnswers.push(a);
  }

  /* ---------------------------------------------------------- R7: the publication checks */
  const memberBasis = {};
  let basisAll = true;
  for (const id of roster) {
    const ff = fileOf("finding", "finding", id);
    const t = ff && ff.content ? textOf(ff.content) : null;
    const p = t !== null ? parseFrontmatter(t) : null;
    /* R28: each member's `{basis, references}` from its own bytes, so a leg its references sever is not counted (`strength` R2) */
    if (p && isObj(p.data) && Array.isArray(p.data.basis)) memberBasis[id] = { basis: p.data.basis, references: Array.isArray(p.data.references) ? p.data.references : [] };
    else basisAll = false;
  }
  const statedChecks = method && typeof method.checks === "string" ? method.checks : null;
  const pubFindings = fm ? checkCaseDocument(fm, { caseId: fm.case_id, edition: fm.case_edition, body, memberBasis }) : [];
  const unasked = [localize("case-checker.check.unasked_previous_edition", "C-21.1: the comparison with the case's previous edition, which this case file does not carry")];
  if (!basisAll) unasked.push(localize("case-checker.check.unasked_basis", "C-2.8's testimony-row and per-ground arms for each member whose basis the case file does not carry"));
  const publication_checks = { ran: !!fm, findings: pubFindings, unasked, stated_version: statedChecks, checker_version: CATALOG_VERSION,
    statement: statedChecks === CATALOG_VERSION ? null : CHECKS_VERSION_STATEMENT(statedChecks, CATALOG_VERSION) };
  for (const x of pubFindings) if (x && x.severity === "error")
    caseLevel.differs.push(entry("publication", "case document", localize("case-checker.check.publication_check_fails", "the case does not pass publication check {check}: {message}", { check: String(x.check), message: String(x.message) })));

  /* ---------------------------------------------------------- R10: the complete edition */
  const ceFile = fileOf("complete_edition", null);
  const complete_edition = { equal: null, sha256: ceFile ? ceFile.sha256 : null, rendered_sha256: null, detail: null };
  if (!ceFile) { complete_edition.equal = false; complete_edition.detail = word("case-checker.detail.case_file_carries"); caseLevel.differs.push(entry("complete_edition", "complete edition", complete_edition.detail)); }
  else if (!ceFile.content) {
    complete_edition.detail = ceFile.state === "missing" ? localize("case-checker.check.complete_edition_not_carried_fetch", "the complete edition is not carried; fetch the file whose SHA-256 is {sha}", { sha: ceFile.sha256 }) : ceFile.detail;
    (ceFile.state === "missing" ? caseLevel.missing : caseLevel.differs).push(entry("complete_edition", ceFile.path, complete_edition.detail, { sha256: ceFile.sha256 }));
  } else if (files.some((f) => f.kind !== "complete_edition" && f.kind !== "criteria" && f.state !== "intact" && f.state !== "supplied")) {
    /* Rendered from files that are missing or differ, it could not be the carried edition; what they lack is already
       entered for each finding that needs them, so the edition is not compared rather than counted against every one.
       The criteria file is not rendered from (`case-grammar` R14), so it does not hold the comparison back (R22). */
    complete_edition.detail = word("case-checker.detail.complete_edition_compared");
  } else {
    const caseFile = { format: m.format, group: m.group, case: m.case, edition: m.edition, case_document_sha: m.case_document_sha,
      keys: m.keys,
      files: files.filter((f) => f.content && f.kind !== "complete_edition")
        .map((f) => ({ path: f.path, kind: f.kind, sha256: f.sha256, bytes: f.bytes, content: f.content })) };
    const rendered = completeEditionOf(caseFile);
    const rb = typeof rendered === "string" ? te.encode(rendered) : asBytes(rendered && rendered.bytes !== undefined ? rendered.bytes : rendered);
    if (!rb) { complete_edition.detail = word("case-checker.detail.checker_render_complete"); caseLevel.differs.push(entry("complete_edition", ceFile.path, complete_edition.detail)); }
    else {
      complete_edition.rendered_sha256 = shaOf(rb);
      complete_edition.equal = complete_edition.rendered_sha256 === shaOf(ceFile.content);
      complete_edition.detail = complete_edition.equal ? word("case-checker.text.carried_complete_edition")
        : localize("case-checker.check.complete_edition_differs", "the carried complete edition (SHA-256 {sha}) is not the edition the rest of the case file renders (SHA-256 {rendered})",
                   { sha: complete_edition.sha256, rendered: complete_edition.rendered_sha256 });
      if (!complete_edition.equal) caseLevel.differs.push(entry("complete_edition", ceFile.path, complete_edition.detail));
    }
  }

  /* ---------------------------------------------------------- R20: the calculations */
  const calculations = fm ? recomputeCalculations(fm, files, supplied) : [];
  const used = [], unmatched = [];
  for (const doc of supplied) {
    if (doc.sha === null) unmatched.push({ sha256: null, bytes: null, detail: localize("case-checker.check.supplied_not_bytes", "a supplied document is not bytes, so it was not used") });
    else if (!doc.used) unmatched.push({ sha256: doc.sha, bytes: doc.bytes.length, detail: localize("case-checker.check.supplied_matches_nothing", "a supplied document (SHA-256 {sha}) matches no fingerprint this case file records as missing, and no calculation input it lacks, so it was not used", { sha: doc.sha }) });
    else if (!used.includes(doc.sha)) used.push(doc.sha);
  }
  /* R9 (K2143): every file the manifest lists that the case file lacks (absent, or carried with other bytes) and no
     document supplied filled, in the manifest's order, so a reader knows each file to fetch; the criteria file (R22)
     among them, though no finding's result rests on it. */
  const wanted = files.filter((f) => (f.state === "missing" || f.state === "differs") && !used.includes(f.sha256))
    .map((f) => ({ path: f.path, kind: f.kind, sha256: f.sha256,
                   detail: f.state === "differs"
                     ? localize("case-checker.check.carried_other_bytes_fetch", "{path} is carried with other bytes; fetch the file whose SHA-256 is {sha}", { path: f.path, sha: f.sha256 })
                     : localize("case-checker.check.not_carried_fetch", "{what} is not carried; fetch the file whose SHA-256 is {sha}", { what: f.path, sha: f.sha256 }) }));
  /* R2, R20: the calculations' PROV-O rendering, when carried, is what `case-grammar` R19 renders from the signed rows. */
  const provFile = files.find((f) => f.path === CASE_FILE_PROV_PATH) || null;
  if (fm && provFile && provFile.content && textOf(provFile.content) !== provOf(calculationsOf(fm)))
    caseLevel.differs.push(entry("calculation", provFile.path, localize("case-checker.check.provenance_file_differs", "the calculations' provenance file the case file carries is not the rendering of the calculations the signed case document states")));

  /* ---------------------------------------------------------- R22: how the case uses its standards, offline */
  const standards_use = standardsUseOf({ files, docText, materials, signedPassages, fileOf });

  /* ---------------------------------------------------------- R24: the account, offline */
  const account = fm ? accountUseOf({ fm, files, facts, materials, signedPassages, fileOfMaterial, caseLevel }) : null;

  /* ---------------------------------------------------------- per finding */
  const bar = fm && isObj(fm.required_strength) ? fm.required_strength : null;
  const { version } = grading;
  const strengthRows = fm && Array.isArray(fm.case_strength) ? fm.case_strength.filter(isObj) : [];
  const findingSigs = [];
  const findingsOut = [];
  const recomputeLegs = grading.recompute;
  const fileGap = (f, about, what) => (f.state === "missing"
    ? { missing: entry("integrity", about, localize("case-checker.check.not_carried_fetch", "{what} is not carried; fetch the file whose SHA-256 is {sha}", { what, sha: f.sha256 }), { sha256: f.sha256 }) }
    : f.entry ? { differs: f.entry } : {});

  for (const id of findingIds) {
    const missing = [...caseLevel.missing], differs = [...caseLevel.differs];
    const put = (g) => { if (g.missing) missing.push(g.missing); if (g.differs) differs.push(g.differs); };
    const isMember = roster.includes(id);
    const role = isMember ? (str(roleOf.get(id)?.role) || null) : "reached";
    const ff = fileOf("finding", "finding", id);
    if (!ff) (isMember ? differs : missing).push(entry("integrity", id, localize("case-checker.check.no_published_bytes", "the case file carries no published bytes for finding {id}", { id })));
    else put(fileGap(ff, id, word("case-checker.file_gap.finding_published_bytes", { id })));

    /* R3: a member's signature, over its pinned version. */
    if (isMember) {
      const pin = str(roleOf.get(id)?.version_sha);
      const fs = fileOf("finding_signature", "finding", id);
      const sig = { finding: id, verified: false, reason: null };
      if (ff && ff.content && pin && shaOf(ff.content) !== pin)
        differs.push(entry("integrity", id, localize("case-checker.check.carried_bytes_not_pinned", "finding {id}'s carried bytes are not the version the case pins ({pin})", { id, pin })));
      if (!fs) differs.push(entry("signature", id, localize("case-checker.check.no_finding_signature", "the case file carries no signature for finding {id}", { id })));
      else if (!fs.content) put(fileGap(fs, id, word("case-checker.file_gap.finding_signature", { id })));
      else if (pin) {
        const v = await verifyOver(textOf(fs.content), ratifyStatement(id, pin));
        Object.assign(sig, v); delete sig.words;
        if (!v.verified) differs.push(entry("signature", id, localize("case-checker.check.finding_signature_says", "finding {id}'s signature {words}", { id, words: v.words })));
      }
      findingSigs.push(sig);
    }

    /* R4: the passages it relies on. */
    const pf = fileOf("passages", "finding", id);
    if (pf && !pf.content) put(fileGap(pf, id, word("case-checker.file_gap.finding_passages", { id })));
    const fileRows = pf && pf.content ? listOf(jsonOf(pf.content), "passages") : pf ? [] : [];
    const rows = signedPassages ? (signedPassages[id] || []) : fileRows;
    if (signedPassages && pf && pf.content && (fileRows === null || !sameRows(fileRows, rows, PASSAGE_FIELDS)))
      differs.push(entry("passage", id, localize("case-checker.check.carried_passages_differ", "finding {id}'s carried passages are not the passages the signed case document states", { id })));
    else if (rows === null) differs.push(entry("passage", id, localize("case-checker.check.passages_unreadable", "finding {id}'s passages cannot be read", { id })));
    for (const row of (rows || []).filter(isObj)) {
      const cap = str(row.capture_sha) || "";
      const mat = materials.find((x) => x.sha === cap) || null;
      const where = word("case-checker.where", { document: cap || word("case-checker.text.unnamed_document"), id });
      if (!HEX64.test(String(row.content_id ?? "")) || contentIdFor(cap, row.extent, row.chain ?? null) !== row.content_id) {
        differs.push(entry("passage", id, localize("case-checker.check.passage_content_id_differs", "{where} does not recompute to the content id it states ({content_id})", { where, content_id: String(row.content_id) }))); continue; }
      const tf = mat && mat.kind === "observation" ? fileOfMaterial("observation", mat) : mat ? fileOfMaterial("extracted_text", mat) : null;
      if (!tf || !tf.content) {
        missing.push(entry("passage", id, localize("case-checker.check.passage_text_not_carried", "{where} cannot be found, because the document's extracted text is not carried", { where }) + (mat ? `; ${fetchMaterial(mat, "document")}` : ""),
          { sha256: tf ? tf.sha256 : cap, ...(mat && mat.origin ? { origin: mat.origin } : {}) }));
        continue;
      }
      const at = mat.kind === "observation" ? textOf(tf.content) : textAtExtent(textOf(tf.content), row.extent);
      if (at === null || typeof row.quoted !== "string" || !squash(at).includes(squash(row.quoted)))
        differs.push(entry("passage", id, localize("case-checker.check.passage_not_found", "{where} is not found where it is said to be: its quoted text is not in the document's text at that place", { where })));
    }

    /* R5: the pair, recomputed at the stated version. */
    const fx = facts.get(id);
    const gf = fileOf("grading_facts", "finding", id);
    let pair = null;
    if (gf && gf.content && factsDiffer.has(id))
      differs.push(entry("grade", id, localize("case-checker.check.carried_facts_differ", "finding {id}'s carried grading facts are not the facts the signed case document states", { id })));
    if (gf && !gf.content) put(fileGap(gf, id, word("case-checker.file_gap.finding_grading_facts", { id })));
    if (!fx && !gf) missing.push(entry("grade", id, localize("case-checker.check.no_grading_facts", "the case file carries no grading facts for finding {id}, so its grade cannot be recomputed", { id })));
    else if (!fx && gf && gf.content) differs.push(entry("grade", id, localize("case-checker.check.grading_facts_unreadable", "finding {id}'s grading facts cannot be read", { id })));
    else if (!fx) { /* not carried: entered above */ }
    else {
      const r = recomputeLegs(id, fx.legs);
      if (!r.ok && r.reason === "UNKNOWN_METHOD_VERSION")
        missing.push(entry("grade", id, localize("case-checker.check.grading_method_not_held", "the grade was set by grading method {version}, which this checker does not hold (it holds {held})",
          { version: version === null ? localize("case-checker.check.none_stated", "(none stated)") : version, held: GRADING_METHOD_VERSIONS.join(", ") }), { version }));
      else if (!r.ok) differs.push(entry("grade", id, localize("case-checker.check.grade_not_recomputed", "finding {id}'s grade could not be recomputed: {detail}", { id, detail: String(r.detail) })));
      else {
        pair = r.pair;
        const recorded = isMember
          ? [{ from: word("case-checker.from.case_document"), rows: strengthRows.filter((x) => String(x.target ?? "") === id) }]
          : (legAnswers.get(id) || []).map((x) => ({ from: word("case-checker.from.grading_facts", { from: x.from }), rows: GRADE_AXES.filter((a) => isObj(x.answer[a])).map((a) => ({ axis: a, ...x.answer[a] })) }));
        if (isMember && !recorded[0].rows.length) differs.push(entry("grade", id, localize("case-checker.check.no_recorded_pair", "the case document records no pair for finding {id}", { id })));
        for (const rec of recorded) for (const row of rec.rows) {
          const a = String(row.axis ?? "");
          if (!pair[a]) continue;
          const rg = row.grade ?? null, rs = String(row.state ?? "");
          if (rg !== pair[a].grade || (rs && rs !== pair[a].state)) {
            const d = entry("grade", id, localize("case-checker.check.grade_differs", "on {axis}, {from} records {recorded} for finding {id}, and it recomputes to {recomputed}", { axis: a, from: rec.from, recorded: String(rg ?? rs), id, recomputed: String(pair[a].grade ?? pair[a].state) }), { axis: a, recorded: rg ?? rs, recomputed: pair[a].grade ?? pair[a].state });
            differs.push(d);
            if (!isMember) for (const parent of reachedBy.get(id) || []) (parentDiffers[parent] ||= []).push(entry("grade", parent, localize("case-checker.check.rests_on_unrecomputed", "{parent} rests on {id}, whose stated grade on {axis} does not recompute", { parent, id, axis: a }), { axis: a }));
          }
        }
      }
    }

    /* R6: the bar, by `case-grammar`'s one reading of a standing (its R15), over the recomputed pair (or, where it
       could not be recomputed, the recorded one). A finding reached through a member's chain is not asked. */
    let bar_met = "not_asked";
    if (isMember) {
      const p = pair || Object.fromEntries(GRADE_AXES.map((a) => {
        const row = strengthRows.find((x) => String(x.target ?? "") === id && x.axis === a);
        return [a, { state: row ? str(row.state) : null, grade: row ? row.grade ?? null : null }];
      }));
      const st = standingOf({ role, bar, pair: p });
      bar_met = isObj(st) ? st.meets : null;
      for (const a of isObj(st) && st.meets === false && Array.isArray(st.short) ? st.short : [])
        differs.push(entry("bar", id, localize("case-checker.check.short_of_bar", "on {axis}, finding {id} reaches {reached}, short of the bar the case records ({bar})", { axis: a, id, reached: String(p[a]?.grade ?? p[a]?.state ?? NOTHING()), bar: String(st.bar[a]) }), { axis: a, bar: st.bar[a] }));
    }

    /* R8, R2, R3: the material its chain reaches. */
    const chain = chainOf(id);
    if (isMember && role === "load_bearing")
      for (const u of chain.unlisted) differs.push(entry("presentability", id, localize("case-checker.check.chain_reaches_unlisted", "{id}'s chain reaches {kind} {target}, which the case document's materials do not list", { id, kind: u.kind, target: u.target })));
    for (const mat of chain.mats) {
      const what = mat.kind === "observation" ? localize("case-checker.check.the_observation", "the observation {ref}", { ref: String(mat.ref) })
        : localize("case-checker.check.the_document", "the document {ref}", { ref: String(mat.ref) });
      const lb = isMember && role === "load_bearing";
      /* R8 (DEC-180 (4)): a row carried as its copy is presentable when a file of kind `obscured` is carried at the copy's
         SHA-256 (R2 checks its bytes); its extracted text and the original's bytes are not asked: the original never
         travels. */
      const ob = obscuredOf(mat);
      if (ob) {
        const f = files.find((x) => x.kind === "obscured" && x.ref === mat.ref && ownsCapture(x, mat.sha) && x.sha256 === ob.copy) || null;
        if (f && f.entry) differs.push(f.entry);
        else if (!f || !f.content)
          missing.push(entry(lb ? "presentability" : "integrity", id, localize("case-checker.check.copy_not_carried_fetch", "the copy of {what} carried in its place (a photo with its marked areas obscured, or a member document cleaned) is not carried; fetch the file whose SHA-256 is {sha}", { what, sha: ob.copy }), { sha256: ob.copy, copy: ob.copy }));
        for (const e of attestationsOf(attestationFails, mat)) differs.push({ ...e, about: id });
        for (const e of attestationsOf(attestationGaps, mat)) missing.push({ ...e, about: id });
        continue;
      }
      const fetch = fetchMaterial(mat, mat.kind);
      const needs = mat.kind === "observation" ? [["observation", mat.sha]] : [["document", mat.sha], ["extracted_text", mat.text_sha]];
      if (lb && mat.included !== true)
        differs.push(entry("presentability", id, localize("case-checker.check.load_bearing_not_whole", "{id} is load-bearing and rests on {what}, which the case lists as not travelling whole", { id, what }), { sha256: mat.sha }));
      for (const [kind, signedSha] of needs) {
        const f = fileOfMaterial(kind, mat);
        if (f && f.content && signedSha && f.sha256 !== signedSha)
          differs.push(entry("integrity", id, localize("case-checker.check.carried_not_signed_bytes", "{carried} is not the bytes the signed case fingerprints ({sha})", {
            carried: kind === "extracted_text" ? localize("case-checker.check.carried_extracted_text", "the carried extracted text of {what}", { what })
              : kind === "observation" ? localize("case-checker.check.carried_observation", "the carried observation {ref}", { ref: String(mat.ref) })
              : localize("case-checker.check.carried_document", "the carried document {ref}", { ref: String(mat.ref) }), sha: signedSha }), { sha256: signedSha }));
        if (f && f.entry) differs.push(f.entry);
        else if ((!f || !f.content) && (mat.included === true || (f && f.state === "missing")))
          missing.push(entry(lb ? "presentability" : "integrity", id, localize("case-checker.check.subject_not_carried", "{subject} is not carried; {fetch}", {
            subject: kind === "extracted_text" ? localize("case-checker.check.extracted_text_of", "{what}'s extracted text", { what }) : what, fetch }),
            { sha256: f ? f.sha256 : mat.sha, ...(mat.origin ? { origin: mat.origin } : {}) }));
      }
      for (const e of attestationsOf(attestationFails, mat)) differs.push({ ...e, about: id });
      for (const e of attestationsOf(attestationGaps, mat)) missing.push({ ...e, about: id });
    }
    /* R20, R11: a calculation its chain rests on gives it that calculation's entries. */
    for (const calc of chain.calcs) {
      const c = calculations.find((x) => x.calc === calc);
      if (!c) { differs.push(entry("calculation", id, localize("case-checker.check.chain_rests_on_unlisted_calculation", "{id}'s chain rests on calculation {calc}, which the case document's calculations do not list", { id, calc }))); continue; }
      for (const e of c.differs) differs.push({ ...e, about: id });
      for (const e of c.missing) missing.push({ ...e, about: id });
    }
    /* R18: another group's finding, recreated up to that leg. */
    for (const { leg } of chain.refs) {
      const row = acceptedRows.find((r) => r.ref === leg.target) || null;
      const it = row ? { group: str(row.group), case: str(row.case), edition: Number.isInteger(row.edition) ? row.edition : row.edition ?? null, finding: str(row.finding), manifest_sha: str(row.manifest_sha) }
        : { group: null, case: null, edition: null, finding: String(leg.target ?? ""), manifest_sha: null };
      if (!restsOn.some((x) => canonicalJson(x) === canonicalJson(it))) restsOn.push(it);
    }

    findingsOut.push({ finding: id, role, missing, differs, pair, bar_met });
  }
  /* A finding resting on one whose stated grade does not recompute differs too (R5). */
  for (const f of findingsOut) for (const e of parentDiffers[f.finding] || []) f.differs.push(e);
  for (const f of findingsOut) {
    f.missing = dedupe(f.missing); f.differs = dedupe(f.differs);
    f.result = f.differs.length ? "did_not_recreate" : f.missing.length ? "recreated_in_part" : "recreated";
  }

  /* R23: each finding's pair and bar under the lens asked for, by `reweigh` over this answer (K2529). A lens re-weighs;
     the result stays the check's. */
  const reweighed = reweigh({ parts, documents, answer: { findings: findingsOut }, lens: lensArg });
  const lensAnswer = reweighed.lens;
  if (lens.name !== "as_published") for (const f of findingsOut) {
    const w = reweighed.findings.find((x) => x.finding === f.finding);
    f.as_published = { pair: f.pair, bar_met: f.bar_met };
    f.lens_changes = w ? w.lens_changes : [];
    f.pair = w ? w.pair : null;
    f.bar_met = w ? w.bar_met : null;
  }

  return {
    format: str(m.format), case: str(m.case), edition: Number.isInteger(m.edition) ? m.edition : null, group: str(m.group),
    checker: versionsOut(),
    integrity: { intact: !read.departures.length && files.every((f) => f.state === "intact" || f.state === "supplied"),
      departures: read.departures, parts: read.parts,
      files: files.map((f) => ({ path: f.path, kind: f.kind, sha256: f.sha256, state: f.state })),
      documents: { used, unmatched, wanted } },
    signatures: { case: caseSig ? { file: caseSig.path, verified: sigCase.verified === true, reason: sigCase.reason ?? null,
        key_fingerprint: sigCase.key_fingerprint ?? null, listed_in_case_file: sigCase.listed_in_case_file ?? null,
        ...(published ? { among_published_keys: sigCase.among_published_keys ?? null } : {}) } : null,
      findings: findingSigs, attestations: attestationAnswers, keys_checked: !!published,
      keys_statement: published ? null : KEYS_NOT_CHECKED_STATEMENT },
    publication_checks,
    calculations,
    standards_use,
    obscured: materials.filter(obscuredOf).map((x) => ({ ref: str(x.ref), sha: str(x.sha), copy: x.obscured.copy, label: str(x.obscured.label) })),
    account,
    lens: lensAnswer, lens_statement: LENS_LIMIT_STATEMENT,
    findings: findingsOut.map((f) => ({ finding: f.finding, role: f.role, result: f.result, missing: f.missing, differs: f.differs, pair: f.pair, bar_met: f.bar_met,
      ...(lens.name !== "as_published" ? { as_published: f.as_published, lens_changes: f.lens_changes } : {}) })),
    complete_edition,
    rests_on_another_group: restsOn, rests_on_another_group_statement: REST_ON_ANOTHER_GROUP_STATEMENT,
    statement: RECREATION_STATEMENT,
  };
}
const dedupe = (list) => { const seen = new Set(); return list.filter((e) => { const k = canonicalJson(e); if (seen.has(k)) return false; seen.add(k); return true; }); };

/* ============================================================ grading and the lens (R5, R18, R23) */

/** R5, R18: what recomputing a finding's pair reads from the signed document: the grading method version it states,
 *  the attribution level in force for each observation or attested capture (`observation_attributions:`, `case-grammar`
 *  R2; strength R29, R34) and the `accepted_work:` rows; `recompute(id, legs)` answers recomputePair's answer with
 *  `pair` beside it, a leg on another group's finding taking the row's pair as its fact. */
function gradingContextOf(fm) {
  const method = fm ? methodOf(fm) : null;
  const version = method && typeof method.grading === "string" ? method.grading : null;
  const accepted = fm ? acceptedWorkOf(fm) : null;
  const acceptedRows = isObj(accepted) && Array.isArray(accepted.rows) ? accepted.rows.filter(isObj) : [];
  const levels = {};
  for (const r of fm && Array.isArray(fm.observation_attributions) ? fm.observation_attributions.filter(isObj) : []) {
    const k = str(r.observation) || str(r.capture);
    if (k && typeof r.level === "string") levels[k] = r.level;
  }
  function recompute(id, legs0) {
    const legs = legs0.map((leg) => {
      if (!isObj(leg) || leg.kind !== "imported") return leg;
      const row = acceptedRows.find((r) => r.ref === leg.target && (r.member === id || r.leg_of === id)) || acceptedRows.find((r) => r.ref === leg.target);
      return row && isObj(row.pair) ? { ...leg, answer: row.pair } : leg;    /* R18: the row's pair is that leg's fact */
    });
    const r = recomputePair({ legs: legs.map(factFields), levels: Object.keys(levels).length ? levels : null, version });
    return r.ok ? { ...r, pair: Object.fromEntries(GRADE_AXES.map((a) => [a, { state: r[a].state, grade: r[a].grade ?? null }])) } : r;
  }
  return { version, acceptedRows, levels, recompute };
}

/** R23 (K2529): re-weigh an as-published answer under a lens, pure and synchronous, reading the case file's parts again
 *  (no signature is verified again; `documents` fill a file the parts lack, as R9). `answer` is `checkCaseFile`'s
 *  as-published answer (its findings' `pair`, `bar_met` and `role`). Answers `{lens: {name, statements, departure,
 *  not_applied}, lens_statement, findings: [{finding, pair, bar_met, as_published: {pair, bar_met}, lens_changes}]}`, a
 *  finding in the answer's order, `lens_changes` the applications that changed its pair (each `{finding, ord, target,
 *  statement, effect, from, to, how, through?}`). Under `as_published` each finding is answered as the answer gives it.
 *  Never throws. */
export function reweigh(args) {
  const a = isObj(args) ? args : {};
  const lens = lensOfArg(a.lens);
  const given = isObj(a.answer) && Array.isArray(a.answer.findings) ? a.answer.findings.filter((f) => isObj(f) && str(f.finding)) : [];
  const out = { lens: { name: lens.name, statements: lens.statements, departure: lens.departure, not_applied: [] }, lens_statement: LENS_LIMIT_STATEMENT,
    findings: given.map((f) => ({ finding: f.finding, pair: f.pair ?? null, bar_met: f.bar_met ?? null,
                                  as_published: { pair: f.pair ?? null, bar_met: f.bar_met ?? null }, lens_changes: [] })) };
  if (lens.name === "as_published") return out;
  try {
    const read = readCaseFile(a.parts);
    const files = read.files;
    for (const d of Array.isArray(a.documents) ? a.documents : []) {
      const b = asBytes(d); if (!b) continue;
      const h = shaOf(b);
      for (const g of files.filter((f) => f.state === "missing" && f.sha256 === h)) { g.state = "supplied"; g.content = b; }
    }
    const docFile = files.find((f) => f.kind === "case_document" && f.content) || null;
    const p = docFile ? parseFrontmatter(textOf(docFile.content)) : null;
    const fm = p && isObj(p.data) ? p.data : null;
    if (!fm) { out.lens.departure = word("case-checker.departure.case_document_carried"); for (const f of out.findings) { f.pair = null; f.bar_met = null; } return out; }
    const grading = gradingContextOf(fm);
    /* the grading facts the signed document states (`case-grammar` R17), or, for a document that predates them, the files */
    const signed = gradingFactsOf(fm);
    const facts = new Map();
    for (const id of new Set([...given.map((f) => f.finding), ...Object.keys(isObj(signed) ? signed : {})])) {
      let legs = null;
      if (isObj(signed)) legs = Array.isArray(signed[id]) ? signed[id] : [];
      else {
        const gf = files.find((f) => f.kind === "grading_facts" && f.finding === id && f.content);
        const raw = gf ? jsonOf(gf.content) : null;
        legs = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.legs) ? raw.legs : null;
      }
      if (legs) facts.set(id, { legs: legs.map(factFields) });
    }
    const published = (biasApplicationsOf(fm) || []).map(applicationOf).filter(Boolean);
    const under = pairsUnderLens({ lens, facts, published, recompute: (legs) => grading.recompute(null, legs) });
    out.lens.not_applied = under.not_applied;
    const roster = Array.isArray(fm.case_findings) ? fm.case_findings.map(String) : [];
    const bar = isObj(fm.required_strength) ? fm.required_strength : null;
    for (const f of out.findings) {
      const role = given.find((g) => g.finding === f.finding).role ?? null;
      const pair = under.pairs.get(f.finding) ?? null;
      const st = roster.includes(f.finding) && pair ? standingOf({ role, bar, pair }) : null;
      f.pair = pair;
      f.bar_met = !roster.includes(f.finding) ? "not_asked" : isObj(st) ? st.meets : null;
      f.lens_changes = under.changes.get(f.finding) || [];
    }
    return out;
  } catch (e) {
    out.lens.departure = word("case-checker.departure.case_re_weighed", { e: String(e && e.message ? e.message : e).slice(0, 200) });
    return out;
  }
}

/* ============================================================ standards' use, offline (R22) */

/** R22: the sentence beside a row frozen before T37, which carries no `captures` (`publication` R72), so whether its
 *  standard's whole text travels is not judged here; stated, never filled. The UX stream's words, later. */
export const CAPTURES_NOT_CARRIED_STATEMENT = word("case-checker.captures_not_carried_statement");

/** R22: R21 (`checkStandardsUse`) over the case document, the carried `criteria` file's rows, the document's
 *  `materials:` rows and its passages (each with the finding relying on it); null when the case file lists no
 *  `criteria` file. Each row carries `captures` as `publication` R72 froze them (only the captures the edition carries,
 *  T37), so `COPYRIGHTED_TEXT_CARRIED` and `COPYRIGHTED_PASSAGE_UNRELIED` are judged offline over them exactly as R21
 *  judges them at the ceremony. A row frozen before T37 carries no `captures`: for a judged row of a standard whose
 *  `access` is not `free`, `COPYRIGHTED_TEXT_CARRIED`, the check that needs them, is not judged for it and its standard
 *  is named in `unjudged` with that check. (`COPYRIGHTED_PASSAGE_UNRELIED` does not need them offline: its row's own
 *  passages are judged, and every passage a case file carries is a finding's, `case-grammar` R17.) A file listed but
 *  not carried, or carried with other bytes, is answered `{ok: null, detail}` naming the file to fetch. It changes no
 *  finding's result. Pure; never throws. */
function standardsUseOf({ files, docText, materials, signedPassages, fileOf }) {
  const f = fileOf("criteria", null);
  if (!f) return null;
  if (!f.content) return { ok: null, file: f.path, sha256: f.sha256,
    detail: f.state === "missing" ? localize("case-checker.check.criteria_not_carried_fetch", "the criteria the case measures against are not carried; fetch the file whose SHA-256 is {sha}", { sha: f.sha256 })
      : localize("case-checker.check.criteria_not_judged", "the criteria the case measures against are not judged, because {why}", { why: String(f.detail) }) };
  if (docText === null) return { ok: null, file: f.path, sha256: f.sha256,
    detail: localize("case-checker.check.criteria_not_judged", "the criteria the case measures against are not judged, because {why}",
      { why: localize("case-checker.check.case_document_not_carried", "the case document is not carried") }) };
  const criteria = jsonOf(f.content);
  const passages = [];
  /* the passages the signed document states; a document that predates the block, the carried files (as R4 reads them) */
  const byFinding = isObj(signedPassages) ? Object.entries(signedPassages)
    : files.filter((x) => x.kind === "passages" && x.content && x.finding).map((x) => { const v = jsonOf(x.content); return [x.finding, Array.isArray(v) ? v : isObj(v) ? v.passages : null]; });
  for (const [finding, rows] of byFinding)
    for (const r of Array.isArray(rows) ? rows : []) if (isObj(r)) passages.push({ ...factFields(r), finding });
  const r = checkStandardsUse({ text: docText, criteria: criteria === undefined ? null : criteria, materials, passages });
  if (!Array.isArray(criteria) || r.refusals?.some((x) => x.code === "MALFORMED")) return r;
  const blind = criteria.filter((c) => c.stated !== "not held" && c.access !== "free" && !Array.isArray(c.captures))
    .map((c) => ({ standard: c.standard, portion: c.portion ?? null, body: c.body ?? null, check: "COPYRIGHTED_TEXT_CARRIED",
                   detail: CAPTURES_NOT_CARRIED_STATEMENT }));
  return blind.length ? { ...r, unjudged: [...(r.unjudged || []), ...blind] } : r;
}

/* ============================================================ the account, offline (R24) */

/** R24: the case document's `account:` block (`case-grammar` R23) judged by `checkAccount` over what the case file
 *  carries: each finding's signed conclusion (`case_conclusions:`, its claim, or what it says of an undetermined one),
 *  each leg (`<finding>#<ord>`: its target and ground, with its role), each passage (its `content_id`: its quoted text),
 *  each material carried (its `ref` and `sha`: its extracted text or observation), the statements its lens prints
 *  (`lens_statements:`, `case-grammar` R9) and the conclusions with their legs. A sentence citing material the case
 *  file lacks is not judged: it is named, and that is a `missing` entry for the case. Each departure is a `differs`
 *  entry for the case naming its code. Null for a document with no `account:` block. Pure; never throws. */
function accountUseOf({ fm, files, facts, materials, signedPassages, fileOfMaterial, caseLevel }) {
  const rows = accountOf(fm);
  if (!Array.isArray(rows)) return null;
  const cited = [], lacking = new Set();
  const conclRows = Array.isArray(fm.case_conclusions) ? fm.case_conclusions.filter(isObj) : [];
  for (const c of conclRows) if (str(c.target))
    cited.push({ ref: c.target, text: String((c.claim_state === "adopted" ? c.claim : c.claim_detail ?? c.claim) ?? "") });
  const legsOf = (id) => { const fx = facts.get(id); return fx && Array.isArray(fx.legs) ? fx.legs.filter(isObj) : []; };
  for (const id of facts.keys()) legsOf(id).forEach((leg, k) => {
    const ord = Number.isInteger(leg.ord) ? leg.ord : k;
    cited.push({ ref: `${id}#${ord}`, text: [leg.target, leg.ground].filter((x) => typeof x === "string" && x).join(" "),
                 ...(typeof leg.role === "string" ? { role: leg.role } : {}) });
  });
  const passageRows = isObj(signedPassages) ? Object.values(signedPassages).flat()
    : files.filter((x) => x.kind === "passages" && x.content).flatMap((x) => { const v = jsonOf(x.content); return Array.isArray(v) ? v : isObj(v) && Array.isArray(v.passages) ? v.passages : []; });
  for (const p of passageRows.filter(isObj)) if (str(p.content_id)) cited.push({ ref: p.content_id, text: String(p.quoted ?? "") });
  for (const mat of materials) {
    const tf = fileOfMaterial(mat.kind === "observation" ? "observation" : "extracted_text", mat);
    let text = null;
    if (tf && tf.content) {
      if (mat.kind === "observation") text = textOf(tf.content);
      else { try { const u = JSON.parse(textOf(tf.content)); text = Array.isArray(u) ? u.filter(isObj).map((x) => String(x.text ?? "")).join("\n") : null; } catch { text = null; } }
    }
    for (const ref of [str(mat.ref), str(mat.sha)].filter(Boolean)) { if (text === null) lacking.add(ref); else cited.push({ ref, text }); }
  }
  const conclusions = conclRows.filter((c) => str(c.target)).map((c) => ({ finding: c.target, claim: str(c.claim), claim_state: str(c.claim_state),
    legs: legsOf(c.target).map((leg, k) => ({ ord: Number.isInteger(leg.ord) ? leg.ord : k, target: str(leg.target), role: str(leg.role) })) }));
  const lens = lensOf(fm);
  const printed = lens && Array.isArray(lens.statements) ? lens.statements.filter((x) => str(x.id)).map((x) => ({ bundle: x.bundle, id: x.id })) : [];
  const judged = [], not_judged = [];
  rows.forEach((r, i) => {
    const gone = (isObj(r) ? listOfField(r.cites) : []).map(citeOf).filter((c) => c && lacking.has(c.key));
    const ord = isObj(r) && Number.isInteger(r.ord) ? r.ord : i;
    if (gone.length) not_judged.push({ ord, cites: gone.map((c) => c.key),
      detail: localize("case-checker.check.account_cites_not_carried", "account sentence {ord} cites {cites}, whose text this case file does not carry, so it is not judged; fetch it to judge it", { ord, cites: gone.map((c) => c.words).join(", ") }) });
    else judged.push(isObj(r) && !Number.isInteger(r.ord) ? { ...r, ord: i } : r);
  });
  const r = checkAccount({ account: judged, cited, printed, conclusions });
  if (r.ok !== true) caseLevel.differs.push(entry("account", "account", localize("case-checker.check.account_unreadable", "the case document's account cannot be read ({field})", { field: String(r.field) }), { code: r.reason }));
  for (const x of r.departures || []) caseLevel.differs.push(entry("account", `account sentence ${x.ord}`, x.detail, { code: x.code }));
  for (const n of not_judged) caseLevel.missing.push(entry("account", `account sentence ${n.ord}`, n.detail));
  return { sentences: rows.length, judged: judged.length,
           ok: r.ok !== true || r.departures.length ? false : not_judged.length ? null : true,
           departures: r.departures || [], ...(r.ok !== true ? { malformed: { reason: r.reason, field: r.field } } : {}), not_judged };
}

/* ============================================================ the calculations (R20) */

const BIO_CALC = /^bio-calc\/\d+$/;

/** R20: each calculation recomputed by `calc-grammar.evaluate` over the inputs the case file carries, at the method version
 *  its row states. An input the case file lacks (absent, or carried with other bytes) is filled by a supplied document
 *  whose SHA-256 is the input's stated one (R9), which is then marked used and named in the answer's `supplied`.
 *  Answers `[{calc, result, differs[], missing[], supplied?, disclosed?, statement?}]`. Pure; never throws. */
function recomputeCalculations(fm, files, supplied = []) {
  const out = [];
  for (const row of calculationsOf(fm)) {
    const calc = str(row.calc) || String(row.calc ?? "");
    const differs = [], missing = [];
    const a = { calc, result: "agrees", differs, missing };
    const disclosed = row.disclosed != null && row.disclosed !== "" && (row.recompute === "differs" || row.recompute === "unbound")
      ? row.disclosed : null;
    if (disclosed !== null) a.disclosed = disclosed;
    const recipe = row.recipe;
    const version = str(row.method_version);
    const recipeMethod = isObj(recipe) ? str(recipe.method) : null;
    /* A workbook, or a value from another engine: recomputed by the publishing copy's engine, never shown to agree. */
    if (!isObj(recipe) || !BIO_CALC.test(recipeMethod || "") || (version !== null && !BIO_CALC.test(version))) {
      out.push({ ...a, result: "not_recomputed", statement: NOT_RECOMPUTED_STATEMENT });
      continue;
    }
    /* Each input's bytes: the carried file's when they are the bytes its hash names, else a supplied document's (R9). */
    const hashes = isObj(row.inputs) ? row.inputs : null;
    const inputBytes = {}, filled = [];
    for (const [name, sha] of Object.entries(hashes || {})) {
      const f = sha ? files.find((x) => x.kind === "calculation" && x.input === sha && x.calc === calc)
        || files.find((x) => x.kind === "calculation" && x.input === sha) : null;
      const b = f && f.content ? f.content : null;
      if (b && shaOf(b) === sha) {
        if (f.state === "supplied") filled.push({ input: name, sha256: sha });    /* a listed file a document filled above */
        inputBytes[name] = { bytes: b, file: f }; continue;
      }
      const doc = sha ? supplied.find((s) => s.sha === sha) : null;
      if (doc) { doc.used = true; filled.push({ input: name, sha256: sha }); inputBytes[name] = { bytes: doc.bytes, file: f }; }
      else inputBytes[name] = { bytes: null, file: f };
    }
    if (filled.length) a.supplied = filled;
    const held = [version ?? recipeMethod, recipeMethod].find((v) => v !== CALC_METHOD) ?? null;
    if (held !== null) {
      missing.push(entry("calculation", calc, localize("case-checker.check.calculation_method_not_held", "calculation {calc} was computed by calculation method {held}, which this checker does not hold (it holds {holds})", { calc, held, holds: CALC_METHOD }), { calc, version: held }));
      out.push(settle(a, disclosed));
      continue;
    }
    /* The row's file (`calculations/<calc>/calculation.json`) must say what the signed row states: only the document is
       signed. */
    const rf = files.find((f) => f.kind === "calculation" && f.calc === calc && !f.input) || null;
    if (rf && rf.content && textOf(rf.content) !== calculationFileText(row))
      differs.push(entry("calculation", calc, localize("case-checker.check.calculation_file_differs", "calculation {calc}'s carried file is not the row the signed case document states", { calc }), { calc }));
    if (!hashes) { differs.push(entry("calculation", calc, localize("case-checker.check.calculation_inputs_unreadable", "calculation {calc}'s inputs cannot be read", { calc }), { calc })); out.push(settle(a, disclosed)); continue; }
    const bound = {};
    for (const [name, sha] of Object.entries(hashes)) {
      const { bytes: b, file: f } = inputBytes[name];
      if (!b) {
        missing.push(entry("calculation", calc, f && f.state === "differs"
          ? localize("case-checker.check.input_not_carried_as_hashed", "input {name} of calculation {calc} is not carried as the bytes its hash names; fetch the file whose SHA-256 is {sha}", { name, calc, sha: String(sha) })
          : localize("case-checker.check.input_not_carried", "input {name} of calculation {calc} is not carried; fetch the file whose SHA-256 is {sha}", { name, calc, sha: String(sha) }), { calc, input: name, sha256: sha }));
        continue;
      }
      const v = jsonOf(b);
      if (v === undefined || v === null) { differs.push(entry("calculation", calc, localize("case-checker.check.input_unreadable_table", "input {name} of calculation {calc} is not a table or figure this checker can read", { name, calc }), { calc, input: name })); continue; }
      bound[name] = v;
    }
    if (missing.length || differs.length) { out.push(settle(a, disclosed)); continue; }
    let key = null;
    try { key = resultKey(recipe, hashes, { methodVersion: CALC_METHOD }); } catch { key = null; }
    if (key !== row.result_key)
      differs.push(entry("calculation", calc, localize("case-checker.check.result_key_differs", "calculation {calc}'s result key is stated as {stated}, and it recomputes to {recomputed}", { calc, stated: String(row.result_key), recomputed: String(key) }), { calc, result: "result_key", stated: row.result_key ?? null, recomputed: key }));
    let r;
    try { r = evaluate(recipe, bound); } catch (e) { r = { refused: "EVALUATE_FAILED", why: String(e && e.message ? e.message : e).slice(0, 200) }; }
    const stated = isObj(row.results) && typeof row.result_key === "string" ? row.results[row.result_key] : undefined;
    if (r && typeof r.refused === "string")
      differs.push(entry("calculation", calc, localize("case-checker.check.evaluator_refuses", "calculation {calc} does not recompute: the evaluator refuses it ({refused}: {why})", { calc, refused: r.refused, why: String(r.why) }), { calc, result: row.result_key ?? null, stated: stated ?? null, recomputed: null }));
    else if (stated === undefined || canonicalJson(stated) !== canonicalJson(r.result))
      differs.push(entry("calculation", calc, localize("case-checker.check.result_differs", "calculation {calc}'s result is stated as {stated}, and it recomputes to {recomputed}", { calc, stated: stated === undefined ? NOTHING() : canonicalJson(stated), recomputed: canonicalJson(r.result) }), { calc, result: row.result_key ?? null, stated: stated ?? null, recomputed: r.result }));
    out.push(settle(a, disclosed));
  }
  return out;
}

/* R20: a calculation's answer from its entries. A row the document discloses as differing or unbound is answered with that
   disclosure: what it disclosed is not a `differs` (or `missing`) entry for being so. */
function settle(a, disclosed) {
  const result = a.differs.length ? "differs" : a.missing.length ? "not_recomputed" : "agrees";
  if (disclosed !== null && result !== "agrees") return { ...a, result, disclosed_entries: { differs: a.differs, missing: a.missing }, differs: [], missing: [] };
  return { ...a, result };
}
