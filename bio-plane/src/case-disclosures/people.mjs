/* The people a case names, and its signers' ties (requirements: `build/requirements/case-disclosures.md`, R24–R28;
 * Design Requirement 6 as amended, K1483; K1490, K1493, K1494). Pure: nothing here touches a table. The owner's list of
 * bases is read here; the case document's `people:` and `member_ties:` blocks are spelled and read back through
 * `case-grammar` R21, the one spelling (P15; K1816). The services that read the record (`peopleNamed`, `peopleJudged`, `tieAttestationJudged`) are this
 * module's `CaseDisclosures`.
 */

import { PEOPLE_KINDS } from "../lines/index.mjs";
import { ORGANISATION_KINDS } from "../entities/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** R25: the closed list of bases a named person is named on (K1483). */
export const PERSON_BASES = Object.freeze(["act_or_position", "tie", "interest", "consent", "prior_publication",
                                           "private_party"]);
/** R24: the places of a case document a caller's part may be (each finding's subject is read from `prepared`). */
export const PERSON_PLACES = Object.freeze(["statement", "claim", "lens", "docket", "timeline", "money"]);
/** R25: the `lines` kinds a `tie` basis may cite: `lines`' people family, its one spelling (`lines` R15). */
export const TIE_LINE_KINDS = PEOPLE_KINDS;
/** R27: the attribution levels at which a tie row carries no handle, key or signature (R10's levels). */
export const TIE_ANONYMOUS_LEVELS = Object.freeze(["group", "project"]);

const WORDS_MAX = 2000;
const SHA_RE = /^[0-9a-f]{64}$/;
const filled = (v) => typeof v === "string" && v.trim() !== "";
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** R25's input: `peopleBases`, `[{person, basis, ref, words?}]`, as a map by person (a person listed twice is listed once,
 *  its first entry kept, the module's convention). Absent or null is none. Any malformed shape is `BAD_COMPLETENESS`
 *  (`case-authoring` R3's code) naming the field: a list that is not one; an entry that is not an object naming a
 *  `person`; a `basis` outside `PERSON_BASES`; a `ref` not of its basis' shape (`act_or_position` `{line, event}`;
 *  `tie` a line id; `interest` a line or money-fact id; `consent` and `prior_publication` a capture's SHA-256;
 *  `private_party` none); words that are not a string, are over 2,000 characters, or hold a double quote, a backslash
 *  or a line break. */
export function basesListed(list) {
  const byPerson = new Map();
  const bad = (field, detail) => ({ ok: false, reason: "BAD_COMPLETENESS", field, detail });
  if (list == null) return { ok: true, byPerson };
  if (!Array.isArray(list))
    return bad("peopleBases", "peopleBases is a list of {person, basis, ref, words?}, one per person the case names");
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const at = `peopleBases[${i}]`;
    if (!isObj(d) || !filled(d.person)) return bad(at, `${at} is not {person, basis, ref, words?} naming a person`);
    if (!PERSON_BASES.includes(d.basis))
      return bad(`${at}.basis`, `${at}.basis is one of ${PERSON_BASES.join(", ")}`);
    const ref = refShape(d.basis, d.ref);
    if (ref === undefined)
      return bad(`${at}.ref`, `${at}.ref ${REF_WORDS[d.basis]}`);
    if (d.words != null && typeof d.words !== "string") return bad(`${at}.words`, `${at}.words is the owner's words, a string`);
    const words = typeof d.words === "string" ? d.words.trim() || null : null;
    if (words !== null && (words.length > WORDS_MAX || /["\\\r\n]/.test(words)))
      return bad(`${at}.words`, `${at}.words is at most ${WORDS_MAX} characters and cannot contain a quote, a backslash, or a `
        + `newline: the restricted frontmatter grammar has no escapes`);
    const person = d.person.trim();
    if (!byPerson.has(person)) byPerson.set(person, { person, ord: i, basis: d.basis, ref, words });
  }
  return { ok: true, byPerson };
}

const REF_WORDS = Object.freeze({
  act_or_position: "is {line, event}: the holds line valid at the act's date and the event of the act",
  tie: "is the id of a held line of a people kind (LIN-…)",
  interest: "is the id of a held interest: a line (LIN-…) or a money fact (MNY-…)",
  consent: "is the SHA-256 of the capture recording the person's consent, or of the member's cited testimony",
  prior_publication: "is the SHA-256 of a capture of the earlier publication naming them",
  private_party: "is absent: the words say why the person is named",
});

/* A basis' `ref` in its one shape, or undefined when it has another. */
function refShape(basis, ref) {
  switch (basis) {
    case "act_or_position":
      return isObj(ref) && filled(ref.line) && filled(ref.event) ? { line: ref.line.trim(), event: ref.event.trim() } : undefined;
    case "tie":
      return filled(ref) && /^LIN-/.test(ref.trim()) ? ref.trim() : undefined;
    case "interest":
      return filled(ref) && /^(LIN|MNY)-/.test(ref.trim()) ? ref.trim() : undefined;
    case "consent": case "prior_publication":
      return filled(ref) && SHA_RE.test(ref.trim().toLowerCase()) ? ref.trim().toLowerCase() : undefined;
    case "private_party":
      return ref == null ? null : undefined;
    default:
      return undefined;
  }
}

/** R25, R28: a basis' citation, as the people block states it: the kind's own reference, never a judgment of the person. */
export function basisCitation(basis, ref) {
  switch (basis) {
    case "act_or_position": return word("case-disclosures.line_held_event", { line: String(ref.line), event: String(ref.event) });
    case "tie": return localize("case-disclosures.people.line_cited", "line {ref}", { ref: String(ref) });
    case "interest": return /^MNY-/.test(ref) ? localize("case-disclosures.people.money_fact_cited", "money fact {ref}", { ref: String(ref) })
      : localize("case-disclosures.people.line_cited", "line {ref}", { ref: String(ref) });
    case "consent": case "prior_publication": return localize("case-disclosures.people.capture_cited", "capture {ref}", { ref: String(ref) });
    default: return null;
  }
}

/** R28: the places a person is named, as one value of the people block: each `<place> <where>`, in the order R24
 *  answered them, joined by "; ". */
export function placesStated(places) {
  return (Array.isArray(places) ? places : []).map((p) => [p.place, p.where].filter((x) => x != null && x !== "").join(" "))
    .filter(Boolean).join("; ");
}

/** R46 (T53; K5571 (2); `public-read` R52): whether a later subject may be named on a published case. `subject` is the
 *  entity the question's live document now states, as `entities.readEntity` answers it (`{entity_id, kind, label}`);
 *  `bases` the recorded bases of R25 (`peopleBases`, `[{person, basis, ref, words?}]`). Answers `{named: true, name}`
 *  only when a recorded basis other than `private_party` names that person or organisation (`person` the subject's
 *  `entity_id`), and `{named: false}` otherwise. A private person is never named: a person any recorded basis states
 *  as a `private_party` (a person outside any official, professional or public role, K1483) answers `{named: false}`
 *  whatever other basis is recorded. Only a person or an organisation (`entities`' `ORGANISATION_KINDS`) is ever named.
 *  `name` is the subject's label and nothing else of it (no contact, address or phone, R26). Pure: writes nothing, reads
 *  no capture's bytes, never throws. `viewer` is taken for the caller's symmetry and decides nothing here. */
export function subjectNaming(args) {
  const no = { named: false };
  try {
    const { subject = null, bases = null } = args && typeof args === "object" ? args : {};
    if (!subject || typeof subject !== "object" || Array.isArray(subject)) return no;
    const id = typeof subject.entity_id === "string" ? subject.entity_id : null;
    const name = typeof subject.label === "string" ? subject.label.trim() : "";
    if (!id || !name) return no;
    const isPerson = subject.kind === "person";
    if (!isPerson && !ORGANISATION_KINDS.includes(subject.kind)) return no;
    const own = (Array.isArray(bases) ? bases : [])
      .filter((b) => b && typeof b === "object" && !Array.isArray(b) && b.person === id && PERSON_BASES.includes(b.basis));
    if (isPerson && own.some((b) => b.basis === "private_party")) return no;
    return own.some((b) => b.basis !== "private_party") ? { named: true, name } : no;
  } catch {
    return no;
  }
}

/* ===========================================================================
 * THE BLOCKS (R28; K1816). `people:` one row per person R25 passed `{person, places, basis, citation, words}`;
 * `member_ties:` R27's rows `{row, signer, at, entity, kind, level, shown}`, `row` `attestation` or `tie`. Their spelling
 * and readers are `case-grammar` R21's, the one spelling (P15): this module answers its four names through it and keeps
 * no copy, so its importers keep working through these names.
 * =========================================================================== */

export { peopleLines, memberTieLines, peopleOf, memberTiesOf } from "../case-grammar/index.mjs";
