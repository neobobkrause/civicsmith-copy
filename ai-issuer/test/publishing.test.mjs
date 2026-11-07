/* ai-issuer — publishing, Bob's decisions and the seal key (R1–R8, R20), at the Worker's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixture.mjs";

const { AC } = F;

test("R1 a stored payload is served byte-identical and its SHA-256 equals the index's; POST /ai/index.json is refused", async () => {
  const env = F.makeEnv();
  const r = await F.publishPayload(env, F.payloadOf(1));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const idx = await F.call(env, "GET", "/ai/index.json");
  assert.equal(idx.status, 200);
  assert.match(idx.headers.get("cache-control"), /^public, max-age=300$/);
  assert.equal(idx.headers.get("set-cookie"), null);
  const got = await F.call(env, "GET", `/ai/${idx.json.catalogue.path}`);
  assert.equal(got.status, 200);
  assert.deepEqual(got.bytes, F.te.encode(r.pub.body));
  assert.equal(F.sha(got.bytes), idx.json.catalogue.sha256);
  assert.equal(got.headers.get("cache-control"), "public, max-age=31536000, immutable");
  /* controls */
  assert.equal((await F.call(env, "POST", "/ai/index.json", { body: "{}" })).status, 405);
  assert.equal((await F.call(env, "PUT", "/ai/catalogue/1.json", { body: "{}" })).status, 405);
  assert.equal((await F.call(env, "GET", "/ai/catalogue/01.json")).status, 404);
  assert.equal((await F.call(env, "GET", "/ai/elsewhere.json")).status, 404);
  assert.equal((await F.call(env, "GET", "/ai/catalogue/2.json")).status, 404);
});

test("R2 many requests with different headers write no row and every answer is byte-equal; a challenge does write", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  const rows = F.rowCount(env), writes = env.DOCS.writes + env.BLOBS.writes, calls = env.STORE.calls.length;
  const answers = [];
  for (let i = 0; i < 20; i++) {
    const r = await F.call(env, "GET", i % 2 ? "/ai/index.json" : "/ai/catalogue/1.json", { headers: {
      "user-agent": `agent-${i}`, "cf-connecting-ip": `198.51.100.${i}`, "x-forwarded-for": `203.0.113.${i}`, cookie: `c=${i}` } });
    assert.equal(r.headers.get("set-cookie"), null);
    assert.equal(r.headers.get("vary"), null);
    answers.push(F.td.decode(r.bytes));
  }
  assert.equal(new Set(answers.filter((_, i) => i % 2)).size, 1);
  assert.equal(new Set(answers.filter((_, i) => !(i % 2))).size, 1);
  assert.equal(F.rowCount(env), rows);
  assert.equal(env.DOCS.writes + env.BLOBS.writes, writes);
  assert.equal(env.STORE.calls.length, calls, "the public routes never reach the store");
  /* control: a challenge writes its own row */
  await F.register(env);
  const before = F.dump(env).challenges.length;
  assert.equal((await F.challenge(env, await F.runKey())).status, 200);
  assert.equal(F.dump(env).challenges.length, before + 1);
});

test("R3 a payload signed with a throwaway key in the list is stored and served; a changed byte, an undecided entry and an old seq are refused", async () => {
  const env = F.makeEnv();
  const ok = await F.publishPayload(env, F.payloadOf(5));
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal((await F.call(env, "GET", "/ai/catalogue/5.json")).status, 200);
  /* one changed byte: the signature is over the statement, the statement over the bytes */
  const doc = F.payloadOf(6);
  await F.decideAll(env, doc.entries);
  const pub = await AC.publish(doc);
  const tampered = { ...pub.statement, bytes: pub.statement.bytes + 1 };
  let r = await F.op(env, "publishCatalogue", { bytes: pub.body, statement: tampered, armored: pub.armored });
  assert.equal(r.json.code, "BAD_SIGNATURE");
  r = await F.op(env, "publishCatalogue", { bytes: pub.body.replace("Fake fake-one", "Fake fake-onE"), statement: pub.statement, armored: pub.armored });
  assert.equal(r.json.code, "DIGEST_MISMATCH");
  /* a key outside the list */
  r = await F.op(env, "publishCatalogue", await AC.publish(doc, { key: AC.OTHER }).then((p) => ({ bytes: p.body, statement: p.statement, armored: p.armored })));
  assert.equal(r.json.code, "UNKNOWN_KEY");
  /* an entry with no decision */
  const undecided = F.payloadOf(7, [AC.entry("fake-two"), AC.entry("fake-three")]);
  r = await F.publishPayload(env, undecided, { decide: false });
  assert.equal(r.json.code, "ENTRY_NOT_DECIDED");
  assert.equal(r.json.entry_id, "fake-two");
  await F.decideAll(env, [undecided.entries[0]]);
  r = await F.publishPayload(env, undecided, { decide: false });
  assert.equal(r.json.entry_id, "fake-three");
  /* an old seq */
  r = await F.publishPayload(env, F.payloadOf(4));
  assert.equal(r.json.code, "NOT_NEWER");
  /* an invalid payload, the path named */
  r = await F.publishPayload(env, F.payloadOf(8, [AC.entry("fake-one", { lifecycle: "gone" })]));
  assert.equal(r.json.code, "CATALOGUE_PAYLOAD_INVALID");
  assert.match(r.json.path, /entries\[0\]\.lifecycle/);
  assert.equal((await F.call(env, "GET", "/ai/catalogue/6.json")).status, 404);
  assert.equal((await F.call(env, "GET", "/ai/index.json")).json.catalogue.seq, 5);
});

test("R4 a lapse of a listed entry is stored; a retire of a listed entry is ADVISORY_BAD_MOVE", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  let r = await F.publishAdvisory(env, AC.adv(2, { entry_id: "fake-one" }, "lapse", { reason: "deprecation" }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const got = await F.call(env, "GET", "/ai/advisories/2.json");
  assert.equal(got.status, 200);
  assert.equal(got.json.kind, "lapse");
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "clear", { reason: "deprecation" }));
  assert.equal(r.json.code, "ADVISORY_BAD_MOVE");
  /* control */
  const env2 = F.makeEnv();
  await F.publishPayload(env2, F.payloadOf(1));
  r = await F.publishAdvisory(env2, AC.adv(2, { entry_id: "fake-one" }, "retire", { reason: "deprecation" }));
  assert.equal(r.json.code, "ADVISORY_BAD_MOVE");
  r = await F.publishAdvisory(env2, AC.adv(1, { entry_id: "fake-one" }, "lapse", { reason: "deprecation" }));
  assert.equal(r.json.code, "NOT_NEWER");
  r = await F.publishAdvisory(env2, AC.adv(3, { entry_id: "nobody" }, "lapse", { reason: "deprecation" }));
  assert.equal(r.json.code, "ADVISORY_BAD_MOVE");
});

test("R5 after a payload (7) and two advisories (8, 9) the index names 7 and lists 8 and 9; after payload 10 they are gone", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(7));
  await F.publishAdvisory(env, AC.adv(8, { entry_id: "fake-one" }, "watch", { reason: "canary_drift" }));
  await F.publishAdvisory(env, AC.adv(9, { entry_id: "fake-one" }, "lapse", { reason: "health" }));
  let idx = (await F.call(env, "GET", "/ai/index.json")).json;
  assert.equal(idx.catalogue.seq, 7);
  assert.deepEqual(idx.advisories.map((a) => a.seq), [8, 9]);
  assert.match(idx.catalogue.path, /^[a-z0-9._/-]+$/);
  assert.deepEqual(Object.keys(idx).sort(), ["advisories", "catalogue", "index_version"]);
  assert.deepEqual(Object.keys(idx.catalogue).sort(), ["armored", "bytes", "issued_at", "path", "schema_version", "seq", "sha256"]);
  for (const a of idx.advisories)
    assert.deepEqual(Object.keys(a).sort(), ["armored", "effective_at", "issued_at", "kind", "reason", "seq", "target"]);
  /* the seam: a team's copy (ai-catalogue's own receive) takes this index and the payload it names */
  const { cat } = await AC.world();
  const got = await cat.receive({ kind: "index", status: 200, body: JSON.stringify(idx), at: "2026-11-01T00:00:00Z", trigger: "manual" });
  assert.equal(got.ok, true, JSON.stringify(got));
  assert.deepEqual(got.advisories.map((a) => a.outcome), ["found", "found"]);
  const body = (await F.call(env, "GET", `/ai/${idx.catalogue.path}`)).bytes;
  const p = await cat.receive({ kind: "payload", status: 200, body, at: "2026-11-01T00:00:00Z", trigger: "manual" });
  assert.equal(p.ok, true, JSON.stringify(p));
  /* control: payload 10 (the lapsed entry listed again needs its own list decision, R7) */
  const ten = F.payloadOf(10);
  await F.decideAll(env, ten.entries, "list", "K9010");
  assert.equal((await F.publishPayload(env, ten, { decide: false })).status, 200);
  idx = (await F.call(env, "GET", "/ai/index.json")).json;
  assert.equal(idx.catalogue.seq, 10);
  assert.deepEqual(idx.advisories, []);
});

test("R6 list then hold leaves the entry undecided for publishing; a decision without a ruling is DECISION_NO_RULING", async () => {
  const env = F.makeEnv();
  const doc = F.payloadOf(1);
  await F.decideAll(env, doc.entries, "list");
  await F.decideAll(env, doc.entries, "hold");
  const r = await F.publishPayload(env, doc, { decide: false });
  assert.equal(r.json.code, "ENTRY_NOT_DECIDED");
  assert.equal(F.dump(env).decisions.length, 2, "append-only: both decisions kept");
  /* control */
  let d = await F.op(env, "decide", { entry_id: "fake-one", version: "2026-01-01", decision: "list" });
  assert.equal(d.json.code, "DECISION_NO_RULING");
  d = await F.op(env, "decide", { entry_id: "fake-one", version: "2026-01-01", decision: "list", ruling_ref: "ruling 5" });
  assert.equal(d.json.code, "DECISION_NO_RULING");
  d = await F.op(env, "decide", { entry_id: "fake-one", version: "2026-01-01", decision: "maybe", ruling_ref: "K1" });
  assert.equal(d.json.code, "ISSUER_BAD_REQUEST");
  assert.equal(F.dump(env).decisions.length, 2);
});

test("R7 a watch with the standing ref and canary_drift is stored; clear without its decision, other with only the standing ref, and a bogus reason are refused", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  let r = await F.publishAdvisory(env, AC.adv(2, { entry_id: "fake-one" }, "watch", { reason: "canary_drift" }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "clear", { reason: "canary_drift" }));
  assert.equal(r.json.code, "ENTRY_NOT_DECIDED");
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "lapse", { reason: "other" }));
  assert.equal(r.json.code, "ENTRY_NOT_DECIDED");
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "lapse", { reason: "bogus" }));
  assert.equal(r.json.code, "ADVISORY_REASON_UNKNOWN");
  /* with Bob's own decision, naming the act's ruling, the widening and the `other` narrowing are accepted */
  await F.op(env, "decide", { entry_id: "fake-one", version: "2026-01-01", decision: "clear", ruling_ref: "K9100" });
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "clear", { reason: "other" }), { ruling_ref: "K9101" });
  assert.equal(r.json.code, "ENTRY_NOT_DECIDED", "a decision naming another ruling does not let it");
  r = await F.publishAdvisory(env, AC.adv(3, { entry_id: "fake-one" }, "clear", { reason: "other" }), { ruling_ref: "K9100" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  await F.op(env, "decide", { entry_id: "fake-one", version: "2026-01-01", decision: "lapse", ruling_ref: "K9102" });
  r = await F.publishAdvisory(env, AC.adv(4, { entry_id: "fake-one" }, "lapse", { reason: "other" }), { ruling_ref: "K9102" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  /* the narrowing ones are listed for reporting to Bob; the widening one is not */
  const since = (await F.op(env, "advisoriesSince", { seq: 0 })).json.advisories;
  assert.deepEqual(since.map((a) => [a.seq, a.kind, a.ruling_ref]), [[2, "watch", "K5481"], [4, "lapse", "K9102"]]);
  assert.deepEqual((await F.op(env, "advisoriesSince", { seq: 2 })).json.advisories.map((a) => a.seq), [4]);
});

test("R8 the seal-key document verifies container-side against the list; one signed by a key outside the list is not published", async () => {
  const env = F.makeEnv();
  const k = await F.sealKey();
  const r = await F.op(env, "publishSealKey", { doc: k.doc, armored: k.armored });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const got = await F.call(env, "GET", "/ai/seal-key.json");
  assert.equal(got.status, 200);
  const { verifyAiSealKey } = await import("../../bio-plane/src/sshsig.mjs");
  const { armored, ...doc } = got.json;
  assert.deepEqual(Object.keys(got.json).sort(), ["armored", "key_id", "not_after", "not_before", "public_key", "seq"]);
  assert.equal((await verifyAiSealKey(doc, armored, [AC.KEY.line])).ok, true);
  /* a second key; the first keeps its document */
  const k2 = await F.sealKey({ seq: 2, key_id: "seal-two" });
  assert.equal((await F.op(env, "publishSealKey", { doc: k2.doc, armored: k2.armored })).status, 200);
  assert.ok(env.DOCS.m.has("seal-keys/seal-test-1.json"));
  assert.equal((await F.call(env, "GET", "/ai/seal-key.json")).json.key_id, "seal-two");
  /* control */
  const bad = await F.sealKey({ key: AC.OTHER, seq: 3, key_id: "seal-bad" });
  const rb = await F.op(env, "publishSealKey", { doc: bad.doc, armored: bad.armored });
  assert.equal(rb.json.code, "UNKNOWN_KEY");
  assert.equal((await F.call(env, "GET", "/ai/seal-key.json")).json.key_id, "seal-two");
  /* nothing private was handed or held */
  assert.ok(!JSON.stringify(F.dump(env)).includes("PRIVATE"));
});

test("R20 with the store failing, the index answers 200 and a challenge answers ISSUER_UNAVAILABLE; healthy, both succeed", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  await F.register(env);
  const run = await F.runKey();
  env.STORE.broken = true;
  assert.equal((await F.call(env, "GET", "/ai/index.json")).status, 200);
  assert.equal((await F.call(env, "GET", "/ai/catalogue/1.json")).status, 200);
  for (const [m, path, body] of [["POST", "/ai/challenge", F.challengeBody(run)], ["POST", "/ai/bundle", "x"],
    ["GET", "/ai/result/AAAAAAAAAAAAAAAAAAAAAA", undefined], ["POST", "/ai/health", { report_version: 1 }]]) {
    const r = await F.call(env, m, path, { body });
    assert.equal(r.status, 503, path);
    assert.equal(r.json.code, "ISSUER_UNAVAILABLE", path);
    assert.equal(r.json.check, "C-158.7");
  }
  /* control */
  env.STORE.broken = false;
  assert.equal((await F.call(env, "GET", "/ai/index.json")).status, 200);
  assert.equal((await F.challenge(env, run)).status, 200);
});
