/* op-grades: BD-1's grade rows (corpus-export R17, R18; op-declarations F3, op-capabilities F1; START attempt 4). The whole-record
   export's two ops are graded as `export` and `exportpage` are: the manifest, an administrator's act that logs who took it, on
   `export`'s ground; one part of its files a read. The op names are read from corpus-export's own map, by path, as the other
   modules' rows are (declared.mjs), never typed here (K3268); the tables are the data under test. */
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as G from "../../../src/op-grades/index.mjs";
import { registeredOpGrades } from "./declared.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const CE = await import(pathToFileURL(join(ROOT, "bio-plane", "src", "corpus-export", "index.mjs")).href);
/* the arms are built and never called: only their names are read */
const OPS = Object.keys(CE.wholeExportOps(null, () => null));
const [WHOLE, PART] = OPS;
const R = await registeredOpGrades();

const tablesOf = (m, op) => ["RUNGS", "RUNG_ABSENT"].filter((t) => Object.hasOwn(m[t], op))
  .concat(!Object.hasOwn(m.RUNGS, op) && !Object.hasOwn(m.RUNG_ABSENT, op) && Object.hasOwn(m.NON_ACTS, op) ? ["NON_ACTS"] : []);

test("BD-1: corpus-export's whole-record map names two ops, the manifest and its part", () => {
  assert.equal(OPS.length, 2);
  assert.match(WHOLE, /^export/);
  assert.match(PART, /^export.*part$/);
});

test("BD-1: the whole-record manifest is graded as `export` is, ground `substrate`, in exactly one grading table, with a "
   + "NON_ACTS reason; a phone act; no machine row; control: `export`'s own rows are unchanged", () => {
  for (const m of [G, R]) {
    assert.deepEqual(tablesOf(m, WHOLE), ["RUNG_ABSENT"]);
    assert.equal(m.RUNG_ABSENT[WHOLE].ground, m.RUNG_ABSENT.export.ground);
    assert.equal(m.RUNG_ABSENT[WHOLE].ground, "substrate");
    assert.match(m.RUNG_ABSENT[WHOLE].is, /\S/);
    assert.equal(m.NON_ACTS[WHOLE], m.RUNG_ABSENT[WHOLE].is);
    assert.equal(Object.hasOwn(m.MACHINE_REFUSALS, WHOLE), false);
    assert.equal(m.phoneOf(WHOLE), true);
    assert.equal(m.IRREVERSIBLE_WEIGHT.includes(WHOLE), false);
  }
  assert.equal(G.RUNG_ABSENT.export.ground, "substrate");
});

test("BD-1: one part of a whole-record export is a read: held in NON_ACTS alone with a `read: ` reason, as `exportpage` is; "
   + "no rung, no ground, no machine row; control: the manifest is not a read", () => {
  for (const m of [G, R]) {
    assert.deepEqual(tablesOf(m, PART), ["NON_ACTS"]);
    assert.match(m.NON_ACTS[PART], /^read: .*writes nothing$/);
    assert.match(m.NON_ACTS.exportpage, /^read: /);
    assert.equal(Object.hasOwn(m.MACHINE_REFUSALS, PART), false);
    assert.equal(m.phoneOf(PART), true);
    assert.doesNotMatch(m.NON_ACTS[WHOLE], /^read: /);
  }
});
