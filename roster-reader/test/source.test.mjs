/* roster-reader R12: `rosterSource(reads)`, the roster source `people.staffingAt` asks (people R18, R19), tested at
 * the module's interface over the real roster documents in ./fixtures and over tables built in a payroll export's
 * shape. `reads` stands in for the store's read the composition root hands in. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rosterSource, LEVEL_READ, LEVEL_NOT_READ, staffRoster } from "../index.mjs";
import { ROSTER_DOCS, FIRST, ctxOf, freeze } from "./fixtures.mjs";
import { word, localize } from "../../bio-plane/src/setup-words/index.mjs";
/** @import { StoreRead, RosterQuery, HeldRoster, RosterAnswer } from "../source.mjs" */
/** @import { CapturedDoc } from "./fixtures.mjs" */
/** @import { Value } from "../lines.mjs" */

const D = ROSTER_DOCS.documents;
/** @param {string} k @returns {CapturedDoc} */
const doc = (k) => { const d = D[k]; assert.ok(d, k); return d; };
/** The first roster of an answer, which the test expects there. @param {RosterAnswer} a @returns {HeldRoster} */
const first = (a) => { const r = a.rosters[0]; assert.ok(r); return r; };
const Q = { organisation: "ENT-7", at: "2025-03-01", viewer: "MBR-1" };
const CONTACT = /@|\b\d{3}[-.]\d{4}\b|\b\d{1,6}\s+\w+\s+(?:Street|St|Avenue|Ave|Blvd)\b/;
const TABLE = {
  source: { table: "TBL-1" }, as_of: "2025-02-01", view: FIRST,
  header: ["Full Name", "Job Title", "Department", "Start Date", "End Date", "Employee ID", "Phone", "Home Address", "Notes"],
  rows: [["Jane Doe", "Director", "Public Works", "2019-04-01", "", "E100", "510-555-0101", "12 Main Street", "private note"],
         ["John Roe 510-555-0102", "Analyst II", "Finance", "2021-01-04", "2024-06-30", "E101", "510-555-0199", "4 Oak Ave", "x"],
         ["", "", "", "", "", "", "510-555-0000", "", ""]],
};
/** A held document as the store's read answers it. @param {string} k */
const docItem = (k) => ({ source: { sha256: doc(k).sha256 }, text: doc(k).text, view: FIRST });

test("R12 a held roster document is read by R2 and answered as {source, as_of, rows}, its own date stated, at the level read by roster-reader", () => {
  /** @type {Value[]} */
  const seen = [];
  const src = rosterSource((q) => { seen.push(q); return [docItem("roster_committee")]; });
  const a = src(Q);
  assert.deepEqual(seen, [{ organisation: "ENT-7", viewer: "MBR-1" }]);
  assert.equal(a.level, LEVEL_READ);
  assert.equal(a.level, localize("roster-reader.source.held_as_a_table_read", "held as a table, read by roster-reader"));
  assert.equal(a.organisation, "ENT-7");
  assert.equal(a.at, "2025-03-01");
  assert.equal(a.rosters.length, 1);
  const r = first(a);
  assert.deepEqual(r.source, { sha256: doc("roster_committee").sha256 });
  assert.equal(r.as_of, "2025-01-10");
  /* Every row is R2's row, as the document states it, placed where its own text says. */
  const want = staffRoster.parse(ctxOf(doc("roster_committee"), FIRST)).rows;
  const rows = r.rows;
  assert.deepEqual(rows, want);
  assert.ok(rows.some((x) => x.name === "Zac Unger" && x.title === "Chair" && x.unit === "Public Works"));
  for (const x of rows) { const src = x.source; assert.equal(src && "kind" in src ? src.kind : undefined, "pdf-page"); }
  /* A roster whose text states no date: as_of null, with why. */
  const w = first(rosterSource(() => [docItem("roster_wdb")])(Q));
  assert.equal(w.as_of, null);
  assert.equal(w.as_of_why, localize("roster-reader.staff-roster.no_line_among_the_documents_first", "no line among the document's first eight, or beside its self-naming line, states a date"));
  assert.equal(w.rows.length, 18);
});

test("R12 a held roster table is read through R6's column roles, each row {name?, title?, unit?, start?, end?, employee_id?, source}; a contact or unnamed column is never read", () => {
  const a = rosterSource(() => [TABLE])(Q);
  assert.equal(a.level, LEVEL_READ);
  const r = first(a);
  assert.deepEqual(r.source, { table: "TBL-1" });
  assert.equal(r.as_of, "2025-02-01");
  assert.deepEqual(r.rows, [
    { name: "Jane Doe", title: "Director", unit: "Public Works", start: "2019-04-01", employee_id: "E100", source: { roster: { table: "TBL-1" }, row: 0 } },
    { name: "John Roe", title: "Analyst II", unit: "Finance", start: "2021-01-04", end: "2024-06-30", employee_id: "E101", source: { roster: { table: "TBL-1" }, row: 1 } },
  ]);
  assert.doesNotMatch(JSON.stringify(a), CONTACT);
  assert.doesNotMatch(JSON.stringify(a), /private note/);
  assert.deepEqual((r.columns || []).map((c) => c.role), ["name", "title", "unit", "start", "end", "employee_id", "contact", "contact", null]);
  assert.equal(r.columns_why, `${localize("roster-reader.source.contact_contact_column_s_not", "{contact} contact column(s) not read", { contact: "2" })}; ${localize("roster-reader.source.unnamed_column_s_with_no", "{unnamed} column(s) with no role not read", { unnamed: "1" })}`);
  /* Rows keyed by header text read the same way; a table stating no date says so. */
  const keyed = { source: "T2", header: ["Name", "Title", "Email"], rows: [{ Name: "Ann Lee", Title: "Chair", Email: "a@x.example" }] };
  const k = first(rosterSource(() => ({ items: [keyed], view: FIRST }))(Q));
  assert.deepEqual(k.rows, [{ name: "Ann Lee", title: "Chair", source: { roster: "T2", row: 0 } }]);
  assert.equal(k.as_of, null);
  assert.equal(k.as_of_why, localize("roster-reader.source.the_held_table_states_no", "the held table states no date of its own; a row's own `as_of` column, where it has one, is kept on the row"));
  /* A table R6 says is not a roster is not read, with R6's why. */
  const not = rosterSource(() => [{ source: "T3", header: ["Title", "Phone"], rows: [["Chair", "510-555-0101"]], view: FIRST }])(Q);
  assert.deepEqual(not.rosters, []);
  assert.deepEqual(not.unread, [{ source: "T3", why: localize("roster-reader.columns.no_column_is_named_name", "no column is named `name` or `employee_id`, so this table is not read as a roster{v1}", { v1: "" }) }]);
  assert.equal(not.why, localize("roster-reader.source.length_held_roster_s_of", "{length} held roster(s) of this organisation the viewer may see, none of which could be read as a roster", { length: "1" }));
});

test("R12 a held organisation chart gives as rows only the posts that name their holder on their own line", () => {
  const text = "Records Division\nDirector Jane Doe\nManager\nJohn Roe\nFiscal Section\nPayroll Unit\nAnalyst Ann Lee\nGrants Unit";
  const a = rosterSource(() => [{ source: "C1", text, type: "org_chart", view: FIRST }])(Q);
  const r = first(a);
  assert.deepEqual(r.rows.map((x) => [x.name, x.title]), [["Jane Doe", "Director"], ["Ann Lee", "Analyst"]]);
  assert.equal(r.rows_why, localize("roster-reader.source.an_organisation_chart_a_row", "an organisation chart: a row is a post whose holder is named on its own line; a box with no name, and any reporting line the drawing shows, are not rows"));
});

test("R12 it never states that a row's person held the post at `at`: rows carry only what the roster states, and `at` is the date asked", () => {
  const a = rosterSource(() => [docItem("roster_committee"), TABLE])({ ...Q, at: "1999-01-01" });
  assert.equal(a.at, "1999-01-01");
  for (const r of a.rosters) {
    assert.ok(!("at" in r));
    for (const row of r.rows) {
      for (const k of Object.keys(row)) assert.ok(["name", "title", "unit", "start", "end", "employee_id", "as_of", "line", "why", "source"].includes(k), k);
      for (const bad of ["holds", "held", "holder", "valid", "current", "identity", "person"]) assert.ok(!(bad in row), bad);
    }
  }
  /* The same reading whatever date is asked: the date is not applied to the rows. */
  const b = rosterSource(() => [docItem("roster_committee"), TABLE])({ ...Q, at: "2030-01-01" });
  assert.deepEqual(a.rosters, b.rosters);
});

test("R12 with no held roster it answers rosters: [] with why; with reads absent, failing, refusing, late or shapeless, the level not read with why; it never throws", () => {
  const none = rosterSource(() => [])(Q);
  assert.equal(none.level, LEVEL_READ);
  assert.deepEqual(none.rosters, []);
  assert.equal(none.why, localize("roster-reader.source.no_roster_document_or_roster", "no roster document or roster table of this organisation is held that the viewer may see"));
  const later = localize("roster-reader.source.the_stores_read_answered_later", "the store's read answered later (a promise), and a roster source answers at once, so no held roster is read");
  const noList = localize("roster-reader.source.the_stores_read_answered_no", "the store's read answered no list of held rosters, so no held roster is read");
  /** @type {Array<[StoreRead | undefined, string]>} */
  const cases = [
    [undefined, localize("roster-reader.source.no_read_of_the_store", "no read of the store was handed to roster-reader, so no held roster is read")],
    [() => { throw new Error("db closed"); }, localize("roster-reader.source.the_stores_read_of_held", "the store's read of held rosters failed ({msg}), so no held roster is read", { msg: "db closed" })],
    [() => ({ ok: false, why: "not a member" }), localize("roster-reader.source.the_stores_read_refused_v1", "the store's read refused{v1}, so no held roster is read", { v1: " (not a member)" })],
    [() => Promise.resolve([]), later],
    [() => Promise.reject(new Error("x")), later],
    [() => 42, noList],
    [() => null, noList],
  ];
  for (const [reads, why] of cases) {
    const a = rosterSource(reads)(Q);
    assert.equal(a.level, LEVEL_NOT_READ);
    assert.equal(a.level, word("people.held_as_a_table_not"));
    assert.deepEqual(a.rosters, []);
    assert.equal(a.organisation, "ENT-7");
    assert.equal(a.why, why);
  }
  /* Malformed questions and items are answered, never thrown: each item it cannot read is named with why. */
  /** @type {Array<RosterQuery | null | undefined>} */
  const questions = [undefined, null, {}];
  for (const q of questions) assert.equal(rosterSource(() => [])(q).level, LEVEL_READ);
  const bad = rosterSource(() => [null, { source: "X" }, { source: "Y", text: "" }, { source: "Z", header: ["Name"] },
                                  { source: "V", get text() { throw new Error("boom"); } }])(Q);
  assert.deepEqual(bad.rosters, []);
  assert.deepEqual((bad.unread || []).map((u) => u.source), [null, "X", "Y", "Z", "V"]);
  for (const u of bad.unread || []) assert.ok(typeof u.why === "string" && u.why.length > 10, String(u.source));
});

test("R12 it writes nothing: the store's answer and the question are read, not changed, and two asks answer the same", () => {
  const items = freeze(structuredClone([docItem("roster_rps"), TABLE]));
  const q = freeze({ ...Q });
  const src = rosterSource(() => items);
  assert.deepEqual(src(q), src(q));
  assert.ok(first(src(q)).rows.length > 0);
});
