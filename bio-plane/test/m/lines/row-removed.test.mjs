/* lines F1 (citation R28's interest-line arm; registers R30): a member's interest line (`owns_interest_in`, Form 700)
   built from a register row names the row's content id; when the row is later removed under K1493, `content.cellsAt`
   answers `{cells: null, reason: "removed"}` (registers R30's stated shape) and the line reads the row as removed, with
   no byte of it shown, the line itself standing. registers' side is not merged: the fixture's `cellsAt` answers its
   stated shape. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, ANN } from "./fixture.mjs";
import { ROW_STATES, rowStateLabel } from "../../../src/lines/vocab.mjs";
import { REASON_KEYS, reasonText } from "../../../src/lines/reasons.mjs";

/* A member's Form 700 interest line over a register row, with the content row it cites. */
function interest() {
  const w = world();
  const p = w.ent("person", "Ada Example"), firm = w.ent("institution", "Harbour Freight Ltd");
  const s = w.held("INFO-2026-0700", sha("form 700 register"));
  const m = w.content.mint({ bundleId: "INFO-2026-0700", captureSha: s, extent: { kind: "document" } });
  assert.equal(m.ok, true, JSON.stringify(m));
  const r = w.l.recordLine({ kind: "owns_interest_in", from: p, to: firm, by: ANN,
                             basis: { captureSha: s, extent: { kind: "document" }, contentId: m.content_id } });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { w, line: r.line_id, contentId: m.content_id, p };
}

test("F1 an interest line over a removed register row reads the row as removed, shows none of it, and stands", async () => {
  const { w, line, contentId, p } = interest();
  const asked = [];
  /* registers R30's stated answer for a row rowExpunge took */
  w.content.cellsAt = async (id) => { asked.push(id); return { cells: null, reason: "removed", why: "the row was removed" }; };
  const r = await w.l.lineRow({ lineId: line, viewer: ANN });
  assert.equal(r.ok, true);
  assert.equal(r.found, true);
  assert.deepEqual(asked, [contentId], "the row is asked of content by the content id the line names");
  assert.equal(r.row.content_id, contentId);
  assert.equal(r.row.state, "removed");
  assert.ok(ROW_STATES.includes(r.row.state));
  assert.equal(r.row.cells, null, "no content shown");
  assert.equal(r.row.label, rowStateLabel("removed"));
  assert.ok(r.row.label.length > 0);
  assert.equal(typeof r.row.why, "object");
  assert.equal(r.row.why.key, "lines.why.row_removed");
  assert.ok(REASON_KEYS.includes(r.row.why.key));
  assert.deepEqual(r.row.why.vars, { content_id: contentId });
  assert.ok(reasonText(r.row.why).length > 0);
  assert.ok(!JSON.stringify(r.row).includes("the row was removed"), "content's own words about the row are not passed on");
  /* the line stands: not withdrawn, still read and listed */
  assert.equal(r.line.withdrawn, null);
  assert.equal(r.line.kind, "owns_interest_in");
  assert.equal(r.line.basis.contentId, contentId);
  const of = w.l.linesOf({ entity: p, viewer: ANN });
  assert.deepEqual(of.lines.map((l) => l.line_id), [line]);
});

test("F1 control: a held row answers its cells; any other no-cells answer is unread, never removed", async () => {
  const { w, line, contentId } = interest();
  w.content.cellsAt = async () => ({ cells: [["Harbour Freight Ltd", "10%"]] });
  const held = await w.l.lineRow({ lineId: line, viewer: ANN });
  assert.equal(held.row.state, "held");
  assert.deepEqual(held.row.cells, [["Harbour Freight Ltd", "10%"]]);
  assert.equal(held.row.why, undefined);
  w.content.cellsAt = async () => ({ cells: null, reason: "stale", why: "x" });
  const stale = await w.l.lineRow({ lineId: line, viewer: ANN });
  assert.equal(stale.row.state, "unread");
  assert.equal(stale.row.cells, null);
  assert.equal(stale.row.why.key, "lines.why.row_unread");
  assert.deepEqual(stale.row.why.vars, { content_id: contentId, reason: "stale" });
});

test("F1 control: a line naming no row answers row null and asks content nothing; an unheld content id is refused", async () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), firm = w.ent("institution", "Harbour Freight Ltd");
  let asked = 0;
  w.content.cellsAt = async () => { asked++; return { cells: null, reason: "removed" }; };
  const line = w.say("owns_interest_in", p, firm);
  const r = await w.l.lineRow({ lineId: line, viewer: ANN });
  assert.equal(r.row, null);
  assert.equal(asked, 0);
  const s = w.held("INFO-2026-0701", sha("another register"));
  const bad = w.l.recordLine({ kind: "owns_interest_in", from: p, to: firm, by: ANN,
                               basis: { captureSha: s, extent: { kind: "document" }, contentId: "CNT-none" } });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "NO_SUCH_CONTENT");
  const absent = await w.l.lineRow({ lineId: "LIN-2026-none", viewer: ANN });
  assert.equal(absent.found, false);
});
