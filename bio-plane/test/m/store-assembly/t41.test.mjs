/* store-assembly's copy of plane's T41 test: T41's composition (R27, R29, R30, R49, R28, R31; N812, N820, N823; K2438, K2488, K2500, K2525, K2567, K2571): the four new modules
   (`steps`, `reading-guides`, `question-explorer`, `investigation`), `ai-use` and `publish-schedule` built at boot,
   migrated and routed; ai-runs' run holder registered with investigation; and the ask and draft paths taking their
   account and limit from `answers.askAccount`. Each module's own behaviour is its own tests'; these check only the
   composition, through the plane's interface: construction over a storage, the route map, the object's door, `op=stats`,
   the alarm's scheduler and the object's `ask`/`draft`. Each test carries a negative control (K874). */
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, storage, deployed, GATE_FLAGS, GATE_SET, disclosed } from "./fixture.mjs";
import { assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { stepsOf, STEPS_TABLES, ACCEPTANCE_COUNT_KEYS } from "../../../src/steps/index.mjs";
import { readingGuidesOf, readingGuidesOps, READING_GUIDES_TABLES } from "../../../src/reading-guides/index.mjs";
import { questionExplorerOf, QUESTION_EXPLORER_TABLES } from "../../../src/question-explorer/index.mjs";
import { investigationOf, INVESTIGATION_TABLES } from "../../../src/investigation/index.mjs";
import { aiUseOf, aiUseOps, AI_USE_TABLES } from "../../../src/ai-use/index.mjs";
import { publishScheduleOf, publishScheduleOps, PUBLISH_SCHEDULE_TABLES } from "../../../src/publish-schedule/index.mjs";
import { ratificationOf } from "../../../src/ratification/index.mjs";
import { caseAuthoringOf } from "../../../src/case-authoring/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { AiRuns } from "../../../src/ai-runs/index.mjs";
import { draftUse } from "../../../src/store-assembly/ask.mjs";

const nameOf = (t) => (typeof t === "string" ? t : t.name);
const tablesOf = (ctx) => new Set([...ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name));
const DECLARED = { steps: STEPS_TABLES, "reading-guides": READING_GUIDES_TABLES, "question-explorer": QUESTION_EXPLORER_TABLES,
                   investigation: INVESTIGATION_TABLES, "ai-use": AI_USE_TABLES, "publish-schedule": PUBLISH_SCHEDULE_TABLES };
const OPS = (m) => Object.keys(m);

test("R27, R29, R30 (K2567): a fresh store and a store constructed a second time over the same storage each hold every table steps, reading-guides, question-explorer, investigation, ai-use and publish-schedule declare; a bare storage holds none of them", async () => {
  const db = new DatabaseSync(":memory:");
  const first = await store({ db });
  for (const [m, ts] of Object.entries(DECLARED)) {
    assert.ok(ts.length > 0, m);
    const have = tablesOf(first.ctx);
    for (const t of ts.map(nameOf)) assert.ok(have.has(t), `${m}: ${t} on a fresh store`);
  }
  /* R3: a second construction over the same storage migrates idempotently and keeps them */
  const again = await store({ db });
  for (const [m, ts] of Object.entries(DECLARED)) for (const t of ts.map(nameOf)) assert.ok(tablesOf(again.ctx).has(t), `${m}: ${t} again`);
  /* negative control: a storage no plane was built on holds none */
  const bare = storage();
  for (const [m, ts] of Object.entries(DECLARED)) for (const t of ts.map(nameOf)) assert.equal(tablesOf(bare.ctx).has(t), false, `${m}: ${t}`);
});

test("R27 (K2567): stepsOf, readingGuidesOf, questionExplorerOf and investigationOf each answer the plane's one instance, built before the first request with its registrations held; op=stats carries steps' three figures", async () => {
  const x = await store();
  /* one instance per host: a later call with other deps answers the instance the plane made */
  assert.equal(stepsOf(x.ctx, { record: null }), stepsOf(x.ctx));
  assert.equal(investigationOf(x.ctx, { record: null }), investigationOf(x.ctx));
  assert.equal(readingGuidesOf(x.ctx, { groupSlug: () => "other" }), readingGuidesOf(x.ctx));
  assert.equal(questionExplorerOf(x.ctx, { held: "other" }), questionExplorerOf(x.ctx));
  /* the registrations each factory makes at start are held: a second one under the same name is refused */
  const again = investigationOf(x.ctx).registerRunHolder("ai-runs", () => null);
  assert.equal(again.ok, false, JSON.stringify(again));
  /* op=stats, through the object's door, carries steps' figures (record-core R63, registered by its factory) */
  const stats = await (await x.fetch("/stats?viewer=member:nobody")).json();
  const figures = stats.result ?? stats;
  for (const k of ACCEPTANCE_COUNT_KEYS) assert.equal(figures[k], 0, `${k}: ${JSON.stringify(figures).slice(0, 300)}`);
  /* negative control: a bare storage's instances are its own, not the plane's */
  const bare = storage();
  assert.notEqual(investigationOf(bare.ctx), investigationOf(x.ctx));
  assert.equal(investigationOf(bare.ctx).registerRunHolder("ai-runs", () => null).ok, true, "nothing held on a bare host");
});

test("R27 (K2571; scheduler R26): the scheduler is handed the plane's question-explorer, so `question-explore` is among its consumers and answers through it; a scheduler not handed one has no such consumer", async () => {
  const x = await store();
  const consumers = schedulerOf(x.ctx).consumers();
  assert.ok(consumers.includes("question-explore"), consumers.join());
  assert.deepEqual(schedulerOf(x.ctx).faults(), [], "every registration taken");
  /* the alarm runs with its tables present (migrated before the hand-over) and answers without a fault */
  const r = await schedulerOf(x.ctx, x.env).onAlarm(Date.now());   /* the class's `onAlarm`, unretired, is this call */
  assert.ok(r && typeof r === "object", JSON.stringify(r).slice(0, 300));
  /* negative control: on a bare storage, a scheduler built without the hand-over registers no `question-explore` */
  const bare = storage();
  assert.equal(schedulerOf(bare.ctx, {}, { owners: {} }).consumers().includes("question-explore"), false);
});

test("R31 (K2567; reading-guides R1, R6): reading-guides' groupSlug is read from instance-setup's producingGroup when asked, and its ops are in the route map, answering as its own map does; no map is routed for steps, investigation or question-explorer", async () => {
  const x = await store();
  const u = new URL("http://do/x?viewer=member:nobody");
  const map = x.s.routes(u, null);
  const own = readingGuidesOps(readingGuidesOf(x.ctx), u, null);
  for (const op of OPS(own)) assert.ok(Object.hasOwn(map, op), `op=${op} routed`);
  assert.equal(JSON.stringify(await map.guides()), JSON.stringify(await own.guides()), "op=guides answers as its own map");
  /* the slug is asked at each offer: none recorded yet, so an offer is refused GUIDE_NO_GROUP_SLUG; once instance-setup
     records the group, the same offer is no longer refused for want of a slug */
  for (const m of ["ann", "bob"])
    x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                            VALUES (?, 'c', ?, 'member', 'active', '["contribute"]', 't', 't')`, m, `h_${m}`);
  const g = readingGuidesOf(x.ctx);
  const items = [{ label: "Fiscal impact", look_for: "Look for the fiscal impact and who pays it" },
                 { label: "Votes", look_for: "Note whether the vote was unanimous", where: "the minutes' record of the vote" }];
  const drafted = g.guideDraft({ kind: "staff_report", items, by: "member:ann" });
  assert.equal(drafted.ok, true, JSON.stringify(drafted).slice(0, 300));
  assert.equal(g.guideReview({ guide: drafted.guide, verdict: "approve", by: "member:bob" }).ok, true);
  const offer = () => g.guideOffer({ guide: drafted.guide, by: "member:ann" });
  const before = offer();
  assert.equal(instanceSetupOf(x.ctx).producingGroup(), null);
  assert.equal(before.reason ?? before.code, "GUIDE_NO_GROUP_SLUG", JSON.stringify(before).slice(0, 300));
  assert.equal(instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "guide-group", author: "admin" }).ok, true);
  assert.equal(instanceSetupOf(x.ctx).producingGroup(), "guide-group");
  const after = offer();
  assert.equal(after.ok, true, JSON.stringify(after).slice(0, 300));
  assert.equal(after.group, "guide-group", "labelled with the slug read at the offer");
  /* negative control: steps, investigation and question-explorer export no ops map of their own (control-plane R71's) */
  for (const mod of ["steps", "investigation", "question-explorer"]) {
    const m = await import(`../../../src/${mod}/index.mjs`);
    assert.deepEqual(Object.keys(m).filter((k) => /Ops$|Routes$/.test(k)), [], `${mod} exports no ops map`);
  }
});

test("R29 (K2488; ai-use R7, R69): ai-use is the one instance the plane built, its five ops (`ailimitset`, `ailimits`, `aiusage`, `exploreapprove`, `aiuseovertime`: ai-use R14, T48) routed before ai-runs' over it, answering as its own map; publication's handle guard is held with membership before the first request", async () => {
  const x = await store();
  assert.equal(aiUseOf(x.ctx, { zone: "Pacific/Auckland" }), aiUseOf(x.ctx), "one instance; later deps are not read");
  const u = new URL("http://do/x?viewer=member:nobody&by=member:nobody");
  const map = x.s.routes(u, {});
  const own = aiUseOps(aiUseOf(x.ctx), u, {});
  /* (T49; N1073, K3268) the ops are read from ai-use's own map, its declaration, not hand-listed here */
  assert.ok(OPS(own).length > 0, "ai-use declares ops");
  for (const op of OPS(own)) assert.ok(Object.hasOwn(map, op), `op=${op}`);
  for (const op of ["ailimits", "aiusage"]) assert.equal(JSON.stringify(await map[op]()), JSON.stringify(await own[op]()), `op=${op}`);
  const keys = OPS(map);
  assert.ok(keys.indexOf("exploreapprove") < keys.indexOf("airunopen"), "ai-use's map before ai-runs'");
  /* the retired ceiling ops are routed by no one */
  for (const op of ["aiceilingset", "aicopyceilingset"]) assert.equal(Object.hasOwn(map, op), false, op);
  /* publication's handle guard (its R76, membership R125) is registered at boot: a second is refused */
  const guard = membershipOf(x.ctx).registerHandleGuard("publication", () => null);
  assert.equal(guard.ok, false, JSON.stringify(guard));
  /* negative control: on a bare storage no guard is held */
  assert.equal(membershipOf(storage().ctx).registerHandleGuard("publication", () => null).ok, true);
});

test("R30 (N823; K2438; ratification R43): publish-schedule is the one instance ratification's factory created, migrated, reached by case-authoring and the scheduler, and its three ops are routed directly after case-carriage's, answering as its own map", async () => {
  const x = await store();
  const ps = ratificationOf(x.ctx).publishSchedule;
  assert.equal(publishScheduleOf(x.ctx), ps, "the one instance per host");
  assert.equal(caseAuthoringOf(x.ctx).publishSchedule, ps, "case-authoring holds it (its R58)");
  /* the scheduler's `scheduled-publish` reaches it (its R22) */
  assert.ok(schedulerOf(x.ctx).consumers().includes("scheduled-publish"));
  const u = new URL("http://do/x?viewer=member:nobody&by=member:nobody");
  const map = x.s.routes(u, {});
  const own = publishScheduleOps(ps, u, {});
  assert.deepEqual(OPS(own), ["publishatmove", "publishatcancel", "publishschedule"]);
  const keys = OPS(map);
  const at = keys.indexOf("obscuremarkwithdraw");
  assert.deepEqual(keys.slice(at + 1, at + 4), OPS(own), "directly after case-carriage's map");
  assert.equal(JSON.stringify(await map.publishschedule()), JSON.stringify(await own.publishschedule()));
  assert.equal(JSON.stringify(await map.publishatcancel()), JSON.stringify(await own.publishatcancel()));
  /* negative control: `publishat` is ratification's own scheduled arm (its R40), not publish-schedule's: the route map
     answers it from ratification's map, never from this one */
  assert.equal(Object.hasOwn(own, "publishat"), false);
});

test("R28 (K2525; investigation R20): ai-runs' run holder is registered with investigation, so a running run's own system identity reaches planPropose past PLAN_NOT_YOUR_RUN; a run that is not running, and a host with no holder, are refused it", async () => {
  const x = await store();
  const sql = x.ctx.storage.sql;
  const cols = [...sql.exec(`PRAGMA table_info(ai_runs)`)];
  const row = { run: "RUN-t41-held", status: "running", principal_plane: "member:ann", principal_claude: "member:ann" };
  for (const c of cols) if (c.notnull && c.dflt_value === null && !(c.name in row)) row[c.name] = c.type.toUpperCase().includes("INT") ? 0 : "x";
  sql.exec(`INSERT INTO ai_runs (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`, ...Object.values(row));
  const propose = (inv, run) => inv.planPropose({ project: "PROJ-none", kind: "question", text: "Who signed it?", run,
                                                   by: AiRuns.systemOf(run) });
  const held = propose(investigationOf(x.ctx), "RUN-t41-held");
  assert.notEqual(held.reason, "PLAN_NOT_YOUR_RUN", JSON.stringify(held).slice(0, 300));
  /* negative controls: a run the store holds as ended, and the same run on a host where no holder is registered */
  sql.exec(`UPDATE ai_runs SET status='ended' WHERE run=?`, "RUN-t41-held");
  assert.equal(propose(investigationOf(x.ctx), "RUN-t41-held").reason, "PLAN_NOT_YOUR_RUN");
  assert.equal(propose(investigationOf(storage().ctx), "RUN-t41-held").reason, "PLAN_NOT_YOUR_RUN");
});

/* R49's world: ann with her own account and a live session, the group's assistant on, and agent-worker recording. */
const SEAL = "a-long-seal-secret-for-the-test-only";
const SESSION = "s".repeat(64);
async function world() {
  const asks = [];
  const env = { ACCOUNT_SEAL_SECRET: SEAL, AGENT_WORKER: { fetch: async (u, init) => { asks.push([u, JSON.parse(init.body)]);
    if (u === "https://agent-worker/draft")
      return new Response(JSON.stringify({ ok: true, draft: { text: "t" } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response('{"event":"answer","ok":true}\n', { status: 200, headers: { "content-type": "application/x-ndjson" } }); } } };
  /* R50 (K2853): the doors deployed for this test */
  const x = await store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });
  await deployed(x.ctx);
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);   /* R35 (T47): the disclosure first, as the assembled plane asks */
  const r = await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { ...x, asks };
}

test("R49 (K2500; answers R30): answers is handed no ceilingRefusal; the ask and the draft take their account and limit from answers.askAccount (kind `ask`, kind `draft`), and its refusal is answered as given before anything is posted", async () => {
  const x = await world();
  assert.equal(Object.hasOwn(answersOf(x.ctx).deps ?? {}, "ceilingRefusal"), false, "no ceiling handed to answers");
  const a = answersOf(x.ctx), was = a.askAccount.bind(a), seen = [];
  a.askAccount = async (args) => { seen.push(args); return was(args); };
  try {
    assert.equal((await x.s.ask({ member: "member:ann", session: SESSION, question: "q" })).status, 200);
    assert.equal((await x.s.draft({ op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason" })).status, 200);
    assert.deepEqual(seen.map((s) => [s.member, s.kind]), [["member:ann", "ask"], ["member:ann", "draft"]]);
    assert.equal(x.asks.length, 2);
    assert.equal(x.asks[0][1].account.secret, "sk-ant-zz-ann", "the account askAccount answered is the one posted");
    /* negative control: a refusal askAccount answers (here AI_LIMIT_REACHED) is answered as given, and nothing posted */
    const REFUSED = { ok: false, reason: "AI_LIMIT_REACHED", code: "AI_LIMIT_REACHED", detail: "the test's limit" };
    a.askAccount = async () => REFUSED;
    const r1 = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
    assert.deepEqual(await r1.json(), REFUSED);
    const r2 = await (await x.s.draft({ op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason" })).json();
    assert.equal(r2.reason, "AI_LIMIT_REACHED");
    assert.equal(r2.grant, null);
    assert.equal(x.asks.length, 2, "nothing reached agent-worker");
  } finally { a.askAccount = was; }
  /* and through ai-use itself: one call counted to ann's own account against her limit of one call a day refuses her
     next ask, nothing posted */
  const set = aiUseOf(x.ctx).aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 1, by: "member:ann" });
  assert.equal(set.ok, true, JSON.stringify(set).slice(0, 300));
  const counted = aiUseOf(x.ctx).countAskUsage({ member: "member:ann", owner: "member:ann", mode: "ask",
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: 0.001 } });
  assert.notEqual(counted && counted.ok, false, JSON.stringify(counted).slice(0, 300));
  const r3 = await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal((await r3.json()).reason, "AI_LIMIT_REACHED");
  assert.equal(x.asks.length, 2);
});

test("R49 (K2500; store-door R11): a read under a grant the draft path minted is recorded in its read log with use `draft`; a read under an ask's grant with use `ask`", async () => {
  const x = await world();
  assert.equal(credentialsOf(x.ctx).accountUsesSet({ owner: "member:ann", switch: "suggestions", on: true, by: "member:ann" }).ok, true);
  let draftGrant = null;
  const post = x.env.AGENT_WORKER.fetch;
  x.env.AGENT_WORKER.fetch = async (u, init) => {
    const b = JSON.parse(init.body);
    if (b.grant) { draftGrant = b.grant; await x.fetch(`/search?q=clerk&viewer=member:ann`, { headers: { "x-bio-grant": b.grant } }); }
    return post(u, init);
  };
  const r = await (await x.s.draft({ op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason" })).json();
  assert.match(r.grant ?? "", /^[0-9a-f]{64}$/);
  assert.equal(r.grant, draftGrant);
  assert.equal(draftUse(x.ctx, draftGrant), "draft");
  assert.equal(answersOf(x.ctx).readLog(draftGrant).use, "draft", "the draft's read log reads under `draft`");
  assert.ok(r.read.length > 0, JSON.stringify(r.read));
  /* negative control: an ask's grant, minted by the ask path, reads under `ask` */
  const mint = await credentialsOf(x.ctx).aiGrantMint({ member: "member:ann", by: "member:ann", session: SESSION });
  assert.equal(mint.ok, true, JSON.stringify(mint));
  await x.fetch(`/search?q=clerk&viewer=member:ann`, { headers: { "x-bio-grant": mint.token } });
  assert.equal(draftUse(x.ctx, mint.token), null);
  assert.equal(answersOf(x.ctx).readLog(mint.token).use, "ask");
});

test("R17, R27 (K2586; wizard-scripts R23): the front door's finder is registered with wizard-scripts at start, over the plane's steps and the record's search, so `startfrom` answers a group step whose work matches the message, as this viewer sees it; a viewer the gate does not know is answered none", async () => {
  const x = await store();
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  const made = stepsOf(x.ctx).stepCreate({ place: { group: true }, work: "Ask the clerk for the 2025 contract file", by: "member:ann" });
  assert.equal(made.ok, true, JSON.stringify(made).slice(0, 300));
  const asked = await x.call(`/startfrom?viewer=member:ann`, { message: "ask the clerk for the 2025 contract file" });
  assert.equal(asked.ok, true, JSON.stringify(asked).slice(0, 300));
  assert.deepEqual(asked.matches.filter((m) => m.kind === "step"),
                   [{ kind: "step", id: made.step, name: "Ask the clerk for the 2025 contract file" }]);
  /* negative controls: a message nothing matches finds none, and a viewer the gate denies is asked no finder */
  assert.deepEqual((await x.call(`/startfrom?viewer=member:ann`, { message: "zzz unrelated words qqq" })).matches, []);
  assert.deepEqual((await x.call(`/startfrom?viewer=nobody`, { message: "ask the clerk for the 2025 contract file" })).matches, []);
});

test("R31 (K2585; control-plane R71, R72): control-plane's owner map is spread into the route map over the plane's own instances: each of its ops is routed, after admission's and before store-door's map, and a step made through `stepcreate` is the plane's steps' own; a bare storage's steps hold none of it", async () => {
  const { ownerOps } = await import("../../../src/store-assembly/owner-ops.mjs");
  const x = await store();
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  const u = new URL("http://do/x?viewer=member:ann&by=member:ann");
  const none = () => { throw new Error("not asked"); };
  const own = OPS(ownerOps({ aiUse: none, aiRuns: none, caseAccount: none, review: none, legEarning: none,
                                         capture: none, steps: none, investigation: none, questionExplorer: none }, u, {}));
  assert.ok(own.includes("stepcreate") && own.includes("aiestimate"), own.join());
  const keys = OPS(x.s.routes(u, {}));
  for (const op of own) assert.ok(keys.includes(op), `op=${op} routed`);
  assert.ok(keys.indexOf(own[0]) > keys.indexOf("doorwindow"), "after admission's map");
  const made = await x.call(`/stepcreate?by=member:ann&viewer=member:ann`, { place: { group: true }, work: "Read the 2025 budget" });
  assert.equal(made.ok, true, JSON.stringify(made).slice(0, 300));
  assert.equal(stepsOf(x.ctx).step({ step: made.step, viewer: "member:ann" }).ok, true, "the plane's own steps holds it");
  /* negative control: a storage no plane was built on holds no such step */
  const bare = storage();
  assert.notEqual(stepsOf(bare.ctx).step({ step: made.step, viewer: "member:ann" }).ok, true);
});
