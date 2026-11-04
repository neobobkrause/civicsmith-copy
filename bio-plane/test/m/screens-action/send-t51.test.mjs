/* screens-action R41, R42, R47, R48, R49 (T51 fix round, send group; C70, C71, C74, C75, C76; DEC-377) and the entry-19 half of L20 (K4195):
   the tier refusal's door to the risk, the approval's resolutions, the team's contact, the template kept from an approved filing, the
   exhibits against the venue's standard, the writing help on the own-words fields, and a refusal's findings. Every sentence is asserted
   by its key (R19); every request is compared with its owner's declaration by the harness (R104). */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, filingIn, openIn, answeredAs } from "./world-C.mjs";
import { actionDoc } from "./world.mjs";
import { SCREENS, open, main, text, ops, press, last, ok, refusedIn, button, beside, fill, W, D, hasWord, DATA_PLANE, PLAN_ID, ACTION, ACTION_ID, FILING, FILINGS, READ, STAKE, draft, ROUTES, PROJECT } from "./page.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { DECLARED_FIELDS } from "./declared.mjs";
import { writingHelpDraftHeld } from "../wizard-scripts/fixtures.mjs";

const STEP1 = `/app/start-send/${PLAN_ID}~opt-1`;
const STEP2 = `/app/start-send/${ACTION_ID}`;
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
/** A refusal as an owner answers it, with the fields of its own answer. */
const refusedWith = (code, extra = {}) => ({ status: 200, json: { ok: true, result: { ok: false, reason: code, code, ...extra } } });
const APPROVED = { approved_by: "member:mai", at: "2026-10-10T09:00:00Z", sha: "s" };
const slot = (p, b) => p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`);
const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };

/* ---------- R41 (C70; amends R3) ---------- */

test("R41, R59 (DEC-439 J43): filingprepare answered FILING_TIER_UNDETERMINED draws its refusal words and, beside them, a reference to the action's risk (risk.title) that opens the action screen on this action; control: success and other refusals draw none", async () => {
  assert.ok(hasWord("risk.title") && hasWord("refusal.FILING_TIER_UNDETERMINED"));
  /* the owner's own refusals: an action whose tier no member has stated is refused FILING_TIER_UNDETERMINED, one at tier 3 TIER3_COUNSEL_PACKET */
  const { world, me, action } = await actionWorld();
  const at = `/app/start-send/${action}`;
  const p = await openIn(world, me, at);
  const b = await press(p, "filingprepare");
  const words = beside(p, b);
  assert.ok(words.includes(W("refusal.FILING_TIER_UNDETERMINED")));
  const door = slot(p, b).querySelector("a");
  assert.ok(door, "a door beside the words");
  assert.equal(door.getAttribute("href"), `/app/action/${action}`);
  assert.ok(door.hasAttribute("data-nav"));
  assert.equal(door.textContent.trim(), W("screen.start-send.risk.door"));
  // control: another refusal draws its words and no door
  await me.act("actionrisktier", { body: { target: action, tier: 3, reason: "the office has fought requests before" } });
  const q = await openIn(world, me, at);
  const c = await press(q, "filingprepare");
  assert.ok(beside(q, c).includes(W("refusal.TIER3_COUNSEL_PACKET")), "the owner's other refusal, in its words");
  assert.equal(slot(q, c).querySelector("a"), null);
  // control: success draws none
  const s = await open(STEP2, { ...DATA_PLANE, filingprepare: ok({ id: FILING, text: "From the template.", blanks: [] }) });
  const d = await press(s, "filingprepare");
  assert.equal(slot(s, d).querySelector("a"), null);
  assert.equal(main(s).querySelectorAll(`a[href="/app/action/${ACTION_ID}"]`).filter((a) => a.textContent.trim() === W("screen.start-send.risk.door")).length, 0);
});

/* ---------- R42 (C71; B11; amends R3) ---------- */

const S0 = "We say the office broke the law.", S1 = "The city violated the ordinance.";
const unresolved = (sentences) => refusedWith("ASSERTION_UNRESOLVED", { filing: FILING, sentences: sentences.map((text) => ({ index: [S0, S1].indexOf(text), text })) });
const APPROVE_PLANE = (answer) => ({ ...DATA_PLANE, filingread: ok(READ({ text: `${S0} ${S1}` })), filingsfor: () => ok(FILINGS([draft()])), filingapprove: answer });
const approve = (p) => press(p, "filingapprove", { confirm: true });

test("R42: a refusal ASSERTION_UNRESOLVED draws one choice per pointed-out sentence, with the design's words; the resend carries `resolutions` of the declared shape (the exact text, `only_asks` with words, `breach_claim` without), never an `index`", async () => {
  for (const k of ["assertion.resolve.rewrite", "assertion.resolve.only_asks", "assertion.resolve.breach_claim", "refusal.ASSERTION_UNRESOLVED"]) assert.ok(hasWord(k), k);
  const sent = [];
  const p = await open(STEP2, APPROVE_PLANE((req) => { sent.push(req.body); return req.body.resolutions ? ok({ filing: FILING }) : unresolved([S0, S1]); }));
  const b = await approve(p);
  assert.deepEqual(sent[0], { filing: FILING }, "first, only the filing");
  const there = main(p);
  assert.ok(beside(p, b).includes(W("refusal.ASSERTION_UNRESOLVED")));
  assert.ok(text(p).includes(S0) && text(p).includes(S1), "each sentence, as the record answers it");
  for (const i of [0, 1]) {
    assert.ok(there.querySelector(`#assert-words-${i}`), "words for 'it only asks'");
    assert.equal(there.querySelectorAll(`#assert-pick-${i} input`).length, 2, "rewrite and breach claim");
  }
  for (const k of ["phrasing.assertion.pointed", "assertion.resolve.rewrite", "assertion.resolve.only_asks", "assertion.resolve.breach_claim"]) said(p, k);
  fill(p, { "assert-words-0": "  We only ask for the logs.  ", "assert-pick-1-1": true });
  await approve(p);
  const body = sent[1];
  assert.deepEqual(Object.keys(body).sort(), ["filing", "resolutions"]);
  assert.deepEqual(body.resolutions, [{ sentence: S0, resolution: "only_asks", words: "We only ask for the logs." }, { sentence: S1, resolution: "breach_claim" }]);
  for (const r of body.resolutions) assert.ok(!("index" in r), "no index");
});

test("R42: a sentence answered on one refusal stays answered on the next, so the resend carries every resolution; one left open is not sent; control: a resolution of a sentence no longer in the text is not sent", async () => {
  const sent = [];
  const left = (b) => (b.resolutions || []).map((r) => r.sentence);
  const p = await open(STEP2, APPROVE_PLANE((req) => { sent.push(req.body); const open = [S0, S1].filter((s) => !left(req.body).includes(s)); return open.length ? unresolved(open) : ok({ filing: FILING }); }));
  await approve(p);
  fill(p, { "assert-pick-0-1": true });
  const b = await approve(p);
  assert.deepEqual(sent[1].resolutions, [{ sentence: S0, resolution: "breach_claim" }], "one answered, the other left open");
  assert.ok(beside(p, b).includes(W("refusal.ASSERTION_UNRESOLVED")) && p.doc.getElementById("assert-words-1") && !p.doc.getElementById("assert-words-0"), "the refusal names only the open one");
  fill(p, { "assert-words-1": "It only asks." });
  await approve(p);
  assert.deepEqual(sent[2].resolutions, [{ sentence: S0, resolution: "breach_claim" }, { sentence: S1, resolution: "only_asks", words: "It only asks." }]);
  // control: she rewrote the first sentence; its old answer binds text that is no longer there and is not sent
  const q = await open(STEP2, APPROVE_PLANE((req) => { sent.push(req.body); return (req.body.resolutions || []).length ? ok({ filing: FILING }) : unresolved([S0, S1]); }));
  await approve(q);
  fill(q, { "assert-pick-0-1": true });
  await approve(q);
  fill(q, { "send-text-1": S1 });
  await approve(q);
  assert.deepEqual(sent.at(-1), { filing: FILING, text: S1 }, "the rewritten sentence's answer is not sent");
});

test("R42: a refusal ASSERTION_RESOLUTION_REFUSED is drawn by its words and keeps the choices' place; control: an approval that is not refused sends only `filing`, and `text` where she edited it", async () => {
  assert.ok(hasWord("refusal.ASSERTION_RESOLUTION_REFUSED"));
  const p = await open(STEP2, APPROVE_PLANE((req) => (req.body.resolutions ? refusedWith("ASSERTION_RESOLUTION_REFUSED", { filing: FILING, findings: [{ detail: "x" }] }) : unresolved([S0]))));
  await approve(p);
  fill(p, { "assert-words-0": "It only asks." });
  const b = await approve(p);
  assert.ok(beside(p, b).includes(W("refusal.ASSERTION_RESOLUTION_REFUSED")));
  const plain = await open(STEP2, APPROVE_PLANE(ok({ filing: FILING })));
  await approve(plain);
  assert.deepEqual(last(plain, "filingapprove").body, { filing: FILING });
  const edited = await open(STEP2, APPROVE_PLANE(ok({ filing: FILING })));
  fill(edited, { "send-text-1": "We request the logs for 2026." });
  await approve(edited);
  assert.deepEqual(last(edited, "filingapprove").body, { filing: FILING, text: "We request the logs for 2026." });
});

/* ---------- R47 (C74; DEC-377) ---------- */

/* ---------- R42 (B16 a): a sentence the record contradicts is released with the approval ---------- */

const held = (sentences) => refusedWith("CONTRADICTED_HELD", { filing: FILING, sentences: sentences.map((text) => ({ index: [S0, S1].indexOf(text), text, contradicted_by: null })) });

test("R42 (B16 a, DEC-387): a refusal CONTRADICTED_HELD draws 'A sentence the record contradicts' for each sentence, with a reason and a tick, and no act of its own; the resend carries `release: [{ord, reason}]` for the ticked ones, the shape `filings` declares", async () => {
  for (const k of ["screen.start-send.release.head", "screen.start-send.release.why", "screen.start-send.release.why.help", "screen.start-send.release.done", "act.release.label.start-send", "pointer.record.contradicted", "refusal.CONTRADICTED_HELD"]) assert.ok(hasWord(k), k);
  const sent = [];
  const p = await open(STEP2, APPROVE_PLANE((req) => { sent.push(req.body); return req.body.release ? ok({ filing: FILING, released: req.body.release }) : held([S0, S1]); }));
  assert.ok(!ops(p).includes("release"), "release is not an act of this screen");
  const b = await approve(p);
  assert.deepEqual(sent[0], { filing: FILING }, "first, only the filing");
  assert.ok(beside(p, b).includes(W("refusal.CONTRADICTED_HELD")));
  assert.ok(text(p).includes(S0) && text(p).includes(S1), "each sentence, as the record answers it");
  said(p, "screen.start-send.release.head");
  said(p, "pointer.record.contradicted");
  said(p, "screen.start-send.release.why");
  said(p, "screen.start-send.release.why.help");
  assert.ok(!ops(p).includes("release"), "still no separate act");
  assert.equal([0, 1].filter((i) => p.doc.getElementById("release-why-" + i)).length, 2, "a reason for each sentence");
  // a tick with no reason is refused in place and sends nothing
  fill(p, { "release-pick-1-0": true });
  const refused = await approve(p);
  assert.equal(sent.length, 1, "nothing sent while the reason is empty");
  assert.ok(beside(p, refused).includes(W("shell.reason.needed")));
  // the ticked sentence goes with the approval, by its index and its reason; the unticked one stays held
  fill(p, { "release-pick-1-0": true, "release-why-1": "  The log lists the dates; the logs show them.  " });
  await approve(p);
  const body = sent[1];
  assert.deepEqual(Object.keys(body).sort(), ["filing", "release"]);
  assert.deepEqual(body.release, [{ ord: 1, reason: "The log lists the dates; the logs show them." }]);
  assert.deepEqual(DECLARED_FIELDS("filingapprove").includes("release"), true, "the owner declares `release`");
});

test("R42 (B16 a): after the approval lands the release is said once, by key, with who and when; control: an approval that is not refused sends no `release`, and draws none", async () => {
  const sent = [];
  const p = await open(STEP2, APPROVE_PLANE((req) => { sent.push(req.body); return ok({ filing: FILING }); }));
  await approve(p);
  assert.ok(!("release" in sent[0]) && !("resolutions" in sent[0]), "control: only the filing");
  assert.ok(!text(p).includes(W("screen.start-send.release.head")));
  // a released sentence is said once the approval lands, by `screen.start-send.release.done` (who: the member who pressed it)
  let landed = false;
  const q = await open(STEP2, { ...DATA_PLANE, filingread: ok(READ({ text: `${S0} ${S1}` })), filingsfor: () => ok(FILINGS([draft(landed ? { approval: APPROVED } : {})])),
    filingapprove: (req) => { if (req.body.release) { landed = true; return ok({ filing: FILING, released: req.body.release }); } return held([S1]); } });
  await approve(q);
  fill(q, { "release-pick-1-0": true, "release-why-1": "Rewritten in the next draft." });
  await approve(q);
  assert.equal(last(q, "filingapprove").body.release[0].reason, "Rewritten in the next draft.");
  const handle = q.me && q.me.handle ? q.me.handle : null;
  if (handle) assert.ok(text(q).includes(W("screen.start-send.release.done", { who: handle, date: D(new Date().toISOString().slice(0, 10)), reason: "Rewritten in the next draft." })));
  assert.ok(text(q).includes("Rewritten in the next draft."), "the reason is kept beside the approval");
});

const MEMBERS = { ok: true, members: [
  { member_id: "admin", handle: null, role: "admin", status: "active", founder: true },
  { member_id: "dev", handle: "dev", role: "member", status: "active" }, { member_id: "mai", handle: "mai", role: "member", status: "active" },
  { member_id: "old", handle: "old", role: "member", status: "revoked" }] };
const STARTED = ok({ plan: PLAN_ID, option: "opt-1", action: ACTION_ID, reminders: [] });

test("R47: the start step offers the team's contact, optional, 'No one yet' first, from the members the plane lists; the choice sends `contact`, no choice sends none", async () => {
  for (const k of ["screen.start-send.contact.label", "screen.start-send.contact.help1", "screen.start-send.contact.help2", "screen.start-send.contact.help3"]) assert.ok(hasWord(k), k);
  const p = await open(STEP1, { ...DATA_PLANE, memberlist: ok(MEMBERS), optionstart: STARTED });
  assert.equal(p.byOp("memberlist").length, 1);
  said(p, "screen.start-send.contact.label");
  for (const k of ["help1", "help2", "help3"]) said(p, "screen.start-send.contact." + k);
  const pick = p.doc.getElementById("start-contact");
  const options = pick.querySelectorAll("option");
  assert.deepEqual(options.map((o) => o.getAttribute("value")), ["", "dev", "mai"], "no one first; active members with a handle only");
  assert.deepEqual(options.slice(1).map((o) => o.textContent.trim()), ["dev", "mai"]);
  assert.equal(options[0].textContent.trim(), W("screen.start-send.contact.none"), "'No one yet' by its key (DEC-387)");
  fill(p, { "start-contact": "dev" });
  await press(p, "optionstart", { reason: "go" });
  assert.equal(last(p, "optionstart").body.contact, "dev");
  const none = await open(STEP1, { ...DATA_PLANE, memberlist: ok(MEMBERS), optionstart: STARTED });
  await press(none, "optionstart", { reason: "go" });
  assert.ok(!("contact" in last(none, "optionstart").body), "no choice: no contact");
  const unread = await open(STEP1, { ...DATA_PLANE, optionstart: STARTED });
  assert.deepEqual(unread.doc.getElementById("start-contact").querySelectorAll("option").map((o) => o.getAttribute("value")), [""], "control: a roster that cannot be read offers no one");
});

test("R47: CONTACT_NOT_A_MEMBER is drawn by its words beside the act and the form is kept; control: a start that lands draws none", async () => {
  for (const k of ["screen.start-send.contact.refused.body1", "screen.start-send.contact.refused.body2"]) assert.ok(hasWord(k), k);
  const p = await open(STEP1, { ...DATA_PLANE, memberlist: ok(MEMBERS), optionstart: refusedWith("CONTACT_NOT_A_MEMBER") });
  fill(p, { "start-contact": "mai", "start-override": "the logs are public" });
  const b = await press(p, "optionstart", { reason: "go" });
  assert.ok(beside(p, b).includes(W("screen.start-send.contact.refused.body1")) && beside(p, b).includes(W("screen.start-send.contact.refused.body2")));
  assert.equal(p.location.pathname, STEP1, "nothing moved");
  assert.equal(p.doc.getElementById("start-contact").value, "mai", "the form is kept");
  assert.equal(p.doc.getElementById("start-override").value, "the logs are public");
  const q = await open(STEP1, { ...DATA_PLANE, memberlist: ok(MEMBERS), optionstart: STARTED });
  const c = await press(q, "optionstart", { reason: "go" });
  assert.ok(!beside(q, c).includes(W("screen.start-send.contact.refused.body1")));
});

/* ---------- entry 19 (L20, K4195): a refusal's findings ---------- */

test("L20: optionstart refused ACTION_BASIS_REFUSED draws the code's words and then each finding's detail, as the record answers it (escaped); control: no findings draws the code's sentence only", async () => {
  assert.ok(hasWord("refusal.ACTION_BASIS_REFUSED"));
  const p = await open(STEP1, { ...DATA_PLANE, optionstart: refusedWith("ACTION_BASIS_REFUSED", { findings: [{ detail: "the leg names <b>no</b> finding" }, { detail: "the question is not this project's" }] }) });
  const b = await press(p, "optionstart", { reason: "go" });
  const t = beside(p, b);
  assert.ok(!t.includes(W("refusal.ACTION_BASIS_REFUSED")), "re-walk 10 N7: the owner's reasons are the answer");
  assert.ok(t.includes("the leg names <b>no</b> finding") && t.includes("the question is not this project's"), "each detail, escaped");
  assert.equal(slot(p, b).querySelector("b"), null, "never as markup");
  const q = await open(STEP1, { ...DATA_PLANE, optionstart: refusedWith("ACTION_BASIS_REFUSED") });
  const c = await press(q, "optionstart", { reason: "go" });
  assert.equal(beside(q, c), W("refusal.ACTION_BASIS_REFUSED"));
});

/* ---------- R48 (C75; DEC-377) ---------- */

const TPL_KEYS = ["screen.start-send.template.heading", "screen.start-send.template.note1", "screen.start-send.template.note2", "screen.start-send.template.note3",
  "screen.start-send.template.name.help1", "screen.start-send.template.name.help2", "screen.start-send.template.use.label", "screen.start-send.template.use.help1",
  "screen.start-send.template.use.help2", "screen.start-send.template.use.brief", "screen.start-send.template.notes.label", "screen.start-send.template.notes.help"];
const approvedPlane = (over = {}, d = {}) => ({ ...DATA_PLANE, filingsfor: ok(FILINGS([draft({ approval: APPROVED, ...d })])), ...over });
const useOptions = (p) => p.doc.getElementById("template-use").querySelectorAll("option").map((o) => o.getAttribute("value"));

/** An action at `tier` whose communication is prepared and, unless `approve` is false, approved by the member; the project asks a second member's
 *  approval of a tier-2 act when `second`. Answers `{world, me, project, action, filing, at}`: `at` the send step's address. */
async function approvedWorld({ tier = 2, approve = true, second = false, sent = false } = {}) {
  const w = await actionWorld();
  if (tier) await w.me.act("actionrisktier", { body: { target: w.action, tier, reason: "the office has fought requests before" } });
  if (second) await w.me.act("projectapprovalset", { query: { projectId: w.project, needs: JSON.stringify([{ tier: 2 }]), reason: "two members for a tier-2 act" } });
  const filing = await filingIn(w.me, w.action, { approve, sent });
  return { ...w, filing, at: `/app/start-send/${w.action}` };
}
const kept = async (me, action) => (await me.read("filingsfor", { query: { action } })).drafts;

test("R48: 'Keep this filing as your team's template' is offered once the filing is approved (the send step) and sends the declared names: filing, name, use and notes; not before approval", async () => {
  for (const k of TPL_KEYS) assert.ok(hasWord(k), k);
  const { world, me, project, action, at } = await approvedWorld({ approve: false });
  const none = await openIn(world, me, `/app/start-send/${(await me.act("actioncreate", { body: { document: actionDoc(project, { title: "Nothing prepared here" }), project } })).id}`);
  assert.ok(!ops(none).includes("templatesave"), "control: nothing prepared");
  const early = await openIn(world, me, at);
  assert.ok(!ops(early).includes("templatesave") && !text(early).includes(W("screen.start-send.template.heading")), "control: not before approval");
  const [draftHeld] = await kept(me, action);
  await me.act("filingapprove", { body: { filing: draftHeld.filing } });
  const p = await openIn(world, me, at);
  for (const k of ["heading", "note1", "note2", "note3", "name.help1", "name.help2", "use.label", "notes.label", "notes.help"]) said(p, "screen.start-send.template." + k);
  assert.ok(button(p, "templatesave").textContent.includes(W("act.templatesave.label.start-send")));
  assert.deepEqual(useOptions(p), ["file", "brief"], "a filing of a tier that needs no counsel: both");
  // DEC-387 (B424): the template's name label and the options of its use, each by its own key
  assert.equal(p.doc.getElementById("template-name").parentNode.querySelector("label").textContent.trim(), W("screen.start-send.template.name.label"));
  assert.deepEqual(p.doc.getElementById("template-use").querySelectorAll("option").map((o) => o.textContent.trim()), [W("screen.start-send.template.use.filing"), W("screen.start-send.template.use.brief")]);
  await press(p, "templatesave", { values: { "template-name": "Records request to a city clerk", "template-use": "brief", "template-notes": "Use for the clerk." }, reason: "keep" });
  assert.deepEqual({ ...last(p, "templatesave").body, reason: undefined }, { filing: draftHeld.filing, name: "Records request to a city clerk", use: "brief", notes: "Use for the clerk.", project, reason: undefined });
  await press(p, "templatesave", { values: { "template-name": "Another", "template-use": "file", "template-notes": "" }, reason: "keep" });
  const second = last(p, "templatesave").body;
  assert.deepEqual({ filing: second.filing, name: second.name, use: second.use, notes: second.notes }, { filing: draftHeld.filing, name: "Another", use: "file", notes: undefined }, "no notes: none sent");
  assert.equal(p.byOp("templatesave").length, 2, "both landed");
  // C65: the scope is the action's project (the filing's basis names one only for a determination); an action in no project sends none
  assert.equal(second.project, project);
  const loose = await me.act("actioncreate", { body: { document: actionDoc(project, { title: "Loose request" }).replace(`project: ${project}\n`, "") } });
  await me.act("actionrisktier", { body: { target: loose.id, tier: 2, reason: "the office has fought requests before" } });
  await me.act("filingapprove", { body: { filing: await filingIn(me, loose.id) } });
  const bare = await openIn(world, me, `/app/start-send/${loose.id}`);
  await press(bare, "templatesave", { values: { "template-name": "Another", "template-use": "file" }, reason: "keep" });
  assert.ok(!("project" in last(bare, "templatesave").body), "control: no project, no scope sent");
});

test("R48: offered at every step from approval: waiting for the second approval, the send, and after the sending; control: a name that is empty is refused in place and sends nothing", async () => {
  const wait = await approvedWorld({ second: true });
  assert.equal((await kept(wait.me, wait.action))[0].second_needed, true, "the project asks a second member");
  const waiting = await openIn(wait.world, wait.me, wait.at);
  assert.ok(ops(waiting).includes("templatesave"), "second");
  const done = await approvedWorld({ sent: true });
  const sentDraft = await openIn(done.world, done.me, done.at);
  assert.ok(ops(sentDraft).includes("templatesave"), "sent");
  assert.equal(button(sentDraft, "templatesave").dataset.filing, done.filing);
  const { world, me, at } = await approvedWorld();
  const p = await openIn(world, me, at);
  const b = await press(p, "templatesave", { reason: "keep" });
  assert.equal(p.byOp("templatesave").length, 0);
  assert.ok(beside(p, b).includes(W("refusal.TEMPLATE_NAME_REFUSED")));
});

test("R48: a filing that needs counsel first (tier 3, by the draft, the action or the stake read) is offered only as a brief; control: a tier 2 filing is offered both", async () => {
  /* by the action and the stake read: prepared at tier 2, the tier since raised to 3 (`actions`, `filings` R62 both read it) */
  const byAction = await approvedWorld({ tier: 2 });
  await byAction.me.act("actionrisktier", { body: { target: byAction.action, tier: 3, reason: "the office has threatened to sue" } });
  assert.equal((await byAction.me.read("stakeatpreparation", { query: { action: byAction.action } })).governing_tier, 3, "the stake read says 3");
  assert.equal((await byAction.me.read("action", { query: { id: byAction.action } })).risk_tier, 3, "the action says 3");
  /* by the draft: `filings` gives a draft its own `tier` only for a filing prepared at tier 1 or 2 and no member's act brings it to 3, so the
     one field is the store's own answer with the tier 3 put on the draft (the action stays tier 2) */
  const byDraft = await approvedWorld({ tier: 2 });
  const draftAt3 = { filingsfor: answeredAs(byDraft.world, byDraft.me, (a) => { a.json.result.drafts = a.json.result.drafts.map((d) => ({ ...d, tier: 3 })); }) };
  for (const [why, w, plane] of [["action and stake read", byAction, {}], ["draft", byDraft, draftAt3]]) {
    const p = await openIn(w.world, w.me, w.at, plane);
    assert.deepEqual(useOptions(p), ["brief"], why);
    await press(p, "templatesave", { values: { "template-name": "Brief to counsel" }, reason: "keep" });
    assert.equal(last(p, "templatesave").body.use, "brief", why);
    assert.equal(p.byOp("templatesave").length, 1, "the owner took the brief: " + why);
  }
  const two = await approvedWorld({ tier: 2 });
  assert.deepEqual(useOptions(await openIn(two.world, two.me, two.at)), ["file", "brief"]);
});

test("R48: the template's refusals are drawn by their words beside the act; control: a save that lands draws none", async () => {
  /* each refusal is the owner's own, provoked by the state or the value that makes it */
  const provoke = {
    TEMPLATE_NAME_TAKEN: async (w) => { await w.me.act("templatesave", { body: { filing: w.filing, name: "Clerk request", use: "file", project: w.project } }); return {}; },
    TEMPLATE_TIER3_FILE: async (w) => { await w.me.act("actionrisktier", { body: { target: w.action, tier: 3, reason: "the office has threatened to sue" } }); return {}; },
    /* the page refuses a long or broken-line name in place, as the owner does; a name holding half of a surrogate pair (a pasted emoji cut in two) passes the page and not the owner */
    TEMPLATE_NAME_REFUSED: async () => ({ "template-name": "Clerk \uD83D request" }),
  };
  for (const [code, make] of Object.entries(provoke)) {
    assert.ok(hasWord("refusal." + code), code);
    const w = await approvedWorld();
    const p = await openIn(w.world, w.me, w.at);
    const more = await make(w);
    const b = await press(p, "templatesave", { values: { "template-name": "Clerk request", ...more }, reason: "keep" });
    assert.equal(p.byOp("templatesave").length, 1, "sent, and refused by the owner: " + code);
    assert.ok(beside(p, b).includes(W("refusal." + code)), code);
    assert.equal(p.doc.getElementById("template-name").value, more["template-name"] || "Clerk request", "the form is kept");
  }
  /* (TEMPLATE_FROM_UNAPPROVED and TEMPLATE_USE_REFUSED are reached by no member through this page: it draws the form only for an approved draft, approval is never taken back, and it sends only `file` or `brief`; the refusals above are drawn by the same key path) */
  const w = await approvedWorld();
  const p = await openIn(w.world, w.me, w.at);
  const b = await press(p, "templatesave", { values: { "template-name": "Clerk request" }, reason: "keep" });
  assert.equal(beside(p, b), "");
  assert.equal(p.byOp("templatesave").length, 1);
});

/* ---------- R49 (C76; DEC-377; filings R25) ---------- */

const EX = (name, grade, venue, o = {}) => ({ sha256: "sha-" + name, cited_by: ["finding:1"], locator: name, captured_at: "2026-10-03T10:00:00Z", attestations: { items: [] },
  grade: { grade, determined: !!grade, route: "x" }, coattested: false, venue, ...o });
const EXHIBITS = [
  EX("Inspection log", "B", { state: "accepted", flagged: false, says: "x" }),
  EX("Photo of Elm Street pothole", "C", { state: "contestable", flagged: true, says: "x" }),
  EX("Screenshot of the repair portal", "D", { state: "below", flagged: true, says: "x" }),
  EX("Council video", null, { state: "undetermined", flagged: false, why: "x" }),
];
const PREPARED = (over = {}) => ({ id: FILING, filing: FILING, action: ACTION_ID, form: "filing", tier: 2, text: "The filing.", blanks: [], unfilled: [], exhibits: EXHIBITS,
  venue_standard: { state: "stated", standard: "x", accepts: [{ grade: "B" }], contestable: [{ grade: "C" }] }, ...over });
const preparePlane = (answer) => { let drafts = []; return { ...DATA_PLANE, filingsfor: () => ok(FILINGS(drafts)), filingprepare: () => { drafts = [draft({ form: "filing", tier: 2 })]; return ok(answer); } }; };
const EXK = ["heading", "intro1", "intro2", "intro3", "accepted", "contestable1", "contestable2", "below1", "below2", "undetermined"];

test("R49: each exhibit's grade and what the venue accepts is drawn from the prepared filing's answer: within, contestable, below, undetermined; a flagged exhibit never stops the approval", async () => {
  for (const k of EXK) assert.ok(hasWord("screen.start-send.exhibits." + k), k);
  const p = await open(STEP2, preparePlane(PREPARED()));
  await press(p, "filingprepare");
  for (const k of ["heading", "intro1", "intro2", "intro3"]) said(p, "screen.start-send.exhibits." + k);
  const rows = main(p).querySelectorAll("section.cs-section").find((s) => s.querySelector("h2").textContent.trim() === W("screen.start-send.exhibits.heading")).querySelectorAll(".cs-row");
  assert.equal(rows.length, 4);
  const row = (i) => rows[i].textContent.replace(/\s+/g, " ");
  const X = (k) => W("screen.start-send.exhibits." + k);
  assert.ok(row(0).includes("Inspection log") && row(0).includes(X("accepted")));
  assert.ok(row(1).includes("Photo of Elm Street pothole") && row(1).includes(X("contestable1")) && row(1).includes(X("contestable2")));
  assert.ok(row(2).includes("Screenshot of the repair portal") && row(2).includes(X("below1")) && row(2).includes(X("below2")));
  assert.ok(row(3).includes("Council video") && row(3).includes(X("undetermined")));
  // DEC-387 (B424): the capture's day by `captured`, and an exhibit with no grade says so by `nograde`
  assert.ok(row(0).includes(W("screen.start-send.exhibits.captured", { date: D("2026-10-03") })), "captured {date}");
  assert.ok(row(3).includes(X("nograde")) && !row(0).includes(X("nograde")), "grade not determined only where none is");
  assert.deepEqual(rows.slice(0, 3).map((r) => r.querySelector(".cs-grade").textContent.replace(/\s+/g, " ").trim().slice(-1)), ["B", "C", "D"], "the grade of each capture");
  for (const [i, k] of [[0, "contestable1"], [0, "below1"], [0, "undetermined"], [1, "accepted"], [3, "accepted"]]) assert.ok(!row(i).includes(X(k)), `row ${i} is not ${k}`);
  // control: flagged exhibits stop nothing
  assert.deepEqual(ops(p), ["filingapprove"]);
  assert.equal(button(p, "filingapprove").disabled, false, "Approve stays enabled");
  assert.equal(button(p, "filingapprove").getAttribute("aria-disabled"), null);
});

test("R49: where the venue's standard is not stated its fold is drawn and the grades still show; control: a stated standard draws no fold, and a filing with no exhibits draws no section", async () => {
  for (const k of ["refused.summary", "refused.body1", "refused.body2", "refused.body3"]) assert.ok(hasWord("screen.start-send.exhibits." + k), k);
  const none = { state: "undetermined", why: "x" };
  const p = await open(STEP2, preparePlane(PREPARED({ venue_standard: none, exhibits: EXHIBITS.slice(0, 1).map((e) => ({ ...e, venue: { state: "undetermined", flagged: false, why: "x" } })) })));
  await press(p, "filingprepare");
  for (const k of ["refused.summary", "refused.body1", "refused.body2", "refused.body3", "undetermined"]) said(p, "screen.start-send.exhibits." + k);
  assert.ok(main(p).querySelector(".cs-grade"), "the grades still show");
  const stated = await open(STEP2, preparePlane(PREPARED()));
  await press(stated, "filingprepare");
  unsaid(stated, "screen.start-send.exhibits.refused.body1");
  const empty = await open(STEP2, preparePlane(PREPARED({ exhibits: [] })));
  await press(empty, "filingprepare");
  unsaid(empty, "screen.start-send.exhibits.heading");
  assert.ok(ops(empty).includes("filingapprove"));
});

test("R49 (filings R59, R25): after a reload the exhibits and the venue's standard are drawn from the stored draft `filingread` answers; control: a row stored before they existed (exhibits [] and no standard) draws no section", async () => {
  const reloaded = await open(STEP2, { ...DATA_PLANE, filingsfor: ok(FILINGS([draft()])), filingread: ok(READ({ exhibits: EXHIBITS, venue_standard: PREPARED().venue_standard })) });
  assert.equal(reloaded.byOp("filingread").length, 1, "the draft is read, not prepared again");
  said(reloaded, "screen.start-send.exhibits.heading");
  const rows = main(reloaded).querySelectorAll("section.cs-section").find((s) => s.querySelector("h2").textContent.trim() === W("screen.start-send.exhibits.heading")).querySelectorAll(".cs-row");
  assert.equal(rows.length, 4);
  assert.ok(rows[1].textContent.includes(W("screen.start-send.exhibits.contestable1")));
  assert.ok(rows[2].textContent.includes(W("screen.start-send.exhibits.below1")));
  assert.equal(button(reloaded, "filingapprove").disabled, false, "Approve stays enabled");
  const old = await open(STEP2, { ...DATA_PLANE, filingsfor: ok(FILINGS([draft()])), filingread: ok(READ({ exhibits: [], venue_standard: null })) });
  unsaid(old, "screen.start-send.exhibits.heading");
});

/* ---------- registry: writinghelp on the own-words fields ---------- */

test("R3, R41: start-send's acts are exactly its registry acts; writing help is drawn beside the own-words fields only while the assistant is reachable and sends the declared names", async () => {
  const mine = SCREENS.find((s) => s.id === "start-send").acts.map((a) => a.op).sort();
  const want = ["optionstartpreview", "optionstart", "communicationprepare", "filingprepare", "filingapprove", "filingrecordsent", "filingsecondapprove", "templatesave", "writinghelp", "projectjoin",
    ...(Object.hasOwn(OPS, "actionstake") ? ["actionstake"] : [])].sort();
  assert.deepEqual(mine, want);
  const off = await open(STEP2, DATA_PLANE);
  assert.ok(!ops(off).includes("writinghelp"), "control: no assistant, no help");
  const on = await open(STEP2, { ...DATA_PLANE, ...REACH, writinghelp: ok(writingHelpDraftHeld()) });
  const b = button(on, "writinghelp");
  assert.ok(b, "drawn on the send text");
  assert.equal(b.dataset.id, "send-text-0");
  assert.ok(b.textContent.includes(W("act.writinghelp.label.start-send")));
  const help = await press(on, "writinghelp", { values: { "send-text-0": "Please send the logs." } });
  assert.equal(last(on, "writinghelp").body.told, "Please send the logs.");
  /* wizard-scripts' published answer (the real op never returns a draft: the door makes it, K5212): a refused help draws its words and replaces nothing she typed */
  assert.equal(on.doc.getElementById("send-text-0").value, "Please send the logs.");
  assert.ok(beside(on, help).includes(W("refusal.WRITING_HELP_DRAFT_HELD")), "the refusal is drawn by its key");
  const tpl = await open(STEP2, { ...approvedPlane(), ...REACH });
  assert.ok(ops(tpl).includes("writinghelp") && main(tpl).querySelectorAll('button[data-act="writinghelp"]').some((x) => x.dataset.id === "template-notes"), "the template's notes");
});
