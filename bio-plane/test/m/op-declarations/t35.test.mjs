/* op-declarations R30, R6, R19 (T35-70; K1901, K1943, K1972, K1976): T35's ops — the archive's, a member's own notes,
   "Find in this", the offices read, the credit page, the security map, sign-out, the recovery codes and `recover`, the
   second-administrator step, the agent's pack apart, a member's subscription disconnected — and the T35 ops of the
   earlier modules R6 asks a spec of (events', duties', calculations', standards' and capture-requests'). Each spec, row,
   session set and stamp is compared whole at the exported tables, and each stamp is driven through its owner's own map,
   so a stamp named at a site the owner does not read is seen. Each comparison has a negative control. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { retrievalRoutes } from "../../../src/retrieval/index.mjs";
import { entitiesOps } from "../../../src/entities/index.mjs";
import { PUBLIC_READ_DOOR_OPS } from "../../../src/public-read/door.mjs";
import { eventsOps } from "../../../src/events/index.mjs";
import { dutiesOps } from "../../../src/duties/index.mjs";
import { calculationsOps } from "../../../src/calculations/index.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { captureRequestsOps } from "../../../src/capture-requests/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE } = O;
const MP = ["admin", "member", "probe"];
const SESSION = ["admin", "member"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const neither = (op) => !SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n).sort();
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && neither(op) && !Object.hasOwn(OP_STAMPS, op)
  && listsOf(op).length === 0 && !Object.hasOwn(UNATTENDED_BY_DECISION, op)
  && !PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op);
const familyOf = (op) => Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op))?.owner ?? null;

/* An owner's map over a service that records each method it is called with and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const SENT = "member:sentinel-35";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);

/* R30's ops as it lists them: the spec, the NEEDS row (`undefined`: no row), the stamps, the family that declares it
   (`null`: declared in `OPS` itself) and the owner's map it is served through (`null`: another job's, named below). */
const R30 = {
  unpack:             { spec: { classes: [...MP, "daemon"], machineClasses: ["daemon", "probe"], mutating: true },
                        needs: "contribute", stamps: ["by", "viewer"], family: "acquisition", map: captureOps },
  archivelist:        { spec: { classes: MP, mutating: false }, needs: null, stamps: ["viewer"], family: "acquisition", map: captureOps },
  coarchiveset:       { spec: { classes: MP, machineClasses: ["admin", "probe"], mutating: true }, needs: null,
                        stamps: ["by", "viewer"], family: "acquisition", map: null },
  coarchivestate:     { spec: { classes: MP, mutating: false }, needs: null, stamps: [], family: "acquisition", map: null },
  noterevise:         { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute",
                        stamps: ["bodyBy", "viewer"], family: "hypotheses", map: hypothesesOps },
  notedelete:         { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute",
                        stamps: ["bodyBy", "viewer"], family: "hypotheses", map: hypothesesOps },
  findin:             { spec: { classes: MP, mutating: false }, needs: null, stamps: ["owner", "viewer"], family: "retrieval",
                        map: retrievalRoutes },
  entitieskind:       { spec: { classes: MP, mutating: false }, needs: null, stamps: ["viewer"], family: "entities", map: entitiesOps },
  /* K2038: a present null row for the two public ops op-grades names in NON_ACTS (its R22), so affordances R12 does not
     read them stale */
  credit:             { spec: { classes: null, mutating: false }, needs: null, stamps: [], family: "public-read", map: null },
  securitymap:        { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null, stamps: ["by", "viewer"],
                        family: "credentials", map: credentialsOps },
  signout:            { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null, stamps: ["session"],
                        family: "credentials", map: credentialsOps },
  signouteverywhere:  { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null, stamps: ["session"],
                        family: "credentials", map: credentialsOps },
  recoverycodesissue: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null, stamps: ["by", "viewer"],
                        family: "credentials", map: credentialsOps },
  recoverycodesstate: { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null, stamps: ["by", "viewer"],
                        family: "credentials", map: credentialsOps },
  recover:            { spec: { classes: null, mutating: true }, needs: null, stamps: ["country", "source"],
                        family: "credentials", map: credentialsOps },
  adminrecoverystep:  { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null, stamps: ["viewer"],
                        family: "instance-setup", map: null },
  agentpack:          { spec: { classes: MP, mutating: false }, needs: undefined, stamps: ["viewer"], family: null, map: null },
  /* the seventh of credentials' T35 routes (red 23): a member's own subscription disconnected (credentials R43) */
  subscriptiondisconnect: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null,
                            stamps: ["by", "viewer"], family: "ai-accounts", map: aiAccountsOps },
};
const PUBLIC = Object.keys(R30).filter((op) => R30[op].spec.classes === null);

test("R30, R2: OPS holds the spec R30 gives each of T35's ops — compared whole, none naming ai — and each sits in the family R30 names (the archive's in acquisition's, passed through capture's map; the notes in hypotheses' as notewrite; findin retrieval's; entitieskind entities'; credit public-read's; the security, sign-out and recovery ops credentials'; the step instance-setup's), agentpack in OPS beside affordances (negative control: a drifted spec is seen)", () => {
  assert.equal(Object.keys(R30).length, 18);
  for (const [op, want] of Object.entries(R30)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want.spec, op);
    assert.ok(Object.isFrozen(OPS[op]), op);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
    assert.equal(familyOf(op), want.family, op);
  }
  /* the notes take notewrite's kind; the co-archive setting hostingaccessset's spec; agentpack affordances' */
  for (const op of ["noterevise", "notedelete"]) assert.equal(OP_FAMILIES.hypotheses.kinds[op], OP_FAMILIES.hypotheses.kinds.notewrite, op);
  assert.deepEqual(plain(OPS.coarchiveset), plain(OPS.hostingaccessset));
  assert.deepEqual(plain(OPS.agentpack), plain(OPS.affordances));
  /* claim and login keep their specs (credentials R1, R4) */
  assert.deepEqual(plain(OPS.claim), { classes: null, mutating: true });
  assert.deepEqual(plain(OPS.login), { classes: null, mutating: false });
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.unpack, machineClasses: ["probe"] }), R30.unpack.spec);
  assert.notDeepEqual(plain({ ...OPS.signout, machineClasses: undefined }), R30.signout.spec);
});

test("R30, R3 (K2038): each of T35's ops but the public two and agentpack is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session); credit and recover are public, in neither; agentpack is in the session sets affordances is in (neither); the NEEDS row is R30's — contribute for unpack and the two note acts, a present null for the others a session reaches and for credit and recover (op-grades' NON_ACTS, K2038), none for agentpack (as affordances has none); none is unattended", () => {
  for (const [op, want] of Object.entries(R30)) {
    if (PUBLIC.includes(op) || op === "agentpack") assert.ok(neither(op), `${op} is in a session set`);
    else {
      assert.ok(both(op), `${op} is not in both session sets`);
      assert.equal(ACT_GATE.mode(op), "session", op);
    }
    if (want.needs === undefined) assert.ok(!Object.hasOwn(NEEDS, op), `${op} has a NEEDS row`);
    else {
      assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
      assert.equal(NEEDS[op], want.needs, op);
    }
    assert.equal(ACT_GATE.needs(op), want.needs ?? null, op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  assert.deepEqual(PUBLIC.sort(), ["credit", "recover"]);
  assert.equal(SESSION_OPS.member.has("agentpack"), SESSION_OPS.member.has("affordances"));
  assert.equal(SESSION_OPS.admin.has("agentpack"), SESSION_OPS.admin.has("affordances"));
  assert.equal(Object.hasOwn(NEEDS, "agentpack"), Object.hasOwn(NEEDS, "affordances"));
  /* negative control: an op with no row reads as needing nothing */
  assert.equal(ACT_GATE.needs("nosuchop"), null);
});

test("R30, R2, R4: none of T35's ops is in GOVERNANCE_ACTIONS or IDENTITY_ACTIONS, none is on credentials' AI_GRANT_OPS, and none is in a plan run's scope; agentpack is reached by an agent credential by its scope exactly as affordances is (member admitted, no machineClasses, no bearer fence), and no other R30 op a session alone reaches admits a bearer (negative control: affordances itself is reachable)", () => {
  const agentReachable = (op) => Array.isArray(OPS[op].classes) && OPS[op].classes.includes("member")
    && !Array.isArray(OPS[op].machineClasses) && !GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op);
  for (const op of Object.keys(R30)) {
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), op);
    assert.ok(!AI_GRANT_OPS.includes(op), `${op} is on AI_GRANT_OPS`);
    assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
  }
  assert.equal(agentReachable("agentpack"), agentReachable("affordances"));
  assert.equal(agentReachable("agentpack"), true);
  assert.equal(AI_GRANT_OPS.includes("agentpack"), AI_GRANT_OPS.includes("affordances"));
  for (const op of ["securitymap", "signout", "signouteverywhere", "recoverycodesissue", "recoverycodesstate",
                    "adminrecoverystep", "noterevise", "notedelete", "subscriptiondisconnect"])
    assert.deepEqual([...OPS[op].machineClasses], [], op);
  /* unpack: the daemon continues an automatic unpack, the probe as an operator's bearer; no member or admin bearer */
  assert.ok(!OPS.unpack.machineClasses.includes("member") && !OPS.unpack.machineClasses.includes("admin"));
  /* negative control */
  assert.equal(agentReachable("signout"), false);
});

test("R30, R4: OP_STAMPS names the stamps R30 gives each op — by and viewer on unpack, the co-archive set, the security map, the recovery codes and the disconnect; the body's by on the note acts; owner and viewer on findin; viewer on the reads and agentpack; the session alone on signout and signouteverywhere; source and country on recover, claim and login; nothing on credit and coarchivestate — and no act list names one (negative control: a drifted stamp is seen)", () => {
  for (const [op, want] of Object.entries(R30)) {
    assert.deepEqual(stamps(op), [...want.stamps].sort(), op);
    assert.ok(Object.isFrozen(OP_STAMPS[op]), op);
    assert.deepEqual(listsOf(op).filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)), [], `${op} is in ${listsOf(op)}`);
  }
  for (const op of ["claim", "login"]) assert.deepEqual(stamps(op), ["country", "source"], op);
  /* the session token is never a body field and never the caller's: signout carries no by, viewer or body stamp */
  for (const op of ["signout", "signouteverywhere"]) assert.ok(!stamps(op).includes("bodyBy") && !stamps(op).includes("by"), op);
  /* negative control */
  assert.notDeepEqual(stamps("findin"), ["viewer"]);
});

test("R30, R4: each stamp reaches its owner where the owner reads it, through the owner's own map — by on unpack and the credentials acts from the query, the body's by on the note acts, viewer and owner on findin, viewer on the reads, session on the two sign-outs, source and country on recover, claim and login; and recover's role, code and password are the body's (a query copy does not reach) (negative control: a key the owner does not read does not reach)", async () => {
  let checked = 0;
  for (const [op, want] of Object.entries(R30)) {
    if (!want.map) continue;
    for (const st of want.stamps) {
      const where = st === "bodyBy" ? { body: { by: SENT } } : { query: { [st]: SENT } };
      /* `viewer` is every family op's stamp (R19), read by each read that answers by sight; an act's actor is its `by`,
         and the two reads that answer `by` take no viewer (credentials R45, R46): the door stamps it on them all the same */
      if (st === "viewer" && (OPS[op].mutating || ["securitymap", "recoverycodesstate"].includes(op))) continue;
      assert.ok(await reaches(want.map, op, where), `${op}: ${st} does not reach its owner`);
      checked++;
    }
    assert.equal(await reaches(want.map, op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  for (const op of ["claim", "login"]) for (const st of ["source", "country"]) {
    assert.ok(await reaches(credentialsOps, op, { query: { [st]: SENT } }), `${op}: ${st}`);
    checked++;
  }
  assert.equal(checked, 19, `${checked} stamps driven`);
  /* the note acts read the body's by, never the query's */
  assert.equal(await reaches(hypothesesOps, "noterevise", { query: { by: SENT } }), false);
  /* recover's secrets are read from the body alone (admission R20) */
  for (const k of ["role", "code", "password"]) {
    assert.ok(await reaches(credentialsOps, "recover", { body: { [k]: SENT } }), `recover: the body's ${k}`);
    assert.equal(await reaches(credentialsOps, "recover", { query: { [k]: SENT } }), false, `recover: the query's ${k}`);
  }
  /* unpack's by is the query's, never the body's */
  assert.equal(await reaches(captureOps, "unpack", { body: { by: SENT } }), false);
});

test("R30, R6: every op of R30 is served — by its owner's map (capture's for the archive's two, hypotheses', retrieval's, entities', credentials'), by public-read's door (credit), or by the L11 job named for it (control-plane T35-72 for the co-archive setting and agentpack, instance-setup T35-69 for the step) — and each map's served T35 op has a spec (negative control: an op added to a map without a spec is seen)", async () => {
  const keysOf = (mapFn) => Object.keys(mapFn({}, new URL("http://plane/"), {}, {}, {}));
  for (const [op, want] of Object.entries(R30)) if (want.map) assert.ok(keysOf(want.map).includes(op), `${op} is not served by its map`);
  assert.ok(PUBLIC_READ_DOOR_OPS.includes("credit"));
  const ELSEWHERE = ["coarchiveset", "coarchivestate", "adminrecoverystep", "agentpack", "credit"];
  assert.deepEqual(Object.keys(R30).filter((op) => !R30[op].map).sort(), [...ELSEWHERE].sort());
  for (const op of ["coarchiveset", "coarchivestate"]) assert.ok(!keysOf(captureOps).includes(op), `${op} is in capture's map now`);
  /* capture's archive pass-through and credentials' seven routes all have specs */
  for (const op of ["unpack", "archivelist"]) assert.ok(Object.hasOwn(OPS, op), op);
  const credsT35 = ["signout", "signouteverywhere", "securitymap", "recoverycodesissue", "recoverycodesstate", "recover",
                    "subscriptiondisconnect"];
  for (const op of credsT35) assert.ok(keysOf(credentialsOps).includes(op) && Object.hasOwn(OPS, op), op);
  /* negative control */
  assert.deepEqual([...keysOf(credentialsOps), "signoutall"].filter((op) => !Object.hasOwn(OPS, op))
    .filter((op) => !["aicredentiallook", "session", "securitycount"].includes(op)), ["signoutall"]);
});

test("R6 (T35; N703, K2038): credentials' securitycount, the in-plane write of its R44 that admission reaches through the store, and admission's doorwindow, the store-side count of its R21 window, are store-internal routes with no spec and in no table, beside monitorlook, doorbellrefused, checkaddressees and projectclaimowner (negative control: a declared op is in a table)", () => {
  for (const op of ["securitycount", "doorwindow", "monitorlook", "doorbellrefused", "checkaddressees", "projectclaimowner",
                    "wizardrefusaltally"])
    assert.ok(inNoTable(op), `${op} is named by a table`);
  assert.ok(!inNoTable("securitymap"));
});

test("R27, R30 (T37: R27's T35 sentence retired, R36): subscriptionsignin is declared under its own name in credentials' family, and no alias names it; the member's own subscription disconnect is credentials' own act (machineClasses [], by stamped)", () => {
  assert.ok(!inNoTable("subscriptionsignin") && OP_FAMILIES.credentials.kinds.subscriptionsignin === "own");
  assert.ok(!Object.hasOwn(OP_ALIASES, "subscriptionsignin") && !Object.values(OP_ALIASES).includes("subscriptionsignin"));
  /* T48 (R68): the disconnection is ai-accounts' with the other account ops */
  assert.equal(OP_FAMILIES["ai-accounts"].kinds.subscriptiondisconnect, "own");
  assert.ok(!Object.hasOwn(OP_FAMILIES.credentials.kinds, "subscriptiondisconnect"));
  assert.ok(!inNoTable("subscriptiondisconnect"));
});

/* R6, R19: the ops T35's jobs added to the earlier modules' maps, each requirement naming them op-declarations' to
   declare (events R43–R46 and duties R27, R28 and calculations R32, R33: red 29; standards R35, R37, R40, R43;
   capture-requests R51–R53), with the kind its owner's refusals give it (R19). */
const T35_FAMILY_OPS = {
  events: { map: eventsOps, kinds: { discretionrecord: "member", assessmentrecord: "member", usewithdraw: "open", usesof: "read" } },
  duties: { map: dutiesOps, kinds: { uselink: "member", useunlink: "member", reviewpropose: "proposal", poweruses: "read" } },
  calculations: { map: calculationsOps, kinds: { usesfreeze: "member", applicationrecipes: "read" } },
  standards: { map: standardsOps, kinds: { standardforce: "member", standardforcewithdraw: "member", standardrelease: "member",
    standardadoption: "member", standardimpose: "member", standardbenchmark: "member", standardforcepropose: "proposal",
    forcesof: "read", overridesof: "read", editioninforce: "read", bindsat: "read" } },
  "capture-requests": { map: captureRequestsOps, kinds: { recordsrequestopen: "member", recordsrequestanswer: "member",
    recordsrequests: "read" } },
};

test("R19, R6: the T35 ops of events, duties, calculations, standards and capture-requests are each declared in its owner's family with the kind its owner's refusals give it — a member's act (refused a machine by name) member, an act no owner refuses a machine open, a proposal proposal, a read read — each served by its owner's map, with the spec, row and session sets of its kind (negative control: an unserved name has no spec)", async () => {
  let n = 0;
  for (const [owner, { map, kinds }] of Object.entries(T35_FAMILY_OPS)) {
    const served = Object.keys(map({}, new URL("http://plane/"), {}, {}, {}));
    for (const [op, kind] of Object.entries(kinds)) {
      assert.equal(OP_FAMILIES[owner].kinds[op], kind, `${owner}.${op}`);
      assert.ok(served.includes(op), `${owner}.${op} is not served`);
      assert.deepEqual(plain(OPS[op]), plain(O.OP_KINDS[kind].spec), op);
      assert.equal(NEEDS[op], O.OP_KINDS[kind].needs, op);
      assert.ok(both(op), op);
      n++;
    }
  }
  assert.equal(n, 24);
  /* capture-requests' records requests read their actor from the control plane's `principal` stamp (its R51, R52) */
  for (const op of ["recordsrequestopen", "recordsrequestanswer"]) {
    assert.deepEqual(stamps(op), ["principal", "viewer"], op);
    assert.ok(await reaches(captureRequestsOps, op, { query: { principal: SENT } }), op);
    assert.equal(await reaches(captureRequestsOps, op, { query: { by: SENT } }), false, op);
  }
  /* negative control */
  assert.ok(!Object.hasOwn(OPS, "usesforget"));
});
