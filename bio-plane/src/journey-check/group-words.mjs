/* journey-check R17 (N1160, U15; DEC-281; K3472): no served page or word row says "group" for a team. The rule is this
   module's own (ARCH, 23 Nov 2026: the earlier design's `build_words.mjs` is history and never run): `TEAM_WORD`, the word
   as a member reads it, and `OTHER_SENSE`, the rows that keep it in another sense, each named with its sense. Identifiers
   (`{group}`, `group-identity`, op names) are not text: `TEAM_WORD` leaves a word inside braces, a dotted key or a
   hyphenated name alone. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WORD_ROWS } from "../setup-words/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const WORDS_JSON = join(ROOT, "docs", "development", "ux-substrate", "screens", "words.json");

/* "group" or "groups" as a word a member reads, in any case. */
export const TEAM_WORD = /(^|[^{\w.-])groups?\b(?![}\w-])/i;

/* The rows that keep "group" in another sense: `[ids, sense]`, each id a word-list key (a `*` stands for one key part). */
export const OTHER_SENSE = Object.freeze([
  [["citation.checks.bad_ground", "citation.index.bad_ground", "citation.index.repair_add_to_group"], "a citation group"],
  [["inquiry-grammar.checks.a_passage_that_cuts_against_the_conclusion", "inquiry-grammar.grammar.grounds_i_declares_label_which_p",
    "inquiry-grammar.grammar.take_the_passage_out_of_its_ground_first", "inquiry.index.basis_raw_is_claimed_by", "inquiry.index.grounds_i_legs_must_be",
    "inquiry.index.grounds_i_legs_names_ord", "inquiry.index.pass_grounds_an_array", "inquiry.index.the_structure_this_would_author",
    "inquiry.next.group_strength_weakest", "case-authoring.document.axis_group_ground_state"], "a ground, which groups passages or legs"],
  [["run-productions.declared.suggest"], "a numbered group of a list (\u00a74 group 2)"],
  [["refusal.PARTITION_INDEPENDENCE_*", "refusal.BAD_TERMS", "refusal.NO_PARTITION", "refusal.BAD_PARTITION", "refusal.BAD_STATEMENT",
    "strength.index.a_standard_of_evidence_is_a_property_of_a_project", "strength.index.group_carries_no_name", "strength.index.group_lists_no_reasons",
    "strength.index.group_names_something_other_than_a_position", "strength.index.groups_name_is_longer_than_200_characters", "strength.index.groups_were_proposed_and_a_written_reading_holds",
    "strength.index.is_not_a_question_so_it_has_no_reasons", "strength.index.no_question_by_that_id_is_readable_no_reasons", "strength.index.pass_partition_a_non_empty_list_of_groups",
    "strength.index.reason_positions_are_in_no_group", "strength.index.two_groups_are_both_named",
    "basis-versions.claimed", "basis-versions.unclaimed", "basis-versions.unstated"], "a group of reasons in a partition"],
  [["calculations.says.group_two_like", "calculations.why.act_undetermined_falls", "calculations.why.groups_act_like",
    "calculations.application.the_share_of_each", "calc-grammar.recipe.why_its_groups_sum_is"], "a group of figures in a calculation"],
  [["link-sweep.sweep-match.a_closes_no_group", "link-sweep.sweep-match.a_named_group_s", "link-sweep.sweep-match.an_unclosed_group", "link-sweep.sweep-match.an_unclosed_group_name", "link-sweep.sweep-match.an_unopened_group", "link-sweep.sweep-match.escape_refers_back_to_a", "link-sweep.sweep-match.the_group_k", "link-sweep.sweep-match.v1_is_not_a_group",
    "court-citations.translate.back_reference_to_v1_before", "query-language.query.select_name_as_field_fieldref"],
    "a group in a pattern or a query"],
  [["entity.relation.kind.help", "screen.group-identity.kind.community", "screen.group-identity.kind.issue", "screen.group-identity.kind.professional",
    "screen.site.line2", "public-read.neighborhood_issue_groups", "refusal.ADDRESSEE_REFUSED", "action-grammar.checks.copied_i_is_not_a",
    "skills.skilldoctrine.an_action_is_addressed_to"], "an organization in the world"],
  [["ai-use.index.a_limit_s_owner_is", "ai-use.index.an_estimate_is_for", "ai-use.index.exploring_is_approved_for", "ai-use.index.limits_are_read_for",
    "ai-use.index.the_use_names_no_paying", "ai-use.index.use_is_read_for", "ai-use.index.use_over_time_is_read_for",
    "promotion.index.this_store_records_no_producing", "skills.skilldoctrine.the_count_a_run_publishes"], "the owner kind `group` an account or a count names"],
]);

const idPattern = (id) => id.split("*").map((p) => p.replace(/[.\-]/g, "\\$&")).join("[A-Za-z0-9_]+");

/* The rule: `{TEAM_WORD, GROUP_SENSE}`, `GROUP_SENSE` matching the key of every row `OTHER_SENSE` names. */
export function designRule(sense = OTHER_SENSE) {
  return { TEAM_WORD, GROUP_SENSE: new RegExp(`^(${sense.flatMap(([ids]) => ids).map(idPattern).join("|")})$`) };
}

/* A row's English as a member reads it: markup and the "more" span taken out (build_words.mjs `plain`). */
export const plain = (s) => String(s).replace(/<span class=["']?more["']?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/* The places `text` says "group" for a team: `[{at}]`, each with the words around it. */
export function groupIn(text, { rule = designRule() } = {}) {
  const t = String(text).replace(/\s+/g, " ");
  const re = new RegExp(rule.TEAM_WORD.source, "gi");
  const out = [];
  for (const m of t.matchAll(re)) {
    const i = m.index + m[1].length;
    out.push({ at: t.slice(Math.max(0, i - 40), i + 45).trim() });
  }
  return out;
}

/* The rows of `rows` (`[{key, en}]`) that say "group" for a team: every row but those the design's `GROUP_SENSE` keeps. */
export function rowsSayingGroup(rows, { rule = designRule() } = {}) {
  const out = [];
  for (const r of rows) {
    if (rule.GROUP_SENSE.test(r.key)) continue;
    const at = groupIn(plain(r.en), { rule });
    if (at.length) out.push({ key: r.key, at: at[0].at });
  }
  return out;
}

/* The rows of `words.json` (the design's list) and of `setup-words` (the list the product serves), as `{key, en}`. */
export const designRows = (file = WORDS_JSON) => JSON.parse(readFileSync(file, "utf8")).words.map((w) => ({ key: w.key, en: w.en }));
export const setupRows = () => WORD_ROWS.map((r) => ({ key: r[0], en: r[1] }));

/* The drawn text of a page, with the rows `GROUP_SENSE` keeps taken out wherever they are drawn (a kind of organization a
   screen offers, a grouping its words name): what is left is a team, said as a team. `patterns` are those rows' words,
   as `wordPattern` makes them (words.mjs); `keys` the keys of `setup-words` the rule allows. */
export function senseKeys({ rule = designRule(), rows = setupRows() } = {}) {
  return rows.filter((r) => rule.GROUP_SENSE.test(r.key)).map((r) => r.key);
}
export function withoutGroupSense(text, patterns) {
  let t = String(text).replace(/\s+/g, " ");
  for (const re of patterns) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
  return t;
}
