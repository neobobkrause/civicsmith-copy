/* provenance: the plane's own acquisition receipts (R13–R16), their listeners (R47), and the version chain over them
   (R17, R18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V } from "./fixture.mjs";
import { VERSION_CHAIN_LIMIT_DEFAULT, VERSION_CHAIN_LIMIT_MAX } from "../../../src/provenance/index.mjs";
import { listenerRefusal, MODULE_ORDER } from "../../../src/membership/index.mjs";

const T = (h) => `2026-09-27T${String(h).padStart(2, "0")}:00:00Z`;

test("R13: one row per (address, capture, via); a repeat widens the interval and keeps its retrieval locator", () => {
  const w = world();
  const s = sha("v1");
  w.prov.recordReceipt({ address: "https://E.org/doc", addressNorm: "e.org/doc", captureSha: s, retrieved: T(5),
                         retrievalLocator: "https://e.org/doc?export" });
  let row = w.row(`SELECT * FROM captured_locators`);
  assert.deepEqual({ ...row }, { address_norm: "e.org/doc", address: "https://E.org/doc", capture_sha: s, via: "direct",
    retrieval_locator: "https://e.org/doc?export", first_retrieved: T(5), last_retrieved: T(5), observations: 1,
    reputation: null, uploads: null });
  w.prov.recordReceipt({ addressNorm: "e.org/doc", captureSha: s, retrieved: T(3) });
  w.prov.recordReceipt({ addressNorm: "e.org/doc", captureSha: s, retrieved: T(9) });
  row = w.row(`SELECT * FROM captured_locators`);
  assert.equal(row.first_retrieved, T(3));
  assert.equal(row.last_retrieved, T(9));
  assert.equal(row.observations, 3);
  assert.equal(row.retrieval_locator, "https://e.org/doc?export", "kept when none is given");
  assert.equal(row.address, "https://E.org/doc", "the address as given is kept");
  /* The interval is spelled whole-second (R48): a fraction is dropped, and widening compares instants. */
  w.prov.recordReceipt({ addressNorm: "e.org/doc", captureSha: s, retrieved: "2026-09-27T09:00:00.999Z" });
  assert.equal(w.row(`SELECT last_retrieved FROM captured_locators`).last_retrieved, T(9));
  /* Another via is another row. */
  w.prov.recordReceipt({ addressNorm: "e.org/doc", captureSha: s, retrieved: T(6), via: "archive.org" });
  assert.equal(w.count("captured_locators"), 2);
});

test("R14: the observation is read from the record before the write; without an address or capture nothing is written", () => {
  const w = world();
  const a = w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: sha("1"), retrieved: T(1) });
  assert.equal(a.recorded, true);
  assert.equal(a.observation, "new");
  assert.equal(w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: sha("1"), retrieved: T(2), observation: "changed" }).observation, "unchanged",
               "a caller's word is not read");
  assert.equal(w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: sha("2"), retrieved: T(3) }).observation, "changed");
  assert.equal(w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: sha("3"), retrieved: T(3), via: "archive.org" }).observation, "new",
               "per address and via");
  const n = w.count("captured_locators");
  assert.deepEqual(w.prov.recordReceipt({ captureSha: sha("4") }), { recorded: false });
  assert.deepEqual(w.prov.recordReceipt({ addressNorm: "e.org/y" }), { recorded: false });
  assert.equal(w.count("captured_locators"), n);
});

test("R15, R62: no service but the plane's own receipt writes a receipt", async () => {
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  const before = w.count("captured_locators");
  /* Every other service, asked with everything a caller could hand it. */
  w.prov.registerHolds({ sha: a.sha }); w.prov.homeOf(a.sha); w.prov.receipts({ addressNorm: "e.org/a" });
  w.prov.versionChain({ addressNorm: "e.org/a", viewer: V("x") }); w.prov.captureGrade(a.sha); w.prov.capturesOf("INFO-2026-0001-a"); w.prov.fetchedByThisCopy(a.sha);
  w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "s", by: V("x"), viewer: V("x") });
  w.prov.registeredFor("INFO-2026-0001-a"); w.prov.homeCensus({});
  w.prov.testify({ words: "w", observedAt: "2026-09-20", author: V("x") });
  await w.prov.registerAudit(null);
  w.promoteInfo("INFO-2026-0002-b", { captures: [w.cap("b")], pkg: { receipts: [{ addressNorm: "e.org/b" }] } });
  assert.equal(w.count("captured_locators"), before);
});

test("R16: receipts lists an address's rows by via, or all, with the summed observations", () => {
  const w = world();
  const s = sha("x");
  w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: s, retrieved: T(1), via: "direct" });
  w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: s, retrieved: T(2), via: "direct" });
  w.prov.recordReceipt({ addressNorm: "e.org/x", captureSha: s, retrieved: T(3), via: "archive.org" });
  w.prov.recordReceipt({ addressNorm: "e.org/y", captureSha: s, retrieved: T(3) });
  const r = w.prov.receipts({ addressNorm: "e.org/x" });
  assert.equal(r.address_norm, "e.org/x");
  assert.deepEqual(r.rows.map((x) => x.via), ["archive.org", "direct"]);
  assert.equal(r.observations, 3);
  const all = w.prov.receipts({});
  assert.equal(all.address_norm, null);
  assert.equal(all.rows.length, 3);
  assert.equal(all.observations, 4);
});

test("R47: listeners run in the receipt's transaction in the modules' order; one that fails never undoes the receipt", () => {
  const w = world({ order: [] });
  const seen = [];
  assert.deepEqual(w.prov.onReceipt("observation-log", (e) => { seen.push(["log", e]); return { written: true }; }),
                   { ok: true, module: "observation-log" });
  w.prov.onReceipt("capture", () => { throw new Error("boom"); });
  w.prov.onReceipt("monitoring", () => ({ ok: false, reason: "NOPE" }));
  const r = w.prov.recordReceipt({ address: "https://e.org/a", addressNorm: "e.org/a", captureSha: sha("a"), retrieved: T(4),
                                   retrievalLocator: "https://e.org/a", context: { actor: "x" } });
  assert.equal(r.recorded, true);
  assert.equal(w.count("captured_locators"), 1, "the receipt stands");
  assert.deepEqual(r.listeners.map((l) => [l.module, l.outcome]),
                   [["observation-log", "ran"], ["capture", "threw"], ["monitoring", "refused"]],
                   "modules the order does not name run in the order they registered");
  assert.match(r.listeners.find((l) => l.module === "capture").error, /boom/);
  assert.deepEqual(seen[0][1], { address: "https://e.org/a", address_norm: "e.org/a", capture_sha: sha("a"), via: "direct",
    retrieval_locator: "https://e.org/a", retrieved: T(4), observation: "new", reputation: null, by: null, statement: null,
    context: { actor: "x" } });
  /* Inside the same transaction: a listener that writes, in a receipt that is rolled back, leaves nothing. */
  const w2 = world();
  w2.st.sql.exec(`CREATE TABLE listened (n INTEGER)`);
  w2.prov.onReceipt("observation-log", () => { w2.st.sql.exec(`INSERT INTO listened (n) VALUES (1)`); return null; });
  w2.record.transact(() => {
    w2.prov.recordReceipt({ addressNorm: "e.org/b", captureSha: sha("b"), retrieved: T(1) });
    return { ok: false, reason: "OUTER" };
  });
  assert.equal(w2.count("listened"), 0);
  assert.equal(w2.count("captured_locators"), 0);
});

test("R47: a registration is refused through membership's listenerRefusal, the one site of its two codes (N202)", () => {
  const w = world();
  const held = [];
  const fn = () => null;
  assert.deepEqual(w.prov.onReceipt("observation-log", fn), { ok: true, module: "observation-log" });
  held.push({ module: "observation-log" });
  const again = w.prov.onReceipt("observation-log", () => null);
  assert.deepEqual(again, listenerRefusal(held, "observation-log", fn));
  assert.deepEqual([again.ok, again.reason, again.code, again.module], [false, "LISTENER_DECLARED", "LISTENER_DECLARED", "observation-log"]);
  for (const [m, f] of [["", fn], [null, fn], ["capture", null], ["capture", "not a function"]]) {
    const r = w.prov.onReceipt(m, f);
    assert.deepEqual(r, listenerRefusal(held, m, f));
    assert.deepEqual([r.ok, r.reason, r.code], [false, "LISTENER_MALFORMED", "LISTENER_MALFORMED"]);
  }
  /* A refused registration registers nothing: the receipt names the one listener. */
  const r = w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: sha("a"), retrieved: T(1) });
  assert.deepEqual(r.listeners.map((l) => l.module), ["observation-log"]);
});

test("R47: listeners run in the modules' total order (membership's MODULE_ORDER unless one is given)", () => {
  const w0 = world();
  const order0 = [];
  for (const m of ["monitoring", "observation-log", "capture"]) w0.prov.onReceipt(m, () => { order0.push(m); });
  w0.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: sha("a"), retrieved: T(1) });
  assert.deepEqual(order0, ["capture", "observation-log", "monitoring"].sort((x, y) => MODULE_ORDER.indexOf(x) - MODULE_ORDER.indexOf(y)));
  assert.deepEqual(order0, ["capture", "observation-log", "monitoring"], "layer 3, layer 5, layer 10");
});

test("R47: listeners run in the modules' total order, whatever order they registered in", () => {
  const w = world({ order: ["capture", "observation-log", "monitoring"] });
  const order = [];
  w.prov.onReceipt("monitoring", () => { order.push("monitoring"); });
  w.prov.onReceipt("observation-log", () => { order.push("observation-log"); });
  w.prov.onReceipt("capture", () => { order.push("capture"); });
  w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: sha("a"), retrieved: T(1) });
  assert.deepEqual(order, ["capture", "observation-log", "monitoring"]);
});

test("R17: the versions of one address the viewer may see, merged per capture, ordered, bounded", () => {
  const w = world();
  const v1 = w.cap("v1"), v2 = w.cap("v2"), v3 = w.cap("v3");
  w.promoteInfo("INFO-2026-0001-a", { captures: [v1] });
  w.promoteInfo("INFO-2026-0002-b", { captures: [v2] });
  w.promoteInfo("INFO-2026-0003-c", { captures: [v3] });
  w.prov.recordReceipt({ address: "https://e.org/d", addressNorm: "e.org/d", captureSha: v2.sha, retrieved: T(2) });
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: v2.sha, retrieved: T(8), via: "archive.org" });
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: v1.sha, retrieved: T(1) });
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: v3.sha, retrieved: T(3) });
  /* A receipt with no register row is not a version. */
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: sha("unregistered"), retrieved: T(0) });
  const c = w.prov.versionChain({ addressNorm: "e.org/d", viewer: V("x") });
  assert.equal(c.ok, true);
  assert.equal(c.documents, 1);
  assert.deepEqual(c.versions.map((v) => v.capture_sha), [v1.sha, v2.sha, v3.sha]);
  const two = c.versions[1];
  assert.deepEqual([two.first_retrieved, two.last_retrieved, two.observations, two.via, two.bundle_id],
                   [T(2), T(8), 2, ["archive.org", "direct"], "INFO-2026-0002-b"]);
  assert.equal(c.total, 3);
  assert.equal(c.truncated, false);
  assert.equal(c.limit, VERSION_CHAIN_LIMIT_DEFAULT);
  const page = w.prov.versionChain({ addressNorm: "e.org/d", limit: 1, offset: 1, viewer: V("x") });
  assert.deepEqual(page.versions.map((v) => v.capture_sha), [v2.sha]);
  assert.equal(page.truncated, true);
  assert.equal(w.prov.versionChain({ addressNorm: "e.org/d", limit: 99999, viewer: V("x") }).limit, VERSION_CHAIN_LIMIT_MAX);
  assert.equal(w.prov.versionChain({ addressNorm: "e.org/d", limit: -3, viewer: V("x") }).limit, 1);
  /* A viewer who may see nothing sees no version, and the total says nothing was withheld. */
  const none = w.prov.versionChain({ addressNorm: "e.org/d", viewer: "stranger" });
  assert.deepEqual([none.documents, none.total, none.versions.length], [0, 0, 0]);
  assert.equal(w.prov.versionChain({ addressNorm: "e.org/nothing", viewer: V("x") }).documents, 0);
});

test("R18: an anchor gives its index and predecessor; every refusal named with its catalogue row", () => {
  const w = world();
  const v1 = w.cap("v1"), v2 = w.cap("v2");
  w.promoteInfo("INFO-2026-0001-a", { captures: [v1, v2] });
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: v1.sha, retrieved: T(1) });
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: v2.sha, retrieved: T(2) });
  const at2 = w.prov.versionChain({ addressNorm: "e.org/d", at: v2.sha.toUpperCase(), viewer: V("x") });
  assert.equal(at2.at_index, 1);
  assert.equal(at2.predecessor.capture_sha, v1.sha);
  const at1 = w.prov.versionChain({ addressNorm: "e.org/d", at: v1.sha, viewer: V("x") });
  assert.equal(at1.at_index, 0);
  assert.equal(at1.predecessor, null);
  const r1 = w.prov.versionChain({ addressNorm: " ", viewer: V("x") });
  assert.deepEqual([r1.ok, r1.reason, r1.check], [false, "VERSION_CHAIN_NO_ADDRESS", "C-24.1"]);
  const r2 = w.prov.versionChain({ addressNorm: "e.org/d", at: "abc", viewer: V("x") });
  assert.deepEqual([r2.reason, r2.check], ["VERSION_CHAIN_BAD_ANCHOR", "C-24.3"]);
  const r3 = w.prov.versionChain({ addressNorm: "e.org/d", at: sha("elsewhere"), viewer: V("x") });
  assert.deepEqual([r3.reason, r3.check], ["VERSION_CHAIN_NO_SUCH_VERSION", "C-24.2"]);
  const r4 = w.prov.versionChain({ addressNorm: "e.org/d", at: v1.sha, viewer: "stranger" });
  assert.equal(r4.reason, "VERSION_CHAIN_NO_SUCH_VERSION", "not visible answers as not held");
  for (const r of [r1, r2, r3]) assert.equal(typeof r.translation, "string");
});
