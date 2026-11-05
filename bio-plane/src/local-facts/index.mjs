/* local-facts — members' confirmation of the profile's local calendar and offices on this instance (requirements:
 * `build/requirements/local-facts.md`; design `build/plan/draft-filing-templates.md` §2, as §5 amends it; K921, K924,
 * K925, K927). A profile's holidays, office hours and time zone (`jurisdictions` R33, R41–R44) are researched facts:
 * this module records each member's `confirm`, `correct` or `dispute` of one (R1), answers each fact's status and the
 * value that governs here (R2), lapses a confirmation at its horizon (R3) and lists the facts that are due (R4).
 * A member confirms; a machine never does (R5): an assistant's re-check reaches a member as a run's output and enters
 * here only by the member's own act, whose `how` may name it. No machine proposal is stored (K927).
 *
 * In layer 5 since T33 (K1438), directly after `lines`, it reads no action (P4): which facts a live deadline reads is
 * `action-clocks.calendarFactsRead`'s answer, which its caller passes to `factsDue({paths})` (`queue-producers` R21).
 *
 * Every day here is a local day of the fact's profile's time zone (`civil-time.localDay`, R3; K1444 (iii)), never the
 * UTC day; a profile with no time zone answers a horizon undetermined, saying so. `governingPath` (R6) follows an
 * office's `part_of` lines upward through `lines.structureAt` to the nearest entity whose fact the profile holds, with
 * the profile's `offices` grouping as the fallback (ladders §5.4's bridge).
 *
 * No place is named here (R8): every fact is read from the active profiles (record-core's `jurisdiction_profiles`,
 * `jurisdictions.combine`), and one they do not hold reads `absent`.
 *
 * REACHED as `localFactsOf(host, deps)` (K61): one instance per host, created on the first call with `deps`. At
 * creation it creates its tables and declares them with their classes (R5, R9, R14). The group's own jurisdiction rules
 * (R10–R14, T45) are `rules.mjs`' `GroupRules`, reached through this class. `deps`:
 *   record, membership   the modules it uses, through their factories on the same host unless a test passes its own.
 *   combine, get, validate   `jurisdictions`' services (default); a test passes its own for profiles it wrote.
 *   lines        an object with `structureAt` (lines R10); absent, `linesOf(host)` (K1563 (1)), reached on the first
 *                `governingPath` that needs it. When neither answers, `governingPath` answers the fallback, saying
 *                `lines` is not reachable here.
 *   officeOf     `(entityId, profile)` → the profile office `{role, body}` or `{venue}` an entity stands for (ladders
 *                §5.4's bridge: each profile office is seeded as an entity at setup), or null; absent, no entity maps.
 *   content, provenance   (T45, R10) a group rule's primary source: `content`'s `contentContextFor` (with its pure
 *                `checkContentExtent`) and `provenance`'s `homeOf`; absent, `contentOf(host)` and `provenanceOf(host)`,
 *                reached on the first draft that needs them. When neither answers, every source reads not held.
 *   now          the module's clock, an ISO instant (default: the wall clock).
 *
 * (T53, N1257, DEC-404) The facts are those of the active LAYERS (`jurisdictions` R99): a setting that names a package
 * (`oakland-alameda`) is read as the layers it stands for, a fact's path begins with the layer that holds it (R29), a path that
 * still names the package reads the same history (R27), and the team's own layer (`layer.mjs`: R23, R30, R31) is one more
 * layer, its facts at `team/<government>/...` (R29, R32). */

import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { combine as combineProfiles, get as getProfile, validate as validateProfile, list as listProfiles,
         nameResolve } from "../../../jurisdictions/index.mjs";
import { localDay } from "../civil-time/index.mjs";
import { BOUNDS } from "../connection-grammar/index.mjs";
import { linesOf, reasonText } from "../lines/index.mjs";
import { contentOf, checkContentExtent } from "../content/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { LOCAL_FACTS_CHECKS, refusal } from "./checks.mjs";
import { GroupRules, ambiguousRefusal } from "./rules.mjs";
import { TeamLayer, readOnlyRefusal, unknownLayerRefusal, inShippedRefusal, entryKey } from "./layer.mjs";
import { LOCAL_FACTS_TABLE_CLASSES, migrateLocalFacts } from "./schema.mjs";
import { factPath, parseFactPath, officesToken, TEAM_ZONE_PATH, TEAM_LAYER } from "./paths.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { LOCAL_FACTS_CHECKS, LOCAL_FACTS_WORDS } from "./checks.mjs";
export { LOCAL_FACTS_SCHEMA, LOCAL_FACTS_TABLES, LOCAL_FACTS_TABLE_CLASSES } from "./schema.mjs";
export { LOCAL_FACT_KINDS, factPath, parseFactPath, TEAM_ZONE_PATH, TEAM_LAYER, GOVERNMENT_LEVELS } from "./paths.mjs";
export { LAYER_ENTRY_SECTIONS, LAYER_ENTRY_STATES, LAYER_REPORT_STATES, BELIEVES_MAX } from "./layer.mjs";
export { RULE_SECTIONS, RULE_STATES, RULE_REASON_MAX, RULE_STATEMENT_MAX, GROUP_PROFILE, RULE_FIELDS, EFFECTIVE_FROM } from "./rules.mjs";

/** R7: a member's three acts on a fact. */
export const LOCAL_FACT_ACTS = Object.freeze(["confirm", "correct", "dispute"]);
/** R7: a fact's five statuses (R2). */
export const LOCAL_FACT_STATUSES = Object.freeze(["confirmed", "unconfirmed", "corrected", "disputed", "absent"]);
/** R3, R7: the horizons, per profile fact (K921 Q7). A holiday year's confirmation lasts until that year ends, and a
 *  year is due from 1 November of the year before; an office's hours, and the time zone, lapse 183 days after their
 *  confirmation. Every day is a local day of the fact's profile's time zone (`civil-time.localDay`), never the UTC
 *  day: a year ends, 1 November falls and the 183rd day lapses at that zone's local midnight. */
export const LOCAL_FACT_HORIZONS = Object.freeze({
  holidays: Object.freeze({ lasts: "until_year_end", due_from: Object.freeze({ month: 11, day: 1, years_before: 1 }) }),
  hours: Object.freeze({ lapse_days: 183 }),
  time_zone: Object.freeze({ lapse_days: 183 }),
  /* R32 (T53): a stated fiscal year lapses as the time zone's does, one number */
  fiscal_year: Object.freeze({ lapse_days: 183 }),
});
/** R1: `how` and a correction's `source`, in characters. */
export const HOW_MAX = 500, SOURCE_MAX = 500;

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
/* Calendar arithmetic on a local day's own label (`YYYY-MM-DD`): the day n days after it. No instant and no zone is
   involved, so a daylight-saving change cannot move it; the day itself is always `civil-time.localDay`'s (R3). */
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/* R3: the local day of an instant in a zone, or null when the zone is none or not one `civil-time` knows. */
const dayIn = (instant, zone) => {
  if (typeof zone !== "string" || !zone) return null;
  try { const d = localDay(instant, zone); return typeof d === "string" ? d : null; } catch { return null; }
};

/* ===================================================================== *
 * Reading a fact out of a profile, or out of the combined view
 * ===================================================================== */

/* Every profile that gives a fact in the combined view (jurisdictions R13, R14); a raw profile gives its own. */
const givers = (x, own) => (own ? [own] : [x.profile, x.layer, ...((x.bases || []).map((b) => b.profile))].filter(Boolean));
/* R29: two governments of the team layer are two facts: the team layer's entries (and the view's, tagged with them) are told apart
   by the government they are about. */
const sameGov = (a, b) => isObj(a) && isObj(b) && a.level === b.level && (a.place ?? null) === (b.place ?? null);
const govOf = (x) => (isObj(x) && isObj(x.government) ? { government: x.government } : {});
/* The closure list a holiday entry belongs to (`jurisdictions` R47): its `list`, or null for the office calendar (R43).
   R6 gives a named list's entry a path of its own (`list=<name>`), so a court's judicial holidays are a fact apart from
   the office calendar's entry for the same year and offices (T34-19). */
const listOf = (h) => (isObj(h) && typeof h.list === "string" ? h.list : null);
const sameEntry = (e, parts) => isObj(e) && Number(e.year) === parts.year && listOf(e) === (parts.list ?? null)
  && officesToken(e.offices) === officesToken(parts.offices) && (!parts.government || sameGov(e.government, parts.government));

/** The fact `parts` names in `p` (a held profile, `own` its id, or the combined view, `own` null), as
 *  `{value, status, basis}`, or null. The value is what a correction replaces (R1): the year's `days`, the office's
 *  `{weekly}`, the time zone's name. */
function factIn(p, parts, own = null) {
  if (!isObj(p)) return null;
  /* R29: a fact of the team layer is the one of its government (a view's entry carries `government` once tagged `origin: team`) */
  const mine = (x) => (parts.government ? isObj(x) && sameGov(x.government, parts.government) : givers(x, own).includes(parts.profile));
  if (parts.fact === "fiscal_year") {
    const y = (Array.isArray(p.fiscal_year) ? p.fiscal_year : []).find((e) => isObj(e) && mine(e));
    return y ? { value: { body: y.body, start: y.start, named_by: y.named_by, label: y.label }, status: null, basis: null } : null;
  }
  if (parts.fact === "time_zone") {
    const z = parts.office ? (officeIn(p, parts.office, parts.government) || {}).time_zone : p.time_zone;
    return isObj(z) && mine(z) ? { value: z.value, status: z.status, basis: z.basis } : null;
  }
  if (parts.fact === "holidays") {
    const h = (Array.isArray(p.holidays) ? p.holidays : []).find((e) => sameEntry(e, parts) && mine(e));
    if (!h) return null;
    const days = (h.days || []).map((d) => ({ date: d.date, name: d.name }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { value: days, status: h.status, basis: h.basis };
  }
  if (parts.fact === "hours") {
    const hoursOf = (h) => (isObj(h) && mine(h) ? { value: { weekly: clone(h.weekly) }, status: h.status, basis: h.basis } : null);
    const o = officeIn(p, parts.office, parts.government);
    return o ? hoursOf(o.hours) : null;
  }
  return null;
}

/* The object that holds an office's own facts in `p`: a counterparty `{role, body}` (jurisdictions R24) or a kind's
   `venue` (`{venue: <kind>}`, R25), or null. Its `hours` (R42) and its own `time_zone` (R74) are read from it. */
function officeIn(p, office, government) {
  if (!isObj(p) || !isObj(office)) return null;
  const about = (e) => !government || sameGov(e.government, government);
  if (office.venue !== undefined) {
    const k = (Array.isArray(p.action_kinds) ? p.action_kinds : []).find((e) => isObj(e) && e.kind === office.venue && about(e));
    return k && isObj(k.venue) ? k.venue : null;
  }
  return (Array.isArray(p.counterparties) ? p.counterparties : [])
    .find((e) => isObj(e) && e.role === office.role && e.body === office.body && about(e)) || null;
}

/** Every fact a held profile gives, as its parts (R2, R4 without a path). */
function factsOf(p) {
  const out = [];
  if (!isObj(p)) return out;
  const team = p.id === TEAM_LAYER && isObj(p.layer) && p.layer.origin === "team";
  if (isObj(p.time_zone) && !team) out.push({ profile: p.id, fact: "time_zone" });
  for (const h of Array.isArray(p.holidays) ? p.holidays : [])
    if (isObj(h) && (!team || isObj(h.government))) out.push({ profile: p.id, fact: "holidays", year: Number(h.year), ...(listOf(h) ? { list: h.list } : {}),
                             ...(h.offices ? { offices: h.offices } : {}), ...govOf(h) });
  for (const c of Array.isArray(p.counterparties) ? p.counterparties : []) {
    if (isObj(c) && isObj(c.hours)) out.push({ profile: p.id, fact: "hours", office: { role: c.role, body: c.body }, ...govOf(c) });
    if (isObj(c) && isObj(c.time_zone)) out.push({ profile: p.id, fact: "time_zone", office: { role: c.role, body: c.body }, ...govOf(c) });
  }
  for (const k of Array.isArray(p.action_kinds) ? p.action_kinds : []) {
    if (isObj(k) && isObj(k.venue) && isObj(k.venue.hours)) out.push({ profile: p.id, fact: "hours", office: { venue: k.kind }, ...govOf(k) });
    if (isObj(k) && isObj(k.venue) && isObj(k.venue.time_zone)) out.push({ profile: p.id, fact: "time_zone", office: { venue: k.kind }, ...govOf(k) });
  }
  /* R32: a stated fiscal year is a fact of the team layer, one for each government that has one */
  if (team) for (const y of Array.isArray(p.fiscal_year) ? p.fiscal_year : []) if (isObj(y) && isObj(y.government)) out.push({ profile: p.id, fact: "fiscal_year", government: y.government });
  return out;
}

/** R1: the held profile with the fact's value replaced by `value`, for `jurisdictions.validate`; null when the value
 *  is not of the fact's form. */
function withValue(p, parts, value) {
  const q = clone(p);
  if (parts.fact === "time_zone") {
    if (typeof value !== "string") return null;
    (parts.office ? officeIn(q, parts.office, parts.government).time_zone : q.time_zone).value = value;
  } else if (parts.fact === "holidays") {
    if (!Array.isArray(value)) return null;
    const h = q.holidays.find((e) => sameEntry(e, parts));
    h.days = clone(value);
  } else {
    if (!isObj(value) || Object.keys(value).join() !== "weekly") return null;
    officeIn(q, parts.office, parts.government).hours.weekly = clone(value.weekly);
  }
  return q;
}

/* R21: the profile `jurisdictions.validate` is given to judge a zone the team states: the team's zone is held to the
   one rule a profile's `time_zone` is (R41), so the module keeps no second list of zone names. Null for a non-string. */
const teamZoneProbe = (value) => (typeof value === "string"
  ? { id: "team", name: "Team", covers: ["Team"], test: true, time_zone: { value, status: "ruled", basis: "TEST" } } : null);

/* ===================================================================== *
 * The module
 * ===================================================================== */

export class LocalFacts {
  constructor({ storage, record, membership = null, combine = combineProfiles, get = getProfile,
                validate = validateProfile, lines = null, officeOf = null, content = null, provenance = null,
                now = null, host = null } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.combine = combine;
    this.getProfile = get;
    this.validate = validate;
    this.lines = lines;
    this.host = host;
    this.officeOf = typeof officeOf === "function" ? officeOf : null;
    this.content = content;
    this.provenance = provenance;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    migrateLocalFacts(this.sql);   // the tables exist once the instance does, so no caller migrates
    this.expansions = new Map();   // R27: a held id's layers; the layers are frozen data, so the answer is kept
    this.aliasCache = new Map();   // R27: the packages a layer is part of
    this.rules = new GroupRules({
      sql: this.sql, record, combined: () => this.#combined(), validate: (p) => this.validate(p),
      layers: this.#layersApi(), sourceRefusal: (src, viewer) => this.#sourceRefusal(src, viewer),
      instant: () => this.#instant(), dayOf: dayIn,
    });
    this.team = new TeamLayer({
      sql: this.sql, record, validate: (p) => this.validate(p), layers: this.#layersApi(), tierOf: (s, e, memo) => this.#entryTier(s, e, memo),
      sourceRefusal: (src, viewer) => this.#sourceRefusal(src, viewer), instant: () => this.#instant(), now: this.now,
    });
  }

  /* ===================================================================== *
   * R23, R27, R30: the active layers, and the team layer beside them
   * ===================================================================== */

  /* R27: the layers a held id stands for: a package its layers (in the package's order, as `combine` lists them), a layer or a
     profile of no layer itself. `jurisdictions` exports no expansion, so the package's view says which layers it combines. */
  #expand(id) {
    if (this.expansions.has(id)) return this.expansions.get(id);
    let out = [id];
    try {
      const p = this.getProfile(id);
      if (isObj(p) && !isObj(p.layer)) {
        const c = this.combine([id]);
        const ids = c && c.ok && c.view && Array.isArray(c.view.layers) ? c.view.layers.map((l) => l.id).filter((x) => typeof x === "string") : [];
        if (ids.length && !(ids.length === 1 && ids[0] === id)) out = ids;
      }
    } catch { out = [id]; }
    this.expansions.set(id, out);
    return out;
  }

  /* R27: the packages (held ids that are no layer) that stand for `layer`, from the held profiles `jurisdictions.list` names and
     the ids of the setting; a fact once recorded under one of them is the layer's fact now. */
  #aliases(layer) {
    if (this.aliasCache.has(layer)) return this.aliasCache.get(layer);
    const ids = new Set(listProfiles().map((x) => x.id));
    const setting = this.record.getSetting("jurisdiction_profiles");
    if (Array.isArray(setting)) for (const x of setting) if (typeof x === "string") ids.add(x);
    const out = [...ids].filter((q) => q !== layer && this.#expand(q).includes(layer));
    this.aliasCache.set(layer, out);
    return out;
  }

  /* The active layers as held: the setting's ids with a package read as its layers (R27), each as `getProfile` has it. */
  #heldLayers() {
    const ids = this.record.getSetting("jurisdiction_profiles");
    const held = new Map();
    if (Array.isArray(ids)) for (const id of ids) {
      if (typeof id !== "string") continue;
      for (const lid of this.#expand(id)) {
        if (held.has(lid)) continue;
        const p = this.getProfile(lid);
        if (isObj(p)) held.set(lid, p);
      }
    }
    return held;
  }

  /* R23, R30: `combine` over the active layers and the team layer's own confirmed entries (`jurisdictions` R115), each of the
     team's entries in the view tagged `origin: team` with its `government`. `{held, team, c}`; `c` is `combine`'s answer (an
     empty list combines as `combine` says), the view tagged. Never throws. */
  #combineAll() {
    const held = this.#heldLayers();
    const team = this.team.profile();
    /* the setting's own ids are combined, a package as the package (`jurisdictions` R114: a fact's `profile` tag still names the id the
       caller named, and its `layer` tag the layer that holds it), so every caller of the view reads what it read before */
    const raw = this.record.getSetting("jurisdiction_profiles");
    const ids = Array.isArray(raw) ? raw.filter((id) => typeof id === "string" && this.#expand(id).some((x) => held.has(x))) : [];
    let c;
    try { c = this.combine([...(held.size ? ids : []), ...(team ? [team] : [])]); }
    catch (e) { c = { ok: false, errors: [{ code: "COMBINE_FAILED", detail: String(e && e.message || e).slice(0, 200) }] }; }
    if (c && c.ok && team) tagTeam(c.view, team);
    return { held, team, c };
  }
  #combined() { return this.#combineAll().c; }

  /* R23, R28: what the group's rules and the team layer read of the host: whether a layer may be written, which layer a report
     names, the layers a government's entries sit in (for R117's refusal), whether the active layers are test profiles, and the
     one resolution of a closure list's name (`jurisdictions` R121). */
  #layersApi() {
    return {
      writable: (layer) => (layer === TEAM_LAYER ? null : typeof layer === "string" && isObj(this.getProfile(layer)) ? readOnlyRefusal(layer) : unknownLayerRefusal(layer)),
      shipped: (layer) => { if (typeof layer !== "string") return null; if (layer === TEAM_LAYER) return false; const p = this.getProfile(layer); return isObj(p) ? p : null; },
      isTest: () => [...this.#heldLayers().values()].some((p) => p.test === true),
      chain: (government) => {
        const held = this.#heldLayers();
        const all = [...held.values()];
        const at = all.find((p) => isObj(p.layer) && p.layer.level === government.level && p.layer.place === government.place);
        const up = [];
        for (let x = at; x && !up.includes(x); x = x.layer && x.layer.within ? held.get(x.layer.within) : null) up.unshift(x);
        if (!at) { const fed = all.find((p) => isObj(p.layer) && p.layer.level === "federal"); if (fed) up.push(fed); }
        return [...all.filter((p) => !isObj(p.layer)), ...up];
      },
      closure: (name) => {
        const layers = [...this.#heldLayers().values()].filter((p) => isObj(p.layer));
        if (!layers.length) return {};
        const r = nameResolve({ section: "closures", name, layers });
        if (r.ok) return name.startsWith(`${r.layer}:`) ? {} : { name: `${r.layer}:${name}` };
        return r.reason === "NAME_AMBIGUOUS" ? { refusal: ambiguousRefusal(name, r.layers) } : {};
      },
    };
  }

  /* R23: the tier a team-layer entry is confirmed at: a deadline's is its kind's, a law's the highest of the kinds that cite it,
     an action kind's its own; a calendar, an office or a place records are published at is Tier 1. Null when undetermined. */
  #entryTier(section, e, memo = {}) {
    if (["holidays", "counterparties", "systems"].includes(section)) return 1;
    if (!("view" in memo)) { const c = this.#combined(); memo.view = c && c.ok ? c.view : null; }
    const kinds = memo.view && Array.isArray(memo.view.action_kinds) ? memo.view.action_kinds.filter(isObj) : [];
    const tierOf = (k) => { const x = kinds.find((y) => y.kind === k); return x && [1, 2, 3].includes(x.tier) ? x.tier : null; };
    if (section === "action_kinds") return [1, 2, 3].includes(e.tier) ? e.tier : null;
    if (section === "deadlines") return e.applies_to === "claim" ? null : tierOf(e.applies_to);
    const tiers = kinds.filter((k) => Array.isArray(k.laws) && k.laws.includes(e.name)).map((k) => (k.tier ?? null));
    return tiers.length && tiers.every((t) => [1, 2, 3].includes(t)) ? Math.max(...tiers) : null;
  }

  /* R10 (T45; K2807): why a rule's primary source is not a held capture extent the viewer may see, or null. The
     capture's home (`provenance.homeOf`) judged for sight by membership's one rule over record-core's `bundles` read
     contract (a capture unseen answers as absent); then `content.checkContentExtent` over the capture's context
     (`content.contentContextFor`). No viewer sent is a direct internal call and is not fenced. */
  #sourceRefusal(src, viewer) {
    const sha = isObj(src) && typeof src.captureSha === "string" ? src.captureSha.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{64}$/.test(sha) || !isObj(src.extent))
      return { why: word("local-facts.why.source_names_capture") };
    if (!this.provenance && this.host) { try { this.provenance = provenanceOf(this.host); } catch { this.provenance = null; } }
    if (!this.content && this.host) { try { this.content = contentOf(this.host); } catch { this.content = null; } }
    const unseen = { why: word("local-facts.why.capture_held_see") };
    let home = null;
    try { home = this.provenance && typeof this.provenance.homeOf === "function" ? this.provenance.homeOf(sha) : null; } catch { home = null; }
    if (!isObj(home) || typeof home.bundleId !== "string") return unseen;
    if (viewer !== undefined && viewer !== null) {
      const gate = viewerPredicate(viewer);
      const seen = gate.scope !== "DENY"
        && this.#rows(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, home.bundleId, ...gate.args).length > 0;
      if (!seen) return unseen;
    }
    let bad;
    try {
      const ctx = this.content && typeof this.content.contentContextFor === "function" ? this.content.contentContextFor(sha) : null;
      if (!ctx) return { why: word("local-facts.why.capture_content_cannot") };
      bad = checkContentExtent(src.extent, ctx);
    } catch (e) { return { why: word("local-facts.why.extent_checked", { entry: String(String(e && e.message || e).slice(0, 200)) }) }; }
    if (!bad) return null;
    return { why: String(bad.detail || bad.translation || bad.reason || word("local-facts.why.extent_capture")).slice(0, 400),
             code: bad.code || bad.reason || null };
  }

  /* ===================================================================== *
   * R10–R13 (T45): the group's own jurisdiction rules (`rules.mjs`)
   * ===================================================================== */

  /** R10: a member drafts a jurisdiction rule from its primary source. */
  ruleDraft(a = {}) { return this.rules.ruleDraft(a); }
  /** R11: a member other than the drafter confirms it; a professional's statement for Tier 2, 3 or undetermined. */
  ruleConfirm(a = {}) { return this.rules.ruleConfirm(isObj(a) ? a : {}, machineRefusal); }
  /** R12: the group's rules, to a viewer naming a member. */
  groupRules(a = {}) { return this.rules.groupRules(a); }
  /** R18: the fields an entry of a section carries, and their vocabularies. */
  ruleFields(a = {}) { return this.rules.ruleFields(a); }
  /** R12: `combine`'s view of the active profiles with each confirmed, unwithdrawn group rule added. */
  governingView() { return this.rules.governingView(); }
  /** R13: any member withdraws a rule with a reason. */
  ruleWithdraw(a = {}) { return this.rules.ruleWithdraw(a); }
  /** R13: a confirmed rule as canonical bytes with their digest, for the shared profile's maintainers. */
  ruleOffer(a = {}) { return this.rules.ruleOffer(a); }
  /** R28: the team's rule a bare name stands for; NAME_AMBIGUOUS naming each government when two give it. */
  ruleResolve(a = {}) { return this.rules.ruleResolve(a); }

  /** R23: a member drafts an entry of the team layer, about one government, from its primary source. */
  layerEntryDraft(a = {}) { return this.team.layerEntryDraft(a); }
  /** R23: a member other than the drafter confirms it; a professional's statement for Tier 2, 3 or undetermined. */
  layerEntryConfirm(a = {}) { return this.team.layerEntryConfirm(isObj(a) ? a : {}, machineRefusal); }
  /** R23: any member withdraws an entry with a reason. */
  layerEntryWithdraw(a = {}) { return this.team.layerEntryWithdraw(a); }
  /** R23: the team layer's entries with their state, to a viewer naming a member. */
  layerEntries(a = {}) { return this.team.layerEntries(a); }
  /** R30: the confirmed team layer as one profile object (id `team`), the shape `combine` takes; null for a viewer outside the group. */
  teamLayer(a = {}) { return this.team.teamLayer(a); }
  /** R26: a member reports a rule of a Civicsmith layer they believe wrong; its list; the bytes a member carries. */
  layerReport(a = {}) { return this.team.layerReport(a); }
  layerReports(a = {}) { return this.team.layerReports(a); }
  layerReportCarry(a = {}) { return this.team.layerReportCarry(a); }

  #rows(qs, ...a) { return [...this.sql.exec(qs, ...a)]; }
  #instant() { return stampInstant("second", Date.parse(this.now())); }

  /* R3: the zone a profile's days are counted in: its `time_zone` as it governs here (a member's latest correction of
     it, R2, Q6; else the held profile's own), or null when it holds none. */
  #zone(profile, active) {
    const fixed = [...this.#acts(`${profile}/time_zone`)].reverse().find((a) => a.act === "correct");
    if (fixed && typeof fixed.value === "string") return fixed.value;
    const p = active.held.get(profile);
    if (isObj(p) && isObj(p.time_zone) && typeof p.time_zone.value === "string") return p.time_zone.value;
    /* T53: a layer below the state holds no zone of its own; its days are counted in the zone the view gives (`jurisdictions` R102) */
    const v = active.view && isObj(active.view.time_zone) ? active.view.time_zone.value : null;
    return isObj(p) && isObj(p.layer) && typeof v === "string" ? v : null;
  }

  /* R21: the zone held by the active profiles when they agree on one (each as it governs here, `#zone`), else null. It is
     the team's zone until the team states its own. */
  #profileZone(active) {
    const zones = new Set();
    for (const id of active.held.keys()) { const z = this.#zone(id, active); if (z) zones.add(z); }
    return zones.size === 1 ? [...zones][0] : null;
  }

  /* R21: the team's zone as it governs here: its latest correction (a team zone stated), else the profiles' default. */
  #teamZone(active) {
    const fixed = [...this.#acts(TEAM_ZONE_PATH)].reverse().find((a) => a.act === "correct");
    return fixed && typeof fixed.value === "string" ? fixed.value : this.#profileZone(active);
  }

  /* R22: record-core's setting `team_time_zone` holds the team's latest correction, so a module that reads settings alone
     (or sits earlier in the order) takes the team's zone from it. Sets it when it differs from the latest correction;
     the answer is the refusal of `setSetting`, or null. A copy holding a correction and no setting is backfilled by the
     first read or write that comes here (`#active`); a correction writes it in its own transaction (`factConfirm`). */
  #syncTeamZone() {
    const fixed = [...this.#acts(TEAM_ZONE_PATH)].reverse().find((a) => a.act === "correct");
    if (!fixed || typeof fixed.value !== "string" || this.record.getSetting("team_time_zone") === fixed.value) return null;
    const r = this.record.setSetting("team_time_zone", fixed.value, str(fixed.by) || "local-facts");
    return r && r.ok === false ? r : null;
  }

  /* R3 (T45; jurisdictions R74): the zone an office fact's days are counted in. An office's `hours` and its own
     `time_zone` count on that office's local day when the profile holds its own zone (as it governs here: a member's
     latest correction of it, else the held value); otherwise on the profile's (`#zone`). Every other fact counts on the
     profile's. */
  #zoneOf(parts, active) {
    /* R29, R32: a fact of the team layer is counted in the team's zone (else the zone the view gives) */
    if (parts.team || parts.profile === TEAM_LAYER)
      return this.#teamZone(active) ?? (active.view && isObj(active.view.time_zone) && typeof active.view.time_zone.value === "string" ? active.view.time_zone.value : null);
    if (isObj(parts.office) && (parts.fact === "hours" || parts.fact === "time_zone")) {
      const path = factPath({ profile: parts.profile, fact: "time_zone", office: parts.office });
      const fixed = path ? [...this.#acts(path)].reverse().find((a) => a.act === "correct") : null;
      if (fixed && typeof fixed.value === "string") return fixed.value;
      const o = officeIn(active.held.get(parts.profile), parts.office, parts.government);
      if (o && isObj(o.time_zone) && typeof o.time_zone.value === "string") return o.time_zone.value;
    }
    return this.#zone(parts.profile, active);
  }

  /** The module's table, created at construction; kept, idempotent, for the composition root's migration pass. */
  migrate() { migrateLocalFacts(this.sql); }

  /* The active profiles: their ids as held, and the combined view (record-core R26, jurisdictions R12–R16). A profile
     the instance names but cannot resolve, or a list that does not combine, gives no fact. */
  #active() {
    this.#syncTeamZone();
    const { held, team, c } = this.#combineAll();
    let view = null;
    if (held.size || team) {
      if (c && c.ok) view = c.view;
      else held.clear();
    }
    return { held, view, team };
  }

  /* A viewer that membership refuses sees no fact; no viewer sent is a direct internal call and sees every one. */
  static #blind(viewer) { return viewer !== undefined && viewer !== null && viewerPredicate(viewer).scope === "DENY"; }

  /* R27: the acts of a fact, from its path and, for a fact of a layer a package stands for, the path the package once gave it (no
     row is rewritten, R5: the history of the old path is the layer's now). */
  #acts(path) {
    const parts = parseFactPath(path);
    const alias = parts && !parts.team && parts.profile !== TEAM_LAYER ? this.#aliases(parts.profile).map((q) => factPath({ ...parts, profile: q })).filter(Boolean) : [];
    const paths = [path, ...alias];
    return this.#rows(`SELECT seq, act, how, value_json, source, by_member, at FROM local_fact_acts WHERE path IN (${paths.map(() => "?").join(",")}) ORDER BY seq`, ...paths)
      .map((r) => ({ act: r.act, by: r.by_member, at: r.at, how: r.how, value: safeJson(r.value_json),
                     ...(r.act === "correct" ? { source: r.source } : {}) }));
  }

  /* R2, R3: one named fact's status, from its acts and the view. `held` is the profile's own fact (R1: what may be
     acted on), `inView` the fact as the active profiles combine it (absent when withheld as a conflict). Every day it
     shows or counts is a local day of the fact's profile's zone (R3); with no zone, an act's instant is shown whole
     and the horizon is undetermined, never read on the UTC day. */
  #status(path, parts, held, inView, active) {
    const zone = this.#zoneOf(parts, active);
    const when = (at) => dayIn(at, zone) ?? at;
    const acts = this.#acts(path);
    /* R32: a member's statement of a government's fiscal year is that member's confirmation of it, as well as the value that governs */
    const fiscal = parts.fact === "fiscal_year";
    const latestAct = acts.length ? acts[acts.length - 1] : null;
    const latest = latestAct && fiscal && latestAct.act === "correct" ? { ...latestAct, act: "confirm" } : latestAct;
    const said = (a) => (a ? { act: a.act, by: a.by, at: a.at, how: a.how } : null);
    /* R25, R29: the layer the fact is of is named (a fact of the team layer also its government) */
    const base = { path, fact: parts, layer: parts.team ? TEAM_LAYER : parts.profile, ...(parts.government ? { government: clone(parts.government) } : {}),
                   latest: said(latestAct), acts: acts.length };
    if (!inView) {
      return { ...base, status: "absent", due: false, profile: null, governs: null,
               why: fiscal ? localize("local-facts.index.the_team_has_not_stated_year", "the team has not stated this government's fiscal year")
                   : parts.team ? localize("local-facts.index.the_team_has_not_stated", "the team has not stated its time zone, and no installed place gives one; an administrator sets it")
                   : held ? word("local-facts.why.active_jurisdiction_profiles")
                         : word("local-facts.why.active_jurisdiction_profile") };
    }
    const correction = [...acts].reverse().find((a) => a.act === "correct") || null;
    const profile = { value: clone(inView.value), status: inView.status, basis: inView.basis };
    const governs = correction && fiscal
      ? { value: clone(correction.value), origin: "stated", how: correction.how,
          says: localize("local-facts.index.stated_by_by_when", "stated by {by}, {when}", { by: String(correction.by), when: String(when(correction.at)) }) }
      : correction
      ? { value: clone(correction.value), origin: "corrected", source: correction.source,
          says: word("action-clocks.corrected_locally", { by: String(correction.by), at: String(when(correction.at)) }) }
      : { value: clone(inView.value), origin: "profile" };
    const horizon = this.#horizon(parts, latest, zone);
    const setAside = fiscal && active.view && Array.isArray(active.view.set_aside)
      ? active.view.set_aside.find((x) => isObj(x) && x.section === "fiscal_year" && isObj(x.entry) && sameGov(x.entry.government, parts.government)) : null;
    const out = { ...base, profile, governs, ...(fiscal && correction ? { how: correction.how } : {}),
                  ...(setAside ? { set_aside: { by: setAside.by, says: localize("local-facts.index.set_aside_by_the_records", "the places' own records give this government's year, which governs; the team's statement is kept") } } : {}),
                  ...horizon.dates, ...(horizon.undetermined ? { horizon: horizon.undetermined } : {}) };
    if (!latest) return { ...out, status: "unconfirmed", due: horizon.due, why: word("local-facts.why.member_confirmed", { due_why: String(horizon.dueWhy) }) };
    if (latest.act === "dispute") return { ...out, status: "disputed", due: true, why: localize("local-facts.index.disputed_by_by_when", "disputed by {by}, {when}", { by: String(latest.by), when: String(when(latest.at)) }) };
    if (latest.act === "correct") return { ...out, status: "corrected", due: false, why: governs.says };
    /* a confirm: it confirms the value that governed when it was made, until its horizon (R3) */
    if (canonicalJson(latest.value) !== canonicalJson(governs.value))
      return { ...out, status: "unconfirmed", due: horizon.due, lapsed: said(latest),
               why: word("local-facts.why.value_confirmed_changed", { by: String(latest.by), at: String(when(latest.at)), due_why: String(horizon.dueWhy) }) };
    if (horizon.undetermined)
      return { ...out, status: "unconfirmed", due: horizon.due, lapsed: said(latest),
               why: word("local-facts.why.confirmation_cannot_shown", { by: String(latest.by), at: String(latest.at), why: String(horizon.undetermined.why) }) };
    if (horizon.lapsed)
      return { ...out, status: "unconfirmed", due: horizon.due, lapsed: said(latest),
               why: word("local-facts.why.confirmation_lapsed", { by: String(latest.by), at: String(when(latest.at)), lapses_on: String(horizon.dates.lapses_on), due_why: String(horizon.dueWhy) }) };
    return { ...out, status: "confirmed", due: false, why: localize("local-facts.index.confirmed_by_by_when", "confirmed by {by}, {when}", { by: String(latest.by), when: String(when(latest.at)) }) };
  }

  /* R3: when a confirmation of this fact lapses, and from when the fact is due, on local days of `zone`. Without a
     zone the days that need one are undetermined, and `due` is null. */
  #horizon(parts, latest, zone) {
    const today = dayIn(this.#instant(), zone);
    const confirmedAt = latest && latest.act === "confirm" ? latest.at : null;
    const confirmed = confirmedAt ? dayIn(confirmedAt, zone) : null;
    const undetermined = today === null
      ? { undetermined: true, why: word("local-facts.why.profile_holds_time", { profile: String(parts.profile) }) }
      : null;
    if (parts.fact === "holidays") {
      const y = parts.year, due_from = `${y - 1}-11-01`, lapses_on = `${y + 1}-01-01`;
      if (undetermined)
        return { due: null, lapsed: false, undetermined, dueWhy: word("local-facts.whether_year_due", { due_from: String(due_from) }),
                 dates: { due_from, ...(confirmedAt ? { lapses_on } : {}) } };
      const due = today >= due_from;
      return { due, lapsed: !!confirmed && today >= lapses_on,
               dueWhy: due ? word("local-facts.year_due", { due_from: String(due_from) }) : word("local-facts.year_falls_due", { due_from: String(due_from) }),
               dates: { due_from, ...(confirmed ? { lapses_on } : {}) } };
    }
    if (undetermined) return { due: confirmedAt ? null : true, lapsed: false, undetermined, dueWhy: "", dates: {} };
    const lapses_on = confirmed ? addDays(confirmed, LOCAL_FACT_HORIZONS[parts.fact].lapse_days) : null;
    return { due: true, lapsed: !!confirmed && today >= lapses_on, dueWhy: "",
             dates: lapses_on ? { lapses_on } : {} };
  }

  /* One path against the active profiles: its parts, the held fact and the view's, or why it names none. */
  #resolve(path, active) {
    const parts = parseFactPath(path);
    if (!parts) return { named: false };
    if (parts.team) {
      /* R21: always a fact, installed profile or none; `held` is the default the profiles give (value null when none),
         and the view's fact exists once the team has a default or has stated a zone */
      const value = this.#profileZone(active);
      const z = active.view && isObj(active.view.time_zone) ? active.view.time_zone : {};
      const held = { value, status: value ? z.status ?? null : null, basis: value ? z.basis ?? null : null };
      return { named: true, parts, p: null, held, inView: value !== null || this.#acts(path).length ? held : null, path };
    }
    if (parts.profile === TEAM_LAYER) {
      /* R29, R32: a fact of the team layer about one government; a stated fiscal year is a fact even before it is stated, once
         there is something to state it for (`held` null then, `inView` null: it reads absent) */
      const stated = parts.fact === "fiscal_year" ? this.team.statedYear(parts.government) : null;
      if (parts.fact === "fiscal_year") {
        const held = stated ? { value: { body: stated.year.body, start: stated.year.start, named_by: stated.year.named_by, label: stated.year.label }, status: null, basis: null }
                            : { value: null, status: null, basis: null };
        return { named: true, parts, p: active.team, held, inView: stated ? held : null, path };
      }
      const held = active.team ? factIn(active.team, parts, TEAM_LAYER) : null;
      return held ? { named: true, parts, p: active.team, held, inView: factIn(active.view, parts), path } : { named: false, parts };
    }
    let p = active.held.get(parts.profile);
    let where = parts;
    if (!p) {
      /* R27: a path that names a package reads the layer that holds the fact now (the first, in the package's order), and its history */
      const layers = this.#expand(parts.profile).filter((id) => id !== parts.profile && active.held.has(id));
      const givers = layers.filter((id) => factIn(active.held.get(id), { ...parts, profile: id }, id));
      if (!givers.length) return { named: false, parts };
      if (parts.list && givers.length > 1) return { named: false, parts, ambiguous: givers.map((id) => ({ layer: id, ...(active.held.get(id).layer ? { level: active.held.get(id).layer.level, place: active.held.get(id).layer.place } : {}) })) };
      where = { ...parts, profile: givers[0] };
      p = active.held.get(givers[0]);
    }
    const held = factIn(p, where, where.profile);
    return { named: true, parts: where, p, held, inView: held ? factIn(active.view, where) : null, path: factPath(where), asked: where === parts ? undefined : path };
  }

  /* ===================================================================== *
   * R1: factConfirm
   * ===================================================================== */

  /** R1, R5: records a member's `confirm`, `correct` or `dispute` of the fact at `path`, appended and never replaced.
   *  Refusals in order: MACHINE_CANNOT_CONFIRM, NO_SUCH_FACT, FACT_ACT_REFUSED, FACT_HOW_REFUSED, FACT_VALUE_REFUSED. */
  factConfirm(a = {}) {
    const b = isObj(a) ? a : {};
    const machine = machineRefusal(b.by);
    if (machine) return machine;
    const path = typeof b.path === "string" ? b.path : null;
    /* R31: a stated fiscal year is a member's own act: an unstamped `by` is refused as a machine's is (`machineRefusal`, above) */
    const fiscalShape = path ? /^team\/([^/]*)\/fiscal_year$/.exec(path) : null;
    const active = this.#active();
    const r = path && !LocalFacts.#blind(b.viewer) ? this.#resolve(path, active) : { named: false };
    if (r.ambiguous) return ambiguousRefusal(path, r.ambiguous);
    /* R31: a government the path spells with a level K5468 does not allow is a value refused, naming its field (a `confirm` or a
       `dispute` of it names no fact) */
    if (!r.named && fiscalShape && b.act === "correct" && !parseFactPath(path) && !LocalFacts.#blind(b.viewer)) {
      const how = str(b.how);
      if (!how || how.length > HOW_MAX) return refusal("FACT_HOW_REFUSED", `say how you checked, in 1 to ${HOW_MAX} characters.`, { max: HOW_MAX });
      return refusal("FACT_VALUE_REFUSED", localize("local-facts.index.a_stated_year_government", "a stated fiscal year is about a federal, state, county or city government, `federal` with no place."),
                     { field: "government.level", errors: [{ path: "fiscal_year[0].government.level", code: "LAYER_INVALID" }], max: SOURCE_MAX });
    }
    if (!r.named || !r.held) return noSuchFact(path);
    const parts = r.parts;
    const fiscal = parts.fact === "fiscal_year";
    /* R21: nothing governs a team with no zone yet, so there is nothing to confirm or dispute until one is stated; R32: nor a year not stated */
    if (parts.team && b.act !== "correct" && !this.#teamZone(active)) return noSuchFact(path);
    if (fiscal && b.act !== "correct" && !r.inView) return noSuchFact(path);
    const act = b.act;
    /* DEC-49 REGION is-fact-act */
    if (!LOCAL_FACT_ACTS.includes(act))
      return refusal("FACT_ACT_REFUSED", `the act is one of ${LOCAL_FACT_ACTS.join(", ")}.`,
                     { act: typeof act === "string" ? act.slice(0, 40) : null, acts: [...LOCAL_FACT_ACTS] });
    /* END DEC-49 REGION is-fact-act */
    const how = str(b.how);
    /* DEC-49 REGION is-fact-how */
    if (!how || how.length > HOW_MAX)
      return refusal("FACT_HOW_REFUSED", `say how you checked, in 1 to ${HOW_MAX} characters.`, { max: HOW_MAX });
    /* END DEC-49 REGION is-fact-how */
    let value = null, source = null, year = null;
    if (act === "correct" && fiscal) {
      /* R31: the statement is `{body, start, named_by, label}` (the government is the path's), needing neither a source nor a second member */
      const v = isObj(b.value) ? b.value : null;
      year = v ? { government: clone(parts.government), body: v.body, start: v.start, named_by: v.named_by, label: v.label } : null;
      const extra = v ? Object.keys(v).filter((k) => !["body", "start", "named_by", "label"].includes(k) && !(k === "government" && sameGov(v.government, parts.government))) : [];
      const errors = !year ? [{ path: "fiscal_year[0]", code: "VALUE_INVALID", detail: "a stated year is {body, start, named_by, label}" }]
        : [...extra.map((k) => ({ path: `fiscal_year[0].${k}`, code: "VALUE_INVALID", detail: localize("local-facts.index.not_a_field_of_a_stated_year", "{k} is not a field of a stated year", { k: String(k) }) })), ...this.team.yearErrors(year)];
      /* DEC-49 REGION is-fact-correction */
      if (errors.length)
        return refusal("FACT_VALUE_REFUSED", localize("local-facts.index.a_stated_year_gives_its_body", "a stated fiscal year gives its body, start, named_by and label in the form the places' records hold them."),
                       { field: String(errors[0].path || "").split(".").pop() || null, errors: errors.slice(0, 10), max: SOURCE_MAX });
      /* END DEC-49 REGION is-fact-correction */
      /* R31: the places' own records are read first: a different own entry is R23's refusal, an equal one or one that covers it is only theirs */
      const given = [...active.held.values()].filter((x) => isObj(x.layer) && x.layer.origin !== "team");
      const own = given.map((x) => ({ x, e: (Array.isArray(x.fiscal_year) ? x.fiscal_year : []).find((f) => f.body === year.body) })).find((y) => y.e);
      const here = given.find((x) => x.layer.level === parts.government.level && (x.layer.place ?? null) === (parts.government.place ?? null));
      const star = here && (Array.isArray(here.fiscal_year) ? here.fiscal_year : []).find((f) => f.body === "*");
      const records = (e) => ({ government: clone(parts.government), year: { body: e.body, start: e.start, named_by: e.named_by, label: e.label } });
      const equal = (e) => [e.start, e.named_by, e.label].join() === [year.start, year.named_by, year.label].join();
      if (own && !equal(own.e)) return inShippedRefusal(own.x.id, "fiscal_year", year.body, records(own.e));
      /* DEC-49 REGION is-fiscal-year-new */
      if (own || star)
        return refusal("FISCAL_YEAR_IN_RECORDS", localize("local-facts.index.the_records_already_give_this_year", "the places' own records already give this government's fiscal year; there is nothing to state."),
                       { layer: (own || { x: here }).x.id, ...records(own ? own.e : star) });
      /* END DEC-49 REGION is-fiscal-year-new */
      value = { body: year.body, start: year.start, named_by: year.named_by, label: year.label };
    } else if (act === "correct") {
      source = str(b.source);
      const q = b.value === undefined ? null : r.parts.team ? teamZoneProbe(b.value) : withValue(r.p, r.parts, b.value);
      const v = q ? this.validate(q) : null;
      /* DEC-49 REGION is-fact-correction */
      if (!source || source.length > SOURCE_MAX || !v || !v.ok)
        return refusal("FACT_VALUE_REFUSED", "a correction gives the corrected value in the form the profile holds it, "
                       + `and its source in 1 to ${SOURCE_MAX} characters.`,
                       { errors: v && !v.ok ? v.errors.slice(0, 10) : undefined, max: SOURCE_MAX });
      /* END DEC-49 REGION is-fact-correction */
      value = b.value;
    } else {
      /* a confirm or a dispute is about the value that governs now (R2): the latest correction's, else the profile's */
      const s = r.inView ? this.#status(r.path ?? path, r.parts, r.held, r.inView, active) : null;
      value = s && s.governs ? s.governs.value : r.held.value;
    }
    const at = this.#instant();
    const by = str(b.by);
    /* R29: a new act is recorded under the layer's own path, whichever spelling asked */
    const recorded = r.path ?? path;
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO local_fact_acts (path, profile, act, how, value_json, source, by_member, at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    recorded, r.parts.team ? "@team" : r.parts.profile, act, how, canonicalJson(value), source, by, at);
      /* R31: a stated year is at once an entry of the team layer (R30), its `how` kept with it */
      if (year) this.sql.exec(`INSERT INTO team_layers (draft_seq, act, section, government_json, entry_json, source_json, reason, statement, by_member, at)
                               VALUES (NULL, 'state', 'fiscal_year', ?, ?, NULL, ?, NULL, ?, ?)`,
                              canonicalJson(parts.government), canonicalJson(value), how, by, at);
      /* R22: a correction of the team's zone sets the setting in the same transaction (a refusal rolls the act back) */
      const set = r.parts.team && act === "correct" ? this.#syncTeamZone() : null;
      if (set) return set;
      return { ok: true, path: recorded, act, at, ...(r.asked ? { asked: r.asked } : {}) };
    });
  }

  /* ===================================================================== *
   * R2: factStatus
   * ===================================================================== */

  /** R2, R3: one fact's status (with `path`), or every fact of the active profiles, corrections and disputes first.
   *  The list's `note` is member-facing (DEC-149): it names the group's Civicsmith, never "this instance". */
  factStatus(a = {}) {
    const b = isObj(a) ? a : {};
    const active = this.#active();
    const blind = LocalFacts.#blind(b.viewer);
    if (b.path !== undefined && b.path !== null && b.path !== "") {
      const r = !blind && typeof b.path === "string" ? this.#resolve(b.path, active) : { named: false };
      if (r.ambiguous) return ambiguousRefusal(b.path, r.ambiguous);
      if (!r.named) return noSuchFact(typeof b.path === "string" ? b.path : null);
      /* R27: the status is the layer's, under whichever spelling of its path asked */
      const s = this.#status(r.path ?? b.path, r.parts, r.held, r.inView, active);
      return { ok: true, ...s, ...(r.asked ? { path: r.asked, layer_path: s.path } : {}) };
    }
    const facts = blind ? [] : this.#all(active);
    const rank = (f) => (f.status === "corrected" || f.status === "disputed" ? 0 : 1);
    facts.sort((x, y) => rank(x) - rank(y) || (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
    return { ok: true, facts, count: facts.length,
             note: word("local-facts.note.corrections_disputes_come") };
  }

  /* Every fact of the active profiles, once each, with its status. */
  #all(active) {
    const out = new Map();
    /* R21: the team's own zone is read by its path, never listed here: callers that list the facts take the first
       `time_zone` they find as a profile's (`screens-settings`, `progressions`) */
    for (const p of [...active.held.values(), ...(active.team ? [active.team] : [])]) for (const parts of factsOf(p)) {
      const path = factPath(parts);
      if (!path || out.has(path)) continue;
      const r = this.#resolve(path, active);
      if (r.named && r.held) out.set(path, this.#status(path, r.parts, r.held, r.inView, active));
    }
    return [...out.values()];
  }

  /* ===================================================================== *
   * R4: factsDue
   * ===================================================================== */

  /** R4: every fact that is unconfirmed (lapsed included) or disputed, once each; with `paths`, only those of them. A
   *  path that does not name a fact of an active profile is listed in `unknown`; one that names a fact the active
   *  profiles do not hold, in `absent`. Writes nothing. */
  factsDue(a = {}) {
    const b = isObj(a) ? a : {};
    const active = this.#active();
    const blind = LocalFacts.#blind(b.viewer);
    /* every unconfirmed fact (lapsed included) and every disputed one, whatever its due date (K986); its `why` says
       when it falls or fell due, or when it lapsed, or who disputed it */
    const pick = (s) => s.status === "disputed" || s.status === "unconfirmed";
    const shape = (s) => ({ path: s.path, fact: s.fact, status: s.status, due: s.due, why: s.why, latest: s.latest,
                            ...(s.lapsed ? { lapsed: s.lapsed } : {}), ...(s.due_from ? { due_from: s.due_from } : {}),
                            ...(s.lapses_on ? { lapses_on: s.lapses_on } : {}), ...(s.horizon ? { horizon: s.horizon } : {}) });
    if (b.paths === undefined || b.paths === null) {
      const due = blind ? [] : this.#all(active).filter(pick).map(shape);
      return { ok: true, due, unknown: [], absent: [] };
    }
    const asked = [...new Set(Array.isArray(b.paths) ? b.paths : [b.paths])];
    const due = [], unknown = [], absent = [];
    for (const path of asked) {
      const r = !blind && typeof path === "string" ? this.#resolve(path, active) : { named: false };
      if (!r.named) { unknown.push(typeof path === "string" ? path.slice(0, 1000) : null); continue; }
      const s = this.#status(r.path ?? path, r.parts, r.held, r.inView, active);
      if (s.status === "absent") absent.push(path);
      else if (pick(s)) due.push({ ...shape(s), ...(r.asked ? { path: r.asked, layer_path: s.path } : {}) });
    }
    return { ok: true, due, unknown, absent };
  }

  /* ===================================================================== *
   * R6: governingPath
   * ===================================================================== */

  /** R6 (T33-28; ladders §5.4's bridge): the path whose fact governs an office. `fact` is `hours`, `holidays` (of
   *  `year`, else the local year of `at` in the profile's zone) or `time_zone`; `office` is a counterparty's
   *  `{role, body}` or a venue's `{venue}`. The office's own fact when the profile holds one; else, with `entity` (the
   *  office's registry entity), the fact of the nearest entity it is `part_of` at `at` (`lines.structureAt`, one line at
   *  a time upward, at most `connection-grammar`'s default depth) that the profile holds, naming each line followed;
   *  else the profile's `offices` grouping (a holiday year's entry for every office), saying so. A `part_of` line
   *  undetermined at `at`, two at once, or a read `lines` refuses, stops the walk there and answers the fallback with
   *  why. Answers `{ok, path, via, lines, why}`, `path` null when nothing governs; writes nothing; never throws. */
  governingPath(a = {}) {
    try { return this.#governing(isObj(a) ? a : {}); }
    catch (e) { return { ok: true, path: null, via: "none", lines: [], why: word("local-facts.why.undetermined_walk_failed", { entry: String(String(e && e.message || e).slice(0, 200)) }) }; }
  }

  #governing(b) {
    const active = this.#active();
    const profile = typeof b.profile === "string" ? b.profile : null;
    /* R27: a package named is read through the layers it stands for, the first that governs answering */
    if (profile && !active.held.has(profile) && !LocalFacts.#blind(b.viewer)) {
      const layers = this.#expand(profile).filter((id) => id !== profile && active.held.has(id));
      if (layers.length) {
        const rs = layers.map((id) => this.#governing({ ...b, profile: id }));
        return rs.find((x) => x && x.ok && x.path) ?? rs[0];
      }
    }
    if (LocalFacts.#blind(b.viewer) || !profile || !active.held.has(profile)) return noSuchFact(profile);
    const p = active.held.get(profile);
    const fact = b.fact;
    if (fact === "time_zone") {
      /* R6 (T45; jurisdictions R74): an office's own zone when the profile holds one, else the profile's, saying so */
      const office = isObj(b.office) ? b.office : null;
      const ownPath = office ? factPath({ profile, fact, office }) : null;
      if (ownPath && factIn(p, { profile, fact, office }, profile))
        return { ok: true, path: ownPath, via: "own", lines: [], why: word("local-facts.why.profile_holds_office") };
      const path = factPath({ profile, fact });
      const whose = office ? word("local-facts.profile_holds_time")
        : word("local-facts.time_zone_profile");
      return factIn(p, { profile, fact }, profile)
        ? { ok: true, path, via: "profile", lines: [], why: whose }
        : { ok: true, path: null, via: "none", lines: [], why: office
            ? word("local-facts.why.profile_holds_time_zone")
            : word("local-facts.why.profile_holds_time_zone_undetermined") };
    }
    if (fact !== "hours" && fact !== "holidays") return noSuchFact(null);
    const at = typeof b.at === "string" ? b.at : null;
    let year = null;
    if (fact === "holidays") {
      year = Number.isInteger(b.year) ? b.year : null;
      if (year === null && at) {
        const d = /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : dayIn(at, this.#zone(profile, active));
        year = d ? Number(d.slice(0, 4)) : null;
      }
      if (year === null)
        return { ok: true, path: null, via: "none", lines: [],
                 why: localize("local-facts.index.the_year_is_undetermined", "the year is undetermined: give `year`, or `at` with a profile time zone to read its local year") };
    }
    /* the path of `office`'s own fact in the profile, or null */
    const own = (office) => {
      if (!isObj(office) && !(fact === "holidays" && typeof office === "string")) return null;
      if (fact === "hours") {
        const parts = { profile, fact, office };
        const path = factPath(parts);
        return path && factIn(p, parts, profile) ? path : null;
      }
      /* a holiday entry names an office by its role, or a venue by its kind (`jurisdictions` R43) */
      const named = typeof office === "string" ? office : typeof office.role === "string" ? office.role
        : office.venue !== undefined ? { venue: office.venue } : null;
      const tok = named === null ? null : officesToken([named]);
      if (!tok) return null;
      const entries = factsOf(p).filter((f) => f.fact === "holidays" && f.year === year && !f.list && f.offices
                                                 && (officesToken(f.offices) || "").split(",").includes(tok))
        .map((f) => factPath(f)).filter(Boolean).sort();
      return entries[0] || null;
    };
    const fallback = (why, followed = []) => {
      if (fact === "holidays") {
        const parts = { profile, fact, year };
        const path = factIn(p, parts, profile) ? factPath(parts) : null;
        return { ok: true, path, via: path ? "fallback" : "none", lines: followed,
                 why: path ? localize("local-facts.index.why_the_profiles_entry_for", "{why}; the profile's entry for every office governs (its `offices` grouping)", { why: String(why) })
                           : word("local-facts.why.profile_holds_entry", { why: String(why), year: String(year) }) };
      }
      return { ok: true, path: null, via: "none", lines: followed, why: word("local-facts.why.profile_holds_hours", { why: String(why) }) };
    };
    const mine = own(b.office);
    if (mine) return { ok: true, path: mine, via: "own", lines: [], why: word("local-facts.why.profile_holds_office_fact") };
    const entity = typeof b.entity === "string" && b.entity ? b.entity : null;
    if (!entity) return fallback(word("local-facts.registry_entity_given"));
    if (!this.lines && this.host) { try { this.lines = linesOf(this.host); } catch { this.lines = null; } }
    if (!this.lines || typeof this.lines.structureAt !== "function")
      return fallback(localize("local-facts.index.lines_is_not_reachable", "`lines` is not reachable on this host, so no part_of line was followed"));
    if (!at) return fallback(word("local-facts.date_given_part"));
    const followed = [], seen = new Set([entity]);
    let cur = entity;
    for (let hop = 0; hop < BOUNDS.depth_default; hop++) {
      const r = this.lines.structureAt({ entity: cur, at, kinds: ["part_of"], viewer: b.viewer });
      if (!isObj(r) || r.ok === false)
        return fallback(word("local-facts.lines_refused_structure", { cur: String(cur), at: String(at), row: String(isObj(r) && r.reason ? ` (${r.reason})` : "") }), followed);
      /* lines R10: `held` the lines in at `at`, `undetermined` each `{line, why}`; only lines from `cur` lead upward */
      const up = (list) => (Array.isArray(list) ? list : []).filter((l) => isObj(l) && l.kind === "part_of" && l.from === cur);
      const open = up((Array.isArray(r.undetermined) ? r.undetermined : []).map((u) => (isObj(u) && isObj(u.line) ? { ...u.line, why: u.why } : u)));
      if (open.length)
        return fallback(word("local-facts.part_line_undetermined", { open: String(open.map((l) => l.line_id).join(", ")), cur: String(cur), at: String(at), open_2: String(open[0].why ? ` (${reasonText(open[0].why)})` : "") }), followed);
      if (r.truncated) return fallback(word("local-facts.structure_truncated_part", { cur: String(cur), at: String(at) }), followed);
      const held = up(r.held);
      if (!held.length) return fallback(word("local-facts.part_entity_profile", { cur: String(cur), at: String(at) }), followed);
      if (held.length > 1)
        return fallback(word("local-facts.part_entities_governs", { cur: String(cur), held: String(held.length), at: String(at), held_2: String(held.map((l) => l.line_id).join(", ")) }), followed);
      const line = held[0];
      followed.push({ line_id: line.line_id, from: line.from, to: line.to });
      if (typeof line.to !== "string" || seen.has(line.to)) return fallback(word("local-facts.part_lines_return", { entity: String(entity) }), followed);
      seen.add(line.to);
      cur = line.to;
      const office = this.officeOf ? this.officeOf(cur, profile) : null;
      const path = own(office);
      if (path)
        return { ok: true, path, via: "part_of", lines: followed,
                 why: word("local-facts.why.office_fact_held", { cur: String(cur), followed: String(followed.map((l) => l.line_id).join(" → ")) }) };
    }
    return fallback(word("local-facts.entity_within_part", { depth_default: String(BOUNDS.depth_default), entity: String(entity) }), followed);
  }
}

/* R23: the team's entries in the combined view tagged `origin: team` with the `layer` and `government` they are about
   (`jurisdictions` takes the government off when it reads a branch). An entry is found by its key; two governments' entries of
   one key are told apart in the order the layer holds them. */
function tagTeam(view, team) {
  if (!isObj(view)) return;
  for (const sec of ["records_laws", "deadlines", "holidays", "counterparties", "action_kinds", "systems", "fiscal_year"]) {
    const mine = Array.isArray(team[sec]) ? [...team[sec]] : [];
    if (!mine.length || !Array.isArray(view[sec])) continue;
    for (const e of view[sec]) {
      if (!isObj(e) || e.profile !== TEAM_LAYER) continue;
      const k = entryKey(sec, e);
      const at = k === null ? -1 : mine.findIndex((t) => entryKey(sec, t) === k);
      if (at < 0) continue;
      const [t] = mine.splice(at, 1);
      e.origin = "team"; e.layer = TEAM_LAYER; e.government = clone(t.government);
    }
  }
}

/* DEC-49: a code several acts answer is minted at one site, its own function here. */

/* R1, R5, R11: a confirmation, correction or dispute, and a rule's confirmation, is a named member's act. */
function machineRefusal(by) {
  /* DEC-49 REGION is-fact-member */
  if (str(by) && !isMachineIdentity(str(by))) return null;
  return refusal("MACHINE_CANNOT_CONFIRM", localize("local-facts.index.confirming_correcting_or_disputing_a", "confirming, correcting or disputing a local fact, or confirming a team's rule, is a named member's act; an assistant's re-check reaches a member as its run's output. Nothing was written."));
  /* END DEC-49 REGION is-fact-member */
}

/* R1, R2: a path R6 does not name in an active profile. */
function noSuchFact(path) {
  /* DEC-49 REGION is-fact-named */
  return refusal("NO_SUCH_FACT", "no local fact of the active jurisdiction profiles answers to that path.",
                 { path: typeof path === "string" ? path.slice(0, 1000) : null });
  /* END DEC-49 REGION is-fact-named */
}

/** R15: the ops whose handlers are this module's (K3), one arm per act and read: the control plane routes,
 *  authenticates and stamps them (`by` in the body; `viewer` in the URL, read after the body so a body cannot set it).
 *  `plane` spreads the map (its R39) and names no entry of it. A read's `paths` are the body's list, or the query's
 *  repeated `path`. */
export function localFactsOps(s, url, body) {
  const qp = (k) => url.searchParams.get(k);
  const b = isObj(body) ? body : {};
  const paths = () => (Array.isArray(b.paths) ? b.paths : url.searchParams.getAll("path").length ? url.searchParams.getAll("path") : undefined);
  return {
    factconfirm: () => s.factConfirm({ ...b, viewer: qp("viewer") }),
    factstatus: () => s.factStatus({ path: qp("path") ?? b.path, viewer: qp("viewer") }),
    factsdue: () => s.factsDue({ paths: paths(), viewer: qp("viewer") }),
    /* R10–R13 (T45): the group's own rules; `by` the body's stamp, `viewer` the URL's */
    ruledraft: () => s.ruleDraft({ ...b, viewer: qp("viewer") }),
    ruleconfirm: () => s.ruleConfirm({ ...b, viewer: qp("viewer") }),
    rulewithdraw: () => s.ruleWithdraw({ ...b, viewer: qp("viewer") }),
    ruleoffer: () => s.ruleOffer({ rule: qp("rule") ?? b.rule, by: b.by, viewer: qp("viewer") }),
    /* R15 (T46; N935): R12's read, `section` the query's (absent read as none), `viewer` the URL's */
    grouprules: () => s.groupRules({ section: qp("section") ?? undefined, viewer: qp("viewer") }),
    /* R18 (T51; DEC-340): the fields a drafted rule is made of, `section` the query's, `viewer` the URL's */
    rulefields: () => s.ruleFields({ section: qp("section") ?? undefined, viewer: qp("viewer") }),
    /* R28 (T53): the team's rule a bare name stands for, NAME_AMBIGUOUS naming each government when two give it */
    ruleresolve: () => s.ruleResolve({ section: qp("section") ?? b.section, name: qp("name") ?? b.name, applies_to: qp("applies_to") ?? b.applies_to,
                                       government: b.government, viewer: qp("viewer") }),
    /* R23 (T53): the team layer's entries, drafted, confirmed and withdrawn as rules are; `by` the body's, `viewer` the URL's */
    layerentrydraft: () => s.layerEntryDraft({ ...b, viewer: qp("viewer") }),
    layerentryconfirm: () => s.layerEntryConfirm({ ...b, viewer: qp("viewer") }),
    layerentrywithdraw: () => s.layerEntryWithdraw({ ...b, viewer: qp("viewer") }),
    layerentries: () => s.layerEntries({ section: qp("section") ?? undefined, viewer: qp("viewer") }),
    /* R26 (T53): a team's report on a Civicsmith layer's rule; the bytes a member carries */
    layerreport: () => s.layerReport({ ...b, viewer: qp("viewer") }),
    layerreports: () => s.layerReports({ viewer: qp("viewer") }),
    layerreportcarry: () => s.layerReportCarry({ report: qp("report") ?? b.report, by: b.by, viewer: qp("viewer") }),
  };
}

/* R20 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  ruledraft: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("local-facts.declared.ruledraft", "rule-directed: keyed by a profile section and an entry; a member drafts a rule from its primary source, with a reason; the group's own rule beside the profiles, never a profile's; moves no bundle"),
    fields: { accepts: ["section","entry","source","reason"], requires: ["section","entry","source","reason"] } },
  ruleconfirm: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("local-facts.declared.ruleconfirm", "rule-directed: keyed by group rule; a member other than its drafter confirms it, and it applies from then; the group's own rule beside the profiles, never a profile's; moves no bundle"),
    fields: { accepts: ["rule","statement"], requires: ["rule"] } },
  rulewithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("local-facts.declared.rulewithdraw", "rule-directed: keyed by group rule; a member withdraws it with a reason, kept and never deleted; the group's own rule beside the profiles, never a profile's; moves no bundle"),
    fields: { accepts: ["rule","reason"], requires: ["rule","reason"] } },
  layerentrydraft: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "reasoned", description: localize("local-facts.declared.layerentrydraft", "layer-directed: keyed by a section, an entry and the government it is about; a member drafts an entry of the team's layer from its primary source, with a reason; never a Civicsmith layer's; moves no bundle"),
    fields: { accepts: ["section","entry","government","source","reason","layer"], requires: ["section","entry","government","source","reason"] } },
  layerentryconfirm: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "undetermined", description: localize("local-facts.declared.layerentryconfirm", "layer-directed: keyed by a team-layer entry; a member other than its drafter confirms it, and it applies from then; moves no bundle"),
    fields: { accepts: ["entry","statement"], requires: ["entry"] } },
  layerentrywithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "reasoned", description: localize("local-facts.declared.layerentrywithdraw", "layer-directed: keyed by a team-layer entry; a member withdraws it with a reason, kept and never deleted; moves no bundle"),
    fields: { accepts: ["entry","reason"], requires: ["entry","reason"] } },
  layerreport: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "reasoned", description: localize("local-facts.declared.layerreport", "layer-directed: keyed by a Civicsmith layer and the path of one of its entries; a member reports a rule they believe wrong, with what they believe and where they read it; transmits nothing; moves no bundle"),
    fields: { accepts: ["layer","key","said","believes","source"], requires: ["layer","key","said","believes","source"] } },
  layerreportcarry: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["by","viewer"], needs: null, weight: "reversible", description: localize("local-facts.declared.layerreportcarry", "layer-directed: keyed by a team report; a member takes its bytes and digest to carry to Civicsmith, and it reads carried; transmits nothing; moves no bundle"),
    fields: { accepts: ["report"], requires: ["report"] } },
  layerentries: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("local-facts.declared.layerentries", "read: the team layer's entries with their state, source, drafter and confirmer, and each stated fiscal year with how it was checked, to a member; writes nothing"),
    fields: { accepts: ["section"], requires: [] } },
  layerreports: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("local-facts.declared.layerreports", "read: the team's reports on Civicsmith layers' rules with their state, to a member; writes nothing"),
    fields: { accepts: [], requires: [] } },
  ruleresolve: { classes: ["admin","member"], machineClasses: [], mutating: false, weight: "read", description: localize("local-facts.declared.ruleresolve", "read: the team's rule a bare name stands for, or each government that gives it when two do; writes nothing"),
    fields: { accepts: ["section","name","applies_to","government"], requires: ["section","name"] } },
  factconfirm: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("local-facts.declared.factconfirm", "fact-directed: keyed by a profile fact's path, reached from the calendar and offices; moves no bundle"),
    fields: { accepts: ["path","act","how","value","source"], requires: ["path","act","how"] } },
});

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. Its tables are created with it and declared
 *  with their classes (R5, R9, R14, K23). */
export function localFactsOf(host, deps) {
  let s = instances.get(host);
  if (!s) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    s = new LocalFacts({ ...d, storage, record, membership, host });
    instances.set(host, s);
    record.declareTable("local-facts", LOCAL_FACTS_TABLE_CLASSES.map((e) => ({ ...e, keys: [...e.keys] })));
  }
  return s;
}
