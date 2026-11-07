/* affordances in the running plane (Miniflare, the Durable Object the product runs in). `affordanceFacts` (R13–R16,
   R23) is this module's (`affordancesOf(ctx)`, T9), reached in-process through the durable object's
   `op=affordancefacts` route, and the `op=affordances` composition (R17) is this module's too since T19
   (`affordancesOp`, the control plane handing in its gate and stamps), reached through the door; both are measured
   here at those interfaces (K208 Q1). What the acting modules
   answer when an act is performed is driven here too: the rung backing (R19), the machine map (R20), the agreement
   between an offer and its act (R18's roster half), and that asking writes nothing (R22). */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS, VOCABULARIES, deriveActs, decorate, PER_ITEM_MAX, ACT_HELP } from "../../../src/affordances.mjs";
import { MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, RUNGS, RUNG_ABSENT } from "../../../src/op-grades/index.mjs";
import * as actionGrammar from "../../../src/action-grammar/index.mjs";
import { list as listProfiles, combine as combineProfiles } from "../../../../jurisdictions/index.mjs";

import { T33_RUNGS } from "../../../src/op-grades/t33.mjs";
import { T35_RUNGS } from "../../../src/op-grades/t35.mjs";
import { T36_RUNGS } from "../../../src/op-grades/t36.mjs";
import { T38_RUNGS } from "../../../src/op-grades/t38.mjs";
import { T41_RUNGS } from "../../../src/op-grades/t41.mjs";
import { T45_RUNGS } from "../../../src/op-grades/t45.mjs";
import { T46_RUNGS } from "../../../src/op-grades/t46.mjs";
import { T47_RUNGS } from "../../../src/op-grades/t47.mjs";
import { OP_ALIASES } from "../../../src/op-grades/t34.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { sourcesOps } from "../../../src/sources/index.mjs";
import { actionRepliesOps } from "../../../src/action-replies/index.mjs";
import { planWorkOps } from "../../../src/plan-work/index.mjs";
import { actionHoldsOps } from "../../../src/action-holds/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { actionClocksOps } from "../../../src/action-clocks/index.mjs";
/* R39's vocabularies, by name. */
const R39_KEYS = ["event_kinds", "dated_fact_kinds", "event_statuses", "participant_roles", "event_relation_kinds",
  "line_kinds", "line_capacities", "line_roles", "money_kinds", "money_phases", "money_stages", "money_bases",
  "money_precisions", "connection_kinds", "identity_claim_kinds"];
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src");
/* N463 (plane R8): the Worker entry is the plane's own `src/plane/index.mjs`. */
const ENTRY = join(SRC, "plane", "index.mjs");
const ADM = "adm-aff", MEM = "mem-aff";
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: ENTRY,
  script: readFileSync(ENTRY, "utf8"), modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { INSTANCE_NAME: "aff-plane", ADMIN_TOKEN: ADM, MEMBER_TOKEN: MEM, VERSION: "test",
              GOVERNOR_APPETITE_PER_MIN: "600000" },
});
after(() => mf.dispose());

const sha = (v) => createHash("sha256").update(v).digest("hex");
const unwrap = (r) => (r && typeof r === "object" && "result" in r ? r.result : r);
/* admission R20 (T36-36, K2166): a credential is read only from the Authorization header or the body, never the
   address (`CREDENTIAL_IN_ADDRESS`, C-38.10). The suite still names its credential as `token=…` in each call, for
   readability, as membership's members.test.mjs does (K2182); `call` lifts it out of the address into
   `Authorization: Bearer …` before the request is sent, so no request here carries a credential in its address. */
const call = async (q, body) => {
  const params = new URLSearchParams(q);
  const token = params.get("token");
  params.delete("token");
  const headers = token === null ? {} : { authorization: `Bearer ${token}` };
  const r = await mf.dispatchFetch(`http://x/api/?${params}`,
    body === undefined ? { headers } : { method: "POST", body: JSON.stringify(body), headers });
  return { status: r.status, body: await r.json() };
};
const GET = async (q) => unwrap((await call(q)).body);
const POST = async (q, body) => unwrap((await call(q, body ?? {})).body);
const DO = async (path, body) => {
  const ns = await mf.getDurableObjectNamespace("STORE");
  return unwrap(await (await ns.get(ns.idFromName("bio")).fetch(`http://x/${path}`,
    { method: "POST", body: JSON.stringify(body ?? {}) })).json());
};
const E = encodeURIComponent;
const codeOf = (r) => (r && r.ok === true) ? "ok" : (r && typeof r.code === "string") ? r.code : (r && r.reason) || null;
const must = (l, r) => { if (!r || r.ok === false) throw new Error(`${l}: ${JSON.stringify(r).slice(0, 500)}`); return r; };
const NOW = "2026-07-01T00:00:00Z", LATER = "2026-07-02T00:00:00Z";
const facts = (target, { viewer = "admin", identity, author, by } = {}) =>
  DO(`affordancefacts?target=${E(target)}&viewer=${E(viewer)}`
    + (identity !== undefined ? `&identity=${E(identity)}` : "")
    + (author !== undefined ? `&author=${E(author)}` : "") + (by !== undefined ? `&by=${E(by)}` : ""));
const offered = async (tok, target) => ((await GET(`op=affordances&token=${tok}&target=${E(target)}`))?.acts ?? []).map((a) => a.id);

const W = {};
before(async () => {
  must("claim", await POST("op=claim", { bootstrapToken: ADM, password: "founder-passphrase-aff" }));
  /* control-plane R83 (T47; credentials R65): a sign-in names the handle, never a role; the founder's handle is `admin` */
  W.FOUNDER = (await POST("op=login", { handle: "admin", password: "founder-passphrase-aff", device: "own" })).token;
  const enrol = async (memberId, role) => {
    const add = await POST(`op=memberadd&token=${ADM}`, { memberId, cover: `cover for ${memberId}`, role,
      capabilities: ["contribute", "publish", "create_projects"] });
    must(`enroll ${memberId}`, await POST("op=enroll", { invite: add && add.invite, handle: memberId, password: `${memberId}-pass-aff` }));
    const lg = await POST("op=login", { handle: memberId, password: `${memberId}-pass-aff`, device: "own" });
    if (!lg || !lg.token) throw new Error(`login ${memberId}: ${JSON.stringify(lg)}`);
    return lg.token;
  };
  W.RUTH = await enrol("ruth", "admin");   // an administrator holding no position anywhere
  W.IRIS = await enrol("iris", "member");  // owns PA and PC; joined PB
  W.PAM = await enrol("pam", "member");    // owns PB; joined PA; second owner of PC
  W.OLGA = await enrol("olga", "member");  // invited to PA, never joins
  W.ZED = await enrol("zed", "member");    // joined PA, then asked to leave
  W.VERA = await enrol("vera", "member");  // sole owner of PR, deactivated
  W.NELL = await enrol("nell", "member");  // on no roster; sees no hidden project
  let seq = 0;
  const promote = async (id, text, type, state, register = [], as = W.RUTH) => must(`promote ${id ?? type}`, await POST(`op=promote&token=${type === "project" ? ADM : as}`, {
    ...(id ? { bundleId: id } : {}), base: null, snapKey: `aff-${++seq}-${sha(text).slice(0, 6)}`,
    files: [{ path: "bundle.md", text, bytes: text.length, sha256: sha(text) }], register,
    meta: { object_type: type, group: "aff-plane", current_state: state, created: NOW, last_updated: LATER } }));
  const projectMd = (name) => ["---", "object_type: project", `title: "${name}"`, "current_state: forming",
    `created: "${NOW}"`, `last_updated: "${LATER}"`, `objective: "Establish what ${name} is for."`, "references: []",
    "required_strength:", "  capture: B", "  connection: C", "---", "", "## Summary", "", "A project.", "",
    "## Session Log", ""].join("\n");
  for (const p of ["PA", "PB", "PC", "PR"]) W[p] = (await promote(null, projectMd(`Affordances project ${p}`), "project", "forming")).bundleId;
  W.project = async (name) => (await promote(null, projectMd(name), "project", "forming")).bundleId;
  const own = (p, m) => DO("projectclaimowner", { projectId: W[p], memberId: m });
  /* D54 (K2408): the founder's viewer sees a hidden project it is neither invited nor joined to only at EXISTENCE, so the
     invitation is asked with the inviting owner's own viewer, as the control plane stamps it */
  const invite = (p, h, by) => DO(`projectinvite?projectId=${W[p]}&handle=${h}&by=${by}&viewer=${E(`member:${by}`)}`, {});
  W.own = own; W.invite = invite;
  must("iris owns PA", await own("PA", "iris")); must("pam owns PB", await own("PB", "pam"));
  must("iris owns PC", await own("PC", "iris")); must("vera owns PR", await own("PR", "vera"));
  for (const h of ["pam", "olga", "zed"]) must(`invite ${h}`, await invite("PA", h, "iris"));
  must("pam joins PA", await POST(`op=projectjoin&token=${W.PAM}&projectId=${W.PA}`));
  must("zed joins PA", await POST(`op=projectjoin&token=${W.ZED}&projectId=${W.PA}`));
  must("zed asks to leave PA", await POST(`op=projectleave&token=${W.ZED}&projectId=${W.PA}`));
  must("invite iris to PB", await invite("PB", "iris", "pam"));
  must("iris joins PB", await POST(`op=projectjoin&token=${W.IRIS}&projectId=${W.PB}`));
  must("invite pam to PC", await invite("PC", "pam", "iris"));
  must("pam joins PC", await POST(`op=projectjoin&token=${W.PAM}&projectId=${W.PC}`));
  must("pam second owner of PC", await POST(`op=projectowneradd&token=${W.IRIS}&projectId=${W.PC}&handle=pam`));
  must("vera deactivated", await POST(`op=memberset&token=${ADM}`, { memberId: "vera", status: "revoked" }));

  const fm = (id, type, state, extra = []) => ["---", `id: ${id}`, `object_type: ${type}`, `schema: ${type}@1`,
    `title: "${type} ${id}"`, `current_state: ${state}`, "prior_state: null", `created: "${NOW}"`, `last_updated: "${LATER}"`,
    "produced_by:", "  mode: agent", "  capability_tier: high", "group: aff-plane", ...extra];
  const tail = ["state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null",
    "  source: null", "visuals: []"];
  const sc = (k, v) => v === null ? [`    ${k}: null`] : typeof v === "boolean" ? [`    ${k}: ${v}`] : [`    ${k}: "${String(v)}"`];
  const infoMd = (id) => [...fm(id, "information", "collected", ["references: []"]), ...tail, "---", "", "## Summary", "",
    "A captured document.", "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const inquiryMd = (id, basis, reading) => [...fm(id, "inquiry", "open", ["references:", `  - target: ${basis}`,
    "    rel: cites", "    status: confirmed"]), ...tail, "surfaced_by: agent", 'disposition_reason: ""',
    "basis:", `  - target: ${basis}`, "    role: supports",
    ...(reading ? ["basis_versions:", '  - name: "v1"', ...sc("description", "the ledger reading"),
      ...sc("relationship", "and"), ...sc("state", "suggested"), ...sc("derived_from", null), ...sc("hidden", false),
      ...sc("claim", "The transfer followed the process."), ...sc("author", "iris"), ...sc("at", NOW),
      "basis_version_grounds:", '  - version: "v1"', ...sc("ground", "g1"), ...sc("asserted_by", "iris"), ...sc("at", NOW),
      "basis_version_legs:", '  - version: "v1"', ...sc("target", basis), ...sc("role", "supports"),
      ...sc("ground", "g1"), ...sc("grade", "B"), ...sc("grade_axis", "capture"), ...sc("grade_source", "capture")] : []),
    "---", "", "## Question", "", "Did it?", "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const actnMd = (id) => [...fm(id, "action", "planned", ["references: []"]), ...tail, "action_kind: records_request",
    "target_body:", "  name: The records office", "---", "", "## Request", "", "Records.", "", "## Session Log", "",
    "## Review Notes", ""].join("\n");
  W.INFO = "INFO-2026-9400-ledger"; W.INFO2 = "INFO-2026-9401-minutes";
  W.INQ = "INQ-2026-9400-transfer"; W.INQ2 = "INQ-2026-9401-follow"; W.ACTN = "ACTN-2026-9400-request";
  const reg = (id) => [{ path: "snapshots/doc.bin", sha256: sha(`capture-of-${id}`), encoding: "binary", bytes: 10 }];
  await promote(W.INFO, infoMd(W.INFO), "information", "collected", reg(W.INFO));
  await promote(W.INFO2, infoMd(W.INFO2), "information", "collected", reg(W.INFO2));
  await promote(W.INQ, inquiryMd(W.INQ, W.INFO, true), "inquiry", "open");
  await promote(W.INQ2, inquiryMd(W.INQ2, W.INQ, false), "inquiry", "open");   // a working inquiry resting on INQ
  await promote(W.ACTN, actnMd(W.ACTN), "action", "planned");
  /* iris's project PA cites both documents; the second citation is then severed. */
  const sel = async (tok, ids) => must("select", await POST(`op=select&token=${tok}&kind=enumerated`, { ids })).handle;
  W.sel = sel;
  Object.assign(W, { promote, infoMd, inquiryMd, reg });
  must("PA cites INFO", await GET(`op=cite&token=${W.IRIS}&project=${W.PA}&handle=${await sel(W.IRIS, [W.INFO])}&note=basis`));
  must("PA cites INFO2", await GET(`op=cite&token=${W.IRIS}&project=${W.PA}&handle=${await sel(W.IRIS, [W.INFO2])}&note=basis`));
  must("PA severs INFO2", await GET(`op=sever&token=${W.IRIS}&project=${W.PA}&handle=${await sel(W.IRIS, [W.INFO2])}&reason=${E("no longer relied on")}`));
});

/* ============================================================ R13–R16, R23: the facts */
test("R13: no target is NO_TARGET; an absent bundle and one the viewer may not see are both NO_SUCH_BUNDLE, alike", async () => {
  assert.equal((await DO("affordancefacts?viewer=admin")).reason, "NO_TARGET");
  const absent = await facts("PRJ-2026-9999-nowhere", { viewer: "member:nell" });
  const hidden = await facts(W.PA, { viewer: "member:nell" });
  assert.equal(absent.reason, "NO_SUCH_BUNDLE"); assert.equal(hidden.reason, "NO_SUCH_BUNDLE");
  assert.deepEqual(Object.keys(hidden).sort(), Object.keys(absent).sort());
  assert.deepEqual({ ...hidden, target: null }, { ...absent, target: null });
  const seen = await facts(W.PA, { viewer: "member:iris" });
  assert.equal(seen.ok, true);
});

const FACT_KEYS = ["ok", "target", "object_type", "declared_type", "current_state", "criticality", "case_member",
  "project_owner", "project_target_owner", "project_participant", "roster", "actor_is_machine", "concludes_for_project",
  "concluded_for_project", "edition_warranted_for_project", "basis_legs", "contradiction_inquiry",
  "contradiction_sides_seen" /* N365 */, "rested_on",
  "basis_version_states", "basis_versions", "cites_in", "cites_out", "cited_by_case",
  "action" /* R51: an action's own facts, null on any other type */,
  "legs_in" /* R55: the questions holding a leg on an information target, by status */].sort();
/* R51: an action's facts, with their sub-keys */
const ACTION_KEYS = ["clock", "closed", "drafts", "entries", "escalation", "holds_in_place", "preparable",
  "request_for_comment"];
test("R14 R51 R52: the answer carries exactly R14's facts, with their sub-keys, and an action's own facts only on an action", async () => {
  for (const id of [W.INFO, W.INQ, W.ACTN, W.PA]) {
    const f = await facts(id, { viewer: "member:iris", identity: "member:iris", author: "member:iris", by: "iris" });
    assert.deepEqual(Object.keys(f).sort(), FACT_KEYS, id);
    assert.deepEqual(Object.keys(f.rested_on).sort(), ["frozen", "severed", "working"]);
    assert.deepEqual(Object.keys(f.cites_in).sort(), ["confirmed", "severed"]);
    assert.deepEqual(Object.keys(f.cites_out).sort(), ["confirmed", "severed", "severed_reinstatable"]);
    assert.deepEqual(Object.keys(f.cited_by_case).sort(), ["confirmed", "severed"]);
    assert.deepEqual(Object.keys(f.legs_in).sort(), ["live", "severed"]);
    if (id !== W.INFO) assert.deepEqual(f.legs_in, { live: null, severed: null }, `R55: ${id} is no information`);
    assert.equal(f.target, id);
    if (id === W.ACTN) {
      assert.deepEqual(Object.keys(f.action).sort(), ACTION_KEYS);
      assert.deepEqual(Object.keys(f.action.entries).sort(), ["all", "received", "received_unmarked", "sent"]);
      /* R52: the standing dated proposals' keys, and escalation's stop, reopening and stage-7 purposes */
      assert.deepEqual(Object.keys(f.action.clock).sort(), ["dated", "entries", "proposals", "reminders_room"]);
      assert.deepEqual(Object.keys(f.action.escalation).sort(),
        ["attach_purposes", "attachable", "openable", "reopenable", "stoppable"]);
    } else assert.equal(f.action, null, id);
  }
});

test("R14: declared_type, basis_legs and the reading states come from the document's own front matter", async () => {
  const q = await facts(W.INQ);
  assert.deepEqual([q.object_type, q.declared_type, q.current_state, q.basis_legs, q.basis_version_states, q.basis_versions],
    ["inquiry", "inquiry", "open", 1, ["suggested"], 1]);
  const q2 = await facts(W.INQ2);
  assert.deepEqual([q2.basis_legs, q2.basis_version_states, q2.basis_versions], [1, [], 0]);
  /* N345: neither document carries `contradiction`; a type that is not an inquiry reads null (the true arm is driven
     over contradiction's fixture, contradiction.test.mjs) */
  assert.deepEqual([q.contradiction_inquiry, q2.contradiction_inquiry], [false, false]);
  for (const id of [W.INFO, W.ACTN, W.PA]) assert.equal((await facts(id, { viewer: "member:iris" })).contradiction_inquiry, null, id);
  /* N365: contradiction_sides_seen is null wherever contradiction_inquiry is not true (its true and false arms are
     driven over contradiction's fixture) */
  for (const id of [W.INQ, W.INQ2, W.INFO, W.ACTN, W.PA]) assert.equal((await facts(id, { viewer: "member:iris" })).contradiction_sides_seen, null, id);
});

test("R14: the citation facts are the ones the acts refuse on — a live and a severed citation from a project, counted "
   + "on both ends, and a severed edge onto a live target reinstatable", async () => {
  const pa = await facts(W.PA, { viewer: "member:iris", identity: "member:iris", by: "iris" });
  assert.deepEqual(pa.cites_out, { confirmed: 1, severed: 1, severed_reinstatable: 1 });
  const i1 = await facts(W.INFO), i2 = await facts(W.INFO2);
  assert.deepEqual([i1.cited_by_case, i2.cited_by_case], [{ confirmed: 1, severed: 0 }, { confirmed: 0, severed: 1 }]);
  /* agreement: sever is offered on INFO and reinstate on INFO2, and each act is accepted there. */
  assert.ok((await offered(W.IRIS, W.INFO)).includes("sever"));
  assert.ok((await offered(W.IRIS, W.INFO2)).includes("reinstate"));
  assert.ok(!(await offered(W.IRIS, W.INFO)).includes("reinstate"));
  /* each offered act performed by the caller it was offered to, and taken back, so the scene the later tests read stands */
  const move = async (op, id, why) => codeOf(await GET(`op=${op}&token=${W.IRIS}&project=${W.PA}`
    + `&handle=${await W.sel(W.IRIS, [id])}&reason=${E(why)}`));
  assert.equal(await move("sever", W.INFO, "checked offer"), "ok");
  assert.equal(await move("reinstate", W.INFO, "restored"), "ok");
  assert.equal(await move("reinstate", W.INFO2, "checked offer"), "ok");
  assert.equal(await move("sever", W.INFO2, "no longer relied on"), "ok");
  assert.deepEqual([(await facts(W.INFO)).cited_by_case, (await facts(W.INFO2)).cited_by_case],
    [{ confirmed: 1, severed: 0 }, { confirmed: 0, severed: 1 }]);
});

test("R14: what rests on an inquiry is counted through inquiry's live-leg predicate — the working inquiry resting on it", async () => {
  const q = await facts(W.INQ);
  assert.equal(q.rested_on.working, 1);
  assert.equal((await facts(W.INQ2)).rested_on.working, 0);
  /* and divide, which refuses while a working leg rests on the question, is withheld there (R8's condition) */
  assert.ok(!(await offered(W.IRIS, W.INQ)).includes("inquirydivide"));
});

test("R14 R15: machine is asked of `author` through isMachineIdentity, null when no author was sent", async () => {
  assert.equal((await facts(W.INQ, { author: "member:iris" })).actor_is_machine, false);
  assert.equal((await facts(W.INQ, { author: "token:member" })).actor_is_machine, true);
  assert.equal((await facts(W.INQ)).actor_is_machine, null);
});

test("R15: positional facts are asked of who the caller is (identity), not of what it may see (viewer)", async () => {
  /* pam's sight (joined PA, no owner there), asked as olga (who owns nothing and joined nothing) and as iris (owner of
     PA); D54: an administrator's sight of hidden PA is EXISTENCE, driven in its own test below */
  const asOlga = await facts(W.PA, { viewer: "member:pam", identity: "member:olga" });
  const asIris = await facts(W.PA, { viewer: "member:pam", identity: "member:iris" });
  assert.deepEqual([asOlga.project_owner, asOlga.project_target_owner, asOlga.project_participant], [false, false, false]);
  assert.deepEqual([asIris.project_owner, asIris.project_target_owner, asIris.project_participant], [true, true, true]);
  /* identity absent: the viewer's own member answers */
  const viewerOnly = await facts(W.PA, { viewer: "member:iris" });
  assert.deepEqual([viewerOnly.project_owner, viewerOnly.project_target_owner], [true, true]);
  /* a caller with no roster position (a class credential) reads null */
  const cls = await facts(W.PA, { viewer: "member:pam", identity: "class:member" });
  assert.deepEqual([cls.project_owner, cls.project_target_owner, cls.project_participant], [null, null, null]);
});

test("R15: roster is asked of `by`, never of identity", async () => {
  const f = await facts(W.PA, { viewer: "member:pam", identity: "member:olga", by: "iris" });
  assert.deepEqual([f.roster.owner, f.roster.state], [true, "joined"]);
  const g = await facts(W.PA, { viewer: "member:pam", identity: "member:iris", by: "olga" });
  assert.deepEqual([g.roster.owner, g.roster.state], [false, "invited"]);
  assert.equal((await facts(W.PA, { viewer: "member:pam", identity: "member:iris" })).roster, null);
});

/* N874 (K2726; T44-9): plane's T44-13 stamps an `ai` caller's `by` as control-plane R17's `class:ai/<tokenId>`, where
   the generic forward stamped `class:ai`. A credential's stamp names no participation row, so the roster is null for
   both forms, alike, on every project and at a hidden project's EXISTENCE (R15), and both are offered the same acts,
   none of them a roster act (R10, R18); the members' rosters, read beside them, are not null (negative control). */
test("R15 R18 (N874): roster is null for a credential's `by` — `class:ai/<tokenId>` exactly as `class:ai` and a bearer's "
   + "`class:<cls>` — on every project and at a hidden one's EXISTENCE, so the two forms answer alike and are offered no "
   + "roster act; a member's `by` still reads a roster", async () => {
  const ROSTER = ["projectinvite", "projectjoin", "projectleave", "projectremove", "projectowneradd",
    "projectownerremove", "projectownerrescue"];   /* projectvisibilityset is asked of identity, not `by` (R15) */
  const STAMPS = ["class:ai", "class:ai/tok-aff-1", "class:ai/9f2c", "class:member", "token:member"];
  const cases = [...["PA", "PB", "PC"].map((p) => [W[p], { viewer: "member:pam", identity: "member:pam", author: "member:pam" }]),
    /* PR at EXISTENCE: hidden, its sole owner deactivated, seen by an administrator neither invited nor joined (D54) */
    [W.PR, { viewer: "member:ruth", identity: "member:ruth", author: "member:ruth" }]];
  for (const [p, who] of cases) {
    const base = await facts(p, { ...who, by: "class:ai" });
    assert.equal(base.ok, true, JSON.stringify(base).slice(0, 300));
    for (const by of STAMPS) {
      const f = await facts(p, { ...who, by });
      assert.equal(f.roster, null, `${p} ${by}`);
      assert.deepEqual(f, base, `${p}: ${by} answers as class:ai`);
      assert.deepEqual(deriveActs(f).map((a) => a.id).filter((id) => ROSTER.includes(id)), [], `${p} ${by}`);
    }
  }
  /* negative control: the same projects asked with a member's `by` read a roster, and ruth's rescue of PR is open */
  assert.deepEqual([(await facts(W.PA, { viewer: "member:pam", by: "iris" })).roster.owner,
                    (await facts(W.PR, { viewer: "member:ruth", identity: "member:ruth", by: "ruth" })).roster.rescue_open], [true, true]);
  assert.ok(deriveActs(await facts(W.PR, { viewer: "member:ruth", identity: "member:ruth", by: "ruth" })).some((a) => a.id === "projectownerrescue"));
  /* and the act agrees (R18): a credential stamp is no administrator, so the rescue the null withholds is refused it */
  for (const by of ["class:ai", "class:ai/tok-aff-1"])
    assert.equal(codeOf(await DO(`projectownerrescue?projectId=${W.PR}&handle=ruth&by=${E(by)}&viewer=admin`,
      { reason: "stranded" })), "NOT_AN_ADMIN", by);
});

test("R15: each positional fact is null on a target of the wrong type", async () => {
  const inq = await facts(W.INQ, { identity: "member:iris", by: "iris" });
  assert.deepEqual([inq.project_target_owner, inq.project_participant, inq.roster], [null, null, null]);
  const pa = await facts(W.PA, { viewer: "member:iris", identity: "member:iris", by: "iris" });
  assert.deepEqual([pa.concludes_for_project, pa.concluded_for_project, pa.edition_warranted_for_project], [null, null, null]);
  for (const id of [W.INFO, W.ACTN]) {
    const f = await facts(id, { identity: "member:iris", by: "iris" });
    assert.deepEqual([f.project_target_owner, f.project_participant, f.roster, f.concludes_for_project,
      f.concluded_for_project, f.edition_warranted_for_project], [null, null, null, null, null, null], id);
  }
});

test("R16 R14: facts are counts, never ids — cites_in, cited_by_case, cites_out and rested_on are numbers, and no "
   + "fact names a bundle other than the target", async () => {
  const counts = (o) => Object.values(o).every((v) => Number.isInteger(v) && v >= 0);
  const i1 = await facts(W.INFO), i2 = await facts(W.INFO2);
  /* INFO is cited by PA and by INQ's basis leg (a question writes `rel: cites` too); INFO2's one citation was severed */
  assert.deepEqual([i1.cites_in, i2.cites_in], [{ confirmed: 2, severed: 0 }, { confirmed: 0, severed: 1 }]);
  for (const id of [W.INFO, W.INFO2, W.INQ, W.INQ2, W.ACTN, W.PA]) {
    const f = await facts(id, { viewer: "member:iris", identity: "member:iris", by: "iris", author: "member:iris" });
    for (const k of ["cites_in", "cited_by_case", "cites_out", "rested_on"]) assert.ok(counts(f[k]), `${id}.${k}: ${JSON.stringify(f[k])}`);
    for (const k of ["basis_legs", "basis_versions"]) assert.ok(Number.isInteger(f[k]), `${id}.${k}`);
    const text = JSON.stringify({ ...f, target: null });
    for (const other of [W.INFO, W.INFO2, W.INQ, W.INQ2, W.ACTN, W.PA, W.PB, W.PC, W.PR]) assert.ok(!text.includes(other), `${id}: ${other}`);
  }
});

test("R23: the joined-project predicates are asked only for the caller's own member id, over projects the viewer can see", async () => {
  /* PA (iris owns and joined it; hidden) cites INFO, which INQ rests on — PA does not cite INQ, so iris concludes nothing yet */
  const own = await facts(W.INQ, { viewer: "member:iris", identity: "member:iris" });
  const olga = await facts(W.INQ, { viewer: "member:olga", identity: "member:olga" });
  assert.equal(olga.concludes_for_project, false);
  assert.equal(typeof own.concludes_for_project, "boolean");
  /* PA cites INQ: iris, who joined PA, now concludes for a project; olga (invited, never joined) does not;
     and iris's identity asked under nell's sight (who sees no hidden project) concludes nothing */
  must("PA cites INQ", await GET(`op=cite&token=${W.IRIS}&project=${W.PA}&handle=${await W.sel(W.IRIS, [W.INQ])}&note=basis`));
  assert.equal((await facts(W.INQ, { viewer: "member:iris", identity: "member:iris" })).concludes_for_project, true);
  assert.equal((await facts(W.INQ, { viewer: "member:olga", identity: "member:olga" })).concludes_for_project, false);
  assert.equal((await facts(W.INQ, { viewer: "member:nell", identity: "member:iris" })).concludes_for_project, false);
  assert.equal((await facts(W.INQ, { viewer: "admin", identity: "member:olga" })).concludes_for_project, false);
  /* D54: the founder's sight of hidden PA is EXISTENCE, so iris's identity under it concludes for no project there */
  assert.equal((await facts(W.INQ, { viewer: "admin", identity: "member:iris" })).concludes_for_project, false);
});

/* D54 (K2408; membership R44, R60; J1's reading of R13, R14): an administrator, the founder included, neither invited
   nor joined to a HIDDEN project sees it only at EXISTENCE. Its facts carry none of its contents, only the caller's own
   positions and the rescue's one fact, so the rescue is the one act offered there, exactly where it is accepted (R18).
   Negative controls (K874): a member who is no administrator is answered NO_SUCH_BUNDLE as for an absent id; the same
   administrator on a discoverable project, and an invited administrator, see it whole (R14's facts in full). */
test("R13 R14 R16 R18 (D54): an administrator neither invited nor joined to a hidden project is answered at EXISTENCE — "
   + "no content fact, the rescue offered exactly where it is accepted and nothing else; a discoverable project, or an "
   + "invited administrator, is seen whole; a member who is no administrator gets NO_SUCH_BUNDLE", async () => {
  const PH = await W.project("Affordances project PH"), PE = await W.project("Affordances project PE");
  W.PH = PH; must("iris owns PH", await W.own("PH", "iris"));
  W.PE = PE; must("iris owns PE", await W.own("PE", "iris"));
  must("PE discoverable", await POST(`op=projectvisibilityset&token=${W.IRIS}&projectId=${PE}&setting=discoverable`));
  const CONTENT = ["declared_type", "current_state", "criticality", "case_member", "concludes_for_project",
    "concluded_for_project", "edition_warranted_for_project", "basis_legs", "contradiction_inquiry",
    "contradiction_sides_seen", "basis_version_states", "basis_versions"];
  const COUNTS = ["rested_on", "cites_in", "cites_out", "cited_by_case"];
  for (const viewer of ["admin", "member:ruth"]) {
    const by = viewer === "admin" ? "admin" : "ruth";
    const f = await facts(PH, { viewer, identity: viewer, author: viewer, by });
    assert.deepEqual(Object.keys(f).sort(), FACT_KEYS, viewer);
    assert.deepEqual([f.ok, f.target, f.object_type], [true, PH, "project"], viewer);
    for (const k of CONTENT) assert.equal(f[k], null, `${viewer}: ${k}`);
    for (const k of COUNTS) assert.ok(Object.values(f[k]).every((v) => v === null), `${viewer}: ${k}`);
    assert.deepEqual([f.project_target_owner, f.project_participant], [false, false], viewer);
    assert.deepEqual(f.roster, { owner: false, state: null, owner_floor_clear: null, other_owner_committed: null,
                                 rescue_open: false }, viewer);
    assert.deepEqual(deriveActs(f).map((a) => a.id), [], `${viewer}: PH's owner is active, so no rescue`);
  }
  /* PR: hidden, its sole owner deactivated — the rescue is open to ruth, offered, and accepted (a parameter's refusal) */
  const pr = await facts(W.PR, { viewer: "member:ruth", identity: "member:ruth", author: "member:ruth", by: "ruth" });
  assert.equal(pr.current_state, null);
  assert.equal(pr.roster.rescue_open, true);
  assert.deepEqual(deriveActs(pr).map((a) => a.id), ["projectownerrescue"]);
  assert.deepEqual(await offered(W.RUTH, W.PR), ["projectownerrescue"]);
  assert.equal(codeOf(await POST(`op=projectownerrescue&token=${W.RUTH}&projectId=${W.PR}&handle=__nobody__&reason=${E("stranded")}`)),
    "NO_SUCH_HANDLE");
  /* the content acts are refused there, as they are withheld */
  assert.equal(codeOf(await GET(`op=cite&token=${W.RUTH}&project=${W.PR}&handle=${await W.sel(W.RUTH, [W.INFO])}&note=basis`)),
    "PROJECT_SEEN_NOT_A_PARTICIPANT");
  /* R16: nothing names a bundle but the target, and nothing of the project's contents (its title) is told */
  assert.ok(!JSON.stringify({ ...pr, target: null }).includes(W.PR));
  /* negative control: a member who is no administrator sees the hidden project not at all */
  const nell = await facts(PH, { viewer: "member:nell", identity: "member:nell", by: "nell" });
  const absent = await facts("PRJ-2026-9999-nowhere", { viewer: "member:nell" });
  assert.deepEqual({ ...nell, target: null }, { ...absent, target: null });
  assert.equal(nell.reason, "NO_SUCH_BUNDLE");
  /* negative control: discoverable, the administrator is at FULL, R14's facts in full */
  for (const viewer of ["admin", "member:ruth"]) {
    const f = await facts(PE, { viewer, identity: viewer, by: viewer === "admin" ? "admin" : "ruth" });
    assert.deepEqual([f.ok, f.current_state, f.cites_out], [true, "forming", { confirmed: 0, severed: 0, severed_reinstatable: 0 }], viewer);
    assert.equal(typeof f.roster.owner_floor_clear, "boolean", viewer);
  }
  /* negative control: invited, the administrator is at FULL on the hidden project too */
  must("invite ruth to PH", await W.invite("PH", "ruth", "iris"));
  const invited = await facts(PH, { viewer: "member:ruth", identity: "member:ruth", by: "ruth" });
  assert.deepEqual([invited.current_state, invited.roster.state, typeof invited.roster.owner_floor_clear],
    ["forming", "invited", "boolean"]);
  assert.ok((await offered(W.RUTH, PH)).includes("projectjoin"));
});

/* citeproject-inquiry's share (T18 convert): sever and reinstate on a QUESTION, offered on the case citations the
   facts count (`cited_by_case`), never on a citation by another question, and each offer agreeing with the act.
   Re-stated for citation R15 (T47; K3102, CITATION #12 J2 (2)): a question's own leg on another question is now severed
   and reinstated by the act with that question as its citing object; R9 keeps the inquiry target's offer to the case
   citations, and R55 offers the leg acts on an information target, so here the leg act is accepted and not offered — a
   withholding R18 allows (it forbids offering what is refused), never an offer the act refuses. */
test("R14 R9 R18 R55: on an inquiry target, sever and reinstate track the case citations counted in cited_by_case — a "
   + "question cited only by another question's leg is offered neither, the leg's own sever and reinstate are accepted "
   + "(citation R15), and every offer agrees with the act", async () => {
  const QX = "INQ-2026-9402-shared", QY = "INQ-2026-9403-citer";
  await W.promote(QX, W.inquiryMd(QX, W.INFO, false), "inquiry", "open");
  await W.promote(QY, W.inquiryMd(QY, QX, false), "inquiry", "open");   // a question resting on QX writes `rel: cites`
  const at = async () => {
    const f = await facts(QX, { viewer: "member:iris", identity: "member:iris", by: "iris" });
    const acts = await offered(W.IRIS, QX);
    return [f.cites_in, f.cited_by_case, acts.includes("sever"), acts.includes("reinstate")];
  };
  const act = async (op, project, reason) => codeOf(await GET(`op=${op}&token=${W.IRIS}&project=${E(project)}`
    + `&handle=${await W.sel(W.IRIS, [QX])}${reason ? `&reason=${E(reason)}` : "&note=basis"}`));
  /* cited by a question alone: neither offered (no case cites it, R9); the question's own leg is severed and reinstated
     through that citer (citation R15), and neither move offers an act the act would then refuse */
  assert.deepEqual(await at(), [{ confirmed: 1, severed: 0 }, { confirmed: 0, severed: 0 }, false, false]);
  assert.equal(await act("sever", QY, "a leg of its own"), "ok");
  assert.deepEqual(await at(), [{ confirmed: 0, severed: 1 }, { confirmed: 0, severed: 0 }, false, false]);
  assert.equal(await act("reinstate", QY, "relied on again"), "ok");
  assert.deepEqual(await at(), [{ confirmed: 1, severed: 0 }, { confirmed: 0, severed: 0 }, false, false]);
  /* two cases take it up: sever offered, reinstate not */
  assert.equal(await act("cite", W.PA), "ok");
  assert.equal(await act("cite", W.PB), "ok");
  assert.deepEqual(await at(), [{ confirmed: 3, severed: 0 }, { confirmed: 2, severed: 0 }, true, false]);
  /* one withdrawn: both offered, because both facts are true */
  assert.equal(await act("sever", W.PA, "the audit answered it"), "ok");
  assert.deepEqual(await at(), [{ confirmed: 2, severed: 1 }, { confirmed: 1, severed: 1 }, true, true]);
  assert.equal(await act("reinstate", W.PA, "the audit was superseded"), "ok");
  assert.deepEqual((await at()).slice(1), [{ confirmed: 2, severed: 0 }, true, false]);
  /* both withdrawn: reinstate alone, and a further sever, not offered, is refused */
  assert.equal(await act("sever", W.PA, "put down"), "ok");
  assert.equal(await act("sever", W.PB, "put down"), "ok");
  assert.deepEqual((await at()).slice(1), [{ confirmed: 0, severed: 2 }, false, true]);
  assert.notEqual(await act("sever", W.PA, "again"), "ok");
  assert.equal(await act("reinstate", W.PB, "back"), "ok");
});

/* R55 (T47; N977; citation R15): on an INFORMATION target, a question's own leg on it is severed and reinstated by
   `sever` and `reinstate` with the question as citing object, so each is offered where a question the viewer may see
   holds a leg on it, live for `sever` and severed for `reinstate` (`legs_in`, R14), and every offer agrees with the act.
   A question that belongs to project PB (`project:`, membership R43) is seen by iris, who joined PB, and not by nell. */
test("R55 R14 R16 R18: on an information target, sever is offered where a visible question holds a live leg on it and "
   + "reinstate where one holds a severed leg, each accepted from that caller; a question the viewer may not see offers "
   + "neither and is not counted; the facts are counts, naming no question", async () => {
  const D = "INFO-2026-9403-memo", DH = "INFO-2026-9404-note";
  const QL = "INQ-2026-9404-open", QH = "INQ-2026-9405-held", QH2 = "INQ-2026-9406-held";
  const inPB = (md) => md.replace("group: aff-plane", `group: aff-plane\nproject: ${W.PB}`);
  await W.promote(D, W.infoMd(D), "information", "collected", W.reg(D));
  await W.promote(DH, W.infoMd(DH), "information", "collected", W.reg(DH));
  await W.promote(QL, W.inquiryMd(QL, D, false), "inquiry", "open");
  /* promotion R53 (G74): a document stating a project is filed by a member of it; iris joined PB */
  await W.promote(QH, inPB(W.inquiryMd(QH, D, false)), "inquiry", "open", [], W.IRIS);
  await W.promote(QH2, inPB(W.inquiryMd(QH2, DH, false)), "inquiry", "open", [], W.IRIS);
  const who = { iris: [W.IRIS, "member:iris"], nell: [W.NELL, "member:nell"] };
  const at = async (target, m) => {
    const [tok, viewer] = who[m];
    const f = await facts(target, { viewer, identity: viewer, by: m });
    const acts = await offered(tok, target);
    return [f.legs_in, f.cited_by_case, acts.includes("sever"), acts.includes("reinstate")];
  };
  const act = async (m, op, q, target, reason) => codeOf(await GET(`op=${op}&token=${who[m][0]}&project=${E(q)}`
    + `&handle=${await W.sel(who[m][0], [target])}&reason=${E(reason)}`));
  /* the instrument: nell sees QL and not the questions that belong to PB */
  assert.equal((await facts(QL, { viewer: "member:nell" })).ok, true);
  assert.equal((await facts(QH, { viewer: "member:nell" })).reason, "NO_SUCH_BUNDLE");
  assert.equal((await facts(QH, { viewer: "member:iris" })).ok, true);
  /* two live legs, no case citation: sever offered to iris (both counted) and to nell (QL alone), reinstate to neither */
  assert.deepEqual(await at(D, "iris"), [{ live: 2, severed: 0 }, { confirmed: 0, severed: 0 }, true, false]);
  assert.deepEqual(await at(D, "nell"), [{ live: 1, severed: 0 }, { confirmed: 0, severed: 0 }, true, false]);
  /* R16: counts only; no question is named */
  const named = JSON.stringify({ ...(await facts(D, { viewer: "member:iris", identity: "member:iris", by: "iris" })), target: null });
  for (const q of [QL, QH]) assert.ok(!named.includes(q), q);
  /* nell severs QL's leg, as offered: accepted */
  assert.equal(await act("nell", "sever", QL, D, "no longer relied on"), "ok");
  /* control: with the leg severed, nell is offered reinstate and not sever, and a further sever is refused */
  assert.deepEqual(await at(D, "nell"), [{ live: 0, severed: 1 }, { confirmed: 0, severed: 0 }, false, true]);
  assert.notEqual(await act("nell", "sever", QL, D, "again"), "ok");
  /* iris still sees QH's live leg: both offered */
  assert.deepEqual(await at(D, "iris"), [{ live: 1, severed: 1 }, { confirmed: 0, severed: 0 }, true, true]);
  assert.equal(await act("nell", "reinstate", QL, D, "relied on again"), "ok");
  assert.deepEqual(await at(D, "nell"), [{ live: 1, severed: 0 }, { confirmed: 0, severed: 0 }, true, false]);
  /* control: a leg only a question nell may not see holds offers her neither and is not counted; iris is offered sever */
  assert.deepEqual(await at(DH, "nell"), [{ live: 0, severed: 0 }, { confirmed: 0, severed: 0 }, false, false]);
  assert.deepEqual(await at(DH, "iris"), [{ live: 1, severed: 0 }, { confirmed: 0, severed: 0 }, true, false]);
  assert.notEqual(await act("nell", "sever", QH2, DH, "unseen"), "ok");
  assert.equal(await act("iris", "sever", QH2, DH, "no longer relied on"), "ok");
  assert.deepEqual(await at(DH, "iris"), [{ live: 0, severed: 1 }, { confirmed: 0, severed: 0 }, false, true]);
  assert.deepEqual(await at(DH, "nell"), [{ live: 0, severed: 0 }, { confirmed: 0, severed: 0 }, false, false]);
});

/* ============================================================ R17, R21: op=affordances */
test("R17 R37: with no target, the catalogue — each act decorated with appliesTo, the vocabularies, the capture acts, "
   + "the set acts with set_key, item_keys, shared_keys and max_items, and the screens and offered wizard scripts", async () => {
  const r = await GET(`op=affordances&token=${W.IRIS}`);
  /* R17's six keys, all present; the control plane's door may add its own decoration beside them (`fences`, `pack`:
     control-plane R41, K585 (1), K730) and nothing else */
  const SIX = ["capture_acts", "catalog", "detail", "set_acts", "target", "vocabularies", "screens", "wizard_scripts" /* R37 */,
    "answer_checks" /* K1601 */, "writing_help_refused" /* R44 */, "act_help" /* R49 */, "dimension_onward" /* R73 */];
  assert.deepEqual(SIX.filter((k) => !Object.hasOwn(r, k)), []);
  assert.deepEqual(Object.keys(r).filter((k) => !SIX.includes(k) && !["fences", "pack"].includes(k)), []);
  assert.equal(r.target, null);
  /* R49: ACT_HELP (R48), every key and text, through the wire */
  assert.deepEqual(r.act_help, { ...ACT_HELP });
  assert.deepEqual(r.catalog.map((a) => a.id), ACTS.map((a) => a.id));
  for (const [i, a] of r.catalog.entries()) {
    const d = decorate(ACTS[i], null);
    assert.deepEqual(a.appliesTo, ACTS[i].types);
    for (const k of ["id", "label", "weight", "rung", "rung_absence", "prompt"]) assert.deepEqual(a[k], d[k], `${a.id}.${k}`);
    assert.ok(["session", "admin-session", "machine"].includes(a.mode));
  }
  assert.deepEqual(r.capture_acts.map((a) => a.id), CAPTURE_ACTS.map((a) => a.id));
  assert.deepEqual(r.set_acts.map((a) => [a.id, a.set_key, a.item_keys, a.shared_keys, a.max_items]),
    PER_ITEM_ACTS.map((a) => [a.id, a.set_key, a.item_keys, a.shared_keys, PER_ITEM_MAX]));
  /* R4 R39: every fixed vocabulary as the module holds it; beside them only R39's, each `{values, words}`, for the owners
     the plane composed (words.mjs; t33.test.mjs holds their content) */
  const fixed = JSON.parse(JSON.stringify(VOCABULARIES));
  assert.deepEqual(Object.fromEntries(Object.keys(fixed).map((k) => [k, r.vocabularies[k]])), fixed);
  const extra = Object.keys(r.vocabularies).filter((k) => !Object.hasOwn(fixed, k));
  /* R67, R68: `proceeding_kinds` (a list) and `action_kind_labels` (a map) are the profiles' own record data, not
     `{values, words}` vocabularies */
  const PROFILE_DATA = { proceeding_kinds: Array.isArray, action_kind_labels: (v) => v && typeof v === "object" && !Array.isArray(v) };
  for (const [k, isShape] of Object.entries(PROFILE_DATA)) if (extra.includes(k)) assert.ok(isShape(r.vocabularies[k]), k);
  const words = extra.filter((k) => !Object.hasOwn(PROFILE_DATA, k));
  assert.deepEqual(words.filter((k) => !R39_KEYS.includes(k)), []);
  for (const k of words) assert.deepEqual(Object.keys(r.vocabularies[k]).sort(), ["values", "words"], k);
  assert.ok(extra.includes("connection_kinds"), "the plane composes connection owners");
  /* R37: the plane registers the bundled screen registry (plane R19); each is a list, and every script offered starts on
     a registered screen */
  assert.ok(Array.isArray(r.screens) && Array.isArray(r.wizard_scripts));
  const ids = new Set(r.screens.map((s) => s.id));
  assert.deepEqual(r.wizard_scripts.filter((s) => !ids.has(s.steps?.[0]?.screen)).map((s) => s.id), []);
  assert.deepEqual(r.wizard_scripts.filter((s) => s.draft === true).map((s) => s.id), []);
  const t = await GET(`op=affordances&token=${W.IRIS}&target=${E(W.INFO)}`);
  assert.ok(!("screens" in t) && !("wizard_scripts" in t), "a targeted answer carries neither");
});

/* skillpack's share (T18 convert): what the doctrine pack reads as the machine/member boundary (INVESTIGATIVE-SESSION
   §4: the AI holds no op that accepts), measured at the published catalogue. */
test("R17: every act the catalogue publishes carries a mode, and none is the machine's — no published catalogue act is "
   + "reachable by a machine credential", async () => {
  const r = await GET(`op=affordances&token=${W.IRIS}`);
  assert.ok(r.catalog.length > 0, "the catalogue is not empty");
  assert.deepEqual(r.catalog.filter((a) => typeof a.mode !== "string" || !a.mode).map((a) => a.id), [], "every act carries a mode");
  assert.deepEqual(r.catalog.filter((a) => a.mode === "machine").map((a) => a.id), []);
  assert.ok(r.catalog.every((a) => ["session", "admin-session"].includes(a.mode)));
});

test("R17: with a target, R13's refusal as given, else the target's type, state, acts (R8–R10 decorated), the "
   + "vocabularies and the capture acts, never filtered by the target", async () => {
  const absent = await call(`op=affordances&token=${W.NELL}&target=PRJ-2026-9999-nowhere`);
  const hidden = await call(`op=affordances&token=${W.NELL}&target=${W.PA}`);
  assert.deepEqual([absent.status, hidden.status], [404, 404]);
  assert.deepEqual([absent.body.reason, hidden.body.reason], ["NO_SUCH_BUNDLE", "NO_SUCH_BUNDLE"]);
  let captureActs = null;
  for (const [tok, who] of [[W.IRIS, "iris"], [W.OLGA, "olga"], [W.PAM, "pam"]])
    for (const id of [W.INFO, W.INFO2, W.INQ, W.INQ2, W.ACTN, W.PA]) {
      const r = await GET(`op=affordances&token=${tok}&target=${E(id)}`);
      if (!r || !r.acts) continue;   // not visible to this caller: R13's answer, above
      assert.deepEqual(Object.keys(r).sort(), ["acts", "capture_acts", "current_state", "object_type", "target", "vocabularies"]);
      const f = await facts(id, { viewer: `member:${who}`, identity: `member:${who}`, author: `member:${who}`, by: who });
      assert.deepEqual([r.target, r.object_type, r.current_state], [f.target, f.object_type, f.current_state]);
      assert.deepEqual(r.acts.map((a) => a.id), deriveActs(f).map((a) => a.id), `${who} on ${id}`);
      for (const a of r.acts) {
        const d = decorate(ACTS.find((x) => x.id === a.id), null);
        assert.deepEqual(Object.keys(a).sort(), Object.keys(d).sort());
        for (const k of ["label", "weight", "rung", "rung_absence", "prompt"]) assert.deepEqual(a[k], d[k]);
      }
      captureActs ??= r.capture_acts;
      assert.deepEqual(r.capture_acts, captureActs);
      assert.deepEqual(r.capture_acts.map((a) => a.id), CAPTURE_ACTS.map((a) => a.id));
    }
});

/* R26 (N231, K768): the kinds are asked of the instance's `actions` at the call (its R42, through action-grammar's
   `actionKinds`), so a profile an administrator makes active (`op=profilesset`) adds its kinds to the next answer, and
   clearing the profiles takes them away. The profile is chosen from the held, non-test profiles as the one whose view
   adds kinds, never named here (R25). */
test("R26: op=affordances publishes as vocabularies.action_kind the kinds this instance's actions accepts at the moment "
   + "of the call — the product's alone with no profile active, the active profile's added once it is made active — "
   + "and risk_tiers is action-grammar's", async () => {
  const vocab = async (q = "") => (await GET(`op=affordances&token=${W.IRIS}${q}`)).vocabularies;
  const setProfiles = async (profiles) => must(`profilesset ${JSON.stringify(profiles)}`,
    await POST(`op=profilesset&token=${W.FOUNDER}`, { profiles }));
  const adds = listProfiles().filter((p) => !p.test)
    .map((p) => [p.id, actionGrammar.actionKinds(combineProfiles([p.id]).view)])
    .filter(([, kinds]) => kinds.length > actionGrammar.PRODUCT_KINDS.length);
  assert.ok(adds.length > 0, "a held profile adds kinds, so the instrument sees the call");
  const [id, kinds] = adds[0];
  await setProfiles([]);
  for (const q of ["", `&target=${E(W.ACTN)}`]) {
    const v = await vocab(q);
    assert.deepEqual(v.action_kind, [...actionGrammar.PRODUCT_KINDS], `none active${q}`);
    assert.deepEqual(v.risk_tiers, JSON.parse(JSON.stringify(actionGrammar.RISK_TIERS)));
  }
  await setProfiles([id]);
  for (const q of ["", `&target=${E(W.ACTN)}`]) assert.deepEqual((await vocab(q)).action_kind, kinds, `active${q}`);
  await setProfiles([]);
  assert.deepEqual((await vocab()).action_kind, [...actionGrammar.PRODUCT_KINDS], "cleared");
});

test("R21: every label, prompt, ground and vocabulary op=affordances hands a surface is this module's own value", async () => {
  const r = await GET(`op=affordances&token=${W.IRIS}`);
  for (const a of [...r.catalog, ...r.capture_acts, ...r.set_acts]) {
    const src = [...ACTS, ...CAPTURE_ACTS, ...PER_ITEM_ACTS].find((x) => x.id === a.id);
    assert.equal(a.label, src.label); assert.equal(a.prompt, src.prompt ?? null);
    if (a.rung_absence !== null) assert.ok(Object.hasOwn(r.vocabularies.rung_absence_grounds, a.rung_absence));
  }
  assert.deepEqual(r.vocabularies.rung_absence_grounds, VOCABULARIES.rung_absence_grounds);
  assert.equal(r.vocabularies.rung_correction_key, VOCABULARIES.rung_correction_key);
});

/* ============================================================ R18: the roster agreement */
test("R18: each roster act is offered exactly where its act accepts the caller (the release precedent: refused only "
   + "by a parameter), for every caller and project in the fixture — projectleave is driven by the test below", async () => {
  const CALLERS = [["iris", W.IRIS], ["pam", W.PAM], ["olga", W.OLGA], ["zed", W.ZED], ["ruth", W.RUTH],
    ["founder", W.FOUNDER], ["nell", W.NELL], ["ADM", ADM]];
  const PROJECTS = ["PA", "PB", "PC", "PR"];
  const NOBODY = "__no_such_handle_aff__";
  const PARAM_ONLY = new Set(["NO_SUCH_HANDLE", "VOTES_SHORT"]);
  const probe = {
    projectinvite: (tok, p) => POST(`op=projectinvite&token=${tok}&projectId=${p}&handle=${NOBODY}`),
    projectremove: (tok, p) => POST(`op=projectremove&token=${tok}&projectId=${p}&handle=${NOBODY}`),
    projectowneradd: (tok, p) => POST(`op=projectowneradd&token=${tok}&projectId=${p}&handle=${NOBODY}`),
    projectownerrescue: (tok, p) => POST(`op=projectownerrescue&token=${tok}&projectId=${p}&handle=${NOBODY}&reason=${E("stranded")}`),
    projectownerremove: (tok, p, who) => POST(`op=projectownerremove&token=${tok}&projectId=${p}&handle=${E(who)}&reason=${E("probe")}`),
  };
  const offer = new Map();
  for (const [, tok] of CALLERS) for (const p of PROJECTS) offer.set(`${tok}|${p}`, await offered(tok, W[p]));
  const bad = [], seen = {};
  for (const act of Object.keys(probe))
    for (const [who, tok] of CALLERS) for (const p of PROJECTS) {
      const reason = codeOf(await probe[act](tok, W[p], who));
      const accepted = PARAM_ONLY.has(reason);
      const off = offer.get(`${tok}|${p}`).includes(act);
      (seen[act] ??= new Set()).add(off);
      if (off !== accepted) bad.push(`${act} ${who}@${p}: offered ${off}, ${reason}`);
    }
  assert.deepEqual(bad, []);
  assert.deepEqual(Object.keys(seen).filter((a) => seen[a].size !== 2), [], "each act offered somewhere and withheld somewhere");
});

/* d311-roster-affordances' share (T18 convert): join and leave, offer against act, for every caller and project in the
   fixture. Offers and roster states are read first; leave is performed before join, and a leave that landed on a caller
   joined when the offers were read is withdrawn at once by that caller's own join, so every later probe answers on the
   roster the offers saw (membership R35 makes one owner's leave move another's answer, N45). A join by a caller already
   joined succeeds and changes nothing, so it is not an act the caller can take (REC-186): accepted means the act
   answered ok and the caller was not joined. Machines are offered and accepted neither. */
test("R18 R9 R10: projectjoin and projectleave are each offered exactly where the act accepts the caller, for every "
   + "caller and project — join to a participant not yet joined, leave to the joined (an owner only while another owner "
   + "is committed) — and a machine is offered and accepted neither", async () => {
  const CALLERS = [["iris", W.IRIS], ["pam", W.PAM], ["olga", W.OLGA], ["zed", W.ZED], ["ruth", W.RUTH],
    ["founder", W.FOUNDER], ["nell", W.NELL], ["ADM", ADM]];
  const PROJECTS = ["PA", "PB", "PC", "PR"];
  const states = async () => {
    const m = new Map();
    /* D54: an administrator neither invited nor joined reads no hidden project's roster, so each is read as its owner */
    const OWNER = { PA: "iris", PB: "pam", PC: "iris", PR: "vera" };
    for (const p of PROJECTS)
      for (const row of must(`participants of ${p}`, await DO(`projectparticipants?projectId=${W[p]}&by=${OWNER[p]}`, {})).participants)
        m.set(`${row.handle}|${p}`, row.state);
    return m;
  };
  const offer = new Map();
  for (const [, tok] of CALLERS) for (const p of PROJECTS) offer.set(`${tok}|${p}`, await offered(tok, W[p]));
  const stateAt = await states();
  const rows = [], withdrawn = [];
  for (const act of ["projectleave", "projectjoin"])
    for (const [who, tok] of CALLERS) for (const p of PROJECTS) {
      const code = codeOf(await POST(`op=${act}&token=${tok}&projectId=${W[p]}`));
      const was = stateAt.get(`${who}|${p}`);
      if (act === "projectleave" && code === "ok" && was === "joined")
        withdrawn.push(codeOf(await POST(`op=projectjoin&token=${tok}&projectId=${W[p]}`)));
      if (act === "projectleave" && who === "ADM" && p === "PR") {
        const after = await states();
        assert.ok(withdrawn.length > 0 && withdrawn.every((c) => c === "ok"), `withdrawals: ${withdrawn}`);
        assert.deepEqual([...stateAt].filter(([k, v]) => after.get(k) !== v), [], "the leave pass leaves the offer-time roster");
      }
      const accepted = code === "ok" && !(act === "projectjoin" && was === "joined");
      rows.push({ act, who, p, offered: offer.get(`${tok}|${p}`).includes(act), accepted, code });
    }
  assert.deepEqual(rows.filter((r) => r.offered !== r.accepted).map((r) => `${r.act} ${r.who}@${r.p}: offered ${r.offered}, ${r.code}`), []);
  for (const act of ["projectleave", "projectjoin"]) {
    const mine = rows.filter((r) => r.act === act);
    assert.ok(mine.some((r) => r.offered) && mine.some((r) => !r.offered), `${act} offered somewhere and withheld somewhere`);
  }
  assert.deepEqual(rows.filter((r) => r.who === "ADM" && (r.offered || r.accepted)).map((r) => `${r.act}@${r.p}`), []);
  /* the positions, as measured: join for the invitee and the leaving, not the joined; leave for the joined, not the
     only owner (iris@PA, refused LAST_COMMITTED_OWNER) */
  const at = (act, who, p) => rows.find((r) => r.act === act && r.who === who && r.p === p);
  assert.deepEqual([at("projectjoin", "olga", "PA").offered, at("projectjoin", "zed", "PA").offered,
                    at("projectjoin", "pam", "PA").offered, at("projectleave", "pam", "PA").offered,
                    at("projectleave", "iris", "PA").offered, at("projectleave", "iris", "PA").code,
                    at("projectleave", "olga", "PA").offered],
    [true, true, false, true, false, "LAST_COMMITTED_OWNER", false]);
});

test("R18: projectleave is offered to an owner only while another owner is committed (not leaving), which is when "
   + "membership R35 accepts it, and owner-remove stays offered where membership R40 accepts it (N45)", async () => {
  W.PD = await W.project("Affordances project PD");
  must("iris owns PD", await W.own("PD", "iris"));
  for (const [h, tok] of [["pam", W.PAM], ["zed", W.ZED]]) {
    must(`invite ${h} to PD`, await W.invite("PD", h, "iris"));
    must(`${h} joins PD`, await POST(`op=projectjoin&token=${tok}&projectId=${W.PD}`));
  }
  must("pam second owner of PD", await POST(`op=projectowneradd&token=${W.IRIS}&projectId=${W.PD}&handle=pam`));
  const leaveOffered = async (tok) => (await offered(tok, W.PD)).includes("projectleave");
  const leave = async (tok) => codeOf(await POST(`op=projectleave&token=${tok}&projectId=${W.PD}`));
  /* two committed owners and a joined participant: each is offered leave */
  assert.deepEqual([await leaveOffered(W.IRIS), await leaveOffered(W.PAM), await leaveOffered(W.ZED)], [true, true, true]);
  const before = await facts(W.PD, { viewer: "member:pam", identity: "member:pam", by: "pam" });
  assert.deepEqual([before.roster.owner_floor_clear, before.roster.other_owner_committed], [true, true]);
  assert.equal(await leave(W.IRIS), "ok");
  /* the two roster facts R9 names (K309): the floor is clear for owner-remove (two owners, one committed); leave's
     other committed owner is iris for pam before iris leaves, and nobody after */
  const roster = async (by) => (await facts(W.PD, { viewer: `member:${by}`, identity: `member:${by}`, by })).roster;
  assert.deepEqual([(await roster("pam")).owner_floor_clear, (await roster("pam")).other_owner_committed], [true, false]);
  /* iris is leaving, so pam is the last committed owner: neither offered nor accepted */
  assert.equal(await leaveOffered(W.PAM), false);
  assert.equal(await leave(W.PAM), "LAST_COMMITTED_OWNER");
  /* iris, leaving, is not joined: neither offered nor accepted; zed, no owner, still is */
  assert.equal(await leaveOffered(W.IRIS), false);
  assert.equal(await leave(W.IRIS), "NOT_JOINED");
  assert.equal(await leaveOffered(W.ZED), true);
  /* owner-remove stays offered to pam, and removing the leaving owner is accepted (at two owners a vote short, a
     parameter's answer), never LAST_OWNER or LAST_COMMITTED_OWNER */
  assert.ok((await offered(W.PAM, W.PD)).includes("projectownerremove"));
  const rm = codeOf(await POST(`op=projectownerremove&token=${W.PAM}&projectId=${W.PD}&handle=iris&reason=${E("asked to leave")}`));
  assert.ok(["ok", "VOTES_SHORT"].includes(rm), rm);
  assert.equal(await leave(W.ZED), "ok");
});

/* ============================================================ R19: the rung backing */
test("R19: every `reasoned` op this fixture can reach, called well-formed but without its authored reason, is refused "
   + "with a code in JUSTIFICATION_REFUSALS", async () => {
  const INQ = W.INQ, ACTN = W.ACTN;
  const DRIVE = {
    release: async () => GET(`op=release&token=${W.IRIS}&handle=${await W.sel(W.IRIS, [W.INFO])}&mitigation=m`),
    dispose: async () => GET(`op=dispose&token=${W.IRIS}&handle=${await W.sel(W.IRIS, [INQ])}&to=deferred`),
    sever: async () => GET(`op=sever&token=${W.IRIS}&project=${W.PA}&handle=${await W.sel(W.IRIS, [W.INFO])}`),
    reinstate: async () => GET(`op=reinstate&token=${W.IRIS}&project=${W.PA}&handle=${await W.sel(W.IRIS, [W.INFO2])}`),
    conclude: () => GET(`op=conclude&token=${W.IRIS}&target=${E(INQ)}&falsifier=f`),
    reopen: () => GET(`op=reopen&token=${W.IRIS}&target=${E(INQ)}`),
    inquirydivide: () => POST(`op=inquirydivide&token=${W.IRIS}&target=${E(W.INQ2)}`,
      { children: [{ title: "a", legs: [W.INQ] }, { title: "b", legs: [W.INQ] }] }),
    /* a RESTRUCTURE: the first grouping is made (accepted without a reason: the todo below), then replaced */
    inquiryground: async () => {
      must("first grouping", await POST(`op=inquiryground&token=${W.IRIS}&target=${E(INQ)}`, { grounds: [{ ground: "g1", legs: [0] }] }));
      return POST(`op=inquiryground&token=${W.IRIS}&target=${E(INQ)}`, { grounds: [{ ground: "g2", legs: [0] }] });
    },
    actionmove: () => GET(`op=actionmove&token=${W.IRIS}&target=${E(ACTN)}&to=active`),
    versionreject: () => GET(`op=versionreject&token=${W.IRIS}&target=${E(INQ)}&version=v1`),
    versionconsider: () => GET(`op=versionconsider&token=${W.IRIS}&target=${E(INQ)}&version=v1`),
    withdrawconclusion: () => GET(`op=withdrawconclusion&token=${W.IRIS}&target=${E(INQ)}&project=${W.PA}`),
    projectownerremove: () => POST(`op=projectownerremove&token=${W.IRIS}&projectId=${W.PC}&handle=pam`),
    projectownerrescue: () => POST(`op=projectownerrescue&token=${W.RUTH}&projectId=${W.PR}&handle=ruth`),
    /* adminremove (K3152): a password-again act since op-declarations R58, whose gate the plane does not yet route to its
       store; its reason refusal is driven at membership's interface in backing.test.mjs */
    connectionassert: () => POST(`op=connectionassert&token=${W.IRIS}`, { a: W.INFO, b: W.INFO2 }),
    filemembershipjudge: () => POST(`op=filemembershipjudge&token=${W.IRIS}`, { id: 1, verdict: "confirm" }),
  };
  const got = {};
  for (const [op, f] of Object.entries(DRIVE)) got[op] = codeOf(await f());
  const off = Object.entries(got).filter(([, c]) => !JUSTIFICATION_REFUSALS.includes(c));
  assert.deepEqual(off, []);
  assert.deepEqual(Object.keys(DRIVE).filter((op) => RUNGS[op] !== "reasoned" && op !== "release"), []);
});

test("R19: the reasoned registry, progression and theme acts, and intent's three (at the durable object's route map, "
   + "the plane's), refuse without the authored account", async () => {
  const theme = await POST(`op=themedeclare&token=${W.IRIS}`, { name: "Transfers", test: "the document concerns a transfer" });
  must("themedeclare", theme);
  const themeId = theme.theme?.id ?? theme.theme_id ?? theme.id ?? theme.theme;
  must("themeplace", await POST(`op=themeplace&token=${W.IRIS}`, { theme: themeId, target: W.INFO, note: "it concerns one" }));
  const iris = "member:iris";
  const goal = must("goaldeclare", await DO(`goaldeclare?viewer=${E(iris)}`, { statement: "A goal", bounds: "This year", author: iris }));
  const asp = must("aspirationdeclare", await DO(`aspirationdeclare?viewer=admin`,
    { scope: "group", statement: "An aspiration of the team", author: "member:ruth" }));
  const goalId = goal.goal ?? goal.id, aspId = asp.aspiration ?? asp.id;
  const DRIVE = {
    relationdeclare: () => POST(`op=relationdeclare&token=${W.IRIS}`, { fromEntity: "ENT-a", toEntity: "ENT-b", relation: "proxy_for", citation: "c" }),
    aliaswithdraw: () => POST(`op=aliaswithdraw&token=${W.IRIS}`, { entityId: "ENT-a", alias: "A" }),
    relationwithdraw: () => POST(`op=relationwithdraw&token=${W.IRIS}`, { relationId: "REL-1" }),
    discharge: () => POST(`op=discharge&token=${W.IRIS}`, { progressionKey: "p", entityId: "ENT-a", stageKey: "s", captureSha: sha("x"), citation: "c" }),
    proposedispose: () => POST(`op=proposedispose&token=${W.IRIS}`, { progressionKey: "p", stageKey: "s", to: "deferred" }),
    themewithdraw: () => POST(`op=themewithdraw&token=${W.IRIS}`, { theme: themeId, target: W.INFO }),
    goalclose: () => DO(`goalclose?viewer=${E(iris)}`, { goal: goalId, author: iris }),
    aspirationdepart: () => DO(`aspirationdepart?viewer=${E(iris)}`, { project: W.PA, aspiration: aspId, author: iris }),
    aspirationretire: () => DO(`aspirationretire?viewer=admin`, { aspiration: aspId, author: "member:ruth" }),
    biasdebtresolve: () => POST(`op=biasdebtresolve&token=${W.IRIS}`, { run: "RUN-aff-1" }),
    actionrisktier: () => POST(`op=actionrisktier&token=${W.IRIS}&target=${E(W.ACTN)}`, { tier: 2 }),
    reevaluationrecord: () => POST(`op=reevaluationrecord&token=${W.IRIS}`, { dependent: W.INQ2, target: W.INQ }),
  };
  const got = {};
  for (const [op, f] of Object.entries(DRIVE)) got[op] = codeOf(await f());
  assert.deepEqual(Object.entries(got).filter(([, c]) => !JUSTIFICATION_REFUSALS.includes(c)), []);
});

test("R19: together the two drives reach every op RUNGS grades `reasoned`", () => {
  const driven = ["updateskip" /* instance-setup R88–R90: UPDATE_SKIP_NO_REASON, driven in its own tests (it is never imported here, K3178) */,
    "stepsource", "stepsourcewithdraw" /* t48-backing.test.mjs */, "release", "dispose", "sever", "reinstate", "conclude", "reopen", "inquirydivide", "inquiryground",
    "actionmove", "versionreject", "versionconsider", "withdrawconclusion", "projectownerremove", "projectownerrescue",
    "adminremove" /* backing.test.mjs, K3152 */, "connectionassert", "filemembershipjudge", "relationdeclare", "aliaswithdraw", "relationwithdraw",
    "discharge", "proposedispose", "themewithdraw", "goalclose", "aspirationdepart", "aspirationretire",
    "biasdebtresolve", "actionrisktier", "reevaluationrecord", "narrow", "triage" /* narrow, triage: backing.test.mjs */,
    /* layer 9's six (K264), at their own modules' interfaces: backing.test.mjs */
    "consequencerevise", "addressedrecord", "escalationevaluate", "escalationadvance", "escalationdecline", "escalationsuspend",
    "determine" /* N310: conformance's interface, backing.test.mjs */,
    /* N345: at contradiction's and entities' interfaces over contradiction's fixture, contradiction.test.mjs */
    "contradictiondismiss", "contradictionclarify", "contradictiontakeup", "contradictionresolve", "contradictionflag", "resolutiondefect",
    /* N364: at sources' interface over its fixture, sources.test.mjs */
    "sourcedisclose", "sourcelink", "sourceconsent",
    /* K727: at action-plans' interface over its fixture, backing.test.mjs */
    "plansubjectadd", "plansubjectremove", "optionrevise", "optiondispose", "planclose",
    /* K918: at action-holds' interface over its fixture (T45), backing.test.mjs */
    "actionhold",
    /* R30: at filing-templates' and local-facts' interfaces over their fixtures, backing.test.mjs */
    "templateretire", "factconfirm",
    /* DEC-88 (K1038) and T22's four (K1019, K1023): at each owner's interface over its fixture, backing.test.mjs —
       the 26 that ask a reason or take their own words, K1025's four by their grounds, and the four new acts */
    "testify", "transcribe", "transcriptionattest", "attesttext", "lead", "leadlook", "leadshare", "entitycreate",
    "resolvetestify", "progressiondefine", "biasadopt", "strengthbar", "versionadopt", "goaldeclare", "aspirationdeclare",
    "aspirationdeadend", "objectivecondition", "workobjective", "attribute", "statementack", "standarddeclare",
    "standardadopt", "counselpacket", "escalationopen", "escalationattach", "inboxresolve",
    "resolve", "actioncorrespond", "filingsent", "consequencerecord",
    "declinetoescalate", "heldsetaside", "heldrestore", "addressfrequencyset",
    /* R34: at docket's interface over its fixture, backing.test.mjs */
    "docketfile", "docketdecline",
    /* R35: at case-import's interface over its fixture, backing.test.mjs */
    "importaccept", "importacceptwithdraw", "importflag", "importflagclear",
    /* R37: at wizard-scripts' interface over its fixture, t31.test.mjs */
    "wizardretire",
    /* R40 (T33-85): T33's, each at its owner's interface over its fixture, t33-backing.test.mjs */
    ...Object.keys(T33_RUNGS).filter((op) => T33_RUNGS[op] === "reasoned"),
    /* K2049 (B4): op-grades' T35 ops (its R22), each at its owner's interface over its fixture, t35-backing.test.mjs */
    ...Object.keys(T35_RUNGS).filter((op) => T35_RUNGS[op] === "reasoned"),
    /* K2121, K2156: op-grades' T36 ops (its R23–R25), each at its owner's interface over its fixture, t36-backing.test.mjs */
    ...Object.keys(T36_RUNGS).filter((op) => T36_RUNGS[op] === "reasoned"),
    /* K2322: op-grades' T38 op (its R28), at case-carriage's interface over its fixture, t38-backing.test.mjs */
    ...Object.keys(T38_RUNGS).filter((op) => T38_RUNGS[op] === "reasoned"),
    /* op-grades R30 (T41): T41's eight, each at its owner's interface over its fixture, t41-backing.test.mjs */
    ...Object.keys(T41_RUNGS).filter((op) => T41_RUNGS[op] === "reasoned"),
    /* op-grades R32 (T45): T45's eleven, each at its owner's interface over its fixture, t45-backing.test.mjs */
    ...Object.keys(T45_RUNGS).filter((op) => T45_RUNGS[op] === "reasoned"),
    /* op-grades R33 (T46): escalation's stop and reopening, at escalation's interface over its fixture, t46-backing.test.mjs */
    ...Object.keys(T46_RUNGS).filter((op) => T46_RUNGS[op] === "reasoned"),
    /* op-grades R36 (T47; K3147): strength's projectbarset, at strength's interface, t47-backing.test.mjs */
    ...Object.keys(T47_RUNGS).filter((op) => T47_RUNGS[op] === "reasoned")];
  /* R45: an alias is its op's handler (op-declarations R21, control-plane R55), so its op's drive is its backing */
  driven.push(...Object.keys(OP_ALIASES).filter((a) => driven.includes(OP_ALIASES[a])));
  /* R45: tasks' checkrecord (CHECK_NO_REASON, tasks R15): tasks is later in the order (P4), so this module's tests cannot
     drive it; its refusal is tasks' own R15 test, and the code's place in the family is held in t34.test.mjs */
  const awaitingOwner = ["checkrecord"];
  assert.deepEqual(Object.keys(RUNGS).filter((op) => RUNGS[op] === "reasoned" && !driven.includes(op)), awaitingOwner);
});

test("R19: inquiryground is `reasoned` where it revises what stands — a FIRST grouping replaces nothing and asks no "
   + "reason; a restructure without one is refused with a code in JUSTIFICATION_REFUSALS (K212)", async () => {
  const q = W.INQ2;
  const first = await POST(`op=inquiryground&token=${W.IRIS}&target=${E(q)}`, { grounds: [{ ground: "g1", legs: [0] }] });
  assert.equal(codeOf(first), "ok");
  const again = await POST(`op=inquiryground&token=${W.IRIS}&target=${E(q)}`, { grounds: [{ ground: "g2", legs: [0] }] });
  assert.ok(JUSTIFICATION_REFUSALS.includes(codeOf(again)), codeOf(again));
  const withWhy = await POST(`op=inquiryground&token=${W.IRIS}&target=${E(q)}`,
    { grounds: [{ ground: "g2", legs: [0] }], reason: "the second group says it better" });
  assert.equal(codeOf(withWhy), "ok");
  assert.equal(RUNGS.inquiryground, "reasoned");
});

/* ============================================================ R20: the machine map */
test("R20: MACHINE_REFUSALS equals, both ways, the acts whose method answers a machine credential with a MACHINE_* "
   + "code, and each code is that answer; a machine is offered none of them", async () => {
  /* the machine is the instance's administrator credential (`token:admin`, a machine identity): the shared member
     credential this drove before is retired (admission R5, K2166; its answer is pinned below), and an ai credential
     cannot be minted through the door until control-plane T37-33 hands its digest in the body (credentials R53) */
  const sel = (ids) => W.sel(ADM, ids);
  const INQ = W.INQ, INFO = W.INFO, ACTN = W.ACTN, PA = W.PA;
  const DRIVE = {
    release: async () => GET(`op=release&token=${ADM}&handle=${await sel([INFO])}&acknowledgment=a&mitigation=m`),
    retire: async () => GET(`op=retire&token=${ADM}&handle=${await sel([W.INFO2])}&reason=r`),
    dispose: async () => GET(`op=dispose&token=${ADM}&handle=${await sel([W.INQ2])}&to=deferred&reason=r`),
    conclude: () => GET(`op=conclude&token=${ADM}&target=${E(INQ)}&conclusion=c&falsifier=f`),
    withdrawconclusion: () => GET(`op=withdrawconclusion&token=${ADM}&target=${E(INQ)}&project=${PA}&reason=r`),
    reopen: () => GET(`op=reopen&token=${ADM}&target=${E(INQ)}&reason=r`),
    publish: () => POST(`op=publish&token=${ADM}`, { target: INQ, project: PA, roles: { [INQ]: "load_bearing" } }),
    inquirydivide: () => POST(`op=inquirydivide&token=${ADM}&target=${E(INQ)}&reason=r`, { children: [] }),
    inquiryground: () => POST(`op=inquiryground&token=${ADM}&target=${E(INQ)}&reason=r`, { grounds: [] }),
    actionmove: () => GET(`op=actionmove&token=${ADM}&target=${E(ACTN)}&to=active&reason=r`),
    actioncorrespond: () => GET(`op=actioncorrespond&token=${ADM}&target=${E(ACTN)}&direction=sent&at=2026-07-01&account=x`),
    actionlaws: () => POST(`op=actionlaws&token=${ADM}&target=${E(ACTN)}`, { laws: [{ level: "state", citation: "a statute" }] }),
    actionrisktier: () => POST(`op=actionrisktier&token=${ADM}&target=${E(ACTN)}`, { tier: 3, reason: "a machine's view" }),
    versionaccept: () => GET(`op=versionaccept&token=${ADM}&target=${E(INQ)}&version=v1&reason=r`),
    versionreject: () => GET(`op=versionreject&token=${ADM}&target=${E(INQ)}&version=v1&reason=r`),
    versionconsider: () => GET(`op=versionconsider&token=${ADM}&target=${E(INQ)}&version=v1&reason=r`),
    versionrevert: () => GET(`op=versionrevert&token=${ADM}&target=${E(INQ)}&version=v1&reason=r`),
    versioncurrent: () => GET(`op=versioncurrent&token=${ADM}&target=${E(INQ)}&version=v1&project=${PA}&reason=r`),
    versionhide: () => GET(`op=versionhide&token=${ADM}&target=${E(INQ)}&version=v1&reason=r`),
    cite: async () => GET(`op=cite&token=${ADM}&project=${PA}&handle=${await sel([INFO])}&note=basis`),
    sever: async () => GET(`op=sever&token=${ADM}&project=${PA}&handle=${await sel([INFO])}&reason=r`),
    reinstate: async () => GET(`op=reinstate&token=${ADM}&project=${PA}&handle=${await sel([INFO])}&reason=r`),
    projectvisibilityset: () => POST(`op=projectvisibilityset&token=${ADM}&projectId=${PA}&setting=discoverable`),
    /* N345: contradiction's route in the durable object (the control plane routes it at layer 11), with the author
       stamp a machine credential's call carries */
    contradictionresolve: () => DO(`contradictionresolve?viewer=admin&author=${E("token:member")}`,
      { inquiry: INQ, resolution: { kind: "irreconcilable" }, conclusion: "c" }),
    /* R51 (T45): the acts an action offers, each with what a member would send; the machine's answer is each method's */
    escalationopen: () => POST(`op=escalationopen&token=${ADM}`, { determination: "CONF-2026-0001-x", reason: "r" }),
    escalationattach: () => POST(`op=escalationattach&token=${ADM}`, { id: "ESC-2026-0001-x", action: ACTN, reason: "r" }),
    filingprepare: () => POST(`op=filingprepare&token=${ADM}`, { action: ACTN, text: "t" }),
    communicationprepare: () => POST(`op=communicationprepare&token=${ADM}`, { action: ACTN, text: "t", purpose: "inform" }),
    filingapprove: () => POST(`op=filingapprove&token=${ADM}`, { filing: "FIL-2026-0001", text: "t" }),
    filingsent: () => POST(`op=filingsent&token=${ADM}`, { filing: "FIL-2026-0001", at: "2026-09-02", account: "a" }),
    counselpacket: () => POST(`op=counselpacket&token=${ADM}`, { action: ACTN, reason: "r" }),
    reminderset: () => POST(`op=reminderset&token=${ADM}&target=${E(ACTN)}`, { entry: 0 }),
    /* R52 (T46): escalation's stop and reopening, on its route in the durable object (the control plane routes them at
       T46-59), with a machine credential's author stamp; and clockadopt on its route there too */
    escalationstoppursuing: () => DO(`escalationstoppursuing?viewer=admin&author=${E("token:member")}`,
      { id: "ESC-2026-0001-x", reason: "r" }),
    escalationreopen: () => DO(`escalationreopen?viewer=admin&author=${E("token:member")}`, { id: "ESC-2026-0001-x", reason: "r" }),
    clockadopt: () => DO(`clockadopt?viewer=admin&author=${E("token:member")}`, { target: ACTN, proposal: "deadline@member:iris" }),
  };
  const ROSTER = ["projectinvite", "projectjoin", "projectleave", "projectremove", "projectowneradd",
    "projectownerremove", "projectownerrescue"];
  /* N364, R51: sources', action-replies', plan-work's, action-holds', action-records', filings' and action-clocks' acts
     are composed by the plane at T45-47 or routed at their owners; their machine answers are driven at their owners'
     interfaces (sources.test.mjs, t45.test.mjs). The set is read off those owners' own op maps: an act of this module
     that one of them serves and this table does not drive */
  const ownerUrl = new URL("http://x/");
  const ownersOf = [sourcesOps, actionRepliesOps, planWorkOps, actionHoldsOps, actionRecordsOps, filingsOps, actionClocksOps]
    .flatMap((ops) => Object.keys(ops({}, ownerUrl, {}, {})));
  const AT_OWNERS = ACTS.map((a) => a.id).filter((k) => ownersOf.includes(k) && !(k in DRIVE));
  assert.equal(AT_OWNERS.length, 15, "a new act an owner serves, left undriven here, is seen");
  const objectActs = ACTS.map((a) => a.id).filter((k) => !ROSTER.includes(k) && !AT_OWNERS.includes(k));
  assert.deepEqual(objectActs.filter((k) => !(k in DRIVE)), [], "every object-directed act is driven");
  /* the offer side first, before any drive moves an object */
  const leak = [];
  for (const tok of [ADM]) for (const id of [INFO, INQ, ACTN, PA])
    for (const k of await offered(tok, id)) if (k in MACHINE_REFUSALS || ROSTER.includes(k)) leak.push(`${id}:${k}`);
  assert.deepEqual(leak, []);
  /* the over-strictness arm (d311's share): an act the store does not refuse a machine is still offered to it */
  const citeOffered = (await offered(ADM, INFO)).includes("cite");
  const answered = {};
  for (const k of objectActs) answered[k] = codeOf(await DRIVE[k]());
  assert.deepEqual([citeOffered, answered.cite], [true, "ok"], "a machine is offered cite and performs it");
  const refused = Object.fromEntries(Object.entries(answered).filter(([, c]) => /^MACHINE_/.test(String(c))));
  assert.deepEqual(refused, Object.fromEntries(objectActs.filter((k) => k in MACHINE_REFUSALS).map((k) => [k, MACHINE_REFUSALS[k]])));
  assert.ok(Object.keys(refused).length > 0 && objectActs.some((k) => !(k in refused)));
});

/* admission R5 (T36-36, K2166): the shared member credential is retired, refused before any act or read, so it is
   offered nothing and performs nothing; this pins that answer where the suite used to drive it as a machine. */
test("R18 R20: the retired shared member credential is refused MEMBER_TOKEN_RETIRED (admission R5) — op=affordances "
   + "answers it no catalogue and no acts, and an act it asks for is refused before it runs", async () => {
  for (const q of ["op=affordances", `op=affordances&target=${E(W.INFO)}`]) {
    const r = await call(`${q}&token=${MEM}`);
    assert.equal(r.status, 401, q);
    assert.equal(r.body.reason, "MEMBER_TOKEN_RETIRED", q);
    assert.ok(!("result" in r.body), q);
  }
  assert.deepEqual(await offered(MEM, W.INFO), []);
  assert.equal(codeOf(await POST(`op=projectjoin&token=${MEM}&projectId=${W.PA}`)), "MEMBER_TOKEN_RETIRED");
  assert.equal(codeOf(await POST(`op=select&token=${MEM}&kind=enumerated`, { ids: [W.INFO] })), "MEMBER_TOKEN_RETIRED");
});

/* ============================================================ R22: nothing here writes */
test("R22: asking for facts and affordances writes nothing — the store's counts are unchanged by a hundred asks", async () => {
  const stats = async () => JSON.stringify(await DO("stats?viewer=admin"));
  const before = await stats();
  for (let i = 0; i < 10; i++)
    for (const id of [W.INFO, W.INQ, W.ACTN, W.PA, "PRJ-2026-9999-nowhere"]) {
      await facts(id, { identity: "member:iris", author: "member:iris", by: "iris" });
      await GET(`op=affordances&token=${W.IRIS}&target=${E(id)}`);
    }
  assert.equal(await stats(), before);
});

test("R24: no act in any answer carries a null rung without a stated absence", async () => {
  const r = await GET(`op=affordances&token=${W.IRIS}`);
  const all = [...r.catalog, ...r.capture_acts, ...r.set_acts];
  for (const id of [W.INFO, W.INQ, W.ACTN, W.PA]) all.push(...(await GET(`op=affordances&token=${W.IRIS}&target=${E(id)}`)).acts);
  assert.deepEqual(all.filter((a) => a.rung === null && a.rung_absence === null).map((a) => a.id), []);
  assert.ok(all.every((a) => a.rung === null || Object.hasOwn(RUNGS, a.id)));
  assert.ok(all.every((a) => a.rung_absence === null || Object.hasOwn(RUNG_ABSENT, a.id)));
});
