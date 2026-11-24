/* plane R21–R23 (T33-90): the small adapters the composition root hands the modules T33 adds, held apart from the class
   so each is tested at the interface without the Durable Object runtime. None holds a construct: each is the port one
   module's requirements name, answered by the module that owns the answer (R9). */
import { registerDoctype } from "../../../docprofile/registry.mjs";
import { registerDoctypes, generic } from "../../../doctypes/index.mjs";
import { registerLegistar } from "../../../legistar-reader/index.mjs";
import { registerRosterTypes, ROSTER_TYPES, rosterColumns } from "../../../roster-reader/index.mjs";
import { readerView } from "../../../docprofile/registry.mjs";
import { viewerPredicate, Membership } from "../membership/index.mjs";
import { parseFrontmatter } from "../record-grammar/index.mjs";
import { parseCsv } from "../calculations/index.mjs";
import { registerCourtTypes } from "../../../court-doctypes/index.mjs";
import { registerBudgetTypes } from "../../../budget-doctypes/index.mjs";
import { factReader } from "../action-clocks/index.mjs";
import { MACHINE_VIEWER } from "../lines/index.mjs";
import { combine, get as profileOf } from "../../../jurisdictions/index.mjs";
import { localize } from "../setup-words/index.mjs";

/** R22 (T33-12; docprofile R36; K617, K1513): the content types registered into docprofile's registry, in this order
 *  and once each: doctypes' seven, Legistar's, the roster and org-chart readers, the court registers, the budget
 *  readers, then `generic` last. Each register function is idempotent on the one `registerDoctype`, and docprofile's
 *  registry is the isolate's, so a second call registers nothing new. Answers each step's answer, in order. */
export function registerReaders(register = registerDoctype) {
  return [
    ["doctypes", registerDoctypes(register)],
    ["legistar-reader", registerLegistar(register)],
    ["roster-reader", registerRosterTypes(register)],
    ["court-doctypes", registerCourtTypes(register)],
    ["budget-doctypes", registerBudgetTypes(register)],
    ["generic", register(generic)],
  ];
}

/** R23 (K1505 (6); people R19; N633, K1730; roster-reader R12): the store's read roster-reader's `rosterSource(reads)`
 *  is handed, `({organisation, viewer}) → {items}`. It answers the held rosters of that organisation (an entity id) the
 *  viewer may see (membership's sight over the bundle that holds each, `viewerPredicate`; a viewer never sent is an
 *  in-plane read and sees every one), in roster-reader's item shapes:
 *  - each capture extraction placed as `staff_roster` or `org_chart` (its `readings`' content type) that entities
 *    resolved to the organisation (`resolutions`), as a document `{source: {capture_sha}, type, text}`, its text the
 *    capture's text units in reading order (extraction's `capture_text`);
 *  - each table calculations holds whose source capture entities resolved to the organisation and whose header
 *    roster-reader names a roster (its R6, `rosterColumns`, under the reader view roster-reader reads it with), as a
 *    table `{source: {table}, header, rows}`, its rows the canonical bytes calculations holds for a synchronous read
 *    (`calc_table_bytes`, its R1), never copied anywhere.
 *  Synchronous, as a roster source answers; it writes nothing. A read that fails answers `{ok: false, why}`, which
 *  roster-reader states as "held as a table, not read". */
export const ROSTER_CONTENT_TYPES = Object.freeze(ROSTER_TYPES.map((t) => t.key));
export function rosterReads({ sql, sight = viewerPredicate }) {
  return ({ organisation = null, viewer = null } = {}) => {
    if (typeof organisation !== "string" || organisation === "") return { ok: false, why: localize("store-assembly.wiring.no-organisation", "no organisation was named by its entity id") };
    try {
      const g = viewer === null || viewer === undefined ? { sql: "1=1", args: [] } : sight(viewer);
      const db = sql();
      const items = [];
      const types = ROSTER_CONTENT_TYPES.map(() => "?").join(",");
      for (const r of [...db.exec(`SELECT DISTINCT rd.capture_sha AS sha, rd.content_type AS type FROM readings rd
                                     JOIN bundles b ON b.bundle_id = rd.bundle_id
                                    WHERE rd.content_type IN (${types})
                                      AND rd.capture_sha IN (SELECT capture_sha FROM resolutions WHERE entity_id = ?)
                                      AND (${g.sql}) ORDER BY rd.capture_sha`, ...ROSTER_CONTENT_TYPES, organisation, ...g.args)]) {
        const text = [...db.exec(`SELECT text FROM capture_text WHERE capture_sha = ? ORDER BY seq`, r.sha)].map((u) => u.text).join("\n");
        items.push({ source: { capture_sha: r.sha }, type: r.type, text });
      }
      const view = readerView({});
      for (const t of [...db.exec(`SELECT t.sha AS sha, t.header_json AS header FROM calc_tables t
                                     JOIN bundles b ON b.bundle_id = t.bundle_id
                                    WHERE json_extract(t.source_json, '$.capture_sha') IN (SELECT capture_sha FROM resolutions WHERE entity_id = ?)
                                      AND (${g.sql}) ORDER BY t.sha`, organisation, ...g.args)]) {
        let header;
        try { header = JSON.parse(t.header); } catch { continue; }
        if (!rosterColumns(header, view).roster) continue;
        const csv = [...db.exec(`SELECT chunk FROM calc_table_bytes WHERE sha = ? ORDER BY seq`, t.sha)].map((c) => c.chunk).join("");
        const parsed = csv ? parseCsv(csv) : null;
        const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows.slice(1) : null;
        items.push(rows ? { source: { table: t.sha }, header, rows } : { source: { table: t.sha }, header });
      }
      return { items };
    } catch (e) {
      return { ok: false, why: localize("store-assembly.wiring.roster-read-failed", "the store's read of held rosters failed ({reason})", { reason: String((e && e.message) || e).slice(0, 160) }) };
    }
  };
}

/** K1563 (10), K1654: the seeded offices' two reads (instance-setup R50), asked of instance-setup's instance when it
 *  answers them, else null, so local-facts falls back to the profile and conformance names no entity, each saying so. */
export function officePorts(instanceSetup) {
  const ask = (name, ...a) => {
    let s;
    try { s = instanceSetup(); } catch { return null; }
    if (!s || typeof s[name] !== "function") return null;
    try { return s[name](...a) ?? null; } catch { return null; }
  };
  return { officeOf: (entityId, profile) => ask("officeOf", entityId, profile),
           officeEntityOf: (office) => ask("officeEntityOf", office) };
}

/** K1569 (duties R9; civil-time R9): the `factOf` civil-time reads a calendar entry's status through: a closure-list
 *  entry is the profile's list, never a local fact (K1519); an office-calendar entry is local-facts' answer, read as
 *  action-clocks' `factReader` reads it (its R12). */
export function dutiesFactOf(localFacts) {
  return (h) => {
    if (h && typeof h === "object" && h.list !== undefined && h.list !== null) return { status: "profile_list" };
    const read = factReader(localFacts(), null);
    return read ? read(h) : { status: "absent", why: localize("store-assembly.wiring.local-facts-unreachable", "local facts are not reachable on this host") };
  };
}

/* The bundle's own date, from its document's front matter (`created`), a local day. */
function createdOf(files) {
  const doc = Array.isArray(files) ? files.find((f) => f && f.path === "bundle.md") : null;
  const m = doc && typeof doc.text === "string" ? /^created:\s*"?(\d{4}-\d\d-\d\d)/m.exec(doc.text) : null;
  return m ? m[1] : null;
}

/** K1593 (retrieval R68 route (b)): the projected fields' providers, each the owner's one rule. `standard`: the
 *  standards a bundle's readings cite (`standards.standardsFor`, its R21). `holder`: for each office a bundle's
 *  captures resolve to (entities' read contract, R35), its holder on the bundle's own date (`lines.holderAt`, its
 *  R11), only a holder `lines` determines. Synchronous; a read that refuses or throws gives nothing. */
export function retrievalTerms({ standards, lines, sql }) {
  return {
    standard: ({ bundleId }) => {
      const r = standards().standardsFor({ target: bundleId, limit: 500, viewer: MACHINE_VIEWER });
      return r && r.ok !== false && Array.isArray(r.items) ? r.items.map((i) => i && i.standard).filter(Boolean) : [];
    },
    holder: ({ bundleId, files }) => {
      const at = createdOf(files);
      if (!at) return [];
      const offices = [...sql().exec(`SELECT DISTINCT r.entity_id AS id FROM resolutions r JOIN entities e
                                        ON e.entity_id = r.entity_id WHERE r.bundle_id = ? AND e.kind = 'office'`, bundleId)];
      const out = [];
      for (const { id } of offices) {
        const h = lines().holderAt({ office: id, at, viewer: MACHINE_VIEWER });
        if (h && typeof h.holder === "string") out.push(h.holder);
      }
      return out;
    },
  };
}

/** R21 (K1570; workbooks R6, R7; sheet-worker): the recompute workbooks reads as `ctx.recompute(captureSha)`, over the
 *  `SHEET_WORKER` service binding (`POST /recompute {capture_sha, store}`), the store being the object's namespace.
 *  None bound: a refusal workbooks records as "not recomputed here", never a guess. */
export const NO_ENGINE = Object.freeze({ ok: false, reason: "NO_ENGINE", why: "no engine bound: SHEET_WORKER is not bound to this plane" });
export function sheetRecompute(env, storeName) {
  return async (captureSha) => {
    const w = env && env.SHEET_WORKER;
    if (!w || typeof w.fetch !== "function") return NO_ENGINE;
    const r = await w.fetch("https://sheet-worker/recompute", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ capture_sha: captureSha, store: storeName() }) });
    return r.json();
  };
}

/** K1832 (ratification R42, R39, R6): the Worker's reach ratification is handed, so a scheduled edition's commit, run on
 *  the object at its time, copies its materials and assembles its container in-process, as `op=caseratify` does in the
 *  Worker: the environment (its buckets), a stub whose `fetch` is this object's own door (`door`, the class's `fetch`,
 *  answering through control-plane's frame as a stub of the object would), and the store's name, the object's own
 *  namespace read when asked. */
export function ratificationWorker({ env, door, namespace }) {
  return { env, stub: { fetch: (u, init) => door(u instanceof Request ? u : new Request(u, init)) },
           get storeName() { return namespace(); } };
}

/* A host and, for a `workers.dev` name (`<name>.<subdomain>.workers.dev`), the suffix `.<subdomain>.workers.dev`, which
   holds every fleet member on the account. */
function withFleet(host) {
  const labels = host.split(".");
  return labels.length >= 4 && labels.slice(-2).join(".") === "workers.dev" ? [host, `.${labels.slice(-3).join(".")}`] : [host];
}

/* R28: a bare host name as instance-setup R7 forms one (lower-cased, a trailing dot removed; no scheme, path, port or IP
   literal; the last label begins with a letter), else null. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function bareHost(entry) {
  if (typeof entry !== "string") return null;
  const h = entry.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h.length > 253) return null;
  const labels = h.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !/^[a-z]/.test(labels[labels.length - 1])) return null;
  return h;
}

/* R28: a skipped entry is named in the log by a correlation id only, never by its text. */
const logSkipped = (correlation) =>
  console.warn(JSON.stringify({ event: "own_hosts_entry_skipped", module: "plane", correlation }));

/** F16, R28 (K1881, K2038, N745; capture R73, acquisition R42, capture-sources R55, R65; installer R47): the group's own
 *  hosts, the copy's own and every fleet member's. Two sources, joined, each host once:
 *  - `ownHostsVar`, the `OWN_HOSTS` binding the installer writes (its R47), comma-separated host names, so the copy
 *    knows its own hosts before a group domain is claimed; a malformed entry is skipped and named in the log by a
 *    correlation id only (`log(correlation)`);
 *  - the host of the origin the administrator's session reached when the group's domain was claimed (`instance-setup`'s
 *    `groupIdentity().domain_claim.instance_address`, its R7), since the object cannot see the host a request reached
 *    (the door forwards every request as `http://do/`).
 *  Each `workers.dev` host also gives its account's suffix (`withFleet`). The claimed domain itself is the group's own
 *  website, which a member may capture, so it is never one. With neither the list is empty and the own-host checks
 *  refuse nothing (capture-sources R65: fail-open, F16 low). Never throws. */
export function ownHostsOf(identity, ownHostsVar = null, { log = logSkipped, correlation = () => crypto.randomUUID() } = {}) {
  const out = [];
  const add = (hosts) => { for (const h of hosts) if (!out.includes(h)) out.push(h); };
  if (typeof ownHostsVar === "string" && ownHostsVar.trim() !== "") {
    for (const entry of ownHostsVar.split(",")) {
      if (entry.trim() === "") continue;
      const h = bareHost(entry);
      if (h) add(withFleet(h));
      else { try { log(correlation()); } catch { /* a log that fails skips the entry all the same */ } }
    }
  }
  try {
    const address = identity && identity.domain_claim && identity.domain_claim.instance_address;
    if (typeof address !== "string" || address === "") return out;
    const u = new URL(address);
    if (u.protocol !== "https:" && u.protocol !== "http:") return out;
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    if (host) add(withFleet(host));
  } catch { /* an unreadable address gives nothing */ }
  return out;
}

/** (K2586; wizard-scripts R23, D52, D53) the front door's finder, `door.findExisting(message, viewer)`, registered with
 *  `wizard-scripts` at start: the existing work a first message matches, as this viewer may see it, `[{kind, id, name}]`:
 *  the steps whose work is like it (`steps.stepsLike`, its R7, through its own sight), then the questions and projects
 *  the record's search finds for it (`retrieval.search`, its viewer gate, D-15), each kept once by wizard-scripts. Each
 *  provider is asked of its getter at the call; one that throws or refuses contributes nothing. Writes nothing. */
export const FRONT_DOOR_KINDS = Object.freeze({ inquiry: "question", project: "project" });
export function frontDoorFinder({ steps, retrieval, limit = 20 }) {
  return (message, viewer) => {
    const out = [];
    try {
      const s = steps().stepsLike({ work: message, viewer });
      for (const x of (s && s.ok === true && Array.isArray(s.steps) ? s.steps : [])) out.push({ kind: "step", id: x.step, name: x.work });
    } catch { /* none from steps */ }
    try {
      const r = retrieval().search({ q: message, viewer, limit, facets: false, widen: false });
      for (const h of (r && Array.isArray(r.hits) ? r.hits : []))
        if (Object.hasOwn(FRONT_DOOR_KINDS, h.object_type)) out.push({ kind: FRONT_DOOR_KINDS[h.object_type], id: h.bundle_id, name: h.title });
    } catch { /* none from the record's search */ }
    return out;
  };
}

/** R51 (T48; N847; K2591; DEC-227 (3), (4); `wizard-scripts` R23, R37; `jurisdictions` R89, R90) the front door's pointer,
 *  `door.pointer(viewer)`, registered with `wizard-scripts` beside the finder: the places outside Civicsmith a member is
 *  sent to, as profile data. `setting(name)` is `record-core`'s setting read, asked at EACH call, never once at start, so a
 *  profile set later is seen. With no active profile (the setting unset or empty) it answers `{places: [], pointers: []}`;
 *  with active profiles, `{places: [each active profile's name], pointers: view.pointers || []}`, `jurisdictions.combine`
 *  over the ids in order; a `combine` answering `ok: false`, or anything that throws, answers `null`. It names no place
 *  itself (R9), and the viewer is not read (the view is the instance's, not a member's). */
export function frontDoorPointer({ setting }) {
  return () => {
    try {
      const ids = setting("jurisdiction_profiles");
      if (!Array.isArray(ids) || ids.length === 0) return { places: [], pointers: [] };
      const combined = combine(ids);
      if (!combined || combined.ok !== true || !combined.view) return null;
      const places = ids.map((id) => { const p = profileOf(id); return p && typeof p.name === "string" ? p.name : null; })
        .filter((n) => n !== null);
      return { places, pointers: Array.isArray(combined.view.pointers) ? combined.view.pointers : [] };
    } catch { return null; }
  };
}

/** R58 (T50; N1186, K3557; `membership` R150): the two readers the plane registers with `membership.registerProjectReach`
 *  for the modules that cannot (`provenance` and `connections` are in closed layers). Each answers `fn({project})`, a list
 *  of bundle ids and nothing else, over the plane's own instances, handed as getters and asked at each call:
 *  - `provenance`: the home bundle (`provenance.homeOf`) of each capture that the project's own bundles hold (the
 *    project's bundle and every bundle `record.listBundles({project})` lists): each one's `provenance.capturesOf` and the
 *    digests of its live files (`files.sha256`, record-core R37; K3771), since a capture's digest is no bundle id; a
 *    digest with no home adds nothing;
 *  - `connections`: the records the project's document cites, the targets of its `references[]` entries of rel `cites`
 *    whose edge is not severed (`connections.edgeSevered`).
 *  A reader that throws, or reads nothing, adds nothing (membership R150: the reach narrows, never widens). Both are
 *  bounded by `Membership.PROJECT_REACH_LIMIT`. Neither writes. */
export function projectReachReaders({ record, provenance, connections, sql = null }) {
  const LIMIT = Membership.PROJECT_REACH_LIMIT, PAGE = 200;
  const own = (project) => {
    const ids = [project];
    let after = "";
    for (;;) {
      const page = record().listBundles({ project, after, limit: PAGE });
      const got = page && Array.isArray(page.ids) ? page.ids : [];
      for (const id of got) if (!ids.includes(id) && ids.length < LIMIT) ids.push(id);
      if (got.length < PAGE || ids.length >= LIMIT || typeof page.cursor !== "string" || page.cursor === "" || page.cursor === after) break;
      after = page.cursor;
    }
    return ids;
  };
  const said = (project) => typeof project === "string" && project !== "";
  return {
    provenance: ({ project } = {}) => {
      if (!said(project)) return [];
      const out = new Set(), p = provenance();
      for (const b of own(project)) {
        /* K3771 (R58): the captures homed in the bundle, and the digests of its live files (record-core R37), each through homeOf */
        const digests = p.capturesOf(b).map((c) => c.capture_sha);
        if (sql) for (const r of sql().exec(`SELECT DISTINCT sha256 FROM files WHERE bundle_id = ?`, b)) digests.push(r.sha256);
        for (const capture_sha of digests) {
          const home = p.homeOf(capture_sha);
          if (home && typeof home.bundleId === "string" && home.bundleId !== "" && out.size < LIMIT) out.add(home.bundleId);
        }
        if (out.size >= LIMIT) break;
      }
      return [...out];
    },
    connections: ({ project } = {}) => {
      if (!said(project)) return [];
      const md = record().readFile(project, "bundle.md");
      const refs = md && typeof md.text === "string" ? parseFrontmatter(md.text).data?.references : null;
      const c = connections(), out = new Set();
      for (const r of Array.isArray(refs) ? refs : []) {
        if (!r || r.rel !== "cites" || typeof r.target !== "string" || r.target === "") continue;
        if (!c.edgeSevered(project, r.target, "cites") && out.size < LIMIT) out.add(r.target);
      }
      return [...out];
    },
  };
}
