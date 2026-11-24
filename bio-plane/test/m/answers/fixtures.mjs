/* answers' published fixtures (K4990, K4993, K4995, K5044): what answers answers to a caller that asks for an ask's
   account whose limits cannot be read, or that ends a standing question, made by answers' own code over its test world
   when the test runs and never stored. A user's test takes the answer from here and does not write it by hand. Each is
   called by a test of answers' own, `fixtures.test.mjs`, which checks the real answer. */
import { answersOps } from "../../../src/answers/index.mjs";
import { answersWorld, V } from "./fixture.mjs";

/* `askAccount` for a member served by an account whose paying limits cannot be judged (no `useCheck`): the refusal
   `{ok: false, reason: "LIMITS_UNREADABLE", detail}`, writing nothing (R30). */
export async function limitsUnreadable({ member = "bob" } = {}) {
  const w = answersWorld();
  const set = await w.accounts.accountReferenceSet({ member, kind: "apikey", secret: "sk-fixture-limits", by: V(member) });
  if (!set.ok) throw new Error(`limitsUnreadable: ${set.reason}`);
  w.a.deps.useCheck = null;
  return w.a.askAccount({ member: V(member) });
}

/* The standing questions' refusals, each from `answers`' own act (R16, R34): `noSuch` the end of a question that is not
   the author's (NO_SUCH_STANDING_QUESTION), for `standingQuestionEnd` and for `standingQuestionEndSet`; `ended` the
   end date asked of a question its author ended (STANDING_ENDED); `ending` the end act's own ok answer. */
export function standingQuestions({ author = V("bob"), other = V("carol") } = {}) {
  const w = answersWorld();
  const q = w.a.standingQuestionSet({ author, question: "Anything new on the budget?", query: "title:budget",
                                      cadence: "daily", ends: "2026-12-31" });
  if (!q.ok) throw new Error(`standingQuestions: ${q.reason}`);
  const noSuch = w.a.standingQuestionEnd({ id: q.id, author: other });
  const noSuchEndSet = w.a.standingQuestionEndSet({ id: q.id, ends: "2027-01-31", author: other });
  const ending = w.a.standingQuestionEnd({ id: q.id, author });
  const ended = w.a.standingQuestionEndSet({ id: q.id, ends: "2027-01-31", author });
  return { id: q.id, noSuch, noSuchEndSet, ending, ended };
}

/* `standingAnswersFor` for `member` (R20): one standing question of theirs whose run found `finds` (a document, its text
   and title) while the copy's AI switch was off, so the run is held back (R19: `held_back` `{condition: "switch_off",
   switch: "copy"}`) and its entry carries no answer. Made by answers' own acts: the question set by `member`, a first run
   (it finds nothing), the document captured, the switch turned off by an administrator, then the run that finds it. */
export async function standingAnswersHeldBack({ member = "bob", finds = "Budget held" } = {}) {
  const w = answersWorld();
  const author = V(member);
  const q = w.a.standingQuestionSet({ author, question: "Anything new on the budget?", query: "title:budget",
                                      cadence: "daily", ends: "2026-12-31" });
  if (!q.ok) throw new Error(`standingAnswersHeldBack: ${q.reason}`);
  await w.a.standingTick(w.clock.now);
  w.document(finds, { title: `Budget ${finds}` });
  const off = w.a.standingAiSwitch({ on: false, by: V("alice") });
  if (!off.ok) throw new Error(`standingAnswersHeldBack: ${JSON.stringify(off)}`);
  w.at("2026-10-06T15:00:00.000Z");
  const run = (await w.a.standingTick(w.clock.now)).ran.find((x) => x.id === q.id);
  if (!run || run.new_found !== true) throw new Error(`standingAnswersHeldBack: the run found nothing: ${JSON.stringify(run)}`);
  return w.a.standingAnswersFor({ member: author });
}

/* `ruleservicesstate` (R7; K5131) as a member reads it: `{ok: true, on}`. A fresh team's rule services are off (K1505 (14));
   `on: true` is the state after the administrator's switch, made by answers' own act. */
export function ruleServicesState({ on = false } = {}) {
  const w = answersWorld({ rules: false });
  const url = (viewer) => new URL(`https://plane.test/?${new URLSearchParams({ viewer })}`);
  if (on) {
    const sw = answersOps(w.a, url(V("alice")), { on: true }).ruleservicesswitch();
    if (!sw.ok) throw new Error(`ruleServicesState: ${sw.reason}`);
  }
  return answersOps(w.a, url(V("bob")), {}).ruleservicesstate();
}
