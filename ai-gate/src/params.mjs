/* ai-gate — the suite's parameters, versions, namespace and closed lists (R1, R11, R36; Suggestions).
 *
 * Every parameter named in capitals lives in GATE_PARAMS (R1). The values are BOB's proposals (requirements file,
 * Suggestions, "proposed <value>; set at START (K5457)"); none is a pass mark of Bob's (AD13): the floors are in the
 * signed threshold table (R34), which ships empty. Pure data; frozen. */

const deepFreeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
export { deepFreeze };

/** R1 — the signatures namespace of the bank and the threshold table, distinct from every namespace of
 *  `signatures` (bio-release, bio-ratify, bio-release-fleet, bio-working-on, bio-docket, bio-release-notice,
 *  bio-ai-catalogue, bio-ai-advisory, bio-ai-run). Held here until `signatures` compiles it beside its others. */
export const NS_GATE_SUITE = "bio-gate-suite";

/** R1 — the statement a signed suite document is signed over: this line, then its canonical JSON. */
export const SUITE_STATEMENT_HEAD = "bio-gate-suite/1\n";

/** R56 — the bundle format's version, written first in every bundle file. */
export const BUNDLE_SCHEMA = "bio-gate-bundle/1";
/** R56 — the sealed payload's format. */
export const SEAL_FORMAT = "bio-gate-seal/1";

/** R1 — this module's own scorer version (the code), and the version of the empty threshold table it ships. */
export const SCORER_VERSION = "scorer-1";
export const EMPTY_THRESHOLDS_VERSION = "thresholds-0";

export const TIERS = deepFreeze(["T0", "T1", "T2", "T3"]);

export const GATE_PARAMS = deepFreeze({
  REPEATS: { T1: 1, T2: 5, consistency: 10, canary: 3 },
  ROTATE_AFTER_USES: 25,
  REVIEW_DAYS: 90,
  CANARY_ITEMS: ["g1-tool-args-run", "g2-report-shape-ask", "g3-quote-ask", "g4-injection-run", "g7-absence-ask"],
  NEEDLE_DEPTHS_MIN: 4,
  CI_LEVEL: 95,
  CHAR_SAMPLES: 5,
  LEVER_RUNS: 3,
  LATENCY_TURNS_MIN: 30,
  LATENCY_WINDOWS_MIN: 3,
  COST_RUNS: 5,
  NONCE_BITS_MIN: 128,
  NAME_HASH_HEX: 8,
  RETRY_ALLOWANCE: 0.1,
  HEALTH_WINDOW_DAYS: 14,
  /* the module's own run settings, not Bob's figures: a probe's output and time bound, the connect check's fixed
     public seed, and the collect step's re-read cap (`agent-steps` R8: at most 20 cited addresses) */
  PROBE_MAX_OUTPUT: 256,
  PROBE_TIMEOUT_MS: 60000,
  CONNECT_SEED: "connect",
  CITATIONS_REREAD_MAX: 20,
});

/** R36 — the closed list of limit kinds. */
export const LIMIT_KINDS = deepFreeze(["context_depth", "no_image_input", "no_streaming", "no_parallel_tools", "output_cap"]);

/** R12 — an item's outcomes, and the run-level mismatch counted apart. */
export const OUTCOMES = deepFreeze(["pass", "fail", "not_run", "not_applicable"]);
export const IDENTITY_MISMATCH = "identity_mismatch";

/** R35 — the verdicts (`run-rules` GATE_VERDICTS, `ai-catalogue` R14). */
export const VERDICTS = deepFreeze(["passes", "passes_with_limits", "not_suitable", "not_yet_rated"]);

/** R61 — grades. */
export const GRADES = deepFreeze({ REPRODUCED: "REPRODUCED", REPORTED: "REPORTED", STATED: "STATED", OPEN: "OPEN" });

/** The one shape of a refusal: an identifier code, never a sentence (K3971). */
export const refuse = (code, fields = {}) => Object.freeze({ ok: false, code, ...fields });

export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isNonBlank = (v) => typeof v === "string" && v.trim() !== "";
export const isInstant = (v) => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?Z$/.test(v)
  && Number.isFinite(Date.parse(v));
export const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
export const isPositive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
