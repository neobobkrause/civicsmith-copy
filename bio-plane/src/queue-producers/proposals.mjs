/* queue-producers — the FINDING producer over `progressions.proposalsFeed` (R2, R10, R11; N107), moved from queue by N363.
 *
 * proposalsFeed is the ONE derivation (REC-6/7/8) and is read whole rather than re-implemented, so the queue and
 * op=proposals cannot disagree about what is open. It has ALREADY aged out every disposed finding, and its
 * disposition key is (progression_key, stage_key), the proposal's own identity, the EVENT, never (member, case). So
 * the FINDING half inherits DEC-16's shape from the producer: one op=proposedispose clears the item under every case.
 *
 * N107 (K147): progressions R31's `cardinality_exceeded` finding is published in `instances[]` and NOT aggregated
 * into `proposals[]`, because a proposal is worded "the stage is required and absent", which this finding is not. It
 * is aggregated HERE, in its own words, one item per (progression, stage) like every proposal item, and keyed the
 * same: one decision (`proposal_dispositions` is keyed by the pair) governs one item (queue R32). When the stage also has a
 * missing-stage proposal, the finding joins that item, whose kind leads and whose basis names both.
 *
 * R11 (K2581): what the item counts is counted over the instances the viewer may see, an instance seen when
 * `subjectsOf` answers it at least one bundle: `n`, `overdue_count`, the grade and the cardinality group's
 * `document_count`, and every sentence that counts them. A proposal or a group with no instance seen earns no item, so
 * nothing about an instance the viewer may not see reaches it, as a count or otherwise.
 *
 * PURE: no storage, no clock, no viewer. What needs them is the caller's, passed in: the subject bundles an instance
 * reaches through the viewer's gate, the homes of a set of subjects (queue R7) and the options on them (queue R12). */
import { weakerGrade } from "../connections/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { say, joined } from "./words.mjs";

export const CARDINALITY_EXCEEDED = "cardinality_exceeded";

const count = (n) => (n === 1 ? "one" : "other");
/* A stage is named by its label, or by its key when it was declared without one: never the word "null". */
const stageName = (x) => (typeof x.stage_label === "string" && x.stage_label.trim() ? x.stage_label : x.stage_key);
const cmpKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** The proposal's own `prior_disposition` shape, from `dispositions[]`, for a group that has no proposal to carry
 *  one. A finding still in `instances[]` is one no applying decision governs, so what is found is an earlier one. */
function priorOf(dispositions, key) {
  const d = (dispositions || []).find((x) => x && x.key === key);
  return d ? { state: d.state, reason: d.reason, decided_by: d.decided_by, at: d.at,
               definition_version: d.definition_version, definition_version_state: d.definition_version_state,
               applies: false, applies_because: d.applies_because } : null;
}

/** The open `cardinality_exceeded` findings of `feed.instances`, one group per (progression, stage), each carrying
 *  its instances, the weakest grade across them (null, undetermined, when any is), ordered as proposals are: most
 *  instances first, then key. */
export function cardinalityGroups(feed) {
  const groups = new Map();
  for (const inst of (feed && Array.isArray(feed.instances) ? feed.instances : [])) {
    for (const f of (Array.isArray(inst.findings) ? inst.findings : [])) {
      if (!f || f.kind !== CARDINALITY_EXCEEDED) continue;
      const key = `${inst.progression_key}::${f.stage_key}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, progression_key: inst.progression_key, progression_label: inst.progression_label,
              stage_key: f.stage_key, stage_label: f.stage_label, cardinality: f.cardinality,
              definition_version: inst.definition_version, instances: [] };
        groups.set(key, g);
      }
      g.instances.push({ entity_id: inst.entity_id, entity_label: inst.entity_label ?? null,
                         progression_key: inst.progression_key, definition_version: inst.definition_version,
                         document_count: f.document_count,
                         grade: f.grade_determined === true ? f.grade : null, grade_determined: f.grade_determined === true });
    }
  }
  const out = [];
  for (const g of groups.values()) {
    g.n = g.instances.length;
    g.document_count = g.instances.reduce((s, i) => s + (Number(i.document_count) || 0), 0);
    const undetermined = g.instances.some((i) => !i.grade_determined || !i.grade);
    g.grade_determined = !undetermined;
    g.grade = undetermined ? null : g.instances.map((i) => i.grade).reduce((a, b) => weakerGrade(a, b));
    out.push(g);
  }
  return out.sort((a, b) => b.n - a.n || cmpKey(a, b));
}

/** R11 (K2581): the weakest grade across instances, null with `grade_determined: false` when any is undetermined. */
function gradeOver(instances) {
  const undetermined = instances.some((i) => !i.grade_determined || !i.grade);
  return { grade_determined: !undetermined,
           grade: undetermined ? null : instances.map((i) => i.grade).reduce((a, b) => weakerGrade(a, b)) };
}

/** R11 (K2581): a proposal recounted over the instances `seen` keeps; null when none is seen. */
function proposalSeen(p, seen) {
  const instances = (p.instances || []).filter(seen);
  if (!instances.length) return null;
  const overdue_count = instances.filter((i) => i.overdue === true).length;
  const overdue = overdue_count > 0;
  return { ...p, instances, n: instances.length, overdue_count, overdue, ...gradeOver(instances),
           kinds: overdue ? ["missing_predecessor", "overdue_successor"] : ["missing_predecessor"] };
}

/** R11 (K2581): a cardinality group recounted over the instances `seen` keeps; null when none is seen. */
function groupSeen(g, seen) {
  const instances = g.instances.filter(seen);
  if (!instances.length) return null;
  return { ...g, instances, n: instances.length,
           document_count: instances.reduce((s, i) => s + (Number(i.document_count) || 0), 0), ...gradeOver(instances) };
}

/** The cardinality sentence (R43), by key: never "required and absent". `.exactly` for a stage declared to hold exactly one
 *  document, `.atmost` for any other bound; `.one` for one instance, `.other` for more. */
export function cardinalityDetail(g) {
  const held = g.cardinality === "1" ? "exactly" : "atmost";
  return say(`queue.cardinality_exceeded.detail.${held}.${count(g.n)}`, { stage: stageName(g), documents: g.document_count, n: g.n });
}

/** R2, R10: the FINDING items of `proposalsFeed`'s answer.
 *  - subjectsOf(progressionKey, entityId) → the bundle ids the viewer may see behind that instance (R11);
 *  - homesOf(subjects) → the home set (queue R7); optionsOf(subjects) → the item's options (queue R12);
 *  - subjectsMax: how many subject bundles the item names (R2: 8). */
export function proposalFindingItems(feed, { subjectsOf, homesOf, optionsOf, subjectsMax = 8 } = {}) {
  const subjectsFor = (instances, into = []) => {
    for (const inst of instances)
      for (const b of subjectsOf(inst.progression_key, inst.entity_id) || [])
        if (!into.includes(b)) into.push(b);
    return into;
  };
  /* R11 (K2581): an instance is seen when the viewer may see a bundle behind it; each count is over those alone */
  const seenMemo = new Map();
  const seen = (inst) => {
    const k = `${inst.progression_key}\u0000${inst.entity_id}`;
    if (!seenMemo.has(k)) seenMemo.set(k, (subjectsOf(inst.progression_key, inst.entity_id) || []).length > 0);
    return seenMemo.get(k);
  };
  const exceeded = new Map(cardinalityGroups(feed).map((g) => groupSeen(g, seen)).filter(Boolean).map((g) => [g.key, g]));
  const items = [];
  const item = ({ key, kind, p, subjects, prior, summary, detail, summary_key, detail_key, basis }) => ({
    id: `FINDING::${key}`,
    class: "FINDING",
    kind,
    case: homesOf(subjects),
    subject: { kind: "progression_stage", id: null, progression_key: p.progression_key, stage_key: p.stage_key,
               definition_version: p.definition_version, bundles: subjects.slice(0, subjectsMax) },
    /* D-527: the earlier decision travels with the reopened question, the producer's object unchanged. */
    prior_disposition: prior,
    summary,
    detail,
    summary_key,
    detail_key,
    basis: { source: "proposalsFeed", progression_key: p.progression_key, stage_key: p.stage_key, ...basis,
             detail: localize("queue-producers.proposals.a_finding_is_derived_d", "a finding is DERIVED (D-79): the record's own question, aggregated one per (progression, stage), graded the weakest instance and never averaged.") },
    /* A derived finding is recomputed on every read and has no creation instant to age from (U). */
    age: { state: "undetermined", reason: "derived_on_read",
           detail: "a derived finding is recomputed at read time and has no creation instant; "
                 + "the temporal signal it does carry is overdue_count on the basis" },
    assignee: null,
    assignee_role: null,
    options: optionsOf(subjects),
  });
  for (const fp of (feed && Array.isArray(feed.proposals) ? feed.proposals : [])) {
    const p = proposalSeen(fp, seen);
    if (!p) continue;                // R11: no instance seen, no item (a seen cardinality group stands on its own below)
    const g = exceeded.get(p.key) || null;
    exceeded.delete(p.key);
    const subjects = subjectsFor(p.instances || []);
    if (g) subjectsFor(g.instances, subjects);
    items.push(item({
      key: p.key, p, subjects, prior: p.prior_disposition,
      /* The ESCALATED kind leads when the stage has also crossed a deadline: one kind, the full set on the basis. */
      kind: p.overdue ? "overdue_successor" : "missing_predecessor",
      ...(() => {
        const kind = p.overdue ? "overdue_successor" : "missing_predecessor";
        const fills = { progression: p.progression_label ?? p.progression_key, stage: stageName(p), n: p.n, overdue: p.overdue_count };
        const detail_key = `queue.${kind}.detail.${count(p.n)}`;
        return { summary: say(`queue.${kind}.summary`, fills), summary_key: `queue.${kind}.summary`, detail_key,
                 detail: joined(say(detail_key, fills), g ? say("queue.cardinality_exceeded.also", { cardinality: cardinalityDetail(g) }) : "") };
      })(),
      basis: { kinds: g ? [...p.kinds, CARDINALITY_EXCEEDED] : p.kinds, n: p.n, grade: p.grade,
               grade_determined: p.grade_determined, overdue_count: p.overdue_count, surfaced_by: p.surfaced_by,
               ...(g ? { cardinality_exceeded: { n: g.n, cardinality: g.cardinality, document_count: g.document_count,
                                                 grade: g.grade, grade_determined: g.grade_determined } } : {}) },
    }));
  }
  for (const g of exceeded.values()) {
    items.push(item({
      key: g.key, p: g, subjects: subjectsFor(g.instances), prior: priorOf(feed.dispositions, g.key),
      kind: CARDINALITY_EXCEEDED,
      summary: say("queue.cardinality_exceeded.summary", { progression: g.progression_label ?? g.progression_key, stage: stageName(g) }),
      summary_key: "queue.cardinality_exceeded.summary",
      detail: cardinalityDetail(g),
      detail_key: `queue.cardinality_exceeded.detail.${g.cardinality === "1" ? "exactly" : "atmost"}.${count(g.n)}`,
      basis: { kinds: [CARDINALITY_EXCEEDED], n: g.n, grade: g.grade, grade_determined: g.grade_determined,
               overdue_count: 0, surfaced_by: "machine", cardinality: g.cardinality, document_count: g.document_count },
    }));
  }
  return items;
}
