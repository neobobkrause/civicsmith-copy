/* screens-send R24, R28, R35: `actionnew`, "Start an action", the composer for an action of any kind; the kinds offered from the
 * vocabulary, each in its words; no template before an action exists. Every sentence is asserted by its key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, drew, last, press, button, main, beside, ok, refusedIn, READER, PROJECT, word, norm } from "./kit.mjs";

const PATH = "/app/actionnew/" + PROJECT;
const Q1 = "INQ-2026-1111111111111111";
const Q2 = "INQ-2026-2222222222222222";
const NEW = "ACTN-2026-4444444444444444";
/** affordances' vocabularies as the owner publishes them: `risk_tiers` is the tiers' map (action-grammar's RISK_TIERS), `o` over it. */
const VOC = (o = {}) => ({ vocabularies: { action_kind: ["records_request", "request_for_comment", "grand_jury", "media", "other"], action_kind_labels: {},
  action_basis_kinds: ["rests_on", "advances"], risk_tiers: { 1: "file freely", 2: "file with caution", 3: "do not file without counsel", undetermined: "not assessed" }, ...o } });
/** The project's questions as `projectquestions` answers them. */
const QUESTIONS = { ok: true, project: PROJECT, items: [{ inquiry: Q1, title: "Was the lease renewed without a vote?" }, { inquiry: Q2, title: "Who signed the renewal?" }], cursor: null };
/** `addresseesuggest`: the offices the record holds for the subject. */
const OFFICES = { ok: true, subject: Q1, offices: [{ addressee: { state: "named", kind: "office", role: "Town Clerk", body: "Town of Port Ellery", entity_id: "ENT-2026-1111111111111111" } }] };
const PLANE = (o = {}) => ({ affordances: ok(VOC()), projectquestions: ok(QUESTIONS), addresseesuggest: ok(OFFICES), actioncreate: ok({ ok: true, id: NEW }), ...o });

/** Sets a choice and fires its change, as a member choosing does. */
async function choose(p, id, value) {
  const el = p.doc.getElementById(id);
  if (!el) throw new Error(`no choice ${id}`);
  el.value = value; p.fire(el, "change"); await p.settle();
}
const optionsOf = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => [o.getAttribute("value"), norm(o.textContent)]);
/** The action's document `actioncreate` carried, read back: its front matter's scalars, and its lists (`counterparty`, `clock`, `action_basis`). */
function docOf(body) {
  const fm = String(body.document).split("\n---\n")[0].replace(/^---\n/, "").split("\n");
  const out = {}; let key = null, item = null;
  const val = (s) => { s = s.trim(); if (s === "[]") return []; try { return JSON.parse(s); } catch { return s; } };
  for (const l of fm) {
    let m;
    if ((m = /^([a-z_]+):\s*(.*)$/.exec(l))) { key = m[1]; out[key] = m[2] === "" ? undefined : val(m[2]); item = null; }
    else if ((m = /^ {2}- ([a-z_]+):\s*(.*)$/.exec(l))) { item = { [m[1]]: val(m[2]) }; (out[key] = Array.isArray(out[key]) ? out[key] : []).push(item); }
    else if ((m = /^ {4}([a-z_]+):\s*(.*)$/.exec(l)) && item) item[m[1]] = val(m[2]);
    else if ((m = /^ {2}([a-z_]+):\s*(.*)$/.exec(l))) { out[key] = out[key] && !Array.isArray(out[key]) ? out[key] : {}; out[key][m[1]] = val(m[2]); }
  }
  return out;
}
const sent = (p) => p.byOp("actioncreate").length;

test("R24: the screen draws its name and its sections with their keys, reads the vocabulary and the project's questions, and offers its acts", async () => {
  const p = await open(PATH, { plane: PLANE({ assistantstate: ok({ on: true }), groupkeystate: ok({ on: true }) }) });
  assert.equal(p.byOp("affordances").length, 1, "the kinds, legs and tiers are read from the vocabulary");
  assert.equal(last(p, "projectquestions").query.project, PROJECT, "the project's questions are read as record data");
  for (const k of ["screen.actionnew.name", "screen.actionnew.sub", "screen.actionnew.kind", "screen.actionnew.kind.help", "screen.actionnew.records",
    "screen.actionnew.to", "screen.actionnew.to.named", "screen.actionnew.to.undetermined.label", "screen.actionnew.to.who", "screen.actionnew.asks",
    "screen.actionnew.care", "screen.actionnew.care.field", "screen.actionnew.care.help", "screen.actionnew.rests", "screen.actionnew.rests.point",
    "screen.actionnew.rests.does", "screen.actionnew.rests.needed", "screen.actionnew.due", "screen.actionnew.due.what", "screen.actionnew.due.when",
    "screen.actionnew.due.because", "screen.actionnew.due.note"]) assert.ok(drew(p, k), k);
  assert.ok(ops(p).includes("actioncreate") && ops(p).includes("writinghelp"));
  assert.ok(button(p, "actioncreate").outerHTML.includes("primary"), "Start the action is the primary act");
  const door = main(p).querySelector(`a[href="/app/request/${PROJECT}"]`);
  assert.ok(door && text(p, door).includes(norm(word("screen.request.name"))) && drew(p, "screen.request.purpose"), "the door to `request` with the project, its card");
  assert.equal(p.doc.getElementById("an-leg").tagName.toLowerCase(), "select", "what it rests on is chosen, never typed");
  assert.deepEqual(optionsOf(p, "an-leg").map(([v]) => v), ["", Q1, Q2], "the legs' targets are the project's questions");
  assert.deepEqual(optionsOf(p, "an-legk").map(([v]) => v).filter(Boolean), ["rests_on", "advances"], "what the link does, from `action_basis_kinds`");
  assert.ok(optionsOf(p, "an-legk").some(([v, t]) => v === "advances" && t === norm(word("screen.actionnew.rests.advances"))));
  assert.equal(p.doc.getElementById("an-due-date").getAttribute("type"), "date", "When is a calendar day");
});

test("R24: a bare screen, with no project, draws only 'Nothing is here'", async () => {
  const p = await open("/app/actionnew", { plane: PLANE() });
  assert.ok(main(p).querySelector('[data-state="empty"]'));
  assert.equal(p.doc.getElementById("an-ask"), null);
  assert.ok(!ops(p).includes("actioncreate"));
});

test("R24: the tier is 1 to 3 in the words of risk.tier.1 to .3, the member's own judgment: none is preselected and none sent unless she chooses", async () => {
  const p = await open(PATH, { plane: PLANE() });
  const tiers = optionsOf(p, "an-tier");
  for (const t of ["1", "2", "3"]) assert.ok(tiers.some(([v, s]) => v === t && s === norm(word("risk.tier." + t))), "tier " + t);
  assert.ok(!tiers.some(([v]) => v === "undetermined"), "no machine's tier is offered as a choice");
  assert.equal(p.doc.getElementById("an-tier").value, "", "no tier is chosen for her");
  await press(p, "actioncreate", { "an-who": "The Port Ellery Gazette", "an-ask": "Tell the story", "an-kind": "media" });
  assert.equal(docOf(last(p, "actioncreate").body).risk_tier, undefined, "no tier sent unless she sets one");
});

test("R24: a request for comment to a named office with one advances leg and one dated entry with its basis sends one actioncreate carrying exactly those, and the action opens", async () => {
  const p = await open(PATH, { plane: PLANE() });
  assert.equal(p.doc.getElementById("an-kind").value, "request_for_comment");
  assert.ok(!ops(p).includes("addresseesuggest"), "'Choose the office' needs what the action rests on");
  await choose(p, "an-leg", Q1);
  assert.ok(ops(p).includes("addresseesuggest"), "offered once the action rests on a record");
  await press(p, "addresseesuggest");
  assert.equal(last(p, "addresseesuggest").query.subject, Q1, "offices are suggested for what the action rests on");
  assert.equal(sent(p), 0, "a suggestion sets nothing");
  assert.ok(text(p).includes("Town Clerk"), "each office by its role");
  await press(p, "actioncreate", { "an-office": "0", "an-ask": "Why was the lease renewed without a vote?", "an-tier": "2", "an-legk": "advances",
    "an-due-text": "Comment due", "an-due-date": "2026-12-15", "an-due-because": "the council's notice of 1 December" });
  assert.equal(sent(p), 1);
  const d = docOf(last(p, "actioncreate").body);
  assert.equal(d.action_kind, "request_for_comment");
  assert.equal(d.title, "Why was the lease renewed without a vote?");
  assert.equal(d.risk_tier, 2);
  assert.equal(d.project, PROJECT);
  assert.equal(d.current_state, "planned");
  assert.deepEqual(d.counterparty, OFFICES.offices[0].addressee, "the office the member chose");
  assert.deepEqual(d.action_basis, [{ target: Q1, kind: "advances" }]);
  assert.deepEqual(d.clock, [{ text: "Comment due", description: "Comment due", date: "2026-12-15", basis: "the council's notice of 1 December", status: "pending" }]);
  assert.ok(!/^author/m.test(last(p, "actioncreate").body.document), "the author is set by the door, never the body");
  assert.equal(p.location.pathname, "/app/action/" + NEW, "the action opens");
});

test("R24: control: nothing is filled from the project's questions without her choice", async () => {
  const p = await open(PATH, { plane: PLANE() });
  assert.equal(p.doc.getElementById("an-leg").value, "");
  await press(p, "actioncreate", { "an-kind": "grand_jury", "an-who": "The grand jury of Port Ellery county", "an-ask": "Refer the renewal" });
  const d = docOf(last(p, "actioncreate").body);
  assert.deepEqual(d.action_basis, []);
  assert.deepEqual(d.clock, []);
  assert.equal(typeof d.counterparty, "object", "the one Who field is never a bare string");
  assert.equal(d.counterparty.state === undefined, false);
});

test("R24: an undetermined addressee draws its basis field and the unsent note, sends {state: undetermined, basis}; with no basis it is refused in place and sends nothing", async () => {
  const p = await open(PATH, { plane: PLANE() });
  await choose(p, "an-kind", "media");
  await choose(p, "an-to", "undetermined");
  assert.ok(drew(p, "screen.actionnew.to.undetermined") && drew(p, "screen.actionnew.to.basis") && drew(p, "screen.actionnew.to.unsent"));
  const b = await press(p, "actioncreate", { "an-ask": "Tell the story" });
  assert.equal(sent(p), 0, "sends nothing");
  assert.ok(beside(p, b).includes(norm(word("refusal.COUNTERPARTY_REFUSED"))), "COUNTERPARTY_REFUSED by its words");
  assert.equal(p.doc.getElementById("an-ask").value, "Tell the story", "her fields are kept");
  await press(p, "actioncreate", { "an-basis": "A reporter, not yet chosen" });
  assert.deepEqual(docOf(last(p, "actioncreate").body).counterparty, { state: "undetermined", basis: "A reporter, not yet chosen" });
});

test("R24: a named addressee with no office chosen and nothing written is refused in place by COUNTERPARTY_REFUSED's words and sends nothing", async () => {
  const p = await open(PATH, { plane: PLANE() });
  const b = await press(p, "actioncreate", { "an-kind": "media", "an-ask": "Tell the story" });
  assert.equal(sent(p), 0);
  assert.ok(beside(p, b).includes(norm(word("refusal.COUNTERPARTY_REFUSED"))));
});

test("R24: a date with no basis is refused in place by CLOCK_REFUSED's words and sends nothing; given its basis it is sent", async () => {
  const p = await open(PATH, { plane: PLANE() });
  const b = await press(p, "actioncreate", { "an-kind": "media", "an-who": "The Port Ellery Gazette", "an-ask": "Tell the story", "an-due-text": "Story runs", "an-due-date": "2026-12-01" });
  assert.equal(sent(p), 0, "a deadline the record invented is not sent");
  assert.ok(beside(p, b).includes(norm(word("refusal.CLOCK_REFUSED"))));
  assert.equal(p.doc.getElementById("an-due-date").value, "2026-12-01", "her fields are kept");
  await press(p, "actioncreate", { "an-due-because": "the editor's schedule" });
  assert.deepEqual(docOf(last(p, "actioncreate").body).clock, [{ text: "Story runs", description: "Story runs", date: "2026-12-01", basis: "the editor's schedule", status: "pending" }]);
});

test("R24: a request for comment with no advances leg, or with no clock entry, is refused by ACTION_BASIS_REFUSED's words in place; the action does not open", async () => {
  for (const values of [{ "an-legk": "rests_on", "an-due-text": "Comment due", "an-due-date": "2026-12-15", "an-due-because": "the notice" }, { "an-legk": "advances" }]) {
    const p = await open(PATH, { plane: PLANE({ actioncreate: refusedIn("ACTION_BASIS_REFUSED") }) });
    await choose(p, "an-leg", Q1);
    const b = await press(p, "actioncreate", { "an-who": "The auditor", "an-ask": "Comment on the renewal", ...values });
    assert.ok(beside(p, b).includes(norm(word("refusal.ACTION_BASIS_REFUSED"))), "drawn by its words");
    assert.equal(p.location.pathname, PATH, "refused in place");
    assert.equal(p.doc.getElementById("an-ask").value, "Comment on the renewal", "her fields are kept");
  }
});

test("R24: ACTION_KIND_UNKNOWN, COUNTERPARTY_REFUSED and CLOCK_REFUSED from the owner are drawn by their words, in place", async () => {
  for (const code of ["ACTION_KIND_UNKNOWN", "COUNTERPARTY_REFUSED", "CLOCK_REFUSED"]) {
    const p = await open(PATH, { plane: PLANE({ actioncreate: refusedIn(code) }) });
    const b = await press(p, "actioncreate", { "an-kind": "grand_jury", "an-who": "The grand jury", "an-ask": "Refer the renewal" });
    assert.equal(sent(p), 1);
    assert.ok(beside(p, b).includes(norm(word("refusal." + code))), code);
    assert.equal(p.location.pathname, PATH, code + " in place");
  }
});

test("R24: control: choosing 'Records request' draws the door to `request` and no composer", async () => {
  const p = await open(PATH, { plane: PLANE() });
  await choose(p, "an-kind", "records_request");
  assert.ok(drew(p, "screen.actionnew.records"));
  assert.ok(main(p).querySelector(`a[href="/app/request/${PROJECT}"]`));
  for (const id of ["an-ask", "an-who", "an-tier", "an-leg", "an-due-date"]) assert.equal(p.doc.getElementById(id), null, id);
  assert.ok(!ops(p).includes("actioncreate"));
  const q = await open(PATH, { plane: PLANE({ affordances: ok(VOC({ action_kind: ["records_request", "cpra_request"] })) }) });
  await choose(q, "an-kind", "cpra_request");
  assert.ok(q.doc.getElementById("an-ask") && ops(q).includes("actioncreate"), "the profile kind cpra_request is composed here");
});

test("R24: a member who may read and not act sees the read-only sentence, no act and no field", async () => {
  const p = await open(PATH, { plane: PLANE({ whoami: ok(READER) }) });
  assert.ok(drew(p, "shell.readonly", { noun: word("shell.readonly.noun.actionnew"), members: word("shell.readonly.members") }));
  assert.deepEqual(ops(p), []);
  assert.equal(main(p).querySelectorAll("input, select, textarea").length, 0);
});

test("R28: the kinds offered are the vocabulary's in its order, each by screen.action.kind.<kind>; other as screen.actionnew.kind.other", async () => {
  const p = await open(PATH, { plane: PLANE() });
  const kinds = optionsOf(p, "an-kind");
  assert.deepEqual(kinds.map(([v]) => v), VOC().vocabularies.action_kind);
  for (const [v, t] of kinds) assert.equal(t, norm(word(v === "other" ? "screen.actionnew.kind.other" : "screen.action.kind." + v)), v);
  const q = await open(PATH, { plane: PLANE({ affordances: ok(VOC({ action_kind: ["request_for_comment", "grand_jury"] })) }) });
  assert.deepEqual(optionsOf(q, "an-kind").map(([v]) => v), ["request_for_comment", "grand_jury"], "control: a product kind with no profile is offered, and none but the vocabulary's");
});

test("R28: a profile kind with a label and no key is offered by its label; one with neither is not offered; none reads 'Other' but other", async () => {
  const p = await open(PATH, { plane: PLANE({ affordances: ok(VOC({ action_kind: ["grand_jury", "hearing_statement", "unlabelled_kind", "other"], action_kind_labels: { hearing_statement: "Hearing statement" } })) }) });
  const kinds = optionsOf(p, "an-kind");
  assert.ok(kinds.some(([v, t]) => v === "grand_jury" && t === norm(word("screen.action.kind.grand_jury"))), "a profile kind grand_jury under its key");
  assert.ok(kinds.some(([v, t]) => v === "hearing_statement" && t === "Hearing statement"), "by the profile's label");
  assert.ok(!kinds.some(([v]) => v === "unlabelled_kind"), "neither key nor label: not offered");
  const other = norm(word("screen.action.kind.other"));
  assert.ok(kinds.every(([, t]) => t !== other), "no kind is drawn as the action page's 'Other'");
  assert.ok(kinds.every(([v, t]) => v === "other" || t !== norm(word("screen.actionnew.kind.other"))), "only other is 'Another kind'");
});

test("R35: no template or kind is offered as a suggestion before an action exists; templates.after and .none are drawn", async () => {
  const p = await open(PATH, { plane: PLANE() });
  assert.ok(drew(p, "screen.actionnew.templates.after") && drew(p, "screen.actionnew.templates.none"));
  assert.equal(p.requests.filter((r) => /template/i.test(String(r.op || (r.query && r.query.op) || ""))).length, 0, "no template is read");
  assert.ok(!ops(p).some((o) => /template/i.test(o)), "no template act");
  assert.equal(main(p).querySelector("[data-template]"), null);
  await choose(p, "an-kind", "records_request");
  assert.ok(drew(p, "screen.actionnew.templates.after") && drew(p, "screen.actionnew.templates.none"), "also for a records request");
});
