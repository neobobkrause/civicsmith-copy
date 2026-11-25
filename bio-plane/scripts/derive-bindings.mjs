/* D-202's closing half — the plane's deployed bindings DERIVE from
 * `bio-plane/wrangler.jsonc`, with the instance slug substituted (D-292's
 * rule), instead of living as a second hand-carried list inside deploy.mjs.
 *
 * WHY THIS FILE EXISTS APART FROM deploy.mjs: deploy.mjs is a top-level script
 * that acts on import, so nothing can test its derivation without deploying.
 * This module is pure — config in, bindings out — and bundler's tests drive it
 * (`test/m/bundler/release.test.mjs`, R13–R15). Same reasoning as ./jsonc.mjs's "one
 * copy": the logic a deploy uses is the logic the suite proves.
 *
 * WHAT IT DELIBERATELY DOES NOT EMIT, so the deploy's contract is unchanged
 * where it must be:
 *   - NO durable_object_namespace: deploy.mjs never sends STORE — it rides
 *     keep_bindings, because re-sending new_sqlite_classes at a live store is
 *     how a record gets endangered (deploy.mjs's own header rule).
 *   - NO secret_text beyond the cascade token: secrets ride keep_bindings.
 *     A deploy neither sets nor clears the instance's credentials.
 *
 * THE SUBSTITUTION (D-292): a plane is never deployed under the config's
 * `name` — the slug is the worker name (D-102). So any service target naming
 * `bio-plane` is the phantom and becomes the slug. Member targets stay
 * literal: members ARE deployed under their member names, by deploy-fleet on
 * this account and by the installer's fleet half in a group's (D-297/IC-82).
 *
 * THE REFUSAL: a binding class this derivation does not carry is REFUSED BY
 * NAME, never dropped. Sending a config's bindings minus a class it declares
 * is D-201's silent deletion arriving through the front door — the exact
 * defect that left biosmoke7 with zero service bindings for a month.
 */

const CARRIED = new Set(["vars", "r2_buckets", "services", "durable_objects", "browser"]);
/* Binding-declaring wrangler keys this derivation would MISCARRY if present.
   Listed explicitly so a new class in the config fails the deploy loudly in
   the same turn it appears, instead of deploying a plane quietly missing it. */
const KNOWN_BINDING_KEYS = [
  "kv_namespaces", "d1_databases", "queues", "analytics_engine_datasets",
  "ai", "vectorize", "hyperdrive", "dispatch_namespaces",
  "mtls_certificates", "send_email", "wasm_modules", "data_blobs", "text_blobs",
];

/**
 * Derive the bindings deploy.mjs sends, from the parsed wrangler config.
 * `version` comes from the deploy argument (resolve-version has already
 * refused any skew against the config's own vars.VERSION, so the two agree
 * by the time this runs — the argument is used because it is the one the
 * rollout gate waits for). It never carries a Claude credential (K1502): the
 * instance binds no Claude account, so no argument can add one. `instanceAiToken` is
 * D-260's organisation `ai` credential (DIST-9), carried the same way and NEVER
 * generated here: a member mints it on the instance, so a deploy only carries
 * the value the operator's environment holds.
 */
export function deriveBindings(cfg, { slug, version, instanceAiToken } = {}) {
  if (!slug) throw new Error("REFUSED [NO_SLUG]: the binding derivation needs the instance slug — a default would be the hardcoded name D-292 exists to forbid.");
  if (!version) throw new Error("REFUSED [NO_VERSION]: the binding derivation needs the version the rollout gate will wait for.");

  const present = KNOWN_BINDING_KEYS.filter((k) =>
    cfg[k] !== undefined && (Array.isArray(cfg[k]) ? cfg[k].length > 0 : true));
  if (present.length) {
    throw new Error(
      `REFUSED [UNKNOWN_BINDING_CLASS]: wrangler.jsonc declares ${present.join(", ")}, `
      + "which this derivation does not carry. Deploying without a declared class is D-201's "
      + "silent deletion through the front door — teach deriveBindings the class in the same "
      + "change that adds it to the config.");
  }

  const bindings = [
    { type: "plain_text", name: "VERSION", text: String(version) },
    /* D-102: the instance name IS the worker name; bound from the slug because
       a worker cannot learn its own name. */
    { type: "plain_text", name: "INSTANCE_NAME", text: String(slug) },
  ];

  for (const [k, v] of Object.entries(cfg.vars || {})) {
    if (k === "VERSION") continue; /* the argument's, see above */
    bindings.push({ type: "plain_text", name: k, text: String(v) });
  }
  for (const b of cfg.r2_buckets || []) {
    bindings.push({ type: "r2_bucket", name: b.binding, bucket_name: b.bucket_name });
  }
  for (const s of cfg.services || []) {
    bindings.push({ type: "service", name: s.binding,
                    service: s.service === "bio-plane" ? slug : s.service });
  }
  /* DIST-11 (IC-252's owed act): the Browser Rendering binding D-64's render arm looks for (`render.mjs` `rendererFor`).
     A config that declares `browser` must NAME its binding; one that does not declare it derives none, and the plane
     answers `renderer: "none"` exactly as before. */
  if (cfg.browser !== undefined) {
    if (!cfg.browser || typeof cfg.browser.binding !== "string" || !cfg.browser.binding)
      throw new Error("REFUSED [BROWSER_BINDING_UNNAMED]: wrangler.jsonc declares `browser` without a `binding` name.");
    bindings.push({ type: "browser", name: cfg.browser.binding });
  }
  if (instanceAiToken) {
    bindings.push({ type: "secret_text", name: "INSTANCE_AI_TOKEN", text: instanceAiToken });
  }

  /* The phantom must not survive derivation in any position. */
  for (const b of bindings) {
    if (b.service === "bio-plane") {
      throw new Error("REFUSED [PHANTOM_TARGET]: a derived binding still targets 'bio-plane', a name nothing is ever deployed under (D-292).");
    }
  }
  return bindings;
}

/** The service targets a deploy must pre-flight (deploy-fleet's pattern: the
 *  refusal should be ours and name the missing worker, not Cloudflare's 10143).
 *  The instance's own slug is excluded — the PUT that carries the binding is
 *  the PUT that creates/updates that very worker (the installer's noSelf
 *  lesson: the self-reference is the one target that cannot pre-exist). */
export function serviceTargets(bindings, slug) {
  return bindings.filter((b) => b.type === "service" && b.service !== slug)
                 .map((b) => b.service);
}

/* ---- D-54: the subrequest ceiling is DECLARED, carried and read back ----
 *
 * `limits.subrequests` lives in wrangler.jsonc beside the reason for its value.
 * The release path does not run wrangler (deploy.mjs PUTs the script through the
 * REST API with metadata it builds itself), so a limit written only in the
 * config would reach `wrangler dev` and never a deployed plane — the same
 * second-copy gap D-202 closed for bindings. deriveLimits is the one copy.
 *
 * THE REFUSAL: a config with no explicit subrequest ceiling is REFUSED BY NAME.
 * Sending no `limits` is not "no limit", it is Cloudflare's default that month,
 * which is the whole defect (D-54). A limit key this derivation does not know is
 * refused too, never dropped: that is D-201's silent deletion again.
 */
const KNOWN_LIMIT_KEYS = new Set(["subrequests", "cpu_ms"]);

/** The `limits` object deploy.mjs sends in the upload metadata (wrangler's own
 *  upload uses the same field, `limits: { cpu_ms, subrequests }`). */
export function deriveLimits(cfg) {
  const lim = cfg && cfg.limits;
  const n = lim && lim.subrequests;
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      "REFUSED [NO_SUBREQUEST_LIMIT]: wrangler.jsonc sets no explicit positive integer "
      + "`limits.subrequests`, so the deployed plane's ceiling would be whatever Cloudflare's "
      + "default is that month (D-54). State the figure the plane is sized for, with its reason, at the site.");
  }
  const unknown = Object.keys(lim).filter((k) => !KNOWN_LIMIT_KEYS.has(k));
  if (unknown.length) {
    throw new Error(
      `REFUSED [UNKNOWN_LIMIT_KEY]: wrangler.jsonc's limits declares ${unknown.join(", ")}, `
      + "which this derivation does not carry. Teach deriveLimits the key in the same change.");
  }
  const out = { subrequests: n };
  if (lim.cpu_ms !== undefined) out.cpu_ms = lim.cpu_ms;
  return out;
}

/** Read the deployed script's settings back against what was sent. Three honest
 *  answers and no fourth: MATCH, MISMATCH (a value that is not ours — the deploy
 *  must not report success), or UNDETERMINED (the settings did not state the
 *  field, or could not be read — never read as a match). */
export function limitsReadBack(settings, want) {
  if (!settings || typeof settings !== "object") {
    return { verdict: "UNDETERMINED", why: "the script settings could not be read" };
  }
  const got = settings.limits && settings.limits.subrequests;
  if (got === undefined || got === null) {
    return { verdict: "UNDETERMINED", why: "the script settings state no limits.subrequests" };
  }
  if (got !== want.subrequests) {
    return { verdict: "MISMATCH", why: `settings say limits.subrequests ${got}, the config sent ${want.subrequests}` };
  }
  return { verdict: "MATCH", why: `limits.subrequests ${got} read back` };
}

/* ---- G1 (K4565, K4566): the plane's cron schedule is DECLARED, carried and read back ----
 *
 * The upload metadata of a script PUT has no field for a cron schedule, and whether a plain PUT keeps the schedules the
 * script holds is unconfirmed, so deploy.mjs sets them with the schedules endpoint after every upload, from the one copy
 * here: `triggers.crons` of wrangler.jsonc. A list the platform would refuse is refused by name before any request. */
const CRON_FIELDS = 5;       /* minute hour day-of-month month day-of-week */
const MAX_CRONS = 3;         /* the platform's limit per Worker */

/** The cron strings deploy.mjs sets, as the config states them; none declared is the empty list (the script is set to none). */
export function deriveCrons(cfg) {
  const t = cfg && cfg.triggers;
  if (t === undefined || t === null) return [];
  const bad = (why) => new Error(`REFUSED [INVALID_CRONS]: wrangler.jsonc's triggers.crons ${why}.`);
  if (typeof t !== "object" || Array.isArray(t)) throw bad("is not under a `triggers` object");
  if (t.crons === undefined) return [];
  if (!Array.isArray(t.crons)) throw bad("is not a list of cron strings");
  for (const c of t.crons)
    if (typeof c !== "string" || c.trim().split(/\s+/).length !== CRON_FIELDS || c !== c.trim())
      throw bad(`holds ${JSON.stringify(c)}, which is not a cron of ${CRON_FIELDS} fields`);
  if (new Set(t.crons).size !== t.crons.length) throw bad("names the same cron twice");
  if (t.crons.length > MAX_CRONS) throw bad(`holds ${t.crons.length}; a Worker can have ${MAX_CRONS}`);
  return [...t.crons];
}

/** The schedules read back against the crons sent. MATCH only when the script holds exactly those, as a set; anything
 *  else is a MISMATCH saying what it holds. `held` is the list of cron strings read, or null when it could not be. */
export function schedulesReadBack(held, want) {
  if (!Array.isArray(held)) return { verdict: "UNREADABLE", why: "the script's schedules could not be read" };
  const show = (l) => (l.length ? l.join(" | ") : "none");
  const same = held.length === want.length && want.every((c) => held.includes(c));
  return same
    ? { verdict: "MATCH", why: `schedules ${show(held)} read back` }
    : { verdict: "MISMATCH", why: `the script holds ${held.length ? held.join(" | ") : "none"}, the config declares ${show(want)}` };
}

/* ---- G54 (K4426): Workers Logs are DECLARED, carried and read back ----
 *
 * `observability: { enabled: true }` lives in wrangler.jsonc, and a raw script upload that does not send it turns Workers
 * Logs OFF on the script (measured on biosmoke8: the 2026-10-20 03:35Z upload reset them, so no line named why two case
 * files were never built). The release path does not run wrangler, so a setting written only in the config never reaches a
 * deployed plane: deriveObservability is the one copy, as deriveLimits is for the ceiling.
 *
 * THE REFUSAL: a config that does not turn Workers Logs on is REFUSED BY NAME, because sending no `observability` is not
 * "unchanged", it is off. A key this derivation does not carry (a sampling rate, a sub-setting) is refused too, never
 * dropped, and never defaulted: nothing is sent that the config does not state. */
const KNOWN_OBSERVABILITY_KEYS = new Set(["enabled"]);

/** The `observability` object deploy.mjs sends in the upload metadata: `{ enabled: true }`. */
export function deriveObservability(cfg) {
  const o = cfg && cfg.observability;
  if (!o || typeof o !== "object" || Array.isArray(o) || o.enabled !== true) {
    throw new Error(
      "REFUSED [NO_OBSERVABILITY]: wrangler.jsonc does not state `observability: { enabled: true }`, and a script upload that "
      + "sends none turns the script's Workers Logs off (G54). Turn them on in the config; the deploy sends what it states.");
  }
  const unknown = Object.keys(o).filter((k) => !KNOWN_OBSERVABILITY_KEYS.has(k));
  if (unknown.length) {
    throw new Error(
      `REFUSED [UNKNOWN_OBSERVABILITY_KEY]: wrangler.jsonc's observability declares ${unknown.join(", ")}, `
      + "which this derivation does not carry. Teach deriveObservability the key in the same change.");
  }
  return { enabled: true };
}

/** Read the deployed script's settings back against what was sent. Three honest answers: MATCH (the settings report Workers
 *  Logs enabled), MISMATCH (they report it off, or state none: the platform reports an off script without the key), or
 *  UNREADABLE (the settings could not be read: never read as a match). Only `enabled` was sent, so only it is compared. */
export function observabilityReadBack(settings, want) {
  if (!settings || typeof settings !== "object") return { verdict: "UNREADABLE", why: "the script settings could not be read" };
  const got = settings.observability;
  if (!got || typeof got !== "object") return { verdict: "MISMATCH", why: "the script settings state no observability, which is how the platform reports Workers Logs off" };
  if (got.enabled !== want.enabled) return { verdict: "MISMATCH", why: `settings say observability.enabled ${JSON.stringify(got.enabled ?? null)}, the config sent ${want.enabled}` };
  return { verdict: "MATCH", why: `observability.enabled ${got.enabled} read back` };
}

/* ---- G83 (K4752): WHERE THE TEAM'S ROOM RUNS is chosen at a deploy ----
 *
 * `--store-location <hint>` and `--store-generation <n>` become the plane's `plain_text` bindings STORE_LOCATION and
 * STORE_GENERATION (runtime-limits R27/R28 read them). A room never moves, so a new generation is how a copy gets a new
 * room; `1` is the first room, so it sends no STORE_GENERATION and removes a held one (the rollback). The hint list is
 * runtime-limits' own (`STORE_HINTS`), passed in, so this file keeps no second copy. Nothing is defaulted: a flag that is
 * not given sends nothing and a held binding is kept by deploy.mjs's rule (R34). */
export const STORE_GENERATION_PATTERN = /^[1-9][0-9]*$/;

/** `{ bindings, remove }` for the flags: `bindings` the plain_text bindings to send, `remove` the names a held binding of
 *  which must NOT be kept. A value that is not valid is refused by name before anything is uploaded. */
export function deriveStorePlace({ location, generation } = {}, hints = []) {
  const bindings = [], remove = [];
  if (location !== undefined) {
    if (typeof location !== "string" || !hints.includes(location))
      throw new Error(`REFUSED [BAD_STORE_LOCATION]: ${JSON.stringify(location ?? null)} is not one of Cloudflare's location hints (${hints.join(", ")}).`);
    bindings.push({ type: "plain_text", name: "STORE_LOCATION", text: location });
  }
  if (generation !== undefined) {
    if (typeof generation !== "string" || !STORE_GENERATION_PATTERN.test(generation))
      throw new Error(`REFUSED [BAD_STORE_GENERATION]: ${JSON.stringify(generation ?? null)} is not a whole number of 1 or more written without a sign, a leading zero or a space.`);
    if (generation === "1") remove.push("STORE_GENERATION");
    else bindings.push({ type: "plain_text", name: "STORE_GENERATION", text: generation });
  }
  return { bindings, remove };
}
