/* R97 (T53; DEC-462; queue-producers R56; credentials R7, R83): a signing-key item passes a choice of act through for each key it
   lists. Over the real credentials and the real queue-producers (the world's), with the control plane's decoration
   (`queueAnswer`, R17): `disposition.keys` is one entry per `basis.keys` entry in its order, `options` two per listed key, each
   carrying its own key; an act on one key leaves the others; the last clears the item; the bridge names both doors. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId } from "./world.mjs";
import { queueAnswer } from "../../../src/queue/index.mjs";

const ID = "OBLIGATION::signer-self-registered::kim";
const KEYS = ["AAAAkimone", "AAAAkimtwo", "AAAAkimthree"];
const gate = { needs: () => null, mode: () => "session" };

function setup(keys = KEYS) {
  const w = world();
  w.member("ada", { role: "admin" }); w.member("cy", { role: "admin" }); w.member("kim");
  for (const [n, k] of keys.entries()) {
    const r = w.credentials.signerRegisterOwn({ keyB64: k, comment: `device ${n}`, by: "kim" });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  return w;
}
const decorated = (w, m) => queueAnswer(w.feed(m), { gate }).result;
const item = (w, m = "ada") => byId(decorated(w, m))[ID];
const pairs = (it) => it.options.map((o) => [o.id, o.key]);

test("R97: three listed keys give three disposition entries in basis.keys order and six options, each pair carrying its own key", () => {
  const w = setup();
  const it = item(w);
  assert.ok(it, "the item is minted for an administrator");
  const listed = it.basis.keys.map((k) => k.key_b64);
  assert.deepEqual([...listed].sort(), [...KEYS].sort(), "every key is listed once (in the producer's order, earliest added first)");
  const d = it.disposition;
  assert.deepEqual([d.available, d.scope, d.requires, d.acts], [true, "key", ["keyB64"], ["signerknown"]]);
  assert.deepEqual(d.keys, listed.map((k) => ({ key_b64: k, acts: ["signerknown"], instead: "signerset" })));
  assert.deepEqual(pairs(it), listed.flatMap((k) => [["signerset", k], ["signerknown", k]]));
  assert.ok(it.options.filter((o) => o.id === "signerset").every((o) => o.to === "revoked"), "the revoke is to revoked");
  assert.ok(it.options.every((o) => "needs" in o && "mode" in o), "each entry is decorated (R17)");
  // control: no entry carries a key that is not listed
  assert.ok(it.options.every((o) => listed.includes(o.key)));
});

test("R97: signerknown on the second key leaves the first and third unchanged; the last two acts clear the item", () => {
  const w = setup();
  const K = item(w).basis.keys.map((k) => k.key_b64);
  assert.equal(w.credentials.signerKnown({ keyB64: K[1], viewer: "member:ada" }).ok, true);
  for (const m of ["ada", "cy"]) {
    const it = item(w, m);
    assert.deepEqual(it.disposition.keys.map((k) => k.key_b64), [K[0], K[2]]);
    assert.deepEqual(pairs(it), [["signerset", K[0]], ["signerknown", K[0]], ["signerset", K[2]], ["signerknown", K[2]]]);
  }
  assert.equal(w.credentials.signerSet({ keyB64: K[0], status: "revoked", by: "ada" }).ok, true);
  assert.deepEqual(item(w).disposition.keys.map((k) => k.key_b64), [K[2]]);
  assert.equal(w.credentials.signerKnown({ keyB64: K[2], viewer: "member:cy" }).ok, true);
  for (const m of ["ada", "cy"]) assert.equal(item(w, m), undefined, "the last key's act clears the item");
});

test("R97 control: the registrant and a member who is not an administrator are offered no entry; muting is KIND_NOT_PERSONAL; the bridge names both doors; a set act never resolves it", () => {
  const w = setup();
  for (const m of ["kim"]) assert.equal(item(w, m), undefined, "a viewer without the acts is offered none");
  w.member("lee");
  assert.equal(item(w, "lee"), undefined);
  const mute = w.q.queueMute({ member: "ada", viewer: "member:ada", item: ID });
  assert.equal(mute.reason, "KIND_NOT_PERSONAL");
  const bridge = w.q.proposeDispose({ key: ID, state: "dismissed", reason: "r", decidedBy: "ada", viewer: "member:ada", identity: "member:ada" });
  assert.deepEqual([bridge.reason, bridge.instead], ["CLASS_NOT_DISPOSED", ["signerset", "signerknown"]]);
  const set = w.q.proposeDispose({ items: [{ key: ID }], to: "dismissed", reason: "r", decidedBy: "ada", viewer: "member:ada", identity: "member:ada" });
  assert.equal(set.applied, 0);
  assert.equal(item(w).disposition.keys.length, 3, "the item and its keys stay");
});

test("R97: 21 keys list 20 entries and no entry for the 21st, which basis.keys_more counts", () => {
  const keys = Array.from({ length: 21 }, (_, i) => `AAAAkim${String(i).padStart(2, "0")}`);
  const w = setup(keys);
  const it = item(w);
  assert.equal(it.basis.keys_more, 1);
  const listed = it.basis.keys.map((k) => k.key_b64);
  assert.equal(listed.length, 20);
  assert.deepEqual(it.disposition.keys.map((k) => k.key_b64), listed);
  assert.equal(it.options.length, 40);
  const unlisted = keys.filter((k) => !listed.includes(k));
  assert.equal(unlisted.length, 1);
  assert.ok(!it.options.some((o) => o.key === unlisted[0]), "the 21st has no entry");
});
