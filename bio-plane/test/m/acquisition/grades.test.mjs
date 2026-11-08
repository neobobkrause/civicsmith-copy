/* acquisition: the grade a capture earns by its route, and who may take the route. Converted from two legacy suites'
   acquisition share: `test/drive-convert.test.mjs` (with its control `test/drive-convert.control.mjs`) — a Drive
   capture grades B with Google's hop on its chain, and a plain OpenDocument file and an archive replay of one grade as
   their own routes — and `test/daemon-token.test.mjs` — the daemon class refused on a direct capture with a refusal
   naming its arms, admitted on the archive arm, and an archive capture grading C. The text chain, the readings, the ops
   table and the tokens are other modules' and are not here. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, run, sha, eligible, wayback } from "./fixture.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { ARCHIVE_CAPTURE_GRADE } from "../../../src/provenance/index.mjs";
import { ODT_CONTENT_TYPE, ODS_CONTENT_TYPE, ODP_CONTENT_TYPE } from "../../../src/odf.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { detectFormat } from "../../../src/formats.mjs";

/* A minimal STORED zip, written here so the bytes are this file's: the `mimetype` member first and stored, each member
   with its CRC-32, and a central directory the detector reads. */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
  return (c ^ 0xffffffff) >>> 0;
}
const u16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);
const u32 = (n) => Buffer.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf-8"), data = Buffer.from(f.data, "utf-8"), crc = crc32(data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length),
                                 u16(name.length), u16(0), name, data]);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length),
                                 u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    locals.push(local); offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  return new Uint8Array(Buffer.concat([...locals, cd, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]));
}
const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
         + 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"';
const MIME = { odt: ODT_CONTENT_TYPE, ods: ODS_CONTENT_TYPE, odp: ODP_CONTENT_TYPE };
const BODY = {
  odt: "<office:text><text:p>Agenda of the commission.</text:p></office:text>",
  ods: '<office:spreadsheet><table:table table:name="Budget"><table:table-row><table:table-cell office:value-type="string"><text:p>General Fund</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>',
  odp: '<office:presentation><draw:page draw:name="page1"><draw:frame><draw:text-box><text:p>Capital plan</text:p></draw:text-box></draw:frame></draw:page></office:presentation>',
};
/* Kept under 1 KiB: R17 detects the format from the first KiB read back, so a container whose central directory lies
   past it is not read from the bytes (see the last test). */
const odf = (flavour, body = BODY[flavour], pad = 0) => zip([
  { name: "mimetype", data: MIME[flavour] },
  { name: "content.xml", data: `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.3"><office:body>${body}</office:body></office:document-content>` },
  ...(pad ? [{ name: "styles.xml", data: `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS}>${" ".repeat(pad)}</office:document-styles>` }] : []),
]);
const bin = (b, ct) => new Response(b, { headers: { "content-type": ct } });

const ID = { doc: "1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTt", sheet: "1BbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu", slides: "1CcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVv" };
const DRIVE = [
  { fmt: "odt", kind: "document", link: `https://docs.google.com/document/d/${ID.doc}/edit`, exp: `https://docs.google.com/document/d/${ID.doc}/export?format=odt` },
  { fmt: "ods", kind: "spreadsheet", link: `https://docs.google.com/spreadsheets/d/${ID.sheet}/edit#gid=0`, exp: `https://docs.google.com/spreadsheets/d/${ID.sheet}/export?format=ods` },
  { fmt: "odp", kind: "presentation", link: `https://docs.google.com/presentation/d/${ID.slides}/edit`, exp: `https://docs.google.com/presentation/d/${ID.slides}/export?format=odp` },
];

/* The archive arm over a scripted Memento archive (fixture `wayback`): one memento of `original`, whose raw form
   answers `bytes`. */
const archive = (original, bytes, ct) => wayback([{ ts: "20240115120000", body: bytes, ct }], { address: original });

test("R18 R4: a Drive capture of a document, spreadsheet or presentation grades the direct ceiling, and its chain carries Google's hop confirmed from the bytes", async () => {
  const w = world();
  for (const d of DRIVE) {
    const bytes = odf(d.fmt);
    const r = await run(w, { [d.exp]: bin(bytes, MIME[d.fmt]) }, { locator: d.link, authority: "City Clerk" });
    assert.equal(r.status, 200, d.fmt);
    const doc = r.body.document;
    assert.equal(doc.capture.grade, EARNED_CAPTURE_CEILING, `${d.fmt}: the fetch was direct, so the conversion does not touch the grade`);
    assert.equal(doc.capture.grade, "B");
    assert.equal(doc.capture.sha256, sha(bytes));
    assert.deepEqual(r.net.seen.map((x) => x.url), [d.exp], `${d.fmt}: the composed export, and only it`);
    const chain = doc.provenance_chain;
    assert.equal(chain.length, 2, `${d.fmt}: this instance's hop, then Google's`);
    assert.deepEqual([chain[0].via, chain[1].via, chain[1].bound], ["direct", "direct", false]);
    const g = chain[1];
    assert.equal(g.who, "Google Drive (Google Drive export)");
    assert.deepEqual([g.export_address, g.export_format, g.producer, g.drive_kind, g.drive_file_id, g.document_address],
                     [d.exp, d.fmt, word("drive.google_drive_export"), d.kind, ID[d.kind === "document" ? "doc" : d.kind === "spreadsheet" ? "sheet" : "slides"], d.link]);
    assert.equal(g.export_format_confirmed, true, `${d.fmt}: the flavour is confirmed from the bytes, not from Google's content type`);
    assert.ok(bytes.length < 1024, "within the first KiB R17 reads back");
    assert.deepEqual([doc.profile.format.format, doc.profile.format.confidence], [d.fmt, "certain"], "the format the hop confirms is the one detected from the bytes");
    assert.equal(w.prov.receipts.at(-1).address, d.link, "the record keeps the Drive link as given");
    assert.equal(w.prov.receipts.at(-1).retrievalLocator, d.exp);
    assert.equal(w.prov.receipts.at(-1).via, "direct");
  }
  /* negative control: bytes that are not the asked-for flavour are filed with the disagreement stated, never confirmed */
  const d = DRIVE[0];
  const sheetBytes = odf("ods");
  const mis = await run(w, { [d.exp]: bin(sheetBytes, ODT_CONTENT_TYPE) }, { locator: d.link });
  assert.equal(mis.status, 200);
  const hop = mis.body.document.provenance_chain[1];
  assert.deepEqual([hop.export_format, hop.export_format_confirmed], ["odt", false], "the confirmation is read from the bytes, never from the declared type");
  { const seen = detectFormat(sheetBytes, null);
    assert.ok(hop.evidence.includes(word("capture-sources.drive.not_confirmed_from_the_bytes", { format: "odt", format_2: seen.format, confidence: seen.confidence, signals: seen.signals.join("; ") })), "stated as not confirmed, in the word table's sentence"); }
  assert.equal(mis.body.document.capture.grade, EARNED_CAPTURE_CEILING, "still a direct fetch");
});

test("R18: a plain OpenDocument file on an ordinary host grades as a direct fetch and carries no Google hop (over-strictness)", async () => {
  const w = world();
  const city = odf("odt", "<office:text><text:p>Notice of public hearing.</text:p></office:text>");
  const r = await run(w, { "https://city.example/notice.odt": bin(city, ODT_CONTENT_TYPE) }, { locator: "https://city.example/notice.odt", authority: "City Clerk" });
  assert.equal(r.status, 200);
  const doc = r.body.document;
  assert.equal(doc.capture.grade, EARNED_CAPTURE_CEILING);
  assert.deepEqual(doc.provenance_chain.map((h) => h.via), ["direct"], "one hop: the same container is not a Drive export");
  assert.ok(!doc.provenance_chain.some((h) => "export_format" in h || /Google/.test(h.who)));
  assert.equal(doc.profile.format.format, "odt");
  assert.deepEqual([w.prov.receipts[0].address, w.prov.receipts[0].retrievalLocator], ["https://city.example/notice.odt", "https://city.example/notice.odt"]);
});

test("R18 R3 F1 (BD-18): an archive-sourced OpenDocument raw replay grades the archive letter, via archive, the ceiling, with the archive's hop and no Google hop", async () => {
  const w = world();
  const addr = "https://city.example/minutes.odt";
  const replayed = odf("odt", "<office:text><text:p>Archived minutes of the committee.</text:p></office:text>");
  await eligible(w, addr);
  const r = await run(w, archive(addr, replayed, ODT_CONTENT_TYPE), { via: "archive.org", address: addr }, { cls: "admin", member: false });
  assert.equal(r.status, 200);
  const doc = r.body.document;
  assert.equal(doc.capture.grade, ARCHIVE_CAPTURE_GRADE, "provenance's one definition");
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING, "a raw replay is the publisher's response: the ceiling (BD-18)");
  assert.deepEqual([doc.capture.via_archive, doc.capture.custodian, doc.capture.fetched_at, "reference_only" in doc.capture],
                   [true, "web.archive.org", "2024-01-15T12:00:00Z", false], "via archive, the snapshot its fetch date, the archive its custodian");
  assert.equal(doc.capture.sha256, sha(replayed));
  assert.deepEqual(doc.provenance_chain.map((h) => h.via), ["archive.org", "archive.org"], "a two-hop chain, both through the archive");
  assert.ok(!doc.provenance_chain.some((h) => "export_format" in h), "a replay is not a conversion");
  assert.equal(doc.capture.authority, "Internet Archive");
  assert.deepEqual([w.prov.receipts[0].address, w.prov.receipts[0].via], [addr, "archive.org"]);
});

test("R1: a daemon is refused NOT_PERMITTED on a direct capture, and the refusal names the two arms it may use; nothing is fetched", async () => {
  const w = world();
  for (const locator of ["https://city.example/direct.pdf", DRIVE[0].link]) {
    const r = await run(w, { [locator]: bin("%PDF-1.4", "application/pdf") }, { locator }, { cls: "daemon", member: false, sessMember: null });
    assert.deepEqual([r.status, r.body.ok, r.body.reason, r.body.cls], [403, false, "NOT_PERMITTED", "daemon"], locator);
    assert.match(String(r.body.detail), /via: "archive\.org"/, "the archive fallback, named");
    assert.match(String(r.body.detail), /via: "capture-request"/, "the capture-request drain, named");
    assert.equal(r.net.seen.length, 0);
  }
  assert.equal(w.prov.receipts.length, 0, "nothing filed");
  /* negative controls: an operator's and a member's direct capture are untouched by the narrowing */
  for (const o of [{ cls: "admin", member: false, sessMember: null }, {}]) {
    const ok = await run(w, { "https://city.example/direct.pdf": bin("%PDF-1.4", "application/pdf") }, { locator: "https://city.example/direct.pdf" }, o);
    assert.equal(ok.status, 200, JSON.stringify(o));
  }
});

test("R1 R18 F1 (BD-18): the daemon is admitted on the archive arm, files the capture as the daemon with the two-hop chain, and its raw replay grades the archive letter via archive; a member still cannot take that arm", async () => {
  const w = world();
  const addr = "https://city.example/agenda.pdf";
  const archived = new Uint8Array(6000).map((_, i) => (i * 17 + 3) % 256);
  await eligible(w, addr);
  const r = await run(w, archive(addr, archived, "application/pdf"), { via: "archive.org", address: addr }, { cls: "daemon", member: false, sessMember: null });
  assert.equal(r.status, 200);
  const doc = r.body.document;
  assert.equal(doc.capture.grade, ARCHIVE_CAPTURE_GRADE, "a raw replay: the archive letter (BD-18)");
  assert.deepEqual([doc.capture.grade, doc.capture.via_archive, doc.capture.custodian], [EARNED_CAPTURE_CEILING, true, "web.archive.org"]);
  assert.deepEqual([doc.capture.actor_class, doc.capture.actor], ["daemon", null]);
  assert.equal(doc.provenance_chain.length, 2);
  assert.equal(doc.capture.sha256, sha(archived));
  /* an operator on the same arm earns the same letter: the grade is the route's, not the class's */
  await eligible(w, addr);
  const adm = await run(w, archive(addr, archived, "application/pdf"), { via: "archive.org", address: addr }, { cls: "admin", member: false, sessMember: null });
  assert.deepEqual([adm.status, adm.body.document.capture.grade], [200, ARCHIVE_CAPTURE_GRADE]);
  /* the widening admitted one class, not everyone */
  await eligible(w, addr);
  const mem = await run(w, archive(addr, archived, "application/pdf"), { via: "archive.org", address: addr });
  assert.deepEqual([mem.status, mem.body.ok, mem.body.reason, mem.net.seen.length], [403, false, "NOT_PERMITTED", 0]);
});

/* Found by this convert and fixed in the job: `profile.format` reads only the first KiB (R17), and an export's central
   directory lies past it, so its detection could fall back to the DECLARED type; the hop took that as a confirmation.
   The hop's confirmation is now a detection over the stored export's bytes, whole. */
test("R4 R18: over 1 KiB, an export whose bytes are another flavour than was asked for is never recorded as confirmed from the bytes", async () => {
  const w = world();
  const d = DRIVE[0];
  const sheetBytes = odf("ods", BODY.ods, 2000);
  assert.ok(sheetBytes.length > 1024);
  const r = await run(w, { [d.exp]: bin(sheetBytes, ODT_CONTENT_TYPE) }, { locator: d.link });
  assert.equal(r.status, 200);
  assert.equal(r.body.document.capture.grade, EARNED_CAPTURE_CEILING);
  const hop = r.body.document.provenance_chain[1];
  assert.equal(hop.export_format_confirmed, false, "ODS bytes are not a confirmed ODT");
  assert.match(hop.evidence, /NOT confirmed from the bytes: odt was asked for and the bytes detect as ods \(certain\)/, "the disagreement is stated, from the bytes");
  /* the same export, declared honestly and over 1 KiB, is confirmed from its bytes, never from the label */
  const textBytes = odf("odt", BODY.odt, 2000);
  const ok = await run(world(), { [d.exp]: bin(textBytes, "application/octet-stream") }, { locator: d.link });
  assert.equal(ok.body.document.provenance_chain[1].export_format_confirmed, true, "confirmed by the bytes whatever the declared type");
});
