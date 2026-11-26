/* court-citations: every live requirement id (build/requirements/court-citations.md), tested at the module's interface:
 * the generated data (REPORTERS, VARIANTS, COURTS, SOURCES), the build and its freshness check, and the two lookups.
 * The data is checked against the pinned packages' own files, read here independently of the build. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPORTERS, VARIANTS, COURTS, SOURCES, reporterFor, courtsNamed } from "../index.mjs";
import { spawnSync } from "node:child_process";
import { buildCourtCitations, verifyFresh, DATA_FILE } from "../build.mjs";
import { DATA } from "../court-data.mjs";
import { BUDGET } from "../../bio-plane/scripts/fleet-bundle.mjs";
/** @import { Source, CourtData } from "../index.mjs" */
/** @import { Built, BuildDone, BuildRefused, Pins, RawReporter, RawCourt } from "../build.mjs" */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RDIR = join(ROOT, "vendor", "reporters-db-3.2.66"), CDIR = join(ROOT, "vendor", "courts-db-0.10.27");
const RAW_R = /** @type {{[key: string]: RawReporter[]}} decodes the pinned reporters.json */ (JSON.parse(readFileSync(join(RDIR, "reporters_db/data/reporters.json"), "utf8")));
const RAW_C = /** @type {RawCourt[]} decodes the pinned courts.json */ (JSON.parse(readFileSync(join(CDIR, "courts_db/data/courts.json"), "utf8")));
/** @type {(name: string) => Source} */
const src = (name) => { const s = SOURCES.find((x) => x.package === name); assert.ok(s, name); return s; };
/** @type {(p: string) => string} */
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
/** @type {(s: string) => string} */
const stripPunc = (s) => s.replace(new RegExp(`[${PY_SPACE}]{2,}`, "gu"), " ").replace(new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu"), "");
/** @type {(p: string, fl: string) => RegExp} */
const whole = (p, fl) => new RegExp(`^(?:${p})$`, fl);
/* Every object in a datum is frozen: each one JSON.stringify walks to. */
/** @param {unknown} o */
function isDeepFrozen(o) {
  /** @type {object[]} */
  const unfrozen = [];
  JSON.stringify(o, (/** @type {string} */ _key, /** @type {unknown} */ v) => { if (v !== null && typeof v === "object" && !Object.isFrozen(v)) unfrozen.push(v); return v; });
  return unfrozen.length === 0;
}
/* The build ran, and its answer. */
/** @type {(b: Built) => BuildDone} */
const done = (b) => { if (!b.ok) assert.fail(`the build was refused: ${b.why}`); return b; };
/* The build was refused, and its answer. */
/** @type {(b: Built) => BuildRefused} */
const refused = (b) => { if (b.ok) assert.fail("the build ran"); return b; };
/* The data a generated module holds, read from its text as index.mjs reads its one JSON text (R11). */
/**
 * @param {string} text
 * @returns {CourtData}
 */
function dataOf(text) {
  const literal = /\nexport const DATA = "([^]*)";\n$/.exec(text)?.[1];
  if (literal === undefined) return assert.fail("the module exports DATA as one string");
  const json = JSON.parse(`"${literal.replaceAll("\\\n", "")}"`);
  if (typeof json !== "string") return assert.fail("DATA is a string");
  return /** @type {CourtData} decodes the build's own data text */ (JSON.parse(json));
}

/* A small package pair of a test's own, with pins to match, for the build's translation and refusal cases. */
/**
 * @param {{regexes?: unknown, reporters: unknown, courts: string, variables?: unknown, places?: [string, string][]}} packages
 * @returns {{dir: string, r: string, c: string, pins: Pins}}
 */
function miniPackages({ regexes = { full_cite: "$volume $reporter $page", volume: "(?P<volume>\\d+)", page: "(?P<page>\\d+)", reporter: "(?P<reporter>$edition)" },
  reporters, courts, variables = {}, places = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "court-citations-")), r = join(dir, "r"), c = join(dir, "c");
  /** @type {(base: string, rel: string, text: string) => void} */
  const write = (base, rel, text) => { mkdirSync(dirname(join(base, rel)), { recursive: true }); writeFileSync(join(base, rel), text); };
  write(r, "reporters_db/data/reporters.json", JSON.stringify(reporters));
  write(r, "reporters_db/data/regexes.json", JSON.stringify(regexes));
  write(r, "LICENSE", "Copyright (c) 2000, Test\nLicence text.\n");
  write(c, "courts_db/data/courts.json", courts);
  write(c, "courts_db/data/variables.json", JSON.stringify(variables));
  for (const [k, v] of places) write(c, `courts_db/data/places/${k}.txt`, v);
  write(c, "LICENSE", "Copyright (c) 2001, Test\nLicence text.\n");
  /** @type {(base: string) => {[rel: string]: string}} */
  const files = (base) => {
    /** @type {{[rel: string]: string}} */
    const shas = {};
    for (const f of readdirSync(base, { recursive: true })) if (statSync(join(base, f)).isFile()) shas[f] = sha(join(base, f));
    return shas;
  };
  /** @type {Pins} */
  const pins = { packages: [
    { package: "reporters-db", version: "0.0.1", dir: "r", url: "u", project: "p", wheel: null, licence: "BSD-2-Clause", licence_file: "LICENSE", files: files(r) },
    { package: "courts-db", version: "0.0.2", dir: "c", url: "u", project: "p", wheel: null, licence: "BSD-2-Clause", licence_file: "LICENSE", files: files(c) }] };
  return { dir, r, c, pins };
}
/**
 * @param {{regexes?: unknown, reporters: unknown, courts: string, variables?: unknown, places?: [string, string][]}} opts
 */
function buildMini(opts) {
  const m = miniPackages(opts);
  const out = join(m.dir, "data.mjs");
  const b = done(buildCourtCitations({ reportersDir: m.r, courtsDir: m.c, out, pins: m.pins }));
  // The generated module holds the data as one JSON text (R11); a test reads it parsed, as index.mjs does.
  const mod = dataOf(readFileSync(out, "utf8"));
  return { ...m, b, mod };
}
const ONE_REPORTER = { "X.": [{ name: "X Reports", cite_type: "state", editions: { "X.": { start: null, end: null } }, variations: {}, mlz_jurisdiction: [] }] };

test("R1: REPORTERS carries every reporter entry of the pinned reporters-db, with its editions, dates and variations", () => {
  /** @type {{key: string, name: string, cite_type: string, editions: {key: string, start: string | null, end: string | null}[], variations: {[spelling: string]: string}}[]} */
  const expected = [];
  for (const [key, list] of Object.entries(RAW_R)) for (const d of list) {
    expected.push({ key, name: d.name, cite_type: d.cite_type,
      editions: Object.entries(d.editions).map(([k, e]) => ({ key: k, start: e.start ?? null, end: e.end ?? null })), variations: d.variations });
  }
  assert.equal(REPORTERS.length, expected.length);
  REPORTERS.forEach((r, i) => assert.deepEqual({ key: r.key, name: r.name, cite_type: r.cite_type,
    editions: r.editions.map((e) => ({ key: e.key, start: e.start, end: e.end })), variations: { ...r.variations } }, expected[i], r.key));
  assert.equal(new Set(REPORTERS.map((r) => r.key)).size, 1236);
  assert.ok(isDeepFrozen(REPORTERS));
});

test("R1: VARIANTS maps every variant and standard abbreviation to each {reporter, edition}, never to one chosen", () => {
  /** @type {[string, {reporter: string, edition: string}[]][]} */
  const none = [];
  const want = new Map(none);
  /** @type {(s: string, reporter: string, edition: string) => void} */
  const add = (s, reporter, edition) => { const l = want.get(s) ?? []; if (!l.some((x) => x.reporter === reporter && x.edition === edition)) l.push({ reporter, edition }); want.set(s, l); };
  for (const [key, list] of Object.entries(RAW_R)) for (const d of list) {
    for (const e of Object.keys(d.editions)) add(e, key, e);
    for (const [v, e] of Object.entries(d.variations)) add(v, key, e);
  }
  assert.deepEqual(Object.keys(VARIANTS).sort(), [...want.keys()].sort());
  for (const [s, l] of want) assert.deepEqual([...(VARIANTS[s] ?? [])].map((x) => ({ ...x })), l, s);
  const multi = [...want].filter(([, l]) => new Set(l.map((x) => x.edition)).size > 1);
  assert.ok(multi.length >= 40, "the pinned data has variants standing for several editions");
  for (const [s, l] of multi) assert.equal(VARIANTS[s]?.length, l.length, s);
  assert.equal(Reflect.getPrototypeOf(VARIANTS), null);
  assert.ok(isDeepFrozen(VARIANTS));
});

test("R2: COURTS carries every court of the pinned courts-db with its fields, and its name patterns translated", () => {
  assert.equal(COURTS.length, RAW_C.length);
  assert.equal(COURTS.length, 2809);
  const fl = src("courts-db").pattern_flags;
  // The package expands its `${var}` templates through the whole file, examples included, as its loader does.
  const vars = /** @type {{[name: string]: string}} decodes the pinned variables.json */ (JSON.parse(readFileSync(join(CDIR, "courts_db/data/variables.json"), "utf8")));
  /** @type {(s: string) => string} */
  const expand = (s) => s.replace(/\$\{(\w+)\}/g, (/** @type {string} */ m, /** @type {string} */ k) => vars[k] ?? m);
  COURTS.forEach((c, i) => {
    const pinned = RAW_C[i];
    assert.ok(pinned, c.id);
    const raw = { ...pinned, examples: (pinned.examples ?? []).map(expand) };
    assert.deepEqual({ id: c.id, name: c.name, citation_string: c.citation_string, type: c.type, level: c.level, system: c.system,
      jurisdiction: c.jurisdiction, dates: c.dates, examples: c.examples },
    { id: raw.id, name: raw.name, citation_string: raw.citation_string, type: raw.type, level: raw.level, system: raw.system,
      jurisdiction: raw.jurisdiction ?? null, dates: raw.dates, examples: raw.examples }, raw.id);
    assert.equal(c.patterns.length, raw.regex.length, raw.id);
    for (const p of c.patterns) assert.doesNotThrow(() => new RegExp(p, fl), raw.id);
  });
  assert.equal(COURTS.reduce((n, c) => n + c.patterns.length, 0), 5574);
  assert.ok(isDeepFrozen(COURTS));
});

test("R3: SOURCES names each package's version, licence, files with their SHA-256, counts and whole licence text", () => {
  /** @type {(pkg: string) => string} */
  const dirOf = (pkg) => (pkg === "reporters-db" ? RDIR : CDIR);
  assert.deepEqual(SOURCES.map((s) => [s.package, s.version]), [["reporters-db", "3.2.66"], ["courts-db", "0.10.27"]]);
  for (const s of SOURCES) {
    assert.equal(s.licence, "BSD-2-Clause");
    assert.match(s.url, new RegExp(`^https://pypi\\.org/project/${s.package}/${s.version.replaceAll(".", "\\.")}/$`));
    const onDisk = readdirSync(dirOf(s.package), { recursive: true }).filter((f) => /\.(json|txt)$|LICENSE$/.test(f)).sort();
    assert.deepEqual(s.files.map((f) => f.name).sort(), onDisk);
    for (const f of s.files) assert.equal(f.sha256, sha(join(dirOf(s.package), f.name)), f.name);
    const lic = s.files.find((f) => f.name.endsWith("LICENSE"));
    assert.ok(lic, s.package);
    assert.equal(s.licence_text, readFileSync(join(dirOf(s.package), lic.name), "utf8"));
    assert.match(s.copyright ?? "", /^Copyright \(c\) 20\d\d, Free Law Project$/);
    assert.match(s.licence_text, /Redistributions of source code must retain/);
  }
  const r = src("reporters-db").counts, c = src("courts-db").counts;
  const reporters = r.reporters;
  assert.equal(reporters, Object.keys(RAW_R).length);
  assert.equal(reporters, 1236); assert.equal(r.variations, 2369);
  assert.equal(r.editions, REPORTERS.reduce((n, x) => n + x.editions.length, 0));
  assert.equal(r.patterns, REPORTERS.reduce((n, x) => n + x.editions.reduce((m, e) => m + e.patterns.length, 0), 0));
  assert.equal(c.courts, 2809); assert.equal(c.patterns, 5574);
  assert.ok(isDeepFrozen(SOURCES));
});

test("R4: the build reads the pinned files and writes the one data module, every pattern compiling in JavaScript", () => {
  const dir = mkdtempSync(join(tmpdir(), "court-citations-out-")), out = join(dir, "data.mjs");
  try {
    const b = done(buildCourtCitations({ out }));
    assert.equal(b.ok, true); assert.equal(b.file, out);
    assert.equal(readFileSync(out, "utf8"), readFileSync(DATA_FILE, "utf8"));
    const rf = src("reporters-db").pattern_flags, cf = src("courts-db").pattern_flags;
    for (const r of REPORTERS) for (const e of r.editions) {
      assert.ok(e.patterns.length >= 1, `${r.key} ${e.key} has a pattern`);
      for (const p of e.patterns) assert.doesNotThrow(() => new RegExp(p, rf), `${r.key} ${e.key}`);
    }
    for (const c of COURTS) if (c.name_pattern) assert.doesNotThrow(() => new RegExp(c.name_pattern, cf), c.id);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R4: a file not at its pinned version is refused, and nothing is written", () => {
  const m = miniPackages({ reporters: ONE_REPORTER, courts: "[]" });
  try {
    writeFileSync(join(m.c, "courts_db/data/variables.json"), "{\"x\": \"y\"}");
    const out = join(m.dir, "data.mjs");
    const b = refused(buildCourtCitations({ reportersDir: m.r, courtsDir: m.c, out, pins: m.pins }));
    assert.equal(b.ok, false); assert.match(b.why, /not the pinned 0\.0\.2/);
    assert.throws(() => readFileSync(out));
  } finally { rmSync(m.dir, { recursive: true, force: true }); }
});

test("R4: Python templates and constructs are expanded and translated to equivalent JavaScript", () => {
  const reporters = { "Ab.": [{ name: "Ab", cite_type: "state", mlz_jurisdiction: [],
    editions: { "Ab.": { start: "1900-01-01T00:00:00", end: null, regexes: ["$full_cite", "(?P<volume>\\d+)-(?P=volume) $reporter,? $page_optional[a-c]{,2}$"] } },
    variations: { "Ab": "Ab." }, examples: ["12 Ab. 34", "7-7 Ab 9 ab"] }] };
  const courts = JSON.stringify([
    { id: "t1", name: "Test High Court", citation_string: "T.", type: "appellate", level: "colr", system: "state", location: "L", dates: [{ start: null, end: null }],
      examples: ["the 2nd court of TOWNA", "Sixth District Court"], regex: ["the ${n2} court of ${towns}", "${2-6} District Court", "(?i)x\\.y\\b"] },
    { id: "t2", name: "Child Court", parent: "t1", citation_string: "C.", level: "trial", system: "state", examples: [], regex: ["a++b", "(?(1)a|b)"] }]);
  const { dir, b, mod } = buildMini({ reporters, courts, variables: { n2: "(Second|2nd)" }, places: [["towns", "TownA\nTownB\n"]],
    regexes: { full_cite: "$volume $reporter,? $page", volume: "(?P<volume>\\d+)", page: "(?P<page>\\d+)", reporter: "(?P<reporter>$edition)" } });
  try {
    assert.equal(b.ok, true);
    const edition = mod.REPORTERS[0]?.editions[0];
    assert.ok(edition);
    const [p1, p2] = edition.patterns.map((p) => whole(p, "u"));
    assert.ok(p1 && p2);
    assert.equal(p1.exec("12 Ab 34")?.groups?.reporter, "Ab");                // $edition takes its variants
    assert.equal(p1.exec("\u0663 Ab. 4")?.groups?.volume, "\u0663");           // Python's \d is any decimal digit
    assert.ok(p2.test("7-7 Ab. 9 ab") && !p2.test("7-8 Ab. 9"));             // (?P=name) is a back-reference
    assert.ok(!p2.test("7-7 Ab. 9 abc"));                                     // {,2} is {0,2}
    assert.ok(new RegExp(edition.patterns[1] ?? "", "u").test("7-7 Ab. 9\n")); // $ before a final newline
    const [t1, t2] = mod.COURTS;
    assert.ok(t1 && t2);
    assert.equal(t1.patterns.length, 3);
    const [c1, c2, c3] = t1.patterns.map((p) => whole(p, "iu"));
    assert.ok(c1 && c2 && c3);
    assert.ok(c1.test("THE 2nd court of townb") && !c1.test("the 2nd court of townc")); // variables and place lists, ignoring case
    assert.ok(c2.test("sixth district court") && c2.test("twenty first district court") === false);
    assert.ok(c3.test("X.Y") && !c3.test("x.yz") && !c3.test("x\ny"));          // inline flag, \b, '.' not a newline
    assert.equal(t2.type, "appellate");                                       // a child inherits what it lacks
    assert.deepEqual(t2.patterns, []);
    const bad = b.untranslated.filter((u) => u.key === "t2");
    assert.equal(bad.length, 2);
    assert.ok(bad.every((u) => u.package === "courts-db" && u.pattern && u.why));
    assert.match(bad[0]?.why ?? "", /possessive/); assert.match(bad[1]?.why ?? "", /group \(\?\(/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R5: every example each package gives for a court or reporter matches its translated patterns; none untranslated", () => {
  const b = done(buildCourtCitations({ write: false }));
  assert.deepEqual(b.untranslated, [], b.untranslated.map((u) => `${u.package} ${u.key}: ${u.why}`).join("\n"));
  const rf = src("reporters-db").pattern_flags, cf = src("courts-db").pattern_flags;
  /** @type {string[]} */
  const failed = [];
  for (const r of REPORTERS) {
    const res = r.editions.flatMap((e) => e.patterns).map((p) => whole(p, rf));
    for (const ex of r.examples) if (!res.some((x) => x.test(ex))) failed.push(`${r.key}: ${ex}`);
  }
  let n = 0;
  for (const c of COURTS) {
    const name = c.name_pattern;
    const res = [...c.patterns, ...(name ? [name] : [])].map((p) => whole(p, cf));
    for (const ex of c.examples) { n++; if (!res.some((x) => x.test(stripPunc(ex)))) failed.push(`${c.id}: ${ex}`); }
  }
  assert.deepEqual(failed, []);
  assert.equal(n, 1925);
  assert.equal(REPORTERS.reduce((k, r) => k + r.examples.length, 0), 504);
});

test("R5: a pattern whose translation fails its example is listed with its key and why, and never shipped", () => {
  const courts = JSON.stringify([{ id: "z1", name: "Zed Court", citation_string: "Z.", type: "trial", level: "trial", system: "state", location: "L",
    dates: [], examples: ["Wye Tribunal"], regex: ["Zed Ct", "Zee Court"] }]);
  const reporters = { "Q.": [{ name: "Q", cite_type: "state", mlz_jurisdiction: [], editions: { "Q.": { start: null, end: null, regexes: ["$volume $reporter $page"] } },
    variations: {}, examples: ["Q. 12"] }] };
  const { dir, b, mod } = buildMini({ reporters, courts });
  try {
    assert.equal(b.ok, true);
    assert.deepEqual(mod.COURTS[0]?.patterns, []); assert.equal(mod.COURTS[0]?.name_pattern, null);
    assert.deepEqual(mod.REPORTERS[0]?.editions[0]?.patterns, []);
    const z = b.untranslated.filter((u) => u.key === "z1");
    assert.deepEqual(z.map((u) => u.pattern), ["Zed Ct", "Zee Court", "Zed Court"]);
    assert.ok(z.every((u) => u.why.includes("\"Wye Tribunal\"")));
    const q = b.untranslated.filter((u) => u.key === "Q.");
    assert.equal(q.length, 1); assert.match(q[0]?.why ?? "", /"Q\. 12"/);
    assert.equal(mod.SOURCES[1]?.counts.patterns, 2); assert.equal(mod.SOURCES[1]?.counts.patterns_shipped, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R6: verifyFresh answers true only for a byte-identical committed file, false for a changed one, null without the packages", () => {
  assert.deepEqual(verifyFresh().fresh, true);
  const dir = mkdtempSync(join(tmpdir(), "court-citations-fresh-")), f = join(dir, "data.mjs");
  try {
    writeFileSync(f, readFileSync(DATA_FILE, "utf8") + " ");
    const changed = verifyFresh({ file: f });
    assert.equal(changed.fresh, false); assert.match(changed.why, /differs/);
    const absent = verifyFresh({ reportersDir: join(dir, "none"), courtsDir: join(dir, "none") });
    assert.equal(absent.fresh, null); assert.match(absent.why, /could not check/);
    for (const f of readdirSync(CDIR, { recursive: true })) {
      if (!statSync(join(CDIR, f)).isFile() || f === "courts_db/data/variables.json") continue;
      mkdirSync(dirname(join(dir, "c", f)), { recursive: true });
      writeFileSync(join(dir, "c", f), readFileSync(join(CDIR, f)));
    }
    assert.equal(verifyFresh({ courtsDir: join(dir, "c") }).fresh, null);
    assert.ok(readFileSync(DATA_FILE, "utf8").startsWith("// GENERATED by court-citations/build.mjs"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("R7: reporterFor answers VARIANTS' entries as written, then after folding white space and periods, else null", () => {
  for (const [s, l] of Object.entries(VARIANTS)) assert.equal(reporterFor(s), l, s);
  /** @type {(s: string) => string} */
  const foldKey = (s) => s.replace(/[\s.]+/gu, "");
  /** @type {[string, {reporter: string, edition: string}[]][]} */
  const none = [];
  const byFold = new Map(none);
  for (const [k, v] of Object.entries(VARIANTS)) byFold.set(foldKey(k), [...(byFold.get(foldKey(k)) ?? []), ...v]);
  for (const [s, l] of Object.entries(VARIANTS)) {
    const variant = ` ${foldKey(s).split("").join(" .")} `;
    if (Object.hasOwn(VARIANTS, variant)) continue;
    const got = reporterFor(variant);
    assert.ok(got, s);
    for (const x of l) assert.ok(got.some((y) => y.reporter === x.reporter && y.edition === x.edition), s);
    const union = byFold.get(foldKey(s)) ?? [];
    assert.equal(got.length, new Set(union.map((x) => `${x.reporter}\u0000${x.edition}`)).size, s);
  }
  assert.deepEqual([...(reporterFor("A 2d") ?? [])], [{ reporter: "A.", edition: "A.2d" }]);
  for (const x of ["No Such Rptr.", "", " . ", null, undefined, 12, {}, [], "\u0000", "x".repeat(100000), Symbol.iterator]) {
    assert.doesNotThrow(() => reporterFor(x)); assert.equal(reporterFor(x), null);
  }
  assert.ok(reporterFor("a.2d") === null, "case is not folded");
});

test("R7: courtsNamed answers every court one of whose patterns matches the whole text, in COURTS order, else []", () => {
  const order = new Map(COURTS.map((c, i) => [c.id, i]));
  for (const c of COURTS) for (const ex of c.examples) {
    const got = courtsNamed(ex);
    assert.ok(got.includes(c.id), `${c.id}: ${ex}`);
    const at = got.map((id) => order.get(id) ?? -1);
    for (let i = 1; i < at.length; i++) assert.ok((at[i - 1] ?? -1) < (at[i] ?? -1), ex);
  }
  assert.ok(courtsNamed("  SUPREME   court of the united states\n").includes("scotus"), "case and white space folded");
  assert.deepEqual(courtsNamed("the Supreme Court of the United States held"), [], "the whole text, not a part of it");
  for (const x of ["", "   ", "zzzz no court", null, undefined, 3, {}, ["Supreme Court"], "(".repeat(5000), "a".repeat(20000)]) {
    assert.doesNotThrow(() => courtsNamed(x)); assert.deepEqual(courtsNamed(x), []);
  }
});

test("R8: pure data, the same pinned versions give the same file, and no network, store or clock is used at run time", async () => {
  const a = done(buildCourtCitations({ write: false })).text, b = done(buildCourtCitations({ write: false })).text;
  assert.equal(a, b);
  const saved = { fetch: globalThis.fetch, now: Date.now, D: globalThis.Date };
  globalThis.fetch = () => { throw new Error("network used"); };
  Date.now = () => { throw new Error("clock used"); };
  globalThis.Date = new Proxy(saved.D, { construct() { throw new Error("clock used"); } });
  try {
    /** @type {typeof import("../index.mjs")} */
    const m = await import(`../index.mjs?r8=${1}`);
    assert.ok((m.reporterFor("U.S.")?.length ?? 0) >= 1);
    assert.ok(m.courtsNamed("Supreme Court of the United States").includes("scotus"));
  } finally { globalThis.fetch = saved.fetch; Date.now = saved.now; globalThis.Date = saved.D; }
});

test("R9: kept apart from profiles: the data covers every court the package lists, and no answer depends on a place setting", async () => {
  assert.equal(COURTS.length, RAW_C.length);
  const systems = new Set(RAW_C.map((c) => c.system));
  for (const s of systems) {
    const c = COURTS.find((x) => x.system === s && x.examples.length);
    if (c) assert.ok(courtsNamed(c.examples[0]).includes(c.id), String(s));
  }
  const before = JSON.stringify([courtsNamed("Supreme Court of the United States"), reporterFor("F.3d")]);
  process.env.BIO_PROFILE = "test-port-ellery"; process.env.BIO_JURISDICTIONS = "test-port-ellery";
  try {
    /** @type {typeof import("../index.mjs")} */
    const m = await import(`../index.mjs?r9=${1}`);
    assert.equal(JSON.stringify([m.courtsNamed("Supreme Court of the United States"), m.reporterFor("F.3d")]), before);
  } finally { delete process.env.BIO_PROFILE; delete process.env.BIO_JURISDICTIONS; }
});

test("R10: a recognised reporter or court is a spelling recognised, never a citation asserted real, resolved or verified", () => {
  const forbidden = /verif|resol|real|valid|exist|status/i;
  for (const l of Object.values(VARIANTS)) for (const x of l) assert.deepEqual(Object.keys(x), ["reporter", "edition"]);
  for (const r of REPORTERS) for (const k of Object.keys(r)) assert.ok(!forbidden.test(k), k);
  for (const c of COURTS.slice(0, 50)) for (const k of Object.keys(c)) assert.ok(!forbidden.test(k), k);
  const got = courtsNamed("Supreme Court of the United States");
  assert.ok(got.every((id) => typeof id === "string"));
  assert.deepEqual([...(reporterFor("F.3d") ?? [])].map((x) => Object.keys(x)), [["reporter", "edition"]]);
});

/* R11: a fresh process imports the module, timing its evaluation as bundler R31 times a global scope (a fresh import),
 * with JSON.parse counted, then reads each export; the parse count shows when the data was built. */
/**
 * What one fresh process measured: the import's time and the first read's, the parses counted at each point, and what
 * the first and a second read answered.
 * @typedef {{importMs: number, firstMs: number, atImport: number, afterFirst: number, afterAll: number, first: unknown, again: unknown}} Measure
 */
/**
 * @param {string} reads
 * @returns {Measure}
 */
function measured(reads) {
  const script = `
    const parse = JSON.parse; let parses = 0;
    JSON.parse = function (...a) { parses++; return parse.apply(this, a); };
    const t0 = performance.now();
    const m = await import(${JSON.stringify(pathToFileURL(join(ROOT, "index.mjs")).href)});
    const importMs = performance.now() - t0, atImport = parses;
    const t1 = performance.now();
    const first = (${reads})(m);
    const firstMs = performance.now() - t1, afterFirst = parses;
    const again = (${reads})(m);
    for (const k of ["REPORTERS", "COURTS", "SOURCES", "VARIANTS"]) Object.keys(m[k]);
    m.reporterFor("F.3d"); m.courtsNamed("Supreme Court of the United States");
    JSON.parse = parse;
    process.stdout.write(JSON.stringify({ importMs, firstMs, atImport, afterFirst, afterAll: parses, first, again }));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return /** @type {Measure} decodes what this test's own child process wrote */ (JSON.parse(r.stdout));
}

test("R11: evaluating the module builds none of the data; it is parsed once, on the first read of any export", () => {
  /** @type {[string, string][]} */
  const firsts = [
    ["REPORTERS", "(m) => m.REPORTERS.length"], ["VARIANTS", "(m) => Object.keys(m.VARIANTS).length"], ["COURTS", "(m) => m.COURTS[0].id"],
    ["SOURCES", "(m) => m.SOURCES.map((s) => s.version)"], ["reporterFor", "(m) => m.reporterFor(\"F.3d\")"],
    ["courtsNamed", "(m) => m.courtsNamed(\"Supreme Court of the United States\")"],
  ];
  for (const [name, read] of firsts) {
    const r = measured(read);
    assert.equal(r.atImport, 0, `${name}: nothing is parsed when the module is evaluated`);
    assert.equal(r.afterFirst, 1, `${name}: its first read parses the data, once`);
    assert.equal(r.afterAll, 1, `${name}: no read after the first parses again, of any export`);
    assert.deepEqual(r.again, r.first, name);
    assert.ok(r.importMs < BUDGET.startWarnMs, `${name}: the import's global scope took ${r.importMs} ms, past bundler R31's ${BUDGET.startWarnMs} ms`);
    console.log(`R11 ${name}: import ${r.importMs.toFixed(1)} ms, first read ${r.firstMs.toFixed(1)} ms`);
  }
  // The data module itself holds one string and nothing built: its only export is the JSON text.
  const text = readFileSync(DATA_FILE, "utf8");
  assert.deepEqual([...text.matchAll(/^export /gm)].length, 1);
  assert.match(text, /^export const DATA = "/m);
});

test("R11: each export's first and later reads equal the committed data, read by the same names and shapes", async () => {
  const committed = dataOf(readFileSync(DATA_FILE, "utf8"));
  assert.deepEqual(committed, JSON.parse(DATA));
  /** @type {typeof import("../index.mjs")} */
  const m = await import(`../index.mjs?r11=${1}`);
  /** @type {[string, readonly object[], object[]][]} */
  const lists = [["SOURCES", m.SOURCES, committed.SOURCES], ["REPORTERS", m.REPORTERS, committed.REPORTERS], ["COURTS", m.COURTS, committed.COURTS]];
  for (const [k, list, want] of lists) {
    for (const read of [1, 2]) {
      assert.equal(Array.isArray(list), true, `${k} read ${read}`);
      assert.equal(list.length, want.length, `${k} read ${read}`);
      assert.deepEqual(JSON.parse(JSON.stringify(list)), want, `${k} read ${read}`);
      list.forEach((x, i) => assert.deepEqual(x, want[i], `${k}[${i}] read ${read}`));
      assert.ok(isDeepFrozen(list), k);
    }
    assert.equal(list[0], list[0], `${k}: a later read answers the same object`);
  }
  assert.equal(m.SOURCES, m.SOURCES); assert.equal(m.REPORTERS, m.REPORTERS); assert.equal(m.COURTS, m.COURTS); assert.equal(m.VARIANTS, m.VARIANTS);
  assert.deepEqual(Object.keys(m).sort(), ["COURTS", "REPORTERS", "SOURCES", "VARIANTS", "courtsNamed", "reporterFor"]);
  // VARIANTS is R1's index of the committed REPORTERS, and equals the statically imported one entry for entry.
  assert.equal(Reflect.getPrototypeOf(m.VARIANTS), null);
  assert.deepEqual(Object.keys(m.VARIANTS), Object.keys(VARIANTS));
  for (const [s, l] of Object.entries(VARIANTS)) assert.deepEqual([...(m.VARIANTS[s] ?? [])].map((x) => ({ ...x })), [...l].map((x) => ({ ...x })), s);
  assert.equal(m.VARIANTS["F.3d"], m.VARIANTS["F.3d"]);
  // Frozen as the data was: no write lands, and each refusal throws in strict code, as on a frozen array or object.
  assert.throws(() => { m.REPORTERS.push({}); }, TypeError);
  assert.throws(() => { m.COURTS[0] = null; }, TypeError);
  assert.throws(() => { m.VARIANTS["New."] = []; }, TypeError);
  assert.throws(() => { delete m.SOURCES[0]; }, TypeError);
  assert.throws(() => Object.defineProperty(m.REPORTERS, "x", { value: 1 }), TypeError);
  assert.equal(m.REPORTERS.length, committed.REPORTERS.length);
});

test("R11 (R6): verifyFresh covers the data in its new form: one JSON text that parses to the build's data", () => {
  const b = done(buildCourtCitations({ write: false }));
  assert.equal(b.text, readFileSync(DATA_FILE, "utf8"));
  assert.equal(verifyFresh().fresh, true);
  const dir = mkdtempSync(join(tmpdir(), "court-citations-r11-")), f = join(dir, "data.mjs");
  try {
    // Control: the same data held as built objects (the form before R11) is not fresh.
    const d = dataOf(b.text);
    assert.deepEqual(Object.keys(d), ["SOURCES", "REPORTERS", "COURTS"]);
    /** @type {[string, unknown][]} */
    const parts = [["SOURCES", d.SOURCES], ["REPORTERS", d.REPORTERS], ["COURTS", d.COURTS]];
    writeFileSync(f, b.text.replace(/^export const DATA = [^]*$/m, () => parts.map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};\n`).join("")));
    assert.equal(verifyFresh({ file: f }).fresh, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
