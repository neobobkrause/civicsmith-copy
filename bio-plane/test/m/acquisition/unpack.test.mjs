/* acquisition: archives opened on capture, each file at its archive's grade (R17, R20, R25–R27, R38, R39; N688, K1844,
   K1852, K1940), at the module's interface: `acquire(store, body, opts)` over a scripted network (fixture.mjs `run`),
   and `unpack(store, {archiveSha, by, cls})`, over test-support's ZIP writer (`make-zip.mjs`) for every hostile shape.
   R40's budgets are budgets.test.mjs's, R41's read archivelist.test.mjs's. */
import { test } from "node:test";
import { localize, word } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { world, run, sha, text, wayback, eligible } from "./fixture.mjs";
import { makeZip } from "../../make-zip.mjs";
import { unpack, ARCHIVE_CHECKS, firstHopWho } from "../../../src/acquisition/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE } from "../../../src/provenance/index.mjs";
import { ARCHIVE_LIMITS } from "../../../src/ooxml.mjs";

const URL1 = "https://files.example/bundle.zip";
const zipRes = (bytes, ct = "application/zip") => () => new Response(bytes, { headers: { "content-type": ct } });
const capture = (w, bytes, o = {}, url = URL1) => run(w, { [url]: zipRes(bytes) }, { locator: url }, o);
const row = (code) => [ARCHIVE_CHECKS[code].check, ARCHIVE_CHECKS[code].translation];
const enc = (s) => new TextEncoder().encode(s);
const PDF = enc("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
/* the archive's entry rows and its own row, as R38 recorded them */
const recorded = (w, s) => w.rows("SELECT idx, state, code, sha256, limit_name FROM archive_entries WHERE archive_sha=? ORDER BY idx", s);

/* Mark entry `k`'s central record as a Unix symbolic link (version made by 3, mode 0o120777): the shape a Unix zip
   writes for a link, which make-zip.mjs does not write itself. */
function asSymlink(bytes, k) {
  const b = new Uint8Array(bytes);
  let seen = -1;
  for (let i = 0; i + 4 <= b.length; i++)
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 1 && b[i + 3] === 2 && ++seen === k) {
      b[i + 5] = 3;
      b.set([0, 0, 0xff, 0xa1], i + 38);
      return b;
    }
  throw new Error("no such central record");
}

test("R17 R40: an acquired plain ZIP is profiled `zip` and opened in the same call; an office file and an OpenDocument file are never `zip`, and a non-archive opens nothing", async () => {
  const w = world();
  const z = makeZip([{ name: "a.txt", data: "alpha" }, { name: "b.pdf", data: PDF }]);
  const r = await capture(w, z);
  assert.equal(r.status, 200);
  assert.equal(r.body.document.profile.format.format, "zip");
  assert.equal(r.body.unpack.ok, true);
  assert.deepEqual(r.body.unpack.documents.map((d) => d.container.path), ["a.txt", "b.pdf"]);
  assert.equal(r.body.unpack.complete, true);
  /* negative controls: OPC and ODF containers carry their declarations, so they are never `zip` and never opened */
  for (const [label, entries] of [
    ["docx", [{ name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
              { name: "word/document.xml", data: "<w:document/>" }]],
    ["odt", [{ name: "mimetype", data: "application/vnd.oasis.opendocument.text", method: 0 }, { name: "content.xml", data: "<office:document-content/>" },
             { name: "META-INF/manifest.xml", data: "<manifest/>" }]]]) {
    const o = await capture(world(), makeZip(entries));
    assert.notEqual(o.body.document.profile.format.format, "zip", label);
    assert.equal("unpack" in o.body, false, label);
  }
  const t = await run(world(), { "https://a.example/x": text("plain") }, { locator: "https://a.example/x" });
  assert.equal("unpack" in t.body, false);
});

test("R17 R10: a ZIP held in parts (past the read's bound) is profiled `zip` from its stored bytes and opened across its parts; an OpenDocument file in parts is not, and a declared application/zip whose bytes are not one is not", async () => {
  const big = new Uint8Array(9 * 1024 * 1024).map((_, i) => (i * 2654435761) >>> 24);
  const z = makeZip([{ name: "big.bin", data: big, method: 0 }, { name: "small.txt", data: "s" }]);
  const w = world();
  const r = await capture(w, z);
  assert.equal(r.body.parts, 2, "the archive is held in two parts");
  assert.equal(r.body.document.profile.format.format, "zip");
  assert.ok(r.body.document.profile.format.signals.includes(word("format-registry.formats.container_judged_from_end", { size: String(r.body.document.capture.bytes) })), "judged from the end record and the central directory, in the registry's word");
  const [bigDoc, smallDoc] = r.body.unpack.documents;
  assert.equal(bigDoc.capture.sha256, sha(big), "cut exactly across the archive's parts");
  assert.equal(bigDoc.parts.length, 2, "a file over 8 MiB is stored in parts of 8 MiB (R10's form)");
  assert.deepEqual(bigDoc.parts.map((p) => p.bytes), [8 * 1024 * 1024, big.length - 8 * 1024 * 1024]);
  assert.match(bigDoc.parts[0].file, /^snapshots\/zip-[0-9a-f]{64}-0\.part000$/);
  assert.equal(smallDoc.capture.sha256, sha("s"));
  /* an ODF package in parts: mimetype first, stored */
  const odf = makeZip([{ name: "mimetype", data: "application/vnd.oasis.opendocument.text", method: 0 }, { name: "Pictures/p.bin", data: big, method: 0 },
                       { name: "content.xml", data: "<x/>" }, { name: "META-INF/manifest.xml", data: "<m/>" }]);
  const o = await capture(world(), odf);
  assert.equal(o.body.parts, 2);
  assert.notEqual(o.body.document.profile.format.format, "zip");
  assert.equal("unpack" in o.body, false);
  /* bytes that are not an archive, declared application/zip and held in parts: not `zip`, nothing opened */
  const n = await capture(world(), new Uint8Array(9 * 1024 * 1024).fill(7));
  assert.equal(n.body.document.profile.format.format, "undetermined");
  assert.ok(n.body.document.profile.format.signals.includes(word("acquisition.index.the_stored_bytes_were_not")), "a declared type never makes a ZIP, and the profile says so");
  assert.equal("unpack" in n.body, false);
});

test("R38 R39 R26: each file is cut out exactly, stored under its own digest, receipted `unpacked` at the archive's address with #zip:<index>, and answers its own document at the archive's grade", async () => {
  const w = world();
  const z = makeZip([{ name: "docs/a.pdf", data: PDF }, { name: "notes.txt", data: "hello notes" }]);
  const r = await capture(w, z);
  const archiveSha = sha(z);
  const [d0, d1] = r.body.unpack.documents;
  assert.deepEqual(w.bytesOf(d0.capture.sha256), PDF, "the archive's own bytes, cut out exactly");
  assert.deepEqual(w.bytesOf(archiveSha), z, "the archive itself is never rewritten");
  /* R39's document */
  assert.equal(d0.capture.method, "unpacked");
  assert.equal(d0.capture.grade, EARNED_CAPTURE_CEILING, "its archive's letter (a direct fetch), as captureGrade answers it once the receipt is written");
  assert.equal(d0.capture.sha256, sha(PDF));
  assert.deepEqual([d0.capture.encoding, d0.capture.bytes, d0.capture.content_type], ["binary", PDF.length, "application/pdf"]);
  assert.equal("transport" in d0.capture, false, "no response, so no transport and no header is recorded");
  assert.equal(d1.capture.content_type, "text/plain", "bytes with no magic are typed by R102's rule from the entry's name (R39, G163); a type neither shows stays absent (r123-batch-d.test.mjs)");
  assert.deepEqual([d0.capture.actor_class, d0.capture.actor], ["member", "m1"]);
  assert.equal(d0.locator, `${URL1}#zip:0`);
  assert.equal(d0.file, `snapshots/zip-${archiveSha}-0`, "named from the archive's digest and the index, never the entry's name");
  assert.match(d0.retrieved, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(d0.provenance_chain.length, 1);
  const hop = d0.provenance_chain[0];
  assert.equal(hop.who, firstHopWho("inst", "9.9.9"));
  assert.equal(hop.asserts, localize("acquisition.unpack.these_bytes_are_entry_index", "these bytes are entry {index} ({v1}, the archive's own claim) of the archive {sha} held by your team's Civicsmith, cut out and verified by size and CRC-32 at {at}", { index: "0", v1: "docs/a.pdf", sha: archiveSha, at: d0.retrieved }));
  assert.deepEqual([hop.bound, hop.via, hop.archive_sha256], [false, "unpacked", archiveSha]);
  assert.equal(d0.provenance_chain.length, 1, "the archive's hop is cited, never copied");
  assert.deepEqual(d0.container, { archive_sha256: archiveSha, index: 0, path: "docs/a.pdf", name_raw: Buffer.from("docs/a.pdf").toString("hex"),
    method: 8, crc32: d0.container.crc32, compressed: d0.container.compressed, uncompressed: PDF.length, local_offset: 0,
    member_sha256: sha(PDF), dos_time_stated: d0.container.dos_time_stated, name_shared: 1, path_unsafe: false });
  assert.match(d0.container.dos_time_stated, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/, "the archive's statement, with no zone");
  assert.deepEqual(d0.origin, r.body.document.origin, "the archive document's origin");
  assert.deepEqual(d0.attestation_attempts, [], "R20: a file carries its archive's co-attestation, and asks none of its own");
  assert.equal(d0.profile.format.format, "pdf", "R17's profile over the file's own bytes");
  assert.equal(d0.authority_state, "undetermined");
  /* the receipts (provenance R15) */
  const rec = w.prov.receipts.filter((x) => x.via === "unpacked");
  assert.deepEqual(rec.map((x) => [x.address, x.addressNorm, x.captureSha, x.retrievalLocator]), [
    [`${URL1}#zip:0`, `${URL1}#zip:0`, sha(PDF), `zip:${archiveSha}!0`],
    [`${URL1}#zip:1`, `${URL1}#zip:1`, sha("hello notes"), `zip:${archiveSha}!1`]]);
  /* R20: no attestation request was made for the files: only the archive's own */
  assert.ok(r.net.attest.every((x) => !x.url.includes(sha(PDF))));
  /* the answer */
  assert.deepEqual(r.body.unpack.archive, { sha256: archiveSha, entries: 2, declared_total: PDF.length + 11 });
  assert.deepEqual([r.body.unpack.already_held, r.body.unpack.not_filed, r.body.unpack.nested, r.body.unpack.waiting, r.body.unpack.complete],
                   [[], [], [], 0, true]);
  assert.deepEqual(recorded(w, archiveSha).map((x) => [x.idx, x.state]), [[-1, "opened"], [0, "filed"], [1, "filed"]]);
});

test("R39 F1 (BD-18): a file of an archive captured from a web archive carries that archive's letter, never stronger or weaker: a raw replay's archive letter, a rewritten replay's reference-only letter", async () => {
  const cases = [
    /* the archive's receipt says archive.org at a raw (`id_`) replay: the archive letter, via archive */
    ["https://web.archive.org/web/20250101000000id_/https://a.example/x.zip", ARCHIVE_CAPTURE_GRADE, "makes-raw.txt"],
    /* at a rewritten replay: the rewritten letter, reference only */
    ["https://web.archive.org/web/20250101000000/https://a.example/x.zip", REWRITTEN_REPLAY_GRADE, "makes-rewritten.txt"]];
  for (const [retrievalLocator, letter, name] of cases) {
    const w = world();
    const z = makeZip([{ name, data: "x" }]);
    w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "archive.org", retrievalLocator });
    await w.b.put(`bio/captures/${sha(z)}`, z);
    const u = await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member" });
    assert.equal(u.documents[0].capture.grade, letter, retrievalLocator);
  }
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING);
  assert.notEqual(REWRITTEN_REPLAY_GRADE, ARCHIVE_CAPTURE_GRADE);
  /* through the archive arm itself: a ZIP read from a raw replay is filed via archive at the archive letter, its
     snapshot its fetch date and the archive its custodian, and each file opened from it carries that letter */
  const w = world();
  const addr = "https://gone.example/bundle.zip";
  const z = makeZip([{ name: "via-archive.txt", data: "kept by the archive" }]);
  await eligible(w, addr);
  const r = await run(w, wayback([{ ts: "20250101000000", body: z, ct: "application/zip" }], { address: addr }),
                      { via: "archive.org", address: addr }, { cls: "admin", member: false });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = r.body.document.capture;
  assert.deepEqual([c.grade, c.via_archive, c.custodian, c.fetched_at, "reference_only" in c],
                   [ARCHIVE_CAPTURE_GRADE, true, "web.archive.org", "2025-01-01T00:00:00Z", false]);
  const u = r.body.unpack && r.body.unpack.documents ? r.body.unpack : await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member" });
  assert.deepEqual(u.documents.map((d) => d.capture.grade), [ARCHIVE_CAPTURE_GRADE], "each file at its archive's letter");
});

test("R38: the same bytes twice in one archive, and bytes the register already holds, are filed once: each later sighting is `already_held` with its receipt, never a second document", async () => {
  const held = "already in the record";
  const w = world({ provOpts: { registered: [sha(held)] } });
  const z = makeZip([{ name: "one.txt", data: "same" }, { name: "two.txt", data: "same" }, { name: "three.txt", data: held }]);
  const r = await capture(w, z);
  assert.deepEqual(r.body.unpack.documents.map((d) => d.container.index), [0]);
  assert.deepEqual(r.body.unpack.already_held, [{ index: 1, sha256: sha("same") }, { index: 2, sha256: sha(held) }]);
  const rec = w.prov.receipts.filter((x) => x.via === "unpacked").map((x) => x.retrievalLocator);
  assert.deepEqual(rec, [0, 1, 2].map((i) => `zip:${sha(z)}!${i}`), "a second sighting is still receipted (provenance R15)");
  /* a later archive holding a file an earlier one filed: already held */
  const z2 = makeZip([{ name: "again.txt", data: "same" }]);
  const r2 = await capture(w, z2, {}, "https://files.example/other.zip");
  assert.deepEqual([r2.body.unpack.documents.length, r2.body.unpack.already_held], [0, [{ index: 0, sha256: sha("same") }]]);
});

test("R38: folders are listed and never cut, a symlink is listed with its target stated and never followed, and every refused verdict is not filed under its own name with its row", async () => {
  const w = world();
  const z = asSymlink(makeZip([
    { name: "dir/", data: "", method: 0 },
    { name: "link", data: "../../etc/passwd", method: 0 },
    { name: "locked.txt", data: "secret", encrypted: "traditional" },
    { name: "odd.bin", data: "x", method: 12 },
    { name: "liar.txt", data: "truth", local: { name: "other.txt" } },
    { name: "fine.txt", data: "fine" },
  ]), 1);
  const r = await capture(w, z);
  const u = r.body.unpack;
  assert.deepEqual(u.documents.map((d) => d.container.path), ["fine.txt"]);
  assert.deepEqual(u.not_filed.map((n) => [n.index, n.code, n.check, n.translation]), [
    [2, "MEMBER_ENCRYPTED", ...row("MEMBER_ENCRYPTED")], [3, "MEMBER_METHOD_UNSUPPORTED", ...row("MEMBER_METHOD_UNSUPPORTED")],
    [4, "MEMBER_AMBIGUOUS", ...row("MEMBER_AMBIGUOUS")]]);
  assert.deepEqual(recorded(w, sha(z)).map((x) => [x.idx, x.state, x.code]), [[-1, "opened", null], [0, "folder", null], [1, "link", null],
    [2, "not_filed", "MEMBER_ENCRYPTED"], [3, "not_filed", "MEMBER_METHOD_UNSUPPORTED"], [4, "not_filed", "MEMBER_AMBIGUOUS"], [5, "filed", null]]);
  const target = w.rows("SELECT target FROM archive_entries WHERE archive_sha=? AND idx=1", sha(z))[0].target;
  assert.equal(target, "../../etc/passwd", "the link's target, stated as the archive's claim");
  assert.equal(w.prov.receipts.filter((x) => x.via === "unpacked").length, 1, "nothing but the cut file is receipted");
  assert.equal(r.body.unpack.complete, true);
});

test("R38: a file whose cut does not come out as declared (its CRC-32) is MEMBER_CORRUPT with its detail, and no stored byte is ever named as the file; a file over ARCHIVE_RATIO_MAX is not filed, with its limit", async () => {
  const w = world();
  const z = makeZip([{ name: "bad.txt", data: "bytes", local: { crc32: 1 }, central: { crc32: 1 } }, { name: "ok.txt", data: "ok" }]);
  const r = await capture(w, z);
  assert.deepEqual(r.body.unpack.not_filed.map((n) => [n.index, n.code, n.detail, n.check]), [[0, "MEMBER_CORRUPT", "crc_mismatch", row("MEMBER_CORRUPT")[0]]]);
  assert.equal(r.body.unpack.documents.length, 1);
  assert.equal(w.prov.receipts.some((x) => x.captureSha === sha("bytes")), false, "no receipt names the corrupt cut");
  assert.equal(w.rows("SELECT sha256 FROM archive_entries WHERE archive_sha=? AND idx=0", sha(z))[0].sha256, null);
  /* ARCHIVE_RATIO_MAX: the listing's own verdict, not filed, with its figure as `limit`. (MEMBER_MAX is the same path,
     but with ooxml's figures a member over it always puts the archive over ARCHIVE_TOTAL_MAX, refused whole first.) */
  const z2 = makeZip([{ name: "ratio.bin", data: new Uint8Array(4), method: 0, local: { uncompressedSize: 1e7 }, central: { uncompressedSize: 1e7 } },
                      { name: "fine.txt", data: "fine" }]);
  const r2 = await capture(world(), z2);
  assert.deepEqual(r2.body.unpack.not_filed.map((n) => [n.index, n.code, n.limit, n.check, n.translation]),
                   [[0, "ARCHIVE_RATIO_MAX", ARCHIVE_LIMITS.ARCHIVE_RATIO_MAX, ...row("ARCHIVE_RATIO_MAX")]]);
  assert.deepEqual(r2.body.unpack.documents.map((d) => d.container.path), ["fine.txt"]);
});

test("R38 R26: names are the archive's statements, kept as stated: a traversal name is filed with `path_unsafe`, never used as a place to write; duplicate names are two entries, each addressed by its index", async () => {
  const w = world();
  const z = makeZip([{ name: "../../escape.txt", data: "e" }, { name: "dup.txt", data: "first" }, { name: "dup.txt", data: "second" }]);
  const r = await capture(w, z);
  const docs = r.body.unpack.documents;
  assert.deepEqual(docs.map((d) => [d.container.index, d.container.path, d.container.path_unsafe, d.container.name_shared]),
                   [[0, "../../escape.txt", true, 1], [1, "dup.txt", false, 2], [2, "dup.txt", false, 2]]);
  assert.deepEqual(docs.map((d) => d.file), [0, 1, 2].map((i) => `snapshots/zip-${sha(z)}-${i}`), "no file name comes from an entry's name");
  assert.ok([...w.b.held.keys()].every((k) => /^bio\/captures\/[0-9a-f]{64}$/.test(k)), "every object is content-addressed");
});

test("R38: refusals, each writing nothing: BAD_SHA, ARCHIVE_NOT_HELD (no receipt or register row; bytes not held), ARCHIVE_UNREADABLE (with the listing's why, and ARCHIVE_ENTRIES_MAX with its limit), ARCHIVE_AMBIGUOUS (with its detail), ARCHIVE_TOTAL_MAX (with its limit)", async () => {
  const M = { by: "m1", cls: "member" };
  const hold = async (w, bytes) => { await w.b.put(`bio/captures/${sha(bytes)}`, bytes);
    w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(bytes), retrieved: "2026-01-01T00:00:00Z", via: "direct" }); };
  const none = (w) => { assert.equal(w.rows("SELECT COUNT(*) AS n FROM archive_entries")[0].n, 0, "no outcome recorded");
                        assert.equal(w.prov.receipts.filter((x) => x.via === "unpacked").length, 0, "no receipt written"); };
  let w = world();
  for (const bad of [null, "abc", "g".repeat(64), 42]) assert.equal((await unpack(w.store, { archiveSha: bad, ...M })).reason, "BAD_SHA");
  none(w);
  /* not named by any receipt or register row */
  const z = makeZip([{ name: "a", data: "a" }]);
  await w.b.put(`bio/captures/${sha(z)}`, z);
  let u = await unpack(w.store, { archiveSha: sha(z), ...M });
  assert.deepEqual([u.ok, u.reason, u.check, u.translation], [false, "ARCHIVE_NOT_HELD", ...row("ARCHIVE_NOT_HELD")]);
  none(w);
  /* receipted, but its bytes are not held */
  w = world();
  w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  u = await unpack(w.store, { archiveSha: sha(z), ...M });
  assert.equal(u.reason, "ARCHIVE_NOT_HELD");
  assert.match(u.detail, /not held/);
  none(w);
  /* held but stored bytes that disagree with their digest */
  w = world();
  w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  await w.b.put(`bio/captures/${sha(z)}`, makeZip([{ name: "a", data: "b" }]));
  assert.equal((await unpack(w.store, { archiveSha: sha(z), ...M })).reason, "ARCHIVE_NOT_HELD");
  /* unreadable: an archive of more entries than ARCHIVE_ENTRIES_MAX (R17 profiles it zip; its listing refuses it whole). A
     capture that is not an archive at all, or whose end record only claims that many entries, is not profiled zip and is
     NOT_AN_ARCHIVE since T36 (K2100: below) */
  const many = makeZip(Array.from({ length: ARCHIVE_LIMITS.ARCHIVE_ENTRIES_MAX + 1 }, (_, i) => ({ name: `f${i}`, data: "x", method: 0 })));
  for (const [bytes, why, limit] of [[many, "ARCHIVE_ENTRIES_MAX", ARCHIVE_LIMITS.ARCHIVE_ENTRIES_MAX]]) {
    w = world(); await hold(w, bytes);
    u = await unpack(w.store, { archiveSha: sha(bytes), ...M });
    assert.deepEqual([u.reason, u.why, u.limit, u.check], ["ARCHIVE_UNREADABLE", why, limit, row("ARCHIVE_UNREADABLE")[0]], why);
    none(w);
  }
  /* ambiguous: a second end-record candidate in the comment */
  const amb = makeZip([{ name: "a", data: "a" }], { secondEocd: true });
  w = world(); await hold(w, amb);
  u = await unpack(w.store, { archiveSha: sha(amb), ...M });
  assert.deepEqual([u.reason, u.detail, u.check, u.translation], ["ARCHIVE_AMBIGUOUS", "several_eocd_candidates", ...row("ARCHIVE_AMBIGUOUS")]);
  none(w);
  /* the declared total over ARCHIVE_TOTAL_MAX: listed, nothing cut */
  const over = ARCHIVE_LIMITS.ARCHIVE_TOTAL_MAX;
  const tot = makeZip([{ name: "a", data: "a", local: { uncompressedSize: over }, central: { uncompressedSize: over } },
                       { name: "b", data: "b", local: { uncompressedSize: 9 }, central: { uncompressedSize: 9 } }]);
  w = world(); await hold(w, tot);
  u = await unpack(w.store, { archiveSha: sha(tot), ...M });
  assert.deepEqual([u.reason, u.limit, u.check], ["ARCHIVE_TOTAL_MAX", over, row("ARCHIVE_TOTAL_MAX")[0]]);
  none(w);
  /* negative control: the same act over a sound archive the record holds files it */
  const ok = makeZip([{ name: "a", data: "a" }]);
  w = world(); await hold(w, ok);
  u = await unpack(w.store, { archiveSha: sha(ok), ...M });
  assert.deepEqual([u.ok, u.documents.length], [true, 1]);
});

test("R40 R38: only a member session, the daemon, or the capture itself opens an archive; any other caller is refused UNPACK_NOT_PERMITTED with its row, writing nothing", async () => {
  const w = world();
  const z = makeZip([{ name: "a", data: "a" }]);
  await w.b.put(`bio/captures/${sha(z)}`, z);
  w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  for (const o of [{ cls: "admin", by: "admin" }, { cls: "probe", by: "p" }, { cls: null, by: "m1" }, { cls: "ai", by: "m1" },
                   { cls: "member", by: null }, { cls: "member", by: "class:daemon" }, { cls: "member", by: "  " }]) {
    const u = await unpack(w.store, { archiveSha: sha(z), ...o });
    assert.deepEqual([u.ok, u.reason, u.check, u.translation], [false, "UNPACK_NOT_PERMITTED", ...row("UNPACK_NOT_PERMITTED")], JSON.stringify(o));
  }
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM archive_entries")[0].n, 0);
  /* negative controls: a member session, and the daemon */
  assert.equal((await unpack(w.store, { archiveSha: sha(z), cls: "member", by: "m1" })).ok, true);
  const w2 = world();
  await w2.b.put(`bio/captures/${sha(z)}`, z);
  w2.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(z), retrieved: "2026-01-01T00:00:00Z", via: "direct" });
  const d = await unpack(w2.store, { archiveSha: sha(z), cls: "daemon" });
  assert.equal(d.ok, true);
  assert.deepEqual([d.documents[0].capture.actor_class, d.documents[0].capture.actor], ["daemon", null]);
});

test("R38 R27: calling unpack again resumes from the first entry with no outcome; an entry with one is never cut again; nothing a caller sends supplies an index, name, digest, grade or archive", async () => {
  const w = world();
  const z = makeZip([{ name: "a", data: "a" }, { name: "b", data: "b" }]);
  const r = await capture(w, z);
  assert.equal(r.body.unpack.complete, true);
  const before = w.prov.receipts.length;
  const again = await unpack(w.store, { archiveSha: sha(z), by: "m1", cls: "member", index: 0, name: "evil", grade: "A",
                                        sha256: "f".repeat(64), container: { archive_sha256: "e".repeat(64) } });
  assert.deepEqual([again.ok, again.documents.length, again.already_held.length, again.waiting, again.complete], [true, 0, 0, 0, true]);
  assert.equal(w.prov.receipts.length, before, "nothing cut twice, nothing receipted twice");
  assert.ok(!JSON.stringify(again).includes("evil") && !JSON.stringify(again).includes("e".repeat(64)));
});

test("R25: neither acquire nor unpack writes a bundle, a register row or a file of the record: bytes, receipts and the module's own outcome rows only", async () => {
  const w = world();
  const z = makeZip([{ name: "a.txt", data: "a" }, { name: "b.txt", data: "b" }]);
  const r = await capture(w, z);
  assert.equal(r.body.unpack.documents.length, 2);
  for (const t of ["bundles", "files", "history", "manifest"]) assert.equal(w.rows(`SELECT COUNT(*) AS n FROM ${t}`)[0].n, 0, t);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM register")[0].n, 0);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM archive_entries")[0].n, 3, "the archive's row and one per entry");
  /* over-strictness: a plain capture beside it is unchanged, carrying no `unpack` */
  const p = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal("unpack" in p.body, false);
});

test("R40 R38: an archive that cannot be opened never fails its capture: the refusal is stated as `unpack` beside the filed document", async () => {
  const w = world();
  const amb = makeZip([{ name: "a", data: "a" }], { secondEocd: true });
  /* profiled zip only if its directory reads: two end records, the outer one readable */
  const r = await capture(w, amb);
  assert.equal(r.status, 200);
  assert.equal(r.body.document.capture.sha256, sha(amb));
  assert.ok(r.body.unpack, "the capture is profiled zip, so R38's answer is stated beside it");
  assert.deepEqual([r.body.unpack.ok, r.body.unpack.reason], [false, "ARCHIVE_AMBIGUOUS"]);
  /* no acquisition instance handed in: the capture files and the unpack says why nothing was opened */
  const bare = world({ acquisition: false });
  const z = makeZip([{ name: "a", data: "a" }]);
  const b = await capture(bare, z);
  assert.deepEqual([b.status, b.body.unpack.ok, b.body.unpack.reason], [200, false, "ARCHIVE_RECORD_UNAVAILABLE"]);
});

test("R38 (K2100): a held capture R17's rule does not profile as zip (a plain file, an office file, an OpenDocument file) is refused NOT_AN_ARCHIVE with its row, exactly as R41 refuses it, after ARCHIVE_NOT_HELD and before any listing; nothing is filed or recorded (negative control: a plain ZIP opens)", async () => {
  const M = { by: "member:m1", cls: "member", member: true };
  const hold = async (w, bytes) => { await w.b.put(`bio/captures/${sha(bytes)}`, bytes);
    w.prov.recordReceipt({ address: URL1, addressNorm: URL1, captureSha: sha(bytes), retrieved: "2026-01-01T00:00:00Z", via: "direct" }); };
  const docx = makeZip([{ name: "[Content_Types].xml", data: "<Types/>" }, { name: "word/document.xml", data: "<w:document/>" }]);
  const odt = makeZip([{ name: "mimetype", data: "application/vnd.oasis.opendocument.text", method: 0 }, { name: "content.xml", data: "<c/>" }]);
  const claims = makeZip([{ name: "a", data: "a" }], { eocd: { entries: 10001, diskEntries: 10001 } });
  for (const [what, bytes] of [["plain text", enc("not an archive at all, just text")], ["a PDF", PDF], ["an office file", docx], ["an OpenDocument file", odt],
                               ["an end record claiming entries it does not hold", claims]]) {
    /* not held comes first: the same bytes unreceipted answer ARCHIVE_NOT_HELD */
    const w0 = world();
    assert.equal((await unpack(w0.store, { archiveSha: sha(bytes), ...M })).reason, "ARCHIVE_NOT_HELD", what);
    const w = world();
    await hold(w, bytes);
    const receipts = w.prov.receipts.length;
    const u = await unpack(w.store, { archiveSha: sha(bytes), ...M });
    assert.deepEqual([u.ok, u.reason, u.code, u.check, u.translation, u.archive], [false, "NOT_AN_ARCHIVE", "NOT_AN_ARCHIVE", ...row("NOT_AN_ARCHIVE"), sha(bytes)], what);
    assert.notEqual(u.format, "zip", what);
    assert.deepEqual([w.rows("SELECT COUNT(*) AS n FROM archive_entries")[0].n, w.prov.receipts.length], [0, receipts], `${what}: nothing recorded or filed`);
    /* exactly as R41 refuses it */
    const l = await w.acq.archiveList({ archiveSha: sha(bytes), viewer: "class:admin" });
    assert.deepEqual([l.reason, l.check, l.translation, l.format], [u.reason, u.check, u.translation, u.format], what);
  }
  /* negative control: a plain ZIP held the same way opens */
  const w = world();
  const z = makeZip([{ name: "a", data: "a" }]);
  await hold(w, z);
  const u = await unpack(w.store, { archiveSha: sha(z), ...M });
  assert.deepEqual([u.ok, u.documents.length], [true, 1]);
});
