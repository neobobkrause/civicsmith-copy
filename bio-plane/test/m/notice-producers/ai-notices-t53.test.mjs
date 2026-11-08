/* R33, R34, R35 (T53; K5571 (2)): what the AI accounts tell their owners once, each a FINDING its recipient disposes of, now
   that queue's catalogue names the kinds (PR 833). Over the real ai-use, ai-accounts, ai-catalogue and membership, on
   ai-use's own test world (its fixture); a pending term added through ai-accounts' published catalogue helper; the legacy
   sign-in row through ai-accounts' own legacy schema. Every expected sentence is read from the word table, never copied. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, PLANS, PROVIDER } from "../ai-use/fixture.mjs";
import { addTerm } from "../ai-accounts/catalogue.mjs";
import { AI_ACCOUNTS_LEGACY_SCHEMA } from "../../../src/ai-accounts/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { NOTICE_KINDS } from "../../../src/notice-producers/index.mjs";
import { NONE, fresh, reader, ofKind } from "./fixture.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });
const SENTINEL = "fake-key-";

async function setup() {
  const w = await standard();
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const { read } = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC }));
  return { w, read };
}
const ids = (items) => items.map((i) => i.id);

/* ------------------------------------------------------------------ R33 */
test("R33 a crossed percent threshold is one ai-threshold-reached item to the account's owner, keyed by ai-use's own key as given, its words ai.alert.threshold; the same key on every cycle, a new one in a new period", async () => {
  const { w, read } = await setup();
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 10, by: "ann", at: AT }).ok, true);
  assert.equal(w.u.aiThresholdSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", kind: "percent", level: 50, by: "ann", at: AT }).ok, true);
  /* control: usage under the level makes none */
  w.count("member:ann", "ann", "ask", { calls: 4, at: "2026-10-09T10:00:00Z" });
  assert.deepEqual(ofKind(read("ann", { now: AT }), "ai-threshold-reached"), []);
  w.count("member:ann", "ann", "ask", { calls: 2, at: "2026-10-09T11:00:00Z" });
  const crossed = w.u.thresholdsReached({ viewer: "ann", at: AT }).crossed;
  assert.equal(crossed.length, 1, "ai-use answers the crossing to its owner");
  const r = read("ann", { now: AT });
  const items = ofKind(r, "ai-threshold-reached");
  assert.deepEqual(ids(items), [`FINDING::ai-threshold-reached::${crossed[0].key}`]);
  assert.equal(items[0].class, NOTICE_KINDS["ai-threshold-reached"]);
  assert.equal(items[0].label, "noticed");
  assert.equal(items[0].word, "ai.alert.threshold");
  assert.equal(items[0].summary, word("ai.alert.threshold", { whose: word("ai.whose.own"), period: word("ai.period.day"),
    use: word("ai.use.ask.inline"), level: word("ai.alert.level.percent", { n: "50" }) }));
  assert.equal(items[0].detail, items[0].summary, "a calls threshold says no dollar basis");
  assert.deepEqual(r.facts.failed, []);
  /* the same key on every cycle */
  assert.deepEqual(ids(ofKind(read("ann", { now: AT }), "ai-threshold-reached")), ids(items));
  /* nobody else is told */
  for (const m of ["bob", "cy", "second"]) assert.deepEqual(ofKind(read(m, { now: AT }), "ai-threshold-reached"), [], m);
  /* a new period: a new crossing, a new key */
  const NEXT = "2026-10-10T12:00:00Z";
  w.count("member:ann", "ann", "ask", { calls: 6, at: "2026-10-10T11:00:00Z" });
  const next = ofKind(read("ann", { now: NEXT }), "ai-threshold-reached");
  assert.equal(next.length, 1);
  assert.notEqual(next[0].id, items[0].id);
});

test("R33 a dollar threshold names the basis it was judged on and its level to the cent; a project's names whose by ai.whose.project; no member is named", async () => {
  const { w, read } = await setup();
  const set = w.u.aiThresholdSet({ owner: "project:P", scope: "overall", unit: "usd", period: "month", kind: "amount", level: 0.01, by: "ann", at: AT });
  assert.equal(set.ok, true, JSON.stringify(set));
  w.count("project:P", "bob", "ask", { input: 1000, output: 1000, cost: 2.5, at: "2026-10-09T11:00:00Z" });
  const crossed = w.u.thresholdsReached({ viewer: "ann", at: AT }).crossed;
  assert.equal(crossed.length, 1, JSON.stringify(crossed));
  const [it] = ofKind(read("ann", { now: AT }), "ai-threshold-reached");
  assert.ok(it, "one item to P's owner");
  assert.equal(it.summary, word("ai.alert.threshold", { whose: word("ai.whose.project"), period: word("ai.period.month"),
    use: word("ai.alert.scope.overall"), level: word("ai.alert.level.usd", { n: "0.01" }) }));
  assert.equal(it.detail, `${it.summary} ${word(`ai.alert.basis.${crossed[0].basis}`)}`);
  assert.equal(JSON.stringify([it.summary, it.detail]).includes("bob"), false, "names no member");
  /* bob is a participant, not an owner of P's account: told nothing */
  assert.deepEqual(ofKind(read("bob", { now: AT }), "ai-threshold-reached"), []);
});

test("R33 control: an ai-use whose read throws or answers unreadable contributes no threshold item and is named in facts.failed", async () => {
  const { w } = await setup();
  for (const thresholdsReached of [() => { throw new Error("down"); }, () => ({ ok: true, crossed: [], unreadable: true })]) {
    const r = reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view: UTC,
      aiUse: { ...NONE.aiUse, thresholdsReached } })).read("ann", { now: AT });
    assert.deepEqual(ofKind(r, "ai-threshold-reached"), []);
    assert.deepEqual(r.facts.failed, ["ai-use"]);
  }
});

/* ------------------------------------------------------------------ R34 */
test("R34 a dated terms change is one ai-terms-notice item to whoever manages the account, keyed by ai-accounts' own key, its words ai.notice.termschange with the day it takes effect and the connect act's terms link; nothing waits on it", async () => {
  const { w, read } = await setup();
  assert.deepEqual(ofKind(read("second", { now: AT }), "ai-terms-notice"), [], "no term pending");
  /* control: a term beyond the notice window makes none, before and beside the one within it */
  await addTerm(w, PLANS.team, { doc: "far", version: "v2", from: "2027-03-01" });
  assert.deepEqual(ofKind(read("second", { now: AT }), "ai-terms-notice"), [], "beyond the window");
  await addTerm(w, PLANS.team, { doc: "usage-policy", version: "v9", from: "2026-10-14" });
  const rows = w.a.termsNoticesDue({ viewer: "second", at: AT });
  assert.equal(rows.length, 1, JSON.stringify(rows));
  const r = read("second", { now: AT });
  const items = ofKind(r, "ai-terms-notice");
  assert.deepEqual(ids(items), [`FINDING::ai-terms-notice::${rows[0].key}`]);
  assert.equal(items[0].class, NOTICE_KINDS["ai-terms-notice"]);
  assert.equal(items[0].summary, word("ai.notice.termschange", { provider: PROVIDER,
    date: word("date.daymonth", { month: word("date.month.october"), day: "14" }) }));
  assert.equal(items[0].link.label, word("screen.aiconnect.terms.link", { provider: PROVIDER }));
  assert.deepEqual(items[0].options, [], "no act but its disposal: no acceptance asked");
  assert.equal(JSON.stringify(items).includes(SENTINEL), false, "no secret");
  assert.deepEqual(r.facts.failed, []);
  assert.deepEqual(ids(ofKind(read("second", { now: AT }), "ai-terms-notice")), ids(items), "the same key on every cycle");
  /* ann owns P's account on the same plan: told for it, homed on P; bob and cy manage neither */
  const annItems = ofKind(read("ann", { now: AT }), "ai-terms-notice");
  assert.equal(annItems.length, 1);
  assert.equal(annItems[0].subject.id, "project:P");
  for (const m of ["bob", "cy"]) assert.deepEqual(ofKind(read(m, { now: AT }), "ai-terms-notice"), [], m);
  /* control: past its date, none */
  assert.deepEqual(ofKind(read("second", { now: "2026-10-15T12:00:00Z" }), "ai-terms-notice"), []);
});

/* ------------------------------------------------------------------ R35 */
const NOW = () => Date.now();

test("R35 turning a team account's sharing off tells each list owner once (ai-account-left-list), by ai-accounts' own key, ai.queue.leftlist.own|project naming the account by provider and plan and the project by name; no secret; nobody else", async () => {
  const { w, read } = await setup();
  const team = w.acct.group;
  assert.equal(w.a.crossOwnerOptInSet({ account_id: team, on: true, by: "admin" }).ok, true);
  const placed = [["project:P", "ann"], ["member:cy", "cy"], ["member:bob", "bob"]].map(([owner, by]) => w.a.accountOrderSet({ owner, accounts: [team], by }));
  assert.ok(placed.every((p) => p.ok), JSON.stringify(placed));
  assert.equal(w.a.crossOwnerOptInSet({ account_id: team, on: false, by: "admin" }).changed, true);
  const account = `${PROVIDER} ${PLANS.team}`;
  const now = NOW();
  const ann = ofKind(read("ann", { now }), "ai-account-left-list");
  assert.equal(ann.length, 1);
  const notice = w.a.accountNoticesFor({ viewer: "ann" })[0];
  assert.equal(ann[0].id, `FINDING::ai-account-left-list::${notice.key}`);
  assert.equal(ann[0].summary, word("ai.queue.leftlist.project", { account, project: "Project P" }));
  for (const m of ["cy", "bob"]) {
    const own = ofKind(read(m, { now }), "ai-account-left-list");
    assert.equal(own.length, 1, m);
    assert.equal(own[0].summary, word("ai.queue.leftlist.own", { account }), m);
  }
  assert.deepEqual(ofKind(read("second", { now }), "ai-account-left-list"), [], "the team's own list keeps it: no notice");
  assert.deepEqual(ids(ofKind(read("ann", { now }), "ai-account-left-list")), ids(ann), "the same key on a second cycle");
  assert.equal(JSON.stringify(read("ann", { now }).items).includes(SENTINEL), false, "no secret");
  /* control: turning an already-off flag off makes none */
  w.a.crossOwnerOptInSet({ account_id: team, on: false, by: "admin" });
  assert.equal(ofKind(read("ann", { now }), "ai-account-left-list").length, 1);
  /* a notice older than the window is not told */
  assert.deepEqual(ofKind(read("ann", { now: now + 91 * 86400e3 }), "ai-account-left-list"), []);
});

test("R35 removing a member from a project tells the project's other owners (ai-account-left-project-list), never the member removed, ai.queue.leftprojectlist naming no member", async () => {
  const { w, read } = await setup();
  const bobs = await w.account("member:bob", "bob");
  assert.equal(w.a.crossOwnerOptInSet({ account_id: bobs, on: true, by: "bob" }).ok, true);
  assert.equal(w.a.accountOrderSet({ owner: "project:P", accounts: [w.acct.P, bobs], by: "ann" }).ok, true);
  assert.equal(w.m.projectRemove({ projectId: "P", handle: "bob", by: "ann", viewer: "member:ann" }).ok, true);
  const now = NOW();
  const items = ofKind(read("ann", { now }), "ai-account-left-project-list");
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, word("ai.queue.leftprojectlist", { account: `${PROVIDER} ${PLANS.member}`, project: "Project P" }));
  assert.equal(JSON.stringify([items[0].summary, items[0].detail, items[0].subject, items[0].basis]).includes("bob"), false, "the member removed is not named");
  assert.deepEqual(ofKind(read("bob", { now }), "ai-account-left-project-list"), [], "the removed member is told nothing");
});

test("R35 the migration's ended project sign-in tells the project's owner once (ai-signin-ended), ai.queue.signinended; nobody else", async () => {
  const { w, read } = await setup();
  for (const st of AI_ACCOUNTS_LEGACY_SCHEMA.split(";")) { const s = st.trim(); if (s) w.sql.exec(s); }
  w.sql.exec(`INSERT INTO project_accounts (project_id, kind, member_id, is_on, set_by, set_at) VALUES ('P','signin','ann',1,'ann','2026-05-02T00:00:00Z')`);
  w.a.migrate();
  const now = NOW();
  const items = ofKind(read("ann", { now }), "ai-signin-ended");
  assert.equal(items.length, 1);
  assert.equal(items[0].id, `FINDING::ai-signin-ended::${w.a.accountNoticesFor({ viewer: "ann" })[0].key}`);
  assert.equal(items[0].summary, word("ai.queue.signinended", { account: word("ai.account.project", { project: "Project P" }), project: "Project P" }));
  for (const m of ["bob", "cy", "second"]) assert.deepEqual(ofKind(read(m, { now }), "ai-signin-ended"), [], m);
  assert.deepEqual(ids(ofKind(read("ann", { now }), "ai-signin-ended")), ids(items));
});

test("R34 R35 control: an ai-accounts whose read throws contributes none of its items and is named in facts.failed", async () => {
  const { w } = await setup();
  const boom = () => { throw new Error("down"); };
  const r = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, view: UTC,
    aiAccounts: { termsNoticesDue: boom, accountNoticesFor: boom, accountState: boom } })).read("ann", { now: AT });
  for (const k of ["ai-terms-notice", "ai-account-left-list", "ai-account-left-project-list", "ai-signin-ended"]) assert.deepEqual(ofKind(r, k), [], k);
  assert.deepEqual(r.facts.failed, ["ai-accounts"]);
});
