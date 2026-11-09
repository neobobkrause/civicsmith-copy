/* ai-catalogue: the signed channel, lifecycle and advisories at the interface (R24–R27, R33–R35, R37, R39–R42;
 * build/requirements/ai-catalogue.md). Payloads and advisories are signed with throwaway keys (fixture.mjs); the copy
 * is driven through `loadSeed`, `receive`, `rollback` and `unrollback` and read through its reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NS_RELEASE, NS_AI_ADVISORY } from "../../../src/sshsig.mjs";
import { pullRequest, CATALOGUE_ADDRESS, CATALOGUE_USER_AGENT, HELD_VERSIONS, ADVISORY_REASONS, SCHEMA_VERSIONS_READ }
  from "../../../src/ai-catalogue/index.mjs";
import { OTHER, sha, entry, payload, publish, advisory, adv, indexOf, pull, world, seeded, AT } from "./fixture.mjs";

const at = (d) => `2026-${d}T00:00:00Z`;
const doc = (seq, over = {}) => payload({ seq, issued_at: at(`10-${String(seq).padStart(2, "0")}`), ...over });
const stateOf = (cat, id, when = AT) => cat.entryOf(id, { at: when })?.state ?? null;
const outcomes = (list) => list.map(({ seq, outcome }) => ({ seq, outcome }));
const offered = (cat, when = AT) => cat.entriesFor({ part: "ask", at: when }).entries.map((e) => e.entry_id);

/* ===================================================================== R24 */

test("R24 retired to listed by advisory is refused ADVISORY_BAD_MOVE", async () => {
  const { cat } = await seeded(doc(1, { entries: [entry("fake-one", { lifecycle: "retired", characterization: undefined })] }));
  const r = await cat.receive({ kind: "index", status: 200, at: AT, trigger: "schedule",
    body: indexOf(null, [await advisory(adv(2, { entry_id: "fake-one" }, "clear"))]) });
  assert.deepEqual(outcomes(r.advisories), [{ seq: 2, outcome: "ADVISORY_BAD_MOVE" }]);
  assert.equal(stateOf(cat, "fake-one"), "retired");
});
test("R24 control: watch to listed (a clear) applies", async () => {
  const { cat } = await seeded(doc(1, { entries: [entry("fake-one", { lifecycle: "watch" })] }));
  assert.equal(stateOf(cat, "fake-one"), "watch");
  assert.equal(cat.entriesFor({ part: "ask", at: AT }).entries[0].watch, true);
  await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-one" }, "clear"))] });
  assert.equal(stateOf(cat, "fake-one"), "listed");
});

/* ===================================================================== R25 */

test("R25 an entry omitted from a newer payload keeps its state, answers omitted_since, and a retire after a lapse moves it", async () => {
  const { cat } = await seeded(doc(1, { entries: [entry("fake-one"), entry("fake-two")] }));
  const r = await pull(cat, await publish(doc(2, { entries: [entry("fake-one")] })));
  assert.equal(r.payload.outcome, "found");
  const e = cat.entryOf("fake-two", { at: AT });
  assert.deepEqual([e.state, e.omitted_since], ["listed", 2]);
  assert.deepEqual(offered(cat).sort(), ["fake-one", "fake-two"]);
  assert.equal(cat.entryOf("fake-one", { at: AT }).omitted_since, null);
  await pull(cat, null, { advisories: [await advisory(adv(3, { entry_id: "fake-two" }, "lapse", { reason: "deprecation" })),
    await advisory(adv(4, { entry_id: "fake-two" }, "retire", { reason: "deprecation" }))] });
  assert.equal(stateOf(cat, "fake-two"), "retired");
  assert.deepEqual(offered(cat), ["fake-one"]);
  assert.equal(cat.entryOf("fake-two", { at: AT }).entry_id, "fake-two");
});
test("R25 control: a payload that names it retired directly from listed is refused ADVISORY_BAD_MOVE", async () => {
  const { cat } = await seeded(doc(1));
  const r = await pull(cat, await publish(doc(2, { entries: [entry("fake-one", { lifecycle: "retired", characterization: undefined })] })));
  assert.equal(r.payload.outcome, "ADVISORY_BAD_MOVE");
  assert.equal(r.payload.path, "entries[0].lifecycle");
  assert.equal(cat.catalogueState({ at: AT }).seq, 1);
  const ok = await pull(cat, await publish(doc(3, { entries: [entry("fake-one", { lifecycle: "lapsed", characterization: undefined })] })));
  assert.equal(ok.payload.outcome, "found");
  assert.equal(stateOf(cat, "fake-one"), "lapsed");
  assert.deepEqual(offered(cat), []);
});

/* ===================================================================== R26 */

test("R26 a lapse for deprecation with a future effective_at is upcoming now and applied at its date", async () => {
  const { cat } = await seeded(doc(1));
  await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-one" }, "lapse",
    { reason: "deprecation", effective_at: at("10-20") }))] });
  const now = cat.catalogueState({ at: AT });
  assert.deepEqual(now.upcoming, [{ seq: 2, target: { entry_id: "fake-one" }, kind: "lapse", reason: "deprecation", effective_at: at("10-20") }]);
  assert.equal(stateOf(cat, "fake-one"), "listed");
  assert.equal(stateOf(cat, "fake-one", at("10-21")), "lapsed");
  assert.deepEqual(offered(cat, at("10-21")), []);
  assert.deepEqual(cat.catalogueState({ at: at("10-21") }).upcoming, []);
});
test("R26 controls: reason bogus is ADVISORY_REASON_UNKNOWN; an unknown target is held and applies when it arrives, refused if not allowed", async () => {
  assert.deepEqual([...ADVISORY_REASONS], ["deprecation", "canary_drift", "served_mismatch", "team_divergence", "health", "terms_change", "other"]);
  const { cat } = await seeded(doc(1));
  const r = await cat.receive({ kind: "index", status: 200, at: AT, trigger: "manual", body: indexOf(null, [
    await advisory(adv(2, { entry_id: "fake-one" }, "watch", { reason: "bogus" })),
    await advisory(adv(3, { entry_id: "fake-later" }, "watch")),
    await advisory(adv(4, { plan_id: "fakeco-api" }, "retire")),
  ]) });
  assert.deepEqual(outcomes(r.advisories), [{ seq: 2, outcome: "ADVISORY_REASON_UNKNOWN" }, { seq: 3, outcome: "found" },
    { seq: 4, outcome: "ADVISORY_BAD_MOVE" }]);
  await pull(cat, await publish(doc(2, { seq: 2, entries: [entry("fake-one"), entry("fake-later")] })));
  assert.equal(stateOf(cat, "fake-later"), "watch");
  assert.equal(cat.plansOf({ at: AT })[0].plans[0].state, "listed");
});

/* ===================================================================== R27 */

test("R27 rolling back to a payload that listed an entry a later advisory lapsed leaves it lapsed", async () => {
  const { cat } = await seeded(doc(1));
  await pull(cat, await publish(doc(2)));
  await pull(cat, null, { advisories: [await advisory(adv(3, { entry_id: "fake-one" }, "lapse"))] });
  await pull(cat, await publish(doc(4, { entries: [entry("fake-one", { lifecycle: "lapsed" })] })));
  assert.deepEqual([cat.catalogueState({ at: AT }).seq, stateOf(cat, "fake-one")], [4, "lapsed"]);
  assert.equal(cat.rollback({ to_seq: 2, by: "member:admin-1", reason: "bad payload", at: AT }).ok, true);
  assert.equal(stateOf(cat, "fake-one"), "lapsed");
});
test("R27 control: a higher payload lists it again only through a legal move", async () => {
  const { cat } = await seeded(doc(1, { entries: [entry("fake-one", { lifecycle: "watch" })] }));
  await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-one" }, "lapse"))] });
  assert.equal((await pull(cat, await publish(doc(3)))).payload.outcome, "ADVISORY_BAD_MOVE");
  const { cat: c2 } = await seeded(doc(1, { entries: [entry("fake-one", { lifecycle: "watch" })] }));
  assert.equal((await pull(c2, await publish(doc(2)))).payload.outcome, "found");
  assert.equal(stateOf(c2, "fake-one"), "listed");
});

/* ===================================================================== R33 */

test("R33 a payload and an advisory each signed with a key in the list verify", async () => {
  const { cat } = await world();
  assert.equal((await cat.loadSeed(await publish(doc(1)))).ok, true);
  const r = await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-one" }, "watch"))] });
  assert.deepEqual(r.index.advisories, [{ seq: 2, outcome: "found" }]);
});
test("R33 control: the same bytes signed in NS_RELEASE, or by a key outside the list, are each refused", async () => {
  const { cat } = await world();
  assert.equal((await cat.loadSeed(await publish(doc(1), { namespace: NS_RELEASE }))).code, "NAMESPACE");
  assert.equal((await cat.loadSeed(await publish(doc(1), { key: OTHER }))).code, "UNKNOWN_KEY");
  assert.equal((await cat.loadSeed(await publish(doc(1), { namespace: NS_AI_ADVISORY }))).code, "NAMESPACE");
  await cat.loadSeed(await publish(doc(1)));
  const r = await pull(cat, null, { advisories: [await advisory(adv(2, { entry_id: "fake-one" }, "watch"), { key: OTHER }),
    await advisory(adv(3, { entry_id: "fake-one" }, "watch"), { namespace: NS_RELEASE })] });
  assert.deepEqual(r.index.advisories, [{ seq: 2, outcome: "UNKNOWN_KEY" }, { seq: 3, outcome: "NAMESPACE" }]);
  assert.equal(stateOf(cat, "fake-one"), "listed");
});

/* ===================================================================== R34 */

test("R34 the request for both kinds carries exactly accept and the fixed user agent", () => {
  const index = pullRequest("index");
  const p = pullRequest("payload", "payloads/7.json");
  assert.equal(index.url, CATALOGUE_ADDRESS);
  assert.equal(p.url, new URL("payloads/7.json", CATALOGUE_ADDRESS).href);
  for (const r of [index, p]) {
    assert.equal(r.method, "GET");
    assert.equal(r.redirect, "manual");
    assert.deepEqual(r.headers, { accept: "application/json", "user-agent": CATALOGUE_USER_AGENT });
  }
  assert.equal(index.max_bytes, 64 * 1024);
  assert.equal(p.max_bytes, 4 * 1024 * 1024);
});
/* F5 (ai-issuer R1): the issuer serves `GET /ai/index.json`, and its index names a payload `catalogue/<seq>.json`, served at
   `/ai/catalogue/<seq>.json`; the address this module reads is that one, so a team's copy reaches it and never a 404. */
test("F5 the index address is the issuer's /ai/index.json, and the index's catalogue/<seq>.json resolves to /ai/catalogue/<seq>.json", () => {
  assert.equal(new URL(pullRequest("index").url).pathname, "/ai/index.json");
  assert.equal(new URL(pullRequest("payload", "catalogue/7.json").url).pathname, "/ai/catalogue/7.json");
  assert.equal(new URL(pullRequest("payload", "advisories/3.json").url).pathname, "/ai/advisories/3.json");
});
test("R34 control: a path of ../x or https://other/x is refused CATALOGUE_PATH_INVALID", () => {
  for (const path of ["../x", "https://other/x", "/abs", "a/../b", "A.json", "a//b"])
    assert.equal(pullRequest("payload", path).code, "CATALOGUE_PATH_INVALID", path);
  assert.equal(pullRequest("other").code, "CATALOGUE_PATH_INVALID");
});

/* ===================================================================== R35 */

test("R35 a payload with one character changed stores nothing and records BAD_SIGNATURE or DIGEST_MISMATCH", async () => {
  const { cat, db } = await seeded(doc(1));
  const pub = await publish(doc(2));
  const tampered = pub.body.replace("fake-one", "fake-onf");
  /* the index carries the tampered digest: the signature no longer covers it */
  const forged = { ...pub, statement: { ...pub.statement, sha256: sha(tampered) } };
  const r1 = await pull(cat, forged, { body: tampered });
  assert.equal(r1.payload.outcome, "BAD_SIGNATURE");
  const r2 = await pull(cat, pub, { body: tampered });
  assert.equal(r2.payload.outcome, "DIGEST_MISMATCH");
  assert.deepEqual(db.prepare("SELECT DISTINCT seq FROM ai_catalogue_payloads").all().map((r) => r.seq), [1]);
  assert.deepEqual(cat.checks().map((c) => c.outcome), ["found", "BAD_SIGNATURE", "found", "DIGEST_MISMATCH"]);
});
test("R35 control: an older signed payload records NOT_NEWER; the same payload twice records none; a non-200 is unreachable", async () => {
  const { cat } = await seeded(doc(3));
  const old = await publish(doc(2));
  const r = await cat.receive({ kind: "index", status: 200, at: AT, trigger: "schedule", body: indexOf(old) });
  assert.equal(r.outcome, "none");
  assert.equal(r.fetch, null);
  assert.equal((await cat.loadSeed(old)).code, "NOT_NEWER");
  const p4 = await publish(doc(4));
  assert.equal((await pull(cat, p4)).payload.outcome, "found");
  assert.equal((await pull(cat, p4)).index.outcome, "none");
  assert.equal((await cat.receive({ kind: "payload", status: 200, at: AT, trigger: "manual", body: p4.body })).outcome, "DIGEST_MISMATCH");
  assert.equal((await cat.receive({ kind: "index", status: 503, at: AT, trigger: "schedule", body: "" })).outcome, "unreachable");
  assert.deepEqual(cat.checks().slice(-1)[0], { at: AT, trigger: "schedule", outcome: "unreachable" });
});

/* ===================================================================== R37 */

test("R37 a schema above every version read is held, verified, unapplied: needs_newer_release, offers unchanged", async () => {
  const { cat, db } = await seeded(doc(1));
  const top = Math.max(...SCHEMA_VERSIONS_READ) + 1;
  const r = await pull(cat, await publish(doc(2, { schema_version: top, entries: [] })));
  assert.equal(r.payload.held_unread, true);
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.state, s.seq], ["needs_newer_release", 1]);
  assert.deepEqual(offered(cat), ["fake-one"]);
  /* a release that reads it applies it at restart */
  const later = await world({ db, supported: [1, top] });
  assert.deepEqual([later.cat.catalogueState({ at: AT }).state, later.cat.catalogueState({ at: AT }).seq], ["current", 2]);
});
test("R37 control: a release that reads it applies it at its next receive", async () => {
  const top = Math.max(...SCHEMA_VERSIONS_READ) + 1;
  const { cat } = await seeded(doc(1), { supported: [1, top] });
  assert.equal((await pull(cat, await publish(doc(2, { schema_version: top })))).payload.applied, true);
  assert.equal(cat.catalogueState({ at: AT }).state, "current");
});

/* ===================================================================== R39 */

test("R39 a copy with no network offers the seed's entries", async () => {
  const { cat } = await seeded(doc(1));
  assert.deepEqual(offered(cat), ["fake-one"]);
  assert.equal(cat.catalogueState({ at: AT }).source, "seed");
});
test("R39 control: a seed with a bad signature is refused and the copy is unavailable; an older seed is NOT_NEWER", async () => {
  const { cat } = await world();
  const pub = await publish(doc(1));
  const bad = { ...pub, armored: (await publish(doc(1), { key: OTHER })).armored };
  assert.equal((await cat.loadSeed(bad)).code, "UNKNOWN_KEY");
  assert.equal(cat.catalogueState({ at: AT }).state, "unavailable");
  assert.equal(cat.entriesFor({ part: "ask", at: AT }).code, "CATALOGUE_UNAVAILABLE");
  const { cat: c2 } = await seeded(doc(5));
  assert.equal((await c2.loadSeed(await publish(doc(2)))).code, "NOT_NEWER");
});

/* ===================================================================== R40 */

test("R40 unreachable checks for longer than stale_after_days leave entriesFor as it was and state stale", async () => {
  const { cat } = await seeded(doc(1));
  await cat.receive({ kind: "index", status: 200, at: AT, trigger: "schedule", body: indexOf(null) });
  const before = cat.entriesFor({ part: "ask", at: at("10-20") });
  for (const d of ["10-10", "10-15", "10-20"]) await cat.receive({ kind: "index", status: 0, at: at(d), trigger: "schedule" });
  assert.equal(cat.catalogueState({ at: at("10-16") }).state, "current");
  assert.equal(cat.catalogueState({ at: at("10-20") }).state, "stale");
  assert.deepEqual(cat.entriesFor({ part: "ask", at: at("10-20") }), before);
});
test("R40 control: one found returns current", async () => {
  const { cat } = await seeded(doc(1));
  await cat.receive({ kind: "index", status: 0, at: at("10-20"), trigger: "schedule" });
  assert.equal(cat.catalogueState({ at: at("10-20") }).state, "stale");
  await pull(cat, await publish(doc(2)), { at: at("10-20") });
  assert.equal(cat.catalogueState({ at: at("10-20") }).state, "current");
});

/* ===================================================================== R41 */

test("R41 roll back from 7 to 5: a pull of 7 stays held, 8 applies", async () => {
  const { cat } = await seeded(doc(5));
  const p7 = await publish(doc(7));
  await pull(cat, p7);
  const r = cat.rollback({ to_seq: 5, by: "member:admin-1", reason: "fixture", at: AT });
  assert.deepEqual([r.from_seq, r.to_seq, r.held_back_seq], [7, 5, 7]);
  const s = cat.catalogueState({ at: AT });
  assert.deepEqual([s.seq, s.rolled_back, s.held_back_seq], [5, true, 7]);
  await pull(cat, p7);
  assert.equal(cat.catalogueState({ at: AT }).seq, 5);
  await pull(cat, await publish(doc(8)));
  assert.deepEqual([cat.catalogueState({ at: AT }).seq, cat.catalogueState({ at: AT }).rolled_back], [8, false]);
});
test("R41 control: after unrollback 7 applies; an unheld seq is CATALOGUE_ROLLBACK_UNKNOWN", async () => {
  const { cat } = await seeded(doc(5));
  await pull(cat, await publish(doc(7)));
  assert.equal(cat.rollback({ to_seq: 6, by: "member:admin-1", reason: "x", at: AT }).code, "CATALOGUE_ROLLBACK_UNKNOWN");
  cat.rollback({ to_seq: 5, by: "member:admin-1", reason: "x", at: AT });
  assert.equal(cat.unrollback({ by: "member:admin-1", at: AT }).cleared, true);
  assert.equal(cat.catalogueState({ at: AT }).seq, 7);
});

/* ===================================================================== R42 */

test(`R42 HELD_VERSIONS plus two payloads leave HELD_VERSIONS (${HELD_VERSIONS})`, async () => {
  const { cat, db } = await seeded(doc(1));
  for (let s = 2; s <= HELD_VERSIONS + 2; s++) await pull(cat, await publish(doc(s)));
  const held = db.prepare("SELECT DISTINCT seq FROM ai_catalogue_payloads ORDER BY seq").all().map((r) => r.seq);
  assert.equal(held.length, HELD_VERSIONS);
  assert.equal(held[held.length - 1], HELD_VERSIONS + 2);
});
test("R42 control: the current one is never dropped, nor the one rolled back from", async () => {
  const { cat, db } = await seeded(doc(1));
  await pull(cat, await publish(doc(2)));
  cat.rollback({ to_seq: 1, by: "member:admin-1", reason: "x", at: AT });
  for (let s = 3; s <= HELD_VERSIONS + 4; s++) await pull(cat, await publish(doc(s)));
  cat.rollback({ to_seq: HELD_VERSIONS + 3, by: "member:admin-1", reason: "x", at: AT });
  await pull(cat, await publish(doc(HELD_VERSIONS + 5)));
  const held = db.prepare("SELECT DISTINCT seq FROM ai_catalogue_payloads ORDER BY seq").all().map((r) => r.seq);
  assert.ok(held.includes(HELD_VERSIONS + 5) && held.includes(HELD_VERSIONS + 4));
  assert.equal(cat.catalogueState({ at: AT }).seq, HELD_VERSIONS + 5);
});
