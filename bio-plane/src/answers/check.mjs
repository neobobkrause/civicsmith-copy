/* The answer contract and its checks (R3–R6, R22; ladders §9.4 L1, §10 "Closed-book answers"). `checkAnswer` is the
 * one door an answer passes before a member sees it: a malformed answer is refused whole (R3, R6); otherwise each
 * sentence failing a check is withheld, never rewritten (R4), every rule item must be one of R7's answers in the read
 * log (R22), and where the log holds nothing every sentence but an absence is withheld (R5). Each sentence is judged as
 * R33's `checkSentences` judges it (`./sentences.mjs`: R31's `baseline`, R32's voice), and a summary giving a verdict,
 * likelihood or rating word is withheld as such a sentence is (R32). Pure over its arguments:
 * it writes nothing (the counts are R13's, recorded by its caller) and never throws.
 *
 * Shapes (J1 (7)): a sentence's `support` names `h<i>`, `r<i>` or `l<i>`, 1-based positions in `holdings`, `rules` and
 * `looks`; `summary` is null or `{text, rests_on: ["s<i>"]}`; a rule item is `{rule_id, service, value, label, quote?,
 * reading?, limits?}`, `rule_id` the id the read log gave that R7 answer. */

import { ANSWERS_CHECKS, refusal } from "./checks.mjs";
import { ReadLog } from "./readlog.mjs";
import { SENTENCE_KINDS, RULE_LABELS, LEVELS, ABSENCE_TERMS, sentenceShape, citedShape, judge, verdictIn, figuresIn }
  from "./sentences.mjs";

export { SENTENCE_KINDS, RULE_LABELS, LEVELS, ABSENCE_TERMS, figuresIn };

/** R3: the answer's fields, in order. */
export const ANSWER_FIELDS = Object.freeze(["question_as_read", "clarifying", "summary", "sentences", "holdings", "rules",
  "looks", "bound", "truncated", "out_of_view", "lens", "not_established", "query", "next_acts", "label"]);
/** R3: the label every answer carries. */
export const ANSWER_LABEL = "machine work";

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";

/* ---- R3, R6: the shape ---- */

function malformed(field, detail) { return refusal("ANSWER_MALFORMED", detail, { field }); }

function onlyKeys(o, keys, field) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) return malformed(`${field}.${k}`, `${field} carries a field the contract has no place for: ${k}`);
  return null;
}

/** R3, R6: null for an answer of the contract's shape, else `ANSWER_MALFORMED` naming the field. */
export function shapeRefusal(a) {
  if (!plain(a)) return malformed("answer", "an answer is an object");
  for (const k of Object.keys(a)) if (!ANSWER_FIELDS.includes(k)) return malformed(k, `the answer carries a field the contract has no place for: ${k}`);
  for (const k of ANSWER_FIELDS) if (!(k in a)) return malformed(k, `the answer has no ${k}`);
  if (!filled(a.question_as_read)) return malformed("question_as_read", "the question as read is a non-empty string");
  if (a.clarifying !== null && !(filled(a.clarifying) && (a.clarifying.match(/\?/g) || []).length <= 1))
    return malformed("clarifying", "clarifying is null or exactly one question");
  if (!Array.isArray(a.sentences)) return malformed("sentences", "sentences is a list");
  for (const f of ["holdings", "rules", "looks"]) if (!Array.isArray(a[f])) return malformed(f, `${f} is a list`);
  const n = { h: a.holdings.length, r: a.rules.length, l: a.looks.length, s: a.sentences.length };
  const inRange = (id, kinds) => { const m = /^([hrls])([1-9]\d*)$/.exec(typeof id === "string" ? id : "");
    return !!m && kinds.includes(m[1]) && Number(m[2]) <= n[m[1]]; };
  if (a.clarifying !== null && (a.summary !== null || a.sentences.length))
    return malformed("clarifying", "an answer asking a clarifying question has no summary and no sentences");
  if (a.summary !== null) {
    if (!plain(a.summary)) return malformed("summary", "the summary is null or {text, rests_on}");
    const k = onlyKeys(a.summary, ["text", "rests_on"], "summary"); if (k) return k;
    if (!filled(a.summary.text)) return malformed("summary.text", "the summary is one line of text");
    if (/\n/.test(a.summary.text)) return malformed("summary.text", "the summary is one line");
    if (!Array.isArray(a.summary.rests_on) || !a.summary.rests_on.length || !a.summary.rests_on.every((id) => inRange(id, ["s"])))
      return malformed("summary.rests_on", "the summary names the sentences it rests on, as s<i>");
  }
  for (const [i, s] of a.sentences.entries()) { const bad = sentenceShape(s, `sentences[${i}]`, n); if (bad) return bad; }
  const cited = citedShape(a); if (cited) return cited;
  if (a.bound !== null && !plain(a.bound)) return malformed("bound", "bound is null or the bounds applied");
  if (typeof a.truncated !== "boolean") return malformed("truncated", "truncated is true or false");
  if (typeof a.out_of_view !== "boolean") return malformed("out_of_view", "out_of_view is true or false");
  if (!(a.lens === null || typeof a.lens === "string" || plain(a.lens))) return malformed("lens", "lens is null, a name or the lens");
  if (!Array.isArray(a.not_established)) return malformed("not_established", "not_established is a list");
  if (!(a.query === null || typeof a.query === "string")) return malformed("query", "query is null or the query run");
  if (!Array.isArray(a.next_acts) || !a.next_acts.every(filled)) return malformed("next_acts", "next_acts lists acts by their catalogue ids");
  if (a.label !== ANSWER_LABEL) return malformed("label", `an answer is labelled "${ANSWER_LABEL}"`);
  return null;
}

/** R4: `checkAnswer(answer, {readLog, viewer})` → `{ok: true, answer, withheld}`, or `ANSWER_MALFORMED` with nothing
 *  shown. A log asked under another viewer is read as empty (fail closed). Never throws. */
export function checkAnswer(answer, { readLog = null, viewer = null } = {}) {
  try {
    const bad = shapeRefusal(answer);
    if (bad) return bad;
    const log = readLog instanceof ReadLog && (readLog.viewer === null || readLog.viewer === viewer) ? readLog : new ReadLog({ viewer });
    const withheld = [];
    const out = JSON.parse(JSON.stringify(answer));
    const say = (code) => ANSWERS_CHECKS[code].translation;
    /* the items themselves (a holding not read, a rule item not the plane's, a look with no level) and each sentence,
       judged as R33's `checkSentences` judges them */
    const { holdOk, ruleOk, lookOk, codes } = judge(answer.sentences, answer, log);
    const kept = new Set();
    out.sentences = answer.sentences.map((s, i) => {
      const code = codes[i];
      if (code) { withheld.push({ sentence: `s${i + 1}`, code, translation: say(code) }); return null; }
      kept.add(`s${i + 1}`);
      return out.sentences[i];
    });
    answer.holdings.forEach((_, i) => { if (!holdOk[i]) { out.holdings[i] = null; withheld.push({ holding: `h${i + 1}`, code: "ANSWER_CITES_UNREAD", translation: say("ANSWER_CITES_UNREAD") }); } });
    answer.rules.forEach((_, i) => { if (!ruleOk[i]) { out.rules[i] = null; withheld.push({ rule: `r${i + 1}`, code: "ANSWER_RULE_NOT_PLANE", translation: say("ANSWER_RULE_NOT_PLANE") }); } });
    answer.looks.forEach((_, i) => { if (!lookOk[i]) { out.looks[i] = null; withheld.push({ look: `l${i + 1}`, code: "ANSWER_ABSENCE_WITHOUT_LEVEL", translation: say("ANSWER_ABSENCE_WITHOUT_LEVEL") }); } });
    /* R32: the summary is in Civicsmith's voice too */
    if (answer.summary && verdictIn(answer.summary.text, [...answer.holdings.map((h) => h.quote), ...answer.rules.map((r) => r.quote)])) {
      out.summary = null;
      withheld.push({ summary: true, code: "ANSWER_VERDICT_WORD", translation: say("ANSWER_VERDICT_WORD") });
    } else if (answer.summary && answer.summary.rests_on.some((id) => !kept.has(id))) {
      const first = withheld.find((w) => answer.summary.rests_on.includes(w.sentence));
      out.summary = null;
      withheld.push({ summary: true, code: first.code, translation: first.translation });
    }
    if (answer.clarifying === null && answer.sentences.length && !kept.size) {
      out.summary = null;
      out.not_established = [...out.not_established,
        { withheld: answer.sentences.length, codes: [...new Set(withheld.filter((w) => w.sentence).map((w) => w.code))] }];
    }
    return { ok: true, answer: out, withheld };
  } catch (e) {
    return malformed("answer", `the answer could not be read: ${String(e && e.message || e).slice(0, 120)}`);
  }
}
