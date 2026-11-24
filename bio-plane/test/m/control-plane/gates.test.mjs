/* control-plane: the bootstrap claim (R15), the promotion's replay (R16) and the gates' order (R28), the gates being
   admission's since the split (K617, K624 (2)) and called by this door in that order. Driven through `makeFetch(hooks)`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, defaultHooks, sha, aik, cred, refused } from "./harness.mjs";
import { PUBLISHED_TOKEN_HASHES } from "../../../src/tokens.mjs";

const { OPS, SESSION_OPS, GOVERNANCE_ACTIONS } = O;
const GATED = Object.keys(OPS).filter((k) => OPS[k].classes !== null);

async function published(value, fn) {
  const h = sha(value);
  PUBLISHED_TOKEN_HASHES.add(h);
  try { return await fn(); } finally { PUBLISHED_TOKEN_HASHES.delete(h); }
}

test("R15: claim is checked against the bootstrap credential first: unset 409 (C-68.2), published 409 (C-68.3), a differing bootstrapToken 403 (C-68.4); the claim carries the fingerprint, never the value", async () => {
  const unset = world({ omit: ["ADMIN_TOKEN"] });
  refused(await call(unset.env, { op: "claim", method: "POST", body: { bootstrapToken: "x", password: "p" } }), 409, "BOOTSTRAP_CREDENTIAL_UNSET", "C-68.2");
  const empty = world(); empty.env.ADMIN_TOKEN = "";
  refused(await call(empty.env, { op: "claim", method: "POST", body: { bootstrapToken: "", password: "p" } }), 409, "BOOTSTRAP_CREDENTIAL_UNSET", "C-68.2");
  const { env } = world();
  await published(env.ADMIN_TOKEN, async () =>
    refused(await call(env, { op: "claim", method: "POST", body: { bootstrapToken: env.ADMIN_TOKEN, password: "p" } }),
            409, "BOOTSTRAP_CREDENTIAL_PUBLISHED", "C-68.3"));
  for (const bt of [undefined, "", env.MEMBER_TOKEN, env.ADMIN_TOKEN.toUpperCase(), `${env.ADMIN_TOKEN} `])
    refused(await call(env, { op: "claim", method: "POST", body: { bootstrapToken: bt, password: "p" } }), 403, "BOOTSTRAP_CREDENTIAL_MISMATCH", "C-68.4");
  assert.equal(unset.env.calls.length + empty.env.calls.length + env.calls.length, 0, "membership.claim never ran");
  /* negative control: the matching credential reaches the claim, which carries the fingerprint and not the value */
  const ok = await call(env, { op: "claim", method: "POST", body: { bootstrapToken: env.ADMIN_TOKEN, password: "pw" } });
  assert.equal(ok.status, 200);
  const [c] = env.calls;
  assert.deepEqual([c.ns, c.route, c.params.fp], ["bio", "claim", sha(env.ADMIN_TOKEN).slice(0, 16)]);
  assert.equal(JSON.stringify(c.body).includes(env.ADMIN_TOKEN) || c.url.href.includes(env.ADMIN_TOKEN), false);
  assert.equal(await M.fingerprint(env.ADMIN_TOKEN), sha(env.ADMIN_TOKEN).slice(0, 16));
});

/* A drive-provenance capture this promotion registers, whose bytes the record holds, naming this bundle and revision. */
function replayWorld({ holdBytes = true, target = "B-1", listSha = null, register = true, badDigest = false } = {}) {
  const text = "---\nobject_type: note\ntitle: t\n---\nbody\n";
  const mdSha = sha(text);
  const prov = JSON.stringify({ promotions: [{ key: "p1", record: { target, files: [{ name: "bundle.md", sha256: listSha ?? mdSha }] } }] });
  const bytes = new TextEncoder().encode(prov);
  const cap = sha(prov);
  const w = world();
  w.env.CAPTURES = { async get(k) {
    if (!holdBytes || k !== `bio/captures/${cap}`) return null;
    const b = badDigest ? new TextEncoder().encode(prov + " ") : bytes;
    return { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  } };
  const body = { bundleId: "B-1", base: "rev0", replay: true, provenanceCapture: cap,
                 register: register ? [{ sha256: cap, path: M.DRIVE_PROVENANCE_PATH }] : [],
                 files: [{ path: "bundle.md", text, sha256: mdSha }] };
  return { ...w, body };
}

test("R16: an asserted replay is kept only for the admin class without a session and only when the drive-provenance capture verifies; otherwise refused REPLAY_UNVERIFIED (C-66.6) before the store is called, and any other caller's replay is deleted", async () => {
  const promoteCalls = (env) => opCalls(env).filter((c) => c.route === "promote");
  /* kept */
  const ok = replayWorld();
  assert.equal((await call(ok.env, { op: "promote", token: ok.env.ADMIN_TOKEN, method: "POST", body: ok.body })).status, 200);
  assert.equal(promoteCalls(ok.env)[0].body.replay, true);
  /* each condition removed: refused by name, nothing written */
  for (const bad of [{ holdBytes: false }, { target: "B-2" }, { listSha: "0".repeat(64) }, { register: false }, { badDigest: true }]) {
    const w = replayWorld(bad);
    const r = await call(w.env, { op: "promote", token: w.env.ADMIN_TOKEN, method: "POST", body: w.body });
    refused(r, 403, "REPLAY_UNVERIFIED", "C-66.6");
    assert.equal(r.json.op, "promote");
    assert.equal(promoteCalls(w.env).length, 0, JSON.stringify(bad));
  }
  const noCap = replayWorld();
  delete noCap.body.provenanceCapture;
  refused(await call(noCap.env, { op: "promote", token: noCap.env.ADMIN_TOKEN, method: "POST", body: noCap.body }), 403, "REPLAY_UNVERIFIED", "C-66.6");
  /* every other caller's replay is deleted — verified bytes or not — and the promotion goes on as an ordinary one */
  for (const verified of [true, false]) {
    const w = replayWorld(verified ? {} : { holdBytes: false });
    for (const [token, params] of [[w.env.PROBE_TOKEN, { store: "scratch" }], [w.S.founder, {}], [w.S.ann, {}]]) {
      w.env.calls.length = 0;
      const r = await call(w.env, { op: "promote", token, params, method: "POST", body: w.body });
      assert.equal(r.status, 200);
      assert.equal("replay" in promoteCalls(w.env)[0].body, false);
    }
  }
  /* the admin class asserting nothing keeps nothing */
  const plain = replayWorld();
  delete plain.body.replay;
  await call(plain.env, { op: "promote", token: plain.env.ADMIN_TOKEN, method: "POST", body: plain.body });
  assert.equal("replay" in promoteCalls(plain.env)[0].body, false);
});

test("R28: the gates run in one order — admission R1, R2, R3, the public ops (R15 among them), admission R5–R6 with R8's session gate, R7, R9/R10, R11, R4's scope refusal, then admission R12 and R16 — and nothing is forwarded when a gate refuses", async () => {
  const { env, S, A } = world();
  const log = [];
  const hooks = defaultHooks(log);
  const drive = async (req, code) => {
    env.calls.length = 0; log.length = 0;
    const r = await call(env, { hooks, method: "POST", body: {}, ...req });
    assert.equal(r.json?.reason, code, `${JSON.stringify(req.params ?? {})} ${req.op}: ${r.text.slice(0, 200)}`);
    assert.equal(opCalls(env).length + log.length, 0, "nothing forwarded and no handler ran");
    return r;
  };
  /* R3 before R4 (and before the credential is even looked up) */
  await drive({ op: "index", token: A.confined, params: { store: "nope" } }, "NAMESPACE_UNKNOWN");
  assert.equal(env.calls.length, 0);
  /* R4 before R5: the confined credential is set to scratch, and the pinned public op then refuses */
  await drive({ op: "knock", token: A.confined }, "NAMESPACE_PINNED");
  await drive({ op: "knock", token: A.confined, params: { store: "bio" } }, "NAMESPACE_CONFINED");
  /* R5 before the public op (R15's claim among them) */
  const unset = world({ omit: ["ADMIN_TOKEN"] });
  const u = await call(unset.env, { op: "claim", params: { store: "scratch" }, method: "POST", body: {} });
  assert.equal(u.json.reason, "NAMESPACE_PINNED");
  /* the public ops before R7–R9: an unknown token does not stop a public op */
  env.calls.length = 0; log.length = 0;
  assert.equal((await call(env, { op: "knock", token: "garbage", hooks, method: "POST", body: {} })).json.publicOp, "knock");
  /* R10's session gate before R11: the member session asking a founder-only op whose classes also lack member */
  const both = GATED.find((k) => k !== "export" && OPS[k].mutating && SESSION_OPS.admin.has(k) && !SESSION_OPS.member.has(k) && !OPS[k].classes.includes("member"));
  assert.ok(both);
  await drive({ op: both, token: S.ann }, "SESSION_ROLE_CANNOT_REACH_OP");
  /* admission R8 (op-declarations R83): `export` reaches the founder's session alone; any other session is refused by name before
     this gate (the control), so the R10 probe is an op no session set holds */
  await drive({ op: "export", token: S.bare }, "ROOT_OF_TRUST_REQUIRED");
  /* an op no session set holds is refused a session by the machine gate (R28's order as built: the probe is `cpuprobe`, read from
     the tables; BOB asked whether R28's text should name this gate) */
  const unheld = Object.keys(OPS).find((k) => OPS[k].mutating && !SESSION_OPS.admin.has(k) && !SESSION_OPS.member.has(k) && OPS[k].classes !== null && !OPS[k].classes.includes("member") && OPS[k].classes.includes("admin"));
  assert.ok(unheld);
  await drive({ op: unheld, token: S.bare }, "MACHINE_CREDENTIAL_REQUIRED");
  /* R11 before R6's scope refusal: probe asking an op it lacks, in bio */
  const notProbe = GATED.find((k) => !OPS[k].classes.includes("probe") && OPS[k].classes.includes("admin") && !Array.isArray(OPS[k].machineClasses));
  await drive({ op: notProbe, token: env.PROBE_TOKEN, params: { store: "bio" } }, "CLASS_FORBIDDEN");
  /* R12 before R14: an agent asking a governance act */
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ writes: [...GOVERNANCE_ACTIONS] }) } });
  const g = await call(w2.env, { op: "adminendorse", token: wide, method: "POST", body: {} });
  assert.equal(g.json.reason, "AI_BEYOND_TASK_SCOPE");
  /* R11 before R14: daemon asking a governance act */
  await drive({ op: "adminendorse", token: env.DAEMON_TOKEN }, "CLASS_FORBIDDEN");
  /* admission R5 (T36, K2166): the retired shared member key is refused by name before anything is looked up or forwarded */
  const retired = await drive({ op: notProbe, token: env.MEMBER_TOKEN, params: { store: "bio" } }, "MEMBER_TOKEN_RETIRED");
  refused(retired, 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
  assert.equal(env.calls.length, 0, "not even a lookup");
  /* R13 before R14/R16: a session without contribute asking promote with a replay */
  const bare = await drive({ op: "promote", token: S.bare, body: { replay: true } }, "NOT_CAPABLE");
  assert.equal(bare.json.needs, "contribute");
  /* R6 before R14 and R16 */
  await drive({ op: "adminendorse", token: env.PROBE_TOKEN, params: { store: "bio" } }, "SCOPE_REFUSED");
  await drive({ op: "promote", token: env.PROBE_TOKEN, params: { store: "bio" }, body: { replay: true } }, "SCOPE_REFUSED");
  /* negative controls: each request with its first failing condition removed meets the next gate, not the first */
  await drive({ op: "adminendorse", token: env.PROBE_TOKEN, params: { store: "scratch" } }, "OPERATOR_TOKEN_CANNOT_GOVERN");
  env.calls.length = 0;
  assert.equal((await call(env, { op: notProbe, token: env.ADMIN_TOKEN, params: { store: "bio" } })).status, 200);
});

test("R28: admission R12's refusals come before the op — a module handler (hooks.gatedOp) willing to serve every op is never asked when a fence refuses", async () => {
  const w = replayWorld({ holdBytes: false });
  const { env } = w;
  const asked = [];
  const hooks = { publicOp: async () => M.json({ ok: true }),
                  gatedOp: async (c) => { asked.push(c.op); return M.json({ ok: true, servedBy: "hook", op: c.op }); } };
  for (const [op, token, params, code] of [["adminendorse", env.ADMIN_TOKEN, {}, "OPERATOR_TOKEN_CANNOT_GOVERN"],
                                           ["membercaps", env.PROBE_TOKEN, { store: "scratch" }, "OPERATOR_TOKEN_CANNOT_GOVERN"],
                                           ["membercaps", env.MEMBER_TOKEN, {}, "MEMBER_TOKEN_RETIRED"],
                                           ["groupnameset", env.PROBE_TOKEN, { store: "scratch" }, "GROUP_IDENTITY_NEEDS_SESSION"]]) {
    asked.length = 0; env.calls.length = 0;
    const r = await call(env, { op, token, params, hooks, method: "POST", body: w.body });
    assert.equal(r.json.reason, code, op);
    assert.deepEqual(asked, [], `${op}: the handler ran before the refusal`);
    assert.equal(opCalls(env).length, 0);
  }
  /* negative controls: with the fence's condition removed the handler is asked */
  asked.length = 0;
  assert.equal((await call(env, { op: "adminendorse", token: w.S.founder, hooks, method: "POST", body: {} })).json.servedBy, "hook");
});

test("R28: R16's replay refusal comes before the op — a module handler (hooks.gatedOp) willing to serve promote is never asked for an unverified replay, and still receives the whole body when the replay verifies or none is asserted", async () => {
  const asked = [];
  const hooks = { publicOp: async () => M.json({ ok: true }),
                  gatedOp: async (c) => { asked.push({ op: c.op, body: await c.req.text() }); return M.json({ ok: true, servedBy: "hook" }); } };
  for (const bad of [{ holdBytes: false }, { target: "B-2" }, { register: false }]) {
    const w = replayWorld(bad);
    asked.length = 0;
    const r = await call(w.env, { op: "promote", token: w.env.ADMIN_TOKEN, hooks, method: "POST", body: w.body });
    refused(r, 403, "REPLAY_UNVERIFIED", "C-66.6");
    assert.deepEqual(asked, [], `${JSON.stringify(bad)}: the handler ran before the refusal`);
    assert.equal(opCalls(w.env).length, 0);
  }
  /* negative controls: a verified replay, and an ordinary promotion by any caller, reach the handler with the body whole */
  const ok = replayWorld();
  for (const [token, body, params] of [[ok.env.ADMIN_TOKEN, ok.body, {}], [ok.env.PROBE_TOKEN, ok.body, { store: "scratch" }],
                                       [ok.S.ann, { ...ok.body, replay: false }, {}]]) {
    asked.length = 0;
    const r = await call(ok.env, { op: "promote", token, params, hooks, method: "POST", body });
    assert.equal(r.json.servedBy, "hook");
    assert.deepEqual(JSON.parse(asked[0].body), body);
  }
});
