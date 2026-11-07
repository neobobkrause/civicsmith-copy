/* T53 (N1264, K4599 (a); PL12, PL13): the fold. R34: `admit` is callable from inside the room with the session row the
   room holds (`held`), and every refusal of R1–R12 and R14 is answered exactly as at the door, in the same order.
   R35: the folded path counts the door's window and `background` as the unfolded one does, and a bearer is judged at the
   door with no extra call. Driven through the door's gate order (`gate`), once with the session read through the store
   (the door) and once with the row the room holds (the room), and through `doorWindowGate` over the window's real store
   side (`window.mjs`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, W, world, gate, doAnswer, refused, hex64, aik, cred, founder, member, arranged, storeWorld, bridged,
         REAUTH_DUE_ANSWER } from "./harness.mjs";

const { OPS } = O;
const CAPS = ["contribute", "publish", "create_projects"];

/* the row the room holds for `token`: credentials' `session` answer, read the way the room has it (one read of the
   double's rows), and the calls it made forgotten; `undefined` for a caller the room does not judge (a bearer) */
async function roomRow(env, token, via = "header") {
  const credential = A.presentedCredential(via === "body" ? { body: { token } }
    : { req: new Request("https://plane.example/api", { headers: token ? { authorization: `Bearer ${token}` } : {} }) });
  if (!(await A.judgedInRoom(credential, env))) return undefined;
  const out = await doAnswer(env.STORE.get("bio").fetch(new Request("http://do/session", { headers: { "x-bio-session": token } })));
  env.calls.length = 0;
  return out.result?.session ?? null;
}

/* one case judged both ways: the door's answer and the room's, the calls each made */
async function bothWays(env, args) {
  env.calls.length = 0;
  const door = await gate(env, args);
  const doorCalls = env.calls.map((c) => c.route);
  const held = await roomRow(env, args.token, args.via);
  env.calls.length = 0;
  const room = await gate(env, { ...args, ...(held !== undefined ? { held } : {}) });
  const roomCalls = env.calls.map((c) => c.route);
  return { door, room, held, doorCalls, roomCalls };
}

const answerOf = (r) => (r.refusal ? { refusal: r.refusal } : r.silent ? { silent: r.silent }
  : { caller: { ...r.caller, caps: r.caller.caps ? [...r.caller.caps].sort() : null } });

test("R34: a parity table — every refusal code of R1–R12 and R14 judged at the door and in the room (admit with the session row the room holds) answers the same status, code, check and translation; the room reads no session; controls: an admitted session is the same caller both ways, and an unknown session (the room holds no row) is NOT_AUTHENTICATED both ways", async () => {
  const shut = hex64(), locked = hex64(), stranger = hex64(), lapsed = aik();
  const { env, S, K } = world({ sessions: { [shut]: founder(CAPS), [locked]: { ...member("lou", CAPS), locked: true } },
                                creds: { [lapsed]: cred({ principal: "class:ai", expired: true, expiresAt: "2026-01-01T00:00:00Z" }) } });
  const noPurge = arranged((m, a, d) => { delete d.purge; });
  const CASES = [
    /* R1–R4: the namespace gates, before any credential is judged */
    ["NAMESPACE_UNKNOWN", 400, "C-78.1", { op: "index", token: S.ann, method: "GET", params: { store: "Scratch" } }],
    ["NAMESPACE_CONFINED", 403, "C-78.3", { op: "index", token: K.confined, method: "GET", params: { store: "bio" } }],
    ["NAMESPACE_PINNED", 400, "C-78.2", { op: "publishedmanifest", token: S.ann, method: "GET", params: { store: "scratch" } }],
    ["SCOPE_REFUSED", 403, "C-38.6", { op: "adminendorse", token: env.PROBE_TOKEN, params: { store: "bio" } }],
    /* R20: the credential in the address */
    ["CREDENTIAL_IN_ADDRESS", 400, "C-38.10", { op: "index", token: S.ann, method: "GET", via: "query" }],
    /* R5, R7: authentication */
    ["MEMBER_TOKEN_RETIRED", 401, "C-38.11", { op: "index", token: env.MEMBER_TOKEN, method: "GET" }],
    ["NOT_AUTHENTICATED", 401, "C-38.1", { op: "index", token: stranger, method: "GET" }],
    /* R8: the session's kind */
    ["ROOT_OF_TRUST_REQUIRED", 403, "C-38.4", { op: "export", token: S.ann }],
    ["SESSION_ROLE_CANNOT_REACH_OP", 403, "C-38.7", { op: "governorconfig", token: S.ann }],
    ["MACHINE_CREDENTIAL_REQUIRED", 403, "C-38.3", { op: "purge", token: S.ann }],
    ["SESSION_ROUTE_NOT_RECORDED", 403, "C-38.8", { op: "purge", token: S.ann, tables: noPurge }],
    /* R9: the class */
    ["CLASS_FORBIDDEN", 403, "C-38.2", { op: "snapkeycensus", token: S.ann, method: "GET" }],
    ["CLASS_FORBIDDEN", 403, "C-38.2", { op: "aiaccountswitch", token: env.ADMIN_TOKEN }],
    /* R10: the agent credential */
    ["AI_CREDENTIAL_REVOKED", 403, "C-29.7", { op: "index", token: K.revoked, method: "GET" }],
    ["AI_CREDENTIAL_EXPIRED", 401, "C-29.30", { op: "index", token: lapsed, method: "GET" }],
    ["AI_BEYOND_TASK_SCOPE", 403, "C-29.6", { op: "promote", token: K.ann }],
    /* R11: the capability */
    ["NOT_CAPABLE", 403, "C-38.5", { op: "promote", token: S.bare }],
    /* R12: the bearer fences */
    ["OPERATOR_TOKEN_CANNOT_GOVERN", 403, "C-32.17", { op: "adminendorse", token: env.ADMIN_TOKEN }],
    ["GROUP_IDENTITY_NEEDS_SESSION", 403, "C-64.4", { op: "groupnameset", token: env.ADMIN_TOKEN }],
  ];
  const codes = new Set();
  for (const [code, status, check, args] of CASES) {
    const { door, room, roomCalls } = await bothWays(env, args);
    const label = `${code} (${args.op})`;
    refused(door, status, code, check, [args.token]);
    refused(room, status, code, check, [args.token]);
    assert.deepEqual(room.refusal, door.refusal, `${label}: the same answer both ways`);
    assert.equal(roomCalls.includes("session"), false, `${label}: the room reads no session`);
    codes.add(code);
  }
  /* every code of R1–R12's rows (and R14's families that this module raises before the op) is in the table */
  for (const code of ["NAMESPACE_UNKNOWN", "NAMESPACE_CONFINED", "NAMESPACE_PINNED", "SCOPE_REFUSED", "MEMBER_TOKEN_RETIRED",
                      "NOT_AUTHENTICATED", "ROOT_OF_TRUST_REQUIRED", "SESSION_ROLE_CANNOT_REACH_OP", "MACHINE_CREDENTIAL_REQUIRED",
                      "SESSION_ROUTE_NOT_RECORDED", "CLASS_FORBIDDEN", "AI_CREDENTIAL_REVOKED", "AI_CREDENTIAL_EXPIRED",
                      "AI_BEYOND_TASK_SCOPE", "NOT_CAPABLE", "OPERATOR_TOKEN_CANNOT_GOVERN", "GROUP_IDENTITY_NEEDS_SESSION"])
    assert.ok(codes.has(code), `${code} is judged both ways`);
  /* the relayed answers of R24, R25 and R29 are the same both ways too */
  for (const [token, op, expect] of [[locked, "index", "SESSION_LOCKED"], [shut, "caseratify", "REAUTH_DUE"],
                                     [S.ann, "adminendorse", "NOT_AN_ADMIN"]]) {
    const { door, room } = await bothWays(env, { op, token, method: op === "index" ? "GET" : "POST" });
    assert.equal(door.refusal?.body?.reason ?? door.refusal?.body?.code, expect, `${op}: ${JSON.stringify(door).slice(0, 200)}`);
    assert.deepEqual(room.refusal, door.refusal, `${expect}: the same answer both ways`);
  }
  assert.deepEqual((await bothWays(env, { op: "caseratify", token: shut })).room.refusal.body, { ...REAUTH_DUE_ANSWER });
  /* controls: an admitted session is the same caller both ways, by header or by body */
  for (const via of ["header", "body"]) {
    const { door, room, held, doorCalls, roomCalls } = await bothWays(env, { op: "promote", token: S.ann, via });
    assert.ok(door.caller && room.caller, JSON.stringify(room).slice(0, 200));
    assert.deepEqual(answerOf(room), answerOf(door), `${via}: the same caller`);
    assert.equal(held.role, "member:ann");
    assert.ok(doorCalls.includes("session"), "the door reads the session");
    assert.equal(roomCalls.includes("session"), false, "the room does not");
  }
  const unknown = await bothWays(env, { op: "promote", token: stranger });
  assert.equal(unknown.held, null, "the room holds no row for an unknown token");
  assert.deepEqual(unknown.room.refusal, unknown.door.refusal);
});

test("R34: the order holds in the room as at the door — R8 before R9 before R10 before R11: a session both outside its kind's set and missing the capability is answered by R8; a session outside the op's classes and missing its capability by R9; an agent credential revoked and beyond its scope by R10's revocation; a member lacking the capability by R11", async () => {
  const both = aik();
  const { env, S } = world({ creds: { [both]: cred({ tokenId: "agent-both", revoked: true, revokedAt: "2026-06-01", revokedBy: "ann" }) } });
  const ORDER = [
    ["R8", "SESSION_ROLE_CANNOT_REACH_OP", { op: "governorconfig", token: S.bare }],
    ["R8", "ROOT_OF_TRUST_REQUIRED", { op: "export", token: S.bare }],
    ["R9", "CLASS_FORBIDDEN", { op: "snapkeycensus", token: S.bare, method: "GET" }],
    ["R10", "AI_CREDENTIAL_REVOKED", { op: "promote", token: both }],
    ["R11", "NOT_CAPABLE", { op: "promote", token: S.bare }],
  ];
  for (const [r, code, args] of ORDER) {
    const { door, room } = await bothWays(env, args);
    assert.equal(door.refusal?.body?.reason, code, `${r} at the door (${args.op})`);
    assert.equal(room.refusal?.body?.reason, code, `${r} in the room (${args.op})`);
    assert.deepEqual(room.refusal, door.refusal);
  }
  /* the bare member's session lacks contribute: the op its set holds reaches R11, the op it does not R8 */
  assert.ok(OPS.governorconfig.mutating && !O.SESSION_OPS.member.has("governorconfig"));
  assert.equal(O.NEEDS.promote, "contribute");
});

test("R34: given the room's row, admit judges that row and never reads the session from the store; a silent store is the door's alone — with a row held, the session read's silence cannot happen, and the binding comparison still runs first (the retired member key is refused though a row is handed in)", async () => {
  const { env, S } = world({ answer: (c) => (c.route === "session" ? new Response("<html>") : null) });
  const url = new URL("https://plane.example/api"), credential = A.presentedCredential({ body: { token: S.ann } });
  const door = await A.admit({ url, env, op: "promote", spec: OPS.promote, method: "POST", presented: { cred: null }, doAnswer, credential });
  assert.equal(door.silent?.op, "session", "the door's read is silent");
  env.calls.length = 0;
  const room = await A.admit({ url, env, op: "promote", spec: OPS.promote, method: "POST", presented: { cred: null }, doAnswer,
                               credential, held: member("ann", CAPS) });
  assert.equal(room.caller?.member, "ann");
  assert.deepEqual(env.calls.map((c) => c.route), [], "no store call");
  const retired = A.presentedCredential({ body: { token: env.MEMBER_TOKEN } });
  const r = await A.admit({ url, env, op: "index", spec: OPS.index, method: "GET", presented: { cred: null }, doAnswer,
                            credential: retired, held: founder(CAPS) });
  assert.equal(r.refusal?.body?.reason, "MEMBER_TOKEN_RETIRED");
  /* control: a held value that is no row is no session */
  for (const held of [null, "member:ann", [member("ann", CAPS)]]) {
    const n = await A.admit({ url, env, op: "promote", spec: OPS.promote, method: "POST", presented: { cred: null }, doAnswer, credential, held });
    assert.equal(n.refusal?.body?.reason, "NOT_AUTHENTICATED", JSON.stringify(held));
  }
});

/* ---- R35: the window and background, folded and unfolded ---- */

const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const SRC = "203.0.113.35";
const reqOf = ({ token, query = "" } = {}) => new Request(`https://plane.example/api${query}`,
  { method: "POST", headers: { "cf-connecting-ip": SRC, ...(token ? { authorization: `Bearer ${token}` } : {}) } });
const counts = (w) => {
  w.a.flush();
  const bySession = w.sql.exec(`SELECT * FROM ${W.SESSION_WINDOW_TABLE} ORDER BY session, bucket`).map(({ session, bucket, count }) => ({ session, bucket, count: Number(count) }));
  const bySource = w.sql.exec(`SELECT * FROM ${W.DOOR_WINDOW_TABLE} ORDER BY source, bucket`).map(({ source, bucket, count }) => ({ source, bucket, count: Number(count) }));
  return { bySession, bySource };
};

test("R35: the window's count after N folded calls equals its count after N unfolded ones — a signed-in session's public reads in its own window, background or not, a mutating public op and an ended session by source — and the folded calls read no session; control: a bearer's call is judged at the door (judgedInRoom false) and makes no call to the room beyond the op's own", async () => {
  const N = 40;
  const t = hex64(), ended = hex64();
  const run = async (folded) => {
    const w = storeWorld({ env: { KNOCK_FINGERPRINT_KEY: "k" } });
    const rows = { [t]: member("ann", CAPS) };
    const env = bridged(w, { sessions: rows });
    for (let i = 0; i < N; i++) {
      const now = T0 + i * 1000;
      for (const [token, op, background] of [[t, "groupidentity", false], [t, "bootstrap", true], [t, "enroll", false],
                                             [ended, "groupidentity", false], [null, "groupidentity", false]]) {
        const credential = A.presentedCredential({ req: reqOf({ token }) });
        const fold = folded && await A.judgedInRoom(credential, env);
        const r = await A.doorWindowGate({ req: reqOf({ token }), env, op, spec: OPS[op], doAnswer, now, credential, background,
                                           ...(fold ? { held: rows[token] ?? null } : {}) });
        assert.equal(r.refusal, undefined);
      }
    }
    return { ...counts(w), sessionReads: env.calls.filter((c) => c.route === "session"),
             windowAsks: env.calls.filter((c) => c.route === "doorwindow").length };
  };
  const unfolded = await run(false), folded = await run(true);
  assert.deepEqual(folded.bySession, unfolded.bySession, "the same session window");
  assert.deepEqual(folded.bySource, unfolded.bySource, "the same source window");
  assert.equal(folded.bySession.reduce((n, r) => n + r.count, 0), 2 * N, "the session's two public reads, background included");
  assert.equal(folded.bySource.reduce((n, r) => n + r.count, 0), 3 * N, "enroll, the ended session and the anonymous caller by source");
  assert.equal(folded.windowAsks, unfolded.windowAsks, "the window asked once per request both ways");
  assert.equal(folded.sessionReads.length, 0, "the folded path reads no session");
  /* unfolded, the page's own timer read carries background to the session read (no activity, credentials R71 (7)) */
  assert.ok(unfolded.sessionReads.some((c) => c.params.background === "1"));
  assert.ok(unfolded.sessionReads.some((c) => c.params.background === undefined));

  /* control: every bearer is judged at the door and the fold adds no call for it */
  const { env, S, K } = world();
  for (const [label, token] of [["no credential", undefined], ["admin binding", env.ADMIN_TOKEN], ["probe binding", env.PROBE_TOKEN],
                                ["daemon binding", env.DAEMON_TOKEN], ["retired member key", env.MEMBER_TOKEN], ["agent credential", K.ann]]) {
    const credential = A.presentedCredential({ body: token === undefined ? null : { token } });
    env.calls.length = 0;
    assert.equal(await A.judgedInRoom(credential, env), false, `${label}: judged at the door`);
    assert.deepEqual(env.calls, [], `${label}: deciding asks nothing of the room`);
    const args = { op: "index", token, method: "GET", ...(token === env.PROBE_TOKEN ? { params: { store: "scratch" } } : {}) };
    const once = await bothWays(env, args);
    assert.equal(once.held, undefined, `${label}: no row is asked for`);
    assert.deepEqual(once.roomCalls, once.doorCalls, `${label}: no call beyond the door's own`);
    assert.deepEqual(answerOf(once.room), answerOf(once.door));
  }
  assert.equal(await A.judgedInRoom(A.presentedCredential({ body: { token: S.ann } }), env), true, "a session is judged in the room");
  assert.equal(await A.judgedInRoom(null, env), false);
});
