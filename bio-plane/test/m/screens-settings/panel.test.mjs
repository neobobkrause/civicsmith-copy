/* The AI panel module (`src/screens-settings/panel.mjs`) as it is now, at the interface another module uses (coordinator audit 17:23; BOB,
   4 Nov: PR 174 deleted this test while panel.mjs stays and `screens-inquiry` imports it: `assistant.mjs` draws `aiUsageBars`, `projectai.mjs`
   hands `aiPanel` and `aiPanelSend` to its page as parts and lists `PANEL_KEYS`). R9 is retired (no screen of this module draws the panel);
   R26 is the module's: the shared render of an account's use over time. The panel is drawn here in the served page as `projectai` draws it,
   its functions handed to a screen as `view.parts`, over the world: the team's own T53 account held and switched on by the real acts,
   its reads and the two acts (`accountusesset`, `ailimitset`) answered by their owners. */
import test from "node:test";
import assert from "node:assert/strict";
import * as panel from "../../../src/screens-settings/panel.mjs";
import { all, open, said, textOf, SCREENS, WORDS } from "./kit.mjs";
import { team, holdKey, SEAL } from "./seed-group.mjs";

const EXPORTS = ["aiPanel", "aiPanelSend", "aiUsageBars", "aiLimitRefused"];

test("R26 the panel module's interface as screens-inquiry uses it: aiPanel, aiPanelSend, aiUsageBars, aiLimitRefused are functions, PANEL_KEYS the words they draw, and the parts every screen of this module carries are the same functions", () => {
  for (const f of EXPORTS) assert.equal(typeof panel[f], "function", f);
  assert.ok(Array.isArray(panel.PANEL_KEYS) && Object.isFrozen(panel.PANEL_KEYS) && panel.PANEL_KEYS.length > 0);
  for (const k of panel.PANEL_KEYS) assert.ok(WORDS.has(k), `${k} is a word the page carries`);
  for (const k of ["ai.usage.bars", "ai.usage.meter", "ai.usage.nolimit", "screen.panel.limits.heading", "screen.panel.uses.heading"]) assert.ok(panel.PANEL_KEYS.includes(k), k);
  for (const s of SCREENS) for (const f of ["aiPanel", "aiPanelSend", "aiUsageBars"]) assert.equal(s.parts[f], panel[f], `${s.id}'s part ${f}`);
});

/* The panel over the team's account, as a screen draws it from its parts: a stand-in under the id of the registry's screen whose acts are the
   panel's (`projectai`: `accountusesset`, `ailimitset`; the shell serves only a registered screen, interface-shell R21), over owner `group` */
const PROBE = Object.freeze({
  id: "projectai",
  reads(view) {
    const owner = { owner: "group" };
    return { uses: { op: "accountuses", query: { account_id: view.subject } }, limits: { op: "ailimits", query: owner },
      usage: { op: "aiusage", query: owner }, history: { op: "accounthistory", query: owner }, over: { op: "aiuseovertime", query: owner } };
  },
  render(cs, view) { return view.parts.aiPanel(cs, view, { owner: "group", explore: true, perMember: true }); },
  acts: [
    { op: "accountusesset", rereads: ["uses", "history"], send(view, el, cs) { return view.parts.aiPanelSend("accountusesset", "group", el, cs); } },
    { op: "ailimitset", label: "act.ailimitset.label.setup", rereads: ["limits", "history", "over"],
      send(view, el, cs) { return view.parts.aiPanelSend("ailimitset", "group", el, cs); },
      refusals: { AI_LIMIT_INVALID: (r, cs) => panel.aiLimitRefused(r, cs) } },
  ],
  words: Object.freeze([...new Set([...SCREENS.flatMap((s) => s.words), ...panel.PANEL_KEYS])]),
  parts: SCREENS[0].parts,
});
const section = (o, key) => all(o.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => textOf(h) === said(key)))[0];

async function held() {
  const t = await team({ env: { ACCOUNT_SEAL_SECRET: SEAL } });
  await holdKey(t.founder, t.w);
  t.account = (await t.founder.read("accounthistory", { query: { owner: "group" } })).changes.find((c) => c.change === "account_set").account_id;
  t.open = () => open("projectai", { world: t.w, as: t.founder, subject: t.account, screens: [...SCREENS, PROBE] });
  return t;
}

test("R26 aiPanel draws the team's account from its owners' answers: each use with its switch (accountusesset on the account's id, T53), the limits as a table with one form, the changes; ailimitset from its form is the request the owner keeps, and its remove the one the owner removes", async () => {
  const t = await held();
  const a = await t.open();
  // what the account pays for, each use switched on its own (accountusesset as aiPanelSend builds it)
  const uses = (await t.founder.read("accountuses", { query: { account_id: t.account } })).uses;
  const sw = all(section(a, "screen.panel.uses.heading"), (e) => e.tag === "button" && e.attrs["data-act"] === "accountusesset" && e.attrs["data-sw"] !== "explore");
  assert.equal(sw.length, 9);
  for (const b of sw) assert.equal(b.attrs["data-to"], uses[b.attrs["data-sw"]] ? "off" : "on", b.attrs["data-sw"]);
  for (const b of sw) assert.equal(b.attrs["data-account"], t.account, "each switch names the account its read answered");
  assert.equal(uses.standing, false, "control: standing starts off");
  assert.deepEqual((await a.press("accountusesset", { data: { sw: "standing", to: "on" } })).sent[0].body, { account_id: t.account, switch: "standing", on: true });
  assert.equal((await t.founder.read("accountuses", { query: { account_id: t.account } })).uses.standing, true, "the owner keeps the switch");
  // a limit set from the one form, kept by the owner and drawn in the table
  const b = await t.open();
  assert.equal(all(section(b, "screen.panel.limits.heading"), (e) => e.tag === "button" && e.attrs["data-act"] === "ailimitset" && e.attrs["data-remove"] === "").length, 1, "one form");
  const sent = (await b.press("ailimitset", { data: { remove: "" }, values: { "aig-scope": "overall", "aig-amount": "$60", "aig-unit": "usd", "aig-period": "month" } })).sent[0].body;
  assert.deepEqual(sent, { owner: "group", scope: "overall", unit: "usd", period: "month", amount: 60 });
  const kept = (await t.founder.read("ailimits", { query: { owner: "group" } })).limits;
  assert.deepEqual(kept.map((l) => [l.scope, l.unit, l.period, l.amount]), [["overall", "usd", "month", 60]], "the owner keeps it");
  const c = await t.open();
  const rows = all(section(c, "screen.panel.limits.heading"), (e) => e.tag === "tbody")[0].children.filter((x) => x.tag === "tr");
  assert.equal(rows.length, 1);
  assert.ok(textOf(rows[0]).includes(said("screen.panel.scope.overall")) && textOf(rows[0]).includes("$60.00"));
  // the changes, the limit's among the account's, with who
  assert.ok(section(c, "screen.panel.changes.heading"), "the changes are drawn");
  // removed from the table's row: the owner removes it
  assert.deepEqual((await c.press("ailimitset", { data: { remove: "1", scope: "overall", unit: "usd", period: "month" } })).sent[0].body, { owner: "group", scope: "overall", unit: "usd", period: "month", amount: null });
  assert.deepEqual((await t.founder.read("ailimits", { query: { owner: "group" } })).limits, [], "removed");
  // an amount that is not one sends nothing
  assert.deepEqual((await (await t.open()).press("ailimitset", { data: { remove: "" }, values: { "aig-amount": "0" } })).sent, []);
});

test("R26 aiUsageBars over the owner's aiuseovertime: a bar for each day the answer gives, the newest marked today, and a meter of each limit's period; a refused or unreadable answer is drawn failed, never as zeros", async () => {
  const t = await held();
  await t.founder.act("ailimitset", { body: { owner: "group", scope: "overall", unit: "usd", period: "month", amount: 60 } });
  const over = await t.founder.read("aiuseovertime", { query: { owner: "group" } });
  const a = await t.open();
  const bars = all(a.tree, (e) => /\bmk-bars\b/.test(e.attrs.class || ""))[0];
  assert.ok(bars, "the bars are drawn");
  const run = all(bars, (e) => e.tag === "i");
  assert.equal(run.length, over.days.length);
  assert.equal(run.filter((e) => /\bnow\b/.test(e.attrs.class || "")).length, 1);
  assert.equal(all(a.tree, (e) => /\bmk-meter\b/.test(e.attrs.class || "")).length, (over.periods || []).length);
  // over an answer that cannot be read: failed, never zeros (the function as screens-inquiry's assistant calls it)
  const cs = { w: (k) => k, esc: String, date: String, state: (r) => `<p data-state="${r.state}"></p>` };
  for (const value of [{ state: "failed", value: null, refusal: { code: "NOT_YOUR_ACCOUNT" } }, { state: "ok", value: { ...over, unreadable: true } }])
    assert.equal(panel.aiUsageBars(cs, {}, { owner: "group", value }), '<p data-state="failed"></p>');
  assert.equal(panel.aiUsageBars(cs, {}, { owner: "group", value: null }), "", "nothing read, nothing drawn");
});
