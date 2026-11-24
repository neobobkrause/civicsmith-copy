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

export { V, NOW, PROFILE, saved, R };
export const SEAL = "answers-test-seal-secret-0123456789abcdef";

/** bob and carol members, alice an administrator; answers built with every owner; the rule services on unless `off`. */
export function answersWorld({ rules = true, deps: more = {}, ...opts } = {}) {
  const w = seeded(opts);
  w.lines = linesOf(w.host, { record: w.record });
  w.credentials = credentialsOf(w.host, { record: w.record, membership: w.membership, sealSecret: SEAL });
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
  w.at = (iso) => { w.clock.now = iso; w.clock.ms = Date.parse(iso); };
  return w;
}

/** A well-formed answer, its fields overridden. */
export function answer(over = {}) {
  return { question_as_read: "what did the record say?", clarifying: null, summary: null, sentences: [], holdings: [],
           rules: [], looks: [], bound: null, truncated: false, out_of_view: false, lens: null, not_established: [],
           query: null, next_acts: [], label: "machine work", ...over };
}
