/* R20, R22, R23, R25: a container member, and the description a Worker member states of its own buckets and schedule. */
import { cf, special, sleep, WAIT_BOUND_MINUTES } from "./api.mjs";
import { establishPlan } from "./probes.mjs";
import { imageWhy, imageSaid, lacksOf } from "./images.mjs";
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
/** @import { Names, Session, Lasting, ApproveAgain } from './api.mjs' */

/**
 * @typedef {Object} ContainerClass one container class as its checked descriptor states it (R38, R60)
 * @property {string} class_name
 * @property {string} image the image, pinned by digest
 * @property {number} max_instances
 * @property {{member: string, binding: string}[]} bind the members bound to the class, and the binding name each reads it by
 * @property {string} [instance_type] the size the member's configuration declares
 * @bound class_name: a JavaScript identifier of 1 to 64 characters; max_instances: a whole number from 1 to 1000;
 *   binding: a capital letter, then up to 63 capital letters, digits or underscores; instance_type: a lowercase letter,
 *   then up to 31 lowercase letters, digits or hyphens
 */
/**
 * @typedef {Object} DurableObjects a member's own Durable Objects, as its `Worker` part states them (R37)
 * @property {{name: string, class_name: string}[]} bindings
 * @property {{tag: string, classes: string[]}[]} migrations in order
 * @bound a tag is `v` and a whole number; names as ContainerClass's class_name and binding
 */

/* R38 (M-Q8) — THE CONTAINER MEMBER (agent-runner: Claude Code in a container, a member's own subscription path;
 * file-scanner: ClamAV and the safe view, two containers, T36).
 *
 * The signed fleet statement (`bio-release-fleet/2`) has no image field, and adding one would make every older
 * installer's rebuilt statement disagree with the signature. So a container member is an ordinary member (its asset is
 * the Worker that exports the Container Durable Object classes, K1615) carrying one more part of type `Container` per
 * class: a JSON descriptor, fetched and hashed like any part, which the fleet signature therefore covers:
 *   {class_name, image: "<repository>@sha256:<64 hex>", scheduling_policy: "default", max_instances, bind: [{member, binding}]}
 * One class is the part `container.json`, as before; two or more (T36, bundler R25) are `container/<class_name>.json`
 * each, the path naming the class its descriptor names. An older installer meets a part type it does not know and
 * leaves that one member out by name (R11's rule).
 *
 * It installs only when all of these hold: the permission granted carries the Containers write scope (R2), the account
 * is on Workers Paid (R6), and every descriptor names an image the default scheduling policy can pull, pinned by digest
 * (images.mjs; T46: one it cannot pull is named "not yet published where your Cloudflare account can pull it"). Then:
 * the Worker is uploaded (with its classes' migration when the script is new, and bound to each class it reaches
 * itself), the Containers application of each class is created for that class's namespace with its image, or, when it
 * exists, rolled out to the image; and each other member a descriptor names is uploaded with a cross-script binding to
 * the class. Any condition failing leaves the member out, named with what the copy then lacks (images.mjs, CONTAINER_LACKS): the
 * install never fails over it. The Containers API calls are wrangler's own (`/accounts/<id>/containers/applications`,
 * `…/rollouts`); like the install's SELF binding, they are confirmed only by a real install, which is deploy-gated. */
/** @type {string} the part type of a container class's descriptor */
export const CONTAINER_PART = "Container";
/* R44 (T36; K2155, N772): a member's own bucket bindings and scheduled triggers, which the fleet statement's `services`
   cannot carry, ride as one more signed part of type `Worker` (`worker.json`, bundler's), read like a container's
   descriptor:
     {r2_buckets: [{binding, bucket: "captures" | "published"}], crons: ["<five fields>"]}
   A bucket is named by its role and bound to the copy's own bucket of that role. A member without the part gets
   neither, as before, and the page names what it then lacks. */
/** @type {string} the part type of a member's description of its own buckets, schedule and objects */
export const WORKER_PART = "Worker";
/** @type {Set<string>} the part types that are read, never uploaded as modules */
const DESCRIPTOR_PARTS = new Set([CONTAINER_PART, WORKER_PART]);
/**
 * A member's `Container` parts, one per class.
 * @param {{parts?: {type: string, path: string}[]}} m the member as the fleet statement states it
 * @returns {{type: string, path: string}[]}
 */
const containerPartsOf = (m) => (m.parts || []).filter((pp) => pp.type === CONTAINER_PART);
/* R57: what a container member left out then lacks, said after its reason; nothing for a member the assistant does not need. */
/**
 * @param {{member: string, parts?: {type: string, path: string}[]}} m the member as the fleet statement states it
 * @returns {string} what the copy lacks without it; "" for a member that is not a container member or names nothing lacked
 */
const lacksFor = (m) => (containerPartsOf(m).length ? lacksOf(m.member) : "");
const CLASS_NAME = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const BINDING_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
const INSTANCE_TYPE = /^[a-z][a-z0-9-]{0,31}$/;
const CLASS_PATH = /^container\/([A-Za-z_$][A-Za-z0-9_$]{0,63})\.json$/;

/* The descriptor, read and checked; `{ok: true, d}` or `{ok: false, why}` in words. */
/**
 * @param {Uint8Array} bytes the `Container` part's verified bytes
 * @returns {{ok: boolean, d?: any, why?: string}} `d` a ContainerClass when ok; else `why` in words
 * @bound as ContainerClass states: max_instances a whole number from 1 to 1000; scheduling_policy exactly "default"
 */
export function containerDescriptor(bytes) {
  let d;
  try { d = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { ok: false, why: word("installer.fleet.why.container.parse") }; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, why: word("installer.fleet.why.container.parse") };
  if (typeof d.class_name !== "string" || !CLASS_NAME.test(d.class_name)) return { ok: false, why: word("installer.fleet.why.container.class") };
  /* R38 (T46): an image the account cannot pull, or one not pinned by digest, is said in words a group can read. */
  const imageNot = imageWhy(d.image);
  if (imageNot) return { ok: false, why: imageSaid(imageNot) };
  if (d.scheduling_policy !== "default") return { ok: false, why: word("installer.fleet.why.container.policy") };
  if (!Number.isInteger(d.max_instances) || d.max_instances < 1 || d.max_instances > 1000)
    return { ok: false, why: word("installer.fleet.why.container.size") };
  /* R60 (T50; N1170; `bundler` R33): the size the member's configuration declares, passed on as stated; none stated, none sent. */
  if (d.instance_type !== undefined && (typeof d.instance_type !== "string" || !INSTANCE_TYPE.test(d.instance_type)))
    return { ok: false, why: word("installer.fleet.why.container.size") };
  const bind = d.bind === undefined ? [] : d.bind;
  if (!Array.isArray(bind) || !bind.every((b) => b && typeof b.member === "string" && b.member
      && typeof b.binding === "string" && BINDING_NAME.test(b.binding)))
    return { ok: false, why: word("installer.fleet.why.container.bindings") };
  return { ok: true, d: { class_name: d.class_name, image: d.image, max_instances: d.max_instances, bind,
    ...(d.instance_type === undefined ? {} : { instance_type: d.instance_type }) } };
}

/* R38 (T36): every class a container member carries, one descriptor per `Container` part; `{ok: true, classes}` or
   `{ok: false, why}`. With two or more, each part's path names its class and the class names differ; any part that
   does not read leaves the whole member out (a member missing a part its statement names never reaches here: the
   part's fetch fails first). Each class's why names the class. */
/**
 * @param {{path: string}[]} parts the member's `Container` parts
 * @param {(path: string) => Uint8Array} bytesOf a part's verified bytes, by its path
 * @returns {{ok: boolean, classes?: ContainerClass[], why?: string}}
 */
export function containerClasses(parts, bytesOf) {
  if (parts.length === 1) return ((r) => r.ok ? { ok: true, classes: [r.d] } : r)(containerDescriptor(bytesOf(parts[0].path)));
  const classes = [];
  for (const p of parts) {
    const at = CLASS_PATH.exec(p.path);
    if (!at) return { ok: false, why: word("installer.fleet.why.container.path") };
    const r = containerDescriptor(bytesOf(p.path));
    if (!r.ok) return r;
    if (r.d.class_name !== at[1]) return { ok: false, why: word("installer.fleet.why.container.path") };
    if (classes.some((c) => c.class_name === r.d.class_name)) return { ok: false, why: word("installer.fleet.why.container.duplicate") };
    classes.push(r.d);
  }
  return { ok: true, classes };
}

/* R44 (T36): the `Worker` part, read and checked; `{ok: true, d}` or `{ok: false, why}` in words. */
const BUCKET_ROLES = Object.freeze({ captures: "bio-captures", published: "bio-published" });
const CRON = /^(?:[0-9*,/?LW#A-Za-z-]+\s){4}[0-9*,/?LW#A-Za-z-]+$/;
/**
 * @param {Uint8Array} bytes the `Worker` part's verified bytes
 * @returns {{ok: boolean, d?: any, why?: string}} `d` `{r2_buckets: {binding, bucket}[], crons: string[], durable_objects?: DurableObjects}`
 *   when ok; else `why` in words
 * @bound at most three crons, each five fields; a bucket is "captures" or "published"
 */
export function workerDescriptor(bytes) {
  let d;
  try { d = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { ok: false, why: word("installer.fleet.why.program") }; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, why: word("installer.fleet.why.program") };
  const list = (k) => d[k] === undefined ? [] : d[k];
  const r2 = list("r2_buckets"), crons = list("crons");
  if (!Array.isArray(r2) || !r2.every((b) => b && typeof b.binding === "string" && BINDING_NAME.test(b.binding) && Object.hasOwn(BUCKET_ROLES, b.bucket)))
    return { ok: false, why: word("installer.fleet.why.program") };
  if (!Array.isArray(crons) || crons.length > 3 || !crons.every((c) => typeof c === "string" && CRON.test(c)))
    return { ok: false, why: word("installer.fleet.why.program") };
  /* R37: a member's own Durable Objects, bindings and migrations in order, as its signed release states them; none stated, none deployed. */
  const objects = d.durable_objects;
  if (objects !== undefined && !(objects && Array.isArray(objects.bindings) && Array.isArray(objects.migrations)
      && objects.bindings.every((b) => b && BINDING_NAME.test(b.name) && CLASS_NAME.test(b.class_name))
      && objects.migrations.every((x) => x && /^v[0-9]+$/.test(x.tag) && Array.isArray(x.classes) && x.classes.every((c) => CLASS_NAME.test(c)))))
    return { ok: false, why: word("installer.fleet.why.program") };
  return { ok: true, d: { r2_buckets: r2.map(({ binding, bucket }) => ({ binding, bucket })), crons: [...crons],
    ...(objects === undefined ? {} : { durable_objects: { bindings: objects.bindings.map(({ name, class_name }) => ({ name, class_name })),
      migrations: objects.migrations.map(({ tag, classes }) => ({ tag, classes: [...classes] })) } }) } };
}

/* R44 (T36): what file-scanner then lacks, when its release carries no `Worker` part. */
/* R44 (T36): the members that then lack their bucket and schedule, when their release carries no `Worker` part: they get the
   note `installer.fleet.note.scanner`. */
/** @type {readonly string[]} */
const WORKER_PART_LACKS = Object.freeze(["file-scanner"]);

/* R45 (T36; K1946 T4): the member a tool reached through a tunnel is called through, and the binding name it reads the
   operator's Workers VPC service by, as R45 names them. */
/** @type {string} */
export const VPC_MEMBER = "file-scanner";
/** @type {string} */
export const VPC_BINDING = "SECURITY_VPC";

/* R45 (T36): a Workers VPC service is named by its id, 32 hexadecimal digits with or without the dashes of a UUID. */
const VPC_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
/**
 * @param {any} v the service id the operator named
 * @returns {boolean} whether it is a Workers VPC service id
 * @bound 32 hexadecimal digits (lowercase), with or without the dashes of a UUID
 */
export const vpcServiceOk = (v) => typeof v === "string" && VPC_ID.test(v);

/* Whether this act may install a container (R38's first two conditions), asked once, only when the release names one.
   `scope` is what the token response stated (null: it stated none, and one read of the Containers API decides). On an
   update the plan is established here as R6 establishes it, and a Free or unknown answer only leaves the container out:
   an update never grows a refusal. */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {{scope?: string|null, plan?: any}} conditions the scope the token response stated, and the plan when R6 established it
 * @returns {Promise<{ok: boolean, code?: string, said?: string, leftover?: boolean}>} `code` one of "nopermission",
 *   "permissionunknown", "freeplan", "planunknown" when not ok; `leftover` when the plan probe left a script behind
 */
async function containerConditions(token, acct, { scope, plan }) {
  if (scope !== null && scope !== undefined) {
    if (!scope.split(/[\s,]+/).includes("containers.write"))
      return { ok: false, code: "nopermission" };
  } else {
    try { await cf(token, `/accounts/${acct}/containers/applications`); }
    catch (e) { return { ok: false, code: "permissionunknown", said: e.message }; }
  }
  let p = plan;
  if (!p) {
    try { p = await establishPlan(token, acct); } catch (e) { p = { plan: "unknown", detail: e.message }; }
  }
  if (p.plan === "free") return { ok: false, code: "freeplan" };
  if (p.plan !== "paid") return { ok: false, code: "planunknown", said: p.detail || "" };
  return { ok: true, leftover: !!p.leftover };
}

/* Why the conditions failed, as the fragment the left-out list shows. */
/**
 * @param {{code?: string}} c the conditions' answer, not ok
 * @returns {string}
 */
function conditionWhy(c) {
  if (c.code === "nopermission") return word("installer.fleet.why.nopermission");
  if (c.code === "permissionunknown") return word("installer.fleet.why.permissionunknown");
  if (c.code === "freeplan") return word("installer.fleet.why.freeplan");
  return word("installer.fleet.why.planunknown");
}

/* A full rollout of one application to `config`: the platform's way to start a new image, and, asked again, to restart. */
/**
 * @param {Session} token
 * @param {string} acct
 * @param {string} id the application's id
 * @param {string} appName
 * @param {Object} config the target configuration (`image`, and `instance_type` when stated)
 * @returns {Promise<any>} the rollout as the API answers it
 */
const rolloutApp = (token, acct, id, appName, config) => cf(token, `/accounts/${acct}/containers/applications/${id}/rollouts`, { method: "POST",
  body: JSON.stringify({ description: "Civicsmith installer: " + appName, strategy: "rolling", kind: "full_auto", step_percentage: 100,
    target_configuration: config }) });

/* F5: whether the platform could pull the image. It is read from the application after the create or the rollout:
   `health.instances.failed > 0`, or the rollout's `status` === "failed". It waits (nominal seconds, inside WAIT_BOUND_MINUTES, drawn
   through `onWait`) only while a rollout is `pending` or `in_progress`, or `health.instances.starting > 0`; an application that
   starts nothing (`instances: 0`) is not waited on. Answers true when the pull failed. A read that fails says nothing. */
const PENDING_ROLLOUT = new Set(["pending", "in_progress", "progressing"]);
const PULL_EVERY_S = 5;
async function pullFailed(token, acct, id, rolloutId) {
  const bound = WAIT_BOUND_MINUTES * 60;
  const read = async (path) => { try { return await cf(token, `/accounts/${acct}/containers/applications/${path}`); }
    catch (e) { if (special(e)) throw e; return null; } };
  for (let waited = 0; ; waited += PULL_EVERY_S) {
    const app = await read(id);
    const roll = rolloutId ? await read(`${id}/rollouts/${rolloutId}`) : null;
    const status = roll?.status ?? app?.rollout?.status ?? null;
    const inst = app?.health?.instances;
    if ((inst && inst.failed > 0) || status === "failed") return true;
    if (!(PENDING_ROLLOUT.has(status) || (inst && inst.starting > 0)) || waited >= bound) return false;
    if (token.onWait) await token.onWait(waited, bound);
    await sleep(PULL_EVERY_S * 1000);
  }
}

/* The Containers application for one class's namespace, created with the image, or rolled out to it. The application is named
   under the copy's own names (R64: a member with one class by the member and the slug, with several by member, class and slug).
   R60: the size the descriptor states is passed per class, to the create call and to a rollout. F5: a pull the platform could not
   do is thrown as the member's own refusal (`installer.fleet.why.pullfailed`), after the upload was attempted. R68 (S11): the
   image the platform then holds for the application is read back and compared with the digest the release names; where it is
   another (a rollout answered "no changes" and kept the old one), one further rollout is asked, and an image still another is
   returned as a lag, never success. Answers `{action, lag, id, appName, config}`, `lag` null when the image deployed is the release's;
   `id`, `appName` and `config` are what a later restart (S9, `confirmContainers`) needs. */
/**
 * @param {Session} token
 * @param {string} acct
 * @param {{member: string}} m the member
 * @param {ContainerClass} d the class
 * @param {string} appName the application's name under the copy's names
 * @param {Names} names the copy's names
 * @returns {Promise<{action: string, lag: string|null, id: any, appName: string, config: {image: string, instance_type?: string}}>}
 *   `action` "created" or "rolled out"; `id` null when the platform answered none
 * @throws {Error} when the class's namespace is not there, or the platform could not pull the image
 * @throws {ApproveAgain} when the permission has expired
 * @throws {Lasting} when the API stays slow or unavailable for the whole bound
 */
async function placeContainer(token, acct, m, d, appName, names) {
  const spaces = await cf(token, `/accounts/${acct}/workers/durable_objects/namespaces?per_page=1000`);
  const script = names.member(m.member);
  const ns = (Array.isArray(spaces) ? spaces : []).find((n) => n && n.script === script && n.class === d.class_name);
  if (!ns || !ns.id) throw new Error(word("installer.fleet.why.class"));
  const apps = await cf(token, `/accounts/${acct}/containers/applications`);
  const app = (Array.isArray(apps) ? apps : []).find((a) => a && a.name === appName);
  const config = { image: d.image, ...(d.instance_type ? { instance_type: d.instance_type } : {}) };
  const deployed = async (id) => { try { return (await cf(token, `/accounts/${acct}/containers/applications/${id}`))?.configuration?.image ?? null; }
    catch (e) { if (special(e)) throw e; return null; } };
  let id, action, rolled = null;
  if (!app) {
    const made = await cf(token, `/accounts/${acct}/containers/applications`, { method: "POST", body: JSON.stringify({
      name: appName, scheduling_policy: "default", instances: 0, max_instances: d.max_instances,
      configuration: config, durable_objects: { namespace_id: ns.id } }) });
    id = made && made.id; action = "created";
  } else { id = app.id; rolled = await rolloutApp(token, acct, id, appName, config); action = "rolled out"; }
  if (!id) return { action, lag: null, id: null, appName, config };
  if (await pullFailed(token, acct, id, rolled && rolled.id)) throw new Error(word("installer.fleet.why.pullfailed"));
  let got = await deployed(id);
  if (got !== d.image && action === "rolled out") { await rolloutApp(token, acct, id, appName, config); got = await deployed(id); }
  return { action, id, appName, config, lag: got === d.image ? null
    : got ? word("installer.image.lag.older", { name: appName }) : word("installer.image.lag.unread", { name: appName }) };
}

/* R44: a member's scheduled triggers, set exactly as its `Worker` part states them. */
/**
 * @param {Session} token
 * @param {string} acct
 * @param {string} script the member's Worker
 * @param {string[]} crons
 * @returns {Promise<any>} the API's result
 * @throws {Error} the platform's refusal
 */
async function setSchedules(token, acct, script, crons) {
  return cf(token, `/accounts/${acct}/workers/scripts/${script}/schedules`,
    { method: "PUT", body: JSON.stringify(crons.map((cron) => ({ cron }))) });
}
export { DESCRIPTOR_PARTS, containerPartsOf, lacksFor, WORKER_PART_LACKS, containerConditions, conditionWhy, placeContainer, rolloutApp, setSchedules };
