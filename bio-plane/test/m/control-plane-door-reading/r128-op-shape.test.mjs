// Copied from control-plane's suite (test/m/control-plane/r128-op-shape.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R128 (fix round 9, P24; K4855, R-LOG): the door's Server-Timing names the SHAPE of the op asked (`shape;desc=f<n>:l<limit>`: how many fields, which limit), never
   its content: no field name, no value, no address. A request naming neither states nothing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeClock } from "../../../src/control-plane/phase-clock.mjs";
import { world, call } from "../control-plane/harness.mjs";

const fixed = () => { let t = 1000; return () => (t += 1); };
const shapeOf = (header) => (header || "").split(",").map((m) => m.trim()).find((e) => e.startsWith("shape;"));

test("R128 (P24): a request naming fields and a limit states their count and number, and no name", () => {
  const c = makeClock(fixed());
  c.shape(new URLSearchParams("op=list&fields=title,state,secretfield&limit=50"));
  const s = shapeOf(c.header("list"));
  assert.equal(s, "shape;dur=0;desc=f3:l50");
  assert.equal(c.header("list").includes("secretfield"), false, "no field name is stated");
});

test("R128 (P24): fields alone, a limit alone, and neither (control: nothing stated); a limit that is no whole number is dropped", () => {
  const of = (q) => { const c = makeClock(fixed()); c.shape(new URLSearchParams(q)); return shapeOf(c.header("x")); };
  assert.equal(of("fields=a,b"), "shape;dur=0;desc=f2");
  assert.equal(of("limit=7"), "shape;dur=0;desc=l7");
  assert.equal(of("op=list&q=anything"), undefined);
  assert.equal(of("limit=7;drop"), undefined);
  assert.equal(of("limit=-1"), undefined);
  assert.equal(of("fields=,,"), "shape;dur=0;desc=f0");
});

test("R128 (P24): at the door the answer's Server-Timing names the op's shape", async () => {
  const w = world({ answer: () => null });
  const r = await call(w.env, { op: "list", token: w.S.ann, params: { limit: "25", fields: "title,state" } });
  const header = r.headers?.get?.("server-timing") ?? r.res?.headers?.get?.("server-timing") ?? "";
  assert.ok(/shape;dur=0;desc=f2:l25/.test(header), `Server-Timing: ${header}`);
});
