/* docprofile — requirement-named tests (T2-11; re-pointed to stub types by T34-8), at
 * the module's interface only: everything is reached through `docprofile/registry.mjs`,
 * the entry the plane imports. Every live id is named in at least one test title, and each
 * test checks the requirement whole over the inputs that decide it. The ids that moved to
 * `site-profiles` at the split (R1–R3, R7–R10, R26–R28, K746) are tested there, and the
 * content types' own shares (R6; R14, R15, R20, R29–R34's) are `doctypes`' (T33-12).
 *
 * This module holds no content type (R36): the types read here are ./stubs.mjs's,
 * registered through the seam as `plane` registers `doctypes`'. The shared helpers they
 * read through are exercised under two made-up jurisdictions, neither of them Oakland
 * (R30): Port Alder and Lakemont in ./fixtures.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as dp from "../registry.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { PORT_ALDER, LAKEMONT, view, EMPTY, HELD, PA_ITEMS, PA_ITEMS_PAGES, calendarHtml, shellHtml } from "./fixtures.mjs";
import { registerStubs, stubMeetings, stubItems, stubFallback } from "./stubs.mjs";

const {
  identify, doctypeFor, assess, readText, flattenText, makeLocator, registerDoctype,
  profileRecord, CONFIDENCE, CONTRACT, EVENTS, event, worstSignificance, doctypes,
} = dp;

for (const r of registerStubs(registerDoctype)) assert.equal(r.ok, true);

const PA = view(PORT_ALDER);
const LK = view(LAKEMONT);
const enc = (s) => new TextEncoder().encode(s);
const sha256 = async (b) => createHash("sha256").update(b).digest("hex");
const LADDER = new Set(Object.values(CONFIDENCE));
const keys = (r) => r.entities.map((e) => e.key);
const NOW = "2026-03-20T12:00:00Z";
const ROW = ["1", "Harbor Commission", "3/3/2026"];
const CAL = calendarHtml([ROW]);
const ITEMS_LIKELY = "ITEMS for the week\nfile PA-104";

/* ----------------------------------------------------------------- doctypeFor */

test("R4 doctypeFor returns the first CERTAIN type in registration order, else the highest match, else the registered fallback at NONE", () => {
  assert.deepEqual(doctypes().map((t) => t.key), ["stub_meetings", "stub_items", "stub_fallback"]);
  const cert = (text, v) => doctypeFor({ text, view: v });
  assert.deepEqual([cert(CAL).type, cert(CAL).confidence], [stubMeetings, CONFIDENCE.CERTAIN]);
  assert.deepEqual([cert(PA_ITEMS, PA).type, cert(PA_ITEMS, PA).confidence], [stubItems, CONFIDENCE.CERTAIN]);
  // no CERTAIN: the likely match wins (Lakemont's view names no Port Alder masthead)
  assert.deepEqual([cert(ITEMS_LIKELY, PA).type, cert(ITEMS_LIKELY, PA).confidence], [stubItems, CONFIDENCE.LIKELY]);
  const lk = cert(PA_ITEMS, LK);
  assert.equal(lk.confidence, CONFIDENCE.NONE, "a masthead the view does not name is no masthead");
  // two CERTAIN: the one registered first wins, the other is in `also` (R5)
  const both = cert(CAL + "\n" + PA_ITEMS, PA);
  assert.equal(both.type, stubMeetings);
  assert.deepEqual(both.considered.map((c) => c.key), ["stub_meetings"], "the walk stops at the first CERTAIN");
  // nothing: the registered fallback, NONE, and why
  const g = cert("a letter about nothing in particular", PA);
  assert.deepEqual([g.type, g.confidence, g.signals], [stubFallback, CONFIDENCE.NONE, []]);
  assert.equal(g.why, localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described"));
  // every confidence the content-type axis answers is on site-profiles' one ladder (R4's "its R3, R4")
  for (const [t, v] of [[CAL], [PA_ITEMS, PA], [ITEMS_LIKELY, PA], ["plain"], [CAL + PA_ITEMS, PA]]) {
    const dt = cert(t, v);
    assert.ok(LADDER.has(dt.confidence), `type confidence ${dt.confidence}`);
    for (const c of [...dt.considered, ...dt.also.filter((x) => !x.error)]) assert.ok(LADDER.has(c.confidence));
  }
});

test("R5 also names every other non-fallback type that matches, and a throwing detect as an error entry", () => {
  const text = CAL + "\n" + PA_ITEMS;
  const r = doctypeFor({ text, view: PA });
  assert.deepEqual(r.also, [{ key: "stub_items", confidence: CONFIDENCE.CERTAIN, signals: ["masthead ×3"] }]);
  // exactly the types whose own detect matches: never the winner, never the fallback
  for (const [t, v] of [[text, PA], [ITEMS_LIKELY, PA], [CAL], ["plain"]]) {
    const d = doctypeFor({ text: t, view: v });
    const want = doctypes().filter((x) => x !== d.type && !x.fallback && x.detect({ text: t, view: v }).match).map((x) => x.key);
    assert.deepEqual(d.also.map((x) => x.key), want);
  }
  // a detect that throws during the also pass: reported, never dropped, never propagated.
  // `text` answers the first read (stub_meetings', CERTAIN, which stops the first pass) and throws after.
  let reads = 0;
  const ctx = { view: PA, get text() { if (reads++ === 0) return CAL; throw new Error("unreadable"); } };
  const t = doctypeFor(ctx);
  assert.equal(t.type, stubMeetings);
  assert.deepEqual(t.also, [{ key: "stub_items", confidence: null, signals: [], error: "unreadable" }]);
  // the reader is handed the same list (readText's ctx.alsoSatisfies), and alsoSatisfies reads it
  assert.equal(registerDoctype({ ...stubItems, key: "stub_also_probe",
    detect: (c) => (String(c.text).includes("ALSOSEE") ? { match: true, confidence: CONFIDENCE.CERTAIN } : { match: false }),
    parse: (c) => ({ entities: [], facts: { handed: c.alsoSatisfies(), read: dp.alsoSatisfies(c, "stub_also_probe") } }) }).ok, true);
  const probe = readText("ALSOSEE\n" + ITEMS_LIKELY, { view: PA });
  assert.equal(probe.doctype.type.key, "stub_also_probe");
  assert.deepEqual(probe.parsed.facts, { handed: ["stub_items"], read: ["stub_items"] });
  assert.deepEqual(dp.alsoSatisfies({}, "x"), [], "a reader called directly gets an honest empty list");
});

/* --------------------------------------------------------------------- assess */

const calCtx = (extra) => ({ sha256, locator: "https://r.test/Calendar.aspx", now: NOW, view: PA, ...extra });
const likelyStack = (s) => `<html><body><main><p>${s}</p><a href="/x">x</a></main></body></html>`;

test("R11 assess runs L1 to L6 in order, stops when one decides, and carries stopped_at and the trail", async () => {
  const order = ["L1_stack", "L2_bytes", "L3_noteworthy", "L4_content_type", "L5_meaning", "L6_connections"];
  const idx = (l) => order.indexOf(l);
  const same = enc(CAL);
  const runs = {
    identical: await assess(same, same, calCtx()),
    unchanged: await assess(enc(calendarHtml([ROW], { state: "a" })), enc(calendarHtml([ROW], { state: "b" })), calCtx()),
    restyled: await assess(enc(CAL.replace("site header", "new header")), same, calCtx()),
    undetermined: await assess(enc(likelyStack("a")), enc(likelyStack("b")), { sha256, headers: { "x-powered-by": "ASP.NET" } }),
    unread: await assess(same, enc(calendarHtml([])), calCtx()),
    whole: await assess(same, enc(calendarHtml([ROW, ["2", "Select Board", "3/9/2026"]])), calCtx()),
    shell: await assess(enc(shellHtml("1")), enc(shellHtml("2")), { sha256 }),
  };
  const stops = Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, r.stopped_at]));
  assert.deepEqual(stops, { identical: "L2_bytes", unchanged: "L3_noteworthy", restyled: "L3_noteworthy",
                            undetermined: "L3_noteworthy", unread: "L5_meaning", whole: "L6_connections", shell: "L1_stack" });
  for (const r of Object.values(runs)) {
    assert.equal(r.trail[r.trail.length - 1].layer, r.stopped_at);
    for (let i = 1; i < r.trail.length; i++) assert.ok(idx(r.trail[i].layer) > idx(r.trail[i - 1].layer), "in order");
    for (const t of r.trail) assert.equal(typeof t.said, "string");
  }
  assert.deepEqual(runs.whole.trail.map((t) => t.layer), order);
  assert.equal(runs.shell.trail.length, 1);
});

test("R12 the verdict is one of the seven, each reached exactly as defined", async () => {
  const V = async (a, b, ctx) => (await assess(enc(a), enc(b), ctx)).verdict;
  assert.equal(await V(shellHtml("1"), shellHtml("2"), { sha256 }), "unwatchable");
  assert.equal(await V(CAL, CAL, calCtx()), "identical");
  assert.equal(await V(calendarHtml([ROW], { state: "a" }), calendarHtml([ROW], { state: "b" }), calCtx()), "unchanged");
  assert.equal(await V(CAL.replace("site header", "new header"), CAL, calCtx()), "restyled");
  // bytes differ, stack only LIKELY (header, no viewstate field), not conservative
  assert.equal(await V(likelyStack("a"), likelyStack("b"), { sha256, headers: { "x-powered-by": "ASP.NET" } }), "undetermined");
  // substance differs, the type judges it meaningful: a meeting cancelled
  assert.equal(await V(CAL, calendarHtml([[...ROW, "CANCELLED"]]), calCtx()), "changed");
  // substance differs, the type judges nothing meaningful: a meeting added
  assert.equal(await V(CAL, calendarHtml([ROW, ["2", "Select Board", "3/9/2026"]]), calCtx()), "routine");
});

test("R13 meaningful is true only for changed, false for the settled verdicts, null where nothing may be claimed", async () => {
  const M = async (a, b, ctx) => { const r = await assess(enc(a), enc(b), ctx); return [r.verdict, r.meaningful]; };
  assert.deepEqual(await M(CAL, CAL, calCtx()), ["identical", false]);
  assert.deepEqual(await M(calendarHtml([ROW], { state: "a" }), calendarHtml([ROW], { state: "b" }), calCtx()), ["unchanged", false]);
  assert.deepEqual(await M(CAL.replace("site header", "h2"), CAL, calCtx()), ["restyled", false]);
  assert.deepEqual(await M(CAL, calendarHtml([ROW, ["2", "S", "3/9/2026"]]), calCtx()), ["routine", false]);
  assert.deepEqual(await M(CAL, calendarHtml([[...ROW, "CANCELLED"]]), calCtx()), ["changed", true]);
  assert.deepEqual(await M(shellHtml("1"), shellHtml("2"), { sha256 }), ["unwatchable", null]);
  assert.deepEqual(await M(likelyStack("a"), likelyStack("b"), { sha256, headers: { "x-powered-by": "ASP.NET" } }), ["undetermined", null]);
  // a content type that could not read one side: nothing is claimed, never "routine"
  const r = await assess(enc(CAL), enc(calendarHtml([])), calCtx());
  assert.deepEqual([r.content_type, r.verdict, r.meaningful, r.events], ["stub_meetings", "changed", null, []]);
  // a type whose parse or assess throws, or that answers no judgment: caught, null, the reason stated
  const broken = (over) => ({ ...stubMeetings, key: "stub_broken", detect: (c) => (String(c.text).includes("BROKEN")
    ? { match: true, confidence: CONFIDENCE.CERTAIN } : { match: false }), ...over });
  const cases = [
    [{ parse: () => { throw new Error("no parse"); } }, /could not be read this time \(no parse\)/],
    [{ assess: () => { throw new Error("no compare"); } }, /could not compare the two readings \(no compare\)/],
    [{ assess: () => ({ meaningful: null, events: [], why: "it could not say" }) }, /it could not say/],
    [{ assess: () => undefined }, /reader could not say/],
    [{ parse: undefined }, /declares no reader/],
  ];
  for (const [over, why] of cases) {
    assert.equal(registerDoctype(broken(over)).ok, true);
    const b = await assess(enc("<p>BROKEN a</p>"), enc("<p>BROKEN b</p>"), { sha256 });
    assert.deepEqual([b.content_type, b.verdict, b.meaningful, b.events], ["stub_broken", "changed", null, []]);
    assert.match(b.why, why);
  }
  // and a type whose connections throw: the meaning stands, no connection is stated
  assert.equal(registerDoctype(broken({ connections: () => { throw new Error("x"); },
    assess: () => ({ meaningful: false, events: [event("item_added")], why: "added" }) })).ok, true);
  const c = await assess(enc("<p>BROKEN a</p>"), enc("<p>BROKEN b</p>"), { sha256 });
  assert.deepEqual([c.verdict, c.meaningful, c.connections], ["routine", false, []]);
  assert.match(c.trail.at(-1).said, /failed to derive them/);
  // a type that says meaningful while emitting no event: meaningful is the events', not its claim (R14)
  assert.equal(registerDoctype(broken({ assess: () => ({ meaningful: true, events: [], why: "claimed" }) })).ok, true);
  const d = await assess(enc("<p>BROKEN a</p>"), enc("<p>BROKEN b</p>"), { sha256 });
  assert.deepEqual([d.verdict, d.meaningful], ["routine", false]);
});

test("R14 events come from the one graded catalogue and meaningful is always worstSignificance(events) === event", async () => {
  assert.throws(() => event("not_in_the_catalogue"), /unknown event type/);
  for (const [k, spec] of Object.entries(EVENTS)) {
    assert.ok(["event", "notice", "routine"].includes(spec.significance), k);
    assert.equal(event(k).significance, spec.significance);
  }
  const row = [...ROW, null, "11"];
  const pairs = [
    [calendarHtml([row]), calendarHtml([[...ROW, "CANCELLED", "11"]])],
    [calendarHtml([row]), calendarHtml([row, ["2", "S", "3/9/2026"]])],
    [calendarHtml([row]), calendarHtml([[row[0], "Harbor Board", row[2], null, "11"]])],
    [calendarHtml([row]), calendarHtml([[...row.slice(0, 4), "12"]])],
    [calendarHtml([row]), calendarHtml([["9", "S", "3/9/2026"]])],
    ["<p>one</p>", "<p>two</p>"],  // the fallback under the conservative stack
  ];
  const seen = new Set();
  for (const [a, b] of pairs) {
    const r = await assess(enc(a), enc(b), calCtx());
    for (const e of r.events) { assert.equal(EVENTS[e.type].significance, e.significance); seen.add(e.significance); }
    assert.equal(r.meaningful, worstSignificance(r.events) === "event", `${r.verdict}: ${JSON.stringify(r.events.map((e) => e.type))}`);
    assert.equal(r.significance, worstSignificance(r.events));
  }
  assert.deepEqual([...seen].sort(), ["event", "notice", "routine"], "every grade was exercised");
  const g = await assess(enc("<p>one</p>"), enc("<p>two</p>"), { sha256 });
  assert.deepEqual([g.content_type, g.events.map((e) => e.type), g.meaningful], ["stub_fallback", ["substance_changed"], true]);
});

test("R15 connections are referential or temporal, each in its own shape", async () => {
  const past = [...ROW.slice(0, 1), "Harbor Commission", "3/2/2026", null, "11"];
  const withMinutes = ["2", "Select Board", "3/4/2026", null, "21", "22"];
  const future = ["3", "Harbor Commission", "4/2/2026"];
  const r = await assess(enc(calendarHtml([past])), enc(calendarHtml([past, withMinutes, future])), calCtx());
  assert.ok(r.connections.length >= 5);
  for (const c of r.connections) {
    if (c.connection === "referential")
      assert.deepEqual(Object.keys(c).sort(), ["connection", "from", "relation", "to", "why"].sort());
    else {
      assert.equal(c.connection, "temporal");
      assert.deepEqual(Object.keys(c).sort(), ["at", "connection", "expected_by", "from", "relation", "to", "why"].sort());
    }
  }
  const rel = new Set(r.connections.map((c) => `${c.connection}:${c.relation}`));
  for (const x of ["referential:is_the_agenda_for", "referential:is_the_minutes_of", "referential:held_by",
                   "temporal:minutes_published_after", "temporal:minutes_not_yet_published",
                   "temporal:agenda_not_yet_published"]) assert.ok(rel.has(x), x);
});

test("R16 confirmation states what was verified unchanged, even beside events, null when nothing was; a read that found nothing is a failed reader", async () => {
  const rows = [ROW, ["2", "Select Board", "3/4/2026"]];
  const cancelled = [[...rows[0], "CANCELLED"], rows[1]];
  const r = await assess(enc(calendarHtml(rows)), enc(calendarHtml(cancelled)), calCtx());
  assert.equal(r.verdict, "changed");
  assert.deepEqual({ entries: r.confirmation.entries, intact: r.confirmation.intact }, { entries: 2, intact: 1 });
  const same = await assess(enc(calendarHtml(rows)), enc(calendarHtml(rows)), calCtx());
  assert.equal(same.confirmation.kind, "identical_bytes");
  const mech = await assess(enc(calendarHtml(rows, { state: "a" })), enc(calendarHtml(rows, { state: "b" })), calCtx());
  assert.equal(mech.confirmation.kind, "same_substance");
  // nothing verified unchanged: every meeting altered
  const all = [[...rows[0], "CANCELLED"], [...rows[1], "CANCELLED"]];
  const none = await assess(enc(calendarHtml(rows)), enc(calendarHtml(all)), calCtx());
  assert.equal(none.confirmation, null);
  // a read that found nothing on either side: failed reader, stated
  for (const [a, b] of [[rows, []], [[], rows]]) {
    const f = await assess(enc(calendarHtml(a)), enc(calendarHtml(b)), calCtx());
    assert.equal(f.meaningful, null);
    assert.match(f.why, /could not be read/);
    assert.deepEqual(f.events, []);
  }
});

test("R17 the result carries the L1 profile always and the content type once L4 is reached", async () => {
  const same = await assess(enc(CAL), enc(CAL), calCtx());
  assert.equal(same.profile.handler, "aspnet_webforms");
  assert.ok(!("content_type" in same));
  const after = calendarHtml([ROW, ["2", "S", "3/9/2026"]]);
  const ch = await assess(enc(CAL), enc(after), calCtx());
  assert.deepEqual(ch.profile, profileRecord(identify({ ...calCtx(), text: after }), calCtx()));
  assert.equal(ch.content_type, "stub_meetings");
  // never throws: a missing hash, bytes that are not bytes
  const bad = await assess(enc("<p>a</p>"), enc("<p>b</p>"), {});
  assert.equal(bad.meaningful, null);
  assert.ok(bad.profile);
  await assess(null, undefined, { sha256 });
});

/* ------------------------------------------------------------------- readText */

test("R18 readText refuses when no honest reading may be produced, and says which", () => {
  const none = readText("", { view: PA });
  assert.deepEqual([none.determined, none.partial], [false, false]);
  assert.equal(none.why, localize("docprofile.readtext.no_text_was_supplied_so_no", "no text was supplied, so no reading was attempted"));
  for (const x of [undefined, null, 7, {}]) assert.equal(readText(x).determined, false);
  const undecoded = readText({ pages: [], undetermined: [{ reason: "no_tounicode", count: 40 }] }, { view: PA });
  assert.equal(undecoded.determined, false);
  assert.match(undecoded.why, /undetermined .*no_tounicode/);
  const mostly = readText({ document: "Harbor", counts: { undetermined: 50 }, undetermined: [{ reason: "encrypted" }] });
  assert.deepEqual([mostly.determined, mostly.partial], [false, true]);
  assert.match(mostly.why, /could not decode most of it/);
  // at the line, not over it: read, and partial
  assert.equal(readText({ document: "Harbor", counts: { undetermined: 6 } }).determined, true);
});

test("R19 a determined reading carries partial, text_from, stack, doctype, parsed or parse_error, and position facts", () => {
  const r = readText({ document: PA_ITEMS, pages: PA_ITEMS_PAGES }, { view: PA, at: "2026-03-03T00:00:00Z" });
  assert.deepEqual([r.determined, r.partial, r.text_from, r.parse_error], [true, false, "document", null]);
  assert.equal(r.doctype.type, stubItems);
  assert.deepEqual(r.doctype, doctypeFor({ text: PA_ITEMS, view: PA, at: "2026-03-03T00:00:00Z",
                                           handler: r.stack.handler, kind: r.stack.kind }));
  assert.deepEqual(r.stack, identify({ text: PA_ITEMS, view: PA, at: "2026-03-03T00:00:00Z" }));
  assert.deepEqual(keys(r.parsed), ["PA-101", "PA-102", "PA-103"]);
  assert.deepEqual([r.position_parts, r.position_why], [3, null]);
  const part = readText({ document: PA_ITEMS, counts: { undetermined: 3 } }, { view: PA });
  assert.equal(part.partial, true);
  assert.match(part.why, /PARTIAL/);
  const s = readText("plain words", {});
  assert.deepEqual([s.text_from, s.position_parts, s.doctype.type, s.parsed], ["string", 0, stubFallback, { entities: [], facts: {} }]);
  assert.match(s.position_why, /bare string/);
  const pages = readText({ pages: PA_ITEMS_PAGES }, { view: PA });
  assert.deepEqual([pages.text_from, pages.position_parts], ["pages", 3]);
  // a reader whose parse throws: no reading, the reason stated (never thrown)
  assert.equal(registerDoctype({ ...stubItems, key: "stub_throws", detect: (c) => (String(c.text).includes("THROWS")
    ? { match: true, confidence: CONFIDENCE.CERTAIN } : { match: false }), parse: () => { throw new Error("bad page"); } }).ok, true);
  const t = readText("THROWS here", {});
  assert.deepEqual([t.determined, t.parsed, t.parse_error], [true, null, "bad page"]);
});

test("R20 the reader is handed a total locate built from the supplied segment map, and places references only there", () => {
  let handed = null;
  assert.equal(registerDoctype({ ...stubItems, key: "stub_locate_probe",
    detect: (c) => (String(c.text).includes("PROBE") ? { match: true, confidence: CONFIDENCE.CERTAIN } : { match: false }),
    parse: (c) => { handed = c.locate; return stubItems.parse(c); } }).ok, true);
  const supplied = { pages: [{ page: 0, text: "PROBE PA-101" }, { page: 1, text: "" }, { page: 2, text: "PA-102 PA-101" }] };
  const r = readText(supplied, { view: PA });
  const flat = flattenText(supplied);
  const own = makeLocator(flat.segments);
  for (let i = -2; i < flat.text.length + 3; i++) assert.deepEqual(handed(i), own(i), `offset ${i}`);
  for (const x of [undefined, null, "1", NaN, Infinity]) assert.equal(handed(x), null);
  // what the reader placed is what locate gave for the offsets it read at
  const first = r.parsed.entities.find((e) => e.key === "PA-101");
  assert.deepEqual(first.source, { kind: "pdf-page", ref: "p.1", page: 0, rect: null });
  assert.deepEqual(first.occurrences.map((s) => s.ref), ["p.1", "p.3"]);
  assert.equal(r.parsed.entities.find((e) => e.key === "PA-102").source.ref, "p.3");
  // a bare string: locate is still a function, and answers null everywhere
  readText("PROBE PA-101", { view: PA });
  assert.equal(typeof handed, "function");
  assert.equal(handed(0), null);
  // a caller's own locate never stands in for the text's
  readText(supplied, { view: PA, locate: () => ({ forged: true }) });
  assert.deepEqual(handed(0), own(0));
});

/* ---------------------------------------------------------------- flattenText */

test("R21 a bare string flattens to itself with no segments and a stated position_why", () => {
  for (const s of ["  Harbor notes \n two ", ""]) {
    const f = flattenText(s);
    assert.deepEqual([f.text, f.source, f.segments, f.undetermined, f.reasons], [s, "string", [], 0, []]);
    assert.match(f.position_why, /bare string/);
  }
});

test("R22 document is preferred, and a segment map is laid over it only when the items join to it byte for byte", () => {
  const ok = flattenText({ document: "a\nb", pages: [{ page: 0, text: "a" }, { page: 1, text: "" }, { page: 2, text: "b" }] });
  assert.deepEqual([ok.text, ok.source], ["a\nb", "document"]);
  assert.deepEqual(ok.segments.map((s) => [s.start, s.end, s.source.page]), [[0, 1, 0], [2, 3, 2]]);
  const bad = flattenText({ document: "a b", pages: [{ page: 0, text: "a" }, { page: 1, text: "b" }] });
  assert.deepEqual([bad.text, bad.segments], ["a b", []]);
  assert.match(bad.position_why, /not its pages joined/);
  const paras = flattenText({ document: "x\ny", paragraphs: [{ para: 0, text: "x" }, { para: 1, text: "z" }] });
  assert.deepEqual(paras.segments, []);
  assert.match(paras.position_why, /not its paragraphs joined/);
  const parasOk = flattenText({ document: "x\ny", paragraphs: [{ para: 0, text: "x" }, { para: 1, text: "y" }] });
  assert.deepEqual(parasOk.segments.map((s) => s.source.ref), ["¶1", "¶2"]);
  assert.match(flattenText({ document: "only" }).position_why, /no itemised pages or paragraphs/);
});

test("R23 with no document, pages or paragraphs flatten to their non-empty items, newline-joined, one segment each", () => {
  const p = flattenText({ pages: [{ page: 0, text: "one" }, { page: 1, text: "" }, { page: 2, text: "three" }] });
  assert.deepEqual([p.text, p.source], ["one\nthree", "pages"]);
  assert.deepEqual(p.segments.map((s) => s.source), [
    { kind: "pdf-page", ref: "p.1", page: 0, rect: null }, { kind: "pdf-page", ref: "p.3", page: 2, rect: null }]);
  const q = flattenText({ paragraphs: [{ para: 0, text: "x", ref: "¶1" }, { para: 1, text: "" }, { para: 4, text: "y" }] });
  assert.deepEqual([q.text, q.source], ["x\ny", "paragraphs"]);
  assert.deepEqual(q.segments.map((s) => s.source), [
    { kind: "doc-para", ref: "¶1", para: 0, run: null }, { kind: "doc-para", ref: "¶5", para: 4, run: null }]);
  const unnamed = flattenText({ pages: [{ text: "a" }] });
  assert.deepEqual(unnamed.segments, []);
  assert.match(unnamed.position_why, /carry no part index/);
});

test("R24 undetermined is the producer's stated count, else summed from its markers, never invented", () => {
  assert.equal(flattenText({ document: "a", counts: { undetermined: 7 }, undetermined: [{ count: 99 }] }).undetermined, 7);
  assert.equal(flattenText({ document: "a", undetermined: [{ count: 3 }, {}, { count: 2, reason: "r" }] }).undetermined, 6);
  assert.equal(flattenText({ document: "aaaa" }).undetermined, 0);
  assert.deepEqual(flattenText({ document: "a", undetermined: [{ reason: "x" }, { reason: "x" }, { reason: "y" }] }).reasons, ["x", "y"]);
  for (const x of [null, 3, [], {}]) assert.equal(flattenText(x).undetermined, 0);
});

test("R25 locate is total: a non-number, a negative, or an offset in no segment is null; otherwise the segment's source", () => {
  const segs = flattenText({ pages: [{ page: 0, text: "ab" }, { page: 1, text: "cd" }] }).segments;
  const locate = makeLocator(segs);
  for (const x of [undefined, null, "1", NaN, Infinity, -1, 2, 5, 99]) assert.equal(locate(x), null, String(x));
  assert.deepEqual([locate(0).page, locate(1).page, locate(3).page, locate(4).page], [0, 0, 1, 1]);
  for (const bad of [null, undefined, "x", {}]) assert.equal(makeLocator(bad)(0), null);
});

test("R29 CONTRACT declares substance, membership and unmonitorable, and is the module's own export", () => {
  assert.deepEqual({ ...CONTRACT }, { SUBSTANCE: "substance", MEMBERSHIP: "membership", UNMONITORABLE: "unmonitorable" });
  // every registered type's declaration is one of its values; the no-type answer declares SUBSTANCE
  for (const t of doctypes()) assert.ok(Object.values(CONTRACT).includes(t.contract), t.key);
  assert.equal(dp.NO_TYPE.contract, CONTRACT.SUBSTANCE);
});

/* ----------------------------------------------------------------- invariants */

test("R30 R36 the shared helpers take every local fact from the view they are given, and with no view from every non-test held profile", () => {
  const { vocabulary, vocabPatterns, enactmentPatterns, enactmentNumber, codePatterns, practiceValue, readerView,
          allMatches, anyMatch } = dp;
  // the same text under two views, and none: each helper follows the view
  const cites = "Bylaw No. 2041 T.B.S. amends P.A.C. Section 4.12; Ordinance No. l204 and L.M.C. Section 9.1 apply.";
  const enact = (v) => allMatches(enactmentPatterns({ view: v }), cites)
    .map((h) => `${h.tag.kind}:${enactmentNumber(h.tag.forms, h.m.groups.num)}`);
  assert.deepEqual(enact(PA), ["bylaw:2041"]);
  assert.deepEqual(enact(LK), ["ordinance:L204"], "Lakemont's form normalises its own number");
  assert.deepEqual(enact(EMPTY), []);
  const codes = (v) => allMatches(codePatterns({ view: v }), cites).map((h) => `${h.tag.key}:${h.m.groups.sec}`);
  assert.deepEqual(codes(PA), ["pac:4.12"]);
  assert.deepEqual(codes(LK), ["lmc:9.1"]);
  assert.deepEqual(codes(EMPTY), []);
  assert.deepEqual([practiceValue({ view: PA }, "minutes_due_days").value, practiceValue({ view: LK }, "minutes_due_days").value], [10, 30]);
  assert.equal(practiceValue({ view: EMPTY }, "minutes_due_days"), null);
  assert.equal(anyMatch(vocabPatterns({ view: PA }, "furniture"), "Town of Port Alder"), true);
  assert.equal(anyMatch(vocabPatterns({ view: LK }, "furniture"), "Town of Port Alder"), false);
  assert.deepEqual(vocabulary({ view: EMPTY }, "furniture"), []);
  // a reader through the helpers: Port Alder's items under its view only
  const items = (v) => keys(stubItems.parse({ text: PA_ITEMS, view: v }));
  assert.deepEqual(items(PA), ["PA-101", "PA-102", "PA-103"]);
  assert.deepEqual([items(LK), items(EMPTY)], [[], []]);
  assert.match(stubItems.parse({ text: PA_ITEMS, view: EMPTY }).references_why, /no active jurisdiction profile/);
  // K39 (permanent, K880): no view reads with every NON-TEST held profile, never a test one
  assert.deepEqual(readerView({}), HELD);
  assert.deepEqual(readerView(undefined), HELD);
  assert.equal(readerView({ view: EMPTY }), EMPTY, "an empty view is a view");
  assert.ok(!vocabulary({}, "file_numbers").some((e) => /PA-/.test(e.pattern.re)), "a test profile is never the fallback");
  // a pattern a profile wrote that does not compile is skipped, never thrown
  const broken = { vocabulary: { furniture: [{ pattern: { re: "(" } }, { pattern: { re: "^ok$" } }] } };
  assert.equal(vocabPatterns({ view: broken }, "furniture").length, 1);
});

test("R31 the same bytes and the same ctx give the same answer", async () => {
  const ctx = calCtx();
  const a = enc(calendarHtml([["1", "Harbor Commission", "3/2/2026"]]));
  const b = enc(calendarHtml([["1", "Harbor Commission", "3/2/2026"], ["2", "S", "3/9/2026"]]));
  assert.deepEqual(await assess(a, b, ctx), await assess(a, b, ctx));
  for (const t of [PA_ITEMS, CAL, "plain", { document: PA_ITEMS, pages: PA_ITEMS_PAGES }]) {
    const once = JSON.stringify(readText(t, { view: PA, at: NOW }));
    assert.equal(JSON.stringify(readText(t, { view: PA, at: NOW })), once);
    assert.deepEqual(doctypeFor({ text: String(t.document || t), view: PA }), doctypeFor({ text: String(t.document || t), view: PA }));
  }
});

test("R32 an unrecognised document is never assumed decorated, and a recogniser without CERTAIN never says unchanged", async () => {
  // unrecognised: any byte difference, even in what looks like navigation, is reported
  const plain = (nav) => `<html><body><nav>${nav}</nav><p>The harbor.</p><a href="/">h</a></body></html>`;
  const r = await assess(enc(plain("Home")), enc(plain("Home | News")), { sha256 });
  assert.deepEqual([r.profile.handler, r.verdict], ["conservative", "changed"]);
  // conservative normalises only what is per-response by definition (a nonce)
  const n = (v) => `<html><body><script nonce="${v}"></script><p>x</p><a href="/">h</a></body></html>`;
  assert.equal((await assess(enc(n("aaa")), enc(n("bbb")), { sha256 })).verdict, "unchanged");
  // a LIKELY stack: only viewstate would differ, yet it says undetermined, never unchanged
  const likely = (v) => `<html><body><input name="__EVENTTARGET" value="${v}"><p>x</p><a href="/">h</a></body></html>`;
  const l = await assess(enc(likely("1")), enc(likely("2")), { sha256, headers: { "x-powered-by": "ASP.NET" } });
  assert.equal(l.verdict, "undetermined");
});

test("R33 a read that found nothing is a failed reader, and a mass removal is never reported from it", async () => {
  const rows = [ROW, ["2", "Select Board", "3/4/2026"], ["3", "Harbor Commission", "3/9/2026"]];
  for (const [a, b] of [[rows, []], [[], rows]]) {
    const r = await assess(enc(calendarHtml(a)), enc(calendarHtml(b)), calCtx());
    assert.deepEqual([r.verdict, r.meaningful, r.events, r.connections], ["changed", null, [], []]);
    assert.ok(!r.events.some((e) => e.type === "delisted"), "no removal from a failed read");
    assert.equal(r.confirmation, undefined, "nothing confirmed from a failed read");
  }
  // a reading of a document with no decodable text is no reading, never an empty one
  const nothing = readText({ document: "", pages: [{ page: 0, text: "" }], undetermined: [{ reason: "no_text_layer" }] });
  assert.deepEqual([nothing.determined, "parsed" in nothing], [false, false]);
});

test("R34 a position is only what locate returned for the offset read, one entity per reference with every occurrence, absent with no structure", () => {
  // a bare string: no structure, so no entity carries a source and every occurrence is null
  const bare = readText(PA_ITEMS, { view: PA }).parsed;
  for (const e of bare.entities) { assert.ok(!("source" in e)); for (const o of e.occurrences || []) assert.equal(o, null); }
  // pages: every source carried is one the producer's own map gives, at the offset the reference was read at
  const supplied = { document: PA_ITEMS, pages: PA_ITEMS_PAGES };
  const flat = flattenText(supplied);
  const locate = makeLocator(flat.segments);
  const placed = readText(supplied, { view: PA }).parsed;
  for (const e of placed.entities) {
    const at = flat.text.indexOf(e.key);
    assert.deepEqual(e.source, locate(at), e.key);
    assert.ok(flat.text.slice(flat.segments.find((s) => s.source.page === e.source.page).start).startsWith("MEMO"));
  }
  // a reference read again: one entity, source the first sighting's, occurrences every one in reading order
  const e101 = placed.entities.filter((e) => e.key === "PA-101");
  assert.equal(e101.length, 1);
  assert.deepEqual([e101[0].source.ref, e101[0].occurrences.map((s) => s.ref)], ["p.1", ["p.1", "p.3"]]);
  assert.ok(placed.entities.filter((e) => e.key !== "PA-101").every((e) => !("occurrences" in e)), "read once: no occurrences");
  // the helpers: entity carries a source only when one was given; readAgain keeps the first and appends
  const e = dp.entity("k", "item", "k", {}, null);
  assert.ok(!("source" in e));
  dp.readAgain(e, null);
  assert.deepEqual(e.occurrences, [null, null]);
});

test("R35 every no says which no and why", async () => {
  assert.match(identify({ text: "plain" }).why, /./);
  assert.equal(doctypeFor({ text: "plain" }).why, localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described"));
  assert.match(readText("").why, /./);
  assert.match(readText({ document: "x", counts: { undetermined: 9 } }).why, /./);
  assert.match(flattenText("x").position_why, /./);
  assert.match(flattenText(null).position_why, /no text was supplied/);
  const u = await assess(enc("<p>a</p>"), enc("<p>b</p>"), { sha256, headers: { "x-powered-by": "ASP.NET" } });
  assert.equal(u.verdict, "undetermined");
  assert.equal(u.why, localize("docprofile.pipeline.the_document_differs_and_this", "the document differs and this kind of document is not recognised well enough to say whether the difference matters"));
  const nohash = await assess(enc("<p>a</p>"), enc("<p>b</p>"), {});
  assert.match(nohash.why, /could not be compared/);
  // a stub's connection with no practice in the view says why it set no date
  const p = stubMeetings.parse({ text: calendarHtml([["7", "Harbor Commission", "3/2/2026"]]) });
  const c = stubMeetings.connections(p, p, { now: NOW, view: EMPTY }).find((x) => x.relation === "minutes_not_yet_published");
  assert.deepEqual([c.expected_by], [null]);
  assert.match(c.why, /not known/);
});
