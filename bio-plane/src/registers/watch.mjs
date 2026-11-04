/* registers — a project's stated interest, the refresh a watch asks for, the count-only change read, and the officers lookup
 * (requirements: R32–R34, R44, R46). Nothing is inferred: an interest is a filter a member attaches or accepts from the prefill
 * (R8); a watch is by a number, never by a name (R36). Methods installed on `Registers`. */
import { autoWatchable, validateFilter } from "../register-readers/index.mjs";
import { sourceChanged, KEYED_PURPOSES } from "../acquisition/index.mjs";
import { queryAddress } from "../../../jurisdictions/index.mjs";
import { noSuchProject, listenerRefusal } from "../membership/index.mjs";
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { isObj, str, json, parse, refusal } from "./core.mjs";

export const watchMethods = {
  /* ------------------------------------------------------------------ R32: interest */

  /** R32: one listener per module, told `{interest, watch}` after the act's transaction, so `following` creates or ends its watch. */
  onInterest(module, fn) {
    const refused = listenerRefusal(this.interestListeners, module, fn);
    if (refused) return refused;
    this.interestListeners.push({ module, fn });
    return { ok: true, module };
  },

  interestShape(r) {
    return { id: r.interest_id, version: r.version, register: r.register, project: r.project, filter: parse(r.filter), filter_fingerprint: r.filter_fp,
             watch: !!r.watch && !r.ended, ended: !!r.ended, by: r.by, at: r.at };
  },

  interestSet({ register, project, filter, watch, author, viewer } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_STATE_INTEREST", localize("registers.refusal.MACHINE_CANNOT_STATE_INTEREST", "an interest is stated by a member; a machine states none"), {});
    const p = str(project);
    if (!p || !this.seesProject(p, str(viewer) || by)) return noSuchProject(p || null);
    const d = this.definitionOf(register);
    if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), { register: typeof register === "string" ? register : null });
    const checked = this.checkFilter(d.definition, filter);
    if (!checked.ok) return checked;
    const watchable = autoWatchable(checked.filter);
    if (watch === true && !watchable)
      return refusal("INTEREST_NOT_WATCHABLE", localize("registers.refusal.INTEREST_NOT_WATCHABLE", "a filter naming a person or an organization is re-checked by a member's act, never watched unattended"), { names: localize("registers.watch.names_by_act", "re-checked by a member's act") });
    const wantWatch = watch === false ? false : watchable;
    const prior = this.one(`SELECT interest_id, MAX(version) AS v FROM register_interests WHERE project=? AND register=? GROUP BY interest_id ORDER BY interest_id DESC LIMIT 1`, p, d.definition.key);
    const id = prior ? prior.interest_id : (Number(this.one(`SELECT COALESCE(MAX(interest_id), 0) AS m FROM register_interests`).m) + 1);
    const version = prior ? prior.v + 1 : 1;
    const at = this.nowIso();
    this.tx(() => this.sql.exec(`INSERT INTO register_interests (interest_id, version, register, project, filter, filter_fp, watch, ended, by, at) VALUES (?,?,?,?,?,?,?,0,?,?)`,
                                id, version, d.definition.key, p, json(checked.filter), checked.fingerprint, wantWatch ? 1 : 0, by, at));
    const row = this.one(`SELECT * FROM register_interests WHERE interest_id=? AND version=?`, id, version);
    const shape = this.interestShape(row);
    this.told(this.interestListeners, { interest: shape, watch: shape.watch });
    return { ok: true, interest: shape, watch: shape.watch, ...(!watchable && watch !== false ? { watch_note: "INTEREST_NOT_WATCHABLE" } : {}) };
  },

  /** R32 (registerwatch, registerwatchstop): the watch of a stated interest switched on or off, the interest and its history staying. */
  watchSet({ interest, watch, author, viewer } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_STATE_INTEREST", localize("registers.refusal.MACHINE_CANNOT_STATE_INTEREST", "an interest is stated by a member; a machine states none"), {});
    const cur = this.one(`SELECT i.* FROM register_interests i WHERE i.interest_id=? AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id)`, Number(interest));
    if (!cur || cur.ended || !this.seesProject(cur.project, str(viewer) || by)) return noSuchProject(cur ? cur.project : null);
    if (watch === true && !autoWatchable(parse(cur.filter))) return refusal("INTEREST_NOT_WATCHABLE", localize("registers.refusal.INTEREST_NOT_WATCHABLE", "a filter naming a person or an organization is re-checked by a member's act, never watched unattended"), {});
    if (!!cur.watch === (watch === true)) return { ok: true, existed: true, interest: this.interestShape(cur) };
    this.sql.exec(`INSERT INTO register_interests (interest_id, version, register, project, filter, filter_fp, watch, ended, by, at) VALUES (?,?,?,?,?,?,?,0,?,?)`,
                  cur.interest_id, cur.version + 1, cur.register, cur.project, cur.filter, cur.filter_fp, watch === true ? 1 : 0, by, this.nowIso());
    const shape = this.interestShape(this.one(`SELECT * FROM register_interests WHERE interest_id=? AND version=?`, cur.interest_id, cur.version + 1));
    this.told(this.interestListeners, { interest: shape, watch: shape.watch });
    return { ok: true, interest: shape };
  },

  interestOf({ project, register, viewer } = {}) {
    const p = str(project);
    if (!p || !this.seesProject(p, viewer)) return noSuchProject(p || null);
    const rows = this.rows(`SELECT i.* FROM register_interests i WHERE i.project=? ${register ? "AND i.register=?" : ""} AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id) ORDER BY i.interest_id`, p, ...(register ? [str(register)] : []));
    return { ok: true, interests: rows.map((r) => this.interestShape(r)),
             history: this.rows(`SELECT * FROM register_interests WHERE project=? ${register ? "AND register=?" : ""} ORDER BY interest_id, version`, p, ...(register ? [str(register)] : [])).map((r) => this.interestShape(r)) };
  },

  interestForget({ interest, project, register, author, viewer } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_STATE_INTEREST", localize("registers.refusal.MACHINE_CANNOT_STATE_INTEREST", "an interest is stated by a member; a machine states none"), {});
    const cur = Number.isSafeInteger(Number(interest)) && interest !== undefined && interest !== null
      ? this.one(`SELECT i.* FROM register_interests i WHERE i.interest_id=? AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id)`, Number(interest))
      : this.currentInterest(str(project), str(register));
    if (!cur || !this.seesProject(cur.project, str(viewer) || by)) return noSuchProject(str(project) || null);
    if (cur.ended) return { ok: true, existed: true, interest: this.interestShape(cur) };
    const at = this.nowIso();
    this.sql.exec(`INSERT INTO register_interests (interest_id, version, register, project, filter, filter_fp, watch, ended, by, at) VALUES (?,?,?,?,?,?,0,1,?,?)`,
                  cur.interest_id, cur.version + 1, cur.register, cur.project, cur.filter, cur.filter_fp, by, at);
    const shape = this.interestShape(this.one(`SELECT * FROM register_interests WHERE interest_id=? AND version=?`, cur.interest_id, cur.version + 1));
    this.told(this.interestListeners, { interest: shape, watch: false });
    return { ok: true, interest: shape };
  },

  /* ------------------------------------------------------------------ R33: refresh */

  /* the previous import of this register, scope and filter that read its source to the end */
  previousOf(register, scopeKey, fp, before = Infinity) {
    return this.one(`SELECT import_id FROM register_imports WHERE register=? AND scope_key=? AND filter_fp=? AND state='indexed' AND complete=1 AND import_id < ? ORDER BY import_id DESC LIMIT 1`, register, scopeKey, fp, before);
  },

  /** R33: for `following`: the watched interest refreshed under its author's standing statement (never a name). */
  async refreshImport({ interest, now, host = null } = {}) {
    const cur = Number.isSafeInteger(Number(interest)) ? this.one(`SELECT i.* FROM register_interests i WHERE i.interest_id=? AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id)`, Number(interest)) : null;
    if (!cur || cur.ended || !cur.watch) return refusal("NO_SUCH_INTEREST", localize("registers.refusal.NO_SUCH_INTEREST", "no watched interest answers to that id"), {});
    const d = this.definitionOf(cur.register);
    if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), {});
    const gate = d.definition.gate && d.definition.gate !== "none";
    if (gate) return refusal("member_act_required", localize("registers.refusal.member_act_required", "this register is behind an account or a fee, so a member brings the file in with their own account; nothing was fetched"), { register: cur.register, gate: d.definition.gate });
    const f = parse(cur.filter);
    if (!autoWatchable(f)) return refusal("REFRESH_NEEDS_MEMBER", localize("registers.refusal.REFRESH_NEEDS_MEMBER", "a filter naming a person or an organization is re-checked by a member's act"), {});
    if (host && typeof host.paused === "function" && host.paused().paused) return refusal("HOST_PAUSED", localize("registers.refusal.HOST_PAUSED", "the daemon is paused"), {});
    const bad = this.actRefusal(d.definition);
    if (bad) return bad;
    return this.startRefresh(cur, d.definition, f, { reason: "watch", author: cur.by, check: true });
  },

  /** R33: a member's own re-check of an interest (a name filter too) or of an import (a team pre-read too). */
  async registerRefresh({ interest, import: importId, author, viewer, force = false } = {}) {
    const by = str(author);
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_REFRESH_REGISTER", localize("registers.refusal.MACHINE_CANNOT_REFRESH_REGISTER", "a refresh is a member's act"), {});
    if (interest !== undefined && interest !== null) {
      const cur = this.one(`SELECT i.* FROM register_interests i WHERE i.interest_id=? AND i.version=(SELECT MAX(version) FROM register_interests WHERE interest_id=i.interest_id)`, Number(interest));
      if (!cur || cur.ended || !this.seesProject(cur.project, str(viewer) || by)) return noSuchProject(cur ? cur.project : null);
      const d = this.definitionOf(cur.register);
      if (!d) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), {});
      const bad = this.actRefusal(d.definition);
      if (bad) return bad;
      return this.startRefresh(cur, d.definition, parse(cur.filter), { reason: "refresh", author: by, check: !force, force });
    }
    const imp = this.importSeen(importId, str(viewer) || by);
    if (!imp) return refusal("NO_SUCH_REGISTER_IMPORT", localize("registers.refusal.NO_SUCH_REGISTER_IMPORT", "no register import answers to that id here"), {});
    const d = this.definitionOf(imp.register);
    const bad = d ? this.actRefusal(d.definition) : null;
    if (bad) return bad;
    return this.startRefresh({ interest_id: null, project: imp.project, register: imp.register, filter: imp.filter, filter_fp: imp.filter_fp, scope: imp.scope }, d.definition, parse(imp.filter),
      { reason: "refresh", author: by, check: !force, force, scope: imp.scope, holes: parse(imp.holes), recheck: true });
  },

  async startRefresh(cur, definition, filter, { reason, author, check, force = false, scope = "project", holes = null, recheck = false }) {
    const sc = cur.project ? "project" : "team";
    const key = sc === "project" ? `project:${cur.project}` : "team";
    const fp = cur.filter_fp;
    const prev = this.previousOf(definition.key, key, fp);
    if (!holes && prev) holes = parse(this.one(`SELECT holes FROM register_imports WHERE import_id=?`, prev.import_id).holes);
    /* R129: an unchanged source is not fetched again, decided by the governed probes that fetch no body */
    if (check && prev && !force) {
      const pr = parse(this.one(`SELECT probe FROM register_imports WHERE import_id=?`, prev.import_id).probe) || [];
      let changed = pr.length === 0;
      for (const last of pr) {
        let probe;
        try { probe = await this.acq.probeRegister(this.store, { definition, piece: last.piece, filter, holes, budget_ms: this.bounds.DELTA_BUDGET_MS, view: this.view() }, { bounds: this.bounds }); } catch { probe = null; }
        if (!probe || probe.ok !== true || sourceChanged(probe, last, definition)) { changed = true; break; }
      }
      if (!changed) return refusal("REFRESH_UNCHANGED", localize("registers.refusal.REFRESH_UNCHANGED", "the source has not changed since the last look, so it was not fetched again"), { previous: prev.import_id });
    }
    return this.importStart({ register: definition.key, filter, scope: sc, project: cur.project, author, viewer: author, holes, kind: "refresh", reason,
      on_behalf: author, interest: cur.interest_id ?? null, previous: prev ? prev.import_id : null, force, recheck });
  },

  /* a refresh that ended: its change against the previous import, as counts (R33, R34) */
  recordChange(importId) {
    const imp = this.one(`SELECT * FROM register_imports WHERE import_id=?`, importId);
    if (!imp || !imp.previous) return;
    const c = this.diffCounts(imp.previous, importId);
    if (c.added + c.changed + c.removed + c.possibly_removed === 0) return;
    this.sql.exec(`INSERT INTO register_changes (import_id, previous, interest_id, project, register, at, added, changed, removed, possibly_removed) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                  importId, imp.previous, imp.interest_id, imp.project, imp.register, this.nowIso(), c.added, c.changed, c.removed, c.possibly_removed);
  },

  /* ------------------------------------------------------------------ R34: the change read */

  changesSince({ after = 0, since = null, limit, viewer } = {}) {
    const n = limit === undefined || limit === null ? this.bounds.CHANGES_PAGE_MAX : limit;
    if (!Number.isInteger(n) || n < 1 || n > this.bounds.CHANGES_PAGE_MAX) return refusal("SEARCH_BAD_LIMIT", localize("registers.refusal.SEARCH_BAD_LIMIT", "a search returns 1 to {max} rows at a time", { max: String(this.bounds.CHANGES_PAGE_MAX) }), {});
    const floor = since === null || since === undefined ? null : (typeof since === "number" ? since : Date.parse(since));
    const out = [];
    let cursor = Number(after) || 0, last = cursor;
    for (const r of this.rows(`SELECT * FROM register_changes WHERE change_id > ? ORDER BY change_id`, cursor)) {
      if (out.length >= n) break;
      last = r.change_id;
      if (floor !== null && Number.isFinite(floor) && Date.parse(r.at) < floor) continue;
      if (r.project && !this.seesProject(r.project, viewer)) continue;
      out.push({ watch: r.interest_id, interest: r.interest_id, project: r.project, register: r.register, import: r.import_id, previous_import: r.previous, at: r.at,
                 counts: { added: r.added, changed: r.changed, removed: r.removed, possibly_removed: r.possibly_removed }, total: r.added + r.changed + r.removed + r.possibly_removed });
    }
    return { ok: true, changes: out, cursor: last };
  },

  /* ------------------------------------------------------------------ R46: the officers lookup, a member's act */

  async officersLookup({ query, author, viewer } = {}) {
    const by = str(author) || str(viewer);
    if (by === "class:daemon" || by === "daemon") return refusal("NOT_PERMITTED", localize("registers.refusal.NOT_PERMITTED", "a keyed outside service is used for a member's act, never by a machine or the daemon"), {});
    if (!this.memberOf(by)) return refusal("MACHINE_CANNOT_LOOK_UP_OFFICERS", localize("registers.refusal.MACHINE_CANNOT_LOOK_UP_OFFICERS", "the lookup is a member's act; a machine looks up nothing"), {});
    const view = this.view();
    const t = (Array.isArray(view.query_templates) ? view.query_templates : []).find((x) => x && x.scheme === "company");
    const reg = t ? this.shipped().find((r) => r.key === t.register) : null;
    if (!reg) return refusal("NO_SUCH_REGISTER", localize("registers.refusal.NO_SUCH_REGISTER", "no register on the list or defined by your team has that key"), {});
    const addr = queryAddress(view, "company", reg.key, typeof query === "string" ? query.trim() : query);
    if (!addr.ok) return refusal(addr.reason === "VALUE_NOT_OF_FORM" ? "QUERY_NOT_NAMED" : addr.reason, localize("registers.refusal.LOOKUP_NOT_NUMBERED", "the lookup is by a company number, never by a name"), { field: "query" });
    /* the service is the one acquisition's purpose names (acquisition R130), never named here (R43) */
    const service = (KEYED_PURPOSES["officers-lookup"]?.services ?? [])[0];
    if (!service) return refusal("KEYED_SERVICE_OFF", localize("registers.refusal.KEYED_SERVICE_OFF", "the lookup's service is not offered"), {});
    const r = await this.acq.keyedFetch(this.store, { service, purpose: "officers-lookup", request: { url: addr.address, method: "GET" }, viewer: by });
    if (!r || r.ok !== true) return r && r.reason ? { ...r, ok: false } : refusal("LOOKUP_FAILED", localize("registers.refusal.LOOKUP_FAILED", "the lookup did not complete"), {});
    const day = new Date(this.nowMs()).toISOString().slice(0, 10);
    this.sql.exec(`INSERT INTO register_lookup_use (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1`, day);
    let body = parse(r.text);
    const list = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.results) ? body.results : isObj(body) ? [body] : [];
    const keep = new Set(this.kept(reg));
    const rows = list.filter(isObj).map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k))));
    return { ok: true, register: reg.key, rows, count: rows.length, label_key: "register.reduced" };
  },
};

export { validateFilter };
