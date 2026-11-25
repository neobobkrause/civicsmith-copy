/* extraction, R80 as amended (T51 fix round 9, G168; K4985): the answer that a reading is already held carries the reading's counters
   `{written, skipped}`, never `owed`, so the plane's job row learns the units the door's read and the passes wrote. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, bucket, withEntry, i2, doc, homesOver } from "./fixture.mjs";

const pdf = (text) => ({ format: "pdf", structure: async () => ({ ok: true, text: structuredClone(text), pages: (text.pages || []).length, notes: [] }) });
const register = (rows) => homesOver(rows);

async function held(pages) {
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode("%PDF-1.7 a packet " + Math.random());
  const d = await hold(evidence, bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.pdf", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d, text: i2(Array.from({ length: pages }, (_, p) => ({ page: p, text: `unit ${p} budget appropriation words` }))) };
}

test("R80 (G168): `readHeld` of a held reading of 8 units answers READING_HELD with counters.written 8, counters.skipped as the completeness states, and no owed", async () => {
  const { w, d, text } = await held(8);
  const first = await withEntry(pdf(text), () => w.x.readHeld({ sha: d }));
  assert.deepEqual([first.ok, first.read], [true, true]);
  assert.equal(first.counters, undefined, "a read just made answers as before");
  const again = await withEntry(pdf(text), () => w.x.readHeld({ sha: d }));
  const c = w.x.unitsOf(d).counters;
  assert.deepEqual([again.ok, again.read, again.why], [true, false, "READING_HELD"]);
  assert.equal(again.counters.written, 8);
  assert.deepEqual(again.counters, { written: c.written, skipped: c.skipped });
  assert.equal("owed" in again.counters, false);
});

test("R80 (G168, control): a reading not held answers as before: NO_HOME and NO_WHOLE_OBJECT carry no counters", async () => {
  const { w, d } = await held(2);
  const none = await withEntry(pdf(i2([])), () => w.x.readHeld({ sha: "a".repeat(64) }));
  assert.deepEqual([none.read, none.why, none.counters], [false, "NO_HOME", undefined]);
  const other = await w.x.readHeld({ sha: d, viewer: undefined, defer: true });
  assert.equal(other.counters, undefined, JSON.stringify(other));
});
