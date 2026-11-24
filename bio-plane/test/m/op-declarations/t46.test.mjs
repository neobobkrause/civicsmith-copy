/* op-declarations R50–R53 and R2–R6, R34 over them (T46-51; N897 (1), N920, N919, N654, N917, N937, N934; DEC-162,
   DEC-194, DEC-197; K2952, K2960, K2976, K2987): T46's ops — how much is explained (R50), the ops T46's owners in layers 2
   to 10 serve (R51), the registry and the library as PR #28 merged them (R52) and `handlechange` kept as a refusing op
   (R53). Each spec, NEEDS row, session set, stamp and list is compared whole at the exported tables; each stamp and
   body field of an op whose owner's map serves it is driven through that map, so a stamp named at a site the owner does
   not read is seen. Each comparison has a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as O from "../../../src/op-declarations/index.mjs";
import { REGISTERED } from "./register-owners.mjs";
import { explained } from "./help.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44 } from "./browser.mjs";
import { T46_SHARES } from "../../../src/op-declarations/t46.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { planWorkOps } from "../../../src/plan-work/index.mjs";
import { escalationOps } from "../../../src/escalation/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { aiRunsOps, AiRuns } from "../../../src/ai-runs/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_KINDS, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, PLAN_RUN_SCOPE, ASK_GRANT_OPS } = O;
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
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && !SESSION_OPS.member.has(op)
  && !SESSION_OPS.admin.has(op) && !Object.hasOwn(OP_STAMPS, op) && !LISTS.some(([, l]) => l.includes(op))
  && !Object.hasOwn(UNATTENDED_BY_DECISION, op);
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));
/* an agent credential reaches an op only where `member` is admitted and no machineClasses bound it, outside the bearer
   fences (admission R10's floor, read as the op table's shape; R2: no spec names `ai`) */
const agentReaches = (op) => OPS[op].classes?.includes("member") && !Array.isArray(OPS[op].machineClasses)
  && !GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op);
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

/* every condition the ops of R50 and R51 share: both session sets, the act gate's session mode, in neither bearer fence,
   not on a grant's list, no `ai` class, never unattended, no alias, frozen */
const shared = (op) => {
  assert.ok(both(op), `${op}: not in both session sets`);
  assert.equal(ACT_GATE.mode(op), "session", op);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op) && !ASK_GRANT_OPS.includes(op), `${op}: on a grant's list`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
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
const SENT = "member:sentinel-46";
const reaches = async (mapFn, op, where) => JSON.stringify(await drive(mapFn, op, where)).includes(SENT);

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("docs/development/ux-substrate/screens/library.json", ROOT), "utf8"));
const regActs = registry.screens.flatMap((s) => s.acts);
const owedOf = (acts) => [...new Set(acts.filter((a) => a.status === "owed").map((a) => a.op.replace(/^owed:/, "").split(" ")[0]))];

/* ---------- R50 ---------- */

test("R50 (T46; N897 (1); DEC-162; instance-setup R79): infolevelset — a member's own act, as memberlanguageset (admin, member, probe; machineClasses []), mutating, a present null NEEDS row, by stamped and never level or asked; infolevel a read for a session only (machineClasses []), viewer stamped, a present null; both in instance-setup's family, both session sets, in neither bearer fence, not on AI_GRANT_OPS, in no act list (negative control: a drifted spec or a body stamp is seen)", () => {
  assert.deepEqual(plain(OPS.infolevelset), { classes: MP, machineClasses: [], mutating: true });
  assert.deepEqual(plain(OPS.infolevelset), plain(OPS.memberlanguageset));
  assert.equal(OP_FAMILIES["instance-setup"].kinds.infolevelset, OP_FAMILIES["instance-setup"].kinds.memberlanguageset);
  assert.deepEqual(stamps("infolevelset"), ["by", "viewer"]);
  assert.deepEqual(stamps("infolevelset"), stamps("memberlanguageset"));
  for (const f of ["level", "asked", "bodyBy", "member"]) assert.ok(!stamps("infolevelset").includes(f), f);
  assert.deepEqual(plain(OPS.infolevel), { classes: MP, machineClasses: [], mutating: false });
  assert.deepEqual(stamps("infolevel"), ["viewer"]);
  for (const op of ["infolevelset", "infolevel"]) {
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.equal(ACT_GATE.needs(op), null, op);
    assert.deepEqual(familyOf(op), ["instance-setup"], op);
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
    assert.deepEqual(listsOf(op), [], op);
    shared(op);
  }
  assert.deepEqual(OP_FAMILIES["instance-setup"].actor, { key: "by", at: "query" });
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.infolevelset, machineClasses: undefined }), { classes: MP, machineClasses: [], mutating: true });
  assert.notDeepEqual(stamps("infolevelset"), ["bodyBy", "viewer"]);
  assert.notDeepEqual(plain(OPS.infolevel), plain(OPS.memberlanguage));
});

test("R50, R21, R34: the registry's owed act owed:infolevelset DEC-162 is declared under its own name with no alias; infolevelset is in neither ground of ACT_HELP_ABSENT (affordances R53 explains it) and infolevel is named as a read a screen draws from; (R54, R60, T47) at PR #33's head a declared act (negative control: a named read is found)", () => {
  /* T47 (R54, R60): at PR #33's head the registry carries it as a `declared` act under its own name, owed no longer */
  assert.ok(regActs.some((a) => a.op === "infolevelset" && a.status === "declared"));
  assert.ok(!regActs.some((a) => a.op.startsWith("owed:infolevelset")));
  assert.ok(Object.hasOwn(OPS, "infolevelset") && !Object.hasOwn(OP_ALIASES, "infolevelset"));
  assert.deepEqual(ground("infolevelset"), []);
  assert.deepEqual(ground("infolevel"), ["read"]);
  /* negative control */
  assert.deepEqual(ground("memberlanguage"), ["read"]);
});

/* ---------- R51 ---------- */

test("R51 (N920; plan-work R14): statusreportassist — an ownread in plan-work's family (admin, member; machineClasses []), not mutating, viewer stamped, a present null, apart from statusreportdraft (a read admin, member, probe), not on AI_GRANT_OPS; served by plan-work's map, which reads the viewer from the query (negative control: another key does not reach)", async () => {
  const op = "statusreportassist";
  assert.equal(OP_FAMILIES["plan-work"].kinds[op], "ownread");
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: false });
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["viewer"]);
  assert.deepEqual(machineAdmits(op), []);
  assert.deepEqual(listsOf(op), []);
  shared(op);
  /* apart from the machine's draft, which keeps its read */
  assert.equal(OP_FAMILIES["plan-work"].kinds.statusreportdraft, "read");
  assert.notDeepEqual(plain(OPS[op]), plain(OPS.statusreportdraft));
  assert.ok(keysOf(planWorkOps).includes(op));
  assert.ok(await reaches(planWorkOps, op, { query: { viewer: SENT } }));
  /* negative control */
  assert.equal(await reaches(planWorkOps, op, { query: { nosuchstamp: SENT } }), false);
});

test("R51 (escalation R31, R33): escalationstoppursuing and escalationreopen — each a member's act its owner refuses a machine by name, admin, member, probe with machineClasses [], mutating, NEEDS contribute, in escalation's acts (ESCALATION_ACTIONS, so QUERY_AUTHOR_ACTIONS and ACTION_LAYER_ACTIONS) as declinetoescalate, both session sets; author and viewer reach escalation from the query and id and reason from the body (negative control: a body author is not the actor)", async () => {
  for (const op of ["escalationstoppursuing", "escalationreopen"]) {
    assert.deepEqual(plain(OPS[op]), { classes: MP, machineClasses: [], mutating: true }, op);
    assert.deepEqual(OPS[op].classes, OPS.declinetoescalate.classes, op);
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
    assert.equal(NEEDS[op], "contribute", op);
    assert.equal(ACT_GATE.needs(op), "contribute", op);
    assert.deepEqual(listsOf(op), listsOf("declinetoescalate"), op);
    assert.ok(O.ESCALATION_ACTIONS.includes(op) && O.QUERY_AUTHOR_ACTIONS.includes(op) && O.ACTION_LAYER_ACTIONS.includes(op), op);
    assert.deepEqual(familyOf(op), [], `${op} is in a family: its stamps are escalation's act lists'`);
    shared(op);
    assert.ok(keysOf(escalationOps).includes(op), op);
    for (const k of ["author", "viewer"]) assert.ok(await reaches(escalationOps, op, { query: { [k]: SENT } }), `${op}: ${k}`);
    for (const k of ["id", "reason"]) assert.ok(await reaches(escalationOps, op, { body: { [k]: SENT } }), `${op}: the body's ${k}`);
    /* negative control: the query's author overwrites a body copy */
    assert.equal(await reaches(escalationOps, op, { body: { author: SENT } }), false, op);
  }
  /* escalation's map is served whole by the tables (R6) */
  for (const op of keysOf(escalationOps)) assert.ok(Object.hasOwn(OPS, op), op);
  /* negative control: an op added to the map without a spec is seen */
  assert.deepEqual([...keysOf(escalationOps), "escalationnosuch"].filter((op) => !Object.hasOwn(OPS, op)), ["escalationnosuch"]);
});

test("R51, R21, R27, R34: the registry's and the library's owed act escalationstoppursuing K2780 is declared under its own name, no alias; escalationstoppursuing and escalationreopen are in no ground of ACT_HELP_ABSENT (affordances R53 explains them); (R54, R60, T47) at PR #33's head a declared act and a library step under its own name (negative control: an unexplained act is named)", () => {
  /* T47 (R54, R60): at PR #33's head the registry and the library carry it under its own name, owed no longer */
  assert.ok(regActs.some((a) => a.op === "escalationstoppursuing" && a.status === "declared"));
  assert.ok(!regActs.some((a) => a.op.startsWith("owed:escalationstoppursuing")));
  assert.ok(library.scripts.some((s) => s.versions.some((v) => v.steps.some((st) => st.act === "escalationstoppursuing"))));
  assert.ok(!JSON.stringify(library).includes("owed:escalationstoppursuing"));
  assert.ok(Object.hasOwn(OPS, "escalationstoppursuing") && !Object.hasOwn(OP_ALIASES, "escalationstoppursuing"));
  for (const op of ["escalationstoppursuing", "escalationreopen"]) assert.deepEqual(ground(op), [], op);
  /* negative control */
  assert.deepEqual(ground("stepcreate"), ["unexplained"]);
});

test("R51 (N919; ai-runs R18; K2952, K2976): airundispatch — a member's own act, reached by her session or her own ai credential (classes admin, member, no machineClasses, so an agent's scope reaches it; no probe, no daemon), mutating, a present null NEEDS row, by stamped and nothing carrying a credential, in ai-runs' family (kind memberrun), both session sets; no entry in aiRunsOps serves it — its handler is control-plane's route to AiRuns' dispatchMemberRun (negative control: a session-only act hands an agent nothing)", () => {
  const op = "airundispatch";
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, mutating: true });
  assert.ok(!("machineClasses" in OPS[op]));
  assert.equal(OP_FAMILIES["ai-runs"].kinds[op], "memberrun");
  assert.deepEqual(plain(OP_KINDS.memberrun.spec), { classes: SESSION, mutating: true });
  assert.ok(Object.isFrozen(OP_KINDS.memberrun));
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  for (const f of ["run", "credential", "session", "member", "token", "secretSha", "principal"]) assert.ok(!stamps(op).includes(f), f);
  assert.ok(agentReaches(op), "an agent credential's scope does not reach airundispatch");
  assert.ok(!OPS[op].classes.includes("probe") && !OPS[op].classes.includes("daemon"));
  assert.deepEqual(OP_FAMILIES["ai-runs"].actor, { key: "by", at: "query" });
  assert.deepEqual(listsOf(op), []);
  shared(op);
  assert.ok(!keysOf(aiRunsOps).includes(op), "aiRunsOps serves airundispatch");
  assert.equal(typeof AiRuns.prototype.dispatchMemberRun, "function");
  /* negative control: a member's own act bounded by machineClasses [] hands an agent nothing */
  assert.equal(agentReaches("subscriptionsignin"), false);
});

test("R51 (N654; membership R130): joindoors — an administrator's read for a session only (admin, member; machineClasses []), not mutating, by stamped beside the viewer, a present null, in membership's family, both session sets; membership's map reads by and limit from the query, so a session that is not an administrator's is answered by membership's NOT_AN_ADMIN, as securitymap (negative control: a body by does not reach)", async () => {
  const op = "joindoors";
  assert.equal(OP_FAMILIES.membership.kinds[op], "ownread");
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: false });
  assert.deepEqual(plain(OPS[op]), plain(OPS.securitymap));
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  assert.deepEqual(stamps(op), stamps("securitymap"));
  assert.ok(!stamps(op).includes("limit"));
  assert.deepEqual(machineAdmits(op), []);
  assert.deepEqual(listsOf(op), []);
  shared(op);
  assert.ok(keysOf(membershipOps).includes(op));
  for (const k of ["by", "limit"]) assert.ok(await reaches(membershipOps, op, { query: { [k]: SENT } }), k);
  /* negative control */
  assert.equal(await reaches(membershipOps, op, { body: { by: SENT } }), false);
});

test("R51 (N917; agent-worker R76; K2960): textcheck — declared in agent-worker's family as infractiondraft and bearingdraft are, an ownread (admin, member; machineClasses []), not mutating, a present null, by and viewer stamped and text never a stamp; both session sets, not on AI_GRANT_OPS; its handler is control-plane's door route (negative control: a mutating act differs)", () => {
  const op = "textcheck";
  assert.equal(OP_FAMILIES["agent-worker"].kinds[op], "ownread");
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: false });
  for (const d of ["infractiondraft", "bearingdraft"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS[d]), d);
    assert.equal(NEEDS[op], NEEDS[d], d);
    assert.deepEqual(stamps(op), stamps(d), d);
  }
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  assert.ok(!stamps(op).includes("text"));
  assert.deepEqual(machineAdmits(op), []);
  assert.deepEqual(listsOf(op), []);
  shared(op);
  /* negative control */
  assert.notDeepEqual(plain(OPS[op]), plain(OPS.writinghelp ? { ...OPS.writinghelp, mutating: true } : {}));
});

test("R51 (K2987; action-clocks R20): clockproposals — a read in action-clocks' family declared as its other reads (clocksics, clocklateness), admin, member, probe and no machineClasses, not mutating, viewer stamped, a present null; served by action-clocks' map, which reads the viewer and the action from the query (negative control: another key does not reach)", async () => {
  const op = "clockproposals";
  assert.equal(OP_FAMILIES["action-clocks"].kinds[op], "read");
  for (const r of ["clocksics", "clocklateness"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS[r]), r);
    assert.equal(OP_FAMILIES["action-clocks"].kinds[op], OP_FAMILIES["action-clocks"].kinds[r], r);
  }
  assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false });
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["viewer"]);
  assert.ok(!stamps(op).includes("action"));
  assert.deepEqual(listsOf(op), []);
  shared(op);
  assert.ok(keysOf(actionClocksOps).includes(op));
  for (const k of ["viewer", "action"]) assert.ok(await reaches(actionClocksOps, op, { query: { [k]: SENT } }), k);
  /* negative control */
  assert.equal(await reaches(actionClocksOps, op, { query: { nosuchstamp: SENT } }), false);
});

test("R51, R6: each map of a T46 owner that serves an R51 op is served whole by the tables (plan-work's, escalation's, membership's, action-clocks'), and every R51 op is served by its owner's map or by the L11 route named for it (textcheck and airundispatch by control-plane's door, T46-59) (negative control: an op added to a map without a spec is seen)", () => {
  const MAPS = { "plan-work": planWorkOps, escalation: escalationOps, membership: membershipOps, "action-clocks": actionClocksOps };
  for (const [owner, map] of Object.entries(MAPS)) for (const op of keysOf(map).filter((o) => !["checkaddressees", "projectclaimowner"].includes(o)))
    assert.ok(Object.hasOwn(OPS, op), `${owner}: ${op} has no spec`);
  const SERVED = { statusreportassist: "plan-work", escalationstoppursuing: "escalation", escalationreopen: "escalation",
                   joindoors: "membership", clockproposals: "action-clocks" };
  for (const [op, owner] of Object.entries(SERVED)) assert.ok(keysOf(MAPS[owner]).includes(op), `${op} is not served by ${owner}`);
  const ROUTED = ["textcheck", "airundispatch"];
  for (const op of ROUTED) {
    assert.ok(Object.hasOwn(OPS, op), op);
    assert.ok(!Object.values(MAPS).some((m) => keysOf(m).includes(op)) && !keysOf(aiRunsOps).includes(op), `${op} is served by an owner's map`);
  }
  /* negative control */
  assert.deepEqual([...keysOf(actionClocksOps), "clocknosuch"].filter((op) => !Object.hasOwn(OPS, op)), ["clocknosuch"]);
});

test("R51, R34 (K2996): each R51 op whose text mock-acts.js lacks is named in ACT_HELP_ABSENT — statusreportassist, joindoors and clockproposals under the read ground, airundispatch under the last (an act the design has not yet explained) — and none of them is also explained; textcheck, whose text mock-acts.js holds (affordances R53), is named under no ground; (R54, T47) all four explained in ACT_HELP since affordances' T47 merge and named under no ground (negative control: an explained op is named under no ground)", () => {
  /* T47 (R54; K3152): affordances' T47 job gives ACT_HELP the design's texts for all four, so each leaves its ground */
  for (const op of ["statusreportassist", "joindoors", "clockproposals", "airundispatch"]) {
    assert.ok(SESSION_OPS.member.has(op), op);
    assert.ok(explained(op), `${op} is not explained`);
    assert.deepEqual(ground(op), [], `${op} is explained and named`);
  }
  assert.deepEqual(ground("textcheck"), []);
  for (const [k, g] of Object.entries(ACT_HELP_ABSENT)) assert.deepEqual([...g.ops], [...new Set(g.ops)].sort(), k);
  /* negative control */
  assert.deepEqual(ground("setpassword"), []);
});

test("R51, R5, R7: t46.mjs is frozen data — each share names an owner whose family exists and kinds of OP_KINDS, its ops in that family and in no other, every extra on an op of its share — and names no place (negative control: a kind outside OP_KINDS is seen)", () => {
  assert.ok(Object.isFrozen(T46_SHARES));
  assert.deepEqual(Object.keys(T46_SHARES).sort(), ["action-clocks", "agent-worker", "ai-runs", "instance-setup", "membership", "plan-work"]);
  for (const [owner, s] of Object.entries(T46_SHARES)) {
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.ops), owner);
    assert.ok(Object.hasOwn(OP_FAMILIES, owner), `${owner}: no family`);
    assert.ok(typeof s.cite === "string" && /R5[01]/.test(s.cite), owner);
    for (const [op, k] of Object.entries(s.ops)) {
      assert.ok(Object.hasOwn(OP_KINDS, k), `${op}: ${k}`);
      assert.equal(OP_FAMILIES[owner].kinds[op], k, op);
      assert.deepEqual(familyOf(op), [owner], op);
    }
    for (const op of Object.keys(s.extra ?? {})) {
      assert.ok(Object.hasOwn(s.ops, op), `${owner}: an extra on ${op}`);
      assert.ok(Object.isFrozen(s.extra[op]), op);
    }
  }
  assert.doesNotMatch(JSON.stringify(T46_SHARES), /oakland|alameda|california|city of|county of/i);
  /* negative control */
  assert.ok(!Object.hasOwn(OP_KINDS, "nosuchkind"));
});

/* ---------- R52 ---------- */

test("R52 (N937; DEC-194, DEC-197; wizard-scripts R29): R21 read against the registry as PR #28 merged it — its function acts are 80, each an op or an alias; the nine new since PR #19 name declared ops by their own names, no alias; knock is no function act; every owed act (itemtakeup, actionscope, filingsecondapprove, subscriptionsignin, projectaikeepaway, infolevelset, escalationstoppursuing) is declared under its own name and no other owed act exists; Your account no longer lists handlechange, and its setpassword and memberlanguageset are declared acts; (R54, R60, T47) re-pinned at PR #33's head: 89 function acts, the seven declared acts, passwordresetlink the one owed (negative control: an undeclared owed act is seen)", () => {
  const fnActs = regActs.filter((a) => a.status === "function");
  /* T47 (R54, R60): re-pinned at PR #33's head, whose screens carry 89 function acts (67 distinct functions).
     T48 (R65; N1054): re-pinned at PR #34's merge (`4664e8efd4`), whose screens carry 88 (the Home redrawn by DEC-218
     drew one of them away); every alias still names a function act of the file.
     T49 (K3321 (B), K3393; R21): the count is read from the registry, never pinned (K3268): every function act the file
     names is an op or an alias, below */
  assert.ok(fnActs.length > 0, `${fnActs.length} function acts`);
  for (const a of fnActs) assert.ok(Object.hasOwn(OPS, a.op), `${a.op}: no spec`);
  for (const al of Object.keys(OP_ALIASES)) assert.ok(fnActs.some((a) => a.op === al), `${al}: an alias of no registry function`);
  const NEW = ["ailimitset", "archivelist", "exploreapprove", "projectaccountremove", "projectaccountswitch",
               "projectkeynoticeseen", "projectkeyset", "projectsigninset", "startfrom"];
  for (const op of NEW) {
    assert.ok(fnActs.some((a) => a.op === op), `${op} is no function act`);
    assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
  }
  assert.ok(!fnActs.some((a) => a.op === "knock"));
  const OWED = ["itemtakeup", "actionscope", "filingsecondapprove", "subscriptionsignin", "projectaikeepaway", "infolevelset",
                "escalationstoppursuing"];
  const owed = owedOf(regActs);
  /* T47 (R54, R60): at PR #33's head the seven are `declared` acts under their own names, and the one owed act is
     R57's passwordresetlink (DEC-201) */
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
  /* T51 fix round (R21, R80): an owed row an owner declares is read as served, class (a), not as owed (`register-owners.mjs`) */
  const DECLARED_NOW = Object.values(REGISTERED).flatMap((rows) => Object.keys(rows));
  const OWED_HAND = ["passwordresetlink", "updatelater", "updateskip", "updatestart", ...OWED_T49, ...OWED_T50, ...LEFT_OUT, ...BROWSER];
  assert.deepEqual([...owed].filter((o) => !DECLARED_NOW.includes(o)).sort(), OWED_HAND.filter((o) => !DECLARED_NOW.includes(o)).sort());   // T48 (R65, R66): DEC-226's three, declared by R66
  for (const op of OWED) assert.ok(regActs.some((a) => a.op === op && a.status === "declared"), `${op} is not a declared act`);
  for (const op of [...OWED, ...owed].filter((o) => !OWED_T49.includes(o) && !LEFT_OUT.includes(o) && !BROWSER.includes(o) && !DECLARED_NOW.includes(o)))
    assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op) && SESSION_OPS.member.has(op), op);
  /* R80: an owed act an owner declares is that op, in a session set unless its declaration makes it public */
  for (const op of owed.filter((o) => DECLARED_NOW.includes(o) && !BROWSER.includes(o) && !OWED_T49.includes(o))) {
    assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op), op);
    assert.equal(SESSION_OPS.member.has(op), OPS[op].classes !== null, op);
  }
  for (const op of OWED_T49) assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op) && SESSION_OPS.admin.has(op) && !SESSION_OPS.member.has(op), op);
  for (const op of LEFT_OUT) assert.ok(!Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op), `${op}: left out and declared`);
  for (const op of OWED_T50) assert.ok(Object.hasOwn(OPS, op) && !Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op) && SESSION_OPS.member.has(op), `${op}: owed and undeclared`);
  const account = registry.screens.find((s) => s.id === "account");
  assert.ok(account, "no account screen");
  assert.ok(!account.acts.some((a) => a.op === "handlechange" || a.op.startsWith("owed:handlechange")));
  for (const op of ["setpassword", "memberlanguageset"])
    assert.ok(account.acts.some((a) => a.op === op && a.status === "declared") && Object.hasOwn(OPS, op), op);
  /* negative control */
  assert.deepEqual([...owed, "nosuchowedact"].filter((op) => !Object.hasOwn(OPS, op) && !LEFT_OUT.includes(op) && !BROWSER.includes(op)), ["nosuchowedact"]);
});

test("R52 (wizard-scripts R30): R27 read against the library as PR #28 merged it — its owed acts are four, actionscope, itemtakeup, escalationstoppursuing and subscriptionsignin, each declared under its own name in both session sets with no alias; (R54, R60, T47) at PR #33's head none owed, the four named by their ops (negative control: an undeclared act is in no table)", () => {
  const owed = [...new Set([...JSON.stringify(library).matchAll(/owed:([a-z]+)/g)].map((m) => m[1]))];
  /* T47 (R54, R60): at PR #33's head the library marks no act owed; the four are named by their ops. T48 (R65): at PR
     #34's merge its update wizard marks one, `updatestart` (DEC-226), declared by R66 */
  assert.deepEqual(owed.sort(), ["updatestart"]);
  assert.ok(Object.hasOwn(OPS, "updatestart") && both("updatestart"));
  const named = new Set(library.scripts.flatMap((s) => s.versions.flatMap((v) => v.steps.map((st) => st.act))));
  const FOUR = ["actionscope", "escalationstoppursuing", "itemtakeup", "subscriptionsignin"];
  for (const op of FOUR) assert.ok(named.has(op), `${op}: the library does not name it`);
  for (const op of FOUR) assert.ok(Object.hasOwn(OPS, op) && both(op) && !Object.hasOwn(OP_ALIASES, op), op);
  /* negative control */
  assert.ok(inNoTable("nosuchowedact"));
});

/* ---------- R53 ---------- */

test("R53 (N934; DEC-197; membership R129): handlechange keeps R42's spec — in SESSION_OPS.member, a member's session only (admin, member; machineClasses []), mutating, a present null, by stamped and handle never a stamp — served by membership's map, by from the query and handle from the body; no screen offers it (R52), and R34 reads it as explained by affordances' ACT_HELP, so it is in no ground of ACT_HELP_ABSENT, never both (negative control: a body by does not reach)", async () => {
  const op = "handlechange";
  assert.equal(OP_FAMILIES.membership.kinds[op], "own");
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: true });
  assert.ok(SESSION_OPS.member.has(op) && both(op));
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null);
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  assert.ok(!stamps(op).includes("handle"));
  assert.deepEqual(machineAdmits(op), []);
  assert.ok(!AI_GRANT_OPS.includes(op) && !GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op));
  assert.ok(keysOf(membershipOps).includes(op));
  assert.ok(await reaches(membershipOps, op, { query: { by: SENT } }));
  assert.ok(await reaches(membershipOps, op, { body: { handle: SENT } }));
  assert.ok(!regActs.some((a) => a.op === op || a.op.startsWith(`owed:${op} `)), "a screen offers handlechange");
  assert.equal(explained(op), true, "handlechange has no ACT_HELP text");
  assert.deepEqual(ground(op), []);
  /* negative control */
  assert.equal(await reaches(membershipOps, op, { body: { by: SENT } }), false);
});

/* ---------- K3011: frontier in both session sets ---------- */

test("R3, R34 (T46; K3011): frontier — REC-93's read (admin, member, probe; not mutating) — is in both SESSION_OPS.member and SESSION_OPS.admin as search and findin are, so the act gate answers session; as a read it needs no NEEDS row (search's shape) and is in no act list; it is explained by affordances' ACT_HELP and so named under no ground of ACT_HELP_ABSENT (negative control: a read no session reaches is in neither set)", () => {
  assert.deepEqual(plain(OPS.frontier), { classes: MP, mutating: false });
  for (const op of ["frontier", "search", "findin"]) assert.ok(both(op), `${op}: not in both session sets`);
  assert.equal(ACT_GATE.mode("frontier"), "session");
  assert.ok(!Object.hasOwn(NEEDS, "frontier") && !Object.hasOwn(NEEDS, "search"));
  assert.equal(ACT_GATE.needs("frontier"), null);
  assert.ok(!Object.hasOwn(OP_STAMPS, "frontier"));
  assert.deepEqual(listsOf("frontier"), []);
  assert.equal(explained("frontier"), true, "frontier has no ACT_HELP text");
  assert.deepEqual(ground("frontier"), []);
  /* negative control: an operator's read reached by no session is in neither set */
  assert.ok(!SESSION_OPS.member.has("registeraudit") && !SESSION_OPS.admin.has("registeraudit"));
});
