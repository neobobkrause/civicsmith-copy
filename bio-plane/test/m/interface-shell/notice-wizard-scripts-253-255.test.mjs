/* interface-shell, provider notices wizard-scripts:253 and wizard-scripts:255 (PRs 253 and 255: `ADMIN_ACTS` drops the retired
   group-key acts `groupkeyset`, `groupkeyremove` and `groupkeyswitch`, ai-accounts R35, R36; PR 253 also dropped `scanmirror` and
   `officeconfirm`, which PR 255 put back as owner-declared administrator's acts). Confirmed, no code change: the shell's
   administrator-only gate (R12) is `ADMIN_ACTS` as wizard-scripts exports it, with no copy here, so `scanmirror` on `security` and
   `officeconfirm` on `places` are drawn only to a member who administers; the retired group-key acts are held by no gate and by no
   declaration, so a screen naming one is refused at composition (R21), naming the screen.
   fixtures-own: stand-in screens whose acts are the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { ADMIN_ACTS, SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { checkScreens } from "../../../src/interface-shell/index.mjs";
import { boot, ok, ADMIN } from "./harness.mjs";

const listed = (id, op) => { const r = SCREEN_REGISTRY.find((x) => x.id === id); return !!r && (r.acts.includes(op) || (r.owed || []).some((o) => o.op === op)); };
const stand = (id, op) => ({ id, words: [], reads: () => ({}), acts: [{ op, rereads: [], ready: () => ({ refuse: "state.failed" }), send: () => null }],
  render: new Function("cs", "view", 'return "<h1 class=\\"t-title\\">x</h1>" + cs.act(' + JSON.stringify(op) + ");") });
const drawn = (p, op) => !!p.root().querySelector('button[data-act="' + op + '"]') || !!p.root().querySelector('[data-phone-act="' + op + '"]');

test("notice wizard-scripts:253, :255 (R12) scanmirror on security and officeconfirm on places are drawn to a member who administers and to no other; the gate is ADMIN_ACTS itself", async () => {
  for (const [id, op] of [["security", "scanmirror"], ["places", "officeconfirm"]]) {
    assert.ok(ADMIN_ACTS.has(op), op + " is an administrator's act (PR 255)");
    assert.ok(Object.hasOwn(OPS, op), op + " is declared, by its owner");
    assert.ok(listed(id, op), "the registry lists " + op + " on " + id);
    const caps = ["contribute", "publish"];
    const admin = await boot({ screens: [stand(id, op)], path: "/app/" + id, plane: { whoami: ok({ ...ADMIN, capabilities: caps }) } });
    assert.equal(drawn(admin, op), true, op + " drawn to an administrator");
    const member = await boot({ screens: [stand(id, op)], path: "/app/" + id, plane: { whoami: ok({ ...ADMIN, administer: false, capabilities: caps }) } });
    assert.equal(drawn(member, op), false, op + " absent for a member who does not administer");
  }
});

test("notice wizard-scripts:253 (R21) the retired group-key acts are in no gate and no declaration: a screen naming one is refused at composition, naming the screen; control: the T53 act the registry lists there is served", () => {
  for (const op of ["groupkeyset", "groupkeyremove", "groupkeyswitch"]) {
    assert.equal(ADMIN_ACTS.has(op), false, op);
    assert.equal(Object.hasOwn(OPS, op), false, op);
    assert.throws(() => checkScreens([{ id: "teamai", render: () => "", acts: [{ op }] }]), new RegExp("teamai.*" + op));
  }
  assert.ok(listed("teamai", "aiaccountswitch"));
  assert.equal(checkScreens([{ id: "teamai", render: () => "", acts: [{ op: "aiaccountswitch" }] }]), true);
});
