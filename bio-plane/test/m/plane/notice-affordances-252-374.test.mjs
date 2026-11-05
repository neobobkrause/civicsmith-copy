/* Provider notices affordances:252 (PR 252: the ops T53 retired are no longer held in ACT_HELP) and affordances:374
   (PR 374: `T53_STANDIN_OPS`, member ops an owner declares, held with the owner's own description until the word list
   gives their row). This module's use of affordances is one arm: the gated hook (`door.mjs`' `gatedOp`, R6) answers
   `op=affordances` by `affordancesOp`, handing it the stamps and ACT_GATE and nothing of its own. Confirmed with no code
   change: through the gated hook over a real assembled store, the answer's `act_help` is affordances' own ACT_HELP, key
   for key, so the retired ops it dropped are not offered and each of T53_STANDIN_OPS is explained (a non-empty text);
   the hook adds and removes no act's help. No op is listed here (K3268): the sets are the provider's exports. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { gatedOp } from "../../../src/plane/door.mjs";
import { ACT_HELP } from "../../../src/affordances.mjs";
import { ACT_HELP_OPS, T53_STANDIN_OPS } from "../../../src/affordances/act-help.mjs";

async function affordances(x, cls, session) {
  const stub = { fetch: async (r) => x.s.fetch(r instanceof Request ? r : new Request(String(r))) };
  const env = { ...x.env, STORE: { idFromName: (n) => n, get: () => stub }, CAPTURES: { get: async () => null } };
  const url = new URL("http://x/api/?op=affordances");
  const res = await gatedOp({ req: new Request(url), url, env, op: "affordances", cls, viaSession: !!session,
    sessMember: session, sessViewer: session, sessIdentity: session, sessRights: [], sessCaps: ["contribute"],
    aiCred: null, storeName: "bio", stub });
  return { status: res.status, body: await res.json() };
}

test("notices affordances:252 and affordances:374 (R6): the gated hook's affordances answer carries affordances' own ACT_HELP key for key, so every T53 stand-in op is explained and no op ACT_HELP no longer holds is; control: the hook adds no help of its own", async () => {
  const x = await store();
  assert.ok(T53_STANDIN_OPS.length > 0, "affordances holds at least one T53 stand-in op");
  for (const [cls, session] of [["admin", null], ["member", "member:ann"]]) {
    const a = await affordances(x, cls, session);
    assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 400));
    const help = a.body.result.act_help;
    assert.deepEqual(help, JSON.parse(JSON.stringify(ACT_HELP)), `${cls}: act_help is affordances' own`);
    for (const op of T53_STANDIN_OPS) {
      assert.ok(Object.hasOwn(help, op), `${cls}: ${op} is explained`);
      assert.equal(typeof help[op], "string");
      assert.ok(help[op].length > 0, `${cls}: ${op}'s text is not empty`);
    }
    /* control: every op the answer explains is one affordances holds; none is added by the hook */
    const held = new Set(Object.keys(ACT_HELP));
    for (const op of Object.keys(help)) assert.ok(held.has(op), `${cls}: ${op} is affordances'`);
    for (const op of T53_STANDIN_OPS) assert.ok(ACT_HELP_OPS.includes(op), `${op} is among the held ops`);
  }
});
