/* agent-worker over ai-runs PR 96 (T53; ai-runs R18, R52, R82, R84, R92-R97). What this member takes from ai-runs is the
 * `POST /run` dispatch `dispatchMemberRun` makes (now `(args = {})`, with the account `ai-accounts` shapes in-plane and
 * its hop) and the reading of this member's answer (R82: `202 {accepted}` RUNNING; a refusal REFUSED with its code;
 * `AI_PATH_NOT_READY` withheld). Driven end to end: ai-runs' real `dispatchMemberRun` on its own test world (real code,
 * its catalogue fixture's account) with `AGENT_WORKER` bound to this member's real `fetch`.
 *
 * Confirmed, no code change, for what this module's met requirements take: the body's `run_id`, `store` and
 * `credential` pass R3, R4 and R5 (credentials' real mint); the account carries no secret on the wire (R36); no plane
 * call is made before R1-R8 pass; and ai-runs relays this member's refusal code unchanged (R43). Not adapted here: the
 * T53 account itself (`{account_id, provider, plan, means, entries, ...}`) is R6's open T53 mark, which rests on
 * `agent-model`'s T53 resolver and `entryFor` (unbuilt); it is a `test.todo` below, never a pin of today's refusal.
 * Control: the same body with its credential one character off is refused BAD_CREDENTIAL_SHAPE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { world, OPEN, INQ } from "../../bio-plane/test/m/ai-runs/world.mjs";

const SHAPE_CODES = ["BAD_BODY", "BAD_RUN_ID", "BAD_STORE", "NAMESPACE_UNKNOWN", "NO_CREDENTIAL", "BAD_CREDENTIAL_SHAPE"];
const SECRET_FIELDS = ["secret", "key", "token", "apikey"];

async function dispatched() {
  const seen = { bodies: [], answers: [], planeCalls: [] };
  const env = { VERSION: "notice-ai-runs-96",
    PLANE: { fetch: async (url) => { seen.planeCalls.push(String(url)); return Response.json({ ok: false }, { status: 500 }); } } };
  const AGENT_WORKER = { fetch: async (url, init) => {
    seen.bodies.push(JSON.parse(init.body));
    const res = await worker.fetch(new Request(url, init), env);
    const text = await res.text();
    seen.answers.push({ status: res.status, body: JSON.parse(text) });
    return new Response(text, { status: res.status, headers: res.headers });
  } };
  /* ai-runs PR 323 (F1, fail closed): with no path source the dispatch is withheld AI_PATH_NOT_READY. This test registers
     its own source answering `ok` rather than leaning on the world's default stand-in (notice-ai-runs-323 holds the control). */
  const w = world({ env: { AGENT_WORKER, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "2000" },
                    deployedModes: ["check"], pathReady: null });
  assert.equal(w.runs.registerPathReady("plane", () => ({ state: "ok" })).ok, true, "this test's own path source");
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  const opened = await w.runs.open(OPEN({ mode: "check", principalPlane: "member:ann", principalAi: "member:ann",
                                          actor: "member:ann", viewer: "member:ann" }));
  assert.equal(opened.started, true, `ai-runs' world opened R1: ${JSON.stringify(opened).slice(0, 200)}`);
  const out = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  return { out, env, ...seen };
}

test("notice ai-runs:96 (R3, R4, R5, R36, R43): ai-runs' real dispatch reaches /run past the shape checks, with no secret on the wire, and this member's answer is relayed by its code", async () => {
  const d = await dispatched();
  assert.equal(d.bodies.length, 1, "dispatchMemberRun sent one POST /run");
  const body = d.bodies[0];
  assert.equal(body.run_id, "R1");
  assert.equal(body.store, "bio");
  assert.ok(body.account && typeof body.account === "object", "the account rides on the body");
  for (const f of SECRET_FIELDS) assert.ok(!(f in body.account), `R36: no '${f}' on the wire`);
  const a = d.answers[0];
  if (a.status >= 400) {
    assert.ok(!SHAPE_CODES.includes(a.body.code), `R3-R5 pass for ai-runs' body (answered ${a.body.code})`);
    assert.deepEqual(d.planeCalls, [], "R1-R8: no plane call before the checks pass");
    assert.equal(d.out.dispatch.state, "REFUSED");
    assert.equal(d.out.dispatch.reason, a.body.code, "R43: ai-runs relays this member's code unchanged");
  } else {
    assert.equal(a.status, 202);
    assert.equal(d.out.dispatch.state, "RUNNING", "R91 -> ai-runs R82: an accepted segment is RUNNING");
  }
});

test("notice ai-runs:96 (control, R5): the same body with its credential one character off is refused BAD_CREDENTIAL_SHAPE, no plane call", async () => {
  const d = await dispatched();
  const body = { ...d.bodies[0], credential: d.bodies[0].credential.slice(0, -1) + "G" };
  const res = await worker.fetch(new Request("https://agent-worker/run", { method: "POST", body: JSON.stringify(body) }), d.env);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "BAD_CREDENTIAL_SHAPE");
  assert.equal(d.planeCalls.length, 0);
});

test.todo("R6 (T53): the account ai-runs now dispatches ({account_id, provider, plan, means, entries, level, member, personal, disclosed}) is taken, and the segment is accepted 202 (rests on agent-model's T53 resolver and entryFor)");
