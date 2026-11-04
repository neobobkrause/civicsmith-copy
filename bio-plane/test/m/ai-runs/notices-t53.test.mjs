/* ai-runs' answers to its providers' T53 notices: ai-use:105 (useCheck judges a provider limit standing on the account
   or entry an act is served on, ai-use R3, R18), ai-accounts:124 (the compatibility seam beside the T53 interface),
   ai-accounts:188 (a member's own account added through the door's stamping) and ai-catalogue:194 (the release seed,
   the build's keys), each at this module's interface over the real modules (./world.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, PROJ, T0, ENTRY, ENTRIES, PLANS, HOSTS, agentWorker } from "./world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { aiCatalogueOf, RELEASE_SEED } from "../../../src/ai-catalogue/index.mjs";

const ACCEPT = { status: 202, body: { accepted: true, run_id: "R1" } };
const STORE = { idFromName: (n) => `id:${n}` };
const ANN = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
const TICK = { caller: "member:ann", viewer: "member:ann", actor: "member:ann" };
const at = (m) => new Date(Date.parse(T0) + m * 60000).toISOString().replace(/\.\d+Z$/, "Z");
const LATER = "2026-07-02T00:00:00Z";

/** ann's own run R1 over her project, dispatched once on the head of her `own` accounts (each holding claude-a). */
async function annWorld({ own = 2 } = {}) {
  const aw = agentWorker(ACCEPT);
  const w = world({ env: { AGENT_WORKER: aw, STORE, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann"] });
  for (let i = 0; i < own; i++) await w.account("ann", "apikey", `secret-${i}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.project(PROJ, "ann");
  return { w, aw };
}
const openR = (w, run = "R1") => w.runs.open(OPEN({ run, contextType: "project", contextId: PROJ, at: T0, ...ANN }));
const limitOn = (w, account_id) => aiUseOf(w.ctx).recordProviderLimit({ owner: "member:ann", account_id, entry_id: ENTRIES.a,
  kind: "spend", scope: "account", resets_at: LATER, at: T0 });

test("notice ai-use:105 (ai-use R3, R18; R52): a provider limit standing on the account a run is served on holds its open and its tick back (AI_LIMIT_REACHED, source provider), nothing written; control: one standing on the member's other account holds neither", async () => {
  const { w } = await annWorld();
  const [head, other] = w.accountsOf("member:ann");
  assert.equal((await w.served("ann", { project: PROJ })).account_id, head, "the head serves her act");
  /* control: a limit on her other account leaves the open and the tick on the head */
  assert.equal(limitOn(w, other).ok, true);
  const o = await openR(w);
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(1), usage: [ENTRY()] }).ticked, true);
  /* the head's own provider limit: the tick (served on the head's segment) and a new open are held back */
  assert.equal(limitOn(w, head).ok, true);
  const before = w.dump();
  const t = w.runs.tick({ run: "R1", ...TICK, at: at(2) });
  assert.deepEqual([t.ticked, t.code, t.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(t).slice(0, 300));
  const o2 = await openR(w, "R2");
  assert.deepEqual([o2.started, o2.code, o2.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(o2).slice(0, 300));
  assert.equal(w.dump(), before, "nothing written on either refusal");
  /* after the provider's reset the run goes on */
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: "2026-07-02T00:01:00Z" }).ticked, true);
});

test("notice ai-accounts:124 (ai-accounts F1 seam): ai-runs reads the T53 interface only — the account a run is served on is the one ai-accounts' accountFor answers for her act, and none of the seam's deprecated names is called on an open, a dispatch or a tick", async () => {
  const { w, aw } = await annWorld({ own: 1 });
  const called = [];
  for (const name of ["accountReferenceSet", "accountReferenceState", "accountReferenceRemove", "groupKeySet", "groupKeyState",
                      "groupKeySwitch", "groupKeySwitches", "groupKeyNoticeSeen", "projectKeySet", "projectAccountState",
                      "subscriptionTokenHold", "subscriptionConnected", "accountUsesOf"]) {
    assert.equal(typeof w.aiAccounts[name], "function", `${name} is in the seam`);
    const real = w.aiAccounts[name].bind(w.aiAccounts);
    w.aiAccounts[name] = (...a) => { called.push(name); return real(...a); };
  }
  const served = await w.served("ann", { project: PROJ });
  assert.equal((await openR(w)).started, true);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(1), usage: [ENTRY()] }).ticked, true);
  const seg = w.row(`SELECT account_id, owner, level FROM ai_run_segments WHERE run = 'R1' AND n = 1`);
  assert.deepEqual({ ...seg }, { account_id: served.account_id, owner: served.owner, level: served.level });
  assert.equal(aw.calls[0].body.account.account_id, served.account_id);
  assert.deepEqual(called, [], "no deprecated name is read");
});

test("notice ai-accounts:188 (ai-accounts F2): a member's own account added through the door's op with by stamped member:ann is hers and serves her run — principal_ai member:ann; control: with no account she is refused AI_NO_ACCOUNT", async () => {
  const w = world();
  await w.group("ann", { noAccount: ["ann"] });
  w.project(PROJ, "ann");
  const none = await openR(w);
  assert.deepEqual([none.started, none.code], [false, "AI_NO_ACCOUNT"]);
  const url = new URL(`http://do/aiownadd?${new URLSearchParams({ by: "member:ann" })}`);
  const set = await aiAccountsOps(w.aiAccounts, url, { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed",
    secret: "secret-of-ann-through-the-door-0123" }, { VERSION: "test" }).aiownadd();
  assert.deepEqual([set.ok, set.owner], [true, "member:ann"], JSON.stringify(set).slice(0, 300));
  assert.equal(w.aiAccounts.accountSwitch({ account_id: set.account_id, on: true, by: "ann" }).ok, true);
  w.aiAccounts.recipientNoticeSeen({ member: "ann", provider: PLANS.provider, host: HOSTS.main, by: "ann" });
  const o = await openR(w);
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  assert.deepEqual({ ...w.row(`SELECT principal_ai, principal_ai_ref FROM ai_runs WHERE run = 'R1'`) },
                   { principal_ai: "member:ann", principal_ai_ref: "member:ann" });
});

test("notice ai-catalogue:194 (ai-catalogue R39; R104): a usage label is judged against the display name the catalogue's entryOf answers, so an entry the catalogue holds counts and one it does not (the release seed offers none) is AI_RUN_CONSUME_INVALID with nothing counted", async () => {
  assert.equal(JSON.parse(RELEASE_SEED.body).entries.length, 0, "the release seed lists no entry");
  const { w } = await annWorld({ own: 1 });
  assert.equal((await openR(w)).started, true);
  assert.equal((await w.runs.dispatchMemberRun({ run: "R1", by: "member:ann", at: T0 })).dispatched, true);
  const shown = aiCatalogueOf(w.ctx).entryOf(ENTRIES.a).display_name;
  assert.equal(typeof shown, "string");
  assert.equal(w.runs.tick({ run: "R1", ...TICK, at: at(1), usage: [ENTRY()] }).ticked, true);
  const before = w.dump();
  const unknown = w.runs.tick({ run: "R1", ...TICK, at: at(2),
    usage: [{ ...ENTRY(), entry_id: "not-in-the-catalogue", label: { ...ENTRY().label, display_name: shown } }] });
  assert.deepEqual([unknown.ticked, unknown.code], [false, "AI_RUN_CONSUME_INVALID"], JSON.stringify(unknown).slice(0, 300));
  assert.equal(w.dump(), before, "nothing counted or written");
});
