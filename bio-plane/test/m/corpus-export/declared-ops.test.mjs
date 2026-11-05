/* corpus-export R12 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, corpusExportOps } from "../../../src/corpus-export/index.mjs";
import { world } from "./fixture.mjs";


/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (world());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (corpusExportOps(env.ce, (k) => url.searchParams.get(k))[op]());
};

test("R11 corpus-export declares export: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "export", declaration: DECLARED_OPS["export"], call: mk("export", {"viewer":"admin"}),
    refusedNaming: named({}) });
});

test("R12 corpus-export declares exportlog: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "exportlog", declaration: DECLARED_OPS["exportlog"], call: mk("exportlog", {"viewer":"admin"}),
    refusedNaming: named({}) });
});

test("R15 corpus-export declares exportrender: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "exportrender", declaration: DECLARED_OPS["exportrender"], call: mk("exportrender", {"viewer":"member:ann"}),
    values: { format: "ftm", part: "1" }, refusedNaming: named({ format: ["EXPORT_FORMAT_UNKNOWN"], part: ["EXPORT_PART_MALFORMED"] }) });
});
