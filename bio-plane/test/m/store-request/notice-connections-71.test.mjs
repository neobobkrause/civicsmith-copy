/* store-request, notice connections:71 (PR 71: connections R65, R74-R77, the `named_in` kind and the neighbours read). Confirmed with no
   code change: this module reaches connections only through its world door's `linkproject` arm (connections' CONNECTIONS_OPS) and the
   store's `connections` read, and PR 71 changed neither. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";
import { CONNECTIONS_OPS } from "../../../src/connections/ops.mjs";

const resultOf = (a) => (a.json && a.json.result !== undefined ? a.json.result : a.json);

test("notice connections:71: the world's door still answers connections' arm and its read after PR 71", async () => {
  assert.deepEqual([...CONNECTIONS_OPS], ["linkproject"]);
  const w = await storeWorld();
  const me = await w.signIn("admin");
  /* the arm: a digest that is not 64 hex is connections' own NEED_CAPTURE, never WORLD_NO_DOOR_ARM */
  const bad = await w.door({ url: "/api/?op=linkproject&capture=nothex", init: { method: "POST" } }, me);
  assert.equal(bad.status, 400);
  assert.equal(resultOf(bad).reason, "NEED_CAPTURE");
  /* the read: a held file's connections are answered, the viewer stamped by the door (no VIEWER_MISSING) */
  const h = await w.recipes.hold(me, "Minutes", "the council met on a Tuesday");
  const read = resultOf(await w.door({ url: `/api/?op=connections&sha256=${h.sha}` }, me));
  assert.notEqual(read.ok, false, JSON.stringify(read).slice(0, 200));
  assert.equal(Array.isArray(read.connections), true);
});
