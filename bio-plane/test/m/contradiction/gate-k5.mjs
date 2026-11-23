/* gate-k5.mjs — the gate's K5 arm (Satisfies: K5's judgement; N345; DEC-84 item 3; K488): one question, two projects'
 * conclusions, judged under R2's pinned prompt unchanged, with R3 rendering a stance side as its claim text.
 *
 * Every entry is ONE pair K5 forms: one inquiry, and two projects whose stances on it are both concluded, adopting claims
 * whose text differs. The label is the one a member would give it (§5's vocabulary), the fixture author's, and every
 * name, figure and date is SYNTHETIC, shaped like what Oakland's records produce, and none of it is a statement about a
 * real body. `shape` names what the entry stands for:
 *   precision.agree    two projects agree, and word the one conclusion differently
 *   precision.round    a rounded figure against the exact one
 *   precision.bob      Bob's shape, a vague magnitude against another
 *   precision.summary  a coarser date against the exact one
 *   record.never       one project holds that a thing happened, the other that it never did
 *   record.state       two states of one thing at one time that cannot both hold
 *   unrelated.question two conclusions on one question that are about different matters
 *
 * WRITTEN BEFORE ANY RUN JUDGED IT, and not edited to suit one: the measurement is whatever the recorded runs below
 * make of this text. Gold labels never reach a run (the input is renderJudgementInput's, which carries none). */

/** @type {{id: string, shape: string, label: string, a: string, b: string}[]} */
export const K5 = [
  { id: "k5-agree", shape: "precision.agree", label: "precision",
    a: "Voters renewed the Measure Q parcel tax in March 2024.",
    b: "The Measure Q parcel tax was renewed by voters in March 2024." },
  { id: "k5-round", shape: "precision.round", label: "precision",
    a: "The library budget rose by 4.8 percent in fiscal year 2025.",
    b: "The library budget rose by about 5 percent in fiscal year 2025." },
  { id: "k5-bob", shape: "precision.bob", label: "precision",
    a: "Pothole repair spending went up slightly in the 2025 adopted budget.",
    b: "Pothole repair spending went up a great deal in the 2025 adopted budget." },
  { id: "k5-summary", shape: "precision.summary", label: "precision",
    a: "The council adopted the sidewalk vending fee on March 3, 2026.",
    b: "The council adopted the sidewalk vending fee in early 2026." },
  { id: "k5-never", shape: "record.never", label: "record",
    a: "The city council approved the Sewer Fund transfer to the general fund.",
    b: "The city council never approved the Sewer Fund transfer to the general fund." },
  { id: "k5-state", shape: "record.state", label: "record",
    a: "The Lakeside pool was closed for all of August 2025.",
    b: "The Lakeside pool was open every day of August 2025." },
  { id: "k5-other", shape: "unrelated.question", label: "unrelated",
    a: "The Fruitvale library branch extended its weekend hours in 2025.",
    b: "The library's book acquisition budget was cut in 2025." },
];

/* THE RUNS, recorded 23 Nov 2026 (job/contradiction.1). The input was renderJudgementInput() over the 7 pairs K5 formed
 * over K5 above, under the pinned prompt (R2, unchanged); the input file's SHA-256 was 8870caca…. Each run was a separate
 * subagent of the job's own model family, told to use no tool but one Read of that input and one Write of its answer;
 * the input holds no gold label or fixture id. The model identifiers are not written into the repository by the
 * session's rule. Answers are verbatim, keyed by the pair's text, not its position.
 *
 * WHAT IT MEASURED. Every run labelled every precision and unrelated pair precision or unrelated: no false conflict, the
 * arm's gate. Recall is stated beside it, never as the gate: 0 of 2 in each run. Each run labelled both record pairs
 * `undetermined`, saying the prompt defines K1 to K4 only and so does not say whether a K5 side is a source or a held
 * claim. Under R24 an undetermined K5 candidate is shown as plurality, as any shown K5 label is. */
export const PROMPT_SHA256 = "aad3ac9e557fba904331c788a946d42e7b5c59b3d13e17972f4b45422716d08c";
export const RUNS = [
  { id: "R1", who: "a job subagent at the job's own model family, input read from file" },
  { id: "R2", who: "a job subagent at the job's own model family, input read from file (second run)" },
  { id: "R3", who: "a job subagent at the job's own model family, input read from file (third run)" },
];
/* One row per pair as numbered in the input: its key, the two side texts, and each run's [label, reason]. */
export const ANSWERS = [
  {"n":1,"key":"K5","a":"Voters renewed the Measure Q parcel tax in March 2024.","b":"The Measure Q parcel tax was renewed by voters in March 2024.","labels":[["precision","Both state the same fact, that voters renewed the Measure Q parcel tax in March 2024, in different word order."],["precision","Both state the same fact, that voters renewed the Measure Q parcel tax in March 2024, in different wording."],["precision","Both state the same fact, that voters renewed Measure Q in March 2024, only worded differently."]]},
  {"n":2,"key":"K5","a":"Pothole repair spending went up slightly in the 2025 adopted budget.","b":"Pothole repair spending went up a great deal in the 2025 adopted budget.","labels":[["precision","Both say pothole repair spending rose in the 2025 adopted budget and differ only in vague magnitude ('slightly' vs 'a great deal'), which the rules class as emphasis, not conflict."],["precision","Both say pothole repair spending rose in the 2025 adopted budget and differ only in vague magnitude (slightly vs a great deal), which the rules treat as emphasis rather than conflict."],["precision","Both say pothole spending rose in the 2025 adopted budget and differ only in vague magnitude ('slightly' vs 'a great deal'), which is emphasis rather than an incompatibility."]]},
  {"n":3,"key":"K5","a":"The city council approved the Sewer Fund transfer to the general fund.","b":"The city council never approved the Sewer Fund transfer to the general fund.","labels":[["undetermined","The statements cannot both be true, but key K5 is not defined, so it cannot be told whether the sides are sources (world) or held claims (record)."],["undetermined","The statements cannot both be true, but key K5 is not defined, so it is not shown whether the sides are sources (world) or held claims (record)."],["undetermined","The two statements cannot both be true, but key K5 is not defined so it is not shown whether the sides are sources (world) or held claims (record), and neither label can be chosen honestly."]]},
  {"n":4,"key":"K5","a":"The Fruitvale library branch extended its weekend hours in 2025.","b":"The library's book acquisition budget was cut in 2025.","labels":[["unrelated","One concerns the Fruitvale branch's weekend hours and the other the library's book acquisition budget, which are different subjects."],["unrelated","One concerns the Fruitvale branch's weekend hours and the other the library's book acquisition budget, which are different subjects."],["unrelated","One concerns a branch's weekend hours and the other the book acquisition budget, so they are different subjects about the same entity."]]},
  {"n":5,"key":"K5","a":"The library budget rose by 4.8 percent in fiscal year 2025.","b":"The library budget rose by about 5 percent in fiscal year 2025.","labels":[["precision","4.8 percent and 'about 5 percent' are the same figure at exact and rounded precision."],["precision","An exact 4.8 percent rise and a rise of about 5 percent state the same figure at different precision."],["precision","4.8 percent is consistent with 'about 5 percent'; it is the same figure stated exactly and rounded."]]},
  {"n":6,"key":"K5","a":"The Lakeside pool was closed for all of August 2025.","b":"The Lakeside pool was open every day of August 2025.","labels":[["undetermined","Closed for all of August 2025 and open every day of August 2025 cannot both be true, but key K5 is not defined, so world or record cannot be chosen."],["undetermined","Closed all of August 2025 and open every day of August 2025 cannot both be true, but key K5 is not defined, so it is not shown whether the sides are sources (world) or held claims (record)."],["undetermined","Closed for all of August 2025 and open every day of August 2025 cannot both be true, but key K5 is not defined so it is not shown whether the sides are sources (world) or held claims (record)."]]},
  {"n":7,"key":"K5","a":"The council adopted the sidewalk vending fee on March 3, 2026.","b":"The council adopted the sidewalk vending fee in early 2026.","labels":[["precision","March 3, 2026 falls within 'early 2026', so this is the same date at different precision."],["precision","March 3, 2026 falls within early 2026, so the two give the same adoption date at different precision."],["precision","March 3, 2026 falls within early 2026, so it is the same date at different precision."]]},
];

const fp = (key, a, b) => [String(key), ...[String(a ?? ""), String(b ?? "")].sort()].join("\u0000");
const INDEX = new Map(ANSWERS.map((r) => [fp(r.key, r.a, r.b), r]));

/** A recorded run as a judge: a pair `{key, a: {text}, b: {text}}` to `{label, reason}`, undefined for a pair it never saw.
 *  @param {string} runId
 *  @returns {(input: {key: string, a?: {text?: string}, b?: {text?: string}}) => ({label: string, reason: string}|undefined)} */
export const recordedJudgeK5 = (runId) => {
  const i = RUNS.findIndex((r) => r.id === runId);
  if (i < 0) throw new Error(`no recorded K5 run ${runId}`);
  return (input) => {
    const hit = INDEX.get(fp(input.key, input.a?.text, input.b?.text));
    return hit ? { label: hit.labels[i][0], reason: hit.labels[i][1] } : undefined;
  };
};
