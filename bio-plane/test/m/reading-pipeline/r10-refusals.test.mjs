/* reading-pipeline R54 (fix round 9, job 40; G135a, G135b, G135d, G135e; K4831 (3)): a refusal names its own cause, its figures, and what it
   cannot read. A kind with no reader is named (`UNSUPPORTED_FORMAT {kind}`), final, never "non-textual or too large", and nothing in it for
   "Read it" to repair; a size refusal holds the file's size and the limit and never says "read" of a file that is not, nor "(multipart)";
   a size marker an entry leaves in its text is that refusal (`TOO_LARGE {size, bound}` or `STRUCTURE_OVER_BOUND {part, bound}`), not
   "undecodable regions"; the reason a member refused a picture (`refusal.render.reason`) reaches the sentence. Each test names the ids. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { read, WHOLE_READ_MAX } from "../../../src/reading-pipeline/index.mjs";
import { bucket, evidenceStore, hold, doc, member, withEntry, ocrAnswer } from "./fixture.mjs";
import { pageNotRenderable } from "../../../../ocr-worker/test/fixtures.mjs";

const readOf = (b, document, extra = {}) => read(document, { evidence: evidenceStore(b), env: {}, storeName: "bio", ...extra });
const u8 = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const pad = (b, n = 64) => { const o = new Uint8Array(Math.max(n, b.length)); o.set(b); return o; };
const NOT_THIS = /non-textual|too large|multipart/i;

/* every kind named in the plan (G135a, G135e; SCAN A2-A8, DOCS R1-R3): bytes, the type it is declared as, the kind it is named by */
const KINDS = [
  ["rtf", "{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times;}} Hello world.}", "text/rtf", true, /RTF/],
  ["legacy_word", pad(u8([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), "application/msword", false, /Word/],
  ["legacy_excel", pad(u8([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), "application/vnd.ms-excel", false, /Excel/],
  ["legacy_powerpoint", pad(u8([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), "application/vnd.ms-powerpoint", false, /PowerPoint/],
  ["tiff", pad(u8("II", [0x2a, 0])), "image/tiff", false, /TIFF/],
  ["tiff", pad(u8("MM", [0, 0x2a])), "image/tiff", false, /TIFF/],
  ["gif", pad(u8("GIF89a")), "image/gif", false, /GIF/],
  ["webp", pad(u8("RIFF", [0, 0, 0, 0], "WEBPVP8 ")), "image/webp", false, /WebP/],
  ["heic", pad(u8([0, 0, 0, 0x18], "ftypheic")), "image/heic", false, /HEIC/],
  ["avif", pad(u8([0, 0, 0, 0x18], "ftypavif")), "image/avif", false, /AVIF/],
  ["bmp", pad(u8("BM", new Array(12).fill(0), [40, 0, 0, 0])), "image/bmp", false, /BMP/],
];

for (const [kind, content, ct, fromText, sentence] of KINDS) {
  test(`R54 (G135a, G135e): ${kind} (${ct}) is named, final, UNSUPPORTED_FORMAT, and is no "non-textual or too large"`, async () => {
    const b = bucket();
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const d = await hold(b, bytes);
    const out = await readOf(b, doc({ digest: d, bytes: bytes.length, ct, format: "undetermined", fromText }));
    const r = out.reading;
    assert.equal(r.found, false);
    assert.equal(r.failure, "final", "the document's own kind: reading it again cannot succeed");
    assert.equal(r.reason, "UNSUPPORTED_FORMAT");
    assert.equal(r.kind, kind);
    assert.match(r.basis, sentence, "the sentence names the kind");
    assert.doesNotMatch(r.basis, NOT_THIS);
    assert.equal(out.text_units, undefined, "nothing was drawn from the bytes");
  });
}

/* BOB 4 Nov, PR 272 (a): R54's unsupported list no longer names email, since mail-reader reads message/rfc822 */
const EMAIL = "Received: from a.example by b.example; Tue, 1 Sep 2026 10:00:00 +0000\nFrom: a@a.example\nTo: b@b.example\nSubject: Hello\nMIME-Version: 1.0\nContent-Type: text/plain\n\nBody of the message.\n";
test("R54 (BOB 4 Nov, PR 272 (a)): an email (message/rfc822) is read as mail text, never refused UNSUPPORTED_FORMAT nor final", async () => {
  const b = bucket();
  const bytes = new TextEncoder().encode(EMAIL);
  const d = await hold(b, bytes);
  const r = (await readOf(b, doc({ digest: d, bytes: bytes.length, ct: "message/rfc822", format: "undetermined", fromText: true }))).reading;
  assert.notEqual(r.reason, "UNSUPPORTED_FORMAT");
  assert.notEqual(r.kind, "email");
  assert.notEqual(r.failure, "final", "an email can be read");
  assert.equal(r.text_container, "eml", "its text layer is read through the mail container");
  assert.doesNotMatch(String(r.basis), /not read yet/);
});

test("R54 (G135e): the same kind in ranges and pieces is the same statement; a plain text that merely mentions RTF or From: is read as text", async () => {
  const b = bucket();
  const bytes = pad(u8("GIF89a"));
  const d = await hold(b, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "image/gif", format: "undetermined" });
  const piece = await readOf(b, document, { cursor: null, unitsBudget: 1 << 20 });
  assert.equal(piece.reading.reason, "UNSUPPORTED_FORMAT");
  assert.equal(piece.more, undefined === piece.more ? undefined : piece.more);
  assert.ok(!piece.more, "nothing follows a named refusal");
  const text = "Notes about the RTF format and an email.\nFrom: the clerk\nA line of plain words follows here.\n";
  const dt = await hold(b, text);
  const plain = await readOf(b, doc({ digest: dt, bytes: text.length, ct: "text/plain", format: "undetermined", fromText: true }));
  assert.notEqual(plain.reading.reason, "UNSUPPORTED_FORMAT", "control: a text is read as before");
  assert.ok(Array.isArray(plain.text_units) && plain.text_units.length >= 1);
});

test("R54 R37 (G124a, G135d): a capture over the whole-read bound is stated at once with its size and the limit, in a sentence that says neither read nor multipart", async () => {
  const b = bucket();
  const d = await hold(b, "x");
  const size = WHOLE_READ_MAX + 1;
  const out = await readOf(b, doc({ digest: d, bytes: size, ct: "application/pdf", format: "pdf" }));
  const r = out.reading;
  assert.equal(r.failure, "final");
  assert.equal(r.reason, "TOO_LARGE");
  assert.equal(r.size, size);
  assert.equal(r.bound, WHOLE_READ_MAX);
  assert.ok(r.basis.includes(String(size)) && r.basis.includes(String(WHOLE_READ_MAX)), r.basis);
  assert.doesNotMatch(r.basis, /\bread\b|multipart|parts|non-textual/i);
  const parts = await readOf(b, doc({ digest: d, bytes: size, ct: "application/pdf", format: "pdf", parts: [{ sha256: "a".repeat(64), bytes: size }] }));
  assert.equal(parts.reading.reason, "TOO_LARGE");
  assert.doesNotMatch(parts.reading.basis, /\bread\b|multipart/i, "the multipart door states the cause the same way (a capture of several parts says how many)");
});

test("R54 (G135d): a size marker an entry leaves in its text is TOO_LARGE {size, bound}; a count past its bound is STRUCTURE_OVER_BOUND {part, bound}; neither is 'undecodable regions'", async () => {
  const marker = (guard, part) => ({ document: "", pages: undefined, undetermined: [{ part, why: guard.why, guard }], counts: { chars: 0, undetermined: 1 } });
  const cases = [
    [{ ok: false, text: "undetermined", why: "over_size_bound", size: 34603008, bound: 33554432, boundName: "STREAMED_TEXT_BOUND_BYTES", final: true }, "xl/worksheets/sheet1.xml", "TOO_LARGE"],
    [{ ok: false, why: "TOO_MANY_OBJECTS", n: 250001, bound: 250000, final: true }, "word/document.xml", "STRUCTURE_OVER_BOUND"],
  ];
  for (const [guard, part, reason] of cases) {
    const b = bucket();
    const d = await hold(b, "PK-stand-in");
    await withEntry({ format: "zip", detect: (x) => (x && x.length ? { format: "zip", confidence: "certain", signals: [] } : null), parts: null, text: async () => marker(guard, part) }, async () => {
      const out = await readOf(b, doc({ digest: d, bytes: 11, ct: "application/octet-stream", format: "zip" }));
      const r = out.reading;
      assert.equal(r.found, false);
      assert.equal(r.reason, reason);
      assert.equal(r.failure, "final");
      assert.equal(r.bound, guard.bound);
      if (reason === "TOO_LARGE") { assert.equal(r.size, guard.size); assert.ok(r.basis.includes(String(guard.size)) && r.basis.includes(String(guard.bound)), r.basis); }
      else assert.equal(r.part, part);
      assert.doesNotMatch(r.basis, /undecodable|undetermined/i);
    });
  }
});

test("R54 (G135b): the reason a member refused a picture (refusal.render.reason) reaches the reading's sentence and its ocr_refused list", async () => {
  /* the member's answer is ocr-worker's published fixture: its real PAGE_NOT_RENDERABLE with the renderer's own reason beside it */
  for (const renderReason of ["NOT_A_PDF", "EMPTY_FILE"]) {
    const answer = await pageNotRenderable({ renderReason });
    const why = answer.refusal.render.reason;   /* the reason the real renderer gave, whichever bytes were refused */
    assert.equal(typeof why, "string");
    const b = bucket();
    const jpeg = pad(u8([0xff, 0xd8, 0xff, 0xe0]), 64);
    const d = await hold(b, jpeg);
    const ocr = member(() => answer);
    await withEntry({ format: "jpeg", detect: () => ({ format: "jpeg", confidence: "certain", signals: [] }), parts: null,
                      structure: async () => ({ ok: true, pages: 1, text: { document: "", pages: [{ page: 0, text: "", undetermined: [{ page: 0, reason: "no_text_layer", font: null, codes: null, count: 1 }] }],
                                                                           undetermined: [{ page: 0, reason: "no_text_layer", font: null, codes: null, count: 1 }], counts: { chars: 0, undetermined: 1 } } }) }, async () => {
      const out = await readOf(b, doc({ digest: d, bytes: jpeg.length, ct: "image/jpeg", format: "jpeg" }), { env: { OCR_WORKER: ocr } });
      const r = out.reading;
      assert.ok(r.basis.includes(why), `${why} in: ${r.basis}`);
      assert.deepEqual(r.ocr_refused, [{ page: 0, reason: why }]);
      assert.doesNotMatch(r.basis, /PAGE_NOT_RENDERABLE/);
    });
  }
  void ocrAnswer;
});
