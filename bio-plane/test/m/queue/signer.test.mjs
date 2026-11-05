/* N375 at queue's interface, over a stubbed `queue-producers.feedItems` (its R8, R14): the self-registered key's
   OBLIGATION passes the mint (R1, R11), names the door it leaves by (R12), and is never muted (R19, R26, R31). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";

const signer = (key) => ({ id: `OBLIGATION::signer-self-registered::${key}`, class: "OBLIGATION", kind: "signer-self-registered",
  subject: { kind: "member", id: key }, summary: "a key", detail: null,
  basis: { source: "credentials.signerList", keys: [{ key_b64: key, comment: null, added: iso(NOW - 1000) }], keys_more: 0, detail: "d" },
  age: { state: "determined", since: iso(NOW - 1000), ms: 1000 }, assignee: null, assignee_role: null,
  options: [{ id: "signerset", label: "revoke", key }, { id: "signerknown", label: "known", key }] });

function withSigner() {
  const w = world({ producers: { feedItems: (a) => ({ items: [{ ...signer("K1"), case: a.homesOf([]) }],
    facts: { objective_gap: { bound: 50, truncated: false }, unattributed: { count: 0, inquiries: [] },
             contradiction: { bound: 50, truncated: false }, dispositions: [] } }) } });
  w.member("alice"); w.bundle("INQ-1", "inquiry");
  return w;
}

test("R1, R11, R12: a signer-self-registered OBLIGATION passes the mint and names op=signerset as its door, never taskresolve", () => {
  const w = withSigner();
  const f = w.feed(null, "class:admin");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const d = byId(f)["OBLIGATION::signer-self-registered::K1"].disposition;
  assert.deepEqual([d.available, d.instead], [true, ["signerset", "signerknown"]], "R97: the revoke leads");
  assert.match(d.detail, /op=signerset/);
  assert.equal(f.counts.obligation, 1);
});

test("R19, R26, R31: a signer-self-registered obligation is refused KIND_NOT_PERSONAL by kind and by id, and no row suppresses it", () => {
  const w = withSigner();
  for (const r of [w.q.queueMute({ member: "alice", viewer: "member:alice", case: "INQ-1", kinds: ["signer-self-registered"] }),
                   w.q.queueMute({ member: "alice", viewer: "member:alice", item: "OBLIGATION::signer-self-registered::K1" })])
    assert.deepEqual([r.reason, r.kind_class, r.check], ["KIND_NOT_PERSONAL", "OBLIGATION", "C-33.27"]);
  w.run(`INSERT INTO queue_item_mutes (member_id, item_id, item_class, muted_at) VALUES ('alice','OBLIGATION::signer-self-registered::K1','OBLIGATION',?)`, iso(NOW));
  const f = w.feed("alice");
  assert.deepEqual(f.items.map((i) => i.id), ["OBLIGATION::signer-self-registered::K1"]);
  assert.equal(f.mute.suppressed.length, 0);
});

test("R96: a signer-self-registered item's disposition is available and offers signerknown, its door still signerset", () => {
  const w = withSigner();
  const f = w.feed(null, "class:admin");
  const d = byId(f)["OBLIGATION::signer-self-registered::K1"].disposition;
  assert.deepEqual([d.available, d.acts, d.instead[0]], [true, ["signerknown"], "signerset"]);
  assert.deepEqual([d.scope, d.requires, d.keys], ["key", ["keyB64"], [{ key_b64: "K1", acts: ["signerknown"], instead: "signerset" }]]);
  /* control: every other OBLIGATION's disposition is unchanged, and the bridge still names the door */
  const bridge = w.q.proposeDispose({ key: "OBLIGATION::signer-self-registered::K1", state: "dismissed", reason: "r", decidedBy: "alice", viewer: "member:alice" });
  assert.deepEqual([bridge.reason, bridge.instead], ["CLASS_NOT_DISPOSED", ["signerset", "signerknown"]]);
});

test("R96: the walker's case through the real acts: a member registers a key, an administrator says they know it, the item is gone", () => {
  const w = world();
  w.member("ada", { role: "admin" }); w.member("cy", { role: "admin" }); w.member("kim");
  assert.equal(w.credentials.signerRegisterOwn({ keyB64: "AAAAkimkey", comment: "laptop", by: "kim" }).ok, true);
  const before = byId(w.feed("ada"))["OBLIGATION::signer-self-registered::kim"];
  assert.ok(before, "the item is minted for an administrator");
  assert.deepEqual([before.disposition.available, before.disposition.acts], [true, ["signerknown"]]);
  assert.equal(w.credentials.signerKnown({ keyB64: "AAAAkimkey", viewer: "member:ada" }).ok, true);
  for (const m of ["ada", "cy"]) assert.equal(byId(w.feed(m))["OBLIGATION::signer-self-registered::kim"], undefined);
  /* control: a second self-registered key still mints one (queue-producers R56: one item per member) */
  w.credentials.signerRegisterOwn({ keyB64: "AAAAkimtwo", by: "kim" });
  assert.ok(byId(w.feed("ada"))["OBLIGATION::signer-self-registered::kim"]);
});
