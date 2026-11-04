/* docket — a published case's docket (requirements: `build/requirements/docket.md`; DEC-116, DEC-100; Publication
 * §5D; N520, K1256, K1257).
 *
 * After a case is published, the world responds without changing the case. Each case's docket holds dated entries
 * beside it, each naming the edition it concerns, on three shelves: `listed` (what the group stands behind as accurately
 * listed), `reactions` (reactions elsewhere) and `record` (in our record only). Any joined member files a record entry
 * (R1) and may mark it as a threat (R2); only the case's manager places an entry in public, prepared here and signed in
 * the browser with their registered key (`NS_DOCKET`), as a case and a working-on notice are: prepare, sign, post
 * (R4–R6). The manager may decline a submission containing redactions (R7) or list a reply naming a private person as
 * received (R8); grants of standing (R10), take-backs (R11) and the withdrawal of an edition (R12) are public entries
 * like any other. `coreDue` answers the manager's To-dos (R9). A court order addressed to the group is complied with
 * openly: captured, placed as a signed `court-order` entry, and each edition it names stamped by `publication` in the
 * post's own transaction (R25; K1480). The public shelves and a feed per case are answered for anybody to pull (R14,
 * R15), served by `public-read` (its R21), and the public entries' dates are offered to `events`' "what we did" lane
 * (R26). This module sends nothing anywhere, and no entry is ever evidence (R17, R20).
 *
 * A NEW MODULE (T27, layer 8, directly after `publication`). REACHED as `docketOf(host, deps)` (K61): one instance per
 * host. At creation it creates its tables, declares them to record-core's purge (whole store only, R16), registers its
 * figures (record-core R63) and its record entry ids' mint seed, fills `reevaluation`'s docket registration (R13) and
 * registers its event source with `events` (R26).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record        `transact`, `mintOpaqueId`, `registerMintSeed`, `declarePurge`, `registerCounts`, `readFile`,
 *                 `evidenceStore` (the evidence store's bytes, R14).
 *   membership    `sight` (R44), `isProjectOwner`, `isJoinedParticipant` (R54), `positionalMember`.
 *   credentials   `attestingKeys` (R11).
 *   promotion     the fact `producingGroup` (its R40).
 *   provenance    `homeOf`, and the `register` and `captured_locators` read contract (its R48).
 *   attestation   `attestationsOf` (its R7): a capture's co-archive.
 *   entities      `readEntity` (its R5): the subject's name.
 *   inquiry       `subjectEntityOf` (its R43): the named subjects.
 *   reevaluation  `registerDocket`, `docketActed` (its R30).
 *   publication   `stampEdition` (its R62, R25 here); its tables `cases`, `published_cases`, `published_case_members`
 *                 and `case_documents` under its R40.
 *   caseTensions  `case-tensions`' `caseTensions` (its R4, was `publication` R50; R9 (c)).
 *   events        `registerEventSource` (its R30; R26 here).
 *   projectRoster `projectScope` (its R23; R28 here, T45).
 *   now           the clock, milliseconds (default `env.BIO_NOW_MS`, else the wall clock).
 *
 * The words a member or reader sees (the shelves' labels, the outward-act warning, the invitation, the stamp) are the
 * UX design stream's; this module carries a code and a plain statement of meaning, never their final words. No place is
 * named here (R21). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { attestationOf } from "../attestation/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import * as publicationModule from "../publication/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { whatChangedOf } from "../case-grammar/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { verifySshsig, NS_DOCKET, docketStatement } from "../sshsig.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { DOCKET_CHECKS, rowOf } from "./checks.mjs";
import { DOCKET_TABLES, migrateDocket } from "./schema.mjs";
import { renderFeed, docketAddress, feedAddress, ATOM_MEDIA_TYPE } from "./feed.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { DOCKET_CHECKS, DOCKET_WORDS } from "./checks.mjs";
export { DOCKET_SCHEMA, DOCKET_TABLES } from "./schema.mjs";
export { docketAddress, feedAddress, feedHref, ATOM_MEDIA_TYPE, FEED_ID_PREFIX } from "./feed.mjs";

/* ---------------------------------------------------------------- the vocabularies and bounds */

/** R6 (DEC-124, K1365): the label a new public entry carries. */
export const ENTRY_FORMAT = "civicsmith-docket-entry/1";
/** R6: the label an entry published before T31 keeps with its bytes; the same format, accepted by every reader forever. */
export const LEGACY_ENTRY_FORMAT = "civicos-docket-entry/1";
/** R6: both labels of the one entry format. */
export const ENTRY_FORMATS = Object.freeze([ENTRY_FORMAT, LEGACY_ENTRY_FORMAT]);
/** R6: whether `label` names the docket entry format, under either label. */
export const isEntryFormat = (label) => ENTRY_FORMATS.includes(label);
export const SHELVES = Object.freeze(["listed", "reactions", "record"]);
export const PUBLIC_SHELVES = Object.freeze(["listed", "reactions"]);
export const RECORD_KINDS = Object.freeze(["response", "statement", "reaction", "outcome"]);       /* R1 */
export const ENTRY_KINDS = Object.freeze([...RECORD_KINDS, "edition", "disclosure", "withdrawal", "standing-granted",
  "standing-withdrawn", "receipt", "take-back", "court-order"]);                          /* R6, R25 */
/** R25: what a court order orders. */
export const ORDER_EFFECTS = Object.freeze(["remove", "redact", "seal", "unseal"]);
/** R25: the effects that name parts of an edition, and so require `parts`. */
export const PART_EFFECTS = Object.freeze(["redact", "seal", "unseal"]);
/** R11, R25: the kinds never taken back, each answered DOCKET_WITHDRAWAL_FINAL. */
export const FINAL_KINDS = Object.freeze(["withdrawal", "court-order"]);
export const FROM_KINDS = Object.freeze(["subject", "holder", "other"]);
export const PROPOSALS = Object.freeze(["record", "public", "both"]);                     /* R1 */
export const PRESSURE_KINDS = Object.freeze(["legal", "retaliation", "discrediting", "other"]);   /* R2: as `actions` R48's */
/** R1 (T45; N880, Actions D5, D20): what an `outcome` entry states it was. */
export const OUTCOME_KINDS = Object.freeze(["cure", "harm_addressed"]);
/** R32 (T53; K5558): the two fields an outcome states, named by its refusal. */
export const OUTCOME_FIELDS = Object.freeze(["outcome.kind", "outcome.on"]);
/** R32 (T53; K5558, J5 = A): what each kind a joined member files (`docketFile`, R1) needs, beside `case`. A response
 *  or statement is from the named subject or a holder of standing, a reaction from anyone else; an outcome adds its two
 *  fields and the member's summary. */
export const FILE_KIND_FIELDS = Object.freeze({
  response: Object.freeze(["edition", "from", "capture", "proposed", "reason"]),
  statement: Object.freeze(["edition", "from", "capture", "proposed", "reason"]),
  reaction: Object.freeze(["edition", "from", "capture", "proposed", "reason"]),
  outcome: Object.freeze(["edition", "from", "capture", "proposed", "reason", ...OUTCOME_FIELDS, "summary"]),
});
/** R32 (T53; K5558, J5 = A): what each kind the manager places directly (`docketPrepare`, then `docketPost`, R4, R5:
 *  one act, prepared, signed and posted) needs, beside `case`; no record entry is filed first. A correction is a
 *  `take-back` of an earlier public entry (R11), or the `edition` entry of a new edition (R9 (b), R33); a withdrawal
 *  (R12) and a court order (R25) each their own kind. The record kinds the manager places are the record entry's, named
 *  by `entry`. */
export const PLACE_KIND_FIELDS = Object.freeze({
  edition: Object.freeze(["edition"]),
  "take-back": Object.freeze(["edition", "takesBack", "reason"]),
  withdrawal: Object.freeze(["edition", "reason"]),
  "court-order": Object.freeze(["order.effect", "order.editions", "capture", "reason"]),
  "standing-granted": Object.freeze(["edition", "holder", "reason"]),
  "standing-withdrawn": Object.freeze(["edition", "grant", "reason"]),
  disclosure: Object.freeze(["edition", "candidate"]),
});
/** R27 (T45): the bounds of a page of pressure marks. */
export const MARKS_LIMIT_DEFAULT = 1000, MARKS_LIMIT_MAX = 1000;
/** R28 (T45; N892): the code a counsel matter's case is refused, `publication` R78's one row. */
export const COUNSEL_MATTER_CODE = "COUNSEL_MATTER_NOT_PUBLISHED";
export const FOUND_BY = Object.freeze(["paste", "watch"]);                                /* R1 */
export const RECORD_STATES = Object.freeze(["pending", "placed", "declined", "receipted", "taken-back"]);  /* R3 */
export const CORE_KINDS = Object.freeze(["response", "statement", "edition", "tension"]);  /* R9 */
/** `affordances` R34: the vocabularies this module owns. */
export const DOCKET_VOCABULARIES = Object.freeze({
  docket_shelves: SHELVES, docket_entry_kinds: ENTRY_KINDS, docket_proposals: PROPOSALS,
  docket_pressure_kinds: PRESSURE_KINDS,
});
export const REASON_MAX = 2000;        /* R1, DEC-88's */
export const NAME_MAX = 200;           /* R1 */
export const NOTE_MAX = 500;           /* R2 */
export const SUMMARY_MAX = 600;        /* R4 */
export const PART_MAX = 200;           /* R25: a part's name, one line; the part's reference, never its content */
export const EVENTS_LIMIT_DEFAULT = 100, EVENTS_LIMIT_MAX = 500;   /* R26: as `events` R27's bounds */
export const PREPARED_TTL_MS = 60 * 60 * 1000;   /* R4: `expires` */
/** R10: the prefix record entry ids are minted under (record-core R6). */
export const RECORD_ID_PREFIX = "DKT";
/** R8: the fixed head of a receipt's published reason; the manager's words follow it. */
export const RECEIPT_REASON = word("docket.names_private_person");
/** R15: what a citing copy says when it cannot read a docket (DEC-116 item 8). */
export const DOCKET_UNREADABLE = word("docket.read_publisher_docket");
/** R4: the outward-act warning, as a code and its meaning; its words are the UX design stream's. */
export const OUTWARD_ACT_WARNING = Object.freeze({
  code: "docket_outward_act",
  meaning: word("docket.public_see_entry"),
});
/** R8: the request to resend a reply without the private person's name, as a code and its meaning; its words are the
 *  UX design stream's, and this module sends nothing. */
export const RESEND_INVITATION = Object.freeze({
  code: "docket_resend_without_name",
  meaning: word("docket.reply_names_private"),
});
/** R3: the plan checkpoint a contesting entry offers; `action-plans`' own act, never performed here. */
export const CHECKPOINT_OFFER = Object.freeze({ code: "plan_checkpoint", act: "action-plans", performed: false });

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const words = (v, max) => typeof v === "string" && !!v.trim() && v.length <= max && !LONE_SURROGATE.test(v);
const oneLine = (v, max) => words(v, max) && !/[\n\r]/.test(v);
const oneParagraph = (v, max) => words(v, max) && !/\r?\n[ \t]*\r?\n/.test(v);
const parse = (s) => { if (s && typeof s === "object") return s; try { return JSON.parse(s); } catch { return null; } };
const int = (v) => { const n = Number(v); return v !== null && v !== "" && v !== undefined && Number.isInteger(n) ? n : null; };
const yes = (v) => v === true || v === "true" || v === "1" || v === 1;
const isSha = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const dayOf = (iso) => String(iso).slice(0, 10);
const td = new TextDecoder();
const b64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const publicId = (caseId, seq) => `${caseId}#${seq}`;
/* R6, R14 (T45): an entry's fields, its JSON parsed; an `outcome` entry published before T45, without `outcome`, reads
   `outcome: null` (the stored bytes, and so `json` and the digest, are untouched). */
const entryFields = (json) => {
  const f = parse(json);
  return f && typeof f === "object" && f.kind === "outcome" && !("outcome" in f) ? { ...f, outcome: null } : f;
};

/* DEC-49: a refusal of this module's own carries its code, its row and the member's translation; one another module
   answered passes through as it came. */
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string" || r.check) return r;
  const row = rowOf(r.reason);
  return row ? { ...r, code: r.code ?? r.reason, check: row.check, translation: row.translation } : r;
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, detail, ...(extra || {}) });
/** R1, R3, R4: the one answer for an absent case, a case with no ratified edition and one the viewer does not see. */
export const noSuchCase = (caseId) => ({ ok: false, reason: "NO_SUCH_CASE", case: str(caseId),
  detail: "no published case answers here by that id for you; an absent case, one never published and one you do not "
    + "see answer the same" });

/** R28 (T45): `publication` R78's row for a counsel matter, found by its code in publication's exported table (one code,
 *  one row; this module holds no copy), or null while publication exports none. */
export function counselMatterRow() {
  for (const [name, table] of Object.entries(publicationModule)) {
    if (!name.endsWith("_CHECKS") || !table || typeof table !== "object") continue;
    const flat = table[COUNSEL_MATTER_CODE];
    if (flat && typeof flat.check === "string") return flat;
    for (const fam of Object.values(table))
      if (fam && typeof fam === "object" && fam[COUNSEL_MATTER_CODE] && typeof fam[COUNSEL_MATTER_CODE].check === "string") return fam[COUNSEL_MATTER_CODE];
  }
  return null;
}

/* R1 (T45): a real calendar date `YYYY-MM-DD`, or null. */
const calendarDay = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
};

export class Docket {
  #held = new Map();       /* R4, R5: prepared answers, by member and digest, kept in memory: prepare writes nothing */
  #deps;

  constructor({ storage, record, membership, host = null, env = null, now = null, ...deps } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.env = env && typeof env === "object" ? env : {};
    this.now = typeof now === "function" ? now : null;
    this.#deps = { host, ...deps };
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get credentials() { return this.#deps.credentials ||= credentialsOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get promotion() { return this.#deps.promotion ||= promotionOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get provenance() { return this.#deps.provenance ||= provenanceOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get attestation() { return this.#deps.attestation ||= attestationOf(this.#deps.host, { record: this.record, provenance: this.provenance }); }
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get inquiry() { return this.#deps.inquiry ||= inquiryOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get reevaluation() { return this.#deps.reevaluation ||= reevaluationOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get publication() { return this.#deps.publication ||= publicationModule.publicationOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  /* R9 (c): `case-tensions` R4. */
  get caseTensions() { return this.#deps.caseTensions ||= caseTensionsOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get events() { return this.#deps.events ||= eventsOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  /* R28 (T45): `project-roster` R23. */
  get projectRoster() { return this.#deps.projectRoster ||= projectRosterOf(this.#deps.host, { record: this.record, membership: this.membership }); }

  migrate() { migrateDocket(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #call(fn, dflt = null) { try { return fn(); } catch { return dflt; } }
  #nowMs() {
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env.BIO_NOW_MS);
    return Number.isFinite(v) && v >= 0 ? v : Date.now();
  }
  #stamp(ms = this.#nowMs()) { return stampInstant("second", ms); }

  /* ================================================================ facts read from neighbours */

  /* The member an identity names, or null for a machine, an AI credential, an operator token or nobody (R18). */
  #member(identity) {
    if (!str(identity) || isMachineIdentity(identity)) return null;
    return this.#call(() => this.membership.positionalMember(null, String(identity).trim()));
  }
  #slug() {
    const f = this.#call(() => this.promotion.fact("producingGroup"));
    return f && f.ok && str(f.value) ? str(f.value) : null;
  }
  /* The case's ratified editions, `{edition, ratified_at}` in edition order (publication R40). */
  #editions(caseId) {
    return this.#call(() => this.#rows(`SELECT edition, ratified_at FROM published_cases WHERE case_id=? AND ratified_at IS NOT NULL
                                         ORDER BY edition`, caseId), [])
      .map((r) => ({ edition: Number(r.edition), ratified_at: r.ratified_at }));
  }
  /* A case holding a ratified edition, with its owning project; null otherwise. */
  #case(caseId) {
    const id = str(caseId);
    if (!id) return null;
    const c = this.#call(() => this.#one(`SELECT case_id, project_id FROM cases WHERE case_id=?`, id));
    if (!c) return null;
    const editions = this.#editions(id);
    return editions.length ? { case: id, project: str(c.project_id), editions } : null;
  }
  /* R1, R3, R4: the case as `viewer` may act on it, or `NO_SUCH_CASE`, the same answer for each way it is not. */
  #caseFor(caseId, viewer) {
    const c = this.#case(caseId);
    if (!c || !c.project || this.#call(() => this.membership.sight(c.project, viewer)) !== "full")
      return { refusal: noSuchCase(caseId) };
    return { c };
  }
  /* R28 (T45): a refusal when the case's owning project is a counsel matter at this act (`project-roster` R23), with
     `publication` R78's row; null otherwise. R23 never throws; should it, the act is refused (fail closed), never
     placed on a scope that could not be read. */
  #counselRefusal(c) {
    let scope;
    try { scope = this.projectRoster.projectScope(c.project); } catch { scope = { scope: "counsel_matter" }; }
    if (!scope || scope.scope !== "counsel_matter") return null;
    const row = counselMatterRow();
    return { ok: false, reason: COUNSEL_MATTER_CODE, code: COUNSEL_MATTER_CODE, ...(row ? { check: row.check, translation: row.translation } : {}),
             detail: "the case's project is a counsel matter, and nothing of a counsel matter is placed on a docket", case: c.case };
  }
  #isManager(project, member) { return !!project && !!member && this.#call(() => this.membership.isProjectOwner(project, member), false); }
  /* R1: each subject entity of the edition's member findings (inquiry R43). */
  #namedSubjects(caseId, edition) {
    const members = this.#call(() => this.#rows(`SELECT bundle_id FROM published_case_members WHERE case_id=? AND edition=?
                                                  ORDER BY ord`, caseId, edition), []);
    return new Set(members.map((m) => this.#call(() => this.inquiry.subjectEntityOf(m.bundle_id))).filter((s) => str(s)));
  }
  /* R13: the edition's member findings at their pins. */
  #pins(caseId, edition) {
    return this.#call(() => this.#rows(`SELECT bundle_id, version_sha FROM published_case_members WHERE case_id=? AND edition=?
                                         ORDER BY ord`, caseId, edition), [])
      .filter((m) => str(m.version_sha)).map((m) => ({ bundle_id: m.bundle_id, sha: m.version_sha }));
  }
  /* R6: the subject's canonical name as the registry holds it (entities R5). */
  #entityName(entityId) {
    const r = this.#call(() => this.entities.readEntity({ entityId }));
    const e = r && r.ok && r.found ? r.entity : null;
    if (!e) return entityId;
    const live = (e.aliases || []).filter((a) => !a.withdrawn);
    return (live.find((a) => a.canonical) || live[0] || {}).alias || str(e.label) || entityId;
  }

  /* R1, R4: what the record holds of a capture: whether the register holds it with an origin locator (provenance
     R48), its origin, its co-archive's locator (attestation R7) and whether its register entry was filed by a sweep
     (`acquisition` R21's `origin.kind: "sweep"`). */
  #capture(sha) {
    if (!isSha(sha)) return { held: false };
    const loc = this.#call(() => this.#one(
      `SELECT l.address FROM register r JOIN captured_locators l ON l.capture_sha = r.capture_sha
        WHERE r.capture_sha=? ORDER BY l.first_retrieved, l.address LIMIT 1`, sha));
    if (!loc) return { held: false };
    const att = this.#call(() => this.attestation.attestationsOf(sha));
    const co = att && att.ok && Array.isArray(att.attestations) ? att.attestations.find((a) => a.kind === "co_archive" && str(a.locator)) : null;
    let sweep = false;
    const home = this.#call(() => this.provenance.homeOf(sha));
    if (home) {
      const f = this.#call(() => this.record.readFile(home.bundleId, "data/provenance.json"));
      const reg = f && typeof f.text === "string" ? parse(f.text) : null;
      sweep = !!(reg && Array.isArray(reg.documents) && reg.documents.some((d) => d && typeof d === "object"
        && d.capture && String(d.capture.sha256 || "").replace(/^sha256:/, "") === sha
        && d.origin && typeof d.origin === "object" && d.origin.kind === "sweep"));
    }
    return { held: true, origin: loc.address, archived: co ? co.locator : null, found_by: sweep ? "watch" : "paste" };
  }

  /* ================================================================ the docket's own rows */

  #recordEntry(id) { return typeof id === "string" ? this.#one(`SELECT * FROM docket_record WHERE entry_id=?`, id) : null; }
  #marks(id) { return this.#rows(`SELECT * FROM docket_marks WHERE entry_id=? ORDER BY rn`, id); }
  #entries(caseId) { return this.#rows(`SELECT * FROM docket_entries WHERE case_id=? ORDER BY seq`, caseId); }
  #entry(caseId, seq) { return this.#one(`SELECT * FROM docket_entries WHERE case_id=? AND seq=?`, caseId, seq); }
  /* R11: each public entry a `take-back` names, by seq, with the take-back. */
  #takenBack(caseId) {
    const out = new Map();
    for (const e of this.#rows(`SELECT * FROM docket_entries WHERE case_id=? AND kind='take-back' ORDER BY seq`, caseId)) {
      const j = parse(e.json) || {};
      if (!out.has(j.takes_back)) out.set(j.takes_back, e);
    }
    return out;
  }
  /* R3: a record entry's state, with what settled it. */
  #recordState(id) {
    const pub = this.#one(`SELECT * FROM docket_entries WHERE record_entry=? ORDER BY published_at, seq LIMIT 1`, id);
    const marks = this.#marks(id);
    const decline = marks.find((m) => m.kind === "declined");
    const back = marks.find((m) => m.kind === "taken-back");
    if (pub) return { state: pub.kind === "receipt" ? "receipted" : "placed", pub };
    if (decline) return { state: "declined", decline };
    if (back) return { state: "taken-back", back };
    return { state: "pending" };
  }
  /* R10: a grant (a `standing-granted` entry of the case, by seq), with when it began and when it ended. */
  #grant(caseId, seq) {
    const n = int(seq);
    const g = n === null ? null : this.#entry(caseId, n);
    if (!g || g.kind !== "standing-granted") return null;
    const end = this.#rows(`SELECT * FROM docket_entries WHERE case_id=? AND kind='standing-withdrawn' ORDER BY seq`, caseId)
      .find((e) => (parse(e.json) || {}).answers === n);
    return { seq: n, holder: (parse(g.json) || {}).holder ?? null, granted_at: g.published_at, ended_at: end ? end.published_at : null };
  }
  /* R10: live at `at` from its post until a `standing-withdrawn` entry ends it; a submission filed at or before the end
     keeps the grant's rights. */
  #liveAt(grant, at) { return !!grant && grant.granted_at <= at && (!grant.ended_at || at <= grant.ended_at); }
  /* R12: each edition a withdrawal fixed at its post, by number. */
  #withdrawn(caseId) {
    const out = new Map();
    for (const e of this.#rows(`SELECT * FROM docket_entries WHERE case_id=? AND kind='withdrawal' ORDER BY seq`, caseId))
      for (const ed of parse(e.editions) || []) if (!out.has(ed)) out.set(ed, e);
    return out;
  }

  /* R25: the case's court-order entries, oldest first, each with its order as signed and the editions fixed at its post. */
  #orders(caseId) {
    return this.#rows(`SELECT * FROM docket_entries WHERE case_id=? AND kind='court-order' ORDER BY seq`, caseId).map((e) => {
      const j = parse(e.json) || {};
      return { row: e, json: j, order: j.order && typeof j.order === "object" ? j.order : {}, editions: parse(e.editions) || [] };
    });
  }

  /* ================================================================ R1: filing to the record */

  /* R1's caller refusals: the machine, the case, the participant. */
  #filerRefusal({ case: caseId, author, viewer }) {
    const member = this.#member(author);
    /* DEC-49 REGION is-docket-filer */
    if (!member)
      return { refusal: refuse("MACHINE_CANNOT_FILE_DOCKET", str(author)
        ? "a docket entry is filed by a member signed in as themselves, and this caller is not one"
        : "no member is named as the one filing: this call carries nobody") };
    /* END DEC-49 REGION is-docket-filer */
    const k = this.#caseFor(caseId, str(viewer) || str(author));
    if (k.refusal) return k;
    /* K4557, K231: one condition, one code: a member not yet joined (invited, or with no part) is refused with membership's
       own PROJECT_ACT_NOT_A_PARTICIPANT, whose words say to join, relayed as it answers. */
    const denied = this.membership.projectAuthority(k.c.project, String(author).trim(), "joined", "docketfile");
    if (denied) return { refusal: denied };
    const counsel = this.#counselRefusal(k.c);
    if (counsel) return { refusal: counsel };
    return { c: k.c, member };
  }

  /* R1's form checks, in R1's order, never merit; `at` the instant a holder's grant must be live at (the filing's).
     Answers the entry's fields or a refusal. Also R4's re-check of a record entry it would sign. */
  #formRefusal(c, { edition, from, capture, kind, proposed, reason, answers, contests, outcome, summary }, at) {
    const f = parse(from);
    const ed = int(edition);
    /* DEC-49 REGION is-docket-form */
    if (ed === null || !c.editions.some((e) => e.edition === ed))
      return { refusal: refuse("DOCKET_NO_EDITION", "the edition named is not a ratified edition of this case",
                               { editions: c.editions.map((e) => e.edition), fields: ["edition"] }) };
    if (!f || typeof f !== "object" || !FROM_KINDS.includes(f.kind))
      return { refusal: refuse("DOCKET_NOT_ATTRIBUTED", "from is {kind: subject, entity}, {kind: holder, grant} or {kind: other, name}",
                                              { fields: ["from"] }) };
    let fromRow;
    if (f.kind === "subject") {
      const entity = str(f.entity);
      if (!entity || !this.#namedSubjects(c.case, ed).has(entity))
        return { refusal: refuse("DOCKET_NOT_THE_SUBJECT", `the entity named is not a subject of edition ${ed}`, { edition: ed, fields: ["from.entity"] }) };
      fromRow = { kind: "subject", entity };
    } else if (f.kind === "holder") {
      const grant = this.#grant(c.case, f.grant);
      if (!this.#liveAt(grant, at))
        return { refusal: refuse("DOCKET_NO_STANDING", "the grant named is not a grant of standing on this docket live at the filing",
                                 { grant: int(f.grant), fields: ["from.grant"] }) };
      fromRow = { kind: "holder", grant: grant.seq };
    } else {
      if (!oneLine(f.name, NAME_MAX))
        return { refusal: refuse("DOCKET_NOT_ATTRIBUTED", `the source's name is one line of 1 to ${NAME_MAX} characters`, { fields: ["from.name"] }) };
      fromRow = { kind: "other", name: f.name.trim() };
    }
    const cap = this.#capture(capture);
    if (!cap.held)
      return { refusal: refuse("DOCKET_NO_CAPTURE", "the capture named is not one the register holds with its origin locator",
                               { capture: typeof capture === "string" ? capture : null, fields: ["capture"] }) };
    const fits = { response: ["subject", "holder"], statement: ["subject", "holder"], reaction: ["other"], outcome: FROM_KINDS };
    if (!RECORD_KINDS.includes(kind) || !fits[kind].includes(fromRow.kind))
      return { refusal: refuse("DOCKET_KIND_UNKNOWN", "a response or statement is from the subject or a holder, a reaction "
        + "from anyone else, an outcome from anyone", { kind: typeof kind === "string" ? kind : null, from: fromRow.kind, fields: ["kind", "from"] }) };
    let answering = null;
    if (answers !== undefined && answers !== null && answers !== "") {
      const r = this.#recordEntry(str(answers));
      if (!r || r.case_id !== c.case || this.#recordState(r.entry_id).state !== "receipted")
        return { refusal: refuse("NO_SUCH_DOCKET_ENTRY", "answers names no receipted record entry of this case", { answers: str(answers), fields: ["answers"] }) };
      answering = r.entry_id;
    }
    if (!PROPOSALS.includes(proposed) || !words(reason, REASON_MAX))
      return { refusal: refuse("DOCKET_NO_REASON", `proposed is record, public or both, with a reason of 1 to ${REASON_MAX} characters`,
                                 { fields: PROPOSALS.includes(proposed) ? ["reason"] : words(reason, REASON_MAX) ? ["proposed"] : ["proposed", "reason"] }) };
    /* R1 (T45): an outcome states what it was and when, no later than the filing's day, with the member's summary; no
       other kind states an outcome. */
    const stated = outcome !== undefined && outcome !== null && outcome !== "";
    let outcomeRow = null;
    if (kind === "outcome") {
      const o = parse(outcome);
      const on = o && typeof o === "object" ? calendarDay(o.on) : null;
      if (!o || typeof o !== "object" || !OUTCOME_KINDS.includes(o.kind) || !on || on > dayOf(at))
        return { refusal: refuse("DOCKET_OUTCOME_UNREADABLE", `an outcome states {kind, on}: kind ${OUTCOME_KINDS.join(" or ")}, on a calendar `
          + `date no later than the filing's day (${dayOf(at)})`, { kind: o && typeof o.kind === "string" ? o.kind : null, fields: OUTCOME_FIELDS }) };
      if (!oneParagraph(summary, SUMMARY_MAX))
        return { refusal: refuse("DOCKET_NO_SUMMARY", `an outcome carries the member's summary, one paragraph of 1 to ${SUMMARY_MAX} characters`,
                                 { fields: ["summary"] }) };
      outcomeRow = { kind: o.kind, on };
    } else if (stated) {
      return { refusal: refuse("DOCKET_OUTCOME_UNREADABLE", `only an outcome states an outcome, and this entry is a ${kind}`, { kind, fields: ["outcome"] }) };
    }
    /* END DEC-49 REGION is-docket-form */
    return { fields: { edition: ed, from: fromRow, capture: cap, kind, proposed, reason, answers: answering, contests: yes(contests),
                       outcome: outcomeRow, summary: outcomeRow || oneParagraph(summary, SUMMARY_MAX) ? summary.trim() : null } };
  }

  /** R1, R11, R13: files a record entry, or, with `takesBack`, takes an earlier record entry back with a reason. */
  docketFile({ case: caseId = null, edition = null, kind = null, from = null, capture = null, contests = false,
               proposed = null, reason = null, answers = null, takesBack = null, outcome = null, summary = null, author = null,
               viewer = null } = {}) {
    const nowMs = this.#nowMs(), at = this.#stamp(nowMs);
    const k = this.#filerRefusal({ case: caseId, author, viewer });
    if (k.refusal) return k.refusal;
    const { c, member } = k;
    if (takesBack !== null && takesBack !== undefined && takesBack !== "") return this.#takeBackRecord(c, member, takesBack, reason, at);
    const v = this.#formRefusal(c, { edition, from, capture, kind, proposed, reason, answers, contests, outcome, summary }, at);
    if (v.refusal) return v.refusal;
    const x = v.fields;
    let id = null;
    const out = this.record.transact(() => {
      id = this.record.mintOpaqueId(RECORD_ID_PREFIX, at.slice(0, 4), "", (y) => !!this.#recordEntry(y));
      if (!id) return { ok: false, reason: "MINT_EXHAUSTED", detail: "no free record entry id could be drawn; nothing was filed" };
      this.sql.exec(`INSERT INTO docket_record (entry_id, case_id, edition, kind, from_json, capture_sha, contests, proposed, reason,
                                                answers, found_by, author, filed_at, outcome_json, summary)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    id, c.case, x.edition, x.kind, JSON.stringify(x.from), capture, x.contests ? 1 : 0, x.proposed, x.reason,
                    x.answers, x.capture.found_by, member, at, x.outcome ? JSON.stringify(x.outcome) : null, x.summary);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    /* R13: a contesting filing is told to reevaluation after it commits; a throw there never undoes it. */
    if (x.contests) this.#call(() => this.reevaluation.docketActed({ kind: "contested", case: c.case, entry: id }));
    return { ok: true, entry: id, case: c.case, edition: x.edition, kind: x.kind, shelf: "record", found_by: x.capture.found_by,
             contests: x.contests, filed_at: at, ...(x.outcome ? { outcome: x.outcome } : {}), ...(x.summary ? { summary: x.summary } : {}) };
  }

  /* R11: a record entry taken back by a later record act with a reason; it then reads `taken-back`. */
  #takeBackRecord(c, member, takesBack, reason, at) {
    const id = str(takesBack);
    const r = this.#entryRefusal(c.case, id);
    if (r) return r;
    /* DEC-49 REGION is-docket-form */
    if (!words(reason, REASON_MAX))
      return refuse("DOCKET_NO_REASON", `a take-back carries a reason of 1 to ${REASON_MAX} characters`);
    /* END DEC-49 REGION is-docket-form */
    const out = this.record.transact(() => {
      if (this.#recordState(id).state !== "pending")
        return refuse("DOCKET_ENTRY_SETTLED", "the entry was settled meanwhile", { entry: id });
      this.sql.exec(`INSERT INTO docket_marks (entry_id, kind, reason, by_member, at) VALUES (?,?,?,?,?)`, id, "taken-back", reason, member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, entry: id, case: c.case, state: "taken-back", taken_back: { reason, at } };
  }

  /* R4, R7, R11: a record entry of the case, still pending; null when it is. */
  #entryRefusal(caseId, id) {
    const r = this.#recordEntry(id);
    /* DEC-49 REGION is-docket-entry */
    if (!r || r.case_id !== caseId)
      return refuse("NO_SUCH_DOCKET_ENTRY", "no record entry of this case answers by that id", { entry: id });
    const s = this.#recordState(id);
    if (s.state !== "pending")
      return refuse("DOCKET_ENTRY_SETTLED", `the entry is already ${s.state}`, { entry: id, state: s.state });
    /* END DEC-49 REGION is-docket-entry */
    return null;
  }

  /* ================================================================ R2: the pressure mark */

  /** R2: marks a record entry as a threat; appended, never rewriting the entry. */
  docketPressure({ entry = null, pressure = null, author = null, viewer = null } = {}) {
    const member = this.#member(author);
    const id = str(entry);
    const r = this.#recordEntry(id);
    const p = parse(pressure);
    /* DEC-49 REGION is-docket-pressure */
    if (!member)
      return refuse("MACHINE_CANNOT_MARK_DOCKET_PRESSURE", "a docket entry is marked by a member signed in as themselves");
    const c = r ? this.#case(r.case_id) : null;
    if (!r || !c || !c.project || this.#call(() => this.membership.sight(c.project, str(viewer) || str(author))) !== "full")
      return refuse("NO_SUCH_DOCKET_ENTRY", "no record entry you see answers by that id", { entry: id });
    /* K4557: a mark is a weighty act of the project, so it is a joined member's: sight first, then this, then the entry's own
       conditions. Membership's refusal is relayed as it answers (K231). */
    const denied = this.membership.projectAuthority(c.project, String(author).trim(), "joined", "docketpressure");
    if (denied) return denied;
    if (this.#marks(id).some((m) => m.kind === "pressure"))
      return refuse("DOCKET_PRESSURE_MARKED", "the entry is already marked", { entry: id });
    const note = p && typeof p === "object" && p.note !== undefined && p.note !== null && p.note !== "" ? p.note : null;
    if (!p || typeof p !== "object" || !PRESSURE_KINDS.includes(p.kind) || (note !== null && !words(note, NOTE_MAX)))
      return refuse("DOCKET_PRESSURE_REFUSED", `kind is one of ${PRESSURE_KINDS.join(", ")}, with a note of at most ${NOTE_MAX} characters`);
    /* END DEC-49 REGION is-docket-pressure */
    const at = this.#stamp();
    const out = this.record.transact(() => {
      if (this.#marks(id).some((m) => m.kind === "pressure")) return refuse("DOCKET_PRESSURE_MARKED", "the entry was marked meanwhile", { entry: id });
      this.sql.exec(`INSERT INTO docket_marks (entry_id, kind, pressure, note, by_member, at) VALUES (?,?,?,?,?,?)`,
                    id, "pressure", p.kind, note, member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, entry: id, pressure: { kind: p.kind, note, at } };
  }

  /* ================================================================ R4–R6: placing in public, signed */

  /* R4's caller refusals: the machine, the case, the manager, the slug. */
  #managerRefusal({ case: caseId, by, viewer }) {
    const member = this.#member(by);
    /* DEC-49 REGION is-docket-manager */
    if (!member)
      return { refusal: refuse("MACHINE_CANNOT_PLACE_DOCKET", str(by)
        ? "a public docket entry is placed by the case's manager signed in as themselves, and this caller is not one"
        : "no member is named as the one acting: this call carries nobody") };
    /* END DEC-49 REGION is-docket-manager */
    const k = this.#caseFor(caseId, str(viewer) || str(by));
    if (k.refusal) return k;
    /* DEC-49 REGION is-docket-manager */
    if (!this.#isManager(k.c.project, member))
      return { refusal: refuse("DOCKET_NOT_THE_MANAGER", "only an owner of the case's project manages its public docket", { case: k.c.case }) };
    /* END DEC-49 REGION is-docket-manager */
    const counsel = this.#counselRefusal(k.c);
    if (counsel) return { refusal: counsel };
    /* DEC-49 REGION is-docket-manager */
    const slug = this.#slug();
    if (!slug) return { refusal: refuse("DOCKET_NO_GROUP_SLUG",
      localize("docket.index.no_team_slug_recorded", "no team slug is recorded, and there are no anonymous entries")) };
    /* END DEC-49 REGION is-docket-manager */
    return { c: k.c, member, slug };
  }

  /* R4's kind refusals (R7, R8, R10–R12), the shelf and a reaction's summary and archive copy. Answers the fields the
     entry carries by kind. */
  #kindRefusal(c, kind, a, rec, recFields) {
    const reasonOk = (req) => (req ? words(a.reason, REASON_MAX) : a.reason === null || a.reason === undefined || a.reason === "" || words(a.reason, REASON_MAX));
    const out = {};
    const ed = a.edition === "all" ? "all" : int(a.edition);
    /* DEC-49 REGION is-docket-form */
    if (rec) {
      if (a.edition !== null && a.edition !== undefined && a.edition !== "" && ed !== Number(rec.edition))
        return { refusal: refuse("DOCKET_NO_EDITION", `the record entry concerns edition ${rec.edition}`, { edition: Number(rec.edition), fields: ["edition"] }) };
      out.edition = Number(rec.edition);
    } else {
      if (ed === null || (ed === "all" ? !["withdrawal", "court-order"].includes(kind) : !c.editions.some((e) => e.edition === ed)))
        return { refusal: refuse("DOCKET_NO_EDITION", "the edition named is not a ratified edition of this case",
                                 { editions: c.editions.map((e) => e.edition), fields: ["edition"] }) };
      out.edition = ed;
    }
    if (kind === "edition" && !(out.edition > 1))
      return { refusal: refuse("DOCKET_NO_EDITION", "an edition entry names a ratified edition above 1", { fields: ["edition"] }) };
    if (kind === "standing-granted" && !oneLine(a.holder, NAME_MAX))
      return { refusal: refuse("DOCKET_NOT_ATTRIBUTED", `a grant names its holder in one line of 1 to ${NAME_MAX} characters`, { fields: ["holder"] }) };
    const needsReason = ["withdrawal", "standing-granted", "standing-withdrawn", "take-back", "receipt", "court-order"].includes(kind);
    if (!reasonOk(needsReason))
      return { refusal: refuse("DOCKET_NO_REASON", `${needsReason ? "this kind carries" : "a reason given is"} a reason of 1 to ${REASON_MAX} characters`,
                                 { fields: ["reason"] }) };
    /* END DEC-49 REGION is-docket-form */
    /* DEC-49 REGION is-docket-kind */
    if (kind === "receipt") {
      const f = recFields.from;
      if (!["response", "statement"].includes(rec.kind) || !["subject", "holder"].includes(f.kind))
        return { refusal: refuse("DOCKET_NO_STANDING", "a receipt lists only a reply from the subject or from someone granted standing") };
    }
    if (kind === "standing-withdrawn") {
      const g = this.#grant(c.case, a.grant);
      if (!g) return { refusal: refuse("NO_SUCH_DOCKET_ENTRY", "grant names no grant of standing on this docket", { grant: int(a.grant), fields: ["grant"] }) };
      if (g.ended_at) return { refusal: refuse("DOCKET_NO_STANDING", "that grant has already ended", { grant: g.seq }) };
      out.grant = g;
    }
    if (kind === "take-back") {
      const n = int(a.takesBack);
      const t = n === null ? null : this.#entry(c.case, n);
      if (!t) return { refusal: refuse("NO_SUCH_DOCKET_ENTRY", "takesBack names no public entry of this case", { takes_back: n, fields: ["takesBack"] }) };
      if (FINAL_KINDS.includes(t.kind))
        return { refusal: refuse("DOCKET_WITHDRAWAL_FINAL", t.kind === "court-order" ? "a court order is never taken back: a later order is a "
          + "new entry" : "a withdrawal is never lifted", { takes_back: n, kind: t.kind }) };
      if (t.kind === "take-back") return { refusal: refuse("DOCKET_TAKE_BACK_FINAL", "a take-back is never taken back", { takes_back: n }) };
      if (this.#takenBack(c.case).has(n)) return { refusal: refuse("DOCKET_ENTRY_SETTLED", "that entry is already taken back", { takes_back: n }) };
      out.takes_back = n;
    }
    if (kind === "disclosure") {
      const cand = str(a.candidate);
      if (!cand) return { refusal: refuse("NO_SUCH_DOCKET_ENTRY", "a disclosure names the candidate it discloses", { fields: ["candidate"] }) };
      out.candidate = cand;
    }
    if (kind === "withdrawal") {
      const withdrawn = this.#withdrawn(c.case);
      const named = out.edition === "all" ? c.editions.map((e) => e.edition) : [out.edition];
      if (named.every((e) => withdrawn.has(e)))
        return { refusal: refuse("DOCKET_ALREADY_WITHDRAWN", out.edition === "all" ? "every ratified edition is already withdrawn"
          : `edition ${out.edition} is already withdrawn`, { edition: out.edition }) };
    }
    const shelf = kind === "reaction" ? "reactions" : "listed";
    if (a.shelf !== shelf)
      return { refusal: refuse("DOCKET_WRONG_SHELF", `a ${kind} goes on ${shelf}`, { shelf: typeof a.shelf === "string" ? a.shelf : null, fields: ["shelf"] }) };
    const hasSummary = a.summary !== null && a.summary !== undefined && a.summary !== "";
    if ((shelf === "reactions" || hasSummary) && !oneParagraph(a.summary, SUMMARY_MAX))
      return { refusal: refuse("DOCKET_NO_SUMMARY", `a summary is one paragraph of 1 to ${SUMMARY_MAX} characters`, { fields: ["summary"] }) };
    if (shelf === "reactions" && !recFields.capture.archived)
      return { refusal: refuse("DOCKET_NO_ARCHIVE_COPY", "the capture's co-archive has not succeeded; ask it again (op=reattest)",
                               { capture: rec.capture_sha, fields: ["capture"] }) };
    /* END DEC-49 REGION is-docket-kind */
    out.shelf = shelf;
    return { out };
  }

  /* R25: a court order's own form, in R1's order (the editions it names, its capture, its reason), then its kind's own
     refusals (what it orders and the parts it names; an unsealing of nothing sealed). Answers the order as the entry
     carries it, the entry's R6 `edition` (the one edition named, `all`, or of several the highest, the order carrying
     every one) and the capture. */
  #orderRefusal(c, { order, capture, reason }) {
    const o = parse(order);
    const raw = o && typeof o === "object" ? o.editions : null;
    let editions = null;
    if (raw === "all") editions = "all";
    else if (Array.isArray(raw) && raw.length) {
      const eds = raw.map(int);
      if (eds.every((e) => e !== null && c.editions.some((x) => x.edition === e))) editions = [...new Set(eds)].sort((a, b) => a - b);
    }
    /* DEC-49 REGION is-docket-form */
    if (!editions)
      return { refusal: refuse("DOCKET_NO_EDITION", "a court order names the ratified editions of this case it concerns, or all",
                               { editions: c.editions.map((e) => e.edition), fields: ["order.editions"] }) };
    /* END DEC-49 REGION is-docket-form */
    const cap = this.#capture(capture);
    /* DEC-49 REGION is-docket-form */
    if (!cap.held)
      return { refusal: refuse("DOCKET_NO_CAPTURE", "a court order is placed with the order itself captured, its origin locator held",
                               { capture: typeof capture === "string" ? capture : null, fields: ["capture"] }) };
    if (!words(reason, REASON_MAX))
      return { refusal: refuse("DOCKET_NO_REASON", `a court order carries the manager's reason of 1 to ${REASON_MAX} characters`, { fields: ["reason"] }) };
    /* END DEC-49 REGION is-docket-form */
    const effect = o.effect;
    const hasParts = o.parts !== undefined && o.parts !== null;
    const partsOk = Array.isArray(o.parts) && o.parts.length > 0 && o.parts.every((x) => oneLine(x, PART_MAX))
      && new Set(o.parts.map((x) => x.trim())).size === o.parts.length;
    /* DEC-49 REGION is-docket-order */
    if (!ORDER_EFFECTS.includes(effect) || (PART_EFFECTS.includes(effect) && !hasParts) || (hasParts && !partsOk))
      return { refusal: refuse("DOCKET_ORDER_UNREADABLE", `effect is one of ${ORDER_EFFECTS.join(", ")}; to ${PART_EFFECTS.join(", ")}, `
        + `parts are the distinct parts of the edition it names, each one line of 1 to ${PART_MAX} characters`,
        { effect: typeof effect === "string" ? effect : null,
          fields: !ORDER_EFFECTS.includes(effect) ? ["order.effect"] : ["order.parts"] }) };
    const parts = hasParts ? o.parts.map((x) => x.trim()) : null;
    if (effect === "unseal") {
      const sealed = new Set(this.#orders(c.case).filter((x) => x.order.effect === "seal").flatMap((x) => x.order.parts || []));
      const none = parts.filter((x) => !sealed.has(x));
      if (none.length)
        return { refusal: refuse("DOCKET_NOTHING_SEALED", "an unsealing order names a part no sealing order of this case names", { parts: none }) };
    }
    /* END DEC-49 REGION is-docket-order */
    return { order: { effect, editions, ...(parts ? { parts } : {}) }, edition: editions === "all" ? "all" : editions[editions.length - 1], capture: cap };
  }

  /* R6: the name an entry is from, as the registry holds it, as granted, or as filed. */
  #fromName(caseId, from) {
    if (from.kind === "subject") return this.#entityName(from.entity);
    if (from.kind === "holder") return this.#grant(caseId, from.grant)?.holder ?? null;
    return from.name;
  }

  /** R4, R6: the entry that would be published, and nothing changed. */
  docketPrepare({ case: caseId = null, kind = null, shelf = null, edition = null, entry = null, summary = null, reason = null,
                  holder = null, takesBack = null, candidate = null, grant = null, order = null, capture = null, viewer = null,
                  by = null } = {}) {
    const nowMs = this.#nowMs();
    const k = this.#managerRefusal({ case: caseId, by, viewer });
    if (k.refusal) return k.refusal;
    const { c, member, slug } = k;
    const placing = RECORD_KINDS.includes(kind) || kind === "receipt";
    let rec = null, recFields = null, ordered = null;
    if (kind === "court-order") {
      /* R25: the captured order itself, with no record entry; then R4's shelf and the kind's checks as any entry's */
      const o = this.#orderRefusal(c, { order, capture, reason });
      if (o.refusal) return o.refusal;
      ordered = o;
      edition = o.edition;
    } else if (placing) {
      rec = this.#recordEntry(str(entry));
      const r = this.#entryRefusal(c.case, str(entry));
      if (r) return r;
      /* R1's form checks again, on the entry it would sign; a holder's grant at the filing. */
      const v = this.#formRefusal(c, { edition: rec.edition, from: rec.from_json, capture: rec.capture_sha,
                                       kind: rec.kind, proposed: rec.proposed, reason: rec.reason, answers: rec.answers,
                                       contests: rec.contests, outcome: rec.outcome_json, summary: rec.summary }, rec.filed_at);
      if (v.refusal) return v.refusal;
      recFields = v.fields;
      /* DEC-49 REGION is-docket-form */
      if (kind !== "receipt" && kind !== rec.kind)
        return refuse("DOCKET_KIND_UNKNOWN", `the record entry is a ${rec.kind}`, { kind });
      /* END DEC-49 REGION is-docket-form */
    } else if (!ENTRY_KINDS.includes(kind)) {
      /* DEC-49 REGION is-docket-form */
      return refuse("DOCKET_KIND_UNKNOWN", `kind is one of ${ENTRY_KINDS.join(", ")}`, { kind: typeof kind === "string" ? kind : null });
      /* END DEC-49 REGION is-docket-form */
    }
    /* R4: the shelf is a function of the kind, so a caller that names none (the screens' prepare names a case, an entry and
       its kind) is answered the kind's own shelf; one that names another is still refused DOCKET_WRONG_SHELF. */
    const shelfOf = shelf === null || shelf === undefined || shelf === "" ? (kind === "reaction" ? "reactions" : "listed") : shelf;
    /* R1, R4 (K5148): the summary filed with the entry is the default when the prepare names none. */
    if (kind !== "outcome" && !str(summary) && rec && rec.summary) summary = rec.summary;
    const kr = this.#kindRefusal(c, kind, { shelf: shelfOf, edition, summary: kind === "outcome" ? null : summary, reason, holder, takesBack,
                                            candidate, grant }, rec, recFields);
    if (kr.refusal) return kr.refusal;
    const x = kr.out;
    const prior = this.#one(`SELECT seq, digest FROM docket_entries WHERE case_id=? ORDER BY seq DESC LIMIT 1`, c.case);
    const seq = prior ? Number(prior.seq) + 1 : 1;
    const date = dayOf(this.#stamp(nowMs));
    /* R6: exactly these fields; no member's name, handle or id. */
    const json = { format: ENTRY_FORMAT, group: slug, case: c.case, seq, previous: prior ? prior.digest : null,
                   shelf: x.shelf, kind, edition: x.edition, date };
    if (placing) {
      json.received = dayOf(rec.filed_at);
      json.from = this.#fromName(c.case, recFields.from);
      if (kind === "receipt") json.reason = `${RECEIPT_REASON}: ${reason.trim()}`;
      else json.capture = { sha256: rec.capture_sha, origin: recFields.capture.origin, archived: recFields.capture.archived };
      if (kind !== "receipt" && rec.answers) {
        const receipt = this.#recordState(rec.answers).pub;
        if (receipt) json.answers = Number(receipt.seq);
      }
    }
    /* R6 (T45): an outcome carries its outcome and summary as filed; every other kind the manager's summary, if any. */
    if (kind === "outcome") { json.outcome = recFields.outcome; json.summary = recFields.summary; }
    else if (str(summary)) json.summary = summary.trim();
    if (kind === "edition") {
      const doc = this.#call(() => this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`,
                                             c.case, x.edition));
      const p = doc ? this.#call(() => parseFrontmatter(doc.text)) : null;
      json.what_changed = p ? (this.#call(() => whatChangedOf(p.data, p.body)) || {}).statement ?? null : null;
    }
    if (kind === "disclosure") json.answers = x.candidate;
    if (kind === "standing-granted") json.holder = holder.trim();
    if (kind === "standing-withdrawn") { json.holder = x.grant.holder; json.answers = x.grant.seq; }
    if (kind === "take-back") json.takes_back = x.takes_back;
    if (ordered) {
      json.capture = { sha256: capture, origin: ordered.capture.origin, archived: ordered.capture.archived };
      json.order = ordered.order;
    }
    if (kind !== "receipt" && str(reason)) json.reason = reason.trim();
    const text = canonicalJson(json);
    const digest = sha256HexSync(text);
    const key = `${member}\u0000${digest}`;
    const held = this.#held.get(key);
    /* R4: the same inputs answer byte for byte. Two record entries can sign to the same bytes (the entry names no record
       id); the later prepare then holds the digest, so a post places the entry last prepared, never another. */
    if (held && held.expiresMs > nowMs && held.record === (rec ? rec.entry_id : null)) return held.answer;
    const expiresMs = nowMs + PREPARED_TTL_MS;
    const answer = { ok: true, entry: text, digest, statement: td.decode(docketStatement(c.case, seq, digest)),
                     warning: OUTWARD_ACT_WARNING, expires: this.#stamp(expiresMs) };
    this.#held.set(key, { answer, expiresMs, case: c.case, seq, previous: json.previous, json, text, digest, kind,
                          record: rec ? rec.entry_id : null, edition: x.edition, order: ordered ? ordered.order : null });
    return answer;
  }

  /** R5: publishes the entry `by` prepared, with its signature. */
  async docketPost({ digest = null, signature = null, acknowledged = null, by = null, viewer = null } = {}) {
    const nowMs = this.#nowMs();
    const member = this.#member(by);
    const held = member ? this.#held.get(`${member}\u0000${str(digest)}`) : null;
    if (!member) {
      /* DEC-49 REGION is-docket-manager */
      return refuse("MACHINE_CANNOT_PLACE_DOCKET", "a public docket entry is posted by the case's manager signed in as themselves");
      /* END DEC-49 REGION is-docket-manager */
    }
    if (held) {
      const k = this.#managerRefusal({ case: held.case, by, viewer });
      if (k.refusal) return k.refusal;
    }
    /* DEC-49 REGION is-docket-post */
    if (acknowledged !== true)
      return refuse("DOCKET_WARNING_NOT_ACKNOWLEDGED", "acknowledged must be exactly true: the warning was read");
    if (!held || held.expiresMs <= nowMs)
      return refuse("DOCKET_STALE", "no prepared entry from you with this digest is held, or it has expired: prepare again");
    const moved = () => {
      const last = this.#one(`SELECT seq, digest FROM docket_entries WHERE case_id=? ORDER BY seq DESC LIMIT 1`, held.case);
      return (last ? Number(last.seq) : 0) !== held.seq - 1 || (last ? last.digest : null) !== held.previous
        || (held.record && this.#recordState(held.record).state !== "pending");
    };
    if (moved()) return refuse("DOCKET_STALE", "the docket moved since this was prepared: prepare again", { seq: held.seq });
    const keys = (this.#call(() => this.credentials.attestingKeys(), []) || []).filter((k) => k.member_id === member).map((k) => k.key_b64);
    const v = await verifySshsig(String(signature ?? ""), docketStatement(held.case, held.seq, held.digest), NS_DOCKET, keys);
    if (!v.ok) return refuse("DOCKET_SIGNATURE_REFUSED", `the signature was refused: ${v.reason}`, { verifier: v.reason });
    /* END DEC-49 REGION is-docket-post */
    const at = this.#stamp(nowMs);
    /* R12, R25: the editions an act names, fixed at its post (`all` is every edition ratified then). */
    const fixed = held.kind === "withdrawal"
      ? (held.edition === "all" ? this.#editions(held.case).map((e) => e.edition) : [held.edition])
          .filter((e) => !this.#withdrawn(held.case).has(e))
      : held.kind === "court-order"
        ? (held.order.editions === "all" ? this.#editions(held.case).map((e) => e.edition) : held.order.editions)
        : null;
    const editions = fixed ? JSON.stringify(fixed) : null;
    const out = this.record.transact(() => {
      if (moved()) return refuse("DOCKET_STALE", "the docket moved since this was prepared: prepare again", { seq: held.seq });
      this.sql.exec(`INSERT INTO docket_entries (case_id, seq, digest, json, kind, shelf, edition, record_entry, editions, signature,
                                                 signer_key, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    held.case, held.seq, held.digest, held.text, held.kind, held.json.shelf, String(held.edition), held.record,
                    editions, String(signature), v.keyB64, at);
      /* R25: in the same transaction, each named edition is stamped, linked to this entry (publication R62). Its refusal
         undoes the post and is answered as publication gave it; a throw undoes it too: never a silent compliance. */
      if (held.kind === "court-order") {
        const s = this.publication.stampEdition({ case: held.case, editions: fixed, entry: publicId(held.case, held.seq),
                                                  effect: held.order.effect, ...(held.order.parts ? { parts: held.order.parts } : {}), at });
        if (s && s.ok === false) return s;
        if (!s || s.ok !== true) throw new Error("publication answered no stamp for the court order; nothing was published");
      }
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    this.#held.delete(`${member}\u0000${held.digest}`);
    /* R13: a withdrawal is told to reevaluation after it commits; a throw there never undoes it. */
    if (held.kind === "withdrawal")
      this.#call(() => this.reevaluation.docketActed({ kind: "withdrawal", case: held.case, entry: publicId(held.case, held.seq) }));
    return { ok: true, case: held.case, seq: held.seq, entry: publicId(held.case, held.seq), published_at: at };
  }

  /* ================================================================ R33: each new edition recorded automatically */

  /** R33 (T53; K5559, K5571; was `publication` R83; amended BOB 4 Nov, PR 278, option (a)): the `edition` entry of R9 (b)
   *  for a ratified edition of the case, carrying the "What changed" statement `case-grammar.whatChangedOf` (its R8)
   *  answers; edition 1's carries none. Two steps, as R4 and R5, because R24's signature is the manager's registered key,
   *  which the plane never holds: the ratification ceremony signs it.
   *  - Without `signature`: answers the entry that would be filed (R6's fields, canonical JSON), its `digest` and
   *    `statement` = `signatures.docketStatement(case, seq, digest)`, writing nothing (as `docketPrepare`).
   *  - With `signature` and `by`: files it only when `signatures.verifySshsig` accepts `signature` over exactly that
   *    statement in `NS_DOCKET` against `credentials.attestingKeys()` restricted to keys registered to `by` (R5's verify);
   *    the entry is stored with its armored signature and signing key, as every public entry is (R24).
   *  An edition already holding a live `edition` entry files none: either step answers `filed: false` with the entry it
   *  holds. Refusals, each writing nothing: an absent case or one with no ratified edition `NO_SUCH_CASE`; an edition not
   *  ratified `DOCKET_NO_EDITION`; a counsel matter (R28); no group slug `DOCKET_NO_GROUP_SLUG`; and on the filing step,
   *  `by` no member `MACHINE_CANNOT_PLACE_DOCKET`, not the manager `DOCKET_NOT_THE_MANAGER`, a `digest` given that is not
   *  the entry's at this instant (the docket moved, or the day turned) `DOCKET_STALE`, a signature the verifier rejects
   *  `DOCKET_SIGNATURE_REFUSED` with its reason. */
  async docketRecordEdition({ case: caseId = null, edition = null, signature = null, by = null, digest = null } = {}) {
    const c = this.#case(caseId);
    if (!c) return noSuchCase(caseId);
    const ed = int(edition);
    /* DEC-49 REGION is-docket-form */
    if (ed === null || !c.editions.some((e) => e.edition === ed))
      return refuse("DOCKET_NO_EDITION", "the edition named is not a ratified edition of this case",
                    { editions: c.editions.map((e) => e.edition), fields: ["edition"] });
    /* END DEC-49 REGION is-docket-form */
    const counsel = this.#counselRefusal(c);
    if (counsel) return counsel;
    const slug = this.#slug();
    /* DEC-49 REGION is-docket-manager */
    if (!slug) return refuse("DOCKET_NO_GROUP_SLUG",
      localize("docket.index.no_team_slug_recorded", "no team slug is recorded, and there are no anonymous entries"));
    /* END DEC-49 REGION is-docket-manager */
    let what = null;
    if (ed > 1) {
      const doc = this.#call(() => this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`,
                                             c.case, ed));
      const p = doc ? this.#call(() => parseFrontmatter(doc.text)) : null;
      what = p ? (this.#call(() => whatChangedOf(p.data, p.body)) || {}).statement ?? null : null;
    }
    /* the edition's live entry, if one is held; else the entry that would be filed now (R6's fields; no member's name) */
    const build = (at) => {
      const backs = this.#takenBack(c.case);
      const held = this.#rows(`SELECT * FROM docket_entries WHERE case_id=? AND kind='edition' ORDER BY seq`, c.case)
        .find((e) => !backs.has(Number(e.seq)) && (parse(e.json) || {}).edition === ed);
      if (held) return { held: { ok: true, filed: false, case: c.case, edition: ed, seq: Number(held.seq), entry: publicId(c.case, held.seq) } };
      const prior = this.#one(`SELECT seq, digest FROM docket_entries WHERE case_id=? ORDER BY seq DESC LIMIT 1`, c.case);
      const seq = prior ? Number(prior.seq) + 1 : 1;
      const json = { format: ENTRY_FORMAT, group: slug, case: c.case, seq, previous: prior ? prior.digest : null,
                     shelf: "listed", kind: "edition", edition: ed, date: dayOf(at), what_changed: what };
      const text = canonicalJson(json);
      const d = sha256HexSync(text);
      return { seq, text, digest: d, statement: docketStatement(c.case, seq, d) };
    };
    const at = this.#stamp();
    const e = build(at);
    if (e.held) return e.held;
    if (signature === null || signature === undefined || signature === "")
      return { ok: true, filed: false, prepared: true, case: c.case, edition: ed, seq: e.seq, entry: e.text, digest: e.digest,
               statement: td.decode(e.statement) };
    const member = this.#member(by);
    /* DEC-49 REGION is-docket-manager */
    if (!member) return refuse("MACHINE_CANNOT_PLACE_DOCKET", str(by)
      ? "an edition's docket entry is signed by the case's manager signed in as themselves, and this caller is not one"
      : "no member is named as the one signing: this call carries nobody");
    if (!this.#isManager(c.project, member))
      return refuse("DOCKET_NOT_THE_MANAGER", "only an owner of the case's project signs its public docket", { case: c.case });
    /* END DEC-49 REGION is-docket-manager */
    /* DEC-49 REGION is-docket-post */
    if (str(digest) && str(digest) !== e.digest)
      return refuse("DOCKET_STALE", "the docket moved since this was prepared: prepare again", { seq: e.seq });
    const keys = (this.#call(() => this.credentials.attestingKeys(), []) || []).filter((k) => k.member_id === member).map((k) => k.key_b64);
    const v = await verifySshsig(String(signature), e.statement, NS_DOCKET, keys);
    if (!v.ok) return refuse("DOCKET_SIGNATURE_REFUSED", `the signature was refused: ${v.reason}`, { verifier: v.reason });
    /* END DEC-49 REGION is-docket-post */
    return this.record.transact(() => {
      const again = build(at);
      if (again.held) return again.held;
      if (again.digest !== e.digest) return refuse("DOCKET_STALE", "the docket moved since this was prepared: prepare again", { seq: again.seq });
      this.sql.exec(`INSERT INTO docket_entries (case_id, seq, digest, json, kind, shelf, edition, record_entry, editions, signature,
                                                 signer_key, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    c.case, e.seq, e.digest, e.text, "edition", "listed", String(ed), null, null, String(signature), v.keyB64, at);
      return { ok: true, filed: true, case: c.case, edition: ed, seq: e.seq, entry: publicId(c.case, e.seq), digest: e.digest, published_at: at };
    });
  }

  /* ================================================================ R7, R8: declining, and the receipt's invitation */

  /** R7: the manager declines a submission that contains redactions; nothing is published. */
  docketDecline({ entry = null, reason = null, by = null, viewer = null } = {}) {
    const member = this.#member(by);
    const id = str(entry);
    /* DEC-49 REGION is-docket-manager */
    if (!member) return refuse("MACHINE_CANNOT_PLACE_DOCKET", "a submission is declined by the case's manager signed in as themselves");
    /* END DEC-49 REGION is-docket-manager */
    const r = this.#recordEntry(id);
    const k = r ? this.#caseFor(r.case_id, str(viewer) || str(by)) : null;
    /* DEC-49 REGION is-docket-entry */
    if (!r || !k || k.refusal) return refuse("NO_SUCH_DOCKET_ENTRY", "no record entry you see answers by that id", { entry: id });
    /* END DEC-49 REGION is-docket-entry */
    /* DEC-49 REGION is-docket-manager */
    if (!this.#isManager(k.c.project, member))
      return refuse("DOCKET_NOT_THE_MANAGER", "only an owner of the case's project declines a submission", { case: k.c.case });
    /* END DEC-49 REGION is-docket-manager */
    const settled = this.#entryRefusal(k.c.case, id);
    if (settled) return settled;
    /* DEC-49 REGION is-docket-form */
    if (!words(reason, REASON_MAX)) return refuse("DOCKET_NO_REASON", `a decline carries a reason of 1 to ${REASON_MAX} characters`);
    /* END DEC-49 REGION is-docket-form */
    const at = this.#stamp();
    const out = this.record.transact(() => {
      if (this.#recordState(id).state !== "pending") return refuse("DOCKET_ENTRY_SETTLED", "the entry was settled meanwhile", { entry: id });
      this.sql.exec(`INSERT INTO docket_marks (entry_id, kind, reason, by_member, at) VALUES (?,?,?,?,?)`, id, "declined", reason, member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, entry: id, case: k.c.case, state: "declined", declined: { reason, at, for: "contains redactions" },
             published: false };
  }

  /** R8: the request to resend a receipted reply without the private person's name, prefilled for a member to send by
   *  their own means. A read: this module sends nothing. */
  docketInvitation({ entry = null, viewer = null } = {}) {
    const id = str(entry);
    const r = this.#recordEntry(id);
    const k = r ? this.#caseFor(r.case_id, viewer) : null;
    const s = r ? this.#recordState(id) : null;
    if (!r || !k || k.refusal || s.state !== "receipted")
      return refuse("NO_SUCH_DOCKET_ENTRY", "no receipted record entry you see answers by that id", { entry: id });
    const pub = parse(s.pub.json) || {};
    return { ok: true, entry: id, case: r.case_id, edition: Number(r.edition), from: pub.from ?? null, received: pub.received ?? null,
             receipt: { seq: Number(s.pub.seq), entry: publicId(r.case_id, s.pub.seq) },
             invitation: { ...RESEND_INVITATION, case: r.case_id, edition: Number(r.edition), received: pub.received ?? null,
                           answers: id, docket: docketAddress(r.case_id) },
             sends: word("docket.nothing_member_sends") };
  }

  /* ================================================================ R9: the required core */

  /* R9 for one case the caller manages: each core item still due. */
  #coreOf(c) {
    const items = [];
    const backs = this.#takenBack(c.case);
    const live = this.#entries(c.case).filter((e) => !backs.has(Number(e.seq))).map((e) => parse(e.json) || {});
    /* (a) the subject's responses and statements, and a holder's responses filed while the grant was live */
    for (const r of this.#rows(`SELECT * FROM docket_record WHERE case_id=? ORDER BY rn`, c.case)) {
      if (this.#recordState(r.entry_id).state !== "pending") continue;
      const f = parse(r.from_json) || {};
      const core = (r.kind === "response" && (f.kind === "subject" || (f.kind === "holder" && this.#liveAt(this.#grant(c.case, f.grant), r.filed_at))))
        || (r.kind === "statement" && f.kind === "subject");
      if (core) items.push({ case: c.case, kind: r.kind, ref: r.entry_id, edition: Number(r.edition), since: r.filed_at });
    }
    /* (b) each ratified edition above 1 with no edition entry naming it */
    for (const e of c.editions) {
      if (e.edition <= 1 || live.some((j) => j.kind === "edition" && j.edition === e.edition)) continue;
      const doc = this.#call(() => this.#one(`SELECT text FROM case_documents WHERE case_id=? AND edition=? AND sig_armored IS NOT NULL`,
                                             c.case, e.edition));
      const p = doc ? this.#call(() => parseFrontmatter(doc.text)) : null;
      const wc = p ? this.#call(() => whatChangedOf(p.data, p.body)) : null;
      items.push({ case: c.case, kind: "edition", ref: String(e.edition), edition: e.edition, since: e.ratified_at,
                   what_changed: wc ? wc.statement ?? null : null });
    }
    /* (c) each tension on a load-bearing member of the latest ratified edition, with no disclosure entry naming it */
    const latest = c.editions[c.editions.length - 1];
    const loadBearing = new Set(this.#call(() => this.#rows(`SELECT bundle_id FROM published_case_members WHERE case_id=? AND edition=?
                                                              AND role='load_bearing'`, c.case, latest.edition), []).map((m) => m.bundle_id));
    const disclosed = new Set(live.filter((j) => j.kind === "disclosure").map((j) => j.answers));
    const seen = new Set();
    for (const t of this.#tensions(c)) {
      if (t.case !== c.case || Number(t.edition) !== latest.edition || !loadBearing.has(t.member)) continue;
      if (!str(t.candidate) || disclosed.has(t.candidate) || seen.has(t.candidate)) continue;
      seen.add(t.candidate);
      items.push({ case: c.case, kind: "tension", ref: t.candidate, edition: latest.edition, since: latest.ratified_at,
                   member: t.member, state: t.state ?? null });
    }
    return items;
  }
  /* `case-tensions` R4's candidates on the case's project (was `publication` R50), paged through. */
  #tensions(c) {
    const out = [];
    let after = null;
    for (let i = 0; i < 1000; i++) {
      const r = this.#call(() => this.caseTensions.caseTensions({ project: c.project, after, limit: 200 }));
      if (!r || !Array.isArray(r.cases)) break;
      for (const k of r.cases) if (k && k.case === c.case && Array.isArray(k.tensions)) out.push(...k.tensions);
      if (!r.cursor || r.cursor === after) break;
      after = r.cursor;
    }
    return out;
  }

  /** R9: for each case the viewer manages (one when `case` is given), each core item still due, with its `since`. */
  coreDue({ case: caseId = null, viewer = null } = {}) {
    const member = this.#member(viewer);
    if (!member) return { ok: true, items: [], count: 0, wrote: false };
    const ids = str(caseId) ? [str(caseId)]
      : this.#call(() => this.#rows(`SELECT DISTINCT case_id FROM published_cases WHERE ratified_at IS NOT NULL ORDER BY case_id`), [])
        .map((r) => r.case_id);
    const items = [];
    for (const id of ids) {
      const c = this.#case(id);
      if (!c || !this.#isManager(c.project, member)) continue;
      items.push(...this.#coreOf(c));
    }
    return { ok: true, items, count: items.length, wrote: false };
  }

  /* ================================================================ R3: the member's read */

  /* R30 (T51; DEC-340): the member who made a mark as `{member, handle}`, or null when its author is not a member: no
     roster row, or one no longer active (a revoked member keeps her row, so her status is what decides). Only `docketOf`,
     which answers a viewer who sees the project in full, names her; R27's reads never do. */
  #markedBy(memberId) {
    const id = str(memberId);
    if (!id) return null;
    const facts = this.#call(() => this.membership.memberFacts(id));
    if (!facts || facts.status !== "active") return null;
    return { member: id, handle: str(facts.handle) ? facts.handle : null };
  }

  /* R14's view of one public entry. */
  #publicView(e, backs) {
    const back = backs.get(Number(e.seq));
    return { seq: Number(e.seq), entry: publicId(e.case_id, e.seq), digest: e.digest, json: e.json, fields: entryFields(e.json),
             signature: e.signature || null, published_at: e.published_at,
             taken_back: back ? { seq: Number(back.seq), date: (parse(back.json) || {}).date ?? null } : null };
  }

  /* R32 (T53; K5558): the kinds `viewer` may act on, each with the fields its act needs: `file`, the record kinds a
     joined member files (R1), and `place`, the kinds the case's manager places directly (R4); each empty for a viewer the
     act would refuse (a member not joined; anyone not the manager), so the kinds offered are the kinds the act accepts. */
  #kindsFor(c, viewer) {
    const member = this.#member(viewer);
    const joined = !!member && !this.#call(() => this.membership.projectAuthority(c.project, String(viewer).trim(), "joined", "docketfile"), true);
    const manager = this.#isManager(c.project, member);
    const list = (table) => Object.entries(table).map(([kind, fields]) => ({ kind, fields: [...fields] }));
    return { file: joined ? list(FILE_KIND_FIELDS) : [], place: manager ? list(PLACE_KIND_FIELDS) : [] };
  }

  /** R3: every entry on all three shelves, oldest first, the core still due and a contesting entry's prompts. */
  docketOf({ case: caseId = null, viewer = null } = {}) {
    const k = this.#caseFor(caseId, viewer);
    if (k.refusal) return k.refusal;
    const { c } = k;
    const backs = this.#takenBack(c.case);
    const pub = this.#entries(c.case).map((e) => ({ shelf: e.shelf, at: e.published_at, ...this.#publicView(e, backs) }));
    const rec = this.#rows(`SELECT * FROM docket_record WHERE case_id=? ORDER BY rn`, c.case).map((r) => {
      const s = this.#recordState(r.entry_id);
      const marks = this.#marks(r.entry_id);
      const p = marks.find((m) => m.kind === "pressure");
      const contests = !!Number(r.contests);
      return {
        shelf: "record", at: r.filed_at, entry: r.entry_id, edition: Number(r.edition), kind: r.kind, from: parse(r.from_json),
        capture: r.capture_sha, proposed: r.proposed, reason: r.reason, found_by: r.found_by, contests, answers: r.answers ?? null,
        author: r.author, filed_at: r.filed_at, state: s.state,
        /* R1 (T45): an outcome's statement as filed; one filed before T45 reads null */
        ...(r.kind === "outcome" ? { outcome: parse(r.outcome_json) ?? null, summary: r.summary ?? null } : {}),
        ...(s.state === "placed" || s.state === "receipted" ? { public: { seq: Number(s.pub.seq), entry: publicId(c.case, s.pub.seq) } } : {}),
        ...(s.state === "declined" ? { declined: { reason: s.decline.reason, at: s.decline.at } } : {}),
        ...(s.state === "taken-back" ? { taken_back: { reason: s.back.reason, at: s.back.at } } : {}),
        /* R30 (T51; DEC-340): who made the mark, for a viewer who sees the project in full */
        pressure: p ? { kind: p.pressure, note: p.note ?? null, at: p.at, by: this.#markedBy(p.by_member) } : null,
        ...(contests ? { prompts: {
          reevaluation: { cause: "contested", case: c.case, edition: Number(r.edition), entry: r.entry_id, since: r.filed_at,
                          findings: this.#pins(c.case, Number(r.edition)) },
          checkpoint: CHECKPOINT_OFFER } } : {}),
      };
    });
    /* oldest first; at one instant a record entry before the public entry that may place it, then in filing or seq order */
    const entries = [...rec, ...pub].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return { ok: true, case: c.case, project: c.project, editions: c.editions, entries, core_due: this.#coreOf(c),
             kinds: this.#kindsFor(c, viewer), wrote: false };
  }

  /* ================================================================ R12, R13: withdrawal, and reevaluation's registration */

  /** R12: the withdrawal entry naming that edition, or null; viewer-free, it writes nothing. */
  withdrawalOf({ case: caseId = null, edition = null } = {}) {
    const id = str(caseId), ed = int(edition);
    if (!id || ed === null) return null;
    const w = this.#withdrawn(id).get(ed);
    if (!w) return null;
    const j = parse(w.json) || {};
    return { seq: Number(w.seq), entry: publicId(id, w.seq), date: j.date ?? null, reason: j.reason ?? null, digest: w.digest };
  }

  /** R25: the case's court-order entries, oldest first (those naming `edition` when given): each one's `seq`, entry id,
   *  `date`, `effect`, the editions fixed at its post, its `parts` (null when none) and digest; viewer-free, it writes
   *  nothing. A later act reads it to know an unsealing order was captured and placed before it uses unsealed material. */
  courtOrdersOf({ case: caseId = null, edition = null } = {}) {
    const id = str(caseId);
    if (!id) return [];
    const ed = int(edition);
    return this.#orders(id).filter((o) => ed === null || o.editions.includes(ed)).map((o) => ({
      seq: Number(o.row.seq), entry: publicId(id, o.row.seq), date: o.json.date ?? null, effect: o.order.effect ?? null,
      editions: o.editions, parts: Array.isArray(o.order.parts) ? o.order.parts : null, digest: o.row.digest }));
  }

  /** R25 (K1632): the order source docket registers with `publication` (its R62): the posted `court-order` entry `entry`
   *  (`<case>#<seq>`) of `case`, as `{seq, effect, editions, parts}` with the editions fixed at its post and `parts` null
   *  when none; null for anything else. Read inside the post's own transaction, so the entry being posted is seen. */
  courtOrderOf(caseId, entry) {
    const id = str(caseId), e = str(entry);
    if (!id || !e || !e.startsWith(`${id}#`)) return null;
    const seq = int(e.slice(id.length + 1));
    const o = seq === null ? null : this.#orders(id).find((x) => Number(x.row.seq) === seq);
    return o ? { seq, effect: o.order.effect ?? null, editions: o.editions, parts: Array.isArray(o.order.parts) ? o.order.parts : null } : null;
  }

  /** R13: each withdrawal, in case then seq order after `after` (`<case>#<seq>`), at most `limit`. */
  docketWithdrawals({ after = null, limit = null } = {}) {
    const cap = Math.min(Math.max(int(limit) ?? 200, 1), 1000);
    const a = typeof after === "string" ? after : "";
    const cut = a.lastIndexOf("#");
    const [ac, as] = cut >= 0 ? [a.slice(0, cut), int(a.slice(cut + 1)) ?? 0] : [a, 0];
    const rows = this.#rows(`SELECT * FROM docket_entries WHERE kind='withdrawal' AND (case_id > ? OR (case_id = ? AND seq > ?))
                              ORDER BY case_id, seq LIMIT ?`, ac, ac, as, cap + 1);
    const more = rows.length > cap;
    if (more) rows.length = cap;
    const withdrawals = rows.map((w) => {
      const editions = parse(w.editions) || [];
      const c = this.#case(w.case_id);
      return { case: w.case_id, project: c ? c.project : null, editions,
               findings: editions.flatMap((ed) => this.#pins(w.case_id, ed).map((p) => ({ ...p, edition: ed }))),
               at: w.published_at, seq: Number(w.seq), entry: publicId(w.case_id, w.seq) };
    });
    return { withdrawals, cursor: more ? publicId(rows[rows.length - 1].case_id, rows[rows.length - 1].seq) : null };
  }

  /** R13: each record entry with `contests: true` and not taken back, in entry id order after `after`, at most `limit`. */
  docketContested({ after = null, limit = null } = {}) {
    const cap = Math.min(Math.max(int(limit) ?? 200, 1), 1000);
    const out = [];
    let last = null, more = false;
    for (const r of this.#rows(`SELECT * FROM docket_record WHERE contests=1 AND entry_id > ? ORDER BY entry_id`,
                               typeof after === "string" ? after : "")) {
      if (this.#recordState(r.entry_id).state === "taken-back") continue;
      if (out.length === cap) { more = true; break; }
      out.push({ case: r.case_id, edition: Number(r.edition), findings: this.#pins(r.case_id, Number(r.edition)),
                 at: r.filed_at, entry: r.entry_id });
      last = r.entry_id;
    }
    return { contested: out, cursor: more ? last : null };
  }

  /* ================================================================ R27: the pressure marks, read */

  /* R27: one mark as answered, its case and owning project read beside it; names no member. */
  #markView(m, r) {
    const c = r ? this.#call(() => this.#one(`SELECT project_id FROM cases WHERE case_id=?`, r.case_id)) : null;
    return { entry: m.entry_id, case: r ? r.case_id : null, project: c ? str(c.project_id) : null, kind: m.pressure, note: m.note ?? null, at: m.at };
  }

  /** R27 (T45): each R2 mark in the order made after `after` (a mark's id), read as the plane, at most `limit` (1–1,000,
   *  default 1,000), with `cursor` the last mark answered when more follow; with `kind`, only that kind. Names no member,
   *  writes nothing and never throws: an unreadable table answers `DOCKET_UNREADABLE`, never a short list. */
  docketPressureMarks({ kind = null, after = null, limit = null } = {}) {
    if (kind !== null && kind !== undefined && kind !== "" && !PRESSURE_KINDS.includes(kind))
      /* DEC-49 REGION is-docket-pressure */
      return refuse("DOCKET_PRESSURE_REFUSED", `kind is one of ${PRESSURE_KINDS.join(", ")}`, { kind: typeof kind === "string" ? kind : null });
      /* END DEC-49 REGION is-docket-pressure */
    const n = int(limit);
    const cap = n === null ? MARKS_LIMIT_DEFAULT : Math.min(Math.max(n, 1), MARKS_LIMIT_MAX);
    const from = int(after) ?? 0;
    const k = PRESSURE_KINDS.includes(kind) ? kind : null;
    try {
      const rows = this.#rows(`SELECT m.rn, m.entry_id, m.pressure, m.note, m.at, r.case_id FROM docket_marks m
                                 LEFT JOIN docket_record r ON r.entry_id = m.entry_id
                                WHERE m.kind='pressure' AND m.rn > ? AND (? IS NULL OR m.pressure = ?) ORDER BY m.rn LIMIT ?`,
                               from, k, k, cap + 1);
      const more = rows.length > cap;
      if (more) rows.length = cap;
      const marks = rows.map((m) => ({ mark: Number(m.rn), ...this.#markView(m, m.case_id ? { case_id: m.case_id } : null) }));
      return { ok: true, marks, cursor: more ? Number(rows[rows.length - 1].rn) : null };
    } catch {
      return { ok: false, reason: "DOCKET_UNREADABLE", detail: "the docket's marks could not be read; this is not an empty list" };
    }
  }

  /** R27 (T45): the entry's mark, or `pressure: null` when it has none; an entry absent, or whose project `viewer` does
   *  not see in full, is NO_SUCH_DOCKET_ENTRY, one answer; a call naming no member as viewer sees nothing (fail closed).
   *  Names no member, writes nothing and never throws. */
  docketPressureOf({ entry = null, viewer = null } = {}) {
    const id = str(entry);
    try {
      const r = this.#recordEntry(id);
      const c = r ? this.#case(r.case_id) : null;
      /* DEC-49 REGION is-docket-entry */
      if (!r || !c || !c.project || !this.#member(viewer) || this.#call(() => this.membership.sight(c.project, str(viewer))) !== "full")
        return refuse("NO_SUCH_DOCKET_ENTRY", "no record entry you see answers by that id", { entry: id });
      /* END DEC-49 REGION is-docket-entry */
      const m = this.#marks(id).find((x) => x.kind === "pressure");
      return m ? { ok: true, ...this.#markView(m, r) } : { ok: true, entry: id, pressure: null };
    } catch {
      return { ok: false, reason: "DOCKET_UNREADABLE", detail: "the docket's marks could not be read" };
    }
  }

  /** R26: the docket's dates for `events`' "what we did" lane: each public entry of a case one of whose named subjects
   *  (the subjects of its ratified editions' member findings) is in `set`, its `date` (and, for an entry placing a record
   *  entry, its `received`) within `from`–`to` by day, as `{at, label, ref, kind}`, by `at` then `ref`, at most `limit`
   *  (1–500, default 100) with `truncated`. Only a case whose project `viewer` sees in full is answered; a call naming
   *  no viewer is answered nothing. Record entries never appear. It writes nothing, and an item is the group's own act,
   *  never an event of the world or evidence (R17). (T45) Each item carries `public: true`, every entry answered being a
   *  public entry (the mark `case-authoring` R57 requires); under `audience: "public"` (`events` R28, R30) it answers the
   *  same items. */
  docketEvents({ set = null, from = null, to = null, limit = null, viewer = null, audience: _audience } = {}) {
    const who = str(viewer);
    const ids = new Set((Array.isArray(set) ? set : typeof set === "string" ? set.split(",") : []).map(str).filter(Boolean));
    const n = int(limit);
    const cap = n === null ? EVENTS_LIMIT_DEFAULT : Math.min(Math.max(n, 1), EVENTS_LIMIT_MAX);
    if (!who || !ids.size) return { items: [], truncated: false };
    const day = (v) => { const m = /^\d{4}-\d{2}-\d{2}/.exec(typeof v === "string" ? v : ""); return m ? m[0] : null; };
    const lo = day(from), hi = day(to);
    const items = [];
    for (const { case_id } of this.#rows(`SELECT DISTINCT case_id FROM docket_entries ORDER BY case_id`)) {
      const c = this.#case(case_id);
      if (!c || !c.project || this.#call(() => this.membership.sight(c.project, who)) !== "full") continue;
      if (!c.editions.some((e) => [...this.#namedSubjects(c.case, e.edition)].some((s) => ids.has(s)))) continue;
      for (const e of this.#entries(c.case)) {
        const j = parse(e.json) || {};
        const add = (at, label) => { if (at && (!lo || at >= lo) && (!hi || at <= hi)) items.push({ at, label, ref: publicId(c.case, e.seq), kind: j.kind ?? e.kind, public: true }); };
        add(day(j.date), localize("docket.index.docket_kind_edition_edition", "docket: {kind}, edition {edition}", { kind: String(j.kind), edition: String(j.edition) }));
        if (e.record_entry) add(day(j.received), localize("docket.index.docket_kind_received_edition_edition", "docket: {kind} received, edition {edition}", { kind: String(j.kind), edition: String(j.edition) }));
      }
    }
    items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : a.label < b.label ? -1 : 1));
    return { items: items.slice(0, cap), truncated: items.length > cap };
  }

  /** R13, R25, R26: fills `reevaluation`'s docket registration (its R30), registers the order source with `publication`
   *  (its R62; K1632) and the docket's event source with `events` (its R30), each once; the answers are kept. */
  start() {
    if (this.registration) return this.registration;
    this.registration = this.#call(() => this.reevaluation.registerDocket("docket", {
      withdrawals: (q) => this.docketWithdrawals(q || {}), contested: (q) => this.docketContested(q || {}) }),
      { ok: false, reason: "REGISTRATION_FAILED" });
    this.orderSourceRegistration = this.#call(() => this.publication.registerOrderSource("docket", {
      courtOrderOf: (caseId, entry) => this.courtOrderOf(caseId, entry) }), { ok: false, reason: "REGISTRATION_FAILED" });
    this.eventSourceRegistration = this.#call(() => this.events.registerEventSource("docket", (q) => this.docketEvents(q || {})),
      { ok: false, reason: "REGISTRATION_FAILED" });
    return this.registration;
  }

  /* ================================================================ R5, R14, R15: the public reads */

  /** R5: each key that has signed a public entry, with the instant it first did; viewer-free, names no member. */
  docketSigners() {
    return this.#rows(`SELECT signer_key AS k, MIN(published_at) AS first FROM docket_entries GROUP BY signer_key
                       ORDER BY first, k`)
      .map((r) => ({ keyB64: r.k, first_signed: r.first }));
  }

  /** R14, R24: the case's public entries, oldest first, the bytes of each listed entry's capture and `last_entry`; null
   *  for a case with no ratified edition. The record shelf never appears. With `captures: "omit"` no capture's bytes are
   *  read: `captures` is `{}` and the answer says `captures_omitted: true` (a citing copy's daily read, R24). Entries
   *  under either format label are answered alike, each as stored (R6). */
  async docketPublic({ case: caseId = null, captures: want = null } = {}) {
    const c = this.#case(caseId);
    if (!c) return null;
    const backs = this.#takenBack(c.case);
    const rows = this.#entries(c.case);
    const entries = rows.map((e) => this.#publicView(e, backs));
    const last = rows[rows.length - 1];
    const answer = (captures, extra) => ({ ok: true, case: c.case, group: this.#slug(), entries, captures,
      last_entry: last ? (parse(last.json) || {}).date ?? null : null, feed: feedAddress(c.case), ...extra });
    if (want === "omit") return answer({}, { captures_omitted: true });
    const captures = {};
    const store = this.#call(() => this.record.evidenceStore());
    for (const e of entries) {
      const f = e.fields || {};
      if (f.shelf !== "listed" || f.kind === "receipt" || !f.capture || !isSha(f.capture.sha256) || f.capture.sha256 in captures) continue;
      let bytes = null;
      try {
        const o = store ? await store.get(f.capture.sha256) : null;
        if (o) bytes = new Uint8Array(await o.arrayBuffer());
      } catch { bytes = null; }
      /* bytes the store cannot answer are null, never invented (K1274) */
      captures[f.capture.sha256] = bytes ? b64(bytes) : null;
    }
    return answer(captures);
  }

  /** R14 (K1276): the date of the case's latest public entry, the `last_entry` `docketPublic` answers, or null; synchronous,
   *  viewer-free, reading no capture's bytes. For `public-read` R20's `docket_last_entry`. */
  lastEntryOf({ case: caseId = null } = {}) {
    const id = str(caseId);
    if (!id) return null;
    const last = this.#one(`SELECT json FROM docket_entries WHERE case_id=? ORDER BY seq DESC LIMIT 1`, id);
    return last ? (parse(last.json) || {}).date ?? null : null;
  }

  /** R15: the same entries as an Atom 1.0 feed, newest first; null for a case with no ratified edition. Reading it
   *  writes nothing and records nothing about the reader. */
  async docketFeed({ case: caseId = null } = {}) {
    const c = this.#case(caseId);
    if (!c) return null;
    const backs = this.#takenBack(c.case);
    const entries = this.#entries(c.case).map((e) => this.#publicView(e, backs));
    return renderFeed({ case: c.case, group: this.#slug(), entries }, c.editions[c.editions.length - 1].ratified_at);
  }
}

/* The member acts and reads answer their own refusals with code, check and translation (DEC-49). */
for (const m of ["docketFile", "docketPressure", "docketPrepare", "docketDecline", "docketInvitation", "docketOf"]) {
  const fn = Docket.prototype[m];
  Docket.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}
for (const m of ["docketPost", "docketRecordEdition"]) {
  const fn = Docket.prototype[m];
  Docket.prototype[m] = async function (...a) { return withRow(await fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it creates and declares its tables (whole store only, R16), registers
 *  its figures and its record ids' mint seed, and fills reevaluation's docket registration (R13). */
export function docketOf(host, deps) {
  let k = instances.get(host);
  if (!k) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    k = new Docket({ ...d, host, storage, record, membership, env: d.env ?? host.env ?? null });
    instances.set(host, k);
    k.migrate();
    k.purgeDeclaration = record.declarePurge("docket", DOCKET_TABLES.map((name) => ({ name, keys: [] })));
    k.countsRegistration = record.registerCounts("docket", ["docketRecordEntries", "docketPublicEntries", "docketMarks"], () => {
      const n = (t) => Number([...storage.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n);
      return { docketRecordEntries: n("docket_record"), docketPublicEntries: n("docket_entries"), docketMarks: n("docket_marks") };
    });
    k.mintSeedRegistration = record.registerMintSeed("docket", [[RECORD_ID_PREFIX, "docket_record", "entry_id"]]);
    k.start();
  }
  return k;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function docketOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return DOCKET_TABLES.includes(name);
}

/** The module's member ops: `by`, `author` and `viewer` are the control plane's stamps, read from the query, never the
 *  body. `op-declarations` declares them, `control-plane` routes them and `plane` composes them (L11). The public reads
 *  `docketpublic` and `docketfeed` are `public-read`'s to serve (its R21). */
export function docketOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  const pick = (k) => (b[k] !== undefined && b[k] !== null ? b[k] : url.searchParams.has(k) ? q(k) : null);
  const by = q("by") ?? q("author"), author = q("author") ?? q("by"), viewer = q("viewer");
  return {
    docketfile: () => m.docketFile({ case: pick("case"), edition: pick("edition"), kind: pick("kind"), from: pick("from"),
      capture: pick("capture"), contests: pick("contests"), proposed: pick("proposed"), reason: pick("reason"),
      answers: pick("answers"), takesBack: pick("takesBack"), outcome: pick("outcome"), summary: pick("summary"), author, viewer }),
    docketpressure: () => m.docketPressure({ entry: pick("entry"), pressure: pick("pressure"), author, viewer }),
    docket: () => m.docketOf({ case: q("case"), viewer }),
    docketprepare: () => m.docketPrepare({ case: pick("case"), kind: pick("kind"), shelf: pick("shelf"), edition: pick("edition"),
      entry: pick("entry"), summary: pick("summary"), reason: pick("reason"), holder: pick("holder"), takesBack: pick("takesBack"),
      candidate: pick("candidate"), grant: pick("grant"), order: pick("order"), capture: pick("capture"), by, viewer }),
    docketpost: () => m.docketPost({ digest: pick("digest"), signature: pick("signature"),
      acknowledged: b.acknowledged === true || q("acknowledged") === "true" ? true : b.acknowledged ?? q("acknowledged"), by, viewer }),
    docketdecline: () => m.docketDecline({ entry: pick("entry"), reason: pick("reason"), by, viewer }),
    docketinvitation: () => m.docketInvitation({ entry: q("entry"), viewer }),
  };
}

/* R31 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  docketfile: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("docket.declared.docketfile", "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle"),
    fields: { accepts: ["case","edition","kind","from","capture","contests","proposed","reason","answers","takesBack","outcome","summary"], requires: ["case","reason",["edition","takesBack"],["from","takesBack"],["capture","takesBack"],["kind","takesBack"],["proposed","takesBack"]] } },
  docketpressure: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("docket.declared.docketpressure", "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle"),
    fields: { accepts: ["entry","pressure"], requires: ["entry","pressure"] } },
  docketprepare: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("docket.declared.docketprepare", "read: a docket entry composed for the case's manager to sign, keyed by case, with its statement and digest; publishes nothing and writes nothing"),
    fields: { accepts: ["case","kind","shelf","edition","entry","summary","reason","holder","takesBack","candidate","grant","order","capture"], requires: ["case","kind",["edition","entry","order"]] } },
  docketpost: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "attested", description: localize("docket.declared.docketpost", "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle"),
    fields: { accepts: ["digest","signature","acknowledged"], requires: ["digest","signature","acknowledged"] } },
});
