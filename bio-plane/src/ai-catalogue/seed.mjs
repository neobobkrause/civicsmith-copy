/* ai-catalogue — the seed this release carries (R39), and which catalogue keys this build trusts.
 *
 * THE SEED. A release carries one seed payload: its bytes, the statement R33 binds over them (`signatures` R51) and, once
 * signed, its armored signature. It is loaded at start (`AiCatalogue.start`) and verified exactly as a pulled payload is
 * (R33, R36), held as `source: "seed"`, and never applied over a newer held payload (`NOT_NEWER`).
 *
 * What it holds (BOB's ruling for the T53 restart, point 3): no entry, no plan, no provider.
 * No provider fact is recorded with evidence in the repository, and Gate 1 verdicts wait on Bob's pass marks (AD13,
 * SR7), so a seed that offered anything would be guessing. It carries the payload's frame (parts and policy) so a copy
 * that has never pulled holds a verified catalogue, answers `current` with `source: "seed"`, and offers nothing until a
 * pulled payload lists entries. `policy.origin.barred` is empty: with no entry there is no developer to judge, and the
 * barred list is data the first pulled payload carries (R12).
 *
 * ITS SIGNATURE. Where it comes from depends on the build:
 *  - a development deployment signs `aiCatalogueStatement(RELEASE_SEED.statement)` in `NS_AI_CATALOGUE` with the
 *    development catalogue key it generated and holds as a Worker secret (BOB's act at a development deploy), and hands
 *    the armored signature, which is public, to the copy as the variable `SEED_SIGNATURE_VAR`;
 *  - a public release carries Bob's signature in `RELEASE_SEED.armored` (null until he signs one; no session holds his
 *    keys).
 * This module holds no secret and signs nothing (R52); it only verifies.
 *
 * THE KEYS. `CATALOGUE_KEYS` (`signatures` R50, R58) holds exactly Bob's two catalogue keys and no test or development
 * line; a key this copy should trust beside them is handed as `keys` (as a test does). `catalogueKeysFor` keeps a line
 * marked by the comment ending `DEVELOPMENT_KEY_MARK` only in a build whose environment sets `DEVELOPMENT_VAR` to "1", so
 * a public release, which never sets it, refuses a development-signed seed or payload (`UNKNOWN_KEY`) while trusting
 * Bob's lines. A development deployment's own public line is generated at its deploy (`dev-key.mjs`) and handed as the
 * variable `DEVELOPMENT_KEY_VAR`: it is added to the list only where `DEVELOPMENT_VAR` is "1" and the line is an
 * ed25519 line marked `DEVELOPMENT_KEY_MARK`, so a release build, which sets neither, never trusts it. A caller that
 * passes no list trusts Bob's lines alone, whatever its environment says (R59). */
import { createSha256 } from "../record-grammar/index.mjs";
import { CATALOGUE_KEYS } from "../sshsig.mjs";

/** The variable a development deployment sets to the seed's armored signature (public; not a secret). */
export const SEED_SIGNATURE_VAR = "AI_CATALOGUE_SEED_SIGNATURE";
/** The variable only a development deployment sets, to "1": its build trusts the development catalogue key lines. */
export const DEVELOPMENT_VAR = "AI_CATALOGUE_DEVELOPMENT";
/** A `CATALOGUE_KEYS` line whose comment ends with this is a development key, never trusted by a public release. */
export const DEVELOPMENT_KEY_MARK = "-development";
/** The variable a development deployment sets to its own development catalogue key's public line (public; its
 *  private half is a Worker secret this module never reads). Trusted only where `DEVELOPMENT_VAR` is "1". */
export const DEVELOPMENT_KEY_VAR = "AI_CATALOGUE_DEVELOPMENT_KEY";

/** True for a key line marked as a development key (its comment, the third field, ends with the mark). */
export function isDevelopmentKey(line) {
  if (typeof line !== "string") return false;
  const comment = line.trim().split(/\s+/).slice(2).join(" ");
  return comment.endsWith(DEVELOPMENT_KEY_MARK);
}

const ED25519_LINE_RE = /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]{43} \S+$/;
/** Bob's catalogue lines: signatures' list less every development line. */
const BOB_LINES = Object.freeze(CATALOGUE_KEYS.filter((l) => !isDevelopmentKey(l)));

/** The development line a deployment hands as `DEVELOPMENT_KEY_VAR`, or null: one ed25519 line, marked, not Bob's. */
function deploymentLine(env) {
  const v = env[DEVELOPMENT_KEY_VAR];
  if (typeof v !== "string") return null;
  const line = v.trim().split(/\s+/).join(" ");
  return ED25519_LINE_RE.test(line) && isDevelopmentKey(line) && !BOB_LINES.includes(line) ? line : null;
}

/** The key lines this build trusts. With no list, Bob's lines alone, in any build. With a list: every line, less the
 *  development lines unless `env[DEVELOPMENT_VAR]` is "1"; where it is, the deployment's own `DEVELOPMENT_KEY_VAR` line
 *  is added after them. */
export function catalogueKeysFor(lines, env = {}) {
  if (!Array.isArray(lines)) return BOB_LINES;
  const dev = !!env && typeof env === "object" && String(env[DEVELOPMENT_VAR] ?? "") === "1";
  const kept = lines.filter((l) => dev || !isDevelopmentKey(l));
  const own = dev ? deploymentLine(env) : null;
  return Object.freeze(own && !kept.includes(own) ? [...kept, own] : kept);
}

const PARTS = ["ask", "draft", "read", "transcribe", "run", "account"];

/** The seed document (R36-valid; R39). Its `seq` is 1: the issuer's first published payload carries a higher one. */
export const SEED_PAYLOAD = Object.freeze({
  schema_version: 1, seq: 1, issued_at: "2026-11-04T00:00:00Z",
  providers: [], parts: PARTS,
  policy: { origin: { check: "P7", barred: [] }, review_period_days: 90, stale_after_days: 14 },
  profiles: [], plans: [], guidance: [], warnings: [], entries: [], tested: [], library: [], combined: [],
});

/** A seed as a release carries it: `{statement, body, armored}` for a document, `armored` its signature or null. */
export function seedOf(doc, armored = null) {
  const body = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(body);
  const statement = Object.freeze({ seq: doc.seq, schema_version: doc.schema_version, issued_at: doc.issued_at,
    sha256: createSha256().update(bytes).hex(), bytes: bytes.length });
  return Object.freeze({ statement, body, armored });
}

/** R39: the seed this release carries. `armored` is Bob's signature for a public release; null until he signs one. */
export const RELEASE_SEED = seedOf(SEED_PAYLOAD, null);

/* F2: THE DEVELOPMENT SEED. A test or development plane needs a catalogue that lists a plan, or nothing can connect an
 * account through it (`op=aiownadd` answers CATALOGUE_UNAVAILABLE on the release seed). This seed lists the plan `api`
 * and one entry reached through it, all under a made-up provider (`DEVELOPMENT_PROVIDER`; R48: no provider is named in
 * code). Nothing in it is a provider fact: every evidence row says it is development data. It is the default seed only
 * where `DEVELOPMENT_VAR` is "1" (`seedFor`), and is signed only by a development key (`dev-key.mjs`), which a release
 * build never trusts; a release never carries it (`RELEASE_SEED` is unchanged). Its seq is 2, so a development copy
 * that already holds the release seed (seq 1) takes it. */
export const DEVELOPMENT_PROVIDER = "p3dev-provider";
export const DEVELOPMENT_PLAN = "api";
const DEV_DATE = "2026-11-05";
const devEv = (grade = "STATED") => ({ grade, source: "development seed: not a provider fact", date: DEV_DATE });
const devClaim = (value, grade = "STATED") => ({ value, ev: devEv(grade) });
const devQuoted = () => ({ ...devEv(), page: "https://p3dev.invalid/terms", quote: "development seed: not a provider fact" });
const devMet = () => ({ answer: "met", ev: devQuoted() });
const devProp = (value) => ({ value, method: "suite", samples: 1, conditions: "development seed", ev: devEv("REPRODUCED") });
const devGate = () => ({ verdict: "passes", limits: [], partial_coverage: false,
  suiteVersions: { bank: "dev", scorer: "dev", thresholds: "dev", image: "dev" }, tier: null, at: `${DEV_DATE}T00:00:00Z`,
  run_ref: "p3dev-seed", ev: devEv("REPRODUCED") });
const devCharacterization = () => {
  const c = {};
  for (let i = 1; i <= 9; i++) c[`CH${i}`] = devProp(i);
  c.CH4 = { ...devProp("reasonable"), ev: devEv("REPORTED"), reviewer: "p3dev" };
  c.CH10 = { ref: "checks" };
  return c;
};
const DEV_PROFILE = "p3dev-profile";
const DEV_ENTRY = "p3dev-model";

/** F2: the development seed document (R36-valid). */
export const DEVELOPMENT_SEED_PAYLOAD = Object.freeze({
  schema_version: 1, seq: 2, issued_at: `${DEV_DATE}T00:00:00Z`,
  providers: [{ id: DEVELOPMENT_PROVIDER, name: "Development provider", kind: "direct" }], parts: PARTS,
  policy: { origin: { check: "P7", barred: [] }, review_period_days: 90, stale_after_days: 14 },
  profiles: [{ id: DEV_PROFILE, adapter_type: "generic_chat", version: 1, base_url: "https://p3dev.invalid/v1",
    allowed_hosts: ["p3dev.invalid"], auth_style: "bearer", mappings: {}, pin_map: null, idempotency: null,
    reasoning_billing: "in_output", features: [], quirks: [], served_report: null, key_shapes: [] }],
  plans: [{ plan_id: DEVELOPMENT_PLAN, provider: DEVELOPMENT_PROVIDER, kind: "api", scope: devClaim("team"),
    credential_kind: "api_key", means_allowed: devClaim(["gateway", "sealed"]), connection_ways: ["pasted_key"],
    runtimes: devClaim(["shared_worker"]), token_storage: devClaim("sealed"),
    price_basis: { basis: "per_token", includes: [], limits: [], date: DEV_DATE, ev: devEv() }, money: devClaim("priced"),
    restrictions: [], binding_terms: [], guidance_id: `${DEVELOPMENT_PLAN}-guide`, free_tier_trains: devClaim(false),
    lifecycle: "listed", confirmed_at: DEV_DATE }],
  guidance: [{ guidance_id: `${DEVELOPMENT_PLAN}-guide`, plan_id: DEVELOPMENT_PLAN,
    steps: [{ kind: "link", text: { en: "development seed" }, url: "https://p3dev.invalid/keys" }], ev: devEv() }],
  warnings: [],
  entries: [{ entry_id: DEV_ENTRY, display_name: "Development model", provider: DEVELOPMENT_PROVIDER,
    host: DEVELOPMENT_PROVIDER, model: DEV_ENTRY, version: DEV_DATE, version_kind: "dated", plan_ids: [DEVELOPMENT_PLAN],
    adapter_type: "generic_chat", profile: { id: DEV_PROFILE, min_version: 1 },
    developer: { name: "Development developer", jurisdiction: "ZZ" },
    capabilities: { tools: devClaim(true), parallel_tools: devClaim(true), schema_output: devClaim(true),
      schema_with_tools: devClaim(false), image_input: devClaim(false), streaming: devClaim("text"),
      session: devClaim("resend_only"), caching: devClaim("automatic"), batch: devClaim(false) },
    effort_set: { values: ["low", "medium", "high"], default: "medium", ev: devEv() },
    effort_classes: { low: "low", medium: "medium", ev: devEv() },
    limits: { context_stated: devClaim(200000), context_effective: devClaim(150000, "REPRODUCED"),
      max_output: devClaim(8000), image_max_bytes: { open: true } },
    prices: { unit: "usd_per_million_tokens", input: 1, output: 2, cache_read: 0.1, cache_write: null, date: DEV_DATE, ev: devEv() },
    zero_retention: devClaim(false), standard_task_costs: { open: true }, served_ids: [DEV_ENTRY],
    checks: Object.fromEntries(["P1", "P2", "P3", "P4", "P5", "P6", "P7"].map((p) => [p, devMet()])),
    shown: { terms_permit_use: devMet(), breach_notification: { answer: "OPEN" } },
    gate: Object.fromEntries(PARTS.map((p) => [p, devGate()])), characterization: devCharacterization(),
    lifecycle: "listed", confirmed_at: DEV_DATE }],
  tested: [], library: [], combined: [],
});

/** F3: the adapter types the development seed's entries need (R38), one per profile it lists. No module of the product
 *  registers an adapter type yet, so with nothing registered every entry needs a newer release and a development plane
 *  could hold the plan `api` yet connect nothing through it (`aiownadd` ENTRIES_EMPTY). Where the development seed is
 *  the one taken and it verifies, the catalogue registers these itself (`AiCatalogue.start`); a release build, which
 *  never takes that seed, registers nothing. */
export const DEVELOPMENT_ADAPTERS = Object.freeze(Object.values(DEVELOPMENT_SEED_PAYLOAD.profiles.reduce((by, p) => {
  (by[p.adapter_type] ||= { type: p.adapter_type, profiles: {} }).profiles[p.id] = p.version;
  return by;
}, {})).map((t) => Object.freeze({ type: t.type, profiles: Object.freeze(t.profiles) })));

/** F2: the development seed, unsigned: a development deployment hands its signature as `SEED_SIGNATURE_VAR`. */
export const DEVELOPMENT_SEED = seedOf(DEVELOPMENT_SEED_PAYLOAD, null);

/** F2: the seed a copy takes at start: the development seed only where `env[DEVELOPMENT_VAR]` is "1", else the release's. */
export function seedFor(env = {}) {
  const dev = !!env && typeof env === "object" && String(env[DEVELOPMENT_VAR] ?? "") === "1";
  return dev ? DEVELOPMENT_SEED : RELEASE_SEED;
}
