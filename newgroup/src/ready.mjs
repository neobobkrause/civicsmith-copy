/* R84 (fix round 9, K4937; G144-G150; amends R4, R7, R14, R70) — THE ACCOUNT MADE READY BEFORE ANYTHING IS CREATED.
 *
 * Each check here answers `null` (the account is ready for that condition) or a stop: `{ said, d, retry }`, one sentence, the way
 * on beside it, and the label of the one act that begins the run again with the founder's choices kept ("Check again": `retry`).
 * A check that needs the founder to choose (the account, the address) answers a panel instead. Nothing here writes to the account
 * but `registerSubdomain`, which `addressReady` calls only for a name the founder chose with a click.
 *
 * Cloudflare offers no permission to buy a plan or turn R2 on for the founder (its OAuth scope list, read 2026-10-24, holds no
 * billing scope), so these stay walk-throughs. Every Cloudflare answer shape below is "documented shape; BOB measures on the
 * rehearsal account (K4942)". Its sentences are read by key (`word`); a key the word list does not hold yet is the design's to write (K4947), listed in the job record. */
import { word } from "../../bio-plane/src/setup-words/index.mjs";
import { storageEntitlement, addressState, registerSubdomain, missingScopes, listScripts, listNamespaces, listBuckets, special,
  apiOf, establishPlan, PLAN_PROBE, inventory, freeName, scriptExists, BINDING_OF } from "./steps/index.mjs";
import { RELEASE_MANIFEST, RELEASE_CONTAINERS } from "./release.mjs";
import { GROUP_SLUG_RE } from "../../bio-plane/src/setup-fleet.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CHECK_AGAIN = () => word("installer.ready.checkagain");

/* ---------------------------------------------------------------- (5) the permission granted */

/* The scopes every install needs before its first call: the installer's own, less the two that have a step of their own
   (`account-logs.read`: R46's check; `connectivity-directory.bind`: the Workers VPC binding, R45). */
export const neededScopes = (scopes) => scopes.filter((s) => s !== "account-logs.read" && s !== "connectivity-directory.bind");
/* `granted` is the token response's scope string (null when it states none: nothing can be compared, the later steps judge). */
export function scopesStop(granted, scopes) {
  if (typeof granted !== "string") return null;
  const missing = missingScopes(granted, neededScopes(scopes));
  if (!missing.length) return null;
  return { said: word("installer.ready.scopes", { missing: missing.join(", ") }), approveAgain: true };
}

/* ---------------------------------------------------------------- (6) the account */

/* The sign-in's accounts; `chosen` the id the founder chose (from the cookie). One account: it is used. Several: the founder
   chooses one by name; a choice that names none of them is asked again. Answers `{acct}` or `{choose: [{id, name}]}`. */
export function pickAccount(accts, chosen) {
  if (accts.length === 1) return { acct: accts[0] };
  const hit = chosen ? accts.find((a) => a.id === chosen) : null;
  return hit ? { acct: hit } : { choose: accts };
}
export const accountSentence = () => word("installer.ready.account.which");
export function accountPanel(accts, body) {
  const b = (a) => esc(JSON.stringify({ ...body, account: a.id }));
  return `<section id="account-choice"><h2>${esc(word("installer.ready.account.head"))}</h2>
<p>${esc(accountSentence())}</p>
${accts.map((a) => `<div class="cs-sheet ng-block"><h3>${esc(a.name)}</h3><div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-account="${esc(a.id)}" data-begin="${b(a)}">${esc(word("installer.ready.account.use", { name: a.name }))}</button></div></div>`).join("\n")}
<p class="err" id="begin-err" role="alert"></p></section>`;
}

/* ---------------------------------------------------------------- (1) storage */

export async function storageReady(token, acct) {
  const s = await storageEntitlement(token, acct);
  if (s.state === "on") return null;
  if (s.state === "not_entitled") {
    return { said: word("installer.ready.storage.off"),
      d: word("installer.ready.storage.do"), retry: CHECK_AGAIN() };
  }
  if (s.state === "permission") {
    return { said: word("installer.ready.storage.permission"), approveAgain: true };
  }
  return { said: word("installer.ready.storage.unknown", { said: s.said ?? "" }),
    d: word("installer.ready.unknown.do"), retry: CHECK_AGAIN() };
}

/* ---------------------------------------------------------------- (2) Containers */

/* Cloudflare's answer to the Containers list, decided by its status and CODE and never by its words (K4937). Measured on the
   rehearsal account (K4970; build/plan/measure-R9-account-shapes.md): a Free account answers this path with HTTP 401, code 1000
   ("Unauthorized: ... requires the Workers Paid plan"). A 1000 on any other path is not the plan, nor is a bare 401 (an expired
   permission, which asks to approve again, R71). 10000 and 9109 are Cloudflare's own "not authenticated for this" answers (documented,
   not measured); 100328 is the plan refusal measured for a Worker's CPU limits on Free, kept for the day this path answers it.
   There is no "off" state: no switch to turn Containers on is documented. */
export const CONTAINERS_CODES = Object.freeze({
  permission: Object.freeze([10000, 9109]),
  plan: Object.freeze([100328]),
  planUnauthorized: Object.freeze({ status: 401, code: 1000 }),
});
const planAnswer = (e) => !!e && (CONTAINERS_CODES.plan.includes(e.code)
  || (e.status === CONTAINERS_CODES.planUnauthorized.status && e.code === CONTAINERS_CODES.planUnauthorized.code));
/* "on" (the list answered), "plan", "permission", or "unknown" with Cloudflare's words. The plan answer is a 401, which the
   request layer otherwise raises as "approve again": it is read here first, by its code. */
export async function containersState(api) {
  try { await api("/containers/applications"); return { state: "on" }; }
  catch (e) {
    if (planAnswer(e)) return { state: "plan" };
    if (special(e)) throw e;
    if (CONTAINERS_CODES.permission.includes(e && e.code)) return { state: "permission" };
    return { state: "unknown", said: e && e.message || String(e) };
  }
}
/* `planStop` is the plan's own stop (R6), drawn when the cause is the plan. */
export function containersStop(c, planStop) {
  if (c.state === "on") return null;
  if (c.state === "plan") return planStop;
  if (c.state === "permission") {
    return { said: word("installer.ready.containers.permission"), approveAgain: true };
  }
  return { said: word("installer.ready.containers.unknown", { said: c.said }),
    d: word("installer.ready.unknown.do"), retry: CHECK_AGAIN() };
}

/* ---------------------------------------------------------------- (3) the account's limits */

/* Cloudflare's published ceilings for a Workers Paid account (read 2026-10-24), each with its source:
   workers      500  developers.cloudflare.com/workers/platform/limits/ ("Workers per account | 100 | 500")
   classes      500  developers.cloudflare.com/durable-objects/platform/limits/ ("Maximum Durable Object classes (per account): 500 (Workers Paid)")
   buckets  1000000  developers.cloudflare.com/r2/platform/limits/ ("Maximum number of buckets per account | 1,000,000")
   crons        250  developers.cloudflare.com/workers/platform/limits/ ("Number of Cron Triggers per account | 5 | 250")
   Containers' applications have no documented count ceiling (only memory, vCPU, disk and image storage), so none is checked. */
export const ACCOUNT_LIMITS = Object.freeze({
  workers: { ceiling: 500, need: 1 + RELEASE_MANIFEST.fleet.length + 2 },
  classes: { ceiling: 500, need: 1 + 2 + RELEASE_CONTAINERS.length },
  buckets: { ceiling: 1_000_000, need: 2 },
  crons: { ceiling: 250, need: 1 + RELEASE_MANIFEST.fleet.length },
});
const limitSentence = (k, ceiling) => k === "crons"
  ? word("installer.limit.crons.other", { n: ceiling })
  : word(`installer.limit.${k}.${ceiling === 1 ? "one" : "other"}`, { n: ceiling });

/* The scheduled jobs the account's Workers already hold, read per Worker (Cloudflare lists none account-wide); a Worker whose
   schedule cannot be read is not counted (the ceiling is far, and the platform refuses what it will not hold). */
async function cronCount(api, scripts) {
  let n = 0;
  const names = [...scripts.keys()];
  for (let i = 0; i < names.length; i += 8) {
    await Promise.all(names.slice(i, i + 8).map(async (name) => {
      try { const r = await api(`/workers/scripts/${name}/schedules`); n += (Array.isArray(r) ? r : r?.schedules || []).length; }
      catch (e) { if (special(e)) throw e; }
    }));
  }
  return n;
}
/* `needs` is what the act adds to each count: the install's table, or (an update) what the chosen release adds to the copy.
   Answers the limit's sentence, or null. */
export async function limitReached(api, needs = null) {
  const [scripts, spaces, buckets] = await Promise.all([listScripts(api), listNamespaces(api), listBuckets(api)]);
  const have = { workers: scripts.size, classes: spaces.length, buckets: buckets.length };
  const add = needs ? needs({ scripts, spaces, buckets }) : null;
  const wantsCrons = (add ? add.crons : ACCOUNT_LIMITS.crons.need) > 0;
  have.crons = wantsCrons && scripts.size ? await cronCount(api, scripts) : 0;
  for (const [k, l] of Object.entries(ACCOUNT_LIMITS)) {
    const need = add ? (add[k] ?? 0) : l.need;
    if (need > 0 && have[k] + need > l.ceiling) return limitSentence(k, l.ceiling);
  }
  return null;
}
/* F3 (R70): what an update adds to the account. Only the members and container classes the copy does not hold already, and the
   storage buckets it lacks, count: an update that adds nothing needs no room. */
export const updateNeeds = (names, loaded) => ({ scripts, spaces, buckets }) => {
  const inFleet = (loaded?.members || []).filter((L) => !L.error);
  const newClasses = inFleet.flatMap((L) => (L.classes || []).filter((c) => !spaces.some((s) => s && s.script === names.member(L.m.member) && s.class === c.class_name)));
  return { workers: inFleet.filter((L) => !scripts.has(names.member(L.m.member))).length, classes: newClasses.length,
    buckets: [names.captures, names.published].filter((n) => !buckets.includes(n)).length, crons: 0 };
};

/* ---------------------------------------------------------------- (4) the address */

/* A name valid as a workers.dev prefix: letters, digits and dashes, not starting or ending with a dash, 63 or fewer. */
export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/* `chosen` the name the founder chose with a click (the cookie). Answers `{ok: true, registered?}` (the account has a prefix, or
   the chosen name was registered now) or `{ask: {name, taken}}`: nothing is registered without the click. */
export async function addressReady(token, acct, slug, chosen) {
  const st = await addressState(token, acct, slug);
  if (st.sub) return { ok: true };
  if (!chosen) return { ask: { name: st.proposed || slug, taken: false } };
  const r = await registerSubdomain(token, acct, chosen);
  return r.ok ? { ok: true, registered: chosen } : { ask: { name: chosen, taken: true } };
}
export const addressSentence = (taken, name) => taken
  ? word("installer.ready.address.taken", { name })
  : word("installer.ready.address.none");
export function addressPanel({ name, taken }, body) {
  return `<section id="address-choice"><h2>${esc(word("installer.ready.address.head"))}</h2>
<p id="address-says">${esc(addressSentence(taken, name))}</p>
<p>${esc(word("installer.ready.address.permanent"))}</p>
<div class="cs-field"><label for="address-name">${esc(word("installer.ready.address.label"))}</label>
<input id="address-name" class="cs-input id" type="text" autocomplete="off" spellcheck="false" value="${esc(name)}"></div>
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" data-sub-from="address-name" data-begin="${esc(JSON.stringify(body))}">${esc(word("installer.ready.address.use"))}</button></div>
<p class="err" id="begin-err" role="alert"></p></section>`;
}

/* ---------------------------------------------------------------- (7) size */

/* Cloudflare's uncompressed Worker size limit, 64 MiB on Free and Paid (developers.cloudflare.com/workers/platform/limits/,
   read 2026-10-24: "There is no compressed size limit. Only the uncompressed bundle size counts."). */
export const WORKER_SIZE_LIMIT = 64 * 1024 * 1024;
export const planeTooBig = (release) => (release.blob && release.blob.size > WORKER_SIZE_LIMIT) || release.bytes > WORKER_SIZE_LIMIT
  ? { said: word("installer.ready.size.plane"), d: "" } : null;
/* A member whose bundle is over the limit is left out by name, as any member the release cannot install is (R38). Answers the
   fleet with that member's entry carrying its reason, so the fleet step names it. */
export function leaveOutOversize(loaded) {
  if (!loaded || !loaded.members) return loaded;
  return { ...loaded, members: loaded.members.map((L) => (!L.error && Number(L.m.bytes) > WORKER_SIZE_LIMIT
    ? { m: L.m, error: word("installer.ready.size.member") } : L)) };
}

/* ---------------------------------------------------------------- R70 (F7): the short name free */

/* A short name an install may take: the slug grammar (instance-setup's), never the installer's own name. */
export const slugOk = (s) => typeof s === "string" && GROUP_SLUG_RE.test(s) && s !== "newgroup";
/* The fleet members' own names: instance-setup's table, what the built-in release names, and what `release` names. */
export const memberNamesOf = (release) => [...new Set([...BINDING_OF.keys(), ...RELEASE_MANIFEST.fleet.map((m) => m.member),
  ...(Array.isArray(release?.man?.fleet) ? release.man.fleet.map((m) => m && m.member).filter((m) => typeof m === "string") : [])])];
/* R87: the one place that says whether the short name is taken in the account (`inv`, `inventory`'s answer), for the install's
   `fresh` step and the check's `name` line alike. Taken: a Worker by that name that is not a copy of Civicsmith's, or (`alongside`,
   a new copy beside those held: R64) a name a finished copy holds. Answers null when free, else `{free}`, a free name beside it
   (null when none is found). */
export async function nameTaken(token, acct, inv, slug, alongside = false) {
  const ours = inv.planes.find((p) => p.slug === slug);
  const taken = ours ? (ours.finished && alongside) : (inv.scripts.has(slug) || await scriptExists(token, acct, slug));
  if (!taken) return null;
  const names = new Set([...inv.scripts.keys(), ...inv.planes.map((p) => p.slug), ...inv.orphans.slugged.keys()]);
  return { free: freeName(slug, names, slugOk) };
}

/* ---------------------------------------------------------------- R92: every link is data, in one place */

/* The Cloudflare pages the Get-ready buttons (R91) and the list's fix buttons (R87) open, held here only. `CFG.AUTHORIZE`,
   `CFG.TOKEN` and `CF_API` are endpoints, not pages a founder reads, and are not here. `:account` is Cloudflare's own stand-in
   for the account the founder is signed in to (the dashboard's deep-link form, as its own answers name it). */
const DASH = "https://dash.cloudflare.com";
const PAGE = Object.freeze({
  signup: `${DASH}/sign-up`,
  plans: `${DASH}/?to=/:account/workers/plans`,
  r2: `${DASH}/?to=/:account/r2/overview`,
  containers: `${DASH}/?to=/:account/workers/containers`,
  workers: `${DASH}/?to=/:account/workers-and-pages`,
});
/* Get-ready step id (guide.mjs `GUIDE_STEPS`, the first three) to its button's words and page. */
export const GET_READY_LINKS = Object.freeze({
  account: Object.freeze({ key: "screen.install.getready.account.open", url: PAGE.signup }),
  plan: Object.freeze({ key: "screen.install.getready.plan.open", url: PAGE.plans }),
  storage: Object.freeze({ key: "screen.install.getready.storage.open", url: PAGE.r2 }),
});
/* `CHECK_LINES` id, then state (`not_ready`, `unknown`), to its fix button's words and page; a `ready` line has none. The name's
   page is the account's Workers, where the Worker holding the name is (the design gives the key "Open your Workers"). */
const fix = (fix_key, url) => Object.freeze({ fix_key, url });
const both = (f) => Object.freeze({ not_ready: f, unknown: f });
export const FIX_LINKS = Object.freeze({
  plan: both(fix("screen.install.check.plan.open", PAGE.plans)),
  containers: both(fix("screen.install.check.containers.open", PAGE.containers)),
  limits: both(fix("screen.install.check.limits.open", PAGE.workers)),
  name: both(fix("screen.install.check.limits.open", PAGE.workers)),
  card: both(fix("screen.install.check.card.storage.open", PAGE.r2)),
});

/* ---------------------------------------------------------------- R86-R89: "Check my account" */

/* R87: the list's lines, in their fixed order. */
export const CHECK_LINES = Object.freeze(["plan", "containers", "limits", "name", "card"]);
export const CHECK_STATES = Object.freeze(["ready", "not_ready", "unknown"]);

const askApproval = (said) => Object.assign(new Error(said), { approveAgain: true, said });
const line = (id, state, said, extra = {}) => ({ id, state, said, fix: state === "ready" ? null : (extra.fixOf || FIX_LINKS[id][state]), ...(extra.use ? { use: extra.use } : {}) });
/* R87, R89: a line that errors is `unknown` and stops no other; a wait that never mended (`Lasting`) says to try again in a minute.
   A permission that expired or does not reach is not a line: it asks for approval again (R71). */
const unknownLine = (id, e) => line(id, "unknown", e && e.lasting ? word("screen.install.check.unknown.busy")
  : word("screen.install.check.unknown.fix", { cause: (e && (e.said || e.message)) || String(e) }));
async function judge(id, fn) {
  try { return await fn(); }
  catch (e) { if (e && e.approveAgain) throw e; return unknownLine(id, e); }
}

/* R86-R89: the check, run against `account` ({id, name}, the one the sign-in lists or the founder chose, R84 (6)) for the short name
   `slug`. Every line is judged, each on its own; nothing is created that stays: the only write is the plan's probe upload
   (`establishPlan`), deleted at once, and a probe it could not delete is answered (`probeLeft`) for the list to name. No lock, no
   workers.dev prefix registered, no bucket. Answers `{account, slug, lines, state, probeLeft}`; `state` is `ready` only when every
   line is. Throws `{approveAgain}` when a line answers that the permission does not reach. */
export async function runChecks(token, account, slug, { memberNames = memberNamesOf(null) } = {}) {
  const acct = account.id, api = apiOf(token, acct);
  let probeLeft = null, planState = null, planCause = "";
  const plan = await judge("plan", async () => {
    const p = await establishPlan(token, acct);
    if (p.leftover) probeLeft = PLAN_PROBE;
    planState = p.plan;
    if (p.plan === "paid") return line("plan", "ready", word("screen.install.check.plan.ok"));
    if (p.plan === "free") return line("plan", "not_ready", word("screen.install.check.plan.fix"));
    planCause = p.detail || "";
    return line("plan", "unknown", word("screen.install.check.unknown.fix", { cause: planCause }));
  });
  const containers = await judge("containers", async () => {
    const c = await containersState(api);
    if (c.state === "on") return line("containers", "ready", word("screen.install.check.containers.ok"));
    if (c.state === "plan") return line("containers", "not_ready", word("screen.install.check.containers.fix"));
    if (c.state === "permission") throw askApproval(word("installer.ready.containers.permission"));
    return line("containers", "unknown", word("screen.install.check.unknown.fix", { cause: c.said || "" }));
  });
  const limits = await judge("limits", async () => {
    const limit = await limitReached(api);
    return limit ? line("limits", "not_ready", word("screen.install.check.limits.fix", { limit }))
      : line("limits", "ready", word("screen.install.check.limits.ok"));
  });
  const name = await judge("name", async () => {
    const taken = await nameTaken(token, acct, await inventory(api, memberNames), slug, true);
    if (!taken) return line("name", "ready", word("screen.install.check.name.ok", { name: slug }));
    return line("name", "not_ready", word("screen.install.check.name.fix", { name: slug, free: taken.free || "" }), taken.free ? { use: taken.free } : {});
  });
  /* R88: the card line is derived from the plan line and one read (R43), with no write of its own. */
  const card = await judge("card", async () => {
    if (planState === "free") return line("card", "not_ready", word("screen.install.check.plan.fix"), { fixOf: FIX_LINKS.plan.not_ready });
    if (planState !== "paid") return plan.state === "unknown" ? { ...plan, id: "card", fix: FIX_LINKS.card.unknown } : unknownLine("card", new Error(planCause));
    const s = await storageEntitlement(token, acct);
    if (s.state === "on") return line("card", "ready", word("screen.install.check.card.ok") + " " + word("screen.install.check.probe"));
    if (s.state === "not_entitled") return line("card", "not_ready", word("screen.install.check.card.storage"));
    if (s.state === "permission") throw askApproval(word("installer.ready.storage.permission"));
    return line("card", "unknown", word("screen.install.check.unknown.fix", { cause: s.said || "" }));
  });
  const lines = [plan, containers, limits, name, card];
  return { account: account.name, slug, lines, state: lines.every((l) => l.state === "ready") ? "ready" : "not_ready", probeLeft };
}

/* R87, R90: the list, drawn: every line at once with its state, its sentence and its fix button (R92's page, opened in a new tab);
   the probe left behind named; "Install now", open only when every line is ready (and saying Cloudflare asks once more), else drawn
   closed with why; "Check again" always (R89). `body` is what the check began with: "Check again" begins it again, "Install now"
   begins the install with the same choices. */
const STATE_KEY = Object.freeze({ ready: "screen.install.check.ready", not_ready: "screen.install.check.notready", unknown: "screen.install.check.unknown" });
const STATE_R = Object.freeze({ ready: "ok", not_ready: "no", unknown: "go" });
export const linkButton = (url, label, attrs = "") => `<a class="cs-btn" data-tone="quiet" href="${esc(url)}" target="_blank" rel="noopener noreferrer"${attrs}>${esc(label)}</a>`;
export function checkPanel(result, body) {
  const { lock: _lock, ...choices } = body || {};
  const again = { ...choices, slug: result.slug, mode: "check" };
  const install = { ...choices, slug: result.slug, mode: "install" };
  const ready = result.state === "ready";
  const row = (l) => `<div class="cs-row" data-line="${l.id}" data-state="${l.state}" data-r="${STATE_R[l.state]}"><span class="mk">${esc(word(STATE_KEY[l.state]))}</span>`
    + `<span><b>${esc(word(`screen.install.check.${l.id}.name`))}</b> ${esc(l.said)}</span><span class="ng-acts">`
    + (l.fix ? linkButton(l.fix.url, word(l.fix.fix_key), ` data-fix="${l.id}"`) : "")
    + (l.use ? `<button type="button" class="cs-btn" data-tone="quiet" data-use="${esc(l.use)}" data-begin="${esc(JSON.stringify({ ...again, slug: l.use }))}">${esc(word("screen.install.check.name.use", { free: l.use }))}</button>` : "")
    + `</span></div>`;
  return `<section id="check-list"><h2>${esc(word("screen.install.check.title"))}</h2>
<p id="check-account">${esc(word("screen.install.check.account", { account: result.account }))}</p>
<p class="small">${esc(word("screen.install.check.creates"))}</p>
<div class="cs-sheet ng-log" id="check-lines">${result.lines.map(row).join("")}</div>
${result.probeLeft ? `<div class="notice" id="check-probe-left"><p>${esc(word("screen.install.check.probe.left", { name: result.probeLeft }))}</p></div>` : ""}
<p id="check-whole" data-state="${result.state}">${esc(word(ready ? "screen.install.check.allready" : "screen.install.check.closed"))}</p>
${ready ? `<p class="small" id="install-now-note">${esc(word("screen.install.check.now.note"))}</p>` : ""}
<div class="ng-acts"><button type="button" class="cs-btn" data-tone="primary" id="install-now"${ready ? "" : " disabled"} data-begin="${esc(JSON.stringify(install))}">${esc(word("screen.install.check.now"))}</button>
<button type="button" class="cs-btn" data-tone="quiet" id="check-again" data-begin="${esc(JSON.stringify(again))}">${esc(word("screen.install.check.again"))}</button></div>
<p class="err" id="begin-err" role="alert"></p></section>`;
}

/* ---------------------------------------------------------------- R90: the gate */

/* The cookie a passed check sets: the short name and the instant, nothing else, unsigned (it is the first line only; R84's checks
   at the start of the install are the second). Good for 30 minutes. */
export const CHECK_COOKIE = "chk";
export const CHECK_MAX_AGE_S = 30 * 60;
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const checkCookieValue = (slug, t) => b64(JSON.stringify({ slug, t }));
export const checkCookie = (slug, t = Date.now()) =>
  `${CHECK_COOKIE}=${checkCookieValue(slug, t)}; Path=/; Max-Age=${CHECK_MAX_AGE_S}; HttpOnly; Secure; SameSite=Lax`;
export const checkCookieCleared = () => `${CHECK_COOKIE}=deleted; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
/* Whether `raw` (the cookie's value, or null) is a passed check for `slug`, no older than 30 minutes. */
export function checkPassed(raw, slug, now = Date.now()) {
  if (typeof raw !== "string" || !raw) return false;
  let c;
  try { c = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (x) => x.charCodeAt(0)))); }
  catch { return false; }
  return !!c && c.slug === slug && typeof c.t === "number" && c.t <= now && now - c.t <= CHECK_MAX_AGE_S * 1000;
}
