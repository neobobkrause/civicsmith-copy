/* lines at its interface: every NO_BASIS refusal answers with record-grammar's shared row C-33.40 (R22; K2610), each of
   the seven sites `recordLine` reaches, the same sites through `recordCurrentThrough` and the ops map; and, as the
   negative control (K874), the basis form's other refusals and every other refusal carry no such row. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, ANN, MACHINE } from "./fixture.mjs";
import { SHARED_ACT_CHECKS } from "../../../src/record-grammar/index.mjs";
import { linesOps } from "../../../src/lines/index.mjs";

const ROW = SHARED_ACT_CHECKS.NO_BASIS;
const T = { statement: "I attended the meeting where this was said" };

/* The seven bases each of which is refused NO_BASIS, by its site in `#basis`. */
function sites(w) {
  const s = w.held("INFO-2026-0001", sha("legistar officerecords"));
  return [
    ["no basis at all", undefined],
    ["a system rule naming no rule", { rule: "  ", source: s }],
    ["a register row's record instant that is not an instant", { rule: "seat", source: s, recorded_at: "yesterday" }],
    ["a register row with no record instant", { rule: "seat", source: s, system: "Legistar" }],
    ["a system rule whose source is neither a capture nor a profile entry", { rule: "seat", source: 5 }],
    ["testimony inside a project the record does not hold", { statement: "I was there", project: "PRJ-2026-none" }],
    ["a basis of no known form", { what: 1 }],
  ];
}

const assertRow = (r, label) => {
  assert.equal(r.ok, false, label);
  assert.equal(r.reason, "NO_BASIS", label);
  assert.equal(r.code, "NO_BASIS", label);
  assert.equal(r.check, "C-33.40", label);
  assert.equal(r.check, ROW.check, label);
  assert.equal(r.translation, ROW.translation, label);
  assert.ok(typeof r.detail === "string" && r.detail.length > 0, `${label}: the site's own detail is kept`);
  assert.notEqual(r.detail, ROW.translation, `${label}: the detail is the particular, the translation the shared sentence`);
};

test("R22 every NO_BASIS refusal recordLine answers carries record-grammar's shared row C-33.40, its check, number and translation, at each of the seven sites; none writes", () => {
  const w = world();
  const o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const list = sites(w);
  assert.equal(list.length, 7);
  const details = new Set();
  for (const [label, basis] of list) {
    const r = w.l.recordLine({ kind: "part_of", from: o, to: b, basis, by: ANN });
    assertRow(r, label);
    details.add(r.detail);
  }
  assert.ok(details.size >= 6, "each site keeps its own particular");
  /* the machine's register row, R5's case, at the same site */
  const p = w.ent("person", "Ada Example");
  assertRow(w.l.recordLine({ kind: "holds", from: p, to: o, capacity: "elected", by: MACHINE,
                             basis: { rule: "seat", source: w.held("INFO-2026-0002", sha("row")), system: "Legistar" } }), "machine register row");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM lines`).n, 0, "no refusal wrote a line");
});

test("R22 recordCurrentThrough's basis refusals and the ops map's linerecord answer with the same shared row", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const line = w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01" } });
  for (const [label, basis] of sites(w))
    assertRow(w.l.recordCurrentThrough({ lineId: line, day: "2026-01-01", basis, by: ANN }), `current through: ${label}`);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM line_current_through`).n, 0);
  const url = new URL("https://plane.example/op");
  for (const [label, basis] of sites(w))
    assertRow(linesOps(w.l, url, { kind: "part_of", from: o, to: b, basis, by: ANN }).linerecord(), `ops map: ${label}`);
});

test("R22 negative control: the basis forms' other refusals, and every other refusal, carry no C-33.40 row; a basis that stands writes", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const s = w.held("INFO-2026-0001", sha("doc"));
  const rec = (more) => w.l.recordLine({ kind: "part_of", from: o, to: b, by: ANN, ...more });
  const others = [
    ["NO_STATEMENT", rec({ basis: { statement: "  " } })],
    ["NO_SHA", rec({ basis: { captureSha: "", extent: { kind: "document" } } })],
    ["CAPTURE_NOT_HELD", rec({ basis: { captureSha: sha("nowhere"), extent: { kind: "document" } } })],
    ["NO_EXTENT", rec({ basis: { captureSha: s } })],
    ["EXTENT_NOT_IN_CAPTURE", rec({ basis: { captureSha: s, extent: { kind: "nonsense" } } })],
    ["CAPTURE_NOT_HELD", rec({ basis: { rule: "seat", source: sha("gone") } })],
    ["UNKNOWN_LINE_KIND", rec({ kind: "gave_to", basis: T })],
    ["SELF_LINE", rec({ to: o, basis: T })],
    ["BAD_TITLE", rec({ title: "Harbour Master", basis: T })],
    ["BAD_DATE", rec({ valid: { from: "2026-02-31" }, basis: T })],
    ["MACHINE_NEEDS_IDENTIFIERS", rec({ basis: T, by: MACHINE })],
    ["NO_REASON", w.l.withdrawLine({ lineId: "LIN-2026-none", by: ANN })],
  ];
  for (const [code, r] of others) {
    assert.equal(r.reason, code, code);
    assert.equal(r.check, undefined, `${code} carries no shared row`);
    assert.equal(r.translation, undefined, `${code} carries no shared translation`);
  }
  for (const basis of [T, { captureSha: s, extent: { kind: "document" } }, { rule: "profile office", source: { profile: "test-port-ellery", entry: 0 } },
                       { rule: "seat", source: s, system: "Legistar", recorded_at: "2026-09-01T12:00:00Z" }]) {
    const r = rec({ basis });
    assert.equal(r.ok, true, JSON.stringify(basis));
    assert.equal(r.check, undefined);
    assert.equal(r.translation, undefined);
  }
  assert.ok(p);
});
