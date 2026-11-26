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

/* The kinds of what the module takes and hands back (S4), stated in `types.mjs` and re-exported here: the profile and
 * every kind in it (R1–R98), and what `list`, `get` and `combine` hand back (R8, R9, R12–R16); `validate`'s own kinds
 * from `validate.mjs`. */
/** @typedef {import("./types.mjs").SpaceName} SpaceName */
/** @typedef {import("./types.mjs").Weekday} Weekday */
/** @typedef {import("./types.mjs").Status} Status */
/** @typedef {import("./types.mjs").Unit} Unit */
/** @typedef {import("./types.mjs").Count} Count */
/** @typedef {import("./types.mjs").Direction} Direction */
/** @typedef {import("./types.mjs").Start} Start */
/** @typedef {import("./types.mjs").OwedBy} OwedBy */
/** @typedef {import("./types.mjs").LawLevel} LawLevel */
/** @typedef {import("./types.mjs").CounterpartyLevel} CounterpartyLevel */
/** @typedef {import("./types.mjs").StandardSourceKind} StandardSourceKind */
/** @typedef {import("./types.mjs").Sector} Sector */
/** @typedef {import("./types.mjs").VenueHow} VenueHow */
/** @typedef {import("./types.mjs").VenueFactName} VenueFactName */
/** @typedef {import("./types.mjs").KindShape} KindShape */
/** @typedef {import("./types.mjs").Tier} Tier */
/** @typedef {import("./types.mjs").PhrasingKind} PhrasingKind */
/** @typedef {import("./types.mjs").PointerKind} PointerKind */
/** @typedef {import("./types.mjs").ContactHow} ContactHow */
/** @typedef {import("./types.mjs").PointerHow} PointerHow */
/** @typedef {import("./types.mjs").LegalFactTrigger} LegalFactTrigger */
/** @typedef {import("./types.mjs").ForumKind} ForumKind */
/** @typedef {import("./types.mjs").ClassificationKind} ClassificationKind */
/** @typedef {import("./types.mjs").DemandCover} DemandCover */
/** @typedef {import("./types.mjs").LocalNameKind} LocalNameKind */
/** @typedef {import("./types.mjs").CodeCopy} CodeCopy */
/** @typedef {import("./types.mjs").SectionMarker} SectionMarker */
/** @typedef {import("./types.mjs").AmendingRelation} AmendingRelation */
/** @typedef {import("./types.mjs").MeetingMarker} MeetingMarker */
/** @typedef {import("./types.mjs").RosterKind} RosterKind */
/** @typedef {import("./types.mjs").RosterRole} RosterRole */
/** @typedef {import("./types.mjs").BudgetColumn} BudgetColumn */
/** @typedef {import("./types.mjs").PolicyHeaderField} PolicyHeaderField */
/** @typedef {import("./types.mjs").MemberCapacity} MemberCapacity */
/** @typedef {import("./types.mjs").FiscalNamedBy} FiscalNamedBy */
/** @typedef {import("./types.mjs").TemplateUse} TemplateUse */
/** @typedef {import("./types.mjs").ReviewKind} ReviewKind */
/** @typedef {import("./types.mjs").ReviewOutcome} ReviewOutcome */
/** @typedef {import("./types.mjs").Pattern} Pattern */
/** @typedef {import("./types.mjs").NormalPart} NormalPart */
/** @typedef {import("./types.mjs").NormalGroup} NormalGroup */
/** @typedef {import("./types.mjs").Hours} Hours */
/** @typedef {import("./types.mjs").HoursSpan} HoursSpan */
/** @typedef {import("./types.mjs").TimeZone} TimeZone */
/** @typedef {import("./types.mjs").Amount} Amount */
/** @typedef {import("./types.mjs").Identifier} Identifier */
/** @typedef {import("./types.mjs").Contact} Contact */
/** @typedef {import("./types.mjs").PointerContact} PointerContact */
/** @typedef {import("./types.mjs").Profile} Profile */
/** @typedef {import("./types.mjs").Spaces} Spaces */
/** @typedef {import("./types.mjs").Space} Space */
/** @typedef {import("./types.mjs").FormRule} FormRule */
/** @typedef {import("./types.mjs").Form} Form */
/** @typedef {import("./types.mjs").FormClean} FormClean */
/** @typedef {import("./types.mjs").EnactmentKind} EnactmentKind */
/** @typedef {import("./types.mjs").FloorRule} FloorRule */
/** @typedef {import("./types.mjs").Floor} Floor */
/** @typedef {import("./types.mjs").System} System */
/** @typedef {import("./types.mjs").MixedHost} MixedHost */
/** @typedef {import("./types.mjs").Crosswalk} Crosswalk */
/** @typedef {import("./types.mjs").Vocabulary} Vocabulary */
/** @typedef {import("./types.mjs").VocabularyPattern} VocabularyPattern */
/** @typedef {import("./types.mjs").CodeEntry} CodeEntry */
/** @typedef {import("./types.mjs").CodeSections} CodeSections */
/** @typedef {import("./types.mjs").FileNumber} FileNumber */
/** @typedef {import("./types.mjs").AmendingEntry} AmendingEntry */
/** @typedef {import("./types.mjs").MeetingMarkerEntry} MeetingMarkerEntry */
/** @typedef {import("./types.mjs").BodyVariant} BodyVariant */
/** @typedef {import("./types.mjs").RosterWord} RosterWord */
/** @typedef {import("./types.mjs").RosterHeader} RosterHeader */
/** @typedef {import("./types.mjs").BudgetHeader} BudgetHeader */
/** @typedef {import("./types.mjs").VoteValue} VoteValue */
/** @typedef {import("./types.mjs").ResponseStatus} ResponseStatus */
/** @typedef {import("./types.mjs").MemberType} MemberType */
/** @typedef {import("./types.mjs").PolicyHeader} PolicyHeader */
/** @typedef {import("./types.mjs").Practice} Practice */
/** @typedef {import("./types.mjs").MinutesDue} MinutesDue */
/** @typedef {import("./types.mjs").SearchTerm} SearchTerm */
/** @typedef {import("./types.mjs").RecordsLaw} RecordsLaw */
/** @typedef {import("./types.mjs").LawStage} LawStage */
/** @typedef {import("./types.mjs").Requesters} Requesters */
/** @typedef {import("./types.mjs").StandardSource} StandardSource */
/** @typedef {import("./types.mjs").Series} Series */
/** @typedef {import("./types.mjs").Counterparty} Counterparty */
/** @typedef {import("./types.mjs").CounterpartyIds} CounterpartyIds */
/** @typedef {import("./types.mjs").Within} Within */
/** @typedef {import("./types.mjs").ActionKind} ActionKind */
/** @typedef {import("./types.mjs").Venue} Venue */
/** @typedef {import("./types.mjs").Cutoff} Cutoff */
/** @typedef {import("./types.mjs").Outage} Outage */
/** @typedef {import("./types.mjs").Receipt} Receipt */
/** @typedef {import("./types.mjs").VenueFact} VenueFact */
/** @typedef {import("./types.mjs").Template} Template */
/** @typedef {import("./types.mjs").PurposedTemplate} PurposedTemplate */
/** @typedef {import("./types.mjs").Review} Review */
/** @typedef {import("./types.mjs").Evidence} Evidence */
/** @typedef {import("./types.mjs").Grade} Grade */
/** @typedef {import("./types.mjs").Deadline} Deadline */
/** @typedef {import("./types.mjs").Starter} Starter */
/** @typedef {import("./types.mjs").Extension} Extension */
/** @typedef {import("./types.mjs").Tolling} Tolling */
/** @typedef {import("./types.mjs").Observed} Observed */
/** @typedef {import("./types.mjs").Consequence} Consequence */
/** @typedef {import("./types.mjs").LegalOrganisation} LegalOrganisation */
/** @typedef {import("./types.mjs").Holiday} Holiday */
/** @typedef {import("./types.mjs").HolidayOffice} HolidayOffice */
/** @typedef {import("./types.mjs").HolidayDay} HolidayDay */
/** @typedef {import("./types.mjs").Locale} Locale */
/** @typedef {import("./types.mjs").Weekend} Weekend */
/** @typedef {import("./types.mjs").Computation} Computation */
/** @typedef {import("./types.mjs").FiscalYear} FiscalYear */
/** @typedef {import("./types.mjs").LawRank} LawRank */
/** @typedef {import("./types.mjs").InstrumentKey} InstrumentKey */
/** @typedef {import("./types.mjs").ProceedingKind} ProceedingKind */
/** @typedef {import("./types.mjs").ProceedingFlow} ProceedingFlow */
/** @typedef {import("./types.mjs").FlowStage} FlowStage */
/** @typedef {import("./types.mjs").IdentifierScheme} IdentifierScheme */
/** @typedef {import("./types.mjs").ClassificationScheme} ClassificationScheme */
/** @typedef {import("./types.mjs").LawfulDemand} LawfulDemand */
/** @typedef {import("./types.mjs").Recurrence} Recurrence */
/** @typedef {import("./types.mjs").LocalName} LocalName */
/** @typedef {import("./types.mjs").Explanation} Explanation */
/** @typedef {import("./types.mjs").Translation} Translation */
/** @typedef {import("./types.mjs").LegalFact} LegalFact */
/** @typedef {import("./types.mjs").ProcedureGuide} ProcedureGuide */
/** @typedef {import("./types.mjs").GuideItem} GuideItem */
/** @typedef {import("./types.mjs").Phrasing} Phrasing */
/** @typedef {import("./types.mjs").Pointer} Pointer */
/** @typedef {import("./types.mjs").RecordsHelp} RecordsHelp */
/** @typedef {import("./types.mjs").RecordsHelpCitations} RecordsHelpCitations */
/** @typedef {import("./types.mjs").Forum} Forum */
/** @typedef {import("./types.mjs").ProfileSummary} ProfileSummary */
/** @typedef {import("./types.mjs").BasisTag} BasisTag */
/** @typedef {import("./types.mjs").Tags} Tags */
/**
 * @template T
 * @typedef {import("./types.mjs").Tagged<T>} Tagged
 */
/** @typedef {import("./types.mjs").View} View */
/** @typedef {import("./types.mjs").ViewSpaces} ViewSpaces */
/** @typedef {import("./types.mjs").ViewSpace} ViewSpace */
/** @typedef {import("./types.mjs").EnactmentKindFacts} EnactmentKindFacts */
/** @typedef {import("./types.mjs").ViewEnactmentKind} ViewEnactmentKind */
/** @typedef {import("./types.mjs").ViewVocabulary} ViewVocabulary */
/** @typedef {import("./types.mjs").ViewPractice} ViewPractice */
/** @typedef {import("./types.mjs").ViewMinutesDue} ViewMinutesDue */
/** @typedef {import("./types.mjs").PointerFacts} PointerFacts */
/** @typedef {import("./types.mjs").ViewPointer} ViewPointer */
/** @typedef {import("./types.mjs").RecordsLawFacts} RecordsLawFacts */
/** @typedef {import("./types.mjs").ViewRecordsLaw} ViewRecordsLaw */
/** @typedef {import("./types.mjs").StandardSourceFacts} StandardSourceFacts */
/** @typedef {import("./types.mjs").ViewStandardSource} ViewStandardSource */
/** @typedef {import("./types.mjs").CounterpartyFacts} CounterpartyFacts */
/** @typedef {import("./types.mjs").ViewCounterparty} ViewCounterparty */
/** @typedef {import("./types.mjs").ViewTemplate} ViewTemplate */
/** @typedef {import("./types.mjs").ActionKindFacts} ActionKindFacts */
/** @typedef {import("./types.mjs").ViewActionKind} ViewActionKind */
/** @typedef {import("./types.mjs").VenueFacts} VenueFacts */
/** @typedef {import("./types.mjs").ViewVenue} ViewVenue */
/** @typedef {import("./types.mjs").DeadlineFacts} DeadlineFacts */
/** @typedef {import("./types.mjs").ViewDeadline} ViewDeadline */
/** @typedef {import("./types.mjs").ViewHoliday} ViewHoliday */
/** @typedef {import("./types.mjs").LocalNameFacts} LocalNameFacts */
/** @typedef {import("./types.mjs").ViewLocalName} ViewLocalName */
/** @typedef {import("./types.mjs").ConflictValue} ConflictValue */
/** @typedef {import("./types.mjs").PlainConflictValue} PlainConflictValue */
/** @typedef {import("./types.mjs").PracticeConflictValue} PracticeConflictValue */
/** @typedef {import("./types.mjs").HolidayConflictValue} HolidayConflictValue */
/** @typedef {import("./types.mjs").ConflictFact} ConflictFact */
/** @typedef {import("./types.mjs").Conflict} Conflict */
/** @typedef {import("./types.mjs").CombineError} CombineError */
/** @typedef {import("./types.mjs").Combined} Combined */
/** @typedef {import("./types.mjs").CombineRefusal} CombineRefusal */
/** @typedef {import("./types.mjs").CombineResult} CombineResult */
/** @typedef {import("./validate.mjs").ProfileError} ProfileError */
/** @typedef {import("./validate.mjs").Validation} Validation */
