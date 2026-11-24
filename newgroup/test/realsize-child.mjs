/* R33 at the release's real size, in its own Node process (run by `realsize.test.mjs`; not a test itself).
 *
 * The installer's built bundle (the file a Worker would run: ASCII source, the release packed in one literal) is imported
 * into a process that stands for a Worker's 128 MB, and one install or update is driven end to end against a lean stand-in
 * for the account: it keeps no script in memory (each uploaded module is written to disk and read back from disk, as the
 * account keeps it), so what is measured is the installer's own memory, not the fake's.
 *
 * What is measured: the LIVE set (see `live`, after a full collection), sampled at
 * every point a large buffer is made or consumed (a response read into memory, a text decoded or encoded, a digest, the
 * upload's body serialised as `fetch` buffers it), and, to be conservative, with that serialised copy held while sampled.
 * Prints one JSON line: `{peakMB, baselineMB, samples, ...what the act did}`.
 */
import { createWriteStream, readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";

const cfg = JSON.parse(process.argv[2]);
const MB = 1e6;
/* The live set: the V8 heap, the external memory the bundle's own source holds (read once at the baseline), and whichever is
   larger of the process's ArrayBuffers (Buffers and Blobs, which Node counts in different places) and the external memory's
   growth since the baseline. Read after a full collection, so only what a Worker could not shed is counted. */
let ext0 = null;
const live = () => { globalThis.gc(); globalThis.gc(); const u = process.memoryUsage();
  if (ext0 === null) return u.heapUsed + u.external;
  return u.heapUsed + ext0 + Math.max(u.arrayBuffers, u.external - ext0); };
/* What the stand-in itself holds while it answers (the body it serves, which a real account holds, not the installer):
   taken off every sample. Released when the installer's next call starts, its answer having been read by then. */
let mockHeld = 0;
const samples = [];
let peak = 0;
const sample = (what) => { const v = live() - mockHeld; samples.push([what, Math.round(v / MB)]); if (v > peak) peak = v; };
const BIG = 1e6;

/* Sample where a large buffer is made or consumed, in the installer's own calls to these. */
const wrap = (obj, name, after) => { const f = obj[name]; obj[name] = function (...a) { const r = f.apply(this, a); return after(r, a); }; };
const sizeOf = (x) => x == null ? 0 : typeof x === "string" ? x.length : (x.byteLength ?? x.size ?? 0);
wrap(Response.prototype, "arrayBuffer", (p) => p.then((ab) => { if (ab.byteLength >= BIG) sample("arrayBuffer " + Math.round(ab.byteLength / MB)); return ab; }));
wrap(TextDecoder.prototype, "decode", (r, a) => { if (sizeOf(a[0]) >= BIG || sizeOf(r) >= BIG) sample("decode"); return r; });
wrap(TextEncoder.prototype, "encode", (r) => { if (sizeOf(r) >= BIG) sample("encode"); return r; });
const digest = crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest = (alg, data) => { if (sizeOf(data) >= BIG) sample("digest"); return digest(alg, data); };
const RealBlob = globalThis.Blob;
globalThis.Blob = class Blob extends RealBlob { constructor(parts, o) { super(parts, o); if (this.size >= BIG) sample("Blob " + Math.round(this.size / MB)); } };

const mod = await import(cfg.bundle);
const worker = mod.default, { CFG, ARMED_SIGNERS } = mod;
if (cfg.signer) { ARMED_SIGNERS.length = 0; ARMED_SIGNERS.push(cfg.signer); }
const baseline = live();
ext0 = process.memoryUsage().external;
/* The process's resident high-water mark so far (the bundle's load): what the act adds above it is read at the end, which also
   catches a transient no sample point sees (a string split into pieces, an array built a byte at a time). */
const rssPeak0 = process.resourceUsage().maxRSS;
peak = baseline;

/* ---- the stand-in account ---- */
mkdirSync(cfg.dir, { recursive: true });
const ORIGIN = "https://newgroup.believeinoakland.workers.dev";
const slug = cfg.slug;
const scripts = new Map(), buckets = new Set();
let prefix = "grp", version = null;
const ok = (result) => new Response(JSON.stringify({ success: true, result }));
const bad = (message, status = 400, code = 0) => new Response(JSON.stringify({ success: false, errors: [{ message, code }] }), { status });
const fileOf = (name) => join(cfg.dir, name + ".mjs");
for (const name of cfg.pre || []) scripts.set(name, { bindings: [{ type: "secret_text", name: "ACCOUNT_SEAL_SECRET" }, { type: "secret_text", name: "ADMIN_TOKEN" }], put: false });
let uploads = 0, reads = 0;
const members = new Map();
/* The Durable Object classes each uploaded script holds (its migrations) and the Containers applications made for them: the
   release's container members are placed on a class's namespace, so the stand-in answers both as the account does. */
const classes = new Map(), apps = [];

async function putScript(name, init) {
  /* The body is counted as it streams, never held (the stand-in is not the installer, and a real account does not hold it either);
     sampled once it has all gone by, so the installer's own Blob is what stands in the live set. */
  let sent = 0;
  for await (const chunk of new Response(init.body).body) sent += chunk.length;
  sample("upload body streamed " + name + " " + Math.round(sent / MB));
  const meta = JSON.parse(await init.body.get("metadata").text());
  const file = init.body.get("index.mjs");
  await pipeline(Readable.fromWeb(file.stream()), createWriteStream(fileOf(name)));
  scripts.set(name, { bindings: meta.bindings || [], put: true });
  const mig = meta.migrations || {};
  classes.set(name, [...new Set([...(classes.get(name) || []), ...(mig.new_sqlite_classes || []), ...(mig.new_classes || []),
    ...(mig.steps || []).flatMap((st) => [...(st.new_sqlite_classes || []), ...(st.new_classes || [])])])]);
  if (name === slug) { uploads++; version = (meta.bindings || []).find((b) => b.name === "VERSION")?.text ?? version; }
  else if (name.endsWith("-" + slug)) members.set(name.slice(0, -slug.length - 1), (meta.bindings || []).find((b) => b.name === "VERSION")?.text ?? null);
  return ok({ id: name });
}
/* The module as the account hands it back: the multipart body the management API answers with, or the module itself. */
function readScript(name) {
  reads++;
  const module = readFileSync(fileOf(name));
  if (cfg.differ) module[module.length >> 1] ^= 1;
  const body = cfg.readBack === "multipart"
    ? Buffer.concat([Buffer.from(`--bnd9\r\ncontent-disposition: form-data; name="metadata"\r\n\r\n{}\r\n--bnd9\r\ncontent-disposition: form-data; name="index.mjs"; filename="index.mjs"\r\ncontent-type: application/javascript+module\r\n\r\n`),
      module, Buffer.from("\r\n--bnd9--\r\n")])
    : module;
  mockHeld = body.length;
  return new Response(body, { headers: { "content-type": cfg.readBack === "multipart"
    ? "multipart/form-data; boundary=bnd9" : "application/javascript+module" } });
}

/* R61: the built-in release's own members are fetched from its tag; the stand-in serves them from the release's committed files. */
const TAGGED = /^https:\/\/raw\.githubusercontent\.com\/believeinoakland\/bio\/v[\d.]+\/release\//;
const rules = [
  { m: (u) => TAGGED.test(u), f: (u) => {
    const p = u.replace(TAGGED, "");
    if (cfg.real && existsSync(join(cfg.real, p)) && statSync(join(cfg.real, p)).isFile()) { const body = readFileSync(join(cfg.real, p)); mockHeld = body.length; return new Response(body); }
    return new Response("not found", { status: 404 });
  } },
  { m: (u, mth) => u.endsWith("/workers/scripts") && mth === "GET", f: () => ok([...scripts.keys()].map((id) => ({ id }))) },
  { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "GET", f: () => ok({ buckets: [...buckets].map((name) => ({ name })) }) },
  { m: (u, mth) => u.includes("/workers/durable_objects/namespaces") && mth === "GET",
    f: () => ok([...classes].flatMap(([script, cs]) => cs.map((c) => ({ id: `ns-${script}-${c}`, script, class: c })))) },
  { m: (u) => u.includes("/containers/applications"), f: (u, init = {}) => {
    const mth = (init.method || "GET").toUpperCase(), one = /\/containers\/applications\/([^/]+)(\/rollouts(\/[^/]+)?)?$/.exec(u);
    if (one && one[2]) return mth === "GET" ? ok({ id: "r1", status: "completed" }) : ok({ id: "r1" });
    if (one) return ok({ ...apps.find((a) => a.id === one[1]), health: { instances: { active: 0, failed: 0, starting: 0 } } });
    if (mth === "POST") { apps.push({ id: "app" + (apps.length + 1), ...JSON.parse(init.body) }); return ok(apps.at(-1)); }
    return ok(apps);
  } },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/secrets$/.test(u) && mth === "PUT", f: () => ok({}) },
  { m: (u, mth) => /\/workers\/scripts\/bio-install-lock$/.test(u) && mth === "DELETE", f: () => { scripts.delete("bio-install-lock"); return ok({}); } },
  { m: (u) => u.startsWith(CFG.RELEASE_LATEST + "/"), f: (u) => {
    const p = u.slice(CFG.RELEASE_LATEST.length + 1);
    if (!cfg.repo) return new Response("not found", { status: 404 });
    if (p === "RELEASE.json") return new Response(readFileSync(cfg.repo.manifest));
    if (p === cfg.repo.asset) { const body = readFileSync(cfg.repo.file); mockHeld = body.length; return new Response(body); }
    /* The fleet's members and their parts, from the real release's own files. */
    if (cfg.repo.extra && existsSync(join(cfg.repo.extra, p)) && statSync(join(cfg.repo.extra, p)).isFile()) {
      const body = readFileSync(join(cfg.repo.extra, p)); mockHeld = body.length; return new Response(body);
    }
    return new Response("gone", { status: 404 });
  } },
  { m: (u) => u === CFG.TOKEN, f: () => new Response(JSON.stringify({ access_token: "TOKEN-REALSIZE", scope: CFG.SCOPES.join(" ") })) },
  { m: (u) => u.endsWith("/logpush/jobs"), f: () => ok([]) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/schedules$/.test(u) && mth === "GET", f: () => ok({ schedules: [] }) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/schedules$/.test(u) && mth === "PUT", f: () => ok({}) },
  { m: (u) => u === `${CFG.API}/accounts`, f: () => ok([{ id: "A1", name: "Group Account" }]) },
  { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "PUT", f: () => ok({}) },
  { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => ok({}) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/settings$/.test(u) && mth === "GET", f: (u) => {
    const name = u.split("/workers/scripts/")[1].split("/")[0];
    return scripts.has(name) ? ok({ bindings: scripts.get(name).bindings.map(({ text, ...b }) => b) }) : bad("not found", 404);
  } },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "PUT", f: (u, init) => putScript(u.split("/workers/scripts/")[1], init) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "GET", f: (u) => {
    const name = u.split("/workers/scripts/")[1];
    return scripts.get(name)?.put ? readScript(name) : bad("not found", 404);
  } },
  { m: (u, mth) => /\/r2\/buckets\/[^/]+$/.test(u) && mth === "GET", f: (u) => buckets.has(u.split("/r2/buckets/")[1]) ? ok({}) : bad("The specified bucket does not exist.", 404, 10006) },
  { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: (u, init) => { buckets.add(JSON.parse(init.body).name); return ok({}); } },
  { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => ok({ subdomain: prefix }) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/subdomain$/.test(u) && mth === "POST", f: () => ok({ enabled: true }) },
  { m: (u) => /^https:\/\/[^/]+\.workers\.dev\//.test(u) && !u.startsWith(ORIGIN), f: (u) => {
    const q = new URL(u).searchParams;
    if (q.get("op") === "selftest") return new Response(JSON.stringify({ ok: true, bindings: { STORE: true } }));
    const v = version ?? cfg.before ?? "0.0.0";
    if (q.get("op") === "bootstrap") return new Response(JSON.stringify(q.get("members")
      ? { ok: true, version: v, storeVersion: v, memberVersions: Object.fromEntries([...members].map(([m, mv]) => [m, { state: "SERVING", version: mv }])) }
      : { ok: true, version: cfg.before ?? v }));
    return new Response(JSON.stringify({ ok: false }));
  } },
];
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);
globalThis.fetch = async (input, init = {}) => {
  const u = typeof input === "string" ? input : input.url;
  const method = (init.method || "GET").toUpperCase();
  mockHeld = 0;
  for (const r of rules) if (r.m(u, method)) return r.f(u, init);
  throw new Error(`unscripted fetch: ${method} ${u}`);
};

/* ---- one act ---- */
const begin = await worker.fetch(new Request(ORIGIN + "/begin", { method: "POST",
  body: JSON.stringify({ slug, mode: cfg.mode, ...(cfg.mode === "update" ? { version: cfg.chosen } : {}) }) }));
const j = await begin.json();
const cookie = (begin.headers.get("set-cookie") || "").split(";")[0];
const state = new URL(j.authorize).searchParams.get("state");
const res = await worker.fetch(new Request(ORIGIN + `/callback?code=GOODCODE&state=${state}`, { headers: { cookie } }));
let raw = "";
for await (const chunk of res.body) raw += Buffer.from(chunk).toString();
const status = (id) => { const m = [...raw.matchAll(new RegExp(`<script>(ok|no)\\(${JSON.stringify(id).replace(/"/g, '\\"')}`, "g"))]; return m.length ? m.at(-1)[1] : null; };
const done = (() => { const m = raw.match(/<script>done\((.*?)\)<\/script>/s); return m ? JSON.parse(m[1]) : ""; })();
const failed = (raw.match(/<script>no\(\);fail\((.*?)\)<\/script>/s) || [])[1] || null;
sample("end");
console.log(JSON.stringify({
  peakMB: Math.round(peak / MB), baselineMB: Math.round(baseline / MB), maxRssMB: Math.round(process.resourceUsage().maxRSS / 1e3), rssGrowthMB: Math.round((process.resourceUsage().maxRSS - rssPeak0) / 1e3),
  samples, uploads, reads, version, members: [...members.keys()],
  verify: status("verify"), up: status("up"), install: status("install"), failed,
  done,
  lags: [...done.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]).slice(0, 6), fleet: (raw.match(/<script>ok\("fleet",(.*?)\)<\/script>/s) || [])[1] || null,
  page: raw.length,
}));
process.exit(0);
