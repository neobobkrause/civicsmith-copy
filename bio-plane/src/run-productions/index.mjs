/* run-productions — what an AI run produces, and the only way it produces it (requirements:
 * `build/requirements/run-productions.md`, R1–R25; map: `build/extraction/run-productions.md`). Extracted from the
 * legacy store (PL-3/IS-4's suggest endpoint `suggestVersion` with `#suggestionPersisted` and `#suggestionFrontmatter`;
 * SK-8's `extractPropose` and `extractProposals` with `#posFields`; the dispatch of `op=suggest`, `op=extractpropose`
 * and `op=extractproposals`), from the legacy schema (`suggest_refusals`, `proposed_readings`) and from the check
 * catalogue (C-27 and C-104, now this module's own rows in `checks.mjs`).
 *
 * `runProductionsOf(ctx, deps)` answers the one instance per Durable Object storage (K61). It reaches `record-core`,
 * `membership`, `content`, `connections`, `ai-runs`, `strength`, `citation`, `inquiry` and `basis-versions` through their
 * factories; a run is read only through ai-runs' `runFor` (its R28) and a bound through its `boundOf` and
 * `consumeBound` (its R29), never in this module's SQL (N194); whether the caller holds the run is `run-rules`'
 * `runPrincipalGate` (its R5). It declares its tables to purge (R17, K23), registers
 * its candidate source with basis-versions (R14; its R40), and registers its machine-passage read with inquiry (its
 * R62) and basis-versions (its R49) (R25).
 *
 * WHAT THIS MODULE DOES NOT DO (§4, §10): it accepts, hides, rejects or makes current nothing; it captures and requests
 * nothing; it notifies nobody; it opens no run, writes no run and no bound row (R18), and it reads a run only through
 * `ai-runs.runFor` and spends a bound only through `ai-runs.consumeBound`. */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { contentOf, mintLabel, canonicalExtent, citationExtent, legContentId } from "../content/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { strengthOf, ORIGIN_LIMIT, STRENGTH_AXES } from "../strength/index.mjs";
import { citationOf } from "../citation/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { basisVersionsOf, versionsIn, versionAsWritten, isBoilerplate } from "../basis-versions/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { runPrincipalGate, checkPagesRead, RUN_BOUNDS } from "../run-rules/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { aiAccountsOf } from "../ai-accounts/index.mjs";
import { EXTRACT_RUN_MODE, proposalChain, checkProposedRef, proposedReadingGrade, mintRatio } from "../extractrun.mjs";
import { readingSource, readingSourceJson, readingSourceFromColumns, describeChain } from "../textchain.mjs";
import { parseFrontmatter, normalizeType, OBJECT_TYPES, canonicalJson, isMachineIdentity, MACHINE_CLASS_PREFIX,
         idPattern, isStepId, sha256HexSync, ACCEPTANCE_FORMS, acceptanceRecord } from "../record-grammar/index.mjs";
import { SUGGEST_CHECKS, EXTRACT_PROPOSE_CHECKS, SUGGEST_KINDS, SUGGEST_LEVELS } from "./checks.mjs";
import { RUN_PRODUCTIONS_TABLES, migrateRunProductions, passageProposalId } from "./schema.mjs";
import { CONNECTION_TARGET_KINDS, CONNECTION_HOW, READ_PAGES_AT_A_TIME, READING_RUN_MODES, BEARING_SENTENCES_MAX,
         BEARING_SENTENCE_MAX_CHARS, ACCEPT_WORDS_MAX, unitContaining, pagesOf, connectionLink } from "./reading.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { SUGGEST_CHECKS, EXTRACT_PROPOSE_CHECKS, SUGGEST_KINDS, SUGGEST_LEVELS, SUGGEST_CHECK_KEYS,
         EXTRACT_PROPOSE_CHECK_KEYS, ROWLESS_CODES } from "./checks.mjs";
export { RUN_PRODUCTIONS_SCHEMA, RUN_PRODUCTIONS_TABLES, runProductionsOwns, migrateRunProductions, passageProposalId }
  from "./schema.mjs";
export { CONNECTION_TARGET_KINDS, CONNECTION_HOW, READ_PAGES_AT_A_TIME, DOC_PARAS_PER_PAGE, READING_RUN_MODES,
         BEARING_SENTENCES_MAX, BEARING_SENTENCE_MAX_CHARS, ACCEPT_WORDS_MAX, unitContaining, pagesOf, cellInRange,
         connectionLink } from "./reading.mjs";

export const RUN_PRODUCTIONS_MODULE = "run-productions";

/** R3's legs bound: the WRITE cap, below the read cap of 500 (basis-versions R9), because every leg of a reading is a
 *  thing a member must read (§6 rule 4). Published in the refusal that hits it and on every answer (R5). */
export const SUGGEST_LEGS_MAX = 120;
/** The independence trace's origin limit (strength R12, R27): `strength`'s, re-exported as R5's `origin_limit`; the
 *  trace's own `limit` wins where it gives one. */
export const SUGGEST_ORIGIN_MAX = ORIGIN_LIMIT;
/** C-27.16's second bound: basis-versions' read maximum (its R9). A question holding more versions than a comparison
 *  reads cannot be said to hold none the same in substance. */
export const SUGGEST_VERSIONS_MAX = 1000;
/** The fields only a member's act writes (R3, C-27.13; D-271 adds the two affirmations). */
export const SUGGEST_UNWRITABLE_FIELDS = Object.freeze(["state", "hidden", "state_by", "state_at", "state_reason", "at",
                                                        "affirmed_parts", "affirmed"]);
/** The three axes strength answers (strength's Terms), never composed into one value (DEC-21, DEC-44). */
export const PAIR_AXES = Object.freeze([...STRENGTH_AXES]);

/** R12's bounds. */
export const EXTRACT_PROPOSALS_LIMIT_DEFAULT = 100;
export const EXTRACT_PROPOSALS_LIMIT_MAX = 500;
/** The ratio's documents: workerd binds about 100 variables per statement (D-36), so the IN list is capped and the
 *  answer says when it was. */
export const EXTRACT_RATIO_DOCUMENTS_MAX = 64;

export const EXTRACT_PROPOSALS_SAYS = localize("run-productions.index.extract_proposals_says", "these readings are PROPOSALS. A machine read text this record already holds and said what it names. Nothing here is part of a finding until a MEMBER cites it, and none of it counts as extraction coverage");
export const EXTRACT_PROPOSAL_ROW_SAYS = localize("run-productions.index.extract_proposal_row_says", "a machine proposed this reading. It is not extraction coverage and it is not part of any finding — it becomes part of one when a MEMBER cites it, and not before");
/** R21: on every proposed connection. */
export const PROPOSED_CONNECTION_SAYS = localize("run-productions.index.proposed_connection_says", "the system proposed this connection. It is not a connection of the record and not part of any finding until a member takes it up; its grade is worked out from how the link is established, never from the machine's say-so");
/** R23: on every bearing note. */
export const BEARING_NOTE_SAYS = localize("run-productions.index.bearing_note_says", "the system's note on what this document says about the question, and what it does not. Each sentence is tied to the document's own words. It is shown beside the document, never in its place; it is not the document's content and is never cited as evidence");
/** R24: on every slice a run reads. */
export const READ_PAGES_SAYS = localize("run-productions.index.read_pages_says", "the text the record holds for these pages, read by a run a few pages at a time within its pages bound");

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const HEX64 = /^[0-9a-f]{64}$/;
const ENTITY_ID = idPattern("ENT");
/** R21 (K2502): the mode of an exploring run (question-explorer R13), which proposes while reading for its step. */
const EXPLORING_RUN_MODE = "investigate";
/** R24: the run's reading bound, run-rules' (its R26), read by key. */
const PAGES_BOUND = Object.prototype.hasOwnProperty.call(RUN_BOUNDS, "pages") ? "pages" : null;
const nonBlank = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
/** R21: a proposed connection's name, 'prc:' and the SHA-256 of what makes it one connection under a run. */
const connectionProposalId = (run, captureSha, kind, to, quote, pos) =>
  `prc:${sha256HexSync(canonicalJson(["connection", run, captureSha, kind, to, quote, pos]))}`;

/** The per-arm fields of a reading position without kind and ref, which is exactly the shape a content extent takes:
 *  one function, because the two are one vocabulary (IC-1) seen from two tables. */
export function posFields(pos) {
  const { kind, ref, ...rest } = pos;
  return rest;
}

/** WHAT A SUGGESTION WILL HOLD is basis-versions' `versionAsWritten` (its R5, REC-75, D-234): the one normaliser the
 *  write and C-27.10's comparison both read. A level is carried by the empty-level kind only.
 *
 *  The candidate as a frontmatter object, so its canonical composition is basis-versions' one composer's (its R5)
 *  over exactly the shape the document will hold, never a second composer. */
export function suggestionFrontmatter(id, p) {
  const name = p.version.name;
  return {
    id,
    basis_versions: [{ name, kind: p.version.kind, description: p.version.description, claim: p.version.claim,
                       relationship: p.version.relationship, state: "suggested", hidden: false,
                       derived_from: p.version.derived_from, run: p.version.run, author: p.version.author,
                       at: p.version.at }],
    basis_version_grounds: p.grounds.map((g) => ({ version: name, ground: g.ground, asserted_by: g.asserted_by,
                                                   at: g.at, statement: g.statement })),
    basis_version_legs: p.legs.map((l) => ({
      version: name, target: l.target, role: l.role, ground: l.ground, grade: l.grade, grade_axis: l.grade_axis,
      grade_source: l.grade_source, note: l.note, date: l.date, extent_kind: l.extent_kind,
      ...(l.extent_capture ? { extent_capture: l.extent_capture } : {}) })),
  };
}

/** WHAT C-27.10 COMPARES (§6 rule 8): the canonical composition with its name, its parentage and the clock taken out.
 *  A name is how a reading is addressed and `derived_from` where it came from; when it was recorded (field 3 of a
 *  ground row, D-231) is not a thing it says. The composition escapes tabs inside values, so a real tab splits
 *  fields exactly. */
export function substanceOf(composition) {
  return String(composition).split("\n")
    .filter((ln) => !/^name\t/.test(ln) && !/^derived_from\t/.test(ln))
    .map((ln) => (ln.startsWith("ground\t") ? ln.split("\t").map((f, i) => (i === 3 ? "" : f)).join("\t") : ln))
    .join("\n");
}

/** R29 (T53): the fields of a conversation's label (`agent-model` R26), each a string or null; `display_name`
 *  (`ai-runs` R104) may stand beside them, a non-empty string. */
export const PRODUCED_BY_FIELDS = Object.freeze(["provider", "host", "model_version", "effort", "account_level", "owner"]);
export const PRODUCED_BY_MAX = 32;
const LABEL_TEXT_MAX = 200;

/** R29: `produced_by` read: `{list: null}` when absent or null; `{list}` the labels, repeats dropped and the first
 *  kept, in order; `{malformed: <what is wrong>}` otherwise. Never throws. */
export function producedByOf(x) {
  if (x === undefined || x === null) return { list: null };
  if (!Array.isArray(x)) return { malformed: "not a list" };
  if (x.length === 0) return { malformed: "an empty list (send null when no AI produced the reading)" };
  if (x.length > PRODUCED_BY_MAX) return { malformed: `a list of ${x.length} labels, over the ${PRODUCED_BY_MAX} it may hold` };
  const text = (v) => typeof v === "string" && v.length <= LABEL_TEXT_MAX;
  const seen = new Set();
  const list = [];
  for (let i = 0; i < x.length; i++) {
    const l = x[i];
    if (!l || typeof l !== "object" || Array.isArray(l)) return { malformed: `a list whose entry ${i} is not a label` };
    const extra = Object.keys(l).filter((k) => !PRODUCED_BY_FIELDS.includes(k) && k !== "display_name");
    if (extra.length) return { malformed: `a list whose entry ${i} carries fields a label has not: ${extra.slice(0, 5).join(", ").slice(0, 120)}` };
    const missing = PRODUCED_BY_FIELDS.filter((k) => !(k in l) || !(l[k] === null || text(l[k])));
    if (missing.length) return { malformed: `a list whose entry ${i} lacks or misstates ${missing.join(", ")}` };
    if ("display_name" in l && !(text(l.display_name) && l.display_name.trim() !== ""))
      return { malformed: `a list whose entry ${i} has a display_name that is not a name` };
    const label = Object.fromEntries([...PRODUCED_BY_FIELDS, ...("display_name" in l ? ["display_name"] : [])].map((k) => [k, l[k]]));
    const key = canonicalJson(label);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(label);
  }
  return { list };
}

export class RunProductions {
  constructor({ storage, record, membership, content, connections, aiRuns, strength, citation, basisVersions,
                extraction = null, steps = null, aiAccounts = null, legEarning = null, now = null }) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.content = content;
    this.connections = connections;
    this.aiRuns = aiRuns;
    this.strength = strength;
    this.citation = citation;
    this.basisVersions = basisVersions;
    /* T41-24: extraction's store half for a capture's text units (its R36) and the references its readers found (its
       R58); ai-accounts' material limits (its R21, R22; T48, was credentials' R57); steps' `recordProduct` (its R9);
       leg-earning's earned capture ceiling (its R1; K2496). */
    this.extraction = extraction;
    this.steps = steps;
    this.aiAccounts = aiAccounts;
    this.legEarning = legEarning;
    this.now = typeof now === "function" ? now : () => Date.now();
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /** The module's tables (R2, R11, R17). */
  migrate() { migrateRunProductions(this.sql); }

  /* ==================================================================== *
   * PL-3 / IS-4 — THE SUGGEST ENDPOINT. ONE WRITE PATH FOR BOTH MODES (R1–R9).
   *
   * §10 makes this one endpoint rather than two: the background job and the interactive session are two ways into one
   * piece of work, and the fence needs no second design. THE SOLE POSSIBLE OUTPUT IS A `suggested` VERSION CARRYING ITS
   * RUN: all five of §9's kinds write that one object, the kind a field on it. THE ACCEPTANCE IS THE PRE-WRITE CHECKS
   * AND THEY ARE PLANE-SIDE (§14b.5): each has its own C-number and canned translation, and the fleet member receives
   * their verdicts. Every refusal is written as `refusal("<CODE>", …)` with the code a LITERAL, so the DEC-49 guard's
   * arm C can see and compare it (REC-71).
   * ==================================================================== */

  /** op=suggest — the investigative session's ONE write (R1–R9). `author`, `viewer` and `caller` are the control
   *  plane's stamps (R8). */
  suggest(a = {}) {
    const args = a || {};
    const refusal = (code, detail, extra) => {
      const row = SUGGEST_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
    };
    const str = (x) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);
    const viewer = args.viewer ?? null;

    /* DEC-49 REGION is-suggest-shape
     *
     * R1: the shape of the request, refused in order before anything is composed. A REGION and not the whole
     * function, so a refusal arriving here later is not conscripted into these rows (REC-71). */
    const target = String(args.target ?? "").trim();
    if (!target)
      return refusal("SUGGEST_NO_TARGET",
        "a suggestion is a reading of ONE question's evidence: pass target=<INQ-…>. There is no "
        + "default question and there must not be one.");
    if (normalizeType(OBJECT_TYPES[target.split("-")[0]]) !== "inquiry")
      return refusal("SUGGEST_NOT_AN_INQUIRY",
        `${target.slice(0, 60)} is not an inquiry, so there is nothing under it for a version to be a `
        + `version of.`, { target });

    const kind = String(args.kind ?? "").trim();
    if (!Object.prototype.hasOwnProperty.call(SUGGEST_KINDS, kind))
      return refusal("SUGGEST_UNKNOWN_KIND",
        `pass kind=<one of §9's kinds>: '${kind.slice(0, 40) || "(none)"}' is not one of §9's kinds: ${Object.keys(SUGGEST_KINDS).join(", ")}. `
        + `The set is closed because §15's empty-run instrument needs an object to count — without `
        + `'level-empty' a run that honestly found nothing is indistinguishable from a run that emitted `
        + `nothing.`,
        { target, kinds: Object.keys(SUGGEST_KINDS) });

    /* The viewer gate, fail-closed (D-15): a question the caller may not see answers exactly as an absent one. */
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state, b.bundle_sha FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b)
      return refusal("SUGGEST_NOT_AN_INQUIRY",
        "no question by that id is readable here, so there is nothing to add a reading to.", { target });

    /* §11: EVERY VERSION NAMES THE RUN THAT PRODUCED IT. Three questions of the run, in this order, and all BEFORE
       R2's memo, whose key carries no caller (REC-165): (a) SIGHT — `ai-runs.runFor` answers null for an absent and
       an invisible run alike, so both read as the same SUGGEST_NO_RUN but for the id (§7.9); (b) POSITION — run-rules'
       R5 (`runPrincipalGate`), relayed whole; (c) STATUS — a version is formed under a LIVE run's conditions (rule 1). Then (d), BOB #28's
       target rule, after sight and position so a hidden run still reads as absent. */
    const run = String(args.run ?? "").trim();
    const runRow = run ? this.aiRuns.runFor(run, viewer) : null;
    if (!runRow)
      return refusal("SUGGEST_NO_RUN",
        run ? `no run named '${run.slice(0, 60)}' is open in this store, and a version is only `
              + `interpretable against the conditions its run was formed under (§11).`
            : "pass run=<the run that composed this>: §11 requires every version to name the piece of "
              + "work that produced it, because the bias in force, the declared standard and the claim "
              + "set can all change at the drop of a hat.",
        { target, run: run || null });
    const notPrincipal = runPrincipalGate({ caller: args.caller ?? null, principal: runRow.principal_plane,
                                            act: "suggesting a reading under a run" });
    /* RELAYED FIELD BY FIELD AND NEVER SPREAD, so the DEC-49 guard can read the verdict; the code, check and
       translation are the gate's own (C-22.12). */
    if (notPrincipal)
      return { ok: false, reason: notPrincipal.code, code: notPrincipal.code, check: notPrincipal.check,
               translation: notPrincipal.translation, detail: notPrincipal.detail, target, run,
               note: "a suggestion names a run its caller holds. Nothing was composed or written" };
    /* R28 (T53; agent-steps R54): A RETRIED CALL OF A RUN WRITES ONE VERSION. A call carrying an `idem` this run has
       already sent, and whose first call wrote, is answered that first answer verbatim with `repeated: true`: nothing
       is judged or written again. Asked after sight and position, so only the run's holder hears it, and before the
       name check, which the first call's own version would otherwise answer. A call refused never kept an `idem`. */
    const idem = typeof args.idem === "string" && args.idem.trim() !== "" ? args.idem.trim() : null;
    if (idem) {
      const first = this.#one(`SELECT answer FROM suggest_writes WHERE run=? AND idem=?`, run, idem);
      if (first && first.answer) return { ...JSON.parse(first.answer), repeated: true };
    }
    if (runRow.status !== "running")
      return refusal("SUGGEST_RUN_NOT_RUNNING",
        `the run '${run.slice(0, 60)}' has ended, and a version is formed under a LIVE run's conditions `
        + `(§11 item 5, rule 1): open a new run to go on working, as the member's act.`,
        { target, run });
    /* (d) A SUGGESTION LANDS ONLY INSIDE ITS RUN'S CONTEXT: the context itself, or, for a run over a project, a
       question that project CONFIRMED-cites (`connections.citesInto`, the one live-cites predicate). */
    const ctxId = String(runRow.context_id ?? "");
    const inContext = target === ctxId
      || (String(runRow.context_type) === "project" && this.connections.citesInto(target).confirmed.includes(ctxId));
    if (!inContext)
      return refusal("SUGGEST_OUTSIDE_RUN_CONTEXT",
        `${target.slice(0, 60)} is outside the context of the run '${run.slice(0, 60)}': a run's readings `
        + `land on its own question, or, for a run over a project, on a question that project cites. Work on `
        + `another question opens a run over it.`,
        { target, run });

    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return refusal("SUGGEST_NO_DOCUMENT",
        "this question has no readable file, so no reading can be added to it.", { target });
    const fm0 = parseFrontmatter(liveMd.content).data || {};
    const existing = Array.isArray(fm0.basis_versions) ? fm0.basis_versions : [];

    /* §6 rule 2, COMPARED AS WRITTEN (REC-75, D-234): the held names went through the grammar's escape at their
       write, so the caller's name is compared after it too, or a name the escape folds would pass here and be
       refused at the promotion in another family's words. */
    const name = String(args.name ?? "").trim();
    const nameWritten = versionAsWritten({ name }).version.name;
    if (existing.some((r) => r && typeof r === "object" && String(r.name ?? "").trim() === nameWritten))
      return refusal("SUGGEST_NAME_TAKEN",
        `'${name.slice(0, 60)}' already names a reading of ${target}. §6 rule 2: a version name is `
        + `unique WITHIN its inquiry, and derived_from reads by name.`,
        { target, name, known: existing.map((r) => String(r?.name ?? "").trim()).filter(Boolean).slice(0, 20) });

    const legsIn = Array.isArray(args.legs) ? args.legs : [];
    if (legsIn.length > SUGGEST_LEGS_MAX)
      return refusal("SUGGEST_TOO_MANY_LEGS",
        `${legsIn.length} legs were submitted and a version may carry ${SUGGEST_LEGS_MAX}. The `
        + `bound is PUBLISHED here rather than applied silently, so a caller splits the reading rather `
        + `than guessing what fitted.`,
        { target, legs: legsIn.length, limit: SUGGEST_LEGS_MAX });

    /* §9's empty-level kind says WHICH level and WHERE THE SEARCH IS LOGGED: absence at one level is not evidence of
       absence at the next, and an unattributed empty answer is the shape nobody can check. */
    const level = str(args.level);
    const observedAt = str(args.observed_at);
    if (kind === "level-empty" && (!level || !SUGGEST_LEVELS.includes(level) || !observedAt))
      return refusal("SUGGEST_EMPTY_LEVEL_UNSTATED",
        `kind=level-empty carries level=<${SUGGEST_LEVELS.join("|")}> and observed_at=<the observation-log `
        + `address of the search that establishes it>. Absence at one level is not evidence of absence at `
        + `the next, and an unattributed empty answer is the one shape a later reader cannot check.`,
        { target, level, observed_at: observedAt, levels: SUGGEST_LEVELS });

    /* R29 (T53; agent-steps R56): WHO PRODUCED THE CANDIDATE, the labels of the conversations as agent-model answered
       them (its R26), kept as sent but for repeats, first kept. Absent or null for a reading no AI produced. */
    const producedBy = producedByOf(args.produced_by);
    if (producedBy.malformed)
      return refusal("SUGGEST_PRODUCED_BY_MALFORMED",
        `produced_by is ${producedBy.malformed}. It is the list of the labels of the conversations that produced this `
        + `reading, each {${PRODUCED_BY_FIELDS.join(", ")}} as the conversation answered it (display_name beside them `
        + `when it carries one), or null when no AI produced it. Nothing was written.`,
        { target, fields: PRODUCED_BY_FIELDS, limit: PRODUCED_BY_MAX });
    /* END DEC-49 REGION is-suggest-shape */

    /* ---- R2 (F10). THE SUBMISSION'S IDENTITY, AND THE STRUCTURAL NO-OP.
     *
     * A verbatim resubmit changes NOTHING: the stored refusal comes back unaltered, no check runs again, no document
     * is touched and no version is written; only its counter moves (instrumentation, §15). THE KEY IS THE SUBMISSION
     * ITSELF, BYTE FOR BYTE, never a hash, and the question's `bundle_sha` is part of it: the moment the document
     * moves, the same bytes are a different question and are judged afresh. The refusals above, which fire before a
     * target resolves or before the run is known to be the caller's, are never stored. The fields §4 forbids ride the
     * key too, each with a prefix, so a caller that fixes one is genuinely re-evaluated. */
    const submission = canonicalJson({
      kind, name, description: args.description ?? null, claim: args.claim ?? null,
      relationship: args.relationship ?? null, derived_from: args.derived_from ?? null,
      level, observed_at: observedAt, run,
      grounds: (Array.isArray(args.grounds) ? args.grounds : []).map((g) => ({
        ground: g?.ground ?? null, statement: g?.statement ?? null, asserted_by: g?.asserted_by ?? null })),
      legs: legsIn.map((l) => ({
        target: l?.target ?? null, role: l?.role ?? null, ground: l?.ground ?? null,
        grade: l?.grade ?? null, grade_axis: l?.grade_axis ?? null,
        grade_source: l?.grade_source ?? null, note: l?.note ?? null, date: l?.date ?? null,
        ...(l?.extent_capture !== undefined ? { extent_capture: l.extent_capture } : {}) })),
      refused_state: args.state ?? null, refused_hidden: args.hidden ?? null,
      refused_state_by: args.state_by ?? null, refused_state_at: args.state_at ?? null,
      refused_state_reason: args.state_reason ?? null, refused_at: args.at ?? null,
      refused_affirmed_parts: args.affirmed_parts ?? null, refused_affirmed: args.affirmed ?? null,
    });
    const nowIso = stampInstant("second", this.now());
    const prior = this.#one(
      `SELECT * FROM suggest_refusals WHERE target=? AND base_sha=? AND submission=?`,
      target, b.bundle_sha, submission);
    if (prior) {
      this.sql.exec(
        `UPDATE suggest_refusals SET repeats = repeats + 1, last_at = ? WHERE target=? AND base_sha=? AND submission=?`,
        nowIso, target, b.bundle_sha, submission);
      const stored = JSON.parse(prior.payload);
      return { ...stored, repeated: true, evaluated: false, wrote: false,
               repeats: prior.repeats + 1, first_refused_at: prior.first_at };
    }
    /* One helper, so every refusal below is stored by the SAME path it is returned by (R3's last sentence). */
    const remember = (r) => {
      this.sql.exec(
        `INSERT INTO suggest_refusals (target, submission, base_sha, code, payload, first_at, last_at, repeats)
         VALUES (?,?,?,?,?,?,?,0)`,
        target, submission, b.bundle_sha, r.code, JSON.stringify(r), nowIso, nowIso);
      return { ...r, repeated: false, evaluated: true, wrote: false };
    };

    /* DEC-49 REGION is-suggest-checks
     *
     * R3: §14b.5's checks, each its own C-number, each removable on its own, in the order a caller can most cheaply
     * act on. */

    /* C-27.13 — NOTHING IN IT IS IN A STATE THE SESSION MAY NOT WRITE (§4: the AI holds no op that accepts). A
       submission that arrives already decided, or pre-affirmed (D-271), is refused by name rather than ignored. */
    const forbidden = SUGGEST_UNWRITABLE_FIELDS
      .filter((k) => args[k] !== undefined && args[k] !== null && args[k] !== "");
    if (forbidden.length)
      return remember(refusal("SUGGEST_UNWRITABLE_STATE",
        `a suggestion is born in state 'suggested' and carries nothing else about what has been decided `
        + `about it, and this submission set: ${forbidden.join(", ")}. Every one of those is a member `
        + `act (§6 rule 4) reachable only through op=versionaccept and its five siblings.`,
        { target, name, fields: forbidden }));

    /* AND THE STRUCTURAL ASSERTION ONLY A MEMBER CAN MAKE (C-25.5, C-25.6). Every version carrying legs declares at
       least one part, and a part is asserted by a named member. PL-19 / DEC-65's single-part licence: a machine may
       compose a reading declaring EXACTLY ONE part (one part has no maximum to take, so nobody is credited with a
       structural claim), never two or more; an UNNAMED credential never. `asserted_by` is stamped from the session,
       never taken from the caller. */
    const who = String(args.author ?? "").trim();
    const groundsIn = Array.isArray(args.grounds) ? args.grounds : [];
    const declared = groundsIn.map((g) => str(g?.ground)).filter(Boolean);
    const declaredParts = [...new Set(declared)];
    const singlePart = declaredParts.length === 1 && declared.length === 1 && legsIn.length > 0;
    if ((declared.length || legsIn.length > 0) && (!who || (isMachineIdentity(who) && !singlePart)))
      return remember(refusal("SUGGEST_UNWRITABLE_STATE",
        `this reading rests on ${legsIn.length} piece(s) of evidence arranged into ${declared.length || "no"} `
        + `declared part(s), and the credential that submitted it is ${who ? "a machine" : "unnamed"}. A `
        + `reading that rests on anything CARRIES the arrangement of what it rests on (C-25.5), and saying `
        + `a part of an argument would carry the answer on its own is an authored judgment a named member `
        + `signs for (C-25.6). A machine COMPOSES a reading and does not assert its structure — it may `
        + `put everything it rests on into ONE part, where there is nothing to assert because there is no `
        + `maximum to take, and it may still report that a level of the search is empty, which rests on `
        + `nothing and asserts nothing.`,
        { target, name, legs: legsIn.length, branches: declared.length }));

    /* C-27.12 — NO BOILERPLATE: the placeholder defect at machine scale, held to basis-versions' one predicate. */
    const filler = [];
    if (isBoilerplate(args.description)) filler.push("description");
    if (args.claim !== undefined && args.claim !== null && args.claim !== ""
        && isBoilerplate(args.claim)) filler.push("claim");
    if (str(args.description) && str(args.claim)
        && str(args.description).toLowerCase() === str(args.claim).toLowerCase()) filler.push(word("run-productions.claim_repeats_description"));
    for (const g of groundsIn)
      if (g && g.statement !== undefined && g.statement !== null && g.statement !== ""
          && isBoilerplate(g.statement)) filler.push(word("run-productions.statement", { ground: String(String(g.ground).slice(0, 40)) }));
    for (let i = 0; i < legsIn.length; i++)
      if (legsIn[i] && legsIn[i].note !== undefined && legsIn[i].note !== null && legsIn[i].note !== ""
          && isBoilerplate(legsIn[i].note)) filler.push(word("run-productions.note_leg", { n: String(i) }));
    if (filler.length)
      return remember(refusal("SUGGEST_BOILERPLATE",
        `${filler.join(", ")} carries filler rather than an account of anything. §6 rule 1 holds a `
        + `version's description to a commit message's standard — what changed and why — because it is `
        + `what survives a conversation that was deliberately not kept (§10).`,
        { target, name, fields: filler }));

    /* C-27.8 — EVERY LEG EXISTS AND IS REACHABLE AT ITS ADDRESS (D-168: a type check would pass retired
       information). Three questions: is it IN the record, READABLE from here, and has the record RETIRED it
       (`citation.retiredNotCitable`, the one predicate, never viewer-gated: the viewer decides only the wording).
       R9 (D-595) adds a fourth for a document leg: the capture it rests on. A capture the leg names must be one the
       record holds for that document (`content.captureFor`'s authored arm); a leg naming none rests on the capture the
       record presents for it now, and a leg on a question rests on none. */
    const unreachable = [];
    const pins = [];
    for (let i = 0; i < legsIn.length; i++) {
      const t = str(legsIn[i]?.target);
      pins.push(null);
      if (!t) { unreachable.push({ ord: i, target: null, why: "no address" }); continue; }
      const retired = this.citation.retiredNotCitable(t);
      const row = this.#one(`SELECT b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, t, ...gate.args);
      if (!row) { unreachable.push({ ord: i, target: t, why: word("run-productions.why.record_readable") }); continue; }
      if (retired) { unreachable.push({ ord: i, target: t, why: word("run-productions.why.record_retired") }); continue; }
      const named = legsIn[i]?.extent_capture;
      const isDoc = normalizeType(row.object_type) === "information";
      if (named !== undefined && named !== null && named !== "") {
        const held = isDoc && typeof named === "string" && HEX64.test(named) ? this.content.captureFor(t, named) : null;
        if (!held) { unreachable.push({ ord: i, target: t, why: word("run-productions.why.capture_names_record") }); continue; }
        pins[i] = held;
      } else if (isDoc) pins[i] = this.content.captureFor(t) || null;
    }
    if (unreachable.length)
      return remember(refusal("SUGGEST_LEG_UNREACHABLE",
        `${unreachable.length} of ${legsIn.length} legs cannot be reached at the address given: `
        + `${unreachable.map((u) => `${u.target ?? "(none)"} — ${u.why}`).join("; ")}. A type check would `
        + `have passed every one of these, which is D-168 exactly.`,
        { target, name, legs: unreachable }));

    /* C-27.9 — THE PAIR COMPUTES, PER AXIS, OVER THE DECLARED PARTITION: two answers over two populations, never one
       (DEC-21, DEC-44), computed by strength over the candidate's legs (its R26), never a second walk. The partition
       the legs sit in is compared against the one declared: a leg in a part nobody declared would let the maximum be
       taken over it, and a declared part holding no leg asserts nothing is sufficient on its own. Compared as
       serialised lists, since a part's label may hold a space. */
    const candidateLegs = legsIn.map((l) => ({
      target: str(l?.target) ?? "", role: typeof l?.role === "string" ? l.role : "",
      grade: l?.grade ?? null, grade_axis: l?.grade_axis ?? null, grade_source: l?.grade_source ?? null,
      ground: str(l?.ground) ?? null }));
    const { pair, error: pairError } = this.strength.candidatePair({ inquiry: target, legs: candidateLegs });
    const legal = ["graded", "unrated", "undetermined"];
    const axisBad = (x) => !x || !legal.includes(x.state) || (x.state === "graded" && (x.grade == null || !x.weakest));
    const usedLabels = [...new Set(candidateLegs.map((l) => l.ground).filter(Boolean))].sort();
    const declaredLabels = [...new Set(declared)].sort();
    const partitionDisagrees = JSON.stringify(usedLabels) !== JSON.stringify(declaredLabels);
    if (pairError || PAIR_AXES.some((x) => axisBad(pair?.[x])) || partitionDisagrees)
      return remember(refusal("SUGGEST_PAIR_DOES_NOT_COMPUTE",
        pairError
          ? `the arithmetic could not be run over this reading: ${pairError}`
          : partitionDisagrees
            ? `this reading declares [${declaredLabels.join(", ") || "none"}] as its separately `
              + `sufficient parts and its legs sit in [${usedLabels.join(", ") || "none"}]. A version `
              + `CARRIES its own structure (§3), so the two have to be the same set — otherwise the `
              + `maximum is taken over a part nobody declared, or a declared part holds nothing.`
            : `the pair did not resolve on every axis: `
              + `${PAIR_AXES.map((x) => `${x}=${pair?.[x]?.state ?? "(none)"}`).join(", ")}.`,
        { target, name, declared: declaredLabels, used: usedLabels,
          pair: pair ? Object.fromEntries(PAIR_AXES.map((x) => [x, pair[x]?.state ?? null])) : null }));

    /* C-27.16 and C-27.11 — D-195, INDEPENDENCE OVER THE SEPARATELY SUFFICIENT PARTS, from content-addressed
       provenance (strength R27, the one implementation `op=versionstrength` publishes too). A trace cut at its origin
       limit is UNDETERMINED, never independent (D-129): not found and did not finish looking are different facts. */
    const ind = this.strength.candidateIndependence({ legs: candidateLegs, parts: declaredLabels.length });
    const originLimit = Number.isSafeInteger(ind?.limit) ? ind.limit : SUGGEST_ORIGIN_MAX;
    const shared = Array.isArray(ind?.shared) ? ind.shared : [];
    const originsComplete = ind?.complete !== false;
    if (ind?.checked && ind.complete === false)
      return remember(refusal("SUGGEST_COMPARISON_INCOMPLETE",
        `tracing the separately sufficient parts of this reading back to their upstream material `
        + `reached the published bound of ${originLimit} per step, so independence is UNDETERMINED rather than `
        + `established. D-129: not found and did not finish looking are different facts, and only one `
        + `of them licenses putting this forward.`,
        { target, name, limit: originLimit, origins_complete: false }));
    if (shared.length)
      return remember(refusal("SUGGEST_BRANCHES_NOT_INDEPENDENT",
        `${shared.length} pair(s) of separately sufficient parts trace to the same upstream material: `
        + `${shared.map((s) => `'${s.a}' and '${s.b}' through ${s.through.join(", ")}`).join("; ")}. `
        + `§12 takes the MAXIMUM across them, so treating them as separate overstates the finding — `
        + `D-195. A named member may still affirm they are genuinely separate at the accept ceremony; a `
        + `machine composing at volume may not.`,
        { target, name, shared }));

    /* C-27.10 — DIFFERS IN SUBSTANCE FROM EVERY EXISTING VERSION (§6 rule 8, the write gate). The candidate is
       composed from the values the write will store (REC-75) by basis-versions' one composer, and compared with every
       held composition (basis-versions' R38 read contract) with the name, the parentage and the clock taken out
       (`substanceOf`). A comparison that did
       not reach every held reading cannot say this one is new, so past the bound it fails closed (C-27.16). */
    const persisted = versionAsWritten({
      kind, name, description: args.description, claim: args.claim,
      relationship: args.relationship, derived_from: args.derived_from,
      run, author: who || null, at: nowIso,
      level: kind === "level-empty" ? level : null, observed_at: kind === "level-empty" ? observedAt : null,
      grounds: groundsIn, legs: legsIn.map((l, i) => ({ ...l, extent_capture: pins[i] })),
    });
    const candidate = versionsIn(suggestionFrontmatter(target, persisted))[0] ?? null;
    const mine = candidate ? substanceOf(candidate.composition) : "";
    const held = this.#rows(
      `SELECT name, composition FROM inquiry_basis_versions WHERE bundle_id=? LIMIT ?`, target, SUGGEST_VERSIONS_MAX + 1);
    if (held.length > SUGGEST_VERSIONS_MAX)
      return remember(refusal("SUGGEST_COMPARISON_INCOMPLETE",
        `${target} holds more than ${SUGGEST_VERSIONS_MAX} readings, which is the bound this `
        + `comparison publishes, so whether this one differs in substance from every existing one was `
        + `not settled. A duplicate the comparison never reached would read exactly like a new reading.`,
        { target, name, limit: SUGGEST_VERSIONS_MAX }));
    const twin = held.find((r) => substanceOf(r.composition) === mine);
    if (twin)
      return remember(refusal("SUGGEST_NOT_DIFFERENT",
        `this reading is identical in substance to '${twin.name}', which ${target} already holds. §6 rule `
        + `8 is the write gate: a run adds its output as a new version ONLY IF it differs in substance `
        + `from every existing one. Compared over the same canonical composition the freeze compares, `
        + `with the name and the parentage excluded — those are how a reading is addressed, not what it `
        + `says.`,
        { target, name, same_as: twin.name }));
    /* END DEC-49 REGION is-suggest-checks */

    /* DEC-49 REGION is-suggest-write
     *
     * R4: THE WRITE, AND THERE IS NO SECOND WRITE PATH. basis-versions appends the version to the question's own
     * document and promotes it (its R28), so the document stays the authority (D-21) and the promotion judges it. The
     * Session Log entry names the run. A document the grammar cannot extend in place (its `UNSPLICEABLE_BASIS`) is
     * C-27.14; any other refusal of the write, basis-versions' or the promotion's, is returned unchanged, and stored
     * under the same key (R2). THE VERDICT IS THIS SITE'S OWN (N411): the relay states `ok: false` and names the code
     * and reason it carries, so the refusal is never read as a verdict inherited from the spread; every other field is
     * the provider's, unchanged (R3). */
    const pv = persisted.version;
    const producedJson = producedBy.list ? canonicalJson(producedBy.list) : null;
    const promoted = this.record.transact(() => {
      const done = this.basisVersions.appendVersion({
        target,
        version: { name: pv.name, kind: pv.kind, description: pv.description,
                   ...(pv.claim === null ? {} : { claim: pv.claim }), relationship: pv.relationship,
                   derived_from: pv.derived_from, run: pv.run,
                   ...(pv.author === null ? {} : { author: pv.author }), at: pv.at,
                   ...(pv.level === null ? {} : { level: pv.level }),
                   ...(pv.observed_at === null ? {} : { observed_at: pv.observed_at }) },
        grounds: persisted.grounds.map((g) => ({ ground: g.ground, asserted_by: g.asserted_by, at: g.at,
                                                 ...(g.statement === null ? {} : { statement: g.statement }) })),
        legs: persisted.legs.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== null))),
        author: pv.author, at: pv.at,
      log: `### Session ${nowIso} | Suggestion | ${who || run}\n`
         + `Trigger: op=suggest on ${target}\n`
         + `Changes: reading '${name}' proposed as ${kind}, in state suggested, carrying run ${run}.\n`
         + (producedJson ? `Produced by: ${producedJson}\n` : ""),
      });
      /* R28, R29: the version's row here, in the same transaction as the version, so neither stands without the
         other. */
      if (done && done.ok)
        this.sql.exec(`INSERT INTO suggest_writes (target, version, run, idem, produced_by, answer, at)
                       VALUES (?,?,?,?,?,NULL,?)`, target, pv.name, run, idem, producedJson, nowIso);
      return done;
    });
    if (promoted && promoted.ok === false && promoted.reason === "UNSPLICEABLE_BASIS")
      return remember(refusal("SUGGEST_UNWRITABLE_DOCUMENT",
        "this question's version block is in a shape the restricted frontmatter grammar cannot be "
        + "extended in place, so nothing was written. The grammar has no escapes and a guess would "
        + "corrupt the document silently.", { target, name }));
    if (!promoted || !promoted.ok)
      return remember({ ...promoted, ok: false, reason: promoted?.reason ?? promoted?.code,
                        code: promoted?.code ?? promoted?.reason, target, name });
    /* END DEC-49 REGION is-suggest-write */

    /* R5 — THE ANSWER IS ASSEMBLED OUT OF THREE NAMED GROUPS AND LABELS ITSELF (D-235). `record`: read back out of
     * the projection the promotion just wrote, through the read `op=basisversions` answers, so the two ops cannot
     * publish different bytes for one version; null, never a substitute, when the read comes back empty
     * (`read_back` says which). `derived`: computed over this submission and not stored (the pair per axis and the
     * independence trace; `shared_origins` is empty on every pass by construction, and `op=versionstrength` is where
     * a reader finds the recomputed trace). `call`: true of this act. `fields_of` is computed from the groups, never
     * typed, so no field reaches the answer without saying where its bytes came from. */
    const readBack = this.basisVersions.basisVersions({ id: target, limit: SUGGEST_VERSIONS_MAX, viewer });
    const recorded = (readBack && Array.isArray(readBack.versions)
      ? readBack.versions.find((v) => v && v.name === persisted.version.name) : null) || null;
    const fromRecord = {
      target: b.bundle_id,
      version: recorded ? recorded.name : null,
      kind: recorded ? recorded.kind ?? null : null,
      run: recorded ? recorded.run : null,
      state: recorded ? recorded.state : null,
      author: recorded ? recorded.author : null,
      at: recorded ? recorded.at : null,
      legs: recorded ? recorded.legs ?? null : null,
      count: recorded ? recorded.leg_count ?? null : null,
      grounds: recorded ? recorded.grounds ?? null : null,
      ground_count: recorded && Array.isArray(recorded.grounds) ? recorded.grounds.length : null,
      composition: recorded ? recorded.composition : null,
      /* R29: read back from the row written with the version, as stored; null for a reading no AI produced. */
      produced_by: (() => {
        const w = this.#one(`SELECT produced_by FROM suggest_writes WHERE target=? AND version=?`, target, pv.name);
        return w && w.produced_by ? JSON.parse(w.produced_by) : null;
      })(),
      bundleSha: promoted.bundleSha, rowVersion: promoted.rowVersion,
    };
    const derived = {
      pair: Object.fromEntries(PAIR_AXES.map((x) => [x, pair[x]])),
      shared_origins: shared, origins_complete: originsComplete,
    };
    const call = {
      ok: true, weight: "single",
      limit: SUGGEST_LEGS_MAX, truncated: recorded ? recorded.legs_complete === false : false,
      origin_limit: originLimit,
      evaluated: true, repeated: false, wrote: true, read_back: !!recorded,
    };
    const fields_of = { fields_of: "label", composition_of: "label", composition_grades: "label" };
    for (const [src, group] of [["record", fromRecord], ["derived", derived], ["call", call]])
      for (const k of Object.keys(group)) fields_of[k] = src;
    const answer = {
      ...fromRecord, ...derived, ...call, fields_of,
      composition_of: recorded ? "record" : "unread",
      composition_grades: recorded ? recorded.composition_grades ?? null : null,
    };
    /* R28: the answer a retry with the same `idem` is given, verbatim. */
    this.sql.exec(`UPDATE suggest_writes SET answer=? WHERE target=? AND version=?`, JSON.stringify(answer), target, pv.name);
    return answer;
  }

  /* ==================================================================== *
   * SK-8 — THE EXTRACT RUN'S PRODUCTIONS (R10–R13; BIO_Assistant_and_AI_Roles_v0_1.md §7.3).
   *
   * EXTRACT runs in DEC-62's RUN — no new runtime, no new credential class, no new fence — and content's mint door is
   * the door it walks through. Everything it refuses is refused by something that already existed; the only new
   * thing is the proposed reading itself. It does not start a run: a run begins on a member's act (DEC-24 rule 2).
   * ==================================================================== */

  /** C-104's refusal with its row (R13). */
  #refuse(code, detail, extra) {
    const row = EXTRACT_PROPOSE_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
  }

  /** THE RUN EVERY PRODUCTION NAMES (R10, R15, R23, R24): sight, then position, then status (REC-165), asked here once
   *  for every op that produces under a run, so each code has one site. An invisible run answers the SAME NO_SUCH_RUN a
   *  never-minted id gets, but for the id (§7.9). Answers `{run, runId}` or `{refusal}`. */
  #productionRun({ run, viewer = null, caller = null, act, note, memberMay = false }) {
    /* R23 (K2482): a note drafted interactively (run-rules R25's draft kind) names no run, and is then a member's own
       act: `{run: null}` for a member caller, never for a machine or an unstamped one. */
    const who = nonBlank(caller);
    if (memberMay && (run === null || run === undefined || run === "") && who && !isMachineIdentity(who))
      return { run: null, runId: null };
    /* DEC-49 REGION is-production-run */
    if (typeof run !== "string" || !run.trim())
      return { refusal: this.#refuse("NO_RUN",
        localize("run-productions.index.the_extract_role_works", "the EXTRACT role works in DEC-62's RUN and nowhere else: the run is the object that bounds this work, logs it, resumes it and checks it plane-side. A production outside one would be a second place a machine writes")) };
    const runId = run.trim();
    const r = this.aiRuns.runFor(runId, viewer);
    if (!r)
      return { refusal: this.#refuse("NO_SUCH_RUN",
        localize("run-productions.index.no_such_run_is_open", "no run is open under {runId}. A run begins on a MEMBER's act (op=airunopen), naming the subject and the objective — both of which stay the member's (DEC-24 rule 2). The assistant may propose that a run would help; it may not start one", { runId }), { run: runId }) };
    /* END DEC-49 REGION is-production-run */
    const notPrincipal = runPrincipalGate({ caller, principal: r.principal_plane, act });
    if (notPrincipal)
      return { refusal: { ok: false, reason: notPrincipal.code, code: notPrincipal.code, check: notPrincipal.check,
                          translation: notPrincipal.translation, detail: notPrincipal.detail, run: runId, note } };
    /* DEC-49 REGION is-production-live */
    if (r.status !== "running")
      return { refusal: this.#refuse("RUN_NOT_RUNNING",
        `this run has ended. Its log is closed and a later production does not reopen it — the conditions a run was `
        + `formed under are what its work is interpretable against, and they stopped being current when it stopped`,
        { run: runId, status: r.status }) };
    /* END DEC-49 REGION is-production-live */
    return { run: r, runId };
  }

  /** THE HELD DOCUMENT A PRODUCTION READS (R10, R24), asked once in content's mint door's words (its R15): NO_TARGET and
   *  NO_SUCH_BUNDLE carry no row (R13, K163) and an absent and an invisible document answer alike. Answers
   *  `{bundle, sha}` (`bundle` its `bundles` row) or `{refusal}`. */
  #heldDocument(bundleId, viewer) {
    if (typeof bundleId !== "string" || !bundleId.trim())
      return { refusal: { ok: false, reason: "NO_TARGET", code: "NO_TARGET",
                          detail: `a production names the document it was read from` } };
    const b = this.#one(`SELECT bundle_id, object_type, project FROM bundles WHERE bundle_id=?`, bundleId);
    if (!b || !this.membership.inSight(bundleId, viewer))
      return { refusal: { ok: false, reason: "NO_SUCH_BUNDLE", code: "NO_SUCH_BUNDLE", target: bundleId,
                          detail: `no document is addressed by ${bundleId} in this record` } };
    /* DEC-49 REGION is-held-document */
    if (normalizeType(b.object_type) !== "information")
      return { refusal: this.#refuse("NOT_A_DOCUMENT",
        localize("run-productions.index.bundleid_is_not_a_document", "{bundleId} is not a document, so there is no text to have read. The content axis ranges over documents (DEC-21)", { bundleId: String(bundleId) }), { target: bundleId, target_type: normalizeType(b.object_type) ?? null }) };
    const sha = this.content.captureFor(bundleId);
    if (!sha)
      return { refusal: this.#refuse("NO_BYTES_HELD",
        `this record holds no capture of ${bundleId}, so there is no text a machine could have read. Absence here is `
        + `a fact about what was captured and never evidence about what the document says`, { target: bundleId }) };
    /* END DEC-49 REGION is-held-document */
    return { bundle: b, sha };
  }

  /** R21 (K2463, K2496): the `{text, ceiling}` extraction R42 checks a quote against, READ FROM THE RECORD and never
   *  from the proposal: the text of the capture's unit containing the place (extraction R36, asked after the caller's
   *  viewer gate, which `unitsOf` does not ask) and the record's own capture ceiling for the document, ROUTE INCLUDED
   *  (`leg-earning`'s earned capture ceiling: the bytes' route, provenance R25/R26, and the transcription's measured
   *  fidelity, at most B). A ceiling that cannot be read is undetermined (null), never B. No unit holds the place: null,
   *  and the quote reads unverified. */
  #quoteTextFor(sha, bundleId) {
    let units = null, ceiling;
    return (source) => {
      if (ceiling === undefined) {
        try {
          const e = this.legEarning.earned(null, [bundleId]);
          const g = e?.earned?.capture?.[bundleId]?.grade;
          ceiling = typeof g === "string" ? g : null;
        } catch { ceiling = null; }
      }
      if (units === null) {
        let held = null;
        try { held = this.extraction ? this.extraction.unitsOf(sha) : null; } catch { held = null; }
        units = Array.isArray(held?.units) ? held.units : [];
      }
      const u = unitContaining(units, source);
      return u ? { text: u.text, ceiling } : null;
    };
  }

  /** op=extractpropose — AN EXTRACT RUN, OR AN EXPLORING RUN FOR ITS STEP (K2502), PROPOSES READINGS (R10, R11, R15)
   *  AND CONNECTIONS (R21). Every proposal is
   *  CHECKED before anything is written, the batch is written in one transaction, and the bound is consumed by what was
   *  ACTUALLY minted. A proposal that says WHERE it read the reference mints that passage through `content` (on the
   *  capture's own chain, so a member's later citation of the same passage finds this row); one with no position mints
   *  nothing. A proposal carrying its `quote` is checked byte-exact against the record's text at its place (extraction
   *  R42, D4); a connection is graded by how its link is established. `step`, when named, is the step the run's work
   *  serves: the capture read and each passage minted are tied to it (steps R9's `recordProduct`). */
  extractPropose({ run, bundleId, fn, version, cap = null, refs, connections = null, step = null, proposedBy,
                   viewer = null, at = null, caller = null }) {
    /* DEC-49 REGION is-extract-run */
    /* FAIL CLOSED ON AN ABSENT STAMP: the control plane stamps the proposer, so a blank means the stamp did not run. */
    if (typeof proposedBy !== "string" || !proposedBy.trim())
      return this.#refuse("NO_PROPOSER",
        `a proposed reading records WHO proposed it. The plane stamps that from the credential that asked, so an `
        + `empty one means the act arrived by a route that does not attribute it — which is refused rather than `
        + `filled in`);
    /* END DEC-49 REGION is-extract-run */
    const held = this.#productionRun({ run, viewer, caller, act: "proposing a reading under a run",
                                      note: "a proposed reading names a run its caller holds. Nothing was proposed or minted" });
    if (held.refusal) return held.refusal;
    const { run: r, runId } = held;
    /* DEC-49 REGION is-extract-door */
    /* R21 (K2502): an exploring run (mode investigate, question-explorer R13) proposes while reading too, but only for
       the step it serves: one naming no step is refused as any other mode is. */
    const mode = String(r.mode || "");
    const named = step !== null && step !== undefined && step !== "";
    if (mode !== EXTRACT_RUN_MODE && !(mode === EXPLORING_RUN_MODE && named))
      return this.#refuse("NOT_AN_EXTRACT_RUN",
        `this run was opened in mode '${r.mode == null ? "(none)" : String(r.mode)}' and a proposed reading is the `
        + `EXTRACT role's production${mode === EXPLORING_RUN_MODE ? `, or an exploring run's for the step it serves, `
          + `and this named no step` : ""}. A run's mode is one of the conditions it was formed under: it is read back, `
        + `never widened by the work`, { run: runId, mode: r.mode ?? null });
    /* THE BOUND, ASKED BEFORE ANY WORK IS DONE (§7.3 (5)). A bound nobody declared is an UNBOUNDED one, so it is a
       refusal here rather than a default allowance invented in code. */
    const bound = this.aiRuns.boundOf(runId, "mints");
    if (!bound || !(Number(bound.allowed) > 0))
      return this.#refuse("NO_MINTS_BOUND",
        `this run declares no 'mints' bound, so its productions would be unbounded — and a machine that may mark `
        + `passages citable without a bound produces a store of proposals nobody cited, each correctly labelled and `
        + `the whole unexamined. The bound is declared at op=airunopen, by the member who opens the run`, { run: runId });
    if (Number(bound.consumed) >= Number(bound.allowed))
      return this.#refuse("MINTS_BOUND_REACHED",
        `this run has reached its 'mints' bound (${Number(bound.consumed)} of ${Number(bound.allowed)}). The next `
        + `tick ends the run, and the log says which bound stopped it and where`,
        { run: runId, allowed: Number(bound.allowed), consumed: Number(bound.consumed) });
    const list = Array.isArray(refs) ? refs : [];
    const links = Array.isArray(connections) ? connections : [];
    if (list.length === 0 && links.length === 0)
      return this.#refuse("NO_PROPOSALS",
        `a proposed reading carries what the machine found. An EMPTY one is not a reading that found nothing — that `
        + `is an observation about a LOOK, and it belongs in the run's log, where absence is first-class and says `
        + `which of the four levels it was`);
    /* END DEC-49 REGION is-extract-door */
    const doc = this.#heldDocument(bundleId, viewer);
    if (doc.refusal) return doc.refusal;
    const { sha } = doc;
    const ctx = this.content.contentContextFor(sha);
    /* THE CHAIN, BUILT ONCE FOR THE BATCH through `appendStep`: its refusal (TEXT_CHAIN_STRENGTHENS, …) comes back
       untouched (extraction R43). */
    const built = proposalChain(ctx.chain, { fn, version, cap });
    if (!built.ok) return built;
    /* DEC-49 REGION is-extract-step */
    /* R21: THE STEP IS TIED OR THE CALL IS REFUSED: a production said to serve a step and tied to none would be a
       claim the record does not hold. Its existence and sight are steps' to answer, inside the write. */
    const stepId = step == null || step === "" ? null : step;
    if (stepId !== null && !isStepId(stepId))
      return this.#refuse("STEP_UNREADABLE",
        `this production names ${typeof stepId === "string" ? `'${stepId.slice(0, 60)}'` : "a step"} as the step it `
        + `serves, and that is not a step's name, so nothing `
        + `was tied to it`, { step: typeof stepId === "string" ? stepId.slice(0, 80) : null });
    /* END DEC-49 REGION is-extract-step */
    const textAt = this.#quoteTextFor(sha, bundleId);
    /* EVERY PROPOSAL CHECKED BEFORE ANYTHING IS WRITTEN, the batch refused WHOLE on the first bad entry, naming its
       ordinal (extraction R42's own refusal): a partly-written batch would spend the bound on work the caller does not
       know it did. A quote is checked against the record's own text at its place (R21's caller duty, K2463). */
    const rows = [];
    for (const [i, e] of list.entries()) {
      const capture = e && typeof e === "object" && typeof e.quote === "string" ? textAt(e.source) : null;
      const bad = checkProposedRef(e, capture);
      if (bad) return { ...bad, at_index: i };
      const graded = proposedReadingGrade(e, capture);
      rows.push({ ref: String(e.ref).trim().slice(0, 400),
                  refKind: e.refKind == null ? null : String(e.refKind).slice(0, 100),
                  refKey: e.refKey == null ? null : String(e.refKey).slice(0, 200),
                  label: e.label == null ? null : String(e.label).slice(0, 400),
                  grade: graded.grade, why: graded.why, pos: e.source == null ? null : readingSource(e.source),
                  quote: typeof e.quote === "string" && e.quote !== "" ? e.quote : null,
                  verified: graded.verified_quote === true, figures: graded.check || [] });
    }
    const linkRows = [];
    if (links.length) {
      const readerRefs = new Set(this.#rows(`SELECT DISTINCT ref FROM reading_refs WHERE capture_sha=?`, sha)
        .map((x) => x.ref));
      const gate = viewerPredicate(viewer);
      for (const [i, c] of links.entries()) {
        const bad = this.#checkConnection(c, i, gate, readerRefs);
        if (bad) return bad;
        const pos = readingSource(c.source);
        const link = connectionLink(c, readerRefs);
        /* THE QUOTE IS CHECKED BY EXTRACTION R42'S ONE BYTE-EXACT RULE, the connection's grounds standing in for what
           the entry names; a quote that is not the capture's text at its place leaves the link UNDETERMINED, stated,
           and never a letter on the machine's say-so. */
        const q = proposedReadingGrade({ ref: "connection", label: link.grounds, quote: c.quote, source: c.source },
                                       textAt(c.source));
        const verified = q.verified_quote === true;
        const linkWhy = { A: localize("run-productions.index.link_source_own", "the source's own link"),
          B: localize("run-productions.index.link_shared_identifier", "an identifier the two share"),
          C: c.how === "date" ? localize("run-productions.index.link_date_alone", "a date alone") : localize("run-productions.index.link_name_alone", "a name alone") };
        const why = verified
          ? word("run-productions.earned_link_rests", { letter: String(link.letter), first: String(linkWhy[link.letter]), grounds: String(String(link.grounds).slice(0, 80)) })
          : localize("run-productions.index.earned_undetermined_quote", "earned undetermined: the quote is not the capture's own text at the place given, so how the link is established cannot be read from the record. A letter would be the machine's say-so");
        linkRows.push({ id: connectionProposalId(runId, sha, c.to_kind, c.to.trim(), c.quote, pos), kind: c.to_kind,
                        to: c.to.trim(), role: c.to_kind === "person" ? String(c.role).trim().slice(0, 200) : null,
                        how: c.how, grounds: String(link.grounds).slice(0, 400), quote: c.quote, pos,
                        verified, figures: verified ? q.check : [], earned: verified ? link.letter : null, why });
      }
    }
    /* DEC-49 REGION is-extract-whole-batch */
    /* AND THE BOUND IS ASKED AGAINST THE SIZE OF THE BATCH: one that would pass the allowance is refused WHOLE and
       never trimmed, since trimming would silently drop proposals the caller believes it filed (D-129). */
    const willMint = rows.filter((x) => x.pos != null).length;
    if (Number(bound.consumed) + willMint > Number(bound.allowed))
      return this.#refuse("MINTS_BOUND_WOULD_EXCEED",
        `this batch would mark ${willMint} passage(s) citable and this run has `
        + `${Number(bound.allowed) - Number(bound.consumed)} left of its 'mints' bound. It is refused whole rather `
        + `than truncated: a batch trimmed to fit would drop proposals the caller believes it filed`,
        { run: runId, allowed: Number(bound.allowed), consumed: Number(bound.consumed), would_mint: willMint });
    /* END DEC-49 REGION is-extract-whole-batch */

    const when = at || new Date(this.now()).toISOString();
    const by = proposedBy.trim();
    const fnVersion = String(version).trim();
    const out = [], outLinks = [];
    let minted = 0;
    const done = this.record.transact(() => {
      const newlyMinted = [];
      for (const x of rows) {
        let contentId = null;
        if (x.pos != null) {
          /* A REFUSED MINT DOES NOT REFUSE THE PROPOSAL: the reading was still read, and "we could not make this
             citable" and "this was never proposed" are different facts. The refusal is carried whole (code, check,
             detail) and never dropped. */
          const m = this.content.mint({ bundleId, captureSha: sha, extent: { kind: x.pos.kind, ...posFields(x.pos) },
                                        mintedBy: by, at: when, context: ctx });
          if (m.ok) { contentId = m.content_id; if (m.minted) { minted += 1; newlyMinted.push(contentId); } }
          else x.mint_refused = { code: m.code || m.reason || null, check: m.check || null, detail: m.detail || null };
        }
        const id = passageProposalId(runId, sha, x.ref);
        this.sql.exec(
          `INSERT INTO proposed_readings
             (run, capture_sha, bundle_id, ref, ref_kind, ref_key, label, fn, fn_version,
              chain, cap, earned, pos_kind, pos, pos_ref, content_id, proposed_by, at,
              id, quote, verified, figures, why, step)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(run, capture_sha, ref) DO NOTHING`,
          runId, sha, bundleId, x.ref, x.refKind, x.refKey, x.label,
          fn, fnVersion, JSON.stringify(built.chain), built.cap, x.grade,
          x.pos ? x.pos.kind : null, x.pos ? readingSourceJson(x.pos) : null, x.pos ? x.pos.ref : null,
          contentId, by, when, id, x.quote, x.verified ? 1 : 0, JSON.stringify(x.figures), x.why, stepId);
        out.push({ id, ref: x.ref, earned: x.grade, earned_because: x.why, content_id: contentId, position: x.pos,
                   quote: x.quote, verified_quote: x.verified, check: x.figures,
                   ...(x.mint_refused ? { mint_refused: x.mint_refused } : {}) });
      }
      /* R21: a connection already proposed under the run for that capture, target, quote and place is left as it was. */
      for (const c of linkRows) {
        this.sql.exec(
          `INSERT INTO proposed_connections (id, run, capture_sha, bundle_id, to_kind, to_id, role, how, grounds, quote,
             pos_kind, pos, pos_ref, verified, figures, earned, why, step, proposed_by, at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
          c.id, runId, sha, bundleId, c.kind, c.to, c.role, c.how, c.grounds, c.quote, c.pos.kind,
          readingSourceJson(c.pos), c.pos.ref, c.verified ? 1 : 0, JSON.stringify(c.figures), c.earned, c.why, stepId,
          by, when);
        outLinks.push({ id: c.id, to_kind: c.kind, to: c.to, role: c.role, how: c.how, grounds: c.grounds,
                        quote: c.quote, position: c.pos, verified_quote: c.verified, check: c.figures,
                        earned: c.earned, earned_because: c.why, says: PROPOSED_CONNECTION_SAYS });
      }
      /* R21: THE STEP THE WORK SERVED (steps R9): the capture read, and each passage this batch made citable. A refusal
         rolls the whole batch back and is relayed as steps answered it. */
      if (stepId !== null)
        for (const record of [{ kind: "capture", id: sha }, ...newlyMinted.map((id) => ({ kind: "content", id }))]) {
          const tied = this.steps.recordProduct({ step: stepId, record, by });
          if (tied && tied.ok === false)
            return { ...tied, ok: false, reason: tied.reason ?? tied.code, code: tied.code ?? tied.reason, step: stepId };
        }
      /* CONSUMED BY WHAT WAS ACTUALLY MINTED, inside the same transaction and only through ai-runs (R18): a batch
         that minted nothing spends nothing. */
      const spent = this.aiRuns.consumeBound(runId, "mints", minted);
      if (spent && spent.ok === false) throw new Error(`run-productions: the mints bound refused ${minted}: ${spent.code}`);
      return { ok: true };
    });
    if (done && done.ok === false) return done;
    const after = this.aiRuns.boundOf(runId, "mints");
    return { ok: true, run: runId, bundle_id: bundleId, capture_sha: sha,
             fn, fn_version: fnVersion, chain: built.chain, cap: built.cap,
             /* THE LABEL IS CONTENT'S OWN SENTENCE (its R16), never composed here. */
             mint: mintLabel(by),
             proposed: out, connections: outLinks, step: stepId, minted,
             bound: after ? { bound: "mints", allowed: Number(after.allowed), consumed: Number(after.consumed) } : null,
             says: EXTRACT_PROPOSALS_SAYS };
  }

  /** R21: one proposed connection, checked; a refusal naming its ordinal, or null. `gate` is the viewer's predicate. */
  #checkConnection(c, i, gate, readerRefs) {
    const at_index = i;
    /* DEC-49 REGION is-extract-connection */
    if (!c || typeof c !== "object" || Array.isArray(c))
      return this.#refuse("CONNECTION_NO_TARGET", `a proposed connection is an object naming what it connects to`, { at_index });
    if (c.grade !== undefined || c.earned !== undefined)
      return this.#refuse("CONNECTION_GRADE_OFFERED",
        `this connection offers its own grade. A connection's grade is COMPOSED from how its link is established and `
        + `never minted by the thing that proposed it (DEC-24 rule 3; AI Roles §3 rule 3)`, { at_index });
    const kind = typeof c.to_kind === "string" ? c.to_kind : "";
    const to = nonBlank(c.to);
    if (!CONNECTION_TARGET_KINDS.includes(kind) || !to)
      return this.#refuse("CONNECTION_NO_TARGET",
        `a proposed connection names what it connects to: to_kind one of ${CONNECTION_TARGET_KINDS.join(", ")}, and to`,
        { at_index, to_kinds: [...CONNECTION_TARGET_KINDS] });
    if (kind === "document" || kind === "question") {
      /* An absent, an invisible and a wrongly typed target answer alike: the viewer's gate is in the statement. */
      const row = this.#one(`SELECT b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, to, ...gate.args);
      if (!row || normalizeType(row.object_type) !== (kind === "document" ? "information" : "inquiry"))
        return this.#refuse("CONNECTION_NO_TARGET", `${to.slice(0, 80)} is not a ${kind} that can be read here`,
                            { at_index, to: to.slice(0, 80) });
    } else if (!ENTITY_ID.test(to))
      return this.#refuse("CONNECTION_NO_TARGET",
        `a ${kind} is named by the record's entity id (ENT-…), and ${to.slice(0, 80)} is not one`, { at_index, to: to.slice(0, 80) });
    if (kind === "person" && !nonBlank(c.role))
      return this.#refuse("CONNECTION_PERSON_NO_ROLE",
        localize("run-productions.index.connection_person_no_role", "a connection to a person is to their part in a public matter (D13), so it names the public role its quote shows"), { at_index });
    if (typeof c.quote !== "string" || c.quote === "" || readingSource(c.source) == null)
      return this.#refuse("CONNECTION_NO_QUOTE",
        `a proposed connection carries its exact quote and the readable place it stands (IC-1's element-reference `
        + `vocabulary)`, { at_index });
    if (!connectionLink(c, readerRefs))
      return this.#refuse("CONNECTION_NOT_ESTABLISHED",
        `how: '${String(c.how ?? "").slice(0, 40)}' does not establish this link: source_link names a reference the `
        + `registered readers found in this capture (ref); shared_identifier names an identifier standing in the quote `
        + `(key); name and date name a name or a date standing in the quote. Nothing else grades a connection, and the `
        + `machine never mints D`, { at_index, hows: Object.keys(CONNECTION_HOW) });
    /* END DEC-49 REGION is-extract-connection */
    return null;
  }

  /** op=extractproposals — WHAT AN EXTRACT RUN PROPOSED, AND THE RATIO (R12; §7.3 (6)). The proposals are listed
   *  because a row nobody lists is a row nobody reviews; the ratio sits beside them because it is the instrument that
   *  catches manufacturing. The ratio is over machine-minted CONTENT rows (content's R45 read contract), not over
   *  proposals: §7.3 asks whether the passages a machine marked citable are ever cited. Its documents are the ones this
   *  scope names that the viewer may see, each asked once, so a document the viewer may not see moves neither the list
   *  nor the ratio (an instrument that moved with them would report their existence). */
  extractProposals({ run = null, bundleId = null, viewer = null, limit = EXTRACT_PROPOSALS_LIMIT_DEFAULT } = {}) {
    const n = Math.max(1, Math.min(EXTRACT_PROPOSALS_LIMIT_MAX, Math.floor(Number(limit)) || EXTRACT_PROPOSALS_LIMIT_DEFAULT));
    const where = [], args = [];
    const runId = run != null && String(run).trim() ? String(run).trim() : null;
    const bundleArm = bundleId != null && String(bundleId).trim() ? String(bundleId).trim() : null;
    if (runId) { where.push("run = ?"); args.push(runId); }
    if (bundleArm) { where.push("bundle_id = ?"); args.push(bundleArm); }
    /* DEC-49 REGION is-extract-scope */
    if (where.length === 0) {
      const row = EXTRACT_PROPOSE_CHECKS.EXTRACT_NO_SCOPE;
      return { ok: false, reason: "EXTRACT_NO_SCOPE", code: "EXTRACT_NO_SCOPE", check: row.check,
               translation: row.translation,
               detail: `this read answers about a RUN or about a DOCUMENT. An unscoped listing of every proposal in the `
                     + `record would be a scan, and a number nobody can act on` };
    }
    /* END DEC-49 REGION is-extract-scope */
    /* THE VIEWER'S GATE IS IN THE STATEMENT (membership's one predicate, over the alias `b`), so a proposal about a
       document the viewer may not see is not a row at all (not a redacted one) and the LIMIT and `truncated` range
       over what the viewer may see. The ratio's documents are read the same way, one past their cap to know it was
       cut. */
    const gate = viewerPredicate(viewer);
    const scoped = where.map((w) => `pr.${w}`).join(" AND ");
    const rows = this.#rows(
      `SELECT pr.run, pr.capture_sha, pr.bundle_id, pr.ref, pr.ref_kind, pr.ref_key, pr.label, pr.fn, pr.fn_version,
              pr.chain, pr.cap, pr.earned, pr.pos_kind, pr.pos, pr.pos_ref, pr.content_id, pr.proposed_by, pr.at,
              pr.id, pr.quote, pr.verified, pr.figures, pr.why, pr.step
         FROM proposed_readings pr JOIN bundles b ON b.bundle_id = pr.bundle_id
        WHERE ${scoped} AND (${gate.sql})
        ORDER BY pr.at DESC, pr.ref ASC
        LIMIT ?`, ...args, ...gate.args, n + 1);
    const docs = this.#rows(
      `SELECT DISTINCT pr.bundle_id FROM proposed_readings pr JOIN bundles b ON b.bundle_id = pr.bundle_id
        WHERE ${scoped} AND (${gate.sql}) ORDER BY pr.bundle_id LIMIT ?`,
      ...args, ...gate.args, EXTRACT_RATIO_DOCUMENTS_MAX + 1).map((x) => x.bundle_id);
    const listed = rows.slice(0, n).map((x) => ({
      id: x.id, run: x.run, bundle_id: x.bundle_id, capture_sha: x.capture_sha,
      ref: x.ref, ref_kind: x.ref_kind, ref_key: x.ref_key, label: x.label,
      basis: { fn: x.fn, version: x.fn_version, chain: safeJson(x.chain), says: describeChain(safeJson(x.chain)) },
      cap: x.cap, earned: x.earned, earned_because: x.why ?? null,
      position: readingSourceFromColumns(x.pos_kind, x.pos, x.pos_ref),
      quote: x.quote ?? null, verified_quote: !!x.verified, check: safeJson(x.figures) ?? [], step: x.step ?? null,
      content_id: x.content_id, mint: mintLabel(x.proposed_by), at: x.at,
      /* On every row, not only the machine ones: a key present in one case makes absence carry the meaning. */
      says: EXTRACT_PROPOSAL_ROW_SAYS,
    }));
    /* R21: the connections proposed in the same scope, through the same gate and the same bound, listed apart: a
       proposed connection is not a reading and not a connection of the record. */
    const linkRows = this.#rows(
      `SELECT pc.* FROM proposed_connections pc JOIN bundles b ON b.bundle_id = pc.bundle_id
        WHERE ${where.map((w) => `pc.${w}`).join(" AND ")} AND (${gate.sql})
        ORDER BY pc.at DESC, pc.id ASC LIMIT ?`, ...args, ...gate.args, n + 1);
    const links = linkRows.slice(0, n).map((x) => ({
      id: x.id, run: x.run, bundle_id: x.bundle_id, capture_sha: x.capture_sha, to_kind: x.to_kind, to: x.to_id,
      role: x.role, how: x.how, grounds: x.grounds, quote: x.quote,
      position: readingSourceFromColumns(x.pos_kind, x.pos, x.pos_ref), verified_quote: !!x.verified,
      check: safeJson(x.figures) ?? [], earned: x.earned, earned_because: x.why, step: x.step,
      mint: mintLabel(x.proposed_by), at: x.at, says: PROPOSED_CONNECTION_SAYS,
    }));
    const scopeDocs = docs.slice(0, EXTRACT_RATIO_DOCUMENTS_MAX);
    const marks = scopeDocs.map(() => "?").join(",");
    const minted = scopeDocs.length ? Number(this.#one(
      `SELECT COUNT(*) AS n FROM content WHERE minted_by LIKE ? AND bundle_id IN (${marks})`,
      `${MACHINE_CLASS_PREFIX}%`, ...scopeDocs)?.n ?? 0) : 0;
    /* CITED IS READ OFF THE LEGS MEMBERS AUTHORED (inquiry R40's `inquiry_basis`, basis-versions R38's version legs):
       this record's own definition of a content row being part of a finding, not a flag anybody sets. */
    const cited = scopeDocs.length ? Number(this.#one(
      `SELECT COUNT(*) AS n FROM content c
        WHERE c.minted_by LIKE ? AND c.bundle_id IN (${marks})
          AND (EXISTS (SELECT 1 FROM inquiry_basis ib WHERE ib.content_id = c.content_id)
            OR EXISTS (SELECT 1 FROM inquiry_basis_version_legs vl WHERE vl.content_id = c.content_id))`,
      `${MACHINE_CLASS_PREFIX}%`, ...scopeDocs)?.n ?? 0) : 0;
    return { ok: true, scope: { run: runId, bundle_id: bundleArm,
                                /* WHAT THE RATIO IS OVER, published: a fraction whose denominator a reader cannot see
                                   is a fraction they cannot judge. */
                                documents: scopeDocs.length, documents_capped: docs.length > EXTRACT_RATIO_DOCUMENTS_MAX },
             count: listed.length, limit: n, truncated: rows.length > n, proposals: listed,
             connections: links, connections_truncated: linkRows.length > n,
             instrument: mintRatio({ minted, cited }) };
  }

  /* ==================================================================== *
   * T41-24 — READING INSIDE A HELD DOCUMENT (R21–R24; Investigation §5; AI Roles §3 rules 3, 9; D2, D3, D4, D22).
   * ==================================================================== */

  /** op=readpages — R24: A RUN READS A HELD DOCUMENT A FEW PAGES AT A TIME, WITHIN ITS `pages` BOUND (run-rules R26),
   *  read and spent through ai-runs as `mints` is (R18). A page is charged once per run: one read again costs nothing.
   *  A slice the bound cuts says so and says how far the run read; a run whose bound is spent is refused, saying how
   *  far it read in this document. The text is the record's own (extraction R36's units), asked after the viewer's
   *  gate. A document under a "no AI" material limit is refused whatever the bound (ai-accounts R21, R22). */
  readPages({ run, bundleId, from = 0, viewer = null, caller = null, at = null } = {}) {
    const held = this.#productionRun({ run, viewer, caller, act: "reading a document under a run",
                                      note: "a reading names a run its caller holds. Nothing was read" });
    if (held.refusal) return held.refusal;
    const { run: r, runId } = held;
    /* DEC-49 REGION is-read-run */
    if (!READING_RUN_MODES.includes(String(r.mode || "")))
      return this.#refuse("NOT_A_READING_RUN",
        localize("run-productions.index.this_run_was_opened_in", "this run was opened in mode '{v1}', and only a run in mode {READING_RUN_MODES} reads inside documents (run-rules R26)", { v1: String(r.mode == null ? "(none)" : String(r.mode)), READING_RUN_MODES: String(READING_RUN_MODES.join(" or ")) }), { run: runId, mode: r.mode ?? null });
    /* END DEC-49 REGION is-read-run */
    const doc = this.#heldDocument(bundleId, viewer);
    if (doc.refusal) return doc.refusal;
    const { bundle, sha } = doc;
    /* "NO AI" IS ASKED BEFORE THE BOUND, so a document kept from the AI is refused however much the run may read. The
       refusal is run-rules', relayed whole. */
    /* THE JUDGEMENT IS run-rules' (`checkPagesRead`, R26; B3): the material limits held for this document, the group's
       (ai-accounts R21 `aiKeepAwayState`) and its project's (its R22 `projectsKeptAway`), each read here; one that
       cannot be read, or a read that throws, is held as on, so the read fails closed. */
    const limits = [];
    try { const g = this.aiAccounts.aiKeepAwayState(); limits.push({ on: g.on, uses: g.uses }); }
    catch { limits.push({ on: null, uses: null }); }
    if (bundle.project) {
      let kept = null;
      try { kept = this.aiAccounts.projectsKeptAway({ use: "read" }); } catch { kept = null; }
      if (!Array.isArray(kept)) limits.push({ on: null, uses: null });
      else if (kept.includes(bundle.project)) limits.push({ on: true, uses: ["read"] });
    }
    const noAi = checkPagesRead({ limits });
    if (noAi) return { ...noAi, run: runId, bundle_id: bundleId };
    let units = [], state = null;
    try {
      const u = this.extraction ? this.extraction.unitsOf(sha) : null;
      units = Array.isArray(u?.units) ? u.units : [];
      state = u?.state ?? null;
    } catch { units = []; state = null; }
    const pages = pagesOf(units);
    const already = new Set(this.#rows(`SELECT page FROM run_pages_read WHERE run=? AND capture_sha=?`, runId, sha)
      .map((x) => Number(x.page)));
    const howFar = () => (already.size ? Math.max(...already) + 1 : 0);
    /* DEC-49 REGION is-read-door */
    const bound = this.aiRuns.boundOf(runId, PAGES_BOUND);
    if (!bound || !(Number(bound.allowed) > 0))
      return this.#refuse("NO_PAGES_BOUND",
        `this run declares no 'pages' bound, so its reading would be unbounded. The bound is declared at op=airunopen, `
        + `by the member who opens the run (run-rules R26)`, { run: runId });
    if (Number(bound.consumed) >= Number(bound.allowed))
      return this.#refuse("PAGES_BOUND_REACHED",
        `this run has read ${Number(bound.consumed)} of its ${Number(bound.allowed)} pages. In ${bundleId} it read `
        + `${already.size} page(s), as far as page ${howFar()} of ${pages.length}`,
        { run: runId, bundle_id: bundleId, allowed: Number(bound.allowed), consumed: Number(bound.consumed),
          read_to: howFar(), pages_read: already.size, page_count: pages.length });
    /* END DEC-49 REGION is-read-door */
    const start = Math.max(0, Math.floor(Number(from)) || 0);
    let left = Number(bound.allowed) - Number(bound.consumed);
    const slice = [], fresh = [];
    let stopped = null;
    for (const p of pages.slice(start, start + READ_PAGES_AT_A_TIME)) {
      const charged = !already.has(p.page);
      if (charged && left <= 0) { stopped = "pages"; break; }
      if (charged) { left -= 1; fresh.push(p.page); }
      slice.push({ ...p, charged });
    }
    const when = at || stampInstant("second", this.now());
    const done = this.record.transact(() => {
      for (const page of fresh)
        this.sql.exec(`INSERT OR IGNORE INTO run_pages_read (run, capture_sha, bundle_id, page, at) VALUES (?,?,?,?,?)`,
                      runId, sha, bundleId, page, when);
      const spent = this.aiRuns.consumeBound(runId, PAGES_BOUND, fresh.length);
      if (spent && spent.ok === false) return { ...spent, ok: false, run: runId };
      return { ok: true };
    });
    if (done && done.ok === false) return done;
    for (const page of fresh) already.add(page);
    const after = this.aiRuns.boundOf(runId, PAGES_BOUND);
    const readTo = start + slice.length;
    return { ok: true, run: runId, bundle_id: bundleId, capture_sha: sha, from: start,
             pages: slice, read_to: Math.min(readTo, pages.length), page_count: pages.length, index_state: state,
             next_from: readTo < pages.length ? readTo : null, stopped, charged: fresh.length,
             read_in_run: { pages: already.size, as_far_as: howFar() },
             bound: after ? { bound: "pages", allowed: Number(after.allowed), consumed: Number(after.consumed) } : null,
             says: stopped
               ? word("run-productions.says.run_stopped_pages", { read_pages_says: String(READ_PAGES_SAYS), read_to: String(Math.min(readTo, pages.length)), pages: String(pages.length) })
               : READ_PAGES_SAYS };
  }

  /** A proposal by its name, through the viewer's gate on the document it was read from: `{kind, row}` or null. */
  #proposalSeen(id, viewer) {
    const gate = viewerPredicate(viewer);
    const kind = id.startsWith("prp:") ? "passage" : id.startsWith("prc:") ? "connection" : null;
    if (!kind) return null;
    const row = this.#one(
      `SELECT p.* FROM ${kind === "passage" ? "proposed_readings" : "proposed_connections"} p
         JOIN bundles b ON b.bundle_id = p.bundle_id WHERE p.id=? AND (${gate.sql})`, id, ...gate.args);
    return row ? { kind, row } : null;
  }

  /** op=proposalaccept — R22: THE MEMBER'S ONE ACT ON A PROPOSED PASSAGE OR CONNECTION (record-grammar R52, D3): as
   *  proposed (its meaning recorded as proposed), edited (her meaning, in her words), or her own instead (her own
   *  reading, the machine's set aside). One per member per proposal; only then may a leg cite it as hers
   *  (`acceptedFor`). `by` and `viewer` are the control plane's stamps. Who may: a member who may see the document
   *  and the run's context, and, for a run over a project, a joined participant of it (membership R55). */
  proposalAccept({ proposal, form, edit = null, by, viewer = null, at = null } = {}) {
    const who = nonBlank(by);
    const id = nonBlank(proposal) ?? "";
    /* DEC-49 REGION is-accept */
    if (!who || isMachineIdentity(who))
      return this.#refuse("ACCEPT_NOT_A_MEMBER",
        localize("run-productions.index.accepting_a_proposal_is_a", "accepting a proposal is a member's act (record-grammar R52); {v1} asked", { v1: String(who ? "a machine" : "no one") }));
    const seen = this.#proposalSeen(id, viewer ?? who);
    const runRow = seen ? this.aiRuns.runFor(seen.row.run, viewer ?? who) : null;
    if (!seen || !runRow)
      return this.#refuse("READING_PROPOSAL_ABSENT", `no proposal you can see is named ${id.slice(0, 80) || "(none)"}`,
                          { proposal: id.slice(0, 80) || null });
    if (!ACCEPTANCE_FORMS.includes(form))
      return this.#refuse("ACCEPT_FORM_UNKNOWN",
        `form is one of ${ACCEPTANCE_FORMS.join(", ")}`, { forms: [...ACCEPTANCE_FORMS] });
    const words = typeof edit === "string" ? edit.trim() : "";
    if (form === "as_proposed" && edit !== null && edit !== undefined && words !== "")
      return this.#refuse("ACCEPT_AS_PROPOSED_TAKES_NO_WORDS",
        `as_proposed records the proposal's meaning as proposed; words of her own are edited or own_instead`);
    if (form !== "as_proposed" && (words === "" || words.length > ACCEPT_WORDS_MAX))
      return this.#refuse("ACCEPT_NEEDS_HER_WORDS",
        `${form} records her own words of what it means: 1 to ${ACCEPT_WORDS_MAX} characters`, { limit: ACCEPT_WORDS_MAX });
    if (this.#one(`SELECT 1 AS x FROM proposal_acceptances WHERE proposal=? AND accepted_by=?`, id, who))
      return this.#refuse("PROPOSAL_ALREADY_ACCEPTED", `${who} has already taken up ${id.slice(0, 80)}`, { proposal: id });
    /* END DEC-49 REGION is-accept */
    /* R55's fence, relayed whole: work on a project's proposal is a joined participant's. */
    if (String(runRow.context_type) === "project") {
      const fence = this.membership.projectAuthority(String(runRow.context_id), who, "joined", "accepting a proposal");
      if (fence) return fence;
    }
    const when = at || stampInstant("second", this.now());
    const record = acceptanceRecord({ proposal: id, form, by: who, at: when, kind: seen.kind });
    const r = seen.row;
    const meaning = form === "as_proposed"
      ? (seen.kind === "passage"
          ? `${r.label || r.ref}${r.quote ? `: "${r.quote}"` : ""}`
          : localize("run-productions.index.to_kind_to_id_v1", "{to_kind} {to_id}{v1}, by {how} ({grounds}): \"{quote}\"", { to_kind: String(r.to_kind), to_id: String(r.to_id), v1: String(r.role ? ` (${r.role})` : ""), how: String(r.how), grounds: String(r.grounds), quote: String(r.quote) }))
      : words;
    const meaningOf = form === "as_proposed" ? "proposal" : "member";
    this.sql.exec(
      `INSERT INTO proposal_acceptances (proposal, kind, bundle_id, form, accepted_by, at, meaning, meaning_of)
       VALUES (?,?,?,?,?,?,?,?)`, id, seen.kind, r.bundle_id, form, who, when, meaning, meaningOf);
    return { ok: true, acceptance: record, meaning, meaning_of: meaningOf,
             ...(seen.kind === "passage" ? { content_id: r.content_id ?? null } : { to_kind: r.to_kind, to: r.to_id }),
             set_aside: form === "own_instead",
             says: form === "own_instead"
               ? word("run-productions.says.machine_reading_set")
               : word("run-productions.says.taken_she_cite") };
  }

  /** R22: whether a member has taken up a proposal (by its name) or the machine-proposed passage a content row is
   *  (by its id), so a leg may cite it as hers: `{accepted, form, at}`, `accepted` false and the rest null otherwise. */
  acceptedFor({ proposal = null, content_id = null, by } = {}) {
    const who = nonBlank(by);
    const row = !who ? null
      : nonBlank(proposal) ? this.#one(`SELECT form, at FROM proposal_acceptances WHERE proposal=? AND accepted_by=?`,
                                       proposal.trim(), who)
      : nonBlank(content_id) ? this.#one(
          `SELECT pa.form, pa.at FROM proposal_acceptances pa JOIN proposed_readings pr ON pr.id = pa.proposal
            WHERE pr.content_id=? AND pa.accepted_by=? ORDER BY pa.at LIMIT 1`, content_id.trim(), who)
      : null;
    return row ? { accepted: true, form: row.form, at: row.at } : { accepted: false, form: null, at: null };
  }

  /** R22 (D3): how often each kind of proposal was taken up in each form, group-wide only, naming no member, project
   *  or proposal. */
  acceptanceCounts() {
    const out = {};
    for (const kind of ["passage", "connection"]) out[kind] = Object.fromEntries(ACCEPTANCE_FORMS.map((f) => [f, 0]));
    for (const r of this.#rows(`SELECT kind, form, COUNT(*) AS n FROM proposal_acceptances GROUP BY kind, form`))
      if (out[r.kind] && r.form in out[r.kind]) out[r.kind][r.form] = Number(r.n);
    return { ok: true, scope: "group", counts: out };
  }

  /** R25 (T42; N834; K2496, K31): THE READ REGISTERED WITH `inquiry.onMachinePassage` (its R62) AND
   *  `basis-versions.onMachinePassage` (its R49): may each of these legs stand as `author`'s? A leg whose content row
   *  is one a run proposed (R11) — the row it names (`content_id`), or the row its part resolves to (its document, the
   *  capture it names or the one presented now, and its extent) — stands only when `acceptedFor` (R22) says `author`
   *  herself took that proposal up; any other such leg is refused, each named with its proposals and R22's act as the
   *  remedy. A leg resting on nothing a run proposed stands. Answers null or the refusal. An acceptance that cannot be
   *  read refuses the leg (fail closed); a read that fails whole refuses every leg it was given. Synchronous, writes
   *  nothing, never throws. */
  machinePassage(a = {}) {
    const { legs, author } = a && typeof a === "object" ? a : {};
    const list = Array.isArray(legs) ? legs : [];
    const who = nonBlank(author);
    const refused = [];
    for (const [i, leg] of list.entries()) {
      const ord = leg && Number.isInteger(leg.ord) ? leg.ord : i;
      const target = leg && typeof leg.target === "string" ? leg.target : null;
      let contentIds = [], proposals = [];
      try {
        const named = legContentId(leg);
        if (named) contentIds = [named];
        else if (target && normalizeType(OBJECT_TYPES[target.split("-")[0]]) === "information") {
          const capture = this.content.captureFor(target,
            typeof leg.extent_capture === "string" && leg.extent_capture ? leg.extent_capture : null);
          if (capture)
            contentIds = this.#rows(`SELECT content_id FROM content WHERE bundle_id=? AND capture_sha=? AND extent=?`,
                                    target, capture, canonicalExtent(citationExtent(leg))).map((r) => r.content_id);
        }
        if (contentIds.length)
          proposals = this.#rows(
            `SELECT id, content_id FROM proposed_readings WHERE content_id IN (SELECT value FROM json_each(?)) ORDER BY id`,
            JSON.stringify(contentIds));
      } catch {
        refused.push({ ord, target, content_id: null, proposals: [], unread: true });
        continue;
      }
      if (!proposals.length) continue;
      let taken = false, unread = false;
      for (const pr of proposals) {
        try { if (who && this.acceptedFor({ proposal: pr.id, by: who }).accepted === true) { taken = true; break; } }
        catch { unread = true; }
      }
      if (!taken)
        refused.push({ ord, target, content_id: proposals[0].content_id, proposals: proposals.map((x) => x.id),
                       ...(unread ? { unread: true } : {}) });
    }
    if (!refused.length) return null;
    const UNREAD = " (the acceptance could not be read)";
    /* DEC-49 REGION is-machine-passage */
    return this.#refuse("PROPOSAL_NOT_TAKEN_UP",
      `${refused.length} leg(s) cite as ${who || "no one"}'s a passage a machine proposed that ${who || "no one"} has not `
      + `taken up: ${refused.map((r) => `leg ${r.ord} on ${r.target ?? "(none)"}${r.unread ? UNREAD : ""}`).join("; ")}. `
      + `A machine's passage is cited as a member's only once she takes it up `
      + `(op=proposalaccept: as proposed, edited, or her own instead)`,
      { legs: refused, author: who, remedy: "op=proposalaccept" });
    /* END DEC-49 REGION is-machine-passage */
  }

  /** op=bearingnote — R23 (D22): A NOTE ON WHAT A DOCUMENT SAYS ABOUT A QUESTION, AND WHAT IT DOES NOT, written by a run
   *  its caller holds (R15), or, drafted interactively with no run (run-rules R25; K2482), by the member who asked, who
   *  may see both the document and the question. Each sentence `{text, quote, source}` is kept only when its quote passes extraction R42's
   *  byte-exact check against the record's text at its place, as R21 hands it; a sentence that cannot be tied is left
   *  out and said so. It is stored apart (never a content row, never a proposal, with no id a leg accepts) and read
   *  only beside its source (`bearingNotes`). */
  bearingNote({ capture, question, run = null, sentences, viewer = null, caller = null, at = null } = {}) {
    const held = this.#productionRun({ run, viewer, caller, act: "writing a note on a document under a run",
                                      note: "a note names a run its caller holds. Nothing was kept", memberMay: true });
    if (held.refusal) return held.refusal;
    const { runId } = held;
    const gate = viewerPredicate(viewer);
    const qid = nonBlank(question) ?? "";
    const sha = typeof capture === "string" ? capture.trim() : "";
    const list = Array.isArray(sentences) ? sentences : [];
    /* DEC-49 REGION is-bearing */
    const q = qid ? this.#one(`SELECT b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, qid, ...gate.args)
                  : null;
    if (!q || normalizeType(q.object_type) !== "inquiry")
      return this.#refuse("BEARING_NO_QUESTION", `no question you can see is named ${qid.slice(0, 80) || "(none)"}`,
                          { question: qid.slice(0, 80) || null });
    const read = HEX64.test(sha) ? this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, sha) : null;
    const doc = read ? this.#one(`SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
                                 read.bundle_id, ...gate.args) : null;
    if (!doc || normalizeType(doc.object_type) !== "information" || this.content.captureFor(doc.bundle_id, sha) !== sha)
      return this.#refuse("BEARING_NO_CAPTURE",
        `no capture you can see of a document this record holds is ${sha ? sha.slice(0, 64) : "(none)"}`,
        { capture: sha.slice(0, 64) || null });
    if (list.length === 0 || list.length > BEARING_SENTENCES_MAX)
      return this.#refuse("BEARING_NO_SENTENCES",
        `a note holds 1 to ${BEARING_SENTENCES_MAX} sentences, each {text, quote, source}; this held ${list.length}`,
        { limit: BEARING_SENTENCES_MAX });
    const textAt = this.#quoteTextFor(sha, doc.bundle_id);
    const kept = [], leftOut = [];
    for (const [i, s] of list.entries()) {
      const text = s && typeof s.text === "string" ? s.text.trim() : "";
      if (!text || text.length > BEARING_SENTENCE_MAX_CHARS) {
        leftOut.push({ index: i, why: word("run-productions.why.sentence_characters", { bearing_sentence_max_chars: String(BEARING_SENTENCE_MAX_CHARS) }) }); continue;
      }
      const v = proposedReadingGrade({ ref: "bearing", label: text, quote: s.quote, source: s.source },
                                     typeof s.quote === "string" ? textAt(s.source) : null);
      if (v.verified_quote !== true) {
        leftOut.push({ index: i, why: word("run-productions.why.quote_document_words") }); continue;
      }
      kept.push({ text, quote: s.quote, position: readingSource(s.source), check: v.check });
    }
    if (kept.length === 0)
      return this.#refuse("BEARING_NOTHING_TIED",
        `none of the ${list.length} sentence(s) could be tied to the document's own words`, { left_out: leftOut });
    /* END DEC-49 REGION is-bearing */
    const when = at || stampInstant("second", this.now());
    const id = `brn:${sha256HexSync(canonicalJson(["bearing", runId, sha, qid, kept]))}`;
    this.sql.exec(
      `INSERT INTO bearing_notes (id, capture_sha, bundle_id, question, run, sentences, left_out, written_by, at)
       VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      id, sha, doc.bundle_id, qid, runId, JSON.stringify(kept), leftOut.length, String(caller ?? "").trim(), when);
    return { ok: true, note: { id, capture_sha: sha, bundle_id: doc.bundle_id, question: qid, run: runId,
                               sentences: kept, at: when },
             kept: kept.length, left_out: leftOut, says: BEARING_NOTE_SAYS };
  }

  /** op=bearingnotes — R23: the notes on a document, read beside it: newest first, at most 100, each about a question
   *  the viewer may see (the rest left out, uncounted), the document itself through the viewer's gate. */
  bearingNotes({ bundleId, question = null, viewer = null } = {}) {
    const gate = viewerPredicate(viewer);
    const id = nonBlank(bundleId) ?? "";
    const doc = id ? this.#one(`SELECT b.bundle_id FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args)
                   : null;
    if (!doc) return { ok: false, reason: "NO_SUCH_BUNDLE", code: "NO_SUCH_BUNDLE", target: id || null,
                       detail: `no document is addressed by ${id || "(none)"} in this record` };
    const q = nonBlank(question);
    const rows = this.#rows(
      `SELECT n.* FROM bearing_notes n JOIN bundles b ON b.bundle_id = n.question
        WHERE n.bundle_id=? ${q ? "AND n.question=?" : ""} AND (${gate.sql})
        ORDER BY n.at DESC, n.id ASC LIMIT 101`, id, ...(q ? [q] : []), ...gate.args);
    return { ok: true, bundle_id: id, truncated: rows.length > 100,
             notes: rows.slice(0, 100).map((n) => ({ id: n.id, capture_sha: n.capture_sha, question: n.question, run: n.run,
                                                     sentences: safeJson(n.sentences) ?? [], left_out: n.left_out,
                                                     mint: mintLabel(n.written_by), at: n.at, says: BEARING_NOTE_SAYS })) };
  }

  /** R14 — THE NARROW CANDIDATE SOURCE, registered with basis-versions (its R25, R40 `onCandidates`): for a capture,
   *  the proposals with a position, newest first, at most `max` of them, read one past it so `truncated` is measured,
   *  each labelled machine work (content's mint label beside the proposer stamp). */
  candidates({ captureSha, max } = {}) {
    const cap = Math.max(1, Math.floor(Number(max)) || 1);
    const rows = this.#rows(
      `SELECT run, ref, label, pos_kind, pos, pos_ref, content_id, proposed_by FROM proposed_readings
        WHERE capture_sha=? AND pos_kind IS NOT NULL ORDER BY at DESC, ref LIMIT ?`, String(captureSha ?? ""), cap + 1);
    return { truncated: rows.length > cap,
             rows: rows.slice(0, cap).map((r) => ({
               run: r.run, ref: r.ref, label: r.label ?? null,
               position: readingSourceFromColumns(r.pos_kind, r.pos, r.pos_ref),
               content_id: r.content_id ?? null, proposed_by: r.proposed_by, mint: mintLabel(r.proposed_by) })) };
  }

  /** R20 (K861, plane R10): this module's figure source, exported with its key list; `plane` registers it under this
   *  module's name through record-core R63 (`src/plane/stats.mjs`: `["run-productions", RunProductions.COUNT_KEYS,
   *  (ctx, hid) => runProductionsOf(ctx).counts(hid)]`), and the module registers nothing itself. Each figure is the
   *  table's rows less those naming a bundle in `hid` by the column named here: a proposal by its document, a stored
   *  refusal by its question. */
  static COUNT_KEYS = Object.freeze(["proposedReadings", "suggestRefusals"]);
  static #COUNTED = Object.freeze({ proposedReadings: ["proposed_readings", "bundle_id"],
                                    suggestRefusals: ["suggest_refusals", "target"] });

  /** R20, R17, D-464 (A COUNT IS TAKEN THROUGH THE CALLER'S OWN SIGHT): R63's `counts(hid)` for this module's tables,
   *  answering exactly `COUNT_KEYS`. `hid` is membership's `hiddenBundles` (`{sql, args}`), or null for a viewer that
   *  sees every bundle and for the direct internal call (purge's proof), which count whole. `COALESCE(k, '')`: a NULL
   *  key names no bundle, and `NULL NOT IN (…)` is NULL, which would drop the row. A figure whose table cannot be read
   *  is left out, and R63 answers it null, never zero. Synchronous; writes nothing; never throws. */
  counts(hid = null) {
    const out = {};
    for (const key of RunProductions.COUNT_KEYS) {
      const [table, col] = RunProductions.#COUNTED[key];
      try {
        out[key] = Number(this.#one(`SELECT count(*) c FROM ${table}${hid ? ` WHERE COALESCE(${col}, '') NOT IN ${hid.sql}` : ""}`,
                                    ...(hid ? hid.args : [])).c);
      } catch { /* unread: R63 answers it null, never zero */ }
    }
    return out;
  }
}

const instances = new WeakMap();

/** The one run-productions instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on the
 *  first call only; a provider not given is reached through its factory. At creation it declares its tables to purge
 *  (R17). */
export function runProductionsOf(host, deps) {
  let p = instances.get(host);
  if (!p) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const content = d.content || contentOf(host);
    const connections = d.connections || connectionsOf(host);
    p = new RunProductions({ storage: d.storage || host.storage, record, membership, content, connections,
                             aiRuns: d.aiRuns || aiRunsOf(host), strength: d.strength || strengthOf(host, { record, membership }),
                             citation: d.citation || citationOf(host, { record, membership, content }),
                             basisVersions: d.basisVersions || basisVersionsOf(host, { record, membership, content }),
                             extraction: d.extraction || extractionOf(host, { record, membership }),
                             /* T41-24: R24's "no AI" read is this module's (K2482), its limits ai-accounts' (T48,
                                N996 §5; credentials' factory makes that instance first, with its seal secret, R32);
                                R21's step is steps' (B4). */
                             aiAccounts: d.aiAccounts || aiAccountsOf(host, { record, membership }),
                             steps: d.steps || stepsOf(host, { record, membership }),
                             legEarning: d.legEarning || legEarningOf(host, { record, membership, content }),
                             now: d.now || null });
    instances.set(host, p);
    record.declarePurge(RUN_PRODUCTIONS_MODULE, RUN_PRODUCTIONS_TABLES);
    /* R14: the extract arm of basis-versions' narrow candidates (its R40). */
    p.basisVersions.onCandidates(RUN_PRODUCTIONS_MODULE, (a) => p.candidates(a));
    /* R25 (T42; N834): the one read of inquiry's R62 and basis-versions' R49 slots, `onMachinePassage`. */
    const inquiry = d.inquiry || inquiryOf(host, { record, membership, content });
    for (const slot of [inquiry, p.basisVersions]) slot.onMachinePassage(RUN_PRODUCTIONS_MODULE, (a) => p.machinePassage(a));
  }
  return p;
}

/** The op handlers the control plane routes to (K3): `suggest`, `extractpropose`, `extractproposals`, and since T41-24
 *  `readpages`, `proposalaccept`, `acceptancecounts`, `bearingnote`, `bearingnotes`. The author, viewer, proposer, `by`
 *  and caller come from the QUERY STRING, where the control plane stamped them, and never from the body
 *  (R8): `suggest`'s stamps are set AFTER the body's spread, so a body's are overwritten rather than believed. */
export function runProductionsOps(p, url, body) {
  const q = (k) => url.searchParams.get(k);
  const bd = body || {};
  return {
    suggest: () => p.suggest({
      ...bd,
      target: bd.target || q("target"), kind: bd.kind || q("kind"), run: bd.run || q("run"),
      author: q("author"), viewer: q("viewer"), caller: q("principal"),
    }),
    extractpropose: () => p.extractPropose({
      run: bd.run, bundleId: bd.bundleId, fn: bd.fn, version: bd.version, cap: bd.cap ?? null, refs: bd.refs,
      connections: bd.connections ?? null, step: bd.step ?? null,
      at: bd.at || null, proposedBy: q("proposedBy"), viewer: q("viewer"), caller: q("principal") }),
    extractproposals: () => p.extractProposals({ run: q("run"), bundleId: q("bundle"), limit: q("limit"), viewer: q("viewer") }),
    /* T41-24 (R21–R24). */
    readpages: () => p.readPages({ run: bd.run ?? q("run"), bundleId: bd.bundleId ?? q("bundle"), from: bd.from ?? q("from"),
                                   viewer: q("viewer"), caller: q("principal") }),
    proposalaccept: () => p.proposalAccept({ proposal: bd.proposal, form: bd.form, edit: bd.edit ?? null,
                                             by: q("by"), viewer: q("viewer") }),
    acceptancecounts: () => p.acceptanceCounts(),
    bearingnote: () => p.bearingNote({ capture: bd.capture, question: bd.question, run: bd.run, sentences: bd.sentences,
                                       viewer: q("viewer"), caller: q("principal") }),
    bearingnotes: () => p.bearingNotes({ bundleId: q("bundle"), question: q("question"), viewer: q("viewer") }),
  };
}

/** The op declarations (op-declarations R80, op-grades R49), beside the ops map and held true by declared-ops.test.mjs
 *  (R27). `classes`, `mutating` and `weight` agree with the hand rows that still hold `suggest`, and `description` is the
 *  sentence op-grades' non-act row holds, so registration finds no disagreement. `requires` names only what a refusal
 *  names: `name` is not one, because basis-versions' BASIS_VERSION_REFUSED, relayed unchanged (R3), names no field. */
export const DECLARED_OPS = Object.freeze({
  suggest: {
    classes: ["admin", "member", "probe"], mutating: true, weight: "reversible",
    description: localize("run-productions.declared.suggest", "the investigative session's ONE write (§4 group 2), keyed by inquiry and run: proposes a reading of the evidence in state suggested. Not object-directed — no member takes it; the six acts ON the proposal are the member-facing ones and they are ACTS rows"),
    fields: { accepts: ["target", "kind", "run", "name", "description", "claim", "relationship", "derived_from", "level", "observed_at", "grounds", "legs", "idem", "produced_by"],
              requires: ["target", "kind", "run", "description"] },
  },
});
