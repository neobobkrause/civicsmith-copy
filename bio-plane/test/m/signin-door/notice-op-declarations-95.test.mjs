/* signin-door, notice op-declarations:95 (PR 95: op-declarations R20, R24, R30, R41 restated for T53, `ai-accounts` R35):
   the member's own `subscriptiondisconnect` and the account-reference ops are retired with no alias, no spec. This door
   served and mapped `subscriptiondisconnect` (it asked the store's route and named the caller a leaver to sign out); it now
   asks no retired route and names no leaver for a retired op. Driven against op-declarations' REAL `OPS`, never a list
   copied here (K3268). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { leaverOf, subscriptionDisconnect, STORE_ROUTES } from "../../../src/signin-door/index.mjs";

const ANN = "member:ann";
/* the op PR 95 retired (op-declarations R30), as this notice names it */
const RETIRED_DISCONNECT = "subscriptiondisconnect";
const ok = { ok: true, disconnected: true, removed: true, memberId: "bea" };

test("notice op-declarations:95: the op the door retires is one op-declarations no longer declares, and no op the door names a leaver for is undeclared", () => {
  assert.equal(Object.hasOwn(OPS, RETIRED_DISCONNECT), false, "op-declarations R30 retires subscriptiondisconnect");
  assert.equal(leaverOf(RETIRED_DISCONNECT, {}, ok, ANN), null, "the retired op names no leaver");
  /* control: the acts that still sign a leaver out are declared, and still name the leaver */
  for (const [op, asked] of [["memberset", { memberId: "bea", status: "revoked" }], ["adminremove", { memberId: "bea" }]]) {
    assert.equal(Object.hasOwn(OPS, op), true, op);
    assert.equal(leaverOf(op, asked, ok, "admin"), "member:bea", op);
  }
});

test("notice op-declarations:95: the door asks no route op-declarations retired: `subscriptionDisconnect` asks no store and sends nothing, and no store route of the door is a retired op", async () => {
  const asked = [], sent = [];
  const store = async (path) => { asked.push(path); return { answered: true, result: { ok: true, disconnected: true }, reply: { status: 200, body: { ok: true } } }; };
  const env = { AGENT_WORKER: { fetch: async (url, init) => { sent.push(init?.body); return new Response("{\"ok\":true}"); } } };
  const out = await subscriptionDisconnect({ env, member: ANN, store });
  assert.deepEqual([asked, sent], [[], []]);
  assert.deepEqual([out.answered, out.refused, out.reply.status, out.reply.body.error],
                   [false, true, 400, `unknown op: ${RETIRED_DISCONNECT}`]);
  for (const route of Object.values(STORE_ROUTES)) assert.notEqual(route, RETIRED_DISCONNECT, route);
});
