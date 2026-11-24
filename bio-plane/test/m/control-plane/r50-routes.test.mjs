/* control-plane R50 (DEC-120, DEC-121; N528; op-declarations R15; wizard-scripts R3–R16): `wizard-scripts`' ops, routed
   through its own map with the stamps op-declarations R15 declares and none taken from the caller; `wizardprogress`
   handed no member id, viewer or identity; and the unattributed refusal count's store-internal route reaching
   `wizard-scripts.tallyRefusal` with the op and the code alone. Driven through `makeFetch(hooks)` (R49's form,
   `r49-routes.test.mjs`); the store's door through `dispatch` over a real record (`record.mjs`). The Worker's half of the
   tally is `refusal-tally.test.mjs`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { O, world, call, opCalls, aik, cred, refused, FORGED, QUERY_STAMPS, BODY_STAMPS } from "./harness.mjs";
const { wizardScriptsOps } = await import("../../../src/wizard-scripts/index.mjs");
const { record } = await import("./record.mjs");
const D = await import("../../../src/store-door/dispatch.mjs");

const { OPS } = O;
const MAP = Object.keys(wizardScriptsOps(null, new URL("http://do/"), null));
/* op-declarations' own lists (wizard-scripts R15, R20, R28), not a copy of them here */
const AUTHOR = [...O.WIZARD_SCRIPTS_AUTHOR];
const APPROVER = O.WIZARD_SCRIPTS_BY.filter((op) => !op.startsWith("wizardeditor"));
const ADMIN = O.WIZARD_SCRIPTS_BY.filter((op) => op.startsWith("wizardeditor"));
const READS = [...O.WIZARD_SCRIPTS_READS, ...O.WIZARD_CHECK_READS, ...O.OP_FAMILIES["wizard-scripts"].reads.filter((op) => op !== "writinghelp")];   /* T34 (K1869 (2); wizard-scripts R23, R26): its two new reads */
const ALL = [...AUTHOR, ...APPROVER, ...ADMIN, ...O.WIZARD_PROPOSAL_ACTIONS, ...O.WIZARD_PROGRESS_ACTIONS, ...READS];
const STAMP_NAMES = [...new Set([...QUERY_STAMPS, "proposedBy", "proposer", "principal", "owner", "member", "mintedBy", "secretSha"])];

/* What each op is stamped, for a caller `c` ({viewer, identity, member, label}). */
function stampsOf(op, c) {
  if (AUTHOR.includes(op)) return { author: c.identity, viewer: c.viewer };
  if (APPROVER.includes(op)) return { author: c.identity, viewer: c.viewer };
  if (ADMIN.includes(op)) return { author: c.identity };
  if (op === "wizardpropose") return { author: c.label, viewer: c.viewer };
  if (op === "wizardprogress") return {};
  return { viewer: c.viewer };
}
const sessions = (w) => [
  { name: "founder", token: w.S.founder, viewer: "admin", identity: "member:admin", label: "admin", cls: "admin" },
  { name: "ann", token: w.S.ann, viewer: "member:ann", identity: "member:ann", label: "ann", cls: "member" },
];

test("R50, R2, R26: wizard-scripts' map is exactly the ops op-declarations R15 declares, and each is forwarded by the door's general path to the route of its own name in the session's namespace, with the caller's own parameters and body (negative control: a wizard op no module serves is unknown, nothing forwarded)", async () => {
  assert.deepEqual([...MAP].sort(), [...ALL].sort());
  for (const op of ALL) assert.ok(Object.hasOwn(OPS, op), `${op} is declared`);
  const w = world();
  for (const c of sessions(w)) for (const op of ALL) {
    const mutating = OPS[op].mutating;
    w.env.calls.length = 0;
    const r = await call(w.env, { op, token: c.token, params: { script: "WIZ-1", screen: "s" }, method: mutating ? "POST" : "GET",
                                  body: mutating ? { steps: [{ screen: "s", act: null, what: "w", why: "y" }] } : undefined });
    assert.equal(r.status, 200, `${op}/${c.name}: ${r.text.slice(0, 200)}`);
    const inner = opCalls(w.env).filter((x) => x.route !== "wizardrefusaltally");
    assert.deepEqual(inner.map((x) => [x.route, x.ns]), [[op, "bio"]], `${op}/${c.name}`);
    assert.deepEqual([inner[0].params.script, inner[0].params.screen], ["WIZ-1", "s"], op);
    if (mutating) assert.deepEqual(inner[0].body.steps, [{ screen: "s", act: null, what: "w", why: "y" }], op);
    assert.deepEqual([r.json.store, r.json.tokenClass], ["bio", c.cls]);
  }
  for (const op of ["wizarddelete", "wizardrefusaltally"]) {
    w.env.calls.length = 0;
    refused(await call(w.env, { op, token: w.S.ann, method: "POST", body: {} }), 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(w.env.calls.length, 0, `${op}: nothing forwarded`);
  }
});

test("R50, R17, R29 (K1402): each wizard op's stamps are the server's — `author`, the one key wizard-scripts' map reads, the positional identity on the authoring, approving and editor acts and the proposal's label on a proposal, `viewer` on every act but the editor grant's two and on every read — whatever the caller sent; `wizardprogress` receives no member id, viewer or identity at all (negative control: unforged calls stamp the same)", async () => {
  const w = world();
  const forgedQ = Object.fromEntries(STAMP_NAMES.map((k) => [k, FORGED]));
  const forgedB = Object.fromEntries([...STAMP_NAMES, ...BODY_STAMPS].map((k) => [k, FORGED]));
  let checked = 0;
  for (const c of sessions(w)) for (const op of ALL)
    for (const [params, body] of [[{}, { note: "kept" }], [forgedQ, { note: "kept", ...forgedB }]]) {
      w.env.calls.length = 0;
      await call(w.env, { op, token: c.token, params, method: "POST", body });
      const [inner] = opCalls(w.env).filter((x) => x.route !== "wizardrefusaltally");
      const where = `${op}/${c.name}${params === forgedQ ? " (forged)" : ""}`;
      const want = stampsOf(op, c);
      for (const k of STAMP_NAMES) {
        const got = inner.params[k] ?? null;
        if (Object.hasOwn(want, k)) { assert.equal(got, want[k], `${where}: ?${k}`); checked++; }
        else if (QUERY_STAMPS.includes(k)) assert.notEqual(got, FORGED, `${where}: ?${k} carries the caller's value`);
        if (!Object.hasOwn(want, k) && params !== forgedQ) assert.equal(got, null, `${where}: ?${k} is not this op's stamp`);
      }
      for (const k of BODY_STAMPS) assert.notEqual(inner.body?.[k], FORGED, `${where}: #${k}`);
      assert.equal(inner.body.note, "kept", where);
      if (op === "wizardprogress")
        assert.equal([...Object.values(inner.params)].some((v) => /^(ann|admin|member:ann|member:admin)$/.test(String(v))), false, where);
    }
  /* every declared stamp of every op, for both sessions, forged and not */
  assert.equal(checked, 2 * 2 * ALL.reduce((n, op) => n + Object.keys(stampsOf(op, sessions(w)[0])).length, 0));
});

test("R50, R28 (op-declarations R15): the session-only wizard acts are refused to every binding class, the retired shared member binding (MEMBER_TOKEN_RETIRED) and an agent credential, with nothing forwarded; a proposal and the check are reached by an agent credential, stamped with its label (`class:ai/<tokenId>`) and its principal as viewer; negative control: a member's session reaches each", async () => {
  const wide = aik();
  const { env, S } = world({ creds: { [wide]: cred({ tokenId: "agent-wide", principal: "member:ann", writes: Object.keys(OPS) }) } });
  for (const op of [...AUTHOR, ...APPROVER, ...ADMIN]) {
    for (const [token, store] of [[env.ADMIN_TOKEN], [env.PROBE_TOKEN, "scratch"], [env.DAEMON_TOKEN]]) {
      env.calls.length = 0;
      const r = await call(env, { op, token, params: store ? { store } : {}, method: "POST", body: {} });
      assert.ok([401, 403].includes(r.status) && r.json.ok === false, `${op}: ${r.text.slice(0, 200)}`);
      assert.equal(opCalls(env).length, 0, `${op}: forwarded for a binding class`);
    }
    /* admission R5 (K2166): the retired shared member binding gives no class at all, and is refused by name */
    env.calls.length = 0;
    refused(await call(env, { op, token: env.MEMBER_TOKEN, method: "POST", body: {} }), 401, "MEMBER_TOKEN_RETIRED", "C-38.11");
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for the retired member binding`);
    env.calls.length = 0;
    const r = await call(env, { op, token: wide, method: "POST", body: {} });
    assert.equal(r.json.ok, false, op);
    assert.equal(opCalls(env).length, 0, `${op}: forwarded for an agent`);
  }
  for (const op of ["wizardpropose", "wizardcheck"]) {
    env.calls.length = 0;
    const r = await call(env, { op, token: wide, params: { author: FORGED, proposer: FORGED, viewer: FORGED }, method: "POST", body: {} });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 200)}`);
    const [inner] = opCalls(env);
    assert.equal(inner.params.viewer, "member:ann", op);
    if (op === "wizardpropose") assert.equal(inner.params.author, "class:ai/agent-wide");
  }
  for (const op of AUTHOR) {
    env.calls.length = 0;
    assert.equal((await call(env, { op, token: S.ann, method: "POST", body: {} })).status, 200, op);
  }
});

test("R50 (wizard-scripts R16): the store-internal route `wizardrefusaltally` hands wizard-scripts' tallyRefusal the op and the code alone — one row per call, carrying nothing but (op, code, day), whatever else the body names — and it has no spec, so no caller reaches it (negative control: an op or code that is no token is not counted)", async () => {
  assert.equal(Object.hasOwn(OPS, "wizardrefusaltally"), false);
  assert.equal(typeof D.controlPlaneRoutes({}, new URL("http://do/"), null).wizardrefusaltally, "function");
  const r = await record();
  for (let i = 0; i < 2; i++) {
    const a = await r.go("wizardrefusaltally", "POST", { op: "index", code: "NO_SUCH_BUNDLE", viewer: "member:ann", member: "ann",
                                                         project: "PROJ-1", at: "2026-10-03T20:00:00Z" });
    assert.deepEqual([a.status, a.json], [200, { ok: true, result: { ok: true } }]);
  }
  const cols = r.db.prepare("PRAGMA table_info(wiz_refusal_tallies)").all().map((c) => c.name);
  const rows = r.db.prepare("SELECT * FROM wiz_refusal_tallies").all().map((x) => ({ ...x }));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.deepEqual([row.op, row.code], ["index", "NO_SUCH_BUNDLE"]);
    assert.match(String(row.day), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(JSON.stringify(row).includes("ann") || JSON.stringify(row).includes("PROJ-1"), false, JSON.stringify(row));
  }
  assert.deepEqual(cols.filter((c) => !["op", "code", "day", "tid"].includes(c)), [], cols.join());
  const bad = await r.go("wizardrefusaltally", "POST", { op: "index; drop", code: "x y" });
  assert.deepEqual(bad.json.result, { ok: false });
  assert.equal(r.db.prepare("SELECT COUNT(*) AS n FROM wiz_refusal_tallies").get().n, 2);
});
