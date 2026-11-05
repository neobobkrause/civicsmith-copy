/* ai-runs F1 (coordinator 23:20; R97, R95): a missing health source reads not ready (fail closed). With no path source
   registered (`registerPathReady`), a member's dispatch is withheld AI_PATH_NOT_READY with no call to the agent-worker
   binding, the run left resumable, and the path read `pathReadyRead` (op=aipathready) answers not ready. A source's state
   outside the closed set reads `unknown`, and a reset_at that is no instant is dropped.
   Control: once a source answering `ok` is registered, the same dispatch goes out and the read answers ready. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, PROJ, T0, ENTRIES, agentWorker } from "./world.mjs";

const ACCEPT = { status: 202, body: { accepted: true, run_id: "R1" } };
const STORE = { idFromName: (n) => `id:${n}` };
const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const at = (m) => new Date(Date.parse(T0) + m * 60000).toISOString().replace(/\.\d+Z$/, "Z");

async function bareWorld() {
  const aw = agentWorker(ACCEPT);
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50" }, pathReady: null });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.account("ann", "apikey", "secret-0-of-ann-0123456789", { entries: [ENTRIES.a] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann");
  const o = await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, at: T0, ...ANN }));
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  return { w, aw };
}

test("F1 (coordinator 23:20; R97): with no path source registered the path reads not ready — a member's dispatch is withheld AI_PATH_NOT_READY with no call, the run resumable, and pathReadyRead answers not_ready; control: a source answering ok dispatches and reads ready", async () => {
  const { w, aw } = await bareWorld();
  const account_id = w.accountsOf("member:ann")[0];
  const entry_id = ENTRIES.a;
  const read = (q) => w.runs.pathReadyRead({ viewer: "member:ann", ...q });
  assert.deepEqual(await read({ account_id, entry_id }), { ok: true, state: "not_ready", ready: false, reason: "unregistered", reset_at: null });
  const before = w.rows(`SELECT detail FROM observation_log WHERE authority = 'R1' ORDER BY seq`).length;
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(1) });
  assert.deepEqual([r.dispatched, r.dispatch.withheld], [false, "AI_PATH_NOT_READY"]);
  assert.equal(aw.calls.length, 0, "nothing reaches the agent-worker binding");
  const added = w.rows(`SELECT detail FROM observation_log WHERE authority = 'R1' ORDER BY seq`).slice(before);
  assert.equal(added.length, 1);
  assert.match(added[0].detail, /still resumable/);
  assert.equal((await w.runs.read({ run: "R1", viewer: "member:ann" })).session.status, "running", "the run stays resumable");
  /* a malformed read answers not ready, never ready */
  assert.deepEqual(await read({}), { ok: true, state: "not_ready", ready: false, reason: "no_pair", reset_at: null });

  /* control: a registered source answering ok */
  const said = { state: "ok" };
  assert.equal(w.runs.registerPathReady("plane", () => said).ok, true);
  assert.deepEqual(await read({ account_id, entry_id }), { ok: true, state: "ready", ready: true, reason: "ok", reset_at: null });
  /* a state outside the closed set, and a reset_at that is no instant, are never passed out */
  said.state = "x".repeat(500); said.reset_at = "soon <b>";
  assert.deepEqual(await read({ account_id, entry_id }), { ok: true, state: "not_ready", ready: false, reason: "unknown", reset_at: null });
  said.state = "ok"; delete said.reset_at;
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: at(2) })).dispatched, true);
  assert.equal(aw.calls.length, 1);
});
