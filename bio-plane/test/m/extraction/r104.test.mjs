/* extraction R104 (fix round 9, G127a, G127d; K4833; restates R81, R88; acquisition R113 `readRange`, provenance R74/R78 `partsOf`): the whole digest
   is the only key. A capture held in parts is registered by its whole (provenance R74) and read by its whole through `acquisition.readRange`, without
   waiting for a whole object to be kept; a part's digest is no capture, and a part shared by two wholes names neither. Through the module's real
   entry (`readHeld`, `readingFor`) over a register stand-in with provenance's shape (`homeOf` of wholes, `partsOf`). Each test names the ids it checks.
   R81's tests (the home of a capture registered by its parts) are superseded by these (R104 restates R81). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, withEntry, i2, doc, sha, homesOver } from "./fixture.mjs";

/* a pdf entry that reads the bytes it is handed as one page's text, so a reading shows which bytes it was made from */
const asText = { format: "pdf", structure: async (bytes) => ({ ok: true, text: i2([{ page: 0, text: new TextDecoder().decode(bytes) }]), pages: 1, notes: [] }) };
const register = (rows, parts = null) => homesOver(rows, parts);
const row = (bundleId, bytes) => ({ bundleId, path: "a.pdf", encoding: "binary", bytes, registered: "t", authored: false });
const count = (w, table, d) => w.one(`SELECT count(*) c FROM ${table} WHERE capture_sha=?`, d).c;
const units = (w, d) => w.x.readingFor(d, "class:admin").text_units.map((u) => u.text).join(" ");

/* One store holding wholes kept only as parts: `docs` is `[{bundleId, chunks: [string, ...]}]`, each a document whose whole is the chunks joined. The
   parts are put under their own digests and the wholes are never put; the register names each whole once (provenance R74) and `partsOf` its parts. */
function held(docs) {
  const rows = new Map(), parts = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows, parts) });
  const files = new Map();
  const out = [];
  for (const { bundleId, chunks } of docs) {
    if (!files.has(bundleId)) { bundle(w.s, bundleId); files.set(bundleId, []); }
    const bytes = new TextEncoder().encode(chunks.join(""));
    const d = sha(bytes);
    const ps = chunks.map((c, i) => { const b = new TextEncoder().encode(c); return { file: `p${i}.bin`, sha256: sha(b), bytes: b.length, b }; });
    rows.set(d, row(bundleId, bytes.length));
    parts.set(d, ps.map((p) => ({ sha256: p.sha256, bytes: p.bytes })));
    files.get(bundleId).push(doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf", parts: ps.map(({ b, ...p }) => p) }));
    out.push({ d, ps, bytes, bundleId });
  }
  w.core.readFile = (b, p) => (p === "data/provenance.json" && files.has(b) ? { text: JSON.stringify({ documents: files.get(b) }) } : null);
  return { w, evidence, out, async put() { for (const o of out) for (const p of o.ps) await evidence.put(`bio/captures/${p.sha256}`, p.b); } };
}

test("R104 (G127d): a capture held only in parts is read by its whole digest through `readRange`, with no whole object kept: `readHeld` reads it, the reading is the whole's bytes, `op=reading` by the whole finds it", async () => {
  const h = held([{ bundleId: "INFO-1", chunks: ["%PDF-1.7 the first part of a budget, ", "and the second part ends it MARKLAST"] }]);
  await h.put();
  const [{ d, ps }] = h.out;
  assert.equal(await h.evidence.get(d), null, "no whole object is held");
  const r = await withEntry(asText, () => h.w.x.readHeld({ sha: d }));
  assert.deepEqual([r.ok, r.read, r.bundle_id], [true, true, "INFO-1"], JSON.stringify(r));
  assert.match(units(h.w, d), /first part of a budget, and the second part ends it MARKLAST/);
  for (const p of ps) assert.equal(count(h.w, "readings", p.sha256), 0, "nothing is written under a part");
});

test("R104 (G127a): the same document filed in two projects and two versions sharing part 1 each read their own: no `NO_HOME`, no first-wins answer (PDF E9, SCAN E6)", async () => {
  const shared = "%PDF-1.7 a shared first part of eight bytes and more, ";
  const h = held([
    { bundleId: "PROJ-A", chunks: [shared, "the first version's tail ALPHAEND"] },
    { bundleId: "PROJ-B", chunks: [shared, "the second version's tail BETAEND"] },
  ]);
  await h.put();
  const [a, b] = h.out;
  assert.equal(a.ps[0].sha256, b.ps[0].sha256, "part 1 is one digest in both");
  const ra = await withEntry(asText, () => h.w.x.readHeld({ sha: a.d }));
  const rb = await withEntry(asText, () => h.w.x.readHeld({ sha: b.d }));
  assert.deepEqual([ra.read, ra.bundle_id, rb.read, rb.bundle_id], [true, "PROJ-A", true, "PROJ-B"]);
  assert.match(units(h.w, a.d), /ALPHAEND/);
  assert.doesNotMatch(units(h.w, a.d), /BETAEND/);
  assert.match(units(h.w, b.d), /BETAEND/);
  /* the shared part is no capture: it names neither whole */
  const rp = await withEntry(asText, () => h.w.x.readHeld({ sha: a.ps[0].sha256 }));
  assert.deepEqual([rp.read, rp.why], [false, "NO_HOME"]);
  assert.equal(h.w.x.readingFor(a.ps[0].sha256, "class:admin").found, false);
  assert.equal(count(h.w, "readings", a.ps[0].sha256), 0);
});

test("R104 (control): a digest nothing holds writes nothing; a whole the register names whose parts are not held is `NO_WHOLE_OBJECT`; a second call on a read whole changes nothing", async () => {
  const h = held([{ bundleId: "INFO-1", chunks: ["%PDF-1.7 one ", "two"] }]);
  const [{ d }] = h.out;
  const none = await h.w.x.readHeld({ sha: sha("nothing holds this") });
  assert.deepEqual([none.read, none.why], [false, "NO_HOME"]);
  const notYet = await withEntry(asText, () => h.w.x.readHeld({ sha: d }));
  assert.deepEqual([notYet.read, notYet.why], [false, "NO_WHOLE_OBJECT"], "a capture held neither whole nor in parts");
  await h.put();
  assert.equal((await withEntry(asText, () => h.w.x.readHeld({ sha: d }))).read, true);
  const hist = count(h.w, "reading_history", d);
  const again = await withEntry(asText, () => h.w.x.readHeld({ sha: d }));
  assert.deepEqual([again.read, again.why], [false, "READING_HELD"]);
  assert.equal(count(h.w, "reading_history", d), hist);
});

test("R104 (control): a viewer who may not see the whole's bundle is answered `NO_HOME`, nothing written", async () => {
  const h = held([{ bundleId: "INFO-1", chunks: ["%PDF-1.7 one ", "two"] }]);
  await h.put();
  const [{ d }] = h.out;
  const r = await h.w.x.readHeld({ sha: d, viewer: "class:nobody" });
  assert.deepEqual([r.read, r.why], [false, "NO_HOME"]);
  assert.equal(count(h.w, "readings", d), 0);
});
