/* answers over the modules it uses: calculations' test world (the real record-core, membership, promotion, content,
   retrieval, entities, events, standards, money, duties, lines, people and calculations on a real SQLite database at the
   plane's storage shape), with the real credentials and ai-accounts beside them (credentials' factory creates
   ai-accounts' one instance with the seal secret, as the composition root does), and answers built over them as the
   composition root would: its `accounts` dep ai-accounts (T48-36), its `credentials` dep only for the standing grant. The paying account's limits are the real `ai-use.useCheck` (its R3; R30), watched so a test sees what was
   asked of it; `reach(owner, use)` brings an account to a one-call monthly limit as a use would, and `unreach` removes it.
   The standing answerer is a provider the test controls, at the interface its requirements state (J1 (5)).
   Every test drives `answers` at its interface. */
import { seeded, V, NOW, PROFILE, saved, R } from "../calculations/fixture.mjs";
import { linesOf } from "../../../src/lines/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { answersOf } from "../../../src/answers/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { catalogueFor, PLANS, HOSTS } from "../ai-accounts/catalogue.mjs";

export { V, NOW, PROFILE, saved, R, PLANS };
export const SEAL = "answers-test-seal-secret-0123456789abcdef";

/** bob and carol members, alice an administrator; answers built with every owner; the rule services on unless `off`. */
export function answersWorld({ rules = true, deps: more = {}, ...opts } = {}) {
  const w = seeded(opts);
  w.lines = linesOf(w.host, { record: w.record });
  /* (T53) ai-accounts' accounts are of ai-catalogue's plans: the real catalogue, seeded from ai-catalogue's published
     fixture (through ai-accounts' `catalogueFor`, as credentials' world takes it), handed on through credentials' factory */
  w.catalogue = catalogueFor(w.host, { record: w.record });
  w.ready = w.catalogue.seeded;
  w.credentials = credentialsOf(w.host, { record: w.record, membership: w.membership, sealSecret: SEAL, catalogue: w.catalogue });
  w.credentials.migrate();
  w.accounts = aiAccountsOf(w.host);
  if (w.accounts !== w.credentials.accounts) throw new Error("fixture: ai-accounts is not the one instance on this host");
  w.aiUse = aiUseOf(w.host, { record: w.record, membership: w.membership, credentials: w.credentials });
  w.limit = { asked: [] };
  w.useCheck = (a) => { w.limit.asked.push(a); return w.aiUse.useCheck(a); };
  const who = (owner) => (owner === "group" ? V("alice") : owner.startsWith("member:") ? V(owner.slice(7)) : V("carol"));
  w.reach = (owner, use) => {
    const set = w.aiUse.aiLimitSet({ owner, scope: use, unit: "calls", period: "month", amount: 1, by: who(owner) });
    if (!set.ok) throw new Error(`fixture limit refused: ${JSON.stringify(set)}`);
    w.aiUse.countUsage({ owner, member: "bob", use, mode: use, calls: 1, at: w.clock.now,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null } });
    const r = w.aiUse.useCheck({ owner, member: "bob", use, at: w.clock.now });
    if (!r || r.code !== "AI_LIMIT_REACHED") throw new Error(`fixture limit not reached: ${JSON.stringify(r)}`);
    return r;
  };
  w.unreach = (owner, use) => w.aiUse.aiLimitSet({ owner, scope: use, unit: "calls", period: "month", amount: null, by: who(owner) });
  w.deps = { record: w.record, membership: w.membership, standards: w.standards, content: w.content, events: w.events,
    entities: w.entities, lines: w.lines, people: w.people, duties: w.duties, calculations: w.c, retrieval: w.retrieval,
    accounts: w.accounts, credentials: w.credentials, now: () => w.clock.now,
    useCheck: (a) => w.useCheck(a), ...more };
  w.a = answersOf(w.host, w.deps);
  /* the plane makes every module's tables at boot; here retrieval's zone (its R69) meets local-facts on its first read,
     so it is read once now, before any test takes its snapshot */
  w.retrieval.zone();
  if (rules) w.record.setSetting("answers_rule_services", true, "admin");
  /* (T53) accounts through ai-accounts' own acts (its R40, R5, R10, R51): a member's own API account, the team's, or a
     project's, its key sealed, switched on, the member's recipient notice for its host seen; answers its `account_id`.
     `uses(account_id, switch, on, by)` sets one of its R14 switches. */
  const on = async (set, by, member) => {
    if (!set.ok) throw new Error(`fixture account refused: ${JSON.stringify(set)}`);
    const sw = w.accounts.accountSwitch({ account_id: set.account_id, on: true, by });
    if (!sw.ok) throw new Error(`fixture account switch refused: ${JSON.stringify(sw)}`);
    if (member) w.seen(member);
    return set.account_id;
  };
  w.seen = (member) => {
    const r = w.accounts.recipientNoticeSeen({ member, provider: PLANS.provider, host: HOSTS.main, by: member });
    if (!r.ok) throw new Error(`fixture notice refused: ${JSON.stringify(r)}`);
  };
  w.ownAccount = async (member, { secret = `sk-${member}` } = {}) => {
    await w.ready;
    return on(await w.accounts.accountSet({ owner: `member:${member}`, provider: PLANS.provider, plan: PLANS.memberApi,
                                           means: "sealed", secret, by: member }), member, member);
  };
  w.teamAccount = async ({ secret = "sk-team", by = "alice" } = {}) => {
    await w.ready;
    return on(await w.accounts.accountSet({ owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed",
                                           secret, by }), by, null);
  };
  w.projectAccount = async (project, owner, { secret = "sk-project" } = {}) => {
    await w.ready;
    return on(await w.accounts.accountSet({ owner: `project:${project}`, provider: PLANS.provider, plan: PLANS.teamApi,
                                           means: "sealed", secret, by: owner }), owner, owner);
  };
  w.uses = (account_id, name, value, by) => w.accounts.accountUsesSet({ account_id, switch: name, on: value, by });
  w.at = (iso) => { w.clock.now = iso; w.clock.ms = Date.parse(iso); };
  return w;
}

/** A well-formed answer, its fields overridden. */
export function answer(over = {}) {
  return { question_as_read: "what did the record say?", clarifying: null, summary: null, sentences: [], holdings: [],
           rules: [], looks: [], bound: null, truncated: false, out_of_view: false, lens: null, not_established: [],
           query: null, next_acts: [], label: "machine work", ...over };
}
