/* Layer 11 reopen (T53; notice-producers R33-R36): the six FINDING kinds notice-producers' R33-R36 mint (a threshold alert,
   a terms notice, an AI account that left a list or a project's list, a project sign-in account that ended, and unconfirmed
   mail removed) are catalogued by R1, so a member's feed holding one is minted (R11) and not refused whole `NO_SUCH_KIND`.
   Each is told to whom it concerns and quieted by its recipient (R12's account door, as `ai-limit-reached`; `mail-cleared`
   as `watched-changed`, told to its owner alone). `notice-producers` does not yet mint these kinds on the layer (its R33-R36
   not yet met), so their items reach the feed through the `notices` stub in the shape its R1 publishes, as `t53.test.mjs`
   does for R98's register kinds. Each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { classOfKind, QUEUE_FINDING_KINDS } from "../../../src/queuestate.mjs";

const ACCOUNT = ["ai-threshold-reached", "ai-terms-notice", "ai-account-left-list", "ai-account-left-project-list", "ai-signin-ended"];
const KINDS = [...ACCOUNT, "mail-cleared"];

function noticed(items) {
  const w = world({ notices: { noticeItems: (a) => ({ facts: {}, items: items.map(({ home, ...it }) => ({
    ...it, case: a.homesOf(home ? [home] : []), summary: it.kind, detail: null,
    basis: { source: "notice-producers", detail: "stubbed as its requirement keys it" },
    age: { state: "determined", since: iso(NOW - 1000), ms: 1000 }, assignee: null, assignee_role: null,
    options: a.optionsOf(home ? [home] : []) })) }) } });
  for (const m of ["alice", "bob"]) w.member(m);
  w.bundle("PRJ-A", "project"); w.join("PRJ-A", "alice"); w.join("PRJ-A", "bob");
  return w;
}
const item = (kind, tag = "1") => ({ id: `FINDING::${kind}::${tag}`, class: "FINDING", kind,
  subject: { kind: "member", id: "alice" }, home: null });

test("R1 (layer 11; notice-producers R33-R36): the six kinds answer FINDING, each with its one sentence", () => {
  for (const k of KINDS) {
    assert.equal(classOfKind(k), "FINDING", k);
    assert.ok(QUEUE_FINDING_KINDS[k].trim().length > 0, k);
  }
  // control: near-misses and published ids are no kind
  for (const v of ["ai-threshold", "ai-terms", "ai-account-left", "ai-signin-end", "mail-clear", "mail_cleared",
                   "FINDING::mail-cleared"])
    assert.equal(classOfKind(v), null, v);
});

test("R11, R12 (layer 11): a feed holding each of the six is minted, not refused NO_SUCH_KIND, and each is quieted by its recipient", () => {
  const w = noticed([...KINDS.map((k) => item(k)), item("ai-limit-reached"), item("watched-changed")]);
  const f = w.feed("alice");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  const it = byId(f);
  for (const k of KINDS) {
    const i = it[item(k).id];
    assert.ok(i, k);
    assert.equal(i.class, "FINDING", k);
    const d = i.disposition;
    assert.deepEqual([d.available, d.op, d.scope, d.key, d.instead], [false, null, null, null, "queuemute"], k);
    assert.equal(d.projects, undefined, k);
  }
  // the five account notices take ai-limit-reached's door and reason; mail-cleared watched-changed's shape, its own reason
  const limit = it[item("ai-limit-reached").id].disposition;
  for (const k of ACCOUNT) assert.equal(it[item(k).id].disposition.reason, limit.reason, k);
  assert.equal(it[item("mail-cleared").id].disposition.reason, "a_mail_notice_is_told_to_you_alone_and_quieted");
  // control: an uncatalogued kind beside them still refuses the whole feed NO_SUCH_KIND
  const v = noticed([item("mail-cleared"), item("mail-clearing")]).feed("alice");
  assert.deepEqual([v.ok, v.reason], [false, "NO_SUCH_KIND"]);
});

test("R14, R19 (layer 11): each of the six may be muted by its recipient; a muted one leaves only her feed", () => {
  const w = noticed(KINDS.map((k) => item(k)));
  for (const k of KINDS) {
    const m = w.q.queueMute({ member: "alice", viewer: "member:alice", item: item(k).id });
    assert.deepEqual([m.ok, m.item_class], [true, "FINDING"], k);
  }
  const g = w.feed("alice");
  assert.equal(g.ok, true);
  for (const k of KINDS) assert.equal(byId(g)[item(k).id], undefined, k);
  assert.deepEqual(g.mute.suppressed.map((s) => s.kind).sort(), [...KINDS].sort());
  const byKind = w.q.queueMute({ member: "alice", viewer: "member:alice", case: "PRJ-A", kinds: KINDS });
  assert.equal(byKind.ok, true, JSON.stringify(byKind));
  // control: bob's feed holds all six
  const b = byId(w.feed("bob"));
  for (const k of KINDS) assert.ok(b[item(k).id], k);
});
