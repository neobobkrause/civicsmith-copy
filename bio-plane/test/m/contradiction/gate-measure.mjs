/* gate-measure.mjs — M0-71: the over-strictness GATE a contradiction
 * Copied 2026-09-30 (CONTRADICTION #4, T17, N394) from `test/contradiction-gate.mjs` unchanged but for this header, so the gate
 * is this module's test (`gate.test.mjs`) and outlives the old suite's retirement.
 * judgement must pass before any candidate reaches a member
 * (CONTRADICTION-IDENTIFY-DESIGN.md §7, §9 item 2).
 *
 * `measure()` takes the pairs REC-146's `op=contradictionpairs` FORMED over a
 * labelled record, the fixture's GOLD labels, a way to quote each side, and a
 * judgement; it returns per-key figures. `gate()` turns those figures into a
 * verdict and NAMES every reason it fails. Item 3's machine judgement plugs into
 * the same two functions.
 *
 * THE GATE IS THE FALSE-CONFLICT RATE (§7): the share of `precision` and
 * `unrelated` pairs the judgement labels `world` or `record`, per key and over
 * all. Recall is measured beside it and is NOT the gate. The gate ALSO fails,
 * each by name, when what it measured cannot support a rate at all:
 *   NOTHING_COMPARED       the pairing formed no fixture pair — a 0% rate over
 *                          nothing is the record claiming more than it can
 *                          support; the answer carries the op's own empty level
 *                          instead (§6 case (a))
 *   KEY_NOT_COMPARED:Kn    a gold pair of key Kn was not formed (§7 control 1)
 *   UNLABELLED_PAIR:Kn     the pairing formed a pair the fixture does not label,
 *                          so the fixture's accounting is not the record's
 *   JUDGEMENT_ABSENT:Kn    a compared pair came back without one of §5's five
 *                          labels — a disabled judgement is not a clean one
 *   NO_NEGATIVES:Kn        a key has no precision/unrelated pair to be strict on
 *   FALSE_CONFLICT:Kn|ALL  the rate is above THRESHOLD (§7 control 2)
 */

export const LABELS = ["world", "record", "precision", "unrelated", "undetermined"];
export const KEYS = ["K1", "K2", "K3", "K4"];
const NEGATIVE = new Set(["precision", "unrelated"]);
const CONFLICT = new Set(["world", "record"]);

/* THE THRESHOLD, set by the first measurement (M0-71, measurements/M-118.md) and
   recorded there with the corpus size. A rate is compared as a fraction; `0`
   means no precision or unrelated pair of this corpus may be labelled a
   conflict, on any key. */
export const THRESHOLD = 0;

/* A side's identity in the fixture's terms: a document side by its capture, a
   claim side by the reading it is held on. Order-free across a and b. */
export const handleOf = (s) => (s && s.kind === "claim" ? `${s.inquiry}|${s.version}` : String(s?.capture_sha ?? "-"));
export const pairId = (key, a, b) => `${key}:${[a, b].sort().join(" <> ")}`;

/** measure({ read, gold, sideOf, judge })
 *   read   — the `op=contradictionpairs` answer
 *   gold   — Map(pairId -> { label, shape, id })
 *   sideOf — (pairSide, pair) => { text, doctype?, date?, role? }
 *   judge  — (input) => { label, reason }                                         */
export function measure({ read, gold, sideOf, judge, context = () => null }) {
  const pairs = Array.isArray(read?.pairs) ? read.pairs : [];
  const per = Object.fromEntries(KEYS.map((k) => [k, {
    gold: 0, compared: 0, missing: [], unlabelled: [], absent: [],
    negatives: 0, false_conflicts: 0, positives: 0, correct: 0, undetermined: 0, rows: [] }]));
  for (const [id, g] of gold) per[id.slice(0, 2)].gold++;
  const seen = new Set();
  for (const p of pairs) {
    const k = per[p.key]; if (!k) continue;
    const id = pairId(p.key, handleOf(p.a), handleOf(p.b));
    const g = gold.get(id);
    if (!g) { k.unlabelled.push(id); continue; }
    seen.add(id); k.compared++;
    let out = null;
    try { out = judge({ key: p.key, context: context(p), a: sideOf(p.a, p), b: sideOf(p.b, p) }); } catch { out = null; }
    const label = out && LABELS.includes(out.label) ? out.label : null;
    k.rows.push({ id: g.id, shape: g.shape, gold: g.label, got: label, reason: out?.reason ?? null });
    if (!label) { k.absent.push(g.id); continue; }
    if (label === "undetermined") k.undetermined++;
    if (NEGATIVE.has(g.label)) { k.negatives++; if (CONFLICT.has(label)) k.false_conflicts++; }
    else { k.positives++; if (label === g.label) k.correct++; }
  }
  for (const [id, g] of gold) if (!seen.has(id)) per[id.slice(0, 2)].missing.push(g.id);
  const sum = (f) => KEYS.reduce((n, k) => n + per[k][f], 0);
  const rate = (n, d) => (d ? n / d : null);
  for (const k of KEYS) {
    per[k].false_conflict_rate = rate(per[k].false_conflicts, per[k].negatives);
    per[k].recall = rate(per[k].correct, per[k].positives);
  }
  const all = { gold: sum("gold"), compared: sum("compared"), negatives: sum("negatives"),
    false_conflicts: sum("false_conflicts"), positives: sum("positives"), correct: sum("correct"),
    undetermined: sum("undetermined") };
  all.false_conflict_rate = rate(all.false_conflicts, all.negatives);
  all.recall = rate(all.correct, all.positives);
  /* THE EMPTY ANSWER NAMES ITS LEVEL. Nothing compared is §6 case (a) — carried
     from the op's own per-key absence, never printed as a bare zero. */
  const empty = all.compared === 0
    ? { case: "a", levels: Object.fromEntries((read?.keys ?? []).map((x) => [x.key, x.absence?.level ?? null])),
        says: "NOTHING WAS COMPARED: the pairing formed no pair over this record, so there is no rate to "
            + "state. That is a fact about the record (sparse at the level each key names), not evidence "
            + "the judgement is strict." }
    : null;
  return { per, all, empty };
}

export function gate(m, threshold = THRESHOLD) {
  const fails = [];
  if (!m || m.all.compared === 0) return { pass: false, fails: ["NOTHING_COMPARED"] };
  for (const k of KEYS) {
    const x = m.per[k];
    if (x.missing.length) fails.push(`KEY_NOT_COMPARED:${k}`);
    if (x.unlabelled.length) fails.push(`UNLABELLED_PAIR:${k}`);
    if (x.absent.length) fails.push(`JUDGEMENT_ABSENT:${k}`);
    if (x.gold && !x.negatives && !x.missing.length && !x.absent.length) fails.push(`NO_NEGATIVES:${k}`);
    if (x.false_conflict_rate !== null && x.false_conflict_rate > threshold) fails.push(`FALSE_CONFLICT:${k}`);
  }
  if (m.all.false_conflict_rate !== null && m.all.false_conflict_rate > threshold) fails.push("FALSE_CONFLICT:ALL");
  return { pass: fails.length === 0, fails };
}
