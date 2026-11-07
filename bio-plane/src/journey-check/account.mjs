/* journey-check (T47-88; R1 (a)): the fake Cloudflare account the local arm's installer runs over, answered over HTTP as
   Cloudflare answers it, and stateful as the installer's own fake is (newgroup/test/fixture.mjs, read, never imported):
   OAuth with PKCE (the consent page a browser is sent to, the token exchange the installer makes), the account list, the
   plan probe, the evidence buckets, each script uploaded with its bindings (`keep_bindings` applied by type), its bytes
   read back, the Durable Object classes its migrations declare (the namespaces a container application is made for), the
   Containers applications the installer creates and rolls out (K4435: a container member installs only when the account
   holds an application for each of its classes), the schedules set on a script, the workers.dev prefix and each script's
   address, and no Logpush job. The schedules it holds are read back as Cloudflare reads them back, and a script's can be
   refused (`refuseSchedules`), so the plane's watchdog cron (G1) is asserted after an install and an update and a refusal
   is seen to stop them. The public release repository does
   not answer, so the installer installs its built-in release and says why. Every call it does not answer is recorded as
   `unanswered` and refused, so the walk fails on it rather than passing over it. */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize, sep } from "node:path";
import { localize } from "../setup-words/index.mjs";
import { fileURLToPath } from "node:url";

/* The release a person's install fetches its members from: the repository's own committed `release/` (whose bytes the
   installer's built-in manifest signs, and the installer verifies), answered at the address the installer asks, and nothing
   else: `RELEASE.json` stays unanswered so the installer takes its built-in release, and the plane's own asset is the
   built-in's. */
const RELEASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "release");
function released(url) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/release\/(.+)$/.exec(url.replace(/[?#].*$/, ""));
  const rel = m && decodeURIComponent(m[1]);
  const file = rel && normalize(join(RELEASE_DIR, rel));
  if (!file || !file.startsWith(RELEASE_DIR + sep) || rel === "RELEASE.json" || rel === "bio-plane.bundled.mjs" || !existsSync(file) || !statSync(file).isFile())
    return new Response("not found", { status: 404 });
  return new Response(readFileSync(file), { status: 200, headers: { "content-type": "application/octet-stream" } });
}

const enc = new TextEncoder();
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const s256 = async (s) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const jres = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const ok = (result) => jres({ success: true, errors: [], result });
const no = (message, status = 400, code = 0) => jres({ success: false, errors: [{ code, message }], result: null }, status);

export const API = "https://api.cloudflare.com/client/v4";
export const AUTHORIZE = "https://dash.cloudflare.com/oauth2/auth";
export const TOKEN = "https://dash.cloudflare.com/oauth2/token";
export const RELEASES = "https://raw.githubusercontent.com/";

/* The plane's watchdog cron (fix round 6, G1; K4566): what the plane's signed statement `bio-plane-crons/1 <cron>` states, the
   one cron the plane's script must hold after an install and after an update. The statement is read from the bytes the
   account holds for the script, as the installer reads it, never taken from the installer. */
export const WATCHDOG_CRON = "*/5 * * * *";
const CRONS_TAG = "bio-plane-crons/1";
export function statedCrons(source) {
  const bodies = new Set();
  for (const m of String(source).matchAll(new RegExp("([\"'`])" + CRONS_TAG.replace("/", "\\/") + "( [^\"'`\\\\\\n]*)\\1", "g"))) bodies.add(m[2].trim());
  return bodies.size === 1 ? { ok: true, crons: [[...bodies][0]] } : { ok: false, why: bodies.size ? "states more than one" : "states none" };
}

/* What is wrong with the plane `slug`'s schedules in `account` (null when nothing is): its bytes state the watchdog cron
   and the script holds exactly it. Run after an install and after an update. */
export function planeScheduleProblem(account, slug) {
  const held = account.scripts.get(slug);
  if (!held) return localize("journey-check.account.the_plane_s_script_slug_is_not", "the plane's script {slug} is not in the account", { slug: String(slug) });
  const stated = statedCrons(held.source);
  if (!stated.ok) return localize("journey-check.account.the_plane_s_bytes_state_no_watchdog", "the plane's bytes state no watchdog cron ({tag}: {why})", { tag: CRONS_TAG, why: String(stated.why) });
  if (stated.crons.join("|") !== WATCHDOG_CRON) return localize("journey-check.account.the_plane_states_the_cron_not_the", "the plane states the cron \"{stated}\", not the watchdog's \"{watchdog}\"", { stated: stated.crons.join(" | "), watchdog: WATCHDOG_CRON });
  const got = account.schedules.get(slug);
  if (!got) return localize("journey-check.account.the_plane_s_script_slug_holds_no", "the plane's script {slug} holds no cron: no schedules were set on it", { slug: String(slug) });
  if (got.join("|") !== stated.crons.join("|")) return localize("journey-check.account.the_plane_s_script_slug_holds_got", "the plane's script {slug} holds \"{got}\", its statement says \"{stated}\"", { slug: String(slug), got: got.join(" | "), stated: stated.crons.join(" | ") });
  return null;
}

/* The workers.dev prefix a ready account holds: the installer stops and asks for a name when the account has none and /begin
   chooses none (installer R84 (4), newgroup `addressReady`), so the walk's account starts with one, as a person's does who has
   used Workers. `fakeAccount({ subdomain: null })` is an account that has none (the control). */
export const READY_PREFIX = "jtest";

/* `onScript(name, {bindings, source})` is called after each script upload the account accepts, with the bindings the
   script now holds; the local arm starts or reconfigures the copy from it. `copyFetch(request)` answers a request to a
   script's workers.dev address, once it is enabled. */
export function fakeAccount({ name = "Journey test account", onScript = async () => {}, copyFetch = null, refuseSchedules = null, subdomain = READY_PREFIX } = {}) {
  const ACCT = "acct" + "0".repeat(28);
  const scripts = new Map();           /* name -> {bindings, source} */
  const buckets = new Set();
  const enabled = new Set();
  const grants = new Map();            /* code -> {challenge, redirect, state} */
  const tokens = new Set();
  const applications = [];
  const classes = new Map();           /* script -> Set of Durable Object class names its migrations declared */
  const schedules = new Map();
  const deployments = new Map();       /* script -> deployments, newest first (an update reads the one it replaces, to put it back) */
  const rollouts = [];
  const unanswered = [];
  const calls = [];
  let prefix = subdomain;              /* a ready account holds a workers.dev prefix (installer R84 (4)); null is an account that has none */
  const refused = (script) => refuseSchedules === true || (refuseSchedules instanceof RegExp ? refuseSchedules.test(script) : typeof refuseSchedules === "function" && refuseSchedules(script));

  /* The consent page Cloudflare would show: what is asked, and one "Allow" that returns to the installer. */
  async function consent(url) {
    const u = new URL(url);
    const q = u.searchParams;
    const code = "code-" + b64url(crypto.getRandomValues(new Uint8Array(12)));
    grants.set(code, { challenge: q.get("code_challenge"), method: q.get("code_challenge_method"), redirect: q.get("redirect_uri"),
      client: q.get("client_id") });
    const back = new URL(q.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", q.get("state") || "");
    const scopes = (q.get("scope") || "").split(" ").filter(Boolean);
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Allow access (test account)</title></head>
<body><main><h1>Allow access to ${name}</h1><p>This is the walk's stand-in for Cloudflare's own consent page.</p>
<ul>${scopes.map((s) => `<li>${s.replace(/[<>&]/g, "")}</li>`).join("")}</ul>
<a id="allow" href="${back.href.replace(/"/g, "&quot;")}">Allow</a></main></body></html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  async function token(req) {
    const form = new URLSearchParams(await req.text());
    const g = grants.get(form.get("code"));
    if (!g) return jres({ error: "invalid_grant", error_description: "unknown code" }, 400);
    grants.delete(form.get("code"));
    if (g.method !== "S256" || (await s256(form.get("code_verifier") || "")) !== g.challenge)
      return jres({ error: "invalid_grant", error_description: "PKCE verifier does not match" }, 400);
    if (form.get("redirect_uri") !== g.redirect) return jres({ error: "invalid_grant", error_description: "redirect differs" }, 400);
    const t = "tok-" + b64url(crypto.getRandomValues(new Uint8Array(24)));
    tokens.add(t);
    return jres({ access_token: t, token_type: "bearer", expires_in: 3600,
      scope: "workers-scripts.write workers-r2.write account-settings.read containers.write connectivity-directory.bind" });
  }

  async function putScript(nameOf, req) {
    const form = await req.formData();
    const meta = JSON.parse(await form.get("metadata").text());
    const source = await form.get("index.mjs").text();
    const explicit = meta.bindings || [];
    for (const b of explicit) if (b.type === "service" && b.service !== nameOf && !scripts.has(b.service))
      return no(`Service binding '${b.name}' references Worker '${b.service}' which was not found`, 400, 10143);
    if (nameOf === "bio-plan-probe") { scripts.set(nameOf, { bindings: [], source, probe: true }); return ok({ id: nameOf }); }
    const kept = (scripts.get(nameOf)?.bindings || []).filter((b) => (meta.keep_bindings || []).includes(b.type)
      && !explicit.some((x) => x.name === b.name));
    const bindings = [...explicit, ...kept];
    scripts.set(nameOf, { bindings, source, meta });
    const made = deployments.get(nameOf) || [];
    deployments.set(nameOf, [{ id: `d${made.length + 1}`, versions: [{ version_id: `ver-${nameOf}-${made.length + 1}`, percentage: 100 }] }, ...made]);
    /* the classes a migration declares (the whole `migrations` object or each of its `steps`) are the script's namespaces */
    const held = classes.get(nameOf) || new Set();
    const m = meta.migrations;
    for (const step of m ? (m.steps || [m]) : []) for (const c of [...(step.new_classes || []), ...(step.new_sqlite_classes || [])]) held.add(c);
    classes.set(nameOf, held);
    await onScript(nameOf, { bindings, source, meta });
    return ok({ id: nameOf });
  }

  async function api(req, path) {
    const m = req.method;
    let x;
    if (m === "GET" && path === "/accounts") return ok([{ id: ACCT, name }]);
    if (!path.startsWith(`/accounts/${ACCT}/`)) return null;
    const rest = path.slice(`/accounts/${ACCT}`.length);
    /* the lists the installer reads to know the copies and parts the account holds (installer R62, R69) */
    if (rest === "/workers/scripts" && m === "GET")
      return ok([...scripts].filter(([, v]) => !v.probe).map(([id, v]) => ({ id, ...(v.meta?.migrations?.new_tag ? { migration_tag: v.meta.migrations.new_tag } : {}) })));
    /* the Containers applications (wrangler's own calls, which the installer makes): listed, read, created for a class's
       namespace, rolled out to an image, deleted. A created application starts nothing (`instances: 0`) and holds no failed one. */
    if (rest === "/containers/applications" && m === "GET") return ok(applications);
    if (rest === "/containers/applications" && m === "POST") {
      const body = await req.json();
      applications.push({ id: "app" + (applications.length + 1), ...body, health: { instances: { active: 0, starting: 0, failed: 0 } } });
      return ok(applications.at(-1));
    }
    if ((x = /^\/containers\/applications\/([^/]+)(\/rollouts(?:\/([^/]+))?)?$/.exec(rest))) {
      const at = applications.findIndex((a) => a.id === x[1]);
      if (at < 0) return no("not found", 404);
      if (!x[2] && m === "GET") return ok(applications[at]);
      if (!x[2] && m === "DELETE") { applications.splice(at, 1); return ok({}); }
      if (x[2] && m === "POST") {
        const body = await req.json();
        rollouts.push({ id: "r" + (rollouts.length + 1), app: x[1], ...body });
        applications[at].configuration = { ...(applications[at].configuration || {}), ...body.target_configuration };
        return ok({ id: rollouts.at(-1).id, status: "completed" });
      }
      if (x[3] && m === "GET") return ok({ id: x[3], status: "completed" });
    }
    if (rest === "/r2/buckets" && m === "GET") return ok({ buckets: [...buckets].map((n) => ({ name: n })) });
    if ((x = /^\/workers\/scripts\/([^/]+)$/.exec(rest))) {
      if (m === "PUT") return putScript(x[1], req);
      if (m === "DELETE") { scripts.delete(x[1]); classes.delete(x[1]); return ok({}); }
      if (m === "GET") return scripts.has(x[1]) ? new Response(scripts.get(x[1]).source,
        { headers: { "content-type": "application/javascript+module" } }) : no("not found", 404, 10007);
    }
    /* a secret set on its own, without an upload (installer R69): the script now holds it, and the copy restarts with it */
    if ((x = /^\/workers\/scripts\/([^/]+)\/secrets$/.exec(rest)) && m === "PUT") {
      const sc = scripts.get(x[1]);
      if (!sc) return no("not found", 404, 10007);
      const b = await req.json();
      sc.bindings = [...sc.bindings.filter((k) => k.name !== b.name), { type: "secret_text", name: b.name, text: b.text }];
      await onScript(x[1], { bindings: sc.bindings, source: sc.source, meta: sc.meta });
      return ok({ name: b.name, type: "secret_text" });
    }
    if ((x = /^\/workers\/scripts\/([^/]+)\/secrets\/([^/]+)$/.exec(rest)) && m === "DELETE") {
      const sc = scripts.get(x[1]);
      if (sc) sc.bindings = sc.bindings.filter((k) => k.name !== x[2]);
      return ok({});
    }
    /* F8 (installer R40): the settings hold the script's Workers Logs as its last upload stated them, as Cloudflare's do; an upload
       that states none leaves them off */
    if ((x = /^\/workers\/scripts\/([^/]+)\/settings$/.exec(rest)) && m === "GET") {
      if (!scripts.has(x[1])) return no("not found", 404, 10007);
      const sc = scripts.get(x[1]);
      const obs = sc.meta && sc.meta.observability && typeof sc.meta.observability === "object" ? sc.meta.observability : null;
      return ok({ bindings: sc.bindings.map(({ text, ...b }) => b), observability: obs ? { ...obs, enabled: obs.enabled === true } : { enabled: false } });
    }
    if ((x = /^\/workers\/scripts\/([^/]+)\/subdomain$/.exec(rest)) && m === "POST") {
      if (!scripts.has(x[1])) return no("not found", 404, 10007);
      enabled.add(x[1]); return ok({ enabled: true });
    }
    if ((x = /^\/workers\/scripts\/([^/]+)\/deployments$/.exec(rest)) && m === "GET")
      return scripts.has(x[1]) ? ok({ deployments: deployments.get(x[1]) || [] }) : no("not found", 404, 10007);
    if ((x = /^\/workers\/scripts\/([^/]+)\/deployments$/.exec(rest)) && m === "POST")
      return scripts.has(x[1]) ? ok({ id: "rolled-back" }) : no("not found", 404, 10007);
    if (rest === "/workers/subdomain" && m === "GET") return prefix ? ok({ subdomain: prefix }) : no("no subdomain", 404, 10007);
    if (rest === "/workers/subdomain" && m === "PUT") { prefix = (await req.json()).subdomain; return ok({ subdomain: prefix }); }
    if ((x = /^\/r2\/buckets\/([^/]+)$/.exec(rest)) && m === "GET")
      return buckets.has(x[1]) ? ok({ name: x[1] }) : no("The specified bucket does not exist.", 404, 10006);
    if (rest === "/r2/buckets" && m === "POST") {
      const { name: b } = await req.json();
      if (buckets.has(b)) return no("The bucket you tried to create already exists", 409, 10004);
      buckets.add(b); return ok({ name: b });
    }
    if (rest === "/logpush/jobs" && m === "GET") return ok([]);
    if (rest.startsWith("/workers/durable_objects/namespaces") && m === "GET")
      return ok([...classes].filter(([n]) => scripts.has(n)).flatMap(([n, cs]) => [...cs].map((c) => ({ id: `ns-${n}-${c}`, script: n, class: c }))));
    /* the schedules a member's `Worker` part states (installer R44) */
    if ((x = /^\/workers\/scripts\/([^/]+)\/schedules$/.exec(rest)) && m === "GET") {
      if (!scripts.has(x[1])) return no("not found", 404, 10007);
      return ok({ schedules: (schedules.get(x[1]) || []).map((cron) => ({ cron })) });
    }
    if ((x = /^\/workers\/scripts\/([^/]+)\/schedules$/.exec(rest)) && m === "PUT") {
      if (!scripts.has(x[1])) return no("not found", 404, 10007);
      if (refused(x[1]))
        return no(localize("journey-check.account.the_cron_triggers_of_this_script", "The cron triggers of this script could not be set."), 403, 10000);
      const body = await req.json();
      schedules.set(x[1], body.map((t) => t.cron));
      return ok({ schedules: body });
    }
    return null;
  }

  /* Answers one outbound request of the installer (Miniflare's outbound service), or a browser's request to the consent
     page. Anything it does not know is recorded and refused. */
  async function handle(req) {
    const url = req.url;
    calls.push(`${req.method} ${url.replace(/[?#].*$/, "")}`);
    if (url.startsWith(AUTHORIZE)) return consent(url);
    if (url === TOKEN && req.method === "POST") return token(req);
    if (url.startsWith(RELEASES)) return released(url);
    if (url.startsWith(API + "/")) {
      const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!tokens.has(auth)) return no("Authentication error", 403, 10000);
      const r = await api(req, new URL(url).pathname.slice("/client/v4".length));
      if (r) return r;
    }
    const host = new URL(url).host;
    const at = /^([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev$/.exec(host);
    if (at && at[2] === prefix && enabled.has(at[1]) && copyFetch) return copyFetch(req);
    unanswered.push(`${req.method} ${url}`);
    return new Response("the walk's fake account does not answer this", { status: 599 });
  }

  return { handle, scripts, buckets, applications, rollouts, schedules, unanswered, calls, account: ACCT, prefix: () => prefix,
    addressOf: (slug) => (prefix && enabled.has(slug) ? `https://${slug}.${prefix}.workers.dev` : null) };
}
