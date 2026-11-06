/* action-records R21 (T53; N1257; K5458): a proposed law keeps its layer. `action_law_proposals` gains `layer`, empty for
   rows written before; `actionLawsPropose` takes and stores it and `lawProposalsFor` (what `actions` answers as
   `governing_laws_proposals`) answers it. A citation two active layers give at the entry's level, with no `layer`, is stored
   as written and answered `layer: null, ambiguous: true`, never settled for the proposer; the two layers are told apart by
   `jurisdictions.nameResolve` (its R121). The active layers are `jurisdictions`' own: its published test forest (its R118)
   handed in as the `layers` dependency, or the shipped layers named by record-core's `jurisdiction_profiles`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, storage, MACHINE, M, A, B } from "./fixture.mjs";
import * as records from "../../../src/action-records/index.mjs";
import { RECORD_SCHEMA, recordOf } from "../../../src/record-core/index.mjs";
import { GOVERNING_LAW_CHECKS, LAW_LAYER_MAX } from "../../../src/action-grammar/index.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";

const CIVIC = () => forestCopy(FOREST.all).filter((l) => l.layer.origin !== "team");
const AVILLE = "Aville County Records Rule § 1";
/* the forest with a second county layer (Bville County) also giving Aville's rule, at the county level */
const TWO_GIVE = () => CIVIC().map((l) => (l.id !== "forest-county-b" ? l
  : { ...l, records_laws: [...l.records_laws, { ...l.records_laws[0], name: "Shared county rule", citation: AVILLE }] }));

test("R21 a proposal naming a layer is answered with it, by the act and by lawProposalsFor, and stored in its column", () => {
  const w = world({ deps: { layers: CIVIC } });
  w.action(A);
  const p = w.r.actionLawsPropose({ target: A, laws: [{ level: "county", citation: AVILLE, layer: "forest-county-a" },
    { level: "state", citation: "State Records Act § 1" }], proposer: MACHINE, viewer: MACHINE });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.proposal.laws, [{ level: "county", citation: AVILLE, layer: "forest-county-a" },
    { level: "state", citation: "State Records Act § 1" }]);
  assert.deepEqual(w.r.lawProposalsFor(A).proposals[0].laws, p.proposal.laws, "the read answers what the act stored");
  assert.deepEqual(w.rows(`SELECT ord, layer FROM action_law_proposals WHERE bundle_id=? ORDER BY ord`, A),
    [{ ord: 0, layer: "forest-county-a" }, { ord: 1, layer: null }]);
  /* a named layer is kept beside a held standard, and the proposer's restatement replaces its own layers */
  const q = w.r.actionLawsPropose({ target: A, laws: [{ level: "county", citation: AVILLE }], proposer: MACHINE, viewer: MACHINE });
  assert.deepEqual(q.proposal.laws, [{ level: "county", citation: AVILLE }], "one layer gives it: answered as before, no layer settled");
  assert.deepEqual(w.r.lawProposalsFor(A).proposals[0].laws, [{ level: "county", citation: AVILLE }]);
});

test("R21 a citation two active layers give, with no layer, is stored as written and answered layer: null, ambiguous: true", () => {
  const w = world({ deps: { layers: TWO_GIVE } });
  w.action(A);
  const p = w.r.actionLawsPropose({ target: A, laws: [{ level: "county", citation: AVILLE.toUpperCase() }], proposer: MACHINE, viewer: MACHINE });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.proposal.laws, [{ level: "county", citation: AVILLE.toUpperCase(), layer: null, ambiguous: true }],
    "never settled for the proposer");
  assert.deepEqual(w.row(`SELECT citation, layer FROM action_law_proposals WHERE bundle_id=?`, A),
    { citation: AVILLE.toUpperCase(), layer: null }, "stored as written");
  assert.deepEqual(w.r.lawProposalsFor(A).proposals[0].laws, [{ level: "county", citation: AVILLE.toUpperCase(), layer: null, ambiguous: true }]);
  /* sent with its layer, it is that layer's, and not ambiguous */
  const q = w.r.actionLawsPropose({ target: A, laws: [{ level: "county", citation: AVILLE, layer: "forest-county-b" }], proposer: M, viewer: M });
  assert.deepEqual(q.proposal.laws, [{ level: "county", citation: AVILLE, layer: "forest-county-b" }]);
  /* control: the same citation at another level is given by no two layers there; the act writes no file */
  const r = w.r.actionLawsPropose({ target: B, laws: [{ level: "city", citation: AVILLE }], proposer: MACHINE, viewer: MACHINE });
  assert.equal(r.reason, "NO_SUCH_ACTION", "B is not yet an action");
  w.action(B);
  const s = w.r.actionLawsPropose({ target: B, laws: [{ level: "city", citation: AVILLE }], proposer: MACHINE, viewer: MACHINE });
  assert.deepEqual(s.proposal.laws, [{ level: "city", citation: AVILLE }]);
  assert.equal(w.fm(A).governing_laws, undefined, "the action's own list is never written");
});

test("R21 the shipped layers: a citation one active layer gives is not ambiguous, and no layer is inferred", () => {
  const w = world({ profiles: ["oakland-alameda"] });
  w.action(A);
  const p = w.r.actionLawsPropose({ target: A, laws: [{ level: "city", citation: "Oakland Mun. Code ch. 2.20" }], proposer: MACHINE, viewer: MACHINE });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.proposal.laws, [{ level: "city", citation: "Oakland Mun. Code ch. 2.20" }]);
});

test("R21 a layer that is no layer id is BAD_LAW_LEVEL naming the index, with its row, and nothing is written", () => {
  const w = world({ deps: { layers: CIVIC } });
  w.action(A);
  for (const bad of ["x".repeat(LAW_LAYER_MAX + 1), "a\nb", 'a"b', 7]) {
    const r = w.r.actionLawsPropose({ target: A, laws: [{ level: "state", citation: "Act" }, { level: "county", citation: AVILLE, layer: bad }],
      proposer: MACHINE, viewer: MACHINE });
    assert.deepEqual([r.ok, r.reason, r.index, r.check], [false, "BAD_LAW_LEVEL", 1, GOVERNING_LAW_CHECKS.BAD_LAW_LEVEL.check], JSON.stringify(bad));
  }
  assert.equal(w.rows(`SELECT * FROM action_law_proposals`).length, 0);
});

test("R21 control: a proposal written before the change is answered as it was, layer absent", () => {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  st.db.exec(`CREATE TABLE action_law_proposals (bundle_id TEXT NOT NULL, proposed_by TEXT NOT NULL, ord INTEGER NOT NULL,
    level TEXT NOT NULL, citation TEXT NOT NULL, standard TEXT, proposed_at TEXT NOT NULL, PRIMARY KEY (bundle_id, proposed_by, ord))`);
  st.db.exec(`INSERT INTO action_law_proposals VALUES ('${A}', 'class:daemon', 0, 'county', '${AVILLE}', NULL, '2026-01-01T00:00:00Z')`);
  const record = recordOf(host, { evidence: null });
  record.migrate();
  const r = records.actionRecordsOf(host, { record, layers: TWO_GIVE });
  const cols = st.sql.exec(`PRAGMA table_info(action_law_proposals)`).toArray().map((c) => c.name);
  assert.ok(cols.includes("layer"), "the column is added to a running store");
  assert.deepEqual(r.lawProposalsFor(A).proposals.map((p) => p.laws), [[{ level: "county", citation: AVILLE }]],
    "even a citation two layers now give: the row is answered as it was");
});

test.todo("R21's adoption half: a member's actionLaws adopting a proposed entry writes its layer into governing_laws (actions R113; actions is later than this module)");
