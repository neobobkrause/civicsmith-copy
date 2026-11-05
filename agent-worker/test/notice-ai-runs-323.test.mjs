/* agent-worker over ai-runs PR 323 (ai-runs R97, F1; this module's R110). ai-runs added `AiRuns.pathReadyRead`
 * (op=aipathready), the plane's read of whether an AI path is ready, and dispatch reads the same source: with no path
 * source registered a member's dispatch is withheld `AI_PATH_NOT_READY` (reason `unregistered`, fail closed) and nothing
 * reaches this member's `POST /run`.
 *
 * Confirmed, no code change: this member makes no call to `pathReadyRead` and does not register a path source today
 * (R110, which makes this Worker the source the plane asks through `op=aipathready`, is R110's open T53 mark, resting on
 * `agent-model`'s `health`; a `test.todo` below, never a pin). What changes for this module is its tests' footing: the
 * dispatch in notice-ai-runs-96 reached `/run` only because ai-runs' test world stands in an `ok` source by default. That
 * test now registers its own source; this file asserts both sides through ai-runs' real code with `AGENT_WORKER` bound
 * to this member's real `fetch`: with a source answering `ok` the read is ready and the dispatch reaches `/run` (one POST,
 * answered by this member); control, with no source the dispatch reads the path not ready `unregistered` and is
 * withheld with no call to this member. */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";
import { world, OPEN, INQ } from "../../bio-plane/test/m/ai-runs/world.mjs";

async function dispatched({ source }) {
  const seen = { bodies: [], answers: [] };
  const env = { VERSION: "notice-ai-runs-323",
    PLANE: { fetch: async () => Response.json({ ok: false }, { status: 500 }) } };
  const AGENT_WORKER = { fetch: async (url, init) => {
    seen.bodies.push(JSON.parse(init.body));
    const res = await worker.fetch(new Request(url, init), env);
    const text = await res.text();
    seen.answers.push({ status: res.status, body: JSON.parse(text) });
    return new Response(text, { status: res.status, headers: res.headers });
  } };
  const w = world({ env: { AGENT_WORKER, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "2000" },
                    deployedModes: ["check"], pathReady: null });
  if (source) assert.equal(w.runs.registerPathReady("plane", source).ok, true);
  await w.group("ann", "bob", { noAccount: ["ann"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  const opened = await w.runs.open(OPEN({ mode: "check", principalPlane: "member:ann", principalAi: "member:ann",
                                          actor: "member:ann", viewer: "member:ann" }));
  assert.equal(opened.started, true, `ai-runs' world opened R1: ${JSON.stringify(opened).slice(0, 200)}`);
  const out = await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann" });
  const read = (pair) => w.runs.pathReadyRead({ viewer: "member:ann", ...pair });
  return { out, read, ...seen };
}

test("notice ai-runs:323 (R110 footing): with a registered path source answering ok, pathReadyRead reads ready and ai-runs' real dispatch reaches this member's /run once", async () => {
  const asked = [];
  const d = await dispatched({ source: (pair) => { asked.push(pair); return { state: "ok" }; } });
  assert.equal(d.bodies.length, 1, "dispatchMemberRun sent one POST /run");
  const { account_id, entry_id } = d.bodies[0].account;
  assert.deepEqual(asked, [{ account_id, entry_id }], "the dispatch asked the source for the account and entry it sent");
  const read = await d.read({ account_id, entry_id });
  assert.deepEqual([read.ready, read.reason], [true, "ok"], JSON.stringify(read));
  assert.equal(d.answers.length, 1, "this member answered it");
  assert.notEqual(d.out.dispatch.withheld, "AI_PATH_NOT_READY");
});

test("notice ai-runs:323 (control, F1 fail closed): with no path source the dispatch reads the path not ready 'unregistered' and is withheld AI_PATH_NOT_READY with no call to this member", async () => {
  const d = await dispatched({ source: null });
  assert.equal(d.out.dispatched, false);
  assert.equal(d.out.dispatch.withheld, "AI_PATH_NOT_READY");
  assert.equal(d.out.dispatch.reason, "AI_PATH_NOT_READY unregistered");
  assert.equal(d.bodies.length, 0, "nothing reaches agent-worker's /run");
});

test.todo("R110 (T53): this Worker is the path source the plane reads through op=aipathready, answering agent-model's health(account, entry) as ready or the not-ready reason (rests on agent-model's T53 health)");
