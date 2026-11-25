/* control-plane R49 (T51; K4230; case-inputs R24, R27): case-inputs' credential-free public read `casedetailspublic`, routed by its
   own name and as `op=publicread&name=` through public-read's door read, with no route of this module's. The public reads are
   read from case-inputs' own DECLARED_OPS, never a list typed here (K3268). Driven through `makeFetch(hooks)`, as R49's
   routing test is (`r49-routes.test.mjs`). */
import "./register-declared.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, refused, FORGED, QUERY_STAMPS } from "./harness.mjs";
const { DECLARED_OPS } = await import("../../../src/case-inputs/index.mjs");
const { publicReadDoorOp } = await import("../../../src/public-read/door.mjs");
const D = await import("../../../src/store-door/dispatch.mjs");

const { OPS } = O;
const U = new URL("http://do/");
/* case-inputs' own credential-free reads (its rows with `classes: null`, none of them acts) */
const PUBLIC_READS = Object.keys(DECLARED_OPS).filter((op) => DECLARED_OPS[op].classes === null && DECLARED_OPS[op].mutating === false);

/* The plane's public hook as plane/door.mjs calls public-read's door: without the control-plane's list, so a name is answered by
   that list alone, and `op=publicread&name=` by the door's own route. */
const hooks = { async publicOp({ op, url, env, stub }) {
  return (await publicReadDoorOp(op, url, env, stub, { json: M.json, requiredArgument: M.requiredArgument, storeSilent: M.storeSilent,
                                                storeRefusal: M.storeRefusal, doAnswer: M.doAnswer }))
    ?? M.json({ ok: true, publicOp: op });
} };

test("R49, R2, R26 (case-inputs R24; K4230): case-inputs' public read is declared credential-free, and is routed by its own name and as `op=publicread&name=` through public-read's door read to bio's store, with its declared parameter `case` passed and no credential or stamp", async () => {
  assert.deepEqual(PUBLIC_READS, ["casedetailspublic"], "case-inputs declares one public read");
  for (const op of PUBLIC_READS) {
    assert.equal(OPS[op]?.classes, null, `${op} is public`);
    assert.equal(OPS[op].mutating, false, op);
    assert.equal(Object.hasOwn(D.controlPlaneRoutes({}, U, null), op), false, `${op}: no route of this module's`);
  }
  const answer = (c) => (c.route === "publicread"
    ? new Response(JSON.stringify({ ok: true, result: { ok: true, read: c.params.name, module: "case-inputs", result: { held: true } } })) : null);
  const { env, S } = world({ answer });
  for (const name of PUBLIC_READS) for (const token of [undefined, S.ann, env.ADMIN_TOKEN, "junk"])
    for (const asked of [{ op: name, params: {} }, { op: "publicread", params: { name } }]) {
      env.calls.length = 0;
      const r = await call(env, { op: asked.op, token, hooks,
        params: { ...asked.params, case: "C1", viewer: FORGED, by: FORGED, author: FORGED } });
      assert.equal(r.status, 200, `${asked.op}/${name}: ${r.text.slice(0, 200)}`);
      assert.deepEqual([r.json.ok, r.json.read], [true, name]);
      /* admission R27: a presented live session is resolved once (a `session` lookup) before the one read */
      assert.deepEqual(env.calls.map((x) => x.route), [...(token === S.ann ? ["session"] : []), "publicread"], `${name}: one read`);
      const c = env.calls.at(-1);
      assert.deepEqual([c.route, c.ns, c.params.name, c.params.case], ["publicread", "bio", name, "C1"]);
      for (const k of ["token", ...QUERY_STAMPS]) assert.equal(c.params[k] ?? null, null, `${name}: ?${k} reaches the read`);
      env.calls.length = 0;
      refused(await call(env, { op: asked.op, token, hooks, params: { ...asked.params, store: "scratch" } }), 400, "NAMESPACE_PINNED", "C-78.2");
      assert.equal(env.calls.length, 0);
    }
  const unregistered = world({ answer: (c) => (c.route === "publicread"
    ? new Response(JSON.stringify({ ok: true, result: { ok: false, reason: "PUBLIC_READ_NOT_REGISTERED" } })) : null) });
  for (const op of PUBLIC_READS) assert.equal((await call(unregistered.env, { op, hooks, params: { case: "C1" } })).status, 404, op);
  const silent = world({ answer: (c) => (c.route === "publicread" ? new Response("not json") : null) });
  for (const op of PUBLIC_READS) refused(await call(silent.env, { op, hooks, params: { case: "C1" } }), 502, "STORE_DID_NOT_ANSWER", "C-69.2");
});

test("R49 (control; case-inputs R24): a member's read `casedetails` is not a public read: asked with no credential it is refused at admission, and no public read is asked for it", async () => {
  const { env } = world({ answer: (c) => (c.route === "publicread"
    ? new Response(JSON.stringify({ ok: true, result: { ok: true, read: c.params.name } })) : null) });
  const r = await call(env, { op: "casedetails", params: { case: "C1" }, hooks });
  assert.notEqual(r.status, 200, r.text.slice(0, 200));
  assert.equal(env.calls.some((c) => c.route === "publicread"), false, "no public read is asked for a member's read");
});
