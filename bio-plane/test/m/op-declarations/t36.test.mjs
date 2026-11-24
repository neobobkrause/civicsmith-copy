/* op-declarations Terms and R2, R6, R17, R21, R27, R31–R34 (T36-35; K2084, K2092, K2093, K2130, K2152): T36's ops —
   standards' in-force-through records and calculations' spot-check (R31), file-safety's 23 ops (R32), credentials'
   keep-away (R33) — and the explanation of every member op (R34). Each spec, row, session set, stamp and list is
   compared whole at the exported tables, each stamp is driven through its owner's own map so a stamp named at a site
   the owner does not read is seen, and R6's totality is read from each owner's map. Each comparison has a negative
   control. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { T51_DESIGN_OPS } from "../../../src/affordances/act-help.mjs";
import { AI_GRANT_OPS, credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { fileSafetyOps } from "../../../src/file-safety/index.mjs";
import { standardsOps } from "../../../src/standards/index.mjs";
import { calculationsOps } from "../../../src/calculations/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS,
        UNATTENDED_BY_DECISION, ACT_GATE, PLAN_RUN_SCOPE, ACT_HELP_ABSENT } = O;
const MP = ["admin", "member", "probe"];
const SESSION = ["admin", "member"];
const BINDING = ["admin", "probe", "daemon"];
const plain = (s) => JSON.parse(JSON.stringify(s));
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);
const neither = (op) => !SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op);
const stamps = (op) => (Object.hasOwn(OP_STAMPS, op) ? [...OP_STAMPS[op]].sort() : null);
const LISTS = Object.entries(O).filter(([, v]) => Array.isArray(v));
const listsOf = (op) => LISTS.filter(([, l]) => l.includes(op)).map(([n]) => n)
  .filter((n) => !["FAMILY_OPS", "FAMILY_SESSION_OPS"].includes(n)).sort();
const familyOf = (op) => Object.values(OP_FAMILIES).find((f) => Object.hasOwn(f.kinds, op))?.owner ?? null;
const keysOf = (mapFn) => Object.keys(mapFn({}, new URL("http://plane/"), {}, {}, {}));
/* a caller not arriving by a session is judged against machineClasses where given (admission R5) */
const machineAdmits = (op) => ["admin", "probe", "daemon"].filter((c) => (OPS[op].machineClasses ?? OPS[op].classes ?? []).includes(c));

/* An owner's map over a service that records each method it is called with and its arguments. */
const drive = async (mapFn, op, { query = {}, body = {} } = {}) => {
  const url = new URL("http://plane/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const calls = [];
  const svc = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (...args) => { calls.push([k, args]); return { ok: true }; }) });
  try { await mapFn(svc, url, body, svc, svc)[op](); } catch { /* recorded already */ }
  return JSON.stringify(calls);
};
const SENT = "member:sentinel-36";
const reaches = async (mapFn, op, where) => (await drive(mapFn, op, where)).includes(SENT);

/* ---------- Terms and R2 (T36; N711, K2084): `member` names the member session kind only ---------- */

test("R2 (T36, Terms): no spec's machineClasses names member — no member bearer exists — and every class a spec names is a binding credential (admin, probe, daemon) or a session's kind (admin, member), none ai (negative control: a spec naming member among its machine classes is seen)", () => {
  const named = Object.keys(OPS).filter((op) => Array.isArray(OPS[op].machineClasses) && OPS[op].machineClasses.includes("member"));
  assert.deepEqual(named, []);
  let withMachine = 0;
  for (const [op, s] of Object.entries(OPS)) {
    for (const c of s.classes ?? []) assert.ok(["admin", "member", "probe", "daemon"].includes(c), `${op}: ${c}`);
    if (Array.isArray(s.machineClasses)) {
      withMachine++;
      for (const c of s.machineClasses) assert.ok(BINDING.includes(c), `${op}: machine class ${c}`);
    }
    assert.ok(!JSON.stringify(s).includes('"ai"'), op);
  }
  assert.ok(withMachine >= 80, `${withMachine} specs with machineClasses`);
  /* every OP_KINDS spec the families spread, too */
  for (const [k, v] of Object.entries(O.OP_KINDS)) assert.ok(!(v.spec.machineClasses ?? []).includes("member"), k);
  /* negative control */
  const drifted = { ...OPS, x: { classes: MP, machineClasses: ["member"], mutating: true } };
  assert.deepEqual(Object.keys(drifted).filter((op) => (drifted[op].machineClasses ?? []).includes("member")), ["x"]);
});

/* ---------- R31 (K2092): standards' and calculations' new ops ---------- */

const R31 = {
  standardinforcethrough:         { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute",
                                    stamps: ["author", "viewer"], family: "standards", kind: "member" },
  standardinforcethroughwithdraw: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute",
                                    stamps: ["author", "viewer"], family: "standards", kind: "member" },
  inforcethroughof:               { spec: { classes: MP, mutating: false }, needs: null, stamps: ["viewer"],
                                    family: "standards", kind: "read" },
  spotcheckvisit:                 { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute",
                                    stamps: ["by", "viewer"], family: "calculations", kind: "member" },
  spotcheck:                      { spec: { classes: MP, mutating: false }, needs: null, stamps: ["viewer"],
                                    family: "calculations", kind: "read" },
};

test("R31, R2–R4: standards' standardinforcethrough and standardinforcethroughwithdraw a member's (machineClasses []), contribute, author and viewer stamped; inforcethroughof a read, viewer stamped, a present null; calculations' spotcheckvisit a member's (machineClasses []), contribute, by stamped; spotcheck a read, viewer stamped, a present null — each in its owner's family, both session sets, in neither bearer fence, not on AI_GRANT_OPS, in no list and unattended by none (negative control: a drifted spec is seen)", () => {
  for (const [op, w] of Object.entries(R31)) {
    assert.deepEqual(plain(OPS[op]), w.spec, op);
    assert.equal(familyOf(op), w.family, op);
    assert.equal(OP_FAMILIES[w.family].kinds[op], w.kind, op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === w.needs, op);
    assert.equal(ACT_GATE.needs(op), w.needs, op);
    assert.deepEqual(stamps(op), w.stamps, op);
    assert.ok(both(op) && ACT_GATE.mode(op) === "session", op);
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op) && !AI_GRANT_OPS.includes(op), op);
    assert.deepEqual(listsOf(op), [], op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    if (OPS[op].mutating) assert.deepEqual(machineAdmits(op), [], `${op} admits a bearer`);
  }
  /* negative control */
  assert.notDeepEqual(plain({ ...OPS.spotcheckvisit, machineClasses: undefined }), R31.spotcheckvisit.spec);
});

test("R31, R4, R6: each R31 op is served by its owner's map, and its stamps reach the owner where it reads them — standards' author from the body and viewer from the query, calculations' viewer from the query (its actor, R24) — a key the owner does not read does not (negative control)", async () => {
  const MAP = { standards: standardsOps, calculations: calculationsOps };
  for (const [op, w] of Object.entries(R31)) {
    assert.ok(keysOf(MAP[w.family]).includes(op), `${op} is not served`);
    assert.ok(await reaches(MAP[w.family], op, { query: { viewer: SENT } }), `${op}: the viewer does not reach`);
    assert.equal(await reaches(MAP[w.family], op, { query: { nosuchstamp: SENT } }), false, op);
  }
  for (const op of ["standardinforcethrough", "standardinforcethroughwithdraw"]) {
    assert.ok(await reaches(standardsOps, op, { body: { author: SENT } }), `${op}: the body's author`);
    assert.equal(await reaches(standardsOps, op, { query: { author: SENT } }), false, `${op}: the query's author reaches`);
  }
  /* calculations takes the stamped viewer as the visit's `by`, never a body copy (its R24) */
  assert.equal(await reaches(calculationsOps, "spotcheckvisit", { body: { by: SENT } }), false);
});

/* ---------- R32 (N714, N707, N710; DEC-169, DEC-173): file-safety's 23 ops ---------- */

const READ = { spec: { classes: MP, mutating: false }, needs: null, stamps: ["viewer"], sets: "both" };
const SIGHT = { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null, stamps: ["viewer"], sets: "both" };
const ADMIN_READ = { spec: { classes: SESSION, machineClasses: [], mutating: false }, needs: null, stamps: ["viewer"], sets: "both" };
const ADMIN_ACT = { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: null, stamps: ["by", "viewer"], sets: "both" };
const WAKE = { spec: { classes: BINDING, mutating: true }, needs: null, stamps: null, sets: "neither" };
const R32 = {
  verdictnotes: READ, threatof: READ, originalstate: READ, safeview: READ, safecopy: READ, scanfindings: READ,
  findingkind: { ...READ, stamps: [] },
  openoriginal: SIGHT, openwithwarning: SIGHT, deepercheck: SIGHT, safecopyrequest: SIGHT,
  releasescanhold: { spec: { classes: SESSION, machineClasses: [], mutating: true }, needs: "contribute", stamps: ["by", "viewer"], sets: "both" },
  scanstatus: ADMIN_READ, securitytools: ADMIN_READ, securitytoolcatalogue: ADMIN_READ, securitytoolevents: ADMIN_READ,
  securitytooladd: ADMIN_ACT, securitytooltest: ADMIN_ACT, securitytoolremove: ADMIN_ACT,
  /* T51 fix round 3 (K4371; file-safety R49; B27): the administrator's signature run, in file-safety's map and declared by it (R80) */
  scanmirror: { owner: true, spec: { classes: ["admin", "member"], machineClasses: [], mutating: true }, needs: null, stamps: ["viewer"], sets: "both" },
  scanbatch: WAKE, renderbatch: WAKE, deeperbatch: WAKE, securityforward: WAKE,
};

test("R32, R6: OPS holds a spec for each of the ops file-safety serves (its registered declarations, R80) — exactly its map's keys — and no other file-safety op (negative control: an op added to the map without a spec is seen)", () => {
  const served = keysOf(fileSafetyOps);
  assert.deepEqual([...served].sort(), Object.keys(R32).sort());
  for (const op of served) assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
  /* T51 fix round 3 (K4371; B27): scanmirror is file-safety's declaration (R80), not a map op: specced by its owner's row */
  assert.ok(Object.hasOwn(OPS, "scanmirror") && OPS.scanmirror.mutating === true && OPS.scanmirror.classes.includes("admin"));
  /* the family is the 19 a session reaches; the four wakes are declared in OPS apart */
  assert.deepEqual(Object.keys(OP_FAMILIES["file-safety"].kinds).sort(), served.filter((op) => R32[op].sets === "both" && !R32[op].owner).sort());
  /* negative control */
  assert.deepEqual([...served, "scanforget"].filter((op) => !Object.hasOwn(OPS, op)), ["scanforget"]);
});

test("R32, R2–R4: each file-safety op's spec, NEEDS row, session sets and stamps are R32's — the sight reads admin, member, probe, viewer stamped, findingkind stamped nothing; the openings, the deeper check and the safe copy a member session's (machineClasses []), mutating, the viewer alone stamped; releasescanhold a member's, contribute, by stamped; the administrators' reads and acts a session's (machineClasses []), viewer or by stamped; the four wakes binding credentials only, in no session set — none in a bearer fence, on AI_GRANT_OPS, in a plan run's scope or in an act list (negative control: a drifted spec is seen)", () => {
  for (const [op, w] of Object.entries(R32)) {
    /* an owner's declaration (R80) also carries its description and fields: its class, machine and mutation are compared */
    assert.deepEqual(w.owner ? { classes: OPS[op].classes, machineClasses: OPS[op].machineClasses, mutating: OPS[op].mutating } : plain(OPS[op]), w.spec, op);
    assert.ok(Object.isFrozen(OPS[op]), op);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === w.needs, `${op}: NEEDS`);
    assert.deepEqual(stamps(op), w.stamps, op);
    if (w.sets === "both") {
      assert.ok(both(op) && ACT_GATE.mode(op) === "session", op);
      /* an owner's declared op (R80) is in both sets but in no family */
      assert.equal(familyOf(op), w.owner ? null : "file-safety", op);
      assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    } else {
      assert.ok(neither(op) && ACT_GATE.mode(op) === "machine", op);
      assert.equal(familyOf(op), null, op);
    }
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), op);
    assert.ok(!AI_GRANT_OPS.includes(op), `${op} is on AI_GRANT_OPS`);
    assert.ok(!PLAN_RUN_SCOPE.reads.includes(op) && !PLAN_RUN_SCOPE.writes.includes(op), op);
    assert.deepEqual(listsOf(op), [], op);
  }
  /* the openings, the deeper check, the safe copy, the release and the tools admit no bearer (admission refuses each) */
  for (const op of Object.keys(R32).filter((o) => R32[o].spec.machineClasses)) assert.deepEqual(machineAdmits(op), [], op);
  /* the openings name no caller beside the viewer the owner reads sight by (file-safety R10) */
  for (const op of ["openoriginal", "openwithwarning", "deepercheck", "safecopyrequest"])
    assert.ok(!stamps(op).some((k) => ["by", "bodyBy", "author", "member", "principal", "session"].includes(k)), op);
  /* negative controls */
  assert.notDeepEqual(plain({ ...OPS.openoriginal, machineClasses: undefined }), SIGHT.spec);
  assert.notDeepEqual(stamps("releasescanhold"), stamps("openoriginal"));
});

test("R32, R3 (K1913): the four wakes are unattended by decision, each citing file-safety's requirement that names it the scheduler's — R4, R12, R36, R35 — as taskdrain is (negative control: a session op has no citation)", () => {
  const WHERE = { scanbatch: /file-safety\.md R4\b/, renderbatch: /file-safety\.md R12\b/, deeperbatch: /file-safety\.md R36\b/,
                  securityforward: /file-safety\.md R35\b/ };
  for (const [op, re] of Object.entries(WHERE)) {
    assert.match(UNATTENDED_BY_DECISION[op], re, op);
    assert.match(UNATTENDED_BY_DECISION[op], new RegExp(`op=${op}`), op);
    assert.match(UNATTENDED_BY_DECISION[op], /scheduler's/, op);
  }
  assert.deepEqual(plain(OPS.scanbatch).classes, ["admin", "probe", "daemon"]);
  assert.ok(Object.hasOwn(UNATTENDED_BY_DECISION, "taskdrain"));
  /* negative control */
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, "releasescanhold"));
});

test("R32, R4: each file-safety stamp reaches file-safety where it reads it, through its own map — the viewer from the query on the sight reads, the openings, the deeper check, the safe copy and the administrators' reads; by from the query on the release and the tool acts; override, warned, reason, credentials and config from the body; securitytooladd's credentials and config never from the query (negative control: a key file-safety does not read does not reach)", async () => {
  let checked = 0;
  for (const [op, w] of Object.entries(R32)) {
    for (const st of w.stamps ?? []) {
      /* the acts read `by`; the viewer stamped on them beside it is the family's, file-safety's acts take no viewer */
      if (st === "viewer" && w.stamps.includes("by")) continue;
      assert.ok(await reaches(fileSafetyOps, op, { query: { [st]: SENT } }), `${op}: ${st} does not reach`);
      checked++;
    }
    assert.equal(await reaches(fileSafetyOps, op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  assert.equal(checked, 19, `${checked} stamps driven (scanmirror's viewer, T51 fix round 3)`);
  /* the body fields the requirement names */
  assert.ok(await reaches(fileSafetyOps, "openwithwarning", { body: { warned: { own_device: SENT } } }));
  assert.ok((await drive(fileSafetyOps, "openoriginal", { body: { override: true } })).includes('"override":true'));
  assert.ok(!(await drive(fileSafetyOps, "openoriginal", {})).includes('"override":true'));
  assert.ok(await reaches(fileSafetyOps, "releasescanhold", { body: { reason: SENT } }));
  for (const k of ["credentials", "config"]) {
    assert.ok(await reaches(fileSafetyOps, "securitytooladd", { body: { [k]: SENT } }), `the body's ${k}`);
    assert.equal(await reaches(fileSafetyOps, "securitytooladd", { query: { [k]: SENT } }), false, `the query's ${k}`);
  }
  /* the release's by is the query's, never the body's */
  assert.equal(await reaches(fileSafetyOps, "releasescanhold", { body: { by: SENT } }), false);
});

/* ---------- R33 (N721; DEC-172; K2093): credentials' keep-away ---------- */

test("R33, R6: aikeepaway an administrator's act, a session's only (machineClasses []), mutating, by stamped, a present null; aikeepawaystate a read of admin, member, probe, stamped nothing, a present null — both in credentials' family and both session sets, in neither bearer fence, not on AI_GRANT_OPS; on and reason the body's and by the query's; securitycount a store-internal route with no spec (negative control: a declared op is in a table)", async () => {
  assert.deepEqual(plain(OPS.aikeepaway), { classes: SESSION, machineClasses: [], mutating: true });
  /* T48 (R68): the keep-away ops are ai-accounts' family and map now (`securitycount` stays credentials') */
  assert.equal(OP_FAMILIES["ai-accounts"].kinds.aikeepaway, "admin");
  assert.deepEqual(stamps("aikeepaway"), ["by", "viewer"]);
  assert.deepEqual(plain(OPS.aikeepawaystate), { classes: MP, mutating: false });
  assert.equal(OP_FAMILIES["ai-accounts"].kinds.aikeepawaystate, "settingread");
  assert.ok(!Object.hasOwn(OP_FAMILIES.credentials.kinds, "aikeepaway") && !Object.hasOwn(OP_FAMILIES.credentials.kinds, "aikeepawaystate"));
  assert.deepEqual(stamps("aikeepawaystate"), []);
  for (const op of ["aikeepaway", "aikeepawaystate"]) {
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, op);
    assert.ok(both(op) && !GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op) && !AI_GRANT_OPS.includes(op), op);
    assert.ok(keysOf(aiAccountsOps).includes(op), op);
    assert.deepEqual(listsOf(op), [], op);
  }
  assert.ok(await reaches(aiAccountsOps, "aikeepaway", { query: { by: SENT } }));
  for (const k of ["on", "reason"]) assert.ok(await reaches(aiAccountsOps, "aikeepaway", { body: { [k]: SENT } }), k);
  /* a body copy of `by` is overwritten by the stamp (ai-accounts spreads the body, then the stamp) */
  assert.ok(!(await drive(aiAccountsOps, "aikeepaway", { body: { by: SENT }, query: { by: "member:real" } })).includes(SENT));
  /* R6: securitycount is served and declared nowhere */
  assert.ok(keysOf(credentialsOps).includes("securitycount"));
  assert.ok(!Object.hasOwn(OPS, "securitycount") && !Object.hasOwn(NEEDS, "securitycount") && neither("securitycount")
    && !Object.hasOwn(OP_STAMPS, "securitycount") && listsOf("securitycount").length === 0);
  /* negative control */
  assert.ok(Object.hasOwn(OPS, "aikeepaway"));
});

/* ---------- R21, R17 (T36): the registry as PR #13 left it; assistantset retired ---------- */

test("R21, R17 (T36; K2130): this module holds no screen name — no table here names \"The assistant\" — and the nine owed acts R32 and R33 declare are declared under their own names with no alias; assistantset has no spec (negative control: a declared alias is found)", () => {
  const text = JSON.stringify([OPS, NEEDS, OP_STAMPS, UNATTENDED_BY_DECISION, ACT_HELP_ABSENT, LISTS, OP_ALIASES]);
  assert.ok(!/the assistant/i.test(text));
  for (const op of ["aikeepaway", "deepercheck", "openoriginal", "openwithwarning", "releasescanhold", "safeview",
                    "securitytooladd", "securitytooltest", "securitytoolremove"]) {
    assert.ok(Object.hasOwn(OPS, op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), op);
  }
  assert.ok(!Object.hasOwn(OPS, "assistantset"));
  /* negative control */
  assert.ok(Object.hasOwn(OP_ALIASES, "createevent"));
});

test("R27 (T37: its T36 sentence retired): subscriptionsignin and translationconfirm, served in T37, each have a spec, a row, both session sets and stamps (R36, R37), beside subscriptiondisconnect", () => {
  for (const op of ["subscriptionsignin", "translationconfirm", "subscriptiondisconnect"])
    assert.ok(Object.hasOwn(OPS, op) && Object.hasOwn(NEEDS, op) && both(op) && Object.hasOwn(OP_STAMPS, op), op);
  /* negative control: an op no owner serves has none of them (infolevelset, the control until T46, is R50's now) */
  assert.ok(!Object.hasOwn(OPS, "nosuchowedact") && neither("nosuchowedact") && !Object.hasOwn(OP_STAMPS, "nosuchowedact"));
});

/* ---------- R34 (N726; DEC-174 (3); K2063 (3)): every member op explained, or named with why not ---------- */

test("R34, R5: ACT_HELP_ABSENT is frozen data grouping op names under their grounds, each ground one sentence, each group's names distinct, sorted and named by no other group, and it names no op OPS does not hold (negative control: an unheld name is seen)", () => {
  assert.ok(Object.isFrozen(ACT_HELP_ABSENT));
  const groups = Object.entries(ACT_HELP_ABSENT);
  assert.ok(groups.length >= 3);
  const seen = new Set();
  for (const [k, g] of groups) {
    assert.ok(Object.isFrozen(g) && Object.isFrozen(g.ops), k);
    assert.deepEqual(Object.keys(g).sort(), ["ground", "ops"], k);
    assert.equal(typeof g.ground, "string", k);
    assert.match(g.ground, /^[A-Z][^]*\.$/, `${k}: a sentence`);
    assert.equal((g.ground.match(/\.(\s|$)/g) ?? []).length, 1, `${k}: one sentence`);
    assert.ok(g.ops.length > 0, k);
    assert.deepEqual([...g.ops], [...g.ops].sort(), `${k}: sorted`);
    for (const op of g.ops) {
      assert.ok(!seen.has(op), `${op} under two grounds`);
      seen.add(op);
      assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
    }
  }
  /* each ground's names are what its sentence says: an alias is in OP_ALIASES; a read is no act */
  for (const op of ACT_HELP_ABSENT.alias.ops) assert.ok(Object.hasOwn(OP_ALIASES, op), op);
  for (const op of ACT_HELP_ABSENT.read.ops) assert.equal(OPS[op].mutating, false, op);
  /* T48 (R64): a draft the assistant makes, declared in agent-worker's family as a session's read (`readtranslate`, as
     `textcheck` is), may sit under the last ground until the design explains it */
  for (const k of ["nocontrol", "unexplained"]) for (const op of ACT_HELP_ABSENT[k].ops)
    assert.ok((OPS[op].mutating || (k === "unexplained" && O.OP_FAMILIES["agent-worker"].reads.includes(op)))
      && !Object.hasOwn(OP_ALIASES, op), op);
  /* every alias of a member op is under the alias ground: the explanation is held under its op (affordances R48) */
  for (const al of Object.keys(OP_ALIASES).filter((a) => SESSION_OPS.member.has(a))) assert.ok(ACT_HELP_ABSENT.alias.ops.includes(al), al);
  /* negative control */
  assert.ok(![...seen, "nosuchop"].every((op) => Object.hasOwn(OPS, op)));
});

test("R34 (affordances R48): every op in SESSION_OPS.member has an explanation in affordances' ACT_HELP under its own name or is named in ACT_HELP_ABSENT, and no op is both — the partition both ways (negative control: a member op dropped from both is seen)", () => {
  const ACT_HELP = AFF.ACT_HELP;
  assert.ok(ACT_HELP && typeof ACT_HELP === "object", "affordances' ACT_HELP (its R48) is not exported");
  const absent = new Set(Object.values(ACT_HELP_ABSENT).flatMap((g) => [...g.ops]));
  /* T49 (R71): `founderhandleset` is in the founder's set alone, and R71 holds R34 over it all the same: explained by
     ACT_HELP under its own name, or named in ACT_HELP_ABSENT until it is. It is the one op beside the member set's that
     the partition covers. */
  const FOUNDER_ONLY = [...SESSION_OPS.admin].filter((op) => !SESSION_OPS.member.has(op) && op === "founderhandleset");
  assert.deepEqual(FOUNDER_ONLY, ["founderhandleset"]);
  const member = [...SESSION_OPS.member, ...FOUNDER_ONLY];
  const neitherOne = member.filter((op) => !explained(op) && !absent.has(op));
  const bothOnes = member.filter((op) => explained(op) && absent.has(op));
  assert.deepEqual(neitherOne, [], `member ops with no text and no ground: ${neitherOne}`);
  assert.deepEqual(bothOnes, [], `member ops explained and named absent: ${bothOnes}`);
  /* no op in ACT_HELP_ABSENT is outside the member set (it names member ops only) or explained */
  for (const op of absent) {
    assert.ok(SESSION_OPS.member.has(op) || FOUNDER_ONLY.includes(op), `${op} is no member op`);
    assert.ok(!explained(op), `${op} is explained`);
  }
  assert.equal(member.filter(explained).length + absent.size, member.length);
  /* negative control: a member op dropped from the absent list and given no text is caught */
  const dropped = [...absent][0];
  assert.ok(member.filter((op) => !explained(op) && !absent.has(op) && op !== dropped).length === 0
    && !explained(dropped) && member.includes(dropped));
});

test("R34 (K4254; affordances R48, T51_DESIGN_OPS): ACT_HELP_ABSENT names no op affordances' ACT_HELP holds — read from affordances' exported T51_DESIGN_OPS and its ACT_HELP, never a hand list (K3268) — among them accountdrafts and accountpropose, and every op of T51_DESIGN_OPS that a member session reaches is explained (negative control: an op the design has not explained, projectownervotes, stays under its ground)", () => {
  const absent = new Set(Object.values(ACT_HELP_ABSENT).flatMap((g) => [...g.ops]));
  const designed = [...T51_DESIGN_OPS, "accountdrafts", "accountpropose"];
  assert.ok(designed.length >= 66);
  for (const op of designed) {
    assert.ok(Object.hasOwn(AFF.ACT_HELP, op), `${op}: affordances holds no text`);
    assert.ok(!absent.has(op), `${op}: explained by affordances and named in ACT_HELP_ABSENT`);
  }
  for (const op of designed.filter((o) => SESSION_OPS.member.has(o))) assert.ok(explained(op), op);
  /* every op ACT_HELP holds is named under no ground */
  assert.deepEqual([...absent].filter((op) => Object.hasOwn(AFF.ACT_HELP, op)), []);
  /* negative control */
  assert.ok(absent.has("projectownervotes") && !Object.hasOwn(AFF.ACT_HELP, "projectownervotes"));
});

test("R5, R7: ACT_HELP_ABSENT is frozen to its leaves, the same on a second load, and names no place", async () => {
  const again = await import(`../../../src/op-declarations/index.mjs?second=${Date.now()}`);
  assert.equal(JSON.stringify(again.ACT_HELP_ABSENT), JSON.stringify(ACT_HELP_ABSENT));
  for (const g of Object.values(ACT_HELP_ABSENT)) {
    assert.throws(() => { "use strict"; g.ops.push("x"); });
    assert.doesNotMatch(g.ground, /oakland|alameda|california|berkeley|san francisco|bay area|city of|county of|state of/i);
  }
});
