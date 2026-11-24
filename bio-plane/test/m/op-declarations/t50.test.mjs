/* op-declarations, T50 (R73, R74, R75; K3643, K3627, K3637, K3672; `op-grades` R45, `affordances` R64, R65; DEC-264,
   DEC-309 (5)): the 15 new ops declared in their owners' families, the request fields the owners gained, and the six
   ops that leave ACT_HELP_ABSENT. Each op is tested by name with its controls (K874). Specs, sets, rows and stamps are
   read from the exported tables; each stamp and request field is driven through its owner's own ops map, so a stamp
   named at a site the owner does not read, or a field the owner reads from elsewhere, is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REGISTERED } from "./register-owners.mjs";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import { T50_SHARES, T50_FAMILIES } from "../../../src/op-declarations/t50.mjs";
import { needsRows } from "../../../src/op-capabilities/index.mjs";
import { OWED_BY_FIX_ROUND } from "./browser.mjs";
import { SCREEN_REGISTRY, INSTALLER_ROUTES, registryActGaps } from "../../../src/wizard-scripts/index.mjs";
import { composeNeeds } from "../../../src/op-declarations/compose.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
import { retrievalRoutes } from "../../../src/retrieval/index.mjs";
import { inquiryOps } from "../../../src/inquiry/index.mjs";
import { progressionOps } from "../../../src/progressions/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_KINDS, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, CAPTURE_VIEWER_ACTIONS, CAPTURE_MEMBER_ACTIONS } = O;
const SESSION = ["admin", "member"];
const MP = ["admin", "member", "probe"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon", "ai"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* R73's kinds, each with the spec and the NEEDS row R73 gives it (the spec stated here, not read from OP_KINDS) */
const KINDS = {
  own:     { spec: { classes: SESSION, machineClasses: [], mutating: true },  needs: null },
  member:  { spec: { classes: SESSION, machineClasses: [], mutating: true },  needs: "contribute" },
  owners:  { spec: { classes: MP, mutating: true },                           needs: null },
  ownread: { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null },
  read:    { spec: { classes: MP, mutating: false },                          needs: null },
};
/* the 15 ops, each with its owner, kind and the stamps R73 names (`viewer` always, beside the family's own) */
const T50 = {
  watchitem:          { owner: "following",      kind: "own",     stamps: ["by", "viewer"] },
  secondlook:         { owner: "following",      kind: "member",  stamps: ["by", "viewer"] },
  secondlookclear:    { owner: "following",      kind: "member",  stamps: ["by", "viewer"] },
  actionstake:        { owner: "action-records", kind: "member",  stamps: ["author", "viewer"] },
  actioninquiry:      { owner: "action-records", kind: "member",  stamps: ["author", "viewer"] },
  projectstakeset:    { owner: "project-roster", kind: "owners",  stamps: ["by", "viewer"] },
  lookedat:           { owner: "membership",     kind: "ownread", stamps: ["by", "viewer"] },
  opencaptures:       { owner: "acquisition",    kind: "ownread", stamps: ["by", "viewer"] },
  projectstake:       { owner: "project-roster", kind: "ownread", stamps: ["viewer"] },
  projectownersgone:  { owner: "project-roster", kind: "ownread", stamps: ["viewer"] },
  browse:             { owner: "retrieval",      kind: "read",    stamps: ["viewer"] },
  capturegrade:       { owner: "capture",        kind: "read",    stamps: ["viewer"] },
  inquirypartition:   { owner: "inquiry",        kind: "read",    stamps: ["viewer"] },
  instances:          { owner: "progressions",   kind: "read",    stamps: ["viewer"] },
  stakeatpreparation: { owner: "filings",        kind: "read",    stamps: ["viewer"] },
};
const ACTS_PLAIN = ["watchitem", "secondlook", "secondlookclear", "actionstake", "actioninquiry"];
const OWNREADS = ["lookedat", "opencaptures", "projectstake", "projectownersgone"];
const READS = ["browse", "capturegrade", "inquirypartition", "instances", "stakeatpreparation"];

/* An owner's map over a service that records each call and its arguments. `routes` is the owner's map function with the
   signature the module gives it; the capture module's map takes its store's `env` last. */
const drive = async (routes, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await routes(svc, url, body, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const keysOf = (routes) => {
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
  return Object.keys(routes(svc, new URL("http://plane/"), {}, svc));
};
const SENT = "sentinel-50";
const reaches = async (routes, op, where) => (await drive(routes, op, where)).includes(SENT);
const MAPS = { following: followingOps, membership: membershipOps, capture: captureOps, "project-roster": projectRosterOps,
  retrieval: retrievalRoutes, inquiry: inquiryOps, progressions: progressionOps, filings: filingsOps, "action-records": actionRecordsOps };

/* ---------- R73 ---------- */

test("R73 (T50; K3643, K3627, K3637): the 15 new ops are declared once each, in their owners' families with the kinds R73 gives them — watchitem own; secondlook, secondlookclear, actionstake and actioninquiry member; projectstakeset owners; lookedat, opencaptures, projectstake and projectownersgone ownread; browse, capturegrade, inquirypartition, instances and stakeatpreparation read — each spec, NEEDS row and stamp list as R73 states it (negative control: a drifted kind or an undeclared name is seen)", () => {
  assert.equal(Object.keys(T50).length, 15);
  for (const [op, want] of Object.entries(T50)) {
    assert.deepEqual(familyOf(op), [want.owner], `${op}: not in ${want.owner}'s family alone`);
    assert.equal(OP_FAMILIES[want.owner].kinds[op], want.kind, `${op}: the kind`);
    assert.deepEqual(plain(OPS[op]), KINDS[want.kind].spec, `${op}: the spec`);
    assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), `${op}: frozen`);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === KINDS[want.kind].needs, `${op}: the NEEDS row`);
    assert.equal(ACT_GATE.needs(op), KINDS[want.kind].needs, op);
    assert.deepEqual(stamps(op), want.stamps, `${op}: the stamps`);
    /* both session sets, so the act gate answers `session` */
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op}: not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.ok(O.FAMILY_SESSION_OPS.includes(op) && O.FAMILY_OPS.includes(op), op);
    /* the shared conditions: in neither bearer fence, off AI_GRANT_OPS, never unattended, no alias, in no act list */
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
    assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
    assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
    assert.equal(OP_FAMILIES[want.owner][OPS[op].mutating ? "acts" : "reads"].includes(op), true, `${op}: in its family's ${OPS[op].mutating ? "acts" : "reads"}`);
  }
  /* the shares name exactly these 15 ops, under the owners and kinds above */
  const named = Object.entries({ ...T50_SHARES, ...Object.fromEntries(T50_FAMILIES.map((f) => [f.owner, f])) })
    .flatMap(([owner, s]) => Object.entries(s.ops).map(([op, k]) => [op, owner, k])).sort();
  assert.deepEqual(named, Object.entries(T50).map(([op, w]) => [op, w.owner, w.kind]).sort());
  /* negative control: an undeclared name, and a wrong kind, are seen */
  assert.ok(!Object.hasOwn(OPS, "watchitems"));
  assert.notDeepEqual(plain(OPS.secondlook), { ...KINDS.member.spec, mutating: false });
  assert.notEqual(OP_FAMILIES.following.kinds.watchitem, "member");
  assert.ok(Object.isFrozen(T50_SHARES) && Object.isFrozen(T50_FAMILIES));
  for (const s of [...Object.values(T50_SHARES), ...T50_FAMILIES]) assert.ok(Object.isFrozen(s) && Object.isFrozen(s.ops));
});

test("R73, R2 (T50): an ai credential is refused each member, own and ownread op — no spec names ai, and with machineClasses [] no bearer of any class (admin, member, probe, daemon) reaches them — and the five reads and projectstakeset name no ai class either (negative control: a spec that did name ai would be seen)", () => {
  for (const op of [...ACTS_PLAIN, ...OWNREADS]) {
    assert.deepEqual(OPS[op].machineClasses, [], `${op}: machineClasses`);
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer or an ai credential is admitted`);
    assert.ok(!OPS[op].classes.includes("ai") && !OPS[op].classes.includes("probe") && !OPS[op].classes.includes("daemon"), op);
  }
  for (const op of Object.keys(T50)) assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), `${op}: names ai`);
  /* the owners-kind act and the reads are not session-only by class, but still name no ai */
  assert.ok(!Object.hasOwn(OPS.projectstakeset, "machineClasses"));
  assert.equal(machineAdmits("projectstakeset").includes("ai"), false);
  /* negative control */
  assert.deepEqual(machineAdmits("promote").includes("ai"), false);
  assert.ok(["admin", "member", "probe"].every((c) => machineAdmits("browse").includes(c)), "the reads admit the three binding classes");
});

test("R73, R3 (T50): no family row is added in op-capabilities for an op it holds a hand row for — each of the 15 has a family row from its kind and no hand-written row, and the composition refuses an overlap (negative control: a hand row for one of them is seen)", () => {
  const hand = needsRows();
  for (const op of Object.keys(T50)) {
    assert.equal(Object.hasOwn(hand, op), false, `${op}: a hand-written row too`);
    assert.equal(NEEDS[op], KINDS[T50[op].kind].needs, op);
  }
  /* negative control: the same op in the hand-written part would be refused by the composition */
  assert.throws(() => composeNeeds({ watchitem: null }, { watchitem: null }), /watchitem.*family row.*hand-written row/);
  assert.deepEqual(composeNeeds(hand, Object.fromEntries(Object.keys(T50).map((op) => [op, NEEDS[op]]))).watchitem, null);
});

test("R73 (T50; following R32, R33): watchitem is a member's act on her own attention (own: a session's only, no working capability), secondlook and secondlookclear a member's acts its owner refuses a machine by name (member: contribute), all three stamped by from the query and the viewer; item, on, note and flag are the body's, and a body by or viewer is overwritten, never read (negative control: following's map reads the query's stamps only)", async () => {
  const body = (k) => ({ body: { [k]: SENT } });
  for (const op of ["watchitem", "secondlook", "secondlookclear"]) {
    assert.ok(keysOf(followingOps).includes(op), `${op}: following's map does not route it`);
    assert.ok(await reaches(followingOps, op, { query: { by: SENT } }), `${op}: by is the query's`);
    assert.ok(await reaches(followingOps, op, { query: { viewer: SENT } }), `${op}: viewer is the query's`);
    assert.ok(await reaches(followingOps, op, body("item")), `${op}: item is the body's`);
    assert.ok(!(await reaches(followingOps, op, body("by"))), `${op}: a body by reached the owner`);
    assert.ok(!(await reaches(followingOps, op, body("viewer"))), `${op}: a body viewer reached the owner`);
    assert.ok(!(await reaches(followingOps, op, { query: { item: SENT } })), `${op}: a query item reached the owner`);
  }
  assert.ok(await reaches(followingOps, "watchitem", body("on")), "watchitem: on is the body's");
  for (const op of ["secondlook", "secondlookclear"]) {
    assert.ok(await reaches(followingOps, op, body("note")), `${op}: note is the body's`);
    assert.ok(await reaches(followingOps, op, body("flag")), `${op}: flag is the body's`);
  }
  assert.equal(NEEDS.watchitem, null);
  assert.equal(NEEDS.secondlook, "contribute");
  assert.equal(NEEDS.secondlookclear, "contribute");
  assert.deepEqual(plain(OPS.watchitem), plain(OPS.membertie), "watchitem is a member's own act, as membertie's (kind own)");
  assert.equal(OP_FAMILIES.people.kinds.membertie, "own");
  /* negative control: a request field is no stamp */
  for (const op of ["watchitem", "secondlook", "secondlookclear"]) assert.ok(!stamps(op).includes("item") && !stamps(op).includes("note"), op);
});

test("R73 (T50; action-records R17, R19): actionstake and actioninquiry are a joined member's acts its owner refuses a machine by name (member: contribute), stamped author and viewer from the query; target and stake, and action and question, are the body's or the query's, and a body author or viewer is never read (negative control: no by stamp, and a body author does not reach the owner)", async () => {
  for (const op of ["actionstake", "actioninquiry"]) {
    assert.ok(keysOf(actionRecordsOps).includes(op), `${op}: action-records' map does not route it`);
    assert.ok(await reaches(actionRecordsOps, op, { query: { author: SENT } }), `${op}: author is the query's`);
    assert.ok(await reaches(actionRecordsOps, op, { query: { viewer: SENT } }), `${op}: viewer is the query's`);
    assert.ok(!(await reaches(actionRecordsOps, op, { body: { author: SENT } })), `${op}: a body author reached the owner`);
    assert.ok(!(await reaches(actionRecordsOps, op, { body: { viewer: SENT } })), `${op}: a body viewer reached the owner`);
    assert.ok(!stamps(op).includes("by"), `${op}: stamped by`);
  }
  assert.ok(await reaches(actionRecordsOps, "actionstake", { body: { target: SENT } }), "target");
  assert.ok(await reaches(actionRecordsOps, "actionstake", { body: { stake: SENT } }), "stake");
  assert.ok(await reaches(actionRecordsOps, "actioninquiry", { body: { action: SENT } }), "action");
  assert.ok(await reaches(actionRecordsOps, "actioninquiry", { body: { question: SENT } }), "question");
  assert.equal(OP_FAMILIES["action-records"].actor.key, "author");
  assert.deepEqual(familyOf("actionstake"), ["action-records"]);
  assert.equal(NEEDS.actionstake, "contribute");
  assert.equal(NEEDS.actioninquiry, "contribute");
});

test("R73 (T50; project-roster R31–R33): projectstakeset is a project's setting decided by its owner's own predicate (owners: admin, member, probe, no working capability), by and viewer stamped; projectstake and projectownersgone are reads for a session only (ownread), viewer stamped; projectId is a query field of all three and the stake the query's (negative control: a body projectId does not reach, and an ai credential is refused the two reads)", async () => {
  assert.deepEqual(plain(OPS.projectstakeset), plain(OPS.projectvisibilityset), "projectvisibilityset's posture");
  assert.equal(NEEDS.projectstakeset, null);
  for (const op of ["projectstakeset", "projectstake", "projectownersgone"]) {
    assert.ok(keysOf(projectRosterOps).includes(op), `${op}: project-roster's map does not route it`);
    assert.ok(await reaches(projectRosterOps, op, { query: { projectId: SENT } }), `${op}: projectId is the query's`);
    assert.ok(await reaches(projectRosterOps, op, { query: { viewer: SENT } }), `${op}: viewer is the query's`);
    assert.ok(!(await reaches(projectRosterOps, op, { body: { projectId: SENT } })), `${op}: a body projectId reached the owner`);
    assert.ok(!(await reaches(projectRosterOps, op, { body: { viewer: SENT } })), `${op}: a body viewer reached the owner`);
  }
  assert.ok(await reaches(projectRosterOps, "projectstakeset", { query: { by: SENT } }), "projectstakeset: by is the query's");
  assert.ok(await reaches(projectRosterOps, "projectstakeset", { query: { stake: SENT } }), "projectstakeset: stake is the query's");
  assert.ok(!(await reaches(projectRosterOps, "projectstakeset", { body: { by: SENT } })), "a body by reached the owner");
  for (const op of ["projectstake", "projectownersgone"]) {
    assert.equal(OP_FAMILIES["project-roster"].kinds[op], "ownread");
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer or an ai credential is admitted`);
  }
  assert.ok(OP_FAMILIES["project-roster"].acts.includes("projectstakeset"));
});

test("R73 (T50; membership R148, acquisition R46): lookedat and opencaptures are reads for a session only (ownread), by stamped from the query and never a request field, viewer stamped beside it; opencaptures takes no instant from the request (negative control: a body by, or a query or body now, does not reach the owner)", async () => {
  assert.ok(keysOf(membershipOps).includes("lookedat"));
  assert.ok(keysOf(captureOps).includes("opencaptures"), "capture's map passes opencaptures through (acquisition R46, capture R73)");
  assert.ok(await reaches(membershipOps, "lookedat", { query: { by: SENT } }), "lookedat: by is the query's");
  assert.ok(!(await reaches(membershipOps, "lookedat", { body: { by: SENT } })), "lookedat: a body by reached the owner");
  assert.ok(await reaches(captureOps, "opencaptures", { query: { by: SENT } }), "opencaptures: by is the query's");
  assert.ok(!(await reaches(captureOps, "opencaptures", { body: { by: SENT } })), "opencaptures: a body by reached the owner");
  assert.ok(!(await reaches(captureOps, "opencaptures", { query: { now: SENT } })), "opencaptures: a query now reached the owner");
  assert.ok(!(await reaches(captureOps, "opencaptures", { body: { now: SENT, nowMs: SENT } })), "opencaptures: a body now reached the owner");
  for (const op of ["lookedat", "opencaptures"]) {
    assert.deepEqual(OP_FAMILIES[T50[op].owner].extra[op], ["by"], `${op}: by is its extra stamp`);
    assert.ok(OP_FAMILIES[T50[op].owner].reads.includes(op), `${op}: a read of the family`);
    assert.equal(OPS[op].mutating, false);
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer or an ai credential is admitted`);
  }
  assert.ok(!OP_FAMILIES.membership.acts.includes("lookedat"));
});

test("R73 (T50; retrieval R85, capture R95, inquiry R65, progressions R44, filings R62): browse, capturegrade, inquirypartition, instances and stakeatpreparation are reads (admin, member, probe; NEEDS null), viewer stamped, and each parameter is the owner's — kinds, only, since, after, limit; captureSha; id; set, limit, after; action — read where the owner reads it, a body viewer never (negative control: a body viewer does not reach any of the five)", async () => {
  const fields = {
    browse: { map: retrievalRoutes, query: ["kinds", "only", "since", "after", "limit"], body: ["kinds", "only", "since", "after", "limit"] },
    capturegrade: { map: captureOps, query: ["capture"], body: ["captureSha"] },
    inquirypartition: { map: inquiryOps, query: ["id"], body: ["id"] },
    instances: { map: progressionOps, query: ["set", "limit", "after"], body: ["set", "limit", "after"] },
    stakeatpreparation: { map: filingsOps, query: ["action"], body: ["action"] },
  };
  assert.deepEqual(Object.keys(fields).sort(), [...READS].sort());
  for (const [op, f] of Object.entries(fields)) {
    assert.ok(keysOf(f.map).includes(op), `${op}: ${T50[op].owner}'s map does not route it`);
    assert.ok(await reaches(f.map, op, { query: { viewer: SENT } }), `${op}: viewer is the query's`);
    assert.ok(!(await reaches(f.map, op, { body: { viewer: SENT } })), `${op}: a body viewer reached the owner`);
    for (const k of f.query) assert.ok(await reaches(f.map, op, { query: { [k]: SENT } }), `${op}: ${k} is not the query's`);
    for (const k of f.body) assert.ok(await reaches(f.map, op, { body: { [k]: SENT } }), `${op}: ${k} is not the body's`);
    assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false }, op);
    assert.equal(NEEDS[op], null, op);
    assert.ok(OP_FAMILIES[T50[op].owner].reads.includes(op), op);
  }
});

test("R73, R6 (T50): every one of the 15 is served by its owner's map, or by the route named for it — opencaptures by capture's map (acquisition R46 through capture R73), browse by retrieval's routes — and no owner's map serves a T50 op this module leaves undeclared (negative control: an op added to a map without a spec is seen)", () => {
  const served = (routes, ...rest) => { const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
    return Object.keys(routes(svc, new URL("http://plane/"), {}, ...rest)); };
  for (const [op, w] of Object.entries(T50)) {
    const routes = op === "opencaptures" ? captureOps : MAPS[w.owner];
    assert.ok(routes, `${op}: no map named for ${w.owner}`);
    assert.ok(served(routes, undefined).includes(op), `${op}: not served by ${w.owner}'s map`);
  }
  /* the T50 ops of these owners' maps all have a spec */
  const T50_NAMES = new Set(Object.keys(T50));
  for (const routes of [followingOps, projectRosterOps, actionRecordsOps, progressionOps])
    for (const op of served(routes, undefined)) if (T50_NAMES.has(op)) assert.ok(Object.hasOwn(OPS, op), op);
  /* negative control */
  assert.ok(!served(followingOps).includes("watchitems"));
  assert.ok(![...T50_NAMES].some((op) => !Object.hasOwn(OPS, op)));
});

test("R73, R34 (T50; affordances R65): watchitem, secondlook, secondlookclear, projectstakeset, actionstake and actioninquiry are explained in ACT_HELP and named under no ground of ACT_HELP_ABSENT, and the nine reads are named under the read ground, as reads a screen draws from, and not explained — never both (negative control: an explained op is named under no ground; these tests are red until affordances' T50-19 job merges its texts, a dependency not yet built)", () => {
  for (const op of ["watchitem", "secondlook", "secondlookclear", "projectstakeset", "actionstake", "actioninquiry"]) {
    assert.ok(SESSION_OPS.member.has(op), op);
    assert.equal(explained(op), true, `${op}: no ACT_HELP text (affordances R65)`);
    assert.deepEqual(ground(op), [], `${op} is explained and named`);
  }
  for (const op of [...OWNREADS, ...READS]) {
    assert.ok(SESSION_OPS.member.has(op), op);
    assert.deepEqual(ground(op), ["read"], `${op}: not under the read ground`);
    assert.equal(explained(op), false, `${op}: explained and named`);
  }
  /* negative control */
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

test("R73 (T50): a declared op with no owner line fails — every share and family carries a citation naming its owner's requirement and R73, the frozen data names no place, and the check rejects a share without a citation (negative control)", () => {
  const cited = (s) => typeof s.cite === "string" && /\bR\d+/.test(s.cite) && /\bR73\b/.test(s.cite);
  for (const [owner, s] of Object.entries(T50_SHARES)) assert.ok(cited(s), `${owner}: the share cites no owner line`);
  for (const f of T50_FAMILIES) assert.ok(cited(f), `${f.owner}: the family cites no owner line`);
  assert.doesNotMatch(JSON.stringify([T50_SHARES, T50_FAMILIES]), /oakland|alameda|california|city of|county of/i);
  /* every share's owner has a family in OP_FAMILIES, and every T50 family an owner no other names */
  for (const owner of Object.keys(T50_SHARES)) assert.ok(Object.hasOwn(OP_FAMILIES, owner), `${owner}: a share with no family`);
  assert.deepEqual(T50_FAMILIES.map((f) => f.owner).sort(), ["action-records", "progressions"]);
  /* negative control */
  assert.equal(cited({ cite: "", ops: {} }), false);
  assert.equal(cited({ cite: "following R32", ops: {} }), false);
  assert.equal(cited({ ops: {} }), false);
});

/* ---------- R74 ---------- */

test("R74 (T50; doorbell R13): inboxpull and inboxresolve are stamped viewer by the control plane, never taken from the request, in the act list that stamps their by — CAPTURE_VIEWER_ACTIONS names both, beside capture's two held acts, and inboxpull stays in CAPTURE_MEMBER_ACTIONS — and their specs are unchanged (negative control: an op in neither list is stamped nothing here)", () => {
  assert.deepEqual([...CAPTURE_VIEWER_ACTIONS], ["heldsetaside", "heldrestore", "inboxpull", "inboxresolve"]);
  assert.ok(CAPTURE_MEMBER_ACTIONS.includes("inboxpull"), "inboxpull's by stamp");
  assert.ok(Object.isFrozen(CAPTURE_VIEWER_ACTIONS));
  /* pre-T50 specs */
  assert.deepEqual(plain(OPS.inboxpull), { classes: SESSION, machineClasses: [], mutating: true });
  assert.deepEqual(plain(OPS.inboxresolve), { classes: MP, mutating: true });
  assert.ok(SESSION_OPS.member.has("inboxpull") && SESSION_OPS.admin.has("inboxpull"));
  assert.ok(SESSION_OPS.member.has("inboxresolve") && SESSION_OPS.admin.has("inboxresolve"));
  /* negative control */
  assert.ok(!CAPTURE_VIEWER_ACTIONS.includes("reattest") && !CAPTURE_VIEWER_ACTIONS.includes("inboxget"));
  assert.ok(!CAPTURE_VIEWER_ACTIONS.includes("nosuchop"));
});

test("R74 (T50; events R53, entities R54, acquisition R47, ai-runs R89, agent-worker R114): each existing op that gains a request field keeps its pre-T50 spec and gains no stamp or table row — timeline, entitycreate, acquire, airunopen, airuntick (the log entry's read shape needs no declaration), importedcases, airunlog and meaningrows — and the stamps of followregister and exploreverify are as before (negative control: a field is never a stamp)", () => {
  const SPECS = {
    timeline: { classes: MP, mutating: false }, entitycreate: { classes: MP, mutating: true },
    acquire: { classes: [...MP, "daemon"], mutating: true }, airunopen: { classes: MP, mutating: true },
    airuntick: { classes: MP, mutating: true }, importedcases: { classes: SESSION, machineClasses: [], mutating: false },
    airunlog: { classes: MP, mutating: false }, meaningrows: { classes: MP, mutating: false },
  };
  for (const [op, spec] of Object.entries(SPECS)) assert.deepEqual(plain(OPS[op]), spec, `${op}: the pre-T50 spec`);
  /* `captures`, `forum_kind`, `for`, `project` and `read` are request fields, no stamp: none appears in any stamp list */
  const FIELDS = ["captures", "forum_kind", "for", "project", "read", "record", "outcome"];
  for (const op of Object.keys(SPECS)) {
    const st = stamps(op) ?? [];
    for (const k of FIELDS) assert.ok(!st.includes(k), `${op}: ${k} is stamped`);
  }
  /* timeline stays events' read, viewer stamped, NEEDS null; entitycreate entities' act, as before */
  assert.deepEqual(familyOf("timeline"), ["events"]);
  assert.equal(OP_FAMILIES.events.kinds.timeline, "read");
  assert.deepEqual(stamps("timeline"), ["viewer"]);
  assert.equal(NEEDS.timeline, null);
  assert.deepEqual(stamps("followregister"), ["by", "viewer"]);
  assert.deepEqual(stamps("exploreverify"), ["viewer"]);
  assert.deepEqual(familyOf("exploreverify"), ["explore"]);
  /* negative control: the table gained no op for these fields */
  assert.ok(!Object.hasOwn(OPS, "captures") && !Object.hasOwn(OPS, "forum_kind"));
});

test("R74, R73 (T50; events R53): timeline's captures — capture digests, at most 200 — is a comma list in the query or, for a long list, captures in the body, the owner reading the query first, then the body: the door passes both as given, so the spec carries no field and the owner's map is the site (negative control: a stamp key named captures is not a stamp)", async () => {
  const { eventsOps } = await import("../../../src/events/index.mjs");
  assert.ok(keysOf(eventsOps).includes("timeline"));
  assert.ok(await reaches(eventsOps, "timeline", { query: { captures: SENT } }), "captures is the query's");
  assert.ok(await reaches(eventsOps, "timeline", { body: { captures: [SENT] } }), "captures is the body's, for a long list");
  assert.ok(await reaches(eventsOps, "timeline", { query: { viewer: SENT } }), "viewer is the query's");
  assert.ok(!(await reaches(eventsOps, "timeline", { body: { viewer: SENT } })), "a body viewer reached the owner");
  /* the query first, then the body */
  const both = await drive(eventsOps, "timeline", { query: { captures: "q-first" }, body: { captures: ["b-second"] } });
  assert.ok(both.includes("q-first") && !both.includes("b-second"), "the owner reads the body only when the query has none");
  /* negative control */
  assert.ok(!OP_STAMPS.timeline.includes("captures"));
});

test("R74, R73 (T50; entities R54, acquisition R47, ai-runs R89): entitycreate takes forum_kind, acquire takes for in the body (read only from a member session, ignored from any other caller), airunopen takes project — each op's spec unchanged, none a stamp (negative control: acquire's for from a non-member caller is ignored as its owner states, and a query for is not the body's)", async () => {
  const { entitiesOps } = await import("../../../src/entities/index.mjs");
  const { aiRunsOps } = await import("../../../src/ai-runs/index.mjs");
  assert.ok(await reaches(entitiesOps, "entitycreate", { body: { forum_kind: SENT } }), "forum_kind is the body's");
  assert.ok(await reaches(aiRunsOps, "airunopen", { body: { project: SENT } }), "project is the body's");
  /* acquire's `for` is the body's, handed to the owner with the caller's class and member flag, which the owner reads */
  assert.ok(await reaches(captureOps, "acquire", { body: { for: SENT }, query: { member: "1", sessMember: "member:m" } }), "for reaches capture's acquire in the body");
  assert.ok(!(await reaches(captureOps, "acquire", { query: { for: SENT } })), "a query for reached the owner");
  for (const op of ["entitycreate", "acquire", "airunopen"]) {
    const st = stamps(op) ?? [];
    for (const k of ["forum_kind", "for", "project"]) assert.ok(!st.includes(k), `${op}: ${k} is stamped`);
  }
});

/* ---------- R75 ---------- */

test("R75 (T50; affordances R64, R66; DEC-264, DEC-309 (5)): reauth leaves ACT_HELP_ABSENT, now explained by act.reauth.does, and aliaswithdraw, factconfirm, projectrequest, projectrequestwithdraw and projectrequestanswer leave it too, each now explained by its does word — none of the six is named under any ground, each is held by ACT_HELP (negative control: an op the design still has not explained stays in it with its ground, and no op is both explained and named, R34)", () => {
  const LEAVING = ["reauth", "aliaswithdraw", "factconfirm", "projectrequest", "projectrequestwithdraw", "projectrequestanswer"];
  for (const op of LEAVING) {
    assert.ok(SESSION_OPS.member.has(op), `${op}: not a member op`);
    assert.deepEqual(ground(op), [], `${op} is still named in ACT_HELP_ABSENT`);
    assert.equal(explained(op), true, `${op}: not held by ACT_HELP (affordances R64, R66)`);
  }
  /* negative control: an op the design has not yet explained stays named, under its ground, and is not explained */
  assert.deepEqual(ground("stepcreate"), ["unexplained"]);
  assert.equal(explained("stepcreate"), false);
  assert.deepEqual(ground("projectownervotes"), ["read"]);
  /* no op is both (R34) */
  const named = Object.values(ACT_HELP_ABSENT).flatMap((g) => [...g.ops]);
  assert.deepEqual(named.filter((op) => explained(op)), [], "an op both explained and named");
  assert.equal(new Set(named).size, named.length, "an op named under two grounds");
});

test("R73, R21 (T50; wizard-scripts R41, B2 CHANGE): every act of the registry has a declaration — registryActGaps over SCREEN_REGISTRY and the declared ops finds none, the installer's four own routes excluded by name — and the check sees a gap (negative control: an op withdrawn from the declared set is found)", () => {
  const declared = new Set(Object.keys(OPS));
  /* T51 fix round (R73, R21): an owed act its owner declares is no gap. The owners' declarations are read from the
     registration (`register-owners.mjs`, R80), never listed here: member-roster's `expertisewithdraw` (R79, DEC-386) is one. */
  const DECLARED_NOW = Object.values(REGISTERED).flatMap((rows) => Object.keys(rows));
  for (const op of DECLARED_NOW) assert.ok(declared.has(op), `${op}: declared but not in OPS`);
  const OWED_NOW = OWED_BY_FIX_ROUND.filter((act) => !DECLARED_NOW.includes(act));
  /* T51 (R76): the seven browser acts are owed rows of the registry and no op, a class of their own: they are the only gaps */
  const gapsOf = (d) => registryActGaps({ screens: SCREEN_REGISTRY, declared: d });
  assert.deepEqual(gapsOf(declared).filter((g) => !Object.hasOwn(O.BROWSER_ACTS, g.act) && !OWED_NOW.includes(g.act)), []);
  assert.deepEqual([...new Set(gapsOf(declared).map((g) => g.act))].sort(), [...Object.keys(O.BROWSER_ACTS), ...OWED_NOW].sort());
  for (const op of INSTALLER_ROUTES) assert.equal(Object.hasOwn(OPS, op), false, `${op}: declared`);
  for (const op of ["watchitem", "secondlook", "secondlookclear", "projectstakeset", "actionstake", "actioninquiry"]) assert.ok(declared.has(op), op);
  const without = new Set([...declared].filter((op) => op !== "secondlookclear"));
  assert.deepEqual(gapsOf(without).filter((g) => !Object.hasOwn(O.BROWSER_ACTS, g.act) && !OWED_NOW.includes(g.act)).map((g) => g.act), ["secondlookclear"]);
});

test("R73, R3 (T50; B3, screens-investigate R31): themeread and instances are in both session sets, so the act gate answers session for a member and the theme screen draws its Search act; their specs are unchanged and no NEEDS row gates them (negative control: an op in neither set answers machine)", () => {
  for (const op of ["themeread", "instances"]) {
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op}: not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false }, op);
    assert.equal(ACT_GATE.needs(op), null, op);
  }
  assert.equal(ACT_GATE.mode("purge"), "machine");
});
