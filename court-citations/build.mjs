/* court-citations: the build (R3–R6). Reads the two pinned Free Law Project packages' files (`pins.json`), expands
 * their Python regular-expression templates exactly as each package's own loader does, translates every pattern to
 * JavaScript (translate.mjs), checks each against the package's own examples, and writes the one generated data
 * module, `court-data.mjs`. Run from the repository root: `node court-citations/build.mjs` (writes the file) or
 * `node court-citations/build.mjs --check` (verifyFresh). Build time only: nothing at run time imports this file. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { translate, Untranslatable } from "./translate.mjs";
/** @import { Source, Reporter, Edition, Court, CourtDate, SourceCounts, SourceFile, Wheel } from "./index.mjs" */

/**
 * One pinned package (pins.json): its version, the folder its files are kept in, and each file's SHA-256 by its path in
 * the wheel.
 * @typedef {{readonly package: string, readonly version: string, readonly dir: string, readonly url: string,
 *   readonly project: string, readonly wheel: Wheel | null, readonly licence: string, readonly licence_file: string,
 *   readonly files: {readonly [rel: string]: string}}} Pin
 */
/** @typedef {{readonly packages: readonly Pin[]}} Pins the pinned packages the build reads */
/**
 * A pattern or construct the build could not ship (R5): its package, its source key, the Python pattern, and why.
 * @typedef {Object} Untranslated
 * @property {string} package
 * @property {string} key
 * @property {string} pattern
 * @property {string} why
 */
/**
 * What the build answers when it ran (R4): the file written (or null), what it could not translate, and the module's text.
 * @typedef {Object} BuildDone
 * @property {true} ok
 * @property {string | null} file
 * @property {Untranslated[]} untranslated
 * @property {string} text
 */
/**
 * What the build answers when a package's files are absent or not at their pinned version (R4).
 * @typedef {Object} BuildRefused
 * @property {false} ok
 * @property {null} file
 * @property {Untranslated[]} untranslated
 * @property {string} why
 * @property {boolean} absent
 */
/** @typedef {BuildDone | BuildRefused} Built */
/**
 * Where the build reads and writes: the two packages' folders, the file it writes, whether it writes, and the pins.
 * @typedef {Object} BuildOptions
 * @property {string | undefined} [reportersDir]
 * @property {string | undefined} [courtsDir]
 * @property {string} [out]
 * @property {boolean} [write]
 * @property {Pins} [pins]
 */
/** @typedef {{fresh: boolean | null, why: string}} Freshness R6's answer: fresh, stale, or null where it could not check */
/** @typedef {{[name: string]: string}} Variables a template's variables, by name */
/** @typedef {{[name: string]: string | RawVariables}} RawVariables reporters-db's regexes.json: nested templates */
/**
 * One edition as reporters-db gives it.
 * @typedef {Object} RawEdition
 * @property {string | null} [start]
 * @property {string | null} [end]
 * @property {string[]} [regexes]
 */
/**
 * One reporter entry as reporters-db gives it.
 * @typedef {Object} RawReporter
 * @property {string} name
 * @property {string} cite_type
 * @property {{[edition: string]: RawEdition}} editions
 * @property {{[spelling: string]: string}} variations
 * @property {string[]} [examples]
 */
/**
 * One court as courts-db gives it.
 * @typedef {Object} RawCourt
 * @property {string} id
 * @property {string} name
 * @property {string[]} regex
 * @property {string[]} [examples]
 * @property {string | null} [citation_string]
 * @property {string | null} [type]
 * @property {string | null} [level]
 * @property {string | null} [system]
 * @property {string | null} [jurisdiction]
 * @property {CourtDate[]} [dates]
 * @property {string} [location]
 * @property {string} [parent]
 */
/** @typedef {{source: string, python: string}} Pattern a translated pattern beside the Python it came from */
/** @typedef {{pin: Pin, files: SourceFile[], text: {[rel: string]: string}}} PackageFiles a package's files, read and checked */
/** @typedef {{why: string, absent: boolean}} PackageMissing why a package's files could not be read */

const HERE = dirname(fileURLToPath(import.meta.url));
const PINS_FILE = join(HERE, "pins.json");
/* pins.json, this module's own record of the pinned packages. */
/** @returns {Pins} */
const readPins = () => /** @type {Pins} decodes this module's pins.json */ (JSON.parse(readFileSync(PINS_FILE, "utf8")));
/* The folder under vendor/ that holds a package's pinned files. */
/**
 * @param {string} name
 * @returns {string}
 */
const vendorDir = (name) => {
  const pin = readPins().packages.find((p) => p.package === name);
  if (!pin) throw new TypeError(`pins.json names no ${name}`);
  return join(HERE, "vendor", pin.dir);
};
export const DATA_FILE = join(HERE, "court-data.mjs");
const FLAGS = { reporters: "u", courts: "iu" };

/* ---- Python's string.Template and str helpers, as the packages' loaders use them ---- */
const TEMPLATE = /\$(?:(\$)|([_a-zA-Z][_a-zA-Z0-9]*)|\{([_a-zA-Z][_a-zA-Z0-9]*)\}|())/g;
/**
 * @param {string} tpl
 * @param {Variables} vars
 * @param {boolean} safe
 * @returns {string}
 */
function substitute(tpl, vars, safe) {
  return tpl.replace(TEMPLATE, (/** @type {string} */ m, /** @type {string | undefined} */ esc, /** @type {string | undefined} */ named, /** @type {string | undefined} */ braced) => {
    if (esc !== undefined) return "$";
    const k = named ?? braced;
    if (k !== undefined) {
      const v = vars[k];
      if (Object.hasOwn(vars, k) && v !== undefined) return v;
      if (safe) return m;
      throw new Error(`template variable ${k} is not defined`);
    }
    if (safe) return m;
    throw new Error(`invalid template placeholder at "${tpl.slice(tpl.indexOf(m), tpl.indexOf(m) + 12)}"`);
  });
}
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
/** @param {string} s */
const splitlines = (s) => { const a = s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/); if (a.at(-1) === "") a.pop(); return a; };
/* courts-db's strip_punc: runs of two or more white-space characters become one space; the ends are trimmed. */
/** @type {(s: string) => string} */
export const stripPunc = (s) => s.replace(new RegExp(`[${PY_SPACE}]{2,}`, "gu"), " ").replace(new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu"), "");
/* Python 3.7+ re.escape: the characters it escapes. */
/** @param {string} s */
const pyEscape = (s) => s.replace(/[()[\]{}?*+\-|^$\\.&~# \t\n\r\v\f]/g, (c) => `\\${c}`);

/* ---- reporters-db: utils.process_variables and recursive_substitute ---- */
/**
 * @param {RawVariables} raw
 * @returns {Variables}
 */
function processVariables(raw) {
  /** @type {Variables} */
  const flat = {};
  /**
   * @param {RawVariables} d
   * @param {string} parent
   */
  function flatten(d, parent) {
    for (const [k, v] of Object.entries(d)) {
      if (k.endsWith("#")) continue;
      const key = [parent, k].filter(Boolean).join("_");
      if (v && typeof v === "object") flatten(v, key); else flat[key] = v;
    }
  }
  flatten(raw, "");
  for (const [k, v] of Object.entries({ ...flat })) flat[`${k}_optional`] = `(?:${v} ?)?`;
  /** @type {Variables} */
  const out = {};
  for (const [k, v] of Object.entries(flat)) out[k] = recursiveSubstitute(v, flat);
  return out;
}
/**
 * @param {string} tpl
 * @param {Variables} vars
 * @returns {string}
 */
function recursiveSubstitute(tpl, vars) {
  let old = tpl;
  for (let n = 0; n < 100; n++) { const next = substitute(old, vars, true); if (next === old) return next; old = next; }
  throw new Error(`max_depth exceeded for template '${tpl}'`);
}

/* ---- courts-db: utils.load_courts_db ---- */
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "nineth", "tenth", "eleventh",
  "twelveth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
/** @type {[string, string | null][]} each ten, and its own ordinal (twentieth is already listed) */
const TENS = [["twenty", null], ["thirty", "thirtieth"], ["fourty", "fortieth"], ["fifty", "fiftieth"], ["sixty", "sixtieth"],
  ["seventy", "seventieth"], ["eighty", "eightieth"], ["ninety", "ninetieth"]];
for (const [tens, tenth] of TENS) {
  if (tenth !== null) ORDINALS.push(tenth);
  for (const u of ["first", "secondth", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "nineth"]) ORDINALS.push(`${tens}(-| )${u}`);
}
ORDINALS.push("one[- ]hundredth");

/**
 * @param {string} text
 * @param {Variables} variables
 * @returns {RawCourt[]}
 */
function loadCourts(text, variables) {
  let temp = text;
  for (const [, a, b] of [...text.matchAll(/\$\{(\d+)-(\d+)\}/g)]) {
    temp = temp.replaceAll(`\${${a}-${b}}`, `((${ORDINALS.slice(Number(a) - 1, Number(b)).join(")|(")}))`);
  }
  const data = /** @type {RawCourt[]} decodes courts-db's courts.json */ (JSON.parse(substitute(temp, variables, false).replaceAll("\\", "\\\\")));
  for (const k of data) {
    const parentId = k.parent;
    if ("parent" in k && !("dates" in k && "type" in k && "location" in k)) {
      const parent = data.find((x) => x.id === parentId);
      if (!parent) throw new TypeError(`${k.id}: its parent ${parentId} is not in courts-db`);
      const { dates, type, location } = parent;
      if (!("dates" in k) && dates !== undefined) k.dates = dates;
      if (!("type" in k) && type !== undefined) k.type = type;
      if (!("location" in k) && location !== undefined) k.location = location;
    }
  }
  return data;
}

/* ---- reading the pinned files ---- */
/**
 * @param {Pins} pins
 * @param {string} name
 * @param {string} dir
 * @returns {PackageFiles | PackageMissing}
 */
function readPackage(pins, name, dir) {
  const p = pins.packages.find((x) => x.package === name);
  if (!p) throw new TypeError(`the pins name no ${name}`);
  /** @type {SourceFile[]} */
  const files = [];
  /** @type {{[rel: string]: string}} */
  const text = {};
  for (const [rel, sha] of Object.entries(p.files)) {
    const path = join(dir, rel);
    if (!existsSync(path)) return { why: `${name}: ${rel} is not in ${dir}`, absent: true };
    const bytes = readFileSync(path);
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== sha) return { why: `${name}: ${rel} is not the pinned ${p.version} (SHA-256 ${got})`, absent: false };
    files.push({ name: rel, sha256: sha });
    text[rel] = bytes.toString("utf8");
  }
  return { pin: p, files, text };
}
/**
 * One pinned file's text.
 * @param {PackageFiles} pkg
 * @param {string} rel
 * @returns {string}
 */
function fileText(pkg, rel) {
  const text = pkg.text[rel];
  if (text === undefined) throw new TypeError(`${pkg.pin.package}: ${rel} is not among its pinned files`);
  return text;
}

/** @type {(source: string, flags: string) => RegExp} */
const anchored = (source, flags) => new RegExp(`^(?:${source})$`, flags);
/**
 * A pattern's translation, or why it has none.
 * @param {string} src
 * @param {boolean} ignoreCase
 * @returns {string | Untranslatable}
 */
function tryTranslate(src, ignoreCase) {
  try { return translate(src, { ignoreCase }).source; } catch (e) { if (e instanceof Untranslatable) return e; throw e; }
}

/**
 * @param {string} kind
 * @param {string} key
 * @param {string[]} examples
 * @param {Pattern[]} patterns
 * @param {string} flags
 * @param {(example: string) => string} prepare
 * @param {Untranslated[]} untranslated
 * @returns {boolean}
 */
function checkExamples(kind, key, examples, patterns, flags, prepare, untranslated) {
  const compiled = patterns.map((p) => anchored(p.source, flags));
  const failed = examples.filter((e) => !compiled.some((r) => r.test(prepare(e))));
  if (!failed.length) return true;
  for (const p of patterns) untranslated.push({ package: kind, key, pattern: p.python, why: `translation fails the package's example(s): ${failed.map((e) => JSON.stringify(e)).join(", ")}` });
  return false;
}

/**
 * @param {PackageFiles} pkg
 * @param {Untranslated[]} untranslated
 * @returns {{reporters: Reporter[], counts: SourceCounts}}
 */
function buildReporters(pkg, untranslated) {
  const base = "reporters_db/data/";
  const vars = processVariables(/** @type {RawVariables} decodes reporters-db's regexes.json */ (JSON.parse(fileText(pkg, `${base}regexes.json`))));
  const raw = /** @type {{[key: string]: RawReporter[]}} decodes reporters-db's reporters.json */ (JSON.parse(fileText(pkg, `${base}reporters.json`)));
  /** @type {Reporter[]} */
  const reporters = [];
  let editions = 0, variations = 0, patterns = 0;
  for (const [key, list] of Object.entries(raw)) {
    for (const d of list) {
      variations += Object.keys(d.variations).length;
      /** @type {{key: string, start: string | null, end: string | null, pats: Pattern[]}[]} */
      const eds = [];
      /** @type {Pattern[]} */
      const all = [];
      for (const [ek, ev] of Object.entries(d.editions)) {
        editions++;
        const spellings = [ek, ...Object.keys(d.variations).filter((v) => d.variations[v] === ek)]
          .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
        const alt = `(?:${spellings.map(pyEscape).join("|")})`;
        /** @type {Pattern[]} */
        const pats = [];
        for (const tpl of ev.regexes ?? ["$full_cite"]) {
          let py = recursiveSubstitute(tpl, vars);
          if (py.includes("$edition") || py.includes("${edition}")) py = substitute(py, { edition: alt }, true);
          const r = tryTranslate(py, false);
          if (r instanceof Untranslatable) untranslated.push({ package: "reporters-db", key: `${key} / ${ek}`, pattern: tpl, why: r.message });
          else { const p = { source: r, python: tpl }; pats.push(p); all.push(p); }
        }
        eds.push({ key: ek, start: ev.start ?? null, end: ev.end ?? null, pats });
      }
      const examples = d.examples ?? [];
      const ok = checkExamples("reporters-db", key, examples, all, FLAGS.reporters, (e) => e, untranslated);
      /** @type {Edition[]} */
      const shipped = eds.map((e) => ({ key: e.key, start: e.start, end: e.end, patterns: ok ? e.pats.map((p) => p.source) : [] }));
      for (const e of shipped) patterns += e.patterns.length;
      reporters.push({ key, name: d.name, cite_type: d.cite_type, editions: shipped, variations: { ...d.variations }, examples });
    }
  }
  return { reporters, counts: { reporters: Object.keys(raw).length, entries: reporters.length, editions, variations, patterns } };
}

/**
 * @param {PackageFiles} pkg
 * @param {Untranslated[]} untranslated
 * @returns {{courts: Court[], counts: SourceCounts}}
 */
function buildCourts(pkg, untranslated) {
  const t = pkg.text, base = "courts_db/data/";
  const variables = /** @type {Variables} decodes courts-db's variables.json */ (JSON.parse(fileText(pkg, `${base}variables.json`)));
  for (const rel of Object.keys(t).filter((r) => r.startsWith(`${base}places/`) && r.endsWith(".txt")).sort()) {
    variables[rel.slice(`${base}places/`.length, -4)] = `(${splitlines(fileText(pkg, rel)).join("|")})`;
  }
  const data = loadCourts(fileText(pkg, `${base}courts.json`), variables);
  let source = 0, shipped = 0;
  const courts = data.map((c) => {
    /** @type {Pattern[]} */
    const pats = [];
    for (const raw of c.regex) {
      source++;
      const py = raw.replaceAll("\\\\", "\\");
      const r = tryTranslate(py, true);
      if (r instanceof Untranslatable) untranslated.push({ package: "courts-db", key: c.id, pattern: py, why: r.message });
      else pats.push({ source: r, python: py });
    }
    // courts-db matches a court's name as one more pattern (gather_regexes); it is shipped apart from `patterns`.
    const namePy = c.name.replaceAll("\\\\", "\\"), nr = tryTranslate(namePy, true);
    if (nr instanceof Untranslatable) untranslated.push({ package: "courts-db", key: c.id, pattern: namePy, why: `the name, as a pattern: ${nr.message}` });
    const nameSource = nr instanceof Untranslatable ? null : nr;
    const all = nameSource === null ? pats : [...pats, { source: nameSource, python: namePy }];
    const examples = c.examples ?? [];
    const ok = checkExamples("courts-db", c.id, examples, all, FLAGS.courts, stripPunc, untranslated);
    const patterns = ok ? pats.map((p) => p.source) : [];
    shipped += patterns.length;
    /** @type {Court} */
    const court = { id: c.id, name: c.name, citation_string: c.citation_string ?? null, type: c.type ?? null, level: c.level ?? null,
      system: c.system ?? null, jurisdiction: c.jurisdiction ?? null, dates: c.dates ?? [], patterns,
      name_pattern: ok ? nameSource : null, examples };
    return court;
  });
  return { courts, counts: { courts: courts.length, patterns: source, patterns_shipped: shipped } };
}

/**
 * @param {PackageFiles} pkg
 * @param {SourceCounts} counts
 * @param {string} pattern_flags
 * @returns {Source}
 */
function sourceEntry(pkg, counts, pattern_flags) {
  const p = pkg.pin, licence_text = fileText(pkg, p.licence_file);
  const copyright = licence_text.split("\n").find((l) => /^Copyright/.test(l)) ?? null;
  return { package: p.package, version: p.version, licence: p.licence, url: p.url, project: p.project, wheel: p.wheel,
    files: pkg.files, counts, pattern_flags, copyright, licence_text };
}

/* R11: the data is held as data, one JSON text written as a single string literal (a line continued per entry, so the
 * file stays legible), parsed on first read by index.mjs; evaluating this module builds nothing but the string. */
/**
 * @param {Source[]} sources
 * @param {Reporter[]} reporters
 * @param {Court[]} courts
 * @returns {string}
 */
function render(sources, reporters, courts) {
  const json = `{"SOURCES":${JSON.stringify(sources)},\n"REPORTERS":[\n${reporters.map((x) => JSON.stringify(x)).join(",\n")}\n],\n`
    + `"COURTS":[\n${courts.map((x) => JSON.stringify(x)).join(",\n")}\n]}`;
  const literal = json.split("\n").map((l) => JSON.stringify(l).slice(1, -1)).join("\\\n");
  const notice = sources.map((s) => `// ${s.package} ${s.version}: ${s.copyright} (${s.licence}; full text in SOURCES).`).join("\n");
  return `// GENERATED by court-citations/build.mjs from the pinned Free Law Project packages (court-citations/pins.json).
// Do not edit: regenerate from the repository root with \`node court-citations/build.mjs\` (PROCESS-MECHANICS §14).
${notice}
// This file reproduces their data, translated; their copyright notices, conditions and disclaimer are carried whole
// in SOURCES[].licence_text, as their licence requires.
// The data is one JSON text, {SOURCES, REPORTERS, COURTS}, held as a string (each line ends in a continuation, so the
// text has no line breaks of its own); index.mjs parses it on first read (R11).
export const DATA = "${literal}";
`;
}

/* R4–R5. With write: false, nothing is written and `text` carries the result (verifyFresh). `pins` defaults to
 * pins.json; a test passes its own to build a small package of its own. */
/**
 * @param {BuildOptions} [options]
 * @returns {Built}
 */
export function buildCourtCitations({ reportersDir = vendorDir("reporters-db"), courtsDir = vendorDir("courts-db"), out = DATA_FILE, write = true, pins = readPins() } = {}) {
  const rp = readPackage(pins, "reporters-db", reportersDir), cp = readPackage(pins, "courts-db", courtsDir);
  if ("why" in rp) return { ok: false, file: null, untranslated: [], why: rp.why, absent: rp.absent };
  if ("why" in cp) return { ok: false, file: null, untranslated: [], why: cp.why, absent: cp.absent };
  /** @type {Untranslated[]} */
  const untranslated = [];
  const r = buildReporters(rp, untranslated), c = buildCourts(cp, untranslated);
  const sources = [sourceEntry(rp, r.counts, FLAGS.reporters), sourceEntry(cp, c.counts, FLAGS.courts)];
  const text = render(sources, r.reporters, c.courts);
  if (write) writeFileSync(out, text);
  return { ok: true, file: write ? out : null, untranslated, text };
}

/**
 * The build, or the message of the error it raised.
 * @param {BuildOptions} options
 * @returns {Built | {failed: string}}
 */
function tryBuild(options) {
  try { return buildCourtCitations(options); } catch (e) { return { failed: e instanceof Error ? e.message : String(e) }; }
}

/* R6: rebuild without writing; fresh only when byte-identical to the committed file. */
/**
 * @param {{reportersDir?: string | undefined, courtsDir?: string | undefined, file?: string}} [options]
 * @returns {Freshness}
 */
export function verifyFresh({ reportersDir, courtsDir, file = DATA_FILE } = {}) {
  const b = tryBuild({ reportersDir, courtsDir, write: false });
  if ("failed" in b) return { fresh: false, why: `the build failed: ${b.failed}` };
  if (!b.ok) return b.absent ? { fresh: null, why: `could not check: ${b.why}` } : { fresh: false, why: b.why };
  if (!existsSync(file)) return { fresh: false, why: `${file} is not there` };
  const committed = readFileSync(file);
  return Buffer.from(b.text, "utf8").equals(committed) ? { fresh: true, why: "byte-identical to a rebuild from the pinned packages" }
    : { fresh: false, why: `${file} differs from a rebuild from the pinned packages; regenerate with \`node court-citations/build.mjs\`` };
}

/* The command: `node court-citations/build.mjs` writes the file; with `--check`, it answers verifyFresh (R6). */
function main() {
  if (process.argv.includes("--check")) { const v = verifyFresh(); console.log(JSON.stringify(v)); process.exit(v.fresh ? 0 : 1); }
  const b = buildCourtCitations();
  if (!b.ok) { console.error(b.why); process.exit(1); }
  for (const u of b.untranslated) console.log(`untranslated: ${u.package} ${u.key}: ${u.why}`);
  console.log(`wrote ${b.file}; ${b.untranslated.length} untranslated`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
