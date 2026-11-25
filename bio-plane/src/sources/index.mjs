/* sources — the person behind material given to the group (requirements: `build/requirements/sources.md`; Intake
 * Doctrine §2a, DEC-78 items 2, 3 and 5; Bob's K509 (1), (4), (5); T33-22: K1449, K1492 (3)). A source is the knocker who handed material over,
 * and later whoever is revealed behind them, held as a dated, attributed history of disclosures, never one overwritten
 * field. It also answers what of a source may be published, and to whom, and how far the source is known (the ladder).
 * And it holds the mark that a capture is a result a member reached on their own paid account (a member-keyed outside
 * source, R16–R18): cited at a lower grade, never reproducible by the public, marked one capture at a time by the
 * member who captured it, never in bulk and never unattended.
 *
 * A new module (K509 (1), N364): nothing moves. Its tables (`./schema.mjs`) are append-only and exempt from purge
 * (R13), each declared with its classes (R19). Its rows are its own family, C-121 (`./checks.mjs`, R14).
 *
 * WHERE A SOURCE COMES FROM (R1). `doorbell` is earlier in the order and cannot call this module, so a source is
 * derived at read from the knocks the doorbell pulled into a capture (its R18, R13, R14) and minted on first read and
 * kept: one per pseudonym, one per knock sent without a secret. A pulled knock's bytes are filed under their own digest
 * (doorbell R13), so the capture's digest is the knock's `sha256`; the capture's own `source` is rebuilt from the row
 * exactly as doorbell R13 composes it. A capture that is not a pulled knock has no source here: the capturing member is never
 * recorded as the source of what someone else gave them (R12).
 *
 * WHO SEES WHAT. A source is seen by a viewer naming a member (the inbox's fence, doorbell R3); a machine credential
 * or no viewer is answered `NO_SUCH_SOURCE`. A stored value is read only by the members its entry lists (R5), each
 * read logged. `by` and `viewer` are the control plane's stamps, never a body's.
 *
 * REACHED as `sourcesOf(ctx, deps)` (K61): one instance per Durable Object storage, created on the first call with
 * `deps` and returned to every later caller. At creation it creates its tables and declares them to purge, every one
 * exempt (R13). `deps`:
 *   record, membership, doorbell, provenance  the modules it uses, through their factories on the same storage unless
 *                                 a test passes its own (`doorbell` and `provenance` are reached lazily, on first use).
 *   now                           the module's clock, milliseconds since the epoch (default: the wall clock).
 *
 * THE OPS (routed and stamped by `control-plane`, layer 11; `sourcesOps` below): `sourcedisclose` (R2–R5),
 * `sourcelink` (R6), `sourceconsent` and `sourceconsentwithdraw` (R7), `knockerconsent` (R11, no account), `sourcekeyed`
 * (R16; `keyedResultOf`, R17, is read in process by the modules that grade a fact citing a capture), and the
 * reads `sourceof` (R1), `sourcerung` (R9), `sourcereadlog` (R5) and `sourcepublishable` (R8, at this module's own
 * instant: a request names none). `sourceChangesSince` (R20) is read in process by `case-carriage` and has no route. */

import { isMachineIdentity, BASIS_GRADES, TESTIMONY_GRADE } from "../record-grammar/index.mjs";
import { recordOf, stampInstant, instantOrder, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, listenerRefusal } from "../membership/index.mjs";
import { doorbellOf } from "../doorbell/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { SOURCES_CHECKS, noSuchSource, badDisclosure, noEvidence, noSightList, consentNotStanding,
         SECRET_NOT_RECOGNISED_ANSWER, machineCannotMark, notYourCapture, noSuchCapture, noService } from "./checks.mjs";
import { SOURCES_TABLE_CLASSES, migrateSources } from "./schema.mjs";
import { word } from "../setup-words/index.mjs";
import { localize } from "../setup-words/index.mjs";

export { SOURCES_CHECKS, SECRET_NOT_RECOGNISED_ANSWER } from "./checks.mjs";
export { SOURCES_SCHEMA, SOURCES_TABLES, SOURCES_TABLE_CLASSES } from "./schema.mjs";

/** R2: the vocabularies. An audience is ordered lowest to highest. */
export const KINDS = Object.freeze(["pseudonym_link", "attribute", "name"]);
export const ATTRIBUTES = Object.freeze(["occupation", "employer", "role"]);
export const HOWS = Object.freeze(["self", "filing", "third_party", "hostile"]);
export const AUDIENCES = Object.freeze(["member", "group", "public"]);
/** R9: the ladder, lowest first. */
export const RUNGS = Object.freeze(["unknown", "same_knocker", "partly_known", "known_to_group", "publicly_known"]);
/** R6: a link's basis, strongest first. */
export const LINK_BASES = Object.freeze(["same_secret", "evidence"]);
/** R11: a presented secret shorter than this is never recognised (doorbell R14's floor, K497). */
export const SECRET_MIN = 20;
/** Bounds on what a member writes: a value, an exposer's name, a statement of evidence, a citation. */
export const VALUE_MAX = 400, CLAIMED_BY_MAX = 200, EVIDENCE_MAX = 2000;
/** R16: bounds on a mark: the vendor's name, and its terms as the member states them. */
export const SERVICE_MAX = 200, TERMS_MAX = 2000;

/** R7: the sentences a consent and a withdrawal answer with (DEC-78 item 5(d)). */
export const CONSENT_STATEMENT = word("sources.consent_permanent_anything");
export const WITHDRAWAL_STATEMENT = word("sources.withdrawal_binds_later");
/** R4: what an entry recorded without its value reads as (DEC-78 item 5(c)). */
export const NOT_RECORDED = word("sources.known_group_recorded");
/** R3: the sentence a hostile disclosure reads as (DEC-78 item 5(b)). */
export const claimSentence = (claimedBy, at) =>
  word("sources.named_confirmed_group", { claimed_by: String(claimedBy), at: String(String(at).slice(0, 10)) });

const HEX64 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const rank = (a) => AUDIENCES.indexOf(a);
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** R2: evidence is a non-empty statement, or a citation `{cite, note?}`; anything else is none. Only a citation is
 *  "public elsewhere" evidence (R8). */
export function evidenceOf(v) {
  if (typeof v === "string" && v.trim() && v.length <= EVIDENCE_MAX) return { statement: v.trim() };
  if (isObj(v) && typeof v.cite === "string" && v.cite.trim() && v.cite.length <= EVIDENCE_MAX) {
    const note = typeof v.note === "string" && v.note.trim() ? v.note.trim().slice(0, EVIDENCE_MAX) : null;
    return note ? { cite: v.cite.trim(), note } : { cite: v.cite.trim() };
  }
  return null;
}

/** R20: an ISO 8601 instant: a date that exists, a time of day (seconds and a fraction optional) and its zone, `Z`
 *  or an offset `±HH:MM`. A date alone, a local time with no zone, and anything `Date.parse` reads but ISO 8601 does
 *  not spell (`"2026"`, `"Sep 30 2026"`) are not instants. */
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
export function isInstant(v) {
  const m = typeof v === "string" ? INSTANT.exec(v) : null;
  if (!m || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? 0) > 59 || Number(m[7] ?? 0) > 23 || Number(m[8] ?? 0) > 59)
    return false;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day && Number.isFinite(Date.parse(v));
}

/** R20: the most changes one answer carries, and the default (N90's bound). */
export const CHANGES_LIMIT_DEFAULT = 200, CHANGES_LIMIT_MAX = 1000;
/** The first instant `stampInstant` no longer spells with a four-digit year. */
const INSTANT_SPELLED_MAX = Date.parse("+010000-01-01T00:00:00Z");

/** A date `YYYY-MM-DD` that exists, or a readable ISO instant. */
function isWhen(v) {
  if (typeof v !== "string" || !v) return false;
  if (DATE.test(v)) { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }
  return /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
}

export class Sources {
  #sql; #record; #membership; #doorbellRef; #provenanceRef; #clock; #listeners = [];

  constructor({ storage, record, membership, doorbell = null, provenance = null, now = null } = {}) {
    this.#sql = storage.sql;
    this.#record = record;
    this.#membership = membership;
    this.#doorbellRef = doorbell;
    this.#provenanceRef = provenance;
    this.#clock = typeof now === "function" ? now : () => Date.now();
    migrateSources(this.#sql);
    /* R13, R19: every table declared with its classes, each exempt from purge. */
    const declared = record.declareTable("sources", SOURCES_TABLE_CLASSES.map((e) => ({ ...e })));
    if (declared && declared.ok === false)
      throw new Error(`sources: record-core refused its table declaration: ${declared.reason} (${declared.table})`);
  }

  get #doorbell() { return typeof this.#doorbellRef === "function" ? this.#doorbellRef() : this.#doorbellRef; }
  get #provenance() {
    if (typeof this.#provenanceRef === "function") this.#provenanceRef = this.#provenanceRef();
    return this.#provenanceRef;
  }
  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #nowMs() { const n = Number(this.#clock()); return Number.isFinite(n) ? n : Date.parse(this.#clock()); }
  #instant() { return stampInstant("millisecond", this.#nowMs()); }

  /* ---- who is asking ---- */

  /** The member a stamp names (a bare member id, `member:<id>`, or the founder), or null: a machine credential, an
   *  empty stamp, or a member not on the roster as active names no one. */
  #memberOf(stamp) {
    if (typeof stamp !== "string" || !stamp.trim()) return null;
    const s = stamp.trim();
    if (s === "admin" || s === "member:admin") return "admin";
    if (isMachineIdentity(s)) return null;
    const id = s.startsWith("member:") ? s.slice(7) : s;
    if (!id || id.includes(":")) return null;
    const facts = this.#membership.memberFacts(id);
    return facts && facts.status === "active" ? id : null;
  }

  #isAdmin(member) {
    try { return this.#membership.activeAdmins().includes(member); } catch { return false; }
  }

  /* ---- R1: a source from a capture ---- */

  #source(id) { return typeof id === "string" && id ? this.#one(`SELECT * FROM sources WHERE source_id = ?`, id) : null; }

  /** Every knock pulled into the capture, oldest received first: the doorbell's one keyed read (its R18). */
  #pulledKnocks(captureSha) {
    const list = this.#doorbell.pulledKnocksOf(captureSha);
    return Array.isArray(list) ? list.filter((k) => k && typeof k.knock_id === "string" && k.sha256 === captureSha) : [];
  }

  /** R1: doorbell R13's `source`, verbatim, from the knock's row. */
  static stated(k) {
    return { kind: "knocker", named: false, pseudonym: k.pseudonym ?? null,
             receipt: { knock_id: k.knock_id, sha256: k.sha256, bytes: k.bytes, received: k.received } };
  }

  /** R1: the source behind one pulled knock, minted and kept on first read. In the caller's transaction. */
  #sourceFor(k) {
    const held = this.#one(`SELECT source_id FROM source_knocks WHERE knock_id = ?`, k.knock_id);
    if (held) return held.source_id;
    let id = k.pseudonym
      ? this.#one(`SELECT source_id FROM sources WHERE pseudonym = ?`, k.pseudonym)?.source_id
      : this.#one(`SELECT source_id FROM sources WHERE first_knock = ? AND pseudonym IS NULL`, k.knock_id)?.source_id;
    if (!id) {
      const year = new Date(this.#nowMs()).getUTCFullYear();
      id = this.#record.mintOpaqueId("SRC", year, "", (x) => !!this.#source(x));
      if (!id) return null;
      this.#sql.exec(`INSERT INTO sources (source_id, pseudonym, knocker_digest, first_knock, minted_at) VALUES (?, ?, ?, ?, ?)`,
                     id, k.pseudonym ?? null, k.pseudonym ? (k.knocker_digest ?? null) : null, k.knock_id, this.#instant());
      this.#bindKnocks(this.#source(id));
    }
    this.#bindKnock(k, id);
    return id;
  }

  /** R15: one `source_knocks` row per pulled knock a source stands behind, written once and never changed. */
  #bindKnock(k, sourceId) {
    this.#sql.exec(`INSERT OR IGNORE INTO source_knocks (knock_id, source_id, capture_sha, bytes, received) VALUES (?, ?, ?, ?, ?)`,
                   k.knock_id, sourceId, k.sha256, Number(k.bytes) || 0, String(k.received));
  }

  /** R15: every pulled knock of a pseudonym's source bound to it, from the doorbell's `knocksOf` (its R15), when the source
   *  is minted and before each act that may move its rung (R10), so a capture the source stands behind has its row
   *  whichever of its captures was read (reevaluation R28 reads them). A knock without a secret is its source's only
   *  knock, bound when read. In the caller's transaction; a doorbell that does not answer binds nothing more. */
  #bindKnocks(src) {
    if (!src || !src.pseudonym) return;
    let after = null;
    for (;;) {
      let page;
      try { page = this.#doorbell.knocksOf({ pseudonym: src.pseudonym, limit: 1000, after }); } catch { return; }
      if (!page || page.ok === false || !Array.isArray(page.knocks)) return;
      for (const k of page.knocks)
        if (k && k.status === "pulled" && typeof k.knock_id === "string" && HEX64.test(String(k.sha256)) && k.capture_sha === k.sha256)
          this.#bindKnock(k, src.source_id);
      if (!page.truncated || !page.next) return;
      after = page.next;
    }
  }

  /** R1: the source as it stood when the capture was received (the capture's own `source`, verbatim), and beside it the
   *  source's current history, each value read as R5 allows. */
  sourceOf(args = {}) {
    const { captureSha, viewer } = isObj(args) ? args : {};
    const reader = this.#memberOf(viewer);
    if (!reader || typeof captureSha !== "string" || !HEX64.test(captureSha)) return noSuchSource(null, { captureSha: HEX64.test(String(captureSha)) ? captureSha : null });
    const knocks = this.#pulledKnocks(captureSha);
    if (!knocks.length) return noSuchSource(null, { captureSha });
    const ids = this.#record.transact(() => {
      const out = [];
      for (const k of knocks) {
        const id = this.#sourceFor(k);
        if (!id) return mintExhausted("SRC");
        out.push(id);
      }
      return out;
    });
    if (ids && ids.ok === false) return ids;
    const first = ids[0];
    return { ok: true, captureSha, sourceId: first, source: Sources.stated(knocks[0]),
             history: this.#history(first, reader),
             ...(knocks.length > 1 ? { sources: knocks.map((k, i) => ({ sourceId: ids[i], source: Sources.stated(k) })) } : {}) };
  }

  /* ---- reading a history (R2–R5) ---- */

  #entries(sourceId, at = null) {
    const all = this.#rows(`SELECT * FROM source_entries WHERE source_id = ? ORDER BY seq`, sourceId);
    return at == null ? all : all.filter((e) => instantOrder(e.at, at) <= 0);
  }

  /** R2: a later entry of the same kind and attribute (for a link, the same other source) supersedes an earlier one. A
   *  hostile claim is a claim on its own track (R3): only a later hostile claim supersedes it, and it supersedes only
   *  a hostile claim, so a confirmation never erases the claim it confirms. */
  static #supersession(entries) {
    const key = (e) => `${e.how === "hostile" ? "claim" : "firm"}|${e.kind}|${e.attribute ?? ""}|${e.link_to ?? ""}`;
    const last = new Map(), by = new Map();
    for (const e of entries) {
      const k = key(e);
      if (last.has(k)) by.set(last.get(k), e.entry_id);
      last.set(k, e.entry_id);
    }
    return by;
  }

  #sightOf(entryId) { return this.#rows(`SELECT member_id FROM source_sight WHERE entry_id = ? ORDER BY member_id`, entryId).map((r) => r.member_id); }

  /** One entry as `reader` may read it: its value only to a listed member, each such read logged (R5); a hostile one
   *  as the exposer's claim, never confirmed (R3); one recorded without its value, with none (R4). */
  #view(e, reader, supersededBy, log) {
    const out = { entry: e.entry_id, source: e.source_id, kind: e.kind, ...(e.attribute ? { attribute: e.attribute } : {}),
                  how: e.how, knownTo: e.known_to, recorded: !!e.recorded, evidence: safeJson(e.evidence_json),
                  by: e.by, at: e.at, superseded_by: supersededBy.get(e.entry_id) ?? null };
    if (e.link_to) Object.assign(out, { to: e.link_to, basis: e.basis });
    if (e.confirms) out.confirms = e.confirms;
    if (e.how === "hostile")
      Object.assign(out, { claimed_by: e.claimed_by, claimed_at: e.claimed_at, confirmed: false,
                           claim: claimSentence(e.claimed_by, e.claimed_at) });
    if (e.kind === "pseudonym_link") return out;
    if (!e.recorded) { out.note = NOT_RECORDED; return out; }
    if (reader && this.#sightOf(e.entry_id).includes(reader)) {
      out.value = e.value;
      if (log) this.#sql.exec(`INSERT INTO source_reads (source_id, entry_id, reader, at) VALUES (?, ?, ?, ?)`,
                              e.source_id, e.entry_id, reader, this.#instant());
    } else out.withheld = true;
    return out;
  }

  #history(sourceId, reader) {
    const entries = this.#entries(sourceId);
    const sup = Sources.#supersession(entries);
    return this.#record.transact(() => entries.map((e) => this.#view(e, reader, sup, true)));
  }

  /** R5: the read log, to the members listed on an entry (their entries' reads) and to administrators (every read). */
  readLog(args = {}) {
    const { source, viewer } = isObj(args) ? args : {};
    const reader = this.#memberOf(viewer);
    if (!reader || !this.#source(source)) return noSuchSource(source);
    const all = this.#rows(`SELECT source_id AS source, entry_id AS entry, reader, at FROM source_reads WHERE source_id = ? ORDER BY seq`, source);
    if (this.#isAdmin(reader)) return { ok: true, source, scope: "all", log: all };
    const listed = new Set(this.#rows(`SELECT s.entry_id FROM source_sight s JOIN source_entries e ON e.entry_id = s.entry_id
                                        WHERE e.source_id = ? AND s.member_id = ?`, source, reader).map((r) => r.entry_id));
    return { ok: true, source, scope: "listed", log: all.filter((r) => listed.has(r.entry)) };
  }

  /* ---- the ladder (R9) ---- */

  /** R9: the rung and the entries it rests on, from the current (unsuperseded) entries. A hostile claim never raises
   *  the rung (R3: it is not confirmed); it is answered beside it. */
  #rung(sourceId) {
    const src = this.#source(sourceId);
    const entries = this.#entries(sourceId);
    const sup = Sources.#supersession(entries);
    const current = entries.filter((e) => !sup.has(e.entry_id));
    const firm = current.filter((e) => e.how !== "hostile");
    const names = firm.filter((e) => e.kind === "name");
    const pub = names.filter((e) => e.known_to === "public");
    const attrs = firm.filter((e) => e.kind === "attribute");
    const sameSecret = this.#rows(`SELECT * FROM source_entries WHERE (source_id = ? OR link_to = ?) AND basis = 'same_secret' ORDER BY seq`,
                                  sourceId, sourceId);
    let rung = "unknown", basis = [];
    if (pub.length) { rung = "publicly_known"; basis = pub; }
    else if (names.length) { rung = "known_to_group"; basis = names; }
    else if (attrs.length) { rung = "partly_known"; basis = attrs; }
    else if ((src && src.pseudonym) || sameSecret.length) { rung = "same_knocker"; basis = sameSecret; }
    return { rung, basis, claims: current.filter((e) => e.how === "hostile"), sup, pseudonym: src ? src.pseudonym : null };
  }

  /** R9: the ladder for a viewer, with who knows and how; a withheld value stays withheld (R5). */
  rungOf(args = {}) {
    const { source, viewer } = isObj(args) ? args : {};
    const reader = this.#memberOf(viewer);
    if (!reader || !this.#source(source)) return noSuchSource(source);
    const r = this.#rung(source);
    const views = this.#record.transact(() => ({
      basis: r.basis.map((e) => this.#view(e, reader, r.sup, true)),
      claims: r.claims.map((e) => this.#view(e, reader, r.sup, true)),
    }));
    return { ok: true, source, rung: r.rung, ladder: RUNGS,
             ...(r.rung === "same_knocker" && r.pseudonym
               ? { knocker: { pseudonym: r.pseudonym, how: word("doorbell.continuity") } } : {}),
             basis: views.basis, claims: views.claims };
  }

  /* ---- listeners (R10) ---- */

  /** R10: a later module registers once at start; each listener is called after every R2, R6, R7 or R11 commit. */
  onDisclosure(module, fn) {
    const refused = listenerRefusal(this.#listeners, module, fn, { slot: "onDisclosure" });
    if (refused) return refused;
    this.#listeners.push({ module, fn });
    return { ok: true, module };
  }

  /** R10, R13: the payload names ids and rungs, never a value; a listener's failure never undoes the act. */
  #notify(source, entry, before, after) {
    const out = [];
    for (const { module, fn } of this.#listeners) {
      try { out.push({ module, ok: true, result: fn({ source, entry, rung_before: before, rung_after: after }) }); }
      catch { out.push({ module, ok: false }); }
    }
    return out;
  }

  /* ---- recording a disclosure (R2–R5) ---- */

  /** R2–R5 (`op=sourcedisclose`). */
  recordDisclosure(args = {}) {
    const a = isObj(args) ? args : {};
    const by = this.#memberOf(a.by);
    const src = this.#source(a.source);
    if (!by || !src) return noSuchSource(a.source);
    const w = this.#disclosureRefusal(a, src);
    if (w.ok === false) return w;
    return this.#append(src.source_id, w, by);
  }

  /** R2–R5, in order: the fields (BAD_DISCLOSURE, naming the field), the evidence (NO_EVIDENCE), the sight list
   *  (NO_SIGHT_LIST). Answers the entry to write, or the refusal. */
  #disclosureRefusal(a, src) {
    const rv = isObj(a.revealed) ? a.revealed : null;
    if (!rv || !KINDS.includes(rv.kind))
      return badDisclosure("revealed.kind", `what was revealed is one of ${KINDS.join(", ")}`);
    const kind = rv.kind;
    let attribute = null;
    if (kind === "attribute") {
      if (!ATTRIBUTES.includes(rv.attribute))
        return badDisclosure("revealed.attribute", `an attribute is one of ${ATTRIBUTES.join(", ")}`);
      attribute = rv.attribute;
    } else if (rv.attribute !== undefined)
      return badDisclosure("revealed.attribute", "only an attribute names which attribute it is");
    if (!HOWS.includes(a.how)) return badDisclosure("how", `how it became known is one of ${HOWS.join(", ")}`);
    if (!AUDIENCES.includes(a.knownTo)) return badDisclosure("knownTo", `to whom it is known is one of ${AUDIENCES.join(", ")}`);
    if (a.recorded !== undefined && typeof a.recorded !== "boolean")
      return badDisclosure("recorded", "recorded is true (the value is stored) or false (known, not stored)");
    const recorded = a.recorded !== false;
    let linkTo = null, value = null;
    if (kind === "pseudonym_link") {
      const to = this.#source(rv.to);
      if (!to || to.source_id === src.source_id)
        return badDisclosure("revealed.to", "a pseudonym link names another source this caller may see");
      if (rv.value !== undefined) return badDisclosure("revealed.value", "a pseudonym link carries no value: it names the other source");
      linkTo = to.source_id;
    } else if (recorded) {
      if (typeof rv.value !== "string" || !rv.value.trim() || rv.value.length > VALUE_MAX)
        return badDisclosure("revealed.value", `a stored detail carries its value, at most ${VALUE_MAX} characters`);
      value = rv.value.trim();
    } else if (rv.value !== undefined)
      return badDisclosure("revealed.value", "a detail recorded as known without its value carries no value");
    let claimedBy = null, claimedAt = null;
    if (a.how === "hostile") {
      claimedBy = str(a.claimedBy);
      if (!claimedBy || claimedBy.length > CLAIMED_BY_MAX)
        return badDisclosure("claimedBy", `a hostile disclosure names who made the claim, at most ${CLAIMED_BY_MAX} characters`);
      if (a.claimedAt !== undefined && a.claimedAt !== null && !isWhen(a.claimedAt))
        return badDisclosure("claimedAt", "when the claim was made is a date written YYYY-MM-DD, or an instant");
      claimedAt = a.claimedAt ? String(a.claimedAt) : null;
    } else if (a.claimedBy !== undefined || a.claimedAt !== undefined)
      return badDisclosure("claimedBy", "only a hostile disclosure is stored as someone's claim");
    let confirms = null;
    if (a.confirms !== undefined && a.confirms !== null) {
      const h = typeof a.confirms === "string"
        ? this.#one(`SELECT entry_id, how FROM source_entries WHERE entry_id = ? AND source_id = ?`, a.confirms, src.source_id) : null;
      if (!h || h.how !== "hostile" || a.how === "hostile")
        return badDisclosure("confirms", "a confirmation names a hostile disclosure of this source, and is not hostile itself");
      confirms = h.entry_id;
    }
    const evidence = evidenceOf(a.evidence);
    if (!evidence) return noEvidence();
    let sight = [];
    if (value !== null) {
      if (!Array.isArray(a.sight) || !a.sight.length)
        return noSightList("a stored value needs a non-empty list of the members who may read it");
      const members = a.sight.map((m) => this.#memberOf(m));
      const unknown = members.filter((m) => !m).length;
      if (unknown)
        return noSightList(`the sight list names ${unknown} id(s) that name no active member`, { count: unknown });
      sight = [...new Set(members)];
    } else if (a.sight !== undefined && !(Array.isArray(a.sight) && a.sight.length === 0))
      return badDisclosure("sight", "only a stored value has a sight list");
    return { kind, attribute, value, recorded, how: a.how, knownTo: a.knownTo, evidence, claimedBy, claimedAt, confirms,
             linkTo, basis: linkTo ? "evidence" : null, sight };
  }

  /** Appends one entry and notifies (R2, R6, R10). A link (R6) that moves the linked source's rung (a `same_secret`
   *  basis proves it too, R9) notifies for that source as well, with the same entry. The answer carries no value (R13). */
  #append(sourceId, w, by) {
    const before = this.#rung(sourceId).rung;
    const linkedBefore = w.linkTo ? this.#rung(w.linkTo).rung : null;
    const at = this.#instant();
    const entryId = `SRCE-${hex(8)}`;
    this.#record.transact(() => {
      this.#bindKnocks(this.#source(sourceId));
      if (w.linkTo) this.#bindKnocks(this.#source(w.linkTo));
      this.#sql.exec(`INSERT INTO source_entries (entry_id, source_id, kind, attribute, value, recorded, how, known_to,
                        evidence_json, claimed_by, claimed_at, confirms, link_to, basis, by, at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                     entryId, sourceId, w.kind, w.attribute, w.value, w.recorded ? 1 : 0, w.how, w.knownTo,
                     JSON.stringify(w.evidence), w.claimedBy, w.how === "hostile" ? (w.claimedAt || at) : null,
                     w.confirms, w.linkTo, w.basis, by, at);
      for (const m of w.sight) this.#sql.exec(`INSERT INTO source_sight (entry_id, member_id) VALUES (?, ?)`, entryId, m);
      return { ok: true };
    });
    const after = this.#rung(sourceId).rung;
    const notified = this.#notify(sourceId, entryId, before, after);
    const linkedAfter = w.linkTo ? this.#rung(w.linkTo).rung : null;
    if (w.linkTo && linkedAfter !== linkedBefore) notified.push(...this.#notify(w.linkTo, entryId, linkedBefore, linkedAfter));
    return { ok: true, source: sourceId, entry: entryId, kind: w.kind, ...(w.attribute ? { attribute: w.attribute } : {}),
             how: w.how, knownTo: w.knownTo, recorded: w.recorded, by, at,
             ...(w.linkTo ? { to: w.linkTo, basis: w.basis } : {}),
             ...(w.how === "hostile" ? { confirmed: false, claim: claimSentence(w.claimedBy, w.claimedAt || at) } : {}),
             ...(w.sight.length ? { sight: w.sight } : {}),
             rung_before: before, rung_after: after, notified: notified.length };
  }

  /* ---- R6: two sources claimed as one person ---- */

  /** R6 (`op=sourcelink`). A presented `knockerSecret` whose digest is either source's knocker digest makes the claim's
   *  basis `same_secret`; the secret is never stored or answered. The claim merges nothing. */
  async linkClaim(args = {}) {
    const a = isObj(args) ? args : {};
    const by = this.#memberOf(a.by);
    const src = this.#source(a.source), to = this.#source(a.to);
    if (!by || !src) return noSuchSource(a.source);
    if (!to) return noSuchSource(a.to);
    if (to.source_id === src.source_id) return badDisclosure("to", "a pseudonym link names another source");
    const evidence = evidenceOf(a.evidence);
    if (!evidence) return noEvidence();
    let basis = "evidence";
    if (typeof a.knockerSecret === "string" && a.knockerSecret.length >= SECRET_MIN) {
      const d = await this.#digestOf(a.knockerSecret);
      if (d && [src.knocker_digest, to.knocker_digest].some((k) => k && k === d.knocker_digest)) basis = "same_secret";
    }
    return this.#append(src.source_id, { kind: "pseudonym_link", attribute: null, value: null, recorded: true,
                                         how: basis === "same_secret" ? "self" : "third_party", knownTo: "group",
                                         evidence, claimedBy: null, claimedAt: null, confirms: null,
                                         linkTo: to.source_id, basis, sight: [] }, by);
  }

  async #digestOf(secret) {
    try {
      const d = await this.#doorbell.knockerDigestOf(secret);
      return d && typeof d.knocker_digest === "string" && d.knocker_digest ? d : null;
    } catch { return null; }
  }

  /* ---- R7, R8: consent and what may be published ---- */

  /** The audience rank consented for an entry at `at` (or now): a consent raises it to its audience, a withdrawal
   *  lowers it below its audience; -1 when none stands. */
  #standing(entryId, at = null) {
    let level = -1;
    for (const c of this.#rows(`SELECT act, audience, at FROM source_consents WHERE entry_id = ? ORDER BY seq`, entryId)) {
      if (at != null && instantOrder(c.at, at) > 0) continue;
      level = c.act === "consent" ? Math.max(level, rank(c.audience)) : Math.min(level, rank(c.audience) - 1);
    }
    return level;
  }

  /** R7: one consent or withdrawal, the refusals common to both arms (the audience, the entry, the standing). Answers
   *  the row to write, `{noop}` when nothing would change, or the refusal. */
  #consentPlan(sourceId, entryId, audience, withdraw) {
    if (!AUDIENCES.includes(audience)) return badDisclosure("audience", `an audience is one of ${AUDIENCES.join(", ")}`);
    const e = typeof entryId === "string"
      ? this.#one(`SELECT entry_id FROM source_entries WHERE entry_id = ? AND source_id = ?`, entryId, sourceId) : null;
    if (!e) return consentNotStanding("the entry named is not in this source's history", { entry: typeof entryId === "string" ? entryId.slice(0, 64) : null });
    const level = this.#standing(e.entry_id);
    if (!withdraw) {
      if (rank(audience) < level)
        return consentNotStanding(`consent to the ${AUDIENCES[level]} audience already stands`, { standing: AUDIENCES[level] });
      if (rank(audience) === level) return { noop: true, standing: audience };
      return { act: "consent", entry: e.entry_id, audience };
    }
    if (level < rank(audience)) return { noop: true, standing: level >= 0 ? AUDIENCES[level] : null };
    return { act: "withdraw", entry: e.entry_id, audience };
  }

  #writeConsent(sourceId, plan, { evidence = null, via, by }) {
    const before = this.#rung(sourceId).rung;
    const at = this.#instant();
    this.#record.transact(() => {
      this.#bindKnocks(this.#source(sourceId));
      this.#sql.exec(`INSERT INTO source_consents (source_id, entry_id, act, audience, evidence_json, via, by, at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                     sourceId, plan.entry, plan.act, plan.audience, evidence ? JSON.stringify(evidence) : null, via, by, at);
      return { ok: true };
    });
    const level = this.#standing(plan.entry);
    const notified = this.#notify(sourceId, plan.entry, before, this.#rung(sourceId).rung);
    return { ok: true, source: sourceId, entry: plan.entry, audience: plan.audience, act: plan.act, at,
             standing: level >= 0 ? AUDIENCES[level] : null,
             statement: plan.act === "consent" ? CONSENT_STATEMENT : WITHDRAWAL_STATEMENT, notified: notified.length };
  }

  /** R7 (`op=sourceconsent`): a member records the source's consent, with its evidence. */
  recordConsent(args = {}) {
    const a = isObj(args) ? args : {};
    const by = this.#memberOf(a.by);
    const src = this.#source(a.source);
    if (!by || !src) return noSuchSource(a.source);
    if (!AUDIENCES.includes(a.audience)) return badDisclosure("audience", `an audience is one of ${AUDIENCES.join(", ")}`);
    const evidence = evidenceOf(a.evidence);
    if (!evidence) return noEvidence();
    const plan = this.#consentPlan(src.source_id, a.entry, a.audience, false);
    if (plan.ok === false) return plan;
    if (plan.noop) return { ok: true, existed: true, source: src.source_id, entry: a.entry, audience: a.audience,
                            standing: plan.standing, statement: CONSENT_STATEMENT };
    return this.#writeConsent(src.source_id, plan, { evidence, via: "member", by });
  }

  /** R7 (`op=sourceconsentwithdraw`): binds only later publications. */
  withdrawConsent(args = {}) {
    const a = isObj(args) ? args : {};
    const by = this.#memberOf(a.by);
    const src = this.#source(a.source);
    if (!by || !src) return noSuchSource(a.source);
    const plan = this.#consentPlan(src.source_id, a.entry, a.audience, true);
    if (plan.ok === false) return plan;
    if (plan.noop) return { ok: true, withdrawn: false, source: src.source_id, entry: a.entry, audience: a.audience,
                            standing: plan.standing, statement: WITHDRAWAL_STATEMENT };
    return this.#writeConsent(src.source_id, plan, { via: "member", by });
  }

  /** R8: each entry that may be shown to `audience` at `at`, with its value (none for an entry recorded without one)
   *  and its basis; every other entry is left out, and nothing is said about it. Its answer is not a read under sight:
   *  it answers only what consent or the public record already opens to that audience, so it logs nothing (R5, K539).
   *  It writes nothing and never throws. A stated `at` is for in-plane callers (R20's among them); the route asks at
   *  this module's own instant and passes none (`sourcesOps`, K3045). */
  publishableAt(args = {}) {
    const { source, audience, at = null } = isObj(args) ? args : {};
    try {
      if (!this.#source(source)) return noSuchSource(source);
      if (!AUDIENCES.includes(audience)) return badDisclosure("audience", `an audience is one of ${AUDIENCES.join(", ")}`);
      if (at != null && !(typeof at === "string" && !Number.isNaN(Date.parse(at))))
        return badDisclosure("at", "the instant asked about is an ISO 8601 instant");
      const when = at ?? this.#instant();
      const entries = this.#entries(source, when);
      const sup = Sources.#supersession(entries);
      const out = [];
      for (const e of entries) {
        if (sup.has(e.entry_id)) continue;
        const ev = safeJson(e.evidence_json);
        let basis = null;
        if (this.#standing(e.entry_id, when) >= rank(audience)) basis = "consent";
        else if (e.known_to === "public" && ev && typeof ev.cite === "string" && !e.confirms) basis = "public_elsewhere";
        if (!basis) continue;
        const row = { entry: e.entry_id, kind: e.kind, ...(e.attribute ? { attribute: e.attribute } : {}), how: e.how,
                      knownTo: e.known_to, recorded: !!e.recorded, basis, ...(e.link_to ? { to: e.link_to } : {}),
                      ...(e.value != null ? { value: e.value } : {}) };
        if (e.how === "hostile")
          Object.assign(row, { confirmed: false, claim: claimSentence(e.claimed_by, e.claimed_at) });
        out.push(row);
      }
      return { ok: true, source, audience, at: when, entries: out };
    } catch {
      return noSuchSource(source);
    }
  }

  /* ---- R20: the instants at which what R8 answers could have changed ---- */

  /** R20 (in-plane only: no route, no viewer). Each disclosure appended to `source` (R2, R6) and each consent and
   *  withdrawal recorded for it (R7, R11) at an instant after `since` and at or before the read's own instant, in
   *  recorded order, each `{at, act, entry}` and nothing else (R5, R13: no value, audience, evidence, member or sight).
   *  A caller asks R8 at each `at`, and at `since`, to find a state that held only inside the interval.
   *
   *  Recorded order is the instant, then, at one instant, disclosures before consents (a consent names an entry
   *  already appended), then each table's own order. Every `at` here is written by `#instant()`, one spelling
   *  (`stampInstant("millisecond")`), so instants compare as text; `since` is put in that spelling first, its
   *  fraction past the millisecond dropped, which keeps "after" exact for instants held to the millisecond. `next`
   *  names the last change answered (`d<seq>` or `c<seq>`); an `after` that names no change of this source reads as
   *  absent, from the first. It writes nothing, logs no read and never throws. */
  sourceChangesSince(args = {}) {
    const { source, since, limit, after } = isObj(args) ? args : {};
    try {
      if (!this.#source(source)) return noSuchSource(source);
      if (!isInstant(since)) return { ok: true, source, changes: null, since_invalid: true };
      const n = typeof limit === "number" || (typeof limit === "string" && limit.trim()) ? Math.trunc(Number(limit)) : NaN;
      const lim = Number.isFinite(n) ? Math.min(CHANGES_LIMIT_MAX, Math.max(1, n)) : CHANGES_LIMIT_DEFAULT;
      /* a `since` past year 9999 is after every instant held: its spelling would otherwise sort first as text */
      const sinceMs = Date.parse(since);
      const from = sinceMs >= INSTANT_SPELLED_MAX ? "9999-12-31T23:59:59.999Z" : stampInstant("millisecond", sinceMs);
      const at = this.#instant();
      let cAt = "", cRank = -1, cSeq = -1;
      const cur = typeof after === "string" ? /^([dc])(\d{1,15})$/.exec(after) : null;
      if (cur) {
        const row = this.#one(cur[1] === "d" ? `SELECT at FROM source_entries WHERE seq = ? AND source_id = ?`
                                             : `SELECT at FROM source_consents WHERE seq = ? AND source_id = ?`, Number(cur[2]), source);
        if (row) { cAt = row.at; cRank = cur[1] === "d" ? 0 : 1; cSeq = Number(cur[2]); }
      }
      const rows = this.#rows(
        `SELECT at, r, seq, entry, act FROM (
           SELECT at, 0 AS r, seq, entry_id AS entry, 'disclosure' AS act FROM source_entries WHERE source_id = ?
           UNION ALL
           SELECT at, 1 AS r, seq, entry_id AS entry, CASE act WHEN 'consent' THEN 'consent' ELSE 'withdrawal' END AS act
             FROM source_consents WHERE source_id = ?)
         WHERE at > ? AND at <= ? AND (at > ? OR (at = ? AND (r > ? OR (r = ? AND seq > ?))))
         ORDER BY at, r, seq LIMIT ?`,
        source, source, from, at, cAt, cAt, cRank, cRank, cSeq, lim + 1);
      const truncated = rows.length > lim;
      const page = rows.slice(0, lim);
      const last = page[page.length - 1];
      return { ok: true, source, since, at, changes: page.map((c) => ({ at: c.at, act: c.act, entry: c.entry })),
               limit: lim, truncated, next: truncated ? `${last.r === 0 ? "d" : "c"}${last.seq}` : null };
    } catch {
      return noSuchSource(source);
    }
  }

  /* ---- R11: consent by the knocker's own secret, no account ---- */

  /** R11 (`op=knockerconsent`). Counted in the knock's rate windows as a knock from its source (doorbell R2, R17; K530);
   *  a rate refusal answers as the knock's does. Every other failure answers `SECRET_NOT_RECOGNISED`, byte for byte
   *  the same. `sourceAddress` and `now` are the control plane's, as for a knock. */
  async consentBySecret(args = {}) {
    const a = isObj(args) ? args : {};
    const bell = this.#doorbell;
    let rate;
    try {
      /* The instant is the control plane's stamp when it sends one, else this module's own clock, never a third: an
         attempt counted on another clock lands in another window, and the doorbell's prune of every bucket but the
         current window's two would drop the others' counts (doorbell R2's window is one clock's). */
      const stamped = a.now != null && a.now !== "" && Number.isFinite(Number(a.now)) ? Number(a.now) : null;
      rate = await bell.knockAttempt({ sourceAddress: a.sourceAddress ?? null, now: stamped ?? this.#nowMs() });
    } catch { return SECRET_NOT_RECOGNISED_ANSWER; }
    if (rate && rate.ok === false) return rate;
    const secret = typeof a.knockerSecret === "string" ? a.knockerSecret : "";
    const d = await this.#digestOf(secret.length >= SECRET_MIN ? secret : "\u0000".repeat(SECRET_MIN));
    if (secret.length < SECRET_MIN || !d || (a.withdraw !== undefined && typeof a.withdraw !== "boolean"))
      return SECRET_NOT_RECOGNISED_ANSWER;
    const src = this.#one(`SELECT * FROM sources WHERE knocker_digest = ?`, d.knocker_digest);
    if (!src) return SECRET_NOT_RECOGNISED_ANSWER;
    const plan = this.#consentPlan(src.source_id, a.entry, a.audience, a.withdraw === true);
    if (plan.ok === false) return SECRET_NOT_RECOGNISED_ANSWER;
    if (plan.noop) return { ok: true, existed: true, entry: a.entry, audience: a.audience,
                            statement: a.withdraw === true ? WITHDRAWAL_STATEMENT : CONSENT_STATEMENT };
    const w = this.#writeConsent(src.source_id, plan, { via: "secret", by: `knocker:${src.pseudonym}` });
    return { ok: true, entry: w.entry, audience: w.audience, act: w.act, at: w.at, statement: w.statement };
  }

  /* ---- R16–R18: a member-keyed result ---- */

  /** R16: the capture's own document, `{actor}`, from its home bundle's `data/provenance.json` (`provenance.homeOf`,
   *  its R4; the document `acquisition` R16 writes), or null when the record holds no such capture. */
  #captureDocument(captureSha) {
    const home = this.#provenance.homeOf(captureSha);
    if (!home || typeof home.bundleId !== "string") return null;
    const f = this.#record.readFile(home.bundleId, "data/provenance.json");
    const reg = f && typeof f.text === "string" ? safeJson(f.text) : null;
    const docs = reg && Array.isArray(reg.documents) ? reg.documents : [];
    const doc = docs.find((d) => isObj(d) && isObj(d.capture)
                                 && String(d.capture.sha256 ?? "").toLowerCase().replace(/^sha256:/, "") === captureSha);
    return doc ? { actor: typeof doc.capture.actor === "string" ? doc.capture.actor : null } : null;
  }

  /** R16 (`op=sourcekeyed`): a member marks a capture they made as a result from a member-keyed outside source (a paid
   *  people-search database or another fee-bearing record), reached by their own act on their own account under the
   *  vendor's terms. Only that member's own act (R18: never a machine, a daemon or a scheduled consumer), one capture
   *  per act; the mark holds the vendor and the terms, never a query, a search term or a result not captured (R18:
   *  every other field of the call is dropped). Refusals, in order: `MACHINE_CANNOT_MARK`, `NO_SERVICE` (naming the
   *  field), `NO_SUCH_CAPTURE`, `NOT_YOUR_CAPTURE`; each writes nothing. Appended once with `by` and the instant; the
   *  same mark again writes nothing. */
  markKeyedResult(args = {}) {
    const a = isObj(args) ? args : {};
    const by = this.#memberOf(a.by);
    if (!by) return machineCannotMark();
    const service = str(a.service);
    if (!service || service.length > SERVICE_MAX)
      return noService("service", `the service is the vendor's name, at most ${SERVICE_MAX} characters`);
    if (a.terms !== undefined && a.terms !== null && (typeof a.terms !== "string" || a.terms.length > TERMS_MAX))
      return noService("terms", `the vendor's terms, when stated, are text of at most ${TERMS_MAX} characters`);
    const terms = str(a.terms) || null;
    const captureSha = typeof a.captureSha === "string" ? a.captureSha.trim().toLowerCase() : null;
    if (!captureSha || !HEX64.test(captureSha)) return noSuchCapture(null);
    let doc;
    try { doc = this.#captureDocument(captureSha); } catch { doc = null; }
    if (!doc) return noSuchCapture(captureSha);
    if (this.#memberOf(doc.actor) !== by) return notYourCapture(captureSha);
    const last = this.#lastMark(captureSha);
    if (last && last.service === service && (last.terms ?? null) === terms && last.by === by)
      return { ok: true, existed: true, captureSha, service, terms, by, at: last.at };
    const at = this.#instant();
    this.#record.transact(() => {
      this.#sql.exec(`INSERT INTO source_keyed_marks (capture_sha, service, terms, by, at) VALUES (?, ?, ?, ?, ?)`,
                     captureSha, service, terms, by, at);
      return { ok: true };
    });
    return { ok: true, captureSha, service, terms, by, at };
  }

  #lastMark(captureSha) {
    return this.#one(`SELECT * FROM source_keyed_marks WHERE capture_sha = ? ORDER BY seq DESC LIMIT 1`, captureSha);
  }

  /** R17: a marked capture's `{member_keyed: true, service, by, at, reproducible_by_public: false, grade_cap}` (its
   *  latest mark), else null; never throws. `grade_cap` is one rank below the letter `provenance.captureGrade` answers
   *  for the capture, in `BASIS_GRADES`' order, D staying D. Where it answers no letter (received, unrecorded or an
   *  unruled route) the cap is one rank below the ceiling it names, the most a leg on it could carry; an authored
   *  observation, which earns none, is held at the testimony grade. */
  keyedResultOf(captureSha) {
    try {
      const sha = typeof captureSha === "string" ? captureSha.trim().toLowerCase() : "";
      if (!HEX64.test(sha)) return null;
      const m = this.#lastMark(sha);
      if (!m) return null;
      return { member_keyed: true, service: m.service, by: m.by, at: m.at, reproducible_by_public: false,
               grade_cap: this.#gradeCap(sha) };
    } catch { return null; }
  }

  #gradeCap(sha) {
    const weakest = BASIS_GRADES[BASIS_GRADES.length - 1];
    const below = (letter) => BASIS_GRADES[Math.min(BASIS_GRADES.indexOf(letter) + 1, BASIS_GRADES.length - 1)];
    let g = null;
    try { g = this.#provenance.captureGrade(sha); } catch { g = null; }
    if (g && BASIS_GRADES.includes(g.grade)) return below(g.grade);
    if (g && BASIS_GRADES.includes(g.ceiling)) return below(g.ceiling);
    return BASIS_GRADES.includes(TESTIMONY_GRADE) ? TESTIMONY_GRADE : weakest;
  }
}

/* K61: one instance per storage. */
const OF = new WeakMap();
export function sourcesOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let s = OF.get(storage);
  if (!s) {
    const record = deps.record ?? recordOf(ctx);
    s = new Sources({ storage, record, membership: deps.membership ?? membershipOf(ctx, { record }),
                      doorbell: deps.doorbell ?? (() => doorbellOf(ctx)),
                      provenance: deps.provenance ?? (() => provenanceOf(ctx, { record })), now: deps.now ?? null });
    OF.set(storage, s);
  }
  return s;
}

/* The Durable Object routes this module answers (the control plane routes and stamps them, layer 11). `url` carries
   the stamps (`by`, `viewer`, and for `knockerconsent` the connecting `source` and `now`), read after the body is
   spread so a caller's own copy never wins (D-136). */
export const SOURCES_OP_NAMES = Object.freeze(["knockerconsent", "sourceconsent", "sourceconsentwithdraw", "sourcedisclose",
  "sourcekeyed", "sourcelink", "sourceof", "sourcepublishable", "sourcereadlog", "sourcerung"]);

export function sourcesOps(s, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = isObj(body) ? body : {};
  return {
    sourceof: () => s.sourceOf({ captureSha: q("capture") ?? b.captureSha, viewer: q("viewer") }),
    sourcedisclose: () => s.recordDisclosure({ ...b, by: q("by") }),
    sourcelink: () => s.linkClaim({ ...b, by: q("by") }),
    sourceconsent: () => s.recordConsent({ ...b, by: q("by") }),
    sourceconsentwithdraw: () => s.withdrawConsent({ ...b, by: q("by") }),
    knockerconsent: () => s.consentBySecret({ ...b, sourceAddress: q("source"), now: q("now") }),
    sourcekeyed: () => s.markKeyedResult({ captureSha: b.captureSha, service: b.service, terms: b.terms, by: q("by") }),
    sourcerung: () => s.rungOf({ source: q("source_id") ?? b.source, viewer: q("viewer") }),
    sourcereadlog: () => s.readLog({ source: q("source_id") ?? b.source, viewer: q("viewer") }),
    /* R8 (T47; K3045): evaluated at this module's own instant; a `now` or `at` in the query or the body is never read */
    sourcepublishable: () => s.publishableAt({ source: q("source_id") ?? b.source, audience: q("audience") ?? b.audience }),
  };
}

/* R21 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  sourcedisclose: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("sources.declared.sourcedisclose", "source-directed: a member appends one disclosure to a source's history — what was revealed, how, to whom it is known, with its evidence — keyed by source id; never edited, a later entry superseding it on read"),
    fields: { accepts: ["source","revealed","how","knownTo","recorded","claimedBy","claimedAt","confirms","evidence","sight"], requires: ["source","revealed","how","knownTo","evidence"] } },
  sourcelink: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("sources.declared.sourcelink", "source-directed: a member claims that two sources are one person, with evidence, keyed by the source pair; recorded as a disclosure and merging nothing"),
    fields: { accepts: ["source","to","evidence","knockerSecret"], requires: ["source","to","evidence"] } },
  sourceconsent: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.sourceconsent.label.about-knocker",
    fields: { accepts: ["source","entry","audience","evidence"], requires: ["source","entry","audience","evidence"] } },
  sourceconsentwithdraw: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("sources.declared.sourceconsentwithdraw", "source-directed: a member records the withdrawal of a source's consent for one disclosure and one audience, keyed by (source, entry); binds only later publications, and what is published stays published"),
    fields: { accepts: ["source","entry","audience"], requires: ["source","entry","audience"] } },
  /* R22 (T51; K4206): `requires` is empty by design: every failure answers SECRET_NOT_RECOGNISED, naming no field (R11). The
     weight and description are op-grades' hand row for this op (its ground and sentence), which the declaration must agree with. */
  knockerconsent: { classes: null, mutating: true, weight: "credential", description: localize("sources.declared.knockerconsent", "a source, proving who they are by their knocker secret and holding no account, consents to or withdraws from one disclosure for one audience (sources R11)"),
    fields: { accepts: ["knockerSecret","entry","audience","withdraw"], requires: [] } },
});
