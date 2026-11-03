/* A test-instance deploy's names, and the guard both deploy scripts call before any Cloudflare write.
 *
 * WHY: Bob's standing approval (CLAUDE.md, the Cloudflare paragraph) lets a session create and change, in the product's
 * own account, only development deployments: resources whose name begins with `p3dev-` or contains `-p3dev-`. The
 * Workers, buckets and container applications under the fixed names (agent-runner, pdf-worker, bio-captures, ...) are
 * not among them. Before this file a test deploy of a copy deployed each member under its config name and bound the
 * plane to the fixed buckets and members, so a deploy of any copy wrote over those resources.
 *
 * THE NAMES follow the installer's convention (newgroup/src/steps/account.mjs `namesFor`, R64): the plane is the Worker
 * `<slug>`, each member the Worker `<member>-<slug>`, each bucket `<bucket>-<slug>`, a container application
 * `<member>-<slug>` (one class) or `<member>-<class>-<slug>` (several), and a member's service targets and Durable Object
 * script names `<target>-<slug>`; the placeholder `bio-plane` is the plane, `<slug>`.
 *
 * THE GUARD refuses, by name, any Worker, bucket, container application, image, Durable Object script or service target
 * that neither begins with `p3dev-` nor contains `-p3dev-`, and any slug that does not itself begin with `p3dev-`. It is
 * pure: a plan in, the offenders out. The scripts call `refuseUnlessP3dev`, which exits non-zero before any write.
 */

export const P3DEV = "p3dev-";
export const PHANTOM = "bio-plane";

/** A name a development deployment may carry. */
export const isP3devName = (n) => typeof n === "string" && n.length > 0 && (n.startsWith(P3DEV) || n.includes(`-${P3DEV}`));

/** `<name>-<slug>`, the installer's form. */
export const slugged = (name, slug) => `${name}-${slug}`;

/** A container application's name, as the installer names it. */
export const appName = (member, cls, multi, slug) => (multi ? `${member}-${String(cls).toLowerCase()}-${slug}` : `${member}-${slug}`);

/* Config keys that name a resource this route does not slug. A config that declares one is refused, never passed on:
   it would bind or create a resource under a name the guard has not seen. */
const UNSLUGGED_KEYS = ["routes", "route", "kv_namespaces", "d1_databases", "queues", "workflows", "tail_consumers",
  "dispatch_namespaces", "analytics_engine_datasets", "vectorize", "hyperdrive", "mtls_certificates", "send_email",
  "pipelines", "secrets_store_secrets", "unsafe"];

const present = (cfg, k) => cfg[k] !== undefined && cfg[k] !== null && (!Array.isArray(cfg[k]) || cfg[k].length > 0);

/** A member's config with every name slugged (pure; the input is not changed). */
export function slugMember(cfg, { member, slug, multi = false }) {
  const out = structuredClone(cfg);
  out.name = slugged(member, slug);
  for (const s of out.services || []) s.service = s.service === PHANTOM ? slug : slugged(s.service, slug);
  for (const b of out.r2_buckets || []) b.bucket_name = slugged(b.bucket_name, slug);
  for (const d of (out.durable_objects && out.durable_objects.bindings) || []) if (d.script_name) d.script_name = slugged(d.script_name, slug);
  if (Array.isArray(out.containers)) out.containers = out.containers.map((c) => ({ ...c, name: appName(member, c && c.class_name, multi, slug) }));
  return out;
}

/** The plane's config with its member targets and buckets slugged; `bio-plane` stays, deriveBindings makes it `<slug>`. */
export function slugPlane(cfg, { slug }) {
  const out = structuredClone(cfg);
  for (const s of out.services || []) if (s.service !== PHANTOM) s.service = slugged(s.service, slug);
  for (const b of out.r2_buckets || []) b.bucket_name = slugged(b.bucket_name, slug);
  return out;
}

/** What a (slugged) member config would create or bind. `images` are the registry tags it would push. */
export function memberPlan(cfg, { slug, images = [] }) {
  return {
    slug,
    workers: [cfg.name],
    services: (cfg.services || []).map((s) => s.service),
    buckets: (cfg.r2_buckets || []).map((b) => b.bucket_name),
    doScripts: ((cfg.durable_objects && cfg.durable_objects.bindings) || []).filter((d) => d.script_name).map((d) => d.script_name),
    apps: (cfg.containers || []).map((c) => c && c.name),
    images,
    uncarried: UNSLUGGED_KEYS.filter((k) => present(cfg, k)),
  };
}

/** What the plane's upload would bind: `bindings` the metadata's list (and any the script holds that the upload keeps). */
export function planePlan(bindings, { slug, cfg = {} }) {
  return {
    slug,
    workers: [slug],
    services: bindings.filter((b) => b.type === "service").map((b) => b.service),
    buckets: bindings.filter((b) => b.type === "r2_bucket").map((b) => b.bucket_name),
    doScripts: bindings.filter((b) => b.type === "durable_object_namespace" && b.script_name).map((b) => b.script_name),
    apps: [],
    images: [],
    uncarried: UNSLUGGED_KEYS.filter((k) => present(cfg, k)),
  };
}

/** Every offender in a plan, each a sentence naming it; empty when the plan may go out. */
export function p3devFindings(plan) {
  const out = [];
  if (!plan || typeof plan.slug !== "string" || !plan.slug.startsWith(P3DEV))
    out.push(`the copy ${JSON.stringify(plan && plan.slug)} does not begin with ${P3DEV}`);
  const kinds = [["workers", "Worker"], ["services", "service target"], ["buckets", "R2 bucket"], ["doScripts", "Durable Object script"],
    ["apps", "container application"], ["images", "registry image"]];
  for (const [k, what] of kinds)
    for (const n of (plan && plan[k]) || []) {
      const name = k === "images" ? String(n).split(":")[0] : n;
      if (!isP3devName(name)) out.push(`${what} ${JSON.stringify(n)} neither begins with ${P3DEV} nor contains -${P3DEV}`);
    }
  for (const k of (plan && plan.uncarried) || []) out.push(`the config declares \`${k}\`, which this route does not slug`);
  return out;
}

/** Prints the plan's names and exits 1 naming each offender, before any write. Returns the plan when it passes. */
export function refuseUnlessP3dev(plan, { log = console.log, err = console.error, exit = process.exit } = {}) {
  const found = p3devFindings(plan);
  if (found.length) {
    err(`REFUSED [NOT_A_P3DEV_NAME]: a test deploy creates and binds only development deployments (CLAUDE.md, the Cloudflare paragraph).`);
    for (const f of found) err(`  - ${f}`);
    err("Nothing was requested or deployed.");
    exit(1);
    return null;
  }
  const show = (l) => (l.length ? l.join(", ") : "none");
  log(`p3dev guard: passed for ${plan.slug}: workers ${show(plan.workers)}; services ${show(plan.services)}; buckets ${show(plan.buckets)}; `
    + `do scripts ${show(plan.doScripts)}; container apps ${show(plan.apps)}; images ${show(plan.images)}`);
  return plan;
}

/** Each named bucket created when missing, after the guard has passed it. `dry` reads and creates nothing. */
export async function ensureBuckets(names, { acct, token, dry = false, log = console.log, fetchOf = fetch }) {
  for (const name of names) {
    if (!isP3devName(name)) throw new Error(`REFUSED [NOT_A_P3DEV_NAME]: bucket ${name}`);
    const base = `https://api.cloudflare.com/client/v4/accounts/${acct}/r2/buckets`;
    const r = await fetchOf(`${base}/${name}`, { headers: { authorization: `Bearer ${token}` } });
    if (r.ok) { log(`bucket   : ${name} exists`); continue; }
    if (r.status !== 404) throw new Error(`could not read whether bucket ${name} exists (HTTP ${r.status})`);
    if (dry) { log(`bucket   : ${name} missing; a real run creates it`); continue; }
    const c = await fetchOf(base, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name }) });
    if (!c.ok) throw new Error(`could not create bucket ${name} (HTTP ${c.status})`);
    log(`bucket   : ${name} created`);
  }
}
