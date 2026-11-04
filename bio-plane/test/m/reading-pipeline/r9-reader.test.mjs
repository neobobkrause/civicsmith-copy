/* reading-pipeline fix round 9 (K4837, K4840), the first half's pieces at the module's interface: the bounds quoted from
 * `READ_BOUNDS` (G124; R37), failures classified at every tick (G129b, G133c; R37, R53), units chunked and named by kind (G128d,
 * G128g, G128h, G134d; R41, R47), completeness from the counters (G128a, G128b; R48), the reader contract's pieces (G130, G132;
 * R45), one decode rule (G131g; R49), the member's refusals and legibility (G125a, G129c, G137d; R54, R56) and no wait on a
 * scan (R58). Entries are swapped in with `withEntry` where a case needs an entry's exact answer; real entries elsewhere. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fresh, hold, doc, member, evidenceStore, withEntry, bucket, ocrAnswer } from "./fixture.mjs";
import * as rp from "../../../src/reading-pipeline/index.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { scanPdf, chunked } from "./scans.mjs";
import { BUNDLE as PDF_WORKER_BUNDLE } from "../../../../pdf-worker/test/subject.mjs";

/* the module's names, read off its namespace so a name not yet exported fails its own test, not the file */
const { read, WHOLE_READ_MAX, MULTIPART_READ_MAX, CAPTURE_TEXT_UNIT_CAP } = rp;
const completenessOf = (...a) => rp.completenessOf(...a), chunkUnits = (...a) => rp.chunkUnits(...a), plan = (...a) => rp.plan(...a),
      rangeSource = (...a) => rp.rangeSource(...a), windowCursor = (...a) => rp.windowCursor(...a);
const UNIT_KINDS = rp.UNIT_KINDS || ["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];

/* the module's source, and since BOB's split (4 Nov 2026, PR 274) `reader-contract`'s, where the ceilings it re-exports are written */
const SRCS = [new URL("../../../src/reading-pipeline/", import.meta.url), new URL("../../../src/reader-contract/", import.meta.url)];
const source = () => SRCS.flatMap((SRC) => readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => readFileSync(new URL(f, SRC), "utf8"))).join("\n");
const docOf = (d, bytes, format, ct = "application/octet-stream", extra = {}) => doc({ digest: d, bytes, ct, format, ...extra });
const ev = (w) => evidenceStore(w.evidence);
async function heldDoc(bytes, format, ct, extra) {
  const w = fresh();
  const d = await hold(w.evidence, bytes);
  return { w, d, document: docOf(d, typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.length, format, ct, extra) };
}

/* ---- G124 (R37): the ceilings this module keeps are the table's ---- */

test("R37 (G124): WHOLE_READ_MAX and MULTIPART_READ_MAX are READ_BOUNDS' rows (pdf bytes, office text bytes), and the module's source writes no numeric literal for a byte ceiling", () => {
  assert.equal(WHOLE_READ_MAX, boundOf("pdf", "bytes"));
  assert.equal(MULTIPART_READ_MAX, boundOf("office", "text_bytes"));
  const src = source();
  for (const name of ["WHOLE_READ_MAX", "MULTIPART_READ_MAX"]) {
    const m = new RegExp(`export const ${name}\\s*=\\s*([^;]+);`).exec(src);
    assert.ok(m, name);
    assert.match(m[1], /^boundOf\(/, `${name} is quoted from the table: ${m[1]}`);
  }
});

test("R37 R54 (G124a, PDF A3): a PDF of the bound plus one is stated at once, final, with its size and the limit, nothing loaded; the bound itself is read (A2's ceiling)", async () => {
  const w = fresh();
  const calls = [];
  const store = { head: async () => null, get: async (k) => { calls.push(k); return null; } };
  const over = await read(docOf("a".repeat(64), WHOLE_READ_MAX + 1, "pdf", "application/pdf"), { evidence: store, env: {} });
  assert.equal(over.reading.failure, "final");
  assert.equal(over.reading.reason, "TOO_LARGE");
  assert.equal(over.reading.size, WHOLE_READ_MAX + 1);
  assert.equal(over.reading.bound, WHOLE_READ_MAX);
  assert.equal(over.reading.key, "limit.pdf.bytes");
  assert.deepEqual(calls, [], "nothing was loaded");
  assert.equal(over.final, true);
  assert.equal(completenessOf(over.counters, over), "stated");
  const at = await read(docOf("a".repeat(64), WHOLE_READ_MAX, "pdf", "application/pdf"), { evidence: store, env: {} });
  assert.notEqual(at.reading.reason, "TOO_LARGE", "the bound itself is not over the bound");
  void w;
});

/* ---- G133c, G129b (R37, R53): a failure says its class at every tick ---- */

test("R37 (G133c): an entry that throws on the file's own bytes is final with its reason, never transient", async () => {
  await withEntry({ format: "x9throw", text: async () => { throw new RangeError("Invalid code point 1114112"); } }, async () => {
    const { w, document } = await heldDoc("some bytes of a hostile file", "x9throw");
    const out = await read(document, { evidence: ev(w), env: {} });
    assert.equal(out.reading.failure, "final", out.reading.basis);
    assert.match(out.reading.basis, /Invalid code point/);
    assert.equal(out.final, true);
  });
});

test("R53 (G129b, DOCS F1 shape): a store failure at tick 2 comes back transient with the cursor kept and more still true; the retry reads on to the end, every line once", async () => {
  const text = Array.from({ length: 3000 }, (_, i) => `line ${i} of the text read in pieces, with words enough to fill a window`).join("\n");
  const { w, d, document } = await heldDoc(text, "undetermined", "text/plain", {});
  document.profile.profiled_from_text = true;
  const store = ev(w);
  let failAt = 2, tick = 0;
  const flaky = { head: store.head, get: async (k, o) => { if (tick === failAt) throw new Error("R2 hiccup"); return store.get(k, o); } };
  const units = [];
  let cursor = null, failures = 0;
  for (let i = 0; i < 40; i++) {
    tick++;
    const out = await read(document, { evidence: flaky, env: {}, cursor, unitsBudget: 16 * 1024, windowBytes: 16 * 1024 });
    if (out.reading && out.reading.failure === "transient" && tick === failAt) {
      failures++;
      assert.equal(out.more, true, "a transient failure is never the end of the read");
      assert.equal(out.cursor, cursor, "the cursor is kept for the retry");
      assert.equal(out.counters.failed, 1);
      failAt = -1;
      continue;
    }
    units.push(...(out.text_units || []));
    if (!out.more) break;
    cursor = out.cursor;
  }
  assert.equal(failures, 1);
  assert.deepEqual(units.map((u) => u.text), text.split("\n"));
  void d;
});

/* ---- G128d, G134d (R47): chunked, never cut; every unit names its kind ---- */

const pageText = Array.from({ length: 1000 }, (_, i) => `${"alpha beta gamma delta ".repeat(12).slice(0, 299)}${String(i).padStart(4, "0")}`).join("\n");
const pagesEntry = (pages) => ({ format: "x9pages", text: async () => ({ container: "pdf", document: pages.join("\n"),
  pages: pages.map((t, page) => ({ page, text: t, undetermined: [] })), undetermined: [], counts: { chars: pages.join("\n").length, undetermined: 0 } }) });

test("R47 R15 (G128d, red.mjs N15's shape): a page over CAPTURE_TEXT_UNIT_CAP is carried as consecutive chunks of its page, run 0, 1, ..., none truncated, their text the page's, read whole and in pieces alike; its last word is in the last chunk", async () => {
  await withEntry(pagesEntry(["small one", pageText, "small three"]), async () => {
    const { w, document } = await heldDoc("x", "x9pages");
    for (const opts of [{ unitsBudget: Infinity }, { unitsBudget: 512 * 1024, cursor: null, maxUnits: 4096 }]) {
      const out = await read(document, { evidence: ev(w), env: {}, ...opts });
      const p1 = out.text_units.filter((u) => u.extent.page === 1);
      assert.ok(p1.length >= 3, `${p1.length} chunks`);
      assert.deepEqual(p1.map((u) => u.extent.run), p1.map((_, k) => k));
      assert.ok(out.text_units.every((u) => !u.truncated && u.text.length <= CAPTURE_TEXT_UNIT_CAP));
      assert.equal(p1.map((u) => u.text).join(""), pageText);
      assert.ok(p1[p1.length - 1].text.endsWith("0999"));
      assert.equal(out.text_units.find((u) => u.extent.page === 0).extent.run, undefined, "a page under the cap is one unit as before");
    }
  });
});

test("R47 (G128d, DOCS T14): chunkUnits breaks at a space, never inside a word, and a phrase across a seam is whole in one chunk or the other (an overlap)", () => {
  const words = Array.from({ length: 60000 }, (_, i) => `w${i}`).join(" ");
  const chunks = chunkUnits(words);
  assert.ok(chunks.length > 2);
  for (let k = 1; k < chunks.length; k++) {
    assert.ok(chunks[k - 1].text.endsWith(" "), "a chunk ends at a space");
    const tail = chunks[k - 1].text.trimEnd().split(" ").slice(-2).join(" ");
    assert.ok(chunks[k].overlap.startsWith(tail), "the last two words before a seam open the next chunk's overlap");
  }
  assert.equal(chunks.map((c) => c.text).join(""), words);
  const noSpace = "x".repeat(3 * 1024 * 1024);
  assert.equal(chunkUnits(noSpace).map((c) => c.text).join(""), noSpace, "a 3 MB line with no space is chunked whole");
});

test("R47 (G134d, DOCS O4 at the interface): every part an entry emits is a unit with its kind; the body's units are body; a footnote's figure is found in a footnote unit; allUnitsOf accepts every kind of the closed list", async () => {
  const entry = { format: "x9parts", text: async () => ({ container: "docx", document: "Body para one\n\nBody para two",
    paragraphs: [{ para: 0, text: "Body para one" }, { para: 1, text: "Body para two" }],
    parts: UNIT_KINDS.filter((k) => k !== "body").map((kind, i) => ({ kind, ref: `${kind} ${i + 1}`, part: "word/x.xml", text: `${kind} says $${1000 + i}` })),
    counts: { chars: 27, undetermined: 0 } }) };
  await withEntry(entry, async () => {
    const { w, document } = await heldDoc("x", "x9parts");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.deepEqual(out.text_units.filter((u) => u.kind === "body").map((u) => u.text), ["Body para one", "Body para two"]);
    for (const kind of UNIT_KINDS.filter((k) => k !== "body")) {
      const u = out.text_units.find((x) => x.kind === kind);
      assert.ok(u, kind);
      assert.match(u.text, /\$\d{4}/);
      assert.equal(u.extent.kind, "doc-part");
    }
    assert.ok(out.text_units.every((u) => UNIT_KINDS.includes(u.kind)));
    assert.equal(new Set(out.text_units.map((u) => u.seq)).size, out.text_units.length);
  });
});

test("R47 (G166): a paragraph a text_box part names in paras is no body unit, so the box's words are one unit of kind text_box; without paras every paragraph stays a body unit", async () => {
  const paragraphs = [0, 1, 2, 3, 4].map((para) => ({ para, text: para === 3 ? "words inside the box" : `Body paragraph ${para}` }));
  const reading = (paras) => ({ format: "x9box", text: async () => ({ container: "docx", document: paragraphs.map((p) => p.text).join("\n\n"), paragraphs,
    parts: [{ kind: "text_box", ref: "\u00b64", part: "word/document.xml", text: "words inside the box", ...(paras ? { paras } : {}) }],
    counts: { chars: 100, undetermined: 0 } }) });
  const unitsOf = async (paras) => {
    let units;
    await withEntry(reading(paras), async () => {
      const { w, document } = await heldDoc("x", "x9box");
      units = (await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity })).text_units;
    });
    return units;
  };
  const named = await unitsOf([3]);
  assert.deepEqual(named.filter((u) => u.kind === "body").map((u) => u.extent.para), [0, 1, 2, 4], "paragraph 3 is no body unit");
  assert.deepEqual(named.filter((u) => u.text === "words inside the box").map((u) => u.kind), ["text_box"], "the words are one unit, of one kind");
  const two = await unitsOf([3, 4]);
  assert.deepEqual(two.filter((u) => u.kind === "body").map((u) => u.extent.para), [0, 1, 2], "every paragraph the part names is left out");
  const none = await unitsOf(null);
  assert.deepEqual(none.filter((u) => u.kind === "body").map((u) => u.extent.para), [0, 1, 2, 3, 4], "control: without paras every paragraph is a body unit");
  const bad = await unitsOf([9, "x", -1]);
  assert.equal(bad.filter((u) => u.kind === "body").length, 5, "control: indices that name no paragraph leave every paragraph a body unit");
});

test("R47 (G166, pptx): a slide's body unit is its bodyText when it states one, so a text box's words are one unit of kind text_box; a box-only slide has no body unit; without bodyText the slide's text stays", async () => {
  const slides = [{ slide: 0, text: "Title\nbox words", bodyText: "Title" }, { slide: 1, text: "only box words", bodyText: "" }, { slide: 2, text: "plain slide" }];
  const entry = { format: "x9pptx", text: async () => ({ container: "pptx", document: slides.map((s) => s.text).join("\n\n"), slides,
    parts: [{ kind: "text_box", ref: "slide 1 shape 2", part: "ppt/slides/slide1.xml", text: "box words", shapes: [1] },
            { kind: "text_box", ref: "slide 2 shape 1", part: "ppt/slides/slide2.xml", text: "only box words", shapes: [0] }],
    counts: { chars: 50, undetermined: 0 } }) };
  await withEntry(entry, async () => {
    const { w, document } = await heldDoc("x", "x9pptx");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.deepEqual(out.text_units.filter((u) => u.kind === "body").map((u) => [u.extent.slide, u.text]), [[0, "Title"], [2, "plain slide"]]);
    assert.deepEqual(out.text_units.filter((u) => u.kind === "text_box").map((u) => u.text), ["box words", "only box words"]);
  });
});

test("R47 R41 (G128g, G128h): a sheet's units carry lineRows, every block naming its rows, the repeated header line naming row 1, so a join that drops a repeated first line gives each row once", async () => {
  const lines = ["payer,payee,amount", ...Array.from({ length: 9000 }, (_, i) => `PBs${String(i).padStart(6, "0")},P002,${i + 1}`)];
  const entry = { format: "x9sheet", text: async () => ({ container: "csv", document: lines.join("\n"),
    sheets: [{ name: "s", text: lines.join("\n"), range: { kind: "sheet-range", sheet: "s", range: `A1:C${lines.length}` },
               lineRows: lines.map((_, i) => i + 1) }], counts: { chars: 1, undetermined: 0 } }) };
  await withEntry(entry, async () => {
    const { w, document } = await heldDoc("x", "x9sheet");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity, cursor: null, maxUnits: 4096 });
    const blocks = out.text_units;
    assert.ok(blocks.length > 1);
    const rows = [];
    for (const [k, b] of blocks.entries()) {
      assert.ok(Array.isArray(b.lineRows), `block ${k} states lineRows`);
      assert.equal(b.lineRows.length, b.text.split("\n").length);
      if (k > 0) assert.equal(b.lineRows[0], 1, "the repeated header names its own row");
      const own = b.text.split("\n").filter((_, i) => !(k > 0 && i === 0));
      rows.push(...own);
    }
    assert.deepEqual(rows, lines, "each row once, the header once");
  });
});

/* ---- G128a, G128b (R48): completeness from the counters ---- */

test("R48: completenessOf is whole exactly when nothing more follows and nothing is skipped, owed or failed; stated for a refusal; none when nothing was offered", () => {
  const c = (o) => ({ written: 0, skipped: 0, owed: 0, failed: 0, ...o });
  assert.equal(completenessOf(c({ written: 3 }), { more: false, final: true }), "whole");
  assert.equal(completenessOf(c({ written: 3 }), { more: true }), "partial");
  assert.equal(completenessOf(c({ written: 3, owed: 1 }), { more: false, final: true }), "partial");
  assert.equal(completenessOf(c({ written: 3, skipped: 1 }), { more: false }), "partial");
  assert.equal(completenessOf(c({ written: 3, failed: 1 }), { more: false }), "partial");
  assert.equal(completenessOf(c({}), { more: false, final: true, refused: true }), "stated");
  assert.equal(completenessOf(c({}), { more: false }), "none");
});

test("R48 (G128a, SCAN C1 shape): a 30-page scan with 24 OCR'd is partial, owed 6; read to its end it is whole", async () => {
  const bytes = scanPdf(30);
  const w = fresh({ env: { OCR_WORKER: chunked() } });
  const d = await hold(w.evidence, bytes);
  const out = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: w.env });
  assert.equal(out.counters.owed, 6);
  assert.equal(completenessOf(out.counters, out), "partial");
  const all = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: { OCR_WORKER: chunked() }, ocrInvocations: 30 });
  assert.equal(all.counters.owed, 0);
  assert.equal(completenessOf(all.counters, all), "whole");
});

test("R48 (G128b, SCAN C11 shape): a text page with one large unread picture counts the picture owed, so the reading is never whole; control: a fully read text page is whole", async () => {
  const pages = [{ page: 0, text: "A table of payments", undetermined: [{ page: 0, reason: "image_content_undetermined", font: null, codes: null, count: 0 },
                                                                      { page: 0, reason: "image_unread", font: null, codes: "", count: 0, rect: [0, 0, 500, 600], area_share: 0.8 }] },
                 { page: 1, text: "Plain text page", undetermined: [] }];
  const entry = { format: "x9pic", text: async () => ({ container: "pdf", document: "x", pages, undetermined: pages.flatMap((p) => p.undetermined), counts: { chars: 1, undetermined: 2 } }) };
  await withEntry(entry, async () => {
    const { w, document } = await heldDoc("x", "x9pic");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.equal(out.counters.owed, 1, "the picture on page 1, once");
    assert.equal(completenessOf(out.counters, out), "partial");
  });
  await withEntry({ ...entry, text: async () => ({ container: "pdf", document: "x", pages: [pages[1]], undetermined: [], counts: { chars: 1, undetermined: 0 } }) }, async () => {
    const { w, document } = await heldDoc("y", "x9pic");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.equal(completenessOf(out.counters, out), "whole");
  });
});

/* ---- G130, G132 (R45): the reader contract's pieces ---- */

test("R45 (G130): rangeSource reads only the ranges asked; plan of a file past the whole-read ceiling reads its head and its tail, detects the kind, and judges the size against the kind's bound", async () => {
  const b = bucket();
  const big = new Uint8Array(WHOLE_READ_MAX + 1024 * 1024);
  big.set(new TextEncoder().encode("%PDF-1.7\n"), 0);
  big.set(new TextEncoder().encode("\nstartxref\n0\n%%EOF\n"), big.length - 20);
  const d = await hold(b, big);
  const src = rangeSource(evidenceStore(b), doc({ digest: d, bytes: big.length, ct: "application/pdf", format: "undetermined" }));
  assert.equal(src.size, big.length);
  b.served = 0;
  const p = await plan(src, { declared: "application/pdf" });
  assert.equal(p.kind, "pdf");
  assert.deepEqual(p.verdict, { ok: false, size: big.length, limit: boundOf("pdf", "bytes"), bound_key: "limit.pdf.bytes" });
  assert.equal(p.mode, "pages");
  assert.equal(src.reads.length, 2, "two ranges: the head and the tail");
  assert.ok(b.served <= 1024 * 1024 + 64 * 1024, `${b.served} bytes served`);
});

test("R45 control: a file under every bound plans ok and reads in one piece with more false; windowCursor round-trips its fields", async () => {
  const { w, document } = await heldDoc("one short line of text", "undetermined", "text/plain");
  document.profile.profiled_from_text = true;
  const src = rangeSource(ev(w), document);
  const p = await plan(src, { declared: "text/plain" });
  assert.equal(p.verdict.ok, true);
  const out = await read(document, { evidence: ev(w), env: {}, cursor: null });
  assert.equal(out.more, false);
  assert.equal(out.final, true);
  assert.equal(out.next, null);
  const c = windowCursor("a".repeat(64), { m: "t", n: 10, ob: 3 });
  assert.equal(typeof c, "string");
});

test("R45 (G132): every answer carries counters {written, skipped, owed, failed} and next; written is the units carried", async () => {
  const { w, document } = await heldDoc("one\n\ntwo\n\nthree", "undetermined", "text/plain");
  document.profile.profiled_from_text = true;
  const out = await read(document, { evidence: ev(w), env: {} });
  assert.deepEqual(Object.keys(out.counters).sort(), ["failed", "owed", "skipped", "written"]);
  assert.equal(out.counters.written, 3);
});

/* ---- G131g (R49): one decode rule ---- */

test("R49 (G131g, DOCS T7 at the interface): a windows-1252 text and a UTF-16LE text with BOM are decoded by ooxml's rule, the encoding stated, never U+FFFD with failure null; control: UTF-8 as before", async () => {
  const cp1252 = new Uint8Array([...Buffer.from("Caf", "latin1"), 0xe9, ...Buffer.from(" r", "latin1"), 0xe9, ...Buffer.from("sum", "latin1"), 0xe9, 0x0a, ...Buffer.from("second line", "latin1")]);
  const utf16 = new Uint8Array([0xff, 0xfe, ...Buffer.from("Hello UTF-16\nsecond line", "utf16le")]);
  for (const [bytes, want, enc] of [[cp1252, "Café résumé", "windows-1252"], [utf16, "Hello UTF-16", "utf-16le"], [new TextEncoder().encode("Plain UTF-8 ü\nsecond line"), "Plain UTF-8 ü", "utf-8"]]) {
    const { w, document } = await heldDoc(bytes, "undetermined", "text/plain");
    document.profile.profiled_from_text = true;
    const out = await read(document, { evidence: ev(w), env: {} });
    assert.equal(out.text_units[0].text, want);
    assert.equal(out.reading.encoding, enc);
    assert.equal(typeof out.reading.encoding_assumed, "boolean");
    assert.ok(!out.text_units.some((u) => u.text.includes("�")));
  }
});

test("R49: a text whose replacement passes 0.5 % of its characters is partial with the count", async () => {
  const bad = new Uint8Array([...new TextEncoder().encode("abc ".repeat(20)), ...new Uint8Array(40).fill(0xff), 0x0a, ...new TextEncoder().encode("tail line")]);
  const { w, document } = await heldDoc(bad, "undetermined", "text/plain; charset=utf-8", { headers: [["content-type", "text/plain; charset=utf-8"]] });
  document.profile.profiled_from_text = true;
  const out = await read(document, { evidence: ev(w), env: {} });
  assert.ok(out.reading.encoding_replaced > 0);
  assert.ok(out.counters.skipped >= 1, "a replacement over the tolerance makes the reading partial");
  assert.equal(completenessOf(out.counters, out), "partial");
});

/* ---- G125a, G129c, G137d (R54, R56): the member's refusals reach the reading; legibility is stored ---- */

test("R54 (G125a): a page the OCR member refuses from its header (IMAGE_TOO_LARGE) is stated with that reason, final, never owed or retried", async () => {
  const bytes = scanPdf(2);
  const m = member((body) => {
    const p = [...new Set(body.pages)].sort((a, b) => a - b)[0];
    if (p === 1) return { ok: false, reason: "IMAGE_TOO_LARGE", page: 1, deferred: [], notes: [], refusal: { render: { reason: "IMAGE_TOO_LARGE" } } };
    return { ...ocrAnswer([p]), deferred: [...new Set(body.pages)].filter((x) => x !== p) };
  });
  const w = fresh({ env: { OCR_WORKER: m } });
  const d = await hold(w.evidence, bytes);
  const out = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: w.env });
  assert.deepEqual(out.reading.ocr_refused, [{ page: 1, reason: "IMAGE_TOO_LARGE" }]);
  assert.equal(out.reading.ocr_left, undefined, "not owed");
  assert.equal(out.counters.skipped, 1);
});

test("R54 (G129c): a page the caller states killed its reader three times is not asked again and is stated PAGE_KILLED_READER; the rest is read", async () => {
  const bytes = scanPdf(4);
  const m = chunked();
  const w = fresh({ env: { OCR_WORKER: m } });
  const d = await hold(w.evidence, bytes);
  const out = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: w.env, killedPages: [2] });
  assert.ok(m.calls.every((c) => !c.body.pages.includes(2)), "page 2 never asked");
  assert.ok(out.reading.ocr_refused.some((r) => r.page === 2 && r.reason === "PAGE_KILLED_READER"));
  assert.deepEqual(out.text_units.map((u) => u.extent.page), [0, 1, 3]);
  assert.equal(out.counters.skipped, 1);
});

test("R54 (G125a): a page whose OCR call answered 5xx is named killed on the reading, so the ledger can count the attempt against that page", async () => {
  const bytes = scanPdf(3);
  const w = fresh({ env: { OCR_WORKER: member((body) => {
    const clean = [...new Set(body.pages)].sort((a, b) => a - b);
    if (clean[0] === 1) return { status: 500, body: { ok: false } };
    return { ...ocrAnswer([clean[0]]), deferred: clean.slice(1) };
  }) } });
  const d = await hold(w.evidence, bytes);
  const out = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: w.env });
  assert.deepEqual(out.reading.ocr_killed, [1]);
  assert.deepEqual(out.reading.ocr_left, { cursor: 1, pages: 1 });
});

test("R56 (G137d): legibility is stored beside a page's text; a page under four fifths is kept and marked partly legible; a page the member refused under one fifth stores no text and is stated; the same for a picture and a PDF page", async () => {
  const bytes = scanPdf(3);
  const leg = { 0: { words: 10, confident_words: 10, share: 1 }, 1: { words: 10, confident_words: 5, share: 0.5 }, 2: { words: 10, confident_words: 1, share: 0.1 } };
  const m = member((body) => {
    const clean = [...new Set(body.pages)].sort((a, b) => a - b), p = clean[0];
    if (p === 2) return { ok: false, reason: "PAGE_NOT_LEGIBLE", page: 2, legibility: leg[2], deferred: clean.slice(1), notes: [] };
    return { ...ocrAnswer([p]), legibility: leg[p], deferred: clean.slice(1) };
  });
  const w = fresh({ env: { OCR_WORKER: m } });
  const d = await hold(w.evidence, bytes);
  const out = await read(docOf(d, bytes.length, "pdf", "application/pdf"), { evidence: ev(w), env: w.env });
  assert.deepEqual(out.reading.legibility, [{ page: 0, ...leg[0], partly: false }, { page: 1, ...leg[1], partly: true }, { page: 2, ...leg[2], partly: true, stored: false }]);
  assert.deepEqual(out.text_units.map((u) => u.extent.page), [0, 1], "no text stored for the illegible page");
  assert.ok(out.reading.ocr_refused.some((r) => r.page === 2 && r.reason === "PAGE_NOT_LEGIBLE"));
  assert.equal(out.counters.skipped, 1);
});

/* ---- R58: a reading waits for no scan ---- */

test("R58: no reading step imports file-safety or reads a scan, grade or safe view", () => {
  const src = source();
  assert.doesNotMatch(src, /from\s+["'][^"']*file-safety/);
  assert.doesNotMatch(src, /\b(?:safe_view|scan_state|gradeOf)\b/);
});

/* ---- K4861 (pdf-worker R42): tier 2 is asked for the range the reading is on ---- */

test("R3 R40 (K4861, R-PATH): every piece of a PDF read in ranges that escalates asks tier 2 for its own range (from, count), the first piece and a later one; a whole read asks the document", async () => {
  const { generate } = await import("../../../test/pdfgen.mjs");
  const f = generate({ kind: "pdf", seed: "K4861", size: { pages: 5, lines: 3 } });   /* winansi with no ToUnicode: tier 1 reads nothing, so it escalates */
  const bytes = await f.bytes();
  const asked = [];
  /* the member is the real pdf-worker (a fresh build of its source, `pdf-worker/test/subject.mjs`), answering from the bucket `read` reads; the front only records the range asked */
  const { pathToFileURL } = await import("node:url");
  const realWorker = (await import(pathToFileURL(PDF_WORKER_BUNDLE).href)).default;
  const evidence = bucket();
  const pdfWorker = { async fetch(url, init) {
    const body = JSON.parse(init.body);
    asked.push({ from: body.from, count: body.count });
    return realWorker.fetch(new Request(url, init), { CAPTURES: { get: async (key) => { const o = await evidence.get(key); return o ? { size: o.size, arrayBuffer: o.arrayBuffer } : null; } } });
  } };
  const w = fresh({ evidence, env: { PDF_WORKER: pdfWorker } });
  const d = await hold(w.evidence, bytes);
  const document = docOf(d, bytes.length, "pdf", "application/pdf");
  let cursor = null;
  for (let i = 0; i < 5; i++) {
    const out = await read(document, { evidence: ev(w), env: w.env, cursor, rangePages: 2 });
    if (!out.more) break;
    cursor = out.cursor;
  }
  assert.deepEqual(asked, [{ from: 0, count: 2 }, { from: 2, count: 2 }, { from: 4, count: 1 }]);
  asked.length = 0;
  await read(document, { evidence: ev(w), env: w.env });
  assert.deepEqual(asked, [{ from: undefined, count: undefined }], "a whole read asks the whole document");
});

/* ---- G131b (SHEET C14 at a scaled size): a stray quote inside a field opens nothing ---- */

test("R41 R40 (G131b, SHEET C14 scaled): a CSV with a stray `12\" pipe` at row 100 read through the real csv entry in window pieces gives every row once; the window scan opens a quote only at the start of a field", async () => {
  const rows = ["item,qty", ...Array.from({ length: 200000 }, (_, i) => (i === 99 ? `12" pipe,${i}` : `part ${i} of the order,${i}`))];
  const text = rows.join("\n") + "\n";
  const { w, document } = await heldDoc(text, "csv", "text/csv", {});
  document.profile.profiled_from_text = true;
  const seen = [];
  let cursor = null;
  const served = [];
  for (let i = 0; i < 400; i++) {
    const before = w.evidence.served;
    const out = await read(document, { evidence: ev(w), env: {}, cursor, unitsBudget: 256 * 1024, windowBytes: 64 * 1024 });
    served.push(w.evidence.served - before);
    for (const u of out.text_units || []) u.text.split("\n").forEach((l, k) => { if (!(k === 0 && u.lineRows && u.lineRows[0] === 1 && seen.length)) seen.push(l); });
    if (!out.more) break;
    cursor = out.cursor;
  }
  assert.equal(seen.length, rows.length, "every row once");
  assert.deepEqual(seen.map((l) => l.replace(/\t/g, ",")), rows, "every row once, its cells in place (the sheet's text joins cells with a tab)");
  assert.ok(served.length > 2);
  const size = Buffer.byteLength(text);
  assert.ok(served.slice(1).every((n) => n < size / 2), `every later tick reads a window, not the object: ${served.slice(1, 4)} of ${size}`);
});

/* ---- G128e (DOCS O3 at the interface): an optional part past the stored bound is omitted with a statement; the units stay ---- */

test("R47 R28 (G128e, DOCS O3 shape): a .docx whose table cells weigh over INLINE_CELLS_MAX_BYTES keeps every text unit (the ENDMARKER found) and omits the cells with a statement of their size and the bound; control: a small table keeps its cells", async () => {
  const mk = (rows) => ({ format: "x9docx", text: async () => {
    const cells = Array.from({ length: rows * 4 }, (_, i) => ({ row: Math.floor(i / 4), col: i % 4, text: `cell ${i} with a little text` }));
    const paragraphs = [{ para: 0, text: "INTRO" }, ...Array.from({ length: rows }, (_, r) => ({ para: r + 1, text: `row ${r} a b c d` })), { para: rows + 1, text: "ENDMARKER" }];
    return { container: "docx", document: paragraphs.map((p) => p.text).join("\n"), paragraphs, tables: [{ ref: "table 1", rows, cols: 4, cells }],
             counts: { chars: 1, undetermined: 0 } };
  } });
  await withEntry(mk(3200), async () => {
    const { w, document } = await heldDoc("x", "x9docx");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.ok(out.text_units.some((u) => u.text === "ENDMARKER"));
    assert.ok(out.reading.cells === null, "the cells are omitted");
    assert.equal(out.reading.cells_omitted.bound, rp.INLINE_CELLS_MAX_BYTES);
    assert.ok(out.reading.cells_omitted.size > rp.INLINE_CELLS_MAX_BYTES);
    assert.ok(JSON.stringify(out.reading).length < 1024 * 1024, "the reading stays under the stored bound");
  });
  await withEntry(mk(5), async () => {
    const { w, document } = await heldDoc("y", "x9docx");
    const out = await read(document, { evidence: ev(w), env: {}, unitsBudget: Infinity });
    assert.equal(out.reading.cells["table 1"].length, 20);
    assert.equal(out.reading.cells_omitted, undefined);
  });
});

/* ---- K4888: the second half's ids, named until their job replaces them ---- */

test.todo("R57 (G128c): a PDF read in ranges completes its reading: pdf-reader (job 7) and extraction-2 (job 41), fix round 9");
