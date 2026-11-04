/* store-request, notice membership:77 (PR 77: membership R154, the delegates adminProposalCancel and adminRemovals and their ops).
   Confirmed with no code change: the world's door reaches both ops as membership answers them, stamped by the admitted caller. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";

const resultOf = (a) => (a.json && a.json.result !== undefined ? a.json.result : a.json);

test("notice membership:77: adminremovals and adminproposalcancel answer through the world's door, as membership's ops", async () => {
  const w = await storeWorld();
  const founder = await w.signIn("admin");
  const removals = resultOf(await w.door({ url: "/api/?op=adminremovals" }, founder));
  assert.equal(removals.ok, true, JSON.stringify(removals).slice(0, 200));
  assert.equal(Array.isArray(removals.removals), true);
  const cancel = resultOf(await w.door({ url: "/api/?op=adminproposalcancel", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId: "nobody" }) } }, founder));
  assert.equal(cancel.ok, false);
  assert.equal(cancel.code || cancel.reason, "NO_SUCH_MEMBER");
});
