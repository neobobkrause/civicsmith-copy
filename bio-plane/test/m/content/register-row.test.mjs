/* content: a register row (R65–R67; T53-135, N1259). The provider is the one the module that holds register captures
   registers (`registers`, layer 5, not built yet): a five-row segment with its header, answering `holds` and `rowAt`
   as R65 states them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { contentIdFor } from "../../../src/content/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const DOC = "INFO-2026-0001-reg";
const FILE = "officers-2026.csv";
const REDUCED = { segment_sha: null, original_sha256: "f".repeat(64), original_covers: { rows: 120 }, dropped_columns: ["ssn"], import: "imp-1" };

function setup() {
  const w = world();
  const seg = w.cap("seg"); w.doc(DOC, [seg]);
  const other = w.cap("plain"); w.doc("INFO-2026-0002-plain", [other]);
  w.read(other.sha, { pageCount: 3, containerExtent: { container: "xlsx", levels: ["sheets"], sheets: [{ name: "S", rows: 9, cols: 4 }] } });
  const rows = [["id", "name", "office"], ["1", "Ada", "mayor"], ["2", "Bo", "clerk"], ["3", "Cy", "judge"], ["4", "Di", "sheriff"]];
  const calls = [];
  const provider = {
    holds: (sha) => sha === seg.sha,
    rowAt: (sha, n) => { calls.push(n); return sha === seg.sha && n >= 1 && n <= rows.length
      ? { cells: rows[n - 1], reduced: { ...REDUCED, segment_sha: seg.sha, src_row: n + 10 } } : null; },
  };
  return { w, seg, other, provider, rows, calls };
}
const range = (n, last = "C") => ({ kind: "sheet-range", sheet: FILE, range: `A${n}:${last}${n}` });
const mint = (w, bundleId, sha, extent) => w.content.mint({ bundleId, captureSha: sha, extent, mintedBy: V("ru") });

test("R65: registerRowContext is offered once; a register row mints without a reading or a chain, a row past the end is out of range, a capture the provider lacks reads as before", () => {
  const { w, seg, other, provider } = setup();
  assert.equal(w.content.registerRowContext({ holds: () => true }).ok, false, "a provider with both functions only");
  assert.deepEqual(w.content.registerRowContext(provider), { ok: true });
  assert.equal(w.content.registerRowContext(provider).reason, "LISTENER_DECLARED", "a second registration is refused");
  const m = mint(w, DOC, seg.sha, range(3));
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal("undetermined" in m, false, "the provider holds the bound");
  const row = w.content.contentRow(m.content_id);
  assert.deepEqual([row.extent_kind, row.chain, row.derivation_cap, row.cited_as], ["sheet-range", null, null, "text"]);
  assert.deepEqual(row.extent, { kind: "sheet-range", sheet: FILE, range: "A3:C3" });
  const past = mint(w, DOC, seg.sha, range(7));
  assert.deepEqual([past.ok, past.code, past.check], [false, "CONTENT_EXTENT_OUT_OF_RANGE", "C-45.1"]);
  assert.equal(w.count("content"), 1, "a refusal writes nothing");
  assert.equal(mint(w, DOC, seg.sha, { kind: "sheet-range", sheet: "", range: "A1:B1" }).ok, false, "a malformed range is refused");
  /* a capture the provider does not hold is checked against its reading, as before */
  assert.equal(mint(w, "INFO-2026-0002-plain", other.sha, { kind: "sheet-range", sheet: "Nope", range: "A1:B2" }).code, "CONTENT_EXTENT_OUT_OF_RANGE");
  assert.equal(mint(w, "INFO-2026-0002-plain", other.sha, { kind: "sheet-range", sheet: "S", range: "A1:B2" }).ok, true);
});

test("R65: cellsAt answers a register row's kept cells from the provider; row 7 is out of range", async () => {
  const { w, seg, provider } = setup();
  w.content.registerRowContext(provider);
  const m = mint(w, DOC, seg.sha, range(3));
  const got = await w.content.cellsAt(m.content_id);
  assert.deepEqual(got.cells.map((c) => [c.source.cell, c.value]), [["A3", "2"], ["B3", "Bo"], ["C3", "clerk"]]);
  assert.deepEqual(Object.keys(got.cells[0]).sort(), ["cached", "declared", "formula", "source", "type", "value"]);
  const part = await w.content.cellsAt(mint(w, DOC, seg.sha, range(2, "B")).content_id);
  assert.deepEqual(part.cells.map((c) => c.value), ["1", "Ada"], "the kept columns of the extent");
});

test("R66: a register row carries no machine-reading grade; its human form is by key and it is cited as text; an ordinary sheet row is graded as before", () => {
  const { w, seg, other, provider } = setup();
  w.content.registerRowContext(provider);
  const m = mint(w, DOC, seg.sha, range(4));
  const read = w.content.contentRead({ id: m.content_id, viewer: V("ru") });
  assert.deepEqual([read.cited_as, read.transcription.applies, read.transcription.ceiling, read.transcription.determinant], ["text", false, null, null]);
  assert.equal(read.transcription.why, word("content.why.register_row_as_filed"));
  assert.equal(read.ref, word("content.ref.register_row", { n: "4", file: FILE }));
  assert.equal(w.content.standings([m.content_id])[m.content_id].transcription.applies, false);
  const plain = mint(w, "INFO-2026-0002-plain", other.sha, { kind: "sheet-range", sheet: "S", range: "A1:B1" });
  const pr = w.content.contentRead({ id: plain.content_id, viewer: V("ru") });
  assert.notEqual(pr.transcription.applies, false, "unchanged for every other kind");
  assert.equal("register" in pr, false);
});

test("R67: the row remembers the reduction it points into; a plain row has no register key; the content id recomputes by R3", () => {
  const { w, seg, other, provider } = setup();
  w.content.registerRowContext(provider);
  const e = range(3);
  const m = mint(w, DOC, seg.sha, e);
  const row = w.content.contentRow(m.content_id);
  assert.deepEqual(row.register, { segment_sha: seg.sha, original_sha256: REDUCED.original_sha256, original_covers: REDUCED.original_covers,
    dropped_columns: REDUCED.dropped_columns, src_row: 13, import: "imp-1" });
  assert.deepEqual(w.content.contentRead({ id: m.content_id, viewer: V("ru") }).register, row.register);
  assert.equal(m.content_id, contentIdFor(seg.sha, e, null), "the register is no part of the address");
  const again = mint(w, DOC, seg.sha, e);
  assert.deepEqual([again.minted, again.content_id], [false, m.content_id]);
  const plain = mint(w, "INFO-2026-0002-plain", other.sha, { kind: "sheet-range", sheet: "S", range: "A1:B1" });
  assert.equal("register" in w.content.contentRow(plain.content_id), false);
  /* the column is a migration over an earlier table: a store without it gains it */
  w.st.sql.exec(`ALTER TABLE content DROP COLUMN register`);
  w.content.migrate();
  assert.equal(w.content.contentRow(m.content_id).register, undefined, "a row minted before the column has no register key");
});

test("F1 (citation R28, registers R30): cellsAt answers removed for a register row the provider says was removed; a provider that throws, or has no removed, answers the cells as before", async () => {
  const { w, seg, provider } = setup();
  const gone = new Set([4]);
  let throws = false;
  provider.removed = (sha, n) => { if (throws) throw new Error("down"); return sha === seg.sha && gone.has(n); };
  w.content.registerRowContext(provider);
  const four = mint(w, DOC, seg.sha, range(4));
  const three = mint(w, DOC, seg.sha, range(3));
  const got = await w.content.cellsAt(four.content_id);
  assert.deepEqual([got.cells, got.reason], [null, "removed"]);
  assert.equal(typeof got.why, "string"); assert.ok(got.why.length > 0, "the why is a sentence");
  const kept = await w.content.cellsAt(three.content_id);
  assert.deepEqual(kept.cells.map((c) => c.value), ["2", "Bo", "clerk"], "a row not removed answers its cells");
  /* a range over several rows is removed when any row in it was */
  const span = mint(w, DOC, seg.sha, { kind: "sheet-range", sheet: FILE, range: "A3:C5" });
  assert.equal((await w.content.cellsAt(span.content_id)).reason, "removed");
  throws = true;
  const thrown = await w.content.cellsAt(four.content_id);
  assert.deepEqual(thrown.cells.map((c) => c.value), ["3", "Cy", "judge"], "a provider that throws answers false");
});

test("F1 control: a provider with no removed function answers a register row's cells as before", async () => {
  const { w, seg, provider } = setup();
  w.content.registerRowContext(provider);
  const four = mint(w, DOC, seg.sha, range(4));
  const got = await w.content.cellsAt(four.content_id);
  assert.deepEqual(got.cells.map((c) => c.value), ["3", "Cy", "judge"]);
});
