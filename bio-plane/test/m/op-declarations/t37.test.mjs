/* op-declarations R21, R27, R34–R39 and R6 (T37-31; N669, N701, N708, N757, N776; DEC-127, DEC-156, DEC-157, DEC-180,
   DEC-182; K2159, K2171, K2175, K2200, K2201): T37's ops — the interface's translation (R35, R37), the member's own
   Claude sign-in (R36), a photo's marks (R38) and the caller's own password change (R39) — and the registry and
   library as PR #14 left them (R21, R27) and the explanation of every member op (R34). Each spec, row, session set,
   stamp and list is compared whole at the exported tables; the stamps of the ops whose owners' maps exist (credentials,
   case-carriage) are driven through those maps, so a stamp named at a site the owner does not read is seen. Each
   comparison has a negative control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as O from "../../../src/op-declarations/index.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44 } from "./browser.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { caseCarriageOps } from "../../../src/case-carriage/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_HELP_ABSENT, ACT_GATE } = O;
const SESSION_ONLY = { classes: ["admin", "member"], machineClasses: [] };
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const neither = (op) => !SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", O.PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", O.PLAN_RUN_SCOPE.writes]]);
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && neither(op) && !Object.hasOwn(OP_STAMPS, op)
  && !LISTS.some(([, l]) => l.includes(op)) && !Object.hasOwn(UNATTENDED_BY_DECISION, op);
const familyOf = (op) => Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op))?.owner ?? null;
/* every condition R35–R39 share: both session sets, in neither bearer fence, not on the ask grant's list, no `ai`
   class, never unattended by decision, no alias */
const shared = (op) => {
  assert.ok(both(op), `${op}: not in both session sets`);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
  assert.ok(!OPS[op].classes.includes("ai") && !(OPS[op].machineClasses ?? []).includes("ai"), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
};
/* every binding class arriving without a session is refused: machineClasses [] admits none */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* An owner's map over a service that records each call and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return calls;
};
const SENT = "member:sentinel-37";
const reaches = async (mapFn, op, st) => JSON.stringify(await drive(mapFn, op, st)).includes(SENT);

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const actsOf = (status) => [...new Set(registry.screens.flatMap((s) => s.acts).filter((a) => a.status === status).map((a) => a.op))];

/* ---------- R35: translationdraft ---------- */

test("R35 (N669; K2200, K2201): translationdraft — a member's act, a session's only (admin, member; machineClasses []), mutating (to_language writes drafts, to_english its fact), a present null NEEDS row, by and viewer stamped and nothing else (language, direction, keys and key the body's), in both session sets, instance-setup's family, in neither bearer fence, not on AI_GRANT_OPS (negative control: a proposal's spec is seen to differ)", () => {
  assert.deepEqual(plain(OPS.translationdraft), { ...SESSION_ONLY, mutating: true });
  assert.ok(Object.hasOwn(NEEDS, "translationdraft") && NEEDS.translationdraft === null);
  assert.deepEqual(stamps("translationdraft"), ["by", "viewer"]);
  for (const f of ["language", "direction", "keys", "key"]) assert.ok(!stamps("translationdraft").includes(f), f);
  assert.equal(familyOf("translationdraft"), "instance-setup");
  assert.deepEqual(OP_FAMILIES["instance-setup"].actor, { key: "by", at: "query" });
  assert.deepEqual(machineAdmits("translationdraft"), []);
  assert.equal(ACT_GATE.mode("translationdraft"), "session");
  shared("translationdraft");
  /* R6: the record route the door calls after /draft is store-internal: no spec, in no table */
  assert.ok(inNoTable("translationdraftrecord"));
  /* negative control: a labelled machine draft (any credential) is another spec */
  assert.notDeepEqual(plain(OPS.translationdraft), plain(OPS.templatepropose));
});

/* ---------- R36: subscriptionsignin ---------- */

test("R36 (N708; DEC-156; K2134): subscriptionsignin — the member's own act, a session's only (admin, member; machineClasses []), mutating, a present null NEEDS row, by stamped (with the family's viewer) and never step or code, in both session sets, credentials' family, in neither bearer fence, not on AI_GRANT_OPS; credentials' map does not serve it (its handler is the control plane's route) (negative control: an administrator's roster act admits bearers)", async () => {
  assert.deepEqual(plain(OPS.subscriptionsignin), { ...SESSION_ONLY, mutating: true });
  assert.ok(Object.hasOwn(NEEDS, "subscriptionsignin") && NEEDS.subscriptionsignin === null);
  assert.deepEqual(stamps("subscriptionsignin"), ["by", "viewer"]);
  for (const f of ["step", "code", "member"]) assert.ok(!stamps("subscriptionsignin").includes(f), f);
  assert.equal(familyOf("subscriptionsignin"), "credentials");
  assert.equal(OP_FAMILIES.credentials.kinds.subscriptionsignin, "own");
  assert.deepEqual(OP_FAMILIES.credentials.actor, { key: "by", at: "query" });
  assert.deepEqual(machineAdmits("subscriptionsignin"), []);
  shared("subscriptionsignin");
  const served = Object.keys(credentialsOps({}, new URL("http://plane/"), {}, {}, {}));
  assert.ok(!served.includes("subscriptionsignin"), "credentials serves subscriptionsignin: its handler is the control plane's");
  /* negative control */
  assert.deepEqual(machineAdmits("hostingaccessset"), ["admin", "probe"]);
});

/* ---------- R37: the translation ops ---------- */

const R37 = {
  translationgrant: { kind: "admin", mutating: true, stamps: ["by", "viewer"] },
  translationadopt: { kind: "own", mutating: true, stamps: ["by", "viewer"] },
  translationconfirm: { kind: "own", mutating: true, stamps: ["by", "viewer"] },
  translationrevert: { kind: "admin", mutating: true, stamps: ["by", "viewer"] },
  translationmark: { kind: "own", mutating: true, stamps: ["by", "viewer"] },
  translations: { kind: "ownread", mutating: false, stamps: ["viewer"] },
  interfacewords: { kind: "ownread", mutating: false, stamps: ["viewer"] },
};

test("R37 (N669; DEC-127 (5), DEC-157; instance-setup R69–R74): translationgrant (an administrator's), translationadopt, translationconfirm, translationrevert and translationmark — each mutating, a session's only (admin, member; machineClasses []), a present null NEEDS row, by stamped and no body field (member, language, revoke, key, text, draft, note) a stamp — and the reads translations and interfacewords, viewer stamped; each in both session sets, instance-setup's family, in neither bearer fence, not on AI_GRANT_OPS (negative control: a drifted read is seen)", () => {
  for (const [op, want] of Object.entries(R37)) {
    assert.deepEqual(plain(OPS[op]), { ...SESSION_ONLY, mutating: want.mutating }, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.deepEqual(stamps(op), want.stamps, op);
    for (const f of ["member", "language", "revoke", "key", "text", "draft", "note"]) assert.ok(!stamps(op).includes(f), `${op}: ${f}`);
    assert.equal(familyOf(op), "instance-setup", op);
    assert.equal(OP_FAMILIES["instance-setup"].kinds[op], want.kind, op);
    assert.deepEqual(machineAdmits(op), [], op);
    shared(op);
  }
  /* the five acts the registry owed (with translationdraft, R35) are declared under their own names, and since T43
     (DEC-189 (3); K2704) the registry names each by that op, a declared act owed no longer */
  for (const op of ["translationgrant", "translationadopt", "translationconfirm", "translationrevert", "translationdraft"]) {
    assert.ok(actsOf("declared").includes(op) && Object.hasOwn(OPS, op), op);
    assert.ok(!actsOf("owed").some((a) => a.startsWith(`owed:${op} `)), `${op} is still owed`);
  }
  /* negative control */
  assert.notDeepEqual(plain({ ...OPS.translations, mutating: true }), plain(OPS.translations));
});

/* ---------- R38: obscuremark and photomarks ---------- */

test("R38 (N757; DEC-180; case-carriage R9, R10): obscuremark — a member's act, mutating, a session's only (admin, member; machineClasses []), NEEDS contribute, by stamped from the query (case-carriage reads it there), captureSha and areas the body's; photomarks a read, viewer stamped, a present null; both in both session sets, case-carriage's family, in neither bearer fence, not on AI_GRANT_OPS, each served by case-carriage's map (negative control: a body by does not reach the owner)", async () => {
  assert.deepEqual(plain(OPS.obscuremark), { ...SESSION_ONLY, mutating: true });
  assert.equal(NEEDS.obscuremark, "contribute");
  assert.equal(ACT_GATE.needs("obscuremark"), "contribute");
  assert.deepEqual(stamps("obscuremark"), ["by", "viewer"]);
  assert.deepEqual(plain(OPS.photomarks), { ...SESSION_ONLY, mutating: false });
  assert.ok(Object.hasOwn(NEEDS, "photomarks") && NEEDS.photomarks === null);
  assert.deepEqual(stamps("photomarks"), ["viewer"]);
  for (const op of ["obscuremark", "photomarks"]) {
    assert.equal(familyOf(op), "case-carriage", op);
    assert.deepEqual(machineAdmits(op), [], op);
    for (const f of ["captureSha", "areas"]) assert.ok(!stamps(op).includes(f), `${op}: ${f}`);
    shared(op);
  }
  /* T38 (R40, K2311): the family and case-carriage's map hold the withdrawal beside the two (R40's test is t38's) */
  assert.deepEqual(OP_FAMILIES["case-carriage"].kinds, { obscuremark: "member", photomarks: "ownread", obscuremarkwithdraw: "member" });
  /* R6: case-carriage's map serves exactly the three, each declared */
  assert.deepEqual(Object.keys(caseCarriageOps({}, new URL("http://plane/"), {})).sort(),
                   ["obscuremark", "obscuremarkwithdraw", "photomarks"]);
  /* the stamps reach the owner where it reads them; the areas are the body's */
  assert.ok(await reaches(caseCarriageOps, "obscuremark", { query: { by: SENT } }));
  assert.ok(await reaches(caseCarriageOps, "obscuremark", { body: { areas: [SENT] } }));
  assert.ok(await reaches(caseCarriageOps, "photomarks", { query: { viewer: SENT } }));
  /* negative control: a caller's body `by` is not the actor */
  assert.equal(await reaches(caseCarriageOps, "obscuremark", { body: { by: SENT } }), false);
});

/* ---------- R39: setpassword ---------- */

test("R39 (N776; DEC-182 (4); K2175; credentials R3): setpassword — the caller's change of their own password, a session's only (admin, member; machineClasses []), mutating, a present null NEEDS row, stamped by, session, source and country (with the family's viewer) and nothing naming a role; current and password the body's only; in both session sets, credentials' family, in neither bearer fence, not on AI_GRANT_OPS (negative control: a query password does not reach credentials)", async () => {
  assert.deepEqual(plain(OPS.setpassword), { ...SESSION_ONLY, mutating: true });
  assert.ok(Object.hasOwn(NEEDS, "setpassword") && NEEDS.setpassword === null);
  assert.deepEqual(stamps("setpassword"), ["by", "country", "session", "source", "viewer"]);
  for (const f of ["role", "current", "password"]) assert.ok(!stamps("setpassword").includes(f), f);
  assert.equal(OP_FAMILIES.credentials.kinds.setpassword, "own");
  assert.deepEqual(machineAdmits("setpassword"), []);
  shared("setpassword");
  /* each stamp reaches credentials where it reads it (the query), and the two passwords from the body */
  for (const k of ["by", "session", "source", "country"])
    assert.ok(await reaches(credentialsOps, "setpassword", { query: { [k]: SENT } }), `setpassword: the query's ${k}`);
  for (const k of ["current", "password"]) {
    assert.ok(await reaches(credentialsOps, "setpassword", { body: { [k]: SENT } }), `setpassword: the body's ${k}`);
    assert.equal(await reaches(credentialsOps, "setpassword", { query: { [k]: SENT } }), false, `setpassword: the query's ${k}`);
  }
  /* no field names a role: a body role does not reach credentials */
  assert.equal(await reaches(credentialsOps, "setpassword", { body: { role: SENT } }), false);
  /* negative control: a body `by` is not the actor */
  assert.equal(await reaches(credentialsOps, "setpassword", { body: { by: SENT } }), false);
});

/* ---------- R21, R27 (T37): the registry and library as PR #14 left them ---------- */

test("R21 (T37; N776, DEC-180, DEC-182; K2159, K2171): on PR #14's registry every function is an op or an alias, the four withdrawn functions and claimidentity are gone, and the eight owed acts T37 declares are each declared once under its own name, read as served with no alias; the comment naming setpassword a function served in process is gone; (T43, DEC-189 (3)) seven of the eight re-pointed to their declared ops, subscriptionsignin still owed; (R52, T46) no owed act is left without a spec, infolevelset R50's; (R54, R60, T47) at PR #33's head subscriptionsignin a declared act too (negative control: an undeclared owed act is seen)", () => {
  const fns = actsOf("function");
  for (const f of fns) assert.ok(Object.hasOwn(OPS, f), `${f}: no spec`);
  for (const f of ["projectcreated", "countask", "registerproceeding", "deadlinecompute", "setpassword", "claimidentity"])
    assert.ok(!fns.includes(f), f);
  for (const f of ["projectcreated", "countask", "registerproceeding", "deadlinecompute", "claimidentity"]) assert.ok(inNoTable(f), f);
  for (const al of Object.keys(OP_ALIASES)) assert.ok(fns.includes(al), `${al}: an alias of no registry function`);
  const owed = actsOf("owed").map((a) => a.replace(/^owed:/, "").split(" ")[0]);
  const T37 = ["obscuremark", "setpassword", "subscriptionsignin", "translationadopt", "translationconfirm", "translationdraft",
               "translationgrant", "translationrevert"];
  /* T43 (DEC-189 (3); K2704): seven are re-pointed to their declared ops; subscriptionsignin stayed owed, read as served,
     until T47 (R54, R60): at PR #33's head it is a declared act too */
  for (const op of T37) {
    assert.ok(actsOf("declared").includes(op) && !owed.includes(op), `${op} is not re-pointed to its declared op`);
    assert.ok(Object.hasOwn(OPS, op) && familyOf(op), `${op}: not declared in a family`);
  }
  /* T46 (R52): every owed act of PR #28's registry is declared (infolevelset, owed with no spec until T46, is R50's); (T50,
     R73) the five PR #36 owes whose ops T49 left out are declared now; the registry also owes the installer's four own
     routes (K3471, installer R62), no plane op, named, with no spec */
  const LEFT_OUT = ["installalongside", "installremove", "installremoveconfirm", "installupdate", ...OWED_BY_FIX_ROUND_AT_43379A1A44];
  /* T51 (R76): the seven DEC-330 browser acts are owed rows read as a class of their own, no op */
  const BROWSER = browserActs(registry);
  assert.deepEqual(owed.filter((op) => !Object.hasOwn(OPS, op)).sort(), [...LEFT_OUT, ...BROWSER].sort());
  const src = readFileSync(new URL("bio-plane/src/op-declarations/index.mjs", ROOT), "utf8");
  assert.doesNotMatch(src, /`setpassword` \(credentials, in process\)/);
  /* negative control */
  assert.deepEqual([...owed, "nosuchowedact"].filter((op) => !Object.hasOwn(OPS, op) && !LEFT_OUT.includes(op) && !BROWSER.includes(op)), ["nosuchowedact"]);
  assert.ok(inNoTable("claimidentity"));
});

test("R27 (T37; N701, N708, N669; K2134, K2200): the seven owed acts of DEC-148's library — memberlanguageset, startfrom, publishat, translationdraft, translationadopt, subscriptionsignin, translationconfirm — are each declared under its own name, in both session sets, with a spec of its kind (a member's own act mutating, machineClasses [], by stamped; a read viewer stamped, NEEDS null) (negative control: an undeclared act fails)", () => {
  const SEVEN = ["memberlanguageset", "startfrom", "publishat", "translationdraft", "translationadopt", "subscriptionsignin",
                 "translationconfirm"];
  for (const op of SEVEN) {
    assert.ok(Object.hasOwn(OPS, op) && both(op), op);
    if (OPS[op].mutating) {
      assert.deepEqual(OPS[op].machineClasses, [], op);
      /* publishat is caseratify's ceremony, stamped by caseratify's act lists (R25); the rest by their families */
      if (op !== "publishat") assert.ok(stamps(op).includes("by"), op);
      else assert.ok(O.STATE_ACTIONS.includes("publishat") === O.STATE_ACTIONS.includes("caseratify"), op);
    } else {
      assert.ok(stamps(op).includes("viewer") && NEEDS[op] === null, op);
    }
  }
  /* negative control */
  assert.ok(!Object.hasOwn(OPS, "claimidentity"));
});

/* ---------- R34 (T37): the explanation of T37's member ops ---------- */

test("R34 (T37; N776; DEC-182 (5); K2159): ACT_HELP_ABSENT names the reads photomarks, translations and interfacewords under the read ground and translationmark under the last (an act the design has not yet explained); it names none of the eight owed acts T37 declares, whose texts PR #14's mock-acts.js gives, nor clockpropose, which it now explains, nor the withdrawn claimidentity; (T43, DEC-189 (3)) the texts keyed by the op, (R54, R60, T47) subscriptionsignin's too (negative control: a named op is found)", () => {
  const ground = (op) => Object.entries(ACT_HELP_ABSENT).find(([, g]) => g.ops.includes(op))?.[0] ?? null;
  for (const op of ["photomarks", "translations", "interfacewords"]) assert.equal(ground(op), "read", op);
  assert.equal(ground("translationmark"), "unexplained");
  const mock = readFileSync(new URL("docs/development/ux-substrate/screens/mock-acts.js", ROOT), "utf8");
  /* T43 (DEC-189 (3); K2704): the texts of the re-pointed acts are keyed by the op, `owed_` dropped; subscriptionsignin,
     still owed, keeps its `owed_` key */
  for (const op of ["obscuremark", "setpassword", "subscriptionsignin", "translationdraft", "translationadopt", "translationgrant",
                    "translationconfirm", "translationrevert"]) {
    assert.equal(ground(op), null, op);
    /* T47 (R54, R60): at PR #33's head subscriptionsignin's text is keyed by the op too */
    assert.match(mock, new RegExp(`^  ${op}: '`, "m"), `${op}: no design text`);
  }
  assert.match(mock, /^  clockpropose: '/m);
  assert.equal(ground("clockpropose"), null);
  assert.doesNotMatch(mock, /^  (owed_)?(translationmark|photomarks|translations|interfacewords): /m);
  assert.equal(ground("claimidentity"), null);
  /* negative control */
  assert.equal(ground("timeline"), "read");
});
