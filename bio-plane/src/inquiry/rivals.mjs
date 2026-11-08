/* inquiry — a rival explanation's standing (requirements: `build/requirements/inquiry.md`, R91; F2, IV-H3, BD-17).
 * The vocabularies a conclusion names its rivals in, the grammar's arm that judges a document's `rivals_named` block,
 * and the one reader of that block. Standing itself is computed by `Inquiry.rivalStanding` each time it is asked, from
 * the document and the bar judgment registered with `onBarJudged`; nothing here stores it. Pure; nothing here throws.
 *
 * THE BYTES. A conclusion names its rivals as a list of maps, one per rival it names:
 *   rivals_named:
 *     - rival: HYP-…
 *       named: case | not_case | neither
 * A rival the list leaves out is named `neither`, as one listed `neither` is. */

import { isHypothesisId } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";

/** R91: what a conclusion says of one rival: that it is the case, that it is not, or neither. */
export const RIVAL_NAMINGS = Object.freeze(["case", "not_case", "neither"]);
/** R91: a rival's standing, as `rivalStanding` answers it. */
export const RIVAL_STANDINGS = Object.freeze(["not_established", "concluded_at_bar", "ruled_out_at_bar"]);
/** R91 (IV-H1): a question holds at most six rivals, so a conclusion names at most six and a read asks of at most six. */
export const RIVALS_MAX = 6;

const isMap = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const NAMING_FIELDS = ["rival", "named"];

/** R91: the document's `rivals_named` as `[{rival, named}]`, in its order; `[]` when the document carries none; null
 *  when the block is malformed (R11's arm refuses such a document, so a held one is never read as naming anything).
 *  Never throws. */
export function rivalsNamedOf(fm) {
  try {
    if (!isMap(fm) || fm.rivals_named === undefined || fm.rivals_named === null) return [];
    const list = fm.rivals_named;
    if (!Array.isArray(list) || list.length > RIVALS_MAX) return null;
    const out = [];
    const seen = new Set();
    for (const e of list) {
      if (!isMap(e) || Object.keys(e).some((k) => !NAMING_FIELDS.includes(k))) return null;
      const rival = typeof e.rival === "string" ? e.rival.trim() : null;
      if (!isHypothesisId(rival) || seen.has(rival) || !RIVAL_NAMINGS.includes(e.named)) return null;
      seen.add(rival);
      out.push({ rival, named: e.named });
    }
    return out;
  } catch { return null; }
}

/** R91, R11: the grammar's arm over `rivals_named`, one finding (code `RIVALS_NAMED_MALFORMED`) when the block is not a
 *  list of at most six `{rival, named}` entries, each rival a `HYP-` id named once, each `named` one of
 *  `RIVAL_NAMINGS`; none otherwise. Judged at every state, so a reopened question keeps the naming its conclusion
 *  carried with no edit. Never throws. */
export function rivalsNamedFindings(fm) {
  if (rivalsNamedOf(fm) !== null) return [];
  return [{ check: "C-2.8", code: "RIVALS_NAMED_MALFORMED",
            detail: localize("inquiry.rivals.rivals_named_malformed",
              "`rivals_named` lists the rival explanations this conclusion names, at most {max}: each entry names one hypothesis of the question (`rival`, a HYP- id, named once) and says whether the conclusion finds it the case, not the case, or neither (`named`: {namings}), and nothing else.",
              { max: String(RIVALS_MAX), namings: RIVAL_NAMINGS.join(", ") }) }];
}
