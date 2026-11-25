/* calculations: the ops map (R24) and the invariants (R25–R29). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, world, V, MACHINE, R } from "./fixture.mjs";
import { evaluate, resultKey } from "../../../src/calc-grammar/index.mjs";
import { calculationsOps, CALCULATIONS_TABLES } from "../../../src/calculations/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const code = (r) => (r && r.ok === false ? r.reason : "ok");
const PERIOD = { from: "2025-07-01", to: "2026-06-30" };
const F = [{ name: "dept", type: "string" }, { name: "amount", type: "number", currency: "USD" }];
const SUM = R([{ op: "sum", from: "t", field: "amount", as: "total" }], "total");
const url = (params) => new URL(`https://plane.test/?${new URLSearchParams(params)}`);

test("R24 calculationsOps publishes route arms for the ops (tabledeclare, table, calculationcreate, calculationevaluate, calculationaccept, calculation, calculationdraw and the rest), each answering what its service answers, its stamps read from the url, never the body", async () => {
  const w = seeded();
  const source = w.csv("dept,amount\nparks,10\nroads,20\n");
  const ops = (params, body) => calculationsOps(w.c, url(params), body);
  for (const op of ["tabledeclare", "table", "tablesat", "bindingadopt", "moneyingest", "calculationcreate", "calculationevaluate", "calculationaccept",
    "calculation", "calculationdraw", "recordset", "usesfreeze", "applicationrecipes", "patterns", "patterngate", "patternswitch"])
    assert.equal(typeof ops({ viewer: V("bob") }, {})[op], "function", op);
  /* the body cannot name its author: a machine stamp in the url is refused whatever the body says */
  const forged = await ops({ viewer: MACHINE }, { source, schema: { fields: F }, header: ["dept", "amount"], by: V("bob") }).tabledeclare();
  assert.equal(code(forged), "MEMBER_ACT_ONLY");
  const t = await ops({ viewer: V("bob") }, { source, schema: { fields: F }, header: ["dept", "amount"] }).tabledeclare();
  assert.equal(t.ok, true);
  assert.equal(w.rows(`SELECT declared_by FROM calc_tables`)[0].declared_by, V("bob"));
  assert.equal((await ops({ viewer: V("carol"), sha: t.sha }, {}).table()).found, true);
  const body = { question: "Total?", period: PERIOD, kind: "total", inputs: [{ name: "t", table: t.sha }], recipe: SUM, by: V("alice") };
  const e = await ops({ viewer: V("carol") }, body).calculationevaluate();
  const c = await ops({ viewer: V("carol") }, body).calculationcreate();
  assert.deepEqual(e.results, c.results);
  assert.equal(w.rows(`SELECT created_by FROM calculations`)[0].created_by, V("carol"), "the url's stamp, not the body's by");
  assert.equal((await ops({ viewer: V("bob"), id: c.calc_id }, {}).calculation()).results.output.value, "30");
  assert.equal((await ops({ viewer: V("bob"), id: c.calc_id }, {}).calculationaccept()).ok, true);
  const d = await ops({ viewer: V("bob") }, { set: t.sha, n: 1, seed: "s" }).calculationdraw();
  assert.equal(d.ok, true);
  assert.equal((await ops({ viewer: V("bob") }, {}).patterns()).ok, true);
  assert.equal(code(await ops({ viewer: V("bob") }, { pattern: "office_lateness", goldSet: "g", falseAlarmRate: 0 }).patterngate()), "NOT_AN_ADMIN");
});

test("R25 only the evaluator computes: every stored number is calc-grammar's result over held inputs; no number is taken from a caller's field", async () => {
  const w = seeded();
  const t = await w.table("dept,amount\nparks,10\nroads,20\n", F);
  const c = await w.c.create({ question: "Total?", period: PERIOD, kind: "total", inputs: [{ name: "t", table: t.sha }], recipe: SUM, by: V("bob"),
    results: { output: { value: "1000000", sign: "+", precision: "exact" } }, result_key: "f".repeat(64), computed: "999" });
  const held = (await w.c.readTable({ sha: t.sha, viewer: V("bob") })).page.rows;
  const direct = evaluate(SUM, { t: { fields: F, rows: held.map(([dept, amount]) => ({ dept, amount })) } });
  const stored = JSON.parse(w.rows(`SELECT results_json, result_key FROM calculations`)[0].results_json);
  assert.deepEqual(stored.output, direct.result, "calc-grammar's result over the held table");
  assert.equal(w.rows(`SELECT result_key FROM calculations`)[0].result_key, resultKey(SUM, { t: t.sha }));
  assert.equal(c.results.output.value, "30", "the caller's results field is never read");
  const m = w.fact({ amount: "12.50" });
  const mc = await w.c.create({ question: "Total?", period: PERIOD, kind: "total", inputs: [{ name: "t", money: [m] }], recipe: SUM, by: V("bob") });
  assert.equal(mc.results.output.value, "12.50", "a money fact's amount, never another field of it");
});

test("R26 no eval and no user code is run: a recipe outside the closed grammar is refused by calc-grammar", async () => {
  const w = seeded();
  const t = await w.table("dept,amount\nparks,10\n", F);
  let ran = false;
  globalThis.__calcRan = () => { ran = true; };
  const bad = [
    R([{ op: "eval", code: "globalThis.__calcRan()", as: "x" }], "x"),
    R([{ op: "sum", from: "t", field: "amount", as: "total", map: "(x) => globalThis.__calcRan()" }], "total"),
    R([{ op: "sum", from: "t", field: "amount", as: "total", where: () => globalThis.__calcRan() }], "total"),
    { method: "bio-calc/1", inputs: [{ name: "t", kind: "table" }], steps: "t.amount.reduce((a,b)=>a+b)", output: "x" },
    { ...SUM, toJSON: () => globalThis.__calcRan() },
  ];
  for (const recipe of bad) {
    const r = await w.c.create({ question: "Q", period: PERIOD, kind: "total", inputs: [{ name: "t", table: t.sha }], recipe, by: V("bob") });
    assert.equal(code(r), "RECIPE_INVALID");
  }
  assert.equal(ran, false, "nothing in a recipe was run");
  assert.equal(w.count("calculations"), 0);
  delete globalThis.__calcRan;
});

test("R27 no outward text uses breach, violation, diverted, misused, a score's word, or (R37) nonconforming or violated: every answer, refusal and result of a full run is free of them", async () => {
  const w = seeded();
  const out = [];
  const keep = async (p) => { const r = await p; out.push(r); return r; };
  const t = await keep(w.table("vendor,amount,kind\nAcme,100,award\nBeta,x,award\n", [{ name: "vendor", type: "string" }, { name: "amount", type: "number", currency: "USD" }, { name: "kind", type: "string" }]));
  const g = { period: PERIOD, inputs: [{ name: "t", table: t.sha }], by: V("bob") };
  const rank = R([{ op: "group", from: "t", by: ["vendor"], measure: { op: "sum", field: "amount" }, as: "g" }, { op: "sort", from: "g", by: "sum", order: "desc", as: "r" }], "r");
  const terms = { quantity: "dollars awarded", scope: "contracts", period: "FY2025-26" };
  const c = await keep(w.c.create({ ...g, question: "Q", kind: "ranking", terms, recipe: rank }));
  await keep(w.c.create({ ...g, question: "Q", kind: "ranking", terms: { ...terms, quantity: "suspicion score" }, recipe: rank }));
  await keep(w.c.create({ ...g, question: "Q", kind: "ranking", terms: { ...terms, quantity: ["a", "b"] }, recipe: rank }));
  await keep(w.c.create({ ...g, question: "Q", kind: "comparison", inputs: [{ name: "a", value: "5" }, { name: "b", value: "6" }],
    recipe: R([{ op: "compare", a: "a", b: "b", as: "c" }], "c", [{ name: "a", kind: "figure" }, { name: "b", kind: "figure" }]) }));
  const later = w.standard({ from: "2027-01-01", to: null });
  await keep(w.c.create({ ...g, question: "Q", kind: "total", threshold: { standard: later, value: "5" }, recipe: SUM }));
  await keep(w.c.read({ calcId: c.calc_id, viewer: V("bob") }));
  await keep(w.c.accept({ calcId: c.calc_id, by: V("bob") }));
  await keep(w.c.recompute({ calcId: c.calc_id }));
  await keep(w.c.runPatterns({ budgetMs: 1000 }));
  await keep(w.c.patternResults({ viewer: V("bob") }));
  await keep(w.c.recordPatternGate({ pattern: "duty_lateness", goldSet: "g", falseAlarmRate: 0.1, by: V("alice") }));
  await keep(w.c.patternResults({ viewer: V("alice") }));
  /* the refusal codes are the requirement's own names; everything else is the outward text */
  const text = JSON.stringify(out, (k, v) => (k === "reason" || k === "code" ? undefined : v));
  assert.doesNotMatch(text, /\bbreach|\bviolat|\bnon-?conforming|\bdiverted\b|\bmisused\b|\bscore\b|\brisk score|\bsuspicious\b|\bconflict\b/i);
  assert.ok(text.includes("computed fact"));
});

test("R28 no place is named in this module's behaviour, defaults or outward text; fiscal years and schemes are profile data", async () => {
  const base = { amount: "10", kind: "expenditure", phase: "adopted", stage: undefined, basis: "budgetary" };
  const run = async (w) => {
    const ad = w.fact({ ...base, period: { from: "2025-08-01", to: "2025-08-31" } });
    const ac = w.fact({ ...base, phase: "actual", stage: "paid", period: { from: "2025-08-01", to: "2025-08-31" } });
    return w.c.create({ question: "Q", period: PERIOD, kind: "budget_against_actuals", inputs: [{ name: "adopted", money: [ad] }, { name: "actual", money: [ac] }], by: V("bob") });
  };
  const a = seeded();
  const ra = await run(a);
  assert.deepEqual(ra.results.periods.map((p) => p.fiscal_period), ["FY2025-26"], "the test profile's fiscal year (April)");
  /* another profile's fiscal year changes the answer: it is data, never code */
  const julyStart = (ids) => { const c = combine(ids); c.view = { ...c.view, fiscal_year: [{ body: "*", start: "09-01", named_by: "end", label: "Y{end}", status: "ruled", basis: "TEST" }] }; return c; };
  const b = world({ construct: false });
  b.member("bob");
  b.build({ combine: julyStart });
  b.c = b.build();
  const rb = await run(b);
  assert.deepEqual(rb.results.periods.map((p) => p.fiscal_period), ["Y2025"]);
  /* no active profile: no fiscal period is invented */
  const none = world({ profiles: null });
  none.member("bob");
  const rn = await run(none);
  assert.equal(code(rn), "BUDGET_INPUTS");
  const text = JSON.stringify([ra, rb, rn]);
  assert.doesNotMatch(text, /Oakland|Alameda|California|Port Ellery/i);
});

test("R29 the table declarations (record-core): tables, bindings, calculations, draws and results export yes; pattern definitions and results export admin-only; each keyed to its project for purge", async () => {
  const w = seeded();
  const declared = w.record.declaredTables().filter((d) => d.module === "calculations");
  assert.deepEqual(declared.map((d) => d.name), CALCULATIONS_TABLES.map((t) => t.name));
  const cls = Object.fromEntries(declared.map((d) => [d.name, d]));
  for (const n of ["calc_tables", "calc_bindings", "calc_ingests", "calculations", "calc_inputs", "calc_recomputes", "calc_draws", "calc_sets"])
    assert.equal(cls[n].export, "yes", n);
  for (const n of ["calc_pattern_results", "calc_pattern_runs", "calc_pattern_gates", "calc_pattern_switches"]) assert.equal(cls[n].export, "admin-only", n);
  for (const n of ["calculations", "calc_inputs", "calc_recomputes", "calc_draws", "calc_sets", "calc_pattern_switches"]) assert.deepEqual(cls[n].keys, ["project"], n);
  for (const n of ["calc_tables", "calc_bindings", "calc_ingests"]) assert.deepEqual(cls[n].keys, ["bundle_id"], `${n}: keyed to its source's bundle`);
  for (const d of declared) for (const k of ["purge", "expunge", "export", "sight", "derive", "version_chain"]) assert.ok(d[k] !== undefined, `${d.name}.${k}`);
  /* a project's purge clears its calculations, and leaves another's */
  const P = w.project("Purged", "bob"), Q = w.project("Kept", "bob");
  const t = await w.table("dept,amount\nparks,10\n", F);
  const mk = (project) => w.c.create({ question: "Q", period: PERIOD, kind: "total", inputs: [{ name: "t", table: t.sha }], recipe: SUM, project, by: V("bob") });
  const p = await mk(P), q = await mk(Q);
  w.record.purge({ bundleId: P });
  assert.deepEqual(w.rows(`SELECT calc_id FROM calculations ORDER BY calc_id`).map((r) => r.calc_id), [q.calc_id]);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM calc_inputs WHERE calc_id=?`, p.calc_id)[0].n, 0);
  assert.equal((await w.c.read({ calcId: p.calc_id, viewer: V("bob") })).found, false);
});
