/* doctypes — R39 (fix round 6, G23; K4571): the staff report's recommendation is read whole, to the next heading, at
 * the module's interface (`staff_report.parse`). A bound that stays is stated on the answer, never silent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCTYPES, staffReport } from "../index.mjs";
import { PORT_ALDER, view, PA_REPORT } from "./fixtures.mjs";

/** @import { StaffReportReading } from "../staff-report.mjs" */

const PA = view(PORT_ALDER);
/* The type R1 registers under `staff_report`, which is the module's `staffReport` itself, read through its own kind. */
const STAFF_REPORT = DOCTYPES.find((t) => t.key === "staff_report");
/** @param {string} text @returns {StaffReportReading} */
const parse = (text) => {
  if (STAFF_REPORT === undefined) throw new TypeError("Cannot read properties of undefined (reading 'parse')");
  if (STAFF_REPORT !== staffReport) throw new TypeError("DOCTYPES' staff_report is not the module's staffReport");
  return staffReport.parse({ text, view: PA });
};
/** @param {number} n @returns {string} */
const sentence = (n) => `Item ${n} of the recommended motion directs the Town Manager to act.`;
/** @param {number} len @returns {string} */
const paragraph = (len) => {
  /** @type {string[]} */
  const out = [];
  for (let n = 0; out.join(" ").length < len; n++) out.push(sentence(n));
  return out.join(" ").slice(0, len);
};
/** @param {string} body @returns {string} */
const withRecommendation = (body) => PA_REPORT.replace(/Adopt Bylaw No\. 2041[^\n]*/, body);

test("R39 a 1,500-character recommendation is read whole to the next heading", () => {
  const body = paragraph(1500).trim();
  const r = parse(withRecommendation(body));
  assert.equal(r.recommendation, body);
  assert.equal(r.recommendation_cut, undefined);
  assert.equal(r.recommendation_length, undefined);
});

test("R39 a recommendation spread over many lines is read whole and stops at the next heading", () => {
  const lines = Array.from({ length: 40 }, (_, n) => sentence(n));
  const recommendation = parse(withRecommendation(lines.join("\n"))).recommendation;
  assert.equal(recommendation, lines.join(" "));
  assert.ok(!/fees were last set/.test(String(recommendation)));
});

test("R39 a recommendation with no heading after it is cut at the stated bound and says so, with its full length", () => {
  const body = paragraph(150000).trim();
  const r = parse(["TO: Select Board FROM: Town Manager SUBJECT: Mooring Fees DATE: March 1, 2026", "RECOMMENDATION", body].join("\n"));
  assert.equal(r.recommendation_cut, true);
  assert.equal(r.recommendation_length, body.length);
  const recommendation = r.recommendation;
  assert.ok(recommendation !== null && recommendation.length < 150000 && recommendation.length >= 50000);
});

test("R39 a short recommendation is unchanged, and none found is still null", () => {
  const short = parse(PA_REPORT).recommendation;
  assert.ok(short !== null);
  assert.match(short, /^Adopt Bylaw No\. 2041/);
  assert.equal(parse("nothing here").recommendation, null);
});
