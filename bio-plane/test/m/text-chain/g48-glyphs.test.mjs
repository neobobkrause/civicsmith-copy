/* text-chain G48: `glyphCount` counts without a per-character regexp and gives, to the letter, the answer R73 states
 * (build/requirements/text-chain.md R73). The control spells the rule independently, by the definition of the loop it
 * replaced; it is written here, not imported. No timing is asserted. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { glyphCount } from "../../../src/textchain.mjs";

/** @param {unknown} s @returns {number} */
const spelled = (s) => {
  if (typeof s !== "string") return 0;
  let n = 0;
  /* R73: NUL and U+FFFD are a decode's failures, not glyphs. */
  for (const ch of s) if (!/\s/u.test(ch) && ch !== "\u0000" && ch !== "\ufffd") n++;
  return n;
};

/** @param {number} len @returns {string} */
const mixed = (len) => {
  const parts = ["a", "Z", "é", "ñ", "漢", "字", " ", "\t", " ", "\u{1F600}", "\u{10348}", "7", "\n", " "];
  let s = "";
  for (let i = 0; s.length < len; i++) s += parts[(i * 7 + (i >> 2)) % parts.length];
  return s.slice(0, len);
};

test("R73 G48 (a): counting glyphs makes no regexp test or exec call", (t) => {
  const text = mixed(10000);
  /* node:test's method mocks wrap the real test and exec and count their calls; the count is read before the control
     runs, and the test context puts both back when the test ends. */
  const test0 = t.mock.method(RegExp.prototype, "test"), exec0 = t.mock.method(RegExp.prototype, "exec");
  const got = glyphCount(text);
  const calls = test0.mock.callCount() + exec0.mock.callCount();
  assert.equal(calls, 0);
  assert.equal(got, spelled(text));
  assert.ok(got > 0);
});

test("R73 G48 (b): every UTF-16 code unit alone, between letters and doubled counts as the old definition", () => {
  for (let c = 0; c <= 0xffff; c++) {
    const u = String.fromCharCode(c);
    for (const s of [u, "a" + u + "b", u + u]) assert.equal(glyphCount(s), spelled(s), `U+${c.toString(16)} in ${JSON.stringify(s)}`);
  }
});

test("R73 G48 (b): surrogate arrangements count as the old definition", () => {
  const cases = [
    "\u{1F600}", "\ud83d", "\ude00", "a\ud83d", "\ud83da", "\ud83d😀", "\ud83d \ude00", "\ud83d😀", "\ude00\ud83d",
    "\ude00😀", "😀😀", "\ud83d\ud83d", "\ude00\ude00", "x\ude00\ud83dy", "",
  ];
  for (const s of cases) assert.equal(glyphCount(s), spelled(s), JSON.stringify(s));
  assert.equal(glyphCount("\u{1F600}"), 1);
  assert.equal(glyphCount("\ud83d"), 1);
  assert.equal(glyphCount("\ud83d \ude00"), 2);
});

test("R73 G48 (b): astral code points at a stride and the first and last count once", () => {
  const points = [0x10000, 0x10ffff];
  for (let p = 0x10000; p <= 0x10ffff; p += 257) points.push(p);
  for (const p of points) {
    const ch = String.fromCodePoint(p);
    for (const s of [ch, " " + ch + " ", ch + ch, "a" + ch]) assert.equal(glyphCount(s), spelled(s), `U+${p.toString(16)}`);
    assert.equal(glyphCount(ch), 1);
  }
});

test("R73 G48 (b): whitespace is exactly what the Unicode-aware \\s matches and controls count", () => {
  const space = [0x9, 0xa, 0xb, 0xc, 0xd, 0x20, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff];
  for (let c = 0x2000; c <= 0x200a; c++) space.push(c);
  for (const c of space) assert.equal(glyphCount(String.fromCharCode(c)), 0, `U+${c.toString(16)}`);
  for (const c of [0x0, 0x1, 0x8, 0xe, 0x1f, 0x7f, 0x200b, 0x180e]) assert.equal(glyphCount(String.fromCharCode(c)), spelled(String.fromCharCode(c)));
  for (const c of [0x8, 0xe, 0x1f, 0x7f]) assert.equal(glyphCount(String.fromCharCode(c)), 1);
  for (const c of [0x0, 0xfffd]) assert.equal(glyphCount(String.fromCharCode(c)), 0, `U+${c.toString(16)} is no glyph`);
});

test("R73 G48 (b): a 1 MiB CSV-shaped text with accented and astral cells counts as the old definition", () => {
  const cells = ["12,345.67", "Café Müller", "Ōakland", "\u{1F600} ok", "\u{1D11E} score", "  padded  ", "x\ty", "", " nb"];
  let s = "";
  for (let i = 0; s.length < 1 << 20; i++) s += cells[i % cells.length] + (i % 5 === 4 ? "\r\n" : ",");
  assert.equal(glyphCount(s), spelled(s));
});

test("R73 G48 (b): a non-string counts as zero", () => {
  for (const v of [0, 5, NaN, null, undefined, {}, [], ["a"], true, 12n, Symbol.iterator]) assert.doesNotThrow(() => assert.equal(glyphCount(v), 0));
});
