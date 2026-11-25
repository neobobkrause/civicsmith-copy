/* record-core's own refusal rows (requirements: `build/requirements/record-core.md`). DEC-49: every refusal this
 * module answers carries its code, its row and the member's translation.
 *
 * `MINT_EXHAUSTED` is new with R62 (N322, N250, K275, K392): it names one condition, no free opaque id could be drawn
 * (`mintOpaqueId` answered null, R9), which promotion, case-authoring, review, tasks and sources each reach; record-core,
 * the earliest of them in the order and the owner of the minter, provides the one helper (`mintExhausted`) and holds the
 * one row. It takes the next free number of C-59, the id-allocation family C-59.5 belongs to (K107 (3); K174: a module
 * holds its new rows), and review's C-87.12 translation, unchanged; C-87.12 retired into it in T13 (K434), stamped 1.44.0.
 *
 * T18 (RECORD-CORE #10): C-59.5 `ALLOCID_PREFIX_GATED` and C-102.1–.3 (the audit check's registration and failure) were
 * COPIED here from the catalogue's `PROJECT_ID_CHECKS` and `REGISTRATION_CHECKS`, rows and translations unchanged; the
 * catalogue's duplicates were removed in T19 (K783, stamped 1.49.0) and the catalogue itself deleted at T19's close
 * (K855). C-75, the set form's five rows, MOVED here whole as `PER_ITEM_CHECKS` (its family name kept for the guard's and
 * `dec49Row`'s suffix harvest), the catalogue's copy deleted in the same job (K586 BOB-1: record-core was its one
 * importer). C-102.15–.18 are new: the grammar seam's two registration refusals (§1b) and the statistics source's two
 * (R64's source, K621), each met only by the instance's own build, as C-102.1, .2, .13 and .14 are.
 *
 * T19 (RECORD-CORE #11): C-102.19–.20 are new, the mint seed's two registration refusals (R70), on the same terms.
 * C-102.15's and .16's meaning follows R67 as K766 words it (a registration may claim several whole slots, a slot
 * several registrations); their sentences already say so.
 *
 * T33 (RECORD-CORE #16, T33-19; S0-3, K1493): C-102.21–.22 are new, `declareTable`'s classes (R21); C-102.23–.25 new,
 * the store gate's registration and its failed check (R78). (The declaration's older refusals, TABLE_DECLARED and
 * TABLE_NAME_INVALID, keep their row-less shape, which other modules' tests pin; their rows are deferred.) C-132 is a
 * new family, expunge with a tombstone (R79), whose refusals a member's act meets. All are `awaiting stamp`: promotion,
 * which stamps rows, has no T33 job (T34's layer 2).
 *
 * T34 (RECORD-CORE #17, T34-9; N554, K1545, DEC-49): C-102.26–.27 are new, the declaration's two older refusals,
 * TABLE_NAME_INVALID and TABLE_DECLARED, now answered with their rows (R80), beside C-102.21–.22; `awaiting stamp` for
 * promotion's T34 layer-2 stamp (T34-12).
 *
 * T35 (RECORD-CORE #18, T35-13; N655, K1754, DEC-49; N664, DEC-149): C-102.28–.32 are new, the lease's one refusal
 * (ANONYMOUS_LEASE, R10, R61) and the settings' four (R25), now answered with their rows (R81), taking the next free
 * numbers of C-102 (K174). Every member-facing sentence here calls the group's own Civicsmith "your group's Civicsmith"
 * (R82): `BUILD_FAULT` and the sixteen rows that end with it, C-102.13 and .14 (which now end with it too, the same
 * sentence), C-59.6, C-59.8, C-102.17, .18 and .25. All are `awaiting stamp` for promotion's T35 layer-2 stamp (T35-16).
 *
 * T47 (RECORD-CORE #22, T47-6; N939, K3030, DEC-49): C-102.33 is new, `setSetting`'s refusal of a value that does not
 * round-trip through JSON (R84), `SETTING_NOT_JSON`, beside the four settings rows and the next free number of C-102
 * (K174). It is a new code for a new condition: C-102.32 `SETTING_INVALID` keeps R26's setting alone. A build fault,
 * ending with `BUILD_FAULT` (R82). `awaiting stamp` for promotion's T47 layer-2 stamp (T47-10). */

import { word, localize } from '../setup-words/index.mjs';

const at = (fn, region) => `src/record-core/index.mjs ${fn} > ${region}`;
const BUILD_FAULT = word('record-core.build_fault');

export const RECORD_CORE_CHECKS = Object.freeze({
  MINT_EXHAUSTED: Object.freeze({
    check: 'C-59.6', where: at("mintExhausted", "is-mint-exhausted"),
    translation: word('refusal.MINT_EXHAUSTED'),
  }),
  COUNTS_DECLARED: Object.freeze({
    check: 'C-102.13', where: at("registerCounts", "is-counts-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams', 'A part of your team\'s Civicsmith tried to report a figure another part already reports, or to register its figures twice, so the second registration was refused and the first still stands. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  COUNTS_MALFORMED: Object.freeze({
    check: 'C-102.14', where: at("registerCounts", "is-counts-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_2', 'A part of your team\'s Civicsmith tried to register its figures without naming itself, the figures or a function to count them, so nothing was registered. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* Copied from the catalogue's PROJECT_ID_CHECKS (REC-151, Membership v2 §7, "A MINTED ID CARRIES NO COUNT"). */
  ALLOCID_PREFIX_GATED: Object.freeze({
    check: 'C-59.5', where: at("allocIdOp", "is-allocid-prefix-gated"),
    translation: word('refusal.ALLOCID_PREFIX_GATED'),
  }),
  /* Copied from the catalogue's REGISTRATION_CHECKS (K31; N94). */
  AUDIT_CHECK_DECLARED: Object.freeze({
    check: 'C-102.1', where: at("registerAuditCheck", "is-audit-check-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_3', 'A part of your team\'s Civicsmith tried to register its audit check a second time. Each part registers once, when it starts, so the second was refused and the first still runs. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  AUDIT_CHECK_MALFORMED: Object.freeze({
    check: 'C-102.2', where: at("registerAuditCheck", "is-audit-check-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_4', 'A part of your team\'s Civicsmith tried to register an audit check without naming itself or without a check to run, so nothing was registered. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  AUDIT_CHECK_FAILED: Object.freeze({
    check: 'C-102.3', where: at("auditPass", "is-audit-check-failed"),
    translation: word('refusal.AUDIT_CHECK_FAILED'),
  }),
  /* New (§1b): a type grammar registered for record-grammar's `checkBundle` (its R39). */
  GRAMMAR_DECLARED: Object.freeze({
    check: 'C-102.15', where: at("registerGrammar", "is-grammar-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_5', 'A part of your team\'s Civicsmith tried to register a document grammar a second time, or to claim a check another part\'s grammar already claims, so the second registration was refused and the first still stands. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  GRAMMAR_MALFORMED: Object.freeze({
    check: 'C-102.16', where: at("registerGrammar", "is-grammar-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_6', 'A part of your team\'s Civicsmith tried to register a document grammar without naming itself, the checks it takes over or a function to run, or claimed only part of one of the record\'s own checks, so nothing was registered. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (R64's source, K621): the one registered source of the instance's figures. */
  STATS_SOURCE_DECLARED: Object.freeze({
    check: 'C-102.17', where: at("registerStatsSource", "is-stats-source-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_7', 'A part of your team\'s Civicsmith tried to supply its figures when another part already supplies them, so the second was refused and the first still stands. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  STATS_SOURCE_MALFORMED: Object.freeze({
    check: 'C-102.18', where: at("registerStatsSource", "is-stats-source-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_8', 'A part of your team\'s Civicsmith tried to supply its figures without naming itself or without a function to count them, so nothing was registered. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T24, R75, N503): a chosen opaque id recorded in the ledger inside its caller's transaction. Beside C-59.5 and
     C-59.6 in the id-allocation family; `awaiting stamp` for promotion's T24 layer-2 stamp. */
  OPAQUE_ID_MALFORMED: Object.freeze({
    check: 'C-59.7', where: at("recordOpaqueId", "is-opaque-id-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_9', 'A part of your team\'s Civicsmith tried to reserve an identifier without giving one, so nothing was reserved. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  OPAQUE_ID_SPENT: Object.freeze({
    check: 'C-59.8', where: at("recordOpaqueId", "is-opaque-id-refused"),
    translation: word('refusal.OPAQUE_ID_SPENT'),
  }),
  OPAQUE_ID_NO_TRANSACTION: Object.freeze({
    check: 'C-59.9', where: at("recordOpaqueId", "is-opaque-id-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_10', 'A part of your team\'s Civicsmith tried to reserve an identifier outside the change that would use it, so nothing was reserved: a reservation is kept only with the change it belongs to. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T19, R70; `build/extraction/legacy-store.md` §4.2 (3)): a module's seed sources for the opaque-id ledger. */
  MINT_SEED_DECLARED: Object.freeze({
    check: 'C-102.19', where: at("registerMintSeed", "is-mint-seed-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_11', 'A part of your team\'s Civicsmith tried to name the identifiers it holds a second time, so the second was refused and the first still stands. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  MINT_SEED_MALFORMED: Object.freeze({
    check: 'C-102.20', where: at("registerMintSeed", "is-mint-seed-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_12', 'A part of your team\'s Civicsmith tried to name the identifiers it holds without naming itself, or named a place to read them that is not a table and a column, so nothing was registered. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T33, R21; S0-3): `declareTable`'s classes. */
  TABLE_CLASS_MISSING: Object.freeze({
    check: 'C-102.21', where: at("#declare", "is-table-declaration"),
    translation: localize('record-core.checks.a_part_of_your_teams_13', 'A part of your team\'s Civicsmith tried to declare a table without saying how it is purged, removed, exported, seen, derived or versioned, so nothing was declared. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  TABLE_CLASS_UNKNOWN: Object.freeze({
    check: 'C-102.22', where: at("#declare", "is-table-declaration"),
    translation: localize('record-core.checks.a_part_of_your_teams_14', 'A part of your team\'s Civicsmith tried to declare a table with a class the record does not know, so nothing was declared. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T34, R80; N554): the declaration's two older refusals, given their rows. */
  TABLE_NAME_INVALID: Object.freeze({
    check: 'C-102.26', where: at("#declare", "is-table-declaration"),
    translation: localize('record-core.checks.a_part_of_your_teams_15', 'A part of your team\'s Civicsmith tried to declare a table whose name, or a column or table its declaration names, is not a plain name, so nothing was declared. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  TABLE_DECLARED: Object.freeze({
    check: 'C-102.27', where: at("#declare", "is-table-declaration"),
    translation: localize('record-core.checks.a_part_of_your_teams_16', 'A part of your team\'s Civicsmith tried to declare a table that is already declared, by itself or by another part, so the second declaration was refused and the first still stands. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T33, R78; S0-3): the store gate, one table's one-home and shape checks. */
  STORE_GATE_DECLARED: Object.freeze({
    check: 'C-102.23', where: at("registerStoreGate", "is-store-gate-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_17', 'A part of your team\'s Civicsmith tried to register the checks of a table that already has them, so the second registration was refused and the first still runs. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  STORE_GATE_MALFORMED: Object.freeze({
    check: 'C-102.24', where: at("registerStoreGate", "is-store-gate-registration"),
    translation: localize('record-core.checks.a_part_of_your_teams_18', 'A part of your team\'s Civicsmith tried to register or run the checks of a table without naming itself, a table it declared or a check to run, so nothing was registered and nothing was written. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  STORE_GATE_FAILED: Object.freeze({
    check: 'C-102.25', where: at("storeGate", "is-store-gate-failed"),
    translation: word('refusal.STORE_GATE_FAILED'),
  }),
  /* New family (T33, R79; K1493, State Rules I-19): expunge with a tombstone, the one removal outside purge. */
  EXPUNGE_GROUND_UNKNOWN: Object.freeze({
    check: 'C-132.1', where: at("expunge", "is-expunge-refused"),
    translation: word('refusal.EXPUNGE_GROUND_UNKNOWN'),
  }),
  EXPUNGE_NOT_DECLARED: Object.freeze({
    check: 'C-132.2', where: at("expunge", "is-expunge-refused"),
    translation: word('refusal.EXPUNGE_NOT_DECLARED'),
  }),
  EXPUNGE_NOT_A_MEMBER: Object.freeze({
    check: 'C-132.3', where: at("expunge", "is-expunge-refused"),
    translation: word('refusal.EXPUNGE_NOT_A_MEMBER'),
  }),
  EXPUNGE_NOTHING: Object.freeze({
    check: 'C-132.4', where: at("expunge", "is-expunge-refused"),
    translation: word('refusal.EXPUNGE_NOTHING'),
  }),
  /* New (T35, R81; N655): the lease's refusal, which a member's edit meets when its request names no one. */
  ANONYMOUS_LEASE: Object.freeze({
    check: 'C-102.28', where: at("#anonymousLease", "is-anonymous-lease"),
    translation: word('refusal.ANONYMOUS_LEASE'),
  }),
  /* New (T35, R81; N655): the settings' refusals (R25, R26), in the order `setSetting` asks them; T47's SETTING_NOT_JSON
     (R84) asked after the value is required and before R26's setting. */
  SETTING_NAME_REQUIRED: Object.freeze({
    check: 'C-102.29', where: at("setSetting", "is-setting-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_19', 'A part of your team\'s Civicsmith tried to record a setting without naming it, so nothing was recorded. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  SETTING_BY_REQUIRED: Object.freeze({
    check: 'C-102.30', where: at("setSetting", "is-setting-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_20', 'A part of your team\'s Civicsmith tried to record a setting without saying who set it, so nothing was recorded. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  SETTING_VALUE_REQUIRED: Object.freeze({
    check: 'C-102.31', where: at("setSetting", "is-setting-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_21', 'A part of your team\'s Civicsmith tried to record a setting without giving it a value, so nothing was recorded. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  SETTING_NOT_JSON: Object.freeze({
    check: 'C-102.33', where: at("setSetting", "is-setting-refused"),
    translation: localize('record-core.checks.a_part_of_your_teams_22', 'A part of your team\'s Civicsmith tried to record a setting with a value that cannot be stored as it was given, so nothing was recorded. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  SETTING_INVALID: Object.freeze({
    check: 'C-102.32', where: at("setSetting", "is-setting-refused"),
    translation: localize('record-core.checks.the_setting_was_not_changed', 'The setting was not changed, because the value given is not one it takes. The jurisdictions your team follows are set as a list of profiles, each named once, in the order they apply.'),
  }),
  /* New (T51, R86; B2, K4259): `allocid` names the prefix and the year an id is for; a call that names neither allocates
     nothing. The two take the next free numbers of C-102, after C-102.33. */
  ALLOCID_PREFIX_REQUIRED: Object.freeze({
    check: 'C-102.34', where: at("allocIdOp", "is-allocid-input-present"),
    translation: localize('record-core.checks.allocid_prefix_required', 'A part of your team\'s Civicsmith asked for an id without naming the kind of object it is for, so nothing was allocated. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  ALLOCID_YEAR_REQUIRED: Object.freeze({
    check: 'C-102.35', where: at("allocIdOp", "is-allocid-input-present"),
    translation: localize('record-core.checks.allocid_year_required', 'A part of your team\'s Civicsmith asked for an id without a year, so nothing was allocated. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  /* New (T51, R87; fix round 3, C5; K4363): a whole object made from parts the store holds. The four refusals of
     `putFromParts` take the next free numbers of C-102, after C-102.35. */
  EVIDENCE_PARTS_MALFORMED: Object.freeze({
    check: 'C-102.36', where: at("putFromParts", "is-evidence-parts-refused"),
    translation: localize('record-core.checks.evidence_parts_malformed', 'A part of your team\'s Civicsmith asked to keep a document whole without naming it and its parts as fingerprints, so nothing was kept. {BUILD_FAULT}', { BUILD_FAULT: String(BUILD_FAULT) }),
  }),
  EVIDENCE_PART_MISSING: Object.freeze({
    check: 'C-102.37', where: at("putFromParts", "is-evidence-parts-refused"),
    translation: localize('record-core.checks.evidence_part_missing', 'One piece of a large document was not there when your team\'s Civicsmith went to put the document together, so the document was not kept whole and nothing was written. Capture it again.'),
  }),
  EVIDENCE_DIGEST_MISMATCH: Object.freeze({
    check: 'C-102.38', where: at("putFromParts", "is-evidence-parts-refused"),
    translation: localize('record-core.checks.evidence_digest_mismatch', 'The pieces of a large document did not add up to the document that was meant, so it was not kept whole and nothing was written. Capture it again.'),
  }),
  EVIDENCE_STORE_REFUSED: Object.freeze({
    check: 'C-102.39', where: at("putFromParts", "is-evidence-parts-refused"),
    translation: localize('record-core.checks.evidence_store_refused', 'The place where your team\'s Civicsmith keeps documents would not take a large document whole, so it was not kept and nothing was written. Try again; if it happens again, tell whoever hosts your team\'s Civicsmith.'),
  }),
});

/* D-126 / C-75 — THE PER-ITEM WEIGHT (NOTIFICATIONS.md §Applying a handler to a selection), MOVED from the catalogue
 * (T18). Bob's requirement: *"select some (or all) to apply the action to. … If that action didn't work for one or
 * more, they'd stay in the list so that the user can take a different action."* The design's rule: each item
 * independently succeeds or is RETAINED WITH A REASON, and the reason is the act's OWN refusal for that item. So this
 * family words only what belongs to the SET (R50, R52, R55):
 *   C-75.1 — no items: `items` is absent from the set form, not an array, or empty.
 *   C-75.2 — too many items: over `PER_ITEM_MAX`, refused WHOLE before any item is tried.
 *   C-75.3 — one item is not an object; THAT item is retained and the others are still tried.
 *   C-75.4 — one item's act failed without a refusal (it threw); THAT item is retained and says so.
 *   C-75.5 — the summary: at least one item was retained. Carried beside `items[]`, never instead of it. */
export const PER_ITEM_CHECKS = Object.freeze({
  SET_NO_ITEMS: Object.freeze({
    check: 'C-75.1', where: at("perItem", "is-per-item-set-shape"),
    translation: word('refusal.SET_NO_ITEMS'),
  }),
  SET_TOO_LARGE: Object.freeze({
    check: 'C-75.2', where: at("perItem", "is-per-item-set-shape"),
    translation: word('refusal.SET_TOO_LARGE'),
  }),
  SET_ITEM_MALFORMED: Object.freeze({
    check: 'C-75.3', where: at("perItem", "is-per-item-malformed"),
    translation: word('refusal.SET_ITEM_MALFORMED'),
  }),
  SET_ITEM_FAILED: Object.freeze({
    check: 'C-75.4', where: at("perItem", "is-per-item-failed"),
    translation: word('refusal.SET_ITEM_FAILED'),
  }),
  SET_ITEMS_RETAINED: Object.freeze({
    check: 'C-75.5', where: at("perItem", "is-per-item-retained"),
    translation: word('refusal.SET_ITEMS_RETAINED'),
  }),
});
