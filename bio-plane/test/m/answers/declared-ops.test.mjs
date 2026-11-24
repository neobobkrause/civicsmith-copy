/* answers R36 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { declaredOpHolds, declaredOpsOf } from "../../declared-ops.mjs";
import { DECLARED_OPS, answersOps } from "../../../src/answers/ops.mjs";
import { answersWorld } from "./fixture.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const ARM = { ruleanswer: "rule", ruleservicesstate: "ruleservicesstate", standingquestionset: "standingset", standingquestionend: "standingend" };
/* bob's world, with one standing question of his, whose id stands for the sample one */
const mkEnv = async () => {
  const w = answersWorld();
  w.sq = w.a.standingQuestionSet({ author: "member:bob", question: "Anything new on the budget?", query: "title:budget", cadence: "daily", ends: "2026-12-31" }).id;
  return w;
};
const real = (fields, env) => ("id" in fields ? { ...fields, id: env.sq } : fields);

/* a refusal names a field by its code (the table; an entry {code, end} also needs the answer to carry that end) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  const hit = (c) => (typeof c === "string" ? answer.code === c || answer.reason === c || answer.error === c
    : (answer.code === c.code || answer.reason === c.code) && Object.entries(c).every(([k, v]) => k === "code" || answer[k] === v));
  if ((codes[field] || []).some(hit)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (mkEnv());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (answersOps(env.a, url, fields)[ARM[op] ?? op]());
};

test("R36 answers declares ruleanswer: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "ruleanswer", declaration: DECLARED_OPS["ruleanswer"], call: mk("ruleanswer", {"viewer":"member:bob"}),
    refusedNaming: named({"service":["RULE_SERVICE_UNKNOWN"]}, true), values: {"service":"standard"}, same: sameCode });
});

test("R36 answers declares standingquestionset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "standingquestionset", declaration: DECLARED_OPS["standingquestionset"], call: mk("standingquestionset", {"viewer":"member:bob"}),
    refusedNaming: named({"query":["STANDING_NEEDS_SEARCH"],"find":["STANDING_NEEDS_SEARCH"],"cadence":["BAD_CADENCE"],"ends":["STANDING_NEEDS_END"]}, true), values: {"query":"title:budget","cadence":"daily","ends":"2026-12-31"}, same: sameCode });
});

test("R36 answers declares standingquestionend: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "standingquestionend", declaration: DECLARED_OPS["standingquestionend"], call: mk("standingquestionend", {"viewer":"member:bob"}, null, null, (fields, env) => (real(fields, env))),
    refusedNaming: named({"id":["NO_SUCH_STANDING_QUESTION"]}, true), same: sameCode });
});

test("R36 R7 answers declares ruleservicesstate: a read for admin and member with no fields, its requires alone raise no refusal and a field outside accepts is dropped", async () => {
  const d = DECLARED_OPS["ruleservicesstate"];
  assert.deepEqual([...d.classes].sort(), ["admin", "member"]);
  assert.equal(d.mutating, false); assert.equal(d.weight, "read");
  assert.deepEqual(d.fields, { accepts: [], requires: [] });
  await declaredOpHolds({ op: "ruleservicesstate", declaration: d, call: mk("ruleservicesstate", {"viewer":"member:bob"}), same: sameCode });
});

test("R36 R7 the owners' declarations, found from build/modules.json, hold ruleservicesstate as answers' own, declared by no other owner", async () => {
  const { ops, owners, duplicates } = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)));
  assert.equal(owners["ruleservicesstate"], "answers");
  assert.deepEqual(ops["ruleservicesstate"], DECLARED_OPS["ruleservicesstate"]);
  assert.deepEqual(duplicates.filter((d) => d.op === "ruleservicesstate"), []);
});
