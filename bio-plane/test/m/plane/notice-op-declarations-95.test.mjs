/* Provider notice op-declarations:95 (PR 95: op-declarations R20, R24, R30, R41 restated for T53, ai-accounts R35).
   This module's use of op-declarations is one value: the gated hook (`door.mjs`' `gatedOp`, R6) hands `ACT_GATE` to the
   arms that decorate acts (affordances', the queue's). Confirmed with no code change: the hook holds no gate of its own,
   so whatever op-declarations now declares (T53's account acts in, the retired account-reference ops out) is what the
   acts a member is offered carry. Tested at this module's interface: an `affordances` call through the gated hook over a
   real assembled store answers every act decorated with exactly `ACT_GATE`'s `mode` and `needs` for its id; no op is
   listed here (K3268). Control: the same acts decorated with no gate carry nulls, so the equality is the hook's doing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { gatedOp } from "../../../src/plane/door.mjs";
import { ACT_GATE } from "../../../src/op-declarations/index.mjs";
import { decorate } from "../../../src/affordances.mjs";

async function affordances(x, cls, session) {
  const stub = { fetch: async (r) => x.s.fetch(r instanceof Request ? r : new Request(String(r))) };
  const env = { ...x.env, STORE: { idFromName: (n) => n, get: () => stub }, CAPTURES: { get: async () => null } };
  const url = new URL("http://x/api/?op=affordances");
  const res = await gatedOp({ req: new Request(url), url, env, op: "affordances", cls, viaSession: !!session,
    sessMember: session, sessViewer: session, sessIdentity: session, sessRights: [], sessCaps: ["contribute"],
    aiCred: null, storeName: "bio", stub });
  return { status: res.status, body: await res.json() };
}

test("notice op-declarations:95 (R6): the acts the gated hook's `affordances` answers are decorated by op-declarations' own ACT_GATE (mode and needs per id), the hook holding no gate of its own; control: undecorated, the same acts carry nulls", async () => {
  const x = await store();
  for (const [cls, session] of [["admin", null], ["member", "member:ann"]]) {
    const a = await affordances(x, cls, session);
    assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 400));
    const acts = a.body.result.catalog;
    assert.ok(Array.isArray(acts) && acts.length > 0, "the catalogue is answered");
    for (const act of acts) {
      assert.equal(act.mode, ACT_GATE.mode(act.id), `${cls} ${act.id} mode`);
      assert.equal(act.needs, ACT_GATE.needs(act.id), `${cls} ${act.id} needs`);
    }
    /* control: the gate is what sets them; decorated with none, every act's mode is null */
    assert.ok(acts.every((act) => decorate({ id: act.id, label: act.id }, null).mode === null));
    assert.ok(acts.some((act) => act.mode !== null), "at least one act carries the gate's mode");
  }
});
