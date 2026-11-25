/* op-declarations, T49 (R3, R71, R72; K3298, K3339; N1072, N1091; K3265, K3333; DEC-237 (3)): `NEEDS` composed from
   `op-capabilities.needsRows()` and the families' rows (R3), the founder's handle op and the project owners' votes read,
   with R34 over each. Each op is tested by name with its controls (K874). Specs, sets, rows and
   stamps are read from the exported tables; each stamp is driven through its owner's own ops map (membership's,
   project-roster's), so a stamp named at a site the owner does not read is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import { T49_SHARES } from "../../../src/op-declarations/t49.mjs";
import { composeNeeds } from "../../../src/op-declarations/compose.mjs";
import { needsRows } from "../../../src/op-capabilities/index.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_KINDS, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT } = O;
const SESSION = ["admin", "member"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon", "ai"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

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
const SENT = "member:sentinel-49";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);

/* what an op of the shared conditions is: in neither bearer fence, off AI_GRANT_OPS, no `ai` class, never unattended,
   no alias, in no other list, frozen, a present `null` row */
const shared = (op) => {
  assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
  assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, `${op}: a present null NEEDS row`);
  assert.equal(ACT_GATE.needs(op), null, op);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), `${op}: names ai`);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
  assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
};

/* ---------- R71 ---------- */

test("R71 (T49; N1072; K3265; membership R144): founderhandleset, in membership's family, is in SESSION_OPS.admin only (the founder's session) with classes admin, machineClasses [], mutating, a present null NEEDS row and by and viewer stamped; in neither GOVERNANCE_ACTIONS nor IDENTITY_ACTIONS and not on credentials' AI_GRANT_OPS (negative control: an enrolled member's set, an ai credential and a binding token do not reach it)", async () => {
  const op = "founderhandleset";
  shared(op);
  assert.deepEqual(familyOf(op), ["membership"]);
  assert.equal(OP_FAMILIES.membership.kinds[op], "founder");
  assert.deepEqual(plain(OPS[op]), { classes: ["admin"], machineClasses: [], mutating: true });
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  assert.ok(OP_FAMILIES.membership.acts.includes(op), "an act of the family, so `by` is stamped");
  /* the founder's set alone */
  assert.ok(SESSION_OPS.admin.has(op), "not in the founder's set");
  assert.ok(!SESSION_OPS.member.has(op), "in the member set");
  assert.equal(ACT_GATE.mode(op), "admin-session");
  assert.ok(!O.FAMILY_SESSION_OPS.includes(op), "FAMILY_SESSION_OPS holds the ops of both sets");
  assert.ok(O.FAMILY_OPS.includes(op));
  /* membership's map reads `by` from the query and `handle` from the body, and routes the op */
  assert.ok(keysOf(membershipOps).includes(op));
  assert.ok(await reaches(membershipOps, op, { query: { by: SENT } }), "by is the query's");
  assert.ok(await reaches(membershipOps, op, { body: { handle: SENT } }), "handle is the body's");
  /* controls */
  assert.ok(!(await reaches(membershipOps, op, { body: { by: SENT } })), "a body `by` reached the owner");
  assert.ok(!(await reaches(membershipOps, op, { query: { handle: SENT } })), "a query `handle` reached the owner");
  assert.equal(OPS[op].classes.includes("member"), false, "a member session is admitted by class");
  assert.equal(OPS[op].classes.includes("ai"), false, "an ai credential is admitted");
  assert.deepEqual(machineAdmits(op), [], "a binding token or an ai credential is admitted");
  assert.deepEqual(OPS[op].machineClasses, []);
  /* every other family op of a session kind is in both sets: this is the one the founder's set holds alone among the
     families' ops */
  for (const [o, k] of Object.entries(OP_KINDS)) if (k.founderOnly) assert.equal(o, "founder", "only the founder kind is founder-only");
  const founderOnlyOps = O.FAMILY_OPS.filter((o) => SESSION_OPS.admin.has(o) && !SESSION_OPS.member.has(o));
  assert.deepEqual(founderOnlyOps, [op]);
});

test("R71 (T49): claim's spec is unchanged — public, mutating, stamped source and country only, in no session set — and the T49 share names no body field for it (the door passes `handle`, control-plane R97)", () => {
  assert.deepEqual(plain(OPS.claim), { classes: null, mutating: true });
  assert.deepEqual(stamps("claim"), ["country", "source"]);
  assert.ok(!SESSION_OPS.member.has("claim") && !SESSION_OPS.admin.has("claim"));
  assert.ok(!Object.hasOwn(NEEDS, "claim") || NEEDS.claim === null);
  /* negative control: the T49 shares declare no op beside the two */
  assert.deepEqual(Object.values(T49_SHARES).flatMap((s) => Object.keys(s.ops)).sort(), ["founderhandleset", "projectownervotes"]);
  assert.ok(Object.isFrozen(T49_SHARES) && Object.values(T49_SHARES).every((s) => Object.isFrozen(s) && Object.isFrozen(s.ops)));
});

test("R71, R34 (T49; affordances R61): founderhandleset is explained by affordances' ACT_HELP under its own name, or else named under one ground of ACT_HELP_ABSENT until it is — never both (negative control: an explained op is named under no ground)", () => {
  const op = "founderhandleset";
  assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: explained and named, or neither`);
  if (!explained(op)) assert.deepEqual(ground(op), ["unexplained"]);
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R72 ---------- */

test("R72 (T49; N1091; DEC-237 (3); project-roster R30): projectownervotes, in project-roster's family, is a read for a member's session only — classes admin and member, machineClasses [], not mutating, viewer stamped, a present null NEEDS row, in both session sets, in neither GOVERNANCE_ACTIONS nor IDENTITY_ACTIONS and not on AI_GRANT_OPS (negative control: an ai credential, a binding token and a probe are not admitted; a viewer the caller sends is not the one stamped)", async () => {
  const op = "projectownervotes";
  shared(op);
  assert.deepEqual(familyOf(op), ["project-roster"]);
  assert.equal(OP_FAMILIES["project-roster"].kinds[op], "ownread");
  assert.deepEqual(plain(OPS[op]), { classes: SESSION, machineClasses: [], mutating: false });
  assert.deepEqual(stamps(op), ["viewer"]);
  assert.ok(OP_FAMILIES["project-roster"].reads.includes(op));
  assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op));
  assert.equal(ACT_GATE.mode(op), "session");
  assert.ok(O.FAMILY_SESSION_OPS.includes(op));
  /* project-roster's map routes it: the project is the query's and the viewer is read from the query (the door's stamp) */
  assert.ok(keysOf(projectRosterOps).includes(op));
  assert.ok(await reaches(projectRosterOps, op, { query: { projectId: SENT } }), "projectId is the query's");
  assert.ok(await reaches(projectRosterOps, op, { query: { viewer: SENT } }), "viewer is the query's, the door's stamp");
  /* controls */
  assert.ok(!(await reaches(projectRosterOps, op, { body: { viewer: SENT } })), "a body viewer reached the owner");
  assert.ok(!(await reaches(projectRosterOps, op, { body: { projectId: SENT } })), "a body project reached the owner");
  for (const cls of ["ai", "probe", "daemon"]) assert.equal(OPS[op].classes.includes(cls), false, `${cls} is admitted by class`);
  assert.deepEqual(machineAdmits(op), [], "a binding token or an ai credential is admitted");
  assert.equal(OPS[op].mutating, false);
});

test("R72, R34 (T49): projectownervotes is named in ACT_HELP_ABSENT under the read ground (a read a screen draws from) while affordances' ACT_HELP holds no text for it, and under none once it does — never both (negative control: an explained op is named under no ground)", () => {
  const op = "projectownervotes";
  assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: explained and named, or neither`);
  if (!explained(op)) assert.deepEqual(ground(op), ["read"]);
  assert.ok(SESSION_OPS.member.has(op));
  assert.ok(explained("statementack") && ground("statementack").length === 0);
});

/* ---------- R3 ---------- */

/* what the families' kinds give: a row for every family op whose kind has one (`needs: undefined` is no row) */
const familyRows = () => Object.fromEntries(Object.values(OP_FAMILIES).flatMap((f) => Object.entries(f.kinds)
  .filter(([, k]) => OP_KINDS[k].needs !== undefined).map(([op, k]) => [op, OP_KINDS[k].needs])));

test("R3 (T49; K3298, K3339): NEEDS is composed from op-capabilities.needsRows() (323 hand-written rows) and each family op's row from its kind (534 rows), the aliases applied over the whole — 882 keys, the 848 it held before the split, the two T49 family ops, the 15 T50 adds (R73) and the 16 T51 adds (R77 to R79, R22 `holdsplaced`) — every hand-written row and every family row answered as given, every alias row equal to its op's, the table frozen and the same on every read", () => {
  const hand = needsRows();
  const fam = familyRows();
  assert.equal(Object.keys(hand).length, 323);
  assert.equal(Object.keys(fam).length, 500 + 15 + 16 + 1 + 1 + 1, "T49's 500, R73's 15, T51's 16 (action-holds R22's `holdsplaced` among them) and strength's `strengthbarset` (R21, K4254) (R77 to R79; publishedfrozen, public, a present null row), money's `moneysets` (R17, R19; T51 fix round 3, K4369) and calculations' `moneyingestread` (T51 fix round 6, G55)");
  /* the two parts share no op */
  assert.deepEqual(Object.keys(fam).filter((op) => Object.hasOwn(hand, op)), []);
  const aliasRows = Object.entries(OP_ALIASES).filter(([, op]) => Object.hasOwn(NEEDS, op)).map(([al]) => al);
  assert.equal(aliasRows.length, 26);
  /* R83 (K4237): and `export`'s row, the founder's session act that is no family op */
  assert.equal(Object.keys(NEEDS).length, 323 + 534 + 26 + 1);
  assert.equal(Object.keys(NEEDS).length, 848 + 2 + 15 + 16 + 1 + 1 + 1, "848 before the split, founderhandleset and projectownervotes (T49), R73's 15 (T50), T51's 16, export (R83), moneysets (T51 fix round 3) and moneyingestread (T51 fix round 6)");
  for (const [op, row] of Object.entries(hand)) assert.equal(NEEDS[op], row, `${op}: the hand-written row`);
  for (const [op, row] of Object.entries(fam)) assert.equal(NEEDS[op], row, `${op}: the family row`);
  for (const al of aliasRows) assert.equal(NEEDS[al], NEEDS[OP_ALIASES[al]], `${al}: an alias row equals its op's`);
  /* nothing else is in the table */
  assert.deepEqual(Object.keys(NEEDS).filter((op) => !Object.hasOwn(hand, op) && !Object.hasOwn(fam, op) && !aliasRows.includes(op)), ["export"]);
  /* the new ops' rows come from their kinds: present nulls */
  for (const op of ["founderhandleset", "projectownervotes"]) assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
  assert.ok(!Object.hasOwn(hand, "founderhandleset") && !Object.hasOwn(hand, "projectownervotes"));
  /* frozen, and the act gate reads this very table (R1) */
  assert.ok(Object.isFrozen(NEEDS) && Object.isFrozen(O.NEEDS) && O.NEEDS === NEEDS);
  assert.throws(() => { NEEDS.promote = null; }, TypeError);
  for (const op of ["promote", "ratify", "projectfork", "templatedraft", "projectownervotes"]) assert.equal(ACT_GATE.needs(op), NEEDS[op], op);
  assert.equal(NEEDS.projectfork, "create_projects");
  assert.equal(NEEDS.ratify, "publish");
  /* negative control: an op with no row has none, and the gate answers null for it */
  assert.ok(!Object.hasOwn(NEEDS, "search") && ACT_GATE.needs("search") === null);
});

test("R3 (T49; K3339): composeNeeds joins the hand-written rows and the families' and refuses a family row for an op the hand-written part holds, rather than letting the later key win; the result is a fresh table, the hand-written part untouched (negative control: a disjoint pair composes, an overlap throws by name)", () => {
  const hand = Object.freeze({ promote: "contribute", ratify: "publish", credit: null });
  const fam = { eventcreate: "contribute", timeline: null };
  const out = composeNeeds(hand, fam);
  assert.deepEqual(out, { promote: "contribute", ratify: "publish", credit: null, eventcreate: "contribute", timeline: null });
  assert.ok(!Object.isFrozen(out), "a fresh table, for the aliases to be applied over");
  assert.deepEqual({ ...hand }, { promote: "contribute", ratify: "publish", credit: null });
  assert.deepEqual(fam, { eventcreate: "contribute", timeline: null });
  /* an overlap fails, whatever the two rows are — even when they agree */
  assert.throws(() => composeNeeds(hand, { promote: "publish" }), /promote.*family row.*hand-written row/);
  assert.throws(() => composeNeeds(hand, { promote: "contribute" }), TypeError);
  assert.throws(() => composeNeeds(hand, { credit: null }), TypeError);
  /* an empty part composes to the other */
  assert.deepEqual(composeNeeds(hand, {}), { ...hand });
  assert.deepEqual(composeNeeds({}, fam), fam);
});

test("R3 (T49; op-capabilities R1): the hand-written half comes from needsRows() alone — the same frozen object on every call, and a hand-written row is never one the families give (every family op's kind row and every hand row are disjoint over the live tables) (negative control: a family op answered by needsRows() is undefined, not null)", () => {
  assert.equal(needsRows(), needsRows());
  assert.ok(Object.isFrozen(needsRows()));
  for (const op of Object.keys(familyRows())) assert.equal(needsRows()[op], undefined, `${op}: both a hand-written row and a family row`);
  assert.equal(needsRows().eventcreate, undefined);
  assert.equal(NEEDS.eventcreate, "contribute");
});
