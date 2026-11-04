/* affordances: provider notice strength:176 (PR 176: strength R46, R47 met: a leg on a typed passage counts at the
   passage's grade; the grading method gains version `bio-grading/5`). Confirmed, no code change: this module reads no
   strength grade and no method version (its code imports nothing of strength's; grading of ops is op-grades', K1974),
   and PR 176 adds and renames no op, so strength's declared ops stay accounted for (R12), none becomes an act (R1), and
   each keeps the help R48 holds for it or none (R49). Read from strength's own tables, never a hand list (K3268). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as A from "../../../src/affordances.mjs";
import { ACT_HELP } from "../../../src/affordances/act-help.mjs";
import { DECLARED_OPS, strengthOps, GRADING_METHOD_VERSION } from "../../../src/strength/index.mjs";

const SRC = new URL("../../../src/", import.meta.url);
const published = (op) => [...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].some((a) => a.id === op);

test("notice strength:176: this module's code imports no strength and reads no method version, so R46's grade and R47's new version change nothing here", () => {
  const files = ["affordances.mjs", ...readdirSync(new URL("affordances/", SRC)).filter((f) => f.endsWith(".mjs")).map((f) => `affordances/${f}`)];
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    assert.ok(!/from\s+["'][^"']*\/strength\//.test(text), `${f} imports no strength`);
    assert.ok(!/GRADING_METHOD_VERSION|gradingMethodText|bio-grading\//.test(text), `${f} names no method version`);
  }
  assert.equal(GRADING_METHOD_VERSION, "bio-grading/5", "control: the version PR 176 published is the provider's");
});

test("notice strength:176 (R12 R1 R49): strength's declared ops are all served, accounted for and no act, and act help for them is as before", () => {
  const served = Object.keys(strengthOps({}, new URL("http://x/"), {}));
  const rows = Object.entries(DECLARED_OPS).map(([op, d]) => ({ op, mutating: d.mutating !== false, gated: true }));
  assert.deepEqual(rows.map((r) => r.op).sort(), ["inquirystrength", "projectbarset", "strengthbarset"], "PR 176 added no op");
  for (const { op } of rows) assert.ok(served.includes(op), `strength answers ${op}`);
  const r = A.unaccounted(rows);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  for (const { op } of rows) assert.equal(published(op), false, `${op} is no act`);
  assert.equal(typeof ACT_HELP.strengthbarset, "string");
  assert.equal(typeof ACT_HELP.projectbarset, "string");
  /* control: an op no table holds is seen */
  assert.deepEqual(A.unaccounted([...rows, { op: "notice176control", mutating: true, gated: true }]).unranked, ["notice176control"]);
});
