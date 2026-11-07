/* screens-action's T53 marks on `hold` and `holdnotice` (R70, R75's recording sentence), `dash-action` (R72) and `actionnew` (R78's office
   choice, R80, R81), and R81 on `plan` and `matter`. Hold places are the real `action-holds` over the module's world; each sentence by key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, correspond, openIn } from "./world.mjs";
import { matterWorld } from "./world-A.mjs";
import { SCREENS, open, main, text, press, last, ok, refusedIn, W, D, hasWord, DATA_PLANE, ROUTES, ACTION, ACTION_ID, ACTIONS, PLAN_ID, PROJECT } from "./page.mjs";

const slot = (p, b) => text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
const reasonBox = (p) => p.root().querySelector('[data-shell="reason-send"]');

async function heldReply({ held = true } = {}) {
  const { world, me, action } = await actionWorld();
  await correspond(me, action, "sent");
  const ord = await correspond(me, action, "received", { pressure: { kind: "legal", note: "a letter from the city's counsel" } });
  if (held) await me.act("actionhold", { body: { target: action, ord, hold: "in_place", reason: "a claim is coming" } });
  return { world, me, action, ord };
}

test("R70: after the hold is placed 'Prepare the hold notice' is still offered and its link carries ids only; 'Release the hold' is offered only where a hold is; the kinds have capitals; control: placing and releasing as before", async () => {
  const { world, me, action, ord } = await heldReply();
  const p = await openIn(world, me, `/app/hold/${action}`);
  const link = main(p).querySelector('a[data-notice="1"]');
  assert.ok(link, "the notice link is still drawn once the hold is placed");
  assert.equal(link.getAttribute("href"), `/app/holdnotice/${action}~${ord}`, "ids only, no encoded text");
  const release = p.doc.getElementById("hold-release-for").querySelectorAll("option").map((o) => o.value).filter(Boolean);
  assert.deepEqual(release, [JSON.stringify({ target: action, ord })], "only the place that holds a hold is offered to release");
  const kinds = p.doc.getElementById("hold-press-kind").querySelectorAll("option").map((o) => o.textContent.trim());
  assert.deepEqual(kinds, ["legal", "retaliation", "discrediting", "other"].map((k) => W(`screen.hold.kind.${k}`)), "in the member's words, with capitals");
  // the notice opened from that link reads the place from its ids and prepares the notice
  const n = await openIn(world, me, link.getAttribute("href"));
  await press(n, "holdnoticeprepare", { reason: "x" });
  assert.deepEqual(last(n, "holdnoticeprepare").body.place, { target: action, ord });
  assert.ok(n.doc.getElementById("hold-notice").value.length > 0, "prepared");
  // a pressure with no hold: no Release offered for it, and the pre-hold press says a hold is needed first
  const u = await heldReply({ held: false });
  const q = await openIn(u.world, u.me, `/app/hold/${u.action}`);
  const rel = q.doc.getElementById("hold-release-for");
  assert.ok(!rel || rel.querySelectorAll("option").map((o) => o.value).filter(Boolean).length === 0, "no Release for a pressure with no hold");
  const m = await openIn(u.world, u.me, `/app/holdnotice/${u.action}~${u.ord}`);
  const b = await press(m, "holdnoticeprepare", { reason: "x" });
  assert.ok(slot(m, b).includes(W("screen.holdnotice.needhold")), "a hold is needed first");
  // control: placing still sends the place and the reason
  await press(q, "actionhold", { values: { "hold-for": JSON.stringify({ target: u.action, ord: u.ord }), "hold-reason": "a claim is coming" } });
  assert.deepEqual([last(q, "actionhold").body.target, last(q, "actionhold").body.ord, last(q, "actionhold").body.hold], [u.action, u.ord, "in_place"]);
});

test("R75: 'Record that I sent it' ends in a sentence saying it was recorded, how and when ('in person' as a way, never a name); control: the notice remains editable", async () => {
  const { world, me, action, ord } = await heldReply();
  const p = await openIn(world, me, `/app/holdnotice/${action}~${ord}`);
  await press(p, "holdnoticeprepare", { reason: "x" });
  assert.equal(p.doc.getElementById("hold-notice").tagName, "TEXTAREA", "control: editable");
  await press(p, "holdnoticesent", { values: { "hold-sent-at": "2026-10-20", "hold-sent-how": "person", "hold-account": "Handed to each member at the meeting." }, reason: "x" });
  assert.equal(last(p, "holdnoticesent").body.medium, "person");
  const done = main(p).querySelector('[data-sent="1"]');
  assert.ok(done, "the sentence is drawn");
  assert.equal(text(p, done), W("screen.holdnotice.sent.done", { how: W("screen.holdnotice.way.person"), date: D("2026-10-20") }));
});

test("R72: seven actions, two waiting on the team: the tier lists those two above the rest, and every row says whose move, the clock and next; control: with none waiting the tier is not drawn", async () => {
  const ids = Array.from({ length: 7 }, (_, i) => `ACTN-2026-${String(i).repeat(16)}`);
  const items = ids.map((id) => ({ id, state: "awaiting_response", kind: "records_request", counterparty: { role: "City Clerk" }, counterparty_state: "named" }));
  const actionOf = (id, i) => ({ ...ACTION, id, title: `Action ${i}`, clock: i === 6 ? [] : ACTION.clock, correspondence: i >= 5 ? [] : ACTION.correspondence, reply_owed: { owed: false } });
  const plane = (ours) => ({ ...DATA_PLANE, actions: ok({ ...ACTIONS, items }),
    action: (req) => ok(actionOf(req.query.id, ids.indexOf(req.query.id))),
    filingsfor: (req) => ok({ action: req.query.id, drafts: ours.includes(req.query.action) ? [{ filing: "FIL-2026-cccccccccccccccc", form: "communication", purpose: "request", label: "x", at: "2026-10-09T10:00:00Z", approval: null, sending: null }] : [],
      drafts_truncated: false, packets: [], packets_truncated: false }) });
  const p = await open(ROUTES["dash-action"], plane([ids[1], ids[3]]));
  const tier = main(p).querySelectorAll("section.cs-section").find((s) => (s.querySelector("h2") || { textContent: "" }).textContent.trim() === W("screen.dash-action.yours.heading"));
  assert.ok(tier, "the tier is drawn");
  assert.deepEqual(tier.querySelectorAll("a.cs-ref").map((a) => a.getAttribute("href")), [`/app/action/${ids[1]}`, `/app/action/${ids[3]}`], "the two waiting on the team");
  const all = main(p).querySelectorAll("section.cs-section");
  assert.ok(all.indexOf(tier) < all.findIndex((s) => s.textContent.includes(W("screen.dash-action.every.heading"))), "above the rest");
  for (const tr of main(p).querySelectorAll("tbody tr")) {
    const tds = tr.querySelectorAll("td").map((td) => td.textContent.trim());
    assert.ok(tds[2] && tds[3] && tds[4], `every column says something: ${tds.join(" | ")}`);
  }
  assert.ok(text(p).includes(W("screen.dash-action.whose.none")) && text(p).includes(W("screen.dash-action.next.prepare")) && text(p).includes(W("screen.dash-action.clock.none")));
  const q = await open(ROUTES["dash-action"], plane([]));
  assert.ok(!text(q).includes(W("screen.dash-action.yours.heading")), "control: none waiting, no tier");
});

test("R78: 'Choose the office' is drawn from the start with the offices the team holds; with none, the sentence and the way to the add; a press with none known says so; control: picking a question does not remove it", async () => {
  const office = { entity_id: "ENT-2026-3333333333333333", kind: "office", label: "Records desk", body: "City of Walkton" };
  const held = (req) => ok(req.query.kind === "office" ? { ok: true, kind: "office", entities: [office], count: 1, truncated: false } : { ok: true, kind: req.query.kind, entities: [], count: 0, truncated: false });
  const p = await open(ROUTES.actionnew, { ...DATA_PLANE, entitieskind: held, actioncreate: ok({ id: ACTION_ID }) });
  const opts = () => p.doc.getElementById("an-office").querySelectorAll("option").map((o) => o.textContent.trim()).filter(Boolean);
  assert.deepEqual(opts(), ["Records desk, City of Walkton"], "drawn at once, before any question is picked");
  await press(p, "actioncreate", { values: { "an-office": "0", "an-ask": "Comment on the repairs" }, reason: "x" });
  const doc = last(p, "actioncreate").body.document;
  assert.ok(doc.includes('role: "Records desk"') && doc.includes('body: "City of Walkton"') && doc.includes('entity_id: "ENT-2026-3333333333333333"'), "the office held is the addressee");
  const none = await open(ROUTES.actionnew, { ...DATA_PLANE, entitieskind: (req) => ok({ ok: true, kind: req.query.kind, entities: [], count: 0, truncated: false }) });
  assert.ok(main(none).querySelector('[data-nooffice="1"]') && text(none).includes(W("screen.actionnew.office.none")), "the sentence");
  assert.ok(main(none).querySelector(`[data-list="request"] a[href="/app/request/${PROJECT}"]`), "and the way to the add");
  const b = await press(none, "actioncreate", { values: { "an-ask": "Comment on the repairs" }, reason: "x" });
  assert.equal(none.byOp("actioncreate").length, 0);
  assert.ok(slot(none, b).includes(W("screen.actionnew.office.noneknown")), "a press with none known says so");
});

test("R80: the deadline's and the addressee's refusals are short sentences in the member's words, no code word and no semicolon list; control: the plane's code is still what the answer carries", async () => {
  const p = await open(ROUTES.actionnew, { ...DATA_PLANE, actioncreate: refusedIn("CLOCK_REFUSED") });
  const a = await press(p, "actioncreate", { values: { "an-ask": "Comment", "an-who": "The auditor", "an-due-text": "Story runs" }, reason: "x" });
  const t = slot(p, a);
  assert.ok(t.includes(W("screen.actionnew.refused.deadline")), "the deadline's");
  assert.doesNotMatch(t, /[A-Z]{2,}_[A-Z]+|;/);
  await press(p, "actioncreate", { values: { "an-due-text": "", "an-due-date": "", "an-due-because": "" }, reason: "x" });
  const sent = p.byOp("actioncreate");
  assert.equal(sent.length, 1, "control: the plane is asked");
  assert.ok(slot(p, a).includes(W("screen.actionnew.refused.deadline")), "the plane's CLOCK_REFUSED drawn in the member's words");
  const q = await open(ROUTES.actionnew, DATA_PLANE);
  const { choose } = await import("./page.mjs");
  await choose(q, "an-to", "undetermined");
  const b = await press(q, "actioncreate", { values: { "an-ask": "Comment" }, reason: "x" });
  assert.ok(slot(q, b).includes(W("screen.actionnew.refused.addressee")) && !/;/.test(W("screen.actionnew.refused.addressee")), "the addressee's");
});

test("R81: 'Start the action', 'Add an option' and 'Record this determination' pressed with the required field empty name it and open no reason box; with it filled the act goes on; control: other acts are unchanged", async () => {
  const p = await open(ROUTES.actionnew, { ...DATA_PLANE, actioncreate: ok({ id: ACTION_ID }) });
  const b = await press(p, "actioncreate", { values: { "an-ask": "", "an-who": "The auditor" } });
  assert.ok(slot(p, b).includes(W("screen.actionnew.asks.needed")), "the field is named");
  assert.equal(reasonBox(p), null, "no reason box");
  assert.equal(p.byOp("actioncreate").length, 0);
  await press(p, "actioncreate", { values: { "an-ask": "Comment on the repairs", "an-who": "The auditor" }, reason: "x" });
  assert.equal(p.byOp("actioncreate").length, 1, "filled: the act goes on");
  const pl = await open(`/app/plan/${PLAN_ID}`, { ...DATA_PLANE, optionadd: ok({}) });
  const o = await press(pl, "optionadd", { values: { "plan-opt-summary": "" } });
  assert.ok(slot(pl, o).includes(W("screen.plan.option.needed")), "'Add an option' names the option");
  assert.equal(reasonBox(pl), null, "no reason box");
  const w = await matterWorld();
  const m = await openIn(w.world, w.me, `/app/matter/${w.project}`);
  const r = await press(m, "determine", { values: { "mt-d-event": "" } });
  assert.ok(slot(m, r).includes(W("refusal.NO_SUCH_EVENT")), "'Record this determination' names the event");
  assert.equal(reasonBox(m), null, "no reason box");
  assert.equal(m.byOp("determine").length, 0);
});

test("R70, R72, R75, R78, R80, R81 (R19): each key the new lines name is a word of setup-words, on the screen that draws it", () => {
  const on = (id) => new Set(SCREENS.find((s) => s.id === id).words);
  const need = { hold: ["screen.hold.kind.legal", "screen.hold.kind.retaliation", "screen.hold.kind.discrediting", "screen.hold.kind.other"],
    holdnotice: ["screen.holdnotice.needhold", "screen.holdnotice.sent.done", "screen.holdnotice.way.email", "screen.holdnotice.way.message", "screen.holdnotice.way.person", "screen.holdnotice.way.other"],
    "dash-action": ["screen.dash-action.yours.heading", "screen.dash-action.yours.help", "screen.dash-action.whose.none", "screen.dash-action.clock.entry", "screen.dash-action.clock.none",
      "screen.dash-action.next.approve", "screen.dash-action.next.second", "screen.dash-action.next.send", "screen.dash-action.next.prepare", "screen.dash-action.next.none"],
    actionnew: ["screen.actionnew.office.none", "screen.actionnew.office.noneknown", "screen.actionnew.refused.addressee", "screen.actionnew.refused.deadline", "screen.actionnew.asks.needed", "screen.request.office"] };
  for (const [id, ks] of Object.entries(need)) for (const k of ks) { assert.ok(hasWord(k), k); assert.ok(on(id).has(k), `${id} reads ${k}`); }
});
