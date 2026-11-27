/* docprofile — the registry seam (T33-12; K1513; T34-8), at the module's interface:
 * everything through `docprofile/registry.mjs`. This module holds no content type (R36):
 * the registry starts empty, and `registerDoctype` is the `register` that
 * `doctypes.registerDoctypes` is handed (wired by `plane`). Types registered here are
 * stubs, never `doctypes`' (a later module). This file runs in its own process, so its
 * registrations reach no other suite, and its first test sees the registry as a process
 * that registered nothing does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as dp from "../registry.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** @import { ContentType, Detection, DoctypeContext, ReadTextAnswer, ReadingDone, ReaderView, SuppliedText, SuppliedCell } from "../registry.mjs" */
/** @import { ViewMinutesDue } from "../../jurisdictions/index.mjs" */

const { doctypeFor, doctypes, registerDoctype, readText, assess, NO_TYPE, CONFIDENCE, CONTRACT } = dp;
const enc = /** @param {string} s */ (s) => new TextEncoder().encode(s);
const sha256 = /** @param {Uint8Array} b */ async (b) => createHash("sha256").update(b).digest("hex");

/** What a stub may carry beside its own members: the fallback mark, or its own reader. */
/** @typedef {{ fallback?: boolean, parse?: (ctx: DoctypeContext) => object }} StubExtra */

/* A stub type: `confidence` on its marker word (CERTAIN by default). */
const stub = /** @param {string} key @param {string} marker @param {StubExtra | null} [extra] @param {string} [confidence] @returns {ContentType} */
  (key, marker, extra, confidence = CONFIDENCE.CERTAIN) => {
    const detect = /** @param {DoctypeContext} ctx @returns {Detection} */ (ctx) => {
      if (String(ctx.text || "").includes(marker)) return { match: true, confidence, signals: [marker] };
      return { match: false };
    };
    const parse = (extra ? extra.parse : undefined) || (() => ({ entities: [], facts: { read_by: key } }));
    const assess = () => ({ meaningful: false, events: [], confirmed: null, why: "stub" });
    const fallback = extra ? extra.fallback : undefined;
    if (fallback !== undefined) return { key, label: `stub ${key}`, version: 1, contract: CONTRACT.SUBSTANCE, detect, parse, assess, fallback };
    return { key, label: `stub ${key}`, version: 1, contract: CONTRACT.SUBSTANCE, detect, parse, assess };
  };

/** The determined reading; a refused one fails the test, as reading its members did. */
const done = /** @param {ReadTextAnswer} r @returns {ReadingDone} */ (r) => {
  if (!r.determined) assert.fail(`the reading was refused: ${r.why}`);
  return r;
};
/** A stub's facts, read from its reading (R36: the reading is the reader's own, stated as an object). */
const factsOf = /** @param {object | null} parsed @returns {unknown} */ (parsed) => (parsed && "facts" in parsed ? parsed.facts : undefined);

test("R36 R4 R13 R19 R35 nothing is registered by default: doctypeFor answers the stated no-type answer, never throws, and readText and assess claim nothing", async () => {
  assert.deepEqual(doctypes(), [], "this module registers no content type of its own");
  assert.ok(Object.isFrozen(NO_TYPE));
  assert.deepEqual({ ...NO_TYPE }, { key: "unregistered", label: localize("docprofile.registry.no_content_type_is_registered", "no content type is registered"), version: 0,
                                     fallback: true, contract: CONTRACT.SUBSTANCE });
  /** @type {DoctypeContext[]} */
  const ctxs = [{ text: "a letter about nothing in particular" }, { text: "" }, {}];
  for (const ctx of ctxs) {
    const r = doctypeFor(ctx);
    assert.equal(r.type, NO_TYPE);
    assert.deepEqual([r.confidence, r.signals, r.considered, r.also], [CONFIDENCE.NONE, [], [], []]);
    assert.equal(r.why, localize("docprofile.registry.no_content_type_is_registered_to_recognise", "no content type is registered to recognise documents, so this one is not read as any type: nothing is read from it and what changes in it is not described"));
  }
  // readText: a determined reading with no reader, stated (R19)
  const t = done(readText("a letter about nothing in particular", {}));
  assert.deepEqual([t.determined, t.doctype.type, t.parsed], [true, NO_TYPE, null]);
  assert.match(t.parse_error ?? "", /unregistered content type declares no reader/);
  // assess: the substance differs and nothing is claimed about it (R13)
  const a = await assess(enc("<p>one</p>"), enc("<p>two</p>"), { sha256 });
  assert.deepEqual([a.content_type, a.verdict, a.meaningful, a.events, a.stopped_at],
                   ["unregistered", "changed", null, [], "L5_meaning"]);
  assert.match(a.why ?? "", /declares no reader/);
  // what does not reach L4 is unchanged by an empty registry
  assert.equal((await assess(enc("<p>one</p>"), enc("<p>one</p>"), { sha256 })).verdict, "identical");
});

test("R36 R4 R5 the seam: registerDoctype appends a new key, replaces a held key in its own slot, refuses a malformed member; the order decides", () => {
  assert.equal(typeof registerDoctype, "function");
  // a refused member: stated, never thrown, registry unchanged
  /* Members outside the stated kind on purpose: the seam refuses each, stated. */
  /** @type {unknown[]} */
  const malformed = [null, 3, {}, { key: "" }, { key: 7, detect() {} }, { key: "x" }, { key: "x", detect: 1 }];
  for (const bad of malformed) {
    const r = registerDoctype(bad);
    assert.equal(r.ok, false);
    assert.match(r.why, /./);
  }
  assert.deepEqual(doctypes(), []);
  // three new keys, appended in the order given; the fallback last, as a composer registers it
  const first = stub("stub_first", "FIRST");
  const second = stub("stub_second", "SECOND");
  const fallback = stub("stub_fallback", "\u0000never", { fallback: true });
  for (const t of [first, second, fallback]) assert.deepEqual(registerDoctype(t), { ok: true, key: t.key, replaced: false });
  assert.deepEqual(doctypes().map((t) => t.key), ["stub_first", "stub_second", "stub_fallback"]);
  // a held key is replaced in its own slot: the order is unchanged and the new member answers
  const first2 = stub("stub_first", "ONE");
  assert.deepEqual(registerDoctype(first2), { ok: true, key: "stub_first", replaced: true });
  assert.deepEqual(doctypes().map((t) => t.key), ["stub_first", "stub_second", "stub_fallback"]);
  assert.equal(doctypes()[0], first2);
  assert.equal(doctypeFor({ text: "ONE" }).type, first2);
  assert.equal(doctypeFor({ text: "FIRST" }).type, fallback, "the replaced member answers nothing now");
  // registering the same member again registers nothing new
  assert.deepEqual(registerDoctype(first2), { ok: true, key: "stub_first", replaced: true });
  assert.equal(doctypes().length, 3);
  // two CERTAIN: the earlier slot wins (R4), and also names the other (R5)
  const both = doctypeFor({ text: "SECOND ONE" });
  assert.deepEqual([both.type, both.confidence], [first2, CONFIDENCE.CERTAIN]);
  assert.deepEqual(both.also.map((x) => x.key), ["stub_second"]);
  // no CERTAIN: the highest-confidence match wins, wherever it is registered (R4)
  assert.equal(registerDoctype(stub("stub_possible", "MAYBE", null, CONFIDENCE.POSSIBLE)).ok, true);
  assert.equal(registerDoctype(stub("stub_likely", "MAYBE", null, CONFIDENCE.LIKELY)).ok, true);
  const best = doctypeFor({ text: "MAYBE" });
  assert.deepEqual([best.type.key, best.confidence], ["stub_likely", CONFIDENCE.LIKELY]);
  assert.deepEqual(best.considered.map((c) => c.key), ["stub_possible", "stub_likely"]);
  assert.deepEqual(best.also.map((x) => x.key), ["stub_possible"]);
  // readText reads with the registered member
  assert.deepEqual(factsOf(done(readText("SECOND", {})).parsed), { read_by: "stub_second" });
  // the registered fallback answers what nothing recognises
  const none = doctypeFor({ text: "nothing at all" });
  assert.deepEqual([none.type, none.confidence], [fallback, CONFIDENCE.NONE]);
  assert.equal(none.why, localize("docprofile.registry.no_registered_content_type_recognised", "no registered content type recognised this document, so it is read as a document of no recognised type: any substantive difference is reported and not described"));
});

test("R4 R13 R19 R35 with the fallback replaced by a type that is not one, doctypeFor answers the stated no-type answer again", async () => {
  assert.equal(registerDoctype(stub("stub_fallback", "GENERIC-STUB")).ok, true);
  assert.ok(!doctypes().some((t) => t.fallback === true));
  const r = doctypeFor({ text: "a letter about nothing in particular" });
  assert.deepEqual([r.type, r.confidence], [NO_TYPE, CONFIDENCE.NONE]);
  assert.equal(r.why, localize("docprofile.registry.no_content_type_is_registered_to_recognise", "no content type is registered to recognise documents, so this one is not read as any type: nothing is read from it and what changes in it is not described"));
  // a type that does recognise still wins (R4)
  assert.equal(doctypeFor({ text: "GENERIC-STUB" }).type.key, "stub_fallback");
  const a = await assess(enc("<p>one</p>"), enc("<p>two</p>"), { sha256 });
  assert.deepEqual([a.content_type, a.meaningful], ["unregistered", null]);
});

test("R37 readText hands the reader the supplied structure as ctx.supplied, unchanged: pages (an empty one included), markers, images, ocr, typed cells; null for a bare string", () => {
  /** @type {DoctypeContext | null} */
  let seen = null;
  /** The ctx the reader was last handed; none fails the test, as reading its members did. */
  const seenCtx = () => {
    const ctx = seen;
    if (!ctx) assert.fail("the reader was handed no ctx");
    return ctx;
  };
  assert.equal(registerDoctype(stub("stub_structure", "STRUCT-STUB", {
    parse: (ctx) => { seen = ctx; return { entities: [], facts: {} }; } })).ok, true);
  /** @type {SuppliedCell[]} */
  const cells = [{ sheet: "Budget", ref: "B2", type: "n", value: "1250.00", formula: "SUM(B3:B9)", cached: "1250.00" }];
  /** @type {SuppliedText} */
  const supplied = {
    document: "STRUCT-STUB page one",
    pages: [{ page: 0, text: "STRUCT-STUB page one", undetermined: [] },
            { page: 1, text: "", undetermined: [{ reason: "no_text_layer", count: 1 }] }],
    undetermined: [{ reason: "no_text_layer", count: 1, page: 1 }],
    images: [{ page: 1, width: 1700, height: 2200 }],
    ocr: { pages: [{ page: 1, text: "Fund 1010 General Purpose" }], engine: "tesseract" },
    cells,
    counts: { chars: 20, undetermined: 1 },
  };
  const frozen = JSON.stringify(supplied);
  /* Each structure member as the caller gave it, written to text with the whole. */
  const was = { undetermined: JSON.stringify(supplied.undetermined), images: JSON.stringify(supplied.images),
                ocr: JSON.stringify(supplied.ocr), cells: JSON.stringify(supplied.cells) };
  const r = done(readText(supplied, {}));
  assert.equal(r.determined, true);
  assert.equal(r.doctype.type.key, "stub_structure");
  assert.equal(seenCtx().supplied, supplied, "the very object the caller gave");
  assert.equal(JSON.stringify(seenCtx().supplied), frozen, "unchanged");
  assert.equal(seenCtx().supplied?.pages?.[1]?.text, "", "the page with no text layer is there");
  const held = seenCtx().supplied;
  /** @type {Array<[string, unknown, string]>} */
  const parts = [["undetermined", held?.undetermined, was.undetermined], ["images", held?.images, was.images],
                 ["ocr", held?.ocr, was.ocr], ["cells", held?.cells, was.cells]];
  for (const [k, now, before] of parts) assert.deepEqual(now, JSON.parse(before), k);
  assert.equal(seenCtx().text, "STRUCT-STUB page one");
  assert.equal(typeof seenCtx().locate, "function");
  // a caller's own ctx.supplied never stands in for the text's structure
  readText(supplied, { supplied: { forged: true } });
  assert.equal(seenCtx().supplied, supplied);
  // a bare string carries no structure
  readText("STRUCT-STUB plain", { supplied: { forged: true } });
  assert.equal(seenCtx().supplied, null);
  // a sheet's paragraphs-only shape too
  /** @type {SuppliedText} */
  const sheet = { paragraphs: [{ para: 0, text: "STRUCT-STUB" }], cells };
  readText(sheet, {});
  assert.equal(seenCtx().supplied, sheet);
});

test("R36 R30 the shared helper practiceValue carries the unit a profile counts in, so no reader counts business days as calendar days", () => {
  const view = /** @param {ViewMinutesDue} fact @returns {ReaderView} */ (fact) => ({ practice: { minutes_due_days: fact } });
  assert.deepEqual(dp.practiceValue({ view: view({ value: 10, count: "business", basis: "OMC 2.20.160" }) }, "minutes_due_days"),
                   { value: 10, basis: "OMC 2.20.160", count: "business" });
  assert.deepEqual(dp.practiceValue({ view: view({ value: 21, basis: "m" }) }, "minutes_due_days"),
                   { value: 21, basis: "m", count: null }, "no stated unit is stated as none, never assumed");
  /* Facts outside the stated kind on purpose: none is a count of days. */
  /** @type {unknown[]} */
  const notDays = [{ value: 0 }, { value: 2.5 }, { value: "10" }, null];
  for (const bad of notDays)
    assert.equal(dp.practiceValue({ view: view(bad) }, "minutes_due_days"), null);
  assert.equal(dp.practiceValue({ view: {} }, "minutes_due_days"), null);
});
