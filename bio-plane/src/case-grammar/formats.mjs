/* case-grammar — the case document's formats and their predicates (requirements: `build/requirements/case-grammar.md`
 * R1, which was `publication` R20). Copied from `publication/checks.mjs` (K651, K624 (1)), whose job then deleted its
 * copy and re-exports this module. `/5` also states R8's "What changed" block and R9's lens blocks (`./edition.mjs`;
 * DEC-101, DEC-103, K1019), with no `/6`: no `/5` document was stored when they were added. From T28 the format written
 * is `/6` (DEC-112 (3); K1268, BOB's decision 2): everything `/5` states, plus R11's `method:` block and R12's
 * `materials:` and `material_attestations:` blocks (`./materials.mjs`), required, so one predicate says "required"
 * without guessing whether a `/5` document is stored on a deployed plane. From T31 the format written is `/7` (DEC-124;
 * K1365 (1)), identical in fields to `/6`: every predicate holds for it as for `/6`, and the two differ only in the
 * product name the complete edition renders (R14, `./complete.mjs`). */

/* N345 (DEC-76 item 4, DEC-84 items 11–13, DEC-85): THE FORMAT MOVES TO /5, FOR THE REASON /3 AND /4 DID. A /5 document
   is one whose author was obliged to state the contradictions its findings rest on, one level deep, in its tension
   section (`case_tensions`), and each member's tension sentences; a /4 document had no place to, so a reader could not
   tell "none was disclosed" from "the format could not disclose one". /4, /3, /2 and /1 stay in the accepted set and
   are read exactly as written, never re-signed (rule 1).
   DEC-112 (3): THE FORMAT MOVES TO /6, FOR THE SAME REASON. A /6 document carries the version of the grading method and
   checks it was made under, and every document and observation its members' chains reach, with their attestations, so
   anybody can recreate it without a CivicOS copy; a /5 document had no place to. /5 joins the accepted set and is read
   exactly as written.
   DEC-124 (K1365 (1)): THE FORMAT MOVES TO /7, FOR ONE REASON ONLY. The product is renamed Civicsmith, and a /6 case
   file's complete edition must re-render byte for byte, so the name it prints is chosen by the format: /6 and earlier
   print "CivicOS", /7 prints "Civicsmith". /7 states exactly what /6 states. op=publish authors /7 only.
   T33-60 (C:A-12, C11; K1448, K1494): R18's `calculations:` and R20's `timeline:` blocks JOIN /7, with no /8, on R1's
   precedent. Neither is required: a document without either reads "none" from its reader, which is true of every
   document stored before T33, when no case could carry a calculation or a timeline.
   K3820 (R33; T51-136): THE FORMAT MOVES TO /8, FOR ONE REASON ONLY. The words a reader reads say "team" where they said
   "group", and a published `/7` case must re-render and re-spell byte for byte, so the words are chosen by the document's
   own format (`caseWordsOf`, `./words.mjs`): `/7` and earlier keep "group", `/8` says "team". `/8` states exactly what
   `/7` states, and `/7` stays accepted. op=publish authors /8 only.
   G47 (R1, R12; K4669, K4672): THE FORMAT /9 IS DECLARED BY A DOCUMENT THAT NEEDS IT, NEVER AUTHORED BY DEFAULT. A
   `material_attestations:` row may carry the `sha` of the capture it attests (R12), so a case of several captures of one
   source joins each attestation to its capture. A checker pinned before the field joins by `ref` alone and would give a
   wrong verdict on such a document; it answers "no specification" for a format it does not hold, so a document that
   carries any attestation `sha` declares `/9` (`caseDocumentFormatFor`) and one that carries none keeps `/8` and its
   bytes. `/9` states what `/8` states, plus that field, and speaks the same words.
   T53 (R35-R39; DEC-461, DEC-464; N1259): THE FORMAT MOVES TO /10. A /10 document states what /9 states (the
   attestation `sha` included), plus the passages published without a grade (`ungraded_passages:`, R36), the typed
   passages with who typed and who checked them as of signing (`typed_passages:`, R37), and a cited register row as a
   labelled extract on its material row (R38, R39). A checker pinned before them would read a typed passage as quoted
   and ask for a register segment's bytes, so every new document is /10 (`caseDocumentFormatFor` answers it always),
   and /9 and every earlier format stay accepted and are read exactly as written. op=publish authors /10 only. */
export const CASE_DOCUMENT_FORMAT = "bio-case-document/10";
export const CASE_DOCUMENT_FORMAT_V9 = "bio-case-document/9";
/* R33: /8, the first format in the "team" words; /9 and /10 speak them too. */
export const CASE_DOCUMENT_FORMAT_V8 = "bio-case-document/8";
/* DEC-124: /7 is identical in fields to /6, and /8 (K3820, R33) identical to /7: the formats differ in the words only. */
export const CASE_DOCUMENT_FORMAT_V7 = "bio-case-document/7";
/* DEC-112 (3): /6 states the method and materials blocks; /7 is identical to it in fields. */
export const CASE_DOCUMENT_FORMAT_V6 = "bio-case-document/6";
/* N345: /5 states the tension section and the captures, sources, "What changed" and lens blocks; /6 states all of them. */
export const CASE_DOCUMENT_FORMAT_V5 = "bio-case-document/5";
/* REC-219: /4 states, beside /3's obligations, every adoption pinning a proposed revision and every citation edge with
   its version. /3 (REC-188) carries the manifest and the acknowledgement list; /2 (D-442, rule 12) states its members'
   frozen blocks; /1 (legacy) carried the frozen blocks in its members' own bytes. */
export const CASE_DOCUMENT_FORMAT_V4 = "bio-case-document/4";
export const CASE_DOCUMENT_FORMAT_V3 = "bio-case-document/3";
export const CASE_DOCUMENT_FORMAT_V2 = "bio-case-document/2";
export const CASE_DOCUMENT_FORMAT_LEGACY = "bio-case-document/1";
export const CASE_DOCUMENT_FORMATS_ACCEPTED = Object.freeze([CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5,
  CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3, CASE_DOCUMENT_FORMAT_V2, CASE_DOCUMENT_FORMAT_LEGACY]);
const formatOf = (fm) => { try { return fm && typeof fm === "object" ? fm.format : undefined; } catch { return undefined; } };
/* Does the document state its members' frozen blocks itself (rule 12: /2 and later), or were they in the members' own
   bytes (/1)? ONE predicate for the gate, the committer and every per-case reader. Pure; never throws. */
export const caseDocumentStatesMemberBlocks = (fm) =>
  [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5,
    CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3, CASE_DOCUMENT_FORMAT_V2].includes(formatOf(fm));
/* REC-188: obliged to carry the bias manifest and the statement's acknowledgement list (C-41.13): /3 and later. */
export const caseDocumentRequiresDisclosures = (fm) =>
  [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5,
    CASE_DOCUMENT_FORMAT_V4, CASE_DOCUMENT_FORMAT_V3].includes(formatOf(fm));
/* REC-219: obliged to state the pending adoptions (C-41.14) and the citation edges with their versions (C-41.15): /4
   and later. */
export const caseDocumentRequiresV4Disclosures = (fm) =>
  [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5,
    CASE_DOCUMENT_FORMAT_V4].includes(formatOf(fm));
/* N345: obliged to carry the tension section (`case_tensions`, `case_tension_sentences`), and the one gate of every `/5`
   block's reader: /5 to /10. */
export const caseDocumentRequiresTensionSection = (fm) =>
  [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6, CASE_DOCUMENT_FORMAT_V5]
    .includes(formatOf(fm));
/* DEC-112 (3): obliged to carry R11's `method:` block and R12's `materials:` and `material_attestations:` blocks: /6
   /7, /8, /9 and /10. */
export const caseDocumentRequiresMaterials = (fm) =>
  [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMAT_V7, CASE_DOCUMENT_FORMAT_V6].includes(formatOf(fm));

/* G47 (R12): the `sha` an attestation row is written with, one spelling for the writer (`./materials.mjs`) and for the
   format a document declares: a non-empty sentence; anything else (absent, null, a number, blank) is no `sha`. Never
   throws. */
export const attestationShaOf = (row) => {
  try { const v = row && typeof row === "object" ? row.sha : null; return typeof v === "string" && v.trim() ? v : null; }
  catch { return null; }
};
/** R35 (T53; DEC-461, DEC-464; amends R1 and G47's rule): the format a case document declares, given the rows of its
 *  `material_attestations:` block: `/10` always, whatever the rows carry (an attestation `sha` included, which `/10`
 *  states as `/9` does). The argument is kept so every caller that hands the rows is unchanged. Pure; never throws. */
export const caseDocumentFormatFor = (attestationRows) => { void attestationRows; return CASE_DOCUMENT_FORMAT; };

/* R35: the number a format token names, `bio-case-document/<n>`, or null for anything else. */
const formatNumberOf = (fm) => {
  const m = /^bio-case-document\/([1-9][0-9]*)$/.exec(typeof formatOf(fm) === "string" ? formatOf(fm) : "");
  return m ? Number(m[1]) : null;
};
/** R35 (T53; name BOB's): whether a document's format states R36's `ungraded_passages:` and R37's `typed_passages:`
 *  blocks: true for `/10` and later, false for `/9` and earlier, for no format and for anything that is not a case
 *  document format. Pure; never throws. */
export const caseDocumentStatesUngradedAndTyped = (fm) => {
  try { const n = formatNumberOf(fm); return n !== null && n >= 10; } catch { return false; }
};
