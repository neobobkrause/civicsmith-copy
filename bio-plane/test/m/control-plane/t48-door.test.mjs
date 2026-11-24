/* control-plane T48's routes (T48-77): R90 (`actionreplyquoting`, `proceedingdates`, `followregister`'s `proceeding`,
   `readtranslate` sent to the plane's draft door), R91 (the update read and acts through `instance-setup`'s map),
   R92 (the ops T48's lower layers add), R93 (the request's trace and member ref minted and handed to the plane's ask,
   run, draft and transcribe calls), R94 (the 24 account ops through `ai-accounts`' map) and R95 (the page's test-instance
   option). Driven through `makeFetch(hooks)` over the harness's store. Each op is also checked to be a route of its owner's
   own map, so the store's door that composes those maps (plane R5) reaches its handler: where the owner is one of this
   module's declared uses. (`action-replies`, `explore`, `standards` and `filings` are not yet among them, so their maps'
   composition is `plane` R5's test, and here each is driven through the door.) */
import { test } from "node:test";
import { T48_SHARES, T48_FAMILIES } from "../../../src/op-declarations/t48.mjs";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, refused, aik, cred, FORGED } from "./harness.mjs";
import { routesForSessions, callers, ok } from "./door-routes.mjs";
import { memberRefOf } from "../../../src/signin-door/index.mjs";
import { actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { exploreOps } from "../../../src/explore/ops.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";
import { connectionsOps } from "../../../src/connections/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { reviewOps } from "../../../src/review/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { instanceSetupOps } from "../../../src/setup.mjs";
import { ownerOps as controlPlaneOwnerOps } from "../../../src/store-assembly/owner-ops.mjs";

const { OPS, OP_STAMPS } = O;
const U = new URL("http://do/x");
/* a map handed the store's environment sets it on its owner's instance (ai-use R17, member-roster's `m.env`), so it is built over one: an empty stand-in lists the routes and no arm runs */
const routesOf = (f, ...rest) => Object.keys(f(rest.length ? {} : null, U, null, ...rest));
const FORGED_QUERY = { viewer: FORGED, identity: FORGED, author: FORGED, by: FORGED, actor: FORGED, who: FORGED, origin: FORGED,
                       administer: "1" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status });
const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
const noForged = (c, label) => assert.equal(JSON.stringify([c.url.href, c.body, c.headers]).includes(FORGED), false,
                                             `${label}: a caller's stamp reached the store`);
/* A store whose objects carry the RPC methods `methods` names (each a recorder), beside the harness's routes. */
function withObject(w, methods) {
  const get = w.env.STORE.get.bind(w.env.STORE);
  w.env.STORE.get = (id) => ({ ...get(id), ...Object.fromEntries(Object.entries(methods).map(([k, f]) => [k, (args) => f(args, id)])) });
  return w;
}

/* ================================================================ R90 */

test("R90 (T48; N880, N882; op-declarations R64; `action-replies` R10, `following` R29, R30): `actionreplyquoting` and `proceedingdates` (a route of `following`'s map) are each declared for a member's session only; each reaches its route for the founder's and a member's session with its declared stamps set from the session and none taken from the caller, its request fields as sent; every machine credential, an `ai` credential among them, is refused with nothing forwarded (control)", async () => {
  assert.ok(routesOf(actionRepliesOps).includes("actionreplyquoting"), "a route of action-replies' map");
  assert.ok(routesOf(followingOps).includes("proceedingdates"), "a route of following's map");
  /* `actionreplyquoting` is a session's act; `proceedingdates` is, in op-declarations R64's spec, a read a binding class may reach
     (REPORT to BOB: R90 says session only), so the machine control is asked of the act alone */
  assert.deepEqual(OPS.actionreplyquoting?.machineClasses, [], "actionreplyquoting: a session only");
  await routesForSessions(["actionreplyquoting", "proceedingdates"],
    (op) => (op === "actionreplyquoting" ? { target: "ACT-1", ord: 2, quotable: true, words: "the lift" } : {}),
    { refuseMachines: (op) => op === "actionreplyquoting" });
});

test("R90 (T48; `following` R29): `followregister` passes `proceeding` from the body, and a stamp the caller sends in the address or the body is deleted", async () => {
  const w = world({ answer: (c) => (c.route === "followregister" ? ok({ ok: true }) : null) });
  const r = await call(w.env, { op: "followregister", token: w.S.ann, method: "POST", params: { ...FORGED_QUERY },
                                body: { proceeding: "PROC-1", by: FORGED, viewer: FORGED, actorIdentity: FORGED } });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  const inner = opCalls(w.env).find((c) => c.route === "followregister");
  assert.equal(inner.body.proceeding, "PROC-1", "the body's proceeding passes");
  noForged(inner, "followregister");
});

/* A world whose objects answer the plane's draft door for `readtranslate` as plane R50 states: the translation, labelled. */
function translateWorld({ drafted = null, status = 200 } = {}) {
  const asked = [];
  const w = world();
  withObject(w, { draft: async (args, id) => {
    asked.push({ ns: id, ...args });
    return reply(drafted ?? { ok: true, translation: "Hola", language: "es", from_language: "en", label: { kind: "machine" },
      original: { kind: "note", id: "NOTE-1", text: "Hello" }, grant: null, suggestions: false, read: [], usage: USE, calls: 1 }, status);
  } });
  return { ...w, asked };
}

test("R90 (T48; N670; `plane` R50, `agent-worker` R86; R57's pattern): `readtranslate` is sent to the plane's draft door as `{op, member, session, subject, language}` from the body alone (no told, grant, firsthand or pack; a `subject` in the address never reaches it), answered as the plane answers it labelled, with its use counted as a draft and nothing recorded or handed to an owner", async () => {
  assert.deepEqual([OPS.readtranslate?.classes, OPS.readtranslate?.machineClasses, OPS.readtranslate?.mutating],
                   [["admin", "member"], [], false]);
  const x = translateWorld();
  for (const [token, member] of [[x.S.ann, "ann"], [x.S.founder, "admin"]]) {
    x.asked.length = 0; x.env.calls.length = 0;
    const r = await call(x.env, { op: "readtranslate", token, method: "POST", params: { subject: "from the address", by: FORGED },
      body: { subject: { kind: "note", id: "NOTE-1" }, language: "es", told: "x", firsthand: true, by: FORGED } });
    assert.equal(r.status, 200, r.text.slice(0, 300));
    assert.equal(x.asked.length, 1);
    const { trace, memberRef, ...rest } = x.asked[0];
    assert.deepEqual(rest, { ns: "bio", op: "readtranslate", member, session: token, subject: { kind: "note", id: "NOTE-1" }, language: "es" });
    for (const k of ["told", "grant", "firsthand", "pack"]) assert.equal(Object.hasOwn(rest, k), false, `no ${k}`);
    assert.deepEqual(r.json.result, { ok: true, translation: "Hola", language: "es", from_language: "en", label: { kind: "machine" },
                                      original: { kind: "note", id: "NOTE-1", text: "Hello" } });
    assert.deepEqual(opCalls(x.env).map((c) => [c.route, c.body?.mode]), [["askusage", "draft"]], "counted; nothing recorded");
  }
});

test("R90 (controls; T48): the plane's ending (a refusal it gives, or a silence) is relayed as given and counts no use; `readtranslate` is refused to every machine credential, an `ai` credential among them, before anything is asked; with no draft door on the object the door answers 503 AGENT_WORKER_UNBOUND", async () => {
  const ending = translateWorld({ drafted: { ok: false, code: "NO_SUCH_NOTE", detail: "no such note", grant: "G" }, status: 404 });
  const e = await call(ending.env, { op: "readtranslate", token: ending.S.ann, method: "POST", body: { subject: { kind: "note", id: "NOTE-9" } } });
  assert.deepEqual([e.status, e.json.ok, e.json.code], [404, false, "NO_SUCH_NOTE"]);
  assert.equal(e.text.includes("\"G\""), false, "the grant is never answered");
  assert.equal(opCalls(ending.env).some((c) => c.route === "askusage"), false, "an ending counts no use");
  const agent = aik();
  const m = withObject(world({ creds: { [agent]: cred({ writes: Object.keys(OPS) }) } }), { draft: async () => { throw new Error("asked"); } });
  for (const token of [m.env.ADMIN_TOKEN, m.env.DAEMON_TOKEN, m.env.PROBE_TOKEN, agent]) {
    const r = await call(m.env, { op: "readtranslate", token, method: "POST", params: token === m.env.PROBE_TOKEN ? { store: "scratch" } : {},
                                  body: { subject: { kind: "note", id: "NOTE-1" } } });
    assert.equal(r.json.ok, false);
    assert.notEqual(r.status, 200);
  }
  const bare = world();
  const u = await call(bare.env, { op: "readtranslate", token: bare.S.ann, method: "POST", body: { subject: { kind: "note", id: "NOTE-1" } } });
  assert.deepEqual([u.status, u.json.reason], [503, "AGENT_WORKER_UNBOUND"]);
});

/* ================================================================ R91 */

test("R91 (T48; N1047; K3189; `instance-setup` R89, R90; op-declarations R66): `updatenotice`, `updatestart`, `updatelater` and `updateskip` are routes of `instance-setup`'s map, declared for a member's session only; each reaches its route with `by` and `viewer` set from the session where declared, `version` and `reason` from the body, and a `by` the caller sends in the address or the body deleted; every machine credential is refused with nothing forwarded (control)", async () => {
  const UPDATE_OPS = ["updatenotice", "updatestart", "updatelater", "updateskip"];
  for (const op of UPDATE_OPS) {
    assert.ok(routesOf(instanceSetupOps, {}).includes(op), `${op} is a route of instance-setup's map`);
    assert.deepEqual(OPS[op]?.machineClasses, [], `${op}: a session only`);
  }
  await routesForSessions(UPDATE_OPS, (op) => (op === "updatenotice" ? {} : op === "updateskip" ? { version: "0.85.0", reason: "later" } : { version: "0.85.0" }));
});

test("R91 (T48; `updatestart`'s address): the answered `address` is relayed as given and never logged by the door", async () => {
  const ADDRESS = "https://dash.example/deploy?x=SECRET-ADDRESS-1";
  const w = world({ answer: (c) => (c.route === "updatestart" ? ok({ ok: true, address: ADDRESS }) : null) });
  const logged = [];
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const k of Object.keys(orig)) console[k] = (...a) => logged.push(a.map(String).join(" "));
  let r;
  try { r = await call(w.env, { op: "updatestart", token: w.S.ann, method: "POST", body: { version: "0.85.0" } }); }
  finally { Object.assign(console, orig); }
  assert.equal(r.json.result.address, ADDRESS, "relayed as given");
  assert.equal(logged.join("\n").includes("SECRET-ADDRESS-1"), false, "never logged");
});

/* ================================================================ R92 */

test("R92 (T48; N1026, N1027, N1029, N1030, N1034, N1035, N1038, N1043; K3203, K3206, K3207, K3211; op-declarations R67): `aiuseovertime` (through `aiUseOps`), `exploregraph`, `standardproposals`, `filingread`, `pressurefor`, `planask`, `lookedsince`, `stepsource` and `stepsourcewithdraw` each reach its route with the stamps it declares from the session and none from the caller, its request fields as sent", async () => {
  const OWNERS = { aiuseovertime: aiUseOps, exploregraph: exploreOps, standardproposals: standardsOps, filingread: filingsOps, pressurefor: actionHoldsOps, planask: actionPlansOps, stepsource: connectionsOps,
                   stepsourcewithdraw: connectionsOps, lookedsince: membershipOps };
  for (const [op, owner] of Object.entries(OWNERS)) assert.ok(routesOf(owner, {}).includes(op), `${op} is a route of its owner's map`);
  /* the reads' rows say whether a binding class reaches them (op-declarations R67 gives `aiuseovertime` and the acts a
     session only); the machine control is asked of those whose row says `machineClasses: []` */
  /* the reads and the acts of the shares t48.mjs gives `ai-use`, `explore`, `standards`, `filings`, `action-holds`, `action-plans`, `membership` */
  const SHARED = ["ai-use", "explore", "standards", "filings", "action-holds", "action-plans", "membership"].flatMap((k) => Object.keys(T48_SHARES[k].ops));
  assert.equal(SHARED.length, 7);
  await routesForSessions(SHARED,
    (op) => (op === "planask" ? { plan: "PLAN-1" } : {}), { refuseMachines: (op) => OPS[op]?.machineClasses?.length === 0 });
  for (const op of ["aiuseovertime", "planask", "lookedsince"]) assert.deepEqual(OPS[op]?.machineClasses, [], `${op}: a session only`);
  /* the acts that name `member` and `viewer` (never the body's): stepsource, stepsourcewithdraw */
  for (const op of ["stepsource", "stepsourcewithdraw"]) {
    assert.ok(OPS[op], `${op} is declared`);
    assert.deepEqual(OPS[op].machineClasses, [], `${op}: a session only`);
    const x = callers({ answer: (c) => (c.route === op ? ok({ ok: true, route: op }) : null) });
    for (const [token, who] of [[x.w.S.ann, "member:ann"], [x.w.S.founder, "admin"]]) {
      x.w.env.calls.length = 0;
      const r = await call(x.w.env, { op, token, method: "POST", params: { ...FORGED_QUERY, member: FORGED },
        body: { relation: "supports", captureSha: "a".repeat(64), id: "SS-1", reason: "r", member: FORGED, viewer: FORGED } });
      assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
      const inner = opCalls(x.w.env).filter((c) => c.route === op);
      assert.equal(inner.length, 1);
      assert.deepEqual([inner[0].params.member, inner[0].params.viewer], [who, who], `${op}: member and viewer the session's`);
      assert.deepEqual([inner[0].body.relation, inner[0].body.id], ["supports", "SS-1"], `${op}: the body's own fields kept`);
      noForged(inner[0], op);
    }
    for (const m of x.machines) {
      x.w.env.calls.length = 0;
      const r = await call(x.w.env, { op, token: m.token, method: "POST", params: m.params ?? {}, body: { id: "SS-1" } });
      assert.equal(r.json.ok, false, `${op}/${m.name}`);
      assert.deepEqual(opCalls(x.w.env).filter((c) => c.route === op), [], `${op}/${m.name}: nothing forwarded`);
    }
  }
});

test("R92 (T48; `explore` R23, `review` R34): `exploreverify` passes `chain` from the body and `reviewgrant` passes `until` from the body, each beside the stamps the door sets; a caller's stamp in either is deleted", async () => {
  assert.ok(routesOf(exploreOps, {}).includes("exploreverify"));
  assert.ok(routesOf(reviewOps, {}).includes("reviewgrant"));
  const w = world({ answer: (c) => (["exploreverify", "reviewgrant"].includes(c.route) ? ok({ ok: true }) : null) });
  const chain = [{ from: "A", to: "B" }, { from: "B", to: "C" }];
  await call(w.env, { op: "exploreverify", token: w.S.ann, method: "POST", params: { ...FORGED_QUERY }, body: { chain, viewer: FORGED } });
  const v = opCalls(w.env).find((c) => c.route === "exploreverify");
  assert.deepEqual([v.body.chain, v.params.viewer], [chain, "member:ann"]);
  noForged(v, "exploreverify");
  await call(w.env, { op: "reviewgrant", token: w.S.ann, method: "POST", params: { ...FORGED_QUERY },
                      body: { draft: "D1", until: "2026-11-01", secretSha: FORGED } });
  const g = opCalls(w.env).find((c) => c.route === "reviewgrant");
  assert.equal(g.body.until, "2026-11-01", "until passes from the body");
  assert.match(g.body.secretSha, /^[0-9a-f]{64}$/, "the digest is the door's");
  noForged(g, "reviewgrant");
});

/* ================================================================ R93 */

/* Hooks whose gated arm records what the door hands it for `ask` and `pagetranscribe`, answering JSON as the plane does. */
function planeHooks(seen) {
  return {
    publicOp: async () => M.json({ ok: true }), publicInstanceGroup: async () => ({ answered: true, result: {} }),
    gatedOp: async (ctx) => {
      if (ctx.op === "ask" || ctx.op === "pagetranscribe") {
        seen.push({ op: ctx.op, trace: ctx.trace, memberRef: ctx.memberRef });
        return M.json({ ok: true, result: { op: ctx.op } });
      }
      return undefined;
    },
  };
}

test("R93 (T48; N1015; K3103; `agent-worker` R87, `plane` R55, `signin-door` R3): a request that reaches the plane's ask or transcribe call is handed a fresh `trace` (a UUID) and the member ref `signin-door` names for the session's member (twelve hex characters of the instance-salted digest, never a handle or a credential), neither taken from the caller; the trace is answered in the request's answer, and a second request gets another", async () => {
  const w = world();
  const seen = [];
  const ref = await memberRefOf(w.env, "member:ann");
  assert.match(ref, /^[0-9a-f]{12}$/);
  const answers = [];
  for (const op of ["ask", "ask", "pagetranscribe"]) {
    const r = await call(w.env, { op, token: w.S.ann, method: "POST", hooks: planeHooks(seen),
      params: { trace: FORGED, memberRef: FORGED, member_ref: FORGED, sha256: "a".repeat(64) }, body: { trace: FORGED, memberRef: FORGED, question: "q" } });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
    answers.push(r.json);
  }
  assert.equal(seen.length, 3);
  for (const [i, s] of seen.entries()) {
    assert.match(s.trace, UUID, "a minted trace");
    assert.notEqual(s.trace, FORGED);
    assert.equal(s.memberRef, ref, "the member ref of the session's member");
    assert.equal(answers[i].trace, s.trace, "the trace is answered with the request");
  }
  assert.equal(new Set(seen.map((s) => s.trace)).size, 3, "a fresh trace per request");
  assert.equal(JSON.stringify(seen).includes("ann\""), false, "no handle");
  /* the founder's session names `admin` as its member */
  const f = []; await call(w.env, { op: "ask", token: w.S.founder, method: "POST", hooks: planeHooks(f), body: { question: "q" } });
  assert.equal(f[0].memberRef, await memberRefOf(w.env, "admin"));
});

test("R93 (T48; N1015): every draft the door routes (`writinghelp`, `groupdescriptiondraft`, `translationdraft`, `statusreportassist`, `textcheck`, `readtranslate`) hands the object's draft door the trace and member ref, and the draft's answer carries the same trace; the member-run door hands them to `dispatchMemberRun` and answers the trace", async () => {
  const asked = [];
  const w = world({ answer: (c) => {
    if (["writinghelp", "groupdescriptiondraft"].includes(c.route)) return reply({ ok: true, result: { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" } });
    if (c.route === "translationdraft") return reply({ ok: true, result: { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE", direction: "from", language: "es", words: [{ key: "k", en: "x" }] } });
    if (c.route === "translationdraftrecord") return reply({ ok: true, result: { ok: true, recorded: 1 } });
    if (c.route === "statusreportassist") return reply({ ok: true, result: { ok: true, plan: "PLAN-1", as_of: "2026-10-12T00:00:00Z", items: [{ section: "holds", none: true }] } });
    return null;
  } });
  withObject(w, {
    draft: async (args) => { asked.push(args); return reply({ ok: true, label: { kind: "machine" }, usage: USE, calls: 1, grant: null, suggestions: false, read: [],
      translation: "Hola", draft: args.op === "textcheck" ? { sentences: [] } : args.op === "translationdraft" ? [{ key: "k", text: "y" }]
        : args.op === "statusreportdraft" ? { text: "t", sources: [0] } : { text: "t", focus: "f", purpose: "p" } }); },
    dispatchMemberRun: async (args) => { asked.push({ op: "airundispatch", ...args }); return { run: args.run, found: true, dispatched: true, status: "running" }; },
  });
  const ref = await memberRefOf(w.env, "member:ann");
  const bodies = { writinghelp: { op: "notewrite", field: "text", told: "the lift" }, groupdescriptiondraft: { answers: [{ question: "Who?", text: "T" }] },
                   translationdraft: { direction: "from", language: "es", keys: ["k"] }, statusreportassist: { plan: "PLAN-1" },
                   textcheck: { text: "The landlord ignored us." }, readtranslate: { subject: { kind: "note", id: "NOTE-1" } },
                   airundispatch: { run: "RUN-1" } };
  for (const [op, body] of Object.entries(bodies)) {
    asked.length = 0;
    const r = await call(w.env, { op, token: w.S.ann, method: "POST", params: { trace: FORGED }, body: { ...body, trace: FORGED, memberRef: FORGED } });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 300)}`);
    assert.equal(asked.length, 1, `${op}: asked once`);
    assert.match(asked[0].trace, UUID, `${op}: a minted trace`);
    assert.equal(asked[0].memberRef, ref, `${op}: the member ref`);
    assert.equal(r.json.trace, asked[0].trace, `${op}: answered with the request`);
    assert.equal(r.text.includes(FORGED), false, `${op}: a caller's trace is not used`);
  }
});

test("R93 (controls; T48): a request that reaches no ask, run, draft or transcribe call gets no trace in its answer; a caller who is not a member's session is handed none; no trace or member ref crosses into any request the door makes of the store", async () => {
  const w = world();
  const seen = [];
  const who = await call(w.env, { op: "whoami", token: w.S.ann });
  assert.equal(Object.hasOwn(who.json, "trace"), false, "whoami: no trace");
  const m = await call(w.env, { op: "ask", token: w.env.ADMIN_TOKEN, method: "POST", hooks: planeHooks(seen), body: { question: "q" } });
  for (const s of seen) assert.deepEqual([s.trace, s.memberRef], [undefined, undefined], "a binding class is handed none");
  assert.equal(Object.hasOwn(m.json ?? {}, "trace"), false);
  const a = world();
  await call(a.env, { op: "ask", token: a.S.ann, method: "POST", hooks: planeHooks([]), body: { question: "q" } });
  const ref = await memberRefOf(a.env, "member:ann");
  for (const c of [...a.env.calls, ...a.env.windowCalls, ...a.env.countCalls])
    assert.equal(/trace|memberRef|member_ref/i.test(JSON.stringify([c.url.href, c.headers, c.body])) || JSON.stringify([c.url.href, c.headers, c.body]).includes(ref),
                 false, `${c.route}: no trace or member ref in a store request`);
});

/* ================================================================ R94 */

test("R94 (T48; N996; K3101; amends R53, R56, R63, R69): the 24 account ops `op-declarations` R68 moves are each a route of `ai-accounts`' own map (`aiAccountsOps`), and each reaches the store's route of its own name for a member's session with its declared stamps and none from the caller; `groupkeystate` and `accountreferenceset` answer as before with nothing of `credentials` in the fixture", async () => {
  const MOVED = Object.keys(T48_FAMILIES.find((f) => f.owner === "ai-accounts").ops);
  assert.equal(new Set(MOVED).size, 24);
  const routes = routesOf(aiAccountsOps, {});
  for (const op of MOVED) {
    assert.ok(routes.includes(op), `${op} is a route of ai-accounts' map`);
    assert.ok(OPS[op], `${op} is declared`);
    assert.equal(O.OP_FAMILIES["ai-accounts"]?.kinds?.[op] !== undefined, true, `${op} is in ai-accounts' family`);
  }
  /* two of them, driven through the door with the store answering what ai-accounts' route does */
  const w = world({ answer: (c) => (["groupkeystate", "accountreferenceset"].includes(c.route) ? ok({ ok: true, route: c.route }) : null) });
  const gk = await call(w.env, { op: "groupkeystate", token: w.S.ann, params: { viewer: FORGED } });
  assert.deepEqual([gk.status, gk.json.result.route], [200, "groupkeystate"]);
  const gkIn = opCalls(w.env).find((c) => c.route === "groupkeystate");
  assert.equal(gkIn.params.viewer, "member:ann");
  noForged(gkIn, "groupkeystate");
  const ar = await call(w.env, { op: "accountreferenceset", token: w.S.ann, method: "POST", params: { by: FORGED },
                                 body: { kind: "apikey", by: FORGED } });
  assert.deepEqual([ar.status, ar.json.result.route], [200, "accountreferenceset"]);
  const arIn = opCalls(w.env).find((c) => c.route === "accountreferenceset");
  assert.equal(arIn.params.by, "member:ann");
  noForged(arIn, "accountreferenceset");
});

/* ================================================================ R95 */

const BAND = /<div class="cs-band" data-band="test"[^>]*>/;
const asTest = (w) => { w.env.CIVICSMITH_TEST_INSTANCE = "dev-1"; w.env.INSTANCE_NAME = "dev-1"; return w; };

test("R95 (T48; K3250, K3254; walk C2 (a); `interface-shell` R58): a test instance's `/app` (and `/`) HTML holds the test-instance band as served, before any script runs", async () => {
  const w = asTest(world());
  for (const path of ["/app", "/app/projects", "/"]) {
    const r = await call(w.env, { path, hooks: undefined });
    assert.equal(r.status, 200, `${path}: ${r.text.slice(0, 200)}`);
    assert.match(r.headers.get("content-type"), /text\/html/);
    const beforeScript = r.text.slice(0, r.text.indexOf("<script"));
    assert.match(beforeScript, BAND, `${path}: the band is in the markup served before the script`);
  }
});

test("R95 (control; T48): a non-test instance's `/app` HTML holds no band; neither does an environment whose two names differ, or one that names only one of them", async () => {
  for (const env of [{}, { CIVICSMITH_TEST_INSTANCE: "a", INSTANCE_NAME: "b" }, { CIVICSMITH_TEST_INSTANCE: "a" }, { INSTANCE_NAME: "a" }, { CIVICSMITH_TEST_INSTANCE: "", INSTANCE_NAME: "" }]) {
    const w = world();
    Object.assign(w.env, env);
    const r = await call(w.env, { path: "/app" });
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.text.slice(0, r.text.indexOf("<script")), BAND, JSON.stringify(env));
  }
});

test("R95 (T48; K3254): a read of the test-instance fact that throws passes `false`: the page is served with no band, never an error", async () => {
  const w = world();
  Object.defineProperty(w.env, "CIVICSMITH_TEST_INSTANCE", { get() { throw new Error("unreadable"); }, enumerable: true });
  const r = await call(w.env, { path: "/app" });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.doesNotMatch(r.text.slice(0, r.text.indexOf("<script")), BAND);
});

/* the owner-ops map is unchanged by T48 (R71, R72): a route of this module's own map is still served */
test("R90, R91, R92 (T48): this module's own owner-ops map holds none of T48's ops (each is its owner's own arm, R26's pattern)", () => {
  const own = Object.keys(controlPlaneOwnerOps({}, U, null));
  const T48_OPS = [...Object.values(T48_SHARES).flatMap((x) => Object.keys(x.ops)), ...Object.keys(T48_FAMILIES.find((f) => f.owner === "connections").ops)];
  assert.equal(T48_OPS.length, 16);
  for (const op of T48_OPS)
    assert.equal(own.includes(op), false, `${op}: not this module's arm`);
});
