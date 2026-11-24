/* case-checker — a case re-checked under another lens (requirements: `build/requirements/case-checker.md` R23; D59).
 *
 * The grading facts a case file carries are the case as published, under its lens: a leg a bias statement lowered
 * carries the lowered grade, and each application is a `bias_applications:` row (`case-grammar` R24). `checkCaseFile`
 * takes `lens`:
 *
 *   as_published   (the default) the pairs as published, recomputed as R5 recomputes them;
 *   removed        every published application reversed: a lowered grade restored to `from`; a leg excluded or an
 *                  inference refused restored, counting as the facts carry it;
 *   {statements, applications}   a reader's own lens: a published application whose statement is among `statements`
 *                  stands, every other one is reversed as under `removed`, and the reader's own `applications` whose
 *                  statement is among `statements` are applied (a lowered grade set to `to`; an excluded leg or a
 *                  refused inference left out).
 *
 * Each finding's pair is recomputed by `strength.recomputePair` over the facts so changed, a finding resting on another
 * taking that one's pair under the same lens, and answered with `bar_met` and the applications that changed it. A lens
 * re-weighs; it never changes what was checked, so it adds no `differs` entry. Pure; never throws. */

import { word } from "../setup-words/index.mjs";

/** R23: the sentence every answer states. */
export const LENS_LIMIT_STATEMENT = word("case-checker.lens_limit_statement");
/** R23: the lenses by name. */
export const LENS_NAMES = Object.freeze(["as_published", "removed", "reader"]);
/** `inquiry-grammar` R18, `basis-versions` R48: what an application does. */
export const LENS_EFFECTS = Object.freeze(["grade_lowered", "leg_excluded", "inference_refused", "scrutiny_raised"]);

const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const ordOf = (v) => (Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

/** An application as `case-grammar` R24 states it (`biasApplicationsOf`), `{finding, ord, target, statement, effect, from,
 *  to}`: `target` `leg` (with the leg's `ord`) or `conclusion`; or null when it is not one. */
export function applicationOf(r) {
  if (!plain(r) || !filled(r.statement) || !LENS_EFFECTS.includes(r.effect) || !["leg", "conclusion"].includes(r.target)) return null;
  return { finding: filled(r.finding) ? r.finding : null, ord: r.target === "leg" ? ordOf(r.ord) : null, target: r.target,
           statement: r.statement, effect: r.effect, from: filled(r.from) ? r.from : null, to: filled(r.to) ? r.to : null };
}

/** R23: the lens asked for, read: `{name, statements, applications, departure}`; anything else is answered as published,
 *  with the departure named. */
export function lensOfArg(lens) {
  if (lens === undefined || lens === null || lens === "as_published") return { name: "as_published", statements: null, applications: [], departure: null };
  if (lens === "removed") return { name: "removed", statements: null, applications: [], departure: null };
  if (plain(lens) && Array.isArray(lens.statements) && lens.statements.every(filled)
      && (lens.applications === undefined || Array.isArray(lens.applications))) {
    const apps = (lens.applications || []).map(applicationOf);
    if (apps.every(Boolean)) return { name: "reader", statements: [...new Set(lens.statements)], applications: apps, departure: null };
  }
  return { name: "as_published", statements: null, applications: [], departure: word("case-checker.departure.lens_given_published") };
}

/* An application names a leg when it is recorded at a leg of that finding, at that leg's place. */
const names = (a, finding, ord) => a.target === "leg" && a.finding === finding && a.ord === ord;

/** R23: each finding's pair under the lens. `facts` maps a finding to its legs (`{legs}`), each leg as R5 reads it;
 *  `published` the case's applications; `recompute(legs)` R5's recomputation (`{ok, pair}`). Answers `{pairs: Map(finding →
 *  pair | null), changes: Map(finding → [application]), not_applied: [application with why]}`. */
export function pairsUnderLens({ lens, facts, published, recompute }) {
  const keep = (a) => lens.name === "reader" && lens.statements.includes(a.statement);
  const own = lens.name === "reader" ? lens.applications.filter((a) => lens.statements.includes(a.statement)) : [];
  const not_applied = lens.name === "reader"
    ? lens.applications.filter((a) => !lens.statements.includes(a.statement)).map((a) => ({ ...a, why: word("case-checker.why.statement_among_lens") }))
    : [];
  const used = new Set();
  const pairs = new Map(), changes = new Map(), busy = new Set();
  function pairOf(id) {
    if (pairs.has(id)) return pairs.get(id);
    const fx = facts.get(id);
    if (!fx || busy.has(id)) return null;
    busy.add(id);
    const changed = [];
    const legs = [];
    fx.legs.forEach((leg0, k) => {
      if (!plain(leg0)) { legs.push(leg0); return; }
      let leg = { ...leg0 };
      const ord = ordOf(leg0.ord) ?? k;
      let out = false;
      for (const a of published) if (names(a, id, ord) && !keep(a)) {
        used.add(a);
        if (a.effect === "grade_lowered" && a.from !== null) { leg.grade = a.from; changed.push({ ...a, how: "reversed" }); }
        else if (a.effect === "leg_excluded" || a.effect === "inference_refused") changed.push({ ...a, how: "reversed" });
      }
      for (const a of own) if (names(a, id, ord)) {
        used.add(a);
        if (a.effect === "grade_lowered" && a.to !== null) { leg.grade = a.to; changed.push({ ...a, how: "applied" }); }
        else if (a.effect === "leg_excluded" || a.effect === "inference_refused") { out = true; changed.push({ ...a, how: "applied" }); }
      }
      if (out) return;
      if (leg.kind === "inquiry" && filled(leg.target)) {
        const p = pairOf(leg.target);
        if (p) leg = { ...leg, answer: p };
        for (const ch of changes.get(leg.target) || []) changed.push({ ...ch, through: leg.target });
      }
      legs.push(leg);
    });
    busy.delete(id);
    const r = recompute(legs);
    const pair = r && r.ok ? r.pair : null;
    pairs.set(id, pair);
    changes.set(id, changed);
    return pair;
  }
  for (const id of facts.keys()) pairOf(id);
  for (const a of [...published.filter((x) => !keep(x)), ...own]) if (!used.has(a))
    not_applied.push({ ...a, why: a.target === "conclusion" || a.effect === "scrutiny_raised"
      ? word("case-checker.why.recorded_conclusion_claim")
      : word("case-checker.why.names_leg_case") });
  return { pairs, changes, not_applied };
}
