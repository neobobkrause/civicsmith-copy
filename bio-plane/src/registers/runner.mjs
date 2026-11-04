/* registers — the import (requirements: R9–R20, R23): the delta before anything is brought in, the act that queues an import,
 * the slices it runs in on the scheduler's alarm, its status and its pause, resume and stop. Methods installed on `Registers`.
 *
 * AN IMPORT'S STATES: `queued` → `fetching` (acquisition's `streamRegister`, one bounded slice at a time, each piece's segments
 * stored as captures) → `reading` (the arrived segments read into the row store, a bounded batch at a time) → `indexed`;
 * `failed` (with its reason and retries), `paused` (`member`, `shelf`, `host_paused`, `host_cooling`) and `stopped`.
 * Every position is in the import's own row, so a restart between any two slices is the same import as an uninterrupted one. */
import { sha256HexSync, createSha256, MACHINE_AUTHOR_PREFIX } from "../record-grammar/index.mjs";
import { ROW_KEY_SEPARATOR, filterFingerprint, matches, estimate, autoWatchable, createReducer } from "../register-readers/index.mjs";
import { noSuchProject, listenerRefusal } from "../membership/index.mjs";
import { contentHashOf } from "./port.mjs";
import { isObj, str, json, parse, refusal, scopeKeyOf, NOT_STATED, SCOPE_TEAM } from "./core.mjs";
import { localize } from "../setup-words/index.mjs";
import { reducedParser } from "./reduced.mjs";

const ACTIVE = ["queued", "fetching", "reading"];
const EPOCH_MS = 5 * 60 * 1000;
const CONSUMER = "registers";
const SEP = ROW_KEY_SEPARATOR;
const utf8 = new TextDecoder("utf-8", { fatal: false });
const tick = () => new Promise((r) => setTimeout(r, 0));
/* the reduced copy's rows (register-readers R9: a field quoted only when it needs it): the byte after the row that starts at `at`,
   a quoted line break never taken for the row's end */
function rowEnd(bytes, at) {
  let q = false;
  for (let i = at; i < bytes.length; i++) { const c = bytes[i]; if (c === 0x22) q = !q; else if (c === 0x0a && !q) return i + 1; }
  return bytes.length;
}
/* one row's fields, or null for a blank line */
function fieldsOf(line) {
  let out = null;
  const p = reducedParser((f) => { if (out === null) out = f; });
  p.feed(utf8.decode(line)); p.end();
  return out && !(out.length === 1 && out[0] === "") ? out : null;
}

export const runnerMethods = {
  /* ------------------------------------------------------------------ pieces and bytes */

  dataPieces(definition, only = null) {
    const all = Array.isArray(definition.pieces) ? definition.pieces : [];
    const named = Array.isArray(only) && only.length ? all.filter((p) => only.includes(p.key)) : all.filter((p) => !all.some((q) => q.header_from === p.key));
    return named;
  },

  async bytesOf(sha) {
    if (typeof this.evidenceOpt === "function") return this.evidenceOpt(sha);
    const ev = typeof this.record.evidenceStore === "function" ? this.record.evidenceStore() : null;
    if (!ev || !/^[0-9a-f]{64}$/.test(String(sha))) return null;
    const o = await ev.get(sha);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  },

  /* ------------------------------------------------------------------ R9: the delta */

  async registerDelta({ register, filter, scope, project, budget_ms, viewer, holes } = {}) {
    const d = this.definitionOf(register);
    if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), { register: typeof register === "string" ? register : null });
    const bad = this.actRefusal(d.definition);
    if (bad) return bad;
    const checked = this.checkFilter(d.definition, filter);
    if (!checked.ok) return checked;
    const def = d.definition;
    const budget = Number.isFinite(budget_ms) && budget_ms > 0 ? budget_ms : this.bounds.DELTA_BUDGET_MS;
    const deadline = this.nowMs() + budget;
    /* what is held, from the index, for the viewer's sight only (R19) */
    const scopes = this.scopesOf(viewer);
    let held = 0;
    const seen = new Set();
    for (const r of this.port.scan({ scopes, register: def.key, filter: checked.filter })) {
      if (!matches(r.cells, checked.filter, def)) continue;
      if (!seen.has(r.row_key)) { seen.add(r.row_key); held++; }
    }
    /* the governed probes: no body, nothing written */
    let bytesIn = { ...NOT_STATED }, srcRows = { ...NOT_STATED }, srcDate = null, timedOut = false, probed = 0;
    const pieces = this.dataPieces(def);
    let bytesSum = 0, bytesAll = pieces.length > 0, rowsSum = 0, rowsAll = pieces.length > 0;
    for (const p of pieces) {
      const left = deadline - this.nowMs();
      if (left <= 0) { timedOut = true; break; }
      let pr;
      try { pr = await this.acq.probeRegister(this.store, { definition: def, piece: p.key, filter: checked.filter, holes, budget_ms: left, view: this.view() }, { bounds: this.bounds }); }
      catch { pr = { ok: false }; }
      if (!pr || pr.ok !== true) { if (pr && pr.ok === false && pr.reason && !["HOST_COOLING_OFF"].includes(pr.reason) && pr.reason !== "FETCH_FAILED") return refusal(pr.reason, pr.detail || localize("registers.refusal.probe_refused", "the register could not be probed"), { register: def.key }); bytesAll = false; rowsAll = false; continue; }
      probed++;
      if (pr.timed_out) timedOut = true;
      if (pr.bytes && pr.bytes.basis === "stated") bytesSum += pr.bytes.value; else bytesAll = false;
      if (pr.rows && pr.rows.basis === "counted") rowsSum += pr.rows.value; else rowsAll = false;
      if (pr.source_date && (!srcDate || pr.source_date < srcDate)) srcDate = pr.source_date;
    }
    if (bytesAll && probed) bytesIn = { value: bytesSum, basis: "stated" };
    else if (!probed && Number.isFinite(def.listing?.bytes?.value) && def.listing.bytes.basis === "stated") bytesIn = { value: def.listing.bytes.value, basis: "stated" };
    if (rowsAll && probed) srcRows = { value: rowsSum, basis: "counted" };
    const last = this.rows(`SELECT * FROM register_imports WHERE register=? AND state='indexed' AND kind='import' AND took_ms IS NOT NULL ORDER BY import_id DESC LIMIT 3`, def.key);
    const lastOne = last[0] ?? null;
    /* R9: counted only for an append-only source counted for this very filter; else estimated, else not stated */
    let newRows;
    if (srcRows.basis === "counted" && def.refresh && def.refresh.append_only === true) newRows = { value: Math.max(0, srcRows.value - held), basis: "counted" };
    else {
      const sel = lastOne && lastOne.rows_in > 0 ? lastOne.rows_out / lastOne.rows_in : 1;
      let total = null;
      if (srcRows.basis === "counted") total = srcRows.value;
      else if (def.listing && def.listing.rows && Number.isFinite(def.listing.rows.value)) total = def.listing.rows.value;
      else if (bytesIn.value !== null && lastOne && lastOne.bytes_in > 0 && lastOne.rows_in > 0) {
        const e = estimate({ bytes: lastOne.bytes_in, rows: lastOne.rows_in }, { bytes: bytesIn.value });
        total = e.rows.value;
      }
      newRows = total === null ? { ...NOT_STATED } : { value: Math.max(0, Math.round(total * (srcRows.basis === "counted" ? 1 : sel)) - held), basis: "estimated" };
    }
    const perRow = lastOne && lastOne.rows_in > 0 ? lastOne.bytes_in / lastOne.rows_in : null;
    const bytesStored = newRows.value !== null && perRow !== null ? { value: Math.round(newRows.value * perRow), basis: "estimated" }
      : Number.isFinite(def.listing?.bytes?.value) && newRows.value !== null && Number.isFinite(def.listing?.rows?.value) && def.listing.rows.value > 0
        ? { value: Math.round(newRows.value * (def.listing.bytes.value / def.listing.rows.value)), basis: "estimated" } : { ...NOT_STATED };
    /* seconds: the median rate of the last three timed imports, else the constant; never counted */
    let seconds = { value: null, low: null, high: null, basis: "not_stated" };
    if (bytesIn.value !== null) {
      const rates = last.filter((r) => r.bytes_in > 0 && r.took_ms > 0).map((r) => r.took_ms / r.bytes_in).sort((a, b) => a - b);
      const per = rates.length ? rates[Math.floor(rates.length / 2)] : 1 / this.bounds.THROUGHPUT_DEFAULT;
      const lo = rates.length ? rates[0] : per, hi = rates.length ? rates[rates.length - 1] : per;
      seconds = { value: (bytesIn.value * per) / 1000, low: (bytesIn.value * lo) / 1000, high: (bytesIn.value * hi) / 1000, basis: "estimated", ...(rates.length ? {} : { constant: true }) };
    }
    return { ok: true, new_rows: newRows, already_held: held, bytes_in: bytesIn, bytes_stored: bytesStored, seconds,
             shelf: this.shelf(bytesStored.value ?? 0), source_date: srcDate ?? def.listing?.source_date ?? "not_stated",
             probe: { requests: probed, rows: srcRows }, timed_out: timedOut };
  },

  /* ------------------------------------------------------------------ R11: queue an import */

  importStart({ register, filter, scope, project, author, viewer, holes, pieces, file, kind = "import", reason = null, on_behalf = null, interest = null, previous = null, force = false, recheck = false } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_IMPORT_REGISTER", localize("registers.refusal.MACHINE_CANNOT_IMPORT_REGISTER", "an import is a member's act; a machine starts none"), {});
    const d = this.definitionOf(register);
    if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), { register: typeof register === "string" ? register : null });
    /* R46 (2): a file in a member's hand is the one way into a register behind an account or a fee, and the phase does not stop it */
    const bytes = file instanceof Uint8Array ? file : file && file.bytes instanceof Uint8Array ? file.bytes : null;
    const isFile = file !== undefined && file !== null;
    const bad = isFile ? this.fileRefusal(d.definition, bytes) : this.actRefusal(d.definition);
    if (bad) return bad;
    const checked = this.checkFilter(d.definition, filter);
    if (!checked.ok) return checked;
    const sc = scope === "team" ? "team" : scope === "project" ? "project" : null;
    if (!sc) return refusal("SCOPE_INVALID", localize("registers.refusal.SCOPE_INVALID", "an import is for a project or for the team"), { field: "scope" });
    /* a team pre-read is an administrator's act; a member's re-check of one already held is the member's (R33, R2) */
    if (sc === "team" && !this.isAdmin(by) && !(recheck && kind === "refresh")) return refusal("NOT_AN_ADMIN", localize("registers.refusal.NOT_AN_ADMIN", "this is an administrator's act"), {});
    let proj = null;
    if (sc === "project") {
      proj = str(project);
      const member = this.memberOf(by);
      if (!proj || !this.seesProject(proj, str(viewer) || by) || !this.membership.isJoinedParticipant(proj, member)) return noSuchProject(proj || null);
    }
    const key = scopeKeyOf(sc, proj);
    const dup = this.one(`SELECT * FROM register_imports WHERE register=? AND filter_fp=? AND scope_key=? AND state IN ('queued','fetching','reading','paused') ORDER BY import_id LIMIT 1`, d.definition.key, checked.fingerprint, key);
    if (dup) return { ok: true, existed: true, import: dup.import_id, state: dup.state };
    const active = Number(this.one(`SELECT COUNT(*) AS n FROM register_imports WHERE state IN ('queued','fetching','reading')`).n);
    if (active >= this.bounds.MAX_ACTIVE_IMPORTS) return refusal("IMPORT_QUEUE_FULL", localize("registers.refusal.IMPORT_QUEUE_FULL", "{n} imports are already queued or running; start another when one has finished", { n: String(active) }), { active, max: this.bounds.MAX_ACTIVE_IMPORTS });
    if (isFile) return this.fileImport({ def: d.definition, checked, sc, proj, key, by, bytes, holes, pieces });
    const plist = this.dataPieces(d.definition, pieces).map((p) => ({ piece: p.key, state: "pending" }));
    if (!plist.length) return refusal("PIECE_UNKNOWN", localize("registers.refusal.PIECE_UNKNOWN", "the register has no piece of that name"), { register: d.definition.key });
    const id = this.insertImport({ register: d.definition.key, checked, sc, key, proj, kind, by, on_behalf, interest, previous, holes, pieces: plist, cursor: { slices: 0, force: force === true, reason }, state: "queued" });
    this.told(this.queuedListeners, { import: id, register: d.definition.key, kind });
    return { ok: true, existed: false, import: id, state: "queued" };
  },

  insertImport({ register, checked, sc, key, proj, kind, by, on_behalf = null, interest = null, previous = null, holes = null, pieces, cursor, state }) {
    let id;
    this.tx(() => {
      this.sql.exec(`INSERT INTO register_imports (register, filter, filter_fp, scope, scope_key, project, kind, state, author, on_behalf, interest_id, previous, holes, pieces, cursor, queued_at, due_ms)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    register, json(checked.filter), checked.fingerprint, sc, key, proj, kind, state, by, on_behalf, interest, previous,
                    holes ? json(holes) : null, json(pieces), json(cursor), this.nowIso(), this.nowMs());
      id = Number(this.one(`SELECT MAX(import_id) AS id FROM register_imports`).id);
    });
    return id;
  },

  /** R46 (2): what a file in a member's hand may be brought into: not a register that is unmeasured or a person-search, and a file with bytes */
  fileRefusal(def, bytes) {
    if (def.status === "not_measured") return refusal("REGISTER_NOT_MEASURED", localize("registers.refusal.REGISTER_NOT_MEASURED", "this register has not been measured, so it cannot be imported yet; your team can bring it in with its own definition"), { register: def.key });
    if (def.gate === "people_search") return refusal("REGISTER_PEOPLE_SEARCH", localize("registers.refusal.REGISTER_PEOPLE_SEARCH", "a paid people-search is not a register this product reaches"), { register: def.key });
    if (!bytes || !bytes.length) return refusal("FILE_EMPTY", localize("registers.refusal.FILE_EMPTY", "the file has no bytes; nothing was brought in"), { field: "file" });
    /* the act reads the file whole within its time (R11, R40) and a slice's memory (R23): a larger file is refused, nothing written */
    const max = Math.floor(this.bounds.SLICE_MEMORY_MB * 1048576);
    if (bytes.length > max) return refusal("FILE_TOO_LARGE", localize("registers.refusal.FILE_TOO_LARGE", "the file is larger than one import act reads ({max} bytes); nothing was brought in", { max: String(max) }), { field: "file", size: bytes.length, bound: max });
    const s = this.shelf(bytes.length);
    if (s.free_bytes !== null && s.warn) return refusal("SHELF_NEARLY_FULL", localize("registers.refusal.SHELF_NEARLY_FULL", "the object is nearly full ({pct}%), so the import is not resumed until room is made", { pct: String(s.would_use_pct) }), { shelf: s });
    return null;
  },

  /** R46 (2), R14, R15: the member's own file reduced as it is read, its segments stored, the original never kept: only its fingerprint. Nothing is fetched. */
  async fileImport({ def, checked, sc, proj, key, by, bytes, holes, pieces }) {
    const pieceKey = (def.pieces || []).find((p) => (Array.isArray(pieces) && pieces.length ? pieces.includes(p.key) : !def.pieces.some((q) => q.header_from === p.key)))?.key ?? "file";
    const pieceObj = (def.pieces || []).find((p) => p.key === pieceKey) ?? { key: "file", delimiter: def.delimiter ?? "comma" };
    const reducer = createReducer({ definition: def, piece: pieceObj, filter: checked.filter, covers: "whole_file" });
    const out = [];
    const CH = 1 << 20;
    for (let i = 0; i < bytes.length; i += CH) { const o = reducer.write(bytes.subarray(i, i + CH)); if (o.length) out.push(o); }
    const end = reducer.end();
    if (!end.ok) return refusal("REGISTER_NOT_READABLE", localize("registers.refusal.REGISTER_NOT_READABLE", "the file cannot be read as this register's file ({why}); nothing was brought in", { why: String(end.why) }), { why: end.why });
    if (end.bytes.length) out.push(end.bytes);
    const all = new Uint8Array(out.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of out) { all.set(c, at); at += c.length; }
    /* cut at row boundaries, a row never split, a quoted line break never taken for a row's end; the header repeated */
    const lines = [];
    let s = 0, inQuote = false;
    for (let i = 0; i < all.length; i++) { const c = all[i]; if (c === 0x22) inQuote = !inQuote; else if (c === 0x0a && !inQuote) { lines.push(all.subarray(s, i + 1)); s = i + 1; } }
    if (s < all.length) lines.push(all.subarray(s));
    const head = lines[0] ?? new Uint8Array(0), body = lines.slice(1);
    const max = this.bounds.segment_max;
    const segs = [];
    let cur = [], size = head.length;
    const close = () => { if (cur.length || !segs.length) segs.push(cur); cur = []; size = head.length; };
    for (const l of body) { if (cur.length && size + l.length > max) close(); cur.push(l); size += l.length; }
    close();
    const ev = typeof this.record.evidenceStore === "function" ? this.record.evidenceStore() : null;
    if (!ev) return refusal("EVIDENCE_STORAGE_NOT_CONFIGURED", localize("registers.refusal.EVIDENCE_STORAGE_NOT_CONFIGURED", "your team's Civicsmith has no evidence storage configured, so nothing was brought in"), {});
    const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const made = [];
    for (const [n, rows] of segs.entries()) {
      const seg = new Uint8Array(head.length + rows.reduce((t, l) => t + l.length, 0));
      seg.set(head, 0);
      let o = head.length;
      for (const l of rows) { seg.set(l, o); o += l.length; }
      const sha = hex(await crypto.subtle.digest("SHA-256", seg));
      if (!(await ev.head(sha))) await ev.put(sha, seg);
      made.push({ n, sha256: sha, bytes: seg.length, rows: rows.length, final: n === segs.length - 1, existed: false });
    }
    const at_ = this.nowIso();
    const p = { piece: pieceKey, state: "reading", source: "file", address: null, retrieved_at: at_, source_date: "not_stated",
                original: { sha256: end.original.sha256, bytes: end.original.bytes, covers: end.original.covers },
                reduced: { rows_in: end.reduced.rows_in, rows_out: end.reduced.rows_out, rows_undetermined: end.reduced.rows_undetermined, withheld_cells: end.reduced.withheld_cells,
                           kept_columns: end.reduced.kept_columns, dropped_columns: end.reduced.dropped_columns },
                segments: made };
    const dup = this.one(`SELECT * FROM register_imports WHERE register=? AND filter_fp=? AND scope_key=? AND state IN ('queued','fetching','reading','paused') ORDER BY import_id LIMIT 1`, def.key, checked.fingerprint, key);
    if (dup) return { ok: true, existed: true, import: dup.import_id, state: dup.state };
    const id = this.insertImport({ register: def.key, checked, sc, key, proj, kind: "import", by, holes, pieces: [p], cursor: { slices: 0, source: "file", ing: { piece: pieceKey, seg: 0, rows: 0 }, est_stored: all.length }, state: "reading" });
    this.tx(() => {
      for (const m of made)
        this.sql.exec(`INSERT OR REPLACE INTO register_segments (import_id, piece, n, sha256, bytes, rows, final, project, address, retrieved_at, source_date, original_sha256, original_bytes, covers, bundle_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
                      id, pieceKey, m.n, m.sha256, m.bytes, m.rows, m.final ? 1 : 0, proj, `file:${end.original.sha256.slice(0, 16)}#segment:${m.n}`, at_, "not_stated", end.original.sha256, end.original.bytes, end.original.covers);
      this.sql.exec(`UPDATE register_imports SET bytes_in = ? WHERE import_id=?`, end.original.bytes, id);
    });
    this.told(this.queuedListeners, { import: id, register: def.key, kind: "import" });
    return { ok: true, existed: false, import: id, state: "reading", source: "file" };
  },

  /** R11: one listener per module, told `{import}` after an import is queued, so `scheduler` arms its alarm (R9, R23). */
  onImportQueued(module, fn) {
    const refused = listenerRefusal(this.queuedListeners, module, fn);
    if (refused) return refused;
    this.queuedListeners.push({ module, fn });
    return { ok: true, module };
  },

  /* ------------------------------------------------------------------ R12: the alarm */

  importDue(now, host = null) {
    if (host && typeof host.paused === "function" && host.paused().paused) return false;
    const t = Number.isFinite(now) ? now : this.nowMs();
    return Number(this.one(`SELECT COUNT(*) AS n FROM register_imports WHERE (state IN ('queued','fetching','reading') OR (state='paused' AND paused_reason='host_cooling')) AND due_ms <= ?`, t).n) > 0;
  },
  importWake(now) {
    const t = Number.isFinite(now) ? now : this.nowMs();
    const r = this.one(`SELECT MIN(due_ms) AS m FROM register_imports WHERE state IN ('queued','fetching','reading') OR (state='paused' AND paused_reason='host_cooling')`);
    return r && r.m !== null && r.m !== undefined ? Math.max(Number(r.m), t) : null;
  },

  /** R12: claims the oldest due import under the host's epoch and runs at most one slice. */
  async importTick(now, budget, host = null) {
    const t = Number.isFinite(now) ? now : this.nowMs();
    const paused = host && typeof host.paused === "function" ? host.paused() : { paused: false };
    if (paused.paused) return { import: null, state: null, progress: null, done: false, paused: true };
    const row = this.one(`SELECT * FROM register_imports WHERE (state IN ('queued','fetching','reading') OR (state='paused' AND paused_reason='host_cooling')) AND due_ms <= ? ORDER BY import_id LIMIT 1`, t);
    if (!row) return { import: null, state: null, progress: null, done: false };
    const cursor = parse(row.cursor) || {};
    if (host && typeof host.openEpoch === "function") {
      const epoch = host.openEpoch(CONSUMER, t, EPOCH_MS);
      if (!host.claim(CONSUMER, `import:${row.import_id}:${cursor.slices ?? 0}`, epoch)) return { import: row.import_id, state: row.state, progress: this.progressOf(row), done: false, skipped: true };
      row._epoch = epoch;
    }
    const started = this.nowMs();
    let out;
    try { out = await this.slice(row, { budget_ms: Number.isFinite(budget) ? budget : this.bounds.SLICE_FETCH_MS, host, now: t }); }
    catch (e) { out = this.failSlice(row, "SLICE_FAILED", String((e && e.message) || e).slice(0, 200), t); }
    this.sql.exec(`UPDATE register_imports SET took_ms = COALESCE(took_ms, 0) + ? WHERE import_id=?`, Math.max(0, this.nowMs() - started), row.import_id);
    if (host && typeof host.closeEpoch === "function" && row._epoch !== undefined && !out.failed) host.closeEpoch(CONSUMER, row._epoch);
    const now_ = this.one(`SELECT * FROM register_imports WHERE import_id=?`, row.import_id);
    return { import: row.import_id, state: now_.state, progress: this.progressOf(now_), done: now_.state === "indexed" || now_.state === "failed" || now_.state === "stopped",
             ...(now_.reason ? { reason: now_.reason } : {}), ...(now_.retries ? { retries: now_.retries } : {}), ...(out.paused ? { paused: out.paused } : {}) };
  },

  /* a slice that failed: retried up to three times with growing delay, then failed with its reason (R12); not a failure when the host is cooling (R18) */
  failSlice(row, reason, detail, t, { final = false } = {}) {
    const retries = (row.retries ?? 0) + 1;
    if (final || retries > this.bounds.SLICE_RETRIES) {
      this.sql.exec(`UPDATE register_imports SET state='failed', reason=?, retries=?, finished_at=?, paused_reason=NULL WHERE import_id=?`, `${reason}${detail ? `: ${detail}` : ""}`.slice(0, 240), final ? row.retries : retries - 1, this.nowIso(), row.import_id);
    } else {
      this.sql.exec(`UPDATE register_imports SET retries=?, reason=?, due_ms=?, state='queued' WHERE import_id=?`, retries, `${reason}${detail ? `: ${detail}` : ""}`.slice(0, 240), t + this.bounds.RETRY_BASE_MS * 2 ** (retries - 1), row.import_id);
    }
    return { failed: true };
  },

  progressOf(row) {
    const pieces = parse(row.pieces) || [];
    const rowsOut = Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows WHERE import_id=?`, row.import_id).n);
    const segs = Number(this.one(`SELECT COUNT(*) AS n FROM register_segments WHERE import_id=?`, row.import_id).n);
    const total = pieces.reduce((s, p) => s + (Number.isFinite(p.probe?.bytes?.value) && p.probe.bytes.basis === "stated" ? p.probe.bytes.value : NaN), 0);
    const inBytes = row.bytes_in + pieces.reduce((s, p) => s + (p.state === "fetching" ? (p.progress_bytes ?? 0) : 0), 0);
    return { bytes_in: inBytes, rows_in: row.rows_in, rows_out: rowsOut, segments_stored: segs,
             ...(Number.isFinite(total) && total > 0 ? { percent: Math.min(100, Math.round((inBytes / total) * 1000) / 10) } : {}) };
  },

  /** R23: whether the shelf lets a slice write; a pause with the figures, or null */
  shelfPause(row, extra = 0, resumed = false) {
    const s = this.shelf(extra);
    if (s.free_bytes === null || !s.warn) return null;
    if (resumed && !s.over) return null;   /* resumed past the warning mark by a member's act: it runs on until the refusal mark (R23) */
    this.sql.exec(`UPDATE register_imports SET state='paused', paused_reason='shelf', reason=? WHERE import_id=?`, localize("registers.pause.shelf", "shelf: {pct}% of the object would be used", { pct: String(s.would_use_pct) }), row.import_id);
    return { paused: "shelf", shelf: s };
  },

  async slice(row, { budget_ms, host, now }) {
    const def = this.definitionOf(row.register)?.definition;
    if (!def) return this.failSlice(row, "NO_SUCH_REGISTER", "", now, { final: true });
    const pieces = parse(row.pieces) || [];
    const cursor = parse(row.cursor) || { slices: 0 };
    cursor.slices = (cursor.slices ?? 0) + 1;
    const save = (p = pieces, c = cursor, extra = "") => this.sql.exec(`UPDATE register_imports SET pieces=?, cursor=?${extra} WHERE import_id=?`, json(p), json(c), row.import_id);
    const phase = pieces.find((p) => p.state !== "done");
    if (!this.nowStarted(row)) this.sql.exec(`UPDATE register_imports SET started_at=? WHERE import_id=?`, this.nowIso(), row.import_id);
    /* the bytes still to be written: none once the segments are stored (reading) */
    const pauseShelf = this.shelfPause(row, cursor.ing ? 0 : (cursor.est_stored ?? 0), cursor.shelf_resumed === true);
    if (pauseShelf) { save(); return pauseShelf; }
    if (row.state === "paused") this.sql.exec(`UPDATE register_imports SET state='fetching', paused_reason=NULL WHERE import_id=?`, row.import_id);
    if (!phase) return this.finish(row, def, pieces, cursor, now);
    if (phase.state === "pending" || phase.state === "fetching") return this.fetchSlice(row, def, pieces, phase, cursor, { budget_ms, host, now }, save);
    return this.readSlice(row, def, pieces, phase, cursor, { budget_ms, now }, save);
  },
  nowStarted(row) { return !!this.one(`SELECT started_at FROM register_imports WHERE import_id=?`, row.import_id).started_at; },

  /* ---- fetching: one `streamRegister` slice of a piece ---- */
  async fetchSlice(row, def, pieces, p, cursor, { budget_ms, host, now }, save) {
    if (p.state === "pending") {
      p.state = "fetching";
      /* the piece's stated size and date, by the governed probe that fetches no body (R14, R128) */
      try {
        const pr = await this.acq.probeRegister(this.store, { definition: def, piece: p.piece, filter: parse(row.filter), holes: parse(row.holes), budget_ms: this.bounds.DELTA_BUDGET_MS, view: this.view() }, { bounds: this.bounds });
        if (pr && pr.ok === true) p.probe = { bytes: pr.bytes, rows: pr.rows, validators: pr.validators, source_date: pr.source_date, refresh_validators: pr.refresh_validators };
        else if (pr && pr.reason === "HOST_COOLING_OFF") return this.cooling(row, pieces, cursor, pr, now, save);
      } catch { /* the probe is a courtesy; the fetch decides */ }
      this.sql.exec(`UPDATE register_imports SET state='fetching' WHERE import_id=?`, row.import_id);
    }
    const refreshArg = cursor.force ? {} : (row.kind === "refresh" && row.previous ? this.refreshProbe(row.previous, p.piece) : null);
    const args = { definition: def, piece: p.piece, holes: parse(row.holes), filter: parse(row.filter), import: String(row.import_id), resume: p.resume ?? null,
                   budget_ms, budget_bytes: this.bounds.SLICE_FETCH_BYTES, viewer: row.on_behalf || row.author, view: this.view(),
                   ...(refreshArg ? { refresh: refreshArg } : {}), ...(cursor.force ? { force: true } : {}) };
    const r = await this.acq.streamRegister(this.store, args, { bounds: this.bounds });
    if (!r || r.ok !== true) {
      if (r && r.reason === "HOST_COOLING_OFF") return this.cooling(row, pieces, cursor, r, now, save);
      if (r && r.reason === "REFRESH_UNCHANGED") { save(); this.sql.exec(`UPDATE register_imports SET state='indexed', reason='REFRESH_UNCHANGED', complete=1, finished_at=?, imported_at=?, probe=? WHERE import_id=?`, this.nowIso(), this.nowIso(), json(p.probe ?? null), row.import_id); return { unchanged: true }; }
      const code = r?.reason || "FETCH_FAILED";
      const transient = ["FETCH_FAILED", "SOURCE_REFUSED"].includes(code) && !(Number.isFinite(r?.status) && r.status >= 400 && r.status < 500);
      save(pieces, cursor);
      return this.failSlice(row, code, r?.detail ? String(r.detail).slice(0, 160) : "", now, { final: !transient });
    }
    if (!r.done) {
      p.resume = r.resume;
      p.progress_bytes = r.progress?.bytes_in ?? 0;
      save(pieces, cursor);
      this.sql.exec(`UPDATE register_imports SET due_ms=?, state='fetching' WHERE import_id=?`, now, row.import_id);
      return { fetching: true };
    }
    /* the piece is whole: its segments are filed and described (R14), and its reduction added to the import's (R15) */
    const at = this.nowIso();
    let landed = [];
    for (const doc of r.documents ?? []) {
      const filed = this.tx(() => this.landDocument(row, def, doc, at));
      if (!filed.ok) { save(pieces, cursor); return this.failSlice(row, "NOT_FILED", String(filed.reason || filed.detail || "").slice(0, 160), now); }
      const bundle = filed.bundle_id;
      landed.push({ doc, bundle });
    }
    const oneDoc = (r.documents ?? [])[0];
    p.state = "reading";
    const pieceDef = (def.pieces || []).find((x) => x.key === p.piece);
    const holes = parse(row.holes) || {};
    p.address = oneDoc ? String(oneDoc.locator).replace(/(!.*)?#segment:\d+$/, "") : (pieceDef ? String(pieceDef.locator).replace(/\{([a-z_]+)\}/g, (m, k) => holes[k] ?? m) : null);
    p.retrieved_at = oneDoc?.retrieved ?? at;
    p.source_date = p.probe?.source_date ?? "not_stated";
    p.original = { sha256: r.original.sha256, bytes: r.original.bytes, covers: r.original.covers };
    p.reduced = { rows_in: r.reduced.rows_in, rows_out: r.reduced.rows_out, rows_undetermined: r.reduced.rows_undetermined, withheld_cells: r.reduced.withheld_cells,
                  kept_columns: r.reduced.kept_columns, dropped_columns: r.reduced.dropped_columns };
    p.segments = r.segments.map((s) => ({ n: s.n, sha256: s.sha256, bytes: s.bytes, rows: s.rows, final: s.final, existed: s.existed }));
    p.resume = null;
    this.tx(() => {
      for (const s of r.segments) {
        const b = landed.find((l) => l.doc.origin.segment === s.n)
          ?? (this.one(`SELECT bundle_id FROM register_segments WHERE sha256=? AND bundle_id IS NOT NULL LIMIT 1`, s.sha256) ? { bundle: this.one(`SELECT bundle_id FROM register_segments WHERE sha256=? AND bundle_id IS NOT NULL LIMIT 1`, s.sha256).bundle_id } : null);
        this.sql.exec(`INSERT OR REPLACE INTO register_segments (import_id, piece, n, sha256, bytes, rows, final, project, address, retrieved_at, source_date, original_sha256, original_bytes, covers, bundle_id)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, row.import_id, p.piece, s.n, s.sha256, s.bytes, s.rows, s.final ? 1 : 0, row.project, `${p.address}#segment:${s.n}`,
                      p.retrieved_at, p.source_date, r.original.sha256, r.original.bytes, r.original.covers, b ? b.bundle : null);
      }
      cursor.ing = { piece: p.piece, seg: 0, rows: 0 };
      cursor.est_stored = r.segments.reduce((n, s) => n + s.bytes, 0);
      save(pieces, cursor);
      this.sql.exec(`UPDATE register_imports SET bytes_in = bytes_in + ?, due_ms=? WHERE import_id=?`, r.original.bytes, now, row.import_id);
    });
    return { fetched: true };
  },
  /** R14, R19: a segment filed as an information document through `promotion`, in the project it belongs to (frontmatter `project`), collected and never verified;
   *  the reduced bytes were stored by `acquisition`, and the document carries their provenance. Answers `{ok, bundle_id}` or the promotion's refusal. */
  landDocument(row, def, doc, at) {
    try {
      const cap = doc.capture;
      if (typeof doc.file !== "string" || !Number.isSafeInteger(cap.bytes)) return { ok: false, reason: localize("registers.land.no_file", "capture's answer named no primary file and size to land") };
      const enc = (t) => { const b = new TextEncoder().encode(t); return { text: t, bytes: b.length, sha256: createSha256().update(b).hex() }; };
      const id = `${this.record.allocId("INFO", at.slice(0, 4)).id}-register`;
      const title = localize("registers.land.title", "Register {register}, import {import}, segment {n}", { register: def.key, import: String(row.import_id), n: String(doc.origin.segment) }).replace(/[\p{Cc}]+/gu, " ").slice(0, 200);
      const md = ["---", `id: ${id}`, "object_type: information", "schema: information@2", `title: ${JSON.stringify(title)}`, "current_state: collected", "prior_state: null",
        `created: "${at}"`, `last_updated: "${at}"`, "produced_by:", "  mode: agent", "  capability_tier: session", ...(row.project ? [`project: ${row.project}`] : []),
        "references: []", "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting",
        "source_status: unchanged", "source:", `  locator: ${JSON.stringify(doc.locator)}`, `  retrieved: ${doc.retrieved}`, "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "",
        localize("registers.land.summary", "A segment of the register {register} as it was brought in, with the columns that must not be kept left out; import {import}. Its bytes are `{file}`; nothing here summarises them.", { register: def.key, import: String(row.import_id), file: doc.file }),
        "", "## Provenance Notes", "",
        localize("registers.land.notes", "Brought in by import {import} at {at} under the register's definition; the original is not kept, only its fingerprint.", { import: String(row.import_id), at }),
        "", "## Session Log", "", `### Session ${at} | Collected | ${MACHINE_AUTHOR_PREFIX}registers`, localize("registers.land.trigger", "Trigger: register import {import}", { import: String(row.import_id) }),
        localize("registers.land.changes", "Changes: created from a register import's reduced segment."), "", "## Review Notes", ""].join("\n");
      const blob = (f) => (f && typeof f.file === "string" && /^[0-9a-f]{64}$/.test(String(f.sha256 || "")) && Number.isSafeInteger(f.bytes) ? { path: f.file, blobSha: f.sha256, sha256: f.sha256, bytes: f.bytes } : null);
      const blobs = [blob({ file: doc.file, sha256: cap.sha256, bytes: cap.bytes }), blob(doc.shell), ...(Array.isArray(doc.parts) ? doc.parts.map(blob) : [])].filter(Boolean);
      const seen = new Set();
      const files = [{ path: "bundle.md", ...enc(md) }, { path: "data/provenance.json", ...enc(JSON.stringify({ documents: [doc] }, null, 2)) }, ...blobs.filter((f) => (seen.has(f.path) ? false : seen.add(f.path)))];
      const p = this.promotion.promote({ bundleId: id, base: null, snapKey: `${at.replace(/[-:]/g, "")}_${row.import_id}_${doc.origin.segment}`, author: `${MACHINE_AUTHOR_PREFIX}registers`, files,
        meta: { object_type: "information", title, current_state: "collected", prior_state: null, created: at, last_updated: at, criticality: "supporting" },
        register: [{ sha256: cap.sha256, path: doc.file, encoding: "binary", bytes: cap.bytes }] });
      return p && p.ok ? { ok: true, bundle_id: id } : { ok: false, reason: (p && (p.reason || p.code)) || null, detail: String((p && p.detail) || "the promotion was refused").slice(0, 300) };
    } catch (e) { return { ok: false, reason: "LAND_FAILED", detail: String((e && e.message) || e).slice(0, 200) }; }
  },
  refreshProbe(previousId, piece) {
    const prev = this.one(`SELECT pieces FROM register_imports WHERE import_id=?`, previousId);
    const ps = prev ? parse(prev.pieces) || [] : [];
    const q = ps.find((x) => x.piece === piece);
    return q && q.probe ? { probe: q.probe } : null;
  },
  cooling(row, pieces, cursor, r, now, save) {
    save(pieces, cursor);
    this.sql.exec(`UPDATE register_imports SET state='paused', paused_reason='host_cooling', due_ms=?, reason=? WHERE import_id=?`, now + (Number(r.retry_in_ms) || this.bounds.RETRY_BASE_MS), "host_cooling", row.import_id);
    return { paused: "host_cooling" };
  },

  /* ---- reading: the arrived segments into the row store, a bounded batch at a time ---- */
  async readSlice(row, def, pieces, p, cursor, { budget_ms, now }, save) {
    const ing = cursor.ing && cursor.ing.piece === p.piece ? cursor.ing : { piece: p.piece, seg: 0, rows: 0 };
    const deadline = this.nowMs() + budget_ms;
    const kept = this.kept(def);
    const columns = kept;
    const scope_key = row.scope_key;
    const multi = this.dataPieces(def).length > 1;
    const removed = (key) => !!this.one(`SELECT 1 AS x FROM register_removed WHERE register=? AND row_key=?`, row.register, key);
    let more = true, batches = 0;
    while (more && batches++ < this.bounds.INGEST_SLICE_BATCHES && this.nowMs() < deadline) {
      const seg = p.segments[ing.seg];
      if (!seg) { more = false; break; }
      const bytes = await this.bytesOf(seg.sha256);
      if (!bytes) { save(pieces, { ...cursor, ing }); return this.failSlice(row, "SEGMENT_NOT_HELD", seg.sha256.slice(0, 12), now); }
      /* a batch: read on from the byte where the last batch stopped (the cursor's `byte`), one row at a time, until the
         transaction bound; nothing already read is parsed again, so a batch's time does not grow with its place in the segment */
      const batchStart = this.nowMs();
      const rowCap = Math.max(20, Math.min(this.bounds.INGEST_BATCH_ROWS, Math.floor((this.bounds.SLICE_TX_MS * 0.6) / Math.max(0.001, this.rowMs ?? 0.5))));
      /* each row read, in order: its byte, its index, and what writing it means (a new version, one already held, a tombstoned key, a replayed place) */
      const items = [];
      const placed = (idx) => this.one(`SELECT 1 AS x FROM register_import_rows WHERE import_id=? AND piece=? AND seg_n=? AND row_no=?`, row.import_id, p.piece, seg.n, idx);
      let k = ing.rows, taken = 0, stop = false;
      const occ = new Map();
      const occurrence = (digest) => {
        if (!occ.has(digest)) occ.set(digest, Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows WHERE import_id=? AND row_key >= ? AND row_key < ?`, row.import_id, `${digest}${SEP}`, `${digest}${SEP}\uffff`).n));
        occ.set(digest, occ.get(digest) + 1);
        return occ.get(digest);
      };
      const headEnd = rowEnd(bytes, 0);
      const header = fieldsOf(bytes.subarray(0, headEnd));
      let pos = Number.isSafeInteger(ing.byte) ? ing.byte : headEnd;
      if (!Number.isSafeInteger(ing.byte)) for (let n = 0; n < ing.rows && pos < bytes.length; n++) pos = rowEnd(bytes, pos);   /* a cursor from before `byte` was kept */
      while (pos < bytes.length) {
        if (taken >= rowCap || this.nowMs() - batchStart >= this.bounds.SLICE_TX_MS) { stop = true; break; }
        const at = pos, end = rowEnd(bytes, pos);
        const fields = fieldsOf(bytes.subarray(pos, end));
        pos = end;
        if (!fields) continue;
        const idx = k++;
        taken++;
        if (placed(idx)) { items.push({ at, idx, kind: "placed" }); continue; }   /* a replayed position: already read (R17) */
        const cells = {};
        for (let i = 1; i < header.length; i++) cells[header[i]] = fields[i] ?? "";
        const src_row = Number(fields[0]);
        const hash = contentHashOf(cells, columns);
        let key;
        if (def.row_key_basis === "content") key = `${hash}${SEP}${occurrence(hash)}`;
        else key = (def.row_key || []).map((c) => cells[c] ?? "").join(SEP);
        if (multi) key = `${p.piece}${SEP}${key}`;
        if (removed(key)) { items.push({ at, idx, kind: "tomb" }); continue; }
        const version = { scope_key, register: row.register, row_key: key, content_hash: hash, project: row.project };
        const d = this.port.has(version) ? null : { ...version, first_import: row.import_id, segment_sha: seg.sha256, seg_row: idx + 1, byte_at: at, byte_len: end - at, src_row, cells, definition: def };
        items.push({ at, idx, kind: "row", m: { idx, key, hash, src_row }, d });
      }
      const wrote = performance.now();
      let writ = 0;
      this.tx(() => {
        /* R20: the write itself is bounded by time: rows are written one by one, and at half of SLICE_TX_MS the batch ends at the
           first row not yet written, whose byte the cursor keeps; a slow stretch of the store or a pause makes a shorter batch,
           never a longer hold of the worker */
        const writeEnd = wrote + this.bounds.SLICE_TX_MS * 0.5;
        let written = 0, same = 0, tomb = 0, next = null;
        for (let i = 0; i < items.length; i++) {
          if (i > 0 && performance.now() >= writeEnd) { next = items[i]; break; }
          const it = items[i];
          writ++;
          if (it.kind === "tomb") { tomb++; continue; }
          if (it.kind !== "row") continue;
          if (it.d) { const w = this.port.put([it.d]); written += w.written; same += w.existed; } else same++;
          this.sql.exec(`INSERT OR IGNORE INTO register_import_rows (import_id, register, piece, seg_n, row_no, row_key, content_hash, src_row, project) VALUES (?,?,?,?,?,?,?,?,?)`,
                        row.import_id, row.register, p.piece, seg.n, it.m.idx, it.m.key, it.m.hash, it.m.src_row, row.project);
        }
        this.sql.exec(`UPDATE register_imports SET rows_new = rows_new + ?, rows_unchanged = rows_unchanged + ?, rows_tombstoned = rows_tombstoned + ? WHERE import_id=?`, written, same, tomb, row.import_id);
        /* rows skipped over as tombstoned or already placed move the position past them too */
        if (next) { ing.rows = next.idx; ing.byte = next.at; }
        else if (stop) { ing.rows += taken; ing.byte = pos; }
        else { ing.seg += 1; ing.rows = 0; delete ing.byte; }
        cursor.ing = ing;
        const done = ing.seg >= p.segments.length;
        if (done) p.state = "done";
        save(pieces, cursor);
      });
      if (writ > 0) this.rowMs = (this.rowMs ?? 0.5) * 0.5 + ((performance.now() - wrote) / writ) * 0.5;
      if (ing.seg >= p.segments.length) { more = false; break; }
      await tick();
    }
    this.sql.exec(`UPDATE register_imports SET due_ms=?, state='reading' WHERE import_id=?`, now, row.import_id);
    return { reading: true };
  },

  /* ---- the end of an import: its figures, R10's record, and a refresh's change (R33) ---- */
  finish(row, def, pieces, cursor, now) {
    const imported = pieces.map((p) => p.retrieved_at).filter(Boolean).sort()[0] ?? this.nowIso();
    const dates = pieces.map((p) => p.source_date).filter((d) => d && d !== "not_stated").sort();
    const sum = (f) => pieces.reduce((n, p) => n + (p.reduced?.[f] ?? 0), 0);
    const reduction = { kept_columns: pieces[0]?.reduced?.kept_columns ?? [], dropped_columns: [...new Map(pieces.flatMap((p) => p.reduced?.dropped_columns ?? []).map((c) => [c.name, c])).values()],
                        withheld_cells: sum("withheld_cells"), rows_in: sum("rows_in"), rows_out: sum("rows_out"), rows_undetermined: sum("rows_undetermined"),
                        original_fingerprints: pieces.map((p) => ({ piece: p.piece, sha256: p.original?.sha256, bytes: p.original?.bytes, covers: p.original?.covers })), reason: "reduced under K1485" };
    const finished = this.nowIso();
    const probe = pieces.map((p) => ({ piece: p.piece, ...(p.probe ?? {}) }));
    this.sql.exec(`UPDATE register_imports SET state='indexed', complete=1, finished_at=?, imported_at=?, source_date=?, rows_in=?, rows_out=?, rows_undetermined=?, reduction=?, probe=?, reason=NULL, paused_reason=NULL WHERE import_id=?`,
                  finished, imported, dates[0] ?? "not_stated", reduction.rows_in, reduction.rows_out, reduction.rows_undetermined, json(reduction), json(probe), row.import_id);
    if (row.kind === "refresh" && row.previous) this.recordChange(row.import_id);
    return { finished: true };
  },

  /* ------------------------------------------------------------------ R13: status, pause, resume, stop */

  importStatus({ import: id, viewer } = {}) {
    const row = this.importSeen(id, viewer);
    if (!row) return refusal("NO_SUCH_REGISTER_IMPORT", localize("registers.refusal.NO_SUCH_REGISTER_IMPORT", "no register import answers to that id here"), {});
    const pieces = (parse(row.pieces) || []).map((p) => ({ piece: p.piece, state: p.state === "pending" ? "pending" : p.state === "fetching" || p.state === "reading" ? "reading" : p.state === "failed" ? "failed" : "done",
      ...(p.address ? { address: p.address, retrieved_at: p.retrieved_at, source_date: p.source_date, original: p.original, segments: (p.segments || []).map((s) => ({ n: s.n, sha256: s.sha256, bytes: s.bytes, rows: s.rows, final: s.final, existed: !!s.existed })) } : {}) }));
    return { ok: true, import: row.import_id, register: row.register, scope: row.scope, ...(row.project ? { project: row.project } : {}), state: row.state, pieces, progress: this.progressOf(row),
             started_at: row.started_at, finished_at: row.finished_at, took_ms: row.took_ms, source_date: row.source_date ?? "not_stated", imported_at: row.imported_at,
             reduction: parse(row.reduction) ? { ...parse(row.reduction), label_key: "register.reduced" } : null,
             reason: row.reason ?? null, retries: row.retries,
             counts: { new: row.rows_new, unchanged: row.rows_unchanged, tombstoned: row.rows_tombstoned } };
  },

  importSet({ import: id, action, author, viewer } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_SET_IMPORT", localize("registers.refusal.MACHINE_CANNOT_SET_IMPORT", "pausing, resuming or stopping an import is a member's act"), {});
    const row = this.importSeen(id, viewer ?? by);
    if (!row) return refusal("NO_SUCH_REGISTER_IMPORT", localize("registers.refusal.NO_SUCH_REGISTER_IMPORT", "no register import answers to that id here"), {});
    if (row.author !== by && !this.isAdmin(by)) return refusal("NOT_YOUR_IMPORT", localize("registers.refusal.NOT_YOUR_IMPORT", "only the member who started an import, or an administrator, pauses, resumes or stops it"), {});
    if (!["pause", "resume", "stop"].includes(action)) return refusal("IMPORT_ACTION_UNKNOWN", localize("registers.refusal.IMPORT_ACTION_UNKNOWN", "an import is paused, resumed or stopped"), { field: "action" });
    if (action === "stop") {
      if (row.state === "stopped") return { ok: true, existed: true, state: "stopped" };
      if (["indexed", "failed"].includes(row.state)) return refusal("IMPORT_ENDED", localize("registers.refusal.IMPORT_ENDED", "that import has already ended"), { state: row.state });
      this.sql.exec(`UPDATE register_imports SET state='stopped', finished_at=?, paused_reason=NULL WHERE import_id=?`, this.nowIso(), row.import_id);
      const rowsKept = Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows WHERE import_id=?`, row.import_id).n);
      return { ok: true, state: "stopped", kept: { rows: rowsKept, segments: Number(this.one(`SELECT COUNT(*) AS n FROM register_segments WHERE import_id=?`, row.import_id).n) } };
    }
    if (row.state === "stopped") return refusal("IMPORT_STOPPED", localize("registers.refusal.IMPORT_STOPPED", "a stopped import is not resumed; start a new one"), {});
    if (action === "pause") {
      if (row.state === "paused") return { ok: true, existed: true, state: "paused" };
      if (!ACTIVE.includes(row.state)) return refusal("IMPORT_ENDED", localize("registers.refusal.IMPORT_ENDED", "that import has already ended"), { state: row.state });
      this.sql.exec(`UPDATE register_imports SET state='paused', paused_reason='member' WHERE import_id=?`, row.import_id);
      return { ok: true, state: "paused", reason: "member" };
    }
    if (row.state !== "paused") return { ok: true, existed: true, state: row.state };
    const s = this.shelf(parse(row.cursor)?.ing ? 0 : (parse(row.cursor)?.est_stored ?? 0));
    if (row.paused_reason === "shelf" && s.free_bytes !== null && s.would_use_pct >= this.bounds.SHELF_REFUSE_PCT)
      return refusal("SHELF_NEARLY_FULL", localize("registers.refusal.SHELF_NEARLY_FULL", "the object is nearly full ({pct}%), so the import is not resumed until room is made", { pct: String(s.would_use_pct) }), { shelf: s });
    const cur = parse(row.cursor) || {};
    if (row.paused_reason === "shelf") cur.shelf_resumed = true;
    this.sql.exec(`UPDATE register_imports SET state=?, paused_reason=NULL, due_ms=?, cursor=? WHERE import_id=?`, cur.ing ? "reading" : "fetching", this.nowMs(), json(cur), row.import_id);
    return { ok: true, state: cur.ing ? "reading" : "fetching" };
  },

  /** R13: for the queue, imports that finished, stopped or failed (not refreshes), after a cursor. */
  importsEnded({ after = 0, limit = 50 } = {}) {
    const n = Math.min(Math.max(1, Number(limit) || 50), 200);
    return this.rows(`SELECT import_id, register, scope, project, state, reason, finished_at, rows_out FROM register_imports WHERE kind='import' AND state IN ('indexed','stopped','failed') AND import_id > ? ORDER BY import_id LIMIT ?`, Number(after) || 0, n)
      .map((r) => ({ import: r.import_id, register: r.register, scope: r.scope, ...(r.project ? { project: r.project } : {}), state: r.state, ...(r.reason ? { reason: r.reason } : {}), finished_at: r.finished_at, rows_out: r.rows_out }));
  },

  /* ------------------------------------------------------------------ the registrations that go the other way */

  holdsSegment(sha) { return typeof sha === "string" && !!this.one(`SELECT 1 AS x FROM register_segments WHERE sha256=?`, sha); },
  heldAs(sha) {
    const s = typeof sha === "string" ? this.one(`SELECT s.import_id, i.register FROM register_segments s JOIN register_imports i ON i.import_id=s.import_id WHERE s.sha256=? ORDER BY s.import_id LIMIT 1`, sha) : null;
    return s ? { register: s.register, import: s.import_id } : null;
  },
  /** content R65, R67: the reduced file's row `n` (the header is row 1) as the row store holds it, with the reduction it points into */
  rowAtSegment(sha, n) {
    const s = this.one(`SELECT * FROM register_segments WHERE sha256=? ORDER BY import_id LIMIT 1`, sha);
    if (!s || !Number.isInteger(n) || n < 1) return null;
    const imp = this.one(`SELECT * FROM register_imports WHERE import_id=?`, s.import_id);
    const def = this.definitionOf(imp.register)?.definition;
    if (!def) return null;
    const red = parse(imp.reduction) || {};
    const kept = ["src_row", ...this.kept(def)];
    if (n === 1) return { cells: Object.fromEntries(kept.map((c) => [c, c])), reduced: { segment_sha: sha, original_sha256: s.original_sha256, original_covers: s.covers, dropped_columns: (red.dropped_columns || []).map((c) => c.name), src_row: null, import: s.import_id } };
    const m = this.one(`SELECT * FROM register_import_rows WHERE import_id=? AND piece=? AND seg_n=? AND row_no=?`, s.import_id, s.piece, s.n, n - 2);
    if (!m) return null;
    const c = this.port.get({ scope_key: imp.scope_key, register: imp.register, row_key: m.row_key, content_hash: m.content_hash });
    if (!c) return null;
    return { cells: { src_row: String(m.src_row), ...c.cells }, reduced: { segment_sha: sha, original_sha256: s.original_sha256, original_covers: s.covers, dropped_columns: (red.dropped_columns || []).map((x) => x.name), src_row: m.src_row, import: s.import_id } };
  },

  /* ------------------------------------------------------------------ small helpers */
  told(list, payload) { for (const l of list) { try { l.fn(payload); } catch { /* the act stands */ } } },
};

export { sha256HexSync, autoWatchable, filterFingerprint, SCOPE_TEAM };
