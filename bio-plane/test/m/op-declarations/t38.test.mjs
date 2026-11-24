/* op-declarations R40 and R21 (T38-15; N788; DEC-183 (2); K2300, K2311): the withdrawal of a mark on a photo
   (`obscuremarkwithdraw`, case-carriage R14) and the registry as PR #15 left it. The spec, rows, session sets, stamps
   and lists are compared whole at the exported tables, and the stamps and body fields are driven through case-carriage's
   own map, so a stamp named at a site the owner does not read is seen. Each comparison has a negative control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as O from "../../../src/op-declarations/index.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44 } from "./browser.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { caseCarriageOps } from "../../../src/case-carriage/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_HELP_ABSENT, ACT_GATE } = O;
const plain = (s) => JSON.parse(JSON.stringify(s));
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op))?.owner ?? null;
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", O.PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", O.PLAN_RUN_SCOPE.writes]]);
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && !SESSION_OPS.member.has(op)
  && !SESSION_OPS.admin.has(op) && !Object.hasOwn(OP_STAMPS, op) && !LISTS.some(([, l]) => l.includes(op))
  && !Object.hasOwn(UNATTENDED_BY_DECISION, op);
/* every binding class arriving without a session is refused: machineClasses [] admits none */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* case-carriage's map over a service that records each call and its arguments */
const drive = async (op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  await caseCarriageOps(svc, url, body)[op]();
  return calls;
};
const SENT = "member:sentinel-38";
const reaches = async (op, st) => JSON.stringify(await drive(op, st)).includes(SENT);

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const owedActs = () => [...new Set(registry.screens.flatMap((s) => s.acts).filter((a) => a.status === "owed")
  .map((a) => a.op.replace(/^owed:/, "").split(" ")[0]))];

test("R40 (T38; N788; DEC-183 (2); case-carriage R14): obscuremarkwithdraw — a member's act, a session's only (admin, member; machineClasses []), mutating, NEEDS contribute, by stamped from the query (with the family's viewer) and no body field a stamp; captureSha, mark and reason the body's; in both session sets, case-carriage's family, in neither bearer fence, not on AI_GRANT_OPS, no alias, never unattended; served by case-carriage's map (negative control: a body by does not reach the owner)", async () => {
  const op = "obscuremarkwithdraw";
  assert.deepEqual(plain(OPS[op]), { classes: ["admin", "member"], machineClasses: [], mutating: true });
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes) && Object.isFrozen(OPS[op].machineClasses));
  assert.deepEqual(machineAdmits(op), []);
  assert.ok(!OPS[op].classes.includes("ai"));
  assert.equal(NEEDS[op], "contribute");
  assert.equal(ACT_GATE.needs(op), "contribute");
  assert.equal(ACT_GATE.mode(op), "session");
  assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op));
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op));
  assert.ok(!AI_GRANT_OPS.includes(op));
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op));
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op));
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  for (const f of ["captureSha", "mark", "reason"]) assert.ok(!stamps(op).includes(f), f);
  assert.equal(familyOf(op), "case-carriage");
  assert.equal(OP_FAMILIES["case-carriage"].kinds[op], "member");
  assert.deepEqual(OP_FAMILIES["case-carriage"].actor, { key: "by", at: "query" });
  assert.ok(OP_FAMILIES["case-carriage"].acts.includes(op));
  /* R6: the owner serves it */
  assert.ok(Object.keys(caseCarriageOps({}, new URL("http://plane/"), {})).includes(op));
  /* the stamp reaches the owner where it reads it (the query); the three fields from the body */
  assert.ok(await reaches(op, { query: { by: SENT } }));
  for (const f of ["captureSha", "mark", "reason"]) assert.ok(await reaches(op, { body: { [f]: SENT } }), `the body's ${f}`);
  /* with no stamp the owner is handed no actor, so its own machine refusal answers (MACHINE_CANNOT_WITHDRAW_MARK) */
  const [[, [args]]] = await drive(op, { body: { mark: "m1", reason: "r" } });
  assert.equal(args.by, null);
  /* negative control: a caller's body `by` is not the actor */
  assert.equal(await reaches(op, { body: { by: SENT } }), false);
  /* negative control: the read beside it is another spec */
  assert.notDeepEqual(plain(OPS.photomarks), plain(OPS[op]));
});

test("R21 (T38; N788; DEC-183; K2300): on PR #15's registry the owed act obscuremarkwithdraw (the ceremony's Photos step), since T43 (DEC-189 (3)) a declared act, is read as served and declared once under its own name, in case-carriage's family, with no alias; (R52, T46) no owed act is left without a spec, infolevelset R50's (negative control: an undeclared owed act is seen)", () => {
  const owed = owedActs();
  /* T43 (DEC-189 (3); K2704): the registry re-points the owed act to the op R40 declares, a declared act */
  const declared = registry.screens.flatMap((s) => s.acts).filter((a) => a.status === "declared").map((a) => a.op);
  assert.ok(declared.includes("obscuremarkwithdraw") && !owed.includes("obscuremarkwithdraw"),
            "obscuremarkwithdraw is not re-pointed to its declared op");
  assert.ok(Object.hasOwn(OPS, "obscuremarkwithdraw") && familyOf("obscuremarkwithdraw") === "case-carriage");
  assert.equal(Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, "obscuremarkwithdraw")).length, 1);
  assert.ok(!Object.hasOwn(OP_ALIASES, "obscuremarkwithdraw"));
  /* T46 (R52): every owed act of PR #28's registry is declared (infolevelset, owed with no spec until T46, is R50's); (T50,
     R73) the five PR #36 owes whose ops T49 left out are declared now; the registry also owes the installer's four own
     routes (K3471, installer R62), no plane op, named, with no spec */
  const LEFT_OUT = ["installalongside", "installremove", "installremoveconfirm", "installupdate", ...OWED_BY_FIX_ROUND_AT_43379A1A44];
  /* T51 (R76): the seven DEC-330 browser acts are owed rows read as a class of their own, no op */
  const BROWSER = browserActs(registry);
  assert.deepEqual(owed.filter((op) => !Object.hasOwn(OPS, op)).sort(), [...LEFT_OUT, ...BROWSER].sort());
  /* negative control */
  assert.deepEqual([...owed, "nosuchowedact"].filter((op) => !Object.hasOwn(OPS, op) && !LEFT_OUT.includes(op) && !BROWSER.includes(op)), ["nosuchowedact"]);
  assert.ok(inNoTable("nosuchowedact"));
});

test("R34 (T38; K2300): obscuremarkwithdraw is named under no ground of ACT_HELP_ABSENT — PR #15's mock-acts.js explains it under its owed key, since T43 (DEC-189 (3)) under the op, which affordances R48 carries to ACT_HELP under the op (negative control: a named read is found)", () => {
  const ground = (op) => Object.entries(ACT_HELP_ABSENT).find(([, g]) => g.ops.includes(op))?.[0] ?? null;
  assert.equal(ground("obscuremarkwithdraw"), null);
  const mock = readFileSync(new URL("docs/development/ux-substrate/screens/mock-acts.js", ROOT), "utf8");
  /* T43 (DEC-189 (3)): keyed by the op, `owed_` dropped */
  assert.match(mock, /^  obscuremarkwithdraw: '/m);
  assert.doesNotMatch(mock, /^  owed_obscuremarkwithdraw: /m);
  /* negative control */
  assert.equal(ground("photomarks"), "read");
});
