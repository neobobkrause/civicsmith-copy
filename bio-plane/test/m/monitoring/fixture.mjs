/* monitoring over the modules it uses, each the real one where it writes or reads the record (record-core,
   membership, promotion, provenance, observation-log, capture), on a real SQLite database (node:sqlite) standing in
   for a Durable Object's storage. What stands in, and why: retrieval's projection of the four monitoring columns
   (`monitor_enabled`, `monitor_frequency`, `monitor_last_checked`, `source_locator`, K75 (3)) is a promotion step
   the fixture registers, projecting from the document as retrieval does into retrieval's own table
   (`bundle_projection`, created by retrieval's `PROJECTION_SCHEMA`, the statements its `migrate()` runs; R61, N283); the host governor records every call and
   refuses the hosts a test names; the network is a scripted `fetch` the test controls; the evidence bucket is an
   in-memory R2 stand-in; credentials is the real module, made after membership as the composition root makes it; action-clocks and escalation are stand-ins in their Provides' shapes unless a test passes the real one;
   intent and publication are absent unless a test passes one (the providers' published fixtures, follow-up 27); case-import is the real module (no watch in force) unless a test passes one (`docket.test.mjs` passes
   the real module holding watches, seen through a spy); `realActions` makes the real actions and action-clocks modules; the tables other modules'
   promotion steps read once a wake has reached them on this host (`refs`, connections'; `inquiry_bundle_facts`,
   inquiry's) are created as the plane creates them (N506's tail, K1164: SCHEDULER #25 found a promotion after a wake
   failing on them here), their statements copied, since this module uses neither. Every test drives `monitoring` at its
   interface. The content types are docprofile's registry as a test leaves it: empty unless the test registers a stand-in
   (`registerCalendarStub`), since `doctypes` is a later module's composition (T34-8). */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { Capture } from "../../../src/capture/index.mjs";
import { monitoringOf } from "../../../src/monitoring/index.mjs";
import { actionsOf, actionFacts } from "../../../src/actions/index.mjs";
import { actionClocksOf } from "../../../src/action-clocks/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { PROJECTION_SCHEMA, PROJECTION_TABLE } from "../../../src/retrieval/schema.mjs";
import { registerDoctype, CONTRACT, CONFIDENCE } from "../../../../docprofile/registry.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
/** A Durable Object's storage over an in-memory SQLite database. */
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  /* The plane's shape (K316, K313): `exec` answers a CURSOR (iterable once, `toArray()`, `one()`), never an array, and
     a LIKE or GLOB pattern longer than workerd's 50 bytes is refused as workerd refuses it. */
  const cursor = (rows) => { const it = rows[Symbol.iterator]();
    return { [Symbol.iterator]() { return it; }, next: () => it.next(), toArray: () => [...it],
             one: () => { const r = it.next(); return r.done ? null : r.value; } }; };
  const sql = {
    exec(q, ...args) {
      for (const m of String(q).matchAll(/\b(?:LIKE|GLOB)\s+'((?:[^']|'')*)'/gi))
        if (Buffer.byteLength(m[1]) > 50) throw new Error("LIKE or GLOB pattern too complex");
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
    },
  };
  return {
    db, sql,
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

export const sha = (b) => createHash("sha256").update(typeof b === "string" ? Buffer.from(b, "utf8") : Buffer.from(b)).digest("hex");
export const NOW_MS = Date.parse("2026-09-28T12:00:00Z");
export const NOW = "2026-09-20T00:00:00Z";
export const DAEMON = "class:daemon";
export const V = (id) => `member:${id}`;

/** An evidence bucket (the R2 binding's shape), recording every call. */
export function bucket() {
  const held = new Map(), calls = [];
  const obj = (k) => { const b = held.get(k); return { key: k, size: b.length,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  return {
    calls, held, failPut: false,
    async head(k) { calls.push(["head", k]); return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async get(k) { calls.push(["get", k]); return held.has(k) ? obj(k) : null; },
    async put(k, bytes) { calls.push(["put", k]); if (this.failPut) throw new Error("bucket refused"); held.set(k, new Uint8Array(bytes)); return { key: k }; },
  };
}

/** host-governor's R1–R14 as monitoring reaches them, each call recorded; `refuse` names hosts to refuse. */
export function governor({ refuse = [] } = {}) {
  const calls = [];
  return {
    calls, refuse,
    governorAdmit({ host }) { calls.push(["admit", host]); return this.refuse.includes(host)
      ? { admitted: false, reason: "cooling_off", retry_in_ms: 5000 } : { admitted: true, wait_ms: 0 }; },
    governorReport(r) { calls.push(["report", r.host, r.status]); return { recorded: true }; },
  };
}

/** A scripted network: `routes` maps a URL to a Response factory (or an Error to throw); every fetch is recorded. */
export function network(routes = {}) {
  const seen = [], inits = [];
  const fetch = async (u, init) => {
    const url = String(u && u.url ? u.url : u);
    seen.push(url);
    inits.push(init ?? null);
    const r = routes[url];
    if (r instanceof Error) throw r;
    if (!r) return new Response("not found", { status: 404 });
    return typeof r === "function" ? r(url) : r;
  };
  return { seen, inits, routes, fetch };
}
/** A response serving `body` with `type`. */
export const serve = (body, type = "text/plain", status = 200) => () =>
  new Response(typeof body === "string" ? body : new Uint8Array(body), { status, headers: { "content-type": type } });

/** An information bundle asking to be monitored. `lines` are extra front-matter lines. */
export function infoMd(id, locator, { freq = null, enabled = true, lines = [] } = {}) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@2",
    `title: "Monitored ${id}"`, "current_state: collected", "prior_state: null",
    `created: ${NOW}`, `last_updated: ${NOW}`,
    "produced_by:", "  mode: assisted", "  capability_tier: session",
    "group: test-group", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null",
    "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged",
    "source:", `  locator: ${locator}`, "  authority: Town Clerk", `  retrieved: ${NOW}`,
    "monitoring:", `  enabled: ${enabled}`, ...(freq ? [`  frequency: ${freq}`] : []), "  last_checked: null",
    ...lines, "---", "",
    "## Summary", "", "A monitored document.", "", "## Provenance Notes", "",
    "## Session Log", "", "### Session 1", "", "Captured.", "", "## Review Notes", "",
  ].join("\n");
}

/* The plane's statements for the tables of modules this one does not use that their promotion steps read once a wake
   has built them on the host (K1164): connections' `refs`; inquiry's `inquiry_bundle_facts`, `inquiry_basis`,
   `inquiry_exclusions` and `inquiry_contradiction_links`; content's `content`. Copied from their schemas, comments left
   out; `seam.test.mjs`'s N506-tail test fails by name if one goes missing. */
export const PLANE_TABLES = Object.freeze([
  `CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '',
     PRIMARY KEY (bundle_id, target_id, kind))`,
  `CREATE INDEX IF NOT EXISTS refs_target ON refs(target_id)`,
  `CREATE TABLE IF NOT EXISTS inquiry_bundle_facts (bundle_id TEXT PRIMARY KEY, inquiry_basis_count INTEGER,
     inquiry_superseded_by TEXT, inquiry_subject_entity TEXT)`,
  `CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, target_id TEXT NOT NULL,
     target_type TEXT NOT NULL, role TEXT NOT NULL, grade TEXT, grade_axis TEXT, grade_source TEXT, note TEXT, at TEXT,
     ground TEXT, content_id TEXT, PRIMARY KEY (bundle_id, ord))`,
  `CREATE TABLE IF NOT EXISTS inquiry_exclusions (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, edition INTEGER,
     target_id TEXT, description TEXT NOT NULL, reason TEXT NOT NULL, author TEXT NOT NULL, at TEXT NOT NULL,
     PRIMARY KEY (bundle_id, ord))`,
  `CREATE TABLE IF NOT EXISTS inquiry_contradiction_links (bundle_id TEXT PRIMARY KEY, candidate TEXT, resolution TEXT,
     explores TEXT, at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content (content_id TEXT PRIMARY KEY, capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL,
     extent_kind TEXT NOT NULL, extent TEXT NOT NULL, ref TEXT NOT NULL, chain TEXT, derivation_cap TEXT,
     page_count INTEGER, minted_by TEXT NOT NULL, at TEXT NOT NULL, stale INTEGER NOT NULL DEFAULT 0,
     cited_as TEXT NOT NULL DEFAULT 'text', chain_kind TEXT)`,
]);

export function world({ profiles = ["test-port-ellery"], env = null, evidence = true, refuse = [], intent = undefined,
                        actionClocks = undefined, escalation = undefined, publication = undefined, extraColumns = [], realActions = false,
                        planeTables = true, caseImport = undefined } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* retrieval's projection table (R61), as its `migrate()` creates it; after it none of those columns is on `bundles`. */
  for (const s of PROJECTION_SCHEMA) st.db.exec(s);
  if (planeTables) for (const s of PLANE_TABLES) st.db.exec(s);
  for (const c of extraColumns) st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { ms: NOW_MS };
  const bkt = evidence ? bucket() : null;
  const record = recordOf(host, { evidence: bkt, evidencePrefix: "bio/captures/" });
  record.migrate();
  if (profiles) record.setSetting("jurisdiction_profiles", profiles, V("admin"));
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* credentials after membership, as the composition root migrates them (K789): its tables, its listener and its claim
     fact registered with membership (its R16, R17, R20), so the founder claims through it (R30's roster) */
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  const prov = provenanceOf(host, { record, membership, promotion, now: () => new Date(clock.ms).toISOString() });
  prov.migrate();
  const obs = observationLogOf(host, { record, membership, provenance: prov, extraction: null });
  obs.migrate();
  const gov = governor({ refuse });
  const capEnv = { ...(env || {}) };
  const capture = new Capture(st, { record, env: capEnv, governor: gov, provenance: prov });
  capture.migrate();
  /* retrieval's projection of the monitoring columns, from the promoted document. */
  promotion.registerStep("retrieval", { project: (c) => {
    const md = (c.files || []).find((f) => f.path === "bundle.md");
    let fm = null;
    try { fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null; } catch { fm = null; }
    const mon = fm && fm.monitoring && typeof fm.monitoring === "object" ? fm.monitoring : {};
    st.sql.exec(`INSERT INTO ${PROJECTION_TABLE} (bundle_id, monitor_enabled, monitor_frequency, monitor_last_checked, source_locator)
                 VALUES (?, ?, ?, ?, ?) ON CONFLICT(bundle_id) DO UPDATE SET monitor_enabled=excluded.monitor_enabled,
                 monitor_frequency=excluded.monitor_frequency, monitor_last_checked=excluded.monitor_last_checked,
                 source_locator=excluded.source_locator`,
      c.bundleId, mon.enabled === true ? 1 : 0, typeof mon.frequency === "string" ? mon.frequency : null,
      typeof mon.last_checked === "string" ? mon.last_checked : null,
      fm && fm.source && typeof fm.source.locator === "string" ? fm.source.locator : null);
    /* and, with the real actions module, its clock column from its R12 facts (retrieval R53), on the projection row */
    if (realActions) st.sql.exec(`UPDATE ${PROJECTION_TABLE} SET action_clock_next=? WHERE bundle_id=?`,
      actionFacts(md && md.text, clock.ms).clock_next, c.bundleId);
    return null;
  } });
  /* the real actions module (its clock rule, the R33 bound) and action-clocks (`pendingClocks`, its R1); conformance, which
     they reach on the same host as production does, is the real module with no determination held */
  const act = realActions ? actionsOf(host, { record, membership, promotion, retrieval: null, env: {}, now: () => clock.ms }) : undefined;
  const clocks = realActions ? actionClocksOf(host, { record, membership, actions: act, env: {}, now: () => clock.ms })
    : undefined;
  const net = network();
  /* an absent intent or publication is null: undefined would have monitoring build the real module on this host */
  const m = monitoringOf(host, { record, membership, promotion, provenance: prov, observationLog: obs, capture,
    governor: gov, env: env || {}, now: () => clock.ms, fetch: net.fetch, intent: intent ?? null, publication: publication ?? null,
    ...(actionClocks !== undefined ? { actionClocks } : clocks ? { actionClocks: clocks } : {}), ...(escalation !== undefined ? { escalation } : {}),
    ...(caseImport !== undefined ? { caseImport } : {}) });
  let n = 0;
  const w = {
    st, host, record, membership, credentials, promotion, prov, obs, capture, gov, net, bkt, m, clock, intent, act, clocks,
    publication,
    rows: (q, ...x) => [...st.sql.exec(q, ...x)],
    row: (q, ...x) => [...st.sql.exec(q, ...x)][0] ?? null,
    text: (id) => { const f = record.readFile(id, "bundle.md"); return f ? (typeof f === "string" ? f : f.text ?? null) : null; },
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    manifest: (id) => [...st.sql.exec(`SELECT snap_key, writer, operation, author, base FROM manifest WHERE bundle_id=? ORDER BY rowid`, id)],
    looks: () => [...st.sql.exec(`SELECT * FROM observation_log ORDER BY seq`)],
    /** Hold `bytes` in the evidence bucket under their digest. */
    hold(bytes) { const s = sha(bytes); bkt.held.set(`bio/captures/${s}`, new Uint8Array(Buffer.from(bytes))); return s; },
    /** Promote `id` with `text` as its bundle.md and `reg` as its provenance register (documents[]), by a member. */
    promote(id, text, { reg = null, files = [], register = [], author = V("alice") } = {}) {
      const all = [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }];
      if (reg) { const p = JSON.stringify({ documents: reg }); all.push({ path: "data/provenance.json", text: p, bytes: Buffer.byteLength(p), sha256: sha(p) }); }
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `20260920T000000Z_fx${String(++n).padStart(4, "0")}`,
        author, meta: { object_type: "information", group: "test-group", title: `Monitored ${id}`, current_state: "collected",
                        created: NOW, last_updated: NOW },
        files: [...all, ...files], register });
    },
    /** The participants of the project `project`: `owner` its owner and `joined` participants who own nothing, as
     *  membership's sight (its R43) and owner predicate (its R54) read them. A document is in the project when its
     *  front matter says `project: <id>` (pass `lines`), which promotion projects onto its row. */
    inProject(project, { owner = "carol", joined = [] } = {}) {
      const part = (m, own) => st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
        VALUES (?, ?, 'joined', ?, ?, ?) ON CONFLICT(project_id, member_id) DO UPDATE SET owner=excluded.owner`, project, m, own, NOW, NOW);
      if (owner) part(owner, 1);
      for (const m of joined) part(m, 0);
    },
    /** A monitored document with a captured baseline: `baseline` bytes held, registered and named in the register. */
    monitored(id, locator, baselineBytes, { freq = null, row = {}, lines = [], enabled = true } = {}) {
      const md = infoMd(id, locator, { freq, lines, enabled });
      if (baselineBytes == null) { const r = w.promote(id, md); if (!r.ok) throw new Error(`fixture: ${id} not promoted: ${JSON.stringify(r)}`); return { md, r }; }
      const cap = w.hold(baselineBytes);
      const file = `snapshots/base-${cap.slice(0, 8)}`;
      const doc = { file, locator, retrieved: NOW, authority: "Town Clerk", origin: { kind: "named_request" }, attestation_attempts: [],
                    capture: { sha256: cap, method: "direct", grade: "B", actor_class: "daemon", encoding: "binary",
                               bytes: Buffer.byteLength(baselineBytes), content_type: "text/plain", ...(row.capture || {}) } };
      for (const [k, v] of Object.entries(row)) if (k !== "capture") doc[k] = v;
      const r = w.promote(id, md, { reg: [doc], files: [{ path: file, blobSha: cap, sha256: cap, bytes: Buffer.byteLength(baselineBytes) }],
        register: [{ sha256: cap, path: file, encoding: "binary", bytes: Buffer.byteLength(baselineBytes) }] });
      if (!r.ok) throw new Error(`fixture: ${id} not promoted: ${JSON.stringify(r).slice(0, 600)}`);
      return { md, cap, file, r };
    },
  };
  return w;
}

/** docprofile holds no content type of its own since T34-8 (its R36): the plane registers `doctypes`' types at
 *  composition, and `doctypes` is not a module this one uses. A test that needs a document read under the `membership`
 *  contract (R14's daily default) registers this stand-in through docprofile's seam: a meeting calendar, recognised
 *  (CERTAIN) by an ASP.NET calendar page's markers, `__VIEWSTATE` and `MeetingDetail.aspx`. Registration is for the
 *  test file's process; a document it does not recognise stays docprofile's no-type answer (contract `substance`). */
// fixtures-own: synthetic a content type of the test's own, registered through docprofile's seam (registerDoctype); no module's answer
export function registerCalendarStub() {
  return registerDoctype({
    key: "stub_meeting_calendar", label: "stub meeting calendar", version: 1, contract: CONTRACT.MEMBERSHIP,
    detect: (ctx) => (/__VIEWSTATE/.test(String(ctx.text || "")) && /MeetingDetail\.aspx/.test(String(ctx.text || ""))
      ? { match: true, confidence: CONFIDENCE.CERTAIN, signals: ["__VIEWSTATE", "MeetingDetail.aspx"] } : { match: false }),
    parse: () => ({ entities: [], facts: {} }),
    assess: () => ({ meaningful: null, events: [], confirmed: null, why: "the stand-in reads no meaning" }),
  });
}

/** A sweep definition in link-sweep R1's shape, with `over` replacing any field: kept here for the readers of this
 *  world that still build one (scheduler's `consumers.test.mjs`) until their own jobs re-point to link-sweep's (N506). */
export function sweepDef(over = {}) {
  return { id: "minutes", title: "Council minutes", ratified: true, sources: ["https://records.example.org/council"],
           seeds: ["https://records.example.org/council/index.html"], match: { terms: ["minutes"] }, cadence: "weekly",
           budget: { per_run: 10, backlog: 20 }, ...over };
}

/** A sweep share as R66 takes it (link-sweep's shape, stood in; K1206): `grammar` answers `{check, severity, field,
 *  message}` findings, the message beginning with its field, for a sweep with no `id`, a duplicate id, a key that is no
 *  sweep's field (`field` null) and a `terms` entry "/(?=x)/" (with `code` and the row as `refusal`, `TERM_ROW`); `fence`
 *  refuses a sweep whose `title` is "fenced"; `dueForSlate` lists `due` through `sees`. Every call is recorded in `calls`. */
export const TERM_ROW = Object.freeze({ code: "SWEEP_TERM_REFUSED", check: "C-18.16",
  translation: "This was not saved: a search term of a sweep is a pattern the record cannot match safely. Nothing was changed." });
export function sweepShare() {
  const calls = [];
  const sweepsOf = (t) => { try { const g = JSON.parse(t); return Array.isArray(g.sweeps) ? g.sweeps : []; } catch { return []; } };
  return {
    calls,
    grammar(entry, ids) {
      calls.push(["grammar", entry.id ?? null]);
      const out = [];
      const bad = (field, message, extra) => out.push({ check: "C-18.5", severity: "error", field, message, ...extra });
      for (const k of Object.keys(entry)) if (!["id", "title", "terms"].includes(k)) bad(null, `carries '${k}', which is not a sweep's field (id, title, terms)`);
      if (typeof entry.id !== "string") bad("id", "id is missing");
      else if (ids.has(entry.id)) bad("id", `id ${localize("link-sweep.checks.id_is_not_unique_within", "'{id}' is not unique within the file", { id: String(entry.id) })}`);
      else ids.add(entry.id);
      for (const [j, t] of (Array.isArray(entry.terms) ? entry.terms : []).entries())
        if (t === "/(?=x)/") bad(`terms[${j}]`, `terms[${j}] SWEEP_TERM_REFUSED: a lookahead`, { code: "SWEEP_TERM_REFUSED", refusal: this.row });
      return out;
    },
    // fixtures-contract: link-sweep sweep-fence
    fence(c, nextText) {
      calls.push(["fence", c.bundleId]);
      return sweepsOf(nextText).some((x) => x && x.title === "fenced")
        ? { ok: false, reason: "SWEEP_NOT_A_MEMBER", code: "SWEEP_NOT_A_MEMBER", detail: "fenced by the stand-in" } : null;
    },
    dueForSlate(now, sees) { calls.push(["dueForSlate", now]); return this.due.filter((x) => sees(x.bundle)); },
    due: [], row: TERM_ROW,
  };
}

