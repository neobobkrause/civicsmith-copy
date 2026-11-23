/* bundler's word-row trim over fixture members only: proves R38 (a fleet member's bundle carries only the word rows its
 * inputs can read; a literal prefix keeps every row under it; an unbounded read keeps the whole table and names each
 * site by file and line; the plane-shaped build is unchanged; the manifest records the rows kept and verifyFresh covers
 * them). Each fixture carries its own small table at `src/setup-words/rows.mjs` and its own `src/setup-words/index.mjs`,
 * the paths the recipe recognises; nothing reads the product's word table. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";
import {
  buildMember, manifestFrom, writeMember, verifyFresh, wordKeysOf, keptWordRows, wordsManifest, optionsFor, asciiOutput,
} from "../../../../scripts/fleet-bundle.mjs";
import { scratch, makeMember, hex, withBundle, same, descriptor, checkedFindings } from "./fixture.mjs";

/* Rows in the product's shape, [key, en, note, means, protected, origin]. */
const ROWS = [
  ["refusal.ALPHA", "a", null, null, false, "design"], ["refusal.BETA", "b", null, null, false, "design"],
  ["plain.one", "o", null, null, false, "design"], ["plain.two", "t", null, null, false, "design"],
  ["plain.three", "h", null, null, false, "code"], ["other.x", "x", null, null, false, "design"],
  ["tpl.a", "p", null, null, false, "design"], ["tpl.b", "q", null, null, false, "design"],
];
const KEYS = ROWS.map((r) => r[0]);
const ROWS_MODULE = `export const WORDS_COMMIT = "fixture-commit";\nexport const WORD_ROWS = Object.freeze(${JSON.stringify(ROWS)});\n`;
const INDEX_MODULE = `import { WORD_ROWS, WORDS_COMMIT } from "./rows.mjs";
export { WORD_ROWS, WORDS_COMMIT };
const by = () => new Map(WORD_ROWS.map((r) => [r[0], r]));
export const hasWord = (key) => by().has(key);
export const word = (key) => by().get(key)[1];
export const localize = (id, en) => (by().get(id) ? by().get(id)[1] : en);
`;

const s = scratch("words");
after(() => s.done());

/** A fixture member `dir` whose `src/index.mjs` imports the three calls and then runs `body` (which defines OUT). */
function wordsMember(dir, body, files = {}) {
  return makeMember(s.root, dir, { vendored: false, files: {
    "src/setup-words/rows.mjs": ROWS_MODULE, "src/setup-words/index.mjs": INDEX_MODULE, ...files },
    src: 'import { word, localize, hasWord } from "./setup-words/index.mjs";\n' + body
      + "\nexport default { fetch() { return new Response(JSON.stringify(OUT)); } };\n" });
}

/** The keys of the rows a built bundle carries, in order, read from its `WORD_ROWS` literal (not from the call sites,
 *  which name keys too). */
function keysIn(bytes) {
  const text = bytes.toString("utf8");
  const at = text.search(/WORD_ROWS\s*=\s*Object\.freeze\(\[/);
  assert.notEqual(at, -1, "the bundle holds a WORD_ROWS table");
  const end = text.indexOf("]])", at);
  return [...text.slice(at, end + 2).matchAll(/\[("(?:[^"\\]|\\.)*"),/g)].map((x) => JSON.parse(x[1]));
}
let loaded = 0;
const run = async (bytes) => {
  const p = join(s.root, `run-${++loaded}.mjs`);
  writeFileSync(p, bytes);
  return JSON.parse(await (await import(pathToFileURL(p).href)).default.fetch().text());
};

test("R38: a member's bundle carries exactly the rows named by literal at word, localize and hasWord calls in any bundled input, in the table's order, and still answers every call", async () => {
  const m = wordsMember("exact",
    'import { more } from "./more.mjs";\n'
    + 'const OUT = [word("plain.two"), localize("plain.one", "fallback"), hasWord("other.x"), localize("not.in.table", "only here"),\n'
    + '  word(`tpl.a`), (FLAG ? word("tpl.b") : word("plain.three")), more()];\nvar FLAG = true;',
    { "src/more.mjs": 'import { word } from "./setup-words/index.mjs";\nexport const more = () => word("refusal.BETA");\n' });
  const built = await buildMember(m);
  const want = ["refusal.BETA", "plain.one", "plain.two", "plain.three", "other.x", "tpl.a", "tpl.b"];
  assert.deepEqual(keysIn(built.bytes), want, "the named rows (a second input's too), no other");
  const out = await run(built.bytes);
  assert.deepEqual(out, ["t", "o", true, "only here", "p", "h", "b"], "the bundle answers as the whole table would");
  const kept = ROWS.filter((r) => want.includes(r[0]));
  assert.deepEqual([built.words.rows, built.words.total, built.words.sha256], [kept.length, ROWS.length, hex(JSON.stringify(kept))]);
  assert.match(String(built.words?.text), /WORDS_COMMIT = "fixture-commit"/, "the table's commit is carried");
  assert.deepEqual(manifestFrom(m, built).words, { rows: kept.length, sha256: hex(JSON.stringify(kept)) }, "the manifest records the count and digest");
  assert.equal(manifestFrom(m, built).wordSites, undefined);
});

test("R38: control: a key built from a literal prefix ('refusal.' + code, a template, either arm of ?: or ||) keeps every row under that prefix", async () => {
  const built = await buildMember(wordsMember("prefix",
    "const code = globalThis.CODE || 'ALPHA';\nconst OUT = [word('refusal.' + code), word(`tpl.${code === 'ALPHA' ? 'a' : 'b'}`), hasWord(code ? 'plain.t' + code : 'other.' + code)];"));
  assert.deepEqual(keysIn(built.bytes), ["refusal.ALPHA", "refusal.BETA", "plain.two", "plain.three", "other.x", "tpl.a", "tpl.b"],
    "every refusal., tpl., plain.t and other. row, and nothing else");
  assert.equal(built.words.rows, 7);
  assert.deepEqual(await run(built.bytes), ["a", "p", false]);
});

test("R38: control: a key with no literal prefix (a wrapper reading a variable) keeps the whole table, lists every such site by file and line in the manifest (words: all), and does not fail the build", async () => {
  const m = wordsMember("bare", "function say(k) {\n  return word(k);\n}\nconst OUT = [say('plain.one'), hasWord(String(1)), word('plain.two')];");
  const built = await buildMember(m);
  assert.deepEqual(keysIn(built.bytes), KEYS, "the whole table is kept");
  assert.deepEqual(built.words, { rows: "all", total: ROWS.length, text: null, sha256: null, sites: ["src/index.mjs:3", "src/index.mjs:5"] });
  const man = manifestFrom(m, built);
  assert.deepEqual([man.words, man.wordSites], ["all", ["src/index.mjs:3", "src/index.mjs:5"]]);
  assert.deepEqual(await run(built.bytes), ["o", false, "t"]);
  const whole = await buildMember({ ...m, wholeWordTable: true });
  assert.ok(same(built.bytes, whole.bytes), "built exactly as a build that keeps the whole table");
  for (const body of ["const k = 'a';\nconst OUT = word(`${k}.x`);", "const OUT = word(String(1));", "const OUT = hasWord();",
    "const OUT = word(...['plain.one']);", "const k = 'x';\nconst OUT = localize(k ? 'plain.one' : k, '');"]) {
    const w = (await buildMember(wordsMember("bare2", body))).words;
    assert.equal(w.rows, "all", body);
    assert.match(w.sites[0], /^src\/index\.mjs:\d+$/, body);
  }
});

test("R38: control: a read of the table other than through a call (word as a value, WORD_ROWS imported, a dynamic import) keeps the whole table naming the site; a function the file declares under that name is not the call", async () => {
  const sites = async (dir, body) => descriptor((await buildMember(wordsMember(dir, body))).words).sites;
  assert.deepEqual(await sites("v", "const OUT = ['plain.one'].map(word);"), ["src/index.mjs:2"]);
  assert.deepEqual(await sites("t", "import { WORD_ROWS } from './setup-words/index.mjs';\nconst OUT = WORD_ROWS.length;"), ["src/index.mjs:2"]);
  assert.deepEqual(await sites("d", "const OUT = typeof (() => import('./' + 'setup-words/rows.mjs'));"), ["src/index.mjs:2"]);
  const shadow = await buildMember(wordsMember("s",
    "function pick(word) { return word(other()); }\nconst other = () => 'x';\nconst OUT = [pick(() => 1), word('plain.one')];"));
  assert.deepEqual(keysIn(shadow.bytes), ["plain.one"], "the parameter named word is not the table's call");
  /* At the parser: sites are listed, never thrown, and the keys are still gathered. */
  const got = wordKeysOf("import {word} from 'x';\nword('a.b'); word(v); word('c.' + v);", "f.mjs");
  assert.deepEqual([[...got.exact], [...got.prefixes], got.sites.length], [["a.b"], ["c."], 1]);
  assert.match(got.sites[0], /^f\.mjs:2: the key of word\(…\) has no literal prefix/);
  assert.match(wordKeysOf("import { WORD_ROWS } from './rows.mjs';", "setup-words/index.mjs", { index: true }).sites.join(""), /^$/,
    "setup-words' own index may hold the table");
  assert.match(wordKeysOf("export { WORD_ROWS } from './setup-words/rows.mjs';", "r.mjs").sites[0], /^r\.mjs:1: re-exports the whole word table/);
  assert.throws(() => wordKeysOf("this is not ( javascript", "bad.mjs"), /^Error: bad\.mjs cannot be parsed to find the word rows it reads/);
});

test("R38: the plane's bundle is unchanged: a plane-shaped descriptor (wholeWordTable) and a descriptor that is no fleet member's carry the whole table, record no rows, and equal the plain recipe's build; a member whose inputs do not reach the table records none", async () => {
  const m = wordsMember("plane", "const OUT = [word('plain.one')];");
  const { marker: _m, ...noMarker } = m;
  const plane = { ...noMarker, wholeWordTable: true };
  const built = await buildMember(plane);
  assert.equal(built.words, null);
  assert.equal(manifestFrom(plane, built).words, undefined, "no words field");
  const plain = await esbuild({ ...optionsFor(plane), write: false, logLevel: "silent" });
  assert.ok(same(built.bytes, asciiOutput(Buffer.from(plain.outputFiles[0].contents))), "byte-identical to the recipe alone");
  assert.deepEqual(keysIn(built.bytes), KEYS);
  assert.equal(await keptWordRows(plane, plain), null);
  const adHoc = await buildMember(withBundle(noMarker, { ascii: true }));
  assert.deepEqual([adHoc.words, keysIn(adHoc.bytes)], [null, KEYS], "a descriptor with no marker keeps the whole table");
  assert.ok(same(adHoc.bytes, built.bytes));
  const none = makeMember(s.root, "none", { vendored: false });
  const nb = await buildMember(none);
  assert.deepEqual([nb.words, manifestFrom(none, nb).words, wordsManifest(null)], [null, undefined, {}]);
});

test("R38: verifyFresh covers the rows kept: a manifest recording other rows, another digest, none, or other sites than a fresh build keeps is stale; the one written is fresh", async () => {
  const m = wordsMember("fresh", "const OUT = [word('plain.one'), word('plain.two')];");
  await writeMember(m);
  const committed = readFileSync(join(m.abs, m.bundle.outfile));
  assert.deepEqual((await verifyFresh(m, committed)).findings, []);
  const mf = join(m.abs, m.bundle.manifest);
  const man = JSON.parse(readFileSync(mf, "utf8"));
  assert.equal(man.words.rows, 2);
  for (const bad of [{ ...man.words, rows: 3 }, { ...man.words, sha256: "0".repeat(64) }, undefined, "all"]) {
    writeFileSync(mf, JSON.stringify({ ...man, words: bad }, null, 2));
    const r = await verifyFresh(m, committed);
    assert.equal(r.checked, true);
    assert.equal(r.findings.length, 1, JSON.stringify(bad));
    assert.match(r.findings[0], /^fresh: STALE BUNDLE — the manifest's word rows are .*, a fresh build's are /);
  }
  const whole = wordsMember("fresh-all", "const OUT = [word(String(1))];");
  await writeMember(whole);
  const wholeBytes = readFileSync(join(whole.abs, whole.bundle.outfile));
  assert.deepEqual((await verifyFresh(whole, wholeBytes)).findings, []);
  const wm = join(whole.abs, whole.bundle.manifest);
  const wman = JSON.parse(readFileSync(wm, "utf8"));
  assert.deepEqual([wman.words, wman.wordSites], ["all", ["src/index.mjs:2"]]);
  writeFileSync(wm, JSON.stringify({ ...wman, wordSites: ["src/index.mjs:9"] }, null, 2));
  assert.match(checkedFindings(await verifyFresh(whole, wholeBytes)), /word rows/, "a moved site is stale");
});
