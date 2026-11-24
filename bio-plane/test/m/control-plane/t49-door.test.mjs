/* control-plane T49's routes (T49-29): R96 (the door strips a body `member` only for `stepsource` and `stepsourcewithdraw`;
   `accountreferenceset` and `accountreferenceremove` reach `ai-accounts` with the member's own `member`), R97 (`claim` passes
   `handle` and no `role`; `founderhandleset` is the founder's own session's), R98 (`projectownervotes` routed with `viewer`
   stamped) and R99 (words by key). Driven through `makeFetch(hooks)` over the harness's store; R96's owner is the real
   `ai-accounts` over a real SQLite database beside the real `membership`, answering behind the harness's store as plane's
   store door does (its route map, `aiAccountsOps`). R97's and R98's ops are declared by `op-declarations` (R71, R72), whose
   merge in layer 11 comes before this module's. */
import { test } from "node:test";
import { T48_FAMILIES } from "../../../src/op-declarations/t48.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { M, O, world, call, opCalls, refused, FORGED } from "./harness.mjs";
import { ok } from "./door-routes.mjs";
import { membershipOf, membershipOps } from "../../../src/membership/index.mjs";
import { aiAccountsOf, aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
import { connectionsOps } from "../../../src/connections/index.mjs";
import { promoteArchive } from "../../../src/control-plane/archive.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const { OPS } = O;
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status });
const SENTINEL = "sk-ant-api03-SENTINEL-t49-door-9f8e7d6c5b4a";
const FORGED_QUERY = { viewer: FORGED, identity: FORGED, author: FORGED, by: FORGED, actor: FORGED, who: FORGED, origin: FORGED,
                       administer: "1" };
const U = new URL("http://do/x");
const noForged = (c, label) => assert.equal(JSON.stringify([c.url.href, c.body, c.headers]).includes(FORGED), false,
                                             `${label}: a caller's stamp reached the store`);

/* ================================================================ R96 */

/* The real `ai-accounts` over a real SQLite database beside the real `membership` (a claimed group; members enrolled by
   membership's own acts), and the harness's store answering the two account routes as plane's store door does: through
   `aiAccountsOps`, with the request's address and parsed body. */
function accountsWorld() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE bundles (bundle_id TEXT PRIMARY KEY, object_type TEXT NOT NULL, title TEXT, project TEXT)`);
  const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
  const sql = { exec(q, ...args) {
    const st = db.prepare(q);
    return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
  } };
  const core = { bundleInfo: () => null, declarePurge: () => ({ ok: true }), declareTable: () => ({ ok: true }) };
  const ctx = { storage: { sql } };
  const m = membershipOf(ctx, { record: core });
  m.migrate();
  m.registerClaimed("test-claim", () => true);
  m.registerPasswordSetter(() => ({ ok: true }), "test-password");
  const a = aiAccountsOf(ctx, { record: core, membership: m, sealSecret: "t49-door-seal-secret-0123456789" });
  a.migrate();
  const enrol = async (id, role = "member") => {
    const x = await m.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    assert.equal(x.ok, true, JSON.stringify(x));
    const e = await m.enroll({ invite: x.invite, handle: id, password: `${id}-passphrase-x` });
    assert.equal(e.ok, true, JSON.stringify(e));
  };
  const snapshot = () => JSON.stringify(sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .map(({ name }) => [name, sql.exec(`SELECT * FROM "${name}"`)]));
  const w = world({ answer: async (c) => {
    if (c.route !== "accountreferenceset" && c.route !== "accountreferenceremove") return null;
    return ok(await aiAccountsOps(a, c.url, c.body, { VERSION: "t49" })[c.route]());
  } });
  return { ...w, a, enrol, snapshot, setup: async () => { await enrol("second", "admin"); await enrol("ann"); await enrol("bea"); } };
}

test("R96 (T49; D1 B, N1095; K3320, K3321 (A); amends R17, R29, R92): through the real door a member connects her own API key (`accountreferenceset`, `member` her own) and removes it, and so does the founder; the body's `member` reaches `ai-accounts` as given and the address's is the session's own", async () => {
  const x = accountsWorld();
  await x.setup();
  for (const [who, token, body, viewer] of [["ann", x.S.ann, "ann", "member:ann"], ["the founder", x.S.founder, "admin", "admin"]]) {
    x.env.calls.length = 0;
    const set = await call(x.env, { op: "accountreferenceset", token, method: "POST", params: { ...FORGED_QUERY, member: FORGED },
                                    body: { member: body, kind: "apikey", secret: SENTINEL } });
    assert.equal(set.status, 200, `${who}: ${set.text.slice(0, 300)}`);
    assert.equal(set.json.result.ok, true, `${who} connects: ${set.text.slice(0, 300)}`);
    assert.equal(set.json.result.kind, "apikey");
    assert.equal(set.text.includes(SENTINEL), false, `${who}: the key is never answered`);
    const [inner] = opCalls(x.env).filter((c) => c.route === "accountreferenceset");
    assert.deepEqual([inner.params.by, inner.params.member], [viewer, viewer], `${who}: the address stamps are the session's`);
    assert.equal(inner.body.member, body, `${who}: the body's member reaches ai-accounts as given`);
    assert.equal(JSON.stringify(inner.params).includes(FORGED), false, `${who}: no forged address value`);
    assert.equal((await x.a.accountReferenceState({ member: body, viewer })).kind, "apikey", `${who}: the reference is held`);
    const off = await call(x.env, { op: "accountreferenceremove", token, method: "POST", params: { member: FORGED },
                                    body: { member: body } });
    assert.equal(off.status, 200, `${who}: ${off.text.slice(0, 300)}`);
    assert.equal(off.json.result.ok, true, `${who} removes: ${off.text.slice(0, 300)}`);
    assert.equal(opCalls(x.env).filter((c) => c.route === "accountreferenceremove")[0].body.member, body);
    assert.notEqual((await x.a.accountReferenceState({ member: body, viewer }))?.kind, "apikey", `${who}: the reference is gone`);
  }
});

test("R96 (controls; ai-accounts R38): a body `member` naming another member is dropped by `ai-accounts`: the act lands on the caller's own reference (the stamped `by`), for `accountreferenceset` and `accountreferenceremove` alike, a session's own and the founder's, and no other member's reference is written; a forged `member` in the address is replaced by the session's", async () => {
  const x = accountsWorld();
  await x.setup();
  for (const [who, token, own, viewer] of [["ann", x.S.ann, "ann", "member:ann"], ["the founder", x.S.founder, "admin", "admin"]]) {
    for (const named of ["bea", "member:bea", ...(who === "ann" ? ["admin"] : ["ann"])]) {
      x.env.calls.length = 0;
      const bystander = who === "ann" ? "bea" : "ann";
      const before = x.snapshot();
      const set = await call(x.env, { op: "accountreferenceset", token, method: "POST", params: { member: "bea" }, body: { member: named, kind: "apikey", secret: SENTINEL } });
      assert.equal(set.status, 200, `${who}/set/${named}: ${set.text.slice(0, 200)}`);
      assert.equal(set.json.result.ok, true, `${who}/set/${named}: the act is the caller's own`);
      assert.equal(set.text.includes(SENTINEL), false);
      const [inner] = opCalls(x.env).filter((c) => c.route === "accountreferenceset");
      assert.equal(inner.params.member, viewer, `${who}/${named}: the address's member is the session's, not the caller's`);
      assert.equal((await x.a.accountReferenceState({ member: own, viewer })).kind, "apikey", `${who}/${named}: the caller's own reference is held`);
      if (named !== own) assert.notEqual(x.snapshot(), before, `${who}/${named}: control: the act wrote the caller's own reference`);
      assert.equal((await x.a.accountReferenceState({ member: bystander, viewer: bystander === "bea" ? "member:bea" : "member:ann" }))?.kind ?? null, null, `${who}/${named}: no other member holds one`);
      const off = await call(x.env, { op: "accountreferenceremove", token, method: "POST", params: { member: "bea" }, body: { member: named } });
      assert.equal(off.json.result.ok, true, `${who}/remove/${named}`);
      assert.notEqual((await x.a.accountReferenceState({ member: own, viewer }))?.kind, "apikey", `${who}/${named}: the caller's own reference is gone`);
    }
  }
  /* a machine credential is no member behind the op: refused at the door, nothing sent */
  x.env.calls.length = 0;
  const m = await call(x.env, { op: "accountreferenceset", token: x.env.MEMBER_TOKEN, method: "POST", body: { member: "ann", kind: "apikey", secret: SENTINEL } });
  assert.equal(m.json.ok, false);
  assert.deepEqual(opCalls(x.env).filter((c) => c.route === "accountreferenceset"), []);
});

test("R96 (control): `stepsource` and `stepsourcewithdraw` still take no `member` from the body: a body `member` naming another member is deleted and the session's own is the address's, for a member and the founder", async () => {
  assert.ok(Object.keys(connectionsOps(null, U, null, {})).includes("stepsource"), "a route of connections' map");
  const w = world({ answer: (c) => (["stepsource", "stepsourcewithdraw"].includes(c.route) ? ok({ ok: true, route: c.route }) : null) });
  for (const op of ["stepsource", "stepsourcewithdraw"])
    for (const [token, who] of [[w.S.ann, "member:ann"], [w.S.founder, "admin"]]) {
      w.env.calls.length = 0;
      const r = await call(w.env, { op, token, method: "POST", params: { ...FORGED_QUERY, member: FORGED },
        body: { relation: "supports", captureSha: "a".repeat(64), id: "SS-1", reason: "r", member: "member:bea", viewer: FORGED } });
      assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
      const [inner] = opCalls(w.env).filter((c) => c.route === op);
      assert.equal(Object.hasOwn(inner.body, "member"), false, `${op}: the body's member is deleted`);
      assert.deepEqual([inner.params.member, inner.params.viewer], [who, who], `${op}: the address's are the session's`);
      assert.deepEqual([inner.body.relation, inner.body.id], ["supports", "SS-1"], `${op}: the rest of the body kept`);
      noForged(inner, op);
    }
});

test("R96 (R29): an op that declares `member` in the address has the caller's copy there deleted and the session's set, whether or not its body `member` is kept: `accountreference`, `accountreferenceset`, `accountreferenceremove`, `stepsource`, `stepsourcewithdraw`", async () => {
  const declared = Object.keys(O.OP_STAMPS).filter((op) => O.OP_STAMPS[op].includes("member"));
  /* the ops t48.mjs declares with the `member` stamp: ai-accounts' three account-reference ops (`extra`) and connections' two acts (its actor) */
  const MEMBER_ADDRESSED = [...Object.keys(T48_FAMILIES.find((f) => f.owner === "ai-accounts").extra),
                            ...Object.keys(T48_FAMILIES.find((f) => f.owner === "connections").ops)];
  assert.equal(MEMBER_ADDRESSED.length, 5);
  for (const op of MEMBER_ADDRESSED)
    assert.ok(declared.includes(op), `${op} declares the member stamp`);
  const w = world({ answer: (c) => ok({ ok: true, route: c.route }) });
  for (const op of declared.filter((o) => OPS[o] && OPS[o].machineClasses?.length === 0 && OPS[o].classes?.includes("member"))) {
    w.env.calls.length = 0;
    await call(w.env, { op, token: w.S.ann, method: OPS[op].mutating ? "POST" : "GET", params: { member: FORGED }, ...(OPS[op].mutating ? { body: {} } : {}) });
    for (const c of opCalls(w.env).filter((x) => x.route === op)) assert.equal(c.params.member, "member:ann", `${op}: the address's member is the session's`);
  }
});

/* ================================================================ R97 */

test("R97 (T49; N1072, K3265; amends R15; `credentials` R74, R75): `claim`, checked against the bootstrap credential first, passes the body's `handle` beside `password` and no `role`; the answer is relayed with its `handle`", async () => {
  const w = world({ answer: (c) => (c.route === "claim" ? reply({ ok: true, result: { ok: true, claimed: true, handle: c.body.handle } }) : null) });
  const r = await call(w.env, { op: "claim", method: "POST",
    body: { bootstrapToken: w.env.ADMIN_TOKEN, password: "a long password sentence", handle: "maria-founder", role: "member", by: FORGED, extra: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.json.result.handle, "maria-founder", "the claim's answer is relayed with its handle");
  const [c] = w.env.calls;
  assert.equal(c.route, "claim");
  assert.deepEqual(c.body, { handle: "maria-founder", password: "a long password sentence" }, "the handle reaches credentials.claim; no role does");
  assert.equal(Object.hasOwn(c.body, "role"), false);
  assert.equal(JSON.stringify(c.body).includes(w.env.ADMIN_TOKEN), false, "the bootstrap credential never crosses");
  /* control: a claim with no handle passes none (the founder signs in as `admin`, `credentials` R75), and still no role */
  const w2 = world();
  const none = await call(w2.env, { op: "claim", method: "POST", body: { bootstrapToken: w2.env.ADMIN_TOKEN, password: "a long password sentence", role: "admin" } });
  assert.equal(none.status, 200);
  const sent = w2.env.calls[0].body;
  assert.deepEqual([Object.hasOwn(sent, "handle") && sent.handle !== undefined, Object.hasOwn(sent, "role")], [false, false]);
  assert.equal(sent.password, "a long password sentence");
  /* control: R15 stands first — a differing bootstrap credential reaches nothing, whatever the handle */
  const w3 = world();
  refused(await call(w3.env, { op: "claim", method: "POST", body: { bootstrapToken: "no", password: "p", handle: "maria-founder" } }), 403,
          "BOOTSTRAP_CREDENTIAL_MISMATCH", "C-68.4");
  assert.equal(w3.env.calls.length, 0, "nothing was sent to the store");
});

test("R97 (T49): `founderhandleset` is a route of membership's map and is declared for the founder's own session alone; under it the door stamps `by` from the session and passes `handle` from the body, a stamp the caller sends being deleted", async () => {
  assert.ok(Object.keys(membershipOps({}, U, null, {})).includes("founderhandleset"), "a route of membership's map");
  assert.ok(OPS.founderhandleset, "op-declarations R71 declares it");
  assert.deepEqual([OPS.founderhandleset.classes, OPS.founderhandleset.machineClasses, OPS.founderhandleset.mutating], [["admin"], [], true]);
  const w = world({ answer: (c) => (c.route === "founderhandleset" ? ok({ ok: true, handle: c.body.handle }) : null) });
  const r = await call(w.env, { op: "founderhandleset", token: w.S.founder, method: "POST", params: { ...FORGED_QUERY },
                                body: { handle: "maria-founder", by: FORGED, viewer: FORGED, actorIdentity: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.json.result.handle, "maria-founder");
  const [inner] = opCalls(w.env).filter((c) => c.route === "founderhandleset");
  assert.equal(inner.params.by, "admin", "by from the founder's session");
  assert.equal(inner.body.handle, "maria-founder", "handle from the body");
  noForged(inner, "founderhandleset");
});

test("R97 (controls): `founderhandleset` under a member's session (an enrolled administrator's included), under every binding credential and under an `ai` credential, or under none, is refused at the door with nothing sent to the store", async () => {
  const w = world({ sessions: { dee: { role: "member:dee", capabilities: [], administer: true, rootOfTrust: false, handle: "dee" } },
                    answer: (c) => (c.route === "founderhandleset" ? ok({ ok: true }) : null) });
  const body = { handle: "maria-founder" };
  const callers = [["a member", w.S.ann], ["a member without capabilities", w.S.bare], ["an enrolled administrator", "dee"],
                   ["the bootstrap credential", w.env.ADMIN_TOKEN], ["the member credential", w.env.MEMBER_TOKEN],
                   ["the probe credential", w.env.PROBE_TOKEN], ["the daemon credential", w.env.DAEMON_TOKEN],
                   ["an agent credential", w.A.ann], ["no credential", undefined]];
  for (const [who, token] of callers) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "founderhandleset", token, method: "POST", body });
    assert.equal(r.json?.ok, false, `${who}: ${r.text.slice(0, 200)}`);
    assert.ok(r.status >= 400 && r.status < 500, `${who}: ${r.status}`);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "founderhandleset"), [], `${who}: nothing sent to the store`);
  }
  /* control: the founder's session is the one that reaches it */
  w.env.calls.length = 0;
  const f = await call(w.env, { op: "founderhandleset", token: w.S.founder, method: "POST", body });
  assert.equal(f.status, 200);
  assert.equal(opCalls(w.env).filter((c) => c.route === "founderhandleset").length, 1);
});

/* ================================================================ R98 */

test("R98 (T49; N1091; DEC-237 (3); `op-declarations` R72, `project-roster` R30): `projectownervotes` is a route of project-roster's map; an owner's session reads a change waiting on agreement, `viewer` stamped from the session and the project passed from the query; the owner's answer, the absent one included, is relayed as given", async () => {
  assert.ok(Object.keys(projectRosterOps(null, U, null, {})).includes("projectownervotes"), "a route of project-roster's map");
  assert.ok(OPS.projectownervotes, "op-declarations R72 declares it");
  assert.deepEqual([OPS.projectownervotes.machineClasses, OPS.projectownervotes.mutating], [[], false]);
  const votes = [{ change: "add", target: "bea", proposed_by: "ann", proposed_at: "2026-10-14T00:00:00Z", agreed: ["ann"], awaiting: ["dee"] }];
  const answers = { "member:ann": votes, "member:bea": [] };
  const w = world({ answer: (c) => (c.route === "projectownervotes"
    ? ok(c.params.viewer === "member:bea" ? { ok: true, absent: true } : { ok: true, projectId: c.params.projectId, votes: answers[c.params.viewer] ?? votes }) : null) });
  const r = await call(w.env, { op: "projectownervotes", token: w.S.ann, params: { projectId: "PROJ-2026-0001", ...FORGED_QUERY } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.deepEqual(r.json.result.votes, votes, "the owner's answer is relayed as given");
  const [inner] = opCalls(w.env).filter((c) => c.route === "projectownervotes");
  assert.equal(inner.params.viewer, "member:ann", "viewer from the session");
  assert.equal(inner.params.projectId, "PROJ-2026-0001", "the project from the query");
  assert.equal(inner.method, "GET");
  noForged(inner, "projectownervotes");
  /* the founder is stamped admin; the absent answer is relayed as given (member bea) */
  w.env.calls.length = 0;
  await call(w.env, { op: "projectownervotes", token: w.S.founder, params: { projectId: "PROJ-2026-0001", viewer: FORGED } });
  assert.equal(opCalls(w.env).find((c) => c.route === "projectownervotes").params.viewer, "admin");
  const bea = await call(w.env, { op: "projectownervotes", token: w.S.bare, params: { projectId: "PROJ-2026-0001" } });
  assert.equal(bea.status, 200);
  assert.equal(bea.json.result.absent, true, "the owner's absent answer for the viewer stamped from bea's own session is relayed as given");
});

test("R98 (controls): a `viewer` the caller sends in the query or the body is deleted; an `ai` credential, a binding credential and no credential are refused with nothing sent to the store", async () => {
  const w = world({ answer: (c) => (c.route === "projectownervotes" ? ok({ ok: true, votes: [] }) : null) });
  for (const [where, init] of [["query", { params: { projectId: "P-1", viewer: FORGED } }],
                               ["body", { method: "POST", params: { projectId: "P-1" }, body: { viewer: FORGED } }]]) {
    w.env.calls.length = 0;
    await call(w.env, { op: "projectownervotes", token: w.S.ann, ...init });
    const [inner] = opCalls(w.env).filter((c) => c.route === "projectownervotes");
    assert.ok(inner, `${where}: reached the route`);
    assert.equal(inner.params.viewer, "member:ann", `${where}: viewer the session's`);
    noForged(inner, where);
  }
  for (const [who, token] of [["an agent credential", w.A.ann], ["an organisation agent credential", w.A.org], ["the member credential", w.env.MEMBER_TOKEN],
                              ["the bootstrap credential", w.env.ADMIN_TOKEN], ["the probe credential", w.env.PROBE_TOKEN], ["no credential", undefined]]) {
    w.env.calls.length = 0;
    const r = await call(w.env, { op: "projectownervotes", token, params: { projectId: "P-1" } });
    assert.equal(r.json?.ok, false, `${who}: ${r.text.slice(0, 200)}`);
    assert.deepEqual(opCalls(w.env).filter((c) => c.route === "projectownervotes"), [], `${who}: nothing sent to the store`);
  }
});

/* ================================================================ R99 */

const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8"))
  .modules["control-plane"].reads;

test("R99 (T49; K3366; DEC-257, DEC-258; `setup-words` R11–R13): every key this module reads — the `reads` list for it in `words-reads.json` — is a word the list holds, and the module reads each one it draws", async () => {
  assert.ok(READS.length >= 11);
  for (const key of READS) assert.equal(hasWord(key), true, `${key} is held`);
  /* the keys it draws (DEC-267: the unbound refusal reads `refusal.AGENT_WORKER_UNBOUND`, the group's draft `draft.machine.label.group`),
     each exercised below */
  for (const key of ["refusal.AGENT_WORKER_UNBOUND", "credential.token.once", "draft.machine.label", "draft.machine.label.group",
    "file.archive.entry.summary", "file.archive.entry.title", "file.archive.provenance", "file.archive.summary", "file.archive.title",
    "file.log.unpacked", "screen.review-copy.link.once", "template.review.secret.once"]) assert.equal(hasWord(key), true, `${key} is held`);
  /* control: a key the list does not hold */
  assert.equal(hasWord("control-plane.no-such-key"), false);
});

test("R99 (K3366; U260): the one-time answers carry the words of their keys: a minted credential `credential.token.once`, a review grant `screen.review-copy.link.once`, a template grant `template.review.secret.once`", async () => {
  const { env, S } = world();
  const mint = await call(env, { op: "aicredentialmint", token: S.ann, method: "POST", body: { writes: [] } });
  const grant = await call(env, { op: "reviewgrant", token: S.founder, method: "POST", body: {} });
  const tgrant = await call(env, { op: "templatereviewgrant", token: S.founder, method: "POST", body: {} });
  for (const [r, field, key] of [[mint, "tokenIsShownOnce", "credential.token.once"], [grant, "secretIsShownOnce", "screen.review-copy.link.once"],
                                 [tgrant, "secretIsShownOnce", "template.review.secret.once"]]) {
    assert.equal(r.status, 200, r.text.slice(0, 200));
    assert.equal(r.json.result[field], word(key), `${field} is ${key}`);
  }
  assert.notEqual(word("screen.review-copy.link.once"), word("template.review.secret.once"), "the two grants speak their own words");
});

test("R99 (U260): with no assistant bound, `textcheck`, `readtranslate` and `airundispatch` are refused 503 AGENT_WORKER_UNBOUND in the words of `refusal.AGENT_WORKER_UNBOUND`, and nothing is sent", async () => {
  const { env, S } = world();
  for (const [op, body] of [["textcheck", { text: "the lift was out" }], ["readtranslate", { subject: { kind: "note", id: "NOTE-1" }, language: "es" }],
                            ["airundispatch", { run: "RUN-1" }]]) {
    env.calls.length = 0;
    const r = await call(env, { op, token: S.ann, method: "POST", body });
    assert.deepEqual([r.status, r.json.reason], [503, "AGENT_WORKER_UNBOUND"], `${op}: ${r.text.slice(0, 200)}`);
    assert.equal(r.json.detail, word("refusal.AGENT_WORKER_UNBOUND"), `${op}: the refusal's words`);
    assert.deepEqual(opCalls(env).filter((c) => c.route === op), [], `${op}: nothing sent`);
  }
});

test("R99 (K3366): a checked draft carries its note by key: the writing help `draft.machine.label`, the group description `draft.machine.label.group`", async () => {
  const w = world({ answer: (c) => (["writinghelp", "groupdescriptiondraft"].includes(c.route)
    ? reply({ ok: true, result: { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE", firsthand: false } }) : null) });
  const get = w.env.STORE.get.bind(w.env.STORE);
  w.env.STORE.get = (id) => ({ ...get(id), async draft(args) {
    return reply({ ok: true, task: { op: args.op }, draft: { text: "The lift was out.", focus: "Tenants.", purpose: "Tenants." },
                   label: { kind: "machine" }, usage: null, calls: 1, grant: null, suggestions: false, read: [] });
  } });
  const hooks = { publicOp: async () => M.json({ ok: true }), publicInstanceGroup: async () => ({ answered: true, result: {} }),
                  gatedOp: async (ctx) => (ctx.op === "affordances" ? M.json({ ok: true, result: { catalog: [], vocabularies: {} } }) : undefined) };
  const help = await call(w.env, { op: "writinghelp", token: w.S.ann, method: "POST", hooks, body: { op: "notewrite", field: "text", told: "the lift was out" } });
  const gdd = await call(w.env, { op: "groupdescriptiondraft", token: w.S.founder, method: "POST", hooks, body: { answers: [{ question: "Who?", text: "Tenants" }] } });
  assert.equal(help.status, 200, help.text.slice(0, 300));
  assert.equal(gdd.status, 200, gdd.text.slice(0, 300));
  assert.equal(help.json.result.note, word("draft.machine.label"));
  assert.equal(gdd.json.result.note, word("draft.machine.label.group"));
  assert.notEqual(word("draft.machine.label"), word("draft.machine.label.group"));
});

test("R99 (K3366, DEC-258): the bundle an unpack files is drawn in the words of the archive keys: an archive's own document `file.archive.title`, `file.archive.summary`; a file cut out of it `file.archive.entry.title`, `file.archive.entry.summary`; both `file.archive.provenance` and the session log's `file.log.unpacked`", async () => {
  const S64 = (c) => c.repeat(64);
  const doc = (sha, extra = {}) => ({ file: `snapshots/f-${sha.slice(0, 6)}`, locator: `https://example.org/a.zip#zip:${sha[0]}`, retrieved: "2026-10-07T00:00:00Z",
                                      capture: { sha256: sha, bytes: 3, method: "unpacked" }, ...extra });
  const archive = doc(S64("a"), { file: "snapshots/archive", locator: "https://example.org/a.zip" });
  const entry = doc(S64("b"), { container: { archive_sha256: S64("a"), index: 0, path: "one.pdf" } });
  const promoted = [];
  let n = 0;
  const stub = { fetch: async (req) => {
    const r = req instanceof Request ? req : new Request(String(req));
    const route = new URL(r.url).pathname.slice(1);
    if (route === "allocid") return reply({ ok: true, result: { id: `INFO-2026-${String(++n).padStart(4, "0")}` } });
    promoted.push(JSON.parse(await r.text()));
    return reply({ ok: true, result: { ok: true, bundleId: promoted.at(-1).bundleId } });
  } };
  const done = await promoteArchive({ stub, doAnswer: M.doAnswer, docs: [archive, entry], project: "PROJ-2026-0001", archiveSha: S64("a"),
                                      who: { author: "ann" } });
  assert.deepEqual(done.not_promoted, []);
  const [own, cut] = promoted.map((p) => ({ title: p.meta.title, md: p.files.find((f) => f.path === "bundle.md").text }));
  assert.equal(own.title, word("file.archive.title", { source: "https://example.org/a.zip" }));
  assert.equal(cut.title, word("file.archive.entry.title", { path: "one.pdf", archive: S64("a") }));
  assert.ok(own.md.includes(word("file.archive.summary")), "the archive's summary");
  assert.ok(cut.md.includes(word("file.archive.entry.summary", { archive: S64("a") })), "the entry's summary");
  assert.equal(own.md.includes(word("file.archive.entry.summary", { archive: S64("a") })), false, "the archive does not speak as a cut file");
  for (const md of [own.md, cut.md]) {
    assert.ok(md.includes(word("file.archive.provenance")), "the provenance note");
    assert.ok(md.includes(`Changes: ${word("file.log.unpacked")}`), "the session log's change");
  }
});
