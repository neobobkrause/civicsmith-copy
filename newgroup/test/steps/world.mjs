/* installer-steps' world: one STATEFUL fake Cloudflare account (the rules of `../fixture.mjs`' `run()`, by copy, without the
 * wizard around them), the public release repository, and the copy's own address; a real Ed25519 SSHSIG signer; and the
 * releases the suites sign. The functions of `src/steps` are driven directly against it, with a recording `emit`. */
import { FLEET_BINDINGS } from "../../../bio-plane/src/setup-fleet.mjs";
import { fleetStatement, NS_FLEET, NS_RELEASE } from "../../../bio-plane/src/sshsig.mjs";
import { ARMED_SIGNERS, Session, CF_API, RELEASE_LATEST } from "../../src/steps/index.mjs";

export const TOK = "TOKEN-THAT-MUST-NEVER-APPEAR-IN-OUTPUT";
export const realFetch = globalThis.fetch;
export const jres = (o, status = 200) => new Response(JSON.stringify(o), { status });
export const cfok = (result) => jres({ success: true, result });
export const cferr = (message, status = 400, code = 0) => jres({ success: false, errors: [{ message, code }] }, status);

/* Every timer immediate, so the waits are counted and never slept (R1's control). */
export function immediateTimers() {
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => real(fn, 0);
  return () => { globalThis.setTimeout = real; };
}

export const session = (onWait = null) => new Session(TOK, onWait);

/* A recording progress sink: the three calls the module makes. */
export function sink() {
  const events = [];
  return {
    events,
    step: (id, label) => { events.push({ k: "step", id, label }); },
    ok: (id, label) => { events.push({ k: "ok", id, label: label ?? null }); },
    no: (id, label) => { events.push({ k: "no", id, label: label ?? null }); },
    last: (id) => events.filter((e) => e.id === id).at(-1) ?? null,
  };
}

/* ---- signing: a real Ed25519 SSHSIG signer, built as the offline signer page builds one ---- */
const wireU32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const cat = (...ps) => { let n = 0; for (const p of ps) n += p.length; const o = new Uint8Array(n); let i = 0;
  for (const p of ps) { o.set(p, i); i += p.length; } return o; };
const wstr = (v) => { const b = typeof v === "string" ? new TextEncoder().encode(v) : v; return cat(wireU32(b.length), b); };
const toB64 = (b) => Buffer.from(b).toString("base64");
export async function signer(comment = "release-test") {
  const key = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", key.publicKey));
  const line = "ssh-ed25519 " + toB64(cat(wstr("ssh-ed25519"), wstr(pub))) + " " + comment;
  const sign = async (bytes, ns = NS_RELEASE) => {
    const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
    const h = new Uint8Array(await crypto.subtle.digest("SHA-512", b));
    const signed = cat(new TextEncoder().encode("SSHSIG"), wstr(ns), wstr(""), wstr("sha512"), wstr(h));
    const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key.privateKey, signed));
    const blob = cat(new TextEncoder().encode("SSHSIG"), wireU32(1), wstr(cat(wstr("ssh-ed25519"), wstr(pub))), wstr(ns),
      wstr(""), wstr("sha512"), wstr(cat(wstr("ssh-ed25519"), wstr(sig))));
    return "-----BEGIN SSH SIGNATURE-----\n" + toB64(blob).replace(/(.{70})/g, "$1\n") + "\n-----END SSH SIGNATURE-----\n";
  };
  return { line, sign };
}
export const SIGNER = await signer();
export const STRANGER = await signer("stranger");
const SHIPPED = [...ARMED_SIGNERS];
export const armWith = (...lines) => { ARMED_SIGNERS.length = 0; ARMED_SIGNERS.push(...lines); };
export const restoreSigners = () => armWith(...SHIPPED);

export const sha = async (x) => Buffer.from(await crypto.subtle.digest("SHA-256",
  typeof x === "string" ? new TextEncoder().encode(x) : x)).toString("hex");

/* ---- a release the repository serves ---- */
export const VERSION = "9.9.9";
export const LIMITS = Object.freeze({ subrequests: 10000 });
export const LIMITS_STATEMENT = "bio-plane-limits/1 subrequests=10000";
/* R39 (K4566): the plane's schedule, as control-plane signs it inside the bundle beside the limits. */
export const CRONS_STATEMENT = "bio-plane-crons/1 */5 * * * *";
export const CAPABLE_SRC = "export default { fetch(){ return Response.json({ storeVersion: 'x', memberVersions: {} }); } }; export class Store {}; export const PLANE_LIMITS_STATEMENT = \"" + LIMITS_STATEMENT + "\"; export const PLANE_CRONS_STATEMENT = \"" + CRONS_STATEMENT + "\";";
export const MEMBER_SRC = "export default { fetch(){ return new Response('member'); } };";
export const WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

export const IMAGE = "docker.io/civicos/agent-runner@sha256:" + "a".repeat(64);
export const DESCRIPTOR = Object.freeze({ class_name: "AgentRunner", image: IMAGE, scheduling_policy: "default", max_instances: 5,
  bind: [{ member: "agent-worker", binding: "RUNNER" }] });
export const RUNNER = "agent-runner";
export const SCANNER = "file-scanner";
export const SCAN_IMAGE = "docker.io/civicos/file-scanner-scanner@sha256:" + "d".repeat(64);
export const RENDER_IMAGE = "docker.io/civicos/file-scanner-renderer@sha256:" + "e".repeat(64);
export const SCANNER_CLASSES = Object.freeze([
  Object.freeze({ class_name: "FileScanner", image: SCAN_IMAGE, scheduling_policy: "default", max_instances: 3, bind: [{ member: SCANNER, binding: "SCANNER" }] }),
  Object.freeze({ class_name: "SafeViewRenderer", image: RENDER_IMAGE, scheduling_policy: "default", max_instances: 3, bind: [{ member: SCANNER, binding: "RENDERER" }] }),
]);
export const SCANNER_WORKER = Object.freeze({ r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }], crons: ["17 4 * * *"] });
/* agent-worker's own Durable Objects as its configuration states them, and its `Worker` part (`worker.json`) carrying them. */
export const AGENT_OBJECTS = Object.freeze({ bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }],
  migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] });
export const AGENT_WORKER = Object.freeze({ r2_buckets: [], crons: [], durable_objects: AGENT_OBJECTS });
export const VPC_ID = "0123456789abcdef0123456789abcdef";

/* `members`: the fleet's member names (default: the three the plane binds). Options drop the fleet signature, sign it over
   another set, tamper with a member's bytes, name an unknown part type, or leave the fleet out. `container` adds
   agent-runner with `descriptor` as its `Container` part; `scanner` adds file-scanner; `memberSrc` gives a member its own text;
   `agentWorker` is agent-worker's `Worker` part (default: its own Durable Objects, as the bundler states them; null: no part). */
export async function release({ version = VERSION, src = CAPABLE_SRC, members = FLEET_BINDINGS.map(([m]) => m), sig = "good",
  fleet = true, fleetSig = "good", tamper = null, badType = null, missing = null, signedMembers = null,
  container = false, descriptor = DESCRIPTOR, memberSrc = {},
  scanner = false, scannerParts = {}, scannerWorker = SCANNER_WORKER, agentWorker = AGENT_WORKER, signWith = SIGNER } = {}) {
  const planeSha = await sha(src);
  const boxText = typeof descriptor === "string" ? descriptor : JSON.stringify(descriptor);
  const text = (x) => typeof x === "string" ? x : JSON.stringify(x);
  const scannerTexts = {};
  for (const c of SCANNER_CLASSES) scannerTexts[`container/${c.class_name}.json`] = text(c);
  if (scannerWorker !== null) scannerTexts["worker.json"] = text(scannerWorker);
  for (const [path, t] of Object.entries(scannerParts)) { if (t === null) delete scannerTexts[path]; else scannerTexts[path] = text(t); }
  const partTexts = {};
  const workerPart = async (member, worker) => {
    const t = text(worker);
    partTexts[`${member}/worker.json`] = t;
    return [{ path: "worker.json", type: "Worker", sha256: await sha(t), bytes: t.length }];
  };
  const srcOf = (member) => memberSrc[member] ?? MEMBER_SRC;
  const entry = async (member) => ({ member, asset: `${member}.bundled.mjs`, sha256: await sha(srcOf(member)),
    bytes: srcOf(member).length, compat: { date: "2026-07-01", flags: [] },
    services: member === "agent-worker" ? [{ binding: "PLANE", service: "bio-plane" }] : [],
    parts: member === "ocr-worker" ? [{ path: "assets/x.wasm", type: badType === member ? "Mystery" : "CompiledWasm",
      sha256: await sha(WASM), bytes: WASM.length }]
      : member === RUNNER && container ? [{ path: "container.json", type: "Container", sha256: await sha(boxText), bytes: boxText.length }]
      : member === SCANNER && scanner ? await Promise.all(Object.entries(scannerTexts).map(async ([path, t]) => {
        partTexts[`${member}/${path}`] = t;
        return { path, type: path === "worker.json" ? "Worker" : "Container", sha256: await sha(t), bytes: t.length }; }))
      : member === "agent-worker" && agentWorker !== null ? await workerPart(member, agentWorker)
      : [] });
  if (container && !members.includes(RUNNER)) members = [...members, RUNNER];
  if (scanner && !members.includes(SCANNER)) members = [...members, SCANNER];
  const list = await Promise.all(members.map(entry));
  const plane = { sha256: planeSha, bytes: src.length, asset: "bio-plane.bundled.mjs" };
  const signedList = signedMembers ? await Promise.all(signedMembers.map(entry)) : list;
  const manifest = { version, sha256: planeSha, bytes: src.length, asset: "bio-plane.bundled.mjs",
    ...(sig === "good" ? { sig: await signWith.sign(src) } : sig === "stranger" ? { sig: await STRANGER.sign(src) } : {}),
    ...(fleet ? { fleet: list } : {}),
    ...(fleet && fleetSig === "good" ? { fleetSig: await signWith.sign(fleetStatement({ version, plane, members: signedList }), NS_FLEET) } : {}) };
  const assets = { "bio-plane.bundled.mjs": src };
  for (const m of list) {
    assets[m.asset] = m.member === tamper ? "tampered" : srcOf(m.member);
    if (m.member === missing) delete assets[m.asset];
    for (const p of m.parts) assets[`${m.member}/${p.path}`] = partTexts[`${m.member}/${p.path}`] ?? (p.type === "Container" ? boxText : WASM);
  }
  return { manifest, assets, version, src };
}

/* The release object the installer's choice hands the steps: the plane's bytes as one Blob, its signed manifest, its limits. */
export async function chosen(rel, extra = {}) {
  return { version: rel.version, blob: new Blob([rel.src], { type: "application/javascript+module" }), sha: await sha(rel.src),
    capable: true, from: "repository", man: rel.manifest, limits: LIMITS, ...extra };
}

/* ---- the account: one stateful fake; the network the module reaches, answered here ---- */
export function account({ slug = "grp", plan = "paid", probeDelete = "ok", r2 = "ok", subdomain = "grp", taken = [], subdomainPut = "ok",
  enableFail = false, pre = {}, preBuckets = [], preClasses = {}, preApps = [], preSources = {}, preTags = {}, readBack = "raw",
  rel = null, sourceFlaky = 0, sourceDown = false, sourceChange = null, containers = "ok", rolloutKeepsImage = false,
  refuseSelf = false, refuseAllPlane = false, refuseRePut = false, refuseVpc = false, refuseSchedules = false, dropObservability = false, logpush = [],
  lookupFail = [], settingsBlind = false, blindAfterPut = false, copy = {}, wakeAfter = 0, silentAddress = false, objects = {}, refuseDelete = [],
  expireAfter = null, cfFlaky = null, refuseSecretDelete = false,
  pullFails = false, startingFor = 0, memberServes = null, r2Jurisdictions = ["eu", "us"], r2Answers = null } = {}) {
  const scripts = new Map(Object.entries(pre));
  /* G54: what the account holds of each script's `observability`: the upload's own, unless `dropObservability` (a platform that ignores it). */
  const observed = new Map();
  const buckets = new Set([...(r2 === "exists" ? [`bio-captures-${slug}`] : []), ...preBuckets]);
  const sources = new Map(Object.entries(preSources));
  const tags = new Map(Object.entries(preTags));
  const classes = new Map(Object.entries(preClasses));
  const apps = preApps.map((a) => ({ ...a }));
  const bucketObjects = new Map(Object.entries(objects).map(([b, keys]) => [b, [...keys]]));
  const state = { calls: [], planePuts: [], puts: [], refused: [], rollouts: [], removed: [], schedules: new Map(), enabled: new Set(),
    secretPuts: [], rolledBack: [], reads: [], appReads: 0, bucketJurisdictions: new Map(), sourceRequests: [], addressRequests: [], scripts, buckets, sources, tags, classes, apps, bucketObjects };
  let prefix = subdomain, cfCalls = 0, flakyLeft = cfFlaky ? cfFlaky.times : 0, sourceFlakyLeft = sourceFlaky, wakeTries = 0;
  const verOf = (b) => (b || []).find((x) => x.name === "VERSION")?.text || null;
  const putScript = async (u, init) => {
    const name = u.split("/workers/scripts/")[1];
    const meta = JSON.parse(await init.body.get("metadata").text());
    const explicit = meta.bindings || [];
    const body = await init.body.get("index.mjs").text();
    state.puts.push({ name, meta, form: init.body });
    if (name === slug) {
      const isRePut = state.planePuts.length > 0 && !("migrations" in meta);
      if (refuseAllPlane || (refuseRePut && isRePut) || (refuseSelf && explicit.some((b) => b.name === "SELF"))) {
        state.refused.push(`${name}:refused`);
        return cferr("the upload was refused <b>by the fake</b>", 400, 10021);
      }
    }
    if (refuseVpc && explicit.some((b) => b.type === "vpc_service")) {
      state.refused.push(`${name}:vpc`);
      return cferr("VPC service not found or not permitted <b>by the fake</b>", 403, 10000);
    }
    for (const b of explicit) if (b.type === "service" && b.service !== name && !scripts.has(b.service)) {
      state.refused.push(`${name}:${b.name}->${b.service}`);
      return cferr(`Service binding '${b.name}' references Worker '${b.service}' which was not found`, 400, 10143);
    }
    for (const b of explicit) if (b.type === "durable_object_namespace" && b.script_name && b.script_name !== name
        && !(classes.get(b.script_name) || []).includes(b.class_name)) {
      state.refused.push(`${name}:${b.name}->${b.script_name}.${b.class_name}`);
      return cferr(`Durable Object binding '${b.name}' references class '${b.class_name}' in '${b.script_name}', which was not found`, 400, 10061);
    }
    if (meta.migrations?.new_sqlite_classes) {
      if ((classes.get(name) || []).some((c) => meta.migrations.new_sqlite_classes.includes(c)))
        return cferr("migration tag precondition failed", 400, 10079);
      classes.set(name, [...(classes.get(name) || []), ...meta.migrations.new_sqlite_classes]);
      if (meta.migrations.new_tag) tags.set(name, meta.migrations.new_tag);
    } else if (meta.migrations?.steps) {
      if ((meta.migrations.old_tag ?? null) !== (tags.get(name) ?? null)) return cferr("migration tag precondition failed", 400, 10079);
      for (const st of meta.migrations.steps) classes.set(name, [...(classes.get(name) || []), ...(st.new_sqlite_classes || [])]);
      tags.set(name, meta.migrations.new_tag);
    }
    for (const b of explicit) if (b.type === "durable_object_namespace" && !b.script_name && b.class_name !== "Store"
        && !(classes.get(name) || []).includes(b.class_name)) {
      state.refused.push(`${name}:${b.name}->${b.class_name}`);
      return cferr(`Durable Object binding '${b.name}' references class '${b.class_name}', which this script does not hold`, 400, 10061);
    }
    const kept = (scripts.get(name) || []).filter((b) => (meta.keep_bindings || []).includes(b.type) && !explicit.some((x) => x.name === b.name));
    scripts.set(name, [...explicit, ...kept]);
    observed.set(name, dropObservability ? undefined : meta.observability);
    sources.set(name, body);
    if (name === slug) state.planePuts.push({ meta, bindings: scripts.get(slug), source: body, form: init.body });
    return cfok({ id: name });
  };
  const rules = [
    { m: (u) => u.startsWith(RELEASE_LATEST + "/") || /^https:\/\/raw\.githubusercontent\.com\/believeinoakland\/bio\/v[\d.]+\/release\//.test(u), f: (u) => {
      const tagged = u.startsWith("https://raw.githubusercontent.com/believeinoakland/bio/v");
      const p = tagged ? u.replace(/^.*\/release\//, "") : u.slice(RELEASE_LATEST.length + 1);
      state.sourceRequests.push(p);
      if (sourceDown) return new Response("unavailable", { status: 503 });
      if (sourceFlakyLeft > 0) { sourceFlakyLeft--; return new Response("unavailable", { status: 503 }); }
      if (!rel) return new Response("not found", { status: 404 });
      if (sourceChange && sourceChange(p, state.sourceRequests.filter((x) => x === p).length)) return sourceChange(p, state.sourceRequests.filter((x) => x === p).length);
      return p in rel.assets ? new Response(rel.assets[p]) : new Response("gone", { status: 404 });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/secrets$/.test(u) && mth === "PUT", f: (u, init) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      const { name: secret } = JSON.parse(init.body);
      state.secretPuts.push(`${name}/${secret}`);
      scripts.set(name, [...(scripts.get(name) || []).filter((b) => b.name !== secret), { type: "secret_text", name: secret }]);
      return cfok({ name: secret });
    } },
    { m: (u) => u.endsWith("/logpush/jobs"), f: () => logpush === "refused" ? cferr("Authentication error", 403, 10000) : logpush === "garbled" ? cfok({ not: "a list" }) : cfok(logpush) },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/schedules$/.test(u) && mth === "PUT", f: (u, init) => {
      if (refuseSchedules) return cferr("schedules refused <i>by the fake</i>", 403);
      state.schedules.set(u.split("/workers/scripts/")[1].split("/")[0], JSON.parse(init.body).map((x) => x.cron));
      return cfok({ schedules: JSON.parse(init.body) });
    } },
    { m: (u, mth) => u.includes("/workers/durable_objects/namespaces") && mth === "GET", f: () =>
      cfok([...classes].flatMap(([script, cs]) => cs.map((c) => ({ id: `ns-${script}-${c}`, script, class: c })))) },
    { m: (u) => u.includes("/containers/applications"), f: (u, init) => {
      const mth = (init.method || "GET").toUpperCase();
      if (containers === "read") return cferr("Authentication error", 403, 10000);
      const one = /\/containers\/applications\/([^/]+)(\/rollouts)?$/.exec(u);
      /* `pullFails`: "health" (an instance failed to start) or "rollout" (the rollout failed); `startingFor`: the first n reads of an
         application show it starting and its rollout pending. */
      const starting = () => state.appReads <= startingFor;
      const oneRollout = /\/containers\/applications\/([^/]+)\/rollouts\/([^/]+)$/.exec(u);
      if (mth === "GET" && oneRollout) return cfok({ id: oneRollout[2], status: pullFails === "rollout" ? "failed" : starting() ? "pending" : "completed" });
      if (mth === "GET" && one && !one[2]) {
        const a = apps.find((x) => x.id === one[1]);
        state.appReads++;
        return a ? cfok({ ...a, health: { instances: { active: 0, failed: pullFails === "health" ? 1 : 0, starting: starting() ? 1 : 0 } } }) : cferr("not found", 404);
      }
      if (mth === "GET") return cfok(apps);
      if (mth === "DELETE" && one) {
        const i = apps.findIndex((x) => x.id === one[1]);
        if (i < 0) return cferr("not found", 404);
        state.removed.push("app:" + apps[i].name); apps.splice(i, 1); return cfok({});
      }
      const body = JSON.parse(init.body);
      if (u.endsWith("/rollouts")) {
        if (containers === "rollout") return cferr("rollout refused", 500);
        const id = u.split("/applications/")[1].split("/")[0];
        state.rollouts.push({ id, ...body });
        const a = apps.find((x) => x.id === id);
        if (a && !rolloutKeepsImage) a.configuration = { ...(a.configuration || {}), ...body.target_configuration };
        return cfok({ id: "r" + state.rollouts.length });
      }
      if (containers === "create") return cferr("application refused", 500);
      apps.push({ id: "app" + (apps.length + 1), ...body });
      return cfok(apps.at(-1));
    } },
    { m: (u, mth) => u.endsWith("/workers/scripts") && mth === "GET", f: () =>
      cfok([...scripts.keys()].map((id) => ({ id, ...(tags.has(id) ? { migration_tag: tags.get(id) } : {}) }))) },
    { m: (u) => /\/workers\/scripts\/[^/]+\/deployments$/.test(u), f: (u, init) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      if ((init.method || "GET").toUpperCase() === "POST") { const b = JSON.parse(init.body); state.rolledBack.push({ name, body: b, version: b.versions[0].version_id }); return cfok({}); }
      return cfok({ deployments: [{ id: "d-" + name, versions: [{ version_id: "v-current-" + name, percentage: 100 }] }] });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u.split("?")[0]) && mth === "DELETE" && !u.includes("bio-plan-probe"), f: (u) => {
      const name = u.split("/workers/scripts/")[1].split("?")[0];
      if (refuseDelete.includes(name)) return cferr("deletion refused <i>by the fake</i>", 403, 10000);
      if (!scripts.has(name)) return cferr("not found", 404);
      scripts.delete(name); classes.delete(name); sources.delete(name); state.removed.push(name);
      return cfok({});
    } },
    { m: (u, mth) => /\/r2\/buckets$/.test(u) && mth === "GET", f: () => {
      /* The measured shapes (build/plan/measure-R9-account-shapes.md, K4970). */
      if (r2 === "refused") return cferr("Please enable R2 through the Cloudflare Dashboard.", 403, 10042);
      if (r2 === "permission") return cferr("Authentication error", 403, 10000);
      if (r2 === "unknown") return cferr("The fake could not say", 400, 10001);
      return cfok({ buckets: [...buckets].map((name) => ({ name })) });
    } },
    { m: (u, mth) => /\/r2\/buckets\/[^/]+\/usage$/.test(u) && mth === "GET", f: (u) => {
      const b = u.split("/r2/buckets/")[1].split("/")[0];
      return buckets.has(b) ? cfok({ objectCount: (bucketObjects.get(b) || []).length }) : cferr("The specified bucket does not exist.", 404, 10006);
    } },
    { m: (u, mth) => /\/r2\/buckets\/[^/]+\/objects(\?.*)?$/.test(u) && mth === "GET", f: (u) => {
      const b = u.split("/r2/buckets/")[1].split("/")[0];
      return cfok((bucketObjects.get(b) || []).map((key) => ({ key })));
    } },
    { m: (u, mth) => /\/r2\/buckets\/[^/]+\/objects\/.+$/.test(u) && mth === "DELETE", f: (u) => {
      const [b, key] = u.split("/r2/buckets/")[1].split("/objects/");
      bucketObjects.set(b, (bucketObjects.get(b) || []).filter((k) => k !== decodeURIComponent(key)));
      return cfok({});
    } },
    { m: (u, mth) => /\/r2\/buckets\/[^/]+$/.test(u) && mth === "DELETE", f: (u) => {
      const b = u.split("/r2/buckets/")[1];
      if (refuseDelete.includes(b)) return cferr("deletion refused <i>by the fake</i>", 403, 10000);
      if ((bucketObjects.get(b) || []).length) return cferr("The bucket you tried to delete is not empty.", 409, 10008);
      buckets.delete(b); state.removed.push("bucket:" + b); return cfok({});
    } },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "PUT", f: async (u, init) => {
      if (plan === "free") return cferr("CPU limits are not supported for the Free plan. Switch to a paid plan at https://dash.cloudflare.com/x/workers/plans to set CPU limits.", 400, 100328);
      if (plan === "unknown") return cferr("internal error", 500, 7000);
      scripts.set("bio-plan-probe", [{ limits: JSON.parse(await init.body.get("metadata").text()).limits }]);
      state.probeMeta = JSON.parse(await init.body.get("metadata").text());
      return cfok({});
    } },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => {
      if (probeDelete === "fail") return cferr("busy", 500);
      scripts.delete("bio-plan-probe"); return cfok({});
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/settings$/.test(u) && mth === "GET", f: (u) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      if (lookupFail.includes(name)) return cferr("upstream trouble", 500);
      return scripts.has(name) ? cfok(settingsBlind || (blindAfterPut && state.puts.some((p) => p.name === name)) ? {} : { bindings: (scripts.get(name) || []).map(({ text, ...b }) => (b.type === "plain_text" ? { ...b, text } : b)),
        ...(observed.get(name) ? { observability: observed.get(name) } : {}) })
        : cferr("not found", 404);
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "PUT", f: putScript },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "GET", f: (u) => {
      const name = u.split("/workers/scripts/")[1];
      state.reads.push(name);
      if (!sources.has(name)) return cferr("not found", 404);
      if (readBack === "fail") return cferr("upstream trouble", 500);
      const body = readBack === "differ" || (readBack === "differ-once" && state.reads.filter((n) => n === name).length === 1)
        ? sources.get(name) + "\n/* altered */" : sources.get(name);
      if (readBack !== "multipart") return new Response(body, { headers: { "content-type": "application/javascript+module" } });
      const B = "fakeboundary7";
      return new Response(`--${B}\r\ncontent-disposition: form-data; name="metadata"\r\n\r\n{}\r\n`
        + `--${B}\r\ncontent-disposition: form-data; name="index.mjs"; filename="index.mjs"\r\ncontent-type: application/javascript+module\r\n\r\n${body}\r\n--${B}--\r\n`,
        { headers: { "content-type": `multipart/form-data; boundary=${B}` } });
    } },
    { m: (u, mth) => /\/r2\/buckets\/[^/]+$/.test(u) && mth === "GET", f: (u) => {
      const name = u.split("/r2/buckets/")[1];
      if (lookupFail.includes(name)) return cferr("upstream trouble", 500);
      return buckets.has(name) ? cfok({ name }) : cferr("The specified bucket does not exist.", 404, 10006);
    } },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: async (u, init) => {
      const { name } = JSON.parse(init.body);
      if (r2 === "refused") return cferr("Please enable R2 through the Cloudflare Dashboard.", 403, 10042);
      /* R47: a bucket asked for in a jurisdiction (header `cf-r2-jurisdiction`) the account cannot create there is refused;
         `r2Answers` makes the account answer another jurisdiction than the one asked (a platform that ignored the header). */
      const j = init.headers?.["cf-r2-jurisdiction"] ?? null;
      if (j && !r2Jurisdictions.includes(j)) return cferr(`The jurisdiction '${j}' is not available on this account.`, 403, 10085);
      if (buckets.has(name)) return cferr("The bucket you tried to create already exists", 409, 10073);
      buckets.add(name); state.bucketJurisdictions.set(name, j || "default");
      return cfok({ name, jurisdiction: r2Answers ?? (j || "default") });
    } },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => prefix ? cfok({ subdomain: prefix }) : cferr("You do not have a workers.dev subdomain. Please go to https://dash.cloudflare.com/?to=/:account/workers/workers-and-pages. Opening the Workers & Pages landing page for the first time will create a workers.dev subdomain automatically.", 404, 10007) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "PUT", f: (u, init) => {
      const want = JSON.parse(init.body).subdomain;
      if (subdomainPut === "fail") return cferr("not permitted", 403);
      /* Measured (K4970): a taken prefix is HTTP 403, code 10031. */
      if (taken.includes(want)) return cferr(`Subdomain '${want}' is unavailable. Please try a different one.`, 403, 10031);
      prefix = want; return cfok({ subdomain: want });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/subdomain$/.test(u) && mth === "POST", f: (u) => {
      if (enableFail) return cferr("could not enable", 500);
      state.enabled.add(u.split("/workers/scripts/")[1].split("/")[0]); return cfok({ enabled: true });
    } },
    { m: (u) => /^https:\/\/[^/]+\.workers\.dev\//.test(u), f: (u) => {
      const host = new URL(u).host;
      const [name, pre2] = host.split(".");
      const q = new URL(u).searchParams;
      state.addressRequests.push({ u, op: q.get("op") });
      if (copy.held?.[name] && pre2 === prefix && q.get("op") === "bootstrap") return jres({ ok: true, version: "0.80.0", ...copy.held[name] });
      if (name !== slug || pre2 !== prefix || !scripts.has(slug)) throw new Error("ENOTFOUND " + host);
      if (copy.silent || silentAddress) throw new Error("ENOTFOUND " + host);
      if (wakeAfter > 0 && (wakeTries++) < wakeAfter) throw new Error("ENOTFOUND " + host);
      const v = verOf(scripts.get(slug)) || "0.0.0";
      if (q.get("op") === "selftest") return copy.selftest ? copy.selftest(q) : jres({ ok: true, bindings: { STORE: true } });
      /* `memberServes`: {member: n}: that member serves an older build until n rollouts have been asked. */
      const served = memberServes ? Object.fromEntries(Object.entries(memberServes).map(([m, n]) =>
        [m, { state: "SERVING", version: state.rollouts.length >= n ? v : "0.0.1" }])) : {};
      if (q.get("op") === "bootstrap") return copy.bootstrap ? copy.bootstrap(q, { v }) : jres({ ok: true, version: v, storeVersion: v, memberVersions: served });
      return jres({ ok: false });
    } },
  ];
  globalThis.fetch = async (input, init = {}) => {
    const u = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    state.calls.push({ u, method, init });
    if (u.startsWith(CF_API)) {
      cfCalls++;
      if (expireAfter !== null && cfCalls > expireAfter) return cferr("Invalid access token", 401, 9109);
      if (cfFlaky && flakyLeft > 0 && (!cfFlaky.method || method === cfFlaky.method)) { flakyLeft--; return cferr("slow down", cfFlaky.status, 0); }
    }
    for (const r of rules) if (r.m(u, method)) return r.f(u, init);
    throw new Error(`unscripted fetch: ${method} ${u}`);
  };
  state.restore = () => { globalThis.fetch = realFetch; };
  state.api = (path, init) => fetch(CF_API + `/accounts/A1${path}`, init).then((r) => r.json()).then((j) => j.result);
  state.prefix = () => prefix;
  return state;
}

/* A copy the account already holds, as `account`'s `pre*` options take it: its plane (the class `Store`, its bindings naming its
   buckets), its fleet members and its two buckets, under its slug's names or the older fixed ones; `finished` carries the mark. */
export function heldCopy({ slug, scheme = "slug", finished = true, members = ["pdf-worker", "ocr-worker", "agent-worker"], version = "0.80.0" } = {}) {
  const legacy = scheme === "legacy";
  const captures = legacy ? "bio-captures" : `bio-captures-${slug}`, published = legacy ? "bio-published" : `bio-published-${slug}`;
  const memberName = (m) => (legacy ? m : `${m}-${slug}`);
  const pre = { [slug]: [
    { type: "durable_object_namespace", name: "STORE", class_name: "Store" }, { type: "plain_text", name: "VERSION", text: version },
    { type: "plain_text", name: "INSTANCE_NAME", text: slug }, { type: "secret_text", name: "ADMIN_TOKEN" }, { type: "secret_text", name: "PROBE_TOKEN" },
    { type: "secret_text", name: "DAEMON_TOKEN" }, { type: "secret_text", name: "ACCOUNT_SEAL_SECRET" },
    { type: "r2_bucket", name: "CAPTURES", bucket_name: captures }, { type: "r2_bucket", name: "PUBLISHED", bucket_name: published },
    { type: "service", name: "SELF", service: slug }, { type: "browser", name: "BROWSER" },
    ...FLEET_BINDINGS.filter(([m]) => members.includes(m)).map(([m, name]) => ({ type: "service", name, service: memberName(m) })),
    ...(finished && !legacy ? [{ type: "secret_text", name: "INSTALL_COMPLETE" }] : []),
  ] };
  for (const m of members) pre[memberName(m)] = [{ type: "plain_text", name: "VERSION", text: version }];
  return { pre, preBuckets: [captures, published], preClasses: { [slug]: ["Store"] } };
}
export function heldCopies(...copies) {
  const out = { pre: {}, preBuckets: [], preClasses: {} };
  for (const c of copies.map(heldCopy)) { Object.assign(out.pre, c.pre); out.preBuckets.push(...c.preBuckets); Object.assign(out.preClasses, c.preClasses); }
  return out;
}

/* A scripted fetch for a single call's replies: each reply in order, the last repeated; every request recorded. */
export function sequence(replies) {
  const calls = [];
  let i = 0;
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ u: typeof input === "string" ? input : input.url, init });
    const r = replies[Math.min(i++, replies.length - 1)];
    if (r instanceof Error) throw r;
    return typeof r === "function" ? r() : r.clone();
  };
  return calls;
}
