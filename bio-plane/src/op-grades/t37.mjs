/* op-grades — R27 (N757, N776, N669, N708; DEC-157, DEC-180, DEC-182; K2171, K2200, K2201; T37): THE OPS T37 DECLARES
 * (`op-declarations`' T37 requirements) — `case-carriage`'s photo marks (DEC-180), `credentials`' own password change
 * (DEC-182 (4)) and a member's own Claude subscription sign-in (`agent-worker` R66), and `instance-setup`'s translation of
 * the interface (DEC-157) — graded by R5 and R3 with `affordances` R12's totality holding over them, each grade read from
 * its owner's requirements as R13, R17, R22 and R23–R25 do. Data only: no op's behaviour is decided here (P6).
 * `./index.mjs` spreads the three tables into `RUNGS`, `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the
 * spread closes no cycle. None of these ops is in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5,
 * `affordances` R20): `case-carriage` (`MACHINE_CANNOT_MARK_PHOTO`, its own code since T38, K2311), `credentials`
 * (`MACHINE_CANNOT_SET_PASSWORD`) and `instance-setup` (`MACHINE_CANNOT_TRANSLATE`) refuse a machine themselves. No
 * consequence statement, vocabulary or prompt is added. `subscriptionsignin` had no op and no grade in T35 (`./t35.mjs`);
 * it is graded here. (T38; R28) `obscuremark` left `T37_RUNG_ABSENT`: a withdrawal (`obscuremarkwithdraw`) takes a mark
 * back, so `./t38.mjs` grades it `reversible`; its reason stays here. */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const TRANSLATION_WORD = "translation-directed: keyed by a language and an interface word; the group's own wording of "
  + "Civicsmith's words, shown to members reading that language; moves no bundle";

/* ---- the rungs. instance-setup R70–R72 (DEC-157 (5)): an administrator's one-act undo (`translationrevert`) takes an
   adoption or a confirmation back, and a later adoption takes an undo back; none asks a reason, so each is `reversible`
   on R3's rule. The protected words' second check (DEC-157 (4)) is instance-setup's refusal, not a rung. ---- */
export const T37_RUNGS = {
  translationadopt:   "reversible", // instance-setup R70: taken back by translationrevert (R72)
  translationconfirm: "reversible", // instance-setup R71: taken back by translationrevert (R72)
  translationrevert:  "reversible", // instance-setup R72: an undo, itself taken back by a later adoption (R70)
};

/* ---- the stated absences ---- */
export const T37_RUNG_ABSENT = {
  /* `obscuremark` (case-carriage R9) stood here, `undetermined` on R3's rule, until T38: R28 moves it to `RUNGS`
     (`./t38.mjs`) as `reversible`, a withdrawal (case-carriage R14) taking a mark back */
  /* credentials R3 (DEC-182 (4)), as signout and signouteverywhere: the caller's own */
  setpassword:        { ground: "caller-owned", is: "a signed-in member or administrator changes their own password, the role from their own session, ending their other sessions (credentials R3)" },
  /* credentials R43, agent-worker R66, as subscriptiondisconnect: no login is held here */
  subscriptionsignin: { ground: "credential", is: "a member signs in to their own Claude subscription in their own runner; the sign-in lives there, and no login, code or token is held here (credentials R43, agent-worker R66)" },
  /* instance-setup R69 (DEC-157 (1)), as wizardeditorgrant and wizardeditorrevoke */
  translationgrant:   { ground: "credential", is: "an administrator grants a named member the right to translate the interface into one language, or revokes it, a revocation appended (instance-setup R69)" },
  /* instance-setup R67 (K2201): drafts are labelled machine work, append-only, never the group's wording until a member
     adopts one; `to_english` (an administrator's only) adopts and confirms nothing. (R39, T48; N1042) It left
     `undetermined` for `caller-owned`: a granted speaker's own request, asking no reason. */
  translationdraft:   { ground: "caller-owned", is: "a granted speaker's own request for labeled machine drafts of missing words of a language, never the group's wording until a member adopts one, or an administrator's own back-translation of one protected word, adopting nothing; asks no reason (instance-setup R67)" },
  /* instance-setup R73 (DEC-157 (5)), on R3's rule */
  translationmark:    { ground: "undetermined", is: "a member marks a shown word's translation \"this translation looks wrong\", with an optional note; asks no reason, and no act takes it back, a mark staying open until the word's next adoption or undo (instance-setup R73)" },
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T37_NON_ACTS = {
  obscuremark: "photo-directed: keyed by a photo's capture, reached from the Photos step; a member's mark of areas to "
    + "obscure in the published copy; withdrawn only by a reasoned act, never erased (R28); moves no bundle",
  setpassword: "session-directed: the caller's own password, the role from their session; ends their other sessions; "
    + "moves no bundle",
  subscriptionsignin: "credential: a member's own sign-in to their own Claude subscription, in their own runner; no login "
    + "held here; moves no bundle",
  translationgrant: "setting: a named member's grant for one language, an administrator's act; moves no bundle",
  translationdraft: "translation-directed: keyed by a language and interface words; drafts labeled machine work for a "
    + "granted speaker to check (`to_language`), or an administrator's back-translation of one protected word that "
    + "writes nothing (`to_english`); moves no bundle",
  translationadopt: word("translations.declared.translationadopt"),
  translationconfirm: word("translations.declared.translationconfirm"),
  translationrevert: word("translations.declared.translationrevert"),
  translationmark: TRANSLATION_WORD,
  photomarks: R("a photo's marks, oldest first, its state (marked, nothing to obscure or unchecked) and its current "
    + "obscured copy, to a member who may see it"),
  translations: R("every interface word in a language with its state, its shown or awaiting text and who kept it, its "
    + "drafts, adoptions, confirmations, undos and open marks, and the place's local names, to a granted speaker"),
  interfacewords: R("every interface word in a language, the group's shown translation or the English, never blank, with "
    + "the English beside it"),
};
