/* capture-requests over the modules it uses, the record's own ones real (record-core, membership, promotion,
   observation-log, host-governor, capture-sources' credentials) on a real SQLite database (node:sqlite)
   standing in for a Durable Object's storage at its shape (a cursor, workerd's pattern cap; below). `capture`'s in-process arm is a stand-in the test scripts (K61: a test may pass its
   own instance), recording exactly what it was handed; ai-runs' run sight (`runFor`) is a table of runs the test
   writes; inquiry's `memberUserAgent` (its R44) answers the agents the test records, noting each id asked (a
   plane-created inquiry's stamp is driven in plane.test.mjs). Every test drives `capture-requests` at its interface. */
import { captureArm, acquireRefusal } from "../capture/fixtures.mjs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { observationLogOf } from "../../../src/observation-log/index.mjs";
import { governorOf } from "../../../src/host-governor/index.mjs";
import { credentialsOf } from "../../../src/capture-sources/credentials.mjs";
import { captureRequestsOf } from "../../../src/capture-requests/index.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { normalizeAddress, fragmentOf } from "../../../src/subresources.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
export const V = (id) => `member:${id}`;
export const MACHINE = "class:member";
export const T0 = Date.parse("2026-09-28T01:00:00Z");
export const KEY = "k".repeat(43);
export const ENV = { DAEMON_TOKEN: "daemon-token-for-tests", VERSION: "9.9.9", INSTANCE_NAME: "testbed",
                     CAPTURE_CREDENTIALS_KEY: KEY };

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` or `.length` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB
   pattern too complex"), which node:sqlite does not (K313). This storage answers as workerd does, so code that indexes
   a cursor or writes a long pattern fails here as it would in the Durable Object (K316). */
export const WORKERD_PATTERN_CAP = 50;
export function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() {
      const rest = c.toArray();
      if (rest.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rest.length}`);
      return rest[0];
    },
  };
  return c;
}

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
      if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
        throw new Error("LIKE or GLOB pattern too complex");
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

/** `capture`'s in-process arm over capture's published fixture (`captureArm`: the real capture, a scripted network, each call recorded): the answer is the
 *  next scripted one for the address, else the real capture's own filing of the address's bytes. */
export function captureStage() {
  const arm = captureArm(), calls = arm.calls, script = new Map();
  let throwing = false;
  return {
    calls, script, readers: arm.readers,
    /* capture R83's slot: capture's own registration, each recorded with the module's own `fn` to be driven. */
    registerReader: arm.registerReader,
    throwNext() { throwing = true; },
    async acquire(body, opts) {
      if (throwing) { throwing = false; calls.push({ body, opts }); throw new Error("boom https://x.example/?token=SECRET"); }
      const loc = opts && opts.captureRequest ? opts.captureRequest.locator : body.locator;
      const q = script.get(loc);
      const next = Array.isArray(q) ? q.shift() : q;
      if (next) { calls.push({ body, opts }); return typeof next === "function" ? next(body, opts) : next; }
      arm.routes[loc] = () => new Response(`bytes of ${loc}`, { headers: { "content-type": "application/pdf" } });
      return arm.acquire(body, opts);
    },
  };
}

/** A filed capture as `capture`'s arm answers one (its R60: the origin is the drain's, `sweep`, when it names one):
 *  the register document with its primary file, digest and size. `bytes` are the served bytes (the address's text by
 *  default). */
export function filed(loc, opts, { bytes = `bytes of ${loc}`, existed = false, extra = {} } = {}) {
  const s = sha(bytes), n = Buffer.byteLength(bytes);
  const o = opts && opts.captureRequest && opts.captureRequest.origin;
  return { status: 200, body: { ok: true, existed, document: {
    file: `snapshots/${s.slice(0, 16)}.bin`, locator: loc, retrieved: "2026-09-28T01:00:00Z",
    authority_state: "undetermined", authority_basis: "fixture: authority not asserted",
    provenance_chain: [{ who: "instance testbed (Civicsmith/9.9.9)", asserts: `fixture bytes at ${loc}`,
                         evidence: "fixture fetch, digested on arrival", bound: false, via: null }],
    capture: { method: "fixture acquire, digested on arrival", grade: "B", actor_class: "daemon",
               sha256: s, encoding: "binary", bytes: n, content_type: "application/pdf" },
    origin: o && o.matched_sweep ? { kind: "sweep", matched_sweep: o.matched_sweep, deeming_actor: o.deeming_actor ?? null }
                                 : { kind: "named_request" },
    attestation_attempts: [], ...extra } } };
}

export const refused = (status) => ({ status: 502, body: { ok: false, reason: "SOURCE_REFUSED", status } });
/* A render capture refuses with, by code, each the real answer of `capture.acquire({locator, render: true})`: capture's published `acquireRefusal` for the three
   it gives (RENDER_DEFERRED, RENDER_NO_RENDERER, RENDER_HOST_COOLING_OFF), and for the others the same published arm (`captureArm`) driven to the refusal:
   RENDER_NOT_A_PAGE (the address serves a PDF), RENDER_FAILED (the renderer answers 500), RENDER_AT_CAPACITY (the allowance admits none, waiting). */
const PROVIDED = ["RENDER_DEFERRED", "RENDER_NO_RENDERER", "RENDER_HOST_COOLING_OFF"];
export async function renderRefusal(code) {
  if (PROVIDED.includes(code)) return acquireRefusal({ code });
  const locator = "https://r.example/page", page = () => new Response("<html><body>hi</body></html>", { headers: { "content-type": "text/html" } });
  const served = code === "RENDER_NOT_A_PAGE" ? () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }) : page;
  const renderer = { fetch: async () => (code === "RENDER_FAILED" ? new Response("boom", { status: 500 }) : new Response("{}")) };
  const arm = captureArm({ routes: { [locator]: served }, env: { RENDERER: renderer } });
  if (code === "RENDER_AT_CAPACITY") arm.capture.renderAdmit = () => ({ state: "waiting", running: 2, cap: 2 });
  else if (code !== "RENDER_NOT_A_PAGE" && code !== "RENDER_FAILED") throw new Error(`renderRefusal: no render refusal ${code}`);
  return arm.acquire({ locator, render: true }, {});
}

/** A world: the record's modules, the capture stand-in, a table of runs, and capture-requests over them. `group` is
 *  the instance's recorded producing group (promotion R13; null: none recorded). `steps` (R55) is the real `steps` on
 *  this storage, over the same record, membership, promotion and log, unless a test passes its own (K61). */
export function world({ env = ENV, configured, credentials = true, group = "test-group", order, standards, steps } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* R49 (T35): the read contracts R49 judges an address against, at their stated columns: provenance's
     `captured_locators` and `register` (its R48) and capture's `links` (its R27, R57). The record's own modules write
     them in the product; here `hold` writes them, as a capture of a held document would. */
  st.db.exec(`CREATE TABLE captured_locators (address_norm TEXT NOT NULL, address TEXT NOT NULL, capture_sha TEXT NOT NULL,
                via TEXT NOT NULL DEFAULT 'direct', retrieval_locator TEXT, first_retrieved TEXT NOT NULL,
                last_retrieved TEXT NOT NULL, observations INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (address_norm, capture_sha, via))`);
  st.db.exec(`CREATE TABLE register (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, path TEXT NOT NULL,
                encoding TEXT NOT NULL, bytes INTEGER NOT NULL, registered TEXT NOT NULL)`);
  st.db.exec(`CREATE TABLE links (source_bundle TEXT, source_capture TEXT NOT NULL, link_ref TEXT NOT NULL,
                address TEXT NOT NULL, address_norm TEXT NOT NULL, citation_norm TEXT NOT NULL, fragment TEXT,
                partition TEXT NOT NULL, origin TEXT, captured_at TEXT NOT NULL, first_seen TEXT NOT NULL)`);
  const clock = { ms: T0 };
  const now = () => clock.ms;
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
  /* N497 (N469's rule): each fact under the module that provides it in the product (instance-setup, connections,
     publication), never the retired `legacy-store`. */
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const ex = { onReading: () => ({ ok: true }), readingOf: () => null, unitsOf: () => ({ units: [], state: null }),
               capturesReadFor: () => [] };
  const obs = observationLogOf(host, { record, membership, provenance: null, extraction: ex, now });
  obs.migrate();
  const governor = governorOf(host, { env, now, record });
  governor.migrate();
  const creds = credentials ? credentialsOf(host, { key: env.CAPTURE_CREDENTIALS_KEY ?? null, record, membership,
                                                     now: () => clock.ms }) : null;
  if (creds && typeof creds.migrate === "function") creds.migrate();
  const capture = captureStage();
  const runs = new Map();
  const runSight = { runFor: (run, viewer) => {
    const r = runs.get(run);
    if (!r || typeof viewer !== "string" || !/^(member:.+|class:\w+)$/.test(viewer)) return null;
    if (r.hiddenFrom && r.hiddenFrom.includes(viewer)) return null;
    return { run: r.run, status: r.status, principal_plane: r.principal_plane, principal_claude: r.principal_claude,
             context_type: "inquiry", context_id: r.context };
  } };
  /* inquiry R44 as a stand-in: the agent it recorded for an inquiry, or null, and every id the drain asked it about. */
  const agents = new Map(), asked = [];
  const inquiry = { memberUserAgent: (id) => { asked.push(id); return agents.has(id) ? agents.get(id) : null; } };
  const waitRegs = [];
  const aiRuns = { registerWaitSource: (module, source) => { waitRegs.push({ module, source }); return { ok: true }; } };
  const stepsOf_ = steps !== undefined ? steps : stepsOf(host, { record, membership, promotion, observationLog: obs });
  const cr = captureRequestsOf(host, { record, observations: obs, governor, capture, credentials: creds, runs: runSight,
                                       env, now, storeName: "bio", aiRuns, promotion, inquiry,
                                       ...(configured !== undefined ? { configured } : {}),
                                       ...(order !== undefined ? { order } : {}),
                                       ...(standards !== undefined ? { standards } : {}),
                                       steps: stepsOf_ });
  cr.migrate();
  const w = {
    st, host, record, membership, promotion, obs, governor, creds, capture, runs, cr, clock, waitRegs, agents, asked,
    steps: stepsOf_,
    row: (q, ...a) => st.sql.exec(q, ...a).toArray()[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a).toArray(),
    req: (id) => st.sql.exec(`SELECT * FROM capture_requests WHERE request=?`, id).toArray()[0] ?? null,
    log: () => st.sql.exec(`SELECT * FROM observation_log ORDER BY seq`).toArray(),
    /** A bundle in record-core's `bundles` read contract. */
    bundle(id, type = "inquiry", { md = null } = {}) {
      st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                   VALUES (?, ?, 'g', ?, 'open', 't', 't', 'sha')`, id, type, id);
      if (md !== null)
        st.sql.exec(`INSERT INTO files (bundle_id, path, content, sha256, bytes) VALUES (?, 'bundle.md', ?, ?, ?)`,
                    id, md, sha(md), Buffer.byteLength(md));
      membership.reindexProjectSight(id);
      return id;
    },
    project(id) { return w.bundle(id, "project"); },
    participant(projectId, memberId, state = "joined") {
      st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, 0, 't', 't')`, projectId, memberId, state);
      membership.reindexProjectSight(projectId);
    },
    /** A run in ai-runs' sight, with its principals. */
    run(id, { status = "running", plane = "member:ann/tok1", claude = "instance", context = "INQ-1", hiddenFrom = [] } = {}) {
      runs.set(id, { run: id, status, principal_plane: plane, principal_claude: claude, context, hiddenFrom });
      return id;
    },
    /** A standard scene: inquiry INQ-1 and INQ-2, run R-1 held by member ann. */
    scene() {
      w.bundle("INQ-1"); w.bundle("INQ-2"); w.bundle("DOC-1", "information");
      w.run("R-1");
      return w;
    },
    /** R49: the record holds `address`: as an acquisition receipt's address (default), a receipt's retrieval locator
     *  (`as: "retrieval"`, for the receipt of `of`), or a held capture's outbound link (`as: "link"`, its fragment cut
     *  off the address as capture files it). `bundle` files the capture in that bundle (register); none leaves it
     *  filed in no bundle. Answers the capture's digest. */
    hold(address, { as = "receipt", of = "https://held.example.org/source", bundle = null, capture = null } = {}) {
      const digest = capture || sha(`held ${as} ${address}`);
      if (as === "link") {
        const i = address.indexOf("#");
        const raw = i === -1 ? address : address.slice(0, i);
        st.sql.exec(`INSERT INTO links (source_bundle, source_capture, link_ref, address, address_norm, citation_norm,
                       fragment, partition, captured_at, first_seen) VALUES (?, ?, ?, ?, ?, ?, ?, 'deferred', 't', 't')`,
                    bundle, digest, address, raw, normalizeAddress(raw), address, fragmentOf(address));
      } else {
        const addr = as === "retrieval" ? of : address;
        st.sql.exec(`INSERT OR IGNORE INTO captured_locators (address_norm, address, capture_sha, via, retrieval_locator,
                       first_retrieved, last_retrieved) VALUES (?, ?, ?, ?, ?, 't', 't')`,
                    normalizeAddress(addr), addr, digest, as === "retrieval" ? "archive" : "direct",
                    as === "retrieval" ? address : null);
      }
      if (bundle)
        st.sql.exec(`INSERT OR IGNORE INTO register (capture_sha, bundle_id, path, encoding, bytes, registered)
                     VALUES (?, ?, 'snapshots/x.bin', 'binary', 1, 't')`, digest, bundle);
      return digest;
    },
    ask(over = {}, stamps = {}) {
      const { held = true, ...rest } = over;
      const address = rest.address ?? "https://example.org/a";
      if (held && typeof address === "string" && /^https:\/\//i.test(address)) w.hold(address);
      return cr.captureRequest({ run: "R-1", address: "https://example.org/a", target: "INQ-1", purpose: "investigate",
                                 ...rest }, { viewer: V("ann"), caller: "member:ann/tok1", ...stamps });
    },
    tick(ms = 60_000) { clock.ms += ms; },
  };
  return w;
}
