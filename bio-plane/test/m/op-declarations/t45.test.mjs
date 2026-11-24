/* op-declarations R49 and R2–R6, R34 over it (T45; the Actions fold, N893; K2780, K2781, K2787, K2817, K2820, K2824,
   K2834, K2839, K2874): every op T45's owners serve, declared in its owner's family from `t45.mjs` — each spec, NEEDS row,
   session set, stamp and list compared whole at the exported tables, each stamp driven through its owner's own ops map
   (so a stamp named at a site the owner does not read is seen), and each owner's map checked whole against the tables.
   Each comparison has a negative control (K874). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import * as T45 from "../../../src/op-declarations/t45.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { answersOps } from "../../../src/answers/ops.mjs";
import { dutiesOps } from "../../../src/duties/index.mjs";
import { readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";
import { planWorkOps } from "../../../src/plan-work/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { conformanceOps } from "../../../src/conformance/index.mjs";
import { consequencesOps } from "../../../src/consequences/index.mjs";
import { caseCheckOps } from "../../../src/case-check/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
import { localFactsOps } from "../../../src/local-facts/index.mjs";
import { caseAccountOps } from "../../../src/case-account/index.mjs";
import { T46_SHARES } from "../../../src/op-declarations/t46.mjs";
import { T47_SHARES } from "../../../src/op-declarations/t47.mjs";
import { T48_SHARES } from "../../../src/op-declarations/t48.mjs";
import { T49_SHARES } from "../../../src/op-declarations/t49.mjs";
import { T50_SHARES } from "../../../src/op-declarations/t50.mjs";
import { T51_SHARES } from "../../../src/op-declarations/t51.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_KINDS, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, PLAN_RUN_SCOPE } = O;
const MP = ["admin", "member", "probe"];
const SESSION = { classes: ["admin", "member"], machineClasses: [] };
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", PLAN_RUN_SCOPE.writes]]);
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* the kinds a T45 op takes (R49; `OP_KINDS`) */
const KIND = {
  member: { spec: { ...SESSION, mutating: true }, needs: "contribute" },      // an act its owner refuses a machine by name
  own: { spec: { ...SESSION, mutating: true }, needs: null },                 // a member's own setting or to-do
  admin: { spec: { ...SESSION, mutating: true }, needs: null },               // an administrator's act (NOT_AN_ADMIN)
  owners: { spec: { classes: MP, mutating: true }, needs: null },             // a project setting, projectvisibilityset's
  proposal: { spec: { classes: MP, mutating: true }, needs: "contribute" },   // any credential's, labelled
  publishgate: { spec: { classes: MP, mutating: true }, needs: "publish" },   // publish's spec and capability
  read: { spec: { classes: MP, mutating: false }, needs: null },              // a read by the caller's sight
  ownread: { spec: { ...SESSION, mutating: false }, needs: null },            // a session's read
};

/* every op R49 declares: [family, kind, stamps] */
const A = (fam) => [fam, "member", ["author", "viewer"]];
const B = (fam) => [fam, "member", ["by", "viewer"]];
const R = (fam) => [fam, "read", ["viewer"]];
const R49 = {
  /* following R22–R25 */
  followend: B("following"), watchlink: B("following"), watchanswer: B("following"), watchquestions: R("following"),
  /* answers R34: its actor is the stamped viewer */
  standingendset: ["answers", "own", ["viewer"]],
  /* duties R30, R31 */
  dutyfromresponse: ["duties", "proposal", ["by", "viewer"]], dutiesarising: R("duties"),
  /* reading-guides R13 */
  procedureguides: R("reading-guides"),
  /* actions R80, R87, R88, R92 */
  actionreceipt: A("actions"), actionscope: A("actions"), actionpromise: A("actions"), openitemswith: R("actions"),
  /* action-clocks R18 */
  clockstate: A("action-clocks"),
  /* action-holds R11, R12 */
  holdnoticesent: A("action-holds"), pressurerecord: A("action-holds"),
  /* action-replies R1, R2, R4 */
  actionreplybearing: A("action-replies"), actionbearingpropose: ["action-replies", "proposal", ["proposer", "viewer"]],
  arosefrom: A("action-replies"),
  /* action-plans R39, R40 */
  scenariosetaside: A("action-plans"), scenariorestore: A("action-plans"), planpause: A("action-plans"),
  planresume: A("action-plans"),
  /* plan-work R1–R8, R11, R13 */
  matteroutcomeset: A("plan-work"), planreviewrecord: A("plan-work"), prepitemadd: A("plan-work"),
  prepitemdone: A("plan-work"), plancomment: A("plan-work"), statusreportsave: A("plan-work"),
  planreviewrhythm: ["plan-work", "own", ["author", "viewer"]], prepitemtakeup: ["plan-work", "own", ["author", "viewer"]],
  itemtakeup: ["plan-work", "own", ["author", "viewer"]],
  matters: R("plan-work"), plantimeline: R("plan-work"), planreviewopen: R("plan-work"), planreviews: R("plan-work"),
  prepitems: R("plan-work"), plancomments: R("plan-work"), whereitstands: R("plan-work"),
  statusreportdraft: R("plan-work"), statusreports: R("plan-work"), matterpromiseduties: R("plan-work"),
  /* filings R36, R41, R42, R47 */
  filingsecondapprove: A("filings"), jointsignatory: A("filings"),
  holdnoticeprepare: ["filings", "proposal", ["author", "viewer"]], templatesforaction: R("filings"),
  /* conformance R36, R37 */
  curelink: A("conformance"), cureunlink: A("conformance"), cures: R("conformance"),
  /* consequences R17–R23 */
  successrecord: A("consequences"), successrevise: A("consequences"), outcomecarry: A("consequences"),
  successread: R("consequences"), successrecords: R("consequences"),
  /* case-check R1, R2 */
  publishcheck: ["case-check", "publishgate", ["author", "viewer"]], casecheck: R("case-check"),
  /* project-roster R21, R24 */
  projectscopeset: ["project-roster", "owners", ["by", "viewer"]], projectapprovalset: ["project-roster", "owners", ["by", "viewer"]],
  /* local-facts R10–R13 */
  ruledraft: ["local-facts", "member", ["bodyBy", "viewer"]], ruleconfirm: ["local-facts", "member", ["bodyBy", "viewer"]],
  rulewithdraw: ["local-facts", "member", ["bodyBy", "viewer"]], ruleoffer: ["local-facts", "ownread", ["viewer"]],
  grouprules: ["local-facts", "ownread", ["viewer"]],
  /* case-account R13 (K2834) */
  advocacycheck: B("case-account"), advocacychecks: ["case-account", "ownread", ["viewer"]],
  /* agent-worker R76, R77 (K2824, K2881): the two drafts, as writinghelp */
  infractiondraft: ["agent-worker", "ownread", ["by", "viewer"]], bearingdraft: ["agent-worker", "ownread", ["by", "viewer"]],
  /* instance-setup R77 */
  declaredstakeset: ["instance-setup", "admin", ["by", "viewer"]],
};
/* each owner's map, and the ops no owner's map serves yet with the job that builds their arm (R6 holds at L11's close).
   T46 (N935): local-facts' map serves `grouprules` (its R12) and case-account's map, `caseAccountOps`, serves R13's two
   (its R15), so neither is named for the plane any longer. */
/* T48 (actions R103): the plane spreads `actionRecordsOps` beside `actionsOps`; `actionreceipt`, `actionscope` and
   `actionpromise` moved to action-records and are served by the pair */
const actionsPair = (a, url, body, ...rest) => ({ ...actionsOps(a, url, body, ...rest), ...actionRecordsOps(a, url, body, ...rest) });
const MAPS = { following: followingOps, answers: answersOps, duties: dutiesOps, "reading-guides": readingGuidesOps,
  actions: actionsPair, "action-clocks": actionClocksOps, "action-holds": actionHoldsOps, "action-replies": actionRepliesOps,
  "action-plans": actionPlansOps, "plan-work": planWorkOps, filings: filingsOps, conformance: conformanceOps,
  consequences: consequencesOps, "case-check": caseCheckOps, "project-roster": projectRosterOps, "local-facts": localFactsOps,
  "case-account": caseAccountOps };
const SERVED_ELSEWHERE = { infractiondraft: "plane (T45-47)", bearingdraft: "plane (T45-47)",
                           declaredstakeset: "instance-setup (T45-44)" };

/* An owner's map over a service that records each method it is called with and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  /* each name answers a method that records its call, and a nested service (case-check's `c.caseAuthoring.…`) too */
  const member = (k) => new Proxy(function () {}, {
    apply: (_, __, args) => { calls.push([k, args]); return { ok: true }; },
    get: (_, j) => (j === "then" ? undefined : member(`${String(k)}.${String(j)}`)) });
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : member(k)) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const keysOf = (mapFn) => {
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
  return Object.keys(mapFn(svc, new URL("http://plane/"), {}, svc, svc));
};
const SENT = "member:sentinel-45";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);

const holds = (op, [fam, kind, st]) => {
  assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
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
  /* a family op's stamps are its family's (OP_STAMPS), never an act list's; procedureguides is also in the run's scope */
  assert.deepEqual(listsOf(op), op === "procedureguides" ? ["PLAN_RUN_SCOPE.reads"] : [], `${op} is in ${listsOf(op)}`);
  if (Array.isArray(OPS[op].machineClasses)) assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
};

test("R49, R2, R3: every op T45's owners serve has the spec, NEEDS row, stamps and session sets its kind gives — a member's act refused a machine by name a session's only and contribute; a member's own setting or to-do and an administrator's act a session's only, a present null; a project setting projectvisibilityset's (admin, member, probe; null); a labelled proposal any credential's, contribute; the held check publish's; a read admin, member, probe or a session's, a present null — each in its owner's family, in neither bearer fence, not on AI_GRANT_OPS, in no act list (negative control: a drifted spec or kind is seen)", () => {
  assert.equal(Object.keys(R49).length, 67);
  for (const [op, want] of Object.entries(R49)) holds(op, want);
  /* the owners' predicate's posture is projectvisibilityset's own */
  for (const op of ["projectscopeset", "projectapprovalset"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS.projectvisibilityset), op);
    assert.equal(NEEDS[op], NEEDS.projectvisibilityset, op);
  }
  /* a labelled proposal is any credential's, as templatepropose and whatchangedpropose are */
  for (const op of ["dutyfromresponse", "actionbearingpropose", "holdnoticeprepare"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS.templatepropose), op);
    assert.deepEqual(machineAdmits(op), MP, op);
  }
  /* the held check is gated as publish is (case-check R1, graded as publishing) */
  assert.deepEqual(plain(OPS.publishcheck), plain(OPS.publish));
  assert.equal(NEEDS.publishcheck, NEEDS.publish);
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.curelink, machineClasses: undefined }), KIND.member.spec);
  assert.notDeepEqual(plain({ ...OPS.cures, mutating: true }), KIND.read.spec);
  assert.notEqual(OP_FAMILIES["plan-work"].kinds.planreviewrhythm, "member");
});

test("R49, R4: each T45 stamp reaches its owner where the owner reads it, through the owner's own map — author or by from the query, local-facts' by from the body, the proposer's key on a proposal, the viewer on every read — and a key the owner does not read does not reach (negative control); a body copy of a query-stamped actor is not the actor", async () => {
  let driven = 0;
  for (const [op, [fam, , st]] of Object.entries(R49)) {
    const map = MAPS[fam];
    if (!map || Object.hasOwn(SERVED_ELSEWHERE, op)) continue;   /* no arm yet: its builder drives it */
    for (const k of st) {
      if (k === "viewer" && OPS[op].mutating && st.length > 1) continue;   /* an act's actor is its own key */
      const where = k === "bodyBy" ? { body: { by: SENT } } : { query: { [k]: SENT } };
      assert.ok(await reaches(map, op, where), `${op}: ${k} does not reach ${fam}`);
      driven++;
    }
    assert.equal(await reaches(map, op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  /* T46 (N935): 64, with grouprules' viewer and case-account's by and viewer, driven through their own maps now */
  assert.equal(driven, 64, `${driven} stamps driven`);
  /* local-facts' acts take by from the body: a query by does not reach it (the door overwrites the body's) */
  assert.equal(await reaches(localFactsOps, "ruledraft", { query: { by: SENT } }), false);
  /* a query-stamped actor is not taken from the body */
  for (const [map, op, k] of [[followingOps, "followend", "by"], [actionsPair, "actionscope", "author"],
                              [planWorkOps, "matteroutcomeset", "author"], [conformanceOps, "curelink", "author"]])
    assert.equal((await drive(map, op, { body: { [k]: SENT }, query: { [k]: "member:real" } })).includes(SENT), false, op);
});

test("R49, R6: each T45 owner's map is served whole by the tables — every op it serves to a caller has a spec (negative control: an op added to the map without a spec is seen) — and every R49 op is served by its owner's map or named for the L11 job that builds its arm (the two drafts by the plane, declaredstakeset by instance-setup; since T46 grouprules by local-facts' map and case-account's two by caseAccountOps, N935)", () => {
  for (const [fam, map] of Object.entries(MAPS))
    for (const op of keysOf(map)) assert.ok(Object.hasOwn(OPS, op), `${fam}: ${op} has no spec`);
  for (const [op, [fam]] of Object.entries(R49)) {
    if (Object.hasOwn(SERVED_ELSEWHERE, op)) {
      assert.ok(!MAPS[fam] || !keysOf(MAPS[fam]).includes(op), `${op} is served now: drop it from SERVED_ELSEWHERE`);
      continue;
    }
    assert.ok(keysOf(MAPS[fam]).includes(op), `${op} is not served by ${fam}`);
  }
  /* the families T45 adds hold exactly the ops their maps serve beyond earlier declarations */
  for (const op of ["grouprules", "advocacycheck", "advocacychecks"]) assert.ok(!Object.hasOwn(SERVED_ELSEWHERE, op), op);
  assert.deepEqual(keysOf(caseAccountOps).sort(), ["advocacycheck", "advocacychecks"]);
  for (const f of T45.T45_FAMILIES) for (const op of Object.keys(f.ops))
    assert.ok(Object.hasOwn(SERVED_ELSEWHERE, op) || keysOf(MAPS[f.owner]).includes(op), `${f.owner}: ${op}`);
  /* negative control */
  assert.deepEqual([...keysOf(planWorkOps), "planworkdelete"].filter((op) => !Object.hasOwn(OPS, op)), ["planworkdelete"]);
});

test("R49, R4, R12 (K2781 (1)): the pressure mark and the hold's acts and reads moved with their owner to action-holds' lists — ACTION_HOLDS_ACTIONS and ACTION_HOLDS_READS — their specs, rows, stamps and places in the composed lists unchanged, and action-holds' map serves each; actions' lists keep only what actions serves (negative control: a hold op in actions' lists is seen)", () => {
  assert.deepEqual([...O.ACTION_HOLDS_ACTIONS], ["actionpressure", "actionhold", "actionholdrelease"]);
  assert.deepEqual([...O.ACTION_HOLDS_READS], ["actionholdpreview", "projectholds"]);
  assert.deepEqual([...O.ACTIONS_ACTIONS], ["actioncreate"]);
  assert.deepEqual([...O.ACTIONS_READS], ["action", "actions"]);
  const holdsMap = keysOf(actionHoldsOps);
  for (const op of [...O.ACTION_HOLDS_ACTIONS, ...O.ACTION_HOLDS_READS]) {
    assert.ok(holdsMap.includes(op), `${op} is not served by action-holds`);
    assert.ok(!keysOf(actionsOps).includes(op), `${op} is still served by actions`);
    assert.ok(O.ACTION_HOLDS_ACTIONS.includes(op) ? O.QUERY_AUTHOR_ACTIONS.includes(op) && O.ACTION_LAYER_ACTIONS.includes(op)
      : O.ACTION_LAYER_READS.includes(op), op);
    assert.ok(both(op), op);
  }
  for (const op of [...O.ACTIONS_ACTIONS, ...O.ACTIONS_READS]) assert.ok(keysOf(actionsOps).includes(op), op);
  /* negative control */
  assert.ok(!O.ACTIONS_ACTIONS.includes("actionhold"));
});

test("R49, R2, R4 (K2820, K2824; agent-worker R78): a planning run's agent credential reads action, reading and procedureguides — each a read admitting member with no machineClasses, so its scope reaches it (negative control: a session's read is not reachable so)", () => {
  for (const op of ["action", "reading", "procedureguides"]) {
    assert.ok(PLAN_RUN_SCOPE.reads.includes(op), op);
    assert.equal(OPS[op].mutating, false, op);
    assert.ok(OPS[op].classes.includes("member") && !("machineClasses" in OPS[op]), op);
  }
  assert.ok(!PLAN_RUN_SCOPE.writes.some((op) => Object.hasOwn(R49, op)));
  /* negative control */
  assert.ok("machineClasses" in OPS.ruleoffer);
});

test("R49, R5, R7, R51: t45.mjs is frozen data — each share names an owner whose family exists, each family an owner no other names, every kind one of OP_KINDS — and the new kinds owners and publishgate are frozen; the drafts infractiondraft and bearingdraft are as writinghelp (K2881); textcheck, which no handler served in T45 (N917), is declared since T46 in agent-worker's family as the two drafts are (R51; t46.test.mjs) (negative control: a kind outside OP_KINDS is seen)", () => {
  assert.ok(Object.isFrozen(T45.T45_SHARES) && Object.isFrozen(T45.T45_FAMILIES));
  const BASE = Object.keys(OP_FAMILIES).filter((o) => !T45.T45_FAMILIES.some((f) => f.owner === o));
  for (const [owner, s] of Object.entries(T45.T45_SHARES)) {
    assert.ok(BASE.includes(owner), `${owner}: a share with no family`);
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.ops), owner);
    for (const [op, k] of Object.entries(s.ops)) {
      assert.ok(Object.hasOwn(OP_KINDS, k), `${op}: ${k}`);
      assert.equal(OP_FAMILIES[owner].kinds[op], k, op);
    }
  }
  for (const f of T45.T45_FAMILIES) {
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.ops) && Object.isFrozen(f.actor), f.owner);
    assert.ok(!BASE.includes(f.owner), `${f.owner} has a family already`);
    /* T46 (R50, R51): a family T45 gave an owner also holds that owner's T46 share (`t46.mjs`), and T47 (R55) its T47
       share (`t47.mjs`: project-roster's `projectlist`), and T48 (R64, R67) its T48 share (`t48.mjs`: action-holds'
       `pressurefor`, action-replies' `actionreplyquoting`, action-plans' `planask`, filings' `filingread`), and T49 (R72) its T49 share
       (`t49.mjs`: project-roster's `projectownervotes`), and T50 (R73) its T50 share (`t50.mjs`: filings' `stakeatpreparation`,
       project-roster's three), and T51 (R77–R79) its T51 share (`t51.mjs`: action-holds' `holdsdue`, local-facts' `rulefields`,
       action-clocks' `clocksrunning`, filings' `approvedunsent`, action-plans' `checkpointsdue`, project-roster's
       `projectinvitations`) */
    assert.deepEqual(plain(OP_FAMILIES[f.owner].kinds),
      plain({ ...f.ops, ...(T46_SHARES[f.owner]?.ops ?? {}), ...(T47_SHARES[f.owner]?.ops ?? {}), ...(T48_SHARES[f.owner]?.ops ?? {}), ...(T49_SHARES[f.owner]?.ops ?? {}), ...(T50_SHARES[f.owner]?.ops ?? {}), ...(T51_SHARES[f.owner]?.ops ?? {}) }), f.owner);
  }
  for (const k of ["owners", "publishgate"]) assert.ok(Object.isFrozen(OP_KINDS[k]), k);
  for (const op of ["infractiondraft", "bearingdraft"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS.writinghelp), op);
    assert.equal(NEEDS[op], NEEDS.writinghelp, op);
    assert.deepEqual(stamps(op), stamps("writinghelp"), op);
  }
  assert.ok(!Object.values(T45.T45_FAMILIES).some((f) => Object.hasOwn(f.ops, "textcheck")), "textcheck is a T45 op");
  assert.deepEqual(plain(OPS.textcheck), plain(OPS.infractiondraft));
  assert.deepEqual(stamps("textcheck"), stamps("infractiondraft"));
  assert.deepEqual(familyOf("textcheck"), ["agent-worker"]);
  assert.doesNotMatch(JSON.stringify([T45.T45_SHARES, T45.T45_FAMILIES]), /oakland|alameda|california|city of|county of/i);
  /* negative control */
  assert.ok(!Object.hasOwn(OP_KINDS, "nosuchkind"));
});

test("R34, R49: every member op T45 declares is explained in affordances' ACT_HELP or named under one ground of ACT_HELP_ABSENT, never both — the reads under the read ground, the acts under the last (an act the design has not yet explained) (negative control: an unnamed op is seen)", () => {
  const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
    for (const op of Object.keys(R49)) {
    assert.ok(SESSION_OPS.member.has(op), op);
    if (explained(op)) { assert.deepEqual(ground(op), [], `${op} is explained and named`); continue; }
    assert.deepEqual(ground(op), [OPS[op].mutating ? "unexplained" : "read"], op);
  }
  /* negative control */
  assert.deepEqual(ground("nosuchop"), []);
});
