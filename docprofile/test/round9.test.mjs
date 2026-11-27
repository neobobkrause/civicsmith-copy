/* docprofile — fix round 9 (T51; G140, G133f, G141; X22, X25, X27), at the module's interface: R12 and R41 (a verdict gates
 * watching on a CERTAIN shell only, and never the reading), R18 (a decoded character is a glyph; a size refusal is worded as
 * one), R39 (every kind is classified from the stated view above the bound) and R40 (the window and the work count each
 * `detect` is handed). The types are this module's own stand-ins (this module holds none, R36); `doctypes`' real types are a
 * later module's. Counts only, never a time (R-CLOCK): the characters a detect is handed and charges.
 * Run in its own process, so the stand-ins are the only types registered. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as dp from "../registry.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { shellHtml } from "./fixtures.mjs";

/** @import { ContentType, DoctypeContext, ReadTextAnswer, ReadingDone, Registration, SuppliedText, ClassifyWindow, ClassifyWork } from "../registry.mjs" */

const { assess, readText, flattenText, doctypeFor, doctypeForYielding, registerDoctype, CONFIDENCE, CONTRACT } = dp;
const enc = /** @param {string} s */ (s) => new TextEncoder().encode(s);
const sha256 = /** @param {Uint8Array} b */ async (b) => createHash("sha256").update(b).digest("hex");
const MB = 1024 * 1024;

/** What one detect was handed and charged.
 *  @typedef {{ key: string, len: number, text?: string, window?: ClassifyWindow | undefined, work: ClassifyWork | undefined }} Handed */
/** The facts this suite's readers read.
 *  @typedef {{ read_by: string, text_len: number, paragraphs?: number }} R9Facts */

/* What each detect was handed and charged, in order. */
/** @type {Handed[]} */
let handed = [];
/** The text a reader is handed; none throws, as reading its length did. */
const textOf = /** @param {DoctypeContext} ctx @returns {string} */ (ctx) => {
  const t = ctx.text;
  if (typeof t !== "string") throw new TypeError("the reader was handed no text");
  return t;
};
const SCAN = /** @param {string} key @param {string} marker @param {string} confidence @returns {ContentType} */ (key, marker, confidence) => ({
  key, label: `r9 ${key}`, version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) {
    const text = String(ctx.text || "");
    const work = ctx.work;
    handed.push({ key, len: text.length, text, window: ctx.window, work });
    if (work) work.chars += text.length; // a pass over the whole window, charged as the contract says
    return text.includes(marker) ? { match: true, confidence, signals: [marker] } : { match: false };
  },
  parse: (ctx) => ({ entities: [], facts: { read_by: key, text_len: textOf(ctx).length, paragraphs: (textOf(ctx).match(/<p>/g) || []).length } }),
});
const stand = /** @param {string} k */ (k) => SCAN(k, `NEVER-${k}`, CONFIDENCE.LIKELY);
/** @type {ContentType} */
const FALLBACK = { key: "r9_fallback", label: "r9 fallback", version: 1, fallback: true, contract: CONTRACT.SUBSTANCE,
  detect: () => ({ match: false }), parse: (ctx) => ({ entities: [], facts: { read_by: "r9_fallback", text_len: textOf(ctx).length } }) };

/** The determined reading; a refused one fails the test, as reading its members did. */
const done = /** @param {ReadTextAnswer} r @returns {ReadingDone} */ (r) => {
  if (!r.determined) assert.fail(`the reading was refused: ${r.why}`);
  return r;
};
/** A reading's facts, as this suite's readers wrote them (R36: the reading is the reader's own, stated as an object). */
const isR9Facts = /** @param {unknown} v @returns {v is R9Facts} */ (v) => typeof v === "object" && v !== null && "read_by" in v;
const factsOf = /** @param {object | null} parsed @returns {R9Facts} */ (parsed) => {
  const facts = parsed && "facts" in parsed ? parsed.facts : undefined;
  if (!isR9Facts(facts)) assert.fail("the reading carries no facts of this suite's readers");
  return facts;
};
/** Whether a registration replaced a held key; a refusal replaced nothing. */
const replaced = /** @param {Registration} r */ (r) => (r.ok ? r.replaced : undefined);
for (const t of [SCAN("r9_a", "R9-A", CONFIDENCE.CERTAIN), SCAN("r9_page", "SERVERTEXT-29", CONFIDENCE.CERTAIN), FALLBACK])
  assert.equal(registerDoctype(t).ok, true);

/** A server-rendered page with ONE framework marker (a POSSIBLE client-rendered match) and 30 paragraphs of server text. */
const serverPage = (marker = "__NEXT_DATA__") => `<html><head><script id="${marker}"></script></head><body><main>`
  + Array.from({ length: 30 }, (_, i) => `<p>SERVERTEXT-${i} the council met and heard item ${i}.</p>`).join("") + `</main></body></html>`;

test("R12 an unwatchable verdict only for a CERTAIN shell: a client-rendered match at POSSIBLE or LIKELY goes on through the layers", async () => {
  const one = serverPage("__NEXT_DATA__");
  const id = dp.identify({ text: one });
  assert.deepEqual([id.handler.key, id.handler.shell, id.confidence], ["client_rendered", true, CONFIDENCE.POSSIBLE]);
  const r = await assess(enc(one), enc(one.replace("heard item 3", "heard item 3 again")), { sha256 });
  assert.notEqual(r.verdict, "unwatchable", "a possibility gates nothing");
  assert.notEqual(r.stopped_at, dp.LAYER.STACK, "the layers went on");
  assert.equal(r.trail.some((t) => t.layer === dp.LAYER.BYTES), true);
  // two markers: LIKELY, still not CERTAIN
  const two = serverPage("__NEXT_DATA__").replace("<main>", '<main data-reactroot="">');
  const l = dp.identify({ text: two });
  assert.deepEqual([l.handler.key, l.confidence], ["client_rendered", CONFIDENCE.LIKELY]);
  const rl = await assess(enc(two), enc(two.replace("heard item 3", "heard item 3 again")), { sha256 });
  assert.notEqual(rl.verdict, "unwatchable");
  // identical bytes under a possible shell are identical, not unwatchable
  assert.equal((await assess(enc(one), enc(one), { sha256 })).verdict, "identical");
  // a CERTAIN shell is still settled at L1
  const s = await assess(enc(shellHtml("1")), enc(shellHtml("2")), { sha256 });
  assert.deepEqual([s.verdict, s.meaningful, s.stopped_at], ["unwatchable", null, dp.LAYER.STACK]);
});

test("R41 a profile verdict gates watching and never reading: the reading is the same whatever stack was recognised and whatever assess called it", async () => {
  const one = serverPage("__NEXT_DATA__"), plain = serverPage("NEXT_DATA");
  assert.equal(dp.identify({ text: plain }).handler.shell, undefined, "the control page is no shell at all");
  const a = done(readText(one, {})), b = done(readText(plain, {}));
  for (const r of [a, b]) {
    assert.equal(r.determined, true);
    assert.equal(r.doctype.type.key, "r9_page");
    assert.equal(r.parse_error, null);
    assert.equal(factsOf(r.parsed).paragraphs, 30, "all thirty paragraphs of server text are read");
  }
  assert.deepEqual([factsOf(a.parsed).read_by, factsOf(a.parsed).paragraphs], [factsOf(b.parsed).read_by, factsOf(b.parsed).paragraphs]);
  assert.equal(a.chars - b.chars, 4, "the two texts differ by the marker's four underscores and nothing else");
  // the verdict assess gives about the same bytes changes nothing about the reading
  const before = JSON.stringify(readText(one, {}));
  /** @type {Array<[string, string]>} */
  const pairs = [[one, one], [one, one.replace("item 3", "item 4")], [shellHtml("1"), shellHtml("2")]];
  for (const [x, y] of pairs) await assess(enc(x), enc(y), { sha256 });
  assert.equal(JSON.stringify(readText(one, {})), before, "the reading is not a function of any verdict");
  // and a text whose stack IS a CERTAIN shell is read, classified and parsed all the same
  const shell = done(readText(shellHtml("1"), {}));
  assert.equal(shell.determined, true);
  assert.deepEqual([shell.stack.handler.key, shell.stack.confidence], ["client_rendered", CONFIDENCE.CERTAIN]);
  assert.equal(shell.doctype.type.key, "r9_fallback");
  assert.equal(factsOf(shell.parsed).text_len, shellHtml("1").length, "parsed over the whole text");
});

test("R18 a decoded character is a glyph: white space, U+FFFD and NUL are not decoded text", () => {
  /** @type {SuppliedText} */
  const spaced = { document: "ab" + " ".repeat(1000), counts: { undetermined: 600 } };
  assert.equal(flattenText(spaced).chars, 2);
  const r = readText(spaced, {});
  assert.deepEqual([r.determined, r.partial, r.chars, r.undetermined], [false, true, 2, 600]);
  assert.match(r.why, /600/);
  assert.match(r.why, /\b2\b/);
  // control: the same residue over real text still reads, stated as partial
  const real = readText({ document: "ab".repeat(700) + " ".repeat(1000), counts: { undetermined: 600 } }, {});
  assert.deepEqual([real.determined, real.partial, real.chars], [true, true, 1400]);
  // what a glyph is: a pair counts once; white space of every kind, the replacement character and NUL count none
  assert.equal(flattenText("a\u{1F600}b").chars, 3);
  assert.equal(flattenText("a \t\n\r\v\f       　﻿b").chars, 2);
  assert.equal(flattenText("a�\u0000b�").chars, 2);
  assert.equal(flattenText({ pages: [{ page: 0, text: "  \n   " }, { page: 1, text: "xy" }] }).chars, 2);
  // a text of white space alone has no glyph: refused as no text, or as undetermined where the producer stated residue
  assert.equal(readText("   \n\t  ", {}).determined, false);
  assert.equal(readText({ document: "     ", counts: { undetermined: 1 } }, {}).determined, false);
  // a bare string is counted as a supplied document is
  assert.equal(readText(" ".repeat(5000) + "�".repeat(10), {}).determined, false);
});

test("R18 a marker's why is read as its reason, and a size refusal is worded as one, with the file's size and the limit", () => {
  const size = 44732492, bound = 33554432;
  const guard = { ok: false, text: "undetermined", why: "over_size_bound", size, bound, boundName: "STREAMED_TEXT_BOUND_BYTES", final: true };
  // the 200,000-row workbook's text as office-readers hands it over: no text, one marker, `why` and the guard's size and bound
  /** @type {SuppliedText} */
  const supplied = { document: "", undetermined: [{ part: "(text parts: worksheets + sharedStrings)", why: "over_size_bound", guard }],
                     counts: { chars: 0, cells: 0, undetermined: 1 } };
  assert.deepEqual(flattenText(supplied).reasons, ["over_size_bound"]);
  const r = readText(supplied, {});
  assert.deepEqual([r.determined, r.partial, r.chars, r.undetermined], [false, false, 0, 1]);
  const stated = localize("docprofile.readtext.the_text_of_this_document_was_not_read_over_the_size_limit",
    "the text of this document was not read: it is {size} MiB of text against the {bound} MiB that is read", { size: "42.66", bound: "32.00" });
  assert.equal(r.why, stated);
  assert.ok(r.why.includes("42.66") && r.why.includes("32.00"), "the size and the limit");
  assert.ok(!/undecodable/.test(r.why), "a size refusal is not unreadable bytes");
  // the marker carrying size and bound itself reads the same; a producer's `reason` still names its cause
  const flat = readText({ document: "", undetermined: [{ why: "over_size_bound", size, bound }], counts: { undetermined: 1 } }, {});
  assert.equal(flat.why, stated);
  const pdf = readText({ document: "", undetermined: [{ reason: "encrypted" }], counts: { undetermined: 1 } }, {});
  assert.match(pdf.why, /undecodable region/);
  assert.deepEqual(pdf.reasons, ["encrypted"]);
  // a refusal beside text that was read states itself on the partial reading too
  const part = readText({ document: "some text that was read", undetermined: [{ why: "over_size_bound", guard }], counts: { undetermined: 1 } }, {});
  assert.equal(part.determined, true);
  assert.ok(part.why.endsWith(`; ${stated}`));
});

/** A text of about `n` characters of numbered whole lines. */
const lines = /** @param {number} n */ (n) => { /** @type {string[]} */ const rows = []; for (let c = 0, i = 0; c < n; i++) { const r = `line ${i} of the record ${"w".repeat(30 + (i % 7))}`; rows.push(r); c += r.length + 1; } return rows.join("\n"); };

test("R39 every kind of text over the bound is classified from the stated view: string, pages, paragraphs, document; at the bound, whole", async () => {
  const big = lines(4 * MB) + "\nR9-A at the end";
  /** @type {Array<[string, SuppliedText | string]>} */
  const shapes = [["string", big], ["pages", { pages: [{ page: 0, text: big }] }], ["paragraphs", { paragraphs: [{ para: 0, text: big }] }],
                  ["document", { document: big }], ["document and pages", { document: big, pages: [{ page: 0, text: big }] }]];
  for (const [name, supplied] of shapes) {
    handed = [];
    const r = done(readText(supplied, {}));
    const co = r.classified_over;
    assert.ok(co, `${name}: a stated view`);
    assert.deepEqual([co.of, co.sheet_heads, co.heads_used], [big.length, [], false], name);
    assert.ok(co.chars <= dp.CLASSIFY_VIEW_MAX_CHARS && co.chars > 0, name);
    assert.ok(handed.length >= 1 && handed.every((h) => h.len === co.chars), `${name}: every detect is handed the view, never the text`);
    assert.equal(r.doctype.type.key, "r9_a", `${name}: the view ends at the text's end, so its last line is classified`);
    assert.ok(r.why.endsWith(`; ${dp.classifiedWhy(co)}`), name);
    assert.equal(factsOf(r.parsed).text_len, big.length, `${name}: parse reads all of it`);
  }
  // exactly the bound: whole, the same string; one over: the view
  const at = lines(dp.CLASSIFY_WHOLE_MAX_CHARS).slice(0, dp.CLASSIFY_WHOLE_MAX_CHARS);
  handed = [];
  const exact = doctypeFor({ text: at });
  assert.equal("classified_over" in exact, false);
  assert.ok(handed.every((h) => h.text === at), "handed the very string");
  assert.ok("classified_over" in doctypeFor({ text: at + "x" }));
  // doctypeFor bounds every caller, not only readText: the answer carries the view and the twin answers the same
  /** @type {DoctypeContext} */
  const ctx = { text: big };
  const sync = doctypeFor(ctx), twin = await doctypeForYielding(ctx, { yieldNow: () => new Promise((go) => setImmediate(go)) });
  assert.deepEqual(twin, sync);
  assert.equal(sync.classified_over?.of, big.length);
  assert.equal(ctx.text, big, "the caller's ctx is not changed");
});

test("R40 each detect is handed the view's window and one shared work count, and every registered type is asked on any text", () => {
  const stands = ["r9_s1", "r9_s2"].map((k) => SCAN(k, `NEVER-${k}`, CONFIDENCE.LIKELY));
  for (const t of stands) assert.equal(registerDoctype(t).ok, true);
  const registered = dp.doctypes().length;
  /** @type {Array<[string, string]>} */
  const shapes = [
    ["a long run of one pattern", "a-".repeat(200_000)], ["16,000 addresses on one line", Array.from({ length: 16_000 }, (_, i) => `u${i}@city.example`).join(" ")],
    ["40,000 definitions", Array.from({ length: 40_000 }, (_, i) => `"Term${i}" means a thing.`).join("\n")],
    ["150,000 dates", Array.from({ length: 150_000 }, (_, i) => `2026-${String(1 + (i % 12)).padStart(2, "0")}-01`).join("\n")],
    ["a 240 KB run of <div", "<div".repeat(60_000)], ["a 5 MiB text", lines(5 * MB)],
  ];
  for (const [name, text] of shapes) {
    handed = [];
    const r = doctypeFor({ text });
    const co = r.classified_over;
    const view = co ? co.chars : text.length;
    assert.equal(handed.length, 4, `${name}: the four types were asked`);
    for (const h of handed) {
      assert.equal(h.len, view, `${name}: handed the view`);
      assert.deepEqual(h.window, { from: 0, to: view, of: text.length }, name);
      assert.equal(h.work, handed[0]?.work, `${name}: one work object for the whole classification`);
    }
    assert.equal(dp.CLASSIFY_WORK_FACTOR, 4);
    assert.equal(r.work.limit, 4 * view * registered, `${name}: four views for each registered type`);
    assert.equal(r.work.chars, handed.length * view, `${name}: the count is what the detects charged`);
    assert.ok(r.work.chars <= r.work.limit, name);
    assert.equal(r.work.stopped_before, null, name);
  }
});

test("R40 seven honest detects are all asked over a view, and a runaway first detect still stops those after it", () => {
  const many = ["r9_w1", "r9_w2", "r9_w3", "r9_w4", "r9_w5", "r9_w6", "r9_w7"].map((k) => SCAN(k, `NEVER-${k}`, CONFIDENCE.LIKELY));
  for (const t of many) assert.equal(registerDoctype(t).ok, true);
  const registered = dp.doctypes().length;
  const text = lines(100_000);
  // honest: each detect charges one pass over the view; eleven passes are far under four per registered type
  handed = [];
  const r = doctypeFor({ text });
  assert.deepEqual(handed.map((h) => h.key), ["r9_a", "r9_page", "r9_s1", "r9_s2", ...many.map((m) => m.key)], "every type was asked, in order");
  assert.equal(r.work.limit, 4 * text.length * registered);
  assert.equal(r.work.chars, handed.length * text.length);
  assert.equal(r.work.stopped_before, null);
  assert.equal(r.type.key, "r9_fallback", "nothing recognised it: the registered fallback, as ever");
  const why = r.why;
  assert.ok(!why || !why.includes("work budget"), "no budget statement when every type was asked");
  // a runaway: one detect charging far over its share stops the types after it, stated with the figures
  /** @type {ContentType} */
  const runaway = { ...SCAN("r9_s1", "NEVER-r9_s1", CONFIDENCE.LIKELY), detect(ctx) {
    const work = ctx.work;
    handed.push({ key: "r9_s1", len: textOf(ctx).length, work });
    if (!work) throw new TypeError("the detect was handed no work count");
    work.chars += 60 * textOf(ctx).length; return { match: false };
  } };
  assert.equal(replaced(registerDoctype(runaway)), true);
  try {
    handed = [];
    const x = doctypeFor({ text });
    const asked = handed.map((h) => h.key);
    assert.deepEqual(asked, ["r9_a", "r9_page", "r9_s1"], "stopped after the detect that crossed the limit");
    assert.equal(x.work.stopped_before, "r9_s2");
    assert.ok(x.work.chars > x.work.limit && x.work.chars <= x.work.limit + 60 * text.length);
    const xwhy = x.why ?? "";
    assert.ok(xwhy.includes("r9_s2") && xwhy.includes(String(x.work.limit)) && xwhy.includes(String(x.work.chars)), "stated, with the figures");
    // the also pass is under the same count: a CERTAIN winner first, the rest asked until the count passes
    handed = [];
    const won = text + "\nR9-A";
    const w = doctypeFor({ text: won });
    assert.equal(w.type.key, "r9_a");
    assert.deepEqual(handed.map((h) => h.key), ["r9_a", "r9_page", "r9_s1"], "the also pass stopped at the runaway");
    assert.equal(w.work.stopped_before, "r9_s2");
    assert.ok(w.work.chars > w.work.limit);
  } finally {
    assert.equal(replaced(registerDoctype(stand("r9_s1"))), true);
  }
});

test("R40 a ctx whose text is an accessor is wrapped, not read ahead: each detect reads it as it always did", () => {
  let reads = 0;
  /** @type {DoctypeContext} */
  const ctx = { get text() { reads++; return "R9-A here"; } };
  handed = [];
  const r = doctypeFor(ctx);
  assert.equal(r.type.key, "r9_a");
  assert.ok(reads >= 1 && handed[0]?.work && handed[0]?.window);
  assert.equal(r.work.stopped_before, null);
  // no text at all is still an answer
  assert.equal(doctypeFor({}).type.key, "r9_fallback");
  assert.equal(doctypeFor(undefined).type.key, "r9_fallback");
});

test("R12 R41 markup-free text (a CSV, prose) is never unwatchable through the pipeline; a CERTAIN shell still is", async () => {
  const csv = /** @param {number} n */ (n) => Array.from({ length: 400 }, (_, i) => `row ${i},${i * n},value`).join("\n");
  const prose = /** @param {number} n */ (n) => `Minutes ${n}. ` + "The council heard the item and adjourned. ".repeat(80);
  for (const mk of [csv, prose]) {
    const r = await assess(enc(mk(1)), enc(mk(2)), { sha256 });
    assert.notEqual(r.verdict, "unwatchable");
    assert.notEqual(r.stopped_at, dp.LAYER.STACK);
  }
  const s = await assess(enc(shellHtml("1")), enc(shellHtml("2")), { sha256 });
  assert.equal(s.verdict, "unwatchable", "needs site-profiles R2's identify().shell");
});
