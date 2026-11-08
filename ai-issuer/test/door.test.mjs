/* ai-issuer — the operator door, health counts and the invariants (R19, R21–R24, R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as F from "./fixture.mjs";

const { AC } = F;

test("R19 an act without the credential is refused with nothing done and appends only its refusal; with it the act is audited with by", async () => {
  const env = F.makeEnv();
  for (const credential of [null, "wrong-credential-0000", F.OPERATOR + "x"]) {
    const r = await F.op(env, "decide", { entry_id: "fake-one", version: "v1", decision: "list", ruling_ref: "K1" }, { credential });
    assert.equal(r.status, 401);
    assert.equal(r.json.code, "ISSUER_NOT_AUTHORISED");
    assert.deepEqual(Object.keys(r.json).sort(), ["check", "code", "ok", "word"], "no hint which part failed");
  }
  assert.equal(F.dump(env).decisions.length, 0);
  assert.deepEqual(F.dump(env).audit.map((a) => [a.act, a.by, a.outcome]),
    [["decide", null, "ISSUER_NOT_AUTHORISED"], ["decide", null, "ISSUER_NOT_AUTHORISED"], ["decide", null, "ISSUER_NOT_AUTHORISED"]]);
  /* every act named is behind it */
  for (const act of F.S.OPERATOR_ACTS) assert.equal((await F.op(env, act, {}, { credential: null })).status, 401, act);
  /* an environment with no credential set refuses everyone */
  const none = F.makeEnv({ OPERATOR_CREDENTIAL_SHA256: undefined });
  assert.equal((await F.op(none, "advisoriesSince", { seq: 0 })).status, 401);
  /* control */
  const before = F.dump(env).audit.length;
  const ok = await F.op(env, "decide", { entry_id: "fake-one", version: "v1", decision: "list", ruling_ref: "K1" });
  assert.equal(ok.status, 200);
  const last = F.dump(env).audit.at(-1);
  assert.equal(F.dump(env).audit.length, before + 1);
  assert.deepEqual([last.act, last.by, last.ruling_ref, last.outcome], ["decide", "operator-test", "K1", "ok"]);
  /* the credential is never printed, logged, stored or returned */
  assert.ok(!JSON.stringify(F.dump(env)).includes(F.OPERATOR));
  assert.ok(!F.td.decode(ok.bytes).includes(F.OPERATOR));
});

test("R21 the Worker's declared bindings name no account but Civicsmith's; a binding to another account fails the deploy check", async () => {
  const { deployCheck, readJsonc, CIVICSMITH_ACCOUNT } = await import("../src/deploy-check.mjs");
  const config = readJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.account_id, CIVICSMITH_ACCOUNT);
  assert.deepEqual(deployCheck(config), []);
  /* controls */
  assert.deepEqual(deployCheck({ ...config, account_id: "0".repeat(32) }), ["account_id", `account:${"0".repeat(32)}`]);
  assert.ok(deployCheck({ ...config, services: [{ binding: "TEAM", service: "bio-plane" }] }).includes("binding:services"));
  assert.ok(deployCheck({ ...config, r2_buckets: [...config.r2_buckets, { binding: "X", bucket_name: "y", jurisdiction: "eu" }] }).includes("r2_buckets"));
  assert.ok(deployCheck({ ...config, durable_objects: { bindings: [{ name: "STORE", class_name: "IssuerStore", script_name: "other" }] } })
    .includes("durable_objects"));
  assert.ok(deployCheck({ ...config, vars: { CATALOGUE_KEYS: "ssh-ed25519 AAAA x" } }).includes("var:CATALOGUE_KEYS"));
  assert.ok(deployCheck({ ...config, vars: { SEAL_PRIVATE_KEY: "x" } }).includes("var:SEAL_PRIVATE_KEY"));
});

test("R22 a nonce issued at a pinned instant expires at that instant plus its life; with no pin the wall clock is read", async () => {
  const env = F.makeEnv();
  await F.register(env);
  const ch = (await F.challenge(env, await F.runKey())).json;
  assert.equal(ch.issued_at, F.iso(F.T0));
  assert.equal(Date.parse(ch.expires_at), F.T0 + F.P.PARAMS.NONCE_LIFE_MS);
  assert.equal(F.W.nowOf({}, 1234), 1234);
  assert.equal(F.W.nowOf({ BIO_NOW_MS: "5678" }), 5678);
  /* control */
  const free = F.makeEnv({ BIO_NOW_MS: undefined });
  await F.register(free);
  const before = Date.now();
  const c2 = (await F.challenge(free, await F.runKey())).json;
  const issued = Date.parse(c2.issued_at);
  assert.ok(issued >= Math.floor(before / 1000) * 1000 && issued <= Date.now(), c2.issued_at);
});

test("R23 each code is answered with its row and no English sentence; a code with no row fails", async () => {
  const codes = ["ENTRY_NOT_DECIDED", "DECISION_NO_RULING", "ISSUER_DIGEST_UNKNOWN", "ISSUER_RATE_LIMITED", "ISSUER_BAD_REQUEST",
    "ISSUER_NOT_AUTHORISED", "ISSUER_UNAVAILABLE", "NONCE_UNKNOWN", "NONCE_EXPIRED", "NONCE_REUSED", "IMAGE_DIGEST_MISMATCH",
    "BUNDLE_TOO_LARGE", "BUNDLE_UNREADABLE", "RESULT_REFUSED"];
  const borrowed = ["NOT_NEWER", "DIGEST_MISMATCH", "ADVISORY_BAD_MOVE", "ADVISORY_REASON_UNKNOWN", "CATALOGUE_PAYLOAD_INVALID"];
  assert.deepEqual(Object.keys(F.C.ISSUER_CHECKS).sort(), [...codes].sort());
  const { CATALOGUE_CHECKS } = await import("../../bio-plane/src/ai-catalogue/checks.mjs");
  for (const c of codes) assert.match(F.C.ISSUER_CHECKS[c].check, /^C-158\.\d+$/);
  for (const c of borrowed) assert.deepEqual(F.C.rowOf(c), CATALOGUE_CHECKS[c]);
  assert.equal(new Set(codes.map((c) => F.C.ISSUER_CHECKS[c].check)).size, codes.length);
  /* each answered through the door, with its row */
  const env = F.makeEnv({ NONCE_OUTSTANDING_MAX: "1", BUNDLE_MAX_BYTES: "100000" });
  const answers = [];
  const keep = (r) => { answers.push(r.json); return r; };
  const run = await F.runKey();
  keep(await F.op(env, "decide", { entry_id: "e", version: "v", decision: "list" }));
  keep(await F.challenge(env, run));
  keep(await F.op(env, "decide", {}, { credential: null }));
  keep(await F.op(env, "decide", { entry_id: "E E", version: "v", decision: "list", ruling_ref: "K1" }));
  keep(await F.publishPayload(env, F.payloadOf(2), { decide: false }));
  await F.publishPayload(env, F.payloadOf(3));
  keep(await F.publishPayload(env, F.payloadOf(1)));
  keep(await F.publishAdvisory(env, AC.adv(4, { entry_id: "fake-one" }, "retire", { reason: "deprecation" })));
  keep(await F.publishAdvisory(env, AC.adv(4, { entry_id: "fake-one" }, "lapse", { reason: "bogus" })));
  const pub = await AC.publish(F.payloadOf(5));
  keep(await F.op(env, "publishCatalogue", { bytes: pub.body + " ", statement: pub.statement, armored: pub.armored }));
  const invalid = F.payloadOf(5, [AC.entry("fake-one", { lifecycle: "gone" })]);
  keep(await F.publishPayload(env, invalid));
  await F.register(env);
  const ch = (await F.challenge(env, run)).json;
  keep(await F.challenge(env, run));
  keep(await F.send(env, await F.bundle(ch, run, { digest: `sha256:${"e".repeat(64)}` })));
  keep(await F.send(env, await F.bundle(ch, run)));
  keep(await F.send(env, await F.bundle({ challenge_id: "ch-x", nonce: "n" }, run)));
  keep(await F.send(env, F.te.encode("x")));
  keep(await F.send(env, new Uint8Array(100001)));
  F.at(env, F.T0 + F.P.PARAMS.NONCE_LIFE_MS + 1);
  const c2 = (await F.challenge(env, run)).json;
  F.at(env, F.T0 + 2 * F.P.PARAMS.NONCE_LIFE_MS + 2);
  keep(await F.send(env, await F.bundle(c2, run)));
  keep(await F.op(env, "recordResult", { receipt_id: "rcp-none", ...F.resultArgs() }));
  env.STORE.broken = true;
  keep(await F.challenge(env, run));
  const seen = new Map();
  for (const a of answers) {
    const code = a.code ?? a.reason;
    assert.ok(code, JSON.stringify(a));
    assert.ok(!Object.values(a).some((v) => typeof v === "string" && /[a-z]+ [a-z]+ [a-z]+/i.test(v) && !v.startsWith("-----")),
      `no sentence in ${JSON.stringify(a)}`);
    const row = F.C.rowOf(code);
    assert.equal(a.check, row.check, code);
    assert.equal(a.word, row.word, code);
    seen.set(code, true);
  }
  for (const c of [...codes, ...borrowed]) assert.ok(seen.has(c), `answered: ${c}`);
  /* control */
  assert.throws(() => F.C.refusal("NO_SUCH_CODE"), /no row/);
});

test("R24 a sentinel in every field of a request, bundle and manifest appears in no row except where R14 allows; with agree_named the name is the one stored sentinel", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  await F.register(env);
  const S = "SENTINEL-7f3a";
  const headers = { "user-agent": S, "cf-connecting-ip": "192.0.2.77", "x-forwarded-for": S, cookie: S, "x-team": S };
  const run = await F.runKey();
  const ch = (await F.call(env, "POST", "/ai/challenge", { body: F.challengeBody(run, { declared_model: S }), headers })).json;
  await F.call(env, "POST", "/ai/bundle", { body: await F.bundle(ch, run, { extra: { declared_team: S } }), headers });
  await F.call(env, "POST", "/ai/health", { headers, body: { report_version: 1, day: "2026-10-31",
    entries: [{ entry_id: "fake-one", calls: 1, refused: 0, silent: 0, errors: {} }] } });
  await F.call(env, "GET", "/ai/index.json", { headers });
  const all = JSON.stringify(F.dump(env));
  assert.ok(!all.includes(S));
  assert.ok(!all.includes("192.0.2.77"));
  assert.deepEqual([...F.S.TABLES].sort(), ["audit", "bundles", "challenges", "decisions", "digests", "documents", "health", "results"]);
  /* control */
  const c2 = (await F.challenge(env, run)).json;
  await F.call(env, "POST", "/ai/bundle", { body: await F.bundle(c2, run, { extra: { declared_team: S, agree_named: true } }), headers });
  const stored = JSON.stringify(F.dump(env));
  assert.equal(stored.split(S).length - 1, 1, "the agreed name is stored once, and nothing else of the sentinel");
});

test("R26 two reports for one entry and day sum into one row with reports 2 and no other row of either; a report whose refused exceeds its calls adds nothing", async () => {
  const env = F.makeEnv();
  await F.publishPayload(env, F.payloadOf(1));
  const day = "2026-10-30";
  const rep = (e) => ({ report_version: 1, day, entries: [{ entry_id: "fake-one", calls: 10, refused: 1, silent: 2, errors: { timeout: 1 }, ...e }] });
  const before = F.dump(env);
  assert.equal((await F.call(env, "POST", "/ai/health", { body: rep({}) })).status, 200);
  assert.equal((await F.call(env, "POST", "/ai/health", { body: { ...rep({ calls: 5, refused: 0, silent: 0, errors: { rate_limit: 2 } }),
    entries: [rep({ calls: 5, refused: 0, silent: 0, errors: { rate_limit: 2 } }).entries[0], { entry_id: "not-published", calls: 3, refused: 0, silent: 0 }] } })).status, 200);
  const h = (await F.op(env, "healthFor", { entry_id: "fake-one", from: "2026-10-01", to: "2026-10-31" })).json.days;
  assert.deepEqual(h, [{ day, reports: 2, calls: 15, refused: 1, silent: 2, errors: { rate_limit: 2, timeout: 1 } }]);
  const after = F.dump(env);
  const added = after.health.filter((r) => r.entry_id !== "*");
  assert.equal(added.length, 1, "one aggregate row per (entry, day); the unpublished entry is dropped");
  for (const t of ["challenges", "bundles", "results", "decisions", "digests", "documents"]) assert.equal(after[t].length, before[t].length, t);
  assert.ok(!JSON.stringify(after).includes("not-published"));
  /* controls */
  const n = JSON.stringify(F.dump(env).health);
  for (const [body, field] of [[rep({ refused: 11 }), "entries[0].calls"], [rep({ calls: -1 }), "entries[0].calls"],
    [{ ...rep({}), day: "2026-11-01" }, "day"], [{ ...rep({}), day: "2026-10-01" }, "day"], [{ ...rep({}), report_version: 2 }, "report_version"],
    [{ ...rep({}), team: "x" }, "team"]]) {
    const r = await F.call(env, "POST", "/ai/health", { body });
    assert.equal(r.json.code, "ISSUER_BAD_REQUEST");
    assert.equal(r.json.field, field);
  }
  const big = await F.call(env, "POST", "/ai/health", { body: "x".repeat(F.P.PARAMS.HEALTH_MAX_BYTES + 1) });
  assert.equal(big.json.field, "size");
  assert.equal(JSON.stringify(F.dump(env).health), n, "a malformed report adds nothing");
  const capped = F.makeEnv({ HEALTH_DAILY_MAX: "1" });
  await F.publishPayload(capped, F.payloadOf(1));
  assert.equal((await F.call(capped, "POST", "/ai/health", { body: rep({}) })).status, 200);
  const r = await F.call(capped, "POST", "/ai/health", { body: rep({}) });
  assert.equal(r.status, 429);
  assert.equal(r.json.code, "ISSUER_RATE_LIMITED");
});

test("R17 RESULT_ACTIVE_MONTHS is ai-catalogue's value, so one value serves both", async () => {
  const cat = await import("../../bio-plane/src/ai-catalogue/index.mjs");
  assert.equal(F.P.PARAMS.RESULT_ACTIVE_MONTHS, cat.RESULT_ACTIVE_MONTHS);
});
