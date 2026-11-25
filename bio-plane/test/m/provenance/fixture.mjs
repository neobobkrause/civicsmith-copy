/* provenance over the modules it uses, each the real one (record-core, membership, credentials, promotion), on a real SQLite
   database (node:sqlite) standing in for a Durable Object's storage at its shape: `sql.exec`, answering a cursor as
   workerd does, and `transactionSync`, which rolls
   back what `fn` wrote when it throws and nests as savepoints. Every test drives provenance at its interface; the
   promotions it registers into are driven through promotion's own `promote`. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* A cursor as workerd's `sql.exec` answers one (K316): an iterator over the rows, read once, with `toArray()` and
   `one()`; never an array, so `[0]` or `.length` on it is undefined, as in a Durable Object. */
function cursor(rows) {
  let i = 0;
  const c = {
    columnNames: rows.length ? Object.keys(rows[0]) : [],
    rowsRead: rows.length,
    rowsWritten: 0,
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() {
      const rest = c.toArray();
      if (rest.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${rest.length}`);
      return rest[0];
    },
    raw() { return c.toArray().map((r) => Object.values(r))[Symbol.iterator](); },
  };
  return c;
}

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
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

/** An evidence store stand-in keyed by digest: `head` answers `{size, checksums?}`, `get` the bytes. */
export function evidence(objects = {}, { checksum = true } = {}) {
  const held = new Map(Object.entries(objects).map(([k, v]) => [k, typeof v === "string" ? Buffer.from(v, "utf8") : v]));
  const calls = [];
  return {
    held, calls,
    async head(k) {
      calls.push(["head", k]);
      if (!held.has(k)) return null;
      const b = held.get(k);
      return { size: b.length, ...(checksum ? { checksums: { sha256: createHash("sha256").update(b).digest() } } : {}) };
    },
    async get(k) {
      calls.push(["get", k]);
      if (!held.has(k)) return null;
      const b = held.get(k);
      return { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
    },
    async put(k, bytes) { calls.push(["put", k]); held.set(k, Buffer.from(bytes)); return { key: k }; },
  };
}

/** A record: the five modules on one storage, the producing group registered as promotion's fact (instance-setup's,
 *  K69; each fact under the module that provides it, N497), and a clock the test controls. Credentials is built after
 *  membership, as the composition root builds it (K789): the founder's claim and a member's password are its (its R1,
 *  R16, R17; membership R94, R95). */
export function world({ group = "test-group", now = "2026-09-27T03:00:00.000Z", order = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now };
  const record = recordOf(host);
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  const facts = { group };
  promotion.registerFact("producingGroup", "instance-setup", () => facts.group);
  promotion.registerFact("citedBy", "connections", () => []);
  promotion.registerFact("caseMember", "publication", () => false);
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now, ...(order ? { order } : {}) });
  prov.migrate();
  const w = {
    st, host, record, membership, credentials, promotion, prov, clock, facts,
    row: (q, ...a) => [...st.sql.exec(q, ...a)][0] ?? null,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => [...st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    /** Every row of every table, for "nothing was written" (promotion R2). */
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    /** Promote an information bundle with a register document for each capture. */
    promoteInfo(id, { captures = [], base = null, state = "collected", history = null, extraDocs = [], snapKey = null,
                      docs = null, pkg = {}, criticality = "supporting", title = `Document ${id}` } = {}) {
      const files = [];
      const documents = docs ?? captures.map((c) => provDoc(c));
      for (const c of captures) files.push({ path: c.path, text: c.text });
      const md = infoMd(id, { state, history, criticality, title });
      files.unshift({ path: "bundle.md", text: md });
      files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: [...documents, ...extraDocs] }, null, 2) });
      return promotion.promote({
        bundleId: id, base, snapKey: snapKey ?? `k${Math.random().toString(16).slice(2)}`, author: "member:alice",
        files, meta: { object_type: "information" },
        register: captures.map((c) => ({ sha256: sha(c.text), path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })),
        ...pkg,
      });
    },
    head: (id) => record.head(id),
    /** A capture, held as a file of an information bundle. */
    cap: (name, text = `bytes of ${name}`) => ({ path: `snapshots/${name}.txt`, text, sha: sha(text) }),
  };
  return w;
}

export function infoMd(id, { state = "collected", history = null, criticality = "supporting", title = `Document ${id}` } = {}) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: ${JSON.stringify(title)}`,
          `current_state: ${state}`, "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []",
          history ? `state_history:\n${history}` : "state_history: []", `criticality: ${criticality}`,
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

/** A C-18.1-conformant register document for one capture. */
export function provDoc(c, extra = {}) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: sha(c.text), encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
    ...extra,
  };
}

export const V = (id) => `member:${id}`;
