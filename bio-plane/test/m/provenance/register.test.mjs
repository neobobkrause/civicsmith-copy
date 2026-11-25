/* provenance: the register, written inside a promotion (R1–R3, R50), and its reads (R4, R5, R11, R12); the invariants
   about who writes it (R35, R38, R41) and the read contract (R48). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, provDoc } from "./fixture.mjs";
import { PROVENANCE_TABLES, REGISTER_ENTRY_CHECKS } from "../../../src/provenance/index.mjs";

test("R1: one row per capture, with the module's clock, and a revision updates it without clearing what it keeps", () => {
  const w = world({ now: "2026-09-27T03:00:00.000Z" });
  const a = w.cap("a");
  const r = w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  assert.equal(r.ok, true);
  const row = w.row(`SELECT * FROM register WHERE capture_sha=?`, a.sha);
  assert.deepEqual({ ...row }, { capture_sha: a.sha, bundle_id: "INFO-2026-0001-a", path: a.path, encoding: "utf8",
    bytes: Buffer.byteLength(a.text), registered: "2026-09-27T03:00:00.000Z", last_registered: "2026-09-27T03:00:00.000Z",
    authored: 0, author: null, observed_at: null, whole: 0 });
  /* The clock is the module's, never a caller's: a caller's `registered` in the entry is not read. */
  w.clock.now = "2026-09-27T04:00:00.000Z";
  const head = w.head("INFO-2026-0001-a");
  const moved = { ...a, path: "snapshots/moved.txt" };
  const r2 = w.promotion.promote({
    bundleId: "INFO-2026-0001-a", base: head.bundleSha, snapKey: "k2", author: "member:alice",
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0001-a", "bundle.md").text },
            { path: a.path, text: a.text }, { path: moved.path, text: a.text },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(a)] }) }],
    meta: { object_type: "information" },
    register: [{ sha256: a.sha, path: moved.path, bytes: Buffer.byteLength(a.text), registered: "1999-01-01T00:00:00Z",
                 authored: 1, author: "member:mallory" }] });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  const row2 = w.row(`SELECT * FROM register WHERE capture_sha=?`, a.sha);
  assert.equal(row2.path, "snapshots/moved.txt");
  assert.equal(row2.encoding, "utf8", "encoding defaults to utf8");
  assert.equal(row2.registered, "2026-09-27T03:00:00.000Z", "the first registration's instant (T48)");
  assert.equal(row2.last_registered, "2026-09-27T04:00:00.000Z", "the latest write's, the module's clock");
  assert.equal(row2.authored, 0, "a caller's entry never sets authored");
  assert.equal(row2.author, null);
  assert.equal(w.count("register"), 1, "one row per capture");
});

/* A revision of `id` re-registering its live captures as they stand, through promotion's own `promote`. */
function revise(w, id, snapKey) {
  const files = w.record.livePaths(id).map((p) => ({ path: p, text: w.record.readFile(id, p).text }));
  return w.promotion.promote({ bundleId: id, base: w.head(id).bundleSha, snapKey, author: "member:alice", files,
    meta: { object_type: "information" },
    register: w.prov.registeredFor(id).map((r) => ({ sha256: r.capture_sha, path: r.path, encoding: r.encoding, bytes: r.bytes })) });
}

test("R1 (T48): registered is the first registration's instant, never moved by a re-registration under the same bundle; last_registered is the latest", () => {
  const w = world({ now: "2026-09-27T03:00:00.000Z" });
  const a = w.cap("a");
  assert.equal(w.promoteInfo("INFO-2026-0001-a", { captures: [a] }).ok, true);
  const first = "2026-09-27T03:00:00.000Z";
  /* Control: a capture registered once holds both equal. */
  assert.deepEqual({ ...w.row(`SELECT registered, last_registered FROM register WHERE capture_sha = ?`, a.sha) },
                   { registered: first, last_registered: first });
  /* Re-registered by two later revisions of the same bundle: registered stays the first write's instant. */
  for (const [k, at] of [["r2", "2026-09-27T04:00:00.000Z"], ["r3", "2026-09-28T01:02:03.000Z"]]) {
    w.clock.now = at;
    const r = revise(w, "INFO-2026-0001-a", k);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(w.prov.homeOf(a.sha).registered, first, `homeOf after ${k}`);
    assert.equal(w.row(`SELECT last_registered FROM register WHERE capture_sha = ?`, a.sha).last_registered, at,
                 `last_registered after ${k} is that write's instant`);
  }
  assert.equal(Date.parse(w.row(`SELECT last_registered FROM register`).last_registered) > Date.parse(first), true);
  /* Every reader of the row reads the first instant: R11's registeredFor and R12's capturesOf ("first held"). */
  assert.equal(w.prov.registeredFor("INFO-2026-0001-a")[0].registered, first);
  assert.deepEqual(w.prov.capturesOf("INFO-2026-0001-a"), [{ capture_sha: a.sha, held_at: first }]);
  assert.equal(w.count("register"), 1, "still one row per capture");
});

test("R1 (T48): a capture whose home is gone and that registers afresh starts registered and last_registered anew", () => {
  const w = world({ now: "2026-09-27T03:00:00.000Z" });
  /* A row left by another bundle that no longer exists (R2: a gone home does not count). */
  const o = w.cap("o", "orphaned bytes");
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered,last_registered)
                 VALUES (?,?,?,?,?,?,?)`, o.sha, "INFO-2026-0099-gone", o.path, "utf8", 1, "2026-01-01T00:00:00Z",
                "2026-02-01T00:00:00Z");
  assert.equal(w.promoteInfo("INFO-2026-0002-e", { captures: [o] }).ok, true);
  assert.deepEqual({ ...w.row(`SELECT bundle_id, registered, last_registered FROM register WHERE capture_sha = ?`, o.sha) },
                   { bundle_id: "INFO-2026-0002-e", registered: w.clock.now, last_registered: w.clock.now });
  /* A row left under this very id by a home that is gone (nothing is held under it before this creation). */
  const s = w.cap("s", "stale bytes");
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered,last_registered)
                 VALUES (?,?,?,?,?,?,?)`, s.sha, "INFO-2026-0003-f", s.path, "utf8", 1, "2026-01-01T00:00:00Z",
                "2026-01-01T00:00:00Z");
  w.clock.now = "2026-09-27T05:00:00.000Z";
  assert.equal(w.head("INFO-2026-0003-f"), null);
  assert.equal(w.promoteInfo("INFO-2026-0003-f", { captures: [s] }).ok, true);
  assert.deepEqual({ ...w.row(`SELECT registered, last_registered FROM register WHERE capture_sha = ?`, s.sha) },
                   { registered: w.clock.now, last_registered: w.clock.now });
});

test("R1 (T48): a row written before last_registered existed keeps the registered it holds and takes it as its last_registered", () => {
  const w = world();
  /* A store whose register predates the column, holding a row: a boot brings it up to shape. */
  w.st.db.exec(`ALTER TABLE register DROP COLUMN last_registered`);
  const a = w.cap("a");
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                a.sha, "INFO-2026-0001-a", a.path, "utf8", 3, "2026-03-04T05:06:07.000Z");
  assert.deepEqual(w.prov.migrate(), { ok: true });
  assert.deepEqual(w.prov.migrate(), { ok: true }, "idempotent");
  assert.deepEqual({ ...w.row(`SELECT registered, last_registered FROM register WHERE capture_sha = ?`, a.sha) },
                   { registered: "2026-03-04T05:06:07.000Z", last_registered: "2026-03-04T05:06:07.000Z" });
  /* Control: a row written since keeps its own last_registered through a boot. */
  w.st.sql.exec(`UPDATE register SET last_registered = ? WHERE capture_sha = ?`, "2026-03-05T00:00:00.000Z", a.sha);
  w.prov.migrate();
  assert.equal(w.row(`SELECT last_registered FROM register`).last_registered, "2026-03-05T00:00:00.000Z");
});

test("R1: an authored row keeps its flag, author and observed_at through a revision that gives none", () => {
  const w = world();
  const t = w.prov.testify({ words: "The gate was locked at nine.", observedAt: "2026-09-20", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  const before = w.row(`SELECT * FROM register WHERE capture_sha=?`, t.capture_sha);
  assert.equal(before.authored, 1);
  const head = w.head(t.bundle_id);
  const files = w.record.livePaths(t.bundle_id).map((p) => ({ path: p, text: w.record.readFile(t.bundle_id, p).text }));
  const r = w.promotion.promote({ bundleId: t.bundle_id, base: head.bundleSha, snapKey: "rev1", author: V("ruth"),
    files, meta: { object_type: "information" },
    register: [{ sha256: t.capture_sha, path: t.file, bytes: t.bytes }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = w.row(`SELECT * FROM register WHERE capture_sha=?`, t.capture_sha);
  assert.equal(after.authored, 1);
  assert.equal(after.author, V("ruth"));
  assert.equal(after.observed_at, "2026-09-20");
});

test("R2: one capture, one home; the holder named only to a caller who may see it; a gone home does not count", () => {
  const w = world();
  const a = w.cap("a");
  assert.equal(w.promoteInfo("INFO-2026-0001-a", { captures: [a] }).ok, true);
  const before = w.snapshot();
  /* No caller identity: the store's own write is told the holder. */
  const r = w.promoteInfo("INFO-2026-0002-b", { captures: [a] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "CAPTURE_HELD_BY_ANOTHER_BUNDLE");
  assert.equal(r.check, "C-53.13");
  assert.equal(typeof r.translation, "string");
  assert.equal(r.holder, "INFO-2026-0001-a");
  assert.deepEqual(w.snapshot(), before, "refused before anything is written");
  /* A stamped caller whose viewer may not see the holder is told "another record", holder null. */
  const r2 = w.promoteInfo("INFO-2026-0003-c", { captures: [a], pkg: { actorIdentity: "nobody", actorViewer: "nobody" } });
  assert.equal(r2.reason, "CAPTURE_HELD_BY_ANOTHER_BUNDLE");
  assert.equal(r2.holder, null);
  assert.match(r2.detail, /already registered under another record\./);
  assert.equal(r2.detail.includes("INFO-2026-0001-a"), false, "the holder is not named in the words");
  /* A stamped caller who may see it is told. */
  const r3 = w.promoteInfo("INFO-2026-0004-d", { captures: [a], pkg: { actorIdentity: V("x"), actorViewer: V("x") } });
  assert.equal(r3.holder, "INFO-2026-0001-a");
  /* The same bundle re-registering its own bytes is not asked. */
  const head = w.head("INFO-2026-0001-a");
  const same = w.promoteInfo("INFO-2026-0001-a", { captures: [a], base: head.bundleSha });
  assert.equal(same.ok, true, JSON.stringify(same));
  /* A home whose bundle is gone does not count: the capture registers afresh. */
  w.record.purge({ bundleId: "INFO-2026-0001-a" });
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                sha("orphaned"), "INFO-2026-0099-gone", "snapshots/x.txt", "utf8", 8, "2026-01-01T00:00:00Z");
  const o = w.cap("orphan", "orphaned");
  const r4 = w.promoteInfo("INFO-2026-0005-e", { captures: [o] });
  assert.equal(r4.ok, true, JSON.stringify(r4));
  assert.equal(w.row(`SELECT bundle_id FROM register WHERE capture_sha=?`, o.sha).bundle_id, "INFO-2026-0005-e");
});

test("R3: authored is the testimony path's alone; every refusal named, asked before R2's", () => {
  const w = world();
  const t = w.prov.testify({ words: "I counted eleven chairs.", observedAt: "2026-09-21", author: V("sam") });
  assert.equal(t.ok, true);
  const snap = () => w.snapshot();
  /* C-53.8: registering another bundle's authored capture (asked before C-53.13, which would also fire). */
  const s0 = snap();
  const steal = w.promotion.promote({ bundleId: "INFO-2026-0100-steal", base: null, snapKey: "s", author: V("mallory"),
    files: [{ path: "bundle.md", text: w.record.readFile(t.bundle_id, "bundle.md").text.replace(t.bundle_id, "INFO-2026-0100-steal") },
            { path: t.file, text: w.record.readFile(t.bundle_id, t.file).text }],
    meta: { object_type: "information" }, register: [{ sha256: t.capture_sha, path: t.file, bytes: t.bytes }] });
  assert.equal(steal.reason, "TESTIMONY_AUTHORED_UNEARNED");
  assert.equal(steal.check, "C-53.8");
  assert.deepEqual(snap(), s0);
  /* C-53.8: a document claiming authored for a capture that is not this bundle's authored observation. */
  const a = w.cap("a");
  const claim = w.promoteInfo("INFO-2026-0101-claim", { captures: [a], docs: [provDoc(a, { authored: true })] });
  assert.equal(claim.reason, "TESTIMONY_AUTHORED_UNEARNED");
  /* C-53.9: dropping `authored: true`, and an unparsable register, on the authored bundle. */
  const head = w.head(t.bundle_id);
  const live = (p) => w.record.readFile(t.bundle_id, p).text;
  const prov = JSON.parse(live("data/provenance.json"));
  const revise = (provText) => w.promotion.promote({ bundleId: t.bundle_id, base: head.bundleSha, snapKey: `r${Math.random()}`,
    author: V("sam"), meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: live("bundle.md") }, { path: "data/dataset.json", text: live("data/dataset.json") },
            { path: t.file, text: live(t.file) }, { path: "data/provenance.json", text: provText }] });
  const dropped = revise(JSON.stringify({ documents: [{ ...prov.documents[0], authored: false }] }));
  assert.equal(dropped.reason, "TESTIMONY_AUTHORED_DROPPED");
  assert.equal(dropped.check, "C-53.9");
  assert.equal(revise("{not json").reason, "TESTIMONY_AUTHORED_DROPPED");
  /* C-53.7: an authored document whose origin or actor class is not member. */
  const notMember = revise(JSON.stringify({ documents: [{ ...prov.documents[0], origin: { kind: "sweep" } }] }));
  assert.equal(notMember.reason, "TESTIMONY_ORIGIN_NOT_MEMBER");
  assert.equal(notMember.check, "C-53.7");
  const actor = revise(JSON.stringify({ documents: [{ ...prov.documents[0], capture: { ...prov.documents[0].capture, actor_class: "session" } }] }));
  assert.equal(actor.reason, "TESTIMONY_ORIGIN_NOT_MEMBER");
});

test("R4: homeOf answers the home from the register, null when absent or gone, never the author", () => {
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  assert.deepEqual(w.prov.homeOf(a.sha), { bundleId: "INFO-2026-0001-a", path: a.path, encoding: "utf8",
    bytes: Buffer.byteLength(a.text), registered: w.clock.now, authored: false });
  assert.equal(w.prov.homeOf(sha("never")), null);
  const t = w.prov.testify({ words: "Mine.", observedAt: "2026-09-21", author: V("ruth") });
  const h = w.prov.homeOf(t.capture_sha);
  assert.equal(h.authored, true);
  assert.equal("author" in h, false);
  assert.equal(JSON.stringify(h).includes("ruth"), false);
  w.record.purge({ bundleId: "INFO-2026-0001-a" });
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                a.sha, "INFO-2026-0001-a", a.path, "utf8", 1, "x");
  assert.equal(w.prov.homeOf(a.sha), null, "a home whose bundle is gone is no home");
  assert.equal(w.prov.homeOf(null), null);
});

test("R5: registerHolds answers registered and acquired from the record, and parts for a named bundle", () => {
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  assert.deepEqual(w.prov.registerHolds({}), { ok: true, sha: null, asked: false, registered: null, acquired: null });
  const h = w.prov.registerHolds({ sha: `sha256:${a.sha.toUpperCase()}` });
  assert.deepEqual(h, { ok: true, sha: a.sha, asked: true, registered: true, acquired: false });
  w.prov.recordReceipt({ address: "https://e.org/a", addressNorm: "e.org/a", captureSha: sha("parted"), retrieved: "2026-09-27T00:00:00Z" });
  assert.deepEqual(w.prov.registerHolds({ sha: sha("parted") }),
    { ok: true, sha: sha("parted"), asked: true, registered: false, acquired: true });
  const withParts = w.prov.registerHolds({ sha: a.sha, bundle: "INFO-2026-0001-a" });
  assert.deepEqual(withParts.parts, { state: "none" });
  /* A row whose home is gone is not registered. */
  w.record.purge({ bundleId: "INFO-2026-0001-a" });
  w.st.sql.exec(`INSERT INTO register (capture_sha,bundle_id,path,encoding,bytes,registered) VALUES (?,?,?,?,?,?)`,
                a.sha, "INFO-2026-0001-a", a.path, "utf8", 1, "x");
  assert.equal(w.prov.registerHolds({ sha: a.sha }).registered, false);
});

test("R11: registeredFor lists the bundle's register rows in capture_sha order", () => {
  const w = world();
  const caps = ["c", "a", "b"].map((n) => w.cap(n));
  w.promoteInfo("INFO-2026-0001-x", { captures: caps });
  const got = w.prov.registeredFor("INFO-2026-0001-x");
  assert.deepEqual(got.map((r) => r.capture_sha), caps.map((c) => c.sha).sort());
  assert.deepEqual(Object.keys(got[0]).sort(), ["authored", "bytes", "capture_sha", "encoding", "path", "registered", "whole"]);   /* R73's mark; `parts` only on a whole held in parts */
  assert.deepEqual(w.prov.registeredFor("INFO-2026-0404-none"), []);
});

test("R12: capturesOf orders by when the record first held each capture, on this instance's clock alone", () => {
  const w = world();
  const [a, b, c] = ["a", "b", "c"].map((n) => w.cap(n));
  w.clock.now = "2026-09-27T05:00:00.500Z";
  w.promoteInfo("INFO-2026-0001-x", { captures: [a, b, c] });
  /* b was received (a receipt) before it was registered; c's receipt came after its registration. a's receipt is
     spelled whole-second (R48), so it reads `…05:00:00Z` beside a registration at `…05:00:00.500Z`: the earlier of
     the two instants is when the record first held it, compared as instants and never as strings (as strings
     `…:00Z` sorts after `…:00.500Z`). */
  w.prov.recordReceipt({ addressNorm: "e.org/b", captureSha: b.sha, retrieved: "2026-09-27T04:00:00Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: a.sha, retrieved: "2026-09-27T05:00:00.200Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/c", captureSha: c.sha, retrieved: "2026-09-27T06:00:00Z" });
  const got = w.prov.capturesOf("INFO-2026-0001-x");
  assert.deepEqual(got, [
    { capture_sha: b.sha, held_at: "2026-09-27T04:00:00Z" },
    { capture_sha: a.sha, held_at: "2026-09-27T05:00:00Z" },
    { capture_sha: c.sha, held_at: "2026-09-27T05:00:00.500Z" },
  ]);
  /* A document's own stated date never orders them: the register document's `retrieved` is not read. */
  assert.deepEqual(w.prov.capturesOf("INFO-2026-0404-none"), []);
});

test("R35: whether the record holds a capture is read from the register or a receipt, never a caller's claim", () => {
  const w = world();
  const claimed = sha("claimed only");
  /* A register document naming a capture, with no register row for it: the record does not hold it. */
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a], extraDocs: [provDoc({ path: "snapshots/ghost", text: "claimed only" })] });
  assert.equal(w.prov.registerHolds({ sha: claimed }).registered, false);
  assert.equal(w.prov.homeOf(claimed), null);
  /* A register row is written only inside a promotion: no read service writes one. */
  const before = w.count("register");
  w.prov.registerHolds({ sha: claimed }); w.prov.homeOf(claimed); w.prov.registeredFor("INFO-2026-0001-a");
  w.prov.capturesOf("INFO-2026-0001-a"); w.prov.homeCensus({}); w.prov.registerRows();
  assert.equal(w.count("register"), before);
  /* A refused promotion writes no row (promotion R2). */
  const b = w.cap("b");
  const bad = w.promotion.promote({ bundleId: "INFO-2026-0002-b", base: null, snapKey: "x", author: "member:alice",
    files: [{ path: "bundle.md", text: "not a document" }], meta: { object_type: "information" },
    register: [{ sha256: b.sha, path: b.path, bytes: 1 }] });
  assert.equal(bad.ok, false);
  assert.equal(w.row(`SELECT 1 AS x FROM register WHERE capture_sha=?`, b.sha), null);
});

test("R38: an authored observation stays one: its flag is never cleared and its words never rewritten", () => {
  const w = world();
  const t = w.prov.testify({ words: "Exactly these words.", observedAt: "2026-09-21", author: V("ruth") });
  const head = w.head(t.bundle_id);
  const live = (p) => w.record.readFile(t.bundle_id, p).text;
  /* Rewriting the words is a new capture under the old document, and the authored document still names the old one:
     the revision that registers new bytes in its place and drops the claim is refused. */
  const prov = JSON.parse(live("data/provenance.json"));
  const rewritten = w.promotion.promote({ bundleId: t.bundle_id, base: head.bundleSha, snapKey: "rw", author: V("ruth"),
    meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: live("bundle.md") }, { path: t.file, text: "Other words." },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [{ ...prov.documents[0], authored: false }] }) }] });
  assert.equal(rewritten.ok, false);
  assert.equal(w.row(`SELECT authored FROM register WHERE capture_sha=?`, t.capture_sha).authored, 1);
  assert.equal(live(t.file).endsWith("Exactly these words."), true);
  const doc = JSON.parse(live("data/provenance.json")).documents[0];
  assert.equal(doc.authored, true);
  assert.equal(doc.origin.kind, "member");
  assert.equal(doc.capture.actor_class, "member");
});

test("R41: the module owns its tables, declared to purge once; another declaration of one is refused; the route marks and the instance key's tables are not its", () => {
  const w = world();
  assert.deepEqual(PROVENANCE_TABLES, ["register", "register_parts", "captured_locators", "origin_declarations", "authority_decisions"]);   /* R41, R74 */
  /* N512: provenance_route_marks is provenance-routes' (its R12), receipt_keys and signed_receipts attestation's (its
     R10): this module neither creates nor declares them, so each owner declares its own. */
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name);
  const free = world();
  for (const t of ["provenance_route_marks", "receipt_keys", "signed_receipts"]) {
    assert.equal(tables.includes(t), false, `${t} is not created here`);
    assert.equal(free.record.declarePurge(`owner-of-${t}`, [{ name: t, keys: [] }]).ok, true, `${t} is not declared here`);
  }
  const again = w.record.declarePurge("someone-else", ["register"]);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "TABLE_DECLARED");
  assert.equal(again.declaredBy, "provenance");
  /* A whole-store purge clears them; a bundle purge clears the bundle's register rows and marks only. */
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: a.sha, retrieved: "2026-09-27T00:00:00Z" });
  const one = w.record.purge({ bundleId: "INFO-2026-0001-a" });
  assert.equal(w.count("register"), 0);
  assert.equal(w.count("captured_locators"), 1, "receipts are keyed to no bundle");
  assert.equal(one.ok !== false, true);
  w.record.purge({});
  assert.equal(w.count("captured_locators"), 0);
});

const WHOLE_SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

test("R48: register and captured_locators keep their read-contract columns, joinable in a later module's SQL", () => {
  const w = world({ now: "2026-09-27T05:06:07.000Z" });
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  w.prov.recordReceipt({ address: "https://e.org/a", addressNorm: "e.org/a", captureSha: a.sha,
                         retrieved: "2026-09-27T00:00:00Z", retrievalLocator: "https://e.org/a?x" });
  const cols = (t) => w.rows(`PRAGMA table_info(${t})`).map((r) => r.name);
  for (const c of ["capture_sha", "bundle_id", "path", "registered", "authored", "bytes", "author"])
    assert.equal(cols("register").includes(c), true, c);
  for (const c of ["address_norm", "address", "retrieval_locator", "capture_sha", "first_retrieved", "via", "last_retrieved"])
    assert.equal(cols("captured_locators").includes(c), true, c);
  /* N111: `registered` is this module's clock at the register write (R1), an ISO instant; `address_norm` is the
     receipt's document address as the acquisition normalised it (R13), the key a later module seeks on. */
  assert.equal(w.row(`SELECT registered FROM register WHERE capture_sha = ?`, a.sha).registered, "2026-09-27T05:06:07.000Z");
  assert.equal(Number.isFinite(Date.parse(w.row(`SELECT registered FROM register`).registered)), true);
  assert.deepEqual({ ...w.row(`SELECT address_norm, address FROM captured_locators WHERE address_norm = ?`, "e.org/a") },
                   { address_norm: "e.org/a", address: "https://e.org/a" });
  const joined = w.row(`SELECT r.bundle_id, r.path, cl.address, cl.retrieval_locator FROM captured_locators cl
                          JOIN register r ON r.capture_sha = cl.capture_sha WHERE cl.address_norm = ?`, "e.org/a");
  assert.deepEqual({ ...joined }, { bundle_id: "INFO-2026-0001-a", path: a.path, address: "https://e.org/a",
                                    retrieval_locator: "https://e.org/a?x" });
});

test("R48 (T48): after a re-registration, a join on register.registered orders the captures by their first registration; last_registered is later", () => {
  const w = world({ now: "2026-09-27T01:00:00.000Z" });
  const a = w.cap("a"), b = w.cap("b");
  assert.equal(w.promoteInfo("INFO-2026-0001-x", { captures: [a] }).ok, true);
  w.clock.now = "2026-09-27T02:00:00.000Z";
  const files = w.record.livePaths("INFO-2026-0001-x").map((p) => ({ path: p, text: w.record.readFile("INFO-2026-0001-x", p).text }));
  const withB = w.promotion.promote({ bundleId: "INFO-2026-0001-x", base: w.head("INFO-2026-0001-x").bundleSha, snapKey: "b",
    author: "member:alice", meta: { object_type: "information" },
    files: [...files.filter((f) => f.path !== "data/provenance.json"), { path: b.path, text: b.text },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(a), provDoc(b)] }) }],
    register: [a, b].map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
  assert.equal(withB.ok, true, JSON.stringify(withB));
  /* a is re-registered later still, by a third revision. */
  w.clock.now = "2026-09-27T03:00:00.000Z";
  assert.equal(revise(w, "INFO-2026-0001-x", "c").ok, true);
  assert.equal(PROVENANCE_TABLES.includes("register"), true);
  const cols = w.rows(`PRAGMA table_info(register)`).map((r) => r.name);
  assert.equal(cols.includes("last_registered"), true, "last_registered joins the read contract");
  /* A later module's own SQL (capture R77's "first registered under a document"): the first is a, then b. */
  const order = w.rows(`SELECT r.capture_sha FROM register r JOIN bundles bd ON bd.bundle_id = r.bundle_id
                         WHERE r.bundle_id = ? ORDER BY r.registered, r.capture_sha`, "INFO-2026-0001-x").map((r) => r.capture_sha);
  assert.deepEqual(order, [a.sha, b.sha]);
  assert.deepEqual({ ...w.row(`SELECT capture_sha FROM register WHERE bundle_id = ? ORDER BY registered LIMIT 1`, "INFO-2026-0001-x") },
                   { capture_sha: a.sha });
  /* Control: the latest write's instant is held apart, later than the first. */
  const row = w.row(`SELECT registered, last_registered FROM register WHERE capture_sha = ?`, a.sha);
  assert.deepEqual({ ...row }, { registered: "2026-09-27T01:00:00.000Z", last_registered: "2026-09-27T03:00:00.000Z" });
  assert.equal(row.last_registered > row.registered, true, "compared as text, as a later module's SQL compares them");
  assert.deepEqual(w.rows(`SELECT capture_sha FROM register WHERE bundle_id = ? ORDER BY last_registered DESC, capture_sha`,
                          "INFO-2026-0001-x").map((r) => r.capture_sha), [a.sha, b.sha]);
});

test("R48: register.authored is 1 exactly for a member's authored observation, and register.author names that member alone", () => {
  /* N145 (K182): basis-versions R39 joins `authored`; N213: publication reads `author`. */
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  const t = w.prov.testify({ words: "The lights were off.", observedAt: "2026-09-20", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  const rows = w.rows(`SELECT capture_sha, authored, author FROM register ORDER BY capture_sha`)
    .map((r) => ({ ...r }));
  assert.deepEqual(rows.find((r) => r.capture_sha === t.capture_sha), { capture_sha: t.capture_sha, authored: 1, author: V("ruth") });
  assert.deepEqual(rows.find((r) => r.capture_sha === a.sha), { capture_sha: a.sha, authored: 0, author: null });
  /* Every row: authored is 0 or 1, and author is set exactly when authored is 1. */
  for (const r of rows) {
    assert.equal(r.authored === 0 || r.authored === 1, true, r.capture_sha);
    assert.equal(r.author !== null, r.authored === 1, r.capture_sha);
  }
  /* A later module's own SQL finds the authored observations by the column. */
  assert.deepEqual(w.rows(`SELECT r.bundle_id FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id WHERE r.authored = 1`)
                     .map((r) => r.bundle_id), [t.bundle_id]);
});

test("R48: register.bytes is the registered capture's size as the entry that registers it states it", () => {
  const w = world();
  const a = w.cap("a", "twelve bytes"), b = w.cap("b");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a, b] });
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, a.sha).bytes, 12);
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, b.sha).bytes, Buffer.byteLength(b.text));
  /* As the entry states it, even where the file the entry names is not those bytes (a capture held in parts). */
  const p = w.cap("p", "a part");
  const r = w.promotion.promote({ bundleId: "INFO-2026-0002-p", base: null, snapKey: "p", author: "member:alice", replay: true,
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0001-a", "bundle.md").text.replace("INFO-2026-0001-a", "INFO-2026-0002-p") },
            { path: p.path, text: p.text }], meta: { object_type: "information" },
    register: [{ sha256: sha("the whole"), path: "snapshots/whole", bytes: 4096 }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, sha("the whole")).bytes, 4096);
  /* A revision re-registering the capture carries the size its entry states. */
  const head = w.head("INFO-2026-0001-a");
  const files = w.record.livePaths("INFO-2026-0001-a").map((x) => ({ path: x, text: w.record.readFile("INFO-2026-0001-a", x).text }));
  const rev = w.promotion.promote({ bundleId: "INFO-2026-0001-a", base: head.bundleSha, snapKey: "rev", author: "member:alice",
    files, meta: { object_type: "information" }, register: [{ sha256: a.sha, path: a.path, bytes: 13 }] });
  assert.equal(rev.ok, true, JSON.stringify(rev));
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, a.sha).bytes, 13);
});

test("R50: an entry whose bytes is absent, null, or not a whole number at least 0 is refused REGISTER_BYTES_UNSTATED, first, before anything is written", () => {
  const w = world();
  const a = w.cap("a"), held = w.cap("held");
  assert.equal(w.promoteInfo("INFO-2026-0001-h", { captures: [held] }).ok, true);
  const t = w.prov.testify({ words: "The door was open.", observedAt: "2026-09-20", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  const row = REGISTER_ENTRY_CHECKS.REGISTER_BYTES_UNSTATED;
  assert.deepEqual([row.check, typeof row.translation, /^src\/provenance\/index\.mjs /.test(row.where)], ["C-53.14", "string", true],
                   "its catalogue row, its where naming the check's region");
  const good = { sha256: a.sha, path: a.path, encoding: "utf8", bytes: Buffer.byteLength(a.text) };
  const promote = (register, extra = {}) => w.promoteInfo("INFO-2026-0002-a", { captures: [a], pkg: { register, ...extra } });
  const refusedAs = (r, index, sha256, path, what) => {
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "REGISTER_BYTES_UNSTATED", "REGISTER_BYTES_UNSTATED",
                     "C-53.14", row.translation], what);
    assert.deepEqual([r.index, r.sha256, r.path], [index, sha256, path], `${what}: names the entry's sha256 and path`);
    assert.equal(typeof r.detail, "string", what);
  };
  /* Every way an entry can fail to state a whole size at least 0, each refused with nothing written. */
  const { bytes: _drop, ...absent } = good;
  const bad = [["absent", absent], ["null", { ...good, bytes: null }], ["negative", { ...good, bytes: -1 }],
               ["fraction", { ...good, bytes: 1.5 }], ["a string", { ...good, bytes: "12" }], ["NaN", { ...good, bytes: NaN }],
               ["infinite", { ...good, bytes: Infinity }], ["past exact", { ...good, bytes: 2 ** 53 }],
               ["a bigint", { ...good, bytes: 12n }], ["an object", { ...good, bytes: { n: 12 } }], ["a boolean", { ...good, bytes: true }]];
  for (const [what, entry] of bad) {
    const before = w.snapshot();
    refusedAs(promote([entry]), 0, a.sha, a.path, what);
    assert.deepEqual(w.snapshot(), before, `${what}: nothing written`);
  }
  /* An entry that is not an object states no size: refused, naming no sha256 or path. The one past the first good entry
     is the one named. */
  refusedAs(promote([good, null]), 1, null, null, "a null entry");
  refusedAs(promote([good, "x"]), 1, null, null, "a string entry");
  /* A replay is not exempt, and the check is asked before the testimony fence (R3) and one-home (R2), which would also fire. */
  refusedAs(promote([{ ...good, bytes: -1 }], { replay: true }), 0, a.sha, a.path, "a replay");
  refusedAs(promote([{ sha256: held.sha, path: held.path }]), 0, held.sha, held.path, "before R2");
  refusedAs(promote([{ sha256: t.capture_sha, path: t.file, bytes: 1.5 }]), 0, t.capture_sha, t.file, "before R3");
  assert.equal(w.head("INFO-2026-0002-a"), null);
  /* Accepted: 0 and the largest exact size, each stored exactly as stated (never compared with the stored object). */
  const r = promote([{ ...good, bytes: 0 }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, a.sha).bytes, 0);
  const rev = w.promoteInfo("INFO-2026-0002-a", { captures: [a], base: w.head("INFO-2026-0002-a").bundleSha,
                                                  pkg: { register: [{ ...good, bytes: Number.MAX_SAFE_INTEGER }] } });
  assert.equal(rev.ok, true, JSON.stringify(rev));
  assert.equal(w.row(`SELECT bytes FROM register WHERE capture_sha = ?`, a.sha).bytes, Number.MAX_SAFE_INTEGER);
  /* A promotion with no register list, or an empty one, is not asked. */
  assert.equal(w.promoteInfo("INFO-2026-0003-n", { pkg: { register: [] } }).ok, true);
});

test("R48: captured_locators.via is the receipt's source and part of its key; last_retrieved its latest", () => {
  /* N227, K276: monitoring R26 reads `via`. */
  const w = world();
  const s = sha("v");
  w.prov.recordReceipt({ addressNorm: "e.org/v", captureSha: s, retrieved: "2026-09-27T02:00:00Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/v", captureSha: s, retrieved: "2026-09-27T01:00:00Z", via: "archive.org" });
  w.prov.recordReceipt({ addressNorm: "e.org/v", captureSha: s, retrieved: "2026-09-27T04:00:00Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/v", captureSha: s, retrieved: "2026-09-27T03:00:00Z" });
  const rows = w.rows(`SELECT via, first_retrieved, last_retrieved, observations FROM captured_locators
                        WHERE address_norm = ? AND capture_sha = ? ORDER BY via`, "e.org/v", s).map((r) => ({ ...r }));
  assert.deepEqual(rows, [
    { via: "archive.org", first_retrieved: "2026-09-27T01:00:00Z", last_retrieved: "2026-09-27T01:00:00Z", observations: 1 },
    { via: "direct", first_retrieved: "2026-09-27T02:00:00Z", last_retrieved: "2026-09-27T04:00:00Z", observations: 3 },
  ]);
  /* A receipt with no via is `direct`, the column's value on every row. */
  assert.equal(w.rows(`SELECT via FROM captured_locators`).every((r) => typeof r.via === "string" && r.via), true);
  /* A second row for the same address, capture and via is refused by the key itself. */
  assert.throws(() => w.st.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved,
    last_retrieved) VALUES (?, ?, ?, 'direct', 'x', 'x')`, "e.org/v", "e.org/v", s), /UNIQUE|PRIMARY/);
});

test("R48: first_retrieved and last_retrieved are spelled whole-second UTC on every row, and compare as text", () => {
  /* N133: a later module brackets them as text in its own SQL. */
  const w = world({ now: "2026-09-27T09:08:07.654Z" });
  const s1 = sha("1"), s2 = sha("2"), s3 = sha("3");
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: s1, retrieved: "2026-09-27T05:00:00.900Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: s1, retrieved: "2026-09-27T05:00:00.100Z" });
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: s1, retrieved: "2026-09-27T07:30:00+02:00" });
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: s2 });
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: s3, retrieved: "not an instant" });
  const one = w.row(`SELECT first_retrieved, last_retrieved FROM captured_locators WHERE capture_sha = ?`, s1);
  assert.deepEqual({ ...one }, { first_retrieved: "2026-09-27T05:00:00Z", last_retrieved: "2026-09-27T05:30:00Z" },
                   "the fraction dropped, an offset read to UTC, and the interval widened as instants");
  assert.equal(w.row(`SELECT first_retrieved FROM captured_locators WHERE capture_sha = ?`, s2).first_retrieved,
               "2026-09-27T09:08:07Z", "no retrieved: this module's clock, whole-second");
  assert.equal(w.row(`SELECT first_retrieved FROM captured_locators WHERE capture_sha = ?`, s3).first_retrieved,
               "2026-09-27T09:08:07Z", "an unreadable retrieved: this module's clock, never the text as given");
  for (const r of w.rows(`SELECT first_retrieved, last_retrieved FROM captured_locators`)) {
    assert.match(r.first_retrieved, WHOLE_SECOND);
    assert.match(r.last_retrieved, WHOLE_SECOND);
  }
  /* A bracket as text in SQL, as a later module writes it. */
  assert.deepEqual(w.rows(`SELECT capture_sha FROM captured_locators WHERE first_retrieved <= ? AND last_retrieved >= ?`,
                          "2026-09-27T05:10:00Z", "2026-09-27T05:10:00Z").map((r) => r.capture_sha), [s1]);
  /* Receipts stored before the spelling was stated are re-spelled at migrate; a value naming no instant is left. */
  w.st.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved, last_retrieved)
                 VALUES ('e.org/old', 'e.org/old', ?, 'direct', '2026-01-02T03:04:05.678Z', '2026-01-03T00:00:00.001Z')`, s1);
  w.st.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved, last_retrieved)
                 VALUES ('e.org/bad', 'e.org/bad', ?, 'direct', 'garbage', 'garbage')`, s1);
  w.prov.migrate();
  w.prov.migrate();
  assert.deepEqual({ ...w.row(`SELECT first_retrieved, last_retrieved FROM captured_locators WHERE address_norm = 'e.org/old'`) },
                   { first_retrieved: "2026-01-02T03:04:05Z", last_retrieved: "2026-01-03T00:00:00Z" });
  assert.equal(w.row(`SELECT first_retrieved FROM captured_locators WHERE address_norm = 'e.org/bad'`).first_retrieved, "garbage");
  assert.deepEqual({ ...w.row(`SELECT first_retrieved, last_retrieved FROM captured_locators WHERE capture_sha = ? AND address_norm = 'e.org/t'`, s1) },
                   { ...one }, "a row already whole-second is untouched");
});

/* workerd refuses a LIKE or GLOB pattern longer than 50 bytes ("LIKE or GLOB pattern too complex", measured in
   Miniflare: 50 works, 55 fails); node:sqlite has no such cap. This wraps a record's `sql.exec` to refuse as workerd
   does, for a pattern written in the statement or bound to it, so a migration that would fail at a deployed boot
   fails here. */
const WORKERD_PATTERN_CAP = 50;
function capPatterns(w) {
  const exec = w.st.sql.exec.bind(w.st.sql);
  const refused = [];
  w.st.sql.exec = (q, ...args) => {
    const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
    const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
    const long = [...literal, ...bound].find((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP);
    if (long !== undefined) { refused.push(long); throw new Error("LIKE or GLOB pattern too complex"); }
    return exec(q, ...args);
  };
  return refused;
}

test("R48: the whole-second respelling runs at every boot under workerd's 50-byte LIKE/GLOB cap, idempotent", () => {
  const w = world({ now: "2026-09-27T09:08:07.654Z" });
  const s = sha("held");
  w.prov.recordReceipt({ addressNorm: "e.org/new", captureSha: s, retrieved: "2026-09-27T05:00:00Z" });
  const insert = (addr, first, last) => w.st.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha,
    via, first_retrieved, last_retrieved) VALUES (?, ?, ?, 'direct', ?, ?)`, addr, addr, s, first, last);
  insert("e.org/frac", "2026-01-02T03:04:05.678Z", "2026-01-03T00:00:00.001Z");
  insert("e.org/offset", "2026-01-02T05:04:05+02:00", "2026-01-02 03:04:06");
  insert("e.org/bad", "garbage", "2026-01-02T03:04:05Z");
  const refused = capPatterns(w);
  /* A boot over a record holding receipts, twice. */
  assert.deepEqual(w.prov.migrate(), { ok: true });
  assert.deepEqual(w.prov.migrate(), { ok: true });
  assert.deepEqual(refused, [], "no LIKE or GLOB pattern over 50 bytes");
  const at = (addr) => ({ ...w.row(`SELECT first_retrieved, last_retrieved FROM captured_locators WHERE address_norm = ?`, addr) });
  assert.deepEqual(at("e.org/new"), { first_retrieved: "2026-09-27T05:00:00Z", last_retrieved: "2026-09-27T05:00:00Z" },
                   "a row already whole-second is untouched");
  assert.deepEqual(at("e.org/frac"), { first_retrieved: "2026-01-02T03:04:05Z", last_retrieved: "2026-01-03T00:00:00Z" });
  assert.deepEqual(at("e.org/offset"), { first_retrieved: "2026-01-02T03:04:05Z", last_retrieved: "2026-01-02T03:04:06Z" });
  assert.deepEqual(at("e.org/bad"), { first_retrieved: "garbage", last_retrieved: "2026-01-02T03:04:05Z" },
                   "a value naming no instant is left as it is");
  /* The receipt services run under the same cap. */
  w.prov.recordReceipt({ addressNorm: "e.org/new", captureSha: s, retrieved: "2026-09-27T06:00:00.5Z" });
  w.prov.receipts({ addressNorm: "e.org/new" });
  w.prov.receiptsOfCapture({ captureSha: s });
  w.prov.versionChain({ addressNorm: "e.org/new", viewer: V("x") });
  w.prov.registerHolds({ sha: s });
  assert.deepEqual(refused, []);
  assert.equal(at("e.org/new").last_retrieved, "2026-09-27T06:00:00Z");
});

test("R48 (N484): register.bytes, read with plain SQL as corpus-export reads it, holds each registered capture's size as its entry states it", () => {
  const w = world();
  const a = w.cap("a", "twelve bytes"), b = w.cap("b", "");
  assert.equal(w.promoteInfo("INFO-2026-0001-a", { captures: [a] }).ok, true);
  assert.equal(w.promoteInfo("INFO-2026-0002-b", { captures: [b] }).ok, true);
  /* corpus-export's own statement (its R1, `src/corpus-export/index.mjs`), over this module's table. */
  const read = () => w.rows(`SELECT bundle_id, path, capture_sha, bytes FROM register ORDER BY bundle_id`);
  assert.deepEqual(read(), [
    { bundle_id: "INFO-2026-0001-a", path: a.path, capture_sha: a.sha, bytes: 12 },
    { bundle_id: "INFO-2026-0002-b", path: b.path, capture_sha: b.sha, bytes: 0 },
  ]);
  /* Every row the reader sees carries a whole number of bytes, the stated one, never a null or a recount. */
  const stated = 5_000_000_000;
  const r = w.promotion.promote({ bundleId: "INFO-2026-0003-w", base: null, snapKey: "w", author: "member:alice", replay: true,
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0001-a", "bundle.md").text.replace("INFO-2026-0001-a", "INFO-2026-0003-w") }],
    meta: { object_type: "information" }, register: [{ sha256: sha("a large whole"), path: "snapshots/whole", bytes: stated }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = read();
  assert.equal(rows.length, 3);
  assert.equal(rows.every((x) => Number.isSafeInteger(x.bytes) && x.bytes >= 0), true);
  assert.equal(rows.find((x) => x.bundle_id === "INFO-2026-0003-w").bytes, stated);
  /* Negative control: an entry that states no size is refused (R50), so no row without one reaches the reader. */
  const bad = w.promotion.promote({ bundleId: "INFO-2026-0004-n", base: null, snapKey: "n", author: "member:alice", replay: true,
    files: [{ path: "bundle.md", text: w.record.readFile("INFO-2026-0001-a", "bundle.md").text.replace("INFO-2026-0001-a", "INFO-2026-0004-n") }],
    meta: { object_type: "information" }, register: [{ sha256: sha("unstated"), path: "snapshots/u" }] });
  assert.equal(bad.ok, false);
  assert.equal(read().length, 3);
});
