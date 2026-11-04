/* affordances: provider notice ai-accounts:124 (PR 124: source only, no requirement text). It changed the signatures of
   `accountFor`, `accountUses`, `accountUsesOf` and `accountUsesSet` to one `args` object (each old form answered beside the
   new) and added fourteen deprecated in-plane services (`legacy.mjs`: `accountReferenceSet`, `groupKeySet`, ...).
   Confirmed, no code change: this module's code calls no ai-accounts service (its uses of ai-accounts are tests only, Uses
   T48), and the added services are no ops, so nothing is newly gated, published or graded (R1, R12); the ops ai-accounts
   declares stay accounted for, read from the owner's own table and op-grades', never a hand list (K3268). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as A from "../../../src/affordances.mjs";
import { AiAccounts, aiAccountsOps, DECLARED_OPS } from "../../../src/ai-accounts/index.mjs";

const SRC = new URL("../../../src/", import.meta.url);
const ADDED = ["accountReferenceRemove", "accountReferenceSet", "accountReferenceState", "groupKeyNoticeSeen", "groupKeySet", "groupKeyState",
  "groupKeySwitch", "groupKeySwitches", "projectAccountState", "projectAccountSwitch", "projectKeyNoticeSeen", "projectKeySet",
  "subscriptionConnected", "subscriptionTokenHold"];
const CHANGED = ["accountFor", "accountUses", "accountUsesOf", "accountUsesSet"];
const published = (op) => [...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].some((a) => a.id === op);
const opKeys = () => Object.keys(aiAccountsOps({}, new URL("http://x/"), {}, null));

test("notice ai-accounts:124: this module's code imports no ai-accounts and calls none of the changed or added services", () => {
  const files = ["affordances.mjs", ...readdirSync(new URL("affordances/", SRC)).filter((f) => f.endsWith(".mjs")).map((f) => `affordances/${f}`)];
  assert.ok(files.length > 1);
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    assert.ok(!/from\s+["'][^"']*ai-accounts/.test(text), `${f} imports no ai-accounts`);
    for (const name of [...CHANGED, ...ADDED]) assert.ok(!new RegExp(`\\.${name}\\s*\\(`).test(text), `${f} calls no ${name}`);
  }
  /* the services PR 124 names are the provider's (control: the scan looks for names that exist) */
  for (const name of [...CHANGED, ...ADDED]) assert.equal(typeof AiAccounts.prototype[name], "function", `ai-accounts serves ${name}`);
});

test("notice ai-accounts:124 (R12 R1): the added services are no ops, and every op ai-accounts declares stays accounted for and no act", () => {
  const ops = opKeys();
  for (const name of ADDED) assert.ok(!ops.includes(name.toLowerCase()), `${name} is in-plane, no op`);
  const rows = Object.entries(DECLARED_OPS).map(([op, d]) => ({ op, mutating: d.mutating !== false, gated: true }));
  assert.ok(rows.length > 0);
  for (const { op } of rows) assert.ok(ops.includes(op), `ai-accounts answers ${op}`);
  const r = A.unaccounted(rows);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  for (const { op } of rows) assert.equal(published(op), false, `${op} is no act`);
  /* control: an op no table holds is seen */
  assert.deepEqual(A.unaccounted([...rows, { op: "notice124control", mutating: true, gated: true }]).unranked, ["notice124control"]);
});
