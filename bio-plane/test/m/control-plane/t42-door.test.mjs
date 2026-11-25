/* control-plane R74 (T42; N832, K2611, K2635, K2656): `op=pagetranscribe`, admitted only for a member's session and
   stamped from it, none of its stamps taken from the caller, answered by the gated hook `plane` composes, whose arm is
   `extraction`'s exported `pageTranscribeOp`. Driven through `makeFetch(hooks)` with a hook that answers it as plane
   does (`pageTranscribeOp` handed the ctx's own stamps, door.mjs's expressions), so the store's request shows what the
   door handed on. Negative controls throughout (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, aik, cred, hex64, member, refused, FORGED } from "./harness.mjs";
import { pageTranscribeOp, EXTRACTION_OPS } from "../../../src/extraction/ops.mjs";
import { reextractRow } from "../../../src/extraction/checks.mjs";
import { MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/actors.mjs";

const OP = "pagetranscribe";
const SHA = "c".repeat(64);
/* Every field the store's query could carry, sent forged in the address and the body. */
const FORGED_FIELDS = { viewer: FORGED, author: FORGED, by: FORGED, identity: FORGED, cls: "admin", session: "1",
                        caps: "contribute,publish,administer" };
/* (`store` is no stamp: it names the namespace the caller addresses, admission R4, and the store's `store` follows it.) */

/* plane's gated hook for this op, as its R36 composes it: the ctx's stamps by door.mjs's expressions, handed to
   `pageTranscribeOp`; every other op declines, so the forward runs. `seen` records each ctx. */
function hooks({ decline = false } = {}) {
  const seen = [];
  return {
    seen,
    async publicOp(ctx) { return M.json({ ok: true, publicOp: ctx.op }); },
    async gatedOp(ctx) {
      seen.push(ctx);
      if (decline || ctx.op !== OP) return undefined;
      const { url, env, cls, viaSession, sessMember, sessViewer, sessCaps, storeName } = ctx;
      const viewer = viaSession ? sessViewer : `${MACHINE_CLASS_PREFIX}${cls}`;
      const author = viaSession ? sessMember : `${MACHINE_AUTHOR_PREFIX}${cls}`;
      return pageTranscribeOp(url, env, env.STORE.get(env.STORE.idFromName(storeName)), {
        json: M.json, storeSilent: M.storeSilent, storeRefusal: M.storeRefusal, doAnswer: M.doAnswer,
        storageAbsent: M.storageAbsent, requiredArgument: M.requiredArgument,
        cls, session: viaSession, caps: sessCaps, viewer, author, storeName });
    },
  };
}
const withStorage = (w) => { w.env.CAPTURES = { get: async () => null }; return w; };
const routeCalls = (env) => opCalls(env).filter((c) => c.route === OP);

test("R74: op=pagetranscribe has the spec op-declarations R47 declares — a member's session only, mutating, `contribute`, stamped `by` and `viewer` — and `extraction` keeps it out of `EXTRACTION_OPS` (K2635), so the door reaches it only through plane's gated hook (negative control: `pdfstructure` is listed there)", () => {
  const spec = O.OPS[OP];
  assert.ok(spec, "op-declarations R47's spec");
  assert.deepEqual([spec.classes, spec.machineClasses, spec.mutating], [["admin", "member"], [], true]);
  assert.equal(O.NEEDS[OP], "contribute");
  assert.deepEqual([O.SESSION_OPS.member.has(OP), O.SESSION_OPS.admin.has(OP)], [true, true]);
  assert.deepEqual([...(O.OP_STAMPS[OP] || [])].sort(), ["by", "viewer"]);
  assert.equal(EXTRACTION_OPS.includes(OP), false);
  assert.equal(EXTRACTION_OPS.includes("pdfstructure"), true);
});

test("R74, R17, R29: a member's session and the founder's reach plane's gated hook with the door's stamps — class, a session asked, its capabilities, viewer and author — and the store is asked `pagetranscribe` with those and with `sha256` and `project` from the address, every stamp the caller sent in the address or the body lost (negative control: the same request unforged gives the same store query)", async () => {
  const w = withStorage(world());
  const cases = [[w.S.ann, "member:ann", "ann"], [w.S.founder, "admin", "admin"]];
  for (const [token, viewer, author] of cases) {
    const queries = [];
    for (const forged of [false, true]) {
      const h = hooks();
      w.env.calls.length = 0;
      const r = await call(w.env, { op: OP, token, hooks: h, method: "POST",
        params: { sha256: SHA, project: "PROJ-1", ...(forged ? FORGED_FIELDS : {}) }, body: forged ? FORGED_FIELDS : {} });
      assert.equal(r.status, 200, r.text.slice(0, 300));
      const ctx = h.seen.find((c) => c.op === OP);
      assert.deepEqual([ctx.cls, ctx.viaSession, ctx.sessViewer, [...ctx.sessCaps].sort()],
                       [token === w.S.ann ? "member" : "admin", true, viewer, ["contribute", "create_projects", "publish"]]);
      const [inner] = routeCalls(w.env);
      assert.ok(inner, "the store was asked");
      assert.deepEqual([inner.ns, inner.params.sha256, inner.params.project, inner.params.viewer, inner.params.author,
                        inner.params.session, inner.params.cls, inner.params.caps.split(",").sort(), inner.params.store],
                       ["bio", SHA, "PROJ-1", viewer, author, "1", ctx.cls, ["contribute", "create_projects", "publish"], "bio"]);
      assert.equal(JSON.stringify(inner).includes(FORGED), false, "no forged stamp reaches the store");
      queries.push(inner.params);
    }
    assert.deepEqual(queries[1], queries[0], "forging changes nothing");
  }
});

test("R74 (R28; admission R8–R11): every caller not arriving by a member's session is refused before the hook and the store — each binding class CLASS_FORBIDDEN, an agent credential even declaring every write AI_BEYOND_TASK_SCOPE, a session without `contribute` NOT_CAPABLE, no credential NOT_AUTHENTICATED (negative control: a member's session holding `contribute` is admitted)", async () => {
  const bare = hex64(), wide = aik();
  const w = withStorage(world({ sessions: { [bare]: member("bea", []) },
                                creds: { [wide]: cred({ tokenId: "agent-wide", writes: Object.keys(O.OPS) }) } }));
  const tries = [
    [w.env.ADMIN_TOKEN, {}, 403, "CLASS_FORBIDDEN", "C-38.2"],
    [w.env.PROBE_TOKEN, { store: "scratch" }, 403, "CLASS_FORBIDDEN", "C-38.2"],
    [w.env.DAEMON_TOKEN, {}, 403, "CLASS_FORBIDDEN", "C-38.2"],
    [wide, {}, 403, "AI_BEYOND_TASK_SCOPE", "C-29.6"],
    [bare, {}, 403, "NOT_CAPABLE", "C-38.5"],
  ];
  for (const [token, params, status, code, check] of tries) {
    const h = hooks();
    w.env.calls.length = 0;
    const r = await call(w.env, { op: OP, token, hooks: h, method: "POST", params: { sha256: SHA, ...params } });
    refused(r, status, code, check);
    assert.equal(h.seen.length, 0, `${code}: the hook was not asked`);
    assert.equal(opCalls(w.env).length, 0, `${code}: the store was not asked`);
  }
  const anon = await call(w.env, { op: OP, hooks: hooks(), method: "POST", params: { sha256: SHA } });
  assert.equal(anon.status, 401);
  assert.equal(opCalls(w.env).length, 0);
  /* negative control */
  w.env.calls.length = 0;
  assert.equal((await call(w.env, { op: OP, token: w.S.ann, hooks: hooks(), method: "POST", params: { sha256: SHA } })).status, 200);
  assert.equal(routeCalls(w.env).length, 1);
});

test("R74: the door holds no arm's behaviour — the owner's refusals and answers are relayed as given: a bad digest is `extraction`'s required-argument refusal with nothing asked of the store, and the store's answer, a refusal or an ending, comes back as the store gave it (negative control: a success is answered whole)", async () => {
  const bad = withStorage(world());
  const r0 = await call(bad.env, { op: OP, token: bad.S.ann, hooks: hooks(), method: "POST", params: { sha256: "nothex" } });
  assert.deepEqual([r0.status, r0.json.reason, r0.json.argument], [400, "REQUIRED_ARGUMENT_MISSING", "sha256"]);
  assert.equal(routeCalls(bad.env).length, 0);
  /* extraction's Durable Object half answers `{status, body}` (its R71), which `pageTranscribeOp` answers as given */
  const notDeployed = reextractRow("TRANSCRIBE_NOT_DEPLOYED");   /* extraction's own row: code, check C-51.7, its sentence */
  // fixtures-own: synthetic extraction's Durable Object half answers {status, body}; the door relays each as given, so only the relay is under test
  const results = [
    [403, { ok: false, reason: notDeployed.code, ...notDeployed }],
    [200, { ok: true, performed: false, why: "no assistant is bound" }],
    [200, { ok: true, performed: true, pages: [3, 4] }],
  ];
  for (const [status, body] of results) {
    const w = withStorage(world({ answer: (c) => (c.route === OP ? new Response(JSON.stringify({ ok: true, result: { status, body } })) : null) }));
    const r = await call(w.env, { op: OP, token: w.S.ann, hooks: hooks(), method: "POST", params: { sha256: SHA } });
    assert.equal(r.status, status, r.text.slice(0, 200));
    for (const [k, v] of Object.entries(body)) assert.deepEqual(r.json[k], v, `${body.reason ?? body.performed}: ${k} as given`);
  }
});

test("R74, R29: should plane's hook decline, the forward asks the store's `pagetranscribe` with the door's class, session flag, capabilities, viewer, author and namespace, never the caller's (negative control: `sha256` and `project` from the address do cross)", async () => {
  const w = withStorage(world());
  for (const [token, cls, viewer, author] of [[w.S.ann, "member", "member:ann", "ann"], [w.S.founder, "admin", "admin", "admin"]]) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: OP, token, hooks: hooks({ decline: true }), method: "POST",
                                  params: { sha256: SHA, project: "PROJ-1", ...FORGED_FIELDS }, body: FORGED_FIELDS });
    assert.equal(r.status, 200, r.text.slice(0, 200));
    const [inner] = routeCalls(w.env);
    assert.deepEqual([inner.ns, inner.params.cls, inner.params.session, inner.params.caps.split(",").sort(), inner.params.viewer,
                      inner.params.author, inner.params.store, inner.params.sha256, inner.params.project],
                     ["bio", cls, "1", ["contribute", "create_projects", "publish"], viewer, author, "bio", SHA, "PROJ-1"]);
    assert.equal(Object.values(inner.params).includes(FORGED), false);
  }
});

test("R74 (as `pdfstructure`'s): the forward of `pdfstructure`, should the hook decline, also carries the door's class, session flag, capabilities and namespace, never the caller's (negative control: a probe in scratch is stamped `probe`, no session)", async () => {
  const w = withStorage(world());
  for (const [token, params, cls, session, ns] of [[w.S.ann, {}, "member", "1", "bio"], [w.env.PROBE_TOKEN, { store: "scratch" }, "probe", "0", "scratch"]]) {
    w.env.calls.length = 0;
    await call(w.env, { op: "pdfstructure", token, hooks: hooks({ decline: true }),
                        params: { sha256: SHA, ...params, cls: "admin", session: "1", caps: "administer", viewer: FORGED } });
    const [inner] = opCalls(w.env).filter((c) => c.route === "pdfstructure");
    assert.deepEqual([inner.ns, inner.params.cls, inner.params.session, inner.params.store], [ns, cls, session, ns]);
    assert.equal(inner.params.caps.includes("administer"), false);
    assert.notEqual(inner.params.viewer, FORGED);
  }
});
