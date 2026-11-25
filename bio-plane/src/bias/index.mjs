/* bias — declared bias (requirements: `build/requirements/bias.md`). PL-12 / D-84, DEC-54, and the bias debt (D-86,
 * REC-207; K82 (3)). Moved from the legacy store at the module's extraction (T5-7); the set's checks and the C-26
 * family are `./checks.mjs`', the tables `./schema.mjs`'.
 *
 *   biasAdopt     the AUTHORED, ATTRIBUTED, REASONED act that puts a set in force, and the PIN taken at that instant
 *                 (R11, R12; DEC-88).
 *   biasManifest  the EFFECTIVE SET in force for a scope, its hash, and what it does NOT enforce (R13–R18, R24, R25).
 *   statementInForce  whether one statement id is in that set, with its kind and text (R49; D59).
 *   biasInhale    reading an outside policy: it SPLITS bars from bias, PUBLISHES the residue, and PROPOSES, never
 *                 installs (R19–R21). It holds no write path at all: no SQL, no transaction, no promotion.
 *   descriptionDraft  the group's own self-description (membership R110), offered to an active member as the opening
 *                 text of a declared bias; it proposes no statement and writes nothing (R48; DEC-132 (5)).
 *   the promotion step: a malformed set never lands (R9), and the statements are projected and the pins moved to an
 *                 adopted revision in the promotion's own transaction (R10). The state edge is promotion's (its R15).
 *   the bias debt: work products later modules register (R33), swept against the lens now in force, settled by one
 *                 of three recorded acts (R35, R37, R38), read (R36), and disclosed, never blocking (R28).
 *   counts, uncleared, settled  what `queue` reads: the rows held (R42), the open debts with their recipients (R43)
 *                 and the debts settled since an instant, with what settled each (R44). The counts are registered
 *                 with record-core's `registerCounts` for `op=stats` and purge's proof (R46).
 *   migrate       this module's tables and columns, at every boot (R45).
 *
 * REACHED as `biasOf(ctx, deps)` (K61): one instance per Durable Object storage, created on the first call with `deps`
 * and returned to every later caller. `deps`:
 *   record      record-core, `recordOf(ctx)` unless a test passes its own.
 *   membership  membership, `membershipOf(ctx)` unless a test passes its own.
 *   promotion   promotion, `promotionOf(ctx)` unless a test passes its own; this module registers its step and its
 *               post-commit notice with it on first reaching it.
 *   entities    the subject registry (`has(entityId)`, entities R7), for R25: `entitiesOf(ctx)` unless a test passes its
 *               own; `null` is no registry, and R25 then answers undetermined.
 *   env         the instance bindings: `BIAS_DEBT_DELAY_MS` (R41) and `BIAS_DEBT_BATCH` (R33).
 * The ops (`biasmanifest`, `biasadopt`, `biasinhale`, `biasdebtresolve`, `biasdebt`) are `biasOps`' entries, which the
 * plane's op map spreads in (`src/plane/store.mjs`).
 */

import { normalizeType } from "../record-grammar/types.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { MACHINE_AUTHOR_PREFIX, isMachineStamp } from "../record-grammar/actors.mjs";
import { createSha256 } from "../record-grammar/sha256.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, GATE_MARK, listenerRefusal, MODULE_ORDER,
         notAnAdmin } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { BIAS_CHECKS, BIAS_VERDICT_WHOLESALE, BIAS_VERDICT_SPEAKER, BIAS_BAR_PHRASING, checkBiasSet,
         checkBiasImage } from "./checks.mjs";

export { BIAS_CHECKS, BIAS_STATEMENT_KINDS, BIAS_VERDICT_WHOLESALE, BIAS_VERDICT_SPEAKER, BIAS_BAR_PHRASING,
         checkBiasSet, checkBiasImage, withBiasChecks } from "./checks.mjs";
export { BIAS_SCHEMA, BIAS_TABLES, BIAS_ADDITIVE_COLUMNS } from "./schema.mjs";
import { BIAS_SCHEMA, BIAS_ADDITIVE_COLUMNS } from "./schema.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R11 (N327, DEC-83): the instance-scope adoption's fixed act, and its next step, for `membership.notAnAdmin`. Its
   words say "the whole group", never "the instance" (DEC-149); the scope value stays `instance`. */
export const INSTANCE_ADOPTION_ACT = localize("bias.index.adopting_bias_set_whole_team", "adopting a bias set for the whole team");
export const INSTANCE_ADOPTION_REMEDY = word("bias.project_owners_set");

/* The manifest's bound (R18). 200 is the common read, "what lens is in force", which a group's whole declared bias
   fits inside many times over; 2,000 is for a regrade, two lenses re-run against each other, where a lens silently
   cut in half would produce a diff that says two groups agree about statements one of them never received. */
export const BIAS_MANIFEST_LIMIT_DEFAULT = 200;
export const BIAS_MANIFEST_LIMIT_MAX = 2000;
/* The inhale's bounds (R20, R21). The SENTENCE bound is on the INPUT, published apart from the output bounds:
   "40 statements from a policy we read half of" and "40 from one we read all of" are different claims. */
export const BIAS_INHALE_SENTENCES_MAX = 500;
export const BIAS_INHALE_LIMIT_DEFAULT = 200;
export const BIAS_INHALE_LIMIT_MAX = 1000;
/* The lens fingerprint's bound (R22): past this many adoptions a revision of a bundle adopted beyond the cap moves
   no input it reads, so the sweep waits for the next change it can see (or the next adoption, which moves the count). */
export const LENS_FINGERPRINT_MAX = 1000;
/* The bias debt (R33–R41). */
export const BIAS_DEBT_DELAY_MS = 1000;
export const BIAS_DEBT_BATCH = 50;
export const BIAS_DEBT_OWNERS_MAX = 50;
export const BIAS_DEBT_REASON_MAX = 4000;
/* R11 (DEC-88): the adopter's reason, at most this many characters once trimmed. */
export const BIAS_ADOPTION_REASON_MAX = 2000;
export const BIAS_DEBT_SETTLEMENTS_MAX = 50;
/* R43's bound: 200 by default, the queue's page; at most 1,000. */
export const BIAS_DEBT_UNCLEARED_DEFAULT = 200;
export const BIAS_DEBT_UNCLEARED_MAX = 1000;
/* R44's bound, R43's: 200 by default, at most 1,000. */
export const BIAS_DEBT_SETTLED_DEFAULT = 200;
export const BIAS_DEBT_SETTLED_MAX = 1000;
/* The operator-internal viewer the sweep and the re-run check read a lens as (R33, R38): the lens in force is a fact
   about the SCOPE, whoever may see it, so it is read through membership R43's machine arm, which sees every bundle.
   Not the founder's viewer: since D54 (K2408, T41-3) that is withheld a hidden project it is not in, and its lens
   would read as none in force (K2442). */
export const BIAS_DEBT_VIEWER = "class:daemon";
/* R46: the figures R42's `counts(hid)` answers, registered with record-core under these names, in this order. */
export const BIAS_COUNT_KEYS = Object.freeze(["biasStatements", "biasAdoptions"]);

/* REC-207: the two settlements a MEMBER or a WORK PRODUCT made, as against the one the sweep derives when the lens
   moves back. Read on the sweep's hot path: it decides whether an unchanged lens delta re-raises the obligation. */
const SETTLED_BY_AN_ACT = new Set(["rerun", "resolved"]);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const RESIDUE_SECTION = /\n## What This Does Not Enforce[^\S\n]*\n([\s\S]*?)(?=\n## |$)/;
const enc = new TextEncoder();
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const sha256Hex = (text) => createSha256().update(enc.encode(String(text))).hex();

/* REC-187: A BIAS SET'S STATEMENTS AS ROWS, FROM ONE REVISION'S FRONTMATTER — the ONE spelling of that reading. The
   projection writes these rows for the head (R10), and the manifest reads them out of the PINNED revision's bytes;
   two normalisations of one list would let the two disagree about what a statement says. '' rather than NULL on a
   replayed malformed shape (the columns are NOT NULL); an entry with no string id is skipped. */
function statementRows(bundleId, fm) {
  const stmts = fm && Array.isArray(fm.statements) ? fm.statements : [];
  const out = [];
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    if (!s || typeof s !== "object" || typeof s.id !== "string") continue;
    out.push({
      bundle_id: bundleId, ord: i, statement_id: s.id,
      kind: typeof s.kind === "string" ? s.kind : "",
      subject: s.subject == null ? "" : String(s.subject),
      text: typeof s.text === "string" ? s.text : "",
      justification: typeof s.justification === "string" ? s.justification : "",
      citations: Array.isArray(s.citations) ? JSON.stringify(s.citations) : null,
      locked: s.locked === true ? 1 : 0,
      nullifies: typeof s.nullifies === "string" && s.nullifies.trim() ? s.nullifies.trim() : null,
    });
  }
  return out;
}

/* R9: each error finding named by its C-26 row (its code and translation), for BIAS_REFUSED's `findings`. */
const BIAS_ROW_BY_CHECK = new Map(Object.entries(BIAS_CHECKS).map(([code, row]) => [row.check, { code, row }]));
function refusalFindings(errs) {
  return errs.map((x) => {
    const hit = BIAS_ROW_BY_CHECK.get(x.check);
    return { check: x.check, detail: x.message, code: hit ? hit.code : null, translation: hit ? hit.row.translation : null };
  });
}

/* The bundle.md text of one promotion's files, or null. */
const bundleMdText = (files) => {
  const md = Array.isArray(files) ? files.find((x) => x && x.path === "bundle.md") : null;
  return md && typeof md.text === "string" ? md.text : null;
};

class Bias {
  #sql; #record; #membership; #entities; #env;
  #lensListeners = [];     // R23: {module, fn}
  #sources = [];           // R33: {kind, source}
  #notices = Promise.resolve();

  constructor({ sql, record, membership, entities, env } = {}) {
    this.#sql = sql;
    this.#record = record;
    this.#membership = membership;
    this.#entities = entities && typeof entities.has === "function" ? entities : null;
    this.#env = env || {};
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  #refuse(code, detail, extra = {}) {
    const row = BIAS_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
  }

  /* The viewer gate over a bundle-id column (membership's one sight rule, R43, over record-core's `bundles`): a
     machine credential passes everything, an unrecognised viewer nothing, a member, the founder included, what the
     predicate admits (since D54 the founder and an administrator are withheld a hidden project they are not in).
     The column must be qualified, or it binds to `bundles` inside the subquery and passes all. */
  static #gate(col, viewer) { return Bias.#gateOver(col, viewerPredicate(viewer)); }

  /* The same gate from a predicate already compiled (`viewerPredicate`'s answer, R43's `gate`). A predicate that is
     not `{sql, args}` admits nothing (fail closed). */
  static #gateOver(col, gate) {
    if (!isObj(gate) || typeof gate.sql !== "string" || !Array.isArray(gate.args)) return { sql: `${GATE_MARK} 0=1`, args: [] };
    if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (gate.scope === "DENY") return { sql: `${GATE_MARK} 0=1`, args: [] };
    return { sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_id = ${col} AND (${gate.sql})))`,
             args: gate.args };
  }

  /* ---------------------------------------------------------------- R45: this module's tables, at every boot */

  /** R45 (N343; membership's R57–R59 pattern): the host calls it in its boot, after the schema pass. The columns an
   *  older store lacks are added first (`BIAS_ADDITIVE_COLUMNS`, where the table exists), then every table and index
   *  of this module's own schema text is created where absent. A column added here is never filled for a row already
   *  held: a debt settled before `settled_kind` was kept reads its kind as undetermined (R36). Idempotent: a second
   *  call changes nothing. Answers the columns it added, `[table, column]`. */
  migrate() {
    const cols = (t) => this.#rows(`PRAGMA table_info(${t})`).map((r) => r.name);
    const added = [];
    for (const [table, column, decl] of BIAS_ADDITIVE_COLUMNS) {
      const have = cols(table);
      if (have.length && !have.includes(column)) {
        this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
        added.push([table, column]);
      }
    }
    const bare = BIAS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    return { ok: true, added };
  }

  /* ---------------------------------------------------------------- R8–R10: this module's share of a promotion */

  /** R9 (PL-12 / D-84, REC-176): A MALFORMED BIAS SET NEVER LANDS. Refused before any write, by the set's own
   *  checks (R1–R7) and not by a second reading of them; a replay is not judged, so the record's own history stays
   *  holdable verbatim. The document's type is asked as well as the envelope's (D-526), so a bias document under
   *  another envelope meets the refusal as it would correctly labelled. */
  promotionCheck(c) {
    if (!c || c.replay || (c.pkg && c.pkg.replay)) return null;
    const envelopeType = c.meta && typeof c.meta === "object" ? normalizeType(c.meta.object_type) : null;
    if (c.promotedType !== "bias" && envelopeType !== "bias") return null;
    const text = bundleMdText(c.files) ?? "";
    const fm = parseFrontmatter(text).data;
    /* DEC-49 REGION bias-set-refusal */
    const errs = checkBiasSet(fm, new Map([["bundle.md", text]])).filter((x) => x.severity === "error");
    if (!errs.length) return null;
    return this.#refuse("BIAS_REFUSED",
      "the bias set's statements were judged before anything was written, and at least one is not something the "
      + "record can honour. Nothing was written.", { findings: refusalFindings(errs) });
    /* END DEC-49 REGION bias-set-refusal */
  }

  /** R10: in the promotion's transaction, the bundle's statement rows are replaced by the promoted document's — the
   *  delete for every type, so a document that changes type leaves no projection standing, the insert only for
   *  `bias` — and a promotion to `adopted` RE-PINS every adoption of the bundle, instance and project alike, to the
   *  revision minted (REC-187), its source fields copied from the same bytes. The adopter and instant are the
   *  adoption's authored act and are not rewritten. */
  promotionProjection(c) {
    const bundleId = c && c.bundleId;
    if (!bundleId) return null;
    this.#sql.exec(`DELETE FROM bias_statements WHERE bundle_id=?`, bundleId);
    if (c.promotedType !== "bias") return null;
    const fm = parseFrontmatter(bundleMdText(c.files) ?? "").data || {};
    for (const r of statementRows(bundleId, fm))
      this.#sql.exec(
        `INSERT INTO bias_statements (bundle_id,ord,statement_id,kind,subject,text,justification,citations,locked,nullifies)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        r.bundle_id, r.ord, r.statement_id, r.kind, r.subject, r.text, r.justification, r.citations, r.locked, r.nullifies);
    if (c.promotedState === "adopted" && c.bundleSha)
      this.#sql.exec(
        `UPDATE bias_adoptions SET bundle_sha=?, source_url=?, retrieved=?, source_sha256=? WHERE bundle_id=?`,
        c.bundleSha, str(fm.policy_source), str(fm.policy_retrieved),
        str(fm.policy_sha256) ? str(fm.policy_sha256).toLowerCase() : null, bundleId);
    return null;
  }

  /* ---------------------------------------------------------------- R22, R23: the lens's inputs and its notice */

  /** R22: every input any lens is computed from — the number of adoptions and, for the first 1,000, each one's scope,
   *  project id, bundle, the bundle's head sha and its state. A TRIGGER, never a comparison of lenses. Synchronous. */
  lensFingerprint() {
    const n = this.#one(`SELECT count(*) AS n FROM bias_adoptions`).n;
    const rows = this.#rows(`SELECT scope_type AS t, scope_id AS s, bundle_id AS b FROM bias_adoptions
                              ORDER BY scope_type, scope_id, bundle_id LIMIT ?`, LENS_FINGERPRINT_MAX);
    return JSON.stringify([n, ...rows.map((r) => {
      const h = this.#record.head(r.b);
      return [r.t, r.s, r.b, h ? h.bundleSha ?? null : null, h ? h.currentState ?? null : null];
    })]);
  }

  /** R23: a later module's notice that a lens may have moved, once per successful adoption and per promotion that
   *  moves a bias set's head, after the write. A second registration by one module is refused. */
  onLensChange(module, fn) {
    /* N202: the refusals are membership's one site (its R81). */
    const refused = listenerRefusal(this.#lensListeners, module, fn);
    if (refused) return refused;
    this.#lensListeners.push({ module, fn });
    return { ok: true, module };
  }

  /* Each listener once, in the modules' total order (membership R83; a module not in it after, by name); one that
     throws or rejects changes nothing the act wrote and no other listener's notice. */
  #notify() {
    const at = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? MODULE_ORDER.length : i; };
    const ordered = [...this.#lensListeners].sort((x, y) => at(x.module) - at(y.module)
      || (x.module < y.module ? -1 : x.module > y.module ? 1 : 0));
    const runs = ordered.map((l) => {
      try { return Promise.resolve(l.fn()).catch(() => null); } catch { return null; }
    });
    this.#notices = Promise.all([this.#notices, ...runs]).then(() => undefined);
    return this.#notices;
  }

  /** Settles when every lens notice sent so far has been delivered (the op awaits it, so an adoption's arm lands
   *  inside the request that made it). */
  noticesDelivered() { return this.#notices; }

  /* promotion R45: after a promotion has committed. A bias set's promotion, or one of a bundle an adoption names. */
  committed({ bundleId, type } = {}) {
    if (type === "bias" || (bundleId && this.#one(`SELECT 1 AS x FROM bias_adoptions WHERE bundle_id=? LIMIT 1`, bundleId)))
      return this.#notify();
    return null;
  }

  /* ---------------------------------------------------------------- R11, R12: the adoption */

  /** op=biasadopt — THE AUTHORED ACT, and the PIN taken at the same instant (DEC-54 (c), (d)).
   *  `author` is the control plane's stamp from the session; a machine credential carries none and is refused by
   *  name (C-26.9). The state machine carries the other half: a set reaches `adopted` only through `proposed`, by a
   *  member-authored promotion, and the manifest requires BOTH this row AND its pinned revision at `adopted` before
   *  it reports a lens in force. A project's lens is its owners' act (REC-134, DEC-72 clause 5); the instance's is
   *  its administrators' (K102: "Admins define instance bias"). */
  biasAdopt({ bundleId = null, scope = "instance", scopeId = "", reason = null, author = null, at = null,
              identity = null, viewer = null } = {}) {
    const who = typeof author === "string" ? author.trim() : "";
    if (!who || who.startsWith(MACHINE_AUTHOR_PREFIX))
      return this.#refuse("BIAS_ADOPTION_NOT_AUTHORED",
        "op=biasadopt is signed by the member adopting the set. The plane takes the name from the "
        + "session and never from the request, so there is no name here to record.");
    if (!bundleId)
      return this.#refuse("BIAS_ADOPTION_NOT_PROPOSED",
        "op=biasadopt names the bias record being adopted: pass bundleId=<BIAS-...>.");
    const h = this.#record.head(String(bundleId));
    if (!h || normalizeType(h.type) !== "bias" || !["proposed", "adopted"].includes(h.currentState))
      return this.#refuse("BIAS_ADOPTION_NOT_PROPOSED",
        `${bundleId} is ${!h ? "not in the record" : `a ${normalizeType(h.type)} in state '${h.currentState}'`}. `
        + "A bias set is written in draft, offered as proposed, and only then adopted.");

    const st = String(scope) === "project" ? "project" : "instance";
    const sid = st === "project" ? String(scopeId || "").trim() : "";
    if (st === "project" && !sid)
      return this.#refuse("BIAS_ADOPTION_NOT_PROPOSED",
        "a project-scoped adoption names the project it is scoped to: pass scopeId=<PROJ-...>.");
    if (st === "project") {
      /* REC-149: sight is the viewer's question (C-70.1 at existence), position the identity's. */
      const existence = this.#membership.existenceAct(sid, viewer);
      if (existence) return existence;
      const denied = this.#membership.projectAuthority(sid, identity, "owner", "biasadopt");
      if (denied) return denied;
    } else if ((typeof identity === "string" && identity) || (typeof viewer === "string" && viewer)) {
      /* K102 (R11): the instance's lens is its administrators' act. An internal caller, who stamps neither, is not
         asked, as at every positional act. */
      const member = this.#membership.positionalMember(viewer, identity);
      /* N327 (DEC-83): membership's one answer to this condition (its R84, C-96.1), with this act's next step. */
      if (!member || !this.#membership.isAdministrator(member))
        return notAnAdmin(member, INSTANCE_ADOPTION_ACT, { remedy: INSTANCE_ADOPTION_REMEDY, scope: "instance" });
    }
    /* DEC-88 (R11, C-26.21): the adopter's reason, asked last and before anything is read or written, on a
       re-adoption too. Kept trimmed; its bound is on what is kept. */
    const why = typeof reason === "string" ? reason.trim() : "";
    if (!why)
      return this.#refuse("BIAS_ADOPTION_NO_REASON",
        "op=biasadopt carries the adopter's reason for adopting this lens: pass reason=<why>. Nothing was adopted.");
    if (why.length > BIAS_ADOPTION_REASON_MAX)
      return this.#refuse("BIAS_ADOPTION_NO_REASON",
        `the reason is ${why.length} characters and an adoption keeps at most ${BIAS_ADOPTION_REASON_MAX}. `
        + "Nothing was adopted.", { limit: BIAS_ADOPTION_REASON_MAX, length: why.length });

    /* DEC-54 (d)'s pin, read from the DOCUMENT rather than the request, so a caller cannot claim a provenance the
       bundle does not carry. Absent is NULL, the honest value for a natively authored set. */
    const md = this.#record.readFile(String(bundleId), "bundle.md");
    const fm = md && typeof md.text === "string" ? (parseFrontmatter(md.text).data || {}) : {};
    const now = at ? String(at) : stampInstant("second");
    this.#sql.exec(
      `INSERT OR REPLACE INTO bias_adoptions
         (scope_type, scope_id, bundle_id, bundle_sha, author, at, source_url, retrieved, source_sha256, reason)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      st, sid, String(bundleId), h.bundleSha, who, now, str(fm.policy_source), str(fm.policy_retrieved),
      str(fm.policy_sha256) ? str(fm.policy_sha256).toLowerCase() : null, why);
    this.#notify();

    return { ok: true, adopted: true, bundleId: String(bundleId),
             scope: st, scope_id: sid, author: who, at: now, reason: why,
             pinned: { bundle_sha: h.bundleSha,
                       source_url: str(fm.policy_source), retrieved: str(fm.policy_retrieved),
                       source_sha256: str(fm.policy_sha256) ? str(fm.policy_sha256).toLowerCase() : null },
             /* Stated rather than implied: the row exists, and the lens is in force only once the revision the pin
                names stands at `adopted`. */
             in_force: h.currentState === "adopted",
             /* REC-210: a fact about the pin, not a second spelling of `in_force` — they come apart at the read. */
             pins_proposed: h.currentState === "proposed",
             note: h.currentState === "adopted"
               ? word("bias.note.set_force_scope")
               : "PINS A PROPOSED REVISION: this adoption froze bytes the team has offered and not "
                 + "yet accepted, so it REPLACES this scope's lens with them rather than "
                 + "pre-authorising whatever the proposal becomes; a lens is in force once the "
                 + "revision THIS ROW PINS stands at 'adopted', which is a member-authored "
                 + "transition through op=promote" };
  }

  /* ---------------------------------------------------------------- R13–R18, R24, R25: the manifest */

  /* R13–R17: THE EFFECTIVE SET for a scope, as the viewer may see it — the one computation R18's manifest pages and
     R49's question asks of. `{answer}` where R13–R15 answer without a lens (not seen, undetermined, none in force);
     else the whole ordered set, its hash, and what the manifest prints beside it. */
  #lens(st, sid, viewer) {
    if (st === "project" && (!sid || !this.#membership.inSight(sid, viewer)))
      return { answer: { ok: true, scope: st, scope_id: sid, in_force: false,
               bundles: [], statements: [], residue: [], lock_violations: [],
               statements_sha: null, count: 0, total: 0, limit: 0, offset: 0, truncated: false,
               stated: word("bias.manifest_force") } };

    const seen = Bias.#gate("a.bundle_id", viewer);
    const pinned = new Map();          // bundle id -> the pinned revision's front matter
    const pinnedText = new Map();
    const unresolved = [];
    const pinsProposed = [];
    const adoptionsFor = (type, id) => {
      const out = [];
      const rows = this.#rows(
        `SELECT a.*, b.current_state AS state
           FROM bias_adoptions a JOIN bundles b ON b.bundle_id = a.bundle_id
          WHERE a.scope_type = ? AND a.scope_id = ? AND b.current_state <> 'retired' AND (${seen.sql})
          ORDER BY a.bundle_id`, type, id, ...seen.args);
      for (const a of rows) {
        const text = this.#record.textAtSha(a.bundle_id, a.bundle_sha);   // record-core R60 (N207)
        if (text === null) { unresolved.push({ bundle_id: a.bundle_id, revision: a.bundle_sha, scope: a.scope_type }); continue; }
        const fm = parseFrontmatter(text).data || {};
        if (fm.current_state !== "adopted") {
          /* REC-210: recorded, not dropped; the pinned revision's own state is carried, never assumed. */
          const pinnedState = fm.current_state;
          pinsProposed.push({ bundle_id: a.bundle_id, revision: a.bundle_sha, scope: a.scope_type,
                              pinned_state: typeof pinnedState === "string" ? pinnedState : null,
                              adopted_by: a.author, adopted_at: a.at });
          continue;
        }
        pinned.set(a.bundle_id, fm);
        pinnedText.set(a.bundle_id, text);
        out.push(a);
      }
      return out;
    };

    const instanceAdoptions = adoptionsFor("instance", "");
    const projectAdoptions = st === "project" ? adoptionsFor("project", sid) : [];
    const adoptions = [...instanceAdoptions, ...projectAdoptions];
    const marker = pinsProposed.length === 0 ? {} : {
      pins_proposed: pinsProposed,
      pins_proposed_stated:
        localize("bias.index.each_entry_is_an_adoption_whose",
                 "each entry is an adoption whose PINNED REVISION is one the team has offered and not accepted: the member's act REPLACED that scope's lens with those bytes and is not a pre-authorisation of whatever the proposal becomes (BOB #32, 2026-09-24), and such a pin puts no lens in force until the revision it names stands at 'adopted'"),
    };

    if (unresolved.length > 0)
      return { answer: { ok: true, scope: st, scope_id: sid, in_force: null,
               bundles: [], statements: [], residue: [], lock_violations: [],
               statements_sha: null, unresolved_pins: unresolved, ...marker,
               count: 0, total: 0, limit: 0, offset: 0, truncated: false,
               stated: localize("bias.index.undetermined_adoption_pins_revision",
                     "undetermined: an adoption pins a revision whose bytes this record cannot produce, so which statements are in force cannot be computed") } };

    if (adoptions.length === 0)
      return { answer: { ok: true, scope: st, scope_id: sid, in_force: false,
               bundles: [], statements: [], residue: [], lock_violations: [],
               statements_sha: null, ...marker,
               count: 0, total: 0, limit: 0, offset: 0, truncated: false,
               stated: word("bias.manifest_force") } };

    /* The instance layer first, keyed by statement id so a project override can find what it names. */
    const effective = new Map();
    const level = new Map();
    for (const a of instanceAdoptions)
      for (const s of statementRows(a.bundle_id, pinned.get(a.bundle_id))) {
        effective.set(s.statement_id, s);
        level.set(s.statement_id, { bundle_id: a.bundle_id, scope: "instance", locked: s.locked === 1 });
      }

    /* Then the project layer: nullifications of UNLOCKED statements, then replacements and additions. */
    const lockViolations = [];
    for (const a of projectAdoptions)
      for (const s of statementRows(a.bundle_id, pinned.get(a.bundle_id))) {
        if (s.nullifies) {
          const target = level.get(s.nullifies);
          if (target && target.locked) {
            lockViolations.push({ project_bundle: a.bundle_id, statement_id: s.statement_id,
                                  nullifies: s.nullifies, instance_bundle: target.bundle_id,
                                  detail: localize("bias.index.a_project_override_naming_locked",
                                                   "a project override naming a LOCKED team statement is a conformance error; the team statement stands") });
          } else if (target) {
            effective.delete(s.nullifies);
            level.delete(s.nullifies);
          }
        }
        if (s.text && s.text.trim()) {
          effective.set(s.statement_id, s);
          level.set(s.statement_id, { bundle_id: a.bundle_id, scope: "project", locked: false });
        }
      }

    /* THE ORDER IS TOTAL AND DERIVED (R16), field by field, never insertion order. */
    const all = [...effective.values()]
      .map((s) => ({
        statement_id: s.statement_id,
        bundle_id: s.bundle_id,
        scope: level.get(s.statement_id)?.scope ?? "instance",
        kind: s.kind, subject: s.subject, text: s.text,
        justification: s.justification,
        citations: s.citations ? (safeJson(s.citations) ?? []) : [],
        locked: s.locked === 1,
        nullifies: s.nullifies ?? null,
      }))
      .sort((x, y) => x.bundle_id.localeCompare(y.bundle_id) || x.statement_id.localeCompare(y.statement_id));

    /* R17: over the WHOLE set and the fields that change meaning, before any paging. */
    const statementsSha = sha256Hex(JSON.stringify(
      all.map((s) => [s.bundle_id, s.statement_id, s.kind, s.subject, s.text, s.justification, s.locked])));
    return { adoptions, all, statementsSha, pinnedText, lockViolations, marker };
  }

  /** op=biasmanifest — THE EFFECTIVE SET IN FORCE, its hash, and its residue. Effective bias = the adopted instance
   *  statements at pinned revisions, minus project nullifications of unlocked statements, plus project replacements
   *  and additions. The hash is over the WHOLE set, never the page (R17). A nullification of a LOCKED statement is
   *  refused its effect and reported. Absence is stated: "no manifest was in force", never an empty lens.
   *  SYNCHRONOUS, so a transaction may call it (the case document's stamp, REC-126's review copy). */
  biasManifest({ scope = "instance", scopeId = "", viewer = null, limit = null, offset = 0 } = {}) {
    const st = String(scope) === "project" ? "project" : "instance";
    const sid = st === "project" ? String(scopeId || "").trim() : "";
    const lens = this.#lens(st, sid, viewer);
    if (lens.answer) return lens.answer;
    const { adoptions, all, statementsSha, pinnedText, lockViolations, marker } = lens;

    /* R18, DEC-54 (b): the residue travels with the manifest, read from each PINNED revision's own section. */
    const residue = adoptions.map((a) => {
      const m = RESIDUE_SECTION.exec("\n" + (pinnedText.get(a.bundle_id) ?? ""));
      return { bundle_id: a.bundle_id, scope: a.scope_type, text: m ? m[1].trim() : "", stated: !!(m && m[1].trim()) };
    });

    /* R24 (safeguard 3): a project statement in force on a subject a group statement in force also addresses,
       naming no statement it overrides, is an INTERACTION, listed with both justifications so a reviewer reads the
       one against the other. Nothing is refused (R28). */
    const instanceBySubject = new Map();
    for (const s of all) if (s.scope === "instance") {
      if (!instanceBySubject.has(s.subject)) instanceBySubject.set(s.subject, []);
      instanceBySubject.get(s.subject).push(s);
    }
    const interactions = all
      .filter((s) => s.scope === "project" && !s.nullifies && instanceBySubject.has(s.subject))
      .map((s) => ({ statement_id: s.statement_id, bundle_id: s.bundle_id, subject: s.subject,
                     justification: s.justification,
                     instance: instanceBySubject.get(s.subject).map((i) => ({
                       statement_id: i.statement_id, bundle_id: i.bundle_id, justification: i.justification })) }));
    /* R25 (safeguard 4): a statement whose subject the registry does not hold, listed for the same review. Without a
       registry to ask it is undetermined, and said so. */
    const registry = this.#entities;
    let unregistered = null;
    if (registry) {
      unregistered = [];
      for (const s of all) {
        let held;
        try { held = registry.has(s.subject) === true; } catch { held = null; }
        if (held === null) { unregistered = null; break; }
        if (!held) unregistered.push({ statement_id: s.statement_id, bundle_id: s.bundle_id, scope: s.scope,
                                       subject: s.subject });
      }
    }

    const cap = Math.max(1, Math.min(BIAS_MANIFEST_LIMIT_MAX, Math.floor(Number(limit) || BIAS_MANIFEST_LIMIT_DEFAULT)));
    const from = Math.max(0, Math.floor(Number(offset) || 0));
    const page = all.slice(from, from + cap);

    return {
      ok: true,
      scope: st, scope_id: sid,
      in_force: true,
      bundles: adoptions.map((a) => ({
        bundle_id: a.bundle_id, revision: a.bundle_sha, scope: a.scope_type,
        adopted_by: a.author, adopted_at: a.at,
        source_url: a.source_url ?? null, retrieved: a.retrieved ?? null, source_sha256: a.source_sha256 ?? null,
      })),
      statements_sha: statementsSha,
      statements_sha_covers: word("bias.whole_effective_set"),
      ...marker,
      statements: page,
      residue,
      lock_violations: lockViolations,
      interactions,
      interactions_stated: word("bias.entry_project_statement"),
      unregistered_subjects: unregistered,
      unregistered_subjects_stated: unregistered === null
        ? word("bias.undetermined_subject_registry")
        : word("bias.entry_statement_force"),
      count: page.length, total: all.length,
      limit: cap, offset: from,
      truncated: from + page.length < all.length,
    };
  }

  /* ---------------------------------------------------------------- R49: one statement, in force or not */

  /** R49 (D59; T41-12) — IS THIS STATEMENT IN THE LENS IN FORCE FOR THIS SCOPE? The question a recorded bias
   *  application asks before it is honoured (`inquiry-grammar` R18 at a leg, `basis-versions` R48 at a conclusion,
   *  `case-disclosures` R30–R31 at a case's account). It asks R16's effective set — the WHOLE set, never a page — at
   *  R13's and R14's sight, by the statement id that set is keyed by (unique within a lens: a project statement of the
   *  same id replaces the group's). `scope` is `"instance"` (or `{type: "instance"}`) or `{type: "project", id}`, the
   *  context shape R33 reads. In force: the statement's kind and text, its bundle, its level (`group` or `project`,
   *  DEC-149), whether it is locked, and R17's hash of the lens it was found in, so a caller can record which lens it
   *  checked against. Not in force — no such id, no lens in force, or a project the viewer may not see, answered
   *  identically (R13) — `in_force: false`; an adoption whose pinned bytes cannot be read (R14), `in_force: null`.
   *  SYNCHRONOUS, so a transaction may call it; writes nothing; never throws. */
  statementInForce({ statement = null, scope = "instance", viewer = null } = {}) {
    const isProject = isObj(scope) ? scope.type === "project" : scope === "project";
    const sid = isProject && isObj(scope) && typeof scope.id === "string" ? scope.id.trim() : "";
    const where = { type: isProject ? "project" : "instance", id: sid };
    const id = typeof statement === "string" ? statement.trim() : "";
    const absent = (inForce, stated, sha = null) => ({
      ok: true, statement: id || null, scope: where, in_force: inForce, kind: null, text: null, bundle_id: null,
      level: null, locked: null, statements_sha: sha, stated });
    try {
      if (!id) return absent(false, "no statement id was named, so none is in force");
      const lens = this.#lens(where.type, sid, viewer);
      if (lens.answer) return lens.answer.in_force === null
        ? absent(null, "undetermined: an adoption pins a revision whose bytes this record cannot produce, so whether "
                     + "this statement is in force cannot be computed")
        : absent(false, "no lens is in force for this scope, so this statement is not in force");
      const s = lens.all.find((x) => x.statement_id === id);
      if (!s) return absent(false, "this statement is not in the lens in force for this scope", lens.statementsSha);
      return { ok: true, statement: id, scope: where, in_force: true, kind: s.kind, text: s.text, bundle_id: s.bundle_id,
               level: s.scope === "project" ? "project" : "group", locked: s.locked,
               statements_sha: lens.statementsSha,
               stated: word("bias.statement_lens_force") };
    } catch {
      return absent(null, "undetermined: the lens in force could not be read, so whether this statement is in force "
                        + "is not known");
    }
  }

  /* ---------------------------------------------------------------- R19–R21: the inhale */

  /** op=biasinhale — READING AN OUTSIDE POLICY. It proposes; it never installs (DEC-54 (a)–(c)). THERE IS NO WRITE IN
   *  THIS METHOD — no SQL, no transaction, no promotion. It never proposes kind=pattern: a reader of somebody else's
   *  policy holds no evidence in THIS record. The malformedness rule binds the machine exactly as a member (R31). */
  biasInhale({ policy = "", source = null, retrieved = null, adopt = false, limit = null } = {}) {
    if (adopt)
      return this.#refuse("BIAS_INHALE_CANNOT_ADOPT",
        "op=biasinhale reads a policy and returns a PROPOSAL. Adopting is op=biasadopt, signed by a "
        + "member — and only after the proposed set has been written into a bias record and offered.");

    const text = String(policy || "");
    const allSentences = text
      .split(/\n{2,}|(?<=[.;:])\s+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 12);
    const readSentences = allSentences.slice(0, BIAS_INHALE_SENTENCES_MAX);

    /* The cues, deliberately NARROW: a sentence that does not clearly do one of the two mechanisable things goes to
       the residue, the safe direction here. */
    const SCRUTINY = /\b(verify|verified|verification|corroborat\w+|cross-?check\w*|confirm\w*|reliab\w+|track record|motive|direct knowledge|first-?hand|vet\w*|scrutin\w+|authenticat\w+)\b/i;
    const INFERENCE = /\b(does not (mean|indicate|imply|constitute)|is not (evidence|an indication|proof|confirmation)|should not be (taken|read|treated|inferred)|do not (assume|infer)|cannot be inferred|must not be (taken|read) as)\b/i;
    const PATTERN_SHAPED = /\b(routinely|habitually|has a history of|repeatedly|consistently|typically|often)\b/i;

    const bars = [], statements = [], residue = [];
    let n = 0;
    for (const s of readSentences) {
      /* (a) THE SPLIT, FIRST: a bar is recognised before anything else. */
      if (BIAS_BAR_PHRASING.some((re) => re.test(s))) {
        bars.push({ text: s, construct: "required_strength",
                    detail: localize("bias.index.a_bar_how_strong_support", "a BAR — how strong support must be before you assert. It gates at pre-flight (DEC-17); declared as bias it would refuse nothing.") });
        continue;
      }
      if (BIAS_VERDICT_WHOLESALE.test(s) || BIAS_VERDICT_SPEAKER.some((re) => re.test(s))) {
        residue.push({ text: s, why: localize("bias.index.this_reads_as_a_verdict",
                                              "this reads as a verdict on a source, and declared bias may never issue verdicts — refused for the machine exactly as for a member"),
                       check: BIAS_CHECKS.BIAS_STATEMENT_ISSUES_A_VERDICT.check });
        continue;
      }
      if (INFERENCE.test(s)) {
        statements.push({ id: `prop-${++n}`, kind: "inference", subject: null, text: s,
                          justification: null, citations: [], proposed: true, authored: false });
        continue;
      }
      if (SCRUTINY.test(s) && !PATTERN_SHAPED.test(s)) {
        statements.push({ id: `prop-${++n}`, kind: "scrutiny", subject: null, text: s,
                          justification: null, citations: [], proposed: true, authored: false });
        continue;
      }
      residue.push({ text: s,
                     why: PATTERN_SHAPED.test(s)
                       ? localize("bias.index.this_is_a_claim_about", "this is a claim about how an organisation behaves, which is a PATTERN statement and must cite evidence in THIS record — evidence a reader of somebody else's policy does not have. It is left for a member to make, or not.")
                       : word("bias.why.states_property_bio"),
                     check: null });
    }

    const cap = Math.max(1, Math.min(BIAS_INHALE_LIMIT_MAX, Math.floor(Number(limit) || BIAS_INHALE_LIMIT_DEFAULT)));
    return {
      ok: true,
      installed: false, adopted: false, writes: 0,
      proposes: word("bias.member_writes_bias"),
      bars: bars.slice(0, cap), bars_count: bars.length,
      statements: statements.slice(0, cap), statements_count: statements.length,
      residue: residue.slice(0, cap), residue_count: residue.length,
      coverage: {
        sentences_read: readSentences.length,
        sentences_total: allSentences.length,
        input_truncated: allSentences.length > readSentences.length,
        input_limit: BIAS_INHALE_SENTENCES_MAX,
        mechanised: bars.length + statements.length,
        not_mechanised: residue.length,
        note: localize("bias.index.the_not_mechanised_list_is", "the not-mechanised list is the more important half: the extractable rules are the countable ones, and in four of five documented verification failures the countable rules were satisfied while the uncountable properties failed (DEC-54)."),
      },
      pin: { source_url: source ? String(source) : null, retrieved: retrieved ? String(retrieved) : null },
      limit: cap,
      truncated: bars.length > cap || statements.length > cap || residue.length > cap,
    };
  }

  /* ---------------------------------------------------------------- R48: the group's self-description as a draft */

  /* Who R48 offers the draft to: a member whose status is `active` (membership R68), or the founder, in either of
     R43's spellings, exactly while the instance is claimed (membership R64). Everyone else, a machine credential
     included, is answered as if no description were held. */
  #activeMember(viewer) {
    const v = typeof viewer === "string" ? viewer : "";
    if (v === "admin") return this.#membership.isAdministrator("admin");
    const id = this.#membership.positionalMember(v);
    if (!id) return false;
    if (id === "admin") return this.#membership.isAdministrator("admin");
    const facts = this.#membership.memberFacts(id);
    return !!facts && facts.status === "active";
  }

  /** R48 (DEC-132 (5); N551, K1541) — THE GROUP'S OWN WORDS, OFFERED AS WHERE A DECLARED BIAS MAY START. Where the
   *  group has a stake in what it investigates, its declared bias can start from what it wrote about itself
   *  (membership R110's latest record), and it stays the group's own act: this proposes no statement, subject or
   *  justification (R2–R7 are the member's to write) and moves nothing along R8's machine or R11's adoption. It
   *  writes nothing, installs and adopts nothing, never changes a lens in force, and never throws. A viewer who is
   *  not an active member is answered exactly as if no description were held, so the answer says nothing about
   *  whether one exists. */
  descriptionDraft({ viewer = null } = {}) {
    const none = {
      ok: true, description: null, offered: false, proposed: false, authored: false, statements: [],
      installed: false, adopted: false, writes: 0,
      stated: localize("bias.index.there_is_no_description_of",
            "there is no description of the team to start a declared bias from: a member writes the set's statements, each with its subject and justification, from the beginning"),
    };
    let d = null;
    try {
      if (!this.#activeMember(viewer)) return none;
      const got = this.#membership.groupDescription({ viewer });
      d = got && isObj(got.description) ? got.description : null;
    } catch { return none; }
    if (!d) return none;
    const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const description = {
      kinds: Array.isArray(d.kinds) ? d.kinds.filter((k) => typeof k === "string") : [],
      otherKind: text(d.otherKind), focus: text(d.focus), purpose: text(d.purpose),
      by: typeof d.by === "string" ? d.by : null, at: typeof d.at === "string" ? d.at : null,
    };
    return {
      ok: true, description, offered: true, proposed: true, authored: false, statements: [],
      installed: false, adopted: false, writes: 0,
      label: word("bias.label.group_wrote_itself"),
      offers: word("bias.opening_text_new"),
      stated: word("bias.group_description_itself"),
    };
  }

  /* ---------------------------------------------------------------- R33–R41: the bias debt */

  /** R33: a later module's work products, by kind. `source` is `{list(after, limit) → keys in ascending order
   *  (synchronous), read(key) → Promise<null | {context: {type, id}, principal, lens: {basis, statements_sha} | null,
   *  ranUnder, rerunOf}>, visible(key, viewer) → Promise<boolean>}`: `lens` is the lens recorded when the work began
   *  (null when it was not recorded), `ranUnder` the lens it ran under, `rerunOf` the work product it re-makes. */
  registerWorkProducts(kind, source) {
    if (typeof kind !== "string" || !kind || !source || typeof source.list !== "function"
        || typeof source.read !== "function" || typeof source.visible !== "function")
      return { ok: false, reason: "WORK_PRODUCTS_MALFORMED",
               detail: "a registration names its kind and gives list, read and visible" };
    if (this.#sources.some((s) => s.kind === kind))
      return { ok: false, reason: "WORK_PRODUCTS_DECLARED", kind, detail: `work products of kind ${kind} are already registered` };
    this.#sources.push({ kind, source });
    return { ok: true, kind };
  }

  #delayMs() {
    const raw = this.#env.BIAS_DEBT_DELAY_MS;
    const v = raw === null || raw === undefined || String(raw).trim() === "" ? NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : BIAS_DEBT_DELAY_MS;
  }

  #batch() {
    const raw = this.#env.BIAS_DEBT_BATCH;
    const v = raw === null || raw === undefined || String(raw).trim() === "" ? NaN : Math.floor(Number(raw));
    return Number.isFinite(v) && v >= 1 ? Math.min(v, 500) : BIAS_DEBT_BATCH;
  }

  /* R41: pending while a work product is registered and the lens inputs differ from the last COMPLETE sweep's, or,
     with no sweep yet complete, while any adoption is held. */
  #pending() {
    if (!this.#sources.some(({ source }) => (source.list("", 1) || []).length > 0)) return false;
    const st = this.#one(`SELECT fingerprint FROM bias_debt_sweeps WHERE k = 'lens'`);
    if (!st || st.fingerprint === null) return !!this.#one(`SELECT 1 AS x FROM bias_adoptions LIMIT 1`);
    return st.fingerprint !== this.lensFingerprint();
  }

  /** R41: `now` while the sweep is pending, else null. Synchronous; writes nothing; never throws. */
  biasDebtDue(now) {
    try { return this.#pending() ? now : null; } catch { return null; }
  }

  /** R41: `now` plus the sweep delay while the sweep is pending, else null. Synchronous; writes nothing; never throws. */
  biasDebtWake(now) {
    try { return this.#pending() ? Number(now) + this.#delayMs() : null; } catch { return null; }
  }

  /* R33: the lens now in force for a work product's context, read as the machine viewer (`BIAS_DEBT_VIEWER`): a project's scope for
     work over a project, the instance's otherwise. `{sha}` (null when none is in force), or `{undetermined: true}`. */
  #lensNow(context) {
    const project = context && context.type === "project" && context.id;
    const m = this.biasManifest({ scope: project ? "project" : "instance", scopeId: project ? String(context.id) : "",
                                  viewer: BIAS_DEBT_VIEWER, limit: 1 });
    if (m.in_force === null) return { undetermined: true };
    return { sha: m.in_force === true && typeof m.statements_sha === "string" ? m.statements_sha : null };
  }

  /* R34: the work product's member principal and the owners of a project context (at most 50, by id), each active
     and able to read the work product. */
  async #recipients(source, key, wp) {
    const cands = new Set();
    if (typeof wp.principal === "string" && wp.principal) cands.add(wp.principal);
    if (wp.context && wp.context.type === "project" && wp.context.id)
      for (const id of [...this.#membership.projectOwners(String(wp.context.id))].sort().slice(0, BIAS_DEBT_OWNERS_MAX))
        cands.add(id);
    const out = [];
    for (const id of [...cands].sort()) {
      const facts = this.#membership.memberFacts(id);
      if (!facts || facts.status !== "active") continue;
      if (await source.visible(key, `member:${id}`) === true) out.push(id);
    }
    return out;
  }

  /* The next page of work products after the cursor, across the registered kinds in registration order, at most
     `n`. A cursor is `<kind>\t<key>`; one with no kind (written before kinds existed) is the first kind's. */
  #page(cursor, n) {
    const tab = cursor.indexOf("\t");
    let at = 0, after = "";
    if (cursor) {
      const kind = tab === -1 ? (this.#sources[0] && this.#sources[0].kind) : cursor.slice(0, tab);
      at = Math.max(0, this.#sources.findIndex((s) => s.kind === kind));
      after = tab === -1 ? cursor : cursor.slice(tab + 1);
    }
    const out = [];
    for (let i = at; i < this.#sources.length && out.length < n; i++) {
      const { kind, source } = this.#sources[i];
      for (const key of source.list(i === at ? after : "", n - out.length) || []) out.push({ kind, source, key: String(key) });
    }
    return out;
  }

  /** R33, R37, R39 — THE SWEEP (D-86). Due only while the lens has moved since the last complete sweep; a batch of
   *  work products per tick (50 by default), resuming from a cursor, restarted from the top when the lens moves
   *  again. For each: moved raises a debt or restates a changed one; a debt settled by an authored act over the
   *  same lens delta stays settled (REC-207); not moved settles an open debt as `lens_returned`; undetermined raises
   *  and clears nothing. Idempotent by the work product's key. Nothing is refused anywhere (R28).
   *  `rank` (N224) is the scheduler's (its R10, `rank(items, now)` answering the items reordered): the batch is read,
   *  each work product offered as `{kind: "bundle", id: its context id, waitingSince: when it was registered}`, and
   *  compared in the rank's order. Without it, or when it fails, the order is the cursor's. The cursor, the batch
   *  size and what each comparison raises or settles do not depend on the order. */
  async biasDebtSweep(nowMs, rank = null) {
    const at = stampInstant("second", Number(nowMs));
    const cap = this.#batch();
    const fp = this.lensFingerprint();
    const st = this.#one(`SELECT fingerprint, target, cursor FROM bias_debt_sweeps WHERE k = 'lens'`);
    const from = st && st.target === fp ? String(st.cursor || "") : "";
    const items = this.#page(from, cap + 1);
    const batch = items.slice(0, cap);
    const out = { read: 0, raised: [], restated: [], cleared: [], held: [], undetermined: [], unchanged: 0,
                  complete: items.length <= cap, batch: cap };
    const read = [];
    for (const item of batch) read.push({ ...item, wp: await item.source.read(item.key) });
    for (const { source, key, wp } of Bias.#ranked(read, rank, Number(nowMs))) {
      out.read++;
      const lens = wp && isObj(wp.lens) ? wp.lens : null;
      const now = wp && lens ? this.#lensNow(wp.context) : { undetermined: true };
      const then = lens && typeof lens.statements_sha === "string" ? lens.statements_sha : null;
      const moved = !lens || now.undetermined || (lens.basis !== "at_open" && (then === null || now.sha === null))
        ? null : then !== now.sha;
      const prior = this.#one(`SELECT * FROM bias_debts WHERE run = ?`, key);
      if (moved === true) {
        const recipients = JSON.stringify(await this.#recipients(source, key, wp));
        const basis = typeof lens.basis === "string" ? lens.basis : null;
        if (!prior) {
          this.#sql.exec(
            `INSERT INTO bias_debts (run, context_type, context_id, moved_basis, lens_then, lens_now, recipients,
                                     raised, observed, cleared_at)
             VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
            key, String(wp.context?.type ?? ""), String(wp.context?.id ?? ""), basis, then, now.sha, recipients, at, at);
          out.raised.push(key);
        } else if (prior.cleared_at != null && SETTLED_BY_AN_ACT.has(prior.settled_kind)
                   && prior.lens_now === now.sha && prior.lens_then === then) {
          /* REC-207: settled by an authored act over exactly this lens delta, so it stays settled; the recipients
             are refreshed without re-opening. */
          if (prior.recipients !== recipients)
            this.#sql.exec(`UPDATE bias_debts SET recipients = ?, observed = ? WHERE run = ?`, recipients, at, key);
          out.held.push(key);
        } else if (prior.cleared_at != null || prior.lens_now !== now.sha || prior.lens_then !== then
                   || prior.recipients !== recipients) {
          /* A cleared debt that moves again is NEW debt and ages from now; a live one restated keeps its age. */
          this.#sql.exec(
            `UPDATE bias_debts SET moved_basis = ?, lens_then = ?, lens_now = ?, recipients = ?, observed = ?,
                    raised = CASE WHEN cleared_at IS NULL THEN raised ELSE ? END, cleared_at = NULL,
                    settled_kind = NULL
              WHERE run = ?`,
            basis, then, now.sha, recipients, at, at, key);
          out.restated.push(key);
        } else out.unchanged++;
      } else if (moved === false) {
        if (prior && prior.cleared_at == null) {
          this.#settle({ run: key, kind: "lens_returned", at, lensThen: prior.lens_then, lensNow: prior.lens_now });
          out.cleared.push(key);
        } else out.unchanged++;
      } else out.undetermined.push(key);
    }
    const last = batch.length ? `${batch[batch.length - 1].kind}\t${batch[batch.length - 1].key}` : "";
    this.#sql.exec(
      `INSERT INTO bias_debt_sweeps (k, fingerprint, target, cursor, at) VALUES ('lens', ?, ?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET fingerprint = excluded.fingerprint, target = excluded.target,
                                    cursor = excluded.cursor, at = excluded.at`,
      out.complete ? fp : (st ? st.fingerprint : null), fp, out.complete ? "" : last, at);
    return out;
  }

  /* N224: the batch in the rank's order. Each item carries its place under a symbol, which the rank's copies keep
     (`{...x}`) and its shape does not show; an item the rank drops or cannot place follows in the cursor's order. */
  static #ranked(read, rank, now) {
    if (typeof rank !== "function" || read.length < 2) return read;
    const PLACE = Symbol("place");
    const items = read.map((r, i) => ({ kind: "bundle", id: r.wp && r.wp.context && r.wp.context.id != null
      ? String(r.wp.context.id) : null, waitingSince: Bias.#instantMs(r.wp && r.wp.registered), [PLACE]: i }));
    let answer;
    try { answer = rank(items, now); } catch { return read; }
    if (!Array.isArray(answer)) return read;
    const order = [], taken = new Set();
    for (const x of answer) {
      const i = x && typeof x === "object" ? x[PLACE] : undefined;
      if (Number.isInteger(i) && !taken.has(i)) { taken.add(i); order.push(read[i]); }
    }
    for (let i = 0; i < read.length; i++) if (!taken.has(i)) order.push(read[i]);
    return order;
  }

  /* An instant as ms since the epoch: a finite number, or a parseable date string; else null. */
  static #instantMs(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim()) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
    return null;
  }

  /* R37: THE ONE WRITER OF A SETTLEMENT. Every act that settles a debt appends its row here and stamps the debt from
     the same values, so the append-only record and the debt's state cannot disagree about which act closed it. */
  #settle({ run, kind, at, actor = null, reason = null, byRun = null, lensThen = null, lensNow = null }) {
    this.#sql.exec(
      `INSERT INTO bias_debt_settlements (run, kind, at, actor, reason, by_run, lens_then, lens_now)
       VALUES (?,?,?,?,?,?,?,?)`, run, kind, at, actor, reason, byRun, lensThen, lensNow);
    this.#sql.exec(`UPDATE bias_debts SET cleared_at = ?, settled_kind = ?, observed = ? WHERE run = ?`, at, kind, at, run);
    return { run, kind, at, actor, reason, by_run: byRun, lens_then: lensThen, lens_now: lensNow };
  }

  #settlements(run, limit) {
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || BIAS_DEBT_SETTLEMENTS_MAX), BIAS_DEBT_SETTLEMENTS_MAX));
    const rows = this.#rows(
      `SELECT seq, kind, at, actor, reason, by_run, lens_then, lens_now
         FROM bias_debt_settlements WHERE run = ? ORDER BY seq LIMIT ?`, run, cap + 1);
    return { settlements: rows.slice(0, cap).map((r) => ({
               seq: r.seq, kind: r.kind, at: r.at, actor: r.actor ?? null, reason: r.reason ?? null,
               by_run: r.by_run ?? null, lens_then: r.lens_then ?? null, lens_now: r.lens_now ?? null })),
             limit: cap, truncated: rows.length > cap };
  }

  /* A settled debt with no recorded kind was settled before the record kept which act settled it: undetermined,
     never attributed to an act nobody recorded. */
  static #settledView(row) {
    if (row.cleared_at == null) return { settled: false };
    if (row.settled_kind == null)
      return { settled: true, at: row.cleared_at, kind: null, kind_state: "undetermined",
               stated: localize("bias.index.this_debt_was_settled_before",
                     "this debt was settled before the record kept which act settled it. The only act there was then is the lens moving back, and naming it here would be attributing the settlement to an act nobody recorded") };
    return { settled: true, at: row.cleared_at, kind: row.settled_kind, kind_state: "determined" };
  }

  /** R35 — op=biasdebtresolve: A MEMBER'S RESOLVE, WITH A REQUIRED STATED REASON (BOB #32's third act). The four
   *  conditions about the ACT are asked before the record is read, so a caller who may not see the work learns
   *  nothing from the order of the answers; a debt this viewer may not see answers exactly as one never raised. */
  biasDebtResolve({ run = null, reason = null, actor = null, viewer = null, at = null } = {}) {
    const refusal = (code, detail, extra = {}) => {
      const row = BIAS_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
    };
    const id = String(run ?? "").trim();
    const who = String(actor ?? "").trim();
    const said = typeof reason === "string" ? reason.trim() : "";
    /* DEC-49 REGION is-bias-debt-resolve-shape */
    if (!id)
      return refusal("BIAS_DEBT_NO_RUN",
        "a bias debt is keyed by the work it is about, so the act has to name it");
    if (!who)
      return refusal("BIAS_DEBT_NO_ACTOR",
        "a resolution is recorded under the member who made it, and there is no member on this call");
    if (isMachineStamp(who))
      return refusal("BIAS_DEBT_MACHINE_CANNOT_RESOLVE",
        localize("bias.index.settling_bias_debt_is_a",
                 "settling a bias debt is a judgement that the lens change does not bear on the finding, and that is a named member's judgement (DEC-24: derived informs, authored binds). A machine credential may raise the obligation, surface it and prepare what it needs, and may not answer it"));
    if (!said)
      return refusal("BIAS_DEBT_NO_REASON",
        "this act settles an obligation the record raised, and the whole of what it records is the "
        + "member's stated ground for settling it. Without the reason the row would say that somebody "
        + "decided and not what they decided");
    if (said.length > BIAS_DEBT_REASON_MAX)
      return refusal("BIAS_DEBT_REASON_TOO_LONG",
        `the stated reason is ${said.length} characters and this record holds at most ${BIAS_DEBT_REASON_MAX}`,
        { limit: BIAS_DEBT_REASON_MAX, length: said.length });
    /* END DEC-49 REGION is-bias-debt-resolve-shape */
    const seen = Bias.#gate("bd.context_id", viewer);
    const row = this.#one(`SELECT bd.* FROM bias_debts bd WHERE bd.run = ? AND (${seen.sql})`, id, ...seen.args);
    /* DEC-49 REGION is-bias-debt-resolve-subject */
    if (!row)
      return refusal("BIAS_DEBT_NO_SUCH_DEBT",
        "no open bias debt stands against this work here: it either never carried one, it has already been "
        + "settled, or this reader cannot open the work it is about", { run: id });
    if (row.cleared_at != null)
      return refusal("BIAS_DEBT_ALREADY_SETTLED",
        "this obligation has already been settled, and a settlement is appended rather than replaced",
        { run: id, settled: Bias.#settledView(row) });
    /* END DEC-49 REGION is-bias-debt-resolve-subject */
    const when = at && ISO_INSTANT.test(at) ? at : stampInstant("second");
    const settled = this.#settle({ run: id, kind: "resolved", at: when, actor: who, reason: said,
                                   lensThen: row.lens_then, lensNow: row.lens_now });
    return { ok: true, run: id, settled };
  }

  /** R36 — op=biasdebt: one work product's debt and every settlement on it, in order, at most 50, the bound
   *  published. A debt the viewer may not see answers byte-identically to one never raised. */
  biasDebt({ run = null, viewer = null, limit = null } = {}) {
    const id = String(run ?? "").trim();
    const absent = { ok: true, run: id || null, found: false,
                     note: localize("bias.index.no_bias_debt_is_on",
                         "no bias debt is on record for this work: it either never carried one, or it is not one this reader can open") };
    if (!id) return absent;
    const seen = Bias.#gate("bd.context_id", viewer);
    const row = this.#one(`SELECT bd.* FROM bias_debts bd WHERE bd.run = ? AND (${seen.sql})`, id, ...seen.args);
    if (!row) return absent;
    const s = this.#settlements(id, limit);
    return {
      ok: true, run: id, found: true,
      open: row.cleared_at == null,
      context: { type: row.context_type, id: row.context_id },
      raised: row.raised, observed: row.observed,
      moved_basis: row.moved_basis ?? null, lens_then: row.lens_then ?? null, lens_now: row.lens_now ?? null,
      settled: Bias.#settledView(row),
      settlements: s.settlements, limit: s.limit, truncated: s.truncated,
      stated: "bias debt is DISCLOSED and blocks nothing (DEC-20). Three acts settle it and each is on "
            + "record here: the lens moving back, a re-run under the lens now in force, and a member's "
            + "resolve with a stated reason (BOB #32, 2026-09-23)",
    };
  }

  /* ---------------------------------------------------------------- R42–R44: the counts, the open debts and the settled ones (N171, N326) */

  /** R42: the bias statements and the adoptions held. `hid` (`{sql, args}`, the bundles the caller may not see, as
   *  run-productions' `counts`) leaves out a row naming such a bundle: a statement by its bundle, an adoption by its
   *  bundle or its project. Synchronous; writes nothing; never throws (a count that cannot be read answers null). */
  counts(hid = null) {
    const h = isObj(hid) && typeof hid.sql === "string" && Array.isArray(hid.args) ? hid : null;
    const c = (t, ...keys) => {
      try {
        const conds = h ? keys.map((k) => `COALESCE(${k}, '') NOT IN ${h.sql}`) : [];
        const args = h ? keys.flatMap(() => h.args) : [];
        return Number(this.#one(`SELECT count(*) AS c FROM ${t}${conds.length ? ` WHERE ${conds.join(" AND ")}` : ""}`,
          ...args).c);
      } catch { return null; }
    };
    return { biasStatements: c("bias_statements", "bundle_id"), biasAdoptions: c("bias_adoptions", "bundle_id", "scope_id") };
  }

  /** R43: the debts not yet cleared whose context `gate` admits (`gate` membership's predicate, `viewerPredicate`'s
   *  answer over the alias `b`; a machine scope admits every debt, the founder's what R43 admits it to (D54); a
   *  malformed gate admits none), newest raised first, ties by run, at most `limit` (1–1,000, default 200), `truncated` measured by reading one more.
   *  Writes nothing; never throws (a read that fails answers none, and says so). */
  uncleared({ gate = null, limit = null } = {}) {
    const n = Math.floor(Number(limit));
    const cap = Number.isFinite(n) && n >= 1 ? Math.min(n, BIAS_DEBT_UNCLEARED_MAX) : BIAS_DEBT_UNCLEARED_DEFAULT;
    try {
      const seen = Bias.#gateOver("bd.context_id", gate);
      const rows = this.#rows(
        `SELECT bd.run, bd.context_type, bd.context_id, bd.moved_basis, bd.lens_then, bd.lens_now, bd.observed,
                bd.raised, bd.recipients
           FROM bias_debts bd WHERE bd.cleared_at IS NULL AND (${seen.sql})
          ORDER BY bd.raised DESC, bd.run LIMIT ?`, ...seen.args, cap + 1);
      const debts = rows.slice(0, cap).map((r) => {
        const named = safeJson(r.recipients);
        return { run: r.run, context_type: r.context_type, context_id: r.context_id, moved_basis: r.moved_basis ?? null,
                 lens_then: r.lens_then ?? null, lens_now: r.lens_now ?? null, observed: r.observed, raised: r.raised,
                 recipients: Array.isArray(named) ? named.filter((x) => typeof x === "string") : [] };
      });
      return { debts, limit: cap, truncated: rows.length > cap };
    } catch {
      return { debts: [], limit: cap, truncated: false, undetermined: true,
               stated: word("bias.open_bias_debts") };
    }
  }

  /** R44 (N326): the debts settled at or after `since` whose context `gate` admits (as R43), newest settled first,
   *  ties by run, at most `limit` (1–1,000, default 200), `truncated` measured by reading one more. Each carries the
   *  kind the debt records (null for one settled before the kind was kept), when, and the settling settlement's
   *  `actor` (only a member's resolve has one) and `reason` (only a resolve's). The settling settlement is the run's
   *  last, and it is read only when its kind is the one the debt records (R37: `#settle` writes both from one act).
   *  `since` is an instant (ms since the epoch, or a readable instant string), compared as an instant: settlements are
   *  stamped to the whole second, so it is read as the first whole second at or after it. Writes nothing; never
   *  throws (a read that fails answers none, and says so). */
  settled({ gate = null, since = null, limit = null } = {}) {
    const n = Math.floor(Number(limit));
    const cap = Number.isFinite(n) && n >= 1 ? Math.min(n, BIAS_DEBT_SETTLED_MAX) : BIAS_DEBT_SETTLED_DEFAULT;
    const from = Bias.#wholeSecondFrom(since);
    if (from === null)
      return { debts: [], limit: cap, truncated: false, since: null,
               stated: word("bias.instant_settled_bias") };
    try {
      const seen = Bias.#gateOver("bd.context_id", gate);
      const rows = this.#rows(
        `SELECT bd.run, bd.context_type, bd.context_id, bd.settled_kind, bd.cleared_at,
                s.kind AS by_kind, s.actor, s.reason
           FROM bias_debts bd
           LEFT JOIN bias_debt_settlements s
             ON s.seq = (SELECT max(x.seq) FROM bias_debt_settlements x WHERE x.run = bd.run)
          WHERE bd.cleared_at IS NOT NULL AND bd.cleared_at >= ? AND (${seen.sql})
          ORDER BY bd.cleared_at DESC, bd.run LIMIT ?`, from, ...seen.args, cap + 1);
      const debts = rows.slice(0, cap).map((r) => {
        const kind = r.settled_kind ?? null;
        const resolved = kind === "resolved" && r.by_kind === kind;
        return { run: r.run, context_type: r.context_type, context_id: r.context_id, settled_kind: kind,
                 settled_at: r.cleared_at, actor: resolved ? r.actor ?? null : null,
                 reason: resolved ? r.reason ?? null : null };
      });
      return { debts, limit: cap, truncated: rows.length > cap, since: from };
    } catch {
      return { debts: [], limit: cap, truncated: false, since: from, undetermined: true,
               stated: word("bias.settled_bias_debts") };
    }
  }

  /* An instant (ms since the epoch, or a non-empty string `Date.parse` reads, record-core R48's "readable instant")
     as the first whole second at or after it, in the record's `…:SSZ` spelling; else null. */
  static #wholeSecondFrom(v) {
    const ms = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Date.parse(v) : NaN;
    if (!Number.isFinite(ms)) return null;
    try { return stampInstant("second", Math.ceil(ms / 1000) * 1000); } catch { return null; }
  }

  /** R38 — told of a work product's close. When it re-made another (`rerunOf`), the debt of the one re-made is
   *  discharged only when the lens the new one ran under equals the lens now in force; two absences are not
   *  agreement. Answers null when there is no link to follow, else the outcome, which the caller carries. */
  async biasDebtRerun({ kind = null, key = null, at = null } = {}) {
    const src = this.#sources.find((s) => s.kind === kind) || (kind == null ? this.#sources[0] : null);
    if (!src || key == null) return null;
    const wp = await src.source.read(String(key));
    const target = wp && typeof wp.rerunOf === "string" && wp.rerunOf.trim() ? wp.rerunOf.trim() : null;
    if (!target) return null;
    const debt = this.#one(`SELECT * FROM bias_debts WHERE run = ? AND cleared_at IS NULL`, target);
    if (!debt)
      return { re_ran: target, discharged: false, outcome: "no_open_debt",
               stated: word("bias.open_bias_debt") };
    const formed = typeof wp.ranUnder === "string" ? wp.ranUnder : null;
    const now = this.#lensNow(wp.context);
    const inForce = now.undetermined ? null : now.sha;
    if (formed == null || inForce == null)
      return { re_ran: target, discharged: false, outcome: "lens_undetermined",
               lens_ran_under: formed, lens_in_force: inForce,
               stated: formed == null
                 ? localize("bias.index.this_work_was_made_under",
                   "this work was made under no lens that can be read, so whether it ran under the lens now in force is undetermined and it discharges nothing")
                 : localize("bias.index.no_lens_is_in_force",
                   "no lens is in force for this work's context, so whether it ran under the current one is undetermined and it discharges nothing") };
    if (formed !== inForce)
      return { re_ran: target, discharged: false, outcome: "other_lens",
               lens_ran_under: formed, lens_in_force: inForce,
               stated: "this work was made under a lens other than the one now in force, so it discharges "
                     + "nothing (BOB #32: a re-run under any other lens discharges nothing)" };
    /* Stamped to the whole second, as every other settlement, so R44 compares them as instants; an `at` that is no
       readable instant is the act's own time. */
    const t = typeof at === "number" ? at : typeof at === "string" && at.trim() ? Date.parse(at) : NaN;
    const when = Number.isFinite(t) ? stampInstant("second", Math.floor(t / 1000) * 1000) : stampInstant("second");
    const settled = this.#settle({ run: target, kind: "rerun", at: when, byRun: String(key),
                                   lensThen: debt.lens_then, lensNow: formed });
    return { re_ran: target, discharged: true, lens_ran_under: formed, lens_in_force: inForce, settled };
  }
}

/* R30, R47 (plan T33, Rules (6); T33-38): this module's five tables, declared explicitly through record-core's
   `declareTable` (its R21). The statements and the adoptions are keyed to their bundle (an adoption also to its
   project) and carry that bundle's sight; the debt, its settlements and the sweep's place are whole-store, group-wide,
   the sweep's place exempt from purge (an instance setting). The other classes are the ones `declarePurge`'s default
   form gave them, so purge clears exactly what it cleared before. */
const declared = (name, cls) => Object.freeze({ name, purge: "clear", expunge: "none", export: "admin-only",
                                                derive: "stored", version_chain: false, ...cls });
export const BIAS_TABLE_DECLARATIONS = Object.freeze([
  declared("bias_statements", { keys: ["bundle_id"], sight: "bundle" }),
  declared("bias_adoptions", { keys: ["bundle_id", "scope_id"], sight: "bundle" }),
  declared("bias_debts", { keys: [], sight: "group" }),
  declared("bias_debt_settlements", { keys: [], sight: "group" }),
  declared("bias_debt_sweeps", { purge: "exempt", sight: "group" }),
]);

const OF = new WeakMap();

/** K61: the one bias instance for this Durable Object's storage (`ctx`, or the storage itself). On first reaching
 *  it, its tables are declared to record-core (R30, R47), its figures registered with record-core's counts (R46,
 *  record-core R63), its step and post-commit notice registered with promotion (R8–R10, R23), and its checks with
 *  record-core's audit (R1–R7, record-core R59). A record with no `registerCounts` (a test's stand-in) is not asked. */
export function biasOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let b = OF.get(storage);
  if (!b) {
    const record = (deps && deps.record) || recordOf(ctx);
    const membership = (deps && deps.membership) || membershipOf(ctx, { record });
    const promotion = (deps && deps.promotion) || promotionOf(ctx);
    const entities = deps && deps.entities !== undefined ? deps.entities : entitiesOf(ctx, { record, membership });
    b = new Bias({ sql: storage.sql, record, membership, entities, env: deps && deps.env });
    OF.set(storage, b);
    record.declareTable("bias", BIAS_TABLE_DECLARATIONS);
    if (typeof record.registerCounts === "function")
      record.registerCounts("bias", [...BIAS_COUNT_KEYS], (hid) => b.counts(hid));
    promotion.registerStep("bias", { check: (c) => b.promotionCheck(c), project: (c) => b.promotionProjection(c) });
    promotion.onCommitted("bias", (n) => b.committed(n));
    record.registerAuditCheck("bias", (img) => checkBiasImage(img && img.files instanceof Map ? img.files : img && img.raw));
  }
  return b;
}

/* The ops this module answers, as entries of the plane's op map (`src/plane/store.mjs` spreads them in). `url` is the
   request URL, whose query carries the control plane's stamps (`author`, `identity`, `viewer`), each read after the
   body so a caller's own copy never wins; `body` the parsed body. The adopter's `reason` (R11) is the caller's own
   words, not a stamp: read from the body, else the query. The policy arrives in the BODY: a policy in a query
   string would be cut by the first proxy with an opinion about URL length, and a cut policy silently produces a
   smaller residue. `actor` rides in the body, stamped there by the control plane. */
export function biasOps(b, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    biasmanifest: () => b.biasManifest({ scope: q("scope"), scopeId: q("scopeId"), limit: q("limit"),
                                         offset: q("offset"), viewer: q("viewer") }),
    biasadopt: async () => {
      const r = b.biasAdopt({ bundleId: q("bundleId"), scope: q("scope"), scopeId: q("scopeId"),
                              reason: body && body.reason != null ? body.reason : q("reason"), author: q("author"),
                              identity: q("identity"), viewer: q("viewer") });
      await b.noticesDelivered();
      return r;
    },
    biasinhale: () => b.biasInhale({ policy: (body && body.policy) || "", source: (body && body.source) || null,
                                     retrieved: (body && body.retrieved) || null, adopt: body ? body.adopt : false,
                                     limit: q("limit") }),
    biasdebtresolve: () => b.biasDebtResolve({ ...(body || {}), viewer: q("viewer") }),
    biasdebt: () => b.biasDebt({ run: q("run"), viewer: q("viewer"), limit: q("limit") }),
  };
}

/* R50 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  biasdebt: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("bias.declared.biasdebt", "read: one run's bias debt and what settled it, keyed by run id — the record behind the queue item, never an act on an object"),
    fields: { accepts: ["run","limit"], requires: [] } },
  biasdebtresolve: { classes: ["admin","member"], mutating: true, weight: "reasoned", description: localize("bias.declared.biasdebtresolve", "bias-debt act, keyed by the RUN whose lens moved and gated by that run's read; travels with the queue item via op=queue, never beside a bundle"),
    fields: { accepts: ["run","reason"], requires: ["run","reason"] } },
  biasmanifest: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: "act.biasmanifest.label.bias",
    fields: { accepts: ["scope","scopeId","limit","offset"], requires: [] } },
  biasinhale: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: "act.biasinhale.label.bias",
    fields: { accepts: ["policy","source","retrieved","adopt","limit"], requires: [] } },
  biasadopt: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("bias.declared.biasadopt", "governance: the authored, attributed adoption that puts a declared-bias set in force for a scope (DEC-54 c/d), keyed by (scope, bias bundle) and not by any object's state — the disclose half of the pair `strengthbar` is the gate half of"),
    fields: { accepts: ["bundleId","scope","scopeId","reason"], requires: ["bundleId","reason"] } },
});
