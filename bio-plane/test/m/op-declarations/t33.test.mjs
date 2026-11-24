/* op-declarations R17–R20 (T33-88; K1122): the op families of T33's new modules and the ops T33 adds to earlier ones,
   one append site each (`OP_FAMILIES`). Each family is checked whole against its owner: the specs and rows its kinds
   give, both session sets, the stamps it names (driven through the owner's own ops map, so a stamp named at the wrong
   site or key is seen), and R6's totality between the owner's map and the tables. Each comparison has a negative
   control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { REGISTERED } from "./register-owners.mjs";
import { eventsOps } from "../../../src/events/index.mjs";
import { linesOps } from "../../../src/lines/index.mjs";
import { moneyOps } from "../../../src/money/index.mjs";
import { moneyChecksOps } from "../../../src/money-checks/index.mjs";
import { dutiesOps } from "../../../src/duties/index.mjs";
import { peopleOps } from "../../../src/people/index.mjs";
import { exploreOps } from "../../../src/explore/ops.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { calculationsOps } from "../../../src/calculations/index.mjs";
import { workbooksOps } from "../../../src/workbooks/ops.mjs";
import { answersOps } from "../../../src/answers/ops.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { credentialsOps } from "../../../src/credentials/index.mjs";
import { sourcesOps } from "../../../src/sources/index.mjs";
import { entitiesOps } from "../../../src/entities/index.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { inquiryOps } from "../../../src/inquiry/index.mjs";
import { corpusExportOps } from "../../../src/corpus-export/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { captureRequestsOps } from "../../../src/capture-requests/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { tasksOps } from "../../../src/tasks/index.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { publishScheduleOps } from "../../../src/publish-schedule/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { runProductionsOps } from "../../../src/run-productions/index.mjs";
import { wizardScriptsOps } from "../../../src/wizard-scripts/index.mjs";
import { fileSafetyOps } from "../../../src/file-safety/index.mjs";
import { caseCarriageOps } from "../../../src/case-carriage/index.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, ACT_GATE, OP_FAMILIES, OP_KINDS, FAMILY_OPS, ASK_GRANT_OPS,
        OP_STAMPS, OP_ALIASES } = O;
/* T34's kinds that stamp nothing of their own (R22): their ops take only the family's extras */
const unstamped = (f, op) => OP_KINDS[f.kinds[op]].stamped === false;
const MP = ["admin", "member", "probe"];
const plain = (s) => ({ ...s, ...(Array.isArray(s.classes) ? { classes: [...s.classes] } : {}),
                        ...(Array.isArray(s.machineClasses) ? { machineClasses: [...s.machineClasses] } : {}) });
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);

/* Every owner's ops map, built over a recording service: each method the arm calls answers {ok:true} and keeps the
   arguments it was handed, so a stamp the arm passes on is seen where the owner reads it. */
const MAPS = { events: eventsOps, lines: linesOps, money: moneyOps, "money-checks": moneyChecksOps, duties: dutiesOps,
  people: peopleOps, explore: exploreOps, hypotheses: hypothesesOps, calculations: calculationsOps, workbooks: workbooksOps,
  answers: answersOps, following: followingOps, standards: standardsOps, credentials: credentialsOps, sources: sourcesOps,
  entities: entitiesOps, "ai-runs": aiRunsOps, inquiry: inquiryOps, "corpus-export": corpusExportOps,
  /* T48 (R103 of actions; R68): the plane spreads `actionRecordsOps` beside `actionsOps`, and `aiAccountsOps` serves
     the 24 ops that moved from credentials */
  actions: (a, url, body, ...rest) => ({ ...actionsOps(a, url, body, ...rest), ...actionRecordsOps(a, url, body, ...rest) }),
  "ai-accounts": aiAccountsOps,
  "action-clocks": actionClocksOps, "capture-requests": captureRequestsOps, membership: membershipOps, tasks: tasksOps,
  publication: publicationOps, "wizard-scripts": wizardScriptsOps,
  /* T36 (R32): file-safety's map, read for R6's totality */
  "file-safety": fileSafetyOps,
  /* T37 (R38): case-carriage's map, read for R6's totality */
  "case-carriage": caseCarriageOps,
  /* T41 (R25, R41, R43): publish-schedule's, ai-use's, reading-guides' and run-productions' maps, read for R6's
     totality (steps, question-explorer, investigation, leg-earning, case-account (T42, R48) and review export no map
     for their T41 ops: the door's own serves them, control-plane R71) */
  "publish-schedule": publishScheduleOps, "ai-use": aiUseOps, "reading-guides": readingGuidesOps,
  "run-productions": runProductionsOps };
const recorder = () => {
  const calls = [];
  const fn = (...args) => { calls.push(args); return { ok: true }; };
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : fn) });
  return { svc, calls };
};
const build = (owner, url = new URL("http://plane/"), body = {}) => {
  const r = recorder();
  return { map: MAPS[owner](r.svc, url, body, r.svc, r.svc), calls: r.calls };
};
const servedBy = (owner) => Object.keys(build(owner).map);

/* The ops served in process only, never routed to a caller (R6's store-internal routes): inquiry's two (inquiry's
   Callers' obligations: the control plane routes neither), entities' plan read, credentials' two the plane's own
   admission and login call (T37, R39: `setpassword` is a declared op now, routed to its owner's arm). */
const IN_PROCESS = { inquiry: ["basis", "restson"], entities: ["readingnameplan"],
                     credentials: ["aicredentiallook", "session",
                       /* T36 (R33, R6; credentials R50): R44's in-plane write, which admission reaches through the store */
                       "securitycount"],
                     /* T34 (R22, R6): the check's addressees, read by tasks in process (membership R106) */
                     membership: ["checkaddressees",
                       /* membership's own hop, called inside `projectCreated` (R6's store-internal list, K1864) */
                       "projectclaimowner"],
                     /* publication's internal hops (its R15; D-734) and its reads served by public-read */
                     publication: ["recordcasemanifest", "recordcasefile", "publishedtargets", "casedocfacts", "publishedcasedoctext"] };
/* The family ops whose arm another L11 job serves (R6's other half holds at the layer's close): the control plane
   routes these to their owner's in-process services (K1601; action-clocks R2's `clockpropose`, capture-requests R46,
   answers' `ask`), instance-setup builds its two (T33-87). */
const SERVED_ELSEWHERE = { clockpropose: "control-plane (T33-89)",
  ask: "control-plane (T33-89)", officesseed: "instance-setup (T33-87)", seatsseed: "instance-setup (T33-87)",
  assistantstate: "instance-setup (T33-87)",
  disclosureshown: "instance-setup (T33-87)", disclosureof: "instance-setup (T33-87)",
  /* T34's ops whose owners' L11 jobs build them beside this one (their merges come first in L11's order) */
  placewanted: "instance-setup (T34-81)", placewantedstate: "instance-setup (T34-81)",
  memberlanguageset: "instance-setup (T34-81)", memberlanguage: "instance-setup (T34-81)",
  groupdescriptiondraft: "instance-setup (T34-90)",
  /* the door routes it itself, calling wizard-scripts' `writingHelp` with the assistant it resolves (K1863 (7)) */
  writinghelp: "control-plane (T34-60)",
  /* T35 (R30): the second-administrator step, built by instance-setup's T35 job beside this one; the co-archive
     setting, the acquisition instance's two methods the door routes (control-plane R58) */
  adminrecoverystep: "instance-setup (T35-69)", coarchiveset: "control-plane (T35-72)",
  coarchivestate: "control-plane (T35-72)",
  /* T37 (R36): the member's own sign-in is the control plane's route to the member's own runner (agent-worker R66) */
  subscriptionsignin: "control-plane (T37-33)",
  /* T37 (R35, R37): the interface's translation, built by instance-setup's T37 job beside this one (its R67, R69–R74;
     the draft routed through the control plane's third draft, T37-33) */
  translationdraft: "instance-setup (T37-30)", translationgrant: "instance-setup (T37-30)",
  translationadopt: "instance-setup (T37-30)", translationconfirm: "instance-setup (T37-30)",
  translationrevert: "instance-setup (T37-30)", translationmark: "instance-setup (T37-30)",
  translations: "instance-setup (T37-30)", interfacewords: "instance-setup (T37-30)",
  /* T41 (R41, R43): the ops whose owner exports no arm for them, routed by the door's own map (control-plane R71,
     K2560, K2569) — ai-use's estimate and actual, ai-runs' run over steps and group test (and inquiry, hypotheses,
     actions and run-productions serve theirs in their own maps) */
  aiestimate: "control-plane (T41-62)", aiactual: "control-plane (T41-62)", stepsrunai: "control-plane (T41-62)",
  grouptestset: "control-plane (T41-62)", grouptestresults: "control-plane (T41-62)",
  /* T45 (R49): the ops whose owner exports no arm for them yet — the group's rules (local-facts R12) and case-account's
     two (its R13, K2834), routed by the plane's job; the declared stake, built by instance-setup's job (its R77) */
  grouprules: "plane (T45-47)", advocacycheck: "plane (T45-47)", advocacychecks: "plane (T45-47)",
  /* the assistant's two drafts, whose doors the plane builds (K2824, K2881) */
  infractiondraft: "plane (T45-47)", bearingdraft: "plane (T45-47)",
  declaredstakeset: "instance-setup (T45-44)",
  /* T48 (R66): the update notice and the administrator's three choices, built by instance-setup's job beside this one
     (its R89, R90); readtranslate, the plane's draft door (plane R50; agent-worker R86), no map of a module this one uses */
  updatenotice: "instance-setup (T48-62)", updatestart: "instance-setup (T48-62)", updatelater: "instance-setup (T48-62)",
  updateskip: "instance-setup (T48-62)", readtranslate: "plane (T48-78; plane R50)",
  /* T46 (R50, R51): how much is explained, built by instance-setup's job beside this one (its R79); the member-run
     door, control-plane's route calling ai-runs' `dispatchMemberRun` in process (no arm in `aiRunsOps`, K2952) */
  infolevelset: "instance-setup (T46-50)", infolevel: "instance-setup (T46-50)",
  /* T47 (R59): the group's logo and languages, built by instance-setup's job (its R84, R85), merged before this one
     (the request to sign, tasks R19, is served by tasks' map since its merge, K3152) */
  grouplogoset: "instance-setup (T47-75)", grouplanguagesset: "instance-setup (T47-75)",
  grouplanguages: "instance-setup (T47-75)",
  airundispatch: "control-plane (T46-59)" };

test("R19, R17, R18, R20, R5: OP_FAMILIES holds one frozen entry per owner — owner, citation, the actor and proposer stamps as {key, at}, its kinds, and the acts, proposals and reads derived from them — each op in exactly one family and every kind one of OP_KINDS", () => {
  assert.deepEqual(Object.keys(OP_FAMILIES).sort(), ["acquisition", "action-clocks", "actions", "ai-accounts", "ai-runs", "ai-use", "answers",
    "calculations", "capture", "capture-requests", "case-account", "case-carriage", "connections", "corpus-export", "credentials", "duties",
    "entities", "events", "explore", "extraction", "file-safety", "following", "hypotheses", "inquiry", "instance-setup", "investigation",
    "leg-earning", "lines", "membership", "money", "money-checks", "people", "public-read", "publish-schedule",
    "question-explorer", "reading-guides", "retrieval", "review", "run-productions", "sources", "standards", "steps", "strength", "tasks",
    "wizard-scripts", "workbooks",
    /* T45 (R49): the owners T45 gives a family */
    "action-holds", "action-plans", "action-replies", "agent-worker", "case-check", "conformance", "consequences", "filings", "local-facts",
    "plan-work", "project-roster",
    /* T47 (R55, R59): the owners T47 gives a family */
    "basis-versions", "signin-door",
    /* T50 (R73): the owners T50 gives a family */
    "action-records", "progressions",
    /* T51 (R77, R78): the owners T51 gives a family */
    "filing-templates", "promotion"].sort());
  /* T48 (R67, R68): `ai-accounts` holds the 24 ops that moved from credentials, `connections` the step-source acts */
  assert.deepEqual(Object.keys(OP_KINDS).sort(), ["admin", "daemonact", "door", "member", "open", "own", "ownread",
    "plainread", "proposal", "public", "publicread", "publishact", "read", "roster", "runact", "sessionact", "sessionend",
    "sessionread", "sessionrunact",
    "settingread", "sightact", "tally",
    /* T45 (R49) */
    "owners", "publishgate",
    /* T46 (R51): the member-run door's act, a member's session or her own agent credential */
    "memberrun",
    /* T49 (R71): the founder's own act, the founder's session alone */
    "founder",
    /* T51 (R77; K4098): a read whose machine classes are named, so an `ai` credential is refused at admission */
    "readfenced"].sort());
  const seen = new Set();
  for (const [owner, f] of Object.entries(OP_FAMILIES)) {
    for (const v of [f, f.kinds, f.acts, f.proposals, f.reads, f.extra, ...Object.values(f.extra)]) assert.ok(Object.isFrozen(v), owner);
    for (const op of Object.keys(f.extra)) assert.ok(Object.hasOwn(f.kinds, op), `${owner}: an extra stamp on ${op}, no op`);
    assert.equal(f.owner, owner);
    assert.ok(typeof f.cite === "string" && f.cite.length > 3, owner);
    for (const st of [f.actor, f.proposer].filter(Boolean)) {
      assert.ok(Object.isFrozen(st), owner);
      assert.deepEqual(Object.keys(st).sort(), ["at", "key"], owner);
      assert.ok(["query", "body"].includes(st.at), owner);
      /* T48 (R67): connections' acts are stamped `member`, the session's own member, as answers' `ask` */
      assert.ok(["by", "author", "proposer", "viewer", "member"].includes(st.key), `${owner}: ${st.key}`);
    }
    const ops = Object.keys(f.kinds);
    for (const op of ops) {
      assert.ok(!seen.has(op), `${op} in two families`);
      seen.add(op);
      assert.ok(Object.hasOwn(OP_KINDS, f.kinds[op]), op);
    }
    const kind = (op) => OP_KINDS[f.kinds[op]];
    assert.deepEqual([...f.acts], ops.filter((op) => kind(op).spec.mutating && f.kinds[op] !== "proposal"), owner);
    assert.deepEqual([...f.proposals], ops.filter((op) => f.kinds[op] === "proposal"), owner);
    assert.deepEqual([...f.reads], ops.filter((op) => !kind(op).spec.mutating), owner);
    /* an act needs an actor stamp unless it reads only the viewer; a proposal its proposer */
    if (f.acts.some((op) => !unstamped(f, op)) && owner !== "corpus-export") assert.ok(f.actor, `${owner} names no actor`);
    if (f.proposals.length) assert.ok(f.proposer, `${owner} names no proposer`);
  }
  assert.deepEqual([...FAMILY_OPS].sort(), [...seen].sort());
  assert.ok(Object.isFrozen(FAMILY_OPS) && Object.isFrozen(OP_KINDS));
  for (const k of Object.values(OP_KINDS)) assert.ok(Object.isFrozen(k), "kind");
});

test("R19, R2, R3: every family op has the spec and NEEDS row its kind gives — open and proposal admin, member, probe, mutating, contribute; member a session's only (machineClasses []), contribute; admin and own a session's only, a present null; tally mutating, null; read admin, member, probe, null; ownread a session's only, null — in both session sets, none naming ai, none unattended (negative control: a drifted spec or row is seen)", () => {
  const want = {
    open: [{ classes: MP, mutating: true }, "contribute"],
    proposal: [{ classes: MP, mutating: true }, "contribute"],
    member: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, "contribute"],
    admin: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, null],
    own: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, null],
    tally: [{ classes: MP, mutating: true }, null],
    read: [{ classes: MP, mutating: false }, null],
    ownread: [{ classes: ["admin", "member"], machineClasses: [], mutating: false }, null],
    /* T34 (R22, R25, R28): `undefined` is no NEEDS row */
    roster: [{ classes: MP, machineClasses: ["admin", "probe"], mutating: true }, null],
    publishact: [{ classes: MP, machineClasses: [], mutating: true }, "publish"],
    sessionact: [{ classes: MP, machineClasses: [], mutating: true }, null],
    sessionread: [{ classes: MP, machineClasses: [], mutating: false }, null],
    readfenced: [{ classes: MP, machineClasses: ["admin", "probe"], mutating: false }, null],
    door: [{ classes: null, mutating: true }, undefined],
    public: [{ classes: null, mutating: false }, undefined],
    plainread: [{ classes: MP, mutating: false }, undefined],
    /* T35 (R30) */
    daemonact: [{ classes: [...MP, "daemon"], machineClasses: ["daemon", "probe"], mutating: true }, "contribute"],
    settingread: [{ classes: MP, mutating: false }, null],
    sessionend: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, null],
    /* T36 (R32) */
    sightact: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, null],
    sessionrunact: [{ classes: ["admin", "member"], machineClasses: [], mutating: true }, "contribute"],
    /* T41 (R42, R43; K2574, K2496) */
    publicread: [{ classes: null, mutating: false }, null],
    runact: [{ classes: MP, mutating: true }, "contribute"],
    /* T45 (R49): a project's setting by its owner's predicate, projectvisibilityset's; a held check, publish's */
    owners: [{ classes: MP, mutating: true }, null],
    publishgate: [{ classes: MP, mutating: true }, "publish"],
    /* T46 (R51): a member's own run act, her session or her own `ai` credential (no machineClasses), no probe, null */
    memberrun: [{ classes: ["admin", "member"], mutating: true }, null],
    /* T49 (R71): the founder's session alone (classes `admin`, no bearer), no working capability */
    founder: [{ classes: ["admin"], machineClasses: [], mutating: true }, null],
  };
  const PUBLIC = ["door", "public", "publicread"];
  let n = 0;
  for (const f of Object.values(OP_FAMILIES)) for (const [op, k] of Object.entries(f.kinds)) {
    n++;
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(OPS[op]), want[k][0], op);
    /* K2038: the credit page and `recover`, public, carry a present null row (op-grades' NON_ACTS, its R22); T47 (R57;
       K3147) the reset link's use, as `recover` */
    if (["credit", "recover", "passwordreset"].includes(op)) assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    else if (want[k][1] === undefined) assert.ok(!Object.hasOwn(NEEDS, op), `${op} has a NEEDS row`);
    else {
      assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
      assert.equal(NEEDS[op], want[k][1], op);
    }
    assert.equal(ACT_GATE.needs(op), want[k][1] ?? null, op);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    if (PUBLIC.includes(k)) {
      assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), `${op} is public and in a session set`);
      continue;
    }
    /* T49 (R71): a founder-only op is in the founder's set alone, reached as an admin session */
    if (k === "founder") {
      assert.ok(SESSION_OPS.admin.has(op) && !SESSION_OPS.member.has(op), `${op} is not in the founder's set alone`);
      assert.equal(ACT_GATE.mode(op), "admin-session", op);
      continue;
    }
    assert.ok(both(op), `${op} is not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
  }
  for (const op of Object.keys(OP_FAMILIES.membership.kinds).filter((o) => PUBLIC.includes(OP_FAMILIES.membership.kinds[o])))
    assert.ok(Object.isFrozen(OPS[op]), op);
  assert.ok(n >= 180, `${n} family ops`);
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.eventmerge, machineClasses: undefined }), want.member[0]);
  assert.notDeepEqual(plain({ ...OPS.timeline, mutating: true }), want.read[0]);
  assert.notDeepEqual(plain({ ...OPS.unpack, machineClasses: undefined }), want.daemonact[0]);
});

test("R19, R6: each new module's ops map and each family's share of an earlier module's map — every op the owner serves to a caller has a spec, every family op is served by its owner's map or by the named L11 job, and the in-process routes have no spec (negative control: an op added to a map without a spec is seen)", () => {
  const NEW = ["events", "lines", "money", "money-checks", "duties", "people", "explore", "hypotheses", "calculations",
               "workbooks", "answers", "following"];
  for (const owner of Object.keys(MAPS)) {
    const served = servedBy(owner);
    const internal = IN_PROCESS[owner] ?? [];
    for (const op of internal) {
      assert.ok(served.includes(op), `${owner}: ${op}`);
      assert.ok(!Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && !SESSION_OPS.member.has(op), `${op} is specced`);
    }
    for (const op of served.filter((o) => !internal.includes(o))) assert.ok(Object.hasOwn(OPS, op), `${owner}: ${op} has no spec`);
    const fam = OP_FAMILIES[owner];
    if (NEW.includes(owner)) {
      /* a new module's whole map is its family, but for the ops another job serves */
      const unserved = Object.keys(fam.kinds).filter((op) => !served.includes(op));
      assert.deepEqual(unserved, unserved.filter((op) => Object.hasOwn(SERVED_ELSEWHERE, op)), owner);
      /* an op the owner declares itself (R80) is served by its own row, not by the family, so it is no family op */
      const declared = REGISTERED[owner] ?? {};
      assert.deepEqual(served.filter((op) => !Object.hasOwn(fam.kinds, op) && !Object.hasOwn(declared, op)).sort(),
                       owner === "money-checks" ? ["moneydetectorsrun"] : [], owner);
    }
    if (fam) for (const op of Object.keys(fam.kinds))
      assert.ok(served.includes(op) || Object.hasOwn(SERVED_ELSEWHERE, op), `${owner}: ${op} is declared and served by nobody`);
  }
  /* the families no map holds are instance-setup's (its job builds them) */
  for (const op of Object.keys(OP_FAMILIES["instance-setup"].kinds)) assert.match(SERVED_ELSEWHERE[op] ?? "", /instance-setup/, op);
  /* T34: membership's, publication's and credentials' new ops are served by their merged owners now */
  for (const op of [...Object.keys(OP_FAMILIES.membership.kinds), ...Object.keys(OP_FAMILIES["publish-schedule"].kinds),
                    "groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeystate", "groupkeynotice",
                    "groupkeynoticeseen", "notewrite", "noteturn", "notes"])
    assert.ok(!Object.hasOwn(SERVED_ELSEWHERE, op), op);
  /* each named exception is a family op its owner's map does not yet serve */
  for (const op of Object.keys(SERVED_ELSEWHERE)) {
    assert.ok(FAMILY_OPS.includes(op), op);
    const owner = Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op)).owner;
    if (MAPS[owner]) assert.ok(!servedBy(owner).includes(op), `${op} is served now: drop it from SERVED_ELSEWHERE`);
  }
  /* negative control: an op added to a map without a spec is found */
  assert.deepEqual([...servedBy("explore"), "explorewander"].filter((op) => !Object.hasOwn(OPS, op)), ["explorewander"]);
});

/* Driving an arm: the stamp is given at one site and the other is left empty, so the sentinel reaches the owner only
   when the family names the site the owner reads. */
const SENT = "member:sentinel-7f3a";
/* the arguments an arm needs before it reaches its owner at all (a preset is named, R10) */
const ARGS = { explorepreset: { preset: "chain" } };
const reaches = async (owner, op, st) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(ARGS[op] ?? {})) url.searchParams.set(k, v);
  const body = {};
  (st.at === "query" ? url.searchParams : { set: (k, v) => { body[k] = v; } }).set(st.key, SENT);
  const { map, calls } = build(owner, url, body);
  try { await map[op](); } catch { /* an arm that throws past the recorder still recorded its call */ }
  return JSON.stringify(calls).includes(SENT);
};

test("R19, R4: each family's actor stamp reaches its owner on every act, and its proposer stamp on every proposal, at the site and key the family names; a key the owner does not read, or a body owner's query, does not (negative control), so the door that stamps by this table stamps what the owner reads", async () => {
  let checked = 0;
  for (const [owner, f] of Object.entries(OP_FAMILIES)) {
    if (!MAPS[owner]) continue;
    const served = servedBy(owner);
    const pairs = [...f.acts.map((op) => [op, f.actor]), ...f.proposals.map((op) => [op, f.proposer])]
      .filter(([op, st]) => st && served.includes(op) && !unstamped(f, op));
    for (const [op, st] of pairs) {
      assert.ok(await reaches(owner, op, st), `${owner}.${op}: ${st.key} in the ${st.at} does not reach the owner`);
      /* negative controls: at the query, a key the owner does not read does not reach; an owner that reads the body
         ignores the query, so the same stamp there does not reach (an owner that reads the query may also pass its
         body through, so the body is no control for it) */
      assert.equal(await reaches(owner, op, { key: "nosuchstamp", at: "query" }), false, `${owner}.${op}: any key reaches`);
      if (st.at === "body")
        assert.equal(await reaches(owner, op, { key: st.key, at: "query" }), false, `${owner}.${op}: the query's ${st.key} reaches`);
      checked++;
    }
  }
  assert.ok(checked >= 70, `${checked} stamps driven`);
});

test("R19, R4: every family read is stamped with the viewer, and the owner reads it from the query: the viewer reaches the owner on each served read that names a subject by sight (negative control: under another key it does not)", async () => {
  /* reads that take no viewer by their owner's requirement: events' act-to-event alias (R21), money-checks' parameter
     list (R3) and the keyed services list (credentials R29); the door stamps it on them all the same */
  const NO_VIEWER = ["eventforact", "moneycheckparams", "keyedservices",
    /* T35: calculations' recipes of application are data, the same for every caller (its R33) */
    "applicationrecipes",
    /* T35: the security map and the recovery codes' state answer `by`, an administrator's own (credentials R45, R46) */
    "securitymap", "recoverycodesstate",
    /* T41: run-productions' acceptance counts name no member and take no viewer (its R22) */
    "acceptancecounts",
    /* T46 (R51): the doors' settings and history answer `by`, an administrator's own (membership R130) */
    "joindoors",
    /* T50 (R73): the instant a member last looked at Home and her open captures answer `by`, the session's member,
       never a request field (membership R148, acquisition R46) */
    "lookedat", "opencaptures",
    /* T51 (R77; CR-4): the administrator removals under way answer `by`, an administrator's own (member-roster R75) */
    "adminremovalsopen"];
  let checked = 0;
  for (const [owner, f] of Object.entries(OP_FAMILIES)) {
    if (!MAPS[owner]) continue;
    const served = servedBy(owner);
    for (const op of f.reads.filter((o) => served.includes(o) && !NO_VIEWER.includes(o) && !unstamped(f, o))) {
      assert.ok(await reaches(owner, op, { key: "viewer", at: "query" }), `${owner}.${op}: the viewer does not reach`);
      assert.equal(await reaches(owner, op, { key: "nosuchstamp", at: "query" }), false, `${owner}.${op}: any key reaches`);
      checked++;
    }
  }
  assert.ok(checked >= 70, `${checked} reads`);
});

/* K1674, K1683: the stamp interface — op → keys from the closed set the control plane implements once each. */
const STAMP_KEYS = ["viewer", "by", "bodyBy", "author", "proposer", "member", "session",
  /* T35 (R30): a selection's owner, the caller's principal, and the keyed source and country (admission R21) */
  "owner", "principal", "source", "country"];
const keyOf = (st) => (!st || st.key === "viewer" ? null : st.key === "by" ? (st.at === "body" ? "bodyBy" : "by") : st.key);

test("R19, R4, R5, R30 (K1674, K1683): OP_STAMPS maps every op this module declares for T33 — each family op, the ask's three plane ops, exportpage and moneydetectorsrun, and T35's claim, login and agentpack, and no other — to frozen stamp keys from the closed set viewer, by, bodyBy, author, proposer, member, session, owner, principal, source, country: viewer on every family op, the family's actor key on each act (by at the query, bodyBy at the body), its proposer key on each proposal, the family's extras, the grant's member as viewer on the ask ops (negative control: a drifted key is seen)", () => {
  assert.ok(Object.isFrozen(OP_STAMPS));
  /* T34 (R21): an alias of a stamped op carries its op's stamps */
  const aliased = Object.keys(OP_ALIASES).filter((al) => FAMILY_OPS.includes(OP_ALIASES[al]));
  /* R80: an op an owner declares is stamped by its declaration, registered beside the hand rows (`register-owners.mjs`), so
     the stamped ops outside the declarations are exactly the hand list; a declared op may be stamped by either */
  const DECLARED = new Set(Object.values(REGISTERED).flatMap((rows) => Object.keys(rows)));
  const HAND = [...new Set([...FAMILY_OPS, ...ASK_GRANT_OPS, "exportpage", "moneydetectorsrun", ...aliased, "claim", "login", "agentpack"])];
  assert.deepEqual(Object.keys(OP_STAMPS).filter((op) => !DECLARED.has(op)).sort(), HAND.filter((op) => !DECLARED.has(op)).sort());
  for (const al of aliased) assert.deepEqual([...OP_STAMPS[al]], [...OP_STAMPS[OP_ALIASES[al]]], al);
  for (const [op, keys] of Object.entries(OP_STAMPS)) {
    assert.ok(Object.isFrozen(keys) && Array.isArray(keys), op);
    assert.equal(new Set(keys).size, keys.length, op);
    for (const k of keys) assert.ok(STAMP_KEYS.includes(k), `${op}: ${k}`);
    assert.ok(Object.hasOwn(OPS, op), op);
  }
  for (const f of Object.values(OP_FAMILIES)) for (const op of Object.keys(f.kinds)) {
    if (unstamped(f, op)) { assert.deepEqual([...OP_STAMPS[op]], [...(f.extra[op] ?? [])], op); continue; }
    const who = f.acts.includes(op) ? keyOf(f.actor) : f.proposals.includes(op) ? keyOf(f.proposer) : null;
    assert.deepEqual([...OP_STAMPS[op]].sort(), [...new Set(["viewer", ...(who ? [who] : []), ...(f.extra[op] ?? [])])].sort(), op);
  }
  /* the shapes the control plane named (K1674): query by, body by, the viewer alone, author, member and session */
  assert.deepEqual([...OP_STAMPS.eventcreate], ["viewer", "by"]);
  assert.deepEqual([...OP_STAMPS.moneyrecord], ["viewer", "bodyBy"]);
  assert.deepEqual([...OP_STAMPS.tabledeclare], ["viewer"]);
  assert.deepEqual([...OP_STAMPS.clockadopt], ["viewer", "author"]);
  assert.deepEqual([...OP_STAMPS.clockpropose], ["viewer", "proposer"]);
  assert.deepEqual([...OP_STAMPS.dutypropose], ["viewer", "by"]);
  assert.deepEqual([...OP_STAMPS.aigrantmint], ["viewer", "by", "member", "session"]);
  assert.deepEqual([...OP_STAMPS.accountreference], ["viewer", "member"]);
  assert.deepEqual([...OP_STAMPS.ask], ["viewer", "member"]);
  for (const op of ASK_GRANT_OPS) assert.deepEqual([...OP_STAMPS[op]], ["viewer"], op);
  assert.deepEqual([...OP_STAMPS.exportpage], []);
  assert.deepEqual([...OP_STAMPS.moneydetectorsrun], []);
  for (const op of OP_FAMILIES.lines.reads) assert.deepEqual([...OP_STAMPS[op]], ["viewer"], op);
  /* no pre-T33 op is in it: their stamps are the act lists' */
  for (const op of ["promote", "standarddeclare", "actionpressure", "docketpost"]) assert.ok(!Object.hasOwn(OP_STAMPS, op), op);
  /* negative control */
  assert.notDeepEqual([...OP_STAMPS.linerecord], ["viewer", "by"]);
});

test("R17: clockpropose any credential's, as actionlawspropose (admin, member, probe, mutating, no machineClasses), proposer and viewer stamped; clockadopt a member's (machineClasses []), contribute, author and viewer stamped; clocksics a read; addresseesuggest a read; exportrender a member's stamped viewer (K1640); officesseed an administrator's own session, by stamped; (T36) assistantset retired, with no spec and in no table", () => {
  const ac = OP_FAMILIES["action-clocks"];
  assert.deepEqual(plain(OPS.clockpropose), plain(OPS.actionlawspropose));
  assert.ok(ac.proposals.includes("clockpropose") && ac.proposer.key === "proposer");
  assert.equal(NEEDS.clockpropose, "contribute");
  assert.deepEqual(plain(OPS.clockadopt), { classes: ["admin", "member"], machineClasses: [], mutating: true });
  assert.ok(ac.acts.includes("clockadopt") && ac.actor.key === "author");
  assert.equal(NEEDS.clockadopt, "contribute");
  for (const op of ["clocksics", "clocklateness", "addresseesuggest"]) {
    assert.equal(OPS[op].mutating, false, op);
    assert.equal(NEEDS[op], null, op);
  }
  assert.deepEqual(plain(OPS.exportrender), { classes: ["admin", "member"], machineClasses: [], mutating: true });
  assert.deepEqual(plain(OPS.exportpage), { classes: ["admin"], mutating: false });
  assert.deepEqual(plain(OPS.exportpage).classes, [...OPS.export.classes]);
  /* K1689: a present null row, affordances grading it; no session set holds it */
  assert.ok(Object.hasOwn(NEEDS, "exportpage") && NEEDS.exportpage === null && !SESSION_OPS.member.has("exportpage"));
  const is = OP_FAMILIES["instance-setup"];
  assert.equal(is.kinds.officesseed, "admin");
  assert.deepEqual(plain(OPS.officesseed), { classes: ["admin", "member"], machineClasses: [], mutating: true });
  assert.deepEqual(is.actor, { key: "by", at: "query" });
  /* T36 (DEC-172): assistantset is retired — no spec, no row, in no session set, no family, no stamps, no list */
  const lists = Object.entries(O).filter(([, v]) => Array.isArray(v)).filter(([, l]) => l.includes("assistantset"));
  assert.ok(!Object.hasOwn(OPS, "assistantset") && !Object.hasOwn(NEEDS, "assistantset") && !Object.hasOwn(OP_STAMPS, "assistantset")
    && !SESSION_OPS.member.has("assistantset") && !SESSION_OPS.admin.has("assistantset") && !Object.hasOwn(is.kinds, "assistantset")
    && !Object.hasOwn(UNATTENDED_BY_DECISION, "assistantset") && lists.length === 0, "assistantset is declared");
  /* negative control: its sibling is declared */
  assert.ok(Object.hasOwn(OPS, "officesseed") && SESSION_OPS.member.has("officesseed"));
});

test("R18: entityidentify an act on the record, contribute, by stamped (the body's, as resolutiondefect's) and viewer; lines' acts as entityidentify; structureat, holderat, standardinforce, inforceat and standardsfor reads with a present null row", () => {
  assert.equal(OP_FAMILIES.entities.kinds.entityidentify, "open");
  assert.deepEqual(OP_FAMILIES.entities.actor, { key: "by", at: "body" });
  assert.equal(NEEDS.entityidentify, "contribute");
  for (const op of ["linerecord", "linewithdraw", "linecurrentthrough"]) {
    assert.deepEqual(plain(OPS[op]), plain(OPS.entityidentify), op);
    assert.equal(NEEDS[op], "contribute", op);
  }
  assert.deepEqual(OP_FAMILIES.lines.actor, OP_FAMILIES.entities.actor);
  for (const op of ["structureat", "holderat", "standardinforce", "inforceat", "standardsfor"]) {
    assert.equal(OPS[op].mutating, false, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.ok(OPS[op].classes.includes("member"), op);
  }
});

test("R20 (T41; DEC-188 (8); K2484): ask a member's own session only (machineClasses []), viewer and member stamped; aiusage ai-use's session read, with and without owner; the account-reference ops a member's own session only, by stamped from the query — no bearer, so no administrator token acts for another member; the switches set only by R41's accountusesset (accountswitchset retired, no spec); no spec admits a group subscription, and a project's account is reached only through R41's ops (negative control: a retired name is in no table)", async () => {
  assert.deepEqual(plain(OPS.ask), { classes: ["admin", "member"], machineClasses: [], mutating: true });
  assert.equal(OP_FAMILIES.answers.kinds.ask, "own");
  assert.deepEqual(OP_FAMILIES.answers.actor, { key: "viewer", at: "query" });
  assert.deepEqual([...OP_STAMPS.ask].sort(), ["member", "viewer"]);
  /* aiusage is ai-use's (its R4), a session's read, both arms in its own map */
  assert.deepEqual(plain(OPS.aiusage), { classes: ["admin", "member"], machineClasses: [], mutating: false });
  assert.equal(OP_FAMILIES["ai-use"].kinds.aiusage, "ownread");
  assert.ok(!Object.hasOwn(OP_FAMILIES["ai-runs"].kinds, "aiusage"));
  assert.ok(await reaches("ai-use", "aiusage", { key: "viewer", at: "query" }));
  /* T48 (R68): the account ops are ai-accounts' now, `aigrantmint` stays credentials' */
  const cr = OP_FAMILIES.credentials, aa = OP_FAMILIES["ai-accounts"];
  for (const [owner, f, op] of [["ai-accounts", aa, "accountreferenceset"], ["ai-accounts", aa, "accountreferenceremove"],
                                ["credentials", cr, "aigrantmint"], ["ai-accounts", aa, "accountusesset"]]) {
    assert.equal(f.kinds[op], "own", op);
    assert.deepEqual([...OPS[op].machineClasses], [], op);
    assert.ok(await reaches(owner, op, { key: "by", at: "query" }), op);
  }
  assert.deepEqual(cr.actor, { key: "by", at: "query" });
  assert.deepEqual(aa.actor, { key: "by", at: "query" });
  /* the switches: one act, accountusesset; the retired switch acts have no spec and are in no table */
  for (const op of ["accountswitchset", "groupswitchset"])
    assert.ok(!Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && !Object.hasOwn(OP_STAMPS, op)
      && !SESSION_OPS.member.has(op) && !FAMILY_OPS.includes(op) && !servedBy("credentials").includes(op)
      && !servedBy("ai-accounts").includes(op), op);
  assert.deepEqual(Object.keys(OPS).filter((op) => /switch/.test(op) && /account|group/.test(op)).sort(),
                   ["groupkeyswitch", "projectaccountswitch"]);
  /* no op names a group-level subscription or a group account; a project's account ops are R41's alone */
  for (const op of Object.keys(OPS)) assert.doesNotMatch(op, /^(group|instance)(account|claude|reference|subscription)/, op);
  assert.deepEqual(Object.keys(OPS).filter((op) => /^project(account|key|signin|aikeep)/.test(op)).sort(),
    ["projectaccountremove", "projectaccountstate", "projectaccountswitch", "projectaikeepaway", "projectaikeepawaystate",
     "projectkeynotice", "projectkeynoticeseen", "projectkeyset", "projectsigninset"]);
  /* the agent's grant is admitted by its scope alone: no spec names ai */
  for (const op of [...FAMILY_OPS, ...ASK_GRANT_OPS]) assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  /* negative control */
  assert.ok(Object.hasOwn(OPS, "accountreferenceset"));
});

test("R19, R3 (K1601, K1566): the ask's three plane ops admit a session's kinds and no bearer, are in no session set, askusage alone mutating and unattended by a cited decision; moneydetectorsrun the operator's (admin, probe), in no session set, unattended by money-checks R6", () => {
  assert.deepEqual([...ASK_GRANT_OPS], ["askceiling", "askcheck", "askusage"]);
  for (const op of ASK_GRANT_OPS) {
    assert.deepEqual(plain(OPS[op]), { classes: ["admin", "member"], machineClasses: [], mutating: op === "askusage" }, op);
    assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), op);
    assert.ok(!Object.hasOwn(NEEDS, op), op);
  }
  assert.match(UNATTENDED_BY_DECISION.askusage, /K1601/);
  assert.deepEqual(plain(OPS.moneydetectorsrun), { classes: ["admin", "probe"], mutating: true });
  assert.ok(!SESSION_OPS.member.has("moneydetectorsrun") && !SESSION_OPS.admin.has("moneydetectorsrun"));
  assert.ok(Object.hasOwn(NEEDS, "moneydetectorsrun") && NEEDS.moneydetectorsrun === null, "K1689");
  assert.match(UNATTENDED_BY_DECISION.moneydetectorsrun, /money-checks\.md R6/);
  assert.ok(servedBy("money-checks").includes("moneydetectorsrun"));
});
