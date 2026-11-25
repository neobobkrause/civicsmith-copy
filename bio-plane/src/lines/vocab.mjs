/* lines: the closed vocabularies (Terms; R15). A line kind, a capacity, a role per kind and the members' words for each
   connection kind are revised only by spec (K1441, K1453, K1455, K1486), never by a write. `kinds()`, `capacities()`
   and `roles(kind)` answer them frozen, for `affordances` to publish. */

/* Structure: the bodies and offices, who funds and contracts, who acts for and answers for whom (K1441, K1470). */
import { word } from "../setup-words/index.mjs";

/** @type {readonly string[]} the structure kinds (K1441, K1470) */
export const STRUCTURE_KINDS = Object.freeze(["part_of", "post_in", "holds", "reports_to", "oversees", "appoints",
  "seat_on", "funds", "contracts_with", "acts_for", "responsible_for", "custodian_of", "successor_of"]);
/* People: memberships, schooling, credentials, interests and ties (K1452, K1453; K1455: `related_to` without condition). */
/** @type {readonly string[]} the people kinds (K1452, K1453, K1455) */
export const PEOPLE_KINDS = Object.freeze(["belongs_to", "educated_at", "credentialed_by", "owns_interest_in",
  "related_to", "associate_of"]);
/* Proceedings: the parties and the links between proceedings (C1). */
/** @type {readonly string[]} the proceeding kinds (C1) */
export const PROCEEDING_KINDS = Object.freeze(["party_to", "appeal_of", "consolidated_with", "remanded_to", "arises_from"]);
/** @type {readonly string[]} every line kind, closed (Terms; K1441): structure, then people, then proceedings */
export const LINE_KINDS = Object.freeze([...STRUCTURE_KINDS, ...PEOPLE_KINDS, ...PROCEEDING_KINDS]);

/* `holds` only: the capacity a post is held in. */
/** @type {readonly string[]} the capacities a post is held in, closed, `holds` only (Terms) */
export const CAPACITIES = Object.freeze(["employee", "elected", "appointed", "acting", "interim", "ex officio",
  "board member", word("label.linecapacities.officer_or_director"), "partner", "military service", "volunteer", "contractor", "other"]);

/* The OCDS party-role codelist, for `contracts_with`. */
/** @type {readonly string[]} the OCDS party-role codelist, `contracts_with`'s roles */
export const OCDS_PARTY_ROLES = Object.freeze(["buyer", "procuringEntity", "supplier", "tenderer", "funder", "enquirer",
  "payer", "payee", "reviewBody", "interestedParty"]);
/* A party's role in a proceeding, closed here (K1505 (10); reading J1 (1)). */
/** @type {readonly string[]} a party's role in a proceeding, `party_to`'s roles */
export const PARTY_ROLES = Object.freeze(["plaintiff", "defendant", "petitioner", "respondent", "appellant", "appellee",
  "cross_complainant", "cross_defendant", "intervenor", "real_party_in_interest", "amicus", "applicant", "protestant",
  "complainant", "interested_party", "other"]);
/** @type {Readonly<Record<string, readonly string[]>>} the closed role list of each kind that takes a role; a kind not
 *  here takes none */
export const ROLES = Object.freeze({
  reports_to: Object.freeze(["administrative", "functional", "budgetary"]),
  contracts_with: OCDS_PARTY_ROLES,
  party_to: PARTY_ROLES,
});

/* R2: the end kinds a kind is fixed to; every other kind takes any registered kinds. */
/** @type {Readonly<Record<string, Readonly<{from: string[]|null, to: string[], code: string}>>>} R2: the entity kinds
 *  each end of a fixed kind runs from and to (null: any registered kind) and the code a wrong end is refused with */
export const END_KINDS = Object.freeze({
  seat_on: Object.freeze({ from: ["office"], to: ["body"], code: "SEAT_ON_ENDS" }),
  party_to: Object.freeze({ from: null, to: ["proceeding"], code: "PROCEEDING_ENDS" }),
  appeal_of: Object.freeze({ from: ["proceeding"], to: ["proceeding"], code: "PROCEEDING_ENDS" }),
  consolidated_with: Object.freeze({ from: ["proceeding"], to: ["proceeding"], code: "PROCEEDING_ENDS" }),
  remanded_to: Object.freeze({ from: ["proceeding"], to: ["proceeding"], code: "PROCEEDING_ENDS" }),
});

/* The members' words for each kind (K1486): positions and memberships, never "knows", "network" or a measure. Each is
   read by DEC-253's key `label.linekinds.<kind>`; `holds` reads as the post held, with its capacity beside it. */
const WORDS = Object.fromEntries(LINE_KINDS.map((k) => [k, k === "holds" ? word("lines.holds.held_post") : word(`label.linekinds.${k}`)]));

/* R14: one connection kind per line kind, `holds` one per capacity. */
/** @type {string} the connection owner's name, `lines` (R14) */
export const OWNER = "lines";
const slug = (s) => s.replace(/ /g, "_");
/** R14: the connection kind of a line kind, `holds` one per capacity (absent is `other`).
 *  @param {string} kind
 *  @param {string|null} [capacity]
 *  @returns {string} `line:<kind>`, or `line:holds:<capacity, spaces as _>` */
export const connectionKind = (kind, capacity = null) =>
  (kind === "holds" ? `line:holds:${slug(capacity ?? "other")}` : `line:${kind}`);
/** @type {ReadonlyArray<Readonly<{kind: string, word: string, class: string}>>} R14: one evidentiary connection kind
 *  per line kind, `holds` one per capacity, each with the members' words for it (K1486) */
export const CONNECTION_KINDS = Object.freeze([
  ...LINE_KINDS.filter((k) => k !== "holds").map((k) => Object.freeze({ kind: connectionKind(k), word: WORDS[k], class: "evidentiary" })),
  ...CAPACITIES.map((c) => Object.freeze({ kind: connectionKind("holds", c), word: `${WORDS.holds} (${word(`label.linecapacities.${slug(c)}`)})`, class: "evidentiary" })),
]);
/** A connection kind back to its line kind and, for `holds`, its capacity; null for none of this owner's.
 *  @param {any} ck
 *  @returns {{kind: string, capacity: string|null}|null} */
export function lineKindOf(ck) {
  if (typeof ck !== "string" || !ck.startsWith("line:")) return null;
  const rest = ck.slice(5);
  if (rest.startsWith("holds:")) {
    const cap = CAPACITIES.find((c) => slug(c) === rest.slice(6));
    return cap ? { kind: "holds", capacity: cap } : null;
  }
  return LINE_KINDS.includes(rest) && rest !== "holds" ? { kind: rest, capacity: null } : null;
}
