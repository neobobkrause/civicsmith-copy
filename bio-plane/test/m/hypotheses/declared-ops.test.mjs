/* hypotheses R24 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { world, ANN, INQ, E1, E2 } from "./fixture.mjs";
/* a group: one inquiry, one hypothesis ann holds in it, one note of ann's */
const mkWorld = async () => {
  const w = world();
  w.bundle(INQ);
  const h = w.h.hold({ inquiry: INQ, kind: "relation", statement: "S.", about: { from: E1, to: E2 }, by: ANN });
  assert.equal(h.ok, true, JSON.stringify(h));
  const n = w.h.noteWrite({ text: "a note", by: ANN });
  assert.equal(n.ok, true, JSON.stringify(n));
  return { ...w, hyp: h.hypothesis_id, note: n.note };
};
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const seeded = (fields, env) => { const f = { ...fields }; if ("hypothesisId" in f) f.hypothesisId = env.hyp; if ("note" in f) f.note = env.note; return f; };
const asAnn = (url, fields, env, op) => hypothesesOps(env.h, url, { ...fields, by: ANN })[op]();

/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (mkWorld());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (asAnn(url, fields, env, op));
};

test("R24 hypotheses declares hypothesishold: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "hypothesishold", declaration: DECLARED_OPS["hypothesishold"], call: mk("hypothesishold", {}),
    refusedNaming: named({"inquiry":["NO_SUCH_BUNDLE"],"kind":["UNKNOWN_HYPOTHESIS_KIND"],"statement":["HYPOTHESIS_NO_STATEMENT"],"about":["BAD_ABOUT"]}, true), values: { inquiry: INQ, kind: "relation", statement: "S.", about: { from: E1, to: E2 } }, same: sameCode });
});

test("R24 hypotheses declares hypothesisrevise: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "hypothesisrevise", declaration: DECLARED_OPS["hypothesisrevise"], call: mk("hypothesisrevise", {}, null, null, (fields, env) => (seeded(fields, env))),
    refusedNaming: named({"hypothesisId":["NO_SUCH_HYPOTHESIS"],"reason":["HYPOTHESIS_NO_REASON"]}, true), values: {"reason":"new evidence"}, same: sameCode });
});

test("R24 hypotheses declares hypothesiswithdraw: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "hypothesiswithdraw", declaration: DECLARED_OPS["hypothesiswithdraw"], call: mk("hypothesiswithdraw", {}, null, null, (fields, env) => (seeded(fields, env))),
    refusedNaming: named({"hypothesisId":["NO_SUCH_HYPOTHESIS"],"reason":["HYPOTHESIS_NO_REASON"]}, true), values: {"reason":"no longer held"}, same: sameCode });
});

test("R24 hypotheses declares notewrite: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "notewrite", declaration: DECLARED_OPS["notewrite"], call: mk("notewrite", {}),
    refusedNaming: named({"text":["NOTE_NO_TEXT","NOTE_TOO_LONG"]}, true), values: {"text":"a note to write"}, same: sameCode });
});

test("R24 hypotheses declares noterevise: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "noterevise", declaration: DECLARED_OPS["noterevise"], call: mk("noterevise", {}, null, null, (fields, env) => (seeded(fields, env))),
    refusedNaming: named({"note":["NO_SUCH_NOTE"],"text":["NOTE_NO_TEXT","NOTE_TOO_LONG"]}, true), values: {"text":"the note, said better"}, same: sameCode });
});

test("R24 hypotheses declares noteturn: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "noteturn", declaration: DECLARED_OPS["noteturn"], call: mk("noteturn", {}, null, null, (fields, env) => (seeded(fields, env))),
    refusedNaming: named({"note":["NO_SUCH_NOTE"],"into":["NOTE_TURN_UNKNOWN"],"made":["NOTE_TURN_NOT_MADE"],"hunch":["NOTE_TURN_NOT_MADE"]}, true), values: {"into":"question","made":"INQ-2026-0002-q"}, same: sameCode });
});

test("R24 hypotheses declares notedelete: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "notedelete", declaration: DECLARED_OPS["notedelete"], call: mk("notedelete", {}, null, null, (fields, env) => (seeded(fields, env))),
    refusedNaming: named({"note":["NO_SUCH_NOTE"]}, true), same: sameCode });
});

/* F1 (layer 12, CR2-19; op-declarations F4, R80): the rival explanations' three ops, over a question holding two of ann's
   hypotheses set as its rivals (the mark's world) or not yet set (the set's world) */
const rivalWorld = (set) => async () => {
  const env = await mkWorld();
  const h2 = env.h.hold({ inquiry: INQ, kind: "other", statement: "Another.", about: [E1], by: ANN });
  assert.equal(h2.ok, true, JSON.stringify(h2));
  if (set) assert.equal(env.h.hypothesisRivals({ inquiry: INQ, rivals: [env.hyp, h2.hypothesis_id], by: ANN }).ok, true);
  return { ...env, hyp2: h2.hypothesis_id };
};
const withRivals = (fields, env) => ("rivals" in fields ? { ...fields, rivals: [env.hyp, env.hyp2] } : fields);
const withRival = (fields, env) => ("rival" in fields ? { ...fields, rival: env.hyp } : fields);

test("F1 R24 hypotheses declares hypothesisrivals: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  assert.deepEqual([DECLARED_OPS.hypothesisrivals.needs, [...DECLARED_OPS.hypothesisrivals.stamps].sort(), DECLARED_OPS.hypothesisrivals.mutating], ["contribute", ["by", "viewer"], true]);
  await declaredOpHolds({ op: "hypothesisrivals", declaration: DECLARED_OPS["hypothesisrivals"], call: mk("hypothesisrivals", {}, rivalWorld(false), null, withRivals),
    refusedNaming: named({"inquiry":["NO_SUCH_BUNDLE"],"rivals":["RIVALS_TOO_FEW"]}, true), values: { inquiry: INQ, rivals: ["set"] }, same: sameCode });
});

test("F1 R24 hypotheses declares explorenext: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  assert.deepEqual([DECLARED_OPS.explorenext.needs, [...DECLARED_OPS.explorenext.stamps].sort(), DECLARED_OPS.explorenext.mutating], ["contribute", ["by", "viewer"], true]);
  await declaredOpHolds({ op: "explorenext", declaration: DECLARED_OPS["explorenext"], call: mk("explorenext", {}, rivalWorld(true), null, withRival),
    refusedNaming: named({"inquiry":["NO_SUCH_BUNDLE"],"rival":["NOT_A_RIVAL"]}, true), values: { inquiry: INQ, rival: "set" }, same: sameCode });
});

test("F1 R24 hypotheses declares rivals, a session read: its requires alone raise no refusal naming a field, a call without the question is refused naming it, and a field outside accepts is dropped or refused", async () => {
  assert.deepEqual([DECLARED_OPS.rivals.mutating, Object.hasOwn(DECLARED_OPS.rivals, "needs"), DECLARED_OPS.rivals.classes !== null], [false, false, true]);
  await declaredOpHolds({ op: "rivals", declaration: DECLARED_OPS["rivals"], call: mk("rivals", { viewer: ANN }, rivalWorld(true)),
    refusedNaming: named({"inquiry":["NO_SUCH_BUNDLE"]}, true), values: { inquiry: INQ, history: "1" }, same: sameCode });
});
