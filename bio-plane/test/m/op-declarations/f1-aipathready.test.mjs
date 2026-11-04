/* op-declarations F1 (walk p3dev-t1, 4 Nov; coordinator 23:00; BOB 23:39): the frame's `op=aipathready` (interface-shell R20),
   a read act by surface-declarations R15, is declared and answered, never UNKNOWN_OP. ai-runs declares it in its own
   DECLARED_OPS (reaching OPS through R80) and serves it from its map; this module's share is the spec as the plane composes
   it, its session set, and R34's ground (a read, until affordances' ACT_HELP holds a text). Through the assembled door
   (store-request's published `storeWorld()`), the frame's ask as it sends it (no account named, before any path source is
   registered) is a declared read answer that reads not ready, never a fabricated ready. Control: an undeclared name still
   answers UNKNOWN_OP. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { OPS, SESSION_OPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";

const caps = { capabilities: ["contribute"] };
const get = (op, query = {}) => ({ url: `/api/?${new URLSearchParams({ op, ...query })}` });
const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

test("F1: aipathready is a declared read for a member's session, refused to a machine, under R34's read ground (control: an undeclared name has no spec)", () => {
  const spec = OPS.aipathready;
  assert.ok(spec, "aipathready has no spec");
  assert.equal(spec.mutating, false);
  assert.deepEqual([...spec.classes].sort(), ["admin", "member"]);
  assert.deepEqual([...spec.machineClasses], []);
  assert.ok(SESSION_OPS.member.has("aipathready"));
  if (!explained("aipathready")) assert.deepEqual(grounds("aipathready"), ["read"]);
  assert.equal(Object.hasOwn(OPS, "aipathreadyx"), false);
});

test("F1: the frame's ask of aipathready through the assembled door gets a declared answer, not UNKNOWN_OP, and with no source it reads not ready (control: an undeclared name answers UNKNOWN_OP)", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann", caps);
  const asked = await w.door(get("aipathready"), ann);
  assert.notEqual(asked.json && asked.json.reason, "UNKNOWN_OP", JSON.stringify(asked.json).slice(0, 300));
  assert.notEqual(asked.json && asked.json.error, "unknown op");
  const n = await ann.read("aipathready");
  assert.equal(n.ok, true, JSON.stringify(n).slice(0, 300));
  assert.equal(n.state, "not_ready");
  assert.notEqual(n.ready, true);

  const unknown = await w.door(get("aipathreadyx"), ann);
  assert.equal(unknown.status, 400);
  assert.equal(unknown.json.reason, "UNKNOWN_OP");
});
