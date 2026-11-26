/* The kinds of the jurisdiction profile (R1–R98) and of what `list`, `get` and `combine` hand back. Types only: this file
 * holds no value. The interface file, `index.mjs`, re-exports the public ones.
 *
 * A profile's kinds say what `validate` accepts (`validate.mjs`), field by field: a field `validate` lets through is in
 * the kind, as the kind of value it lets through. The closed word lists are the same words as the frozen lists of
 * `shared.mjs` (`WEEKDAYS`, `UNITS`, …), written here as kinds so a reader can rely on them. */

/** @import { ProfileError } from "./validate.mjs" */

/* ------------------------------------------------------------------------------------------------ */
/* Closed words (the frozen lists of shared.mjs, as kinds).                                          */

/** A space a form belongs to (R3; `SPACES`).
 *  @typedef {"enactment" | "project" | "fund" | "parcel" | "account" | "object" | "vendor" | "proceeding" | "person" | "body" | "office" | "institution"} SpaceName */
/** A day of the week (R42; `WEEKDAYS`).
 *  @typedef {"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"} Weekday */
/** What a calendar fact rests on (R44; `FACT_STATUSES`): `researched` on a measurement, `ruled` on a ruling.
 *  @typedef {"researched" | "ruled"} Status */
/** A period's units (R26; `UNITS`).
 *  @typedef {"days" | "hours" | "business_hours" | "months" | "years"} Unit */
/** How days are counted (R7, R26; `COUNTS`).
 *  @typedef {"calendar" | "business"} Count */
/** Which way a period runs from its event (R26; `DIRECTIONS`).
 *  @typedef {"forward" | "backward"} Direction */
/** The event a period runs from (R26, R75; `STARTS`).
 *  @typedef {"received" | "filed" | "act" | "known" | "entered" | "served" | "hearing" | "third_party"} Start */
/** Whose duty a deadline is (R75; `OWED_BY`).
 *  @typedef {"body" | "group"} OwedBy */
/** A law's level (R31; `LAW_LEVELS`).
 *  @typedef {"federal" | "state" | "county" | "city"} LawLevel */
/** An office's level (R24, R88; `COUNTERPARTY_LEVELS`).
 *  @typedef {"state" | "county" | "city" | "district"} CounterpartyLevel */
/** A standard source's kind (R23; `STANDARD_SOURCE_KINDS`).
 *  @typedef {"statute" | "regulation" | "ordinance" | "court" | "policy" | "commitment" | "standard"} StandardSourceKind */
/** An issuer's sector (R64; `SECTORS`).
 *  @typedef {"government" | "company" | "nonprofit" | "association" | "political" | "religious" | "education" | "other"} Sector */
/** How a venue takes a filing (R25; `VENUE_HOW`).
 *  @typedef {"portal" | "mail" | "email" | "in_person" | "court"} VenueHow */
/** A fact a venue may state (R82, R87 (e); `VENUE_FACTS`).
 *  @typedef {"how_to_submit" | "anonymity" | "publishes" | "public_listing" | "speaker_limit" | "comment_cutoff" | "page_limit" | "interpreter_lead" | "delivery_point"} VenueFactName */
/** An action kind's shape (R87 (a); `KIND_SHAPES`).
 *  @typedef {"recognition"} KindShape */
/** A risk tier (R25; `TIERS`).
 *  @typedef {1 | 2 | 3} Tier */
/** What a phrasing adds to (R86; `PHRASING_KINDS`).
 *  @typedef {"assertion" | "position" | "own_benefit_ask"} PhrasingKind */
/** A pointer's kind (R89; `POINTER_KINDS`).
 *  @typedef {"legalaid" | "selfhelp" | "service" | "agency" | "representative" | "tipline"} PointerKind */
/** How a legal organisation is reached (R32; `CONTACT_HOW`).
 *  @typedef {"web" | "email" | "phone" | "mail"} ContactHow */
/** How a pointer is reached: R32's means and a street address (R89).
 *  @typedef {"web" | "email" | "phone" | "mail" | "address"} PointerHow */
/** The moment a legal fact is shown at (R79; `LEGAL_FACT_TRIGGERS`).
 *  @typedef {"paid_attendee" | "recording" | "threat_letter" | "pending_measure_or_candidate" | "serial_meeting"} LegalFactTrigger */
/** A forum's kind (R51, R94; `FORUM_KINDS`).
 *  @typedef {"court" | "commission" | "grand_jury" | "auditor" | "other"} ForumKind */
/** What a classification scheme classifies (R52; `CLASSIFICATION_KINDS`).
 *  @typedef {"fund" | "organisation" | "account" | "object" | "program" | "project" | "function"} ClassificationKind */
/** A personal fact a lawful demand reaches (R53; `DEMAND_COVERS`).
 *  @typedef {"home_address" | "phone" | "other"} DemandCover */
/** What an official local name names (R70; `LOCAL_NAME_KINDS`).
 *  @typedef {"office" | "law" | "program" | "place"} LocalNameKind */
/** Which copy of a code is served (R6; `CODE_COPIES`).
 *  @typedef {"official" | "codifier" | "undetermined"} CodeCopy */
/** A subsection marker (R6; `SECTION_MARKERS`).
 *  @typedef {"letter" | "numeral" | "paren_letter" | "paren_numeral" | "roman"} SectionMarker */
/** An amending clause's relation (R6; `AMENDING_RELATIONS`).
 *  @typedef {"amends" | "adds" | "repeals" | "renumbers" | "recodifies"} AmendingRelation */
/** A meeting marker (R6; `MEETING_MARKERS`).
 *  @typedef {"cancelled" | "special" | "concurrent"} MeetingMarker */
/** What a roster word names (R6; `ROSTER_KINDS`).
 *  @typedef {"roster" | "chart"} RosterKind */
/** The role a roster header plays (R6; `ROSTER_ROLES`).
 *  @typedef {"name" | "title" | "unit" | "start" | "end" | "as_of" | "employee_id" | "contact"} RosterRole */
/** The column a budget header heads (R6; `BUDGET_COLUMNS`).
 *  @typedef {"fund" | "org" | "department" | "department_code" | "program" | "project" | "account" | "amount" | "period" | "phase"} BudgetColumn */
/** The field a policy header label names (R69; `POLICY_HEADER_FIELDS`).
 *  @typedef {"type" | "number" | "title" | "effective" | "supersedes" | "reference" | "coordinator" | "review_due" | "revision_cycle"} PolicyHeaderField */
/** The capacity a MemberType maps to (R60; `MEMBER_CAPACITIES`).
 *  @typedef {"elected" | "appointed"} MemberCapacity */
/** The calendar year a fiscal year is named by (R49; `FISCAL_NAMED_BY`).
 *  @typedef {"start" | "end"} FiscalNamedBy */
/** A template's use (R40; `TEMPLATE_USES`).
 *  @typedef {"file" | "brief"} TemplateUse */
/** A template review's kind (R40; `REVIEW_KINDS`).
 *  @typedef {"member" | "professional"} ReviewKind */
/** A template review's outcome (R40; `REVIEW_OUTCOMES`).
 *  @typedef {"no_concerns" | "concerns" | "changes_requested"} ReviewOutcome */

/* ------------------------------------------------------------------------------------------------ */
/* Pieces several sections share.                                                                   */

/**
 * A pattern (R2): a JavaScript regular expression's source and its flags.
 * @typedef {Object} Pattern
 * @property {string} re
 * @property {string} [flags]
 * @bound re compiles as a JavaScript regular expression with flags; flags is drawn from i and u, each at most once.
 */
/**
 * One part of a normal form (R3): a literal, or a capture group of the pattern.
 * @typedef {string | NormalGroup} NormalPart
 */
/**
 * A capture group in a normal form (R3).
 * @typedef {Object} NormalGroup
 * @property {number} group
 * @property {boolean} [unpad] its leading zeros removed, keeping one character
 * @property {boolean} [upper] its letters upper-cased
 * @property {string} [default] used when the group did not match
 * @bound group: a whole number, 1 to the pattern's number of capture groups.
 */
/**
 * An office's or venue's weekly hours (R42); a day not listed is closed.
 * @typedef {Object} Hours
 * @property {HoursSpan[]} weekly
 * @property {Status} status
 * @property {string} basis
 */
/**
 * One span of opening hours (R42).
 * @typedef {Object} HoursSpan
 * @property {Weekday} day
 * @property {string} open
 * @property {string} close
 * @bound open and close: HH:MM, 24-hour, open before close; one day's spans never overlap.
 */
/**
 * A time zone, the profile's or an office's own (R41, R74).
 * @typedef {Object} TimeZone
 * @property {string} value an IANA time-zone name, `Area/Location` or `UTC`
 * @property {Status} status
 * @property {string} basis
 */
/**
 * An amount of time in R26's units (R53, R82).
 * @typedef {Object} Amount
 * @property {number} amount
 * @property {Unit} units
 * @bound amount: a positive whole number.
 */
/**
 * An identifier in one of the profile's identifier schemes (R59, R94).
 * @typedef {Object} Identifier
 * @property {string} scheme
 * @property {string} id
 */
/**
 * How a legal organisation is reached (R32).
 * @typedef {Object} Contact
 * @property {ContactHow} how
 * @property {string} value
 */
/**
 * How a pointer is reached (R89).
 * @typedef {Object} PointerContact
 * @property {PointerHow} how
 * @property {string} value
 */

/* ------------------------------------------------------------------------------------------------ */
/* The profile (R1–R98). Every section is optional: an absent section supplies nothing, never "none exists" (R27).   */

/**
 * A jurisdiction profile: a plain, JSON-serialisable object, every local fact with the basis it rests on.
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} name
 * @property {string[]} covers
 * @property {boolean} [test]
 * @property {Spaces} [spaces]
 * @property {System[]} [systems]
 * @property {MixedHost[]} [mixed_hosts]
 * @property {Crosswalk[]} [crosswalks]
 * @property {Vocabulary} [vocabulary]
 * @property {Practice} [practice]
 * @property {SearchTerm[]} [search_terms]
 * @property {RecordsLaw[]} [records_laws]
 * @property {StandardSource[]} [standard_sources]
 * @property {Counterparty[]} [counterparties]
 * @property {ActionKind[]} [action_kinds]
 * @property {Deadline[]} [deadlines]
 * @property {LegalOrganisation[]} [legal_organisations]
 * @property {Holiday[]} [holidays]
 * @property {Locale} [locale]
 * @property {TimeZone} [time_zone]
 * @property {Weekend} [weekend]
 * @property {Computation[]} [computation]
 * @property {FiscalYear[]} [fiscal_year]
 * @property {LawRank[]} [law_ranks]
 * @property {InstrumentKey} [instrument_key]
 * @property {ProceedingKind[]} [proceeding_kinds]
 * @property {ProceedingFlow[]} [proceeding_flows]
 * @property {IdentifierScheme[]} [identifier_schemes]
 * @property {ClassificationScheme[]} [classification_schemes]
 * @property {LawfulDemand[]} [lawful_demands]
 * @property {Recurrence[]} [recurrences]
 * @property {LocalName[]} [local_names]
 * @property {LegalFact[]} [legal_facts]
 * @property {ProcedureGuide[]} [procedure_guides]
 * @property {Phrasing[]} [phrasings]
 * @property {Pointer[]} [pointers]
 * @property {RecordsHelp} [records_help]
 * @property {Forum[]} [forums]
 * @bound id matches ^[a-z0-9][a-z0-9-]*$; covers is non-empty; test is true only for a profile whose facts are made up.
 * @bound basis, wherever a fact carries one: M-<n>, YYYY-MM-DD, D-<n>, DEC-<n> or K<n>, each optionally followed by one qualifying word, several joined by ", " or "; "; or exactly UNMEASURED; TEST only in a test profile.
 * @bound status and basis agree: researched rests on a measurement (M-<n> or a dated entry), ruled on a ruling (D-<n>, DEC-<n> or K<n>); UNMEASURED is no basis for a fact that carries a status.
 */

/**
 * The spaces (R3), by name.
 * @typedef {Object} Spaces
 * @property {Space} [enactment]
 * @property {Space} [project]
 * @property {Space} [fund]
 * @property {Space} [parcel]
 * @property {Space} [account]
 * @property {Space} [object]
 * @property {Space} [vendor]
 * @property {Space} [proceeding]
 * @property {Space} [person]
 * @property {Space} [body]
 * @property {Space} [office]
 * @property {Space} [institution]
 */
/**
 * One space's forms (R3); `kinds` on the enactment space only.
 * @typedef {Object} Space
 * @property {string} label
 * @property {Form[]} forms
 * @property {EnactmentKind[]} [kinds]
 * @bound no form name twice in one space.
 */
/**
 * A form's definition without its basis: what two profiles must give alike under the form's name (R15).
 * @typedef {Object} FormRule
 * @property {string} form
 * @property {Pattern} pattern
 * @property {NormalPart[]} normal
 * @property {FormClean} [clean]
 */
/**
 * A form a value is written in (R3).
 * @typedef {FormRule & { basis: string }} Form
 * @bound normal is non-empty and names only groups the pattern has.
 */
/**
 * The formatting removed before a form's pattern is tried (R3).
 * @typedef {Object} FormClean
 * @property {Pattern[]} [strip]
 * @property {"remove" | "collapse"} [spaces]
 * @property {true} [upper]
 */
/**
 * A kind of enactment, its prefix and the first number of it the system's record holds (R3).
 * @typedef {Object} EnactmentKind
 * @property {string} kind
 * @property {Pattern} prefix
 * @property {Floor} [floor]
 * @property {string} basis
 */
/**
 * A floor without its basis: what two profiles must give alike under the kind (R15).
 * @typedef {Object} FloorRule
 * @property {number} first
 * @property {string} system
 */
/**
 * The first number of a kind that a system's record holds (R3).
 * @typedef {FloorRule & { basis: string }} Floor
 * @bound first: a positive whole number; system: the origin of one of the profile's systems.
 */
/**
 * A system that publishes records (R4, R38).
 * @typedef {Object} System
 * @property {string} origin
 * @property {string} name
 * @property {string[]} hosts
 * @property {Pattern} [path]
 * @property {{ item: Pattern, file: Pattern }} [links]
 * @property {boolean} [republishes]
 * @property {boolean} [provenance_stated]
 * @property {string} basis
 * @bound hosts: a non-empty list of lower-case host names.
 */
/**
 * A host that serves many offices' publications, so an address there names no system (R4).
 * @typedef {Object} MixedHost
 * @property {string} host
 * @property {string} why
 * @property {string} basis
 * @bound host: a lower-case host name.
 */
/**
 * A captured crosswalk between two forms of one space (R5).
 * @typedef {Object} Crosswalk
 * @property {SpaceName} space
 * @property {[string, string]} forms
 * @property {[string, string][]} pairs
 * @property {string} source
 * @property {string} basis
 * @bound source: 64 hexadecimal characters, the capture's content hash; forms: two forms of the space; each pair's values are in those forms.
 */

/**
 * The vocabulary (R6, R58, R60, R69), by key.
 * @typedef {Object} Vocabulary
 * @property {VocabularyPattern[]} [furniture]
 * @property {VocabularyPattern[]} [bodies]
 * @property {VocabularyPattern[]} [member_titles]
 * @property {VocabularyPattern[]} [enactment_markers]
 * @property {CodeEntry[]} [codes]
 * @property {FileNumber[]} [file_numbers]
 * @property {VocabularyPattern[]} [report_titles]
 * @property {VocabularyPattern[]} [report_sections]
 * @property {VocabularyPattern[]} [recommendation_openers]
 * @property {VocabularyPattern[]} [template_blanks]
 * @property {AmendingEntry[]} [amending]
 * @property {MeetingMarkerEntry[]} [meeting_markers]
 * @property {BodyVariant[]} [body_variants]
 * @property {RosterWord[]} [roster_words]
 * @property {RosterHeader[]} [roster_headers]
 * @property {VocabularyPattern[]} [staff_titles]
 * @property {VocabularyPattern[]} [financial_report_titles]
 * @property {VocabularyPattern[]} [budget_book_titles]
 * @property {VocabularyPattern[]} [financial_headings]
 * @property {VocabularyPattern[]} [fiscal_year_forms]
 * @property {BudgetHeader[]} [budget_headers]
 * @property {VoteValue[]} [vote_values]
 * @property {ResponseStatus[]} [response_statuses]
 * @property {MemberType[]} [member_types]
 * @property {PolicyHeader[]} [policy_headers]
 */
/**
 * A vocabulary entry that is a pattern alone (R6).
 * @typedef {Object} VocabularyPattern
 * @property {Pattern} pattern
 * @property {string} basis
 */
/**
 * A code of law cited by section (R6).
 * @typedef {Object} CodeEntry
 * @property {string} key
 * @property {string} label
 * @property {Pattern} pattern
 * @property {CodeCopy} [copy]
 * @property {CodeSections} [sections]
 * @property {string} basis
 */
/**
 * The shape of a code's section numbers (R6).
 * @typedef {Object} CodeSections
 * @property {Pattern} number
 * @property {string} separators the characters between a number's parts, possibly none
 * @property {SectionMarker[]} markers
 * @bound separators holds no white space.
 */
/**
 * The legislative record's file numbers (R6).
 * @typedef {Object} FileNumber
 * @property {Pattern} pattern
 * @property {string} system
 * @property {string} basis
 */
/**
 * An amending clause's words (R6).
 * @typedef {Object} AmendingEntry
 * @property {Pattern} pattern
 * @property {AmendingRelation} relation
 * @property {string} basis
 */
/**
 * The words a body or event name carries for a marker (R6).
 * @typedef {Object} MeetingMarkerEntry
 * @property {MeetingMarker} marker
 * @property {Pattern} pattern
 * @property {string} basis
 */
/**
 * Body names that are variants of one organisation (R6).
 * @typedef {Object} BodyVariant
 * @property {Pattern} pattern
 * @property {string} organisation
 * @property {string} basis
 * @bound organisation matches ^[a-z][a-z0-9_]*$.
 */
/**
 * Words that self-name a roster or org chart (R6); absent kind, both.
 * @typedef {Object} RosterWord
 * @property {Pattern} pattern
 * @property {RosterKind} [kind]
 * @property {string} basis
 */
/**
 * A roster header and the role it plays (R6).
 * @typedef {Object} RosterHeader
 * @property {RosterRole} role
 * @property {Pattern} pattern
 * @property {string} basis
 */
/**
 * A budget header and the column it heads (R6).
 * @typedef {Object} BudgetHeader
 * @property {BudgetColumn} column
 * @property {Pattern} pattern
 * @property {string} basis
 */
/**
 * A value a vote is recorded in (R58).
 * @typedef {Object} VoteValue
 * @property {string} value
 * @property {string} label
 * @property {string} citation
 * @property {string} basis
 * @bound value matches ^[a-z][a-z0-9_]*$, none twice in one profile.
 */
/**
 * A status a response to a duty is reported in (R58, R77); absent applies_to, every kind.
 * @typedef {Object} ResponseStatus
 * @property {string} status
 * @property {string} label
 * @property {string} citation
 * @property {string} [applies_to]
 * @property {string} basis
 * @bound status matches ^[a-z][a-z0-9_]*$, none twice in one profile; applies_to is a kind of the profile.
 */
/**
 * A MemberType and the capacity it maps to, for one body-variant organisation or for all (R60).
 * @typedef {Object} MemberType
 * @property {string} member_type
 * @property {MemberCapacity} capacity
 * @property {string} [organisation]
 * @property {string} basis
 */
/**
 * A label a policy document prints in its header block (R69).
 * @typedef {Object} PolicyHeader
 * @property {PolicyHeaderField} field
 * @property {Pattern} pattern
 * @property {string} basis
 */

/**
 * Practice (R7).
 * @typedef {Object} Practice
 * @property {MinutesDue} [minutes_due_days]
 */
/**
 * The days after a meeting at which absent minutes raise a question (R7); absent count, calendar.
 * @typedef {Object} MinutesDue
 * @property {number} value
 * @property {Count} [count]
 * @property {string | undefined} [closures] the closure list a business count skips
 * @property {string} basis
 * @bound value: a positive whole number; closures names a holidays list of the profile.
 */
/**
 * A term a search uses when its caller names none (R7).
 * @typedef {Object} SearchTerm
 * @property {string} term
 * @property {string} basis
 */
/**
 * A public-records law (R7, R76, R96).
 * @typedef {Object} RecordsLaw
 * @property {LawLevel} level
 * @property {string} name
 * @property {string} citation
 * @property {LawStage[]} [stages]
 * @property {Requesters} [requesters]
 * @property {string} [response] the rule of the deadline that is the law's first-request window
 * @property {string} basis
 */
/**
 * A stage a records law has, in the law's order (R76).
 * @typedef {Object} LawStage
 * @property {string} stage
 * @property {string} label
 * @property {string} citation
 * @bound stage matches ^[a-z][a-z0-9_]*$, none twice in one law.
 */
/**
 * Who may request under a law (R76).
 * @typedef {Object} Requesters
 * @property {string} text
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 */
/**
 * Where the standards an act is measured against come from (R23, R31, R63–R65).
 * @typedef {Object} StandardSource
 * @property {string} source
 * @property {StandardSourceKind} kind
 * @property {string} issuer
 * @property {Sector} [sector]
 * @property {LawLevel} [level]
 * @property {Pattern} cite
 * @property {string} [code]
 * @property {string} [key]
 * @property {Series} [series]
 * @property {NormalPart[]} [normal]
 * @property {string} basis
 * @bound a statute, regulation, ordinance or court entry carries level; any other carries level or sector; a level goes only beside sector government; key matches ^[a-z0-9][a-z0-9-]*$.
 */
/**
 * One numbered family of documents an issuer publishes (R63).
 * @typedef {Object} Series
 * @property {string} key
 * @property {string} label
 * @bound key matches ^[a-z][a-z0-9_]*$.
 */
/**
 * An office an action is addressed to, by official role and body (R24, R42, R59, R74).
 * @typedef {Object} Counterparty
 * @property {string} role
 * @property {string} body
 * @property {CounterpartyLevel} level
 * @property {boolean} elected
 * @property {boolean} [oversight]
 * @property {Hours} [hours]
 * @property {TimeZone} [time_zone]
 * @property {CounterpartyIds} [ids]
 * @property {Within} [within]
 * @property {string} [organisation]
 * @property {string} basis
 */
/**
 * An office's and its body's identifiers (R59); at least one.
 * @typedef {Object} CounterpartyIds
 * @property {Identifier} [office]
 * @property {Identifier} [body]
 */
/**
 * The organisation an office's body is part of (R59).
 * @typedef {Object} Within
 * @property {string} label
 * @property {string} kind
 * @property {Identifier[]} ids
 * @bound kind matches ^[a-z][a-z0-9_]*$.
 */
/**
 * What a group can file or send (R25, R39, R40, R81, R87).
 * @typedef {Object} ActionKind
 * @property {string} kind
 * @property {string} label
 * @property {Tier} [tier]
 * @property {string[]} [laws]
 * @property {Venue} [venue]
 * @property {Template} [template]
 * @property {PurposedTemplate[]} [templates]
 * @property {string} [advisory]
 * @property {Evidence} [evidence]
 * @property {KindShape} [shape]
 * @property {string} basis
 * @bound kind matches ^[a-z][a-z0-9_]*$; a kind gives template or templates, not both; advisory only on tier 2.
 */
/**
 * Where a kind is filed and by what means, and its channel's facts (R25, R42, R48, R74, R82).
 * @typedef {Object} Venue
 * @property {string} name
 * @property {VenueHow} how
 * @property {Hours} [hours]
 * @property {TimeZone} [time_zone]
 * @property {Cutoff} [cutoff]
 * @property {Outage[]} [outages]
 * @property {Receipt} [receipt]
 * @property {VenueFact[]} [facts]
 * @property {string} basis
 */
/**
 * A venue's cutoff (R48).
 * @typedef {Object} Cutoff
 * @property {string} time
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 * @bound time: HH:MM, 24-hour.
 */
/**
 * A span a channel was down (R48).
 * @typedef {Object} Outage
 * @property {string} from
 * @property {string} to
 * @property {Status} status
 * @property {string} basis
 * @bound from and to: instants with their offset, YYYY-MM-DDTHH:MM[:SS] then Z or ±HH:MM, from before to.
 */
/**
 * A venue's receipt rule (R48).
 * @typedef {Object} Receipt
 * @property {"next_business_day"} rule
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 */
/**
 * A fact a venue states (R82).
 * @typedef {Object} VenueFact
 * @property {VenueFactName} fact
 * @property {string} value
 * @property {Amount} [amount]
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 * @bound value: at most 500 characters; one fact once per venue.
 */
/**
 * A template a filing is pre-filled into, or a briefing built on, with its attribution (R40, R87 (b)).
 * @typedef {Object} Template
 * @property {string} id
 * @property {number} version
 * @property {TemplateUse} use
 * @property {string} text
 * @property {string} notes
 * @property {string} authored_by
 * @property {string[]} contributors
 * @property {Review[]} reviews
 * @property {string} approved_by
 * @property {string} approved_at
 * @property {string} [name]
 * @property {{ citation: string }[]} [sources]
 * @property {string} basis
 * @bound id matches ^TPL-[a-z0-9][a-z0-9-]*$, none twice in a profile; version: a positive whole number; approved_at: a real YYYY-MM-DD; approved_by differs from authored_by; basis: a ruling K<n> (TEST in a test profile); name: at most 120 characters on one line; sources: at least one.
 */
/**
 * A template in a kind's set (R81, R87 (b)): R40's template with its purpose, name and sources given.
 * @typedef {Object} PurposedTemplate
 * @property {string} id
 * @property {number} version
 * @property {TemplateUse} use
 * @property {string} text
 * @property {string} notes
 * @property {string} authored_by
 * @property {string[]} contributors
 * @property {Review[]} reviews
 * @property {string} approved_by
 * @property {string} approved_at
 * @property {string} purpose
 * @property {string} name
 * @property {{ citation: string }[]} sources
 * @property {string} basis
 * @bound purpose matches ^[a-z][a-z0-9_]*$, none twice in a kind; the rest as R40's template.
 */
/**
 * A review of a template (R40).
 * @typedef {Object} Review
 * @property {string} reviewer
 * @property {ReviewKind} kind
 * @property {string | null | undefined} [organisation]
 * @property {string | null | undefined} [credential]
 * @property {string} scope
 * @property {ReviewOutcome} outcome
 * @property {string} at
 * @bound at: a real YYYY-MM-DD.
 */
/**
 * A venue's evidence standard (R39).
 * @typedef {Object} Evidence
 * @property {string} standard
 * @property {Grade[]} accepts
 * @property {Grade[]} [contestable]
 * @property {string} basis
 * @bound standard: at most 200 characters; accepts is non-empty.
 */
/**
 * A grade a venue admits (R39).
 * @typedef {Object} Grade
 * @property {string} grade a letter of record-grammar's BASIS_GRADES
 * @property {boolean} [coattested]
 */
/**
 * A period the law sets, held as data (R26, R47, R75, R87 (c), R97). Given as `days` alone (the pre-T33 form) or as
 * `units` and `amount`.
 * @typedef {Object} Deadline
 * @property {string} rule
 * @property {string} applies_to a kind of the profile, or claim
 * @property {Unit} [units]
 * @property {number} [amount]
 * @property {number} [days]
 * @property {Count} [count]
 * @property {Direction} [direction]
 * @property {Start} starts
 * @property {Starter} [starter]
 * @property {boolean} [roll]
 * @property {string} [closures]
 * @property {string} [computation]
 * @property {Extension} [extension]
 * @property {Tolling[]} [tolling]
 * @property {Observed} [observed]
 * @property {Weekday[]} [applies_on]
 * @property {string} [due_at]
 * @property {OwedBy} [owed_by]
 * @property {Consequence} [consequence]
 * @property {true} [defends]
 * @property {string} citation
 * @property {Status} status
 * @property {string} [label]
 * @property {string} basis
 * @bound days alone, or units and amount; amount and days: positive whole numbers; count only with units days; starter only with starts third_party; due_at is close_of_business or HH:MM; applies_on: non-empty, each day once.
 */
/**
 * The counterparty whose act starts a third party's count (R75), by role and body.
 * @typedef {Object} Starter
 * @property {string} role
 * @property {string} body
 */
/**
 * A deadline's extension (R26).
 * @typedef {Object} Extension
 * @property {number} days
 * @property {Count} count
 * @property {string} when
 * @property {string} [citation]
 */
/**
 * A condition the law suspends a count on (R26).
 * @typedef {Object} Tolling
 * @property {string} when
 * @property {string} citation
 */
/**
 * The closure list a body is observed to use (R47), held beside the rule.
 * @typedef {Object} Observed
 * @property {string} closures
 * @property {Status} status
 * @property {string} basis
 */
/**
 * The law's stated consequence, quoted (R75).
 * @typedef {Object} Consequence
 * @property {string} text
 * @property {string} citation
 */
/**
 * A legal organisation (R32, R78).
 * @typedef {Object} LegalOrganisation
 * @property {string} name
 * @property {string[]} [evaluates]
 * @property {boolean} [defends]
 * @property {Contact[]} contacts
 * @property {string} basis
 * @bound evaluates names kinds of tier 2 or 3; it is non-empty, or defends is true; contacts is non-empty.
 */
/**
 * A year's closure days for an office calendar or a named closure list (R33, R43, R47).
 * @typedef {Object} Holiday
 * @property {number} year
 * @property {string} [list]
 * @property {string} [citation]
 * @property {HolidayOffice[]} [offices]
 * @property {HolidayDay[]} days
 * @property {Status} status
 * @property {string} basis
 * @bound year: four digits; list matches ^[a-z][a-z0-9_]*$ and comes with citation; offices: non-empty; a year once per list and offices.
 */
/**
 * An office a holiday entry names: a counterparty's role, or the kind whose venue it closes (R43).
 * @typedef {string | { venue: string }} HolidayOffice
 */
/**
 * One closure day (R33).
 * @typedef {Object} HolidayDay
 * @property {string} date
 * @property {string} name
 * @bound date: a real YYYY-MM-DD in the entry's year, none twice.
 */
/**
 * The language and region of the jurisdiction's publications (R37).
 * @typedef {Object} Locale
 * @property {string} value one well-formed BCP 47 tag
 * @property {string} basis
 */
/**
 * The days offices do not open for business (R46).
 * @typedef {Object} Weekend
 * @property {Weekday[]} days
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 * @bound days: non-empty, each once, leaving some day open.
 */
/**
 * How a day period is computed (R46).
 * @typedef {Object} Computation
 * @property {string} key
 * @property {"exclude_first_include_last"} rule
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 * @bound key matches ^[a-z][a-z0-9_]*$, none twice.
 */
/**
 * A body's fiscal year (R49).
 * @typedef {Object} FiscalYear
 * @property {string} body a counterparty body, or * for every body
 * @property {string} start
 * @property {FiscalNamedBy} named_by
 * @property {string} label
 * @property {Status} status
 * @property {string} basis
 * @bound start: MM-DD; label uses {start}, {end}, {start2} or {end2} and no other placeholder.
 */
/**
 * The rank of a source kind at a law level (R50).
 * @typedef {Object} LawRank
 * @property {StandardSourceKind} kind
 * @property {LawLevel} level
 * @property {number} rank
 * @property {string} basis
 * @bound rank: a positive whole number, 1 the highest.
 */
/**
 * The segment an instrument's work key begins with (R50).
 * @typedef {Object} InstrumentKey
 * @property {string} jurisdiction
 * @property {string} basis
 * @bound jurisdiction matches ^[a-z0-9][a-z0-9-]*$.
 */
/**
 * A kind of proceeding the forums hold (R51).
 * @typedef {Object} ProceedingKind
 * @property {string} kind
 * @property {string} label
 * @property {ForumKind} forum_kind
 * @property {string} basis
 */
/**
 * A kind of proceeding's ordered stages (R51).
 * @typedef {Object} ProceedingFlow
 * @property {string} kind
 * @property {FlowStage[]} stages
 * @property {string} citation
 * @property {string} basis
 */
/**
 * One stage of a proceeding (R51).
 * @typedef {Object} FlowStage
 * @property {string} stage
 * @property {string} label
 * @property {string[]} reached_by
 * @bound stage and each reached_by entry match ^[a-z][a-z0-9_]*$; reached_by is non-empty.
 */
/**
 * A scheme a registry identifier is in (R52).
 * @typedef {Object} IdentifierScheme
 * @property {string} scheme
 * @property {string} label
 * @property {string[]} entity_kinds
 * @property {string} space
 * @property {string} [form]
 * @property {string[]} [systems]
 * @property {string} basis
 */
/**
 * The codes a budget or ledger classifies by (R52).
 * @typedef {Object} ClassificationScheme
 * @property {string} scheme
 * @property {string} label
 * @property {ClassificationKind} kind
 * @property {{ code: string, label: string }[]} [codes]
 * @property {Pattern[]} [forms]
 * @property {string} basis
 */
/**
 * A lawful demand to remove a personal fact (R53).
 * @typedef {Object} LawfulDemand
 * @property {string} kind
 * @property {string} label
 * @property {DemandCover[]} covers
 * @property {Amount} within
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 */
/**
 * A body's stated meeting schedule (R54).
 * @typedef {Object} Recurrence
 * @property {string} body
 * @property {string} rrule
 * @property {string} dtstart
 * @property {string} citation
 * @property {Status} status
 * @property {string} basis
 * @bound rrule: in civil-time's RFC 5545 subset; dtstart: a local YYYY-MM-DDTHH:MM[:SS], read in the profile's time zone.
 */
/**
 * An official local name (R70).
 * @typedef {Object} LocalName
 * @property {string} name
 * @property {LocalNameKind} kind
 * @property {Explanation[]} [explanations]
 * @property {Translation[]} [translations]
 * @property {string} basis
 */
/**
 * What a local name is, in a language (R70).
 * @typedef {Object} Explanation
 * @property {string} locale
 * @property {string} text
 * @property {string} basis
 */
/**
 * An official translation of a local name (R70).
 * @typedef {Object} Translation
 * @property {string} locale
 * @property {string} text
 * @property {string} source
 * @property {string} basis
 */
/**
 * A legal fact shown at the moment it matters (R79).
 * @typedef {Object} LegalFact
 * @property {string} key
 * @property {LegalFactTrigger} trigger
 * @property {string} statement
 * @property {string} citation
 * @property {{ amount: number, unit: string }} [threshold]
 * @property {string[]} [applies_to]
 * @property {Status} status
 * @property {string} basis
 * @bound key matches ^[a-z][a-z0-9_]*$, none twice; threshold's amount is positive and finite.
 */
/**
 * A kind's procedure guide (R80).
 * @typedef {Object} ProcedureGuide
 * @property {string} kind
 * @property {GuideItem[]} items
 * @property {Status} status
 * @property {string} basis
 */
/**
 * One item of a procedure guide, in the profile's order (R80, R87 (d)).
 * @typedef {Object} GuideItem
 * @property {string} route
 * @property {string} [expect]
 * @property {string} citation
 * @property {string[]} [after]
 */
/**
 * A phrasing a profile adds (R86).
 * @typedef {Object} Phrasing
 * @property {string} locale
 * @property {PhrasingKind} kind
 * @property {string} phrase
 * @property {string} basis
 * @bound phrase: 2 to 100 characters on one line.
 */
/**
 * A place outside Civicsmith a member is sent to (R89).
 * @typedef {Object} Pointer
 * @property {PointerKind} kind
 * @property {string} name
 * @property {string} does
 * @property {PointerContact[]} contacts
 * @property {Hours} [hours]
 * @property {string[]} [languages]
 * @property {string} source
 * @property {"researched"} status
 * @property {string} basis
 * @bound name: 1 to 200 characters on one line; does: 1 to 500 characters; contacts and languages: non-empty; basis: a dated entry YYYY-MM-DD.
 */
/**
 * What the place's public-records law obliges an office to do (R93).
 * @typedef {Object} RecordsHelp
 * @property {string} law
 * @property {number} days
 * @property {number} extra_days
 * @property {{ reason: string, citation: string }[]} extension_reasons
 * @property {{ name: string, url: string }} [portal]
 * @property {{ ordinance: string, window: string, request: string, citation: string }} [faster]
 * @property {RecordsHelpCitations} citations
 * @property {"researched"} status
 * @property {string} basis
 * @bound days and extra_days: positive whole numbers; extension_reasons: non-empty; portal.url: an http(s) address; basis: a dated entry YYYY-MM-DD.
 */
/**
 * One citation for each sentence of the records-request help (R93; `RECORDS_HELP_CITATIONS`).
 * @typedef {Object} RecordsHelpCitations
 * @property {string} answer
 * @property {string} extend
 * @property {string} assist
 * @property {string} segregate
 * @property {string} refuse_in_writing
 * @property {string} electronic
 * @property {string} cost
 * @property {string} cost_electronic
 * @property {string} inspect_photograph
 * @property {string} purpose
 */
/**
 * A court or other forum of the place (R94).
 * @typedef {Object} Forum
 * @property {string} label
 * @property {ForumKind} forum_kind
 * @property {Identifier[]} [ids]
 * @property {string} basis
 */

/* ------------------------------------------------------------------------------------------------ */
/* What list, get and combine hand back (R8, R9, R12–R16).                                           */

/**
 * A held profile as `list` names it (R8).
 * @typedef {Object} ProfileSummary
 * @property {string} id
 * @property {string} name
 * @property {string[]} covers
 * @property {boolean} test
 */
/**
 * Which profile gave a fact, and the basis it gave it on (R14).
 * @typedef {Object} BasisTag
 * @property {string} profile
 * @property {string} basis
 */
/**
 * What `combine` adds to each fact (R13, R14): the first giver's id, and every giver's basis.
 * @typedef {Object} Tags
 * @property {string} profile
 * @property {BasisTag[]} bases
 */
/**
 * A fact of the combined view: the fact as its first giver wrote it, tagged (R13, R14).
 * @template T
 * @typedef {T & Tags} Tagged
 */

/**
 * The combined view (R13): the profile's shape, with the profiles combined and, on each fact, its tags. A fact the
 * profiles disagree on is withheld (R15): it is absent here and named in the conflicts.
 * @typedef {Object} View
 * @property {string} id the combined ids joined by +
 * @property {string} name
 * @property {string[]} covers
 * @property {boolean} test
 * @property {string[]} profiles
 * @property {ViewSpaces} [spaces]
 * @property {Tagged<System>[]} [systems]
 * @property {Tagged<MixedHost>[]} [mixed_hosts]
 * @property {Tagged<Crosswalk>[]} [crosswalks]
 * @property {ViewVocabulary} [vocabulary]
 * @property {ViewPractice} [practice]
 * @property {Tagged<Locale>} [locale]
 * @property {Tagged<TimeZone>} [time_zone]
 * @property {Tagged<SearchTerm>[]} [search_terms]
 * @property {Tagged<LegalOrganisation>[]} [legal_organisations]
 * @property {Tagged<Phrasing>[]} [phrasings]
 * @property {Tagged<RecordsHelp>} [records_help]
 * @property {Tagged<Forum>[]} [forums]
 * @property {ViewPointer[]} [pointers]
 * @property {ViewRecordsLaw[]} [records_laws]
 * @property {ViewStandardSource[]} [standard_sources]
 * @property {ViewCounterparty[]} [counterparties]
 * @property {ViewActionKind[]} [action_kinds]
 * @property {ViewDeadline[]} [deadlines]
 * @property {ViewHoliday[]} [holidays]
 * @property {Tagged<Weekend>} [weekend]
 * @property {Tagged<InstrumentKey>} [instrument_key]
 * @property {Tagged<Computation>[]} [computation]
 * @property {Tagged<FiscalYear>[]} [fiscal_year]
 * @property {Tagged<LawRank>[]} [law_ranks]
 * @property {Tagged<ProceedingFlow>[]} [proceeding_flows]
 * @property {Tagged<LawfulDemand>[]} [lawful_demands]
 * @property {Tagged<LegalFact>[]} [legal_facts]
 * @property {Tagged<ProcedureGuide>[]} [procedure_guides]
 * @property {Tagged<ProceedingKind>[]} [proceeding_kinds]
 * @property {Tagged<IdentifierScheme>[]} [identifier_schemes]
 * @property {Tagged<ClassificationScheme>[]} [classification_schemes]
 * @property {Tagged<Recurrence>[]} [recurrences]
 * @property {ViewLocalName[]} [local_names]
 */
/**
 * The view's spaces, by name.
 * @typedef {Object} ViewSpaces
 * @property {ViewSpace} [enactment]
 * @property {ViewSpace} [project]
 * @property {ViewSpace} [fund]
 * @property {ViewSpace} [parcel]
 * @property {ViewSpace} [account]
 * @property {ViewSpace} [object]
 * @property {ViewSpace} [vendor]
 * @property {ViewSpace} [proceeding]
 * @property {ViewSpace} [person]
 * @property {ViewSpace} [body]
 * @property {ViewSpace} [office]
 * @property {ViewSpace} [institution]
 */
/**
 * A space in the view: its labels joined with "; ", its forms, and its kinds (enactment only).
 * @typedef {Object} ViewSpace
 * @property {string} label
 * @property {Tagged<Form>[]} forms
 * @property {ViewEnactmentKind[]} [kinds]
 */
/**
 * An enactment kind's own facts in the view: its floor, kept only where the profiles agree, tagged.
 * @typedef {Object} EnactmentKindFacts
 * @property {string} kind
 * @property {Pattern} prefix
 * @property {Tagged<Floor> | undefined} [floor]
 * @property {string} basis
 */
/** @typedef {Tagged<EnactmentKindFacts>} ViewEnactmentKind */
/**
 * The view's vocabulary, by key.
 * @typedef {Object} ViewVocabulary
 * @property {Tagged<VocabularyPattern>[]} [furniture]
 * @property {Tagged<VocabularyPattern>[]} [bodies]
 * @property {Tagged<VocabularyPattern>[]} [member_titles]
 * @property {Tagged<VocabularyPattern>[]} [enactment_markers]
 * @property {Tagged<CodeEntry>[]} [codes]
 * @property {Tagged<FileNumber>[]} [file_numbers]
 * @property {Tagged<VocabularyPattern>[]} [report_titles]
 * @property {Tagged<VocabularyPattern>[]} [report_sections]
 * @property {Tagged<VocabularyPattern>[]} [recommendation_openers]
 * @property {Tagged<VocabularyPattern>[]} [template_blanks]
 * @property {Tagged<AmendingEntry>[]} [amending]
 * @property {Tagged<MeetingMarkerEntry>[]} [meeting_markers]
 * @property {Tagged<BodyVariant>[]} [body_variants]
 * @property {Tagged<RosterWord>[]} [roster_words]
 * @property {Tagged<RosterHeader>[]} [roster_headers]
 * @property {Tagged<VocabularyPattern>[]} [staff_titles]
 * @property {Tagged<VocabularyPattern>[]} [financial_report_titles]
 * @property {Tagged<VocabularyPattern>[]} [budget_book_titles]
 * @property {Tagged<VocabularyPattern>[]} [financial_headings]
 * @property {Tagged<VocabularyPattern>[]} [fiscal_year_forms]
 * @property {Tagged<BudgetHeader>[]} [budget_headers]
 * @property {Tagged<VoteValue>[]} [vote_values]
 * @property {Tagged<ResponseStatus>[]} [response_statuses]
 * @property {Tagged<MemberType>[]} [member_types]
 * @property {Tagged<PolicyHeader>[]} [policy_headers]
 */
/**
 * The view's practice: present whenever a profile combined gives practice, its value kept only where they agree.
 * @typedef {Object} ViewPractice
 * @property {ViewMinutesDue} [minutes_due_days]
 */
/**
 * The minutes-due value in the view: `count` and `closures` as its first giver wrote them (R7).
 * @typedef {Object} ViewMinutesDue
 * @property {number} value
 * @property {Count | undefined} [count]
 * @property {string | undefined} [closures]
 * @property {string} basis
 * @property {string} profile
 * @property {BasisTag[]} bases
 */
/**
 * A pointer in the view: its hours tagged with every giver's basis (R90).
 * @typedef {Object} PointerFacts
 * @property {PointerKind} kind
 * @property {string} name
 * @property {string} does
 * @property {PointerContact[]} contacts
 * @property {Tagged<Hours> | undefined} [hours]
 * @property {string[]} [languages]
 * @property {string} source
 * @property {"researched"} status
 * @property {string} basis
 */
/** @typedef {Tagged<PointerFacts>} ViewPointer */
/**
 * A records law in the view: its stages, requesters and response kept only where the profiles that give them agree
 * under its name (R76, R96).
 * @typedef {Object} RecordsLawFacts
 * @property {LawLevel} level
 * @property {string} name
 * @property {string} citation
 * @property {LawStage[] | undefined} [stages]
 * @property {Tagged<Requesters> | undefined} [requesters]
 * @property {string | undefined} [response]
 * @property {string} basis
 */
/** @typedef {Tagged<RecordsLawFacts>} ViewRecordsLaw */
/**
 * A standard source in the view: a family's label, cite and normal, and an entry's level and sector, withheld where
 * the profiles disagree (R66).
 * @typedef {Object} StandardSourceFacts
 * @property {string} source
 * @property {StandardSourceKind} kind
 * @property {string} issuer
 * @property {Sector} [sector]
 * @property {LawLevel} [level]
 * @property {Pattern} [cite]
 * @property {string} [code]
 * @property {string} [key]
 * @property {{ key: string, label?: string }} [series]
 * @property {NormalPart[]} [normal]
 * @property {string} basis
 */
/** @typedef {Tagged<StandardSourceFacts>} ViewStandardSource */
/**
 * A counterparty in the view: its oversight, hours, time zone, ids, within and organisation kept only where the
 * profiles that give them agree under its role and body (R29, R42, R59, R74).
 * @typedef {Object} CounterpartyFacts
 * @property {string} role
 * @property {string} body
 * @property {CounterpartyLevel} level
 * @property {boolean} elected
 * @property {boolean | undefined} [oversight]
 * @property {Tagged<Hours> | undefined} [hours]
 * @property {Tagged<TimeZone> | undefined} [time_zone]
 * @property {CounterpartyIds | undefined} [ids]
 * @property {Within | undefined} [within]
 * @property {string | undefined} [organisation]
 * @property {string} basis
 */
/** @typedef {Tagged<CounterpartyFacts>} ViewCounterparty */
/**
 * A template in a kind's set in the view (R81): a single template reads as the set of one, purpose initial.
 * @typedef {Tagged<Template & { purpose: string }>} ViewTemplate
 */
/**
 * An action kind's own facts in the view (R29, R81): its labels joined with "; ", its laws unioned, each one-value fact
 * kept only where the profiles agree.
 * @typedef {Object} ActionKindFacts
 * @property {string} kind
 * @property {string} label
 * @property {string[]} [laws]
 * @property {Tier} [tier]
 * @property {ViewVenue} [venue]
 * @property {Tagged<Template>} [template]
 * @property {string} [advisory]
 * @property {Tagged<Evidence>} [evidence]
 * @property {KindShape} [shape]
 * @property {ViewTemplate[]} [templates]
 */
/** @typedef {Tagged<ActionKindFacts & { basis: string }>} ViewActionKind */
/**
 * A venue's own facts, before and in the view: its hours, time zone, cutoff and receipt kept only where the profiles
 * agree, its outages unioned, each fact one value per fact (R42, R48, R74, R82).
 * @typedef {Object} VenueFacts
 * @property {string} name
 * @property {VenueHow} how
 * @property {Tagged<Hours> | undefined} [hours]
 * @property {Tagged<TimeZone> | undefined} [time_zone]
 * @property {Tagged<Cutoff> | undefined} [cutoff]
 * @property {Tagged<Outage>[] | undefined} [outages]
 * @property {Tagged<Receipt> | undefined} [receipt]
 * @property {Tagged<VenueFact>[] | undefined} [facts]
 * @property {string} basis
 */
/** @typedef {Tagged<VenueFacts>} ViewVenue */
/**
 * A deadline's own facts in the view, under its rule and what it applies to (R29, R55): each field but the citation kept
 * only where the profiles agree, so any of them may be withheld. A day period gives both `days` and `units`/`amount`.
 * @typedef {Object} DeadlineFacts
 * @property {string} rule
 * @property {string} applies_to
 * @property {Unit} [units]
 * @property {number} [amount]
 * @property {Count} [count]
 * @property {Direction} [direction]
 * @property {Start} [starts]
 * @property {Starter} [starter]
 * @property {boolean} [roll]
 * @property {string} [closures]
 * @property {string} [computation]
 * @property {Extension} [extension]
 * @property {Tolling[]} [tolling]
 * @property {Tagged<Observed>} [observed]
 * @property {Weekday[]} [applies_on]
 * @property {string} [due_at]
 * @property {OwedBy} [owed_by]
 * @property {Consequence} [consequence]
 * @property {true} [defends]
 * @property {Status} [status]
 * @property {string} [label]
 * @property {number} [days]
 */
/**
 * A deadline in the view: its facts, and its citations joined with "; ".
 * @typedef {Tagged<DeadlineFacts & { citation: string, basis: string }>} ViewDeadline
 */
/**
 * A year's closure days in the view, under its year, list and offices (R34, R43, R47).
 * @typedef {Object} ViewHoliday
 * @property {number} year
 * @property {string | undefined} [list]
 * @property {string | undefined} [citation]
 * @property {HolidayOffice[] | undefined} [offices]
 * @property {HolidayDay[]} days
 * @property {Status} status
 * @property {string} basis
 * @property {string} profile
 * @property {BasisTag[]} bases
 */
/**
 * A local name's own facts in the view, under its name and kind (R72): one explanation and one translation per
 * language, kept only where the profiles agree; a translation's sources joined with "; ".
 * @typedef {Object} LocalNameFacts
 * @property {string} name
 * @property {LocalNameKind} kind
 * @property {Tagged<Explanation>[]} [explanations]
 * @property {Tagged<Translation>[]} [translations]
 */
/** @typedef {Tagged<LocalNameFacts & { basis: string }>} ViewLocalName */

/**
 * A value one profile gave for a fact the profiles disagree on (R15).
 * @typedef {PlainConflictValue | PracticeConflictValue | HolidayConflictValue} ConflictValue
 */
/**
 * @typedef {Object} PlainConflictValue
 * @property {string} profile
 * @property {ConflictFact} value
 * @property {string} basis
 */
/**
 * A minutes-due value: the value and its count are one fact (R7).
 * @typedef {Object} PracticeConflictValue
 * @property {string} profile
 * @property {number} value
 * @property {Count} count
 * @property {string | undefined} [closures]
 * @property {string} basis
 */
/**
 * A year's closure days: the days and their status are one fact (R34, R44).
 * @typedef {Object} HolidayConflictValue
 * @property {string} profile
 * @property {HolidayDay[]} value
 * @property {Status} status
 * @property {string} basis
 */
/**
 * What a conflict's value may be: the fact as one profile gave it (its basis apart, where it carries one).
 * @typedef {string | number | boolean | null | string[] | Pattern | NormalPart[] | FormRule | FloorRule | TimeZone | RecordsHelp | LawStage[] | Requesters | Hours | CounterpartyIds | Within | VenueFacts | Template | Evidence | Cutoff | Receipt | VenueFact | Starter | Extension | Tolling[] | Observed | Consequence | Weekend | InstrumentKey | Computation | FiscalYear | LawRank | ProceedingFlow | LawfulDemand | LegalFact | ProcedureGuide} ConflictFact
 */
/**
 * A fact the profiles disagree on, withheld from the view (R15): where, each profile's value, and what follows, in
 * words.
 * @typedef {Object} Conflict
 * @property {string} at
 * @property {ConflictValue[]} values
 * @property {string} says
 */
/**
 * Why `combine` refused its list (R12). `at` is the list's index, or null for the whole list; an INVALID_PROFILE
 * carries the profile's own errors (none when two different profiles share an id).
 * @typedef {Object} CombineError
 * @property {number | null} at
 * @property {"NOT_A_LIST" | "UNKNOWN_PROFILE" | "INVALID_PROFILE"} code
 * @property {string} detail
 * @property {ProfileError[]} [errors]
 */
/**
 * The profiles combined.
 * @typedef {Object} Combined
 * @property {true} ok
 * @property {View} view
 * @property {Conflict[]} conflicts
 */
/**
 * The list refused.
 * @typedef {Object} CombineRefusal
 * @property {false} ok
 * @property {CombineError[]} errors
 */
/**
 * What `combine` hands back.
 * @typedef {Combined | CombineRefusal} CombineResult
 */

export {};
