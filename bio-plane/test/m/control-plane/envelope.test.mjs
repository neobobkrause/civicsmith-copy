/* control-plane: the envelope (R21–R25), the answer invariants (R30, R32, R33). Driven through `makeFetch(hooks)` and the
   exported envelope functions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, sha, hex64, aik, cred, refused, FORGED, QUERY_STAMPS } from "./harness.mjs";
import * as REVIEW_CHECKS from "../../../src/review/checks.mjs";
import * as CP_CHECKS from "../../../src/answer-envelope/checks.mjs";
import * as ADMISSION_CHECKS from "../../../src/admission/checks.mjs";
import { AiAccounts, AI_ACCOUNT_CHECKS } from "../../../src/ai-accounts/index.mjs";
import { aiScopeDeclaration, aiConfinementDeclaration } from "../../../src/admission/index.mjs";
const D = await import("../../../src/store-door/dispatch.mjs");

const { OPS, UNATTENDED_BY_DECISION } = O;
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);
const PUBLIC = Object.keys(OPS).filter((k) => OPS[k].classes === null);
const reply = (o, status = 200) => () => new Response(JSON.stringify(o), { status });

/* A broad drive: every op for several callers, with every stamp forged, plus a refusal of every kind. Answers returned. */
async function sweep(w) {
  const { env, S, A } = w;
  const out = [];
  const forged = Object.fromEntries(QUERY_STAMPS.map((k) => [k, FORGED]));
  for (const [token, params] of [[undefined, {}], [env.ADMIN_TOKEN, {}], [env.PROBE_TOKEN, { store: "bio" }], [env.DAEMON_TOKEN, {}],
                                 [S.ann, {}], [S.bare, {}], [A.ann, {}], [A.revoked, {}], [A.confined, { store: "bio" }]])
    for (const op of Object.keys(OPS)) {
      const r = await call(env, { op, token, params: { ...params, ...forged, draft: "D1" }, method: "POST", body: { password: "pw" } });
      out.push({ op, token, r });
    }
  for (const req of [{ op: "nosuchop" }, { op: "index", params: { store: "x" } }, { op: "knock", params: { store: "scratch" } },
                     { op: "aicredentialmint", token: S.ann, body: { writes: ["purge"] } },
                     { op: "aicredentialmint", token: S.ann, body: { writes: [], confinedTo: "bio" } },
                     { op: "claim", body: { bootstrapToken: "no" } }])
    out.push({ op: req.op, r: await call(env, { method: "POST", body: {}, ...req }) });
  return out;
}

test("R21: every answer is JSON with access-control-allow-origin *; a forwarded answer is the handler's with store and tokenClass added and its HTTP status kept", async () => {
  const w = world();
  for (const { op, r } of await sweep(w)) {
    assert.match(r.headers.get("content-type") ?? "", /^application\/json/, op);
    assert.equal(r.headers.get("access-control-allow-origin"), "*", op);
    assert.notEqual(r.json, null, `${op}: ${r.text.slice(0, 80)}`);
  }
  /* the forward: the handler's body, two fields added, the status kept */
  for (const [status, body] of [[200, { ok: true, result: { a: 1 } }], [207, { ok: true, result: [1, 2], extra: "kept" }],
                                [404, { ok: true, result: { ok: false, reason: "NO_SUCH_BUNDLE" } }]]) {
    const f = world({ answer: (c) => (c.route === "index" ? reply(body, status)() : null) });
    for (const [token, params, st, tc] of [[f.env.ADMIN_TOKEN, {}, "bio", "admin"], [f.env.PROBE_TOKEN, {}, "scratch", "probe"],
                                           [f.S.ann, { store: "scratch" }, "scratch", "member"], [f.A.ann, {}, "bio", "ai"]]) {
      const r = await call(f.env, { op: "index", token, params });
      assert.equal(r.status, status);
      assert.deepEqual(r.json, { ...M.dec49Attach(JSON.parse(JSON.stringify(body))), store: st, tokenClass: tc });
    }
  }
});

test("R22: a refusal (ok:false, at the top level or under result) whose reason or code has a catalogue row gains code, check and translation where absent; only those two levels are decorated", () => {
  const row = (code) => { const o = M.dec49Attach({ ok: false, reason: code }); return [o.code, o.check, typeof o.translation]; };
  assert.deepEqual(row("NOT_AUTHENTICATED"), ["NOT_AUTHENTICATED", "C-38.1", "string"]);
  /* a module's own checks file is a catalogue row too */
  const fam = Object.entries(REVIEW_CHECKS).find(([k]) => /_CHECKS$/.test(k))[1];
  const [code, r] = Object.entries(fam).find(([, v]) => v.translation);
  assert.deepEqual(row(code), [code, r.check, "string"]);
  assert.equal(M.dec49Attach({ ok: false, reason: code }).translation, r.translation);
  /* by `code` when there is no reason */
  assert.equal(M.dec49Attach({ ok: false, code: "CLASS_FORBIDDEN" }).check, "C-38.2");
  /* under result */
  const u = M.dec49Attach({ ok: true, result: { ok: false, reason: "SCOPE_REFUSED" } });
  assert.deepEqual([u.code, u.result.code, u.result.check], [undefined, "SCOPE_REFUSED", "C-38.6"]);
  /* never overwritten */
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "NOT_AUTHENTICATED", check: "C-0", translation: "mine", code: "X" }),
                   { ok: false, reason: "NOT_AUTHENTICATED", check: "C-0", translation: "mine", code: "X" });
  /* never invented, never on a success, never deeper than result */
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "NO_ROW_FOR_THIS_CODE" }), { ok: false, reason: "NO_ROW_FOR_THIS_CODE" });
  assert.deepEqual(M.dec49Attach({ ok: true, reason: "NOT_AUTHENTICATED" }), { ok: true, reason: "NOT_AUTHENTICATED" });
  assert.deepEqual(M.dec49Attach({ reason: "NOT_AUTHENTICATED" }), { reason: "NOT_AUTHENTICATED" });
  const deep = { ok: true, result: { ok: true, rows: [{ ok: false, reason: "NOT_AUTHENTICATED" }], sub: { ok: false, reason: "SCOPE_REFUSED" } } };
  assert.deepEqual(M.dec49Attach(JSON.parse(JSON.stringify(deep))), deep);
  assert.deepEqual(M.dec49Attach([{ ok: false, reason: "NOT_AUTHENTICATED" }]), [{ ok: false, reason: "NOT_AUTHENTICATED" }]);
});

test("R22: through the door — a forwarded store refusal under result, and the module's own top-level refusals, carry the row", async () => {
  const w = world({ answer: (c) => (c.route === "cite" ? reply({ ok: true, result: { ok: false, reason: code } })() : null) });
  const fam = Object.entries(REVIEW_CHECKS).find(([k]) => /_CHECKS$/.test(k))[1];
  const [code, row] = Object.entries(fam).find(([, v]) => v.translation);
  const r = await call(w.env, { op: "cite", token: w.env.ADMIN_TOKEN, method: "POST", body: {} });
  assert.deepEqual([r.json.result.code, r.json.result.check, r.json.result.translation], [code, row.check, row.translation]);
  assert.equal(r.json.code, undefined);
  /* a hook's answer through json() is decorated the same way */
  const hooks = { publicOp: async () => M.json({ ok: false, reason: "SCOPE_REFUSED" }, 403), gatedOp: async () => undefined };
  const h = await call(w.env, { op: "knock", hooks, method: "POST", body: {} });
  assert.deepEqual([h.status, h.json.check], [403, "C-38.6"]);
});

test("R22: every row a module holds in the files the door reads resolves to a row of that code — record-core's MINT_EXHAUSTED (C-59.6) among them, decorating a forwarded refusal", async () => {
  const { RECORD_CORE_CHECKS } = await import("../../../src/record-core/checks.mjs");
  assert.ok(M.CHECK_FAMILY_FILES.some(([, f]) => f.RECORD_CORE_CHECKS === RECORD_CORE_CHECKS), "record-core's checks.mjs is read");
  let rows = 0;
  for (const [, source] of M.CHECK_FAMILY_FILES)
    for (const [fam, table] of Object.entries(source)) {
      if (!/_CHECKS$/.test(fam) || !table || typeof table !== "object") continue;
      for (const [code, row] of Object.entries(table)) {
        if (!row || typeof row.translation !== "string" || !row.translation) continue;
        rows++;
        const got = M.dec49Row(code);
        assert.ok(got && typeof got.translation === "string" && got.translation, `${fam}.${code}`);
      }
    }
  assert.ok(rows > 100, String(rows));
  assert.deepEqual(M.dec49Row("MINT_EXHAUSTED"), { check: "C-59.6", translation: RECORD_CORE_CHECKS.MINT_EXHAUSTED.translation });
  const w = world({ answer: (c) => (c.route === "promote" ? reply({ ok: true, result: { ok: false, reason: "MINT_EXHAUSTED" } })() : null) });
  const r = await call(w.env, { op: "promote", token: w.env.ADMIN_TOKEN, method: "POST", body: {} });
  assert.deepEqual([r.json.result.code, r.json.result.check, r.json.result.translation],
                   ["MINT_EXHAUSTED", "C-59.6", RECORD_CORE_CHECKS.MINT_EXHAUSTED.translation]);
  /* negative control: a code no file holds is not decorated */
  assert.equal(M.dec49Row("NO_SUCH_CODE_ANYWHERE"), null);
});

test("R23: an answer that is not JSON carrying a boolean ok is 502 STORE_DID_NOT_ANSWER (C-69.2) naming the op, never an absence, refusal or success; a JSON ok:false is the store's own refusal, relayed with its status, code and sentence (R26's BAD_JSON among them)", async () => {
  /* doAnswer: `answered` is ok === true and nothing else; `refused` is ok === false below 500; everything else is silence */
  const ans = async (x) => M.doAnswer(x);
  for (const [result, status] of [[null, 200], [[], 200], [{}, 201], [0, 200], ["", 200], [{ ok: false }, 404]]) {
    const a = await ans(new Response(JSON.stringify({ ok: true, result }), { status }));
    assert.deepEqual([a.answered, a.refused, a.result, a.reply.status, a.reply.body], [true, undefined, result, status, { ok: true, result }]);
  }
  for (const [body, status] of [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                                [{ ok: false, error: "unknown op: nosuch" }, 400], [{ ok: false, error: "e" }, 200], [{ ok: false }, 499]]) {
    const a = await ans(new Response(JSON.stringify(body), { status }));
    assert.deepEqual(a, { answered: false, refused: true, result: undefined, reply: { status, body } });
  }
  for (const bad of [new Response("nope"), new Response(JSON.stringify({ ok: false, error: "Error: boom\n at x" }), { status: 500 }),
                     new Response(JSON.stringify({ ok: false }), { status: 503 }), new Response(JSON.stringify({ ok: "true" })),
                     new Response(JSON.stringify({ ok: "false" }), { status: 400 }), new Response(JSON.stringify({ ok: 0 }), { status: 400 }),
                     new Response(JSON.stringify({ result: 1 })), new Response(JSON.stringify([{ ok: false }]), { status: 400 }),
                     new Response("null"), new Response(""), Promise.reject(new Error("x")), null, undefined])
    assert.deepEqual(await ans(bad), { answered: false, result: undefined });
  const s = M.storeSilent("verify");
  assert.equal(s.status, 502);
  const sj = await s.json();
  assert.deepEqual([sj.ok, sj.reason, sj.code, sj.check, sj.op], [false, "STORE_DID_NOT_ANSWER", "STORE_DID_NOT_ANSWER", "C-69.2", "verify"]);
  assert.ok(sj.translation && sj.detail);
  /* through the door, for every relay the module makes itself */
  const relays = [
    ["reviewcopy", (w) => ({ op: "reviewcopy", params: { secret: "s" } }), false],
    ["reviewcomment", (w) => ({ op: "reviewcomment", params: { secret: "s" }, method: "POST", body: { text: "x" } }), false],
    ["statementack", (w) => ({ op: "statementack", params: { secret: "s", reason: "read" } }), false],   /* DEC-88: with its reason */
    ["casedrafts", (w) => ({ op: "casedrafts", token: w.S.ann }), false],
    ["aicredentialmint", (w) => ({ op: "aicredentialmint", token: w.S.ann, method: "POST", body: { writes: [] } }), "member"],
    ["reviewgrant", (w) => ({ op: "reviewgrant", token: w.S.founder, method: "POST", body: {} }), "admin"],
    ["claim", (w) => ({ op: "claim", method: "POST", body: { bootstrapToken: w.env.ADMIN_TOKEN, password: "pw" } }), false],
    /* the generic forward, for reads and acts, every kind of caller */
    ["index", (w) => ({ op: "index", token: w.env.ADMIN_TOKEN }), ["bio", "admin"]],
    ["index", (w) => ({ op: "index", token: w.A.ann }), ["bio", "ai"]],
    ["cite", (w) => ({ op: "cite", token: w.S.ann, method: "POST", body: {} }), ["bio", "member"]],
    ["monitor", (w) => ({ op: "monitor", token: w.env.DAEMON_TOKEN, method: "POST", body: {} }), ["bio", "daemon"]],
    ["list", (w) => ({ op: "list", token: w.env.PROBE_TOKEN }), ["scratch", "probe"]],
  ];
  const failures = [() => new Response("<html>"), reply({ ok: false, error: "Error: boom\n    at Store.fetch (store.mjs:1:1)" }, 500),
                    reply({ ok: "true", result: {} }), reply({ result: 1 }), () => new Response("")];
  for (const bad of failures)
    for (const [route, drive] of relays) {
      const w = world({ answer: (c) => (c.route === route ? bad() : null) });
      const r = await call(w.env, drive(w));
      refused(r, 502, "STORE_DID_NOT_ANSWER", "C-69.2");
      assert.equal(r.json.op, route);
      assert.doesNotMatch(r.text, /boom|store\.mjs|at Store/);
      assert.equal("token" in r.json || "secret" in r.json, false);
    }
  /* the store's own refusals: relayed at their status with their code and sentence, never read as a silence */
  const refusals = [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                    [{ ok: false, error: "unknown op: nosuch" }, 400], [{ ok: false, reason: "SOME_STORE_REASON", error: "said so" }, 409]];
  for (const [body, status] of refusals)
    for (const [route, drive, adds] of relays) {
      const w = world({ answer: (c) => (c.route === route ? reply(body, status)() : null) });
      const r = await call(w.env, drive(w));
      assert.equal(r.status, status, route);
      const extra = typeof adds === "string" ? { op: route, store: "bio", tokenClass: adds }
                  : Array.isArray(adds) ? { store: adds[0], tokenClass: adds[1] } : {};
      assert.deepEqual(r.json, { ...M.dec49Attach(JSON.parse(JSON.stringify(body))), ...extra }, route);
      assert.notEqual(r.json.reason, "STORE_DID_NOT_ANSWER", route);
    }
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const quietly = async (fn) => {
  const logged = [], was = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try { return { value: await fn(), logged }; } finally { console.error = was; }
};

test("R24: a public op relaying the store's answer answers the store's own status and its envelope, and R23 (502 STORE_DID_NOT_ANSWER) on a store failure, never 200 — claim through the door, and login, invitelook and enroll through the relay they answer by", async () => {
  const body = { bootstrapToken: null, password: "pw" };
  // fixtures-own: synthetic malformed or failing store replies: what the door must read as a silence (R23), no module's answer
  const failures = [() => new Response("<html>oops", { status: 200 }), reply({ ok: false, error: "x" }, 500),
                    reply({ ok: "true", result: {} }), reply({}, 200), reply({ ok: false, error: "x" }, 503),
                    () => { throw new Error("gone"); }];
  for (const bad of failures) {
    const w = world({ answer: (c) => (c.route === "claim" ? bad() : null) });
    const r = await call(w.env, { op: "claim", method: "POST", body: { ...body, bootstrapToken: w.env.ADMIN_TOKEN } });
    refused(r, 502, "STORE_DID_NOT_ANSWER", "C-69.2");
    assert.equal(r.json.op, "claim");
    for (const op of ["claim", "login", "invitelook", "enroll"]) {
      const x = await M.relayAnswer(Promise.resolve().then(bad), op);
      assert.equal(x.status, 502, op);
      const j = await x.json();
      assert.deepEqual([j.reason, j.op], ["STORE_DID_NOT_ANSWER", op]);
    }
  }
  /* an answer — a refusal the store returned inside ok:true included — is its envelope, at the store's status */
  for (const [result, status] of [[{ ok: true, claimed: true }, 200], [{ ok: false, reason: "WRONG_PASSWORD" }, 200],
                                  [{ ok: true, session: "s" }, 201]]) {
    const w = world({ answer: (c) => (c.route === "claim" ? reply({ ok: true, result }, status)() : null) });
    const r = await call(w.env, { op: "claim", method: "POST", body: { ...body, bootstrapToken: w.env.ADMIN_TOKEN } });
    assert.equal(r.status, status);
    assert.deepEqual([r.json.ok, r.json.result.ok, r.json.result.reason], [true, result.ok, result.reason]);
    for (const op of ["login", "invitelook", "enroll"]) {
      const x = await M.relayAnswer(reply({ ok: true, result }, status)(), op);
      assert.equal(x.status, status, op);
      assert.deepEqual((await x.json()).result, JSON.parse(JSON.stringify(result)));
    }
  }
  /* R23: the store's own refusal (ok:false) is relayed at its status with its code and sentence, never 502 */
  for (const [refusal, status] of [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                                   [{ ok: false, error: "unknown op: claim" }, 400]]) {
    const w = world({ answer: (c) => (c.route === "claim" ? reply(refusal, status)() : null) });
    const r = await call(w.env, { op: "claim", method: "POST", body: { ...body, bootstrapToken: w.env.ADMIN_TOKEN } });
    assert.equal(r.status, status);
    assert.deepEqual(r.json, M.dec49Attach(JSON.parse(JSON.stringify(refusal))));
    for (const op of ["login", "invitelook", "enroll"]) {
      const x = await M.relayAnswer(reply(refusal, status)(), op);
      assert.equal(x.status, status, op);
      assert.deepEqual(await x.json(), M.dec49Attach(JSON.parse(JSON.stringify(refusal))));
    }
  }
});

test("R24 (REC-52): a relayed store answer is read through the one envelope reader — relayAnswer answers exactly when doAnswer calls the reply answered, with doAnswer's result, at the reply's status", async () => {
  const bodies = [["<html>", 200], [JSON.stringify({ ok: true, result: { a: 1 } }), 200], [JSON.stringify({ ok: true, result: null }), 201],
                  [JSON.stringify({ ok: true }), 200], [JSON.stringify({ ok: "true", result: 1 }), 200], [JSON.stringify({ ok: false }), 500],
                  [JSON.stringify({ ok: false, reason: "BAD_JSON", detail: "d" }), 400], [JSON.stringify({ ok: false, error: "e" }), 200],
                  [JSON.stringify({ ok: 1, result: 2 }), 200], ["", 200], ["null", 200], [JSON.stringify([{ ok: true }]), 200]];
  for (const [text, status] of bodies) {
    const mk = () => new Response(text, { status });
    const read = await M.doAnswer(mk());
    const r = await M.relayAnswer(mk(), "login");
    const j = await r.json();
    if (read.answered) {
      assert.equal(r.status, status, text);
      assert.deepEqual(j, JSON.parse(JSON.stringify({ ok: true, result: read.result })), text);
    } else if (read.refused) {
      assert.equal(r.status, read.reply.status, text);
      assert.deepEqual(j, M.dec49Attach(JSON.parse(JSON.stringify(read.reply.body))), text);
    } else {
      assert.equal(r.status, 502, text);
      assert.deepEqual([j.reason, j.op], ["STORE_DID_NOT_ANSWER", "login"], text);
    }
  }
  /* a stub that rejects, and no reply at all, are silences too */
  for (const bad of [Promise.reject(new Error("x")), null, undefined])
    assert.equal((await M.relayAnswer(bad, "enroll")).status, 502);
});

test("R25: an error thrown in the Worker door is answered PLANE_INTERNAL_ERROR (C-69.3) with a correlation id, never the stack, message, path or line, and the stack is logged under the id", async () => {
  const SECRET = "SQLITE_CONSTRAINT secret-value /srv/plane/src/store.mjs:4242";
  const thrower = () => { throw new Error(SECRET); };
  /* the Worker: a throw anywhere in the door — a module's handler, a store stub that throws, a request it cannot read */
  const w0 = world();
  for (const [label, drive] of [
    ["gated hook", (w) => call(w.env, { op: "index", token: w.env.ADMIN_TOKEN,
      hooks: { publicOp: async () => M.json({}), gatedOp: thrower } })],
    ["public hook", (w) => call(w.env, { op: "knock", method: "POST", body: {},
      hooks: { publicOp: thrower, gatedOp: async () => undefined } })],
    ["store stub", (w) => { w.env.STORE.get = thrower; return call(w.env, { op: "index", token: w.env.ADMIN_TOKEN }); }]]) {
    /* (T47; R82) `/` reads nothing of the record since it answers the interface's page, so its old "page read" row has
       no read left to throw */
    const w = world();
    const { value: r, logged } = await quietly(() => drive(w));
    refused(r, 500, "PLANE_INTERNAL_ERROR", "C-69.3");
    assert.match(r.json.correlation, UUID, label);
    assert.equal(r.text.includes("secret-value") || r.text.includes("store.mjs") || r.text.includes("SQLITE"), false, label);
    assert.equal(r.text.includes(" at "), false, label);
    assert.equal(logged.length, 1, label);
    const line = JSON.parse(logged[0]);
    assert.deepEqual([line.event, line.correlation], ["PLANE_INTERNAL_ERROR", r.json.correlation], label);
    assert.match(line.stack, /secret-value/, label);
  }
  /* each throw gets its own id */
  const two = [];
  for (let i = 0; i < 2; i++) two.push((await quietly(() => call(w0.env, { op: "index", token: w0.S.ann,
    hooks: { publicOp: async () => M.json({}), gatedOp: thrower } }))).value.json.correlation);
  assert.match(two[0], UUID);
  assert.notEqual(two[0], two[1]);
});

test("R25: an error thrown in the record store's door is answered STORE_INTERNAL_ERROR (C-69.4) with a correlation id, never the stack, message, path or line, the stack logged under the id; the Worker's silence carries that id and nothing else of the store's answer", async () => {
  const SECRET = "SQLITE_CONSTRAINT secret-value /srv/plane/src/store.mjs:4242";
  const thrower = () => { throw new Error(SECRET); };
  /* the store: dispatch's catch, for a route that throws and for the route map itself throwing */
  for (const routes of [() => ({ boom: thrower }), thrower]) {
    const { value: res, logged } = await quietly(() => D.dispatch(new Request("http://do/boom", { method: "POST", body: "{}" }),
      { routes, membership: () => { throw new Error("not asked"); } }));
    assert.equal(res.status, 500);
    const text = await res.text();
    const j = JSON.parse(text);
    assert.deepEqual([j.ok, j.reason, j.code, j.check], [false, "STORE_INTERNAL_ERROR", "STORE_INTERNAL_ERROR", "C-69.4"]);
    assert.equal(j.translation, CP_CHECKS.DISPATCH_CHECKS.STORE_INTERNAL_ERROR.translation);
    assert.match(j.correlation, UUID);
    assert.deepEqual(Object.keys(j).sort(), ["check", "code", "correlation", "error", "ok", "reason", "translation"]);
    assert.equal(text.includes("secret-value") || text.includes("store.mjs") || text.includes(" at "), false);
    assert.equal(logged.length, 1);
    const line = JSON.parse(logged[0]);
    assert.deepEqual([line.event, line.correlation, line.op], ["STORE_INTERNAL_ERROR", j.correlation, "boom"]);
    assert.match(line.stack, /secret-value/);
  }
  /* the Worker relays the store's failure as R23's silence, carrying the store's correlation id and nothing else of it:
     through the forward and through a relay */
  const corr = crypto.randomUUID();
  const failed = { ok: false, error: SECRET, reason: "STORE_INTERNAL_ERROR", correlation: corr };
  const w = world({ answer: (c) => (c.route === "index" ? reply(failed, 500)() : null) });
  const r = await call(w.env, { op: "index", token: w.env.ADMIN_TOKEN });
  refused(r, 502, "STORE_DID_NOT_ANSWER", "C-69.2");
  assert.equal(r.json.correlation, corr);
  assert.equal(r.text.includes("secret-value"), false);
  const x = await M.relayAnswer(reply(failed, 500)(), "enroll");
  assert.deepEqual([x.status, (await x.json()).correlation], [502, corr]);
  /* negative controls: a correlation not from the store's own code, or not an id, is not carried */
  for (const bad of [{ ok: false, correlation: corr }, { ok: false, reason: "STORE_INTERNAL_ERROR", correlation: "x<script>" },
                     { ok: false, reason: "STORE_INTERNAL_ERROR", correlation: corr + "0" }]) {
    const v = world({ answer: (c) => (c.route === "index" ? reply(bad, 500)() : null) });
    const vr = await call(v.env, { op: "index", token: v.env.ADMIN_TOKEN });
    refused(vr, 502, "STORE_DID_NOT_ANSWER", "C-69.2");
    assert.equal(vr.json.correlation, undefined);
  }
});

test("R23, R25 (N349): every silence the door answers itself carries the correlation id doAnswer read from the store's internal error — the credential lookup, caseReader's reads, the session lookup, the mint and the grant — and a 500 without one carries no correlation key", async () => {
  const corr = crypto.randomUUID();
  const failed = { ok: false, error: "Error: boom /srv/store.mjs:1", reason: "STORE_INTERNAL_ERROR", correlation: corr };
  const sites = [
    ["aicredentiallook", "aicredentiallook", (w) => ({ op: "index", token: w.A.ann })],                              /* the front door */
    ["aicredentiallook", "aicredentiallook", (w) => ({ op: "reviewcopy", token: w.A.ann, params: { draft: "D1" } })],
    ["session", "session", (w) => ({ op: "reviewcopy", token: w.S.ann, params: { draft: "D1" } })],                  /* caseReader */
    ["session", "session", (w) => ({ op: "statementack", token: w.S.ann, params: { draft: "D1", reason: "read" } })],
    ["session", "session", (w) => ({ op: "index", token: w.S.ann })],                                               /* admission */
    ["session", "session", (w) => ({ op: "cite", token: w.S.founder, method: "POST", body: {} })],
    ["aicredentialmint", "aicredentialmint", (w) => ({ op: "aicredentialmint", token: w.S.ann, method: "POST", body: { writes: [] } })],
    ["reviewgrant", "reviewgrant", (w) => ({ op: "reviewgrant", token: w.S.founder, method: "POST", body: {} })],
  ];
  for (const [route, named, drive] of sites) {
    // fixtures-own: synthetic store failure bodies of every shape, with and without the internal-error code and id: what the door carries into its silence
    for (const [body, carried] of [[failed, corr], [{ ok: false, error: "x" }, undefined],
                                   [{ ok: false, reason: "STORE_INTERNAL_ERROR" }, undefined], [{ ok: false, reason: "OTHER", correlation: corr }, undefined]]) {
      const w = world({ answer: (c) => (c.route === route ? reply(body, 500)() : null) });
      const r = await call(w.env, drive(w));
      refused(r, 502, "STORE_DID_NOT_ANSWER", "C-69.2");
      assert.equal(r.json.op, named, route);
      assert.equal(r.json.correlation, carried, `${route} ${JSON.stringify(body)}`);
      if (carried === undefined) assert.equal("correlation" in r.json, false, route);
      assert.equal(r.text.includes("boom") || r.text.includes("/srv/"), false, route);
    }
  }
  /* caseReader's own lookup, for a caller that hands it no resolved row: the silence carries the correlation too. The
     credential is handed over as the door's `presentedCredential` reads it (R59, admission R20), never from the address */
  for (const [token, route] of [[aik(), "aicredentiallook"], [hex64(), "session"]]) {
    for (const [body, carried] of [[failed, corr], [{ ok: false }, undefined]]) {
      const w = world({ answer: (c) => (c.route === route ? reply(body, 500)() : null) });
      const got = await M.caseReader(new URL("https://plane.example/api"), w.env, "bio", undefined,
                                     { token, secret: null, inAddress: false });
      assert.deepEqual(got, carried ? { silent: route, correlation: carried } : { silent: route, correlation: undefined }, route);
    }
  }
  /* negative control: an answering store is no silence at any of the sites */
  const w = world();
  assert.equal((await call(w.env, { op: "index", token: w.S.ann })).status, 200);
  /* N339: what the plane hands every module's relay — `doAnswer`, `storeRefusal` and `storeSilent` — answers a refusal at its
     status with its code and sentence plus what the relay adds, and a no-answer with the correlation */
  for (const [body, status] of [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                                [{ ok: false, reason: "SOME_STORE_REASON", error: "said so" }, 409]]) {
    const out = await M.doAnswer(reply(body, status)());
    assert.equal(out.refused, true);
    const x = M.storeRefusal(out, { op: "knock", store: "bio" });
    assert.equal(x.status, status);
    assert.deepEqual(await x.json(), { ...M.dec49Attach(JSON.parse(JSON.stringify(body))), op: "knock", store: "bio" });
  }
  const silent = await M.doAnswer(reply(failed, 500)());
  const sj = await M.storeSilent("knock", silent.correlation).json();
  assert.deepEqual([sj.reason, sj.op, sj.correlation], ["STORE_DID_NOT_ANSWER", "knock", corr]);
});

test("R22 (N347; T43-23, K2710): the door reads capture's table for EVIDENCE_NOT_HELD (C-118.1) and doorbell's family for NO_SUCH_KNOCK (C-118.2, there since T43-8), the old generic NOT_FOUND nothing; a forwarded NO_SUCH_KNOCK under result gains its row, and an answer already carrying it is unchanged", async () => {
  const { CAPTURE_CHECKS } = await import("../../../src/capture/checks.mjs");
  const { DOORBELL_CHECKS } = await import("../../../src/doorbell/checks.mjs");
  assert.ok(M.CHECK_FAMILY_FILES.some(([, f]) => f.CAPTURE_CHECKS === CAPTURE_CHECKS), "capture's checks.mjs is read");
  assert.ok(M.CHECK_FAMILY_FILES.some(([, f]) => f.DOORBELL_CHECKS === DOORBELL_CHECKS), "doorbell's checks.mjs is read");
  const ROWS = { EVIDENCE_NOT_HELD: CAPTURE_CHECKS.EVIDENCE_NOT_HELD, NO_SUCH_KNOCK: DOORBELL_CHECKS.NO_SUCH_KNOCK };
  assert.deepEqual(M.dec49Row("EVIDENCE_NOT_HELD"), { check: "C-118.1", translation: ROWS.EVIDENCE_NOT_HELD.translation });
  assert.deepEqual(M.dec49Row("NO_SUCH_KNOCK"), { check: "C-118.2", translation: ROWS.NO_SUCH_KNOCK.translation });
  assert.equal(M.dec49Row("NOT_FOUND"), null);
  for (const [route, op, token, code] of [["inboxget", "inboxget", "ADMIN_TOKEN", "NO_SUCH_KNOCK"], ["capture", "capture", "ADMIN_TOKEN", "EVIDENCE_NOT_HELD"]]) {
    // fixtures-own: input the code is fed in only so the door looks up its row (R22 decorates any code with a row); the provider's answer shape is not under test
    const w = world({ answer: (c) => (c.route === route ? reply({ ok: true, result: { ok: false, reason: code } })() : null) });
    const r = await call(w.env, { op, token: w.env[token], params: { id: "K1", sha256: "0".repeat(64) } });
    assert.deepEqual([r.json.result.code, r.json.result.check, r.json.result.translation],
                     [code, ROWS[code].check, ROWS[code].translation], op);
  }
  /* an answer already carrying the fields is unchanged, and the retired code is not decorated */
  const mine = { ok: false, reason: "NO_SUCH_KNOCK", code: "NO_SUCH_KNOCK", check: "C-0", translation: "mine" };
  assert.deepEqual(M.dec49Attach({ ok: true, result: { ...mine } }), { ok: true, result: mine });
  assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, reason: "NOT_FOUND" } }), { ok: true, result: { ok: false, reason: "NOT_FOUND" } });
});

test("R30: no credential, session token, secret or stack appears in any answer — the one minting answer of admission R13 excepted — a store's stack included", async () => {
  const w = world();
  const secrets = [w.env.ADMIN_TOKEN, w.env.MEMBER_TOKEN, w.env.PROBE_TOKEN, w.env.DAEMON_TOKEN, ...Object.values(w.S), ...Object.values(w.A)];
  for (const { op, r } of await sweep(w)) {
    for (const s of secrets) assert.equal(r.text.includes(s), false, `${op} leaks a credential`);
    assert.doesNotMatch(r.text, /\n\s+at \S+ \(|\.mjs:\d+/, op);
  }
  /* a store that throws answers its stack; it never reaches the caller, through the forward or the module's own reads */
  const STACK = "Error: boom at /srv/store.mjs:4242\n    at Store.fetch (file:///srv/store.mjs:4242:7)";
  const thrown = world({ answer: (c) => (c.route !== "session" && c.route !== "aicredentiallook"
    ? new Response(JSON.stringify({ ok: false, error: STACK }), { status: 500 }) : null) });
  for (const { op, r } of await sweep(thrown)) {
    assert.equal(r.text.includes("boom") || r.text.includes("/srv/"), false, op);
    assert.doesNotMatch(r.text, /\n\s+at \S+ \(|\.mjs:\d+/, op);
  }
  const t = await call(w.env, { op: "aicredentialmint", token: w.S.ann, method: "POST", body: { writes: [] } });
  const minted = t.json.result.token;
  /* the minted value authenticates afterwards (the store holds its digest) and never appears in any later answer */
  const w2 = world({ creds: { [minted]: cred({ tokenId: "new" }) } });
  const later = await call(w2.env, { op: "whoami", token: minted });
  assert.equal(later.json.result.tokenClass, "ai");
  assert.equal(later.text.includes(minted), false);
});

test("R32, R39, R46: each check the door answers carries its C-number on the wire — its own C-69.1–.5, C-69.7 (signin-door's `signintrace`, T47), C-68.2–.4, C-66.6 and R39's C-61.1, and admission's C-38, C-78, C-29.6–.10, C-32.17 and C-64.4 from the gates it calls", async () => {
  /* (T48; R94; ai-accounts R23) the store answers signin-door's disclosure question as `ai-accounts.disclosureDue` does for a
     member with none recorded: its one refusal, row and all, relayed as given */
  const accounts = new AiAccounts({ sql: null });
  accounts.registerDisclosureRead("instance-setup", () => ({ shown: false }));
  const due = accounts.disclosureDue({ member: "ann" });
  const w = world({ answer: (c) => (c.route === "casedrafts" ? new Response("x")
    : c.route === "signindisclosuredue" ? new Response(JSON.stringify({ ok: true, result: due })) : null) });
  const { env, S, A } = w;
  const got = {};
  const note = (r) => { if (r.json?.ok === false && r.json.code) { got[r.json.code] = r.json.check; assert.ok(r.json.translation, r.json.code);
                                                                    sentences[r.json.code] = r.json.translation; } };
  const sentences = {};
  const d = async (req) => note(await call(env, { method: "POST", body: {}, ...req }));
  await d({ op: "index" });                                                     /* C-38.1 */
  await d({ op: "index", token: env.DAEMON_TOKEN });                            /* C-38.2 */
  await d({ op: "purge", token: S.ann });                                       /* C-38.3 */
  await d({ op: "export", token: S.ann });                                      /* C-38.4 */
  await d({ op: "promote", token: S.bare });                                    /* C-38.5 */
  await d({ op: "index", token: env.PROBE_TOKEN, params: { store: "bio" } });   /* C-38.6 */
  await d({ op: "governorconfig", token: S.ann });                              /* C-38.7 */
  await d({ op: "nosuchop" });                                                  /* C-69.1 */
  await d({ op: "purge", token: env.ADMIN_TOKEN });                             /* C-61.1 (R39) */
  await d({ op: "casedrafts", token: S.ann });                                  /* C-69.2 */
  await d({ op: "index", params: { store: "nope" } });                          /* C-78.1 */
  await d({ op: "knock", params: { store: "scratch" } });                       /* C-78.2 */
  await d({ op: "index", token: A.confined, params: { store: "bio" } });        /* C-78.3 */
  await d({ op: "purge", token: A.ann });                                       /* C-29.6 */
  await d({ op: "index", token: A.revoked });                                   /* C-29.7 */
  await d({ op: "aicredentialmint", token: S.ann, body: { writes: ["nope"] } });            /* C-29.8 */
  await d({ op: "aicredentialmint", token: S.ann, body: { writes: ["purge"] } });           /* C-29.9 */
  await d({ op: "aicredentialmint", token: S.ann, body: { writes: [], confinedTo: "bio" } }); /* C-29.10 */
  await d({ op: "adminendorse", token: env.ADMIN_TOKEN });                      /* C-32.17 */
  await d({ op: "groupnameset", token: env.ADMIN_TOKEN });                      /* C-64.4 */
  await d({ op: "claim", body: { bootstrapToken: "x" } });                      /* C-68.4 */
  await d({ op: "signintrace", token: S.founder });                             /* C-69.7 (signin-door R5; not a test instance) */
  await d({ op: "subscriptionsignin", token: S.ann, body: { step: "start" } }); /* C-29.40 (signin-door R2, was R78; K3164: C-69.6 retired; R94: ai-accounts' row) no disclosure recorded */
  const unset = world({ omit: ["ADMIN_TOKEN"] });
  note(await call(unset.env, { op: "claim", method: "POST", body: {} }));       /* C-68.2 */
  const { PUBLISHED_TOKEN_HASHES } = await import("../../../src/tokens.mjs");
  PUBLISHED_TOKEN_HASHES.add(sha(env.ADMIN_TOKEN));
  try { await d({ op: "claim", body: { bootstrapToken: env.ADMIN_TOKEN } }); } finally { PUBLISHED_TOKEN_HASHES.delete(sha(env.ADMIN_TOKEN)); } /* C-68.3 */
  env.CAPTURES = { get: async () => null };
  await d({ op: "promote", token: env.ADMIN_TOKEN, body: { replay: true, provenanceCapture: "0".repeat(64) } });  /* C-66.6 */
  const { value: pie } = await quietly(() => call(env, { op: "index", token: env.ADMIN_TOKEN,
    hooks: { publicOp: async () => M.json({}), gatedOp: () => { throw new Error("x"); } } }));
  note(pie);                                                                    /* C-69.3 */
  const { value: sie } = await quietly(() => D.dispatch(new Request("http://do/x"), { routes: () => ({ x: () => { throw new Error("x"); } }) }));
  const sj = await sie.json();
  got[sj.code] = sj.check; sentences[sj.code] = sj.translation;                 /* C-69.4 */
  // fixtures-own: synthetic a purge route that is never reached: the hold refuses before it runs (R46)
  const held = await (await D.dispatch(new Request("http://do/purge?confirm=bio"),
    { routes: () => ({ purge: () => ({ ok: true }) }), namespace: () => "bio", purgeHeld: () => true })).json();
  got[held.code] = held.check; sentences[held.code] = held.translation;         /* C-69.5 (R46) */
  assert.deepEqual(got, {
    NOT_AUTHENTICATED: "C-38.1", CLASS_FORBIDDEN: "C-38.2", MACHINE_CREDENTIAL_REQUIRED: "C-38.3", ROOT_OF_TRUST_REQUIRED: "C-38.4",
    NOT_CAPABLE: "C-38.5", SCOPE_REFUSED: "C-38.6", SESSION_ROLE_CANNOT_REACH_OP: "C-38.7",
    UNKNOWN_OP: "C-69.1", STORE_DID_NOT_ANSWER: "C-69.2", PLANE_INTERNAL_ERROR: "C-69.3", STORE_INTERNAL_ERROR: "C-69.4",
    PURGE_HOLD_IN_PLACE: "C-69.5", DISCLOSURE_DUE: "C-29.40", SIGNINTRACE_NOT_TEST: "C-69.7",
    NAMESPACE_UNKNOWN: "C-78.1", NAMESPACE_PINNED: "C-78.2", NAMESPACE_CONFINED: "C-78.3",
    AI_BEYOND_TASK_SCOPE: "C-29.6", AI_CREDENTIAL_REVOKED: "C-29.7", AI_SCOPE_UNKNOWN_OP: "C-29.8",
    AI_SCOPE_BEYOND_MEMBER_REACH: "C-29.9", AI_CONFINEMENT_NOT_SCRATCH: "C-29.10",
    OPERATOR_TOKEN_CANNOT_GOVERN: "C-32.17", GROUP_IDENTITY_NEEDS_SESSION: "C-64.4",
    BOOTSTRAP_CREDENTIAL_UNSET: "C-68.2", BOOTSTRAP_CREDENTIAL_PUBLISHED: "C-68.3", BOOTSTRAP_CREDENTIAL_MISMATCH: "C-68.4",
    REPLAY_UNVERIFIED: "C-66.6", REQUIRED_ARGUMENT_MISSING: "C-61.1",
  });
  /* the rows are the module's own (K6) or admission's, whose gates the door calls (K624 (2)): the two tables hold exactly
     these codes between them, each once, and the wire carries each row's own words */
  const rowsOf = (ns) => {
    const out = {};
    for (const [fam, rows] of Object.entries(ns)) if (/_CHECKS$/.test(fam))
      for (const [code, row] of Object.entries(rows)) { assert.equal(out[code], undefined, code); out[code] = row; }
    return out;
  };
  const own = rowsOf(CP_CHECKS), admission = rowsOf(ADMISSION_CHECKS);
  for (const code of Object.keys(own)) assert.equal(admission[code], undefined, `${code} is held by both`);
  /* (T48; R94; K3164; ai-accounts R23) DISCLOSURE_DUE's row is ai-accounts' C-29.40, which the door relays as `disclosureDue` gives it */
  const disclosure = AI_ACCOUNT_CHECKS.DISCLOSURE_DUE;
  assert.equal(disclosure?.check, "C-29.40");
  const both = { ...own, ...admission, DISCLOSURE_DUE: disclosure };
  assert.deepEqual(Object.fromEntries(Object.entries(got).filter(([c]) => c in own)),
                   Object.fromEntries(Object.entries(own).map(([c, r]) => [c, r.check])), "every row of the module's own is raised");
  for (const [code, check] of Object.entries(got)) {
    assert.ok(both[code], `${code} is in neither table`);
    assert.equal(both[code].check, check, code);
    assert.equal(sentences[code], both[code].translation, code);
  }
  for (const [code, row] of Object.entries(own))
    /* answer-envelope R8: each row's `where` names the file whose code raises it (the door's, the envelope's, the store's
       door, or, since T47, signin-door's for C-69.7) */
    assert.match(row.where, /^src\/(control-plane\/index|answer-envelope\/index|store-door\/dispatch|signin-door\/index)\.mjs \S+ > is-[a-z-]+$/, code);
});

test("R33: no place is named in this module's answers", async () => {
  const PLACES = /\b(oakland|alameda|berkeley|california|san francisco|bay area|emeryville|contra costa)\b/i;
  const w = world();
  for (const { op, r } of await sweep(w)) assert.doesNotMatch(r.text, PLACES, op);
  for (const t of [M.STORE_SILENT_DETAIL, ...Object.values(UNATTENDED_BY_DECISION)]) assert.doesNotMatch(t, PLACES);
  for (const d of [aiScopeDeclaration(["purge"]), aiScopeDeclaration(["nope"]), aiConfinementDeclaration("bio")])
    assert.doesNotMatch(JSON.stringify(d), PLACES);
});

test("R22 (N363, K562; N382, K606; K1868 (1)): the door reads tasks' table — INBOX_REFUSED (C-19.2), MACHINE_CANNOT_FORWARD (C-32.10), MACHINE_CANNOT_RESOLVE (C-32.11), TASK_NOT_YOURS (C-76.1) and, since T34, the check request's C-138.1–C-138.15, and since T47 the sign request's C-138.16 and C-138.17 (tasks R19; DEC-207 (8); K3150), each gain their row on a forwarded refusal, and an answer already carrying one is unchanged", async () => {
  const T = await import("../../../src/tasks/checks.mjs");
  assert.ok(M.CHECK_FAMILY_FILES.some(([, f]) => f === T || f.TASK_ACTOR_CHECKS === T.TASK_ACTOR_CHECKS), "tasks' checks.mjs is read");
  const rows = Object.entries(T).filter(([f]) => /_CHECKS$/.test(f)).flatMap(([, t]) => Object.entries(t));
  assert.deepEqual(rows.map(([code, r]) => [code, r.check]).sort(),
                   [["INBOX_REFUSED", "C-19.2"], ["MACHINE_CANNOT_FORWARD", "C-32.10"], ["MACHINE_CANNOT_RESOLVE", "C-32.11"], ["TASK_NOT_YOURS", "C-76.1"],
                    ...Object.entries(T.CHECK_REQUEST_CHECKS).map(([code, r]) => [code, r.check])].sort());
  assert.deepEqual(Object.values(T.CHECK_REQUEST_CHECKS).map((r) => r.check).sort((a, b) => +a.split(".")[1] - +b.split(".")[1]),
                   Array.from({ length: Object.keys(T.CHECK_REQUEST_CHECKS).length }, (_, i) => `C-138.${i + 1}`));
  for (const [code, row] of rows) {
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
    const w = world({ answer: (c) => (c.route === "taskresolve" ? reply({ ok: true, result: { ok: false, reason: code } })() : null) });
    const r = await call(w.env, { op: "taskresolve", token: w.S.ann, method: "POST", body: {} });
    assert.deepEqual([r.json.result.code, r.json.result.check, r.json.result.translation], [code, row.check, row.translation], code);
  }
  /* negative control: a site's own words are never overwritten */
  const mine = { ok: false, reason: "TASK_NOT_YOURS", check: "C-0", translation: "mine" };
  assert.deepEqual(M.dec49Attach({ ok: true, result: { ...mine } }).result, { ...mine, code: "TASK_NOT_YOURS" });
});

test("R22 (N382, K606): a task-actor refusal forwarded from taskresolve or taskforward is decorated with tasks' own row (C-76.1), never intent's NOT_YOURS (C-111.15), and each keeps its own sentence", async () => {
  const { TASK_ACTOR_CHECKS } = await import("../../../src/tasks/checks.mjs");
  const I = await import("../../../src/intent/checks.mjs");
  const intentRow = Object.values(I).find((t) => t && t.NOT_YOURS).NOT_YOURS;
  const task = TASK_ACTOR_CHECKS.TASK_NOT_YOURS;
  assert.notEqual(task.check, intentRow.check);
  assert.deepEqual(M.dec49Row("TASK_NOT_YOURS"), { check: "C-76.1", translation: task.translation });
  for (const op of ["taskresolve", "taskforward"]) {
    const w = world({ answer: (c) => (c.route === op ? reply({ ok: true, result: { ok: false, reason: "TASK_NOT_YOURS", with: "bea" } })() : null) });
    const r = await call(w.env, { op, token: w.S.ann, method: "POST", body: { id: "TASK-1" } });
    assert.deepEqual([r.json.result.code, r.json.result.check, r.json.result.translation, r.json.result.with],
                     ["TASK_NOT_YOURS", "C-76.1", task.translation, "bea"], op);
    /* negative control: intent's code at the same door still reads intent's row */
    // fixtures-own: input intent's code fed in so the door looks up intent's row, not tasks' (the negative control of R22)
    const v = world({ answer: (c) => (c.route === op ? reply({ ok: true, result: { ok: false, reason: "NOT_YOURS" } })() : null) });
    const q = await call(v.env, { op, token: v.S.ann, method: "POST", body: {} });
    assert.deepEqual([q.json.result.check, q.json.result.translation], [intentRow.check, intentRow.translation], op);
  }
});
