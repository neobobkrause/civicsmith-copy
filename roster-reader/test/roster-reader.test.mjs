/* roster-reader — its requirements, tested at its interface (`roster-reader/index.mjs`) over the real
 * documents in ./fixtures and over synthetic lines where a requirement's edge needs one. The views are
 * ./fixtures.mjs's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIDENCE, CONTRACT, EVENTS, makeRegistry, entity } from "../../docprofile/registry.mjs";
import { registerRosterTypes, ROSTER_TYPES, staffRoster, orgChart, rosterColumns, ROLES, directoryPersonRefs, NAME_GRADE,
         ROSTER_FLOOR } from "../index.mjs";
import { ROSTER_DOCS, FW20, FW18, FIRST, HARBOR, EMPTY, ctxOf, allDocs, freeze } from "./fixtures.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

const D = ROSTER_DOCS.documents;
const ROSTERS = ["roster_committee", "roster_committee_rev", "roster_rps", "roster_wdb"];
const CHARTS = ["chart_opd", "chart_opd_bos", "chart_cao_2021", "chart_cao_2024", "chart_opw"];
/* The staff directory's own look-alikes, its directories, and the other documents neither type is. */
const SD_NEGATIVES = ["neg_candidates", "neg_schedule", "neg_recycling"];
const NOT_ROSTER = [...SD_NEGATIVES.map((k) => `d:${k}`), "d:neg_medical",
  ...["directory_nss", "directory_nsd", "directory_cro", "directory_benefits"].map((k) => `d:${k}`),
  ...Object.keys(FW18.documents).map((k) => `s:${k}`),
  ...["neg_cpab_chart", "neg_commenters", "neg_signin", "neg_business", "unread_cao_2023", "unread_pbd"].map((k) => `r:${k}`)];
const ALL = allDocs();
const text = (d) => (typeof d.text === "string" ? d.text : d.text.document);
const synth = (s, view = FIRST) => ({ text: s, view, locate: (o) => ({ kind: "doc-para", ref: `o${o}`, offset: o }) });
const CONTACT = /@|\b\d{3}[-.]\d{4}\b|\b\d{1,6}\s+\w+\s+(?:Street|St|Avenue|Ave|Blvd)\b/;

/* A registry as the plane wires docprofile's: content types, then these, then a fallback. */
function registry() {
  const r = makeRegistry();
  registerRosterTypes(r.register);
  r.register({ key: "generic", fallback: true, contract: CONTRACT.SUBSTANCE, detect: () => ({ match: false }) });
  return r;
}

/* ------------------------------------------------------------------------------------------------ */

test("R1 staff_roster: the measured rosters match, CERTAIN only where a short line names the document a roster with the view's words", () => {
  for (const k of ["roster_committee", "roster_committee_rev", "roster_rps"]) {
    const d = staffRoster.detect(ctxOf(D[k], FIRST));
    assert.equal(d.match, true, k);
    assert.equal(d.confidence, CONFIDENCE.CERTAIN, k);
    assert.ok(d.signals.some((s) => s.startsWith(localize("roster-reader.staff-roster.it_names_itself_a_roster", "it names itself a roster (\"{text}\")", { text: "" }).split(" (")[0])), k);
  }
  /* The board roster never names itself in its text: its rows alone make it LIKELY. */
  const wdb = staffRoster.detect(ctxOf(D.roster_wdb, FIRST));
  assert.equal(wdb.match, true);
  assert.equal(wdb.confidence, CONFIDENCE.LIKELY);
  assert.equal(wdb.why, localize("roster-reader.staff-roster.no_short_line_names_it_a", "no short line names it a roster with the view's words, so it is read as a roster on its rows alone"));
  /* The same board roster the staff directory refuses (its neg_wdb) is the positive here. */
  assert.equal(staffRoster.detect(ctxOf(FW20.documents.neg_wdb, FIRST)).match, true);
});

test("R1 staff_roster: no match on the staff directory's look-alikes, its directories, the substance documents, the charts, and the documents that name themselves a roster without rows", () => {
  for (const k of NOT_ROSTER) {
    const d = staffRoster.detect(ctxOf(ALL[k], FIRST));
    assert.equal(d.match, false, k);
    assert.equal(d.confidence, CONFIDENCE.NONE, k);
  }
  for (const k of CHARTS) assert.equal(staffRoster.detect(ctxOf(D[k], FIRST)).match, false, k);
  /* Self-naming is never sufficient alone: the EIR chapter and the sign-in sheet both name themselves. */
  for (const k of ["neg_commenters", "neg_signin"]) assert.match(text(D[k]), /roster/i, k);
  /* Every directory staff_directory reads (five or more addresses at one domain) is refused as one. */
  for (const k of ["directory_nss", "directory_cro", "directory_benefits"])
    assert.match(staffRoster.detect(ctxOf(FW20.documents[k], FIRST)).why, /staff directory's shape/, k);
});

test("R1 staff_roster: the floor, the contact-point and the dated-rows rules hold at their edges", () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => `Member${"abcdefghij"[i]}x Person${"abcdefghij"[i]}y Chair`).join("\n");
  assert.equal(staffRoster.detect(synth(`Staff Roster\n${rows(ROSTER_FLOOR - 1)}`)).match, false);
  const at = staffRoster.detect(synth(`Staff Roster\n${rows(ROSTER_FLOOR)}`));
  assert.equal(at.match, true);
  assert.equal(at.confidence, CONFIDENCE.CERTAIN);
  /* Contact points on half the rows: a contact list. */
  const contacts = Array.from({ length: 6 }, (_, i) => `Jane${"abcdef"[i]}a Doe${"abcdef"[i]}b Director${i % 2 ? "" : ` 510-555-01${i}${i}`}`).join("\n");
  assert.equal(staffRoster.detect(synth(`Staff Roster\n${contacts}`)).why, localize("roster-reader.staff-roster.contactlines_line_s_carry_a", "{contactLines} line(s) carry a contact point beside {paired} row(s): a directory or contact list, not a roster", { contactLines: "3", paired: "6" }));
  /* Dates as many as half the rows: a schedule that names people. */
  const dated = Array.from({ length: 6 }, (_, i) => `Jane${"abcdef"[i]}a Doe${"abcdef"[i]}b Director`).join("\n") + "\nMarch 3\nApril 7\nMay 5";
  assert.equal(staffRoster.detect(synth(`Staff Roster\n${dated}`)).why, localize("roster-reader.staff-roster.dates_date_s_beside_paired", "{dates} date(s) beside {paired} row(s): the rows are dated events that name people, not a roster", { dates: "3", paired: "6" }));
  /* A roster that names itself only as a chart is not matched as a roster. */
  assert.equal(staffRoster.detect(synth(`Organizational Chart\n${rows(8)}`)).why, localize("roster-reader.staff-roster.it_names_itself_with_the_views", "it names itself, with the view's words, as a chart and not as a roster"));
});

test("R1 the two types register through the seam, in order, once per register function, and the registry picks each measured document's type", () => {
  const seen = [];
  const reg = (t) => seen.push(t.key);
  assert.deepEqual(registerRosterTypes(reg), ["staff_roster", "org_chart"]);
  registerRosterTypes(reg);
  assert.deepEqual(seen, ["staff_roster", "org_chart"]);
  assert.deepEqual(ROSTER_TYPES.map((t) => t.key), ["staff_roster", "org_chart"]);
  for (const t of ROSTER_TYPES) {
    assert.equal(t.contract, CONTRACT.MEMBERSHIP, t.key);
    for (const f of ["detect", "parse", "assess"]) assert.equal(typeof t[f], "function", `${t.key}.${f}`);
  }
  const r = registry();
  for (const k of ROSTERS) assert.equal(r.recognise(ctxOf(D[k], FIRST)).member.key, "staff_roster", k);
  for (const k of CHARTS) assert.equal(r.recognise(ctxOf(D[k], FIRST)).member.key, "org_chart", k);
  for (const k of NOT_ROSTER) assert.equal(r.recognise(ctxOf(ALL[k], FIRST)).member.key, "generic", k);
});

test("R2 staff_roster parse: rows as the lines state them, a post's title and unit where a staff title divides it, never a pair by guess", () => {
  const p = staffRoster.parse(ctxOf(D.roster_committee, FIRST));
  const find = (name, title) => p.rows.filter((r) => r.name === name && r.title === title);
  assert.deepEqual(find("Janani Ramachandran", "Chair").map((r) => r.unit), ["Finance & Management"]);
  assert.deepEqual(find("Zac Unger", "Chair").map((r) => r.unit), ["Public Works"]);
  assert.equal(find("Candace Evans", "City Clerk Staff").length, 3);
  assert.equal(find("Harold Duffey", "City Administrator").length, 1);
  /* `City Administrator: Candice Parker & Tonya Gilmore` is two rows, one post. */
  assert.equal(find("Candice Parker", "City Administrator").length, 1);
  assert.equal(find("Tonya Gilmore", "City Administrator").length, 1);
  /* A member printed alone is a row with a name and nothing invented beside it. */
  assert.ok(p.rows.some((r) => r.name === "Ken Houston" && !("title" in r) && !("unit" in r)));
  /* Every row is either divided (a name, as printed in the text) or kept whole with why. */
  const flat = text(D.roster_committee).replace(/\s+/g, " ");
  for (const r of p.rows) {
    if (r.name) { assert.ok(flat.includes(r.name), r.name); assert.ok(!("line" in r)); }
    else { assert.equal(typeof r.line, "string"); assert.ok(r.why); }
    assert.equal(r.source.kind, "pdf-page");
  }
  assert.deepEqual(p.as_of && { text: p.as_of.text, date: p.as_of.date }, { text: "January 10, 2025", date: "2025-01-10" });
  assert.equal(p.organisation.text, "CITYCOUNCIL COMMITTEE MEMBER");
  /* The board roster prints a name beside an organisation, which no staff title divides: every row whole. */
  const w = staffRoster.parse(ctxOf(D.roster_wdb, FIRST));
  assert.equal(w.rows.length, 18);
  const notDivided = [localize("roster-reader.staff-roster.the_line_opens_with_a", "the line opens with a name but what follows it is not one of the view's staff titles, so where the name ends is not divided by guess"),
                      localize("roster-reader.staff-roster.the_line_prints_staff", "the line prints staff titles and names that do not divide into one name beside its title, so it is not paired by guess")];
  for (const r of w.rows) { assert.ok(!("name" in r)); assert.ok(notDivided.includes(r.why)); }
  assert.equal(w.as_of, null);
  assert.equal(w.as_of_why, localize("roster-reader.staff-roster.no_line_among_the_documents_first", "no line among the document's first eight, or beside its self-naming line, states a date"));
  assert.equal(w.organisation.text, "Oakland Workforce Development Board");
  /* A title before or after one name divides; two names beside a title, or a name between two titles,
     do not. */
  const s = staffRoster.parse(synth("Director Jane Doe\nJohn Roe Manager\nJane Doe, John Roe Director\nDirector Ann Lee Manager"));
  assert.deepEqual(s.rows.map((r) => [r.name ?? null, r.title ?? null, r.line ?? null]),
    [["Jane Doe", "Director", null], ["John Roe", "Manager", null], [null, null, "Jane Doe, John Roe Director"],
     [null, null, "Director Ann Lee Manager"]]);
});

test("R3 org_chart: the measured charts match, CERTAIN only on the view's chart words, and nothing else does", () => {
  const want = { chart_opd: CONFIDENCE.CERTAIN, chart_cao_2021: CONFIDENCE.CERTAIN, chart_cao_2024: CONFIDENCE.CERTAIN,
                 chart_opd_bos: CONFIDENCE.LIKELY, chart_opw: CONFIDENCE.LIKELY };
  for (const [k, c] of Object.entries(want)) {
    const d = orgChart.detect(ctxOf(D[k], FIRST));
    assert.equal(d.match, true, k);
    assert.equal(d.confidence, c, k);
  }
  for (const k of [...NOT_ROSTER, ...ROSTERS.map((x) => `r:${x}`)]) assert.equal(orgChart.detect(ctxOf(ALL[k], FIRST)).match, false, k);
});

test("R3 org_chart parse: units and posts as read, a name beside a post only on its own line, a reporting pair only where words state it", () => {
  const p = orgChart.parse(ctxOf(D.chart_opd, FIRST));
  for (const u of ["Records Division", "Internal Affairs Division", "Homicide Section", "Bureau of Services"])
    assert.ok(p.units.some((x) => x.label === u), u);
  for (const x of [...p.units, ...p.posts]) { assert.equal(typeof x.label, "string"); assert.equal(x.source.kind, "pdf-page"); }
  assert.deepEqual(p.reports_to, []);
  assert.equal(p.pairs_why, localize("roster-reader.org-chart.no_reporting_relation_is_stated", "no reporting relation is stated in words; the chart's boxes and connecting lines are a drawing that text does not carry, so no other pair is read"));
  assert.equal(p.organisation.text, "Oakland Police Department");
  assert.equal(p.as_of.date, "2021-03-20");
  /* Every measured chart: no pair is read, because none states one in words. */
  for (const k of CHARTS) assert.deepEqual(orgChart.parse(ctxOf(D[k], FIRST)).reports_to, [], k);
  const s = orgChart.parse(synth("Director Jane Doe\nRecords Manager reports to the Deputy Director\nManager\nJohn Roe\nRecords Division"));
  assert.deepEqual(s.posts.find((x) => x.name), { label: "Director", name: "Jane Doe", source: { kind: "doc-para", ref: "o0", offset: 0 } });
  assert.deepEqual(s.reports_to.map((x) => [x.from, x.to]), [["Records Manager", "Deputy Director"]]);
  /* A post and a name on adjacent lines are not paired: the layout is not the text. */
  assert.ok(!s.posts.some((x) => x.name === "John Roe"));
  assert.match(s.pairs_why, /1 reporting relation\(s\) stated in words/);
});

test("R4 neither type reads or emits a phone number, street address or e-mail address; a row carrying one is read without it", () => {
  const doc = ["Staff Roster", "Jane Doe Director 510-555-0101", "John Roe Manager", "Ann Lee Chair jlee@home.example",
               "Bob Ray Analyst", "Cy Park Supervisor", "Di Moe Coordinator", "Ed Fox Inspector 12 Main Street"].join("\n");
  const p = staffRoster.parse(synth(doc));
  assert.doesNotMatch(JSON.stringify(p), CONTACT);
  assert.ok(p.rows.some((r) => r.name === "Jane Doe" && r.title === "Director"));
  assert.ok(p.rows.some((r) => r.name === "Ann Lee" && r.title === "Chair"));
  assert.ok(p.rows.some((r) => r.name === "Ed Fox" && r.title === "Inspector"));
  const c = orgChart.parse(synth(["Records Division", "Director Jane Doe 510-555-0101", "Manager x2234", "Fiscal Section", "Payroll Unit",
                                   "Analyst 1 Frank Ogawa Plaza", "Grants Unit", "Contracts Unit"].join("\n")));
  assert.doesNotMatch(JSON.stringify(c), CONTACT);
  /* Over every real document, and the directories full of contact points: nothing emitted carries one. */
  for (const [k, d] of Object.entries(ALL)) {
    for (const t of ROSTER_TYPES) assert.doesNotMatch(JSON.stringify(t.parse(ctxOf(d, FIRST))), CONTACT, `${t.key} ${k}`);
  }
});

test("R5 assess compares by row: the real roster revision's departures, arrivals and moved posts, from the catalogue only", () => {
  const a = staffRoster.parse(ctxOf(D.roster_committee, FIRST));
  const b = staffRoster.parse(ctxOf(D.roster_committee_rev, FIRST));
  const r = staffRoster.assess(a, b);
  const of = (type) => r.events.filter((e) => e.type === type).map((e) => e.key);
  for (const k of ["name:Rebecca Kaplan", "name:Harold Duffey", "name:Tonya Gilmore"]) assert.ok(of("delisted").includes(k), k);
  for (const k of ["name:Charlene Wang", "name:Kevin Jenkins", "name:Winnie Woo", "name:Asha Reed"]) assert.ok(of("item_added").includes(k), k);
  const gallo = r.events.find((e) => e.key === "name:Noel Gallo");
  assert.equal(gallo.type, "item_changed");
  assert.deepEqual(gallo.moved.map((m) => m.fact).sort(), ["title", "unit"]);
  for (const e of r.events) {
    assert.ok(["delisted", "item_added", "item_changed"].includes(e.type), e.type);
    assert.equal(e.significance, EVENTS[e.type].significance);
  }
  assert.equal(r.meaningful, true);
  assert.equal(r.confirmed.intact > 0, true);
  /* The same reading twice: nothing moved, and the rows are confirmed. */
  const same = staffRoster.assess(a, a);
  assert.deepEqual(same.events, []);
  assert.equal(same.meaningful, false);
  assert.equal(same.confirmed.intact, same.confirmed.rows);
  /* A title or a unit moved is item_changed; a failed read is a failed reader, never a mass removal. */
  const one = (rows) => ({ rows });
  const t = staffRoster.assess(one([{ name: "Jane Doe", title: "Manager" }]), one([{ name: "Jane Doe", title: "Director" }]));
  assert.deepEqual(t.events.map((e) => [e.type, e.moved.map((m) => [m.fact, m.was, m.now])]), [["item_changed", [["title", "Manager", "Director"]]]]);
  const failed = staffRoster.assess(a, one([]));
  assert.equal(failed.meaningful, null);
  assert.deepEqual(failed.events, []);
  /* The chart compares by box. */
  const c1 = orgChart.parse(synth("Records Division\nDirector Jane Doe")), c2 = orgChart.parse(synth("Fiscal Section\nDirector John Roe"));
  const ca = orgChart.assess(c1, c2);
  assert.deepEqual(ca.events.map((e) => [e.type, e.key]).sort(),
    [["delisted", "unit:Records Division"], ["item_added", "unit:Fiscal Section"], ["item_changed", "post:Director"]]);
});

test("R6 rosterColumns names each column's role from the view's header words, contact columns as contact, and never reads a row", () => {
  const r = rosterColumns(["Full Name", "Organization", "Terms"], FIRST);
  assert.equal(r.roster, true);
  assert.equal(r.why, null);
  assert.deepEqual(r.roles.map((c) => c.role), ["name", "unit", null]);
  assert.equal(r.roles[2].why, localize("roster-reader.columns.no_header_word_in_the_view", "no header word in the view names a role for it"));
  const all = rosterColumns(["Employee ID", "Job Title", "Department", "Start Date", "End Date", "As of", "Phone", "Email", "Home Address"], FIRST);
  assert.deepEqual(all.roles.map((c) => c.role), ["employee_id", "title", "unit", "start", "end", "as_of", "contact", "contact", "contact"]);
  assert.equal(all.roster, true);
  for (const role of all.roles.map((c) => c.role)) assert.ok(ROLES.includes(role));
  /* No name and no employee id: not a roster, with why. */
  const not = rosterColumns(["Title", "Department", "Phone"], FIRST);
  assert.equal(not.roster, false);
  assert.equal(not.why, localize("roster-reader.columns.no_column_is_named_name", "no column is named `name` or `employee_id`, so this table is not read as a roster{v1}", { v1: "" }));
  /* The output is about the header alone: every key is the column's, nothing else. */
  for (const c of all.roles) assert.deepEqual(Object.keys(c).sort(), ["header", "index", "role", "why"]);
  assert.deepEqual(Object.keys(all).sort(), ["roles", "roster", "why"]);
  /* A header matching two roles' words is not named by guess. */
  const twice = rosterColumns(["Name"], { vocabulary: { roster_headers: [
    { pattern: { re: "^Name$" }, role: "name", basis: "TEST", profile: "t" }, { pattern: { re: "Name" }, role: "title", basis: "TEST", profile: "t" }] } });
  assert.equal(twice.roles[0].role, null);
  assert.equal(twice.roles[0].why, localize("roster-reader.columns.its_header_matches_the_views", "its header matches the view's words for more than one role ({hit}), so no role is named by guess", { hit: "name, title" }));
  assert.equal(rosterColumns("Name, Title", FIRST).roster, false);
});

/* The staff directory's contact entries, in its own shape (one per address, keyed by it, its line the
   address's own line), built from its real fixtures so this test needs no other module's reader. */
function contactEntities(t) {
  const out = [], seen = new Set();
  for (const m of t.matchAll(/\b[A-Za-z0-9][A-Za-z0-9._%+-]*@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})\b/g)) {
    const a = m[0].toLowerCase();
    if (seen.has(a)) continue;
    seen.add(a);
    const s = t.lastIndexOf("\n", m.index) + 1, e = t.indexOf("\n", m.index);
    const line = t.slice(s, e < 0 ? t.length : e).replace(/\s+/g, " ").trim();
    out.push(entity(a, "contact", line, { address: a, line, phone: null }));
  }
  return out;
}

test("R7 directoryPersonRefs keeps each reference keyed by its address and reads a name only when exactly one name-shaped span remains, graded C", () => {
  for (const k of ["directory_nss", "directory_nsd", "directory_cro", "directory_benefits"]) {
    const ents = contactEntities(text(FW20.documents[k]));
    const refs = directoryPersonRefs(ents, FIRST);
    assert.deepEqual(refs.map((r) => r.contact_key), ents.map((e) => e.key), k);
    for (const r of refs) {
      if ("name" in r) { assert.equal(r.match_grade, "C"); assert.match(r.why, /grade C/); }
      else { assert.equal(r.match_grade, null); assert.ok(r.why); }
      assert.doesNotMatch(r.name || "", CONTACT);
    }
  }
  assert.equal(NAME_GRADE, "C");
  const nss = directoryPersonRefs(contactEntities(text(FW20.documents.directory_nss)), FIRST);
  assert.equal(nss.find((r) => r.contact_key === "amoore@oaklandca.gov").name, "Angela Moore");
  /* Two people's text on one line (the two-column sheet) gives no name. */
  const two = directoryPersonRefs([entity("a@x.example", "contact", "", { line: "Jane Doe a@x.example John Roe b@x.example" })], FIRST);
  assert.equal(two[0].name, undefined);
  assert.equal(two[0].why, localize("roster-reader.directory-refs.length_name_shaped_spans_remain", "{length} name-shaped spans remain on the entry's line, which may hold more than one person's text, so no name is read", { length: "2" }));
  /* The view's staff titles are removed before the name is read. */
  const titled = directoryPersonRefs([entity("a@x.example", "contact", "", { line: "Analyst II Jane Doe a@x.example 510-555-0101" })], FIRST);
  assert.equal(titled[0].name, "Jane Doe");
  /* Never above C, whatever the entry says. */
  for (const r of directoryPersonRefs([entity("a@x.example", "contact", "", { line: "Jane Doe", grade: "A" })], FIRST)) assert.equal(r.match_grade, "C");
});

test("R8 no place in code: local recognition follows the view given, the first profile's words and a made-up profile's alike, and an empty view recognises nothing local", () => {
  /* EMPTY: nothing names itself, no staff title divides a row, no column has a role. */
  for (const [k, d] of Object.entries(ALL)) for (const t of ROSTER_TYPES) {
    const r = t.detect(ctxOf(d, EMPTY));
    assert.notEqual(r.confidence, CONFIDENCE.CERTAIN, `${t.key} ${k}`);
  }
  const c = staffRoster.parse(ctxOf(D.roster_committee, EMPTY));
  assert.ok(!c.rows.some((r) => r.unit), "no unit is divided off a post without the view's staff titles");
  assert.deepEqual(rosterColumns(["Full Name", "Organization"], EMPTY).roles.map((x) => x.role), [null, null]);
  /* The same synthetic roster under two views: each recognises its own words only. */
  const harbor = "Register of Officers\nHarbourmaster Jane Doe\nWarden John Roe\nSelectperson Ann Lee\nClerk of Works Bob Ray\nWarden Cy Park\nWarden Di Moe";
  const h = staffRoster.detect(synth(harbor, HARBOR)), f = staffRoster.detect(synth(harbor, FIRST));
  assert.equal(h.confidence, CONFIDENCE.CERTAIN);
  assert.equal(f.match, false);
  assert.ok(staffRoster.parse(synth(harbor, HARBOR)).rows.some((r) => r.name === "Jane Doe" && r.title === "Harbourmaster"));
  assert.ok(!staffRoster.parse(synth(harbor, FIRST)).rows.some((r) => r.title === "Harbourmaster"));
  assert.deepEqual(rosterColumns(["Officer", "Rank", "Payroll No.", "Telephone"], HARBOR).roles.map((x) => x.role), ["name", "title", "employee_id", "contact"]);
  assert.deepEqual(rosterColumns(["Officer", "Rank"], FIRST).roles.map((x) => x.role), [null, null]);
  /* The first profile's words make the measured documents' self-naming CERTAIN; the made-up profile's do not. */
  assert.equal(staffRoster.detect(ctxOf(D.roster_committee, FIRST)).confidence, CONFIDENCE.CERTAIN);
  assert.equal(staffRoster.detect(ctxOf(D.roster_committee, HARBOR)).confidence, CONFIDENCE.LIKELY);
  assert.equal(orgChart.detect(ctxOf(D.chart_opd, HARBOR)).confidence, CONFIDENCE.LIKELY);
});

test("R9 the types are tested on real documents fetched and read through the plane, each with its provenance, the staff directory's four negatives among them", () => {
  for (const [k, d] of Object.entries(D)) {
    assert.match(d.source, /^https:\/\//, k);
    assert.match(d.sha256, /^[0-9a-f]{64}$/, k);
    assert.ok(Number.isInteger(d.bytes) && d.bytes > 0, k);
    assert.ok([1, 2].includes(d.tier), k);
    assert.equal(d.text.document.length, d.chars, k);
    assert.ok(d.what, k);
  }
  assert.match(ROSTER_DOCS.note, /read through the plane/);
  assert.equal(Object.keys(D).length, 15);
  /* The staff directory header's four: the candidate list, the dated schedule, the business directory
     (all three refused, R1), the board roster (the positive, R1). */
  for (const k of [...SD_NEGATIVES, "neg_wdb"]) assert.ok(FW20.documents[k], k);
});

test("R10 everything read is a reading: inputs are not written, outputs hold only what the document states, and no post, holder, pair or identity is asserted", () => {
  for (const [k, d] of Object.entries(ALL)) {
    for (const t of ROSTER_TYPES) {
      const ctx = freeze(ctxOf(d, freeze(structuredClone(FIRST))));
      const once = t.parse(ctx), twice = t.parse(ctx);
      assert.deepEqual(once, twice, `${t.key} ${k}`);
      for (const bad of ["lines", "holders", "identity", "identity_claims", "writes", "holds"]) assert.ok(!(bad in once), `${t.key} ${k} ${bad}`);
    }
  }
  const refs = directoryPersonRefs(freeze(contactEntities(text(FW20.documents.directory_nss))), freeze(structuredClone(FIRST)));
  for (const r of refs) assert.deepEqual(Object.keys(r).filter((x) => !["contact_key", "name", "match_grade", "why"].includes(x)), []);
  rosterColumns(freeze(["Name", "Title"]), freeze(structuredClone(FIRST)));
});

test("R11 every no says which no and why: no match, no name, no pair, no role, no date, no organisation, a failed read", () => {
  for (const [k, d] of Object.entries(ALL)) for (const t of ROSTER_TYPES) {
    const r = t.detect(ctxOf(d, FIRST));
    if (!r.match) assert.ok(typeof r.why === "string" && r.why.length > 20, `${t.key} ${k}`);
    else if (r.confidence !== CONFIDENCE.CERTAIN) assert.ok(r.why, `${t.key} ${k}`);
    const p = t.parse(ctxOf(d, FIRST));
    if (p.as_of === null) assert.ok(p.as_of_why, `${t.key} ${k} as_of`);
    if (p.organisation === null) assert.ok(p.organisation_why, `${t.key} ${k} organisation`);
    for (const row of p.rows || []) if (!row.name) assert.ok(row.why, `${k} row`);
    if (t === orgChart) assert.ok(p.pairs_why, `${k} pairs`);
  }
  assert.equal(staffRoster.detect(ctxOf(D.unread_pbd, FIRST)).why, localize("roster-reader.staff-roster.no_text_was_read_so", "no text was read, so there are no rows to recognise"));
  for (const c of rosterColumns(["", "Nonsense"], FIRST).roles) assert.ok(c.why);
  assert.equal(rosterColumns(["Name"], EMPTY).roles[0].why, localize("roster-reader.columns.the_view_supplies_no_roster", "the view supplies no roster header words, so no column's role can be named"));
  assert.equal(directoryPersonRefs([entity("a@x.example", "contact", "", { line: "" })], FIRST)[0].why, localize("roster-reader.directory-refs.the_entry_carries_no_line", "the entry carries no line to read a name from"));
  assert.match(staffRoster.assess({ rows: [] }, { rows: [] }).why, /either time/);
});
