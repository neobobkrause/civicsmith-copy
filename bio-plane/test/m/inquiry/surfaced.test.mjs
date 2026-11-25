/* R50 (C-66.5, REC-179): a revision of a bundle whose current version is an inquiry carries `surfaced_by` forward. This
   module's registered promotion check compares the value the record's parser reads from the held `bundle.md` with the
   revision's, after the compare-and-swap and before any write; `replay` is no exemption. Driven through the real
   `promotion.promote`. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd } from "./fixture.mjs";
import { INQUIRY_SURFACE_CHECKS } from "../../../src/inquiry/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const Q = "INQ-2026-0001-q";
const ROW = INQUIRY_SURFACE_CHECKS.SURFACED_BY_REWRITTEN;
const as = (text, value) => (value === null ? text.replace("surfaced_by: human\n", "")
  : text.replace("surfaced_by: human", `surfaced_by: ${value}`));

test("R50 the row moved with its number and translation unchanged, its where naming this module's site", () => {
  assert.equal(ROW.check, "C-66.5");
  assert.equal(ROW.translation, word("refusal.SURFACED_BY_REWRITTEN"));
  assert.match(ROW.where, /^src\/inquiry\/index\.mjs check > is-promote-surfaced-by/);
});

test("R50 a revision that rewrites surfaced_by is SURFACED_BY_REWRITTEN in either direction, naming both values, and nothing is written", () => {
  const w = world(); w.inquiry(Q);
  const held = w.record.head(Q).bundleSha;
  const r = w.promote(Q, as(w.text(Q), "agent"));
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, r.bundleId, r.current, r.revision],
    [false, "SURFACED_BY_REWRITTEN", "SURFACED_BY_REWRITTEN", "C-66.5", ROW.translation, Q, '"human"', '"agent"']);
  assert.match(r.detail, /records surfaced_by "human", and this revision records "agent"/);
  assert.equal(w.record.head(Q).bundleSha, held, "nothing was written");
  /* the other direction, and a field dropped or supplied: absent is a value */
  const w2 = world(); w2.promote("INQ-2026-0002-a", as(inquiryMd("INQ-2026-0002-a"), "agent"));
  const back = w2.promote("INQ-2026-0002-a", w2.text("INQ-2026-0002-a").replace("surfaced_by: agent", "surfaced_by: human"));
  assert.deepEqual([back.reason, back.current, back.revision], ["SURFACED_BY_REWRITTEN", '"agent"', '"human"']);
  /* a dropped field: the entry arm refuses it first (R11, C-2.8); on a replay, exempt from that arm, R50 still refuses */
  const dropped = w.promote(Q, as(w.text(Q), null));
  assert.deepEqual([dropped.reason, dropped.findings.map((x) => x.check)], ["BASIS_REFUSED", ["C-2.8"]]);
  const droppedReplay = w.promote(Q, as(w.text(Q), null), undefined, { replay: true });
  assert.deepEqual([droppedReplay.reason, droppedReplay.current, droppedReplay.revision], ["SURFACED_BY_REWRITTEN", '"human"', "absent"]);
});

test("R50 replay is no exemption; a respelling of the same value lands; an unchanged value lands", () => {
  const w = world(); w.inquiry(Q);
  const replay = w.promote(Q, as(w.text(Q), "agent"), undefined, { replay: true });
  assert.equal(replay.reason, "SURFACED_BY_REWRITTEN", "a caller's replay claim is not verified on a revision");
  const quoted = w.promote(Q, as(w.text(Q), '"human"'));
  assert.equal(quoted.ok, true, JSON.stringify(quoted).slice(0, 300));
  assert.equal(w.fm(Q).surfaced_by, "human");
  const same = w.promote(Q, w.text(Q).replace("## Session Log", "## Session Log\n\nA note."));
  assert.equal(same.ok, true, JSON.stringify(same).slice(0, 300));
});

test("R50 only a revision of a bundle whose current version is an inquiry is asked: a creation states its own origin", () => {
  const w = world();
  const made = w.promote(Q, as(inquiryMd(Q), "agent"));
  assert.equal(made.ok, true, "a creation is not a revision");
  assert.equal(w.fm(Q).surfaced_by, "agent");
  /* a document that is not an inquiry carries no surfacing to compare */
  w.doc("INFO-2026-0001-a");
  const info = w.record.readFile("INFO-2026-0001-a", "bundle.md").text;
  const r = w.promotion.promote({ bundleId: "INFO-2026-0001-a", base: w.record.head("INFO-2026-0001-a").bundleSha,
    snapKey: "info-rev", author: "member:alice", meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: info.replace("---\n\n## Summary", "surfaced_by: agent\n---\n\n## Summary") },
            ...w.rows(`SELECT path, content FROM files WHERE bundle_id=? AND path<>'bundle.md'`, "INFO-2026-0001-a")
              .map((f) => ({ path: f.path, text: f.content }))] });
  assert.notEqual(r.reason, "SURFACED_BY_REWRITTEN", JSON.stringify(r).slice(0, 300));
});
