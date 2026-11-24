/* screens-action (T47-64; N897 (1); BIO_Action_v0_2.md rules 1–3, 6, 15, 18–21; DEC-89, DEC-113, DEC-115, DEC-194,
   DEC-209, DEC-212): the Action layer's working screens. The registry screens `plan`, `start-send`, `request`, `action`,
   `matter` and `help-records`, built to interface-shell R21's screen contract: each `{id, reads, render, acts, words}`,
   every function self-contained, every read and act an op through the shell. The member decides and sends; the group's
   Civicsmith proposes, prepares and records, and sends nothing. Pure: this module reads no table and writes nothing. */
import { SCREEN_WORDS, FIX } from "./words.mjs";
import { plan } from "./plan.mjs";
import { startSend } from "./start-send.mjs";
import { request } from "./request.mjs";
import { action } from "./action.mjs";
import { matter } from "./matter.mjs";
import { helpRecords } from "./help-records.mjs";
import { actionNew } from "./actionnew.mjs";
import { hold, holdNotice } from "./hold.mjs";
import { counsel } from "./counsel.mjs";
import { dashAction } from "./dash-action.mjs";

export { SCREEN_WORDS };

// The keys each screen draws beside its acts' labels and explanations (R19: keys only, read through `setup-words`).
const SHARED = ["state.loading", "state.empty", "state.failed", "shell.unread"];
// R21: the matter's stake on both preparation screens; the question and its refusals on `start-send` alone.
const STAKE_LINES = ["stake.sentwith", "stake.inmatter", "stake.source.project", "stake.source.action", "stake.none", "stake.unreadable", "stake.unreadable.summary"];
// G52 (K4686): the design's fold for a member invited and not yet joined (DEC-417), on the three screens that register `projectjoin`
const INVITED = ["screen.projectact.invited.head", "refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited"];
const STAKE_ASK = ["stake.ask.title", "stake.ask.says", "stake.ask.help", "stake.ask.undetermined", "stake.undetermined.summary", "stake.action.label", "stake.action.help",
  "stake.action.save", "refusal.MACHINE_CANNOT_SET_STAKE", "refusal.STAKE_MALFORMED.action"];
// An owed act is explained under its `owed_` key until its op is no longer owed (affordances R65).
const OWED = ["actionstake", "actioninquiry"];
const EXTRA = {
  plan: ["plan.offer.document", "plan.offer.document.means", "plan.offer.chancetofix", "plan.offer.chancetofix.means",
    "plan.offer.chancetofix.again", "plan.close.lessons", "mark.due.means"],
  "start-send": [...STAKE_LINES, ...STAKE_ASK, ...INVITED],
  request: ["screen.help-records.name", "screen.places.name", "screen.places.purpose", ...STAKE_LINES, ...INVITED],
  action: [...INVITED, "mark.due.means", "law.title", "law.help", "law.stated", "law.undetermined", "law.change", "law.proposed", "law.proposal.not", "law.propose",
    "risk.title", "risk.help", "risk.tier", "risk.tier.1", "risk.tier.2", "risk.tier.3", "risk.tier.undetermined", "risk.set", "risk.revise", "risk.proposed",
    "risk.proposal", "risk.proposal.not", "action.noreply.title", "action.noreply.says", "action.noreply.question", "action.noreply.question.help",
    "act.owed_actioninquiry.label.action", "refusal.ACTION_INQUIRY_NO_QUESTION", "refusal.ACTION_NO_PROJECT", "refusal.MACHINE_CANNOT_OPEN_FROM_ACTION",
    "screen.action.guide.heading", "screen.action.guide.order", "screen.action.guide.sourced", "screen.action.guide.team", "screen.action.guide.teamnone",
    "screen.action.guide.tip1", "screen.action.guide.tip2", "screen.action.templates.heading", "screen.action.templates.offered", "screen.action.templates.nocourt",
    "screen.action.templates.approved", "screen.action.templates.notyet", "screen.action.templates.own", "screen.action.templates.never", "screen.action.templates.tip1",
    "screen.action.templates.tip2", "screen.action.profilefact.from", "screen.action.profilefact.shown", "screen.action.legalmark", "screen.action.holdnone",
    "screen.action.hold.link", "screen.action.rule.link", "screen.action.held"],
  matter: [],
  "help-records": [],
  actionnew: ["screen.request.name", "screen.request.purpose", "screen.capture.saw.when", "screen.action.dates", "risk.tier.1", "risk.tier.2", "risk.tier.3", "risk.tier.undetermined",
    "screen.start-send.rests", "screen.plan.matter.n", "screen.action.kind.other", "refusal.ACTION_KIND_UNKNOWN", "refusal.ACTION_BASIS_REFUSED", "refusal.COUNTERPARTY_REFUSED",
    "refusal.CLOCK_REFUSED", "screen.start-send.draft.machine", "state.empty"],
  hold: ["act.actionholdrelease.label.hold", "act.actionholdrelease.does", "screen.action.pressure.kind", "screen.action.pressure.legal", "screen.action.pressure.retaliation", "screen.action.pressure.discrediting", "screen.action.pressure.other",
    "screen.start-send.draft.machine"],
  holdnotice: ["screen.holdnotice.how.email", "screen.holdnotice.how.message", "screen.holdnotice.how.person", "screen.holdnotice.how.other", "screen.start-send.sentat", "screen.start-send.how", "screen.start-send.outward", "screen.start-send.draft.template", "screen.start-send.draft.machine", "shell.unavailable.nothing"],
  counsel: ["screen.person.kind.name", "screen.people.kind.organization"],
  "dash-action": ["home.needsyou.title", "screen.action.kind.other", "screen.plan.matter.n", "screen.actionnew.name", "screen.queue.reminder.on", "act.reminderanswer.label.dash-action",
    "act.filingapprove.label.dash-action", "act.actioncreate.label.dash-action", "act.reminderanswer.does", "act.taskresolve.does"],
};
// Keys a screen draws under another screen's prefix (one sentence, one key, wherever it is drawn).
const BORROWS = {
  plan: ["screen.matter.stage."],
  "start-send": ["screen.plan.support.", "screen.request.", "screen.start-send."],
  actionnew: ["screen.action.kind."],
  "dash-action": ["screen.action.kind."],
  request: ["screen.start-send."],
  action: ["screen.plan.actionstate.", "screen.request.holder", "screen.request.level", "screen.request.window.", "screen.request.law", "screen.action.kind.",
    "screen.start-send.kind."],
  "help-records": ["screen.request.window."],
};
const SHARED_OWN = {
  action: ["act.communicationprepare.label.request", "guide.procedure.legalinfo", "screen.question.name", "action.noreply.question.label",
    "action.noreply.question.field.help", "screen.action.ask.heading", "screen.action.ask.done", "screen.action.pressure.kind"],
  request: ["act.filingrecordsent.does", "screen.request.other", "screen.request.other.go", "screen.actionnew.name", "screen.actionnew.purpose"],
  plan: ["act.plansubjectadd.label.plan", "act.plansubjectadd.does", "act.planask.does"],
  "start-send": ["act.filingrecordsent.does"],
};

const wordsOf = (s) => {
  const id = s.id;
  const own = SCREEN_WORDS.filter((k) => k.startsWith(`screen.${id}.`) || (BORROWS[id] || []).some((p) => k.startsWith(p))
    || (SHARED_OWN[id] || []).includes(k));
  const noun = s.acts.length ? `shell.readonly.noun.${id}` : null;
  const acts = s.acts.flatMap((a) => [a.label || `act.${a.op}.label.${id}`, OWED.includes(a.op) ? `act.owed_${a.op}.does` : `act.${a.op}.does`]);
  return Object.freeze([...new Set([...SHARED, ...(noun ? [noun] : []), `screen.${id}.name`, `screen.${id}.purpose`, ...acts, ...EXTRA[id], ...FIX.flatMap((f) => f.EXTRA[id] || []), ...own])]);
};

/** The screens, in the order a member meets them: the plan, starting and sending, a records request, one action, one matter, the
 *  records request's help, then (T51) the composer, the litigation hold and its notice, counsel and the dashboard. */
export const SCREENS = Object.freeze([plan, startSend, request, action, matter, helpRecords, actionNew, hold, holdNotice, counsel, dashAction].map((s) => Object.freeze({ ...s, words: wordsOf(s) })));
