/* admission: an agent credential's scope and confinement, judged at the mint, and the secrets generated here (R13).
   Carries the convert `aicredential` (C-29.9's classes). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, O, refused, sha } from "./harness.mjs";

const { OPS, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS } = O;

test("R13: an agent credential's scope is judged at the mint — AI_SCOPE_UNKNOWN_OP (C-29.8), AI_SCOPE_BEYOND_MEMBER_REACH (C-29.9, every op R12 refuses a bearer included), AI_CONFINEMENT_NOT_SCRATCH (C-29.10); the credential's value and a review grant's secret are generated here, returned once and passed on only as their SHA-256", async () => {
  for (const bad of ["nosuchop", "INDEX", "__proto__x", "constructor"]) {
    const body = refused(A.aiScopeDeclaration([bad]), 403, "AI_SCOPE_UNKNOWN_OP", "C-29.8");
    assert.equal(body.op, bad);
  }
  /* every op no member reaches, and only those, is refused C-29.9; its `classes` is the row's (null for a public op) */
  const beyond = Object.keys(OPS).filter((k) => !A.aiReachesAsMember(OPS[k], k));
  for (const op of [...GOVERNANCE_ACTIONS, ...IDENTITY_ACTIONS, "purge", "capturerequestdrain", "memberadd", "export", "claim", "knock"])
    assert.ok(beyond.includes(op), op);
  const details = {};
  for (const op of beyond) {
    const body = refused(A.aiScopeDeclaration(["index", op]), 403, "AI_SCOPE_BEYOND_MEMBER_REACH", "C-29.9");
    assert.deepEqual([body.op, body.classes], [op, Array.isArray(OPS[op].classes) ? OPS[op].classes : null]);
    /* the two reasons are told apart: one detail for the ops a member reaches only from a session, another for the rest */
    const shape = Array.isArray(OPS[op].machineClasses) ? "session" : "unreachable";
    (details[shape] ??= new Set()).add(body.detail.split(op.slice(0, 60)).join("<op>"));
  }
  assert.deepEqual(Object.keys(details).sort(), ["session", "unreachable"]);
  for (const k of Object.keys(details)) assert.equal(details[k].size, 1, `${k}: one detail for each reason`);
  assert.notEqual([...details.session][0], [...details.unreachable][0]);
  /* negative control: every op a member reaches is declarable; trimmed, de-duplicated, sorted */
  const reachable = Object.keys(OPS).filter((k) => A.aiReachesAsMember(OPS[k], k));
  assert.deepEqual(A.aiScopeDeclaration(reachable), { writes: [...reachable].sort() });
  assert.deepEqual(A.aiScopeDeclaration([" promote ", "cite", "promote", "", null]), { writes: ["cite", "promote"] });
  for (const none of [undefined, null, "promote", {}]) assert.deepEqual(A.aiScopeDeclaration(none), { writes: [] });
  /* the confinement */
  for (const bad of ["bio", "Scratch", "SCRATCH", "scratch\n", " ", "", 0, false]) {
    const body = refused(A.aiConfinementDeclaration(bad), 403, "AI_CONFINEMENT_NOT_SCRATCH", "C-29.10");
    assert.deepEqual(body.confinements, ["scratch"]);
  }
  for (const none of [null, undefined]) assert.deepEqual(A.aiConfinementDeclaration(none), { confinedTo: null });
  assert.deepEqual(A.aiConfinementDeclaration("scratch"), { confinedTo: "scratch" });
  /* the mint: a refused declaration generates nothing; an admitted one a fresh value, passed on as its digest */
  for (const [asked, code] of [[{ writes: ["adminendorse"] }, "AI_SCOPE_BEYOND_MEMBER_REACH"], [{ writes: ["groupnameset"] }, "AI_SCOPE_BEYOND_MEMBER_REACH"],
                               [{ writes: ["nope"] }, "AI_SCOPE_UNKNOWN_OP"], [{ writes: [], confinedTo: "bio" }, "AI_CONFINEMENT_NOT_SCRATCH"]]) {
    const r = await A.aiCredentialMint(asked, "member");
    assert.equal(r.refusal.body.reason, code);
    assert.deepEqual([r.refusal.body.op, r.refusal.body.cls], ["aicredentialmint", "member"]);
    assert.equal("secret" in r, false);
  }
  const seen = new Set();
  for (const confinedTo of ["scratch", undefined]) {
    const m = await A.aiCredentialMint({ writes: ["promote", " cite"], confinedTo }, "member");
    assert.match(m.secret, /^aik-[0-9a-f]{64}$/);
    assert.ok(A.AI_TOKEN_SHAPE.test(m.secret));
    assert.equal(m.secretSha, sha(m.secret));
    assert.deepEqual([m.writes, m.confinedTo], [["cite", "promote"], confinedTo ?? null]);
    seen.add(m.secret);
  }
  for (const odd of [null, [], "x"]) assert.match((await A.aiCredentialMint(odd, "admin")).secret, /^aik-/);
  assert.equal(seen.size, 2, "each mint a fresh value");
  /* a review grant's secret: the same rule */
  const g1 = await A.reviewGrantSecret(), g2 = await A.reviewGrantSecret();
  for (const g of [g1, g2]) {
    assert.match(g.secret, /^rv1_[A-Za-z0-9_-]{43}$/);
    assert.equal(g.secretSha, sha(g.secret));
  }
  assert.notEqual(g1.secret, g2.secret);
});
