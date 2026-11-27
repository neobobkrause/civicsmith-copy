/* roster-reader — the detectors on the text of a large document (R1, R3): they hold no line of it. Fix round 5, E2:
 * the plane reads a 1,300-page budget volume (20 MB of text, 160,000 lines) in a 128 MB object, and each detector
 * built every line of it; the reading ran out of memory. Tested at the detectors' interface in a child under a
 * heap too small for that, the text itself held. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { staffRoster, orgChart } from "../index.mjs";
import { ROSTER_DOCS, FIRST, ctxOf } from "./fixtures.mjs";

const CHILD = fileURLToPath(new URL("./big-text-child.mjs", import.meta.url));
const D = ROSTER_DOCS.documents;
/** @param {string} k */
const doc = (k) => { const d = D[k]; assert.ok(d, k); return d; };
/** What the child prints: the text's size and lines, and each detector's answer. @typedef {{ chars: number, lines: number, answers: boolean[] }} ChildOut */

test("R1 R3 staff_roster and org_chart detect the text of a 20 MB, 160,000-line document with no roster in it under an 80 MB heap, five runs of five", () => {
  for (let run = 1; run <= 5; run++) {
    const r = spawnSync(process.execPath, ["--max-old-space-size=80", CHILD], { encoding: "utf8", timeout: 240000 });
    assert.equal(r.status, 0, `run ${run}: ${String(r.stderr).split("\n").slice(0, 6).join(" | ")}`);
    const out = /** @type {ChildOut} */ (JSON.parse(r.stdout));
    assert.ok(out.chars > 19e6 && out.lines === 160000, `run ${run}: the text is the size of a budget volume`);
    assert.deepEqual(out.answers, [false, false], `run ${run}: a budget volume is neither type`);
  }
});

test("R1 R3 the detectors still recognise a real roster and a real chart, with the rows and boxes they read", () => {
  const roster = staffRoster.detect(ctxOf(doc("roster_committee"), FIRST));
  assert.equal(roster.match, true);
  assert.ok(staffRoster.parse(ctxOf(doc("roster_committee"), FIRST)).rows.length > 30);
  const chart = orgChart.detect(ctxOf(doc("chart_opw"), FIRST));
  assert.equal(chart.match, true);
  assert.ok(orgChart.parse(ctxOf(doc("chart_opw"), FIRST)).units.length > 3);
});
