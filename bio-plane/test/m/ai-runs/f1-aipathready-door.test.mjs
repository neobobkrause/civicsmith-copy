/* ai-runs F1 (coordinator 23:20; BOB 23:30): `op=aipathready` through the assembled door (store-request's published
   `storeWorld()` over store-assembly's world). The op is ai-runs' own declared read (DECLARED_OPS, reaching OPS through
   op-declarations R80), answered by its arm in aiRunsOps: with no path source registered it answers a declared read answer
   `{ok: true, state: "not_ready", ready: false}` (fail closed), never UNKNOWN_OP and never the store's "unknown op"; with a
   registered source answering ready it answers ready. Control: an undeclared op name still answers UNKNOWN_OP. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

const resultOf = (a) => (a.json && a.json.result !== undefined ? a.json.result : a.json);
const get = (op, query = {}) => ({ url: `/api/?${new URLSearchParams({ op, ...query })}` });

test("F1 (BOB 23:30): op=aipathready is a declared read at the door — with no source it answers ok with ready false and state not_ready; with a source answering ready it answers ready true; control: an undeclared op is UNKNOWN_OP", async () => {
  const w = await storeWorld();
  const as = await w.signIn("admin");
  const q = { account_id: "acct-1", entry_id: "entry-1" };

  const none = await w.door(get("aipathready", q), as);
  assert.notEqual(none.json && none.json.reason, "UNKNOWN_OP", JSON.stringify(none.json).slice(0, 300));
  assert.notEqual(none.json && none.json.error, "unknown op");
  const n = resultOf(none);
  assert.equal(n.ok, true, JSON.stringify(none.json).slice(0, 300));
  assert.deepEqual([n.state, n.ready], ["not_ready", false]);

  /* the frame's question names no pair: still not ready with no source */
  const bare = resultOf(await w.door(get("aipathready"), as));
  assert.deepEqual([bare.ok, bare.state, bare.ready], [true, "not_ready", false]);

  /* a registered source answering ready (the plane's op=aipathready source, which no module registers yet) */
  // fixtures-own: harness - the path source R97/R98's server side will register; none exists yet (a known gap)
  assert.equal(aiRunsOf(w.ctx).registerPathReady("plane", () => ({ state: "ok" })).ok, true);
  const ready = resultOf(await w.door(get("aipathready", q), as));
  assert.deepEqual([ready.ok, ready.state, ready.ready], [true, "ready", true]);

  /* control: a name no owner declares */
  const unknown = await w.door(get("aipathreadyx", q), as);
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.reason, "UNKNOWN_OP");
});
