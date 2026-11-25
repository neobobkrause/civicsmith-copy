import { test } from "node:test";
import assert from "node:assert/strict";
import { world, snapshot } from "./fixture.mjs";
import { MEMBER_ROSTER_ROWS } from "../../../src/member-roster/checks.mjs";
const { MEMBERSHIP_CHECKS } = MEMBER_ROSTER_ROWS;
import { word } from "../../../src/setup-words/index.mjs";

test("R17 expertiseDeclare: the member's own act; refusals; labels normalised", async () => {
  const w = await world().group("ann", "bob");
  w.m.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  assert.equal(w.m.expertiseDeclare({ memberId: "nobody", label: "CPA" }).reason, "NO_SUCH_MEMBER");
  assert.equal(w.m.expertiseDeclare({ memberId: "bob", label: "CPA" }).reason, "NOT_ACTIVE");
  /* N285: the no-label refusal is its own code with its own row, never the shared NO_LABEL; nothing is written. */
  const row = { check: "C-96.13", where: "src/member-roster/index.mjs #noLabel > is-expertise-labelled",
                translation: word("refusal.EXPERTISE_NO_LABEL") };
  assert.deepEqual({ ...MEMBERSHIP_CHECKS.EXPERTISE_NO_LABEL }, row);
  for (const label of [undefined, null, "", "  \n ", "\t\t"]) {
    const r = w.m.expertiseDeclare({ memberId: "ann", label });
    assert.deepEqual(r, { ok: false, reason: "EXPERTISE_NO_LABEL", code: "EXPERTISE_NO_LABEL", check: row.check,
                          translation: row.translation, detail: "a declaration needs a label, such as 'CPA'" });
  }
  assert.equal(w.row(`SELECT count(*) AS n FROM member_expertise WHERE member_id='ann'`).n, 0);
  const d = w.m.expertiseDeclare({ memberId: "ann", label: "  Certified   Public\tAccountant " });
  assert.deepEqual([d.ok, d.label, d.state], [true, "Certified Public Accountant", "declared"]);
  assert.equal(w.m.expertiseDeclare({ memberId: "ann", label: "Certified Public Accountant" }).reason, "ALREADY_DECLARED");
  w.m.expertiseConfirm({ memberId: "ann", label: "Certified Public Accountant", by: "admin" });
  assert.equal(w.m.expertiseDeclare({ memberId: "ann", label: "Certified Public Accountant" }).reason, "ALREADY_DECLARED");
  assert.equal(w.m.expertiseDeclare({ memberId: "ann", label: "x".repeat(200) }).label.length, 120);
  assert.equal(w.row(`SELECT actor FROM member_expertise WHERE member_id='ann' ORDER BY seq LIMIT 1`).actor, "ann");
});

test("R18 expertiseConfirm: NOT_AN_ADMIN (R28), NO_SUCH_MEMBER, NOT_DECLARED, ALREADY_CONFIRMED, NOT_CONFIRMED; admin for admin", async () => {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  assert.equal(w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "ann" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.m.expertiseConfirm({ memberId: "nobody", label: "CPA", by: "admin" }).reason, "NO_SUCH_MEMBER");
  assert.equal(w.m.expertiseConfirm({ memberId: "ann", label: "Lawyer", by: "admin" }).reason, "NOT_DECLARED");
  assert.equal(w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin", withdraw: true }).reason, "NOT_CONFIRMED");
  const c = w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "second" });
  assert.deepEqual([c.ok, c.state, c.by], [true, "confirmed", "second"]);
  assert.equal(w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" }).reason, "ALREADY_CONFIRMED");
  w.m.expertiseDeclare({ memberId: "second", label: "Engineer" });
  assert.equal(w.m.expertiseConfirm({ memberId: "second", label: "Engineer", by: "admin" }).ok, true);
});

test("R19 every declaration, confirmation and withdrawal is a new entry, none overwritten", async () => {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" });
  w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "second", withdraw: true });
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  assert.deepEqual(w.rows(`SELECT event, actor FROM member_expertise ORDER BY seq`).map((r) => [r.event, r.actor]),
    [["declared", "ann"], ["confirmed", "admin"], ["withdrawn", "second"], ["declared", "ann"]]);
});

test("R20 expertiseList: per label the state, who and when, the full history; expertise gates nothing", async () => {
  const w = await world().group("ann");
  w.m.expertiseDeclare({ memberId: "ann", label: "CPA" });
  w.m.expertiseDeclare({ memberId: "ann", label: "Architect" });
  w.m.expertiseConfirm({ memberId: "ann", label: "CPA", by: "admin" });
  const l = w.m.expertiseList({ memberId: "ann" });
  assert.equal(l.gates, "nothing");
  assert.deepEqual(l.expertise.map((e) => [e.label, e.state, e.confirmed, e.by, e.history.map((h) => h.event)]),
    [["Architect", "declared", false, "ann", ["declared"]], ["CPA", "confirmed", true, "admin", ["declared", "confirmed"]]]);
  for (const e of l.expertise) assert.match(e.at, /^\d{4}-/);
  // gates nothing: capabilities and sight are the same with and without it
  const rightsBefore = w.m.sessionRights("member:ann");
  w.m.expertiseConfirm({ memberId: "ann", label: "Architect", by: "admin" });
  assert.deepEqual(w.m.sessionRights("member:ann"), rightsBefore);
});

test("R72 expertiseHolders(label): the active members whose latest entry is declared or confirmed, in member-id order; a withdrawn one and a revoked member's are not listed", async () => {
  const w = await world().group("ann", "bob", "cal", "dee");
  /* ann declares, bob declares and is confirmed, cal declares, is confirmed and withdrawn, dee declares and is then revoked */
  for (const id of ["dee", "cal", "bob", "ann"]) w.m.expertiseDeclare({ memberId: id, label: "CPA" });
  w.m.expertiseConfirm({ memberId: "bob", label: "CPA", by: "admin" });
  w.m.expertiseConfirm({ memberId: "cal", label: "CPA", by: "admin" });
  w.m.expertiseConfirm({ memberId: "cal", label: "CPA", by: "admin", withdraw: true });
  w.m.memberSet({ memberId: "dee", status: "revoked", by: "admin" });
  const before = snapshot(w);
  assert.deepEqual(w.m.expertiseHolders("CPA"), [
    { memberId: "ann", handle: "ann", state: "declared" }, { memberId: "bob", handle: "bob", state: "confirmed" }]);
  /* the label is normalised as R17 does it */
  assert.deepEqual(w.m.expertiseHolders("  CPA \t"), w.m.expertiseHolders("CPA"));
  /* a withdrawn entry declared again is held again */
  w.m.expertiseDeclare({ memberId: "cal", label: "CPA" });
  assert.deepEqual(w.m.expertiseHolders("CPA").map((h) => [h.memberId, h.state]),
    [["ann", "declared"], ["bob", "confirmed"], ["cal", "declared"]]);
  /* a member with no handle yet is listed with a null handle only if active: set one up directly */
  w.sql.exec(`UPDATE members SET handle=NULL WHERE member_id='ann'`);
  assert.equal(w.m.expertiseHolders("CPA")[0].handle, null);
  /* it asks no sight and writes nothing */
  const after = snapshot(w);
  w.m.expertiseHolders("CPA");
  assert.equal(snapshot(w), after);
  assert.notEqual(before, after, "(the fixture changed between the two snapshots, the read did not)");
  /* controls: a label nobody holds is []; an empty one is refused EXPERTISE_NO_LABEL, row C-96.13, writing nothing */
  assert.deepEqual(w.m.expertiseHolders("Architect"), []);
  for (const label of [undefined, null, "", "  \n ", "\t\t"]) {
    const r = w.m.expertiseHolders(label);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
      [false, "EXPERTISE_NO_LABEL", "EXPERTISE_NO_LABEL", "C-96.13", MEMBERSHIP_CHECKS.EXPERTISE_NO_LABEL.translation]);
  }
  assert.equal(snapshot(w), after);
  /* it never throws: a store that cannot be read answers [] */
  const broken = world();
  broken.sql.exec(`DROP TABLE member_expertise`);
  assert.deepEqual(broken.m.expertiseHolders("CPA"), []);
});
