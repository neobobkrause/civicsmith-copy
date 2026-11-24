/* The asking scope (R1, R2; K1450, K1470, K1489, C:B-3). ASK_SCOPE is the one closed list of plane reads an ask may
 * make; credentials holds the same list as its grant's class (`AI_GRANT_OPS`, its R28; K1505 (14)), and a copy test
 * holds the two equal both ways, `rule` included (K1603, K1609). Every entry names its op, the module whose read it is,
 * and the ruling that admitted it (a recorded widening, D9, DEC-55). It holds no `sources*` op, no member history, no administrative op and no export.
 *
 * `scrubRead` is R2: a read made under a grant never answers, names or counts a member's declared tie (`MTI-`), the
 * link from a source to a person, or a row of a project hidden from the asking member. Pure over its predicate. */

const e = (op, owner, ruling) => Object.freeze({ op, owner, ruling });

/** R1: the asking scope, sorted by op, each op named as the plane routes it (N580; K1603, K1609), so the list equals
 *  credentials' `AI_GRANT_OPS` both ways. `rule` is R7's door to every rule service (R8–R12), J1 (1). */
export const ASK_SCOPE = Object.freeze([
  e("calculation", "calculations", "C:B-3"),
  e("career", "people", "K1470"),
  e("committedagainstpaid", "money", "K1470"),
  e("dutiesof", "duties", "K1450"),
  e("dutyoccurrences", "duties", "K1450"),
  e("entity", "entities", "K1450"),
  e("entitybyalias", "entities", "C:B-3"),
  e("eventsfor", "events", "K1470"),
  e("explore", "explore", "K1470"),
  e("frontier", "retrieval", "K1450"),
  e("holderat", "lines", "K1470"),
  e("linesof", "lines", "K1450"),
  e("meaningrows", "retrieval", "K1450"),
  e("money", "money", "C:B-3"),
  e("moneyof", "money", "K1470"),
  e("profiles", "jurisdictions", "K1450"),
  e("relation", "entities", "K1450"),
  e("resolutions", "entities", "C:B-3"),
  e("rule", "answers", "K1450"),
  e("search", "retrieval", "K1450"),
  e("searchfields", "retrieval", "K1450"),
  e("standard", "standards", "K1450"),
  e("standardinforce", "standards", "K1450"),
  e("standards", "standards", "K1450"),
  e("strengthbarof", "strength", "K1450"),
  e("structureat", "lines", "K1609"),
  e("timeline", "events", "K1470"),
]);

const OPS = new Set(ASK_SCOPE.map((x) => x.op));

/** R1: whether an op is in the asking scope. Pure; never throws. */
export function askAdmits(op) {
  return typeof op === "string" && OPS.has(op);
}

/** R1 (T35; N686, K1837): the whole reach of mode `draft` (`run-rules`' R21) is the asking scope: a draft reads only
 *  what `askAdmits` admits, through `logRead` under the grant its member's act mints, so R2's removals hold for every
 *  read it makes. It is not narrowed for a draft (a firsthand field or a member's switch off reads nothing at all, and
 *  that is the caller's to keep, `wizard-scripts` R25); `askAdmits` itself answers, so the two cannot drift. (T37;
 *  N669, K2200, K2201) A translation draft is the exception: it reads nothing of the record, the asking scope included
 *  (`run-rules` R22). `kind` is the draft's kind as `run-rules`' `DRAFT_KINDS` names it, `own_words` when absent; any
 *  kind but `own_words` reads nothing (fail closed). Pure; never throws. */
export function draftAdmits(op, kind = "own_words") {
  return kind === "own_words" && askAdmits(op);
}

const ID = /^[A-Z]{2,6}-\d{4}-[A-Za-z0-9-]+$/;
const isTie = (s) => /^MTI-\d{4}-/.test(s);
const isSource = (s) => typeof s === "string" && /^SRC-\d{4}-/.test(s);
/** Keys whose number counts the rows of a list beside them (R2: a count counts none of the rows removed). */
const COUNT_KEYS = ["count", "total", "n", "resolution_count", "defect_count", "never_looked_count", "recandidate_count",
                    "alias_count"];
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** A row the scrub removes: it names a tie, is a source-to-person link, or names a hidden bundle. */
function tainted(obj, hidden) {
  if (isSource(obj.source) && obj.person !== undefined) return true;
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && ID.test(v) && (isTie(v) || hidden(v))) return true;
  }
  return false;
}

function scrubNode(node, hidden) {
  if (Array.isArray(node)) {
    let removed = 0;
    const out = [];
    for (const x of node) {
      if (typeof x === "string") {
        if (ID.test(x) && (isTie(x) || hidden(x))) { removed++; continue; }
        out.push(x);
      } else if (plain(x) || Array.isArray(x)) {
        const r = scrubNode(x, hidden);
        if (r.drop) { removed++; continue; }
        out.push(r.value);
      } else out.push(x);
    }
    return { drop: false, value: out, removed };
  }
  if (!plain(node)) return { drop: false, value: node, removed: 0 };
  if (tainted(node, hidden)) return { drop: true };
  const out = {};
  let removed = 0;
  for (const [k, v] of Object.entries(node)) {
    if (plain(v)) {
      const r = scrubNode(v, hidden);
      if (r.drop) return { drop: true };
      out[k] = r.value;
    } else if (Array.isArray(v)) {
      const r = scrubNode(v, hidden);
      removed = Math.max(removed, r.removed);   /* two lists beside one count list the same rows */
      out[k] = r.value;
    } else out[k] = v;
  }
  if (removed) for (const k of COUNT_KEYS) if (typeof out[k] === "number") out[k] = Math.max(0, out[k] - removed);
  return { drop: false, value: out, removed: 0 };
}

/** R2: the read's answer with every tie, source link and hidden row removed, and each count beside a list counting
 *  none of them. `hidden(id)` answers whether an id names a held bundle the asking member may not see. A read whose
 *  answer is itself about such a thing answers `{ok: true, found: false}`, as for nothing held. Never throws. */
export function scrubRead(answer, hidden = () => false) {
  try {
    const h = (id) => { try { return !!hidden(id); } catch { return true; } };
    if (!plain(answer) && !Array.isArray(answer)) return answer;
    const r = scrubNode(answer, h);
    return r.drop ? { ok: true, found: false } : r.value;
  } catch {
    return { ok: true, found: false };
  }
}
