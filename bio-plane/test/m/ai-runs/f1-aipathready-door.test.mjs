/* ai-runs F1 (coordinator 23:20; BOB 23:30, review of 5f487a65): `op=aipathready` through the assembled door (store-request's
   published `storeWorld()` over store-assembly's world), each account made by the member's own real act (`aiownadd`). The op
   is ai-runs' own declared read (DECLARED_OPS, reaching OPS through op-declarations R80), answered by its arm in aiRunsOps:
   with no path source registered it answers a declared read answer `{ok: true, state: "not_ready", ready: false}` (fail
   closed), never UNKNOWN_OP and never the store's "unknown op"; with a registered source answering ready it answers ready
   to the account's owner; a member who cannot see the account is answered not ready with no reason and the source is never
   asked for it; a request with no session is refused before the arm. Control: an undeclared op name still answers
   UNKNOWN_OP. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

const caps = { capabilities: ["contribute"] };
const KEY = "sk-ant-api03-" + "k".repeat(40);
const get = (op, query = {}) => ({ url: `/api/?${new URLSearchParams({ op, ...query })}` });

async function ready(as) {
  const d = await as.read("disclosureof", { query: { member: "member:" + as.member } });
  await as.act("disclosureshown", { body: { member: "member:" + as.member, version: d.version } });
  await as.act("reauth", { body: { password: as.password } });
}

test("F1 (BOB 23:30): op=aipathready is a declared read at the door — no source answers ok, ready false, state not_ready; a ready source answers ready to the account's owner; another member reading her account is answered not ready with no reason and the source is not asked; no session is refused; control: an undeclared op is UNKNOWN_OP", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann", caps);
  const bo = await w.signIn("bo", caps);
  await ready(ann); await ready(bo);
  const set = await ann.act("aiownadd", { body: { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: KEY } });
  assert.equal(set.ok, true, JSON.stringify(set).slice(0, 300));
  const q = { account_id: set.account_id, entry_id: "entry-1" };

  /* no source: a declared answer, not ready */
  const none = await w.door(get("aipathready", q), ann);
  assert.notEqual(none.json && none.json.reason, "UNKNOWN_OP", JSON.stringify(none.json).slice(0, 300));
  assert.notEqual(none.json && none.json.error, "unknown op");
  const n = await ann.read("aipathready", { query: q });
  assert.deepEqual([n.ok, n.state, n.ready, n.reason], [true, "not_ready", false, "unregistered"]);

  /* no pair named: not ready, the source never asked */
  const bare = await ann.read("aipathready");
  assert.deepEqual([bare.ok, bare.state, bare.ready, bare.reason], [true, "not_ready", false, "no_pair"]);

  /* a registered source answering ready (the plane's path source, which no module registers yet) */
  const asked = [];
  // fixtures-own: harness - the path source R97/R98's server side will register; none exists yet (a known gap)
  assert.equal(aiRunsOf(w.ctx).registerPathReady("plane", (a) => (asked.push(a.account_id), { state: "ok", reset_at: "2026-11-04T00:00:00Z" })).ok, true);
  const mine = await ann.read("aipathready", { query: q });
  assert.deepEqual([mine.ok, mine.state, mine.ready, mine.reason], [true, "ready", true, "ok"]);
  assert.deepEqual(asked, [set.account_id]);

  /* another member names ann's personal account: nothing about it is answered and the source is not asked */
  const theirs = await bo.read("aipathready", { query: q });
  assert.deepEqual(theirs, { ok: true, state: "not_ready", ready: false, reason: null, reset_at: null });
  assert.deepEqual(asked, [set.account_id], "the source was not asked for bo");

  /* no session: refused before the arm */
  const anon = await w.door(get("aipathready", q));
  assert.equal(anon.status, 401);

  /* control: a name no owner declares */
  const unknown = await w.door(get("aipathreadyx", q), ann);
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.reason, "UNKNOWN_OP");
});
