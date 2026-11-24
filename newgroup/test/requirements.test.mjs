/* installer R1–R42, each at the module's interface: the Worker's routes driven with a request, everything it reaches
 * answered by the fixture's stateful account, repository and copy; the embed step's exported functions; the pages it
 * serves, and the invitation page, as a browser receives them. A requirement not yet met is a `test.todo` naming its
 * cause (build/requirements/installer.md).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import worker, * as installer from "../src/index.mjs";
import { CFG, planeLimits, reportsBuilds } from "../src/index.mjs";
import { GROUP_SLUG_RE, FLEET_BINDINGS, HOSTING_CONTROL, hostingControlBlock } from "../../bio-plane/src/setup-fleet.mjs";
import { EXAMPLE_SLUG, PUBLISHER, PROFILE_CHOICES, PROFILES_NONE, PAGE_CSS, ASSISTANT_OFFER, DESCRIPTION, WHO, SECURITY_TOOLS, LEFT_OUT,
  BEFORE_CLOUDFLARE_CONTROL, ALLOWED, STYLESHEET, ASSET_PREFIX, UPDATE_KEEPS } from "../src/ui.mjs";
import { ASSET_FILES } from "../../bio-plane/src/interface-assets/index.mjs";
import { leftOutNotice, partsLeftOut } from "../src/images.mjs";
import { RELEASE_VERSION, RELEASE_PACKED, RELEASE_FACTS, RELEASE_CONTAINERS } from "../src/release.mjs";
import { RELEASE_SOURCE, RELEASE_BYTES } from "./release-text.mjs";
import { resolveVersion, checkSignedAsset, embedRelease, releaseContainers, packedLiteral } from "../scripts/embed-release.mjs";
import vm from "node:vm";
import * as esbuild from "esbuild";
import { bundleText } from "../scripts/build.mjs";
import { gunzipSync } from "node:zlib";
import { word, hasWord } from "../src/words.mjs";
import { bootstrapVersions } from "../../bio-plane/test/m/credentials/fixtures.mjs";
import { fleetReports } from "../../bio-plane/test/m/instance-setup/fixtures.mjs";
import { WAIT_BOUND_MINUTES } from "../src/steps/api.mjs";
import { verifySshsig, NS_RELEASE } from "../../bio-plane/src/sshsig.mjs";
import * as jurisdictions from "../../jurisdictions/index.mjs";
import { pageWorld, TOK, ORIGIN, req, begin, callback, cookieOf, cookieValue, b64url, script, realFetch, jres, run, release,
  SIGNER, STRANGER, armWith, disarm, restoreSigners, sha, bump, CAPABLE_SRC, PRE116_SRC, MEMBER_SRC, bindingOf,
  parsePage, LIMITS, LIMITS_STATEMENT, CRONS_STATEMENT, UNSTATED_SRC, BUILTIN_LIMITS, DEFAULT_VERSION, DESCRIPTOR, IMAGE, RUNNER,
  SCANNER, SCANNER_CLASSES, SCANNER_WORKER, SCAN_IMAGE, RENDER_IMAGE, VPC_ID, signer, headOf, like } from "./fixture.mjs";

after(restoreSigners);
const NEXT = bump(RELEASE_VERSION);
/* R2: the scopes registered on the OAuth client (Cloudflare's own names for them), in the order they are asked. */
const REGISTERED_SCOPES = ["workers-scripts.write", "workers-r2.write", "account-settings.read", "containers.write", "connectivity-directory.bind", "account-logs.read"];
/* R55: the update page is drawn for the release chosen (the address `instance-setup` R90 answers). */
const UPDATE_PATH = "/update?version=" + NEXT;
const text = async (path) => (await req(path)).text();
/* A key's sentence as a page draws it as text, and the part of it before its `{said}` (what tells one stop from another). */
const h = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Whether `text` holds the key's sentence with `{said}` filled by anything (Cloudflare's own words). */
const isWord = (text, key, vars = {}) => { const [a, b] = word(key, { said: "\u0000", ...vars }).split("\u0000"); return text.includes(a) && text.includes(b); };
const stoppedWith = (w, key, vars = {}) => w.page.failed?.said.startsWith(headOf(key, vars));
const secretsOf = (put) => (put?.meta?.bindings || []).filter((b) => b.type === "secret_text");
/* Every page this suite renders, for R19, R22, R31 and R35, which hold over all of them: its words, and (R35) each page
   as the browser receives it, the streamed page's own scripts included. */
const PAGES = [], RAW = [];
const seen = (x) => { PAGES.push(typeof x === "string" ? x : x.page.words); RAW.push(typeof x === "string" ? x : x.raw); return x; };
const MEMBERS = FLEET_BINDINGS.map(([m]) => m), BINDINGS = FLEET_BINDINGS.map(([, b]) => b);
/* R21's choices are `jurisdictions`' data, shown as data: R22 and R31 hold over every other word of every page, so
   exactly the rendered name and coverage of each choice is taken out before they read a page. */
const withoutChoices = (page) => page.replace(/<span class="pname">[^<]*<\/span>/g, "")
  .replace(/<span class="small pcovers">[^<]*<\/span>/g, "")
  .replace(/<input type="checkbox" name="profile" value="[^"]*">/g, "");
const INVITATION = readFileSync(new URL("../../bio-plane/public/newgroup/index.html", import.meta.url), "utf8");

/* ------------------------------------------------------------------------------------------------ the routes */

test("R1 GET / serves the install page and GET /update the update page; any other path or method is a 404 plain page; no route stores anything", async () => {
  const calls = script([]);
  const home = await req("/"), up = await req(UPDATE_PATH);
  const hb = seen(await home.text()), ub = seen(await up.text());
  assert.deepEqual([home.status, up.status], [200, 200]);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.ok(hb.includes('mode:"install"') && !hb.includes('mode:"update"'), "the install page begins an install");
  assert.ok(ub.includes('mode:"update"') && !ub.includes('mode:"install"'), "the update page begins an update");
  for (const [path, init] of [["/nothing", {}], ["/update/x", {}], ["/begin", {}], ["/callback", { method: "POST" }],
                              ["/", { method: "POST" }], ["/favicon.ico", {}], ["/app/assets/nothing", {}], ["/app/assets/", {}],
                              ["/app/assets/civicsmith.css", { method: "POST" }], ["/app/assets/fonts", {}]]) {
    const r = await req(path, init);
    const b = seen(await r.text());
    assert.equal(r.status, 404, path);
    assert.ok(b.includes(word("installer.notfound.title")), path);
    assert.equal(r.headers.get("set-cookie"), null, `${path} sets nothing`);
  }
  /* Nothing to store into: the pages and a refusal reach no network and set no cookie. */
  assert.equal(home.headers.get("set-cookie"), null);
  assert.deepEqual(calls, []);
  globalThis.fetch = realFetch;
});

test("R2 POST /begin: the slug grammar and the wizard's own name refused 400 in words; a malformed instanceAi refused by name; else PKCE S256, a fresh state, exactly the scopes registered on the OAuth client (the Containers write scope, the VPC bind scope and, since K3819, the Logs read scope among them), the registered redirect, and the 15-minute cookie; no field carries a Claude credential", async () => {
  for (const bad of ["", "ab", "-abc", "abc-", "Abc", "a_b", "a".repeat(41), "abc.def", "newgroup", 12345, null]) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: bad }) });
    const j = await r.json();
    assert.deepEqual([r.status, j.ok], [400, false], `slug ${JSON.stringify(bad)}`);
    assert.equal(j.error, word("installer.begin.slug"));
    assert.equal(r.headers.get("set-cookie"), null);
  }
  for (const good of ["abc", "a1-b2", "a".repeat(40), "9to5"]) assert.equal((await begin(good)).j.ok, true, good);
  for (const badAi of ["short", "has a space-0123456789", "tab\there-0123456789", "x".repeat(513), "é".repeat(20)]) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "ai-group", instanceAi: badAi }) });
    const j = await r.json();
    assert.deepEqual([r.status, j.ok], [400, false]);
    assert.equal(j.error, word("installer.begin.ai"));
  }
  const AI = "aik-" + "7".repeat(20);
  const a = await begin("oak-watch", "update", { instanceAi: AI, version: NEXT });
  const b = await begin("oak-watch", "something-else");
  const u = new URL(a.j.authorize);
  assert.equal(u.origin + u.pathname, CFG.AUTHORIZE);
  assert.deepEqual(Object.fromEntries([...u.searchParams].filter(([k]) => !["state", "code_challenge"].includes(k))), {
    response_type: "code", client_id: CFG.CLIENT_ID, redirect_uri: "https://newgroup.believeinoakland.workers.dev/callback",
    scope: REGISTERED_SCOPES.join(" "), code_challenge_method: "S256" });
  /* R2 (N1151; K3818, K3819): the sixth scope, `account-logs.read`, reads the Logpush job list (R46) and is registered on the client
     (Bob's act); control: the authorize address carries no scope the client does not hold, and no Logs write power is ever asked. */
  assert.deepEqual(CFG.SCOPES, REGISTERED_SCOPES);
  assert.deepEqual(CFG.SCOPES.filter((x) => /logs/.test(x)), ["account-logs.read"]);
  /* R36: a Claude credential sent to /begin is taken nowhere: the cookie holds no trace of it. */
  const CLAUDE = "sk-ant-oat01-" + "q".repeat(40);
  const c = await begin("no-claude", "install", { instanceClaude: CLAUDE, claude: CLAUDE });
  assert.equal(c.j.ok, true);
  assert.ok(!JSON.stringify(cookieValue(c.cookie)).includes(CLAUDE) && !c.r.headers.get("set-cookie").includes(CLAUDE));
  const saved = cookieValue(a.cookie), savedB = cookieValue(b.cookie);
  const challenge = createHash("sha256").update(saved.v).digest("base64url");
  assert.equal(u.searchParams.get("code_challenge"), challenge, "the challenge is S256 of the cookie's verifier");
  assert.equal(saved.s, a.state);
  assert.notEqual(a.state, b.state, "a fresh state each time");
  assert.notEqual(saved.v, savedB.v, "a fresh verifier each time");
  assert.deepEqual([saved.slug, saved.mode, saved.ai, typeof saved.t, saved.r], ["oak-watch", "update", AI, "number", NEXT]);
  assert.deepEqual([savedB.mode, "ai" in savedB], ["install", false], "mode is update, or else install");
  assert.ok(Math.abs(saved.t - Date.now()) < 5000);
  const sc = a.r.headers.get("set-cookie");
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=900", "Path=/"]) assert.ok(sc.includes(attr), attr);
  assert.ok(!a.j.authorize.includes(saved.v), "the verifier never travels in the address");
});

test("R3 GET /callback always clears the cookie; a refusal, a missing code, a missing or unreadable cookie, a state mismatch or a stale cookie create nothing; otherwise it streams the install or the update", async () => {
  const calls = script([]);
  const cleared = (r) => /Max-Age=0/.test(r.headers.get("set-cookie") || "");
  const { cookie, state } = await begin("oak-watch");
  const stale = "bio_wiz=" + b64url(JSON.stringify({ ...cookieValue(cookie), t: Date.now() - 16 * 60 * 1000 }));
  const refused = await callback("error=access_denied&error_description=User+refused", cookie);
  seen(refused);
  assert.ok(cleared(refused.r));
  assert.ok(refused.raw.includes(h(word("installer.callback.denied.title"))));
  assert.ok(refused.raw.includes(h(word("installer.callback.denied.what"))));
  for (const [qs, ck, why] of [[`state=${state}`, cookie, "no code"], [`code=C&state=${state}`, null, "no cookie"],
       [`code=C&state=${state}`, "bio_wiz=%%%not-base64", "unreadable cookie"],
       [`code=C&state=${state}`, "bio_wiz=" + b64url("not json"), "cookie not JSON"],
       ["code=C&state=WRONG", cookie, "state mismatch"], [`code=C&state=${state}`, stale, "older than 15 minutes"]]) {
    const out = await callback(qs, ck);
    seen(out);
    assert.ok(cleared(out.r), why);
    assert.ok(out.raw.includes(h(word("installer.callback.unverified.title"))), why);
    assert.ok(out.raw.includes(h(word("installer.callback.unverified.what"))), why);
  }
  assert.deepEqual(calls, [], "nothing upstream was touched");
  globalThis.fetch = realFetch;
  const inst = seen(await run({ slug: "cb-install" }));
  assert.ok(cleared(inst.r));
  assert.equal(inst.r.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(inst.page.steps[0], "auth");
  assert.ok(inst.page.steps.includes("install"));
  const upd = seen(await run({ slug: "cb-update", mode: "update", pre: { "cb-update": [] } }));
  assert.ok(cleared(upd.r));
  assert.ok(upd.page.steps.includes("find") && upd.page.steps.includes("up") && !upd.page.steps.includes("install"));
});

/* ------------------------------------------------------------------------------------------------ the install */

const created = (w) => ({ scripts: [...w.acct.keys()].filter((k) => k !== "bio-plan-probe"), buckets: [...w.buckets] });

test("R4 a refusal at any step before `install` says nothing was created, and nothing was; the plan probe is deleted or named; the first account listed is used and named", async () => {
  /* R75: each stop is one sentence by key, which says that nothing was created. */
  const cases = [
    ["auth", { tokenFail: true }, "installer.install.stopped.permission"], ["acct", { accountsFail: true }, "installer.install.stopped.account"],
    ["acct", { accounts: [] }, "installer.install.stopped.account"], ["plan", { plan: "free" }, "screen.install.stopped.plan"],
    ["plan", { plan: "unknown" }, "installer.install.stopped.planunknown"], ["r2", { r2: "refused" }, "installer.install.stopped.storage"],
  ];
  for (const [step, opts, key] of cases) {
    const w = seen(await run({ slug: "early-" + step, ...opts }));
    assert.equal(w.page.status(step), "no", `${step} ${JSON.stringify(opts)}`);
    assert.ok(stoppedWith(w, key), `${step}: the stop is ${key}`);
    assert.deepEqual(created(w), { scripts: [], buckets: [] }, `${step}: nothing exists afterwards`);
    assert.ok(!w.acct.has("bio-plan-probe"), "no probe left behind");
    assert.ok(!w.page.done, "no panel");
  }
  /* R66 (F4): an account lookup that Cloudflare keeps failing is retried within the stated bound, then ends a named stop
     (not a refusal of the name) that leaves nothing half-installed. */
  const stuck = seen(await run({ slug: "early-fresh", settingsFail: true }));
  assert.notEqual(stuck.page.status("fresh"), "ok");
  assert.equal(stuck.page.failed.s, word("installer.stopped.at", { step: word("installer.step.fresh") }));
  assert.equal(stuck.page.failed.said, word("screen.install.stopped.lasting"));
  assert.equal(stuck.page.failed.d, word("screen.install.stopped.lasting.do"));
  assert.deepEqual(created(stuck), { scripts: [], buckets: [] });
  assert.ok(!stuck.page.done, "no panel");
  /* R20 at `rel`, the first step after `fresh`: a built-in stating no limits with no usable repository release. */
  if (!BUILTIN_LIMITS.ok) {
    const w = seen(await run({ slug: "early-rel", rel: null }));
    assert.equal(w.page.status("rel"), "no");
    assert.ok(stoppedWith(w, "installer.install.stopped.nolimits", { refusal: "" }));
    assert.deepEqual(created(w), { scripts: [], buckets: [] });
    assert.ok(!w.acct.has("bio-plan-probe") && !w.calls.some((c) => c.u.includes("bio-plan-probe")), "refused before the probe");
  }
  const left = seen(await run({ slug: "probe-left", probeDelete: "fail" }));
  assert.equal(left.page.status("plan"), "ok");
  assert.equal(left.page.label("plan"), word("screen.install.progress.plan") + ". " + word("installer.probe.leftover", { name: "bio-plan-probe" }));
  const clean = seen(await run({ slug: "probe-clean" }));
  assert.ok(!clean.acct.has("bio-plan-probe"), "the probe was deleted");
  /* R84 (6): with several accounts the founder chooses one by name, and only the chosen one is touched. */
  const accounts = [{ id: "first", name: "The First" }, { id: "second", name: "The Second" }];
  const two = seen(await run({ slug: "two-accounts", accounts, choose: { account: "second" } }));
  assert.equal(two.page.label("acct"), word("installer.account.using", { account: "The Second" }));
  assert.ok(two.calls.every((c) => !c.u.includes("/accounts/first")), "only the chosen account is touched");
  assert.ok(two.calls.some((c) => c.u.includes("/accounts/second/workers/scripts/two-accounts")));
});

test("R5 `fresh`: an existing script named for the slug is refused and nothing is changed; a failed lookup is refused", async () => {
  const pre = { "taken-name": [{ type: "plain_text", name: "VERSION", text: "0.1.0" }] };
  const w = seen(await run({ slug: "taken-name", pre }));
  assert.equal(w.page.status("fresh"), "no");
  /* R70 (F7): the stop is the design's, and offers a free name; it says nothing was created. */
  assert.equal(w.page.failed.said, word("screen.install.stopped.nametaken", { name: "taken-name" }));
  assert.ok(w.page.failed.d.endsWith(word("screen.install.stopped.nametaken.do", { free: "" })), "it offers a free name");
  assert.deepEqual(w.acct.get("taken-name"), pre["taken-name"]);
  assert.ok(!w.calls.some((c) => c.method !== "GET" && c.u.startsWith(CFG.API)), "no write of any kind");
  /* A lookup that fails is refused: R66 retries the lookup within its bound, then the lasting failure ends the run. */
  const f = seen(await run({ slug: "lookup-fails", settingsFail: true }));
  assert.notEqual(f.page.status("fresh"), "ok");
  assert.equal(f.page.failed.s, word("installer.stopped.at", { step: word("installer.step.fresh") }));
  assert.ok(!f.calls.some((c) => c.method !== "GET" && c.u.startsWith(CFG.API)));
  assert.ok(!f.page.done, "no panel");
});

test("R6 `plan` is found by upload: a probe with limits.cpu_ms refused 100328 is Free and refused saying Workers Paid and how; any other failure is unknown and refused; Paid is confirmed", async () => {
  const paid = seen(await run({ slug: "plan-paid" }));
  const probe = paid.calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/bio-plan-probe"));
  assert.ok(JSON.parse(await probe.init.body.get("metadata").text()).limits.cpu_ms > 0);
  /* The release is chosen first (R20 with R4: before anything is created); it is read from the public repository, not the account. */
  const before = paid.calls.slice(0, paid.calls.indexOf(probe)).filter((c) => !c.u.startsWith(CFG.RELEASE_LATEST))
    .map((c) => `${c.method} ${c.u.replace(CFG.API, "")}`);
  assert.deepEqual(before, [`POST ${CFG.TOKEN}`, "GET /accounts",
    /* R84 (1): the account's storage entitlement, read without writing, before the account is looked at. */
    "GET /accounts/A1/r2/buckets",
    /* R62's look for a copy already held (the account's workers, buckets and Durable Object classes, listed), then the new
       slug's own name (R64's `fresh`), never a plan field. */
    "GET /accounts/A1/workers/scripts", "GET /accounts/A1/r2/buckets",
    "GET /accounts/A1/workers/durable_objects/namespaces?per_page=1000", "GET /accounts/A1/workers/scripts/plan-paid/settings"],
    "no plan field is read before the probe");
  assert.equal(paid.page.label("plan"), word("screen.install.progress.plan"));
  const free = seen(await run({ slug: "plan-free", plan: "free" }));
  /* R70 (F2): the stop and what to turn on are the design's keys; the page says why Workers Paid is needed. */
  assert.equal(free.page.failed.said, word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"));
  assert.equal(free.page.failed.d, word("screen.install.stopped.plan.do"));
  const unknown = seen(await run({ slug: "plan-unknown", plan: "unknown" }));
  assert.ok(stoppedWith(unknown, "installer.install.stopped.planunknown"), "unknown is its own stop");
  assert.ok(!unknown.page.failed.said.includes(word("screen.install.stopped.plan")), "unknown is never said to be Free");
  assert.ok(unknown.page.failed.said.includes("internal error"), "Cloudflare's own words follow");
  for (const w of [free, unknown]) assert.ok(!w.page.steps.includes("r2"), "refused before the first creation");
});

test("R7 `r2`: both evidence buckets exist afterwards (\"already exists\" counts), or the install is refused saying a payment method is needed", async () => {
  const w = seen(await run({ slug: "r2-fresh" }));
  /* R64: the buckets are named for the slug. */
  assert.deepEqual([...w.buckets].sort(), ["bio-captures-r2-fresh", "bio-published-r2-fresh"]);
  /* An install meets a bucket already there only by a race: one created between `fresh`'s look and this step. */
  const again = seen(await run({ slug: "r2-again", r2: "late" }));
  assert.equal(again.page.status("r2"), "ok");
  assert.deepEqual([...again.buckets].sort(), ["bio-captures-r2-again", "bio-published-r2-again"]);
  assert.ok(again.page.steps.includes("install"));
  const no = seen(await run({ slug: "r2-refused", r2: "refused" }));
  assert.equal(no.page.status("r2"), "no");
  assert.ok(stoppedWith(no, "installer.install.stopped.storage"), "the stop says a payment method is needed");
  assert.ok(!no.acct.has("r2-refused"));
});

test("R8 `rel`: the repository's release installs only when newer, hashing to its manifest and (armed) signed in the release namespace by an armed key; otherwise the built-in installs and the page says why", async () => {
  const builtin = RELEASE_VERSION;
  const cases = [
    ["newer, signed", { version: NEXT }, "repository", word("installer.release.newer.signed", { version: NEXT, builtin })],
    ["not newer", { version: RELEASE_VERSION }, "built-in", word("installer.release.current", { builtin })],
    ["older", { version: "0.0.1" }, "built-in", word("installer.release.current", { builtin })],
    ["integrity", { version: NEXT, tamperPlane: true }, "built-in", word("installer.release.fallback.integrity")],
    ["unsigned", { version: NEXT, sig: "none" }, "built-in", word("installer.release.fallback.unsigned")],
    ["stranger", { version: NEXT, sig: "stranger" }, "built-in", word("installer.release.fallback.wrongsigner", { reason: "UNKNOWN_KEY" })],
    ["wrong namespace", { version: NEXT, sig: "wrong-ns" }, "built-in", word("installer.release.fallback.wrongsigner", { reason: "NAMESPACE" })],
    ["unreachable", null, "built-in", word("installer.release.fallback.unreachable", { builtin })],
  ];
  armWith(SIGNER.line);
  for (const [why, opts, from, says] of cases) {
    let rel = null;
    if (opts) { rel = await release({ ...opts, fleet: false }); if (opts.tamperPlane) rel.assets["bio-plane.bundled.mjs"] = "tampered"; }
    const w = seen(await run({ slug: "rel-" + why.replace(/\W+/g, "-"), rel }));
    assert.ok(w.page.label("rel").startsWith(says), why);
    /* A failed check is followed by the one sentence that says the built-in installs instead. */
    if (["integrity", "unsigned", "stranger", "wrong namespace"].includes(why)) assert.ok(w.page.label("rel").endsWith(word("installer.release.fallback.tail", { builtin })), why);
    const put = w.planePuts[0];
    /* The built-in installs in its place, unless it states no limits, when R20 refuses the act (asserted under R20). */
    if (from === "built-in" && !BUILTIN_LIMITS.ok) { assert.equal(put, undefined, why); continue; }
    assert.equal(put?.source, from === "repository" ? rel.src : RELEASE_SOURCE, why);
    assert.equal(bindingOf(put, "VERSION").text, from === "repository" ? NEXT : RELEASE_VERSION, why);
  }
  disarm();
  const rel = await release({ version: NEXT, sig: "none", fleet: false });
  const w = seen(await run({ slug: "rel-unarmed", rel }));
  assert.equal(w.planePuts[0].source, rel.src, "unarmed, the hash alone admits it");
  assert.equal(w.page.label("rel"), word("installer.release.newer.checked", { version: NEXT, builtin: RELEASE_VERSION }));
  const bad = await release({ version: NEXT, sig: "none", fleet: false });
  bad.assets["bio-plane.bundled.mjs"] = "tampered";
  assert.ok((await run({ slug: "rel-unarmed-bad", rel: bad })).planePuts.every((p) => p.source === RELEASE_SOURCE), "nothing that failed is installed");
  restoreSigners();
});

test("R9 `gen`: four fresh 32-byte random credentials (ADMIN_TOKEN, PROBE_TOKEN, DAEMON_TOKEN, ACCOUNT_SEAL_SECRET) and no MEMBER_TOKEN, on any upload; INSTANCE_AI_TOKEN bound only when the operator supplied a valid one, never generated", async () => {
  const a = seen(await run({ slug: "gen-a" })), b = seen(await run({ slug: "gen-b" }));
  const names = (w) => secretsOf(w.planePuts[0]).map((s) => s.name).sort();
  assert.deepEqual(names(a), ["ACCOUNT_SEAL_SECRET", "ADMIN_TOKEN", "DAEMON_TOKEN", "PROBE_TOKEN"]);
  const values = [...secretsOf(a.planePuts[0]), ...secretsOf(b.planePuts[0])].map((s) => s.text);
  for (const v of values) assert.equal(Buffer.from(v, "base64url").length, 32, "32 random bytes, base64url");
  assert.equal(new Set(values).size, 8, "distinct within an install and across installs");
  /* T36 (N711): the shared member key is retired: no upload of any act binds one, and the copy holds none afterwards. */
  armWith(SIGNER.line);
  const full = seen(await run({ slug: "gen-full", rel: await release({ version: NEXT }) }));
  restoreSigners();
  for (const w of [a, b, full]) {
    assert.ok(w.planePuts.length >= 2, "the install's uploads, its last included");
    for (const put of w.planePuts) assert.equal(bindingOf(put, "MEMBER_TOKEN"), null);
    assert.equal((w.acct.get(w.planePuts[0].meta.bindings.find((x) => x.name === "INSTANCE_NAME").text) || []).some((x) => x.name === "MEMBER_TOKEN"), false);
  }
  const AI = "aik-" + "5".repeat(30);
  const ai = seen(await run({ slug: "gen-ai", ai: AI }));
  assert.deepEqual(secretsOf(ai.planePuts[0]).filter((s) => s.name === "INSTANCE_AI_TOKEN").map((s) => s.text), [AI]);
  for (const w of [a, b]) for (const p of w.planePuts) assert.equal(bindingOf(p, "INSTANCE_AI_TOKEN"), null);
});

test("R10 `install`: the plane uploaded with STORE (SQLite v1), VERSION, INSTANCE_NAME, the four credentials, both buckets, SELF, BROWSER, the members present, the limits and the plane's compatibility; a refusal retries once without SELF, else nothing is left", async () => {
  const cfg = readFileSync(new URL("../../bio-plane/wrangler.jsonc", import.meta.url), "utf8");
  const compatDate = cfg.match(/"compatibility_date":\s*"([^"]+)"/)[1];
  const compatFlags = JSON.parse(cfg.match(/"compatibility_flags":\s*(\[[^\]]*\])/)[1]);
  /* An install's account holds no member (an account that does is told and offered a way on, R62, below), so the members present are none. */
  const w = seen(await run({ slug: "inst-shape", ai: "aik-" + "3".repeat(20) }));
  const m = w.planePuts[0].meta;
  assert.deepEqual(m.migrations, { new_tag: "v1", new_sqlite_classes: ["Store"] });
  assert.deepEqual([m.main_module, m.compatibility_date, m.compatibility_flags], ["index.mjs", compatDate, compatFlags]);
  assert.deepEqual(m.limits, { ...LIMITS }, "the release's own statement (R20)");
  const by = Object.fromEntries(m.bindings.map((b) => [b.name, b]));
  assert.deepEqual(by.STORE, { type: "durable_object_namespace", name: "STORE", class_name: "Store" });
  assert.equal(by.VERSION.text, DEFAULT_VERSION);
  assert.deepEqual(by.INSTANCE_NAME, { type: "plain_text", name: "INSTANCE_NAME", text: "inst-shape" });
  assert.deepEqual([by.CAPTURES.bucket_name, by.PUBLISHED.bucket_name], ["bio-captures-inst-shape", "bio-published-inst-shape"], "R64: named for the slug");
  assert.deepEqual(by.SELF, { type: "service", name: "SELF", service: "inst-shape" });
  assert.deepEqual(by.BROWSER, { type: "browser", name: "BROWSER" });
  for (const name of BINDINGS) assert.equal(by[name], undefined, `${name}: no member present, none bound`);
  assert.equal(by.INSTANCE_AI_TOKEN.type, "secret_text");
  assert.equal(by.ACCOUNT_SEAL_SECRET.type, "secret_text");
  assert.equal(Object.keys(by).length, 12, "nothing else: " + Object.keys(by).join(","));
  const held = seen(await run({ slug: "inst-held", pre: { "pdf-worker": [{ type: "plain_text", name: "VERSION", text: "0.1.0" }] } }));
  assert.equal(held.planePuts.length, 0, "an account already holding a member is told so (R62), never bound into an install");
  /* A member without its plane has nothing to update: the page offers alongside and removal. */
  for (const k of ["alongside", "remove"]) assert.ok(held.page.done.includes(word(`screen.install.exists.${k}.name`)), `the page offers ${k}`);
  assert.ok(!held.page.done.includes('class="cs-sheet ng-block exists-update"'), "no update of a copy with no plane");
  const shy = seen(await run({ slug: "inst-shy", refuseSelf: true }));
  assert.equal(shy.planePuts.filter((p) => "migrations" in p.meta).length, 1, "the retry landed");
  /* Its last upload (R47's, after the address) restates what the install achieved: still no SELF. */
  for (const put of shy.planePuts) assert.equal(bindingOf(put, "SELF"), null);
  assert.equal(shy.refused.filter((r) => r.startsWith("inst-shy")).length, 1, "retried exactly once");
  assert.ok(shy.page.label("install").startsWith(headOf("installer.install.noschedule")), "the install says the optional part was left out");
  const no = seen(await run({ slug: "inst-refused", refuseAllPlane: true }));
  assert.equal(no.refused.length, 2, "tried with SELF, then once without");
  assert.equal(no.page.status("install"), "no");
  assert.ok(stoppedWith(no, "installer.install.stopped.refused"), "nothing left behind to clean up");
  assert.ok(!no.acct.has("inst-refused"));
  assert.ok(!no.page.done);
});

test("R11 `fleet`: members install only from a reachable repository whose signed fleet statement verifies against an armed key and names the plane just installed; each part hashed; an unknown part type refuses that member; sheet-worker installs as any member; every member left out is named; the install never fails over one", async () => {
  armWith(SIGNER.line);
  const full = seen(await run({ slug: "fleet-all", rel: await release({ version: NEXT }) }));
  for (const member of MEMBERS) assert.ok(full.acct.has(`${member}-fleet-all`), member);
  assert.deepEqual(full.acct.get("agent-worker-fleet-all").find((b) => b.name === "PLANE"), { type: "service", name: "PLANE", service: "fleet-all" });
  assert.ok(full.page.label("fleet").startsWith(headOf("installer.fleet.done.other", { n: MEMBERS.length })));
  const noneOf = async (why, opts, says, runOpts = {}) => {
    const w = seen(await run({ slug: "fleet-" + why, rel: opts && await release({ version: NEXT, ...opts }), ...runOpts }));
    for (const member of MEMBERS) assert.ok(!w.acct.has(`${member}-fleet-${why}`), `${why}: ${member} not installed`);
    assert.match(w.page.label("fleet"), says, why);
    assert.equal(w.page.status("install"), "ok", `${why}: the plane installed`);
    assert.ok(w.page.done, `${why}: the install finished`);
  };
  /* The two arms that fall back to the built-in run only when it states its limits (else R20 refuses the act). */
  /* R61: with the repository unreachable the built-in release installs, with the fleet statement it carries itself, its members
     fetched from its tag; a tag that serves none leaves each member out, named, and the install is not failed over them. */
  if (BUILTIN_LIMITS.ok) {
    restoreSigners();                                 /* the built-in is signed by the shipped keys */
    const own = seen(await run({ slug: "fleet-unreachable", rel: null, builtInFleet: true }));
    assert.ok(own.acct.has("pdf-worker-fleet-unreachable") && own.acct.has("agent-worker-fleet-unreachable"));
    /* The embedded release's statement names all the fleet, and its tag serves every member: none is left out (R17). */
    for (const member of MEMBERS) assert.ok(own.acct.has(`${member}-fleet-unreachable`), `built-in: ${member} installed`);
    assert.ok(own.page.label("fleet").startsWith(headOf("installer.fleet.done.other", { n: MEMBERS.length })), "built-in: all installed, none left out");
    const bare = seen(await run({ slug: "fleet-tagless", rel: null }));
    for (const member of MEMBERS) assert.ok(!bare.acct.has(`${member}-fleet-tagless`), member);
    assert.match(bare.page.label("fleet"), like("installer.fleet.partial.none", { list: new RegExp("[\\s\\S]*" + like("installer.fleet.left.item", { member: "pdf-worker", why: like("installer.fleet.why.http", { status: 404 }) }).source + "[\\s\\S]*") }));
    assert.ok(bare.page.done, "the install is not failed over a member");
    armWith(SIGNER.line);
  }
  await noneOf("no-fleet", { fleet: false }, like("installer.fleet.skip.none"));
  await noneOf("no-fleetsig", { fleetSig: "none" }, like("installer.fleet.skip.none"));
  await noneOf("dropped", { signedMembers: ["agent-worker", "pdf-worker", "ocr-worker", "extra-worker"] }, like("installer.fleet.skip.signature"));
  /* K1905: the words are R40's (T34-84): "a different release of Civicsmith", never "plane". */
  /* R61: the fleet is the chosen release's own statement. A repository release signed by a stranger is passed over: the
     built-in installs with the statement it carries itself, none of the repository's members is fetched, and the built-in's
     are, from its tag. */
  if (BUILTIN_LIMITS.ok) {
    restoreSigners();
    const w = seen(await run({ slug: "fleet-foreign-plane", rel: await release({ version: NEXT, sig: "stranger" }), builtInFleet: true }));
    assert.ok(w.acct.has("pdf-worker-fleet-foreign-plane"));
    assert.ok(!w.calls.some((c) => c.u.startsWith(CFG.RELEASE_LATEST) && /-worker\.bundled\.mjs$/.test(c.u)), "none of the repository's members");
    assert.ok(w.calls.some((c) => c.u.includes("/v" + RELEASE_VERSION + "/release/pdf-worker.bundled.mjs")), "the built-in's own");
    /* Control: a repository serving the built-in's version with other bytes pairs the built-in's statement with parts that do
       not hash to it: no member is installed, each named for its integrity. */
    const paired = seen(await run({ slug: "fleet-not-newer", rel: await release({ version: RELEASE_VERSION }), builtInFleet: true }));
    for (const member of MEMBERS) assert.ok(!paired.acct.has(`${member}-fleet-not-newer`), member);
    assert.match(paired.page.label("fleet"), like("installer.fleet.left.item", { member: "pdf-worker", why: like("installer.fleet.why.integrity") }));
    assert.ok(paired.page.done);
    armWith(SIGNER.line);
  }
  disarm();
  await noneOf("unarmed", {}, like("installer.fleet.skip.nokey"));
  armWith(SIGNER.line);
  const part = seen(await run({ slug: "fleet-part", rel: await release({ version: NEXT, badType: "ocr-worker" }) }));
  assert.ok(!part.acct.has("ocr-worker-fleet-part") && part.acct.has("pdf-worker-fleet-part") && part.acct.has("agent-worker-fleet-part"));
  assert.match(part.page.label("fleet"), like("installer.fleet.why.part"));
  const bytes = seen(await run({ slug: "fleet-hash", rel: await release({ version: NEXT, tamper: "pdf-worker", missing: "agent-worker" }) }));
  assert.ok(!bytes.acct.has("pdf-worker-fleet-hash") && !bytes.acct.has("agent-worker-fleet-hash") && bytes.acct.has("ocr-worker-fleet-hash"));
  const said = bytes.page.label("fleet");
  const rest = MEMBERS.filter((m) => m !== "pdf-worker" && m !== "agent-worker");
  assert.equal(said.search(like("installer.fleet.partial.some", { installed: rest.length, names: rest.join(", "), left: 2 })), 0, said);
  assert.match(said, like("installer.fleet.left.item", { member: "pdf-worker", why: like("installer.fleet.why.integrity") }), said);
  assert.match(said, like("installer.fleet.left.item", { member: "agent-worker", why: like("installer.fleet.why.http", { status: 404 }) }), said);
  assert.ok(bytes.page.done, "the install never fails over a member");
  /* T33-91: sheet-worker installs as any member (inactive until the release that activates it, K1506); a container
     member is R38's. */
  const sheet = seen(await run({ slug: "fleet-sheet", rel: await release({ version: NEXT, members: [...new Set([...MEMBERS, "sheet-worker"])] }) }));
  assert.ok(sheet.acct.has("sheet-worker-fleet-sheet"));
  assert.match(sheet.page.label("fleet"), like("installer.fleet.done.other", { n: new Set([...MEMBERS, "sheet-worker"]).size, names: /[\s\S]*sheet-worker[\s\S]*/ }));
  const ocr = full.calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/ocr-worker-fleet-all"));
  assert.equal(ocr.init.body.get("assets/x.wasm").type, "application/wasm", "a part is uploaded under its stated type");
  restoreSigners();
});

test("R12 `bind`: the plane bound first to the members already present, then the members installed, then (only when one was added) re-uploaded bound to every member present; a refused re-upload is named and the members stay", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  /* R64: every member's worker is named for the slug it serves; a copy under the older fixed names keeps them. */
  const RIGHT = (slug, scheme = "slug") => Object.fromEntries(FLEET_BINDINGS.map(([m, b]) => [b, scheme === "legacy" ? m : `${m}-${slug}`]));
  const targets = (bindings) => Object.fromEntries(BINDINGS.map((b) => [b, (bindings || []).find((x) => x.name === b)?.service ?? null]));
  const fresh = seen(await run({ slug: "bind-fresh", rel }));
  assert.equal(fresh.planePuts.length, 2);
  assert.deepEqual(targets(fresh.planePuts[0].bindings), Object.fromEntries(BINDINGS.map((b) => [b, null])), "act 1: none present");
  assert.deepEqual(targets(fresh.planePuts[1].bindings), RIGHT("bind-fresh"), "act 3: every member");
  assert.deepEqual(fresh.refused, [], "never a binding to a worker not yet there");
  const puts = fresh.calls.filter((c) => c.method === "PUT" && /\/workers\/scripts\/[^/]+$/.test(c.u) && !c.u.endsWith("bio-plan-probe"))
    .map((c) => c.u.split("/scripts/")[1]);
  assert.equal(puts[0], "bind-fresh"); assert.equal(puts.at(-1), "bind-fresh");
  assert.deepEqual(puts.slice(1, -1).sort(), MEMBERS.map((m) => `${m}-bind-fresh`).sort(), "act 2 between");
  assert.equal(fresh.planePuts[1].meta.migrations, undefined, "the re-upload takes the update's shape");
  assert.match(fresh.page.label("bind"), like("installer.connect.done"));
  /* Members already present: under R32 only an update meets them (R17 runs `bind` as here), so the first act is shown there. */
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const had = seen(await run({ slug: "bind-had", mode: "update", rel,
    pre: { "bind-had": planeBase("bind-had"), ...Object.fromEntries(MEMBERS.map((m) => [m, old])) } }));
  assert.equal(had.planePuts.length, 1, "nothing added, no re-upload");
  assert.deepEqual(targets(had.planePuts[0].bindings), RIGHT("bind-had", "legacy"), "act 1 binds every member already present");
  const bad = seen(await run({ slug: "bind-refused", rel, refuseRePut: true }));
  assert.equal(bad.page.status("bind"), "no");
  assert.match(bad.page.label("bind"), /installed, but connecting your team's Civicsmith to them was refused/);
  for (const m of MEMBERS) assert.ok(bad.acct.has(`${m}-bind-refused`), `${m} stays installed`);
  restoreSigners();
});

test.todo("R13 each member that reads captured bytes is bound to the instance's CAPTURES bucket (not yet met: MULTI-INSTANCE-ISOLATION row 6; installed members get no R2 binding)");

test("R14 `addr`: the account's workers.dev prefix is used; with none, one is registered from the slug (or with a suffix) and said; the address is enabled; a failure says the copy is installed without an address", async () => {
  const has = seen(await run({ slug: "addr-has", subdomain: "grp" }));
  assert.ok(has.enabled.has("addr-has"));
  assert.equal(has.page.events.find((e) => e.k === "ok" && e.id === "addr").label, word("screen.install.progress.address"), "only the design's line");
  assert.ok(has.calls.some((c) => c.u === "https://addr-has.grp.workers.dev/api/?op=selftest"
    && c.init.headers?.authorization === "Bearer " + bindingOf(has.planePuts[0], "PROBE_TOKEN").text), "the address enabled is the one verified");
  /* R84 (4): the name the founder chose with a click is registered before any upload, and said. */
  const none = seen(await run({ slug: "addr-none", subdomain: null, choose: { subdomain: "addr-none" } }));
  assert.equal(none.prefix(), "addr-none");
  assert.equal(none.page.label("addr"), word("installer.address.prefix", { prefix: "addr-none" }));
  const chosenFirst = none.calls.findIndex((c) => c.method === "PUT" && c.u.endsWith("/workers/subdomain"));
  const firstUpload = none.calls.findIndex((c) => c.method === "PUT" && c.u.includes("/workers/scripts/addr-none"));
  assert.ok(chosenFirst >= 0 && chosenFirst < firstUpload, "registered before the first upload");
  const taken = seen(await run({ slug: "addr-taken", subdomain: null, taken: ["addr-taken"], choose: { subdomain: "addr-taken" } }));
  assert.equal(taken.prefix(), null, "a taken name registers nothing");
  assert.ok(!taken.acct.has("addr-taken"), "and nothing was created");
  const other = seen(await run({ slug: "addr-taken", subdomain: null, taken: ["addr-taken"], choose: { subdomain: "addr-taken-two" } }));
  assert.equal(other.prefix(), "addr-taken-two");
  assert.match(other.page.done, /https:\/\/addr-taken\.addr-taken-two\.workers\.dev/);
  /* A name Cloudflare refuses otherwise stops before anything is created; an enable that fails is the copy installed without an address
     (R66 retries only an answer that was lost or slow). */
  const refusedName = seen(await run({ slug: "addr-fails", subdomain: null, subdomainPut: "fail", choose: { subdomain: "addr-fails" } }));
  assert.equal(refusedName.page.status("room"), "no");
  assert.ok(stoppedWith(refusedName, "installer.install.stopped.lookup"));
  assert.deepEqual(created(refusedName), { scripts: [], buckets: [] });
  for (const opts of [{ enableFail: true }]) {
    const w = seen(await run({ slug: "addr-fails", ...opts }));
    assert.equal(w.page.status("addr"), "no");
    assert.ok(stoppedWith(w, "installer.install.stopped.noaddress"), "installed, but no address yet");
    assert.equal(w.page.failed.s, word("installer.stopped.at", { step: word("installer.step.address.install") }));
    assert.ok(w.acct.has("addr-fails"), "the copy stays installed");
  }
  /* R66 (F4): a Cloudflare that keeps answering with a server error is waited on within the bound, then ends the named lasting
     stop rather than a refusal; the copy stays installed. */
  for (const opts of [{ subdomain: null, subdomainPut: "down", choose: { subdomain: "addr-down" } }]) {
    const w = seen(await run({ slug: "addr-down", ...opts }));
    assert.equal(w.page.failed.said, word("screen.install.stopped.lasting"));
    assert.equal(w.page.failed.s, word("installer.stopped.at", { step: word("installer.step.room") }));
    assert.ok(!w.acct.has("addr-down"), "the address is settled before anything is created");
    assert.ok(w.page.waits.length >= 1, "the wait was drawn");
  }
});

test("R15 `verify`: op=selftest with the probe credential until it answers within the stated bound (R66), the credential only in each request's Authorization: Bearer header and in no address; a capable release's parts read back until each answers it, every lagging part named; an incapable release's parts stated undetermined; no success while a part lags", async () => {
  // fixtures-own: platform a copy still waking: its self-check answers not-ok, the fake network's own double of a platform that is not up yet, not any module's answer
  const quiet = seen(await run({ slug: "ver-quiet", copy: { selftest: () => jres({ ok: false }) } }));
  const probe = bindingOf(quiet.planePuts[0], "PROBE_TOKEN").text;
  const tries = quiet.calls.filter((c) => c.u.includes("op=selftest"));
  /* R66 amends "ten tries": the address is asked every 3 seconds for the stated bound, drawing each wait, then a lasting failure. */
  assert.equal(tries.length, 1 + (WAIT_BOUND_MINUTES * 60) / 3);
  assert.ok(quiet.page.waits.length >= 1, "the wait is drawn");
  /* F1 (K1874): every verify request carries the probe credential in its header, exactly as admission R20 reads it, and
     its address is the bare op. */
  for (const c of tries) {
    assert.equal(c.u, "https://ver-quiet.grp.workers.dev/api/?op=selftest");
    assert.equal(c.init.headers?.authorization, "Bearer " + probe);
  }
  assert.equal(quiet.page.status("verify"), "no");
  assert.ok(quiet.page.done.includes(h(word("installer.success.asleep"))), "the address has not woken up yet");
  /* The sentinel: in a whole install, verify included, the probe credential (and every other credential the install
     generated, and the Cloudflare token) is in no address of any request the installer makes, and the probe credential
     reaches the copy only in the verify step's header. */
  const ok = seen(await run({ slug: "ver-sentinel" }));
  const secrets = secretsOf(ok.planePuts[0]).map((b) => b.text);
  const sentinel = bindingOf(ok.planePuts[0], "PROBE_TOKEN").text;
  for (const c of ok.calls) for (const v of [...secrets, TOK]) assert.equal(c.u.includes(v), false, `${c.method} ${c.u}`);
  const carried = ok.calls.filter((c) => JSON.stringify(c.init.headers || {}).includes(sentinel));
  assert.ok(carried.length >= 1 && carried.every((c) => c.u === "https://ver-sentinel.grp.workers.dev/api/?op=selftest"),
    "the probe credential travels only to the verify step, in its header");
  assert.equal(ok.page.status("verify"), "ok");
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const all = seen(await run({ slug: "ver-all", rel }));
  assert.equal(all.page.status("verify"), "ok");
  assert.ok(all.calls.some((c) => c.u.includes("op=bootstrap&members=1")));
  assert.ok(all.page.done.includes(h(word("installer.success.running"))));
  /* R66: each lag case's `bootstrap` answer is the store's part from credentials' published fixture and the member entries from instance-setup's, never built by hand. */
  const fleet = await fleetReports();
  const { status: _status, version: _plane, memberVersions: _members, ...storeAbsent } = fleet.storeVersionAbsent;
  const lags = [
    [{ storeVersion: "0.1.0" }, ["installer.lag.store.version", { version: "0.1.0" }]],
    [{ memberVersion: "0.1.0" }, ["installer.lag.member.version", { name: "pdf-worker", version: "0.1.0" }]],
    [{ bootstrap: async (q, s) => jres({ ...storeAbsent, version: s.v, memberVersions: s.members }) }, ["installer.lag.store.unreported"]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: null, version: s.v, memberVersions: s.members })) }, ["installer.lag.store.unknown"]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: s.v })) }, ["installer.lag.members.unreported"]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: "0.1.0", memberVersions: s.members })) }, ["installer.lag.address.version", { version: "0.1.0" }]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: { ...s.members, "ocr-worker": fleet.silent.memberVersions["ocr-worker"] } })) }, ["installer.lag.member.silent.installed", { name: "ocr-worker" }]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: { ...s.members, "pdf-worker": fleet.misnamed.memberVersions["pdf-worker"] } })) }, ["installer.lag.member.misnamed", { name: "pdf-worker", other: "ocr-worker" }]],
    [{ bootstrap: async (q, s) => jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: { ...s.members, "ocr-worker": fleet.unbound.memberVersions["ocr-worker"] } })) }, ["installer.lag.member.unbound", { name: "ocr-worker" }]],
    [{ bootstrap: async (q, s) => { const mv = { ...s.members }; delete mv["ocr-worker"]; return jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: mv })); } }, ["installer.lag.member.unknown", { name: "ocr-worker" }]],
  ];
  for (const [copy, [key, vars]] of lags) {
    const named = key;
    const w = seen(await run({ slug: "ver-lag", rel, copy }));
    assert.equal(w.page.status("verify"), "no", named);
    assert.ok(w.page.done.includes(h(word(key, vars))), named);
    assert.ok(!w.page.done.includes(h(word("installer.success.running"))), named);
    assert.ok(w.page.done.includes('id="out-boot"'), "the credentials are still handed over");
  }
  const failed = seen(await run({ slug: "ver-failed", rel: await release({ version: NEXT, missing: "ocr-worker" }) }));
  assert.match(failed.page.done.replace(/&#39;/g, "'"), like("installer.lag.member.failed", { name: "ocr-worker" }));
  const pre = await release({ version: NEXT, src: PRE116_SRC });
  const inc = seen(await run({ slug: "ver-pre", rel: pre }));
  assert.equal(inc.page.status("verify"), "ok");
  assert.ok(inc.page.label("verify").includes(word("installer.verify.undetermined")));
  assert.ok(!inc.calls.some((c) => c.u.includes("op=bootstrap&members=1")), "nothing to read back");
  restoreSigners();
});

test("R16 the final panel shows the address, the one-time password and the probe credential once, and no member credential (none exists); never DAEMON_TOKEN, ACCOUNT_SEAL_SECRET, INSTANCE_AI_TOKEN or the Cloudflare token; it hands over with the one-time password in the fragment", async () => {
  const AI = "aik-" + "c".repeat(24);
  const w = seen(await run({ slug: "panel", ai: AI }));
  const s = Object.fromEntries(secretsOf(w.planePuts[0]).map((b) => [b.name, b.text]));
  const count = (hay, needle) => hay.split(needle).length - 1;
  assert.equal(count(w.raw, s.ADMIN_TOKEN), 1);
  assert.equal(count(w.raw, s.PROBE_TOKEN), 1);
  assert.equal(s.MEMBER_TOKEN, undefined, "no member credential exists");
  /* The panel's credentials, by their labels: exactly the one-time password, the address and the probe key (R51's order). */
  assert.deepEqual([...w.page.done.matchAll(/<span class="k">([^<]*)<\/span>/g)].map((m) => m[1]), [word("installer.success.otp"), word("installer.success.address"), word("installer.success.probe")]);
  assert.ok(!/out-member|[Mm]ember credential<\/span>/.test(w.page.done), "no member credential row");
  for (const hidden of [s.DAEMON_TOKEN, s.ACCOUNT_SEAL_SECRET, s.INSTANCE_AI_TOKEN, TOK]) assert.equal(w.raw.includes(hidden), false);
  assert.equal(typeof s.ACCOUNT_SEAL_SECRET, "string", "the seal secret was bound (K1541)");
  assert.match(w.page.done, /id="out-url">https:\/\/panel\.grp\.workers\.dev</);
  assert.match(w.page.done, /id="out-boot">/);
  /* R51 (T47): the hand-over is to the setup screen, the one-time password in its fragment, read from the panel at the click. */
  assert.match(w.page.done, /<button id="handover" class="cs-btn" data-tone="primary" data-url="https:\/\/panel\.grp\.workers\.dev\/app\/setup">/);
  assert.ok(w.raw.includes(`location.href=h.dataset.url+"#boot="+encodeURIComponent(document.getElementById("out-boot").textContent)`));
});

test("R34 the wizard's last screen shows, before the hand-over to your team's Civicsmith where the founder chooses a password, instance-setup R47's block in DEC-109's words (the same export), and asks for and records no acknowledgement; it names what it hands over to as \"your team's Civicsmith\" (R40)", async () => {
  const escd = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /* DEC-109's five points, each held in the one export both pages read. The words are instance-setup's (R47, which its
     own T34 job re-words for DEC-149), so each point is read by its meaning, not its exact wording. */
  const S = HOSTING_CONTROL.sentences;
  for (const [i, says] of [[0, /hosting account.*controls.*replace the one-time password.*claim.*again.*read everything.*lock everyone else out.*no vote of the team's administrators can stop them/s],
      [1, /team account.*not anyone's personal login/], [2, /at least one other trusted person/],
      [3, /someone other than the team's administrators hold it/], [4, /same account is the way back in if the password you choose is lost/]])
    assert.match(S[i], says, `point ${i + 1}`);
  const block = hostingControlBlock("notice", { deployer: true });
  armWith(SIGNER.line);
  /* Every ending of the install that hands over: running, lagging, asleep. */
  const ends = [seen(await run({ slug: "last-ok", rel: await release({ version: NEXT }) })),
    seen(await run({ slug: "last-lag", rel: await release({ version: NEXT }), copy: { storeVersion: "0.1.0" } })),
    // fixtures-own: platform a copy still waking: its self-check answers not-ok, the fake network's own double of a platform that is not up yet, not any module's answer
    seen(await run({ slug: "last-asleep", copy: { selftest: () => jres({ ok: false }) } }))];
  restoreSigners();
  for (const w of ends) {
    const done = w.page.done;
    const at = done.indexOf(block), hand = done.indexOf('<button id="handover"');
    assert.ok(at > 0 && hand > at, "the block, whole, before the hand-over");
    /* R40: the hand-over names what it hands over to as "your team's Civicsmith". */
    assert.ok(done.includes(`>${h(word("screen.install.continue"))}</button>`), "the hand-over's words");
    assert.equal(done.split(block).length - 1, 1, "shown once");
    for (const s of [HOSTING_CONTROL.heading, ...S]) assert.ok(done.slice(0, hand).includes(escd(s)), s);
    /* The reassurance-only paragraph it replaces is gone. */
    assert.ok(!done.includes("you are not locked out"), "the old paragraph is gone");
    /* No acknowledgement: no control but the copy buttons and the hand-over, nothing gating it, nothing sent. */
    assert.deepEqual([...done.matchAll(/<(input|select|textarea)\b/g)].length, 0, "no input of any kind");
    assert.deepEqual([...done.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]).filter((b) => !/class="copy"/.test(b)),
      [`<button id="handover" class="cs-btn" data-tone="primary" data-url="${done.match(/data-url="([^"]*)"/)[1]}">`], "the hand-over is the only other control, never disabled");
  }
  assert.ok(!w0(ends).raw.includes("acknowledg"), "nothing on the page asks for an acknowledgement");
  /* The very words instance-setup holds once (R47, R83: its one holder since the setup page retired; K3149), with R47's
     one difference (T35; F10, K1874; K2084): a screen links the guide by its name, and the installer's screen states the
     same sentence as text, with no link. The linked form differs from the installer's by the link alone. */
  const linked = hostingControlBlock("notice", { guideHref: "/app/guide", deployer: true });
  assert.ok(linked.includes('<a href="/app/guide">Replace the one-time password</a>'), "a screen links the guide by its name");
  assert.equal(linked.replace(/<a href="\/app\/guide">([^<]*)<\/a>/, "$1"), block, "the same block, the guide linked");
  assert.ok(!/<a\b/.test(block) && block.includes(escd(HOSTING_CONTROL.guide.sentence)), "the installer's screen states the guide as text");
  for (const w of ends) assert.ok(w.page.done.includes(block), "the installer's screen shows that block");
});
const w0 = (ends) => ({ raw: ends.map((w) => w.raw).join("\n") });

/* ------------------------------------------------------------------------------------------------ the update */

const planeBase = (slug, v = "0.1.0") => [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" },
  { type: "plain_text", name: "VERSION", text: v }, { type: "secret_text", name: "ADMIN_TOKEN", text: "admin-kept" },
  { type: "secret_text", name: "PROBE_TOKEN", text: "probe-kept" }, { type: "service", name: "SELF", service: slug }];
/* A copy installed before T36: it holds the shared member key and the assistant choice an earlier installer bound. */
const planeBefore36 = (slug, v = "0.1.0") => [...planeBase(slug, v), { type: "secret_text", name: "MEMBER_TOKEN", text: "member-kept" },
  { type: "plain_text", name: "ASSISTANT_ENABLED", text: "on" }];

test("R17 the update: no script refused unchanged; buckets where possible; the release chosen as R8; the version before read; the credentials, store and buckets kept and the rest restated; a refused upload leaves the copy; fleet, bind, verify as install; a no-op says so", async () => {
  const none = seen(await run({ slug: "upd-none", mode: "update" }));
  assert.equal(none.page.status("find"), "no");
  assert.equal(none.page.failed.said, word("installer.update.stopped.noteam", { slug: "upd-none" }));
  assert.ok(!none.calls.some((c) => c.method !== "GET" && c.u.startsWith(CFG.API)));
  const AI = "aik-" + "u".repeat(20);
  const w = seen(await run({ slug: "upd", mode: "update", pre: { upd: planeBase("upd") }, ai: AI }));
  assert.ok(w.calls.findIndex((c) => c.u.endsWith("/api/?op=bootstrap")) < w.calls.findIndex((c) => c.method === "PUT"), "before is read first");
  const m = w.planePuts[0].meta;
  assert.equal("migrations" in m, false);
  assert.deepEqual(m.keep_bindings.slice().sort(), ["durable_object_namespace", "secret_text"]);
  const by = Object.fromEntries(m.bindings.map((b) => [b.name, b]));
  /* K1541: the copy held no seal secret (its settings say so), so the update gives it one. */
  assert.deepEqual(Object.keys(by).sort(), ["ACCOUNT_SEAL_SECRET", "BROWSER", "CAPTURES", "DAEMON_TOKEN", "INSTANCE_AI_TOKEN", "INSTANCE_NAME", "OWN_HOSTS", "PUBLISHED", "SELF", "VERSION"]);
  assert.deepEqual([by.VERSION.text, by.INSTANCE_NAME.text, by.SELF.service, by.INSTANCE_AI_TOKEN.text], [DEFAULT_VERSION, "upd", "upd", AI]);
  assert.deepEqual(m.limits, { ...LIMITS }, "the release's limits restated (R20)");
  assert.equal(Buffer.from(by.DAEMON_TOKEN.text, "base64url").length, 32);
  const kept = Object.fromEntries(w.acct.get("upd").filter((b) => b.type === "secret_text").map((b) => [b.name, b.text]));
  assert.deepEqual([kept.ADMIN_TOKEN, kept.PROBE_TOKEN], ["admin-kept", "probe-kept"]);
  assert.ok(w.page.done.includes(h(word("installer.update.done.says", { to: DEFAULT_VERSION, from: "0.1.0" }))));
  const noR2 = seen(await run({ slug: "upd-nor2", mode: "update", pre: { "upd-nor2": planeBase("upd-nor2") }, r2: "refused" }));
  const mm = noR2.planePuts[0].meta;
  assert.ok(mm.keep_bindings.includes("r2_bucket") && !mm.bindings.some((b) => b.type === "r2_bucket"), "buckets kept, not re-bound");
  assert.equal(noR2.page.status("up"), "ok", "never refused over storage");
  const refused = seen(await run({ slug: "upd-ref", mode: "update", pre: { "upd-ref": planeBase("upd-ref") }, refuseUpdate: true }));
  assert.equal(refused.page.failed.said, word("installer.update.stopped", { version: "0.1.0" }));
  assert.ok(refused.page.failed.d.startsWith(headOf("installer.cfsaid")), "Cloudflare's own words follow");
  assert.deepEqual(refused.acct.get("upd-ref"), planeBase("upd-ref"));
  armWith(SIGNER.line);
  const fl = seen(await run({ slug: "upd-fleet", mode: "update", pre: { "upd-fleet": planeBase("upd-fleet") }, rel: await release({ version: NEXT }) }));
  /* R64: a plane naming neither scheme, in an account holding no fixed-name part, is updated under per-slug names. */
  for (const member of MEMBERS) assert.ok(fl.acct.has(`${member}-upd-fleet`), member);
  assert.deepEqual(fl.planePuts.at(-1).bindings.filter((b) => BINDINGS.includes(b.name)).length, BINDINGS.length);
  assert.equal(fl.page.status("verify"), "ok");
  assert.ok(fl.page.done.includes(h(word("installer.update.done.allanswer", { version: NEXT }))));
  restoreSigners();
  const same = seen(await run({ slug: "upd-same", mode: "update", pre: { "upd-same": planeBase("upd-same", DEFAULT_VERSION) } }));
  assert.equal(same.page.label("up") ?? same.page.events.find((e) => e.id === "up").label, word("installer.step.same", { version: DEFAULT_VERSION }));
  assert.ok(same.page.done.includes(h(word("installer.update.noop.head", { running: word("installer.update.running", { version: DEFAULT_VERSION }), version: DEFAULT_VERSION }))));
  assert.ok(!/<b>Updated (from|to)/.test(same.page.done));
});

test("R18 an update of a copy that records no producing team tells it (what the copy refuses until it is recorded, and that running the installer again records it), conditional when the version before is unknown or the copy did not answer; nothing is said of a copy that records one; the update never performs the act", async () => {
  const groupCalls = (w) => w.calls.filter((c) => /op=instancegroup/.test(c.u));
  const told = (w) => w.page.done.includes(h(word("installer.team.unrecorded.head")));
  const first = "0.71.0";
  const cross = seen(await run({ slug: "cross", mode: "update", pre: { cross: planeBase("cross", "0.70.0") }, group: null }));
  assert.ok(told(cross));
  assert.ok(cross.page.done.includes(h(word("installer.team.unrecorded.certain", { before: "0.70.0", first }))), "it says which release the copy ran before");
  assert.ok(cross.page.done.includes(h(word("installer.team.unrecorded.effect"))), "what the copy refuses until it is recorded");
  assert.ok(cross.page.done.includes(h(word("installer.team.unrecorded.how"))), "run the installer again");
  assert.ok(cross.page.done.includes(h(word("installer.team.unrecorded.suggest", { slug: "cross" }))), "the installed name is a suggestion only");
  /* No page sends the administrator to a request or a screen for the act (K3868, DEC-336 (1)). */
  assert.ok(!cross.page.done.includes("instancegroupseed") && !cross.page.done.includes("Authorization"), "no request is told");
  const fog = seen(await run({ slug: "fog", mode: "update", pre: { fog: planeBase("fog", "0.70.0") }, copy: { before: null }, group: null }));
  assert.ok(told(fog));
  assert.ok(fog.page.done.includes(h(word("installer.team.unrecorded.unknown", { first }))), "conditional when the version before is unknown");
  const silent = seen(await run({ slug: "silent", mode: "update", pre: { silent: planeBase("silent", "0.80.0") }, group: "silent" }));
  assert.ok(told(silent), "a copy that did not answer the read is told, conditionally");
  assert.ok(silent.page.done.includes(h(word("installer.team.unrecorded.unknown", { first }))));
  const past = seen(await run({ slug: "past", mode: "update", pre: { past: planeBase("past", "0.71.0") } }));
  assert.ok(!told(past), "a copy that records its team is told nothing");
  const same = seen(await run({ slug: "same", mode: "update", pre: { same: planeBase("same", DEFAULT_VERSION) } }));
  assert.ok(!told(same), "a copy that records its team is told nothing, a no-op included");
  for (const w of [cross, fog, silent, past, same]) {
    assert.deepEqual(w.seeds, [], "an update never seeds");
    assert.ok(groupCalls(w).every((c) => !c.init?.headers?.authorization), "the update holds no credential to read it with");
  }
});

/* ------------------------------------------------------------------------------------------------ custody and the release */

test("R19 the Cloudflare token and every credential appear in no page, log or error text but R16's panel; text from the management API is escaped", async () => {
  const logs = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...a) => logs.push(a.join(" "));
  const hostile = [{ id: "A1", name: `</script><script>window.pwned=1</script><img src=x onerror=alert(1)>` }];
  let w;
  try { w = seen(await run({ slug: "custody", accounts: hostile, ai: "aik-" + "h".repeat(20) })); }
  finally { Object.assign(console, orig); }
  const s = secretsOf(w.planePuts[0]);
  const shown = new Set(["ADMIN_TOKEN", "PROBE_TOKEN"]);
  const outsidePanel = w.raw.replace(/<script>done\([\s\S]*?\)<\/script>/, "");
  for (const b of s) {
    assert.equal(outsidePanel.includes(b.text), false, `${b.name} outside the panel`);
    if (!shown.has(b.name)) assert.equal(w.raw.includes(b.text), false, b.name);
  }
  assert.equal(w.raw.includes(TOK), false);
  assert.equal(logs.some((l) => l.includes(TOK) || s.some((b) => l.includes(b.text))), false);
  assert.equal((w.raw.match(/<\/script>/g) || []).length, (w.raw.match(/<script>/g) || []).length, "no script element closed early");
  assert.ok(!/<img src=x/.test(w.raw), "no markup from the account's name reaches the page");
  assert.equal(w.page.label("acct"), word("installer.account.using", { account: hostile[0].name }), "it arrives as text");
  const bad = seen(await run({ slug: "custody-refused", refuseAllPlane: true }));
  assert.ok(!bad.raw.includes("<b>by the fake</b>"), "an API error's markup is escaped");
  assert.match(bad.page.failed.said, /<b>by the fake<\/b>/);
  const plain = await (await req("/callback?error=x&error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E")).text();
  assert.ok(!plain.includes("<script>alert(1)") && plain.includes("&lt;script&gt;"));
});

test("R20 the plane's limits are read from the signed release R8 chose and sent exactly, on install and update; a release stating none or unreadably is passed over by name, and with a built-in stating none the act is refused before anything is created; the fleet statement is unchanged", async () => {
  const plane = (stmt, q = '"') => `export default { fetch(){ return Response.json({ storeVersion: 'x', memberVersions: {} }); } }; export class Store {}; export const S = ${q}${stmt}${q}; export const C = "${CRONS_STATEMENT}";`;
  const limitsOf = (w) => w.planePuts.map((p) => p.meta.limits);
  armWith(SIGNER.line);
  /* Exactly the release's statement, whatever it says, in any quote style a bundler prints: the installer has no value of its own. */
  for (const [stmt, q, want] of [[LIMITS_STATEMENT, '"', LIMITS], ["bio-plane-limits/1 cpu_ms=30000 subrequests=500", "'", { cpu_ms: 30000, subrequests: 500 }],
      ["bio-plane-limits/1 subrequests=7", "`", { subrequests: 7 }]]) {
    const rel = await release({ version: NEXT, src: plane(stmt, q) + ` const again = "${stmt}";` });
    const i = seen(await run({ slug: "lim-install", rel }));
    assert.equal(i.planePuts.length, 2, "the install PUT and its step-3 re-PUT");
    assert.deepEqual(limitsOf(i), [want, want], stmt);
    const u = seen(await run({ slug: "lim-update", mode: "update", pre: { "lim-update": planeBase("lim-update") }, rel }));
    assert.ok(u.planePuts.length >= 1);
    assert.ok(limitsOf(u).every((l) => JSON.stringify(l) === JSON.stringify(want)), stmt);
  }
  /* A verified release stating none, or stating them unreadably, is not used, and the page names why as R8 names a failed one. */
  const bad = [[UNSTATED_SRC, "installer.release.nolimits"],
    [plane("bio-plane-limits/1 subrequests=10000") + ' const b = "bio-plane-limits/1 subrequests=500";', "installer.release.badlimits"],
    [plane("bio-plane-limits/1 subrequests=10000 cpu_ms=5"), "installer.release.badlimits"],
    [plane("bio-plane-limits/1 subrequests=0"), "installer.release.badlimits"], [plane("bio-plane-limits/1 subrequests=ten"), "installer.release.badlimits"],
    [plane("bio-plane-limits/1 subrequests=1 subrequests=2"), "installer.release.badlimits"]];
  for (const [src, key] of bad) {
    const rel = await release({ version: NEXT, src });
    const w = seen(await run({ slug: "lim-bad", rel }));
    assert.equal(w.page.label("rel").slice(0, word(key, { version: NEXT, builtin: RELEASE_VERSION }).length), word(key, { version: NEXT, builtin: RELEASE_VERSION }));
    assert.ok(w.planePuts.every((p) => p.source !== src), "never installed");
    if (BUILTIN_LIMITS.ok) {
      assert.ok(w.planePuts.length > 0 && w.planePuts.every((p) => p.source === RELEASE_SOURCE), "the built-in stands in");
      assert.deepEqual(limitsOf(w)[0], { ...BUILTIN_LIMITS.limits });
    } else {
      /* This tree's built-in states none either: the install is refused by name, and nothing exists afterwards. */
      assert.equal(w.page.status("rel"), "no");
      assert.ok(stoppedWith(w, "installer.install.stopped.nolimits", { refusal: "" }));
      assert.ok(w.page.failed.said.includes(word(BUILTIN_LIMITS.why === "none" ? "installer.release.refused.none" : "installer.release.refused.unreadable", { builtin: RELEASE_VERSION })));
      assert.deepEqual([[...w.acct.keys()], [...w.buckets]], [[], []], "no script, no bucket, no probe");
      assert.ok(!w.page.done);
      const u = seen(await run({ slug: "lim-upd", mode: "update", pre: { "lim-upd": planeBase("lim-upd") }, rel }));
      assert.ok(u.page.failed.said.startsWith(headOf(BUILTIN_LIMITS.why === "none" ? "installer.update.stopped.nolimits" : "installer.update.stopped.badlimits", { version: NEXT }).slice(0, 20)));
      assert.deepEqual(u.acct.get("lim-upd"), planeBase("lim-upd"), "the copy as it was");
      assert.equal(u.planePuts.length, 0);
    }
  }
  /* The plane this tree builds states its limits as this reads them (control-plane's statement, K737), equal to
     `bio-plane/wrangler.jsonc`'s `limits`: built here by the bundler's own recipe, the bytes a release would sign. */
  const { buildMember, planeMember } = await import("../../bio-plane/scripts/fleet-bundle.mjs");
  const built = await buildMember(planeMember(), { write: false });
  const cfgText = readFileSync(new URL("../../bio-plane/wrangler.jsonc", import.meta.url), "utf8");
  const cfgLimits = JSON.parse(cfgText.match(/"limits":\s*(\{[^}]*\})/)[1]);
  assert.deepEqual(planeLimits(new TextDecoder().decode(built.bytes)), { ok: true, limits: cfgLimits });
  /* Nothing is added to the fleet statement: the limits ride in the plane bytes, so the /2 statement an older installer
     rebuilds from the manifest is the one signed, and the fleet installs. */
  const rel = await release({ version: NEXT });
  const keys = Object.keys(rel.manifest).sort();
  assert.deepEqual(keys, ["asset", "bytes", "fleet", "fleetSig", "sha256", "sig", "version"]);
  const w = seen(await run({ slug: "lim-fleet", rel }));
  assert.ok(w.page.label("fleet").startsWith(headOf("installer.fleet.done.other", { n: MEMBERS.length })));
  restoreSigners();
});
test("R21 the install offers the held non-test jurisdiction profiles by name and coverage, none preselected, and binds the chosen ids as JURISDICTION_PROFILES; choosing none is allowed and said; an update never changes them", async () => {
  /* The offer: every held profile but the test ones, each by name and coverage, none checked; and what none means. */
  const held = jurisdictions.list();
  const offered = held.filter((p) => !p.test);
  assert.ok(offered.length > 0 && held.some((p) => p.test), "both kinds are held, so the filter is exercised");
  assert.deepEqual(PROFILE_CHOICES.map((p) => [p.id, p.name, [...p.covers]]), offered.map((p) => [p.id, p.name, p.covers]));
  const home = await text("/"), upd = await text(UPDATE_PATH);
  const boxes = [...home.matchAll(/<input type="checkbox" name="profile" value="([^"]*)"([^>]*)>/g)];
  assert.deepEqual(boxes.map((m) => m[1]), offered.map((p) => p.id));
  assert.ok(boxes.every((m) => !/checked/.test(m[2])), "none preselected");
  for (const p of offered) {
    assert.ok(home.includes(`<span class="pname">${p.name}</span>`), p.id);
    assert.ok(home.includes(`<span class="small pcovers">covers ${p.covers.join(", ")}</span>`), p.id);
  }
  for (const p of held.filter((x) => x.test)) assert.ok(!home.includes(p.id) && !home.includes(p.name), `${p.id} not offered`);
  /* R72: the line saying what none means is the design's key (`screen.install.places.none`), read by key, not copied. */
  assert.equal(PROFILES_NONE, word("screen.install.places.none"));
  assert.ok(home.includes(PROFILES_NONE) && /none/i.test(PROFILES_NONE), "choosing none is allowed and said");
  assert.ok(!upd.includes('type="checkbox" name="profile"'), "an update offers no choice");
  assert.ok(home.includes("profiles:chosen"), "the install page sends the choice");
  /* /begin refuses, by name, what it cannot bind: a profile not offered (unknown, or a test profile), a repeat, not a
     list, and any choice on an update. */
  const ids = offered.map((p) => p.id);
  const testId = held.find((p) => p.test).id;
  for (const [profiles, mode, says] of [[["no-such-profile"], "install", /Not a jurisdiction profile this installer offers: "no-such-profile"/],
      [[testId], "install", new RegExp(`Not a jurisdiction profile this installer offers: "${testId}"`)],
      [[ids[0], ids[0]], "install", /chosen twice/], [ids[0], "install", /must be a list/], [[7], "install", /offers: 7/],
      [ids, "update", /An update never changes which jurisdiction profiles/]]) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "prof-refused", mode, profiles, version: NEXT }) });
    const j = await r.json();
    assert.deepEqual([r.status, j.ok], [400, false], JSON.stringify(profiles));
    assert.match(j.error, says);
    assert.equal(r.headers.get("set-cookie"), null);
  }
  /* The binding: the chosen ids, in the order given, on the install's plane uploads, the step-3 re-upload included,
     so the copy holds it at its first boot. */
  const chosen = await begin("prof-chosen", "install", { profiles: ids });
  assert.equal(chosen.j.ok, true);
  assert.deepEqual(cookieValue(chosen.cookie).p, ids);
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const w = seen(await run({ slug: "prof-chosen", rel, cookie: chosen.cookie, state: chosen.state }));
  restoreSigners();
  assert.equal(w.planePuts.length, 2, "the install PUT and its step-3 re-PUT");
  for (const put of w.planePuts) assert.deepEqual(bindingOf(put, "JURISDICTION_PROFILES"), { type: "plain_text", name: "JURISDICTION_PROFILES", text: ids.join(",") });
  assert.equal(w.acct.get("prof-chosen").filter((b) => b.name === "JURISDICTION_PROFILES").length, 1, "the copy holds it after the act");
  /* None chosen (an empty list, or none sent) binds nothing, and the install proceeds. */
  for (const extra of [{ profiles: [] }, {}]) {
    const b = await begin("prof-none", "install", extra);
    assert.equal(b.j.ok, true);
    const n = seen(await run({ slug: "prof-none", cookie: b.cookie, state: b.state }));
    assert.ok(n.page.done, "the install proceeds");
    for (const put of n.planePuts) assert.equal(bindingOf(put, "JURISDICTION_PROFILES"), null);
  }
  /* An update never sends it, whatever the copy holds. */
  const held0 = [...planeBase("prof-upd"), { type: "plain_text", name: "JURISDICTION_PROFILES", text: ids.join(",") }];
  armWith(SIGNER.line);
  const u = seen(await run({ slug: "prof-upd", mode: "update", pre: { "prof-upd": held0 }, rel: await release({ version: NEXT }) }));
  restoreSigners();
  assert.ok(u.planePuts.length >= 1);
  for (const put of u.planePuts) assert.equal((put.meta.bindings || []).some((b) => b.name === "JURISDICTION_PROFILES"), false);
});

test("R22 every page names Civicsmith and the installing group, by its chosen name once chosen, and never the old name; Believe in Oakland is named on no page (K262), the installer's own address staying where it runs; its pages say it is run by the publisher of Civicsmith releases; the example name is not a place", async () => {
  const before = { "/": await text("/"), "/update": await text(UPDATE_PATH), "404": await text("/nowhere"), invitation: INVITATION };
  assert.equal(PUBLISHER, word("installer.publisher"));
  for (const [where, page] of Object.entries(before)) {
    assert.match(page, /Civicsmith/, where);
    assert.match(page, /your team/i, `${where} speaks to the team`);
    assert.ok(page.includes(h(word("installer.publisher"))), `${where} says the publisher runs it`);
  }
  assert.ok(before["/"].includes(`<title>${h(word("screen.install.name"))}</title>`));
  assert.ok(before["/update"].includes(`<title>${h(word("installer.update.page.title"))}</title>`));
  assert.ok(before.invitation.includes(`<title>${word("installer.invite.title")}</title>`));
  assert.ok(before.invitation.includes('href="https://newgroup.believeinoakland.workers.dev/"'), "the address stays where it runs");
  for (const path of ["/", "/update"]) assert.ok(before[path].includes(`placeholder="${EXAMPLE_SLUG}"`), path);
  const places = jurisdictions.list().flatMap((p) => p.covers).flatMap((c) => c.toLowerCase().split(/\W+/)).filter((x) => x.length > 2);
  assert.ok(places.length > 0, "the held profiles name places to compare with");
  assert.deepEqual(EXAMPLE_SLUG.split("-").filter((w) => places.includes(w)), [], "the example is not a place");
  const named = seen(await run({ slug: "river-keepers" }));
  const upd = seen(await run({ slug: "river-keepers", mode: "update", pre: { "river-keepers": planeBase("river-keepers", "0.70.0") } }));
  for (const w of [named, upd]) {
    assert.match(w.raw, /<span class="ng-word">Civicsmith<\/span> <span class="eyebrow">installer<\/span>/);
    assert.ok(w.raw.includes('<b class="mono" id="group">river-keepers</b>'), "the page names the team by the name it chose");
    assert.ok(w.raw.includes(PUBLISHER));
  }
  const { cookie } = await begin("river-keepers");
  const denied = seen(await callback("error=access_denied", cookie));
  assert.match(denied.raw, /Civicsmith/);
  assert.ok(denied.raw.includes('<b class="mono" id="group">river-keepers</b>'));
  /* Over every page rendered anywhere in this suite (K262): no page names a third party, and none the product's old name
     (DEC-124). The publisher is said to run the installer without being named, and the only trace of its name is the
     installer's own address, which stays. */
  for (const page of [...PAGES, ...Object.values(before)].map(withoutChoices)) {
    assert.match(page, /Civicsmith/, page.slice(0, 120));
    assert.equal(/civic ?os\b/i.test(page), false, page.match(/.{0,60}civic ?os\b.{0,40}/i)?.[0]);
    const rest = page.replace(/newgroup\.believeinoakland\.workers\.dev/g, "");
    assert.equal(/believe in oakland|oakland|biosmoke/i.test(rest), false, rest.match(/.{0,60}(oakland|biosmoke).{0,40}/i)?.[0]);
  }
});

test("R23 the install and invitation pages state the prerequisites the install enforces: Workers Paid and a payment method, and for the assistant through a member's own subscription the Containers permission; and never that no card is needed or storage is optional", async () => {
  const home = await text("/");
  /* The install page's block states the plan, the payment method, the containers and the assistant's own prerequisite (R57: not
     the containers) by the design's keys; the invitation page by the invitation's. */
  for (const key of ["screen.install.need.cloudflare", "screen.install.cf.containers", "installer.assistant.needs", "installer.need.cloudflare.check"])
    assert.ok(home.includes(h(word(key))), `the install page says ${key}`);
  for (const key of ["installer.invite.needs.plan", "installer.invite.needs.payment", "installer.invite.needs.containers", "installer.invite.needs.assistant"])
    assert.ok(words(INVITATION).includes(word(key)), `the invitation page says ${key}`);
  const free = seen(await run({ slug: "pre-free", plan: "free" }));
  assert.equal(free.page.failed.said, word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"), "the plan refusal says why Workers Paid is needed");
  assert.ok(!free.page.failed.said.includes(headOf("installer.install.stopped.storage").slice(0, 20)), "the plan refusal claims no card it has not seen");
});

test.todo("R24 an install never shares another copy's buckets and never overwrites its fleet workers in the same account (not yet met: MULTI-INSTANCE-ISOLATION, K102; the buckets and the members have fixed names)");

test("R17 (K1541) an update gives a copy that holds no seal secret a fresh one, keeps one it holds unrestated, and refuses the whole update, uploading nothing and saying why, when the copy's settings cannot be read", async () => {
  const none = seen(await run({ slug: "seal-none", mode: "update", pre: { "seal-none": planeBase("seal-none") } }));
  const sent = (w) => w.planePuts.flatMap((p) => (p.meta.bindings || []).filter((b) => b.name === "ACCOUNT_SEAL_SECRET"));
  assert.equal(sent(none).length, 1);
  assert.equal(Buffer.from(sent(none)[0].text, "base64url").length, 32);
  assert.equal(none.raw.includes(sent(none)[0].text), false, "never shown");
  assert.match(none.page.label("keys"), /now holds the secret that seals each member's own Claude account or API key/);
  const OLD = { type: "secret_text", name: "ACCOUNT_SEAL_SECRET", text: "seal-kept" };
  const held = seen(await run({ slug: "seal-held", mode: "update", pre: { "seal-held": [...planeBase("seal-held"), OLD] } }));
  assert.equal(sent(held).length, 0, "never restated over one held");
  assert.deepEqual(held.acct.get("seal-held").filter((b) => b.name === "ACCOUNT_SEAL_SECRET"), [OLD], "kept unchanged");
  assert.match(held.page.label("keys"), /already held the secret .* kept unchanged/);
  /* K4758, installer-steps R42: settings that cannot be read refuse the update before anything is uploaded or removed. */
  const blind = seen(await run({ slug: "seal-blind", mode: "update", pre: { "seal-blind": planeBase("seal-blind") }, settingsBlind: true }));
  assert.equal(blind.page.failed.said, word("installer.update.stopped.lookup", { said: word("installer.keys.unread") }), "refused, naming why");
  assert.equal(blind.planePuts.length, 0, "nothing uploaded");
  assert.equal(sent(blind).length, 0, "unknown is not none");
  assert.equal(blind.page.done, null);
});

/* ------------------------------------------------------------------------------------------------ the assistant and the container member */

test("R36 neither the install nor the update takes, generates, binds or shows a Claude credential, the group's API key included (set inside the group's Civicsmith by an administrator, K1755); an update removes one held before, and names a removal refused; INSTANCE_AI_TOKEN is unchanged", async () => {
  const CLAUDE = "sk-ant-oat01-" + "z".repeat(40), KEY = "sk-ant-api03-" + "k".repeat(40);
  const b = await begin("r36-install", "install", { instanceClaude: CLAUDE, groupKey: KEY, anthropicApiKey: KEY });
  assert.equal(b.j.ok, true);
  assert.ok(![CLAUDE, KEY].some((x) => JSON.stringify(cookieValue(b.cookie)).includes(x)), "the cookie keeps neither");
  const i = seen(await run({ slug: "r36-install", cookie: b.cookie, state: b.state }));
  for (const put of i.planePuts) assert.equal((put.meta.bindings || []).some((x) => /CLAUDE|ANTHROPIC|API_KEY/.test(x.name)), false);
  for (const put of i.planePuts) assert.equal((put.meta.bindings || []).some((x) => x.text === KEY || x.text === CLAUDE), false);
  assert.equal(i.raw.includes(CLAUDE) || i.raw.includes(KEY), false);
  /* The page says where each way to the assistant is set: the group's key by an administrator, a member's own by the member, both inside it. */
  assert.equal(i.page.label("assist"), word("installer.assistant.offer"), "the design's paragraph says where each way is set, and that the installer takes no key");
  /* An update of a copy holding the retired credential removes it, and says so; one holding none deletes nothing. */
  const pre = [...planeBase("r36-upd"), { type: "secret_text", name: "INSTANCE_CLAUDE_TOKEN", text: CLAUDE }];
  const u = seen(await run({ slug: "r36-upd", mode: "update", pre: { "r36-upd": pre } }));
  for (const put of u.planePuts) assert.equal((put.meta.bindings || []).some((x) => x.name === "INSTANCE_CLAUDE_TOKEN"), false, "never restated");
  assert.deepEqual(u.deleted, ["r36-upd/INSTANCE_CLAUDE_TOKEN"]);
  assert.ok(!u.raw.includes("member-kept"));
  assert.equal(u.acct.get("r36-upd").some((x) => x.name === "INSTANCE_CLAUDE_TOKEN"), false, "none left behind");
  assert.ok(u.page.label("keys").includes(word("installer.keys.retired.removed", { what: word("installer.keys.retired.claude") })));
  assert.equal(u.raw.includes(CLAUDE), false);
  const clean = seen(await run({ slug: "r36-clean", mode: "update", pre: { "r36-clean": planeBase("r36-clean") } }));
  assert.deepEqual(clean.deleted, []);
  const stuck = seen(await run({ slug: "r36-stuck", mode: "update", pre: { "r36-stuck": pre.map((x) => x.name === "SELF" ? { ...x, service: "r36-stuck" } : x) }, refuseSecretDelete: true }));
  assert.equal(stuck.page.status("keys"), "no");
  assert.ok(isWord(stuck.page.label("keys"), "installer.keys.retired.refused", { what: word("installer.keys.retired.claude"), name: "INSTANCE_CLAUDE_TOKEN" }), "it says removing it was refused and which secret to remove");
  assert.ok(!stuck.raw.includes("<i>by the fake</i>"), "the API's words are escaped");
  /* The organisation `ai` credential is untouched by R36. */
  const AI = "aik-" + "w".repeat(20);
  const ai = seen(await run({ slug: "r36-ai", ai: AI }));
  assert.deepEqual(secretsOf(ai.planePuts[0]).filter((x) => x.name === "INSTANCE_AI_TOKEN").map((x) => x.text), [AI]);
});

test("R37 the install page states the assistant is optional and that its two settings are made in your team's Civicsmith at its setup, separately, nothing preselected (whether the group pays for it with its own API key, set by an administrator; whether it keeps its material away from AI, off unless an administrator turns it on with a reason); that a member may always connect their own account, serving only them, unless the group keeps its material away; that each member is told what goes to Anthropic first; the install takes no choice and writes no ASSISTANT_ENABLED, and an update never writes one", async () => {
  const home = await text("/"), upd = await text(UPDATE_PATH);
  assert.equal(ASSISTANT_OFFER, word("installer.assistant.offer"), "the paragraph is the design's key: optional, its two settings made in your team's Civicsmith, a member's own account, what goes to Anthropic, no choice made here");
  assert.ok(home.includes(h(ASSISTANT_OFFER)), "the install page states it");
  /* No choice offered: no control of any kind about the assistant on either page. */
  for (const page of [home, upd]) assert.ok(!/name="assistant"/.test(page) && !/assistant:/.test(page), "no choice is offered or sent");
  /* /begin takes none: an `assistant` field is kept nowhere and refuses nothing. */
  for (const [mode, v] of [["install", "on"], ["install", "off"], ["update", "on"], ["install", "maybe"]]) {
    const b = await begin("as-" + mode, mode, { assistant: v, version: NEXT });
    assert.equal(b.j.ok, true, `${mode} ${v}`);
    assert.ok(!("as" in cookieValue(b.cookie)) && !JSON.stringify(cookieValue(b.cookie)).includes(`"${v}"`), "kept nowhere");
  }
  /* No upload of the install writes ASSISTANT_ENABLED, whatever /begin was sent; the page says where the settings are made. */
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const b = await begin("as-on", "install", { assistant: "on" });
  const w = seen(await run({ slug: "as-on", rel, cookie: b.cookie, state: b.state }));
  assert.ok(w.planePuts.length >= 2);
  for (const put of w.planePuts) assert.equal(bindingOf(put, "ASSISTANT_ENABLED"), null);
  assert.equal(w.page.label("assist"), word("installer.assistant.offer"));
  /* An update writes none, and leaves none behind (R17's T36 sentence). */
  const u = seen(await run({ slug: "as-upd", mode: "update", rel, pre: { "as-upd": planeBefore36("as-upd") } }));
  for (const put of u.planePuts) assert.equal(bindingOf(put, "ASSISTANT_ENABLED"), null, "an update never sends it");
  assert.equal(u.acct.get("as-upd").some((x) => x.name === "ASSISTANT_ENABLED"), false, "none left behind");
  restoreSigners();
});

test("R38 a container member installs only with the Containers scope granted, Workers Paid, and a public image pinned by digest under the default policy, through the Containers API, with its class bound into the members it names; any condition failing leaves it out, named, and the install never fails over it", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, container: true });
  /* R64: a new install names every part by its slug (the update below, of a copy under the older fixed names, keeps them). */
  const RUNNER_BINDING = (script = RUNNER) => ({ type: "durable_object_namespace", name: "RUNNER", class_name: "AgentRunner", script_name: script });
  const runnerOf = (w, slug) => (w.acct.get(slug ? `agent-worker-${slug}` : "agent-worker") || []).filter((b) => b.name === "RUNNER");
  /* All conditions hold: the Worker with its class's migration, the application with the image under `default`, and
     agent-worker bound to the class. */
  const ok = seen(await run({ slug: "box-ok", rel }));
  const put = ok.calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/" + RUNNER + "-box-ok"));
  const meta = JSON.parse(await put.init.body.get("metadata").text());
  assert.deepEqual(meta.migrations, { new_tag: "v1", new_sqlite_classes: ["AgentRunner"] });
  assert.equal(put.init.body.get("container.json"), null, "the descriptor is read, never uploaded");
  assert.deepEqual(ok.apps.map(({ id, ...a }) => a), [{ name: RUNNER + "-box-ok", scheduling_policy: "default", instances: 0,
    max_instances: DESCRIPTOR.max_instances, configuration: { image: IMAGE }, durable_objects: { namespace_id: `ns-${RUNNER}-box-ok-AgentRunner` } }]);
  assert.deepEqual(runnerOf(ok, "box-ok"), [RUNNER_BINDING(RUNNER + "-box-ok")]);
  assert.deepEqual(ok.refused, []);
  assert.ok(ok.page.label("fleet").startsWith(headOf("installer.fleet.done.other", { n: new Set([...MEMBERS, RUNNER]).size })));
  const upload = (w) => w.calls.filter((c) => c.method === "PUT" && /\/workers\/scripts\/[^/]+$/.test(c.u)).map((c) => c.u.split("/scripts/")[1]);
  assert.ok(upload(ok).indexOf(RUNNER + "-box-ok") < upload(ok).indexOf("agent-worker-box-ok"), "the container before the member bound to it");
  /* Each condition failing: left out, named, the copy serving the assistant by members' own API keys, the rest installed. */
  const leftOut = async (why, opts, says) => {
    const w = seen(await run({ slug: "box-" + why, rel, ...opts }));
    assert.equal(w.apps.length, 0, why);
    assert.equal(runnerOf(w, "box-" + why).length, 0, `${why}: agent-worker installed without RUNNER`);
    assert.ok(w.acct.has("agent-worker-box-" + why) && w.acct.has("pdf-worker-box-" + why), `${why}: the rest installed`);
    assert.match(w.page.label("fleet"), says, why);
    /* R57: the absence of agent-runner names nothing the assistant lacks. */
    assert.equal(/assistant/i.test(w.page.label("fleet")), false, why);
    assert.ok(w.page.done, `${why}: the install finished`);
    return w;
  };
  /* R84 (5): a permission without the Containers scope no longer reaches here: the install asks to approve again before its first
     call (the update still installs the rest and names the member, below). */
  /* A token response stating no scope: one read of the Containers API decides. */
  const asked = seen(await run({ slug: "box-asked", rel, grantedScope: null }));
  assert.equal(asked.apps.length, 1, "a read that answers means the scope is held");
  /* R84 (2): and an answer to that read for want of permission asks to approve again, before anything is created. */
  const unasked = seen(await run({ slug: "box-unasked", rel, grantedScope: null, containers: "read" }));
  assert.ok(unasked.page.failed.said.length > 0, "it says why");
  assert.ok(unasked.page.done.includes("data-begin"), "the page offers the approval again");
  assert.deepEqual([...unasked.buckets], []);
  for (const [why, d, says] of [
      ["unpinned", { ...DESCRIPTOR, image: "docker.io/civicos/agent-runner:latest" }, like("installer.fleet.why.unpinned")],
      ["private", { ...DESCRIPTOR, image: "registry.cloudflare.com/acct/agent-runner@sha256:" + "b".repeat(64) }, like("installer.fleet.why.unpullable")],
      ["policy", { ...DESCRIPTOR, scheduling_policy: "durable_object" }, like("installer.fleet.why.container.policy")],
      ["noclass", { ...DESCRIPTOR, class_name: "" }, like("installer.fleet.why.container.class")], ["max", { ...DESCRIPTOR, max_instances: 0 }, like("installer.fleet.why.container.size")],
      ["bind", { ...DESCRIPTOR, bind: [{ member: "agent-worker", binding: "runner" }] }, like("installer.fleet.why.container.bindings")],
      ["garbled", "{not json", like("installer.fleet.why.container.parse")]]) {
    const w = await leftOut(why, { rel: await release({ version: NEXT, container: true, descriptor: d }) }, says);
    /* R70 (F2) reads the applications once, before anything is created; nothing is written to the Containers API. */
    assert.equal(w.calls.some((c) => c.u.includes("/containers/") && c.method !== "GET"), false, `${why}: the Containers API written`);
  }
  const created = await leftOut("refused", { containers: "create" }, /\(application refused\)/);
  assert.ok(created.acct.has(RUNNER + "-box-refused"), "the Worker uploaded is named, not hidden: the class exists, unused");
  /* A part type an installer does not know leaves one member out (R11): what an older installer does with this one. */
  /* The descriptor's hash is covered by the fleet signature: bytes that differ are refused like any part. */
  const tampered = await release({ version: NEXT, container: true });
  tampered.assets[`${RUNNER}/container.json`] = JSON.stringify({ ...DESCRIPTOR, image: "docker.io/evil/x@sha256:" + "c".repeat(64) });
  await leftOut("tampered", { rel: tampered }, like("installer.fleet.why.integrity"));
  /* An update: re-consent. Without the scope, everything else updates and the container is named; a container held
     from before keeps its binding; with the scope and Paid, the application is rolled out to the image. */
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const preAll = { "box-upd": planeBase("box-upd"), ...Object.fromEntries(MEMBERS.map((m) => [m, old])), [RUNNER]: old };
  const noScope = seen(await run({ slug: "box-upd", mode: "update", rel, pre: preAll, preClasses: { [RUNNER]: ["AgentRunner"] },
    preApps: [{ id: "app9", name: RUNNER }], grantedScope: "workers-scripts.write workers-r2.write account-settings.read" }));
  assert.equal(noScope.page.status("up"), "ok");
  assert.match(noScope.page.label("fleet"), like("installer.fleet.why.nopermission"));
  assert.equal(noScope.calls.some((c) => c.u.includes("bio-plan-probe")), false, "no plan probe without the scope");
  assert.deepEqual(runnerOf(noScope), [RUNNER_BINDING()], "a container held from before keeps serving its member");
  assert.deepEqual(noScope.rollouts, []);
  const rolled = seen(await run({ slug: "box-upd", mode: "update", rel, pre: preAll, preClasses: { [RUNNER]: ["AgentRunner"] },
    preApps: [{ id: "app9", name: RUNNER }] }));
  assert.ok(rolled.calls.some((c) => c.u.includes("bio-plan-probe")), "an update establishes the plan as R6 does");
  assert.deepEqual(rolled.rollouts.map((r) => [r.id, r.target_configuration.image]), [["app9", IMAGE]]);
  const rerun = JSON.parse(await rolled.calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/" + RUNNER)).init.body.get("metadata").text());
  assert.equal("migrations" in rerun, false, "the class's migration is never restated");
  assert.deepEqual(rolled.refused, []);
  const free = seen(await run({ slug: "box-upd", mode: "update", rel, pre: preAll, preClasses: { [RUNNER]: ["AgentRunner"] }, plan: "free" }));
  assert.equal(free.page.status("up"), "ok", "an update never grows a refusal");
  assert.match(free.page.label("fleet"), like("installer.fleet.why.freeplan"));
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ T36: the retired key, the file scanner, the logs, the hosts */

const metaOf = async (w, name) => {
  const c = w.calls.filter((x) => x.method === "PUT" && x.u.endsWith("/workers/scripts/" + name)).at(-1);
  return c ? JSON.parse(await c.init.body.get("metadata").text()) : null;
};
const words = (page) => page.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ");

test("R17 (T36) the update writes no MEMBER_TOKEN and no ASSISTANT_ENABLED and leaves neither behind: a held one is deleted, a refused delete named", async () => {
  const w = seen(await run({ slug: "r17-old", mode: "update", pre: { "r17-old": planeBefore36("r17-old") } }));
  for (const put of w.planePuts) for (const name of ["MEMBER_TOKEN", "ASSISTANT_ENABLED"]) assert.equal(bindingOf(put, name), null, name);
  assert.deepEqual(w.deleted, ["r17-old/MEMBER_TOKEN"], "the secret deleted by its own act");
  const held = w.acct.get("r17-old").map((b) => b.name);
  assert.ok(!held.includes("MEMBER_TOKEN") && !held.includes("ASSISTANT_ENABLED"), "neither left behind: " + held.join(","));
  assert.ok(held.includes("ADMIN_TOKEN") && held.includes("PROBE_TOKEN"), "the other credentials kept");
  assert.ok(w.page.label("keys").includes(word("installer.keys.retired.removed", { what: word("installer.keys.retired.member") })));
  assert.ok(w.page.label("keys").includes(word("installer.keys.retired.gone", { what: word("installer.keys.retired.assistant") })));
  assert.equal(w.page.status("keys"), "ok");
  assert.ok(!w.raw.includes("member-kept"), "the held value is never shown");
  const stuck = seen(await run({ slug: "r17-stuck", mode: "update", pre: { "r17-stuck": planeBefore36("r17-stuck") }, refuseSecretDelete: true }));
  assert.equal(stuck.page.status("keys"), "no");
  assert.ok(isWord(stuck.page.label("keys"), "installer.keys.retired.refused", { what: word("installer.keys.retired.member"), name: "MEMBER_TOKEN" }));
  assert.ok(!stuck.raw.includes("<i>by the fake</i>"), "the API's words are escaped");
  /* A copy holding neither deletes nothing and says nothing of them. */
  const clean = seen(await run({ slug: "r17-clean", mode: "update", pre: { "r17-clean": planeBase("r17-clean") } }));
  assert.deepEqual(clean.deleted, []);
  assert.ok(!clean.page.label("keys").includes(word("installer.keys.retired.member")));
});

test("R23 (T36) the install and invitation pages state that the Containers permission installs the built-in file scanner and safe view, without which files are kept and shown but not scanned, and a high-risk file opens only in its safe view once one can be made", async () => {
  for (const [where, page] of [["install page", await text("/")], ["invitation page", INVITATION], ["update page", await text(UPDATE_PATH)]]) {
    const w = words(page);
    assert.match(w, /containers/i, where);
    assert.match(w, /built-in file scanner and (the )?safe view/, where);
    assert.match(w, /files are kept and shown but not scanned/, where);
    assert.match(w, /a high-risk file/, where);
  }
  /* The install page's sentence is the design's key. */
  assert.ok((await text("/")).includes(word("screen.install.cf.containers").replace(/'/g, "&#39;")));
});

test("R38 (T36) a container member with two or more classes (file-scanner) is described by each `Container` part (`container/<class_name>.json`), each class installed with its own image pinned by digest and verified as a part; its classes bound into the member itself; a part missing, misnamed or unreadable leaves the member out, named with what the copy then lacks", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, scanner: true });
  const ok = seen(await run({ slug: "two-ok", rel }));
  const meta = await metaOf(ok, SCANNER + "-two-ok");
  assert.deepEqual(meta.migrations, { new_tag: "v1", new_sqlite_classes: ["FileScanner", "SafeViewRenderer"] });
  const put = ok.calls.filter((c) => c.method === "PUT" && c.u.endsWith("/scripts/" + SCANNER + "-two-ok")).at(-1);
  for (const c of SCANNER_CLASSES) assert.equal(put.init.body.get(`container/${c.class_name}.json`), null, "a descriptor is read, never uploaded");
  assert.equal(put.init.body.get("worker.json"), null);
  /* Each class bound into the member itself, by the binding its descriptor names, with no script name (its own). */
  assert.deepEqual(meta.bindings.filter((b) => b.type === "durable_object_namespace"),
    [{ type: "durable_object_namespace", name: "SCANNER", class_name: "FileScanner" }, { type: "durable_object_namespace", name: "RENDERER", class_name: "SafeViewRenderer" }]);
  /* One application per class, each with its own image, for its own class's namespace. */
  assert.deepEqual(ok.apps.map(({ id, ...a }) => a).sort((a, b) => a.name < b.name ? -1 : 1), [
    { name: "file-scanner-filescanner-two-ok", scheduling_policy: "default", instances: 0, max_instances: 3, configuration: { image: SCAN_IMAGE }, durable_objects: { namespace_id: "ns-file-scanner-two-ok-FileScanner" } },
    { name: "file-scanner-safeviewrenderer-two-ok", scheduling_policy: "default", instances: 0, max_instances: 3, configuration: { image: RENDER_IMAGE }, durable_objects: { namespace_id: "ns-file-scanner-two-ok-SafeViewRenderer" } }]);
  assert.deepEqual(ok.refused, []);
  assert.ok(ok.page.label("fleet").startsWith(headOf("installer.fleet.done.other", { n: 6 })) && ok.page.label("fleet").includes("file-scanner"));
  /* A one-class member is described as before (agent-runner, R38's own test), beside it. */
  const both = seen(await run({ slug: "two-both", rel: await release({ version: NEXT, scanner: true, container: true }) }));
  assert.equal(both.apps.length, 3);
  assert.ok(both.apps.some((a) => a.name === RUNNER + "-two-both"));
  /* Left out, each with why and what the copy then lacks; every other member installs; the install finishes. */
  const LACKS = like("installer.image.lacks.scanner");
  const out = async (why, relOpts, says, runOpts = {}, mutate = null) => {
    const r = await release({ version: NEXT, scanner: true, ...relOpts });
    if (mutate) mutate(r);
    const w = seen(await run({ slug: "two-" + why, rel: r, ...runOpts }));
    assert.equal(w.apps.length, 0, why);
    assert.match(w.page.label("fleet"), says, why);
    assert.match(w.page.label("fleet"), LACKS, why);
    assert.ok(w.acct.has("pdf-worker-two-" + why) && w.page.done, `${why}: the rest installed, the install finished`);
    return w;
  };
  await out("missing", {}, like("installer.fleet.why.http", { status: 404 }), {}, (r) => { delete r.assets[`${SCANNER}/container/SafeViewRenderer.json`]; });
  await out("tampered", {}, like("installer.fleet.why.integrity"), {},
    (r) => { r.assets[`${SCANNER}/container/FileScanner.json`] = JSON.stringify({ ...SCANNER_CLASSES[0], image: "docker.io/evil/x@sha256:" + "f".repeat(64) }); });
  await out("misnamed", { scannerParts: { "container/SafeViewRenderer.json": null, "container/Renderer.json": SCANNER_CLASSES[1] } }, like("installer.fleet.why.container.path"));
  await out("unpathed", { scannerParts: { "container/SafeViewRenderer.json": null, "renderer.json": SCANNER_CLASSES[1] } }, like("installer.fleet.why.container.path"));
  await out("ghcr", { scannerParts: { "container/SafeViewRenderer.json": { ...SCANNER_CLASSES[1], image: "ghcr.io/believeinoakland/file-scanner-renderer@sha256:" + "e".repeat(64) } } },
    like("installer.fleet.why.unpullable"));
  /* An update rolls each class's application out to its own image. */
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  const up = seen(await run({ slug: "two-upd", mode: "update", rel, pre: { "two-upd": planeBase("two-upd"), [SCANNER]: old },
    preClasses: { [SCANNER]: ["FileScanner", "SafeViewRenderer"] },
    preApps: [{ id: "appS", name: "file-scanner-filescanner" }, { id: "appR", name: "file-scanner-safeviewrenderer" }] }));
  assert.deepEqual(up.rollouts.map((r) => [r.id, r.target_configuration.image]).sort(), [["appR", RENDER_IMAGE], ["appS", SCAN_IMAGE]]);
  assert.equal("migrations" in await metaOf(up, SCANNER), false, "the classes' migration is never restated");
  assert.deepEqual(up.refused, []);
  restoreSigners();
});

/* T46 (N897 (4)): no public registry yet; GitHub's registry is one the default scheduling policy cannot pull from. */
const GHCR = (name, c) => `ghcr.io/believeinoakland/${name}@sha256:${c.repeat(64)}`;

test("R38 (T46) a container member left out because its image is not in a registry your Cloudflare account can pull is named with \"this release's image is not yet published where your Cloudflare account can pull it\" beside what your team's Civicsmith then lacks, never \"not a public registry image\"; every other member installs, on the install and the update; control: images pinned by digest on Docker Hub install", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, container: true, descriptor: { ...DESCRIPTOR, image: GHCR("agent-runner", "a") }, scanner: true,
    scannerParts: { "container/FileScanner.json": { ...SCANNER_CLASSES[0], image: GHCR("file-scanner-scanner", "d") },
      "container/SafeViewRenderer.json": { ...SCANNER_CLASSES[1], image: GHCR("file-scanner-renderer", "e") } } });
  for (const [mode, pre] of [["install", {}], ["update", { "r38-ghcr": planeBase("r38-ghcr") }]]) {
    const w = seen(await run({ slug: "r38-ghcr", mode, rel, pre }));
    const said = w.page.label("fleet");
    assert.ok(!w.acct.has(RUNNER + "-r38-ghcr") && !w.acct.has(SCANNER + "-r38-ghcr"), `${mode}: neither container member installed`);
    assert.equal(w.calls.some((c) => c.u.includes("/containers/") && c.method !== "GET"), false, `${mode}: the Containers API written`);
    for (const m of MEMBERS.filter((x) => x !== RUNNER && x !== SCANNER)) assert.ok(w.acct.has(`${m}-r38-ghcr`), `${mode}: ${m} installs`);
    /* R57: agent-runner is named with its reason and nothing the assistant lacks. */
    assert.match(said, like("installer.fleet.why.unpullable"), mode);
    assert.match(said, like("installer.fleet.why.unpullable"), mode);
    assert.match(said, like("installer.image.lacks.scanner"), mode);
    assert.equal(/public registry/i.test(w.page.words), false, mode);
    assert.ok(w.page.done, `${mode}: the act finished`);
    if (mode === "update") assert.equal(w.page.status("up"), "ok");
  }
  /* The control: the same release with Docker Hub images pinned by digest installs both. */
  const pulled = seen(await run({ slug: "r38-pulled", rel: await release({ version: NEXT, container: true, scanner: true }) }));
  assert.equal(pulled.apps.length, 3);
  assert.ok(pulled.acct.has(RUNNER + "-r38-pulled") && pulled.acct.has(SCANNER + "-r38-pulled"));
  assert.doesNotMatch(pulled.page.words, like("installer.image.unpullable", { part: /\S+/ }));
  restoreSigners();
});

test("R23 (T46) when the release this installer carries names, for a container member, an image your Cloudflare account cannot pull, the install and update pages say so before the install begins, per member, with what your team's Civicsmith then lacks (R38's words); control: images it can pull are not named", async () => {
  const both = [{ member: RUNNER, class_name: "AgentRunner", image: GHCR("agent-runner", "a") },
    { member: SCANNER, class_name: "FileScanner", image: GHCR("file-scanner-scanner", "d") },
    { member: SCANNER, class_name: "SafeViewRenderer", image: GHCR("file-scanner-renderer", "e") }];
  const n = leftOutNotice(both, "9.9.9");
  const w = words(n);
  /* R57: the assistant does not run in a container, so agent-runner's absence names nothing the assistant lacks and is not listed. */
  assert.equal((n.match(/<li\b/g) || []).length, 1, "one line per member that lacks something, a member of two classes once");
  assert.equal(/agent-runner|assistant/i.test(w), false, "the assistant is tied to no container");
  assert.ok(w.includes(word("installer.image.notice.item", { provides: word("installer.image.provides.scanner"), part: SCANNER,
    why: word("installer.image.unpullable", { part: SCANNER }), lacks: word("installer.image.lacks.scanner") })), "what it provides, why it is left out, and what the copy lacks");
  assert.ok(w.includes(word("installer.image.notice.head", { version: "9.9.9" })));
  assert.ok(w.includes(word("installer.image.notice.foot")));
  assert.equal(/public registry/i.test(w), false);
  /* A member with one class it can pull and one it cannot still cannot install whole: it is named. */
  assert.deepEqual(partsLeftOut([{ ...both[1], image: SCAN_IMAGE }, both[2]]).map((p) => p.member), [SCANNER]);
  /* The control: images pinned by digest on Docker Hub, or none at all, say nothing. */
  assert.equal(leftOutNotice([{ member: RUNNER, class_name: "AgentRunner", image: IMAGE }, { member: SCANNER, class_name: "FileScanner", image: SCAN_IMAGE },
    { member: SCANNER, class_name: "SafeViewRenderer", image: RENDER_IMAGE }], "9.9.9"), "");
  assert.equal(leftOutNotice([], "9.9.9"), "");
  /* The pages: the statement for the release this installer carries (its signed fleet's classes, recorded by the embed),
     before the act that begins the install, on the install page and the update page alike. */
  assert.equal(LEFT_OUT, leftOutNotice(RELEASE_CONTAINERS, RELEASE_VERSION));
  for (const [where, page] of [["install page", seen(await text("/"))], ["update page", seen(await text(UPDATE_PATH))]]) {
    const named = partsLeftOut(RELEASE_CONTAINERS).map((p) => p.member);
    for (const m of named) {
      const at = page.indexOf(`id="left-out-${m}"`);
      assert.ok(at > 0 && at < page.indexOf('<button id="go"'), `${where}: ${m}, before the install begins`);
    }
    if (!named.length) assert.equal(page.includes('id="left-out"'), false, where);
  }
  /* The release this tree carries names its container images where an account can pull them (Docker Hub, by digest; N1242, K3805),
     so the pages name no part left out; a release that names GitHub's registry for both container members (draft-T46-trial §3.3)
     has the pages name those whose absence lacks something (R57: not agent-runner). */
  if (RELEASE_CONTAINERS.length && RELEASE_CONTAINERS.every((c) => c.image.startsWith("ghcr.io/")))
    assert.deepEqual(partsLeftOut(RELEASE_CONTAINERS).map((p) => p.member).sort(), [...new Set(RELEASE_CONTAINERS.map((c) => c.member))].filter((m) => m !== RUNNER).sort());
  else if (RELEASE_CONTAINERS.length && RELEASE_CONTAINERS.every((c) => c.image.startsWith("docker.io/")))
    assert.deepEqual(partsLeftOut(RELEASE_CONTAINERS), [], "a release on Docker Hub, pinned by digest, leaves nothing out");
});

test("R23 (T46) the embed records the container classes the release's signed fleet statement names (member, class, image), only from a fleet that verifies against the installer's keys and parts whose bytes it signs; a release naming no signed fleet names none; the shipped embed is the release's own", async () => {
  const rel = await release({ version: "1.2.3", container: true, scanner: true });
  const readPart = (member, path) => { const t = rel.assets[`${member}/${path}`]; if (t === undefined) throw new Error("missing"); return Buffer.from(t); };
  assert.deepEqual(await releaseContainers({ manifest: rel.manifest, readPart, signers: [SIGNER.line] }),
    [{ member: RUNNER, class_name: "AgentRunner", image: IMAGE },
     ...SCANNER_CLASSES.map((c) => ({ member: SCANNER, class_name: c.class_name, image: c.image }))]);
  assert.deepEqual(await releaseContainers({ manifest: { ...rel.manifest, fleet: undefined }, readPart, signers: [SIGNER.line] }), []);
  assert.deepEqual(await releaseContainers({ manifest: { ...rel.manifest, fleetSig: undefined }, readPart, signers: [SIGNER.line] }), []);
  await assert.rejects(releaseContainers({ manifest: rel.manifest, readPart, signers: [STRANGER.line] }), /fleet signature does not verify .*UNKNOWN_KEY/);
  await assert.rejects(releaseContainers({ manifest: rel.manifest, signers: [SIGNER.line],
    readPart: (m, p) => p === "container.json" ? Buffer.from(JSON.stringify({ ...DESCRIPTOR, image: GHCR("x", "f") })) : readPart(m, p) }), /agent-runner\/container\.json is not the part the fleet statement signs/);
  await assert.rejects(releaseContainers({ manifest: rel.manifest, signers: [SIGNER.line],
    readPart: (m, p) => { if (p === "container/FileScanner.json") throw new Error("gone"); return readPart(m, p); } }), /is missing/);
  /* The shipped embed: exactly what the release in release/ signs, read again from its files. */
  const root = new URL("../../release/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("RELEASE.json", root), "utf8"));
  restoreSigners();
  assert.deepEqual(RELEASE_CONTAINERS, await releaseContainers({ manifest, readPart: (m, p) => readFileSync(new URL(`${m}/${p}`, root)) }));
  assert.ok(Object.isFrozen(RELEASE_CONTAINERS) && RELEASE_CONTAINERS.every(Object.isFrozen));
});

test("R43 the installer verifies against exactly the armed public lines, the fresh release key and the offline recovery key: a release or fleet statement signed by either installs, one signed by any other key (the development key included) is not installed and is named so; the embed step checks against the same lines", async () => {
  /* A pair made in the test stands for the two lines Bob's signer-page sitting makes (no key is entered by this job). */
  const RELEASE_KEY = await signer("bio-release"), RECOVERY_KEY = await signer("bio-release-recovery"), DEV = await signer("bio-release-dev");
  armWith(RELEASE_KEY.line, RECOVERY_KEY.line);
  for (const [who, k] of [["release key", RELEASE_KEY], ["recovery key", RECOVERY_KEY]]) {
    const rel = await release({ version: NEXT, signWith: k });
    const w = seen(await run({ slug: "keys-ok", rel }));
    w.planePuts.length && null;
    assert.equal(w.planePuts[0].source, rel.src, who);
    assert.match(w.page.label("fleet"), like("installer.fleet.done.other", { n: /\d+/ }), who);
    assert.equal(await checkSignedAsset({ manifest: rel.manifest, bytes: new TextEncoder().encode(rel.src), version: NEXT, signers: [RELEASE_KEY.line, RECOVERY_KEY.line] }), null, who);
  }
  /* Signed by any other key, the development key included: not installed, and named. */
  const rel = await release({ version: NEXT, signWith: DEV });
  const w = seen(await run({ slug: "keys-dev", rel }));
  assert.ok(w.planePuts.every((p) => p.source !== rel.src), "never installed");
  assert.match(w.page.label("rel"), /not by a key this installer trusts \(UNKNOWN_KEY\)/);
  assert.match(await checkSignedAsset({ manifest: rel.manifest, bytes: new TextEncoder().encode(rel.src), version: NEXT, signers: [RELEASE_KEY.line, RECOVERY_KEY.line] }), /does not verify .*UNKNOWN_KEY/);
  /* A fleet statement signed by another key, beside a plane signed by an armed one: no member installed, named. */
  const mixed = await release({ version: NEXT, signWith: RELEASE_KEY });
  mixed.manifest.fleetSig = (await release({ version: NEXT, signWith: DEV })).manifest.fleetSig;
  const m = seen(await run({ slug: "keys-fleet", rel: mixed }));
  assert.match(m.page.label("fleet"), like("installer.fleet.skip.signature", { reason: "UNKNOWN_KEY" }));
  restoreSigners();
});

test("R44 the install and the update install file-scanner with exactly the bindings its signed statement names: the copy's CAPTURES bucket by role (from its `Worker` part), its two classes, SECURITY_VPC only as R45 says; its schedule as the part gives it; a release without that part installs it without them and the page names what it lacks; the plane is bound to it as FILE_SCANNER; a member left out is named and the install never fails", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, scanner: true });
  for (const [mode, pre] of [["install", {}], ["update", { "r44-update": planeBase("r44-update") }]]) {
    const slug = "r44-" + mode;
    const w = seen(await run({ slug, mode, rel, pre }));
    const FS = `${SCANNER}-${slug}`;                   /* R64: named for the slug */
    const meta = await metaOf(w, FS);
    assert.deepEqual(meta.bindings.map((b) => b.name).sort(), ["CAPTURES", "RENDERER", "SCANNER", "VERSION"], mode);
    /* The prefixes it writes (clamav/, reputation/) are in the copy's evidence bucket and nowhere else: its one bucket. */
    assert.deepEqual(meta.bindings.filter((b) => b.type === "r2_bucket"), [{ type: "r2_bucket", name: "CAPTURES", bucket_name: `bio-captures-${slug}` }], mode);
    assert.deepEqual(w.schedules.get(FS), ["17 4 * * *"], mode);
    assert.deepEqual([...w.schedules.keys()].sort(), [slug, FS].sort(), `${mode}: the plane's watchdog (R39) and only the member whose part states one`);
    assert.deepEqual(w.schedules.get(slug), [CRONS_STATEMENT.replace("bio-plane-crons/1 ", "")], `${mode}: the plane's own schedule, as its release states it`);
    /* The plane: bound to it as FILE_SCANNER, by instance-setup's name (R30). */
    assert.deepEqual(FLEET_BINDINGS.find(([m]) => m === SCANNER), [SCANNER, "FILE_SCANNER"], "instance-setup's name for it");
    assert.deepEqual(bindingOf(w.planePuts.at(-1), "FILE_SCANNER"), { type: "service", name: "FILE_SCANNER", service: FS }, mode);
  }
  /* The part's bucket by role: "published" names the other bucket; an unknown role or a malformed cron leaves it out, named. */
  const pub = seen(await run({ slug: "r44-pub", rel: await release({ version: NEXT, scanner: true, scannerWorker: { r2_buckets: [{ binding: "OUT", bucket: "published" }], crons: [] } }) }));
  assert.deepEqual((await metaOf(pub, SCANNER + "-r44-pub")).bindings.filter((b) => b.type === "r2_bucket"), [{ type: "r2_bucket", name: "OUT", bucket_name: "bio-published-r44-pub" }]);
  assert.equal(pub.schedules.has(SCANNER + "-r44-pub"), false, "no cron stated, none set");
  for (const [why, part, says] of [["role", { r2_buckets: [{ binding: "CAPTURES", bucket: "bio-captures" }] }, like("installer.fleet.why.program")],
      ["cron", { crons: ["every day"] }, like("installer.fleet.why.program")], ["garbled", "{nope", like("installer.fleet.why.program")]]) {
    const w = seen(await run({ slug: "r44-" + why, rel: await release({ version: NEXT, scanner: true, scannerWorker: part }) }));
    assert.ok(!w.acct.has(`${SCANNER}-r44-${why}`), why);
    assert.match(w.page.label("fleet"), says, why);
    assert.ok(w.page.done, why);
  }
  /* A release without the part (bundler's N772 not yet in it): installed without bucket and cron, and the page says what it lacks. */
  const bare = seen(await run({ slug: "r44-bare", rel: await release({ version: NEXT, scanner: true, scannerWorker: null }) }));
  assert.deepEqual((await metaOf(bare, SCANNER + "-r44-bare")).bindings.map((b) => b.name).sort(), ["RENDERER", "SCANNER", "VERSION"]);
  assert.deepEqual([...bare.schedules.keys()], ["r44-bare"], "no cron for the member; the plane's watchdog (R39) only");
  assert.match(bare.page.label("fleet"), like("installer.fleet.note.scanner", { member: SCANNER }));
  /* A schedule refused: the member stays installed and the page says so. */
  const late = seen(await run({ slug: "r44-late", rel, refuseSchedules: [SCANNER + "-r44-late"] }));
  assert.ok(late.acct.has(SCANNER + "-r44-late"));
  assert.match(late.page.label("fleet"), like("installer.fleet.note.schedule", { member: SCANNER, schedule: "17 4 * * *" }));
  assert.ok(!late.raw.includes("<i>by the fake</i>"));
  restoreSigners();
});

test("R45 the final panel and the update's last screen say the organization's own security tools are added in your team's Civicsmith and the installer takes none; a Workers VPC service the operator names (optional, nothing preselected) binds file-scanner as SECURITY_VPC, none named writes none and the page says a tunnelled tool answers REACH_NOT_BOUND", async () => {
  const home = await text("/"), upd = await text(UPDATE_PATH);
  for (const page of [home, upd]) {
    const field = page.match(/<input id="vpc"[^>]*>/)?.[0];
    assert.ok(field && !/\svalue=/.test(field), "offered, nothing filled in");
    assert.ok(words(page).includes(word("installer.security.vpc.help")), "the page says what a tunnelled tool needs");
    assert.ok(page.includes("securityVpc:"), "the page sends it");
  }
  assert.equal(SECURITY_TOOLS, word("installer.security.tools"), "the design's paragraph: added in your team's Civicsmith, the installer takes none");
  /* /begin: a value that is not a service id refused by name; a good one carried in the cookie; none, nothing. */
  for (const bad of ["vpc-1", "0123", "g".repeat(32), "0123456789abcdef0123456789abcdef0"]) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug: "vpc-bad", securityVpc: bad }) });
    assert.deepEqual([r.status, (await r.json()).ok], [400, false], bad);
  }
  const dashed = "01234567-89ab-cdef-0123-456789abcdef";
  assert.equal(cookieValue((await begin("vpc-ok", "install", { securityVpc: dashed.toUpperCase() })).cookie).vpc, dashed);
  assert.equal("vpc" in cookieValue((await begin("vpc-none")).cookie), false);
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, scanner: true });
  const VPC = { type: "vpc_service", name: "SECURITY_VPC", service_id: VPC_ID };
  /* Named: file-scanner, and no other member, is bound to it, on the install and on the update. */
  for (const [mode, pre] of [["install", {}], ["update", { "r45-update": planeBase("r45-update") }]]) {
    const w = seen(await run({ slug: "r45-" + mode, mode, rel, pre, vpc: VPC_ID }));
    assert.deepEqual((await metaOf(w, `${SCANNER}-r45-${mode}`)).bindings.filter((b) => b.type === "vpc_service"), [VPC], mode);
    for (const m of MEMBERS.filter((x) => x !== SCANNER)) assert.equal(((await metaOf(w, `${m}-r45-${mode}`))?.bindings || []).some((b) => b.type === "vpc_service"), false, m);
    assert.match(w.page.label("fleet"), like("installer.fleet.note.vpc.connected", { member: SCANNER }));
    assert.ok(words(w.page.done).includes(word("installer.security.tools")), mode);
    assert.ok(w.page.done.includes(h(word("installer.security.note.named"))), mode);
  }
  /* None named: no such binding, and the panel and the update's last screen say a tunnelled tool answers REACH_NOT_BOUND. */
  for (const [mode, pre] of [["install", {}], ["update", { "r45-none": planeBase("r45-none") }]]) {
    const w = seen(await run({ slug: "r45-none", mode, rel, pre }));
    assert.equal((await metaOf(w, SCANNER + "-r45-none")).bindings.some((b) => b.type === "vpc_service"), false, mode);
    assert.ok(w.page.done.includes(h(word("installer.security.note.none"))), mode);
    assert.ok(words(w.page.done).includes(word("installer.security.tools")), mode);
  }
  /* Refused: file-scanner is uploaded again without it, and the page names why. */
  const no = seen(await run({ slug: "r45-refused", rel, vpc: VPC_ID, refuseVpc: true }));
  assert.ok(no.acct.has(SCANNER + "-r45-refused") && !(no.acct.get(SCANNER + "-r45-refused") || []).some((b) => b.type === "vpc_service"));
  assert.match(no.page.label("fleet"), like("installer.fleet.note.vpc.refused", { member: SCANNER }));
  assert.ok(!no.raw.includes("<b>by the fake</b>"));
  /* Named, but file-scanner not installed this time: said, never dropped. */
  const goneRel = await release({ version: NEXT, scanner: true });
  goneRel.assets[`${SCANNER}/container/FileScanner.json`] = JSON.stringify({ ...SCANNER_CLASSES[0], image: "docker.io/evil/x@sha256:" + "f".repeat(64) });
  const gone = seen(await run({ slug: "r45-gone", rel: goneRel, vpc: VPC_ID }));
  assert.match(gone.page.label("fleet"), /the Workers VPC service you named was not connected: file-scanner was not installed this time/i);
  restoreSigners();
});

test("R46 before verify succeeds, the install and the update list the account's Logpush jobs and name as a failure each job over workers_trace_events whose filter does not exclude the copy's Workers; no success while one is named; a list the permission cannot read is stated undetermined with the manual check, never passed", async () => {
  /* The filter, as Logpush's grammar reads it: only a ScriptName condition that leaves every one of the copy's Workers out excludes them. */
  const names = ["grp", "pdf-worker"];
  const F = (where) => JSON.stringify({ where });
  for (const [filter, want] of [[null, false], ["", false], ["{not json", false], [F({ key: "Outcome", operator: "eq", value: "ok" }), false],
      [F({ key: "ScriptName", operator: "!in", value: ["grp", "pdf-worker", "x"] }), true], [F({ key: "ScriptName", operator: "!in", value: ["grp"] }), false],
      [F({ key: "ScriptName", operator: "in", value: ["other"] }), true], [F({ key: "ScriptName", operator: "eq", value: "grp" }), false],
      [F({ and: [{ key: "Outcome", operator: "eq", value: "ok" }, { key: "ScriptName", operator: "!in", value: names }] }), true],
      [F({ or: [{ key: "ScriptName", operator: "!in", value: names }] }), false], [F({ key: "ScriptName", operator: "!eq", value: "grp" }), false]])
    assert.equal(installer.filterExcludes(filter, names), want, String(filter));
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const all = (slug) => [slug, ...MEMBERS.map((m) => `${m}-${slug}`)];
  const trace = (slug, filter, extra = {}) => ({ id: 7, name: "trace all", dataset: "workers_trace_events", enabled: true, filter, ...extra });
  for (const [mode, pre] of [["install", (s) => ({})], ["update", (s) => ({ [s]: planeBase(s) })]]) {
    /* None, a job over another dataset, or one whose filter leaves the copy's Workers out: clear, and verify succeeds. */
    for (const [why, jobs] of [["none", []], ["other", [{ id: 1, name: "http", dataset: "http_requests", filter: null }]],
        ["excluded", [trace("lp-x", F({ key: "ScriptName", operator: "!in", value: all("lp-x") }))]]]) {
      const w = seen(await run({ slug: "lp-x", mode, rel, pre: pre("lp-x"), logpush: jobs }));
      assert.equal(w.page.status("logs"), "ok", `${mode} ${why}`);
      assert.equal(w.page.status("verify"), "ok", `${mode} ${why}`);
      assert.ok(w.page.steps.indexOf("logs") < w.page.steps.indexOf("verify"), "before verify");
    }
    /* A job that keeps them: named on the page as a failure, and no success claimed. */
    for (const filter of [null, F({ key: "ScriptName", operator: "!in", value: ["lp-n"] })]) {
      const w = seen(await run({ slug: "lp-n", mode, rel, pre: pre("lp-n"), logpush: [trace("lp-n", filter)] }));
      assert.equal(w.page.status("logs"), "no", mode);
      assert.match(w.page.label("logs"), like("installer.logs.named.one", { list: like("installer.lag.logjob", { name: "trace all", id: "7" }) }));
      assert.equal(w.page.status("verify"), "no", mode);
      assert.match(w.page.done.replace(/&#39;/g, "'"), like("installer.lag.logjob", { name: "trace all", id: "7" }), mode);
      assert.ok(!w.page.done.includes(h(word("installer.success.running"))) && !/<b>Updated (from|to)/.test(w.page.done), `${mode}: no success`);
    }
    /* Unreadable: undetermined, with the manual check, and never stated as passed. */
    const u = seen(await run({ slug: "lp-u", mode, rel, pre: pre("lp-u"), logpush: "refused" }));
    assert.equal(u.page.status("logs"), "no", mode);
    assert.match(u.page.label("logs"), like("installer.logs.undetermined", { said: "Authentication error" }));
    assert.ok(!/No Logpush job/.test(u.page.label("logs")), "never passed");
  }
  restoreSigners();
});

test("R47 the install binds OWN_HOSTS, the copy's own host names (its workers.dev address), once that address is enabled; the update restates it from the address it finds; with no address it is not written and the page says so", async () => {
  const hostsOf = (put) => bindingOf(put, "OWN_HOSTS");
  const w = seen(await run({ slug: "hosts" }));
  assert.equal(hostsOf(w.planePuts[0]), null, "not before the address is enabled");
  assert.deepEqual(hostsOf(w.planePuts.at(-1)), { type: "plain_text", name: "OWN_HOSTS", text: "hosts.grp.workers.dev" });
  assert.deepEqual(w.acct.get("hosts").filter((b) => b.name === "OWN_HOSTS").map((b) => b.text), ["hosts.grp.workers.dev"]);
  const at = (id) => w.calls.findIndex((c) => id === "enable" ? c.u.endsWith("/scripts/hosts/subdomain") : false);
  assert.ok(w.calls.indexOf(w.calls.filter((c) => c.method === "PUT" && c.u.endsWith("/scripts/hosts")).at(-1)) > at("enable"), "written after the address is enabled");
  assert.match(w.page.label("bind"), /now knows its own address \(hosts\.grp\.workers\.dev\)/);
  /* A prefix registered by the install: the host is the one it registered. */
  const reg = seen(await run({ slug: "hosts-new", subdomain: null, choose: { subdomain: "hosts-new" } }));
  assert.equal(hostsOf(reg.planePuts.at(-1)).text, `hosts-new.${reg.prefix()}.workers.dev`);
  /* No address: never written, and said. */
  for (const opts of [{ enableFail: true }]) {
    const n = seen(await run({ slug: "hosts-none", ...opts }));
    assert.ok(n.planePuts.every((p) => hostsOf(p) === null), JSON.stringify(opts));
    assert.ok(stoppedWith(n, "installer.install.stopped.noaddress"), "the copy is not told an address of its own");
  }
  /* A refused last upload: not written, and said. */
  const ref = seen(await run({ slug: "hosts-ref", refuseRePut: true }));
  assert.equal(ref.acct.get("hosts-ref").some((b) => b.name === "OWN_HOSTS"), false);
  assert.match(ref.page.label("bind"), /Telling your team's Civicsmith its own address was refused/);
  /* The update: restated from the address it finds, on every upload; none found, none written, said. */
  const u = seen(await run({ slug: "hosts-upd", mode: "update", pre: { "hosts-upd": planeBase("hosts-upd") } }));
  for (const put of u.planePuts) assert.equal(hostsOf(put).text, "hosts-upd.grp.workers.dev");
  assert.equal(u.page.label("addr"), word("installer.update.address.found", { hosts: "hosts-upd.grp.workers.dev" }));
  const un = seen(await run({ slug: "hosts-unf", mode: "update", subdomain: null, pre: { "hosts-unf": [...planeBase("hosts-unf"), { type: "plain_text", name: "OWN_HOSTS", text: "stale.example.workers.dev" }] } }));
  for (const put of un.planePuts) assert.equal(hostsOf(put), null);
  assert.equal(un.acct.get("hosts-unf").some((b) => b.name === "OWN_HOSTS"), false, "a stale value is not kept");
  assert.equal(un.page.label("addr"), word("installer.update.address.none"));
});

/* ------------------------------------------------------------------------------------------------ T46: the test-instance exception, the stewards */

test.todo("R48 the installer's README publishes the stewards' contact address, what they may do, and the plain guide to what a group holds and who could compel it (not yet met: T46; the address is Bob's to name, K2799, and was not named by L11's START, so this part is carried to T47)");

/* The bundle with the embedded plane release (its RELEASE_PACKED literal, evaluated and checked to be that release) cut out:
   the installer's own code. From 0.83.0 the plane itself reads the name (ai-runs R78); that is the release's text. */
/* Built here, in memory, as `npm run build` builds it, so the test reads the source as it stands and not the committed artifact. */
const ownBundle = async () => {
  const b = await bundleText(esbuild);
  await esbuild.stop();                          /* N1254: the build's child process must not outlive the suite */
  const at = b.match(/\bRELEASE_PACKED ?= ?/);        /* the build minifies whitespace (installer R82) */
  const j = at.index + at[0].length, q = b[j];
  let k = j + 1;
  while (k < b.length) { if (b[k] === "\\") { k += 2; continue; } if (b[k] === q) break; k++; }
  assert.equal(vm.runInNewContext(b.slice(j, k + 1)), RELEASE_PACKED, "only the embedded release is cut out");
  return b.slice(0, j) + b.slice(k + 1);
};

test("R49 the installer never writes, reads or names CIVICSMITH_TEST_INSTANCE: no install or update upload (the plane's or a member's) carries it, /begin takes none and no page offers it, an update leaves one its deployer set exactly as it was, and the installer's own source and bundle hold no such name", async () => {
  const NAME = "CIVICSMITH_TEST_INSTANCE";
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT, container: true, scanner: true });
  const held = { type: "secret_text", name: NAME, text: "r49-upd" };
  const b = await begin("r49-inst", "install", { [NAME]: "r49-inst", testInstance: true, test_instance: "yes" });
  assert.equal(b.j.ok, true);
  assert.ok(!JSON.stringify(cookieValue(b.cookie)).includes(NAME) && !/test/i.test(Object.keys(cookieValue(b.cookie)).join()), "/begin keeps none");
  const i = seen(await run({ slug: "r49-inst", rel, cookie: b.cookie, state: b.state }));
  const u = seen(await run({ slug: "r49-upd", mode: "update", rel, pre: { "r49-upd": [...planeBase("r49-upd"), held] } }));
  restoreSigners();
  for (const [what, w] of [["install", i], ["update", u]]) {
    const puts = w.calls.filter((c) => c.method === "PUT" && /\/workers\/scripts\/[^/]+$/.test(c.u));
    assert.ok(puts.length >= 4, `${what}: the plane's uploads and the members'`);
    for (const c of puts) assert.equal((await c.init.body.get("metadata").text()).includes(NAME), false, `${what}: ${c.u}`);
    for (const c of w.calls) assert.ok(!c.u.includes(NAME) && !(typeof c.init.body === "string" && c.init.body.includes(NAME)), `${what}: ${c.method} ${c.u}`);
    assert.equal(w.raw.includes(NAME), false, `${what}: the page names none`);
  }
  assert.deepEqual(u.acct.get("r49-upd").filter((x) => x.name === NAME), [held], "the update leaves it as its deployer set it");
  assert.deepEqual(u.deleted, [], "and removes nothing");
  for (const page of [await text("/"), await text(UPDATE_PATH)]) assert.equal(page.includes(NAME), false, "no page offers it");
  /* The source: every file of the installer's own code, and the generated release.mjs but for the plane it embeds. */
  const src = new URL("../src/", import.meta.url);
  const files = readdirSync(src).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.includes("index.mjs") && files.includes("ui.mjs") && files.includes("images.mjs"));
  for (const f of files) {
    const text0 = readFileSync(new URL(f, src), "utf8");
    const own = f === "release.mjs" ? text0.split("\n").filter((l) => !l.startsWith("export const RELEASE_PACKED = ")).join("\n") : text0;
    assert.equal(own.includes(NAME), false, f);
  }
  assert.equal((await ownBundle()).includes(NAME), false, "the bundle, the embedded release aside");
  /* The reading finds the name where it is: a control. */
  assert.ok(`{ "${NAME}": 1 }`.includes(NAME));
});

/* ------------------------------------------------------------------------------------------------ the embed step */

const planeFiles = (dir, { pkgV = "1.2.3", cfgV = pkgV, secrets = "ADMIN_TOKEN=published-admin-value\n" } = {}) => {
  mkdirSync(join(dir, "plane", "dist"), { recursive: true });
  writeFileSync(join(dir, "plane", "package.json"), JSON.stringify({ name: "bio-plane", version: pkgV }));
  writeFileSync(join(dir, "plane", "wrangler.jsonc"), `{ // the plane\n "vars": { "VERSION": "${cfgV}" } }`);
  writeFileSync(join(dir, "plane", "dist", "SECRETS.txt"), secrets);
};

test("R25 resolveVersion returns package.json's version, and throws naming the files and what to change when it is not semver, when the plane's config declares no VERSION, or when that VERSION differs", () => {
  const pkg = (v) => JSON.stringify({ version: v }), cfg = (v) => `{ "vars": { "VERSION": "${v}" } }`;
  assert.equal(resolveVersion({ packageJson: pkg("0.48.0"), wranglerJsonc: cfg("0.48.0") }), "0.48.0");
  assert.equal(resolveVersion({ packageJson: pkg("1.0.0-rc.1"), wranglerJsonc: cfg("1.0.0-rc.1") }), "1.0.0-rc.1");
  const throws = (p, c) => { try { resolveVersion({ packageJson: p, wranglerJsonc: c }); return null; } catch (e) { return e.message; } };
  for (const v of ["latest", "1.2", "", undefined]) assert.match(throws(pkg(v), cfg("1.2.3")), /bio-plane\/package\.json has no usable "version"/);
  assert.match(throws("{not json", cfg("1.2.3")), /bio-plane\/package\.json does not parse/);
  assert.match(throws(pkg("1.2.3"), '{ "vars": {} }'), /bio-plane\/wrangler\.jsonc declares no VERSION var.*agree with package\.json \(1\.2\.3\)/s);
  for (const other of ["1.2.2", "1.2.4"]) {
    const m = throws(pkg("1.2.3"), cfg(other));
    assert.match(m, /bio-plane\/package\.json +1\.2\.3 +<- authority/);
    assert.match(m, new RegExp(`bio-plane/wrangler\\.jsonc +${other.replace(/\./g, "\\.")}`));
    assert.match(m, /Set wrangler\.jsonc to "VERSION": "1\.2\.3"/);
  }
});

test("R26 checkSignedAsset returns null only for the signed release of that version, else the reason; the embed refuses a release carrying a published token value and writes release.mjs as generated", async () => {
  const src = "export default {}; // the plane 1.2.3";
  const bytes = new TextEncoder().encode(src);
  const good = { version: "1.2.3", sha256: await sha(src), asset: "bio-plane.bundled.mjs", sig: await SIGNER.sign(bytes) };
  const signers = [SIGNER.line];
  assert.equal(await checkSignedAsset({ manifest: good, bytes, version: "1.2.3", signers }), null);
  const why = async (o) => checkSignedAsset({ manifest: good, bytes, version: "1.2.3", signers, ...o });
  assert.match(await why({ manifest: null }), /missing or does not parse/);
  const unsigned = await why({ version: "1.2.4" });
  assert.match(unsigned, /RELEASE\.json is "1\.2\.3" but bio-plane\/package\.json is 1\.2\.4/);
  /* The refusal names the command that cuts and signs a release, as the operator runs it from the repository root. */
  assert.ok(unsigned.includes("cut and sign 1.2.4 (node bio-plane/scripts/release-assemble.mjs --sign)"), unsigned);
  assert.ok(existsSync(new URL("../../bio-plane/scripts/release-assemble.mjs", import.meta.url)), "the command it names exists");
  assert.match(await why({ bytes: new TextEncoder().encode(src + " ") }), /hashes .* but RELEASE\.json records/);
  assert.match(await why({ signers: [] }), /lists no ARMED_SIGNERS/);
  assert.match(await why({ manifest: { ...good, sig: "" } }), /carries no signature/);
  assert.match(await why({ manifest: { ...good, sig: await STRANGER.sign(bytes) } }), /does not verify .*UNKNOWN_KEY/);
  assert.match(await why({ manifest: { ...good, sig: await SIGNER.sign(bytes, "bio-ratify") } }), /does not verify .*NAMESPACE/);
  const dir = mkdtempSync(join(tmpdir(), "embed-"));
  planeFiles(dir);
  mkdirSync(join(dir, "release"));
  writeFileSync(join(dir, "release", "RELEASE.json"), JSON.stringify(good));
  writeFileSync(join(dir, "release", "bio-plane.bundled.mjs"), src);
  const out = join(dir, "out", "release.mjs");
  const args = { planeDir: join(dir, "plane"), releaseDir: join(dir, "release"), out, signers };
  assert.deepEqual(await embedRelease(args), { version: "1.2.3", sha256: good.sha256, bytes: src.length, containers: 0 });
  const written = readFileSync(out, "utf8");
  assert.match(written, /^\/\* GENERATED by scripts\/embed-release\.mjs\. Do not edit\. \*\/\n/);
  const mod = await import(out + "?v=1");
  assert.deepEqual([mod.RELEASE_VERSION, gunzipSync(Buffer.from(mod.RELEASE_PACKED, "base64")).toString(), mod.RELEASE_CONTAINERS], ["1.2.3", src, []]);
  assert.deepEqual([mod.RELEASE_FACTS.capable, mod.RELEASE_FACTS.limits.ok], [reportsBuilds(src), planeLimits(src).ok], "the facts the installer reads from the release's text are read at the embed");
  const leaky = "export default {}; // published-admin-value";
  writeFileSync(join(dir, "release", "bio-plane.bundled.mjs"), leaky);
  writeFileSync(join(dir, "release", "RELEASE.json"), JSON.stringify({ ...good, sha256: await sha(leaky), sig: await SIGNER.sign(leaky) }));
  await assert.rejects(embedRelease({ ...args, out: join(dir, "leak.mjs") }), /published token value found in the bundled release; refusing to embed/);
  assert.equal(existsSync(join(dir, "leak.mjs")), false, "nothing written");
  await assert.rejects(embedRelease({ ...args, signers: [STRANGER.line], out: join(dir, "x.mjs") }), /does not verify/);
  /* The shipped installer: its embed is the signed release it names, verified by the shipped keys. */
  const root = new URL("../../release/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("RELEASE.json", root), "utf8"));
  const real = readFileSync(new URL(manifest.asset, root));
  restoreSigners();
  assert.equal(await checkSignedAsset({ manifest, bytes: real, version: manifest.version }), null);
  assert.deepEqual([RELEASE_VERSION, createHash("sha256").update(RELEASE_BYTES).digest("hex")], [manifest.version, manifest.sha256]);
  assert.ok(Buffer.from(RELEASE_BYTES).equals(real), "the embedded release, expanded, is the release asset, byte for byte");
  assert.deepEqual(RELEASE_FACTS, JSON.parse(JSON.stringify({ limits: planeLimits(real), capable: reportsBuilds(real) })), "and its facts are the ones its bytes state");
});

test("R26 the embed writes the plane packed, the base64 of its gzip, in printable ASCII: every byte value comes back as itself, the same bytes always give the same text, and the packed text is a fraction of the release", () => {
  const all = Uint8Array.from({ length: 256 * 3 }, (_, i) => i % 256);
  const lit = packedLiteral(all);
  assert.match(lit, /^"[A-Za-z0-9+/]*={0,2}"$/, "printable ASCII only");
  const back = gunzipSync(Buffer.from(vm.runInNewContext(lit), "base64"));
  assert.deepEqual([...back], [...all], "each byte is itself");
  assert.equal(packedLiteral(all), lit, "reproducible");
  const text = new TextEncoder().encode('é€"\\ \u2028 </script>');
  assert.deepEqual([...gunzipSync(Buffer.from(vm.runInNewContext(packedLiteral(text)), "base64"))], [...text], "text's UTF-8 bytes are kept as bytes");
  assert.ok(RELEASE_PACKED.length < RELEASE_BYTES.length / 2, "the packed release is under half the size of the release");
});

/* ------------------------------------------------------------------------------------------------ invariants */

const config = () => JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
  .replace(/^\s*\/\/.*$/gm, ""));

test("R27 the installer Worker declares no binding of any kind", async () => {
  const c = config();
  const BINDING_KEYS = ["vars", "kv_namespaces", "r2_buckets", "d1_databases", "durable_objects", "services", "queues",
    "analytics_engine_datasets", "ai", "browser", "vectorize", "hyperdrive", "mtls_certificates", "dispatch_namespaces",
    "send_email", "workflows", "tail_consumers", "unsafe", "secrets_store_secrets", "images", "version_metadata", "assets"];
  assert.deepEqual(Object.keys(c).filter((k) => BINDING_KEYS.includes(k)), []);
  assert.deepEqual(Object.keys(c).sort(), ["$schema", "account_id", "compatibility_date", "main", "name", "observability"]);
  /* And it runs with no environment at all. */
  const r = await worker.fetch(new Request(ORIGIN + "/"), undefined);
  assert.equal(r.status, 200);
});

test("R28 its configuration pins the project's Cloudflare account", () => {
  assert.equal(config().account_id, "20b533579290b9b93168345edd3b7f72");
});

test("R29 one verifier: the installer accepts a release signature exactly when signatures' verifySshsig does", async () => {
  armWith(SIGNER.line);
  const cases = [["good", true], ["stranger", false], ["wrong-ns", false]];
  for (const [sig, _] of cases) {
    const rel = await release({ version: NEXT, sig, fleet: false });
    const verdict = (await verifySshsig(rel.manifest.sig, new TextEncoder().encode(rel.src), NS_RELEASE, [SIGNER.line])).ok;
    const w = await run({ slug: "one-verifier", rel });
    assert.equal(w.planePuts[0]?.source === rel.src, verdict, sig);
    const embed = await checkSignedAsset({ manifest: rel.manifest, bytes: new TextEncoder().encode(rel.src), version: NEXT, signers: [SIGNER.line] });
    assert.equal(embed === null, verdict, `embed ${sig}`);
  }
  restoreSigners();
});

test("R30 the slug grammar and the member binding names are instance-setup's, imported, never copied: /begin accepts exactly GROUP_SLUG_RE's slugs (less its own name), the plane is bound under exactly FLEET_BINDINGS' names, and the installer exports no grammar or table of its own", async () => {
  /* The grammar: every length from 0 to 42, and every printable ASCII character (and two beyond it) at the start, the
     middle and the end of a slug, each accepted by /begin exactly when GROUP_SLUG_RE accepts it. */
  const chars = [...Array(95)].map((_, i) => String.fromCharCode(32 + i)).concat(["é", "\u2028"]);
  const corpus = [...Array(43)].map((_, n) => "a".repeat(n))
    .concat(chars.flatMap((c) => [c + "bc", "a" + c + "c", "ab" + c]), ["newgroup", "a-b-c", "0-0", "--a", "a--b"]);
  let accepted = 0;
  for (const slug of corpus) {
    const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug }) });
    const want = GROUP_SLUG_RE.test(slug) && slug !== "newgroup";
    assert.equal(r.status === 200, want, JSON.stringify(slug));
    if (want) accepted++;
  }
  assert.ok(accepted > 60 && accepted < corpus.length - 60, "the corpus holds both sides of the grammar");
  /* The binding names: a full install binds the plane to each member under exactly FLEET_BINDINGS' name, and to
     nothing else but SELF. */
  assert.ok(FLEET_BINDINGS.length > 0);
  armWith(SIGNER.line);
  const w = seen(await run({ slug: "r30-names", rel: await release({ version: NEXT }) }));
  restoreSigners();
  const services = w.planePuts.at(-1).bindings.filter((b) => b.type === "service");
  /* R64: each member's worker is named for the slug; the binding names are FLEET_BINDINGS'. */
  assert.deepEqual(services.filter((b) => b.name !== "SELF").map((b) => [b.service, b.name]).sort(),
    FLEET_BINDINGS.map(([m, b]) => [`${m}-r30-names`, b]).sort());
  /* Never copied: nothing the installer exports is a slug grammar or a member binding table. */
  const table = JSON.stringify(Object.fromEntries(FLEET_BINDINGS));
  for (const [name, v] of Object.entries(installer)) {
    assert.ok(!(v instanceof RegExp), `${name} is a grammar of its own`);
    assert.ok(!(v && typeof v === "object" && (JSON.stringify(v) === JSON.stringify(FLEET_BINDINGS) || JSON.stringify(v) === table)),
      `${name} is a binding table of its own`);
  }
});

test("R31 no place is named in the installer's behaviour: no page it serves or streams names a place a held profile covers", async () => {
  const places = new Set(jurisdictions.list().flatMap((p) => p.covers).flatMap((c) => c.toLowerCase().split(/\W+/)).filter((x) => x.length > 2));
  assert.ok(places.size > 0);
  const pages = [...PAGES, await text("/"), await text(UPDATE_PATH), await text("/elsewhere"), INVITATION];
  assert.ok(pages.length > 40, "the pages this suite rendered");
  for (const page of pages.map(withoutChoices)) {
    const words = page.replace(/newgroup\.believeinoakland\.workers\.dev/g, "")
      .toLowerCase().split(/[^a-z]+/);
    assert.deepEqual(words.filter((w) => places.has(w)), [], page.slice(0, 120));
  }
});

test("R32 (replaced by R62 and R64) an install into an account already holding a copy (either evidence bucket, or a fleet worker, under the older fixed names) is no longer refused as one copy per account: nothing is created or changed, the account is told and offered the three ways on; an empty account installs under per-slug names; an update is not stopped by it", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const old = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
  /* Nothing written: no call but a read reached the account, and the account is exactly as it was. */
  const untouched = (w, pre, preBuckets, why) => {
    assert.deepEqual(w.calls.filter((c) => c.method !== "GET" && c.u.startsWith(CFG.API)).map((c) => `${c.method} ${c.u}`), [], why);
    assert.deepEqual([...w.acct.keys()].sort(), Object.keys(pre).sort(), why);
    for (const [k, v] of Object.entries(pre)) assert.deepEqual(w.acct.get(k), v, why);
    assert.deepEqual([...w.buckets].sort(), preBuckets.slice().sort(), why);
  };
  const cases = [
    ["bucket bio-captures", {}, ["bio-captures"]],
    ["bucket bio-published", {}, ["bio-published"]],
    ["both buckets", {}, ["bio-captures", "bio-published"]],
    ...MEMBERS.map((m) => [`worker ${m}`, { [m]: old }, []]),
  ];
  for (const [why, pre, preBuckets] of cases) {
    const w = seen(await run({ slug: "one-copy", rel, pre, preBuckets }));
    assert.equal(w.page.status("fresh"), "no", why);
    assert.equal(w.page.label("fresh"), word("screen.install.stopped.exists"), why);
    assert.ok(w.page.done.includes(word("screen.install.exists.title")), `${why}: the account is told`);
    assert.ok(!/One installation of Civicsmith per/.test(w.page.words), `${why}: no longer the one-copy refusal`);
    assert.ok(!w.calls.some((c) => c.u.includes("bio-plan-probe")), `${why}: before the plan probe`);
    untouched(w, pre, preBuckets, why);
  }
  /* A lookup that cannot say ends the run with nothing created: an absence not established is not established. */
  const unread = seen(await run({ slug: "one-unread", rel, lookupFail: ["one-unread"] }));
  assert.notEqual(unread.page.status("fresh"), "ok");
  untouched(unread, {}, [], "unread");
  /* The negative control: an empty account installs, members and all, under the slug's own names (R64). */
  const empty = seen(await run({ slug: "one-empty", rel }));
  assert.equal(empty.page.status("fresh"), "ok");
  assert.deepEqual([...empty.buckets].sort(), ["bio-captures-one-empty", "bio-published-one-empty"]);
  for (const m of MEMBERS) assert.ok(empty.acct.has(`${m}-one-empty`), m);
  assert.equal(empty.page.status("install"), "ok");
  assert.ok(empty.page.done.includes('id="out-boot"'));
  /* An update is not an install: a copy under the older fixed names, with its buckets and its members, is updated by its slug. */
  const up = seen(await run({ slug: "one-upd", mode: "update", rel, preBuckets: ["bio-captures", "bio-published"],
    pre: { "one-upd": planeBase("one-upd"), ...Object.fromEntries(MEMBERS.map((m) => [m, old])) } }));
  assert.equal(up.page.status("up"), "ok");
  assert.ok(up.page.done && up.planePuts.length >= 1, "the update ran to its end");
  restoreSigners();
});

test("R33 the install and the update read back the uploaded plane's content and compare its hash with the release's; a mismatch, or a script that cannot be read back, is named on the page and no success is claimed; a matching read-back succeeds", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const want = await sha(rel.src);
  const MISMATCH = like("installer.lag.bytes.differ", { version: NEXT, got: /[0-9a-f]{16}…/, want: want.slice(0, 16) + "…" });
  /* Install: matching, as the module itself or as a multipart body, after every plane upload (the install PUT and its
     step-3 re-PUT); and a first read that differs, then matches, is a match. */
  for (const readBack of ["raw", "multipart", "differ-once"]) {
    const w = seen(await run({ slug: "rb-ok", rel, readBack }));
    assert.equal(w.planePuts.length, 2, readBack);
    assert.ok(w.reads.filter((n) => n === "rb-ok").length >= 2, `${readBack}: read back after each plane upload`);
    assert.equal(w.page.status("verify"), "ok", readBack);
    assert.ok(w.page.done.includes(h(word("installer.success.running"))), readBack);
  }
  const reads = [];
  for (const [readBack, named] of [["differ", like("installer.lag.bytes.differ", { version: NEXT })], ["fail", like("installer.lag.bytes.unread", { version: /[0-9.]+/ })]]) {
    const w = seen(await run({ slug: "rb-bad", rel, readBack }));
    reads.push(w.reads.length);
    assert.match(w.page.done.replace(/&#39;/g, "'"), named, readBack);
    assert.ok(!w.page.done.includes(h(word("installer.success.running"))), `${readBack}: no success claimed`);
    assert.equal(w.page.status("verify"), "no", readBack);
    assert.ok(w.page.done.includes('id="out-boot"'), `${readBack}: the credentials are still handed over`);
    /* With the address silent too, the mismatch is still named. */
    // fixtures-own: platform a copy still waking: its self-check answers not-ok, the fake network's own double of a platform that is not up yet, not any module's answer
    const quiet = seen(await run({ slug: "rb-quiet", rel, readBack, copy: { selftest: () => jres({ ok: false }) } }));
    assert.match(quiet.page.done.replace(/&#39;/g, "'"), named, `${readBack}, address silent`);
    assert.ok(quiet.page.done.includes(h(word("installer.success.lagging.asleep"))), "the address has not woken up yet");
  }
  /* Update: the same, on its plane upload. */
  const base = (slug) => ({ [slug]: planeBase(slug) });
  const good = seen(await run({ slug: "rb-upd", mode: "update", rel, pre: base("rb-upd") }));
  assert.ok(good.reads.includes("rb-upd"));
  assert.ok(good.page.done.includes(h(word("installer.update.done.says", { to: NEXT, from: "0.1.0" }))));
  for (const [readBack, named] of [["differ", MISMATCH], ["multipart", null]]) {
    const w = seen(await run({ slug: "rb-upd", mode: "update", rel, readBack, pre: base("rb-upd") }));
    if (!named) { assert.ok(w.page.done.includes(h(word("installer.update.done.says", { to: NEXT, from: "0.1.0" }))), readBack); continue; }
    assert.match(w.page.done.replace(/&#39;/g, "'"), named, readBack);
    assert.ok(!/<b>Updated (from|to)/.test(w.page.done), "no success claimed");
    assert.equal(w.page.status("verify"), "no");
  }
  /* An update whose copy has no address to ask still names the mismatch. */
  const noAddr = seen(await run({ slug: "rb-noaddr", mode: "update", rel, readBack: "differ", subdomain: null, pre: base("rb-noaddr") }));
  assert.match(noAddr.page.done.replace(/&#39;/g, "'"), MISMATCH);
  assert.ok(!/<b>Updated (from|to)/.test(noAddr.page.done));
  restoreSigners();
});

/* ------------------------------------------------------------------------------------------------ nothing loaded from elsewhere */

/* R35: every load a page names, with its value: any `src`, `srcset`, `poster`, `data` or `background`; any `href` but a
   link's (`<a>`, which the reader follows: not a load); any CSS `@import` or `url()`; any script `fetch` or `import()`.
   One on another origin is one whose value names a scheme (other than `data:`, `blob:`, `about:`) or starts `//`. */
const loadsIn = (page) => {
  const out = [];
  for (const [, tag, attrs] of page.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi))
    for (const a of attrs.matchAll(/(?:^|\s)(src|srcset|poster|data|background|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      if (tag.toLowerCase() === "a" && a[1].toLowerCase() === "href") continue;
      const v = a[2] ?? a[3] ?? a[4];
      out.push(...(a[1].toLowerCase() === "srcset" ? v.split(",").map((x) => x.trim().split(/\s+/)[0]) : [v]));
    }
  for (const m of page.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) out.push(m[1]);
  for (const m of page.matchAll(/url\(\s*["']?([^"')]+)/gi)) out.push(m[1].trim());
  for (const m of page.matchAll(/\b(?:fetch|import)\(\s*["'`]([^"'`]+)/g)) out.push(m[1]);
  return out;
};
const elsewhere = (v) => /^\s*\/\//.test(v) || (/^\s*[a-z][a-z0-9+.-]*:/i.test(v) && !/^\s*(data|blob|about):/i.test(v));

test("R35 every page the installer serves, and the invitation page, names no resource on another origin in any src, href, @import or url(); typefaces are the device's; a link the reader follows is not a load", async () => {
  /* The reading itself: it finds each kind of load on another origin, the invitation page's old Google Fonts head among
     them, and passes a link, a same-origin load and a fetch of the installer's own route. */
  const OLD_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces&display=swap" rel="stylesheet">`;
  assert.deepEqual(loadsIn(OLD_HEAD).filter(elsewhere), ["https://fonts.googleapis.com", "https://fonts.gstatic.com",
    "https://fonts.googleapis.com/css2?family=Fraunces&display=swap"]);
  for (const bad of [`<script src="https://cdn.example/x.js"></script>`, `<img src=//cdn.example/x.png>`,
      `<img srcset="/a.png 1x, https://cdn.example/b.png 2x">`, `<style>@import "https://cdn.example/x.css";</style>`,
      `<style>@import url(https://cdn.example/x.css);</style>`, `<style>body{background:url('//cdn.example/x.png')}</style>`,
      `<style>@font-face{src:url(https://fonts.gstatic.com/x.woff2)}</style>`, `<script>fetch("https://api.example/x")</script>`])
    assert.ok(loadsIn(bad).filter(elsewhere).length >= 1, bad);
  for (const fine of [`<a href="https://dash.cloudflare.com/sign-up" rel="noopener">`, `<a class="btn" href='https://newgroup.example/'>`,
      `<link rel="stylesheet" href="/x.css">`, `<script>fetch("/begin",{method:"POST"})</script>`, `<button data-url="https://x.example/">`,
      `<img src="data:image/png;base64,AAAA">`])
    assert.deepEqual(loadsIn(fine).filter(elsewhere), [], fine);

  /* Every page: the install and update pages, a 404, every page the suite above streamed or answered (the progress pages
     of every install and update, with their panels, and the callback's refusals), and the invitation page. */
  const pages = [await text("/"), await text(UPDATE_PATH), await text("/elsewhere"), ...RAW, ...PAGES, INVITATION];
  assert.ok(RAW.length > 40, "the pages this suite rendered");
  for (const page of pages) assert.deepEqual(loadsIn(page).filter(elsewhere), [], page.slice(0, 160));
  /* Typefaces are the device's or carried beside the page: no page declares a face of its own; the installer's pages take
     interface-assets' faces from the stylesheet the installer serves itself (R53's test), and the invitation page's
     stacks are the device's own. */
  for (const page of pages) assert.equal(/@font-face/i.test(page), false, page.slice(0, 160));
  assert.ok(/(--display:|font-family:)Georgia,serif/.test(INVITATION) && /--body:system-ui/.test(INVITATION));
  assert.equal(/@font-face|font-family:\s*["']?(Civicsmith|Source)/i.test(PAGE_CSS), false, "the installer's layout names no face of its own");
  /* A link the reader follows stays: the hosting provider's sign-up, and the installer's own address. */
  assert.ok(INVITATION.includes('<a href="https://dash.cloudflare.com/sign-up"'));
  assert.ok(INVITATION.includes('href="https://newgroup.believeinoakland.workers.dev/"'));
});

/* ------------------------------------------------------------------------------------------------ a member's own limits */

test("R39 a fleet member's limits are read from its signed bundle (`bio-member-limits/1 …`) and sent exactly at its upload, on install and update, the installer holding no value of its own; a member stating none is uploaded with none; one stating them unreadably is left out, named, and the install never fails over it; the fleet statement is unchanged", async () => {
  const member = (stmt, q = '"') => `export default { fetch(){ return new Response('member'); } }; export const L = ${q}${stmt}${q};`;
  const SHEET = "sheet-worker", ALL = [...new Set([...MEMBERS, SHEET])];
  const putOf = async (w, name) => {
    const c = w.calls.filter((x) => x.method === "PUT" && x.u.endsWith("/workers/scripts/" + name)).at(-1);
    return c ? JSON.parse(await c.init.body.get("metadata").text()) : null;
  };
  armWith(SIGNER.line);
  /* Exactly the bundle's statement, in any quote style a bundler prints, on the install and on the update; a member that
     states none is uploaded with no limits, as before. */
  for (const [stmt, q, want] of [["bio-member-limits/1 cpu_ms=300000", '"', { cpu_ms: 300000 }],
      ["bio-member-limits/1 cpu_ms=30000 subrequests=50", "'", { cpu_ms: 30000, subrequests: 50 }], ["bio-member-limits/1 cpu_ms=7", "`", { cpu_ms: 7 }]]) {
    const rel = await release({ version: NEXT, members: ALL, memberSrc: { [SHEET]: member(stmt, q) + ` const again = "${stmt}";` } });
    const i = seen(await run({ slug: "mlim-install", rel }));
    assert.deepEqual((await putOf(i, SHEET + "-mlim-install")).limits, want, stmt);
    for (const m of ALL.filter((x) => x !== SHEET)) assert.equal("limits" in (await putOf(i, m + "-mlim-install")), false, `${m} states none, so none is sent`);
    assert.match(i.page.label("fleet"), like("installer.fleet.done.other", { n: ALL.length }), stmt);
    const u = seen(await run({ slug: "mlim-update", mode: "update", pre: { "mlim-update": planeBase("mlim-update") }, rel }));
    assert.deepEqual((await putOf(u, SHEET + "-mlim-update")).limits, want, `update: ${stmt}`);
  }
  /* A container member is uploaded with its own limits too (R38's upload). */
  const boxed = await release({ version: NEXT, container: true, memberSrc: { [RUNNER]: member("bio-member-limits/1 cpu_ms=900") } });
  const box = seen(await run({ slug: "mlim-box", rel: boxed }));
  assert.deepEqual((await putOf(box, RUNNER + "-mlim-box")).limits, { cpu_ms: 900 });
  /* Unreadable: that member is left out, named with why; every other member installs; the install finishes. */
  for (const [src, says] of [[member("bio-member-limits/1 cpu_ms=300000") + ' const b = "bio-member-limits/1 cpu_ms=5";', like("installer.fleet.why.limits")],
      [member("bio-member-limits/1 subrequests=5 cpu_ms=5"), like("installer.fleet.why.limits")], [member("bio-member-limits/1 cpu_ms=0"), like("installer.fleet.why.limits")],
      [member("bio-member-limits/1 cpu_ms=lots"), like("installer.fleet.why.limits")], [member("bio-member-limits/1 cpu_ms=1 cpu_ms=2"), like("installer.fleet.why.limits")]]) {
    const w = seen(await run({ slug: "mlim-bad", rel: await release({ version: NEXT, members: ALL, memberSrc: { [SHEET]: src } }) }));
    assert.ok(!w.acct.has(SHEET + "-mlim-bad"), "left out");
    for (const m of ALL.filter((x) => x !== SHEET)) assert.ok(w.acct.has(m + "-mlim-bad"), `${m} still installs`);
    assert.match(w.page.label("fleet"), says);
    assert.ok(w.page.done, "the install never fails over a member");
  }
  /* The two statements are never read as each other: a member's in the plane is not the plane's, a plane's in a member is not the member's. */
  assert.deepEqual(installer.memberLimits(member("bio-plane-limits/1 subrequests=10000")), { ok: true, limits: null });
  assert.deepEqual(planeLimits(UNSTATED_SRC + ' const m = "bio-member-limits/1 cpu_ms=300000";'), { ok: false, why: "none" });
  /* Nothing is added to the fleet statement: the limits ride in the member bytes its hash covers, so the /2 statement an
     older installer rebuilds is the one signed, and the manifest's keys are as before. */
  const rel = await release({ version: NEXT, members: ALL, memberSrc: { [SHEET]: member("bio-member-limits/1 cpu_ms=300000") } });
  assert.deepEqual(Object.keys(rel.manifest).sort(), ["asset", "bytes", "fleet", "fleetSig", "sha256", "sig", "version"]);
  assert.deepEqual(Object.keys(rel.manifest.fleet.find((m) => m.member === SHEET)).sort(), ["asset", "bytes", "compat", "member", "parts", "services", "sha256"]);
  restoreSigners();
  /* The member this tree builds states its limits as this reads them (`sheet-worker` R17), equal to its own
     `wrangler.jsonc`'s `limits`: built here by the bundler's own recipe, the bytes a release would sign. */
  const { discoverMembers, buildMember } = await import("../../bio-plane/scripts/fleet-bundle.mjs");
  const sheet = discoverMembers().find((m) => m.name === SHEET);
  const built = await buildMember(sheet, { write: false });
  const cfgLimits = JSON.parse(readFileSync(new URL("../../sheet-worker/wrangler.jsonc", import.meta.url), "utf8").match(/"limits":\s*(\{[^}]*\})/)[1]);
  assert.deepEqual(installer.memberLimits(built.bytes), { ok: true, limits: cfgLimits });
});

/* ------------------------------------------------------------------------------------------------ the words members and founders see */

/* R40: a page's member- and founder-facing words: no style or script, no markup; the hosting block (instance-setup's
   export, R34, its words that module's), codes, binding and field names, and identifiers taken out; and the meanings of
   "copy" R40 keeps (a release's built-in or repository copy; the Copy buttons) and BOB's kept line ("someone else's
   servers", K1785) taken out. What is left must never call the group's own Civicsmith a copy, instance, plane or server. */
const blockText = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const memberWords = (page) => {
  let t = page.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<script>[\s\S]*?<\/script>/g, " ");
  for (const x of [HOSTING_CONTROL.heading, ...HOSTING_CONTROL.sentences]) t = t.split(blockText(x)).join(" ").split(x).join(" ");
  /* (R72) Sentences the design's keys word say "copy" of a silent or older Civicsmith (DEC-328); the installer reads them by key and
     does not reword them, so they are taken out as the kept line is (reported to BOB). */
  for (const k of ["installer.fact.unknown.silent", "installer.fact.unknown.older"]) t = t.split(word(k).replace(/'/g, "&#39;")).join(" ").split(word(k)).join(" ");
  t = t.replace(/<button class="copy"[^>]*>Copy[^<]*<\/button>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  t = t.replace(/(repository's|built-in) copy/g, " ").replace(/someone else's servers/g, " ").replace(/number of instances/g, " ");
  return t.replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, " ").replace(/\S*[-_=/.:]\S*/g, (w) => /[a-z][-_=/.:][a-z]/i.test(w) ? " " : w);
};
test("R40 every member- or founder-facing string the installer serves (the install and update pages, every step and refusal, the final panel and last screen, the invitation page) says \"your team's Civicsmith\" or needs no name, never copy, instance, plane or server for it; \"installation\" only where the hosting is the subject", async () => {
  /* The reading finds each word it is for, and passes the meanings R40 keeps. */
  for (const bad of ["Your copy is running.", "the plane itself installed", "on this instance", "our servers", "Go to my copy"])
    assert.match(memberWords(`<p>${bad}</p>`), /\b(copy|instance|plane|servers?)\b/i, bad);
  for (const fine of ["The repository's copy carries no signature", "the installer used its built-in copy", "the binding INSTANCE_NAME",
      `<button class="copy" data-copy="out-url">Copy</button>`, "bio-plane.bundled.mjs", "op=instancegroupseed", "someone else's servers"])
    assert.doesNotMatch(memberWords(`<p>${fine}</p>`), /\b(copy|instance|plane|servers?)\b/i, fine);
  /* Every page: the install and update pages, a 404, every page the suite above streamed or answered (the progress pages
     of every install and update with their steps, refusals and panels, the callback's refusals), and the invitation page. */
  const pages = [await text("/"), await text(UPDATE_PATH), await text("/elsewhere"), ...RAW, ...PAGES, INVITATION];
  assert.ok(RAW.length > 40, "the pages this suite rendered");
  for (const page of pages) {
    const words = memberWords(page);
    const hit = words.match(/.{0,60}\b(copy|copies|instance|instances|plane|planes|server|servers)\b.{0,40}/i);
    assert.equal(hit, null, hit?.[0]);
  }
  /* Each changed string by name: the pages' titles, the last screen's hand-over, R32's sentence, R14's address step, the
     refusal pages, the assistant's words, and the limits' refusal. */
  const home = await text("/"), upd = await text(UPDATE_PATH);
  for (const [page, want] of [[home, `<title>${h(word("screen.install.name"))}</title>`], [home, `<h2>${h(word("screen.install.short.heading"))}</h2>`],
      [home, `<h1>${h(word("screen.install.cf.title"))}</h1>`], [home, `<h2>${h(BEFORE_CLOUDFLARE_CONTROL)}</h2>`],
      [upd, `<title>${h(word("installer.update.page.title"))}</title>`], [upd, h(word("installer.update.which.label"))],
      [INVITATION, `<title>${word("installer.invite.title")}</title>`], [INVITATION, `>${word("installer.invite.button")}</a>`],
      [await text("/elsewhere"), h(word("installer.plain.team"))]])
    assert.ok(page.includes(want), want);
  const done = seen(await run({ slug: "r40-words" }));
  assert.ok(done.page.done.includes(`>${h(word("screen.install.continue"))}</button>`));
  assert.ok(done.page.done.includes(`<b>${h(word("installer.success.running"))}</b>`));
  assert.ok(done.raw.includes(`<title>${h(word("screen.install.progress.title"))}</title>`));
  assert.equal(done.page.events.find((e) => e.k === "step" && e.id === "fleet").label, word("installer.step.helpers"));
  const one = seen(await run({ slug: "r40-one", preBuckets: ["bio-captures"] }));
  /* R62 replaces R32's refusal: the account is told, in the design's words, that it already holds a Civicsmith. */
  assert.equal(one.page.label("fresh"), word("screen.install.stopped.exists"));
  assert.ok(one.page.done.includes(word("screen.install.exists.title")));
  const up = seen(await run({ slug: "r40-up", mode: "update", pre: { "r40-up": planeBase("r40-up") } }));
  assert.ok(up.raw.includes(`<title>${h(word("installer.update.progress.title"))}</title>`));
  assert.equal(up.page.events.find((e) => e.k === "step" && e.id === "find").label, word("installer.step.find", { slug: "r40-up" }));
  assert.equal(up.page.events.find((e) => e.k === "step" && e.id === "addr").label, word("installer.step.address.update"));
  assert.ok(up.page.done.includes(`>${h(word("installer.update.back"))}</a>`));
  /* "Copy" keeps its other meaning: the release the installer carries is still its built-in copy. */
  armWith(SIGNER.line);
  const tamper = await release({ version: NEXT, fleet: false }); tamper.assets["bio-plane.bundled.mjs"] = "tampered";
  const kept = seen(await run({ slug: "r40-kept", rel: tamper }));
  restoreSigners();
  assert.ok(kept.page.label("rel").startsWith(word("installer.release.fallback.integrity")));
});

/* ------------------------------------------------------------------------------------------------ the short name and the description */

test("R41 the install page's act that chooses the short name shows the Irreversible weight (its word beside its mark); before /begin is sent in install mode a full dialog states the choice is permanent and names the short name typed; only the confirming act sends /begin, closing sends nothing; the update page shows neither", async () => {
  const home = await text("/"), upd = await text(UPDATE_PATH);
  const PIPS = new RegExp(`<span class="cs-pips" aria-hidden="true">(?:<i class="on"></i>){5}</span>${word("weight.irreversible.name")}</span>`);
  /* The weight: five pips, the word beside them, on the button that chooses the short name and on the dialog's confirming act. */
  const go = home.match(/<button id="go" class="cs-btn" data-tone="primary">([\s\S]*?)<\/button>/)[1];
  assert.match(go, PIPS, "the act choosing the short name carries the Irreversible weight");
  const yes = home.match(/<button type="button" class="cs-btn" data-tone="primary" id="confirm-yes">([\s\S]*?)<\/button>/)[1];
  assert.match(yes, PIPS, "and so does the act that confirms it");
  /* The dialog's words: the short name becomes the address and the worker's name and stands beside every signature; it
     can never be changed but by installing a new Civicsmith and starting again. */
  const dialog = home.match(/<dialog id="confirm"[\s\S]*?<\/dialog>/)[0];
  const words = dialog.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ");
  /* (T50, R72) The heading, the permanence statement and the two acts are the design's keys; the statement says the short name is in
     every address and beside every signature and can never be changed (Bob's K3777 (6): it drops the name of the worker). */
  const [before, after] = word("installer.permanent.heading", { name: "\u0000" }).split("\u0000");
  assert.ok(words.includes(before.trim()) && words.includes(after.trim()), "the heading says the name is permanent");
  assert.ok(words.includes(word("screen.install.permanent")));
  assert.ok(words.includes(word("installer.permanent.continue")) && words.includes(word("installer.permanent.cancel")));
  assert.ok(!/ceremony|publish/i.test(words), "not a publication, no ceremony (DEC-143)");
  /* The behaviour, as the page's own script does it. */
  const w = pageWorld(home);
  w.el("slug").value = "River Keepers!";
  await w.el("go").click();
  assert.deepEqual(w.sent, [], "pressing the act sends nothing yet");
  assert.equal(w.el("confirm").open, true, "the full dialog opens");
  assert.equal(w.el("confirm-name").textContent, "river-keepers", "it names the short name typed, as it will be sent");
  await w.el("confirm-no").click();
  assert.deepEqual([w.sent, w.el("confirm").open, w.location.href], [[], false, null], "closing it sends nothing");
  await w.el("go").click();
  w.el("slug").value = "something-else";
  /* (T47, with R50) the confirming act draws "Before Cloudflare" and sends nothing; nothing sends /begin before it, and
     there "Continue to Cloudflare" sends it, with the name the dialog named. */
  await w.el("cloudflare").click();
  assert.deepEqual(w.sent, [], "nothing sends /begin before the dialog's confirming act");
  await w.el("confirm-yes").click();
  assert.deepEqual([w.sent, w.el("confirm").open, w.el("stage-choose").hidden, w.el("stage-before").hidden], [[], false, true, false],
    "the confirming act closes the dialog and draws Before Cloudflare, sending nothing");
  assert.equal(w.el("chosen-name").textContent, "river-keepers", "Before Cloudflare names the short name confirmed");
  await w.el("back").click();
  assert.deepEqual([w.sent, w.el("stage-choose").hidden, w.el("stage-before").hidden], [[], false, true], "Back sends nothing");
  w.el("slug").value = "River Keepers!";
  await w.el("go").click(); await w.el("confirm-yes").click();
  w.el("slug").value = "something-else";
  await w.el("cloudflare").click();
  assert.equal(w.sent.length, 1, "Continue to Cloudflare, after the confirming act, sends /begin once");
  assert.deepEqual([w.sent[0].url, w.sent[0].body.slug, w.sent[0].body.mode], ["/begin", "river-keepers", "install"], "the name the dialog named");
  assert.equal(w.location.href, "https://dash.cloudflare.com/oauth2/auth?x=1");
  /* A name too short opens nothing. */
  const short = pageWorld(home);
  short.el("slug").value = "ab";
  await short.el("go").click();
  assert.deepEqual([short.sent, short.el("confirm").open], [[], false]);
  /* The update chooses no short name: no weight, no dialog, /begin sent at once. */
  assert.ok(!upd.includes(word("weight.irreversible.name")) && !upd.includes('pips"') && !upd.includes("<dialog"), "the update page shows neither");
  const u = pageWorld(upd);
  u.el("slug").value = "river-keepers";
  await u.el("go").click();
  assert.deepEqual(u.sent.map((x) => [x.url, x.body.mode]), [["/begin", "update"]]);
});

test("R42 where the installer's pages and the invitation page say in one line what Civicsmith is, the line is exactly DEC-146's description, with its second line where there is room; no page says \"civic groups\" alone or \"and other organisations\"", async () => {
  /* The two lines are read by key (R72): `public-read`'s two, which the installer does not copy; this test compares the pages with
     `word` of the keys, so it goes red for no rewording of the design's. */
  const LINE = word("public-read.free_software_groups");
  const SECOND = word("public-read.neighborhood_issue_groups");
  assert.ok(hasWord("public-read.free_software_groups") && hasWord("public-read.neighborhood_issue_groups"));
  assert.deepEqual([DESCRIPTION, WHO], [LINE, SECOND]);
  const home = await text("/");
  for (const [where, page] of [["install page", home], ["invitation page", INVITATION]]) {
    assert.ok(page.includes(`<meta name="description" content="${LINE}">`), `${where}: its description`);
    assert.equal([...page.matchAll(/<p class="what">([^<]*)<\/p>/g)].map((m) => m[1]).join("|"), LINE, `${where}: the one line`);
    assert.equal([...page.matchAll(/<p class="small who">([^<]*)<\/p>/g)].map((m) => m[1]).join("|"), SECOND, `${where}: the second line`);
    /* The page's one-line descriptions before DEC-146 are gone. */
    assert.ok(!/accountability record|tamper-evident record/.test(page), where);
  }
  /* Every page this suite rendered, and the update page and a 404. */
  const pages = [home, await text(UPDATE_PATH), await text("/elsewhere"), ...RAW, ...PAGES, INVITATION];
  assert.ok(RAW.length > 40, "the pages this suite rendered");
  for (const page of pages) {
    const words = page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.equal(/\bcivic groups\b/i.test(words), false, words.match(/.{0,60}civic groups.{0,40}/i)?.[0]);
    assert.equal(/\band other organi[sz]ations\b/i.test(words), false, words.match(/.{0,60}other organi[sz]ations.{0,40}/i)?.[0]);
  }
});
