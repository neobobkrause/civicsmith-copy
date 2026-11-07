/* ai-use R16 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, aiUseOps } from "../../../src/ai-use/index.mjs";
import { standard } from "./fixture.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason) && x.field === y.field;

/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if (answer.field === field || answer.argument === field) return true;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (standard());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (aiUseOps(env.u, url, fields)[op]());
};

test("R16 ai-use declares ailimitset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "ailimitset", declaration: DECLARED_OPS["ailimitset"], call: mk("ailimitset", {"by":"ann"}),
    refusedNaming: named({}, true), values: {"owner":"member:ann","scope":"ask","unit":"calls","period":"day","amount":5}, same: sameCode });
});

test("R16 ai-use declares exploreapprove: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "exploreapprove", declaration: DECLARED_OPS["exploreapprove"], call: mk("exploreapprove", {"by":"ann"}),
    refusedNaming: named({}, true), values: {"owner":"member:ann","day":"2026-10-09"}, same: sameCode });
});

/* F2 (op-grades R57; coordinator ruling 5 Nov 04:19): the assistant's ops this module serves are declared here with R57's
   grades, so op-grades reads them from their owner: the re-tests' and health switches reversible, the two reads `read`. */
test("F2 ai-use declares op-grades R57's ops with R57's grades: airetestset and aihealthset reversible, aiusebymember and aihealthpreview read (control: ailimitset and exploreapprove keep their substrate rows)", () => {
  const want = { airetestset: ["reversible", true], aihealthset: ["reversible", true], aiusebymember: ["read", false], aihealthpreview: ["read", false] };
  for (const [op, [weight, mutating]] of Object.entries(want)) {
    const row = DECLARED_OPS[op];
    assert.ok(row, `${op} is declared`);
    assert.equal(row.weight, weight, op);
    assert.equal(row.mutating, mutating, op);
    assert.deepEqual(row.machineClasses, [], `${op}: no machine takes it`);
    assert.equal(typeof row.description, "string");
    assert.ok(row.description.length > 0 && !row.description.startsWith("capture-directed:"), op);
    if (weight === "read") assert.ok(row.description.startsWith("read:"), op);
    assert.equal(typeof aiUseOps({}, new URL("http://x/"), {})[op], "function", `${op} is served here`);
  }
  assert.equal(DECLARED_OPS.ailimitset.weight, "substrate");
  assert.equal(DECLARED_OPS.exploreapprove.weight, "substrate");
});

test("F2 ai-use declares airetestset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "airetestset", declaration: DECLARED_OPS["airetestset"], call: mk("airetestset", {"by":"admin"}),
    refusedNaming: named({}, true), values: {"owner":"group","on":true,"caps":{}}, same: sameCode });
});

test("F2 ai-use declares aihealthset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "aihealthset", declaration: DECLARED_OPS["aihealthset"], call: mk("aihealthset", {"by":"admin"}),
    refusedNaming: named({}, true), values: {"on":true}, same: sameCode });
});

/* F3 (coordinator 17:24, screens-ai R2, R7): the screens' limits and alerts, declared here and held against their arms */
test("F3 ai-use declares aibudgetset: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "aibudgetset", declaration: DECLARED_OPS["aibudgetset"], call: mk("aibudgetset", {"by":"admin"}),
    refusedNaming: named({}, true), values: {"scope":"overall","unit":"calls","period":"month","amount":40}, same: sameCode });
});

test("F3 ai-use declares aiprojectbudget: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "aiprojectbudget", declaration: DECLARED_OPS["aiprojectbudget"], call: mk("aiprojectbudget", {"by":"ann"}),
    refusedNaming: named({}, true), values: {"project":"P","scope":"ask","unit":"tokens","period":"day","amount":5000}, same: sameCode });
});

test("F3 aibudgetset with kind sets an alert threshold, without it a limit; aiprojectbudget sets the project's (control: a member's aibudgetset of the team's is NOT_AN_ADMIN, nothing set)", async () => {
  const env = await standard();
  const url = (by) => new URL(`http://x/?by=${by}`);
  const lim = aiUseOps(env.u, url("admin"), { scope: "overall", unit: "calls", period: "month", amount: 40 }).aibudgetset();
  assert.deepEqual([lim.ok, lim.owner, lim.amount], [true, "group", 40]);
  const thr = aiUseOps(env.u, url("admin"), { scope: "overall", unit: "calls", period: "month", kind: "percent", level: 80 }).aibudgetset();
  assert.equal(thr.ok, true, JSON.stringify(thr));
  assert.equal(thr.amount, undefined, "a threshold, not a limit");
  const own = aiUseOps(env.u, url("ann"), { owner: "member", scope: "ask", unit: "calls", period: "day", amount: 3 }).aibudgetset();
  assert.deepEqual([own.ok, own.owner], [true, "member:ann"]);
  const proj = aiUseOps(env.u, url("ann"), { project: "P", scope: "ask", unit: "tokens", period: "day", amount: 5000 }).aiprojectbudget();
  assert.deepEqual([proj.ok, proj.owner], [true, "project:P"]);
  const no = aiUseOps(env.u, url("ann"), { scope: "overall", unit: "calls", period: "month", amount: 1 }).aibudgetset();
  assert.equal(no.code, "NOT_AN_ADMIN");
  assert.ok(!env.u.aiLimits({ owner: "group", viewer: "admin" }).limits.some((l) => l.amount === 1));
});
