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
import { M, O, world, call, opCalls, refused, FORGED } from "./harness.mjs";
import { ok } from "./door-routes.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
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

/* (op-grades R57, PR 866; ai-accounts R35, R38, R40) the alpha account-reference ops are retired with their grade rows: a
   member's own key is now her own AI account, `aiownadd`, whose owner ai-accounts takes from the stamp alone. R96's door
   half is held on it: the address's `by` is the session's, a caller's stamps never reach the store, the body's key reaches
   the owner and is never answered, and ai-accounts' own route lands the act on the stamped member whatever the body names. */
const RETIRED_REFERENCE_OPS = ["accountreference", "accountreferenceset", "accountreferenceremove"];

test("R96, R2 (op-grades R57, PR 866): the retired account-reference ops are declared by no registration and answered as ops with no spec (400 UNKNOWN_OP), nothing asked of the store and the key in no answer", async () => {
  const w = world();
  for (const op of RETIRED_REFERENCE_OPS) {
    assert.equal(Object.hasOwn(OPS, op), false, `${op}: no spec`);
    w.env.calls.length = 0;
    const r = await call(w.env, { op, token: w.S.ann, method: "POST", body: { member: "ann", kind: "apikey", secret: SENTINEL } });
    refused(r, 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(r.text.includes(SENTINEL), false, op);
    assert.deepEqual(opCalls(w.env), [], `${op}: nothing asked of the store`);
  }
});

test("R96 (T53; op-grades R57; ai-accounts R38, R40; R29, R30): through the real door a member's own account act, `aiownadd`, reaches ai-accounts' route with `by` the session's own (a member's and the founder's), no forged stamp in the address or body, the body's key passed and never answered; a machine credential and the retired member key are refused before the store", async () => {
  const w = world({ answer: (c) => (c.route === "aiownadd" ? ok({ ok: true, route: c.route }) : null) });
  for (const [who, token, by] of [["ann", w.S.ann, "member:ann"], ["the founder", w.S.founder, "admin"]]) {
    w.env.calls.length = 0;
    const set = await call(w.env, { op: "aiownadd", token, method: "POST", params: { ...FORGED_QUERY, member: FORGED },
                                    body: { owner: "member:bea", provider: "anthropic", plan: "api-member", secret: SENTINEL, by: FORGED } });
    assert.equal(set.status, 200, `${who}: ${set.text.slice(0, 300)}`);
    assert.equal(set.text.includes(SENTINEL), false, `${who}: the key is never answered`);
    const [inner] = opCalls(w.env).filter((c) => c.route === "aiownadd");
    assert.equal(inner.params.by, by, `${who}: the address's by is the session's`);
    assert.equal(inner.body.secret, SENTINEL, `${who}: negative control: the body's key reaches the owner`);
    noForged(inner, `${who}/aiownadd`);
  }
  for (const token of [w.env.ADMIN_TOKEN, w.env.DAEMON_TOKEN]) {
    w.env.calls.length = 0;
    const m = await call(w.env, { op: "aiownadd", token, method: "POST", body: { secret: SENTINEL } });
    assert.equal(m.status, 403, "a machine credential");
    assert.deepEqual(opCalls(w.env), []);
  }
  w.env.calls.length = 0;
  refused(await call(w.env, { op: "aiownadd", token: w.env.MEMBER_TOKEN, method: "POST", body: { secret: SENTINEL } }), 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
  assert.deepEqual(opCalls(w.env), []);
});

test("R96 (controls; ai-accounts R38, R40): the store's route for `aiownadd`, ai-accounts' own map, lands the act on the stamped member: a body `owner` naming another member is never the account's owner", () => {
  const asked = [];
  const a = { accountSet: (args) => { asked.push(args); return { ok: true }; } };
  for (const [by, own] of [["member:ann", "member:ann"], ["ann", "member:ann"]]) {
    asked.length = 0;
    aiAccountsOps(a, new URL(`http://do/aiownadd?by=${encodeURIComponent(by)}`), { owner: "member:bea", secret: SENTINEL }, {}).aiownadd();
    assert.equal(asked.length, 1);
    assert.equal(asked[0].owner, own, `${by}: the owner is the stamped member`);
  }
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

test("R96 (R29): an op that declares `member` in the address has the caller's copy there deleted and the session's set, whether or not its body `member` is kept: `stepsource`, `stepsourcewithdraw` (the account-reference ops retired, op-grades R57)", async () => {
  const declared = Object.keys(O.OP_STAMPS).filter((op) => O.OP_STAMPS[op].includes("member"));
  /* the ops t48.mjs declares with the `member` stamp: connections' two acts (its actor); ai-accounts' three account-reference
     ops were retired by op-grades R57 */
  const MEMBER_ADDRESSED = Object.keys(T48_FAMILIES.find((f) => f.owner === "connections").ops);
  assert.ok(MEMBER_ADDRESSED.length > 0);
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
