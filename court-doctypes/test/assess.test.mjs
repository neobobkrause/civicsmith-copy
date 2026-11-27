/* court-doctypes: `assess(before, after)`, the register row diff (R10–R12, R13, R14), over the captured
 * registers and edits of them a register really makes (a row added, removed, corrected; a status moved). */
import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, event } from "../../docprofile/registry.mjs";
import { courtlistenerDocket as CL, cpucProceeding as CPUC, ecourtRoa as EC } from "../index.mjs";
import { fixture, viewFor, LOCATORS, ctxFor, FIRST } from "./helpers.mjs";
/** @import { RegisterAssessment, RegisterReading } from "../common.mjs" */

const VIEW = viewFor(FIRST);
const L = LOCATORS[FIRST];
const P4 = fixture("courtlistener-4214664-p4.html");
const CARD = fixture("cpuc-A2106021-card.html");
const DOCS = fixture("cpuc-A2106021-documents-p1.html");
const ROA = fixture("ecourt-roa-FICTIONAL.html");

const cl = (/** @type {string} */ html) => CL.parse(ctxFor(html, { view: VIEW, locator: L.courtlistener(4) }));
const cp = (/** @type {string} */ html) => CPUC.parse(ctxFor(html, { view: VIEW, locator: L.documents }));
const ec = (/** @type {string} */ html) => EC.parse(ctxFor(html, { view: VIEW, locator: L.ecourt, origin: "member" }));
const types = (/** @type {RegisterAssessment} */ r) => r.events.map((e) => e.type);
const onePage = (/** @type {string} */ html) => html.replace(/\(Page\s+4\s+of\s+4\)/, "(Page 1 of 1)").replace(/Page<\/span>\s*4 of 4/, "Page</span> 1 of 1");

/** The i-th of a list, which the test expects to be there.
 *  @template T
 *  @param {ReadonlyArray<T>} list
 *  @param {number} i
 *  @returns {T} */
function nth(list, i) {
  const x = list[i];
  assert.ok(x !== undefined, `item ${i} is there`);
  return x;
}

/** A CourtListener row div, balanced, by its id.
 *  @param {string} html
 *  @param {string} id
 *  @returns {{ open: number, end: number, text: string }} */
function clRow(html, id) {
  const start = html.indexOf(`id="${id}"`);
  const open = html.lastIndexOf("<div", start);
  let depth = 0;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = open;
  for (;;) {
    const m = re.exec(html);
    if (!m) break;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { open, end: m.index + m[0].length, text: html.slice(open, m.index + m[0].length) };
  }
  throw new Error("unbalanced");
}
/* The CPUC report's data rows. */
const cpucRows = (/** @type {string} */ html) => html.match(/<tr >[\s\S]*?<\/tr>/g) || [];

test("R10: two readings that differ only in page order, white space and text-free markup give nothing", () => {
  /* white space and empty markup in a CourtListener page */
  const respaced = P4.replace(/<p>([^<]{20,}?) /g, "<p>$1 <span class=\"x\"></span>\n   ").replace(/\n/g, "\n\n");
  let r = CL.assess(cl(P4), cl(respaced));
  assert.deepEqual(r.events, []);
  assert.equal(r.meaningful, false);
  assert.match(r.why, /all 27 rows of this register are unchanged/);
  assert.deepEqual(r.confirmed, { rows: 27, intact: 27 });
  /* the CPUC report sorted the other way */
  const rows = cpucRows(DOCS);
  const reversed = DOCS.replace(rows.join(""), [...rows].reverse().join(""));
  r = CPUC.assess(cp(DOCS), cp(reversed));
  assert.deepEqual(r.events, []);
  assert.equal(r.meaningful, false);
  /* a header field that moves on every refresh (Last Updated) is not the register */
  r = CL.assess(cl(P4), cl(P4.replace("Aug. 8, 2026, 12:38 p.m.", "Oct. 5, 2026, 9:01 a.m.")));
  assert.deepEqual(r.events, []);
});

test("R10: a row added gives item_added (routine), naming the row", () => {
  const last = clRow(P4, "entry-178");
  const added = last.text.replace(/entry-178/g, "entry-179").replace(/<p>178<\/p>/, "<p>179</p>")
    .replace(/<p>([^<]*)<\/p>(\s*<\/div>\s*<div class="col-xs-8)/, "<p>Jul 1, 2026</p>$2");
  const after = P4.slice(0, last.end) + added + P4.slice(last.end);
  const r = CL.assess(cl(P4), cl(after));
  assert.deepEqual(types(r), ["item_added"]);
  assert.equal(nth(r.events, 0).key, "entry:179");
  assert.equal(nth(r.events, 0).entry_id, "179");
  assert.equal(nth(r.events, 0).significance, "routine");
  assert.equal(r.meaningful, false);
  assert.match(r.why, /1 row\(s\) added/);
});

test("R10: a row gone is delisted only when both readings are complete, possibly_delisted otherwise", () => {
  const row = clRow(P4, "entry-170");
  const without = P4.slice(0, row.open) + P4.slice(row.end);
  let r = CL.assess(cl(P4), cl(without));
  assert.deepEqual(types(r), ["possibly_delisted"], "page 4 of 4 is not the whole register");
  assert.equal(nth(r.events, 0).key, "entry:170");
  assert.match(nth(r.events, 0).why, /neither reading holds the whole register/);
  assert.equal(r.meaningful, true);
  r = CL.assess(cl(onePage(P4)), cl(onePage(without)));
  assert.deepEqual(types(r), ["delisted"]);
  assert.match(nth(r.events, 0).why, /both readings hold the whole register/);
  r = CL.assess(cl(onePage(P4)), cl(without));
  assert.deepEqual(types(r), ["possibly_delisted"], "one complete reading is not two");
});

test("R10: a held row whose date, text, links or sealing changed gives outcome_changed naming the row and the field", () => {
  const row = clRow(P4, "entry-170");
  const edit = (/** @type {(text: string) => string} */ f) => P4.slice(0, row.open) + f(row.text) + P4.slice(row.end);
  /* the text */
  let r = CL.assess(cl(P4), cl(edit((t) => t.replace(/(<div class="col-xs-8 col-lg-7">\s*<p>)/, "$1CORRECTED: "))));
  assert.deepEqual(r.events.map((e) => [e.type, e.key, e.field]), [["outcome_changed", "entry:170", "text"]]);
  assert.match(String(nth(r.events, 0).now), /^CORRECTED: /);
  assert.equal(r.meaningful, true);
  /* the date */
  const date170 = cl(P4).rows.find((x) => x.entry_id === "170")?.date ?? "";
  r = CL.assess(cl(P4), cl(edit((t) => t.replace(date170, "Jan 1, 2030"))));
  assert.deepEqual(r.events.map((e) => [e.type, e.field]), [["outcome_changed", "date"]]);
  assert.equal(nth(r.events, 0).now, "Jan 1, 2030");
  /* a document link withdrawn */
  const linked = cl(P4).rows.find((x) => x.links.length && x.entry_id);
  assert.ok(linked);
  const lrow = clRow(P4, `entry-${linked.entry_id}`);
  const href = nth(linked.links, 1).href;
  const withdrawn = P4.slice(0, lrow.open) + lrow.text.split(href).join("#") + P4.slice(lrow.end);
  r = CL.assess(cl(P4), cl(withdrawn));
  assert.deepEqual(r.events.map((e) => [e.type, e.key, e.field]), [["outcome_changed", `entry:${linked.entry_id}`, "links"]]);
  const { was, now } = nth(r.events, 0);
  assert.ok(Array.isArray(was) && Array.isArray(now));
  assert.ok(was.some((l) => "href" in l && l.href === href) && !now.some((l) => "href" in l && l.href === href));
  /* sealing, as the row now states it: the text moves and the sealing with it */
  r = CL.assess(cl(P4), cl(edit((t) => t.replace(/(<div class="col-xs-8 col-lg-7">\s*<p>)/, "$1SEALED DOCUMENT. "))));
  assert.deepEqual(r.events.map((e) => e.field).sort(), ["sealing", "text"]);
  assert.deepEqual(r.events.find((e) => e.field === "sealing")?.now, "sealed");
  /* the filer and the kind, on a register that states them */
  const rows = cpucRows(DOCS);
  r = CPUC.assess(cp(DOCS), cp(DOCS.replace(nth(rows, 3), nth(rows, 3).replace("Small Business Utility Advocates", "Small Business Utility Advocates (SBUA)"))));
  assert.ok(types(r).every((t) => t === "possibly_delisted" || t === "item_added"), "a CPUC key field: see R11");
  const roa = ROA.replace("Summons Issued.", "Summons Issued as to all respondents.");
  r = EC.assess(ec(ROA), ec(roa));
  assert.deepEqual(r.events.map((e) => [e.type, e.key, e.field]), [["outcome_changed", "03/04/2024#3", "text"]]);
});

test("R10: the proceeding's status gives status_changed; its caption or a party gives item_changed", () => {
  const card = (/** @type {string} */ h) => CPUC.parse(ctxFor(h, { view: VIEW, locator: L.card }));
  let r = CPUC.assess(card(CARD), card(CARD.replace(">CLOSED<", ">OPEN<")));
  assert.deepEqual(r.events.map((e) => [e.type, e.field, e.was, e.now]), [["status_changed", "status_as_written", "CLOSED", "OPEN"]]);
  assert.equal(r.meaningful, true);
  r = CPUC.assess(card(CARD), card(CARD.replace("(U39M)</span>", "(U39M) (amended)</span>")));
  assert.deepEqual(r.events.map((e) => [e.type, e.field]), [["item_changed", "caption"]]);
  assert.equal(r.meaningful, false);
  r = CPUC.assess(card(CARD), card(CARD.replace("ALJ: Justin Regnier (Assigned Jan 23, 2024)<br />", "")));
  assert.deepEqual(r.events.map((e) => [e.type, e.field, e.was, e.now]), [["item_changed", "parties", "Justin Regnier", null]]);
  r = CL.assess(cl(P4), cl(P4.replace(/>Paul L. Friedman<\/a>/, ">Ellen S. Huvelle</a>")));
  assert.deepEqual(r.events.map((e) => [e.type, e.field, e.party]).sort(), [["item_changed", "parties", "Ellen S. Huvelle"], ["item_changed", "parties", "Paul L. Friedman"]]);
  /* a terminated case, as the page states it */
  const terminated = P4.replace(/(<p class="bottom">\s*<span class="meta-data-header">Date Filed:)/,
    '<p class="bottom"><span class="meta-data-header">Date Terminated:</span><span class="meta-data-value">May 1, 2026</span></p>$1');
  r = CL.assess(cl(P4), cl(terminated));
  assert.deepEqual(r.events.map((e) => [e.type, e.now]), [["status_changed", "Date Terminated: May 1, 2026"]]);
  r = EC.assess(ec(ROA), ec(ROA.replace("<dd>Active</dd>", "<dd>Disposed</dd>")));
  assert.deepEqual(types(r), ["status_changed"]);
});

test("R11: under the CPUC composite key an edited key field reads as one row gone and one added, reported together, each naming the other", () => {
  const rows = cpucRows(DOCS);
  const target = nth(rows, 5);
  const edited = target.replace("Decision Closing Proceeding.", "Decision Closing Proceeding (corrected).");
  const before = cp(DOCS), after = cp(DOCS.replace(target, edited));
  const r = CPUC.assess(before, after);
  assert.deepEqual(types(r).sort(), ["item_added", "possibly_delisted"]);
  const gone = r.events.find((e) => e.type === "possibly_delisted"), added = r.events.find((e) => e.type === "item_added");
  assert.ok(gone && added);
  assert.equal(gone.counterpart, added.key);
  assert.equal(added.counterpart, gone.key);
  assert.match(gone.why, /likely this row with a key field edited/);
  assert.match(added.why, /likely the row no longer listed/);
  assert.equal(r.events.filter((e) => e.type === "outcome_changed").length, 0, "never paired silently into one changed or unchanged row");
  /* each key field: date, type, filer, description */
  /** @type {Array<[string, string]>} */
  const keyEdits = [["February 26, 2026", "February 27, 2026"], [">DECISION<", ">RULING<"], ["headers=\"FILED_BY\">-<", "headers=\"FILED_BY\">CPUC<"]];
  for (const [was, now] of keyEdits) {
    const x = CPUC.assess(before, cp(DOCS.replace(target, target.replace(was, now))));
    assert.deepEqual(types(x).sort(), ["item_added", "possibly_delisted"], now);
    assert.ok(x.events.every((e) => e.counterpart), now);
  }
  /* a row genuinely gone and an unrelated one added are not paired */
  const other = nth(rows, 40);
  const swapped = DOCS.replace(target, "").replace(other, other + other.replace(/DocID=[0-9]+/, "DocID=1").replace(/<td class=" u-tL" headers="DESCRIPTION">[^<]*/, '<td class=" u-tL" headers="DESCRIPTION">A new unrelated filing').replace(/headers="FILING_DATE">[^<]*/, 'headers="FILING_DATE">August 1, 2026').replace(/headers="FILED_BY">[^<]*/, 'headers="FILED_BY">Someone Else'));
  const y = CPUC.assess(before, cp(swapped));
  assert.deepEqual(types(y).sort(), ["item_added", "possibly_delisted"]);
  assert.ok(y.events.every((e) => !e.counterpart));
});

test("R12 R17: no row read, or a failed reading, is a failed read with why, never a register emptied", () => {
  const emptied = DOCS.replace(cpucRows(DOCS).join(""), "");
  /** @type {Array<[RegisterReading, RegisterReading]>} */
  const pairs = [[cp(DOCS), cp(emptied)], [cp(emptied), cp(DOCS)], [cp(emptied), cp(emptied)]];
  for (const [a, b] of pairs) {
    const r = CPUC.assess(a, b);
    assert.equal(r.meaningful, null);
    assert.deepEqual(r.events, []);
    assert.match(r.why, /never a register emptied/);
  }
  const login = fixture("courtlistener-sign-in.html");
  let r = CL.assess(cl(P4), cl(login));
  assert.equal(r.meaningful, null);
  assert.deepEqual(r.events, []);
  assert.match(r.why, /a reading failed/);
  /* an eCourt capture that is not a member's own fails, and its absence of rows removes nothing */
  r = EC.assess(ec(ROA), EC.parse(ctxFor(ROA, { view: VIEW, locator: L.ecourt })));
  assert.equal(r.meaningful, null);
  assert.match(r.why, /a member's own capture/);
  /* two readings of different proceedings are not one register */
  r = EC.assess(ec(ROA), ec(ROA.replace("24CV000123", "24CV000999")));
  assert.equal(r.meaningful, null);
  assert.match(r.why, /different proceedings/);
  /* and of different registers' types */
  r = CL.assess(cl(P4), cp(DOCS));
  assert.equal(r.meaningful, null);
  /* a CPUC card holds no rows: two card readings compare the proceeding only, and claim nothing about rows */
  const card = (/** @type {string} */ h) => CPUC.parse(ctxFor(h, { view: VIEW, locator: L.card }));
  r = CPUC.assess(card(CARD), card(CARD));
  assert.equal(r.meaningful, false);
  assert.deepEqual(r.events, []);
  assert.equal(r.confirmed, null);
});

test("R13 R14: assess is pure and states only the register: catalogue events, nothing registered, no filing or order event written", () => {
  const realNow = Date.now;
  Date.now = () => { throw new Error("the clock was read"); };
  const row = clRow(P4, "entry-170");
  const before = cl(onePage(P4)), after = cl(onePage(P4.slice(0, row.open) + P4.slice(row.end)));
  const snapshot = JSON.stringify([before, after]);
  /** @type {RegisterAssessment} */
  let r;
  try { r = CL.assess(before, after); } finally { Date.now = realNow; }
  assert.equal(JSON.stringify([before, after]), snapshot, "the readings are not changed");
  assert.deepEqual(CL.assess(before, after), r);
  for (const e of r.events) {
    assert.ok(Object.hasOwn(EVENTS, e.type), e.type);
    assert.equal(e.significance, event(e.type).significance);
  }
  assert.deepEqual(Object.keys(r).sort(), ["confirmed", "events", "meaningful", "significance", "why"]);
  /* a row the page does not hold is never read as something that did not happen: on an incomplete pair it
     is possibly_delisted, and nothing beyond what the rows state is given */
  const partial = CL.assess(cl(P4), cl(P4.slice(0, row.open) + P4.slice(row.end)));
  assert.deepEqual(types(partial), ["possibly_delisted"]);
  for (const x of cl(P4).rows) for (const v of [x.date, x.text]) assert.ok(v === null || typeof v === "string");
});
