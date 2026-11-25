/* docprofile — G48 (fix round 6; K4673, K4670, K4571), at the module's interface: a sheet over the bound is classified
 * from a bounded view that `readText` states, and `doctypeFor` asks each type once. The types are spies registered through
 * the seam (this module holds none, R36); what is asserted is the work done: the characters a `detect` is handed, the
 * calls each type gets, never a time (R-CLOCK). Run in its own process, so the spies are the only types registered. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as dp from "../registry.mjs";

const { readText, doctypeFor, alsoFor, identify, registerDoctype, CONFIDENCE, CONTRACT } = dp;

const seen = { lens: [], texts: [], asked: new Map(), parsed: [] };
const reset = () => { seen.lens = []; seen.texts = []; seen.asked = new Map(); seen.parsed = []; };
const asked = (key) => seen.asked.get(key) || 0;
const spy = (key, match, extra) => ({
  key, label: `g48 ${key}`, version: 1, contract: CONTRACT.SUBSTANCE,
  detect(ctx) {
    seen.asked.set(key, asked(key) + 1);
    if (key === "g48_len") { seen.lens.push(ctx.text.length); seen.texts.push(ctx.text); }
    return match && ctx.text.includes(match.marker) ? { match: true, confidence: match.confidence, signals: [match.marker] } : { match: false };
  },
  parse(ctx) { seen.parsed.push(ctx.text.length); return { entities: [], facts: { read_by: key } }; },
  ...(extra || {}),
});
const throwing = (key, marker) => spy(key, null, { detect(ctx) { seen.asked.set(key, asked(key) + 1); if (ctx.text.includes(marker)) throw new Error(`${key} threw`); return { match: false }; } });
for (const t of [spy("g48_len"), spy("g48_a"), throwing("g48_boom_early", "G48-EARLY"),
                 spy("g48_win", { marker: "G48-WIN", confidence: CONFIDENCE.CERTAIN }),
                 spy("g48_late", { marker: "G48-LATE", confidence: CONFIDENCE.LIKELY }), throwing("g48_boom", "G48-BOOM")])
  assert.equal(registerDoctype(t).ok, true);

/** A tab-joined sheet of about `chars` characters whose rows are numbered under `tag` (so every row is its own line). */
function sheetOf(chars, tag = "r") {
  const rows = [];
  for (let n = 0, i = 0; n < chars; i++) { const r = `${tag}${i}\t${"x".repeat(20 + (i % 17))}\t${i * 31}`; rows.push(r); n += r.length + 1; }
  return rows.join("\n");
}
const csv = (t) => ({ document: t, sheets: [{ name: "s", text: t }], container: "csv" });
const MB = 1024 * 1024;
const slice = (t, s) => t.slice(s.from, s.to);

test("R38 a 6 MB sheet is classified from a view of at most CLASSIFY_VIEW_MAX_CHARS: its first and last lines, whole-line windows in each tenth, nothing else", () => {
  const t = sheetOf(6 * MB);
  reset();
  const r = readText(csv(t), {});
  assert.equal(r.determined, true);
  assert.ok(seen.lens.length >= 1, "a type was asked");
  for (const n of seen.lens) assert.ok(n <= dp.CLASSIFY_VIEW_MAX_CHARS, `a detect was handed ${n} characters`);
  assert.ok(dp.CLASSIFY_VIEW_MAX_CHARS < dp.CLASSIFY_WHOLE_MAX_CHARS, "the view leaves slack under the whole-text bound");
  const co = r.classified_over, view = seen.texts[0];
  assert.deepEqual([co.of, co.chars], [t.length, view.length]);
  assert.ok(t.startsWith(view.slice(0, view.indexOf("\n"))) && view.startsWith(t.slice(0, co.head_chars)), "the view opens with the text's head");
  assert.equal(co.head_chars <= dp.CLASSIFY_HEAD_CHARS + dp.CLASSIFY_LINE_SLACK_CHARS, true);
  assert.ok(co.head_chars >= dp.CLASSIFY_HEAD_CHARS || co.head_chars === t.length);
  assert.ok(view.includes(t.slice(0, t.indexOf("\n"))), "the first line");
  assert.ok(view.endsWith(t.slice(t.lastIndexOf("\n") + 1)), "the last line is the view's last");
  assert.equal(co.windows.length, dp.CLASSIFY_WINDOWS);
  assert.equal(co.windows.at(-1).to, t.length, "the last window ends at the text's end");
  let prev = co.head_chars;
  for (const w of co.windows) {
    assert.ok(w.from >= prev && w.to > w.from && w.to - w.from <= dp.CLASSIFY_WINDOW_CHARS, JSON.stringify(w));
    assert.ok(w.from === 0 || t[w.from - 1] === "\n", "a window starts at a line start");
    assert.ok(w.to === t.length || t[w.to] === "\n", "a window ends at a line end");
    prev = w.to;
  }
  for (let k = 0; k < 10; k++)
    assert.ok(co.windows.some((w) => w.from >= (k * t.length) / 10 && w.from < ((k + 1) * t.length) / 10), `a window starts in tenth ${k}`);
  const expected = [...co.sheet_heads.map((s) => slice(t, s)), t.slice(0, co.head_chars), ...co.windows.map((w) => slice(t, w))].join("\n");
  assert.equal(view, expected, "the view is exactly the stated pieces, joined by one newline");
  assert.equal(co.heads_used, true);
  assert.deepEqual(co.sheet_heads, [], "the one sheet's head lies inside the text's head");
});

test("R38 the first lines of every sheet of a workbook text are in the view, empty sheets skipped, the heads under one shared budget", () => {
  const sheets = [{ name: "A", text: "ONE-FIRST\n" + sheetOf(3 * MB, "a") }, { name: "B", text: "" },
                  { name: "C", text: "TWO-FIRST\n" + sheetOf(2 * MB, "c") }, { name: "D", text: "THREE-FIRST\n" + sheetOf(MB, "d") }];
  const t = sheets.map((s) => s.text).filter(Boolean).join("\n");
  reset();
  const r = readText({ document: t, sheets, container: "xlsx" }, {});
  const co = r.classified_over, view = seen.texts[0];
  assert.equal(co.heads_used, true);
  assert.equal(co.sheet_heads.length, 2, "sheets two and three; the first is inside the head");
  for (const first of ["ONE-FIRST", "TWO-FIRST", "THREE-FIRST"]) assert.ok(view.includes(first), first);
  const total = co.sheet_heads.reduce((n, s) => n + s.to - s.from, 0);
  assert.ok(total <= dp.CLASSIFY_SHEET_HEADS_MAX_CHARS);
  for (const s of co.sheet_heads) {
    assert.ok(s.to - s.from <= dp.CLASSIFY_SHEET_HEAD_CHARS, JSON.stringify(s));
    assert.ok(t[s.from - 1] === "\n" && (s.to === t.length || t[s.to] === "\n" || s.to - s.from === dp.CLASSIFY_SHEET_HEAD_CHARS), "a sheet head starts at the sheet and ends at a line end");
  }
  assert.ok(seen.lens.every((n) => n <= dp.CLASSIFY_VIEW_MAX_CHARS));
  // a document that is not the sheets joined: no sheet boundary is known, and the view says so
  reset();
  const off = readText({ document: t + "\nAN EXTRA LINE", sheets, container: "xlsx" }, {}).classified_over;
  assert.deepEqual([off.heads_used, off.sheet_heads], [false, []]);
});

test("R19 R39 classified_over is answered only when the view was used, with the sentence in why by its function; whole-text classes are unchanged", () => {
  const t = sheetOf(3 * MB);
  const base = readText({ document: t.slice(0, MB) }, {});
  assert.equal("classified_over" in base, false);
  const r = readText(csv(t), {});
  assert.deepEqual(Object.keys(r.classified_over), ["chars", "of", "head_chars", "windows", "sheet_heads", "heads_used"]);
  assert.deepEqual(Object.keys(r).filter((k) => k !== "classified_over"), Object.keys(base));
  assert.ok(r.why.endsWith(`; ${dp.classifiedWhy(r.classified_over)}`), "the sentence stating the view ends why");
  for (const v of [dp.CLASSIFY_WHOLE_MAX_CHARS, r.classified_over.chars, t.length, r.classified_over.head_chars, r.classified_over.windows.length])
    assert.ok(dp.classifiedWhy(r.classified_over).includes(String(v)), String(v));
  // exactly the bound: whole; one over: sampled
  const at = sheetOf(dp.CLASSIFY_WHOLE_MAX_CHARS).slice(0, dp.CLASSIFY_WHOLE_MAX_CHARS);
  reset();
  const exact = readText(csv(at), {});
  assert.deepEqual([at.length, "classified_over" in exact, seen.lens], [dp.CLASSIFY_WHOLE_MAX_CHARS, false, [at.length]]);
  assert.ok(!exact.why.includes(";"));
  reset();
  assert.equal("classified_over" in readText(csv(at + "x"), {}), true);
  // R39 (fix round 9, G133f; X25): a bare string, pages and paragraphs are classified from the same view, of any size, without sheet heads
  const big = sheetOf(5 * MB);
  const shapes = { string: big, pages: { pages: [{ page: 0, text: big }] }, paragraphs: { paragraphs: [{ para: 0, text: big }] },
                   "document with pages": { document: big, pages: [{ page: 0, text: big }] } };
  for (const [name, supplied] of Object.entries(shapes)) {
    reset();
    const w = readText(supplied, {});
    const co = w.classified_over;
    assert.ok(co, `${name} is classified from a stated view`);
    assert.deepEqual(seen.lens, [co.chars], `${name} is handed the view`);
    assert.ok(co.chars <= dp.CLASSIFY_VIEW_MAX_CHARS && co.of === big.length, name);
    assert.deepEqual([co.sheet_heads, co.heads_used], [[], false], name);
    assert.equal(co.windows.length, dp.CLASSIFY_WINDOWS, name);
    assert.ok(w.why.endsWith(`; ${dp.classifiedWhy(co)}`), name);
  }
});

test("R38 the stack is read from the whole text, and a matched type's parse is handed the whole text", () => {
  const t = sheetOf(6 * MB);
  reset();
  const probe = readText(csv(t), {});
  // a <body> opening tag in a gap between two windows is outside the view and inside the stack's text: markup is what lets
  // site-profiles count a text with no links and no prose as a shell (G76), and the view holds none, so the two answers differ
  const w = probe.classified_over.windows, gap = Math.floor((w[4].to + w[5].from) / 2);
  const at = t.indexOf("\t", gap);
  const marker = "<body>";
  assert.ok(at > w[4].to && at + marker.length < w[5].from);
  const marked = t.slice(0, at) + marker + t.slice(at + marker.length);
  assert.equal(marked.length, t.length);
  reset();
  const r = readText(csv(marked), {});
  assert.deepEqual(r.classified_over.windows, w, "the same layout");
  assert.ok(!seen.texts[0].includes(marker), "outside the view");
  assert.deepEqual(r.stack, identify({ text: marked, pages: [] }), "the stack is identify over the whole text");
  assert.notDeepEqual(r.stack, identify({ text: seen.texts[0], pages: [] }), "and not over the view");
  // a type that wins on the head parses the whole sheet
  const won = "G48-WIN\n" + t;
  reset();
  const m = readText(csv(won), {});
  assert.equal(m.doctype.type.key, "g48_win");
  assert.deepEqual(seen.parsed, [won.length]);
  assert.equal(m.parse_error, null);
});

test("R5 doctypeFor asks each type once: all of them when nothing is certain, no type twice when one wins, also as the independent pass gives it", () => {
  const ctx = (text) => ({ text, pages: [] });
  const cases = ["nothing at all", "G48-LATE only", "G48-WIN", "G48-WIN G48-LATE", "G48-LATE G48-WIN", "G48-WIN G48-BOOM", "G48-WIN G48-LATE G48-BOOM"];
  for (const text of cases) {
    reset();
    const d = doctypeFor(ctx(text));
    for (const k of ["g48_len", "g48_a", "g48_boom_early", "g48_win", "g48_late", "g48_boom"]) assert.ok(asked(k) <= 1, `${text}: ${k} asked ${asked(k)} times`);
    if (!text.includes("G48-WIN")) for (const k of ["g48_len", "g48_a", "g48_win", "g48_late", "g48_boom"]) assert.equal(asked(k), 1, `${text}: ${k} is asked`);
    else assert.equal(asked("g48_late"), 1, `${text}: a type registered after the winner is asked`);
    assert.deepEqual(d.also, alsoFor(ctx(text), d.type.key), text);
  }
  reset();
  const both = doctypeFor(ctx("G48-WIN G48-LATE G48-BOOM"));
  assert.deepEqual(both.also.map((x) => [x.key, x.error ?? null, x.confidence]),
                   [["g48_late", null, CONFIDENCE.LIKELY], ["g48_boom", "g48_boom threw", null]], "a throw after the winner is an error entry");
  // a throw before the winner propagates, as it always did (site-profiles R5)
  assert.throws(() => doctypeFor(ctx("G48-EARLY G48-WIN")), /g48_boom_early threw/);
  assert.throws(() => doctypeFor(ctx("G48-BOOM")), /g48_boom threw/);
  // the entries before the winner keep their place: registration order throughout
  const lateWins = doctypeFor(ctx("G48-WIN G48-LATE"));
  assert.deepEqual(lateWins.also.map((x) => x.key), ["g48_late"]);
});

test("R38 classificationView: a long line is cut at the size, a pair is never split, heads go before windows, the last window is kept", () => {
  const limits = { view: 700, head: 101, slack: 10, windows: 3, window: 121, sheetHeads: 150, sheetHead: 60 };
  const long = "😀".repeat(5000);
  const v = dp.classificationView(long, null, limits);
  for (const w of v.windows) { assert.ok(w.to - w.from <= 121); assert.ok(!/[\uDC00-\uDFFF]/.test(long[w.from]) && !/[\uD800-\uDBFF]/.test(long[w.to - 1]), "no pair is split"); }
  assert.ok(!/[\uD800-\uDBFF]/.test(long[v.head_chars - 1]));
  assert.equal(v.windows.at(-1).to, long.length);
  assert.ok(v.view.length <= 700);
  // heads dropped first, then windows from the front; the last window and the head's start remain
  const rows = Array.from({ length: 400 }, (_, i) => `row${i}`).join("\n");
  const sheets = [{ text: rows.slice(0, 1500) }, { text: "" }, { text: "S2-first\n" + rows.slice(0, 900) }, { text: "S3-first\n" + rows.slice(0, 900) }];
  const doc = sheets.map((s) => s.text).filter(Boolean).join("\n");
  const tight = dp.classificationView(doc, sheets, { ...limits, view: 480 });
  assert.ok(tight.view.length <= 480, `${tight.view.length}`);
  assert.equal(tight.windows.at(-1).to, doc.length);
  assert.equal(tight.heads_used, false, "the heads were dropped to fit, and it says so");
  assert.deepEqual(tight.sheet_heads, []);
  const roomy = dp.classificationView(doc, sheets, limits);
  assert.deepEqual([roomy.heads_used, roomy.sheet_heads.length], [true, 2]);
  assert.ok(roomy.view.includes("S2-first") && roomy.view.includes("S3-first"));
});
