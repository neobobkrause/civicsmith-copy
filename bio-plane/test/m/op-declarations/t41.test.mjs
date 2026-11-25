/* op-declarations R41–R43, R45, R46 and R34, R6 over them (T41-58; N812, N797, N799, N820, N823; DEC-184, DEC-186,
   DEC-188; K2373, K2435, K2457, K2484, K2486, K2496, K2525, K2529, K2554, K2560, K2561, K2569, K2570, K2574): T41's
   ops — a project's account and the one switch act (credentials), the limits and usage (ai-use), the handle (membership),
   the investigation's ops (steps, question-explorer, investigation, hypotheses, inquiry, run-productions,
   reading-guides, leg-earning, case-authoring (case-account since T42, R48), review, ai-runs, actions), the upload (capture) — and the retirements.
   Each spec, row, session set, stamp and list is compared whole at the exported tables; each stamp whose owner exports a
   map is driven through that map, so a stamp named at a site the owner does not read is seen. Each comparison has a
   negative control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { inquiryOps } from "../../../src/inquiry/index.mjs";
import { runProductionsOps } from "../../../src/run-productions/index.mjs";
import { readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
import { provenanceOps } from "../../../src/provenance/ops.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";

/* T48 (actions R103): the plane spreads `actionRecordsOps` beside `actionsOps`; the ops that moved to action-records
   (`actionseekspropose` among them) are served by the pair */
const actionsPair = (a, url, body, ...rest) => ({ ...actionsOps(a, url, body, ...rest), ...actionRecordsOps(a, url, body, ...rest) });
const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_KINDS, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, PLAN_RUN_SCOPE } = O;
const MP = ["admin", "member", "probe"];
const SESSION = { classes: ["admin", "member"], machineClasses: [] };
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const neither = (op) => !SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", PLAN_RUN_SCOPE.writes]]);
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && neither(op) && !Object.hasOwn(OP_STAMPS, op)
  && !LISTS.some(([, l]) => l.includes(op)) && !Object.hasOwn(UNATTENDED_BY_DECISION, op) && !O.FAMILY_OPS.includes(op);
const familyOf = (op) => Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op))?.owner ?? null;
const keysOf = (mapFn) => Object.keys(mapFn({}, new URL("http://plane/"), {}, {}, {}));
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* An owner's map over a service that records each method it is called with and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const SENT = "member:sentinel-41";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);

/* the kinds a T41 op takes, as R41–R43 and R45 state them (`OP_KINDS`): */
const KIND = {
  own: { spec: { ...SESSION, mutating: true }, needs: null },                   // a member's or owner's own act
  admin: { spec: { ...SESSION, mutating: true }, needs: null },                 // an administrator's own act
  member: { spec: { ...SESSION, mutating: true }, needs: "contribute" },        // an act of record, a session's only
  sessionrunact: { spec: { ...SESSION, mutating: true }, needs: "contribute" }, // the same, stamped as a run's caller
  ownread: { spec: { ...SESSION, mutating: false }, needs: null },              // a session's read
  runact: { spec: { classes: MP, mutating: true }, needs: "contribute" },       // a run's act, as extractpropose
  proposal: { spec: { classes: MP, mutating: true }, needs: "contribute" },     // any credential's, labelled
  publicread: { spec: { classes: null, mutating: false }, needs: null },        // public, a present null row
};

/* every op T41 declares, by requirement: [family, kind, stamps] */
/* T48 (R68): the project-account ops and the uses and history reads are ai-accounts' family now */
const R41 = {
  projectkeyset: ["ai-accounts", "own", ["by", "viewer"]], projectsigninset: ["ai-accounts", "own", ["by", "viewer"]],
  projectaccountremove: ["ai-accounts", "own", ["by", "viewer"]], projectaccountswitch: ["ai-accounts", "own", ["by", "viewer"]],
  projectaccountstate: ["ai-accounts", "ownread", ["viewer"]], projectkeynotice: ["ai-accounts", "ownread", ["viewer"]],
  projectkeynoticeseen: ["ai-accounts", "own", ["by", "viewer"]], projectaikeepaway: ["ai-accounts", "own", ["by", "viewer"]],
  projectaikeepawaystate: ["ai-accounts", "ownread", ["viewer"]], accountusesset: ["ai-accounts", "own", ["by", "viewer"]],
  accountuses: ["ai-accounts", "ownread", ["viewer"]], accounthistory: ["ai-accounts", "ownread", ["viewer"]],
  ailimitset: ["ai-use", "own", ["by", "viewer"]], ailimits: ["ai-use", "ownread", ["viewer"]],
  aiusage: ["ai-use", "ownread", ["viewer"]], exploreapprove: ["ai-use", "own", ["by", "viewer"]],
};
const R42 = { handlecheck: ["membership", "publicread", ["viewer"]], handlechange: ["membership", "own", ["by", "viewer"]] };
const ACT = (fam) => [fam, "member", ["by", "viewer"]];
const OWN = (fam) => [fam, "own", ["by", "viewer"]];
const READ = (fam) => [fam, "ownread", ["viewer"]];
const BODYACT = (fam) => [fam, "member", ["bodyBy", "viewer"]];
const R43 = {
  /* steps (R1–R24) and ai-runs' run over steps (its R74) */
  stepcreate: ACT("steps"), stepstart: ACT("steps"), stepend: ACT("steps"), stepdelete: ACT("steps"), steprefer: ACT("steps"),
  stepslike: READ("steps"), stepproduct: ACT("steps"), stepwait: ACT("steps"), stepwaitremove: ACT("steps"),
  stepreminder: OWN("steps"), stepcostadd: ACT("steps"), stepcostremove: ACT("steps"), costmessage: ACT("steps"),
  questionfollow: OWN("steps"), stepaccept: ACT("steps"), stepsrunai: ["ai-runs", "member", ["by", "principal", "viewer"]],
  steps: READ("steps"),
  /* K2570 */
  stepoutcome: ACT("steps"), steplearn: ACT("steps"), stepbywhen: ACT("steps"), stepproposals: READ("steps"),
  costmessages: READ("steps"), questionfollowstate: READ("steps"), stepproducts: READ("steps"), recordsteps: READ("steps"),
  findaccept: ACT("question-explorer"), findmute: OWN("question-explorer"), finddoors: READ("question-explorer"),
  /* investigation (R1–R20; K2560) */
  milestoneset: ACT("investigation"), milestonerevise: ACT("investigation"), milestoneremove: ACT("investigation"),
  milestoneitemremove: ACT("investigation"), milestonereminder: OWN("investigation"), milestones: READ("investigation"),
  reportdraft: READ("investigation"), reportkeep: ACT("investigation"), reports: READ("investigation"),
  interviewkeep: ACT("investigation"), interview: READ("investigation"), narrativeclaim: ACT("investigation"),
  claimfindstep: ACT("investigation"), claimfound: ACT("investigation"), planaccept: ACT("investigation"),
  projectwatch: OWN("investigation"), projectclosewithgaps: ACT("investigation"), projectstanding: READ("investigation"),
  claims: READ("investigation"), investigationproposals: READ("investigation"), quietstate: READ("investigation"),
  interviewform: READ("investigation"),
  /* hypotheses (R17–R21; K2486) */
  hypothesistakeup: BODYACT("hypotheses"), hypothesissetaside: BODYACT("hypotheses"), noteshare: BODYACT("hypotheses"),
  noteunshare: BODYACT("hypotheses"), shares: READ("hypotheses"),
  questionwaits: READ("inquiry"), projectsshownon: READ("leg-earning"),
  /* run-productions (R15, R22–R24; K2496) */
  proposalaccept: ACT("run-productions"), bearingnote: ["run-productions", "sessionrunact", ["principal", "viewer"]],
  acceptancecounts: READ("run-productions"), bearingnotes: READ("run-productions"),
  readpages: ["run-productions", "runact", ["principal", "viewer"]],
  /* reading-guides (R2–R8) */
  guidedraft: BODYACT("reading-guides"), guidereview: BODYACT("reading-guides"), guideoffer: BODYACT("reading-guides"),
  guideadopt: BODYACT("reading-guides"), guideretire: BODYACT("reading-guides"), guides: READ("reading-guides"),
  /* K2584 (J1 (1)): reading-guides' map's other five */
  guideproposetocivicsmith: BODYACT("reading-guides"), guidepropose: ["reading-guides", "runact", ["bodyBy", "principal", "viewer"]],
  guidefor: READ("reading-guides"), guide: READ("reading-guides"), guideproposals: READ("reading-guides"),
  accountpropose: ACT("case-account"), accountdrafts: READ("case-account"),
  approvalruleset: ["review", "admin", ["by", "viewer"]], caseapprove: ACT("review"), reviewcomments: READ("review"),
  aiestimate: READ("ai-use"), aiactual: READ("ai-use"),
  grouptestset: ACT("ai-runs"), grouptestresults: READ("ai-runs"),
  /* K2561 */
  actionseekspropose: ["actions", "proposal", ["proposer", "viewer"]],
};
const R45 = { captureupload: ACT("capture") };
const T41 = { ...R41, ...R42, ...R43, ...R45 };

const holds = (op, [fam, kind, st]) => {
  assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
  assert.equal(familyOf(op), fam, `${op}: family`);
  assert.equal(OP_FAMILIES[fam].kinds[op], kind, `${op}: kind`);
  assert.deepEqual(plain(OPS[op]), KIND[kind].spec, `${op}: spec`);
  assert.ok(Object.isFrozen(OPS[op]) && (OPS[op].classes === null || Object.isFrozen(OPS[op].classes)), op);
  assert.ok(Object.hasOwn(NEEDS, op), `${op}: no NEEDS row`);
  assert.equal(NEEDS[op], KIND[kind].needs, `${op}: NEEDS`);
  assert.equal(ACT_GATE.needs(op), KIND[kind].needs, op);
  assert.deepEqual(stamps(op), [...st].sort(), `${op}: stamps`);
  if (KIND[kind].spec.classes === null) assert.ok(neither(op) && ACT_GATE.mode(op) === "machine", `${op}: public in a set`);
  else assert.ok(both(op) && ACT_GATE.mode(op) === "session", `${op}: not in both session sets`);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
  if (Array.isArray(OPS[op].machineClasses)) assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
};

/* ---------- R41 ---------- */

test("R41 (N812; DEC-188; K2373, K2435): the project-account ops, accountusesset, accountuses and accounthistory (credentials) and ailimitset, ailimits, aiusage and exploreapprove (ai-use) — each a session's only (machineClasses []), acts by stamped, reads viewer stamped, a present null row, both session sets, in its owner's family, in neither bearer fence, not on AI_GRANT_OPS (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R41).length, 16);
  for (const [op, want] of Object.entries(R41)) holds(op, want);
  /* every act is mutating and stamped by; every read is not mutating and stamped viewer alone */
  for (const op of Object.keys(R41)) assert.equal(stamps(op).includes("by"), OPS[op].mutating, op);
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.projectkeyset, machineClasses: undefined }), KIND.own.spec);
  assert.notDeepEqual(plain({ ...OPS.ailimits, mutating: true }), KIND.ownread.spec);
});

test("R41, R4, R6: each R41 op is served by its owner's map (ai-accounts', ai-use's), its by reaching the owner from the query and its viewer on the reads; the project's key is the body's only (a query copy does not reach); aiusage reaches both arms, with owner and without (ai-use R4) (negative control: a key the owner does not read does not reach)", async () => {
  const MAP = { "ai-accounts": aiAccountsOps, "ai-use": aiUseOps };
  for (const [op, [fam]] of Object.entries(R41)) {
    assert.ok(keysOf(MAP[fam]).includes(op), `${op} is not served by ${fam}`);
    const st = OPS[op].mutating ? "by" : "viewer";
    assert.ok(await reaches(MAP[fam], op, { query: { [st]: SENT } }), `${op}: ${st} does not reach`);
    assert.equal(await reaches(MAP[fam], op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  assert.ok(await reaches(aiAccountsOps, "projectkeyset", { body: { key: SENT } }));
  assert.equal(await reaches(aiAccountsOps, "projectkeyset", { query: { key: SENT } }), false, "the query's key reaches");
  /* a body copy of by is not the actor (ai-accounts spreads the body, then the stamp) */
  assert.equal((await drive(aiAccountsOps, "accountusesset", { body: { by: SENT }, query: { by: "member:real" } })).includes(SENT), false);
  const mine = await drive(aiUseOps, "aiusage", { query: { viewer: SENT } });
  const owned = await drive(aiUseOps, "aiusage", { query: { viewer: SENT, owner: "group" } });
  assert.ok(mine.includes(SENT) && owned.includes(SENT) && mine !== owned, "aiusage's two arms");
});

test("R41 (DEC-188 (8)): aiceilingset and aicopyceilingset are retired to ailimitset and accountswitchset and groupswitchset to accountusesset — none has a spec or is in any table, and no owner's map serves one (negative control: their successors are declared)", () => {
  for (const op of ["aiceilingset", "aicopyceilingset", "accountswitchset", "groupswitchset"]) {
    assert.ok(inNoTable(op), `${op} is declared`);
    assert.ok(!Object.values(ACT_HELP_ABSENT).some((g) => g.ops.includes(op)), op);
    for (const m of [credentialsOps, aiAccountsOps, aiUseOps, aiRunsOps]) assert.ok(!keysOf(m).includes(op), `${op} is served`);
  }
  /* aiusage moved: ai-use's family, not ai-runs' */
  assert.ok(!Object.hasOwn(OP_FAMILIES["ai-runs"].kinds, "aiusage") && OP_FAMILIES["ai-use"].kinds.aiusage === "ownread");
  for (const op of ["ailimitset", "accountusesset"]) assert.ok(!inNoTable(op), op);
});

/* ---------- R42 ---------- */

test("R42 (N797, N799; DEC-184, DEC-186; K2574): handlecheck public (classes null), not mutating, a present null NEEDS row (as noticespublic's), in no session set, viewer stamped alone, invite and handle the body's only; handlechange a member's session only (machineClasses []), mutating, NEEDS null, by stamped, handle the body's, in SESSION_OPS.member; both membership's (negative control: a query invitation does not reach)", async () => {
  for (const [op, want] of Object.entries(R42)) holds(op, want);
  assert.equal(NEEDS.handlecheck, NEEDS.noticespublic);
  assert.ok(SESSION_OPS.member.has("handlechange"));
  for (const op of Object.keys(R42)) assert.ok(keysOf(membershipOps).includes(op), op);
  for (const k of ["invite", "handle"]) {
    assert.ok(await reaches(membershipOps, "handlecheck", { body: { [k]: SENT } }), `the body's ${k}`);
    assert.equal(await reaches(membershipOps, "handlecheck", { query: { [k]: SENT } }), false, `the query's ${k}`);
  }
  assert.ok(await reaches(membershipOps, "handlecheck", { query: { viewer: SENT } }));
  assert.ok(await reaches(membershipOps, "handlechange", { query: { by: SENT } }));
  assert.ok(await reaches(membershipOps, "handlechange", { body: { handle: SENT } }));
  /* negative control: a body by is not the actor */
  assert.equal(await reaches(membershipOps, "handlechange", { body: { by: SENT } }), false);
});

/* ---------- R43 ---------- */

test("R43 (N820; K2405, K2418, K2486, K2496, K2525, K2529, K2560, K2561, K2569, K2570): every op R43 names has the spec, row, stamps and sets of its kind — a session's only (machineClasses []), acts by stamped (the body's for hypotheses' and reading-guides'), reads viewer stamped — in its owner's family, in neither bearer fence, not on AI_GRANT_OPS, in no act list (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R43).length, 83);
  for (const [op, want] of Object.entries(R43)) holds(op, want);
  /* sessions only: every op but the two R43 declares as another's (readpages as extractpropose, actionseekspropose as
     actionlawspropose) refuses every bearer */
  for (const op of Object.keys(R43).filter((o) => !["readpages", "guidepropose", "actionseekspropose"].includes(o)))
    assert.deepEqual([...OPS[op].machineClasses], [], op);
  /* acts mutate, reads do not */
  for (const op of Object.keys(R43)) assert.equal(stamps(op).includes("viewer") && !OPS[op].mutating, !OPS[op].mutating, op);
  /* negative control */
  assert.notDeepEqual(plain({ ...OPS.stepcreate, machineClasses: undefined }), KIND.member.spec);
});

test("R43 (K2496, K2561): readpages is declared as extractpropose is — its classes, mutating, contribute, the run's principal and the viewer stamped; actionseekspropose as actionlawspropose — any credential, mutating, contribute, both sets, proposer stamped from the caller; each reaches its owner's map where the owner reads it, target and seeks the body's (negative control: a query copy of seeks is overridden)", async () => {
  assert.deepEqual(plain(OPS.readpages), plain(OPS.extractpropose));
  assert.deepEqual(plain(OPS.guidepropose), plain(OPS.extractpropose));
  assert.equal(NEEDS.guidepropose, NEEDS.extractpropose);
  assert.equal(NEEDS.readpages, NEEDS.extractpropose);
  assert.ok(both("readpages") && both("extractpropose"));
  assert.deepEqual(plain(OPS.actionseekspropose), plain(OPS.actionlawspropose));
  assert.equal(NEEDS.actionseekspropose, NEEDS.actionlawspropose);
  assert.ok(both("actionseekspropose") && both("actionlawspropose"));
  for (const st of ["principal", "viewer"]) assert.ok(await reaches(runProductionsOps, "readpages", { query: { [st]: SENT } }), st);
  assert.ok(await reaches(actionsPair, "actionseekspropose", { query: { proposer: SENT } }));
  assert.ok(await reaches(actionsPair, "actionseekspropose", { body: { seeks: SENT } }));
  assert.ok(await reaches(actionsPair, "actionseekspropose", { body: { target: SENT } }));
  assert.equal((await drive(actionsPair, "actionseekspropose", { body: { seeks: "s" }, query: { seeks: SENT } })).includes(SENT), false);
  /* negative control: a session-only act is not as either */
  assert.notDeepEqual(plain(OPS.stepcreate), plain(OPS.extractpropose));
});

test("R43, R4, R6: each R43 op whose owner exports a map is served by it and its stamps reach the owner where it reads them — hypotheses' and reading-guides' by from the body, inquiry's, run-productions' and actions' from the query; the rest are served by the door's own map (control-plane R71: steps, question-explorer, investigation, leg-earning, case-account (T42, R48), review, ai-use's estimate and actual, ai-runs' three); milestonereminder's at is a body field, never a stamp; planPropose's machine arm is no op (N842) (negative control: a key the owner does not read does not reach)", async () => {
  const MAPS = { hypotheses: hypothesesOps, inquiry: inquiryOps, "run-productions": runProductionsOps,
                 "reading-guides": readingGuidesOps, actions: actionsPair };
  const DOOR = ["steps", "question-explorer", "investigation", "leg-earning", "case-account", "review"];
  let driven = 0;
  for (const [op, [fam, , st]] of Object.entries(R43)) {
    if (DOOR.includes(fam) || ["aiestimate", "aiactual", "stepsrunai", "grouptestset", "grouptestresults"].includes(op)) continue;
    const map = MAPS[fam];
    assert.ok(map && keysOf(map).includes(op), `${op} is not served by ${fam}`);
    for (const k of st) {
      if (k === "viewer" && OPS[op].mutating) continue;   /* an act's actor is its by; the viewer beside it is the family's */
      if (op === "acceptancecounts") continue;            /* its counts name no member and take no viewer (run-productions R22) */
      /* reading-guides' machine draft takes its proposer and run from the body (its R12): the principal stamp is the
         door's to hand there (control-plane R71); the body's by is driven */
      if (op === "guidepropose" && k === "principal") continue;
      const where = k === "bodyBy" ? { body: { by: SENT } } : { query: { [k]: SENT } };
      assert.ok(await reaches(map, op, where), `${op}: ${k} does not reach`);
      driven++;
    }
    assert.equal(await reaches(map, op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  assert.equal(driven, 22, `${driven} stamps driven`);
  /* the door's own map: none of these owners exports an arm for its R43 ops */
  for (const op of ["aiestimate", "aiactual"]) assert.ok(!keysOf(aiUseOps).includes(op), op);
  for (const op of ["stepsrunai", "grouptestset", "grouptestresults"]) assert.ok(!keysOf(aiRunsOps).includes(op), op);
  /* the body-by owners ignore a query by; milestonereminder's at is no stamp */
  assert.equal(await reaches(hypothesesOps, "hypothesissetaside", { query: { by: SENT } }), false);
  assert.ok(!stamps("milestonereminder").includes("at") && !stamps("stepreminder").includes("at"));
  for (const op of ["planpropose", "claimfindsteprun"]) assert.ok(inNoTable(op), op);
});

/* ---------- R45 ---------- */

test("R45 (T41-8a; capture R86; K2458, K2484): captureupload — a member's session only (admin, member; machineClasses []), mutating, NEEDS contribute, by stamped from the session (with the family's viewer), in both session sets, capture's family, in neither bearer fence, not on AI_GRANT_OPS (negative control: a bearer is refused)", () => {
  holds("captureupload", R45.captureupload);
  assert.equal(NEEDS.captureupload, "contribute");
  assert.deepEqual(OP_FAMILIES.capture.actor, { key: "by", at: "query" });
  /* the bytes are the raw body: no stamp names them */
  for (const k of ["bytes", "statement", "name"]) assert.ok(!stamps("captureupload").includes(k), k);
  /* capture's map has no arm for it yet; the door routes it to capture (control-plane R72) */
  assert.ok(!keysOf(captureOps).includes("captureupload"));
  /* negative control */
  assert.deepEqual(machineAdmits("captureupload"), []);
  assert.notDeepEqual(machineAdmits("capture"), []);
});

/* ---------- R46 ---------- */

test("R46 (K2457, K2443, K2554): recordcapturedlocator is a store-internal route — provenance's map serves it, it has no spec and is in no table, so the door answers any caller's request as an op with no spec and no caller writes a receipt, an upload's or any other (only capture R86 writes upload receipts); planproposals takes no after parameter: action-plans' arm hands its owner none (negative control: a declared op is in a table)", async () => {
  assert.ok(keysOf((s, u, b) => provenanceOps(s, u, b, { observer: "x" })).includes("recordcapturedlocator"));
  assert.ok(inNoTable("recordcapturedlocator"), "recordcapturedlocator is declared");
  /* K2585 (R6): `capturestepproduct`, the door's tie of a capture to its step after it lands, is store-internal too */
  assert.ok(inNoTable("capturestepproduct"), "capturestepproduct is declared");
  assert.equal(ACT_GATE.mode("recordcapturedlocator"), "machine");
  assert.equal(await reaches(actionPlansOps, "planproposals", { query: { after: SENT } }), false, "planproposals passes after");
  assert.ok(await reaches(actionPlansOps, "planproposals", { query: { plan: SENT } }));
  assert.deepEqual(plain(OPS.planproposals), { classes: MP, mutating: false });
  /* negative control */
  assert.ok(!inNoTable("captureupload"));
});

/* ---------- R34 and R6 over T41's ops ---------- */

test("R34 (T41; K2593): every member op T41 declares is explained in affordances' ACT_HELP or named under one ground of ACT_HELP_ABSENT, never both — R41's and R42's ten owed acts explained (affordances R48, merged: PR #19's owed texts held under their ops), the other reads under the read ground, the other acts under the last; handlecheck, public, under none (negative control: an unnamed op is seen)", () => {
  const ground = (op) => Object.entries(ACT_HELP_ABSENT).find(([, g]) => g.ops.includes(op))?.[0] ?? null;
    const OWED = ["accountusesset", "ailimitset", "exploreapprove", "handlechange", "projectaccountremove", "projectaccountswitch",
                "projectaikeepaway", "projectkeynoticeseen", "projectkeyset", "projectsigninset"];
  for (const op of OWED) {
    assert.ok(explained(op), `${op}: no ACT_HELP text`);
    assert.equal(ground(op), null, `${op} is explained and named`);
  }
  for (const op of Object.keys(T41).filter((o) => SESSION_OPS.member.has(o) && !OWED.includes(o))) {
    if (explained(op)) { assert.equal(ground(op), null, `${op} is explained and named`); continue; }
    assert.equal(ground(op), OPS[op].mutating ? "unexplained" : "read", op);
  }
  assert.ok(!Object.hasOwn(ACT_HELP_ABSENT, "owed"));
  assert.equal(ground("handlecheck"), null);
  /* negative control */
  assert.equal(ground("nosuchop"), null);
});

test("R6 (T41): no op T41 declares is in OPS without its family, and every family op is named by OPS, NEEDS, OP_STAMPS and, a session's, both sets; the op names are the door's (lower-case letters) (negative control: an unknown name is in no table)", () => {
  for (const op of Object.keys(T41)) {
    assert.match(op, /^[a-z]+$/, op);
    assert.ok(Object.hasOwn(OP_STAMPS, op) && Object.hasOwn(NEEDS, op), op);
    assert.ok(O.FAMILY_OPS.includes(op), op);
  }
  assert.ok(Object.isFrozen(OP_KINDS.publicread) && Object.isFrozen(OP_KINDS.runact) && Object.isFrozen(OP_KINDS.sessionrunact));
  assert.ok(inNoTable("stepsnosuch"));
});
