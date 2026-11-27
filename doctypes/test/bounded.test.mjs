/* doctypes — requirement-named tests for R37 (a type's own work over a large text is bounded), at the module's
 * interface: the types' `detect` and `parse`, and docprofile's `readText` over the types. Memory is measured in
 * children (./r37-child.mjs) with the old-space heap capped at what the caller holds plus the bound, so garbage cannot
 * lie: a reading that needs more than the bound dies. The real files are the govinfo budget volumes pdf-reader's
 * memory test fetches (fetched once into BIO_FIXTURE_CACHE, default the temporary directory, checked by SHA-256). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DOCTYPES } from "../index.mjs";
import { allMatches, flatten, CONTRACT } from "../../docprofile/doctypes/index.mjs";
import { CONFIDENCE } from "../../site-profiles/index.mjs";
import { readText, flattenText } from "../../docprofile/readtext.mjs";
import { registerDoctype } from "../../docprofile/doctypes/registry.mjs";
import { flatHas, flatCount, flatFirst, flatPrefix, mergedHits, eachLine, lineTable, lineIndex, flatWindows } from "../windows.mjs";
import { sha256Hex, textDigest } from "../sections.mjs";
import { fixtureReadings, answerOf, parseWith } from "./r37-readings.mjs";
import { parsesOf } from "./r38-readings.mjs";
import { CASES } from "./golden-cases.mjs";
/** @import { ContentType, SuppliedPage } from "../../docprofile/doctypes/index.mjs" */
/** @import { ScanCut } from "../windows.mjs" */
/** @import { ReadingAnswer, TextAnswer } from "./r37-readings.mjs" */
/** @import { Parses } from "./r38-readings.mjs" */
/** @import { LargeKind } from "./r38-texts.mjs" */

/**
 * How a child ended, and what it wrote.
 * @typedef {{ code: number | null, signal: string | null, out: string, err: string }} ChildRun
 */
/**
 * What a child prints in a `base` or `readbase` mode: the heap it holds before the work, in MB.
 * @typedef {{ baseMB: number }} ChildBase
 */
/**
 * What `r37-child.mjs` prints in its `types` mode, and `r38-child.mjs` in its `parse` mode (with the digest of the parse).
 * @typedef {{ ok: boolean, chars: number, digest?: string }} ChildDone
 */
/**
 * The part of the module's own fixture `fixtures/r37-answers.json` read here: the answers on each fixture reading, by id.
 * @typedef {{ readings: { [id: string]: ReadingAnswer } }} R37Answers
 */
/**
 * The part of the module's own fixture `fixtures/r38-answers.json` read here: the parses on each fixture reading, by id,
 * and the digest of the parse of each large text, by kind.
 * @typedef {{ readings: { [id: string]: Parses }, large: { [kind: string]: string } }} R38Answers
 */
/**
 * One govinfo volume measured: its name, the SHA-256 of the file, and the answer readText gave on it.
 * @typedef {{ name: string, sha: string, answer: TextAnswer | { determined: boolean, chars: number, also: string[], signals: string, parsed: string, parse_error: string | null } }} RealVolume
 */

const CHILD = fileURLToPath(new URL("./r37-child.mjs", import.meta.url));
const CHILD38 = fileURLToPath(new URL("./r38-child.mjs", import.meta.url));
const CACHE = process.env.BIO_FIXTURE_CACHE || path.join(os.tmpdir(), "bio-test-fixtures");
/** Where govinfo serves the volume `n`. @param {string} n @returns {string} */
const GOVINFO = (n) => `https://www.govinfo.gov/content/pkg/${n}/pdf/${n}.pdf`;
const BOUND_MB = 16;

/** The module's own fixture `fixtures/r37-answers.json`, decoded (R2). @returns {R37Answers} */
const r37Answers = () => /** @type {R37Answers} decodes the module's own fixture */ (JSON.parse(fs.readFileSync(new URL("./fixtures/r37-answers.json", import.meta.url), "utf8")));
/** The module's own fixture `fixtures/r38-answers.json`, decoded (R2). @returns {R38Answers} */
const r38Answers = () => /** @type {R38Answers} decodes the module's own fixture */ (JSON.parse(fs.readFileSync(new URL("./fixtures/r38-answers.json", import.meta.url), "utf8")));
/** The last line a child printed. @param {ChildRun} r @returns {string} */
const lastLine = (r) => String(r.out.trim().split("\n").pop());
/** The last line of the module's own child, decoded as what a `base` mode prints (R2).
 *  @param {string} line @returns {ChildBase} */
const baseOf = (line) => /** @type {ChildBase} decodes what the module's own child printed */ (JSON.parse(line));
/** The last line of the module's own child, decoded as what its work mode prints (R2).
 *  @param {string} line @returns {ChildDone} */
const doneOf = (line) => /** @type {ChildDone} decodes what the module's own child printed */ (JSON.parse(line));
/** The last line of the module's own child, decoded as the answer of readText it prints (R2).
 *  @param {string} line @returns {TextAnswer} */
const textAnswerIn = (line) => /** @type {TextAnswer} decodes what the module's own child printed */ (JSON.parse(line));

/* ------------------------------------------------------------------ the answers are the tranche tip's */

test("R37 every type's detect, and the registry's verdict with the winner's parse, equal the tranche tip's on every fixture", () => {
  const gold = r37Answers().readings;
  const readings = fixtureReadings();
  assert.ok(readings.length >= 150);
  for (const r of readings) assert.deepEqual(answerOf(r), gold[r.id], r.id);
  assert.equal(Object.keys(gold).length, readings.length);
});

/* The windows are the whole text's: every primitive, over texts whose runs of white space, phrases and matches fall on
   the cuts, with windows of a few characters. */
test("R37 the windows give the answers a pass over the whole flattened text gives, whatever the cuts", () => {
  const words = ["alpha", "WHEREAS", "motion was", "made by", "Aye:", "No :", "x", "  ", "\n", "\t\n ", "NOW,", "THEREFORE", "DOES", "ORDAIN", "42", "_"];
  let seed = 7;
  const rnd = /** @param {number} n @returns {number} */ (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  /** @type {ReadonlyArray<ScanCut>} */
  const cuts = [{ chunk: 1, pad: 24 }, { chunk: 5, pad: 40 }, { chunk: 17, pad: 64 }, { chunk: 64, pad: 64 }, {}];
  const re = /\bWHEREAS\b|\bmotion\s+was\s+made\b|\b(Aye|No)\s*:/gi;
  for (let round = 0; round < 60; round++) {
    let text = "";
    for (let i = 0, n = 20 + rnd(200); i < n; i++) text += words[rnd(words.length)] + (rnd(3) ? " " : "");
    const flat = flatten(text);
    for (const opts of cuts) {
      const g = new RegExp(re.source, re.flags);
      const all = [...flat.matchAll(g)];
      assert.equal(flatCount(text, re, Infinity, opts), all.length, JSON.stringify([text, opts]));
      assert.equal(flatHas(text, /\bmotion\s+was\s+made\b/i, opts), /\bmotion\s+was\s+made\b/i.test(flat));
      const first = flatFirst(text, /NOW,\s+THEREFORE\s+DOES/i, opts);
      const m = /NOW,\s+THEREFORE\s+DOES/i.exec(flat);
      assert.equal(first ? first.m[0] : null, m ? m[0] : null);
      assert.equal(first ? first.abs : -1, m ? m.index : -1);
      assert.equal(flatPrefix(text, 30), flat.slice(0, 30));
      /** @type {Array<[number, string, number]>} */
      const mine = [];
      const ref = allMatches([{ re: new RegExp(re.source, re.flags), tag: 1 }, { re: /\bNOW,\s+THEREFORE\b/gi, tag: 2 }], flat);
      mergedHits(text, [{ re: new RegExp(re.source, re.flags), tag: 1 }, { re: /\bNOW,\s+THEREFORE\b/gi, tag: 2 }],
                 ({ m: hit, tag }, abs) => { mine.push([abs, hit[0], tag]); }, opts);
      assert.deepEqual(mine, ref.map((h) => [h.m.index, h.m[0], h.tag]));
      assert.equal([...flatWindows(text, opts)].map((w) => w.buf.slice(w.from, w.to)).join(""), flat, "the windows' cores are the flatten");
    }
    const lines = text.split(/\r?\n/);
    /** @type {string[]} */
    const seen = [];
    eachLine(text, (l, at, i) => { seen.push(l); assert.equal(text.slice(at, at + l.length), l); assert.equal(seen.length - 1, i); });
    assert.deepEqual(seen, lines);
    const table = lineTable(text);
    assert.equal(table.length, lines.length);
    for (const [i, line] of lines.entries()) assert.equal(table.get(i), line.trim());
  }
});

/* A document with a long stretch of text before, after or around it is the same document: padded so that every cut
   falls somewhere in the fixture, each type's detect gives its answer, and a parse that reads lines gives its. */
test("R37 padding a fixture with a long text that says nothing leaves each type's answer as it was, wherever the windows cut it", () => {
  const filler = /** @param {number} n @returns {string} */ (n) => { const l = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod\n"; return l.repeat(Math.ceil(n / l.length)).slice(0, n); };
  const pads = [1, 251, 262_100, 262_143, 524_288 - 37, 900_001];
  const cases = CASES.filter((c) => c.view === "held" || c.view === "pa");
  let checked = 0;
  for (const c of cases) {
    const text = flattenText(c.supplied).text;
    if (text.length > 20_000) continue;
    for (const t of DOCTYPES) {
      if (t.key === "generic") continue;
      const base = JSON.stringify(t.detect({ ...c.ctx, text }));
      for (const n of pads) {
        const f = filler(n);
        /* A memorandum header, a title line and a code's opening heading are read from the top of a document, so a long
           text before them is a different document for those types. */
        if (["meeting_calendar", "meeting_minutes", "meeting_agenda", "policy"].includes(t.key))
          assert.equal(JSON.stringify(t.detect({ ...c.ctx, text: f + "\n" + text })), base, `${c.id} ${t.key} leading ${n}`);
        assert.equal(JSON.stringify(t.detect({ ...c.ctx, text: text + "\n" + f })), base, `${c.id} ${t.key} trailing ${n}`);
        const half = Math.floor(text.length / 2), cut = text.lastIndexOf("\n", half) + 1;
        assert.equal(JSON.stringify(t.detect({ ...c.ctx, text: text.slice(0, cut) + f + "\n" + text.slice(cut) })), base, `${c.id} ${t.key} within ${n}`);
        checked++;
      }
      if (["meeting_minutes", "meeting_agenda", "staff_report", "staff_directory"].includes(t.key)) {
        const ref = JSON.stringify(parseWith(t, { ...c.ctx, text, locate: (/** @type {unknown} */ o) => ({ at: o }), alsoSatisfies: () => [] }));
        for (const n of pads)
          assert.equal(JSON.stringify(parseWith(t, { ...c.ctx, text: text + "\n" + filler(n), locate: (/** @type {unknown} */ o) => ({ at: o }), alsoSatisfies: () => [] })), ref, `${c.id} ${t.key} parse ${n}`);
      }
    }
  }
  assert.ok(checked > 500, `${checked} padded readings`);
});

/* ------------------------------------------------------------------------------------------- memory */

/** @param {string[]} args @param {string[]} [nodeArgs] @param {string} [file] @returns {Promise<ChildRun>} */
function child(args, nodeArgs = [], file = CHILD) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [...nodeArgs, file, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (/** @type {Buffer} */ d) => (out += d));
    p.stderr.on("data", (/** @type {Buffer} */ d) => (err += d));
    p.on("close", (/** @type {number | null} */ code, /** @type {string | null} */ signal) => resolve({ code, signal, out, err }));
  });
}
/** @param {string | Uint8Array} b @returns {string} */
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
/** The govinfo volume `name`, fetched once into the cache and checked by its SHA-256: its path.
 *  @param {string} name @param {string} sha @returns {Promise<string>} */
async function fixture(name, sha) {
  const file = path.join(CACHE, `${name}.pdf`);
  if (fs.existsSync(file) && sha256(fs.readFileSync(file)) === sha) return file;
  fs.mkdirSync(CACHE, { recursive: true });
  const res = await fetch(GOVINFO(name));
  assert.ok(res.ok, `${name}: ${GOVINFO(name)} answered ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(sha256(body), sha, `${name}: the file fetched is not the file measured`);
  fs.writeFileSync(`${file}.part`, body);
  fs.renameSync(`${file}.part`, file);
  return file;
}
/* The heap the child holds before the work (what the caller holds), then the work under a cap of that plus the bound:
   a reading that needs more dies, and so does this test. */
/** @param {string} baseMode @param {string} mode @param {string[]} [args] @param {string} [file] @returns {Promise<ChildRun>} */
async function capped(baseMode, mode, args = [], file = CHILD) {
  const idle = await child([baseMode, ...args], ["--expose-gc"], file);
  assert.equal(idle.code, 0, idle.err);
  const base = baseOf(lastLine(idle)).baseMB;
  const cap = Math.ceil(base) + BOUND_MB;
  return child([mode, ...args], ["--expose-gc", `--max-old-space-size=${cap}`, "--max-semi-space-size=2"], file);
}

test("R37 every type's detect, and the parse of those that read lines, over 14 million characters add under 16 MB", async () => {
  const r = await capped("base", "types");
  assert.equal(r.code, 0, `the types needed more than ${BOUND_MB} MB above what the caller holds: ${r.err.slice(-400)}`);
  assert.equal(doneOf(lastLine(r)).ok, true);
});

/* The answers of docprofile's readText over the three govinfo volumes, as the tranche tip gave them. */
/** @type {RealVolume[]} */
const REAL = [
  { name: "BUDGET-2025-BUD", sha: "3f1df41cfa3cebfd675b2a6ed673b6f665e0848c293d8d3bb5ab1815a0bae36b",
    answer: { determined: false, chars: 3235, also: [], signals: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b", parsed: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b", parse_error: null } },
  { name: "BUDGET-2025-PER", sha: "067ad707534788e9011d4b6abdb686f1c3505888218e2ca5327c04e0ad58ae7f",
    answer: { determined: false, chars: 17408, also: [], signals: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b", parsed: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b", parse_error: null } },
  { name: "BUDGET-2024-APP", sha: "6e0b3dc5f2f3f5bbab8ae5032bbc29207a8dbb290ba25ebafe3feb20dfe13c1e",
    answer: { determined: true, chars: 12319700, type: "regulation", confidence: /** @copyof site-profiles:CONFIDENCE */ "certain", also: [], signals: "314659c00571926403e38ff4d24f05939e4294d066e4390b5cf2f697a7ac2503", parsed: "af29de986f0ef6df1a529091a2d5c6e629cec25d655a0020823cc5c1fb764251", parse_error: null } },
];

test("R37 readText over the three govinfo volumes, every type registered, answers as the tranche tip did", async () => {
  for (const f of REAL) {
    const file = await fixture(f.name, f.sha);
    const r = await child(["answer", file], ["--max-old-space-size=4096"]);
    assert.equal(r.code, 0, r.err.slice(-400));
    assert.deepEqual(textAnswerIn(lastLine(r)), f.answer, f.name);
  }
});

/* The 16 MB is for the whole reading, docprofile's own work included, so it is asserted once docprofile hands the types
   `ctx.pages` (its R38); until then the types' own part above is what is measured. */
/** @returns {Promise<boolean>} */
async function docprofileHandsPages() {
  /** The pages the probe's detect was handed, once it has run. @type {Array<ReadonlyArray<SuppliedPage> | undefined>} */
  const seen = [];
  /** @type {ContentType} */
  const probe = { key: "r37_probe", label: "probe", version: 1, contract: CONTRACT.SUBSTANCE, detect: (ctx) => { seen[0] = ctx.pages; return { match: false, confidence: CONFIDENCE.NONE }; },
                  parse: () => ({}), assess: () => ({}) };
  registerDoctype(probe);
  readText({ document: "a\nb", pages: [{ page: 1, text: "a" }, { page: 2, text: "b" }] });
  return Array.isArray(seen[0]);
}

test("R37 readText over BUDGET-2024-APP, every type registered, adds under 16 MB (once docprofile R38 hands the types ctx.pages)", async (t) => {
  if (!(await docprofileHandsPages())) { t.skip("docprofile R38 is not merged here: readText still makes its own whole-text copies"); return; }
  const real = REAL[2];
  if (!real) throw new TypeError("Cannot read properties of undefined (reading 'name')");
  const file = await fixture(real.name, real.sha);
  const json = path.join(CACHE, `${real.name}.reading.json`);
  if (!fs.existsSync(json)) {
    const d = await child(["dump", file, `${json}.part`], ["--max-old-space-size=4096"]);
    assert.equal(d.code, 0, d.err.slice(-400));
    fs.renameSync(`${json}.part`, json);
  }
  const r = await capped("readbase", "read", [json]);
  assert.equal(r.code, 0, `the reading needed more than ${BOUND_MB} MB above what the caller holds: ${r.err.slice(-400)}`);
  assert.deepEqual(textAnswerIn(lastLine(r)), real.answer);
});

/* ----------------------------------------------------------------------------------------------------------- R38 */

test("R38 the policy and the regulation type parse every fixture reading as they parsed it before their lines were held as offsets", () => {
  const gold = r38Answers().readings;
  const readings = fixtureReadings();
  assert.ok(readings.length >= 150);
  for (const r of readings) assert.deepEqual(parsesOf(r), gold[r.id], r.id);
  assert.equal(Object.keys(gold).length, readings.length);
});

/* The lines of a text, held as offsets, are the lines `split("\n")` gives, and the digest of a slice read a piece at a
   time is the digest of the slice normalised whole, whatever the pieces. */
test("R38 a text's lines held as offsets are the lines split gives, and a digest read in pieces is the whole slice's", () => {
  const words = ["alpha", " ", "  ", "\n", "\r\n", "\n\n", "\t", "x", "\u{1F600}", "\u00e9", "\u00a0", "\ud800", "\udc00", "lorem ipsum"];
  let seed = 11;
  const rnd = /** @param {number} n @returns {number} */ (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 300; round++) {
    let text = "";
    for (let i = 0, n = rnd(60); i < n; i++) text += words[rnd(words.length)];
    const lines = text.split("\n");
    const idx = lineIndex(text);
    assert.equal(idx.length, lines.length);
    let at = 0;
    for (const [i, line] of lines.entries()) {
      assert.deepEqual(idx.at(i), { start: at, end: at + line.length, text: line });
      for (let o = at; o <= at + line.length; o++) assert.equal(idx.lineOf(o), i, `${JSON.stringify(text)} @${o}`);
      at += line.length + 1;
    }
    assert.equal(idx.lineOf(text.length + 1), -1);
    const a = rnd(text.length + 1), b = a + rnd(text.length - a + 1);
    const want = sha256Hex(text.slice(a, b).replace(/\s+/g, " ").trim());
    for (const piece of [1, 2, 3, 5, 17, undefined]) assert.equal(textDigest(text, a, b, piece), want, `${JSON.stringify(text.slice(a, b))} piece ${piece}`);
  }
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_003]) {
    const t = "x".repeat(len);
    assert.equal(sha256Hex(t), createHash("sha256").update(t).digest("hex"), String(len));
    assert.equal(textDigest(t, 0, len, 7), sha256Hex(t));
  }
});

/* A text of 13.6 million characters that the type recognises: a fixture document with prose put inside it
   (./r38-texts.mjs). The parse adds under 16 MB to what the caller holds, and its answer is the one the parse gave before
   (fixtures/r38-answers.json). */
/** The test of the large text of `kind` (./r38-texts.mjs, the kinds in its order: policy, regulation, code).
 *  @param {LargeKind} kind @returns {() => Promise<void>} */
const largeParse = (kind) => async () => {
  const gold = r38Answers().large[kind];
  const r = await capped("base", "parse", [kind], CHILD38);
  assert.equal(r.code, 0, `the parse needed more than ${BOUND_MB} MB above what the caller holds: ${r.err.slice(-400)}`);
  const got = doneOf(lastLine(r));
  assert.equal(got.ok, true);
  assert.ok(got.chars >= 13_600_000);
  assert.equal(got.digest, gold);
};
test("R38 the parse of a policy text of 13.6 million characters recognised as a policy adds under 16 MB, and its answer is unchanged", largeParse("policy"));
test("R38 the parse of a regulation text of 13.6 million characters recognised as a regulation adds under 16 MB, and its answer is unchanged", largeParse("regulation"));
test("R38 the parse of a code text of 13.6 million characters recognised as a regulation adds under 16 MB, and its answer is unchanged", largeParse("code"));
