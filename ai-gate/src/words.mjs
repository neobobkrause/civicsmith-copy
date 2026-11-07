/* ai-gate — every sentence a person reads from this module, by key (R65; K3472, K3810, K5418).
 *
 * A refusal is an identifier code (K3971); its words are `gate.refused.<code>`. A verdict reads `gate.verdict.<v>`, a
 * limit `gate.limit.<kind>`, a warning `gate.warn.<code>`, the reasonableness note `gate.note.reasonableness`. Each is
 * written once, here, at its use as `localize(id, en)` (K3943): setup-words' build extracts it into the word table and
 * the table wins. The words say "team", never "group". Pure; never throws for a known key. */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { deepFreeze } from "./params.mjs";

const REFUSED = {
  CHALLENGE_BANK_VERSION: () => localize("gate.refused.CHALLENGE_BANK_VERSION", "This test challenge was issued for another version of the test items than the one this container holds."),
  CHALLENGE_EXPIRED: () => localize("gate.refused.CHALLENGE_EXPIRED", "This test challenge has expired, or is not yet valid. Ask Civicsmith for a new one."),
  CHALLENGE_MALFORMED: () => localize("gate.refused.CHALLENGE_MALFORMED", "This test challenge is not in the form Civicsmith issues."),
  CHALLENGE_NONCE_SHORT: () => localize("gate.refused.CHALLENGE_NONCE_SHORT", "This test challenge's nonce is too short to be trusted."),
  CHALLENGE_SEED_MISSING: () => localize("gate.refused.CHALLENGE_SEED_MISSING", "This test challenge names no selection seed, so the test items cannot be chosen."),
  GATE_BUNDLE_UNREADABLE: () => localize("gate.refused.GATE_BUNDLE_UNREADABLE", "This results bundle cannot be read."),
  GATE_CANARY_INPUT: () => localize("gate.refused.GATE_CANARY_INPUT", "A drift check needs the AI it watches, and none was named."),
  GATE_CANARY_LAPSED: () => localize("gate.refused.GATE_CANARY_LAPSED", "This AI is marked lapsed or retired, so no drift check runs on it."),
  GATE_CANARY_NOT_CIVICSMITH: () => localize("gate.refused.GATE_CANARY_NOT_CIVICSMITH", "Drift checks run only on Civicsmith's own accounts, never on a team's."),
  GATE_CANARY_RETEST_OFF: () => localize("gate.refused.GATE_CANARY_RETEST_OFF", "Re-testing is switched off for this AI, or its monthly limit is reached, so no drift check runs."),
  GATE_CEILING_REQUIRED: () => localize("gate.refused.GATE_CEILING_REQUIRED", "A test run needs a spending ceiling before it starts."),
  GATE_CHAR_CONDITION_MISSING: () => localize("gate.refused.GATE_CHAR_CONDITION_MISSING", "A measured property must state every condition it was measured under."),
  GATE_CHAR_INVALID: () => localize("gate.refused.GATE_CHAR_INVALID", "This measured property is not in the form a measurement takes."),
  GATE_COMBINE_INPUT: () => localize("gate.refused.GATE_COMBINE_INPUT", "Results can be joined only at a stated date, over a stated number of months, under stated test versions."),
  GATE_COMPARE_INPUT: () => localize("gate.refused.GATE_COMPARE_INPUT", "A comparison needs both the baseline figures and the new figures."),
  GATE_CONSENT_INVALID: () => localize("gate.refused.GATE_CONSENT_INVALID", "This consent record is missing the estimate, ceiling, plan or time it must hold."),
  GATE_CONSENT_MISSING: () => localize("gate.refused.GATE_CONSENT_MISSING", "A test run starts only after a person on the team says yes to its estimate and ceiling."),
  GATE_DECLARED_HOST: () => localize("gate.refused.GATE_DECLARED_HOST", "This address cannot be tested: it must be a public name reached over https, and not Civicsmith's own."),
  GATE_DECLARED_INVALID: () => localize("gate.refused.GATE_DECLARED_INVALID", "This plan description is missing a provider, host, model, plan, scope or route."),
  GATE_ENTRY_NOT_LISTED: () => localize("gate.refused.GATE_ENTRY_NOT_LISTED", "This AI is not listed in Civicsmith's catalogue, so it is checked only as a described plan."),
  GATE_END_REASON_UNKNOWN: () => localize("gate.refused.GATE_END_REASON_UNKNOWN", "A test run may end early only for a reason the test names."),
  GATE_ESTIMATE_INPUT: () => localize("gate.refused.GATE_ESTIMATE_INPUT", "The estimate cannot be compared with what the run cost."),
  GATE_ESTIMATE_NO_MONEY: () => localize("gate.refused.GATE_ESTIMATE_NO_MONEY", "This plan reports no money, so the estimate has no money figure to compare."),
  GATE_MANIFEST_INPUT: () => localize("gate.refused.GATE_MANIFEST_INPUT", "The bundle's summary is missing something it must state, or states a grade, which only Civicsmith gives."),
  GATE_NAME_INPUT: () => localize("gate.refused.GATE_NAME_INPUT", "A bundle's name needs its date and its hash."),
  GATE_NOTE_INVALID: () => localize("gate.refused.GATE_NOTE_INVALID", "A reading note must name the AI, the part, the samples read, the reviewer and the date."),
  GATE_PARAM_INVALID: () => localize("gate.refused.GATE_PARAM_INVALID", "A setting of the test is missing or out of range."),
  GATE_PART_UNKNOWN: () => localize("gate.refused.GATE_PART_UNKNOWN", "This is not one of the parts of Civicsmith's work an AI is tested for."),
  GATE_PAYLOAD_UNFIT: () => localize("gate.refused.GATE_PAYLOAD_UNFIT", "The bundle's contents hold something a bundle may not carry."),
  GATE_PLAN_INPUT: () => localize("gate.refused.GATE_PLAN_INPUT", "A test run needs the AI, a nonce and the test versions before it is planned."),
  GATE_PRIVATE_BANK_NEEDED: () => localize("gate.refused.GATE_PRIVATE_BANK_NEEDED", "This item is scored against answers only Civicsmith holds, so it is scored on Civicsmith's side."),
  GATE_RECORD_UNFIT: () => localize("gate.refused.GATE_RECORD_UNFIT", "This test record is missing the AI, the part, the versions, the tier, the source or the grade it must hold."),
  GATE_ROW_INVALID: () => localize("gate.refused.GATE_ROW_INVALID", "This results row is not in the form the results page publishes."),
  GATE_ROW_UNVERIFIED: () => localize("gate.refused.GATE_ROW_UNVERIFIED", "A team's results are published only from a bundle Civicsmith verified."),
  GATE_RUN_KIND_UNKNOWN: () => localize("gate.refused.GATE_RUN_KIND_UNKNOWN", "A run is either Civicsmith's own or a team's bundle."),
  GATE_RUN_INPUT: () => localize("gate.refused.GATE_RUN_INPUT", "A test item runs only with its AI, its part and the connection the AI is reached through."),
  GATE_SCAN_INPUT: () => localize("gate.refused.GATE_SCAN_INPUT", "The bundle's contents could not be scanned for secrets, so they are not sent."),
  GATE_SCORE_INPUT: () => localize("gate.refused.GATE_SCORE_INPUT", "An item is scored only from its stored exchange."),
  GATE_SCORER_FAILED: () => localize("gate.refused.GATE_SCORER_FAILED", "The scorer could not read this stored exchange."),
  GATE_SEAL_FAILED: () => localize("gate.refused.GATE_SEAL_FAILED", "The bundle's contents could not be sealed, so nothing was written."),
  GATE_SEAL_KEY_INVALID: () => localize("gate.refused.GATE_SEAL_KEY_INVALID", "Civicsmith's public key for sealing bundles is not in the form expected."),
  GATE_SIGN_FAILED: () => localize("gate.refused.GATE_SIGN_FAILED", "The bundle could not be signed, so nothing was written."),
  GATE_SIGN_INPUT: () => localize("gate.refused.GATE_SIGN_INPUT", "A bundle is signed over its summary and its contents' hash with the run's key."),
  GATE_SIGNAL_INPUT: () => localize("gate.refused.GATE_SIGNAL_INPUT", "A watch signal needs the AI it is about."),
  GATE_T3_NOT_ADMITTED: () => localize("gate.refused.GATE_T3_NOT_ADMITTED", "Detailed measuring runs only on an AI that passed at least one part of the full test."),
  GATE_TIER_INCOMPLETE: () => localize("gate.refused.GATE_TIER_INCOMPLETE", "The next stage of the test waits until this one has finished."),
  GATE_TIER_LAST: () => localize("gate.refused.GATE_TIER_LAST", "This is the last stage of the test."),
  GATE_TIER_NOT_A_RUN: () => localize("gate.refused.GATE_TIER_NOT_A_RUN", "These stages are not a test run Civicsmith plans."),
  GATE_TIER_NOT_SELECTABLE: () => localize("gate.refused.GATE_TIER_NOT_SELECTABLE", "Items are chosen only for the connect, screen and full stages."),
  GATE_TIER_STOPPED: () => localize("gate.refused.GATE_TIER_STOPPED", "This stage stopped early, so the next does not run."),
  GATE_TIER_UNKNOWN: () => localize("gate.refused.GATE_TIER_UNKNOWN", "This is not a stage of the test."),
  GATE_UPTIME_INVALID: () => localize("gate.refused.GATE_UPTIME_INVALID", "An uptime figure is shown only with its source and the period it covers."),
  SUITE_FIXTURE_REAL_ID: () => localize("gate.refused.SUITE_FIXTURE_REAL_ID", "A test item holds something shaped like a team's record, member or address, so the items are not loaded."),
  SUITE_ITEM_DUPLICATE: () => localize("gate.refused.SUITE_ITEM_DUPLICATE", "Two test items share one id, so the items are not loaded."),
  SUITE_ITEM_GROUP: () => localize("gate.refused.SUITE_ITEM_GROUP", "A test item names a kind of check the test does not have."),
  SUITE_ITEM_NOT_SYNTHETIC: () => localize("gate.refused.SUITE_ITEM_NOT_SYNTHETIC", "A test item is not marked as made up by Civicsmith, so the items are not loaded."),
  SUITE_ITEM_PARTS: () => localize("gate.refused.SUITE_ITEM_PARTS", "A test item names a part of the work that does not exist."),
  SUITE_ITEM_SHAPE: () => localize("gate.refused.SUITE_ITEM_SHAPE", "A test item is not in the form the test expects."),
  SUITE_ITEM_TIERS: () => localize("gate.refused.SUITE_ITEM_TIERS", "A test item names a stage of the test that does not exist."),
  SUITE_KEY_UNKNOWN: () => localize("gate.refused.SUITE_KEY_UNKNOWN", "The test items are signed by a key Civicsmith does not list."),
  SUITE_NAMESPACE: () => localize("gate.refused.SUITE_NAMESPACE", "The test items are signed for another purpose than the test."),
  SUITE_SCORER_MISSING: () => localize("gate.refused.SUITE_SCORER_MISSING", "A kind of check names a scorer this version does not have."),
  SUITE_SHAPE: () => localize("gate.refused.SUITE_SHAPE", "The test items are not in the form the test expects."),
  SUITE_SIGNATURE_BAD: () => localize("gate.refused.SUITE_SIGNATURE_BAD", "The test items' signature does not verify, so they are not loaded."),
  SUITE_UNSIGNED: () => localize("gate.refused.SUITE_UNSIGNED", "The test items carry no signature, so they are not loaded."),
};

const VERDICT = {
  passes: () => localize("gate.verdict.passes", "Passes: this AI did this part of the work in Civicsmith's test."),
  passes_with_limits: () => localize("gate.verdict.passes_with_limits", "Passes with limits: this AI did this part of the work, within the limits named."),
  not_suitable: () => localize("gate.verdict.not_suitable", "Not suitable: this AI did not do this part of the work well enough in Civicsmith's test."),
  not_yet_rated: () => localize("gate.verdict.not_yet_rated", "Not yet rated: the figures are measured, and the pass marks are not set yet."),
};

const LIMIT = {
  context_depth: () => localize("gate.limit.context_depth", "Reads reliably only up to the depth measured, less than the window its provider states."),
  no_image_input: () => localize("gate.limit.no_image_input", "Cannot read pictures of pages."),
  no_streaming: () => localize("gate.limit.no_streaming", "Does not show its progress while it works."),
  no_parallel_tools: () => localize("gate.limit.no_parallel_tools", "Reads one thing at a time."),
  output_cap: () => localize("gate.limit.output_cap", "Writes only short answers."),
};

const WARN = {
  ceiling_low: () => localize("gate.warn.ceiling_low", "This ceiling is below the lowest estimate, so the run will probably stop before it finishes."),
};

const NOTE = {
  not_measurable_in_money: () => localize("gate.note.not_measurable_in_money", "not measurable in money"),
  reasonableness: () => localize("gate.note.reasonableness", "A person's reading of a sample of this AI's answers. It is a note beside the verdict, never part of it."),
};

/** R65 — the keys this module's words are read by, by kind, each with the code or value it names. */
const keysOf = (prefix, table) => Object.keys(table).map((k) => `${prefix}.${k}`);
export const WORD_KEYS = deepFreeze({
  refused: keysOf("gate.refused", REFUSED), verdict: keysOf("gate.verdict", VERDICT), limit: keysOf("gate.limit", LIMIT),
  warn: keysOf("gate.warn", WARN), note: keysOf("gate.note", NOTE),
});

const TABLES = { refused: REFUSED, verdict: VERDICT, limit: LIMIT, warn: WARN, note: NOTE };

/** R65 — the words for a code or value of this module: `{key, text}` read through setup-words, or null when the code
 *  has no key (a build test refuses that). `kind` is `refused`, `verdict`, `limit`, `warn` or `note`. */
export function gateWords(kind, code) {
  const t = Object.prototype.hasOwnProperty.call(TABLES, kind) ? TABLES[kind] : null;
  if (!t || typeof code !== "string" || !Object.prototype.hasOwnProperty.call(t, code)) return null;
  return Object.freeze({ key: `gate.${kind}.${code}`, text: t[code]() });
}

/** R65 — the words of a refusal this module returned: its `gate.refused.<code>` key and text. */
export const refusalWords = (refusal) => gateWords("refused", refusal?.code);
