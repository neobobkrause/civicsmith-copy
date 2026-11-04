/* op-declarations, notice membership:77 (PR 77; membership R154, K5562, K5563). membership's delegates now include
   member-roster's adminProposalCancel and adminRemovals, whose ops adminproposalcancel and adminremovals membershipOps
   answers beside its own. Confirmed with no code change here: both ops are declared through member-roster's
   DECLARED_OPS (registered as the plane registers them, R80), sit in both session sets, are stamped `by`, and reach
   member-roster through membership's own map with that stamp. Negative controls beside each. */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_STAMPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";

const SENT = "member:sentinel-m77";
const drive = async (op, query) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  const map = membershipOps(svc, url, {}, svc);
  assert.equal(typeof map[op], "function", `membershipOps does not answer ${op}`);
  try { await map[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls).includes(SENT);
};
const NEW = ["adminproposalcancel", "adminremovals"];

test("notice membership:77: R154's two new ops are declared by member-roster, in both session sets, stamped by", () => {
  for (const op of NEW) {
    assert.ok(REGISTERED["member-roster"]?.[op], `${op} is not member-roster's declaration`);
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.equal(OPS[op].classes.includes("ai"), false, `${op} names ai`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.ok(OP_STAMPS[op].includes("by"), `${op} is not stamped by`);
    assert.equal(NEEDS[op] ?? null, null, `${op} needs a capability`);
  }
  assert.equal(OPS.adminproposalcancel.mutating, true);
  assert.equal(OPS.adminremovals.mutating, false);
  /* negative control: an op no owner declares has no spec */
  assert.equal(Object.hasOwn(OPS, "adminproposalcancelall"), false);
});

test("notice membership:77: each reaches member-roster through membership's own map with the by stamp", async () => {
  for (const op of NEW) {
    assert.ok(await drive(op, { by: SENT }), `${op}: by does not reach`);
    /* negative control */
    assert.equal(await drive(op, { nosuchstamp: SENT }), false, `${op}: any key reaches`);
  }
});
