/* case-checker — how a case uses the standards it measures against (requirements: `build/requirements/case-checker.md`
 * R21; N648; K1723, K1739; Capability Ladders §6C.4 STANDARDS L2–L3).
 *
 * `checkStandardsUse({text, criteria, materials, passages})` judges two things K1739 and K1723 rule:
 *
 *   - a copyrighted or paywalled standard (its `access` not `free`) travels only as the passages a finding relies on,
 *     never whole: a material carrying one of its captures `included: true` is `COPYRIGHTED_TEXT_CARRIED`, and a passage
 *     of one of its captures that no finding relies on is `COPYRIGHTED_PASSAGE_UNRELIED`;
 *   - a finding measured only against benchmarks (every criteria row `binds: false`) may say "slower than" or "below",
 *     never "violated" or "nonconforming": `BENCHMARK_CALLED_NONCONFORMING` names the finding, the standard and the word.
 *
 * Which rows are a finding's (K2002): those whose `standard` is the target of one of that member finding's own `standard`
 * legs in the document's signed `grading_facts:` block (`case-grammar` R17), as `publication` R72 counts a member's legs,
 * and whose `body` is the member's `subject_entity` as the document states it (`case-grammar` R22's `memberSubjectOf`:
 * its `case_roles:` row, else its `case_conclusions:` row); when the document states none, every row of that standard.
 * What a finding states: its `case_conclusions:` row's `claim` and `claim_detail`; the case's statement: its `case_scope`
 * and its `completeness:` `statement`. The body is not read: it prints quoted passages, whose own words may say
 * "violation". A row with `stated: "not held"` is not judged and is named in `unjudged`.
 *
 * (T50; R26) Each departure also carries `says: {key, vars}`: the members' words are read by the caller through
 * `setup-words` `word(key, vars)`, the key `refusal.<code>` and `vars` the departure's own fields. No English is answered
 * here, and an `{ok: true}` answer carries no `says`.
 *
 * Pure: it reads only its arguments, the same arguments give the same answer, and it never throws. Its caller with the
 * record refuses at the ceremony (`case-authoring`'s pre-flight, N717); `checkCaseFile` runs it offline over a carried
 * `criteria` file (R22), so it is part of the standalone program (R13). No place is named here (R17). */

import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { gradingFactsOf, memberSubjectOf } from "../case-grammar/index.mjs";

/** R21: the refusal codes, in the order the arms run. */
export const STANDARDS_USE_CODES = Object.freeze(["MALFORMED", "COPYRIGHTED_TEXT_CARRIED", "COPYRIGHTED_PASSAGE_UNRELIED",
  "BENCHMARK_CALLED_NONCONFORMING"]);

/** R21 (K1723): the words a finding resting only on benchmarks never uses, matched as whole words in any letter case.
 *  The list is BOB's and may grow without a change of meaning. */
export const NONCONFORMING_WORDS = Object.freeze(["violated", "violates", "violation", "nonconforming", "non-conforming",
  "nonconformity", "nonconformance"]);

/** R26: the key of the members' words for each code (`refusal.<code>`, `setup-words`), in the codes' order. */
export const STANDARDS_USE_KEYS = Object.freeze(STANDARDS_USE_CODES.map((c) => `refusal.${c}`));

/** R26: a departure with the words it is read by: `says.key` is `refusal.<code>`, `says.vars` the departure's own fields. */
const withSays = (r) => { const { code, ...vars } = r; return { ...r, says: { key: `refusal.${code}`, vars } }; };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" && v !== "" ? v : null);
const shaKey = (v) => (typeof v === "string" ? v.trim().toLowerCase() : null);
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_RES = NONCONFORMING_WORDS.map((w) => [w, new RegExp(`(?<![\\p{L}\\p{N}_])${escape(w)}(?![\\p{L}\\p{N}_])`, "iu")]);

/** The listed words a text uses, in the list's order. */
const wordsIn = (texts) => {
  const joined = texts.filter((t) => typeof t === "string").join("\n");
  return WORD_RES.filter(([, re]) => re.test(joined)).map(([w]) => w);
};

/** R21. Never throws; any input answers. */
export function checkStandardsUse(args) {
  try { return judge(args); }
  catch { return { ok: false, refusals: [withSays({ code: "MALFORMED", field: "arguments" })] }; }
}

function judge(args) {
  if (!isObj(args)) return { ok: false, refusals: [withSays({ code: "MALFORMED", field: "arguments" })] };
  const { text, criteria, materials, passages } = args;
  const malformed = [];
  if (typeof text !== "string") malformed.push("text");
  for (const [field, v] of [["criteria", criteria], ["materials", materials], ["passages", passages]]) {
    if (!Array.isArray(v)) { malformed.push(field); continue; }
    v.forEach((x, i) => { if (!isObj(x)) malformed.push(`${field}[${i}]`); });
  }
  if (Array.isArray(criteria)) criteria.forEach((r, i) => {
    if (!isObj(r)) return;
    if (!str(r.standard)) malformed.push(`criteria[${i}].standard`);
    if (r.captures !== undefined && r.captures !== null && !Array.isArray(r.captures)) malformed.push(`criteria[${i}].captures`);
    if (r.passages !== undefined && r.passages !== null && !Array.isArray(r.passages)) malformed.push(`criteria[${i}].passages`);
  });
  let fm = null;
  if (typeof text === "string") {
    const p = parseFrontmatter(text);
    fm = isObj(p.data) ? p.data : null;
    if (!fm) malformed.push("text");
  }
  if (malformed.length) return { ok: false, refusals: [...new Set(malformed)].map((field) => withSays({ code: "MALFORMED", field })) };

  const refusals = [];
  const seen = new Set();
  const refuse = (r) => { const k = canonicalJson(r); if (!seen.has(k)) { seen.add(k); refusals.push(withSays(r)); } };

  const unjudged = [];
  const judged = [];
  for (const r of criteria) {
    if (r.stated === "not held") unjudged.push({ standard: r.standard, portion: r.portion ?? null, body: r.body ?? null });
    else judged.push(r);
  }
  const copyrighted = judged.filter((r) => r.access !== "free");

  /* COPYRIGHTED_TEXT_CARRIED: a material travelling whole whose bytes are a capture of a copyrighted standard. */
  for (const r of copyrighted) {
    const caps = new Set((r.captures || []).map(shaKey).filter(Boolean));
    for (const m of materials) if (m.included === true && caps.has(shaKey(m.sha))) refuse({ code: "COPYRIGHTED_TEXT_CARRIED", standard: r.standard, sha: shaKey(m.sha) });
  }

  /* COPYRIGHTED_PASSAGE_UNRELIED: a passage of such a standard quoted with no finding relying on it (K1739). */
  const reliedOn = new Set(passages.filter((p) => str(p.finding) && str(p.content_id)).map((p) => p.content_id));
  for (const r of copyrighted) {
    const caps = new Set((r.captures || []).map(shaKey).filter(Boolean));
    const quoted = [];
    for (const q of r.passages || []) if (isObj(q) && str(q.content)) quoted.push(q.content);
    for (const p of passages) if (str(p.content_id) && caps.has(shaKey(p.capture_sha))) quoted.push(p.content_id);
    for (const content of quoted) if (!reliedOn.has(content)) refuse({ code: "COPYRIGHTED_PASSAGE_UNRELIED", standard: r.standard, content });
  }

  /* BENCHMARK_CALLED_NONCONFORMING: a member finding resting only on benchmarks, named in the words K1723 forbids. */
  const members = Array.isArray(fm.case_findings) ? fm.case_findings.map(String) : [];
  const legs = gradingFactsOf(fm) || {};
  const conclusions = Array.isArray(fm.case_conclusions) ? fm.case_conclusions.filter(isObj) : [];
  const completeness = isObj(fm.completeness) ? fm.completeness : {};
  const rowOf = (list, finding) => list.find((x) => String(x.target ?? "") === finding) || {};
  const caseWords = wordsIn([fm.case_scope, completeness.statement]);
  for (const finding of members) {
    const targets = new Set((legs[finding] || []).filter((l) => isObj(l) && l.kind === "standard" && str(l.target)).map((l) => l.target));
    const subject = memberSubjectOf(fm, finding);
    const rows = judged.filter((r) => targets.has(r.standard) && (subject === null || r.body === subject));
    if (!rows.length || rows.some((r) => r.binds !== false)) continue;
    const c = rowOf(conclusions, finding);
    const found = [...new Set([...wordsIn([c.claim, c.claim_detail]), ...caseWords])];
    const words = NONCONFORMING_WORDS.filter((w) => found.includes(w));
    for (const standard of [...new Set(rows.map((r) => r.standard))]) for (const word of words)
      refuse({ code: "BENCHMARK_CALLED_NONCONFORMING", finding, standard, word });
  }

  const out = refusals.length ? { ok: false, refusals } : { ok: true };
  if (unjudged.length) out.unjudged = unjudged;
  return out;
}
