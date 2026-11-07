/* screens-action's T51 fix round (FR-31) on `action`: R37 (the door to the deadline page for a sent action with no clock entry), R38
   (the full reply form, C66), R40 (the door to the counsel packet), R43 (the door to the send steps for an unsent action), R52 (the
   reminder the page set) and R54 (one list of laws). The harness checks every request against its owner's declaration. */
import test from "node:test";
import assert from "node:assert/strict";
import { clockWorld, openIn } from "./world-B.mjs";
import { SCREENS, open, main, text, ops, press, last, ok, beside, button, refusedIn, W, D, hasWord, DATA_PLANE, ROUTES, ACTION, ACTION_ID, FILINGS, PROFILES, draft, FILING, AFFORDANCES } from "./page.mjs";
import { DECLARED_FIELDS } from "./declared.mjs";

const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const door = (p, screen) => main(p).querySelector(`[data-list="${screen}"] a[data-screen="${screen}"]`);

test("R37: a sent action with no clock entry draws a reference to `due-date` for it, with the card's name and purpose; control: with entries the dates link as before and no such reference is added", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, clock: [] }) });
  const d = door(p, "due-date");
  assert.ok(d, "the reference");
  assert.equal(d.getAttribute("href"), `/app/due-date/${encodeURIComponent(ACTION_ID)}`);
  assert.equal(d.textContent.trim(), W("screen.due-date.name"));
  said(p, "screen.due-date.purpose");
  const q = await open(ROUTES.action, DATA_PLANE);
  assert.equal(door(q, "due-date"), null, "control: entries unchanged");
  assert.ok(main(q).querySelectorAll('a[href^="/app/due-date/"]').length >= 1, "each due date still opens due-date");
  const unsent = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, clock: [], correspondence: [], entries: [] }) });
  assert.equal(door(unsent, "due-date"), null, "control: an action never sent has no deadline to explain yet");
});

test("R40: `action` draws a reference opening `counsel` for the action, its card the screen's name and purpose", async () => {
  const p = await open(ROUTES.action, DATA_PLANE);
  const d = door(p, "counsel");
  assert.ok(d, "the reference");
  assert.equal(d.getAttribute("href"), `/app/counsel/${encodeURIComponent(ACTION_ID)}`);
  assert.equal(d.textContent.trim(), W("screen.counsel.name"));
  said(p, "screen.counsel.purpose");
});

test("R43: any unsent action draws the door to `start-send`, where its text is prepared; a sent one does not", async () => {
  const unsent = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, correspondence: [], entries: [], current_state: "planned", kind: "request_for_comment" }) });
  const d = door(unsent, "start-send");
  assert.ok(d, "the door");
  assert.equal(d.getAttribute("href"), `/app/start-send/${encodeURIComponent(ACTION_ID)}`);
  assert.equal(d.textContent.trim(), W("screen.start-send.name"));
  const sent = await open(ROUTES.action, DATA_PLANE);
  assert.equal(door(sent, "start-send"), null, "control: a sent action has no such door");
  const recorded = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, correspondence: [], entries: [] }),
    filingsfor: ok(FILINGS([draft({ sending: { sent_on: "2026-10-09", at: "2026-10-09" }, approval: { by: "member:mai" } })])) });
  assert.equal(door(recorded, "start-send"), null, "control: a sending recorded through the filing counts as sent");
});

test("R38: the reply form sends actioncorrespond with each field under the name `actions` declares; every field the design holds a word for is drawn", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actioncorrespond: ok({}) });
  const stages = AFFORDANCES.vocabularies.correspondence_stages ? AFFORDANCES.vocabularies.correspondence_stages.received : null;
  assert.equal(stages, null, "the fixture's vocabulary holds none: the stage and outcome choices are drawn only from `affordances`");
  const vocab = { vocabularies: { ...AFFORDANCES.vocabularies, correspondence_stages: { sent: ["request"], received: ["acknowledgement", "fee_waiver_decision", "denial"] },
    correspondence_outcomes: ["granted", "denied", "none_exists"] } };
  const q = await open(ROUTES.action, { ...DATA_PLANE, affordances: ok(vocab), actioncorrespond: ok({}) });
  // every declared name the form sends is one `actions` accepts (the guard fails the press otherwise)
  await press(q, "actioncorrespond", { reason: "it came", values: { "reply-dir": "received", "reply-at": "2026-10-11", "reply-party": "Office of the City Clerk",
    "reply-account": "A denial citing the investigatory exemption.", "reply-stage": "denial", "reply-follows": "1", "reply-outcome": "denied", "reply-exemptions": "Gov. Code 7923.600",
    "reply-dueby": "2026-10-26", "reply-duecite": "Gov. Code § 7922.535(b)" } });
  const r = last(q, "actioncorrespond");
  const sent = Object.fromEntries(Object.entries(r.query).filter(([k]) => k !== "op" && k !== "reason"));
  assert.deepEqual(sent, { target: ACTION_ID, direction: "received", at: "2026-10-11", account: "A denial citing the investigatory exemption.", party: "Office of the City Clerk",
    stage: "denial", follows: "1", outcome: "denied", exemptions: "Gov. Code 7923.600", due_cite: "Gov. Code § 7922.535(b)", due_by: "2026-10-26" });
  for (const name of Object.keys(sent)) assert.ok(DECLARED_FIELDS("actioncorrespond").includes(name), `${name} is declared`);
  // the stage and outcome words are the design's where it holds them
  const stage = q.doc.getElementById("reply-stage").querySelectorAll("option").map((o) => o.textContent.trim());
  assert.ok(stage.includes(W("screen.action.decision.on.a.fee.waiver")), "a stage with a key is drawn by it");
  assert.ok(q.doc.getElementById("reply-outcome").querySelectorAll("option").map((o) => o.textContent.trim()).includes(W("screen.action.no.such.records.exist")));
  // a silence takes its day alone
  const s = await open(ROUTES.action, { ...DATA_PLANE, actioncorrespond: ok({}) });
  await press(s, "actioncorrespond", { reason: "none came", values: { "reply-dir": "no_response", "reply-at": "2026-10-14", "reply-account": "ignored" } });
  const none = last(s, "actioncorrespond").query;
  // `actions` records a silence as a named account with its date (DEC-13): the account is the design's sentence for it, never the member's text
  assert.deepEqual([none.target, none.direction, none.at, none.account, none.stage], [ACTION_ID, "no_response", "2026-10-14", W("screen.action.no.reply.came.by.the.date"), undefined], "'no response' alone is accepted");
  assert.ok(p.byOp("actioncorrespond").length === 0, "control: opening sends nothing");
});

test("R38: a reply needs its day and a received one its account; a refusal is drawn by its words and the form keeps what was typed", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actioncorrespond: refusedIn("LIFECYCLE_TEXT_UNWRITABLE", "the owner's own sentence") });
  let b = await press(p, "actioncorrespond", { reason: "x", values: { "reply-dir": "received", "reply-at": "2026-10-11" } });
  assert.ok(beside(p, b).includes(W("screen.action.reply.account.needed")));
  b = await press(p, "actioncorrespond", { reason: "x", values: { "reply-account": "kept words", "reply-at": "" } });
  assert.ok(beside(p, b).includes(W("screen.action.reply.at.needed")));
  assert.equal(p.byOp("actioncorrespond").length, 0, "control: nothing is sent while a needed field is empty");
  await press(p, "actioncorrespond", { reason: "x", values: { "reply-at": "2026-10-11" } });
  assert.equal(p.doc.getElementById("reply-account").value, "kept words", "the form keeps what was typed");
});

test("R52 (L21): after `reminderset` the entry shows the day the member set, by key; control: a refused day shows its refusal and no reminder", async () => {
  // C53: the reminder is the record's (`remindersfor`, action-clocks R26): the world's store keeps what `reminderset` was sent and answers it back
  const { world, me, action } = await clockWorld();
  const p = await openIn(world, me, `/app/action/${action}`);
  await press(p, "reminderset", { nth: 1, values: { "remind-1": "2099-10-20" } });
  assert.deepEqual(last(p, "reminderset").body, { target: action, entry: 1, on: "2099-10-20" });
  const mark = main(p).querySelector('[data-reminder="1"]');
  assert.ok(mark, "the reminder is drawn beside its entry");
  assert.ok(mark.textContent.includes(W("screen.reminder.on", { date: D("2099-10-20") })), "the sentence by key (DEC-387: `screen.reminder.on`), with the day");
  assert.equal(main(p).querySelector('[data-reminder="0"]'), null, "only the entry it was set on");
  // a refused day: the same day set twice on one entry is the owner's own refusal (REMINDER_REFUSED, arm `held`), and the record holds the one reminder
  const { world: w2, me: m2, action: a2 } = await clockWorld({ handle: "mai" });
  await m2.act("reminderset", { body: { target: a2, entry: 1, on: "2099-10-20" } });
  const r = await openIn(w2, m2, `/app/action/${a2}`);
  const b = await press(r, "reminderset", { nth: 1, values: { "remind-1": "2099-10-20" } });
  assert.ok(beside(r, b).includes(W("refusal.REMINDER_REFUSED")), "by its word");
  assert.equal((await m2.read("remindersfor", { query: { action: a2 } })).reminders.length, 1, "a refused day sets no further reminder");
  const none = await openIn(w2, m2, `/app/action/${a2}`);
  const c = await press(none, "reminderset", { nth: 1, values: { "remind-1": "" } });
  assert.ok(beside(none, c).includes(W("screen.action.remindon.needed")));
  assert.equal(none.byOp("reminderset").length, 0, "control: no day, nothing sent");
});

test("R54, R59 (E3; DEC-439 E H1b): 'Change the law…' and 'Propose another law…' share one list of laws (`law.pick`) drawn once with both acts under it; each act sends the chosen law with the fields its owner declares; control: no laws draws neither act", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionlaws: ok({}), actionlawspropose: ok({}) });
  const picks = main(p).querySelectorAll("select").filter((s) => s.id === "law-pick");
  assert.equal(picks.length, 1, "one list");
  const label = main(p).querySelector('label[for="law-pick"]');
  assert.ok(label && label.textContent.includes(W("law.pick")), "its label is the pick key");
  assert.deepEqual(ops(p).filter((o) => o === "actionlaws" || o === "actionlawspropose"), ["actionlaws", "actionlawspropose"], "both acts, once each");
  await press(p, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  await press(p, "actionlawspropose", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  for (const op of ["actionlaws", "actionlawspropose"]) {
    const b = last(p, op).body;
    assert.deepEqual(b, { target: ACTION_ID, laws: [{ level: "city", citation: "Mun. Code § 2.20.230" }] }, op);
    for (const name of Object.keys(b)) assert.ok(DECLARED_FIELDS(op).includes(name), `${op}: ${name} is declared`);
  }
  const none = await open(ROUTES.action, { ...DATA_PLANE, profiles: ok({ ...PROFILES, view: { deadlines: [] } }) });
  // R59 (DEC-439 E H1b): with no law the places list, there is no list and no change to make; the member names the law herself, so only the propose act is drawn
  assert.ok(!ops(none).includes("actionlaws"), "control: no laws, no change");
  assert.ok(ops(none).includes("actionlawspropose"), "the member names the law (R59)");
  assert.equal(none.doc.getElementById("law-pick"), null);
});

test("R37, R38, R40, R43, R52, R54 (R19): each key the new lines name is a word of setup-words, on the screen that draws it", () => {
  const words = new Set(SCREENS.find((s) => s.id === "action").words);
  for (const k of ["screen.due-date.name", "screen.due-date.purpose", "screen.counsel.name", "screen.counsel.purpose", "screen.start-send.name", "screen.start-send.purpose", "law.pick",
    "screen.action.the.day.it.came.or.the", "screen.action.who.it.came.from", "screen.action.your.account.of.the.reply", "screen.action.what.kind.of.reply",
    "screen.action.what.the.office.decided", "screen.action.the.exemptions.the.office.cites", "screen.action.the.office.says.it.will.answer",
    "screen.action.the.law.that.date.comes.from", "screen.action.what.the.fee.is.for", "screen.action.remindon"]) {
    assert.ok(hasWord(k), `${k} is a word`);
    assert.ok(words.has(k), `action reads ${k}`);
  }
});
