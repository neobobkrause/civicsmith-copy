/* op-grades — R36 (T47; R32's pattern; N972, N974–N977, N969, N955), R37 (T47's L11 fold, K3100; DEC-201, DEC-202,
 * DEC-205, DEC-207; K3061 D3) and K3104: EVERY OP T47'S OWNERS ADD, graded by R5 and R3 with `affordances` R12's totality
 * holding over them, each grade read from its owner's requirements and merged code as R13, R17 and R22–R33 do:
 * `project-roster`'s project list, `basis-versions`' project questions, `citation`'s drawn question, `strength`'s
 * project bar, `monitoring`'s watch, `credentials`' lock, password asked again and reset link, `instance-setup`'s logo
 * and languages, `tasks`' request to sign, the sign-in door's trace and `people`'s directory. Data only: no op's
 * behaviour is decided here (P6).
 *
 * `./index.mjs` spreads the three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the
 * spread closes no cycle. None of these ops is in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5,
 * `affordances` R20): each owner refuses a machine by its own code (`strength` C-32.9, `monitoring`
 * `MACHINE_CANNOT_SET_MONITORING`, `tasks` `MACHINE_CANNOT_ASK_SIGN`). Every op here, read or write, carries a `NON_ACTS`
 * row, so `op-declarations` gives each a `NEEDS` row (a present `null` for the public and session-own ones, K516's
 * precedent, as `recover`'s). No vocabulary, prompt, consequence statement or Irreversible weight is added. By R18
 * `phone` follows the rung or ground: the `credential` ones answer false (advisory; nothing refuses by device).
 *
 * `passwordresetlink` is held on the `credential` ground of the reset it opens, as `recover`: `credentials` R69 asks no
 * reason, so no code would back a `reasoned` rung (`affordances` R19; R37 as K3144 words it).
 * N955 adds no op: `credentials`' `aiRunCredentialMint` is in-plane and the door's op stays `airundispatch` (R33). */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const GROUP_SETTING = (s) => `setting: ${s}; an administrator's act, a later one replacing it; moves no bundle`;
const SESSION_OWN = (s) => `session-directed: ${s}; moves no bundle`;
const RESET = (s) => `credential: ${s}; moves no bundle`;

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T47_RUNGS = {
  /* R36. citation R14: no reason is asked (its `note` is a note's shape, BAD_NOTE, not a reason), and a published act
     (`sever`, citation R4) takes the edge back, as `cite` */
  drawquestion:      "reversible", // sever takes the drawn `cites` edge back
  /* strength R40: refused without its reason PROJECT_BAR_NO_REASON (C-107.4); a later set supersedes it on read */
  projectbarset:     "reasoned",   // PROJECT_BAR_NO_REASON (strength R40)
  /* monitoring R74: a later monitorset takes it back, and it asks no reason */
  monitorset:        "reversible", // a further monitorset sets it again
  /* R37. instance-setup R84, R85: a later set replaces each (`null` clears the logo), and neither asks a reason */
  grouplogoset:      "reversible", // a further grouplogoset replaces or clears it
  grouplanguagesset: "reversible", // a further grouplanguagesset replaces it
  /* tasks R19: no reason is asked; the owner's resolution of the To do takes the request back (or the edition's signing
     ends it) */
  signrequest:       "reversible", // the owner resolves the To do it put in their queue
};

/* ---- the stated absences ---- */
export const T47_RUNG_ABSENT = {
  /* R37. credentials R65, R66, R71: who may act in the session, as setpassword's subject sits beside recover */
  unlock:            { ground: "credential", is: "a member clears the lock on their own locked session with their password, counted under the sign-in window; a wrong password leaves it locked (credentials R65, R71)" },
  reauth:            { ground: "credential", is: "a member gives their password again, opening five minutes in which their session may sign or publish a case, change administrators or connect Claude; it also clears a lock (credentials R66, R71)" },
  /* credentials R69, R71 (6): the reset link and the reset, as recover and recoverycodesissue */
  passwordresetlink: { ground: "credential", is: "an administrator makes one live reset link for an active member, ending any earlier one, live for seven days and answered once, never stored in clear (credentials R69)" },
  passwordreset:     { ground: "credential", is: "a reset link and a new password, reached with no session, set the member's password, end every session of theirs and spend the link (credentials R69)" },
};

/* ---- every op's NON_ACTS reason (R5; R32: a read "read: …") ---- */
export const T47_NON_ACTS = {
  /* R36 */
  projectlist: R("the projects of the group the viewer may see, each with its question count and stage (project-roster "
    + "R26)"),
  projectquestions: R("the questions one project draws on, as the viewer may see them, paged (basis-versions R50)"),
  drawquestion: "project-directed: keyed by a project and one question; draws the question into the project as a "
    + "confirmed `cites` edge and promotes the project; moves the project's bundle",
  projectbarset: word("strength.declared.projectbarset"),
  monitorset: "bundle-directed: whether a captured document is watched, and how often; a member's own revision of the "
    + "bundle; fetches nothing",
  /* R37 */
  unlock: SESSION_OWN("the caller's own locked session, cleared with their password"),
  reauth: SESSION_OWN("the caller's own session, its password asked again for five minutes"),
  passwordresetlink: RESET("an administrator's reset link for one member, answered once"),
  passwordresetlook: R("whether a reset link is live, one answer for every dead arm; public, reached with no session"),
  passwordreset: RESET("a reset link and a new password, reached with no session"),
  grouplogoset: GROUP_SETTING("the group's logo, PNG or JPEG, or none"),
  grouplanguagesset: GROUP_SETTING("the languages the group works in"),
  grouplanguages: R("the languages the group works in, or the active profiles' while none is set; public, no "
    + "credential"),
  signrequest: "case-directed: keyed by a prepared case edition; a member asks its project's owners to sign it, each "
    + "given a To do; moves no bundle",
  signintrace: R("the sign-in door's last trace lines on a test instance, to an administrator, never a token, secret "
    + "or code"),
  /* K3164 (AFFORDANCES #32 J7): two publish-screen ops K3041 put in SESSION_OPS.member, by R5's rule; their grades stay
     (`statementack` reasoned, `reviewcomment` reversible, R1) */
  statementack: "case-directed: keyed by a case edition; a member acknowledges what the case does not cover",
  reviewcomment: "review-directed: keyed by a review copy; a reader's comment for the case's owner",
  /* K3104 (people R37) */
  peopledirectory: R("the people and organisations the record follows, each with what the viewer may see naming it, "
    + "never the group's members"),
};
