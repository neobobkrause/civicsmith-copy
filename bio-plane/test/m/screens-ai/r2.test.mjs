/* R2: aiproviders' limits and alerts, use by member, the re-test switch and the health share, over the world's real store: the team's own
   account held and switched on by the real acts, members' use counted as the agent Worker counts it (store-request's `grantAdmit`). */
import test from "node:test";
import assert from "node:assert/strict";
import { grantAdmit } from "../store-request/recipes.mjs";
import { open, aiTeam, holdKey, byOp, section, said, all, textOf, squash, actOps } from "./kit.mjs";

const rowsOf = (o, table) => all(o.tree, (e) => e.tag === "table" && e.attrs["data-table"] === table).flatMap((t) => all(t, (r) => r.tag === "tr" && r.attrs["data-member"]));

test("R2 use by member, this month: each member by name with cost and runs, exactly the members aiusebymember answers for the team's accounts; a member's own subscription is not among them", async () => {
  const t = await aiTeam();
  await t.w.recipes.assistant(t.founder, { readers: [t.dev, t.rosa] });
  await grantAdmit(t.w, t.dev, { calls: 3 });
  await grantAdmit(t.w, t.rosa, { calls: 1 });
  const answer = await t.founder.read("aiusebymember", { query: { owner: "group" } });
  assert.ok(answer.members.length >= 2, "the world counted the two members' use");
  const a = await open(t, "aiproviders", t.founder);
  assert.ok(section(a, "screen.aiproviders.bymember.head"), "the section is drawn");
  const rows = rowsOf(a, "bymember");
  assert.deepEqual(rows.map((r) => r.attrs["data-member"]), answer.members.map((m) => String(m.member)));
  const roster = (await t.founder.read("memberlist")).members;
  for (const [i, m] of answer.members.entries()) {
    const cells = rows[i].children.filter((c) => c.tag === "td").map((c) => squash(textOf(c)));
    const handle = roster.find((r) => r.member_id === String(m.member).replace(/^member:/, "")).handle;
    assert.equal(cells[0], handle, "by name, never an id");
    assert.equal(cells[2], Number(m.calls).toLocaleString("en"), "its runs");
    assert.equal(cells[1], m.cost ? "$" + Number(m.cost.reported || m.cost.estimated).toFixed(2) : said("screen.aimine.use.nomoney"), "its cost");
  }
  assert.ok(a.text.includes(said("screen.aiproviders.bymember.note")), "says why administrators see it");
  // a member's own subscription: her use on her own account is hers alone (owner member:<id>), never a row of the team's table
  const mine = await t.dev.read("aiusebymember", { query: { owner: "member:" + t.dev.member } }).catch((e) => e);
  assert.ok(mine instanceof Error && /NOT_A_PAYING_ACCOUNT/.test(mine.message), "a member's own account is no paying account read by member");
  assert.equal(byOp(a, "aiusebymember").every((r) => r.query.owner === "group"), true, "the table reads the team's accounts only");
});

test("R2 the health share is off until an administrator turns it on, and sends aihealthset only on her act; the preview's rows are aihealthpreview's answer and carry no member, account or text", async () => {
  const t = await aiTeam();
  await t.w.recipes.assistant(t.founder, { readers: [t.dev] });
  await grantAdmit(t.w, t.dev, { calls: 2 });
  const a = await open(t, "aiproviders", t.founder);
  const card = all(a.tree, (e) => e.attrs["data-switch"] === "health")[0];
  assert.equal(card.attrs["data-on"], "off", "off to begin with");
  assert.ok(squash(textOf(card)).includes(said("screen.aiproviders.health.note")));
  assert.equal(byOp(a, "aihealthset").length, 0, "nothing is sent on load");
  // the preview: one row per AI and day the owner's answer holds, each the design's sentence over its counts
  const preview = await t.founder.read("aihealthpreview");
  const entries = (preview.reports || []).flatMap((r) => r.entries.map((e) => ({ day: r.day, ...e })));
  const drawn = all(card, (e) => e.tag === "li" && e.attrs["data-health"]);
  assert.deepEqual(drawn.map((e) => e.attrs["data-health"]), entries.map((e) => `${e.entry_id}:${e.day}`));
  const handles = (await t.founder.read("memberlist")).members.map((m) => m.handle).filter(Boolean);
  const account = (await t.founder.read("accountsof", { query: { owner: "group" } })).accounts[0].account_id;
  for (const li of drawn) for (const x of [...handles, account]) assert.ok(!squash(textOf(li)).includes(x), "no member or account in a row");
  // turned on by her act: the one request, and the owner keeps it
  const sent = (await a.press("aihealthset", { data: { to: "on" } })).sent.filter((r) => r.op === "aihealthset");
  assert.deepEqual(sent.map((r) => r.body), [{ on: true }]);
  assert.equal((await t.founder.read("aihealthpreview")).on, true);
  assert.equal(all(a.tree, (e) => e.attrs["data-switch"] === "health")[0].attrs["data-on"], "on", "re-read and drawn on");
});

test("R2 limits and alerts: the monthly limit and its alert, each sent as the owner's own aibudgetset, the limit then drawn with what it has used", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const a = await open(t, "aiproviders", t.founder);
  assert.ok(section(a, "screen.aiproviders.bud.head"));
  const sent = (await a.press("aibudgetset", { values: { "aip-bud-amount": "$60", "aip-bud-alert": "80" } })).sent.filter((r) => r.op === "aibudgetset");
  assert.deepEqual(sent.map((r) => r.body), [
    { owner: "group", scope: "overall", unit: "usd", period: "month", amount: 60 },
    { owner: "group", scope: "overall", unit: "usd", period: "month", kind: "percent", level: 80 }]);
  const kept = (await t.founder.read("ailimits", { query: { owner: "group" } })).limits.find((l) => l.scope === "overall" && l.period === "month");
  assert.equal(kept.amount, 60, "the owner keeps the limit");
  const row = all(a.tree, (e) => e.tag === "tr" && e.attrs["data-limit"] === "overall:usd:month")[0];
  assert.ok(row, "drawn after the re-read");
  assert.deepEqual(row.children.filter((c) => c.tag === "td").map((c) => squash(textOf(c))), [said("screen.aiproviders.bud.all"), "$60.00", "$" + Number(kept.used || 0).toFixed(2)]);
});

test("R2 re-testing each month is on to begin with; switched off it sends airetestset and is drawn off, its note saying a reminder stays in the Queue", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const a = await open(t, "aiproviders", t.founder);
  const card = () => all(a.tree, (e) => e.attrs["data-switch"] === "retest")[0];
  assert.equal(card().attrs["data-on"], "on");
  assert.ok(squash(textOf(card())).includes(said("screen.aiproviders.retest.note")));
  const sent = (await a.press("airetestset", { data: { to: "off" } })).sent.filter((r) => r.op === "airetestset");
  assert.deepEqual(sent.map((r) => r.body), [{ owner: "group", on: false }]);
  assert.equal(card().attrs["data-on"], "off", "re-read from the owner and drawn off");
});

test("R2 control: a member who does not administer is drawn none of it, and none of its reads is made for her", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const d = await open(t, "aiproviders", t.dev);
  for (const k of ["bud.head", "bymember.head", "health.switch", "retest.switch"]) assert.ok(!d.text.includes(said("screen.aiproviders." + k)), k);
  assert.deepEqual(actOps(d.tree), [], "no act");
  for (const op of ["ailimits", "aiusebymember", "aihealthpreview"]) assert.equal(byOp(d, op).length, 0, op);
  // she reads only whose screen it is, and who they are: the team's administrators by name
  assert.ok(d.text.includes(said("screen.aiproviders.intro")));
  const admins = all(d.tree, (e) => e.attrs["data-list"] === "admins")[0];
  const names = all(admins, (e) => e.tag === "li").map((e) => squash(textOf(e))).sort();
  const roster = (await t.founder.read("memberlist")).members.filter((m) => m.role === "admin").map((m) => m.handle).sort();
  assert.deepEqual(names, roster);
});
