/* calc-grammar at its interface: the figure parser (R1–R3), over its whole grammar, the parser it replaces, and
 * M-M1's 200 printed figures (`build/plan/measures-T33/money-people.md` §4). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFigure, multiply } from "../../../src/calc-grammar/index.mjs";

const signed = (f) => (f.sign === "-" ? `-${f.value}` : f.value);
/* An exact decimal string normalised (no leading zeros, no trailing fraction zeros), for comparing values. */
const norm = (s) => {
  const neg = s.startsWith("-"); let [i, f = ""] = (neg ? s.slice(1) : s).split(".");
  i = i.replace(/^0+(?=\d)/, "") || "0"; f = f.replace(/0+$/, "");
  const body = f ? `${i}.${f}` : i;
  return neg && body !== "0" ? `-${body}` : body;
};
/* The oracle: digits shifted by a power of ten, by string arithmetic independent of the module. */
const shift = (digits, exp) => {
  const plain = digits.replace(/,/g, ""); const [i, f = ""] = plain.split(".");
  const all = (i || "0") + f + "0".repeat(Math.max(0, exp - f.length));
  const point = (i || "0").length + exp;
  return norm(`${all.slice(0, point)}.${all.slice(point)}`);
};

const SCALES = { "": 0, thousand: 3, thousands: 3, k: 3, K: 3, million: 6, Million: 6, M: 6, m: 6, mm: 6, mn: 6,
  billion: 9, bn: 9, b: 9, B: 9, trillion: 12, tn: 12 };
const DIGITS = ["0", "7", "12.5", "1,234", "1,234,567.891", ".5", "4.2", "1000000", "0.004"];
const CURRENCY = [["", undefined, ""], ["$", "USD", "before"], ["€", "EUR", "before"], ["£", "GBP", "after"],
  ["¥", "JPY", "after"], ["USD ", "USD", "before"], [" EUR", "EUR", "after"]];

test("R1 reads every form of its grammar exactly: separators, decimal point, currency sign or code before or after, minus or parentheses, %, and each scale word", () => {
  let n = 0;
  for (const d of DIGITS) for (const [word, exp] of Object.entries(SCALES)) for (const [cur, code, where] of CURRENCY)
    for (const neg of ["", "-", "()"]) for (const pct of ["", "%"]) {
      if (pct && cur) continue;
      const body = `${d}${word ? ` ${word}` : ""}${pct}`;
      const withCur = where === "after" ? `${body}${cur}` : `${cur}${body}`;
      const text = neg === "()" ? `(${withCur})` : `${neg}${withCur}`;
      const f = parseFigure(text);
      assert.ok(!f.refused, `${text}: ${f.why}`);
      const v = shift(d, exp);
      assert.equal(norm(signed(f)), neg && v !== "0" ? `-${v}` : v, text);
      assert.equal(f.sign, neg && v !== "0" ? "-" : "+", text);
      assert.equal(f.currency, code, text);
      assert.equal(f.unit, pct ? "percent" : undefined, text);
      assert.equal(f.as_read, text);
      assert.match(f.value, /^\d+(\.\d+)?$/, `${text}: no sign, no exponent`);
      n++;
    }
  assert.ok(n > 3000);
  assert.deepEqual(parseFigure("$4.2 million"), { value: "4200000", sign: "+", precision: "rounded", currency: "USD", as_read: "$4.2 million" });
});

test("R1 refuses two signs, an unclosed parenthesis and an unknown scale word, each with why; and what is not a figure", () => {
  for (const t of ["(-5)", "-(5)", "($-5)", "--5", "-$-5", "- -5"]) {
    const r = parseFigure(t);
    assert.equal(r.refused, "FIGURE_INVALID", t); assert.match(r.why, /two signs|not a figure/, t);
  }
  for (const t of ["(5", "5)", "$(5", "(1,234 million"]) assert.match(parseFigure(t).why, /parenthesis/, t);
  for (const t of ["5 zillion", "5 lakh", "3 dozen"]) assert.match(parseFigure(t).why, /not a scale word/, t);
  for (const t of ["", "  ", "abc", "1,23", "12,3456", "1.2.3", "1e6", "$", "5 $ €", "$5 USD", "5% USD", "Infinity", "NaN"]) {
    const r = parseFigure(t);
    assert.equal(r.refused, "FIGURE_INVALID", t); assert.ok(r.why.length > 0, t);
  }
  assert.throws(() => parseFigure(5), TypeError);
  assert.throws(() => parseFigure(null), TypeError);
});

test("R2 precision: approximate when qualified, range for two figures joined by a dash or 'to', rounded when a scale word outruns the printed places, exact otherwise; as_read is the input as given", () => {
  for (const q of ["about ", "About ", "approximately ", "nearly ", "over ", "~", "~ "]) {
    const f = parseFigure(`${q}$1,200`);
    assert.equal(f.precision, "approximate", q); assert.equal(f.value, "1200"); assert.equal(f.as_read, `${q}$1,200`);
  }
  const cases = [
    ["$4-5 million", { low: "4000000", high: "5000000", currency: "USD" }],
    ["4 to 5%", { low: "4", high: "5", unit: "percent" }],
    ["$1,000 – $2,500", { low: "1000", high: "2500", currency: "USD" }],
    ["-5 to -3", { low: "-5", high: "-3", sign: "-" }],
    ["1.5 million to 2 billion", { low: "1500000", high: "2000000000" }],
  ];
  for (const [t, want] of cases) {
    const f = parseFigure(t);
    assert.equal(f.precision, "range", t);
    for (const [k, v] of Object.entries(want)) assert.equal(f[k], v, `${t} ${k}`);
    assert.equal(f.value, undefined, t); assert.equal(f.as_read, t);
  }
  assert.equal(parseFigure("about 4 to 5 million").approximate, true);
  assert.equal(parseFigure("5 to 4").refused, "FIGURE_INVALID");
  assert.equal(parseFigure("$4 to €5").refused, "FIGURE_INVALID");
  for (const [t, p] of [["4.2 million", "rounded"], ["4 thousand", "rounded"], ["1.23456 million", "rounded"],
    ["1.234567 million", "exact"], ["1.2345678 million", "exact"], ["1,234.567 thousand", "exact"], ["12.50", "exact"],
    ["$0", "exact"], ["(3,400)", "exact"], ["98.33 %", "exact"]]) assert.equal(parseFigure(t).precision, p, t);
  assert.equal(parseFigure("1.2345678 million").value, "1234567.8");
  assert.equal(parseFigure("  $ 1,405,595 ").as_read, "  $ 1,405,595 ");
});

/* consequences' parser as it stood when this module took it over (`consequences/figures.mjs`, T33), frozen here as
   the reference R3 is measured against. */
const LEGACY_SCALES = { thousand: 3, k: 3, million: 6, m: 6, mm: 6, mn: 6, billion: 9, bn: 9, b: 9, trillion: 12, tn: 12 };
const LEGACY = /^(-|\()?\s*([$€£¥])?\s*(-)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*([a-z]+)?\s*(\))?$/i;
function legacyParse(figure) {
  const fold = (s) => String(s).replace(/[   \s]+/g, " ").replace(/[−–]/g, "-").trim();
  const m = LEGACY.exec(fold(figure));
  if (!m) return null;
  const [, lead, , minus, digits, word, close] = m;
  if ((lead === "(") !== (close === ")")) return null;
  if (lead === "-" && minus) return null;
  let exp = 0;
  if (word) { if (!(word.toLowerCase() in LEGACY_SCALES)) return null; exp = LEGACY_SCALES[word.toLowerCase()]; }
  const number = Number(`${digits.replace(/,/g, "")}e${exp}`) * (lead || minus ? -1 : 1);
  return { number: Object.is(number, -0) ? 0 : number, twoSigns: lead === "(" && Boolean(minus) };
}

test("R3 accepts every figure consequences' parser accepts, with the same value (its whole grammar enumerated)", () => {
  const words = ["", ...Object.keys(LEGACY_SCALES), ...Object.keys(LEGACY_SCALES).map((w) => w.toUpperCase()), "Million"];
  let n = 0; let twoSigns = 0;
  for (const lead of ["", "-", "("]) for (const cur of ["", "$", "€", "£", "¥"]) for (const minus of ["", "-"])
    for (const d of DIGITS) for (const word of words) for (const close of ["", ")"]) for (const sp of ["", " "]) {
      const text = `${lead}${sp}${cur}${sp}${minus}${d}${word ? sp || " " : ""}${word}${close}`;
      const old = legacyParse(text);
      if (!old) continue;
      if (old.twoSigns) { twoSigns++; assert.equal(parseFigure(text).refused, "FIGURE_INVALID", text); continue; }
      const f = parseFigure(text);
      assert.ok(!f.refused, `${text}: ${f.why}`);
      assert.equal(Number(signed(f)), old.number, text);
      n++;
    }
  assert.ok(n > 3000 && twoSigns > 0);
  // The one difference, by R1: "(-5)" carries two signs, which consequences read as one.
  assert.equal(legacyParse("(-5)").number, -5);
  assert.equal(parseFigure("(-5)").refused, "FIGURE_INVALID");
});

const CSV = readFileSync(new URL("./fixtures/m-m1-figures.csv", import.meta.url), "utf8").trim().split("\n").slice(1);
const cells = (line) => { const out = []; let cur = ""; let q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out; };
/* F194, F196, F198 and F200 are parenthesised shares on chart labels: the source's context makes them positive, which
   a reader of the page knows and the parser, by R1's accounting parentheses, does not. */
const SHARES = new Set(["F194", "F196", "F198", "F200"]);

test("R1 R2 on M-M1's 200 printed ACFR and budget figures: each read exactly, scaled exactly by the table's 'in thousands'", () => {
  assert.equal(CSV.length, 200);
  const thousand = { value: "1000", sign: "+", precision: "exact" };
  for (const line of CSV) {
    const [id, , , , , as_read, scale, expected, unit, sign] = cells(line);
    const f = parseFigure(as_read);
    assert.ok(!f.refused, `${id} ${as_read}: ${f.why}`);
    assert.equal(f.as_read, as_read, id);
    assert.equal(f.precision, "exact", id);
    assert.equal(f.unit, unit === "percent" ? "percent" : undefined, id);
    if (as_read.includes("$")) assert.equal(f.currency, "USD", id);
    const v = scale === "in thousands" ? multiply(f, thousand) : f;
    if (SHARES.has(id)) { assert.equal(f.sign, "-", id); assert.equal(norm(v.value), norm(expected), id); continue; }
    assert.equal(norm(signed(v)), norm(expected), id);
    assert.equal(v.sign, expected === "0" ? "+" : sign, id);
  }
});
