/* admission: its refusal rows (R14) and what its refusals never carry (R15). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { A, C, O, world, gate, refused, member, hex64, aik, cred, PLACES, arranged } from "./harness.mjs";

const { UNATTENDED_BY_DECISION } = O;

/* Every refusal this module answers, driven at its interface, with the credentials each request carried. */
async function sweep() {
  const lack = hex64();
  const expired = aik();
  const { env, S, K } = world({ sessions: { [lack]: member("bea", []) },
                                creds: { [expired]: cred({ tokenId: "agent-lapsed", expired: true, expiresAt: "2026-01-01T00:00:00Z" }) } });
  K.expired = expired;
  const secrets = [env.ADMIN_TOKEN, env.MEMBER_TOKEN, env.PROBE_TOKEN, env.DAEMON_TOKEN, ...Object.values(S), ...Object.values(K), lack];
  const out = [];
  const d = async (req) => { const r = await gate(env, req); if (r.refusal) out.push(r.refusal); };
  await d({ op: "index" });                                                          /* C-38.1 */
  await d({ op: "index", token: env.DAEMON_TOKEN, method: "GET" });                  /* C-38.2 */
  await d({ op: "purge", token: S.ann });                                            /* C-38.3 */
  await d({ op: "export", token: S.ann });                                           /* C-38.4 */
  await d({ op: "promote", token: lack });                                           /* C-38.5 */
  await d({ op: "index", token: env.PROBE_TOKEN, params: { store: "bio" }, method: "GET" }); /* C-38.6 */
  await d({ op: "governorconfig", token: S.ann });                                   /* C-38.7 */
  out.push(A.sessionOpGate("member", "purge", O.OPS.purge, "POST", arranged((m, a, d) => { delete d.purge; })));               /* C-38.8 */
  await d({ op: "index", params: { store: "nope" } });                               /* C-78.1 */
  await d({ op: "knock", params: { store: "scratch" } });                            /* C-78.2 */
  await d({ op: "index", token: K.confined, params: { store: "bio" } });             /* C-78.3 */
  await d({ op: "purge", token: K.ann });                                            /* C-29.6 */
  await d({ op: "index", token: K.revoked, method: "GET" });                         /* C-29.7 */
  await d({ op: "index", token: K.expired, method: "GET" });                         /* C-29.30 */
  out.push(A.doorRateLimited(42));                                                   /* C-38.9 */
  await d({ op: "index", token: S.ann, via: "query", method: "GET" });               /* C-38.10 */
  await d({ op: "index", token: env.MEMBER_TOKEN, method: "GET" });                  /* C-38.11 */
  for (const asked of [{ writes: ["nope"] }, { writes: ["purge"] }, { writes: [], confinedTo: "bio" }])
    out.push((await A.aiCredentialMint(asked, "member")).refusal);                   /* C-29.8, .9, .10 */
  await d({ op: "adminendorse", token: env.ADMIN_TOKEN });                           /* C-32.17 */
  await d({ op: "groupnameset", token: env.ADMIN_TOKEN });                           /* C-64.4 */
  out.push(A.projectCreationGate(new Set()));                                        /* C-38.5, its second condition */
  return { out, secrets };
}

test("R14: the admission share of the checks is this module's own — C-38.1–C-38.11, C-78.1–C-78.3, C-29.6–C-29.10, C-29.30, C-32.17, C-64.4 — each raised by a gate here, carrying its row's check and its word (R28: `refusal.<CODE>`), each row's `where` naming a site in this module", async () => {
  const own = {};
  for (const [fam, rows] of Object.entries(C)) {
    assert.match(fam, /_CHECKS$/);
    for (const [code, row] of Object.entries(rows)) { assert.equal(own[code], undefined, code); own[code] = row; }
  }
  assert.deepEqual(Object.keys(C).sort(), ["ADMISSION_CHECKS", "AI_SCOPE_CHECKS", "GROUP_IDENTITY_FENCE_CHECKS", "NAMESPACE_CHECKS", "OPERATOR_FENCE_CHECKS"]);
  const { out } = await sweep();
  const got = {};
  for (const r of out) {
    const row = own[r.body.reason];
    assert.ok(row, r.body.reason);
    /* the sentence is the word of the code, read through setup-words; minutes is the one placeholder any of them holds */
    assert.deepEqual([r.body.code, r.body.check, r.body.translation],
                     [r.body.reason, row.check, word(`refusal.${r.body.reason}`, { minutes: r.body.minutes })], r.body.reason);
    got[r.body.reason] = r.body.check;
  }
  assert.deepEqual(got, {
    NOT_AUTHENTICATED: "C-38.1", CLASS_FORBIDDEN: "C-38.2", MACHINE_CREDENTIAL_REQUIRED: "C-38.3", ROOT_OF_TRUST_REQUIRED: "C-38.4",
    NOT_CAPABLE: "C-38.5", SCOPE_REFUSED: "C-38.6", SESSION_ROLE_CANNOT_REACH_OP: "C-38.7", SESSION_ROUTE_NOT_RECORDED: "C-38.8",
    DOOR_RATE_LIMITED: "C-38.9", CREDENTIAL_IN_ADDRESS: "C-38.10", MEMBER_TOKEN_RETIRED: "C-38.11", AI_CREDENTIAL_EXPIRED: "C-29.30",
    NAMESPACE_UNKNOWN: "C-78.1", NAMESPACE_PINNED: "C-78.2", NAMESPACE_CONFINED: "C-78.3",
    AI_BEYOND_TASK_SCOPE: "C-29.6", AI_CREDENTIAL_REVOKED: "C-29.7", AI_SCOPE_UNKNOWN_OP: "C-29.8",
    AI_SCOPE_BEYOND_MEMBER_REACH: "C-29.9", AI_CONFINEMENT_NOT_SCRATCH: "C-29.10",
    OPERATOR_TOKEN_CANNOT_GOVERN: "C-32.17", GROUP_IDENTITY_NEEDS_SESSION: "C-64.4",
  });
  assert.deepEqual(Object.keys(own).sort(), Object.keys(got).sort(), "every row is raised, and nothing is raised without one");
  for (const [code, row] of Object.entries(own)) {
    assert.match(row.where, /^src\/admission\/index\.mjs [A-Za-z]+ > is-[a-z-]+$/, code);
    /* the row holds its check, its site and the word of its code as `translation`, which the families' readers (the envelope's
       decoration) take as ever; the placeholder DOOR_RATE_LIMITED's word holds is left as written, a row knowing no wait */
    assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"], code);
    assert.equal(row.translation, word(`refusal.${code}`, code === "DOOR_RATE_LIMITED" ? { minutes: "{minutes}" } : {}), code);
  }
});

test("R15: no credential, session token or secret appears in any refusal this module answers, and no place is named in its behaviour or outward text", async () => {
  const { out, secrets } = await sweep();
  assert.ok(out.length >= 23);
  for (const r of out) {
    const text = JSON.stringify(r);
    for (const s of secrets) assert.equal(text.includes(s), false, `${r.body.reason} carries a credential`);
    assert.equal(text.includes(String(r.body.sha ?? "<none>")), false);
    assert.doesNotMatch(text, PLACES, r.body.reason);
  }
  /* a revoked agent's refusal names its identity, never its value */
  const v = aik();
  const w = world({ creds: { [v]: cred({ tokenId: "named", revoked: true, revokedAt: "d", revokedBy: "ann" }) } });
  const r = await gate(w.env, { op: "index", token: v, method: "GET" });
  assert.equal(r.refusal.body.tokenId, "named");
  assert.equal(JSON.stringify(r).includes(v), false);
  /* the outward text at rest: every row, and the recorded decisions' citations read here */
  for (const rows of Object.values(C)) for (const code of Object.keys(rows)) assert.doesNotMatch(word(`refusal.${code}`, { minutes: 1 }), PLACES, code);
  for (const t of Object.values(UNATTENDED_BY_DECISION)) assert.doesNotMatch(String(t), PLACES);
});
