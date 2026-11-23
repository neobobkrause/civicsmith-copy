/* screens-send R2, R3, R11, R21, R28 (start-send's part), R41, R42, R47, R48, R49: `start-send`, step 1 (what starting a chosen option
 * does, then "Start the action") and step 2 (the send steps it shares with `request`: prepare, approve, the second approval, record the
 * sending, keep the filing as the team's template). Every sentence is asserted by its key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, drew, last, press, button, beside, main, day, norm, ok, refused, refusedIn, word, FILINGS, DRAFT, PREPARED, VOCAB, ACT, ACTION, PLAN, PROJECT } from "./kit.mjs";

const OPTION = "opt-1";
const STEP1 = `/app/start-send/${PLAN}~${OPTION}`;
const STEP2 = `/app/start-send/${ACTION}`;
const FILING = "FIL-2026-0101";
const INQ = "INQ-2026-0042";
const QUESTION_TITLE = "Was the lease renewed without a vote?";

/** action-plans' `plan` answer: one option chosen and not yet started. */
const PLAN_DOC = (o = {}) => ({ id: PLAN, project: PROJECT, title: "The lease", state: "open",
  options: [{ id: OPTION, summary: "Ask the clerk why", category: "other", subjects: [`inquiry:${INQ}`], dates: [], disposition: "chosen", action: null, ...o }] });
/** action-plans' `optionstartpreview` answer (R37's `#previewOf`): the action it would compose, and the refusal it would meet. */
const PREVIEW = (o = {}, a = {}) => ({ ok: true, plan: PLAN, option: OPTION, preview: true, would_start: true, says: "x", reminders: [],
  action: { kind: "records_request", addressee: { state: "named", kind: "office", role: "Town Clerk", body: "Town of Port Ellery" },
    clock: [{ date: "2026-12-04", basis: "the records law's ten days", status: "pending" }],
    legs: [{ target: INQ, kind: "rests_on", subjects: [{ subject: { kind: "inquiry", inquiry: INQ }, support: "hypothetical", why: "x" }] }],
    plan: PLAN, option: OPTION, contact: null, breach: false, premise_override: null, ...a }, ...o });
/** member-roster's `memberlist`: the handles roster. */
const ROSTER = ok({ members: [{ member_id: "mai", handle: "mai", status: "active" }, { member_id: "dev", handle: "dev", status: "active" },
  { member_id: "gone", handle: "gone", status: "suspended" }] });
const STEP1_PLANE = (o = {}) => ({ plan: ok(PLAN_DOC()), optionstartpreview: ok(PREVIEW()), memberlist: ROSTER,
  projectquestions: ok({ ok: true, project: PROJECT, items: [{ inquiry: INQ, title: QUESTION_TITLE }], cursor: null }), ...o });

const APPROVED = { approved_by: "member:mai", at: "2026-11-02T11:00:00Z", sha: "s" };
/** filings' `stakeatpreparation` answer (R62). */
const STAKE = (o = {}) => ({ ok: true, action: ACTION, higher_stakes: false, governing_tier: 1, group_stake: "We hold the city to its own rules.", matter_stake: null, ...o });

/** The option's `<select>`'s values and texts. */
const options = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => ({ value: o.getAttribute("value"), text: norm(o.textContent) }));

/* ---------- R2: step 1, what starting does, first; nothing runs before her confirm ---------- */

test("R2: step 1 asks optionstartpreview first and draws the kind, the office by its role, what it rests on with its state, the clock and the breach; nothing starts", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE() });
  assert.deepEqual(p.byOp("optionstartpreview")[0].body, { plan: PLAN, option: OPTION, kind: "records_request", breach: false });
  assert.ok(drew(p, "screen.start-send.nothingruns"));
  assert.ok(drew(p, "screen.start-send.title", { option: "Ask the clerk why" }));
  assert.ok(drew(p, "screen.start-send.kind.records_request"));
  assert.ok(text(p).includes(norm(`Town Clerk, Town of Port Ellery · ${word("screen.start-send.byrole")}`)), "the office by its role");
  assert.ok(text(p).includes(norm(`${QUESTION_TITLE} · ${word("screen.plan.support.hypothetical")}`)), "what it rests on, with the matter's state");
  assert.ok(text(p).includes(norm(`${day("2026-12-04")} · the records law's ten days`)), "the clock, with where its date comes from");
  assert.equal(norm(main(p).querySelectorAll(".mk-dl dd")[4].textContent), norm(word("screen.start-send.breach.no")), "the breach, not asserted");
  assert.deepEqual(ops(p), ["optionstartpreview", "optionstart"]);
  assert.equal(p.byOp("optionstart").length, 0, "nothing runs on load");
});

test("R2: a preview with no office, no clock and nothing it rests on says each so, and a breach is drawn as asserted", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstartpreview: ok(PREVIEW({}, { addressee: null, clock: [], legs: [], breach: true })) }) });
  for (const k of ["screen.start-send.noaddressee", "screen.start-send.noclock", "screen.start-send.restsnothing", "screen.start-send.breach.yes"]) assert.ok(drew(p, k), k);
  assert.equal(norm(main(p).querySelectorAll(".mk-dl dd")[4].textContent), norm(word("screen.start-send.breach.yes")));
});

test("R2: a refusal starting would meet is drawn first, by its words; resolved in place by a reason to proceed anyway, which the preview then states", async () => {
  const refusal = { ok: false, code: "ACTION_NO_DETERMINATION", reason: "ACTION_NO_DETERMINATION" };
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstartpreview: (req) => ok(req.body.premise_override
    ? PREVIEW({}, { breach: true, premise_override: req.body.premise_override })
    : PREVIEW({ would_start: false, refusal }, { breach: req.body.breach })) }) });
  const gap = main(p).querySelector(".cs-gap");
  assert.ok(gap, "the refusal is drawn");
  assert.ok(drew(p, "screen.start-send.wouldrefuse", {}, gap) && drew(p, "refusal.ACTION_NO_DETERMINATION", {}, gap) && drew(p, "screen.start-send.resolve", {}, gap));
  assert.ok(main(p).innerHTML.indexOf("cs-gap") < main(p).innerHTML.indexOf("mk-dl"), "first, before what starting does");
  const tick = p.doc.getElementById("start-breach-0") || p.doc.querySelector('input[name="start-breach"]');
  tick.checked = true;
  await press(p, "optionstartpreview", { "start-override": "the vote's minutes are public already" });
  assert.deepEqual(last(p, "optionstartpreview").body, { plan: PLAN, option: OPTION, kind: "records_request", breach: true,
    premise_override: { reason: "the vote's minutes are public already" } });
  assert.equal(main(p).querySelector(".cs-gap"), null, "resolved");
  assert.ok(drew(p, "screen.start-send.override.stated"));
  assert.equal(p.byOp("optionstart").length, 0, "a preview starts nothing");
});

test("R2: \"Start the action\" runs only on her confirm, carries her reason and opens step 2; control: a refusal stays beside it and nothing moves", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstart: ok({ plan: PLAN, option: OPTION, action: ACTION, reminders: [] }) }) });
  await p.click(button(p, "optionstart"));
  assert.equal(p.byOp("optionstart").length, 0, "nothing runs before her confirm");
  await press(p, "optionstart", {}, { reason: "first, to see the minutes" });
  const sent = last(p, "optionstart").body;
  assert.equal(sent.plan, PLAN); assert.equal(sent.option, OPTION); assert.equal(sent.kind, "records_request"); assert.equal(sent.breach, false);
  assert.equal(sent.why_first, "first, to see the minutes");
  assert.equal(p.byOp("optionstart").length, 1);
  assert.equal(p.location.pathname, STEP2, "step 2 opens for the action started");
  const q = await open(STEP1, { plane: STEP1_PLANE({ optionstart: refusedIn("OPTION_NOT_CHOSEN", "This option is not chosen.") }) });
  const b = await press(q, "optionstart");
  assert.ok(beside(q, b).includes(norm(word("refusal.OPTION_NOT_CHOSEN"))));
  assert.equal(q.location.pathname, STEP1);
});

/* ---------- R47: the team's contact, chosen at the start ---------- */

test("R47: the contact is offered from the active members, \"No one yet\" first; the choice sends contact", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstart: ok({ action: ACTION }) }) });
  assert.deepEqual(options(p, "start-contact"), [{ value: "", text: norm(word("screen.start-send.contact.none")) }, { value: "mai", text: "mai" }, { value: "dev", text: "dev" }]);
  await press(p, "optionstart", { "start-contact": "dev" });
  assert.equal(last(p, "optionstart").body.contact, "dev");
});

test("R47: \"No one yet\" sends no contact (control)", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstart: ok({ action: ACTION }) }) });
  await press(p, "optionstart");
  assert.ok(!("contact" in last(p, "optionstart").body));
});

test("R47: CONTACT_NOT_A_MEMBER is drawn by its words with the choice kept, and nothing moves", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstart: refusedIn("CONTACT_NOT_A_MEMBER", "contact names no member") }) });
  const b = await press(p, "optionstart", { "start-contact": "dev" });
  assert.ok(beside(p, b).includes(norm(word("screen.start-send.contact.refused.body1"))) && beside(p, b).includes(norm(word("screen.start-send.contact.refused.body2"))));
  assert.equal(p.doc.getElementById("start-contact").value, "dev", "the choice is kept");
  assert.equal(p.location.pathname, STEP1);
});

/* ---------- R28: the kind drawn in lower case, a profile's own by its label, never "Other" unless `other` ---------- */

test("R28: the kinds offered are the vocabulary's, each in lower case under screen.start-send.kind.<kind>, a profile's own by its label, one with neither not at all", async () => {
  const vocab = ok(VOCAB(["records_request", "grand_jury", "county_referral", "mystery_kind"], { county_referral: "Referral to the county board" }));
  const p = await open(STEP1, { plane: STEP1_PLANE({ affordances: vocab }) });
  assert.deepEqual(options(p, "start-kind"), [{ value: "records_request", text: norm(word("screen.start-send.kind.records_request")) },
    { value: "grand_jury", text: norm(word("screen.start-send.kind.grand_jury")) }, { value: "county_referral", text: "Referral to the county board" }]);
  assert.ok(!options(p, "start-kind").some((o) => o.text === word("screen.action.kind.other")), "no kind reads \"Other\"");
});

test("R28: the preview draws a grand jury referral under screen.start-send.kind.grand_jury, and a profile's own kind by its label", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstartpreview: ok(PREVIEW({}, { kind: "grand_jury" })) }) });
  assert.ok(drew(p, "screen.start-send.kind.grand_jury"));
  const q = await open(STEP1, { plane: STEP1_PLANE({ affordances: ok(VOCAB(["county_referral"], { county_referral: "Referral to the county board" })),
    optionstartpreview: ok(PREVIEW({}, { kind: "county_referral" })) }) });
  const kind = main(q).querySelector(".mk-dl dd");
  assert.equal(norm(kind.textContent), "Referral to the county board");
});

test("R28: `other` is drawn as its own key and no other kind is", async () => {
  const p = await open(STEP1, { plane: STEP1_PLANE({ optionstartpreview: ok(PREVIEW({}, { kind: "other" })) }) });
  assert.equal(norm(main(p).querySelector(".mk-dl dd").textContent), norm(word("screen.start-send.kind.other")));
  const q = await open(STEP1, { plane: STEP1_PLANE({ optionstartpreview: ok(PREVIEW({}, { kind: "unlabelled_kind" })) }) });
  assert.equal(norm(main(q).querySelector(".mk-dl dd").textContent), "", "a kind with neither key nor label is drawn as nothing, never \"Other\"");
});

/* ---------- R3: step 2, prepare and send ---------- */

test("R3: step 2 offers \"Prepare what is sent\" and \"Prepare the filing\", says the team's Civicsmith sends nothing, and prepares from her own words", async () => {
  let drafts = [];
  const p = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)),
    communicationprepare: () => { drafts = [DRAFT()]; return ok(PREPARED({ text: "We ask why the lease was renewed.",
      blanks: [{ name: "office", value: "Town Clerk", source: ACTION }], disclosure: { machine: false } })); } } });
  assert.deepEqual(ops(p).filter((o) => o !== "writinghelp"), ["communicationprepare", "filingprepare"]);
  assert.ok(drew(p, "screen.start-send.nosend"));
  await press(p, "communicationprepare", { "send-text-0": "We ask why the lease was renewed." });
  const sent = last(p, "communicationprepare").body;
  assert.equal(sent.action, ACTION); assert.equal(sent.purpose, "request"); assert.equal(sent.text, "We ask why the lease was renewed."); assert.equal(sent.language, "en");
  assert.equal(p.doc.getElementById("send-text-1").value, "We ask why the lease was renewed.");
  assert.ok(drew(p, "screen.start-send.draft.own"), "labelled as her own words");
  assert.ok(drew(p, "screen.start-send.blank", { name: "office", value: "Town Clerk", source: ACTION }), "each filled blank names its source");
  assert.deepEqual(ops(p).filter((o) => o !== "writinghelp"), ["filingapprove"]);
});

test("R3: preparing with no words is refused in place and sends nothing", async () => {
  const p = await open(STEP2);
  const b = await press(p, "communicationprepare");
  assert.ok(beside(p, b).includes(norm(word("screen.start-send.text.needed"))));
  assert.equal(p.byOp("communicationprepare").length, 0);
});

test("R3: \"Prepare the filing\" with no words sends the action alone, from the group's template, and labels it so; a machine draft is labelled machine work", async () => {
  const p = await open(STEP2, { plane: { filingprepare: ok(PREPARED({ text: "From the template.", template: { id: "TPL-1" } })) } });
  await press(p, "filingprepare");
  assert.deepEqual(last(p, "filingprepare").body, { action: ACTION });
  assert.ok(drew(p, "screen.start-send.draft.template"));
  const q = await open(STEP2, { plane: { filingprepare: ok(PREPARED({ disclosure: { machine: true } })) } });
  await press(q, "filingprepare", { "send-text-0": "Our words." });
  assert.deepEqual(last(q, "filingprepare").body, { action: ACTION, text: "Our words." });
  assert.ok(drew(q, "screen.start-send.draft.machine"));
});

test("R3: \"Approve this text\" is terminal: its dialog says approving fixes the text, it sends only on confirm, then offers the sending", async () => {
  let drafts = [DRAFT()];
  const p = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)), filingread: ok(PREPARED()),
    filingapprove: () => { drafts = [DRAFT({ approval: APPROVED })]; return ok({ filing: FILING }); } } });
  const b = button(p, "filingapprove");
  await p.click(b);
  assert.equal(p.byOp("filingapprove").length, 0, "nothing before her confirm");
  assert.ok(text(p, p.root()).includes(norm(word("act.filingapprove.does"))), "the dialog says what approving does");
  const ok2 = p.root().querySelector(`[data-shell="confirm"][data-for="${b.getAttribute("data-ai")}"]`);
  await p.click(ok2); await p.settle();
  assert.deepEqual(last(p, "filingapprove").body, { filing: FILING });
  assert.ok(ops(p).includes("filingrecordsent"));
  assert.ok(!ops(p).includes("filingapprove"));
});

test("R3: where the project asks a second approval, the screen says it waits and offers it, never the send; once given, the send", async () => {
  const waiting = DRAFT({ approval: { ...APPROVED, approved_by: "member:dev" }, second_needed: true });
  let drafts = [waiting];
  const p = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)),
    filingsecondapprove: () => { drafts = [{ ...waiting, second_approval: { approved_by: "member:mai" } }]; return ok({}); } } });
  assert.ok(drew(p, "screen.start-send.waitsecond"));
  assert.ok(ops(p).includes("filingsecondapprove") && !ops(p).includes("filingrecordsent"));
  await press(p, "filingsecondapprove");
  assert.deepEqual(last(p, "filingsecondapprove").body, { filing: FILING });
  assert.ok(ops(p).includes("filingrecordsent") && !ops(p).includes("filingsecondapprove"));
});

test("R3: \"I have sent it · record the sending\" is outward, refuses a day not given in place, and records the day, how and the reference", async () => {
  let drafts = [DRAFT({ approval: APPROVED })];
  const p = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)),
    filingrecordsent: () => { drafts = [{ ...drafts[0], sending: { ord: 1, sent_on: "2026-11-10", reference: "R-12" } }]; return ok({}); } } });
  const b = button(p, "filingrecordsent");
  assert.ok(norm(b.textContent).includes(norm(word("screen.start-send.recordsent"))));
  assert.ok(b.querySelector("svg use[href$='#i-outward']"), "the outward mark");
  assert.ok(drew(p, "screen.start-send.outward.says"));
  const r = await press(p, "filingrecordsent", { "send-at": "10 Nov", "send-account": "by hand" });
  assert.ok(beside(p, r).includes(norm(word("screen.start-send.sentat.needed"))));
  const r2 = await press(p, "filingrecordsent", { "send-at": "2026-11-10", "send-account": "" });
  assert.ok(beside(p, r2).includes(norm(word("screen.start-send.how.needed"))));
  assert.equal(p.byOp("filingrecordsent").length, 0, "nothing sent while refused in place");
  await press(p, "filingrecordsent", { "send-at": "2026-11-10", "send-account": "by the clerk's web form", "send-reference": "R-12" });
  const sent = last(p, "filingrecordsent").body;
  assert.equal(sent.filing, FILING); assert.equal(sent.at, "2026-11-10"); assert.equal(sent.account, "by the clerk's web form"); assert.equal(sent.reference, "R-12");
  assert.ok(drew(p, "screen.start-send.sent", { date: day("2026-11-10") }));
  assert.ok(drew(p, "screen.start-send.reference", { reference: "R-12" }));
});

test("R3: at the phone width the sending is read, not done: no button, what it does is drawn", async () => {
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])) }, boot: { phone: true } });
  assert.equal(button(p, "filingrecordsent"), null);
  assert.ok(drew(p, "act.filingrecordsent.does"));
});

test("R3 (join first): an invited member is told at the start, offered Join in place and none of the weighty acts; joined, the screen reads her place again and offers them", async () => {
  let place = "invited";
  const p = await open(STEP2, { plane: { projectlist: () => ok({ projects: [{ id: PROJECT, participation: place }] }),
    projectjoin: () => { place = "joined"; return ok({}); } } });
  assert.ok(drew(p, "screen.projectact.invited.head") && drew(p, "refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited"));
  assert.deepEqual(ops(p), ["projectjoin"]);
  const before = p.byOp("projectlist").length;
  await press(p, "projectjoin");
  assert.deepEqual(last(p, "projectjoin").query.projectId, PROJECT);
  assert.ok(p.byOp("projectlist").length > before, "her place is read again");
  assert.ok(!drew(p, "screen.projectact.invited.head"));
  assert.ok(ops(p).includes("communicationprepare") && ops(p).includes("filingprepare"));
});

test("R3 (join first): an invited member is offered no approval, second approval, sending or template keeping", async () => {
  const invited = ok({ projects: [{ id: PROJECT, participation: "invited" }] });
  for (const d of [DRAFT(), DRAFT({ approval: APPROVED }), DRAFT({ approval: APPROVED, second_needed: true })]) {
    const p = await open(STEP2, { plane: { projectlist: invited, filingsfor: ok(FILINGS([d])), filingread: ok(PREPARED()) } });
    assert.deepEqual(ops(p), ["projectjoin"]);
    assert.ok(drew(p, "screen.start-send.nosend"));
  }
});

test("R3 (join first, control): her place not read, or any state but invited, changes nothing", async () => {
  for (const projectlist of [refused("STORE_DID_NOT_ANSWER", null, 502), ok({ projects: [{ id: PROJECT, participation: "joined" }] }), ok({ projects: [] })]) {
    const p = await open(STEP2, { plane: { projectlist } });
    assert.ok(!drew(p, "screen.projectact.invited.head"));
    assert.ok(ops(p).includes("communicationprepare"));
  }
});

/* ---------- R11: a prepared draft is read again on load ---------- */

test("R11: prepare, reload, and the same text, blanks with their sources, unfilled blanks with why, her fills, the advisory and the offers are drawn; no prepare is sent on load", async () => {
  let drafts = [];
  const prepared = PREPARED({ text: "We ask for the minutes of 2025.", blanks: [{ name: "period", value: "2025", source: "fills:member:mai", label: { kind: "member_fill", by: "member:mai" } },
    { name: "office", value: "Town Clerk", source: ACTION }], unfilled: [{ name: "cost_limit", why: "The record holds no value for it." }],
    advisory: "A demand is a Tier 2 act: a lawyer's view helps.", offers: ["counsel_packet"], disclosure: { machine: false } });
  const first = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)), communicationprepare: () => { drafts = [DRAFT()]; return ok(prepared); } } });
  await press(first, "communicationprepare", { "send-text-0": "We ask for the minutes of {{period}}." });
  const before = first.doc.getElementById("send-text-1").value;
  const again = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)), filingread: ok(prepared), communicationprepare: ok(prepared), filingprepare: ok(prepared) } });
  assert.deepEqual(again.byOp("filingread").map((r) => r.query.filing), [FILING], "read once, the filing the action holds");
  assert.equal(again.doc.getElementById("send-text-1").value, before);
  assert.equal(before, "We ask for the minutes of 2025.");
  for (const [k, v] of [["screen.start-send.blank.own", { name: "period", value: "2025" }], ["screen.start-send.blank", { name: "office", value: "Town Clerk", source: ACTION }],
    ["screen.start-send.unfilled", { names: "cost_limit" }], ["screen.start-send.unfilled.why", { name: "cost_limit", why: "The record holds no value for it." }],
    ["screen.start-send.advisory", { advisory: "A demand is a Tier 2 act: a lawyer's view helps." }], ["screen.start-send.offer.counsel_packet", {}], ["screen.start-send.draft.own", {}]])
    assert.ok(drew(again, k, v), k);
  assert.ok(ops(again).includes("filingapprove"));
  assert.equal(again.byOp("communicationprepare").length + again.byOp("filingprepare").length, 0, "control: reading prepares nothing");
});

test("R11: NO_SUCH_FILING is drawn as \"Nothing is here\" and nothing is offered to approve; control: a draft already approved is not read", async () => {
  const gone = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: refused("NO_SUCH_FILING", "No such draft.", 404) } });
  assert.ok(drew(gone, "shell.unavailable.nothing"));
  assert.ok(!ops(gone).includes("filingapprove"));
  assert.equal(gone.byOp("communicationprepare").length + gone.byOp("filingprepare").length, 0);
  const approved = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])), filingread: ok(PREPARED()) } });
  assert.equal(approved.byOp("filingread").length, 0);
});

/* ---------- R21: the matter's stake at preparation, a prompt and never a gate ---------- */

const ASKED = (stake) => ({ filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED()), stakeatpreparation: stake });

test("R21: a Tier 2 action asks the question above the approval, with its says (the kind's words) and its help; no extra sentence while the tier is known", async () => {
  const p = await open(STEP2, { plane: ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 2 }))) });
  assert.equal(p.byOp("stakeatpreparation")[0].query.action, ACTION);
  assert.ok(drew(p, "stake.ask.title"));
  const kind = word("screen.start-send.kind.request_for_comment");
  assert.ok(drew(p, "stake.ask.says", { kind: kind.charAt(0).toUpperCase() + kind.slice(1) }), "the kind's start-send words, opening the sentence");
  assert.ok(drew(p, "stake.action.label"));
  const head = main(p).querySelectorAll("h2").find((h) => norm(h.textContent) === norm(word("stake.ask.title")));
  assert.ok(head && head.getAttribute("data-tip").includes(word("stake.ask.help")), "its help, that it never stops her");
  assert.ok(main(p).innerHTML.indexOf('id="action-stake"') < main(p).innerHTML.indexOf('data-act="filingapprove"'), "above the approval");
  assert.ok(!drew(p, "stake.ask.undetermined"));
  assert.ok(ops(p).includes("actionstake") && ops(p).includes("filingapprove"));
});

test("R28: the stake question names a grand jury referral by screen.start-send.kind.grand_jury", async () => {
  const p = await open(STEP2, { plane: { ...ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 2 }))), action: ok(ACT({ kind: "grand_jury" })) } });
  const kind = word("screen.start-send.kind.grand_jury");
  assert.ok(drew(p, "stake.ask.says", { kind: kind.charAt(0).toUpperCase() + kind.slice(1) }));
});

test("R21: an undetermined tier adds the extra sentence", async () => {
  const p = await open(STEP2, { plane: ASKED(ok(STAKE({ higher_stakes: true, governing_tier: "undetermined" }))) });
  assert.ok(drew(p, "stake.ask.title") && drew(p, "stake.ask.undetermined"));
});

test("R21 (control): a Tier 1 action draws \"Sent with\" (the team's name and statement) and \"In this matter\", and asks no question", async () => {
  const p = await open(STEP2, { plane: ASKED(ok(STAKE())) });
  assert.ok(drew(p, "stake.sentwith") && drew(p, "stake.inmatter") && drew(p, "stake.none"));
  assert.ok(text(p).includes("Lakeshore Tenants") && text(p).includes("We hold the city to its own rules."));
  assert.ok(!drew(p, "stake.ask.title"));
  assert.ok(!ops(p).includes("actionstake"));
  const q = await open(STEP2, { plane: ASKED(ok(STAKE({ matter_stake: { stake: "A member is a tenant.", set_by: "mai", set_at: "2026-11-01T09:00:00Z", source: "project" } }))) });
  assert.ok(text(q).includes("A member is a tenant."));
  assert.ok(drew(q, "stake.source.project", { who: "mai", date: day("2026-11-01") }));
});

test("R21: a stake that cannot be read says so, never none", async () => {
  const p = await open(STEP2, { plane: ASKED(ok(STAKE({ matter_stake: { stake: "undetermined" } }))) });
  assert.ok(drew(p, "stake.unreadable"));
  assert.ok(!drew(p, "stake.none"));
  assert.ok(ops(p).includes("filingapprove"));
});

test("R21: saving a stake sends actionstake with the action and her words, and the stake is read again", async () => {
  const p = await open(STEP2, { plane: { ...ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 2 }))), actionstake: ok({}) } });
  const before = p.byOp("stakeatpreparation").length;
  await press(p, "actionstake", { "action-stake": "  A member is a party.  " });
  assert.deepEqual({ ...last(p, "actionstake").body, reason: undefined }, { target: ACTION, stake: "A member is a party.", reason: undefined });
  assert.ok(p.byOp("stakeatpreparation").length > before);
});

test("R21: nothing waits on the question: approving with it unanswered lands, and no stake is recorded", async () => {
  let drafts = [DRAFT()];
  const p = await open(STEP2, { plane: { ...ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 3 }))), filingsfor: () => ok(FILINGS(drafts)),
    filingapprove: () => { drafts = [DRAFT({ approval: APPROVED })]; return ok({ filing: FILING }); } } });
  await press(p, "filingapprove");
  assert.equal(p.byOp("filingapprove").length, 1);
  assert.equal(p.byOp("actionstake").length, 0, "no answer recorded");
  assert.ok(ops(p).includes("filingrecordsent"));
  const empty = await open(STEP2, { plane: ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 2 }))) });
  await press(empty, "actionstake");
  assert.equal(empty.byOp("actionstake").length, 0, "an empty save where the action holds none sends nothing");
});

test("R21: MACHINE_CANNOT_SET_STAKE and STAKE_MALFORMED are drawn by their words beside the act", async () => {
  for (const [code, key] of [["MACHINE_CANNOT_SET_STAKE", "refusal.MACHINE_CANNOT_SET_STAKE"], ["STAKE_MALFORMED", "refusal.STAKE_MALFORMED.action"]]) {
    const p = await open(STEP2, { plane: { ...ASKED(ok(STAKE({ higher_stakes: true, governing_tier: 2 }))), actionstake: refusedIn(code, "the owner's own sentence") } });
    const b = await press(p, "actionstake", { "action-stake": "a stake" });
    assert.ok(beside(p, b).includes(norm(word(key))), code);
  }
});

/* ---------- R41: the door to the risk tier ---------- */

test("R41: FILING_TIER_UNDETERMINED draws its words and, beside them, the door to the action's risk tier", async () => {
  const p = await open(STEP2, { plane: { filingprepare: refused("FILING_TIER_UNDETERMINED", "x", 400, { action: ACTION }) } });
  const b = await press(p, "filingprepare");
  assert.ok(beside(p, b).includes(norm(word("refusal.FILING_TIER_UNDETERMINED"))));
  const door = p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"] a.cs-ref`);
  assert.ok(door, "the door is drawn");
  assert.equal(door.getAttribute("href"), `/app/action/${ACTION}`);
  assert.ok(norm(door.textContent).includes(norm(word("screen.start-send.risk.door"))));
});

test("R41 (control): no refusal draws no door; another refusal draws none either", async () => {
  const p = await open(STEP2, { plane: { filingprepare: ok(PREPARED()) } });
  await press(p, "filingprepare");
  assert.ok(!drew(p, "screen.start-send.risk.door", {}, p.root()));
  const q = await open(STEP2, { plane: { filingprepare: refused("TEMPLATE_NOT_NAMED", "x", 400, { action: ACTION }) } });
  await press(q, "filingprepare");
  assert.ok(!drew(q, "screen.start-send.risk.door", {}, q.root()));
});

/* ---------- R42: approving answers each sentence it points out ---------- */

const POINTED = ["The council broke the lease rule.", "The clerk hid the minutes."];

test("R42: a refusal pointing out sentences draws one choice each, and the resend carries resolutions of the declared shape", async () => {
  let n = 0;
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED({ text: POINTED.join(" ") })),
    filingapprove: () => (n++ === 0 ? refused("ASSERTION_UNRESOLVED", "x", 400, { filing: FILING, sentences: POINTED.map((text, index) => ({ index, text })) }) : ok({ filing: FILING })) } });
  await press(p, "filingapprove");
  assert.ok(text(p, p.root()).includes(norm(word("refusal.ASSERTION_UNRESOLVED"))));
  for (const s of POINTED) assert.ok(text(p).includes(s));
  assert.ok(p.doc.getElementById("assert-words-0") && p.doc.getElementById("assert-words-1"), "one choice per sentence");
  const breach = p.doc.querySelectorAll('input[name="assert-pick-1"]').find((i) => i.getAttribute("value") === "breach_claim");
  breach.checked = true;
  await press(p, "filingapprove", { "assert-words-0": "We only ask\n whether   it was followed." });
  assert.deepEqual(last(p, "filingapprove").body.resolutions, [{ sentence: POINTED[0], resolution: "only_asks", words: "We only ask whether it was followed." },
    { sentence: POINTED[1], resolution: "breach_claim" }]);
});

test("R42: the words that it only asks are sent on one line of at most 500 characters", async () => {
  let n = 0;
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED({ text: POINTED[0] })),
    filingapprove: () => (n++ === 0 ? refused("ASSERTION_UNRESOLVED", "x", 400, { filing: FILING, sentences: [{ index: 0, text: POINTED[0] }] }) : ok({ filing: FILING })) } });
  await press(p, "filingapprove");
  await press(p, "filingapprove", { "assert-words-0": "a".repeat(600) });
  const r = last(p, "filingapprove").body.resolutions[0];
  assert.equal(r.words.length, 500);
});

test("R42 (control): an approval not refused sends the filing alone", async () => {
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED()), filingapprove: ok({ filing: FILING }) } });
  await press(p, "filingapprove");
  assert.deepEqual(last(p, "filingapprove").body, { filing: FILING });
});

test("R42: a contradicted sentence is drawn with a reason and a tick; a tick with no reason is refused in place; the resend carries release, and the landing says who released what", async () => {
  let n = 0;
  let drafts = [DRAFT()];
  const p = await open(STEP2, { plane: { filingsfor: () => ok(FILINGS(drafts)), filingread: ok(PREPARED({ text: POINTED[1] })),
    filingapprove: (req) => {
      if (n++ === 0) return refused("CONTRADICTED_HELD", "x", 400, { filing: FILING, sentences: [{ index: 3, text: POINTED[1] }] });
      drafts = [DRAFT({ approval: APPROVED })];
      return ok({ filing: FILING, released: (req.body.release || []).map((r) => ({ ord: r.ord, reason: r.reason })) });
    } } });
  await press(p, "filingapprove");
  assert.ok(text(p, p.root()).includes(norm(word("refusal.CONTRADICTED_HELD"))));
  assert.ok(drew(p, "screen.start-send.release.head") && drew(p, "pointer.record.contradicted") && text(p).includes(POINTED[1]));
  const tick = p.doc.querySelectorAll('input[name="release-pick-3"]')[0];
  tick.checked = true;
  const b = await press(p, "filingapprove");
  assert.ok(beside(p, b).includes(norm(word("shell.reason.needed"))));
  assert.equal(p.byOp("filingapprove").length, 1, "refused in place: nothing sent");
  p.doc.querySelectorAll('input[name="release-pick-3"]')[0].checked = true;
  await press(p, "filingapprove", { "release-why-3": "The minutes were corrected later." });
  assert.deepEqual(last(p, "filingapprove").body.release, [{ ord: 3, reason: "The minutes were corrected later." }]);
  // the day is the page's clock, the day of the run
  assert.ok(drew(p, "screen.start-send.release.done", { who: "mai", date: day(new Date().toISOString()), reason: "The minutes were corrected later." }));
});

/* ---------- R48: an approved filing kept as the team's template ---------- */

test("R48: \"Keep this filing as your team's template\" is offered once the filing is approved and not before", async () => {
  const before = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED()) } });
  assert.ok(!ops(before).includes("templatesave") && !drew(before, "screen.start-send.template.heading"));
  const none = await open(STEP2);
  assert.ok(!ops(none).includes("templatesave"));
  for (const d of [DRAFT({ approval: APPROVED }), DRAFT({ approval: APPROVED, sending: { ord: 1, sent_on: "2026-11-10" } })]) {
    const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([d])) } });
    assert.ok(ops(p).includes("templatesave") && drew(p, "screen.start-send.template.heading"));
    assert.deepEqual(options(p, "template-use").map((o) => o.value), ["file", "brief"]);
  }
});

test("R48: keeping sends the approved filing, its name, its use, the project and the notes", async () => {
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])), templatesave: ok({ ok: true }) } });
  await press(p, "templatesave", { "template-name": "Lease questions", "template-use": "brief", "template-notes": "For a records follow-up." });
  assert.deepEqual({ ...last(p, "templatesave").body, reason: undefined }, { filing: FILING, name: "Lease questions", use: "brief", project: PROJECT, notes: "For a records follow-up.", reason: undefined });
});

test("R48: a filing that needs counsel first (tier 3) is offered only as a brief", async () => {
  for (const plane of [{ action: ok(ACT({ risk_tier: 3 })) }, { stakeatpreparation: ok(STAKE({ governing_tier: 3 })) }, { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED, tier: 3 })])) }]) {
    const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])), templatesave: ok({ ok: true }), ...plane } });
    assert.deepEqual(options(p, "template-use").map((o) => o.value), ["brief"]);
    await press(p, "templatesave", { "template-name": "Counsel brief" });
    assert.equal(last(p, "templatesave").body.use, "brief");
  }
});

test("R48: a name missing or over 200 characters is refused in place by TEMPLATE_NAME_REFUSED's words, nothing sent; the plane's TEMPLATE_* refusals are drawn by their words", async () => {
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])) } });
  for (const name of ["", "x".repeat(201)]) {
    const b = await press(p, "templatesave", { "template-name": name });
    assert.ok(beside(p, b).includes(norm(word("refusal.TEMPLATE_NAME_REFUSED"))));
  }
  assert.equal(p.byOp("templatesave").length, 0);
  const at200 = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])), templatesave: ok({ ok: true }) } });
  await press(at200, "templatesave", { "template-name": "x".repeat(200) });
  assert.equal(at200.byOp("templatesave").length, 1, "the bound itself is accepted");
  for (const code of ["TEMPLATE_NAME_TAKEN", "TEMPLATE_TIER3_FILE"]) {
    const q = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT({ approval: APPROVED })])), templatesave: refusedIn(code, "the owner's sentence") } });
    const b = await press(q, "templatesave", { "template-name": "Lease questions" });
    assert.ok(beside(q, b).includes(norm(word("refusal." + code))), code);
  }
});

/* ---------- R49: each exhibit's grade against what the venue accepts ---------- */

test("R49: each exhibit draws its grade and one of accepted, contestable, below or not determined; a flagged exhibit leaves \"Approve this text\" offered", async () => {
  const ex = (locator, grade, state) => ({ locator, sha256: "ab", captured_at: "2026-10-01T09:00:00Z", grade: grade ? { grade } : null, venue: state ? { state } : null });
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED({ exhibits: [ex("minutes.pdf", "A", "accepted"),
    ex("photo.jpg", "C", "contestable"), ex("memo.txt", "D", "below"), ex("note.txt", null, null)] })) } });
  assert.ok(drew(p, "screen.start-send.exhibits.heading"));
  for (const k of ["screen.start-send.exhibits.accepted", "screen.start-send.exhibits.contestable1", "screen.start-send.exhibits.below1", "screen.start-send.exhibits.undetermined",
    "screen.start-send.exhibits.nograde"]) assert.ok(drew(p, k), k);
  for (const l of ["minutes.pdf", "photo.jpg", "memo.txt", "note.txt"]) assert.ok(text(p).includes(l), l);
  const approve = button(p, "filingapprove");
  assert.ok(approve && !approve.hasAttribute("disabled"), "a flagged exhibit stops nothing");
});

test("R49: a venue whose standard is not stated says so, and the grades still show", async () => {
  const p = await open(STEP2, { plane: { filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED({ venue_standard: { state: "undetermined" },
    exhibits: [{ locator: "minutes.pdf", grade: { grade: "B" }, venue: { state: "undetermined" } }] })) } });
  assert.ok(drew(p, "screen.start-send.exhibits.refused.summary") && drew(p, "screen.start-send.exhibits.refused.body2"));
  assert.ok(drew(p, "screen.start-send.exhibits.undetermined"));
});
