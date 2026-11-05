/* The Action layer's to-dos (T45; K2781 (1)), action-producers' since T45 (its R1–R12, was this module's R15–R21, R29), as
   feedItems answers them (R8): every item `action-producers.actionItems` answers, passed the read's member, viewer and instant
   and queue's walk and options, with its facts beside the others; and none of the moved kinds raised here, whatever their
   old providers answer. And the self-registered signing key (R14; N375). action-producers is the real module, as its published
   fixture makes it (its R13's shape); membership is real, so the signing keys (its R27) are its own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { actionItems } from "../action-producers/fixtures.mjs";
import { escalationsDue } from "../escalation/fixtures.mjs";

const DAY = 86400000;
const page = (items, extra = {}) => ({ ok: true, items, limit: 500, truncated: false, cursor: null, ...extra });
const ofKind = (r, kind) => r.items.filter((i) => i.kind === kind);
/* The kinds that moved to action-producers (its R1–R12): never raised by this module itself. */
const MOVED = ["action-clock-overdue", "plan-checkpoint-due", "escalation-stage-proposed", "action-reminder", "litigation-hold",
               "litigation-hold-released", "template-review-requested", "local-fact-due", "member-left-items", "watch-keep-or-stop",
               "plan-review-due", "plan-look-again"];

/* The real action-producers (its published `actionItems` fixture), each read of it recorded and its answer kept: the member who
   sees an overdue clock entry is `alice`, who created its action; the items are homed and offered through the functions it is handed. */
function actionReal(log) {
  const real = actionItems().actionProducers;
  return { actionItems: (a) => { log.push(a); const r = real.actionItems(a); answered.set(a, r); return r; } };
}
/* what each read answered, by its arguments */
const answered = new Map();

test("R8 (T45; K2781 (1)): feedItems answers every item action-producers.actionItems answers, unchanged and in its order, passed the read's member, viewer and instant and the same homesOf and optionsOf; its facts beside the others", () => {
  const log = [];
  const w = world({ actionProducers: actionReal(log) });
  w.member("alice"); w.bundle("PRJ-1", "project"); w.bundle("ACT-1", "action"); w.join("PRJ-1", "alice"); w.cite("PRJ-1", "ACT-1");
  const r = w.read("alice");
  assert.equal(log.length, 1, "action-producers is read once per read");
  const a = log[0];
  assert.deepEqual([a.member, a.viewer, a.now], ["alice", "member:alice", NOW], "the read's member, viewer and instant");
  assert.deepEqual(Object.keys(a).sort(), ["homesOf", "member", "now", "optionsOf", "viewer"], "and nothing else (its R13's parameters)");
  /* the walk and the options are queue's own, as this read was handed them: what action-producers asks of them is what queue records */
  assert.ok(w.asked.homes.some((s) => s.includes("ACT-1")), "the walk action-producers asked is the one queue passed");
  assert.ok(w.asked.options.some((s) => s.includes("ACT-1")), "and the options");
  const theirs = r.items.filter((i) => MOVED.includes(i.kind));
  const said = answered.get(a).items;
  assert.equal(theirs.length, said.length);
  theirs.forEach((it, i) => assert.equal(it, said[i], `${it.id}: the very item it answered, untouched (homes, options, due, age)`));
  assert.deepEqual(theirs.map((i) => i.id), said.map((i) => i.id), "in its order");
  assert.deepEqual(theirs[0].case.ancestors.map((x) => x.id), ["PRJ-1"], "homed by queue's walk, as action-producers asked it");
  assert.deepEqual(theirs[0].options.map((o) => o.id).slice(-1), ["opt"], "its doors first, then queue's options");
  for (const it of theirs) assert.ok(!("disposition" in it) && !("catalogue_id" in it), `${it.id}: the mint's and queue's`);
  assert.deepEqual(r.facts.action, answered.get(a).facts, "its facts, beside the others");
  for (const k of ["objective_gap", "unattributed", "contradiction", "dispositions"]) assert.ok(k in r.facts, `${k} still beside it`);
  /* a caller with no member is passed none; a read handed no walk passes none on */
  w.read(null, "class:admin");
  assert.deepEqual([log[1].member, log[1].viewer], [null, "class:admin"]);
  w.read("alice", "member:alice", { homes: false, options: false });
  assert.deepEqual([log[2].homesOf, log[2].optionsOf], [undefined, undefined], "no walk passed, none handed on");
  const walks = w.asked.homes.length;
  const bare = ofKind(w.read("alice", "member:alice", { homes: false, options: false }), "action-clock-overdue")[0];
  assert.deepEqual(bare.case.ancestors.map((x) => x.id), ["PRJ-1"], "so no item is given a home but its own project, which the real module reads itself");
  assert.equal(w.asked.homes.length, walks, "and queue's walk was not asked for it");
  /* an answer with no facts is stated as none, never missing */
  w.fakes.actionProducers.actionItems = () => ({ items: [] });
  assert.deepEqual(w.read("alice").facts.action, {});
});

test("R8 (T45; R15–R21, R29 retired): the moved kinds are never raised here, whatever their old providers answer; only what action-producers answers reaches the feed", () => {
  const asked = { clocks: 0, plans: 0, escalation: 0, holds: 0, templates: 0, facts: 0 };
  const count = (k, v) => (...x) => { asked[k] += 1; void x; return v; };
  /* every provider the moved producers read, answering something each would have raised an item for */
  const w = world({
    actionClocks: { overdueClocks: count("clocks", page([{ action: "ACT-1", ord: 0, date: "2026-08-20", basis: "b", text: "t",
                      status: "pending", past: true, project: "PRJ-1", created_by: "alice" }])),
                    remindersDue: count("clocks", page([{ action: "ACT-1", ord: 0, date: "2026-08-20", basis: "b", text: "t",
                      on: "2026-08-15", set_by: "alice", project: "PRJ-1" }])),
                    calendarFactsRead: count("facts", { ok: true, paths: [{ path: "p", actions: [{ action: "ACT-1", project: "PRJ-1", created_by: "alice" }] }],
                      actions_limit: 500, truncated: false }) },
    actionPlans: { checkpointsDue: count("plans", { ok: true, limit: 500, truncated: false, items: [{ plan: "PLN-1", project: "PRJ-1",
                     scenario: 1, version: 1, phase: "p", set_by: "alice", due: "2026-08-30" }] }) },
    escalation: { escalationsDue: count("escalation", escalationsDue().due) },
    actions: { holdsDue: count("holds", page([{ action: "ACT-1", ord: 1, note: "n", marked_by: "alice", marked_at: iso(NOW - DAY), project: "PRJ-1" }])),
               holdsReleased: count("holds", page([{ action: "ACT-1", ord: 0, seq: 2, released_by: "alice", released_at: iso(NOW - DAY),
                 reason: "r", placers: ["alice"], restarted: [] }])) },
    filingTemplates: { reviewsRequested: count("templates", page([{ template: "TPL-1", version: "TPL-1@1", name: "n", kind: "k",
                         member: "alice", asked_by: { id: "olga" }, asked_at: iso(NOW - DAY) }])) },
    localFacts: { factsDue: count("facts", { ok: true, due: [{ path: "p", status: "unconfirmed", due: true }], unknown: [], absent: [] }) } });
  w.member("alice", { role: "admin" }); w.bundle("PRJ-1", "project"); w.bundle("ACT-1", "action"); w.join("PRJ-1", "alice", { owner: true });
  for (const [member, viewer] of [["alice", "member:alice"], [null, "class:admin"]]) {
    const r = w.read(member, viewer);
    assert.deepEqual(r.items.filter((i) => MOVED.includes(i.kind)).map((i) => i.id), [], `${viewer}: no moved kind raised here`);
    assert.ok(!r.items.some((i) => MOVED.some((k) => i.id.includes(`::${k}::`))), "and no id of one");
  }
  assert.deepEqual(asked, { clocks: 0, plans: 0, escalation: 0, holds: 0, templates: 0, facts: 0 }, "none of their providers is asked by this module");
  /* the control: the same kinds, answered by action-producers, are answered */
  const log = [];
  w.fakes.actionProducers.actionItems = actionReal(log).actionItems;
  assert.deepEqual(w.read("alice").items.filter((i) => MOVED.includes(i.kind)).map((i) => i.id),
    ["CONDITION::action-clock-overdue::ACT-1::0"]);
});

test("R14 (as R56 amends its grain): OBLIGATIONs signer-self-registered, one for each member holding an active self-registered key, to an administrator or the admin credential and nobody else, offering R26's revoke", () => {
  const w = world();
  w.member("ada", { role: "admin" }); w.member("alice"); w.member("bob");
  w.signer("KEY-A", "alice", { comment: "alice's laptop", added: iso(NOW - 3000) });
  w.signer("KEY-B", "bob", { origin: "admin" });                 // an administrator's registration: no item
  w.signer("KEY-C", "bob", { status: "revoked" });               // no longer active: no item
  const ids = (r) => ofKind(r, "signer-self-registered").map((i) => i.id);
  assert.deepEqual(ids(w.read("ada")), ["OBLIGATION::signer-self-registered::alice"]);
  assert.deepEqual(ids(w.read(null, "class:admin")), ["OBLIGATION::signer-self-registered::alice"]);
  assert.deepEqual(ids(w.read("alice")), [], "not the member who registered it, who is no administrator");
  assert.deepEqual(ids(w.read(null, "class:member")), [], "nor another machine credential");
  const it = byId(w.read("ada"))["OBLIGATION::signer-self-registered::alice"];
  assert.deepEqual([it.class, it.kind, it.subject.kind, it.subject.id, it.basis.keys[0].comment, it.subject.registered_by],
    ["OBLIGATION", "signer-self-registered", "member", "alice", "alice's laptop", "alice"], "naming the key's comment and its member");
  assert.deepEqual(it.age, { state: "determined", since: iso(NOW - 3000), ms: 3000 }, "aged from its added instant");
  assert.deepEqual(it.options, [{ id: "signerset", label: word("queue-producers.label.revoke_signing_key"), weight: "single", key: "KEY-A" },
                               { id: "signerknown", label: word("queue.signer-self-registered.known"), weight: "single", key: "KEY-A" }]);
  assert.deepEqual(it.basis.raised_to, ["ada"]);
  w.run(`UPDATE signers SET status='revoked' WHERE key_b64='KEY-A'`);
  assert.deepEqual(ids(w.read("ada")), [], "it leaves when the key is no longer active");
});

test("R8 (T45; K2888): handed no action-producers, feedItems builds the real one over its own deps, as machinery-producers, and answers its items through the walk and options this read was handed", async () => {
  const { defaultFakes: theirs } = await import("../action-producers/world.mjs");
  const { QueueProducers } = await import("../../../src/queue-producers/index.mjs");
  const w = world();
  w.member("alice"); w.bundle("PRJ-1", "project"); w.bundle("ACT-1", "action"); w.join("PRJ-1", "alice", { owner: true });
  const { actionProducers, ...ours } = w.fakes;
  void actionProducers;
  const providers = theirs();
  providers.actionClocks.overdueClocks = () => page([{ action: "ACT-1", ord: 0, date: "2026-08-20", basis: "b", text: "t",
    status: "pending", past: true, project: "PRJ-1", created_by: "alice" }]);
  const p = new QueueProducers({ host: w.host, storage: w.host.storage,
    deps: { ...ours, ...providers, record: w.record, membership: w.membership, credentials: w.credentials } });
  const asked = [];
  const r = p.feedItems({ member: "alice", viewer: "member:alice", now: NOW,
    homesOf: (s) => { asked.push(["homes", ...s]); return { state: "determined", ungrouped: false, reasons: [], depth_bound: 6, ancestors: [], of: [...s] }; },
    optionsOf: (s) => { asked.push(["options", ...s]); return [{ id: "opt", on: [...s] }]; } });
  const it = byId(r)["CONDITION::action-clock-overdue::ACT-1::0"];
  assert.ok(it, "the real action-producers' item, in this module's one answer");
  assert.ok(asked.some((a) => a[0] === "homes" && a.includes("ACT-1")), "homed through the walk this read was handed");
  assert.ok(it.options.some((o) => o.id === "opt"), "offered this read's options");
  assert.equal(typeof r.facts.action, "object", "its facts beside the others");
  assert.ok(!("disposition" in it) && !("catalogue_id" in it));
});

test("R14 (A-03): the member who registered a key is not told of it, though she is an administrator; the other administrators and the admin credential are", () => {
  const w = world();
  w.member("ada", { role: "admin" }); w.member("cy", { role: "admin" });
  w.signer("KEY-A", "ada", { comment: "ada's laptop" });
  const ids = (r) => ofKind(r, "signer-self-registered").map((i) => i.id);
  assert.deepEqual(ids(w.read("ada")), [], "she registered it herself");
  assert.deepEqual(ids(w.read("cy")), ["OBLIGATION::signer-self-registered::ada"], "another administrator is told");
  assert.deepEqual(ids(w.read(null, "class:admin")), ["OBLIGATION::signer-self-registered::ada"], "the admin credential is told");
  assert.deepEqual(byId(w.read("cy"))["OBLIGATION::signer-self-registered::ada"].basis.raised_to, ["cy"], "raised_to does not name her");
});

test("R55: an administrator's signerKnown ends the signer-self-registered item for every administrator and the admin credential; a second self-registered key still mints one", () => {
  const w = world();
  w.member("ada", { role: "admin" }); w.member("cy", { role: "admin" }); w.member("alice");
  w.signer("AAAAKEYA", "alice", { comment: "alice's laptop" });
  w.signer("AAAAKEYB", "alice", { comment: "alice's phone" });
  /* R56: one item for the member, listing her keys */
  const ids = (r) => ofKind(r, "signer-self-registered").flatMap((i) => i.basis.keys.map((k) => `OBLIGATION::signer-self-registered::${k.key_b64}`)).sort();
  assert.deepEqual(ids(w.read("ada")), ["OBLIGATION::signer-self-registered::AAAAKEYA", "OBLIGATION::signer-self-registered::AAAAKEYB"], "minted");
  const done = w.credentials.signerKnown({ keyB64: "AAAAKEYA", viewer: "member:ada" });
  assert.equal(done.ok, true, "the act is the credentials module's own");
  const left = ["OBLIGATION::signer-self-registered::AAAAKEYB"];
  assert.deepEqual(ids(w.read("ada")), left, "gone for the administrator who said it");
  assert.deepEqual(ids(w.read("cy")), left, "gone for every other administrator");
  assert.deepEqual(ids(w.read(null, "class:admin")), left, "and for the admin credential; the second key still mints one");
});
