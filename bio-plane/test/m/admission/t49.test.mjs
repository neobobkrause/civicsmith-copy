/* admission: T49-18 — R27, a signed-in session's own window for the public reads it makes (D24; K1881, K3333), over
   the store side (`window.mjs`, a real SQLite database) and the Worker's gate (`doorWindowGate`), driven at the module's
   interface. The words of its refusal are R28's (words.test.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { A, O, W, doAnswer, refused, storeWorld, bridged, hex64, aik, cred, sha, founder, member } from "./harness.mjs";

const { OPS } = O;
const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);   /* a bucket's start */
const BUCKET = Math.floor(T0 / 600000);
const WRITES = Object.keys(OPS).filter((k) => OPS[k].classes === null && OPS[k].mutating !== false);
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);
const SRC = "203.0.113.21";
const SESSION_STATED = "at most 3000 requests from one signed-in session in any 10 minutes";
const SOURCE_STATED = "at most 300 requests from one source in any 10 minutes";

const reqOf = ({ address = SRC, token, query = "" } = {}) => {
  const headers = {};
  if (address !== null) headers["cf-connecting-ip"] = address;
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`https://plane.example/api${query}`, { method: "POST", headers });
};
const sessionRows = (w) => (w.a.flush(), w.sql.exec(`SELECT * FROM ${W.SESSION_WINDOW_TABLE} ORDER BY session, bucket`));
const total = (rows) => rows.reduce((n, r) => n + Number(r.count), 0);
const routes = (env) => env.calls.map((c) => c.route);
const gateOf = (env, token, op, extra = {}) => A.doorWindowGate({ req: reqOf({ token }), env, op, spec: OPS[op], doAnswer, ...extra });

test("R27 (store side): a session's own window — SESSION_WINDOW is frozen {limit: 3000, windowMs: 600000}, its stated sentence composed from the same constants; a request carrying a session's digest is counted in that window and never in its source's; at an estimate of 3000 or more it is refused counting nothing, with stated and retryAfter; the estimate slides as R21's does; rows hold the digest, the bucket and the count, never the token, and are dropped once both buckets have passed; a value that is no digest is counted by source; the table is declared with R21's classes", async () => {
  assert.deepEqual({ ...A.SESSION_WINDOW }, { limit: 3000, windowMs: 600000 });
  assert.ok(Object.isFrozen(A.SESSION_WINDOW));
  assert.equal(A.SESSION_WINDOW_STATED, SESSION_STATED);
  const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "bound-key-0123" } });
  assert.deepEqual(w.declared[0].entries.map((t) => t.name), [W.DOOR_WINDOW_TABLE, W.SESSION_WINDOW_TABLE]);
  for (const t of w.declared[0].entries)
    assert.deepEqual({ ...t, name: undefined }, { name: undefined, purge: "exempt", expunge: "none", export: "never", sight: "group",
                                                  derive: "stored", version_chain: false });
  assert.deepEqual(Object.keys(w.ops({})), ["doorwindow"], "still the one store-internal route");
  const token = hex64(), digest = sha(token), other = sha(hex64());
  const fp = await w.doorbell.sourceFingerprint(SRC);
  const ask = (session, now, address = SRC) => w.ops({ address, now, session }).doorwindow();
  for (let i = 0; i < 3000; i++) {
    const r = await ask(digest, T0 + i);
    if (i === 0 || i === 2999) assert.deepEqual(r, { source: fp, refused: false, window: "session" }, `request ${i + 1}`);
    else assert.equal(r.refused, false, `request ${i + 1}`);
  }
  for (let k = 0; k < 3; k++) {
    const r = await ask(digest, T0 + 1000);
    assert.equal(r.refused, true);
    assert.deepEqual([r.source, r.stated, r.window], [fp, SESSION_STATED, "session"]);
    assert.ok(Number.isInteger(r.retryAfter) && r.retryAfter >= 599 && r.retryAfter <= 602, String(r.retryAfter));
  }
  assert.deepEqual(sessionRows(w), [{ session: digest, bucket: BUCKET, count: 3000 }], "a refused request is not counted");
  assert.deepEqual(w.rows(), [], "the source's window is neither read nor written by the session's requests");
  /* another session is its own window; so is the same source's own count */
  assert.equal((await ask(other, T0 + 1000)).refused, false);
  assert.equal((await w.ops({ address: SRC, now: T0 + 1000 }).doorwindow()).refused, false);
  assert.deepEqual(w.rows().map((r) => [r.source, r.count]), [[fp, 1]]);
  /* sliding: at the next bucket's start the estimate is 3000, refused; halfway it is 1500, admitted */
  assert.equal((await ask(digest, T0 + 600000)).refused, true);
  assert.equal((await ask(digest, T0 + 900000)).refused, false);
  /* both buckets passed: every older row of either table is gone */
  assert.equal((await ask(other, T0 + 3 * 600000)).refused, false);
  assert.ok(sessionRows(w).every((r) => r.bucket >= BUCKET + 2), JSON.stringify(sessionRows(w)));
  /* what a row holds, and that the token is not in it */
  for (const r of sessionRows(w)) assert.deepEqual(Object.keys(r).sort(), ["bucket", "count", "session"]);
  const all = JSON.stringify(w.sql.exec(`SELECT * FROM ${W.SESSION_WINDOW_TABLE}`)) + JSON.stringify(w.rows());
  assert.equal(all.includes(token) || all.includes(SRC), false);
  /* controls: what is no digest is counted by source; count: false writes nothing */
  const before = JSON.stringify(sessionRows(w));
  for (const bad of ["", "abc", token.toUpperCase(), "g".repeat(64), digest + "0", 7, null, {}, [digest]]) {
    const r = await ask(bad, T0 + 3 * 600000);
    assert.equal(r.window, undefined, JSON.stringify(bad));
    assert.equal(r.refused, false);
  }
  assert.equal(JSON.stringify(sessionRows(w)), before, "the session's table is untouched by them");
  assert.ok(w.rows().some((r) => r.source === fp && r.count === 9), "all nine counted by source");
  const quiet = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "bound-key-0123" } });
  assert.deepEqual(await quiet.ops({ address: SRC, session: digest, count: false }).doorwindow(), { source: fp });
  assert.deepEqual([quiet.rows(), sessionRows(quiet)], [[], []]);
});

test("R27 (the gate): a public read presenting a live session — header or body — is counted in that session's window and not its source's: 400 signed-in page loads in 10 minutes, each making the public reads M-T49-4 measured (the shell's and Home's groupidentity, bootstrap and grouplanguages, 5), are admitted under one session from one source, and that source's window is not counted by them; the token goes only in the session lookup's header, the digest in the window's body", async () => {
  const t = hex64();
  const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
  const env = bridged(w, { sessions: { [t]: member("ann", []) } });
  const fp = await w.doorbell.sourceFingerprint(SRC);
  const LOAD = ["groupidentity", "bootstrap", "grouplanguages", "groupidentity", "bootstrap"];
  for (const op of LOAD) assert.deepEqual([OPS[op].classes, OPS[op].mutating], [null, false], `${op} is a public read`);
  for (let i = 0; i < 400; i++) {
    const now = T0 + i * 1499;   /* 400 loads across the 10 minutes */
    for (const op of LOAD) {
      const r = await gateOf(env, t, op, { now });
      assert.equal(r.refusal, undefined, `load ${i + 1} ${op}`);
      assert.equal(r.source, fp);
    }
  }
  assert.equal(total(sessionRows(w)), 2000);
  assert.deepEqual(w.rows(), [], "the source's window is not counted by them");
  assert.ok(2000 < A.SESSION_WINDOW.limit);
  /* where the token went: the lookup's header, never an address or a body */
  for (const c of env.calls) {
    assert.equal(c.href.includes(t), false);
    assert.equal(c.raw.includes(t), false);
  }
  const lookups = env.calls.filter((c) => c.route === "session"), counts = env.calls.filter((c) => c.route === "doorwindow");
  assert.equal(lookups.length, 2000);
  assert.ok(lookups.every((c) => c.headers["x-bio-session"] === t && c.method === "GET"));
  assert.ok(counts.every((c) => c.body.session === sha(t) && c.body.address === SRC && c.method === "POST"));
  /* the credential in the body, as the door hands it: the same window; and a header beside a body's other token wins */
  env.calls.length = 0;
  const viaBody = await A.doorWindowGate({ req: reqOf({}), env, op: "bootstrap", spec: OPS.bootstrap, doAnswer, now: T0,
                                           credential: A.presentedCredential({ body: { token: t } }) });
  assert.equal(viaBody.refusal, undefined);
  assert.equal(env.calls.filter((c) => c.route === "doorwindow").length, 1, "one count");
  assert.equal(env.calls.find((c) => c.route === "doorwindow").body.session, sha(t));
  assert.equal(total(sessionRows(w)), 2001);
  /* a page's own timer read is no activity: the door's mark, or the request's own, reaches the lookup */
  for (const [extra, query, expected] of [[{ background: true }, "", "1"], [{}, "?background=1", "1"], [{ background: false }, "?background=1", undefined], [{}, "", undefined]]) {
    env.calls.length = 0;
    await A.doorWindowGate({ req: reqOf({ token: t, query }), env, op: "groupidentity", spec: OPS.groupidentity, doAnswer, now: T0, ...extra });
    assert.equal(env.calls.find((c) => c.route === "session").params.background, expected, JSON.stringify([extra, query]));
  }
});

test("R27 (the limit): a session's request past SESSION_WINDOW.limit is refused 429 DOOR_RATE_LIMITED (C-38.9) with SESSION_WINDOW_STATED, retryAfter and minutes, before the op runs, counted nowhere; the same session's refusal does not close its source's window; it is counted in R22's tally as kind rate with country null", async () => {
  const t = hex64(), u = hex64();
  const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
  const env = bridged(w, { sessions: { [t]: member("ann", []), [u]: founder([]) } });
  for (let i = 0; i < A.SESSION_WINDOW.limit; i++) await w.ops({ address: SRC, now: T0 + i, session: sha(t) }).doorwindow();
  env.calls.length = 0;
  const r = await gateOf(env, t, "groupidentity", { now: T0 + 400 });
  const body = refused(r, 429, "DOOR_RATE_LIMITED", "C-38.9", [t, sha(t), SRC]);
  assert.equal(body.stated, SESSION_STATED);
  assert.equal(body.stated, A.SESSION_WINDOW_STATED);
  assert.ok(Number.isInteger(body.retryAfter) && body.retryAfter > 500 && body.retryAfter <= 602, String(body.retryAfter));
  assert.equal(body.minutes, Math.ceil(body.retryAfter / 60));
  assert.equal(body.translation, word("refusal.DOOR_RATE_LIMITED.session", { minutes: body.minutes }));
  assert.deepEqual(routes(env), ["session", "doorwindow"], "nothing of the op was asked");
  assert.deepEqual(sessionRows(w), [{ session: sha(t), bucket: BUCKET, count: 3000 }], "a refused request is not counted");
  assert.deepEqual(w.rows(), []);
  /* controls: another session, the founder's included, is admitted at once; so is the same source with no credential,
     and it is counted there */
  assert.equal((await gateOf(env, u, "groupidentity", { now: T0 + 400 })).refusal, undefined);
  assert.equal((await gateOf(env, undefined, "groupidentity", { now: T0 + 400 })).refusal, undefined);
  assert.deepEqual(w.rows().map((x) => x.count), [1]);
  /* R22: counted as a refused rate, no country: the credential names a member (DEC-166 (2)) */
  const withCountry = new Request("https://plane.example/api", { headers: { "cf-connecting-ip": SRC } });
  Object.defineProperty(withCountry, "cf", { value: { country: "NZ" } });
  assert.deepEqual(await A.securityTally({ op: "groupidentity", answer: r.refusal, presented: { token: t }, req: withCountry }),
                   { kind: "rate", country: null });
  assert.deepEqual(await A.securityTally({ op: "groupidentity", answer: r.refusal, presented: { token: null }, req: withCountry }),
                   { kind: "rate", country: "NZ" }, "control: a refusal that presents nothing is placed");
});

test("R27 (controls): everything but a live session's public read stays in its source's window — 301 anonymous requests from one source are refused at the 301st; an unknown 64-hex token, an ended or locked session, an `aik-` credential and each binding token are counted by source, as is a session the store could not be asked about; a signed-in session's enroll (and every mutating public op) is counted by source; a gated op is never counted", async () => {
  const live = hex64(), locked = hex64(), unknown = hex64();
  const sessions = { [live]: member("ann", []), [locked]: { ...member("bea", []), locked: true } };
  const ai = aik();
  const fresh = (extra = {}) => {
    const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
    const env = bridged(w, { sessions, creds: { [ai]: cred({}) }, ...extra });
    return { w, env };
  };
  /* 301 anonymous requests from one source: refused at the 301st */
  {
    const { w, env } = fresh();
    for (let i = 0; i < 300; i++) assert.equal((await gateOf(env, undefined, "groupidentity", { now: T0 + i })).refusal, undefined, `request ${i + 1}`);
    const body = refused(await gateOf(env, undefined, "groupidentity", { now: T0 + 300 }), 429, "DOOR_RATE_LIMITED", "C-38.9", [SRC]);
    assert.equal(body.stated, SOURCE_STATED);
    assert.deepEqual([sessionRows(w), w.rows().map((r) => r.count)], [[], [300]]);
    /* a live session from the same source is then admitted: its reads are in its own window */
    assert.equal((await gateOf(env, live, "groupidentity", { now: T0 + 301 })).refusal, undefined);
    assert.equal(total(sessionRows(w)), 1);
  }
  /* each is counted by source, 300 admitted and the 301st refused; the session's table stays empty */
  for (const [name, of] of [["an unknown 64-hex token", () => unknown], ["a locked session", () => locked], ["an aik- credential", () => ai],
                            ["ADMIN_TOKEN", (e) => e.ADMIN_TOKEN], ["PROBE_TOKEN", (e) => e.PROBE_TOKEN], ["DAEMON_TOKEN", (e) => e.DAEMON_TOKEN],
                            ["the retired MEMBER_TOKEN", (e) => e.MEMBER_TOKEN], ["a malformed token", () => "not-a-token"]]) {
    const { w, env } = fresh();
    const token = of(env);
    env.calls.length = 0;
    await gateOf(env, token, "bootstrap", { now: T0 - 5 * 600000 });
    if (/binding|TOKEN/.test(name)) assert.deepEqual(routes(env), ["doorwindow"], `${name}: no session looked up for a binding`);
    for (let i = 0; i < 300; i++) assert.equal((await gateOf(env, token, "bootstrap", { now: T0 + i })).refusal, undefined, `${name} ${i + 1}`);
    refused(await gateOf(env, token, "bootstrap", { now: T0 + 300 }), 429, "DOOR_RATE_LIMITED", "C-38.9", [token]);
    assert.deepEqual(sessionRows(w), [], name);
    assert.deepEqual(w.rows().filter((r) => r.bucket === BUCKET).map((r) => r.count), [300], name);
  }
  /* a signed-in session's mutating public op (enroll, and every other): the session is not even looked up */
  {
    const { w, env } = fresh();
    assert.ok(WRITES.includes("enroll") && WRITES.length >= 5, "the mutating public ops");
    for (const op of WRITES) {
      env.calls.length = 0;
      const r = await gateOf(env, live, op, { now: T0 });
      assert.equal(r.refusal, undefined, op);
      assert.deepEqual(routes(env), ["doorwindow"], `${op}: counted by source, the session never read`);
      assert.equal("session" in env.calls[0].body, false, op);
    }
    assert.deepEqual(sessionRows(w), []);
    const { w: w2, env: e2 } = fresh();
    for (let i = 0; i < 300; i++) assert.equal((await gateOf(e2, live, "enroll", { now: T0 + i })).refusal, undefined);
    assert.equal(refused(await gateOf(e2, live, "enroll", { now: T0 + 300 }), 429, "DOOR_RATE_LIMITED", "C-38.9").stated, SOURCE_STATED);
    assert.deepEqual(sessionRows(w2), []);
  }
  /* a spec that does not say mutating: false is counted by source */
  {
    const { w, env } = fresh();
    assert.equal((await A.doorWindowGate({ req: reqOf({ token: live }), env, spec: { classes: null }, doAnswer, now: T0 })).refusal, undefined);
    assert.deepEqual([sessionRows(w), w.rows().map((r) => r.count)], [[], [1]]);
  }
  /* the store did not answer the session lookup: counted by source, named in the log by correlation id only */
  {
    const corr = "0123abcd-0123-4567-89ab-0123456789ab";
    const { w, env } = fresh({ answer: (c) => (c.route === "session" ? new Response(JSON.stringify({ ok: false, correlation: corr }), { status: 500 }) : null) });
    const warned = [], realWarn = console.warn;
    console.warn = (...a) => warned.push(a.join(" "));
    try {
      const r = await gateOf(env, live, "groupidentity", { now: T0 });
      assert.equal(r.refusal, undefined);
      assert.equal(r.source, await w.doorbell.sourceFingerprint(SRC));
    } finally { console.warn = realWarn; }
    assert.deepEqual([sessionRows(w), w.rows().map((r) => r.count)], [[], [1]]);
    assert.equal(warned.length, 1);
    assert.ok(warned[0].includes(corr));
    assert.doesNotMatch(warned[0], new RegExp(`${live}|${SRC}`));
  }
  /* a window that cannot be read admits the request (the session's, as the source's, fails open) */
  {
    const corr = "0123abcd-0123-4567-89ab-0123456789ab";
    const { env } = fresh({ answer: (c) => (c.route === "doorwindow" ? new Response(JSON.stringify({ ok: false, correlation: corr }), { status: 500 }) : null) });
    const warned = [], realWarn = console.warn;
    console.warn = (...a) => warned.push(a.join(" "));
    try { assert.deepEqual(await gateOf(env, live, "groupidentity", { now: T0 }), { source: null }); } finally { console.warn = realWarn; }
    assert.equal(warned.length, 1);
    assert.ok(warned[0].includes(corr));
    assert.doesNotMatch(warned[0], new RegExp(`${live}|${sha(live)}|${SRC}`));
  }
  /* a gated op is never counted or refused by either window */
  {
    const { w, env } = fresh();
    for (const op of GATED) assert.deepEqual(await gateOf(env, live, op, { now: T0 }), { source: null }, op);
    assert.equal(env.calls.length, 0);
    assert.deepEqual([sessionRows(w), w.rows()], [[], []]);
  }
});
