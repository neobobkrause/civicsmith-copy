/* doctypes — requirement-named tests for R40 (a type's detect and parse do work linear in the characters they examine, and
 * count it) and R41 (the calendar answers for any number of dates), and for the four patterns R37 was found not to meet
 * (G140, G133c; X22, X12). They run the types as docprofile runs them: `readText` over the registered types for the
 * calendar and a regulation, and the types' own `detect` and `parse` for the rest, with `ctx.work` as docprofile hands it.
 * Memory is measured in children (./g140-child.mjs) with the old-space heap capped at what the caller holds plus the
 * bound, so garbage cannot lie; time is taken here, outside the types, and only where the cause names a time. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DOCTYPES, registerDoctypes, staffDirectory, staffReport, regulation, meetingCalendar } from "../index.mjs";
import { allMatches } from "../../docprofile/doctypes/index.mjs";
import { readText } from "../../docprofile/readtext.mjs";
import { registerDoctype } from "../../docprofile/doctypes/registry.mjs";
import * as windows from "../windows.mjs";
import { HELD } from "./fixtures.mjs";
import { sha, thrownText, parseWith } from "./r37-readings.mjs";
import { randomTexts, repeated, addresses, definitions, exceptions, citations, datesPage } from "./r40-texts.mjs";
/** @import { DoctypeContext } from "../../docprofile/doctypes/index.mjs" */
/** @import { ReadingPosition } from "../../bio-plane/src/textchain.mjs" */
/** @import { StaffReportType } from "../staff-report.mjs" */
/** @import { RegulationType } from "../regulation.mjs" */

/**
 * How a child ended, and what it wrote.
 * @typedef {{ code: number | null, signal: string | null, out: string, err: string }} ChildRun
 */
/**
 * What `g140-child.mjs` prints in `base` mode: the heap with the case's text held, and the text's length.
 * @typedef {{ baseMB: number, chars: number }} ChildBase
 */
/**
 * What `g140-child.mjs` prints in `run` mode for the staff directory's cases (`dash`, `oneline`, `csv`).
 * @typedef {Object} DirectorySummary
 * @property {number} chars
 * @property {boolean} match
 * @property {number} detectMs
 * @property {number} work
 * @property {number} entities
 * @property {number} entries
 * @property {boolean} cut
 * @property {number | null} limit
 * @property {number | null} readTo
 * @property {number} longestLine
 * @property {number} lineCut
 * @property {string | null} why
 * @property {string | null} first
 */
/**
 * What `g140-child.mjs` prints in `run` mode for the citations' cases (`cites_staff_report`, `cites_regulation`).
 * @typedef {Object} CitesSummary
 * @property {number} chars
 * @property {number} entities
 * @property {boolean} cut
 * @property {number} skipped
 * @property {number | null} limit
 * @property {number | null} sightingsLimit
 * @property {number} work
 * @property {number} occurrences
 */
/**
 * The part of the module's own fixture `fixtures/r40-answers.json` read here: how many seeded texts, and each type's
 * digests of its detect and its parse on each, by key.
 * @typedef {{ count: number, answers: { [key: string]: Array<[string, string]> } }} R40Answers
 */

const CHILD = fileURLToPath(new URL("./g140-child.mjs", import.meta.url));
const BOUND_MB = 16;
/** The context a type is handed: the held view, the text, a locator that answers each offset as `{at}`, no other type
 *  satisfied, and `extra` over these.
 *  @param {string} text @param {DoctypeContext} [extra] @returns {DoctypeContext} */
const ctxOf = (text, extra) => ({ view: HELD, text, locate: (/** @type {unknown} */ o) => ({ at: o }), alsoSatisfies: () => [], ...extra });
registerDoctypes(registerDoctype);
/** The two answers each type gives. @type {ReadonlyArray<"detect" | "parse">} */
const DETECT_AND_PARSE = ["detect", "parse"];
/** Where a sighting was, as `ctxOf`'s locator recorded it (`{at}`); the `TypeError` reading a missing one raised.
 *  @param {ReadingPosition | null} o @returns {unknown} @throws {TypeError} where there is no sighting */
const sightingAt = (o) => {
  if (o === null) throw new TypeError("Cannot read properties of null (reading 'at')");
  return "at" in o ? o.at : undefined;
};

/** @param {string[]} args @param {string[]} [nodeArgs] @returns {Promise<ChildRun>} */
function child(args, nodeArgs = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [...nodeArgs, CHILD, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (/** @type {Buffer} */ d) => (out += d));
    p.stderr.on("data", (/** @type {Buffer} */ d) => (err += d));
    p.on("close", (/** @type {number | null} */ code, /** @type {string | null} */ signal) => resolve({ code, signal, out, err }));
    setTimeout(() => p.kill("SIGKILL"), 120_000).unref();
  });
}
/** The last line a child printed. @param {ChildRun} r @returns {string} */
const last = (r) => String(r.out.trim().split("\n").pop());
/** The last line of the module's own child, decoded as what its `base` mode prints (R2).
 *  @param {string} line @returns {ChildBase} */
const baseOf = (line) => /** @type {ChildBase} decodes what the module's own child printed */ (JSON.parse(line));
/** The last line of the module's own child, decoded as what its `run` mode prints for the staff directory (R2).
 *  @param {string} line @returns {DirectorySummary} */
const directoryOf = (line) => /** @type {DirectorySummary} decodes what the module's own child printed */ (JSON.parse(line));
/** The last line of the module's own child, decoded as what its `run` mode prints for the citations (R2).
 *  @param {string} line @returns {CitesSummary} */
const citesOf = (line) => /** @type {CitesSummary} decodes what the module's own child printed */ (JSON.parse(line));
/** The module's own fixture `fixtures/r40-answers.json`, decoded (R2). @returns {R40Answers} */
const r40Answers = () => /** @type {R40Answers} decodes the module's own fixture */ (JSON.parse(fs.readFileSync(new URL("./fixtures/r40-answers.json", import.meta.url), "utf8")));
/** Whether a reading carries a list of definitions, as the regulation type's does.
 *  @param {object | null} v @returns {v is { definitions: ReadonlyArray<unknown> }} */
const hasDefinitions = (v) => v !== null && "definitions" in v && Array.isArray(v.definitions);
/** Whether a reading carries a window, as the calendar's does.
 *  @param {object | null} v @returns {v is { window: { from: unknown } }} */
const hasWindow = (v) => {
  if (v === null || !("window" in v)) return false;
  const w = v.window;
  return typeof w === "object" && w !== null;
};
/* The heap the child holds before the work (what the caller holds), then the work under a cap of that plus the bound: a
   reading that needs more dies, and so does this test. The last line the work printed. */
/** @param {string} name @returns {Promise<string>} */
async function capped(name) {
  const idle = await child(["base", name], ["--expose-gc"]);
  assert.equal(idle.code, 0, idle.err);
  const cap = Math.ceil(baseOf(last(idle)).baseMB) + BOUND_MB;
  const r = await child(["run", name], ["--expose-gc", `--max-old-space-size=${cap}`, "--max-semi-space-size=2"]);
  assert.equal(r.code, 0, `${name} needed more than ${BOUND_MB} MB above what the caller holds: ${r.err.slice(-300)}`);
  return last(r);
}
/** The shortest of `n` runs of `fn`, in milliseconds. @param {number} n @param {() => unknown} fn @returns {number} */
const bestOf = (n, fn) => { let best = Infinity; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(); best = Math.min(best, performance.now() - t0); } return best; };

/* ------------------------------------------------------------------ the staff directory's addresses (G140) */

test("R40 R37 the staff directory reads 400,000 characters of a-a-a- in one pass, and counts the work (was 54 s)", async () => {
  const t0 = performance.now();
  const r = await child(["run", "dash"], ["--expose-gc"]);
  const ms = performance.now() - t0;
  assert.equal(r.code, 0, r.err.slice(-300));
  const got = directoryOf(last(r));
  assert.equal(got.match, false);
  assert.ok(ms < 20_000, `${Math.round(ms)} ms`);
  assert.ok(got.work > 0 && got.work <= got.chars, `the work counted: ${got.work} of ${got.chars} characters`);
});

test("R40 R37 16,000 addresses on one line are read within the bound, each entry carries a line cut around its address, and the answer says where it stopped", async () => {
  const got = directoryOf(await capped("oneline"));
  assert.equal(got.match, true);
  assert.equal(got.cut, true);
  assert.ok(got.limit !== null && got.limit > 0 && got.entities === got.limit, `${got.entities} entries of ${got.limit}`);
  assert.ok(got.readTo !== null && got.readTo > 0 && got.readTo < got.chars, "the answer names how far it read");
  assert.equal(typeof got.why, "string");
  assert.ok(got.longestLine <= 600, `the longest line is ${got.longestLine}`);
  assert.equal(got.lineCut, got.entities);
  assert.equal(got.first, "user0@city.gov");
});

test("R40 R37 a 17 MB spreadsheet of distinct addresses adds under 16 MB, and says it read only as far as the bound", async () => {
  const got = directoryOf(await capped("csv"));
  assert.equal(got.match, true);
  assert.equal(got.cut, true);
  assert.equal(got.entities, got.limit);
  assert.ok(got.readTo !== null ? got.readTo < got.chars : 0 < got.chars);
  assert.ok(got.work > 0 && got.work <= got.chars, `the work counted: ${got.work} of ${got.chars}`);
});

test("R40 a directory below the bound is read whole: every address, no cut, the lines as they stand", () => {
  const text = addresses(300, "\n") + "\nStaff Directory\n";
  const d = staffDirectory;
  assert.equal(d.detect({ view: HELD, text }).match, true);
  const p = d.parse(ctxOf(text));
  assert.equal(p.entities.length, 300);
  assert.equal(p.entries, 300);
  assert.equal(p.entries_cut, undefined);
  const e299 = p.entities[299];
  if (!e299) throw new TypeError("Cannot read properties of undefined (reading 'key')");
  assert.equal(e299.key, "user299@city.gov");
  assert.equal(e299.facts.line, "Person 299 <user299@city.gov> (510) 555-" + (1000 + 299));
  assert.equal(e299.facts.line_cut, undefined);
});

/* The addresses found are the ones a global pattern of the same shape finds: the pattern the reader used before it was
   made linear stands here as the specification. */
test("R40 the staff directory finds the addresses a global pattern finds, whatever surrounds them", () => {
  const SPEC = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})\b/g;
  const d = staffDirectory;
  let checked = 0, withAddresses = 0;
  for (const text of randomTexts(600)) {
    /** @type {Map<string, number>} */
    const want = new Map();
    for (const m of text.matchAll(SPEC)) {
      const a = m[0].toLowerCase().replace(/\.+$/, "");
      if (!want.has(a)) want.set(a, m[0].length ? m.index : 0);
    }
    const got = d.parse(ctxOf(text));
    assert.deepEqual(got.entities.map((e) => e.key), [...want.keys()], JSON.stringify(text));
    checked++;
    if (want.size) withAddresses++;
  }
  assert.ok(withAddresses > 150, `${withAddresses} of ${checked} texts held an address`);
});

/* ------------------------------------------------------------ the answers are the tranche tip's (R37, R40, R41) */

test("R37 R40 R41 every type's detect and parse on the seeded texts equal the tranche tip's", () => {
  const gold = r40Answers();
  const texts = randomTexts(gold.count);
  let compared = 0;
  const longLine = /** @param {string} t @returns {boolean} */ (t) => t.split("\n").some((l) => l.length > 600);
  for (const t of DOCTYPES) {
    if (t.key === "generic") continue;
    texts.forEach((text, i) => {
      const rows = gold.answers[t.key];
      if (rows === undefined) throw new TypeError(`Cannot read properties of undefined (reading '${i}')`);
      const row = rows[i];
      if (row === undefined) throw new TypeError("undefined is not iterable (cannot read property Symbol(Symbol.iterator))");
      const [wantDetect, wantParse] = row;
      /** @type {string} */
      let d;
      /** @type {string} */
      let p;
      try { d = sha(t.detect({ view: HELD, text })); } catch (e) { d = `threw:${thrownText(e).slice(0, 40)}`; }
      assert.equal(d.slice(0, 16), wantDetect, `${t.key} detect ${i}`);
      try { p = sha(parseWith(t, ctxOf(text))); } catch (e) { p = `threw:${thrownText(e).slice(0, 40)}`; }
      /* A line over the longest `line` an entry carries is cut now, and says so (R40): the one answer that differs. */
      if (!(t.key === "staff_directory" && longLine(text))) assert.equal(p.slice(0, 16), wantParse, `${t.key} parse ${i}`);
      compared++;
    });
  }
  assert.ok(compared >= 4000, `${compared} answers compared`);
});

/* ------------------------------------------------------------------------ definitions and exceptions (G140) */

test("R40 R37 40,000 definitions are read in work linear in the text (4 times the definitions take under 10 times as long)", () => {
  const reg = regulation;
  const small = definitions(20_000), big = definitions(80_000);
  const work = { chars: 0, limit: Infinity };
  const p = reg.parse(ctxOf(big, { work }));
  assert.equal(p.definitions.length, 80_000);
  assert.ok(work.chars > 0 && work.chars <= 12 * big.length, `the work counted: ${work.chars} of ${big.length} characters`);
  const ts = bestOf(3, () => reg.parse(ctxOf(small))), tb = bestOf(3, () => reg.parse(ctxOf(big)));
  assert.ok(tb < 10 * Math.max(ts, 20), `20,000 definitions ${Math.round(ts)} ms, 80,000 ${Math.round(tb)} ms`);
});

test("R40 R37 exceptions, one to a line or all on one line, are read in work linear in the text", () => {
  const reg = regulation;
  for (const oneLine of [false, true]) {
    const small = exceptions(5_000, oneLine), big = exceptions(20_000, oneLine);
    const p = reg.parse(ctxOf(big));
    assert.equal(p.exceptions.length, 20_000, `one line ${oneLine}`);
    const lastException = p.exceptions[19_999];
    if (!lastException) throw new TypeError("Cannot read properties of undefined (reading 'section')");
    assert.deepEqual(lastException.section, ["1"]);
    const ts = bestOf(3, () => reg.parse(ctxOf(small))), tb = bestOf(3, () => reg.parse(ctxOf(big)));
    assert.ok(tb < 10 * Math.max(ts, 20), `one line ${oneLine}: 5,000 exceptions ${Math.round(ts)} ms, 20,000 ${Math.round(tb)} ms`);
  }
});

test("R40 a text of quoted words with no verb to define them is read in work linear in the text", () => {
  const reg = regulation;
  const text = "The City Council does hereby ordain as follows:\n" + repeated('"a" ', 100_000);
  const t0 = performance.now();
  const p = reg.parse(ctxOf(text));
  assert.equal(p.definitions.length, 0);
  assert.ok(performance.now() - t0 < 5_000, `${Math.round(performance.now() - t0)} ms`);
});

test("R40 the real entry path reads 5,000 definitions as definitions of an instrument", () => {
  const r = readText(definitions(5_000));
  if (!("doctype" in r)) throw new TypeError("Cannot read properties of undefined (reading 'type')");
  assert.equal(r.doctype.type.key, "regulation");
  assert.equal(r.parse_error, null);
  const parsed = r.parsed;
  if (!hasDefinitions(parsed)) throw new TypeError(parsed === null ? "Cannot read properties of null (reading 'definitions')" : "Cannot read properties of undefined (reading 'length')");
  assert.equal(parsed.definitions.length, 5_000);
});

/* --------------------------------------------------------------------------------------- the references (G140) */

test("R40 R37 400,000 citations are read a window at a time: the staff report's parse adds under 16 MB, and says what it did not keep", async () => {
  const got = citesOf(await capped("cites_staff_report"));
  assert.equal(got.entities, 50);
  assert.equal(got.cut, true);
  assert.ok(got.skipped > 0 && got.skipped < 400_000);
  assert.ok(got.limit !== null && got.limit > 0 && got.sightingsLimit !== null && got.sightingsLimit > 0);
  assert.ok(got.work > 0 && got.work <= 12 * got.chars, `the work counted: ${got.work} of ${got.chars}`);
});

test("R40 R37 400,000 citations are read a window at a time: the regulation's parse adds under 16 MB, and says what it did not keep", async () => {
  const got = citesOf(await capped("cites_regulation"));
  assert.equal(got.entities, 50);
  assert.equal(got.cut, true);
  assert.ok(got.skipped > 0 && got.skipped < 400_000);
});

test("R40 citations below the bounds are all kept: every reference once, every sighting of it in reading order", () => {
  /** @type {Array<[string, StaffReportType | RegulationType]>} */
  const readers = [["staff_report", staffReport], ["regulation", regulation]];
  for (const [key, reader] of readers) {
    const p = reader.parse(ctxOf(citations(3_000)));
    assert.equal(p.entities.length, 50, key);
    assert.equal(p.references_cut, undefined, key);
    const first = p.entities[0];
    if (!first) throw new TypeError("Cannot read properties of undefined (reading 'occurrences')");
    const occurrences = first.occurrences;
    if (!occurrences) throw new TypeError(`Cannot read properties of ${occurrences} (reading 'length')`);
    assert.equal(occurrences.length, 60, key);
    const at = occurrences.map((o) => sightingAt(o));
    assert.deepEqual(at, [...at].sort((a, b) => Number(a) - Number(b)), key);
  }
});

/* The windows give the matches a pass over the whole text gives. */
test("R40 the windows of raw text give the matches allMatches gives over all of it, whatever the cuts", () => {
  /** @returns {Array<{ re: RegExp, tag: string }>} */
  const tagged = () => [{ re: /\bOrdinance\s+No\.\s*(\d+)/gi, tag: "o" }, { re: /No\.\s*(\d+)\s+C\.M\.S\./g, tag: "c" }, { re: /\bSection\s+\d+(?:\.\d+)*/g, tag: "s" }];
  const words = ["Ordinance No. 13000", " C.M.S.", " ", "\n", "Section 2.20.030", "see ", "No. 5 C.M.S.", "x", "  \n ", "Ordinance\nNo. 7", "ordinance no. 8"];
  let seed = 5;
  const rnd = /** @param {number} n @returns {number} */ (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 120; round++) {
    let text = "";
    for (let i = 0, n = 10 + rnd(120); i < n; i++) text += words[rnd(words.length)];
    const want = allMatches(tagged(), text).map((h) => [h.m.index, h.m[0], h.tag]);
    for (const opts of [{ chunk: 7, pad: 48 }, { chunk: 40, pad: 64 }, { chunk: 100, pad: 100 }, {}]) {
      /** @type {Array<[number, string, string]>} */
      const got = [];
      windows.rawMergedHits(text, tagged(), ({ m, tag }) => { got.push([m.index, m[0], tag]); }, opts);
      assert.deepEqual(got, want, JSON.stringify([text, opts]));
    }
  }
});

/* ---------------------------------------------------------------------------------------------- the work count */

test("R40 every type's detect and parse add the characters they examine to ctx.work.chars, in work that does not depend on the text's shape", () => {
  const n = 60_000;
  const prose = repeated("The office keeps the papers of each matter in the file kept for it.\n", n);
  /** @type {{ [shape: string]: string }} */
  const shapes = {
    prose,
    dashes: repeated("a-", n), tags: repeated("<div", n), quoted: repeated('"a" ', n), addresses: repeated("a@b.co, ", n),
    dates: repeated("1/2/2026 ", n), whereas: repeated("WHEREAS ", n), newlines: repeated("\n", n), cites: repeated("Ordinance No. 13000 C.M.S. ", n),
    outline: repeated("A. ", n), capsEndingInNumbers: repeated("A 1 ", n),
    /* a verb at the end of a line of quoted words, and a policy's header followed by blank lines */
    chain: repeated('"a" ', n) + " x means", header: "Administrative Instruction\nNumber 71\n" + repeated("\n", n),
  };
  for (const t of DOCTYPES) {
    if (t.key === "generic") continue;
    for (const [shape, text] of Object.entries(shapes)) {
      for (const fn of DETECT_AND_PARSE) {
        const work = { chars: 0, limit: Infinity };
        const t0 = performance.now();
        if (fn === "detect") t.detect(ctxOf(text, { work })); else parseWith(t, ctxOf(text, { work }));
        const ms = performance.now() - t0;
        assert.ok(ms < 5_000, `${t.key} ${fn} on ${shape}: ${Math.round(ms)} ms`);
        assert.ok(work.chars > 0 || fn === "parse", `${t.key} ${fn} on ${shape} counted nothing`);
        /* a detect is charged the window once, a parse every pass it makes */
        assert.ok(work.chars <= (fn === "detect" ? 1 : 12) * text.length, `${t.key} ${fn} on ${shape}: ${work.chars} characters counted for ${text.length}`);
      }
    }
  }
  /* Without a counter nothing is counted and nothing is needed. */
  for (const t of DOCTYPES) if (t.key !== "generic") t.detect({ view: HELD, text: prose });
});

/* ---------------------------------------------------------------------------------------------- the calendar */

test("R41 the calendar's window is the first and the last of its dates, for any number of them: 150,000 are read and nothing throws", () => {
  const cal = meetingCalendar;
  const day = Date.UTC(2026, 0, 2);
  const parsed = cal.parse({ view: HELD, text: datesPage(150_000) });
  assert.equal(parsed.window.from, day);
  assert.equal(parsed.window.to, day);
  /* detect and assess answer for the same page */
  assert.equal(cal.detect({ view: HELD, text: datesPage(150_000) }).match, true);
  assert.doesNotThrow(() => cal.assess(parsed, parsed, ctxOf("")));
  /* through docprofile, as the plane reads a page */
  const r = readText(datesPage(150_000));
  if (!("doctype" in r)) throw new TypeError("Cannot read properties of undefined (reading 'type')");
  assert.equal(r.doctype.type.key, "meeting_calendar");
  assert.equal(r.parse_error, null);
  const parsed2 = r.parsed;
  if (!hasWindow(parsed2)) throw new TypeError(parsed2 === null ? "Cannot read properties of null (reading 'window')" : "Cannot read properties of undefined (reading 'from')");
  assert.equal(parsed2.window.from, day);
});

test("R41 the window of a few dates is what Math.min and Math.max made it, a date that is not a number included", () => {
  const cal = meetingCalendar;
  let seed = 3;
  const rnd = /** @param {number} n @returns {number} */ (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 80; round++) {
    /** @type {string[]} */
    const dates = [];
    for (let i = 0, n = rnd(9); i < n; i++) dates.push(`${1 + rnd(12)}/${1 + rnd(28)}/${2020 + rnd(8)}`);
    if (rnd(5) === 0) dates.push("99/99/2026");
    const page = `<main>${dates.map((d) => `<td>${d}</td>`).join(" ")}</main>`;
    const ms = dates.map((d) => { const [m = NaN, dd = NaN, y = NaN] = d.split("/").map(Number); return Date.UTC(y, m - 1, dd); });
    const w = cal.parse({ view: HELD, text: page }).window;
    assert.deepEqual([w.from, w.to].map((x) => (x === null ? null : Number.isNaN(x) ? "nan" : x)),
                     ms.length ? [Math.min(...ms), Math.max(...ms)].map((x) => (Number.isNaN(x) ? "nan" : x)) : [null, null], page);
  }
});

test("R41 R40 a page of 50,000 rows that never close and a main that never opens is read in work linear in the page", () => {
  const cal = meetingCalendar;
  for (const text of [repeated("<tr>", 200_000), repeated("<main>", 200_000), repeated("<tr><td>", 200_000)]) {
    const t0 = performance.now();
    cal.parse({ view: HELD, text });
    assert.ok(performance.now() - t0 < 2_000, `${Math.round(performance.now() - t0)} ms`);
  }
});
