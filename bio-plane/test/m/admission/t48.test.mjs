/* admission: T48-64 (N1045, K3150; op-declarations R56, R70; sources R1, R9) — `sourceof` and `sourcerung` answer who a
   source is, so a member's reach alone never admits an `ai` credential to them (R26). Each test drives admission at its
   interface, with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, refused, opCalls, aik, cred } from "./harness.mjs";

const { OPS } = O;
const WHO = ["sourceof", "sourcerung"];

test("R26: a member-scoped ai credential is refused AI_BEYOND_TASK_SCOPE (C-29.6) at sourceof and sourcerung unless its declared task scope names the op, before any store call; controls: a credential naming the op is admitted, the member's own session is admitted, and the same credential is admitted to another read its member reaches", async () => {
  for (const op of WHO) assert.ok(OPS[op] && !OPS[op].mutating && A.aiReachesAsMember(OPS[op], op), `${op}: a read a member reaches`);
  const bare = aik(), one = aik(), both = aik();
  const { env, S } = world({ creds: {
    [bare]: cred({ tokenId: "agent-bare", principal: "member:ann", writes: [] }),
    [one]: cred({ tokenId: "agent-one", principal: "member:ann", writes: ["sourceof"] }),
    [both]: cred({ tokenId: "agent-both", principal: "member:ann", writes: [...WHO] }) } });
  /* refused, nothing past the credential's lookup */
  for (const op of WHO) {
    env.calls.length = 0;
    const body = refused(await gate(env, { op, token: bare, method: "GET" }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [bare]);
    assert.deepEqual([body.op, body.cls, body.tokenId, body.declared], [op, "ai", "agent-bare", []]);
    assert.equal(opCalls(env).length, 0, `${op}: before any store call`);
  }
  /* a scope naming one op names only that one */
  assert.equal((await gate(env, { op: "sourceof", token: one, method: "GET" })).caller?.cls, "ai");
  refused(await gate(env, { op: "sourcerung", token: one, method: "GET" }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [one]);
  /* control: a credential naming both is admitted to both */
  for (const op of WHO) assert.equal((await gate(env, { op, token: both, method: "GET" })).caller?.cls, "ai", op);
  /* control: the member's own session is admitted */
  for (const op of WHO) assert.equal((await gate(env, { op, token: S.ann, method: "GET" })).caller?.cls, "member", op);
  /* control: the same credential is admitted to another read its member reaches */
  const other = Object.keys(OPS).filter((k) => OPS[k].classes !== null && !OPS[k].mutating && !WHO.includes(k) && A.aiReachesAsMember(OPS[k], k)).slice(0, 10);
  assert.ok(other.length > 0);
  for (const op of other) assert.equal((await gate(env, { op, token: bare, method: "GET" })).caller?.cls, "ai", op);
  /* at the gate itself */
  assert.equal(A.aiTaskScope(cred({ writes: [] }), "sourceof", OPS.sourceof).refusal.body.reason, "AI_BEYOND_TASK_SCOPE");
  assert.deepEqual(A.aiTaskScope(cred({ writes: ["sourceof"] }), "sourceof", OPS.sourceof), { ok: true, viewer: "member:ann" });
});
