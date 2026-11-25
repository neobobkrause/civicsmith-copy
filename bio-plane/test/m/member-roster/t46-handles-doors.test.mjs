/* T46 (T46-4; N934, N654; DEC-196, DEC-197; K2903, K1752): a handle chosen at joining and never changed (R53 the
   refusal, R51's guard no longer called, R52's T46 rows, R13 a departed member's handle still taken, R14 without
   `formerly`) and the doors' settings and history for administrators (R54). Each id is tested here explicitly, with a
   negative control (K874: older tests name some of these ids already). Every test drives the module at its interface. */
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { world, V, snapshot } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { notAnAdmin, MEMBER_EXEMPT_TABLES, MEMBER_DECLARED_TABLES } from "../../../src/member-roster/index.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;
import { MACHINE_CLASS_PREFIX, sha256HexSync } from "../../../src/record-grammar/index.mjs";

/* T49 (N1075, K3269): the sentence is `words.json`'s `refusal.HANDLE_FIXED`, read by key. */
const FIXED = (await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")
  .then((t) => JSON.parse(t).words)).find((x) => x.key === "refusal.HANDLE_FIXED").en;

/* The founder, `second` (an administrator), ann and bob active, cal invited. */
async function group() {
  const w = await world().group("ann", "bob");
  w.inv = (await w.m.memberAdd({ memberId: "cal", cover: "cover of cal", by: "admin" })).invite;
  return w;
}

/* ---------------------------------------------------------------- R129, R125 --------------------------------------- */

test("R53 handleChange refuses every call HANDLE_FIXED, whoever asks and whatever handle names, one answer, writing nothing", async () => {
  const w = await group();
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  const before = snapshot(w);
  const row = MEMBERSHIP_CHECKS.HANDLE_FIXED;
  const first = w.m.handleChange({ handle: "ann-x", by: "ann" });
  assert.deepEqual(Object.keys(first).sort(), ["check", "code", "detail", "ok", "reason", "translation"]);
  assert.deepEqual([first.ok, first.reason, first.code, first.check, first.translation],
    [false, "HANDLE_FIXED", "HANDLE_FIXED", "C-96.52", row.translation]);
  assert.match(first.detail, /never changed[\s\S]*Nothing was written\.$/);
  const callers = [null, "", "ann", "bob", "cal", "second", "admin", V("ann"), `${MACHINE_CLASS_PREFIX}admin`, "nobody", 7, {}];
  const handles = ["ann-x", "ann", "bob", "Bad!", "", "  ", null, undefined, "a".repeat(80), 3, ["x"]];
  for (const by of callers) for (const handle of handles)
    assert.deepEqual(w.m.handleChange({ handle, by }), first, `${JSON.stringify(by)} ${JSON.stringify(handle)}`);
  for (const a of [undefined, null, "x", 5, []]) assert.deepEqual(w.m.handleChange(a), first, String(a));
  assert.equal(snapshot(w), before, "no handle changed and no history row appended");
  assert.equal(w.m.memberFacts("ann").handle, "ann");
  /* negative control: a handle is still set where it is chosen, at joining (R16), so writing one is not what is refused */
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "cal-k", password: "cal-passphrase-x" }),
    { ok: true, memberId: "cal", handle: "cal-k" });
  assert.equal(w.m.memberFacts("cal").handle, "cal-k");
});

test("R53 op=handlechange stays declared and routed, and refuses as the service does whatever the body and the stamp say", async () => {
  const w = await group();
  const before = snapshot(w);
  const want = w.m.handleChange({ handle: "x", by: "ann" });
  for (const [q, body] of [["by=ann", { handle: "ann-z" }], ["by=ann", { handle: "ann-z", by: "bob" }], ["", null],
                           ["by=nobody", { handle: "" }]])
    assert.deepEqual(w.ops(q, body).handlechange(), want, `${q} ${JSON.stringify(body)}`);
  assert.equal(snapshot(w), before);
  /* negative control: the op is in the map, beside its sibling handlecheck, which still answers */
  assert.equal(typeof w.ops("").handlechange, "function");
  assert.equal((await w.ops("", { invite: w.inv, handle: "ann" }).handlecheck()).state, "taken");
});

test("R51 the handle guard's slot stands, but no act of this module calls the registered guard while no handle is changed", async () => {
  const w = await group();
  const asked = [];
  assert.deepEqual(w.m.registerHandleGuard("publication", (a) => { asked.push(a); return { case: "CASE-7", edition: 1 }; }),
    { ok: true, module: "publication" });
  w.m.handleChange({ handle: "ann-x", by: "ann" });
  await w.m.handleCheck({ invite: w.inv, handle: "ann-x" });
  await w.m.handleCheck({ viewer: V("ann"), handle: "ann-x" });
  await w.m.enroll({ invite: w.inv, handle: "cal-k", password: "cal-passphrase-x" });
  w.m.memberList({ administer: true });
  assert.deepEqual(asked, [], "never asked");
  assert.equal(w.m.handleChange({ handle: "ann-x", by: "ann" }).reason, "HANDLE_FIXED", "the answer is R129's, never the guard's case");
  assert.equal("case" in w.m.handleChange({ handle: "ann-x", by: "ann" }), false);
  /* negative control: the registration is held, so a second is refused through R81, naming the holder */
  const d = w.m.registerHandleGuard("other", () => null);
  assert.deepEqual([d.ok, d.code, d.module], [false, "LISTENER_DECLARED", "publication"]);
});

/* ---------------------------------------------------------------- R126 --------------------------------------------- */

test("R52 T46 T49 HANDLE_FIXED takes a new row of C-96, C-96.52, its translation words.json's refusal.HANDLE_FIXED read by key; C-96.49 to C-96.51 retired", () => {
  const row = MEMBERSHIP_CHECKS.HANDLE_FIXED;
  assert.ok(Object.isFrozen(row));
  assert.deepEqual([row.check, row.where, row.translation],
    ["C-96.52", "src/member-roster/index.mjs #handleFixed > is-handle-fixed", FIXED]);
  const all = Object.values(MEMBERSHIP_CHECKS);
  assert.equal(all.filter((r) => r.check === "C-96.52").length, 1);
  for (const check of ["C-96.49", "C-96.50", "C-96.51"]) assert.equal(all.filter((r) => r.check === check).length, 0, check);
  for (const code of ["HANDLE_CHANGE_NOT_A_MEMBER", "HANDLE_CHANGE_UNCHECKED"]) assert.equal(code in MEMBERSHIP_CHECKS, false, code);
  /* R112: no plane, server, copy or instance (the sentence names the product, not the group's own Civicsmith) */
  assert.doesNotMatch(row.translation, /\b(cop(y|ies)|instances?|planes?|servers?)\b/i);
  /* negative control: R124's published-case sentence is gone, and C-96.48 stands */
  assert.notEqual(row.translation, "Your handle is fixed: your work is in a published case ({case}).");
  assert.equal(MEMBERSHIP_CHECKS.HANDLE_CHECK_PAUSED.check, "C-96.48");
});

/* ---------------------------------------------------------------- R16, R17 ----------------------------------------- */

test("R13 T46 no handle is ever reused: a member who has left keeps their handle taken, and every handle the history holds stays taken", async () => {
  const w = await group();
  /* a change made before R124 was retired left ann's earlier handle in the history */
  w.sql.exec(`UPDATE members SET handle='ann-2' WHERE member_id='ann'`);
  w.sql.exec(`INSERT INTO handle_history (member_id, from_handle, to_handle, at) VALUES ('ann','ann','ann-2','2026-10-01T00:00:00.000Z')`);
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  const before = snapshot(w);
  for (const h of ["bob", "ann", "ann-2", "second"]) {
    assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: h, password: "cal-passphrase-x" }),
      { ok: false, reason: "HANDLE_TAKEN", handle: h }, h);
    assert.equal((await w.m.handleCheck({ invite: w.inv, handle: h })).state, "taken", h);
  }
  assert.equal(snapshot(w).replace(/"handle_check_window",\[[^\]]*\]/, ""), before.replace(/"handle_check_window",\[[^\]]*\]/, ""),
    "a refused enrolment writes nothing");
  assert.equal(w.m.memberFacts("cal").status, "invited");
  /* negative control: a handle no member held enrols */
  assert.deepEqual(await w.m.enroll({ invite: w.inv, handle: "bobby", password: "cal-passphrase-x" }),
    { ok: true, memberId: "cal", handle: "bobby" });
});

test("R14 T46 memberList's rows carry no `formerly` key, for any caller, whatever the handle history holds", async () => {
  const w = await group();
  w.sql.exec(`INSERT INTO handle_history (member_id, from_handle, to_handle, at) VALUES ('ann','ann-0','ann','2026-10-01T00:00:00.000Z')`);
  const lists = [w.m.memberList({ administer: true }), w.m.memberList({ administer: "1" }), w.m.memberList({}),
                 w.m.memberList({ administer: false }), w.ops("").memberlist(), w.ops("administer=1").memberlist()];
  for (const l of lists) {
    assert.equal(l.members.length, 5, "the founder's row (R147) and four members");
    for (const r of l.members) assert.equal("formerly" in r, false, r.member_id);
    assert.doesNotMatch(JSON.stringify(l), /ann-0/, "an earlier handle is not shown");
  }
  /* negative control: the rows still carry the current handle */
  assert.equal(w.m.memberList({}).members.find((r) => r.member_id === "ann").handle, "ann");
});

/* ---------------------------------------------------------------- R130 --------------------------------------------- */

const ACT = localize("member-roster.index.reading_the_teams_website_key_and", "reading the team's website key and join link");
const NONE = { live: false, current: null, history: [], limit: 200, truncated: false };

test("R54 joinDoors refuses a caller who is not an administrator through notAnAdmin, byte for byte, writing nothing", async () => {
  const w = await group();
  w.m.websiteKeyCreate({ dailyCap: 3, by: "admin" });
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  const before = snapshot(w);
  for (const by of ["ann", "bob", "cal", "ghost", null, "", `${MACHINE_CLASS_PREFIX}admin`, V("second"), 7])
    assert.deepEqual(w.m.joinDoors({ by }), notAnAdmin(by, ACT), String(by));
  assert.deepEqual(w.ops("by=ann").joindoors(), notAnAdmin("ann", ACT));
  assert.equal(snapshot(w), before, "nothing written");
  /* negative control: the founder (claimed) and an active administrator are answered */
  for (const by of ["admin", "second"]) assert.equal(w.m.joinDoors({ by }).ok, true, by);
});

test("R54 joinDoors answers each door's live flag, current settings and whole history in the order recorded, writing nothing", async () => {
  const w = await group();
  assert.deepEqual(w.m.joinDoors({ by: "admin" }), { ok: true, websiteKey: NONE, joinLink: NONE }, "no door yet");
  const k1 = w.m.websiteKeyCreate({ capabilities: ["publish"], dailyCap: 3, expiresInDays: 5, by: "admin" });
  w.m.websiteKeySet({ dailyCap: 9, by: "second" });
  w.m.websiteKeyRevoke({ by: "admin" });
  const k2 = w.m.websiteKeyCreate({ dailyCap: 2, by: "second" });
  const l1 = w.m.joinLinkEnable({ dailyCap: 4, by: "admin" });
  w.m.joinLinkSet({ capabilities: ["contribute", "publish"], by: "admin" });
  const l2 = w.m.joinLinkReplace({ by: "second" });
  const log = w.rows(`SELECT door, at FROM join_doors ORDER BY seq`);
  const at = (i) => log[i].at;
  const before = snapshot(w);
  const r = w.m.joinDoors({ by: "second" });
  assert.equal(snapshot(w), before, "writes nothing");
  assert.deepEqual(Object.keys(r).sort(), ["joinLink", "ok", "websiteKey"]);
  assert.deepEqual(r.websiteKey, {
    live: true,
    current: { id: k2.keyId, capabilities: ["contribute"], dailyCap: 2, expiresInDays: 7, since: at(3), by: "second" },
    history: [
      { id: k1.keyId, event: "create", capabilities: ["publish"], dailyCap: 3, expiresInDays: 5, by: "admin", at: at(0) },
      { id: k1.keyId, event: "set", capabilities: ["publish"], dailyCap: 9, expiresInDays: 5, by: "second", at: at(1) },
      { id: k1.keyId, event: "revoke", capabilities: ["publish"], dailyCap: 9, expiresInDays: 5, by: "admin", at: at(2) },
      { id: k2.keyId, event: "create", capabilities: ["contribute"], dailyCap: 2, expiresInDays: 7, by: "second", at: at(3) },
    ],
    limit: 200, truncated: false });
  assert.deepEqual(r.joinLink, {
    live: true,
    current: { id: l2.linkId, capabilities: ["contribute", "publish"], dailyCap: 4, expiresInDays: 7, since: at(6), by: "second" },
    history: [
      { id: l1.linkId, event: "enable", capabilities: ["contribute"], dailyCap: 4, expiresInDays: 7, by: "admin", at: at(4) },
      { id: l1.linkId, event: "set", capabilities: ["contribute", "publish"], dailyCap: 4, expiresInDays: 7, by: "admin", at: at(5) },
      { id: l2.linkId, event: "replace", capabilities: ["contribute", "publish"], dailyCap: 4, expiresInDays: 7, by: "second", at: at(6) },
    ],
    limit: 200, truncated: false });
  /* `current.id` is the one the door's invitations' actor names (R105) */
  await w.m.joinLinkInvite({ link: l2.link, cover: "night owl" });
  assert.ok(w.m.memberList({ administer: true }).members.some((m) => m.invited_by === `join-link:${r.joinLink.current.id}`));
  /* switched off: not live, no current, the history keeps every record */
  w.m.joinLinkOff({ by: "admin" });
  w.m.websiteKeyRevoke({ by: "admin" });
  const off = w.m.joinDoors({ by: "admin" });
  for (const [d, n, last] of [[off.joinLink, 4, "off"], [off.websiteKey, 5, "revoke"]]) {
    assert.deepEqual([d.live, d.current, d.history.length, d.history.at(-1).event], [false, null, n, last]);
  }
  /* negative control: the op reads `by` from the control plane's stamp, never the body */
  assert.deepEqual(w.ops("by=admin", { by: "ann" }).joindoors(), off);
  assert.deepEqual(w.ops("by=ann", { by: "admin" }).joindoors(), notAnAdmin("ann", ACT));
});

test("R54 no answer carries a key, a link, a hash of either, or an invitation a door made", async () => {
  const w = await group();
  const k = w.m.websiteKeyCreate({ dailyCap: 3, by: "admin" });
  const l = w.m.joinLinkEnable({ dailyCap: 3, by: "admin" });
  const viaKey = await w.m.websiteInvite({ key: k.key, cover: "web" });
  const viaLink = await w.m.joinLinkInvite({ link: l.link, cover: "link" });
  const l2 = w.m.joinLinkReplace({ by: "admin" });
  const text = JSON.stringify(w.m.joinDoors({ by: "admin" }));
  for (const secret of [k.key, l.link, l2.link, viaKey.invite, viaLink.invite])
    for (const s of [secret, sha256HexSync(secret)]) assert.equal(text.includes(s), false, "no secret, no hash");
  assert.doesNotMatch(text, /secret|hash|invite/i);
  /* negative control: the hashes are held in the store, and the answer still names each door's id */
  assert.ok(snapshot(w).includes(sha256HexSync(k.key)));
  assert.ok(text.includes(k.keyId) && text.includes(l2.linkId));
});

test("R54 R47 each history takes a limit the caller may lower and never raise (at most 200), reads one row past it, and publishes limit and truncated", async () => {
  const w = await group();
  w.m.websiteKeyCreate({ dailyCap: 1, by: "admin" });
  for (let i = 2; i <= 201; i++) w.m.websiteKeySet({ dailyCap: i, by: "admin" });   // 201 records
  w.m.joinLinkEnable({ dailyCap: 1, by: "admin" });
  const cap = (d) => d.history.map((h) => h.dailyCap);
  const all = w.m.joinDoors({ by: "admin" });
  assert.deepEqual([all.websiteKey.limit, all.websiteKey.truncated, all.websiteKey.history.length], [200, true, 200]);
  assert.deepEqual(cap(all.websiteKey), Array.from({ length: 200 }, (_, i) => i + 1), "the first 200, in the order recorded");
  assert.equal(all.websiteKey.current.dailyCap, 201, "current is the latest record, read apart from the page");
  for (const limit of [500, "999", 0, "x", null, undefined])
    assert.equal(w.m.joinDoors({ by: "admin", limit }).websiteKey.limit, 200, String(limit));
  assert.equal(w.m.joinDoors({ by: "admin", limit: -3 }).websiteKey.limit, 1, "lowered to the floor of one record");
  const two = w.m.joinDoors({ by: "admin", limit: 2 });
  assert.deepEqual([two.websiteKey.limit, two.websiteKey.truncated, cap(two.websiteKey)], [2, true, [1, 2]]);
  assert.deepEqual([two.joinLink.limit, two.joinLink.truncated, two.joinLink.history.length], [2, false, 1]);
  assert.deepEqual(w.ops("by=admin&limit=3").joindoors().websiteKey.history.length, 3);
  /* negative control: exactly the limit read is not truncated */
  w.m.joinLinkSet({ dailyCap: 2, by: "admin" });
  const exact = w.m.joinDoors({ by: "admin", limit: 2 }).joinLink;
  assert.deepEqual([exact.history.length, exact.truncated], [2, false]);
});

test("R54 joinDoors never throws, whatever it is handed", async () => {
  const w = await group();
  for (const a of [undefined, null, 7, "x", [], { by: {} }, { by: "admin", limit: {} }, { by: "admin", limit: Symbol("s") }])
    assert.doesNotThrow(() => w.m.joinDoors(a));
  assert.equal(w.m.joinDoors(null).reason, "NOT_AN_ADMIN", "no caller is no administrator");
  /* negative control: an administrator with a hostile limit is still answered, at the ceiling */
  assert.equal(w.m.joinDoors({ by: "admin", limit: {} }).websiteKey.limit, 200);
});

/* ---------------------------------------------------------------- R55 --------------------------------------------- */

test("R55 join_doors is declared with export never, its other classes the default form's, so no export carries a door's hash; R54's read still answers", async () => {
  const w = await group();
  const k = w.m.websiteKeyCreate({ dailyCap: 3, by: "admin" });
  const l = w.m.joinLinkEnable({ dailyCap: 3, by: "admin" });
  /* the declaration the composition makes with record-core's `declareTable` (its R21): join_doors once, its classes */
  const doors = MEMBER_DECLARED_TABLES.filter((d) => d.name === "join_doors");
  assert.equal(doors.length, 1, "declared once");
  const { name, ...classes } = doors[0];
  assert.deepEqual(classes, { purge: "exempt", expunge: "none", export: "never", sight: "group", derive: "stored",
                              version_chain: false });
  assert.ok(Object.isFrozen(MEMBER_DECLARED_TABLES) && Object.isFrozen(doors[0]));
  /* what an export reads: no table of this module that holds a door's hash is exportable (the default form's tables are
     exported admin-only); the hashes are held in join_doors alone */
  const declared = new Set(MEMBER_DECLARED_TABLES.map((d) => d.name));
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).map((r) => r.name);
  for (const t of tables.filter((x) => !declared.has(x))) {
    const dump = JSON.stringify(w.db.prepare(`SELECT * FROM "${t}"`).all());
    for (const secret of [k.key, l.link]) assert.equal(dump.includes(sha256HexSync(secret)), false, `${t} holds no door hash`);
  }
  assert.ok(JSON.stringify(w.db.prepare(`SELECT * FROM join_doors`).all()).includes(sha256HexSync(k.key)), "join_doors does");
  /* negative controls: R58's home_looks is declared apart too (export never, sight owner); every declared table is kept by
     purge; and R54's read still answers the doors' settings and history */
  assert.deepEqual(MEMBER_DECLARED_TABLES.map((d) => [d.name, d.purge, d.export, d.sight]),
    [["join_doors", "exempt", "never", "group"], ["home_looks", "exempt", "never", "owner"]]);
  for (const d of MEMBER_DECLARED_TABLES) assert.ok(MEMBER_EXEMPT_TABLES.includes(d.name), d.name);
  const r = w.m.joinDoors({ by: "admin" });
  assert.deepEqual([r.ok, r.websiteKey.live, r.websiteKey.current.id, r.joinLink.live, r.joinLink.history.length],
    [true, true, k.keyId, true, 1]);
});

test("R66 every table this module creates is exempt from purge, and the exempt list names none it does not create", async () => {
  const w = world();
  const created = w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).map((r) => r.name).sort();
  assert.deepEqual(created, [...MEMBER_EXEMPT_TABLES].sort());
  assert.deepEqual(created, ["admin_votes", "court_notice", "founder_handle", "group_description", "handle_check_window",
    "handle_history", "home_looks", "hosting_access", "join_doors", "member_expertise", "members"]);
  /* negative control: no project table, no credential table and no sight index is among them */
  for (const t of ["project_participants", "project_visibility", "project_sight", "project_removals", "credentials", "sessions"])
    assert.equal(created.includes(t), false, t);
});
