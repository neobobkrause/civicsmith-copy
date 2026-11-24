/* screens-inquiry R4, R6, R7, R8, R13, R33, R42: the assistant dock, on interface-shell's served page, opened from the
 * masthead while the assistant is reachable (its R20). The scripted plane plays ai-runs (`airunopen`, `airun`, `airuns`,
 * `airunlog`, `airunclose`), run-productions (`suggest`) and control-plane's member-run door (`airundispatch`), recording
 * every request with its address, body and `Authorization` header. Every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, SESSION } from "../interface-shell/harness.mjs";
import { airunDispatchRefusal, airunOpenRefusal } from "../ai-runs/fixtures.mjs";
import { keepAwayState } from "../ai-accounts/fixtures.mjs";
import { open, plane, button, fill, says, word, day, storeWorld, P, Q, D } from "./fixtures.mjs";

const UNTESTED = { kind: "untested", part: "check", set: "s", set_version: 1, words: "ai.label.untested" };
const SESSION_HEADER = "Bearer " + SESSION.t;
const OLD = "RUN-" + "a".repeat(16);

/* R33: the open's allowance rule as `run-rules` states it (a declared bound states a positive whole allowance,
   C-22.16 AI_RUN_BOUND_NO_ALLOWANCE; a planning run declares no search allowance, C-109.6), played by the fake plane */
const openRule = (body) => {
  const bounds = Array.isArray(body.bounds) ? body.bounds : [];
  const none = bounds.find((b) => !b || b.allowed == null || b.allowed === 0 || !Number.isSafeInteger(b.allowed) || b.allowed < 0);
  if (none) return { run: body.run, started: false, code: "AI_RUN_BOUND_NO_ALLOWANCE", bound: none && none.bound };
  if (body.mode === "plan" && bounds.some((b) => (b.bound === "fetches" || b.bound === "subsessions") && b.allowed > 0)) return { run: body.run, started: false, code: "AI_RUN_PLAN_NO_SEARCH" };
  return null;
};

/* the run as the plane holds it; `status` moves when the run is closed or ends; `runs` what `airuns` answers */
function stub({ untested = UNTESTED, dispatch = null, open: opened = null, runs = [] } = {}) {
  const held = { status: "running", ticks: 1, entries: [] };
  return {
    held,
    ops: {
      assistantstate: ok({ on: true }),
      accountreference: ok({ held: true }),
      groupkeystate: ok({ held: true, on: true }),
      aiusage: ok({ ok: true, today: { used: "$0.42", limit: "$2.00" } }),
      agentpack: ok({ ok: true, pack: { version: "civicsmith@3+ab12cd" } }),
      aikeepawaystate: ok(OFF),
      airuns: (r) => ok({ ok: true, context: { type: r.query.contextType, id: r.query.contextId }, runs, count: runs.length }),
      airunopen: (r) => opened || ok(openRule(r.body) || { run: r.body.run, started: true, status: "running", ticks: 1, untested }),
      airundispatch: (r) => dispatch || ok({ run: r.body.run, found: true, dispatched: true, status: "running" }),
      airun: (r) => ok({ found: true, session: { id: r.query.run, status: held.status, ticks: held.ticks, untested, condition: held.condition } }),
      airunlog: (r) => ok({ run: r.query.run, found: true, entries: held.entries }),
      airunclose: () => { held.status = "terminated"; held.condition = "cancelled"; return ok({ found: true, terminated: true, status: "terminated" }); },
      suggest: (r) => ok({ record: { name: r.body.name, description: r.body.description } }),
    },
  };
}
async function dock(subject, s, extra = {}) {
  const screen = /^PROJ-/.test(subject) ? "project" : /^INFO-/.test(subject) ? "document" : "question";
  const p = await open(`/app/${screen}/${subject}`, { boot: { plane: { ...plane(), ...s.ops, ...extra } } });
  await p.click(p.root().querySelector('.cs-mast [data-shell="dock"]'));
  await p.settle();
  return p;
}
const panel = (p) => p.root().querySelector(".cs-dock");
const dockActs = (p) => panel(p).querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act"));
const workOn = async (p) => { await p.click(button(p, "airunopen", panel(p))); await p.settle(); };
const CREDENTIAL_OPS = ["aicredentialmint", "aicredentialrevoke"];
/* ai-accounts' real keep-away answers, off and on (a court order the administrator gave): played back where the page reads `aikeepawaystate` */
const { kept: KEPT, off: OFF } = await keepAwayState({ reason: "court order" });

test("R4 the panel says once what it is and never does, and whose account serves her (ai.account.*)", async () => {
  const p = await dock(Q, stub());
  const t = panel(p).textContent;
  assert.equal(t.split(word("screen.assistant.says")).length - 1, 1);
  assert.ok(says(panel(p), "screen.assistant.serves") && says(panel(p), "ai.account.own.inline"));
  assert.ok(says(panel(p), "screen.assistant.use", { used: "$0.42", limit: "$2.00" }));
  const g = await dock(Q, stub(), { accountreference: ok({ held: false }) });
  assert.ok(says(panel(g), "ai.account.group.inline"));
});

test("R4 a project's own account serves her in its project; a document's run is its project's", async () => {
  /* the project's own account, by the real acts of its owner (her password again, the project's key set and switched on), as the world answers it to her */
  const world = await storeWorld({ ai: true });
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  await ann.act("reauth", { body: { password: ann.password } });
  await ann.act("projectkeyset", { body: { project, key: "sk-ant-api03-" + "7".repeat(40) } });
  await ann.act("projectaccountswitch", { body: { project, on: true } });
  const p = await dock(D, stub(), { projectaccountstate: ok(await ann.read("projectaccountstate", { query: { project } })) });
  assert.ok(says(panel(p), "ai.account.project.inline"));
  const b = button(p, "airunopen", panel(p));
  assert.deepEqual([b.getAttribute("data-ctx-type"), b.getAttribute("data-ctx-id")], ["project", P]);
  const none = await dock(D, stub(), { image: (r) => ok(r.query.id === D ? { "bundle.md": `---\nid: ${D}\n---\n` } : null) });
  assert.ok(!dockActs(none).includes("airunopen"));
  assert.ok(says(panel(none), "screen.assistant.run.nocontext"));
});

test("R6 R13 R33 Work on this opens the run under her session with the bounds its mode needs, then the segment through the door with run alone", async () => {
  const p = await dock(Q, stub());
  assert.deepEqual(dockActs(p), ["airunopen"]);
  await workOn(p);
  const [opened, dispatch] = ["airunopen", "airundispatch"].map((op) => p.byOp(op)[0]);
  assert.deepEqual(Object.keys(opened.body).sort(), ["bounds", "contextId", "contextType", "mode", "principalClaude", "project", "run", "skillVersion"]);
  assert.equal(opened.body.project, P, "R58: a run opened in a project sends that project (the question's)");
  assert.deepEqual([opened.body.contextType, opened.body.contextId, opened.body.mode, opened.body.principalClaude, opened.body.skillVersion],
                   ["inquiry", Q, "check", "member:mai", "civicsmith@3+ab12cd"]);
  /* R33: no zero allowance, so the plane's rule does not refuse it AI_RUN_BOUND_NO_ALLOWANCE */
  assert.equal(openRule(opened.body), null);
  assert.ok(opened.body.bounds.every((b) => b.allowed > 0), "no zero fetches or subsessions allowance");
  assert.deepEqual(opened.body.bounds.find((b) => b.bound === "wallclock"), { bound: "wallclock", allowed: 1800000, unit: "ms" });
  assert.match(opened.body.run, /^RUN-[0-9a-f]{16}$/);
  assert.deepEqual(dispatch.body, { run: opened.body.run }, "run alone");
  assert.ok(p.requests.indexOf(dispatch) > p.requests.indexOf(opened));
  for (const op of CREDENTIAL_OPS) assert.equal(p.byOp(op).length, 0, `${op} is never sent`);
  for (const r of p.requests.filter((x) => x.op !== "bootstrap")) {
    assert.equal(r.headers.Authorization, SESSION_HEADER, `${r.op} carries her session alone`);
    const said = JSON.stringify(r.body || {}) + r.url;
    assert.ok(!/token|credential|bearer|aik-/i.test(said), `${r.op} carries no credential`);
    assert.ok(!(r.body && typeof r.body === "object" && "at" in r.body), `${r.op} sends at`);
  }
  for (const v of [...p.store.values(), ...p.local.values()]) assert.ok(!/RUN-|token/i.test(String(v)), "nothing of the run is stored");
  assert.ok(says(panel(p), "dock.run.yours"), "working, once dispatched and running");
  assert.deepEqual(dockActs(p).sort(), ["airunclose", "suggest"]);
});

test("R33 controls: started: false is a refusal by its words and no dispatch follows; a withheld dispatch draws its reason by key", async () => {
  const no = await dock(Q, stub({ open: ok({ run: "x", started: false, code: "AI_RUN_BOUND_NO_ALLOWANCE" }) }));
  await workOn(no);
  assert.equal(no.byOp("airundispatch").length, 0, "nothing dispatched after started: false");
  assert.ok(says(panel(no).querySelector('[data-refusal="airunopen"]'), "refusal.AI_RUN_BOUND_NO_ALLOWANCE"));
  assert.ok(!says(panel(no), "dock.run.yours"), "never working");
  for (const code of ["MEMBER_PRINCIPAL_RUN", "AGENT_WORKER_UNBOUND", "NAMESPACE_UNDETERMINED", "CREDENTIAL_RECORD_SILENT"]) {
    const p = await dock(Q, stub({ dispatch: ok({ run: "x", found: true, dispatched: false, status: "running", withheld: code }) }));
    await workOn(p);
    const said = panel(p).querySelector('[data-refusal="airundispatch"]');
    assert.ok(says(said, "dock.withheld." + code), code);
    assert.ok(!says(panel(p), "dock.run.yours"), `${code}: a run withheld is never said to be working`);
    assert.ok(dockActs(p).includes("airunopen"), "the act stays");
  }
  const other = await dock(Q, stub({ dispatch: ok({ run: "x", found: true, dispatched: false, status: "running", withheld: "INSTANCE_AI_CREDENTIAL_REVOKED" }) }));
  await workOn(other);
  const said = panel(other).querySelector('[data-refusal="airundispatch"]');
  assert.ok(says(said, "dock.withheld.other") && said.textContent.includes("INSTANCE_AI_CREDENTIAL_REVOKED"), "never blank");
});

test("R13 a reloaded dock continues her running run by the same act: airundispatch for that run, nothing opened anew", async () => {
  const mine = { id: OLD, status: "running", ticks: 3, principal: { plane: "member:mai", claude: "member:mai" } };
  const p = await dock(Q, stub({ runs: [mine] }));
  assert.deepEqual([p.byOp("airuns")[0].query.contextType, p.byOp("airuns")[0].query.contextId], ["inquiry", Q]);
  assert.ok(!says(panel(p), "dock.run.yours"), "R33: not said working until this dock dispatches it");
  assert.ok(dockActs(p).includes("airunopen"), "the same act");
  await workOn(p);
  assert.equal(p.byOp("airunopen").length, 0, "no new run");
  assert.deepEqual(p.byOp("airundispatch").map((r) => r.body), [{ run: OLD }]);
  assert.ok(says(panel(p), "dock.run.yours"));
  /* controls: another member's running run, or one of hers that ended, is not continued: a new run is opened */
  for (const run of [{ ...mine, principal: { plane: "member:dev" } }, { ...mine, status: "completed" }]) {
    const q = await dock(Q, stub({ runs: [run] }));
    /* R48: another member's run leaves "No run yet"; one of hers that ended is drawn ended, never "No run yet" */
    assert.ok(run.status === "completed" ? says(panel(q), "screen.assistant.run.ended", { why: word("ai.run.ending.completed") }) && !says(panel(q), "screen.assistant.run.none")
      : says(panel(q), "screen.assistant.run.none"));
    await workOn(q);
    assert.equal(q.byOp("airunopen").length, 1);
    assert.notEqual(q.byOp("airundispatch")[0].body.run, OLD);
  }
});

test("R8 a run the dock dispatched is read again on the page clock, at most every 10 seconds, so one that ended by itself is drawn ended", async () => {
  const s = stub();
  const p = await dock(Q, s);
  await workOn(p);
  const reads = () => p.byOp("airun").length;
  const before = reads();
  await p.clock.tick(9000);
  assert.equal(reads(), before, "not before 10 seconds");
  await p.clock.tick(1000);
  assert.equal(reads(), before + 1, "once at 10 seconds");
  s.held.status = "completed"; s.held.condition = { kind: "", detail: "completed: the run finished", bound: "completed", at: "2026-10-15T00:00:00Z" };
  await p.clock.tick(10000);
  assert.ok(says(panel(p), "screen.assistant.run.ended", { why: word("ai.run.ending.completed") }), "without her next act, its ending by its bound, never the object");
  assert.ok(!panel(p).textContent.includes("[object Object]"));
  assert.ok(!says(panel(p), "dock.run.yours"), "R33: no longer said working");
  const ended = reads();
  await p.clock.tick(60000);
  assert.equal(reads(), ended, "an ended run is not read again");
});

test("R4 R13 Stop the run closes it under her session; a new run may then be started", async () => {
  const s = stub();
  const p = await dock(Q, s);
  await workOn(p);
  await p.click(button(p, "airunclose", panel(p)));
  await p.settle();
  const close = p.byOp("airunclose")[0];
  assert.equal(close.headers.Authorization, SESSION_HEADER);
  assert.deepEqual(close.body, { run: p.byOp("airunopen")[0].body.run, bound: "cancelled" });
  assert.ok(panel(p).querySelector('[data-run="ended"]'));
  assert.deepEqual(dockActs(p), ["airunopen"]);
  const q = await dock(Q, stub({ runs: [{ id: OLD, status: "running", principal: { plane: "member:mai" } }] }));
  await q.click(button(q, "airunclose", panel(q)));
  await q.settle();
  assert.deepEqual(q.byOp("airunclose").map((r) => r.body), [{ run: OLD, bound: "cancelled" }]);
});

test("R6 R13 the door's refusals drawn by their words, beside the act", async () => {
  const keep = { reason: "court order", set_by: "rosa", set_at: "2026-10-02T09:00:00Z" };
  const cases = [["MEMBER_RUN_MODE_NOT_ADMITTED", "refusal.MEMBER_RUN_MODE_NOT_ADMITTED"], ["AI_RUN_NOT_PRINCIPAL", "refusal.AI_RUN_NOT_PRINCIPAL"],
    ["ACCOUNT_MEMBER_NOT_ACTIVE", "refusal.ACCOUNT_MEMBER_NOT_ACTIVE"], ["AI_RUN_CREDENTIAL_MALFORMED", "refusal.AI_RUN_CREDENTIAL_MALFORMED"]];
  for (const [code, key] of cases) {
    const p = await dock(Q, stub({ dispatch: ok(await airunDispatchRefusal(code)) }));
    await workOn(p);
    assert.ok(says(panel(p).querySelector('[data-refusal="airundispatch"]'), key), code);
  }
  const k = await dock(Q, stub({ dispatch: ok({ run: "x", found: true, dispatched: false, code: "AI_KEPT_AWAY", keep_away: keep }) }));
  await workOn(k);
  assert.ok(says(panel(k).querySelector('[data-refusal="airundispatch"]'), "ai.refused.keptaway", { member: "rosa", date: day("2026-10-02T09:00:00Z", { year: true }), reason: "court order" }));
  const ended = await dock(Q, stub({ dispatch: ok({ run: "x", found: true, dispatched: false, status: "completed" }) }));
  await workOn(ended);
  assert.ok(says(panel(ended).querySelector('[data-refusal="airundispatch"]'), "refusal.AI_RUN_NOT_RUNNING"));
});

test("R13 a refusal of the door with no word and no translation is drawn as refusal.uncatalogued with its code, never the answer's detail; one with a word, its word alone", async () => {
  const DETAIL = "zz-detail-9";
  // fixtures-generic: NO_SUCH_DOOR_CODE (a code made up on purpose: no module answers it, so the door's refusal with no word and no translation is drawn as uncatalogued)
  const un = await dock(Q, stub({ dispatch: { status: 200, json: { ok: true, result: { ok: false, reason: "NO_SUCH_DOOR_CODE", code: "NO_SUCH_DOOR_CODE", detail: DETAIL } } } }));
  await workOn(un);
  const said = panel(un).querySelector('[data-refusal="airundispatch"]');
  assert.ok(says(said, "refusal.uncatalogued") && said.textContent.includes("NO_SUCH_DOOR_CODE"));
  assert.ok(!panel(un).textContent.includes(DETAIL), "the builder's detail is not drawn");
  /* controls: a held word is drawn alone, without the code or the detail; a translation is drawn as it came */
  const held = await dock(Q, stub({ dispatch: { status: 200, json: { ok: true, result: { ok: false, reason: "AI_RUN_NOT_PRINCIPAL", code: "AI_RUN_NOT_PRINCIPAL", detail: DETAIL } } } }));
  await workOn(held);
  const h = panel(held).querySelector('[data-refusal="airundispatch"]');
  assert.ok(says(h, "refusal.AI_RUN_NOT_PRINCIPAL") && !says(h, "refusal.uncatalogued") && !panel(held).textContent.includes(DETAIL));
  // fixtures-generic: NO_SUCH_DOOR_CODE (the same made-up code, here with a translation)
  const tr = await dock(Q, stub({ dispatch: { status: 200, json: { ok: true, result: { ok: false, reason: "NO_SUCH_DOOR_CODE", code: "NO_SUCH_DOOR_CODE", translation: "zz-translated-9", detail: DETAIL } } } }));
  await workOn(tr);
  assert.ok(panel(tr).querySelector('[data-refusal="airundispatch"]').textContent.includes("zz-translated-9"));
  assert.ok(!panel(tr).textContent.includes(DETAIL));
});

test("R4 refusals of the open by their words: mode not deployed, kept away, no account, use switched off, limit reached", async () => {
  const cases = [["AI_RUN_MODE_NOT_DEPLOYED", "ai.refused.notdeployed"], ["AI_NO_ACCOUNT", "ai.refused.noaccount"], ["AI_LIMIT_REACHED", "ai.refused.limit"]];
  for (const [code, key] of cases) {
    const answer = await airunOpenRefusal(code);
    const p = await dock(Q, stub({ open: ok(answer) }));
    await workOn(p);
    /* the words' fields are the answer's own (`whose`, `period`, `use`, `when` of the limit), blank where it states none */
    assert.ok(says(panel(p), key, { whose: answer.whose ?? "", period: answer.period ?? "", use: answer.use ?? "", when: answer.when ?? "" }), code);
    assert.ok(dockActs(p).includes("airunopen"), "the panel stays, the act stays");
  }
});

test("R42 where the assistant cannot work, the other reasons by key and whose account serves her; control: a reachable assistant with nothing refused draws none", async () => {
  const p = await dock(Q, stub(), { aikeepawaystate: ok(OFF) });
  assert.equal(panel(p).querySelector('[data-reasons="assistant"]'), null);
  const w = await dock(Q, stub({ dispatch: ok({ run: "x", found: true, dispatched: false, status: "running", withheld: "AGENT_WORKER_UNBOUND" }) }),
    { aikeepawaystate: ok(KEPT) });
  await workOn(w);
  const r = panel(w).querySelector('[data-reasons="assistant"]');
  assert.ok(says(r, "question.ai.other"));
  assert.ok(says(r, "ai.refused.keptaway", { member: KEPT.set_by, date: day(KEPT.set_at, { year: true }), reason: KEPT.reason }), "kept away");
  assert.ok(says(r, "dock.withheld.AGENT_WORKER_UNBOUND"), "not installed");
  assert.ok(says(r, "question.ai.whose") && says(r, "ai.account.own.inline"), "whose account serves her");
  const none = await dock(Q, stub(), { accountreference: ok({ held: false }), groupkeystate: ok({ held: true, on: true }), agentpack: refusedIn("PACK_UNDETERMINED") });
  const r2 = panel(none).querySelector('[data-reasons="assistant"]');
  assert.ok(says(panel(none), "screen.assistant.run.notready") && says(r2, "dock.withheld.AGENT_WORKER_UNBOUND"));
});

test("R6 only a check is started, and only with the pack named", async () => {
  const p = await dock(Q, stub());
  await workOn(p);
  assert.equal(p.byOp("airunopen")[0].body.mode, "check");
  const nopack = await dock(Q, stub(), { agentpack: refusedIn("PACK_UNDETERMINED") });
  assert.ok(!dockActs(nopack).includes("airunopen"));
});

test("R4 R7 the run's productions drawn as machine work, never evidence, each carrying the run's untested label", async () => {
  const s = stub();
  s.held.entries = [{ says: "The work orders cite \"AI 4.12\" in their category field." }];
  const p = await dock(Q, s);
  await workOn(p);
  fill(p, { "assistant-suggest-name": "Cite the column", "assistant-suggest-description": "Cite the category column" });
  await p.click(button(p, "suggest", panel(p)));
  await p.settle();
  assert.deepEqual(p.byOp("suggest")[0].body, { target: Q, kind: "sharpen-question", run: p.byOp("airunopen")[0].body.run, name: "Cite the column", description: "Cite the category column" });
  /* R58: the log's English is no longer drawn (its seam); the steps are drawn from its fields, the suggestion as machine work */
  assert.ok(!panel(p).textContent.includes("The work orders cite"), "no English of the log is drawn");
  const items = panel(p).querySelectorAll(".cs-machinework:not([data-progress])");
  assert.equal(items.length, 1, "the suggestion");
  for (const it of items) {
    assert.ok(it.querySelector('.cs-origin[data-origin="machine"]'));
    assert.ok(says(it.querySelector('[data-label="untested"]'), "ai.label.untested"));
    assert.ok(says(it, "screen.assistant.notevidence"));
    assert.equal(it.querySelector(".cs-grade"), null, "never drawn as evidence, with a grade");
  }
});

test("R7 control: an output of a run the plane did not mark untested carries no such label", async () => {
  const s = stub({ untested: null });
  s.held.entries = [{ says: "A production." }];
  const p = await dock(Q, s);
  await workOn(p);
  assert.ok(!panel(p).textContent.includes("A production."), "R58: the log's English is not drawn");
  assert.equal(panel(p).querySelector('[data-label="untested"]'), null);
  assert.ok(!says(panel(p), "ai.label.untested"));
});
