/* control-plane R112 (T51; K4206, K4210; op-declarations R80, op-grades R49): each op this module declares in DECLARED_OPS is held true
   against the op as the door runs it (test-support R15): only its requires raise no refusal naming a declared field, a call without
   each required one is refused naming it, and a field outside accepts is dropped or refused naming it. The door's own map is driven
   with real neighbours (capture, case-account, action-clocks, their fixtures), and `subscriptionsignin`, whose arm is the door's own,
   through the whole door; its `step` is judged by agent-worker (R66), which the test stands in for with the refusal R66 gives. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { OWNER_MAP_DECLARED_OPS as DECLARED_OPS, ownerOps as controlPlaneOwnerOps } from "../../../src/store-assembly/owner-ops.mjs";
import { OPS, OP_STAMPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { fresh } from "../capture/fixture.mjs";
import { world as caseWorld, V as CV } from "../case-account/fixture.mjs";
import { world as clockWorld, MACHINE, CLK } from "../action-clocks/fixture.mjs";
import { boot as translationsBoot } from "../translations/fixture.mjs";
import { translationsOps, DECLARED_OPS as TRANSLATIONS_DECLARED } from "../../../src/translations/index.mjs";
import { DECLARED_OPS as SIGNIN_DECLARED } from "../../../src/signin-door/index.mjs";
import { call } from "./harness.mjs";
import { callers } from "./door-routes.mjs";

/* a refusal names a field by its code (the table) or by the field itself (`argument`, `field`), never by a sentence */
const named = (codes) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if (answer.argument === field || answer.field === field) return true;
  return (codes[field] ?? []).includes(answer.code ?? answer.reason);
};
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const BYTES = new TextEncoder().encode("a page of notes");
const url = (op, query) => {
  const u = new URL(`http://do/${op}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, v);
  return u;
};

/* ---- the calls: each drives the door's map as the door does, its stamps read from the address ---- */
const MEMBER = "member:ann";
const uploadOf = async (fields) => {
  const { c } = fresh();
  return controlPlaneOwnerOps({ capture: () => c }, url("captureupload", { ...fields, by: MEMBER }), BYTES).captureupload();
};

const CASE = "CASE-2026-0001", RUN = "RUN-2026-0001", DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q", AI = "class:ai";
function caseSetup() {
  const w = caseWorld();
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  w.join(P, "bo");
  w.runs.set(RUN, { status: "running" });
  w.published(CASE, P);
  return w;
}
const draftsOf = async (fields) => {
  const w = caseSetup();
  return controlPlaneOwnerOps({ caseAccount: () => w.cacc }, url("accountdrafts", { ...fields, viewer: CV("alice") }), undefined).accountdrafts();
};
const proposeOf = async (fields) => {
  const w = caseSetup();
  const u = url("accountpropose", { by: AI, viewer: AI });
  return controlPlaneOwnerOps({ caseAccount: () => w.cacc }, u, fields).accountpropose();
};

const A = "ACTN-2026-0001-a";
const clockOf = async (fields) => {
  const w = clockWorld();
  w.action(A, ["clock:", ...CLK("2026-09-01"), ...CLK("2026-12-01")]);
  return controlPlaneOwnerOps({ actionClocks: () => w.c }, url("clockpropose", { ...fields, proposer: MACHINE, viewer: MACHINE }), undefined).clockpropose();
};

/* R116 (C15): `interfacewords` is translations' arm (R66), declared here because the shell sends it (K4317); every field is the
   address's, the viewer the door's stamp */
const wordsOf = async (fields) => {
  const w = translationsBoot();
  const q = new URLSearchParams({ op: "interfacewords", viewer: MEMBER, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])) });
  return translationsOps(w.m, new URL(`http://x/?${q}`), {}).interfacewords();
};

/* agent-worker R66's judgment of `step` (the stand-in: its refusal for any other step is BAD_STEP, by code) */
const AGENT_STEPS = ["start", "code", "state", "signout"];
const agentWorker = { fetch: async (_url, init) => {
  const p = JSON.parse(init.body);
  const body = AGENT_STEPS.includes(p.step) ? { ok: true, member: p.member, step: p.step }
    : { ok: false, code: "BAD_STEP", detail: "step is not one of start, code, state, signout" };
  return new Response(JSON.stringify(body), { status: AGENT_STEPS.includes(p.step) ? 200 : 400, headers: { "content-type": "application/json" } });
} };
const signinOf = async (fields) => {
  const { w, sessions } = callers();
  w.env.AGENT_WORKER = agentWorker;
  const ann = sessions.find((s) => s.name === "ann");
  const r = await call(w.env, { op: "subscriptionsignin", token: ann.token, method: "POST", body: fields });
  return { status: r.status, ...(r.json ?? {}) };
};
/* the door stamps a trace per request (R93), so two answers are the same when their words and status are */
const sameSignin = (x, y) => sameCode(x, y) && x.status === y.status;

test("R112 (K4206) captureupload: its statement is required, a missing one refused naming it; name and type are optional; the arm's fields and the hand row agree", async () => {
  await declaredOpHolds({ op: "captureupload", declaration: DECLARED_OPS.captureupload, call: uploadOf,
    refusedNaming: named({ statement: ["UPLOAD_NO_STATEMENT"] }), values: { statement: "the notes from the meeting" }, same: sameCode });
  assert.deepEqual(DECLARED_OPS.captureupload.fields.requires, ["statement"]);
});

test("R112 (K4206) accountdrafts: its case is required, a missing one refused naming it, and a field outside accepts is dropped", async () => {
  await declaredOpHolds({ op: "accountdrafts", declaration: DECLARED_OPS.accountdrafts, call: draftsOf,
    refusedNaming: named({ case: ["NO_SUCH_CASE"] }), values: { case: CASE }, same: sameCode });
});

test("R112 (K4206) accountpropose: its case, framing, text and run are required, each missing one refused naming it; kind and flags are optional", async () => {
  await declaredOpHolds({ op: "accountpropose", declaration: DECLARED_OPS.accountpropose, call: proposeOf,
    refusedNaming: named({ case: ["NO_SUCH_CASE"], framing: ["BAD_ACCOUNT_FRAMING"], run: ["NO_SUCH_RUN"] }),
    values: { case: CASE, framing: "time_order", text: "First the award.", run: RUN }, same: sameCode });
});

test("R112 (K4210) clockpropose: its target and rule are required, each missing one refused naming it; a field outside accepts is dropped", async () => {
  await declaredOpHolds({ op: "clockpropose", declaration: DECLARED_OPS.clockpropose, call: clockOf,
    refusedNaming: named({ target: ["NO_TARGET"], rule: ["NO_SUCH_RULE"] }), values: { target: A, rule: "records_answer" }, same: sameCode });
});

/* the declaration is signin-door's (R6 there, K5052 (4)), read from its own DECLARED_OPS. F1 (coordinator 08:25): signin-door PR 460
   retires that entry under op-grades R57, so this test holds with or without it: with it, the op holds its declaration through the
   whole door; without it, this module declares no row of its own in its place, and once no spec is left the door refuses the op as
   one with no spec (R2), nothing sent to the runner. */
const signinHolds = async (declared, ops) => {
  assert.equal(DECLARED_OPS.subscriptionsignin, undefined, "control-plane's owner map holds no row of its own for subscriptionsignin");
  const declaration = declared?.subscriptionsignin;
  if (declaration) {
    await declaredOpHolds({ op: "subscriptionsignin", declaration, call: signinOf,
      refusedNaming: named({ step: ["BAD_STEP"] }), values: { step: "signout" }, same: sameSignin });
    return "declared";
  }
  if (ops.subscriptionsignin) return "spec only";
  const r = await signinOf({ step: "signout" });
  assert.deepEqual([r.status, r.code], [400, "UNKNOWN_OP"]);
  return "retired";
};

test("R112 (K4210), F1: subscriptionsignin, while signin-door declares it: its step is required, a step agent-worker does not judge refused naming it by BAD_STEP; a field outside accepts is dropped; with the entry retired (signin-door PR 460) the test still holds", async () => {
  assert.equal(await signinHolds(SIGNIN_DECLARED, OPS), SIGNIN_DECLARED.subscriptionsignin ? "declared" : OPS.subscriptionsignin ? "spec only" : "retired");
  /* without the entry, as PR 460 leaves it: the same check passes over signin-door's declarations less subscriptionsignin */
  const { subscriptionsignin: _gone, ...without } = SIGNIN_DECLARED;
  assert.notEqual(await signinHolds(without, OPS), "declared");
});

test("R116, R112 (K4317) interfacewords: it requires nothing (the viewer's own language is the default), `language` and `v` are accepted, a malformed language is refused naming it, and a field outside accepts is dropped", async () => {
  /* the declaration is translations' (R21 there, K5052 (4)), read from its own DECLARED_OPS; the plane's registry holds it from there */
  const declaration = TRANSLATIONS_DECLARED.interfacewords;
  assert.ok(declaration, "translations declares interfacewords");
  assert.equal(DECLARED_OPS.interfacewords, undefined, "control-plane's owner map holds no row of its own for it");
  assert.deepEqual(declaration.fields, { accepts: ["language", "v"], requires: [] });
  await declaredOpHolds({ op: "interfacewords", declaration, call: wordsOf,
    refusedNaming: named({ language: ["LANGUAGE_MALFORMED"] }), values: { language: "es", v: "9.8.7" }, same: sameCode });
  /* control: `language` is read, so a malformed one is refused naming it (the declaration is not vacuous) */
  const bad = await wordsOf({ language: "bad tag" });
  assert.equal(bad.ok, false);
  assert.ok(named({ language: ["LANGUAGE_MALFORMED"] })(bad, "language"), JSON.stringify(bad).slice(0, 200));
});

test("R112 (K4206, K4210) each declaration agrees with its hand row: the classes, machine classes, mutating flag, stamps and needs the door's tables hold", () => {
  for (const [op, row] of Object.entries(DECLARED_OPS)) {
    assert.equal(row.mutating, OPS[op].mutating, `${op} mutating`);
    assert.deepEqual(row.classes, OPS[op].classes, `${op} classes`);
    if (row.machineClasses !== undefined) assert.deepEqual(row.machineClasses, OPS[op].machineClasses, `${op} machine classes`);
    assert.deepEqual(row.stamps, OP_STAMPS[op], `${op} stamps`);
    assert.equal(row.needs ?? null, NEEDS[op] ?? null, `${op} needs`);
  }
  /* control: a row that disagreed would be a different row, so the comparison is not vacuous */
  assert.notDeepEqual(DECLARED_OPS.clockpropose.stamps, DECLARED_OPS.captureupload.stamps);
});
