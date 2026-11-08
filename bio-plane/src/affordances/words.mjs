/* affordances — R39 (B1a.15; K1486): THE CLOSED VOCABULARIES T33'S NEW MODULES REFUSE AGAINST, WITH THE WORDS MEMBERS SEE.
 *
 * Each is published as `{values, words}`: `values` the very object its owner answers (the same reference, never a copy,
 * R4's terms), and `words` mapping each value to `{word}`, or `{word, provisional: true}`. The word is, in R39's order as
 * R62 (K3366; DEC-253) amends it:
 *   1. the design's word for the value, read by key through `setup-words`' `word` (`label.linekinds.*`, `label.linecapacities.*`,
 *      `label.lineroles.<kind>.*`, `label.money{kinds,phases,stages,bases,precisions}.*`, `label.identityclaimkinds.*`, and for a
 *      connection kind `label.connectionkinds.*`): this module holds no English, only the key each value is read by;
 *   2. else the owner's word registered with `connection-grammar` (`kindOf`), where the owner registers the value as a kind
 *      (events' roles and relation kinds, every connection kind the design keys no word of);
 *   3. else one plain word made from the value itself (underscores and joined words spaced, `Event` dropped from a
 *      status), marked `provisional: true` until the design stream keys one.
 * No word says "knows", "network", "conflict", "suspicious" or "most connected", or "ledger", "diverted" or "misused".
 *
 * A vocabulary whose owner is not composed answers ABSENT, never empty: an owner is composed once it has registered with
 * `connection-grammar`'s default registry (events at its `start`, the plane's composition; lines, money and people at
 * load), so the answer is read at the moment of the call, as `action_kind` is (R26). Nothing here writes (R22). */

import { owners, kindOf } from "../connection-grammar/index.mjs";
import { word as wordByKey, hasWord } from "../setup-words/index.mjs";
import { DATED_KINDS, EVENT_KINDS, STATUSES, ROLES as EVENT_ROLES, RELATION_KINDS as EVENT_RELATION_KINDS }
  from "../events/index.mjs";
import { kinds as lineKinds, capacities as lineCapacities, roles as lineRoles, CONNECTION_KINDS as LINE_CONNECTION_KINDS }
  from "../lines/index.mjs";
import { kinds as moneyKinds, phases as moneyPhases, stages as moneyStages, bases as moneyBases,
         precisions as moneyPrecisions } from "../money/index.mjs";
import { CLAIM_KINDS } from "../people/index.mjs";

/* R59 (K3250, K3254; walk row 15; `screens-investigate` R24), R60 (N1090; DEC-236 (B204 (3))): each connection kind's design group, the
 * design's six (the Follow choices of `mock-screens.js`'s graph, its `KINDS`): `pos` "Positions and memberships", `part` "Took part",
 * `money` "Money", `ment` "Mentioned together", `same` "Same person?", `step_source` (its own, R60). A frozen map in this module, never the owners': the groups are the design's, the
 * kinds the owners'. Every kind the registry holds is in it (the test is total over the registry); the design gives no group to the
 * kinds below that no screen draws as people's ties, so each takes the design group its own meaning is nearest, BOB's to re-rule:
 *   pos    a post, a membership or a standing relation of bodies and offices: `line:*` (the posts held, `line:holds:*`, and the
 *          structure between bodies), `entities`' three, and the standing duties (`owes`, `owed_to`, `holds_power`);
 *   part   a recorded event or decision a party took part in: every `event_*` kind, the duty's meeting and use (`met_by`,
 *          `used_in`), the law and court links between instruments (`law_*`, `court_*`, `in_force_at_event`), and a stage placed on
 *          a declared flow;
 *   money  (R72, T53) the money owner's five kinds, `money_transfer`, `money_payment`, `money_contribution`, `money_revenue` and
 *          `money_other`, in place of `money_flow`;
 *   ment   the weakest ties, a lead and never a finding: `mentioned_together`, a member's `hunch`, `in_tension_with`, and
 *          (R72) `named_in`, an entity named in a document;
 *   same   a member's claim about whether two records are one person (`same_as`, `not_same_as`, `unsure`);
 *   step_source  (R60) a step backed by a passage (`step_source`): neither "Mentioned together" nor a position, so its own group. */
const GROUP_KINDS = {
  pos: ["proxy_for", "member_of", "overlaps", "owes", "owed_to", "holds_power", "line:part_of", "line:post_in", "line:reports_to",
    "line:oversees", "line:appoints", "line:seat_on", "line:funds", "line:contracts_with", "line:acts_for", "line:responsible_for",
    "line:custodian_of", "line:successor_of", "line:belongs_to", "line:educated_at", "line:credentialed_by", "line:owns_interest_in",
    "line:related_to", "line:associate_of", "line:party_to", "line:appeal_of", "line:consolidated_with", "line:remanded_to",
    "line:arises_from", "line:holds:employee", "line:holds:elected", "line:holds:appointed", "line:holds:acting", "line:holds:interim",
    "line:holds:ex_officio", "line:holds:board_member", "line:holds:officer_or_director", "line:holds:partner",
    "line:holds:military_service", "line:holds:volunteer", "line:holds:contractor", "line:holds:other"],
  part: ["event_actor", "event_organizer", "event_mover", "event_seconder", "event_voted", "event_present", "event_speaker",
    "event_sender", "event_recipient", "event_copied", "event_signatory", "event_decider", "event_author", "event_implementer",
    "event_party", "event_subject", "event_concerns", "event_authorises", "event_answers", "event_amends", "event_reverses",
    "event_stated_cause", "event_within", "event_precedes", "met_by", "used_in", "law_amends", "law_repeals", "law_renumbers",
    "law_recodifies", "law_refers_to", "law_defines", "law_excepts", "law_implements", "law_incorporates", "court_interprets",
    "court_applies", "court_holds_invalid", "court_requires", "in_force_at_event", "placed_on_flow"],
  money: ["money_transfer", "money_payment", "money_contribution", "money_revenue", "money_other"],
  ment: ["mentioned_together", "hunch", "in_tension_with", /* R72 (T53): a document a capture names an entity in */ "named_in"],
  same: ["same_as", "not_same_as", "unsure"],
  step_source: ["step_source"],
};
export const CONNECTION_GROUPS = Object.freeze(Object.fromEntries(
  Object.entries(GROUP_KINDS).flatMap(([group, kinds]) => kinds.map((k) => [k, group]))));
/** The design's six groups, in the design's order (the Follow choices; R60). */
export const CONNECTION_GROUP_NAMES = Object.freeze(["pos", "part", "money", "ment", "same", "step_source"]);

/* R72 (T53; N1260, DEC-409 "dimension"): each connection kind's dimension, the kind of thing it leads to, for "Follow from here" (R73):
 * one of `people`, `organizations`, `money`, `donations`, `events`, `documents` and `law`, or null for a member's `hunch`, which joins any
 * two things. A frozen map in this module beside the groups, BOB's to re-rule as R59's is; the kinds are the owners'. Every kind the
 * registry holds is in it (the test is total over the registry), and it changes no group. */
const DIMENSION_KINDS = {
  people: ["same_as", "not_same_as", "unsure", "proxy_for", "overlaps", "line:related_to", "line:associate_of", "line:educated_at",
    "line:credentialed_by"],
  organizations: ["member_of", "line:part_of", "line:post_in", "line:reports_to", "line:oversees", "line:appoints", "line:seat_on",
    "line:funds", "line:contracts_with", "line:acts_for", "line:responsible_for", "line:custodian_of", "line:successor_of",
    "line:belongs_to", "line:owns_interest_in", "line:holds:employee", "line:holds:elected", "line:holds:appointed", "line:holds:acting",
    "line:holds:interim", "line:holds:ex_officio", "line:holds:board_member", "line:holds:officer_or_director", "line:holds:partner",
    "line:holds:military_service", "line:holds:volunteer", "line:holds:contractor", "line:holds:other"],
  money: ["money_transfer", "money_payment", "money_revenue", "money_other"],
  donations: ["money_contribution"],
  events: ["event_actor", "event_organizer", "event_mover", "event_seconder", "event_voted", "event_present", "event_speaker",
    "event_sender", "event_recipient", "event_copied", "event_signatory", "event_decider", "event_author", "event_implementer",
    "event_party", "event_subject", "event_concerns", "event_authorises", "event_answers", "event_amends", "event_reverses",
    "event_stated_cause", "event_within", "event_precedes", "placed_on_flow"],
  documents: ["mentioned_together", "named_in", "step_source", "in_tension_with"],
  law: ["law_amends", "law_repeals", "law_renumbers", "law_recodifies", "law_refers_to", "law_defines", "law_excepts", "law_implements",
    "law_incorporates", "court_interprets", "court_applies", "court_holds_invalid", "court_requires", "in_force_at_event", "owes",
    "owed_to", "holds_power", "met_by", "used_in", "line:party_to", "line:appeal_of", "line:consolidated_with", "line:remanded_to",
    "line:arises_from"],
};
/** R72: the seven dimensions, in the order R72 names them. */
export const CONNECTION_DIMENSION_NAMES = Object.freeze(["people", "organizations", "money", "donations", "events", "documents", "law"]);
/** R72: kind to dimension; a `hunch` kind is null. */
export const CONNECTION_DIMENSIONS = Object.freeze({
  ...Object.fromEntries(Object.entries(DIMENSION_KINDS).flatMap(([dim, kinds]) => kinds.map((k) => [k, dim]))),
  hunch: null,
});

/** A plain word made from a value: `stated_cause` → "stated cause", `procuringEntity` → "procuring entity",
 *  `EventMovedOnline` → "moved online". */
export const plainWord = (v) => String(v).replace(/^Event(?=[A-Z])/, "").replace(/_/g, " ")
  .replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const registered = (kind) => { const k = kindOf(kind); return k && typeof k.word === "string" && k.word ? k.word : null; };
const provisional = (v) => ({ word: plainWord(v), provisional: true });

/* R62: the design's word for a value, by key (`word`), or null where the list holds no key (the design stream has not given
   one: R39's provisional word then stands). Never a sentence of this module's own. */
const keyed = (key, vars) => (hasWord(key) ? wordByKey(key, vars) : null);

/** `{values, words}` over a list of string values, each word from `wordOf(v)` or provisional. */
function vocabulary(values, wordOf = () => null) {
  const words = {};
  for (const v of values) { const w = wordOf(v); words[v] = w ? { word: w } : provisional(v); }
  return { values, words };
}

/* The design's keyed words, by vocabulary: `label.<set>.<value>` (DEC-253), a value's spaces written `_` in its key
   (`ex officio` is `ex_officio`, `fee charged` is `fee_charged`). */
const slug = (v) => String(v).replace(/ /g, "_");
const labelWord = (set) => (v) => keyed(`label.${set}.${slug(v)}`);

/* `holds` is registered per capacity (`line:holds:<capacity>`), so the kind alone has no registered word; the design keys it. */
const lineKindWord = (k) => {
  const design = labelWord("linekinds")(k);
  if (design) return design;
  const entry = LINE_CONNECTION_KINDS.find((c) => c.kind === `line:${k}`);
  return entry ? registered(entry.kind) : null;
};

/* A connection kind's word: the design's by key where it keys one (a line kind by `label.linekinds.*`, a post held by
   `label.connectionkinds.holds` with its capacity's word, any other by `label.connectionkinds.*`), else the owner's registered
   word (events', people's claims, the kinds the design keys no word of). */
const connectionWord = (kind, ownerWord) => {
  const held = /^line:holds:(.+)$/.exec(kind);
  if (held) {
    const capacity = labelWord("linecapacities")(held[1]);
    return (capacity !== null && keyed("label.connectionkinds.holds", { capacity })) || ownerWord;
  }
  const line = /^line:(.+)$/.exec(kind);
  return (line ? labelWord("linekinds")(line[1]) : labelWord("connectionkinds")(kind)) || ownerWord;
};

/** R39: the five vocabularies of `events`, which the Durable Object composes (the owner registers at its `start`) and a
 *  Worker isolate cannot. */
export const EVENTS_VOCABULARY_KEYS = Object.freeze(["event_kinds", "dated_fact_kinds", "event_statuses", "participant_roles",
  "event_relation_kinds"]);

/** R39: the vocabularies of the composed owners, at the moment of the call; an uncomposed owner's are left out. */
export function composedVocabularies() {
  const reg = owners();
  const composed = new Set(reg.map((o) => o.owner));
  const out = {};
  if (composed.has("events")) {
    out.event_kinds = vocabulary(EVENT_KINDS);
    out.dated_fact_kinds = vocabulary(DATED_KINDS);
    out.event_statuses = vocabulary(STATUSES);
    out.participant_roles = vocabulary(EVENT_ROLES, (r) => registered(`event_${r}`));
    out.event_relation_kinds = vocabulary(EVENT_RELATION_KINDS, (k) => registered(`event_${k}`));
  }
  if (composed.has("lines")) {
    const kinds = lineKinds();
    out.line_kinds = vocabulary(kinds, lineKindWord);
    out.line_capacities = vocabulary(lineCapacities(), labelWord("linecapacities"));
    /* each kind's own role list, the very array `roles(kind)` answers; a kind that takes none is not listed */
    const values = {}, words = {};
    for (const k of kinds) {
      const rs = lineRoles(k);
      if (!rs || !rs.length) continue;
      values[k] = rs;
      words[k] = vocabulary(rs, labelWord(`lineroles.${k}`)).words;
    }
    out.line_roles = { values, words };
  }
  if (composed.has("money")) {
    out.money_kinds = vocabulary(moneyKinds(), labelWord("moneykinds"));
    out.money_phases = vocabulary(moneyPhases(), labelWord("moneyphases"));
    out.money_stages = vocabulary(moneyStages(), labelWord("moneystages"));
    out.money_bases = vocabulary(moneyBases(), labelWord("moneybases"));
    out.money_precisions = vocabulary(moneyPrecisions(), labelWord("moneyprecisions"));
  }
  if (composed.has("people")) out.identity_claim_kinds = vocabulary(CLAIM_KINDS, (k) => labelWord("identityclaimkinds")(k) ?? registered(k));
  /* N695 (K1864): each kind carried once, in the others' shape: `values` the kind names in `owners()`'s order, `words`
     each kind's word (R62: by key where the design keys one), class, owner and design group (R59, R60); the registry entries themselves are not carried beside them. */
  if (reg.length) {
    const values = [], words = {};
    for (const o of reg) for (const k of o.kinds) {
      values.push(k.kind);
      words[k.kind] = { word: connectionWord(k.kind, k.word), class: k.class, owner: o.owner, group: CONNECTION_GROUPS[k.kind] ?? null,
                       /* R72: its dimension; null for a hunch kind, or for a kind the map lacks (the test is total) */
                       dimension: CONNECTION_DIMENSIONS[k.kind] ?? null };
    }
    out.connection_kinds = { values, words };
  }
  return out;
}
