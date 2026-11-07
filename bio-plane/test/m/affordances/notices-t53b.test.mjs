/* affordances: the provider notices of T53 answered in its reopen (job affordances, attempt 8). Each provider changed its source with no
   requirement text; none changed an export this module reads (`ActionRecords.lawEntries`, removed, and `actions`' `actionOverdue` and
   `actionZone`, changed, are read nowhere here; the exports added are not this module's to read). Confirmed, no code change, at this
   module's interface over each provider's real code: with the owners' declarations registered as the plane registers them (op-grades R49),
   every door op each provider declares (`DECLARED_OPS`, as `register-owners.mjs` reads them) is published here or graded by op-grades
   (R12's totality, R1); `filing-templates` and `publication`, which declare none, keep their maps' totality in `catalogue.test.mjs`. filings:727: `backing.test.mjs` and `t46.test.mjs` drive filings over its published fixture
   (`../filings/fixture.mjs`) and pass on it as changed.
     wizard-scripts:546 (SCREEN_ACTS_ADDED), investigation:628, publication:632, case-import:635, case-carriage:658, case-authoring:681,
     action-records:696, filing-templates:712, actions:715, action-plans:726, filings:727, monitoring:743, following:744. */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../../../src/affordances.mjs";
import { RUNGS, RUNG_ABSENT, NON_ACTS, OP_ALIASES } from "../../../src/op-grades/index.mjs";
import { ACT_HELP } from "../../../src/affordances/act-help.mjs";
import { ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { SCREEN_ACTS_ADDED } from "../../../src/wizard-scripts/data.mjs";

const published = new Set([...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].map((a) => a.id));
const opOf = (op) => (Object.hasOwn(OP_ALIASES, op) ? OP_ALIASES[op] : op);
const accounted = (op) => published.has(opOf(op)) || [RUNGS, RUNG_ABSENT, NON_ACTS].some((t) => Object.hasOwn(t, opOf(op)));

const DECLARING = ["wizard-scripts", "investigation", "case-import", "case-carriage", "case-authoring", "action-records", "actions",
  "action-plans", "filings", "monitoring", "following"];

for (const owner of DECLARING) {
  test(`notice ${owner} (R12 R1): every door op ${owner} declares is published here or graded by op-grades; control: an op no owner `
     + `declares is not`, () => {
    const ops = Object.keys(REGISTERED[owner] ?? {});
    assert.ok(ops.length > 0, `${owner} declares ops`);
    assert.deepEqual(ops.filter((op) => !accounted(op)), [], owner);
    assert.equal(accounted("nosuchprovidedop"), false);
  });
}

test("notice wizard-scripts:546 (R37 R48): each op SCREEN_ACTS_ADDED puts on a screen is explained by ACT_HELP or named in "
   + "op-declarations' ACT_HELP_ABSENT, so a surface reading act_help for the screen's acts places every one", () => {
  const ops = [...new Set(Object.values(SCREEN_ACTS_ADDED).flat())];
  assert.ok(ops.length > 0);
  const absent = new Set(Object.values(ACT_HELP_ABSENT).flatMap((g) => [...(g.ops ?? [])]));
  assert.deepEqual(ops.filter((op) => !Object.hasOwn(ACT_HELP, op) && !absent.has(op)), []);
});
