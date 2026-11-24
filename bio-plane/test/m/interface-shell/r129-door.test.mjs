/* interface-shell R129 (K5046 (d); store-request R18): `boot({door})` answers every op the test's own `plane` table does not, and with a
   door the default frame table is not consulted: the world answers `whoami`, `groupidentity` and the rest itself. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, FRAME } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";
import { storeWorld } from "./world.mjs";

/* the ops the default frame table answers when no door is given */
const FRAME_OPS = Object.keys(FRAME).filter((op) => op !== "version");

test("R129 a boot with a recording door sends it every op the plane table does not answer, and none to the frame table; the world answers the frame's reads", async () => {
  const world = await storeWorld();
  const rosa = await world.signIn("rosa", { admin: true });
  const { door, session } = world.boot(rosa);
  const asked = [];
  const p = await boot({ screens: ALL, session, path: "/app/held", plane: { heldcaptures: ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] }) },
    door: async (req) => { asked.push(req.op); return door(req); } });
  assert.ok(asked.includes("whoami"), "whoami is the door's");
  assert.ok(!asked.includes("heldcaptures"), "the plane table's own entry answers first");
  for (const op of ["whoami", "groupidentity"]) assert.ok(asked.includes(op), op);
  assert.equal(p.root().querySelector("#cs-main").getAttribute("data-screen"), "held");
  /* the answers are the world's: its team (`world-town`), not the frame table's `river-town`, and its member, not the frame's `mai` */
  assert.ok(!p.html.includes("River Town") && !p.root().textContent.includes("River Town"));
  const mine = asked.filter((op) => FRAME_OPS.includes(op));
  assert.ok(mine.length >= 2, "the frame's reads went to the door: " + mine);
  /* control: with no door the frame table answers as before, the plane table's entry first */
  const bare = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  assert.equal(bare.byOp("whoami").length, 1);
  assert.equal(bare.root().querySelector("#cs-main").getAttribute("data-screen"), "held");
});
