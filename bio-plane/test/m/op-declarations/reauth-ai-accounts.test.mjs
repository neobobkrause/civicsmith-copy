/* R58 (BOB 4 Nov, coordinator audit; ai-accounts R61, R69): the T53 acts that set, replace, switch or remove a credential
   or a sign-in ask the password again, every call, as the four retired account-seam acts did. Asserted on `REAUTH_ACTS`
   and through admission's own predicate (`reauthAsked`, its R25), which reads the table as declared. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { reauthAsked } from "../../../src/admission/index.mjs";

const CREDENTIAL_ACTS = ["aiaccountadd", "aiownadd", "aiaccountremove", "aiaccountswitch", "aikeyenter", "aikeyseal",
  "aikeycloudflare"];

test("R58 (BOB 4 Nov, coordinator audit; ai-accounts R61, R69, R44): each ai-accounts T53 credential or sign-in act — aiaccountadd, aiownadd, aiaccountremove, aiaccountswitch, aikeyenter, aikeyseal, aikeycloudflare — is in REAUTH_ACTS as null and admission asks the password for it on every call, with any body or none; control: R61's acts that set no credential (aiorderset, aipersonalchoose, aitermsaccept, aisend) are not asked", () => {
  for (const op of CREDENTIAL_ACTS) {
    assert.ok(Object.hasOwn(O.REAUTH_ACTS, op), `${op}: not in REAUTH_ACTS`);
    assert.equal(O.REAUTH_ACTS[op], null, `${op}: not every call`);
    assert.ok(Object.hasOwn(O.OPS, op) && O.OPS[op].mutating, `${op}: no mutating spec`);
    assert.equal(reauthAsked(O.REAUTH_ACTS, op), true, `${op}: admission does not ask`);
    assert.equal(reauthAsked(O.REAUTH_ACTS, op, { body: { account_id: "a-1", on: true } }), true, `${op}: with a body`);
    assert.equal(reauthAsked(O.REAUTH_ACTS, op, { url: new URL(`http://x/?op=${op}`) }), true, `${op}: by address`);
  }
  /* control */
  for (const op of ["aiorderset", "aipersonalchoose", "aitermsaccept", "aisend"]) {
    assert.ok(Object.hasOwn(O.OPS, op), `${op}: declared`);
    assert.equal(reauthAsked(O.REAUTH_ACTS, op), false, op);
  }
});
