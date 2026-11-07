/* ai-catalogue: the module's invariants at the interface (R10, R46–R50, R52; build/requirements/ai-catalogue.md). R10's
 * and R48's scans read the module's own source files, as those requirements state; every other test drives the exports. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as catalogue from "../../../src/ai-catalogue/index.mjs";
import { CATALOGUE_CHECKS } from "../../../src/ai-catalogue/checks.mjs";
import { ev, entry, plan, payload, publish, advisory, adv, indexOf, pull, world, seeded, sha, AT, PARTS } from "./fixture.mjs";

const { validatePayload, pullRequest, AiCatalogue } = catalogue;
const SRC = new URL("../../../src/ai-catalogue/", import.meta.url);
const source = () => readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => readFileSync(new URL(f, SRC), "utf8")).join("\n");

/* ===================================================================== R10 */

const COUNTRY_CODES = ["US", "CN", "GB", "UK", "FR", "DE", "RU", "IN", "JP", "KR", "CA", "IL", "IR", "KP", "HK", "TW", "SG", "AE"];
const PLACES = ["China", "Chinese", "United States", "America", "Europe", "California", "Oakland", "Alameda", "Beijing", "Hangzhou",
  "Shanghai", "Shenzhen", "Russia", "Israel", "Iran", "Korea", "Japan", "Taiwan", "Paris", "London"];
const placeScan = (text) => [
  ...COUNTRY_CODES.filter((c) => new RegExp(`["'\`]${c}["'\`]`).test(text)),
  ...PLACES.filter((p) => new RegExp(`\\b${p}\\b`, "i").test(text)),
];
test("R10 a scan of the module's source finds no country code or place name", () => {
  assert.deepEqual(placeScan(source()), []);
});
test("R10 control: planting one in the source fails the scan; the barred list is data", () => {
  assert.deepEqual(placeScan(`${source()}\nconst barred = ["CN"];`), ["CN"]);
  assert.deepEqual(placeScan(`${source()}\n/* made in Hangzhou */`), ["Hangzhou"]);
  assert.equal(validatePayload(payload({ policy: { ...payload().policy, origin: { check: "P7", barred: ["QQ", "XB"] } } })).ok, true);
});

/* ===================================================================== R46 */

test("R46 the declared classes read back as stated, and no sentinel in a claim reaches a table outside the payload rows", async () => {
  const S = "SENTINEL-7f3a";
  const doc = payload({ entries: [entry("fake-one", { prices: { ...entry("x").prices, ev: ev("STATED", { source: S }) },
    checks: { ...entry("x").checks, P1: { answer: "met", ev: { ...ev(), page: S, quote: S } } } })],
  plans: [plan("fakeco-api", { restrictions: [{ kind: "use", quote: S, page: S, date: "2026-10-01" }] })] });
  const { cat, db, record } = await seeded(doc);
  const declared = record.declaredTables().filter((d) => d.module === "ai-catalogue");
  assert.deepEqual(declared.map((d) => d.name), ["ai_catalogue_payloads", "ai_catalogue_advisories", "ai_catalogue_checks", "ai_catalogue_rollbacks"]);
  for (const d of declared)
    assert.deepEqual({ purge: d.purge, export: d.export, expunge: d.expunge, version_chain: d.version_chain },
      { purge: "exempt", export: "admin-only", expunge: "none", version_chain: true }, d.name);
  await pull(cat, await publish(payload({ ...doc, seq: 2 })), { advisories: [await advisory(adv(3, { entry_id: "fake-one" }, "watch"))] });
  cat.rollback({ to_seq: 1, by: "member:admin-1", reason: "fixture", at: AT });
  for (const t of ["ai_catalogue_advisories", "ai_catalogue_checks", "ai_catalogue_rollbacks"])
    assert.ok(!JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all()).includes(S), t);
  assert.ok(JSON.stringify(db.prepare(`SELECT body FROM ai_catalogue_payloads`).all()).includes(S));
});
test("R46 control: a table declared twice, or a name that is not one, is refused by declareTable", async () => {
  const { record } = await world();
  const again = record.declareTable("ai-catalogue", [{ name: "ai_catalogue_checks", purge: "exempt", expunge: "none", export: "admin-only",
    sight: "group", derive: "stored", version_chain: true }]);
  assert.equal(again.reason, "TABLE_DECLARED");
  const bad = record.declareTable("ai-catalogue", [{ name: "ai catalogue", purge: "exempt", expunge: "none", export: "admin-only",
    sight: "group", derive: "stored", version_chain: true }]);
  assert.equal(bad.reason, "TABLE_NAME_INVALID");
});

/* ===================================================================== R47 */

const WRITERS = ["loadSeed", "receive", "registerAdapterTypes", "rollback", "unrollback"];
const READS = ["entryOf", "entriesFor", "whyNotOffered", "plansOf", "profileOf", "testedOf", "libraryRows", "combinedResults",
  "catalogueState", "checks"];
test("R47 the module's exports hold no writer beyond the seed, receive, registration, rollback and unrollback", () => {
  const methods = Object.getOwnPropertyNames(AiCatalogue.prototype).filter((m) => m !== "constructor").sort();
  assert.deepEqual(methods, [...WRITERS, ...READS, "migrate", "start"].sort());
  const fns = Object.entries(catalogue).filter(([, v]) => typeof v === "function").map(([k]) => k).sort();
  /* pure helpers beside them: the seed's shape and the build's keys (R39; seed.mjs) write nothing */
  assert.deepEqual(fns, ["AiCatalogue", "aiCatalogueOf", "isDate", "isInstant", "pullRequest", "validatePayload",
    "catalogueKeysFor", "isDevelopmentKey", "seedOf", "seedFor"].sort());
});
test("R47 the reads never throw and write nothing", async () => {
  const { cat, db } = await seeded();
  const count = () => db.prepare(`SELECT (SELECT count(*) FROM ai_catalogue_payloads) + (SELECT count(*) FROM ai_catalogue_checks)
    + (SELECT count(*) FROM ai_catalogue_advisories) + (SELECT count(*) FROM ai_catalogue_rollbacks) AS n`).get().n;
  const before = count();
  for (const junk of [undefined, null, 7, "x", { part: {} }, { checksInForce: "P1" }, { at: "not a date" }])
    for (const r of READS) assert.doesNotThrow(() => cat[r](junk), r);
  assert.equal(count(), before);
});
test("R47 control: a payload written to the table directly without a verified statement is not read", async () => {
  const { db } = await world();
  const text = JSON.stringify(payload({ seq: 9 }));
  db.prepare(`INSERT INTO ai_catalogue_payloads (seq, part, parts, schema_version, issued_at, sha256, bytes, armored, source,
    received_at, body) VALUES (9, 0, 1, 1, '2026-10-01T00:00:00Z', ?, ?, 'forged', 'pulled', '2026-10-01T00:00:00Z', ?)`)
    .run(sha(text), Buffer.byteLength(text), text);
  const again = await world({ db });
  assert.equal(again.cat.catalogueState({ at: AT }).state, "unavailable");
  assert.equal(again.cat.entryOf("fake-one"), null);
  /* and a verified one written through the module is read after a restart */
  const real = await seeded();
  const restarted = await world({ db: real.db });
  assert.equal(restarted.cat.catalogueState({ at: AT }).seq, 1);
});

/* ===================================================================== R48 */

const PROVIDER_NAMES = ["anthropic", "claude", "openai", "chatgpt", "gpt", "google", "gemini", "mistral", "deepseek", "openrouter",
  "llama", "meta", "cohere", "qwen", "alibaba", "moonshot", "kimi", "xai", "grok", "bedrock", "azure", "vertex", "groq",
  "fireworks", "perplexity", "cloudflare"];
const providerScan = (text) => PROVIDER_NAMES.filter((p) => new RegExp(`\\b${p}\\b`, "i").test(text));
test("R48 a payload for fakeco passes R36 and every read answers for it; the source names no provider", async () => {
  assert.equal(validatePayload(payload()).ok, true);
  const { cat } = await seeded();
  assert.equal(cat.entryOf("fake-one", { at: AT }).provider, "fakeco");
  for (const part of PARTS) assert.equal(cat.entriesFor({ part, at: AT }).entries[0].provider, "fakeco");
  assert.equal(cat.whyNotOffered({ entry_id: "fake-one", part: "ask", at: AT }).offered, true);
  assert.equal(cat.plansOf({ provider: "fakeco", at: AT })[0].provider, "fakeco");
  assert.equal(cat.profileOf("fakeco-profile").id, "fakeco-profile");
  assert.equal(cat.catalogueState({ at: AT }).state, "current");
  assert.deepEqual(providerScan(source()), []);
});
test("R48 control: planting one such id in the source fails the scan", () => {
  assert.deepEqual(providerScan(`${source()}\nconst host = "openrouter";`), ["openrouter"]);
});

/* ===================================================================== R49 */

const CODES = ["CATALOGUE_EVIDENCE_MISSING", "CATALOGUE_ENTRY_INVALID", "CATALOGUE_PLAN_INVALID", "CATALOGUE_PAYLOAD_INVALID",
  "CATALOGUE_PATH_INVALID", "CATALOGUE_ROLLBACK_UNKNOWN", "CATALOGUE_UNAVAILABLE", "DIGEST_MISMATCH", "NOT_NEWER",
  "ADVISORY_BAD_MOVE", "ADVISORY_REASON_UNKNOWN", "PART_UNKNOWN", "CHECK_UNKNOWN"];
const PLAIN = /^[A-Za-z0-9_.:/\-[\]]*$/;
const noWords = (r) => {
  assert.ok(!Object.hasOwn(r, "message") && !Object.hasOwn(r, "detail") && !Object.hasOwn(r, "translation"));
  for (const v of Object.values(r)) if (typeof v === "string") assert.match(v, PLAIN);
};
test("R49 each code refuses with its row and carries no English", async () => {
  const seen = {};
  const take = (r, code = r.reason ?? r.code) => { seen[code] = r; };
  take(validatePayload(payload({ entries: [entry("fake-one", { checks: { ...entry("x").checks, P1: { answer: "met" } } })] })));
  take(validatePayload(payload({ entries: [entry("fake-one", { version_kind: "floating" })] })));
  take(validatePayload(payload({ plans: [plan("fakeco-api", { kind: "pooled" })] })));
  take(validatePayload(payload({ extra: 1 })));
  take(pullRequest("payload", "../x"));
  const { cat } = await seeded(payload({ seq: 3 }));
  take(cat.rollback({ to_seq: 1, by: "member:a", reason: "x" }));
  take((await world()).cat.entriesFor({ part: "ask" }));
  take(await cat.receive({ kind: "payload", status: 200, body: "{}", at: AT, trigger: "manual" }));
  take(await cat.loadSeed(await publish(payload({ seq: 2 }))));
  take((await pull(cat, await publish(payload({ seq: 4, entries: [entry("fake-one", { lifecycle: "retired", characterization: undefined })] })))).payload);
  const r = await cat.receive({ kind: "index", status: 200, at: AT, trigger: "manual",
    body: indexOf(null, [await advisory(adv(5, { entry_id: "fake-one" }, "watch", { reason: "bogus" }))]) });
  take(r.advisories[0], r.advisories[0].outcome);
  take(cat.entriesFor({ part: "sing", at: AT }));
  take(cat.entriesFor({ part: "ask", checksInForce: ["P9"], at: AT }));
  assert.deepEqual(Object.keys(seen).sort(), [...CODES].sort());
  for (const code of CODES) {
    const got = seen[code];
    assert.equal(got.check, CATALOGUE_CHECKS[code].check, code);
    assert.equal(got.word, `ai.refused.${code.toLowerCase().replace(/_/g, "")}`, code);
    noWords(got);
  }
});
test("R49 a test lists the codes and finds each in checks.mjs, one family, distinct numbers; control: a code with no row fails", () => {
  for (const code of CODES) assert.ok(Object.hasOwn(CATALOGUE_CHECKS, code), code);
  assert.deepEqual(Object.keys(CATALOGUE_CHECKS).sort(), [...CODES].sort());
  const ids = Object.values(CATALOGUE_CHECKS).map((r) => r.check);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((c) => /^C-156\.\d+$/.test(c)));
  assert.equal(Object.hasOwn(CATALOGUE_CHECKS, "CATALOGUE_BOGUS"), false);
  assert.throws(() => assert.ok(Object.hasOwn(CATALOGUE_CHECKS, "CATALOGUE_BOGUS")));
});
test("R49 a state is read by its word key", async () => {
  const { cat } = await seeded();
  assert.equal(cat.catalogueState({ at: AT }).word, "ai.catalogue.state.current");
});

/* ===================================================================== R50 */

test("R50 a payload received at a pinned at records that instant; the store's pin is read when none is handed", async () => {
  const { cat } = await seeded();
  await cat.receive({ kind: "index", status: 200, at: "2026-10-05T06:07:08Z", trigger: "manual", body: indexOf(null) });
  assert.equal(cat.checks().slice(-1)[0].at, "2026-10-05T06:07:08Z");
  const pinned = await world({ env: { BIO_NOW_MS: String(Date.parse("2026-10-09T01:02:03Z")) } });
  await pinned.cat.receive({ kind: "index", status: 0, trigger: "schedule" });
  assert.equal(pinned.cat.checks()[0].at, "2026-10-09T01:02:03Z");
});
test("R50 control: with no pin the wall clock is read", async () => {
  const { cat } = await world();
  const before = Date.now() - 1000;
  await cat.receive({ kind: "index", status: 0, trigger: "schedule" });
  const t = Date.parse(cat.checks()[0].at);
  assert.ok(t >= before && t <= Date.now() + 1000);
});

/* ===================================================================== R52 */

test("R52 a sentinel secret in the environment appears in no returned value, table or request", async () => {
  const SECRET = "sk-sentinel-0f9e8d7c6b5a";
  const { cat, db } = await seeded(payload(), { env: { API_KEY: SECRET, BIO_NOW_MS: String(Date.parse(AT)) } });
  const answers = [cat.entryOf("fake-one"), cat.entriesFor({ part: "ask" }), cat.plansOf(), cat.catalogueState(), cat.libraryRows(),
    await pull(cat, await publish(payload({ seq: 2 }))), pullRequest("index"), pullRequest("payload", "payloads/2.json")];
  assert.ok(!JSON.stringify(answers).includes(SECRET));
  for (const t of catalogue.AI_CATALOGUE_TABLES) assert.ok(!JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all()).includes(SECRET), t);
});
test("R52 control: the request still builds", () => {
  assert.equal(pullRequest("index").ok, true);
});
