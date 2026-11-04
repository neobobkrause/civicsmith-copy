/* Provider notice ai-runs:213 (T53; ai-runs R52, ai-use R3, R18; ai-runs PR 213): ai-runs' open now tells ai-use's
   useCheck the account and entry the run is served on, so a provider limit standing on that account holds the open back
   (AI_LIMIT_REACHED, source provider) and one on the member's other account does not. Intent's R18 opens its run
   through ai-runs' `open` and relays the answer whole, so a member's run on an objective is held back by a limit on the
   account serving it, with nothing opened and intent's answer still naming the project; a limit on another account
   leaves the open alone. No code change in intent: this confirms R18 over the real ai-runs and ai-use. */
import test from "node:test";
import assert from "node:assert/strict";
import { intentOf } from "../../../src/intent/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { progressionsOf } from "../../../src/progressions/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { homeOfEmpty } from "../provenance/fixtures.mjs";
import { world as runsWorld, PROJ, T0, ENTRIES } from "../ai-runs/world.mjs";

const LATER = "2026-07-02T00:00:00Z";

/** ann's project, ann holding two accounts of her own (each with the catalogue's entry a), intent over the real ai-runs. */
async function setUp() {
  const r = runsWorld();
  await r.group("ann", "bob", { noAccount: ["ann"] });
  for (let n = 0; n < 2; n++) await r.account("ann", "apikey", `secret-${n}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  const proj = r.project(PROJ, "ann");
  const i = intentOf(r.ctx, { record: r.record, membership: r.membership, promotion: r.promotion, aiRuns: r.runs,
    entities: entitiesOf(r.ctx, { record: r.record, membership: r.membership, provenance: {} }),
    progressions: progressionsOf(r.ctx, { record: r.record, provenance: homeOfEmpty() }), now: () => T0 });
  i.migrate();
  return { r, i, proj };
}

const work = (i, proj, run) => i.workObjective({ project: proj, reason: "Find the award records.", author: "member:ann",
  viewer: "member:ann", run: { run, principalPlane: "member:ann", principalAi: "member:ann", skillVersion: "bio@1",
                              bounds: [{ bound: "fetches", allowed: 10 }], at: T0 } });
const limitOn = (r, account_id) => aiUseOf(r.ctx).recordProviderLimit({ owner: "member:ann", account_id,
  entry_id: ENTRIES.a, kind: "spend", scope: "account", resets_at: LATER, at: T0 });

test("notice ai-runs:213 R18 workObjective is held back by a provider limit on the account serving the run (AI_LIMIT_REACHED, source provider), relayed with the project and no run opened; control: a limit on the member's other account leaves it opening", async () => {
  const { r, i, proj } = await setUp();
  const [head, other] = r.accountsOf("member:ann");
  assert.equal((await r.served("ann", { project: PROJ })).account_id, head, "the head serves her act");
  /* control: a limit on the account that does not serve her run leaves the open alone */
  assert.equal(limitOn(r, other).ok, true);
  const opened = await work(i, proj, "R-OBJ-1");
  assert.equal(opened.started, true, JSON.stringify(opened).slice(0, 300));
  assert.equal(opened.project, proj);
  /* the serving account's own provider limit: intent's open is refused as ai-runs answers it */
  assert.equal(limitOn(r, head).ok, true);
  const held = await work(i, proj, "R-OBJ-2");
  assert.deepEqual([held.started, held.code, held.source], [false, "AI_LIMIT_REACHED", "provider"],
                   JSON.stringify(held).slice(0, 300));
  assert.equal(held.project, proj, "intent's answer still names the project");
  assert.equal((await r.runs.read({ run: "R-OBJ-2", viewer: "member:ann" })).found, false, "no run was opened");
});
