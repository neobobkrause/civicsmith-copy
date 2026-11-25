/* T15 (N352, K477): R88 `hiddenBundles(viewer)`, the one spelling of the complement of R43's rule, the set the figure
   sources (record-core R63's `counts(hid)`), queue and retrieval subtract. At the interface only: the answer is run as its callers run it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, realWorld, V } from "./fixture.mjs";
import { hiddenBundles, viewerPredicate, GATE_MARK } from "../../../src/membership/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";

/* INFO-I and CASE-C not projects; PROJ-H hidden (owner ann; bob invited, cal joined then leaving); PROJ-D discoverable
   (owner ann); PROJ-M a machine-made project with no participant; dee outside every project; second an administrator. */
async function hidWorld() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.bundle("INFO-I");
  w.bundle("CASE-C", "case");
  w.project("PROJ-H", "Hidden H");
  w.project("PROJ-D", "Discoverable D");
  w.project("PROJ-M", "Machine M");
  for (const p of ["PROJ-H", "PROJ-D"]) w.m.projectClaimOwner({ projectId: p, memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-H", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectInvite({ projectId: "PROJ-H", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-H", by: "cal", viewer: V("cal") });
  w.m.projectLeave({ projectId: "PROJ-H", by: "cal", viewer: V("cal") });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  return w;
}
const ALL = (w) => w.rows(`SELECT bundle_id FROM bundles ORDER BY bundle_id`).map((r) => r.bundle_id);
/* What R43 admits, run as the gate is run. */
const seen = (w, viewer) => {
  const g = viewerPredicate(viewer);
  return w.rows(`SELECT b.bundle_id FROM bundles b WHERE ${g.sql} ORDER BY b.bundle_id`, ...g.args).map((r) => r.bundle_id);
};
/* The set R88 names, read as a set of ids. */
const named = (w, hid) => w.rows(`SELECT bundle_id FROM bundles WHERE bundle_id IN ${hid.sql} ORDER BY bundle_id`, ...hid.args)
  .map((r) => r.bundle_id);
/* Subtracted as its callers subtract it (`<key> NOT IN (…)`), over a table naming a bundle per row. */
const left = (w, hid) => w.rows(`SELECT bundle_id FROM bundles WHERE COALESCE(bundle_id, '') NOT IN ${hid.sql} ORDER BY bundle_id`,
  ...hid.args).map((r) => r.bundle_id);
const snapshot = (w) => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));

const MACHINES = ["admin", "member", "probe", "daemon", "ai"].map((c) => `${MACHINE_CLASS_PREFIX}${c}`);
const REFUSED = [null, undefined, "", "anna", "junk", `${MACHINE_CLASS_PREFIX}robot`, "member:", "member:a b", "Admin",
                 " admin", 42, 0, true, {}, [], ["admin"]];

test("R88 hiddenBundles is null exactly for R43's see-all arm: every machine credential, and no longer the founder's viewer (D54)", async () => {
  const w = await hidWorld();
  for (const v of MACHINES) {
    assert.equal(hiddenBundles(v), null, v);
    assert.deepEqual(seen(w, v), ALL(w), `${v}: R43 lets it see every bundle, so nothing is subtracted`);
  }
  /* D54 (T41-3): the founder's viewer, in both spellings, is withheld the hidden projects it is not in */
  for (const v of ["admin", V("admin")]) {
    const hid = hiddenBundles(v);
    assert.notEqual(hid, null, v);
    assert.deepEqual(named(w, hid), ["PROJ-H", "PROJ-M"], v);
    assert.deepEqual(left(w, hid), seen(w, v), `${v}: subtracting it leaves exactly what R43 lets it see`);
  }
  for (const v of [V("ann"), V("dee"), V("second"), V("nobody"), ...REFUSED])
    assert.notEqual(hiddenBundles(v), null, `${JSON.stringify(v)}: R43 does not pass every bundle to it`);
});

test("R88 for every other viewer it names exactly the bundles R43 does not pass: members in every position, administrators active and revoked", async () => {
  const w = await hidWorld();
  const check = (v, label) => {
    const hid = hiddenBundles(v);
    assert.deepEqual(Object.keys(hid).sort(), ["args", "sql"], `${label}: {sql, args}`);
    assert.ok(Array.isArray(hid.args), label);
    assert.match(hid.sql, /^\(.*\)$/s, `${label}: a parenthesised set, ready for NOT IN`);
    const hidden = named(w, hid), visible = seen(w, v);
    assert.deepEqual([...hidden, ...visible].sort(), ALL(w), `${label}: hidden and seen cover every bundle`);
    assert.equal(hidden.filter((id) => visible.includes(id)).length, 0, `${label}: and never overlap`);
    assert.deepEqual(left(w, hid), visible, `${label}: subtracting it leaves exactly what R43 lets it see`);
    return hidden;
  };
  assert.deepEqual(check(V("ann"), "owner"), ["PROJ-M"]);
  assert.deepEqual(check(V("bob"), "invited"), ["PROJ-D", "PROJ-M"]);
  assert.deepEqual(check(V("cal"), "leaving"), ["PROJ-D", "PROJ-M"]);
  assert.deepEqual(check(V("dee"), "outside"), ["PROJ-D", "PROJ-H", "PROJ-M"], "a discoverable project too: EXISTENCE is not FULL");
  /* D54: an active administrator, and the founder, are withheld the hidden projects they are not in, and the bundles
     belonging to them; invited to one, it is no longer withheld */
  assert.deepEqual(check(V("second"), "an active administrator"), ["PROJ-H", "PROJ-M"]);
  assert.deepEqual(check("admin", "the founder"), ["PROJ-H", "PROJ-M"]);
  w.bundle("NOTE-H", "information", "in H", "PROJ-H");
  assert.deepEqual(check(V("second"), "a bundle in a hidden project"), ["NOTE-H", "PROJ-H", "PROJ-M"]);
  w.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.deepEqual(check(V("second"), "an administrator invited to H"), ["PROJ-M"]);
  w.sql.exec(`DELETE FROM project_participants WHERE member_id='second'`);
  w.sql.exec(`DELETE FROM bundles WHERE bundle_id='NOTE-H'`);
  assert.deepEqual(check(V("nobody"), "an id no member holds"), ["PROJ-D", "PROJ-H", "PROJ-M"]);
  w.m.memberSet({ memberId: "dee", status: "revoked", by: "admin" });
  assert.deepEqual(check(V("dee"), "a revoked member"), ["PROJ-D", "PROJ-H", "PROJ-M"]);
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.deepEqual(check(V("second"), "a revoked administrator is no administrator"), ["PROJ-D", "PROJ-H", "PROJ-M"]);
  assert.ok(hiddenBundles(V("ann")).sql.includes(GATE_MARK), "the compiled gate itself, marked");
});

test("R88 a viewer R43 refuses hides every bundle, the asked-but-absent viewer included", async () => {
  const w = await hidWorld();
  for (const v of REFUSED) {
    const hid = hiddenBundles(v);
    assert.deepEqual(named(w, hid), ALL(w), JSON.stringify(v));
    assert.deepEqual(left(w, hid), [], JSON.stringify(v));
    assert.deepEqual(seen(w, v), [], `${JSON.stringify(v)}: R43 refuses it`);
  }
});

test("R88 it is a subquery over the bundles as they stand when run, not a snapshot: sight changes and new bundles follow", async () => {
  const w = await hidWorld();
  const hid = hiddenBundles(V("dee"));
  assert.deepEqual(named(w, hid), ["PROJ-D", "PROJ-H", "PROJ-M"]);
  w.m.projectInvite({ projectId: "PROJ-H", handle: "dee", by: "ann", viewer: V("ann") });
  w.project("PROJ-N");
  w.bundle("INFO-J");
  assert.deepEqual(named(w, hid), ["PROJ-D", "PROJ-M", "PROJ-N"], "the same answer, run again, follows the record");
  assert.deepEqual(named(w, hiddenBundles(V("dee"))), named(w, hid), "and agrees with a fresh one");
});

test("R88 over the real record-core's bundles table", async () => {
  const w = await realWorld();
  const { m } = w;
  await w.claim();
  const s = await m.memberAdd({ memberId: "second", cover: "c", role: "admin", by: "admin" });
  await m.enroll({ invite: s.invite, handle: "second", password: "second-passphrase-x" });
  for (const id of ["ann", "bob"]) {
    const a = await m.memberAdd({ memberId: id, cover: "c", by: "admin" });
    await m.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  w.bundle("PROJ-A");
  w.bundle("PROJ-B");
  w.bundle("INFO-1", "information");
  m.projectClaimOwner({ projectId: "PROJ-A", memberId: "ann" });
  const ids = (hid) => w.db.prepare(`SELECT bundle_id FROM bundles WHERE bundle_id IN ${hid.sql} ORDER BY bundle_id`)
    .all(...hid.args).map((r) => r.bundle_id);
  assert.deepEqual(ids(hiddenBundles(V("ann"))), ["PROJ-B"]);
  assert.deepEqual(ids(hiddenBundles(V("bob"))), ["PROJ-A", "PROJ-B"]);
  /* D54: both projects are hidden (no setting recorded) and the administrators are in neither */
  assert.deepEqual(ids(hiddenBundles(V("second"))), ["PROJ-A", "PROJ-B"]);
  assert.deepEqual(ids(hiddenBundles("junk")), ["INFO-1", "PROJ-A", "PROJ-B"]);
  assert.deepEqual(ids(hiddenBundles("admin")), ["PROJ-A", "PROJ-B"]);
  assert.equal(hiddenBundles(`${MACHINE_CLASS_PREFIX}admin`), null);
});

test("R88 writes nothing and never throws, whatever it is handed; each answer is the caller's own", async () => {
  const w = await hidWorld();
  const before = snapshot(w);
  const trap = {}; Object.defineProperty(trap, "x", { enumerable: true, get() { throw new Error("getter"); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const v of [...REFUSED, ...MACHINES, "admin", V("ann"), trap, revoked.proxy, Symbol("s"), () => "admin", 10n]) {
    let hid;
    assert.doesNotThrow(() => { hid = hiddenBundles(v); }, String(typeof v));
    if (hid) assert.doesNotThrow(() => named(w, hid));
  }
  assert.equal(snapshot(w), before, "writes nothing, and running its answer writes nothing");
  const a = hiddenBundles(V("ann"));
  a.args.push("x");
  assert.deepEqual(hiddenBundles(V("ann")).args, ["ann", "ann"], "a caller changing its answer changes no later one");
});
