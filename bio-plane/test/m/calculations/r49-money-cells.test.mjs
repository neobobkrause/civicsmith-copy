/* calculations, fix round 9 (T51): R49 (G182; S-30) money is read as the cell says, never guessed. Each case goes through `ingestMoney` and
   reads the fact money was asked to record, or the reason the row was not written. Reproduced on the tip first: `12%` was written as an
   amount of 12, a currency column won over a mark in the cell, `1.234,56`, `1 234,56`, `—` and `FY2025` were refused as not figures. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V } from "./fixture.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const AMOUNT = (extra = {}) => ({ name: "amount", type: "string", ...extra });
const fields = (extra) => [{ name: "payer", type: "string" }, { name: "payee", type: "string" }, AMOUNT(extra)];
const roles = { payer: { role: "payer", scheme: "ellery_person" }, payee: { role: "payee", scheme: "ellery_person" }, amount: { role: "amount" } };
const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const BIND = { kind: { value: "payment" }, phase: { value: "actual" }, stage: { value: "paid" }, basis: { value: "cash" }, currency: { value: "USD" },
  period: { value: "2025-07-01/2026-06-30" } };

/* the cells run through ingestMoney as rows of one table; answers `{facts, notWritten}` by the cell's position */
async function ingest(w, cells, { amountField = {}, bind = {} } = {}) {
  w.person("Pat", "P001");
  w.person("Lee", "P002");
  const text = `payer,payee,amount\n${cells.map((c) => `P001,P002,${quote(c)}`).join("\n")}\n`;
  const t = await w.table(text, fields(amountField), { roles });
  const b = w.c.adoptBinding({ table: t.sha, roles: { amount: "amount", payer: "payer", payee: "payee", ...BIND, ...bind }, by: V("bob") });
  assert.equal(b.ok, true, JSON.stringify(b));
  w.money.calls.length = 0;
  const r = await w.c.ingestMoney({ binding: b.binding, rows: cells.map((_, i) => i), by: V("bob") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return { facts: w.money.calls, written: r.written, notWritten: Object.fromEntries(r.not_written.map((n) => [n.row, n])) };
}

test("R49 (G182) 12% is a percentage, never an amount of 12; a dash states none; a fiscal-year label names a year; each is listed not written with its own reason", async () => {
  const w = seeded();
  const r = await ingest(w, ["12%", "0.5 %", "—", "-", "FY2025", "FY 2025-26", "30"]);
  assert.deepEqual(Object.entries(r.notWritten).map(([i, n]) => [Number(i), n.reason]), [[0, "AMOUNT_IS_A_PERCENTAGE"], [1, "AMOUNT_IS_A_PERCENTAGE"], [2, "AMOUNT_NONE_STATED"],
    [3, "AMOUNT_NONE_STATED"], [4, "AMOUNT_IS_A_YEAR_LABEL"], [5, "AMOUNT_IS_A_YEAR_LABEL"]]);
  assert.deepEqual(r.facts.map((f) => f.amount), ["30"], "control: a plain figure is written, and no fact is written for the others");
});

test("R49 (G182) a currency mark in the cell wins over its column's; a cell with no mark takes the column's", async () => {
  const w = seeded();
  const r = await ingest(w, ["€5", "GBP 7", "9"]);
  assert.deepEqual(r.facts.map((f) => f.currency), ["EUR", "GBP", "USD"]);
});

test("R49 (G182) separators follow the source's stated locale (the amount column's), else the team's; the stated one wins", async () => {
  const w = seeded();   /* the test profile's locale is en-GB */
  const team = await ingest(w, ["1,234", "1.234", "1,234.56"]);
  assert.deepEqual(team.facts.map((f) => f.amount), ["1234", "1.234", "1234.56"], "the team's locale: comma groups, point decimal");
  assert.deepEqual(Object.keys(team.notWritten), []);
  const w2 = seeded();
  const de = await ingest(w2, ["1,234", "1.234", "1.234,56"], { amountField: { locale: "de-DE" } });
  assert.deepEqual(de.facts.map((f) => f.amount), ["1.234", "1234", "1234.56"], "the source's stated locale wins over the team's");
  const strict = await ingest(seeded(), ["1.234,56"], { amountField: { locale: "en-GB" } });
  assert.equal(strict.notWritten[0].reason, "AMOUNT_NOT_READ", "a figure the stated locale does not read is not read, never re-guessed");
});

test("R49 (G182) with no locale stated by the source or the team, 1.234,56 and 1 234,56 and 1,5 are read by their shape, and 1,234 and 1.234 (which the two conventions read differently) are stated undetermined, never guessed", async () => {
  const w = seeded({ construct: false });
  /* the test profile, as the team states it but for its locale */
  w.c = w.build({ combine: (ids) => { const c = combine(ids); if (c.ok) { const { locale: _l, ...view } = c.view; return { ...c, view }; } return c; } });
  const r = await ingest(w, ["1.234,56", "1 234,56", "1 234,56", "1,5", "1,234", "1.234", "1,234.56", "1.234.567"]);
  assert.deepEqual(r.facts.map((f) => f.amount), ["1234.56", "1234.56", "1234.56", "1.5", "1234.56", "1234567"]);
  assert.deepEqual(Object.entries(r.notWritten).map(([i, n]) => [Number(i), n.reason]), [[4, "AMOUNT_LOCALE_UNDETERMINED"], [5, "AMOUNT_LOCALE_UNDETERMINED"]]);
  assert.deepEqual(r.notWritten[4].readings, undefined, "the reasons are the rows' own; the readings are in the detail");
});

test("R49 (G182) a fiscal-year label as a period value names the year: FY 2025-26 reaches money as the fiscal key FY2025-26", async () => {
  const w = seeded();
  const r = await ingest(w, ["30"], { bind: { period: { value: "FY 2025-26" } } });
  assert.equal(r.written.length, 1, JSON.stringify(r.notWritten));
  assert.deepEqual(r.facts[0].period, { fiscal: "FY2025-26" });
});

test("R49 (G182) an XLSX date serial is a date: a date-formatted cell the reader delivers (type date, the ISO value, the serial beside) is determined in a date column; a bare number in a date column stays undetermined, not read as a serial", async () => {
  const w = seeded();
  const F = [{ name: "when", type: "date" }, { name: "amount", type: "string" }];
  const c = (a, v, extra = {}) => ({ source: { kind: "sheet-cell", cell: a }, value: v, type: "s", ...extra });
  const cells = [c("A1", "when"), c("B1", "amount"), c("A2", "2024-01-15", { type: "date", serial: "45306" }), c("B2", "5"), c("A3", "45306", { type: "number" }), c("B3", "6")];
  const t = await w.c.declareTable({ source: w.sheet(cells, "A1:B3"), schema: { fields: F }, header: ["when", "amount"], by: V("bob") });
  assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
  assert.deepEqual(t.undetermined.cells.map((x) => [x.row, x.column]), [[1, "when"]], "only the bare number is undetermined");
});
