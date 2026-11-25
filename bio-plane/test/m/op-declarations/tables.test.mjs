/* op-declarations: the tables (R2–R6), read as they are exported. The act gate (R1) and the module's purity (R5, R7)
   are `gate.test.mjs`'s and `purity.test.mjs`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";

const { OPS, SESSION_OPS, NEEDS, UNATTENDED_BY_DECISION, PLAN_RUN_SCOPE } = O;
const BINDING_CLASSES = ["admin", "member", "probe", "daemon"];
/* Membership §5's working capabilities (membership's vocabulary; `view` gates nothing, so no op needs it). */
const CAPABILITIES = ["contribute", "publish", "create_projects"];
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const inSession = (op) => SESSION_OPS.member.has(op) || SESSION_OPS.admin.has(op);
const named = (k) => O[k];

test("R2: OPS maps every op to a well-formed spec {classes, machineClasses?, mutating}: classes null (public) or a list of binding classes and session kinds, machineClasses within classes, and no spec names ai", () => {
  const ops = Object.keys(OPS);
  assert.ok(ops.length >= 370, `${ops.length} specs`);
  for (const op of ops) {
    const s = OPS[op];
    assert.equal(Object.getPrototypeOf(s), Object.prototype, op);
    assert.deepEqual(Object.keys(s).filter((k) => !["classes", "machineClasses", "mutating"].includes(k)), [], op);
    assert.equal(typeof s.mutating, "boolean", op);
    if (s.classes !== null) {
      assert.ok(Array.isArray(s.classes) && s.classes.length > 0, op);
      assert.equal(new Set(s.classes).size, s.classes.length, op);
      for (const c of s.classes) assert.ok(BINDING_CLASSES.includes(c), `${op}: ${c}`);
    }
    if ("machineClasses" in s) {
      assert.ok(Array.isArray(s.classes) && Array.isArray(s.machineClasses), op);
      assert.equal(new Set(s.machineClasses).size, s.machineClasses.length, op);
      for (const c of s.machineClasses) assert.ok(s.classes.includes(c), `${op}: ${c}`);
    }
    /* No spec names `ai`, anywhere in it: an agent credential is admitted by its task scope alone. */
    assert.ok(!JSON.stringify(s).includes('"ai"'), `${op} names ai`);
  }
  /* The public surface is exactly the ops that gate themselves. T47 (R57, R59): the reset link's look and use
     (credentials R69, R71) and the group's languages (instance-setup R85) join it, and the published cases' list (R63); T51 (R77) the frozen published case (public-read R38). */
  assert.deepEqual(ops.filter((op) => OPS[op].classes === null).sort(),
    ["activitymethod", "bootstrap", "casechecker", "casedocument", "casefilespec", "caseflags", "claim", "credit", "docketfeed",
     "docketpublic", "enroll", "groupdescription",
     "groupidentity", "groupkeyspublic", "grouplanguages", "handlecheck",
     "instancegroup", "invitelook", "joinlinkinvite", "knock", "knockerconsent", "login", "noticespublic", "passwordreset",
     "passwordresetlook", "publicread", "publishedbytes",
     "publishedcase", "publishedfrozen", "publishedlist", "publishedmanifest", "recover", "reviewcomment", "reviewcopy", "statementack", "templatecomment",
     "templatecomments", "templateread", "templatereview", "verify", "websiteinvite"]);
  /* Inherited names are no op. */
  for (const k of ["toString", "constructor", "__proto__", "hasOwnProperty"]) assert.ok(!Object.hasOwn(OPS, k), k);
});

test("R2, R30, R32 (daemon-token convert): exactly nine ops admit daemon — acquire, capturerequestdrain, monitor, reevaluationraise, since T35 unpack, whose bearers are bounded to daemon and probe, and since T36 file-safety's four scheduler wakes, scanbatch, renderbatch, deeperbatch and securityforward — over the exported OPS", () => {
  const daemon = Object.keys(OPS).filter((op) => Array.isArray(OPS[op].classes) && OPS[op].classes.includes("daemon"));
  assert.deepEqual(daemon.sort(), ["acquire", "capturerequestdrain", "deeperbatch", "monitor", "reevaluationraise", "renderbatch",
                                   "scanbatch", "securityforward", "unpack"]);
  for (const op of daemon) {
    assert.equal(OPS[op].mutating, true, op);
    if (op === "unpack") assert.deepEqual([...OPS[op].machineClasses], ["daemon", "probe"], op);
    else assert.ok(!("machineClasses" in OPS[op]), op);
  }
});

test("R3: SESSION_OPS is {member, admin}, two sets of op names each with a spec; every mutating op a session reaches has a NEEDS row and every NEEDS row is an op a session reaches, naming one capability or null", () => {
  assert.deepEqual(Object.keys(SESSION_OPS).sort(), ["admin", "member"]);
  for (const kind of ["member", "admin"]) {
    const set = SESSION_OPS[kind];
    assert.equal(typeof set.has, "function");
    assert.equal([...set].length, set.size);
    for (const op of set) assert.ok(Object.hasOwn(OPS, op), `${kind}: ${op} has no spec`);
    /* A public op (`classes: null`) admits every caller, a session among them (R8's grant doors). */
    for (const op of set) assert.ok(OPS[op].classes === null || OPS[op].classes.includes(kind === "admin" ? "admin" : "member"),
      `${kind}: ${op}'s classes do not admit a ${kind} session`);
  }
  /* The founder's set holds every member act and adds only the founder's own (T49, R71: `founderhandleset`, the
     founder's choice of their handle, beside `governorconfig`; T51 fix round, R83: `export`, the copy of the group's records). */
  assert.deepEqual([...SESSION_OPS.admin].filter((op) => !SESSION_OPS.member.has(op)).sort(), ["export", "founderhandleset", "governorconfig"]);
  assert.deepEqual([...SESSION_OPS.member].filter((op) => !SESSION_OPS.admin.has(op)).sort(), []);
  for (const [op, need] of Object.entries(NEEDS)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.ok(need === null || CAPABILITIES.includes(need), `${op}: ${need}`);
    /* A session reaches an op in its set, a read its classes admit, and a public op (every caller: R10's reads, and
       since T35 `recover`, which op-grades names a NON_ACT, K2038). */
    const reached = inSession(op) || OPS[op].classes === null || (!OPS[op].mutating
      && (OPS[op].classes.includes("member") || OPS[op].classes.includes("admin")));
    /* An op unattended by a recorded decision may carry a present null row, for affordances' grading of it (K1689). */
    const unattendedNull = Object.hasOwn(UNATTENDED_BY_DECISION, op) && need === null;
    assert.ok(reached || unattendedNull, `${op} is in NEEDS and no session reaches it`);
  }
  for (const op of new Set([...SESSION_OPS.member, ...SESSION_OPS.admin]))
    if (OPS[op].mutating) assert.ok(Object.hasOwn(NEEDS, op), `${op}: a session reaches this mutating op and NEEDS has no row`);
  /* An op with no row needs nothing: the act gate answers null for it (R1). */
  assert.equal(O.ACT_GATE.needs("search"), null);
  assert.ok(!Object.hasOwn(NEEDS, "search"));
});

test("R3: UNATTENDED_BY_DECISION maps only ops no session reaches, each to the citation of the recorded decision, and holds no op without one", () => {
  const ops = Object.keys(UNATTENDED_BY_DECISION);
  /* T33 (R19, R20): the detectors' run (money-checks R6) and the ask's usage count (K1601) join them; T36 (R32):
     file-safety's four scheduler wakes, each citing its owner's requirement (K1913). */
  assert.deepEqual(ops.sort(), ["askusage", "capturerequestdrain", "cpuprobe", "deeperbatch", "instancegroupseed", "livefire",
                                "moneydetectorsrun", "purge", "reevaluationraise", "renderbatch", "reproject", "scanbatch",
                                "securityforward", "taskdrain"]);
  for (const op of ops) {
    assert.ok(Object.hasOwn(OPS, op), op);
    assert.equal(OPS[op].mutating, true, op);
    assert.ok(!inSession(op), `${op} is reached by a session`);
    const cite = UNATTENDED_BY_DECISION[op];
    assert.equal(typeof cite, "string", op);
    assert.ok(cite.trim().length > 40, `${op}: ${cite}`);
  }
  /* A citation names where the decision was recorded, and keeps its words when the table moves. */
  assert.match(UNATTENDED_BY_DECISION.cpuprobe, /^src\/control-plane\/ops\.mjs, op=cpuprobe's OPS row/);
});

test("R3 (rec155-session-routes, versionstate, members converts): §4.10's five in both session sets riding contribute, livefire and reproject unattended by decision, the six version acts contribute, select/selection/selectionlist in the member session set", () => {
  for (const op of ["provenancechain", "provenanceroute", "calibrate", "calibrationsubject", "calibrationsignal"]) {
    assert.ok(both(op), op);
    assert.equal(NEEDS[op], "contribute", op);
    assert.ok(OPS[op].classes.includes("probe") && OPS[op].mutating, op);
  }
  assert.deepEqual([...named("PROVENANCE_JUDGEMENT_ACTIONS")], ["provenancechain", "provenanceroute"]);
  assert.deepEqual([...named("CALIBRATION_WRITE_ACTIONS")], ["calibrate", "calibrationsubject", "calibrationsignal"]);
  for (const op of ["livefire", "reproject"]) {
    assert.match(UNATTENDED_BY_DECISION[op], /§4\.10 \(BOB #19\)/, op);
    assert.ok(!inSession(op), op);
  }
  for (const op of ["versionaccept", "versionreject", "versionconsider", "versionrevert", "versioncurrent", "versionhide"]) {
    assert.equal(NEEDS[op], "contribute", op);
    assert.ok(both(op) && named("VERSION_ACTIONS").includes(op), op);
  }
  assert.equal(named("VERSION_ACTIONS").length, 6);
  for (const op of ["select", "selection", "selectionlist"]) assert.ok(SESSION_OPS.member.has(op), op);
  /* governorconfig is the founder's session's alone. */
  assert.ok(SESSION_OPS.admin.has("governorconfig") && !SESSION_OPS.member.has("governorconfig"));
});

test("R4: every act list is a list of distinct op names, each with a spec; the composed lists are exactly their parts; the bearer fences' lists reach both session sets", () => {
  assert.ok(LISTS.length >= 55, `${LISTS.length} lists`);
  for (const [name, list] of LISTS) {
    assert.ok(list.length > 0, name);
    assert.equal(new Set(list).size, list.length, `${name} repeats an op`);
    for (const op of list) assert.ok(Object.hasOwn(OPS, op), `${name}: ${op} has no spec`);
  }
  const eqSet = (a, b, what) => assert.deepEqual([...new Set(a)].sort(), [...new Set(b)].sort(), what);
  eqSet(O.QUERY_AUTHOR_ACTIONS, [...O.CONFORMANCE_ACTIONS, ...O.CONSEQUENCES_ACTIONS, ...O.FILINGS_ACTIONS, ...O.ESCALATION_ACTIONS,
    ...O.ACTIONS_ACTIONS, ...O.ACTION_HOLDS_ACTIONS, ...O.ACTION_CLOCKS_ACTIONS, ...O.ACTION_PLANS_ACTIONS, ...O.FILING_TEMPLATES_ACTIONS, ...O.MONITORING_ACTIONS,
    ...O.ACTION_PLANS_PREVIEWS], "QUERY_AUTHOR_ACTIONS");
  eqSet(O.ACTION_LAYER_ACTIONS, [...O.STANDARDS_ACTIONS, ...O.QUERY_AUTHOR_ACTIONS, ...O.PLAN_PROPOSAL_ACTIONS,
    ...O.TEMPLATE_PROPOSAL_ACTIONS, ...O.LOCAL_FACTS_ACTIONS], "ACTION_LAYER_ACTIONS");
  eqSet(O.ACTION_LAYER_READS, [...O.STANDARDS_READS, ...O.CONFORMANCE_READS, ...O.CONSEQUENCES_READS, ...O.FILINGS_READS,
    ...O.ESCALATION_READS, ...O.ACTIONS_READS, ...O.ACTION_HOLDS_READS, ...O.ACTION_PLANS_READS, ...O.FILING_TEMPLATES_READS, ...O.LOCAL_FACTS_READS,
    ...O.LINK_SWEEP_READS], "ACTION_LAYER_READS");
  /* A list named for acts holds mutating ops, one named for reads or previews non-mutating ones. The one exception is
     the start preview (R11), a read the two composed author-stamped lists carry so the door stamps it as the start. */
  const PREVIEW_CARRIERS = ["QUERY_AUTHOR_ACTIONS", "ACTION_LAYER_ACTIONS"];
  for (const [name, list] of LISTS) {
    if (/_(READS|PREVIEWS)$/.test(name)) for (const op of list) assert.equal(OPS[op].mutating, false, `${name}: ${op}`);
    if (/_ACTIONS$/.test(name) && !["REGISTRY_ACTIONS", "RECOGNISER_ACTIONS", "PROGRESSION_ACTIONS"].includes(name))
      for (const op of list)
        assert.equal(OPS[op].mutating, !(PREVIEW_CARRIERS.includes(name) && O.ACTION_PLANS_PREVIEWS.includes(op)), `${name}: ${op}`);
  }
  assert.deepEqual([...O.ACTION_PLANS_PREVIEWS], ["optionstartpreview"]);
  /* The three sets a member reads AND writes through are named whole (their reads keyed on an entity, not the corpus). */
  for (const name of ["REGISTRY_ACTIONS", "RECOGNISER_ACTIONS", "PROGRESSION_ACTIONS"])
    assert.ok(named(name).some((op) => OPS[op].mutating) && named(name).some((op) => !OPS[op].mutating), name);
  /* The bearer fences' subjects (GOVERNANCE_ACTIONS, IDENTITY_ACTIONS) are a named administrator's own session acts. */
  assert.deepEqual([...O.GOVERNANCE_ACTIONS], ["adminendorse", "adminremove", "membercaps"]);
  assert.deepEqual([...O.IDENTITY_ACTIONS], ["groupnameset", "groupdomainset"]);
  for (const op of [...O.GOVERNANCE_ACTIONS, ...O.IDENTITY_ACTIONS]) assert.ok(both(op) && OPS[op].mutating, op);
  /* The custodial acts keep every bearer but the operator's two classes out by `machineClasses`. */
  for (const op of O.CUSTODIAL_ACTIONS) assert.deepEqual([...OPS[op].machineClasses], ["admin", "probe"], op);
  for (const op of O.OWN_KEY_ACTIONS) assert.deepEqual([...OPS[op].machineClasses], [], op);
});

test("R3, R4 (transcribe convert): transcribe and transcriptionattest are a person's acts — both session sets, admin and member classes only, contribute — with the read beside them open", () => {
  for (const op of ["transcribe", "transcriptionattest"]) {
    assert.deepEqual([...OPS[op].classes], ["admin", "member"], op);
    assert.equal(OPS[op].mutating, true, op);
    assert.ok(both(op), op);
    assert.equal(NEEDS[op], "contribute", op);
  }
  assert.equal(OPS.transcription.mutating, false);
  assert.ok(OPS.transcription.classes.includes("probe"));
  assert.equal(NEEDS.transcription, null);
});

test("R4, R3 (N-A12, K704, K709, K711, K705): the action layer's new ops — action-plans' fifteen, actions' eight, action-clocks' two, filings' two and the template read — each declared with its spec, its list, both session sets for an act and its capability", () => {
  const acts = {
    ACTION_PLANS_ACTIONS: ["planopen", "plansubjectadd", "plansubjectremove", "optionadd", "optionrevise", "optionadopt",
                           "optiondispose", "scenarioset", "checkpointrecord", "optionstart", "planclose"],
    PLAN_PROPOSAL_ACTIONS: ["optionpropose"],
    /* T27 (R12): the hold's release joins actions' acts, its two reads actions' reads (`t27.test.mjs`); T45 (R49): the
       pressure mark and the hold's ops moved with their owner to action-holds' lists. */
    ACTIONS_ACTIONS: ["actioncreate"],
    ACTION_HOLDS_ACTIONS: ["actionpressure", "actionhold", "actionholdrelease"],
    ACTION_CLOCKS_ACTIONS: ["reminderset", "reminderanswer"],
  };
  const reads = { ACTION_PLANS_READS: ["plan", "plans", "planproposals"],
                  ACTIONS_READS: ["action", "actions"], ACTION_HOLDS_READS: ["actionholdpreview", "projectholds"] };
  for (const [name, list] of [...Object.entries(acts), ...Object.entries(reads)]) assert.deepEqual([...named(name)], list, name);
  /* action-plans' ops are exactly `actionPlansOps`' sixteen: R1–R34's fifteen (K711) and R37's start preview (R11). */
  assert.equal([...acts.ACTION_PLANS_ACTIONS, ...acts.PLAN_PROPOSAL_ACTIONS, ...reads.ACTION_PLANS_READS,
                ...O.ACTION_PLANS_PREVIEWS].length, 16);
  for (const op of ["communicationprepare", "templatesave"]) assert.ok(O.FILINGS_ACTIONS.includes(op), op);
  /* T21 (R8): the library's read moved to its owner's list, filing-templates R14. */
  assert.ok(!O.FILINGS_READS.includes("templates") && O.FILING_TEMPLATES_READS.includes("templates"));
  const allActs = [...Object.values(acts).flat(), "communicationprepare", "templatesave"];
  for (const op of allActs) {
    /* A machine reaches each and its module refuses it by name or labels it (conclude's posture). */
    assert.deepEqual([...OPS[op].classes], ["admin", "member", "probe"], op);
    assert.ok(!("machineClasses" in OPS[op]), op);
    assert.equal(OPS[op].mutating, true, op);
    assert.ok(both(op), op);
    assert.ok(O.ACTION_LAYER_ACTIONS.includes(op), op);
    assert.equal(NEEDS[op], ["reminderset", "reminderanswer"].includes(op) ? null : "contribute", op);
    assert.ok(Object.hasOwn(NEEDS, op), op);
  }
  /* Every act but the proposal reads `author` from the query; the proposal's stamp is its proposer. */
  for (const op of allActs) assert.equal(O.QUERY_AUTHOR_ACTIONS.includes(op), op !== "optionpropose", op);
  for (const op of [...Object.values(reads).flat(), "templates"]) {
    assert.deepEqual([...OPS[op].classes], ["admin", "member", "probe"], op);
    assert.equal(OPS[op].mutating, false, op);
    assert.ok(O.ACTION_LAYER_READS.includes(op), op);
    /* `templates` carries a null row since R8 (affordances R30 names it in NON_ACTS), and R12's two reads since T27
       (affordances R33); the T18 reads none. */
    assert.ok(["templates", "actionholdpreview", "projectholds"].includes(op)
      ? NEEDS[op] === null && Object.hasOwn(NEEDS, op) : !Object.hasOwn(NEEDS, op), op);
  }
});

test("R2, R4, R49 (K660, K683; T45: K2820, K2824): a plan-mode run's agent credential scope — the reads plan, plans, agent-worker R51's and, since T45, action, reading and procedureguides (agent-worker R78), the writes optionpropose, airuntick and airunclose — each reachable by an agent credential: it admits member, carries no machineClasses, and is no bearer-fenced act", () => {
  assert.deepEqual([...PLAN_RUN_SCOPE.reads], ["plan", "plans", "determination", "standard", "consequencesof",
                                               "availableactions", "publishededitions", "profiles", "action", "reading",
                                               "procedureguides"]);
  assert.deepEqual([...PLAN_RUN_SCOPE.writes], ["optionpropose", "airuntick", "airunclose"]);
  const reachable = (op) => Array.isArray(OPS[op].classes) && OPS[op].classes.includes("member")
    && !Array.isArray(OPS[op].machineClasses) && !O.GOVERNANCE_ACTIONS.includes(op) && !O.IDENTITY_ACTIONS.includes(op);
  for (const op of PLAN_RUN_SCOPE.reads) {
    assert.ok(reachable(op), op);
    assert.equal(OPS[op].mutating, false, `${op}: a read needs no declared write`);
  }
  for (const op of PLAN_RUN_SCOPE.writes) {
    assert.ok(reachable(op), op);
    assert.equal(OPS[op].mutating, true, `${op}: a write is declared`);
  }
  /* Control: an op no agent can be scoped to is not reachable by this shape. */
  assert.equal(reachable("capturerequestdrain"), false);
  assert.equal(reachable("signerregister"), false);
  assert.equal(reachable("adminendorse"), false);
});

test("R6: an op spec for every op the tables name — the session sets, NEEDS, the unattended decisions, every act list and the plan-run scope — and every spec's op is one the door can answer by name", () => {
  const namedOps = new Set([...SESSION_OPS.member, ...SESSION_OPS.admin, ...Object.keys(NEEDS),
                            ...Object.keys(UNATTENDED_BY_DECISION), ...PLAN_RUN_SCOPE.reads, ...PLAN_RUN_SCOPE.writes]);
  for (const [, list] of LISTS) list.forEach((op) => namedOps.add(op));
  for (const op of namedOps) assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
  /* A spec's key is an op name the door can be asked for: lower-case letters, nothing that is a path or a parameter. */
  for (const op of Object.keys(OPS)) assert.match(op, /^[a-z]+$/, op);
  /* The ops the T18 modules serve (action-plans, actions, action-clocks, filings) each have a spec — the ones that had
     none before this module (N-A12, K704, K705, K709, K711). */
  for (const op of ["planopen", "plansubjectadd", "plansubjectremove", "plan", "plans", "optionadd", "optionrevise",
                    "optionpropose", "optionadopt", "optiondispose", "scenarioset", "checkpointrecord", "optionstart",
                    "planclose", "planproposals", "actioncreate", "action", "actions", "actionpressure", "reminderset",
                    "reminderanswer", "communicationprepare", "templatesave", "templates"])
    assert.ok(Object.hasOwn(OPS, op), op);
});

test("R2, R3, R4, R6 (K899 (7), K902; actions R52): actionhold is declared as actionpressure is — admin, member and probe, mutating, no machineClasses; in ACTIONS_ACTIONS, so its author is query-stamped; in both session sets; contribute", () => {
  assert.ok(Object.hasOwn(OPS, "actionhold"));
  assert.deepEqual({ ...OPS.actionhold, classes: [...OPS.actionhold.classes] },
                   { ...OPS.actionpressure, classes: [...OPS.actionpressure.classes] });
  assert.deepEqual([...OPS.actionhold.classes], ["admin", "member", "probe"]);
  assert.equal(OPS.actionhold.mutating, true);
  assert.ok(!("machineClasses" in OPS.actionhold));
  /* Every list that names actionpressure names actionhold, and no other. */
  const holding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
  assert.deepEqual(holding("actionhold"), holding("actionpressure"));
  /* T45 (R49): its list is action-holds' since the hold moved with its owner (action-holds R2). */
  assert.deepEqual(holding("actionhold"), ["ACTION_HOLDS_ACTIONS", "ACTION_LAYER_ACTIONS", "QUERY_AUTHOR_ACTIONS"]);
  assert.ok(both("actionhold"));
  assert.equal(NEEDS.actionhold, "contribute");
  assert.equal(O.ACT_GATE.needs("actionhold"), "contribute");
  assert.equal(O.ACT_GATE.mode("actionhold"), "session");
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, "actionhold"));
});

/* R8: K921's ops, as R8 lists them. The doors (`classes: null`) and the reads take no capability and carry a null row
   (affordances R30 names each in NON_ACTS; its R12 reads a key this table lacks as stale). */
const R8 = {
  memberActs: ["templatedraft", "templaterevise", "templatesubmit", "templatereviewgrant", "templategrantrevoke",
               "templateapprove", "templateretire", "factconfirm"],
  proposal: ["templatepropose"],
  doorActs: ["templatereview", "templatecomment"],
  doorReads: ["templateread", "templatecomments"],
  reads: ["templates", "factstatus", "factsdue"],
};
const R8_ALL = Object.values(R8).flat();
const listsHolding = (op) => LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name).sort();
const plain = (op) => ({ ...OPS[op], ...(Array.isArray(OPS[op].classes) ? { classes: [...OPS[op].classes] } : {}) });

test("R8: OPS holds a spec for each op of filing-templates and local-facts — the eight member acts and the proposal mutating, admin, member and probe, no machineClasses; the four grant doors classes null as reviewcomment and reviewcopy, review and comment mutating, read and comments not; the three reads admin, member and probe, not mutating — and every one in both session sets", () => {
  assert.equal(R8_ALL.length, 16);
  assert.equal(new Set(R8_ALL).size, 16);
  for (const op of [...R8.memberActs, ...R8.proposal]) assert.deepEqual(plain(op), { classes: ["admin", "member", "probe"], mutating: true }, op);
  for (const op of R8.doorActs) assert.deepEqual(plain(op), plain("reviewcomment"), op);
  for (const op of R8.doorReads) assert.deepEqual(plain(op), plain("reviewcopy"), op);
  for (const op of R8.doorActs) assert.deepEqual(plain(op), { classes: null, mutating: true }, op);
  for (const op of R8.doorReads) assert.deepEqual(plain(op), { classes: null, mutating: false }, op);
  for (const op of R8.reads) assert.deepEqual(plain(op), { classes: ["admin", "member", "probe"], mutating: false }, op);
  /* No spec of the sixteen names `ai`: the proposal reaches an agent credential by its scope alone (R2). */
  for (const op of R8_ALL) assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  for (const op of R8_ALL) {
    assert.ok(both(op), `${op} is not in both session sets`);
    assert.equal(O.ACT_GATE.mode(op), "session", op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  /* The proposal is reachable by a plan-run-shaped agent credential: member admitted, no machineClasses, no bearer fence. */
  assert.ok(OPS.templatepropose.classes.includes("member") && !("machineClasses" in OPS.templatepropose)
            && !O.GOVERNANCE_ACTIONS.includes("templatepropose") && !O.IDENTITY_ACTIONS.includes("templatepropose"));
});

test("R8: NEEDS is contribute for every mutating op not reached by a secret — the eight member acts and the proposal — and null (a present row) for the two mutating doors a secret reaches and for the five reads", () => {
  for (const op of [...R8.memberActs, ...R8.proposal]) {
    assert.equal(NEEDS[op], "contribute", op);
    assert.equal(O.ACT_GATE.needs(op), "contribute", op);
  }
  for (const op of [...R8.doorActs, ...R8.doorReads, ...R8.reads]) {
    assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
    assert.equal(NEEDS[op], null, op);
    assert.equal(O.ACT_GATE.needs(op), null, op);
  }
  /* Over the sixteen, contribute exactly where the op mutates and is not a grant door. */
  for (const op of R8_ALL) assert.equal(NEEDS[op] === "contribute", OPS[op].mutating && OPS[op].classes !== null, op);
});

test("R8, R4: the stamps the act lists name — author (filing-templates' by) and viewer for the seven template acts, query-stamped; author or by for factconfirm with viewer; proposer and viewer for templatepropose; author or secretSha for the doors; secretSha issued for templatereviewgrant as for reviewgrant; viewer for the three reads; templates moved out of FILINGS_READS", () => {
  const acts7 = R8.memberActs.filter((op) => op !== "factconfirm");
  assert.deepEqual([...O.FILING_TEMPLATES_ACTIONS], acts7);
  for (const op of acts7)
    assert.deepEqual(listsHolding(op), ["ACTION_LAYER_ACTIONS", "FILING_TEMPLATES_ACTIONS", "QUERY_AUTHOR_ACTIONS",
      ...(op === "templatereviewgrant" ? ["GRANT_SECRET_ACTIONS"] : [])].sort(), op);
  assert.deepEqual(listsHolding("factconfirm"), ["ACTION_LAYER_ACTIONS", "LOCAL_FACTS_ACTIONS"]);
  assert.deepEqual(listsHolding("templatepropose"), ["ACTION_LAYER_ACTIONS", "TEMPLATE_PROPOSAL_ACTIONS"]);
  /* the proposal names its proposer, never an author: it is in no author-stamped list */
  assert.ok(!O.QUERY_AUTHOR_ACTIONS.includes("templatepropose"));
  for (const op of R8.doorActs) assert.deepEqual(listsHolding(op), ["TEMPLATE_DOOR_ACTIONS"], op);
  for (const op of R8.doorReads) assert.deepEqual(listsHolding(op), ["TEMPLATE_DOOR_READS"], op);
  assert.deepEqual([...O.GRANT_SECRET_ACTIONS], ["reviewgrant", "templatereviewgrant"]);
  assert.deepEqual(listsHolding("templates"), ["ACTION_LAYER_READS", "FILING_TEMPLATES_READS"]);
  for (const op of ["factstatus", "factsdue"]) assert.deepEqual(listsHolding(op), ["ACTION_LAYER_READS", "LOCAL_FACTS_READS"], op);
  assert.ok(!O.FILINGS_READS.includes("templates"));
  /* templatesave, filingprepare and counselpacket keep their specs and stamps (filings R28, R31, R32). */
  for (const op of ["templatesave", "filingprepare", "counselpacket"]) {
    assert.deepEqual(plain(op), { classes: ["admin", "member", "probe"], mutating: true }, op);
    assert.deepEqual(listsHolding(op), ["ACTION_LAYER_ACTIONS", "FILINGS_ACTIONS", "QUERY_AUTHOR_ACTIONS"], op);
    assert.equal(NEEDS[op], "contribute", op);
  }
});

test("R8, R6: the sixteen ops filing-templates and local-facts serve (filing-templates R3, R4, R6–R14; local-facts R1, R2, R4) each have a spec, and the tables name each one: the session sets, NEEDS and an act list", () => {
  for (const op of R8_ALL) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
    assert.ok(listsHolding(op).length > 0, `${op} is in no act list`);
  }
});

/* R9: T22's ops (K1019, K1023), as R9 lists them, each with the spec, the stamps (through the lists that name them),
   both session sets and the NEEDS row. A spec is compared whole, so a class, a `machineClasses` or `mutating` that
   drifts fails here. */
const MEMBER_PROBE = ["admin", "member", "probe"];
const R9 = {
  declinetoescalate:   { spec: { classes: MEMBER_PROBE, mutating: true },  needs: "contribute", like: "escalationopen",
                         lists: ["ACTION_LAYER_ACTIONS", "ESCALATION_ACTIONS", "QUERY_AUTHOR_ACTIONS"] },
  escalationstatus:    { spec: { classes: MEMBER_PROBE, mutating: false }, needs: undefined, like: "escalationsdue",
                         lists: ["ACTION_LAYER_READS", "ESCALATION_READS"] },
  heldsetaside:        { spec: { classes: MEMBER_PROBE, mutating: true },  needs: "contribute",
                         lists: ["CAPTURE_MEMBER_ACTIONS", "CAPTURE_VIEWER_ACTIONS"] },
  heldrestore:         { spec: { classes: MEMBER_PROBE, mutating: true },  needs: "contribute",
                         lists: ["CAPTURE_MEMBER_ACTIONS", "CAPTURE_VIEWER_ACTIONS"] },
  heldcaptures:        { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null, lists: ["CAPTURE_READS"] },
  gradenote:           { spec: { classes: MEMBER_PROBE, mutating: false }, needs: null, lists: ["CAPTURE_READS"] },
  doorbelltally:       { spec: { classes: ["admin", "member"], machineClasses: [], mutating: false }, needs: null,
                         like: "knocksof", lists: ["CAPTURE_READS"] },
  addressfrequencyset: { spec: { classes: MEMBER_PROBE, mutating: true },  needs: "contribute",
                         lists: ["ACTION_LAYER_ACTIONS", "MONITORING_ACTIONS", "QUERY_AUTHOR_ACTIONS"] },
};
const plainSpec = (spec) => ({ ...spec, classes: [...spec.classes],
                               ...(Array.isArray(spec.machineClasses) ? { machineClasses: [...spec.machineClasses] } : {}) });
/* The stamps each list confers at the door (control-plane reads them): `by` for CAPTURE_MEMBER_ACTIONS, `author` for
   QUERY_AUTHOR_ACTIONS, `viewer` for the action layer's lists and capture's sight lists. */
const STAMPS = { CAPTURE_MEMBER_ACTIONS: ["by"], CAPTURE_VIEWER_ACTIONS: ["viewer"], CAPTURE_READS: ["viewer"],
                 QUERY_AUTHOR_ACTIONS: ["author"], ACTION_LAYER_ACTIONS: ["viewer"], ACTION_LAYER_READS: ["viewer"] };
const stampsOf = (op) => [...new Set(listsHolding(op).flatMap((l) => STAMPS[l] ?? []))].sort();
const R9_STAMPS = { declinetoescalate: ["author", "viewer"], escalationstatus: ["viewer"], heldsetaside: ["by", "viewer"],
                    heldrestore: ["by", "viewer"], heldcaptures: ["viewer"], gradenote: ["viewer"], doorbelltally: ["viewer"],
                    addressfrequencyset: ["author", "viewer"] };

test("R9, R2: OPS holds a spec for each op T22 adds — declinetoescalate as escalationopen and escalationstatus as escalationsdue, capture's heldsetaside and heldrestore mutating and heldcaptures and gradenote reads (admin, member, probe), doorbelltally a member session's read (admin, member, machineClasses []) as knocksof, monitoring's addressfrequencyset mutating — none naming ai", () => {
  assert.equal(Object.keys(R9).length, 8);
  for (const [op, want] of Object.entries(R9)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plainSpec(OPS[op]), want.spec, op);
    if (want.like) assert.deepEqual(plainSpec(OPS[op]), plainSpec(OPS[want.like]), `${op} as ${want.like}`);
    assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  }
  /* doorbelltally refuses every bearer: no machine class is admitted, so only a session reaches it. */
  assert.deepEqual([...OPS.doorbelltally.machineClasses], []);
  /* Negative control: the comparison sees a drifted spec. */
  assert.notDeepEqual(plainSpec({ ...OPS.doorbelltally, machineClasses: ["admin"] }), R9.doorbelltally.spec);
  assert.notDeepEqual(plainSpec({ ...OPS.heldsetaside, mutating: false }), R9.heldsetaside.spec);
});

test("R9, R3: each of T22's ops is in SESSION_OPS.member and SESSION_OPS.admin (the act gate answers session); NEEDS is contribute for each mutating one, a present null for capture's three reads and no row for escalationstatus, as escalationsdue; none is unattended", () => {
  for (const [op, want] of Object.entries(R9)) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op} is not in both session sets`);
    assert.equal(O.ACT_GATE.mode(op), "session", op);
    if (want.needs === undefined) assert.ok(!Object.hasOwn(NEEDS, op), `${op} has a NEEDS row`);
    else {
      assert.ok(Object.hasOwn(NEEDS, op), `${op} has no NEEDS row`);
      assert.equal(NEEDS[op], want.needs, op);
    }
    assert.equal(O.ACT_GATE.needs(op), want.needs ?? null, op);
    assert.equal(NEEDS[op] === "contribute", OPS[op].mutating, op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  }
  assert.equal(Object.hasOwn(NEEDS, "escalationsdue"), false);
});

test("R9, R4: the act lists name each of T22's ops, so its stamps are named — author and viewer for declinetoescalate (escalation's acts, query-stamped) and addressfrequencyset, viewer for escalationstatus, by and viewer for heldsetaside and heldrestore, viewer for heldcaptures, gradenote and doorbelltally", () => {
  for (const [op, want] of Object.entries(R9)) {
    assert.deepEqual(listsHolding(op), [...want.lists].sort(), op);
    assert.deepEqual(stampsOf(op), R9_STAMPS[op], op);
  }
  /* declinetoescalate and escalationstatus take the very places of escalationopen and escalationsdue. */
  assert.deepEqual(listsHolding("declinetoescalate"), listsHolding("escalationopen"));
  assert.deepEqual(listsHolding("escalationstatus"), listsHolding("escalationsdue"));
  /* T50 (R74; doorbell R13): the pull and the resolve join them, `viewer` stamped by the door, never the caller's */
  assert.deepEqual([...O.CAPTURE_VIEWER_ACTIONS], ["heldsetaside", "heldrestore", "inboxpull", "inboxresolve"]);
  assert.deepEqual([...O.CAPTURE_READS], ["heldcaptures", "gradenote", "doorbelltally"]);
  /* T47 (R55; monitoring R74): `monitorset` joins monitoring's act list, `addressfrequencyset`'s stamps. */
  assert.deepEqual([...O.MONITORING_ACTIONS], ["addressfrequencyset", "monitorset"]);
  /* Negative control: an op in no list is stamped nothing. */
  assert.deepEqual(stampsOf("nosuchop"), []);
});

/* R6's store-internal routes: served to no caller, so in no table. */
/* T31 (K1396): `wizardrefusaltally`, control-plane's call of wizard-scripts' refusal tally (its R16; control-plane R50),
   joins them. */
const STORE_INTERNAL = ["monitorlook", "doorbellrefused", "wizardrefusaltally"];
const tablesNaming = (op, t = { OPS, NEEDS, UNATTENDED_BY_DECISION, member: SESSION_OPS.member, admin: SESSION_OPS.admin }) => [
  ...Object.entries({ OPS: t.OPS, NEEDS: t.NEEDS, UNATTENDED_BY_DECISION: t.UNATTENDED_BY_DECISION })
    .filter(([, v]) => Object.hasOwn(v, op)).map(([k]) => k),
  ...(t.member.has(op) ? ["SESSION_OPS.member"] : []), ...(t.admin.has(op) ? ["SESSION_OPS.admin"] : []),
  ...LISTS.filter(([, list]) => list.includes(op)).map(([name]) => name),
  ...(PLAN_RUN_SCOPE.reads.includes(op) || PLAN_RUN_SCOPE.writes.includes(op) ? ["PLAN_RUN_SCOPE"] : [])];

test("R6, R9, R15: the store-internal routes monitorlook, doorbellrefused and wizardrefusaltally have no spec and are in no table (negative control: a table that adds one is seen)", () => {
  for (const op of STORE_INTERNAL) assert.deepEqual(tablesNaming(op), [], op);
  /* Negative control: doorbellrefused added to OPS (as a careless hand would, beside doorbelltally) is found. */
  const added = { ...OPS, doorbellrefused: { classes: ["admin", "member"], machineClasses: [], mutating: true } };
  assert.deepEqual(tablesNaming("doorbellrefused", { OPS: added, NEEDS, UNATTENDED_BY_DECISION,
                                                     member: SESSION_OPS.member, admin: SESSION_OPS.admin }), ["OPS"]);
  /* ...and every T22 op is named by the tables, the totality R6 asks over the new specs. */
  for (const op of Object.keys(R9)) assert.ok(tablesNaming(op).includes("OPS") && tablesNaming(op).length >= 4, op);
});
