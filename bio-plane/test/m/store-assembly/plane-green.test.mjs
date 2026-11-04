/* store-assembly R1, R40 (the coordinator's reopening, 4 Nov: plane's t48 R55 and t50 R63 move to a T53 account in the
   assembled store). Two seams those tests stand on, each driven over the real assembled store with no catalogue handed in by
   the test: (1) the assembly hands ai-accounts the object's own ai-catalogue, so a member's own T53 account set through the
   store's door (`aiownadd`) answers ok, not CATALOGUE_UNAVAILABLE; (2) the ask door's gate asks `ai-runs.partAdmitted(part,
   entry)` as ai-runs declares it (its R78) on the entry of the account that serves the member, so an ask part is admitted
   there. The list is ai-catalogue's published fixture, seeded through the assembled catalogue's own channel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, assembleStore, disclosed, admitPart } from "./fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { servingEntry, admitOn } from "../../../src/store-assembly/ask.mjs";
import { catalogueFor, PLANS, ENTRIES, HOSTS } from "../ai-accounts/catalogue.mjs";
import { KEY } from "../ai-catalogue/fixture.mjs";

const SEAL = "a-long-seal-secret-for-the-plane-green-test";
const ENV = { CIVICSMITH_TEST_INSTANCE: "t-green", INSTANCE_NAME: "t-green", STORE: { idFromName: (n) => n }, ACCOUNT_SEAL_SECRET: SEAL };

async function plane() {
  const st = storage();
  const s = assembleStore(st.ctx, ENV, { catalogueKeys: [KEY.line] });
  for (const p of st.blocked) await p;
  for (const [id, role] of [["ada", "admin"], ["ann", "member"]])
    st.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                             VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  await catalogueFor(st.ctx, { record: recordOf(st.ctx) }).seeded;   /* the assembled catalogue's own loadSeed */
  await disclosed(st.ctx);   /* R35: the disclosure shown to ann, as an account act asks first */
  const door = async (path, body) => {
    const r = await s.dispatch(new Request(`http://do/${path}`, { method: "POST", body: JSON.stringify(body) }));
    const b = await r.json();
    return b.result ?? b;
  };
  /* ann's own T53 account through the store's door: set, switched on, and its recipient's notice seen (ai-accounts R38, R51) */
  const own = async () => {
    const set = await door("aiownadd?by=member:ann&viewer=member:ann",
      { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-ant-zz-ann-0123456789" });
    if (set.ok !== true) return set;
    const on = await door("aiaccountswitch?by=member:ann&viewer=member:ann", { account_id: set.account_id, on: true });
    assert.equal(on.ok, true, JSON.stringify(on));
    const seen = await door("aisend?by=member:ann&viewer=member:ann", { provider: PLANS.provider, host: HOSTS.main });
    assert.equal(seen.ok, true, JSON.stringify(seen));
    return set;
  };
  return { ctx: st.ctx, s, own };
}

test("R1 (ai-accounts R40, R63; plane t48 R55, t50 R63): a member's own T53 account set through the assembled store's door (`aiownadd`) answers ok on the object's own catalogue, and serves the member's ask; control: before it, no account serves", async () => {
  const x = await plane();
  assert.equal(servingEntry(x.ctx, { member: "member:ann", use: "ask" }), null, "control: no account yet");
  const r = await x.own();
  assert.notEqual(r.reason, "CATALOGUE_UNAVAILABLE", JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r));
  const serving = aiAccountsOf(x.ctx).accountServing({ member: "member:ann", use: "ask", project: null });
  assert.ok(serving && !serving.refusal, JSON.stringify(serving));
  assert.ok([ENTRIES.a, ENTRIES.b].includes(serving.entry_id), JSON.stringify(serving));
});

test("R40 (ai-runs R78; plane t48 R55): an ask part is admitted through `ai-runs.partAdmitted(part, entry)` on the entry of the member's T53 account, as ai-runs answers it (the test-instance label carried); and once the entry holds its own passing Gate 1 verdict it is admitted on that verdict, unlabelled; control: a part ai-runs does not admit is refused", async () => {
  const x = await plane();
  assert.equal((await x.own()).ok, true);
  const entry = servingEntry(x.ctx, { member: "member:ann", use: "ask" });
  assert.equal(typeof entry, "string", "the serving account's entry");
  const said = aiRunsOf(x.ctx, ENV).partAdmitted("ask", entry);
  assert.equal(said.admitted, true, JSON.stringify(said));
  const a = admitOn(x.ctx, ENV, "ask", entry);
  assert.equal(a.refusal, null, JSON.stringify(a));
  assert.deepEqual(a.untested, said.untested, "the label is ai-runs' own");
  assert.notEqual(a.untested, null, "admitted on the test-instance exception, labelled");
  /* the entry's own Gate 1 verdict (the fixture's throwaway records through ai-runs' one seam): admitted on it, so no
     test-instance label; asked without the entry it would fall back to the labelled exception */
  await admitPart(x.ctx, "ask");
  const onVerdict = admitOn(x.ctx, ENV, "ask", entry);
  assert.deepEqual(onVerdict, { refusal: null, untested: null }, JSON.stringify(onVerdict));
  /* control: a refusal from ai-runs' gate is answered as a refusal */
  const refused = admitOn(x.ctx, ENV, "no-such-part", entry);
  assert.notEqual(refused.refusal, null, JSON.stringify(refused));
});
