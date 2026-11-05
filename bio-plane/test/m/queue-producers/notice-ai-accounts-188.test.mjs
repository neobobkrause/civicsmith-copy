/* Notice ai-accounts:188 (PR 188, ai-accounts F2): ai-accounts' door arms (aiownadd, aimineuse, aimycheckset,
   aipersonalchoose, ownerOf's member arm) now take a stamped `by` that already reads `member:<id>` as the owner as it
   stands, never `member:member:<id>`. Confirmed with no code change here. Since T53 this module reads one thing of
   ai-accounts, `creditsStopsOpen` (R60), and no item it raises carries the account's owner: the item names the entry's
   `key`, `account_id`, `flagged_at` and `cause` only, so no owner those arms write can reach a member's sentence. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world } from "./world.mjs";

const SRC = readFileSync(new URL("../../../src/queue-producers/index.mjs", import.meta.url), "utf8");

test("notice ai-accounts:188: the module reads only creditsStopsOpen of ai-accounts, and its item carries no owner; control: the item is raised from the read", () => {
  assert.deepEqual([...new Set([...SRC.matchAll(/#aiAccounts\.(\w+)/g)].map((m) => m[1]))], ["creditsStopsOpen"]);
  const w = world({ aiAccounts: { creditsStopsOpen: () => [{ key: "k1", account_id: "acct-1", flagged_at: "2026-08-31T00:00:00Z", cause: "credits", owner: "member:member:x" }] } });
  w.member("ada", { role: "admin" });
  const items = w.read("ada").items.filter((i) => i.kind === "ai-credits-stop");
  assert.equal(items.length, 1, "control: raised");
  assert.ok(!JSON.stringify(items[0]).includes("member:member"), "no owner reaches the item");
});
