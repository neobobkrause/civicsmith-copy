/* registers — search of held rows, reading and citing a row, comparing two imports, and the removal of a row (requirements:
 * R24–R31). Nothing here fetches, resolves a name, creates an entity or link, logs a query, or judges anyone (R26, R36, R37).
 * Methods installed on `Registers`. */
import { sha256HexSync } from "../record-grammar/index.mjs";
import { matches, filterFingerprint } from "../register-readers/index.mjs";
import { isObj, str, json, parse, refusal } from "./core.mjs";
import { decodeAfter, countableFilter } from "./port.mjs";
import { localize } from "../setup-words/index.mjs";
import { reducedParser, csvField } from "./reduced.mjs";

const b64 = (o) => btoa(JSON.stringify(o));
const unb64 = (s) => { try { return JSON.parse(atob(String(s))); } catch { return null; } };

/* the search order of the port, for merging several registers' streams */
function before(a, b) {
  const ad = a.date ?? null, bd = b.date ?? null;
  if ((ad === null) !== (bd === null)) return ad !== null;
  if (ad !== bd) return ad > bd;
  if (a.row_key !== b.row_key) return a.row_key < b.row_key;
  if (a.content_hash !== b.content_hash) return a.content_hash < b.content_hash;
  return a.scope_key <= b.scope_key;
}
function* merged(gens) {
  const heads = gens.map((g) => ({ g, cur: g.next() })).filter((h) => !h.cur.done);
  while (heads.length) {
    let best = 0;
    for (let i = 1; i < heads.length; i++) if (before(heads[i].cur.value, heads[best].cur.value)) best = i;
    yield heads[best].cur.value;
    heads[best].cur = heads[best].g.next();
    if (heads[best].cur.done) heads.splice(best, 1);
  }
}

export const searchMethods = {
  /* ------------------------------------------------------------------ R24, R25, R27: search */

  searchRows({ scope = {}, name, organization, amount, date, filer_id, form, limit, after, budget_ms, viewer } = {}) {
    const sc = isObj(scope) ? scope : {};
    /* the registers and imports in scope */
    let importRow = null;
    let targets;
    if (sc.import !== undefined && sc.import !== null) {
      importRow = this.importSeen(sc.import, viewer);
      if (!importRow) return refusal("NO_SUCH_REGISTER_IMPORT", localize("registers.refusal.NO_SUCH_REGISTER_IMPORT", "no register import answers to that id here"), {});
      targets = [importRow.register];
    } else if (sc.register !== undefined && sc.register !== null) {
      if (!this.definitionOf(sc.register)) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), { register: typeof sc.register === "string" ? sc.register : null });
      targets = [str(sc.register)];
    } else targets = [...this.shipped().map((r) => r.key), ...this.ownLatest().map((o) => o.key)];
    const raw = {};
    if (name !== undefined && name !== null) raw.names = [name];
    if (organization !== undefined && organization !== null) raw.organizations = [organization];
    if (amount !== undefined && amount !== null) raw.amount = amount;
    if (date !== undefined && date !== null) raw.date = date;
    if (filer_id !== undefined && filer_id !== null) raw.filer_ids = [filer_id];
    if (form !== undefined && form !== null) raw.forms = [form];
    const filters = [];
    let firstRefusal = null;
    for (const key of targets) {
      const d = this.definitionOf(key).definition;
      const c = this.checkFilter(d, raw);
      if (!c.ok) { firstRefusal ??= c; continue; }
      filters.push({ key, def: d, filter: c.filter });
    }
    if (!filters.length) return firstRefusal ?? { ok: true, rows: [], matched: 0, capped: false, imports: [], no_import_held: true };
    if (firstRefusal && (sc.register || sc.import)) return firstRefusal;
    const n = limit === undefined || limit === null ? this.bounds.SEARCH_LIMIT_DEFAULT : limit;
    if (!Number.isInteger(n) || n < 1 || n > this.bounds.SEARCH_LIMIT_MAX) return refusal("SEARCH_BAD_LIMIT", localize("registers.refusal.SEARCH_BAD_LIMIT", "a search returns 1 to {max} rows at a time", { max: String(this.bounds.SEARCH_LIMIT_MAX) }), {});
    const budget = budget_ms === undefined || budget_ms === null ? this.bounds.SEARCH_BUDGET_DEFAULT : budget_ms;
    if (!Number.isFinite(budget) || budget < 1 || budget > this.bounds.SEARCH_BUDGET_MAX) return refusal("SEARCH_BAD_BUDGET", localize("registers.refusal.SEARCH_BAD_BUDGET", "a search may take at most {max} ms", { max: String(this.bounds.SEARCH_BUDGET_MAX) }), {});
    let cursor = { c: null, n: 0 };
    if (after !== undefined && after !== null && after !== "") {
      const u = unb64(after);
      if (!isObj(u) || !Number.isInteger(u.n) || u.n < 0 || (u.c !== null && !decodeAfter(u.c))) return refusal("BAD_CURSOR", localize("registers.refusal.BAD_CURSOR", "that page marker is not one this search gave"), {});
      cursor = u;
    }
    /* R27: a register with a data-use limit is searched only by a criterion, and pages to a cap */
    const limited = filters.filter((f) => this.useLimitOf(f.def));
    if (limited.length && filters.some((f) => this.useLimitOf(f.def) && !Object.keys(f.filter).length)) return refusal("NO_CRITERIA", localize("registers.refusal.NO_CRITERIA", "this register is searched by a name, a number, an amount or a date, never listed whole"), {});
    let allowed = n;
    if (limited.length) {
      if (cursor.n >= this.bounds.RESULT_CAP) return refusal("RESULT_CAP", localize("registers.refusal.RESULT_CAP", "a search of this register shows at most {max} rows; narrow it", { max: String(this.bounds.RESULT_CAP) }), {});
      allowed = Math.min(n, this.bounds.RESULT_CAP - cursor.n);
    }
    const scopes = this.scopesOf(viewer);
    const imports = this.rows(`SELECT import_id, register, imported_at, source_date, scope_key FROM register_imports WHERE register IN (${targets.map(() => "?").join(",")}) AND (SELECT COUNT(*) FROM register_segments s WHERE s.import_id=register_imports.import_id) > 0 ORDER BY import_id`, ...targets)
      .filter((i) => scopes.includes(i.scope_key) && (!importRow || i.import_id === importRow.import_id));
    const searched = imports.map((i) => ({ import: i.import_id, imported_at: i.imported_at, source_date: i.source_date ?? "not_stated" }));
    if (!imports.length) return { ok: true, rows: [], matched: 0, capped: false, imports: [], no_import_held: true, absence: { level: "no_import_held", imports: [] }, text_key: "register.absence.no_import" };
    const gens = filters.map((f) => this.port.scan({ scopes, register: f.key, importId: importRow ? importRow.import_id : null, filter: f.filter, after: cursor.c })[Symbol.iterator]());
    const defOf = new Map(filters.map((f) => [f.key, f]));
    const countable = typeof this.port.countAfter === "function" && filters.every((f) => countableFilter(f.filter));
    const deadline = this.nowMs() + budget;
    const out = [];
    let matched = cursor.n, capped = false, stopped = null, last = null, prev = null, more = false;
    for (const r of merged(gens)) {
      if (this.nowMs() >= deadline) { stopped = { reason: "time" }; break; }
      const f = defOf.get(r.register);
      if (!matches(r.cells, f.filter, f.def)) continue;
      if (prev && prev.register === r.register && prev.row_key === r.row_key && prev.content_hash === r.content_hash) continue;
      prev = r;
      if (out.length < allowed) { out.push(this.rowShape(r, f.def, importRow, scopes)); last = r; matched++; continue; }
      more = true;
      /* past the page the matches are counted, exactly up to MATCH_COUNT_MAX, else `capped`; a later page still answers its rows (R24) */
      if (limited.length) break;
      /* a filter the index judges exactly is counted there, no row read, so a page's time does not grow with the matches held (R23) */
      if (countable) {
        const left = this.bounds.MATCH_COUNT_MAX - matched + 1;
        let n = 0;
        for (const f of filters) {
          if (n >= left) break;
          n += this.port.countAfter({ scopes, register: f.key, importId: importRow ? importRow.import_id : null, filter: f.filter, after: this.cursorOf(last), cap: left - n });
        }
        if (left <= 0 || n >= left) { capped = true; matched = Math.max(matched, this.bounds.MATCH_COUNT_MAX); } else matched += n;
        break;
      }
      if (matched >= this.bounds.MATCH_COUNT_MAX) { capped = true; break; }
      matched++;
    }
    /* the exact count to 10,000 over the rest is counted only while the budget lasts */
    if (matched > this.bounds.MATCH_COUNT_MAX) { matched = this.bounds.MATCH_COUNT_MAX; capped = true; }
    const body = { ok: true, rows: out, matched, capped, imports: searched };
    if (more && out.length) body.next = b64({ c: this.cursorOf(last), n: cursor.n + out.length });
    else if (limited.length && out.length === allowed && cursor.n + out.length >= this.bounds.RESULT_CAP && more) body.capped_by = "RESULT_CAP";
    if (stopped) { body.stopped = stopped; body.more_may_exist = true; if (out.length) body.next = b64({ c: this.cursorOf(last), n: cursor.n + out.length }); }
    else if (!out.length && cursor.n === 0) body.absence = { level: "import", imports: searched, text_key: "register.absence.import" };
    return body;
  },
  cursorOf(r) { return btoa(JSON.stringify([r.date ?? null, r.row_key, r.content_hash, r.scope_key])); },

  /* a row as an answer: its cells as written, the import that holds it, its version */
  rowShape(r, def, importRow, scopes) {
    const imp = importRow ?? this.one(`SELECT i.* FROM register_import_rows m JOIN register_imports i ON i.import_id=m.import_id WHERE m.row_key=? AND m.content_hash=? AND i.register=? AND i.scope_key IN (${scopes.map(() => "?").join(",")}) ORDER BY i.import_id DESC LIMIT 1`, r.row_key, r.content_hash, r.register, ...scopes);
    const versions = this.port.versionsOf({ scopes, register: r.register, row_key: r.row_key });
    const hashes = [...new Set(versions.map((v) => v.content_hash))];
    const cited = !!this.one(`SELECT 1 AS x FROM register_cites WHERE register=? AND row_key=? AND content_hash=?`, r.register, r.row_key, r.content_hash);
    const lim = this.useLimitOf(def);
    return { import: imp ? imp.import_id : r.first_import, register: r.register, row_key: r.row_key, src_row: r.src_row, cells: r.cells,
             imported_at: imp ? imp.imported_at : null, source_date: imp ? (imp.source_date ?? "not_stated") : "not_stated",
             version: hashes.indexOf(r.content_hash) + 1, cited, label_key: "register.extract", ...(lim ? { use_limit: lim } : {}) };
  },

  /* ------------------------------------------------------------------ R28: read a row, cite it */

  /** the row of an import as the viewer may see it: `{imp, def, m, cells}` or null (one answer for absent and hidden) */
  rowIn(importId, { row_key, src_row }, viewer) {
    const imp = this.importSeen(importId, viewer);
    if (!imp) return null;
    const def = this.definitionOf(imp.register)?.definition;
    if (!def) return null;
    const m = row_key !== undefined && row_key !== null
      ? this.one(`SELECT * FROM register_import_rows WHERE import_id=? AND row_key=? ORDER BY piece, seg_n, row_no LIMIT 1`, imp.import_id, String(row_key))
      : this.one(`SELECT * FROM register_import_rows WHERE import_id=? AND src_row=? ORDER BY piece, seg_n, row_no LIMIT 1`, imp.import_id, Number(src_row));
    if (!m) return { imp, def, m: null, removed: row_key !== undefined && row_key !== null && !!this.one(`SELECT 1 AS x FROM register_removed WHERE register=? AND row_key=?`, imp.register, String(row_key)) };
    const c = this.port.get({ scope_key: imp.scope_key, register: imp.register, row_key: m.row_key, content_hash: m.content_hash });
    return c ? { imp, def, m, cells: c.cells } : { imp, def, m: null };
  },

  rowOf({ import: id, row_key, src_row, viewer } = {}) {
    const got = this.rowIn(id, { row_key, src_row }, viewer);
    if (!got || !got.m) return refusal("NO_SUCH_REGISTER_ROW", localize("registers.refusal.NO_SUCH_REGISTER_ROW", "no row answers to that key in this import here"), {});
    const { imp, def, m, cells } = got;
    const seg = this.one(`SELECT * FROM register_segments WHERE import_id=? AND piece=? AND n=?`, imp.import_id, m.piece, m.seg_n);
    const red = parse(imp.reduction) || {};
    const cite = this.one(`SELECT content_id FROM register_cites WHERE register=? AND row_key=? AND content_hash=? AND import_id=?`, imp.register, m.row_key, m.content_hash, imp.import_id);
    const scopes = this.scopesOf(viewer);
    const versions = this.port.versionsOf({ scopes, register: imp.register, row_key: m.row_key });
    const hashes = [...new Set(versions.map((v) => v.content_hash))];
    const others = this.rows(`SELECT DISTINCT i.import_id, m.content_hash FROM register_import_rows m JOIN register_imports i ON i.import_id=m.import_id WHERE m.row_key=? AND i.register=? AND i.import_id <> ? AND i.scope_key IN (${scopes.map(() => "?").join(",")}) ORDER BY i.import_id`, m.row_key, imp.register, imp.import_id, ...scopes)
      .map((o) => ({ import: o.import_id, version: hashes.indexOf(o.content_hash) + 1, same: o.content_hash === m.content_hash }));
    const lim = this.useLimitOf(def);
    return { ok: true, import: imp.import_id, register: imp.register, row_key: m.row_key, src_row: m.src_row, cells,
             segment: { sha256: seg ? seg.sha256 : null, piece: m.piece, n: m.seg_n, extent: { row: m.row_no + 2 } },
             content_id: cite ? cite.content_id : null,
             original: { sha256: seg ? seg.original_sha256 : null, covers: seg ? seg.covers : null },
             dropped_columns: (red.dropped_columns || []).map((c) => c.name), imported_at: imp.imported_at, source_date: imp.source_date ?? "not_stated",
             version: hashes.indexOf(m.content_hash) + 1, other_imports: others, label_key: "register.extract", reduced_key: "register.reduced", ...(lim ? { use_limit: lim } : {}) };
  },

  citeRow({ import: id, row_key, author, viewer } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_CITE_ROW", localize("registers.refusal.MACHINE_CANNOT_CITE_ROW", "citing a row is a member's act"), {});
    const got = this.rowIn(id, { row_key }, viewer ?? by);
    if (!got) return refusal("NO_SUCH_REGISTER_ROW", localize("registers.refusal.NO_SUCH_REGISTER_ROW", "no row answers to that key in this import here"), {});
    if (got.removed) return refusal("ROW_REMOVED", localize("registers.refusal.ROW_REMOVED", "this row was removed and is not cited"), {});
    if (!got.m) return refusal("NO_SUCH_REGISTER_ROW", localize("registers.refusal.NO_SUCH_REGISTER_ROW", "no row answers to that key in this import here"), {});
    const { imp, def, m, cells } = got;
    const seg = this.one(`SELECT * FROM register_segments WHERE import_id=? AND piece=? AND n=?`, imp.import_id, m.piece, m.seg_n);
    const red = parse(imp.reduction) || {};
    const file = `register-${seg.sha256.slice(0, 16)}.csv`;
    const extract = {
      register: imp.register, file, reduced_sha256: seg.sha256, original_sha256: seg.original_sha256, original_covers: seg.covers,
      source_date: imp.source_date ?? "not_stated", imported_at: imp.imported_at, src_row: m.src_row, kept_columns: ["src_row", ...this.kept(def)],
      dropped_columns: (red.dropped_columns || []).map((c) => c.name), label_key: "register.extract", reduced_key: "register.reduced" };
    const held = this.one(`SELECT content_id FROM register_cites WHERE register=? AND row_key=? AND content_hash=? AND import_id=?`, imp.register, m.row_key, m.content_hash, imp.import_id);
    const limit = this.useLimitOf(def);
    if (held) return { ok: true, existed: true, content_id: held.content_id, extract, ...(limit ? { use_limit: limit } : {}) };
    if (!seg.bundle_id || !this.content || typeof this.content.contentMint !== "function")
      return refusal("SEGMENT_NOT_FILED", localize("registers.refusal.SEGMENT_NOT_FILED", "this segment is not filed as a document yet, so a row of it cannot be cited"), {});
    const n = m.row_no + 2;
    const cols = this.kept(def).length + 1;
    const colName = (i) => { let s = ""; for (let x = i; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
    const minted = this.content.contentMint({ bundleId: seg.bundle_id, extent: { kind: "sheet-range", sheet: file, range: `A${n}:${colName(cols)}${n}` }, mintedBy: by, viewer: viewer ?? by });
    if (!minted || minted.ok === false) return refusal(minted?.reason || "CITE_REFUSED", minted?.detail || localize("registers.refusal.CITE_REFUSED", "the row could not be cited"), {});
    const contentId = minted.content_id ?? minted.id;
    this.sql.exec(`INSERT OR IGNORE INTO register_cites (register, row_key, content_hash, import_id, content_id, project, by, at) VALUES (?,?,?,?,?,?,?,?)`, imp.register, m.row_key, m.content_hash, imp.import_id, contentId, imp.project, by, this.nowIso());
    const lim = this.useLimitOf(def);
    return { ok: true, existed: false, content_id: contentId, extract, ...(lim ? { use_limit: lim } : {}) };
  },

  /* ------------------------------------------------------------------ R29: compare two imports */

  /** the counts between two imports of one register (R29): removals stated only when the filters agree and the later read its source to the end */
  diffCounts(E, Lt) {
    const early = this.one(`SELECT * FROM register_imports WHERE import_id=?`, E), late = this.one(`SELECT * FROM register_imports WHERE import_id=?`, Lt);
    const stated = early.filter_fp === late.filter_fp && late.complete === 1 && late.state === "indexed";
    const added = Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows b WHERE b.import_id=? AND NOT EXISTS (SELECT 1 FROM register_import_rows a WHERE a.import_id=? AND a.row_key=b.row_key)`, Lt, E).n);
    const gone = Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows a WHERE a.import_id=? AND NOT EXISTS (SELECT 1 FROM register_import_rows b WHERE b.import_id=? AND b.row_key=a.row_key)`, E, Lt).n);
    const changed = Number(this.one(`SELECT COUNT(*) AS n FROM register_import_rows a JOIN register_import_rows b ON b.row_key=a.row_key AND b.import_id=? WHERE a.import_id=? AND b.content_hash <> a.content_hash`, Lt, E).n);
    return { added, changed, removed: stated ? gone : 0, possibly_removed: stated ? 0 : gone };
  },

  compare({ import_a, import_b, viewer, limit, after, budget_ms } = {}) {
    const a = this.importSeen(import_a, viewer), b = this.importSeen(import_b, viewer);
    if (!a || !b) return refusal("NO_SUCH_REGISTER_IMPORT", localize("registers.refusal.NO_SUCH_REGISTER_IMPORT", "no register import answers to that id here"), {});
    if (a.register !== b.register) return refusal("COMPARE_REFUSED", localize("registers.refusal.COMPARE_REFUSED", "two imports are compared only when they are of one register"), {});
    const def = this.definitionOf(a.register)?.definition;
    const [early, late] = a.import_id <= b.import_id ? [a, b] : [b, a];
    const sameFilter = early.filter_fp === late.filter_fp;
    const lateWhole = late.complete === 1 && late.state === "indexed";
    const stated = sameFilter && lateWhole;
    const E = early.import_id, Lt = late.import_id;
    const q = (sql, ...args) => this.rows(sql, ...args);
    const counts = this.diffCounts(E, Lt);
    const n = limit === undefined || limit === null ? this.bounds.COMPARE_PAGE_MAX : limit;
    if (!Number.isInteger(n) || n < 1 || n > this.bounds.COMPARE_PAGE_MAX) return refusal("SEARCH_BAD_LIMIT", localize("registers.refusal.SEARCH_BAD_LIMIT", "a search returns 1 to {max} rows at a time", { max: String(this.bounds.COMPARE_PAGE_MAX) }), {});
    const cur = after ? unb64(after) : null;
    if (after && (!isObj(cur) || typeof cur.k !== "string" || !["added", "changed", "removed"].includes(cur.kind) || (cur.n !== undefined && !Number.isInteger(cur.n)))) return refusal("BAD_CURSOR", localize("registers.refusal.BAD_CURSOR", "that page marker is not one this search gave"), {});
    const kinds = ["added", "changed", "removed"];
    const items = [];
    let next = null;
    const cellsOf = (imp, key, hash) => this.port.get({ scope_key: imp.scope_key, register: imp.register, row_key: key, content_hash: hash })?.cells ?? null;
    const lim = this.useLimitOf(def);
    /* R27: a limited register's rows are paged to RESULT_CAP in all, as a search's are */
    const shown = cur && Number.isInteger(cur.n) ? cur.n : 0;
    if (lim && shown >= this.bounds.RESULT_CAP) return refusal("RESULT_CAP", localize("registers.refusal.RESULT_CAP", "a search of this register shows at most {max} rows; narrow it", { max: String(this.bounds.RESULT_CAP) }), {});
    const pageMax = lim ? Math.min(n, this.bounds.RESULT_CAP - shown) : n;
    const deadline = this.nowMs() + (Number.isFinite(budget_ms) ? budget_ms : this.bounds.SEARCH_BUDGET_DEFAULT);
    let stopped = null;
    outer:
    for (const kind of kinds) {
      if (cur && kinds.indexOf(kind) < kinds.indexOf(cur.kind)) continue;
      const start = cur && kind === cur.kind ? cur.k : "";
      const rows = kind === "added"
        ? q(`SELECT b.row_key, b.content_hash, b.src_row FROM register_import_rows b WHERE b.import_id=? AND b.row_key > ? AND NOT EXISTS (SELECT 1 FROM register_import_rows a WHERE a.import_id=? AND a.row_key=b.row_key) ORDER BY b.row_key LIMIT ?`, Lt, start, E, n + 1)
        : kind === "removed"
          ? q(`SELECT a.row_key, a.content_hash, a.src_row FROM register_import_rows a WHERE a.import_id=? AND a.row_key > ? AND NOT EXISTS (SELECT 1 FROM register_import_rows b WHERE b.import_id=? AND b.row_key=a.row_key) ORDER BY a.row_key LIMIT ?`, E, start, Lt, n + 1)
          : q(`SELECT a.row_key, a.content_hash AS before_hash, b.content_hash, b.src_row FROM register_import_rows a JOIN register_import_rows b ON b.row_key=a.row_key AND b.import_id=? WHERE a.import_id=? AND a.row_key > ? AND b.content_hash <> a.content_hash ORDER BY a.row_key LIMIT ?`, Lt, E, start, n + 1);
      for (const r of rows) {
        if (items.length >= pageMax) { next = b64({ kind, k: items[items.length - 1].key, n: shown + items.length }); break outer; }
        if (this.nowMs() >= deadline) { stopped = { reason: "time" }; next = items.length ? b64({ kind, k: items[items.length - 1].key, n: shown + items.length }) : null; break outer; }
        if (kind === "changed") {
          const before = cellsOf(early, r.row_key, r.before_hash), afterC = cellsOf(late, r.row_key, r.content_hash);
          const fields = Object.keys(afterC ?? {}).filter((f) => (before ?? {})[f] !== afterC[f]);
          items.push({ kind, key: r.row_key, changes: fields.map((field) => ({ key: r.row_key, field, before: before?.[field] ?? null, after: afterC[field] })), label_key: "register.extract" });
        } else {
          const owner = kind === "added" ? late : early;
          const label = kind === "removed" && !stated ? "possibly_removed" : kind;
          items.push({ kind: label, key: r.row_key, src_row: r.src_row, cells: cellsOf(owner, r.row_key, r.content_hash), label_key: "register.extract" });
        }
      }
      if (items.length >= pageMax && !next) {
        /* the page filled exactly at the end of this kind: the next page starts at the next kind */
        const idx = kinds.indexOf(kind) + 1;
        if (idx < kinds.length) next = b64({ kind: kinds[idx], k: "", n: shown + items.length });
        break;
      }
    }
    return { ok: true, a: early.import_id, b: late.import_id, counts, stated_removed: stated, rows: items, ...(next ? { next } : {}), ...(stopped ? { stopped, counts_complete: false } : {}), ...(lim ? { use_limit: lim } : {}), same_filter: sameFilter };
  },

  /* ------------------------------------------------------------------ R30, R31: removal of a row */

  async rowExpunge({ register, row_key, ground, reason, order, demandKind, author } = {}) {
    const by = str(author);
    const member = this.memberOf(by);
    if (!member) return refusal("MACHINE_CANNOT_EXPUNGE_ROW", localize("registers.refusal.MACHINE_CANNOT_EXPUNGE_ROW", "removing a row is a member's act"), {});
    if (!this.membership.isAdministrator(member)) return refusal("NOT_AN_ADMIN", localize("registers.refusal.NOT_AN_ADMIN", "this is an administrator's act"), {});
    if (!str(reason)) return refusal("ROW_EXPUNGE_NO_REASON", localize("registers.refusal.ROW_EXPUNGE_NO_REASON", "removing a row states its reason"), {});
    if (!["unlawful", "confidential", "court_order", "lawful_demand"].includes(ground) || (ground === "court_order" && !str(order)))
      return refusal("EXPUNGE_GROUND_REFUSED", localize("registers.refusal.EXPUNGE_GROUND_REFUSED", "a row is removed only as unlawful to hold, confidential, under a recorded court order or under a lawful demand the jurisdiction lists"), {});
    if (ground === "lawful_demand") {
      const kinds = (Array.isArray(this.view().lawful_demands) ? this.view().lawful_demands : []).map((d) => d && d.kind).filter((k) => typeof k === "string" && k);
      if (!kinds.includes(demandKind)) return refusal("DEMAND_KIND_UNLISTED", localize("registers.refusal.DEMAND_KIND_UNLISTED", "the active jurisdiction profiles list no lawful demand of that kind"), { demand_kinds: kinds });
    }
    const reg = str(register), key = typeof row_key === "string" ? row_key : "";
    if (!this.definitionOf(reg) || !key) return refusal("NO_SUCH_REGISTER_ROW", localize("registers.refusal.NO_SUCH_REGISTER_ROW", "no row answers to that key in this import here"), {});
    /* where the row stands, before it goes */
    const places = this.rows(`SELECT m.import_id, m.piece, m.seg_n, m.row_no FROM register_import_rows m JOIN register_imports i ON i.import_id=m.import_id WHERE i.register=? AND m.row_key=?`, reg, key);
    const shas = new Map();
    for (const p of places) {
      const s = this.one(`SELECT sha256 FROM register_segments WHERE import_id=? AND piece=? AND n=?`, p.import_id, p.piece, p.seg_n);
      if (s) shas.set(s.sha256, [...(shas.get(s.sha256) ?? []), p]);
    }
    const done = this.tx(() => {
      const r = this.record.expunge({ module: "registers", table: "register_import_rows", key: { register: reg, row_key: key }, ground,
        ...(ground === "court_order" ? { order } : {}), ...(ground === "lawful_demand" ? { demandKind } : {}), by: member });
      if (!r || r.ok === false) return r;
      this.port.remove({ register: reg, row_key: key });   /* the cells and the index, through the port (R22) */
      this.sql.exec(`DELETE FROM register_cites WHERE register=? AND row_key=?`, reg, key);
      this.sql.exec(`INSERT OR IGNORE INTO register_removed (register, row_key) VALUES (?,?)`, reg, key);
      return r;
    });
    if (!done || done.ok === false) {
      const code = done && done.reason === "EXPUNGE_NOTHING" ? "NO_SUCH_REGISTER_ROW" : done && done.reason === "EXPUNGE_GROUND_UNKNOWN" ? "EXPUNGE_GROUND_REFUSED" : (done && done.reason) || "EXPUNGE_REFUSED";
      return refusal(code, localize("registers.refusal.row_not_removed", "the row was not removed"), {});
    }
    /* each segment that held the row is replaced by the segment minus the row (a new digest), the old object purged (R30) */
    const rewritten = [];
    for (const [oldSha, at] of shas) {
      const res = await this.rewriteSegment(oldSha, at, reg, key);
      if (res) rewritten.push(res);
    }
    return { ok: true, removed: done.removed, tombstone: done.tombstone, segments_rewritten: rewritten.length, objects_purged: rewritten.filter((x) => x.purged).length, reason: str(reason) };
  },

  /* the reduced segment minus one row: re-serialised in the reducer's own form, stored under its new digest; the old object is deleted */
  async rewriteSegment(oldSha, places, register, key) {
    const bytes = await this.bytesOf(oldSha);
    const ev = typeof this.record.evidenceStore === "function" ? this.record.evidenceStore() : null;
    const drop = new Set(places.map((p) => p.row_no));
    const kept = [], from = [];   /* from: each kept line's row number in the old segment (header 0) */
    let header = null, idx = 0;
    if (bytes) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const p = reducedParser((fields) => { if (header === null) { header = fields; kept.push(fields); from.push(0); return; } const i = idx++; if (!drop.has(i)) { kept.push(fields); from.push(i + 1); } });
      p.feed(text); p.end();
    }
    const enc = new TextEncoder();
    const lines = kept.map((f) => enc.encode(`${f.map(csvField).join(",")}\n`));
    const out = new Uint8Array(lines.reduce((n, l) => n + l.length, 0));
    /* R21, R30: every kept row's pointer moves to its row and byte range in the new segment */
    const moved = new Map();
    for (let i = 0, at = 0; i < lines.length; at += lines[i].length, i++) { out.set(lines[i], at); if (i) moved.set(from[i], { row: i, at, len: lines[i].length }); }
    const newSha = sha256HexSync(out);
    let purged = false;
    if (ev && bytes) {
      try { await ev.put(newSha, out, { sha256: newSha }); } catch { /* the new object could not be stored */ }
      purged = await this.purgeObject(ev, oldSha);
    }
    const segs = this.rows(`SELECT import_id, piece, n FROM register_segments WHERE sha256=?`, oldSha);
    this.tx(() => {
      this.sql.exec(`UPDATE register_segments SET sha256=?, bytes=?, rows = rows - ? WHERE sha256=?`, newSha, out.length, drop.size, oldSha);
      this.port.repoint({ from: oldSha, to: newSha, places: moved });
      /* the rows after a removed one move up by the number removed before them */
      for (const s of segs) {
        const gone = [...drop].sort((x, y) => x - y);
        const rows = this.rows(`SELECT row_no FROM register_import_rows WHERE import_id=? AND piece=? AND seg_n=? ORDER BY row_no`, s.import_id, s.piece, s.n);
        for (const r of rows) {
          if (drop.has(r.row_no)) continue;
          const shift = gone.filter((g) => g < r.row_no).length;
          if (shift) this.sql.exec(`UPDATE register_import_rows SET row_no=? WHERE import_id=? AND piece=? AND seg_n=? AND row_no=?`, r.row_no - shift, s.import_id, s.piece, s.n, r.row_no);
        }
      }
    });
    try { if (this.content && typeof this.content.markStale === "function") this.content.markStale(oldSha, [{ step: "register_row_removed", removed: drop.size }]); } catch { /* a row over it stays as it is */ }
    return { old: oldSha, sha256: newSha, removed: drop.size, purged };
  },
};

export { filterFingerprint, json, localize };
