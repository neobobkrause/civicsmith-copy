/* The test profile (R22): the City of Port Ellery and Marlow County, a jurisdiction made up for tests.
 * Every basis is `TEST`. It supplies every section and vocabulary key the first profile supplies, with
 * different values in each, shares no host with it (all hosts are under the reserved `.example`
 * domain), and adds a captured crosswalk, a venue's evidence standard (R39) and attributed templates (R40),
 * which the first profile has none of. Its calendar (R41–R44, R45) has a holiday year for every office with
 * entries of that year for one office and for one venue, hours on an office and a venue, and both statuses.
 * Modules that take local facts are tested against it (`build/layers.md`, "No jurisdiction in the product",
 * rule 3). T33's sections and fields (R57) are here too, with values unlike the first profile's: two closure lists
 * with a rule naming one and observing the other, a one-day weekend, a venue's cutoff, outages and receipt rule,
 * every unit, direction and anchor, fiscal years, law ranks, proceedings, schemes, a lawful demand, recurrences. T34's (R62):
 * vote values, response statuses, a MemberType map, a counterparty with ids, within and organisation, and schemes for a
 * body, a seat and an institution. T35's (R68): policy series of a government issuer at a level and at none, a company's,
 * a standard whose designation reads an edition, a series whose normal form removes formatting, and policy headers. T37's
 * (R73): an official local name of each kind, one explained in two languages and one with an official translation and
 * its source. T45's (R84): an office's and a venue's own time zones, deadlines owed by a body and by the group (one with
 * the law's stated consequence, one the group meets in its own defence), a start by a third party's act, a law whose
 * stages omit one (no fee waiver), who may request, response statuses for one kind, a defending legal organisation, one
 * legal fact per trigger, a procedure guide with routes after outcomes, a kind with two templates, a recognition kind,
 * venue facts, and phrasings. T48's (R91): pointers of each of the six kinds, two of one kind, one with hours and languages,
 * and every means of contact. */
const R = String.raw;

/* R40: a template's whole attribution, as filing-templates reads a profile template (its R15); every blank in
   the texts below is one of filing-templates' blanks. */
/**
 * @typedef {Object} TestReview one review of a made-up template
 * @property {string} reviewer
 * @property {string} kind
 * @property {string} [organisation]
 * @property {string} [credential]
 * @property {string} scope
 * @property {string} outcome
 * @property {string} at
 */
/**
 * @param {string} id
 * @param {string} use
 * @param {string} text
 * @param {TestReview} review
 */
const attributed = (id, use, text, review) => ({
  id, version: 1, use, text, notes: "A made-up template for tests.", authored_by: "Ada Example",
  contributors: ["Ben Example"], reviews: [review], approved_by: "Cy Example", approved_at: "2026-09-01", basis: "TEST",
});

export default {
  id: "test-port-ellery",
  name: "City of Port Ellery and Marlow County (test)",
  covers: ["City of Port Ellery", "Marlow County"],
  test: true,

  spaces: {
    enactment: {
      label: "act or bylaw number (P.E.)",
      forms: [
        { form: "pe", pattern: { re: R`^(?:P\.?E\.?\s*)?(\d{3,4})(?:\s*P\.?E\.?)?$`, flags: "i" },
          normal: [{ group: 1 }], clean: { spaces: "collapse" }, basis: "TEST" },
      ],
      kinds: [
        { kind: "act", prefix: { re: R`act\s+(?:no\.?\s*)?`, flags: "i" },
          floor: { first: 500, system: "ellery.minutes", basis: "TEST" }, basis: "TEST" },
        { kind: "bylaw", prefix: { re: R`bylaw\s+(?:no\.?\s*)?`, flags: "i" },
          floor: { first: 1200, system: "ellery.minutes", basis: "TEST" }, basis: "TEST" },
      ],
    },
    project: {
      label: "works order number",
      forms: [
        { form: "WO-####", pattern: { re: R`^WO-?(\d{4})$` }, normal: ["WO-", { group: 1 }],
          clean: { spaces: "remove", upper: true }, basis: "TEST" },
        { form: "E#####", pattern: { re: R`^(E\d{5})$` }, normal: [{ group: 1 }],
          clean: { spaces: "remove", upper: true }, basis: "TEST" },
      ],
    },
    fund: {
      label: "ledger fund number",
      forms: [
        { form: "###-##", pattern: { re: R`^(\d{3})-(\d{2})$` }, normal: [{ group: 1 }, "-", { group: 2 }],
          clean: { spaces: "remove" }, basis: "TEST" },
      ],
    },
    account: { label: "ledger account", forms: [
      { form: "A-####", pattern: { re: R`^A-?(\d{4})$`, flags: "i" }, normal: ["A-", { group: 1 }], clean: { spaces: "remove" }, basis: "TEST" }] },
    object: { label: "spending object", forms: [
      { form: "OBJ##", pattern: { re: R`^OBJ(\d{2})$`, flags: "i" }, normal: ["OBJ", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    vendor: { label: "supplier number", forms: [
      { form: "S-#####", pattern: { re: R`^S-?0*(\d{1,5})$`, flags: "i" }, normal: ["S-", { group: 1, unpad: true }], clean: { spaces: "remove" }, basis: "TEST" }] },
    proceeding: { label: "court file number", forms: [
      { form: "MC-yy-####", pattern: { re: R`^MC-(\d{2})-(\d{4})$`, flags: "i" }, normal: ["MC-", { group: 1 }, "-", { group: 2 }],
        clean: { spaces: "remove", upper: true }, basis: "TEST" },
      { form: "UB/yyyy/##", pattern: { re: R`^UB\/(\d{4})\/(\d{2})$`, flags: "i" }, normal: ["UB/", { group: 1 }, "/", { group: 2 }],
        clean: { spaces: "remove", upper: true }, basis: "TEST" },
      { form: "docket-####", pattern: { re: R`^D(\d{6})$`, flags: "i" }, normal: ["D", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    person: { label: "registered person number", forms: [
      { form: "minute-person", pattern: { re: R`^P(\d{3})$`, flags: "i" }, normal: ["P", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" },
      { form: "bar-number", pattern: { re: R`^BAR(\d{5})$`, flags: "i" }, normal: ["BAR", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    /* T34 (R62): a body's and a seat's numbers in the minute book, and an institution's in the county registry */
    body: { label: "minute-book body number", forms: [
      { form: "minute-body", pattern: { re: R`^B-?(\d{2})$`, flags: "i" }, normal: ["B-", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    office: { label: "minute-book seat number", forms: [
      { form: "minute-seat", pattern: { re: R`^SEAT-?(\d{3})$`, flags: "i" }, normal: ["SEAT-", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    institution: { label: "county registry number", forms: [
      { form: "marlow-registry", pattern: { re: R`^MR(\d{4})$`, flags: "i" }, normal: ["MR", { group: 1 }], clean: { spaces: "remove", upper: true }, basis: "TEST" }] },
    parcel: {
      label: "lot and block number",
      forms: [
        { form: "marlow-lot", pattern: { re: R`^(?:LOT)?0*(\d{1,4})\/0*(\d{1,3})([a-z])?$`, flags: "i" },
          normal: [{ group: 1, unpad: true }, "/", { group: 2, unpad: true }, { group: 3, upper: true, default: "" }],
          clean: { strip: [{ re: R`parcel\s*`, flags: "i" }], spaces: "remove" }, basis: "TEST" },
      ],
    },
  },

  systems: [
    { origin: "ellery.minutes", name: "the Port Ellery clerk's minute book",
      hosts: ["minutes.port-ellery.example"],
      links: { item: { re: R`^\/entry\/\d+$` }, file: { re: R`^\/papers\/[a-z0-9-]+\.pdf$`, flags: "i" } }, basis: "TEST" },
    { origin: "ellery.minutes", name: "the Port Ellery clerk's minute book, through the shared records API",
      hosts: ["api.records-host.example"], path: { re: R`^\/ellery\/`, flags: "i" }, basis: "TEST" },
    { origin: "ellery.ledger", name: "the Port Ellery general ledger",
      hosts: ["ledger.port-ellery.example"], basis: "TEST" },
    { origin: "marlow.lands", name: "the Marlow County lands register, republished by the city's portal",
      hosts: ["open.port-ellery.example"], path: { re: R`lots` },
      republishes: true, provenance_stated: false, basis: "TEST" },
    { origin: "marlow.lands", name: "the Marlow County lands register",
      hosts: ["lands.marlow-county.example"], basis: "TEST" },
    /* the court-register origins court-doctypes reads (K1514), on made-up hosts */
    { origin: "courtlistener_docket", name: "the national docket mirror", hosts: ["dockets.registry.example"],
      path: { re: R`^\/case\/\d+$` }, basis: "TEST" },
    { origin: "cpuc_proceeding", name: "the Marlow utilities board's proceeding cards", hosts: ["board.marlow-county.example"],
      path: { re: R`^\/proceeding\/` }, basis: "TEST" },
    { origin: "ecourt_roa", name: "the Marlow County Court's register of actions", hosts: ["court.marlow-county.example"], basis: "TEST" },
  ],
  mixed_hosts: [
    { host: "www.port-ellery.example", why: "the city's general website, serving every department", basis: "TEST" },
  ],
  crosswalks: [
    { space: "project", forms: ["WO-####", "E#####"], pairs: [["WO-0001", "E10001"], ["WO-0002", "E10002"]],
      source: "0f".repeat(32), basis: "TEST" },
  ],

  vocabulary: {
    furniture: [
      { pattern: { re: R`^Port Ellery Town Hall$`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^Marlow County Clerk$`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^Open Minute$`, flags: "i" }, basis: "TEST" },
    ],
    bodies: [
      { pattern: { re: R`(Selectboard|Harbour Commission|Town Meeting)\s*$` }, basis: "TEST" },
    ],
    member_titles: [
      { pattern: { re: R`^Selectman`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^Selectwoman`, flags: "i" }, basis: "TEST" },
    ],
    enactment_markers: [
      { pattern: { re: R`P\.?E\.?`, flags: "i" }, basis: "TEST" },
    ],
    codes: [
      { key: "pebl", label: "P.E. Bylaws", pattern: { re: R`Port\s+Ellery\s+Bylaws|P\.?E\.?B\.?L\.?`, flags: "i" },
        copy: "official", sections: { number: { re: R`\d+-\d+` }, separators: "-", markers: ["paren_numeral", "paren_letter", "roman"] }, basis: "TEST" },
    ],
    file_numbers: [
      { pattern: { re: R`M\d{3}\/\d{2}` }, system: "ellery.minutes", basis: "TEST" },
    ],
    report_titles: [
      { pattern: { re: R`^OFFICER'?S\s+MEMORANDUM\b`, flags: "i" }, basis: "TEST" },
    ],
    report_sections: [
      { pattern: { re: R`^PROPOSAL\b`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^COSTS\b`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^CONSULTATION\b`, flags: "i" }, basis: "TEST" },
    ],
    recommendation_openers: [
      { pattern: { re: R`\bThe\s+Officer\s+Proposes\b`, flags: "i" }, basis: "TEST" },
    ],
    template_blanks: [
      { pattern: { re: R`\[INSERT\s+[A-Z ]+\]`, flags: "i" }, basis: "TEST" },
    ],
    amending: [
      { pattern: { re: R`\bis\s+hereby\s+varied\b`, flags: "i" }, relation: "amends", basis: "TEST" },
      { pattern: { re: R`\bis\s+hereby\s+inserted\b`, flags: "i" }, relation: "adds", basis: "TEST" },
      { pattern: { re: R`\bis\s+hereby\s+revoked\b`, flags: "i" }, relation: "repeals", basis: "TEST" },
      { pattern: { re: R`\bshall\s+be\s+renumbered\b`, flags: "i" }, relation: "renumbers", basis: "TEST" },
      { pattern: { re: R`\bis\s+consolidated\s+into\b`, flags: "i" }, relation: "recodifies", basis: "TEST" },
    ],
    meeting_markers: [
      { marker: "cancelled", pattern: { re: R`\(POSTPONED\)\s*$`, flags: "i" }, basis: "TEST" },
      { marker: "special", pattern: { re: R`\bExtraordinary\b`, flags: "i" }, basis: "TEST" },
      { marker: "concurrent", pattern: { re: R`\bJoint\s+Sitting\b`, flags: "i" }, basis: "TEST" },
    ],
    body_variants: [
      { pattern: { re: R`^(?:The\s+)?Selectboard(?:\s+of\s+Port\s+Ellery)?\b`, flags: "i" }, organisation: "selectboard", basis: "TEST" },
      { pattern: { re: R`Harbour\s+(?:Commission|Commissioners)`, flags: "i" }, organisation: "harbour_commission", basis: "TEST" },
    ],
    roster_words: [
      { pattern: { re: R`\bList\s+of\s+Officers\b`, flags: "i" }, kind: "roster", basis: "TEST" },
      { pattern: { re: R`\bWho'?s\s+Who\s+at\s+Town\s+Hall\b`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`\bTable\s+of\s+Offices\b`, flags: "i" }, kind: "chart", basis: "TEST" },
    ],
    roster_headers: [
      { role: "name", pattern: { re: R`^Officer$`, flags: "i" }, basis: "TEST" },
      { role: "title", pattern: { re: R`^Post$`, flags: "i" }, basis: "TEST" },
      { role: "unit", pattern: { re: R`^Office$`, flags: "i" }, basis: "TEST" },
      { role: "start", pattern: { re: R`^Sworn$`, flags: "i" }, basis: "TEST" },
      { role: "end", pattern: { re: R`^Retires$`, flags: "i" }, basis: "TEST" },
      { role: "as_of", pattern: { re: R`^Correct\s+at$`, flags: "i" }, basis: "TEST" },
      { role: "employee_id", pattern: { re: R`^Payroll\s+No\.?$`, flags: "i" }, basis: "TEST" },
      { role: "contact", pattern: { re: R`^Extension$`, flags: "i" }, basis: "TEST" },
    ],
    financial_report_titles: [
      { pattern: { re: R`\bStatement\s+of\s+Accounts\b`, flags: "i" }, basis: "TEST" },
    ],
    budget_book_titles: [
      { pattern: { re: R`\bEstimates\s+Book\b`, flags: "i" }, basis: "TEST" },
    ],
    financial_headings: [
      { pattern: { re: R`^Harbour\s+Revenue\s+Account$`, flags: "i" }, basis: "TEST" },
      { pattern: { re: R`^Schedule\s+of\s+Reserves$`, flags: "i" }, basis: "TEST" },
    ],
    fiscal_year_forms: [
      { pattern: { re: R`\bYear\s+(\d{4})\/(\d{2})\b`, flags: "i" }, basis: "TEST" },
    ],
    budget_headers: [
      { column: "fund", pattern: { re: R`^Ledger$`, flags: "i" }, basis: "TEST" },
      { column: "org", pattern: { re: R`^Cost\s+Centre$`, flags: "i" }, basis: "TEST" },
      { column: "department", pattern: { re: R`^Service$`, flags: "i" }, basis: "TEST" },
      { column: "department_code", pattern: { re: R`^Service\s+Code$`, flags: "i" }, basis: "TEST" },
      { column: "program", pattern: { re: R`^Activity$`, flags: "i" }, basis: "TEST" },
      { column: "project", pattern: { re: R`^Works\s+Order$`, flags: "i" }, basis: "TEST" },
      { column: "account", pattern: { re: R`^Nominal$`, flags: "i" }, basis: "TEST" },
      { column: "amount", pattern: { re: R`^Sum$`, flags: "i" }, basis: "TEST" },
      { column: "period", pattern: { re: R`^Year$`, flags: "i" }, basis: "TEST" },
      { column: "phase", pattern: { re: R`^Stage$`, flags: "i" }, basis: "TEST" },
    ],
    staff_titles: [
      { pattern: { re: R`\b(?:Town\s+Reeve|Harbour\s+Master|Deputy\s+Clerk)\b`, flags: "i" }, basis: "TEST" },
    ],
    /* T35 (R69) */
    policy_headers: [
      { field: "type", pattern: { re: R`^HARBOUR\s+STANDING\s+ORDER$` }, basis: "TEST" },
      { field: "number", pattern: { re: R`^Order\s+No\.` }, basis: "TEST" },
      { field: "title", pattern: { re: R`^Concerning:` }, basis: "TEST" },
      { field: "effective", pattern: { re: R`^In\s+force\s+from:` }, basis: "TEST" },
      { field: "supersedes", pattern: { re: R`^Replaces:` }, basis: "TEST" },
      { field: "reference", pattern: { re: R`^Authority:` }, basis: "TEST" },
      { field: "coordinator", pattern: { re: R`^Owner:` }, basis: "TEST" },
      { field: "review_due", pattern: { re: R`^Review\s+by:` }, basis: "TEST" },
      { field: "revision_cycle", pattern: { re: R`^Reviewed\s+every:` }, basis: "TEST" },
    ],
    /* T34 (R58, R60, R62) */
    vote_values: [
      { value: "content", label: "Content", citation: "P.E.B.L. § 5(1)", basis: "TEST" },
      { value: "not_content", label: "Not content", citation: "P.E.B.L. § 5(1)", basis: "TEST" },
      { value: "abstains", label: "Abstains", citation: "P.E.B.L. § 5(2)", basis: "TEST" },
    ],
    response_statuses: [
      { status: "implemented", label: "Implemented", citation: "Test Stat. § 3.40", basis: "TEST" },
      { status: "in_hand", label: "In hand", citation: "Test Stat. § 3.40", basis: "TEST" },
      { status: "declined", label: "Will not be implemented", citation: "Test Stat. § 3.41", basis: "TEST" },
      /* R77: the statuses the Selectboard reports a bylaw complaint in */
      { status: "upheld", label: "Complaint upheld", citation: "P.E.B.L. § 9(4)", applies_to: "bylaw_complaint", basis: "TEST" },
      { status: "not_upheld", label: "Complaint not upheld", citation: "P.E.B.L. § 9(4)", applies_to: "bylaw_complaint", basis: "TEST" },
    ],
    member_types: [
      { member_type: "Selectperson", capacity: "elected", basis: "TEST" },
      { member_type: "Co-opted Member", capacity: "appointed", basis: "TEST" },
      /* for one body only, read before the entry for all bodies (K1729) */
      { member_type: "Co-opted Member", organisation: "harbour_commission", capacity: "elected", basis: "TEST" },
    ],
  },

  practice: { minutes_due_days: { value: 30, count: "calendar", closures: "town", basis: "TEST" } },
  locale: { value: "en-GB", basis: "TEST" },
  time_zone: { value: "America/Halifax", status: "researched", basis: "TEST" },
  search_terms: [{ term: "harbour", basis: "TEST" }],
  records_laws: [
    /* R84: its stages omit the fee waiver this law has none of */
    { level: "state", name: "Freedom of Records Act (test)", citation: "Test Stat. § 1.100",
      stages: [
        { stage: "request", label: "application for records", citation: "Test Stat. § 1.101" },
        { stage: "denial", label: "notice of refusal", citation: "Test Stat. § 1.120" },
        { stage: "appeal", label: "application for internal review", citation: "Test Stat. § 1.130" },
        { stage: "appeal_decision", label: "decision on internal review", citation: "Test Stat. § 1.131" }],
      requesters: { text: "any resident of the state, or a body corporate registered in it", citation: "Test Stat. § 1.102", status: "researched", basis: "TEST" },
      response: "records_answer", basis: "TEST" },
    { level: "city", name: "Port Ellery Open Government Bylaw", citation: "P.E.B.L. § 4", basis: "TEST" },
    { level: "federal", name: "National Records Access Act (test)", citation: "Test U.S.C. § 552", basis: "TEST" },
  ],

  standard_sources: [
    { source: "Port Ellery Bylaws", kind: "ordinance", issuer: "Port Ellery Selectboard",
      level: "city", cite: { re: R`\bP\.?E\.?B\.?L\.?\s*§\s*\d+`, flags: "i" }, code: "pebl", key: "selectboard", basis: "TEST" },
    { source: "Marlow County Budget Commitments", kind: "commitment", issuer: "Marlow County Commission", level: "county",
      cite: { re: R`\bMCBC\s+\d{4}-\d+` }, basis: "TEST" },
    /* T35 (R63, R64, R68): a government's series at a level, whose normal form drops the number's padding */
    { source: "Port Ellery Harbour Standing Orders", kind: "policy", issuer: "Harbour Master", level: "city",
      key: "harbour-master", series: { key: "hso", label: "Harbour Standing Order" },
      cite: { re: R`\bHSO\s+(?<number>(\d{1,2})\/(\d{2}))(?:\s+para\.?\s*(?<portion>\d+))?`, flags: "i" },
      normal: ["HSO-", { group: 2, unpad: true }, "/", { group: 3 }], basis: "TEST" },
    /* a government at no law level: its sector says what issuer it is (R31) */
    { source: "Marlow Schools Board Rules", kind: "policy", issuer: "Marlow Schools Board", sector: "government",
      key: "marlow-schools", series: { key: "rule", label: "Board Rule" },
      cite: { re: R`\bBoard\s+Rule\s+(?<number>[A-Z]\d{2})\b` }, basis: "TEST" },
    /* a company's own policy */
    { source: "Ellery Ferries Code of Conduct", kind: "policy", issuer: "Ellery Ferries Ltd", sector: "company",
      key: "ellery-ferries", series: { key: "coc", label: "Code of Conduct rule" },
      cite: { re: R`\bEF\s+Rule\s+(?<number>\d+(?:\.\d+)?)` }, basis: "TEST" },
    /* a standards body's standard, its designation reading an edition */
    { source: "Marlow Harbour Safety Standards", kind: "standard", issuer: "Marlow Harbour Safety Institute", sector: "association",
      key: "mhsi", series: { key: "mhs", label: "MHSI Standard" },
      cite: { re: R`\bMHS\s+(?<number>\d{3})(?:(?:-|,\s*)(?<edition>\d{4})(?:\s+edition)?)?` }, basis: "TEST" },
  ],
  counterparties: [
    { role: "Town Clerk", body: "City of Port Ellery", level: "city", elected: false,
      hours: { weekly: [...["mon", "tue", "wed", "thu"].map((day) => ({ day, open: "09:00", close: "12:30" })),
        ...["mon", "tue", "wed", "thu"].map((day) => ({ day, open: "13:30", close: "16:00" })),
        { day: "fri", open: "09:00", close: "12:00" }], status: "researched", basis: "TEST" },
      basis: "TEST" },
    { role: "Selectboard", body: "Port Ellery Selectboard", level: "city", elected: true,
      ids: { office: { scheme: "ellery_seat", id: "SEAT-001" }, body: { scheme: "ellery_body", id: "B-01" } },
      within: { label: "City of Port Ellery", kind: "institution", ids: [{ scheme: "port_ellery_registry", id: "MR0001" }] },
      organisation: "selectboard", basis: "TEST" },
    { role: "Harbour District Board", body: "Port Ellery Harbour District", level: "district", elected: true, oversight: false, basis: "TEST" },
    /* R74: an office keeping its own zone, unlike the profile's */
    { role: "Examiner of Accounts", body: "Marlow County Audit Office", level: "county", elected: false, oversight: true,
      time_zone: { value: "America/St_Johns", status: "ruled", basis: "TEST" }, basis: "TEST" },
  ],
  action_kinds: [
    { kind: "records_request", label: "request under the records act", tier: 2,
      laws: ["Freedom of Records Act (test)", "Port Ellery Open Government Bylaw"],
      venue: { name: "the Town Clerk's office", how: "email", basis: "TEST",
        cutoff: { time: "16:30", citation: "Test Stat. § 1.105", status: "ruled", basis: "TEST" },
        outages: [{ from: "2026-03-02T09:00:00-04:00", to: "2026-03-02T13:30:00-04:00", status: "researched", basis: "TEST" }],
        receipt: { rule: "next_business_day", citation: "P.E.B.L. § 4(2)", status: "researched", basis: "TEST" },
        hours: { weekly: ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, open: "08:00", close: "18:00" })),
          status: "ruled", basis: "TEST" } },
      template: attributed("TPL-test-records-request", "file", "To the {{counterparty_role}}: under {{law}}, {{group}} asks for the records described below.",
        { reviewer: "Dee Example", kind: "professional", organisation: "Marlow Commons Legal Society (test)",
          credential: "solicitor (test)", scope: "the whole text", outcome: "no_concerns", at: "2026-08-20" }),
      advisory: "A test advisory: have a solicitor read the request before it is sent.", basis: "TEST" },
    { kind: "bylaw_complaint", label: "complaint under the bylaws", tier: 1, laws: ["Port Ellery Bylaws"],
      venue: { name: "the Selectboard", how: "in_person", basis: "TEST",
        /* R82, R87 (e) */
        facts: [
          { fact: "speaker_limit", value: "three minutes for each speaker, once on each item", citation: "P.E.B.L. § 7(4)", status: "researched", basis: "TEST" },
          { fact: "comment_cutoff", value: "written comment is taken until one hour before the sitting", amount: { amount: 1, units: "hours" },
            citation: "P.E.B.L. § 7(5)", status: "researched", basis: "TEST" },
          { fact: "delivery_point", value: "the front counter of Port Ellery Town Hall", citation: "P.E.B.L. § 7(1)", status: "ruled", basis: "TEST" }] },
      template: attributed("TPL-test-bylaw-complaint", "file", "To the {{counterparty_role}}: {{act}} does not conform to {{standards}}.",
        { reviewer: "Dee Example", kind: "member", scope: "the whole text", outcome: "no_concerns", at: "2026-08-21" }),
      basis: "TEST" },
    { kind: "commitment_claim", label: "claim on a budget commitment", tier: 3,
      venue: { name: "Marlow County Court", how: "court", basis: "TEST",
        time_zone: { value: "America/Glace_Bay", status: "researched", basis: "TEST" } },
      evidence: { standard: "Marlow County Court Rule 9.02 (test): a record authenticated by its custodian",
        accepts: [{ grade: "A", coattested: true }, { grade: "B" }], contestable: [{ grade: "C" }], basis: "TEST" },
      /* A Tier 3 kind takes a briefing to counsel, never a `file` template (K921). */
      template: attributed("TPL-test-commitment-brief", "brief", "For counsel: {{group}} asks whether {{act}} ({{act_date}}) breaches {{standards}}, on {{findings}}.",
        { reviewer: "Dee Example", kind: "professional", organisation: "Marlow Commons Legal Society (test)",
          credential: "solicitor (test)", scope: "the whole text", outcome: "concerns", at: "2026-08-22" }),
      basis: "TEST" },
    /* R81, R87: a kind of recognition's shape (R87 (a)) holding its Tier 1 set, each template with its purpose, name and
       sources (R87 (b)) */
    { kind: "recognition_letter", label: "letter of recognition", tier: 1, shape: "recognition",
      venue: { name: "the Harbour District office", how: "mail", basis: "TEST" },
      templates: [
        { ...attributed("TPL-test-recognition", "file", "To the {{counterparty_role}}: {{group}} recognises {{act}}.",
            { reviewer: "Dee Example", kind: "member", scope: "the whole text", outcome: "no_concerns", at: "2026-08-23" }),
          purpose: "initial", name: "Letter of recognition", sources: [{ citation: "P.E.B.L. § 11" }] },
        { ...attributed("TPL-test-recognition-follow-up", "file", "To the {{counterparty_role}}: {{group}} thanks you again for {{act}}.",
            { reviewer: "Dee Example", kind: "member", scope: "the whole text", outcome: "no_concerns", at: "2026-08-24" }),
          purpose: "follow_up", name: "Follow-up letter of recognition", sources: [{ citation: "P.E.B.L. § 11(3)" }, { citation: "Test Stat. § 2.7" }] }],
      basis: "TEST" },
  ],
  deadlines: [
    /* the pre-T33 form, `days: n`, read as units: days, amount: n */
    { rule: "records_answer", label: "answer to a records application", applies_to: "records_request", days: 5, count: "business", starts: "received", closures: "town",
      extension: { days: 5, count: "business", when: "the records are held off site", citation: "Test Stat. § 1.141" },
      observed: { closures: "court", status: "researched", basis: "TEST" },
      citation: "Test Stat. § 1.140", status: "researched", basis: "TEST" },
    { rule: "claim_notice", applies_to: "claim", units: "days", amount: 90, count: "calendar", direction: "forward", starts: "known",
      roll: true, closures: "court", computation: "clear_days",
      tolling: [{ when: "the claimant is a minor", citation: "Test Stat. § 9.22" }],
      citation: "Test Stat. § 9.20", status: "ruled", basis: "TEST" },
    { rule: "notice_of_sitting", applies_to: "bylaw_complaint", units: "hours", amount: 36, direction: "backward", starts: "act",
      citation: "P.E.B.L. § 7", status: "researched", basis: "TEST" },
    { rule: "harbour_notice", applies_to: "bylaw_complaint", units: "business_hours", amount: 16, direction: "backward", starts: "hearing",
      closures: "town", citation: "P.E.B.L. § 8", status: "researched", basis: "TEST" },
    { rule: "appeal_window", applies_to: "commitment_claim", units: "months", amount: 2, direction: "forward", starts: "entered",
      roll: true, closures: "court", citation: "Marlow Ct. R. 30.1", status: "researched", basis: "TEST" },
    /* K1514: a rule for one weekday's anchor, due at a stated time (the Monday safe harbour's shape) */
    { rule: "notice_of_sitting_friday", applies_to: "bylaw_complaint", units: "days", amount: 2, count: "calendar", direction: "backward",
      starts: "act", applies_on: ["fri", "sat"], due_at: "15:00", citation: "P.E.B.L. § 7(2)", status: "researched", basis: "TEST" },
    { rule: "registry_answer", applies_to: "commitment_claim", units: "days", amount: 4, count: "business", starts: "filed",
      closures: "court", due_at: "close_of_business", citation: "Marlow Ct. R. 12", status: "ruled", basis: "TEST" },
    { rule: "service_lapse", applies_to: "commitment_claim", units: "years", amount: 2, direction: "forward", starts: "served",
      citation: "Marlow Ct. R. 30.9", status: "researched", basis: "TEST" },
    { rule: "filing_reply", applies_to: "commitment_claim", units: "days", amount: 7, count: "calendar", direction: "backward", starts: "filed",
      roll: true, closures: "court", computation: "clear_days", citation: "Marlow Ct. R. 31.2", status: "researched", basis: "TEST" },
    /* R75, R87 (c) (T45): owed by the group with the law's consequence; started by a third party's act; the group's defence */
    { rule: "complaint_particulars", applies_to: "claim", units: "days", amount: 14, count: "calendar", direction: "forward",
      starts: "filed", owed_by: "group", consequence: { text: "the claim shall be considered withdrawn", citation: "P.E.B.L. § 9(3)" },
      citation: "P.E.B.L. § 9(2)", status: "researched", basis: "TEST" },
    { rule: "examiner_reply", applies_to: "claim", units: "days", amount: 28, count: "calendar", direction: "forward",
      starts: "third_party", starter: { role: "Examiner of Accounts", body: "Marlow County Audit Office" }, owed_by: "body",
      citation: "Test Stat. § 6.12", status: "ruled", basis: "TEST" },
    { rule: "defence_filing", applies_to: "claim", units: "days", amount: 21, count: "calendar", direction: "forward", starts: "served",
      owed_by: "group", defends: true, citation: "Marlow Ct. R. 15.1", status: "researched", basis: "TEST" },
  ],
  weekend: { days: ["sun"], citation: "Test Stat. § 0.12", status: "researched", basis: "TEST" },
  computation: [
    { key: "clear_days", rule: "exclude_first_include_last", citation: "Test Stat. § 0.10", status: "ruled", basis: "TEST" },
  ],
  fiscal_year: [
    { body: "*", start: "04-01", named_by: "start", label: "FY{start}-{end2}", status: "researched", basis: "TEST" },
    { body: "Port Ellery Harbour District", start: "10-01", named_by: "end", label: "HD{end}", status: "ruled", basis: "TEST" },
  ],
  law_ranks: [
    { kind: "statute", level: "state", rank: 1, basis: "TEST" },
    { kind: "ordinance", level: "city", rank: 2, basis: "TEST" },
    { kind: "commitment", level: "county", rank: 3, basis: "TEST" },
  ],
  instrument_key: { jurisdiction: "xx-port-ellery", basis: "TEST" },
  proceeding_kinds: [
    { kind: "commitment_suit", label: "suit on a budget commitment", forum_kind: "court", basis: "TEST" },
    { kind: "harbour_inquiry", label: "harbour commission inquiry", forum_kind: "commission", basis: "TEST" },
  ],
  proceeding_flows: [
    { kind: "commitment_suit", stages: [
      { stage: "filed", label: "filed", reached_by: ["filing"] },
      { stage: "heard", label: "heard", reached_by: ["hearing"] },
      { stage: "decided", label: "decided", reached_by: ["judgment", "dismissal"] }],
      citation: "Marlow Ct. R. 2", basis: "TEST" },
  ],
  identifier_schemes: [
    { scheme: "ellery_person", label: "minute-book person number", entity_kinds: ["person"], space: "person", form: "minute-person",
      systems: ["ellery.minutes"], basis: "TEST" },
    { scheme: "marlow_bar", label: "Marlow bar number", entity_kinds: ["person"], space: "person", form: "bar-number", basis: "TEST" },
    { scheme: "ellery_body", label: "minute-book body number", entity_kinds: ["body"], space: "body", form: "minute-body",
      systems: ["ellery.minutes"], basis: "TEST" },
    { scheme: "ellery_seat", label: "minute-book seat number", entity_kinds: ["office"], space: "office", form: "minute-seat",
      systems: ["ellery.minutes"], basis: "TEST" },
    /* N574: an issuer of credentials, held through entities R43 */
    /* R94: a forum's identifier */
    { scheme: "marlow_court_no", label: "Marlow County court number", entity_kinds: ["forum"], space: "institution",
      form: "marlow-registry", basis: "TEST" },
    { scheme: "port_ellery_registry", label: "Marlow County registry of institutions", entity_kinds: ["institution"], space: "institution",
      form: "marlow-registry", basis: "TEST" },
  ],
  classification_schemes: [
    { scheme: "ellery_funds", label: "ledger funds", kind: "fund", codes: [{ code: "100-01", label: "General" }, { code: "200-01", label: "Harbour" }], basis: "TEST" },
    { scheme: "ellery_objects", label: "spending objects", kind: "object", basis: "TEST" },
    { scheme: "ellery_works", label: "works orders", kind: "project", forms: [{ re: R`^WO-?\d{4}$`, flags: "i" }], basis: "TEST" },
  ],
  lawful_demands: [
    { kind: "officer_privacy", label: "an officer's demand to remove their home details", covers: ["home_address", "other"],
      within: { amount: 5, units: "days" }, citation: "Test Stat. § 12.4", status: "researched", basis: "TEST" },
  ],
  recurrences: [
    { body: "Port Ellery Selectboard", rrule: "FREQ=MONTHLY;BYDAY=2TU", dtstart: "2026-01-13T19:00", citation: "P.E.B.L. § 6",
      status: "researched", basis: "TEST" },
    { body: "Port Ellery Harbour District", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20261231", dtstart: "2026-01-08T10:00",
      citation: "P.E.B.L. § 6A", status: "ruled", basis: "TEST" },
  ],
  legal_organisations: [
    { name: "Marlow Commons Legal Society (test)", evaluates: ["commitment_claim"],
      contacts: [{ how: "web", value: "https://legal.marlow-county.example" }, { how: "phone", value: "+1 555 0100" }],
      basis: "TEST" },
    /* R78: an organisation that defends a group (and evaluates a Tier 3 kind; one evaluating none is R78's test's) */
    { name: "Ellery Free Speech Clinic (test)", evaluates: ["commitment_claim"], defends: true,
      contacts: [{ how: "email", value: "clinic@free-speech.port-ellery.example" }], basis: "TEST" },
  ],
  /* R79: one legal fact per trigger */
  legal_facts: [
    { key: "paid_speaker_register", trigger: "paid_attendee", statement: "A person paid to address the Selectboard registers with the Town Clerk first.",
      citation: "P.E.B.L. § 14", threshold: { amount: 250, unit: "GBP in a year" }, status: "researched", basis: "TEST" },
    { key: "sitting_recordings", trigger: "recording", statement: "Anyone may film a public sitting from the gallery.",
      citation: "P.E.B.L. § 7(6)", applies_to: ["bylaw_complaint"], status: "researched", basis: "TEST" },
    { key: "solicitor_letter", trigger: "threat_letter", statement: "A letter threatening suit over a complaint to the Selectboard does not stop the complaint.",
      citation: "Test Stat. § 8.3", status: "ruled", basis: "TEST" },
    { key: "referendum_notice", trigger: "pending_measure_or_candidate", statement: "Spending on a pending referendum is declared to the Returning Officer.",
      citation: "Test Stat. § 10.2", threshold: { amount: 500, unit: "GBP" }, status: "researched", basis: "TEST" },
    { key: "board_quorum_messages", trigger: "serial_meeting", statement: "Board members may not settle business by a chain of messages outside a sitting.",
      citation: "P.E.B.L. § 6(4)", status: "researched", basis: "TEST" },
  ],
  /* R80, R87 (d): a sourced guide, in the profile's order, a route offered after an outcome */
  procedure_guides: [
    { kind: "bylaw_complaint", items: [
      { route: "Ask the Town Clerk to place the complaint before the Selectboard", expect: "an acknowledgement within five days", citation: "P.E.B.L. § 9(1)" },
      { route: "Ask the Examiner of Accounts to review the Selectboard's answer", citation: "Test Stat. § 6.10", after: ["denied", "none_stated"] }],
      status: "researched", basis: "TEST" },
  ],
  /* R86: phrasings added to Civicsmith's own lists */
  phrasings: [
    { locale: "en-GB", kind: "assertion", phrase: "is in clear breach of", basis: "TEST" },
    { locale: "en-GB", kind: "position", phrase: "the town ought to", basis: "TEST" },
    { locale: "en-GB", kind: "own_benefit_ask", phrase: "a grant for our society", basis: "TEST" },
  ],
  /* The entries for one office and one venue come first: each adds its days to the year every office keeps (R43). */
  holidays: [
    { year: 2026, offices: ["Town Clerk"], days: [{ date: "2026-08-14", name: "Clerk's records day" }],
      status: "ruled", basis: "TEST" },
    { year: 2026, offices: [{ venue: "commitment_claim" }], days: [
      { date: "2026-08-31", name: "Court vacation day" }, { date: "2026-12-24", name: "Court closed" }],
      status: "researched", basis: "TEST" },
    { year: 2026, days: [
      { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-03-17", name: "Harbour Day" },
      { date: "2026-07-03", name: "Founders' Day (observed)" }, { date: "2026-12-25", name: "Christmas Day" }],
      status: "researched", basis: "TEST" },
    { year: 2027, days: [
      { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-03-17", name: "Harbour Day" },
      { date: "2027-12-24", name: "Christmas Day (observed)" }],
      status: "researched", basis: "TEST" },
    /* Two closure lists (R47): the court's, which a rule counts on, and the town's, observed beside it. */
    { year: 2026, list: "court", citation: "Marlow Ct. R. 1.4", days: [
      { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-08-31", name: "Court vacation day" },
      { date: "2026-12-24", name: "Court closed" }, { date: "2026-12-25", name: "Christmas Day" }],
      status: "ruled", basis: "TEST" },
    { year: 2026, list: "town", citation: "P.E.B.L. § 3", days: [
      { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-03-17", name: "Harbour Day" },
      { date: "2026-12-25", name: "Christmas Day" }],
      status: "researched", basis: "TEST" },
  ],
  /* R91: the places outside Civicsmith a member is sent to, every kind, two legal-aid societies, and every `how`. */
  pointers: [
    { kind: "legalaid", name: "Marlow Commons Legal Society (test)", does: "Free advice and representation on housing, benefits and debt for people on a low income in Marlow County.",
      contacts: [{ how: "web", value: "https://legal.marlow-county.example/help" }, { how: "phone", value: "+1 555 0100" }],
      hours: { weekly: ["mon", "wed", "fri"].map((day) => ({ day, open: "10:00", close: "15:00" })), status: "researched", basis: "TEST" },
      languages: ["en-GB", "pl", "cy"], source: "https://legal.marlow-county.example/about", status: "researched", basis: "TEST" },
    { kind: "legalaid", name: "Harbourside Tenants' Advice Centre (test)", does: "Advice for tenants of Port Ellery facing eviction or disrepair.",
      contacts: [{ how: "email", value: "advice@tenants.port-ellery.example" }], source: "https://tenants.port-ellery.example/", status: "researched", basis: "TEST" },
    { kind: "selfhelp", name: "Marlow County Court Help Desk (test)", does: "Helps people without a solicitor fill in the court's own forms.",
      contacts: [{ how: "address", value: "1 Assize Row, Marlow" }], source: "https://court.marlow-county.example/help-desk", status: "researched", basis: "TEST" },
    { kind: "service", name: "Port Ellery Town Services Line (test)", does: "Takes reports of potholes, broken lamps and missed bin collections in Port Ellery.",
      contacts: [{ how: "phone", value: "+1 555 0311" }, { how: "web", value: "https://www.port-ellery.example/report" }],
      source: "https://www.port-ellery.example/report", status: "researched", basis: "TEST" },
    { kind: "agency", name: "Marlow County Ombudsman (test)", does: "Investigates one person's complaint about a county service.",
      contacts: [{ how: "mail", value: "Ombudsman, County Hall, Marlow" }], source: "Test Stat. § 14.2", status: "researched", basis: "TEST" },
    { kind: "representative", name: "Harbour Ward Selectperson's office (test)", does: "The Selectboard member elected for the Harbour Ward, who takes up a resident's problem with the town.",
      contacts: [{ how: "email", value: "harbour.ward@port-ellery.example" }], source: "https://minutes.port-ellery.example/selectboard", status: "researched", basis: "TEST" },
    { kind: "tipline", name: "The Ellery Gazette newsdesk (test)", does: "A local newspaper that takes tips from readers about the town.",
      contacts: [{ how: "web", value: "https://gazette.port-ellery.example/tips" }], source: "https://gazette.port-ellery.example/tips", status: "researched", basis: "TEST" },
  ],
  /* R73: official names, never translated as ordinary words (DEC-157 (6)). */
  /* R93 (T50): every value differs from the first profile's block */
  records_help: {
    law: "Freedom of Records Act (test)", days: 7, extra_days: 21,
    extension_reasons: [
      { reason: "the records are kept at the harbour depot", citation: "Test Stat. § 1.104(a)" },
      { reason: "the request covers a great many separate records", citation: "Test Stat. § 1.104(b)" }],
    portal: { name: "Port Ellery Records Window", url: "https://records.port-ellery.example/requests" },
    faster: { ordinance: "Open Government Bylaw", window: "2 working days", request: "quick look", citation: "P.E.B.L. § 4.5" },
    citations: { answer: "Test Stat. § 1.103", extend: "Test Stat. § 1.104", assist: "Test Stat. § 1.105", segregate: "Test Stat. § 1.106",
      refuse_in_writing: "Test Stat. § 1.107", electronic: "Test Stat. § 1.108", cost: "Test Stat. § 1.109", cost_electronic: "Test Stat. § 1.110",
      inspect_photograph: "Test Stat. § 1.111", purpose: "Test Stat. § 1.112" },
    status: "researched", basis: "TEST" },
  /* R94 (T50): the courts and forums of the place, with the kinds of proceeding (above) they hold */
  forums: [
    { label: "Marlow County Bench (test)", forum_kind: "court", ids: [{ scheme: "marlow_court_no", id: "MC-1" }], basis: "TEST" },
    { label: "Port Ellery Harbour Commission (test)", forum_kind: "commission", basis: "TEST" },
  ],
  local_names: [
    { name: "Town Clerk", kind: "office", explanations: [
      { locale: "en", text: "The town office that keeps the Selectboard's records and receives records requests.", basis: "TEST" },
      { locale: "es", text: "La oficina municipal que guarda los registros de la Junta y recibe las solicitudes de registros.", basis: "TEST" }],
      translations: [{ locale: "es", text: "Secretaría Municipal", source: "https://www.port-ellery.example/es/secretaria", basis: "TEST" }],
      basis: "TEST" },
    { name: "Port Ellery Bylaws", kind: "law", explanations: [
      { locale: "en", text: "The town's own local laws, numbered by section.", basis: "TEST" }], basis: "TEST" },
    { name: "Harbour Renters' Fund", kind: "program", basis: "TEST" },
    { name: "Marlow County", kind: "place", basis: "TEST" },
  ],
};
