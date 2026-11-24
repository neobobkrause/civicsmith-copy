/* control-plane: the plane side of the fleet members' interface arms (N402, N413; K675 (4), K683). A fleet member
   cannot import the plane, so each exports the op set it calls and the namespace set it names; this suite pins both
   against the door — the op table it routes by and the namespace set its gate holds — so the day the plane changes
   either, this goes red rather than a member's copy ageing silently. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, aik, cred } from "./harness.mjs";
/* N586 (T34-60): agent-worker's op set and namespaces are read from its own `ops.mjs` and the sub-session scope from
   agent-harness, their owners since T34's L6 (T34-37, T34-39), never through agent-worker's re-exports. */
import { PLANE_OPS as AGENT_OPS, NAMESPACES as AGENT_NAMESPACES } from "../../../../agent-worker/src/ops.mjs";
import { SUBSESSION_OPS } from "../../../../agent-harness/src/subsession.mjs";
import { PLANE_OPS as OCR_OPS, NAMESPACES as OCR_NAMESPACES } from "../../../../ocr-worker/src/contract.mjs";
/* T33 (K1531, K1570): sheet-worker, the fleet member workbooks' recompute reaches through `SHEET_WORKER` (its R11: it
   calls no op, and names the door's namespaces). */
import { PLANE_OPS as SHEET_OPS, NAMESPACES as SHEET_NAMESPACES } from "../../../../sheet-worker/src/contract.mjs";

const { OPS, AI_RUN_ACTIONS, PLAN_RUN_SCOPE } = O;
const MEMBERS = [["agent-worker", AGENT_OPS], ["ocr-worker", OCR_OPS], ["sheet-worker", SHEET_OPS]];

test("R2 (N402, K683): every op a fleet member calls is in the op table with the member's own mutating flag; every write agent-worker makes is an AI-run act or plan mode's one write (optionpropose, in op-declarations' plan-mode scope); its sub-session scope reads only; search, basisversions and versionchain are member-class reads", () => {
  assert.ok(Object.keys(AGENT_OPS).length > 10);
  for (const [member, ops] of MEMBERS)
    for (const [op, d] of Object.entries(ops)) {
      assert.ok(Object.hasOwn(OPS, op), `${member}: ${op} has no spec`);
      assert.equal(OPS[op].mutating, d.mutating, `${member}: ${op}'s mutating flag`);
      assert.ok(OPS[op].classes === null || OPS[op].classes.includes("member"), `${member}: ${op} reaches no member, so no agent`);
    }
  /* a write is an AI-run act, or plan mode's one production, which op-declarations scopes for a plan-mode run */
  for (const [op, d] of Object.entries(AGENT_OPS))
    if (d.mutating) assert.ok(AI_RUN_ACTIONS.includes(op) || PLAN_RUN_SCOPE.writes.includes(op), `${op} is not an AI-run act`);
  assert.ok(PLAN_RUN_SCOPE.writes.includes("optionpropose") && !AI_RUN_ACTIONS.includes("optionpropose"));
  for (const op of PLAN_RUN_SCOPE.reads) assert.ok(Object.hasOwn(AGENT_OPS, op) && !AGENT_OPS[op].mutating, `plan-mode read ${op}`);
  assert.ok(SUBSESSION_OPS.length > 0);
  for (const op of SUBSESSION_OPS) assert.equal(OPS[op]?.mutating, false, `sub-session ${op} writes`);
  for (const op of ["search", "basisversions", "versionchain"]) {
    assert.equal(OPS[op].mutating, false, op);
    assert.ok(OPS[op].classes.includes("member"), op);
  }
});

test("R2 (N402): an agent credential naming the member's writes reaches every op agent-worker calls through the door — none refused before its handler or store route — and a credential that does not declare a write is refused it (negative control)", async () => {
  const writes = Object.entries(AGENT_OPS).filter(([, d]) => d.mutating).map(([op]) => op);
  const agent = aik(), narrow = aik();
  const { env } = world({ creds: { [agent]: cred({ tokenId: "agent-run", writes }), [narrow]: cred({ tokenId: "agent-ro", writes: [] }) } });
  for (const op of Object.keys(AGENT_OPS)) {
    env.calls.length = 0;
    const log = [];
    const hooks = { publicOp: async () => M.json({ ok: true }), gatedOp: async (ctx) => { log.push(ctx.op); return undefined; },
                    publicInstanceGroup: async () => ({ answered: true, result: {} }) };
    const r = await call(env, { op, token: agent, hooks, method: AGENT_OPS[op].mutating ? "POST" : "GET",
                                body: AGENT_OPS[op].mutating ? {} : undefined });
    assert.notEqual(r.status, 401, op);
    assert.notEqual(r.status, 403, `${op}: ${r.text.slice(0, 200)}`);
    /* R41 (K2135): `agentpack` is answered from the untargeted affordances handler, which the door asks under that name */
    assert.ok(log.includes(op) || op === "whoami" || (op === "agentpack" && log.includes("affordances")), `${op} reached no handler`);
  }
  for (const op of writes) {
    const r = await call(env, { op, token: narrow, method: "POST", body: {} });
    assert.deepEqual([r.status, r.json.reason], [403, "AI_BEYOND_TASK_SCOPE"], op);
  }
});

test("R2 (N413; K1531): every fleet member's namespace set equals the door's own, exactly and in order — sheet-worker's among them, which calls no op of the door (its R11)", () => {
  assert.deepEqual(Object.keys(SHEET_OPS), []);
  assert.deepEqual([...M.NAMESPACES], ["bio", "scratch"]);
  for (const [member, set] of [["agent-worker", AGENT_NAMESPACES], ["ocr-worker", OCR_NAMESPACES], ["sheet-worker", SHEET_NAMESPACES]])
    assert.deepEqual([...set], [...M.NAMESPACES], member);
});
