/* screens-inquiry fix round 10 (T51), the seam (R-SEAM) of causes 1, 2a and 4 (G1; K5055; diagnosis `build/plan/diagnosis-R10-a-1.md`; K4426; K4990): the whole path from the member's own
 * upload to what the Document page draws, over the REAL plane and the REAL OCR member (both booted by Miniflare from their own code, the member from its committed bytes), every file made
 * by the walkers' own generator recipes (`imggen`, `pdfgen`, `sheetgen`, `make-zip`), nothing scripted. R1 (R96, amended): a final reading is drawn by its OWN reason and figures; the
 * size sentence ("which is more than your team's Civicsmith can read") only for a size reason. R2a (R96): a size refusal draws the reading's own size and limit, each in the unit it
 * measures, the exact count where two figures would print alike, never the stored size of the file. R4 (R133): an archive's own page says it is an archive with its member count, has a
 * door to the archive screen and offers no read act, before or after any read. Sentences are asserted by their keys' words (K3810), never typed. */
import "../../sandbox.mjs";
import "./fixtures.mjs"; /* registers every owner's declarations before anything reads an op (R81) */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { ARCHIVE_SCREEN } from "../../../src/screens-intake/archive.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { boot, counted } from "../interface-shell/harness.mjs";
import { generate } from "../../corpus.mjs";
import { makeZip } from "../../make-zip.mjs";
import { SCREENS, main, actsIn, word } from "./fixtures.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
/* the member booted from its committed bytes (what ocr-worker's own helper does; ocr-worker is not in this module's `uses`, so the recipe is stated here) */
const MEMBER = (f) => fileURLToPath(new URL("../../../../ocr-worker/" + f, import.meta.url));
const ocrWorkerDef = () => ({ name: "ocr-worker", modulesRoot: MEMBER(""), compatibilityDate: "2026-07-01", r2Buckets: ["CAPTURES"], bindings: { VERSION: "test" },
  modules: [{ type: "ESModule", path: MEMBER("dist/ocr-worker.bundled.mjs"), contents: readFileSync(MEMBER("dist/ocr-worker.bundled.mjs"), "utf8") },
    { type: "CompiledWasm", path: MEMBER("assets/tesseract-core.wasm"), contents: readFileSync(MEMBER("assets/tesseract-core.wasm")) },
    { type: "Data", path: MEMBER("assets/eng.traineddata"), contents: readFileSync(MEMBER("assets/eng.traineddata")) }] });
const ADM = "adm-r10stated-0123456789abcdef", PASSWORD = "the founder's long password";
const mf = new Miniflare({ workers: [
  { name: "plane", modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
    serviceBindings: { OCR_WORKER: "ocr-worker" },
    bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-r10stated-0123456789abcdef", PROBE_TOKEN: "prb-r10stated-0123456789abcdef", VERSION: "4.6.0", INSTANCE_NAME: "r10stated-town",
                GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" } },
  ocrWorkerDef(),
] });
after(() => mf.dispose());
const ORIGIN = "https://group.example";
const door = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);
let AUTH = null;
async function founder() {
  if (AUTH) return AUTH;
  await (await door("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
  const signed = await (await door("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return (AUTH = { authorization: `Bearer ${signed.result.token}` });
}
const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => (await door(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
    headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() });
const rawForwarded = (auth) => Object.fromEntries(Object.keys(OPS).map((op) => [op, async (req) => {
  const r = await door(`/api/?${new URLSearchParams({ ...req.query, op })}`, { method: req.body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
    ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }) });
  return { status: r.status, json: await r.json().catch(() => null) };
}]));
/** every forwarding function is counted, so `settle()` waits on a late forwarded read (interface-shell K5242) */
const forwarded = (auth) => Object.fromEntries(Object.entries(rawForwarded(auth)).map(([op, f]) => [op, counted(f)]));
const upload = async (auth, bytes, name, type) => (await (await door(`/api/?op=captureupload&statement=r10stated&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: auth, body: bytes })).json()).result;
const until = async (p, done, ms = 90000) => {
  const end = Date.now() + ms;
  for (;;) { await p.settle(20); if (done()) return true; if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)); }
};
const text = (el) => String(el && el.textContent || "");
const bytesOf = async (recipe) => Buffer.from(await generate(recipe).bytes());

/** The member's own act: upload, filed by the screen's own promotion; then the plane's reading, waited for until it has said what it will say; then the page over the real door. */
async function probe(bytes, name, type, { tried = false, ready = () => true } = {}) {
  const auth = await founder();
  const cs = screenCall(auth);
  const up = await upload(auth, bytes, name, type);
  assert.ok(up && up.capture && up.document, "the upload is held: " + JSON.stringify(up).slice(0, 300));
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: name, locator: up.document.locator, project: "" });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 300));
  const sha = up.capture.sha256;
  const readNow = async () => (await (await door(`/api/?op=reading&sha256=${sha}`, { headers: auth })).json()).result;
  const settle = async () => {
    let r = null;
    for (const end = Date.now() + 120000; Date.now() < end;) {
      r = await readNow();
      if (r && r.found === true && r.more !== true && r.reading && (r.reading.failure || r.completeness) && ready(r)) return r;
      await new Promise((x) => setTimeout(x, 400));
    }
    return r;
  };
  let reading = await settle();
  if (tried) { /* the ledger's one attempt: what the member's "Read it" does */
    await (await door("/api/?op=readheld", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ sha }) })).arrayBuffer();
    reading = await settle();
  }
  /* the archive screen is booted too: a door to a screen the app does not hold is not drawn as a link (interface-shell R12) */
  const open = async () => {
    /* the archive screen is booted too: a door to a screen the app does not hold is not drawn as a link (interface-shell R12) */
    const page = await boot({ screens: [...SCREENS, ARCHIVE_SCREEN], plane: forwarded(auth), path: "/app/document/" + filed.bundleId });
    assert.ok(await until(page, () => !!main(page).querySelector("[data-text-state], [data-archive]")), "the page is drawn");
    /* a reading that states itself draws its statement; a whole one draws none, and is not waited for */
    const states = !!(reading && reading.reading && (reading.reading.failure || (reading.completeness && reading.completeness.state === "stated")));
    await until(page, () => !!main(page).querySelector("[data-reading]") || !!main(page).querySelector("[data-archive]"), states ? 30000 : 1500);
    return page;
  };
  const page = await open();
  return { page, reading, sha, bundleId: filed.bundleId, shown: () => text(main(page)), open, tryRead: async () => (await (await door("/api/?op=readheld", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ sha }) })).arrayBuffer()) };
}
/* the size sentence's own tail, read from its key: the stem a non-size reading must never carry */
const STEM = word("screen.document.reading.stated", { size: "@@" }).split("@@")[1].split(".")[0].trim();
const same = (a, b) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
const SIZE_REASON = "TOO_LARGE";
/* what the plane's reading states of itself: its reason and, failing a word held for it, its own sentence */
const refusedReasons = (reading) => [...new Set(((reading.reading && reading.reading.ocr_refused) || []).map((r) => String((r && r.reason) || "")).filter(Boolean))];
const reasonOf = (reading) => String((reading.reading && reading.reading.reason) || reading.reason || refusedReasons(reading)[0] || "");
const ownSentence = (reading) => String((reading.completeness && reading.completeness.why) || (reading.reading && reading.reading.basis) || "").trim();
function assertOwnReading(t, reading, label) {
  assert.ok(!t.includes(STEM), `${label}: the size sentence's stem is never drawn for a reading whose reason is not a size: ${t.slice(0, 400)}`);
  const reason = reasonOf(reading);
  assert.notEqual(reason, SIZE_REASON, `${label}: the shape is a reading with no size reason`);
  for (const c of refusedReasons(reading)) if (hasWord("refusal." + c)) assert.ok(t.includes(word("refusal." + c)), `${label}: the word held for the member's reason ${c} is drawn`);
  if (reason && hasWord("refusal." + reason)) assert.ok(t.includes(word("refusal." + reason)), `${label}: the word held for ${reason} is drawn`);
  else if (ownSentence(reading)) assert.ok(t.replace(/\s+/g, " ").includes(ownSentence(reading).replace(/\s+/g, " ")), `${label}: the statement the reading states is drawn: ${ownSentence(reading)}`);
}

test("R1 R96 G1 (the real plane, the real OCR member) a PNG the reader finds nothing in (A7): the page draws what the reading states, never the size sentence for a 6 KB picture", async () => {
  const { reading, shown } = await probe(await bytesOf({ kind: "png", seed: "rw9-A-7", size: { lines: 3 } }), "a7.png", "image/png", { ready: (r) => Array.isArray(r.reading.ocr_refused) || (Array.isArray(r.text_units) && r.text_units.length > 0) });
  assertOwnReading(shown(), reading, "NOTHING_TRANSCRIBED png");
});

test("R1 R96 G1 (the real plane, the real OCR member) a PNG turned sideways (A8): the page draws what the reading states, never the size sentence", async () => {
  const { reading, shown } = await probe(await bytesOf({ kind: "png", seed: "rw9-A-8", size: { lines: 3 }, degrade: { turn: 90 } }), "a8.png", "image/png", { ready: (r) => Array.isArray(r.reading.ocr_refused) || (Array.isArray(r.text_units) && r.text_units.length > 0) });
  assertOwnReading(shown(), reading, "turned png");
});

test("R1 R96 G1 (the real plane) an encrypted PDF (A2): the page draws the word held for its reason, never the size sentence", async () => {
  const { reading, shown } = await probe(await bytesOf({ kind: "pdf", seed: "rw9-A-2", size: { pages: 2 }, encryption: { method: "aes", user: "walkpw" } }), "a2.pdf", "application/pdf");
  assertOwnReading(shown(), reading, "encrypted pdf");
});

test("R1 R96 G1 (the real plane) text bytes in a file called .doc after the ledger's one attempt (C4): the page draws what the reading states, never the size sentence for a 140-byte file", async () => {
  const { reading, shown } = await probe(Buffer.from("legacy word text walk ".repeat(7)), "y.doc", "", { tried: true });
  assertOwnReading(shown(), reading, ".doc text");
});

test("R1 R96 G1 (the real plane) a DOCX with 300,000 paragraphs (C6): the page draws what the reading states, never the size sentence for a 30 KB file", async () => {
  const para = "<w:p><w:r><w:t>a</w:t></w:r></w:p>";
  const enc = (s) => new TextEncoder().encode(s);
  const docx = makeZip([
    { name: "[Content_Types].xml", data: enc('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: "_rels/.rels", data: enc('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: "word/document.xml", data: enc('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + para.repeat(300000) + "</w:body></w:document>") },
  ]);
  const { reading, shown } = await probe(Buffer.from(docx), "c6.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assertOwnReading(shown(), reading, "docx over the object bound");
});

test("R1 R96 G1 (the real plane) a PDF cut short (A5b): the page draws what the reading states, never the size sentence", async () => {
  const { reading, shown } = await probe(await bytesOf({ kind: "pdf", seed: "rw9-A-5b", size: { pages: 4 }, truncate: 0.7 }), "a5b.pdf", "application/pdf");
  assertOwnReading(shown(), reading, "truncated pdf");
});

const notesOf = (reading) => (reading.reading && reading.reading.recovery_notes) || reading.recovery_notes || [];
const NOTE_VARS = (n) => (n.note === "pages_missing" ? { missing: String(n.missing), of: String(n.of) } : {});

test("R9 R62 (the real plane) a PDF cut at 70 per cent: each recovery note the reading lists is drawn by the design's key, with the pages missing and the total; a sound PDF draws none", async () => {
  const cut = await probe(await bytesOf({ kind: "pdf", seed: "b60-recovery-cut", size: { pages: 4 }, truncate: 0.7 }), "cut.pdf", "application/pdf");
  const notes = notesOf(cut.reading);
  assert.ok(notes.length > 0, "the plane lists the repair a cut file needed: " + JSON.stringify(cut.reading.reading).slice(0, 300));
  for (const n of notes) {
    /* the design's row once rows.mjs is regenerated (the round's end); until then the page draws the key */
    const key = "screen.document.recovery." + n.note;
    assert.ok(cut.shown().replace(/\s+/g, " ").includes(hasWord(key) ? word(key, NOTE_VARS(n)) : key), n.note + " is drawn");
  }
  assert.equal(main(cut.page).querySelectorAll("[data-recovery]").length, notes.filter((n) => ["xref_reconstructed", "pdf_truncated", "pages_missing"].includes(n.note)).length);
  /* control: a sound file lists no note and the page draws none */
  const sound = await probe(await bytesOf({ kind: "pdf", seed: "rw9-sound", size: { pages: 2 } }), "sound.pdf", "application/pdf");
  assert.equal(notesOf(sound.reading).length, 0);
  assert.equal(main(sound.page).querySelectorAll("[data-recovery]").length, 0);
});

/* the figures a size refusal draws, each in the unit it measures; a unit's own row when held, else the exact count alone */
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const UNIT = (m) => "screen.document.reading.unit." + m;
const fig = (n, metric, alike) => (metric === "bytes" && !alike ? word("size.mb", { n: (n / 1048576).toFixed(1) }) : hasWord(UNIT(metric)) ? word(UNIT(metric), { n: grouped(n) }) : grouped(n));

test("R2a R96 G1 (the real plane) an ODS whose content.xml is 31.7 MB (B2d): the page draws the reading's own size and limit, never the 2.0 MB the file is stored at", async () => {
  const bytes = await bytesOf({ kind: "ods", seed: "rw9-B-2d", size: { rows: 45000, cols: 6 } });
  const { reading, shown } = await probe(bytes, "b2d.ods", "application/vnd.oasis.opendocument.spreadsheet");
  const r = reading.reading;
  assert.equal(r.reason, SIZE_REASON, "the plane states a size refusal: " + JSON.stringify(r).slice(0, 300));
  assert.ok(Number.isFinite(r.size) && Number.isFinite(r.bound) && r.size > r.bound);
  const t = shown();
  assert.ok(t.includes(word("screen.document.reading.toolarge", { size: fig(r.size, "bytes", false), limit: fig(r.bound, "bytes", false) })), "the measured part's size and the limit: " + t.slice(0, 500));
  assert.notEqual(reading.bytes, r.size, "the stored size of the file is not the figure refused");
  assert.ok(!t.includes(word("screen.document.reading.stated", { size: word("size.mb", { n: (reading.bytes / 1048576).toFixed(1) }) })), "never the stored size as the refused one");
});

test("R2a R96 G1 (the real plane) a CSV of 1,048,577 rows (B3d): the page draws the row count and its limit as counts, never a byte size", async () => {
  const bytes = await bytesOf({ kind: "csv", seed: "rw9-B-3d", size: { rows: 1048576, cols: 1 } });
  const { reading, shown, page } = await probe(bytes, "b3d.csv", "text/csv");
  const r = reading.reading;
  assert.equal(r.reason, SIZE_REASON);
  assert.equal(r.size, 1048577);
  assert.equal(r.bound, 1048576);
  const t = shown();
  assert.ok(t.includes(word("screen.document.reading.toolarge", { size: fig(r.size, "rows", true), limit: fig(r.bound, "rows", true) })), "the row count and the row limit: " + t.slice(0, 500));
  const statement = text(main(page).querySelector('[data-reading="stated"]'));
  assert.ok(!statement.includes(word("size.mb", { n: (reading.bytes / 1048576).toFixed(1) })) && !statement.includes(word("size.kb", { n: String(Math.round(reading.bytes / 1024)) })), "no byte size of the file is drawn in the statement");
});

test("R2a R96 G1 (the real plane) a PDF one byte over the limit (A4c): the size and the limit are told apart by their exact counts; control: it is a size refusal, so the size sentence stays", async () => {
  const bytes = await bytesOf({ kind: "pdf", seed: "rw9-A-4c", size: { bytes: 25165825 } });
  assert.equal(bytes.length, 25165825);
  const { reading, shown } = await probe(bytes, "a4c.pdf", "application/pdf");
  const r = reading.reading;
  assert.equal(r.reason, SIZE_REASON);
  assert.equal(r.size, 25165825);
  assert.equal(r.bound, 25165824);
  const t = shown();
  assert.ok(t.includes(word("screen.document.reading.toolarge", { size: fig(r.size, "bytes", true), limit: fig(r.bound, "bytes", true) })), "one byte over reads as one byte over: " + t.slice(0, 500));
  assert.notEqual(fig(r.size, "bytes", true), fig(r.bound, "bytes", true));
});

test("R4 R133 G1 (the real plane) a ZIP of three text files (C1): its own page says it is an archive with three members and has a door to the archive screen; no read is offered, before or after the ledger's attempt; never the size sentence", async () => {
  const enc = (s) => new TextEncoder().encode(s);
  const zip = makeZip([1, 2, 3].map((i) => ({ name: `m${i}.txt`, data: enc(`member number ${i} has some words in it, enough to be read as text`) })));
  const { page: first, shown: shownFirst, open, tryRead } = await probe(Buffer.from(zip), "c1.zip", "application/zip");
  await tryRead(); /* the ledger's one attempt, as the member's "Read it" would make it, were it offered */
  const second = await open();
  for (const [label, page] of [["before", first], ["after", second]]) {
    const m = main(page);
    const note = m.querySelector("[data-archive]");
    assert.ok(note, `${label} a read: the page says it is an archive`);
    assert.equal(note.getAttribute("data-archive"), "3", "with its three members");
    const door = [...m.querySelectorAll("a")].find((a) => /^\/app\/archive\//.test(a.getAttribute("href") || ""));
    assert.ok(door, `${label} a read: and a door to the archive screen`);
    assert.ok(!actsIn(m).includes("readheld") && !actsIn(m).includes("pdfstructure"), `${label} a read: no read act is offered`);
    assert.ok(!text(m).includes(STEM), `${label} a read: never the size sentence`);
    assert.ok(!(hasWord("screen.document.reading.repairable") && text(m).includes(word("screen.document.reading.repairable"))), `${label} a read: never the repair sentence`);
  }
  assert.equal(typeof shownFirst(), "string");
});

test("R133 control (the real plane) a plain text file is no archive: its page draws no archive note and keeps its reading", async () => {
  const { page } = await probe(Buffer.from("A short text document with words in it, long enough to be read as text by the reader."), "plain.txt", "text/plain");
  assert.equal(main(page).querySelector("[data-archive]"), null);
});

/* R134 (cause 37; K5055; reading-pipeline R49): the page names an encoding only when it was ASSUMED. The sentence is the row owed `screen.document.encoding.assumed`; where it is not yet
 * held the name alone is drawn, so the element and the name are asserted always and the sentence when the list holds it. */
const ENCODING_SAID = "screen.document.encoding.assumed";
const LATIN = Buffer.from("Caf\xe9 r\xe9sum\xe9 na\xefve fa\xe7ade, the minutes of the \xc9conomie committee, read at the council's meeting.".replace(/'/g, "'"), "latin1");
test("R37 R134 (the real plane) Latin-1 text uploaded as cp.txt (B4b): its page names the assumed encoding; UTF-8 with a byte-order mark and text with a declared charset name none", async () => {
  const assumed = await probe(LATIN, "cp.txt", "text/plain");
  assert.equal(assumed.reading.reading.encoding_assumed, true, "the plane states that the encoding was assumed: " + JSON.stringify(assumed.reading).slice(0, 1500));
  const el = main(assumed.page).querySelector("[data-encoding-assumed]");
  assert.ok(el, "the page names it");
  assert.equal(el.getAttribute("data-encoding-assumed"), assumed.reading.reading.encoding);
  assert.ok(text(el).includes(assumed.reading.reading.encoding) || (hasWord(ENCODING_SAID) && text(el).includes(word(ENCODING_SAID, { name: assumed.reading.reading.encoding }))), "with the name");
  const bom = await probe(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Café résumé naïve façade, the minutes of the committee, read at the council's meeting.", "utf8")]), "bom.txt", "text/plain");
  assert.equal(bom.reading.reading.encoding_assumed, false, "a byte-order mark decided it");
  assert.equal(main(bom.page).querySelector("[data-encoding-assumed]"), null, "nothing is said of the encoding");
  const declared = await probe(Buffer.from(LATIN.toString("latin1") + " Declared as Latin-1 by its source.", "latin1"), "declared.txt", "text/plain; charset=iso-8859-1");
  assert.equal(declared.reading.reading.encoding_assumed, false, "a declaration decided it");
  assert.equal(main(declared.page).querySelector("[data-encoding-assumed]"), null, "nothing is said of the encoding");
});
