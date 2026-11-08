// @ts-check
/* hypotheses (layer 6; T33-46; K1467, K1473, K1487, K1489): a member's hunches and hypotheses, held as labelled rows
 * of the working inquiry. Never facts, never legs, never moving a grade or a finding (R8); a hypothesised cause stays a
 * hypothesis and is never recorded as an event relation (R9).
 *
 *   hold, revise, withdraw, hypothesesOf, read (R1–R3)   the acts and reads; nothing is edited in place
 *   neighbours (R4)                                       the hunch hops, registered as the connection owner of
 *                                                         `hunch`, answered only inside the inquiry holding them
 *   check (R5, R6)                                        registered with `promotion` (its R39): no leg rests on a
 *                                                         hypothesis or on a derived connection carrying a lead
 *   noteWrite, noteRevise, notesOf, noteTurn, noteDelete  a member's own notes, answered to their author alone;
 *   (R11–R15)                                             revised in place and deleted for good (DEC-144)
 *   hypothesisPropose, hypothesisTakeUp,                  the system's proposals, stored apart and labelled the
 *   hypothesisSetAside, proposalsOf (R16–R18)             system's; a member takes one up as hers or sets it aside
 *   noteShare, noteUnshare, sharesOf (R19–R21)            a copy of a note's words shared with a project, withdrawable
 *   hypothesisRivals, exploreNext, rivalsOf,              a question's 2 to 6 rival explanations and the members'
 *   rivalHistory, bindSteps, isRival (F1)                 "Explore this next" marks; each rival lists the legs its
 *                                                         steps produced (steps R31, `steps` handed in, never imported)
 *   hypothesesOps (R7)                                    the route arms
 *
 * SHAPE (K61, K1563 (1)). `hypothesesOf(host, deps)` answers the one instance per host; making it creates and declares
 * the tables (R10, R15) and registers the leg check with `promotion`. `deps` may give `record`, `membership`,
 * `promotion`, `explore` (whose `rederive` R6 asks), `calculations` (whose synchronous `gradeFactsOf` R6's calculation
 * arm asks; absent, the host's instance, reached when first asked), `registry` (a connection registry other than the
 * default, for a test), `now` (a clock answering an ISO instant), `inquiry` (whose `personFacts` R19's warning reads;
 * absent, the host's instance, reached when first asked), `personWarning` (a stand-in for inquiry R59's test, for a
 * test; absent, `inquiry.personWarning`, K2479) and `shareId` (a share's id maker, for a test). */
import { isHypothesisId, isMachineIdentity, idPattern, ACCEPTANCE_FORMS, acceptanceRecord } from "../record-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, Membership } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { BOUNDS, HUNCH_LABEL, defaultRegistry, isRecordId } from "../connection-grammar/index.mjs";
import { exploreOf } from "../explore/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { inquiryOf, personWarning as inquiryPersonWarning } from "../inquiry/index.mjs";
import { HYPOTHESES_SCHEMA, HYPOTHESES_TABLES, NOTES_SCHEMA, NOTES_TABLES, NOTES_ADDED_COLUMNS, NOTE_NUMBERS_TABLE,
         PROPOSALS_SCHEMA, PROPOSALS_TABLE, SHARES_SCHEMA, SHARES_TABLE, RIVALS_SCHEMA, RIVALS_TABLES } from "./schema.mjs";
import { HYPOTHESES_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { HYPOTHESES_SCHEMA, HYPOTHESES_TABLES, NOTES_SCHEMA, NOTES_TABLES, NOTE_NUMBERS_TABLE, HYPOTHESES_CHECKS,
         PROPOSALS_TABLE, SHARES_TABLE, RIVALS_TABLES };

/** The module's name: its tables' declarer, its promotion step and the connection owner of `hunch` (R4, R10). */
export const OWNER = "hypotheses";
/** R1: the five kinds of hypothesis, closed. */
export const HYPOTHESIS_KINDS = Object.freeze(["cause", "identity", "relation", "flow", "other"]);
/** R1: the kinds whose nodes are exactly two, `from` and `to`. */
export const PAIRED_KINDS = Object.freeze(["cause", "identity", "relation"]);
/** R3: the label every read carries. */
export const HYPOTHESIS_LABEL = "hypothesis";
/** R4: the one kind this module owns, of class `hunch`, with the members' word. */
export const HUNCH_KINDS = Object.freeze([Object.freeze({ kind: "hunch", word: word("hypotheses.member_hunch"), class: "hunch" })]);
/** R1: a statement, a reason, at most; the nodes of one hypothesis, at most. */
export const STATEMENT_MAX = 4000;
export const REASON_MAX = 2000;
export const ABOUT_MAX = 50;
/** R4: why a hunch hop is undetermined at every date: a hunch states no period (K1563 (2), an undated kind). */
export const UNDATED_WHY = { key: "hypotheses.hunch_states_period", vars: {} };
/** R6: the form of a derived connection's id (`connection-grammar.derivedId`, a SHA-256 in lowercase hex). */
export const DERIVED_ID_RE = /^[0-9a-f]{64}$/;
/** R6 (K1728): a calculation's id, in either form `record-grammar` reads (opaque, and the earlier sequential). */
const CALC_RE = idPattern("CALC");
/** R6: the kinds of a calculation's input whose 64-hex reference names, by definition, something other than a derived
 *  connection (a table's canonical sha256, a passage's content id, a frozen set's or a draw's sha, money facts, a
 *  calculation), so it is never read as one. */
const NOT_A_CONNECTION_REF = Object.freeze(["table", "figure", "set", "draw", "money", "calculation"]);
/** R11: a note's bound, in bytes (`observation-log` R14's bound for a member's own words); refused, never cut. */
export const NOTE_MAX_BYTES = 131072;
/** R13: what a note may become. */
export const NOTE_TURNS = Object.freeze(["observation", "hunch", "question"]);
/** R12: the page of notes: 200 by default, clamped 1…1000. */
export const NOTES_LIMIT = Object.freeze({ default: 200, max: 1000 });
/** R16: the label every proposal of the system's carries, and the heading it is answered under. */
export const SYSTEM_LABEL = "the system's";
export const PROPOSALS_HEADING = word("hypotheses.system_proposals");
/** R16: a proposal's `how` and `run`, at most. */
export const HOW_MAX = 4000;
export const RUN_MAX = 200;
/** R19: a shared note's labels: hers, and narrative. */
export const SHARE_KIND = "narrative";
/** R21: a page of a project's standing shares, at most. */
export const SHARES_MAX = 200;
/** R19: a share's id, opaque and never a record id (`record-grammar` holds no prefix for it). */
export const SHARE_ID_RE = /^share:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** F1 (BD-17; IV-H1): a question holds 2 to 6 rival explanations. */
export const RIVALS_MIN = 2;
export const RIVALS_MAX = 6;
/** F1 (IV-H2): the sentence the screen shows where a member marks a rival "Explore this next" (the ux lane's v5). */
export const EXPLORE_NEXT_NOTICE_KEY = "hypotheses.rivals.explore_next_notice";
/** F1 (IV-H1, IV-H2; layer 12, CR2-19): the codes answered for the rivals and the mark, each a row of this module's
 *  family (C-134.29–C-134.33), its translation the ux lane's `refusal.<CODE>` (DEC-502). The machine's is this module's
 *  own `MACHINE_CANNOT_MARK_RIVAL` (C-134.32), never sources' `MACHINE_CANNOT_MARK` (C-121.7). */
export const RIVAL_CODES = Object.freeze(["RIVALS_TOO_FEW", "RIVALS_TOO_MANY", "NOT_IN_INQUIRY", "MACHINE_CANNOT_MARK_RIVAL", "NOT_A_RIVAL"]);
const UTF8 = new TextEncoder();
const HUNCH_VALID = Object.freeze({ from: null, to: null, precision: "day", zone: "UTC" });

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const filled = (v) => typeof v === "string" && v.trim() !== "";
const json = (v) => JSON.stringify(v);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const isThenable = (v) => v !== null && (typeof v === "object" || typeof v === "function") && typeof v.then === "function";

/** Every refusal: `{ok: false, reason, code, check, translation, detail}` (Provides). */
function refuse(code, detail, extra = {}) {
  const row = HYPOTHESES_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
}

/** F1 (IV-H2): the not-evidence sentence, answered where a mark is made and beside the rivals for the dialog. */
export const exploreNextNotice = () => localize("hypotheses.rivals.explore_next_notice", "This sets the order your team explores in. It is not evidence and changes no grade.");

const instances = new WeakMap();
/* K1563 (1): every instance made in this isolate, so the owner registered at load finds the one there is. */
const live = new Set();
const storageOf = (host) => (host && host.storage ? host.storage : host);

/** R4, K1563 (1): the `neighbours` registered at load. With a `host`, that host's instance answers; without one, the
 *  isolate's one instance; otherwise `OWNER_HOST_AMBIGUOUS`. */
export function ownerNeighbours(args) {
  const a = isObj(args) ? args : {};
  const { host, ...rest } = a;
  let h = null;
  if (host !== undefined && host !== null) h = instances.get(storageOf(host)) ?? null;
  else if (live.size === 1) h = [...live][0];
  if (!h) return { refused: "OWNER_HOST_AMBIGUOUS",
                   why: host ? "no hypotheses instance is made over that host" : `${live.size} hypotheses instances are made in this isolate and the read names no host` };
  return h.neighbours(rest);
}
/* R4: registered once, at load, into the registry the plane wires. */
defaultRegistry.registerOwner({ owner: OWNER, kinds: [...HUNCH_KINDS], neighbours: ownerNeighbours });

/** K61, K1563 (1): the one instance per host, made on the first call (`deps` read then only). */
export function hypothesesOf(host, deps = {}) {
  const storage = storageOf(host);
  let h = instances.get(storage);
  if (!h) {
    const record = deps.record ?? recordOf(host);
    const membership = deps.membership ?? membershipOf(host, { record });
    const promotion = deps.promotion ?? promotionOf(host, { record, membership });
    h = new Hypotheses(storage, { ...deps, record, membership, host,
                                  explore: deps.explore ?? null });
    instances.set(storage, h);
    live.add(h);
    h.migrate();
    const r = promotion.registerStep(OWNER, { check: (c) => h.check(c) });
    if (r && r.ok === false) throw new Error(`hypotheses: registerStep refused: ${r.reason}`);
    if (deps.steps) h.bindSteps(deps.steps);
  }
  return h;
}

export class Hypotheses {
  #sql; #record; #membership; #explore; #host; #calculations; #registry; #now; #personWarning; #shareId; #inquiryInst;
  #steps = null;   // F1 (IV-H2; steps R31): the steps instance handed in (`deps.steps` or `bindSteps`), never imported

  constructor(storage, { record, membership, explore = null, host = null, calculations = null, registry = defaultRegistry, now = null,
                         personWarning = null, shareId = null, inquiry = null }) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#explore = explore;
    this.#host = host;
    this.#calculations = calculations;
    this.#registry = registry;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
    this.#personWarning = typeof personWarning === "function" ? personWarning : null;
    this.#inquiryInst = inquiry;
    this.#shareId = typeof shareId === "function" ? shareId : () => `share:${crypto.randomUUID()}`;
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* ---- boot (R4, R10) ---- */

  /** The tables and their declaration (R10), and, for a registry other than the default (a test's), the owner bound to
   *  this instance (R4). Idempotent; a refused declaration is a defect of the wiring and throws. */
  migrate() {
    const bare = (HYPOTHESES_SCHEMA + NOTES_SCHEMA + PROPOSALS_SCHEMA + SHARES_SCHEMA + RIVALS_SCHEMA).split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    /* A copy whose notes table predates a column gains it here (`revised`, T35). */
    for (const [table, column, decl] of NOTES_ADDED_COLUMNS) {
      const have = this.#rows(`PRAGMA table_info(${table})`).map((c) => c.name);
      if (have.length && !have.includes(column)) this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
    this.#renumberNotes();
    if (this.#declared) return { ok: true, already: true };
    const base = { purge: "clear", expunge: "none", export: "yes", sight: "bundle", derive: "stored", version_chain: false,
                   keys: ["bundle_id"] };
    /* R15: a member's notes, their author's alone and never exported, held in the group's copy like every table. */
    const notes = { purge: "clear", expunge: "none", export: "never", sight: "owner", derive: "stored", version_chain: false, keys: [] };
    /* R19: a project's shares, sight the project's, purged with it, never exported (never published, DEC-136 (3)). */
    const shares = { purge: "clear", expunge: "none", export: "never", sight: "bundle", derive: "stored", version_chain: false,
                     keys: ["project_id"] };
    const d = this.#record.declareTable(OWNER, [...HYPOTHESES_TABLES.map((name) => ({ ...base, name })),
                                                ...NOTES_TABLES.map((name) => ({ ...notes, name })),
                                                { ...notes, name: NOTE_NUMBERS_TABLE, purge: "exempt" },
                                                { ...base, name: PROPOSALS_TABLE },
                                                { ...shares, name: SHARES_TABLE },
                                                ...RIVALS_TABLES.map((name) => ({ ...base, name }))]);
    if (d && d.ok === false) throw new Error(`hypotheses: declareTable refused: ${d.reason}`);
    if (this.#registry !== defaultRegistry && !this.#registry.owners().some((o) => o.owner === OWNER)) {
      const r = this.#registry.registerOwner({ owner: OWNER, kinds: [...HUNCH_KINDS], neighbours: (a) => this.neighbours(a) });
      if (r && r.refused) throw new Error(`hypotheses: registerOwner refused: ${r.refused}`);
    }
    this.#declared = true;
    return { ok: true };
  }
  #declared = false;

  /* R14 (T36; N727): a copy whose notes were numbered from one sequence shared across members (`note_id` the table's
     own AUTOINCREMENT key, T34–T35) is renumbered here, once, in one act: each member's notes from 1 in their present
     order, their turns following them, each member's mark set to their last number. The old numbers, and the shared
     sequence's own high-water mark, are kept nowhere. Idempotent: a copy already keyed by `(member, note_id)` is left.
     R23 (T46; K2926): only statements a Durable Object's SQLite authorizes; the working map is an ordinary table made and
     dropped inside the one transaction, never a `TEMP` one, which workerd refuses `SQLITE_AUTH` (0.82.0's cut). */
  #renumberNotes() {
    const keyed = this.#rows(`PRAGMA table_info(member_notes)`).filter((c) => Number(c.pk) > 0).map((c) => c.name);
    if (keyed.length !== 1 || keyed[0] !== "note_id") return;
    this.#record.transact(() => {
      this.#sql.exec(`CREATE TABLE member_notes_renumbered (member TEXT NOT NULL, note_id INTEGER NOT NULL, text TEXT NOT NULL,
                      at TEXT NOT NULL, revised TEXT, PRIMARY KEY (member, note_id))`);
      this.#sql.exec(`CREATE TABLE member_notes_map AS SELECT member, note_id AS old,
                      ROW_NUMBER() OVER (PARTITION BY member ORDER BY note_id) AS new FROM member_notes`);
      this.#sql.exec(`INSERT INTO member_notes_renumbered (member, note_id, text, at, revised)
                      SELECT n.member, m.new, n.text, n.at, n.revised FROM member_notes n JOIN member_notes_map m ON m.old = n.note_id`);
      this.#sql.exec(`UPDATE member_note_turns SET note_id = (SELECT m.new FROM member_notes_map m WHERE m.old = member_note_turns.note_id
                      AND m.member = member_note_turns.member) WHERE EXISTS (SELECT 1 FROM member_notes_map m
                      WHERE m.old = member_note_turns.note_id AND m.member = member_note_turns.member)`);
      /* a turn left on no note of its member (none is made so; R13) went with its note */
      this.#sql.exec(`DELETE FROM member_note_turns WHERE NOT EXISTS (SELECT 1 FROM member_notes_map m
                      WHERE m.new = member_note_turns.note_id AND m.member = member_note_turns.member)`);
      this.#sql.exec(`INSERT INTO member_note_numbers (member, last) SELECT member, MAX(new) FROM member_notes_map GROUP BY member
                      ON CONFLICT (member) DO UPDATE SET last = MAX(last, excluded.last)`);
      this.#sql.exec(`DROP TABLE member_notes_map`);
      this.#sql.exec(`DROP TABLE member_notes`);
      this.#sql.exec(`ALTER TABLE member_notes_renumbered RENAME TO member_notes`);
      this.#sql.exec(`DROP INDEX IF EXISTS member_note_turns_of`);
      this.#sql.exec(`DELETE FROM sqlite_sequence WHERE name IN ('member_notes', 'member_notes_renumbered')`);
      return { ok: true };
    });
  }

  /* ---- sight (R3; K1489) ---- */

  /* The inquiry `id` names, when the viewer may see it: `{bundle}`; else the one answer for absent and hidden alike. */
  #inquiry(id, viewer) {
    const b = filled(id) ? this.#record.bundleInfo(id) : null;
    if (!b || !this.#membership.inSight(id, viewer))
      return { refusal: refuse("NO_SUCH_BUNDLE", "no inquiry by that id is held, or it is not one you may see", { inquiry: filled(id) ? id : null }) };
    if (b.type !== "inquiry") return { refusal: refuse("NOT_AN_INQUIRY", `${id} is a ${b.type}, not an inquiry`, { inquiry: id }) };
    return { bundle: b };
  }

  /* The hypothesis `id` names, when the viewer may see its inquiry; else null (absent and hidden alike). */
  #held(id, viewer) {
    const r = isHypothesisId(id) ? this.#one(`SELECT * FROM hypotheses WHERE hypothesis_id = ?`, id) : null;
    return r && this.#membership.inSight(r.bundle_id, viewer) ? r : null;
  }
  static #noSuch(id) {
    return refuse("NO_SUCH_HYPOTHESIS", "no hypothesis by that id is held, or it is not one you may see", { hypothesis_id: filled(id) ? id : null });
  }

  /* ---- the nodes (R1) ---- */

  /* `about` read for `kind`: `{about, from, to}` or a refusal naming the node. */
  static #about(kind, about) {
    const bad = (detail, node) => ({ refusal: refuse("BAD_ABOUT", detail, node === undefined ? {} : { node }) });
    const known = (v) => typeof v === "string" && isRecordId(v);
    if (isObj(about) && ("from" in about || "to" in about)) {
      for (const end of ["from", "to"])
        if (!known(about[end])) return bad(`${end} is not an id the record's id grammar knows`, about[end] ?? null);
      if (about.from === about.to) return bad("from and to name the same node", about.from);
      return { about: { from: about.from, to: about.to }, from: about.from, to: about.to };
    }
    if (PAIRED_KINDS.includes(kind)) return bad(`a ${kind} names exactly two nodes, {from, to}`);
    if (!Array.isArray(about) || about.length === 0) return bad("name what the hypothesis is about: {from, to} or a list of ids");
    if (about.length > ABOUT_MAX) return bad(`a hypothesis names at most ${ABOUT_MAX} nodes`);
    const odd = about.find((v) => !known(v));
    if (odd !== undefined) return bad("a node is not an id the record's id grammar knows", typeof odd === "string" ? odd : null);
    return { about: [...new Set(about)], from: null, to: null };
  }

  /* ---- the acts (R1, R2) ---- */

  /** R1: `hold({inquiry, kind, statement, about, by})`. */
  hold({ inquiry = null, kind = null, statement = null, about = null, by = null } = {}) {
    const q = this.#inquiry(inquiry, by);
    if (q.refusal) return q.refusal;
    if (isMachineIdentity(by)) return refuse("MACHINE_CANNOT_HYPOTHESISE", "the act's stamp is a machine's; only a member holds a hypothesis (K1473)");
    if (!HYPOTHESIS_KINDS.includes(kind))
      return refuse("UNKNOWN_HYPOTHESIS_KIND", `a hypothesis is one of ${HYPOTHESIS_KINDS.join(", ")}`, { kinds: [...HYPOTHESIS_KINDS] });
    if (!filled(statement)) return refuse("HYPOTHESIS_NO_STATEMENT", "a hypothesis states, in the member's words, what they think");
    const a = Hypotheses.#about(kind, about);
    if (a.refusal) return a.refusal;
    const at = this.#now();
    const text = statement.trim().slice(0, STATEMENT_MAX);
    return this.#record.transact(() => {
      const id = this.#record.allocId("HYP", at.slice(0, 4));
      if (!id || !id.id) return id;
      this.#sql.exec(`INSERT INTO hypotheses (hypothesis_id, bundle_id, kind, statement, about_json, from_node, to_node, held_by, held_at)
                      VALUES (?,?,?,?,?,?,?,?,?)`, id.id, inquiry, kind, text, json(a.about), a.from, a.to, by, at);
      this.#sql.exec(`INSERT INTO hypothesis_revisions (hypothesis_id, bundle_id, act, statement, about_json, reason, by_actor, at)
                      VALUES (?,?,?,?,?,?,?,?)`, id.id, inquiry, "hold", text, json(a.about), null, by, at);
      return { ok: true, hypothesis_id: id.id, kind, label: HYPOTHESIS_LABEL, at };
    });
  }

  /* The checks `revise` and `withdraw` share: the hypothesis seen, a member's act, a reason. */
  #amendable(hypothesisId, reason, by) {
    const r = this.#held(hypothesisId, by);
    if (!r) return { refusal: Hypotheses.#noSuch(hypothesisId) };
    if (isMachineIdentity(by)) return { refusal: refuse("MACHINE_CANNOT_HYPOTHESISE", "the act's stamp is a machine's; only a member changes a hypothesis (K1473)") };
    if (!filled(reason)) return { refusal: refuse("HYPOTHESIS_NO_REASON", "a change to a hypothesis says why, in the member's words") };
    return { row: r, reason: reason.trim().slice(0, REASON_MAX) };
  }

  /** R2: `revise({hypothesisId, statement?, about?, reason, by})` appends a revision; the hypothesis keeps its id. */
  revise({ hypothesisId = null, statement = undefined, about = undefined, reason = null, by = null } = {}) {
    const m = this.#amendable(hypothesisId, reason, by);
    if (m.refusal) return m.refusal;
    const r = m.row;
    if (r.withdrawn) return refuse("HYPOTHESIS_WITHDRAWN", `${r.hypothesis_id} was withdrawn; a withdrawn hypothesis is not revised`, { hypothesis_id: r.hypothesis_id });
    if (statement !== undefined && statement !== null && !filled(statement))
      return refuse("HYPOTHESIS_NO_STATEMENT", "a revised statement says, in the member's words, what they now think");
    const text = filled(statement) ? statement.trim().slice(0, STATEMENT_MAX) : r.statement;
    let a = { about: parse(r.about_json), from: r.from_node, to: r.to_node };
    if (about !== undefined && about !== null) { a = Hypotheses.#about(r.kind, about); if (a.refusal) return a.refusal; }
    const at = this.#now();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE hypotheses SET statement = ?, about_json = ?, from_node = ?, to_node = ? WHERE hypothesis_id = ?`,
                     text, json(a.about), a.from, a.to, r.hypothesis_id);
      this.#sql.exec(`INSERT INTO hypothesis_revisions (hypothesis_id, bundle_id, act, statement, about_json, reason, by_actor, at)
                      VALUES (?,?,?,?,?,?,?,?)`, r.hypothesis_id, r.bundle_id, "revise", text, json(a.about), m.reason, by, at);
      return { ok: true, hypothesis_id: r.hypothesis_id, kind: r.kind, label: HYPOTHESIS_LABEL, at };
    });
  }

  /** R2: `withdraw({hypothesisId, reason, by})` marks it withdrawn; a second withdrawal answers the first. */
  withdraw({ hypothesisId = null, reason = null, by = null } = {}) {
    const m = this.#amendable(hypothesisId, reason, by);
    if (m.refusal) return m.refusal;
    const r = m.row;
    if (r.withdrawn) {
      const w = this.#one(`SELECT by_actor, at, reason FROM hypothesis_revisions WHERE hypothesis_id = ? AND act = 'withdraw' ORDER BY seq LIMIT 1`, r.hypothesis_id);
      return { ok: true, already: true, hypothesis_id: r.hypothesis_id, label: HYPOTHESIS_LABEL,
               withdrawn: w ? { by: w.by_actor, at: w.at, reason: w.reason } : null };
    }
    const at = this.#now();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE hypotheses SET withdrawn = 1 WHERE hypothesis_id = ?`, r.hypothesis_id);
      this.#sql.exec(`INSERT INTO hypothesis_revisions (hypothesis_id, bundle_id, act, statement, about_json, reason, by_actor, at)
                      VALUES (?,?,?,?,?,?,?,?)`, r.hypothesis_id, r.bundle_id, "withdraw", null, null, m.reason, by, at);
      return { ok: true, hypothesis_id: r.hypothesis_id, label: HYPOTHESIS_LABEL, withdrawn: { by, at, reason: m.reason } };
    });
  }

  /* ---- the reads (R2, R3) ---- */

  /* One hypothesis as every read answers it: labelled, the member's, never a fact, no grade, with its history. */
  #view(r) {
    const history = this.#rows(`SELECT act, statement, about_json, reason, by_actor, at FROM hypothesis_revisions
                                WHERE hypothesis_id = ? ORDER BY seq`, r.hypothesis_id)
      .map((h) => ({ act: h.act, by: h.by_actor, at: h.at, ...(h.statement !== null ? { statement: h.statement } : {}),
                     ...(h.about_json !== null ? { about: parse(h.about_json) } : {}), ...(h.reason !== null ? { reason: h.reason } : {}) }));
    /* R17: a hypothesis a member took up from the system's proposal notes that it came from the system */
    const p = this.#one(`SELECT proposal_id, how, false_alarm_rate, acceptance_json FROM ${PROPOSALS_TABLE} WHERE taken_as = ?`, r.hypothesis_id);
    const from = p ? { came_from: { source: SYSTEM_LABEL, proposal: p.proposal_id, form: parse(p.acceptance_json)?.form ?? null,
                                    how: p.how, false_alarm_rate: Number(p.false_alarm_rate) } } : {};
    return { hypothesis_id: r.hypothesis_id, inquiry: r.bundle_id, kind: r.kind, label: HYPOTHESIS_LABEL, fact: false, grade: null,
             statement: r.statement, about: parse(r.about_json), held_by: r.held_by, held_at: r.held_at,
             status: r.withdrawn ? "withdrawn" : "live", ...from, history };
  }

  /** R3: `read({hypothesisId, viewer})`. */
  read({ hypothesisId = null, viewer = null } = {}) {
    const r = this.#held(hypothesisId, viewer);
    return r ? { ok: true, hypothesis: this.#view(r) } : Hypotheses.#noSuch(hypothesisId);
  }

  /** R3: `hypothesesOf({inquiry, viewer})`: every hypothesis the inquiry holds, withdrawn ones marked, in the order held;
   *  (R16) the system's proposals beside them under a heading of their own, never among the held. */
  hypothesesOf({ inquiry = null, viewer = null } = {}) {
    const q = this.#inquiry(inquiry, viewer);
    if (q.refusal) return q.refusal;
    const rows = this.#rows(`SELECT * FROM hypotheses WHERE bundle_id = ? ORDER BY held_at, hypothesis_id`, inquiry);
    return { ok: true, inquiry, label: HYPOTHESIS_LABEL, hypotheses: rows.map((r) => this.#view(r)),
             system_proposals: { heading: PROPOSALS_HEADING, label: SYSTEM_LABEL, items: this.#proposalRows(inquiry, null).map((p) => Hypotheses.#proposalView(p)) } };
  }

  /* ---- the system's proposals (R16–R18; D33, D46 A, D3, K1473) ---- */

  #proposalRows(inquiry, run) {
    return run ? this.#rows(`SELECT * FROM ${PROPOSALS_TABLE} WHERE bundle_id = ? AND run = ? ORDER BY proposed_at, proposal_id`, inquiry, run)
               : this.#rows(`SELECT * FROM ${PROPOSALS_TABLE} WHERE bundle_id = ? ORDER BY proposed_at, proposal_id`, inquiry);
  }

  /* One proposal as every read answers it: the system's, how it was worked out and its false-alarm rate, never a fact,
     no grade; a taken-up one names who took it up and as what, a set-aside one who set it aside and why (R18). */
  static #proposalView(p) {
    const status = p.state;
    const acceptance = parse(p.acceptance_json);
    return { proposal: p.proposal_id, inquiry: p.bundle_id, kind: p.kind, label: SYSTEM_LABEL, by: SYSTEM_LABEL, fact: false, grade: null,
             statement: p.statement, about: parse(p.about_json), how: p.how, false_alarm_rate: Number(p.false_alarm_rate), run: p.run,
             at: p.proposed_at, status,
             ...(status === "taken_up" ? { taken_up: { by: p.acted_by, at: p.acted_at, form: acceptance?.form ?? null, hypothesis_id: p.taken_as } } : {}),
             ...(status === "set_aside" ? { set_aside: { by: p.acted_by, at: p.acted_at, reason: p.reason } } : {}) };
  }

  /** R16: `hypothesisPropose({inquiry, kind, statement, about, how, false_alarm_rate, run})`, the machine's only door:
   *  stored apart from what members hold, labelled the system's with how it was worked out and its measured false-alarm
   *  rate. Refusals in order, each writing nothing: `NO_SUCH_BUNDLE` (no inquiry by that id), `NOT_AN_INQUIRY`,
   *  `UNKNOWN_HYPOTHESIS_KIND`, `HYPOTHESIS_NO_STATEMENT`, `BAD_ABOUT`, `PROPOSAL_NO_HOW`, `PROPOSAL_NO_RATE`,
   *  `HYPOTHESIS_PROPOSAL_NO_RUN`. Answers `{ok, proposal, kind, label: "the system's", at}`. */
  hypothesisPropose({ inquiry = null, kind = null, statement = null, about = null, how = null, false_alarm_rate = null, run = null } = {}) {
    const b = filled(inquiry) ? this.#record.bundleInfo(inquiry) : null;
    if (!b) return refuse("NO_SUCH_BUNDLE", "no inquiry by that id is held", { inquiry: filled(inquiry) ? inquiry : null });
    if (b.type !== "inquiry") return refuse("NOT_AN_INQUIRY", `${inquiry} is a ${b.type}, not an inquiry`, { inquiry });
    if (!HYPOTHESIS_KINDS.includes(kind))
      return refuse("UNKNOWN_HYPOTHESIS_KIND", `a hypothesis is one of ${HYPOTHESIS_KINDS.join(", ")}`, { kinds: [...HYPOTHESIS_KINDS] });
    if (!filled(statement)) return refuse("HYPOTHESIS_NO_STATEMENT", "a proposal states what the system suggests");
    const a = Hypotheses.#about(kind, about);
    if (a.refusal) return a.refusal;
    if (!filled(how)) return refuse("PROPOSAL_NO_HOW", "a proposal of the system's says how it was worked out");
    const rate = typeof false_alarm_rate === "number" ? false_alarm_rate : NaN;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1)
      return refuse("PROPOSAL_NO_RATE", "a proposal of the system's carries its measured false-alarm rate, a number from 0 to 1", { false_alarm_rate: false_alarm_rate ?? null });
    if (!filled(run)) return refuse("HYPOTHESIS_PROPOSAL_NO_RUN", "a proposal of the system's names the run that made it");
    const at = this.#now();
    return this.#record.transact(() => {
      const id = this.#record.allocId("HYP", at.slice(0, 4));
      if (!id || !id.id) return id;
      this.#sql.exec(`INSERT INTO ${PROPOSALS_TABLE} (proposal_id, bundle_id, kind, statement, about_json, how, false_alarm_rate, run, proposed_at)
                      VALUES (?,?,?,?,?,?,?,?,?)`, id.id, inquiry, kind, statement.trim().slice(0, STATEMENT_MAX), json(a.about),
                     how.trim().slice(0, HOW_MAX), rate, run.trim().slice(0, RUN_MAX), at);
      return { ok: true, proposal: id.id, kind, label: SYSTEM_LABEL, at };
    });
  }

  /** R16: `proposalsOf({inquiry, viewer, run?})`: the system's proposals in an inquiry the viewer sees, under their own
   *  heading, in the order proposed; with `run`, that run's alone (offered with its finds). */
  proposalsOf({ inquiry = null, viewer = null, run = null } = {}) {
    const q = this.#inquiry(inquiry, viewer);
    if (q.refusal) return q.refusal;
    return { ok: true, inquiry, heading: PROPOSALS_HEADING, label: SYSTEM_LABEL,
             proposals: this.#proposalRows(inquiry, filled(run) ? run : null).map((p) => Hypotheses.#proposalView(p)) };
  }

  /* The proposal `id` names when `by` may see its inquiry, a member's act, and open: `{row}` or `{refusal}`. */
  #openProposal(id, by) {
    const p = isHypothesisId(id) ? this.#one(`SELECT * FROM ${PROPOSALS_TABLE} WHERE proposal_id = ?`, id) : null;
    if (!p || !this.#membership.inSight(p.bundle_id, by))
      return { refusal: refuse("NO_SUCH_HYPOTHESIS_PROPOSAL", "no proposal by that id is held, or it is not one you may see", { proposal: filled(id) ? id : null }) };
    if (isMachineIdentity(by)) return { refusal: refuse("MACHINE_CANNOT_HYPOTHESISE", "the act's stamp is a machine's; only a member takes up or sets aside the system's proposal (K1473)") };
    return { row: p };
  }
  static #notOpen(p) {
    return refuse("PROPOSAL_NOT_OPEN", `${p.proposal_id} was already ${p.state === "taken_up" ? "taken up" : "set aside"}`,
                  { proposal: p.proposal_id, status: p.state });
  }

  /** R17: `hypothesisTakeUp({proposal, form, statement?, by})`, a member's act (`record-grammar` R52): holds the proposal
   *  by R1 as hers (`as_proposed` in its words, `edited` or `own_instead` in hers), noting it came from the system.
   *  Refusals in order, each writing nothing: `NO_SUCH_HYPOTHESIS_PROPOSAL`, `MACHINE_CANNOT_HYPOTHESISE`, `PROPOSAL_FORM_UNKNOWN`,
   *  `PROPOSAL_NOT_OPEN`, `HYPOTHESIS_NO_STATEMENT` (an edited or own statement absent), then R1's own, unchanged. */
  hypothesisTakeUp({ proposal = null, form = null, statement = null, by = null } = {}) {
    const m = this.#openProposal(proposal, by);
    if (m.refusal) return m.refusal;
    const p = m.row;
    if (!ACCEPTANCE_FORMS.includes(form))
      return refuse("PROPOSAL_FORM_UNKNOWN", `taking up is one of ${ACCEPTANCE_FORMS.join(", ")}`, { forms: [...ACCEPTANCE_FORMS] });
    if (p.state !== "open") return Hypotheses.#notOpen(p);
    if (form !== "as_proposed" && !filled(statement))
      return refuse("HYPOTHESIS_NO_STATEMENT", `taking up ${form === "edited" ? "edited" : "with your own instead"} states the hypothesis in your own words`);
    const words = form === "as_proposed" ? p.statement : statement;
    return this.#record.transact(() => {
      const h = this.hold({ inquiry: p.bundle_id, kind: p.kind, statement: words, about: parse(p.about_json), by });
      if (!h || h.ok !== true) return h;
      const acceptance = acceptanceRecord({ proposal: p.proposal_id, form, by, at: h.at.replace(/\.\d+Z$/, "Z"), kind: "hypothesis" });
      this.#sql.exec(`UPDATE ${PROPOSALS_TABLE} SET state = 'taken_up', acted_by = ?, acted_at = ?, acceptance_json = ?, taken_as = ? WHERE proposal_id = ?`,
                     by, h.at, json(acceptance), h.hypothesis_id, p.proposal_id);
      return { ...h, proposal: p.proposal_id, form, came_from: SYSTEM_LABEL, acceptance };
    });
  }

  /** R18: `hypothesisSetAside({proposal, reason, by})`, a member's act: the proposal stays readable, with who set it
   *  aside, when and why. Refusals in order, each writing nothing: `NO_SUCH_HYPOTHESIS_PROPOSAL`, `MACHINE_CANNOT_HYPOTHESISE`,
   *  `PROPOSAL_NO_REASON`, `PROPOSAL_NOT_OPEN`. */
  hypothesisSetAside({ proposal = null, reason = null, by = null } = {}) {
    const m = this.#openProposal(proposal, by);
    if (m.refusal) return m.refusal;
    const p = m.row;
    if (!filled(reason)) return refuse("PROPOSAL_NO_REASON", "setting the system's proposal aside says why, in the member's words");
    if (p.state !== "open") return Hypotheses.#notOpen(p);
    const at = this.#now();
    const why = reason.trim().slice(0, REASON_MAX);
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE ${PROPOSALS_TABLE} SET state = 'set_aside', acted_by = ?, acted_at = ?, reason = ? WHERE proposal_id = ?`, by, at, why, p.proposal_id);
      return { ok: true, proposal: p.proposal_id, label: SYSTEM_LABEL, set_aside: { by, at, reason: why } };
    });
  }

  /* ---- rival explanations (F1; BD-17; IV-H1, IV-H2) ---- */

  /* What `id` names as a rival in `inquiry`: a live hypothesis held in it, or an open proposal of the system's in it;
     else null. */
  #rivalSource(inquiry, id) {
    if (!isHypothesisId(id)) return null;
    const h = this.#one(`SELECT withdrawn FROM hypotheses WHERE hypothesis_id = ? AND bundle_id = ?`, id, inquiry);
    if (h) return h.withdrawn ? null : "member";
    const p = this.#one(`SELECT state FROM ${PROPOSALS_TABLE} WHERE proposal_id = ? AND bundle_id = ?`, id, inquiry);
    return p && p.state === "open" ? "system" : null;
  }

  #rivalRows(inquiry) {
    return this.#rows(`SELECT r.rival_id, r.source, r.added_at, r.added_seq,
                              (SELECT COUNT(*) FROM hypothesis_rival_marks m WHERE m.bundle_id = r.bundle_id AND m.rival_id = r.rival_id) AS marks
                       FROM hypothesis_rivals r WHERE r.bundle_id = ? ORDER BY marks DESC, r.added_seq`, inquiry);
  }

  #history(inquiry, rival, act, by, at) {
    this.#sql.exec(`INSERT INTO hypothesis_rival_history (bundle_id, rival_id, act, by_actor, at) VALUES (?,?,?,?,?)`, inquiry, rival, act, by, at);
    return Number(this.#one(`SELECT MAX(seq) AS s FROM hypothesis_rival_history`).s);
  }

  /** F1 (IV-H1): `hypothesisRivals({inquiry, rivals, by})`, a member's act: the question's rival explanations become
   *  exactly `rivals`, 2 to 6 distinct ids, each a hypothesis held in it (R1) or a proposal of the system's in it (R16).
   *  Every rival added or removed is kept in the history with who and when; a removed rival's marks go with it. Refusals
   *  in order, each writing nothing: `NO_SUCH_BUNDLE` (absent or unseen, one answer), `NOT_AN_INQUIRY`,
   *  `MACHINE_CANNOT_HYPOTHESISE`, `RIVALS_TOO_FEW` / `RIVALS_TOO_MANY` (naming 2 and 6), `NOT_IN_INQUIRY` (naming the id).
   *  Answers `{ok, inquiry, rivals, added, removed, at}`. */
  hypothesisRivals({ inquiry = null, rivals = null, by = null } = {}) {
    const q = this.#inquiry(inquiry, by);
    if (q.refusal) return q.refusal;
    if (isMachineIdentity(by)) return refuse("MACHINE_CANNOT_HYPOTHESISE", "the act's stamp is a machine's; only a member adds or removes a rival explanation (K1473)");
    const ids = Array.isArray(rivals) ? [...new Set(rivals)] : [];
    if (ids.length < RIVALS_MIN) return refuse("RIVALS_TOO_FEW", `a question holds ${RIVALS_MIN} to ${RIVALS_MAX} rival explanations`, { min: RIVALS_MIN, max: RIVALS_MAX });
    if (ids.length > RIVALS_MAX) return refuse("RIVALS_TOO_MANY", `a question holds ${RIVALS_MIN} to ${RIVALS_MAX} rival explanations`, { min: RIVALS_MIN, max: RIVALS_MAX });
    const held = new Map(this.#rows(`SELECT rival_id FROM hypothesis_rivals WHERE bundle_id = ?`, inquiry).map((r) => [r.rival_id, true]));
    const sources = new Map();
    for (const id of ids) {
      /* a rival already in the set stays, whatever has since become of it */
      const s = held.has(id) ? "kept" : this.#rivalSource(inquiry, id);
      if (!s) return refuse("NOT_IN_INQUIRY", "a rival is a hypothesis held in this question, or a proposal of the system's in it", { rival: typeof id === "string" ? id : null });
      sources.set(id, s);
    }
    const added = ids.filter((id) => !held.has(id));
    const removed = [...held.keys()].filter((id) => !ids.includes(id));
    const at = this.#now();
    if (!added.length && !removed.length) return { ok: true, inquiry, rivals: ids, added, removed, at: null, already: true };
    return this.#record.transact(() => {
      for (const id of removed) {
        this.#sql.exec(`DELETE FROM hypothesis_rivals WHERE bundle_id = ? AND rival_id = ?`, inquiry, id);
        this.#sql.exec(`DELETE FROM hypothesis_rival_marks WHERE bundle_id = ? AND rival_id = ?`, inquiry, id);
        this.#history(inquiry, id, "remove", by, at);
      }
      for (const id of added) {
        const seq = this.#history(inquiry, id, "add", by, at);
        this.#sql.exec(`INSERT INTO hypothesis_rivals (bundle_id, rival_id, source, added_by, added_at, added_seq) VALUES (?,?,?,?,?,?)`,
                       inquiry, id, sources.get(id), by, at, seq);
      }
      return { ok: true, inquiry, rivals: this.#rivalRows(inquiry).map((r) => r.rival_id), added, removed, at };
    });
  }

  /** F1 (IV-H2): `exploreNext({inquiry, rival, by})`, a member's only act on a rival: "Explore this next". Each member
   *  holds one such mark in a question at a time; a new mark replaces their own earlier one, and each is kept in the
   *  history with who and when. It sets the order of exploring and nothing else: it touches no leg, grade, strength,
   *  conclusion or standing. Refusals in order, each writing nothing: `NO_SUCH_BUNDLE`, `NOT_AN_INQUIRY`,
   *  `MACHINE_CANNOT_MARK_RIVAL`, `NOT_A_RIVAL`. Answers `{ok, inquiry, rival, replaced, at, notice}`, `notice` the
   *  not-evidence sentence. */
  exploreNext({ inquiry = null, rival = null, by = null } = {}) {
    const q = this.#inquiry(inquiry, by);
    if (q.refusal) return q.refusal;
    if (isMachineIdentity(by)) return refuse("MACHINE_CANNOT_MARK_RIVAL", "the act's stamp is a machine's; only a member marks what to explore next (INV:108)");
    const r = filled(rival) ? this.#one(`SELECT rival_id FROM hypothesis_rivals WHERE bundle_id = ? AND rival_id = ?`, inquiry, rival) : null;
    if (!r) return refuse("NOT_A_RIVAL", "the id is not one of this question's rival explanations", { rival: filled(rival) ? rival : null });
    const prior = this.#one(`SELECT rival_id FROM hypothesis_rival_marks WHERE bundle_id = ? AND member = ?`, inquiry, by);
    const notice = exploreNextNotice();
    if (prior && prior.rival_id === rival) return { ok: true, already: true, inquiry, rival, replaced: null, at: null, notice };
    const at = this.#now();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO hypothesis_rival_marks (bundle_id, member, rival_id, at) VALUES (?,?,?,?)
                      ON CONFLICT (bundle_id, member) DO UPDATE SET rival_id = excluded.rival_id, at = excluded.at`, inquiry, by, rival, at);
      this.#history(inquiry, rival, "mark", by, at);
      return { ok: true, inquiry, rival, replaced: prior ? prior.rival_id : null, at, notice };
    });
  }

  /** F1 (IV-H2 "Evidence found while exploring"; steps R31): binds the steps instance, once, and registers with it
   *  (`registerRivalSource`) whether an id is one of a question's rivals for a viewer: true only when the viewer sees
   *  the question and `rival` is in its set. `steps` is handed in, never imported (the edge is the wiring's). A second
   *  binding of the same instance answers `already`; of another, `STEPS_ALREADY_BOUND`. Answers `{ok}` or what
   *  `registerRivalSource` refused. */
  bindSteps(steps) {
    if (!steps || typeof steps.registerRivalSource !== "function" || typeof steps.stepsOfRival !== "function")
      return { ok: false, reason: "STEPS_NOT_A_STEPS" };
    if (this.#steps === steps) return { ok: true, already: true };
    if (this.#steps) return { ok: false, reason: "STEPS_ALREADY_BOUND" };
    const r = steps.registerRivalSource(OWNER, (a) => this.isRival(a));
    if (r && r.ok === false) return r;
    this.#steps = steps;
    return { ok: true };
  }

  /** F1 (steps R31): whether `rival` is one of `question`'s rival explanations for `viewer`; false for anything else,
   *  an unseen question included. Never throws. */
  isRival({ question = null, rival = null, viewer = null } = {}) {
    try {
      if (!filled(question) || !filled(rival) || !filled(viewer) || this.#inquiry(question, viewer).refusal) return false;
      return !!this.#one(`SELECT 1 AS y FROM hypothesis_rivals WHERE bundle_id = ? AND rival_id = ?`, question, rival);
    } catch { return false; }
  }

  /* F1 (IV-H2): the legs the steps opened from `rival` produced: the question's basis legs whose target is a product
     of such a step that the viewer may see, each with its grades and its role on the question, in the basis's order.
     No member marks a leg against a rival; nothing here is written. With no steps bound, or a read that fails, none
     (`legs_read: false`), never a guess. */
  #rivalLegs(inquiry, rival, viewer) {
    if (!this.#steps) return { legs: [], legs_read: false };
    try {
      const s = this.#steps.stepsOfRival({ question: inquiry, rival, viewer, limit: 1000 });
      if (!s || s.ok !== true || !Array.isArray(s.steps)) return { legs: [], legs_read: false };
      const from = new Map();
      for (const st of s.steps) for (const p of Array.isArray(st.products) ? st.products : [])
        if (p && filled(p.id) && !from.has(p.id)) from.set(p.id, st.step);
      if (!from.size) return { legs: [], legs_read: true };
      const b = this.#inquiryOf().basisFor(inquiry);
      if (!b || b.ok !== true || !Array.isArray(b.legs)) return { legs: [], legs_read: false };
      const legs = b.legs.filter((l) => from.has(l.target_id))
        .map((l) => ({ ord: l.ord, target: l.target_id, target_type: l.target_type, role: l.role,
                       grade: l.grade ?? null, grade_axis: l.grade_axis ?? null, grade_source: l.grade_source ?? null,
                       step: from.get(l.target_id) }));
      return { legs, legs_read: true };
    } catch { return { legs: [], legs_read: false }; }
  }

  /** F1 (IV-H1, IV-H2): `rivalsOf({inquiry, viewer})`: the question's rival explanations in the order of exploring (by
   *  how many members currently mark each, ties to the one added first), each labelled a hypothesis, never a fact, with
   *  no grade; the system's labelled the system's. The face names no member and counts nothing: each rival says only
   *  whether it is the viewer's own mark (`your_next`). `notice` is the sentence the mark's dialog shows. */
  rivalsOf({ inquiry = null, viewer = null } = {}) {
    const q = this.#inquiry(inquiry, viewer);
    if (q.refusal) return q.refusal;
    const mine = filled(viewer) ? this.#one(`SELECT rival_id FROM hypothesis_rival_marks WHERE bundle_id = ? AND member = ?`, inquiry, viewer) : null;
    const rivals = this.#rivalRows(inquiry).map((r, i) => {
      const base = { order: i + 1, rival: r.rival_id, label: HYPOTHESIS_LABEL, fact: false, grade: null, added_at: r.added_at,
                     your_next: !!mine && mine.rival_id === r.rival_id };
      if (r.source === "system") {
        const p = this.#one(`SELECT * FROM ${PROPOSALS_TABLE} WHERE proposal_id = ?`, r.rival_id);
        return { ...base, source: SYSTEM_LABEL, by: SYSTEM_LABEL, kind: p?.kind ?? null, statement: p?.statement ?? null,
                 status: p?.state ?? null, how: p?.how ?? null, false_alarm_rate: p ? Number(p.false_alarm_rate) : null };
      }
      const h = this.#one(`SELECT * FROM hypotheses WHERE hypothesis_id = ?`, r.rival_id);
      return { ...base, source: "member", kind: h?.kind ?? null, statement: h?.statement ?? null,
               status: h ? (h.withdrawn ? "withdrawn" : "live") : null };
    });
    /* IV-H2: each rival lists the legs the steps opened from it produced (steps R31) */
    for (const r of rivals) Object.assign(r, this.#rivalLegs(inquiry, r.rival, viewer));
    return { ok: true, inquiry, label: HYPOTHESIS_LABEL, notice: exploreNextNotice(), rivals };
  }

  /** F1 (IV-H1, IV-H2): `rivalHistory({inquiry, viewer})`: every change to the question's rivals and every mark, in
   *  order, `{act, rival, by, at}`, `act` one of `add`, `remove`, `mark`. */
  rivalHistory({ inquiry = null, viewer = null } = {}) {
    const q = this.#inquiry(inquiry, viewer);
    if (q.refusal) return q.refusal;
    return { ok: true, inquiry, history: this.#rows(`SELECT act, rival_id, by_actor, at FROM hypothesis_rival_history WHERE bundle_id = ? ORDER BY seq`, inquiry)
      .map((h) => ({ act: h.act, rival: h.rival_id, by: h.by_actor, at: h.at })) };
  }

  /* ---- the hunch hops (R4) ---- */

  /* One live hypothesis with two ends as a connection in `connection-grammar`'s shape (its R1): labelled `hunch`, no
     grade, the hypothesis as its evidence, scoped to the inquiry holding it. */
  #hop(r) {
    return { id: r.hypothesis_id, from: r.from_node, to: r.to_node, kind: "hunch", owner: OWNER, valid: { ...HUNCH_VALID },
             evidence: [{ source: r.hypothesis_id, statement: r.statement, by: r.held_by }], grade: null, derived: null,
             label: HUNCH_LABEL, scope: r.bundle_id, hypothesis_kind: r.kind, undetermined: { why: UNDATED_WHY } };
  }

  /** R4: `neighbours({node, kinds, at, page, viewer, scope})`: the hops at `node` of the live hypotheses the inquiry
   *  `scope` holds, when the viewer may see it; none outside that scope. Synchronous (connection-grammar R19). */
  neighbours({ node, kinds: ks, at, page, viewer, scope } = {}) {
    void at; /* undated: every hop is undetermined at every date (K1563 (2)) */
    if (viewer === undefined || viewer === null || viewer === "")
      return { refused: "VIEWER_MISSING", why: word("hypotheses.why.read_names_member") };
    if (Array.isArray(ks) && !ks.includes("hunch")) return { items: [] };
    if (!filled(node) || !filled(scope)) return { items: [] };
    const b = this.#record.bundleInfo(scope);
    if (!b || b.type !== "inquiry" || !this.#membership.inSight(scope, viewer)) return { items: [] };
    const where = `bundle_id = ? AND withdrawn = 0 AND from_node IS NOT NULL AND to_node IS NOT NULL AND (from_node = ? OR to_node = ?)`;
    const size = Number(this.#one(`SELECT COUNT(*) AS n FROM hypotheses WHERE ${where}`, scope, node, node).n);
    if (size > BOUNDS.hub)
      return { items: [], hub: { set_size: size, why: word("hypotheses.why.node_hunches_inquiry", { hub: String(BOUNDS.hub) }) } };
    const after = isObj(page) && filled(page.after) ? page.after : "";
    const per = isObj(page) && Number.isInteger(page.size) && page.size >= 1 ? Math.min(page.size, BOUNDS.fanout) : BOUNDS.fanout;
    const rows = this.#rows(`SELECT * FROM hypotheses WHERE ${where} AND hypothesis_id > ? ORDER BY hypothesis_id LIMIT ?`,
                            scope, node, node, after, per + 1);
    const items = rows.slice(0, per).map((r) => this.#hop(r));
    return { items, ...(rows.length > per ? { next: { after: items[items.length - 1].id, size: per } } : {}) };
  }

  /* ---- a member's own notes (R11–R15; DEC-136 (2), (3)) ---- */

  /* The member an act's stamp or a read's viewer names, or null: a machine, an absent stamp and a viewer naming no
     member keep and read no note (R11, R12). */
  #noteMember(who) {
    if (!filled(who) || isMachineIdentity(who)) return null;
    let m = null;
    try { m = this.#membership.positionalMember(who); } catch { m = null; }
    return filled(m) ? m : null;
  }

  /* The note `note` names when `member` kept it, else null (absent and another's alike, R13). */
  #ownNote(note, member) {
    const n = typeof note === "number" ? note : typeof note === "string" && /^\d{1,15}$/.test(note.trim()) ? Number(note.trim()) : NaN;
    if (!Number.isSafeInteger(n) || n < 1) return null;
    return this.#one(`SELECT note_id, member, text, at FROM member_notes WHERE note_id = ? AND member = ?`, n, member);
  }
  static #noSuchNote(note) {
    return refuse("NO_SUCH_NOTE", "no note of yours is held by that number", { note: typeof note === "number" || typeof note === "string" ? note : null });
  }

  /* R11's text checks, shared by `noteWrite` and `noteRevise`: a refusal, or null. */
  static #badText(text) {
    if (!filled(text)) return refuse("NOTE_NO_TEXT", "a note holds the member's words, and this one holds none");
    const bytes = UTF8.encode(text).length;
    if (bytes > NOTE_MAX_BYTES)
      return refuse("NOTE_TOO_LONG", `a note holds at most ${NOTE_MAX_BYTES} bytes, and this one is ${bytes}`, { max_bytes: NOTE_MAX_BYTES, bytes });
    return null;
  }

  /** R11: `noteWrite({text, by})` keeps one note in the member's words, refused (never cut) past its bound; the first
   *  note a member keeps while the group tells members what a court can reach answers the court statement, once. */
  noteWrite({ text = null, by = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a member keeps a note of their own");
    const bad = Hypotheses.#badText(text);
    if (bad) return bad;
    let tell = false;
    try { tell = this.#membership.courtNotice().choice === "tell"; } catch { tell = false; }
    const at = this.#now();
    return this.#record.transact(() => {
      /* R14 (T36): the member's own next number, from their own mark; nothing shared across members is drawn. */
      const mark = this.#one(`SELECT last FROM member_note_numbers WHERE member = ?`, member);
      const note = (mark ? Number(mark.last) : 0) + 1;
      this.#sql.exec(`INSERT INTO member_note_numbers (member, last) VALUES (?, ?) ON CONFLICT (member) DO UPDATE SET last = excluded.last`, member, note);
      this.#sql.exec(`INSERT INTO member_notes (member, note_id, text, at) VALUES (?,?,?,?)`, member, note, text, at);
      let told = false;
      if (tell && !this.#one(`SELECT member FROM member_note_told WHERE member = ?`, member)) {
        this.#sql.exec(`INSERT INTO member_note_told (member, at) VALUES (?,?)`, member, at);
        told = true;
      }
      return { ok: true, note, at, ...(told ? { courtStatement: Membership.COURT_STATEMENT } : {}) };
    });
  }

  /** R11 (T35, DEC-144): `noteRevise({note, text, by})` replaces, in place, the text of one note `by` kept; the note keeps
   *  its number and its turns, and its earlier text is kept nowhere (R14, R15). Never answers the court statement. */
  noteRevise({ note = null, text = null, by = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a note's author revises it");
    const n = this.#ownNote(note, member);
    if (!n) return Hypotheses.#noSuchNote(note);
    const bad = Hypotheses.#badText(text);
    if (bad) return bad;
    const at = this.#now();
    const noteId = Number(n.note_id);
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE member_notes SET text = ?, revised = ? WHERE note_id = ? AND member = ?`, text, at, noteId, member);
      return { ok: true, note: noteId, at };
    });
  }

  /** R13 (T35, DEC-144): `noteDelete({note, by})` deletes one note `by` kept, for good: its row and its turns in one act,
   *  nothing marking that it existed; what a turn made stays its owner's, unchanged. */
  noteDelete({ note = null, by = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a note's author deletes it");
    const n = this.#ownNote(note, member);
    if (!n) return Hypotheses.#noSuchNote(note);
    const noteId = Number(n.note_id);
    return this.#record.transact(() => {
      this.#sql.exec(`DELETE FROM member_note_turns WHERE note_id = ? AND member = ?`, noteId, member);
      this.#sql.exec(`DELETE FROM member_notes WHERE note_id = ? AND member = ?`, noteId, member);
      return { ok: true, note: noteId, deleted: true };
    });
  }

  /** R12: `notesOf({viewer, after?, limit?})`: the viewer's own notes, newest first, each with its turns; any other
   *  viewer, and none, reads exactly as a member with no notes. */
  notesOf({ viewer = null, after = null, limit = undefined } = {}) {
    const lim = Number.isInteger(Number(limit)) && limit !== null && limit !== "" && limit !== undefined
      ? Math.min(NOTES_LIMIT.max, Math.max(1, Number(limit))) : NOTES_LIMIT.default;
    const member = this.#noteMember(viewer);
    if (!member) return { ok: true, notes: [], limit: lim, truncated: false, next: null };
    const from = after === null || after === undefined || after === "" ? null : Number(after);
    const cursor = Number.isSafeInteger(from) && from > 0 ? from : null;
    const rows = this.#rows(`SELECT note_id, text, at, revised FROM member_notes WHERE member = ? ${cursor ? "AND note_id < ?" : ""}
                             ORDER BY note_id DESC LIMIT ?`, ...(cursor ? [member, cursor, lim + 1] : [member, lim + 1]));
    const page = rows.slice(0, lim);
    const notes = page.map((r) => ({ note: Number(r.note_id), text: r.text, at: r.at, revised: r.revised ?? null,
      turned: this.#rows(`SELECT turned_into, made_id, at FROM member_note_turns WHERE note_id = ? AND member = ? ORDER BY seq`, r.note_id, member)
        .map((t) => ({ into: t.turned_into, id: t.made_id, at: t.at })) }));
    const truncated = rows.length > lim;
    return { ok: true, notes, limit: lim, truncated, next: truncated ? { after: notes[notes.length - 1].note } : null };
  }

  /** R13: `noteTurn({note, into, by, hunch?, made?})` records that a note became an observation, a hunch or a question,
   *  by its author's own act: a hunch is held here (R1), a note past R1's statement bound refused, never cut (K1807);
   *  an observation or a question is made by its owner's act and named in `made`. The note itself is unchanged and
   *  stays its author's alone; a turn never deletes it. */
  noteTurn({ note = null, into = null, by = null, hunch = null, made = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a note's author turns it");
    const n = this.#ownNote(note, member);
    if (!n) return Hypotheses.#noSuchNote(note);
    if (!NOTE_TURNS.includes(into)) return refuse("NOTE_TURN_UNKNOWN", `a note becomes one of ${NOTE_TURNS.join(", ")}`, { turns: [...NOTE_TURNS] });
    const noteId = Number(n.note_id);
    const append = (id) => {
      const at = this.#now();
      this.#sql.exec(`INSERT INTO member_note_turns (note_id, member, turned_into, made_id, at) VALUES (?,?,?,?,?)`, noteId, member, into, id, at);
      return { ok: true, note: noteId, into, id, at };
    };
    if (into === "hunch") {
      /* K1807: R1's statement bound is never reached by cutting the member's words: such a turn is refused. */
      const length = n.text.trim().length;
      if (length > STATEMENT_MAX)
        return refuse("NOTE_TOO_LONG_FOR_HUNCH", `a hunch's statement holds at most ${STATEMENT_MAX} characters, and this note is ${length}`,
                      { max_characters: STATEMENT_MAX, characters: length, note: noteId });
      const h = isObj(hunch) ? hunch : {};
      return this.#record.transact(() => {
        const r = this.hold({ inquiry: h.inquiry ?? null, kind: h.kind ?? null, about: h.about ?? null, statement: n.text, by });
        if (!r || r.ok !== true) return r;
        return { ...append(r.hypothesis_id), hypothesis: r };
      });
    }
    const id = typeof made === "string" ? made.trim() : made;
    if (typeof id !== "string" || !isRecordId(id))
      return refuse("NOTE_TURN_NOT_MADE", `name the ${into} your own act made from this note by the record's id`, { made: typeof made === "string" ? made : null });
    return this.#record.transact(() => append(id));
  }

  /* ---- a note shared with a project (R19–R21; D18) ---- */

  /** R19: `noteShare({note, project, by})` by the note's author, a joined participant of `project`: copies the note's
   *  current words into a share of that project, labelled hers and narrative; the note itself is unchanged and the share
   *  holds no sign of which note it was. A note naming a person in no public role carries `inquiry` R59's warning,
   *  never a refusal. Refusals in order, each writing nothing: `MACHINE_CANNOT_NOTE`; `NO_SUCH_NOTE`; membership's
   *  `PROJECT_ACT_NOT_A_PARTICIPANT` (its R55; an unknown or unseen project alike). */
  noteShare({ note = null, project = null, by = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a note's author shares it");
    const n = this.#ownNote(note, member);
    if (!n) return Hypotheses.#noSuchNote(note);
    const proj = filled(project) ? project.trim() : "";
    const denied = this.#membership.projectAuthority(proj, by, "joined", "noteshare");
    if (denied) return denied;
    const warning = this.#warningFor(n.text, by);
    const at = this.#now();
    const share = this.#shareId();
    return this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO ${SHARES_TABLE} (share_id, project_id, member, text, warning_json, shared_at) VALUES (?,?,?,?,?,?)`,
                     share, proj, member, n.text, warning ? json(warning) : null, at);
      return { ok: true, share, project: proj, at, by: member, kind: SHARE_KIND, ...(warning ? { warning } : {}) };
    });
  }

  /* The host's `inquiry` (handed in, else reached when first asked), or null. */
  #inquiryOf() {
    if (!this.#inquiryInst && this.#host) this.#inquiryInst = inquiryOf(this.#host);
    return this.#inquiryInst;
  }

  /* R19 (K2479): inquiry R59's warning for `text`: its `personWarning` over the record's facts for the persons the text
     names (`inquiry.personFacts`, read as `viewer`); null when it names none, or when the test cannot be asked (a
     warning, never a refusal). */
  #warningFor(text, viewer) {
    try {
      if (this.#personWarning) return this.#personWarning({ text, entities: [], viewer }) ?? null;
      if (!this.#inquiryInst && this.#host) this.#inquiryInst = inquiryOf(this.#host);
      const facts = this.#inquiryInst && typeof this.#inquiryInst.personFacts === "function"
        ? this.#inquiryInst.personFacts({ text, viewer }) : [];
      return inquiryPersonWarning({ text, entities: facts, viewer }) ?? null;
    } catch { return null; }
  }

  /** R20: `noteUnshare({share, by})` by its author withdraws it: its words leave every answer; the project's record keeps
   *  that she shared a note on that date and withdrew it on that date, without its words. Refusals in order, each writing
   *  nothing: `MACHINE_CANNOT_NOTE`; `NO_SUCH_SHARE` (absent, withdrawn or another's, one answer). */
  noteUnshare({ share = null, by = null } = {}) {
    const member = this.#noteMember(by);
    if (!member) return refuse("MACHINE_CANNOT_NOTE", "the act's stamp names no member; only a share's author withdraws it");
    const s = typeof share === "string" && SHARE_ID_RE.test(share.trim())
      ? this.#one(`SELECT * FROM ${SHARES_TABLE} WHERE share_id = ? AND member = ? AND withdrawn_at IS NULL`, share.trim(), member) : null;
    if (!s) return refuse("NO_SUCH_SHARE", "no share of yours stands by that id", { share: typeof share === "string" ? share : null });
    const at = this.#now();
    return this.#record.transact(() => {
      this.#sql.exec(`UPDATE ${SHARES_TABLE} SET text = NULL, warning_json = NULL, withdrawn_at = ? WHERE share_id = ?`, at, s.share_id);
      return { ok: true, share: s.share_id, withdrawn: at };
    });
  }

  /** R21: `sharesOf({project, viewer})`: to the project's joined participants, its standing shares, newest first, at most
   *  200, each hers and narrative, never evidence; and the record of withdrawn ones, without their words (R20). Any other
   *  viewer, and none, reads exactly as a project with no shares. */
  sharesOf({ project = null, viewer = null } = {}) {
    const proj = filled(project) ? project.trim() : null;
    const empty = { ok: true, project: proj, shares: [], truncated: false, withdrawn: [] };
    const member = this.#noteMember(viewer);
    if (!member || !proj || !this.#membership.isJoinedParticipant(proj, member)) return empty;
    const rows = this.#rows(`SELECT * FROM ${SHARES_TABLE} WHERE project_id = ? AND withdrawn_at IS NULL ORDER BY shared_at DESC, share_id DESC LIMIT ?`,
                            proj, SHARES_MAX + 1);
    const gone = this.#rows(`SELECT share_id, member, shared_at, withdrawn_at FROM ${SHARES_TABLE} WHERE project_id = ? AND withdrawn_at IS NOT NULL
                             ORDER BY withdrawn_at DESC, share_id DESC LIMIT ?`, proj, SHARES_MAX);
    return { ok: true, project: proj,
             shares: rows.slice(0, SHARES_MAX).map((r) => ({ share: r.share_id, by: r.member, text: r.text, at: r.shared_at, kind: SHARE_KIND,
                                                            evidence: false, ...(r.warning_json ? { warning: parse(r.warning_json) } : {}) })),
             truncated: rows.length > SHARES_MAX,
             withdrawn: gone.map((r) => ({ share: r.share_id, by: r.member, shared: r.shared_at, withdrawn: r.withdrawn_at })) };
  }

  /* ---- the leg check (R5, R6) ---- */

  /** R5, R6: for each leg, a finding when it rests on a hypothesis, or on a derived connection that is a lead or that
   *  cannot be re-derived; `legs` as `inquiry` numbers them (`ord`, its R12). `inquiry` is the inquiry the legs belong
   *  to, passed to `explore.rederive` as `scope: {inquiry}` (its R19; N582), so a hunch of that inquiry is seen as one;
   *  without it no scope is passed and no hunch is read. Writes nothing and never throws. */
  legRefusals({ legs = [], viewer = null, inquiry = null } = {}) {
    const out = [];
    const list = Array.isArray(legs) ? legs : [];
    const scope = filled(inquiry) ? { inquiry } : null;
    list.forEach((leg, i) => {
      if (!isObj(leg)) return;
      const ord = Number.isInteger(leg.ord) ? leg.ord : i;
      const target = typeof leg.target === "string" ? leg.target.trim() : leg.target;
      try {
        const f = this.#judgeLeg(target, leg, viewer, scope);
        if (f) out.push({ ...f, ord, target });
      } catch (e) {
        out.push({ ...finding("LEG_NOT_REDERIVED", `basis[${ord}] could not be checked: ${String(e && e.message ? e.message : e).slice(0, 200)}`), ord, target });
      }
    });
    return out;
  }

  #judgeLeg(target, leg, viewer, scope) {
    /* DEC-49 REGION is-hypothesis-leg */
    if (isHypothesisId(target))
      return finding("HYPOTHESIS_NOT_A_LEG", localize("hypotheses.index.the_leg_rests_on_target", "the leg rests on {target}, a hypothesis: hypotheses are held in the working inquiry, never as a leg (K1467)", { target: String(target) }));
    /* END DEC-49 REGION is-hypothesis-leg */
    /* DEC-49 REGION is-narrative-leg */
    if (typeof target === "string" && SHARE_ID_RE.test(target))
      return finding("NARRATIVE_NOT_A_LEG", localize("hypotheses.index.the_leg_rests_on_target_2", "the leg rests on {target}, a member's shared note: narrative, never a leg (D18)", { target: String(target) }));
    /* END DEC-49 REGION is-narrative-leg */
    if (typeof target === "string" && DERIVED_ID_RE.test(target)) return this.#judgeDerived(target, derivationOf(leg), viewer, scope, "the leg");
    if (typeof target === "string" && CALC_RE && CALC_RE.test(target)) return this.#judgeCalculation(target, viewer, scope);
    return null;
  }

  /* R6's calculation arm (N576, K1601): the calculation's inputs read synchronously through `calculations.gradeFactsOf`,
     the promotion's author as the viewer. A hypothesis among an input's reference is refused; an input naming a derived
     connection is judged as a leg on it; a calculation not found, or a read that throws or answers no such shape, is
     refused `LEG_NOT_REDERIVED`, never passed (fail closed). */
  #judgeCalculation(calcId, viewer, scope) {
    const cannot = (why) => finding("LEG_NOT_REDERIVED", `the leg rests on the calculation ${calcId}, whose inputs could not be read: ${why}`, { calculation: calcId });
    const calc = this.#calculationsOf();
    if (!calc || typeof calc.gradeFactsOf !== "function") return cannot("no calculation read is reachable");
    let facts = null;
    try { facts = calc.gradeFactsOf({ calcId, viewer }); } catch { return cannot(word("case-disclosures.why.read_failed")); }
    if (isThenable(facts)) { Promise.resolve(facts).catch(() => {}); return cannot("the read did not answer synchronously"); }
    if (!isObj(facts) || facts.found !== true || !Array.isArray(facts.inputs))
      return cannot(isObj(facts) && facts.found === false ? "it is not held, or not one this author may see" : "the read answered no grade facts");
    for (const inp of facts.inputs) {
      if (!isObj(inp)) continue;
      const refs = stringsIn(inp.ref);
      const hyp = refs.find((x) => isHypothesisId(x.trim()));
      if (hyp !== undefined)
        return finding("HYPOTHESIS_NOT_A_LEG", localize("hypotheses.index.the_calculation_calcid_names_hyp", "the calculation {calcId} names {hyp}, a hypothesis, among its inputs (K1467)", { calcId: String(calcId), hyp: String(hyp.trim()) }), { calculation: calcId });
    }
    for (const inp of facts.inputs) {
      if (!isObj(inp) || NOT_A_CONNECTION_REF.includes(inp.kind)) continue;
      const id = stringsIn(inp.ref).map((x) => x.trim()).find((x) => DERIVED_ID_RE.test(x));
      if (id === undefined) continue;
      const what = `the calculation ${calcId}'s input ${filled(inp.name) ? inp.name : id}`;
      const f = this.#judgeDerived(id, derivationOf(inp), viewer, scope, what);
      if (f) return { ...f, calculation: calcId };
    }
    return null;
  }

  /* R6: one derived connection id with its derivation, re-derived through `explore` with the leg's inquiry as `scope`
     (its R19). Null when it re-derives with no declared or hunch hop; a finding otherwise, never a pass. */
  #judgeDerived(id, derivation, viewer, scope, what) {
    if (!filled(id) || !isObj(derivation))
      return finding("LEG_NOT_REDERIVED", `${what} cites a derived connection ${id ?? ""} without its derivation (kind, from, to, as_of, method), so it cannot be re-derived`, { connection: filled(id) ? id : null });
    const ex = this.#exploreOf();
    let r = null;
    if (ex) {
      try { r = ex.rederive({ kind: derivation.kind, from: derivation.from, to: derivation.to, as_of: derivation.as_of,
                              method: derivation.method, id, viewer, ...(scope ? { scope } : {}) }); } catch { r = null; }
    }
    if (isThenable(r)) { Promise.resolve(r).catch(() => {}); r = null; }
    /* DEC-49 REGION is-rederived-leg */
    if (!isObj(r) || r.ok !== true || r.matches !== true)
      return finding("LEG_NOT_REDERIVED", `${what} cites the derived connection ${id}, which could not be re-derived: ${isObj(r) && filled(r.why) ? r.why : "no answer"}`, { connection: id });
    /* END DEC-49 REGION is-rederived-leg */
    /* DEC-49 REGION is-lead-leg */
    if (r.declared_or_hunch === true) {
      const hop = (Array.isArray(r.rests_on) ? r.rests_on : []).find((x) => isObj(x) && (x.class === "declared" || x.class === "hunch"));
      const hopId = hop ? (isObj(hop.connection) && filled(hop.connection.id) ? hop.connection.id : hop.input) : null;
      return finding("LEAD_NOT_A_LEG", localize("hypotheses.index.what_cites_the_derived_connection", "{what} cites the derived connection {id}, whose chain carries a {v1} hop{v2}: a lead, never a basis for a finding (K1487)", { what: String(what), id: String(id), v1: String(hop ? hop.class : "declared or hunch"), v2: String(hopId ? ` (${hopId})` : "") }),
                     { connection: id, hop: hopId ?? null });
    }
    /* END DEC-49 REGION is-lead-leg */
    return null;
  }

  /* R6: the host's calculations instance, reached when first asked (the plane builds it before this module). */
  #calculationsOf() {
    if (!this.#calculations && this.#host) {
      try { this.#calculations = calculationsOf(this.#host); } catch { this.#calculations = null; }
    }
    return this.#calculations;
  }

  #exploreOf() {
    if (!this.#explore && this.#host) {
      try { this.#explore = exploreOf(this.#host); } catch { this.#explore = null; }
    }
    return this.#explore;
  }

  /** R5, R6 (promotion R39): inside the promotion's transaction, before the write, for every promotion of an inquiry.
   *  Every leg is asked, a replay's too: no leg ever rests on a hypothesis or a lead. */
  check(c) {
    if (!isObj(c) || c.promotedType !== "inquiry") return null;
    const fm = isObj(c.docFm) ? c.docFm : null;
    const legs = (fm && Array.isArray(fm.basis) ? fm.basis : []).filter(isObj);
    if (!legs.length) return null;
    const viewer = filled(c.author) ? c.author : (c.writer ?? null);
    const findings = this.legRefusals({ legs: legs.map((l, ord) => ({ ...l, ord })), viewer, inquiry: c.bundleId ?? null });
    if (!findings.length) return null;
    return { ok: false, reason: "BASIS_REFUSED", findings,
             detail: "a leg rests on a hypothesis, or on a derived connection that is a lead or cannot be re-derived. Nothing was written." };
  }
}

/* One finding as `inquiry` R11 carries them inside BASIS_REFUSED. */
function finding(code, detail, extra = {}) {
  const row = HYPOTHESES_CHECKS[code];
  return { check: row.check, code, severity: "error", translation: row.translation, detail, ...extra };
}

/** R6: the derivation a leg (or an input) carries beside a derived connection id: `derivation: {kind, from, to, as_of,
 *  method}`, or, in a document's frontmatter, whose list items hold scalars only, the five flat fields
 *  `derivation_kind`, `derivation_from`, `derivation_to`, `derivation_as_of`, `derivation_method`. Null when neither. */
export function derivationOf(leg) {
  if (!isObj(leg)) return null;
  if (isObj(leg.derivation)) return leg.derivation;
  const flat = Object.fromEntries(["kind", "from", "to", "as_of", "method"].map((k) => [k, leg[`derivation_${k}`]]));
  return Object.values(flat).some((v) => v !== undefined) ? flat : null;
}

/* Every string inside a value, walked. */
function stringsIn(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsIn(x, out);
  else if (isObj(v)) for (const x of Object.values(v)) stringsIn(x, out);
  return out;
}

/* ---- the ops map (R7) ---- */

/** R7: the route arms, keyed by op name, each a function of no arguments: the hypotheses' four and the notes' five
 *  (three since T34; `noterevise`, `notedelete` since T35, DEC-144); since T41, `hypothesistakeup` (R17) and the shares'
 *  `noteshare`, `noteunshare` and `shares` (R19–R21), as `op-declarations` R43 names them, and (K2508) R18's
 *  `hypothesissetaside`. An act's arguments come from the body, whose `by` is the control plane's stamp; a read's from `url`'s
 *  query, the `viewer` stamp among them, never the body. */
export function hypothesesOps(hypotheses, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = isObj(body) ? body : {};
  return {
    hypothesishold: () => hypotheses.hold(b),
    hypothesisrevise: () => hypotheses.revise(b),
    hypothesiswithdraw: () => hypotheses.withdraw(b),
    hypotheses: () => (q("id") ? hypotheses.read({ hypothesisId: q("id"), viewer: q("viewer") })
                                : hypotheses.hypothesesOf({ inquiry: q("inquiry"), viewer: q("viewer") })),
    notewrite: () => hypotheses.noteWrite(b),
    notes: () => hypotheses.notesOf({ viewer: q("viewer"), after: q("after"), limit: q("limit") ?? undefined }),
    noteturn: () => hypotheses.noteTurn(b),
    noterevise: () => hypotheses.noteRevise(b),
    notedelete: () => hypotheses.noteDelete(b),
    hypothesistakeup: () => hypotheses.hypothesisTakeUp(b),
    hypothesissetaside: () => hypotheses.hypothesisSetAside(b),
    noteshare: () => hypotheses.noteShare(b),
    noteunshare: () => hypotheses.noteUnshare(b),
    shares: () => hypotheses.sharesOf({ project: q("project"), viewer: q("viewer") }),
    /* F1 (layer 12, CR2-19): the rival explanations' door, admitted by affordances' CR2-16 and op-declarations' CR2-17 */
    hypothesisrivals: () => hypotheses.hypothesisRivals({ inquiry: b.inquiry, rivals: b.rivals, by: b.by }),
    explorenext: () => hypotheses.exploreNext({ inquiry: b.inquiry, rival: b.rival, by: b.by }),
    rivals: () => (q("history") ? hypotheses.rivalHistory({ inquiry: q("inquiry"), viewer: q("viewer") })
                                : hypotheses.rivalsOf({ inquiry: q("inquiry"), viewer: q("viewer") })),
  };
}

/* R24 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  hypothesishold: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("hypotheses.declared.hypothesishold", "inquiry-directed: keyed by a new HYP- id in an inquiry; held as a hypothesis, never a fact or a leg"),
    fields: { accepts: ["inquiry","kind","statement","about"], requires: ["inquiry","kind","statement","about"] } },
  hypothesisrevise: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("hypotheses.declared.hypothesisrevise", "hypothesis-directed: keyed by hypothesis; a new statement with its reason, the history kept"),
    fields: { accepts: ["hypothesisId","statement","about","reason"], requires: ["hypothesisId","reason"] } },
  hypothesiswithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("hypotheses.declared.hypothesiswithdraw", "hypothesis-directed: keyed by hypothesis; keeps it, shown withdrawn"),
    fields: { accepts: ["hypothesisId","reason"], requires: ["hypothesisId","reason"] } },
  notewrite: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("hypotheses.declared.notewrite", "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle"),
    fields: { accepts: ["text"], requires: ["text"] } },
  noterevise: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("hypotheses.declared.noterevise", "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle"),
    fields: { accepts: ["note","text"], requires: ["note","text"] } },
  noteturn: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("hypotheses.declared.noteturn", "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle"),
    fields: { accepts: ["note","into","hunch","made"], requires: ["note","into",["made","hunch"]] } },
  notedelete: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: localize("hypotheses.declared.notedelete", "note-directed: a member's own note, keyed by the note and answered to its author alone; never a record id, never cited, published or counted; moves no bundle"),
    fields: { accepts: ["note"], requires: ["note"] } },
  /* F1 (layer 12, CR2-19; op-declarations F4, R80): the rival explanations' three ops, declared here and nowhere else; the
     acts stamped `by` and `viewer` (each act reads `by`), `contribute` their capability; the read a session's. */
  hypothesisrivals: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: "contribute", stamps: ["by","viewer"], weight: "reversible", description: localize("hypotheses.declared.hypothesisrivals", "inquiry-directed: keyed by a question; sets its rival explanations to 2 to 6 hypotheses held in it or proposed by the system in it, each change kept with who and when; never a fact, a leg or a grade"),
    fields: { accepts: ["inquiry","rivals"], requires: ["inquiry","rivals"] } },
  explorenext: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: "contribute", stamps: ["by","viewer"], weight: "reversible", description: localize("hypotheses.declared.explorenext", "inquiry-directed: keyed by a question and one of its rivals; the member's one 'Explore this next' mark, replacing their own earlier one; sets the order of exploring and nothing else, not evidence"),
    fields: { accepts: ["inquiry","rival"], requires: ["inquiry","rival"] } },
  rivals: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("hypotheses.declared.rivals", "read: a question's rival explanations in the order of exploring, each labelled a hypothesis with no grade, with the legs the steps opened from it produced; with history, every add, remove and mark; writes nothing"),
    fields: { accepts: ["inquiry","history"], requires: ["inquiry"] } },
});
