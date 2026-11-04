/* store-request R7 door case for ai-accounts R38 (STORE-REQUEST #5, B14; AI-ACCOUNTS #7 J7 report 3; T53: `aiownadd`, `accountsof`, `aiaccountremove`, R35's ops retired): the
   member is the stamp. A member sets, reads and removes their own AI account through the world's door with a body naming no member; a body naming another member acts on
   the caller's own account only. Needs the assembled plane's ai-accounts to hold a catalogue and ai-accounts F2 (PR 187). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld, WORLD_TOKENS } from "./fixtures.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";

const caps = { capabilities: ["contribute"] };
const KEY = "sk-ant-api03-" + "k".repeat(40);

async function ready(as) {
  const d = await as.read("disclosureof", { query: { member: "member:" + as.member } });
  await as.act("disclosureshown", { body: { member: "member:" + as.member, version: d.version } });
  await as.act("reauth", { body: { password: as.password } });
}

const own = async (as) => (await as.read("accountsof", { query: { owner: `member:${as.member}` } })).accounts ?? [];
const add = (as, body) => as.act("aiownadd", { body: { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", ...body } });

test("R7 (ai-accounts R38): a member sets, reads and removes their own reference with a body naming no member; control: a body naming another member acts on the caller's own reference only", async () => {
  const w = await storeWorld({ ai: true });
  const ann = await w.signIn("ann", caps);
  const bo = await w.signIn("bo", caps);
  await ready(ann); await ready(bo);
  assert.equal((await own(ann)).length, 0);
  const set = await add(ann, { secret: KEY });
  assert.equal(set.ok, true);
  assert.deepEqual((await own(ann)).map((a) => a.account_id), [set.account_id], "ann's account is held");
  assert.equal((await own(bo)).length, 0, "bo's is not");
  /* control: bo names ann; it is bo's own account that is set, and ann's is untouched */
  const bos = await add(bo, { owner: "member:ann", member: "member:ann", secret: KEY + "2" });
  assert.deepEqual((await own(bo)).map((a) => a.account_id), [bos.account_id], "bo's own account is set");
  assert.deepEqual((await own(ann)).map((a) => a.account_id), [set.account_id], "ann's is not touched by bo");
  /* control: bo cannot remove ann's account; his own goes */
  await assert.rejects(bo.act("aiaccountremove", { body: { account_id: set.account_id } }), /aiaccountremove was refused/);
  assert.equal((await bo.act("aiaccountremove", { body: { account_id: bos.account_id } })).ok, true);
  assert.equal((await own(bo)).length, 0, "bo's own is removed");
  assert.equal((await own(ann)).length, 1, "ann's is not touched by bo");
  assert.equal((await ann.act("aiaccountremove", { body: { account_id: set.account_id } })).ok, true);
  assert.equal((await own(ann)).length, 0);
  /* control: a machine credential is refused (the door's class gate answers before the owner's MACHINE_CANNOT_HOLD_ACCOUNT, which ai-accounts' own test holds) */
  const machine = await w.door({ url: "/api/?op=aiownadd", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: KEY }) } }, { token: WORLD_TOKENS.ADMIN_TOKEN });
  assert.equal(machine.json.reason, "CLASS_FORBIDDEN", JSON.stringify(machine.json));
  assert.equal((await own(ann)).length, 0, "nothing was set for anyone");
});
