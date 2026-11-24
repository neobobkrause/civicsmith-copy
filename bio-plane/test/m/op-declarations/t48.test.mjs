/* op-declarations, T48 (R64–R70; N880, N882, N670, N847, N1026, N1027, N1029, N1030, N1034–N1039, N1043, N1045, N1047,
   N996; DEC-226, DEC-227; K3101, K3147, K3150, K3158, K3189, K3200, K3203, K3206, K3207, K3211): T48's specs (R64, R66,
   R67), the registry and the library read at PR #34's merge (R65), the 24 ops that moved to `ai-accounts` (R68), the
   tables built on first read (R69) and `sourceof`'s control (R70), with R34 over each new op. Each op is tested by name
   with a negative control (K874). Specs, sets, rows and stamps are read from the exported tables; each stamp is driven
   through its owner's own ops map where this module uses the owner's map, so a stamp named at a site the owner does not
   read is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as O from "../../../src/op-declarations/index.mjs";
import { REGISTERED } from "./register-owners.mjs";
import { explained } from "./help.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44, OWED_SERVED_BY_OWNERS } from "./browser.mjs";
import { T48_SHARES, T48_FAMILIES } from "../../../src/op-declarations/t48.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { exploreOps } from "../../../src/explore/ops.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";
import { connectionsOps } from "../../../src/connections/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { reviewOps } from "../../../src/review/index.mjs";
import { checkScript } from "../../../src/wizard-scripts/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, PLAN_RUN_SCOPE } = O;
const MP = ["admin", "member", "probe"];
const SESSION = ["admin", "member"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", PLAN_RUN_SCOPE.writes]]);
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* the kinds the new ops take (`OP_KINDS`) */
const KIND = {
  member: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute" },   // refused a machine by name
  own: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null },              // a member's own mark
  admin: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null },            // an administrator's act
  read: { spec: { classes: MP, mutating: false }, needs: null },                                     // a read by the viewer's sight
  ownread: { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null },         // a session's read
};
/* what an op of the shared conditions is: in neither bearer fence, off AI_GRANT_OPS, no `ai` class, never unattended,
   no alias, frozen, in both session sets, the act gate answering session */
const shared = (op, [fam, kind, st]) => {
  assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
  assert.deepEqual(familyOf(op), [fam], `${op}: family`);
  assert.equal(OP_FAMILIES[fam].kinds[op], kind, `${op}: kind`);
  assert.deepEqual(plain(OPS[op]), KIND[kind].spec, `${op}: spec`);
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
  assert.ok(Object.hasOwn(NEEDS, op), `${op}: no NEEDS row`);
  assert.equal(NEEDS[op], KIND[kind].needs, `${op}: NEEDS`);
  assert.equal(ACT_GATE.needs(op), KIND[kind].needs, op);
  assert.deepEqual(stamps(op), [...st].sort(), `${op}: stamps`);
  assert.ok(both(op) && ACT_GATE.mode(op) === "session", `${op}: not in both session sets`);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
  if (Array.isArray(OPS[op].machineClasses)) assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
};

/* An owner's map over a service that records each call and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const keysOf = (mapFn) => {
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
  return Object.keys(mapFn(svc, new URL("http://plane/"), {}, svc, svc));
};
const SENT = "member:sentinel-48";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);
/* `where(k)`: the sentinel at query key `k` (default) or at body key `k` */
const Q = (k) => ({ query: { [k]: SENT } });
const B = (k) => ({ body: { [k]: SENT } });

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("docs/development/ux-substrate/screens/library.json", ROOT), "utf8"));
const regActs = registry.screens.flatMap((s) => s.acts.map((a) => ({ ...a, screen: s.id })));
const owedOf = (acts) => [...new Set(acts.filter((a) => a.status === "owed").map((a) => a.op.replace(/^owed:/, "").split(" ")[0]))];

/* R34 over a new op: explained in affordances' ACT_HELP, or named under the one ground, never both */
const helped = (op, want) => {
  assert.ok(SESSION_OPS.member.has(op), op);
  assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: explained and named, or neither`);
  if (!explained(op)) assert.deepEqual(ground(op), [want], op);
};

/* ---------- R64 ---------- */

test("R64, R2–R4, R6 (N880; action-replies R10): actionreplyquoting is a member's act in action-replies' family — a session's only (machineClasses []), mutating, NEEDS contribute, author and viewer stamped from the query — served by action-replies' map with target, ord, quotable and words read from the body, in both session sets, in neither bearer fence, off AI_GRANT_OPS, no ai class (negative control: a body copy of the actor does not reach, an ai credential is admitted by no class, and a drifted kind is seen)", async () => {
  const op = "actionreplyquoting";
  shared(op, ["action-replies", "member", ["author", "viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.actionreplybearing));
  assert.equal(NEEDS[op], "contribute");
  assert.ok(keysOf(actionRepliesOps).includes(op));
  for (const k of ["author", "viewer"]) assert.ok(await reaches(actionRepliesOps, op, Q(k)), `${op}: ${k} does not reach`);
  for (const k of ["target", "ord", "words", "quotable"]) assert.ok(await reaches(actionRepliesOps, op, B(k)), `${op}: body ${k} does not reach`);
  /* negative controls */
  assert.equal(await reaches(actionRepliesOps, op, B("author")), false, "a body author is the actor");
  assert.equal(await reaches(actionRepliesOps, op, B("viewer")), false, "a body viewer is the viewer");
  assert.equal(await reaches(actionRepliesOps, op, Q("nosuchstamp")), false);
  assert.deepEqual(machineAdmits(op), [], "a bearer, an ai credential among them, reaches it");
  assert.notDeepEqual(plain({ ...OPS[op], machineClasses: undefined }), KIND.member.spec);
  assert.notEqual(OP_FAMILIES["action-replies"].kinds[op], "read");
});

test("R64, R2–R4, R6 (N882; following R30): proceedingdates is a read in following's family — admin, member and probe, not mutating, NEEDS null, viewer stamped, proceeding, from and to the query's — served by following's map, in both session sets (negative control: a body viewer or a body proceeding does not reach, and a read is no act)", async () => {
  const op = "proceedingdates";
  shared(op, ["following", "read", ["viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.follows));
  assert.ok(keysOf(followingOps).includes(op));
  for (const k of ["viewer", "proceeding", "from", "to"]) assert.ok(await reaches(followingOps, op, Q(k)), `${op}: ${k} does not reach`);
  /* negative controls */
  for (const k of ["viewer", "proceeding", "from", "to"]) assert.equal(await reaches(followingOps, op, B(k)), false, `a body ${k} reaches`);
  assert.equal(await reaches(followingOps, op, Q("nosuchstamp")), false);
  assert.ok(!OP_FAMILIES.following.acts.includes(op) && OP_FAMILIES.following.reads.includes(op));
});

test("R64, R2–R4, R6 (N670; agent-worker R86): readtranslate is a session's read in agent-worker's family, declared as textcheck is — admin and member only (machineClasses []), not mutating, NEEDS null, by and viewer stamped, no project stamp, body {subject, language?} — in both session sets, off AI_GRANT_OPS, served by the plane's draft door and by no map of a module this one uses (negative control: no ai credential is admitted, no project field is stamped, textcheck is its twin)", () => {
  const op = "readtranslate";
  shared(op, ["agent-worker", "ownread", ["by", "viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.textcheck));
  assert.equal(NEEDS[op], NEEDS.textcheck);
  assert.deepEqual(stamps(op), stamps("textcheck"));
  assert.ok(!stamps(op).includes("project"), "a project stamp");
  assert.ok(OP_FAMILIES["agent-worker"].reads.includes(op));
  /* the handler is the plane's draft door (plane R50): no ops map this module uses serves it */
  for (const m of [followingOps, actionRepliesOps, aiUseOps, exploreOps, standardsOps, filingsOps, actionHoldsOps, actionPlansOps,
                   connectionsOps, membershipOps, reviewOps, aiAccountsOps, credentialsOps])
    assert.ok(!keysOf(m).includes(op), `${op} is served by an owner's map`);
  /* negative controls */
  assert.deepEqual(machineAdmits(op), [], "a bearer, an ai credential among them, reaches it");
  assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), "on a task scope");
  assert.notDeepEqual(plain(OPS[op]), KIND.read.spec);
});

test("R64, R4 (N882; following R29): followregister's spec gains the body field proceeding — the spec, session sets, NEEDS row and stamps are what they were (a member's act of following's family, by and viewer stamped), proceeding is no stamp and reaches following's map from the body (negative control: a query proceeding does not reach, and the stamp is not the body's)", async () => {
  const op = "followregister";
  assert.deepEqual(plain(OPS[op]), plain(OPS.followbody));
  assert.equal(OP_FAMILIES.following.kinds[op], "member");
  assert.equal(NEEDS[op], "contribute");
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  assert.ok(both(op));
  assert.ok(!stamps(op).includes("proceeding"));
  assert.ok(await reaches(followingOps, op, B("proceeding")), "the body's proceeding does not reach");
  /* negative controls */
  assert.equal(await reaches(followingOps, op, Q("proceeding")), false, "a query proceeding reaches");
  assert.equal((await drive(followingOps, op, { body: { author: SENT }, query: { by: "member:real" } })).includes(SENT), false,
               "a body author is the actor");
  assert.ok(await reaches(followingOps, op, Q("by")));
});

test("R64, R34: actionreplyquoting and readtranslate are explained in affordances' ACT_HELP or named under the last ground (an act the design has not yet explained), proceedingdates under the read ground (a read a screen draws from), never both (negative control: an explained op is named under no ground)", () => {
  helped("actionreplyquoting", "unexplained");
  helped("readtranslate", "unexplained");
  helped("proceedingdates", "read");
  /* negative control */
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R65 ---------- */

test("R65, R21 (N847, N1054; DEC-226, DEC-227; wizard-scripts R38): R21 read against the registry at PR #34's merge — every function act is an op or an alias and the alias table names only function acts of the file, the Where else to go screen lists no act so no spec or alias is added for it, and the update screen's three owed acts (updatestart, updatelater, updateskip; updatelater also on the queue) are each declared under their own names with no alias (negative control: an undeclared function is seen)", () => {
  const fns = regActs.filter((a) => a.status === "function");
  /* T49 (K3321 (B), K3393; R21): the count is read from the registry, never pinned (K3268) */
  assert.ok(fns.length > 0, `${fns.length} function acts`);
  for (const a of fns) assert.ok(Object.hasOwn(OPS, a.op), `${a.op}: a function act with no spec`);
  /* the alias table equals the file's function acts: each alias is a function act of the file; every other function act is
     an op declared under its own name */
  for (const al of Object.keys(OP_ALIASES)) assert.ok(fns.some((a) => a.op === al), `${al}: an alias of no registry function`);
  for (const a of fns.filter((x) => !Object.hasOwn(OP_ALIASES, x.op))) assert.ok(O.FAMILY_OPS.includes(a.op) || Object.hasOwn(OPS, a.op), a.op);
  const elsewhere = registry.screens.find((s) => s.id === "elsewhere");
  assert.ok(elsewhere && elsewhere.acts.length === 0, "the elsewhere screen lists an act");
  assert.deepEqual(Object.keys(OPS).filter((op) => /^elsewhere/.test(op)), []);
  assert.deepEqual(Object.keys(OP_ALIASES).filter((al) => /^elsewhere/.test(al)), []);
  const owed = regActs.filter((a) => a.status === "owed");
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
  assert.deepEqual(owed.filter((a) => /^owed:updatelater /.test(a.op)).map((a) => a.screen).sort(), ["queue", "updates"]);
  for (const op of ["updatestart", "updatelater", "updateskip"]) {
    assert.ok(Object.hasOwn(OPS, op) && both(op) && !Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
    assert.equal(OP_FAMILIES["instance-setup"].kinds[op], "admin", op);
  }
  /* negative control */
  assert.deepEqual([...fns, { op: "nosuchfunction" }].filter((a) => !Object.hasOwn(OPS, a.op)).map((a) => a.op), ["nosuchfunction"]);
});

test("R65, R27 (N1054; DEC-226; wizard-scripts R38): R27 read against the library at PR #34's merge — its one owed act is updatestart in the update wizard, declared under its own name in both session sets with no alias, every other step names a declared op or an alias (negative control: an undeclared step is seen)", () => {
  assert.deepEqual(JSON.stringify(library).match(/owed:[a-z]+/g), ["owed:updatestart"]);
  const named = library.scripts.flatMap((s) => s.versions.flatMap((v) => v.steps.map((st) => st.act))).filter(Boolean);
  const steps = named.map((act) => act.replace(/^owed:/, "").split(" ")[0]);
  assert.ok(named.some((act) => /^owed:updatestart /.test(act)));
  assert.deepEqual([...new Set(steps)].filter((op) => !Object.hasOwn(OPS, op)), []);
  assert.ok(Object.hasOwn(OPS, "updatestart") && both("updatestart") && !Object.hasOwn(OP_ALIASES, "updatestart"));
  /* negative control */
  assert.deepEqual([...steps, "nosuchstep"].filter((op) => !Object.hasOwn(OPS, op)), ["nosuchstep"]);
});

test("R65, R60 (N1054; DEC-226): the control — a step naming updateskip on the updates screen passes op=wizardcheck once R66's specs are held, and is refused without them (the check's act table is the declared ops), the same step naming an act the screen does not offer is refused either way", () => {
  /* the registration the plane builds: each screen's declared and function acts, each owed act at its place */
  const screens = registry.screens.map((s) => ({ id: s.id,
    acts: s.acts.filter((a) => a.status !== "owed").map((a) => a.op),
    owed: s.acts.map((a, at) => ({ a, at })).filter(({ a }) => a.status === "owed")
      .map(({ a, at }) => ({ op: a.op.replace(/^owed:/, "").split(" ")[0], at })) }));
  const step = (act) => [{ screen: "updates", act, what: "Skip this release.", why: "The group will not install it." }];
  const held = new Set(Object.keys(OPS));
  const without = new Set([...held].filter((op) => !["updatestart", "updatelater", "updateskip", "updatenotice"].includes(op)));
  assert.deepEqual(checkScript(step("updateskip"), { screens, ops: held }).refusals.map((r) => r.code), [], "refused with the specs held");
  assert.deepEqual(checkScript(step("updateskip"), { screens, ops: without }).refusals.map((r) => r.code), ["WIZARD_ACT_UNKNOWN"],
                   "passed without the specs");
  /* negative control */
  assert.deepEqual(checkScript(step("nosuchact"), { screens, ops: held }).refusals.map((r) => r.code), ["WIZARD_ACT_UNKNOWN"]);
});

/* ---------- R66 ---------- */

test("R66, R2–R4, R6 (N1047; DEC-226; instance-setup R89, R90): updatenotice is a session's read and updatestart, updatelater and updateskip are administrators' acts, all in instance-setup's family, for a session only (machineClasses []), NEEDS null, mutating for the three, by stamped on the acts and viewer on the read, in both session sets, in neither bearer fence, off AI_GRANT_OPS (negative control: no capability gates an administrator's act, so the owner's NOT_AN_ADMIN is the first answer, and a bearer is admitted by none)", () => {
  shared("updatenotice", ["instance-setup", "ownread", ["viewer"]]);
  for (const op of ["updatestart", "updatelater", "updateskip"]) {
    shared(op, ["instance-setup", "admin", ["by", "viewer"]]);
    assert.deepEqual(plain(OPS[op]), plain(OPS.officesseed), `${op}: an administrator's act, as officesseed's`);
    assert.equal(NEEDS[op], null, `${op}: a capability would answer before NOT_AN_ADMIN`);
  }
  /* version is a body field of each (and reason of updateskip): no stamp names either */
  for (const op of ["updatenotice", "updatestart", "updatelater", "updateskip"])
    assert.ok(!stamps(op).includes("version") && !stamps(op).includes("reason"), op);
  /* the owner's map is not a module this one imports (instance-setup serves them: T48-62), so each is named for that job */
  assert.deepEqual(OP_FAMILIES["instance-setup"].acts.filter((op) => /^update/.test(op)).sort(), ["updatelater", "updateskip", "updatestart"]);
  assert.deepEqual(OP_FAMILIES["instance-setup"].reads.filter((op) => /^update/.test(op)), ["updatenotice"]);
  /* negative controls */
  for (const op of ["updatestart", "updatelater", "updateskip", "updatenotice"]) assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
  assert.notDeepEqual(plain(OPS.updateskip), plain(OPS.updatenotice));
  assert.ok(!Object.hasOwn(OPS, "updateno"));
});

test("R66, R21, R34 (N1047; DEC-226): the registry's owed acts are declared under their own names — updatestart, updatelater and updateskip each a spec, none aliased, none owed without a spec — and R34 holds: the three acts are explained by affordances' ACT_HELP under their own names (the texts the design gives under owed_updatestart, owed_updatelater and owed_updateskip) or, while that text is not merged, named under the last ground, never both; updatenotice is named under the read ground (negative control: an explained act is named under no ground)", () => {
  for (const op of ["updatestart", "updatelater", "updateskip"]) helped(op, "unexplained");
  helped("updatenotice", "read");
  /* the design's words for the three exist on the registry's own file, whichever side of the merge */
  const mock = readFileSync(new URL("docs/development/ux-substrate/screens/mock-acts.js", ROOT), "utf8");
  for (const op of ["updatestart", "updatelater", "updateskip"]) assert.match(mock, new RegExp(`^  owed_${op}: `, "m"), op);
  /* negative control */
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R67 ---------- */

test("R67, R2–R4, R6 (N1026, K3206; ai-use R14): aiuseovertime is a session's read in ai-use's family, declared beside ailimits and as it is — admin and member only (machineClasses []), not mutating, NEEDS null, viewer stamped, owner a query field — served by ai-use's map (negative control: a body viewer does not reach, ailimits is its twin and ailimitset is not)", async () => {
  const op = "aiuseovertime";
  shared(op, ["ai-use", "ownread", ["viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.ailimits));
  assert.deepEqual(stamps(op), stamps("ailimits"));
  assert.ok(keysOf(aiUseOps).includes(op));
  for (const k of ["viewer", "owner"]) assert.ok(await reaches(aiUseOps, op, Q(k)), `${op}: ${k} does not reach`);
  /* negative controls */
  assert.equal(await reaches(aiUseOps, op, B("viewer")), false, "a body viewer reaches");
  assert.equal(await reaches(aiUseOps, op, Q("nosuchstamp")), false);
  assert.notDeepEqual(plain(OPS[op]), plain(OPS.ailimitset));
});

test("R67, R2–R4, R6 (N1027, N1029, N1030, N1035; explore R21, standards R57, filings R59, action-holds R16): exploregraph, standardproposals, filingread and pressurefor are reads in their owners' families — admin, member and probe, not mutating, NEEDS null, viewer stamped — served by the owners' maps with the fields the requirement names (explore's from the body, the others' from the query; filingread's filing from either) (negative control: a body viewer does not reach, a read is no act)", async () => {
  const CASES = [
    ["exploregraph", "explore", exploreOps, [["body", ["centre", "at", "rings", "kinds", "scope"]]]],
    ["standardproposals", "standards", standardsOps, [["query", ["project", "state", "after", "limit"]]]],
    ["filingread", "filings", filingsOps, [["query", ["filing"]], ["body", ["filing"]]]],
    ["pressurefor", "action-holds", actionHoldsOps, [["query", ["project", "action", "after", "limit"]]]],
  ];
  for (const [op, fam, map, fields] of CASES) {
    shared(op, [fam, "read", ["viewer"]]);
    assert.ok(keysOf(map).includes(op), `${op} is not served by ${fam}`);
    assert.ok(await reaches(map, op, Q("viewer")), `${op}: viewer does not reach`);
    for (const [at, keys] of fields) for (const k of keys)
      assert.ok(await reaches(map, op, at === "query" ? Q(k) : B(k)), `${op}: ${at} ${k} does not reach`);
    /* negative controls */
    assert.equal(await reaches(map, op, B("viewer")), false, `${op}: a body viewer reaches`);
    assert.equal(await reaches(map, op, Q("nosuchstamp")), false, `${op}: any key reaches`);
    assert.ok(OP_FAMILIES[fam].reads.includes(op) && !OP_FAMILIES[fam].acts.includes(op), op);
  }
  assert.deepEqual(plain(OPS.exploregraph), plain(OPS.exploreverify));
});

test("R67, R2–R4, R6 (N1038, K3278; action-plans R51): planask is a member's act in action-plans' family — a session's only (machineClasses [], MACHINE_CANNOT_PLAN), mutating, NEEDS contribute, author and viewer stamped from the query, plan a body field — served by action-plans' map (negative control: a body author is not the actor, a bearer is admitted by none, a read is not its kind)", async () => {
  const op = "planask";
  shared(op, ["action-plans", "member", ["author", "viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.planpause));
  assert.ok(keysOf(actionPlansOps).includes(op));
  for (const k of ["author", "viewer"]) assert.ok(await reaches(actionPlansOps, op, Q(k)), `${op}: ${k} does not reach`);
  assert.ok(await reaches(actionPlansOps, op, B("plan")), "the body's plan does not reach");
  /* negative controls */
  assert.equal(await reaches(actionPlansOps, op, B("author")), false, "a body author is the actor");
  assert.equal(await reaches(actionPlansOps, op, Q("nosuchstamp")), false);
  assert.ok(!stamps(op).includes("plan"));
  assert.notEqual(OP_FAMILIES["action-plans"].kinds[op], "read");
});

test("R67, R2–R4, R6 (N1043, K3207; connections R68): stepsource and stepsourcewithdraw are members' acts in a connections family — a session's only (machineClasses [], STEP_SOURCE_NOT_A_MEMBER), mutating, NEEDS contribute, member and viewer stamped from the query and never a body value, relation, captureSha, extent, basis, id and reason body fields — served by connections' map (negative control: a body member is not the member, a bearer is admitted by none, the family's actor is not by)", async () => {
  for (const op of ["stepsource", "stepsourcewithdraw"]) {
    shared(op, ["connections", "member", ["member", "viewer"]]);
    assert.ok(keysOf(connectionsOps).includes(op), `${op} is not served by connections`);
    for (const k of ["member", "viewer"]) assert.ok(await reaches(connectionsOps, op, Q(k)), `${op}: ${k} does not reach`);
    /* negative controls */
    assert.equal(await reaches(connectionsOps, op, B("member")), false, `${op}: a body member is the member`);
    assert.equal(await reaches(connectionsOps, op, B("viewer")), false, `${op}: a body viewer is the viewer`);
    assert.equal(await reaches(connectionsOps, op, Q("nosuchstamp")), false);
    assert.ok(!stamps(op).includes("by"));
  }
  for (const k of ["relation", "captureSha", "extent", "basis"]) assert.ok(await reaches(connectionsOps, "stepsource", B(k)), `stepsource: body ${k}`);
  for (const k of ["id", "reason"]) assert.ok(await reaches(connectionsOps, "stepsourcewithdraw", B(k)), `stepsourcewithdraw: body ${k}`);
  assert.deepEqual(OP_FAMILIES.connections.actor, { key: "member", at: "query" });
  assert.deepEqual(plain(OPS.stepsource), plain(OPS.stepsourcewithdraw));
});

test("R67, R2–R4, R6 (N1036, K3211; membership R143): lookedsince is a member's own mark in membership's family — a session's only (machineClasses []), mutating, NEEDS null, by stamped from the query and never a body value, viewer beside it — served by membership's map, in both session sets (negative control: a body by is not the actor, a bearer is admitted by none, it is no capability-gated act)", async () => {
  const op = "lookedsince";
  shared(op, ["membership", "own", ["by", "viewer"]]);
  assert.deepEqual(plain(OPS[op]), plain(OPS.handlechange));
  assert.ok(keysOf(membershipOps).includes(op));
  assert.ok(await reaches(membershipOps, op, Q("by")), `${op}: by does not reach`);
  /* negative controls */
  assert.equal(await reaches(membershipOps, op, B("by")), false, "a body by is the actor");
  assert.equal(await reaches(membershipOps, op, Q("nosuchstamp")), false);
  assert.equal(NEEDS[op], null);
});

test("R67, R4 (N1034, N1035; explore R23, review R34): exploreverify gains the body field chain and reviewgrant the body field until — each spec, session sets, NEEDS row and stamps what they were, neither field a stamp, both reaching the owner from the body (negative control: a body copy of the actor still does not reach reviewgrant, and a bare query chain is not exploreverify's)", async () => {
  assert.deepEqual(plain(OPS.exploreverify), { classes: MP, mutating: false });
  assert.deepEqual(stamps("exploreverify"), ["viewer"]);
  assert.ok(!stamps("exploreverify").includes("chain"));
  assert.ok(await reaches(exploreOps, "exploreverify", B("chain")), "the body's chain does not reach");
  assert.equal(await reaches(exploreOps, "exploreverify", Q("chain")), false, "a query chain reaches");
  assert.deepEqual(plain(OPS.reviewgrant), { classes: MP, mutating: true });
  assert.equal(NEEDS.reviewgrant, "publish");
  assert.ok(!stamps("reviewgrant")?.includes("until"));
  assert.ok(await reaches(reviewOps, "reviewgrant", B("until")), "the body's until does not reach");
  /* negative control */
  assert.equal(await reaches(reviewOps, "reviewgrant", B("author")), false, "a body author is the actor");
  assert.ok(await reaches(reviewOps, "reviewgrant", Q("author")));
});

test("R67, R34 (N1026–N1043, K3203, K3206, K3207): each op R67 declares is explained in affordances' ACT_HELP or named under one ground — the reads aiuseovertime, exploregraph, standardproposals and filingread, pressurefor under the read ground; lookedsince, a mark Home records of itself with no control, under the no-control ground; planask, stepsource and stepsourcewithdraw under the last (acts the design has not yet explained) — never both (negative control: an explained op is named under no ground)", () => {
  for (const op of ["aiuseovertime", "exploregraph", "standardproposals", "filingread", "pressurefor"]) helped(op, "read");
  helped("lookedsince", "nocontrol");
  for (const op of ["planask", "stepsource", "stepsourcewithdraw"]) helped(op, "unexplained");
  /* negative control */
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R68 ---------- */

const MOVED = ["accountreferenceset", "accountreferenceremove", "accountreference", "groupkeyset", "groupkeyremove", "groupkeyswitch",
  "groupkeystate", "groupkeynotice", "groupkeynoticeseen", "subscriptiondisconnect", "aikeepaway", "aikeepawaystate",
  "accountusesset", "accountuses", "accounthistory", "projectkeyset", "projectsigninset", "projectaccountremove",
  "projectaccountswitch", "projectaccountstate", "projectkeynotice", "projectkeynoticeseen", "projectaikeepaway",
  "projectaikeepawaystate"];
/* each moved op's T47 spec, session sets, NEEDS row and stamps, as R20, R24, R33 and R41 gave them */
const T47 = {
  own: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null },
  ownread: { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null },
  admin: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null },
  settingread: { spec: { classes: MP, mutating: false }, needs: null },
};
const T47_KIND = { accountreferenceset: "own", accountreferenceremove: "own", accountreference: "ownread", groupkeyset: "admin",
  groupkeyremove: "admin", groupkeyswitch: "admin", groupkeystate: "ownread", groupkeynotice: "ownread", groupkeynoticeseen: "own",
  subscriptiondisconnect: "own", aikeepaway: "admin", aikeepawaystate: "settingread", accountusesset: "own", accountuses: "ownread",
  accounthistory: "ownread", projectkeyset: "own", projectsigninset: "own", projectaccountremove: "own", projectaccountswitch: "own",
  projectaccountstate: "ownread", projectkeynotice: "ownread", projectkeynoticeseen: "own", projectaikeepaway: "own",
  projectaikeepawaystate: "ownread" };

test("R68, R24, R33, R41, R20 (N996; K3101; ai-accounts): the 24 ops whose routes moved to ai-accounts form a family of ai-accounts' own — their names, specs, session sets, NEEDS rows, stamps and act lists are what they were in T47, their family ai-accounts and credentials' family holds none of them, aigrantmint stays credentials' and AI_GRANT_OPS stays credentials' (negative control: aigrantmint is credentials', a drifted kind is seen)", () => {
  assert.equal(MOVED.length, 24);
  assert.equal(new Set(MOVED).size, 24);
  assert.deepEqual(Object.keys(OP_FAMILIES["ai-accounts"].kinds).sort(), [...MOVED].sort());
  assert.equal(OP_FAMILIES["ai-accounts"].owner, "ai-accounts");
  assert.deepEqual(OP_FAMILIES["ai-accounts"].actor, { key: "by", at: "query" });
  for (const op of MOVED) {
    const want = T47[T47_KIND[op]];
    assert.deepEqual(familyOf(op), ["ai-accounts"], `${op}: family`);
    assert.equal(OP_FAMILIES["ai-accounts"].kinds[op], T47_KIND[op], `${op}: kind`);
    assert.ok(!Object.hasOwn(OP_FAMILIES.credentials.kinds, op), `${op}: still in credentials' family`);
    assert.deepEqual(plain(OPS[op]), want.spec, `${op}: spec`);
    assert.equal(NEEDS[op], want.needs, `${op}: NEEDS`);
    assert.ok(both(op) && ACT_GATE.mode(op) === "session", `${op}: session sets`);
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op) && !AI_GRANT_OPS.includes(op), op);
    assert.deepEqual(listsOf(op), [], op);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
    /* the stamps: by on an act, viewer on a read, the member beside them on the three account-reference ops */
    const extra = ["accountreferenceset", "accountreferenceremove", "accountreference"].includes(op) ? ["member"] : [];
    const act = OPS[op].mutating;
    const stamped = op === "aikeepawaystate" ? [] : ["viewer", ...(act ? ["by"] : []), ...extra];
    assert.deepEqual(stamps(op), stamped.sort(), `${op}: stamps`);
  }
  /* the owner's map serves exactly these 24 (ai-accounts R-routes) */
  assert.deepEqual(keysOf(aiAccountsOps).sort(), [...MOVED].sort());
  /* credentials keeps the rest */
  assert.equal(OP_FAMILIES.credentials.kinds.aigrantmint, "own");
  assert.deepEqual(stamps("aigrantmint"), ["by", "member", "session", "viewer"]);
  assert.ok(OP_FAMILIES.credentials.kinds.subscriptionsignin === "own" && OP_FAMILIES.credentials.kinds.setpassword === "own");
  /* negative controls */
  assert.ok(!Object.hasOwn(OP_FAMILIES["ai-accounts"].kinds, "aigrantmint"));
  assert.notDeepEqual(plain({ ...OPS.groupkeyset, machineClasses: undefined }), T47.admin.spec);
  assert.notEqual(OP_FAMILIES["ai-accounts"].kinds.groupkeystate, "read");
});

test("R68, R24, R41 (N996): the moved ops reach their owner through ai-accounts' map where it reads them — by from the query on every act, viewer on every read, the member beside by on the account-reference ops, the group's key and the project's key the body's only (negative control: a body by is not the actor, a query key does not reach)", async () => {
  const ACTS = MOVED.filter((op) => OPS[op].mutating);
  for (const op of ACTS) assert.ok(await reaches(aiAccountsOps, op, Q("by")), `${op}: by does not reach`);
  for (const op of MOVED.filter((o) => !OPS[o].mutating && o !== "aikeepawaystate"))
    assert.ok(await reaches(aiAccountsOps, op, Q("viewer")), `${op}: viewer does not reach`);
  for (const op of ["groupkeyset", "projectkeyset"]) {
    assert.ok(await reaches(aiAccountsOps, op, B("key")), `${op}: the body's key does not reach`);
    assert.equal(await reaches(aiAccountsOps, op, Q("key")), false, `${op}: the query's key reaches`);
  }
  /* negative controls */
  for (const op of ["groupkeyswitch", "accountusesset", "aikeepaway"])
    assert.equal((await drive(aiAccountsOps, op, { body: { by: SENT }, query: { by: "member:real" } })).includes(SENT), false, op);
  assert.equal(await reaches(aiAccountsOps, "groupkeystate", Q("nosuchstamp")), false);
});

/* ---------- R69 ---------- */

test("R69, R5 (N1039; K3147, K3200): every table and list is built on first read, not at import — in a fresh process the import freezes no table of the module and parses nothing, the first read of any export builds them once, and every later read answers the same frozen value, each export keeping its kind (a list an array, a table a plain object, the two session sets frozen sets) and its frozenness (negative control: a second read builds nothing again, and a write lands nowhere)", () => {
  const url = new URL("../../../src/op-declarations/index.mjs", import.meta.url).href;
  const script = `
    /* the module's own imports build theirs first (affordances' tables are not this module's) */
    await import(${JSON.stringify(new URL("../../../src/affordances.mjs", import.meta.url).href)});
    /* count the large tables the module freezes: a list or table of a hundred entries or more */
    const freeze = Object.freeze; let big = 0;
    Object.freeze = function (o) { try { if (o && typeof o === "object" && (Array.isArray(o) ? o.length : Object.keys(o).length) >= 100) big++; } catch {} return freeze.call(this, o); };
    const t0 = performance.now();
    const m = await import(${JSON.stringify(url)});
    const importMs = performance.now() - t0, atImport = big;
    const names = Object.keys(m).sort();
    const kinds = {};
    for (const k of names) kinds[k] = Array.isArray(m[k]) ? "array" : typeof m[k];
    const afterKinds = big;
    const t1 = performance.now();
    const size = Object.keys(m.OPS).length;            /* the first read */
    const firstMs = performance.now() - t1, afterFirst = big;
    const again = [Object.keys(m.OPS).length, m.EDGE_ACTIONS.length, m.SESSION_OPS.member.size, m.NEEDS.promote, m.ACT_GATE.mode("promote")];
    const afterAll = big;
    const same = m.OPS === m.OPS && m.OPS.index === m.OPS.index && m.SESSION_OPS.member === m.SESSION_OPS.member;
    const frozen = [m.OPS, m.NEEDS, m.OP_ALIASES, m.OP_FAMILIES, m.SESSION_OPS, m.ACT_HELP_ABSENT, m.EDGE_ACTIONS, m.OP_STAMPS]
      .map((x) => Object.isFrozen(x));
    let wrote = "none";
    try { m.EDGE_ACTIONS.push("x"); wrote = "pushed"; } catch (e) { wrote = e.constructor.name; }
    let setWrote = "none"; try { m.SESSION_OPS.member.add("x"); setWrote = "added"; } catch (e) { setWrote = e.constructor.name; }
    process.stdout.write(JSON.stringify({ keys: Object.keys(m.OPS), importMs, atImport, afterKinds, size, firstMs, afterFirst, afterAll, again, same, frozen, wrote, setWrote, kinds, names }));`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.atImport, 0, "a large table is frozen when the module is evaluated");
  assert.equal(out.afterKinds, 0, "reading an export's kind builds a table");
  assert.ok(out.afterFirst > 0, "the first read builds nothing");
  assert.equal(out.afterAll, out.afterFirst, "a read after the first builds a table again");
  assert.ok(out.importMs < 500, `the import's global scope took ${out.importMs} ms, past bundler R31's 500 ms`);
  assert.ok(out.size > 900, `${out.size} ops`);
  assert.equal(out.same, true);
  assert.deepEqual(out.frozen, Array(8).fill(true));
  assert.equal(out.wrote, "TypeError");
  assert.equal(out.setWrote, "TypeError");
  /* the export names and kinds are what they were: 111 names (T51 adds BROWSER_ACTS, R76, and the registration's two functions, R80), REAUTH_ACTS and decorateAct beside the tables */
  assert.equal(out.names.length, 111);
  assert.equal(out.kinds.registerDeclaredOps, "function");
  assert.equal(out.kinds.declaredFields, "function");
  assert.equal(out.kinds.decorateAct, "function");
  assert.equal(out.kinds.OPS, "object");
  assert.equal(out.kinds.EDGE_ACTIONS, "array");
  assert.equal(Object.values(out.kinds).filter((k) => k === "array").length, 95);
  /* negative control: this process's own import is lazy too, and agrees with the child's answer but for the ops the owners
     declare (R80): this process registers every owner (`register-owners.mjs`), the child registers none, so the ops here
     and not there are exactly some of the owners' declarations, and none there is missing here */
  const here = Object.keys(OPS), there = new Set(out.keys);
  const declaredNow = new Set(Object.values(REGISTERED).flatMap((rows) => Object.keys(rows)));
  assert.deepEqual([...there].filter((op) => !Object.hasOwn(OPS, op)), []);
  assert.deepEqual(here.filter((op) => !there.has(op) && !declaredNow.has(op)), []);
});

test("R69 (K3147): every export answers exactly as before the tables were lazy — plain bindings read by the same names: the lists are arrays with the same entries in the same order, the tables plain objects with the same keys and frozen leaves, the specs and class lists frozen, the session sets frozen sets answering has, size and iteration, the act gate and decorateAct working over them (negative control: an export outside the list is missing)", () => {
  for (const [name, v] of Object.entries(O)) {
    if (["decorateAct", "registerDeclaredOps", "declaredFields"].includes(name)) { assert.equal(typeof v, "function"); continue; }
    if (Array.isArray(v)) { assert.ok(Object.isFrozen(v), name); assert.ok(v.every((x) => typeof x === "string"), name); }
    else { assert.equal(typeof v, "object", name); assert.ok(Object.isFrozen(v), name); assert.equal(Object.getPrototypeOf(v), Object.prototype, name); }
  }
  for (const spec of Object.values(OPS)) assert.ok(Object.isFrozen(spec) && (spec.classes === null || Object.isFrozen(spec.classes)));
  assert.equal(SESSION_OPS.member.has("promote"), true);
  assert.equal(SESSION_OPS.member.size, [...SESSION_OPS.member].length);
  assert.throws(() => SESSION_OPS.member.add("x"), TypeError);
  assert.throws(() => SESSION_OPS.admin.delete("promote"), TypeError);
  assert.throws(() => SESSION_OPS.admin.clear(), TypeError);
  assert.equal(ACT_GATE.mode("promote"), "session");
  assert.equal(ACT_GATE.mode("purge"), "machine");
  assert.equal(typeof O.decorateAct, "function");
  assert.equal(O.EDGE_ACTIONS.includes("cite"), true);
  assert.deepEqual([...O.EDGE_ACTIONS], ["cite", "sever", "reinstate", "linkproject", "drawquestion"]);
  assert.ok(Object.keys(O).includes("REAUTH_ACTS") && Object.hasOwn(O.REAUTH_ACTS, "caseratify"));
  /* negative control */
  assert.equal(Object.hasOwn(O, "NOSUCHTABLE"), false);
  assert.throws(() => { O.OPS.index = null; }, TypeError);
});

/* ---------- R70 ---------- */

test("R70, R56 (N1045; K3150): sourceof's control holds at the door because this module declares nothing that admits an ai credential — sourceof names no ai class, admits no bearer by machineClasses beyond its class list, is on no task scope this module declares and on no grant's list, is reached by a member's session, and its spec, rows and stamps are unchanged (negative control: sourcerung is its twin, and an op that is on the planning run's scope, plan, is not the same)", () => {
  const op = "sourceof";
  assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false });
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'));
  assert.equal(NEEDS[op], null);
  /* a viewer-stamped read of SOURCE_READS, whose stamp the act list gives (R4), not a family */
  assert.equal(stamps(op), null);
  assert.ok(O.SOURCE_READS.includes(op) && O.SESSION_SOURCE_READS === undefined);
  assert.ok(both(op) && ACT_GATE.mode(op) === "session");
  assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), "on the planning run's task scope");
  assert.ok(!AI_GRANT_OPS.includes(op) && !O.ASK_GRANT_OPS.includes(op), "on a grant's list");
  assert.ok(!listsOf(op).some((n) => /SCOPE|GRANT/.test(n)), `${op} is on ${listsOf(op)}`);
  assert.deepEqual(plain(OPS.sourcerung), plain(OPS[op]));
  /* negative controls */
  assert.ok(PLAN_RUN_SCOPE.reads.includes("plan"));
  assert.notDeepEqual(plain(OPS.plan), { classes: SESSION, machineClasses: [], mutating: false });
  assert.ok(!OP_FAMILIES["ai-runs"].kinds[op]);
});

/* ---------- the data file ---------- */

test("R64, R66, R67, R68, R5, R7: t48.mjs is frozen data — each share names an owner whose family exists, each family an owner no other names, every kind one of OP_KINDS, no import and no place named — and index.mjs merges each share into its owner's family (negative control: a kind outside OP_KINDS is seen)", () => {
  assert.ok(Object.isFrozen(T48_SHARES) && Object.isFrozen(T48_FAMILIES));
  const BASE = Object.keys(OP_FAMILIES).filter((o) => !T48_FAMILIES.some((f) => f.owner === o));
  for (const [owner, share] of Object.entries(T48_SHARES)) {
    assert.ok(BASE.includes(owner), `${owner}: a share with no family`);
    assert.ok(Object.isFrozen(share) && Object.isFrozen(share.ops), owner);
    for (const [op, k] of Object.entries(share.ops)) {
      assert.ok(Object.hasOwn(O.OP_KINDS, k), `${op}: ${k}`);
      assert.equal(OP_FAMILIES[owner].kinds[op], k, op);
    }
    for (const op of Object.keys(share.extra ?? {})) {
      assert.ok(Object.hasOwn(share.ops, op), `${owner}: an extra on ${op}`);
      assert.ok(Object.isFrozen(share.extra[op]), op);
    }
  }
  for (const f of T48_FAMILIES) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.ops) && Object.isFrozen(f.actor), f.owner);
    assert.ok(!BASE.includes(f.owner));
    assert.deepEqual(plain(OP_FAMILIES[f.owner].kinds), plain(f.ops), f.owner);
  }
  const text = readFileSync(new URL("bio-plane/src/op-declarations/t48.mjs", ROOT), "utf8");
  assert.ok(!text.match(/\bimport\b/), "t48.mjs imports");
  assert.doesNotMatch(JSON.stringify([T48_SHARES, T48_FAMILIES]), /oakland|alameda|california|city of|county of/i);
  /* negative control */
  assert.ok(!Object.hasOwn(O.OP_KINDS, "nosuchkind"));
});
