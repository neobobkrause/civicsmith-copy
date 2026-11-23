/* bundler's pure-ASCII recipe over fixture members only: proves R2 (a fleet member's or a plane-shaped descriptor's bundle
 * holds no byte over 0x7F with every value and regex unchanged; what the pass cannot escape refuses [NON_ASCII_REMAINS]
 * naming the line; a descriptor that is neither keeps its form; bundle.ascii overrides; asciiOptions/asciiOutput), R4
 * (the manifest's recipe.ascii) and R6 (a committed recipe.ascii that differs from the tree's is stale). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ASCII_RECIPE, asciiOptions, asciiOutput, asciiOf, optionsFor, buildMember, manifestFrom, writeMember, verifyStatic,
} from "../../../../scripts/fleet-bundle.mjs";
import { scratch, makeMember, nonAscii, threw, withBundle, same } from "./fixture.mjs";

/** Non-ASCII in every place a bundle can hold it: a licence banner, comments, a string, an untagged, a tagged and a
 *  `String.raw` template, and regexes (BMP and astral, with and without `u`). */
const SOURCE = [
  "/*! Licence © fixture — kept */",
  "// a line comment with an em dash — and a box rule ──",
  "/* a block comment § */",
  "export const STR = 'dash — section § astral \u{1F600}';",
  "export const TPL = `cooked — ${STR.length} é`;",
  "export const RAW = String.raw`raw \\n — ${STR.length}`;",
  "const tag = (s, ...v) => s.raw.join('|') + s.join('|') + v.join(',');",
  "export const TAGGED = tag`a—${1}bé`;",
  "export const RE_BMP = /[−–—]+/g;",
  "export const RE_CLASS = /(?:[$€£¥])\\s?\\d+/i;",
  "export const RE_U = /\\p{L}+’s/u;",
  "export const RE_ASTRAL_U = /^\u{1F600}+$/u;",
  "export const RE_ASTRAL = /\u{1F600}/;",
  "export default { fetch() { return new Response('ok'); } };",
  "",
].join("\n");

const s = scratch("ascii");
let member, on, off;   /* the fixture member, its ASCII build and its opt-out build, shared */
before(async () => {
  member = makeMember(s.root, "probe", { vendored: false, src: SOURCE });
  on = await buildMember(member);
  off = await buildMember(withBundle(member, { ascii: false }));
});
after(() => s.done());

let loaded = 0;
const load = async (bytes) => {
  const p = join(s.root, `load-${++loaded}.mjs`);
  writeFileSync(p, bytes);
  return import(pathToFileURL(p).href);
};
const unesc = (x) => x.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16)));

/* ------------------------------------------------------------------------- R2 */

test("R2: a fleet member's bundle holds no byte over 0x7F: comments stripped, the licence banner kept as \\uXXXX text, templates lowered", () => {
  assert.equal(nonAscii(on.bytes), -1, `a byte over 0x7F at ${nonAscii(on.bytes)}`);
  const text = on.bytes.toString("utf8");
  assert.doesNotMatch(text, /line comment|block comment/, "comments are stripped");
  assert.ok(text.includes("Licence \\u00a9 fixture \\u2014 kept"), "the banner is kept, its characters written as \\uXXXX text");
  assert.ok(!text.includes("`"), "no template literal is left");
  assert.notEqual(nonAscii(off.bytes), -1, "control: the opt-out build keeps the non-ASCII");
});

test("R2: the ASCII bundle's values equal the opt-out build's: strings, untagged, tagged and String.raw templates; every regex keeps its pattern and flags", async () => {
  const a = await load(on.bytes), b = await load(off.bytes);
  for (const k of ["STR", "TPL", "RAW", "TAGGED"]) assert.equal(a[k], b[k], k);
  assert.equal(a.STR, "dash — section § astral \u{1F600}", "and the source's value");
  for (const k of ["RE_BMP", "RE_CLASS", "RE_U", "RE_ASTRAL_U", "RE_ASTRAL"]) {
    assert.equal(a[k].flags, b[k].flags, `${k} flags`);
    assert.equal(unesc(a[k].source), unesc(b[k].source), `${k} pattern once its escapes are read`);
  }
  assert.match(on.bytes.toString("utf8"), /\\u\{1f600\}/, "an astral character in a u regex is written \\u{X}");
  for (const [k, yes, no] of [["RE_BMP", "a—b", "a-b"], ["RE_CLASS", "€ 5", "x 5"], ["RE_U", "Paul’s", "Paul's"],
    ["RE_ASTRAL_U", "\u{1F600}\u{1F600}", "\u{1F600}\ud83d"], ["RE_ASTRAL", "x\u{1F600}", "x\ud83d"]]) {
    assert.equal(a[k].test(yes), true, `${k} matches ${JSON.stringify(yes)}`);
    assert.equal(a[k].test(no), b[k].test(no), `${k} on ${JSON.stringify(no)}`);
  }
});

test("R2: asciiOptions() are the recipe's esbuild options and asciiOutput(bytes) the pass: it escapes string and regex characters, changes no value, and returns ASCII bytes unchanged", async () => {
  assert.deepEqual(asciiOptions(), { charset: "ascii", legalComments: "eof", minifyWhitespace: true, supported: { "template-literal": false } });
  assert.deepEqual(ASCII_RECIPE, { charset: "ascii", legalComments: "eof", minifyWhitespace: true, templateLiterals: "lowered" });
  assert.deepEqual(Object.fromEntries(Object.keys(asciiOptions()).map((k) => [k, optionsFor(member)[k]])), asciiOptions(),
    "a fleet member's build carries them");
  const plain = Buffer.from("export const x = 1; // only ASCII\n");
  assert.ok(same(asciiOutput(plain), plain), "pure ASCII passes through unchanged");
  const src = "export const x = \"a—b\"; export const r = /[—\u{1F600}]/u; export const q = /\u{1F600}/; const d = 4 / 2 / 1; /* § */\n";
  const out = asciiOutput(Buffer.from(src));
  assert.equal(out.toString("latin1"),
    "export const x = \"a\\u2014b\"; export const r = /[\\u2014\\u{1f600}]/u; export const q = /\\ud83d\\ude00/; const d = 4 / 2 / 1; /* \\u00a7 */\n");
  assert.equal(nonAscii(out), -1);
  const [a, b] = [await load(out), await load(Buffer.from(src))];
  assert.equal(a.x, b.x);
  for (const k of ["r", "q"]) {
    assert.equal(a[k].flags, b[k].flags);
    assert.equal(a[k].test("\u{1F600}"), b[k].test("\u{1F600}"), k);
  }
});

test("R2: a non-ASCII character the pass cannot escape without changing the program refuses REFUSED [NON_ASCII_REMAINS], naming the line, and is never edited", () => {
  const cases = [
    ["an unlowered template's raw text", "const a = 1;\nconst b = 2;\nexport const x = `raw — ${a}`;\n", 3, /the raw text of a template literal/],
    ["an identifier", "export const ok = 1;\nexport const café = 1;\n", 2, /a name token/],
    ["a template with no substitution", "\n\n\n\nexport const t = `é`;\n", 5, /template literal/],
  ];
  for (const [label, src, line, what] of cases) {
    const e = threw(() => asciiOutput(Buffer.from(src)));
    assert.ok(e instanceof Error, label);
    assert.match(e.message, /^REFUSED \[NON_ASCII_REMAINS\]: /, label);
    assert.match(e.message, new RegExp(`at line ${line}\\b`), `${label}: names line ${line}: ${e.message}`);
    assert.match(e.message, what, label);
  }
});

test("R2: a descriptor that is neither a fleet member nor the plane keeps its form; a plane-shaped descriptor is made ASCII; a boolean bundle.ascii overrides either way", async () => {
  const { marker: _m, ...alone } = member;                                 /* the standalone case checker's shape */
  const plane = { ...alone, wholeWordTable: true };                       /* the plane's shape: no marker, the whole word table */
  const set = (d, ascii) => (withBundle(d, { ascii }));
  assert.deepEqual([asciiOf(member), asciiOf(alone), asciiOf(plane)], [true, false, true]);
  assert.deepEqual([asciiOf(set(member, false)), asciiOf(set(alone, true)), asciiOf(set(plane, false))], [false, true, false]);
  assert.deepEqual([asciiOf(set(member, "no")), asciiOf(set(alone, 1))], [true, false], "only a boolean overrides");
  for (const k of Object.keys(asciiOptions())) assert.equal(k in optionsFor(alone), false, `the standalone build sets no ${k}`);

  const kept = await buildMember(alone);
  assert.notEqual(nonAscii(kept.bytes), -1, "its non-ASCII is kept");
  assert.ok(kept.bytes.toString("utf8").includes("`"), "its templates stay unlowered");
  assert.ok(kept.bytes.toString("utf8").split("\n").length > 5, "and its whitespace is not minified");
  assert.ok(same((await buildMember(set(alone, true))).bytes, on.bytes), "bundle.ascii: true gives the member's ASCII bytes");
  assert.ok(same((await buildMember(plane)).bytes, on.bytes), "the plane's shape is built ASCII");
  assert.ok(same(kept.bytes, off.bytes), "bundle.ascii: false gives a member the standalone form");
});

/* ------------------------------------------------------------------------- R4 */

test("R4: the manifest's recipe records ascii: R2's options for an ASCII build, false for an opt-out", () => {
  assert.deepEqual(manifestFrom(member, on).recipe.ascii, { ...ASCII_RECIPE });
  const optOut = withBundle(member, { ascii: false });
  assert.equal(manifestFrom(optOut, off).recipe.ascii, false);
});

/* ------------------------------------------------------------------------- R6 */

test("R6: a committed manifest whose recipe.ascii differs from the tree's is stale, naming recipe.ascii", async () => {
  const m = makeMember(s.root, "r6", { vendored: false, src: SOURCE });
  const { manifest } = await writeMember(m);
  assert.deepEqual(verifyStatic(m).findings, []);
  const mf = join(m.abs, m.bundle.manifest);
  const { ascii: _a, ...noAscii } = manifest.recipe;
  for (const [label, recipe] of [["no ascii recorded", noAscii], ["false recorded", { ...manifest.recipe, ascii: false }],
    ["other options", { ...manifest.recipe, ascii: { ...ASCII_RECIPE, minifyWhitespace: false } }]]) {
    writeFileSync(mf, JSON.stringify({ ...manifest, recipe }, null, 2));
    const f = verifyStatic(m).findings;
    assert.equal(f.length, 1, `${label}: ${f}`);
    assert.match(f[0], /^r6: the committed manifest's recipe\.ascii is .*, the tree says /, label);
  }
  writeFileSync(mf, JSON.stringify(manifest, null, 2));
  assert.deepEqual(verifyStatic(withBundle(m, { ascii: true })).findings, []);
  const optOut = verifyStatic(withBundle(m, { ascii: false })).findings;
  assert.ok(optOut.some((x) => /recipe\.ascii is \{.*the tree says false/.test(x)), "a tree that opts out stales an ASCII manifest");
});
