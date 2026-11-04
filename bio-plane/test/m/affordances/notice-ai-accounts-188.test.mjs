/* affordances: provider notice ai-accounts:188 (PR 188: source only; its F2). The door arms of a member's own act
   (`aiownadd`, `aimineuse`, `aimycheckset`, `aipersonalchoose`, `ownerOf`'s member arm) take the stamped `by` as the
   owner when it already starts `member:`. Confirmed, no code change: this module's code calls no ai-accounts door arm
   or service, and the change adds and renames no op, so every op ai-accounts' door answers stays accounted for (R12) and
   none becomes an act (R1); which owner an act writes is the owner's, never pre-flighted here (R18 asks only what the
   refusal admits). Read from the owner's own table (K3268). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as A from "../../../src/affordances.mjs";
import { aiAccountsOps, DECLARED_OPS } from "../../../src/ai-accounts/index.mjs";

const SRC = new URL("../../../src/", import.meta.url);
const CHANGED_ARMS = ["aiownadd", "aimineuse", "aimycheckset", "aipersonalchoose", "aiaccountadd", "aiorderset"];
const published = (op) => [...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].some((a) => a.id === op);

test("notice ai-accounts:188: this module's code imports no ai-accounts and calls none of its door arms", () => {
  const files = ["affordances.mjs", ...readdirSync(new URL("affordances/", SRC)).filter((f) => f.endsWith(".mjs")).map((f) => `affordances/${f}`)];
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    assert.ok(!/from\s+["'][^"']*ai-accounts/.test(text), `${f} imports no ai-accounts`);
    assert.ok(!/aiAccountsOps/.test(text), `${f} calls no ai-accounts door arm`);
  }
});

test("notice ai-accounts:188 (R12 R1): the arms PR 188 changed are still served and declared, accounted for, and no act", () => {
  const ops = Object.keys(aiAccountsOps({}, new URL("http://x/?by=member:ann"), {}, null));
  for (const op of CHANGED_ARMS) {
    assert.ok(ops.includes(op), `ai-accounts answers ${op}`);
    assert.ok(Object.hasOwn(DECLARED_OPS, op), `${op} is declared`);
  }
  const rows = Object.entries(DECLARED_OPS).map(([op, d]) => ({ op, mutating: d.mutating !== false, gated: true }));
  const r = A.unaccounted(rows);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  for (const op of CHANGED_ARMS) assert.equal(published(op), false, `${op} is no act`);
  /* control: an op no table holds is seen */
  assert.deepEqual(A.unaccounted([...rows, { op: "notice188control", mutating: true, gated: true }]).unranked, ["notice188control"]);
});
