/* agent-steps — PROVIDER NOTICES agent-harness:353 and agent-model:395 (T53).
 *
 * agent-harness:353 — `publishableState` (its R23) now refuses a state that holds a provider's session, response,
 * conversation or continuation id (`STATE_HOLDS_PROVIDER_STATE`) instead of answering a state. This module's segment
 * (R14, R15, R55) publishes the table's state at each resumable tick through it; a refusal there would otherwise be sent
 * as `state: undefined` and dropped without a word, so drive.mjs now names it in `refusals` (at `airuntick.state`) and
 * publishes no state. Here: over an adapter that answers session, conversation and response ids, every tick that
 * publishes a state publishes one free of them, and no tick of the run loses its state to that refusal.
 *
 * agent-model:395 — the provider door (`converse` with an entry, `checkFinal` R18, role `subsession` R19, the neutral
 * usage R6). This module's sub-sessions hand a refused report back once through it (R22) and keep each conversation's
 * usage entry (R14, R26, R47). Here, over agent-model's real provider and its wire fixtures (t53-world.mjs). */
import { segment, account, answers, reading } from "./t53-world.mjs";
import { providerStateKey } from "../../agent-harness/src/harness.mjs";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass += 1; else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

console.log("\n--- agent-harness:353 · the published state holds no provider state, and is never dropped silently ---");
{
  const held = { session_id: "sess-PROVIDER-HELD", conversation_id: "conv-PROVIDER-HELD", previous_response_id: "resp-PROVIDER-HELD" };
  const r = await segment({ acct: account({ entries: ["gen-one"] }), remoteCfg: { answer: answers(), extra: held } });
  const states = r.rec.ticks.filter((k) => k.state).map((k) => k.state);
  t("R55: the run publishes states at its resumable ticks", states.length > 0, true);
  t("R55, agent-harness R23: no published state holds a key shaped as provider-held state", states.map(providerStateKey).filter((k) => k !== null), []);
  t("R15, agent-harness R23: no tick's state was refused STATE_HOLDS_PROVIDER_STATE", (r.out.refusals || []).filter((x) => x?.at === "airuntick.state"), []);
  t("R55 (control): the run still ends by the table, no refusal", [r.refusal, r.out.ended?.by ?? null], [null, "the table"]);
}

console.log("\n--- agent-model:395 · a sub-session's report is held to the report contract through the provider's checkFinal ---");
{
  /* each level's first report is over the summary bound; its second is within it */
  const seen = {};
  const handBack = (long) => (ctx) => {
    if (ctx.final === "report") {
      seen[ctx.level] = (seen[ctx.level] || 0) + 1;
      const first = seen[ctx.level] === 1;
      return { state: "LOOKED_INDETERMINATE", summary: "s".repeat(first || long ? 700 : 300), citations: [] };
    }
    return answers()(ctx);
  };
  const r = await segment({ acct: account({ entries: ["gen-one"] }), remoteCfg: { answer: handBack(false) } });
  const refused = r.out.reportsRefused || r.out.reports_refused || [];
  t("R22 (agent-model R18): a 700-character report is handed back once and the 300-character rewrite is taken, at every level",
    [Object.values(seen).every((n) => n === 2), Object.keys(seen).length, refused.length], [true, 4, 0]);
  const reports = r.requests.filter((q) => q.final === "report");
  t("R22: the hand-back carries the refusal's code to the model", reports.some((q) => JSON.stringify(q.body).includes("REPORT_OVER_BOUND")), true);

  for (const k of Object.keys(seen)) delete seen[k];
  const two = await segment({ acct: account({ entries: ["gen-one"] }), remoteCfg: { answer: handBack(true) } });
  const refusedTwo = two.out.reportsRefused || two.out.reports_refused || [];
  t("R22 (control): two over-bound reports leave each level refused REPORT_OVER_BOUND, never an absence",
    [refusedTwo.length, [...new Set(refusedTwo.map((x) => x.code))]], [4, ["REPORT_OVER_BOUND"]]);
}

console.log("\n--- agent-model:395 · each conversation's usage is the neutral record, one entry per conversation ---");
{
  const r = await segment({ acct: account({ entries: ["gen-one"] }), remoteCfg: { answer: reading("LOOKED_INDETERMINATE") } });
  const usage = r.rec.ticks.flatMap((k) => (Array.isArray(k.usage) ? k.usage : []));
  t("R14, R47: every usage entry carries exactly mode, entry_id, label, usage, calls",
    [...new Set(usage.map((e) => JSON.stringify(Object.keys(e))))], [JSON.stringify(["mode", "entry_id", "label", "usage", "calls"])]);
  t("R14: one entry per conversation that reached the provider (plan, four sub-sessions, compose, dedup)", usage.length, 7);
  t("R26: each entry names the entry converse answered", [...new Set(usage.map((e) => e.entry_id))], ["gen-one"]);
  t("R14 (control): each usage is agent-model's record passed through: every figure a finite number, a stated record or null, none missing",
    usage.every((e) => e.usage && typeof e.usage === "object" && Object.values(e.usage).every((v) =>
      v === null || (typeof v === "number" && Number.isFinite(v)) || typeof v === "string" || typeof v === "object")), true);
}

console.log(`\nnotice agent-harness:353, agent-model:395: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
