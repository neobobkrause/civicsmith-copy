/* op-declarations, T47 (R54–R61; K3041): the publication's four ops in the session sets, T47's owners' new ops (R55), the
   source reads in the session sets (R56), the credentials ops of the way in (R57), `REAUTH_ACTS` (R58), DEC-205's and
   N1001's ops (R59), the registry and the library read at PR #33's head (R54, R60), the people directory (R61), and R34
   over each. Each op is tested by name with a negative control (K874). Specs, sets, rows and stamps are read from the
   exported tables; R6's "served by its owner" from the owner's own ops map where this module uses it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44, OWED_SERVED_BY_OWNERS } from "./browser.mjs";
import { T47_SHARES, T47_FAMILIES, REAUTH_ACTS } from "../../../src/op-declarations/t47.mjs";
import { T51_SHARES } from "../../../src/op-declarations/t51.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { peopleOps } from "../../../src/people/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
import { sourcesOps } from "../../../src/sources/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
import { captureRequestsOps } from "../../../src/capture-requests/index.mjs";
import { tasksOps } from "../../../src/tasks/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT } = O;
const MP = ["admin", "member", "probe"];
const SESSION = ["admin", "member"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const neither = (op) => !SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
/* the conditions R55's, R57's and R59's ops share (none in a bearer fence or on a grant's list, no `ai` class, never
   unattended, no alias, frozen) */
const shared = (op) => {
  assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.ok(Object.isFrozen(OPS[op]), op);
};
/* An owner's map over a service that records each call and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return calls;
};
const keysOf = (mapFn) => {
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
  return Object.keys(mapFn(svc, new URL("http://plane/"), {}, svc, svc));
};
const SENT = "member:sentinel-47";
const reaches = async (mapFn, op, where) => JSON.stringify(await drive(mapFn, op, where)).includes(SENT);

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("docs/development/ux-substrate/screens/library.json", ROOT), "utf8"));
const regActs = registry.screens.flatMap((s) => s.acts.map((a) => ({ ...a, screen: s.id })));
const owedOf = (acts) => [...new Set(acts.filter((a) => a.status === "owed").map((a) => a.op.replace(/^owed:/, "").split(" ")[0]))];

/* ---------- K3041 ---------- */

test("K3041, R1, R3, R34: statementack, reviewcomment, publishpreflight and publishtensions join SESSION_OPS.member and SESSION_OPS.admin, so the act gate answers session for each, their specs, NEEDS rows and stamps unchanged — the two doors public at the class gate with a present null row, the two reads publish's classes — and each explained in ACT_HELP (negative control: publish's own place and stamps are unchanged, and an op of neither set answers machine)", () => {
  const FOUR = ["statementack", "reviewcomment", "publishpreflight", "publishtensions"];
  for (const op of FOUR) {
    assert.ok(both(op), `${op}: not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.equal(ACT_GATE.needs(op), null, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, `${op}: no present null row`);
    assert.ok(explained(op) && ground(op).length === 0, `${op}: not explained, or named in ACT_HELP_ABSENT`);
    assert.ok(!AI_GRANT_OPS.includes(op), op);
  }
  assert.deepEqual(plain(OPS.statementack), { classes: null, mutating: true });
  assert.deepEqual(plain(OPS.reviewcomment), { classes: null, mutating: true });
  assert.deepEqual(plain(OPS.publishpreflight), { classes: MP, mutating: false });
  assert.deepEqual(plain(OPS.publishtensions), { classes: MP, mutating: false });
  for (const op of FOUR) assert.deepEqual(listsOf(op), [], `${op}: an act list names it`);
  /* negative control */
  assert.deepEqual(stamps("publish"), null);
  assert.deepEqual(listsOf("publish"), ["STATE_ACTIONS"]);
  assert.equal(ACT_GATE.mode("purge"), "machine");
});

/* ---------- R55 ---------- */

test("R55, R2–R4: projectlist and projectquestions are reads of admin, member and probe, viewer stamped, NEEDS null, in project-roster's and basis-versions' families; drawquestion is cite's — its classes, contribute, in EDGE_ACTIONS and POSITIONAL_ACTS beside cite; projectbarset is strengthbar's stamps (DECLARATION_ACTIONS) for a member session only, contribute; monitorset is addressfrequencyset's stamps (MONITORING_ACTIONS) for a member session only, contribute — each in both session sets, the act gate session (negative control: a drifted spec or list is seen)", () => {
  for (const op of ["projectlist", "projectquestions", "drawquestion", "projectbarset", "monitorset"]) {
    shared(op);
    assert.ok(both(op), op);
    assert.equal(ACT_GATE.mode(op), "session", op);
  }
  for (const [op, owner] of [["projectlist", "project-roster"], ["projectquestions", "basis-versions"]]) {
    assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false }, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.deepEqual(stamps(op), ["viewer"], op);
    assert.deepEqual(familyOf(op), [owner], op);
  }
  assert.deepEqual(plain(OPS.projectlist), plain(OPS.projectdirectory));
  assert.deepEqual(plain(OPS.drawquestion), plain(OPS.cite));
  assert.equal(NEEDS.drawquestion, "contribute");
  assert.ok(O.EDGE_ACTIONS.includes("drawquestion") && O.POSITIONAL_ACTS.includes("drawquestion"));
  assert.deepEqual(listsOf("drawquestion"), listsOf("cite"));
  assert.deepEqual(plain(OPS.projectbarset), { classes: MP, machineClasses: [], mutating: true });
  assert.equal(NEEDS.projectbarset, "contribute");
  assert.deepEqual(listsOf("projectbarset"), listsOf("strengthbar"));
  assert.deepEqual(plain(OPS.monitorset), { classes: MP, machineClasses: [], mutating: true });
  assert.equal(NEEDS.monitorset, "contribute");
  assert.deepEqual(listsOf("monitorset"), listsOf("addressfrequencyset"));
  /* none is in a family as well as an act list: the stamps come from one place */
  for (const op of ["drawquestion", "projectbarset", "monitorset"]) assert.deepEqual(familyOf(op), [], op);
  /* negative control */
  assert.notDeepEqual(plain(OPS.projectbarset), plain(OPS.strengthbar));
  assert.notDeepEqual(listsOf("monitorset"), listsOf("cite"));
});

test("R55, R6: projectlist is served by project-roster's map with the viewer read from the query; heldcaptures (capture R88, the new state field) and capturerequest (capture-requests R56) keep their specs and are served by their owners' maps (negative control: a key the owner does not read does not reach)", async () => {
  assert.ok(keysOf(projectRosterOps).includes("projectlist"));
  assert.ok(await reaches(projectRosterOps, "projectlist", { query: { viewer: SENT } }));
  assert.ok(!(await reaches(projectRosterOps, "projectlist", { body: { viewer: SENT } })));
  assert.ok(keysOf(captureOps).includes("heldcaptures"));
  assert.ok(keysOf(captureRequestsOps).includes("capturerequest"));
  assert.deepEqual(plain(OPS.heldcaptures), { classes: MP, mutating: false });
  assert.deepEqual(plain(OPS.capturerequest), { classes: MP, mutating: true });
  assert.ok(both("heldcaptures") && both("capturerequest"));
  assert.equal(NEEDS.capturerequest, "contribute");
  /* negative control */
  assert.ok(!keysOf(projectRosterOps).includes("projectlistall"));
});

/* ---------- R56 ---------- */

test("R56 (N980): sourceof and sourcerung are in SESSION_OPS.member and SESSION_OPS.admin, their specs unchanged — reads of admin, member and probe, viewer stamped, a present null — served by sources' map with the viewer from the query; an ai credential is no class of theirs (R2), and sourcereadlog stays out of the sets (negative control)", async () => {
  for (const op of ["sourceof", "sourcerung"]) {
    assert.ok(both(op), op);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false }, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.ok(O.SOURCE_READS.includes(op), op);
    assert.ok(!OPS[op].classes.includes("ai"), op);
    assert.ok(keysOf(sourcesOps).includes(op), op);
    assert.ok(await reaches(sourcesOps, op, { query: { viewer: SENT } }), op);
  }
  /* negative control */
  assert.ok(neither("sourcereadlog"));
  assert.equal(ACT_GATE.mode("sourcereadlog"), "machine");
});

/* ---------- R57 ---------- */

test("R57 (K3084; credentials R65, R66, R69, R71): unlock and reauth a session's own, mutating, NEEDS null, stamped session, source and country, in both sets; passwordresetlink an administrator's act, by stamped, NEEDS null; passwordresetlook and passwordreset public (in no session set), stamped source and country, a present null NEEDS row (K3147) — each in credentials' family and served by its map, the password and the link read from the body only (negative control: signout's stamps carry no source, and a query password does not reach)", async () => {
  for (const op of ["unlock", "reauth", "passwordresetlink", "passwordresetlook", "passwordreset"]) {
    shared(op);
    assert.deepEqual(familyOf(op), ["credentials"], op);
    assert.ok(keysOf(credentialsOps).includes(op), `${op}: credentials does not serve it`);
  }
  for (const op of ["unlock", "reauth"]) {
    assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: true }, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.deepEqual(stamps(op), ["country", "session", "source"], op);
    assert.ok(both(op), op);
    assert.ok(await reaches(credentialsOps, op, { body: { password: SENT } }), op);
    assert.ok(!(await reaches(credentialsOps, op, { query: { password: SENT } })), op);
  }
  assert.deepEqual(plain(OPS.passwordresetlink), { classes: SESSION, machineClasses: [], mutating: true });
  assert.ok(Object.hasOwn(NEEDS, "passwordresetlink") && NEEDS.passwordresetlink === null);
  assert.deepEqual(stamps("passwordresetlink"), ["by", "viewer"]);
  assert.ok(both("passwordresetlink"));
  assert.ok(await reaches(credentialsOps, "passwordresetlink", { body: { member: SENT } }));
  assert.deepEqual(plain(OPS.passwordresetlook), { classes: null, mutating: false });
  assert.deepEqual(plain(OPS.passwordreset), { classes: null, mutating: true });
  for (const op of ["passwordresetlook", "passwordreset"]) {
    assert.ok(neither(op), op);
    /* K3147: a present null, as recover's, since op-grades names each in NON_ACTS */
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.deepEqual(stamps(op), ["country", "source"], op);
    assert.ok(await reaches(credentialsOps, op, { body: { link: SENT } }), op);
    assert.ok(!(await reaches(credentialsOps, op, { query: { link: SENT } })), op);
  }
  /* negative control */
  assert.ok(!stamps("signout").includes("source"));
  assert.notDeepEqual(stamps("unlock"), stamps("signout"));
});

/* ---------- R58 ---------- */

test("R58, R62, R63 (K3061 D3, K3143, K3144; credentials R66): REAUTH_ACTS is frozen data, op → null or {field, values}, naming exactly the acts that ask the password again — caseratify, publishat, publishatmove, ratify, docketpost; adminendorse, adminremove, memberset (its role field present at all, values null, R62), memberadd (role admin); subscriptionsignin (step start), accountreferenceset, groupkeyset, projectkeyset, projectsigninset — each a declared mutating op, with its argument where one makes it so; exported by index.mjs (negative control: an act not named, signout, is absent)", () => {
  assert.equal(O.REAUTH_ACTS, REAUTH_ACTS);
  assert.ok(Object.isFrozen(REAUTH_ACTS));
  assert.deepEqual(Object.keys(REAUTH_ACTS).sort(), ["accountreferenceset", "adminendorse", "adminremove", "caseratify",
    "docketpost", "groupkeyset", "memberadd", "memberset", "projectkeyset", "projectsigninset", "publishat", "publishatmove",
    "ratify", "subscriptionsignin"]);
  for (const [op, arg] of Object.entries(REAUTH_ACTS)) {
    assert.ok(Object.hasOwn(OPS, op) && OPS[op].mutating, `${op}: no mutating spec`);
    if (arg !== null) {
      assert.deepEqual(Object.keys(arg).sort(), ["field", "values"], op);
      assert.ok(Object.isFrozen(arg) && typeof arg.field === "string", op);
      assert.ok(arg.values === null || (Array.isArray(arg.values) && Object.isFrozen(arg.values) && arg.values.length > 0), op);
    }
  }
  assert.deepEqual(plain(REAUTH_ACTS.memberset), { field: "role", values: null });
  assert.deepEqual(plain(REAUTH_ACTS.memberadd), { field: "role", values: ["admin"] });
  assert.deepEqual(plain(REAUTH_ACTS.subscriptionsignin), { field: "step", values: ["start"] });
  for (const op of ["caseratify", "publishat", "publishatmove", "ratify", "docketpost", "adminendorse", "adminremove",
                    "accountreferenceset", "groupkeyset", "projectkeyset", "projectsigninset"]) assert.equal(REAUTH_ACTS[op], null, op);
  assert.throws(() => { "use strict"; REAUTH_ACTS.signout = null; });
  /* negative control */
  assert.ok(!Object.hasOwn(REAUTH_ACTS, "signout") && !Object.hasOwn(REAUTH_ACTS, "publish"));
});

/* ---------- R59 ---------- */

test("R59 (DEC-205, DEC-207 (8), N1001): grouplogoset and grouplanguagesset administrators' acts in instance-setup's family, by stamped, NEEDS null; grouplanguages a public read, in no session set, a present null NEEDS row (K3147); signrequest a member's act in tasks' family, by and viewer stamped, contribute, machineClasses []; signintrace a session's read in signin-door's family, viewer stamped; R34: each member op is named in ACT_HELP_ABSENT or explained, never both; signrequest served by tasks' map (negative control: a drifted spec is seen)", async () => {
  for (const op of ["grouplogoset", "grouplanguagesset", "grouplanguages", "signrequest", "signintrace"]) shared(op);
  for (const op of ["grouplogoset", "grouplanguagesset"]) {
    assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: true }, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.deepEqual(stamps(op), ["by", "viewer"], op);
    assert.deepEqual(familyOf(op), ["instance-setup"], op);
    assert.ok(both(op), op);
  }
  assert.deepEqual(plain(OPS.grouplanguages), { classes: null, mutating: false });
  assert.ok(neither("grouplanguages") && Object.hasOwn(NEEDS, "grouplanguages") && NEEDS.grouplanguages === null);
  assert.deepEqual(familyOf("grouplanguages"), ["instance-setup"]);
  assert.deepEqual(plain(OPS.signrequest), { classes: SESSION, machineClasses: [], mutating: true });
  assert.equal(NEEDS.signrequest, "contribute");
  assert.deepEqual(stamps("signrequest"), ["by", "viewer"]);
  assert.deepEqual(familyOf("signrequest"), ["tasks"]);
  /* K3152: served by tasks' map since its merge, `by` and `viewer` read from the query */
  assert.ok(keysOf(tasksOps).includes("signrequest"));
  for (const k of ["by", "viewer"]) assert.ok(await reaches(tasksOps, "signrequest", { query: { [k]: SENT } }), k);
  assert.deepEqual(plain(OPS.signintrace), { classes: SESSION, machineClasses: [], mutating: false });
  assert.ok(Object.hasOwn(NEEDS, "signintrace") && NEEDS.signintrace === null);
  assert.deepEqual(stamps("signintrace"), ["viewer"]);
  assert.deepEqual(familyOf("signintrace"), ["signin-door"]);
  for (const op of ["grouplogoset", "grouplanguagesset", "signrequest", "signintrace"]) {
    assert.ok(both(op), op);
    assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: explained and named, or neither`);
  }
  /* negative control */
  assert.notEqual(NEEDS.signrequest, NEEDS.grouplogoset);
  assert.notDeepEqual(stamps("signintrace"), stamps("signrequest"));
});

test("R55, R57, R59, R61, R5, R7: t47.mjs is frozen data — each share names an owner whose family exists, each family an owner no other names, every kind one of OP_KINDS, and each family op merged into OP_FAMILIES (negative control: a kind outside OP_KINDS is seen)", () => {
  const BASE = Object.keys(OP_FAMILIES).filter((o) => !T47_FAMILIES.some((f) => f.owner === o));
  for (const [owner, share] of Object.entries(T47_SHARES)) {
    assert.ok(Object.isFrozen(share) && Object.isFrozen(share.ops), owner);
    assert.ok(BASE.includes(owner), `${owner}: a share of no family`);
    for (const [op, k] of Object.entries(share.ops)) {
      assert.ok(Object.hasOwn(O.OP_KINDS, k), `${op}: ${k}`);
      assert.equal(OP_FAMILIES[owner].kinds[op], k, op);
    }
  }
  for (const f of T47_FAMILIES) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.ops), f.owner);
    /* T51 (R77): a family T47 gave an owner also holds that owner's T51 share (`t51.mjs`: basis-versions' `versioncompare`) */
    assert.deepEqual(plain(OP_FAMILIES[f.owner].kinds), plain({ ...f.ops, ...(T51_SHARES[f.owner]?.ops ?? {}) }), f.owner);
  }
  assert.ok(!readFileSync(new URL("bio-plane/src/op-declarations/t47.mjs", ROOT), "utf8").match(/\bimport\b/));
  /* negative control */
  assert.ok(!Object.hasOwn(O.OP_KINDS, "nosuchkind"));
});

/* ---------- R61 ---------- */

test("R61 (K3104; people R37): peopledirectory a member session's read in people's family, viewer stamped, NEEDS null, both session sets; served by people's map, its q, show, office, namedIn, since, cursor and limit and the viewer read from the query; named in ACT_HELP_ABSENT as a read a screen draws from while ACT_HELP holds no text for it (negative control: a body viewer does not reach)", async () => {
  shared("peopledirectory");
  assert.deepEqual(plain(OPS.peopledirectory), { classes: SESSION, machineClasses: [], mutating: false });
  assert.ok(Object.hasOwn(NEEDS, "peopledirectory") && NEEDS.peopledirectory === null);
  assert.deepEqual(stamps("peopledirectory"), ["viewer"]);
  assert.deepEqual(familyOf("peopledirectory"), ["people"]);
  assert.ok(both("peopledirectory"));
  assert.ok(keysOf(peopleOps).includes("peopledirectory"));
  for (const k of ["q", "show", "office", "namedIn", "since", "cursor", "limit", "viewer"])
    assert.ok(await reaches(peopleOps, "peopledirectory", { query: { [k]: SENT } }), k);
  assert.equal(ground("peopledirectory").length + (explained("peopledirectory") ? 1 : 0), 1);
  if (!explained("peopledirectory")) assert.deepEqual(ground("peopledirectory"), ["read"]);
  /* negative control */
  assert.ok(!(await reaches(peopleOps, "peopledirectory", { body: { viewer: SENT } })));
});

/* ---------- R54, R60 ---------- */

test("R54, R60 (K3062; DEC-198–DEC-217): R21 read against the registry at PR #33's head — every function act an op or an alias, the one new since PR #28 (subscriptiondisconnect) a declared op by its own name, capture no act of the capture screen, which names captureupload; every declared act has a spec; the one owed act, owed:passwordresetlink DEC-201, is declared under its own name by R57; projectaikeepaway and every act once owed (itemtakeup, actionscope, filingsecondapprove, escalationstoppursuing, infolevelset, subscriptionsignin) are declared acts; the owed acts of wizard-scripts R35 (passwordreset, grouplanguagesset, grouplogoset, signrequest) are served under their names; hostingaccessset is the act on setup and group, hostingaccess none (negative control: an undeclared act is seen)", () => {
  const fns = regActs.filter((a) => a.status === "function");
  for (const a of fns) assert.ok(Object.hasOwn(OPS, a.op), `${a.op}: a function act with no spec`);
  for (const al of Object.keys(OP_ALIASES)) assert.ok(fns.some((a) => a.op === al), `${al}: an alias of no registry function`);
  assert.ok(regActs.some((a) => a.op === "subscriptiondisconnect") && !Object.hasOwn(OP_ALIASES, "subscriptiondisconnect"));
  const capture = registry.screens.find((s) => s.id === "capture");
  assert.ok(!capture.acts.some((a) => a.op === "capture") && capture.acts.some((a) => a.op === "captureupload"));
  const declared = regActs.filter((a) => a.status === "declared");
  assert.deepEqual(declared.filter((a) => !Object.hasOwn(OPS, a.op)).map((a) => a.op), []);
  /* T48 (R65; PR #34's merge, `4664e8efd4`): DEC-226 adds the update screen's three owed acts, `updatestart`,
     `updatelater` and `updateskip` (the second also on the queue), each declared under its own name by R66 */
  /* T49 (K3321 (B); PR #36's registry): `owed:founderhandleset K3265` is declared by R71 (membership's founder-only op, the
     founder's set alone); the five owed acts T49 leaves out (N933, DEC-238, DEC-239) have no op yet. */
  const OWED_T49 = ["founderhandleset"];
  /* T50 (R73, R75; K3674, K3471): the five owed acts T49 left out are declared by R73 and the registry's `aliaswithdraw`
     (owed, K3674) is the op declared since T5-11, each read as served with no alias; the installer's four own routes are
     owed and no plane op, so each has no spec (R6) and is named back to BOB (R21). */
  const OWED_T50 = ["actioninquiry", "actionstake", "projectstakeset", "secondlook", "watchitem", "aliaswithdraw"];
  const LEFT_OUT = ["installalongside", "installremove", "installremoveconfirm", "installupdate", ...OWED_BY_FIX_ROUND_AT_43379A1A44];
  /* T51 (R76): the seven DEC-330 browser acts are owed rows read as a class of their own, no op */
  const BROWSER = browserActs(registry);
  /* R80: an owed act an owner declares is read as served by its declaration (`register-owners.mjs`), an op like any other */
  assert.deepEqual(owedOf(regActs).sort(), [...new Set(["passwordresetlink", "updatelater", "updateskip", "updatestart", ...OWED_T49, ...OWED_T50, ...LEFT_OUT, ...OWED_SERVED_BY_OWNERS, ...BROWSER])].sort());
  for (const op of OWED_SERVED_BY_OWNERS) assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op), `${op}: declared by its owner and not an op`);
  for (const op of LEFT_OUT) assert.ok(!Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op), `${op}: left out and declared`);
  for (const op of OWED_T50) assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op) && SESSION_OPS.member.has(op), `${op}: owed and undeclared`);
  for (const op of OWED_T49) assert.ok(Object.hasOwn(OPS, op) && SESSION_OPS.admin.has(op) && !SESSION_OPS.member.has(op), op);
  for (const op of ["updatestart", "updatelater", "updateskip"]) assert.ok(Object.hasOwn(OPS, op) && both(op) && !Object.hasOwn(OP_ALIASES, op), op);
  assert.ok(Object.hasOwn(OPS, "passwordresetlink") && !Object.hasOwn(OP_ALIASES, "passwordresetlink"));
  for (const op of ["projectaikeepaway", "itemtakeup", "actionscope", "filingsecondapprove", "escalationstoppursuing",
                    "infolevelset", "subscriptionsignin", "passwordreset", "grouplanguagesset", "grouplogoset", "signrequest", "unlock"])
    /* T49 (K3321 (B); PR #36's registry): `passwordreset` and `unlock` are `function` acts of the front and reset screens now */
    assert.ok((declared.some((a) => a.op === op) || (["passwordreset", "unlock"].includes(op) && fns.some((a) => a.op === op)))
              && Object.hasOwn(OPS, op), `${op}: not a declared act with a spec`);
  for (const id of ["setup", "group"]) {
    const sc = registry.screens.find((s) => s.id === id);
    assert.ok(sc.acts.some((a) => a.op === "hostingaccessset"), id);
    assert.ok(!sc.acts.some((a) => a.op === "hostingaccess"), id);
  }
  /* negative control */
  assert.deepEqual([...declared, { op: "nosuchdeclaredact" }].filter((a) => !Object.hasOwn(OPS, a.op)).map((a) => a.op),
                   ["nosuchdeclaredact"]);
});

test("R54, R60 (wizard-scripts R31, R35, R36): R27 read against the library at PR #33's head — it marks no act owed, and every act its scripts' steps name is a declared op or an alias, the four R52 named owed carried under their own names in both session sets (negative control: an undeclared step is seen)", () => {
  /* T48 (R65): at PR #34's merge the update wizard's one step marks `owed:updatestart K3158`, read as served once R66
     declares it; no other act is owed */
  assert.deepEqual(JSON.stringify(library).match(/owed:[a-z]+/g), ["owed:updatestart"]);
  /* T48 (R65): a step marked `owed:<op> <ref>` names the op R66 declares, read as served */
  const steps = library.scripts.flatMap((s) => s.versions.flatMap((v) => v.steps.map((st) => st.act))).filter(Boolean)
    .map((act) => act.replace(/^owed:/, "").split(" ")[0]);
  assert.deepEqual([...new Set(steps)].filter((op) => !Object.hasOwn(OPS, op)), []);
  for (const op of ["actionscope", "itemtakeup", "escalationstoppursuing", "subscriptionsignin"])
    assert.ok(steps.includes(op) && both(op) && !Object.hasOwn(OP_ALIASES, op), op);
  /* negative control */
  assert.deepEqual([...steps, "nosuchstep"].filter((op) => !Object.hasOwn(OPS, op)), ["nosuchstep"]);
});

test("R54, R34 (T47; affordances R54, R56): every member op T47 declares is explained in ACT_HELP or named in ACT_HELP_ABSENT, never both — the reads sourceof, sourcerung, projectlist, projectquestions, peopledirectory and signintrace under the read ground and the acts the design has not yet explained under the last, while ACT_HELP has no text for them; statusreportassist, airundispatch, joindoors and clockproposals named only while ACT_HELP lacks their texts (negative control: an explained op is named under no ground)", () => {
  const READS = ["sourceof", "sourcerung", "projectlist", "projectquestions", "peopledirectory", "signintrace"];
  /* T50 (R75; affordances R64): `reauth` is explained by `act.reauth.does` and leaves the last ground */
  const ACTS = ["drawquestion", "projectbarset", "monitorset", "unlock", "passwordresetlink", "grouplogoset",
                "grouplanguagesset", "signrequest"];
  for (const op of [...READS, ...ACTS, "statusreportassist", "airundispatch", "joindoors", "clockproposals"]) {
    assert.ok(SESSION_OPS.member.has(op), op);
    assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: explained and named, or neither`);
  }
  for (const op of READS) if (!explained(op)) assert.deepEqual(ground(op), ["read"], op);
  for (const op of ACTS) if (!explained(op)) assert.deepEqual(ground(op), ["unexplained"], op);
  /* negative control */
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R62, R63: R6's store-internal routes; publishedlist public ---------- */

test("R62, R63, R6 (K3143, K3144): the store-internal routes T47 adds — store-door's reauthdue (its R15), signin-door's five (signintokenhold, signintokenrefused, signindisclosuredue, signintracekeep, signintraceread; plane R49) and instance-setup's grouplogo (its R86) — have no spec and are in no table; publishedlist is public (classes null), in no session set, stamped nothing, no NEEDS row (negative control: a declared op is in a table, and publishedlist's neighbour index stays the working corpus's)", () => {
  const INTERNAL = ["reauthdue", "signintokenhold", "signintokenrefused", "signindisclosuredue", "signintracekeep",
                    "signintraceread", "grouplogo",
                    /* T51 (K4076): instance-setup's store-internal route for the install facts, no spec, as grouplogo */
                    "bootstrapfacts",
                    /* T51 (R105, K5170; K5178): instance-setup's store-internal route for the migrations' counts, no spec, as bootstrapfacts */
                    "selftestmigrations"];
  const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && neither(op) && !Object.hasOwn(OP_STAMPS, op)
    && !LISTS.some(([, l]) => l.includes(op)) && !Object.hasOwn(UNATTENDED_BY_DECISION, op) && !Object.hasOwn(REAUTH_ACTS, op);
  for (const op of INTERNAL) assert.ok(inNoTable(op), `${op} is in a table`);
  assert.deepEqual(plain(OPS.publishedlist), { classes: null, mutating: false });
  assert.ok(neither("publishedlist") && !Object.hasOwn(NEEDS, "publishedlist") && !Object.hasOwn(OP_STAMPS, "publishedlist"));
  assert.deepEqual(listsOf("publishedlist"), []);
  assert.equal(ACT_GATE.mode("publishedlist"), "machine");
  /* negative control */
  assert.ok(!inNoTable("signintrace") && !inNoTable("grouplogoset"));
  assert.deepEqual(plain(OPS.index), { classes: MP, mutating: false });
});
