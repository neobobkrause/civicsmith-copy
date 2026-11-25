/* The texts the cost and verdict tests of the detectors read (R1, R3): a budget volume's text of any size, the text of a
 * real budget document, and a real roster behind a preface. Built here, deterministic, so a test and the child it
 * starts read the same bytes. */
import fs from "node:fs";
import { flattenText } from "../../docprofile/registry.mjs";
import { ROSTER_DOCS } from "./fixtures.mjs";

const BUDGET = JSON.parse(fs.readFileSync(new URL("./fixtures/budget-pages.json", import.meta.url), "utf8"));

/** The text of a budget volume, exactly `bytes` long: tables of figures, headings that read like unit names, lines of
 *  Title Case and running prose, as a 1,300-page budget has them (no roster in it). */
export function budgetVolumeText(bytes) {
  const block = [];
  for (let n = 0; n < 40; n++) {
    block.push(n === 0 ? "Section 4.2 Appropriations by Fund and Department for the Fiscal Year"
      : n === 1 ? "Police Department   Public Works   General Purpose Fund   1,204"
      : n === 2 ? "Alameda County Superior Court   Oakland Unified School District"
      : `${n}  Personnel services, contract services and supplies for the fiscal year are budgeted at ${n * 7919 % 99991},${100 + n} dollars; see schedule ${n} of this volume for the detail of each line item.`);
  }
  const one = block.join("\n") + "\n";
  return one.repeat(Math.ceil(bytes / one.length)).slice(0, bytes);
}

/** The text of the real budget document held here (the Adopted Policy Budget's nine pages), flattened as `readText` does. */
export function budgetDocumentText() {
  return flattenText(BUDGET.pages.map((p) => p.text).join("\n")).text;
}

/** A real roster's text behind `lines` lines of preface (a cover, a letter, a table of contents): the title page of a
 *  volume that holds a roster far into it. */
export function prefacedRoster(key, lines) {
  const preface = [];
  for (let n = 0; n < lines; n++) {
    preface.push(n % 7 === 0 ? `Chapter ${n / 7 + 1}: Policy and Budget Overview for the Fiscal Year`
      : `${n}. Revenue estimates, service levels and the fund balances are described in the schedules that follow this page ${n}.`);
  }
  return preface.join("\n") + "\n" + flattenText(ROSTER_DOCS.documents[key].text).text;
}
