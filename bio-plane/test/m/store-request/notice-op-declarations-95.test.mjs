/* store-request, notice op-declarations:95 (PR 95: R20, R24, R30, R41 restated for T53; ai-accounts R35). The group key's ops, the
   account-reference ops and `subscriptiondisconnect` are retired with no alias. Adapted: the world's door kept an arm for
   `subscriptiondisconnect` and named it among the ops it answers itself (R20's class (b)); both are gone, so every op the world
   answers by its own arm is one op-declarations declares. recipes-b7's writing-help control now expects ai-accounts' recipient
   notice (`RECIPIENT_NOTICE_DUE`, its R51), which replaced the group key's notice. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { worldAnswers } from "./door.mjs";
import { storeWorld } from "./fixtures.mjs";

const RETIRED = ["groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeystate", "groupkeynotice", "groupkeynoticeseen",
                 "accountreferenceset", "accountreferenceremove", "accountreference", "subscriptiondisconnect"];

test("notice op-declarations:95 (R20): the world's door answers no retired op by an arm of its own, and every op its source arms by name is declared", () => {
  for (const op of RETIRED) {
    assert.equal(Object.hasOwn(OPS, op), false, `${op} is retired`);
    assert.equal(worldAnswers(op), false, `${op}: no arm in the world's door`);
  }
  const src = readFileSync(new URL("./door.mjs", import.meta.url), "utf8");
  const armed = [...new Set([...src.matchAll(/op === "([a-z]+)"/g)].map((m) => m[1]))];
  assert.deepEqual(armed.filter((op) => !Object.hasOwn(OPS, op)), [], "an arm names only a declared op");
});

test("notice op-declarations:95: a retired op asked of the world's door reaches no arm and changes nothing; control: the declared successor read answers", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann");
  for (const op of ["subscriptiondisconnect", "accountreference", "groupkeystate"]) {
    const r = await w.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, ann);
    const j = r.json && r.json.result !== undefined ? r.json.result : r.json;
    assert.ok(r.status >= 400, `${op}: refused (${r.status})`);
    assert.equal(j.ok, false, op);
  }
  const own = await ann.read("accountsof", { query: { owner: `member:${ann.member}` } });
  assert.deepEqual([own.ok, own.accounts], [true, []]);
});
