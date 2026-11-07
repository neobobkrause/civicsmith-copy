/* F4 (agent-drafts:358; R122, BR29) — A DRAFT'S LABEL AS IT IS NOW CARRIED, for the suites that drive `/draft`.
 *
 * The label is `{kind: "machine", ai}`, `ai` the label `agent-model`'s `converse` answered from the served identity,
 * absent where it answered none (today's `converse` states none; `agent-drafts`' label-ai suite stands a stub adapter's
 * on it). `machineWork(label)` reads a label as `MACHINE_WORK` exactly when it is that shape, whatever `ai` was served,
 * and returns anything else unchanged, so a suite comparing it with `MACHINE_WORK` fails on any other label: a bare
 * string, another kind, an extra field, or an `ai` that is not a label object. It accepts a label with no `ai`, because
 * today's `converse` states none on this tree: that `ai` is carried exactly where it is served is held by
 * `found-marks.test.mjs`' F4 test, whose child `converse` states one. NOT a `.test.mjs`. */
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** What a suite expects a draft's label to read as: machine work, carrying the `ai` that was served. */
export const MACHINE_WORK = Object.freeze({ kind: "machine", ai: "as served" });

/** `MACHINE_WORK` when `label` is `{kind: "machine"}` or `{kind: "machine", ai}` with `ai` a label object; else `label`. */
export function machineWork(label) {
  if (!isObject(label) || label.kind !== "machine") return label;
  const keys = Object.keys(label);
  if (!keys.every((k) => k === "kind" || k === "ai")) return label;
  if ("ai" in label && !isObject(label.ai)) return label;
  return MACHINE_WORK;
}
