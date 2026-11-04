/* R3's leg pass (REC-83, REC-220, IC-84 (4)): what each leg of an inquiry rests on at the earned read — its content row
   (named, or minted as inquiry's projection mints it, or backfilled here), which capture it rests on, the two legitimate
   nulls, and the registry at content grain (R1). Copied from inquiry's `content-legs.test.mjs` at the split (K617): the
   tests of the read move here unchanged in what they hold; those of inquiry's check and projection stay inquiry's. The
   legs are written by R12's one write as the projection writes them (the fixture's `legs`). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd, infoMd, provDoc, sha, V } from "./fixture.mjs";
import { contentIdFor } from "../../../src/content/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { LEG_BACKFILL_MAX } from "../../../src/leg-earning/index.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

/* ------------------------------------------------------------------------------------------------ helpers */

/** A leg's own fields as frontmatter scalars (the restricted grammar holds no nested object in an array element). */
const legLines = (legs) => ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role || "supports"}`,
  ...Object.entries(l.f || {}).map(([k, v]) => `    ${k}: ${v}`)])];
/** An inquiry whose legs carry extent / capture / content-id fields, each target cited. */
const md = (id, legs, { subject = null } = {}) => inquiryMd(id, { subject,
  refs: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t })), extra: legs.length ? legLines(legs) : [] });
const q = (s) => `"${s}"`;

/** A scoped chain: a document whose pages each name themselves, which is what gives the capture a page set. */
const scoped = (pages, cap = "C") => [
  { step: "pixels", extent: { kind: "pages", pages } },
  { step: "ocr", engine: "tesseract", version: "5.3.4", cap, confidence: { basis: "none" }, extent: { kind: "pages", pages } }];
const LAYER = [{ step: "layer" }];

/** A revision of an information bundle over its head: `caps` [{path, text, chain?}] are every capture it holds
 *  (their bytes carried), `register` the new ones this revision registers. */
let revs = 0;
function redoc(w, id, caps, register = []) {
  const all = caps.map((c) => ({ ...c, sha: sha(c.text) }));
  const reading = (c) => (c.chain === undefined ? null
    : { content_type: "meeting_calendar", reader_version: 1, found: false, at: "2026-09-27T00:00:00Z", entities: [], facts: {},
        ...(c.chain === null ? {} : { text_source: c.chain }) });
  const files = [{ path: "bundle.md", text: infoMd(id) }, ...all.map((c) => ({ path: c.path, text: c.text })),
    { path: "data/provenance.json", text: JSON.stringify({ documents: all.map((c) =>
        (reading(c) ? { ...provDoc(c), reading: reading(c) } : provDoc(c))) }, null, 2) }];
  const r = w.promotion.promote({ bundleId: id, base: w.record.head(id).bundleSha, snapKey: `re-${id}-${++revs}`,
    author: "member:alice", files, meta: { object_type: "information" },
    register: all.filter((c) => register.includes(c.path))
      .map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 500));
  return all.map((c) => c.sha);
}
/** An information bundle this record holds no capture of: its document alone, through the promotion. */
function uncaptured(w, id) {
  const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `bare-${id}`, author: "member:alice",
    files: [{ path: "bundle.md", text: infoMd(id) }], meta: { object_type: "information" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
}
const capOf = (w, cid) => w.content.contentRow(cid)?.capture_sha ?? null;
const legOf = (r, ord) => (r.legs || []).find((l) => l.ord === ord) || null;

const BOOK = "INFO-2026-0001-book", TEXT = "INFO-2026-0002-text", DECK = "INFO-2026-0003-deck";
const PAGED = "INFO-2026-0004-paged", BARE = "INFO-2026-0005-bare", NOCAP = "INFO-2026-0006-nocap";

/* ------------------------------------------------------------------------------------------------ R3: REC-220's version */

test("R3 which capture each leg rests on: pinned by its bytes (extent_capture or content_id), only_capture, or undetermined naming the count held and the row's capture, never back-filled", () => {
  const w = world();
  const DOC = "INFO-2026-0901-doc";
  const [A] = w.doc(DOC, ["capture A"]);
  const Q1 = "INQ-2026-0901-pinned", Q2 = "INQ-2026-0902-unpinned", Q3 = "INQ-2026-0903-question";
  assert.equal(w.promoteInquiry(Q1, md(Q1, [{ target: DOC, f: { extent_capture: q(A) } }])).ok, true);
  w.inquiry(Q2, { legs: [{ target: DOC }] });
  const legAt = (id, target) => { const l = w.k.earnedBasis({ id, viewer: "admin" }).legs.find((x) => x.target === target);
    return { cid: l.content_id ?? null, capture: l.content_id ? capOf(w, l.content_id) : null, version: l.version ?? null, null_case: l.null_case ?? null }; };
  const c1 = legAt(Q1, DOC);
  assert.deepEqual(c1.version, { state: "pinned", by: "extent_capture", capture: A });
  assert.deepEqual(legAt(Q2, DOC).version, { state: "only_capture", capture: A });
  /* a second capture held: the unpinned leg is undetermined, its row's capture named and never moved; the pin holds */
  redoc(w, DOC, [{ path: "snapshots/c0.txt", text: "capture A" }, { path: "snapshots/b.txt", text: "capture B" }], ["snapshots/b.txt"]);
  const c2 = legAt(Q2, DOC);
  assert.deepEqual([c2.version.state, c2.version.resolved_capture, c2.version.captures_held, "capture" in c2.version],
                   ["undetermined", A, 2, false]);
  assert.match(c2.version.detail, /undetermined/);
  assert.equal(w.fm(Q2).basis[0].extent_capture, undefined, "nothing is written into the leg's bytes");
  assert.deepEqual(legAt(Q1, DOC).version, { state: "pinned", by: "extent_capture", capture: A }, "two held, still pinned");
  /* a leg naming a content id is pinned by it; a leg onto a question carries no version, its null case says why */
  assert.equal(w.promoteInquiry(Q3, md(Q3, [{ target: Q1 }, { target: DOC, role: "cuts_against", f: { content_id: c1.cid } }])).ok, true);
  const c3 = legAt(Q3, DOC);
  assert.deepEqual([c3.cid, c3.capture, c3.version], [c1.cid, A, { state: "pinned", by: "content_id", capture: A }]);
  const onQ = legAt(Q3, Q1);
  assert.deepEqual([onQ.version, onQ.null_case], [null, "INQUIRY_TARGET"]);
});

/* ------------------------------------------------------------------------------------------------ R1 R3: the earned read */

test("R1 R3 earnedBasis at content grain: a portion's connection axis is undetermined with the empty level named (NO_CONNECTION), never borrowed; a document row earns its document's", () => {
  const w = world(); w.entity("ENT-2026-0001", "Sewer Fund Transfer Ordinance");
  const [cap] = w.doc(PAGED, ["paged"], { chain: scoped([0, 1, 2]) });
  w.resolve(cap, PAGED, "ordinance:24680", "ENT-2026-0001", "A");
  const r = w.promoteInquiry("INQ-2026-1001-q", md("INQ-2026-1001-q", [{ target: PAGED },
    { target: PAGED, f: { extent_kind: "pdf-page", extent_page: 1, extent_rect: "[10, 20, 100, 200]", extent_ref: q("page 2, the transfer table") } }],
    { subject: "ENT-2026-0001" }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const [DOC_ROW, PAGE_ROW] = r.content.map((c) => c.content_id);
  const eb = w.k.earnedBasis({ id: "INQ-2026-1001-q", viewer: "admin" });
  assert.deepEqual(Object.keys(eb.earned.content).sort(), [DOC_ROW, PAGE_ROW].sort());
  const d = eb.earned.content[DOC_ROW].connection, p = eb.earned.content[PAGE_ROW].connection;
  assert.deepEqual([d.determined, d.grain, d.grade], [true, "document", "A"], "the document row: its portion IS the document");
  assert.equal(d.grade, eb.earned.connection[PAGED].grade);
  assert.deepEqual([p.determined, p.grain, p.grade, p.undetermined_because], [false, "portion", null, "NO_CONNECTION"]);
  assert.match(p.empty_level, /^connection — /);
  assert.match(p.empty_level, /end of no connection through this subject/);
  assert.ok(String(p.why).includes(`nothing for ${eb.earned.content[PAGE_ROW].ref} to earn from`), p.why);
  assert.match(p.why, /end of no connection/);
  assert.equal(Object.prototype.hasOwnProperty.call(p, "document_grade"), false, "never borrowed from the document");
  assert.equal(Object.values(eb.earned.content).filter((c) => c.extent_kind !== "document")
    .filter((c) => c.connection.grade !== null || c.connection.determined !== false).length, 0);
  assert.deepEqual([legOf(eb, 0).null_case ?? null, legOf(eb, 1).null_case ?? null], [null, null],
    "a leg with a referent carries no null case");
});

test("R1 R3 earnedBasis for a cell leg: names the leg's row; its standing is about THIS extent, its connection and transcription undetermined and stated, its ref the cell", () => {
  const w = world(); w.doc(BOOK, ["book"], { chain: LAYER });
  const r = w.promoteInquiry("INQ-2026-1101-c", md("INQ-2026-1101-c", [{ target: BOOK,
    f: { extent_kind: "sheet-cell", extent_sheet: q("Sheet1"), extent_cell: q("B14") } }]));
  const ROW = r.content[0].content_id;
  const eb = w.k.earnedBasis({ id: "INQ-2026-1101-c", viewer: "admin" });
  assert.deepEqual([eb.ok, eb.legs.length, eb.legs[0].content_id], [true, 1, ROW]);
  const s = eb.earned.content[ROW];
  assert.deepEqual([s.extent_kind, s.extent.sheet, s.extent.cell], ["sheet-cell", "Sheet1", "B14"]);
  assert.deepEqual([s.connection.determined, s.connection.grain, s.connection.undetermined_because], [false, "portion", "NO_CONNECTION"]);
  assert.equal(s.transcription.ceiling, null);
  assert.match(s.transcription.why, /what a sheet-cell extent covers cannot yet be evaluated/);
  assert.equal(s.ref, "Sheet1!B14");
});

test("R3 the backfill: a leg promoted before its document was captured gets exactly the hashed document row on the first read, and is found, not re-minted, on the next", () => {
  const w = world();
  const LATE = "INFO-2026-1201-late", Q = "INQ-2026-1201-q";
  uncaptured(w, LATE);
  const first = w.promoteInquiry(Q, md(Q, [{ target: LATE }]));
  assert.deepEqual([first.ok, first.content], [true, undefined], "the leg lands with no referent");
  const CHAIN = scoped([0, 1]);
  const [cap] = redoc(w, LATE, [{ path: "snapshots/l.txt", text: "captured after the leg", chain: CHAIN }], ["snapshots/l.txt"]);
  const eb = w.k.earnedBasis({ id: Q, viewer: "admin" });
  const leg = legOf(eb, 0);
  assert.deepEqual([leg.content_id != null, leg.backfilled], [true, true]);
  assert.equal(leg.content_id, contentIdFor(cap, { kind: "document" }, CHAIN), "the id the hash answers");
  assert.deepEqual([eb.earned.content[leg.content_id]?.extent_kind, eb.earned.content[leg.content_id]?.bundle_id], ["document", LATE]);
  const again = legOf(w.k.earnedBasis({ id: Q, viewer: "admin" }), 0);
  assert.deepEqual([again.content_id, !!again.backfilled], [leg.content_id, false]);
  assert.equal(w.content.contentRow(leg.content_id).bundle_id, LATE);
});

test("R3 the backfill's bound bites at LEG_BACKFILL_MAX over 51 legs, says so, names the rest NOT_YET_RESOLVED needing no cursor, and the next read continues onto one row", () => {
  const w = world();
  const MANY = "INFO-2026-1301-many", Q = "INQ-2026-1301-q", OVER = LEG_BACKFILL_MAX + 1;
  uncaptured(w, MANY);
  assert.equal(w.promoteInquiry(Q, md(Q, Array.from({ length: OVER }, () => ({ target: MANY })))).ok, true);
  redoc(w, MANY, [{ path: "snapshots/m.txt", text: "captured after fifty-one legs", chain: scoped([0]) }], ["snapshots/m.txt"]);
  const first = w.k.earnedBasis({ id: Q, viewer: "admin" });
  assert.deepEqual([first.legs.length, first.legs.filter((l) => l.content_id).length], [OVER, LEG_BACKFILL_MAX]);
  assert.equal(first.backfill_truncated, true);
  const left = first.legs.find((l) => !l.content_id);
  assert.equal(left.null_case, "NOT_YET_RESOLVED");
  assert.match(left.why_no_content, /needs no cursor/);
  const second = w.k.earnedBasis({ id: Q, viewer: "admin" });
  assert.deepEqual([second.legs.filter((l) => l.content_id).length, second.backfill_truncated ?? false], [OVER, false]);
  assert.equal(new Set(second.legs.map((l) => l.content_id)).size, 1, "51 legs onto one referent");
});

test("R3 the two legitimate nulls are stated as which, each with its own sentence, never collapsed", () => {
  const w = world();
  const TARGET = "INQ-2026-1401-t", NOBYTES = "INFO-2026-1401-nobytes", Q = "INQ-2026-1402-q";
  w.inquiry(TARGET);
  uncaptured(w, NOBYTES);
  assert.equal(w.promoteInquiry(Q, md(Q, [{ target: TARGET }, { target: NOBYTES }])).ok, true);
  const eb = w.k.earnedBasis({ id: Q, viewer: "admin" });
  const inq = legOf(eb, 0), none = legOf(eb, 1);
  assert.deepEqual([inq.content_id ?? null, none.content_id ?? null], [null, null]);
  assert.equal(inq.null_case, "INQUIRY_TARGET");
  assert.match(inq.why_no_content, /an inquiry rather than a/); assert.match(inq.why_no_content, /DEC-21/);
  assert.equal(none.null_case, "NO_BYTES_HELD");
  assert.match(none.why_no_content, /holds no capture of/);
  assert.match(none.why_no_content, /never evidence about what the document says/);
});

test("R1 a whole-document attestation of a chainless capture does not raise a member's typing through a leg; a second member's attestation of the typing does", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC_N = "INFO-2026-1501-nochain", QN = "INQ-2026-1501-qn";
  const [capN] = w.doc(DOC_N, ["no chain was ever recorded"], { chain: null });
  const at = w.content.attestText({ captureSha: capN, member: "sam", at: "2026-09-27T00:00:00Z",
                                    extent: { kind: "document" }, viewer: V("sam"), note: "Checked against the original." });
  assert.deepEqual([at.ok, at.chain_at_attestation], [true, null], JSON.stringify(at).slice(0, 300));
  const tx = w.content.transcribe({ bundleId: DOC_N, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "ruth", viewer: V("ruth"), at: "2026-09-27T00:00:00Z" });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  assert.equal(w.promoteInquiry(QN, md(QN, [{ target: DOC_N, f: { content_id: q(tx.content_id) } }])).ok, true);
  const ceil = (id) => { const s = w.k.earnedBasis({ id, viewer: "admin" }).earned.content?.[tx.content_id];
    return s ? [s.transcription.ceiling, s.transcription.determinant, s.transcription.by] : null; };
  /* text-chain R107: the typing stands on the typist's word; the capture attestation checked other text */
  assert.deepEqual(ceil(QN), [TYPED_UNCHECKED_GRADE, "typist", ["ruth"]], "the capture attestation checked other text");
  const sa = w.content.transcriptionAttest({ contentId: tx.content_id, attestor: "sam", viewer: V("sam"), at: "2026-09-27T01:00:00Z",
                                            note: "The typing matches the page." });
  assert.equal(sa.ok, true, JSON.stringify(sa).slice(0, 300));
  assert.deepEqual(ceil(QN), [TYPED_CHECKED_GRADE, "second_member", ["sam"]], "the leg earns what the typing's attestation supports");
});
