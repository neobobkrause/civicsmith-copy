/* ai-issuer — challenges, digests and bundles (R9–R15), at the Worker's interface. Bundles are built by ai-gate's own
 * bundle code with a throwaway run key (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as F from "./fixture.mjs";

test("R9 a released digest answers a nonce recorded with its provider and plan; an unreleased digest is refused and no two nonces are equal", async () => {
  const env = F.makeEnv();
  await F.register(env);
  const run = await F.runKey();
  const nonces = new Set();
  for (let i = 0; i < 5; i++) {
    const r = await F.challenge(env, run, { declared_model: "fake-model-x" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(Object.keys(r.json).sort(), ["bank_version", "challenge_id", "expires_at", "issued_at", "nonce", "ok", "selection_seed"]);
    assert.ok(r.json.nonce.length * 6 >= F.P.PARAMS.NONCE_BITS);
    nonces.add(r.json.nonce);
  }
  assert.equal(nonces.size, 5);
  const row = F.dump(env).challenges[0];
  assert.equal(row.provider, "fakeco");
  assert.equal(row.plan, "fakeco-api");
  assert.equal(row.image_digest, F.DIGEST);
  /* the container's own check accepts it */
  const { verifyChallenge } = await import("../../ai-gate/src/verify.mjs");
  const ch = (await F.challenge(env, run)).json;
  assert.equal(verifyChallenge(ch, { bank_version: "bank-test", at: F.iso(F.T0 + 1000) }).ok, true);
  /* controls */
  let r = await F.challenge(env, run, { image_digest: `sha256:${"b".repeat(64)}` });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, "ISSUER_DIGEST_UNKNOWN");
  r = await F.challenge(env, run, { declared_team: "Team X" });
  assert.equal(r.json.code, "ISSUER_BAD_REQUEST");
  assert.equal(r.json.field, "declared_team");
  r = await F.challenge(env, run, { run_public_key: "not a key" });
  assert.equal(r.json.field, "run_public_key");
  assert.equal(F.dump(env).challenges.length, 6);
});

test("R10 the cap-plus-one request is refused and mints nothing; once expiries free the cap a request succeeds", async () => {
  const env = F.makeEnv({ NONCE_OUTSTANDING_MAX: "3", NONCE_DAILY_MAX: "50" });
  await F.register(env);
  const run = await F.runKey();
  for (let i = 0; i < 3; i++) assert.equal((await F.challenge(env, run)).status, 200);
  const r = await F.challenge(env, run);
  assert.equal(r.status, 429);
  assert.equal(r.json.code, "ISSUER_RATE_LIMITED");
  assert.equal(F.dump(env).challenges.length, 3);
  /* a nonce expires NONCE_LIFE after issue (R22's pinned clock) */
  const first = F.dump(env).challenges[0];
  assert.equal(first.expires_at - first.issued_at, F.P.PARAMS.NONCE_LIFE_MS);
  F.at(env, F.T0 + F.P.PARAMS.NONCE_LIFE_MS + 1000);
  assert.equal((await F.challenge(env, run)).status, 200);
  assert.equal(F.dump(env).challenges.length, 4, "expired nonces are kept as rows");
  /* the daily cap */
  const env2 = F.makeEnv({ NONCE_OUTSTANDING_MAX: "50", NONCE_DAILY_MAX: "2" });
  await F.register(env2);
  await F.challenge(env2, run); await F.challenge(env2, run);
  assert.equal((await F.challenge(env2, run)).json.code, "ISSUER_RATE_LIMITED");
  F.at(env2, F.T0 + F.DAY);
  assert.equal((await F.challenge(env2, run)).status, 200);
});

test("R11 a registered digest passes the challenge, a withdrawn one fails; a malformed digest is refused", async () => {
  const env = F.makeEnv();
  const run = await F.runKey();
  assert.equal((await F.challenge(env, run)).json.code, "ISSUER_DIGEST_UNKNOWN");
  await F.register(env);
  assert.equal((await F.challenge(env, run)).status, 200);
  assert.equal((await F.op(env, "withdrawDigest", { image_digest: F.DIGEST, ruling_ref: "K9003" })).status, 200);
  assert.equal((await F.challenge(env, run)).json.code, "ISSUER_DIGEST_UNKNOWN");
  assert.equal(F.dump(env).digests.length, 2, "append-only");
  /* control */
  for (const d of ["sha256:ABC", `sha256:${"A".repeat(64)}`, "a".repeat(64), `sha512:${"a".repeat(64)}`]) {
    const r = await F.register(env, d);
    assert.equal(r.json.code, "ISSUER_BAD_REQUEST");
    assert.equal(r.json.field, "image_digest");
  }
  assert.equal((await F.op(env, "registerDigest", { image_digest: F.DIGEST, release: "1" })).json.code, "DECISION_NO_RULING");
});

test("R12 a well-formed bundle from a throwaway run key answers verified_envelope; a reused nonce, an unissued nonce, a changed manifest character and an unknown digest do not", async () => {
  const env = F.makeEnv();
  await F.register(env);
  const run = await F.runKey();
  const ch = (await F.challenge(env, run)).json;
  const bytes = await F.bundle(ch, run);
  let r = await F.send(env, bytes);
  assert.equal(r.json.status, "verified_envelope", JSON.stringify(r.json));
  /* a reused nonce */
  r = await F.send(env, bytes);
  assert.equal(r.json.status, "rejected");
  assert.equal(r.json.reason, "NONCE_REUSED");
  /* an unissued nonce */
  const ch2 = (await F.challenge(env, run)).json;
  r = await F.send(env, await F.bundle(ch2, run, { nonce: "A".repeat(22) }));
  assert.equal(r.json.reason, "NONCE_UNKNOWN");
  assert.equal(r.json.status, "rejected");
  r = await F.send(env, await F.bundle({ challenge_id: "ch-none", nonce: ch2.nonce }, run));
  assert.equal(r.json.reason, "NONCE_UNKNOWN");
  /* a changed manifest character, after signing */
  r = await F.send(env, await F.bundle(ch2, run, { edit: (t) => t.replace("\"region\":null", "\"region\":\"zz\"") }));
  assert.equal(r.json.status, "unverified");
  assert.equal(r.json.reason, "BAD_SIGNATURE");
  /* another run key than the one the nonce was issued against */
  const ch3 = (await F.challenge(env, run)).json;
  r = await F.send(env, await F.bundle(ch3, run, { signer: await F.runKey() }));
  assert.equal(r.json.reason, "UNKNOWN_KEY");
  /* an unknown digest (declared, not the challenge's) */
  const ch4 = (await F.challenge(env, run)).json;
  r = await F.send(env, await F.bundle(ch4, run, { digest: `sha256:${"c".repeat(64)}` }));
  assert.equal(r.json.reason, "IMAGE_DIGEST_MISMATCH");
  /* the challenge's digest withdrawn since */
  const ch5 = (await F.challenge(env, run)).json;
  await F.op(env, "withdrawDigest", { image_digest: F.DIGEST, ruling_ref: "K9003" });
  r = await F.send(env, await F.bundle(ch5, run));
  assert.equal(r.json.reason, "IMAGE_DIGEST_MISMATCH");
  await F.register(env);
  /* an expired nonce */
  const ch6 = (await F.challenge(env, run)).json;
  F.at(env, F.T0 + F.P.PARAMS.NONCE_LIFE_MS + 1);
  r = await F.send(env, await F.bundle(ch6, run));
  assert.equal(r.json.reason, "NONCE_EXPIRED");
  F.at(env, F.T0);
  /* an unreadable bundle, and a field outside the manifest schema */
  r = await F.send(env, F.te.encode("not a bundle"));
  assert.equal(r.json.reason, "BUNDLE_UNREADABLE");
  const ch7 = (await F.challenge(env, run)).json;
  r = await F.send(env, await F.bundle(ch7, run, { extra: { transcript: "x" } }));
  assert.equal(r.json.reason, "BUNDLE_UNREADABLE");
  assert.equal(r.json.field, "transcript");
  /* too large */
  const small = F.makeEnv({ BUNDLE_MAX_BYTES: "1000" });
  r = await F.send(small, new Uint8Array(1001));
  assert.equal(r.status, 413);
  assert.equal(r.json.reason, "BUNDLE_TOO_LARGE");
});

test("R13 each failure answers unverified or rejected and never verified_envelope; only a bundle passing every check does, with a token stored as its hash only", async () => {
  const env = F.makeEnv();
  await F.register(env);
  const run = await F.runKey();
  const seen = [];
  const ch = (await F.challenge(env, run)).json;
  const good = await F.send(env, await F.bundle(ch, run));
  assert.deepEqual(Object.keys(good.json).sort(), ["ok", "receipt_id", "result_token", "status"]);
  assert.equal(good.json.status, "verified_envelope");
  assert.ok(good.json.result_token.length * 6 >= F.P.PARAMS.NONCE_BITS);
  seen.push((await F.send(env, await F.bundle(ch, run))).json);
  const c2 = (await F.challenge(env, run)).json;
  seen.push((await F.send(env, await F.bundle(c2, run, { edit: (t) => t.replace("fakeco", "fakeca") }))).json);
  const c3 = (await F.challenge(env, run)).json;
  seen.push((await F.send(env, await F.bundle(c3, run, { digest: `sha256:${"d".repeat(64)}` }))).json);
  seen.push((await F.send(env, F.te.encode("bio-gate-bundle/1\n"))).json);
  for (const s of seen) {
    assert.ok(["unverified", "rejected"].includes(s.status), JSON.stringify(s));
    assert.notEqual(s.status, "verified_envelope");
    assert.ok(s.receipt_id);
    assert.ok(!/fail/i.test(s.status));
  }
  /* kept: the verified and the unverified ones, never the rejected; the token is held as its SHA-256 only */
  const rows = F.dump(env).bundles;
  assert.deepEqual(rows.map((b) => b.status).sort(), ["unverified", "unverified", "verified_envelope"]);
  assert.ok(!JSON.stringify(rows).includes(good.json.result_token));
  assert.ok(rows.some((b) => b.token_sha256 === F.sha(good.json.result_token)));
});

test("R14 a manifest with declared_team and no agree_named is stored without it; with agree_named the name is kept", async () => {
  const env = F.makeEnv();
  await F.register(env);
  const plain = await F.sentBundle(env, { extra: { declared_team: "Team Sentinel Alpha" } });
  assert.equal(plain.status, "verified_envelope");
  const named = await F.sentBundle(env, { extra: { declared_team: "Team Sentinel Beta", agree_named: true } });
  assert.equal(named.status, "verified_envelope");
  const rows = F.dump(env).bundles;
  const of = (id) => JSON.parse(rows.find((b) => b.receipt_id === id).manifest);
  assert.equal(of(plain.receipt_id).declared_team, undefined);
  assert.ok(!JSON.stringify(F.dump(env)).includes("Team Sentinel Alpha"));
  /* control */
  assert.equal(of(named.receipt_id).declared_team, "Team Sentinel Beta");
  assert.equal(of(named.receipt_id).agree_named, true);
});

test("R15 no export, binding or table of the Worker holds a private key; a planted private key in the environment is refused at start", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  const text = JSON.stringify(Object.fromEntries(Object.entries(F.W).map(([k, v]) => [k, typeof v === "function" ? String(v.name) : v])));
  assert.ok(!/PRIVATE KEY|BIOKEY-RAW1/.test(text));
  for (const f of readdirSync(new URL("../src/", import.meta.url))) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    assert.ok(!/importKey\([^)]*"(pkcs8|jwk)"/.test(src), f);
    assert.ok(!/openSealed|decrypt\(/.test(src), `${f} opens nothing`);
  }
  const wr = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.ok(!/PRIVATE|SIGNING/.test(wr.replace(/\/\/.*$/gm, "")));
  assert.equal(W_private(env), null);
  assert.ok(!/PRIVATE|BIOKEY/.test(JSON.stringify(F.dump(env))));
  /* control: a planted private key refuses every route, the public ones too */
  for (const plant of [{ SEAL_PRIVATE_KEY: "x" }, { SOMETHING: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc" },
    { AI_CATALOGUE_DEVELOPMENT_SIGNING_KEY: "y" }, { KEYJSON: JSON.stringify({ kty: "OKP", d: "abc" }) }]) {
    const bad = F.makeEnv(plant);
    const r = await F.call(bad, "GET", "/ai/index.json");
    assert.equal(r.status, 503, JSON.stringify(plant));
    assert.equal(r.json.code, "ISSUER_UNAVAILABLE");
    assert.equal((await F.call(bad, "POST", "/ai/challenge", { body: {} })).status, 503);
  }
});
const W_private = (env) => F.W.privateKeyHeld(env);
