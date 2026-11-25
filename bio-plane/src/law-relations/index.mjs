/* law-relations — how one held standard bears on another, as members record it from the text: law relations, court
 * links and treatment rows held as data, the reads over them, the citation resolver and the connection owner's read
 * (requirements: `build/requirements/law-relations.md`, R1–R20; D192, D134; K1443, K1446, K1449, K1486; K1961).
 *
 * Split from `standards` by copy, with no change of meaning (K617, K1961): this file is `standards/law.mjs` as it
 * stood, over a host contract (R13) in place of `standards`' private reads. It holds no standard: what it knows of one
 * is what the host answers (`row`, `texts`, `readable`, `idsAtKey`, `idsOfKind`, `idsCovering`, …), and it never reads
 * or writes a `standards` table. The host is `standards`, a later module (P4): this module imports nothing of it.
 *
 * Everything here is a member's act or a read (R14, K1443): a relation, link or treatment is recorded only by a named
 * member, with the passage that makes it and the member's reason, and never edited or deleted (R15): it is withdrawn,
 * kept with who, when and why. A machine's suggestion of one is a proposal, stored apart, which moves no answer until a
 * member records the row naming it. Temporal and referential relations are two closed sets, never mixed in one list
 * or read (R1). Rows are keyed by ids of their own (`lrel-`, `clink-`, `ctreat-`, `lprop-` and 24 hex characters),
 * not record ids: they are rows of this module's tables, not record documents. A relation, link or treatment is
 * answered only to a viewer who may read its passage and both of its ends (R19). Nothing judges a law's merit (R18).
 *
 * REACHED as `new LawRecords(host)`; `standards` constructs it over its reads and delegates its law services to it. */
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { sha256HexSync, BASIS_GRADES } from "../record-grammar/index.mjs";
import { proposalLabel } from "../record-grammar/labels.mjs";
import { BOUNDS, LOWEST_GRADE, derivedId, isRecordId } from "../connection-grammar/index.mjs";
import { validAt } from "../civil-time/index.mjs";
import { LAW_RELATIONS_CHECKS, refusal } from "./checks.mjs";
import { LAW_SCHEMA, LAW_TABLES, migrateLaw } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { LAW_RELATIONS_CHECKS } from "./checks.mjs";
export { LAW_SCHEMA, LAW_TABLES, migrateLaw };

/** The module name its tables are declared under (R15). */
export const MODULE = "law-relations";

/** R1, R9: the two closed sets of relation types, kept apart. */
export const LAW_RELATIONS = Object.freeze({
  temporal: Object.freeze(["amends", "repeals", "renumbers", "recodifies"]),
  referential: Object.freeze(["refers_to", "defines", "excepts", "implements", "incorporates"]),
});
/** R5, R8: the court links; R6: the treatments, and those that end a decision's standing. */
export const COURT_LINKS = Object.freeze(["interprets", "applies", "holds_invalid", "requires"]);
export const TREATMENTS = Object.freeze(["reversed", "vacated", "depublished", "overruled", "affirmed"]);
const ENDING = Object.freeze(["reversed", "vacated", "depublished", "overruled"]);
/** R3: the temporal relations that move a provision to another address. */
const MOVES = Object.freeze(["renumbers", "recodifies"]);
/** R5, R8, R20: the kinds a court link ends at. */
export const LINK_TARGET_KINDS = Object.freeze(["statute", "regulation", "ordinance", "policy"]);
/** R9: an incorporated edition's bound, in characters (as `standards` R39 writes an edition). */
export const EDITION_MAX = 50;

const WORDS = Object.freeze({
  amends: "amends", repeals: "repeals", renumbers: "renumbers", recodifies: "recodifies",
  refers_to: "refers to", defines: word("label.connectionkinds.law_defines"), excepts: word("label.connectionkinds.law_excepts"), implements: "implements",
  incorporates: "incorporates",
  interprets: "interprets", applies: "applies", holds_invalid: "holds invalid", requires: "requires",
});

/** R7: the connection kinds this module owns, each with its members' word (K1486). Names of their own, because
 *  `events` holds `amends` (KIND_TAKEN; K1521). */
export const CONNECTION_KINDS = Object.freeze([
  ...LAW_RELATIONS.temporal.map((t) => ({ kind: `law_${t}`, word: WORDS[t], class: "evidentiary" })),
  ...LAW_RELATIONS.referential.map((t) => ({ kind: `law_${t}`, word: WORDS[t], class: "evidentiary" })),
  ...COURT_LINKS.map((t) => ({ kind: `court_${t}`, word: WORDS[t], class: "evidentiary" })),
  { kind: "in_force_at_event", word: word("label.connectionkinds.in_force_at_event"), class: "derived" },
].map((k) => Object.freeze(k)));
/** R7: the owner name `standards` registers these kinds under, unchanged by the split. */
export const CONNECTION_OWNER = "standards";
/** R7: the method a derived "in force at an event's date" item names: `standards` R20's read, through the host. */
export const IN_FORCE_METHOD = "standards.inForceAt (R20): civil-time.validAt over the version's period at the event's date";

/** R13: the reads the host supplies at construction, every one required. */
export const HOST_READS = Object.freeze([
  "sql", "record", "membership", "rows", "one", "row", "texts", "readable", "content", "when", "nonce",
  "inForceAt", "periodOf", "eventDay", "eventWhen", "gradeOf", "zone", "recognise", "citationLookup",
  "idsAtKey", "idsOfKind", "idsCovering",
  "noSuchStandard", "portionUnknown", "refuseNoId", "refuseDateInvalid", "refuseFieldUnknown", "refuseReason",
  "refuseNoSuchProposal", "refuseProposalAdopted", "refuseProposerUnnamed", "refuseWhyInvalid",
]);

const REASON_MAX = 2000, WHY_MAX = 240, SCAN_MAX = 2000;
const RELATE_KEYS = Object.freeze(["type", "from", "to", "citation", "effective", "edition", "reason", "author", "viewer",
                                   "proposal"]);
const LINK_KEYS = Object.freeze(["type", "from", "to", "citation", "reason", "author", "viewer", "proposal"]);
const TREAT_KEYS = Object.freeze(["decision", "treatment", "by_decision", "citation", "reason", "author", "viewer", "proposal"]);
const PROPOSAL_FIELDS = Object.freeze({ relation: RELATE_KEYS, link: LINK_KEYS, treatment: TREAT_KEYS });

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const rankOf = (g) => BASIS_GRADES.indexOf(g);
/* The weaker of two grade letters (BASIS_GRADES is strongest first). */
const weaker = (a, b) => (rankOf(a) >= rankOf(b) ? a : b);

/* The reason, as R2, R5 and R6 ask it (DEC-88): a string with something in it, at most 2,000 characters. */
const reasonFault = (r) => (typeof r !== "string" || !r.trim() ? word("law-relations.carries_reason") : [...r].length > REASON_MAX
  ? word("law-relations.carries_reason_characters", { reason_max: String(REASON_MAX) }) : null);

/* ---- the refusals several acts answer, each minted at one site (DEC-49) ---- */

/** R14, R21: null for a named member; else MACHINE_CANNOT_RELATE through its row, exactly as `lawRelate` answers it. A
 *  host answering the same code (`standards` R40, R43) mints it here, never from the row itself. */
export function machineRelate(author) {
  /* DEC-49 REGION is-law-member */
  if (str(author) && !isMachineIdentity(str(author))) return null;
  return refusal("MACHINE_CANNOT_RELATE", "recording a law relation, court link or treatment is a named member's act; a "
                 + "machine proposes one (lawPropose). Nothing was written.");
  /* END DEC-49 REGION is-law-member */
}

function refuseRelationUnknown(type, allowed) {
  /* DEC-49 REGION is-law-relation-type */
  return refusal("LAW_RELATION_UNKNOWN", `the types this act records are ${allowed.join(", ")}. Nothing was written.`,
                 { type: typeof type === "string" ? type.slice(0, 40) : null, types: [...allowed] });
  /* END DEC-49 REGION is-law-relation-type */
}

/** R2, R21: LAW_RELATION_NO_CITATION through its row, naming the standard whose text the citation must be among, exactly
 *  as `lawRelate` answers it; the one site that mints it (a host answering the code mints it here). */
export function refuseNoCitation(of, citation) {
  /* DEC-49 REGION is-law-relation-cited */
  return refusal("LAW_RELATION_NO_CITATION", `the citation is a content id among the text of ${of}, the passage that makes `
                 + "this row, which you may read. Nothing was written.",
                 { standard: of, citation: typeof citation === "string" ? citation.slice(0, 80) : null });
  /* END DEC-49 REGION is-law-relation-cited */
}

function refuseNotCourt(end, standard, kind) {
  /* DEC-49 REGION is-court-standard */
  return refusal("NOT_A_COURT_STANDARD", `${standard} is a ${kind} standard, not a court decision or order. Nothing was `
                 + "written.", { end, standard, kind });
  /* END DEC-49 REGION is-court-standard */
}

function refuseSelf(standard, portion, detail) {
  /* DEC-49 REGION is-relation-two-ends */
  return refusal("LAW_RELATION_SELF", detail, { standard, portion });
  /* END DEC-49 REGION is-relation-two-ends */
}

/* An end as given: a standard id, or `{standard, portion?}`. */
function endOf(v) {
  if (typeof v === "string") return { standard: v.trim(), portion: null };
  if (isObj(v)) return { standard: str(v.standard), portion: v.portion == null || v.portion === "" ? null : String(v.portion) };
  return { standard: "", portion: null };
}

/* R2: a temporal relation's effective date or enactment event: `YYYY-MM-DD`, `{date}` or `{event, edge}`. An event is
   checked for form only here; whether it exists and has a `when` is the host's `eventDay`. */
function effectiveOf(v) {
  if (isDay(v)) return { date: v, event: null, edge: null };
  if (isObj(v) && isDay(v.date) && v.event == null) return { date: v.date, event: null, edge: null };
  if (isObj(v) && v.date == null && typeof v.event === "string" && /^EVT-/.test(v.event) && isRecordId(v.event)
      && (v.edge === "start" || v.edge === "end")) return { date: null, event: v.event, edge: v.edge };
  return null;
}

export class LawRecords {
  /** R13: `host`, the reads `standards` passes. Every read is required: one missing throws a `TypeError` naming every
   *  read missing, and nothing is written. Construction creates the five tables where absent (R16) and declares them
   *  to `record-core` under `law-relations` (R15). */
  constructor(host) {
    const h = isObj(host) ? host : {};
    const missing = HOST_READS.filter((k) => h[k] === undefined || h[k] === null);
    if (missing.length)
      throw new TypeError(`LawRecords: the host does not supply ${missing.join(", ")} (law-relations R13)`);
    this.k = h;
    migrateLaw(h.sql);
    /* a refusal (another module holding one of the five, or a second construction over one record) is a defect of the
       wiring, as content's is, and throws */
    const declared = h.record.declareTable(MODULE, LAW_TABLES.map((t) => ({ ...t, keys: [...t.keys] })));
    if (declared && declared.ok === false)
      throw new Error(`law-relations: record-core refused its tables: ${declared.code || declared.reason}`
                      + `${declared.table ? ` (${declared.table}, held by ${declared.declaredBy ?? "?"})` : ""}`);
  }

  #id(prefix, fields) {
    return `${prefix}-${sha256HexSync(JSON.stringify({ ...fields, nonce: this.k.nonce() })).slice(0, 24)}`;
  }

  /* NO_SUCH_STANDARD (`standards` R17, the host's) for an end the viewer may not read, else the row. A viewer never
     sent is an internal caller, which sight does not ask (membership's terms); a viewer the record admits to nothing
     reads nothing. */
  #held(id, viewer, end) {
    const row = this.k.row(id);
    if (!row || (viewer != null && !this.k.readable(id, viewer))) return { refused: this.k.noSuchStandard(id || null, { id: id || null, end }) };
    return { row };
  }

  /* A citation that is one of `standardId`'s text passages and that the viewer may read. */
  #cited(standardId, citation, viewer) {
    if (typeof citation !== "string" || !citation.trim()) return false;
    if (!this.k.texts(standardId).includes(citation.trim())) return false;
    const c = this.k.content().contentRow(citation.trim());
    return !!c && (viewer == null || this.k.membership.inSight(c.bundle_id, viewer));
  }

  /* R11, R20: a passage the viewer may read (an internal caller, none sent, reads every one). */
  #sees(contentId, viewer) {
    const c = this.k.content().contentRow(contentId);
    return !!c && (viewer == null || this.k.membership.inSight(c.bundle_id, viewer));
  }

  /* R19: both ends of a relation, link or treatment are standards the viewer may read (an internal caller, none sent,
     reads every one); otherwise the item is neither answered nor counted. */
  #endsSeen(a, b, viewer) {
    return viewer == null || (this.k.readable(a, viewer) && this.k.readable(b, viewer));
  }

  /* A proposal named by an adoption: held, of this kind, not yet adopted; its fields, or a refusal. */
  #proposalFor(id, what) {
    if (id == null || id === "") return { fields: {}, id: null };
    const p = this.k.one(`SELECT * FROM law_proposals WHERE proposal_id=? AND what=?`, String(id), what);
    if (!p) return { refused: this.k.refuseNoSuchProposal(String(id).slice(0, 80)) };
    const held = this.#adoption(p.proposal_id);
    if (held) return { refused: this.k.refuseProposalAdopted(p.proposal_id, held) };
    return { fields: safeJson(p.fields_json) || {}, id: p.proposal_id };
  }

  #adoption(proposalId) {
    for (const [t, col] of [["law_relations", "relation_id"], ["court_links", "link_id"], ["court_treatments", "treatment_id"]]) {
      const r = this.k.one(`SELECT ${col} AS id FROM ${t} WHERE proposal_id=?`, proposalId);
      if (r) return r.id;
    }
    return null;
  }

  /* A member's act over a proposal's fields: each field the member does not state is the proposal's. */
  #merge(a, what) {
    const p = this.#proposalFor(a.proposal, what);
    if (p.refused) return p;
    const out = { ...a };
    const taken = [];
    for (const [f, v] of Object.entries(p.fields)) if (out[f] == null || out[f] === "") { out[f] = v; taken.push(f); }
    return { args: out, proposal: p.id, taken };
  }

  /* ===================================================================== *
   * R2, R9: A LAW RELATION, BY A MEMBER'S ACT
   * ===================================================================== */

  lawRelate(args = {}) {
    const a0 = isObj(args) ? args : {};
    const byMachine = machineRelate(a0.author);
    if (byMachine) return byMachine;
    const unknown = this.k.refuseFieldUnknown(a0, RELATE_KEYS);
    if (unknown) return unknown;
    const m = this.#merge(a0, "relation");
    if (m.refused) return m.refused;
    const r = this.#relateRefusal(m.args);
    if (r.ok === false) return r;
    return this.k.record.transact(() => {
      const at = this.k.when();
      const f = r.fields;
      const id = this.#id("lrel", { ...f, at });
      this.k.sql.exec(`INSERT INTO law_relations (relation_id, type, class, from_standard, from_portion, to_standard,
                         to_portion, citation, effective_date, effective_event, effective_edge, proposal_id, reason, author, at,
                         edition)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                      id, f.type, f.cls, f.from.standard, f.from.portion, f.to.standard, f.to.portion, f.citation,
                      f.effective ? f.effective.date : null, f.effective ? f.effective.event : null,
                      f.effective ? f.effective.edge : null, m.proposal, f.reason, str(a0.author), at, f.edition);
      return { ok: true, relation: this.#relationAnswer(this.k.one(`SELECT * FROM law_relations WHERE relation_id=?`, id)),
               ...(m.proposal ? { adopted: { proposal: m.proposal, from_proposal: m.taken } } : {}) };
    });
  }

  /* R2's refusals after the author and the fields, in order, with R9's after the citation; `{ok: true, fields}` when
     none applies. */
  #relateRefusal(a) {
    const type = a.type;
    const cls = LAW_RELATIONS.temporal.includes(type) ? "temporal" : LAW_RELATIONS.referential.includes(type) ? "referential" : null;
    if (!cls) return refuseRelationUnknown(type, [...LAW_RELATIONS.temporal, ...LAW_RELATIONS.referential]);
    const viewer = a.viewer ?? null;
    const from = endOf(a.from), to = endOf(a.to);
    const f = this.#held(from.standard, viewer, "from");
    if (f.refused) return f.refused;
    const t = this.#held(to.standard, viewer, "to");
    if (t.refused) return t.refused;
    for (const [end, e, row] of [["from", from, f.row], ["to", to, t.row]])
      if (e.portion !== null && e.portion !== row.portion_path) return this.k.portionUnknown(end, e.standard, e.portion);
    if (from.standard === to.standard && from.portion === to.portion)
      return refuseSelf(from.standard, from.portion, "both ends name the same standard and portion. Nothing was written.");
    if (!this.#cited(from.standard, a.citation, viewer)) return refuseNoCitation(from.standard, a.citation);
    const given = a.edition !== undefined && a.edition !== null;
    /* DEC-49 REGION is-incorporation-edition */
    if (type === "incorporates" ? typeof a.edition !== "string" || !a.edition.trim() || [...a.edition.trim()].length > EDITION_MAX
                                : given)
      return refusal("LAW_RELATION_NO_EDITION", type === "incorporates"
        ? `an incorporation by reference names the edition incorporated, in 1 to ${EDITION_MAX} characters. Nothing was written.`
        : `only an incorporation carries an edition, and this relation is ${type}. Nothing was written.`,
        { type, max_chars: EDITION_MAX });
    /* END DEC-49 REGION is-incorporation-edition */
    let effective = null;
    if (cls === "temporal") {
      effective = effectiveOf(a.effective);
      /* DEC-49 REGION is-temporal-effective */
      if (!effective)
        return refusal("LAW_RELATION_NO_EFFECTIVE", localize("law-relations.index.no_effective_detail", "a temporal relation takes effect on a date (YYYY-MM-DD) or at an enactment event ({event: EVT-…, edge: start or end}). Nothing was written."));
      /* END DEC-49 REGION is-temporal-effective */
    }
    const fault = reasonFault(a.reason);
    if (fault) return this.k.refuseReason(fault);
    return { ok: true, fields: { type, cls, from, to, citation: a.citation.trim(), effective,
                                 edition: type === "incorporates" ? a.edition.trim() : null, reason: a.reason } };
  }

  #relationAnswer(r) {
    const w = this.#withdrawal(r.relation_id);
    return { id: r.relation_id, type: r.type, class: r.class,
             from: { standard: r.from_standard, portion: r.from_portion ?? null },
             to: { standard: r.to_standard, portion: r.to_portion ?? null }, citation: r.citation,
             effective: r.class === "temporal" ? (r.effective_event ? { event: r.effective_event, edge: r.effective_edge }
                                                                    : { date: r.effective_date }) : null,
             ...(r.type === "incorporates" ? { edition: r.edition ?? null } : {}),
             reason: r.reason, by: r.author, at: r.at, proposal: r.proposal_id ?? null,
             withdrawn: w ? { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } : null };
  }

  #withdrawal(id) { return this.k.one(`SELECT * FROM law_withdrawals WHERE item_id=?`, id); }

  /** R1, R11, R19: the relations a standard is an end of, temporal and referential in two lists, never mixed; a
   *  relation whose passage, or either end, the viewer may not read is neither answered nor counted. Withdrawn ones are
   *  answered, marked. Writes nothing. */
  lawRelationsOf({ standard = null, viewer = null } = {}) {
    const id = str(standard);
    if (!id) return this.k.refuseNoId("lawrelations");
    const h = this.#held(id, viewer, "standard");
    if (h.refused) return h.refused;
    const rows = this.k.rows(`SELECT * FROM law_relations WHERE from_standard=? OR to_standard=? ORDER BY relation_id
                              LIMIT ?`, id, id, SCAN_MAX + 1);
    const seen = rows.slice(0, SCAN_MAX)
      .filter((r) => this.#sees(r.citation, viewer) && this.#endsSeen(r.from_standard, r.to_standard, viewer))
      .map((r) => ({ ...this.#relationAnswer(r), direction: r.from_standard === id ? "out" : "in" }));
    return { ok: true, standard: id, temporal: seen.filter((r) => r.class === "temporal"),
             referential: seen.filter((r) => r.class === "referential"), truncated: rows.length > SCAN_MAX,
             says: localize("law-relations.index.says_kept_apart", "temporal relations (amends, repeals, renumbers, recodifies) and referential ones (refers to, defines, excepts, implements, incorporates) are kept apart and never read as one list (D192)") };
  }

  /** R2, R5, R6, R20: withdraw a relation, link or treatment, kept with who, when and why. */
  lawWithdraw({ relation = null, reason = null, author = null } = {}) {
    const byMachine = machineRelate(author);
    if (byMachine) return byMachine;
    const id = str(relation);
    const table = id.startsWith("lrel-") ? ["law_relations", "relation_id"] : id.startsWith("clink-") ? ["court_links", "link_id"]
      : id.startsWith("ctreat-") ? ["court_treatments", "treatment_id"] : null;
    const held = table ? this.k.one(`SELECT 1 AS x FROM ${table[0]} WHERE ${table[1]}=?`, id) : null;
    /* DEC-49 REGION is-law-item-held */
    if (!held)
      return refusal("NO_SUCH_LAW_ITEM", "no law relation, court link or treatment answers to that id here. Nothing was "
                     + "written.", { relation: id || null });
    /* END DEC-49 REGION is-law-item-held */
    const fault = reasonFault(reason);
    if (fault) return this.k.refuseReason(fault);
    const w = this.#withdrawal(id);
    if (w) return { ok: true, already: true, relation: id, withdrawn: { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } };
    return this.k.record.transact(() => {
      const at = this.k.when();
      this.k.sql.exec(`INSERT INTO law_withdrawals (item_id, reason, withdrawn_by, withdrawn_at) VALUES (?,?,?,?)`,
                      id, reason, str(author), at);
      return { ok: true, relation: id, withdrawn: { by: str(author), at, reason },
               says: word("law-relations.says.withdrawn_deleted_row") };
    });
  }

  /** R2, R5, R6, R14, R20: a suggestion of a relation, link or treatment, stored apart, labelled with who proposed it
   *  and whether it is machine work, through record-grammar's `law_relation` subject (its R49), never `standard`. It
   *  moves no answer: only a member's act naming it (`proposal`) records a row. */
  lawPropose(args = {}) {
    const a = isObj(args) ? args : {};
    const what = a.what;
    if (!Object.hasOwn(PROPOSAL_FIELDS, what ?? "")) return refuseRelationUnknown(what, Object.keys(PROPOSAL_FIELDS));
    const keys = [...PROPOSAL_FIELDS[what].filter((k) => !["author", "viewer", "proposal", "reason"].includes(k)), "what",
                  "why", "proposer", "viewer"];
    const unknown = this.k.refuseFieldUnknown(a, keys);
    if (unknown) return unknown;
    const who = str(a.proposer);
    if (!who) return this.k.refuseProposerUnnamed();
    const why = str(a.why);
    if (!why || why.length > WHY_MAX) return this.k.refuseWhyInvalid();
    const fields = Object.fromEntries(Object.entries(a).filter(([k]) => !["what", "why", "proposer", "viewer"].includes(k)));
    return this.k.record.transact(() => {
      const at = this.k.when();
      const id = this.#id("lprop", { what, fields, at });
      this.k.sql.exec(`INSERT INTO law_proposals (proposal_id, what, fields_json, why, proposed_by, proposed_at)
                       VALUES (?,?,?,?,?,?)`, id, what, JSON.stringify(fields), why, who, at);
      const label = proposalLabel(who, "law_relation");
      return { ok: true, proposal: { id, what, fields, why, at, by: label.by, state: label.state,
                                     machine_work: label.machine_work, label: label.says, adopted_as: null },
               recorded: false,
               says: word("law-relations.says.proposal_moves_answer", { what: String(what) }) };
    });
  }

  /* ===================================================================== *
   * R5, R6, R8: COURT LINKS AND TREATMENT ROWS
   * ===================================================================== */

  courtLink(args = {}) {
    const a0 = isObj(args) ? args : {};
    const byMachine = machineRelate(a0.author);
    if (byMachine) return byMachine;
    const unknown = this.k.refuseFieldUnknown(a0, LINK_KEYS);
    if (unknown) return unknown;
    const m = this.#merge(a0, "link");
    if (m.refused) return m.refused;
    const r = this.#linkRefusal(m.args);
    if (r.ok === false) return r;
    return this.k.record.transact(() => {
      const at = this.k.when();
      const f = r.fields;
      const id = this.#id("clink", { ...f, at });
      this.k.sql.exec(`INSERT INTO court_links (link_id, type, from_standard, to_standard, to_portion, citation, proposal_id,
                         reason, author, at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                      id, f.type, f.from, f.to.standard, f.to.portion, f.citation, m.proposal, f.reason, str(a0.author), at);
      return { ok: true, link: this.#linkAnswer(this.k.one(`SELECT * FROM court_links WHERE link_id=?`, id)),
               ...(m.proposal ? { adopted: { proposal: m.proposal, from_proposal: m.taken } } : {}) };
    });
  }

  #linkRefusal(a) {
    if (!COURT_LINKS.includes(a.type)) return refuseRelationUnknown(a.type, COURT_LINKS);
    const viewer = a.viewer ?? null;
    const from = endOf(a.from), to = endOf(a.to);
    const f = this.#held(from.standard, viewer, "from");
    if (f.refused) return f.refused;
    const t = this.#held(to.standard, viewer, "to");
    if (t.refused) return t.refused;
    if (f.row.kind !== "court") return refuseNotCourt("from", from.standard, f.row.kind);
    /* DEC-49 REGION is-link-target-law */
    if (!LINK_TARGET_KINDS.includes(t.row.kind))
      return refusal("COURT_LINK_TARGET_NOT_LAW", `${to.standard} is a ${t.row.kind} standard; a court link ends at a `
                     + `${LINK_TARGET_KINDS.join(", ")}. Nothing was written.`, { standard: to.standard, kind: t.row.kind });
    /* END DEC-49 REGION is-link-target-law */
    if (to.portion !== null && to.portion !== t.row.portion_path) return this.k.portionUnknown("to", to.standard, to.portion);
    if (!this.#cited(from.standard, a.citation, viewer)) return refuseNoCitation(from.standard, a.citation);
    const fault = reasonFault(a.reason);
    if (fault) return this.k.refuseReason(fault);
    return { ok: true, fields: { type: a.type, from: from.standard, to, citation: a.citation.trim(), reason: a.reason } };
  }

  #linkAnswer(r) {
    const w = this.#withdrawal(r.link_id);
    return { id: r.link_id, type: r.type, from: { standard: r.from_standard },
             to: { standard: r.to_standard, portion: r.to_portion ?? null }, citation: r.citation, reason: r.reason,
             by: r.author, at: r.at, proposal: r.proposal_id ?? null,
             withdrawn: w ? { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } : null };
  }

  courtTreat(args = {}) {
    const a0 = isObj(args) ? args : {};
    const byMachine = machineRelate(a0.author);
    if (byMachine) return byMachine;
    const unknown = this.k.refuseFieldUnknown(a0, TREAT_KEYS);
    if (unknown) return unknown;
    const m = this.#merge(a0, "treatment");
    if (m.refused) return m.refused;
    const r = this.#treatRefusal(m.args);
    if (r.ok === false) return r;
    return this.k.record.transact(() => {
      const at = this.k.when();
      const f = r.fields;
      const id = this.#id("ctreat", { ...f, at });
      this.k.sql.exec(`INSERT INTO court_treatments (treatment_id, decision, treatment, by_decision, citation, proposal_id,
                         reason, author, at) VALUES (?,?,?,?,?,?,?,?,?)`,
                      id, f.decision, f.treatment, f.by, f.citation, m.proposal, f.reason, str(a0.author), at);
      return { ok: true, treatment: this.#treatAnswer(this.k.one(`SELECT * FROM court_treatments WHERE treatment_id=?`, id)),
               ...(m.proposal ? { adopted: { proposal: m.proposal, from_proposal: m.taken } } : {}) };
    });
  }

  #treatRefusal(a) {
    /* DEC-49 REGION is-treatment-known */
    if (!TREATMENTS.includes(a.treatment))
      return refusal("TREATMENT_UNKNOWN", `a treatment is one of ${TREATMENTS.join(", ")}. Nothing was written.`,
                     { treatment: typeof a.treatment === "string" ? a.treatment.slice(0, 40) : null,
                       treatments: [...TREATMENTS] });
    /* END DEC-49 REGION is-treatment-known */
    const viewer = a.viewer ?? null;
    const decision = str(a.decision), by = str(a.by_decision);
    const d = this.#held(decision, viewer, "decision");
    if (d.refused) return d.refused;
    const b = this.#held(by, viewer, "by_decision");
    if (b.refused) return b.refused;
    if (d.row.kind !== "court") return refuseNotCourt("decision", decision, d.row.kind);
    if (b.row.kind !== "court") return refuseNotCourt("by_decision", by, b.row.kind);
    if (decision === by)
      return refuseSelf(decision, null, "a decision is treated by a later decision, and both named are the same. Nothing "
                        + "was written.");
    if (!this.#cited(by, a.citation, viewer)) return refuseNoCitation(by, a.citation);
    const fault = reasonFault(a.reason);
    if (fault) return this.k.refuseReason(fault);
    return { ok: true, fields: { decision, treatment: a.treatment, by, citation: a.citation.trim(), reason: a.reason } };
  }

  #treatAnswer(r) {
    const w = this.#withdrawal(r.treatment_id);
    return { id: r.treatment_id, decision: r.decision, treatment: r.treatment, by_decision: r.by_decision,
             citation: r.citation, reason: r.reason, by: r.author, at: r.at, proposal: r.proposal_id ?? null,
             withdrawn: w ? { by: w.withdrawn_by, at: w.withdrawn_at, reason: w.reason } : null };
  }

  /** R6, R19, R20: whether a decision still stood on a date: `not_standing` on a held ending treatment effective (the
   *  later decision's stated start) on or before `date`; `standing` on a held affirmance so effective and no ending
   *  one; otherwise `undetermined`, saying the later history is not read. Never a default of standing. A withdrawn
   *  treatment, or one whose passage or later decision the viewer may not read, is not read. Writes nothing. */
  stillStanding({ decision = null, date = null, viewer = null } = {}) {
    const id = str(decision);
    if (!id) return this.k.refuseNoId("stillstanding");
    if (!isDay(date)) return this.k.refuseDateInvalid(date);
    const h = this.#held(id, viewer, "decision");
    if (h.refused) return h.refused;
    if (h.row.kind !== "court") return refuseNotCourt("decision", id, h.row.kind);
    const rows = this.k.rows(`SELECT t.* FROM court_treatments t WHERE t.decision=? AND NOT EXISTS
                                (SELECT 1 FROM law_withdrawals w WHERE w.item_id=t.treatment_id) ORDER BY t.treatment_id`, id)
      .filter((t) => this.#sees(t.citation, viewer) && this.#endsSeen(t.decision, t.by_decision, viewer));
    const eff = (t) => { const b = this.k.row(t.by_decision); return b ? b.period_from ?? null : null; };
    const ending = rows.filter((t) => ENDING.includes(t.treatment));
    const ended = ending.filter((t) => eff(t) !== null && eff(t) <= date);
    const base = { ok: true, decision: id, date, treatments: rows.map((t) => ({ ...this.#treatAnswer(t), effective: eff(t) })) };
    if (ended.length)
      return { ...base, state: "not_standing", by: ended.map((t) => t.treatment_id),
               why: ended.map((t) => `${t.by_decision} ${t.treatment} it, effective ${eff(t)}`).join("; ") };
    const unsure = ending.filter((t) => eff(t) === null);
    if (unsure.length)
      return { ...base, state: "undetermined", by: unsure.map((t) => t.treatment_id),
               why: unsure.map((t) => word("law-relations.why.record_state", { by_decision: String(t.by_decision), treatment: String(t.treatment) })).join("; ") };
    const affirmed = rows.filter((t) => t.treatment === "affirmed" && eff(t) !== null && eff(t) <= date);
    if (affirmed.length)
      return { ...base, state: "standing", by: affirmed.map((t) => t.treatment_id),
               why: word("law-relations.why.affirmed_reversal_vacatur", { affirmed: String(affirmed.map((t) => t.by_decision).join(", ")), date: String(date) }) };
    return { ...base, state: "undetermined", by: [],
             why: word("law-relations.why.record_holds_treatment", { id: String(id), date: String(date) }) };
  }

  /* ===================================================================== *
   * R10: THE RELATION BOUND; R3: RECODIFICATION ACROSS ADDRESSES
   * ===================================================================== */

  /** R10: the temporal relations whose `to` is `standardId` and which are not withdrawn, in relation id order, each a
   *  row with its type and its effective date, or its enactment event and edge. It reads no viewer: it is the host's
   *  internal read, and the host's R20 answers the bound. Writes nothing. */
  boundsOn(standardId) {
    return this.k.rows(`SELECT r.* FROM law_relations r WHERE r.to_standard=? AND r.class='temporal' AND NOT EXISTS
                          (SELECT 1 FROM law_withdrawals w WHERE w.item_id=r.relation_id) ORDER BY r.relation_id`, standardId);
  }

  /** R3, R19, R20: every key and portion the provision has been held under, following adopted `renumbers` and
   *  `recodifies` relations both ways, bounded by connection-grammar's default depth. A relation whose passage, or
   *  either end, the viewer may not read is not followed. Never throws. */
  addressesOf({ key = null, portion = null, viewer = null } = {}) {
    try {
      const k = str(key);
      if (!k) return this.k.refuseNoId("addresses");
      const p = portion == null || portion === "" ? null : String(portion);
      const start = [...this.k.idsAtKey(k, p)];
      const seen = new Set(start), out = [];
      let frontier = start, depth = 0, truncated = false;
      while (frontier.length) {
        if (depth >= BOUNDS.depth_default) { truncated = true; break; }
        depth++;
        const next = [];
        for (const id of frontier) {
          const rels = this.k.rows(`SELECT r.* FROM law_relations r WHERE (r.from_standard=? OR r.to_standard=?) AND r.type IN
                                      ('${MOVES.join("','")}') AND NOT EXISTS (SELECT 1 FROM law_withdrawals w
                                      WHERE w.item_id=r.relation_id) ORDER BY r.relation_id`, id, id);
          for (const r of rels) {
            if (viewer != null && (!this.#sees(r.citation, viewer) || !this.#endsSeen(r.from_standard, r.to_standard, viewer))) continue;
            const other = r.from_standard === id ? r.to_standard : r.from_standard;
            if (seen.has(other)) continue;
            seen.add(other);
            next.push(other);
            const o = this.k.row(other);
            out.push({ standard: other, key: o ? o.instrument ?? null : null, portion: o ? o.portion_path ?? null : null,
                       via: { relation: r.relation_id, type: r.type,
                              effective: r.effective_event ? { event: r.effective_event, edge: r.effective_edge }
                                                           : { date: r.effective_date } }, depth });
          }
        }
        frontier = next;
      }
      return { ok: true, key: k, portion: p, held_under: start, addresses: out, truncated,
               ...(truncated ? { why: word("law-relations.why.chain_renumberings_recodifications", { depth_default: String(BOUNDS.depth_default) }) } : {}) };
    } catch {
      return { ok: true, key: str(key), portion: portion ?? null, addresses: [], truncated: true,
               why: word("law-relations.why.addresses_read") };
    }
  }

  /* ===================================================================== *
   * R4: THE CITATION RESOLVER (COURTS C1; K1449)
   * ===================================================================== */

  /** R4, R20: `verified` only when a held capture the viewer may see states the citation (volume, reporter and page): a
   *  passage of a `court` standard's text. Otherwise `not verified`, refusing nothing (D88). With `lookup: true` the
   *  keyed lookup's matches are added, labelled as the service's and never as verified; switched off, it says so. It
   *  reads at most 2,000 court standards, saying so past it, and writes nothing. */
  async resolveCourtCitation({ citation = null, viewer = null, lookup = false } = {}) {
    const read = typeof citation === "string" ? (this.k.recognise(citation).citations || [])[0] || null
      : isObj(citation) ? citation : null;
    const c = read && Number.isInteger(Number(read.volume)) && typeof read.reporter === "string"
      && Number.isInteger(Number(read.page)) ? { volume: Number(read.volume), reporter: read.reporter, page: Number(read.page) }
      : null;
    const base = { ok: true, citation: c, as_given: typeof citation === "string" ? citation.slice(0, 400) : citation ?? null };
    let answer;
    if (!c) {
      answer = { ...base, state: "not verified", verified: false, held: [],
                 why: word("law-relations.why.court_citation_volume") };
    } else {
      const held = this.#statedIn(c, viewer);
      answer = held.found.length
        ? { ...base, state: "verified", verified: true, held: held.found,
            why: word("law-relations.why.held_capture_states", { volume: String(c.volume), reporter: String(c.reporter), page: String(c.page), found: String(held.found.map((h) => h.standard).join(", ")) }) }
        : { ...base, state: "not verified", verified: false, held: [],
            why: word("law-relations.why.held_capture_see", { volume: String(c.volume), reporter: String(c.reporter), page: String(c.page), truncated: held.truncated
              ? word("law-relations.why.first_court_standards", { scan_max: String(SCAN_MAX) }) : "" }) };
    }
    if (!lookup) return { ...answer, lookup: null };
    const text = typeof citation === "string" ? citation : c ? `${c.volume} ${c.reporter} ${c.page}` : null;
    let l;
    try { l = text ? await this.k.citationLookup({ text, viewer }) : null; } catch { l = { ok: false, reason: "LOOKUP_FAILED" }; }
    if (!l || l.ok !== true)
      return { ...answer, lookup: { on: false, reason: l ? l.reason ?? null : "NO_TEXT",
                                    says: word("law-relations.says.keyed_citation_lookup") } };
    return { ...answer, lookup: { on: true, service: l.service ?? null, citations: l.citations ?? [], verified: false,
                                  label: l.label ?? word("law-relations.label.service_answer_verified") } };
  }

  /* The court standards whose text passages state the citation, each with the capture and extent. */
  #statedIn(c, viewer) {
    const courts = [...this.k.idsOfKind("court", SCAN_MAX + 1)];
    const found = [];
    for (const sid of courts.slice(0, SCAN_MAX)) {
      for (const cid of this.k.texts(sid)) {
        const row = this.k.content().contentRow(cid);
        if (!row || !this.k.membership.inSight(row.bundle_id, viewer)) continue;
        const text = this.k.content().passageText(cid);
        if (typeof text !== "string") continue;
        const hit = (this.k.recognise(text).citations || []).find((x) => x.volume === c.volume && x.reporter === c.reporter
                                                                      && x.page === c.page);
        if (hit) found.push({ standard: sid, content_id: cid, capture_sha: row.capture_sha, bundle_id: row.bundle_id,
                              extent: { kind: row.extent_kind, ...(safeJson(row.extent) || {}) },
                              at: { start: hit.start, end: hit.end } });
      }
    }
    return { found, truncated: courts.length > SCAN_MAX };
  }

  /* ===================================================================== *
   * R7: THE CONNECTION OWNER'S READ
   * ===================================================================== */

  /** R7, R19, R20 (`connection-grammar` R6–R8): for a standard node, its relations and links valid at `at`; for an
   *  event node, the held standards in force at the event's `when` (`standards` R20, through the host), each a derived
   *  item. Sight: an evidentiary item is answered only when the viewer may read its passage and both its ends; a
   *  derived one only when the viewer may read the event. */
  neighbours({ node = null, kinds = null, at = null, page = null, viewer, scope = null } = {}) {
    if (viewer === undefined || viewer === null || viewer === "")
      return { refused: "VIEWER_MISSING", why: localize("law-relations.index.read_names_member", "a read names the member reading; an absent viewer is neither an administrator nor the public") };
    const own = CONNECTION_KINDS.map((k) => k.kind);
    const asked = Array.isArray(kinds) ? kinds.filter((k) => own.includes(k)) : own;
    const id = typeof node === "string" ? node : "";
    const all = /^EVT-/.test(id) ? this.#eventItems(id, asked, viewer) : this.#standardItems(id, asked, viewer);
    const live = [];
    for (const item of all) {
      let v;
      try { v = validAt({ valid: item.valid }, at); } catch { v = { undetermined: true }; }
      if (v === "out" || (v && v.refused)) continue;
      live.push(v === "in" ? item : { ...item, undetermined: { why: v.why || { key: "law-relations.why.undetermined_date_asked", vars: {} } } });
    }
    live.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    if (live.length > BOUNDS.hub)
      return { items: [], hub: { set_size: live.length, why: word("law-relations.why.node_connections_hub", { live: String(live.length), hub: String(BOUNDS.hub) }) } };
    const after = isObj(page) && typeof page.after === "string" ? page.after : null;
    const rest = after ? live.filter((i) => i.id > after) : live;
    const items = rest.slice(0, BOUNDS.fanout);
    return rest.length > BOUNDS.fanout ? { items, next: { after: items[items.length - 1].id }, truncated: true } : { items };
  }

  /* The relations and links with `id` at one end, not withdrawn, whose passage and ends the viewer may read. */
  #standardItems(id, asked, viewer) {
    if (!this.k.row(id)) return [];
    const out = [];
    const rels = this.k.rows(`SELECT r.* FROM law_relations r WHERE (r.from_standard=? OR r.to_standard=?) AND NOT EXISTS
                                (SELECT 1 FROM law_withdrawals w WHERE w.item_id=r.relation_id)`, id, id);
    for (const r of rels) {
      if (!asked.includes(`law_${r.type}`) || !this.#sees(r.citation, viewer)
          || !this.#endsSeen(r.from_standard, r.to_standard, viewer)) continue;
      out.push(this.#item({ id: r.relation_id, kind: `law_${r.type}`, from: r.from_standard, to: r.to_standard,
        citation: r.citation, effective: r.effective_event ? this.k.eventDay(r.effective_event, r.effective_edge, viewer)
                                                           : r.effective_date, ...(r.from_portion ? { from_portion: r.from_portion } : {}),
        ...(r.to_portion ? { to_portion: r.to_portion } : {}) }));
    }
    const links = this.k.rows(`SELECT l.* FROM court_links l WHERE (l.from_standard=? OR l.to_standard=?) AND NOT EXISTS
                                 (SELECT 1 FROM law_withdrawals w WHERE w.item_id=l.link_id)`, id, id);
    for (const l of links) {
      if (!asked.includes(`court_${l.type}`) || !this.#sees(l.citation, viewer)
          || !this.#endsSeen(l.from_standard, l.to_standard, viewer)) continue;
      out.push(this.#item({ id: l.link_id, kind: `court_${l.type}`, from: l.from_standard, to: l.to_standard,
                            citation: l.citation, effective: null, ...(l.to_portion ? { to_portion: l.to_portion } : {}) }));
    }
    return out;
  }

  /* An evidentiary item: valid over its `from` standard's period, starting at the relation's effective date when it
     has one; graded by the passage's transcription ceiling and each end's text (R12, through the host's `gradeOf`). */
  #item({ id, kind, from, to, citation, effective, ...extra }) {
    const f = this.k.row(from);
    const p = this.k.periodOf(f);
    const start = typeof effective === "string" ? effective : effective && effective.day ? effective.day : p.from;
    const assertion = this.k.gradeOf([citation]);
    return { id, from, to, kind, owner: CONNECTION_OWNER,
             valid: { from: start ?? null, to: p.to ?? null, precision: "day", zone: this.k.zone() },
             evidence: [{ source: citation, content_id: citation }],
             grade: { assertion: assertion.grade, ends: [this.k.gradeOf(this.k.texts(from)).grade, this.k.gradeOf(this.k.texts(to)).grade] },
             grade_why: assertion.why, derived: null, ...extra };
  }

  /* The held standards in force at the event's `when` (`standards` R20, the host's), each a derived item; nothing for
     an event the viewer may not read or with no `when` (each said in the item's absence, never a guess). */
  #eventItems(eventId, asked, viewer) {
    if (!asked.includes("in_force_at_event")) return [];
    const ev = this.k.eventWhen(eventId, viewer);
    if (!ev || !ev.day) return [];
    const ids = [...this.k.idsCovering(ev.day)];
    /* every candidate is asked, so the hub bound (neighbours) is judged on the whole set, never a cut one */
    const out = [];
    for (const sid of ids) {
      const f = this.k.inForceAt({ standard: sid, date: ev.day, viewer });
      if (!f || f.ok === false || f.state === "not_in_force") continue;
      const p = this.k.periodOf(this.k.row(sid));
      const derived = { method: IN_FORCE_METHOD, inputs: [eventId, sid], as_of: ev.day };
      out.push({ id: derivedId({ kind: "in_force_at_event", from: eventId, to: sid, as_of: ev.day, method: IN_FORCE_METHOD }),
                 from: eventId, to: sid, kind: "in_force_at_event", owner: CONNECTION_OWNER,
                 valid: { from: p.from ?? null, to: p.to ?? null, precision: "day", zone: this.k.zone() },
                 evidence: [], grade: { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, this.k.gradeOf(this.k.texts(sid)).grade] },
                 grade_why: word("law-relations.derived_read_event"),
                 derived, in_force: { state: f.state, why: f.why } });
    }
    return out;
  }
}

/** R12: the grade a set of passages earns on the transcription axis: the weakest ceiling among them (`content.standings`'
 *  shape, BASIS_GRADES strongest first), the lowest grade with why when any is undetermined or not held, and the lowest
 *  grade when none is named. Pure; never throws. */
export function weakestCeiling(standings, ids) {
  let grade = null;
  const whys = [];
  let list;
  try { list = Array.isArray(ids) ? [...ids] : []; } catch { list = []; }
  for (const id of list) {
    let s = null;
    try { s = isObj(standings) ? standings[id] ?? null : null; } catch { s = null; }
    const t = isObj(s) && isObj(s.transcription) ? s.transcription : null;
    const g = t ? t.ceiling : null;
    if (!BASIS_GRADES.includes(g)) {
      let name;
      try { name = String(id).slice(0, 12); } catch { name = "a passage"; }
      whys.push(`${name}…: ${t ? (typeof t.why === "string" && t.why) || "undetermined" : "not held"}`);
      grade = LOWEST_GRADE; continue;
    }
    grade = grade === null ? g : weaker(grade, g);
  }
  return { grade: grade ?? LOWEST_GRADE, why: whys.length ? word("law-relations.why.lowest_grade", { whys: String(whys.join("; ")) }) : null };
}

/** Row census helper for tests: the codes this module mints. */
export const LAW_CODES = Object.freeze(Object.keys(LAW_RELATIONS_CHECKS));
