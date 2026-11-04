/* registers — the base: construction, sight, the register definitions and the listing, proposals, a team's own
 * definitions, the prefilled filter (requirements: R1–R8, R19, R22, R36, R37, R43, R44). The import runner, the search and
 * the watch are `runner.mjs`, `search.mjs` and `watch.mjs`, whose methods are installed on this class by `index.mjs`. */
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, noSuchProject } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { isPublicHttpsLocator, isMachineIdentity } from "../record-grammar/index.mjs";
import { validateFilter, filterFingerprint, prefillFrom, autoWatchable, CONTACT_ROLES } from "../register-readers/index.mjs";
import { validateRegisterDefinition } from "../../../jurisdictions/index.mjs";
import { profileView } from "../acquisition/index.mjs";
import { ORGANISATION_KINDS } from "../entities/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { migrateRegisters, registersTables } from "./schema.mjs";
import { sqliteRowStore, memoryRowStore } from "./port.mjs";
import * as L from "./limits.mjs";

export const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
export const str = (v) => (typeof v === "string" ? v.trim() : "");
export const json = (v) => JSON.stringify(v ?? null);
export const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
export const refusal = (code, detail, extra = {}) => ({ ok: false, reason: code, code, detail, ...extra });
export const NOT_STATED = Object.freeze({ value: null, basis: "not_stated" });


export const SCOPE_TEAM = "team";
export const scopeKeyOf = (scope, project) => (scope === "project" ? `project:${project}` : SCOPE_TEAM);

const instances = new WeakMap();

/** One instance per host (the Durable Object's storage). */
export function registersOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let r = instances.get(storage);
  if (!r) {
    r = new Registers({ storage, ...deps });
    instances.set(storage, r);
  }
  return r;
}

export class Registers {
  /** `deps`: record, membership (the same host's unless a test passes its own); acquisition `{streamRegister, probeRegister,
   *  sourceChanged, keyedFetch}`; store (acquisition's store: core, env, governor, provenance); content, extraction, entities
   *  (their registrations go the other way); `view` (the combined jurisdiction view, default the instance's active profiles);
   *  `bounds`, `phase`, `port` (a rowStore), `now`, `onImportQueued`, `freeBytes`. */
  constructor({ storage, record, membership, acquisition = null, store = null, content = null, extraction = null, entities = null,
                view = null, promotion = null, bounds = {}, phase = null, port = null, now = null, freeBytes = null, evidence = null, subjects = null, evidencePurge = null } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record || recordOf({ storage });
    this.membership = membership || membershipOf({ storage }, { record: this.record });
    this.promotion = promotion || promotionOf({ storage }, { record: this.record, membership: this.membership });
    this.acq = acquisition;
    this.store = store;
    this.content = content;
    this.extraction = extraction;
    this.entities = entities;
    this.viewOpt = view;
    this.bounds = { ...L, stream_max: L.STREAM_MAX, segment_max: L.SEGMENT_MAX, ...bounds };
    /* R23: a slice holds one segment's bytes and little else, so a segment is at most half of SLICE_MEMORY_MB */
    this.bounds.segment_max = Math.min(this.bounds.segment_max, Math.floor((this.bounds.SLICE_MEMORY_MB * 1048576) / 2));
    this.phase = phase || L.PRODUCT_PHASE;
    this.clock = typeof now === "function" ? now : () => Date.now();
    this.evidenceOpt = evidence;
    this.subjectsOpt = subjects;
    this.purgeOpt = typeof evidencePurge === "function" ? evidencePurge : null;
    this.queuedListeners = [];
    this.interestListeners = [];
    this.#freeBytes = freeBytes;
    migrateRegisters(this.sql);
    this.port = port || sqliteRowStore(this.sql, { freeBytes: () => this.#shelfFree(), termsOf: (reg) => this.definitionOf(reg)?.definition ?? null });
    const d = this.record.declareTable("registers", registersTables((scope) => this.port.rebuild(scope), (scope) => (typeof this.port.rebuildTokens === "function" ? this.port.rebuildTokens(scope) : [])));
    if (d && d.ok === false && d.reason !== "TABLE_DECLARED") throw new Error(`registers: ${d.reason}`);
    this.#registerHooks();
  }

  #freeBytes = null;
  rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  nowMs() { const n = this.clock(); return typeof n === "number" ? n : Date.parse(n); }
  nowIso() { return new Date(this.nowMs()).toISOString(); }
  tx(fn) { return typeof this.record.transact === "function" ? this.record.transact(fn) : fn(); }

  /* the storage the shelf is measured on (R23): the host states the free bytes, else the object's size against its ceiling */
  #shelfFree() {
    if (typeof this.#freeBytes === "function") return this.#freeBytes();
    try {
      const size = this.sql.databaseSize;
      return Number.isFinite(size) ? Math.max(0, this.bounds.SHELF_BYTES - size) : null;
    } catch { return null; }
  }
  shelf(extraBytes = 0) {
    const free = this.port.freeBytes();
    if (free === null || free === undefined) return { free_bytes: null, would_use_pct: null, warn: false };
    const total = this.bounds.SHELF_BYTES;
    const used = Math.max(0, total - free) + extraBytes;
    const pct = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
    return { free_bytes: free, would_use_pct: pct, warn: pct >= this.bounds.SHELF_WARN_PCT, over: pct >= this.bounds.SHELF_REFUSE_PCT };
  }

  /* ---- who and what a viewer sees (R19) ---- */

  /** The member an author names (a machine or absent author is null). */
  memberOf(author) {
    const a = str(author);
    if (!a || isMachineIdentity(a)) return null;
    try { return this.membership.positionalMember(null, a); } catch { return null; }
  }
  isAdmin(author) {
    const m = this.memberOf(author);
    return !!m && !!this.membership.isAdministrator(m);
  }
  /** Whether a viewer may see a project's contents. */
  seesProject(project, viewer) {
    if (!str(project) || !str(viewer)) return false;
    try { return !!this.membership.inSight(project, viewer); } catch { return false; }
  }
  /** The scope keys a viewer reads: the team's, and each project's they may see. */
  scopesOf(viewer) {
    if (!str(viewer)) return [];
    const out = [SCOPE_TEAM];
    for (const { project } of this.rows(`SELECT DISTINCT project FROM register_imports WHERE project IS NOT NULL`))
      if (this.seesProject(project, viewer)) out.push(`project:${project}`);
    return out;
  }
  scopeSeen(scopeKey, viewer) {
    if (scopeKey === SCOPE_TEAM) return !!str(viewer);
    return scopeKey.startsWith("project:") && this.seesProject(scopeKey.slice(8), viewer);
  }
  /** An import row the viewer may see, parsed; null for an absent or hidden one (R13, R19: one answer). */
  importSeen(id, viewer) {
    const n = Number(id);
    if (!Number.isSafeInteger(n)) return null;
    const r = this.one(`SELECT * FROM register_imports WHERE import_id=?`, n);
    if (!r || !this.scopeSeen(r.scope_key, viewer)) return null;
    return r;
  }

  /* ---- the definitions (R1, R7) ---- */

  view() {
    if (this.viewOpt) return typeof this.viewOpt === "function" ? this.viewOpt() : this.viewOpt;
    return profileView(this.record).view ?? { systems: [], registers: [], use_limits: [] };
  }
  shipped() { const v = this.view(); return Array.isArray(v.registers) ? v.registers : []; }
  ownLatest() {
    return this.rows(`SELECT d.* FROM register_definitions d WHERE d.version = (SELECT MAX(version) FROM register_definitions WHERE key = d.key) ORDER BY d.key`)
      .map((r) => ({ ...r, definition: parse(r.definition) }));
  }
  /** `{definition, own, use_limit}` for a register key; null when none. The team's own wins nothing over the shipped: keys are unique. */
  definitionOf(key) {
    const k = str(key);
    if (!k) return null;
    const s = this.shipped().find((r) => r && r.key === k);
    if (s) return { definition: s, own: false };
    const o = this.one(`SELECT * FROM register_definitions WHERE key=? ORDER BY version DESC LIMIT 1`, k);
    return o ? { definition: parse(o.definition), own: true, version: o.version } : null;
  }
  useLimitOf(definition) {
    if (!isObj(definition) || !definition.use_limit) return null;
    const u = (this.view().use_limits || []).find((x) => x && x.key === definition.use_limit);
    return u ? { key: u.key, citation: u.citation, text_key: u.text_key } : { key: definition.use_limit, citation: null, text_key: null };
  }
  /** R3-R5: why an act on a register is refused before anything is fetched, or null. */
  actRefusal(definition, { forRead = false } = {}) {
    if (definition.phase === "beta" && this.phase !== "beta" && !forRead)
      return refusal("REGISTER_NOT_IN_ALPHA", localize("registers.refusal.REGISTER_NOT_IN_ALPHA", "this register is not part of this release"), { register: definition.key, reason_key: `register.beta.${definition.key}` });
    if (definition.status === "not_measured")
      return refusal("REGISTER_NOT_MEASURED", localize("registers.refusal.REGISTER_NOT_MEASURED", "this register has not been measured, so it cannot be imported yet; your team can bring it in with its own definition"), { register: definition.key });
    if (definition.gate && definition.gate !== "none")
      return refusal("member_act_required", localize("registers.refusal.member_act_required", "this register is behind an account or a fee, so a member brings the file in with their own account; nothing was fetched"), { register: definition.key, gate: definition.gate });
    return null;
  }

  /* ---- R1, R2: the listing ---- */

  registerList({ viewer } = {}) {
    const imports = this.rows(`SELECT * FROM register_imports ORDER BY import_id`).filter((i) => this.scopeSeen(i.scope_key, viewer));
    const entry = (d, own) => {
      const L_ = isObj(d.listing) ? d.listing : {};
      const status = own ? "importable" : d.status === "not_measured" ? "not_measured" : d.phase === "beta" ? "beta" : d.gate && d.gate !== "none" ? "gated" : "importable";
      const lim = this.useLimitOf(d);
      return {
        key: d.key, name: d.label, source: d.publisher, url: d.url,
        bytes: isObj(L_.bytes) ? { ...L_.bytes } : { ...NOT_STATED }, rows: isObj(L_.rows) ? { ...L_.rows } : { ...NOT_STATED },
        ...(L_.source_date ? { source_date: L_.source_date } : {}), measured_at: L_.measured_at ?? null, status,
        ...(status === "beta" ? { reason_key: `register.beta.${d.key}` } : {}),
        ...(status === "gated" ? { gate: d.gate } : {}), ...(lim ? { use_limit: lim } : {}),
        held: imports.filter((i) => i.register === d.key).map((i) => this.heldOf(i, d, viewer)),
      };
    };
    const known = this.shipped().map((d) => entry(d, false)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const own = this.ownLatest().map((o) => ({ ...entry(o.definition, true), own: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
    const proposed = this.rows(`SELECT * FROM register_proposals WHERE state='proposed' ORDER BY proposal_id`)
      .map((p) => ({ id: p.proposal_id, name: p.name, url: p.url, publisher: p.publisher, note: p.note, by: p.by, at: p.at, state: p.state }));
    return { ok: true, known, own, proposed };
  }

  heldOf(i, definition, viewer) {
    const interest = i.project ? this.currentInterest(i.project, i.register) : null;
    let watched = "none", next = null;
    if (interest && !interest.ended) {
      const f = parse(interest.filter) || {};
      if (autoWatchable(f) && interest.watch) {
        watched = "auto";
        const cad = definition?.refresh?.cadence_hours;
        const last = i.finished_at || i.imported_at;
        if (Number.isFinite(cad) && last) next = new Date(Date.parse(last) + cad * 3600000).toISOString();
      } else if (!autoWatchable(f)) watched = "by_act";
    } else if (i.scope === SCOPE_TEAM && this.rows(`SELECT i.project FROM register_interests i WHERE i.register=? AND i.ended=0 AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id)`, i.register)
      .some((r) => this.seesProject(r.project, viewer))) watched = "by_act";   /* a team pre-read a visible interest names: re-checked by a member's act */
    return { import: i.import_id, scope: i.scope, ...(i.project ? { project: i.project } : {}), state: i.state, source_date: i.source_date ?? "not_stated",
             imported_at: i.imported_at, rows_in: i.rows_in, rows_out: i.rows_out, filter: parse(i.filter), filter_fingerprint: i.filter_fp,
             watched, ...(next ? { next_check: next } : {}), reduced_key: "register.reduced" };
  }

  currentInterest(project, register) {
    const r = this.one(`SELECT i.* FROM register_interests i WHERE i.project=? AND i.register=? AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id) ORDER BY i.interest_id DESC LIMIT 1`, project, register);
    return r;
  }

  /* ---- R6: proposals ---- */

  registerPropose({ name, url, publisher, note, withdraw, author, viewer, id } = {}) {
    const by = str(author);
    if (withdraw === true) {
      const p = this.one(`SELECT * FROM register_proposals WHERE proposal_id=?`, Number(id));
      if (!p) return refusal("NO_SUCH_PROPOSAL", localize("registers.refusal.NO_SUCH_PROPOSAL", "no proposal answers to that id"), {});
      if (p.by !== by && !this.isAdmin(by)) return refusal("NOT_YOUR_PROPOSAL", localize("registers.refusal.NOT_YOUR_PROPOSAL", "only the member who proposed it, or an administrator, withdraws a proposal"), {});
      this.sql.exec(`UPDATE register_proposals SET state='withdrawn' WHERE proposal_id=?`, p.proposal_id);
      return { ok: true, id: p.proposal_id, state: "withdrawn" };
    }
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_PROPOSE", localize("registers.refusal.MACHINE_CANNOT_PROPOSE", "a register is proposed by a member; a machine proposes nothing"), {});
    for (const [field, v] of [["name", name], ["url", url], ["publisher", publisher]]) {
      const t = str(v);
      if (!t || t.length > this.bounds.PROPOSAL_TEXT_MAX) return refusal("PROPOSAL_INVALID", localize("registers.refusal.PROPOSAL_INVALID", "the proposal's {field} is blank or too long", { field }), { field });
    }
    const u = str(url);
    if (!this.publicUrl(u)) return refusal("PROPOSAL_NOT_PUBLIC", localize("registers.refusal.PROPOSAL_NOT_PUBLIC", "the address is not a public https address (not a login page, a private address or one with credentials); it was not fetched"), { field: "url" });
    const norm = this.normUrl(u);
    const held = this.one(`SELECT * FROM register_proposals WHERE url_norm=? AND state='proposed'`, norm);
    if (held) return { ok: true, existed: true, proposal: this.proposalOf(held) };
    const at = this.nowIso();
    this.sql.exec(`INSERT INTO register_proposals (name, url, url_norm, publisher, note, by, at, state) VALUES (?,?,?,?,?,?,?, 'proposed')`, str(name), u, norm, str(publisher), str(note) || null, by, at);
    const row = this.one(`SELECT * FROM register_proposals WHERE url_norm=? ORDER BY proposal_id DESC LIMIT 1`, norm);
    return { ok: true, existed: false, proposal: this.proposalOf(row) };
  }
  proposalOf(p) { return { id: p.proposal_id, name: p.name, url: p.url, publisher: p.publisher, note: p.note, by: p.by, at: p.at, state: p.state }; }
  publicUrl(u) {
    try {
      const x = new URL(u);
      if (x.protocol !== "https:" || x.username || x.password) return false;
      return isPublicHttpsLocator(u) === true;
    } catch { return false; }
  }
  /** a proposal's address as text, for finding the same one again: scheme and host folded, no fragment, no trailing slash */
  normUrl(u) { try { const x = new URL(u); x.hash = ""; return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, "")}${x.search}`; } catch { return String(u).toLowerCase(); } }

  /** R6: the held proposals, as data for an administrator to send on by their own act; this module sends nothing. */
  proposalsForUpstream({ viewer } = {}) {
    if (!this.isAdmin(viewer)) return refusal("NOT_AN_ADMIN", localize("registers.refusal.NOT_AN_ADMIN", "this is an administrator's act"), {});
    return { ok: true, proposals: this.rows(`SELECT * FROM register_proposals WHERE state='proposed' ORDER BY proposal_id`).map((p) => this.proposalOf(p)) };
  }

  /* ---- R7: a team's own definition ---- */

  registerDefine({ proposal, key, definition, author } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_DEFINE", localize("registers.refusal.MACHINE_CANNOT_DEFINE", "a register is defined by a member; a machine defines nothing"), {});
    if (!isObj(definition)) return refusal("REGISTER_INVALID", localize("registers.refusal.REGISTER_INVALID", "the definition is not a register definition"), { field: "definition" });
    const view = this.view();
    const systems = (Array.isArray(view.systems) ? view.systems : []).find((s) => isObj(s) && s.origin === definition.system);
    if (definition.gate === "people_search") return refusal("REGISTER_PEOPLE_SEARCH", localize("registers.refusal.REGISTER_PEOPLE_SEARCH", "a paid people-search is not a register this product reaches"), { field: "gate", register: definition.key ?? null });
    if (systems && systems.gated && systems.gated !== "none") return refusal("member_act_required", localize("registers.refusal.member_act_required", "this register is behind an account or a fee, so a member brings the file in with their own account; nothing was fetched"), { gate: systems.gated, register: definition.key ?? null });
    const v = validateRegisterDefinition(definition, view);
    if (!v.ok) return refusal(v.code, localize("registers.refusal.definition_refused", "the definition is refused ({code}, {field})", { code: String(v.code), field: String(v.field ?? "") }), { field: v.field ?? null, register: v.key ?? null });
    const k = str(definition.key) || str(key);
    if (!/^[a-z0-9][a-z0-9_]{0,63}$/.test(k)) return refusal("REGISTER_INVALID", localize("registers.refusal.REGISTER_INVALID", "the definition is not a register definition"), { field: "key" });
    if (this.shipped().some((r) => r.key === k)) return refusal("REGISTER_KEY_TAKEN", localize("registers.refusal.REGISTER_KEY_TAKEN", "that key names a register already on the list"), { field: "key" });
    const terms = str(definition.terms_basis);
    if (!terms) return refusal("REGISTER_NO_TERMS", localize("registers.refusal.REGISTER_NO_TERMS", "a register's terms are stated in the member's own words"), { field: "terms_basis" });
    if (str(definition.gate) && definition.gate !== "none") return refusal("member_act_required", localize("registers.refusal.member_act_required", "this register is behind an account or a fee, so a member brings the file in with their own account; nothing was fetched"), { gate: definition.gate });
    const at = this.nowIso();
    const prior = this.one(`SELECT MAX(version) AS v FROM register_definitions WHERE key=?`, k);
    const version = (prior && prior.v ? prior.v : 0) + 1;
    const own = { ...definition, key: k, own: true, by, at, terms_statement: localize("registers.define.terms_statement", "stated by the team, not checked"), gate: "none", phase: "alpha" };
    this.sql.exec(`INSERT INTO register_definitions (key, version, definition, terms, proposal_id, by, at) VALUES (?,?,?,?,?,?,?)`,
                  k, version, json(own), terms, Number.isSafeInteger(Number(proposal)) ? Number(proposal) : null, by, at);
    if (Number.isSafeInteger(Number(proposal))) this.sql.exec(`UPDATE register_proposals SET state='defined' WHERE proposal_id=?`, Number(proposal));
    return { ok: true, key: k, version, own: true, definition: own };
  }

  /** R7: every revision of a team's own definition, earliest first. */
  definitionVersions(key) {
    return this.rows(`SELECT version, definition, terms, by, at FROM register_definitions WHERE key=? ORDER BY version`, str(key)).map((r) => ({ version: r.version, definition: parse(r.definition), terms: r.terms, by: r.by, at: r.at }));
  }

  /* ---- R8: the filter, prefilled from the project ---- */

  /** The project's named subjects and identifiers the viewer may see, through `entities.subjectsOfProject` (`entities` R74): `{subjects, identifiers, period?}`
   *  as `prefillFrom` reads them. R74 answers each subject with its identifiers; they are lifted out here, and an entity kind is read in the prefill's
   *  words: a person is a person, an organisation kind of `entities` (`ORGANISATION_KINDS`) is an organization, any other kind enters as itself. */
  factsOfProject(project, viewer) {
    const via = this.subjectsOpt || (this.entities && typeof this.entities.subjectsOfProject === "function" ? (p, v) => this.entities.subjectsOfProject({ project: p, viewer: v }) : null);
    const none = { subjects: [], identifiers: [], period: null };
    if (!via) return none;
    try {
      const f = via(project, viewer);
      if (!isObj(f) || f.ok === false) return none;
      const subjects = (Array.isArray(f.subjects) ? f.subjects.filter(isObj) : []).map((s) => (ORGANISATION_KINDS.includes(s.kind) ? { ...s, kind: "organization" } : s));
      const ids = Array.isArray(f.identifiers) ? f.identifiers : subjects.flatMap((s) => (Array.isArray(s.identifiers) ? s.identifiers : []));
      return { subjects, identifiers: ids, period: isObj(f.period) ? f.period : null };
    } catch { return none; }
  }

  registerFilter({ register, project, viewer } = {}) {
    const d = this.definitionOf(register);
    if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), { register: typeof register === "string" ? register : null });
    const bad = this.actRefusal(d.definition);
    if (bad) return bad;
    if (project === undefined || project === null || project === "") return { ok: true, filter: {}, prefilled: false, basis: [], left_out: [] };
    if (!this.seesProject(project, viewer)) return noSuchProject(typeof project === "string" ? project : null);
    const facts = this.factsOfProject(project, viewer);
    const p = prefillFrom(facts, d.definition);
    const checked = validateFilter(p.filter, d.definition, this.view());
    const filter = checked.ok ? checked.filter : {};
    const interest = this.currentInterest(project, d.definition.key);
    return { ok: true, filter, prefilled: Object.keys(filter).length > 0, basis: p.basis, left_out: p.left_out,
             ...(interest && !interest.ended ? { interest: { filter: parse(interest.filter), watch: !!interest.watch, version: interest.version } } : {}) };
  }

  /** The filter a member states, validated against the definition; `{ok, filter, fingerprint}` or the refusal. */
  checkFilter(definition, filter) {
    const v = validateFilter(isObj(filter) ? filter : {}, definition, this.view());
    if (!v.ok) return refusal(v.code, localize("registers.refusal.filter_refused", "the filter is refused ({code}, {field})", { code: String(v.code), field: String(v.field ?? "") }), { field: v.field ?? null });
    return { ok: true, filter: v.filter, fingerprint: filterFingerprint(v.filter) };
  }

  /* ---- R44: which register issues a number's scheme ---- */

  registerFor({ scheme, name } = {}) {
    if (name !== undefined && name !== null) return refusal("QUERY_NOT_NAMED", localize("registers.refusal.QUERY_NOT_NAMED", "a watch is by a number, never by a name"), {});
    const s = str(scheme);
    const regs = this.shipped().filter((r) => Array.isArray(r.schemes) && r.schemes.includes(s)).map((r) => r.key);
    return { ok: true, scheme: s, registers: regs };
  }

  /** The columns a reduced copy holds, in the definition's order (register-readers R3). */
  /** R30: an object removed from the evidence store, by the store's own `delete` when it has one, else by the host's purge (`evidencePurge`). record-core's store offers neither today (reported). */
  async purgeObject(ev, sha) {
    try {
      if (ev && typeof ev.delete === "function") { await ev.delete(sha); return true; }
      if (this.purgeOpt) { await this.purgeOpt(sha); return true; }
    } catch { /* the object stays, and the caller says so */ }
    return false;
  }

  kept(definition) { return (Array.isArray(definition.columns) ? definition.columns : []).filter((c) => isObj(c) && typeof c.name === "string" && c.keep === true && !CONTACT_ROLES.includes(c.role)).map((c) => c.name); }

  /* ---- the registrations that go the other way (content R65, extraction R113), once, at start ---- */
  #registerHooks() {
    const provider = {
      holds: (sha) => this.holdsSegment(sha),
      rowAt: (sha, n) => this.rowAtSegment(sha, n),
    };
    try { if (this.content && typeof this.content.registerRowContext === "function") this.content.registerRowContext(provider); } catch { /* the slot is taken */ }
    try { if (this.extraction && typeof this.extraction.registerHeldAs === "function") this.extraction.registerHeldAs("registers", { holds: (sha) => this.heldAs(sha) }); } catch { /* the slot is taken */ }
  }
}

export { Registers as default, memoryRowStore, sqliteRowStore, autoWatchable };
