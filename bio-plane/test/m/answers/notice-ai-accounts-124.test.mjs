/* notice ai-accounts:124 (F1's seam): `accountFor` now answers T53's account, with the old `{key, kind}` beside it only as
   non-enumerable fields, and names the paying `owner` as ai-use spells it. answers reads neither `key` nor `kind`; the payer
   it hands `useCheck` is the `owner` accountFor answered (ownerOf), the level read only when no owner is named. Over the real
   ai-accounts (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, V } from "./fixture.mjs";
import { ownerOf } from "../../../src/answers/index.mjs";

const BOB = V("bob");

test("notice ai-accounts:124 (R30) an ask over the seam's accountFor: the payer is the owner accountFor names, the old key and kind stay out of answers' answer, and useCheck is asked for that owner", async () => {
  const w = answersWorld();
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  const served = await w.accounts.accountFor({ member: BOB, act: { kind: "ask", member: BOB } });
  assert.equal(served.ok, true, JSON.stringify(served));
  assert.equal(served.owner, "member:bob");
  assert.equal(Object.keys(served).includes("key"), false, "the seam's key is not enumerable");
  const r = await w.a.askAccount({ member: BOB });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.owner, served.owner);
  assert.equal(r.account.account_id, own);
  assert.equal(w.limit.asked.at(-1).owner, served.owner);
  assert.equal(JSON.stringify({ owner: r.owner, limit: w.limit.asked.at(-1) }).includes("sk-bob"), false, "no secret reaches useCheck");
});

test("notice ai-accounts:124 (R19, R30) ownerOf takes the owner accountFor answered over its level and the asker; with no owner named it reads the level as before", () => {
  /* an account owned by another member serving bob's act is paid by its owner, never by bob */
  assert.equal(ownerOf({ level: "member", owner: "member:carol" }, BOB), "member:carol");
  assert.equal(ownerOf({ level: "group", owner: "group" }, BOB), "group");
  assert.equal(ownerOf({ level: "project", project: "p1", owner: "project:p1" }, BOB), "project:p1");
  /* no owner, or one not spelled as ai-use's (a double prefix): the level, as before */
  assert.equal(ownerOf({ level: "member" }, BOB), "member:bob");
  assert.equal(ownerOf({ level: "member", owner: "member:member:bob" }, BOB), "member:bob");
  assert.equal(ownerOf({ level: "project", project: "p2" }, BOB), "project:p2");
});
