/* case-checker — the build of the standalone program (requirements: `build/requirements/case-checker.md` R13; DEC-112
 * (3): "a standalone open checker let[s] anyone recreate a case without CivicOS").
 *
 * `bundler`'s recipe (`buildMember`, its one expression of the esbuild options: the working directory pinned, symlinks
 * preserved, `node:*` external) bundles `./main.mjs` and the pure check code it imports into one ES module. The program
 * file is that bundle under one first line naming the SHA-256 of everything after it, so the file carries its own
 * fingerprint. The same sources give the same bytes. `./program.mjs` holds the result as data, so the plane serves it
 * (`casechecker`, R15) with no file read: one JSON text `{sha256, body_sha256, text}` returned from inside a function, so
 * evaluating the module (and the plane bundle that imports it) builds no text of the program in the global scope; it is
 * parsed on its first read (`index.mjs`, R25). `node bio-plane/src/case-checker/build-program.mjs` rewrites it, before the
 * bundles that carry it (K1540), and a test fails when it is stale.
 *
 * (T50; R26; T51 R27) The program prints the members' words, and it reads them as the library does: through `setup-words`'
 * `word(key)` and `localize(id, en)`. The bundle carries as data only the word rows the program's own code reads (R26: "carries
 * the keys it uses as data"; ARCH's decision "The case checker's standalone program", 24 Nov 2026), never the whole table, so a
 * word change makes the program stale only when it touches one of them. The list is taken from the program's own code: every
 * row named by a literal key (or under a literal prefix) at a `word`, `localize` or `hasWord` call in the program's bundled
 * inputs, read with `bundler`'s own reader (`wordKeysOf`, its R38), and R26's `refusal.<code>` keys (`STANDARDS_USE_KEYS`),
 * which the entry (`./main.mjs`) prints through the key a departure hands it. A call elsewhere whose key has no literal prefix
 * could read any row, so the build fails and names it rather than leave a row out. The library and the program so answer the
 * same bytes (R16), and nothing is generated beside the program for them. */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { optionsFor, wordKeysOf, DEFAULT_EXTERNAL } from "../../scripts/fleet-bundle.mjs";
import { CASE_FILE_SPEC_VERSIONS } from "./spec.mjs";
import { STANDARDS_USE_KEYS } from "./standards.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANE = resolve(HERE, "..", "..");
const ENTRY = "src/case-checker/main.mjs";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const WORD_ROWS_PATH = /(^|[\\/])setup-words[\\/]rows\.mjs$/;
const WORD_INDEX_PATH = /(^|[\\/])setup-words[\\/]index\.mjs$/;
const WORD_STUB = "export const WORDS_COMMIT = \"\";\nexport const WORD_ROWS = Object.freeze([]);\n";
/** An esbuild plugin that answers the `setup-words/rows.mjs` import with `contents`. */
const wordRowsPlugin = (contents) => ({
  name: "case-checker-word-rows",
  setup(b) { b.onLoad({ filter: WORD_ROWS_PATH }, () => ({ contents, loader: "js" })); },
});
/** One build of the program with `bundler`'s options (`optionsFor`), the word table answered by `rows`; nothing is written. */
const bundle = (member, rows) => build({ ...optionsFor(member), write: false, logLevel: "silent", plugins: [wordRowsPlugin(rows)] });

/** R26: the word rows the program's own code reads, from a build of it with the table stubbed out (`probe`): each row a
 *  literal key (or prefix) at a `word`, `localize` or `hasWord` call of its inputs names, and R26's `refusal.<code>` rows.
 *  Answers `{keys, text}`: the kept keys in the table's order, and the module that stands for the table in the bundle.
 *  @throws {Error} when a call outside the entry has a key with no literal prefix, or the table lacks an R26 key */
export async function programWords(probe) {
  const paths = Object.keys(probe.metafile.inputs).sort();
  const exact = new Set(STANDARDS_USE_KEYS), prefixes = new Set(), sites = [];
  let rowsInput = null;
  for (const p of paths) {
    if (WORD_ROWS_PATH.test(p)) { rowsInput = p; continue; }
    if (p.split("/").includes("node_modules") || !/\.(mjs|js|cjs)$/.test(p)) continue;
    const keys = wordKeysOf(readFileSync(join(PLANE, p), "utf8"), p, { index: WORD_INDEX_PATH.test(p) });
    keys.exact.forEach((k) => exact.add(k));
    keys.prefixes.forEach((k) => prefixes.add(k));
    /* the entry's one read of a key handed to it is R26's `says.key`, whose keys are `STANDARDS_USE_KEYS`, kept above */
    if (p !== ENTRY) sites.push(...keys.sites);
  }
  if (sites.length) throw new Error(`the program's word rows cannot be bounded; give each call a literal key:\n${sites.join("\n")}`);
  const table = rowsInput ? await import(pathToFileURL(join(PLANE, rowsInput)).href) : { WORD_ROWS: [], WORDS_COMMIT: "" };
  const held = new Set(table.WORD_ROWS.map((r) => r[0]));
  const lacking = STANDARDS_USE_KEYS.filter((k) => !held.has(k));
  if (lacking.length) throw new Error(`the word table lacks R26's keys: ${lacking.join(", ")}`);
  const pre = [...prefixes];
  const kept = table.WORD_ROWS.filter((r) => exact.has(r[0]) || pre.some((x) => r[0].startsWith(x)));
  const text = `/* the word rows the case checker's program reads (case-checker R26): ${kept.length} of ${table.WORD_ROWS.length}, in the table's order. */\n`
    + `export const WORDS_COMMIT = ${JSON.stringify(table.WORDS_COMMIT)};\n`
    + `export const WORD_ROWS = Object.freeze([\n${kept.map((r) => `  ${JSON.stringify(r)},`).join("\n")}\n]);\n`;
  return { keys: kept.map((r) => r[0]), total: table.WORD_ROWS.length, text };
}

/** R13: the program file's text and its fingerprints, built in memory; nothing on disk moves. `words` are the keys of the
 *  word rows it carries (R26), `words_total` the table's size. */
export async function buildProgram() {
  const member = { abs: PLANE, bundle: { entry: ENTRY, outfile: "case-checker.mjs", external: [...DEFAULT_EXTERNAL] } };
  const words = await programWords(await bundle(member, WORD_STUB));
  const built = await bundle(member, words.text);
  const body = Buffer.from(built.outputFiles[0].contents).toString("utf8");
  const bodySha = sha(body);
  const text = `// Civicsmith case checker (${CASE_FILE_SPEC_VERSIONS.join(", ")}). SHA-256 of everything after this line: ${bodySha}\n${body}`;
  return { text, sha256: sha(text), body_sha256: bodySha, inputs: Object.keys(built.metafile.inputs).sort(), words: words.keys, words_total: words.total };
}

/** `./program.mjs`' text for a built program (R25): its one export, `programData`, answers the program as one JSON text
 *  `{sha256, body_sha256, text}`; the text is a literal inside the function, so importing the module builds none of it. */
export function programModule(p) {
  const data = JSON.stringify({ sha256: p.sha256, body_sha256: p.body_sha256, text: p.text });
  return "/* GENERATED by ./build-program.mjs (case-checker R13, R25). Do not edit; run `node bio-plane/src/case-checker/build-program.mjs`. */\n"
    + `export function programData() {\n  return ${JSON.stringify(data)};\n}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const p = await buildProgram();
  writeFileSync(join(HERE, "program.mjs"), programModule(p));
  console.log(`program.mjs written: ${p.text.length} bytes, sha256 ${p.sha256}, ${p.inputs.length} inputs`);
}
