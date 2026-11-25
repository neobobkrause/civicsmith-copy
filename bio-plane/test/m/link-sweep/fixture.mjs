/* link-sweep over the modules it uses, each the real one where it writes or reads the record (record-core, membership,
   promotion, capture, observation-log, and provenance's tables through capture's own instance), on a real SQLite
   database (node:sqlite) standing in for a Durable Object's storage, under the real `monitoring` (its R65 `sweepHost`, R66
   `registerSweep`). What stands in, and why: monitoring's own later readers it is handed (intent, publication) are
   absent, since no sweep reads them; project-stage's R1 (`stages` maps a
   project to its stage, for R4's closed test); the host governor, which records every call; the evidence bucket, an
   in-memory R2 stand-in. A test scripts capture's `acquire` on the instance where it says so. Every test drives
   `link-sweep` at its interface. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { acquireRefusals } from "../acquisition/fixtures.mjs";
import { captureRequestsOf } from "../../../src/capture-requests/index.mjs";
import { linkSweepOf, DECLARED_OPS } from "../../../src/link-sweep/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { monitoringOf, MONITOR_PAUSE_SETTING as PAUSE_SETTING } from "../../../src/monitoring/index.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
/** A Durable Object's storage over an in-memory SQLite database (the plane's cursor shape, K316, K313). */
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
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
export const DAY = 86400000, WEEK = 7 * DAY;

/** An evidence bucket (the R2 binding's shape). */
export function bucket() {
  const held = new Map();
  const obj = (k) => { const b = held.get(k); return { key: k, size: b.length,
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  return {
    held,
    async head(k) { return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async get(k) { return held.has(k) ? obj(k) : null; },
    async put(k, bytes) { held.set(k, new Uint8Array(bytes)); return { key: k }; },
  };
}

/** host-governor as capture reaches it, every call recorded. */
export function governor() {
  const calls = [];
  return { calls, governorAdmit({ host }) { calls.push(["admit", host]); return { admitted: true, wait_ms: 0 }; },
           governorReport(r) { calls.push(["report", r.host, r.status]); return { recorded: true }; } };
}

/** The real capture-requests (its R45 slot answers `registerSweepScope(module, fn)`: one registration whoever makes it),
 *  wrapped only to record what it accepted, so a test reaches the registered check. */
export function recordingCaptureRequests(real) {
  const registered = [];
  return { registered, registerSweepScope(module, fn) {
    const r = real.registerSweepScope(module, fn);
    if (r && r.ok) registered.push({ module, fn });
    return r; } };
}

/** An information bundle; `lines` are extra front-matter lines. */
export function infoMd(id, locator, { lines = [] } = {}) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@2",
    `title: "List ${id}"`, "current_state: collected", "prior_state: null",
    `created: ${NOW}`, `last_updated: ${NOW}`,
    "produced_by:", "  mode: assisted", "  capability_tier: session",
    "group: test-group", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null",
    "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged",
    "source:", `  locator: ${locator}`, "  authority: Town Clerk", `  retrieved: ${NOW}`,
    "monitoring:", "  enabled: false", ...lines, "---", "",
    "## Summary", "", "A list.", "", "## Provenance Notes", "",
    "## Session Log", "", "### Session 1", "", "Captured.", "", "## Review Notes", "",
  ].join("\n");
}

/** A sweep as R1 states it, with `over` replacing any field. */
export function sweepDef(over = {}) {
  return { id: "minutes", title: "Council minutes", ratified: true, sources: ["https://records.example.org/council"],
           seeds: ["https://records.example.org/council/index.html"], match: { terms: ["minutes"] }, cadence: "weekly",
           budget: { per_run: 10, backlog: 20 }, ...over };
}

export function world({ evidence = true, captureRequests = undefined } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { ms: NOW_MS };
  const bkt = evidence ? bucket() : null;
  const record = recordOf(host, { evidence: bkt, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  const gov = governor();
  const capture = captureOf(host, { record, env: {}, governor: gov });
  capture.migrate();
  /* provenance's tables (register, captured_locators), through the instance capture reaches */
  capture.provenance.migrate();
  const obs = observationLogOf(host, { record, membership, provenance: capture.provenance, extraction: null });
  obs.migrate();
  const stages = {};
  const projectStage = { calls: [], projectStage(a) { this.calls.push(a); return { project: a.project, stage: stages[a.project] ?? "forming" }; } };
  let cr = captureRequests;
  if (cr === undefined) {
    const real = captureRequestsOf(host, { record, capture, governor: gov, promotion, observations: obs });
    real.migrate();
    cr = recordingCaptureRequests(real);
  }
  const mon = monitoringOf(host, { record, membership, promotion, capture, observationLog: obs, governor: gov, env: {},
    now: () => clock.ms, intent: null, publication: null, projectStage });
  const s = linkSweepOf(host, { record, membership, promotion, capture, observationLog: obs, projectStage, monitoring: mon,
    ...(cr ? { captureRequests: cr } : {}), now: () => clock.ms });
  let n = 0;
  const w = {
    st, host, record, membership, promotion, capture, obs, gov, bkt, s, mon, clock, stages, projectStage, captureRequests: cr,
    rows: (q, ...x) => [...st.sql.exec(q, ...x)],
    text: (id) => { const f = record.readFile(id, "bundle.md"); return f && "text" in f ? f.text : null; },
    fm: (id) => { const t = w.text(id); return t ? parseFrontmatter(t).data : null; },
    manifest: (id) => [...st.sql.exec(`SELECT snap_key, writer, operation, author, base FROM manifest WHERE bundle_id=? ORDER BY rowid`, id)],
    looks: () => [...st.sql.exec(`SELECT * FROM observation_log ORDER BY seq`)],
    /** Monitoring R30's pause, as its setting holds it. */
    pause(on) { record.setSetting(PAUSE_SETTING, on ? { paused: true, by: "class:admin", at: "2026-09-28T00:00:00Z" } : { paused: false }, "class:admin"); },
    /** Hold `bytes` in the evidence bucket under their digest. */
    hold(bytes) { const h = sha(bytes); bkt.held.set(`bio/captures/${h}`, new Uint8Array(Buffer.from(bytes))); return h; },
    /** Promote `id` with `text` as its bundle.md, `reg` its register (documents[]), by a member. */
    promote(id, text, { reg = null, files = [], register = [], author = "member:alice" } = {}) {
      const all = [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }];
      if (reg) { const p = JSON.stringify({ documents: reg }); all.push({ path: "data/provenance.json", text: p, bytes: Buffer.byteLength(p), sha256: sha(p) }); }
      const head = record.head(id);
      return promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `20260920T000000Z_fx${String(++n).padStart(4, "0")}`,
        author, meta: { object_type: "information", group: "test-group", title: `List ${id}`, current_state: "collected",
                        created: NOW, last_updated: NOW },
        files: [...all, ...files], register });
    },
    /** A bundle holding a capture of `bytes` taken at `locator`: registered, and a receipt at the address. */
    held(id, locator, bytes, { row = {} } = {}) {
      const cap = w.hold(bytes);
      const file = `snapshots/base-${cap.slice(0, 8)}`;
      const doc = { file, locator, retrieved: NOW, authority: "Town Clerk", origin: { kind: "named_request" }, attestation_attempts: [],
                    capture: { sha256: cap, method: "direct", grade: "B", actor_class: "daemon", encoding: "binary",
                               bytes: Buffer.byteLength(bytes), content_type: "text/plain" }, ...row };
      const r = w.promote(id, infoMd(id, locator), { reg: [doc], files: [{ path: file, blobSha: cap, sha256: cap, bytes: Buffer.byteLength(bytes) }],
        register: [{ sha256: cap, path: file, encoding: "binary", bytes: Buffer.byteLength(bytes) }] });
      if (!r.ok) throw new Error(`fixture: ${id} not promoted: ${JSON.stringify(r).slice(0, 600)}`);
      return { cap, file, r };
    },
    /** The participants of `project`: `owner` its owner, `joined` participants who own nothing (membership's table). */
    inProject(project, { owner = "carol", joined = [] } = {}) {
      const part = (m, own) => st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
        VALUES (?, ?, 'joined', ?, ?, ?) ON CONFLICT(project_id, member_id) DO UPDATE SET owner=excluded.owner`, project, m, own, NOW, NOW);
      if (owner) part(owner, 1);
      for (const m of joined) part(m, 0);
    },
  };
  return w;
}

/** The list bundle `list` in `project` (alice owns it, bob a joined member), carrying `sweeps` and `daemon`, written by
 *  `author`; the seeds' snapshots a run filed are carried forward. */
export function listWorld({ list = "INFO-2026-0950-list", project = "PROJ-2026-0950-sweep", sweeps = undefined, daemon = undefined,
                            opts = {} } = {}) {
  const w = world(opts);
  w.inProject(project || "PROJ-2026-0950-none", { owner: "alice", joined: ["bob"] });
  const write = (sw, { d = daemon, author = "member:alice", extra = {} } = {}) => {
    const t = JSON.stringify({ ...(d ? { daemon: d } : {}), sweeps: sw, ...extra });
    const img = w.record.readImage(list) || {};
    const kept = Object.entries(img).filter(([p, v]) => p.startsWith("snapshots/") && typeof v === "object")
      .map(([path, v]) => ({ path, blobSha: v.blobSha, sha256: v.sha256, bytes: v.bytes }));
    return w.promote(list, infoMd(list, "https://records.example.org/list", { lines: project ? [`project: ${project}`] : [] }),
      { files: [{ path: "data/gathering.json", text: t, bytes: Buffer.byteLength(t), sha256: sha(t) }, ...kept], author });
  };
  if (sweeps) { const r = write(sweeps); if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 400)); }
  return { w, write, list, project, name: (id = "minutes") => `${list}#${id}` };
}

/* capture's acquire as a scripted site: `map` maps a locator to {body, type} (a capture), {redirect} (refused out of
   scope), {fail} (refused with that status), {governed}, or {existed: true}. Every call recorded. */
export function site(w, map) {
  const calls = [];
  w.capture.acquire = async (body, opts) => {
    const cr = opts.captureRequest;
    calls.push({ locator: cr.locator, opts });
    const s = map[cr.locator];
    if (!s || s.fail) return acquireRefusals({ kind: "source_refused" });
    if (s.redirect) return { status: 422, body: { ok: false, reason: "SWEEP_REDIRECT_OUT_OF_SCOPE", code: "SWEEP_REDIRECT_OUT_OF_SCOPE", target: s.redirect } };
    if (s.governed) return { status: 429, body: { ok: false, reason: "HOST_COOLING_OFF" } };
    const bytes = Buffer.from(s.body);
    const h = sha(bytes);
    if (cr.heldSha === h) return { status: 200, body: { ok: true, existed: true, unchanged: true, capture: { sha256: h } } };
    w.bkt.held.set(`bio/captures/${h}`, new Uint8Array(bytes));
    return { status: 200, body: { ok: true, existed: s.existed === true, document: {
      file: `snapshots/c-${h.slice(0, 8)}`, locator: cr.locator, retrieved: new Date(w.clock.ms).toISOString().replace(/\.\d+Z$/, "Z"),
      authority: "the sweep", origin: cr.origin, attestation_attempts: [],
      capture: { sha256: h, method: "direct", grade: "B", actor_class: "daemon", encoding: "binary", bytes: bytes.length,
                 content_type: s.type || "text/html" } } } };
  };
  return calls;
}

export const SEED = "https://records.example.org/council/index.html";
/** The query the door hands an op: the caller's own params, then each stamp the op's row declares (`viewer` when it declares
 *  none, op-declarations' default), set to the caller's id. The arm reads a member only from these, never from a copy the
 *  caller wrote, so a test builds its stamps here and not by hand. */
export const doorQuery = (op, who) => new URLSearchParams({ op, ...Object.fromEntries((DECLARED_OPS[op].stamps ?? ["viewer"]).map((s) => [s, who])) });
export const U = (p) => `https://records.example.org/council/${p}`;
export const page = (links) => `<html><body>${links.map(([href, text]) => `<a href="${href}">${text}</a>`).join("\n")}</body></html>`;
export const runsOf = (w) => w.rows(`SELECT * FROM sweep_runs ORDER BY sweep, seq`).map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
export const filedBundles = (w) => w.rows(`SELECT b.bundle_id, b.current_state, b.project FROM bundles b WHERE b.bundle_id LIKE 'INFO-%-gathered' ORDER BY b.bundle_id`);
