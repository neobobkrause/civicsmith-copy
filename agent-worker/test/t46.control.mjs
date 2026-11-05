/* T46-19's NEGATIVE CONTROL DRIVER (K874) for `t46.test.mjs`: each arm breaks the source in one place T46's ids (R6,
 * R30, R51, R72, R76, R79, R80) depend on, runs the suite, and requires it to FAIL, naming the requirement ids the
 * failing lines carry.
 *
 *     node test/t46.control.mjs          # every arm, in order
 *     node test/t46.control.mjs 3        # one arm
 *
 * DELIBERATELY NOT A `.test.mjs`: it edits real sources while it runs (cascade.control.mjs' rules): snapshots are held
 * in memory and written back in a `finally`, every restore is verified by sha256, and the suite's exit status is read
 * from `spawnSync().status`. `git checkout` is never used.
 */
import { TREE_TEST_DIR } from "./mutation-tree.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

/* K5245: the control breaks a copy of the tree, never the tracked one (mutation-tree.mjs). */
const DIR = TREE_TEST_DIR;
const MEMBER = join(DIR, "..");
const SUITE = join(DIR, "t46.test.mjs");
const INDEX = join(MEMBER, "src/index.mjs");
/* T51 (R119): the plan reads and the payer check are `agent-steps`'. */
const STEPS_DRIVE = join(MEMBER, "..", "agent-steps", "src/drive.mjs");
const STEPS_WORK = join(MEMBER, "..", "agent-steps", "src/work.mjs");
const TRANSCRIBE = join(MEMBER, "src/transcribe.mjs");
const DRAFTS = join(MEMBER, "src/action-drafts.mjs");
const UNTESTED = join(MEMBER, "src/untested.mjs");
const sha = (b) => createHash("sha256").update(b).digest("hex");

const ARMS = [
  { name: "a sign-in's suggestions true refused again", file: INDEX, ids: ["R6"],
    from: `|| (a.suggestions !== undefined && typeof a.suggestions !== "boolean")`,
    to: `|| (a.suggestions !== undefined && a.suggestions !== false)` },
  { name: "an account's suggestions switch not honoured (the layer never loadable)", ids: ["R6"],
    file: join(MEMBER, "src/ask.mjs"), from: `suggestions: account.suggestions });`, to: `suggestions: false });` },
  { name: "/version names a runner again", file: INDEX, ids: ["R30", "F2"], from: `model_turns: MODEL_TURNS });`, to: `model_turns: MODEL_TURNS, runner: true });` },
  { name: "the closing notes not counted in the read's trace", file: STEPS_WORK, ids: ["R51"],
    from: `const notes = [planDoc?.closed, ...earlier.map((p) => p?.closing_note)].filter(noted).length;`, to: `const notes = 0;` },
  { name: "the earlier plans (op=plans) not read", file: STEPS_WORK, ids: ["R51"],
    from: `const plans = await ask(PLAN_READS.plans(project));`, to: `const plans = null;` },
  { name: "a sign-in refused TRANSCRIBE_NEEDS_API_KEY", file: TRANSCRIBE, ids: ["R72"],
    from: `  const { account } = acct;\n`,
    to: `  const { account } = acct;\n  if (account.kind === "signin") return refusal("TRANSCRIBE_NEEDS_API_KEY", "no", 409);\n` },
  { name: "a status report's sources not held to the handed items", file: DRAFTS, ids: ["R76"],
    from: `|| !src.every((i) => Number.isInteger(i) && i >= 0 && i < task.items.length)) return null;`, to: `) return null;` },
  { name: "a status report taking a grant", file: DRAFTS, ids: ["R76"],
    from: `  if (grantSent && !draftMayRead({ kind: KIND_OF[task.op]`, to: `  if (grantSent && task.op !== "statusreportdraft" && !draftMayRead({ kind: KIND_OF[task.op]` },
  { name: "a status report's items not checked", file: DRAFTS, ids: ["R76"],
    from: `const isItems = (v) => Array.isArray(v) && v.length > 0 && v.every(isObject) && sized(v);`, to: `const isItems = (v) => true;` },
  { name: "the label dropped from /ask's answer event", file: join(MEMBER, "src/ask.mjs"), ids: ["R79"],
    from: `...(untested.label ? { untested: untested.label } : {}) });`, to: `});` },
  { name: "the label dropped from the drafts", file: join(MEMBER, "src/draft.mjs"), ids: ["R79"],
    from: `const labelled = untested.label ? { untested: untested.label } : {};`, to: `const labelled = {};` },
  { name: "any object taken as a label", file: UNTESTED, ids: ["R79"],
    from: `  if (!want) return { bad: true };`, to: `  if (!want) return { label: v };` },
  { name: "the payer check dropped for a sign-in", file: STEPS_DRIVE, ids: ["R80"],
    from: `if (account && recordedPayer !== account.member)`, to: `if (account && account.kind !== "signin" && recordedPayer !== account.member)` },
];

const pick = process.argv[2] ? [Number(process.argv[2])] : ARMS.map((_, i) => i + 1);
let bad = 0;
for (const n of pick) {
  const arm = ARMS[n - 1];
  const before = readFileSync(arm.file, "utf8");
  const hash = sha(before);
  if (before.split(arm.from).length !== 2) { console.log(`  ARM ${n} NOT ARMED: its anchor is not in the source once`); bad++; continue; }
  let out = "", status = null;
  try {
    writeFileSync(arm.file, before.replace(arm.from, arm.to));
    const r = spawnSync("node", [SUITE], { cwd: MEMBER, encoding: "utf8" });
    out = (r.stdout || "") + (r.stderr || ""); status = r.status;
  } finally {
    writeFileSync(arm.file, before);
    if (sha(readFileSync(arm.file, "utf8")) !== hash) { console.log(`  RESTORE FAILED for ${arm.file}`); process.exit(2); }
  }
  const failing = out.split("\n").filter((l) => l.startsWith("  FAIL"));
  const named = arm.ids.filter((id) => failing.some((l) => new RegExp(`\\b${id}\\b`).test(l)));
  const ok = status !== 0 && failing.length > 0 && named.length === arm.ids.length;
  console.log(`  ${ok ? "PASS" : "FAIL"}  arm ${n} (${arm.name}): the suite fails ${failing.length} line(s), naming ${named.join(", ") || "none"}`
    + (ok ? "" : ` (want every one of ${arm.ids.join(", ")})`));
  if (!ok) bad++;
}
console.log(`\nt46 control: ${pick.length - bad} pass, ${bad} fail`);
process.exit(bad ? 1 : 0);
