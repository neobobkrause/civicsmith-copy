/* Provider notice answers:197 (PR 197; answers R19, R30 over ai-use:105 and ai-accounts:124, :188): `askAccount` now
   names the account `accountFor` chose and its entry to `ai-use.useCheck`, so a provider limit standing on that account
   (ai-use R18) refuses the use as the paying account's own limits do; and `ownerOf` takes the owner a T53 account names.
   The door reads both: `askceiling` and the three drafts' gate relay `askAccount`'s answer (R10, R11), and `askusage`
   counts to `ownerOf` of `accountFor`'s answer (R11). Confirmed with no code change: over a real record, a member's own
   account added through ai-accounts' own arm, a provider limit recorded by ai-use's own code on that account refuses the
   ask's ceiling and a draft at the door with ai-use's refusal unchanged (askceiling answers it as given, a draft's
   handler is never reached, writinghelp is handed it as `assistant.refusal`); one on another account bears on nothing;
   and `askusage` counts to the owner the account names. Fails with PR 197's answers/index.mjs put back. */
import { test } from "node:test";
import assert from "node:assert/strict";
const { record } = await import("./record.mjs");
const { credentialsOf } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf, aiAccountsOps } = await import("../../../src/ai-accounts/index.mjs");
const { aiUseOf } = await import("../../../src/ai-use/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");
const { instanceSetupOf } = await import("../../../src/setup.mjs");
const { wizardScriptsOf } = await import("../../../src/wizard-scripts/index.mjs");
const { answersOf } = await import("../../../src/answers/index.mjs");
const { innerRequest } = await import("../../../src/store-request/index.mjs");
const { resolveSession } = await import("../../../src/admission/index.mjs");
const { PLANS } = await import("../ai-accounts/catalogue.mjs");

const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
function stamped(op, id) {
  const caller = { cls: "member", viaSession: true, token: "t", ...resolveSession({ role: `member:${id}` }) };
  const s = innerRequest({ op, url: new URL(`https://plane.test/?op=${op}`), method: "POST", body: "{}", caller });
  assert.equal(s.refusal, undefined, JSON.stringify(s.refusal));
  return new URL(String(s.url));
}

test("notice answers:197 (store-door R10, R11): a provider limit on the member's own account refuses `askceiling` and a draft at the door with ai-use's AI_LIMIT_REACHED (source provider) as given — the draft's handler never reached, writinghelp handed it as assistant.refusal — and `askusage` counts to the owner the account names (control: a limit on another account bears on nothing)", async () => {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00197" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx), AA = aiAccountsOf(r.ctx), U = aiUseOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  const a = await mb.memberAdd({ memberId: "ann", cover: "cover of ann", role: "admin", capabilities: null, by: "admin" });
  assert.equal(a.ok, true, JSON.stringify(a));
  await mb.enroll({ invite: a.invite, handle: "ann", password: "ann-passphrase-x" });
  assert.equal(C.aiKeepAwaySet({ on: false, by: "ann" }).ok, true);

  const set = await aiAccountsOps(AA, stamped("aiownadd", "ann"), { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-ann-own-0197-0123456789abcdef" }, { VERSION: "test-build" }).aiownadd();
  assert.deepEqual([set.ok, set.owner], [true, "member:ann"], JSON.stringify(set));
  const sw = await aiAccountsOps(AA, stamped("aiaccountswitch", "ann"), { account_id: set.account_id, on: true }, { VERSION: "test-build" }).aiaccountswitch();
  assert.equal(sw.ok, true, JSON.stringify(sw));

  const drafted = [], helped = [];
  instanceSetupOf(r.ctx).groupDescriptionDraft = (args) => { drafted.push(args.assistant); return { ok: false, reason: "ASSISTANT_DRAFT_UNAVAILABLE" }; };
  const W = wizardScriptsOf(r.ctx);
  W.writingHelp = (args) => { helped.push(args.assistant); return { ok: false, reason: "WRITING_HELP_SEEN" }; };
  const ceiling = async () => (await r.go("askceiling?viewer=member:ann", "POST", {})).json.result;
  const draft = async () => (await r.go("groupdescriptiondraft?by=member:ann&viewer=member:ann", "POST", { answers: [{ question: "Who are you?", text: "Tenants" }] })).json.result;
  const help = async () => (await r.go("writinghelp?by=member:ann&viewer=member:ann", "POST", { op: "groupdescriptiondraft", field: "answers", told: "Tenants" })).json.result;
  const limit = (account_id) => {
    const l = U.recordProviderLimit({ owner: "member:ann", account_id, entry_id: null, kind: "quota", scope: "account", resets_at: "2099-01-01T00:00:00Z" });
    assert.equal(l.ok, true, JSON.stringify(l));
  };

  /* the paying owner is the one the T53 account names */
  const usage = await r.go("askusage?viewer=member:ann", "POST", { mode: "ask", usage: USE, calls: 1 });
  assert.equal(usage.json.result.owner, set.owner, JSON.stringify(usage.json));

  /* control: no limit, and a limit on some other account, bear on nothing */
  assert.deepEqual(await ceiling(), { ok: true });
  limit("acct-elsewhere-0197");
  assert.deepEqual(await ceiling(), { ok: true });
  assert.equal((await draft()).reason, "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.equal(drafted.length, 1);

  limit(set.account_id);
  const refused = await ceiling();
  assert.deepEqual([refused.ok, refused.code, refused.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(refused));
  assert.deepEqual(refused, await answersOf(r.ctx).askAccount({ member: "member:ann", kind: "ask" }), "askceiling answers askAccount's refusal as given");

  const d = await draft();
  assert.deepEqual([d.ok, d.code, d.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(d));
  assert.equal(drafted.length, 1, "the draft's handler is not reached under the limit");

  assert.equal((await help()).reason, "WRITING_HELP_SEEN");
  assert.equal(helped.length, 1);
  assert.deepEqual([helped[0].account, helped[0].refusal?.code, helped[0].refusal?.source], [null, "AI_LIMIT_REACHED", "provider"], JSON.stringify(helped));
  assert.equal(JSON.stringify([refused, d, helped]).includes("sk-ann-own-0197"), false, "no key in any answer");
});
