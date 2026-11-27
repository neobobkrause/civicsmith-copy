/* court-doctypes: the three readers at their interface (`detect`, `parse`), over the captured registers
 * (R1–R9, R13–R17). Every assertion is about what a type answers, never about its source text. */
import test from "node:test";
import assert from "node:assert/strict";
import { recognise } from "../../bio-plane/src/idspaces.mjs";
import { CONTRACT } from "../../docprofile/doctypes/index.mjs";
import { courtlistenerDocket as CL, cpucProceeding as CPUC, ecourtRoa as EC, COURT_TYPES, KEYS, registerCourtTypes } from "../index.mjs";
import { fixture, viewFor, LOCATORS, ctxFor, FIRST, TEST } from "./helpers.mjs";
/** @import { RegisterType } from "../common.mjs" */
/** @import { ReadingPosition } from "../../bio-plane/src/textchain.mjs" */
/** @import { CaptureOrigin, FixtureName } from "./helpers.mjs" */

const P2 = fixture("courtlistener-4214664-p2.html");
const P4 = fixture("courtlistener-4214664-p4.html");
const CARD = fixture("cpuc-A2106021-card.html");
const DOCS = fixture("cpuc-A2106021-documents-p1.html");
const ROA = fixture("ecourt-roa-FICTIONAL.html");
/** @type {{ courtlistener: Array<[FixtureName, RegExp]>, cpuc: Array<[FixtureName, RegExp]>, ecourt: Array<[FixtureName, RegExp]> }} */
const NEGATIVES = {
  courtlistener: [["courtlistener-sign-in.html", /sign-in page/], ["courtlistener-404.html", /error page/]],
  cpuc: [["cpuc-search.html", /search page/]],
  ecourt: [["ecourt-login.html", /sign-in page/], ["ecourt-search.html", /search page/]],
};
const VIEWS = { [FIRST]: viewFor(FIRST), [TEST]: viewFor(TEST) };

/* Every register row in the page's own markup, counted independently of the reader: CourtListener's
   `div#entry-n` / `div#minute-entry-n`, the APEX report's data rows. */
const clRowIds = (/** @type {string} */ html) => [...html.matchAll(/<div\b[^>]*\bid="((?:minute-)?entry-([0-9]+))"/g)].map((m) => m[1] ?? "");

test("R1 R15: each type matches its own captured page at CERTAIN only at an address the view names under its key, in either profile", () => {
  for (const id of /** @type {const} */ ([FIRST, TEST])) {
    const view = VIEWS[id], L = LOCATORS[id];
    /** @type {Array<[RegisterType, string, string, CaptureOrigin?]>} */
    const cases = [
      [CL, P2, L.courtlistener(2)], [CL, P4, L.courtlistener(4)],
      [CPUC, CARD, L.card], [CPUC, DOCS, L.documents], [EC, ROA, L.ecourt, "member"]];
    for (const [type, text, locator, origin] of cases) {
      const d = type.detect(ctxFor(text, { view, locator, origin }));
      assert.equal(d.match, true, `${type.key} under ${id}`);
      assert.equal(d.confidence, "certain", `${type.key} under ${id}: ${d.why}`);
    }
  }
});

test("R1 R15 R17: the same page at an address no active profile names under the key is not CERTAIN, and says why; the address is the view's, never code's", () => {
  /** @type {Array<[RegisterType, string, string, CaptureOrigin?]>} */
  const cases = [[CL, P2, LOCATORS[FIRST].courtlistener(2)], [CPUC, DOCS, LOCATORS[FIRST].documents], [EC, ROA, LOCATORS[FIRST].ecourt, "member"]];
  for (const [type, text, locator, origin] of cases) {
    /* the first profile's real address, read under the test profile's view: not its system */
    const d = type.detect(ctxFor(text, { view: VIEWS[TEST], locator, origin }));
    assert.equal(d.match, true);
    assert.equal(d.confidence, "likely", type.key);
    assert.match(d.why ?? "", /no active profile names its address/);
    /* and with no systems entry under the key at all, nowhere is the address */
    const bare = type.detect(ctxFor(text, { view: viewFor(FIRST, { systems: false }), locator, origin }));
    assert.equal(bare.confidence, "likely");
    /* a capture with no address */
    const none = type.detect(ctxFor(text, { view: VIEWS[FIRST], locator: undefined, origin }));
    assert.equal(none.confidence, "likely");
    assert.match(none.why ?? "", /names no address/);
  }
  /* an address of one type's system is not another type's */
  const crossed = CL.detect(ctxFor(P2, { view: VIEWS[FIRST], locator: LOCATORS[FIRST].documents }));
  assert.equal(crossed.confidence, "likely");
  assert.match(crossed.why ?? "", /its address is one of .+, not an address the active profiles name for a CourtListener docket/);
});

test("R1 R17: a page of the right address without the register's structure is not matched, with which kind of page it is", () => {
  const L = LOCATORS[FIRST];
  for (const [file, re] of NEGATIVES.courtlistener) {
    const d = CL.detect(ctxFor(fixture(file), { view: VIEWS[FIRST], locator: L.courtlistener(1) }));
    assert.equal(d.match, false, file);
    assert.equal(d.confidence, "none");
    assert.match(d.why ?? "", re, file);
  }
  for (const [file, re] of NEGATIVES.cpuc) {
    const d = CPUC.detect(ctxFor(fixture(file), { view: VIEWS[FIRST], locator: L.card }));
    assert.equal(d.match, false, file);
    assert.match(d.why ?? "", re, file);
  }
  for (const [file, re] of NEGATIVES.ecourt) {
    const d = EC.detect(ctxFor(fixture(file), { view: VIEWS[FIRST], locator: L.ecourt, origin: "member" }));
    assert.equal(d.match, false, file);
    assert.match(d.why ?? "", re, file);
  }
  /* no type matches another's register */
  /** @type {Array<[RegisterType, string, CaptureOrigin?]>} */
  const crossed = [[CL, DOCS], [CL, ROA, "member"], [CPUC, P2], [CPUC, ROA, "member"], [EC, P2, "member"], [EC, CARD, "member"]];
  for (const [type, text, origin] of crossed) {
    const d = type.detect(ctxFor(text, { view: VIEWS[FIRST], locator: L.ecourt, origin }));
    assert.equal(d.match, false, `${type.key} on another register`);
    assert.ok(d.why);
  }
  /* an empty page */
  for (const type of COURT_TYPES) {
    const d = type.detect(ctxFor("", { view: VIEWS[FIRST], origin: "member" }));
    assert.equal(d.match, false);
    assert.match(d.why ?? "", /lacks/);
  }
});

test("R2 R17: ecourt_roa matches only a member's own capture; any other origin is refused with K1492's why, and nothing is read from it", () => {
  const L = LOCATORS[FIRST];
  /** @type {Array<CaptureOrigin | undefined>} */
  const others = [undefined, null, "fetch", "daemon", "acquisition", { kind: "fetch" }, "Member"];
  for (const origin of others) {
    const d = EC.detect(ctxFor(ROA, { view: VIEWS[FIRST], locator: L.ecourt, origin }));
    assert.equal(d.match, false, JSON.stringify(origin));
    assert.match(d.why ?? "", /an account-gated register is read only from a member's own capture/);
    const r = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], locator: L.ecourt, origin }));
    assert.deepEqual(r.rows, []);
    assert.deepEqual(r.parties, []);
    assert.match(r.failed ?? "", /an account-gated register is read only from a member's own capture/);
  }
  /** @type {CaptureOrigin[]} */
  const members = ["member", { kind: "member" }];
  for (const origin of members)
    assert.equal(EC.detect(ctxFor(ROA, { view: VIEWS[FIRST], locator: L.ecourt, origin })).confidence, "certain");
});

test("R3 R16 R17: the proceeding as each page states it, its number recognised through id-spaces' proceeding space or null with why", () => {
  const view = VIEWS[FIRST], L = LOCATORS[FIRST];
  const cl = CL.parse(ctxFor(P2, { view, locator: L.courtlistener(2) }));
  assert.equal(cl.proceeding.number_as_written, "1:16-cv-00745");
  assert.equal(cl.proceeding.caption, "NATIONAL VETERANS LEGAL SERVICES PROGRAM v. United States");
  assert.equal(cl.proceeding.forum_as_written, "District Court, District of Columbia");
  assert.equal(cl.proceeding.kind_as_written, "Other Statutory Actions");
  assert.equal(cl.proceeding.filed, "April 21, 2016");
  assert.equal(cl.proceeding.status_as_written, null);
  assert.match(cl.proceeding.why?.status_as_written ?? "", /states no status/);
  assert.equal(cl.proceeding.docket_number_core, null);
  assert.match(cl.proceeding.why?.docket_number_core ?? "", /does not state/);
  const card = CPUC.parse(ctxFor(CARD, { view, locator: L.card }));
  assert.equal(card.proceeding.number_as_written, "A2106021");
  assert.match(card.proceeding.caption ?? "", /^Application of Pacific Gas and Electric Company for Authority, Among Other Things, to Increase Rates/);
  assert.equal(card.proceeding.status_as_written, "CLOSED");
  assert.equal(card.proceeding.kind_as_written, "Ratesetting");
  assert.equal(card.proceeding.filed, "June 30, 2021");
  assert.equal(card.proceeding.forum_as_written, null);
  assert.match(card.proceeding.why?.forum_as_written ?? "", /names no forum/);
  const docs = CPUC.parse(ctxFor(DOCS, { view, locator: L.documents }));
  assert.equal(docs.proceeding.number_as_written, "A2106021");
  assert.equal(docs.proceeding.caption, null);
  assert.match(docs.proceeding.why?.caption ?? "", /card's/);
  const ec = EC.parse(ctxFor(ROA, { view, locator: L.ecourt, origin: "member" }));
  assert.equal(ec.proceeding.number_as_written, "24CV000123");
  assert.equal(ec.proceeding.status_as_written, "Active");
  assert.equal(ec.proceeding.caption, "Harbour Residents Association vs. Port Ellery Harbour Commission");
  /* the number is exactly what id-spaces.recognise gives for it under the view, and each is recognised */
  for (const r of [cl, card, docs, ec]) {
    const number = r.proceeding.number;
    assert.deepEqual(number, recognise(view, "proceeding", r.proceeding.number_as_written));
    assert.ok(number, `${r.type}: ${r.proceeding.number_as_written} recognised in the first profile's proceeding space`);
    assert.equal(number.space, "proceeding");
  }
  assert.equal(cl.proceeding.number?.normal, "1:16-cv-00745");
  assert.equal(card.proceeding.number?.normal, "A2106021");
  /* under the test profile, whose forms are other shapes, the same numbers are held as written, null, with why */
  /** @type {Array<[RegisterType, string, CaptureOrigin?]>} */
  const others = [[CL, P2], [CPUC, CARD], [EC, ROA, "member"]];
  for (const [type, text, origin] of others) {
    const r = type.parse(ctxFor(text, { view: VIEWS[TEST], locator: LOCATORS[TEST].card, origin }));
    assert.equal(r.proceeding.number, null);
    assert.match(r.proceeding.why?.number ?? "", /has the shape of no form of the active profiles' proceeding space/);
  }
  /* and a number in the test profile's own form is recognised there */
  const mc = EC.parse(ctxFor(ROA.replace("24CV000123", "MC-24-0123"), { view: VIEWS[TEST], locator: LOCATORS[TEST].ecourt, origin: "member" }));
  assert.deepEqual(mc.proceeding.number, recognise(VIEWS[TEST], "proceeding", "MC-24-0123"));
  assert.ok(mc.proceeding.number);
});

test("R4 R14: parties are each name the page states with its role only as written, never mapped", () => {
  const view = VIEWS[FIRST];
  const cl = CL.parse(ctxFor(P2, { view }));
  assert.deepEqual(cl.parties.map(({ name, role_as_written }) => ({ name, role_as_written })),
    [{ name: "Paul L. Friedman", role_as_written: "Assigned To" }]);
  const card = CPUC.parse(ctxFor(CARD, { view }));
  assert.deepEqual(card.parties.map(({ name, role_as_written, assigned_as_written }) => ({ name, role_as_written, assigned_as_written })), [
    { name: "Pacific Gas and Electric Company", role_as_written: "Filed By", assigned_as_written: undefined },
    { name: "John Larsen", role_as_written: "ALJ", assigned_as_written: "Feb 15, 2022" },
    { name: "Justin Regnier", role_as_written: "ALJ", assigned_as_written: "Jan 23, 2024" },
    { name: "John Reynolds", role_as_written: "COMMISSIONER", assigned_as_written: "Feb 15, 2022" },
  ]);
  const ec = EC.parse(ctxFor(ROA, { view, origin: "member" }));
  assert.deepEqual(ec.parties.map(({ name, role_as_written }) => [name, role_as_written]), [
    ["Harbour Residents Association", "Petitioner"], ["Port Ellery Harbour Commission", "Respondent"], ["Quay Example", "Judicial Officer"]]);
  for (const r of [cl, card, ec]) for (const p of r.parties) assert.ok("source" in p);
});

test("R5 R16: every CourtListener row is read, in page order, with its date and text as written and each document link labelled, fee links marked and none followed", () => {
  /** @type {Array<[string, number]>} */
  const pages = [[P2, 2], [P4, 4]];
  for (const [html, n] of pages) {
    const r = CL.parse(ctxFor(html, { view: VIEWS[FIRST], locator: LOCATORS[FIRST].courtlistener(n) }));
    const ids = clRowIds(html);
    assert.equal(r.rows.length, ids.length, `page ${n}: every row`);
    /* page order: the numbered rows appear in the reading in the order of their div ids */
    assert.deepEqual(r.rows.filter((x) => x.entry_id).map((x) => `entry-${x.entry_id}`), ids.filter((x) => !x.startsWith("minute")));
    for (const row of r.rows) {
      assert.deepEqual(Object.keys(row).sort(), ["date", "documents", "entry_id", "filer", "key", "kind_as_written", "links", "sealing", "source", "text"].sort());
      assert.match(row.date ?? "", /^[A-Z][a-z]{2} [0-9]{1,2}, [0-9]{4}$/, "a date as written");
      assert.ok(row.text || row.documents.length, "a text or a document");
      assert.equal(row.filer, null);
      assert.equal(row.kind_as_written, null);
      for (const l of row.links) {
        assert.ok(l.label && l.href);
        /* fee-bearing: a purchase, or a price above zero, as the label states it */
        const priced = [...l.label.matchAll(/\$([0-9.]+)/g)].some((m) => Number(m[1]) > 0);
        assert.equal(l.fee, /^Buy on PACER/.test(l.label) || priced, l.label);
      }
    }
  }
  const r = CL.parse(ctxFor(P2, { view: VIEWS[FIRST] }));
  const e73 = r.rows.find((x) => x.entry_id === "73");
  assert.ok(e73);
  assert.equal(e73.date, "Nov 17, 2017");
  const text73 = e73.text;
  assert.equal(text73, "Cross MOTION for Summary Judgment by UNITED STATES OF AMERICA (Attachments: # 1 Memorandum in Support, # 2 Declaration Decl. of W. Skidgel, # 3 Statement of Facts, # 4 Text of Proposed Order)(Field, Brian) (Entered: 11/17/2017)");
  assert.match(text73 ?? "", /\(Entered: 11\/17\/2017\)$/, "the Entered stamp stays in the text");
  assert.deepEqual(e73.links.filter((l) => l.document === "Main Document").map((l) => [l.label, l.fee]),
    [["Main Document", false], ["Download PDF", false], ["From Internet Archive", false], ["Buy on PACER ($0.10)", true]]);
  assert.equal(e73.links.find((l) => l.fee)?.href, "https://ecf.dcd.uscourts.gov/doc1/04506311432?caseid=178502");
  assert.deepEqual([...new Set(e73.links.map((l) => l.document))], ["Main Document", "Attachment 1", "Attachment 2", "Attachment 3", "Attachment 4"]);
});

test("R5 R16: every CPUC report row is read with its date, type, filer and description as written and its document link", () => {
  const r = CPUC.parse(ctxFor(DOCS, { view: VIEWS[FIRST], locator: LOCATORS[FIRST].documents }));
  const dataRows = (DOCS.match(/<td\b[^>]*headers="FILING_DATE"/g) || []).length;
  assert.equal(r.rows.length, dataRows);
  assert.equal(r.rows.length, 100);
  for (const row of r.rows) {
    const kind = row.kind_as_written;
    assert.ok(row.date && kind && row.filer && row.text, row.key);
    assert.equal(row.links.length, 1);
    const link = row.links[0];
    assert.ok(link);
    assert.equal(link.label, kind);
    assert.match(link.href, /^https:\/\/docs\.cpuc\.ca\.gov\/SearchRes\.aspx\?DocFormat=ALL&DocID=[0-9]+$/);
    assert.equal(link.fee, false);
  }
  assert.deepEqual(r.rows.slice(0, 2).map(({ date, kind_as_written, filer, text }) => ({ date, kind_as_written, filer, text })), [
    { date: "July 27, 2026", kind_as_written: "EXPARTE", filer: "CMMR/JOHN_REYNOLDS/CPUC", text: "DECISIONMAKER NOTICE OF EX PARTE COMMUNICATION." },
    { date: "July 21, 2026", kind_as_written: "COMMENTS", filer: "CAL ADVOCATES/CAPONE/CPUC", text: "COMMENTS ON PG&E COMPANY'S 2025 RISK SPENDING ACCOUNTABILITY REPORT." },
  ]);
  const decision = r.rows.find((x) => x.date === "February 26, 2026");
  assert.ok(decision);
  assert.equal(decision.filer, "-", "the register's own dash, as written");
  assert.equal(decision.text, "Decision D2602035 - Decision Closing Proceeding. Application 21-06-021 is closed.");
});

test("R5 R7 R16: the fictional eCourt register (marked so) is read row by row, its paid document links marked", () => {
  assert.match(ROA, /FICTIONAL FIXTURE, marked as such/);
  const r = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], locator: LOCATORS[FIRST].ecourt, origin: "member" }));
  assert.deepEqual(r.rows.map((x) => [x.key, x.date, x.text]), [
    ["03/04/2024#1", "03/04/2024", "Petition for Writ of Mandate filed by Harbour Residents Association."],
    ["03/04/2024#2", "03/04/2024", "Civil Case Cover Sheet filed by Harbour Residents Association."],
    ["03/04/2024#3", "03/04/2024", "Summons Issued."],
    ["04/11/2024#1", "04/11/2024", "Answer filed by Port Ellery Harbour Commission."],
    ["05/20/2024#1", "05/20/2024", "Motion to File Under Seal filed by Port Ellery Harbour Commission."],
    ["06/14/2024#1", "06/14/2024", "Order granting Motion to File Under Seal. Exhibit B lodged conditionally under seal."],
    ["06/14/2024#2", "06/14/2024", "Minute Order: Hearing on Motion held; matter taken under submission."],
    ["09/02/2024#1", "09/02/2024", "Exhibit B unsealed by order of the court."],
  ]);
  assert.deepEqual(r.rows[0]?.links.map((l) => [l.label, l.fee]), [["Purchase ($1.00 per page)", true], ["Preview", false]]);
  for (const row of r.rows) assert.equal(row.entry_id, null);
});

test("R6 R17: keys per register, key_basis saying how; entry_id only where CourtListener assigns an entry number", () => {
  const cl = CL.parse(ctxFor(P2, { view: VIEWS[FIRST] }));
  assert.match(cl.key_basis, /entry number/);
  assert.match(cl.key_basis, /date and its text/);
  const numbered = cl.rows.filter((x) => x.entry_id), minute = cl.rows.filter((x) => !x.entry_id);
  assert.equal(numbered.length, 51);
  assert.equal(minute.length, 49);
  for (const x of numbered) assert.equal(x.key, `entry:${x.entry_id}`);
  for (const x of minute) {
    assert.ok(x.key.startsWith(`minute:${x.date}|`), x.key);
    assert.equal(x.entry_id, null);
  }
  const noText = minute.find((x) => x.date === "Dec 6, 2017");
  assert.ok(noText);
  assert.equal(noText.text, null);
  assert.equal(noText.key, "minute:Dec 6, 2017|Memorandum in opposition to motion");
  /* every key is distinct on a reading */
  for (const r of [cl, CPUC.parse(ctxFor(DOCS, { view: VIEWS[FIRST] })), EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], origin: "member" }))])
    assert.equal(new Set(r.rows.map((x) => x.key)).size, r.rows.length, r.type);
  const docs = CPUC.parse(ctxFor(DOCS, { view: VIEWS[FIRST] }));
  assert.match(docs.key_basis, /composite of its filing date, document type, filer and description/);
  for (const x of docs.rows) {
    assert.equal(x.entry_id, null);
    assert.equal(x.key, [x.date, x.kind_as_written, x.filer, x.text, x.links[0]?.href].join("|"));
  }
  const ec = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], origin: "member" }));
  assert.match(ec.key_basis, /date as written and its order among the rows of that date/);
  /* twins: two rows written identically on one reading are both kept, told apart by order */
  const twin = DOCS.replace(/(<tr >[\s\S]*?<\/tr>)/, "$1$1");
  const t = CPUC.parse(ctxFor(twin, { view: VIEWS[FIRST] }));
  assert.equal(t.rows.length, 101);
  assert.equal(t.rows[1]?.key, `${t.rows[0]?.key}#2`);
});

test("R7: every ecourt_roa reading is provisional and says why; the other two are not", () => {
  const ec = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], origin: "member" }));
  assert.equal(ec.provisional, true);
  assert.match(ec.key_basis, /PROVISIONAL/);
  assert.match(ec.key_basis, /assumed from the portal's own description/);
  assert.match(ec.key_basis, /not yet verified on a member's capture/);
  const refused = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST] }));
  assert.equal(refused.provisional, true);
  for (const r of [CL.parse(ctxFor(P2, { view: VIEWS[FIRST] })), CL.parse(ctxFor(P4, { view: VIEWS[FIRST] })),
    CPUC.parse(ctxFor(CARD, { view: VIEWS[FIRST] })), CPUC.parse(ctxFor(DOCS, { view: VIEWS[FIRST] }))])
    assert.equal(r.provisional, false);
});

test("R8 R17: page as the register's pagination states it; complete only when the reading holds every row the register has", () => {
  const p2 = CL.parse(ctxFor(P2, { view: VIEWS[FIRST] }));
  assert.deepEqual(p2.page, { n: 2, of: 4, may_continue: true });
  assert.equal(p2.complete, false);
  assert.match(p2.complete_why ?? "", /page 2 of the register's 4/);
  const p4 = CL.parse(ctxFor(P4, { view: VIEWS[FIRST] }));
  assert.deepEqual(p4.page, { n: 4, of: 4, may_continue: false });
  assert.equal(p4.complete, false, "the last page of four is not the register");
  const one = CL.parse(ctxFor(P4.replace(/\(Page\s+4\s+of\s+4\)/, "(Page 1 of 1)").replace(/Page<\/span>\s*4 of 4/, "Page</span> 1 of 1"), { view: VIEWS[FIRST] }));
  assert.deepEqual(one.page, { n: 1, of: 1, may_continue: false });
  assert.equal(one.complete, true);
  const docs = CPUC.parse(ctxFor(DOCS, { view: VIEWS[FIRST] }));
  assert.deepEqual(docs.page, { n: 1, of: 6, may_continue: true });
  assert.equal(docs.complete, false);
  assert.match(docs.complete_why ?? "", /590 rows/);
  const all = CPUC.parse(ctxFor(DOCS.replace(/1 -\s+100 of\s+590/, "1 - 100 of 100"), { view: VIEWS[FIRST] }));
  assert.deepEqual(all.page, { n: 1, of: 1, may_continue: false });
  assert.equal(all.complete, true);
  const ec = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], origin: "member" }));
  assert.deepEqual(ec.page, { n: 1, of: 1, may_continue: false });
  assert.equal(ec.complete, true);
  const unstated = EC.parse(ctxFor(ROA.replace(/<div class="pager">[^<]*<\/div>/, ""), { view: VIEWS[FIRST], origin: "member" }));
  assert.equal(unstated.complete, false);
  assert.match(unstated.complete_why ?? "", /states no pagination/);
  const card = CPUC.parse(ctxFor(CARD, { view: VIEWS[FIRST] }));
  assert.equal(card.complete, false);
  assert.match(card.complete_why ?? "", /no documents report/);
});

test("R9 R14: sealing is what a row's text states (sealed, unsealed or null), never a finding", () => {
  const p2 = CL.parse(ctxFor(P2, { view: VIEWS[FIRST] }));
  const stated = p2.rows.filter((x) => x.sealing).map((x) => [x.entry_id ?? x.date, x.sealing]);
  assert.deepEqual(stated, [["Jan 7, 2021", "unsealed"], ["117", "sealed"], ["Sep 8, 2021", "unsealed"]]);
  for (const x of p2.rows) assert.ok(["sealed", "unsealed", null].includes(x.sealing));
  assert.deepEqual(CL.parse(ctxFor(P4, { view: VIEWS[FIRST] })).rows.filter((x) => x.sealing), []);
  const ec = EC.parse(ctxFor(ROA, { view: VIEWS[FIRST], origin: "member" }));
  assert.deepEqual(ec.rows.map((x) => x.sealing), [null, null, null, null, null, "sealed", null, "unsealed"],
    "a motion to file under seal states nothing sealed; the order granting it does; an unsealing does");
});

test("R13 R15: pure and place-free: the same inputs give the same reading, the clock and the network untouched, and only the view decides an address or a number", (t) => {
  const realNow = Date.now;
  Date.now = () => { throw new Error("the clock was read"); };
  t.mock.method(globalThis, "fetch", () => { throw new Error("the network was used"); });
  try {
    /** @type {Array<[RegisterType, string, CaptureOrigin?]>} */
    const cases = [[CL, P2], [CPUC, DOCS], [CPUC, CARD], [EC, ROA, "member"]];
    for (const [type, text, origin] of cases) {
      const c = ctxFor(text, { view: VIEWS[FIRST], locator: LOCATORS[FIRST].documents, origin });
      assert.deepEqual(type.parse(c), type.parse({ ...c }));
      assert.deepEqual(type.detect(c), type.detect({ ...c }));
    }
  } finally { Date.now = realNow; t.mock.restoreAll(); }
  /* the at the caller gives is carried, never composed */
  assert.equal(CL.parse(ctxFor(P4, { view: VIEWS[FIRST], at: "2026-10-05T22:05:00Z" })).at, "2026-10-05T22:05:00Z");
  assert.equal(CL.parse(ctxFor(P4, { view: VIEWS[FIRST] })).at, null);
});

test("R17: a position is only what ctx.locate answers for where a part was read, never composed", () => {
  /** @type {unknown[]} */
  const seen = [];
  /** @type {ReadingPosition} */
  const here = { kind: "doc-para", ref: "¶1", para: 0, run: null };
  const locate = (/** @type {unknown} */ offset) => { seen.push(offset); return typeof offset === "number" && offset < 50000 ? here : null; };
  const r = CL.parse(ctxFor(P4, { view: VIEWS[FIRST], locate }));
  assert.ok(seen.length > r.rows.length);
  for (const x of r.rows) { const source = x.source; assert.ok(source === null || source.ref === "¶1"); }
  assert.equal(CL.parse(ctxFor(P4, { view: VIEWS[FIRST] })).rows.every((x) => x.source === null), true);
});

test("R1 R2: the three types are registered through docprofile's seam in order, each with its contract and shape", () => {
  assert.deepEqual(KEYS, ["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"]);
  /** @type {RegisterType[]} */
  const got = [];
  const out = registerCourtTypes((t) => { got.push(t); return t.key; });
  assert.deepEqual(got.map((t) => t.key), KEYS);
  assert.deepEqual(out.map((o) => [o.key, o.registered, o.registered ? o.result : undefined]), KEYS.map((k) => [k, true, k]));
  for (const t of got) {
    assert.equal(t.contract, CONTRACT.MEMBERSHIP);
    assert.equal(typeof t.label, "string");
    assert.equal(t.version, 1);
    assert.equal(typeof t.detect, "function");
    assert.equal(typeof t.parse, "function");
    assert.equal(typeof t.assess, "function");
  }
  const refused = registerCourtTypes(() => { throw new Error("refused"); });
  assert.deepEqual(refused.map((o) => o.registered), [false, false, false]);
  assert.equal(registerCourtTypes(null).every((o) => !o.registered && o.why), true);
});
