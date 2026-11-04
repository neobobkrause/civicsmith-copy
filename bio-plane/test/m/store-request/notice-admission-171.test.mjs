/* store-request, notice admission:171 (PR 171): admission's BODY_ONLY_FIELDS lost its `groupkeyset` row (op-declarations R24 retired
   the op); a team account act's credential is the body's `secret`, refused in an address by admission's R20 gate. Confirmed with
   no code change: this module imports only `projectCreationGate` and `callerViewer` from admission and keeps its own body-only
   list (R3, R24 `BODY_ONLY`), which names no retired op; and `innerRequest` keeps a body's `secret` in the body, never the address. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { innerRequest, BODY_ONLY, SECRET_PRESENTING_OPS } from "../../../src/store-request/index.mjs";
import { BODY_ONLY_FIELDS } from "../../../src/admission/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";

const names = (v) => (v instanceof Set || Array.isArray(v) ? [...v] : Object.keys(v ?? {}));

test("notice admission:171: neither this module's body-only list nor its secret-presenting ops name an op op-declarations does not declare, and admission's rows hold no groupkeyset", () => {
  assert.equal(Object.hasOwn(BODY_ONLY_FIELDS, "groupkeyset"), false);
  for (const op of [...names(BODY_ONLY), ...names(SECRET_PRESENTING_OPS)]) assert.ok(Object.hasOwn(OPS, op), `${op} is declared`);
  assert.equal(names(BODY_ONLY).includes("groupkeyset"), false);
});

test("notice admission:171: an administrator's aiaccountadd made by innerRequest keeps the body's secret in the body and puts none in the address (a secret in an address never reaches it: admission's R20 gate refuses it first)", () => {
  const SECRET = "sk-ant-api03-" + "q".repeat(40);
  const caller = { cls: "admin", viaSession: true, member: "admin", viewer: "admin", identity: "member:admin", rights: [], caps: [], token: "t".repeat(64) };
  const out = innerRequest({ op: "aiaccountadd", url: new URL(`http://h/api/?op=aiaccountadd&owner=group`), method: "POST",
                             body: JSON.stringify({ owner: "group", secret: SECRET }), caller });
  assert.equal(out.refusal, undefined);
  assert.equal(String(out.url).includes(SECRET), false, "no secret in the address");
  assert.equal(JSON.parse(out.body).secret, SECRET, "the body's secret passes to the owner");
});
