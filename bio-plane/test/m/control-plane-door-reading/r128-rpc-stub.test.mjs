// Copied from control-plane's suite (test/m/control-plane/r128-rpc-stub.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R128 (K5131): the phase clock's wrapping of a binding keeps every method callable as the platform's own stub calls it. A non-`fetch` RPC method is called on
   the stub itself, never through `.apply` (on a workerd RPC stub `.apply` is a remote property, so the call became an RPC named `apply` carrying the stub and failed). The proof
   is at the platform's real shape: a Miniflare Durable Object with RPC methods, reached through the clocked environment from inside a worker. */
import "../../stdio.mjs";
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";

const CLOCK = fileURLToPath(new URL("../../../src/control-plane/phase-clock.mjs", import.meta.url));
const DOOR = fileURLToPath(new URL("../../../src/control-plane/index.mjs", import.meta.url));

const script = `
import { DurableObject } from "cloudflare:workers";
import { clockedEnv, makeClock, withClock } from ${JSON.stringify(CLOCK)};
export class Store extends DurableObject {
  async readtranslate(question, n) { return { op: "readtranslate", question, n, twice: n * 2 }; }
  async textcheck(text) { return text.toUpperCase(); }
  async fetch(request) { return new Response("object:" + new URL(request.url).pathname, { headers: { "server-timing": "object;dur=3" } }); }
}
export default {
  async fetch(request, env) {
    const clock = makeClock();
    return withClock(clock, async () => {
      const stub = clockedEnv(env, clock).STORE.get(env.STORE.idFromName("x"));
      try {
        const a = await stub.readtranslate("what is the budget?", 21);
        const b = await stub.textcheck("abc");
        const c = await (await stub.fetch("https://store/acquire")).text();
        return Response.json({ a, b, c });
      } catch (e) { return Response.json({ error: String(e && e.message || e) }, { status: 500 }); }
    });
  },
};`;

const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: "/test-worker.mjs", script,
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } },
});
after(async () => { await mf.dispose(); });

test("R128 (K5131): an RPC method called through the phase clock's wrapped stub answers, and fetch is still clocked", async () => {
  const res = await mf.dispatchFetch("http://plane.test/");
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.deepEqual(body.a, { op: "readtranslate", question: "what is the budget?", n: 21, twice: 42 });
  assert.equal(body.b, "ABC");
  assert.equal(body.c, "object:/acquire");
});

/* The walker's case (WALK-FINAL-09 R80, row `readtranslate`): the door itself, in workerd, asking the object's `draft` RPC method through the clocked environment. */
const doorScript = `
import { DurableObject } from "cloudflare:workers";
import * as M from ${JSON.stringify(DOOR)};
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });
export class Store extends DurableObject {
  async draft(ask) {
    return Response.json({ ok: true, op: ask.op, subject: ask.subject, language: ask.language, text: "translated", usage: null, calls: 0 });
  }
  async fetch(request) {
    const u = new URL(request.url), route = u.pathname.slice(1);
    if (route === "session") return ok({ session: { role: "member:ann", capabilities: ["contribute"], administer: false, rootOfTrust: false, handle: "ann" } });
    if (route === "reauthdue") return ok({ due: null });
    if (route === "doorwindow") return ok({ source: "src-test" });
    return ok({ ok: true, echo: route });
  }
}
const fetchDoor = M.makeFetch({
  async publicOp() { return undefined; },
  async gatedOp() { return undefined; },
});
export default { fetch: (request, env) => fetchDoor(request, env) };`;

const door = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: "/door-worker.mjs", script: doorScript,
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } },
  bindings: { ADMIN_TOKEN: "a".repeat(64), MEMBER_TOKEN: "b".repeat(64), PROBE_TOKEN: "c".repeat(64), DAEMON_TOKEN: "d".repeat(64), VERSION: "test" },
});
after(async () => { await door.dispose(); });

test("R128 (K5131): `op=readtranslate` through the door answers the object's draft, not PLANE_INTERNAL_ERROR", async () => {
  const res = await door.dispatchFetch("http://plane.test/api?op=readtranslate", {
    method: "POST", headers: { authorization: `Bearer ${"e".repeat(64)}`, "content-type": "application/json" },
    body: JSON.stringify({ subject: "note:1", language: "es" }),
  });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  assert.ok(!/PLANE_INTERNAL_ERROR/.test(text), text);
  assert.equal(JSON.parse(text).ok, true, text);
});
