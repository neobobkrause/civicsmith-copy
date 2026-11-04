/* T53 (BOB #325; K2352, K3218, K5457; `ai-accounts` R11, R26, R50, R51), at the interface: each T53 amendment's own
   Test line. R63: a run credential carries the `account_id` ai-runs gives it, and is revoked when that account's
   reference resolves to nothing. R73: every `why` ai-accounts R26 sends revokes a live run credential, each brought about
   by ai-accounts' or membership's real act. R27: a member served only by the team's account is asked its recipient's
   notice (`RECIPIENT_NOTICE_DUE`), and a retired notice code is never returned. Every refusal has a control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, PASSWORD, PLANS, HOSTS } from "./fixture.mjs";
import { ACCOUNT_CLEARED_WHY } from "../../../src/credentials/index.mjs";

const look = (w, token) => w.c.aiCredentialLook({ secretSha: sha(token) }).credential;
const run = (w, member, id, account_id) => w.c.aiRunCredentialMint({ member, run: id, writes: ["airuntick"], account_id });
const RETIRED = ["GROUP_KEY_NOTICE_DUE", "PROJECT_KEY_NOTICE_DUE"];

test("R63 a run credential minted for account A (the team's) is revoked when A's reference resolves to nothing; control: a credential for a run on account B (her own) is not", async () => {
  const w = await world().group("ann");
  const A = await w.on(w.team(), "ann");
  const B = await w.on(w.own("ann"), "ann");
  const onA = run(w, "ann", "RUN-A", A.account_id);
  const onB = run(w, "ann", "RUN-B", B.account_id);
  assert.deepEqual([onA.ok, onB.ok], [true, true]);
  assert.equal(w.row(`SELECT account_id FROM ai_credentials WHERE token_id=?`, onA.tokenId).account_id, A.account_id,
    "the account ai-runs gave is on the row");
  assert.deepEqual([look(w, onA.token).revoked, look(w, onB.token).revoked], [false, false]);
  w.a.accountCredentialFailed({ account_id: A.account_id, why: "unresolved" });
  assert.equal(look(w, onA.token).revoked, true, "A resolved to nothing: its run's credential is revoked");
  assert.equal(look(w, onB.token).revoked, false, "control: the run on B keeps its credential");
});

/* How each of ai-accounts R26's reasons is brought about, by the real act that sends it. */
const CLEARINGS = {
  removed: (w, set) => w.a.accountRemove({ account_id: set.account_id, by: "ann" }),
  disconnected: (w, set) => w.a.issuedTokenDrop({ account_id: set.account_id, by: "ann" }),
  revoked: (w) => w.m.memberSet({ memberId: "ann", status: "revoked", by: "second" }),
  refused: (w, set) => w.a.accountCredentialFailed({ account_id: set.account_id, why: "refused" }),
  unresolved: (w, set) => w.a.accountCredentialFailed({ account_id: set.account_id, why: "unresolved" }),
};

test("R73 each `why` ai-accounts R26 sends is driven here, and each revokes a live run credential of the cleared account; control: a run on another member's account keeps its credential", async () => {
  assert.deepEqual(Object.keys(CLEARINGS).sort(), [...ACCOUNT_CLEARED_WHY].sort(), "every reason, none missed");
  for (const why of ACCOUNT_CLEARED_WHY) {
    const w = await world().group("ann", "bob");
    const sa = await w.signin("ann");
    const sb = await w.signin("bob");
    const a = run(w, "ann", "RUN-A", sa.account_id);
    const b = run(w, "bob", "RUN-B", sb.account_id);
    assert.deepEqual([a.ok, b.ok], [true, true], why);
    assert.equal((await CLEARINGS[why](w, sa)).ok, true, `${why}: the act succeeds`);
    assert.equal(look(w, a.token).revoked, true, `${why}: her run's credential is revoked`);
    assert.equal(look(w, b.token).revoked, false, `${why}: control, bob's run keeps its credential`);
  }
});

test("R73 control: an account cleared while another of hers still serves leaves her standing grant; cleared with none left, it ends", async () => {
  const w = await world().group("ann");
  const one = await w.on(w.own("ann"), "ann");
  const two = await w.on(w.own("ann", { secret: "sk-second-ann-key-0123456789" }), "ann");
  for (const set of [one, two])
    assert.equal(w.a.accountUsesSet({ account_id: set.account_id, switch: "standing", on: true, by: "ann" }).ok, true);
  const g = await w.c.aiGrantMintStanding({ member: "ann", question: "what is new?" });
  assert.equal(g.ok, true);
  const held = async () => (await w.c.aiGrantHeld({ token: g.token })).ok;
  assert.equal(w.a.accountRemove({ account_id: one.account_id, by: "ann" }).ok, true);
  assert.equal(await held(), true, "her other account still serves: the grant stands");
  assert.equal(w.a.accountRemove({ account_id: two.account_id, by: "ann" }).ok, true);
  assert.equal(await held(), false, "none serves: ended");
});

test("R27 a member with no account of her own, at the team's level only, is asked the recipient's notice with RECIPIENT_NOTICE_DUE; control: a member served by an account is asked none, and no retired code is returned", async () => {
  const w = await world().group("ann", "bob");
  await w.on(w.team());   /* the team's account on, no member's notice read */
  await w.served("ann");  /* ann: her own account, its notice read */
  const sb = (await w.c.login({ handle: "bob", password: PASSWORD("bob") })).token;
  const sa = (await w.c.login({ handle: "ann", password: PASSWORD("ann") })).token;
  const due = await w.c.aiGrantMint({ member: "bob", by: "bob", session: sb });
  assert.deepEqual([due.ok, due.reason], [false, "RECIPIENT_NOTICE_DUE"]);
  assert.ok(!RETIRED.includes(due.code) && !RETIRED.includes(due.reason));
  const granted = await w.c.aiGrantMint({ member: "ann", by: "ann", session: sa });
  assert.deepEqual(Object.keys(granted).sort(), ["expires", "ok", "token"], "control: served, asked no notice");
  assert.equal(w.a.recipientNoticeSeen({ member: "bob", provider: PLANS.provider, host: HOSTS.main, by: "bob" }).ok, true);
  const then = await w.c.aiGrantMint({ member: "bob", by: "bob", session: sb });
  assert.equal(then.ok, true, "notice read: granted");
});

/* The p3dev-l1 walk (4 Nov) stopped LOGIN_FAILED after a claim. This module's two routes, given exactly what the
   control plane relays for the walk (a `jadmin-<hex>` handle, `device: "own"`), claim and then sign in by that handle,
   answering `ok: true` with a token. */
test("R74 R75 through this module's ops map, a claim with a walk-shaped handle then a login by that handle on an own device answers ok with a token; control: a wrong password is refused", async () => {
  const w = world();
  await w.ready;
  const password = "Abcdefghijklmnopqrstuvwxyz0123456789_-AB";
  const claim = await w.ops("op=claim&fp=fp-walk", { handle: "jadmin-a1b2c3", password }).claim();
  assert.deepEqual([claim.ok, claim.role, claim.handle], [true, "admin", "jadmin-a1b2c3"]);
  const login = await w.ops("op=login", { handle: "jadmin-a1b2c3", password, device: "own" }).login();
  assert.deepEqual([login.ok, login.role, login.device, typeof login.token], [true, "admin", "own", "string"]);
  assert.equal(w.c.session(login.token).handle, "jadmin-a1b2c3");
  const wrong = await w.ops("op=login", { handle: "jadmin-a1b2c3", password: password + "x", device: "own" }).login();
  assert.deepEqual([wrong.ok, wrong.reason, wrong.token], [false, "SIGN_IN_REFUSED", undefined]);
});
