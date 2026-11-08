/* screens-action's T53 marks on `action` (R62, R63, R64, R65, R66, R77, R79) and the addressee on `dash-action` (R65). Each is drawn by key
   (R19) over the module's fixtures, the shell's harness checking every request against its owner's declaration. */
import test from "node:test";
import assert from "node:assert/strict";
import { SCREENS, open, main, text, press, last, ok, beside, choose, W, D, hasWord, DATA_PLANE, ROUTES, ACTION, ACTION_ID, PROFILES, GUIDES, TEMPLATES } from "./page.mjs";

const AT = (p, key, vars) => text(p).includes(W(key, vars));

test("R63: 'Move it to resolved' with no resolution chosen says 'Choose how it was resolved' and sends nothing; none is preselected; choosing one sends it; control: another move is unchanged", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, actionmove: ok({}) });
  const sel = p.doc.getElementById("move-resolution");
  assert.equal(sel.value, "", "no resolution is preselected");
  const b = await press(p, "actionmove", { values: { "move-to": "resolved", "move-resolution": "" }, reason: "it is done" });
  assert.equal(p.byOp("actionmove").length, 0, "nothing is sent");
  assert.ok(beside(p, b).includes(W("screen.action.move.resolution.needed")), "the sentence is drawn beside the act");
  await press(p, "actionmove", { values: { "move-to": "resolved", "move-resolution": "withdrawn" }, reason: "we withdrew it" });
  assert.deepEqual([last(p, "actionmove").query.to, last(p, "actionmove").query.resolution], ["resolved", "withdrawn"], "the resolution she chose is the one sent");
  const q = await open(ROUTES.action, { ...DATA_PLANE, actionmove: ok({}) });
  await press(q, "actionmove", { values: { "move-to": "active" }, reason: "back to work" });
  assert.equal(last(q, "actionmove").query.to, "active", "control: another move needs no resolution");
  assert.equal(last(q, "actionmove").query.resolution, undefined);
});

test("R64: replies recorded out of date order are listed by the day each arrived, then in recorded order, and the list says so; control: one reply draws no order sentence", async () => {
  const corr = [
    { ord: 0, direction: "sent", at: "2026-10-02", party: "Office of the City Clerk", author: "member:mai" },
    { ord: 1, direction: "received", at: "2026-10-09", party: "Reply Late", author: "member:mai" },
    { ord: 2, direction: "received", at: "2026-10-05", party: "Reply Early One", author: "member:mai" },
    { ord: 3, direction: "received", at: "2026-10-05", party: "Reply Early Two", author: "member:mai" },
  ];
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, correspondence: corr, entries: [] }) });
  const t = text(p);
  const at = ["Reply Early One", "Reply Early Two", "Reply Late"].map((n) => t.indexOf(n));
  assert.ok(at.every((i) => i >= 0), "each reply is drawn");
  assert.deepEqual([...at].sort((a, b) => a - b), at, "by day, then in recorded order");
  assert.ok(AT(p, "screen.action.replies.order"), "the sentence says which order");
  const one = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, correspondence: corr.slice(0, 2), entries: [] }) });
  assert.ok(!AT(one, "screen.action.replies.order"), "control: one reply needs no order");
});

test("R65: an action addressed to 'Public Works Director' (named in the composer's Who) draws that name on its head and in the dashboard's list; control: an office addressee draws as before", async () => {
  const cp = { state: "audience", description: "Public Works Director" };
  const named = { ...ACTION, addressee: undefined, counterparty: cp };
  const p = await open(ROUTES.action, { ...DATA_PLANE, action: ok(named) });
  const sub = text(p, main(p).querySelector(".mk-sub"));
  assert.ok(sub.includes(W("screen.action.to", { office: "Public Works Director" })), "the head names the addressee");
  const d = await open(ROUTES["dash-action"], { ...DATA_PLANE, action: ok(named) });
  const row = main(d).querySelector(`a[href="/app/action/${ACTION_ID}"]`);
  assert.ok(row, "the action is listed");
  assert.ok(text(d, row.closest("tr")).includes("Public Works Director"), "its list row names the addressee");
  const q = await open(ROUTES.action, DATA_PLANE);
  assert.ok(text(q, main(q).querySelector(".mk-sub")).includes(W("screen.action.to", { office: "City Clerk, Office of the City Clerk" })), "control: the office as before");
});

test("R66: the first reply to the request follows it without a choice; a later stage with none chosen names the entry it must follow and sends nothing; choosing the request (position 0) is accepted", async () => {
  const vocab = { vocabularies: { ...DATA_PLANE.affordances ? {} : {}, correspondence_stages: { sent: ["request"], received: ["acknowledgement", "denial"] }, correspondence_outcomes: ["denied"] } };
  const base = { ...DATA_PLANE, actioncorrespond: ok({}), affordances: ok({ vocabularies: { ...(await import("./page.mjs")).AFFORDANCES.vocabularies, ...vocab.vocabularies } }) };
  const reqOnly = { ...ACTION, correspondence: [{ ord: 0, direction: "sent", at: "2026-10-02", stage: "request", author: "member:mai" }], entries: [] };
  const first = await open(ROUTES.action, { ...base, action: ok(reqOnly) });
  const offered = first.doc.getElementById("reply-follows").querySelectorAll("option").map((o) => o.value);
  assert.ok(offered.includes("0"), "the request entry (position 0) is offered to follow");
  await press(first, "actioncorrespond", { reason: "x", values: { "reply-at": "2026-10-04", "reply-account": "They received it.", "reply-stage": "acknowledgement" } });
  assert.equal(last(first, "actioncorrespond").query.follows, "0", "control: the first reply follows the request with no choice made");
  const later = await open(ROUTES.action, { ...base, action: ok({ ...reqOnly, correspondence: [...reqOnly.correspondence,
    { ord: 1, direction: "received", at: "2026-10-04", stage: "acknowledgement", follows: 0, author: "member:mai" }] }) });
  const b = await press(later, "actioncorrespond", { reason: "x", values: { "reply-at": "2026-10-09", "reply-account": "They denied it.", "reply-stage": "denial" } });
  assert.equal(later.byOp("actioncorrespond").length, 0, "with none chosen nothing is sent");
  assert.ok(beside(later, b).includes(W("screen.action.reply.follows.needed")), "the sentence names what it must follow");
  await press(later, "actioncorrespond", { reason: "x", values: { "reply-at": "2026-10-09", "reply-account": "They denied it.", "reply-stage": "denial", "reply-follows": "0" } });
  assert.equal(last(later, "actioncorrespond").query.follows, "0", "following the request is accepted");
});

test("R62: a guide not offered says so with what it lacks; a kind with no template says 'No profile text for this yet'; a reviewed guide names its reviewer, organisation and date, past 12 months 'last checked'; an opted-out guide says 'Not reviewed' with who and when; control: a reviewed guide draws no 'Not reviewed'", async () => {
  const lacks = ["professional_review", "second_approval"];
  const guides = { ...GUIDES, guides: [
    { ...GUIDES.guides[0], reviewed: { name: "Dana Ortiz", organisation: "Records Law Clinic", at: "2025-09-01" },
      statements: [{ key: "text.reviewedby", vars: { name: "Dana Ortiz", organisation: "Records Law Clinic", date: "2025-09-01" } }, { key: "text.lastchecked", vars: { date: "2026-10-01" } }] },
    { ...GUIDES.guides[1], approved_by: undefined, approved_at: undefined, not_reviewed: { member: "member:mai", at: "2026-10-03T09:00:00Z" } }],
    not_offered: [{ kind: "records_request", layer: "us-ca-oakland", lacks }] };
  const p = await open(ROUTES.action, { ...DATA_PLANE, procedureguides: ok(guides), templatesforaction: ok({ ...TEMPLATES, versions: [], not_offered: [] }) });
  const lackWords = lacks.map((k) => W(`screen.action.guide.lacks.${k}`)).join(", ");
  assert.ok(AT(p, "screen.action.guide.notyet", { lacks: lackWords }), "'Not offered yet' with what it lacks");
  assert.ok(AT(p, "screen.action.templates.noprofile"), "no template at all: 'No profile text for this yet'");
  const rv = text(p, main(p).querySelector('[data-standing="reviewed"]'));
  assert.equal(rv, W("text.reviewedby", { name: "Dana Ortiz", organisation: "Records Law Clinic", date: D("2025-09-01") }));
  assert.equal(text(p, main(p).querySelector('[data-standing="lastchecked"]')), W("text.lastchecked", { date: D("2026-10-01") }));
  const nr = text(p, main(p).querySelector('[data-standing="notreviewed"]'));
  assert.ok(nr.includes(W("guide.procedure.notreviewed")) && nr.includes(W("guide.procedure.notreviewed.by", { member: "mai", date: D("2026-10-03") })), "'Not reviewed' with her name and the day");
  const q = await open(ROUTES.action, { ...DATA_PLANE, procedureguides: ok({ ...guides, guides: guides.guides.slice(0, 1), not_offered: undefined }) });
  assert.equal(main(q).querySelector('[data-standing="notreviewed"]'), null, "control: a reviewed guide draws no 'Not reviewed'");
  assert.equal(main(q).querySelector('[data-guide="notyet"]'), null, "control: nothing not offered");
  assert.ok(!AT(q, "screen.action.templates.noprofile"), "control: a kind with templates says none is missing");
});

test("R79: 'Show the routes' with none says why and opens where a missing rule is drafted; control: a kind with routes lists them", async () => {
  const p = await open(ROUTES.action, { ...DATA_PLANE, procedureguides: ok({ ...GUIDES, guides: [] }) });
  await press(p, "procedureguides");
  assert.ok(AT(p, "screen.action.routes.none") && AT(p, "screen.action.routes.why"), "no route, and the cause");
  const d = main(p).querySelector('[data-list="grouprules"] a[data-screen="grouprules"]');
  assert.ok(d && d.getAttribute("href") === "/app/grouprules", "the door to where it is given");
  const q = await open(ROUTES.action, DATA_PLANE);
  assert.ok(!AT(q, "screen.action.routes.why") && text(q).includes(GUIDES.guides[0].items[0].route), "control: the routes are listed");
});

test("R77: 'Propose another law' with the citation empty says 'Write the law's citation first' beside the field and sends nothing; control: a citation proposes the law", async () => {
  const plane = { ...DATA_PLANE, actionlawspropose: ok({}), profiles: ok({ ...PROFILES, view: { deadlines: [] } }) };
  const p = await open(ROUTES.action, plane);
  const b = await press(p, "actionlawspropose", { values: { "law-cite": "" } });
  assert.equal(p.byOp("actionlawspropose").length, 0, "nothing sent");
  assert.ok(beside(p, b).includes(W("screen.action.law.citation.needed")));
  await press(p, "actionlawspropose", { values: { "law-cite": "Gov. Code § 7922.535", "law-level": "state" } });
  assert.deepEqual(last(p, "actionlawspropose").body.laws, [{ level: "state", citation: "Gov. Code § 7922.535" }]);
});

test("R62, R63, R64, R66, R77, R79 (R19): each key the new lines name is a word of setup-words, on the `action` screen", () => {
  const words = new Set(SCREENS.find((s) => s.id === "action").words);
  for (const k of ["screen.action.move.resolution.needed", "screen.action.replies.order", "screen.action.reply.follows.needed", "screen.action.guide.notyet",
    "screen.action.guide.lacks.writer", "screen.action.guide.lacks.sources", "screen.action.guide.lacks.professional_review", "screen.action.guide.lacks.second_approval",
    "screen.action.templates.noprofile", "screen.action.law.citation.needed", "screen.action.routes.none", "screen.action.routes.why", "text.reviewedby", "text.lastchecked",
    "guide.procedure.notreviewed", "guide.procedure.notreviewed.by", "screen.grouprules.name", "screen.grouprules.purpose"]) {
    assert.ok(hasWord(k), `${k} is held`);
    assert.ok(words.has(k), `${k} is the screen's`);
  }
});
