/* admission: T41-59 (was T40-18a; N797, K2394; DEC-184, DEC-188 (8)) — `handlecheck` is a public op that addresses
   scratch (R3), its `NO_SUCH_INVITATION` is counted as a refused key (R22), and `groupswitchset`, retired to
   `accountusesset`, is no longer among R19's session-only ops. Each spec is op-declarations' (its R24, R41, R42); each
   test drives admission at its interface, with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, world, gate, urlOf, refused, opCalls, doAnswer, makeEnv, hex64, aik, cred } from "./harness.mjs";

const { OPS, SESSION_OPS } = O;
const PUBLIC = Object.keys(OPS).filter((k) => OPS[k].classes === null);

/* ---------------------------------------------------------------------------------------------------------------- */

test("R3 (T41): handlecheck is among the public ops that address scratch — it reads an invitation, as invitelook does — so store=scratch reaches it for every caller, a confined credential's absent store= is scratch, and R1 still holds; every other public op not listed is pinned", async () => {
  assert.ok(A.SCRATCH_ADDRESSING_PUBLIC_OPS.includes("handlecheck"));
  assert.ok(Object.isFrozen(A.SCRATCH_ADDRESSING_PUBLIC_OPS));
  /* op-declarations R42: public, not mutating */
  assert.ok(OPS.handlecheck, "handlecheck is declared (op-declarations R42)");
  assert.deepEqual([OPS.handlecheck.classes, OPS.handlecheck.mutating], [null, false]);
  const { env, S, K } = world();
  const INVITE = "inv_" + hex64();
  for (const token of [undefined, "", "junk", S.ann, S.founder, K.ann, env.ADMIN_TOKEN, env.PROBE_TOKEN]) {
    for (const store of ["scratch", "bio", undefined]) {
      env.calls.length = 0;
      const r = await gate(env, { op: "handlecheck", token, params: { store } });
      assert.equal(r.public, true, `${token === undefined ? "nobody" : "a caller"} at store=${store}`);
      assert.equal(r.url.searchParams.get("store"), store ?? null, "the namespace named is the one the op reads");
      assert.equal(opCalls(env).length, 0, "nothing of the op is read here");
    }
    refused(await gate(env, { op: "handlecheck", token, params: { store: "Scratch" } }), 400, "NAMESPACE_UNKNOWN", "C-78.1", [token, INVITE]);
  }
  /* R2 before R3: a credential confined to scratch reaches handlecheck in scratch, and is refused bio by name */
  assert.equal((await gate(env, { op: "handlecheck", token: K.confined })).url.searchParams.get("store"), "scratch");
  refused(await gate(env, { op: "handlecheck", token: K.confined, params: { store: "bio" } }), 403, "NAMESPACE_CONFINED", "C-78.3", [K.confined]);
  /* at the gate itself */
  assert.equal(A.pinnedNamespaceGate(urlOf({ store: "scratch" }), "handlecheck", OPS.handlecheck), null);
  /* negative controls: the same spec under a name not listed is pinned (the unlisted default is the refusal), and
     every public op op-declarations declares is pinned exactly when it is not listed */
  const body = refused({ refusal: A.pinnedNamespaceGate(urlOf({ store: "scratch" }), "handlecheckx", OPS.handlecheck) },
                       400, "NAMESPACE_PINNED", "C-78.2");
  assert.deepEqual([body.op, body.asked, body.pinned], ["handlecheckx", "scratch", "bio"]);
  for (const op of PUBLIC) {
    const pinned = A.pinnedNamespaceGate(urlOf({ store: "scratch" }), op, OPS[op]);
    assert.equal(pinned === null, A.SCRATCH_ADDRESSING_PUBLIC_OPS.includes(op), op);
  }
  for (const op of A.SCRATCH_ADDRESSING_PUBLIC_OPS) assert.equal(OPS[op]?.classes, null, `${op} is a public op`);
});

/* ---------------------------------------------------------------------------------------------------------------- */

test("R19 (T41, DEC-188 (8)): groupswitchset, retired to accountusesset, is no longer among the session-only ops — no spec declares it, so no caller is admitted to it and no agent scope can name it — and accountusesset is admitted only from a session: every binding class refused CLASS_FORBIDDEN naming the class and an ai credential AI_BEYOND_TASK_SCOPE, each before any store call", async () => {
  /* retired: no spec, so it is no op admission admits */
  assert.equal(Object.hasOwn(OPS, "groupswitchset"), false, "groupswitchset's spec is removed (op-declarations R24, R41)");
  assert.equal(SESSION_OPS.member.has("groupswitchset") || SESSION_OPS.admin.has("groupswitchset"), false);
  refused(A.aiScopeDeclaration(["groupswitchset"]), 403, "AI_SCOPE_UNKNOWN_OP", "C-29.8");
  /* its successor, a session's only (op-declarations R41) */
  const spec = OPS.accountusesset;
  assert.ok(spec, "accountusesset is declared (op-declarations R41)");
  assert.deepEqual([[...spec.classes].sort(), spec.machineClasses, spec.mutating], [["admin", "member"], [], true]);
  const { env, S } = world();
  for (const [cls, t] of [["admin", env.ADMIN_TOKEN], ["probe", env.PROBE_TOKEN], ["daemon", env.DAEMON_TOKEN]]) {
    env.calls.length = 0;
    const body = refused(await gate(env, { op: "accountusesset", token: t, params: cls === "probe" ? { store: "scratch" } : {} }),
                         403, "CLASS_FORBIDDEN", "C-38.2", [t]);
    assert.deepEqual([body.op, body.cls], ["accountusesset", cls]);
    assert.equal(env.calls.length, 0, "before any store call");
  }
  const wide = aik();
  const w2 = world({ creds: { [wide]: cred({ tokenId: "wide", writes: ["accountusesset"] }) } });
  refused(await gate(w2.env, { op: "accountusesset", token: wide }), 403, "AI_BEYOND_TASK_SCOPE", "C-29.6", [wide]);
  assert.equal(opCalls(w2.env).length, 0, "before any store call");
  refused(A.aiScopeDeclaration(["accountusesset"]), 403, "AI_SCOPE_BEYOND_MEMBER_REACH", "C-29.9");
  /* a session reaches it: whose accounts it may set is credentials' to answer */
  for (const t of [S.founder, S.ann]) assert.equal((await gate(env, { op: "accountusesset", token: t })).caller?.viaSession, true);
  /* negative control: the group key's own switch stays R19's — a session's, refused to a binding class */
  assert.equal((await gate(env, { op: "groupkeyswitch", token: S.founder })).caller?.viaSession, true);
  refused(await gate(env, { op: "groupkeyswitch", token: env.ADMIN_TOKEN }), 403, "CLASS_FORBIDDEN", "C-38.2");
});

/* ---------------------------------------------------------------------------------------------------------------- */

test("R22 (T41): op=handlecheck answered NO_SUCH_INVITATION is counted once as kind credential, as invitelook's is — with the request's country, none when the request presents a session naming a member — through one POST to bio's securitycount carrying kind and country only; handlecheck's other answers (its own pause, a free or taken handle) and NO_SUCH_INVITATION at an op not named are not counted", async () => {
  const reqIn = (country) => { const r = new Request("https://plane.example/api"); Object.defineProperty(r, "cf", { value: { country } }); return r; };
  const env = makeEnv();
  const INVITE = "inv_" + hex64();
  const refusedInvite = { ok: false, reason: "NO_SUCH_INVITATION", code: "NO_SUCH_INVITATION", check: "C-1.1", translation: "x" };
  const session = hex64();
  for (const [presented, country] of [[{ token: null }, "NZ"], [{ token: "junk" }, "NZ"], [{ token: session }, null]]) {
    env.calls.length = 0;
    const args = { op: "handlecheck", answer: refusedInvite, presented };
    const before = JSON.stringify(refusedInvite);
    assert.equal(A.securityKindOf(args), "credential");
    assert.deepEqual(await A.securityTally({ ...args, req: reqIn("NZ"), env, doAnswer }), { kind: "credential", country });
    assert.equal(JSON.stringify(refusedInvite), before, "the refusal is not changed");
    assert.deepEqual(env.calls.map((c) => [c.ns, c.route, c.method, c.href, c.body]),
                     [["bio", "securitycount", "POST", "http://do/securitycount", { kind: "credential", country }]]);
    assert.equal(env.calls[0].raw.includes(session) || env.calls[0].raw.includes(INVITE), false, "nothing of the request but its country");
  }
  /* the same as invitelook's, answered relayed (`{status, body}`) or bare */
  for (const answer of [refusedInvite, { status: 200, body: refusedInvite }])
    assert.deepEqual([A.securityKindOf({ op: "handlecheck", answer }), A.securityKindOf({ op: "invitelook", answer })], ["credential", "credential"]);
  /* negative controls: not counted, and nothing written */
  const notCounted = [
    { op: "handlecheck", answer: { ok: false, code: "HANDLE_CHECK_PAUSED", stated: "s", retryAfter: 60 } },
    { op: "handlecheck", answer: { ok: true, result: { ok: true, handle: "ann", state: "taken", problems: [], suggestion: "ann-2" } } },
    { op: "handlecheck", answer: { ok: true, result: { ok: true, handle: "bea", state: "free" } } },
    { op: "handlecheck", answer: { ok: false, code: "WEBSITE_KEY_UNKNOWN" } },
    { op: "handlechange", answer: refusedInvite },
    { op: "groupdescription", answer: refusedInvite },
  ];
  for (const args of notCounted) {
    env.calls.length = 0;
    assert.equal(A.securityKindOf({ ...args, presented: { token: null } }), null, JSON.stringify(args));
    assert.equal(await A.securityTally({ ...args, presented: { token: null }, req: reqIn("NZ"), env, doAnswer }), null, JSON.stringify(args));
    assert.equal(env.calls.length, 0, `not counted: ${JSON.stringify(args)}`);
  }
});

/* ---------------------------------------------------------------------------------------------------------------- */

test("R20 (T41; K2576, op-declarations R42): handlecheck's invite and handle are body-only — a query's copy is stripped before any reader of the URL, so a request naming its invitation only in the query reaches the op with none (membership then answers NO_SUCH_INVITATION, as R17's doors answer a missing key); the session a member asks with, and every other parameter, stay", async () => {
  const INVITE = "inv_" + hex64(), HANDLE = "rosa-m";
  assert.deepEqual([...A.BODY_ONLY_FIELDS.handlecheck].sort(), ["handle", "invite"]);
  assert.ok(Object.isFrozen(A.BODY_ONLY_FIELDS.handlecheck));
  /* at the gate */
  const u = urlOf({ op: "handlecheck", invite: INVITE, handle: HANDLE, store: "scratch", x: "1" });
  assert.equal(A.queryGate(u, "handlecheck"), null, "it never refuses");
  assert.deepEqual(Object.fromEntries(u.searchParams), { op: "handlecheck", store: "scratch", x: "1" });
  assert.equal(u.href.includes(INVITE) || u.href.includes(HANDLE), false);
  /* through the door's order, for an invitee and a signed-in member alike */
  const { env, S } = world();
  for (const token of [undefined, S.ann]) for (const store of [undefined, "scratch"]) {
    env.calls.length = 0;
    const r = await gate(env, { op: "handlecheck", token, params: { invite: INVITE, handle: HANDLE, store } });
    assert.equal(r.public, true);
    assert.deepEqual([r.url.searchParams.has("invite"), r.url.searchParams.has("handle"), r.url.searchParams.get("store")], [false, false, store ?? null]);
    assert.equal(JSON.stringify([...r.url.searchParams]).includes(INVITE), false);
    if (token) assert.equal(r.credential.token, token, "the member's session is still presented (header), for the op's viewer");
    for (const c of env.calls) assert.equal(c.href.includes(INVITE), false, "the invitation reaches no request's address");
  }
  /* negative controls: invitelook (not named body-only) keeps its query's invitation, and handlechange's handle is
     the op's own concern (its URL is left as it came) */
  for (const op of ["invitelook", "handlechange"]) {
    const v = urlOf({ invite: INVITE, handle: HANDLE });
    A.queryGate(v, op);
    assert.deepEqual(Object.fromEntries(v.searchParams), { invite: INVITE, handle: HANDLE }, op);
  }
});
