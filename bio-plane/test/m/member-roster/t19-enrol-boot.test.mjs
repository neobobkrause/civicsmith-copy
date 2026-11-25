/* T19 layer 2: R32 `registerPasswordSetter` (K774), the write `enroll` (R13) makes through `credentials`; `migrate`
   (R66, R74) and the reserved-id finding (R21). (The sight index recomputed at every boot is `membership`'s.) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { world, sqlOver } from "./fixture.mjs";
import { Members } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;
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

test("R32 R13 enroll sets the password through the registered setter, inside its act, and membership keeps none", async () => {
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

test("R32 a setter that throws or answers ok:false is ENROL_NOT_RECORDED, C-96.18: nothing written, the invitation still live", async () => {
  // fixtures-generic: X
  for (const failing of [async () => { throw new Error("disk full"); }, async () => ({ ok: false, reason: "X" }),
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
    assert.equal((await w.m.inviteLook({ invite })).ok, true, "the invitation can still be used");
    set(async (a) => ({ ok: true, role: a.role }));
    assert.equal((await w.m.enroll({ invite, handle: "ann", password: "ann-passphrase-x" })).ok, true, "and works after");
  }
});

test("R32 with no setter registered, enroll is ENROL_NOT_RECORDED before any write, and the invitation stays live", async () => {
  const w = world({ omit: ["setter"] });
  const a = await w.m.memberAdd({ memberId: "ann", cover: "cover of ann", role: "admin", by: "class:admin" });
  assert.equal(a.ok, true);
  const before = JSON.stringify(w.rows(`SELECT * FROM members`));
  const r = await w.m.enroll({ invite: a.invite, handle: "ann", password: "ann-passphrase-x" });
  assert.deepEqual([r.ok, r.reason, r.check], [false, "ENROL_NOT_RECORDED", "C-96.18"]);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM members`)), before);
  assert.equal((await w.m.inviteLook({ invite: a.invite })).ok, true);
});

test("R32 R13 every refusal enroll answers before the write calls no setter", async () => {
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

test("R32 R26 one registration: a non-function is LISTENER_MALFORMED, a second LISTENER_DECLARED naming the holder", async () => {
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

/* ---- the boot ---- */

test("R66 R74 migrate on a bare store creates this module's tables and indexes, and no table of any other; a second boot changes nothing", () => {
  const db = new DatabaseSync(":memory:");
  const m = new Members({ sql: sqlOver(db) });
  assert.doesNotThrow(() => m.migrate());
  const names = () => sqlOver(db).exec(`SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`);
  const first = names();
  assert.deepEqual(first.filter((r) => r.type === "table").map((r) => r.name),
    ["admin_votes", "court_notice", "founder_handle", "group_description", "handle_check_window", "handle_history", "home_looks",
     "hosting_access", "join_doors", "member_expertise", "members"]);
  assert.ok(first.some((r) => r.name === "members_handle"), "and the unique handle index");
  m.migrate();
  assert.deepEqual(names(), first);
  /* an older store: `name` renamed to `cover`, the additive columns added, the vestigial `expertise` column dropped */
  const old = new DatabaseSync(":memory:");
  old.exec(`CREATE TABLE members (member_id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
            status TEXT NOT NULL DEFAULT 'invited', invite_hash TEXT, expertise TEXT, created TEXT NOT NULL, updated TEXT NOT NULL)`);
  old.exec(`INSERT INTO members (member_id, name, created, updated) VALUES ('ann','Ann','t','t')`);
  new Members({ sql: sqlOver(old) }).migrate();
  const cols = sqlOver(old).exec(`PRAGMA table_info(members)`).map((r) => r.name);
  assert.ok(cols.includes("cover") && !cols.includes("name") && !cols.includes("expertise"));
  for (const c of ["handle", "capabilities", "status_by", "status_at", "invited_by", "pairing_published", "invite_expires",
                   "invite_days", "invite_withdrawn", "door", "approved_by"]) assert.ok(cols.includes(c), c);
  assert.equal(sqlOver(old).exec(`SELECT cover FROM members`)[0].cover, "Ann");
});

/* ---- the reserved-id finding, which `membership` registers with record-core's R68 seam ---- */

test("R9 R21 the module answers the audit's finding for a member held under the reserved id, never renames it", async () => {
  const w = world();
  const finding = () => w.m.reservedIdFinding();
  assert.deepEqual(finding(), {
    reservedId: "admin", held: false, role: null, status: null, check: "C-55.1",
    says: word("membership.says.member_holds_reserved", { id: "admin" }) });
  /* an instance that enrolled `admin` before the reservation */
  w.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, created, updated)
              VALUES ('admin', 'old', 'oldadmin', 'member', 'active', 't', 't')`);
  const held = finding();
  assert.deepEqual([held.held, held.role, held.status, held.check], [true, "member", "active", "C-55.1"]);
  assert.ok(hasWord("membership.says.member_enrolled_under"), "the key is held by setup-words");
  assert.equal(held.says, word("membership.says.member_enrolled_under", { id: "admin", role: "member", status: "active" }),
    "the finding's words are the key's, read from the word table");
  assert.equal(w.row(`SELECT member_id FROM members WHERE member_id='admin'`).member_id, "admin", "never renamed");
  /* control: memberAdd still refuses the id (R9), whoever asks */
  return w.m.memberAdd({ memberId: "admin", cover: "c", by: "class:admin" }).then((r) => assert.equal(r.reason, "MEMBER_ID_RESERVED"));
});
