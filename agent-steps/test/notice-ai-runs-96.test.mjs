/* agent-steps — PROVIDER NOTICE ai-runs:96 (T53; ai-runs R72). ai-runs' tick now takes `usage` as a list of
 * `{mode, entry_id, label, usage, calls}` and refuses an entry naming no `entry_id`; before it, this module's model half
 * (R14, R26, R47) sent `{mode, model, effort, usage, calls}`. The entries `modelHalf` drains are ticked on ai-runs' own
 * test world (its real code, its catalogue fixture's entry and label, never hand-built here). Fails with plane.mjs's
 * `spent` put back as it was: the old entry names no `entry_id` and the real tick refuses it. */
import "../../bio-plane/test/sandbox.mjs";
import { world, OPEN, INQ, ORG, USAGE, LABEL, ENTRIES } from "../../bio-plane/test/m/ai-runs/world.mjs";
import { modelHalf } from "../src/index.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};

async function openRun() {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const opened = await w.runs.open(OPEN());
  if (opened?.started !== true) throw new Error(`ai-runs' world did not open R1: ${JSON.stringify(opened).slice(0, 300)}`);
  return w;
}
const tick = (w, usage) => w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, usage });

console.log("\n--- ai-runs:96 · the model half's usage entries are ai-runs' tick shape ---");
{
  const w = await openRun();
  const half = modelHalf({});
  /* two conversations, as a converse that answers its entry and label (agent-model R21, T53) ends them */
  half.spent({ usage: USAGE(), entry_id: ENTRIES.a, label: LABEL(ENTRIES.a), calls: 2 }, "check");
  half.spent({ usage: USAGE({ input_tokens: 10 }), entry_id: ENTRIES.a, label: LABEL(ENTRIES.a) }, "check");
  const usage = half.drain();
  t("R47: each entry carries exactly mode, entry_id, label, usage, calls", usage.map((e) => Object.keys(e)),
    [["mode", "entry_id", "label", "usage", "calls"], ["mode", "entry_id", "label", "usage", "calls"]]);
  const got = await tick(w, usage);
  t("R14: ai-runs' real tick takes them, and counts each conversation", [got.ticked, got.counted, got.code ?? null], [true, 2, null]);
}

console.log("\n--- ai-runs:96 (control) · an entry naming no entry_id is refused, never filled in here ---");
{
  const w = await openRun();
  const half = modelHalf({});
  half.spent({ usage: USAGE(), model: "model-claude-a", effort: "low", calls: 1 }, "check"); /* a pre-T53 converse's answer */
  const usage = half.drain();
  t("R47 (control): no entry_id or label is invented from the answered model", [usage[0].entry_id, usage[0].label, "model" in usage[0]], [null, null, false]);
  const got = await tick(w, usage);
  t("R15 (control): the real tick refuses it AI_RUN_CONSUME_INVALID, a refusal the segment records (R14)", [got.ticked, got.code], [false, "AI_RUN_CONSUME_INVALID"]);
}

console.log(`\nnotice ai-runs:96: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
