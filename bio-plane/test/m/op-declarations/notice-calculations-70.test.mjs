/* op-declarations, notice calculations:70 (PR 70; calculations R53, K5786; T53-603). calculations now reads an `owner`
   stamp on `calculationcreate` and `calculationevaluate` (the identity that made the selection, from the address), so
   its family here carries `owner` in `extra` for both. The stamp is checked in OP_STAMPS and driven through calculations'
   own map, so a stamp the owner does not read, or one the door does not set, is seen. Negative controls beside each. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OP_STAMPS, OP_FAMILIES } from "../../../src/op-declarations/index.mjs";
import { calculationsOps } from "../../../src/calculations/index.mjs";

const SENT = "member:sentinel-c70";
const drive = async (op, query) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await calculationsOps(svc, url, {}, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls).includes(SENT);
};

test("notice calculations:70: calculationcreate and calculationevaluate are stamped owner beside viewer", () => {
  for (const op of ["calculationcreate", "calculationevaluate"]) {
    assert.ok(OP_STAMPS[op].includes("owner"), `${op} has no owner stamp`);
    assert.ok(OP_STAMPS[op].includes("viewer"), `${op} lost its viewer stamp`);
    assert.deepEqual([...OP_FAMILIES.calculations.extra[op]], ["owner"], op);
  }
  /* negative control: the other calculations ops gain no owner stamp */
  for (const op of ["calculation", "calculationaccept", "calculationdraw"]) assert.ok(!OP_STAMPS[op].includes("owner"), op);
});

test("notice calculations:70: the owner stamp reaches calculations through its own map, from the address", async () => {
  for (const op of ["calculationcreate", "calculationevaluate"]) {
    assert.ok(await drive(op, { owner: SENT }), `${op}: owner does not reach calculations`);
    /* negative control: a key calculations does not read reaches nothing */
    assert.equal(await drive(op, { nosuchstamp: SENT }), false, `${op}: any key reaches`);
  }
});
