/* publication — G47t platform check L (K4677): a populated `published_shas` of the old six-column shape, inside a real
   Durable Object's SQLite (Miniflare), takes `migratePublication`'s `ALTER TABLE ... ADD COLUMN capture_sha`, the
   seven-column attestation insert and its `DO UPDATE`. The module's own `schema.mjs` runs in the object; the plane's
   Miniflare suites (`members.test.mjs`, `stats-disclosure.test.mjs`) are the pattern (their `sandbox.mjs` is test-support's, which this module does not use), here narrowed to the one table
   because the statement is the platform's question. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";

/* Miniflare's sandbox lands in a directory this test owns and removes when the process exits (D-186: it leaks otherwise). */
const owned = mkdtempSync(join(tmpdir(), "g47t-"));
process.env.TMPDIR = owned;
process.on("exit", () => rmSync(owned, { recursive: true, force: true }));
const schemaSrc = readFileSync(new URL("../../../src/publication/schema.mjs", import.meta.url), "utf8");
const worker = `
import { migratePublication, ATTESTATION_SHA_UPSERT } from "./schema.mjs";
export class D { constructor(s) { this.sql = s.storage.sql; }
  async fetch() {
    const sql = this.sql, out = {}, rows = (q, ...a) => [...sql.exec(q, ...a)];
    sql.exec("CREATE TABLE published_shas (sha256 TEXT NOT NULL, bundle_id TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL, bytes INTEGER, published TEXT NOT NULL, PRIMARY KEY (sha256, bundle_id, path))");
    sql.exec("INSERT INTO published_shas VALUES ('t-old','REF','materials/t-old','attestation',7,'2026-01-01T00:00:00Z')");
    migratePublication(sql);
    out.old = rows("SELECT * FROM published_shas WHERE sha256='t-old'");
    migratePublication(sql);
    out.again = rows("SELECT * FROM published_shas WHERE sha256='t-old'");
    const put = (t, cap) => sql.exec(ATTESTATION_SHA_UPSERT, t, "REF", "materials/" + t, "attestation", 3, "2026-02-01T00:00:00Z", cap);
    put("t-a", "A"); put("t-a", "A"); put("t-s", "A"); put("t-s", "B"); put("t-s", "A"); put("t-old", "A");
    const cap = (t) => rows("SELECT capture_sha FROM published_shas WHERE sha256=?", t).map((r) => r.capture_sha);
    out.caps = { a: cap("t-a"), shared: cap("t-s"), old: cap("t-old") };
    return new Response(JSON.stringify(out));
  } }
export default { fetch: (r, env) => env.D.get(env.D.idFromName("x")).fetch(r) };`;

test("R40 R-OLD in a real Durable Object: the old six-column table is migrated, the null stays, the upsert clears a differing capture and never fills a null", async () => {
  const mf = new Miniflare({ modules: [{ type: "ESModule", path: "worker.mjs", contents: worker }, { type: "ESModule", path: "schema.mjs", contents: schemaSrc }],
                             durableObjects: { D: { className: "D", useSQLite: true } }, compatibilityDate: "2025-01-01" });
  try {
    const out = await (await mf.dispatchFetch("http://x/")).json();
    const old = { sha256: "t-old", bundle_id: "REF", path: "materials/t-old", kind: "attestation", bytes: 7, published: "2026-01-01T00:00:00Z", capture_sha: null, pixels_sha256: null };
    assert.deepEqual(out.old, [old]);
    assert.deepEqual(out.again, [old], "a second boot changes nothing");
    assert.deepEqual(out.caps, { a: ["A"], shared: [null], old: [null] });
  } finally { await mf.dispose(); }
});
