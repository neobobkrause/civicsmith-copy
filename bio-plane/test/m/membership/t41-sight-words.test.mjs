/* T41 (T41-3; N822, D54 B, K2408, K2409, K2435; DEC-188 (7)): administrators' sight of hidden projects (the Terms' two
   forms of EXISTENCE, R18, R43, R44, R60, R77, R88, R120) and the handle refusals' words read by key (R123, R126; R124's
   two refusals retired with it at T46, DEC-197).
   Each id is tested here explicitly, with a negative control (K874: older tests name some of these ids already). Every
   test drives the module at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { world, V } from "./fixture.mjs";
import { Membership, viewerPredicate, hiddenBundles, MEMBERSHIP_CHECKS, PROJECT_VISIBILITY_CHECKS, WORD_KEYS }
  from "../../../src/membership/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";
import { WORD_KEYS as MEMBER_WORD_KEYS } from "../../../src/member-roster/index.mjs";

/* the keys held across the two modules: membership reads its own, member-roster its (DEC-345) */
const HELD = [...WORD_KEYS, ...MEMBER_WORD_KEYS];

const { SIGHT_FULL: FULL, SIGHT_EXISTENCE: EXISTENCE, SIGHT_NONE: NONE } = Membership;
const wordsJson = async () =>
  JSON.parse(await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words;
const snapshot = (w) => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, w.rows(`SELECT * FROM "${name}"`)]));
const seen = (w, viewer) => {
  const g = viewerPredicate(viewer);
  return w.rows(`SELECT b.bundle_id FROM bundles b WHERE ${g.sql} ORDER BY b.bundle_id`, ...g.args).map((r) => r.bundle_id);
};

/* H hidden: owners ann (first) and bob (second), cal invited. D discoverable: owner ann. NOTE-H in H, NOTE-D in D,
   INFO-I in no project. second an active administrator, dee an ordinary member, outside both; the founder claimed. */
async function d54World() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.project("PROJ-H", "Hidden H");
  w.project("PROJ-D", "Discoverable D");
  w.m.projectClaimOwner({ projectId: "PROJ-H", memberId: "ann" });
  w.m.projectClaimOwner({ projectId: "PROJ-D", memberId: "ann" });
  w.m.projectInvite({ projectId: "PROJ-H", handle: "bob", by: "ann", viewer: V("ann") });
  w.m.projectJoin({ projectId: "PROJ-H", by: "bob", viewer: V("bob") });
  assert.equal(w.m.participationWrite("ownerOn", { projectId: "PROJ-H", memberId: "bob" }), true);
  w.m.projectInvite({ projectId: "PROJ-H", handle: "cal", by: "ann", viewer: V("ann") });
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  w.bundle("NOTE-H", "information", "a note in H", "PROJ-H");
  w.bundle("NOTE-D", "information", "a note in D", "PROJ-D");
  w.bundle("INFO-I");
  return w;
}
const ADMINS = [V("second"), "admin", V("admin")];

/* ---------------------------------------------------------------- the Terms, R43, R44 ------------------------------- */

test("R43 T41 an administrator, the founder included, sees a hidden project and its bundles only when invited or joined; a discoverable project stays seen whole (D54)", async () => {
  const w = await d54World();
  for (const v of ADMINS)
    assert.deepEqual(seen(w, v), ["INFO-I", "NOTE-D", "PROJ-D"], `${v}: neither H nor what belongs to it`);
  /* invited, then joined, then removed: the administrator's sight follows its participation */
  w.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.deepEqual(seen(w, V("second")), ["INFO-I", "NOTE-D", "NOTE-H", "PROJ-D", "PROJ-H"], "invited");
  w.m.projectJoin({ projectId: "PROJ-H", by: "second", viewer: V("second") });
  assert.ok(seen(w, V("second")).includes("NOTE-H"), "joined");
  w.m.projectRemove({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.ok(!seen(w, V("second")).includes("NOTE-H"), "removed: withheld again");
  /* the founder's participation is its own (`admin`'s rows), in both spellings */
  w.m.participationWrite("invite", { projectId: "PROJ-H", memberId: "admin", by: "ann" });
  for (const v of ["admin", V("admin")]) assert.ok(seen(w, v).includes("NOTE-H"), v);
  /* going hidden withholds D from the administrators at once; machine credentials see every bundle throughout */
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "hidden", by: "ann", viewer: V("ann") });
  assert.deepEqual(seen(w, V("second")), ["INFO-I"]);
  for (const c of ["admin", "member", "probe", "daemon", "ai"])
    assert.equal(seen(w, `${MACHINE_CLASS_PREFIX}${c}`).length, 5, c);
  /* negative control: an owner and an invited member see H whole; an ordinary member outside it, and a revoked
     administrator, do not see D either */
  assert.ok(seen(w, V("cal")).includes("NOTE-H"));
  w.m.projectVisibilitySet({ projectId: "PROJ-D", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.deepEqual(seen(w, V("dee")), ["INFO-I"]);
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.deepEqual(seen(w, V("second")), ["INFO-I"], "an inactive administrator is no administrator");
});

test("R44 T41 EXISTENCE has two forms: a member outside a discoverable project, and an administrator neither invited nor joined to a hidden one", async () => {
  const w = await d54World();
  for (const v of ADMINS) {
    assert.equal(w.m.sight("PROJ-H", v), EXISTENCE, `${v}: H`);
    assert.equal(w.m.sight("PROJ-D", v), FULL, `${v}: D`);
    assert.equal(w.m.sight("NOTE-H", v), NONE, `${v}: inside H, never widened`);
    assert.equal(w.m.inSight("NOTE-H", v), false, v);
    assert.equal(w.m.sight("PROJ-NEVER", v), NONE, `${v}: absent`);
  }
  assert.equal(w.m.sight("PROJ-D", V("dee")), EXISTENCE, "the first form: a member outside a discoverable project");
  /* a list, a count or a reverse edge is never widened: the owner arithmetic reads H as nothing */
  assert.equal(w.m.projectOwnerArithmetic({ projectId: "PROJ-H", viewer: V("second") }).live.owners, 0);
  /* negative control: an ordinary member outside hidden H, a viewer naming nobody, a revoked administrator: NONE */
  assert.equal(w.m.sight("PROJ-H", V("dee")), NONE);
  assert.equal(w.m.sight("PROJ-H", "junk"), NONE);
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.equal(w.m.sight("PROJ-H", V("second")), NONE);
  /* a participant is FULL, administrator or not */
  assert.equal(w.m.sight("PROJ-H", V("cal")), FULL);
});

/* ---------------------------------------------------------------- R77 ---------------------------------------------- */

test("R77 T41 C-70.1 carries `owners`, the owners' current handles in R65's order, for an administrator at a hidden project's EXISTENCE only", async () => {
  const w = await d54World();
  const row = PROJECT_VISIBILITY_CHECKS.PROJECT_SEEN_NOT_A_PARTICIPANT;
  for (const v of ADMINS) {
    const ex = w.m.existenceAct("PROJ-H", v);
    assert.deepEqual(ex, { ok: false, reason: "PROJECT_SEEN_NOT_A_PARTICIPANT", code: "PROJECT_SEEN_NOT_A_PARTICIPANT",
      check: "C-70.1", translation: row.translation, detail: ex.detail, project: "PROJ-H", name: "Hidden H",
      owners: ["ann", "bob"] }, v);
    /* no other participant, no state, nothing inside it */
    for (const secret of ["cal", "\"state\"", "NOTE-H"]) assert.ok(!JSON.stringify(ex).includes(secret), `${v} ${secret}`);
    /* every act of this module that names the project answers it, byte for byte, before anything else */
    const by = v === V("second") ? "second" : "admin";
    for (const act of [
      () => w.m.projectInvite({ projectId: "PROJ-H", handle: "dee", by, viewer: v }),
      () => w.m.projectJoin({ projectId: "PROJ-H", by, viewer: v }),
      () => w.m.projectLeave({ projectId: "PROJ-H", by, viewer: v }),
      () => w.m.projectRemove({ projectId: "PROJ-H", handle: "cal", by, viewer: v }),
      () => w.m.projectVisibilitySet({ projectId: "PROJ-H", setting: "discoverable", by, viewer: v }),
    ]) assert.deepEqual(act(), ex, v);
  }
  /* the current handle: a handle changed before T46 (DEC-197; no act changes one now, R129) is what the owners read */
  w.sql.exec(`UPDATE members SET handle='bob-2' WHERE member_id='bob'`);
  assert.deepEqual(w.m.existenceAct("PROJ-H", V("second")).owners, ["ann", "bob-2"]);
  /* negative control: the first form carries no `owners` key, and a hidden project answers nothing to a non-administrator */
  const first = w.m.existenceAct("PROJ-D", V("dee"));
  assert.equal("owners" in first, false);
  assert.deepEqual(Object.keys(first).sort(), ["check", "code", "detail", "name", "ok", "project", "reason", "translation"]);
  assert.equal(w.m.existenceAct("PROJ-H", V("dee")), null);
  assert.equal(w.m.existenceAct("PROJ-H", null), null, "an internal caller is not asked");
  /* C-70.1's translation is true of both forms, and names no plane, server, copy or instance (R112) */
  assert.doesNotMatch(row.translation, /can be found/);
  assert.doesNotMatch(row.translation, /\b(cop(y|ies)|instances?|planes?|servers?)\b/i);
});

/* ---------------------------------------------------------------- R88 ---------------------------------------------- */

test("R88 T41 hiddenBundles is no longer null for the founder's viewer: it names the hidden projects R43 withholds and the bundles belonging to them", async () => {
  const w = await d54World();
  const named = (hid) => w.rows(`SELECT bundle_id FROM bundles WHERE bundle_id IN ${hid.sql} ORDER BY bundle_id`, ...hid.args)
    .map((r) => r.bundle_id);
  for (const v of ADMINS) {
    const hid = hiddenBundles(v);
    assert.notEqual(hid, null, v);
    assert.deepEqual(named(hid), ["NOTE-H", "PROJ-H"], v);
    assert.equal(w.m.counts(hid).projectParticipants, 1, `${v}: D's one participant row, H's three subtracted`);
  }
  /* negative control: a machine credential's is still null, and an owner of H is withheld nothing */
  assert.equal(hiddenBundles(`${MACHINE_CLASS_PREFIX}admin`), null);
  assert.deepEqual(named(hiddenBundles(V("ann"))), []);
});

/* ---------------------------------------------------------------- R18 ---------------------------------------------- */

test("R18 T41 an administrator's roster never lists a hidden project's participants to an administrator not in it; only its owners", async () => {
  const w = await d54World();
  const projects = (viewer, id) => w.m.memberList({ administer: true, viewer }).members.find((r) => r.member_id === id).projects;
  for (const v of ADMINS) {
    assert.deepEqual(projects(v, "ann"), [{ project: "PROJ-D", state: "joined", owner: true },
                                          { project: "PROJ-H", state: null, owner: true, existence: true }], v);
    assert.deepEqual(projects(v, "bob"), [{ project: "PROJ-H", state: null, owner: true, existence: true }], v);
    assert.deepEqual(projects(v, "cal"), [], `${v}: cal's invitation to H is not listed`);
  }
  /* negative control: an administrator invited to H reads it whole */
  w.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.deepEqual(projects(V("second"), "cal"), [{ project: "PROJ-H", state: "invited", owner: false }]);
  assert.deepEqual(projects(V("second"), "bob"), [{ project: "PROJ-H", state: "joined", owner: true }]);
});

/* ---------------------------------------------------------------- R60 ---------------------------------------------- */

test("R60 T41 an administrator's sight is never a position, and the acts it holds stay reachable at a hidden project's EXISTENCE, without its contents", async () => {
  const w = await d54World();
  /* the rescue's fact (R75, read by project-roster R5) answers its own conditions at EXISTENCE, never NO_SUCH_PROJECT */
  for (const by of ["second", "admin"]) {
    const r = w.m.rescueRefusal("PROJ-H", by);
    assert.deepEqual([r.reason, r.active], ["OWNERS_ARE_ACTIVE", ["ann", "bob"]], by);
  }
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id IN ('ann','bob')`);
  assert.equal(w.m.rescueRefusal("PROJ-H", "second"), null, "every owner inactive: the rescue may proceed");
  assert.equal(w.m.sight("PROJ-H", V("second")), EXISTENCE, "and the administrator still sees only that H exists");
  /* no position: EXISTENCE grants no act inside it, and no read of its contents */
  assert.equal(w.m.projectAuthority("PROJ-H", V("second"), "joined", "an act").code, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(w.m.projectAuthority("PROJ-H", V("second"), "owner", "an act").code, "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(w.m.isProjectEditor("PROJ-H", "second"), false);
  assert.equal(w.m.inSight("NOTE-H", V("second")), false);
  /* negative control: an ordinary member is refused the rescue as not an administrator, and is at NONE */
  assert.equal(w.m.rescueRefusal("PROJ-H", "dee").reason, "NOT_AN_ADMIN");
  assert.equal(w.m.sight("PROJ-H", V("dee")), NONE);
});

/* ---------------------------------------------------------------- R120 --------------------------------------------- */

test("R120 T41 the sight the contract tables give is R43's: an administrator is admitted to a hidden project only when invited or joined; the index holds no admission, so the boot's rewrite changes no setting", async () => {
  const w = await d54World();
  /* `project_sight` is (project_id, setting) and nothing else: no per-member admission to rewrite (the migration is
     the boot's reindex, a no-op on the rows) */
  assert.deepEqual(w.rows(`PRAGMA table_info(project_sight)`).map((c) => c.name), ["project_id", "setting"]);
  const sight = () => w.rows(`SELECT * FROM project_sight ORDER BY project_id`);
  const before = sight(), visibility = w.rows(`SELECT * FROM project_visibility ORDER BY seq`);
  assert.deepEqual(before, [{ project_id: "PROJ-D", setting: "discoverable" }, { project_id: "PROJ-H", setting: "hidden" }]);
  const store = snapshot(w);
  w.m.migrate();
  assert.deepEqual(sight(), before, "a second boot's index is byte-identical");
  assert.deepEqual(w.rows(`SELECT * FROM project_visibility ORDER BY seq`), visibility, "no project's setting changes");
  assert.equal(snapshot(w), store, "the boot writes nothing else");
  /* the contract's columns stand, by name */
  const cols = (t) => w.rows(`PRAGMA table_info(${t})`).map((c) => c.name);
  for (const [t, want] of [["members", ["member_id", "handle", "status"]],
    ["project_participants", ["project_id", "member_id", "state", "owner", "owner_order", "invited_by", "comment", "created"]],
    ["project_visibility", ["seq", "project_id", "setting", "set_by", "reason", "at"]],
    ["project_removals", ["seq", "project_id", "member_id", "removed_by", "comment", "at"]]])
    for (const c of want) assert.ok(cols(t).includes(c), `${t}.${c}`);
  /* a reader joining the contract tables decides an administrator's sight as R43 does: participation, or discoverable */
  const joined = (member) => w.rows(
    `SELECT ps.project_id FROM project_sight ps
      WHERE EXISTS (SELECT 1 FROM project_participants pp WHERE pp.project_id = ps.project_id AND pp.member_id = ?)
         OR ps.setting = 'discoverable' ORDER BY ps.project_id`, member).map((r) => r.project_id);
  const byR43 = (v) => ["PROJ-D", "PROJ-H"].filter((p) => w.m.inSight(p, v));
  assert.deepEqual(joined("second"), byR43(V("second")));
  w.m.projectInvite({ projectId: "PROJ-H", handle: "second", by: "ann", viewer: V("ann") });
  assert.deepEqual(joined("second"), byR43(V("second")));
  assert.deepEqual(byR43(V("second")), ["PROJ-D", "PROJ-H"]);
  /* negative control: the administrator's role alone admits nothing hidden */
  assert.deepEqual(byR43(V("dee")), [], "dee, not an administrator, outside both");
  w.sql.exec(`UPDATE members SET role='admin' WHERE member_id='dee'`);
  assert.deepEqual(byR43(V("dee")), ["PROJ-D"], "made an administrator: D only, not hidden H");
});

/* ---------------------------------------------------------------- R123, R126 ---------------------------------------- */

test("R126 R123 T41 T46 R151 HANDLE_CHECK_PAUSED's translation is the words of handle.refused.paused, read by key (DEC-188 (7)), its row C-96.48; the two refusals R124 read by key are retired with it", async () => {
  const words = await wordsJson();
  const en = (k) => words.find((x) => x.key === k).en;
  assert.equal(MEMBERSHIP_CHECKS.HANDLE_CHECK_PAUSED.translation, en("handle.refused.paused"), "the key's words, placeholder left");
  assert.equal(MEMBERSHIP_CHECKS.HANDLE_CHECK_PAUSED.check, "C-96.48");
  assert.ok(HELD.includes("handle.refused.paused"));
  /* negative control (T46, DEC-197): no row reads handle.refused.notmember or handle.refused.unchecked, nor reads handle.fixed */
  for (const key of ["handle.refused.notmember", "handle.refused.unchecked", "handle.fixed"])
    assert.equal(HELD.includes(key), false, key);
  for (const code of ["HANDLE_CHANGE_NOT_A_MEMBER", "HANDLE_CHANGE_UNCHECKED"]) assert.equal(code in MEMBERSHIP_CHECKS, false, code);
});

test("R123 T41 HANDLE_CHECK_PAUSED answers handle.refused.paused with `minutes`, the whole minutes until retryAfter, rounded up", async (t) => {  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 9, 12, 0, 0) });
  const w = await world().group("ann");
  const inv = (await w.m.memberAdd({ memberId: "cal", cover: "c", by: "admin" })).invite;
  for (let i = 0; i < 60; i++) await w.m.handleCheck({ invite: inv, handle: `h-${i}` });
  const p = await w.m.handleCheck({ invite: inv, handle: "x-y" });
  assert.deepEqual([p.reason, p.translation], ["HANDLE_CHECK_PAUSED", MEMBERSHIP_CHECKS.HANDLE_CHECK_PAUSED.translation]);
  assert.match(p.translation, /\{minutes\}/, "the placeholder is left for the screen");
  assert.equal(p.minutes, Math.ceil(p.retryAfter / 60));
  assert.ok(Number.isInteger(p.minutes) && p.minutes >= 1 && p.minutes <= 21, String(p.minutes));
  /* negative control: an answered check carries no `minutes` */
  t.mock.timers.setTime(Date.now() + p.retryAfter * 1000);
  const ok = await w.m.handleCheck({ invite: inv, handle: "x-y" });
  assert.deepEqual([ok.ok, "minutes" in ok], [true, false]);
});
