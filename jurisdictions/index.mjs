/* The jurisdiction profiles: every local fact the product uses, held as data, each with the
 * measurement it rests on (`build/requirements/jurisdictions.md`; `build/layers.md`, "No jurisdiction
 * in the product"). This file names no place: only the data files under ./profiles/ do.
 *
 * PURE (R17): no store, no network, no clock. What `get` and `combine` return is the caller's own
 * copy (R18). No service treats a profile by its identity (R20): `id`, `name` and `covers` are read
 * only to be reported back.
 *
 * Services: list() · get(id) · validate(profile) · combine(list) · isLocale(value). */

export { SECTIONS, SPACES, VOCABULARY, MEMBER_CAPACITIES, LAW_LEVELS, COUNTERPARTY_LEVELS, SOURCE_KINDS, STANDARD_SOURCE_KINDS, SECTORS, POLICY_HEADER_FIELDS, VENUE_HOW, COUNTS, STARTS, OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES, UNITS, DIRECTIONS, COMPUTATION_RULES, RECEIPT_RULES, CODE_COPIES, SECTION_MARKERS, AMENDING_RELATIONS, MEETING_MARKERS, ROSTER_KINDS, ROSTER_ROLES, BUDGET_COLUMNS, FISCAL_NAMED_BY, FORUM_KINDS, CLASSIFICATION_KINDS, DEMAND_COVERS, RRULE_PARTS, LOCAL_NAME_KINDS, TIERS, CONTACT_HOW, POINTER_KINDS, RECORDS_HELP_CITATIONS, TEMPLATE_FIELDS, TEMPLATE_USES, REVIEW_KINDS, REVIEW_OUTCOMES, WEEKDAYS, FACT_STATUSES, isLocale, basisValid } from "./shared.mjs";
export { validate } from "./validate.mjs";
export { list, get, combine, governingZone } from "./combine.mjs";
