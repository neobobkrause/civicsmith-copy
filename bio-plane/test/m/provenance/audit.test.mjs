/* provenance: a capture held in parts (R6, R7), the register audit (R8, R9) and the census of displaced homes (R10);
   undetermined stated, never rounded (R37). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, provDoc, evidence } from "./fixture.mjs";
import { partsHeld, PART_VERIFY_READ_MAX, registerAuditReport } from "../../../src/provenance/index.mjs";

const MiB = 1024 * 1024;
const bytes = (n, seed) => Buffer.from(Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) % 256));

/* A bundle whose register document names a whole capture held in parts, with one register row for the whole. */
function parted(w, id, parts, { text = null, wholeBytes = null } = {}) {
  const whole = Buffer.concat(parts.map((p) => p.bytes));
  const doc = { ...provDoc({ path: "snapshots/whole", text: "x" }), capture: { method: "acquire", grade: "B",
    actor_class: "session", sha256: sha(whole), encoding: "binary", bytes: whole.length },
    parts: parts.map((p, i) => ({ file: `snapshots/whole.part${i}`, sha256: sha(p.bytes), bytes: p.bytes.length })) };
  const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `p-${id}`, author: "member:alice",
    files: [{ path: "bundle.md", text: mdOf(id) },
            { path: "data/provenance.json", text: text ?? JSON.stringify({ documents: [doc] }) },
            ...doc.parts.map((p) => ({ path: p.file, blobSha: p.sha256, sha256: p.sha256, bytes: p.bytes }))],
    meta: { object_type: "information" },
    register: [{ sha256: sha(whole), path: "snapshots/whole", encoding: "binary", bytes: wholeBytes ?? whole.length }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { whole, doc };
}
const mdOf = (id) => ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Parted ${id}"`,
  "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  "references: []", "state_history: []", "---", "", "## Summary", ""].join("\n");

test("R6: partsNamed reads the parts the holding bundle's register names, or says none, or why it cannot", () => {
  const w = world();
  const p = [{ bytes: bytes(10, 1) }, { bytes: bytes(12, 2) }];
  const { whole, doc } = parted(w, "INFO-2026-0001-p", p);
  assert.deepEqual(w.prov.partsNamed("INFO-2026-0001-p", `SHA256:${sha(whole).toUpperCase()}`.replace("SHA256:", "sha256:")),
    { state: "named", parts: doc.parts.map((x) => ({ file: x.file, sha256: x.sha256, bytes: x.bytes })) });
  assert.deepEqual(w.prov.partsNamed("INFO-2026-0001-p", sha("other")), { state: "none" }, "no document for this sha");
  assert.deepEqual(w.prov.partsNamed("INFO-2026-0404-x", sha(whole)), { state: "none" }, "no file");
  /* Does not parse; a part with no digest; a negative size: each unreadable, with why. */
  const w2 = world();
  const a = w2.cap("a");
  w2.promoteInfo("INFO-2026-0002-u", { captures: [a] });
  const head = w2.head("INFO-2026-0002-u");
  const revise = (text, k) => w2.promotion.promote({ bundleId: "INFO-2026-0002-u", base: w2.head("INFO-2026-0002-u").bundleSha,
    snapKey: k, author: "member:alice", meta: { object_type: "information" }, replay: true,
    files: [{ path: "bundle.md", text: w2.record.readFile("INFO-2026-0002-u", "bundle.md").text }, { path: a.path, text: a.text },
            { path: "data/provenance.json", text }] });
  assert.ok(head);
  assert.equal(revise("{nope", "k1").ok, true);
  assert.equal(w2.prov.partsNamed("INFO-2026-0002-u", a.sha).state, "unreadable");
  assert.match(w2.prov.partsNamed("INFO-2026-0002-u", a.sha).why, /does not parse/);
  assert.equal(revise(JSON.stringify({ documents: [{ capture: { sha256: a.sha }, parts: [{ file: "x", bytes: 3 }] }] }), "k2").ok, true);
  assert.equal(w2.prov.partsNamed("INFO-2026-0002-u", a.sha).state, "unreadable");
  assert.equal(revise(JSON.stringify({ documents: [{ capture: { sha256: a.sha }, parts: [{ file: "x", sha256: sha("x"), bytes: -1 }] }] }), "k3").ok, true);
  assert.equal(w2.prov.partsNamed("INFO-2026-0002-u", a.sha).state, "unreadable");
  /* Held as a blob, which the store cannot read. */
  const w3 = world();
  const c = w3.cap("c");
  const r = w3.promotion.promote({ bundleId: "INFO-2026-0003-b", base: null, snapKey: "b", author: "member:alice", replay: true,
    files: [{ path: "bundle.md", text: mdOf("INFO-2026-0003-b") }, { path: c.path, text: c.text },
            { path: "data/provenance.json", blobSha: sha("blob"), bytes: 4 }], meta: { object_type: "information" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(w3.prov.partsNamed("INFO-2026-0003-b", c.sha).state, "unreadable");
  assert.match(w3.prov.partsNamed("INFO-2026-0003-b", c.sha).why, /blob/);
});

test("R7: partsHeld names every part missing, disagreeing or unverified, and never verifies on size alone", async () => {
  const ok1 = bytes(100, 1), ok2 = bytes(200, 2), wrong = bytes(300, 3), big = bytes(PART_VERIFY_READ_MAX + 1, 4);
  const noSum = bytes(50, 5);
  const store = evidence({ [sha(ok1)]: ok1, [sha(ok2)]: ok2, [sha(wrong)]: bytes(300, 9), [sha(big)]: big,
                           [sha(noSum)]: noSum });
  /* Stored without a checksum: `noSum` (read back and hashed, small) and `big` (over the bound: unverified). */
  const plain = evidence({ [sha(noSum)]: noSum, [sha(big)]: big, [sha(ok2)]: bytes(199, 2) }, { checksum: false });
  const bucket = { head: async (k) => (plain.held.has(k) ? plain.head(k) : store.head(k)),
                   get: async (k) => (plain.held.has(k) ? plain.get(k) : store.get(k)) };
  const part = (b, file) => ({ file, sha256: sha(b), bytes: b.length });
  const v = await partsHeld(bucket, (s) => s, [part(ok1, "a"), part(bytes(10, 8), "missing"), part(wrong, "wrong-digest"),
                                               part(ok2, "wrong-size"), part(noSum, "read-and-hashed"), part(big, "too-big")]);
  assert.deepEqual(v.missing.map((p) => p.file), ["missing"]);
  assert.deepEqual(v.disagree.map((p) => p.file).sort(), ["wrong-digest", "wrong-size"]);
  assert.equal(v.disagree.find((p) => p.file === "wrong-size").stored_bytes, 199);
  assert.equal(v.disagree.find((p) => p.file === "wrong-digest").stored_sha256, sha(bytes(300, 9)));
  assert.deepEqual(v.unverified.map((p) => p.file), ["too-big"]);
  assert.match(v.unverified[0].why, /no stored checksum/);
  /* The key is the caller's for each digest. */
  const keyed = evidence({ [`pre/${sha(ok1)}`]: ok1 });
  assert.deepEqual(await partsHeld(keyed, (s) => `pre/${s}`, [part(ok1, "a")]), { missing: [], disagree: [], unverified: [] });
  /* A bucket that rejects makes partsHeld reject. */
  await assert.rejects(partsHeld({ head: async () => { throw new Error("down"); } }, (s) => s, [part(ok1, "a")]));
});

test("R8: registerAudit classifies every row and probes each unresolved one in the evidence store", async () => {
  const w = world();
  /* live */
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  /* historical: registered, then the path rewritten by a later revision under a new path */
  const h = w.cap("h");
  w.promoteInfo("INFO-2026-0002-h", { captures: [h] });
  const hv = w.head("INFO-2026-0002-h");
  const r = w.promotion.promote({ bundleId: "INFO-2026-0002-h", base: hv.bundleSha, snapKey: "h2", author: "member:alice",
    meta: { object_type: "information" }, replay: true,
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0002-h", "bundle.md").text },
            { path: h.path, text: "new bytes" }, { path: "data/provenance.json", text: w.record.readFile("INFO-2026-0002-h", "data/provenance.json").text }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  /* superseded: the register row names a path that now holds other bytes, and no history row has these */
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                sha("superseded"), "INFO-2026-0001-a", a.path, "utf8", 10, "x");
  /* orphan: the home is gone */
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                sha("orphan"), "INFO-2026-0999-gone", "snapshots/o", "utf8", 6, "x");
  /* unresolved: captured whole; mismatched size; unbacked */
  const cap = (name, n) => { const c = w.cap(name, `${name}`.repeat(n)); return c; };
  const whole = cap("whole", 3), mism = cap("mism", 3), none = cap("none", 3);
  for (const c of [whole, mism, none]) {
    w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                  c.sha, "INFO-2026-0001-a", `snapshots/elsewhere-${c.sha.slice(0, 6)}`, "utf8", Buffer.byteLength(c.text), "x");
  }
  /* held in parts; held in parts with a part missing; a part unverified; parts named unreadably */
  const p1 = bytes(40, 1), p2 = bytes(60, 2);
  const inParts = parted(w, "INFO-2026-0003-p", [{ bytes: p1 }, { bytes: p2 }]);
  const q1 = bytes(41, 3), q2 = bytes(61, 4);
  parted(w, "INFO-2026-0004-q", [{ bytes: q1 }, { bytes: q2 }]);
  const store = evidence({ [whole.sha]: whole.text, [mism.sha]: "short", [sha(p1)]: p1, [sha(p2)]: p2, [sha(q1)]: q1 });
  const rep = await w.prov.registerAudit(store);
  assert.equal(rep.ok, true);
  assert.equal(rep.total, 9);
  assert.equal(rep.live, 1, "a is live; h's path now holds other bytes, and its own are in history");
  assert.equal(rep.historical, 1);
  assert.equal(rep.superseded, 1);
  assert.equal(rep.captured, 1);
  assert.equal(rep.mismatched, 1);
  assert.equal(rep.held_in_parts, 1);
  assert.equal(rep.unbacked, 3, "none, the orphan, and q's missing part");
  const q = rep.sample.find((s) => s.bundle_id === "INFO-2026-0004-q");
  assert.deepEqual(q.missing_parts.map((m) => m.sha256), [sha(q2)]);
  assert.match(rep.sample.find((s) => s.class === "orphan").why, /absent/);
  assert.ok(inParts);
});

test("R9: sound excludes only unbacked and mismatched; undetermined is counted beside it; no store means unprobed", async () => {
  const w = world();
  const p1 = bytes(20, 1), big = bytes(PART_VERIFY_READ_MAX + 10, 2);
  parted(w, "INFO-2026-0001-p", [{ bytes: p1 }, { bytes: big }]);
  const plain = evidence({ [sha(p1)]: p1, [sha(big)]: big }, { checksum: false });
  const rep = await w.prov.registerAudit(plain);
  assert.equal(rep.undetermined, 1);
  assert.equal(rep.sound, true, "an undetermined row is outside sound, not inside it");
  assert.equal(rep.probed, true);
  /* With the digest checked at the put, the same row is held in parts. */
  const summed = evidence({ [sha(p1)]: p1, [sha(big)]: big });
  const rep2 = await w.prov.registerAudit(summed);
  assert.equal(rep2.held_in_parts, 1);
  assert.equal(rep2.undetermined, 0);
  /* Parts that do not sum to the row's size are mismatched, and the record is not sound. */
  const w2 = world();
  parted(w2, "INFO-2026-0002-p", [{ bytes: p1 }], { wholeBytes: 999 });
  const rep3 = await w2.prov.registerAudit(evidence({ [sha(p1)]: p1 }));
  assert.equal(rep3.mismatched, 1);
  assert.equal(rep3.sound, false);
  /* No evidence store: every unresolved row unbacked with that reason, and probed false. */
  const rep4 = await w2.prov.registerAudit(null);
  assert.equal(rep4.probed, false);
  assert.equal(rep4.sound, false);
  assert.match(rep4.sample[0].why, /no capture bucket/);
  /* At most 40 sample rows. */
  const many = { total: 60, live: 0, superseded: 0, historical: 0,
    unresolved: Array.from({ length: 60 }, (_, i) => ({ capture_sha: sha(`m${i}`), bundle_id: "B", class: "unresolved" })) };
  const rep5 = await registerAuditReport(many, evidence({}));
  assert.equal(rep5.unbacked, 60);
  assert.equal(rep5.sample.length, 40);
});

test("R10: homeCensus lists displaced homes read-only, bounded, with first holder UNDETERMINED", () => {
  const w = world();
  const a = w.cap("a"), b = w.cap("b");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  w.promoteInfo("INFO-2026-0002-b", { captures: [b] });
  /* A second, existing bundle carries a's bytes in a live file (as before D-179's fence). */
  const hb = w.head("INFO-2026-0002-b");
  w.promotion.promote({ bundleId: "INFO-2026-0002-b", base: hb.bundleSha, snapKey: "b2", author: "member:alice",
    meta: { object_type: "information" }, replay: true,
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0002-b", "bundle.md").text }, { path: b.path, text: b.text },
            { path: "snapshots/copy.txt", text: a.text },
            { path: "data/provenance.json", text: w.record.readFile("INFO-2026-0002-b", "data/provenance.json").text }] });
  /* A register row whose home is gone is counted, never listed. */
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                sha("gone"), "INFO-2026-0999-gone", "snapshots/g", "utf8", 4, "x");
  const before = w.snapshot();
  const c = w.prov.homeCensus({});
  assert.deepEqual(w.snapshot(), before, "read-only");
  assert.equal(c.ok, true);
  assert.equal(c.first_holder, "UNDETERMINED");
  assert.equal(c.rewritten, 0);
  assert.equal(c.register.home_absent, 1);
  assert.equal(c.register.rows, 3);
  assert.equal(c.shas, 1);
  assert.deepEqual(c.listed[0].home, { bundle_id: "INFO-2026-0001-a", path: a.path });
  assert.deepEqual(c.listed[0].held_by, [{ table: "files", bundle_id: "INFO-2026-0002-b", path: "snapshots/copy.txt" }]);
  assert.equal(c.files.displaced, 1);
  /* The bound: default 50, at most 500, 0 lists none but counts whole. */
  assert.equal(w.prov.homeCensus({ limit: 0 }).listed.length, 0);
  assert.equal(w.prov.homeCensus({ limit: 0 }).shas, 1);
  assert.equal(w.prov.homeCensus({ limit: 9999 }).listed.length, 1);
});

test("R37: undetermined is stated, never counted as sound, present or absent", async () => {
  const w = world();
  const p1 = bytes(20, 1), big = bytes(PART_VERIFY_READ_MAX + 10, 2);
  parted(w, "INFO-2026-0001-p", [{ bytes: p1 }, { bytes: big }]);
  const rep = await w.prov.registerAudit(evidence({ [sha(p1)]: p1, [sha(big)]: big }, { checksum: false }));
  const u = rep.sample.find((s) => s.bundle_id === "INFO-2026-0001-p");
  assert.equal(rep.undetermined, 1);
  assert.equal(rep.held_in_parts + rep.captured, 0, "not counted as present");
  assert.match(u.why, /could not be verified/);
  assert.equal(w.prov.homeCensus({}).first_holder, "UNDETERMINED");
  /* A part's undetermined digest is reported in the sample with its reason, never as missing; the route that cannot be
     shown is provenance-routes' (its R11; N512). */
  assert.equal(rep.unbacked, 0, "not counted as absent");
  assert.equal(rep.sound, true, "sound speaks for the other rows only");
});
