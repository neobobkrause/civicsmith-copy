/* control-plane: the contracts its USERS (earlier in the order, who cannot import this module) hand-build values for (FIX-L; K4990, K4995, K5044 (5)).
   Each contract is stated below as DATA and run against the real door (`makeFetch`), so a user's hand-built value is compared with the real answer and the
   real one wins. `ask-wire`: the plane worker's `/?op=<op>` envelope as the agent worker sees it. `unknown-op`: the UNKNOWN_OP refusal. (`deliver-owed` is
   run in `r124-owed-render.test.mjs`, over the real record.) */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { O, world, call, cred, aik, defaultHooks } from "./harness.mjs";

const { OPS } = O;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/* the ops the agent worker and agent-steps call over the plane's door, as an `ai` credential presents them */
const { PLANE_OPS, ASK_PLANE_OPS } = await import("../../../../agent-worker/src/ops.mjs");
const ASK_OPS = [...Object.keys(PLANE_OPS), ...Object.keys(ASK_PLANE_OPS)];

/* the wire, as data. `answered`: the envelope of an op that admits an `ai` credential and whose store answers `{ok: true, result}`; `refused`: an op whose row
   admits no `ai` credential (the ask* trio, member-only): 403 with the refusal body's keys in order (the five every refusal has, then the admission row's own: what was asked of whom); `silent`: a store that answers nothing readable;
   `unknown`: an op with no spec */
const ASK_WIRE = {
  answered: { status: 200, keys: ["ok", "result", "store", "tokenClass"], ok: true, store: "bio", tokenClass: "ai" },
  // fixtures-own: synthetic the contract stated as data: the expected refusal of an op whose row admits no ai credential, compared with the real door's answer
  refused: { ops: ["askcheck", "askceiling", "askusage"], status: 403, keys: ["ok", "reason", "code", "check", "translation"], more: ["detail", "op", "tokenId", "taskScope", "declared", "cls"], ok: false, reason: "AI_BEYOND_TASK_SCOPE", check: "C-29.6" },
  silent: { status: 502, reason: "STORE_DID_NOT_ANSWER", check: "C-69.2" },
  unknown: { status: 400, reason: "UNKNOWN_OP", check: "C-69.1" },
};

// fixtures-run: agent-steps ask-wire
// fixtures-run: agent-worker ask-wire
test("R2, R28 (contract ask-wire, agent-steps, agent-worker): every op the agent worker calls answers an `ai` credential with {ok: true, result, store, tokenClass} at 200 where its row admits the class, and 403 {ok: false, reason, code, check, translation} where it does not; a store that answers nothing readable is 502 STORE_DID_NOT_ANSWER, an op with no spec 400 UNKNOWN_OP; the op list is the contract's whole", async () => {
  const agent = aik();
  const wide = world({ creds: { [agent]: cred({ tokenId: "agent-wire", principal: "member:ann", writes: Object.keys(OPS) }) } });
  const A = ASK_WIRE.answered, R = ASK_WIRE.refused;
  for (const op of ASK_OPS) {
    assert.ok(OPS[op], `${op} is a declared op`);
    const w = world({ creds: { [agent]: cred({ tokenId: "agent-wire", principal: "member:ann", writes: Object.keys(OPS) }) },
                      answer: (c) => (c.route === op ? json({ ok: true, result: { ok: true, probe: op } }) : undefined) });
    const r = await call(w.env, { op, token: agent, method: "POST", body: {} });
    if (R.ops.includes(op)) {
      assert.equal(OPS[op].classes.includes("ai"), false, `${op} admits no ai credential`);
      assert.deepEqual([r.status, Object.keys(r.json), r.json.ok, r.json.reason, r.json.check], [R.status, [...R.keys, ...R.more], R.ok, R.reason, R.check], `${op}: ${r.text.slice(0, 200)}`);
      assert.equal(typeof r.json.translation, "string");
      assert.equal(r.json.code, r.json.reason);
    } else if (op === "whoami" || op === "agentpack") {
      /* the door answers these two itself (the credential's own facts; the rendered pack): the same envelope's head, the body its own */
      assert.equal(r.json.ok === true || r.json.reason === ASK_WIRE.silent.reason, true, `${op}: ${r.text.slice(0, 200)}`);
    } else {
      assert.deepEqual([r.status, Object.keys(r.json), r.json.ok, r.json.store, r.json.tokenClass, r.json.result], [A.status, A.keys, A.ok, A.store, A.tokenClass, { ok: true, probe: op }], `${op}: ${r.text.slice(0, 200)}`);
    }
  }
  /* a store's own refusal travels inside a 200 envelope unchanged: {ok: true, result: {ok: false, reason, check}} */
  // fixtures-generic: AI_RUN_NOT_VISIBLE (the door relays a store's own refusal unchanged inside a 200 envelope, whatever its code)
  const inner = { ok: false, reason: "AI_RUN_NOT_VISIBLE", check: "C-22.9" };
  const w1 = world({ creds: { [agent]: cred({ tokenId: "agent-wire", principal: "member:ann", writes: [] }) }, answer: (c) => (c.route === "airun" ? json({ ok: true, result: inner }) : undefined) });
  const nested = await call(w1.env, { op: "airun", token: agent });
  assert.deepEqual([nested.status, nested.json.ok, nested.json.result], [200, true, inner]);
  /* silent: a store that answers nothing readable, and a store that throws */
  const S = ASK_WIRE.silent;
  for (const answer of [() => new Response("<html>oops", { status: 500 }), () => new Response("", { status: 500 }), () => { throw new Error("the store is down"); }]) {
    const w = world({ creds: { [agent]: cred({ tokenId: "agent-wire", principal: "member:ann", writes: [] }) }, answer: (c) => (c.route === "plans" ? answer() : undefined) });
    const r = await call(w.env, { op: "plans", token: agent });
    assert.deepEqual([r.status, r.json && r.json.ok, r.json && r.json.reason, r.json && r.json.check], [S.status, false, S.reason, S.check], r.text.slice(0, 200));
  }
  /* an op with no spec: 400 UNKNOWN_OP, the same on the ai credential's path */
  const U = ASK_WIRE.unknown;
  const unk = await call(wide.env, { op: "no-such-op", token: agent });
  assert.deepEqual([unk.status, unk.json.reason, unk.json.check], [U.status, U.reason, U.check]);
});

/* the UNKNOWN_OP refusal, as data: status 400; the keys in this order (`error` stays "unknown op", byte-identical, first after `ok`; R2); the code in `reason` and
   `code`; its C-number; the sentence in `translation`; the op asked, echoed. The store's own `unknown op: <op>` (404) is store-door's contract, not this one. */
const UNKNOWN_OP = { status: 400, keys: ["ok", "error", "reason", "code", "check", "translation", "op"], ok: false, error: "unknown op", reason: "UNKNOWN_OP", code: "UNKNOWN_OP", check: "C-69.1" };

// fixtures-run: ratification unknown-op
test("R2 (contract unknown-op, ratification): an op with no spec is refused 400 with the keys ok, error \"unknown op\", reason, code UNKNOWN_OP, check C-69.1, a translation sentence and the op asked, with or without a credential, on `?op=` and on the path, and nothing is read", async () => {
  const { env, S } = world();
  const U = UNKNOWN_OP;
  for (const asked of [{ op: "nosuch", token: S.ann }, { op: "nosuch" }, { path: "/api/nosuch" }, { op: "nosuch", token: env.ADMIN_TOKEN, method: "POST", body: {} }]) {
    env.calls.length = 0;
    const r = await call(env, asked);
    assert.deepEqual([r.status, Object.keys(r.json), r.json.ok, r.json.error, r.json.reason, r.json.code, r.json.check, r.json.op],
                     [U.status, U.keys, U.ok, U.error, U.reason, U.code, U.check, "nosuch"], r.text.slice(0, 300));
    assert.equal(typeof r.json.translation, "string");
    assert.ok(r.json.translation.length > 0);
    assert.equal(env.calls.length, 0, "nothing is read for an unknown op");
  }
  /* control: a declared op is not refused as unknown */
  const known = await call(env, { op: "index", token: env.ADMIN_TOKEN });
  assert.notEqual(known.json && known.json.reason, "UNKNOWN_OP");
});
