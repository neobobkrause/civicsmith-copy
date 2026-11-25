/* extraction R90 (fix round 6, G13; K4571): THE WALKER'S 12 MB TEXT WITH THE REAL READER. `round6.test.mjs` checks this module's half against a
   scripted provider; here reading-pipeline's own `read` (its R40, pieces by a cursor) is the provider, over a text of 120,000 lines of 100
   bytes and a last line "ENDMARKER" (12,000,060 bytes, no blank line). Each call of `readHeld` is one tick of the plane's ledger (plane R77:
   it calls `readHeld({sha, kind: "reading"})` and goes on at once while the answer says `more`). Red by name until reading-pipeline R40 has
   merged. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, docx, wp, wr, i2, withEntry, homesOver } from "./fixture.mjs";
import { extractionOps } from "../../../src/extraction/index.mjs";

const register = (rows) => homesOver(rows);
const LINES = 120000;
const lineOf = (i) => `line ${String(i).padStart(6, "0")} ` + "council-minutes ".repeat(5).padEnd(87, ".");
const longLog = () => Array.from({ length: LINES }, (_, i) => lineOf(i)).concat(["ENDMARKER" + " ".repeat(51)]).join("\n");

async function home(text, { project = null } = {}) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1", { project });
  const bytes = new TextEncoder().encode(text);
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "log.txt", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/plain", format: "undetermined", fromText: true });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, bytes };
}
const fts = (w, term) => w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH ?`, term).length;

test("R90 (G13): the 12,000,060 B text is read to its last line by the ledger's ticks, a piece each: midway a search finds only what is read and the reading says it has more; at the end ENDMARKER is in the index, the state is whole, every word is read and the entry ends", { timeout: 300_000 }, async () => {
  const { w, d, bytes } = await home(longLog());
  assert.equal(bytes.length, 12000060);
  assert.equal(w.x.readingFor(d, "class:admin").found, false, "the walker's state: nothing read");
  let ticks = 0, answer, midway = null;
  do {
    answer = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
    ticks++;
    assert.equal(answer.ok, true, JSON.stringify(answer));
    if (ticks === 3) midway = { reading: w.x.readingFor(d, "class:admin"), end: fts(w, "ENDMARKER"), some: fts(w, "council"), state: w.x.unitsOf(d).state };
  } while (answer.more === true && ticks < 100);
  assert.ok(ticks > 6 && ticks < 100, `read in ${ticks} ticks`);
  assert.equal(answer.read, true, "the last tick reads the last piece");
  assert.equal(midway.reading.more, true, "midway the reading says it has more");
  assert.ok(midway.reading.read_through > 0 && midway.reading.read_through < midway.reading.total, "and how far");
  assert.equal(midway.end, 0, "midway a search finds only what is read: the last line is not found");
  assert.ok(midway.some > 0);
  assert.equal(midway.state, "partial", "never stated whole while more follows");
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.more, got.read_through, got.total], [false, 12000060, 12000060]);
  assert.equal(got.reading.words_read, got.reading.words_total, "every word is read");
  assert.equal(fts(w, "ENDMARKER"), 1, "R-STOP: the last line is in the index");
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.offered, st.counts.written, st.counts.over_bound], ["whole", LINES + 1, LINES + 1, 0]);
  const last = w.one(`SELECT seq, text FROM capture_text WHERE capture_sha=? ORDER BY seq DESC LIMIT 1`, d);
  assert.deepEqual([last.seq, last.text], [LINES, "ENDMARKER"]);
  assert.ok(w.one(`SELECT ref FROM capture_text WHERE capture_sha=? AND seq=?`, d, LINES - 5), "a passage near the end is in the index with its address");
  assert.equal(w.one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, d).c, 1, "the pieces change no reading");
  const again = await w.x.readHeld({ sha: d, kind: "reading" });
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"], "a finished text is held as any reading is");
});

test("R90 (control): a text within one piece (4,000 lines, 400 KB) is complete at once: the first tick reads all of it, no `more`, whole, every word read", async () => {
  const text = Array.from({ length: 4000 }, (_, i) => lineOf(i)).concat(["ENDMARKER"]).join("\n");
  const { w, d } = await home(text);
  const r = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.deepEqual([r.ok, r.read, r.more], [true, true, undefined], JSON.stringify(r));
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.more, got.read_through === got.total], [false, true]);
  assert.equal(w.x.unitsOf(d).state, "whole");
  assert.equal(fts(w, "ENDMARKER"), 1);
});

test("R90 (control): a viewer who may not see the text's bundle gets no tick of it, and is told no more than a record that is absent", async () => {
  const { w, d } = await home(longLog().slice(0, 2_000_000), { project: "PROJ-9" });
  const r = await w.x.readHeld({ sha: d, kind: "reading", viewer: "member:outsider" });
  assert.deepEqual([r.read, r.why], [false, "NO_HOME"]);
  assert.equal(w.x.readingFor(d, "class:admin").found, false);
});

/* G14: every format is continued, not only text. */
async function homeOf(bytes, { ct, format, fromText = false }) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.bin", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct, format, fromText });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d };
}
const toEnd = async (w, d, run = (f) => f()) => {
  let ticks = 0, a;
  do { a = await run(() => w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} })); ticks++; } while (a.more === true && ticks < 60);
  return ticks;
};
const paged = (w, d) => {
  const out = []; let after = null, guard = 0;
  do {
    const q = new URLSearchParams({ sha256: d, store: "bio", viewer: "class:admin", ...(after === null ? {} : { after: String(after) }) });
    const page = extractionOps(w.x, new URL(`http://x/reading?${q}`), null, {}).reading();
    out.push(...page.text_units); after = page.next;
  } while (after !== null && ++guard < 40);
  return out;
};

test("R91 R90 (G14): a 6,000-paragraph .docx is read to its last paragraph in pieces; the tail is found by search and reached by paging op=reading; the page says partial while read and whole at the end", async () => {
  const body = Array.from({ length: 6000 }, (_, i) => wp(wr(`paragraph ${i} of the long minutes ${"council ".repeat(40)}${i === 5999 ? " ENDMARKER" : ""}`))).join("");
  const { w, d } = await homeOf(docx(body), { ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", format: "docx" });
  const first = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.deepEqual([first.read, first.more], [true, true], JSON.stringify(first));
  assert.equal(w.x.readingFor(d, "class:admin").completeness.state, "partial");
  assert.equal(fts(w, "ENDMARKER"), 0);
  await toEnd(w, d);
  const got = w.x.readingFor(d, "class:admin");
  assert.deepEqual([got.completeness.state, got.more], ["whole", false]);
  assert.equal(fts(w, "ENDMARKER"), 1, "R-STOP: the tail is searchable");
  assert.equal(got.units_total, 6000);
  const all = paged(w, d);
  assert.equal(all.length, 6000);
  assert.match(all[5999].text, /ENDMARKER/, "and reached by paging");
});

test("R91 R90 (G14): a 300-page dense PDF (9 KB a page) is read to its last page in pieces, each piece within the index's bound; unread_pages is empty at the end", async () => {
  const line = "alpha beta gamma delta epsilon ".repeat(300);
  const pages = Array.from({ length: 300 }, (_, page) => ({ page, text: `${page} ${line}${page === 299 ? " ENDMARKER" : ""}` }));
  const bytes = new TextEncoder().encode("%PDF-1.7 a dense packet " + Math.random());
  const { w, d } = await homeOf(bytes, { ct: "application/pdf", format: "pdf" });
  const entry = { format: "pdf", detect: (b) => (b && String.fromCharCode(...b.subarray(0, 5)) === "%PDF-" ? { format: "pdf", confidence: "certain", signals: [] } : null),
    structure: async () => ({ ok: true, text: structuredClone(i2(pages)), pages: 300, notes: [] }) };
  const ticks = await toEnd(w, d, (f) => withEntry(entry, f));
  assert.ok(ticks >= 2, `${ticks} ticks`);
  const st = w.x.unitsOf(d);
  assert.deepEqual([st.state, st.counts.written, st.counts.over_bound], ["whole", 300, 0]);
  assert.equal(fts(w, "ENDMARKER"), 1);
  assert.deepEqual(w.x.readingFor(d, "class:admin").unread_pages ?? [], []);
});
