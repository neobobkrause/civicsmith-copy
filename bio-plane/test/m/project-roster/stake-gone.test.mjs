/* R31, R32 (T50; N933; K3230): the project's declared stake, its read and its history; R33 (T50; N1124): whether a
   project's owners are all gone, and since when. At the interface: the acts and reads as each caller of a battery. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, snapshot } from "./fixture.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { stakeFault } from "../../../src/project-roster/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { noSuchProject } from "../../../src/membership/index.mjs";

const set = (w, by, stake, projectId = "PROJ-P", viewer = V(by)) => w.r.projectStakeSet({ projectId, stake, by, viewer });

/* P (hidden): ann owns it, bob joined, cal invited only; dee outside. */
async function stakeWorld() {
  const w = await world().group("ann", "bob", "cal", "dee");
  w.owned("PROJ-P", "ann", ["bob"], ["cal"]);
  return w;
}

test("R31 a joined participant's set and an administrator's set (at FULL sight) are each read back by R32 with by and at; stake: null clears it", async () => {
  const w = await stakeWorld();
  w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "discoverable", by: "ann", viewer: V("ann") });
  w.time.now = Date.parse("2026-04-01T00:00:00.000Z");
  const a = set(w, "bob", "  We rent next to the site.  ");
  assert.deepEqual([a.ok, a.stake, a.by, a.at], [true, "We rent next to the site.", "bob", "2026-04-01T00:00:00.000Z"]);
  w.time.now += 1000;
  assert.equal(set(w, "second", "The team's lawyer is a party.").ok, true, "an administrator at FULL");
  w.time.now += 1000;
  assert.equal(set(w, "admin", "The founder's own.", "PROJ-P", "admin").ok, true, "the founder at FULL");
  w.time.now += 1000;
  assert.equal(set(w, "ann", null).stake, null);
  const s = w.r.projectStake("PROJ-P");
  assert.deepEqual([s.stake, s.set_by, s.set_at], [null, "ann", "2026-04-01T00:00:03.000Z"]);
  assert.deepEqual(s.history.map((h) => [h.stake, h.set_by]), [["We rent next to the site.", "bob"],
    ["The team's lawyer is a party.", "second"], ["The founder's own.", null], [null, "ann"]], "oldest first; the founder, holding no handle, null");
  w.founderHandle("foundress");
  assert.equal(w.r.projectStake("PROJ-P").history[2].set_by, "foundress");
  assert.doesNotMatch(JSON.stringify(w.r.projectStake("PROJ-P")), /"admin"/);
});

test("R31 refusals, in order, each writing nothing: sight first, a machine credential, a participant who has not joined, malformed text", async () => {
  const w = await stakeWorld();
  const refused = (act, reason) => {
    const before = snapshot(w);
    const r = act();
    assert.equal(r.ok, false);
    assert.equal(r.reason, reason, reason);
    assert.equal(snapshot(w), before, `${reason} wrote nothing`);
    return r;
  };
  /* sight answers first: a project the caller cannot see answers byte for byte as an id naming nothing */
  assert.deepEqual(refused(() => set(w, "dee", "x"), "NO_SUCH_PROJECT"), noSuchProject("PROJ-P"));
  assert.deepEqual(refused(() => set(w, "ann", "x", "NOPE", V("dee")), "NO_SUCH_PROJECT"), noSuchProject("NOPE"));
  const m = `${MACHINE_CLASS_PREFIX}ai`;
  const machine = refused(() => set(w, m, "x", "PROJ-P", m), "MACHINE_CANNOT_SET_STAKE");
  assert.equal(machine.check, "C-147.9");
  assert.equal(machine.translation, word("refusal.MACHINE_CANNOT_SET_STAKE"));
  refused(() => set(w, null, "x", "PROJ-P", V("ann")), "MACHINE_CANNOT_SET_STAKE");
  refused(() => set(w, "cal", "x"), "PROJECT_ACT_NOT_A_PARTICIPANT");
  /* an administrator below FULL (hidden P, not in it) is refused as a non-participant is: no sight, no act */
  assert.equal(set(w, "second", "x").ok, false);
  for (const bad of ["x".repeat(1001), "two\nlines", "tab\there", "", "   ", 5, undefined, {}, "nul\u0000l"]) {
    const r = refused(() => set(w, "bob", bad), "STAKE_MALFORMED");
    assert.equal(r.check, "C-147.10");
    assert.equal(r.translation, word("refusal.STAKE_MALFORMED.project"));
  }
  /* controls: the same acts land with a valid stake, the boundary lengths included */
  assert.equal(set(w, "bob", "x").ok, true);
  assert.equal(set(w, "bob", "y".repeat(1000)).ok, true, "1,000 characters");
  assert.equal(w.r.projectStake("PROJ-P").history.length, 2);
  assert.equal(w.ops(`projectId=PROJ-P&stake=${encodeURIComponent("through the op")}&by=bob&viewer=${encodeURIComponent(V("bob"))}`)
    .projectstakeset().ok, true);
  assert.equal(w.ops(`projectId=PROJ-P&stake=null&by=bob&viewer=${encodeURIComponent(V("bob"))}`).projectstakeset().stake, null);
  assert.equal(w.ops(`projectId=PROJ-P&by=bob&viewer=${encodeURIComponent(V("bob"))}`).projectstakeset().reason, "STAKE_MALFORMED");
});

test("R32 projectStake: two sets and a clear answer three history rows and stake null; no record and an id naming nothing answer none; an unreadable record answers \"undetermined\", never null", async () => {
  const w = await stakeWorld();
  const none = { stake: null, set_by: null, set_at: null, history: [] };
  assert.deepEqual(w.r.projectStake("PROJ-P"), none);
  assert.deepEqual(w.r.projectStake("NOPE"), none);
  for (const bad of [undefined, null, "", 5, {}]) assert.deepEqual(w.r.projectStake(bad), none, String(bad));
  set(w, "ann", "one"); set(w, "bob", "two"); set(w, "ann", null);
  const s = w.r.projectStake("PROJ-P");
  assert.deepEqual([s.stake, s.history.length], [null, 3]);
  const before = snapshot(w);
  w.r.projectStake("PROJ-P");
  assert.equal(snapshot(w), before, "a read writes nothing");
  w.sql.exec(`DROP TABLE project_stakes`);
  assert.equal(w.r.projectStake("PROJ-P").stake, "undetermined", "an unreadable record");
  assert.equal(w.r.projectStake("NOPE").stake, "undetermined");
});

test("R32 projectStakeHistory: every participant reads the history, as R8 reads visibility; a caller below FULL gets the absent answer", async () => {
  const w = await stakeWorld();
  set(w, "ann", "ours");
  for (const viewer of [V("ann"), V("bob"), V("cal")]) {
    const h = w.r.projectStakeHistory({ projectId: "PROJ-P", viewer });
    assert.deepEqual([h.ok, h.stake, h.history.length, h.history[0].set_by], [true, "ours", 1, "ann"], viewer);
  }
  for (const viewer of [V("dee"), V("second"), "admin", "junk", null, undefined])
    assert.deepEqual(w.r.projectStakeHistory({ projectId: "PROJ-P", viewer }), noSuchProject("PROJ-P"), String(viewer));
  assert.deepEqual(w.r.projectStakeHistory({ projectId: "NOPE", viewer: V("ann") }), noSuchProject("NOPE"));
  w.bundle("INFO-I");
  assert.equal(w.r.projectStakeHistory({ projectId: "INFO-I", viewer: V("ann") }).reason, "NOT_A_PROJECT");
  assert.deepEqual(w.ops(`projectId=PROJ-P&viewer=${encodeURIComponent(V("bob"))}`).projectstake(),
    w.r.projectStakeHistory({ projectId: "PROJ-P", viewer: V("bob") }));
});

const gone = (w, viewer, projectId = "PROJ-P") => w.r.projectOwnersGone({ projectId, viewer });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("R33 a project whose two owners are revoked at two instants answers gone: true and the later instant; with one owner still active gone: false and since null", async () => {
  const w = await stakeWorld();
  assert.equal(w.r.projectOwnerAdd({ projectId: "PROJ-P", handle: "bob", by: "ann", viewer: V("ann") }).ok, true);
  assert.deepEqual(w.m.projectOwners("PROJ-P"), ["ann", "bob"]);
  assert.deepEqual(gone(w, V("second")), { ok: true, projectId: "PROJ-P", gone: false, since: null }, "all active");
  w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" });
  assert.deepEqual(gone(w, V("second")), { ok: true, projectId: "PROJ-P", gone: false, since: null }, "bob still active");
  await sleep(15);
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  const later = w.m.memberStatusSince("bob");
  const earlier = w.m.memberStatusSince("ann");
  assert.ok(earlier < later);
  for (const viewer of [V("second"), "admin", V("admin")]) {
    const g = gone(w, viewer);
    assert.deepEqual(g, { ok: true, projectId: "PROJ-P", gone: true, since: later }, `${viewer}: an administrator at EXISTENCE of the hidden project, or the founder`);
  }
  /* the instant is never invented: an owner whose instant is not recorded answers null */
  const real = w.m.memberStatusSince.bind(w.m);
  w.m.memberStatusSince = (id) => (id === "ann" ? null : real(id));
  assert.equal(gone(w, V("second")).since, null);
  w.m.memberStatusSince = undefined;
  assert.equal(gone(w, V("second")).since, null, "membership offering none: null, no stand-in");
});

test("R33 control: a plain member, a participant, an outsider, no viewer, a machine and an id naming nothing get the absent answer; it names nothing at EXISTENCE and writes nothing", async () => {
  const w = await stakeWorld();
  for (const viewer of [V("ann"), V("bob"), V("cal"), V("dee"), "junk", null, undefined, `${MACHINE_CLASS_PREFIX}ai`])
    assert.deepEqual(gone(w, viewer), noSuchProject("PROJ-P"), String(viewer));
  assert.deepEqual(gone(w, V("second"), "NOPE"), noSuchProject("NOPE"));
  assert.deepEqual(gone(w, "admin", "NOPE"), noSuchProject("NOPE"));
  w.bundle("INFO-I");
  assert.equal(gone(w, V("second"), "INFO-I").ok, false);
  assert.deepEqual(Object.keys(gone(w, V("second"))).sort(), ["gone", "ok", "projectId", "since"], "at EXISTENCE: nothing of the project");
  /* at FULL (discoverable) the same answer */
  w.m.projectVisibilitySet({ projectId: "PROJ-P", setting: "discoverable", by: "ann", viewer: V("ann") });
  assert.equal(gone(w, V("second")).gone, false);
  const before = snapshot(w);
  for (const viewer of [V("second"), {}, Symbol("x")]) for (const projectId of ["PROJ-P", undefined, {}, 5]) gone(w, viewer, projectId);
  assert.equal(snapshot(w), before);
  /* a project created without an owner is not stranded */
  w.project("PROJ-M");
  assert.equal(gone(w, V("second"), "PROJ-M").gone, false);
  assert.deepEqual(w.ops(`projectId=PROJ-P&viewer=${encodeURIComponent(V("second"))}`).projectownersgone(), gone(w, V("second")));
});

test("R31 stakeFault({by, stake, of}) is pure and answers null for a member's stamp and a well-formed stake (1,000 characters included), else the one refusal projectStakeSet answers, each equal", async () => {
  const w = await stakeWorld();
  const m = `${MACHINE_CLASS_PREFIX}ai`;
  /* control: a member's stamp with null, a one-line stake and one of exactly 1,000 characters pass */
  for (const stake of [null, "ours", "  padded  ", "y".repeat(1000)]) assert.equal(stakeFault({ by: "bob", stake }), null, String(stake).slice(0, 12));
  assert.equal(stakeFault({ by: "bob", stake: "y".repeat(1000), of: "action" }), null);
  /* each refusal through stakeFault equals the one projectStakeSet answers */
  const cases = [[m, "x", V(m)], [null, "x", V("bob")], ["bob", "x".repeat(1001), V("bob")], ["bob", "a\nb", V("bob")], ["bob", "", V("bob")], ["bob", 5, V("bob")]];
  for (const [by, stake, viewer] of cases) {
    const viaAct = w.r.projectStakeSet({ projectId: "PROJ-P", stake, by, viewer: by === m ? m : viewer });
    const fault = stakeFault({ by, stake, projectId: "PROJ-P" });
    assert.deepEqual(fault, viaAct, `${String(by)} ${String(stake).slice(0, 8)}`);
    assert.deepEqual(stakeFault({ by, stake }), { ...fault, project: null }, "without a project id");
  }
  /* of: 'action' reads its own word by key, null while the list lacks it, never inline English */
  const a = stakeFault({ by: "bob", stake: "a\nb", of: "action" });
  assert.equal(a.reason, "STAKE_MALFORMED");
  assert.equal(a.translation === null, !hasWord("refusal.STAKE_MALFORMED.action"));
  assert.equal(stakeFault({ by: m, stake: "x", of: "action" }).reason, "MACHINE_CANNOT_SET_STAKE");
});
