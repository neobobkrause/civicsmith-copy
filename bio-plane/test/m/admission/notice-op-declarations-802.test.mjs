/* admission: provider notice op-declarations (layer PR 802, land e4c350c01d; its F3, BD-1; corpus-export R17, R18).
   `exportwhole` (mutating) and `exportwholepart` (a read) are declared classes `admin` alone, in `SESSION_OPS.admin`
   and not `.member`. Admission reads those tables live (R8, R9), so no code changes here: a member's session, an
   enrolled administrator's included, is refused at the gate before any op call, and the founder's session and the
   root-of-trust bearer are admitted. R8's `ROOT_OF_TRUST_REQUIRED` stays `export`'s alone, as R8 names it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { O, world, gate, refused, opCalls } from "./harness.mjs";

test("notice op-declarations:802 (R8, R9): a member's session asking exportwhole is refused SESSION_ROLE_CANNOT_REACH_OP reachedBy founder, exportwholepart CLASS_FORBIDDEN, an enrolled administrator's alike, nothing of the op asked; control: the founder's session and the root-of-trust bearer are admitted to both", async () => {
  const { env, S } = world();
  assert.equal(O.OPS.exportwhole?.mutating, true);
  assert.equal(O.OPS.exportwholepart?.mutating, false);
  for (const token of [S.ann, S.admin]) {
    env.calls.length = 0;
    const whole = refused(await gate(env, { op: "exportwhole", token }), 403, "SESSION_ROLE_CANNOT_REACH_OP", "C-38.7", [token]);
    assert.equal(whole.reachedBy, "founder");
    assert.equal(whole.op, "exportwhole");
    const part = refused(await gate(env, { op: "exportwholepart", token }), 403, "CLASS_FORBIDDEN", "C-38.2", [token]);
    assert.equal(JSON.stringify(part).includes("ROOT_OF_TRUST_REQUIRED"), false);
    assert.equal(opCalls(env).length, 0, "nothing of the op asked");
  }
  for (const op of ["exportwhole", "exportwholepart"]) {
    const f = await gate(env, { op, token: S.founder });
    assert.equal(f.caller?.viaSession, true, `${op}: the founder's session`);
    const b = await gate(env, { op, token: env.ADMIN_TOKEN });
    assert.ok(b.caller && !b.caller.viaSession, `${op}: the root-of-trust bearer`);
  }
  /* control: `export` itself is still answered R8's root-of-trust refusal to a member's session */
  refused(await gate(env, { op: "export", token: S.ann }), 403, "ROOT_OF_TRUST_REQUIRED", "C-38.4", [S.ann]);
});
