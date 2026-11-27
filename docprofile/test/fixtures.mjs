/* Fixtures for docprofile's requirement-named tests.
 *
 * TWO MADE-UP JURISDICTIONS, neither of them Oakland (R30): Port Alder and Lakemont.
 * Each is a TEST profile in `jurisdictions`' shape (its R1–R7), every fact carrying
 * `basis: "TEST"`. They differ in every fact a reader takes from the view, so a test can
 * show this module's shared helpers following the view they are given and nothing else
 * (R30, R36).
 *
 * `view(...)` is `jurisdictions.combine` of the profiles given (its R12–R16): the
 * view a caller passes as `ctx.view`. Patterns are written the way the held profiles
 * write them, anchors and groups included.
 */
import { combine, validate, list } from "../../jurisdictions/index.mjs";

/** @import { Profile, Pattern, View } from "../../jurisdictions/index.mjs" */
/** @import { SuppliedPage } from "../registry.mjs" */

const p = /** @param {string} re @param {string} [flags] @returns {Pattern} */ (re, flags) => {
  if (flags) return { re, flags };
  return { re };
};
const fact = /** @param {Pattern} pattern @returns {{ pattern: Pattern, basis: string }} */ (pattern) => ({ pattern, basis: "TEST" });

/** @type {Profile} */
export const PORT_ALDER = {
  id: "port-alder-test", name: "Port Alder (test)", covers: ["Town of Port Alder"], test: true,
  spaces: {
    enactment: {
      label: "Port Alder bylaws and orders",
      forms: [{ form: "serial", pattern: p("^0*(\\d{3,4})$"), normal: [{ group: 1 }], basis: "TEST" }],
      kinds: [
        { kind: "bylaw", prefix: p("bylaw\\s+(?:no\\.?\\s*)?", "i"), basis: "TEST" },
        { kind: "order", prefix: p("order\\s+(?:no\\.?\\s*)?", "i"), basis: "TEST" },
      ],
    },
  },
  systems: [{ origin: "pa-records", name: "Port Alder records", hosts: ["records.portalder.test"], basis: "TEST" }],
  vocabulary: {
    furniture: [fact(p("^Town of Port Alder$")), fact(p("^Office of the Town Recorder$")), fact(p("^View Record$"))],
    bodies: [fact(p("(Harbor Commission|Select Board|Committee)\\s*$", "i"))],
    member_titles: [fact(p("^Selectperson"))],
    enactment_markers: [fact(p("T\\.B\\.S\\."))],
    codes: [{ key: "pac", label: "P.A.C.", pattern: p("P\\.A\\.C\\.|Port Alder Code"), basis: "TEST" }],
    file_numbers: [{ pattern: p("PA-\\d{3}"), system: "pa-records", basis: "TEST" }],
    report_titles: [fact(p("^MEMO TO THE (?:BOARD|COMMISSION)\\b"))],
    report_sections: [fact(p("^RECOMMENDATION\\b")), fact(p("^SUMMARY\\b")), fact(p("^COST\\b")),
                      fact(p("^HISTORY\\b")), fact(p("^NEXT STEPS\\b"))],
    recommendation_openers: [fact(p("The Manager advises that", "i"))],
    template_blanks: [fact(p("SPONSOR: \\[NAME\\]"))],
  },
  practice: { minutes_due_days: { value: 10, basis: "TEST" } },
};

/** @type {Profile} */
export const LAKEMONT = {
  id: "lakemont-test", name: "Lakemont (test)", covers: ["City of Lakemont"], test: true,
  spaces: {
    enactment: {
      label: "Lakemont ordinances",
      forms: [{ form: "serial", pattern: p("^(L\\d{3})$", "i"), normal: [{ group: 1, upper: true }], basis: "TEST" }],
      kinds: [{ kind: "ordinance", prefix: p("ordinance\\s+(?:no\\.?\\s*)?", "i"), basis: "TEST" }],
    },
  },
  systems: [{ origin: "lk-records", name: "Lakemont records", hosts: ["records.lakemont.test"], basis: "TEST" }],
  vocabulary: {
    furniture: [fact(p("^City of Lakemont$"))],
    bodies: [fact(p("Lakemont Council\\s*$", "i"))],
    member_titles: [fact(p("^Alderman"))],
    codes: [{ key: "lmc", label: "L.M.C.", pattern: p("L\\.M\\.C\\."), basis: "TEST" }],
    file_numbers: [{ pattern: p("LK\\d{5}"), system: "lk-records", basis: "TEST" }],
    report_titles: [fact(p("^COUNCIL BRIEFING\\b"))],
    report_sections: [fact(p("^RECOMMENDATION\\b")), fact(p("^CONTEXT\\b")), fact(p("^BUDGET\\b")), fact(p("^RISKS\\b"))],
    recommendation_openers: [fact(p("Officers propose that", "i"))],
  },
  practice: { minutes_due_days: { value: 30, basis: "TEST" } },
};

/** `jurisdictions.combine` of these profiles, as a caller would pass it. Every
 *  fixture profile must validate, or the tests are not testing what they claim.
 *  @param {...Profile} profiles
 *  @returns {View} */
export function view(...profiles) {
  for (const pr of profiles) {
    const v = validate(pr);
    if (!v.ok) throw new Error(`fixture profile ${pr.id} is invalid: ${JSON.stringify(v.errors)}`);
  }
  const r = combine(profiles);
  if (!r.ok) throw new Error(`fixture views do not combine: ${JSON.stringify(r.errors)}`);
  return r.view;
}

/** A view with no profile in it: nothing local is known. */
export const EMPTY = view();

/** The view of every NON-TEST profile `jurisdictions` holds, PASSED EXPLICITLY: the real
 *  documents the converted suites read were published where the held profile describes, and
 *  this is the view an instance using that profile hands its readers. Where a document came
 *  from is provenance, not a place in the product (layers.md, "No jurisdiction in the
 *  product", rule 6); the test names no place, it asks `jurisdictions` for what it holds. */
export const HELD = (() => {
  const r = combine(list().filter((x) => !x.test).map((x) => x.id));
  if (!r.ok) throw new Error(`the held profiles do not combine: ${JSON.stringify(r.errors)}`);
  return r.view;
})();

/* ---- a document written in Port Alder's vocabulary, for the stub readers (./stubs.mjs) ---- */

/** Three pages of filed items, each opening with Port Alder's masthead (furniture, once per
 *  page) and its furniture line; PA-101 is read on the first page and again on the third. */
/** @type {SuppliedPage[]} */
export const PA_ITEMS_PAGES = [
  { page: 0, text: "MEMO TO THE BOARD\nTown of Port Alder\nDock fees, file PA-101\nMooring permits, file PA-102" },
  { page: 1, text: "MEMO TO THE BOARD\nTown of Port Alder\nHarbor lights, file PA-103" },
  { page: 2, text: "MEMO TO THE BOARD\nTown of Port Alder\nContinued: PA-101" },
];
export const PA_ITEMS = PA_ITEMS_PAGES.map((p) => p.text).join("\n");

/* ---- HTML captures, for the layered pipeline ---- */

const vs = /** @param {string} v */ (v) => `<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${v}" />`;

/** A meeting calendar served by ASP.NET WebForms (CERTAIN), in the record vendor's
 *  page shape; `rows` are [id, body, "M/D/YYYY", status?, agendaId?, minutesId?].
 *  @param {ReadonlyArray<ReadonlyArray<string | number | null>>} rows
 *  @param {{ state?: string, range?: string }} [opts]
 *  @returns {string} */
export function calendarHtml(rows, { state = "abc", range = "This Month" } = {}) {
  const tr = rows.map(([id, body, date, status, ag, mi]) =>
    `<tr><td><a href="MeetingDetail.aspx?ID=${id}&amp;GUID=x">${body}${status ? " - " + status : ""}</a></td>`
    + `<td>${date}</td>`
    + `<td>${ag ? `<a href="View.ashx?M=A&amp;ID=${ag}">Agenda</a>` : "Not available"}</td>`
    + `<td>${mi ? `<a href="View.ashx?M=M&amp;ID=${mi}">Minutes</a>` : "Not available"}</td></tr>`).join("\n");
  return `<html><head><title>Calendar</title></head><body><form id="aspnetForm">${vs(state)}
<div id="ctl00_divTop">site header</div>
<main id="mainContent" role="main">
<input id="ctl00_lstYears_Input" value="${range}" />
<table>${tr}</table>
</main></form></body></html>`;
}

/** A client-rendered shell: an empty mount point, a framework marker, no prose.
 *  @param {string} [stamp]
 *  @returns {string} */
export function shellHtml(stamp = "1") {
  return `<html><head><script src="/app.${stamp}.js"></script></head><body>`
    + `<div id="root"></div><script>window.__INITIAL_STATE__={}</script>`
    + "<!--" + "x".repeat(2400) + "-->" + `</body></html>`;
}
