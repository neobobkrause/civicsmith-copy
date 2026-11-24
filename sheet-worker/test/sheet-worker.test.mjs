/* sheet-worker at its interface (build/requirements/sheet-worker.md), with the real engine compiled from the vendored
 * wasm under node. The committed bundle under workerd is `worker.test.mjs`; the corpus fixtures are `corpus.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { parseJsonc } from "../../bio-plane/scripts/jsonc.mjs";
import * as contract from "../src/contract.mjs";
import * as limits from "../src/limits.mjs";
import { READ_BOUNDS, boundOf } from "../../bio-plane/src/read-bounds.mjs";
import { moduleCheck } from "../src/enginecore.mjs";
import { withEngineSection } from "../scripts/build-engine.mjs";
import { workbook, zip } from "./xlsx.mjs";
import {
  MEMBER_DIR, MODULE, ON, SHA, WASM_FILE, bucket, call, fixture, makeEngine, makeMember, post, realEngine,
  recomputeVia, spied,
} from "./helpers.mjs";

const { MAX_CELLS, MAX_UNZIPPED_BYTES, TIME_BUDGET_MS, NAMESPACES, PLANE_OPS, REFUSALS, NOT_RECOMPUTED } = contract;
const member = (opts) => makeMember(realEngine(), opts);
const small = (cells, extra = {}) => workbook({ sheets: [{ name: "S", cells }], ...extra });
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

/* ---- R1: request checks ------------------------------------------------------------------------------------- */

test("R1: capture_sha must be exactly 64 hex characters, lower-cased, else BAD_SHA (400) before R2 is addressed", async () => {
  const m = member();
  for (const body of [{}, { capture_sha: 7, store: "bio" }, { capture_sha: "ab".repeat(31), store: "bio" },
    { capture_sha: "ab".repeat(32) + "a", store: "bio" }, { capture_sha: "zz".repeat(32), store: "bio" }, "not json", "null"]) {
    const r2 = bucket();
    const r = await call(m, post(body), { ...ON, CAPTURES: r2.binding });
    assert.equal(r.status, 400); assert.equal(r.body.reason, "BAD_SHA"); assert.equal(r.body.ok, false);
    assert.deepEqual(r2.calls, []);
  }
  const r2 = bucket({ [`bio/captures/${SHA}`]: small([{ r: "A1", f: "1+1", v: 2 }]) });
  const r = await call(m, post({ capture_sha: SHA.toUpperCase(), store: "bio" }), { ...ON, CAPTURES: r2.binding });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.deepEqual(r2.calls, [["get", `bio/captures/${SHA}`]]);
});

test("R1: store must be a string (BAD_STORE, 400) and exactly \"bio\" or \"scratch\" (NAMESPACE_UNKNOWN, 400), before R2 is addressed", async () => {
  const m = member();
  for (const store of [undefined, null, 3, ["bio"], {}]) {
    const r2 = bucket();
    const r = await call(m, post({ capture_sha: SHA, store }), { ...ON, CAPTURES: r2.binding });
    assert.equal(r.status, 400); assert.equal(r.body.reason, "BAD_STORE"); assert.deepEqual(r2.calls, []);
  }
  for (const store of ["", "Bio", "BIO", "scratch ", "biosmoke", "bio/x"]) {
    const r2 = bucket();
    const r = await call(m, post({ capture_sha: SHA, store }), { ...ON, CAPTURES: r2.binding });
    assert.equal(r.status, 400); assert.equal(r.body.reason, "NAMESPACE_UNKNOWN");
    assert.deepEqual(r.body.namespaces, ["bio", "scratch"]); assert.deepEqual(r2.calls, []);
  }
  for (const store of ["bio", "scratch"]) {
    const r2 = bucket({ [`${store}/captures/${SHA}`]: small([{ r: "A1", f: "1+1", v: 2 }]) });
    const r = await call(m, post({ capture_sha: SHA, store }), { ...ON, CAPTURES: r2.binding });
    assert.equal(r.body.ok, true, store);
  }
});

test("R1: no CAPTURES binding gives R2_NOT_CONFIGURED (503); no bytes at `${store}/captures/${sha}` gives NOT_FOUND (404)", async () => {
  const m = member();
  for (const env of [{ ...ON }, { ...ON, CAPTURES: {} }, { ...ON, CAPTURES: null }]) {
    const r = await call(m, post({ capture_sha: SHA, store: "bio" }), env);
    assert.equal(r.status, 503); assert.equal(r.body.reason, "R2_NOT_CONFIGURED");
  }
  const r2 = bucket({ [`scratch/captures/${SHA}`]: small([]) });
  const r = await call(m, post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: r2.binding });
  assert.equal(r.status, 404); assert.equal(r.body.reason, "NOT_FOUND");
  assert.deepEqual(r2.calls, [["get", `bio/captures/${SHA}`]]);
});

/* ---- R2: inactive until enabled ----------------------------------------------------------------------------- */

test("R2: unless SHEET_RECOMPUTE is exactly \"on\", every well-formed request is NOT_ENABLED (200, ok:false) before any bytes are read", async () => {
  const { engine, calls } = spied(realEngine());
  const m = makeMember(engine);
  for (const value of [undefined, "", "off", "ON", "On", "on ", "true", "1", true]) {
    const r2 = bucket({ [`bio/captures/${SHA}`]: small([{ r: "A1", f: "1", v: 1 }]) });
    const env = { CAPTURES: r2.binding, ...(value === undefined ? {} : { SHEET_RECOMPUTE: value }) };
    const r = await call(m, post({ capture_sha: SHA, store: "bio" }), env);
    assert.equal(r.status, 200); assert.equal(r.body.ok, false); assert.equal(r.body.reason, "NOT_ENABLED");
    assert.equal(r.body.not_recomputed, NOT_RECOMPUTED);
    assert.deepEqual(r2.calls, [], `no read with SHEET_RECOMPUTE=${JSON.stringify(value)}`);
  }
  assert.equal(calls.open + calls.inspect + calls.load, 0);
  /* a malformed request is still refused as malformed, not as NOT_ENABLED */
  assert.equal((await call(m, post({ capture_sha: "x", store: "bio" }), {})).body.reason, "BAD_SHA");
  /* the committed configuration sets it off */
  const cfg = parseJsonc(readFileSync(`${MEMBER_DIR}wrangler.jsonc`, "utf8"), "wrangler.jsonc");
  assert.equal(cfg.vars.SHEET_RECOMPUTE, "off");
  assert.equal(contract.enabledIn(cfg.vars), false);
});

/* ---- R3: refusals, in order --------------------------------------------------------------------------------- */

const refusedAs = (body, reason) => {
  assert.equal(body.ok, false); assert.equal(body.reason, reason);
  assert.equal(body.not_recomputed, NOT_RECOMPUTED); assert.equal(typeof body.why, "string"); assert.ok(body.why.length);
  assert.equal(body.cells, undefined, "a refused workbook is never partly recomputed");
};

/** A wasm module that compiles but is not the engine; and the engine's own bytes with its section doctored. */
const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
const SECTION = JSON.parse(Buffer.from(WebAssembly.Module.customSections(MODULE, contract.ENGINE_SECTION)[0]).toString());
const doctored = (facts) => new WebAssembly.Module(withEngineSection(WASM_FILE.subarray(0, SECTION.code_bytes), { ...SECTION, ...facts }));

test("R3 (1) / R13: ENGINE_ABSENT when the wasm did not load as the pinned build, checked before anything else", async () => {
  const bogus = [undefined, null, "wasm", WASM_FILE, EMPTY_MODULE, doctored({ commit: "0".repeat(40) }),
    doctored({ engine: "other" }), doctored({ code_bytes: 1 })];
  for (const mod of bogus) {
    const m = makeMember(makeEngine(mod));
    /* garbage bytes too: the engine is checked first */
    for (const bytes of [new Uint8Array([1, 2, 3]), small([{ r: "A1", f: "1", v: 1 }])]) {
      const r = await recomputeVia(m, bytes);
      assert.equal(r.status, 200); refusedAs(r.body, "ENGINE_ABSENT");
    }
  }
  /* the real one loads */
  assert.equal(moduleCheck(MODULE), null);
  assert.equal(realEngine().check(), null);
});

test("R3 (2): NOT_A_WORKBOOK when the bytes are not an OOXML spreadsheet container, before the engine loads them", async () => {
  const { engine, calls } = spied(realEngine());
  const m = makeMember(engine);
  const docx = zip({
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "word/document.xml": "<w:document/>",
  });
  const missingPart = zip({
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
  });
  for (const bytes of [new Uint8Array(0), new TextEncoder().encode("a,b\n1,2\n"), fixture("not-a-zip.xlsx"),
    zip({ "xl/workbook.xml": "<workbook/>" }), docx, missingPart]) {
    const r = await recomputeVia(m, bytes);
    refusedAs(r.body, "NOT_A_WORKBOOK");
  }
  assert.equal(calls.load, 0);
});

/** A deflated workbook of `n` numeric cells, small zipped and large unzipped. */
const wideWorkbook = (n, extra = {}) =>
  workbook({ sheets: [{ name: "S", cells: Array.from({ length: n }, (_, i) => ({ r: `A${i + 1}`, v: i })) }], deflate: true, ...extra });

test("R3 (3) / R14: OVER_BOUND when the unzipped size exceeds MAX_UNZIPPED_BYTES or the cells exceed MAX_CELLS, naming the measured value and the bound, before the engine loads", async () => {
  const { engine, calls } = spied(realEngine());
  const m = makeMember(engine);
  /* over the real unzipped bound: a deflated sheet that unzips past MAX_UNZIPPED_BYTES */
  const big = wideWorkbook(Math.ceil(MAX_UNZIPPED_BYTES / 30) + 10);
  assert.ok(big.length < MAX_UNZIPPED_BYTES, "the fixture is under the bound zipped");
  let r = await recomputeVia(m, big);
  refusedAs(r.body, "OVER_BOUND");
  assert.equal(r.body.measure, "unzipped_bytes"); assert.equal(r.body.bound, MAX_UNZIPPED_BYTES);
  assert.ok(r.body.measured > MAX_UNZIPPED_BYTES); assert.equal(r.body.measured_is, "at_least");
  assert.ok(r.body.why.includes(String(MAX_UNZIPPED_BYTES)) && r.body.why.includes(String(r.body.measured)));
  /* over the real cell bound, under the unzipped one: cells written compactly (`<c/>` carries no value) */
  const n = MAX_CELLS + 1;
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${"<c/>".repeat(n)}</row></sheetData></worksheet>`;
  assert.ok(sheet.length < MAX_UNZIPPED_BYTES, "the cell fixture is under the unzipped bound");
  r = await recomputeVia(m, workbook({ sheets: [{ name: "S", cells: [] }], extra: { "xl/worksheets/sheet1.xml": sheet }, deflate: true }));
  refusedAs(r.body, "OVER_BOUND");
  assert.deepEqual([r.body.measure, r.body.measured, r.body.measured_is, r.body.bound], ["cells", n, "exact", MAX_CELLS]);
  assert.equal(calls.load, 0);
  /* exactly at the bounds is recomputed */
  const at = makeMember(realEngine(), { bounds: { maxUnzippedBytes: MAX_UNZIPPED_BYTES, maxCells: 3, timeBudgetMs: TIME_BUDGET_MS } });
  r = await recomputeVia(at, small([{ r: "A1", v: 1 }, { r: "A2", v: 2 }, { r: "A3", f: "A1+A2", v: 3 }]));
  assert.equal(r.body.ok, true);
  r = await recomputeVia(at, small([{ r: "A1", v: 1 }, { r: "A2", v: 2 }, { r: "A3", f: "A1+A2", v: 3 }, { r: "A4", v: 0 }]));
  refusedAs(r.body, "OVER_BOUND");
});

const EXTERNAL_PART = {
  extra: {
    "xl/externalLinks/externalLink1.xml": '<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><externalBook/></externalLink>',
  },
  overrides: { "/xl/externalLinks/externalLink1.xml": "application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml" },
};

test("R3 (4): EXTERNAL_LINKS for an external-link part, or a formula or defined name that refers to another workbook, naming how many, before the engine loads", async () => {
  const { engine, calls } = spied(realEngine());
  const m = makeMember(engine);
  const cases = [
    [small([{ r: "A1", v: 1 }], EXTERNAL_PART), { parts: 1, formulas: 0, defined_names: 0 }],
    [small([{ r: "A1", f: "[1]Other!A1", v: 1 }, { r: "A2", f: "SUM('[2]My Sheet'!B1:B3)", v: 2 }, { r: "A3", f: "A1", v: 1 }]),
      { parts: 0, formulas: 2, defined_names: 0 }],
    [small([{ r: "A1", f: "Rate*2", v: 2 }], { definedNames: [{ name: "Rate", ref: "[1]Rates!$A$1" }] }),
      { parts: 0, formulas: 0, defined_names: 1 }],
  ];
  for (const [bytes, external] of cases) {
    const r = await recomputeVia(m, bytes);
    refusedAs(r.body, "EXTERNAL_LINKS");
    assert.deepEqual(r.body.external, external);
    assert.equal(r.body.links, external.parts + external.formulas + external.defined_names);
  }
  assert.equal(calls.load, 0);
  /* not external: a string, a structured reference, a sheet name with brackets inside quotes after other text */
  const r = await recomputeVia(m, small([{ r: "A1", f: "\"[1]x\"&\"y\"", v: "[1]xy" }, { r: "A2", f: "LEN(\"[2]\")", v: 3 }]));
  assert.equal(r.body.ok, true);
});

test("R3: the first refusal that applies is the one reported (order 1-6)", async () => {
  const both = wideWorkbook(Math.ceil(MAX_UNZIPPED_BYTES / 30) + 10, EXTERNAL_PART);
  assert.equal((await recomputeVia(member(), both)).body.reason, "OVER_BOUND");
  assert.equal((await recomputeVia(makeMember(makeEngine(EMPTY_MODULE)), both)).body.reason, "ENGINE_ABSENT");
  /* external links before the engine's own failure: a workbook part the engine cannot read, with an external part */
  const broken = small([{ r: "A1", v: 1 }], { ...EXTERNAL_PART, extra: { ...EXTERNAL_PART.extra, "xl/workbook.xml": "<workbook" } });
  assert.equal((await recomputeVia(member(), broken)).body.reason, "EXTERNAL_LINKS");
  /* the engine's failure before the time limit: a load that fails is never timed */
  let reads = 0;
  const m = makeMember(realEngine(), { now: () => (reads++ ? 1e12 : 0) });
  assert.equal((await recomputeVia(m, small([{ r: "A1", v: 1 }], { extra: { "xl/workbook.xml": "<workbook" } }))).body.reason, "ENGINE_FAILED");
});

test("R3 (5): ENGINE_FAILED when the engine refuses or throws while loading or evaluating, with the engine's own message", async () => {
  const r = await recomputeVia(member(), small([{ r: "A1", v: 1 }], { extra: { "xl/workbook.xml": "<workbook><sheets>" } }));
  refusedAs(r.body, "ENGINE_FAILED");
  assert.equal(r.body.stage, "load"); assert.equal(typeof r.body.engine_error, "string"); assert.ok(r.body.engine_error.length);
  /* evaluation: an engine that throws there (the real one is driven to that step and its error is passed on verbatim) */
  const real = realEngine();
  const throwing = { ...real, evaluate: () => { throw new Error("unreachable executed"); } };
  const r2 = await recomputeVia(makeMember(throwing), small([{ r: "A1", f: "1", v: 1 }]));
  refusedAs(r2.body, "ENGINE_FAILED");
  assert.deepEqual([r2.body.stage, r2.body.engine_error], ["evaluate", "unreachable executed"]);
  /* and the next request after a failure is answered on a fresh instance */
  const r3 = await recomputeVia(member(), small([{ r: "A1", f: "2*3", v: 6 }]));
  assert.equal(r3.body.cells[0].value, 6);
});

test("R3 (6): TIME_LIMIT when loading took longer than TIME_BUDGET_MS, so evaluation was not started", async () => {
  const { engine, calls } = spied(realEngine());
  const clock = [1000, 1000 + TIME_BUDGET_MS + 1];
  const m = makeMember(engine, { now: () => clock.shift() });
  const r = await recomputeVia(m, small([{ r: "A1", f: "1+1", v: 2 }]));
  refusedAs(r.body, "TIME_LIMIT");
  assert.deepEqual([r.body.elapsed_ms, r.body.budget_ms], [TIME_BUDGET_MS + 1, TIME_BUDGET_MS]);
  assert.deepEqual([calls.load, calls.evaluate], [1, 0]);
  /* exactly at the budget, evaluation runs */
  const at = [0, TIME_BUDGET_MS];
  const ok = await recomputeVia(makeMember(realEngine(), { now: () => at.shift() }), small([{ r: "A1", f: "1+1", v: 2 }]));
  assert.equal(ok.body.ok, true);
  /* the time is read after a turn boundary, so a synchronous load is counted (workerd advances its clock only then) */
  const order = [];
  const timed = makeMember(spied(realEngine()).engine, { now: () => { order.push("now"); return 0; }, turn: async () => { order.push("turn"); } });
  await recomputeVia(timed, small([{ r: "A1", v: 1 }]));
  assert.deepEqual(order, ["now", "turn", "now"]);
});

/* ---- words (K874): the sentences a member answers are read by their word ids ------------------------------ */

test("words: the refusal sentences are read by sheet-worker.contract.store_must_be_named_this, sheet-worker.contract.no_capture_with_that_sha_in, sheet-worker.contract.the_engine_did_not_load, sheet-worker.contract.the_workbook_is_larger_than, sheet-worker.contract.the_workbook_refers_to_other, sheet-worker.contract.the_engine_refused_or_failed, sheet-worker.contract.loading_the_workbook_took_longer, sheet-worker.contract.recompute_is_not_enabled_here, sheet-worker.member.the_engine_refused_the_workbook and sheet-worker.member.the_engine_failed_while_evaluating, and each answer carries its sentence", async () => {
  /* contract.mjs: the caller's refusal (BAD_STORE) and the missing capture (NOT_FOUND) are answered with the sentence read by id */
  const bad = await call(member(), post({ capture_sha: SHA, store: 3 }), ON);
  assert.equal(bad.body.reason, "BAD_STORE");
  assert.equal(bad.body.detail, REFUSALS.BAD_STORE); assert.ok(bad.body.detail.length);
  const missing = await call(member(), post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: bucket().binding });
  assert.equal(missing.body.reason, "NOT_FOUND");
  assert.equal(missing.body.detail, REFUSALS.NOT_FOUND); assert.ok(missing.body.detail.length);
  /* the instance's setting off: the refusal before any read is the sentence read by id */
  const off = await call(member(), post({ capture_sha: SHA, store: "bio" }), {});
  assert.equal(off.body.reason, "NOT_ENABLED");
  assert.equal(off.body.detail, REFUSALS.NOT_ENABLED); assert.ok(off.body.detail.length);
  /* member.mjs: the engine's refusal while loading and its failure while evaluating each carry their sentence as `why` */
  const load = await recomputeVia(member(), small([{ r: "A1", v: 1 }], { extra: { "xl/workbook.xml": "<workbook><sheets>" } }));
  assert.equal(load.body.reason, "ENGINE_FAILED"); assert.equal(load.body.stage, "load");
  assert.equal(load.body.detail, REFUSALS.ENGINE_FAILED); assert.ok(load.body.why.length);
  const throwing = { ...realEngine(), evaluate: () => { throw new Error("unreachable executed"); } };
  const evaluate = await recomputeVia(makeMember(throwing), small([{ r: "A1", f: "1", v: 1 }]));
  assert.equal(evaluate.body.stage, "evaluate"); assert.ok(evaluate.body.why.length);
});

/* ---- R4-R6: the answer -------------------------------------------------------------------------------------- */

const VALUES = small([
  { r: "A1", v: 0.1 }, { r: "A2", v: 0.2 }, { r: "B1", v: "text" },
  { r: "C2", f: "A1+A2", v: 0.30000000000000004 }, { r: "A3", f: "B1&\"!\"", v: "text!" },
  { r: "B3", f: "A1<A2", v: true }, { r: "A4", f: "1/3", v: 0.3333333333333333 }, { r: "B4", f: "2^0.5*1E+300", v: 1 },
  { r: "C1", f: "A1*3", v: 0.30000000000000004 },
]);

test("R4: ok:true with engine, engine_version, wasm_sha256, macros_present, counts, notes, and one cell per formula cell in sheet, row, column order", async () => {
  const twoSheets = workbook({ sheets: [
    { name: "Zed", cells: [{ r: "B2", f: "1", v: 1 }, { r: "A2", f: "2", v: 2 }, { r: "C1", f: "3", v: 3 }, { r: "A1", v: 9 }] },
    { name: "Alpha Beta", cells: [{ r: "A1", f: "Zed!A1", v: 9 }] },
  ] });
  const { body } = await recomputeVia(member(), twoSheets);
  assert.equal(body.ok, true);
  assert.equal(body.engine, "ironcalc");
  assert.equal(body.engine_version, contract.ENGINE_VERSION);
  assert.equal(body.wasm_sha256, contract.WASM_SHA256);
  assert.equal(body.macros_present, false);
  assert.deepEqual(body.counts, { formula_cells: 4, errors: 0, volatile: 0 });
  assert.ok(Array.isArray(body.notes));
  assert.deepEqual(body.cells.map((c) => c.source.ref), ["Zed!C1", "Zed!A2", "Zed!B2", "Alpha Beta!A1"]);
  for (const c of body.cells) {
    assert.deepEqual(Object.keys(c.source), ["kind", "ref", "sheet", "cell"]);
    assert.equal(c.source.kind, "sheet-cell");
    assert.equal(c.source.ref, `${c.source.sheet}!${c.source.cell}`);
    assert.match(c.source.cell, /^[A-Z]+[1-9][0-9]*$/);
    assert.equal(typeof c.formula, "string"); assert.equal(typeof c.volatile, "boolean");
  }
  assert.deepEqual(body.cells.map((c) => c.value), [3, 2, 1, 9]);
  /* every cell's fields, and nothing but formula cells */
  assert.deepEqual(Object.keys(body.cells[0]).sort(), ["formula", "source", "type", "value", "volatile"]);
});

test("R4: a number is written as the shortest decimal that reads back to the engine's value, never rounded further; text and booleans as themselves", async () => {
  const res = await member().fetch(post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: bucket({ [`bio/captures/${SHA}`]: VALUES }).binding });
  const raw = await res.text();
  const body = JSON.parse(raw);
  const by = Object.fromEntries(body.cells.map((c) => [c.source.ref, c]));
  const want = { "S!C2": 0.1 + 0.2, "S!A4": 1 / 3, "S!C1": 0.1 * 3, "S!B4": Math.pow(2, 0.5) * 1e300 };
  for (const [ref, n] of Object.entries(want)) {
    assert.equal(by[ref].type, "number"); assert.equal(by[ref].value, n, ref);
    /* the wire text is the shortest round-trip form */
    assert.ok(raw.includes(`"value":${String(n)}`), `${ref} written as ${String(n)}`);
  }
  assert.deepEqual([by["S!A3"].type, by["S!A3"].value], ["text", "text!"]);
  assert.deepEqual([by["S!B3"].type, by["S!B3"].value], ["boolean", true]);
  for (const c of body.cells) if (c.type === "number") assert.equal(Number(JSON.stringify(c.value)), c.value);
});

test("R5: an error result has type error, the engine's code and a cause; each is marked not recomputed here and never called a disagreement", async () => {
  const wb = small([
    { r: "A1", v: 1 }, { r: "A2", v: 2 }, { r: "C1", v: "a " }, { r: "C2", v: "b" },
    { r: "B1", f: "WEBSERVICE(\"http://example.invalid\")", v: 0 },   // a function the engine does not hold
    { r: "B2", f: "B1+1", v: 0 },                                    // the same error, from B1
    { r: "B3", f: "@A1:A2", v: 1 },                                  // implicit intersection over a range
    { r: "B4", f: "B5+1", v: 0 }, { r: "B5", f: "B4+1", v: 0 },      // a circular reference
    { r: "B6", f: "INFO(\"osversion\")", v: 0 },                     // implemented as #N/IMPL
    { r: "B7", f: "1/0", v: "#DIV/0!", t: "e" },                     // an error a spreadsheet gives too
    { r: "B8", f: "SUMPRODUCT(--(TRIM(C1:C2)=\"a\"))", v: 1 },       // array-lifted TRIM: the engine intersects
  ], { calcPr: '<calcPr iterate="1"/>' });
  const { body } = await recomputeVia(member(), wb);
  const by = Object.fromEntries(body.cells.map((c) => [c.source.ref, c]));
  const want = {
    "S!B1": ["#NAME?", "unsupported_function"], "S!B2": ["#NAME?", "unsupported_function"],
    "S!B3": ["#VALUE!", "implicit_intersection"], "S!B4": ["#CIRC!", "circular"], "S!B5": ["#CIRC!", "circular"],
    "S!B6": ["#N/IMPL", "not_implemented"], "S!B7": ["#DIV/0!", "undetermined"], "S!B8": ["#VALUE!", "implicit_intersection"],
  };
  for (const [ref, [code, cause]] of Object.entries(want)) {
    const c = by[ref];
    assert.deepEqual([c.type, c.error, c.cause, c.not_recomputed], ["error", code, cause, NOT_RECOMPUTED], ref);
    assert.ok(contract.CAUSES.includes(c.cause));
  }
  assert.equal(by["S!B1"].function, "WEBSERVICE"); assert.equal(by["S!B2"].function, "WEBSERVICE");
  assert.equal(by["S!B2"].via, "S!B1");
  assert.equal(body.counts.errors, 8);
  assert.ok(!/disagree(s|ment)?\b(?! with the file)/i.test(JSON.stringify(body).replace(/not a disagreement/g, "")));
  /* a non-error cell carries none of the error fields */
  const fine = (await recomputeVia(member(), small([{ r: "A1", f: "1", v: 1 }]))).body.cells[0];
  for (const k of ["error", "cause", "not_recomputed", "function"]) assert.equal(fine[k], undefined);
});

test("R6: a cell whose formula calls NOW, TODAY, RAND, RANDBETWEEN, OFFSET, INDIRECT, CELL or INFO is volatile:true; others false", async () => {
  const calls = { NOW: "NOW()", TODAY: "TODAY()", RAND: "RAND()", RANDBETWEEN: "RANDBETWEEN(1,9)", OFFSET: "OFFSET(A1,0,0)",
    INDIRECT: "INDIRECT(\"A1\")", CELL: "CELL(\"row\",A1)", INFO: "INFO(\"numfile\")" };
  assert.deepEqual(Object.keys(calls), [...contract.VOLATILE_FUNCTIONS]);
  const cells = [{ r: "A1", v: 1 }, ...Object.values(calls).map((f, i) => ({ r: `B${i + 1}`, f: `1+${f}`, v: 0 })),
    { r: "C1", f: "\"NOW()\"&\"TODAY()\"", v: "" }, { r: "C2", f: "SUM(A1)", v: 1 }, { r: "C3", f: "NOWHERE+1", v: 0 },
    { r: "C4", f: "_xlfn.CONCAT(\"RAND\",\"()\")", v: "" }];
  const { body } = await recomputeVia(member(), small(cells));
  for (let i = 0; i < 8; i++) assert.equal(body.cells.find((c) => c.source.cell === `B${i + 1}`).volatile, true, `B${i + 1}`);
  for (const cell of ["C1", "C2", "C3", "C4"]) assert.equal(body.cells.find((c) => c.source.cell === cell).volatile, false, cell);
  assert.equal(body.counts.volatile, 8);
});

test("R7: macros are never run; a workbook with a VBA project is recomputed by its formulas alone, macros_present:true with a note", async () => {
  const cells = [{ r: "A1", v: 2 }, { r: "A2", f: "A1*21", v: 42 }];
  const withVba = (await recomputeVia(member(), small(cells, { vba: true }))).body;
  assert.equal(withVba.ok, true); assert.equal(withVba.macros_present, true);
  assert.equal(withVba.cells[0].value, 42);
  assert.ok(withVba.notes.some((n) => /VBA/.test(n) && /never run/.test(n)));
  const without = (await recomputeVia(member(), small(cells))).body;
  assert.equal(without.macros_present, false);
  assert.ok(!without.notes.some((n) => /VBA/.test(n)));
  assert.deepEqual(withVba.cells, without.cells);
});

/* ---- R8, R9: version and everything else -------------------------------------------------------------------- */

test("R8: GET /version reads VERSION from env, asks whether the engine loaded, and states enabled and the bounds", async () => {
  const m = member();
  const r = await call(m, new Request("https://sheet-worker/version"), { VERSION: "1.2.3", SHEET_RECOMPUTE: "on" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, {
    ok: true, name: "sheet-worker", version: "1.2.3", engine: "ironcalc", engine_version: contract.ENGINE_VERSION,
    wasm_bytes: contract.WASM_BYTES, wasm_sha256: contract.WASM_SHA256, engine_loaded: true, enabled: true,
    bounds: { max_unzipped_bytes: MAX_UNZIPPED_BYTES, max_cells: MAX_CELLS, time_budget_ms: TIME_BUDGET_MS },
  });
  const off = await call(m, new Request("https://sheet-worker/version"), { VERSION: "9.9.9" });
  assert.deepEqual([off.body.version, off.body.enabled], ["9.9.9", false]);
  const absent = await call(makeMember(makeEngine(EMPTY_MODULE)), new Request("https://sheet-worker/version"), {});
  assert.equal(absent.body.engine_loaded, false); assert.equal(typeof absent.body.engine_unavailable, "string");
  assert.equal(absent.body.version, null);
});

test("R9: any other method or path is refused {ok:false, reason:\"UNKNOWN\"} with 404", async () => {
  const m = member();
  for (const [method, path] of [["GET", "/recompute"], ["POST", "/version"], ["GET", "/"], ["POST", "/"], ["PUT", "/recompute"],
    ["DELETE", "/version"], ["POST", "/recompute/x"], ["GET", "/versions"], ["POST", "/transcribe"]]) {
    const r = await call(m, new Request(`https://sheet-worker${path}`, { method, ...(method === "GET" || method === "DELETE" ? {} : { body: "{}" }) }), ON);
    assert.equal(r.status, 404, `${method} ${path}`); assert.equal(r.body.ok, false); assert.equal(r.body.reason, "UNKNOWN");
  }
});

/* ---- invariants --------------------------------------------------------------------------------------------- */

test("R10: writes nothing — only CAPTURES.get is ever called, the bucket is unchanged, and the configuration holds no Durable Object or PUBLISHED binding", async () => {
  const bytes = small([{ r: "A1", f: "1", v: 1 }]);
  const r2 = bucket({ [`bio/captures/${SHA}`]: bytes, [`scratch/captures/${SHA}`]: bytes });
  const before = [...r2.store.entries()].map(([k, v]) => [k, sha256(v)]);
  const m = member();
  for (const body of [{ capture_sha: SHA, store: "bio" }, { capture_sha: SHA, store: "scratch" }, { capture_sha: "cd".repeat(32), store: "bio" },
    { capture_sha: SHA, store: "nope" }])
    await call(m, post(body), { ...ON, CAPTURES: r2.binding });
  await call(m, new Request("https://sheet-worker/version"), { ...ON, CAPTURES: r2.binding });
  assert.ok(r2.calls.length >= 3);
  assert.deepEqual([...new Set(r2.calls.map((c) => c[0]))], ["get"]);
  assert.deepEqual([...r2.store.entries()].map(([k, v]) => [k, sha256(v)]), before);
  const cfg = parseJsonc(readFileSync(`${MEMBER_DIR}wrangler.jsonc`, "utf8"), "wrangler.jsonc");
  assert.deepEqual(cfg.r2_buckets.map((b) => b.binding), ["CAPTURES"]);
  for (const k of ["durable_objects", "kv_namespaces", "d1_databases", "queues", "services", "migrations"]) assert.equal(cfg[k], undefined, k);
  /* and the deployed artifact makes no write call on any binding */
  const bundle = readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundled.mjs`, "utf8");
  assert.equal(/\.(put|delete|createMultipartUpload|resumeMultipartUpload)\s*\(/.test(bundle.replace(/_fmtCache\.\w+\(/g, "")), false);
});

test("R11: NAMESPACES is exactly [\"bio\", \"scratch\"], frozen; PLANE_OPS is empty and frozen", () => {
  assert.deepEqual(NAMESPACES, ["bio", "scratch"]); assert.ok(Object.isFrozen(NAMESPACES));
  assert.deepEqual(PLANE_OPS, {}); assert.ok(Object.isFrozen(PLANE_OPS));
  assert.throws(() => { "use strict"; NAMESPACES.push("x"); });
});

test("R12: the answer is a function of the bytes, the engine and the settings; no state between calls; only CAPTURES.get is read", async () => {
  const bytes = small([{ r: "A1", v: 3 }, { r: "A2", f: "A1*A1", v: 9 }, { r: "A3", f: "DATE(2024,2,29)+1", v: 0 }]);
  const m = member();
  const seen = new Set();
  const env = new Proxy({ ...ON, CAPTURES: bucket({ [`bio/captures/${SHA}`]: bytes }).binding, OTHER_SECRET: "x" },
    { get(t, k) { if (typeof k === "string") seen.add(k); return t[k]; } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("no network call may be made"); };
  try {
    const first = await call(m, post({ capture_sha: SHA, store: "bio" }), env);
    /* a different workbook, a failing one, then the first again: the same answer */
    await recomputeVia(m, small([{ r: "B1", f: "B2", v: 0 }, { r: "B2", f: "B1", v: 0 }]));
    await recomputeVia(m, small([{ r: "A1", v: 1 }], { extra: { "xl/workbook.xml": "<workbook" } }));
    const again = await call(m, post({ capture_sha: SHA, store: "bio" }), env);
    assert.deepEqual(again.body, first.body);
    /* and a separate member instance gives it too */
    assert.deepEqual((await call(member(), post({ capture_sha: SHA, store: "bio" }), env)).body, first.body);
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual([...seen].sort(), ["CAPTURES", "SHEET_RECOMPUTE"]);
});

test("R13: the vendored wasm is the pinned IronCalc build with its xlsx feature, its length and SHA-256 fixed, its bytes pinned by the bundle manifest", () => {
  assert.equal(WASM_FILE.length, contract.WASM_BYTES);
  assert.equal(sha256(WASM_FILE), contract.WASM_SHA256);
  const facts = JSON.parse(Buffer.from(WebAssembly.Module.customSections(MODULE, contract.ENGINE_SECTION)[0]).toString());
  assert.equal(facts.engine, "ironcalc"); assert.equal(facts.commit, contract.ENGINE_VERSION);
  assert.deepEqual(facts.features, ["xlsx"]);
  assert.equal(sha256(WASM_FILE.subarray(0, facts.code_bytes)), facts.code_sha256);
  const cargo = readFileSync(`${MEMBER_DIR}engine/Cargo.toml`, "utf8");
  assert.deepEqual([...cargo.matchAll(/rev = "([0-9a-f]{40})"/g)].map((m) => m[1]), [contract.ENGINE_VERSION, contract.ENGINE_VERSION]);
  const manifest = JSON.parse(readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundle.json`, "utf8"));
  const asset = manifest.assets.find((a) => a.path === "assets/sheet-engine.wasm");
  assert.deepEqual([asset.bytes, asset.sha256], [contract.WASM_BYTES, contract.WASM_SHA256]);
  /* it reads XLSX: the engine loads a workbook from its bytes */
  const e = realEngine();
  assert.equal(e.open(), null);
  e.load(small([{ r: "A1", f: "40+2", v: 42 }]));
  assert.equal(e.evaluate().cells[0].value, 42);
  e.close();
});

test("R14: the bounds are fixed positive constants, the configuration declares its CPU limit, and a workbook above a bound is refused whole", () => {
  for (const n of [MAX_UNZIPPED_BYTES, MAX_CELLS, TIME_BUDGET_MS]) assert.ok(Number.isInteger(n) && n > 0);
  const cfg = parseJsonc(readFileSync(`${MEMBER_DIR}wrangler.jsonc`, "utf8"), "wrangler.jsonc");
  assert.equal(cfg.limits.cpu_ms, 300000);
  assert.ok(TIME_BUDGET_MS < cfg.limits.cpu_ms);
  /* "refused whole" is asserted on every OVER_BOUND answer above (no `cells`) */
});

test("R14: the three bounds are the READ_BOUNDS rows of the sheet worker, read through boundOf, typed nowhere else in the member, and reported by /version", async () => {
  /* the values and the table's pairs */
  assert.deepEqual([MAX_UNZIPPED_BYTES, MAX_CELLS, TIME_BUDGET_MS], [9000000, 250000, 120000]);
  assert.deepEqual([MAX_UNZIPPED_BYTES, MAX_CELLS, TIME_BUDGET_MS],
    [boundOf("sheet_worker", "bytes"), boundOf("sheet_worker", "cells"), boundOf("sheet_worker", "ms")]);
  assert.ok(Object.hasOwn(READ_BOUNDS.sheet_worker, "bytes") && Object.hasOwn(READ_BOUNDS.sheet_worker, "cells") && Object.hasOwn(READ_BOUNDS.sheet_worker, "ms"));
  /* no numeric literal of the three remains in the member's source */
  const forms = [/\b9[_,]?000[_,]?000\b/, /\b250[_,]?000\b/, /\b120[_,]?000\b/];
  for (const f of readdirSync(`${MEMBER_DIR}src/`).filter((x) => x.endsWith(".mjs"))) {
    const text = readFileSync(`${MEMBER_DIR}src/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const re of forms) assert.ok(!re.test(text), `${f} types a literal matching ${re}`);
  }
  /* /version states them */
  const r = await call(member(), new Request("https://sheet-worker/version"), ON);
  assert.deepEqual(r.body.bounds, { max_unzipped_bytes: boundOf("sheet_worker", "bytes"), max_cells: boundOf("sheet_worker", "cells"), time_budget_ms: boundOf("sheet_worker", "ms") });
  /* control: exactly MAX_CELLS cells is not refused for its cells; one over is */
  const sheetOf = (n) => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${"<c/>".repeat(n)}</row></sheetData></worksheet>`;
  const wb = (n) => workbook({ sheets: [{ name: "S", cells: [] }], extra: { "xl/worksheets/sheet1.xml": sheetOf(n) }, deflate: true });
  const m = makeMember(realEngine());
  const atBound = await recomputeVia(m, wb(MAX_CELLS));
  assert.notEqual(atBound.body.reason, "OVER_BOUND", `exactly ${MAX_CELLS} cells: ${JSON.stringify(atBound.body).slice(0, 200)}`);
  const over = await recomputeVia(m, wb(MAX_CELLS + 1));
  assert.equal(over.body.reason, "OVER_BOUND");
  assert.deepEqual([over.body.measure, over.body.measured, over.body.bound], ["cells", MAX_CELLS + 1, MAX_CELLS]);
});

/** Every distinct limits statement a reader of the bundle's text finds: a quoted `bio-member-limits/1 …` string, read
 *  as installer R20 reads the plane's (any quote, no quote or backslash inside). */
const limitsStatements = (text) =>
  [...new Set([...text.matchAll(/(["'`])(bio-member-limits\/1(?: [^"'`\\\n]*)?)\1/g)].map((m) => m[2]))];

test("R17: the member states its limits in its committed bundle as exactly one distinct string bio-member-limits/1 key=n …, keys sorted, equal to its configuration's limits", () => {
  const cfg = parseJsonc(readFileSync(`${MEMBER_DIR}wrangler.jsonc`, "utf8"), "wrangler.jsonc");
  assert.ok(cfg.limits && typeof cfg.limits === "object" && Object.keys(cfg.limits).length, "the configuration states limits");
  const keys = Object.keys(cfg.limits).sort();
  assert.ok(keys.every((k) => Number.isInteger(cfg.limits[k]) && cfg.limits[k] > 0), "each limit is a positive integer");
  const want = ["bio-member-limits/1", ...keys.map((k) => `${k}=${cfg.limits[k]}`)].join(" ");
  /* the stated forms equal the configuration */
  assert.equal(limits.MEMBER_LIMITS_STATEMENT, want);
  assert.match(limits.MEMBER_LIMITS_STATEMENT, /^bio-member-limits\/1( [a-z_]+=[1-9][0-9]*)+$/);
  assert.deepEqual({ ...limits.MEMBER_LIMITS }, cfg.limits); assert.ok(Object.isFrozen(limits.MEMBER_LIMITS));
  assert.deepEqual(Object.fromEntries(limits.MEMBER_LIMITS_STATEMENT.split(" ").slice(1).map((kv) => kv.split("="))
    .map(([k, v]) => [k, Number(v)])), { ...limits.MEMBER_LIMITS });
  /* today's (K1536) */
  assert.equal(want, "bio-member-limits/1 cpu_ms=300000");
  /* the bundle a release signs states it exactly once, as written */
  const bundle = readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundled.mjs`, "utf8");
  assert.deepEqual(limitsStatements(bundle), [want]);
  /* and the manifest pins the bytes that hold it */
  const manifest = JSON.parse(readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundle.json`, "utf8"));
  assert.equal(manifest.sha256, sha256(readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundled.mjs`)));
  /* negative controls: a second, different statement, or none, is not one distinct string */
  assert.equal(limitsStatements(`${bundle}\nvar b = 'bio-member-limits/1 cpu_ms=30000';`).length, 2);
  assert.equal(limitsStatements(bundle.split(want).join("")).length, 0);
  assert.deepEqual(limitsStatements(`${bundle}\nvar c = \`${want}\`;`), [want], "the same statement twice is one distinct string");
});

test("R16: no place is named; the same bytes and settings give the same answer under any process time zone and instance", () => {
  const script = `
    import { readFileSync } from "node:fs";
    import { makeEngine } from "${MEMBER_DIR}src/enginecore.mjs";
    import { makeMember } from "${MEMBER_DIR}src/member.mjs";
    const m = makeMember(makeEngine(new WebAssembly.Module(readFileSync("${MEMBER_DIR}assets/sheet-engine.wasm"))));
    const bytes = new Uint8Array(Buffer.from(process.argv[1], "base64"));
    process.stdout.write(JSON.stringify(await m.recompute(bytes)));`;
  const bytes = small([{ r: "A1", f: "DATE(2024,3,10)+0.5", v: 0 }, { r: "A2", f: "TEXT(A1,\"yyyy-mm-dd hh:mm\")", v: "" },
    { r: "A3", f: "YEAR(A1)&\"-\"&HOUR(A1)", v: "" }, { r: "A4", f: "1234.5*1", v: 1234.5 }]);
  const run = (TZ, LANG) => execFileSync(process.execPath, ["--input-type=module", "-e", script, Buffer.from(bytes).toString("base64")],
    { env: { ...process.env, TZ, LANG, LC_ALL: LANG }, encoding: "utf8" });
  const a = run("America/Los_Angeles", "en_US.UTF-8"), b = run("Asia/Tokyo", "de_DE.UTF-8"), c = run("UTC", "C");
  assert.equal(a, b); assert.equal(a, c);
  const out = JSON.parse(a);
  assert.equal(out.cells.find((x) => x.source.cell === "A2").value, "2024-03-10 12:00");
});
