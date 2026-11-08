/* screens-action R32, R33, R34 (T51-122; DEC-340, U366): the litigation hold, its notice, and the counsel packet. Every sentence is asserted by its
   key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, correspond, counselMatter, openIn } from "./world.mjs";
import { holdPlacedReleasedAnswers } from "../action-holds/fixtures.mjs";
import { open, main, text, ops, press, last, ok, refusedIn, button, beside, choose, W, D, DATA_PLANE, ROUTES, ACTION, ACTION_ID, PROJECT, HOLDS_DUE, COUNSEL_PROJECT, NOTICE, PACKET, READER } from "./page.mjs";

const ROUTES_AT = { hold: (a) => `/app/hold/${a}`, action: (a) => `/app/action/${a}` };
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
const section = (p, titleKey) => main(p).querySelectorAll("section.cs-section").find((s) => (s.querySelector("h2") || { textContent: "" }).textContent.trim() === W(titleKey));
const slot = (p, b) => text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));

test("R32: `hold` reads `holdsdue` for where the pressure arrived (a reply, a docket entry, pressure outside any action) and the counsel matters from `projectlist`, each marked with no hold placed", async () => {
  const p = await open(ROUTES.hold, DATA_PLANE);
  assert.equal(p.byOp("holdsdue").length, 1);
  assert.equal(p.byOp("projectlist").length, 1);
  const s = section(p, "screen.hold.where.heading");
  const t = s.textContent.replace(/\s+/g, " ");
  said(p, "screen.hold.sub1");
  assert.ok(t.includes(W("screen.hold.reply")) && t.includes(W("screen.hold.outside")) && t.includes(W("screen.hold.marked", { member: "dev" })), "the three places");
  assert.equal(t.split(W("screen.hold.nohold")).length, 4, "each says no hold is placed");
  assert.ok(t.includes("The rent dispute") && t.includes(W("screen.hold.counsel.row")), "a counsel matter");
  assert.ok(!t.includes("Pothole repairs"), "control: a project that is no counsel matter is not listed");
  const tip = s.querySelector("h2").getAttribute("data-tip");
  assert.ok(tip.length > 0);
});

test("R32: the docket marks and counsel matters are places the hold may be placed at", async () => {
  const p = await open(ROUTES.hold, DATA_PLANE);
  const docket = JSON.stringify({ project: PROJECT, from: { docket_entry: "DKT-2026-1" } });
  const sel = p.doc.getElementById("hold-for").querySelectorAll("option").map((o) => o.value);
  assert.ok(sel.includes(docket) && sel.includes(JSON.stringify({ project: COUNSEL_PROJECT })), "docket marks and counsel matters are places too");
});

test("R32: placing the hold sends the place chosen and the reason, any projects it may also reach, and asks no approval; the hold notice is prepared on its own screen", async () => {
  const { world, me, action } = await actionWorld();
  await correspond(me, action, "sent");
  const ord = await correspond(me, action, "received", { pressure: { kind: "legal", note: "a letter from the city's counsel" } });
  const counsel = await counselMatter(world, me);
  const p = await openIn(world, me, ROUTES_AT.hold(action));
  assert.deepEqual(ops(p).filter((o) => o === "actionhold"), ["actionhold"]);
  said(p, "screen.hold.who");
  assert.ok(text(p).includes(W("screen.hold.nohold")), "no hold is placed yet");
  await press(p, "actionhold", { values: { "hold-reason": "a claim is coming" }, reason: "x" });
  const b = last(p, "actionhold").body;
  assert.deepEqual([b.target, b.ord, b.hold, b.reason], [action, ord, "in_place", "a claim is coming"], "the reply the screen was opened on");
  assert.equal(p.doc.querySelectorAll('[data-shell="confirm"]').length, 0, "control: no approval is asked");
  assert.deepEqual((await me.read("holdsdue", { query: { limit: "500" } })).items.filter((m) => m.arrived.action), [], "the store now holds it: nothing on the action still wants a hold");
  assert.ok(!text(p).includes(W("screen.hold.nohold")), "the page re-read what still wants a hold");
  const sel = p.doc.getElementById("hold-for").querySelectorAll("option").map((o) => o.value);
  assert.ok(sel.includes(JSON.stringify({ project: counsel })), "a counsel matter is a place too");
  await press(p, "actionhold", { values: { "hold-for": JSON.stringify({ project: counsel }), "hold-reason": "the owner's lawyer wrote" }, reason: "x" });
  assert.deepEqual([last(p, "actionhold").body.project, last(p, "actionhold").body.reason], [counsel, "the owner's lawyer wrote"]);
  assert.ok(main(p).querySelector('a[href^="/app/holdnotice/"]').textContent.includes(W("screen.hold.notice.link")));
  said(p, "screen.hold.release");
});

test("R32: releasing a hold is drawn on `hold`: the place, the member's reason in `screen.hold.release.reason`, confirmed because it cannot be undone", async () => {
  const { world, me, action } = await actionWorld();
  const counsel = await counselMatter(world, me);
  await me.act("actionhold", { body: { project: counsel, hold: "in_place", reason: "the owner's lawyer wrote" } });
  const p = await openIn(world, me, ROUTES_AT.hold(action));
  said(p, "screen.hold.release.form");
  assert.ok(text(p).includes(W("screen.hold.release.reason")));
  await press(p, "actionholdrelease", { values: { "hold-release-for": JSON.stringify({ project: counsel }), "hold-release-why": "the claim was dropped" }, reason: "x", confirm: true });
  const b = last(p, "actionholdrelease").body;
  assert.equal(b.project, counsel);
  assert.ok(b.reason.includes("the claim was dropped"), "her reason goes with it");
  const after = await me.read("actionholdpreview", { query: { project: counsel } });
  assert.equal(after.hold, "released", "the store holds the matter's hold as released");
});

test("R32 (A1): a reply's hold, placed by the real `actionhold`, is no longer a place to place one (`holdsdue` drops it) and is a place to release, with what the release restarts read first; releasing sends the place and the reason and the store holds it released", async () => {
  const { world, me, action, project } = await actionWorld();
  await correspond(me, action, "sent");
  const ord = await correspond(me, action, "received", { pressure: { kind: "legal", note: "a letter from the city's counsel" } });
  const placed = await me.act("actionhold", { body: { target: action, ord, hold: "in_place", reason: "a claim is coming" } });
  assert.equal(placed.hold, "in_place");
  const place = JSON.stringify({ target: action, ord });
  const p = await openIn(world, me, ROUTES_AT.hold(action));
  const placing = p.doc.getElementById("hold-for") ? p.doc.getElementById("hold-for").querySelectorAll("option").map((o) => o.value) : [];
  assert.ok(!placing.includes(place), "control: the place that holds a hold is not offered to place one");
  const releasing = p.doc.getElementById("hold-release-for").querySelectorAll("option").map((o) => o.value);
  assert.ok(releasing.includes(place), "the reply's hold is offered to release");
  assert.equal(p.byOp("actionholdpreview").length, 0, "nothing is previewed until a place is chosen");
  await choose(p, "hold-release-for", place);
  const preview = p.byOp("actionholdpreview");
  assert.equal(preview.length, 1, "what the release restarts is read first");
  assert.deepEqual([preview[0].query.target, String(preview[0].query.ord)], [action, String(ord)]);
  said(p, "consequence.actionholdrelease");
  const title = ((await me.read("list", { query: { type: "project", limit: "500" } })).bundles.find((b) => b.bundle_id === project) || {}).title;
  assert.ok(title && main(p).querySelector("ul.mk-list").textContent.includes(title), "the project whose deletion restarts is named: " + title);
  await press(p, "actionholdrelease", { values: { "hold-release-why": "the claim was dropped" }, reason: "x", confirm: true });
  const b = last(p, "actionholdrelease").body;
  assert.deepEqual([b.target, b.ord, b.reason], [action, ord, "the claim was dropped"]);
  const after = (await me.read("pressurefor", { query: { action } })).items.find((m) => m.arrived.ord === ord);
  assert.equal(after.hold, "released", "the store holds it released");
  const again = await openIn(world, me, ROUTES_AT.hold(action));
  const left = again.doc.getElementById("hold-release-for");
  assert.ok(!left || !left.querySelectorAll("option").some((o) => o.value === place), "a hold that was released is no longer offered to release");
});

test("R32 (B46, action-holds R22): a hold placed from a docket mark is listed in place from `holdsplaced`, previewed and released with the body that placed it (`from` included), and then listed released", async () => {
  const f = holdPlacedReleasedAnswers();
  let released = false;
  const p = await open(ROUTES.hold, { ...DATA_PLANE, holdsplaced: () => ok(released ? f.after : f.placed), actionholdpreview: ok(f.preview), actionholdrelease: () => { released = true; return ok(f.released); } });
  const place = JSON.stringify({ project: f.body.project, from: f.body.from });
  const choice = () => p.doc.getElementById("hold-release-for");
  assert.ok(choice().querySelectorAll("option").some((o) => o.value === place), "the docket mark's hold is offered to release, as it was placed");
  assert.equal(p.byOp("actionholdpreview").length, 0);
  await choose(p, "hold-release-for", place);
  const q = p.byOp("actionholdpreview")[0].query;
  assert.deepEqual([q.project, JSON.parse(q.from)], [f.body.project, f.body.from], "the preview is asked with the placing body");
  said(p, "consequence.actionholdrelease");
  assert.ok(main(p).querySelector("ul.mk-list"), "what it restarts is named");
  await press(p, "actionholdrelease", { values: { "hold-release-why": "no longer needed" }, reason: "x", confirm: true });
  const b = last(p, "actionholdrelease").body;
  assert.deepEqual([b.project, b.from, b.reason], [f.body.project, f.body.from, "no longer needed"]);
  assert.equal(f.after.items[0].hold, "released", "the owner then lists the place released");
  assert.equal(p.byOp("holdsplaced").length, 2, "the page re-read the places held");
  assert.ok(!(choice() && choice().querySelectorAll("option").some((o) => o.value === place)), "a released place is no longer offered to release");
});

test("R32: pressure that arrived outside any action is recorded in a project, creating no action; `actionhold` is no longer drawn on `action`", async () => {
  const { world, me, project, action } = await actionWorld();
  const p = await openIn(world, me, ROUTES_AT.hold(action));
  await press(p, "pressurerecord", { values: { "hold-press": "A letter from the owner's lawyer, received October 3" }, reason: "x" });
  const b = last(p, "pressurerecord").body;
  assert.equal(b.project, project);
  assert.equal(b.pressure.kind, "legal");
  assert.equal(b.account, "A letter from the owner's lawyer, received October 3");
  const made = (await me.read("pressurefor", { query: { project } })).items;
  assert.deepEqual(made.map((m) => [m.kind, m.note]), [["legal", "A letter from the owner's lawyer, received October 3"]], "the store holds the record");
  assert.equal((await me.read("actions", { query: {} })).items.length, 1, "control: it created no action");
  const q = await openIn(world, me, ROUTES_AT.action(action));
  assert.ok(!ops(q).includes("actionhold"));
  const r = await open(ROUTES.hold, { ...DATA_PLANE, whoami: ok(READER) });
  assert.deepEqual(ops(r).filter((o) => ["actionhold", "pressurerecord"].includes(o)), [], "a member who may not act is offered neither");
});

/** The notice screen at a place: a reply of a real action holding a legal-pressure mark, the hold placed on it unless `held` is false. */
async function noticeAt({ held = true } = {}) {
  const { world, me, action } = await actionWorld();
  await correspond(me, action, "sent");
  const ord = await correspond(me, action, "received", { pressure: { kind: "legal", note: "a letter from the city's counsel" } });
  const place = { target: action, ord };
  if (held) await me.act("actionhold", { body: { ...place, hold: "in_place", reason: "a claim is coming" } });
  return { world, me, place, path: `/app/holdnotice/${encodeURIComponent(JSON.stringify(place))}` };
}

test("R33: 'Prepare the notice' fills the field with the notice as prepared, editable, and sends no other act; a released hold prepares none", async () => {
  const { world, me, place, path } = await noticeAt();
  const p = await openIn(world, me, path);
  await press(p, "holdnoticeprepare", { reason: "x" });
  assert.deepEqual({ ...last(p, "holdnoticeprepare").body, reason: undefined }, { place, reason: undefined });
  const prepared = await me.act("holdnoticeprepare", { body: { place, reason: "x" } });
  assert.ok(prepared.text.length > 0);
  assert.equal(p.doc.getElementById("hold-notice").value, prepared.text);
  assert.deepEqual(p.requests.filter((r) => ["holdnoticesent", "actionhold", "filingsent"].includes(r.op)), [], "no other act");
  said(p, "screen.holdnotice.released");
  const open2 = await noticeAt({ held: false });
  const r = await openIn(open2.world, open2.me, open2.path);
  const b = await press(r, "holdnoticeprepare", { reason: "x" });
  assert.ok(slot(r, b).includes(W("screen.holdnotice.needhold")), "a place with no hold prepares none: a hold is needed first (R70)");
  assert.equal(r.doc.getElementById("hold-notice").value, "");
});

test("R33: 'Record that I sent it' sends the day, how it was sent and the copy or account inside the outward dialog, and no recipient, read or compliance; the screen says so", async () => {
  const { world, me, place, path } = await noticeAt();
  const p = await openIn(world, me, path);
  assert.ok(main(p).querySelector(".cs-dialog button[data-act='holdnoticesent']"), "inside the outward dialog");
  for (const k of ["screen.holdnotice.outward.1", "screen.holdnotice.outward.2", "screen.holdnotice.not.records", "screen.holdnotice.not.nomember", "screen.holdnotice.sent.none"]) said(p, k);
  const none = await press(p, "holdnoticesent", { reason: "x" });
  assert.equal(p.byOp("holdnoticesent").length, 0, "the day and the account are needed");
  await press(p, "holdnoticesent", { values: { "hold-sent-at": "2026-10-10", "hold-sent-how": "message", "hold-account": "I emailed the notice to the team's members." }, reason: "x" });
  assert.deepEqual({ ...last(p, "holdnoticesent").body, reason: undefined }, { place, at: "2026-10-10", medium: "message", account: "I emailed the notice to the team's members.", reason: undefined });
  assert.deepEqual(Object.keys(last(p, "holdnoticesent").body).filter((k) => /recipient|to|read|comply|member/.test(k)), [], "control: neither a recipient nor a read is sent");
  const again = await me.act("holdnoticesent", { body: { place, at: "2026-10-11", medium: "message", account: "and again" } });
  assert.equal(again.seq, 2, "the store took the page's record as the first");
  assert.ok(none);
});

test("R34: the counsel packet: its two names, the purpose, the reason; counsel required at tier 3 or undetermined, optional at 1 or 2; the packet is never offered for publication", async () => {
  const p = await open(ROUTES.counsel, { ...DATA_PLANE, counselpacket: ok(PACKET) });
  for (const k of ["screen.counsel.sub", "screen.counsel.who.optional", "screen.counsel.purpose.help1", "screen.counsel.purpose.help2", "screen.counsel.reason.help2"]) said(p, k);
  unsaid(p, "screen.counsel.who.required");
  const hi = await open(ROUTES.counsel, { ...DATA_PLANE, action: ok({ ...ACTION, risk_tier: "undetermined" }) });
  said(hi, "screen.counsel.who.required");
  const opts = p.doc.getElementById("cp-purpose").querySelectorAll("option");
  assert.deepEqual(opts.map((o) => o.value), ["claim", "defence"]);
  assert.equal(p.doc.getElementById("cp-reason").getAttribute("maxlength"), "2000");
  await press(p, "counselpacket", { values: { "cp-name": "Priya Shah", "cp-org": "Tenant Law Center", "cp-reason": "The owner's lawyer has written to us." }, reason: "x" });
  assert.deepEqual(last(p, "counselpacket").body, { action: ACTION_ID, reason: "The owner's lawyer has written to us.", purpose: "claim", counsel: { name: "Priya Shah", organisation: "Tenant Law Center" } });
  assert.ok(!["publish", "publishat", "release"].some((o) => ops(p).includes(o)), "control: never offered for publication");
});

test("R34: each matter as the packet states it, 'not determined' never stopping the packet; a claim draws no defense sections, a defense adds the challenged statements, pressure and deadlines; every section is marked", async () => {
  const p = await open(ROUTES.counsel, { ...DATA_PLANE, counselpacket: ok(PACKET) });
  await press(p, "counselpacket", { values: { "cp-reason": "A claim the team may bring" }, reason: "x" });
  const t = text(p);
  assert.ok(t.includes(W("screen.counsel.matters.heading")) && t.includes("Closed means repaired"), "a matter with a determination");
  assert.ok(t.includes(W("screen.counsel.matters.undetermined")), "a matter without one is stated as undetermined");
  assert.ok(t.includes(PACKET.marking) && t.includes(W("screen.counsel.marked.every")), "marked");
  unsaid(p, "screen.counsel.defense.heading");
  const d = await open(ROUTES.counsel, { ...DATA_PLANE, counselpacket: ok({ ...PACKET, purpose: "defence", sections: { ...PACKET.sections,
    challenged: { items: [{ statement: "Closed means repaired.", findings: ["FND-1", "FND-2"], sources: [{}] }] }, pressure: { items: [{ at: "2026-10-09T09:00:00Z" }] },
    defence_deadlines: { items: [{ rule: "A special motion to strike", date: null }] } } }) });
  await choose(d, "cp-purpose", "defence");
  await press(d, "counselpacket", { values: { "cp-reason": "pressure came", "cp-chal-1": "Closed means repaired." }, reason: "x" });
  assert.deepEqual([last(d, "counselpacket").body.purpose, last(d, "counselpacket").body.challenged], ["defence", [{ statement: "Closed means repaired." }]]);
  for (const k of ["screen.counsel.defense.heading", "screen.counsel.defense.undetermined"]) said(d, k);
  said(d, "screen.counsel.defense.restson", { findings: "2", sources: "1" });
});

test("R32 (diagnosis 11 §16): each place in 'The hold is for' is named by its mark's note and day, so two marks of one day read apart", async () => {
  const day = "2026-10-25T09:00:00Z";
  const due = { ...HOLDS_DUE, items: [
    { arrived: { action: ACTION_ID, ord: 1 }, project: PROJECT, note: "the city's counsel wrote", marked_by: "member:mai", marked_at: day },
    { arrived: { action: ACTION_ID, ord: 2 }, project: PROJECT, note: "the landlord's lawyer called", marked_by: "member:dev", marked_at: day }] };
  const p = await open(ROUTES.hold, { ...DATA_PLANE, holdsdue: ok(due) });
  const texts = p.doc.getElementById("hold-for").querySelectorAll("option").map((o) => o.textContent.trim()).slice(0, 2);
  assert.equal(new Set(texts).size, 2, JSON.stringify(texts));
  assert.ok(texts[0].includes("the city's counsel wrote") && texts[0].includes(D(day)) && texts[1].includes("the landlord's lawyer called"), JSON.stringify(texts));
  // control: a mark with no note is named by its day alone
  const q = await open(ROUTES.hold, { ...DATA_PLANE, holdsdue: ok({ ...due, items: [{ ...due.items[0], note: "" }] }) });
  assert.deepEqual(q.doc.getElementById("hold-for").querySelectorAll("option").map((o) => o.textContent.trim()).slice(0, 1), [D(day)]);
});
