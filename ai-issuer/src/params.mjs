/* ai-issuer — its parameters (build/requirements/ai-issuer.md, Suggestions: "proposed <value>; set at START", K5457).
 *
 * Each value is BOB's proposal from the requirements file, or, where the file says "proposed at START from the first
 * runs", a starting figure of this job's, named so (FIRST_RUNS) for the coordinator to set. A deployment may set any of
 * them as a plain-text variable of the same name (a whole number); nothing else is read from the environment. */

/** K5481: the standing rule that lets a narrowing advisory (R7). */
export const STANDING_RULE = "K5481";

const HOUR = 3_600_000;

export const PARAMS = Object.freeze({
  /* R1: seconds the index may be cached ("a few minutes") */
  INDEX_MAX_AGE: 300,
  /* R9, R13: bits of randomness in a nonce and a result token */
  NONCE_BITS: 128,
  /* R10: a nonce's life, 72 hours, in milliseconds */
  NONCE_LIFE_MS: 72 * HOUR,
  /* R10: FIRST_RUNS, the coordinator's to set from the first runs */
  NONCE_OUTSTANDING_MAX: 200,
  NONCE_DAILY_MAX: 100,
  /* R12: FIRST_RUNS, under the host's 100 MB request limit, 32 MiB */
  BUNDLE_MAX_BYTES: 32 * 1024 * 1024,
  /* R16: the scorer's time to record a verified bundle, one day */
  SCORE_WITHIN_MS: 24 * HOUR,
  /* R26 */
  HEALTH_MAX_BYTES: 64 * 1024,
  /* R26: as ai-use's HEALTH_DAYS_MAX (7); a test holds the two equal */
  HEALTH_DAYS_MAX: 7,
  /* R26: FIRST_RUNS */
  HEALTH_DAILY_MAX: 20_000,
  /* R17, R18: Bob's (K5482), not proposed; RESULT_ACTIVE_MONTHS is ai-catalogue's, a test holds the two equal */
  RESULT_ACTIVE_MONTHS: 6,
  LISTED_TAIL_MONTHS: 12,
});

/** The parameters for a deployment: each from its variable when that is a whole number, else the value above. */
export function paramsOf(env = {}) {
  const out = { ...PARAMS };
  for (const k of Object.keys(PARAMS)) {
    const v = env && typeof env === "object" ? env[k] : undefined;
    if (typeof v === "string" && /^[0-9]{1,15}$/.test(v)) out[k] = Number(v);
    else if (Number.isSafeInteger(v) && v >= 0) out[k] = v;
  }
  return Object.freeze(out);
}

/** R26: the health report's version, ai-use's HEALTH_REPORT_VERSION. */
export const HEALTH_REPORT_VERSION = 1;
