/* control-plane-store-request R29: no handler receives a caller-supplied value for any stamp. Driven for every op that declares
   a stamp (op-declarations' `OP_STAMPS`), through store-request's `innerRequest`, for each kind of caller admission admits over a
   world's real store (the founder's session, a member's, an organisation's ai credential, the three binding classes), with every
   stamp sent as a sentinel in the address and the body; and once through the real door (`makeFetch`), where the store sees the
   server's own values. Control: a parameter that is not a stamp reaches the store as the caller sent it. */
import "../../sandbox.mjs";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { storeWorld, WORLD_TOKENS } from "../store-request/fixtures.mjs";
import { innerRequest, QUERY_STAMPS, BODY_STAMPS } from "../../../src/store-request/index.mjs";
import { OPS, OP_STAMPS } from "../../../src/op-declarations/index.mjs";
import { world, call, opCalls } from "../control-plane/harness.mjs";

const SENTINEL = "R29-caller-stamp-sentinel";
/* where a handler reads each stamp: the address's (store-request R3: the query stamps, the op's declared ones, the digests) and
   the body's (R9: the body stamps, the digests, R23). Every one is forged in both places; each is checked where it is read. */
/* `bodyBy` is a declaration (store-request R10: the actor goes in the body's `by`), not a key */
const declared = (op) => (OP_STAMPS[op] || []).filter((k) => k !== "bodyBy");
const queryKeys = (op) => [...new Set([...QUERY_STAMPS, ...declared(op), "secretSha", "bySecret"])];
const bodyKeys = (op) => [...new Set([...queryKeys(op), ...BODY_STAMPS])];
const bodyRead = (op) => [...BODY_STAMPS, "secretSha", "bySecret", ...((OP_STAMPS[op] || []).includes("bodyBy") ? ["by"] : [])];
const STAMPED = Object.keys(OPS).filter((op) => (OP_STAMPS[op] || []).length > 0);

let C = {};
before(async () => {
  const w = await storeWorld();
  const founder = await w.signIn("admin");
  const ruth = await w.signIn("ruth", { capabilities: ["contribute"] });
  const minted = await w.door({ url: "/api/?op=aicredentialmint", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tokenId: "bot29", principalKind: "organisation", writes: [] }) } }, founder);
  C = { founder: await w.admitted(founder.token), member: await w.admitted(ruth.token), ai: await w.admitted(minted.json.result.token),
        admin: await w.admitted(WORLD_TOKENS.ADMIN_TOKEN), probe: await w.admitted(WORLD_TOKENS.PROBE_TOKEN),
        daemon: await w.admitted(WORLD_TOKENS.DAEMON_TOKEN, "monitor") };
});

test("R29: for every op that declares a stamp and every kind of caller, innerRequest's request to the store carries no caller-supplied stamp where a handler reads it: none in the address or the headers, no body stamp in the body", () => {
  assert.ok(STAMPED.length > 300, String(STAMPED.length));
  let made = 0;
  for (const [kind, caller] of Object.entries(C)) for (const op of STAMPED) {
    const forge = (keys) => Object.fromEntries(keys.map((k) => [k, SENTINEL]));
    const url = `http://h/api/?${new URLSearchParams({ op, ...forge(queryKeys(op)) })}`;
    const a = innerRequest({ op, url, method: "POST", body: JSON.stringify(forge(bodyKeys(op))), caller,
                             mint: { writes: [], confinedTo: null, secretSha: "d".repeat(64) } });
    if (a.refusal) continue;                       /* a refused request reaches no handler */
    made++;
    assert.equal(a.url.includes(SENTINEL), false, `${kind} ${op}: address ${a.url}`);
    const b = typeof a.body === "string" ? JSON.parse(a.body) : null;
    if (b && typeof b === "object") for (const k of bodyRead(op)) assert.notEqual(b[k], SENTINEL, `${kind} ${op}: body ${k}`);
    assert.equal(JSON.stringify(a.headers ?? {}).includes(SENTINEL), false, `${kind} ${op}: headers`);
  }
  assert.ok(made > STAMPED.length * 5, String(made));
});

test("R29 (through the real door): a member's forged stamps in the address and the body never reach the store; the store sees the server's own viewer; a non-stamp parameter passes (control)", async () => {
  const { env, S } = world();
  const forged = Object.fromEntries(QUERY_STAMPS.map((k) => [k, SENTINEL]));
  await call(env, { op: "index", token: S.ann, params: { limit: "5", ...forged }, method: "GET" });
  const [c] = opCalls(env);
  assert.equal(c.url.href.includes(SENTINEL), false, c.url.href);
  assert.equal(c.params.viewer, "member:ann");
  assert.equal(c.params.limit, "5");
});
