/* registers' test world: the modules it stands on, each the real one (record-core with an evidence bucket, membership, promotion,
   content with the provenance it builds, monitoring's sweep host for landing and the pause), `acquisition`'s own functions over a
   scripted network (the governor and fetch are its fixtures'), and the test profile's registers (`jurisdictions`, "test-port-ellery").
   Members and projects are made the way the workbooks tests make them. Every test drives `registers` at its interface. */
import { createHash } from "node:crypto";
import { world as acquisitionWorld, network, governor } from "../acquisition/fixture.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { streamRegister, probeRegister, sourceChanged, keyedFetch } from "../../../src/acquisition/index.mjs";
import { registersOf, Registers, registersOps } from "../../../src/registers/index.mjs";
import { get, combine } from "../../../../jurisdictions/index.mjs";

export { network, governor };

/** the combined view of the test profile, edited */
export const viewWith = (edit) => { const v = combine(["test-port-ellery"]).view; edit(v); return v; };
/** the town's register keyed by its source's own columns, so a changed row keeps its key (a content-keyed one is removed and added, R29) */
export const sourceKeyed = () => viewWith((v) => { v.registers.find((r) => r.key === "town_filings").row_key_basis = "source"; });
export const sha = (b) => createHash("sha256").update(typeof b === "string" ? Buffer.from(b) : Buffer.from(b)).digest("hex");
export const V = (id) => `member:${id}`;
export const MACHINE = "class:ai";
export const PROFILE = get("test-port-ellery");
export const DEF = (key) => structuredClone(PROFILE.registers.find((r) => r.key === key));
export const HOST = "data.marlow-county.example";
export const URL_ = `https://${HOST}/files/2025.csv`;
export const enc = (s) => new TextEncoder().encode(s);

/* a comma file for `town_filings`: a header row, then rows with the contact columns the definition drops */
export const SENT = { street: "9000 SENTINEL-STREET", tel: "555-0199-SENTINEL" };
export const HEADER = "filer,donor_name,donor_org,paid,received,form_no,donor_city,donor_state,donor_zip,donor_street,donor_tel,note";
export const rowOf = (i, extra = {}) => ({ filer: `F${10000 + (i % 7)}`, donor_name: `Donor ${i}`, donor_org: i % 3 === 0 ? `Firm ${i}` : "", paid: `${100 + i}.00`,
  received: `0${1 + (i % 9)}/15/2025`, form_no: `460-${i}`, donor_city: "Port Ellery", donor_state: "ME", donor_zip: "04101", donor_street: SENT.street, donor_tel: SENT.tel, note: `note ${i}`, ...extra });
const COLS = HEADER.split(",");
export const csv = (n, { cell = (i) => rowOf(i), header = HEADER } = {}) => `${header}\n${Array.from({ length: n }, (_, i) => { const r = cell(i); return COLS.map((c) => r[c] ?? "").join(","); }).join("\n")}\n`;

export const csvRows = (rows, header = HEADER) => `${header}\n${rows.map((r) => COLS.map((c) => r[c] ?? "").join(",")).join("\n")}\n`;

/* a host that serves one file the way file hosts do: HEAD, ranges, validators */
export function served(bytes, { etag = '"v1"', modified = "Wed, 01 Oct 2025 00:00:00 GMT", ranges = true, length = true, type = "text/csv", log = null } = {}) {
  return (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const range = init.headers && (init.headers.range || init.headers.Range);
    if (log) log.push({ url, method, range: range || null });
    const base = { "content-type": type, etag, "last-modified": modified, ...(ranges ? { "accept-ranges": "bytes" } : {}) };
    if (method === "HEAD") return new Response(null, { status: 200, headers: { ...base, ...(length ? { "content-length": String(bytes.length) } : {}) } });
    if (range && ranges) {
      const m = /bytes=(\d+)-(\d+)/.exec(range);
      const a = Number(m[1]), b = Math.min(Number(m[2]), bytes.length - 1);
      return new Response(bytes.slice(a, b + 1), { status: 206, headers: { ...base, "content-range": `bytes ${a}-${b}/${bytes.length}`, "content-length": String(b - a + 1) } });
    }
    return new Response(bytes, { status: 200, headers: { ...base, ...(length ? { "content-length": String(bytes.length) } : {}) } });
  };
}

export function world({ bounds = {}, phase = null, now = 1_790_000_000_000, admins = ["alice"], refuse = [], port = null, freeBytes = null, view = null, subjects = null } = {}) {
  const w0 = acquisitionWorld({ admins, gov: { refuse } });
  const { host, core: record } = w0;
  const clock = { ms: now };
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => new Date(clock.ms).toISOString() });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const extraction = { readingOf: () => null, unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [], onReading: () => ({ ok: true }) };
  const content = contentOf(host, { record, membership, extraction, now: () => new Date(clock.ms).toISOString() });
  content.provenance.migrate();
  content.migrate();
  record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
  const store = { core: record, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9", BIO_NOW_MS: String(now) }, governor: w0.gov, provenance: content.provenance };
  /* the daemon's host as `importTick` is handed it (monitoring's `sweepHost`, its R65): the pause, and the epoch with its claims. Monitoring is later in the order than
     this module, so its object is not imported; this is the contract's shape. */
  /* (a hand-built object of that shape: nothing else in this file answers for another module) */
  const sweep = (() => { const claims = new Set(); let epoch = 0; return { paused: () => ({ paused: false }), openEpoch: () => ++epoch, claim: (c, s, e) => { const k = `${c}|${s}|${e}`; if (claims.has(k)) return false; claims.add(k); return true; }, closeEpoch: () => {}, running: new Set() }; })();
  const entities = entitiesOf(host, { record, membership, provenance: () => content.provenance });
  entities.migrate();
  const acq = { streamRegister, probeRegister, sourceChanged, keyedFetch };
  const depsBounds = { stream_max: 5 * 1024 ** 3, segment_max: 64 * 1024 * 1024, ...bounds };
  const evidencePurge = async (sha) => { await w0.b.delete(`bio/captures/${sha}`); };
  const registers = registersOf(host, { record, membership, promotion, evidencePurge, acquisition: acq, store, content, extraction, entities, now: () => clock.ms, bounds: depsBounds,
    ...(phase ? { phase } : {}), ...(port ? { port } : {}), ...(freeBytes ? { freeBytes } : {}), ...(view ? { view } : {}), ...(subjects ? { subjects } : {}) });
  let n = 0;
  const w = {
    ...w0, refuse, entities, host, record, membership, promotion, content, store, registers, sweep, clock, acq,
    sql: (q, ...a) => [...w0.s.sql.exec(q, ...a)],
    count: (t) => [...w0.s.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    member(id, { role = "member" } = {}) {
      w0.s.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated) VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    project(title, owner, participants = [], { hidden = false } = {}) {
      const r = promotion.promote({ base: null, snapKey: `p${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      for (const m of participants) w0.s.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?,?,'joined',0,'t','t')`, r.bundleId, m);
      if (hidden) membership.projectVisibilitySet({ projectId: r.bundleId, setting: "hidden", by: owner, viewer: V(owner) });
      membership.reindexProjectSight(r.bundleId);
      return r.bundleId;
    },
    /** the object restarted: a fresh instance over the same storage, as a Durable Object's is after eviction */
    restart() {
      w.registers = new Registers({ storage: host.storage, record, membership, promotion, evidencePurge, acquisition: acq, store, content, extraction, entities, now: () => clock.ms, bounds: depsBounds,
        ...(phase ? { phase } : {}), ...(port ? { port } : {}), ...(freeBytes ? { freeBytes } : {}), ...(view ? { view } : {}), ...(subjects ? { subjects } : {}) });
      return w.registers;
    },
    /** run `fn` with the scripted network up */
    async withNet(routes, fn) {
      const net = network(routes);
      try { return { out: await fn(), net }; } finally { net.restore(); }
    },
    /** tick the alarm until nothing is due (the clock moves a second a tick), at most `max` ticks; the ticks' answers */
    async drain(routes, { max = 400, budget = 5000, hostArg = sweep, advance = 1000, restartEach = false } = {}) {
      const net = network(routes);
      const out = [];
      try {
        for (let i = 0; i < max && w.registers.importDue(clock.ms, hostArg); i++) {
          if (restartEach) w.restart();
          out.push(await w.registers.importTick(clock.ms, budget, hostArg));
          clock.ms += advance;
        }
      } finally { net.restore(); }
      return { ticks: out, net };
    },
  };
  return w;
}

function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          `objective: "Find out."`, "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
}

/** alice an administrator; bob and carol members, dave outside; P a project bob owns that carol has joined; H a hidden project of bob's */
export function seeded(opts = {}) {
  const w = world(opts);
  w.member("alice", { role: "admin" });
  w.member("bob");
  w.member("carol");
  w.member("dave");
  w.P = w.project("Filings", "bob", ["carol"]);
  return w;
}
