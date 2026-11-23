/* screens-send R2, R3, R4, R8, R9, R11, R24: the pure helpers the send steps share (`send-steps.mjs`), called directly. Each is a
 * function of its arguments alone; these prove their results at the edges (nothing given, order, duplicates, what the record
 * does not hold). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { steps, DRAFT, FILINGS } from "./kit.mjs";

const { draftsOf, stepOf, draftOf, recordsLawsOf, chosenLawOf, officeLine, templateOffered, citeOf, languagesOf } = steps;
const D = (filing, at, o = {}) => DRAFT({ filing, at, ...o });
const SENT = { at: "2026-11-05", medium: "email" };
const APPROVED = { by: "mai", at: "2026-11-03T10:00:00Z" };

test("R3, R11: draftsOf answers no draft for a missing or empty `filingsfor` answer", () => {
  for (const v of [undefined, null, {}, { drafts: null }, { drafts: "x" }, FILINGS()]) assert.deepEqual(draftsOf(v), { open: null, sent: null }, JSON.stringify(v));
});

test("R3, R11: draftsOf picks the newest draft not yet sent and the newest sent, by when each was prepared, whatever the list's order", () => {
  const drafts = [D("F3", "2026-11-03T10:00:00Z"), D("F1", "2026-11-01T10:00:00Z", { sending: SENT }), D("F4", "2026-11-02T10:00:00Z"),
    D("F2", "2026-11-04T10:00:00Z", { sending: SENT }), D("F0", "2026-10-30T10:00:00Z")];
  const v = FILINGS(drafts);
  const r = draftsOf(v);
  assert.equal(r.open.filing, "F3");
  assert.equal(r.sent.filing, "F2");
  assert.deepEqual(v.drafts.map((d) => d.filing), ["F3", "F1", "F4", "F2", "F0"], "the answer read is not reordered");
  const only = D("F1", "2026-11-01", { sending: SENT });
  assert.deepEqual(draftsOf(FILINGS([only])), { open: null, sent: only }, "only a sent draft: none open");
  assert.equal(draftsOf(FILINGS([D("A", undefined), D("B", "2026-11-01")])).open.filing, "B", "a draft with no day sorts first");
});

test("R3, R11: stepOf reads the step from the newest draft not sent: prepare, approve, second, send, sent", () => {
  assert.equal(stepOf(undefined), "prepare");
  assert.equal(stepOf(FILINGS()), "prepare", "nothing prepared");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01")])), "approve", "prepared, not approved");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01", { approval: APPROVED })])), "send", "approved, no second needed");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01", { approval: APPROVED, second_needed: true })])), "second", "a second approval waited on");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01", { approval: APPROVED, second_needed: true, second_approval: { by: "ana" } })])), "send", "second given");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01", { approval: APPROVED, sending: SENT })])), "sent", "only sent drafts");
});

test("R3, R11: stepOf takes the newest unsent draft over an older one, and a new draft after a sending over the sending", () => {
  const v = FILINGS([D("F2", "2026-11-04"), D("F1", "2026-11-01", { approval: APPROVED })]);
  assert.equal(stepOf(v), "approve", "the newer draft, not yet approved");
  assert.equal(stepOf(FILINGS([D("F1", "2026-11-01", { sending: SENT }), D("F2", "2026-11-04")])), "approve", "a draft prepared after a sending is the step");
});

test("R3, R11: draftOf draws a prepared answer whole, with every list empty and every absent part null where the answer lacks it", () => {
  assert.deepEqual(draftOf({ filing: "F1", text: "We ask." }), { id: "F1", text: "We ask.", blanks: [], unfilled: [], template: null, disclosure: null,
    advisory: null, offers: [], exhibits: [], venueStandard: null, tier: null });
  const full = { id: "F2", filing: "F9", text: "T", blanks: [{ blank: "period", source: "R1" }], unfilled: [{ blank: "form", why: "not held" }], template: { id: "TPL-1" },
    disclosure: { text: "d" }, advisory: "Check the date.", offers: ["o"], exhibits: [{ grade: "ok" }], venue_standard: { formats: ["pdf"] }, tier: 0 };
  assert.deepEqual(draftOf(full), { id: "F2", text: "T", blanks: full.blanks, unfilled: full.unfilled, template: full.template, disclosure: full.disclosure,
    advisory: "Check the date.", offers: ["o"], exhibits: full.exhibits, venueStandard: { formats: ["pdf"] }, tier: 0 }, "the id before the filing; a tier of 0 kept");
  const odd = draftOf({ id: "F3", text: "", blanks: "x", unfilled: {}, advisory: "", offers: null, exhibits: 3, venue_standard: "pdf", tier: null });
  assert.deepEqual([odd.blanks, odd.unfilled, odd.advisory, odd.offers, odd.exhibits, odd.venueStandard, odd.tier], [[], [], null, [], [], null, null]);
});

/** `profiles`' answer: its view's `records_laws` and `deadlines`. */
const PROFILES = (records_laws, deadlines = []) => ({ view: { records_laws, deadlines } });
const CPRA = { citation: "Gov. Code § 7922.535", level: "state", name: "California Public Records Act", response: "cpra_response" };
const FOIA = { citation: "5 U.S.C. § 552(a)(6)(A)(i)", level: "federal", name: "Freedom of Information Act", response: "foia_response" };
const LOCAL = { citation: "Mun. Code § 2.20.230", level: "city", name: "Sunshine Ordinance" };
const DEADLINES = [
  { rule: "cpra_response", applies_to: "records_request", amount: 10, count: "calendar_days", citation: "Gov. Code § 7922.535(a)" },
  { rule: "foia_response", applies_to: "appeal", amount: 99, count: "business_days", citation: "wrong" },
  { rule: "foia_response", applies_to: "records_request", amount: 20, count: "business_days", citation: "5 U.S.C. § 552(a)(6)(A)(i)" },
];

test("R4, R9: recordsLawsOf lists the profile's `records_laws` in its order, each with the window its own `response` names, never another rule's", () => {
  const laws = recordsLawsOf(PROFILES([CPRA, FOIA], DEADLINES));
  assert.deepEqual(laws, [
    { citation: CPRA.citation, level: "state", name: CPRA.name, rule: "cpra_response", amount: 10, count: "calendar_days", dcitation: "Gov. Code § 7922.535(a)" },
    { citation: FOIA.citation, level: "federal", name: FOIA.name, rule: "foia_response", amount: 20, count: "business_days", dcitation: FOIA.citation },
  ], "the first-request window, not the appeal's of the same rule");
});

test("R4, R9: recordsLawsOf gives a law with no window of its own none, drops a law with no citation, and lists nothing for a missing profile", () => {
  for (const v of [undefined, null, {}, { view: {} }, { view: { records_laws: "x" } }]) assert.deepEqual(recordsLawsOf(v), [], JSON.stringify(v));
  const laws = recordsLawsOf(PROFILES([LOCAL, { name: "No citation" }, { citation: "" }, null, { ...CPRA, response: "unknown_rule", level: 3, name: null }], DEADLINES));
  assert.deepEqual(laws, [
    { citation: LOCAL.citation, level: "city", name: LOCAL.name, rule: "", amount: 0, count: "", dcitation: "" },
    { citation: CPRA.citation, level: "", name: "", rule: "", amount: 0, count: "", dcitation: "" },
  ]);
  assert.deepEqual(recordsLawsOf(PROFILES([CPRA])).map((l) => l.rule), [""], "no deadlines held, no window");
});

test("R4, R9: chosenLawOf is the law the member stated, as the profile lists it with its window; the first stated law the profile lists", () => {
  const profiles = PROFILES([CPRA, FOIA, LOCAL], DEADLINES);
  const action = (laws, state = "stated") => ({ governing_laws: { state, laws } });
  assert.deepEqual(chosenLawOf(action([{ citation: FOIA.citation }]), profiles),
    { citation: FOIA.citation, level: "federal", name: FOIA.name, rule: "foia_response", amount: 20, count: "business_days", dcitation: FOIA.citation });
  assert.equal(chosenLawOf(action([{ citation: "Not listed § 1" }, { citation: CPRA.citation }, { citation: FOIA.citation }]), profiles).citation, CPRA.citation,
    "a stated law the profile does not list is passed over");
  assert.deepEqual(chosenLawOf(action([{ citation: LOCAL.citation }]), profiles), { citation: LOCAL.citation, level: "city", name: LOCAL.name, rule: "", amount: 0, count: "", dcitation: "" },
    "a law with no window carries none");
});

test("R4, R9: chosenLawOf is null when no law is stated, the state is not `stated`, or no stated law is one the profile lists", () => {
  const profiles = PROFILES([CPRA], DEADLINES);
  for (const a of [undefined, null, {}, { governing_laws: null }, { governing_laws: { state: "undetermined", laws: [{ citation: CPRA.citation }] } },
    { governing_laws: { state: "stated", laws: [] } }, { governing_laws: { state: "stated", laws: [{ citation: "Old Act § 9" }, null] } }]) {
    assert.equal(chosenLawOf(a, profiles), null, JSON.stringify(a));
  }
  assert.equal(chosenLawOf({ governing_laws: { state: "stated", laws: [{ citation: CPRA.citation }] } }, undefined), null, "no profile read, no law");
});

test("R4, R24: officeLine names an office by its role and body, each once; an office named by its agency alone is drawn once", () => {
  assert.equal(officeLine({ role: "Town Clerk", body: "Town of Port Ellery" }), "Town Clerk, Town of Port Ellery");
  assert.equal(officeLine({ role: "Planning Department", body: "Planning Department" }), "Planning Department");
  assert.equal(officeLine({ role: "planning department ", body: " Planning Department" }), "planning department", "the same words in another case, drawn once");
  assert.equal(officeLine({ role: "Records Officer", organisation: "County of Lake" }), "Records Officer, County of Lake", "the organisation where no body is named");
  assert.equal(officeLine({ role: "Records Officer", body: "City Hall", organisation: "County of Lake" }), "Records Officer, City Hall", "the body first");
});

test("R4, R24: officeLine draws nothing for a missing addressee, and only the parts that hold words", () => {
  for (const ad of [undefined, null, {}, { role: "  ", body: "" }, { role: 3, body: null }]) assert.equal(officeLine(ad), "", JSON.stringify(ad));
  assert.equal(officeLine({ role: "  ", body: "Town of Port Ellery" }), "Town of Port Ellery");
  assert.equal(officeLine({ role: "Town Clerk" }), "Town Clerk");
});

test("R8: templateOffered is true only where `templatesforaction` answered a version and no court petition; a read not answered offers none", () => {
  const view = (templates) => ({ data: { templates } });
  assert.equal(templateOffered(view({ state: "ok", value: { versions: [{ template: "TPL-1" }], court_petition: false } })), true);
  assert.equal(templateOffered(view({ state: "ok", value: { versions: [{ template: "TPL-1" }] } })), true, "no court petition stated");
  for (const t of [undefined, null, { state: "failed", value: { versions: [{ template: "TPL-1" }] } }, { state: "loading" }, { state: "ok", value: null },
    { state: "ok", value: { versions: [] } }, { state: "ok", value: { versions: "TPL-1" } }, { state: "ok", value: { versions: [{ template: "TPL-1" }], court_petition: true } }]) {
    assert.equal(templateOffered(view(t)), false, JSON.stringify(t));
  }
});

test("R2: citeOf names a standard by the citation `standards` lists for it, trimmed; \"\" where the list does not hold it, never its id", () => {
  const items = [{ id: "STD-1", cite: " Gov. Code § 54957.5 " }, { id: "STD-2", cite: "Mun. Code § 2.20" }, { id: "STD-2", cite: "duplicate" }, null, { id: "STD-3", cite: 7 }];
  assert.equal(citeOf(items, "STD-1"), "Gov. Code § 54957.5");
  assert.equal(citeOf(items, "STD-2"), "Mun. Code § 2.20", "the first listing of an id");
  assert.equal(citeOf(items, "STD-3"), "", "a citation that is no text");
  assert.equal(citeOf(items, "STD-9"), "");
  for (const v of [undefined, null, {}, "STD-1"]) assert.equal(citeOf(v, "STD-1"), "", JSON.stringify(v));
});

test("R3: languagesOf states the member's own language among the team's, else the team's first; her language not the team's comes first", () => {
  const view = (mine, team) => ({ data: { mylang: mine === undefined ? undefined : { state: "ok", value: { language: mine } },
    languages: team === undefined ? undefined : { state: "ok", value: { languages: team } } } });
  assert.deepEqual(languagesOf(view("es", ["en", "es"])), { tags: ["en", "es"], first: "es", mine: "es" }, "hers, among the team's");
  assert.deepEqual(languagesOf(view("fr", ["en", "es"])), { tags: ["fr", "en", "es"], first: "fr", mine: "fr" }, "hers, not the team's, first");
  assert.deepEqual(languagesOf(view(undefined, ["en", "es"])), { tags: ["en", "es"], first: "en", mine: "" }, "none of hers: the team's first");
  assert.deepEqual(languagesOf(view("", ["", null, "es", 3])), { tags: ["es"], first: "es", mine: "" }, "only tags that are words");
  assert.deepEqual(languagesOf(view("en", undefined)), { tags: ["en"], first: "en", mine: "en" }, "the team's not read: hers alone");
});

test("R3: languagesOf reads nothing from a read that failed, and states no language where neither is held", () => {
  assert.deepEqual(languagesOf({ data: {} }), { tags: [], first: "", mine: "" });
  const failed = { data: { mylang: { state: "failed", value: { language: "es" } }, languages: { state: "failed", value: { languages: ["fr"] } } } };
  assert.deepEqual(languagesOf(failed), { tags: [], first: "", mine: "" });
  assert.deepEqual(languagesOf({ data: { mylang: { state: "ok", value: { language: 5 } }, languages: { state: "ok", value: { languages: "en" } } } }), { tags: [], first: "", mine: "" });
});
