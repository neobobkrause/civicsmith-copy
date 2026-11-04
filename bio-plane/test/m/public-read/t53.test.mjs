/* public-read — the T53 marks and `case-grammar`'s notice 202 (R45–R53; `case-grammar` R1, R34–R39). A `/10` case edition
   (the format in force, `case-grammar` R35) is signed and published as ratification commits it, with the two passage
   blocks (`case-grammar` R36, R37), a cited register row as its extract (R38, R39) and each member's basis version (R34);
   it is then read as a stranger reads it: the store's `publishedcase`, the Worker's per-finding answer, the public lists,
   and the case file the Worker assembles. Each claim has its control: an earlier format states nothing (never none), a
   leg on working material answers as signed, a sentinel planted in a copy is found by the same scan. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, stubOf, bucket, caseDoc, V, NOW, sha } from "./fixture.mjs";
import { bindPublishedPlane, publishedRoutes, assembleCaseContainer } from "../../../src/publication/worker.mjs";
import { readContainer, readPart } from "../../../src/ooxml.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_FILE_FORMAT, caseFileManifestCheck, gradingFactsLines,
         passagesLines, extractedTextOf, registerExtractRow, ungradedPassagesOf, typedPassagesOf, materialsOf,
         EXTRACT_LABEL_KEY, UNGRADED_PREDATE_SENTENCE } from "../../../src/case-grammar/index.mjs";
import { subjectChangedLine, SUBJECT_CHANGED_KEYS, UNGRADED_HEAD_KEY } from "../../../src/public-read/index.mjs";
import { TYPED_LABEL_KEY, TEAM_MEMBER_KEY } from "../../../src/public-read/legs.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
bindPublishedPlane({
  json, StoreSilent: class extends Error {}, STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "silent",
  PUBLISHED_STORE: "bio",
  doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                             return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; },
  storeSilent: (op) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op }, 502),
  requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }),
});
const call = async (w, env, op, q) => {
  const url = new URL(`https://plane/?op=${op}`);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, String(v));
  return publishedRoutes({ op, url, env, stub: stubOf(w) });
};
const worker = async (w, env, q) => (await call(w, env, "publishedcase", q)).json();
const bytesOf = async (r) => new Uint8Array(await r.arrayBuffer());
const dec = (b) => new TextDecoder().decode(b);
const ENC = (t) => new TextEncoder().encode(t);

const CASE = "CASE-2026-5300", F = "INQ-2026-5300-transfer";
const DOC = "INFO-2026-5300-minutes", WORK = "INFO-2026-5300-working", EXT = "content-ext-5300";
const UNITS = [{ seq: 0, extent: { kind: "document" }, ref: "¶1", text: "The minutes say so.", truncated: false }];
const TITLE = "Council minutes, 12 March";
const VERSION = { name: "Spring stance", identity: "e".repeat(64) };
/* A private person's sentinel phone and street address, written by the group into its working record only (R50). */
const SENTINEL_PHONE = "+1 555 0142 7731", SENTINEL_STREET = "1428 Elmwood Crescent";
/* The reduced segment's bytes: no byte of it travels anywhere (R51). */
const SEGMENT = "SEGMENT-5300 licence,holder,street\nL-17,Pine Co,1 Mill Lane\n";
const EXTRACT = { ref: EXT, origin: "https://registers.example.org/licences", rests_under: "load_bearing", title: "Licence L-17",
  register: "licences", file: "licences-2026.csv", reduced_sha256: sha(SEGMENT), original_sha256: "f".repeat(64),
  original_covers: "every licence issued in 2026", source_date: "2026-08-01", imported_at: "2026-08-03", src_row: 17,
  kept_columns: ["licence", "holder"], roles: ["identifier", "organisation"], dropped_columns: ["street"],
  header: ["licence", "holder"], row: ["L-17", "Pine Co"],
  use_limit: { key: "register.limit.licences", citation: "Licensing Act s.12", text_key: "register.limit.licences.text" } };

/* One case edition over F, whose bytes rest on three legs: two passages of DOC (a captured document) and one on WORK
   (working material). `format` is the document's; `ungraded` the ords listed as published without a grade; `typed` the
   `typed_passages:` rows; `basisVersion` the member's `case_roles:` fields; `subject` its `subject_entity`. */
function published({ format = CASE_DOCUMENT_FORMAT, ungraded = [0, 1], typed = null, basisVersion = VERSION, subject = "ENT-office",
                     extractIncluded = false, members = null } = {}) {
  const w = world(members ? { members } : {});
  w.member("mem-4821", { handle: "olive" });
  const proj = w.project("Minutes", "mem-4821");
  w.doc(DOC); w.doc(WORK);
  const capOf = (id) => w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, id).capture_sha;
  const docSha = capOf(DOC);
  w.units.set(docSha, { units: UNITS, state: "whole" });
  /* the group's working record holds the sentinels: a working question no edition carries */
  w.inquiry("INQ-2026-5300-working", { question: `Who lives at ${SENTINEL_STREET}, phone ${SENTINEL_PHONE}?`, legs: [{ target: WORK }] });
  w.inquiry(F, { question: "Was the transfer authorised?", legs: [{ target: DOC }, { target: DOC }, { target: WORK }] });
  const pin = w.head(F);
  const ext = registerExtractRow(EXTRACT);
  assert.equal(ext.ok, true, JSON.stringify(ext));
  const materials = [
    { ref: DOC, kind: "document", sha: docSha, text_sha: sha(extractedTextOf(UNITS)), origin: "https://example.org/m",
      archived_copy: null, included: true, rests_under: "load_bearing", title: TITLE },
    ext.row];
  const leg = (ord, target, kind, grade) => ({ finding: F, ord, target, kind, role: "supports", grade, grade_axis: "capture",
    grade_source: "recorded", ground: "a fetched copy", target_edition: null, answer: null, origins: [target],
    origins_complete: true, captures: kind === "document" ? [docSha] : [], author_key: null });
  const grading = [0, 1, 2].map((o) => leg(o, o < 2 ? DOC : WORK, o < 2 ? "document" : "observation", ungraded.includes(o) ? null : "B"));
  const passages = [
    { finding: F, ord: 0, content_id: "c-0", capture_sha: docSha, extent: { kind: "pdf-page", page: 1 }, chain: null, quoted: "The minutes say so." },
    { finding: F, ord: 1, content_id: "c-1", capture_sha: docSha, extent: { kind: "pdf-page", page: 4 }, chain: null, quoted: "The minutes say so." },
    { finding: F, ord: 2, content_id: "c-2", capture_sha: capOf(WORK), extent: { kind: "document" }, chain: null, quoted: "noted" }];
  let text = caseDoc(CASE, 1, { format, project: proj, method: { grading: "bio-grading/1", checks: "1.57.0" }, materials,
    attestations: [], roles: [{ target: F, version_sha: pin, role: "load_bearing" }],
    strength: [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }],
    ...(ungraded.length ? { ungraded: ungraded.map((o) => ({ finding: F, ord: o, content_id: `c-${o}` })) } : {}),
    ...(typed ? { typed } : {}) });
  const roleExtra = [...(basisVersion === false ? [] : [`    basis_version: "${basisVersion.name}"`, `    basis_version_identity: ${basisVersion.identity}`]),
                     ...(subject ? [`    subject_entity: ${subject}`] : [])];
  text = text.replace("    role: load_bearing\n", `    role: load_bearing\n${roleExtra.map((l) => `${l}\n`).join("")}`);
  if (extractIncluded) {
    const at = text.indexOf(`  - ref: '"${EXT}"'`) >= 0 ? text.indexOf(`  - ref: '"${EXT}"'`) : text.indexOf(`ref: ${EXT}`);
    const inc = text.indexOf("included: false", at);
    text = text.slice(0, inc) + "included: true" + text.slice(inc + "included: false".length);
  }
  const lines = text.split("\n"), close = lines.indexOf("---", 1);
  const doc = [...lines.slice(0, close), ...gradingFactsLines(grading), ...passagesLines(passages), ...lines.slice(close)].join("\n");
  const stored = w.p.storeCaseDocument({ case: CASE, edition: 1, text: doc, author: V("mem-4821"), at: NOW });
  assert.equal(stored.ok, true, JSON.stringify(stored).slice(0, 300));
  const signed = w.signCase(CASE, 1, { project: proj, signer: "mem-4821", roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }] });
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 400));
  assert.equal(w.signFinding(F, { signer: "mem-4821" }).ok, true);
  const env = { PUBLISHED: bucket() };
  env.PUBLISHED.m.set(`bio/published/${pin}`, ENC(w.text(F)));
  /* the segment is held by this copy, so nothing but the rule keeps it out of the case file */
  env.PUBLISHED.m.set(`bio/published/${sha(SEGMENT)}`, ENC(SEGMENT));
  return { w, env, doc, docSha, pin, proj };
}

test("notice:case-grammar:202 R46 a /10 edition answers ungraded_passages from its signed block: the count, the rows in block order with their titles, the head's key; publishedList and publishedEditions give ungraded_count", () => {
  const { w, doc } = published();
  assert.equal(parseFrontmatter(doc).data.format, CASE_DOCUMENT_FORMAT, "the format in force (case-grammar R35)");
  const c = w.read("publishedcase", { id: F });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  /* the notice: a /10 document is read as /9 is: its method, materials and standing are answered as signed */
  assert.ok(c.method && Array.isArray(c.materials.materials) && c.findings[0].standing, "a /10 document reads its /6 blocks");
  const block = ungradedPassagesOf(parseFrontmatter(doc).data).rows;
  assert.deepEqual(c.ungraded_passages, { stated: true, count: 2, sentence_key: UNGRADED_HEAD_KEY,
    rows: block.map((r) => ({ ...r, title: TITLE })) }, "rows as the block states them, each titled by its signed material row");
  assert.equal(c.ungraded_note, null);
  const listed = w.read("publishedlist").cases.find((x) => x.case_id === CASE);
  assert.equal(listed.ungraded_count, 2);
  assert.equal(w.read("publishededitions", { id: F }).editions[0].ungraded_count, 2);
  /* CONTROL: a fully graded /10 edition states none (count 0), never null */
  const all = published({ ungraded: [] });
  assert.deepEqual(all.w.read("publishedcase", { id: F }).ungraded_passages, { stated: true, count: 0, rows: [], sentence_key: null });
  assert.equal(all.w.read("publishedlist").cases[0].ungraded_count, 0);
});

test("R46 R13 control: an earlier format states nothing (null with its note), never none", () => {
  const { w } = published({ format: CASE_DOCUMENT_FORMAT_V9 });
  const c = w.read("publishedcase", { id: F });
  assert.equal(c.ungraded_passages, null);
  assert.equal(c.ungraded_note, UNGRADED_PREDATE_SENTENCE);
  assert.equal(w.read("publishedlist").cases[0].ungraded_count, null);
  assert.equal(w.read("publishededitions", { id: F }).editions[0].ungraded_count, null);
});

test("R47 each basis entry marks its passage ungraded as the block lists it, and the finding carries ungraded_count; an earlier format answers null", async () => {
  const { w, env } = published({ ungraded: [1] });
  const f = (await worker(w, env, { id: F })).findings[0];
  assert.deepEqual(f.basis.map((l) => l.ungraded), [false, true, false], "only (F, 1) is listed; the working-material leg answers as signed");
  assert.equal(f.basis[2].served, false);
  assert.equal(f.ungraded_count, 1);
  const old = published({ format: CASE_DOCUMENT_FORMAT_V9, ungraded: [1] });
  const g = (await worker(old.w, old.env, { id: F })).findings[0];
  assert.deepEqual(g.basis.map((l) => l.ungraded), [null, null, null]);
  assert.equal(g.ungraded_count, null);
});

test("R49 a typed passage is served as the signed row labels it: the typist and checkers at the credit each chose, no member id; a machine-read passage carries no typed", async () => {
  const typed = [
    { finding: F, ord: 0, content_id: "c-0", typed_at: "2026-09-01T10:00:00Z", typist_level: "group", typist_shown: "mem-4821",
      checkers: [{ level: "name", shown: "Rowan Hale", at: "2026-09-02T10:00:00Z" }] },
    { finding: F, ord: 1, content_id: "c-1", typed_at: "2026-09-01T11:00:00Z", typist_level: "name", typist_shown: "Olive Ng", checkers: [] }];
  const { w, env, doc } = published({ typed });
  const c = await worker(w, env, { id: F });
  const [a, b, m] = c.findings[0].basis;
  assert.deepEqual(a.typed, { label_key: TYPED_LABEL_KEY, typist: { level: "group", name: null, key: TEAM_MEMBER_KEY },
    checked_by: [{ level: "name", name: "Rowan Hale", key: null, at: "2026-09-02T10:00:00Z" }], frozen_at: c.signed_at });
  assert.deepEqual(b.typed.typist, { level: "name", name: "Olive Ng", key: null });
  assert.deepEqual(b.typed.checked_by, []);
  assert.equal("typed" in m, false, "a passage not typed carries no typed");
  const named = JSON.stringify(c.findings[0].basis);
  assert.ok(!named.includes("mem-4821"), "no member id is served");
  /* the row travels as signed: what the edition answers is what the signed block states */
  assert.deepEqual(typedPassagesOf(parseFrontmatter(doc).data).rows.map((r) => r.typist_level), ["group", "name"]);
});

test("R45 each finding's basis version is served from the signed document only, and the case's header list names it", async () => {
  const { w, env } = published();
  const c = await worker(w, env, { id: F });
  assert.deepEqual(c.findings[0].basis_version, { recorded: true, ...VERSION });
  assert.deepEqual(c.basis_versions, [{ finding: F, recorded: true, ...VERSION }]);
  /* CONTROL: a document stating none for the member is undetermined, never filled */
  const none = published({ basisVersion: false });
  assert.deepEqual(none.w.read("publishedcase", { id: F }).findings[0].basis_version, { recorded: false, name: null, identity: null });
});

/* every public read a stranger can make of this record, as one text to scan */
async function publicText(w, env) {
  const reads = [w.read("publishedcase", { id: F }), await worker(w, env, { id: F }), w.read("publishedlist"),
    w.read("publishededitions", { id: F }), w.read("publishedmanifest"), w.read("publishedfrozen", { id: F })];
  return JSON.stringify(reads);
}
const sentinelsIn = (text) => [SENTINEL_PHONE, SENTINEL_STREET].filter((s) => text.includes(s));

test("R50 a published case names the extract's label and its limit's notice by key, with its fingerprints, dates and row; no public read holds a sentinel phone or address the group wrote", async () => {
  const { w, env } = published();
  const c = await worker(w, env, { id: F });
  const row = c.materials.materials.find((m) => m.ref === EXT);
  assert.equal(row.label_key, EXTRACT_LABEL_KEY);
  assert.equal(row.notice_key, EXTRACT.use_limit.key);
  assert.deepEqual([row.extract.label_key, row.extract.reduced_sha256, row.extract.original_sha256, row.extract.source_date,
                    row.extract.imported_at, row.extract.src_row],
                   [EXTRACT_LABEL_KEY, EXTRACT.reduced_sha256, EXTRACT.original_sha256, EXTRACT.source_date, EXTRACT.imported_at, 17]);
  assert.deepEqual(row.extract.use_limit, EXTRACT.use_limit);
  const doc = c.materials.materials.find((m) => m.ref === DOC);
  assert.equal(doc.extract, undefined, "a document row states no extract");
  assert.equal("notice_key" in doc, false);
  assert.deepEqual(sentinelsIn(await publicText(w, env)), [], "the scan finds no sentinel on any public read");
  /* CONTROL: the same scan finds a sentinel planted in a test copy */
  const copy = JSON.parse(await publicText(w, env));
  copy[0].scope = `call ${SENTINEL_PHONE} at ${SENTINEL_STREET}`;
  assert.deepEqual(sentinelsIn(JSON.stringify(copy)), [SENTINEL_PHONE, SENTINEL_STREET]);
});

async function caseFileOf(w, env) {
  const out = await assembleCaseContainer({ env, stub: stubOf(w), storeName: "bio", cs: w.p.caseEditionState(CASE, 1, "parks-group"), via: "test" });
  assert.equal(typeof out.manifest_sha, "string", JSON.stringify(out).slice(0, 400));
  const m = JSON.parse(dec(await bytesOf(await call(w, env, "publishedbytes", { sha256: out.manifest_sha }))));
  const zip = await bytesOf(await call(w, env, "publishedbytes", { sha256: out.manifest_sha, format: "zip" }));
  const zc = readContainer(zip);
  assert.equal(zc.ok, true);
  return { out, m, zip, read: async (name) => dec((await readPart(zip, zc, name)).bytes) };
}

test("R48 R49 the case file carries the passage statements only inside the signed document: no extra file, its format and kinds unchanged", async () => {
  const typed = [{ finding: F, ord: 0, content_id: "c-0", typed_at: "2026-09-01T10:00:00Z", typist_level: "group", typist_shown: null, checkers: [] }];
  const { w, env, doc } = published({ typed });
  const { m, read } = await caseFileOf(w, env);
  assert.deepEqual(caseFileManifestCheck(m), [], "the manifest check passes");
  assert.equal(m.format, CASE_FILE_FORMAT);
  const signedDoc = await read("case.md");
  assert.equal(signedDoc, doc, "the document as signed");
  assert.equal(sha(signedDoc), m.case_document_sha);
  assert.ok(signedDoc.includes("\nungraded_passages:\n") && signedDoc.includes("\ntyped_passages:\n"), "it holds both blocks");
  assert.ok(m.files.every((f) => !/ungraded|typed/.test(f.path) && !/ungraded|typed/.test(f.kind)), "no file of its own");
});

test("R51 the case file carries each extract in the signed document only: no segment byte, no file and nothing in unheld, even for a row signed included; ordinary documents travel whole", async () => {
  for (const extractIncluded of [false, true]) {
    const { w, env, docSha } = published({ extractIncluded });
    assert.equal(materialsOf(parseFrontmatter(w.row(`SELECT text FROM case_documents WHERE case_id=?`, CASE).text).data)
      .materials.find((r) => r.ref === EXT).included, extractIncluded, "fixture: the row as signed");
    const { out, m, zip } = await caseFileOf(w, env);
    assert.ok(m.files.every((f) => !f.path.includes(EXT) && f.sha256 !== sha(SEGMENT)), `no file of the extract (included: ${extractIncluded})`);
    assert.ok(!(out.unheld || []).some((u) => u.ref === EXT), "nothing of it named in unheld");
    assert.ok(!Buffer.from(zip).includes(Buffer.from("SEGMENT-5300")), "no byte of the segment in the package");
    assert.ok(Buffer.from(zip).includes(Buffer.from('"L-17"')) || dec(zip).includes("L-17"), "the row travels in the document");
    /* CONTROL: an ordinary document is packaged whole as before */
    assert.ok(m.files.some((f) => f.path === `materials/${DOC}/document` && f.sha256 === docSha));
  }
  /* the package digest is stable: the same edition assembled again gives the same manifest */
  const { w, env } = published();
  const a = await caseFileOf(w, env), b = await caseFileOf(w, env);
  assert.equal(a.out.manifest_sha, b.out.manifest_sha);
});

test("R52 a subject changed after publication answers one dated line by key, named only by what the caller hands in; the edition's bytes are unchanged", () => {
  const { w } = published();
  const before = w.read("publishedcase", { id: F });
  const at = "2026-10-20";
  const named = w.pr.publishedCase({ id: F, subjects: { [F]: { subject: "ENT-org", changed_at: at, reason: "a private reason",
    naming: { named: true, name: "Pine Paving Co" } } } });
  assert.deepEqual(named.findings[0].subject_changed, { key: SUBJECT_CHANGED_KEYS.named, date: at, name: "Pine Paving Co" });
  assert.equal(named.document.doc_sha, before.document.doc_sha, "the edition's signed bytes hash as before");
  assert.equal(named.document.text, before.document.text);
  assert.ok(!JSON.stringify(named).includes("a private reason"), "the reason appears on no public surface");
  const person = w.pr.publishedCase({ id: F, subjects: { [F]: { subject: "ENT-person", changed_at: at, naming: { named: false } } } });
  assert.deepEqual(person.findings[0].subject_changed, { key: SUBJECT_CHANGED_KEYS.unnamed, date: at, name: null });
  /* CONTROLS */
  assert.deepEqual(subjectChangedLine("ENT-office", { subject: "ENT-org", changed_at: at }),
                   { key: SUBJECT_CHANGED_KEYS.unnamed, date: at, name: null }, "no naming handed in: no name");
  assert.equal(subjectChangedLine("ENT-office", { subject: "ENT-office", changed_at: at, naming: { named: true, name: "X" } }), null,
               "an unchanged subject draws no line");
  assert.equal(before.findings[0].subject_changed, null, "nothing handed in: nothing drawn");
  assert.deepEqual(subjectChangedLine("ENT-office", { subject: null, changed_at: at }).key, SUBJECT_CHANGED_KEYS.removed);
  assert.equal(subjectChangedLine("ENT-office", "nonsense"), null);
});

test("R53 publishedcase answers every evidence row with name, locator and fingerprint; the group's public name is read with no credential", async () => {
  const { w, env, docSha } = published();
  w.pr.registerGroupIdentity({ identity: () => ({ group: "minutes-group", name: "Minutes Watch", domain: null, domain_verified_at: null }) });
  const c = await worker(w, env, { id: F });
  for (const r of c.materials.materials) assert.deepEqual(Object.keys(r.entry).sort(), ["fingerprint", "locator", "name"]);
  assert.deepEqual(c.materials.materials.find((r) => r.ref === DOC).entry, { name: TITLE, locator: "https://example.org/m", fingerprint: docSha });
  assert.deepEqual(c.materials.materials.find((r) => r.ref === EXT).entry,
                   { name: EXTRACT.title, locator: EXTRACT.origin, fingerprint: sha(SEGMENT) });
  assert.equal(c.group_fields.name, "Minutes Watch", "the public name, on the credential-free read");
});
