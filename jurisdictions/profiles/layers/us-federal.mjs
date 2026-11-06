/* The federal layer: Civicsmith's read-only layer for the United States (R109). Federal law's own facts only. Cut from the unsplit `oakland-alameda` profile at T53 (R114): every fact keeps its basis.
 * Level: federal. Plain data. Its records offices (R119) are the dated snapshot of the government's own list in
 * ./us-federal-offices.mjs, written by the makers' script (R120); `coverage.as_of` is that read's date. */
import OFFICES from "./us-federal-offices.mjs";

export default {
  "id": "us-federal",
  "name": "United States (federal law)",
  "covers": [
    "United States"
  ],
  "test": false,
  "layer": {
    "level": "federal",
    "place": "United States",
    "origin": "civicsmith"
  },
  "coverage": {
    "as_of": OFFICES.as_of,
    "holidays_through": 2027
  },
  "records_laws": [
    {
      "level": "federal",
      "name": "Freedom of Information Act",
      "citation": "5 U.S.C. § 552",
      "stages": [
        {
          "stage": "request",
          "label": "request for records",
          "citation": "5 U.S.C. § 552(a)(3)(A)"
        },
        {
          "stage": "fee_waiver_request",
          "label": "request for a waiver or reduction of fees",
          "citation": "5 U.S.C. § 552(a)(4)(A)(iii)"
        },
        {
          "stage": "extension_notice",
          "label": "written notice of unusual circumstances",
          "citation": "5 U.S.C. § 552(a)(6)(B)(i)"
        },
        {
          "stage": "production",
          "label": "records made promptly available",
          "citation": "5 U.S.C. § 552(a)(3)(A)"
        },
        {
          "stage": "denial",
          "label": "determination denying the request",
          "citation": "5 U.S.C. § 552(a)(6)(A)(i)"
        },
        {
          "stage": "appeal",
          "label": "appeal of an adverse determination",
          "citation": "5 U.S.C. § 552(a)(6)(A)(i)"
        },
        {
          "stage": "appeal_decision",
          "label": "determination on the appeal",
          "citation": "5 U.S.C. § 552(a)(6)(A)(ii)"
        },
        {
          "stage": "court_filing",
          "label": "complaint in the district court",
          "citation": "5 U.S.C. § 552(a)(4)(B)"
        }
      ],
      "requesters": {
        "text": "any person; an element of the intelligence community does not make records available to a foreign government entity or its representative",
        "citation": "5 U.S.C. § 552(a)(3)(A), (E)",
        "status": "researched",
        "basis": "2026-10-21 foia-text"
      },
      "response": "foia_response",
      "basis": "2026-10-21 foia-text",
      "governs": [
        "federal"
      ]
    }
  ],
  "counterparties": OFFICES.offices.map((o) => o.entry),
  "deadlines": [
    {
      "rule": "foia_response",
      "label": "answer to a first request",
      "applies_to": "records_request",
      "units": "days",
      "amount": 20,
      "count": "business",
      "direction": "forward",
      "starts": "received",
      "closures": "federal",
      "extension": {
        "days": 10,
        "count": "business",
        "when": "unusual circumstances, by written notice to the requester",
        "citation": "5 U.S.C. § 552(a)(6)(B)(i)"
      },
      "tolling": [
        {
          "when": "the agency awaits information it reasonably requested from the requester",
          "citation": "5 U.S.C. § 552(a)(6)(A)(ii)(I)"
        },
        {
          "when": "the agency awaits clarification of the requester's fee assessment",
          "citation": "5 U.S.C. § 552(a)(6)(A)(ii)(II)"
        }
      ],
      "owed_by": "body",
      "consequence": {
        "text": "shall be deemed to have exhausted his administrative remedies with respect to such request if the agency fails to comply with the applicable time limit provisions of this paragraph",
        "citation": "5 U.S.C. § 552(a)(6)(C)(i)"
      },
      "citation": "5 U.S.C. § 552(a)(6)(A)(i)",
      "status": "researched",
      "basis": "2026-10-05 time-law, 2026-10-11 actions-law"
    },
    {
      "rule": "foia_appeal_response",
      "label": "decision on an appeal",
      "applies_to": "records_request",
      "units": "days",
      "amount": 20,
      "count": "business",
      "direction": "forward",
      "starts": "received",
      "closures": "federal",
      "owed_by": "body",
      "consequence": {
        "text": "shall be deemed to have exhausted his administrative remedies with respect to such request if the agency fails to comply with the applicable time limit provisions of this paragraph",
        "citation": "5 U.S.C. § 552(a)(6)(C)(i)"
      },
      "citation": "5 U.S.C. § 552(a)(6)(A)(ii)",
      "status": "researched",
      "basis": "2026-10-11 actions-law"
    }
  ],
  "holidays": [
    {
      "year": 2026,
      "list": "federal",
      "citation": "5 U.S.C. § 6103(a)",
      "days": [
        {
          "date": "2026-01-01",
          "name": "New Year's Day"
        },
        {
          "date": "2026-01-19",
          "name": "Birthday of Martin Luther King, Jr."
        },
        {
          "date": "2026-02-16",
          "name": "Washington's Birthday"
        },
        {
          "date": "2026-05-25",
          "name": "Memorial Day"
        },
        {
          "date": "2026-06-19",
          "name": "Juneteenth National Independence Day"
        },
        {
          "date": "2026-07-03",
          "name": "Independence Day (observed, 5 U.S.C. § 6103(b))"
        },
        {
          "date": "2026-07-04",
          "name": "Independence Day"
        },
        {
          "date": "2026-09-07",
          "name": "Labor Day"
        },
        {
          "date": "2026-10-12",
          "name": "Columbus Day"
        },
        {
          "date": "2026-11-11",
          "name": "Veterans Day"
        },
        {
          "date": "2026-11-26",
          "name": "Thanksgiving Day"
        },
        {
          "date": "2026-12-25",
          "name": "Christmas Day"
        }
      ],
      "status": "researched",
      "basis": "2026-10-05 time-law; 2026-10-05 holidays-extra"
    },
    {
      "year": 2027,
      "list": "federal",
      "citation": "5 U.S.C. § 6103(a), (b)",
      "days": [
        {
          "date": "2027-01-01",
          "name": "New Year's Day"
        },
        {
          "date": "2027-01-18",
          "name": "Birthday of Martin Luther King, Jr."
        },
        {
          "date": "2027-02-15",
          "name": "Washington's Birthday"
        },
        {
          "date": "2027-05-31",
          "name": "Memorial Day"
        },
        {
          "date": "2027-06-18",
          "name": "Juneteenth National Independence Day (observed)"
        },
        {
          "date": "2027-06-19",
          "name": "Juneteenth National Independence Day"
        },
        {
          "date": "2027-07-04",
          "name": "Independence Day"
        },
        {
          "date": "2027-07-05",
          "name": "Independence Day (observed)"
        },
        {
          "date": "2027-09-06",
          "name": "Labor Day"
        },
        {
          "date": "2027-10-11",
          "name": "Columbus Day"
        },
        {
          "date": "2027-11-11",
          "name": "Veterans Day"
        },
        {
          "date": "2027-11-25",
          "name": "Thanksgiving Day"
        },
        {
          "date": "2027-12-24",
          "name": "Christmas Day (observed)"
        },
        {
          "date": "2027-12-25",
          "name": "Christmas Day"
        },
        {
          "date": "2027-12-31",
          "name": "New Year's Day 2028 (observed)"
        }
      ],
      "status": "researched",
      "basis": "2026-10-11 actions-law"
    }
  ],
  "standard_sources": [
    {
      "source": "Freedom of Information Act",
      "kind": "statute",
      "issuer": "United States Congress",
      "level": "federal",
      "cite": {
        "re": "\\b5\\s+U\\.?\\s?S\\.?\\s?C\\.?\\s+§+\\s*552\\b",
        "flags": "i"
      },
      "basis": "2026-10-05 time-law"
    }
  ],
  "forums": [
    {
      "label": "United States District Court, Northern District of California",
      "forum_kind": "court",
      "basis": "2026-10-25 cand-jurisdiction-map"
    }
  ],
  "action_kinds": [
    {
      "kind": "records_request",
      "label": "public records request",
      "laws": [
        "Freedom of Information Act"
      ],
      "basis": "D-182"
    }
  ],
  "records_help": [
    {
      "law": "Freedom of Information Act",
      "days": 20,
      "extra_days": 10,
      "extension_reasons": [
        {
          "reason": "the records must be searched for and collected from field facilities or other establishments separate from the office processing the request",
          "citation": "5 U.S.C. § 552(a)(6)(B)(iii)(I)"
        },
        {
          "reason": "a voluminous amount of separate and distinct records demanded in a single request must be searched for, collected and examined",
          "citation": "5 U.S.C. § 552(a)(6)(B)(iii)(II)"
        },
        {
          "reason": "the agency must consult another agency with a substantial interest in the request, or two or more of its own components",
          "citation": "5 U.S.C. § 552(a)(6)(B)(iii)(III)"
        }
      ],
      "citations": {
        "answer": "5 U.S.C. § 552(a)(6)(A)(i)",
        "extend": "5 U.S.C. § 552(a)(6)(B)(i)",
        "assist": "5 U.S.C. § 552(a)(6)(B)(ii)",
        "segregate": "5 U.S.C. § 552(b)",
        "refuse_in_writing": "5 U.S.C. § 552(a)(6)(A)(i); 5 U.S.C. § 552(a)(6)(C)(i)",
        "electronic": "5 U.S.C. § 552(a)(3)(B)",
        "cost": "5 U.S.C. § 552(a)(4)(A)(ii); 5 U.S.C. § 552(a)(4)(A)(iv)",
        "cost_electronic": "not provided by 5 U.S.C. § 552: no rule of its own for electronic records; read: (a)(3)(B), (a)(4)(A)(ii), (a)(4)(A)(iv)",
        "inspect_photograph": "not provided by 5 U.S.C. § 552: no right to inspect or photograph requested records in person; read: (a)(2), (a)(3)(A), (a)(3)(B), (a)(4)(A)(ii), (a)(4)(A)(iv)",
        "purpose": "5 U.S.C. § 552(a)(3)(A); 5 U.S.C. § 552(a)(4)(A)(ii)"
      },
      "status": "researched",
      "basis": "2026-11-05 foia-text"
    }
  ],
  "weekend": {
    "days": [
      "sat",
      "sun"
    ],
    "citation": "5 U.S.C. § 552(a)(6)(A)(i)",
    "status": "researched",
    "basis": "2026-10-05 time-law"
  },
  "vocabulary": {
    "street_types": [
      {
        "suffix": "ALLEY",
        "abbreviations": [
          "ALLEE",
          "ALLY",
          "ALY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ANEX",
        "abbreviations": [
          "ANNEX",
          "ANNX",
          "ANX"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ARCADE",
        "abbreviations": [
          "ARC"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "AVENUE",
        "abbreviations": [
          "AV",
          "AVEN",
          "AVENU",
          "AVN",
          "AVNUE",
          "AVE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BAYOU",
        "abbreviations": [
          "BAYOO",
          "BYU"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BEACH",
        "abbreviations": [
          "BCH"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BEND",
        "abbreviations": [
          "BND"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BLUFF",
        "abbreviations": [
          "BLF",
          "BLUF"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BLUFFS",
        "abbreviations": [
          "BLFS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BOTTOM",
        "abbreviations": [
          "BOT",
          "BOTTM",
          "BTM"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BOULEVARD",
        "abbreviations": [
          "BLVD",
          "BOUL",
          "BOULV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BRANCH",
        "abbreviations": [
          "BR",
          "BRNCH"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BRIDGE",
        "abbreviations": [
          "BRDGE",
          "BRG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BROOK",
        "abbreviations": [
          "BRK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BROOKS",
        "abbreviations": [
          "BRKS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BURG",
        "abbreviations": [
          "BG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BURGS",
        "abbreviations": [
          "BGS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "BYPASS",
        "abbreviations": [
          "BYP",
          "BYPA",
          "BYPAS",
          "BYPS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CAMP",
        "abbreviations": [
          "CP",
          "CMP"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CANYON",
        "abbreviations": [
          "CANYN",
          "CNYN",
          "CYN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CAPE",
        "abbreviations": [
          "CPE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CAUSEWAY",
        "abbreviations": [
          "CAUSWA",
          "CSWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CENTER",
        "abbreviations": [
          "CEN",
          "CENT",
          "CENTR",
          "CENTRE",
          "CNTER",
          "CNTR",
          "CTR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CENTERS",
        "abbreviations": [
          "CTRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CIRCLE",
        "abbreviations": [
          "CIR",
          "CIRC",
          "CIRCL",
          "CRCL",
          "CRCLE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CIRCLES",
        "abbreviations": [
          "CIRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CLIFF",
        "abbreviations": [
          "CLF"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CLIFFS",
        "abbreviations": [
          "CLFS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CLUB",
        "abbreviations": [
          "CLB"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COMMON",
        "abbreviations": [
          "CMN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COMMONS",
        "abbreviations": [
          "CMNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CORNER",
        "abbreviations": [
          "COR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CORNERS",
        "abbreviations": [
          "CORS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COURSE",
        "abbreviations": [
          "CRSE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COURT",
        "abbreviations": [
          "CT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COURTS",
        "abbreviations": [
          "CTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COVE",
        "abbreviations": [
          "CV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "COVES",
        "abbreviations": [
          "CVS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CREEK",
        "abbreviations": [
          "CRK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CRESCENT",
        "abbreviations": [
          "CRSENT",
          "CRSNT",
          "CRES"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CREST",
        "abbreviations": [
          "CRST"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CROSSING",
        "abbreviations": [
          "CRSSNG",
          "XING"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CROSSROAD",
        "abbreviations": [
          "XRD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CROSSROADS",
        "abbreviations": [
          "XRDS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "CURVE",
        "abbreviations": [
          "CURV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "DALE",
        "abbreviations": [
          "DL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "DAM",
        "abbreviations": [
          "DM"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "DIVIDE",
        "abbreviations": [
          "DIV",
          "DVD",
          "DV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "DRIVE",
        "abbreviations": [
          "DR",
          "DRIV",
          "DRV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "DRIVES",
        "abbreviations": [
          "DRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ESTATE",
        "abbreviations": [
          "EST"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ESTATES",
        "abbreviations": [
          "ESTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "EXPRESSWAY",
        "abbreviations": [
          "EXP",
          "EXPR",
          "EXPRESS",
          "EXPW",
          "EXPY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "EXTENSION",
        "abbreviations": [
          "EXT",
          "EXTN",
          "EXTNSN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "EXTENSIONS",
        "abbreviations": [
          "EXTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FALL",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FALLS",
        "abbreviations": [
          "FLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FERRY",
        "abbreviations": [
          "FRRY",
          "FRY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FIELD",
        "abbreviations": [
          "FLD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FIELDS",
        "abbreviations": [
          "FLDS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FLAT",
        "abbreviations": [
          "FLT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FLATS",
        "abbreviations": [
          "FLTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORD",
        "abbreviations": [
          "FRD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORDS",
        "abbreviations": [
          "FRDS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FOREST",
        "abbreviations": [
          "FRST"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORESTS",
        "abbreviations": [
          "FRST"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORGE",
        "abbreviations": [
          "FORG",
          "FRG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORGES",
        "abbreviations": [
          "FRGS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORK",
        "abbreviations": [
          "FRK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORKS",
        "abbreviations": [
          "FRKS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FORT",
        "abbreviations": [
          "FRT",
          "FT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "FREEWAY",
        "abbreviations": [
          "FREEWY",
          "FRWAY",
          "FRWY",
          "FWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GARDEN",
        "abbreviations": [
          "GARDN",
          "GRDEN",
          "GRDN",
          "GDN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GARDENS",
        "abbreviations": [
          "GRDNS",
          "GDNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GATEWAY",
        "abbreviations": [
          "GATEWY",
          "GATWAY",
          "GTWAY",
          "GTWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GLEN",
        "abbreviations": [
          "GLN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GLENS",
        "abbreviations": [
          "GLNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GREEN",
        "abbreviations": [
          "GRN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GREENS",
        "abbreviations": [
          "GRNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GROVE",
        "abbreviations": [
          "GROV",
          "GRV"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "GROVES",
        "abbreviations": [
          "GRVS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HARBOR",
        "abbreviations": [
          "HARB",
          "HARBR",
          "HRBOR",
          "HBR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HARBORS",
        "abbreviations": [
          "HBRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HAVEN",
        "abbreviations": [
          "HVN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HEIGHTS",
        "abbreviations": [
          "HT",
          "HTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HIGHWAY",
        "abbreviations": [
          "HIGHWY",
          "HIWAY",
          "HIWY",
          "HWAY",
          "HWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HILL",
        "abbreviations": [
          "HL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HILLS",
        "abbreviations": [
          "HLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HOLLOW",
        "abbreviations": [
          "HLLW",
          "HOLLOWS",
          "HOLWS",
          "HOLW"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "HOLLOWS",
        "abbreviations": [
          "HOLW"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "INLET",
        "abbreviations": [
          "INLT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ISLAND",
        "abbreviations": [
          "ISLND",
          "IS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ISLANDS",
        "abbreviations": [
          "ISLNDS",
          "ISS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ISLE",
        "abbreviations": [
          "ISLES"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "JUNCTION",
        "abbreviations": [
          "JCT",
          "JCTION",
          "JCTN",
          "JUNCTN",
          "JUNCTON"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "JUNCTIONS",
        "abbreviations": [
          "JCTNS",
          "JCTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "KEY",
        "abbreviations": [
          "KY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "KEYS",
        "abbreviations": [
          "KYS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "KNOLL",
        "abbreviations": [
          "KNOL",
          "KNOLLS",
          "KNL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "KNOLLS",
        "abbreviations": [
          "KNLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LAKE",
        "abbreviations": [
          "LK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LAKES",
        "abbreviations": [
          "LKS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LAND",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LANDING",
        "abbreviations": [
          "LNDNG",
          "LNDG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LANE",
        "abbreviations": [
          "LN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LIGHT",
        "abbreviations": [
          "LGT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LIGHTS",
        "abbreviations": [
          "LGTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LOAF",
        "abbreviations": [
          "LF"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LOCK",
        "abbreviations": [
          "LCK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LOCKS",
        "abbreviations": [
          "LCKS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LODGE",
        "abbreviations": [
          "LDG",
          "LDGE",
          "LODG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "LOOP",
        "abbreviations": [
          "LOOPS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MALL",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MANOR",
        "abbreviations": [
          "MNR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MANORS",
        "abbreviations": [
          "MNRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MEADOW",
        "abbreviations": [
          "MEADOWS",
          "MEDOWS",
          "MDW"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MEADOWS",
        "abbreviations": [
          "MDWS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MEWS",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MILL",
        "abbreviations": [
          "ML"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MILLS",
        "abbreviations": [
          "MLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MISSION",
        "abbreviations": [
          "MISSN",
          "MSSN",
          "MSN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MOTORWAY",
        "abbreviations": [
          "MTWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MOUNT",
        "abbreviations": [
          "MNT",
          "MT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MOUNTAIN",
        "abbreviations": [
          "MNTAIN",
          "MNTN",
          "MOUNTIN",
          "MTIN",
          "MTN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "MOUNTAINS",
        "abbreviations": [
          "MNTNS",
          "MTNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "NECK",
        "abbreviations": [
          "NCK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ORCHARD",
        "abbreviations": [
          "ORCH",
          "ORCHRD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "OVAL",
        "abbreviations": [
          "OVL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "OVERPASS",
        "abbreviations": [
          "OPAS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PARK",
        "abbreviations": [
          "PRK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PARKS",
        "abbreviations": [
          "PARK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PARKWAY",
        "abbreviations": [
          "PARKWY",
          "PKWAY",
          "PKWY",
          "PKY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PARKWAYS",
        "abbreviations": [
          "PKWYS",
          "PKWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PASS",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PASSAGE",
        "abbreviations": [
          "PSGE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PATH",
        "abbreviations": [
          "PATHS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PIKE",
        "abbreviations": [
          "PIKES"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PINE",
        "abbreviations": [
          "PNE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PINES",
        "abbreviations": [
          "PNES"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PLACE",
        "abbreviations": [
          "PL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PLAIN",
        "abbreviations": [
          "PLN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PLAINS",
        "abbreviations": [
          "PLNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PLAZA",
        "abbreviations": [
          "PLZA",
          "PLZ"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "POINT",
        "abbreviations": [
          "PT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "POINTS",
        "abbreviations": [
          "PTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PORT",
        "abbreviations": [
          "PRT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PORTS",
        "abbreviations": [
          "PRTS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "PRAIRIE",
        "abbreviations": [
          "PRR",
          "PR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RADIAL",
        "abbreviations": [
          "RADIEL",
          "RAD",
          "RADL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RAMP",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RANCH",
        "abbreviations": [
          "RNCH"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RANCHES",
        "abbreviations": [
          "RNCHS",
          "RNCH"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RAPID",
        "abbreviations": [
          "RPD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RAPIDS",
        "abbreviations": [
          "RPDS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "REST",
        "abbreviations": [
          "RST"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RIDGE",
        "abbreviations": [
          "RDG",
          "RDGE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RIDGES",
        "abbreviations": [
          "RDGS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RIVER",
        "abbreviations": [
          "RIV",
          "RVR",
          "RIVR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ROAD",
        "abbreviations": [
          "RD"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ROADS",
        "abbreviations": [
          "RDS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ROUTE",
        "abbreviations": [
          "RTE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "ROW",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RUE",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "RUN",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SHOAL",
        "abbreviations": [
          "SHL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SHOALS",
        "abbreviations": [
          "SHLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SHORE",
        "abbreviations": [
          "SHOAR",
          "SHR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SHORES",
        "abbreviations": [
          "SHOARS",
          "SHRS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SKYWAY",
        "abbreviations": [
          "SKWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SPRING",
        "abbreviations": [
          "SPG",
          "SPNG",
          "SPRNG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SPRINGS",
        "abbreviations": [
          "SPGS",
          "SPNGS",
          "SPRNGS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SPUR",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SPURS",
        "abbreviations": [
          "SPUR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SQUARE",
        "abbreviations": [
          "SQ",
          "SQR",
          "SQRE",
          "SQU"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SQUARES",
        "abbreviations": [
          "SQRS",
          "SQS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "STATION",
        "abbreviations": [
          "STA",
          "STATN",
          "STN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "STRAVENUE",
        "abbreviations": [
          "STRA",
          "STRAV",
          "STRAVEN",
          "STRAVN",
          "STRVN",
          "STRVNUE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "STREAM",
        "abbreviations": [
          "STREME",
          "STRM"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "STREET",
        "abbreviations": [
          "STRT",
          "ST",
          "STR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "STREETS",
        "abbreviations": [
          "STS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "SUMMIT",
        "abbreviations": [
          "SMT",
          "SUMIT",
          "SUMITT"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TERRACE",
        "abbreviations": [
          "TER",
          "TERR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "THROUGHWAY",
        "abbreviations": [
          "TRWY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRACE",
        "abbreviations": [
          "TRACES",
          "TRCE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRACK",
        "abbreviations": [
          "TRACKS",
          "TRK",
          "TRKS",
          "TRAK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRAFFICWAY",
        "abbreviations": [
          "TRFY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRAIL",
        "abbreviations": [
          "TRL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRAILS",
        "abbreviations": [
          "TRLS",
          "TRL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TRAILER",
        "abbreviations": [
          "TRLRS",
          "TRLR"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TUNNEL",
        "abbreviations": [
          "TUNEL",
          "TUNLS",
          "TUNNL",
          "TUNL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TUNNELS",
        "abbreviations": [
          "TUNL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "TURNPIKE",
        "abbreviations": [
          "TRNPK",
          "TURNPK",
          "TPKE"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "UNDERPASS",
        "abbreviations": [
          "UPAS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "UNION",
        "abbreviations": [
          "UN"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "UNIONS",
        "abbreviations": [
          "UNS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VALLEY",
        "abbreviations": [
          "VALLY",
          "VLLY",
          "VLY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VALLEYS",
        "abbreviations": [
          "VLYS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VIADUCT",
        "abbreviations": [
          "VDCT",
          "VIADCT",
          "VIA"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VIEW",
        "abbreviations": [
          "VW"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VIEWS",
        "abbreviations": [
          "VWS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VILLAGE",
        "abbreviations": [
          "VILL",
          "VILLAG",
          "VILLG",
          "VILLIAGE",
          "VLG"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VILLAGES",
        "abbreviations": [
          "VLGS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VILLE",
        "abbreviations": [
          "VL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "VISTA",
        "abbreviations": [
          "VIS",
          "VIST",
          "VST",
          "VSTA"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WALK",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WALKS",
        "abbreviations": [
          "WALK"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WALL",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WAY",
        "abbreviations": [
          "WY"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WAYS",
        "abbreviations": [],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WELL",
        "abbreviations": [
          "WL"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      },
      {
        "suffix": "WELLS",
        "abbreviations": [
          "WLS"
        ],
        "basis": "2026-10-28 usps-pub28-appendix-c1"
      }
    ]
  },
  "systems": [
    {
      "origin": "fec.bulk",
      "name": "the federal election agency's bulk-data files",
      "hosts": [
        "www.fec.gov",
        "cg-519a459a-0ea3-42c2-b7bc-fa1143481f74.s3-us-gov-west-1.amazonaws.com"
      ],
      "gated": "none",
      "terms": "the names and addresses of individual contributors may not be sold or used for commercial purposes, or to solicit contributions or donations",
      "use_limit": "fec_contributor_names",
      "basis": "2026-10-21 M-R6"
    }
  ],
  "use_limits": [
    {
      "key": "fec_contributor_names",
      "citation": "11 CFR 104.15; 52 U.S.C. 30111(a)(4)",
      "text_key": "jurisdictions.use_limit.fec_contributor_names",
      "export": "never",
      "on_publish": "warn",
      "basis": "2026-10-21 M-R6"
    }
  ],
  "registers": [
    {
      "key": "fec_individual_contributions",
      "label": "Federal individual contributions (itemised)",
      "publisher": "Federal Election Commission",
      "system": "fec.bulk",
      "url": "https://www.fec.gov/data/browse-data/?tab=bulk-data",
      "delimiter": "pipe",
      "gate": "none",
      "phase": "alpha",
      "use_limit": "fec_contributor_names",
      "pieces": [
        {
          "key": "header",
          "label": "the header file",
          "locator": "https://www.fec.gov/files/bulk-downloads/data_dictionaries/indiv_header_file.csv",
          "delimiter": "comma"
        },
        {
          "key": "cycle",
          "label": "one zip per two-year cycle",
          "locator": "https://www.fec.gov/files/bulk-downloads/{cycle}/indiv{cycle2}.zip",
          "member": "itcont.txt",
          "header_from": "header"
        }
      ],
      "columns": [
        {
          "name": "CMTE_ID",
          "role": "filer_id",
          "keep": true
        },
        {
          "name": "NAME",
          "role": "name",
          "keep": true
        },
        {
          "name": "CITY",
          "role": "city",
          "keep": true
        },
        {
          "name": "STATE",
          "role": "state",
          "keep": true
        },
        {
          "name": "ZIP_CODE",
          "role": "zip5",
          "keep": true
        },
        {
          "name": "EMPLOYER",
          "role": "other",
          "keep": true
        },
        {
          "name": "OCCUPATION",
          "role": "other",
          "keep": true
        },
        {
          "name": "TRANSACTION_DT",
          "role": "date",
          "keep": true
        },
        {
          "name": "TRANSACTION_AMT",
          "role": "amount",
          "keep": true,
          "currency": "USD"
        },
        {
          "name": "TRAN_ID",
          "role": "other",
          "keep": true
        },
        {
          "name": "SUB_ID",
          "role": "other",
          "keep": true
        }
      ],
      "row_key": [
        "SUB_ID"
      ],
      "row_key_basis": "content",
      "terms_basis": "2026-10-21 the bulk-data page: contributor names and addresses may not be sold or used for commercial purposes or to solicit contributions",
      "listing": {
        "bytes": {
          "value": 2331678889,
          "basis": "stated",
          "how": "the 2026 cycle's zip; each cycle has its own"
        },
        "rows": {
          "value": null,
          "basis": "not_stated"
        },
        "measured_at": "2026-10-21",
        "source_date": "2026-10-18"
      },
      "refresh": {
        "cadence_hours": 24,
        "validators": [
          "etag",
          "last_modified",
          "content_length"
        ]
      },
      "basis": "2026-10-21 M-R1"
    },
    {
      "key": "fec_committees",
      "label": "Federal committee master",
      "publisher": "Federal Election Commission",
      "system": "fec.bulk",
      "url": "https://www.fec.gov/data/browse-data/?tab=bulk-data",
      "delimiter": "pipe",
      "gate": "none",
      "phase": "alpha",
      "use_limit": "fec_contributor_names",
      "pieces": [
        {
          "key": "header",
          "label": "the header file",
          "locator": "https://www.fec.gov/files/bulk-downloads/data_dictionaries/cm_header_file.csv",
          "delimiter": "comma"
        },
        {
          "key": "cycle",
          "label": "one zip per two-year cycle",
          "locator": "https://www.fec.gov/files/bulk-downloads/{cycle}/cm{cycle2}.zip",
          "member": "cm.txt",
          "header_from": "header"
        }
      ],
      "columns": [
        {
          "name": "CMTE_ID",
          "role": "filer_id",
          "keep": true
        },
        {
          "name": "CMTE_NM",
          "role": "organization",
          "keep": true
        },
        {
          "name": "TRES_NM",
          "role": "name",
          "keep": true
        },
        {
          "name": "CMTE_CITY",
          "role": "city",
          "keep": true
        },
        {
          "name": "CMTE_ST",
          "role": "state",
          "keep": true
        },
        {
          "name": "CMTE_ZIP",
          "role": "zip5",
          "keep": true
        },
        {
          "name": "CMTE_TP",
          "role": "other",
          "keep": true
        },
        {
          "name": "CONNECTED_ORG_NM",
          "role": "organization",
          "keep": true
        }
      ],
      "row_key": [
        "CMTE_ID"
      ],
      "row_key_basis": "source",
      "terms_basis": "2026-10-21 the bulk-data page: contributor names and addresses may not be sold or used for commercial purposes or to solicit contributions",
      "refresh": {
        "cadence_hours": 24,
        "validators": [
          "etag",
          "last_modified"
        ]
      },
      "basis": "2026-10-21 M-R1"
    },
    {
      "key": "opencorporates",
      "label": "Company records (OpenCorporates)",
      "publisher": "OpenCorporates",
      "url": "https://opencorporates.com/",
      "status": "not_measured",
      "basis": "2026-10-21 M-R1"
    }
  ]
};
