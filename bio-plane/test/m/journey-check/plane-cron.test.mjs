/* journey-check R1 (a), fix round 6 G1 (K4565, K4566, K4570): the plane's watchdog cron, as the walk's fake Cloudflare account
   sees it. The plane states its cron in its signed bytes (`bio-plane-crons/1 <cron>`); the installer sets it on the
   plane's script after an install and after an update, and a refused schedule stops both in words. Two kinds of test:
   the assertion itself, at the account's interface (what it reports for a script holding the cron, none, a wrong one, a
   refusal), and the seam, the real installer's install and update over the account (red by name until the installer-steps
   and control-plane jobs have merged and the release carries the statement). */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../../../newgroup/src/index.mjs";
import { RELEASE_MANIFEST } from "../../../../newgroup/src/release.mjs";
import { passedCheck } from "./check-first.mjs";
import { fakeAccount, planeScheduleProblem, statedCrons, WATCHDOG_CRON, API } from "../../../src/journey-check/account.mjs";

const ORIGIN = "https://newgroup.believeinoakland.workers.dev";
const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
const copy = () => json({ ok: true });

/* ---------- the assertion, at the account's interface ---------- */

const STATEMENT = `export const CRONS = "bio-plane-crons/1 ${WATCHDOG_CRON}";\nexport default {};\n`;

/* The account's own token, got as the installer gets it: the consent page, then the token exchange. */
async function signedIn(account) {
  const verifier = "v".repeat(48);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const consent = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/auth?" + new URLSearchParams({
    response_type: "code", client_id: "c", redirect_uri: "https://x.example/callback", state: "s", code_challenge: challenge, code_challenge_method: "S256", scope: "workers-scripts.write" })))).text();
  const code = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&")).searchParams.get("code");
  const grant = await (await account.handle(new Request("https://dash.cloudflare.com/oauth2/token", { method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: "https://x.example/callback" }) }))).json();
  const call = (path, init = {}) => account.handle(new Request(`${API}/accounts/${account.account}${path}`, { ...init, headers: { authorization: "Bearer " + grant.access_token, ...(init.headers || {}) } }));
  return {
    upload: async (slug, source) => {
      const form = new FormData();
      form.set("metadata", new Blob([JSON.stringify({ main_module: "index.mjs", bindings: [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" }] })], { type: "application/json" }), "metadata");
      form.set("index.mjs", new Blob([source], { type: "application/javascript+module" }), "index.mjs");
      return call(`/workers/scripts/${slug}`, { method: "PUT", body: form });
    },
    schedule: (slug, crons) => call(`/workers/scripts/${slug}/schedules`, { method: "PUT", body: JSON.stringify(crons.map((cron) => ({ cron }))) }),
    read: (slug) => call(`/workers/scripts/${slug}/schedules`),
  };
}

test("R1 (a), G1: a plane script that states the watchdog cron and holds it reports no problem, and the account reads the schedule back", async () => {
  const account = fakeAccount();
  const cf = await signedIn(account);
  assert.equal((await cf.upload("plane1", STATEMENT)).status, 200);
  assert.deepEqual(statedCrons(STATEMENT), { ok: true, crons: [WATCHDOG_CRON] });
  assert.match(planeScheduleProblem(account, "plane1"), /holds no cron/, "before any schedule is set");
  assert.equal((await cf.schedule("plane1", [WATCHDOG_CRON])).status, 200);
  assert.equal(planeScheduleProblem(account, "plane1"), null);
  const back = await (await cf.read("plane1")).json();
  assert.deepEqual(back.result.schedules.map((s) => s.cron), [WATCHDOG_CRON], "a read-back answers what was set");
  assert.equal((await cf.read("absent")).status, 404);
});

test("R1 (a), G1, control: a script holding no cron, a wrong one, an extra one, or bytes that state none or two, each reports a problem by name", async () => {
  const account = fakeAccount();
  const cf = await signedIn(account);
  await cf.upload("p", STATEMENT);
  await cf.schedule("p", ["*/10 * * * *"]);
  assert.match(planeScheduleProblem(account, "p"), /holds "\*\/10 \* \* \* \*", its statement says/);
  await cf.schedule("p", [WATCHDOG_CRON, "17 3 * * *"]);
  assert.match(planeScheduleProblem(account, "p"), /holds "\*\/5 \* \* \* \* \| 17 3/);
  await cf.upload("q", "export default {};\n");
  await cf.schedule("q", [WATCHDOG_CRON]);
  assert.match(planeScheduleProblem(account, "q"), /state no watchdog cron/);
  await cf.upload("r", `${STATEMENT}\nexport const B = "bio-plane-crons/1 */7 * * * *";\n`);
  assert.match(planeScheduleProblem(account, "r"), /states more than one/);
  await cf.upload("s", STATEMENT.replace(WATCHDOG_CRON, "*/10 * * * *"));
  await cf.schedule("s", ["*/10 * * * *"]);
  assert.match(planeScheduleProblem(account, "s"), /not the watchdog's/);
  assert.match(planeScheduleProblem(account, "nowhere"), /not in the account/);
});

test("R1 (a), G1, control: an account told to refuse a script's schedules refuses it, answers as Cloudflare answers a refusal, and leaves nothing set", async () => {
  const account = fakeAccount({ refuseSchedules: /^refused/ });
  const cf = await signedIn(account);
  await cf.upload("refused-plane", STATEMENT);
  await cf.upload("allowed-plane", STATEMENT);
  const no = await cf.schedule("refused-plane", [WATCHDOG_CRON]);
  assert.equal(no.status, 403);
  const body = await no.json();
  assert.equal(body.success, false);
  assert.ok(body.errors[0].message.length > 10);
  assert.match(planeScheduleProblem(account, "refused-plane"), /holds no cron/);
  assert.equal((await cf.schedule("allowed-plane", [WATCHDOG_CRON])).status, 200);
  assert.equal(planeScheduleProblem(account, "allowed-plane"), null);
});

/* ---------- the seam: the real installer, install and update, over the account ---------- */

/* Runs the installer's `mode` ("install" or "update") of `slug` over `account`; answers the progress page's events. */
async function run(account, slug, mode = "install") {
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  globalThis.fetch = async (input, init) => {
    const r = input instanceof Request ? input : new Request(input, init);
    return r.url.startsWith(ORIGIN) ? realFetch(input, init) : account.handle(r);
  };
  try {
    const req = (p, i) => worker.fetch(new Request(ORIGIN + p, i));
    /* installer R90: an install begins only after a passed check, run for real (check-first.mjs); an update needs none */
    const chk = mode === "install" ? await passedCheck(req, account, slug) : "";
    const begun = await req("/begin", { method: "POST", headers: chk ? { cookie: chk } : {}, body: JSON.stringify({ slug, mode, ...(mode === "update" ? { version: RELEASE_MANIFEST.version } : {}) }) });
    const cookie = [(begun.headers.get("set-cookie") || "").split(";")[0], chk].filter(Boolean).join("; ");
    const consent = await (await account.handle(new Request((await begun.json()).authorize))).text();
    const back = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&"));
    const raw = await (await req("/callback" + back.search, { headers: { cookie } })).text();
    const events = [];
    const rec = { step: (id, label) => events.push({ k: "step", id, label }), ok: (id, label) => events.push({ k: "ok", id, label: label ?? null }),
      no: (id, label) => events.push({ k: "no", id, label: label ?? null }), fail: (said) => events.push({ k: "fail", said }),
      done: () => events.push({ k: "done" }), says: () => {}, waiting: (t) => events.push({ k: "waiting", label: t }), again: () => {} };
    for (const m of [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(1)) new Function(...Object.keys(rec), m[1])(...Object.values(rec));
    return events;
  } finally { globalThis.setTimeout = realTimeout; globalThis.fetch = realFetch; }
}

/* A stopped run says so in a sentence: words, not a code, not a structure. */
const inWords = (said) => typeof said === "string" && said.trim().split(/\s+/).length >= 4 && !/[{}]|\[object|undefined|^\s*\d+\s*$/.test(said);

test("R1 (a), G1: an install sets the plane's watchdog cron, the one its signed statement states", async () => {
  const account = fakeAccount({ copyFetch: copy });
  const events = await run(account, "croninstall");
  assert.deepEqual(account.unanswered, [], "every call the installer makes is answered");
  assert.deepEqual(events.filter((e) => e.k === "fail"), [], "the install did not stop");
  assert.equal(planeScheduleProblem(account, "croninstall"), null);
  assert.deepEqual(account.schedules.get("croninstall"), [WATCHDOG_CRON]);
});

test("R1 (a), G1: an update sets the plane's watchdog cron again, whether or not the upload kept the schedule", async () => {
  const account = fakeAccount({ copyFetch: copy });
  await run(account, "cronupdate");
  account.schedules.delete("cronupdate");
  const events = await run(account, "cronupdate", "update");
  assert.deepEqual(account.unanswered, [], "every call the installer makes is answered");
  assert.deepEqual(events.filter((e) => e.k === "fail"), [], "the update did not stop");
  assert.equal(planeScheduleProblem(account, "cronupdate"), null);
});

test("R1 (a), G1, control: when the account refuses the plane's schedule, the install and the update each stop with a sentence and do not finish", async () => {
  const slug = "cronrefused";
  /* the same install over an account that refuses nothing finishes: a stop that the refusal did not cause cannot stand for it (K5101: the built-in release 0.86.0 states no cron, so every install stops at its description until the 0.87.0 cut, G90) */
  assert.deepEqual((await run(fakeAccount({ copyFetch: copy }), "cronallowed")).filter((e) => e.k === "fail"), [], "without the refusal the install does not stop");
  const account = fakeAccount({ copyFetch: copy, refuseSchedules: new RegExp("^" + slug + "$") });
  const installed = await run(account, slug);
  const stopped = installed.filter((e) => e.k === "fail");
  assert.equal(stopped.length, 1, "the install stops once: " + JSON.stringify(installed.slice(-3)));
  assert.ok(inWords(stopped[0].said), "in words: " + stopped[0].said);
  assert.equal(installed.some((e) => e.k === "ok" && e.id === "verify"), false, "the install does not go on to say the copy answers");
  /* an update of a copy the account holds, whose schedules are refused */
  const open = fakeAccount({ copyFetch: copy });
  await run(open, slug);
  const refusing = fakeAccount({ copyFetch: copy, refuseSchedules: new RegExp("^" + slug + "$") });
  for (const [k, v] of open.scripts) refusing.scripts.set(k, v);
  for (const b of open.buckets) refusing.buckets.add(b);
  const updated = await run(refusing, slug, "update");
  const said = updated.filter((e) => e.k === "fail");
  assert.equal(said.length, 1, "the update stops once: " + JSON.stringify(updated.slice(-3)));
  assert.ok(inWords(said[0].said), "in words: " + said[0].said);
  assert.equal(updated.some((e) => e.k === "ok" && e.id === "verify"), false, "the update does not go on to say the copy answers");
});
