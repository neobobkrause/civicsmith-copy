/* T9's share beyond R78 (K285): R25 the revocation notice (N123), R26 `listenerRefusal` (N202, moved from promotion), R47
   the bounds on R8's history and R15's pairings (N70; was R82's half, T38: the deciders' bound is `project-roster` R7's).
   (R80 `inSight` is `membership`'s.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { Members, listenerRefusal, MODULE_ORDER } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;
import { readFile } from "node:fs/promises";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";

test("R25 R26 onRevoked: registered once per module; malformed and second registrations refused by R26, nothing registered", async () => {
  const w = world();
  for (const [module, fn] of [[null, () => {}], ["", () => {}], [7, () => {}], ["capture-sources", null],
                              ["capture-sources", "fn"], [undefined, undefined]]) {
    const r = w.m.onRevoked(module, fn);
    assert.deepEqual([r.ok, r.reason, r.code], [false, "LISTENER_MALFORMED", "LISTENER_MALFORMED"], JSON.stringify(module));
    assert.equal(typeof r.detail, "string");
  }
  for (const [module, fn] of [[null, () => {}], ["capture-sources", null]])
    assert.deepEqual(w.m.onRevoked(module, fn), listenerRefusal([], module, fn), "R81's answer");
  assert.deepEqual(w.m.onRevoked("capture-sources", () => {}), { ok: true, module: "capture-sources" });
  assert.deepEqual(w.m.onRevoked("capture-sources", () => {}), listenerRefusal([{ module: "capture-sources" }], "capture-sources", () => {}));
  const again = w.m.onRevoked("capture-sources", () => {});
  assert.deepEqual([again.ok, again.reason, again.code, again.module], [false, "LISTENER_DECLARED", "LISTENER_DECLARED",
    "capture-sources"]);
  assert.deepEqual(w.m.onRevoked("another", () => {}).ok, true);
});

test("R25 a revocation (R16) notifies every listener once, inside the act, after its writes; nothing else notifies", async () => {
  const w = await world().group("ann", "bob");
  const heard = [];
  const seen = [];
  w.m.onRevoked("capture-sources", (n) => {
    heard.push(["capture-sources", n]);
    // after the act's writes: the member is revoked when the listener runs
    seen.push([w.m.memberFacts(n.memberId).status, w.m.sessionRights(`member:${n.memberId}`).capabilities.length]);
  });
  w.m.onRevoked("second-module", (n) => { heard.push(["second-module", n]); });
  const r = w.m.memberSet({ memberId: "ann", status: "revoked", by: "second" });
  assert.equal(r.ok, true);
  assert.deepEqual(heard.map(([mod, n]) => [mod, n.memberId, n.by]), [["capture-sources", "ann", "second"], ["second-module", "ann", "second"]],
    "once per listener, in MODULE_ORDER (an unknown module last)");
  assert.match(heard[0][1].at, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(Object.keys(heard[0][1]).sort(), ["at", "by", "memberId"]);
  assert.deepEqual(seen, [["revoked", 0]]);
  // no notice: a revoked member revoked again, a reactivation, a refused revocation, an unrelated act
  heard.length = 0;
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  w.m.memberSet({ memberId: "ann", status: "active", by: "admin" });
  w.m.memberSet({ memberId: "second", status: "revoked", by: "admin" });            // ADMIN_REQUIRES_VOTE
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "bob" });                 // NOT_AN_ADMIN
  w.m.memberCaps({ memberId: "bob", capabilities: ["publish"], by: "admin" });
  assert.deepEqual(heard, []);
  // an unstamped revocation names no actor
  w.m.memberSet({ memberId: "bob", status: "revoked" });
  assert.deepEqual(heard.map(([, n]) => [n.memberId, n.by]), [["bob", null], ["bob", null]]);
});

test("R25 a carried administrator removal (R5) notifies with the completing voter; a vote short of it does not", async () => {
  const w = await world().group();
  const p = await w.m.memberAdd({ memberId: "third", cover: "c3", role: "admin", by: "admin" });
  assert.equal(p.reason, "CONSENSUS_REQUIRED");
  const e = await w.m.adminEndorse({ memberId: "third", by: "second" });
  await w.m.enroll({ invite: e.invite, handle: "third", password: "third-passphrase-x" });
  const heard = [];
  w.m.onRevoked("capture-sources", (n) => heard.push(n));
  assert.equal(w.m.adminRemove({ memberId: "third", by: "admin", reason: "one" }).reason, "VOTES_SHORT");
  assert.deepEqual(heard, []);
  assert.equal(w.m.adminRemove({ memberId: "third", by: "second", reason: "two" }).ok, true);
  assert.deepEqual(heard.map((n) => [n.memberId, n.by]), [["third", "second"]]);
});

test("R25 a listener that throws or rejects changes neither the revocation, its answer, nor another's notice", async () => {
  const plain = await world().group("ann");
  const want = plain.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  const w = await world().group("ann");
  const heard = [];
  w.m.onRevoked("throws", () => { throw new Error("listener failed"); });
  w.m.onRevoked("rejects", () => Promise.reject(new Error("async listener failed")));
  w.m.onRevoked("answers", () => ({ ok: false, reason: "IGNORED" }));
  w.m.onRevoked("hears", (n) => heard.push(n.memberId));
  const got = w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  assert.deepEqual(got, want, "the answer is the one given with no listener");
  assert.deepEqual(heard, ["ann"]);
  assert.deepEqual(w.m.memberFacts("ann").status, "revoked");
  await new Promise((r) => setTimeout(r, 10));   // a rejected promise is caught, never an unhandled rejection
});

test("R47 hostingAccess (R8) is bounded and says so: limit lowered never raised, truncated measured, current the latest", async () => {
  const w = await world().group();
  const empty = w.m.hostingAccess();
  assert.deepEqual([empty.recorded, empty.current, empty.history, empty.limit, empty.truncated],
    [false, null, [], Members.HOSTING_ACCESS_LIMIT, false]);
  assert.equal(Members.HOSTING_ACCESS_LIMIT, 200);
  for (let i = 1; i <= 4; i++) w.m.hostingAccessSet({ holders: `answer ${i}`, by: "admin" });
  const all = w.m.hostingAccess();
  assert.deepEqual([all.history.map((h) => h.holders), all.truncated, all.current.holders],
    [["answer 1", "answer 2", "answer 3", "answer 4"], false, "answer 4"]);
  const two = w.m.hostingAccess({ limit: 2 });
  assert.deepEqual([two.history.map((h) => h.holders), two.limit, two.truncated, two.current.holders, two.recorded],
    [["answer 1", "answer 2"], 2, true, "answer 4", true], "the first records in order; current stays the latest");
  assert.equal(w.m.hostingAccess({ limit: 4 }).truncated, false, "measured by reading one past the cap");
  for (const [asked, cap] of [[10_000, 200], [0, 200], ["x", 200], [-3, 1], [null, 200]])
    assert.equal(w.m.hostingAccess({ limit: asked }).limit, cap, String(asked));
  assert.deepEqual(w.ops("limit=3").hostingaccess().history.length, 3, "the op passes limit");
});

test("R47 memberPairings (R15) is bounded and says so: the first limit by handle, truncated measured, never raised", async () => {
  const w = await world().group("ann", "bob", "cal");
  for (const id of ["ann", "bob", "cal"]) w.m.memberPairingSet({ memberId: id, published: true, by: id });
  const all = w.m.memberPairings();
  assert.deepEqual([all.pairings.map((p) => p.handle), all.limit, all.truncated], [["ann", "bob", "cal"], 200, false]);
  assert.equal(Members.MEMBER_PAIRINGS_LIMIT, 200);
  const two = w.m.memberPairings({ limit: 2 });
  assert.deepEqual([two.pairings.map((p) => p.handle), two.limit, two.truncated], [["ann", "bob"], 2, true]);
  assert.equal(w.m.memberPairings({ limit: 3 }).truncated, false);
  assert.equal(w.m.memberPairings({ limit: 10_000 }).limit, 200);
  // the bound never widens what a viewer sees (R19): the administrator's view is cut, not the rule
  const adm = w.m.memberPairings({ administer: true, limit: 3 });
  assert.deepEqual([adm.pairings.map((p) => p.handle), adm.truncated], [["ann", "bob", "cal"], true]);
  const op = w.ops("limit=1").memberpairings();
  assert.deepEqual([op.pairings.length, op.truncated], [1, true]);
});

test("R25 listeners are told in the modules' total order (build/modules.json's layer order), an unknown module last", async () => {
  const { modules } = JSON.parse(await readFile(new URL("../../../../build/modules.json", import.meta.url), "utf8"));
  const byLayer = [...modules].map((m, i) => ({ id: m.id, layer: m.layer, i })).sort((a, b) => (a.layer - b.layer) || (a.i - b.i));
  assert.deepEqual([...MODULE_ORDER], byLayer.map((m) => m.id), "MODULE_ORDER is modules.json's order");
  const w = await world().group("ann");
  const heard = [];
  for (const m of ["unknown-b", "queue", "capture-sources", "unknown-a", "promotion", "monitoring"])
    assert.equal(w.m.onRevoked(m, () => heard.push(m)).ok, true);
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  assert.deepEqual(heard, ["promotion", "capture-sources", "monitoring", "queue", "unknown-b", "unknown-a"]);
});

test("R26 listenerRefusal is the one site of LISTENER_MALFORMED and LISTENER_DECLARED, each carrying its row (C-102.11, C-102.12): malformed, declared in a list, declared in a one-registration slot naming its holder, else null; extra beside, never replacing; writes nothing, never throws", () => {
  const fn = () => null;
  /* Its row's check and translation: this module's C-102.11 and C-102.12 (N128), on every branch. */
  const ROWS = { LISTENER_MALFORMED: "C-102.11", LISTENER_DECLARED: "C-102.12" };
  const rowOf = (code) => {
    const row = MEMBERSHIP_CHECKS[code];
    assert.equal(row.check, ROWS[code]);
    assert.equal(row.where, "src/member-roster/index.mjs listenerRefusal > is-listener-registration");
    assert.ok(Object.isFrozen(row) && typeof row.translation === "string" && row.translation.length > 40);
    return row;
  };
  const shape = (r, code) => {
    assert.deepEqual([r.ok, r.reason, r.code], [false, code, code]);
    assert.equal(typeof r.detail, "string");
    const row = rowOf(code);
    assert.deepEqual([r.check, r.translation], [row.check, row.translation]);
  };
  /* LISTENER_MALFORMED: a module that is not a non-empty string, or a fn that is not a function, whatever is held. */
  for (const held of [[], [{ module: "a" }], null, undefined, { module: "a" }])
    for (const [m, f] of [["", fn], [null, fn], [undefined, fn], [7, fn], [{}, fn], ["a", null], ["a", "fn"], ["a", {}], [undefined, undefined]]) {
      const r = listenerRefusal(held, m, f);
      shape(r, "LISTENER_MALFORMED");
      assert.equal("module" in r, false);
    }
  /* LISTENER_DECLARED in a list: exactly when the list holds one by this module, naming it. */
  const list = [{ module: "a", fn, seq: 0 }, { module: "b", fn, seq: 1 }];
  const snapshot = JSON.stringify(list);
  for (const m of ["a", "b"]) {
    const r = listenerRefusal(list, m, fn);
    shape(r, "LISTENER_DECLARED");
    assert.equal(r.module, m);
    assert.match(r.detail, new RegExp(m));
  }
  for (const [held, m] of [[list, "c"], [[], "a"], [[null, 3, "a", { module: "A" }], "a"]]) assert.equal(listenerRefusal(held, m, fn), null);
  /* A one-registration slot: held by anyone, it is declared, naming its holder, whoever asks; empty, it answers null. */
  for (const m of ["ratification", "publication"]) {
    const r = listenerRefusal({ module: "ratification", fn }, m, fn);
    shape(r, "LISTENER_DECLARED");
    assert.equal(r.module, "ratification");
  }
  const anon = listenerRefusal({ fn }, "x", fn);
  shape(anon, "LISTENER_DECLARED");
  assert.equal(anon.module, null, "a holder that names no module is named as none");
  for (const held of [null, undefined]) assert.equal(listenerRefusal(held, "x", fn), null);
  /* extra: the caller's own fields beside the refusal's, never replacing them. */
  const extra = { event: "promoted", kind: "k", ok: true, reason: "MINE", code: "MINE", detail: "mine", module: "forged",
                  check: "C-0", translation: "forged" };
  const d = listenerRefusal(list, "a", fn, extra);
  shape(d, "LISTENER_DECLARED");
  assert.deepEqual([d.event, d.kind, d.module, d.detail === "mine"], ["promoted", "k", "a", false]);
  const mal = listenerRefusal(list, "", fn, { event: "promoted" });
  shape(mal, "LISTENER_MALFORMED");
  assert.equal(mal.event, "promoted");
  for (const odd of [null, 7, "s", [1]]) assert.deepEqual(listenerRefusal(list, "a", fn, odd), listenerRefusal(list, "a", fn));
  assert.equal(listenerRefusal(list, "c", fn, extra), null);
  /* Writes nothing; never throws, even over a held value or an extra that throws when read. */
  assert.equal(JSON.stringify(list), snapshot);
  const hostile = [{ get module() { throw new Error("boom"); } }];
  assert.doesNotThrow(() => listenerRefusal(hostile, "a", fn));
  shape(listenerRefusal(hostile, "a", fn), "LISTENER_MALFORMED");
  const trap = {}; Object.defineProperty(trap, "x", { enumerable: true, get() { throw new Error("extra"); } });
  assert.doesNotThrow(() => listenerRefusal(list, "a", fn, trap));
  shape(listenerRefusal(list, "a", fn, trap), "LISTENER_DECLARED");
});
