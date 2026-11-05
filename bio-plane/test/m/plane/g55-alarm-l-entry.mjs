/* plane (T51 fix round 6, G55's residual; K4426 (4), K4726), the platform check L: the plane's REAL `Store` (its scheduler with the `ingest` consumer registered by `calculations` R14, the real
   Durable Object alarm path, real DO SQLite, real R2) booted on workerd by `g55-alarm-l.test.mjs` under Miniflare. `G55Plane` is the plane's `Store` plus debug routes that do what a member's
   earlier acts do and nothing else: `/g55/seed` (the entities, the table and the binding a money ingest needs, the member Bob), `/g55/session` (a signed-in member's session row, so the test
   goes through the real door with a bearer token), `/g55/state` (the facts, the ingest's record, the marker, the alarm instant, the firings, the viewer's notices) and `/g55/release`.
   The object's `alarm()` is the runtime's: it only counts the firing, and holds every firing after the gate (`G55_GATE`, a binding: the number of firings let through; unset lets all through)
   until `/g55/release`, so a test can stop an object between two slices and kill it. No route fires a tick; every slice is run by the alarm. Every other request is the plane's own door. */
import { Store } from "../../../src/plane/store.mjs";
import plane from "../../../src/plane/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { calculationsOf } from "../../../src/calculations/index.mjs";
import { noticeProducersOf } from "../../../src/notice-producers/index.mjs";
import { sha256HexSync } from "../../../src/record-grammar/index.mjs";

const BOB = "member:bob";
const FIELDS = [{ name: "payer", type: "string" }, { name: "payee", type: "string" }, { name: "amount", type: "number" }];
const ROLES = { payer: { role: "payer", scheme: "ellery_person" }, payee: { role: "payee", scheme: "ellery_person" }, amount: { role: "amount" } };
const BIND = { amount: "amount", payer: "payer", payee: "payee", kind: { value: "payment" }, phase: { value: "actual" }, stage: { value: "paid" },
  basis: { value: "cash" }, currency: { value: "USD" }, period: { value: "2025-07-01/2026-06-30" } };
const info = (id) => ["---", "id: " + id, "object_type: information", "schema: information@1", "group: test-group", 'title: "ledger"', "current_state: collected", "prior_state: null",
  'created: "2026-09-27T00:00:00Z"', 'last_updated: "2026-09-27T00:00:00Z"', "references: []", "state_history: []", "criticality: supporting", "---", "", "## Summary", "", "A ledger.", ""].join("\n");
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

export class G55Plane extends Store {
  #fired = 0;
  #held = 0;
  #release = null;
  #gate = new Promise((r) => { this.#release = r; });
  async alarm() {
    this.#fired++;
    const through = this.env.G55_GATE === undefined || this.env.G55_GATE === "" ? Infinity : Number(this.env.G55_GATE);
    if (this.#fired > through) { this.#held++; await this.#gate; }
    await super.alarm();
  }
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname;
    if (!p.startsWith("/g55/")) return super.fetch(req);
    try { return json(await this.g55(p.slice(5), url, req.method === "POST" ? await req.json() : {})); }
    catch (e) { return json({ error: String((e && e.stack) || e).slice(0, 1500) }, 500); }
  }
  async g55(step, url, a) {
    const ctx = this.ctx, sql = ctx.storage.sql, record = recordOf(ctx), c = calculationsOf(ctx);
    const one = (s, ...b) => [...sql.exec(s, ...b)][0];
    if (step === "seed") {
      record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
      sql.exec("INSERT OR IGNORE INTO members (member_id, cover, handle, role, status, capabilities, created, updated) VALUES ('bob','Cover bob','h_bob','member','active','[\"contribute\"]','t','t')");
      const ent = entitiesOf(ctx);
      for (const [label, id] of [["Pat Quill", "P001"], ["Lee Quill", "P002"]]) {
        const e = ent.createEntity({ kind: "person", label, note: "alarm check", declaredBy: BOB });
        if (!e.ok) throw new Error("entity " + JSON.stringify(e));
        const r = ent.addIdentifier({ entityId: e.entity_id, scheme: "ellery_person", id, basis: "the roll", by: BOB });
        if (!r.ok) throw new Error("identifier " + JSON.stringify(r));
      }
      const parts = ["payer,payee,amount\n"];
      for (let i = 0; i < a.rows; i++) parts.push("P001,P002," + ((i % 97) + 1) + "\n");   /* every row resolves: every row is a fact */
      const text = parts.join(""), bytes = new TextEncoder().encode(text), capSha = sha256HexSync(text), id = "INFO-2026-0001-doc";
      const r = promotionOf(ctx).promote({ bundleId: id, base: null, snapKey: "k1", author: BOB,
        files: [{ path: "bundle.md", text: info(id) }, { path: "snapshots/doc.csv", blobSha: capSha, bytes: bytes.byteLength },
          { path: "data/provenance.json", text: JSON.stringify({ documents: [{ file: "snapshots/doc.csv", locator: "https://example.org/doc.csv", retrieved: "2026-09-27T00:00:00Z",
            authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
            capture: { method: "acquire", grade: "B", actor_class: "session", sha256: capSha, encoding: "utf8", bytes: bytes.byteLength }, origin: { kind: "named_request" } }] }) }],
        meta: { object_type: "information" }, register: [{ sha256: capSha, path: "snapshots/doc.csv", encoding: "utf8", bytes: bytes.byteLength }] });
      if (!r.ok) throw new Error("promote " + JSON.stringify(r).slice(0, 400));
      await record.evidenceStore().put(capSha, bytes);
      const m = contentOf(ctx).mint({ bundleId: id, captureSha: capSha, extent: { kind: "document" }, mintedBy: BOB });
      if (!m.ok) throw new Error("mint " + JSON.stringify(m).slice(0, 400));
      const t = await c.declareTable({ source: m.content_id, schema: { fields: FIELDS }, header: FIELDS.map((f) => f.name), roles: ROLES, by: BOB });
      if (!t.ok) throw new Error("table " + JSON.stringify(t).slice(0, 400));
      const b = c.adoptBinding({ table: t.sha, roles: BIND, by: BOB });
      if (!b.ok) throw new Error("binding " + JSON.stringify(b).slice(0, 400));
      return { binding: b.binding, bytes: bytes.byteLength };
    }
    if (step === "session") {
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join(""), now = Date.now();   /* a session token is 64 hex */
      sql.exec("INSERT INTO sessions (token_sha, role, expires, created, device, last_active) VALUES (?,?,?,?,?,?)", sha256HexSync(token), BOB, now + 3_600_000, new Date(now).toISOString(), "shared", now);
      return { token };
    }
    if (step === "state") {
      const facts = one("SELECT COUNT(*) AS n, COUNT(DISTINCT source_row) AS d FROM money_facts");
      const rec = one("SELECT state, next_row, attempts, rows_total FROM calc_ingests ORDER BY rowid DESC LIMIT 1") || null;
      const open = one("SELECT COUNT(*) AS n FROM money_ingests WHERE open=1").n, marked = one("SELECT COUNT(*) AS n FROM money_ingests").n;
      const items = noticeProducersOf(ctx).noticeItems({ member: "bob", viewer: BOB, identity: BOB, now: Date.now() }).items.filter((i) => i.kind.startsWith("ingest-"));
      const now = Date.now();
      return { now, ingestDue: c.ingestDue(now), ingestWake: c.ingestWake(now), facts: facts.n, distinctRows: facts.d, record: rec, openMarkers: open, markers: marked, alarm: await ctx.storage.getAlarm(), firings: this.#fired, held: this.#held,
        notices: items.map((i) => ({ id: i.id, kind: i.kind, text: i.text ?? i.says ?? null })) };
    }
    if (step === "release") { this.#release(); return { released: true }; }
    throw new Error("no step " + step);
  }
}

/* The test reaches the debug routes through this Worker over a fresh connection per request (`g55-alarm-l.test.mjs`), never through Miniflare's pooled proxy socket. */
export default {
  fetch(req, env, ctx) {
    if (new URL(req.url).pathname.startsWith("/g55/")) return env.STORE.get(env.STORE.idFromName("bio")).fetch(req);
    return plane.fetch(req, env, ctx);
  },
  scheduled: plane.scheduled,
};
