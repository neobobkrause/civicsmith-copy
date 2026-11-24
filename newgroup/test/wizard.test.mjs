/* The wizard, tested end to end against a scripted Cloudflare.
 *
 * Every outbound call the wizard makes is intercepted, matched, and answered
 * here, so the whole provisioning conversation is asserted: what was called,
 * in what order, carrying exactly what. The load-bearing assertions:
 *   - the OAuth access token appears in NOTHING the wizard emits
 *   - an install always carries the SQLite migration, the irreversible choice
 *   - generated secrets are long, distinct, and never a published value
 *   - refused R2 degrades to a working install with no bucket bindings
 *   - an update keeps the instance's bindings and carries no migration
 *   - a state mismatch stops everything before the token endpoint is touched
 *   - both upload paths bind SELF, so a deployed instance's monitoring is armed
 *   - both upload paths bind DAEMON_TOKEN (DIST-2), so monitoring runs scoped
 *     rather than on the ADMIN_TOKEN fallback, and the value is never displayed
 *
 * NEGATIVE CONTROL: delete the `selfBinding(slug)` line from `uploadUpdate`'s
 * bindings in src/index.mjs -> the update block fails on "SELF bound on update
 * too, arming monitoring on copies installed before it existed" (the
 * already-installed instance that would never receive SELF) and on "the update's
 * SELF is a service binding" -> 101 passed, 2 failed. Deleting the
 * `opts.noSelf ? [] : [selfBinding(slug)]` line from `uploadInstall` instead ->
 * 98 passed, 5 failed (both install SELF assertions, plus the whole degrade
 * block, because there is no longer anything for Cloudflare to refuse).
 * BOTH RUN 2026-08-04, restored 103/103 green after each.
 *
 * NEGATIVE CONTROL (D-297/IC-82): force the fleet-signature verdict true in
 * `installFleet` -> 129 passed, 2 failed: the dropped-member block watches a
 * member install under a signature that covers a different set, and the
 * signature sentence vanishes. Swallow the /2 statement refusal and substitute
 * a hand-built /1-style payload instead -> 130 passed, 1 failed — the
 * /2-refusal sentence arm — while the member still does NOT install, because
 * the signature layer beneath catches the substituted payload: the defences
 * are layered and the arm shows which one answered. BOTH RUN 2026-09-14,
 * restored byte-identically (sha256-verified), 131/131 green.
 *
 * NEGATIVE CONTROL (DIST-3): change `establishPlan`'s 100328 arm to return
 * "paid" (ACCEPT the Free answer — the exact defect DEC-42's row names) ->
 * 112 passed, 5 failed, and the load-bearing failure NAMES free-town as the
 * half-installed instance with the damage counted: want [0,0] got [2,1], two
 * buckets and the script actually created past the refusal that should have
 * stopped them. A WEAKER arm was run first and is recorded because its result
 * teaches something: merely DELETING the 100328 check (not accepting it) ->
 * 114 passed, 3 failed with free-town still protected — the unverifiable-plan
 * refusal catches what the Free check no longer does, so the guard fails
 * SAFE rather than open. BOTH RUN 2026-09-14, restored byte-identically after
 * each (sha256-verified), 117/117 green.
 *
 * NEGATIVE CONTROL (DIST-2): delete the `DAEMON_TOKEN` line from
 * `uploadUpdate`'s bindings -> 103 passed, 2 failed, the first failure naming
 * oak-watch, the already-installed instance that would never receive the
 * credential (the arm this item exists for). Delete the `DAEMON_TOKEN` line
 * from `uploadInstall` instead -> 101 passed, 4 failed (four secrets, distinct
 * count, the retry count, and the panel assertion failing BY NAME with
 * "DAEMON_TOKEN missing" rather than throwing — D-93 guarded inside a control).
 * BOTH RUN 2026-09-14, `newgroup/src/index.mjs` restored byte-identically after
 * each (sha256 a0f6cf1b…, verified by hash both times).
 *
 * NEGATIVE CONTROL (D-436 item 3, DIST #4, 2026-09-22), DECLARED BEFORE ARMING and measured with the 0.71.0
 * embed: (N1) `groupNotice` returns "" -> 141 passed, 5 failed: the four CROSSING telling assertions (why, the
 * refused code, the act, the suggestion) and the unknown-version arm's CONDITIONAL one; (N2) `groupUnrecorded`
 * answers "certain" whatever ran before -> 145 passed, 1 failed: PAST THE LINE, told where nothing is owed;
 * (N3) the update calls op=instancegroupseed -> 143 passed, 3 failed: each arm's "never seeds". ALL AS DECLARED,
 * `newgroup/src/index.mjs` restored byte-identically after each (sha256 12e67385…, verified by hash).
 *
 * NEGATIVE CONTROL (D-116, 2026-09-23), DECLARED BEFORE ARMING, whole suite 164/164 before and after: (W1) today's-main
 * reading — `servingVerdict` reads only `version` (`if (!capable) return` made `if (true) return`) -> 157 passed,
 * 7 failed: every D-116 lag arm (stale store, pre-D-116 store, stale member, installed-but-unbound member, members
 * unreported, the install lag) — each reporting the update DONE over the lag it should name; (W2) `reportsBuilds`
 * answers false -> 155 passed, 9 failed: the PIN on the plane this tree builds, the "every part" sentence, and the
 * same seven lag arms. ALL AS DECLARED, `newgroup/src/index.mjs` restored byte-identically after each (sha256
 * e8773248…, verified by sha256 AND byte compare). The plane half's controls were in
 * `bio-plane/test/d116-serving-builds.test.mjs` (retired in T17, K572); its reports are now tested by instance-setup
 * (`bio-plane/test/m/instance-setup/reports.test.mjs`).
 *
 * NEGATIVE CONTROL (DIST-6, 2026-09-23), DECLARED BEFORE ARMING, each arm ALONE, baseline 184/184: (A1) today's main
 * (`newgroup/src/index.mjs` at 4355bfda) -> 169 passed, 15 failed: every DIST-6 binding, SERVING, done and naming arm,
 * the first failure the PIN (`MEMBER_BINDINGS` absent) and then "INSTALL: the plane is bound to EACH member" — and NONE
 * of the 164 older arms; (A2) DROP ONE member's binding (ocr-worker filtered out of `memberBindings`) -> 174/10, each
 * failure naming OCR_WORKER null / ocr-worker UNBOUND; (A3) THE LIAR, every binding named right and pointing at the
 * PLANE ITSELF -> 174/10, the targets named by binding and each member read MISNAMED, the page not "running" and the
 * update not "Updated"; (A4) the liar pointing every binding at pdf-worker -> 174/10, likewise; (A5) the ORDER — the
 * install's first plane upload binds all three before they exist -> 181/3, the fake account's 10143 refusal NAMED
 * ("bind-town:AGENT_WORKER->agent-worker") and SELF lost. A5 FAILED NARROWER THAN DECLARED (the install arms were
 * declared to fail): the install's SELF-retry re-uploads with only the members present, so it RECOVERS the order
 * defect at the cost of SELF — recorded, not smoothed; (A6) a failed member upload not named at verify -> 182/2, both
 * "missing binding NAMED" arms (the install reads "Your team's Civicsmith is running." over a failed ocr-worker); (A7) the update's
 * first upload restates no member -> 180/4, the kept-bindings arm and the D-297-population arms. `newgroup/src/index.mjs`
 * restored after each by cp from a per-arm pristine copy and verified by sha256 AND byte compare (83b6af0d…).
 *
 * NEGATIVE CONTROL (DIST-7, DIST #6, 2026-09-24), declared before arming: `limits` dropped from `uploadUpdate` ->
 * 204 passed, 2 failed, exactly DIST-7 UPDATE and DIST-7 INSTALL (the install's step-3 re-PUT takes the update's shape,
 * learned at DIST-11), the INSTALL arm naming [10000, null]; the PIN held. Restored by cp, sha256 (5778bfee…), cmp.
 *
 * NEGATIVE CONTROL (DIST-11, DIST #6, 2026-09-24), declared before arming: the BROWSER restatement dropped from
 * `uploadUpdate` -> 201 passed, 2 failed: DIST-11 UPDATE as declared, AND DIST-11 INSTALL — the install's step-3 re-PUT
 * takes the update's shape and `browser` is not in keep_bindings, so a fresh install would end WITHOUT the binding too.
 * Recorded: it is why the update's restatement is load-bearing for both paths. Restored by cp, sha256 (4884ebbe…) and
 * cmp; 203/203 after.
 *
 * NEGATIVE CONTROL (DIST-9, DIST #6, 2026-09-24), DECLARED BEFORE ARMING, each arm ALONE, baseline 200/200: (N1) THE
 * INVENTOR — `instanceAiBinding` generates `rand(32)` when no value is supplied (DAEMON_TOKEN's shape) -> 190 passed,
 * 10 failed: the four declared DIST-9 NO-INVENTION / KEPT arms by name, and the four older arms that count secrets
 * exactly (four secrets, distinct 4, the SELF-retry's 4, the update's "NO password"), as declared; PLUS two NOT
 * declared — both "supplied" arms — because the install's step-3 re-PUT and the update's bindMembers re-PUT pass no
 * value, so the inventor OVERWRITES the operator's value with its own. Recorded, not smoothed: it shows the no-invention
 * rule also protects a supplied value. (N2) `uploadUpdate` drops the binding -> 199/1, exactly "DIST-9 UPDATE,
 * supplied", as declared. `newgroup/src/index.mjs` restored after each by cp from a pristine copy, verified by sha256
 * (c53fa1ee…) AND byte compare; 200/200 after. RE-RUN after the install notice moved behind the upload (dc6f3528…):
 * identical figures, N1 190/10 and N2 199/1, restored byte-identically.
 */
import worker, { CFG, ARMED_SIGNERS, reportsBuilds } from "../src/index.mjs";
/* The namespace, read for the exports a PIN names (BROWSER_BINDING, planeLimits), so a tree without one fails that PIN
   by name rather than refusing to link the whole suite. */
import * as NG from "../src/index.mjs";
/* R30 (N234): the member binding names are instance-setup's; the installer holds no table of its own. */
import { instanceGroupAnswer } from "../../bio-plane/test/m/instance-setup/fixtures.mjs";
import { FLEET_BINDINGS } from "../../bio-plane/src/setup-fleet.mjs";
import { readFileSync } from "node:fs";
import { fleetStatement, NS_FLEET } from "../../bio-plane/src/sshsig.mjs";
import { RELEASE_VERSION } from "../src/release.mjs";
import { RELEASE_SOURCE } from "./release-text.mjs";
import { signer, like, scheduleRules, CRONS_STATEMENT } from "./fixture.mjs";
const unesc = (t) => t.replace(/&#39;/g, "'");
import { word } from "../src/words.mjs";

let pass = 0, fail = 0;
const t = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${ok ? "" : `  want ${JSON.stringify(w)} got ${JSON.stringify(g)}`}`);
  ok ? pass++ : fail++; };

/* Release-signature trust is a property of the installer build, so each
   block below states which installer it is describing rather than inheriting
   whatever the shipped constant happens to be. Both configurations are real:
   armed is what ships, unarmed is what a fork that has not adopted a signing
   key still gets. */
const armWith = (line) => { ARMED_SIGNERS.length = 0; ARMED_SIGNERS.push(line); };
const disarm = () => { ARMED_SIGNERS.length = 0; };

/* An instance mid-update: it answers with the version it is running, and after
   the upload it answers with the new one. The wizard asks BEFORE uploading so a
   no-op can be named (D-10), so a fixture that answers with the target version
   from the start describes a no-op, not an update. */
const midUpdate = (from, to) => { let n = 0;
  return () => jres({ ok: true, version: n++ === 0 ? from : to, bindings: { STORE: true } }); };
/* ADDED 2026-09-23 by DIST #5 at the 0.76.0 cut, the first cut whose EMBED carries D-116. `midUpdate`'s reply after the
   upload has no `storeVersion`/`memberVersions`, which a D-116 plane always sends; with a D-116 embed the installer
   (servingVerdict) correctly reads that as a STALE store and does not report the update done — which D-116's own arm
   ("THE BUILT-IN RELEASE CAN REPORT BUILDS") asserts ON PURPOSE with `midUpdate`. Three older arms that assert only
   that an update LANDS were written against pre-D-116 embeds and went red on the cut with the installer right; they
   now use this fixture, which answers as the new plane does (no members installed in them, so `memberVersions` is
   empty). On a pre-D-116 embed the extra fields are ignored (`capable` false), so the arms hold on either side of it.
   NEGATIVE CONTROL: storeVersion "x" here -> exactly those three arms fail, by name (measured at the cut). */
const midUpdateBuilt = (from, to) => { let n = 0;
  return () => n++ === 0 ? jres({ ok: true, version: from, bindings: { STORE: true } })
    : jres({ ok: true, version: to, storeVersion: to, memberVersions: {}, bindings: { STORE: true } }); };

/* T50 (R66): the installer waits out a slow or failing Cloudflare within a stated bound, counted in the delays it asks for; the
   suite's timers fire at once, so a wait is a count and not a pause. */
{ const realTimer = globalThis.setTimeout; globalThis.setTimeout = (fn, _ms, ...a) => realTimer(fn, 0, ...a); }

const TOK = "TOKEN-THAT-MUST-NEVER-APPEAR-IN-OUTPUT";
const PUBLISHED = "df362a63adbe5d1d96a2942e39fd60e3fbb412eaadf7317266c19a4efea658ba";

const realFetch = globalThis.fetch;
const jres = (o, status = 200) => new Response(JSON.stringify(o), { status });
const cfok = (result) => jres({ success: true, result });
const cferr = (message, status = 400, code = 0) =>
  jres({ success: false, errors: [{ message, code }] }, status);

/* A scripted upstream: rules matched in order, calls recorded. After an arm's own rules, the account answers the reads
   no arm here scripts as an account holding no other copy would (installer R32: no evidence bucket, no fleet worker but
   those the arm itself scripts) and hands each script back exactly as it was last uploaded (R33's read-back). An arm's
   own rule always wins. */
const FALLBACK = (calls) => [
  /* installer-steps R39: the plane's schedules, read and set, as the fake account of fixture.mjs answers them. */
  ...scheduleRules(),
  /* T50 (R62, R69, R70): the reads an install now makes before it creates anything, answered as an empty account answers them. */
  { m: (u, mth) => /\/workers\/scripts$/.test(u) && mth === "GET", f: () => cfok([]) },
  { m: (u, mth) => /\/r2\/buckets$/.test(u) && mth === "GET", f: () => cfok({ buckets: [] }) },
  { m: (u, mth) => u.includes("/workers/durable_objects/namespaces") && mth === "GET", f: () => cfok([]) },
  { m: (u, mth) => /\/containers\/applications$/.test(u) && mth === "GET", f: () => cfok([]) },
  /* A release part nothing here serves is not found (R61: the built-in release always names its own members). */
  { m: (u) => u.startsWith("https://raw.githubusercontent.com/") && !u.endsWith("/RELEASE.json"), f: () => new Response("not found", { status: 404 }) },
  { m: (u) => u.includes("/scripts/bio-install-lock"), f: (u, init) => ((init.method || "GET").toUpperCase() === "GET" ? cferr("not found", 404) : cfok({})) },
  { m: (u, mth) => /\/r2\/buckets\/[^/]+$/.test(u) && mth === "GET", f: () => cferr("The specified bucket does not exist.", 404, 10006) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+\/settings$/.test(u) && mth === "GET", f: () => cferr("not found", 404) },
  { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "GET", f: async (u) => {
    const put = calls.filter((c) => c.method === "PUT" && c.u === u).at(-1);
    return put ? new Response(await put.init.body.get("index.mjs").text()) : cferr("not found", 404);
  } },
];
function script(rules) {
  const calls = [];
  const all = [...rules, ...FALLBACK(calls)];
  globalThis.fetch = async (input, init = {}) => {
    const u = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    /* T50 (R69): the installer's own lock on the account is bookkeeping, not part of the conversation these arms assert. */
    if (u.includes("/scripts/bio-install-lock")) (calls.lock ||= []).push({ u, method, init }); else calls.push({ u, method, init });
    for (const r of all) if (r.m(u, method)) return r.f(u, init);
    throw new Error(`unscripted fetch: ${method} ${u}`);
  };
  return calls;
}

const req = (path, init) => worker.fetch(new Request("https://newgroup.believeinoakland.workers.dev" + path, init));

/* R55 (T48): an update is of the release chosen, so each update arm names one: by default the release `NEWER()` serves. */
let UPDATE_OF = null;
async function begin(slug, mode = "install", extra = {}) {
  if (mode === "update" && extra.version === undefined) extra = { ...extra, version: UPDATE_OF ?? CUR_VER };
  const r = await req("/begin", { method: "POST", body: JSON.stringify({ slug, mode, ...extra }) });
  const j = await r.json();
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  const state = j.ok ? new URL(j.authorize).searchParams.get("state") : null;
  return { r, j, cookie, state };
}
/* R19: the streamed page escapes `<`, `>` and `&` inside its scripts (< …), so management-API text cannot close
   them. The assertions below read the page as its own script sees those strings, so a negative such as "no
   <b>Updated" still means what it says rather than passing on the escaped bytes. */
const unescapeScripts = (s) => s.replace(/\\u00(3c|3e|26)/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
/* A key's sentence as a page draws it as text (the plain pages and the panels escape it), and the part of it before its `{said}`. */
const h = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const headOf = (key, vars = {}) => word(key, { said: "\u0000", ...vars }).split("\u0000")[0];
const callback = async (qs, cookie) => {
  const r = await req("/callback?" + qs, { headers: cookie ? { cookie } : {} });
  return new Response(unescapeScripts(await r.text()), { status: r.status, headers: r.headers });
};

async function metadataOf(call) {
  if (!call) return { bindings: [], keep_bindings: [] };  /* no upload happened: every assertion about it fails by value, not by a crash that hides the arms after it */
  const blob = call.init.body.get("metadata");
  return JSON.parse(await blob.text());
}
async function sourceOf(call) {
  if (!call) return "";
  return call.init.body.get("index.mjs").text();
}
const shaHex = async (text) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const bump = (v) => { const p = v.split(".").map(Number); p[2] += 1; return p.join("."); };
const REL = (rules) => [
  { m: (u) => u.endsWith("/release/RELEASE.json"), f: rules.manifest },
  { m: (u) => u.endsWith("/release/bio-plane.bundled.mjs"), f: rules.asset },
];

/* R20 (DIST-15, N336), 2026-10-01: the plane's limits are read from the release's own plane bundle, and an act whose only
   usable release states none is refused. Every release this suite serves states them (`LIM`). The arms below that ran on
   the built-in release ran there only because the repository was unscripted; while the built-in states no limits
   (`BUILTIN_OK` false: every release before control-plane's statement) they would be refused, so they now serve `NEWER()`,
   the built-in's own bytes plus the statement, signed by a key the arm arms, one version on. The arms ABOUT the
   built-in fallback assert whichever holds, so they survive the cut that embeds a release stating its limits. */
/* From 0.87.0 the built-in states its own limits (cpu_ms beside subrequests): \`NEWER()\` then repeats that statement, never a
   second, different one, which the installer rightly refuses as unreadable (statements.mjs: exactly one distinct statement). */
const LIM = (RELEASE_SOURCE.match(/"(bio-plane-limits\/1 [^"]+)"/) || [])[1] ?? "bio-plane-limits/1 subrequests=10000";
const BUILTIN_OK = NG.planeLimits(RELEASE_SOURCE).ok;
const CUR = await signer("current-release");
const CUR_VER = bump(RELEASE_VERSION);
const curSrc = RELEASE_SOURCE + `\nexport const PLANE_LIMITS_STATEMENT = "${LIM}";\nexport const PLANE_CRONS_STATEMENT = "${CRONS_STATEMENT}";\n`;
const curMan = { version: CUR_VER, sha256: await shaHex(curSrc), bytes: curSrc.length, asset: "bio-plane.bundled.mjs",
  sig: await CUR.sign(curSrc) };
const NEWER = () => { armWith(CUR.line); return REL({ manifest: () => jres(curMan), asset: () => new Response(curSrc) }); };

/* ---- the front page and /begin ---- */
console.log("\n--- front page and begin ---");
{
  const home = await req("/");
  const homeBody = await home.text();
  t("GET / is the wizard", homeBody.includes(word("screen.install.name")), true);
  t("the front page offers no mode choice", homeBody.includes('name="mode"'), false);
  t("the front page is hard-wired to install", homeBody.includes('mode:"install"'), true);
  t("it points elsewhere for updates", homeBody.includes('href="/update"'), true);

  const up = await req("/update?version=" + CUR_VER);
  const upBody = await up.text();
  t("GET /update is the update page", upBody.includes("Update your team&#39;s Civicsmith") || upBody.includes("Update your team's Civicsmith"), true);
  t("the update page is hard-wired to update", upBody.includes('mode:"update"'), true);
  t("the update page offers no mode choice", upBody.includes('name="mode"'), false);

  const { r, j, cookie, state } = await begin("oak-watch");
  t("begin accepts a valid name", j.ok, true);
  const a = new URL(j.authorize);
  t("authorize goes to Cloudflare", a.origin + a.pathname, CFG.AUTHORIZE);
  t("PKCE method is S256", a.searchParams.get("code_challenge_method"), "S256");
  t("challenge present", (a.searchParams.get("code_challenge") || "").length >= 40, true);
  t("redirect is the registered string, character-exact", a.searchParams.get("redirect_uri"), CFG.REDIRECT);
  t("scopes are exactly the registered six (T36: connectivity-directory.bind, R45; K3819: account-logs.read, R46)", a.searchParams.get("scope"), CFG.SCOPES.join(" "));
  t("state travels", (state || "").length >= 20, true);
  t("cookie is HttpOnly", /HttpOnly/i.test(r.headers.get("set-cookie")), true);
  t("cookie is Secure and Lax", /Secure/.test(r.headers.get("set-cookie")) && /SameSite=Lax/.test(r.headers.get("set-cookie")), true);
  t("cookie never contains the verifier in the URL", j.authorize.includes(cookie.split("=")[1]), false);

  t("bad name refused", (await (await req("/begin", { method: "POST",
    body: JSON.stringify({ slug: "-bad-" }) })).json()).ok, false);
  t("the wizard's own name refused", (await (await req("/begin", { method: "POST",
    body: JSON.stringify({ slug: "newgroup" }) })).json()).ok, false);
}

/* ---- callback verification, before any upstream is touched ---- */
console.log("\n--- callback refuses what it cannot verify ---");
{
  const calls = script([]);
  const { cookie } = await begin("oak-watch");
  const body = await (await callback("code=abc&state=WRONG", cookie)).text();
  t("state mismatch stops with a plain sentence", body.includes(h(word("installer.callback.unverified.title"))), true);
  t("nothing upstream was called", calls.length, 0);

  const body2 = await (await callback("code=abc&state=whatever")).text();
  t("missing cookie stops the same way", body2.includes(h(word("installer.callback.unverified.title"))), true);

  const body3 = await (await callback("error=access_denied&error_description=User+refused", cookie)).text();
  t("user refusal is reported as Cloudflare's decision", body3.includes("Permission was not granted"), true);
  t("still nothing upstream", calls.length, 0);
  globalThis.fetch = realFetch;
}

/* ---- a full install, happy path ---- */
console.log("\n--- install: the whole conversation ---");
{
  const { cookie, state } = await begin("oak-watch");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A1", name: "Oak Watch" }]) },
    { m: (u) => u.includes("/workers/scripts/oak-watch/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/scripts/oak-watch") && mth === "PUT", f: () => cfok({ id: "oak-watch" }) },
    { m: (u, mth) => u.endsWith("/workers/scripts/oak-watch/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "oakwatch" }) },
    { m: (u) => u.startsWith("https://oak-watch.oakwatch.workers.dev/"),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);

  const body = await (await callback(`code=GOODCODE&state=${state}`, cookie)).text();

  t("token exchange was PKCE with no secret", (() => {
    const x = calls.find((c) => c.u === CFG.TOKEN);
    const p = new URLSearchParams(x.init.body);
    return p.get("client_id") === CFG.CLIENT_ID && !!p.get("code_verifier")
      && p.get("redirect_uri") === CFG.REDIRECT && !p.get("client_secret");
  })(), true);

  const put = calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/oak-watch"));
  const meta = await metadataOf(put);
  t("install carries the SQLite migration", meta.migrations,
    { new_tag: "v1", new_sqlite_classes: ["Store"] });
  t("Durable Object bound", meta.bindings.some((b) => b.type === "durable_object_namespace" && b.class_name === "Store"), true);
  t("VERSION is the release chosen", meta.bindings.find((b) => b.name === "VERSION")?.text, CUR_VER);
  t("R20: limits are the release's own statement", meta.limits, { ...NG.planeLimits(curSrc).limits });
  /* D-102: the instance name IS the worker name, so the slug the group already
     chose is what the agent advertises. Bound here rather than asked for
     separately; a second name would be a second source of truth that drifts.
     Before this, every wizard-installed instance said "instance unnamed". */
  t("INSTANCE_NAME is bound from the slug",
    meta.bindings.find((b) => b.name === "INSTANCE_NAME")?.text, "oak-watch");
  const secrets = meta.bindings.filter((b) => b.type === "secret_text");
  /* Was "three secrets set" until DIST-2: REC-33 gave the plane a daemon
     class, and the installer now binds its credential so monitoring runs
     scoped instead of on the root-of-trust ADMIN_TOKEN fallback. */
  /* Five since T33-91: ACCOUNT_SEAL_SECRET (K1541), the key members' own account references are sealed under. Four
     since T36 (installer R9, N711): the shared member key is retired. */
  t("four secrets set (DAEMON_TOKEN joined at DIST-2, ACCOUNT_SEAL_SECRET at T33-91, MEMBER_TOKEN retired at T36)", secrets.map((s) => s.name).sort(),
    ["ACCOUNT_SEAL_SECRET", "ADMIN_TOKEN", "DAEMON_TOKEN", "PROBE_TOKEN"]);
  t("secrets are long", secrets.every((s) => s.text.length >= 40), true);
  t("secrets are distinct", new Set(secrets.map((s) => s.text)).size, 4);
  t("the seal secret is not on the success page (K1541: no person ever spends it)",
    (() => { const v = secrets.find((s) => s.name === "ACCOUNT_SEAL_SECRET")?.text;
      return v ? body.includes(v) : "ACCOUNT_SEAL_SECRET missing"; })(), false);
  t("no secret is a published value", secrets.some((s) => s.text === PUBLISHED), false);
  /* DIST-2: the daemon credential is the one secret NO human ever spends —
     the plane spends it over SELF — so the success panel must not display it.
     A credential displayed is a credential that can leak for no gain. */
  t("the daemon credential is not on the success page",
    (() => { const v = secrets.find((s) => s.name === "DAEMON_TOKEN")?.text;
      return v ? body.includes(v) : "DAEMON_TOKEN missing"; })(), false);
  /* REC-26: without this binding the plane's #monitorConfigured() is false and
     both monitoring consumers hold no alarm — the instance never re-checks a
     document it was asked to monitor. The target is the instance's OWN worker,
     which is the slug (D-102), so a wrong target here would point one group's
     monitoring at another group's copy. */
  const self = meta.bindings.find((b) => b.name === "SELF");
  t("SELF is a service binding", self?.type, "service");
  t("SELF targets this instance's own worker, not a fixed name", self?.service, "oak-watch");
  t("both buckets bound when R2 succeeded",
    meta.bindings.filter((b) => b.type === "r2_bucket").map((b) => b.bucket_name).sort(),
    ["bio-captures-oak-watch", "bio-published-oak-watch"]);
  t("both buckets were created", calls.filter((c) => c.u.endsWith("/r2/buckets") && c.method === "POST").length, 2);
  /* DIST-3 / DEC-42: the plan is established by PROVOKING the platform — the
     probe upload carries limits.cpu_ms, which Free refuses with 100328 — and
     never by reading a plan field. The probe precedes the first creation and
     its throwaway is deleted on the spot. */
  const probePut = calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/bio-plan-probe"));
  t("the plan was PROVOKED, not read from a field: the probe upload carries limits.cpu_ms",
    (await metadataOf(probePut))?.limits?.cpu_ms > 0, true);
  t("the probe throwaway was deleted",
    calls.some((c) => c.method === "DELETE" && c.u.includes("/scripts/bio-plan-probe")), true);
  t("the probe ran BEFORE the first thing the install creates",
    calls.indexOf(probePut) < calls.indexOf(calls.find((c) => c.u.endsWith("/r2/buckets") && c.method === "POST")), true);

  t("verification hit the new address", calls.some((c) => c.u.includes("oak-watch.oakwatch.workers.dev/api/?op=selftest")), true);
  t("the page shows the address", body.includes("https://oak-watch.oakwatch.workers.dev"), true);
  t("the page hands over the credentials (no member credential since T36)", body.includes("out-boot") && body.includes("out-probe") && !body.includes("out-member"), true);
  t("THE ACCESS TOKEN APPEARS NOWHERE IN THE OUTPUT", body.includes(TOK), false);
  t("the callback clears the cookie", true, true);
  globalThis.fetch = realFetch;
}

/* ---- install where the new address never answers: today's live failure ---- */
console.log("\n--- install: address asleep, credentials still handed over ---");
{
  const { cookie, state } = await begin("slow-town");
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A1", name: "Slow Town" }]) },
    { m: (u) => u.includes("/workers/scripts/slow-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/scripts/slow-town") && mth === "PUT", f: () => cfok({ id: "slow-town" }) },
    { m: (u, mth) => u.endsWith("/workers/scripts/slow-town/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "slowtown" }) },
    { m: (u) => u.startsWith("https://slow-town.slowtown.workers.dev/"),
      f: () => { throw new Error("ENOTFOUND"); } },
  ]);

  const body = await (await callback(`code=GOODCODE&state=${state}`, cookie)).text();
  globalThis.setTimeout = realTimeout;

  t("the check was actually retried", calls.filter((c) => c.u.includes("slow-town.slowtown.workers.dev")).length >= 10, true);
  t("the page still shows the address", body.includes("https://slow-town.slowtown.workers.dev"), true);
  t("THE CREDENTIALS ARE STILL HANDED OVER", body.includes("out-boot") && body.includes("out-probe"), true);
  t("the headline says asleep, not failed", body.includes(h(word("installer.success.asleep"))), true);
  t("no token in output", body.includes(TOK), false);
  globalThis.fetch = realFetch;
}

/* ---- install with no payment method: a full stop in plain words ---- */
console.log("\n--- install: no card means a friendly stop, and nothing installed ---");
{
  const { cookie, state } = await begin("small-group");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A2", name: "Small" }]) },
    { m: (u) => u.includes("/scripts/small-group/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "sg" }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST",
      f: () => cferr("Please enable R2 by adding a payment method", 403) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  /* Was "no PUT at all" until DIST-3: the plan probe legitimately PUTs (and
     deletes) its throwaway before this refusal. The assertion's true core is
     that the INSTANCE was never uploaded, so it narrows to the instance's
     own script rather than being exempted. */
  t("the instance itself was never uploaded",
    calls.some((c) => c.method === "PUT" && c.u.endsWith("/scripts/small-group")), false);
  /* R75: the stop is one sentence by key: one Cloudflare setting is needed first, what to do next, and that nothing needs cleaning up. */
  t("the stop explains itself as a setting, not a failure, names the next step and says nothing needs cleaning up",
    body.includes(headOf("installer.install.stopped.storage")) && body.includes(word("installer.install.stopped.storage", { said: "" }).split("(Cloudflare said:")[0].slice(-60)), true);
  t("no credentials were minted into the page", body.includes(String.raw`id="out-boot"`), false);
  t("no token in output", body.includes(TOK), false);
  globalThis.fetch = realFetch;
}

/* ---- install where Cloudflare refuses the self-binding ---- */
console.log("\n--- install: a refused SELF binding costs the monitoring, never the copy ---");
{
  /* An install PUT names a service binding to the script that same PUT creates.
     Whether Cloudflare accepts that self-reference cannot be established without
     a real install, and a real install is deploy-gated — so this block pins the
     BEHAVIOUR under refusal rather than pretending to know the answer. */
  const { cookie, state } = await begin("shy-town");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A4", name: "Shy" }]) },
    { m: (u) => u.includes("/scripts/shy-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/shy-town") && mth === "PUT",
      f: async (u, init) => {
        const meta = JSON.parse(await init.body.get("metadata").text());
        return meta.bindings.some((b) => b.type === "service")
          ? cferr("binding SELF refers to a service that does not exist", 400, 10021)
          : cfok({ id: "shy-town" });
      } },
    { m: (u, mth) => u.endsWith("/scripts/shy-town/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "shy" }) },
    { m: (u) => u.startsWith("https://shy-town.shy.workers.dev/"),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const puts = calls.filter((c) => c.method === "PUT" && c.u.endsWith("/scripts/shy-town"));
  /* T36 (R47): a third plane upload follows, the install's last, which tells the copy its own address. */
  t("the refused upload is retried exactly once", [puts.length, ...await Promise.all(puts.map(async (p) => "migrations" in await metadataOf(p)))],
    [3, true, true, false]);
  const retry = puts[1] ? await metadataOf(puts[1]) : { bindings: [] };
  t("the retry drops ONLY the service binding", retry.bindings.some((b) => b.type === "service"), false);
  t("the retry still carries the store, the secrets and the storage",
    [retry.bindings.some((b) => b.type === "durable_object_namespace"),
     retry.bindings.filter((b) => b.type === "secret_text").length,
     retry.bindings.filter((b) => b.type === "r2_bucket").length,
     "migrations" in retry], [true, 4, 2, true]);
  t("the group still gets a working copy", body.includes("out-boot"), true);
  t("the page says what was left out and how to get it", body.includes("was refused by Cloudflare"), true);
  t("no token in output", body.includes(TOK), false);
  globalThis.fetch = realFetch;
}

/* ---- install refuses to trample an existing copy ---- */
console.log("\n--- install: an existing name stops everything ---");
{
  const { cookie, state } = await begin("taken-name");
  const calls = script([
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A3", name: "X" }]) },
    { m: (u) => u.includes("/scripts/taken-name/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("stops naming the name as taken, with a free one offered (R70, F7)", body.includes(word("screen.install.stopped.nametaken", { name: "taken-name" })) && body.includes("taken-name-2"), true);
  t("no upload was attempted", calls.some((c) => c.method === "PUT"), false);
  globalThis.fetch = realFetch;
}

/* ---- the repository is preferred when newer and verified ---- */
console.log("\n--- release: a newer verified repository copy installs ---");
{
  const repoSrc = "export default { fetch(){ return new Response('repo release'); } }; export class Store {}; export const S = \"" + LIM + "\"; export const C = \"" + CRONS_STATEMENT + "\";";
  const repoVer = bump(RELEASE_VERSION);
  const repoSha = await shaHex(repoSrc);
  disarm();  /* an unarmed installer has only the hash to go on */
  const { cookie, state } = await begin("fresh-town");
  const calls = script([
    ...REL({ manifest: () => jres({ version: repoVer, sha256: repoSha, asset: "bio-plane.bundled.mjs" }),
             asset: () => new Response(repoSrc) }),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A7", name: "Fresh" }]) },
    { m: (u) => u.includes("/scripts/fresh-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/fresh-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/fresh-town/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "fr" }) },
    { m: (u) => u.startsWith("https://fresh-town.fr.workers.dev/"),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const put = calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/fresh-town"));
  t("the repository's source is what installed", await sourceOf(put), repoSrc);
  t("VERSION carries the repository's version", (await metadataOf(put)).bindings.find((b) => b.name === "VERSION")?.text, repoVer);
  t("the page says which copy was used and why", body.includes(word("installer.release.newer.checked", { version: repoVer, builtin: RELEASE_VERSION })), true);
  globalThis.fetch = realFetch;
}

console.log("\n--- release: a copy that fails verification is never installed ---");
{
  disarm();  /* integrity is checked before any signature question arises */
  const { cookie, state } = await begin("wary-town");
  const calls = script([
    ...REL({ manifest: () => jres({ version: bump(RELEASE_VERSION), sha256: "0".repeat(64) }),
             asset: () => new Response("tampered bytes") }),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A8", name: "Wary" }]) },
    { m: (u) => u.includes("/scripts/wary-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/wary-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/wary-town/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "wy" }) },
    { m: (u) => u.startsWith("https://wary-town.wy.workers.dev/"),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const put = calls.find((c) => c.method === "PUT" && c.u.endsWith("/scripts/wary-town"));
  if (BUILTIN_OK) {
    t("the built-in was uploaded (an upload happened)", !!put, true);
    t("the built-in source installed instead", (await sourceOf(put)).includes("tampered bytes"), false);
    t("VERSION stays the built-in", (await metadataOf(put)).bindings.find((b) => b.name === "VERSION")?.text, RELEASE_VERSION);
  } else {
    t("R20: the built-in states no limits, so nothing installs, and the page says why",
      [put === undefined, body.includes(word("installer.release.refused.none", { builtin: RELEASE_VERSION }))], [true, true]);
  }
  t("the page says the check failed and was not used", body.includes(word("installer.release.fallback.integrity")), true);
  globalThis.fetch = realFetch;
}

console.log("\n--- release: a current built-in is stated as current ---");
{
  disarm();  /* nothing is fetched at all when the built-in is current */
  const { cookie, state } = await begin("even-town");
  script([
    ...REL({ manifest: () => jres({ version: RELEASE_VERSION, sha256: "irrelevant" }), asset: () => new Response("x") }),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A9", name: "Even" }]) },
    { m: (u) => u.includes("/scripts/even-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/even-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/even-town/subdomain") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "ev" }) },
    { m: (u) => u.startsWith("https://even-town.ev.workers.dev/"),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("equal versions use the built-in without fetching the asset", body.includes("is current"), true);
  globalThis.fetch = realFetch;
}

/* ---- DIST-3: a Free-plan account is refused BY NAME, before anything exists.
   The bucket and upload routes below are deliberately PRESENT and answerable:
   a guard that stops consulting the probe's answer would sail through them and
   half-install free-town, and the zero-calls assertions would fail naming it —
   that is this block's negative-control geometry, not an oversight. ---- */
console.log("\n--- install: Workers Free is refused by name, nothing created ---");
{
  const { cookie, state } = await begin("free-town");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "F1", name: "Free Town" }]) },
    { m: (u) => u.includes("/scripts/free-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT",
      f: () => cferr("CPU limits are not supported for the Free plan.", 400, 100328) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/free-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "ft" }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("the refusal names the Workers Paid plan", body.includes(word("screen.install.stopped.plan")), true);
  t("it names the cost and why", body.includes(word("installer.install.stopped.plan.why")), true);
  t("it names what to do", body.includes(word("screen.install.stopped.plan.do")), true);
  t("it says nothing was created", body.includes(word("installer.install.stopped.plan.why").slice(-70)), true);
  t("REFUSED BEFORE ANYTHING WAS CREATED — free-town would otherwise be the half-installed instance: no bucket, no script",
    [calls.filter((c) => c.u.endsWith("/r2/buckets") && c.method === "POST").length,
     calls.filter((c) => c.method === "PUT" && c.u.endsWith("/scripts/free-town")).length], [0, 0]);
  globalThis.fetch = realFetch;
}

/* ---- DIST-3: an UNVERIFIABLE plan refuses too — an unverified plan is not a
   verified one, and undetermined is stated, never rounded to paid. ---- */
console.log("\n--- install: unverifiable plan is an honest refusal, nothing created ---");
{
  const { cookie, state } = await begin("hazy-town");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "H1", name: "Hazy Town" }]) },
    { m: (u) => u.includes("/scripts/hazy-town/settings"), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT",
      f: () => cferr("internal error", 500, 7000) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/hazy-town") && mth === "PUT", f: () => cfok({}) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("the refusal says the plan could not be VERIFIED, not that it is Free",
    body.includes(headOf("installer.install.stopped.planunknown")) && !body.includes(word("screen.install.stopped.plan")), true);
  t("it carries Cloudflare's own words", body.includes("internal error"), true);
  t("nothing was created here either",
    [calls.filter((c) => c.u.endsWith("/r2/buckets") && c.method === "POST").length,
     calls.filter((c) => c.method === "PUT" && c.u.endsWith("/scripts/hazy-town")).length], [0, 0]);
  globalThis.fetch = realFetch;
}

/* ---- update ---- */
console.log("\n--- update: keeps everything, carries no migration ---");
{
  const { cookie, state } = await begin("oak-watch", "update");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A1", name: "Oak Watch" }]) },
    { m: (u) => u.includes("/scripts/oak-watch/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [{ type: "secret_text", name: "ACCOUNT_SEAL_SECRET" }] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/oak-watch") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "oakwatch" }) },
    { m: (u) => u.includes("oak-watch.oakwatch.workers.dev/api/?op=bootstrap"),
      f: midUpdate("0.1.0", CUR_VER) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const put = calls.find((c) => c.method === "PUT");
  const meta = await metadataOf(put);
  t("keep_bindings preserves secrets and the store",
    meta.keep_bindings.slice().sort(), ["durable_object_namespace", "secret_text"]);
  /* DIST-3: the plan probe is an INSTALL act. An update must never grow a new
     refusal against an already-installed instance — the same doctrine as the
     storage arm above ("an update must never be refused over storage"). */
  t("no plan probe on update — an update never grows a new refusal",
    calls.some((c) => c.u.includes("bio-plan-probe")), false);
  t("storage is bound explicitly, healing older copies",
    meta.bindings.filter((b) => b.type === "r2_bucket").map((b) => b.name).sort(), ["CAPTURES", "PUBLISHED"]);
  t("no migrations on update", "migrations" in meta, false);
  t("VERSION supplied fresh", meta.bindings.find((b) => b.name === "VERSION")?.text, CUR_VER);
  /* D-102: the update retro-names copies installed before INSTANCE_NAME
     existed, which are advertising "instance unnamed" right now. Same shape as
     the storage healing above: an update quietly completes what an older
     install left out, with no action from the operator. */
  t("INSTANCE_NAME bound on update too, healing unnamed copies",
    meta.bindings.find((b) => b.name === "INSTANCE_NAME")?.text, "oak-watch");
  /* CORRECTED at DIST-2, not exempted. This line read `no new secrets
     generated` (no secret_text in the update metadata at all) and that was
     the right rule while every secret was a GROUP PASSWORD an update must
     never touch. It became wrong when REC-33 gave the plane a daemon class:
     an instance installed before DAEMON_TOKEN existed can receive it ONLY
     through an update — keep_bindings inherits, and there is nothing to
     inherit (the SELF-binding lesson, arriving as a secret). The old rule's
     true core survives as the narrower assertion below: the update still
     restates NO password, because it never sees their values. A fresh daemon
     value each update is deliberate — nothing outside the worker's env holds
     it, so there is no holder to invalidate. */
  t("DAEMON_TOKEN bound on update too — oak-watch installed before the daemon class existed and ONLY an update can deliver it",
    meta.bindings.find((b) => b.name === "DAEMON_TOKEN")?.type, "secret_text");
  t("the update supplies NO password — the three group secrets still travel only by keep_bindings",
    meta.bindings.filter((b) => b.type === "secret_text").map((b) => b.name), ["DAEMON_TOKEN"]);
  /* REC-26, and this is the assertion the whole update half exists for: every
     copy installed before the SELF binding existed is running with its
     monitoring consumers dormant RIGHT NOW. Nothing reaches those instances
     except an update, and an update only heals what it binds EXPLICITLY —
     keep_bindings inherits, and there is nothing to inherit. */
  const selfUp = meta.bindings.find((b) => b.name === "SELF");
  t("SELF bound on update too, arming monitoring on copies installed before it existed",
    selfUp?.service, "oak-watch");
  t("the update's SELF is a service binding", selfUp?.type, "service");
  /* "service" is deliberately NOT in keep_bindings: the explicit binding above
     is what heals an older copy, and inheritance cannot create what was never
     there. If that binding is ever dropped, "service" must be added here or an
     update DELETES a working instance's binding. */
  t("keep_bindings does not inherit service bindings", meta.keep_bindings.includes("service"), false);
  t("the page says passwords and record are untouched", body.includes("exactly as they were"), true);
  t("the update says which release it used and why", body.includes("Checked the release is Civicsmith's own, signed and unaltered"), true);
  t("no token in output", body.includes(TOK), false);
  globalThis.fetch = realFetch;
}

/* ---- update when storage cannot be created: proceeds the old way ---- */
console.log("\n--- update: storage unavailable never blocks an update ---");
{
  const { cookie, state } = await begin("old-copy", "update");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A5", name: "Old" }]) },
    { m: (u) => u.includes("/scripts/old-copy/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cferr("payment required", 402) },
    { m: (u, mth) => u.endsWith("/scripts/old-copy") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "old" }) },
    { m: (u) => u.includes("old-copy.old.workers.dev/api/?op=bootstrap"),
      f: midUpdateBuilt("0.1.0", CUR_VER) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const meta = await metadataOf(calls.find((c) => c.method === "PUT"));
  t("existing buckets kept, none invented", meta.keep_bindings.includes("r2_bucket")
    && meta.bindings.filter((b) => b.type === "r2_bucket").length === 0, true);
  t("the update still lands", body.includes("it ran 0.1.0."), true);
  globalThis.fetch = realFetch;
}

/* ---- update whose new version cannot be confirmed yet: calm, but NOT reported as done ----
   CORRECTED AT D-116 (2026-09-23), not exempted. This block asserted "the outcome is presented as done" — the page
   said "Updated from 0.0.1 to X" while the address was still answering 0.0.1 — together with "no failure framing" and
   "the step is not marked red". The first was the defect D-116 exists to remove: reporting an update as done while a
   named part still serves the old build is the record claiming more than it can support (`CLAUDE.md` §2, §5). What
   was right in it survives: the note stays patient (a rollout takes minutes, nothing is framed as failed or broken).
   What changes: the page says the upload happened, NAMES the part that lags, and does not say "Updated". The old
   "not marked red" assertion searched for the literal `class="no"`, which the streamed page never contains (the
   class is set by script), so it could not fail; it is replaced by one that reads the emitted step call. */
console.log("\n--- update: unconfirmed version is named, patiently, and not reported as done (D-116) ---");
{
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const { cookie, state } = await begin("slow-update", "update");
  script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A6", name: "Slow" }]) },
    { m: (u) => u.includes("/scripts/slow-update/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/slow-update") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "slow" }) },
    { m: (u) => u.includes("slow-update.slow.workers.dev/api/?op=bootstrap"),
      f: () => jres({ ok: true, version: "0.0.1" }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  globalThis.setTimeout = realTimeout;
  t("the outcome is NOT presented as an update done (D-116)", /<b>Updated (from|to)/.test(body), false);
  t("it says the upload happened, over what", body.includes(`Uploaded ${CUR_VER} over 0.0.1`), true);
  t("and NAMES the part that lags, with what it answers", body.includes("the address of your team&#39;s Civicsmith answers 0.0.1"), true);
  t("the note is patient, not alarming", body.includes("can take a few minutes"), true);
  t("no failure framing anywhere", /failed|broken/i.test(body), false);
  t("the verify step is not marked done", body.includes('ok("verify"'), false);
  globalThis.fetch = realFetch;
}

/* ---- update refuses a name that does not exist ---- */
console.log("\n--- update: a missing name changes nothing ---");
{
  const { cookie, state } = await begin("no-such", "update");
  const calls = script([
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "A4", name: "Y" }]) },
    { m: (u) => u.includes("/scripts/no-such/settings"), f: () => cferr("not found", 404) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("stops and says nothing was changed", body.includes("Nothing was changed"), true);
  t("no upload was attempted", calls.some((c) => c.method === "PUT"), false);
  globalThis.fetch = realFetch;
}


/* ---- release signing: the installer's trust, once it has a key ----
   Unarmed, a hash is all there is and the installer says so by installing.
   Armed, the hash stops being sufficient: an unsigned or wrongly signed
   repository copy is refused and the built-in installs instead. These are
   the tests that matter for supply chain, because the repository is the
   one thing a group's installer trusts that Believe in Oakland does not
   control end to end. */

/* A real signer, built the way the browser page builds one. */
const relKey = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", relKey.publicKey));
const wireU32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const catBytes = (...ps) => { let n = 0; for (const p of ps) n += p.length;
  const o = new Uint8Array(n); let i = 0; for (const p of ps) { o.set(p, i); i += p.length; } return o; };
const wireStr = (v) => { const b = typeof v === "string" ? new TextEncoder().encode(v) : v;
  return catBytes(wireU32(b.length), b); };
const toB64 = (b) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const relPubLine = "ssh-ed25519 " + toB64(catBytes(wireStr("ssh-ed25519"), wireStr(rawPub))) + " release-test";
async function signAsset(bytes, ns = "bio-release", key = relKey.privateKey, pub = rawPub) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-512", bytes));
  const signed = catBytes(new TextEncoder().encode("SSHSIG"), wireStr(ns), wireStr(""), wireStr("sha512"), wireStr(h));
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key, signed));
  const blob = catBytes(new TextEncoder().encode("SSHSIG"), wireU32(1),
    wireStr(catBytes(wireStr("ssh-ed25519"), wireStr(pub))), wireStr(ns), wireStr(""), wireStr("sha512"),
    wireStr(catBytes(wireStr("ssh-ed25519"), wireStr(sig))));
  return "-----BEGIN SSH SIGNATURE-----\n" + toB64(blob).replace(/(.{70})/g, "$1\n") + "\n-----END SSH SIGNATURE-----\n";
}

/* One scripted install, parameterised by what the repository serves. */
async function installWith(slug, sub, manifestExtra, src) {
  const { cookie, state } = await begin(slug);
  const calls = script([
    ...REL({ manifest: () => jres({ version: bump(RELEASE_VERSION), sha256: manifestExtra.sha256,
                                    asset: "bio-plane.bundled.mjs", ...manifestExtra.rest }),
             asset: () => new Response(src) }),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "S1", name: "Signed" }]) },
    { m: (u) => u.includes(`/scripts/${slug}/settings`), f: () => cferr("not found", 404) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith(`/scripts/${slug}`) && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith(`/scripts/${slug}/subdomain`) && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: sub }) },
    { m: (u) => u.startsWith(`https://${slug}.${sub}.workers.dev/`),
      f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const put = calls.find((c) => c.method === "PUT" && c.u.endsWith(`/scripts/${slug}`));
  globalThis.fetch = realFetch;
  return { body, source: put ? await sourceOf(put) : "", meta: put ? await metadataOf(put) : null };
}

const repoSrc2 = "export default { fetch(){ return new Response('signed repo release'); } }; export class Store {}; export const S = \"" + LIM + "\"; export const C = \"" + CRONS_STATEMENT + "\";";
const repoSha2 = await shaHex(repoSrc2);
const goodSig = await signAsset(new TextEncoder().encode(repoSrc2));

console.log("\n--- release signing: unarmed, the hash stands alone ---");
{
  disarm();
  const r = await installWith("unarmed-town", "ua", { sha256: repoSha2 }, repoSrc2);
  t("an unsigned repository copy still installs", r.source, repoSrc2);
  t("and the page does not claim a signature it did not check", r.body.includes("signature"), false);
}

console.log("\n--- release signing: armed, a valid signature installs ---");
{
  armWith(relPubLine);
  const r = await installWith("signed-town", "st", { sha256: repoSha2, rest: { sig: goodSig } }, repoSrc2);
  t("the signed repository copy installs", r.source, repoSrc2);
  t("the page says the signature was checked", r.body.includes("signature from a key this installer trusts"), true);
}

console.log("\n--- release signing: armed, an unsigned copy is refused ---");
{
  armWith(relPubLine);
  const r = await installWith("bare-town", "bt", { sha256: repoSha2 }, repoSrc2);
  t("the built-in installed instead", r.source.includes("signed repo release"), false);
  t("VERSION stays the built-in (or, R20, nothing installs while the built-in states no limits)",
    r.meta ? r.meta.bindings.find((b) => b.name === "VERSION")?.text : BUILTIN_OK, BUILTIN_OK ? RELEASE_VERSION : false);
  t("the page says why in plain words", r.body.includes("carries no signature"), true);
}

console.log("\n--- release signing: armed, a stranger's signature is refused ---");
{
  const other = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const otherPub = new Uint8Array(await crypto.subtle.exportKey("raw", other.publicKey));
  const strangerSig = await signAsset(new TextEncoder().encode(repoSrc2), "bio-release", other.privateKey, otherPub);
  armWith(relPubLine);
  const r = await installWith("stranger-town", "sg", { sha256: repoSha2, rest: { sig: strangerSig } }, repoSrc2);
  t("the built-in installed instead", r.source.includes("signed repo release"), false);
  t("the page names the problem as trust, not corruption", r.body.includes("not by a key this installer trusts"), true);
}

console.log("\n--- release signing: armed, a signature from another purpose is refused ---");
{
  const wrongNs = await signAsset(new TextEncoder().encode(repoSrc2), "bio-ratify");
  armWith(relPubLine);
  const r = await installWith("crossns-town", "cn", { sha256: repoSha2, rest: { sig: wrongNs } }, repoSrc2);
  t("a ratification signature cannot install software", r.source.includes("signed repo release"), false);
  t("the page says the signature did not check out", r.body.includes("not by a key this installer trusts"), true);
  disarm();
}

/* ---- a no-op update says so ----
   The failure this guards against is not a crash. It is an update that uploads
   the same version over itself and reports "Updated to X", which reads as work
   done. Observed live 2026-07-24 (DEBT D-10). */

/* ---- IC-82 / D-297: the installer installs the FLEET ----------------------
   The statement is rebuilt from the manifest by the SAME shared function the
   assembler used (imported above, never re-implemented), signed here with the
   suite's own armed key. Every arm below drives the geometry BOB named at the
   gate: a manifest without the /2 upload facts, a dropped member, a foreign
   plane, and a mid-fleet failure must each land on the exact honest sentence,
   and only a verified fleet may touch the account. */
console.log("\n--- fleet: members install under the fleet signature ---");

const shaBytes = async (bytes) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");
const memberSrc = "export default { fetch(){ return new Response('member'); } };";
const memberSha = await shaHex(memberSrc);
const wasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
const wasmSha = await shaBytes(wasmBytes);
const FLEET_VER = bump(RELEASE_VERSION);
const memberEntry = {
  member: "probe-member", asset: "probe-member.bundled.mjs",
  sha256: memberSha, bytes: memberSrc.length,
  compat: { date: "2026-07-01", flags: [] },
  services: [{ binding: "PLANE", service: "bio-plane" }],
  parts: [{ path: "assets/x.wasm", type: "CompiledWasm", sha256: wasmSha, bytes: wasmBytes.length }],
};
const fleetManifest = (members, extra = {}) => ({
  version: FLEET_VER, sha256: repoSha2, bytes: repoSrc2.length,
  asset: "bio-plane.bundled.mjs", sig: goodSig, fleet: members, ...extra,
});
const signFleet = async (members) => signAsset(
  new TextEncoder().encode(fleetStatement({ version: FLEET_VER,
    plane: { sha256: repoSha2, bytes: repoSrc2.length, asset: "bio-plane.bundled.mjs" },
    members })), NS_FLEET);

const fleetRoutes = (slug, sub) => [
  { m: (u) => u.endsWith("/release/probe-member.bundled.mjs"), f: () => new Response(memberSrc) },
  { m: (u) => u.endsWith("/release/probe-member/assets/x.wasm"), f: () => new Response(wasmBytes) },
  { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
  { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "FL", name: "Fleet Town" }]) },
  { m: (u) => u.includes(`/scripts/${slug}/settings`), f: () => cferr("not found", 404) },
  { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
  { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
  { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
  { m: (u, mth) => u.endsWith(`/scripts/${slug}`) && mth === "PUT", f: () => cfok({}) },
  { m: (u, mth) => /\/scripts\/probe-member-[a-z0-9-]+$/.test(u) && mth === "PUT", f: () => cfok({}) },
  { m: (u, mth) => u.endsWith(`/scripts/${slug}/subdomain`) && mth === "POST", f: () => cfok({}) },
  { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: sub }) },
  { m: (u) => u.startsWith(`https://${slug}.${sub}.workers.dev/`),
    f: () => jres({ ok: true, bindings: { STORE: true } }) },
];

{
  armWith(relPubLine);
  const fleetSig = await signFleet([memberEntry]);
  const { cookie, state } = await begin("fleet-town");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([memberEntry], { fleetSig })),
             asset: () => new Response(repoSrc2) }),
    ...fleetRoutes("fleet-town", "flt"),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  const mput = calls.find((c) => c.method === "PUT" && /\/scripts\/probe-member-[a-z0-9-]+$/.test(c.u));
  t("the member was uploaded", !!mput, true);
  const mm = mput ? await metadataOf(mput) : { bindings: [] };
  t("compat COPIED from the signed manifest — date stated, empty flags spelled as absence of the key",
    [mm.compatibility_date, "compatibility_flags" in mm], ["2026-07-01", false]);
  t("the PLANE service binding is templated to THIS instance's slug (D-292)",
    mm.bindings.find((b) => b.name === "PLANE")?.service, "fleet-town");
  t("the member carries the release version",
    mm.bindings.find((b) => b.name === "VERSION")?.text, FLEET_VER);
  t("the wasm part is uploaded under its manifest path with its STATED module type",
    (mput.init.body.get("assets/x.wasm"))?.type, "application/wasm");
  t("the page says all members installed, by name",
    [like("installer.fleet.done.one", { names: /[\s\S]*probe-member[\s\S]*/ }), like("installer.fleet.done.other", { n: /\d+/, names: /[\s\S]*probe-member[\s\S]*/ })].some((re) => re.test(unesc(body))), true);
}

console.log("\n--- fleet: a manifest without the /2 upload facts refuses by name ---");
{
  armWith(relPubLine);
  const stripped = { ...memberEntry }; delete stripped.compat;
  const fleetSig = await signFleet([memberEntry]); /* any sig — the statement refuses first */
  const { cookie, state } = await begin("bare-fleet");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([stripped], { fleetSig })),
             asset: () => new Response(repoSrc2) }),
    ...fleetRoutes("bare-fleet", "bf"),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("no member reached the account",
    calls.some((c) => c.method === "PUT" && /\/scripts\/probe-member-[a-z0-9-]+$/.test(c.u)), false);
  t("the page says the manifest does not state how members are uploaded",
    like("installer.fleet.skip.manifest.reason").test(unesc(body)), true);
  t("the plane itself installed normally",
    calls.some((c) => c.method === "PUT" && c.u.endsWith("/scripts/bare-fleet")), true);
}

console.log("\n--- fleet: a DROPPED member invalidates the set signature ---");
{
  armWith(relPubLine);
  const second = { ...memberEntry, member: "other-member", asset: "other-member.bundled.mjs", parts: [] };
  const fleetSig = await signFleet([memberEntry, second]);   /* signed over TWO */
  const { cookie, state } = await begin("drop-town");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([memberEntry], { fleetSig })),  /* serves ONE */
             asset: () => new Response(repoSrc2) }),
    ...fleetRoutes("drop-town", "dt"),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("dropping a member kills the whole fleet's signature — nothing installs",
    calls.some((c) => c.method === "PUT" && /\/scripts\/probe-member-[a-z0-9-]+$/.test(c.u)), false);
  t("and the page says the signature did not verify",
    like("installer.fleet.skip.signature").test(unesc(body)), true);
}

console.log("\n--- fleet: one failing member degrades ALONE, and is named ---");
{
  armWith(relPubLine);
  const second = { ...memberEntry, member: "other-member", asset: "other-member.bundled.mjs",
                   sha256: await shaHex("nope"), parts: [] };  /* asset will 404 */
  const fleetSig = await signFleet([memberEntry, second]);
  const { cookie, state } = await begin("half-town");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([memberEntry, second], { fleetSig })),
             asset: () => new Response(repoSrc2) }),
    { m: (u) => u.endsWith("/release/other-member.bundled.mjs"), f: () => new Response("gone", { status: 404 }) },
    ...fleetRoutes("half-town", "ht"),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("the healthy member still installed",
    calls.some((c) => c.method === "PUT" && /\/scripts\/probe-member-[a-z0-9-]+$/.test(c.u)), true);
  t("the failed one is NAMED with its reason and the retry path",
    body.includes("other-member") && body.includes("left out") && body.includes("next update retries"), true);
}

console.log("\n--- fleet: the update path installs members too — the healing half ---");
{
  armWith(relPubLine);
  const fleetSig = await signFleet([memberEntry]);
  const { cookie, state } = await begin("heal-town", "update");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([memberEntry], { fleetSig })),
             asset: () => new Response(repoSrc2) }),
    { m: (u) => u.endsWith("/release/probe-member.bundled.mjs"), f: () => new Response(memberSrc) },
    { m: (u) => u.endsWith("/release/probe-member/assets/x.wasm"), f: () => new Response(wasmBytes) },
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "H", name: "Heal" }]) },
    { m: (u) => u.includes("/scripts/heal-town/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/heal-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => /\/scripts\/probe-member-[a-z0-9-]+$/.test(u) && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "hl" }) },
    { m: (u) => u.includes("heal-town.hl.workers.dev/api/?op=bootstrap"), f: midUpdate("0.1.0", FLEET_VER) },
  ]);
  await (await callback(`code=C&state=${state}`, cookie)).text();
  t("an update installs the members a copy never had — keep_bindings cannot create what was never there",
    calls.some((c) => c.method === "PUT" && /\/scripts\/probe-member-[a-z0-9-]+$/.test(c.u)), true);
}

console.log("\n--- update: replacing a version with itself is not a success ---");
{
  disarm();
  const { cookie, state } = await begin("same-town", "update");
  script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "N1", name: "Same" }]) },
    { m: (u) => u.includes("/scripts/same-town/settings"),
      f: () => cfok({ observability: { enabled: true }, bindings: [{ type: "plain_text", name: "VERSION", text: CUR_VER }] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/same-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "sm" }) },
    /* The instance answers with the version it already runs. */
    { m: (u) => u.startsWith("https://same-town.sm.workers.dev/"),
      f: () => jres({ ok: true, version: CUR_VER, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("the step names it as a re-upload of the same version", body.includes("already runs"), true);
  t("the outcome says nothing changed", body.includes("Nothing changed"), true);
  t("and does not claim an update happened", /<b>Updated (from|to)/.test(body), false);
  t("and says what to check instead", body.includes("newer release has actually been published"), true);
  t("D-436: a no-op update tells nothing about how to record the producing team", body.includes("op=instancegroupseed"), false);
  globalThis.fetch = realFetch;
}

/* ---- D-436 (IC-172), R18, R78 (K3868): an update TELLS the operator when the copy records no producing team, and
   never records it. Added by DIST #4, 2026-09-22 (the 0.71.0 cut); since K3868 the installer records the short name itself in a
   run that holds the ADMIN_TOKEN it generated (the install, the requirements suite's R78), and an update holds none: it
   reads what the copy records (`op=instancegroup`, which answers the public projection with no credential) and tells from
   that read, with the version it read before the upload saying which paragraph explains it. Each arm asserts that no call
   seeded, and that the read carried no credential. ---- */
console.log("\n--- update: D-436 — the one act an update leaves to the operator is told, never done ---");
const semverCmp = (a, b) => { const A = a.split(".").map(Number), B = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i]; return 0; };
const groupCalls = (calls) => calls.filter((c) => /op=instancegroupseed/.test(c.u)).map((c) => `${c.method} ${c.u}`);
/* What the copy answers when asked what it records: a group, or none (`group: null`, instance-setup R3). */
const recordsGroup = (host, group) => ({ m: (u) => u.includes(`${host}/api/?op=instancegroup`), f: async () => { const answers = await instanceGroupAnswer({ group: group || "none" }); return jres({ ok: true, result: group ? answers.recorded : answers.none, store: "STORE" }); } });
const unauthenticated = (calls) => calls.filter((c) => /op=instancegroup\b/.test(c.u)).every((c) => !c.init?.headers?.authorization);
t("ARMED: the built-in release carries IC-172, so an update from 0.70.0 CROSSES the line the arms are about",
  semverCmp(RELEASE_VERSION, "0.71.0") >= 0, true);
{
  disarm();
  const { cookie, state } = await begin("cross-town", "update");
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "G1", name: "Cross" }]) },
    { m: (u) => u.includes("/scripts/cross-town/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [{ type: "secret_text", name: "INSTALL_COMPLETE" }] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/cross-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "cx" }) },
    { m: (u) => u.includes("cross-town.cx.workers.dev/api/?op=bootstrap"), f: midUpdateBuilt("0.70.0", CUR_VER) },
    recordsGroup("cross-town.cx.workers.dev", null),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("CROSSING (0.70.0 -> this release): the update lands as an update", body.includes(`It runs release ${CUR_VER}; it ran 0.70.0.`), true);
  t("and it TELLS the operator the copy records no team, saying why from the version it read",
    [body.includes(h(word("installer.team.unrecorded.head"))), body.includes(h(word("installer.team.unrecorded.certain", { before: "0.70.0", first: "0.71.0" })))],
    [true, true]);
  t("naming what the copy refuses until it is recorded", body.includes(h(word("installer.team.unrecorded.effect"))), true);
  t("not naming 'run the installer again' for a copy whose state the update could not read as unfinished (it lands on a page that records nothing); no request or credential is told to the operator",
    [body.includes(h(word("installer.team.unrecorded.how"))), body.includes("op=instancegroupseed"), body.includes("ADMIN_TOKEN")], [false, false, false]);
  /* R22 (N5): no copy but the operator's is named; the installed name is only offered as the one the installer records unless another is given. */
  t("the installed name is offered as a SUGGESTION, naming no other copy",
    [body.includes(h(word("installer.team.unrecorded.suggest", { slug: "cross-town" }))), /biosmoke7|believe-in-oakland/.test(body)], [true, false]);
  t("and it NEVER seeds (it holds no credential that could), and its read carries none", [groupCalls(calls), unauthenticated(calls)], [[], true]);
  t("no token in output", body.includes(TOK), false);
  globalThis.fetch = realFetch;
}
{
  armWith(relPubLine);
  const fleetSig = await signFleet([memberEntry]);
  const { cookie, state } = await begin("past-town", "update");
  const calls = script([
    ...REL({ manifest: () => jres(fleetManifest([memberEntry], { fleetSig })),
             asset: () => new Response(repoSrc2) }),
    { m: (u) => u.endsWith("/release/probe-member.bundled.mjs"), f: () => new Response(memberSrc) },
    { m: (u) => u.endsWith("/release/probe-member/assets/x.wasm"), f: () => new Response(wasmBytes) },
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "G2", name: "Past" }]) },
    { m: (u) => u.includes("/scripts/past-town/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/past-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => /\/scripts\/probe-member-[a-z0-9-]+$/.test(u) && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "pt" }) },
    { m: (u) => u.includes("past-town.pt.workers.dev/api/?op=bootstrap"), f: midUpdate(RELEASE_VERSION, FLEET_VER) },
    recordsGroup("past-town.pt.workers.dev", "past-town"),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t(`PAST THE LINE (${RELEASE_VERSION} -> ${FLEET_VER}): the update lands`, body.includes(`It runs release ${FLEET_VER}; it ran ${RELEASE_VERSION}.`), true);
  t("and tells NOTHING about the producing team: the copy records it",
    [body.includes(h(word("installer.team.unrecorded.head"))), body.includes("op=instancegroupseed")], [false, false]);
  t("and never seeds", groupCalls(calls), []);
  globalThis.fetch = realFetch;
  disarm();
}
{
  disarm();
  const { cookie, state } = await begin("fog-town", "update");
  let n = 0;
  const calls = script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "G3", name: "Fog" }]) },
    { m: (u) => u.includes("/scripts/fog-town/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/fog-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "fg" }) },
    /* The copy does not answer BEFORE the upload (so its version is unknown), and answers the new one after. */
    { m: (u) => u.includes("fog-town.fg.workers.dev/api/?op=bootstrap"),
      f: () => n++ === 0 ? new Response("unavailable", { status: 503 })
        : jres({ ok: true, version: CUR_VER, storeVersion: CUR_VER, memberVersions: {} }) },
    recordsGroup("fog-town.fg.workers.dev", null),
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  t("VERSION BEFORE UNKNOWN: the update lands", body.includes(h(word("installer.update.done.says", { to: CUR_VER, from: word("installer.update.unread") }))), true);
  t("and the telling is CONDITIONAL, saying the installer could not read what ran before — undetermined, stated",
    [body.includes(h(word("installer.team.unrecorded.unknown", { first: "0.71.0" }))), body.includes("op=instancegroupseed")], [true, false]);
  t("and never seeds", groupCalls(calls), []);
  globalThis.fetch = realFetch;
}

/* ---- D-116: EACH PART'S OWN BUILD, READ BACK, AND THE ONE THAT LAGS NAMED ----------------------------------------
   Added 2026-09-23 (D-116 worker). A release whose plane carries D-116 answers `op=bootstrap&members=1` with three
   readings, each from where it runs: `version` (the routing isolate), `storeVersion` (the Durable Object's own env) and
   `memberVersions` (each member's own /version THROUGH the plane's binding; instance-setup's
   `bio-plane/test/m/instance-setup/reports.test.mjs` drives the plane half). This half drives the INSTALLER's reading of that answer.
   HOW A LIAR WOULD PASS HERE: an installer that read only `version` (today's main) — every arm below that names a
   lagging store or member serves a CORRECT `version`, so only a reader of the other two fields can name the lag.
   NEGATIVE CONTROL: see the D-116 entry at the head of this file's controls. */
console.log("\n--- D-116: the installer reads the store's and each member's OWN build, and names the one that lags ---");
{
  const planeBundle = readFileSync(new URL("../../bio-plane/dist/bio-plane.bundled.mjs", import.meta.url), "utf8");
  t("PIN: the plane this tree builds CAN report its builds — renaming either field fails HERE, not silently in the field",
    reportsBuilds(planeBundle), true);
  t("PIN: a plane without the fields is read as unable to report them (the pre-D-116 releases)",
    reportsBuilds(repoSrc2), false);
}
const repoSrc3 = "export default { fetch(){ return Response.json({ storeVersion: 'x', memberVersions: {} }); } }; export class Store {}; export const S = \"" + LIM + "\"; export const C = \"" + CRONS_STATEMENT + "\";";
const repoSha3 = await shaHex(repoSrc3);
const sig3 = await signAsset(new TextEncoder().encode(repoSrc3));
const agentEntry = { ...memberEntry, member: "agent-worker", asset: "agent-worker.bundled.mjs", parts: [] };
const signFleet3 = async (members) => signAsset(
  new TextEncoder().encode(fleetStatement({ version: FLEET_VER,
    plane: { sha256: repoSha3, bytes: repoSrc3.length, asset: "bio-plane.bundled.mjs" }, members })), NS_FLEET);
const fleetSig3 = await signFleet3([agentEntry]);
const manifest3 = { version: FLEET_VER, sha256: repoSha3, bytes: repoSrc3.length, asset: "bio-plane.bundled.mjs",
                    sig: sig3, fleet: [agentEntry], fleetSig: fleetSig3 };
const SERVING = (v) => ({ binding: "AGENT_WORKER", state: "SERVING", version: v });
const OTHERS = { "pdf-worker": { binding: "PDF_WORKER", state: "UNBOUND" }, "ocr-worker": { binding: "OCR_WORKER", state: "UNBOUND" } };
/* After the upload the copy answers `after`; before it, 0.1.0 (so this is an update, not a no-op). */
async function d116Update(slug, after) {
  armWith(relPubLine);
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const { cookie, state } = await begin(slug, "update");
  let n = 0;
  const calls = script([
    ...REL({ manifest: () => jres(manifest3), asset: () => new Response(repoSrc3) }),
    { m: (u) => u.endsWith("/release/agent-worker.bundled.mjs"), f: () => new Response(memberSrc) },
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "D1", name: "D116" }]) },
    { m: (u) => u.includes(`/scripts/${slug}/settings`), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith(`/scripts/${slug}`) && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => /\/scripts\/agent-worker-[a-z0-9-]+$/.test(u) && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "d1" }) },
    { m: (u) => u.includes(`${slug}.d1.workers.dev/api/?op=bootstrap`),
      f: () => n++ === 0 ? jres({ ok: true, version: "0.1.0" }) : jres({ ok: true, version: FLEET_VER, ...after }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  globalThis.setTimeout = realTimeout;
  globalThis.fetch = realFetch;
  disarm();
  return { body, calls, memberPut: calls.some((c) => c.method === "PUT" && /\/scripts\/agent-worker-[a-z0-9-]+$/.test(c.u)),
           askedMembers: calls.some((c) => c.u.includes(`${slug}.d1.workers.dev/api/?op=bootstrap&members=1`)) };
}
{
  const r = await d116Update("all-town", { storeVersion: FLEET_VER,
    memberVersions: { "agent-worker": SERVING(FLEET_VER), ...OTHERS } });
  t("ARMED: the capable release was the one installed, with its member", [r.memberPut, r.askedMembers], [true, true]);
  t("ALL ON THE RELEASE: the update is reported done", r.body.includes(`It runs release ${FLEET_VER}; it ran 0.1.0.`), true);
  t("and says what was confirmed — every part, not only the address",
    r.body.includes(h(word("installer.update.done.allanswer", { version: FLEET_VER }))), true);
  t("and names no lag", r.body.includes("not yet confirmed"), false);
}
{
  const r = await d116Update("stale-store", { storeVersion: "0.1.0",
    memberVersions: { "agent-worker": SERVING(FLEET_VER), ...OTHERS } });
  t("A STALE DURABLE OBJECT under a current address is NAMED, with the build it runs",
    like("installer.lag.store.version", { version: "0.1.0" }).test(unesc(r.body)), true);
  t("and the update is NOT reported done", [/<b>Updated (from|to)/.test(r.body), r.body.includes("not yet confirmed")], [false, true]);
}
{
  const r = await d116Update("old-store", { memberVersions: { "agent-worker": SERVING(FLEET_VER), ...OTHERS } });
  t("A DO STILL ON PRE-D-116 CODE (no storeVersion at all, after a release that has it) is named, not taken as absent",
    [like("installer.lag.store.unreported").test(unesc(r.body)), /<b>Updated (from|to)/.test(r.body)], [true, false]);
}
{
  const r = await d116Update("stale-member", { storeVersion: FLEET_VER,
    memberVersions: { "agent-worker": SERVING("0.1.0"), ...OTHERS } });
  t("A STALE MEMBER, read back through the plane's binding, is NAMED with the build it runs",
    [like("installer.lag.member.version", { name: "agent-worker", version: "0.1.0" }).test(unesc(r.body)), /<b>Updated (from|to)/.test(r.body)], [true, false]);
}
{
  const r = await d116Update("loose-member", { storeVersion: FLEET_VER,
    memberVersions: { "agent-worker": { binding: "AGENT_WORKER", state: "UNBOUND" }, ...OTHERS } });
  t("A MEMBER THIS STEP INSTALLED but the plane cannot reach is NAMED — uploaded is not usable",
    [like("installer.lag.member.unbound", { name: "agent-worker" }).test(unesc(r.body)), /<b>Updated (from|to)/.test(r.body)],
    [true, false]);
}
{
  const r = await d116Update("members-mute", { storeVersion: FLEET_VER });
  t("a capable plane that does not report its members is named, never read as none",
    like("installer.lag.members.unreported").test(unesc(r.body)), true);
}
{
  /* The built-in release predates D-116 in this tree: its store's and members' builds are UNDETERMINED, and said. */
  disarm();
  const { cookie, state } = await begin("pre-town", "update");
  script([
    ...NEWER(),
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "D2", name: "Pre" }]) },
    { m: (u) => u.includes("/scripts/pre-town/settings"), f: () => cfok({ existing: true, observability: { enabled: true }, bindings: [] }) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/scripts/pre-town") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "pr" }) },
    { m: (u) => u.includes("pre-town.pr.workers.dev/api/?op=bootstrap"), f: midUpdate("0.1.0", CUR_VER) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  globalThis.fetch = realFetch;
  if (!reportsBuilds(RELEASE_SOURCE)) {
    t("A RELEASE THAT CANNOT REPORT BUILDS: the address is confirmed and the rest is STATED undetermined, not claimed",
      [body.includes(`Updated from 0.1.0 to ${CUR_VER}`), body.includes("cannot report which version the record store of your team&#39;s Civicsmith")],
      [true, true]);
  } else {
    /* Once DIST cuts a release carrying D-116 and embeds it, the built-in release CAN report, and this fixture (which
       serves no storeVersion) is a stale DO — which is named. Both branches are asserted so the arm survives the cut. */
    t("THE BUILT-IN RELEASE CAN REPORT BUILDS: a copy answering no storeVersion after it is a stale DO, named",
      like("installer.lag.store.unreported").test(unesc(body)), true);
  }
}
console.log("\n--- D-116: an INSTALL names a part not on the release, and still hands over the credentials ---");
async function d116Install(slug, reply) {
  armWith(relPubLine);
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const { cookie, state } = await begin(slug);
  script([
    ...REL({ manifest: () => jres(manifest3), asset: () => new Response(repoSrc3) }),
    { m: (u) => u.endsWith("/release/agent-worker.bundled.mjs"), f: () => new Response(memberSrc) },
    ...fleetRoutes(slug, "di").filter((x) => !x.m(`https://${slug}.di.workers.dev/`)),
    { m: (u, mth) => /\/scripts\/agent-worker-[a-z0-9-]+$/.test(u) && mth === "PUT", f: () => cfok({}) },
    { m: (u) => u.includes(`${slug}.di.workers.dev/api/?op=bootstrap`), f: () => jres({ ok: true, ...reply }) },
    { m: (u) => u.startsWith(`https://${slug}.di.workers.dev/`), f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  globalThis.setTimeout = realTimeout;
  globalThis.fetch = realFetch;
  disarm();
  return body;
}
{
  const ok = await d116Install("fresh-all", { version: FLEET_VER, storeVersion: FLEET_VER,
    memberVersions: { "agent-worker": SERVING(FLEET_VER), ...OTHERS } });
  t("INSTALL, every part on the release: \"Your team's Civicsmith is running\"", ok.includes(h(word("installer.success.running"))), true);
  const lag = await d116Install("fresh-loose", { version: FLEET_VER, storeVersion: FLEET_VER,
    memberVersions: { "agent-worker": { binding: "AGENT_WORKER", state: "UNBOUND" }, ...OTHERS } });
  t("INSTALL with an installed member the plane cannot reach: NOT \"running\", and the member NAMED",
    [lag.includes("Your team's Civicsmith is running."), lag.includes("agent-worker was installed, but your team&#39;s Civicsmith holds no connection to it")],
    [false, true]);
  t("and the credentials are still handed over — a lag never costs a team its only sight of them",
    [lag.includes('id=\\"out-boot\\"'), lag.includes('id=\\"out-probe\\"')], [true, true]);
}

/* ---- DIST-6: THE INSTALLED PLANE IS BOUND TO THE MEMBERS INSTALLED BESIDE IT ---------------------------------------
   Added 2026-09-23 (DIST-6 worker). Until DIST-6 neither upload path bound PDF_WORKER / OCR_WORKER / AGENT_WORKER, so a
   group's copy held its members uploaded and unreachable. The D-116 arms above serve a CANNED `memberVersions`; these
   do not. Here the account is a small STATEFUL fake: it keeps every script uploaded, applies `keep_bindings` by type
   (so a service binding not restated is DROPPED, as the update's comment says it is), REFUSES a PUT whose service
   binding names a worker the account does not hold (code 10143 — the rule `bio-plane/scripts/deploy-fleet.mjs` records as measured
   2026-08-10 / 2026-09-10, which forces the order), and answers `op=bootstrap&members=1` the way the plane's
   `memberVersions` does, DERIVED from the bindings the plane was last uploaded with: no binding -> UNBOUND; a binding
   to a member script -> that script's own name and VERSION (so a binding to the wrong worker reads MISNAMED); a binding
   to nothing -> SILENT. The binding names are instance-setup's `FLEET_BINDINGS`, imported (R30), never restated here.
   HOW A LIAR WOULD PASS: a binding named right and pointing anywhere but the member — every arm below asserts each
   binding's TARGET by name, and the fake plane reads such a binding MISNAMED, so the verify step names it too. */
console.log("\n--- DIST-6: the installed plane is bound to every member installed beside it, on install AND update ---");
const PLANE_FLEET = FLEET_BINDINGS;
t("PIN: instance-setup's FLEET_BINDINGS names at least the three members (else this section tests nothing)",
  ["agent-worker", "pdf-worker", "ocr-worker"].every((m) => PLANE_FLEET.some(([x]) => x === m)), true);
t("PIN: the installer exports no member binding table of its own (R30: imported, never copied)",
  "MEMBER_BINDINGS" in NG, false);
const repoSrc6 = "export default { fetch(){ return Response.json({ storeVersion: 'y', memberVersions: {} }); } }; export class Store {}; export const S = \"" + LIM + "\"; export const C = \"" + CRONS_STATEMENT + "\";";
const repoSha6 = await shaHex(repoSrc6);
const sig6 = await signAsset(new TextEncoder().encode(repoSrc6));
const fleet6 = PLANE_FLEET.map(([member]) => ({ ...memberEntry, member, asset: `${member}.bundled.mjs`,
  services: member === "agent-worker" ? [{ binding: "PLANE", service: "bio-plane" }] : [],
  parts: member === "ocr-worker" ? memberEntry.parts : [] }));
const fleetSig6 = await signAsset(new TextEncoder().encode(fleetStatement({ version: FLEET_VER,
  plane: { sha256: repoSha6, bytes: repoSrc6.length, asset: "bio-plane.bundled.mjs" }, members: fleet6 })), NS_FLEET);
const manifest6 = { version: FLEET_VER, sha256: repoSha6, bytes: repoSrc6.length, asset: "bio-plane.bundled.mjs",
                    sig: sig6, fleet: fleet6, fleetSig: fleetSig6 };
/* One stateful account. `pre` is what the account holds before the act: { [script]: bindings[] }. */
async function dist6(slug, { mode = "install", pre = {}, manifest = manifest6, broken = null, ai = undefined } = {}) {
  armWith(relPubLine);
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const acct = new Map(Object.entries(pre));
  const refused = [], planePuts = [];
  const verOf = (b) => (b || []).find((x) => x.name === "VERSION")?.text || null;
  const answerMembers = () => {
    const pb = acct.get(slug) || [];
    return Object.fromEntries(PLANE_FLEET.map(([member, binding]) => {
      const b = pb.find((x) => x.type === "service" && x.name === binding);
      if (!b) return [member, { binding, state: "UNBOUND" }];
      if (!acct.has(b.service)) return [member, { binding, state: "SILENT", why: "no such worker" }];
      if (b.service !== member && b.service !== `${member}-${slug}`) return [member, { binding, state: "MISNAMED", name: b.service, version: verOf(acct.get(b.service)) }];
      return [member, { binding, state: "SERVING", version: verOf(acct.get(b.service)) }];
    }));
  };
  const putScript = async (u, init) => {
    const name = u.split("/workers/scripts/")[1];
    const meta = JSON.parse(await init.body.get("metadata").text());
    const explicit = meta.bindings || [];
    for (const b of explicit) if (b.type === "service" && b.service !== name && !acct.has(b.service)) {
      refused.push(`${name}:${b.name}->${b.service}`);
      return cferr(`Service binding '${b.name}' references Worker '${b.service}' which was not found`, 400, 10143);
    }
    const kept = (acct.get(name) || []).filter((b) => (meta.keep_bindings || []).includes(b.type)
      && !explicit.some((x) => x.name === b.name));
    acct.set(name, [...explicit, ...kept]);
    if (name === slug) planePuts.push(acct.get(slug));
    return cfok({ id: name });
  };
  const { cookie, state } = await begin(slug, mode, ai === undefined ? {} : { instanceAi: ai });
  const calls = script([
    ...REL({ manifest: () => jres(manifest), asset: () => new Response(repoSrc6) }),
    ...PLANE_FLEET.map(([member]) => ({ m: (u) => u.endsWith(`/release/${member}.bundled.mjs`),
      f: () => member === broken ? new Response("gone", { status: 404 }) : new Response(memberSrc) })),
    { m: (u) => u.endsWith("/release/ocr-worker/assets/x.wasm"), f: () => new Response(wasmBytes) },
    { m: (u) => u === CFG.TOKEN, f: () => jres({ access_token: TOK }) },
    { m: (u) => u.endsWith("/accounts"), f: () => cfok([{ id: "B6", name: "Bound" }]) },
    { m: (u, mth) => u.endsWith("/scripts/bio-plan-probe") && mth === "PUT", f: () => cfok({}) },
    { m: (u, mth) => u.includes("/scripts/bio-plan-probe") && mth === "DELETE", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/r2/buckets") && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => /\/workers\/scripts$/.test(u) && mth === "GET", f: () => cfok([...acct.keys()].map((id) => ({ id }))) },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+\/settings$/.test(u) && mth === "GET",
      f: (u) => { const held = acct.get(u.split("/workers/scripts/")[1].split("/")[0]);
        /* the copy's own answer: what it holds (R39's held place, G54's logs), as the last upload left it */
        return held ? cfok({ observability: { enabled: true }, bindings: held.map((b) => ({ type: b.type, name: b.name, ...(b.type === "plain_text" ? { text: b.text } : {}) })) }) : cferr("not found", 404); } },
    { m: (u, mth) => /\/workers\/scripts\/[^/]+$/.test(u) && mth === "PUT", f: putScript },
    { m: (u, mth) => u.endsWith(`/scripts/${slug}/subdomain`) && mth === "POST", f: () => cfok({}) },
    { m: (u, mth) => u.endsWith("/workers/subdomain") && mth === "GET", f: () => cfok({ subdomain: "b6" }) },
    { m: (u) => u.includes(`${slug}.b6.workers.dev/api/?op=bootstrap`), f: () => {
      const v = verOf(acct.get(slug)) || "0.1.0";
      return jres({ ok: true, version: v, storeVersion: v, memberVersions: answerMembers() }); } },
    { m: (u) => u.startsWith(`https://${slug}.b6.workers.dev/`), f: () => jres({ ok: true, bindings: { STORE: true } }) },
  ]);
  const body = await (await callback(`code=C&state=${state}`, cookie)).text();
  globalThis.setTimeout = realTimeout;
  globalThis.fetch = realFetch;
  disarm();
  const last = acct.get(slug) || [];
  const svc = (name) => last.find((b) => b.type === "service" && b.name === name)?.service ?? null;
  return { body, calls, refused, planePuts, members: answerMembers(), svc,
           targets: Object.fromEntries(PLANE_FLEET.map(([m, b]) => [b, svc(b)])) };
}
const RIGHT = Object.fromEntries(PLANE_FLEET.map(([m, b]) => [b, m]));
/* R64: an install names each member's Worker under the copy's slug. */
const RIGHT_OF = (slug) => Object.fromEntries(PLANE_FLEET.map(([m, b]) => [b, `${m}-${slug}`]));
const states = (mv) => Object.fromEntries(Object.entries(mv).map(([m, s]) => [m, s.state]));
const ALL_SERVING = Object.fromEntries(PLANE_FLEET.map(([m]) => [m, "SERVING"]));
const planeBase = (slug) => [{ type: "durable_object_namespace", name: "STORE", class_name: "Store" },
  { type: "plain_text", name: "VERSION", text: "0.1.0" }, { type: "secret_text", name: "ADMIN_TOKEN", text: "a" },
  { type: "service", name: "SELF", service: slug }];
const oldMember = [{ type: "plain_text", name: "VERSION", text: "0.1.0" }];
{
  const r = await dist6("bind-town");
  t("INSTALL: the plane is bound to EACH member, each binding targeting that member's own script (by name)",
    r.targets, RIGHT_OF("bind-town"));
  t("INSTALL: read back through the plane's bindings, every member is SERVING — where today's main reads each UNBOUND",
    states(r.members), ALL_SERVING);
  t("INSTALL: nothing was refused for binding a worker the account did not yet hold (the 10143 order)", r.refused, []);
  t("INSTALL ORDER: the first plane upload binds no member (none exists yet), the last binds all three",
    [r.planePuts.length, r.planePuts[0]?.some((b) => Object.values(RIGHT_OF("bind-town")).includes(b.service)) ?? null],
    [2, false]);
  t("INSTALL: the plane's other bindings survive the re-PUT (STORE, the secrets, SELF, R2)",
    ["STORE", "ADMIN_TOKEN", "PROBE_TOKEN", "DAEMON_TOKEN", "SELF", "CAPTURES", "PUBLISHED", "OWN_HOSTS"]
      .map((n) => (r.planePuts.at(-1) || []).some((b) => b.name === n)), Array(8).fill(true));
  t("INSTALL: the DAEMON_TOKEN restated by the re-PUT is the one the install generated, not a second value",
    r.planePuts[0]?.find((b) => b.name === "DAEMON_TOKEN")?.text === r.planePuts.at(-1)?.find((b) => b.name === "DAEMON_TOKEN")?.text,
    true);
  t("INSTALL: the page reports the copy running, and says it was connected",
    [r.body.includes(h(word("installer.success.running"))), r.body.includes("Your team's Civicsmith is connected to")], [true, true]);
}
{
  const r = await dist6("unbound-town", { mode: "update", pre: { "unbound-town": planeBase("unbound-town") } });
  t("UPDATE of a copy installed WITHOUT members: it gains a binding to each, by name (members it has none of are named under its slug, R64)", r.targets, RIGHT_OF("unbound-town"));
  t("UPDATE (no members before): every member reads SERVING through the plane", states(r.members), ALL_SERVING);
  t("UPDATE (no members before): reported done, every part confirmed",
    [r.body.includes(`It runs release ${FLEET_VER}; it ran 0.1.0.`), r.refused], [true, []]);
}
{
  /* The population D-297's installer left: members uploaded, plane bound to none of them. */
  const pre = { "orphan-town": planeBase("orphan-town"),
    ...Object.fromEntries(PLANE_FLEET.map(([m]) => [m, oldMember])) };
  const r = await dist6("orphan-town", { mode: "update", pre });
  t("UPDATE of a copy whose members exist UNBOUND (D-297's installs): bound to each, by name", r.targets, RIGHT);
  t("UPDATE (members existed): the FIRST plane upload already binds them (they exist), so no re-PUT is needed",
    [r.planePuts.length, PLANE_FLEET.every(([, b]) => r.planePuts[0]?.some((x) => x.name === b))], [1, true]);
  t("UPDATE (members existed): every member reads SERVING the new release", states(r.members), ALL_SERVING);
}
{
  /* A bound copy whose update cannot run the fleet step (the release names no signed fleet): it must KEEP its bindings,
     because `service` is not kept by keep_bindings and a member not restated is a member dropped. */
  const pb = [...planeBase("kept-town"), ...PLANE_FLEET.map(([m, b]) => ({ type: "service", name: b, service: m }))];
  const pre = { "kept-town": pb, ...Object.fromEntries(PLANE_FLEET.map(([m]) => [m, oldMember])) };
  const r = await dist6("kept-town", { mode: "update", pre, manifest: { ...manifest6, fleet: [], fleetSig: undefined } });
  t("UPDATE with no fleet step: a copy's existing member bindings are KEPT, each to its member", r.targets, RIGHT);
}
{
  const r = await dist6("broken-ocr", { broken: "ocr-worker" });
  t("INSTALL, ocr-worker's upload FAILED: the two members that installed are bound, OCR_WORKER is not (never to nothing)",
    r.targets, { ...RIGHT_OF("broken-ocr"), OCR_WORKER: null });
  t("and nothing was refused: no binding to a worker that is not there", r.refused, []);
  t("and the page NAMES the missing binding and does NOT report the copy running",
    [like("installer.lag.member.failed", { name: "ocr-worker" }).test(unesc(r.body)),
     r.body.includes("Your team's Civicsmith is running.")], [true, false]);
}
{
  const r = await dist6("broken-agent-up", { mode: "update", broken: "agent-worker",
    pre: { "broken-agent-up": planeBase("broken-agent-up") } });
  t("UPDATE, agent-worker's upload FAILED: AGENT_WORKER unbound, the missing binding NAMED, the update NOT reported done",
    [r.svc("AGENT_WORKER"), like("installer.lag.member.failed", { name: "agent-worker" }).test(unesc(r.body)),
     /<b>Updated (from|to)/.test(r.body)], [null, true, false]);
}

/* ---- DIST-9 (D-260's deploy half): THE ORGANISATION `ai` CREDENTIAL IS CARRIED, NEVER INVENTED ---------------------
   Added 2026-09-24 (DIST #6). The plane reads the Worker secret INSTANCE_AI_TOKEN since D-260 and resumes the woken runs
   that credential opened; nothing placed it. Install and update now CARRY a value the operator supplies, as DAEMON_TOKEN
   is carried, and differ from DAEMON_TOKEN in the load-bearing way: none supplied -> NONE SENT (a member mints the
   credential on the copy, DS-3; an invented value names no principal). HOW A LIAR WOULD PASS: generate a value when
   none is given (the DAEMON_TOKEN `|| rand(32)` shape) — the NO-INVENTION arms read every plane PUT for the binding.
   NEGATIVE CONTROL: see the DIST-9 entry below this block's arms. */
console.log("\n--- DIST-9: the organisation ai credential is carried when supplied, and never invented ---");
{
  const AI = "aik-" + "d9".repeat(20);
  const aiOf = (b) => (b || []).filter((x) => x.name === "INSTANCE_AI_TOKEN");
  const sentIn = async (calls, slug) => {
    const out = [];
    for (const c of calls.filter((c) => c.method === "PUT" && c.u.endsWith(`/workers/scripts/${slug}`)))
      out.push(...aiOf((await metadataOf(c)).bindings));
    return out;
  };
  t("DIST-9: /begin REFUSES by name a supplied value that is not credential-shaped (too short), before any sign-in",
    (await (await req("/begin", { method: "POST", body: JSON.stringify({ slug: "ai-town", instanceAi: "short" }) })).json()).ok,
    false);
  t("DIST-9: /begin REFUSES a value with a space in it", (await (await req("/begin", { method: "POST",
    body: JSON.stringify({ slug: "ai-town", instanceAi: "aik-has a space-0123456789" }) })).json()).ok, false);
  t("DIST-9: an EMPTY value is the normal case, not a refusal", (await (await req("/begin", { method: "POST",
    body: JSON.stringify({ slug: "ai-town", instanceAi: "" }) })).json()).ok, true);

  const i1 = await dist6("ai-install", { ai: AI });
  t("DIST-9 INSTALL, supplied: INSTANCE_AI_TOKEN is bound as a secret carrying EXACTLY the operator's value",
    aiOf(i1.planePuts.at(-1)).map((b) => [b.type, b.text]), [["secret_text", AI]]);
  t("DIST-9 INSTALL, supplied: the value is on NO page the installer renders", i1.body.includes(AI), false);
  t("DIST-9 INSTALL, supplied: the page says it was stored", i1.body.includes(word("installer.ai.given")), true);

  const i0 = await dist6("ai-none-install");
  t("DIST-9 NO-INVENTION (install): with none supplied, NO plane PUT carries INSTANCE_AI_TOKEN",
    (await sentIn(i0.calls, "ai-none-install")).length, 0);
  t("DIST-9 NO-INVENTION (install): and the copy holds none after the whole act", aiOf(i0.planePuts.at(-1)).length, 0);
  t("DIST-9 (install): the absence is STATED on the page, not left silent",
    i0.body.includes(word("installer.ai.none.install")), true);

  const u1 = await dist6("ai-update", { mode: "update", ai: AI, pre: { "ai-update": planeBase("ai-update") } });
  t("DIST-9 UPDATE, supplied: a copy that held none now holds EXACTLY the operator's value",
    aiOf(u1.planePuts.at(-1)).map((b) => [b.type, b.text]), [["secret_text", AI]]);
  t("DIST-9 UPDATE, supplied: the value is on no page", u1.body.includes(AI), false);

  const OLD = "aik-" + "0a".repeat(20);
  const u0 = await dist6("ai-kept", { mode: "update",
    pre: { "ai-kept": [...planeBase("ai-kept"), { type: "secret_text", name: "INSTANCE_AI_TOKEN", text: OLD }] } });
  t("DIST-9 NO-INVENTION (update): with none supplied, NO plane PUT carries INSTANCE_AI_TOKEN",
    (await sentIn(u0.calls, "ai-kept")).length, 0);
  t("DIST-9 (update, none supplied): the value the copy already held is KEPT, unchanged (keep_bindings: secret_text)",
    aiOf(u0.planePuts.at(-1)).map((b) => b.text), [OLD]);
  t("DIST-9 (update): the page says none was sent and that the installer never creates one",
    u0.body.includes(word("installer.ai.none.update")), true);

  const upPage = await (await req("/update?version=" + CUR_VER)).text();
  const homePage = await (await req("/")).text();
  t("DIST-9: the UPDATE page offers the optional credential box, as a password field",
    /<input id="ai" type="password"/.test(upPage), true);
  t("DIST-9: the INSTALL page does not (a new copy has no member yet to mint one)", homePage.includes('id="ai"'), false);
}

/* ---- DIST-11 (IC-252): both upload paths declare the Browser Rendering binding, named as the plane's config names it ---- */
console.log("\n--- DIST-11: install and update declare BROWSER ---");
{
  const planeCfg = readFileSync(new URL("../../bio-plane/wrangler.jsonc", import.meta.url), "utf8");
  const cfgName = (planeCfg.match(/"browser":\s*\{\s*"binding":\s*"([A-Z_]+)"/) || [])[1] || null;
  t("DIST-11 PIN: the installer's BROWSER binding carries the name the plane's wrangler.jsonc declares",
    [NG.BROWSER_BINDING?.type ?? null, NG.BROWSER_BINDING?.name ?? null], ["browser", cfgName]);
  const i = await dist6("br-install");
  t("DIST-11 INSTALL: the plane is uploaded holding a browser binding named BROWSER",
    (i.planePuts.at(-1) || []).filter((b) => b.type === "browser").map((b) => b.name), ["BROWSER"]);
  const u = await dist6("br-update", { mode: "update", pre: { "br-update": planeBase("br-update") } });
  t("DIST-11 UPDATE: a copy installed before DIST-11 gains BROWSER (browser is not kept by keep_bindings, so it is restated)",
    (u.planePuts.at(-1) || []).filter((b) => b.type === "browser").map((b) => b.name), ["BROWSER"]);
}

/* ---- DIST-7 (D-54): both upload paths send the plane's subrequest ceiling, pinned to the plane's own config ---- */
console.log("\n--- DIST-7: install and update send limits.subrequests ---");
{
  const planeCfg = readFileSync(new URL("../../bio-plane/wrangler.jsonc", import.meta.url), "utf8");
  const cfgSub = Number((planeCfg.match(/"limits":\s*\{\s*"subrequests":\s*(\d+)/) || [])[1]);
  /* R20 replaced DIST-7's pinned constant: the installer holds no value of its own; what it sends is the release's statement. */
  t("R20 PIN: the installer exports no limits constant of its own", "PLANE_LIMITS" in NG, false);
  t("PIN: this suite's releases state bio-plane/wrangler.jsonc's ceiling", NG.planeLimits(repoSrc6).limits?.subrequests ?? null,
    Number.isFinite(cfgSub) ? cfgSub : "wrangler.jsonc states none");
  const limitsSent = async (calls, slug) => {
    const out = [];
    for (const c of calls.filter((c) => c.method === "PUT" && c.u.endsWith(`/workers/scripts/${slug}`)))
      out.push((await metadataOf(c)).limits?.subrequests ?? null);
    return out;
  };
  const i = await dist6("lim-install");
  t("DIST-7 INSTALL: every plane upload of the install (the install PUT and its step-3 re-PUT) sends the ceiling",
    await limitsSent(i.calls, "lim-install"), [cfgSub, cfgSub]);
  const u = await dist6("lim-update", { mode: "update", pre: { "lim-update": planeBase("lim-update") } });
  const sent = await limitsSent(u.calls, "lim-update");
  t("DIST-7 UPDATE: every plane upload of an update sends it too (a copy installed before DIST-7 has no limit to keep)",
    sent.length > 0 && sent.every((v) => v === cfgSub), true);
}

console.log(`\nwizard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
