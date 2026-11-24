/* answers' ops map: route arms keyed by op name, each a function of no arguments answering what its service answers.
 * The stamps (`viewer`, `by`, and the grant an ask reads under) are the control plane's, read from `url`'s query, never
 * from the body; an act's arguments are read from the body. Which credential reaches each op is `op-declarations`'. */

import { localize } from "../setup-words/index.mjs";

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const q = (url, k) => (url && url.searchParams ? url.searchParams.get(k) : null);

export function answersOps(a, url, body) {
  const b = plain(body) ? body : {};
  const viewer = q(url, "viewer");
  const grant = q(url, "grant");
  return {
    /* R7: the door to every rule service (ASK_SCOPE's `rule`); R35: the grant's use is the control plane's stamp
       (`use`, `draft` for a draft's grant), read from the query only, never the body */
    rule: () => a.ruleAnswer({ service: q(url, "service") ?? b.service ?? null, args: plain(b.args) ? b.args : {},
                               at: q(url, "at") ?? b.at ?? null, viewer, grant, use: q(url, "use") ?? "ask" }),
    /* R4: an answer checked against the grant's read log before it is shown */
    answercheck: () => a.check({ answer: b.answer ?? null, grant, viewer, mode: "ask" }),
    /* R13 */
    asktallies: () => a.tallies({ viewer, from: q(url, "from") ?? b.from ?? null, to: q(url, "to") ?? b.to ?? null }),
    /* R7 (K5131): the switch's state, a read any signed-in member may make */
    ruleservicesstate: () => a.ruleServicesState(),
    ruleservicesswitch: () => a.ruleServicesSwitch({ on: b.on === true, by: viewer }),
    /* R15–R20, R34 */
    /* R15, R28: a saved query or a find (`{scope, kinds, term?}`, as `retrieval.findIn` takes them) */
    standingset: () => a.standingQuestionSet({ author: viewer, owner: q(url, "owner"), question: b.question ?? null,
                                                query: b.query ?? null, find: b.find ?? null, cadence: b.cadence ?? null,
                                                ends: b.ends ?? null }),
    standing: () => (q(url, "id") ?? b.id ? a.standingQuestionRead({ id: q(url, "id") ?? b.id, viewer })
                                           : a.standingQuestionsOf({ viewer })),
    standingend: () => a.standingQuestionEnd({ id: q(url, "id") ?? b.id ?? null, author: viewer }),
    /* R34: the author changes the end date */
    standingendset: () => a.standingQuestionEndSet({ id: q(url, "id") ?? b.id ?? null, ends: b.ends ?? null, author: viewer }),
    standinganswers: () => a.standingAnswersFor({ member: viewer, after: q(url, "after") ?? b.after ?? null,
                                                  limit: q(url, "limit") ?? b.limit ?? null }),
    standingaiswitch: () => a.standingAiSwitch({ on: b.on === true, by: viewer }),
  };
}

/* R36 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  ruleanswer: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("answers.declared.ruleanswer", "read: one rule service's value with its basis, grade and label, or not held; writes nothing"),
    fields: { accepts: ["service","args","at"], requires: ["service"] } },
  ruleservicesstate: { classes: ["admin","member"], mutating: false, weight: "read", description: localize("answers.declared.ruleservicesstate", "read: whether the rule services are switched on, so a screen draws their control only while on; writes nothing"),
    fields: { accepts: [], requires: [] } },
  standingquestionset: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("answers.declared.standingquestionset", "personal state, keyed (member, STQ- id): a member's own standing question, seen only by them"),
    fields: { accepts: ["owner","question","query","find","cadence","ends"], requires: [["query","find"],"cadence","ends"] } },
  standingquestionend: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("answers.declared.standingquestionend", "personal state, keyed (member, STQ- id): a member ends their own standing question"),
    fields: { accepts: ["id"], requires: ["id"] } },
});
