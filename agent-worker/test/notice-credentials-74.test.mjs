/* agent-worker over credentials PR 74 (R27, R63, R73): confirmed, no code change. PR 74 struck those marks with tests
 * and changed no code. What this member takes from them is a run's `ai` credential (R5: a shape test only; liveness is
 * the plane's) and an ask's grant (R54: any non-empty string, carried in the header, R60). The run credential here is
 * minted by credentials' own code (`aiRunCredentialMint` with the `account_id` T53 gives it, R63), through its published
 * fixture, never a literal, and handed to `POST /run` at the member's interface: it is past R5 (the next check, R6's
 * account, answers). After its account is cleared (R73 revokes it), the same token still passes the shape test here:
 * this member judges no liveness, so the plane's `whoami` (R8) is what refuses it. Control: a token one character off
 * the plane's shape is refused `BAD_CREDENTIAL_SHAPE`. No plane call is made on any arm (R1-R8 before any call). */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { world, sha } from "../../bio-plane/test/m/credentials/fixture.mjs";

function recordingPlane() {
  const calls = [];
  return { calls, binding: { fetch: async (req) => { calls.push(String(req.url ?? req)); return new Response("{}", { status: 500 }); } } };
}

async function run(credential) {
  const p = recordingPlane();
  const res = await worker.fetch(new Request("http://agent-worker/run", { method: "POST",
    body: JSON.stringify({ run_id: "RUN-N74", store: "bio", credential }) }), { VERSION: "n74", PLANE: p.binding });
  return { status: res.status, body: await res.json(), calls: p.calls };
}

test("notice credentials:74 (R63, R73 -> agent-worker R5): a run credential credentials mints for an account passes this member's shape test, live or revoked; control: one character off is BAD_CREDENTIAL_SHAPE; no plane call", async () => {
  const w = await world().group("ann");
  const served = await w.signin("ann");
  assert.equal(served.ok, true);
  const minted = w.c.aiRunCredentialMint({ member: "ann", run: "RUN-N74", writes: ["airuntick"], account_id: served.account_id });
  assert.equal(minted.ok, true);

  const live = await run(minted.token);
  assert.notEqual(live.body.code, "BAD_CREDENTIAL_SHAPE", "R5: credentials' token is of the plane's shape");
  assert.notEqual(live.body.code, "NO_CREDENTIAL");
  assert.equal(live.body.code, "NO_ACCOUNT", "the next check (R6) answers: R5 passed");
  assert.deepEqual(live.calls, [], "no plane call before R1-R8 pass");

  /* R73: the account cleared revokes the run's credential in the plane; the shape here is unchanged. */
  w.a.accountCredentialFailed({ account_id: served.account_id, why: "unresolved" });
  assert.equal(w.c.aiCredentialLook({ secretSha: sha(minted.token) }).credential.revoked, true, "R73 revoked it");
  const revoked = await run(minted.token);
  assert.equal(revoked.body.code, "NO_ACCOUNT", "R5 is a shape test only: liveness is the plane's (R8)");

  /* Control: off the plane's shape. */
  const off = await run(minted.token.slice(0, -1) + "G");
  assert.equal(off.status, 400);
  assert.equal(off.body.code, "BAD_CREDENTIAL_SHAPE");
  assert.deepEqual(off.calls, []);
});
