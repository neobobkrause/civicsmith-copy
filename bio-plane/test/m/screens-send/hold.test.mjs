/* screens-send R32, R33: `hold`, the litigation hold (where the pressure arrived, the hold placed with a reason, pressure recorded
 * outside any action, the hold released after what it restarts is read), and `holdnotice`, the notice a member prepares and sends by
 * her own hand. Every sentence is asserted by its key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, ops, drew, last, press, button, beside, main, text, ok, refused, refusedIn, PROJECT, READER, word, norm } from "./kit.mjs";

/** An action id in the product's form (`ACTN-`), the screen's subject. */
const A = "ACTN-2026-aaaaaaaaaaaaaaaa";
const COUNSEL = "PROJ-2026-cccccccccccccccc";
const OTHER = "PROJ-2026-dddddddddddddddd";
const HOLD = "/app/hold/" + A;
const REPLY = { target: A, ord: 2 };
const DOCKET = { project: PROJECT, from: { docket_entry: "DKT-2026-1" } };
const OUTSIDE = { project: PROJECT, from: { pressure: PROJECT + "#pressure/1" } };

/** `holdsdue`'s rows: a reply marked as a legal threat, a docket mark, and pressure recorded outside any action, none held. */
const DUE_REPLY = { action: A, ord: 2, note: "a letter from the city's counsel", marked_by: "member:mai", marked_at: "2026-10-09T09:00:00Z", project: PROJECT, arrived: { action: A, ord: 2 } };
const DUE_DOCKET = { arrived: { docket_entry: "DKT-2026-1", case: "CASE-2026-1" }, note: "a notice of claim", marked_by: "member:mai", marked_at: "2026-10-01T09:00:00Z", project: PROJECT };
const DUE_OUTSIDE = { arrived: { pressure: PROJECT + "#pressure/1" }, note: "a call from the owner's lawyer", marked_by: "member:mai", marked_at: "2026-10-03T09:00:00Z", project: PROJECT };
const DUE = (items) => ok({ ok: true, items, limit: 500, truncated: false, cursor: null });
const PLACED = (items) => ok({ ok: true, items, limit: 500, truncated: false, cursor: null });
/** A `holdsplaced` row (action-holds R22). */
const HELD = (place, o = {}) => ({ place, hold: "in_place", by: "member:mai", at: "2026-10-10T09:00:00Z", reason: "a claim is coming", from: [], projects: [PROJECT], ...o });
const ROSTER = ok({ ok: true, projects: [{ id: PROJECT, name: "The Coliseum lease", scope: "none", participation: "joined" },
  { id: COUNSEL, name: "The rent dispute", scope: "counsel_matter", participation: "joined" }] });
const LIST = ok({ bundles: [{ bundle_id: PROJECT, title: "The Coliseum lease" }, { bundle_id: OTHER, title: "Pothole repairs" }] });
const PREVIEW = (o = {}) => ok({ ok: true, hold: "in_place", restarts: [PROJECT], unseen: false, ...o });

/** The hold screen's plane: the action of `PROJECT`, the three rows due, a counsel matter, nothing held; `o` over it. */
const holdPlane = (o = {}) => ({ action: ok({ id: A, project: PROJECT, kind: "request_for_comment", title: "Why the lease was renewed", current_state: "planned" }),
  holdsdue: DUE([DUE_REPLY, DUE_DOCKET, DUE_OUTSIDE]), holdsplaced: PLACED([]), projectlist: ROSTER, list: LIST, ...o });
const optionsOf = (p, id) => { const el = p.doc.getElementById(id); return el ? el.querySelectorAll("option").map((o) => o.value) : []; };
const section = (p, key) => main(p).querySelectorAll("section.cs-section").find((s) => norm((s.querySelector("h2") || { textContent: "" }).textContent) === norm(word(key)));
const choose = async (p, id, value) => { const el = p.doc.getElementById(id); el.value = value; p.fire(el, "change"); await p.settle(); };
const WRITES = ["actionhold", "actionholdrelease", "pressurerecord", "holdnoticesent", "holdnoticeprepare", "actioncreate", "filingrecordsent"];
const writes = (p) => p.requests.filter((r) => WRITES.includes(r.op)).map((r) => r.op);

test("R32: `hold` reads `holdsdue` and lists where the pressure arrived (a reply, a docket entry, pressure outside any action), each with no hold, and the counsel matters from `projectlist`", async () => {
  const p = await open(HOLD, { plane: holdPlane() });
  assert.deepEqual(p.byOp("holdsdue").map((r) => r.query.limit), ["500"]);
  assert.equal(p.byOp("projectlist").length, 1);
  const where = section(p, "screen.hold.where.heading");
  assert.ok(where, "the section where the pressure arrived is drawn");
  assert.ok(drew(p, "screen.hold.reply", {}, where) && drew(p, "screen.hold.outside", {}, where) && drew(p, "screen.hold.marked", { member: "mai" }, where));
  assert.equal(text(p, where).split(norm(word("screen.hold.nohold"))).length - 1, 3, "each of the three says no hold is placed");
  assert.ok(text(p, where).includes("a letter from the city's counsel") && text(p, where).includes("a notice of claim"));
  assert.ok(text(p, where).includes("The rent dispute") && drew(p, "screen.hold.counsel.row", {}, where), "a counsel matter is listed");
  assert.ok(!text(p, where).includes("The Coliseum lease"), "control: a project that is no counsel matter is not listed");
  assert.ok(drew(p, "screen.hold.release"), "the release note is drawn");
  assert.deepEqual(writes(p), [], "reading writes nothing");
});

test("R32: placing the hold sends the place chosen (the reply the screen is opened on), `in_place` and the member's reason; control: no approval is asked", async () => {
  const p = await open(HOLD, { plane: holdPlane({ actionhold: ok({ ok: true, hold: "in_place" }) }) });
  assert.equal(p.doc.getElementById("hold-for").value, JSON.stringify(REPLY), "the reply the screen was opened on is chosen");
  assert.ok(drew(p, "screen.hold.who") && drew(p, "screen.hold.who.own"));
  const before = p.byOp("holdsdue").length;
  await press(p, "actionhold", { "hold-reason": "  a claim is coming  " });
  assert.deepEqual(last(p, "actionhold").body, { ...REPLY, hold: "in_place", reason: "a claim is coming" }, "no other project ticked, none sent");
  assert.equal(p.root().querySelectorAll('[data-shell="confirm"]').length, 0, "control: no approval or confirmation is asked");
  assert.deepEqual(writes(p), ["actionhold"], "nothing else is sent");
  assert.ok(p.byOp("holdsdue").length > before, "what still wants a hold is read again");
});

test("R32: a docket mark and a counsel matter are places too, each sent as it is placed, with the other projects ticked", async () => {
  const p = await open(HOLD, { plane: holdPlane({ actionhold: ok({ ok: true, hold: "in_place" }) }) });
  const places = optionsOf(p, "hold-for");
  for (const at of [REPLY, DOCKET, OUTSIDE, { project: COUNSEL }]) assert.ok(places.includes(JSON.stringify(at)), JSON.stringify(at));
  assert.equal(places.length, 4, "each place once");
  fillCheck(p, "hold-projects", [OTHER]);
  await press(p, "actionhold", { "hold-for": JSON.stringify(DOCKET), "hold-reason": "a claim was filed" });
  assert.deepEqual(last(p, "actionhold").body, { ...DOCKET, hold: "in_place", reason: "a claim was filed", projects: [OTHER] });
  fillCheck(p, "hold-projects", []);
  await press(p, "actionhold", { "hold-for": JSON.stringify({ project: COUNSEL }), "hold-reason": "the owner's lawyer wrote" });
  assert.deepEqual(last(p, "actionhold").body, { project: COUNSEL, hold: "in_place", reason: "the owner's lawyer wrote" });
});

/** Ticks exactly the boxes of the checks `name` whose values are `values`. */
function fillCheck(p, name, values) {
  for (const b of p.doc.getElementById(name).querySelectorAll("input[type=checkbox]")) b.checked = values.includes(b.value);
}

test("R32: a hold with no reason is refused in place by the shell's words and sends nothing; each own-words field is bounded at 500", async () => {
  const p = await open(HOLD, { plane: holdPlane({ holdsplaced: PLACED([HELD({ project: COUNSEL })]) }) });
  const b = await press(p, "actionhold", { "hold-reason": "   " });
  assert.ok(drew(p, "shell.reason.needed", {}, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)), "the refusal is drawn beside the act");
  assert.deepEqual(writes(p), []);
  for (const id of ["hold-reason", "hold-press", "hold-release-why"]) assert.equal(p.doc.getElementById(id).getAttribute("maxlength"), "500", id);
});

test("R32: a hold or a release the plane refuses is drawn beside its act by the refusal's words, and nothing is taken as done", async () => {
  const p = await open(HOLD, { plane: holdPlane({ actionhold: refused("HOLD_PROJECTS_REFUSED", "x"), holdsplaced: PLACED([HELD({ project: COUNSEL })]),
    actionholdpreview: PREVIEW({ restarts: [] }), actionholdrelease: refusedIn("HOLD_ALREADY_RELEASED", "x") }) });
  const b = await press(p, "actionhold", { "hold-reason": "a claim is coming" });
  assert.equal(p.byOp("actionhold").length, 1);
  assert.ok(drew(p, "refusal.HOLD_PROJECTS_REFUSED", {}, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)));
  assert.ok(optionsOf(p, "hold-for").includes(JSON.stringify(REPLY)), "the place stays to place");
  await choose(p, "hold-release-for", JSON.stringify({ project: COUNSEL }));
  const r = await press(p, "actionholdrelease", { "hold-release-why": "the claim was dropped" });
  assert.equal(p.byOp("actionholdrelease").length, 1);
  assert.ok(drew(p, "refusal.HOLD_ALREADY_RELEASED", {}, p.root().querySelector(`[data-slot="${r.getAttribute("data-ai")}"]`)), "a refusal inside a 200 answer is drawn the same way");
});

test("R32 (K5229): after `actionhold` on a reply, its place is in the release choice and not the placing choice; releasing reads `actionholdpreview` first, then sends the place and the reason, and the released place is offered no more", async () => {
  let state = "due";
  const p = await open(HOLD, { plane: holdPlane({
    holdsdue: () => DUE(state === "due" ? [DUE_REPLY] : []),
    holdsplaced: () => PLACED(state === "due" ? [] : [HELD({ target: A, ord: 2 }, { hold: state === "held" ? "in_place" : "released" })]),
    actionhold: () => { state = "held"; return ok({ ok: true, hold: "in_place" }); },
    actionholdpreview: PREVIEW(),
    actionholdrelease: () => { state = "released"; return ok({ ok: true, hold: "released" }); },
  }) });
  const place = JSON.stringify(REPLY);
  assert.ok(optionsOf(p, "hold-for").includes(place));
  await press(p, "actionhold", { "hold-reason": "a claim is coming" });
  assert.ok(!optionsOf(p, "hold-for").includes(place), "the place that holds a hold is not offered to place one");
  assert.ok(optionsOf(p, "hold-release-for").includes(place), "it is offered to release");
  assert.equal(p.byOp("actionholdpreview").length, 0, "nothing is previewed until a place is chosen");
  await choose(p, "hold-release-for", place);
  assert.deepEqual(p.byOp("actionholdpreview").map((r) => [r.query.target, r.query.ord, r.query.from]), [[A, "2", undefined]], "what the release restarts is read first");
  assert.ok(drew(p, "consequence.actionholdrelease"));
  assert.ok(text(p, main(p).querySelector("ul.mk-list")).includes("The Coliseum lease"), "the project it restarts is named by its title");
  assert.equal(p.byOp("actionholdrelease").length, 0, "choosing releases nothing");
  await press(p, "actionholdrelease", { "hold-release-why": "the claim was dropped" });
  assert.deepEqual(last(p, "actionholdrelease").body, { ...REPLY, reason: "the claim was dropped" });
  const ids = p.requests.map((r) => r.op);
  assert.ok(ids.indexOf("actionholdpreview") < ids.indexOf("actionholdrelease"), "the preview is read before the release is sent");
  assert.ok(!optionsOf(p, "hold-release-for").includes(place), "a released place is no longer offered to release");
});

test("R32: a hold placed from a docket mark is released as it was placed: one choice for each distinct `from`, previewed and released with it", async () => {
  const held = HELD({ project: PROJECT }, { from: [{ docket_entry: "DKT-2026-1" }, { docket_entry: "DKT-2026-1" }, { pressure: PROJECT + "#pressure/1" }] });
  const p = await open(HOLD, { plane: holdPlane({ holdsdue: DUE([]), projectlist: ok({ ok: true, projects: [] }), holdsplaced: PLACED([held, HELD({ project: OTHER }, { hold: "released" })]),
    actionholdpreview: PREVIEW({ restarts: [] }), actionholdrelease: ok({ ok: true, hold: "released" }) }) });
  assert.deepEqual(optionsOf(p, "hold-release-for"), ["", JSON.stringify(DOCKET), JSON.stringify(OUTSIDE)], "each distinct `from` once; a released place is not offered");
  assert.equal(p.doc.getElementById("hold-for"), null, "with nothing due, nothing is offered to place");
  await choose(p, "hold-release-for", JSON.stringify(DOCKET));
  const q = last(p, "actionholdpreview").query;
  assert.deepEqual([q.project, JSON.parse(q.from)], [PROJECT, DOCKET.from], "the preview is asked with the placing body");
  assert.ok(drew(p, "consequence.actionholdrelease"));
  assert.equal(main(p).querySelector("ul.mk-list"), null, "nothing restarts, none listed");
  await press(p, "actionholdrelease", { "hold-release-why": "no longer needed" });
  assert.deepEqual(last(p, "actionholdrelease").body, { ...DOCKET, reason: "no longer needed" });
});

test("R32: with no place chosen the release sends nothing; a preview that fails draws no consequence", async () => {
  const p = await open(HOLD, { plane: holdPlane({ holdsplaced: PLACED([HELD(REPLY)]), actionholdpreview: refused("HOLDS_UNREADABLE", "The holds could not be read.") }) });
  await press(p, "actionholdrelease", { "hold-release-why": "the claim was dropped" });
  assert.deepEqual(writes(p), [], "nothing chosen, nothing released");
  await choose(p, "hold-release-for", JSON.stringify(REPLY));
  assert.equal(p.byOp("actionholdpreview").length, 1);
  assert.ok(!drew(p, "consequence.actionholdrelease"), "what it restarts is not claimed when it could not be read");
});

test("R32: pressure that arrived outside any action is recorded in the project chosen, as the member's account, creating no action", async () => {
  const p = await open(HOLD, { plane: holdPlane({ pressurerecord: ok({ ok: true }) }) });
  await press(p, "pressurerecord", { "hold-press": "  A letter from the owner's lawyer  ", "hold-press-kind": "legal", "hold-press-project": OTHER });
  const b = last(p, "pressurerecord").body;
  assert.deepEqual({ ...b, at: undefined, reason: undefined }, { project: OTHER, pressure: { kind: "legal", note: "A letter from the owner's lawyer" }, account: "A letter from the owner's lawyer", at: undefined, reason: undefined }, "the shell's reason aside");
  assert.match(b.at, /^\d{4}-\d{2}-\d{2}$/, "the day it is recorded");
  assert.deepEqual(writes(p), ["pressurerecord"], "control: no action is created");
  assert.ok(drew(p, "screen.hold.press.heading"));
});

test("R32: a pressure record with no account sends nothing; its note is cut at 500 characters", async () => {
  const p = await open(HOLD, { plane: holdPlane({ pressurerecord: ok({ ok: true }) }) });
  await press(p, "pressurerecord", { "hold-press": "   " });
  assert.deepEqual(writes(p), []);
  const long = "x".repeat(600);
  await press(p, "pressurerecord", { "hold-press": long });
  const b = last(p, "pressurerecord").body;
  assert.equal(b.pressure.note.length, 500);
  assert.equal(b.pressure.kind, "legal", "the first kind is the choice's own");
  assert.equal(b.account, long, "the account is kept whole");
});

test("R32: \"Prepare the hold notice\" opens `holdnotice` at the place chosen", async () => {
  const p = await open(HOLD, { plane: holdPlane() });
  const a = main(p).querySelector('a[href^="/app/holdnotice/"]');
  assert.ok(a && drew(p, "screen.hold.notice.link", {}, a));
  assert.equal(JSON.parse(decodeURIComponent(a.getAttribute("href").slice("/app/holdnotice/".length))).target, A);
});

test("R32: a member who may read and not act is offered no placing, recording or releasing", async () => {
  const p = await open(HOLD, { plane: { ...holdPlane({ holdsplaced: PLACED([HELD({ project: COUNSEL })]) }), whoami: ok(READER) } });
  assert.deepEqual(ops(p).filter((o) => ["actionhold", "pressurerecord", "actionholdrelease"].includes(o)), []);
});

/* holdnotice (R33) */
const NOTICE = "/app/holdnotice/" + encodeURIComponent(JSON.stringify(REPLY));
const TEXT = "Litigation hold notice\nKeep every letter, email and note about the lease.";

test("R33: \"Prepare the notice\" sends the place and fills the field with the notice as prepared, editable; it sends no other act", async () => {
  const p = await open(NOTICE, { plane: { holdnoticeprepare: ok({ ok: true, id: "HLN-2026-0001", place: REPLY, text: TEXT, sources: [] }) } });
  assert.equal(p.doc.getElementById("hold-notice").value, "", "nothing is prepared on load");
  await press(p, "holdnoticeprepare");
  assert.deepEqual(last(p, "holdnoticeprepare").body.place, REPLY);
  const field = p.doc.getElementById("hold-notice");
  assert.equal(field.value, TEXT);
  assert.ok(!field.hasAttribute("readonly") && !field.hasAttribute("disabled"), "editable");
  assert.ok(String(field.getAttribute("class")).includes("rec"), "the member's own record field");
  assert.deepEqual(writes(p), ["holdnoticeprepare"], "no other act is sent");
});

test("R33: a released hold prepares none: the refusal is drawn beside the act, the field stays empty, and the screen says so", async () => {
  const p = await open(NOTICE, { plane: { holdnoticeprepare: refusedIn("HOLD_NOT_IN_PLACE", word("refusal.HOLD_NOT_IN_PLACE")) } });
  assert.ok(drew(p, "screen.holdnotice.released"));
  const b = await press(p, "holdnoticeprepare");
  assert.ok(beside(p, b).includes(norm(word("refusal.HOLD_NOT_IN_PLACE"))));
  assert.equal(p.doc.getElementById("hold-notice").value, "");
});

test("R33: \"Record that I sent it\" sits inside the outward dialog and sends the day, how and the account; control: neither a recipient nor a read", async () => {
  const p = await open(NOTICE, { plane: { holdnoticesent: ok({ ok: true, seq: 1 }) } });
  assert.ok(main(p).querySelector(".cs-dialog button[data-act='holdnoticesent']"), "inside the outward dialog");
  for (const k of ["screen.holdnotice.outward.1", "screen.holdnotice.outward.2", "screen.holdnotice.not.records", "screen.holdnotice.not.nomember", "screen.holdnotice.sent.none", "screen.holdnotice.sent.how"]) assert.ok(drew(p, k), k);
  await press(p, "holdnoticesent", { "hold-sent-at": "2026-10-10", "hold-sent-how": "message", "hold-account": " I emailed the notice to the team. " });
  const b = last(p, "holdnoticesent").body;
  assert.deepEqual({ ...b, reason: undefined }, { place: REPLY, at: "2026-10-10", medium: "message", account: "I emailed the notice to the team.", reason: undefined }, "the shell's reason aside");
  assert.deepEqual(Object.keys(b).filter((k) => /recipient|^to$|read|compl|member|^by$/.test(k)), [], "control: no recipient, read or compliance");
  assert.deepEqual(writes(p), ["holdnoticesent"], "the screen sends the notice to nobody");
});

test("R33: the sending is not recorded without its day (a calendar day) and the member's account", async () => {
  const p = await open(NOTICE, { plane: { holdnoticesent: ok({ ok: true, seq: 1 }) } });
  await press(p, "holdnoticesent", { "hold-sent-at": "", "hold-account": "I told them in person." });
  await press(p, "holdnoticesent", { "hold-sent-at": "2026-10-10", "hold-account": "  " });
  await press(p, "holdnoticesent", { "hold-sent-at": "10/10/2026", "hold-account": "I told them in person." });
  assert.deepEqual(writes(p), []);
});

test("R33: a notice screen whose subject is no place says nothing is here and offers no act", async () => {
  const p = await open("/app/holdnotice/not-a-place", {});
  assert.ok(drew(p, "shell.unavailable.nothing"));
  assert.deepEqual(ops(p).filter((o) => o === "holdnoticeprepare" || o === "holdnoticesent"), []);
});

test("R33: a member who may read and not act is offered neither preparing nor recording the notice", async () => {
  const p = await open(NOTICE, { plane: { whoami: ok(READER) } });
  assert.deepEqual(ops(p).filter((o) => o === "holdnoticeprepare" || o === "holdnoticesent"), []);
});

test("R32: the release choice holds only the places that hold a hold; what still wants one, and a counsel matter, stay the placing choice alone", async () => {
  const p = await open(HOLD, { plane: holdPlane({ holdsplaced: PLACED([HELD({ project: COUNSEL })]) }) });
  const release = optionsOf(p, "hold-release-for").filter(Boolean);
  assert.deepEqual(release, [JSON.stringify({ project: COUNSEL })]);
  assert.ok(optionsOf(p, "hold-for").includes(JSON.stringify(REPLY)), "a place due is offered to place a hold");
  const q = await open(HOLD, { plane: holdPlane() });
  assert.equal(q.doc.getElementById("hold-release-for"), null, "with nothing held, nothing is offered to release");
});

test("R32: a release with no reason is refused in place and sends nothing", async () => {
  const p = await open(HOLD, { plane: holdPlane({ holdsplaced: PLACED([HELD({ project: COUNSEL })]), actionholdpreview: PREVIEW() }) });
  await choose(p, "hold-release-for", JSON.stringify({ project: COUNSEL }));
  const b = await press(p, "actionholdrelease", { "hold-release-why": "   " });
  assert.equal(p.byOp("actionholdrelease").length, 0);
  assert.ok(beside(p, b).includes(norm(word("shell.reason.needed"))));
});
