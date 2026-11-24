/* control-plane R136, R137 (K5046, K5052 (2); store-request R1, R15): THE WORLD'S DOOR AND THE REAL DOOR MAKE THE SAME STORE REQUEST.
   One op of each family of store-request R6 to R12 and R17 (a viewer read, a positional act, an act whose body carries a stamp, a promotion,
   a project creation, an op graded `publish`, the translation family's `by`), once through the Worker's door (`makeFetch` over the world's
   store) and once through the world's door (`store-request`'s `doorOf`): the store's request each makes (address, body, the internal headers)
   is equal. Both reach the one store by `world.send`; a spy on it sees each. Control: a stamp the caller sends in the address or the body
   reaches the store through neither door. The ops the real door answers by an arm of its own are the world's known differences (listed). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { worldAnswers } from "../store-request/door.mjs";
import { makeFetch } from "../../../src/control-plane/index.mjs";
import * as innerMod from "../../../src/store-request/index.mjs";

const SESSION_HEADER = innerMod.SESSION_HEADER, GRANT_HEADER = innerMod.GRANT_HEADER;
const FORGED = "member:mallory";
const norm = async (req) => {
  const isReq = typeof req.clone === "function";
  const u = new URL(isReq ? req.url : String(req.url), "http://x");
  const method = String(req.method || "GET").toUpperCase();
  const header = (k) => (isReq ? req.headers.get(k) : req.headers ? (req.headers[k] ?? null) : null);
  const raw = isReq ? (method === "GET" || method === "HEAD" ? "" : await req.clone().text()) : req.body;
  return { path: u.pathname, query: [...u.searchParams].sort(([a], [b]) => (a < b ? -1 : 1)), body: raw == null ? "" : String(raw),
           session: header(SESSION_HEADER), grant: header(GRANT_HEADER) };
};
/* the world's known differences from the real door: the ops a module's door arm answers (store-request R17 (5)) */
const ARM_OPS = new Set(["whoami", "affordances", "agentpack", "airundispatch", "textcheck", "readtranslate", "acquire", "unpack", "capture"]);

async function sides(w, as) {
  const seen = [];
  const send = w.send.bind(w);
  w.send = async (request) => { seen.push(await norm(request)); return send(request); };
  const realStub = { fetch: async (input, init) => w.send(input instanceof Request ? input : new Request(String(input), init)) };
  const env = { ...w.env, STORE: { idFromName: (n) => n, get: () => realStub } };
  const fetch = makeFetch({});
  const real = async (op, { method = "GET", query = {}, body } = {}) => {
    seen.length = 0;
    const u = new URL("https://plane.example/api");
    u.searchParams.set("op", op);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    await fetch(new Request(u, { method, headers: { authorization: `Bearer ${as.token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    return seen.filter((s) => s.path === `/${op}`);
  };
  const world = async (op, { method = "GET", query = {}, body } = {}) => {
    seen.length = 0;
    const url = `/api/?${new URLSearchParams({ op, ...query })}`;
    await w.door({ url, init: { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) } }, as);
    return seen.filter((s) => s.path === `/${op}`);
  };
  return { real, world };
}

const CASES = [
  ["list", { query: { viewer: FORGED } }],
  ["tasks", { query: { viewer: FORGED, by: FORGED } }],
  ["taskresolve", { method: "POST", body: { actor: FORGED, task: "t-1", resolution: "done" } }],
  ["projectrequests", { query: { by: FORGED } }],
  ["translationmark", { method: "POST", query: { by: FORGED }, body: { by: FORGED, direction: "x", language: "es", key: "k", mark: "ok" } }],
  ["publishcheck", { method: "POST", query: { author: FORGED }, body: { project: "prj-none" } }],
  ["promote", { method: "POST", query: { author: FORGED }, body: { base: null, snapKey: "20260101T000000Z_00c0ffee", author: FORGED, ownerMemberId: FORGED, actorMemberId: FORGED,
    meta: { object_type: "project", title: "Parity project", current_state: "forming", created: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z" },
    files: [{ path: "bundle.md", text: "---\nobject_type: project\ntitle: \"Parity project\"\ncurrent_state: forming\n---\n\nbody\n" }] } }],
];

test("R137 (R136; store-request R15): for one op of each family the store request the Worker's door makes equals the world's door's: address, body and the internal headers; a forged stamp reaches the store through neither", { timeout: 300000 }, async () => {
  const w = await storeWorld();
  const as = await w.signIn("admin");
  const { real, world } = await sides(w, as);
  for (const [op, spec] of CASES) {
    assert.equal(ARM_OPS.has(op), false, `${op} is compared, not a known difference`);
    const a = await real(op, spec), b = await world(op, spec);
    assert.equal(a.length, 1, `${op}: the real door makes one store request for the op, and the store receives it (R136)`);
    assert.deepEqual(a, b, `${op}: the two doors make the same store request`);
    for (const s of a) {
      assert.equal(s.query.some(([, v]) => v === FORGED), false, `${op}: a forged stamp in the address never reaches the store`);
      assert.equal(s.body.includes(FORGED), false, `${op}: a forged stamp in the body never reaches the store`);
    }
  }
});

test("R137 (control): the ops the compared set leaves out are the world's known differences: each is answered by a module's door arm (the world's `worldAnswers`), never guessed from the store request", () => {
  for (const op of ["whoami", "affordances", "agentpack", "airundispatch", "textcheck", "readtranslate", "capture"]) assert.equal(worldAnswers(op), true, `${op} is an arm the world re-makes`);
  for (const [op] of CASES) assert.equal(worldAnswers(op), false, `${op} is a store route: compared`);
});
