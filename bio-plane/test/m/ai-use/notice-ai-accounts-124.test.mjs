/* ai-use: provider notice ai-accounts:124 (PR 124: source only, no requirement text). PR 124 gave `accountFor`,
   `accountUses`, `accountUsesOf` and `accountUsesSet` their old forms again beside the T53 ones (`{owner}`, `{key}`), and
   added fourteen deprecated in-plane services (`legacy.mjs`, ai-accounts F1). Confirmed, no code change: this module reads an
   account only through the T53 forms, `accountUsesOf({account_id})` (R3, R6, R9, R17's read), `accountActBar` and
   `accountsOf` (Uses), and calls none of the deprecated services, so the seam can go without touching ai-use. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { standard } from "./fixture.mjs";
import { AiAccounts } from "../../../src/ai-accounts/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const SRC = new URL("../../../src/ai-use/", import.meta.url);
const ADDED = ["accountReferenceRemove", "accountReferenceSet", "accountReferenceState", "groupKeyNoticeSeen", "groupKeySet", "groupKeyState",
  "groupKeySwitch", "groupKeySwitches", "projectAccountState", "projectAccountSwitch", "projectKeyNoticeSeen", "projectKeySet",
  "subscriptionConnected", "subscriptionTokenHold"];

test("notice ai-accounts:124: ai-use's code calls none of the deprecated services, and calls accountUsesOf only by account_id", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length > 0);
  let reads = 0;
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    for (const name of ADDED) assert.ok(!new RegExp(`\\.${name}\\s*\\(`).test(text), `${f} calls no ${name}`);
    for (const m of text.matchAll(/\.(accountUsesOf|accountUses|accountUsesSet|accountFor)\s*\(([^)]*)\)/g)) {
      assert.match(m[2], /^\s*\{\s*account_id\b/, `${f}: ${m[0]} names the account by id`);
      reads++;
    }
  }
  assert.ok(reads > 0, "the module reads an account (control: the scan finds the calls)");
  /* control: the names scanned for are the provider's */
  for (const name of ADDED) assert.equal(typeof AiAccounts.prototype[name], "function", `ai-accounts serves ${name}`);
});

test("notice ai-accounts:124 (R3): a member's explore is read from the account named, never from her head account as the old {owner} form answers it", async () => {
  const w = await standard();
  const second = await w.account("member:ann", "ann");
  assert.equal(w.explore(second, "yes", "ann").ok, true);
  /* the deprecated owner form reads her head account (the first held, at no) */
  const head = w.a.accountUsesOf({ owner: "member:ann" });
  assert.equal(head.account_id, w.acct.ann);
  assert.equal(head.uses.explore, "no");
  /* ai-use reads the account named, through the T53 form alone */
  const calls = [];
  const orig = w.a.accountUsesOf.bind(w.a);
  w.a.accountUsesOf = (args) => { calls.push(args); return orig(args); };
  const check = (account_id) => w.u.useCheck({ owner: "member:ann", member: "ann", use: "explore", at: AT, account_id });
  assert.equal(check(second), null, "her second account, at yes, passes");
  assert.equal(check(w.acct.ann).code, "EXPLORE_NOT_ENABLED", "control: her head account, at no, refuses");
  assert.ok(calls.length > 0);
  for (const c of calls) assert.deepEqual(Object.keys(c), ["account_id"], JSON.stringify(c));
});
