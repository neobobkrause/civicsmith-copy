/* op-declarations, T51 (R76, R77, R78, R79; DEC-330 owed, U348, K3810; K3826, K3829, K3839, K3843, K3852, K3853, K3861,
   K3867, K3935, K3976, K4059): the browser acts as a class of their own, and the reads T51's lower layers add, declared
   in their owners' families. Each op and each act is tested by name with its controls (K874). Specs, sets, rows and
   stamps are read from the exported tables; each stamp and request field is driven through its owner's own ops map, so
   a stamp named at a site the owner does not read, or a field the owner reads from elsewhere, is seen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as O from "../../../src/op-declarations/index.mjs";
import { REGISTERED } from "./register-owners.mjs";
import { composeNeeds } from "../../../src/op-declarations/compose.mjs";
import { explained } from "./help.mjs";
import { T51_SHARES, T51_FAMILIES } from "../../../src/op-declarations/t51.mjs";
import { browserActs, OWED_BY_FIX_ROUND_AT_43379A1A44 } from "./browser.mjs";
import * as AFF from "../../../src/affordances.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";
import { checkScript } from "../../../src/wizard-scripts/index.mjs";
import { promotionOps } from "../../../src/promotion/index.mjs";
import { basisVersionsOps } from "../../../src/basis-versions/index.mjs";
import { captureOps } from "../../../src/capture/index.mjs";
import { entitiesOps } from "../../../src/entities/index.mjs";
import { projectRosterOps } from "../../../src/project-roster/index.mjs";
import { publicReadOps } from "../../../src/public-read/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { filingTemplatesOps } from "../../../src/filing-templates/index.mjs";
import { localFactsOps } from "../../../src/local-facts/index.mjs";
import { retrievalRoutes } from "../../../src/retrieval/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, OP_ALIASES, GOVERNANCE_ACTIONS, IDENTITY_ACTIONS, UNATTENDED_BY_DECISION,
        ACT_GATE, ACT_HELP_ABSENT, BROWSER_ACTS, REAUTH_ACTS } = O;
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
const both = (op) => SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op);

const ROOT = new URL("../../../../", import.meta.url);
const registry = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));

/* The kinds R77 to R79 give, each with the spec and the NEEDS row (stated here, not read from OP_KINDS). */
const KINDS = {
  read:        { spec: { classes: MP, mutating: false },                          needs: null },
  sessionread: { spec: { classes: MP, machineClasses: [], mutating: false },      needs: null },
  ownread:     { spec: { classes: ["admin", "member"], machineClasses: [], mutating: false }, needs: null },
  /* K4098: machine classes named, so admission refuses an `ai` credential */
  readfenced:  { spec: { classes: MP, machineClasses: ["admin", "probe"], mutating: false }, needs: null },
};
/* The 14 session reads, each with its owner, kind and the stamps R77 to R79 name (`viewer` always, beside the family's own);
   `map` is the owner's ops map where it serves the op (`approvedunsent` and `checkpointsdue` have no owner arm: the control
   plane's route serves them, screens-action R30). */
const T51 = {
  heldat:             { owner: "capture",         kind: "readfenced",        stamps: ["by", "viewer"], map: captureOps },
  bundlehistory:      { owner: "promotion",       kind: "read",        stamps: ["viewer"],       map: promotionOps },
  entityidonly:       { owner: "entities",        kind: "read",        stamps: ["viewer"],       map: entitiesOps },
  subjectsnamed:      { owner: "entities",        kind: "read",        stamps: ["viewer"],       map: entitiesOps },
  entitysimilar:      { owner: "entities",        kind: "read",        stamps: ["viewer"],       map: entitiesOps },
  projectinvitations: { owner: "project-roster",  kind: "read",        stamps: ["viewer"],       map: projectRosterOps },
  versioncompare:     { owner: "basis-versions",  kind: "read",        stamps: ["viewer"],       map: basisVersionsOps },
  approvedunsent:     { owner: "filings",         kind: "read",        stamps: ["viewer"],       map: null },
  checkpointsdue:     { owner: "action-plans",    kind: "read",        stamps: ["viewer"],       map: null },
  holdsdue:           { owner: "action-holds",    kind: "sessionread", stamps: ["viewer"],       map: actionHoldsOps },
  templatebyhandle:   { owner: "filing-templates", kind: "sessionread", stamps: ["viewer"],      map: filingTemplatesOps },
  rulefields:         { owner: "local-facts",     kind: "sessionread", stamps: ["viewer"],       map: localFactsOps },
  clocksrunning:      { owner: "action-clocks",   kind: "sessionread", stamps: ["viewer"],       map: actionClocksOps },
  adminremovalsopen:  { owner: "membership",      kind: "ownread",     stamps: ["by", "viewer"], map: membershipOps },
};
const BROWSER = ["hashcopy", "linkopen", "pubfloorclear", "pubfloorset", "pubprint", "reviewexport", "revisioncompare"];

/* An owner's map over a service that records each call and its arguments (the shape t50 drives). */
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
const SENT = "sentinel-51";
const reaches = async (routes, op, where) => (await drive(routes, op, where)).includes(SENT);

/* ---------- R76 ---------- */

test("R76 (T51; DEC-330 owed; U348; K3810): BROWSER_ACTS names the seven acts DEC-330 draws that are done in the browser alone, each {screen, census, registry} with the registry row it takes the place of (`owed:<act> DEC-330`), frozen, on the screen and census line DEC-330 gives it, and each is exactly one owed row of the screen registry (negative control: a name the table does not hold is not a browser act)", () => {
  assert.deepEqual(Object.keys(BROWSER_ACTS).sort(), BROWSER);
  const want = { revisioncompare: ["document", "A27"], hashcopy: ["document", "A26"], linkopen: ["document", "A30"],
    pubfloorset: ["published", "A77"], pubfloorclear: ["published", "A77"], pubprint: ["published", "A79"],
    reviewexport: ["review-copy", "A81"] };
  assert.ok(Object.isFrozen(BROWSER_ACTS));
  for (const act of BROWSER) {
    const row = BROWSER_ACTS[act];
    assert.ok(Object.isFrozen(row), act);
    assert.deepEqual(plain(row), { screen: want[act][0], census: want[act][1], registry: `owed:${act} DEC-330` }, act);
  }
  /* over the registry file: the seven DEC-330 rows are all in (b), and nothing in (b) is another row */
  assert.deepEqual(browserActs(registry), BROWSER);
  const dec330 = registry.screens.flatMap((s) => s.acts).filter((a) => a.status === "owed" && /DEC-330$/.test(a.op))
    .map((a) => a.op.replace(/^owed:/, "").split(" ")[0]).sort();
  assert.deepEqual(dec330, BROWSER);
  /* the registry keeps marking them owed (it is the design's file and is not changed to mark them) */
  for (const act of BROWSER) assert.ok(registry.screens.some((s) => s.acts.some((a) => a.op === `owed:${act} DEC-330` && a.status === "owed")), act);
  /* negative control */
  assert.ok(!Object.hasOwn(BROWSER_ACTS, "hashcopyx") && !Object.hasOwn(BROWSER_ACTS, "updateskip"));
});

/* the predicate R76 states: a browser act is an op nowhere */
const isNoOp = (act, tables) => !Object.hasOwn(tables.OPS, act) && !Object.hasOwn(tables.NEEDS, act)
  && !tables.member.has(act) && !tables.admin.has(act) && !tables.reauth.includes(act)
  && !tables.lists.some((l) => l.includes(act)) && !tables.aliases.includes(act) && !tables.families.some((f) => Object.hasOwn(f.kinds, act))
  && !Object.hasOwn(tables.stamps, act) && !Object.hasOwn(tables.unattended, act);

test("R76: a browser act is not an op — no spec in OPS, no row in NEEDS, no place in either session set, ACT_GATE (the gate answers it as it answers any name no table holds), REAUTH_ACTS, an act list, a family, the alias table, OP_STAMPS or UNATTENDED_BY_DECISION, no stamp, and it is on none of ACT_HELP_ABSENT's grounds (R34's partition runs over ops only) (negative control: a spec added for hashcopy fails the test)", () => {
  const tables = { OPS, NEEDS, member: SESSION_OPS.member, admin: SESSION_OPS.admin, reauth: Object.keys(REAUTH_ACTS),
    lists: LISTS.map(([, l]) => l), aliases: [...Object.keys(OP_ALIASES), ...Object.values(OP_ALIASES)],
    families: Object.values(OP_FAMILIES), stamps: OP_STAMPS, unattended: UNATTENDED_BY_DECISION };
  for (const act of BROWSER) {
    assert.ok(isNoOp(act, tables), `${act} is an op in a table`);
    assert.equal(ACT_GATE.needs(act), null, act);
    assert.equal(ACT_GATE.mode(act), "machine", `${act}: the gate reaches a session for it`);
    assert.deepEqual(listsOf(act), [], `${act} is in ${listsOf(act)}`);
    assert.deepEqual(ground(act), [], `${act} is named under a ground of ACT_HELP_ABSENT`);
    assert.ok(!AI_GRANT_OPS.includes(act), act);
  }
  /* negative control: a spec added for hashcopy is seen */
  assert.ok(!isNoOp("hashcopy", { ...tables, OPS: { ...OPS, hashcopy: { classes: MP, mutating: false } } }));
  assert.ok(!isNoOp("hashcopy", { ...tables, member: new Set([...SESSION_OPS.member, "hashcopy"]) }));
  assert.ok(!isNoOp("pubprint", { ...tables, NEEDS: { ...NEEDS, pubprint: null } }));
});

test("R76, R21: the totality — every act the registry marks owed is exactly one of (a) read as served (an op declared under its name), (b) a browser act whose `registry` string equals the row's `owed:<act> DEC-330`, or (c) still owed, named: the registry's owed acts split with nothing in two classes and nothing left over (negative control: an owed act in no class is seen)", () => {
  const owedRows = registry.screens.flatMap((s) => s.acts).filter((a) => a.status === "owed").map((a) => a.op);
  const nameOf = (row) => row.replace(/^owed:/, "").split(" ")[0];
  const STILL_OWED = ["installalongside", "installremove", "installremoveconfirm", "installupdate", ...OWED_BY_FIX_ROUND_AT_43379A1A44];   /* the installer's own routes, no plane op (R21), and the acts this round's owners declare (DEC-378) */
  const classOf = (row) => {
    const act = nameOf(row);
    const a = Object.hasOwn(OPS, act) && !Object.hasOwn(BROWSER_ACTS, act);
    const b = Object.hasOwn(BROWSER_ACTS, act) && BROWSER_ACTS[act].registry === row;
    const c = STILL_OWED.includes(act) && !Object.hasOwn(OPS, act) && !Object.hasOwn(BROWSER_ACTS, act);
    return [a, b, c].filter(Boolean).length === 1 ? (a ? "served" : b ? "browser" : "owed") : null;
  };
  const classes = owedRows.map(classOf);
  assert.ok(!classes.includes(null), `an owed act in no class, or two: ${owedRows.filter((r, i) => classes[i] === null)}`);
  assert.deepEqual(owedRows.filter((r, i) => classes[i] === "browser").map(nameOf).sort(), BROWSER);
  assert.deepEqual([...new Set(owedRows.filter((r, i) => classes[i] === "owed").map(nameOf))].sort(), [...STILL_OWED].sort());
  /* negative control: an owed act with no spec, no browser row and no ruling is in no class */
  assert.equal(classOf("owed:nosuchowedact DEC-330"), null);
  assert.equal(classOf("owed:hashcopy DEC-331"), null);   /* a registry string that differs from the table's row */
});

test("R76: wizard-scripts registers an owed act only when an op is declared under its name, so a browser act stays unregistered and a wizard step naming one is refused as naming no op (op=wizardcheck), while a declared op passes (negative control: a step naming an op the registry offers is accepted)", () => {
  const screens = registry.screens.map((s) => ({ id: s.id,
    acts: s.acts.filter((a) => a.status !== "owed").map((a) => a.op),
    owed: s.acts.map((a, at) => ({ a, at })).filter(({ a }) => a.status === "owed")
      .map(({ a, at }) => ({ op: a.op.replace(/^owed:/, "").split(" ")[0], at })) }));
  const held = new Set(Object.keys(OPS));
  const step = (screen, act) => [{ screen, act, what: "Do the thing.", why: "The member needs it." }];
  for (const act of BROWSER) {
    const screen = BROWSER_ACTS[act].screen;
    assert.deepEqual(checkScript(step(screen, act), { screens, ops: held }).refusals.map((r) => r.code), ["WIZARD_ACT_UNKNOWN"], act);
  }
  /* negative control: an act of the same screen that is a declared op passes the same check */
  const declaredOn = (id) => registry.screens.find((s) => s.id === id).acts.find((a) => a.status !== "owed" && held.has(a.op))?.op;
  const op = declaredOn("published") ?? declaredOn("document");
  assert.ok(op, "no declared act on published or document");
  const screen = registry.screens.find((s) => s.id === "published" && s.acts.some((a) => a.op === op)) ? "published" : "document";
  assert.deepEqual(checkScript(step(screen, op), { screens, ops: held }).refusals.map((r) => r.code), []);
});

/* ---------- R77 to R79 ---------- */

test("R77, R78, R79 (T51): the 14 session reads are declared once each, in their owners' families with the kinds R77 to R79 give them, the spec and the present null NEEDS row of the kind, both session sets, the stamps named, in no act list, no bearer fence, off AI_GRANT_OPS and never unattended, with an owner line in t51.mjs (negative control: an op with no owner line fails)", () => {
  assert.equal(Object.keys(T51).length, 14);
  for (const [op, want] of Object.entries(T51)) {
    assert.deepEqual(familyOf(op), [want.owner], `${op}: not in ${want.owner}'s family alone`);
    assert.equal(OP_FAMILIES[want.owner].kinds[op], want.kind, `${op}: the kind`);
    assert.deepEqual(plain(OPS[op]), KINDS[want.kind].spec, `${op}: the spec`);
    assert.ok(Object.isFrozen(OPS[op]) && Object.isFrozen(OPS[op].classes), `${op}: frozen`);
    assert.ok(Object.hasOwn(NEEDS, op) && NEEDS[op] === null, `${op}: the NEEDS row`);
    assert.equal(ACT_GATE.needs(op), null, op);
    assert.deepEqual(stamps(op), want.stamps, `${op}: the stamps`);
    assert.ok(both(op), `${op}: not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", op);
    assert.ok(O.FAMILY_SESSION_OPS.includes(op) && O.FAMILY_OPS.includes(op), op);
    assert.ok(!GOVERNANCE_ACTIONS.includes(op) && !IDENTITY_ACTIONS.includes(op), `${op}: in a bearer fence`);
    assert.ok(!AI_GRANT_OPS.includes(op), `${op}: on AI_GRANT_OPS`);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op) && !Object.values(OP_ALIASES).includes(op), `${op}: aliased`);
    assert.deepEqual(listsOf(op), [], `${op} is in ${listsOf(op)}`);
    /* R34: named under the read ground until affordances' ACT_HELP holds a text, never both */
    assert.equal(ground(op).length + (explained(op) ? 1 : 0), 1, `${op}: neither explained nor named, or both`);
    if (!explained(op)) assert.deepEqual(ground(op), ["read"], op);
    /* an owner line in t51.mjs: the share or the family that declares it */
    const line = T51_SHARES[want.owner]?.ops?.[op] ?? T51_FAMILIES.find((f) => f.owner === want.owner)?.ops?.[op];
    assert.equal(line, want.kind, `${op}: no owner line in t51.mjs`);
  }
  /* the share or family names the requirement in its citation (an earlier family keeps its own, as t45.mjs' shares do) */
  for (const owner of new Set(Object.values(T51).map((w) => w.owner)))
    assert.match((T51_SHARES[owner] ?? T51_FAMILIES.find((f) => f.owner === owner)).cite, /R7[789]/, owner);
  /* negative control: an op in no owner line fails */
  assert.equal(T51_SHARES.capture.ops.nosuchread ?? null, null);
  assert.ok(!T51_FAMILIES.some((f) => Object.hasOwn(f.ops, "nosuchread")));
});

test("R77, R78, R79: the kinds' controls — an `ai` credential is refused every op (it is in none of its classes or machine classes), the ops R78 and R79 name (holdsdue, templatebyhandle, rulefields, clocksrunning) refuse every bearer (a caller arriving without a member's session is refused: machineClasses []), and adminremovalsopen is a session's alone (negative control: a bearer-admitting read admits a bearer)", () => {
  for (const op of Object.keys(T51)) assert.ok(!machineAdmits(op).includes("ai"), `${op} admits ai`);
  for (const op of ["holdsdue", "templatebyhandle", "rulefields", "clocksrunning", "adminremovalsopen"])
    assert.deepEqual(machineAdmits(op), [], `${op}: a bearer is admitted`);
  for (const op of ["bundlehistory", "entityidonly", "subjectsnamed", "entitysimilar", "projectinvitations", "versioncompare"])
    assert.deepEqual(machineAdmits(op), MP, `${op}: reads as the family's reads do`);
  /* heldat names its machine classes: admission refuses an ai credential at the door (control-plane R110, K4098), the operator's bearers reach it and capture refuses `check` without a member session */
  assert.deepEqual(machineAdmits("heldat"), ["admin", "probe"]);
  /* negative control */
  assert.deepEqual(machineAdmits("projectdirectory"), MP);
  assert.ok(!OPS.adminremovalsopen.classes.includes("probe"));
});

test("R77, R78, R79, R4: each viewer, each `by` and each request field of the 12 ops an owner's map serves reaches the owner at the site it reads (the query), and a body copy does not, nor does another key (negative control per op); the two no owner map serves (approvedunsent and checkpointsdue) are the control plane's route (screens-action R30, control-plane R110)", async () => {
  /* the request fields each owner reads, from R77 to R79 and the owner's requirement */
  const FIELDS = {
    heldat: ["address", "sha256", "by", "viewer"]   /* `check` is a flag, driven below */, bundlehistory: ["bundle", "viewer"],
    entityidonly: ["ids", "viewer"], subjectsnamed: ["q", "kinds", "limit", "after", "viewer"], entitysimilar: ["name", "kind", "limit", "viewer"],
    projectinvitations: ["limit", "after", "viewer"], versioncompare: ["target", "a", "b", "project", "viewer"],
    holdsdue: ["after", "limit", "viewer"], templatebyhandle: ["name", "project", "version", "viewer"], rulefields: ["section", "viewer"],
    clocksrunning: ["viewer"], adminremovalsopen: ["by"],
  };
  let checked = 0;
  for (const [op, want] of Object.entries(T51)) {
    if (!want.map) {
      assert.ok(!keysOf(captureOps).includes(op) && !keysOf(projectRosterOps).includes(op), `${op}: served by a map`);
      continue;
    }
    assert.ok(keysOf(want.map).includes(op), `${op}: ${want.owner}'s map does not serve it`);
    for (const k of FIELDS[op]) {
      assert.ok(await reaches(want.map, op, { query: { [k]: SENT } }), `${op}: ${k} does not reach ${want.owner}`);
      checked++;
    }
    /* the stamps are the query's only: a body copy does not reach the owner */
    for (const k of want.stamps) assert.equal(await reaches(want.map, op, { body: { [k]: SENT } }), false, `${op}: the body's ${k} reaches`);
    /* negative control: a key the owner does not read does not reach */
    assert.equal(await reaches(want.map, op, { query: { nosuchstamp: SENT } }), false, `${op}: any key reaches`);
  }
  assert.ok(checked >= 30, `${checked} fields driven`);
  /* heldat: with no session the arm carries no member, so `check: true` reaches capture without one (its R86 fence answers MEMBER_SESSION_REQUIRED, the owner's own refusal) */
  const calls = JSON.parse(await drive(captureOps, "heldat", { query: { sha256: "a".repeat(64), check: "true" } }));
  const heldAt = calls.find(([k]) => k === "heldAt");
  assert.ok(heldAt && heldAt[1][0].check === true && !heldAt[1][0].member, "a call with no session carries a member");
  const withBy = JSON.parse(await drive(captureOps, "heldat", { query: { sha256: "a".repeat(64), check: "true", by: SENT } }));
  assert.equal(withBy.find(([k]) => k === "heldAt")[1][0].member, SENT);
  /* a `by` sent in the body is not the member: only the stamp, set from the session, is */
  const body = JSON.parse(await drive(captureOps, "heldat", { query: { sha256: "a".repeat(64), check: "true" }, body: { by: SENT } }));
  assert.ok(!body.find(([k]) => k === "heldAt")[1][0].member);
});

test("R77 (K3853): publishedfrozen is public — classes null, not mutating, no credential, nothing stamped, no NEEDS capability (a present null row), in neither session set, id a query field read by public-read's own map, in public-read's family, off AI_GRANT_OPS and no act list — and answered with no credential (negative control: a credential-gated read is not public)", async () => {
  assert.deepEqual(plain(OPS.publishedfrozen), { classes: null, mutating: false });
  assert.ok(Object.isFrozen(OPS.publishedfrozen));
  assert.deepEqual(stamps("publishedfrozen"), []);
  assert.ok(Object.hasOwn(NEEDS, "publishedfrozen") && NEEDS.publishedfrozen === null && ACT_GATE.needs("publishedfrozen") === null);   /* a present null row: op-grades names it a non-act, affordances R12 */
  assert.ok(!SESSION_OPS.member.has("publishedfrozen") && !SESSION_OPS.admin.has("publishedfrozen"));
  assert.equal(ACT_GATE.mode("publishedfrozen"), "machine");
  assert.deepEqual(familyOf("publishedfrozen"), ["public-read"]);
  assert.equal(OP_FAMILIES["public-read"].kinds.publishedfrozen, "publicread");
  assert.ok(!AI_GRANT_OPS.includes("publishedfrozen") && !UNATTENDED_BY_DECISION.publishedfrozen);
  assert.deepEqual(listsOf("publishedfrozen"), []);
  assert.deepEqual(ground("publishedfrozen"), [], "a public read in no session set needs no ACT_HELP_ABSENT ground");
  assert.ok(keysOf(publicReadOps).includes("publishedfrozen"));
  assert.ok(await reaches(publicReadOps, "publishedfrozen", { query: { id: SENT } }));
  /* negative control: a read that names a credential class is not public, and one that is public stamps nothing */
  assert.notEqual(OPS.projectdirectory.classes, null);
  assert.equal(await reaches(publicReadOps, "publishedfrozen", { query: { nosuchid: SENT } }), false);
});

test("R77 (K3843, K3872): projectlist's `after` and the `scope` parameter of searchfields, search and meaningrows are request fields the door passes as given — their specs are unchanged and nothing is added for them: no new op, no stamp (negative control: a stamp key is not a request field)", async () => {
  assert.deepEqual(plain(OPS.projectlist), plain(OPS.projectdirectory));
  assert.deepEqual(stamps("projectlist"), ["viewer"]);
  for (const op of ["searchfields", "search", "meaningrows"]) {
    assert.deepEqual(plain(OPS[op]), { classes: MP, mutating: false }, op);
    assert.ok(!stamps(op) || !stamps(op).includes("scope"), `${op}: scope is stamped`);
    assert.ok(O.RETRIEVAL_READS.includes(op), op);
  }
  assert.ok(!Object.hasOwn(OPS, "scope") && !Object.values(OP_STAMPS).some((s) => s.includes("scope") || s.includes("after")));
  /* project-roster's arm reads `after` from the query; retrieval's `search` and `meaningrows` read `scope` (retrieval R87),
     while `searchfields` takes none and answers the `scopes` instead */
  assert.ok(await reaches(projectRosterOps, "projectlist", { query: { after: SENT } }));
  for (const op of ["search", "meaningrows"]) assert.ok(await reaches(retrievalRoutes, op, { query: { scope: SENT } }), `${op}: scope does not reach retrieval`);
  assert.equal(await reaches(retrievalRoutes, "searchfields", { query: { scope: SENT } }), false);
  assert.equal(await reaches(retrievalRoutes, "search", { query: { nosuchfield: SENT } }), false);
  /* negative control */
  assert.equal(await reaches(projectRosterOps, "projectlist", { query: { nosuchfield: SENT } }), false);
});

test("R78 (N858, N1046; DEC-340, U366, K3935): over the registry (77 screens at 8c5e692e19 or later) every act the screens `hold`, `holdnotice`, `counsel` and `grouprules` list is a declared op under its lowercased name, actionhold is no longer listed on `action` and procedureguides is, and holdsdue's `holdsOf` form, templatesforaction's `unofferedFor` and the reads' fields ride ops already declared (negative control: an undeclared name fails)", () => {
  assert.ok(registry.screens.length >= 77, `${registry.screens.length} screens`);
  const actsOn = (id) => registry.screens.find((s) => s.id === id).acts.map((a) => a.op.replace(/^owed:/, "").split(" ")[0]);
  const NAMES = { hold: ["actionhold", "pressurerecord", "writinghelp"], holdnotice: ["holdnoticeprepare", "holdnoticesent", "writinghelp"],
    counsel: ["counselpacket"], grouprules: ["ruledraft", "ruleconfirm", "rulewithdraw", "writinghelp"] };
  for (const [id, names] of Object.entries(NAMES)) {
    /* the design may add acts to these screens (2a64c5ae77: actionholdrelease on hold): each must be declared too */
    for (const n of names) assert.ok(actsOn(id).includes(n), `${id}: ${n} is no longer listed`);
    for (const act of actsOn(id)) assert.ok(Object.hasOwn(OPS, act) && !Object.hasOwn(BROWSER_ACTS, act), `${id}: ${act} is no declared op`);
  }
  assert.ok(!actsOn("action").includes("actionhold") && actsOn("action").includes("procedureguides"));
  assert.ok(Object.hasOwn(OPS, "procedureguides") && Object.hasOwn(OPS, "templatesforaction"));
  /* the three reads are for a member's session */
  for (const op of ["holdsdue", "templatebyhandle", "rulefields"]) assert.ok(both(op) && NEEDS[op] === null && OPS[op].machineClasses.length === 0, op);
  /* negative control: an undeclared name fails */
  assert.ok(!Object.hasOwn(OPS, "nosuchholdact"));
  assert.deepEqual(["actionhold", "nosuchholdact"].filter((a) => !Object.hasOwn(OPS, a)), ["nosuchholdact"]);
});

test("R79 (T51; N1088, K4059; action-clocks R24): clocksrunning is a read in action-clocks' family — classes admin, member, probe, machineClasses [], not mutating, viewer stamped, NEEDS null, in both session sets — and the owner serves it from the query's viewer (negative control: a caller arriving without a member's session is refused, a bearer is not admitted)", async () => {
  assert.deepEqual(plain(OPS.clocksrunning), { classes: MP, machineClasses: [], mutating: false });
  assert.deepEqual(stamps("clocksrunning"), ["viewer"]);
  assert.deepEqual(familyOf("clocksrunning"), ["action-clocks"]);
  assert.ok(both("clocksrunning") && NEEDS.clocksrunning === null);
  assert.ok(await reaches(actionClocksOps, "clocksrunning", { query: { viewer: SENT } }));
  /* the control: only a session reaches it, a binding bearer and an `ai` credential do not */
  assert.deepEqual(machineAdmits("clocksrunning"), []);
  assert.deepEqual(machineAdmits("clocklateness"), MP, "action-clocks' other reads admit a bearer");
});

test("R77 (K3826, K3852): heldat's `by` is the session's member alone — stamped by the door from the session, never taken from a caller (a body or query copy is overwritten by the stamp), absent when the caller arrives without a session, so `check: true` from an admin, probe or ai credential carries no member and capture refuses it MEMBER_SESSION_REQUIRED (its R86 fence); declared a read, its one write the governor's bookkeeping (negative control: bundlehistory carries no by)", () => {
  assert.deepEqual(plain(OPS.heldat), { classes: MP, machineClasses: ["admin", "probe"], mutating: false });
  assert.ok(stamps("heldat").includes("by") && stamps("heldat").includes("viewer"));
  assert.ok(!stamps("bundlehistory").includes("by"));
  assert.equal(OP_FAMILIES.capture.kinds.heldat, "readfenced");
  assert.ok(!O.CAPTURE_MEMBER_ACTIONS.includes("heldat"), "heldat is an act");
  assert.equal(OPS.heldat.mutating, false);
  assert.ok(!machineAdmits("heldat").includes("ai"));
  assert.ok(!Object.hasOwn(NEEDS, "heldat") || NEEDS.heldat === null);
});

test("R82 (T51 fix round; K4227; screens-investigate R51; amends R18): standardinforce, standards' in-force read, is in SESSION_OPS.member and SESSION_OPS.admin, so the shell's act gate answers session for it and draws its button — its spec, stamps and NEEDS row are the ones standards declares (admin, member, probe; not mutating; viewer; null), it is explained or named under the read ground (R34), and an `ai` credential is no class of it (negative control: standard and standards, its siblings, stay out of the session sets; an op in no set answers machine)", () => {
  const owner = REGISTERED.standards.standardinforce;
  assert.ok(owner, "standards declares no standardinforce");
  assert.deepEqual(plain(OPS.standardinforce), { classes: [...owner.classes], mutating: owner.mutating });
  /* its viewer stamp is the action layer's read list (R4), not a family's: unchanged by being a session op */
  assert.deepEqual(listsOf("standardinforce"), ["ACTION_LAYER_READS", "STANDARDS_READS"]);
  assert.deepEqual([...(owner.stamps ?? ["viewer"])], ["viewer"]);
  assert.equal(NEEDS.standardinforce, owner.needs ?? null);
  assert.ok(SESSION_OPS.member.has("standardinforce") && SESSION_OPS.admin.has("standardinforce"), "standardinforce is not in both session sets");
  assert.equal(ACT_GATE.mode("standardinforce"), "session");
  assert.equal(explained("standardinforce") !== ground("standardinforce").length > 0, true, "explained, or named under one ground, never both or neither");
  assert.ok(!machineAdmits("standardinforce").includes("ai"));
  /* controls: the siblings are not drawn as session acts, and a name in no set answers machine */
  for (const op of ["standard", "standards"]) assert.ok(!SESSION_OPS.member.has(op) && ACT_GATE.mode(op) === "machine", op);
  assert.equal(ACT_GATE.mode("nosuchop"), "machine");
});

test("R83 (T51 fix round; K4237; screens-settings C30): export, the copy of the group's records, is in SESSION_OPS.admin — the founder's session — and in no other set, so the founder's session can take a copy and the shell's act gate answers admin-session for it; its spec (classes admin, mutating) and NEEDS row are unchanged, and it is in no member set (negative control: a member session's set lacks it, the gate answers admin-session, never session; its siblings exportlog and exportpage stay out of the admin set; an `ai` credential is no class of it)", () => {
  assert.deepEqual(plain(OPS.export), { classes: ["admin"], mutating: true });
  assert.ok(SESSION_OPS.admin.has("export"), "the founder's session set lacks export");
  assert.ok(!SESSION_OPS.member.has("export"), "a member session's set holds export");
  assert.equal(ACT_GATE.mode("export"), "admin-session");
  assert.ok(!machineAdmits("export").includes("ai") && !machineAdmits("export").includes("member"));
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, "export"));
  /* a session reaches a mutating op, so it has a NEEDS row (R3's census): a present null, no working capability */
  assert.ok(Object.hasOwn(NEEDS, "export") && NEEDS.export === null && ACT_GATE.needs("export") === null);
  /* the composition refuses a founder-session row for an op another part holds (R3's control) */
  assert.throws(() => composeNeeds({ export: null }, {}, { export: null }), (e) => e instanceof TypeError && e.message.includes("export"));
  assert.deepEqual(composeNeeds({ a: null }, { b: "contribute" }, { c: null }), { a: null, b: "contribute", c: null });
  /* controls: the neighbours it was declared beside are not drawn to the founder's session, and a member's set holds none of the three */
  for (const op of ["exportpage"]) assert.ok(!SESSION_OPS.admin.has(op) && !SESSION_OPS.member.has(op), op);
  assert.ok(!SESSION_OPS.member.has("export") && ACT_GATE.mode("exportlog") !== "admin-session");
  assert.ok(!ground("export").length, "export is not a member op: R34's partition does not run over it");
});

test("R19, R2, R3, R4, R34 (T51 fix round 6, G55; K4208): moneyingestread is calculations' read beside moneyingest — in calculations' family as a read, so its spec, NEEDS row, session sets and viewer stamp are those of calculations' other reads (table), its request fields ingest, kind, after and limit are no stamp, it is named under the read ground alone, and moneyingest stays a member's act with its spec, row and ground (negative control: the act is not a read and the read is not mutating)", () => {
  assert.deepEqual(familyOf("moneyingestread"), ["calculations"]);
  assert.equal(OP_FAMILIES.calculations.kinds.moneyingestread, "read");
  assert.deepEqual(plain(OPS.moneyingestread), plain(OPS.table));
  assert.equal(OPS.moneyingestread.mutating, false);
  assert.equal(NEEDS.moneyingestread, NEEDS.table);
  assert.ok(Object.hasOwn(NEEDS, "moneyingestread") && NEEDS.moneyingestread === null);
  assert.equal(both("moneyingestread"), both("table"));
  assert.deepEqual(stamps("moneyingestread"), stamps("table"));
  assert.deepEqual(stamps("moneyingestread"), ["viewer"]);
  for (const field of ["ingest", "kind", "after", "limit"]) assert.ok(!(stamps("moneyingestread") ?? []).includes(field), field);
  assert.deepEqual(ground("moneyingestread"), ["read"]);
  /* the act is unchanged */
  assert.equal(OP_FAMILIES.calculations.kinds.moneyingest, "member");
  assert.equal(OPS.moneyingest.mutating, true);
  assert.deepEqual(ground("moneyingest"), ["unexplained"]);
  assert.notDeepEqual(plain(OPS.moneyingestread), plain(OPS.moneyingest));
});

test("R22, R5, R6 (T51; K5232; action-holds R22, R5, R6; screens-action R32): holdsplaced is a session read in action-holds' family — the sessionread spec, a present null NEEDS row, both session sets, viewer stamped, no bearer admitted, off AI_GRANT_OPS and never unattended, served by action-holds' ops map — and actionholdpreview and actionholdrelease accept `from` in their declared fields, holdsplaced's fields being `after` and `limit` alone (negative control: an op its owner declares no fields for answers undefined)", () => {
  assert.deepEqual(familyOf("holdsplaced"), ["action-holds"]);
  assert.equal(OP_FAMILIES["action-holds"].kinds.holdsplaced, "sessionread");
  assert.deepEqual(plain(OPS.holdsplaced), KINDS.sessionread.spec);
  assert.ok(Object.hasOwn(NEEDS, "holdsplaced") && NEEDS.holdsplaced === null);
  assert.ok(both("holdsplaced"));
  assert.deepEqual(stamps("holdsplaced"), ["viewer"]);
  assert.deepEqual(machineAdmits("holdsplaced"), []);
  assert.ok(!AI_GRANT_OPS.includes("holdsplaced"));
  assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, "holdsplaced"));
  assert.ok(keysOf(actionHoldsOps).includes("holdsplaced"), "action-holds' ops map serves holdsplaced");
  /* the fields: the request names `after` and `limit`; nothing is required */
  assert.deepEqual(O.declaredFields("holdsplaced"), { accepts: ["after", "limit"], requires: [] });
  /* `from` is accepted by the two acts' previews and releases (action-holds R5, R6; K5232) */
  for (const op of ["actionholdpreview", "actionholdrelease"]) {
    assert.ok(O.declaredFields(op).accepts.includes("from"), `${op}: does not accept from`);
    assert.ok(O.declaredFields(op).accepts.includes("target") && O.declaredFields(op).accepts.includes("ord"), op);
  }
  /* negative control: an op its owner declares no fields for answers undefined */
  assert.equal(O.declaredFields("holdsdue"), undefined);
});
