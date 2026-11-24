/* op-declarations R47, R48 and R34, R6 over them (T42-26; N832, N839, N862; K2611, K2613, K2635, K2656): T42's op —
   `pagetranscribe`, the AI's transcription of a stored PDF reading's pages, in a family of extraction's own — and the
   account ops' new owner, `case-account`. Each spec, row, session set, stamp and list is compared whole at the exported
   tables; the address fields are driven through extraction's exported handler, so a field read from anywhere else is
   seen. Each comparison has a negative control. */
import { test } from "node:test";
import assert from "node:assert/strict";
import "./register-owners.mjs";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { pageTranscribeOp, pdfStructureOp, EXTRACTION_OPS } from "../../../src/extraction/ops.mjs";
import { CaseAccount } from "../../../src/case-account/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, ACT_HELP_ABSENT, PLAN_RUN_SCOPE, ASK_GRANT_OPS } = O;
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const familyOf = (op) => Object.values(OP_FAMILIES).filter((f) => Object.hasOwn(f.kinds, op)).map((f) => f.owner);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v))
  .concat([["PLAN_RUN_SCOPE.reads", PLAN_RUN_SCOPE.reads], ["PLAN_RUN_SCOPE.writes", PLAN_RUN_SCOPE.writes]]);
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "member", "probe", "daemon"]
  .filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));
const ground = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

/* A member session's act or read, as R43, R45 and R47 state it. */
const MEMBER_ACT = { classes: ["admin", "member"], machineClasses: [], mutating: true };
const SESSION_READ = { classes: ["admin", "member"], machineClasses: [], mutating: false };
const holdsSessionOnly = (op) => {
  assert.ok(both(op), `${op}: not in both session sets`);
  assert.equal(ACT_GATE.mode(op), "session", op);
  assert.deepEqual(machineAdmits(op), [], `${op}: a bearer reaches it`);
  assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
  assert.ok(!AI_GRANT_OPS.includes(op) && !ASK_GRANT_OPS.includes(op), `${op}: on a grant's list`);
  assert.ok(!JSON.stringify(OPS[op]).includes('"ai"'), op);
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
  assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
  assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
  assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), op);
};

/* extraction's handler over a recording store: the path the Durable Object is asked, or null when it is not asked. */
const HOOKS = { json: (o, status = 200) => ({ o, status }), storeSilent: () => ({ silent: true }), storeRefusal: (r) => r,
  storageAbsent: (op) => ({ absent: op }), requiredArgument: (op, field) => ({ reason: "REQUIRED", op, field }) };
const ENV = { CAPTURES: { get: () => null } };
const driveHandler = async (handler, address, stamped = {}, body = undefined) => {
  const url = new URL(`http://plane/?${new URLSearchParams(address)}`);
  let asked = null;
  const store = { fetch: async (path, init) => { asked = { path: new URL(path), init };
    return new Response(JSON.stringify({ ok: true, result: { ok: true } })); } };
  const answer = await handler(url, ENV, store, { ...HOOKS, ...stamped, body });
  return { asked, answer };
};
const SHA = "a".repeat(64);
const SENT = "member:sentinel-42";

/* ---------- R47 ---------- */

test("R47 (T42; N832; extraction R71; K2611, K2613): pagetranscribe — a member's session only (classes admin, member; machineClasses []), mutating, NEEDS contribute, by and viewer stamped, in both session sets, in a family of extraction's own (kind member), in neither bearer fence, on no grant's list, in no act list, distinct from content's manual transcribe (negative control: a drifted spec, a bearer and transcribe are each seen)", () => {
  const op = "pagetranscribe";
  assert.ok(Object.hasOwn(OPS, op), "pagetranscribe has no spec");
  assert.deepEqual(plain(OPS[op]), MEMBER_ACT);
  assert.ok(Object.hasOwn(NEEDS, op));
  assert.equal(NEEDS[op], "contribute");
  assert.equal(ACT_GATE.needs(op), "contribute");
  assert.deepEqual(stamps(op), ["by", "viewer"]);
  holdsSessionOnly(op);
  /* its family: extraction's own, the one op in it, kind member, the actor `by` from the query */
  assert.deepEqual(familyOf(op), ["extraction"]);
  const fam = OP_FAMILIES.extraction;
  assert.equal(fam.owner, "extraction");
  assert.deepEqual(plain(fam.kinds), { pagetranscribe: "member" });
  assert.deepEqual(plain(fam.actor), { key: "by", at: "query" });
  assert.deepEqual([...fam.acts], [op]);
  assert.deepEqual([...fam.reads], []);
  assert.deepEqual([...fam.proposals], []);
  assert.match(fam.cite, /extraction R71/);
  assert.match(fam.cite, /R47/);
  assert.ok(O.FAMILY_OPS.includes(op) && O.FAMILY_SESSION_OPS.includes(op));
  /* the address fields are no stamps: the door sets nothing named sha256 or project */
  for (const k of ["sha256", "project", "captureSha", "member", "session"]) assert.ok(!stamps(op).includes(k), k);
  /* distinct from content R23's manual transcribe, whose spec and family are its own */
  assert.ok(Object.hasOwn(OPS, "transcribe"));
  assert.deepEqual(familyOf("transcribe"), []);
  assert.notEqual(OPS.transcribe, OPS[op]);
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS[op], machineClasses: undefined }), MEMBER_ACT);
  assert.notDeepEqual(plain({ ...OPS[op], mutating: false }), MEMBER_ACT);
  assert.notDeepEqual(machineAdmits("pdfstructure"), [], "pdfstructure admits a bearer");
  assert.ok(!Object.hasOwn(OPS, "pagetranscribenosuch"));
});

test("R47, R6 (K2635, K2656): pagetranscribe's handler is extraction's exported pageTranscribeOp, which EXTRACTION_OPS does not list; it reads sha256 and the optional project from the request's address only, as pdfstructure's sha256 (a body copy does not reach), and hands the store the viewer and actor the door stamps (negative control: a malformed digest never reaches the store)", async () => {
  assert.equal(typeof pageTranscribeOp, "function");
  assert.ok(!EXTRACTION_OPS.includes("pagetranscribe"), "EXTRACTION_OPS lists pagetranscribe");
  assert.ok(EXTRACTION_OPS.includes("pdfstructure"));
  /* sha256 and project from the address */
  const { asked } = await driveHandler(pageTranscribeOp, { sha256: SHA, project: "PRJ-sentinel" },
                                       { cls: "member", session: true, caps: ["contribute"], viewer: SENT, author: SENT });
  assert.ok(asked, "the store was not asked");
  assert.equal(asked.path.pathname, "/pagetranscribe");
  assert.equal(asked.path.searchParams.get("sha256"), SHA);
  assert.equal(asked.path.searchParams.get("project"), "PRJ-sentinel");
  assert.equal(asked.path.searchParams.get("viewer"), SENT);
  assert.equal(asked.path.searchParams.get("author"), SENT);
  assert.equal(asked.init, undefined, "the store is handed a body");
  /* project is optional: without it, none is handed */
  const none = await driveHandler(pageTranscribeOp, { sha256: SHA }, { viewer: SENT });
  assert.ok(none.asked && !none.asked.path.searchParams.has("project"));
  /* a body's sha256 and project do not reach: the handler reads the address only */
  const fromBody = await driveHandler(pageTranscribeOp, {}, { viewer: SENT }, { sha256: SHA, project: "PRJ-body" });
  assert.equal(fromBody.asked, null, "a body's sha256 reached the store");
  assert.equal(fromBody.answer.status, 400);
  assert.equal(fromBody.answer.o.field, "sha256");
  /* as pdfstructure's sha256 */
  const pdf = await driveHandler(pdfStructureOp, { sha256: SHA }, { viewer: SENT });
  assert.equal(pdf.asked.path.searchParams.get("sha256"), SHA);
  /* negative control */
  const bad = await driveHandler(pageTranscribeOp, { sha256: "not-a-digest" }, { viewer: SENT });
  assert.equal(bad.asked, null);
  assert.equal(bad.answer.status, 400);
});

test("R47, R34 (N862; T43: DEC-190, K2725): pagetranscribe, and content's manual transcribe beside it, are explained in affordances' ACT_HELP since its T43-17 (the design's texts) and so named under no ground of ACT_HELP_ABSENT, the last ground they held until then; every member-session op is explained or named, never both, and every named op is held by OPS (negative control: an explained op is named under no ground)", () => {
  for (const op of ["pagetranscribe", "transcribe"]) {
    assert.ok(SESSION_OPS.member.has(op), `${op} is no member op`);
    assert.equal(explained(op), true, `${op}: no ACT_HELP text`);
    assert.deepEqual(ground(op), [], `${op} is explained and named`);
  }
  assert.match(ACT_HELP_ABSENT.unexplained.ground, /not yet explained/);
  const named = Object.values(ACT_HELP_ABSENT).flatMap((g) => [...g.ops]);
  for (const op of SESSION_OPS.member) {
    const n = ground(op).length;
    assert.ok(n <= 1, `${op} under ${n} grounds`);
    assert.equal(explained(op) ? 0 : 1, n, `${op}: ${explained(op) ? "explained and named" : "neither explained nor named"}`);
  }
  for (const op of named) assert.ok(Object.hasOwn(OPS, op), `${op}: named, no spec`);
  /* each ground's list is sorted, distinct and frozen */
  for (const [k, g] of Object.entries(ACT_HELP_ABSENT)) {
    assert.ok(Object.isFrozen(g) && Object.isFrozen(g.ops), k);
    assert.deepEqual([...g.ops], [...new Set(g.ops)].sort(), k);
  }
  /* negative control */
  const anExplained = [...SESSION_OPS.member].find(explained);
  assert.ok(anExplained);
  assert.deepEqual(ground(anExplained), []);
});

/* ---------- R48 ---------- */

test("R48 (T42; N839; case-account R1, R3; K2608, K2656): accountpropose and accountdrafts sit in case-account's own family (owner case-account, cite case-account R1, R3; R43; K2569, K2608), their specs, sets, NEEDS rows and stamps R43's unchanged — accountpropose a member session's act, contribute, by stamped (handed as proposedBy), accountdrafts a session's read, viewer stamped — and no family names case-authoring for them (negative control: case-authoring holds no family)", () => {
  const fam = OP_FAMILIES["case-account"];
  assert.ok(fam, "no case-account family");
  assert.equal(fam.owner, "case-account");
  assert.equal(fam.cite, "case-account R1, R3; R43; K2569, K2608");
  /* T45 (R49; case-account R13, K2834): the family also holds T45's advocacy check and its read (`t45.test.mjs`) */
  assert.deepEqual(plain(fam.kinds), { accountpropose: "member", accountdrafts: "ownread", advocacycheck: "member",
                                       advocacychecks: "ownread" });
  assert.deepEqual(plain(fam.actor), { key: "by", at: "query" });
  assert.deepEqual([...fam.acts], ["accountpropose", "advocacycheck"]);
  assert.deepEqual([...fam.reads], ["accountdrafts", "advocacychecks"]);
  for (const op of ["accountpropose", "accountdrafts"]) {
    assert.deepEqual(familyOf(op), ["case-account"], op);
    holdsSessionOnly(op);
  }
  assert.deepEqual(plain(OPS.accountpropose), MEMBER_ACT);
  assert.equal(NEEDS.accountpropose, "contribute");
  assert.deepEqual(stamps("accountpropose"), ["by", "viewer"]);
  assert.deepEqual(plain(OPS.accountdrafts), SESSION_READ);
  assert.ok(Object.hasOwn(NEEDS, "accountdrafts") && NEEDS.accountdrafts === null);
  assert.deepEqual(stamps("accountdrafts"), ["viewer"]);
  /* no family names case-authoring for them; case-authoring owns no family op */
  assert.ok(!Object.hasOwn(OP_FAMILIES, "case-authoring"));
  assert.ok(!Object.values(OP_FAMILIES).some((f) => f.owner === "case-authoring"));
  /* negative control */
  assert.notDeepEqual(familyOf("accountpropose"), ["case-authoring"]);
  assert.notDeepEqual(plain(OPS.accountdrafts), MEMBER_ACT);
});

test("R48, R6: the account ops' handler is the door's own map (control-plane R71): case-account serves both by the services its R1 and R3 name, accountPropose and accountDrafts, and its one ops map (since T46, caseAccountOps, its R15; N935) serves R13's two and neither account op (negative control: an unnamed service is absent)", async () => {
  const CA = await import("../../../src/case-account/index.mjs");
  assert.deepEqual(Object.keys(CA).filter((k) => /ops$/i.test(k)), ["caseAccountOps"]);
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
  const served = Object.keys(CA.caseAccountOps(svc, new URL("http://plane/"), {}));
  assert.deepEqual(served.sort(), ["advocacycheck", "advocacychecks"]);
  for (const op of ["accountpropose", "accountdrafts"]) assert.ok(!served.includes(op), `${op} is served by caseAccountOps`);
  assert.equal(typeof CaseAccount.prototype.accountPropose, "function");
  assert.equal(typeof CaseAccount.prototype.accountDrafts, "function");
  /* negative control */
  assert.equal(typeof CaseAccount.prototype.accountProposeNoSuch, "undefined");
});
