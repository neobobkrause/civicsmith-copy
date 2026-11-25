/* lines R25 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, linesOps } from "../../../src/lines/index.mjs";
import { world, ANN } from "./fixture.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
/* a world with an office and a body, which stand for the sample ends */
const mkEnv = async () => { const w = world(); w.office = w.ent("office", "Harbour Master"); w.body = w.ent("body", "Port Board"); return w; };
const ends = (f, env) => ({ ...f, ...("from" in f ? { from: env.office } : {}), ...("to" in f ? { to: env.body } : {}) });

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
  return invoke ? await invoke(url, fields, env, op) : await (linesOps(env.l, url, { ...fields, by: ANN })[{ recordline: "linerecord" }[op] ?? op]());
};

test("R25 lines declares recordline: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "recordline", declaration: DECLARED_OPS["recordline"], call: mk("recordline", {"viewer":"member:ann"}, null, null, (fields, env) => (ends(fields, env))),
    refusedNaming: named({"kind":["UNKNOWN_LINE_KIND"],"from":["NO_ENDS"],"to":["NO_ENDS"],"basis":["NO_BASIS"]}, true), values: {"kind":"custodian_of","basis":{"statement":"I read it on the office's page"}}, same: sameCode });
});

/* R26: a line recorded beforehand, so that the requires alone withdraw a real line; the line's id is the one the call names */
const withLine = async () => { const w = await mkEnv(); w.lineId = w.l.recordLine({ kind: "custodian_of", from: w.office, to: w.body, basis: { statement: "I read it on the office's page" }, by: ANN }).line_id; return w; };
const onLine = (fields, env) => ("lineId" in fields ? { ...fields, lineId: env.lineId } : fields);

test("R26 lines declares linewithdraw: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "linewithdraw", declaration: DECLARED_OPS["linewithdraw"], call: mk("linewithdraw", {"viewer":"member:ann"}, withLine, null, onLine),
    refusedNaming: named({"lineId":["NO_SUCH_LINE"],"reason":["NO_REASON"]}, true), values: {"reason":"I recorded it by mistake"}, same: sameCode });
});
