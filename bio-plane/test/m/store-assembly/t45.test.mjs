/* store-assembly's copy of plane's T45 test: T45's composition (R34, R9; K2781 (1), K2815, K2839, K2858, K2874; the plan's reconciliation R19; M-T45-5):
   the five new modules built at their places, migrated and routed; every registration a T45 module makes with an earlier
   one held once before the first request; and `action-holds`' `purgeHeld` the reader the door is handed (hold.test.mjs).
   Each module's own behaviour is its own tests'; these check the composition through the plane's interface:
   construction over a storage, the route map and the object's door. Each test carries a negative control (K874). */
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import "../../../src/store-assembly/register.mjs";   /* R83: the start's registration before any op table is read */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, disclosed } from "./fixture.mjs";
import { MODULE_MAPS } from "./maps.mjs";
import { actionHoldsOf, actionHoldsOps, ACTION_HOLDS_TABLES } from "../../../src/action-holds/index.mjs";
import { actionRepliesOf, actionRepliesOps, ACTION_REPLIES_TABLES } from "../../../src/action-replies/index.mjs";
import { planWorkOf, planWorkOps, PLAN_WORK_TABLES } from "../../../src/plan-work/index.mjs";
import { caseCheckOf, caseCheckOps, CASE_CHECK_TABLES } from "../../../src/case-check/index.mjs";
import { actionsOf } from "../../../src/actions/index.mjs";
import { actionPlansOf } from "../../../src/action-plans/index.mjs";
import { doorbellOf } from "../../../src/doorbell/index.mjs";
import { ratificationOf } from "../../../src/ratification/index.mjs";
import { caseAuthoringOf } from "../../../src/case-authoring/index.mjs";
import { caseInputsOf } from "../../../src/case-inputs/index.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { consequencesModule } from "../../../src/consequences/index.mjs";
import { conformanceOf } from "../../../src/conformance/index.mjs";
import { followingOf, followingOps } from "../../../src/following/index.mjs";
import { filingsOf } from "../../../src/filings/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";

const nameOf = (t) => (typeof t === "string" ? t : t.name);
const NEW_TABLES = Object.freeze({
  "action-holds": ACTION_HOLDS_TABLES.map(nameOf), "action-replies": ACTION_REPLIES_TABLES.map(nameOf),
  "plan-work": PLAN_WORK_TABLES.map(nameOf), "case-check": CASE_CHECK_TABLES.map(nameOf),
});
const tables = (x) => new Set([...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name));
/* Which module declared table `t` to purge (record-core R21): a probe's declaration is refused naming its holder. */
const declaredBy = (ctx, t) => recordOf(ctx).declarePurge("zz-probe", [t]).declaredBy ?? null;

test("R34 (T45; K2781 (1)): a fresh store holds every table action-holds, action-replies, plan-work and case-check declare, each declared to purge under its own module", async () => {
  const x = await store();
  const have = tables(x);
  for (const [mod, list] of Object.entries(NEW_TABLES)) {
    assert.ok(list.length > 0, mod);
    for (const t of list) {
      assert.ok(have.has(t), `${mod}: ${t}`);
      assert.equal(declaredBy(x.ctx, t), mod, `${t} is declared by ${mod}`);
    }
  }
  /* negative control: a name no module declares is declared by none */
  assert.equal(have.has("zz_not_a_table"), false);
});

test("R34, R3: a store written before T45's modules opens with their tables, and a second construction changes nothing", async () => {
  const db = new DatabaseSync(":memory:");
  const first = await store({ db });
  /* the store as an earlier release left it: none of T45's new tables */
  for (const list of Object.values(NEW_TABLES)) for (const t of list) db.exec(`DROP TABLE IF EXISTS ${t}`);
  assert.equal(NEW_TABLES["action-holds"].some((t) => tables(first).has(t)), false, "armed: the tables are gone");
  const migrated = await store({ db });
  for (const list of Object.values(NEW_TABLES)) for (const t of list) assert.ok(tables(migrated).has(t), t);
  const schema = () => [...db.prepare(`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`).all()].map((r) => ({ ...r }));
  const before = schema();
  await store({ db });
  assert.deepEqual(schema(), before, "a second construction changes no table");
});

test("R34 (K2815, reconciliation R19; doorbell R3, ratification R45, case-authoring R70, steps R29, standards R53, consequences R19, plan-work R9, action-plans R44, actions R95): every T45 registration is held once before the first request, by the module that now owns it; a second is refused by its door", async () => {
  const x = await store(), c = x.ctx, f = () => ({});
  const held = (r, by, label) => {
    assert.equal(r.ok, false, `${label}: ${JSON.stringify(r)}`);
    if (by) assert.equal(r.module, by, `${label} is held by ${by}`);
  };
  held(doorbellOf(c).registerReader("litigation-hold", "zz-probe", f), "action-holds", "doorbell's litigation-hold reader");
  assert.equal(ratificationOf(c).registerHoldReader({ holdsOn: f }).reason, "HOLD_READER_DECLARED", "ratification's hold reader");
  /* T47 (N908; case-inputs R8): the open-requests source is case-inputs' since the split, on the one instance
     case-authoring's factory creates */
  held(caseInputsOf(c).registerOpenRequests("zz-probe", { openRequestsOn: f }), "action-replies", "case-inputs' open requests");
  assert.equal(caseAuthoringOf(c).inputs, caseInputsOf(c), "case-authoring's case-inputs is the one the plane routes");
  held(stepsOf(c).registerDueHolder("zz-probe", f), "action-clocks", "steps' due holder");
  held(standardsOf(c).registerOwnSendingCheck("zz-probe", f), "actions", "standards' own-sending check");
  held(consequencesModule(c).registerOwnActReader(f, "zz-probe"), "actions", "consequences' own-act reader");
  held(planWorkOf(c).registerWatchReader("zz-probe", f), "following", "plan-work's watch reader");
  held(actionPlansOf(c).registerCloseSnapshot("zz-probe", f), "plan-work", "action-plans' close snapshot");
  assert.deepEqual(planWorkOf(c).registered, { close_snapshot: { ok: true, module: "plan-work" },
                                               response_listener: { ok: true, module: "plan-work" } });
  assert.deepEqual(followingOf(c).registered, { ok: true, module: "following" });
  held(actionsOf(c).registerResponseListener("plan-work", f), null, "actions' response listener, plan-work's once");
  /* negative control: a response listener of another module is not refused (actions R95 holds one per module) */
  assert.equal(actionsOf(c).registerResponseListener("zz-probe", f).ok, true);
});

test("R34 (K2858, K2874; P8: K1654): the T45 readers are handed the plane's own instances — filings action-holds, the project roster and case-check; following plan-work and action-plans; plan-work action-holds — and conformance, built before actions, holds the seeded offices' read", async () => {
  const x = await store(), c = x.ctx;
  const fil = filingsOf(c);
  assert.equal(fil.actionHolds, actionHoldsOf(c));
  assert.equal(fil.projectRoster, projectRosterOf(c));
  assert.equal(fil.caseCheck, caseCheckOf(c));
  assert.equal(followingOf(c).planWork, planWorkOf(c));
  assert.equal(followingOf(c).actionPlans, actionPlansOf(c));
  assert.equal(planWorkOf(c).actionHolds, actionHoldsOf(c));
  /* K1654: conformance's office port is the plane's (instance-setup R50), answering null until instance-setup does */
  assert.equal(typeof conformanceOf(c).officeEntityOf, "function");
  assert.equal(conformanceOf(c).officeEntityOf({ role: "Clerk", body: "nobody" }), null);
  /* the project roster is migrated at start (K2858): its tables exist before any read */
  for (const t of ["project_scopes", "project_approval_settings"]) assert.ok(tables(x).has(t), t);
  /* negative control: a second store's instances are its own */
  const y = await store();
  assert.notEqual(filingsOf(y.ctx).actionHolds, actionHoldsOf(c));
});

/* Instants and minted ids differ between two objects; everything else must not. */
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

test("R34, R6 (op-declarations R49; K2839): every op of action-holds', action-replies', plan-work's and case-check's maps is in the route map, each map at its place, and an op of each answers through the door what its own map answers called directly", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(u, null));
  const names = MODULE_MAPS.map(([m]) => m);
  for (const [mod, after] of [["action-holds", "actions"], ["action-replies", "action-clocks"], ["plan-work", "action-plans"],
                              ["case-check", "review"]])
    assert.equal(names.indexOf(mod), names.indexOf(after) + 1, `${mod}'s map directly after ${after}'s`);
  const maps = { "action-holds": [actionHoldsOps, actionHoldsOf], "action-replies": [actionRepliesOps, actionRepliesOf],
                 "plan-work": [planWorkOps, planWorkOf], "case-check": [caseCheckOps, caseCheckOf] };
  for (const [mod, [ops]] of Object.entries(maps)) {
    const own = Object.keys(ops({}, u, null));
    assert.ok(own.length > 0, mod);
    for (const op of own) assert.ok(keys.includes(op), `${mod}: the route map lacks ${op}`);
  }
  assert.deepEqual(Object.keys(caseCheckOps({}, u, null)), ["publishcheck", "casecheck"]);
  for (const [mod, path] of [["action-holds", "projectholds?viewer=member:nobody&projects=PROJ-2026-none"],
                             ["action-replies", "actionreplybearing?viewer=member:nobody&author=member:nobody&target=ACT-2026-none"],
                             ["plan-work", "matters?plan=PLAN-2026-none&viewer=member:nobody"],
                             ["case-check", "casecheck?case=CASE-2026-none&viewer=member:nobody"]]) {
    const [ops, of] = maps[mod];
    const res = await x.fetch(`/${path}`, { method: "POST", body: "{}" });
    const op = path.split("?")[0];
    const direct = await ops(of(twin.ctx), new URL(`http://do/${path}`), {})[op]();
    assert.equal(res.status, 200, `${mod} ${op}`);
    assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct }))), `${mod} ${op}`);
  }
  /* K2874: following's new ops (FOLLOWING #5) are in its map and so routed */
  for (const op of ["followend", "watchlink", "watchanswer", "watchquestions"]) {
    assert.ok(Object.keys(followingOps(followingOf(x.ctx), u, null)).includes(op), op);
    assert.ok(keys.includes(op), op);
  }
  /* negative control: an op of no module's map is no route */
  assert.equal(keys.includes("zzprobe"), false);
  assert.equal((await x.fetch("/zzprobe", { method: "POST", body: "{}" })).status === 200, false);
});

/* ===== R50 (K2853): the two doors' deploy gate ===== */
import { createHash } from "node:crypto";
import { deployed, GATE_FLAGS, GATE_SET, GATE_PARTS } from "./fixture.mjs";
import { assistantGateOf, assembleRecords, DRAFT_KIND_OF } from "../../../src/store-assembly/ask.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { AI_RUN_OPEN_CHECKS, partRefusal, deployedModesFor, draftKindDeployed } from "../../../src/run-rules/index.mjs";

const SESSION = "s".repeat(64);
/* ann with her own account and a live session, the assistant's keep-away off, agent-worker recording every post; the
   gate deps (`gate`) handed before construction, the bar recorded for `parts`. */
async function doors({ gate = null, parts = [] } = {}) {
  const asks = [];
  const env = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-t45-test", AGENT_WORKER: { fetch: async (u, init) => {
    asks.push([u, JSON.parse(init.body)]);
    if (u === "https://agent-worker/draft")
      return new Response(JSON.stringify({ ok: true, draft: { text: "t" }, label: { kind: "machine" } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response('{"event":"answer","ok":true}\n', { status: 200, headers: { "content-type": "application/x-ndjson" } }); } } };
  const x = await store({ env, before: gate ? (ctx) => assistantGateOf(ctx, gate) : null });
  if (parts.length) await deployed(x.ctx, parts);
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);   /* R35 (T47): the disclosure first, as the assembled plane asks */
  assert.equal((await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann",
                                                                 by: "member:ann" })).ok, true);
  const grants = () => [...sql.exec(`SELECT count(*) c FROM ai_grants`)][0].c;
  const ask = async () => { const r = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" }); return { status: r.status, r }; };
  const draft = async (a) => { const r = await x.s.draft({ member: "ann", session: SESSION, pack: { layers: [] }, ...a }); return { status: r.status, body: await r.json() }; };
  return { ...x, asks, grants, ask, draft };
}
const ROW = AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED;
const refusedUndeployed = (body, mode, label) => {
  assert.deepEqual([body.ok, body.reason, body.code, body.check, body.translation, body.mode],
                   [false, "AI_RUN_MODE_NOT_DEPLOYED", "AI_RUN_MODE_NOT_DEPLOYED", ROW.check, ROW.translation, mode], label);
};
/* R50 (T46; run-rules R30): a part its flag deploys and `ai-runs.partAdmitted` does not admit, refused as run-rules'
   `partRefusal(part)` answers it, unchanged. */
/* ai-runs R78: the refusal names the entry of the account that serves ann (ai-accounts' accountServing); `ctx` the set and the
   bars it is judged on, for a PART_WITHDRAWN */
const entryOf = (w, use) => aiAccountsOf(w.ctx).accountServing({ member: "member:ann", use }).entry_id;
const refusedPart = (body, part, label, entry = null, ctx = undefined) => {
  const { grant: _g, suggestions: _s, read: _r, ...given } = body;
  assert.deepEqual(given, partRefusal(part, entry, ctx), label);
};
/* R50: the refusal run-rules' own flags give (no flags handed): the flag's when it does not deploy, else the bar's. */
const refusedOwnFlags = (body, mode, kind, label, entry = null) => {
  const flagged = mode === "ask" ? deployedModesFor().includes("ask") : draftKindDeployed({ kind });
  if (flagged) refusedPart(body, mode === "ask" ? "ask" : `draft:${kind}`, label, entry);
  else refusedUndeployed(body, mode, label);
};
const DRAFTS = Object.freeze({ writinghelp: { told: "t", act: "conclude", field: "reason" }, groupdescriptiondraft: { told: [] },
  translationdraft: { direction: "to_language", language: "es", words: [] }, textcheck: { text: "We demand the council act." },
  infractiondraft: { matter: { actions: ["ACTN-2026-0009-none"] }, audience: "members" },
  bearingdraft: { action: "ACTN-2026-0009-none", reply: 1 },
  statusreportdraft: { plan: "PLN-2026-0009-none", items: [{ kind: "action", says: "sent" }] },
  /* R53 (T48): the reading of a passage, its gate before the subject is read */
  readtranslate: { subject: { kind: "note", id: 1 } } });

test("R50 (K2853; run-rules R16, R19, R30; T46; ai-runs R78): the ask door refuses AI_RUN_MODE_NOT_DEPLOYED (403, run-rules' C-109.1 row, mode `ask`) while `ask`'s flag is off, before the keep-away read, any account read or grant; and AI_PART_NOT_DEPLOYED (run-rules' partRefusal naming the serving account's entry, 403) while its flag is on and ai-runs' partAdmitted(\"ask\", entry) does not admit it (no Gate 1 verdict), before any account is read or grant minted, nothing posted; with no account serving (the team keeps its material away) the flag alone admits and AI_KEPT_AWAY answers; deployed and admitted, it is asked", async () => {
  for (const [label, w, check, away] of [
    ["run-rules' own flags, no Gate 1 verdict", await doors({}), (b, l, x) => refusedOwnFlags(b, "ask", null, l, entryOf(x, "ask")), false],
    ["the flag on, no Gate 1 verdict", await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET } }), (b, l, x) => refusedPart(b, "ask", l, entryOf(x, "ask")), false],
    ["the verdict held, the flag off", await doors({ gate: { flags: { ...GATE_FLAGS, ask: false }, testSet: GATE_SET }, parts: GATE_PARTS }),
     (b, l) => refusedUndeployed(b, "ask", l), true]]) {
    /* the flag is asked first, so with the keep-away on its refusal, not AI_KEPT_AWAY, answers */
    if (away) assert.equal(credentialsOf(w.ctx).aiKeepAwaySet({ on: true, reason: "r", by: "ada" }).ok, true);
    const { status, r } = await w.ask();
    assert.equal(status, 403, label);
    check(await r.json(), label, w);
    assert.equal(w.asks.length, 0, `${label}: nothing posted`);
    assert.equal(w.grants(), 0, `${label}: no grant minted`);
  }
  /* no account serves while the team keeps its material away: no entry to judge, so the flag alone admits (ai-runs R40, R78) */
  const kept = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET } });
  assert.equal(credentialsOf(kept.ctx).aiKeepAwaySet({ on: true, reason: "r", by: "ada" }).ok, true);
  const k = await kept.ask();
  assert.deepEqual([k.status, (await k.r.json()).code], [403, "AI_KEPT_AWAY"]);
  assert.equal(kept.asks.length, 0);
  /* control: deployed and admitted on the entry, the same ask is asked */
  const ok = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: ["ask"] });
  assert.equal((await ok.ask()).status, 200);
  assert.equal(ok.asks.length, 1);
});

test("R50 (K2853; run-rules R21, R22, R27, R30, R37; T46; ai-runs R78): the draft door refuses each kind while its flag (draft's for own words, translation and the status report; draft's and action_drafts' for the three action drafts) does not deploy it (AI_RUN_MODE_NOT_DEPLOYED), or ai-runs' partAdmitted(`draft:<kind>`, entry) does not admit it (AI_PART_NOT_DEPLOYED with no Gate 1 verdict for the entry; PART_WITHDRAWN when the standing measure failed that kind on that entry), before anything is read or minted; an op of no kind is refused; admitted, it is posted", async () => {
  assert.deepEqual(Object.keys(DRAFT_KIND_OF).sort(), Object.keys(DRAFTS).sort());
  const plain = await doors({});
  for (const op of Object.keys(DRAFTS)) {
    const r = await plain.draft({ op, ...DRAFTS[op] });
    assert.equal(r.status, 403, op);
    refusedOwnFlags(r.body, "draft", DRAFT_KIND_OF[op], op, entryOf(plain, "draft"));
    assert.deepEqual([r.body.grant, r.body.read], [null, []], op);
  }
  /* `draft` on, `action_drafts` off: own words and translation admitted, the action drafts refused */
  const half = await doors({ gate: { flags: { draft: true, action_drafts: false }, testSet: GATE_SET }, parts: GATE_PARTS });
  for (const op of ["writinghelp", "groupdescriptiondraft", "translationdraft"])
    assert.equal((await half.draft({ op, ...DRAFTS[op] })).status, 200, op);
  for (const op of ["textcheck", "infractiondraft", "bearingdraft"])
    refusedUndeployed((await half.draft({ op, ...DRAFTS[op] })).body, "draft", `${op}: action_drafts off`);
  /* both flags on, Gate 1 passed for drafts on the entry, the standing measure failed for every kind but own words on that
     entry: own words posted, every other kind withdrawn */
  const bar = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: ["draft:own_words"] });
  const entry = entryOf(bar, "draft");
  for (const op of ["translationdraft", "textcheck", "statusreportdraft"])
    assert.equal(aiRunsOf(bar.ctx).testBarRecord({ part: `draft:${DRAFT_KIND_OF[op]}`, set: GATE_SET.id, set_version: GATE_SET.version,
      false_alarm_rate: 0.5, passed: false, graded_by: "harness", at: "2026-10-02T00:00:00Z", entry_id: entry }).ok, true);
  assert.equal((await bar.draft({ op: "writinghelp", ...DRAFTS.writinghelp })).status, 200);
  for (const op of ["translationdraft", "textcheck", "statusreportdraft"]) {
    const body = (await bar.draft({ op, ...DRAFTS[op] })).body;
    assert.equal(body.code, "PART_WITHDRAWN", `${op}: withdrawn on the entry`);
    refusedPart(body, `draft:${DRAFT_KIND_OF[op]}`, `${op}: withdrawn`, entry, { set: GATE_SET, held: { testBars: aiRunsOf(bar.ctx).testBarRecords() } });
  }
  const unknown = await bar.draft({ op: "zzdraft" });
  assert.equal(unknown.status, 403);
  refusedUndeployed(unknown.body, "draft", "an op of no kind");
  assert.equal(plain.asks.length + half.asks.filter(([, b]) => ["textcheck", "infractiondraft", "bearingdraft"].includes(b.task.op)).length, 0,
               "nothing refused was posted");
  assert.equal(plain.grants(), 0);
});

/* ===== R51 (K2824): the action drafts ===== */
test("R51 (K2824; agent-worker R76; run-rules R27): a text check is posted as {task: {op, text}, account, pack}, reading nothing: no grant even with the member's suggestions on", async () => {
  const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS });
  assert.equal(credentialsOf(w.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  const r = await w.draft({ op: "textcheck", text: "We demand the council act." });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.grant, r.body.read], [null, []]);
  const [u, body] = w.asks.at(-1);
  assert.equal(u, "https://agent-worker/draft");
  assert.deepEqual(body, { task: { op: "textcheck", text: "We demand the council act." }, pack: { layers: [] },
    account: { kind: "apikey", level: "member", secret: "sk-ant-zz-ann", member: "member:ann", suggestions: true } });
  assert.equal(w.grants(), 0);
  /* control: an own-words draft with the same switch is sent a grant */
  const own = await w.draft({ op: "writinghelp", ...DRAFTS.writinghelp });
  assert.match(own.body.grant, /^[0-9a-f]{64}$/);
});

test("R51 (K2824): an infraction or bearing draft whose records the member cannot read ends with that read's refusal, or BAD_TASK for a task naming none, before any grant is minted or anything posted", async () => {
  const w = await doors({ gate: { flags: GATE_FLAGS, testSet: GATE_SET }, parts: GATE_PARTS });
  const b = await w.draft({ op: "bearingdraft", action: "ACTN-2026-0009-none", reply: 1 });
  assert.equal(b.status, 409);
  assert.equal(b.body.reason, "NO_SUCH_ACTION", JSON.stringify(b.body));   /* the action's own refusal for one she cannot see (action-records) */
  const p = await w.draft({ op: "infractiondraft", matter: "PLN-2026-0009-none", audience: "members" });
  assert.equal(p.status, 409);
  assert.equal(p.body.ok, false);
  for (const a of [{ op: "infractiondraft", matter: null, audience: "members" }, { op: "bearingdraft", action: null, reply: 1 }]) {
    const r = await w.draft(a);
    assert.deepEqual([r.status, r.body.reason], [400, "BAD_TASK"], a.op);
  }
  assert.equal(w.asks.length, 0, "nothing posted");
  assert.equal(w.grants(), 0, "nothing minted");
  /* control: an infraction draft naming only an action she cannot see is posted with an empty record, a grant minted */
  const ok = await w.draft({ op: "infractiondraft", matter: { actions: ["ACTN-2026-0009-none"] }, audience: "members" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.match(ok.body.grant, /^[0-9a-f]{64}$/, "it reads named records, so a grant whatever the switch (run-rules R27)");
  const [, body] = w.asks.at(-1);
  assert.deepEqual(body.task, { op: "infractiondraft", matter: { actions: ["ACTN-2026-0009-none"] }, audience: "members" });
  assert.deepEqual(body.record, { plan: null, actions: [], correspondence: [], findings: [] });
  assert.equal(body.pack, undefined, "with a grant no pack is sent");
});

import { world as repliesWorld, RFC, INQ, M } from "../action-replies/fixture.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { legEarningOf, legEarningOps } from "../../../src/leg-earning/index.mjs";

test("R51 (K2824): the records are assembled from the asking member's own reads only: the bearing draft's action and received entry, the infraction draft's actions, their entries and the findings their legs cite; a member who sees none of it is given none", async () => {
  const w = repliesWorld();
  w.rfc(RFC);
  const ord = w.say(RFC, "received");
  /* `read`: the module's own op maps under the stamp, as the plane's `#read` answers them through its route map */
  const read = (op, params) => {
    const u = new URL(`http://do/${op}`);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, String(v));
    if (op === "action") return actionsOps(w.a, u, null).action();
    if (op === "basis") return legEarningOps(legEarningOf(w.host), u).basis();
    return null;
  };
  const b = assembleRecords(w.host, { kind: "bearingdraft", action: RFC, reply: ord, viewer: M, read });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(b.records.action_record.id, RFC);
  assert.deepEqual(b.records.action_record, JSON.parse(JSON.stringify(read("action", { id: RFC, viewer: M }))), "the action as she reads it");
  assert.equal(b.records.reply_record.ord, ord);
  assert.equal(b.records.reply_record.entry.direction, "received");
  assert.equal(b.records.reply_record.text.state, "undetermined", "no reading holds the reply's text");
  /* a sent entry is not a reply */
  const sent = w.say(RFC, "sent");
  assert.equal(assembleRecords(w.host, { kind: "bearingdraft", action: RFC, reply: sent, viewer: M, read }).reason, "BAD_TASK");
  const f = assembleRecords(w.host, { kind: "infractiondraft", matter: { actions: [RFC] }, viewer: M, read });
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.deepEqual(f.records.record.actions.map((a) => a.id), [RFC]);
  assert.deepEqual(f.records.record.correspondence.map((c) => [c.action, c.entries.map((e) => e.ord)]), [[RFC, [ord, sent]]]);
  assert.deepEqual(f.records.record.findings.map((x) => x.id), [INQ], "the finding the action's leg cites");
  /* control: a viewer the gate admits to nothing (an unrecognised stamp, DENY) sees none of it */
  const none = assembleRecords(w.host, { kind: "infractiondraft", matter: { actions: [RFC] }, viewer: "nobody", read });
  assert.deepEqual(none.records.record, { plan: null, actions: [], correspondence: [], findings: [] });
  assert.equal(assembleRecords(w.host, { kind: "bearingdraft", action: RFC, reply: ord, viewer: "nobody", read }).reason,
               "NO_SUCH_ACTION");
});

import { caseAccountOf } from "../../../src/case-account/index.mjs";

test("R34 (K2834): case-account's advocacy check and its list are routed over the plane's one case-account instance, with the door's stamps: each answers through the door what that instance answers called directly; the door's `by` stamp is the author (op-declarations R49) and a body's own never wins", async () => {
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(new URL("http://do/"), null));
  for (const op of ["advocacycheck", "advocacychecks"]) assert.ok(keys.includes(op), op);
  const sentences = [{ text: "The council acted.", cites: [] }];
  const viaDoor = async (path, body) => JSON.parse(mask(await (await x.fetch(path, { method: "POST", body: JSON.stringify(body) })).text()));
  const direct = (v) => JSON.parse(mask(JSON.stringify({ ok: true, result: v })));
  assert.deepEqual(await viaDoor("/advocacycheck?project=PROJ-2026-0009-none&by=member:ann&viewer=member:ann", { sentences, author: "token:ai", by: "token:ai" }),
    direct(caseAccountOf(twin.ctx).advocacyCheck({ project: "PROJ-2026-0009-none", sentences, author: "member:ann", viewer: "member:ann" })));
  assert.deepEqual(await viaDoor("/advocacychecks?project=PROJ-2026-0009-none&viewer=member:ann", {}),
    direct(caseAccountOf(twin.ctx).advocacyChecksOf({ project: "PROJ-2026-0009-none", viewer: "member:ann" })));
  /* control: the door's stamp, not the body's, is the author: a machine stamp is case-account's own refusal */
  const machine = await viaDoor("/advocacycheck?project=PROJ-2026-0009-none&by=token:ai&viewer=member:ann", { sentences, author: "member:ann", by: "member:ann" });
  assert.equal(machine.result.reason, "MACHINE_CANNOT_CHECK_ADVOCACY", JSON.stringify(machine));
});

import { actionProducersOf } from "../../../src/action-producers/index.mjs";

test("R34 (K2888; action-producers R13): action-producers is built at start over the plane's own instances, before queue-producers reaches it: its read asks the plane's one action-holds, and every producer answers with none failed", async () => {
  const x = await store();
  const h = actionHoldsOf(x.ctx), was = h.holdsDue.bind(h), asked = [];
  h.holdsDue = (...a) => { asked.push(a); return was(...a); };
  const p = actionProducersOf(x.ctx);
  const r = p.actionItems({ member: "member:ann", viewer: "member:ann" });
  assert.deepEqual(r.facts.failed, [], JSON.stringify(r.facts.failed));
  assert.ok(asked.length > 0, "the plane's action-holds instance was read");
  /* control: a later caller's own deps change nothing; the one instance per storage is the plane's */
  assert.equal(actionProducersOf(x.ctx, { actionHolds: { holdsDue: () => { throw new Error("not the plane's"); } } }), p);
});

import { localFactsOf } from "../../../src/local-facts/index.mjs";


test("R34 (op-declarations R49; local-facts R12): `grouprules` is routed over the plane's local-facts, a session's read answering through the door what groupRules answers; an unknown section is local-facts' own refusal", async () => {
  const x = await store(), twin = await store();
  const viaDoor = async (path) => JSON.parse(mask(await (await x.fetch(path, { method: "POST", body: "{}" })).text()));
  assert.deepEqual(await viaDoor("/grouprules?viewer=member:ann"),
                   JSON.parse(mask(JSON.stringify({ ok: true, result: localFactsOf(twin.ctx).groupRules({ viewer: "member:ann" }) }))));
  const bad = await viaDoor("/grouprules?viewer=member:ann&section=zz");
  assert.equal(bad.result.reason, "RULE_SECTION_UNKNOWN", JSON.stringify(bad));
});
