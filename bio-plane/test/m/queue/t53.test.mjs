/* T53 at queue's interface: R1's two undismissable to-dos (`retesting-off`, `ai-credits-stop`; K5480, K5478) and R98's four
   register kinds (`notice-producers` R30, R31; N1259, K4403 (7)), each classed with its one sentence, minted, disposed and
   muted as its requirement states. `notice-producers` does not yet mint the register kinds on tranche (its R30, R31 not yet
   met), so their items reach the feed through the `notices` stub in the shape its R1 publishes, as `investigation.test.mjs`
   does for R16's and R17's kinds. Each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { classOfKind, QUEUE_OBLIGATION_KINDS, QUEUE_FINDING_KINDS } from "../../../src/queuestate.mjs";

const REGISTER = ["register-changed-noticed", "register-import-done", "register-import-stopped", "register-import-failed"];

function noticed(items) {
  const w = world({ notices: { noticeItems: (a) => ({ facts: {}, items: items.map(({ home, ...it }) => ({
    ...it, case: a.homesOf(home ? [home] : []), summary: it.kind, detail: null,
    basis: { source: "notice-producers", detail: "stubbed as its requirement keys it" },
    age: { state: "determined", since: iso(NOW - 1000), ms: 1000 }, assignee: null, assignee_role: null,
    options: a.optionsOf(home ? [home] : []) })) }) } });
  for (const m of ["alice", "bob"]) w.member(m);
  w.bundle("PRJ-A", "project"); w.join("PRJ-A", "alice"); w.join("PRJ-A", "bob");
  w.bundle("REG-1"); w.cite("PRJ-A", "REG-1");
  return w;
}
const item = (kind, home = "REG-1", tag = "1") => ({ id: `${classOfKind(kind)}::${kind}::${tag}`, class: classOfKind(kind),
  kind, subject: { kind: "bundle", id: home }, home });

test("R1 (T53): retesting-off and ai-credits-stop answer OBLIGATION, each with its one sentence", () => {
  for (const k of ["retesting-off", "ai-credits-stop"]) {
    assert.equal(classOfKind(k), "OBLIGATION", k);
    assert.ok(QUEUE_OBLIGATION_KINDS[k].trim().length > 0, k);
  }
  assert.match(QUEUE_OBLIGATION_KINDS["retesting-off"], /re-testing of the AIs off/);
  assert.match(QUEUE_OBLIGATION_KINDS["ai-credits-stop"], /gateway call was not paid by the team's own key/);
  // control: near-misses and published ids are no kind
  for (const v of ["retesting", "retesting_off", "ai-credits", "ai-credit-stop", "OBLIGATION::retesting-off"])
    assert.equal(classOfKind(v), null, v);
});

test("R1 (T53): muting retesting-off or ai-credits-stop by its published id, or by kind, is refused KIND_NOT_PERSONAL", () => {
  const w = noticed([]);
  for (const k of ["retesting-off", "ai-credits-stop"]) {
    const byItem = w.q.queueMute({ member: "alice", viewer: "member:alice", item: `OBLIGATION::${k}::x` });
    assert.deepEqual([byItem.ok, byItem.reason], [false, "KIND_NOT_PERSONAL"], k);
    const byKind = w.q.queueMute({ member: "alice", viewer: "member:alice", case: "PRJ-A", kinds: [k] });
    assert.deepEqual([byKind.ok, byKind.reason], [false, "KIND_NOT_PERSONAL"], k);
  }
  // control: an uncatalogued kind is still refused NO_SUCH_KIND at the mint
  const v = noticed([{ ...item("explore-ask"), id: "FINDING::retesting-of::1", kind: "retesting-of" }]).feed("alice");
  assert.deepEqual([v.ok, v.reason], [false, "NO_SUCH_KIND"]);
});

test("R1 (T53): a retesting-off and an ai-credits-stop item are minted among the to-dos", () => {
  const w = noticed([item("retesting-off", null), item("ai-credits-stop", null)]);
  const f = w.feed("alice");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  assert.deepEqual(f.items.map((i) => [i.class, i.kind]).sort(), [["OBLIGATION", "ai-credits-stop"], ["OBLIGATION", "retesting-off"]]);
  for (const i of f.items) assert.equal(i.disposition.available, false, i.kind);
});

test("R98: the four register kinds answer FINDING, each with its one sentence", () => {
  for (const k of REGISTER) {
    assert.equal(classOfKind(k), "FINDING", k);
    assert.ok(QUEUE_FINDING_KINDS[k].trim().length > 0, k);
  }
  for (const v of ["register-changed", "register-import", "register-import-ended", "FINDING::register-import-done"])
    assert.equal(classOfKind(v), null, v);
});

test("R98: each register item is minted, homed under its project with its options, and disposed as watched-changed is: queuemute, no project scope", () => {
  const w = noticed([...REGISTER.map((k) => item(k)), item("watched-changed"), item("security-level-high")]);
  const f = w.feed("alice");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const it = byId(f);
  const watched = it[item("watched-changed").id].disposition;
  for (const k of REGISTER) {
    const i = it[item(k).id];
    assert.ok(i, k);
    assert.equal(i.class, "FINDING");
    assert.deepEqual(i.case.ancestors.map((a) => a.id), ["PRJ-A"], k);
    const d = i.disposition;
    assert.deepEqual([d.available, d.op, d.scope, d.key, d.instead], [false, null, null, null, "queuemute"], k);
    assert.deepEqual([d.available, d.scope, d.instead], [watched.available, watched.scope, watched.instead]);
    assert.equal(d.projects, undefined, k);
  }
  // control: another FINDING under the same home keeps R12's project-scoped disposition
  const other = it[item("security-level-high").id].disposition;
  assert.deepEqual([other.available, other.scope, other.projects], [true, "project", ["PRJ-A"]]);
});

test("R98: a muted register item leaves the member's feed, is listed in her muted list by its kind, and nobody else's feed moves", () => {
  const w = noticed(REGISTER.map((k) => item(k)));
  const id = item("register-import-failed").id;
  const m = w.q.queueMute({ member: "alice", viewer: "member:alice", item: id });
  assert.deepEqual([m.ok, m.item_class], [true, "FINDING"]);
  const g = w.feed("alice");
  assert.equal(byId(g)[id], undefined);
  assert.deepEqual(g.mute.suppressed.map((s) => s.id), [id]);
  const list = w.q.queueFeed({ member: "alice", viewer: "member:alice", muted: true });
  assert.deepEqual(list.muted.map((r) => [r.item, r.kind]), [[id, "register-import-failed"]]);
  // muting the kind in the project is accepted too, and suppresses the rest
  const k = w.q.queueMute({ member: "alice", viewer: "member:alice", case: "PRJ-A", kinds: ["register-changed-noticed"] });
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(byId(w.feed("alice"))[item("register-changed-noticed").id], undefined);
  // control: bob's feed holds all four
  const b = byId(w.feed("bob"));
  for (const r of REGISTER) assert.ok(b[item(r).id], r);
});
