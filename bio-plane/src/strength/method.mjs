/* strength's grading method, pure (requirements: `build/requirements/strength.md`, R1–R5, R29–R34; DEC-112 (2)(3)(6)):
 * one level of the walk composed from legs whose grades and inherited answers are already resolved, the judgement of
 * which legs credited anonymously something independent bears out, the method's version and its plain words, and the
 * recomputation of a pair from the facts a case file states. The live walk (`index.mjs`) resolves each leg against the
 * record and then composes here, and `recomputePair` resolves each leg from the case file's facts and composes here, so
 * a grade recomputes the same by construction (Publication §5C). Nothing here reads a store, writes, or throws on a
 * leg it cannot read: `case-checker` imports this file alone.
 *
 * EVERY `why` BELOW IS MEMBER-FACING (R28, D-269): no word of DEC-32 clause 1's family. */

import { TESTIMONY_GRADE } from "../record-grammar/grades.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { STRENGTH_AXES, DOCUMENT_AXES, DEPTH_BOUND, axisResult } from "./arithmetic.mjs";
import { DERIVED_KINDS, CAPTURE_ONLY_KINDS } from "./legs.mjs";

/** R31: the version of the grading arithmetic of R1–R5, R29, R30 (with R33's and R34's arms, as built in T28, and since
 *  T33 the calculation, standard and occurrence legs of R36–R38). It changes whenever any of them changes, and whenever
 *  the words of the method do (T51-54: "team" for the group that holds the case); a case states it (`case-grammar` R11)
 *  and a checker recomputes at it. */
export const GRADING_METHOD_VERSION = "bio-grading/5";
/* The version T28 published: R1–R5, R29–R34, with no calculation, standard or occurrence leg. */
const V1 = "bio-grading/1";
/* The version T33 published: V1 with the calculation, standard and occurrence legs; its words say "group". */
const V2 = "bio-grading/2";
/* The version T51-54 published: V2 with the team named "team". */
const V3 = "bio-grading/3";
/* The version T51 published (K4213, R42): V3 with a cutting leg kept out of the parts. */
const V4 = "bio-grading/4";
/** R32: every version this module has published, oldest first; `recomputePair` answers for each. */
export const GRADING_METHOD_VERSIONS = Object.freeze([V1, V2, V3, V4, GRADING_METHOD_VERSION]);
/* R42 (K4213): the versions published before a cutting leg was kept out of the parts. Their arithmetic still counts it,
   so `recomputePair` at these versions counts it, as the version was published to. */
const BEFORE_CUTTING_LEGS = Object.freeze([V1, V2, V3]);

/** R29 (DEC-102): the credit levels a caller may state; the first two credit anonymously. */
export const CREDIT_LEVELS = Object.freeze(["group", "project", "cover", "name"]);
export const ANONYMOUS_LEVELS = Object.freeze(["group", "project"]);
export const NAMED_LEVELS = Object.freeze(["cover", "name"]);

/* R5: the sentence a hunch leg is named with, on every path. */
export const HUNCH_WHY = word("strength.hunch_why");
/* R29: the sentence an anonymous observation nothing independent stands beside is named with. It names no author. */
export const UNCORROBORATED_WHY = word("strength.uncorroborated_why");
/* R34: the same for a document whose off-the-record capture a member attests anonymously. It names no member. */
export const UNCORROBORATED_EVIDENCE_WHY = word("strength.uncorroborated_evidence_why");

/** R29, R34: the levels a caller gave, as a frozen map of observation id or capture SHA-256 → level, keeping only the
 *  entries naming a level of `CREDIT_LEVELS`; null when none was given (not an object), which is today's answer. */
export function levelsGiven(levels) {
  if (!levels || typeof levels !== "object" || Array.isArray(levels)) return null;
  return Object.freeze(Object.fromEntries(Object.entries(levels)
    .filter(([id, lv]) => id && CREDIT_LEVELS.includes(lv))));
}

const LEG_KINDS_V1 = Object.freeze(["document", "observation", "inquiry", "imported"]);
const LEG_KINDS = Object.freeze([...LEG_KINDS_V1, ...CAPTURE_ONLY_KINDS]);
/* A leg that inherits an answer (R2, R33): the target is a question or another group's finding, not a document. */
export const inheritsAnswer = (kind) => kind === "inquiry" || kind === "imported";

/* An inherited axis as the arithmetic reads it: an axis answer, or (R33) the per-axis pair an accepted edition
   publishes, a letter or `{state, grade}`. Absent or unreadable is unrated: an edition that publishes nothing on an
   axis is never stronger there than nothing (DEC-96 item 1). */
export function axisAnswerOf(a) {
  if (typeof a === "string") return GRADE_LETTERS.has(a) ? { state: "graded", grade: a } : { state: "unrated", grade: null };
  if (!a || typeof a !== "object") return { state: "unrated", grade: null };
  if (a.state === "undetermined") return { ...a, grade: null };
  if (GRADE_LETTERS.has(a.grade)) return { ...a, state: "graded" };
  return { ...a, state: "unrated", grade: null };
}
const GRADE_LETTERS = new Set(["A", "B", "C", "D"]);

/** ONE LEVEL OF THE WALK (R1–R5, R29, R33, R34): each leg a member of the axis its grade names, each inheriting leg
 *  contributing its target's answer per axis, never crossed. `legs` are `{ord, target_id, role, grade, grade_axis,
 *  grade_source, ground}`; `opts`:
 *    kindOf(leg)            one of `LEG_KINDS`
 *    capCapture(leg, stated) `{grade, why}` bounding a stated capture letter by what the record earns (R1), or null
 *    inherit(leg)           for an inheriting leg: `{pair, from, another_groups?, through?}` (the target's answer) or
 *                           `{stopped: why, unknown?}` (the walk could not finish it, R2, R33)
 *    derive(leg)            for a calculation or occurrence leg (R36, R38): `{grade, why}` on the capture axis, or
 *                           `{stopped: why}` when its derivation is undetermined
 *    anonymous              Map of leg index → `{corroborated, kind}` (R29, R34)
 *    bound                  the depth bound stated in the answer
 *    cuttingFolds           R42: true to count a leg that cuts against the finding as the versions before
 *                           `bio-grading/4` did; false (the default) to keep it out of the parts and report it beside them
 *  Answers `{capture, connection, testimony}`, each `axisResult`. */
export function levelPair(bundleId, legs, { kindOf, capCapture = () => null, inherit, derive = () => null,
                                             anonymous = new Map(), bound = DEPTH_BOUND, cuttingFolds = false }) {
  const members = Object.fromEntries(STRENGTH_AXES.map((a) => [a, []]));
  const exhausted = Object.fromEntries(STRENGTH_AXES.map((a) => [a, []]));
  /* R42 (K4213): a leg that cuts against the finding is in no part; its members and undetermined entries are kept here,
     and reported beside the axis, unless `cuttingFolds` (the versions before `bio-grading/4`) counts it as it did. */
  const cut = { members: Object.fromEntries(STRENGTH_AXES.map((a) => [a, []])),
                exhausted: Object.fromEntries(STRENGTH_AXES.map((a) => [a, []])) };
  for (const [i, leg] of legs.entries()) {
    const kind = kindOf(leg);
    const inherits = inheritsAnswer(kind);
    const pool = !cuttingFolds && leg.role === "cuts_against" ? cut : { members, exhausted };
    /* REC-42: the leg's ground travels on every member it produces, its own and the pair it inherits. */
    const site = { bundle_id: bundleId, ord: leg.ord, target_id: leg.target_id,
                   role: leg.role, grade_source: leg.grade_source ?? null, ground: leg.ground ?? null };
    /* R5: a hunch contributes nothing on any axis, whatever it states, and inherits nothing either. */
    const hunch = leg.grade_source === "hunch";
    const anon = anonymous.get(i);
    /* R36–R38: a calculation, a held standard or a duty occurrence counts on the capture axis only. */
    if (CAPTURE_ONLY_KINDS.includes(kind)) {
      captureOnly(leg, kind, site, hunch, { capCapture, derive }, pool.members, pool.exhausted);
      continue;
    }
    for (const axis of STRENGTH_AXES) {
      const onAxis = leg.grade_axis === axis;
      /* DEC-21: capture and testimony range over documents, so a grade on either authored on a leg to a question (or to
         another group's finding) has no referent; history is append-only, so it is named rather than thrown. */
      const noReferent = DOCUMENT_AXES.includes(axis) && inherits;
      if (noReferent && !onAxis) continue;
      if (hunch) { pool.members[axis].push({ ...site, via: "leg", grade: null, why: HUNCH_WHY }); continue; }
      /* R29, R34: an anonymous leg nothing independent bears out is inert on its own axis, as R3's ungraded member. */
      if (onAxis && anon && !anon.corroborated) {
        pool.members[axis].push({ ...site, via: "leg", grade: null,
                             why: anon.kind === "evidence" ? UNCORROBORATED_EVIDENCE_WHY : UNCORROBORATED_WHY });
        continue;
      }
      const stated = onAxis && !noReferent ? (leg.grade ?? null) : null;
      /* R1: a capture letter is capped by what its target earns, never raised. MK-2: a testimony leg is read at the
         one letter testimony is worth, which can only lower it. */
      const resolved = axis === "capture" && stated != null ? capCapture(leg, stated)
        : axis === "testimony" && stated != null && stated !== TESTIMONY_GRADE
        ? { grade: TESTIMONY_GRADE,
            why: word("strength.why.leg_carries_testimony", { stated, testimony_grade: TESTIMONY_GRADE }) }
        : null;
      pool.members[axis].push({ ...site, via: "leg",
        grade: resolved ? resolved.grade : stated,
        why: noReferent
          ? word(kind === "imported" ? "strength.why.target_group_finding" : "strength.why.target_inquiry_document", { axis })
          : leg.grade == null ? word("strength.why.leg_carries_grade")
          : resolved && resolved.why ? resolved.why
          : onAxis ? null
          : axis === "capture" && leg.grade_axis === "testimony" ? word("strength.why.leg_rests_member")
          : gradeAxisWhy(leg) });
    }
    if (!inherits || hunch) continue;
    /* R2, R33: the target's own answer, per axis, never crossed. The weakest leg it names travels up with it. */
    const got = inherit(leg) || { stopped: word("strength.stopped.establishes_leg_rests"), unknown: true };
    if (got.stopped) {
      for (const axis of STRENGTH_AXES)
        pool.exhausted[axis].push({ ...site, via: "inherited", grade: null, why: got.stopped,
                               ...(got.unknown ? { unknown: true } : {}) });
      continue;
    }
    const via = kind === "imported" ? "imported" : "inherited";
    for (const axis of STRENGTH_AXES) {
      const s = axisAnswerOf(got.pair ? got.pair[axis] : null);
      const from = got.from ?? leg.target_id;
      if (s.state === "undetermined") {
        const allUnknown = Array.isArray(s.undetermined_at) && s.undetermined_at.length
          && s.undetermined_at.every((e) => e.unknown);
        pool.exhausted[axis].push({ ...site, via, grade: null,
          ...(got.another_groups ? { another_groups: got.another_groups } : {}),
          why: got.another_groups
            ? word("strength.why.edition_publishes_undetermined", { another_groups: anotherGroupsWords(got.another_groups), axis })
            : word("strength.why.undetermined", { from, axis, unknown: s.detail ?? word("strength.why.lies_unknown") }),
          ...(got.another_groups || allUnknown ? { unknown: true } : {}) });
        continue;
      }
      pool.members[axis].push({ ...site, via, grade: s.grade,
        inherited_from: from,
        ...(got.another_groups ? { another_groups: got.another_groups } : {}),
        /* The actual leg, however deep: a weakest that was itself inherited already names it. R33: nothing past
           another group's finding is walked, so it names no leg below. */
        through: got.another_groups ? null : (s.weakest ? (s.weakest.through || s.weakest.target_id) : null),
        why: got.another_groups
          ? (s.grade == null
              ? word("strength.why.edition_publishes_grade", { another_groups: anotherGroupsWords(got.another_groups), axis })
              : word("strength.why.counted_grade_accepted", { another_groups: anotherGroupsWords(got.another_groups) }))
          : s.grade == null ? word("strength.why.unrated_load_bearing", { from, axis }) : null });
    }
  }
  return Object.fromEntries(STRENGTH_AXES.map((axis) => [axis, axisResult(axis, members[axis], exhausted[axis], bound,
    [...cut.members[axis], ...cut.exhausted[axis]])]));
}

/* The sentence for a graded leg that counts on another axis than the one asked about; a leg that states no axis at all
   (a grade with no axis) is named for that, which R9 says is inert, rather than for an axis called "null". */
const gradeAxisWhy = (leg) => leg.grade_axis
  ? word("strength.why.leg_grade_axis", { grade_axis: leg.grade_axis })
  : word("strength.inert.leg_states_axis");

/* R36–R38: one capture-only leg's members. A calculation or an occurrence carries no grade of its own: the walk
   derives it (`derive`), or names why it cannot (undetermined, unknown rather than low). A held standard's stated capture
   grade is bounded by what its captured text earns, and a text the record does not hold leaves it undetermined (R37). On
   connection and testimony it is named and not counted. */
function captureOnly(leg, kind, site, hunch, { capCapture, derive }, members, exhausted) {
  const derived = DERIVED_KINDS.includes(kind);
  for (const axis of STRENGTH_AXES) {
    if (hunch) { members[axis].push({ ...site, via: "leg", grade: null, why: HUNCH_WHY }); continue; }
    if (axis !== "capture") {
      members[axis].push({ ...site, via: derived ? "derived" : "leg", grade: null,
        why: !derived && leg.grade_axis === axis && leg.grade != null
          ? word("strength.why.target_held_standard", { axis })
          : word("strength.why.leg_counts_capture") });
      continue;
    }
    if (derived) {
      const d = derive(leg) || { stopped: word("strength.stopped.establishes_leg_rests") };
      if (d.stopped) exhausted.capture.push({ ...site, via: "derived", grade: null, why: d.stopped, unknown: true });
      else members.capture.push({ ...site, via: "derived", grade: d.grade ?? null, why: d.why ?? null });
      continue;
    }
    const stated = leg.grade_axis === "capture" ? (leg.grade ?? null) : null;
    if (stated == null) {
      members.capture.push({ ...site, via: "leg", grade: null,
        why: leg.grade == null ? word("strength.why.leg_carries_grade") : gradeAxisWhy(leg) });
      continue;
    }
    const capped = capCapture(leg, stated);
    if (capped && capped.grade == null)
      exhausted.capture.push({ ...site, via: "leg", grade: null, why: capped.why, unknown: true });
    else members.capture.push({ ...site, via: "leg", grade: capped ? capped.grade : stated, why: capped ? capped.why : null });
  }
}

/* R33 (DEC-92): another group's finding named with its group, case and edition. The words are the UX stream's; until it
   gives them, this plain sentence. The finding's own id, which is that group's and looks like one of this record's, is
   carried in `another_groups.finding` and never in the sentence, so R6's sweep of record ids cannot mistake it. */
export function anotherGroupsWords(g) {
  return word("strength.text.leg_rests_group", {
    stated: g.case ?? localize("strength.method.not_stated", "(not stated)"),
    stated2: g.edition ?? localize("strength.method.not_stated", "(not stated)"),
    group: g.group ?? localize("strength.method.that_team", "that team") });
}

/** R29, R30, R34 (DEC-102 items 1, 2; DEC-119 (3)): for each leg of ONE basis credited anonymously, keyed by its
 *  position in `legs`, whether something independent in the same basis bears it out, and what. A leg is credited
 *  anonymously when it is a testimony leg on an observation `levels` states at `group` or `project` (R29), or a capture
 *  or connection leg on a document one of whose captures `levels` states at those levels (R34). What bears it out is a
 *  counted leg on a document (not an observation, not a question, not another group's finding) that is not itself
 *  credited anonymously, or, for an anonymous observation only, a counted testimony leg on an observation stated at
 *  `cover` or `name` that another member authored; in either case sharing no origin with it (R12). An origin list cut
 *  at R12's limit, or an author not known, bears nothing out. `f`:
 *    kindOf(leg)  one of `LEG_KINDS`;  ownGrade(leg)  the grade the walk would count on its own axis, or null;
 *    originsOf(leg) `{set, complete}`;  authorOf(leg)  an author's key or null (never answered);
 *    capturesOf(leg) the capture SHA-256s its target holds;  seen(leg)  whether it may bear anything out (R30).
 *  Answers Map index → `{kind: "testimony"|"evidence", level, capture?, corroborated, by: [{ord, target_id}]}`. */
export function anonymityOf(legs, levels, f) {
  const out = new Map();
  if (!levels) return out;
  const levelOf = (k) => (typeof k === "string" && Object.hasOwn(levels, k) ? levels[k] : null);
  const onDocument = (l) => typeof l.target_id === "string" && l.target_id
    && ["document", "observation"].includes(f.kindOf(l));
  const judged = legs.map((l) => {
    if (!onDocument(l)) return null;
    if (l.grade_axis === "testimony") {
      const level = levelOf(l.target_id);
      return ANONYMOUS_LEVELS.includes(level) ? { kind: "testimony", level } : null;
    }
    if (l.grade_axis !== "capture" && l.grade_axis !== "connection") return null;
    if (f.kindOf(l) === "observation") return null;
    const sha = (f.capturesOf(l) || []).find((c) => ANONYMOUS_LEVELS.includes(levelOf(c)));
    return sha ? { kind: "evidence", level: levelOf(sha), capture: sha } : null;
  });
  const independent = (a, b) => {
    const x = f.originsOf(a), y = f.originsOf(b);
    return !!(x && y && x.complete && y.complete) && ![...x.set].some((o) => y.set.has(o));
  };
  legs.forEach((leg, i) => {
    const j0 = judged[i];
    if (!j0) return;
    const by = [];
    legs.forEach((other, j) => {
      if (j === i || judged[j] || !onDocument(other) || !f.seen(other)) return;
      if (f.ownGrade(other) == null) return;
      let bears;
      if (other.grade_axis === "testimony") {
        const a = f.authorOf(leg), b = f.authorOf(other);
        bears = j0.kind === "testimony" && NAMED_LEVELS.includes(levelOf(other.target_id)) && a != null && b != null && a !== b;
      } else {
        bears = f.kindOf(other) !== "observation";
      }
      if (bears && independent(leg, other)) by.push({ ord: other.ord, target_id: other.target_id });
    });
    out.set(i, { ...j0, corroborated: by.length > 0, by });
  });
  return out;
}

/* ============================================================ the method in words (R31) */

/** R31 (DEC-124; K1365 (1)): the product's name when a caller gives none. The name is not part of the method: the
 *  same version under either name is the same method, and only the first line names it. */
export const PRODUCT_NAME = "Civicsmith";

/* Each version's words, as a function of the product's name. With "CivicOS" a version answers, byte for byte, the
   words it answered before T31 (a `bio-case-document/6` edition re-renders identically, `case-grammar` R14). */
const V1_LINES = (product, version, team = "group") => [
    `How ${product} grades a finding (method ${version}).`,
    "",
    "1. Two strengths, never one. A finding has a capture strength (how faithfully the documents it rests on were "
      + "taken in) and a connection strength (how firmly they are tied to what the finding is about), with testimony "
      + "(a member's own firsthand account) graded beside them. Each is worked out on its own, from the legs graded "
      + "for it, and they are never combined into one figure. Grades run from A, the strongest, to D.",
    "2. Which legs count. A leg counts only for the strength its grade names. A capture grade is never above what the "
      + "record holds for that document; a testimony grade is always D. A leg with no grade, or one marked as a hunch, "
      + "is listed and counts for nothing: it never lowers or raises a strength. A capture or testimony grade written "
      + `on a leg to another question, or to another ${team}'s finding, has nothing to grade and is listed, not counted.`,
    "3. Questions resting on questions. A leg to another question contributes that question's own strengths, worked "
      + "out the same way, up to six steps down. Past six steps, or where that question's strength is not known, the "
      + "strength is stated as undetermined: unknown, not low.",
    `4. Another ${team}'s work. A leg to a finding of another ${team}'s case that this ${team} has accepted contributes the `
      + "strengths that accepted edition published for that finding, never more, and nothing below it is followed. If "
      + "that finding cannot be read, the strength is undetermined. Withdrawing the acceptance later changes no grade.",
    "5. Sets of reasons. Legs the author did not sort into sets of reasons are all needed together, so they are only "
      + "as strong as the weakest of them. A set of reasons is only as strong as the weakest leg in it. Where the "
      + "author named several sets that each carry the finding on their own, the strongest set is what counts. The "
      + "strength is then the weaker of the legs needed by every set and that strongest set.",
    "6. When a strength is undetermined. A strength is undetermined only when something it needs is unknown: one of "
      + "the legs every set needs, or every set at once. A set that is unknown beside a known one could only be "
      + "stronger, and is named. A strength with no counted leg is unrated, and says it rests on nothing established.",
    `7. Anonymous testimony and evidence. Testimony from a member credited only to the ${team} or the project, and `
      + "material from an unnamed source that such a member attests, counts only when something independent beside it "
      + "bears it out; otherwise it is listed and counts for nothing. What bears it out is a counted leg on a document "
      + "that shares no origin with it (not the same document, not the same capture, not the same web address) and is "
      + "not itself credited anonymously; for anonymous testimony, also a member's testimony credited by cover name or "
      + "real name, by another member, sharing no origin with it. Testimony or material credited by cover name or real "
      + "name is graded as usual.",
    "8. What is named. Each strength names the leg that sets it, and every leg that does not count, with the reason. "
      + "It also states how many hunches it left out.",
  ];
/* Version 2 (T33): version 1's rules, unchanged, and the three legs whose capture strength is worked out from what they
   rest on. Inserted before "What is named", which stays last. */
const V2_LEGS = [
  "8. Calculations, held standards and obligations. A leg to a calculation counts for the capture strength only, at the "
    + "weakest of its inputs' capture strengths, each no stronger than where it came from: a figure quoted from a "
    + "document by that passage, a money figure by its own grade, a table by its source, another calculation by its own "
    + "capture strength. The arithmetic of the recipe never weakens it. A value typed in with no captured source is "
    + "testimony, D. A value another program computed is unknown until that program's agreement has been measured. The "
    + "method is stated beside the grade and is not graded. A calculation whose result is not accepted, or an input "
    + "that cannot be read, makes the strength undetermined.",
  "9. A leg to a held standard counts for the capture strength only, no stronger than the record holds for the text of "
    + "that standard at the version cited; if the record holds no text at that version, the strength is undetermined.",
  "10. A leg to one occurrence of an obligation counts for the capture strength only, at the weaker of the text of the "
    + "rule in force and the record of the date that started it. Whether it was met, late or overdue is stated beside "
    + "the grade and never changes it. Where any part of how it was worked out is unknown, the strength is undetermined.",
];
/* Version 3 (T51-54): version 2's words with the team named "team" wherever the words name the group that holds a case
   (the credit level's code is still "group"; the words are the member's). Version 2 and version 1 keep their words. */
const withLegs = (lines, more = []) => {
  const named = lines.pop().replace(/^8\. /, `${11 + more.length}. `);
  return [...lines, ...V2_LEGS, ...more, named].join("\n");
};
/* Version 4 (K4213, R42): version 3's words, and the rule that a leg which cuts against the finding is no part of any
   set of reasons and is listed with its own strength. Inserted after the three legs, before "What is named". */
const V4_CUTTING = "11. Legs that cut against the finding. A leg that cuts against the finding is not one of the sets of "
  + "reasons that carry it, and is never counted toward its strength. It is listed beside the strength, with the strength "
  + "it has on its own, worked out the same way as any other leg's.";
/* Version 5 (T53; DEC-464; R46, R47): version 4's words, and the rule that a typed passage is worth its typist's word,
   one step more once a second member checked it, never the standing of text the product read. The arithmetic of the
   sets of reasons is version 4's; a case file states each leg's recorded grade, so every version recomputes from it. */
const V5_TYPED = "12. Typed passages. A leg resting on a passage a member typed from the page counts for "
  + "the capture strength at what the typing stands on: the typist's word, D, or one step more, C, once a second member "
  + "has checked the typing against the page, and never stronger than the capture of the document itself. No one needs "
  + "to state a letter for it, and a stronger letter stated is not taken; a weaker one stands. A check raises it without "
  + "anyone stating it again. A typing never has the standing of text read from the capture itself.";
const METHOD_TEXT = Object.freeze({
  [V1]: (product) => V1_LINES(product, V1).join("\n"),
  [V2]: (product) => withLegs(V1_LINES(product, V2)),
  [V3]: (product) => withLegs(V1_LINES(product, V3, "team")),
  [V4]: (product) => withLegs(V1_LINES(product, V4, "team"), [V4_CUTTING]),
  [GRADING_METHOD_VERSION]: (product) => withLegs(V1_LINES(product, GRADING_METHOD_VERSION, "team"), [V4_CUTTING, V5_TYPED]),
});

/** R31: the method of `version` in plain words, complete enough to recompute a grade by hand, naming the product by
 *  `product` (a non-blank string, used as given), else `PRODUCT_NAME`; null for a version this module never published.
 *  Pure; never throws. */
export function gradingMethodText(version, product = PRODUCT_NAME) {
  if (typeof version !== "string" || !Object.hasOwn(METHOD_TEXT, version)) return null;
  return METHOD_TEXT[version](typeof product === "string" && product.trim() ? product : PRODUCT_NAME);
}

/* ============================================================ recomputation from a case file's facts (R32) */

/* One leg's facts as the walk's leg: `{target, kind, role, grade, grade_axis, grade_source, ground, answer?, origins?,
   origins_complete?, captures?, author_key?}`. Anything else is dropped; nothing is read from elsewhere. */
function factLeg(l, k, kinds = LEG_KINDS) {
  const o = l && typeof l === "object" ? l : {};
  const target = typeof o.target === "string" ? o.target.trim() : "";
  const s = (v) => (typeof v === "string" && v ? v : null);
  return { ord: Number.isInteger(o.ord) ? o.ord : k, target_id: target,
           kind: kinds.includes(o.kind) ? o.kind : "document",
           role: typeof o.role === "string" ? o.role : "",
           grade: s(o.grade), grade_axis: s(o.grade_axis), grade_source: s(o.grade_source),
           ground: typeof o.ground === "string" && o.ground.trim() ? o.ground.trim() : null,
           answer: o.answer && typeof o.answer === "object" ? o.answer : null,
           another_groups: o.another_groups && typeof o.another_groups === "object" ? o.another_groups : null,
           origins: Array.isArray(o.origins) ? o.origins.map(String) : null,
           origins_complete: o.origins_complete === true,
           captures: Array.isArray(o.captures) ? o.captures.map(String) : [],
           author_key: s(o.author_key),
           undetermined: s(o.undetermined) };
}

/** R32: the pair (R1–R5, R29, R30, R33, R34) from the facts a case file states for one finding, reading nothing else.
 *  Each leg gives its target's recorded grade, its axis, its grade source and its ground; a leg to a question gives that
 *  question's recorded `answer` (per axis), and a leg to another group's finding the `answer` its accepted edition
 *  publishes (`case-grammar` R16's `accepted_work:` row), with `another_groups` naming it. For R29 and R34, a leg
 *  gives `origins` (with `origins_complete`), `captures` and an opaque `author_key`; a fact not stated bears nothing
 *  out. `levels` is R29's map. Any version this module never published is `UNKNOWN_METHOD_VERSION`. Pure; writes
 *  nothing; never throws. */
export function recomputePair({ legs = [], levels = null, version = null } = {}) {
  if (!GRADING_METHOD_VERSIONS.includes(version))
    return { ok: false, reason: "UNKNOWN_METHOD_VERSION", version: typeof version === "string" ? version.slice(0, 80) : null,
             versions: [...GRADING_METHOD_VERSIONS],
             detail: localize("strength.method.this_grading_method_version_is_not",
                              "this grading method version is not one that has been published, so the grade cannot be recomputed by it") };
  try {
    const kinds = version === V1 ? LEG_KINDS_V1 : LEG_KINDS;
    const walkLegs = (Array.isArray(legs) ? legs : []).map((l, k) => factLeg(l, k, kinds));
    const lv = levelsGiven(levels);
    const own = (l) => {
      if (l.grade_source === "hunch" || l.grade == null || !STRENGTH_AXES.includes(l.grade_axis)) return null;
      if (l.kind !== "document" && l.kind !== "observation") return null;
      return l.grade_axis === "testimony" ? TESTIMONY_GRADE : l.grade;
    };
    const anonymous = anonymityOf(walkLegs, lv, {
      kindOf: (l) => l.kind, ownGrade: own,
      originsOf: (l) => (l.origins ? { set: new Set(l.origins), complete: l.origins_complete } : null),
      authorOf: (l) => l.author_key, capturesOf: (l) => l.captures, seen: () => true });
    const pair = levelPair("", walkLegs, {
      kindOf: (l) => l.kind,
      inherit: (l) => (l.answer
        ? { pair: l.answer, from: l.target_id, ...(l.kind === "imported" ? { another_groups: l.another_groups || {} } : {}) }
        : { stopped: word("strength.stopped.case_file_states"), unknown: true }),
      /* R36–R38: a calculation's or an occurrence's capture grade as the case file states it, or why it is unknown;
         a standard's stated grade is already its ceiling's, and a stated reason is its unknown text (R37). */
      derive: (l) => (l.undetermined ? { stopped: l.undetermined }
        : l.grade ? { grade: l.grade, why: word("strength.why.capture_strength_case") }
        : { stopped: word("strength.stopped.case_file_states_capture") }),
      capCapture: (l) => (l.kind === "standard" && l.undetermined ? { grade: null, why: l.undetermined } : null),
      anonymous, cuttingFolds: BEFORE_CUTTING_LEGS.includes(version) });
    return { ok: true, version, depth_bound: DEPTH_BOUND,
             capture: pair.capture, connection: pair.connection, testimony: pair.testimony,
             hunches_left_out: walkLegs.filter((l) => l.grade_source === "hunch").length, ...(lv ? { levels: lv } : {}) };
  } catch (e) {
    return { ok: false, reason: "RECOMPUTE_FAILED", version,
             detail: String(e && e.message ? e.message : e).slice(0, 200) };
  }
}
