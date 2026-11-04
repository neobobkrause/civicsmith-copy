/* ai-runs R90 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { world, OPEN, INQ } from "./world.mjs";
const sameCode = (x, y) => x && y && x.ok === y.ok && x.started === y.started && x.found === y.found && x.terminated === y.terminated && (x.code ?? x.reason) === (y.code ?? y.reason);
/* a group of members and one question; the close's world holds a run of it, open (R1) */
const mkGroup = async () => { const w = world(); await w.group("ann", "bob"); w.bundle(INQ); return w; };
const mkRunning = async () => { const w = await mkGroup(); const o = await w.runs.open(OPEN()); assert.equal(o.started, true, JSON.stringify(o).slice(0, 300)); return w; };
/* an answer names the run when it says no such run is held */
const runNamed = (codes) => (answer, field) => (field === "run" && answer && answer.found === false) || (answer && (codes[field] || []).includes(answer.code));

/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (mkGroup());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (aiRunsOps(env.runs, url, fields)[op]());
};

test("R90 ai-runs declares airunopen: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "airunopen", declaration: DECLARED_OPS["airunopen"], call: mk("airunopen", {"principal":"class:ai/tok-org","viewer":"admin"}),
    refusedNaming: named({"run":["AI_RUN_NO_CONTEXT"],"contextType":["AI_RUN_NO_CONTEXT"],"contextId":["AI_RUN_NO_CONTEXT"],"principalAi":["AI_RUN_CAPABILITY_UNAVAILABLE"],"skillVersion":["AI_RUN_SKILL_VERSION_UNNAMED"]}, true), values: { run: "R1", contextType: "inquiry", contextId: INQ, principalAi: "member:ann", skillVersion: "bio@1" }, same: sameCode });
});

test("R90 ai-runs declares airunclose: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "airunclose", declaration: DECLARED_OPS["airunclose"], call: mk("airunclose", {"principal":"class:ai/tok-org","viewer":"admin"}, async () => (mkRunning()), null),
    refusedNaming: runNamed({"bound":["AI_RUN_BOUND_UNNAMED"]}), values: { run: "R1", bound: "completed" }, same: sameCode });
});
