/* The measurement the first profile's policy series rest on (R67, R69; basis `2026-10-07 policies`): JURISDICTIONS #8 read
 * each family's primary pages on 2026-10-07 and copied here, as printed, the citations of one item of the family and the
 * header labels its documents print. Each family names the pages read. The profile's `cite` and `policy_headers` patterns
 * are tested against these strings (t35.test.mjs); nothing here is product data.
 *
 * Pages: OPD's public PowerDMS site lists 289 documents (`/OAKLAND/documents`, the directory's own API, read whole), in
 * the folders "Department General Orders (DGO)" (173), "Special Orders (SO)" (8, and 2 under "Use of Force"), "Training
 * Bulletins (TB)" (63) and "City Administrative Instructions" (4); one document of each family was read whole as served.
 * OUSD's board-policy portal lists its Board Policies (BP), Administrative Regulations (AR) and Exhibits, numbered as
 * `0420.0` or `5124`; two posts and one published PDF were read whole. The City Auditor's 9-1-1 audit (2025-10-08) names
 * NENA's standards without a designation.
 *
 * K1930 (BOB's CHANGE B4): doctypes captured 50 of the same families' documents from the same PowerDMS addresses the same
 * day (`doctypes/test/fixtures/policies.json`, its R35). Read whole here, they print header labels the first reading did
 * not hold (Ref, Rev., New Order, DATE, Effective Date without its colon, Evaluation Date, SUBJECT/AGENCY), a Special
 * Order's own number as "SPECIAL ORDER NO. 8011", an AI cited as "Administrative Instruction No. 501", and, on 12 General
 * Orders, the CALEA standards each cites ("Ref: CALEA Standards 15.1.1"). Those lines are added below, each with the
 * document that prints it. */

const PDMS = "https://public.powerdms.com/OAKLAND/documents";

export const READ = "2026-10-07";

/** A family's measurement: the pages read; each citation line with its number as written and, where it differs, its normal
 *  form; each line citing a portion, with its number and portion; each header line with the field it prints, and `false`
 *  where the line must not be read as that field; and the lines that cite no item of the family.
 *  @typedef {Object} Family
 *  @property {string[]} pages
 *  @property {[string, string, string?][]} citations
 *  @property {[string, string, string][]} [portions]
 *  @property {[string, string, boolean?][]} headers
 *  @property {string[]} [not]
 */

/** The families measured, by series key.
 *  @type {{ [key: string]: Family }} */
export const FAMILIES = {
  ai: {
    pages: [PDMS, `${PDMS}/579540`, `${PDMS}/2108538`, `${PDMS}/97`,
      "https://www.oaklandca.gov/files/assets/city/v/1/city-administrator/documents/ada/ada-policies/ai-123.pdf"],
    /* AI 123's REFERENCE and SUPERSEDE blocks, its text and footer; AI 71's SUPERSEDE block; the directory's names */
    citations: [["AI 123", "123"], ["A.I. 181", "181"], ["A.I. 4502", "4502"], ["AI 70", "70"], ["AI 138", "138"],
      ["Administrative Instruction 139", "139"], ["Administrative Instruction 596", "596"],
      ["City Administrative Instruction 71", "71"], ["City Administrative Instruction No.\n501, “Procedu", "501"], ["AI 544 - Managing Violence in the Workplace", "544"], ["AI 580 - Race and Equity", "580"]],
    headers: [["type", "          ADMINISTRATIVE INSTRUCTION"],
      ["title", "SUBJECT            Disability Access Policy                      NUMBER         123"],
      ["number", "SUBJECT            Disability Access Policy                      NUMBER         123"],
      ["reference", "REFERENCE          Section 504 of the Rehabilitation Act of      EFFECTIVE 10/13/2017"],
      ["effective", "REFERENCE          Section 504 of the Rehabilitation Act of      EFFECTIVE 10/13/2017"],
      ["supersedes", "SUPERSEDE          AI 123, dated August 21, 1992"],
      /* AI 544 (PowerDMS 2108538) */
      ["title", "SUBJECT/AGENCY Managing Violence in the Workplace"]],
  },
  dgo: {
    pages: [PDMS, `${PDMS}/415`, `${PDMS}/442`, `${PDMS}/5`, `${PDMS}/17`, `${PDMS}/25`, `${PDMS}/148`, `${PDMS}/462`, "https://cao-94612.s3.us-west-2.amazonaws.com/documents/1893442.pdf"],
    /* the number as written and its normal form: SO 9196's text and footnote, SO 9205's, the SO names in the directory;
       the directory itself lists `K-03`, `M-03.1`, `M-4.1`, `D-13.1` with no marker */
    citations: [["DGO K-03", "K-03", "K-3"], ["DGO K-04", "K-04", "K-4"], ["DGOs K-03", "K-03", "K-3"], ["DGO K-7", "K-7", "K-7"],
      ["DGO C-4", "C-4", "C-4"], ["DGO M-19", "M-19", "M-19"], ["DGO I-32.1 Community Safety Camera Systems", "I-32.1", "I-32.1"],
      ["Revision of Departmental General Order B-6, Perfor", "B-6", "B-6"], ["Update of Departmental General Order (DGO) J-3,", "J-3", "J-3"],
      ["Revision  to DGO M-03", "M-03", "M-3"], ["Revision DGO I-5- Mental Health", "I-5", "I-5"]],
    portions: [["DGO K-03: II C Use of Force (p. 3)", "K-03", "II C"]],
    headers: [["type", "                   DEPARTMENTAL GENERAL ORDER"], ["effective", "                   Effective Date: 01 Jan 22"],
      ["coordinator", "                   Coordinator: Training Division"],
      ["coordinator", "                   M-3.1                                                IAD Commander", false],
      ["coordinator", "                   ORDER                                                Evaluation Coordinator:"],
      ["title", " NSA Task: 4       Index as:                                         Evaluation Due Date:"],
      ["review_due", " NSA Task: 4       Index as:                                         Evaluation Due Date:"],
      ["revision_cycle", "                                                               Automatic Revision Cycle:"],
      /* A-17 (PowerDMS 17), B-03 (25), M-19 (462), A-1 (5), I-17 (148) */
      ["reference", "Ref: CALEA"], ["effective", "New Order"], ["effective", "Rev."], ["effective", "DEPARTMENTAL Effective Date"],
      ["review_due", "Evaluation Date:"], ["coordinator", "Evaluation Coordinator:"], ["title", "Index as:"]],
  },
  so: {
    pages: [PDMS, `${PDMS}/2227646`, `${PDMS}/642`, "https://cao-94612.s3.us-west-2.amazonaws.com/documents/1893442.pdf"],
    citations: [["SPECIAL ORDER NO. 8011", "8011"], ["Special Order 9196", "9196"], ["SO 9196", "9196"], ["SPECIAL ORDER 9205", "9205"], ["Special Order 9205", "9205"],
      ["SO 8011 Compliance Unit Liaison Policy", "8011"], ["SO 9205 - Banning Carotid Restraint", "9205"]],
    headers: [["type", "                                         SPECIAL ORDER 9196"],
      ["title", "            SUBJECT:         Documentation of the Use of Force1"],
      ["effective", "    EFFECTIVE DATE:          15 Feb 20"],
      /* SO 8011 (PowerDMS 642) */
      ["effective", "DATE: 9 May 03"], ["type", "SPECIAL ORDER NO. 8011"]],
  },
  tb: {
    pages: [PDMS, `${PDMS}/2992094`, `${PDMS}/415`],
    /* K-03's references, and the directory's names */
    citations: [["Training Bulletin III-G", "III-G", "III-G"], ["Training Bulletin III-H.02", "III-H.02", "III-H.02"],
      ["Training Bulletin III-I.1", "III-I.1", "III-I.1"], ["Training Bulletin III I.01", "III I.01", "III-I.01"],
      ["Training Bulletin V-F.02", "V-F.02", "V-F.02"], ["Training Bulletin VIII-R", "VIII-R", "VIII-R"],
      ["TB III-P.05 - Noise Flash Diversion Devices", "III-P.05", "III-P.05"], ["TB I F.06 Ramey/Steagald Warrants", "I F.06", "I-F.06"],
      ["TB I M Contacts, Detentions, and Arrests", "I M", "I-M"], ["TB V T.01 Internal Investigation Manual", "V T.01", "V-T.01"]],
    headers: [["type", "   TRAINING                                                                  BULLETIN"],
      ["number", "                                                                                                Index Number: III-P.05"],
      ["effective", "Effective Date:                                                                        Alpha Index: High Risk Incidents"],
      ["coordinator", "                                                                              Evaluation Coordinator: Training Division"]],
  },
  /* The accreditor's standards the General Orders cite (K1930): A-17, B-03, B-14, B-21, E-02, F-05, H-06, M-01, M-04,
     N-12, P-02 and others among doctypes' 50 */
  standards: {
    pages: [`${PDMS}/17`, `${PDMS}/25`, `${PDMS}/35`, `${PDMS}/41`, `${PDMS}/117`, `${PDMS}/477`],
    citations: [["Ref: CALEA\nStandards 15.1.1;\n15.1.2", "15.1.1"], ["Ref: CALEA\nStandard 22.3.3", "22.3.3"],
      ["Ref: CALEA\nStandard: 42.2.1", "42.2.1"], ["Ref: CALEA\nStandards 17.4.1-3; 43.1.3", "17.4.1"], ["Ref: CALEA\nStandards 53.1.1;\n53.2.1", "53.1.1"]],
    not: ["Ref: CALEA\nStandard N/A"],
    headers: [],
  },
  bp: {
    pages: ["https://www.ousd.org/board-of-ed/board-policy",
      "https://www.ousd.org/board-of-ed/board-policy/board-policy-preview/~board/board-policies/post/0420-school-plans-site-councils-bp",
      "https://resources.finalsite.net/images/v1692101299/ousdorg/qrgisdwlmoqnybjdfyil/BP_5124_Translation_and_Interpretation_Services.pdf"],
    citations: [["BP 5124", "5124"], ["BP/AR 1312.3 - Uniform Complaint Procedures", "1312.3"]],
    headers: [["type", "Board Policy"]],
  },
  ar: {
    pages: ["https://www.ousd.org/board-of-ed/board-policy",
      "https://www.ousd.org/board-of-ed/board-policy/board-policy-preview/~board/board-policies/post/0420-school-plans-site-councils-ar",
      "https://www.ousd.org/board-of-ed/board-policy/board-policy-preview/~board/board-policies/post/0420-school-plans-site-councils-bp"],
    citations: [["BP/AR 1312.3 - Uniform Complaint Procedures", "1312.3"]],
    headers: [["type", "Administrative Regulation"]],
  },
};

/* Lines of the same documents that cite no item of a family, or print no header label: what no pattern may take. */
export const NOT_CITATIONS = ["The purpose of this Administrative Instruction (AI) is to describe",
  "Departmental General Orders shall be read", "Department Training Bulletins shall be used to advise members",
  "(cf. 0450 - Comprehensive Safety Plan)", "Education Code 64001", "SO the officer", "AIR 1234", "Level 4, Type 22"];
export const NOT_HEADERS = ["The purpose of this Administrative Instruction is: (1) to outline",
  "the Police Department revisit its minimum staffing standards", "The Governing Board believes that comprehensive planning",
  "      Purpose:", "I.     PURPOSE"];
