/* T19 layer 2: R95 `registerPasswordSetter` (K774), the write `enroll` (R16) makes through `credentials`; and the sight
   index recomputed at every boot by `migrate` (D-497, moved from the legacy store's boot), which R45's "the latest record
   is the setting" and R85 `visibilityOf` read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { world, V, sqlOver } from "./fixture.mjs";
import { Membership, MEMBERSHIP_CHECKS } from "../../../src/membership/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

/* An invitation for `ann`, issued in a group with two administrators. */
async function invited(setter = undefined) {
  const w = world({ omit: ["setter"] });
  const calls = [];
  let behave = async (a) => ({ ok: true, role: a.role });
  if (setter !== undefined) setter(w);
  else assert.deepEqual(w.m.registerPasswordSetter(async (a) => { calls.push(a); return behave(a); }),
    { ok: true, module: "credentials" });
  await w.group();
  calls.length = 0;
  const add = await w.m.memberAdd({ memberId: "ann", cover: "cover of ann", by: "admin" });
  assert.equal(add.ok, true);
  return { w, invite: add.invite, calls, set: (fn) => { behave = fn; } };
}

test("R95 R16 enroll sets the password through the registered setter, inside its act, and membership keeps none", async () => {
  const { w, invite, calls } = await invited();
  const r = await w.m.enroll({ invite, handle: "ann", password: "ann-passphrase-x" });
  assert.deepEqual(r, { ok: true, memberId: "ann", handle: "ann" });
  assert.deepEqual(calls, [{ role: "member:ann", password: "ann-passphrase-x" }], "called once, with the member's role");
  assert.deepEqual(w.rows(`SELECT name FROM sqlite_master WHERE name IN ('credentials','sessions','signers')`), [],
    "membership holds no credential table");
  assert.deepEqual(w.rows(`SELECT * FROM members WHERE member_id='ann'`).map((r) => Object.values(r).includes("ann-passphrase-x")),
    [false], "and no password in its own rows");
  assert.equal(w.m.memberFacts("ann").status, "active");
});

test("R95 a setter that throws or answers ok:false is ENROL_NOT_RECORDED, C-96.18: nothing written, the invitation still live", async () => {
  for (const failing of [async () => { throw new Error("disk full"); }, async () => ({ ok: false, reason: "X" }), // fixtures-generic: X
                         () => { throw new Error("sync"); }]) {
    const { w, invite, set } = await invited();
    set(failing);
    const before = JSON.stringify(w.rows(`SELECT * FROM members ORDER BY member_id`));
    const r = await w.m.enroll({ invite, handle: "ann", password: "ann-passphrase-x" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "ENROL_NOT_RECORDED");
    assert.equal(r.code, "ENROL_NOT_RECORDED");
    assert.equal(r.check, "C-96.18");
    assert.equal(r.check, MEMBERSHIP_CHECKS.ENROL_NOT_RECORDED.check);
    assert.equal(r.translation, MEMBERSHIP_CHECKS.ENROL_NOT_RECORDED.translation);
    assert.equal(JSON.stringify(w.rows(`SELECT * FROM members ORDER BY member_id`)), before, "nothing written");
    assert.equal((await w.m.inviteLook({ invite })).ok, true, "invite still live");
    set(async (a) => ({ ok: true, role: a.role }));
    assert.equal((await w.m.enroll({ invite, handle: "ann", password: "ann-passphrase-x" })).ok, true, "and works after");
  }
});

test("R95 with no setter registered, enroll is ENROL_NOT_RECORDED before any write, and the invitation stays live", async () => {
  const w = world({ omit: ["setter"] });
  const a = await w.m.memberAdd({ memberId: "ann", cover: "cover of ann", role: "admin", by: "class:admin" });
  assert.equal(a.ok, true);
  const before = JSON.stringify(w.rows(`SELECT * FROM members`));
  const r = await w.m.enroll({ invite: a.invite, handle: "ann", password: "ann-passphrase-x" });
  assert.deepEqual([r.ok, r.reason, r.check], [false, "ENROL_NOT_RECORDED", "C-96.18"]);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM members`)), before);
  assert.equal((await w.m.inviteLook({ invite: a.invite })).ok, true);
});

test("R95 R16 every refusal enroll answers before the write calls no setter", async () => {
  const { w, invite, calls } = await invited();
  await w.enrol("bob");
  for (const [args, reason] of [[{ invite: "f".repeat(32), handle: "ann", password: "long-enough-pw" }, "NO_SUCH_INVITATION"],
                                [{ invite, handle: "", password: "long-enough-pw" }, "NO_HANDLE"],
                                [{ invite, handle: "Ann!", password: "long-enough-pw" }, "BAD_HANDLE"],
                                [{ invite, handle: "bob", password: "long-enough-pw" }, "HANDLE_TAKEN"],
                                [{ invite, handle: "ann", password: "short" }, "PASSWORD_TOO_SHORT"]]) {
    const before = calls.length;
    assert.equal((await w.m.enroll(args)).reason, reason);
    assert.equal(calls.length, before, `${reason}: no setter call`);
  }
});

test("R95 R81 one registration: a non-function is LISTENER_MALFORMED, a second LISTENER_DECLARED naming the holder", async () => {
  const w = world({ omit: ["setter"] });
  for (const bad of [null, undefined, "setPassword", 42, {}]) {
    const r = w.m.registerPasswordSetter(bad);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "LISTENER_MALFORMED");
    assert.equal(r.check, MEMBERSHIP_CHECKS.LISTENER_MALFORMED.check);
  }
  assert.equal(w.m.registerPasswordSetter(() => ({ ok: true }), "credentials").ok, true);
  const again = w.m.registerPasswordSetter(() => ({ ok: true }), "other");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "LISTENER_DECLARED");
  assert.equal(again.module, "credentials");
  assert.equal(again.check, MEMBERSHIP_CHECKS.LISTENER_DECLARED.check);
});

/* ---- the boot reindex ---- */

test("R45 R85 migrate recomputes the sight index from the owners' acts, so a disagreeing row does not survive a boot", async () => {
  const w = await world().group("ann");
  w.project("PROJ-A");
  w.project("PROJ-B");
  w.m.projectClaimOwner({ projectId: "PROJ-A", memberId: "ann" });
  w.m.projectVisibilitySet({ projectId: "PROJ-A", setting: "discoverable", by: "ann", viewer: V("ann") });
  /* A row a path wrote without maintaining the index, a row for a bundle that is not a project, and a project with none. */
  w.sql.exec(`UPDATE project_sight SET setting='discoverable' WHERE project_id='PROJ-B'`);
  w.sql.exec(`DELETE FROM project_sight WHERE project_id='PROJ-A'`);
  w.bundle("INFO-1");
  w.sql.exec(`INSERT INTO project_sight (project_id, setting) VALUES ('INFO-1','discoverable')`);
  w.bundle("PROJ-C", "project");
  assert.equal(w.m.visibilityOf("PROJ-B"), "discoverable");
  w.m.migrate();
  assert.deepEqual(w.rows(`SELECT project_id, setting FROM project_sight ORDER BY project_id`),
    [{ project_id: "PROJ-A", setting: "discoverable" }, { project_id: "PROJ-B", setting: "hidden" },
     { project_id: "PROJ-C", setting: "hidden" }]);
  assert.equal(w.m.visibilityOf("PROJ-A"), "discoverable");
  assert.equal(w.m.visibilityOf("PROJ-B"), "hidden");
  const twice = JSON.stringify(w.rows(`SELECT * FROM project_sight ORDER BY project_id`));
  w.m.migrate();
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM project_sight ORDER BY project_id`)), twice, "idempotent at the byte");
});

test("R115 migrate on a host whose record-core has made no bundles table creates membership's tables and indexes nothing", () => {
  const db = new DatabaseSync(":memory:");
  const m = new Membership({ sql: sqlOver(db), core: { declarePurge() { return { ok: true }; }, declareTable() { return { ok: true }; } } });
  assert.doesNotThrow(() => m.migrate());
  assert.deepEqual(sqlOver(db).exec(`SELECT * FROM project_sight`), []);
});

/* ---- the reserved-id finding, through record-core's R68 seam ---- */

test("R12 R57 the audit reports a member held under the reserved id, never renames it, and registers once", async () => {
  const w = world();
  const found = [];
  w.core.registerAuditFinding = (module, key, finding) => { found.push({ module, key, finding }); return { ok: true }; };
  w.m.migrate();
  w.m.migrate();
  assert.deepEqual(found.map((f) => [f.module, f.key]), [["membership", "membership"]], "once, under `membership`");
  const finding = found[0].finding;
  assert.deepEqual(finding({ bundles: [] }), {
    reservedId: "admin", held: false, role: null, status: null, check: "C-55.1",
    says: word("membership.says.member_holds_reserved", { id: "admin" }) });
  /* an instance that enrolled `admin` before the reservation */
  w.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, created, updated)
              VALUES ('admin', 'old', 'oldadmin', 'member', 'active', 't', 't')`);
  const held = finding({ bundles: [] });
  assert.deepEqual([held.held, held.role, held.status, held.check], [true, "member", "active", "C-55.1"]);
  assert.ok(hasWord("membership.says.member_enrolled_under"), "the key is held by setup-words");
  assert.equal(held.says, word("membership.says.member_enrolled_under", { id: "admin", role: "member", status: "active" }),
    "the finding's words are the key's, read from the word table");
  assert.equal(w.row(`SELECT member_id FROM members WHERE member_id='admin'`).member_id, "admin", "never renamed");
});
