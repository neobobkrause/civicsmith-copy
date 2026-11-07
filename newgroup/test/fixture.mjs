/* The installer's world, for the requirement-named suite (`requirements.test.mjs`): the Worker driven through its own
 * routes, and everything it reaches over the network answered here. One STATEFUL fake Cloudflare account keeps every
 * script uploaded with its bindings (applying `keep_bindings` by type, refusing a service binding to a worker it does
 * not hold with code 10143), the buckets, the workers.dev prefix and each script's address; the public release
 * repository serves a manifest and assets, or is unreachable; and the copy's address answers `op=selftest` and
 * `op=bootstrap` the way a plane does, derived from what was uploaded. A streamed progress page is parsed back into
 * the steps, the refusal and the final panel it emits.
 */
import worker, { CFG, ARMED_SIGNERS, planeLimits } from "../src/index.mjs";
import { RELEASE_VERSION } from "../src/release.mjs";
import { word } from "../src/words.mjs";
import { CHECK_COOKIE, checkCookieValue } from "../src/ready.mjs";
import { RELEASE_SOURCE } from "./release-text.mjs";
/* The member binding names are instance-setup's (installer R30); the installer holds no table of its own. */
import { instanceGroupAnswer } from "../../bio-plane/test/m/instance-setup/fixtures.mjs";
import { FLEET_BINDINGS } from "../../bio-plane/src/setup-fleet.mjs";
import { fleetStatement, NS_FLEET, NS_RELEASE } from "../../bio-plane/src/sshsig.mjs";
import { readFileSync } from "node:fs";

/* R61: the real built-in release's own files (the repository's `release/` folder), served by a world that keeps them at the
   release's tag; a name not held answers undefined. */
function builtInAssets() {
  return new Proxy({}, { get(_, name) { if (typeof name !== "string") return undefined;
    try { return readFileSync(new URL("../../release/" + name, import.meta.url)); } catch { return undefined; } } });
}

export const TOK = "TOKEN-THAT-MUST-NEVER-APPEAR-IN-OUTPUT";
export const ORIGIN = "https://newgroup.believeinoakland.workers.dev";
export const realFetch = globalThis.fetch;
/* The text of a key before its first fill the caller does not give: every placeholder not in `vars` answers a NUL, and the head is what
   comes before the first one (K3810: a test reads a sentence from the word table, never copies it). */
export const headOf = (key, vars = {}) => word(key, new Proxy(vars, {
  get: (t, k) => (k in t ? t[k] : "\u0000"), getOwnPropertyDescriptor: (t, k) => ({ value: k in t ? t[k] : "\u0000", enumerable: true, configurable: true }),
})).split("\u0000")[0];
/* A pattern for a key's sentence: each fill in `vars` is itself (a string, matched literally, or a RegExp), every other placeholder
   matches anything. A test reads its expectation from the word table through this, never from a copy of the English. */
export const like = (key, vars = {}) => {
  const P = (n) => `\u0001${String(n)}\u0001`;
  const text = word(key, new Proxy({}, { get: (_, n) => P(n), getOwnPropertyDescriptor: (_, n) => ({ value: P(n), enumerable: true, configurable: true }) }));
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(esc(text).replace(/\u0001(\w+)\u0001/g, (_, n) => (n in vars ? (vars[n] instanceof RegExp ? vars[n].source : esc(String(vars[n]))) : "[\\s\\S]*?")), "s");
};
export const jres = (o, status = 200) => new Response(JSON.stringify(o), { status });
export const cfok = (result) => jres({ success: true, result });
export const cferr = (message, status = 400, code = 0) => jres({ success: false, errors: [{ message, code }] }, status);

/* The Worker schedules endpoint of the fake account (installer-steps R39, R84 (3)): GET answers what `schedules` holds (by script name) plus `crons`, PUT stores
   the crons it is given, or is refused. One definition, used by `pageWorld` and by the suites that script their own account. */
export const scheduleRules = ({ schedules = new Map(), crons = {}, refuse = false } = {}) => [
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/schedules$/.test(u) && mth === "GET", f: (u) => {
    const name = u.split("/workers/scripts/")[1].split("/")[0];
    return cfok({ schedules: [...(schedules.get(name) || []), ...(crons[name] || [])].map((cron) => ({ cron })) });
  } },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/schedules$/.test(u) && mth === "PUT", f: (u, init) => {
    const name = u.split("/workers/scripts/")[1].split("/")[0];
    if (refuse === true || (Array.isArray(refuse) && refuse.includes(name))) return cferr("schedules refused <i>by the fake</i>", 403);
    schedules.set(name, JSON.parse(init.body).map((x) => x.cron));
    return cfok({ schedules: JSON.parse(init.body) });
  } },
];

/* R90: an install's `POST /begin` is refused without a passed "Check my account" for its short name (the `chk` cookie). The world
   stands in for the founder who checked first: every install-mode /begin sent to the Worker, through `begin` or straight, carries a
   passed check for the short name it names, unless it already carries a `chk` or says it sends none (`NO_CHECK`, the header the
   gate's own tests set; the Worker never reads it). */
export const NO_CHECK = "x-fixture-no-check";
export const passedCheck = (slug, t = Date.now()) => `${CHECK_COOKIE}=${checkCookieValue(slug, t)}`;
const workerFetch = worker.fetch.bind(worker);
worker.fetch = async (request, ...rest) => {
  if (request.method === "POST" && new URL(request.url).pathname === "/begin" && !request.headers.has(NO_CHECK)) {
    const body = await request.clone().json().catch(() => ({}));
    const install = !["update", "remove", "removeconfirm", "check"].includes(body && body.mode);
    const held = request.headers.get("cookie") || "";
    if (install && body && typeof body.slug === "string" && !new RegExp(`(^|;\\s*)${CHECK_COOKIE}=`).test(held))
      request.headers.set("cookie", [held, passedCheck(body.slug.trim())].filter(Boolean).join("; "));
  }
  return workerFetch(request, ...rest);
};
export const req = (path, init) => worker.fetch(new Request(ORIGIN + path, init));
export const b64url = (s) => Buffer.from(s).toString("base64url");
export const cookieOf = (r) => (r.headers.get("set-cookie") || "").split(";")[0];
export const cookieValue = (cookie) => JSON.parse(Buffer.from(cookie.split("=")[1], "base64url").toString());

/* `extra.chk`: the check this /begin carries (R90): absent, a passed one for `slug` when installing; `false`, none; a string, that
   `chk` value as it is. */
export async function begin(slug, mode = "install", { chk, ...extra } = {}) {
  const headers = chk === false ? { [NO_CHECK]: "1" } : typeof chk === "string" ? { cookie: `${CHECK_COOKIE}=${chk}` }
    : mode === "install" ? { cookie: passedCheck(slug) } : {};
  const r = await req("/begin", { method: "POST", headers, body: JSON.stringify({ slug, mode, ...extra }) });
  const j = await r.json();
  const cookie = cookieOf(r);
  return { r, j, cookie, state: j.ok ? new URL(j.authorize).searchParams.get("state") : null };
}

/* A scripted network: rules matched in order, every call recorded. */
export function script(rules, pre = null) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const u = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    /* T50 (R69): the installer's own lock on the account is bookkeeping, not part of the conversation the suites assert; it is kept apart as `calls.lock`. */
    if (u.includes("/scripts/bio-install-lock")) (calls.lock ||= []).push({ u, method, init }); else calls.push({ u, method, init });
    const early = pre ? await pre(u, method, init) : undefined;
    if (early) return early;
    for (const r of rules) if (r.m(u, method)) return r.f(u, init);
    throw new Error(`unscripted fetch: ${method} ${u}`);
  };
  return calls;
}

/* The streamed page, read back. Everything after the shell's own script is a series of calls to its functions; they
   are run here against recorders, so a label is read exactly as the page's script receives it. */
export function parsePage(raw) {
  const events = [];
  let failed = null, done = null, says = null, retry = null;
  const waits = [];
  const scripts = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const rec = {
    step: (id, label) => events.push({ k: "step", id, label }),
    ok: (id, label) => events.push({ k: "ok", id, label: label ?? null }),
    no: (id, label) => { if (id !== undefined) events.push({ k: "no", id, label: label ?? null }); },
    /* R51, R75: a stop is one sentence by key (`said`), the line to act on beside it (`d`, when its key has one), and the
       step in progress, named by `installer.stopped.at` (`s`). */
    fail: (said, d, s) => { failed = { said, d: d || "", s: s || "" }; },
    done: (html) => { done = html; },
    /* R55: the progress page's one line saying from which release to which, and where. */
    says: (t) => { says = t; },
    /* R66: the line drawn while a wait goes on. */
    waiting: (t) => { waits.push(t); },
    /* R70: the one act offered after a stop that waits for something to be turned on: its label and the body it begins again with. */
    again: (label, body) => { retry = { label, body }; },
  };
  for (const s of scripts.slice(1)) new Function(...Object.keys(rec), s)(...Object.values(rec));
  const status = (id) => { let st = null; for (const e of events) if (e.id === id) st = e.k; return st; };
  const label = (id) => events.filter((e) => e.id === id).map((e) => e.label).filter(Boolean).at(-1) ?? null;
  const steps = [...new Set(events.filter((e) => e.k === "step").map((e) => e.id))];
  /* All the page's words: the shell, every label, the refusal and the panel. */
  const words = [raw.replace(/<script>[\s\S]*?<\/script>/g, ""), ...events.map((e) => e.label || ""),
    failed ? `${failed.said} ${failed.d} ${failed.s}` : "", says || "", done || ""].join("\n");
  return { raw, events, steps, status, label, failed, done, words, says, waits, retry };
}

export async function callback(qs, cookie) {
  const r = await req("/callback?" + qs, { headers: cookie ? { cookie } : {} });
  const raw = await r.text();
  return { r, raw, page: parsePage(raw) };
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
export const disarm = () => { ARMED_SIGNERS.length = 0; };
export const restoreSigners = () => armWith(...SHIPPED);

export const sha = async (x) => Buffer.from(await crypto.subtle.digest("SHA-256",
  typeof x === "string" ? new TextEncoder().encode(x) : x)).toString("hex");
export const bump = (v) => { const p = v.split(".").map(Number); p[2] += 1; return p.join("."); };
/* The release the world serves when a test names none: newer than the built-in, signed by SIGNER, stating its limits,
   naming no fleet. `run` arms SIGNER for that act only. `rel: null` is a repository that does not answer. */
export const DEFAULT_VERSION = bump(RELEASE_VERSION);

/* ---- a release the repository serves ---- */
/* A plane that can report builds (its source carries both fields, so the installer reads it as capable) and one that
   cannot (the releases before D-116). */
/* Each states its limits as the plane does (R20): one string `bio-plane-limits/1 key=n …`, which survives bundling. */
export const LIMITS = Object.freeze({ subrequests: 10000 });
export const LIMITS_STATEMENT = "bio-plane-limits/1 subrequests=10000";
/* The plane's watchdog schedule, as control-plane states it (installer-steps R39, K4570). */
export const CRONS_STATEMENT = "bio-plane-crons/1 */5 * * * *";
export const CAPABLE_SRC = "export default { fetch(){ return Response.json({ storeVersion: 'x', memberVersions: {} }); } }; export class Store {}; export const PLANE_LIMITS_STATEMENT = \"" + LIMITS_STATEMENT + "\";" + " export const PLANE_CRONS_STATEMENT = \"" + CRONS_STATEMENT + "\";";
export const PRE116_SRC = "export default { fetch(){ return new Response('pre-D-116 plane'); } }; export class Store {}; export const PLANE_LIMITS_STATEMENT = '" + LIMITS_STATEMENT + "';" + " export const PLANE_CRONS_STATEMENT = \"" + CRONS_STATEMENT + "\";";
/* A plane from before R20: verified, and stating no limits. */
export const UNSTATED_SRC = "export default { fetch(){ return Response.json({ storeVersion: 'x', memberVersions: {} }); } }; export class Store {};" + " export const PLANE_CRONS_STATEMENT = \"" + CRONS_STATEMENT + "\";";
/* Whether this tree's built-in release states its limits (R20). Until a release cut after control-plane's statement is
   embedded it does not, and an act that falls back to it is refused; the arms that read the built-in assert whichever
   holds, so they survive the cut. */
export const BUILTIN_LIMITS = planeLimits(RELEASE_SOURCE);
export const MEMBER_SRC = "export default { fetch(){ return new Response('member'); } };";
export const WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/* R38: the container member's descriptor, the `Container` part the signed fleet statement covers by its hash. */
export const IMAGE = "docker.io/civicos/agent-runner@sha256:" + "a".repeat(64);
export const DESCRIPTOR = Object.freeze({ class_name: "AgentRunner", image: IMAGE, scheduling_policy: "default", max_instances: 5,
  bind: [{ member: "agent-worker", binding: "RUNNER" }] });
export const RUNNER = "agent-runner";
/* R38, R44 (T36): the two-class container member file-scanner: one `Container` part per class
   (`container/<class_name>.json`), each class bound into the member itself, and its `Worker` part naming its bucket by
   role and its schedule (N772). */
export const SCANNER = "file-scanner";
export const SCAN_IMAGE = "docker.io/civicos/file-scanner-scanner@sha256:" + "d".repeat(64);
export const RENDER_IMAGE = "docker.io/civicos/file-scanner-renderer@sha256:" + "e".repeat(64);
export const SCANNER_CLASSES = Object.freeze([
  Object.freeze({ class_name: "FileScanner", image: SCAN_IMAGE, scheduling_policy: "default", max_instances: 3, bind: [{ member: SCANNER, binding: "SCANNER" }] }),
  Object.freeze({ class_name: "SafeViewRenderer", image: RENDER_IMAGE, scheduling_policy: "default", max_instances: 3, bind: [{ member: SCANNER, binding: "RENDERER" }] }),
]);
export const SCANNER_WORKER = Object.freeze({ r2_buckets: [{ binding: "CAPTURES", bucket: "captures" }], crons: ["17 4 * * *"] });
/* agent-worker's own Durable Objects as its configuration states them (as installer-steps' world does), and its `Worker` part carrying them. */
export const AGENT_OBJECTS = Object.freeze({ bindings: [{ name: "SEGMENTS", class_name: "SegmentDriver" }, { name: "CHECKS", class_name: "CheckRecord" }],
  migrations: [{ tag: "v1", classes: ["SegmentDriver"] }, { tag: "v2", classes: ["CheckRecord"] }] });
export const AGENT_WORKER = Object.freeze({ r2_buckets: [], crons: [], durable_objects: AGENT_OBJECTS });
export const VPC_ID = "0123456789abcdef0123456789abcdef";

/* `members`: the fleet's member names (default: the three the plane binds). Options drop the fleet signature, sign it
   over another set, tamper with a member's bytes, name an unknown part type, or leave the fleet out. `container` adds
   the container member agent-runner with `descriptor` (an object, or raw text) as its `Container` part. `memberSrc`
   gives a member its own bundle text (R39: one stating its limits), hashed into the signed statement like any. */
export async function release({ version, src = CAPABLE_SRC, members = FLEET_BINDINGS.map(([m]) => m), sig = "good",
  fleet = true, fleetSig = "good", tamper = null, badType = null, missing = null, signedMembers = null,
  container = false, descriptor = DESCRIPTOR, memberSrc = {},
  /* `scanner`: adds file-scanner; `scannerParts` replaces its parts' texts by path (a value null drops that part);
     `scannerWorker` its `Worker` part (an object, raw text, or null for none). */
  scanner = false, scannerParts = {}, scannerWorker = SCANNER_WORKER,
  /* `agentWorker`: agent-worker's `Worker` part (an object, raw text, or null for none); its default states its own Durable Objects. */
  agentWorker = AGENT_WORKER,
  /* R43: the key that signs the release and its fleet statement (default SIGNER). */
  signWith = SIGNER } = {}) {
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
    ...(sig === "good" ? { sig: await signWith.sign(src) } : sig === "stranger" ? { sig: await STRANGER.sign(src) }
      : sig === "wrong-ns" ? { sig: await signWith.sign(src, "bio-ratify") } : {}),
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

/* ---- the world: one install or update, end to end ---- */
export async function run({ slug, mode = "install", ai, cookie: givenCookie, state: givenState,
  accounts = [{ id: "A1", name: "Group Account" }], tokenFail = false, tokenFlaky = 0, accountsFail = false, settingsFail = false,
  plan = "paid", probeDelete = "ok", r2 = "ok", pre = {}, subdomain = "grp", taken = [], subdomainPut = "ok",
  enableFail = false, refuseSelf = false, refuseAllPlane = false, refuseRePut = false, refuseUpdate = false,
  lookupFail = [], readBack = "raw", preBuckets = [], rel, copy = {},
  /* R38: the scopes the token response states (null: it states none), and the Containers API. `containers`: "ok", or
     "read" (every Containers call refused), "create" or "rollout" (that call refused); `preApps` the applications held;
     `preClasses` the Durable Object classes each pre-existing script holds. `settingsBlind`: settings answer no bindings.
     `refuseSecretDelete`: a secret's removal refused; `refuseMark`: the install's last mark (INSTALL_COMPLETE) refused. */
  grantedScope = CFG.SCOPES.join(" "), containers = "ok", preApps = [], preClasses = {}, settingsBlind = false,
  refuseSecretDelete = false, refuseMark = false,
  /* G54: the account states each script's `observability` as the last upload sent it; `observabilityDropped` makes it state none (an upload that lost it). */
  observabilityDropped = false, observabilityUnreadable = false,
  /* T36: `vpc` the Workers VPC service the operator names (R45), `refuseVpc` an upload naming one refused; `logpush` the
     account's Logpush jobs, or "refused" (R46); `refuseSchedules` a schedule refused (R44): `true` for every script's, or the names of the scripts whose schedule is refused (the plane's own refusal stops the act, R39). */
  vpc, refuseVpc = false, logpush = [], refuseSchedules = false,
  /* R55 (T48): the release an update is of; by default the one the world serves (the built-in, when the repository does not answer). */
  version,
  /* T50: `alongside` begins an install beside a copy already held (R64); `containersOff` an account with Containers not turned
     on (R70); `expireAfter` the permission expiring after that many Cloudflare calls (R71); `sourceFlaky` the release repository
     answering 503 that many times before it answers, `sourceDown` never (R71); `preSources`/`preTags` the plane text and the
     migration tag a pre-existing script holds; `rolloutKeepsImage` a rollout that answers and changes nothing (R68);
     `silentAddress` an address that never answers; `wakeAfter` an address that answers only after that many tries (R66);
     `cfFlaky` Cloudflare answering that status that many times first (R66); `typed` the short name typed to confirm a removal;
     `choice` the mode a /begin carries (R62). */
  alongside = false, containersOff = false, containersOdd = false, expireAfter = null, sourceFlaky = 0, sourceDown = false, preSources = {}, preTags = {},
  rolloutKeepsImage = false, silentAddress = false, wakeAfter = 0, cfFlaky = null, typed, objects = {}, refuseDelete = [], lockedBy = null,
  builtInFleet = false, crons = {},
  /* R84 (1): the answer to the storage entitlement read (`GET /r2/buckets`): "off" (R2's not-entitled answer, code 10042: documented
     shape), "permission", "error" (a 500, waited out and then a lasting failure), "other" (a refusal of another kind); `choose` the founder's choices a /begin carries: `account` and `subdomain`. */
  storage = "ok", choose = {},
  /* R78 (K3868): what the copy records as its producing team when the run asks: a short name (the default, the slug: a copy that
     recorded it at its first boot), `null` (records none: `group: null`), or "silent" (does not answer `op=instancegroup`);
     `seedRefused` the code `op=instancegroupseed` refuses with; `groupFlat` answers `op=instancegroup` with the group at the top level
     (the shape a plane does not answer: the control that the group is read inside `result`). */
  group = undefined, seedRefused = null, groupFlat = false } = {}) {
  const signersBefore = [...ARMED_SIGNERS];
  if (rel === undefined) { rel = await release({ version: DEFAULT_VERSION, fleet: false }); armWith(SIGNER.line); }
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const acct = new Map(Object.entries(pre));
  /* `r2: "exists"` an account already holding the slug's bucket (R64's name); `"late"` one whose bucket appears between the install's look (R32,
     which reads it absent) and its creation (R7, which meets "already exists"): a race, the only way an install meets one. */
  const buckets = new Set([...(r2 === "exists" || r2 === "late" ? [`bio-captures-${slug}`] : []), ...preBuckets]);
  /* What each script was last uploaded with, as the account would hand it back (R33's read-back). `readBack`: "raw" (the
     module itself), "multipart" (the module as the `index.mjs` part), "differ" (other bytes, every time), "differ-once"
     (other bytes on the first read only), "fail" (the read refused). */
  const sources = new Map(Object.entries(preSources));
  const tags = new Map(Object.entries(preTags));
  const bucketObjects = new Map(Object.entries(objects).map(([b, keys]) => [b, [...keys]]));
  const removed = [];
  let cfCalls = 0, flakyLeft = cfFlaky ? cfFlaky.times : 0, sourceFlakyLeft = sourceFlaky, wakeTries = 0, deployments = new Map();
  const reads = [];
  const classes = new Map(Object.entries(preClasses));
  const apps = preApps.map((a) => ({ ...a }));
  const rollouts = [], deleted = [], schedules = new Map();
  const refused = [], planePuts = [], enabled = new Set(), secretPuts = [];
  const tagged_world = builtInFleet ? builtInAssets() : {};
  let recordedGroup = group === undefined ? slug : group === "silent" ? null : group;
  const seeds = [];
  const observed = new Map();
  let prefix = subdomain;
  const verOf = (b) => (b || []).find((x) => x.name === "VERSION")?.text || null;
  const membersOf = () => {
    const pb = acct.get(slug) || [];
    return Object.fromEntries(FLEET_BINDINGS.map(([member, binding]) => {
      const b = pb.find((x) => x.type === "service" && x.name === binding);
      if (!b) return [member, { binding, state: "UNBOUND" }];
      if (!acct.has(b.service)) return [member, { binding, state: "SILENT" }];
      if (b.service !== member && b.service !== `${member}-${slug}`) return [member, { binding, state: "MISNAMED", name: b.service, version: verOf(acct.get(b.service)) }];
      return [member, { binding, state: "SERVING", version: copy.memberVersion ?? verOf(acct.get(b.service)) }];
    }));
  };
  const putScript = async (u, init) => {
    const name = u.split("/workers/scripts/")[1];
    const meta = JSON.parse(await init.body.get("metadata").text());
    const explicit = meta.bindings || [];
    if (name === slug) {
      const isRePut = planePuts.length > 0 && !("migrations" in meta) && mode === "install";
      if (refuseAllPlane || (refuseUpdate && mode === "update" && planePuts.length === 0) || (refuseRePut && isRePut)
          || (refuseSelf && explicit.some((b) => b.name === "SELF"))) {
        refused.push(`${name}:refused`);
        return cferr("the upload was refused <b>by the fake</b>", 400, 10021);
      }
    }
    if (refuseVpc && explicit.some((b) => b.type === "vpc_service")) {
      refused.push(`${name}:vpc`);
      return cferr("VPC service not found or not permitted <b>by the fake</b>", 403, 10000);
    }
    for (const b of explicit) if (b.type === "service" && b.service !== name && !acct.has(b.service)) {
      refused.push(`${name}:${b.name}->${b.service}`);
      return cferr(`Service binding '${b.name}' references Worker '${b.service}' which was not found`, 400, 10143);
    }
    /* A cross-script Durable Object binding names a class the other script must hold. */
    for (const b of explicit) if (b.type === "durable_object_namespace" && b.script_name && b.script_name !== name
        && !(classes.get(b.script_name) || []).includes(b.class_name)) {
      refused.push(`${name}:${b.name}->${b.script_name}.${b.class_name}`);
      return cferr(`Durable Object binding '${b.name}' references class '${b.class_name}' in '${b.script_name}', which was not found`, 400, 10061);
    }
    if (meta.migrations?.new_sqlite_classes) {
      if ((classes.get(name) || []).some((c) => meta.migrations.new_sqlite_classes.includes(c)))
        return cferr("migration tag precondition failed", 400, 10079);
      classes.set(name, [...(classes.get(name) || []), ...meta.migrations.new_sqlite_classes]);
      if (meta.migrations.new_tag) tags.set(name, meta.migrations.new_tag);
    } else if (meta.migrations?.steps) {
      /* a multi-step migration: its old tag must be the tag the script holds, and it creates each step's classes in order */
      if ((meta.migrations.old_tag ?? null) !== (tags.get(name) ?? null)) return cferr("migration tag precondition failed", 400, 10079);
      for (const st of meta.migrations.steps) classes.set(name, [...(classes.get(name) || []), ...(st.new_sqlite_classes || [])]);
      tags.set(name, meta.migrations.new_tag);
    }
    /* a Durable Object binding names a class the script itself, or the script it names, must hold */
    for (const b of explicit) if (b.type === "durable_object_namespace" && !b.script_name && b.class_name !== "Store"
        && !(classes.get(name) || []).includes(b.class_name)) {
      refused.push(`${name}:${b.name}->${b.class_name}`);
      return cferr(`Durable Object binding '${b.name}' references class '${b.class_name}', which this script does not hold`, 400, 10061);
    }
    const kept = (acct.get(name) || []).filter((b) => (meta.keep_bindings || []).includes(b.type)
      && !explicit.some((x) => x.name === b.name));
    acct.set(name, [...explicit, ...kept]);
    observed.set(name, meta.observability);
    sources.set(name, await init.body.get("index.mjs").text());
    if (name === slug) planePuts.push({ meta, bindings: acct.get(slug), source: await init.body.get("index.mjs").text(), form: init.body });
    return cfok({ id: name });
  };
  const API = CFG.API;
  const rolledBack = [];
  const rules = [
    { m: (u) => u.startsWith(CFG.RELEASE_LATEST + "/") || /^https:\/\/raw\.githubusercontent\.com\/believeinoakland\/bio\/v[\d.]+\/release\//.test(u), f: (u) => {
      const tagged = u.startsWith("https://raw.githubusercontent.com/believeinoakland/bio/v");
      const p = tagged ? u.replace(/^.*\/release\//, "") : u.slice(CFG.RELEASE_LATEST.length + 1);
      if (!tagged && p === "RELEASE.json" && rel) return jres(rel.manifest);
      if (sourceDown && p !== "RELEASE.json") return new Response("unavailable", { status: 503 });
      if (sourceFlakyLeft > 0 && p !== "RELEASE.json") { sourceFlakyLeft--; return new Response("unavailable", { status: 503 }); }
      if (tagged && tagged_world[p] !== undefined) return new Response(tagged_world[p]);
      if (!rel || tagged) return new Response("not found", { status: 404 });
      return p in rel.assets ? new Response(rel.assets[p]) : new Response("gone", { status: 404 });
    } },
    { m: (u) => u === CFG.TOKEN, f: () => tokenFlaky-- > 0 ? new Response("unavailable", { status: 503 }) : tokenFail ? jres({ error: "invalid_grant", error_description: "code spent" }, 400)
      : jres({ access_token: TOK, ...(grantedScope === null ? {} : { scope: grantedScope }) }) },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/secrets$/.test(u) && mth === "PUT", f: (u, init) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      const { name: secret } = JSON.parse(init.body);
      if (refuseMark && secret === "INSTALL_COMPLETE") return cferr("mark refused <i>by the fake</i>", 400);
      secretPuts.push(`${name}/${secret}`);
      acct.set(name, [...(acct.get(name) || []).filter((b) => b.name !== secret), { type: "secret_text", name: secret }]);
      return cfok({ name: secret });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/secrets\/[^/]+$/.test(u) && mth === "DELETE", f: (u) => {
      const [name, , secret] = u.split("/workers/scripts/")[1].split("/");
      if (refuseSecretDelete) return cferr("secret removal refused <i>by the fake</i>", 500);
      acct.set(name, (acct.get(name) || []).filter((b) => b.name !== secret));
      deleted.push(`${name}/${secret}`);
      return cfok({});
    } },
    { m: (u) => u.endsWith("/logpush/jobs"), f: () => logpush === "refused" ? cferr("Authentication error", 403, 10000) : cfok(logpush) },
    /* R84 (3): the scheduled jobs a Worker holds (`crons`: more, for a script of the account's, by name). */
    ...scheduleRules({ schedules, crons, refuse: refuseSchedules }),
    { m: (u, mth) => u.includes("/workers/durable_objects/namespaces") && mth === "GET", f: () =>
      cfok([...classes].flatMap(([script, cs]) => cs.map((c) => ({ id: `ns-${script}-${c}`, script, class: c })))) },
    { m: (u) => u.includes("/containers/applications"), f: (u, init) => {
      const mth = (init.method || "GET").toUpperCase();
      if (containersOdd) return cferr("Something unexpected happened with the request", 400, 10001);
      /* R84 (2): the plan refusal as measured on the Free rehearsal account (HTTP 401, code 1000, K4970; build/plan/measure-R9-account-shapes.md), then the permission one below (documented shape). */
      if (containersOff) return cferr(JSON.stringify({ error: "Unauthorized: You do not have access to Cloudflare Containers. Deploying containers requires the Workers Paid plan. Upgrade your plan at https://dash.cloudflare.com/?to=/:account/workers/plans" }), 401, 1000);
      if (containers === "read") return cferr("Authentication error", 403, 10000);
      if (containers === "bare1000") return cferr("Something else answered code 1000", 400, 1000);
      if (containers === "expired") return cferr("Authentication error", 401, 10000);
      const one = /\/containers\/applications\/([^/]+)(\/rollouts)?$/.exec(u);
      if (mth === "GET" && one && !one[2]) { const a = apps.find((x) => x.id === one[1]); return a ? cfok(a) : cferr("not found", 404); }
      if (mth === "GET") return cfok(apps);
      if (mth === "DELETE" && one) {
        const i = apps.findIndex((x) => x.id === one[1]);
        if (i < 0) return cferr("not found", 404);
        removed.push("app:" + apps[i].name); apps.splice(i, 1); return cfok({});
      }
      const body = JSON.parse(init.body);
      if (u.endsWith("/rollouts")) {
        if (containers === "rollout") return cferr("rollout refused", 500);
        const id = u.split("/applications/")[1].split("/")[0];
        rollouts.push({ id, ...body });
        const a = apps.find((x) => x.id === id);
        if (a && !rolloutKeepsImage) a.configuration = { ...(a.configuration || {}), ...body.target_configuration };
        return cfok({ id: "r" + rollouts.length });
      }
      if (containers === "create") return cferr("application refused", 500);
      apps.push({ id: "app" + (apps.length + 1), ...body });
      return cfok(apps.at(-1));
    } },
    { m: (u, mth) => u.endsWith("/workers/scripts") && mth === "GET", f: () =>
      cfok([...acct.keys()].map((id) => ({ id, ...(tags.has(id) ? { migration_tag: tags.get(id) } : {}) }))) },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/deployments$/.test(u), f: (u, init) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      if ((init.method || "GET").toUpperCase() === "POST") { const b = JSON.parse(init.body); rolledBack.push({ name, version: b.versions[0].version_id }); return cfok({}); }
      return cfok({ deployments: [{ id: "d-" + name, versions: [{ version_id: deployments.get(name) || "v-current-" + name, percentage: 100 }] }] });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u.split("?")[0]) && mth === "DELETE" && !u.includes("bio-plan-probe"), f: (u) => {
      const name = u.split("/workers/scripts/")[1].split("?")[0];
      if (refuseDelete.includes(name)) return cferr("deletion refused <i>by the fake</i>", 403, 10000);
      if (!acct.has(name)) return cferr("not found", 404);
      acct.delete(name); classes.delete(name); sources.delete(name); removed.push(name);
      return cfok({});
    } },
    { m: (u, mth) => /\/r2\/buckets$/.test(u) && mth === "GET", f: () => storage === "off" ? cferr("Please enable R2 through the Cloudflare Dashboard.", 403, 10042)
      : storage === "permission" ? cferr("Authentication error", 403, 10000) : storage === "error" ? cferr("Internal error", 500, 7003) : storage === "other" ? cferr("The request could not be understood by R2", 400, 10001) : cfok({ buckets: (r2 === "late" ? [] : [...buckets]).map((name) => ({ name })) }) },
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
      buckets.delete(b); removed.push("bucket:" + b); return cfok({});
    } },
    { m: (u) => u === `${API}/accounts`, f: () => accountsFail ? cferr("forbidden", 403) : cfok(accounts) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "PUT", f: async (u, init) => {
      if (plan === "free") return cferr("CPU limits are not supported for the Free plan.", 400, 100328);
      if (plan === "unknown") return cferr("internal error", 500, 7000);
      acct.set("bio-plan-probe", [{ limits: JSON.parse(await init.body.get("metadata").text()).limits }]);
      return cfok({});
    } },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => {
      if (probeDelete === "fail") return cferr("busy", 500);
      acct.delete("bio-plan-probe"); return cfok({});
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/settings$/.test(u) && mth === "GET", f: (u) => {
      const name = u.split("/workers/scripts/")[1].split("/")[0];
      if (observabilityUnreadable && name === slug && planePuts.length > 0) return cfok({});
      if (settingsFail || lookupFail.includes(name)) return cferr("upstream trouble", 500);
      /* Settings name each binding, a secret by its name and type only. */
      return acct.has(name) ? cfok(settingsBlind ? {} : { ...(observed.get(name) === undefined || observabilityDropped ? {} : { observability: observed.get(name) }), bindings: (acct.get(name) || []).map(({ text, ...b }) => (b.type === "plain_text" ? { ...b, text } : b)) })
        : cferr("not found", 404);
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "PUT", f: putScript },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "GET", f: (u) => {
      const name = u.split("/workers/scripts/")[1];
      reads.push(name);
      if (!sources.has(name)) return cferr("not found", 404);
      if (readBack === "fail") return cferr("upstream trouble", 500);
      const body = readBack === "differ" || (readBack === "differ-once" && reads.filter((n) => n === name).length === 1)
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
      return buckets.has(name) && r2 !== "late" ? cfok({ name }) : cferr("The specified bucket does not exist.", 404, 10006);
    } },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: async (u, init) => {
      const { name } = JSON.parse(init.body);
      if (r2 === "refused") return cferr("Account not entitled to this feature.", 403, 10042);
      /* R2's BucketConflict, code 10073 (documented shape; BOB measures on the rehearsal account, K4942): the install matches the code, never the words. */
      if (buckets.has(name)) return cferr(`The bucket you tried to create already exists`, 409, 10073);
      buckets.add(name); return cfok({ name });
    } },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => prefix ? cfok({ subdomain: prefix })
      : cferr("You do not have a workers.dev subdomain. Please go to https://dash.cloudflare.com/?to=/:account/workers/workers-and-pages. Opening the Workers & Pages landing page for the first time will create a workers.dev subdomain automatically.", 404, 10007) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "PUT", f: (u, init) => {
      const want = JSON.parse(init.body).subdomain;
      if (subdomainPut === "fail") return cferr("not permitted", 403);
      if (subdomainPut === "down") return cferr("upstream trouble", 500);
      if (taken.includes(want)) return cferr(`Subdomain '${want}' is unavailable. Please try a different one.`, 403, 10031);
      prefix = want; return cfok({ subdomain: want });
    } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/subdomain$/.test(u) && mth === "POST", f: (u) => {
      if (enableFail) return cferr("could not enable", 500);
      enabled.add(u.split("/workers/scripts/")[1].split("/")[0]); return cfok({ enabled: true });
    } },
    { m: (u) => /^https:\/\/[^/]+\.workers\.dev\//.test(u) && !u.startsWith(ORIGIN), f: async (u, init = {}) => {
      const host = new URL(u).host;
      const [name, pre2] = host.split(".");
      /* R63: a copy already held answers what its facts say (`copy.held[slug]`), or nothing. */
      if (name !== slug && copy.held?.[name] && pre2 === prefix && new URL(u).searchParams.get("op") === "bootstrap")
        return jres({ ok: true, version: "0.80.0", ...copy.held[name] });
      if (name !== slug || pre2 !== prefix || !acct.has(slug)) throw new Error("ENOTFOUND " + host);
      if (copy.silent || silentAddress) throw new Error("ENOTFOUND " + host);
      if (wakeAfter > 0 && (wakeTries++) < wakeAfter) throw new Error("ENOTFOUND " + host);
      const q = new URL(u).searchParams;
      const v = verOf(acct.get(slug)) || "0.0.0";
      if (q.get("op") === "instancegroup") {
        if (group === "silent") throw new Error("ENOTFOUND " + host);
        if (groupFlat) return jres({ ok: true, group: recordedGroup });
        /* instance-setup's published `instancegroup` answers (R3), made by its real code. */
        const answers = await instanceGroupAnswer({ group: recordedGroup || "none" });
        return jres({ ok: true, result: recordedGroup ? answers.recorded : answers.none, store: "STORE" });
      }
      if (q.get("op") === "instancegroupseed") {
        seeds.push({ u, init });
        if (seedRefused) return jres({ ok: false, result: { ok: false, code: seedRefused } });
        if (recordedGroup) return jres({ ok: false, result: { ok: false, code: "GROUP_ALREADY_RECORDED", group: recordedGroup } });
        recordedGroup = JSON.parse(init.body).slug;
        return jres({ ok: true, result: { ok: true, group: recordedGroup }, store: "STORE" });
      }
      if (q.get("op") === "selftest") return copy.selftest ? copy.selftest(q) : jres({ ok: true, bindings: { STORE: true } });
      if (q.get("op") === "bootstrap") {
        if (copy.bootstrap) return copy.bootstrap(q, { v, members: membersOf() });
        const before = copy.before === undefined ? v : copy.before;
        if (!q.get("members") && copy.seenBefore !== true) { copy.seenBefore = true; return before === null
          ? new Response("unavailable", { status: 503 }) : jres({ ok: true, version: before }); }
        return jres({ ok: true, version: v, storeVersion: copy.storeVersion ?? v, memberVersions: membersOf() });
      }
      return jres({ ok: false });
    } },
  ];
  const calls = script(rules, (u, method, init) => {
    if (!u.startsWith(API)) return undefined;
    cfCalls++;
    if (expireAfter !== null && cfCalls > expireAfter) return cferr("Invalid access token", 401, 9109);
    if (cfFlaky && flakyLeft > 0 && (!cfFlaky.path || u.includes(cfFlaky.path)) && (!cfFlaky.method || method === cfFlaky.method)) {
      flakyLeft--; return cferr("slow down", cfFlaky.status, 0);
    }
    return undefined;
  });
  let ck = givenCookie, st = givenState;
  if (!ck) ({ cookie: ck, state: st } = await begin(slug, mode, { ...(ai === undefined ? {} : { instanceAi: ai }),
    ...(alongside ? { alongside: true } : {}), ...(typed === undefined ? {} : { typed }),
    ...(mode === "update" ? { version: version ?? (rel ? rel.version : RELEASE_VERSION) } : {}),
    ...(vpc === undefined ? {} : { securityVpc: vpc }), ...choose }));
  let out;
  try { out = await callback(`code=GOODCODE&state=${st}`, ck); }
  finally { globalThis.setTimeout = realTimeout; globalThis.fetch = realFetch; armWith(...signersBefore); }
  return { ...out, calls, acct, buckets, refused, planePuts, enabled, prefix: () => prefix, membersOf, reads, apps, rollouts,
    classes, deleted, schedules, removed, secretPuts, sources, tags, rolledBack, bucketObjects, seeds, recorded: () => recordedGroup };
}

/* The binding a plane PUT carried, by name. */
export const bindingOf = (put, name) => (put?.meta?.bindings || []).find((b) => b.name === name) ?? null;

/* R41: a page's own script, run as a browser runs it, against a stand-in for the few elements it touches: each element
   with an id, and each checkbox and radio by name. `fetch` and `location` are recorded; a click runs its listeners. */
export function pageWorld(page) {
  const els = new Map(), inputs = [];
  const make = (tag, attrs) => {
    const el = { tag, attrs, value: "", checked: false, disabled: false, textContent: "", dataset: {}, open: false, on: {},
      selectionStart: 0, addEventListener(k, f) { (this.on[k] ||= []).push(f); }, focus() {}, setSelectionRange() {},
      showModal() { this.open = true; }, close() { this.open = false; },
      async click() { if (this.disabled) return; for (const f of this.on.click || []) await f({ target: this }); } };
    return el;
  };
  for (const [, tag, attrs] of page.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
    const id = attrs.match(/\bid="([^"]+)"/)?.[1], name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const el = make(tag, attrs);
    if (id) els.set(id, el);
    if (tag === "input" && name) inputs.push(Object.assign(el, { name, value: attrs.match(/\bvalue="([^"]*)"/)?.[1] ?? "" }));
  }
  const document = {
    querySelector: (q) => q.startsWith("#") ? els.get(q.slice(1)) ?? null
      : inputs.find((i) => q === `input[name="${i.name}"]:checked` && i.checked) ?? null,
    querySelectorAll: (q) => inputs.filter((i) => q === `input[name="${i.name}"]`),
    getElementById: (id) => els.get(id) ?? null,
  };
  const sent = [], location = { href: null };
  const fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) });
    return { json: async () => ({ ok: true, authorize: "https://dash.cloudflare.com/oauth2/auth?x=1" }) }; };
  const [js] = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  new Function("document", "fetch", "location", js)(document, fetch, location);
  return { el: (id) => els.get(id), sent, location };
}

/* A copy the account already holds, as `run`'s `pre*` options take it: its plane (the class `Store`, its bindings naming its
   buckets), its fleet members and its two buckets, under its slug's names or the older fixed ones; `finished` carries the mark
   the installer writes last (R69), and a copy under the fixed names is finished by having been installed before it. */
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
/* Several held copies as one set of `run` options. */
export function heldCopies(...copies) {
  const out = { pre: {}, preBuckets: [], preClasses: {} };
  for (const c of copies.map(heldCopy)) { Object.assign(out.pre, c.pre); out.preBuckets.push(...c.preBuckets); Object.assign(out.preClasses, c.preClasses); }
  return out;
}
