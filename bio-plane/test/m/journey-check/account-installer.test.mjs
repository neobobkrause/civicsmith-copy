/* journey-check R1 (a): the local arm's fake Cloudflare account answers what the installer asks of it. The installer's own
   install (its routes, in this process, as the installer's suite drives them) runs over `fakeAccount`, with no browser and the
   installer's waits made immediate; every call the installer makes that the account does not answer is named, so a call the
   installer begins to make fails here at once, by name, and not as a five-minute retry in the walk's journey 28 step 6
   (the walk's run of the installer for the container members, K4435). What the installer declares it installs is read from its
   own release manifest (`RELEASE_MANIFEST`: the `Container` parts' descriptors, as the installer fetches them), never copied. */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../../../newgroup/src/index.mjs";
import { RELEASE_MANIFEST } from "../../../../newgroup/src/release.mjs";
import { passedCheck } from "./check-first.mjs";
import { fakeAccount, API, READY_PREFIX } from "../../../src/journey-check/account.mjs";

const ORIGIN = "https://newgroup.believeinoakland.workers.dev";
const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
/* The copy's own address, answered as a plane answers the installer's reads (the walk's local arm runs the real plane). */
const copy = () => json({ ok: true });

/* Runs the installer's install of `slug` over a fake account; answers the account, the progress page's events and the page. */
async function install(slug, { hide = null, account = fakeAccount({ copyFetch: copy }) } = {}) {
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  globalThis.fetch = async (input, init) => {
    const r = input instanceof Request ? input : new Request(input, init);
    if (r.url.startsWith(ORIGIN)) return realFetch(input, init);
    return hide && hide.test(`${r.method} ${r.url}`) ? new Response("hidden by the test", { status: 599 }) : account.handle(r);
  };
  try {
    const req = (p, i) => worker.fetch(new Request(ORIGIN + p, i));
    /* installer R90: the install begins only after a passed check, run for real (check-first.mjs) */
    const chk = await passedCheck(req, account, slug);
    const begun = await req("/begin", { method: "POST", headers: { cookie: chk }, body: JSON.stringify({ slug, mode: "install" }) });
    const cookie = [(begun.headers.get("set-cookie") || "").split(";")[0], chk].join("; ");
    const consent = await (await account.handle(new Request((await begun.json()).authorize))).text();
    const back = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&"));
    const raw = await (await req("/callback" + back.search, { headers: { cookie } })).text();
    const events = [];
    const rec = { step: (id, label) => events.push({ k: "step", id, label }), ok: (id, label) => events.push({ k: "ok", id, label: label ?? null }),
      no: (id, label) => events.push({ k: "no", id, label: label ?? null }), fail: (said) => events.push({ k: "fail", said }),
      done: () => {}, says: () => {}, waiting: (t) => events.push({ k: "waiting", label: t }), again: () => {} };
    for (const m of [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(1)) new Function(...Object.keys(rec), m[1])(...Object.values(rec));
    return { account, events };
  } finally { globalThis.setTimeout = realTimeout; globalThis.fetch = realFetch; }
}

/* The members the fleet step's line says are installed: the names it gives before any "left out" part. */
const installed = (fleet) => fleet.label.split("left out")[0].split(/[\s,():;.]+/).filter(Boolean);

/* The descriptors of the container members the installer declares, fetched as the installer fetches them. */
async function declared(account) {
  const out = [];
  for (const m of RELEASE_MANIFEST.fleet) for (const p of m.parts || []) if (p.type === "Container") {
    const r = await account.handle(new Request(`https://raw.githubusercontent.com/believeinoakland/bio/v${RELEASE_MANIFEST.version}/release/${m.member}/${p.path}`));
    assert.equal(r.status, 200, `${m.member}/${p.path} is served`);
    out.push({ member: m.member, ...JSON.parse(await r.text()) });
  }
  return out;
}

test("R1 (a): the installer's install over the fake account makes no call the account does not answer, and leaves no member out", async () => {
  const { account, events } = await install("fakecheck");
  assert.deepEqual(account.unanswered, [], "every call the installer makes is answered");
  const fleet = events.filter((e) => e.k === "ok" && e.id === "fleet").at(-1);
  assert.ok(fleet, "the helper programs step finished");
  for (const m of RELEASE_MANIFEST.fleet) assert.ok(installed(fleet).includes(m.member), `${m.member} is installed: ${fleet.label}`);
  assert.deepEqual(events.filter((e) => e.k === "no" && e.id === "fleet"), []);
});

test("R1 (a): the fake account holds a container application for every class of every container member the installer declares, on the image its descriptor names", async () => {
  const { account } = await install("fakecheck2");
  const want = await declared(account);
  assert.ok(want.length >= 3, "agent-runner's class and file-scanner's two: " + want.map((d) => d.class_name).join(", "));
  for (const d of want) assert.ok(account.applications.some((a) => a.configuration?.image === d.image && a.max_instances === d.max_instances),
    `${d.member} ${d.class_name}: an application on ${d.image}`);
});

test("R1 (a), control: when the account answers no container application create, the check sees it (the member is left out and the install's page says so)", async () => {
  const { account, events } = await install("fakecheck3", { hide: /^POST .*\/containers\/applications$/ });
  const fleet = events.filter((e) => e.k === "ok" && e.id === "fleet").at(-1);
  assert.ok(fleet && !installed(fleet).includes("agent-runner") && !installed(fleet).includes("file-scanner"), fleet && fleet.label);
  assert.equal(account.applications.length, 0);
});

/* ---------- the account's address (fix round 10, K5101, B1) ---------- */

/* What the account answers to the call the installer makes to learn whether it has a workers.dev address (a bearer token got
   as the installer gets one is not needed: the call is the account's own interface). */
async function subdomainOf(account) {
  const verifier = "v".repeat(48);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const consent = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/auth?" + new URLSearchParams({
    response_type: "code", client_id: "c", redirect_uri: "https://x.example/callback", state: "s", code_challenge: challenge, code_challenge_method: "S256", scope: "workers-scripts.write" })))).text();
  const code = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&")).searchParams.get("code");
  const grant = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/token", { method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: "https://x.example/callback" }) }))).json();
  return account.handle(new Request(`${API}/accounts/${account.account}/workers/subdomain`, { headers: { authorization: "Bearer " + grant.access_token } }));
}

test("R1 (a), B1: the fake account is ready as a person's is, holding a workers.dev address; control: an account that has none answers none, and the installer stops before it creates anything", async () => {
  const ready = fakeAccount();
  const got = await subdomainOf(ready);
  assert.equal(got.status, 200);
  assert.equal((await got.json()).result.subdomain, READY_PREFIX);
  assert.equal(ready.prefix(), READY_PREFIX);
  const none = fakeAccount({ subdomain: null });
  assert.equal((await subdomainOf(none)).status, 404, "an account with no workers.dev address says so");
  const { account, events } = await install("fakecheck4", { account: fakeAccount({ copyFetch: copy, subdomain: null }) });
  assert.equal(account.scripts.size, 0, "nothing was created in an account that has no address to give the copy");
  assert.ok(events.some((e) => e.k === "no" || e.k === "fail"), "the installer says it stopped: " + JSON.stringify(events.slice(-3)));
  assert.equal(events.some((e) => e.k === "ok" && e.id === "fleet"), false);
});

/* A call on the fake account with its own token, got as the installer gets it: the consent page, then the token exchange. */
async function signedIn(account) {
  const verifier = "v".repeat(48);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const consent = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/auth?" + new URLSearchParams({
    response_type: "code", client_id: "c", redirect_uri: "https://x.example/callback", state: "s", code_challenge: challenge, code_challenge_method: "S256", scope: "workers-scripts.write" })))).text();
  const code = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&")).searchParams.get("code");
  const grant = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/token", { method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: "https://x.example/callback" }) }))).json();
  return (path, init = {}) => account.handle(new Request(`${API}/accounts/${account.account}${path}`, { ...init, headers: { authorization: "Bearer " + grant.access_token, ...(init.headers || {}) } }));
}

test("F8 (installer R40): the fake account's script settings hold the Workers Logs its upload stated, as Cloudflare's do, so the install passes R40's check; control: an upload that states none reads back off", async () => {
  const { account, events } = await install("fakelogs");
  assert.ok(!events.some((e) => e.k === "fail"), JSON.stringify(events.filter((e) => e.k === "fail")));
  const call = await signedIn(account);
  const settings = async (name) => (await (await call(`/workers/scripts/${name}/settings`)).json()).result;
  assert.equal((await settings("fakelogs")).observability.enabled, true, "the plane's logs are on, as its upload stated");
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify({ main_module: "index.mjs" })], { type: "application/json" }));
  fd.append("index.mjs", new Blob(["export default {};"], { type: "application/javascript+module" }), "index.mjs");
  assert.equal((await call("/workers/scripts/logs-off", { method: "PUT", body: fd })).status, 200);
  assert.deepEqual((await settings("logs-off")).observability, { enabled: false });
});
