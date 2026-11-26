/* id-spaces' test profiles, in the profile shape of `build/requirements/jurisdictions.md` (R1–R5 there).
 * Every profile here is a TEST profile: its places and facts are made up (basis `TEST`). The first,
 * test-harbor, has the shapes the first real profile measured (numbered enactments with kind floors,
 * concurrent project forms, a padded parcel key, a republished assessor layer); the others are different
 * jurisdictions, so every service is shown answering from the view alone (R24).
 * Views are made by `jurisdictions.combine` itself (its R12–R16), which validates each profile first. */
import { combine } from "../../../../jurisdictions/index.mjs";
/** @import { Pattern, FormRule, ViewSpace, ViewSpaces, ViewStandardSource, StandardSourceFacts } from "../../../../jurisdictions/index.mjs" */
/** @import { IdView } from "../../../src/idspaces.mjs" */

const T = "TEST";
/** @param {string} re @param {string} [flags] @returns {Pattern} */
const P = (re, flags) => { if (flags) return { re, flags }; return { re }; };
/** @param {string} w @returns {Pattern} */
const kindPrefix = (w) => P(`${w}\\s+(?:no\\.?\\s*|number\\s+)?`, "i");

export const HARBOR = {
  id: "test-harbor", name: "Harbor City (test)", covers: ["Harbor City", "Harbor County"], test: true,
  spaces: {
    enactment: {
      label: "ordinance or resolution number (H.C.)",
      forms: [{ form: "hc", pattern: P("(\\d{4,5})(?:\\s*H\\.?\\s?C\\.?)?", "i"), normal: [{ group: 1 }],
                clean: { strip: [P("H\\.?\\s?C\\.?", "i")], spaces: "collapse" }, basis: T }],
      kinds: [
        { kind: "ordinance", prefix: kindPrefix("ordinance"), floor: { first: 12274, system: "harbor.legis", basis: T }, basis: T },
        { kind: "resolution", prefix: kindPrefix("resolution"), floor: { first: 75950, system: "harbor.legis", basis: T }, basis: T },
      ],
    },
    project: {
      label: "project or capital improvement number",
      forms: [
        { form: "C#####", pattern: P("(C\\d{5,6})"), normal: [{ group: 1 }], clean: { strip: [P("#")], spaces: "remove", upper: true }, basis: T },
        { form: "P#####", pattern: P("(P\\d{5,6})"), normal: [{ group: 1 }], clean: { strip: [P("#")], spaces: "remove", upper: true }, basis: T },
        { form: "100xxxx", pattern: P("(100\\d{4})"), normal: [{ group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
        { form: "100xxxx+suffix", pattern: P("(100\\d{4}[A-Z])"), normal: [{ group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
      ],
    },
    fund: { label: "fund code", forms: [{ form: "####", pattern: P("(\\d{4})"), normal: [{ group: 1 }], basis: T }] },
    parcel: {
      label: "assessor's parcel number",
      forms: [{ form: "harbor-apn", pattern: P("(\\d{1,3}[A-Z]?|[A-Z])-(\\d{1,4})-(\\d{1,3}[A-Z]?)(?:-(\\d{1,2}))?"),
                normal: [{ group: 1, unpad: true }, "-", { group: 2, unpad: true }, "-", { group: 3, unpad: true }, "-",
                         { group: 4, unpad: true, default: "0" }],
                clean: { strip: [P("APN", "i")], spaces: "remove", upper: true }, basis: T }],
    },
  },
  systems: [
    { origin: "harbor.legis", name: "the Harbor legislative record (vendor API)", hosts: ["api.legisvendor.test"],
      path: P("^/v1/harbor(/|$)", "i"), basis: T },
    { origin: "harbor.legis", name: "the Harbor legislative record", hosts: ["harbor.legisvendor.test"], basis: T },
    { origin: "harbor.budget", name: "the Harbor budget system", hosts: ["data.harbor.test"], path: P("budget-lines", "i"), basis: T },
    { origin: "county.assessor", name: "the county assessor's parcel layer, republished by the city portal", hosts: ["data.harbor.test"],
      path: P("parcel-layer", "i"), republishes: true, provenance_stated: false, basis: T },
    { origin: "county.assessor", name: "the county assessor's own publications", hosts: ["gis.county.test"], path: P("/Parcel", "i"), basis: T },
    { origin: "harbor.auditor", name: "the city auditor", hosts: ["auditor.harbor.test"], basis: T },
  ],
  mixed_hosts: [{ host: "www.harbor.test", why: "the city's general website, serving many offices' publications", basis: T }],
};

export const LAKESHORE = {
  id: "test-lakeshore", name: "Lakeshore Township (test)", covers: ["Lakeshore Township"], test: true,
  spaces: {
    enactment: {
      label: "bylaw number",
      forms: [{ form: "LS-####", pattern: P("LS-?(\\d{1,4})", "i"), normal: ["LS-", { group: 1, unpad: true }],
                clean: { spaces: "remove", upper: true }, basis: T }],
      kinds: [{ kind: "bylaw", prefix: kindPrefix("bylaw"), floor: { first: 100, system: "lake.clerk", basis: T }, basis: T }],
    },
    project: {
      label: "works number",
      forms: [
        { form: "W-#####", pattern: P("W-(\\d{5})"), normal: ["W-", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
        { form: "##-###", pattern: P("(\\d{2})-(\\d{3})"), normal: [{ group: 1 }, "-", { group: 2 }], basis: T },
      ],
    },
    parcel: {
      label: "roll number",
      forms: [{ form: "lake-roll", pattern: P("(\\d{3}) (\\d{3}) (\\d{3})"), normal: [{ group: 1 }, { group: 2 }, { group: 3 }],
                clean: { spaces: "collapse" }, basis: T }],
    },
  },
  systems: [
    { origin: "lake.clerk", name: "the township clerk's register", hosts: ["clerk.lakeshore.test"], basis: T },
    { origin: "lake.finance", name: "the township finance office", hosts: ["finance.lakeshore.test"], basis: T },
  ],
  crosswalks: [{ space: "project", forms: ["W-#####", "##-###"], pairs: [["W-10001", "07-001"], ["W-10002", "07-002"]],
                 source: "a".repeat(64), basis: T }],
};

/* A profile that disagrees with HARBOR on the ordinance floor, and one that names a kind with no floor. */
export const DISSENT = {
  id: "test-dissent", name: "Dissent (test)", covers: ["Harbor County"], test: true,
  spaces: { enactment: { label: "ordinance or resolution number (H.C.)", forms: [], kinds: [
    { kind: "ordinance", prefix: kindPrefix("ordinance"), floor: { first: 12000, system: "harbor.legis", basis: T }, basis: T }] } },
  systems: [HARBOR.systems[1]],
};
export const UNMEASURED = {
  id: "test-unmeasured", name: "Unmeasured (test)", covers: ["Harbor Port District"], test: true,
  spaces: { enactment: { label: "proclamation number", forms: [], kinds: [{ kind: "proclamation", prefix: kindPrefix("proclamation"), basis: T }] } },
};

/* The view as a service takes it: the combined view with its conflicts. */
export { combine };
/** @param {...unknown} profiles @returns {IdView} */
export function viewOf(...profiles) {
  const c = combine(profiles);
  if (!c.ok) throw new Error(`a test profile fails jurisdictions.combine: ${JSON.stringify(c.errors)}`);
  return { ...c.view, conflicts: c.conflicts };
}

/* A space in the view's own shape: each form tagged as `combine` tags it, with its giver and basis. */
/** @param {string} label @param {(FormRule & { basis: string })[]} forms @param {string} [profile] @returns {ViewSpace} */
export const space = (label, forms, profile = "test-harbor") =>
  ({ label, forms: forms.map((f) => ({ ...f, profile, bases: [{ profile, basis: f.basis }] })) });

/* The eight spaces T33 and T34 added (R1): the money record's identifiers, a proceeding's number, the person
 * schemes (one form per scheme), a body's and an office record's numbers, and the
 * institution schemes, one form per scheme (T34). They are grafted onto a
 * combined view, in the view's own shape, because `combine` learns `body`, `office` and `institution` only with the
 * jurisdictions job that merges in this tranche (its R3, T34-2); `withNewSpaces` is equivalent to combining a
 * profile that holds them. */
/** @type {ViewSpaces} */
export const NEW_SPACES = {
  account: space("general ledger account", [{ form: "acct-5", pattern: P("(\\d{5})"), normal: [{ group: 1 }], clean: { strip: [P("acct\\.?", "i")], spaces: "remove" }, basis: T }]),
  object: space("object code", [{ form: "obj-4", pattern: P("([A-Z]?\\d{4})"), normal: [{ group: 1 }], clean: { spaces: "remove", upper: true }, basis: T }]),
  vendor: space("supplier number", [{ form: "V-######", pattern: P("V-?(\\d{1,6})"), normal: ["V-", { group: 1, unpad: true }], clean: { spaces: "remove", upper: true }, basis: T }]),
  proceeding: space("case number", [
    { form: "court-case", pattern: P("([A-Z]{2})(\\d{2})-?(\\d{6})"), normal: [{ group: 1 }, { group: 2 }, "-", { group: 3 }], clean: { spaces: "remove", upper: true }, basis: T },
    { form: "commission-docket", pattern: P("([A-Z])\\.?(\\d{2})-(\\d{2})-(\\d{3})"), normal: [{ group: 1 }, ".", { group: 2 }, "-", { group: 3 }, "-", { group: 4 }], clean: { spaces: "remove", upper: true }, basis: T },
  ]),
  person: space("person scheme identifier", [
    { form: "roster-person", pattern: P("PID(\\d{1,6})"), normal: ["PID", { group: 1, unpad: true }], clean: { spaces: "remove", upper: true }, basis: T },
    { form: "filer", pattern: P("FILER(\\d{7})"), normal: ["FILER", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
    { form: "licence", pattern: P("LIC([A-Z]\\d{6})"), normal: ["LIC", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
    { form: "bar", pattern: P("SBN(\\d{1,6})"), normal: ["SBN", { group: 1, unpad: true }], clean: { strip: [P("bar\\s*no\\.?", "i")], spaces: "remove", upper: true }, basis: T },
  ]),
  body: space("legislative body id", [{ form: "body-id", pattern: P("(\\d{1,6})"), normal: [{ group: 1, unpad: true }], clean: { strip: [P("body\\s*(?:id)?\\s*", "i")], spaces: "remove" }, basis: T }]),
  office: space("office record id", [{ form: "office-record", pattern: P("(\\d{1,7})"), normal: [{ group: 1, unpad: true }], clean: { strip: [P("office\\s*record\\s*(?:id)?\\s*", "i")], spaces: "remove" }, basis: T }]),
  institution: space("institution scheme identifier", [
    { form: "board-reg", pattern: P("BRD(\\d{1,5})"), normal: ["BRD", { group: 1, unpad: true }], clean: { spaces: "remove", upper: true }, basis: T },
    { form: "school-code", pattern: P("SCH-?([A-Z]{2}\\d{4})"), normal: ["SCH-", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: T },
  ]),
};
/** @param {IdView} view @param {ViewSpaces} [spaces] @returns {IdView} */
export function withNewSpaces(view, spaces = NEW_SPACES) {
  return { ...view, spaces: { ...(view.spaces || {}), ...spaces } };
}

/* Reporter data in court-citations' shape (its R1): a few made-up reporters for the recogniser's tests
 * (R27), passed as `reporters`. Real data is court-citations' own; the module holds no reporter in code. */
/** @typedef {{ key: string, start: null, end: null }} Edition */
/** @type {{ REPORTERS: { key: string, name: string, cite_type: string, editions: Edition[], variations: { [spelling: string]: string } }[] }} */
export const REPORTERS = {
  REPORTERS: [
    { key: "Rep.", name: "Test Reporter", cite_type: "state", editions: [{ key: "Rep.", start: null, end: null }, { key: "Rep. 2d", start: null, end: null }],
      variations: { "Rep. 2nd": "Rep. 2d", "R.": "Rep." } },
    { key: "T. Supp.", name: "Test Supplement", cite_type: "federal", editions: [{ key: "T. Supp.", start: null, end: null }, { key: "T. Supp. 3d", start: null, end: null }], variations: {} },
    { key: "Tst.", name: "Test", cite_type: "state", editions: [{ key: "Tst.", start: null, end: null }], variations: { "R.": "Tst." } },
  ],
};

/* Policy series and standard designations (R30–R33), in `jurisdictions` R63's `standard_sources` shape, made up
 * for tests: a city's administrative instructions (a government issuer at a level), a police department's
 * general and special orders, a school board's policies (a government issuer at no level, its `normal`
 * removing the zero-padding of the number), a company's code-of-conduct rules (another sector), and a
 * standards body's standards whose designation reads an edition. They are grafted onto a combined view, in the
 * view's own shape (with `profile` and `bases`), because `combine` learns `series` only with the jurisdictions job
 * that merges in this tranche (its R63–R66, T35-1); `withSeries` is equivalent to combining a profile that
 * holds them. */
/** @param {StandardSourceFacts} o @param {string} [profile] @returns {ViewStandardSource} */
const src = (o, profile = "test-harbor") => ({ ...o, profile, bases: [{ profile, basis: T }] });
/** @type {ViewStandardSource[]} */
export const SERIES = [
  src({ source: "Harbor administrative instructions", kind: "policy", issuer: "Harbor City Administrator", level: "city", key: "harbor",
        series: { key: "ai", label: "Harbor directive" },
        cite: P("\\bA\\.?I\\.?\\s+(?<number>\\d{1,2}\\.\\d{1,3})(?:\\s*§\\s*(?<portion>\\d+(?:\\.\\d+)*))?"), basis: T }),
  src({ source: "Harbor police general orders", kind: "policy", issuer: "Harbor Police Department", level: "city", key: "harbor-pd",
        series: { key: "dgo", label: "Departmental General Order" },
        cite: P("\\bDGO\\s+(?<number>[A-Z]-\\d{1,2}(?:\\.\\d+)?)", "i"), normal: [{ group: 1, upper: true }], basis: T }),
  src({ source: "Harbor police special orders", kind: "policy", issuer: "Harbor Police Department", level: "city", key: "harbor-pd",
        series: { key: "so", label: "Special Order" }, cite: P("\\bS\\.?O\\.?\\s+(?<number>\\d{4})"), basis: T }),
  src({ source: "Harbor school board policies", kind: "policy", issuer: "Harbor Unified School District Board", sector: "government", key: "harbor-usd",
        series: { key: "bp", label: "Board Policy" }, cite: P("\\bBP\\s+(?<number>\\d{4})"), normal: ["BP ", { group: 1, unpad: true }], basis: T }),
  src({ source: "Tidewater Corp code of conduct", kind: "policy", issuer: "Tidewater Corp", sector: "company", key: "tidewater",
        series: { key: "coc", label: "Code of Conduct rule" }, cite: P("\\bCOC[- ](?<number>\\d{1,3})"), basis: T }),
  src({ source: "Test Standards Association standards", kind: "standard", issuer: "Test Standards Association", sector: "association", key: "tsa",
        series: { key: "std", label: "TSA standard" },
        cite: P("\\bTSA\\s+(?<number>\\d{3,4})(?:(?:,\\s*|-)(?<edition>\\d{4})(?:\\s+edition)?)?"), basis: T }),
];
/** @param {IdView} view @param {readonly ViewStandardSource[]} [sources] @returns {IdView} */
export function withSeries(view, sources = SERIES) {
  return { ...view, standard_sources: [...(view.standard_sources || []), ...sources] };
}
