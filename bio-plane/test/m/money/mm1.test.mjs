/* M-M1 (plan T33, Measurements: "M-M1 on the 200 figures (T33-33)"): the 200 figures of
   `build/plan/measures-T33/money-people.md` §4 (two annual financial reports and one budget book, each `as_read` checked
   on its page there), held as `mm1-figures.csv` beside this file. Each figure is read by calc-grammar's parser and
   scaled exactly; each money figure is then recorded as a money fact and read back with its amount exact and its
   `as_read` unchanged (R1, R3). The figures are a measurement's source data, not the module's text (R22). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFigure, multiply } from "../../../src/calc-grammar/index.mjs";
import { seeded, ANN } from "./fixture.mjs";

function parseCsv(text) {
  const rows = [];
  for (const line of text.split("\n").filter((l) => l.trim())) {
    const out = []; let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const FIGURES = parseCsv(readFileSync(new URL("./mm1-figures.csv", import.meta.url), "utf8"));
/* The fixture's own note: a parenthesised percentage after a dollar figure on a chart label is a share, not a negative. */
const SHARE = new Set(["F194", "F196", "F198", "F200"]);
const signed = (f) => (f.sign === "-" ? `-${f.value}` : f.value);

test("M-M1 R1 the 200 figures: each read exactly by calc-grammar's parser and scaled exactly, sign as the fixture states", () => {
  assert.equal(FIGURES.length, 200);
  const misses = [];
  for (const row of FIGURES) {
    let f = parseFigure(row.as_read.replace(/\s+/g, " ").trim());
    if (f.refused) { misses.push(`${row.id}: ${f.why}`); continue; }
    if (row.scale === "in thousands") f = multiply(f, { value: "1000", sign: "+", precision: "exact" });
    if (SHARE.has(row.id)) f = { ...f, sign: "+" };
    const got = signed(f).replace(/^-?0+(?=\d)/, (m) => (m.startsWith("-") ? "-" : ""));
    const norm = (x) => { const [i, d = ""] = x.replace(/^-/, "").split("."); const t = d.replace(/0+$/, ""); return (x.startsWith("-") && /[1-9]/.test(x) ? "-" : "") + String(BigInt(i)) + (t ? `.${t}` : ""); };
    if (norm(got) !== norm(row.expected)) misses.push(`${row.id}: read ${got}, expected ${row.expected}`);
  }
  assert.deepEqual(misses, []);
});

test("M-M1 R1 R3 each of the 178 money figures recorded as a money fact keeps its exact amount, its sign and its as_read unchanged", () => {
  const s = seeded();
  const usd = FIGURES.filter((r) => r.unit === "USD");
  assert.equal(usd.length, 178);
  for (const row of usd) {
    const magnitude = row.expected.replace(/^-/, "");
    const r = s.m.recordFact(s.fact({ amount: magnitude, as_read: row.as_read, sign: row.sign, kind: "other", stage: "paid",
      precision: "exact" }));
    assert.equal(r.ok, true, `${row.id}: ${r.reason}`);
    const f = s.m.readFact({ factId: r.fact_id, viewer: ANN }).fact;
    assert.deepEqual([f.amount, f.sign, f.as_read], [magnitude, row.sign, row.as_read], row.id);
    const stored = s.one(`SELECT amount FROM money_facts WHERE fact_id=?`, r.fact_id).amount;
    assert.equal(stored, row.sign === "-" && magnitude !== "0" ? `-${magnitude}` : magnitude, row.id);
  }
});
