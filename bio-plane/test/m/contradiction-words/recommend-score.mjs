/* contradiction-words R41: how a recorded run of the recommender is scored against the fixture of dissolved pairs.
 *
 * Per run:
 *   answered      pairs the run answered, by its pair number, out of the fixture's
 *   out_of_list   coordinates named that are not in that pair's own list (the prompt's first rule; the plane refuses
 *                 them at op=contradictionrecommend, C-93.29)
 *   no_reason     coordinates named with a blank reason (refused there too, C-93.30)
 *   verdict_words reasons that use a word the prompt forbids: which side is wrong, or a kind or cause of conflict
 *   hit           dissolved pairs for which at least one coordinate named is one the member named (the recall)
 *   named, named_gold  coordinates named, and of those how many the member named (the precision)
 *   empty         pairs answered with no coordinate (honest, never forced)
 */
import { DISSOLVED_PAIRS, RESPECTS } from "./recommend-fixture.mjs";

const VERDICT = /\b(wrong|incorrect|false|error|mistaken|misquot\w*|double[- ]speak|revers\w*|lie|lying|inaccura\w*)\b/i;

export function score(answer, pairs = DISSOLVED_PAIRS) {
  const out = { answered: 0, of: pairs.length, out_of_list: 0, no_reason: 0, verdict_words: 0,
                hit: 0, named: 0, named_gold: 0, empty: 0 };
  const byN = new Map((Array.isArray(answer) ? answer : []).map((a) => [a && a.n, a]));
  pairs.forEach((p, i) => {
    const a = byN.get(i + 1);
    if (!a || !Array.isArray(a.coordinates)) return;
    out.answered++;
    if (a.coordinates.length === 0) out.empty++;
    let hit = false;
    for (const c of a.coordinates) {
      out.named++;
      if (!RESPECTS[p.key].includes(c && c.coordinate)) out.out_of_list++;
      if (!c || typeof c.reason !== "string" || !c.reason.trim()) out.no_reason++;
      else if (VERDICT.test(c.reason)) out.verdict_words++;
      if (p.gold.includes(c && c.coordinate)) { out.named_gold++; hit = true; }
    }
    if (hit) out.hit++;
  });
  return out;
}
