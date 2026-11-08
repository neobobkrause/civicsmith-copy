/* screens-action R9 (DEC-209 (5)): How a records request works, reached from `request`: what the office must do (each
   sentence with the particulars the profile names, and none the profile does not name), the profile's faster request
   where held, what a portal shows, what the group's Civicsmith does with the due date, its sources listed; no place named
   in its words (interface-shell R23). Every sentence is asserted by its key through `setup-words` (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, ok, W, hasWord, DATA_PLANE, PROFILES, RECORDS_HELP, PROFILES_WITH_HELP } from "./page.mjs";
import { WORD_ROWS } from "../../../src/setup-words/index.mjs";

const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);

test("R9: what the office must do from the profile's response period, the faster request from the profile's view, what a portal shows, what the group's Civicsmith does with the due date, and the sources", async () => {
  const p = await open("/app/help-records", DATA_PLANE);
  assert.equal(p.byOp("profiles").length, 1);
  said(p, "screen.help-records.must");
  said(p, "screen.help-records.must.1", { days: "10", cite: "Gov. Code § 7922.535(b)" });
  said(p, "screen.help-records.faster");
  assert.ok(text(p).includes(`Mun. Code § 2.20.230 · ${W("screen.request.window.business", { n: "3" })}`));
  said(p, "screen.help-records.thefaster");
  said(p, "screen.help-records.faster.when");
  said(p, "screen.help-records.portal");
  for (const n of [1, 2, 3]) said(p, `screen.help-records.portal.${n}`);
  said(p, "screen.help-records.does");
  said(p, "screen.help-records.does.text");
  said(p, "screen.help-records.sources");
  assert.ok(text(p).includes("Gov. Code § 7922.535(b); Gov. Code § 7922.535(c); Mun. Code § 2.20.230"));
  assert.doesNotMatch(text(p), /Open meetings law/, "only the records request's laws");
  assert.deepEqual(ops(p), []);
});

test("R9, R19: a must sentence the profile does not fully name is not drawn, never drawn short or with a placeholder in it", async () => {
  const p = await open("/app/help-records", DATA_PLANE);
  assert.doesNotMatch(text(p), /\{\w+\}/, "no placeholder is drawn");
  // the profile names the response period and its citation: the first sentence only (its records help is the profile's to add)
  for (const n of [2, 3, 4, 5, 6, 7]) assert.ok(hasWord(`screen.help-records.must.${n}`));
  for (const n of [2, 3, 4, 5, 6, 7]) assert.ok(!text(p).includes(W(`screen.help-records.must.${n}`, { days: "10", cite: "Gov. Code § 7922.535(b)", cite2: "x", cite3: "x", reasons: "x", extra: "14" })), `must.${n} is not drawn`);
});

test("R9: control: a profile naming no faster request draws only the law it names, marked as none faster", async () => {
  const one = { ...PROFILES, view: { deadlines: [PROFILES.view.deadlines[0]] } };
  const p = await open("/app/help-records", { ...DATA_PLANE, profiles: ok(one) });
  assert.ok(text(p).includes(`Gov. Code § 7922.535(b) · ${W("screen.request.window.calendar", { n: "10" })}`));
  unsaid(p, "screen.help-records.thefaster");
  unsaid(p, "screen.help-records.faster.when");
  const none = await open("/app/help-records", { ...DATA_PLANE, profiles: ok({ ...PROFILES, view: {} }) });
  // R14: with no law named, the sections that would hold laws hold nothing and are not drawn
  unsaid(none, "screen.help-records.faster");
  unsaid(none, "screen.help-records.sources");
  unsaid(none, "screen.help-records.must");
  said(none, "screen.help-records.portal");
  said(none, "screen.help-records.does");
});

/* ---------- R22 (T50; N1121; K3369; DEC-262; jurisdictions R93): the records help is filled from the profile ---------- */

const HELP = RECORDS_HELP;
const withHelp = (help) => ok(PROFILES_WITH_HELP(help));
const FILLS = {
  1: { days: "7", cite: "TRA § 1" },
  2: { reasons: "the records are kept elsewhere, a very large volume", extra: "9", cite: "TRA § 2" },
  3: { cite: "TRA § 3" }, 4: { cite: "TRA § 5", cite2: "TRA § 6" }, 5: { cite: "TRA § 7" },
  6: { cite: "TRA § 8", cite2: "TRA § 9", cite3: "TRA § 10" }, 7: { cite: "TRA § 11" },
};

test("R22: the test profile's block fills each sentence of what the office must do, the faster request, the portal and the sub-line, and its sources are listed", async () => {
  const p = await open("/app/help-records", { ...DATA_PLANE, profiles: withHelp(HELP) });
  for (const n of [1, 2, 3, 4, 5, 6, 7]) said(p, `screen.help-records.must.${n}`, FILLS[n]);
  said(p, "screen.help-records.sub", { law: "Testland Records Act", place: "Testville" });
  said(p, "screen.help-records.faster.what", { place: "Testville", ordinance: "Testville Open Ordinance", request: "quick request", window: "two business days", cite: "TOO § 1" });
  said(p, "screen.help-records.portal.where", { place: "Testville", portal: "OpenDoor" });
  unsaid(p, "screen.help-records.notheld");
  assert.doesNotMatch(text(p), /\{\w+\}/, "no placeholder is drawn");
  const sources = text(p, p.doc.getElementById("cs-main").querySelectorAll("section.cs-section").find((s) => s.textContent.includes(W("screen.help-records.sources"))));
  for (const c of ["TRA § 1", "TRA § 2", "TRA § 3", "TRA § 5", "TRA § 6", "TRA § 7", "TRA § 8", "TRA § 9", "TRA § 10", "TRA § 11", "TRA § 4(a)", "TRA § 4(b)", "TOO § 1", "https://records.testville.example"])
    assert.ok(sources.includes(c), `a source: ${c}`);
  assert.deepEqual(ops(p), []);
});

/** A sentence is drawn, in whole or in part, when any stretch of its words between the fills is on the page. */
const EN = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
const drawn = (p, key) => EN.get(key).split(/\{\w+\}/).map((x) => x.trim()).filter((x) => x.length > 8).some((x) => text(p).includes(x));

test("R22: a profile with no records help draws none of those sentences and says so; control: a block carries the page and the none line is not drawn beside it", async () => {
  const p = await open("/app/help-records", DATA_PLANE);
  // R76 (T53): the none line names the law, or says none is on file
  assert.ok(p.doc.getElementById("cs-main").querySelector("[data-notheld]"), "the none line");
  for (const key of ["screen.help-records.must.2", "screen.help-records.must.3", "screen.help-records.must.4", "screen.help-records.must.5", "screen.help-records.must.6",
    "screen.help-records.must.7", "screen.help-records.sub", "screen.help-records.faster.what", "screen.help-records.portal.where"]) assert.ok(!drawn(p, key), key);
  assert.doesNotMatch(text(p), /\{\w+\}/);
  const held = await open("/app/help-records", { ...DATA_PLANE, profiles: withHelp(HELP) });
  assert.equal(held.doc.getElementById("cs-main").querySelector("[data-notheld]"), null, "control: no none line beside a block");
  for (const key of ["screen.help-records.must.2", "screen.help-records.sub", "screen.help-records.faster.what", "screen.help-records.portal.where"]) assert.ok(drawn(held, key), key);
});

test("R22: a block missing a field leaves that sentence out, never blank and never with a placeholder; the others are still drawn", async () => {
  const cut = (f) => { const h = JSON.parse(JSON.stringify(HELP)); f(h); return h; };
  const cases = [
    [cut((h) => delete h.citations.segregate), "must.4"], [cut((h) => delete h.citations.refuse_in_writing), "must.4"], [cut((h) => delete h.citations.extend), "must.2"],
    [cut((h) => delete h.extra_days), "must.2"], [cut((h) => { h.extension_reasons = []; }), "must.2"], [cut((h) => delete h.citations.cost_electronic), "must.6"],
    [cut((h) => delete h.citations.inspect_photograph), "must.6"], [cut((h) => delete h.citations.purpose), "must.7"], [cut((h) => delete h.law), "sub"],
    [cut((h) => delete h.faster.window), "faster.what"], [cut((h) => delete h.faster), "faster.what"], [cut((h) => delete h.portal), "portal.where"],
    [cut((h) => delete h.portal.name), "portal.where"],
  ];
  for (const [help, gone] of cases) {
    const p = await open("/app/help-records", { ...DATA_PLANE, profiles: withHelp(help) });
    assert.ok(!drawn(p, `screen.help-records.${gone}`), `${gone} is left out`);
    assert.doesNotMatch(text(p), /\{\w+\}/, `${gone}: no placeholder`);
    for (const other of ["must.1", "must.2", "must.3", "must.4", "must.5", "must.6", "must.7", "sub", "faster.what", "portal.where"].filter((x) => x !== gone))
      assert.ok(drawn(p, `screen.help-records.${other}`), `${other} is still drawn`);
  }
  // no place named by the view: every sentence that needs the place is left out, the others are drawn
  const noPlace = await open("/app/help-records", { ...DATA_PLANE, profiles: ok({ ...PROFILES, view: { ...PROFILES.view, records_help: HELP } }) });
  assert.doesNotMatch(text(noPlace), /\{\w+\}/);
  for (const key of ["screen.help-records.sub", "screen.help-records.faster.what", "screen.help-records.portal.where"]) assert.ok(!drawn(noPlace, key), key);
  said(noPlace, "screen.help-records.must.1", FILLS[1]);
});
