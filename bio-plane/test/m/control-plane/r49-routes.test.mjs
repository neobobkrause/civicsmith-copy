/* control-plane R49 (DEC-112 (3)(6), DEC-96; N520, N522): the ops T28 adds. `case-import`'s eight member ops, routed
   through its own map with op-declarations R14's stamps, each a member's session's alone; `importedcases` and
   `importedcase` among the reads naming no project (R27); and `case-checker`'s public reads `casechecker` and
   `casefilespec`, credential-free on the public path through public-read's door read (its R18), by their own names and
   as `op=publicread&name=`, with no store route of this module's. Driven through `makeFetch(hooks)`, R48's form
   (`r48-routes.test.mjs`); the store's door through `dispatch` over case-import's own map. */
import "./register-declared.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, O, world, call, opCalls, aik, cred, refused, FORGED, QUERY_STAMPS, BODY_STAMPS } from "./harness.mjs";
const { caseImportOps, CASE_IMPORT_OPS } = await import("../../../src/case-import/index.mjs");
const { publicReadDoorOp } = await import("../../../src/public-read/door.mjs");
const D = await import("../../../src/store-door/dispatch.mjs");
const { importedCaseAnswer, importedCasesAnswer } = await import("../case-import/fixtures.mjs");

const { OPS } = O;
const U = new URL("http://do/");
const IMPORT_MAP = Object.keys(caseImportOps(null, U, null));
/* case-import's own list of its ops (K4219), split by the op table's `mutating`: never a list typed here (K3268) */
const MEMBER_OPS = [...CASE_IMPORT_OPS];
const ACTS = MEMBER_OPS.filter((op) => OPS[op].mutating);
const READS = MEMBER_OPS.filter((op) => !OPS[op].mutating);
const PUBLIC_READS = ["casechecker", "casefilespec"];
const STAMP_NAMES = [...new Set([...QUERY_STAMPS, "proposedBy", "proposer", "principal", "owner", "member", "mintedBy"])];

/* The two sessions the rows admit: a member's and the founder's, each with its viewer and positional identity. */
function sessions() {
  const w = world();
  return { w, list: [
    { name: "founder", token: w.S.founder, viewer: "admin", identity: "member:admin" },
    { name: "ann", token: w.S.ann, viewer: "member:ann", identity: "member:ann" },
  ] };
}
const stampsOf = (op, c) => (ACTS.includes(op) ? { viewer: c.viewer, by: c.identity } : { viewer: c.viewer });

test("R49, R114, R2, R26: each of case-import's ops (K4219) is declared, a route of case-import's own map, a member's session's alone, and routed through the door's general path to that route in bio, with the caller's own parameters and body, for a member's session and the founder's (negative control: a name no owner serves is `unknown op`, nothing forwarded)", async () => {
  /* the map holds case-import's own ops (R52's watch acts among them, `r52-routes.test.mjs`), and nothing else */
  assert.deepEqual([...IMPORT_MAP].sort(), [...MEMBER_OPS].sort(), "case-import's map is its own list of ops");
  for (const op of MEMBER_OPS) {
    assert.ok(Object.hasOwn(OPS, op), `${op} is declared`);
    assert.deepEqual([OPS[op].classes, OPS[op].machineClasses], [["admin", "member"], []], op);
    assert.equal(typeof OPS[op].mutating, "boolean", `${op}: its row says whether it mutates`);
  }
  const { w, list } = sessions();
  for (const c of list) for (const op of MEMBER_OPS) {
    const mutating = OPS[op].mutating;
    w.env.calls.length = 0;
    const r = await call(w.env, { op, token: c.token, params: { import: "IMP-1", edition: "3" },
                                  method: mutating ? "POST" : "GET", body: mutating ? { parts: ["cGFydA=="], reason: "kept" } : undefined });
    assert.equal(r.status, 200, `${op}/${c.name}: ${r.text.slice(0, 200)}`);
    const inner = opCalls(w.env);
    assert.deepEqual(inner.map((x) => [x.route, x.ns]), [[op, "bio"]], `${op}/${c.name}`);
    assert.deepEqual([inner[0].params.import, inner[0].params.edition], ["IMP-1", "3"], `${op}: the caller's parameters reach the route`);
    if (mutating) assert.deepEqual(inner[0].body, { parts: ["cGFydA=="], reason: "kept" }, `${op}: the caller's body reaches the route whole`);
    assert.deepEqual([r.json.store, r.json.tokenClass], ["bio", c.name === "founder" ? "admin" : "member"]);
  }
  for (const op of ["caseimportwithdraw", "importdelete", "importedcasesall"]) {
    assert.equal(Object.hasOwn(OPS, op), false, op);
    w.env.calls.length = 0;
    refused(await call(w.env, { op, token: w.S.ann, method: "POST", body: {} }), 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(w.env.calls.length, 0, `${op}: nothing read`);
  }
});

test("R49, R17, R29: each case-import op's stamps are the server's value from the session — `by` (the positional identity) and `viewer` on the six acts, `viewer` alone on the two reads — whatever the caller sent in the query or the body; the caller's copies are deleted and a stamp the op does not take is not set", async () => {
  const { w, list } = sessions();
  const forgedQ = Object.fromEntries(STAMP_NAMES.map((k) => [k, FORGED]));
  const forgedB = Object.fromEntries([...STAMP_NAMES, ...BODY_STAMPS].map((k) => [k, FORGED]));
  let checked = 0;
  for (const c of list) for (const op of MEMBER_OPS) {
    const want = stampsOf(op, c);
    for (const [params, body] of [[{}, { note: "kept" }], [forgedQ, { note: "kept", ...forgedB }]]) {
      w.env.calls.length = 0;
      await call(w.env, { op, token: c.token, params, method: "POST", body });
      const [inner] = opCalls(w.env);
      const where = `${op} for ${c.name}${params === forgedQ ? " (forged)" : ""}`;
      assert.ok(inner, `${where}: forwarded`);
      for (const k of STAMP_NAMES) {
        const got = inner.params[k] ?? null;
        if (Object.hasOwn(want, k)) { assert.equal(got, want[k], `${where}: ?${k}`); checked++; }
        else if (QUERY_STAMPS.includes(k)) assert.notEqual(got, FORGED, `${where}: ?${k} carries the caller's value`);
        if (!Object.hasOwn(want, k) && params !== forgedQ) assert.equal(got, null, `${where}: ?${k} is not this op's stamp`);
      }
      /* case-import's map reads `by`, else `author`: the caller's `author` never reaches it */
      assert.equal(inner.params.author ?? null, null, `${where}: ?author`);
      for (const k of BODY_STAMPS) assert.notEqual(inner.body?.[k], FORGED, `${where}: #${k}`);
      assert.equal(inner.body?.note, "kept", `${where}: the body reaches the route`);
    }
  }
  assert.equal(checked, 2 * 2 * (ACTS.length * 2 + READS.length));
});

test("R49, R28 (case-import R1, R4, R8; admission R8–R10): each case-import op is refused to every caller not arriving by a member's session — every binding class CLASS_FORBIDDEN, the retired shared member binding MEMBER_TOKEN_RETIRED, an AI credential declaring every write AI_BEYOND_TASK_SCOPE — and nothing is forwarded; negative control: a member's session and the founder's reach each", async () => {
  const wide = aik();
  const { env, S } = world({ creds: { [wide]: cred({ tokenId: "agent-wide", writes: Object.keys(OPS) }) } });
  for (const op of MEMBER_OPS) {
    const method = OPS[op].mutating ? "POST" : "GET";
    const body = method === "POST" ? { import: "IMP-1" } : undefined;
    for (const [token, params] of [[env.ADMIN_TOKEN, {}], [env.PROBE_TOKEN, { store: "scratch" }], [env.DAEMON_TOKEN, {}]]) {
      env.calls.length = 0;
      refused(await call(env, { op, token, params: { ...params, import: "IMP-1" }, method, body }), 403, "CLASS_FORBIDDEN", "C-38.2");
      assert.equal(opCalls(env).length, 0, `${op}: forwarded for a binding class`);
    }
    /* admission R5 (K2166): the retired shared member binding gives no class at all */
    env.calls.length = 0;
    refused(await call(env, { op, token: env.MEMBER_TOKEN, params: { import: "IMP-1" }, method, body }), 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for the retired member binding`);
    env.calls.length = 0;
    refused(await call(env, { op, token: wide, params: { import: "IMP-1" }, method, body }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6");
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for an agent`);
    for (const token of [S.ann, S.founder]) {
      env.calls.length = 0;
      assert.equal((await call(env, { op, token, params: { import: "IMP-1" }, method, body })).status, 200, op);
      assert.deepEqual(opCalls(env).map((x) => x.route), [op]);
    }
  }
});

test("R49, R27: `importedcases` and `importedcase` are among the reads naming no project, each with its reason, so the store's door runs no existence answer for either (an import is no bundle); no import op is classified as naming a project (negative control: a read that names a project is still asked)", async () => {
  const { PROJECT_NAMING_READS: NAMES, PROJECT_NAMING_READS_NOT: NOT } = D;
  /* R27 names these two; the later reads (R49 of T51, `importregrade` and `rerunread`) are the store door's to classify */
  for (const op of ["importedcases", "importedcase"]) {
    assert.equal(typeof NOT[op], "string", op);
    assert.match(NOT[op], /import/, op);
    assert.match(NOT[op], /R4/, op);
  }
  for (const op of MEMBER_OPS) assert.equal(Object.hasOwn(NAMES, op), false, op);
  const P = "PROJ-seen";
  const ran = [], asked = [];
  const membership = () => ({ visibilityOf: (id) => { asked.push(id); return id === P ? "discoverable" : "hidden"; },
                               existenceAct: (id) => (id === P ? { ok: false, reason: "PROJECT_SEEN_NOT_A_PARTICIPANT", project: id } : null) });
  // fixtures-own: synthetic a route table the store door dispatches: only that it runs the route named and relays or awaits its answer is under test
  /* case-import's own answer to `importedcase` (its published fixture), carried by the table's route */
  const { answer: held } = await importedCaseAnswer();
  const store = { routes: () => ({ importedcase: () => { ran.push(1); return held; },
                                   notices: () => ({ ok: true }) }), membership };
  const r = await (await D.dispatch(new Request(`http://do/importedcase?viewer=member:ann&import=${P}&project=${P}&id=${P}`), store)).json();
  assert.deepEqual([r.ok, r.result, ran, asked], [true, JSON.parse(JSON.stringify(held)), [1], []]);
  const n = await (await D.dispatch(new Request(`http://do/notices?viewer=member:ann&project=${P}`), store)).json();
  assert.equal(n.result.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
});

test("R49, R26, R25 (K1324): case-import's map answers promises (`caseimport`, `caseimportdocument` reach case-checker's WebCrypto), and the store's door awaits each — the envelope carries the settled answer, never a promise — and a rejected one is the store's internal error with a correlation id, never its message (negative control: a plain answer is enveloped the same)", async () => {
  const { answer: listed } = await importedCasesAnswer();
  const settled = { ok: true, import: listed.imports[0].import, existed: false };
  const routes = { caseimport: () => Promise.resolve(settled),
                   caseimportdocument: () => new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: "IMPORT_DOCUMENT_NOT_MISSING" }), 5)),
                   importedcases: () => listed,
                   importflag: () => Promise.reject(new Error("secret /path/to/file.mjs:12")) };
  const store = { routes: () => routes, membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }) };
  const go = async (op, method = "POST") => {
    const res = await D.dispatch(new Request(`http://do/${op}?by=member:ann&viewer=member:ann`,
      method === "POST" ? { method, body: "{}" } : { method }), store);
    return { status: res.status, text: await res.clone().text(), json: await res.json() };
  };
  assert.deepEqual((await go("caseimport")).json, { ok: true, result: settled });
  assert.deepEqual((await go("caseimportdocument")).json, { ok: true, result: { ok: false, reason: "IMPORT_DOCUMENT_NOT_MISSING" } });
  assert.deepEqual((await go("importedcases", "GET")).json, { ok: true, result: JSON.parse(JSON.stringify(listed)) });
  const errors = console.error;
  console.error = () => {};
  let thrown;
  try { thrown = await go("importflag"); } finally { console.error = errors; }
  assert.equal(thrown.status, 500);
  assert.deepEqual([thrown.json.ok, thrown.json.reason], [false, "STORE_INTERNAL_ERROR"]);
  assert.match(thrown.json.correlation, /^[0-9a-f-]{36}$/);
  assert.equal(/secret|path|\.mjs/.test(thrown.text), false, thrown.text);
});

test("R49 (case-checker R15; public-read R18): `casechecker` and `casefilespec` are public ops, answered credential-free by public-read's door read from bio's store — by their own names and as `op=publicread&name=` — the read asked by name with its declared parameters, never a credential or a stamp; `store=scratch` is refused with nothing read; this door holds no store route for either (negative controls: the store's unregistered answer is 404; a silence is a silence)", async () => {
  for (const op of PUBLIC_READS) {
    assert.equal(OPS[op]?.classes, null, `${op} is public`);
    assert.equal(OPS[op].mutating, false, op);
    assert.equal(Object.hasOwn(D.controlPlaneRoutes({}, U, null), op), false, `${op}: no route of this module's`);
  }
  const hooks = { async publicOp({ op, url, env, stub }) {
    return (await publicReadDoorOp(op, url, env, stub, { json: M.json, requiredArgument: M.requiredArgument, storeSilent: M.storeSilent,
                                                  storeRefusal: M.storeRefusal, doAnswer: M.doAnswer, publicReads: PUBLIC_READS }))
      ?? M.json({ ok: true, publicOp: op });
  } };
  const answer = (c) => (c.route === "publicread"
    ? new Response(JSON.stringify({ ok: true, result: { ok: true, read: c.params.name, module: "case-checker", result: { held: true } } })) : null);
  const { env, S } = world({ answer });
  for (const name of PUBLIC_READS) for (const token of [undefined, S.ann, env.ADMIN_TOKEN, "junk"])
    for (const asked of [{ op: name, params: {} }, { op: "publicread", params: { name } }]) {
      env.calls.length = 0;
      const r = await call(env, { op: asked.op, token, hooks,
        params: { ...asked.params, version: "1", viewer: FORGED, by: FORGED, author: FORGED } });
      assert.equal(r.status, 200, `${asked.op}/${name}: ${r.text.slice(0, 200)}`);
      assert.deepEqual([r.json.ok, r.json.read, r.json.module], [true, name, "case-checker"]);
      /* admission R27: a presented live session is resolved once (a `session` lookup) before the one read */
      assert.deepEqual(env.calls.map((x) => x.route), [...(token === S.ann ? ["session"] : []), "publicread"], `${name}: one read`);
      const c = env.calls.at(-1);
      assert.deepEqual([c.route, c.ns, c.params.name, c.params.version], ["publicread", "bio", name, "1"]);
      for (const k of ["token", ...QUERY_STAMPS]) assert.equal(c.params[k] ?? null, null, `${name}: ?${k} reaches the read`);
      env.calls.length = 0;
      refused(await call(env, { op: asked.op, token, hooks, params: { ...asked.params, store: "scratch" } }), 400, "NAMESPACE_PINNED", "C-78.2");
      assert.equal(env.calls.length, 0);
    }
  const unregistered = world({ answer: (c) => (c.route === "publicread"
    ? new Response(JSON.stringify({ ok: true, result: { ok: false, reason: "PUBLIC_READ_NOT_REGISTERED" } })) : null) });
  for (const op of PUBLIC_READS) assert.equal((await call(unregistered.env, { op, hooks })).status, 404, op);
  const silent = world({ answer: (c) => (c.route === "publicread" ? new Response("not json") : null) });
  for (const op of PUBLIC_READS) refused(await call(silent.env, { op, hooks }), 502, "STORE_DID_NOT_ANSWER", "C-69.2");
});
