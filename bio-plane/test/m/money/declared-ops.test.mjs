/* money R27 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, moneyOps } from "../../../src/money/index.mjs";
import { seeded, sha, ANN } from "./fixture.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
/* the door's names for the arms they alias */
const ARM = { recordfact: "moneyrecord", createset: "moneysetcreate", include: "moneysetinclude", exclude: "moneysetexclude", reconcile: "moneyreconcile" };
/* a seeded world with a set and two facts, whose ids stand for the sample ones */
const mkEnv = async () => { const s = seeded(); s.setId = s.m.createSet({ purpose: "trail", label: "a set", by: ANN }).set_id; s.f1 = s.rec(); s.f2 = s.rec({ basis: "cash" }); return s; };
const ids = (fields, env) => { const f = { ...fields }; if ("setId" in f) f.setId = env.setId; if ("factId" in f || "id" in f) { if ("factId" in f) f.factId = env.f1; if ("id" in f) f.id = env.f1; } if ("a" in f) f.a = env.f1; if ("b" in f) f.b = env.f2; if ("contract" in f) f.contract = env.contract; if ("entity" in f) f.entity = env.city; return f; };
const asDoor = (url, fields, env, op) => moneyOps(env.m, url, { ...fields, by: ANN })[ARM[op] ?? op]();

/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (mkEnv());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (asDoor(url, fields, env, op));
};

test("R27 money declares recordfact: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "recordfact", declaration: DECLARED_OPS["recordfact"], call: mk("recordfact", {"viewer":"member:ann"}),
    refusedNaming: named({"amount":["NO_AMOUNT"],"as_read":["NO_AS_READ"],"currency":["NO_CURRENCY"],"sign":["NO_SIGN"],"precision":["UNKNOWN_PRECISION"],"kind":["UNKNOWN_MONEY_KIND"],"phase":["UNKNOWN_PHASE"],"basis":["UNKNOWN_BASIS","NO_BASIS"],"period":["NO_PERIOD"],"source":["NO_SOURCE"],"bogus":["UNKNOWN_FIELD"]}, true), values: { amount: "100.00", as_read: "$100.00", currency: "USD", sign: "+", precision: "exact", kind: "expenditure", phase: "adopted", basis: "cash", period: { fiscal: "FY2013-14" }, source: { capture_sha: sha("ledger"), extent: { kind: "pdf-page", page: 3 } } }, outside: ["bogus"], same: sameCode });
});

test("R27 money declares createset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "createset", declaration: DECLARED_OPS["createset"], call: mk("createset", {"viewer":"member:ann"}),
    refusedNaming: named({"purpose":["UNKNOWN_PURPOSE"],"label":["NO_LABEL"]}, true), values: {"purpose":"trail","label":"a set to read"}, same: sameCode });
});

test("R27 money declares include: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "include", declaration: DECLARED_OPS["include"], call: mk("include", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"setId":["NO_SUCH_SET"],"factId":["NO_SUCH_FACT"],"reason":["NO_REASON"]}, true), values: {"reason":"it belongs to the trail"}, same: sameCode });
});

test("R27 money declares exclude: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "exclude", declaration: DECLARED_OPS["exclude"], call: mk("exclude", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"setId":["NO_SUCH_SET"],"factId":["NO_SUCH_FACT"],"reason":["NO_REASON"]}, true), values: {"reason":"it does not belong"}, same: sameCode });
});

test("R27 money declares reconcile: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "reconcile", declaration: DECLARED_OPS["reconcile"], call: mk("reconcile", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"a":["NO_SUCH_FACT","NO_FACTS"],"b":["NO_SUCH_FACT","NO_FACTS"]}, true), same: sameCode });
});

test("R27 money declares committedagainstpaid: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "committedagainstpaid", declaration: DECLARED_OPS["committedagainstpaid"], call: mk("committedagainstpaid", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"contract":["NO_ENTITY"]}, true), same: sameCode });
});

test("R27 money declares authoritychain: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "authoritychain", declaration: DECLARED_OPS["authoritychain"], call: mk("authoritychain", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"id":["NO_FACT"]}, true), same: sameCode });
});

/* K5812 F4: the three reads declared at T51 and T53 are held as the other seven are */
test("R27 money declares moneysets: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "moneysets", declaration: DECLARED_OPS["moneysets"], call: mk("moneysets", {"viewer":"member:ann"}),
    refusedNaming: named({"concerns":["NO_CONCERNS"]}, true), values: { concerns: "PROJ-1" }, same: sameCode });
});

test("R27 money declares moneyby: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "moneyby", declaration: DECLARED_OPS["moneyby"], call: mk("moneyby", {"viewer":"member:ann"}, null, null, (fields, env) => (ids(fields, env))),
    refusedNaming: named({"entity":["NO_ENTITY"]}, true), same: sameCode });
});

test("R27 money declares moneyfiscalyears: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "moneyfiscalyears", declaration: DECLARED_OPS["moneyfiscalyears"], call: mk("moneyfiscalyears", {"viewer":"member:ann"}),
    refusedNaming: named({}, true), same: sameCode });
});
