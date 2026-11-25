/* control-plane R47 and R48: the ops T27 adds. R47 (DEC-113, DEC-36): `actionholdrelease`, `actionholdpreview` and
   `projectholds`, routed through `actions`' own map with the stamps op-declarations R12 declares, and `projectholds`
   among the reads naming no project (R27). R48 (DEC-116, DEC-100; N520): docket's four acts and three reads, routed through
   `docket`'s own map with op-declarations R13's stamps, each a member's session's alone; and `docketpublic`, `docketfeed`,
   credential-free on the public path through public-read's door (its R21) as `publishedcase` is. Driven through
   `makeFetch(hooks)`, R45's form (`r45-routes.test.mjs`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";   /* before the harness: the world registers the ops the harness reads */
import { M, O, world, call, opCalls, aik, cred, hex64, member, refused, FORGED, QUERY_STAMPS, BODY_STAMPS } from "./harness.mjs";
/* (T46; N938) the hold ops are action-holds' since T45 (plane R39): its own map, spread beside actions' */
const { actionHoldsOps } = await import("../../../src/action-holds/index.mjs");
const { docketOps } = await import("../../../src/docket/index.mjs");
const { publicReadDoorOp } = await import("../../../src/public-read/door.mjs");
const D = await import("../../../src/store-door/dispatch.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");

const { OPS } = O;
const U = new URL("http://do/");
const HOLDS_MAP = Object.keys(actionHoldsOps(null, U, null));
const DOCKET_MAP = Object.keys(docketOps(null, U, null));

function callers() {
  const agent = aik();
  const w = world({ creds: { [agent]: cred({ tokenId: "agent-ann", principal: "member:ann", writes: Object.keys(OPS) }) } });
  const bind = (c, token, params = {}) => ({ name: c, token, params, ns: params.store ?? "bio", session: false,
    viewer: `class:${c}`, identity: `class:${c}` });
  return { w, list: [
    /* admission R5 (K2166): the shared member binding is retired, so it is no caller here (its refusal is tested below) */
    bind("admin", w.env.ADMIN_TOKEN), bind("probe", w.env.PROBE_TOKEN, { store: "scratch" }),
    bind("daemon", w.env.DAEMON_TOKEN),
    { name: "founder", token: w.S.founder, params: {}, ns: "bio", session: true, viewer: "admin", identity: "member:admin" },
    { name: "ann", token: w.S.ann, params: {}, ns: "bio", session: true, viewer: "member:ann", identity: "member:ann" },
    { name: "agent", token: agent, params: {}, ns: "bio", session: false, viewer: "member:ann", identity: "class:ai/agent-ann" },
  ] };
}

/* Each op: its owner's map, and the stamps its owner reads, from the caller (op-declarations R12, R13). The hold release's
   author is the action layer's (`QUERY_AUTHOR_ACTIONS`): the positional identity, an agent `class:ai/<tokenId>`. */
const viewer = (c) => ({ viewer: c.viewer });
const authored = (c) => ({ viewer: c.viewer, author: c.identity });
const byed = (c) => ({ viewer: c.viewer, by: c.identity });
const ROUTES = {
  actionholdrelease: [HOLDS_MAP, authored], actionholdpreview: [HOLDS_MAP, viewer], projectholds: [HOLDS_MAP, viewer],
  docketfile: [DOCKET_MAP, authored], docketpressure: [DOCKET_MAP, authored], docket: [DOCKET_MAP, viewer],
  docketprepare: [DOCKET_MAP, byed], docketpost: [DOCKET_MAP, byed], docketdecline: [DOCKET_MAP, byed],
  docketinvitation: [DOCKET_MAP, viewer],
};
/* docket's seven member ops, from op-declarations' own declaration of its acts and its reads */
const DOCKET_MEMBER = [...O.DOCKET_ACTIONS, ...O.DOCKET_READS];
const admits = (spec, c) => (c.session ? true
  : c.name === "agent" ? !Array.isArray(spec.machineClasses)
  : (Array.isArray(spec.machineClasses) ? spec.machineClasses : spec.classes).includes(c.name));
const STAMP_NAMES = [...new Set([...QUERY_STAMPS, "proposedBy", "proposer", "principal", "owner", "member", "mintedBy"])];

test("R47, R48, R2, R26: each op is declared, a route of its owner's own map (action-holds', docket's), and routed through the door's general path to that route, in the caller's namespace, with the caller's own parameters and body, for every caller its row admits; docket's ops are a member's session's alone (negative control: a name no owner serves is `unknown op`, nothing forwarded)", async () => {
  for (const [op, [map]] of Object.entries(ROUTES)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} is declared`);
    assert.ok(map.includes(op), `${op} is a route of its owner's map`);
  }
  assert.deepEqual([...DOCKET_MAP].sort(), [...DOCKET_MEMBER].sort(), "docket's map is the seven member ops");
  for (const op of DOCKET_MEMBER) assert.deepEqual([OPS[op].classes, OPS[op].machineClasses], [["admin", "member"], []], op);
  const { w, list } = callers();
  let reached = 0;
  for (const c of list) for (const op of Object.keys(ROUTES)) {
    const spec = OPS[op];
    if (!admits(spec, c)) continue;
    w.env.calls.length = 0;
    const r = await call(w.env, { op, token: c.token, params: { ...c.params, case: "CASE-1", target: "ACTN-1" },
                                  method: spec.mutating ? "POST" : "GET", body: spec.mutating ? { note: "kept" } : undefined });
    assert.equal(r.status, 200, `${op}/${c.name}: ${r.text.slice(0, 200)}`);
    const inner = opCalls(w.env);
    assert.deepEqual(inner.map((x) => [x.route, x.ns]), [[op, c.ns]], `${op}/${c.name}`);
    assert.deepEqual([inner[0].params.case, inner[0].params.target], ["CASE-1", "ACTN-1"], `${op}: the caller's parameters reach the route`);
    if (spec.mutating) assert.equal(inner[0].body.note, "kept", `${op}: the caller's body reaches the route`);
    assert.equal(r.json.store, c.ns);
    reached++;
  }
  assert.ok(reached >= 29, String(reached));   /* 29 callers-by-ops; the floor was 30 while the retired member binding (admission R5, K2166) was one of them */
  for (const op of ["docketwithdraw", "actionholdlift", "projecthold"]) {
    assert.equal(Object.hasOwn(OPS, op), false, op);
    w.env.calls.length = 0;
    refused(await call(w.env, { op, token: w.S.ann, method: "POST", body: {} }), 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(w.env.calls.length, 0, `${op}: nothing read`);
  }
});

test("R47, R48, R17, R29: each op's stamps are the server's value from the credential, for every caller its row admits, whatever the caller sent in the query or the body; the caller's copies are deleted; a stamp the op does not take is not set", async () => {
  const { w, list } = callers();
  const forgedQ = Object.fromEntries(STAMP_NAMES.map((k) => [k, FORGED]));
  const forgedB = Object.fromEntries([...STAMP_NAMES, ...BODY_STAMPS].map((k) => [k, FORGED]));
  let checked = 0;
  for (const c of list) for (const [op, [, stamps]] of Object.entries(ROUTES)) {
    if (!admits(OPS[op], c)) continue;
    const want = stamps(c);
    for (const [params, body] of [[c.params, { note: "kept" }], [{ ...c.params, ...forgedQ }, { note: "kept", ...forgedB }]]) {
      w.env.calls.length = 0;
      await call(w.env, { op, token: c.token, params, method: "POST", body });
      const [inner] = opCalls(w.env);
      const where = `${op} for ${c.name}${params === c.params ? "" : " (forged)"}`;
      assert.ok(inner, `${where}: forwarded`);
      for (const k of STAMP_NAMES) {
        const got = inner.params[k] ?? null;
        if (Object.hasOwn(want, k)) { assert.equal(got, want[k], `${where}: ?${k}`); checked++; }
        else if (QUERY_STAMPS.includes(k)) assert.notEqual(got, FORGED, `${where}: ?${k} carries the caller's value`);
        if (!Object.hasOwn(want, k) && params === c.params) assert.equal(got, null, `${where}: ?${k} is not this op's stamp`);
      }
      for (const k of BODY_STAMPS) assert.notEqual(inner.body?.[k], FORGED, `${where}: #${k}`);
      assert.equal(inner.body?.note, "kept", `${where}: the body reaches the route`);
    }
  }
  assert.ok(checked >= 60, String(checked));
});

test("R48, R28 (docket R1, R4, R18; admission R8–R10): each docket member op is refused to every caller not arriving by a member's session — every binding class CLASS_FORBIDDEN, the retired shared member binding MEMBER_TOKEN_RETIRED, an AI credential declaring every write AI_BEYOND_TASK_SCOPE — and nothing is forwarded; negative control: a member's session and the founder's reach each", async () => {
  const wide = aik();
  const { env, S } = world({ creds: { [wide]: cred({ tokenId: "agent-wide", writes: Object.keys(OPS) }) } });
  for (const op of DOCKET_MEMBER) {
    const method = OPS[op].mutating ? "POST" : "GET";
    const body = method === "POST" ? { case: "CASE-1" } : undefined;
    for (const [token, params] of [[env.ADMIN_TOKEN, {}], [env.PROBE_TOKEN, { store: "scratch" }], [env.DAEMON_TOKEN, {}]]) {
      env.calls.length = 0;
      refused(await call(env, { op, token, params: { ...params, case: "CASE-1" }, method, body }), 403, "CLASS_FORBIDDEN", "C-38.2");
      assert.equal(opCalls(env).length, 0, `${op}: forwarded for a binding class`);
    }
    /* admission R5 (K2166): the retired shared member binding gives no class at all */
    env.calls.length = 0;
    refused(await call(env, { op, token: env.MEMBER_TOKEN, params: { case: "CASE-1" }, method, body }), 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for the retired member binding`);
    env.calls.length = 0;
    refused(await call(env, { op, token: wide, params: { case: "CASE-1" }, method, body }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6");
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for an agent`);
    for (const token of [S.ann, S.founder]) {
      env.calls.length = 0;
      assert.equal((await call(env, { op, token, params: { case: "CASE-1" }, method, body })).status, 200, op);
      assert.deepEqual(opCalls(env).map((x) => x.route), [op]);
    }
  }
});

test("R48 (public-read R21; DEC-116 item 8, DEC-100 item 2): `docketpublic` and `docketfeed` are public ops answered credential-free through plane's public hook and public-read's door, as `publishedcase` is — each asks bio's store its route with the case alone, never a credential or a stamp, the feed served as Atom; `store=scratch` is refused with nothing read (negative controls: a case the docket answers null for is 404 NOT_PUBLISHED; a silence is a silence; the door forwards nothing itself)", async () => {
  for (const op of ["docketpublic", "docketfeed"]) assert.deepEqual(OPS[op], { classes: null, mutating: false }, op);
  const handed = [];
  const hooks = { async publicOp({ op, url, env, stub }) {
    handed.push(op);
    return (await publicReadDoorOp(op, url, env, stub, { json: M.json, requiredArgument: M.requiredArgument, storeSilent: M.storeSilent,
                                                  storeRefusal: M.storeRefusal, doAnswer: M.doAnswer })) ?? M.json({ ok: true, publicOp: op });
  } };
  const feed = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';
  const answer = (c) => (c.route === "docketpublic" ? new Response(JSON.stringify({ ok: true, result: { ok: true, case: c.params.case, entries: [], last_entry: null } }))
    : c.route === "docketfeed" ? new Response(JSON.stringify({ ok: true, result: { ok: true, feed } })) : null);
  const { env, S } = world({ answer });
  for (const op of ["docketpublic", "docketfeed"]) for (const token of [undefined, S.ann, env.ADMIN_TOKEN, "junk"]) {
    env.calls.length = 0; handed.length = 0;
    const r = await call(env, { op, token, hooks, params: { case: "CASE-1", viewer: FORGED, by: FORGED, author: FORGED, secret: "s" } });
    assert.deepEqual(handed, [op], `${op}: answered by the public hook`);
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
    /* admission R27: a presented live session is resolved once before the one read */
    assert.deepEqual(env.calls.filter((c) => c.route !== "session").map((c) => [c.route, c.ns, c.params]), [[op, "bio", { case: "CASE-1" }]], `${op}: one read of bio, the case alone`);
    assert.deepEqual(env.calls.filter((c) => c.route === "session").length, token === S.ann ? 1 : 0, `${op}: the session resolved once, only when presented`);
    if (op === "docketfeed") { assert.equal(r.text, feed); assert.match(r.headers.get("content-type"), /^application\/atom\+xml/); }
    else assert.deepEqual([r.json.ok, r.json.case], [true, "CASE-1"]);
    env.calls.length = 0;
    refused(await call(env, { op, token, hooks, params: { case: "CASE-1", store: "scratch" } }), 400, "NAMESPACE_PINNED", "C-78.2");
    assert.equal(env.calls.length, 0);
  }
  const absent = world({ answer: (c) => (c.route.startsWith("docket") ? new Response(JSON.stringify({ ok: true, result: { ok: false, reason: "NOT_PUBLISHED" } })) : null) });
  for (const op of ["docketpublic", "docketfeed"]) {
    const r = await call(absent.env, { op, hooks, params: { case: "CASE-X" } });
    assert.deepEqual([r.status, r.json.reason], [404, "NOT_PUBLISHED"], op);
  }
  const silent = world({ answer: (c) => (c.route.startsWith("docket") ? new Response("not json") : null) });
  for (const op of ["docketpublic", "docketfeed"])
    refused(await call(silent.env, { op, hooks, params: { case: "CASE-1" } }), 502, "STORE_DID_NOT_ANSWER", "C-69.2");
  /* with a hook that declines, the door itself forwards nothing for either */
  const bare = world();
  for (const op of ["docketpublic", "docketfeed"]) {
    bare.env.calls.length = 0;
    await call(bare.env, { op, params: { case: "CASE-1" } });
    assert.equal(bare.env.calls.some((c) => c.route === op), false, op);
  }
});

test("R47, R48, R27: `projectholds` is among the reads naming no project, with the reason, so its existence answer is not run (DEC-36: a project not seen whole is `held: null`); docket's reads name a case or an entry; the hold preview's `target` names an action and none is classified as naming a project (negative control: a read that names a project still is asked)", async () => {
  const { PROJECT_NAMING_READS: NAMES, PROJECT_NAMING_READS_NOT: NOT } = D;
  for (const op of ["projectholds", "docket", "docketprepare", "docketinvitation"]) {
    assert.equal(typeof NOT[op], "string", op);
    assert.ok(NOT[op].length > 10, op);
    assert.equal(Object.hasOwn(NAMES, op), false, op);
  }
  assert.match(NOT.projectholds, /held: null/);
  assert.equal(Object.hasOwn(NAMES, "actionholdpreview"), false, "the preview's `target` is an action, not a project");
  /* the real store (store-request's world): a discoverable project of the founder's that ann has seen and is no participant of; the door's frame
     (store-door `dispatch`) over the real routes and the real membership, spied on to see what ran and what was asked */
  const w = await storeWorld();
  const P = await w.recipes.project(await w.signIn("admin"), "Seen project");
  const ann = await w.signIn("ann");
  const ran = [], asked = [];
  const store = { routes: (u, b, g) => { const m = w.store.routes(u, b, g); return { ...m, projectholds: (...a) => { ran.push(1); return m.projectholds(...a); } }; },
                  membership: () => { const m = membershipOf(w.ctx);
                    return new Proxy(m, { get: (t, k) => (k === "visibilityOf" ? (id) => { asked.push(id); return t.visibilityOf(id); } : typeof t[k] === "function" ? t[k].bind(t) : t[k]) }); } };
  const r = await (await D.dispatch(new Request(`http://do/projectholds?viewer=member:${ann.member}&project=${P}&projects=${P}`,
    { method: "POST", body: JSON.stringify({ projects: [P], project: P, id: P }) }), store)).json();
  assert.deepEqual([r.result.projects[0].held, ran, asked], [null, [1], []]);
  const n = await (await D.dispatch(new Request(`http://do/notices?viewer=member:${ann.member}&project=${P}`), store)).json();
  assert.equal(n.result.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
});
