/* Part 2 of the BIO installer: the wizard Worker.
 *
 * Lives at newgroup.believeinoakland.workers.dev. Serves the wizard page,
 * receives the OAuth return, and provisions the team's instance into THEIR
 * Cloudflare account, server-side. Server-side because it must be: the
 * management API answers no CORS preflight, so a browser can never call it
 * with an Authorization header. Tested twice; do not re-test hoping for a
 * different answer.
 *
 * Custody of the access token, and the guarantees this file keeps:
 *   - The token is scoped to exactly five permissions (R2), granted on a consent
 *     screen the user reads, revocable from their dashboard, short-lived.
 *   - It exists in a local variable for the seconds provisioning takes. This
 *     Worker has NO storage bindings of any kind, so there is nowhere to
 *     write it even by mistake. Statelessness is structural, not promised.
 *   - It is never echoed into HTML, logs, or error text. The test suite
 *     asserts its absence from every byte this Worker emits.
 *
 * The one failure we cannot put a sentence on screen for: a redirect URL
 * mismatch fails on Cloudflare's side before the user ever returns here.
 * REDIRECT below must remain character-identical to the URL registered on
 * the OAuth client. When the domain moves, add the new URL alongside the old
 * on the client, deploy, verify a real run, then remove the old.
 */

import { WIZARD_HTML, updateHtml, publisherFooter, PROFILE_CHOICES, ASSISTANT_OFFER, SECURITY_TOOLS, pageHead, pageMark, around, SLOT,
  ASSET_PREFIX, UPDATE_WORDS, versionOk, NO_RELEASE_CHOSEN, NO_RELEASE_BEGIN, existsPanel, removePanel, removedPanel } from "./ui.mjs";
/* R72: every sentence a key holds is read by key; R66, R71: the way to Cloudflare waits out what waiting can mend. */
import { word } from "./words.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
/* R80 (N1240; K624): every act on the account and the fleet is `installer-steps`', reached through its barrel with arguments only.
   R62–R65, R69, R70: what the account holds and the names a copy's parts carry are among them. */
import { CF_API, RELEASE_LATEST, RELEASE_TAGGED, Session, patiently, WAIT_BOUND_MINUTES,
  namesFor, schemeOf, SLUG_SCHEME, LEGACY_SCHEME, MARK, allCopies, inventory, freeName, readCopyFacts, countsViaApi, resourcesOf,
  deleteResources, takeLock, touchLock, dropLock, listScripts, listBuckets, listNamespaces, listApps, bindingsOf,
  relHeaders, Sha256, hex, vcmp, b64url, rand, cf, special, approve, apiOf, scriptExists, PLAN_PROBE, establishPlan, ensureBuckets, readBack,
  BINDING_OF, membersPresent, instanceAiOk, SEAL_BINDING, heldBindings, hostOf, planeLimits, reportsBuilds, vpcServiceOk,
  uploadInstall, uploadUpdate, planeInSync, putSecret, rotateSecrets, loadFleet, installFleet, bindMembers, ensureSubdomain,
  verifyInstall, failedLags, verifyServing, confirmContainers, waitForAnswer, currentDeployment, rollBack, withByteLags, logsStep, copyWorkers,
  locationHintFor, ARMED_SIGNERS } from "./steps/index.mjs";
/* R84: the account made ready before anything is created. */
import { scopesStop, pickAccount, accountPanel, accountSentence, storageReady, containersState, containersStop, limitReached, updateNeeds,
  addressReady, addressPanel, addressSentence, planeTooBig, leaveOutOversize, SUBDOMAIN_RE, CHECK_AGAIN } from "./ready.mjs";
/* R63: the words of what a copy already holds. */
import { describeCopy } from "./held.mjs";
/* R53 (DEC-122 (3); K3100): interface-assets' stylesheet and faces, carried in this bundle and served at ASSET_PREFIX. */
import { ASSET_FILES } from "../../bio-plane/src/interface-assets/index.mjs";
import { RELEASE_PACKED, RELEASE_FACTS, RELEASE_VERSION, RELEASE_MANIFEST, RELEASE_CONTAINERS } from "./release.mjs";
/* One verifier, shared with the plane. The installer and the instance
   agree on what a valid signature is because they run the same code. */
import { verifySshsig, NS_RELEASE } from "../../bio-plane/src/sshsig.mjs";
/* R30 (N234): the slug grammar and the member binding names are instance-setup's, imported, never copied. R34 (DEC-109):
   so is the block on who controls the copy, which the claim page shows in the same words (instance-setup R47). */
import { GROUP_SLUG_RE, hostingControlBlock } from "../../bio-plane/src/setup-fleet.mjs";

export const CFG = {
  CLIENT_ID: "1c2fdba3fc71cf88d26fcd7b90df95de",
  AUTHORIZE: "https://dash.cloudflare.com/oauth2/auth",
  TOKEN:     "https://dash.cloudflare.com/oauth2/token",
  API:       CF_API,
  REDIRECT:  "https://newgroup.believeinoakland.workers.dev/callback",
  /* Exactly the scopes registered on the OAuth client, nothing more. R2 (M-Q8): the fourth is the Containers write
     scope, by the id Cloudflare's scope list gives it (`GET /client/v4/oauth/scopes`, read 2026-10-06: "Workers
     Containers Write", `containers.write`); it is asked so a container member can be installed (R38), and a group
     re-consents to it at its first update after T33 (R17). The fifth (T36, K2155) is "Connectivity Directory Bind",
     `connectivity-directory.bind` (the same list, read 2026-10-08), which binding a Workers VPC service needs (R45). The sixth
     (N1151; R2, K3818) is "Logs Read", `account-logs.read`, which reading the Logpush job list needs (R46); Bob registered it on the
     OAuth client (K3819), so it is asked: the installer asks nothing the client does not hold, and a scope the client does not
     hold would fail on Cloudflare's side before the founder returns, where no message of this installer can say so. */
  SCOPES:    ["workers-scripts.write", "workers-r2.write", "account-settings.read", "containers.write", "connectivity-directory.bind", "account-logs.read"],
  /* R46 (K2155, K3818): the scope that reads every Logpush API call's job list, named here so the reason is in one place. When
     Cloudflare refuses the read anyway, the check says plainly that it could not look (`installer.logs.undetermined`). */
  LOGPUSH_SCOPE: "account-logs.read",
  COOKIE:    "bio_wiz",
  COOKIE_MAX_AGE_S: 900,
  /* Public releases: two committed files in the repo's release/ folder on
     main, readable without any API token or rate limit. RELEASE.json names
     the version and the asset's SHA-256, and nothing fetched is ever
     installed without passing that check. */
  RELEASE_LATEST,
  /* R61: where the parts of a release other than the newest are kept, the release's own tag (the built-in release's, when the
     repository has moved on to another). */
  RELEASE_TAGGED,
};

/* The keys this installer trusts to have signed a release live in
 * `signers.mjs`, so the embed step can verify the built-in copy against the
 * SAME list without importing the module it generates (2026-09-18, DIST). */
/* R80: every name this module exported before the split is exported still; the moved ones are `installer-steps`'. */
export { ARMED_SIGNERS, BROWSER_BINDING, INSTANCE_AI_BINDING, SEAL_BINDING, OWN_HOSTS_BINDING, PROFILES_BINDING, SourceUnavailable,
  objectMigrations, CONTAINER_PART, WORKER_PART, containerDescriptor, containerClasses, workerDescriptor, VPC_MEMBER, VPC_BINDING, vpcServiceOk,
  planeLimits, memberLimits, reportsBuilds, instanceAiOk, PER_REQUEST_DATASET, filterExcludes } from "./steps/index.mjs";
async function fetchRepoManifest() {
  const rj = await fetch(CFG.RELEASE_LATEST + "/RELEASE.json", { redirect: "follow", headers: relHeaders });
  if (!rj.ok) throw new Error("manifest http " + rj.status);
  return rj.json();
}
/* R33 (K3441, K4234) — THE BLOB, MADE AS THE BYTES ARRIVE. A release is held once in the form an upload needs, a Blob, and its
   hash is taken from the chunks as they come (`Sha256`, a 64-byte block of state), so the download is never gathered whole beside
   the Blob and never read whole by the engine (`arrayBuffer()` holds the chunks and then their concatenation). Chunks are folded
   into the Blob a few MB at a time, so the pending pieces are few. `take` answers `{blob, sha}`. */
const BLOB_TYPE = "application/javascript+module", BLOB_STEP = 1 << 22;
async function blobOf(stream) {
  const sha = new Sha256(), reader = stream.getReader();
  let blob = new Blob([], { type: BLOB_TYPE }), pending = [], held = 0;
  const fold = () => { if (pending.length) blob = new Blob([blob, ...pending], { type: BLOB_TYPE }); pending = []; held = 0; };
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    sha.update(r.value); pending.push(r.value); held += r.value.length;
    if (held >= BLOB_STEP) fold();
  }
  fold();
  return { blob, sha: sha.hex() };
}
async function fetchRepoAsset(man) {
  const ra = await fetch(CFG.RELEASE_LATEST + "/" + (man.asset || "bio-plane.bundled.mjs"), { redirect: "follow", headers: relHeaders });
  if (!ra.ok) throw new Error("asset http " + ra.status);
  const { blob, sha: got } = await blobOf(ra.body ?? new Blob([]).stream());
  if (got !== man.sha256) {
    const e = new Error("integrity"); e.integrity = true; throw e;
  }
  /* What is read from the verified bytes (R20's limits, R15's build fields, the signature) is read from one view of the Blob,
     made now and let go at the end of this function, so the release is held as the Blob and, for this moment only, as the view
     (the signature check takes its message whole). They are never decoded into a string (a 29 MB module with a few non-Latin-1
     characters is a 58 MB string). */
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (ARMED_SIGNERS.length) {
    if (typeof man.sig !== "string" || !man.sig.trim()) {
      const e = new Error("unsigned"); e.unsigned = true; throw e;
    }
    const v = await verifySshsig(man.sig, bytes, NS_RELEASE, ARMED_SIGNERS);
    if (!v.ok) {
      const e = new Error("signature"); e.signature = true; e.reason = v.reason; throw e;
    }
  }
  return { blob, sha: got, limits: planeLimits(bytes), capable: reportsBuilds(bytes) };
}

/* R33 (K3441, K3442, K4210; N1240) — THE BUILT-IN RELEASE, HELD ONCE, AND CARRIED PACKED. `release.mjs` carries the signed plane as
   the base64 of its gzip (10 MB where the plane is 29 MB), and the two facts the installer reads from its text, its limits (R20) and
   whether it reports builds (R15), taken by the embed step from the verified bytes. What an act uploads is one Blob made from it,
   expanded once by `DecompressionStream` as the packed text is fed in a few MB at a time (never the packed bytes, the expanded
   bytes and the Blob side by side), kept for every upload of the act and the isolate's life. Its hash is taken as the bytes come out
   and must equal the signed manifest's (the embed step refused unless the embedded bytes hash to it, R26): a release that does not
   expand to the signed bytes is not uploaded. The bytes uploaded are exactly the signed release's. */
const PACKED_STEP = 1 << 22;                       /* base64 characters fed at a time: a multiple of 4 */
async function unpackBuiltIn() {
  let at = 0;
  const packed = new ReadableStream({ pull(c) {
    if (at >= RELEASE_PACKED.length) return c.close();
    const bin = atob(RELEASE_PACKED.slice(at, at += PACKED_STEP)), part = new Uint8Array(bin.length);
    for (let i = 0; i < part.length; i++) part[i] = bin.charCodeAt(i);
    c.enqueue(part);
  } });
  const { blob, sha } = await blobOf(packed.pipeThrough(new DecompressionStream("gzip")));
  if (sha !== RELEASE_MANIFEST.sha256) throw new Error("the built-in release does not expand to the release that was signed");
  return blob;
}
let builtInBlob = null;
async function builtInRelease() {
  builtInBlob ??= unpackBuiltIn().catch((e) => { builtInBlob = null; throw e; });
  return { blob: await builtInBlob, sha: RELEASE_MANIFEST.sha256, capable: RELEASE_FACTS.capable };
}

/* R61: the built-in release is installed with ITS OWN signed manifest (embedded with it, `RELEASE_MANIFEST`), and its members are
   fetched from where its own release is kept: the newest release's folder when the repository still holds this release there,
   its tag's otherwise. */
const builtInBase = (repoMan) => (repoMan && String(repoMan.version) === RELEASE_VERSION ? CFG.RELEASE_LATEST : CFG.RELEASE_TAGGED(RELEASE_VERSION));

/* The installer prefers the newest verified release from the public
   repository and always has its built-in copy to stand on. It never installs
   anything that failed verification, and it always says which copy it used
   and why, in words a person can act on. */
async function selectRelease(emit) {
  await emit.step("rel", word("installer.step.release.install"));
  /* The manifest travels with the selection (IC-82): the fleet half reads
     `fleet[]`/`fleetSig` from it. null means the repository was unreachable —
     a STATED absence the fleet step reports, never rounds to "no members". */
  let man = null, said = "";
  const builtin = RELEASE_VERSION;
  try {
    man = await fetchRepoManifest();
    if (vcmp(man.version, RELEASE_VERSION) > 0) {
      const { limits: lim, ...asset } = await fetchRepoAsset(man);
      /* R20: verified bytes that state no readable limits are not used either; the built-in stands in, and the page says why. */
      if (lim.ok) {
        emit.ok("rel", ARMED_SIGNERS.length
          ? word("installer.release.newer.signed", { version: man.version, builtin })
          : word("installer.release.newer.checked", { version: man.version, builtin }));
        return { version: String(man.version), ...asset, from: "repository", man, limits: lim.limits };
      }
      said = lim.why === "none" ? word("installer.release.nolimits", { version: man.version, builtin })
        : word("installer.release.badlimits", { version: man.version, builtin });
    } else said = word("installer.release.current", { builtin });
  } catch (e) {
    /* R11: a repository that answered, but whose plane failed verification, was REACHABLE: its manifest stays, so the
       fleet step names the true reason its members are left out (they are signed against a plane this act did not
       install) rather than "not reachable". Only a repository that did not answer leaves no manifest. */
    if (!(e && (e.integrity || e.unsigned || e.signature))) man = null;
    const tail = " " + word("installer.release.fallback.tail", { builtin });
    said = e && e.integrity ? word("installer.release.fallback.integrity") + tail
      : e && e.unsigned ? word("installer.release.fallback.unsigned") + tail
      : e && e.signature ? word("installer.release.fallback.wrongsigner", { reason: e.reason || "invalid" }) + tail
      : word("installer.release.fallback.unreachable", { builtin });
  }
  /* R20: the built-in is held to the same rule. One that states no readable limits is refused by name, before any plane
     upload; the caller stops the act (`refused`) and nothing installs. */
  const lim = RELEASE_FACTS.limits;
  if (!lim.ok) {
    emit.no("rel", said);
    return { refused: lim.why === "none" ? word("installer.release.refused.none", { builtin }) : word("installer.release.refused.unreadable", { builtin }) };
  }
  emit.ok("rel", said);
  return { version: RELEASE_VERSION, ...(await builtInRelease()), from: "built-in", man: RELEASE_MANIFEST, base: builtInBase(man), limits: lim.limits };
}

/* R55 (T48; N1047; DEC-226 (4); K3158) — THE UPDATE INSTALLS THE RELEASE CHOSEN AND NO OTHER. `V` is the version the team's
   administrator chose in Settings › Updates (`GET /update?version=<V>` through `/begin`'s cookie). The release installed is the
   repository's, when its manifest names exactly V, or the built-in one, when V is the version this installer carries. The
   repository's is held to R8's checks (its bytes hash to its manifest's `sha256`, its `sig` verifies in the release namespace
   against ARMED_SIGNERS, which are `signatures`' RELEASE_KEYS, R43) and to R20's (it states its limits). R8's "newer than the
   built-in" does not choose: V does. A release of any other version, or one failing a check, is not installed, and the answer
   says why in words; nothing is uploaded. Answers `{version, blob, capable, sha?, from, man, limits}` like selectRelease, or `{stop}`. */
async function selectChosen(emit, V) {
  await emit.step("rel", word("installer.step.release.update", { version: V }));
  const stop = (said) => { emit.no("rel"); return { stop: said }; };
  const unlimited = (lim) => stop(lim.why === "none" ? word("installer.update.stopped.nolimits", { version: V }) : word("installer.update.stopped.badlimits", { version: V }));
  let man = null, unreachable = false;
  try { man = await fetchRepoManifest(); } catch { unreachable = true; }
  const builtIn = V === RELEASE_VERSION;
  /* An update is never installed on hashes alone: with no key to verify against, nothing is a signed release. */
  if (!ARMED_SIGNERS.length) return stop(word("installer.update.stopped.nokeys", { version: V }));
  if (!builtIn) {
    if (unreachable) return stop(word("installer.update.stopped.unreachable", { version: V }));
    if (!man || String(man.version) !== V) return stop(word("installer.update.stopped.norelease", { version: V }));
    let asset;
    try { asset = await fetchRepoAsset(man); }
    catch (e) {
      return stop(e && e.integrity ? word("installer.update.stopped.integrity", { version: V })
        : e && e.unsigned ? word("installer.update.stopped.unsigned", { version: V })
        : e && e.signature ? word("installer.update.stopped.wrongsigner", { version: V })
        : word("installer.update.stopped.unreachable", { version: V }));
    }
    const { limits: lim, ...rest } = asset;
    if (!lim.ok) return unlimited(lim);
    emit.ok("rel", UPDATE_WORDS.progressVerified(V));
    return { version: V, ...rest, from: "repository", man, limits: lim.limits };
  }
  const lim = RELEASE_FACTS.limits;
  if (!lim.ok) return unlimited(lim);
  emit.ok("rel", UPDATE_WORDS.progressVerified(V));
  return { version: V, ...(await builtInRelease()), from: "built-in", man: RELEASE_MANIFEST, base: builtInBase(man), limits: lim.limits };
}

/* ------------------------------------------------------------------ utils */

const enc = new TextEncoder();
const s256 = async (s) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));

const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });
const html = (s, status = 200, headers = {}) =>
  new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

/* Only what the browser will render as text gets escaped. Secrets we
   generate are base64url and need no escaping, but error detail from the
   management API is arbitrary text and goes through here. */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const slugOk = (s) => typeof s === "string" && GROUP_SLUG_RE.test(s) && s !== "newgroup";

const readCookie = (req, name) => {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
};
const setCookie = (v, maxAge) =>
  `${CFG.COOKIE}=${v}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

/* ---------------------------------------------------- management API glue */

/* R66, R71 (F4, F6): the sign-in's token exchange waits out what waiting can mend, as every call to Cloudflare does: a 429 or a
   5xx or a dropped connection backs off within the bound (a wait is drawn through `onWait`), and what is still failing at the
   bound is a lasting failure, named. An answer that refuses the code is the stop it always was. */
async function exchange(code, verifier, onWait = null) {
  const body = new URLSearchParams({
    grant_type: "authorization_code", code, redirect_uri: CFG.REDIRECT,
    client_id: CFG.CLIENT_ID, code_verifier: verifier,
  });
  return patiently(async () => {
    let r;
    try { r = await fetch(CFG.TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }); }
    catch (e) { throw Object.assign(new Error(String(e && e.message || e)), { network: true }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token)
      throw Object.assign(new Error(j.error_description || j.error || `HTTP ${r.status}`), { status: r.status });
    /* R38: the scopes the operator actually granted, as the token response states them (null when it states none). */
    return { token: j.access_token, scope: typeof j.scope === "string" ? j.scope : null };
  }, { onWait });
}

/* R36 (K1502, K1755) — THE INSTALLER BINDS NO CLAUDE CREDENTIAL. The team's Anthropic API key, when the group chooses
 * one, is set inside the copy by an administrator (`credentials`' sealed table), and a member's own account is connected
 * there by the member. Nothing here takes, generates, binds or shows one, and an update removes the binding a copy
 * installed before K1502 may hold (keep_bindings would otherwise keep it). */
export const RETIRED_CLAUDE_BINDING = "INSTANCE_CLAUDE_TOKEN";

/* R37 and R17 (T36; N711, N721; DEC-172) — THE BINDINGS NO INSTALLER WRITES ANY MORE. The install takes no choice about
   the assistant (its two settings are made in your team's Civicsmith at its setup, setup-page R18) and generates no
   shared member key (R9). An update leaves neither behind, as it leaves no INSTANCE_CLAUDE_TOKEN (R36): each held
   before the update is removed, a secret by its own deletion and a plain value by the update's upload (which keeps no
   plain value it does not restate), and a refused deletion is named. `RETIRED_BINDINGS` is every such name, with the
   suffix of the `installer.keys.retired.*` key that says what it was. */
export const ASSISTANT_BINDING = "ASSISTANT_ENABLED";
export const MEMBER_BINDING = "MEMBER_TOKEN";
export const RETIRED_BINDINGS = Object.freeze([
  [RETIRED_CLAUDE_BINDING, "claude"],
  [MEMBER_BINDING, "member"],
  [ASSISTANT_BINDING, "assistant"],
]);
const HELD_CHOICES = new Set(PROFILE_CHOICES.map((p) => p.id));
/* The refusal for a `profiles` value /begin cannot bind, or null. */
function profilesRefusal(v, mode) {
  if (v === undefined) return null;
  if (mode === "update") return word("installer.profiles.refused.update");
  if (!Array.isArray(v)) return word("installer.profiles.refused.notalist");
  const bad = v.filter((id) => typeof id !== "string" || !HELD_CHOICES.has(id));
  if (bad.length) return word("installer.profiles.refused.unknown", { list: bad.map((x) => JSON.stringify(x)).join(", ") });
  if (new Set(v).size !== v.length) return word("installer.profiles.refused.twice");
  return null;
}

const lagList = (v) => `<ul>${v.lags.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
const UNDETERMINED_BUILDS = word("installer.verify.undetermined");

/* -------------------------------------------------------- the progress page
   The callback streams HTML: the shell renders immediately, then each
   provisioning step lands as a small script as it starts and as it ends. Live progress
   with the token never leaving this Worker, and nothing to poll.

   R51 (DEC-201 (4)): one plain line per step, drawn as it starts and redrawn as it ends (`cs-row`, its state in a word
   beside it). A stop (R75) is one sentence by key, which says the cause, what was or was not changed ("nothing was
   created", R4; the copy keeps running as it was, R52) and what to do; the step it stopped at (the line in progress,
   carried as `fail`'s third argument) is named beside it. The shell holds exactly one script, before every streamed one. */

const STATE_WORD = Object.freeze({ go: word("installer.state.go"), ok: word("installer.state.ok"), no: word("installer.state.no") });
/* R69: how long a progress page may hear nothing before it says the run stopped (longer than the 5-minute wait it draws for Cloudflare). */
const STREAM_QUIET_MS = 8 * 60e3;
function progressShell(title, slug, retry = null) {
  return `${pageHead(title, { noindex: true })}
<body class="cs"><main class="cs-frame ng">
${pageMark()}
<h1>${esc(title)}</h1>
<p class="small">${around(word("installer.progress.forteam", { name: SLOT }), `<b class="mono" id="group">${esc(slug)}</b>`)}</p>
<p class="small" id="says" hidden></p>
<div id="log" class="cs-sheet ng-log"></div>
<p class="small" id="waiting" role="status" hidden></p>
<div id="fail" class="ng-stop" role="alert" hidden><p id="fail-p"></p><p id="fail-d"></p><p class="small" id="fail-s"></p><div class="ng-acts" id="fail-again" hidden></div><p class="err" id="fail-err" role="alert"></p>${retry
  ? `<div class="ng-acts" id="fail-acts"><a class="cs-btn" data-tone="primary" id="try-again" href="${esc(retry)}">${esc(UPDATE_WORDS.tryAgain)}</a></div>` : ""}</div>
<div id="done" class="ng-stage" hidden></div>
${publisherFooter()}
<script>
const $=s=>document.querySelector(s);const rows={};const W=${JSON.stringify(STATE_WORD)};
let ended=false,seen=Date.now();const touch=()=>{seen=Date.now();};
function mark(d,r,label){d.dataset.r=r;d.firstChild.textContent=W[r];if(label)d.children[1].textContent=label;}
function step(id,label){touch();const d=document.createElement("div");d.className="cs-row";d.id="r-"+id;
 d.innerHTML='<span class="mk"></span><span></span><span></span>';mark(d,"go",label);$("#log").appendChild(d);rows[id]=d;}
function says(t){touch();$("#says").textContent=t;$("#says").hidden=false;}
function waiting(t){touch();$("#waiting").textContent=t;$("#waiting").hidden=false;}
function ok(id,label){touch();const d=rows[id];if(d){mark(d,"ok",label);$("#waiting").hidden=true;}}
function no(id,label){touch();const d=rows[id];if(d)mark(d,"no",label);}
function fail(p,d,s){ended=true;$("#waiting").hidden=true;$("#fail").hidden=false;$("#fail-p").textContent=p;$("#fail-d").textContent=d||"";$("#fail-s").textContent=s||"";}
async function go(body,err){try{const r=await fetch("/begin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();if(!j.ok){err.textContent=j.error||"";return;}location.href=j.authorize;}catch(e){err.textContent=String(e.message||e);}}
const slugify=v=>v.toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
function wire(){
 const E=id=>document.getElementById(id);
 document.querySelectorAll("[data-begin]").forEach(b=>b.addEventListener("click",()=>{
  const err=E("begin-err")||b;const body=JSON.parse(b.dataset.begin);
  if(b.dataset.slugFrom){body.slug=slugify(E(b.dataset.slugFrom).value);const d=E("alongside-dialog");
   if(body.slug.length<3){err.textContent="";return;}
   if(d){E("alongside-name").textContent=body.slug;d.dataset.body=JSON.stringify(body);d.showModal();return;}}
  if(b.dataset.typedFrom)body.typed=E(b.dataset.typedFrom).value.trim();
  if(b.dataset.subFrom)body.subdomain=E(b.dataset.subFrom).value.trim().toLowerCase();
  go(body,err);}));
 const y=E("alongside-yes");if(y)y.addEventListener("click",()=>{const d=E("alongside-dialog");d.close();go(JSON.parse(d.dataset.body),E("begin-err"));});
 const n=E("alongside-no");if(n)n.addEventListener("click",()=>E("alongside-dialog").close());
 const t=E("typed"),c=E("confirm-remove");
 if(t&&c){c.disabled=true;t.addEventListener("input",()=>{c.disabled=t.value.trim()!==c.dataset.slug;});}}
function again(label,body){const a=$("#fail-again"),b=document.createElement("button");b.className="cs-btn";b.dataset.tone="primary";b.textContent=label;
 b.addEventListener("click",()=>go(body,$("#fail-err")));a.appendChild(b);a.hidden=false;}
function done(html){ended=true;$("#fail").hidden=true;$("#done").innerHTML=html;$("#done").hidden=false;wire();
 document.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",async()=>{
  await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent);
  const t=b.textContent;b.textContent=${jsLit(word("installer.copy.done"))};setTimeout(()=>b.textContent=t,1400);}));
 const h=$("#handover");if(h)h.addEventListener("click",()=>{location.href=h.dataset.url+"#boot="+encodeURIComponent(document.getElementById("out-boot").textContent);});}
/* R33, R69 (F2): a stream that ends, or goes quiet, with neither a panel nor a stop is a stop too, named at the step in progress. */
const LOST=${jsLit(word("installer.stopped.unexpected", { said: "\u0001" }))},AT=${jsLit(word("installer.stopped.at", { step: "\u0001" }))};
function lost(){if(ended)return;const rs=document.querySelectorAll("#log .cs-row");const last=rs[rs.length-1];
 const at=last&&last.children[1]?AT.replace("\\u0001",last.children[1].textContent):"";fail(LOST.replace("\\u0001",at),"","");ended=false;}
window.addEventListener("load",lost);setInterval(()=>{if(!ended&&Date.now()-seen>${STREAM_QUIET_MS})lost();},15000);
</script>`;
}

/* R19: every value streamed into a <script> is JSON with `<`, `>`, `&` and the two JavaScript line separators escaped,
   so text from the management API (an error message, an account's name) can never close the script element it rides
   in; the page then sets it as text, never as markup. */
const jsLit = (v) => JSON.stringify(v).replace(/[<>&\u2028\u2029]/g,
  (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const jsStr = (s) => jsLit(String(s ?? ""));

function streamPage(headers, shell, run, again = null) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const write = (s) => w.write(enc.encode(s));
  /* R51: the line in progress, which a stop names. */
  const lines = new Map();
  let current = null;
  const emit = {
    step: (id, label) => { lines.set(id, label); current = id;
      return write(`<script>step(${jsStr(id)},${jsStr(label)})</script>\n`); },
    ok:   (id, label) => { if (label) lines.set(id, label);
      return write(`<script>ok(${jsStr(id)}${label ? "," + jsStr(label) : ""})</script>\n`); },
    no:   (id, label) => { if (label) lines.set(id, label);
      return write(`<script>no(${jsStr(id)}${label ? "," + jsStr(label) : ""})</script>\n`); },
    /* `at`: the step a stop names when it is not the line in progress (a stop said after later lines were drawn). */
    fail: (said, d = "", at = current) => write(`<script>no();fail(${jsStr(said)},${jsStr(d)},${jsStr(at && lines.get(at) ? word("installer.stopped.at", { step: lines.get(at) }) : "")})</script>\n`),
    says: (text)      => write(`<script>says(${jsStr(text)})</script>\n`),
    /* R66: the line drawn while a wait on Cloudflare or the address goes on. */
    wait: (text)      => write(`<script>waiting(${jsStr(text)})</script>\n`),
    done: (inner)     => write(`<script>done(${jsLit(inner)})</script>\n`),
    /* R70: after a stop that waits for the founder to turn something on, the one act that begins the run again (as R71's). */
    retry: (label)    => again ? write(`<script>again(${jsStr(label)},${jsLit(again)})</script>\n`) : undefined,
    /* R84: the body a choice begins the run again with: what the run held, and the one thing chosen. */
    body: (extra = {}) => ({ ...(again || {}), ...extra }),
  };
  (async () => {
    await write(shell);
    try { await run(emit); }
    catch (e) {
      /* R71 (F6): a permission that expired or was revoked asks for approval again, and the run continues from where it
         stopped (R69). R66: what waiting did not mend is a lasting failure, named, with one action. */
      if (e && e.approveAgain && again) {
        await emit.fail(e.said || word("screen.install.approveagain"));
        await emit.done(approvePanel(again));
      } else if (e && e.lasting) {
        await emit.fail(word("screen.install.stopped.lasting"), word("screen.install.stopped.lasting.do"));
      } else if (e && e.source) {
        await emit.fail(word("screen.install.stopped.source"), word("screen.install.stopped.source.do"));
      } else
      await emit.fail(word("installer.stopped.unexpected", { said: String(e && e.message || e) }));
    }
    await write("</body></html>");
    await w.close();
  })();
  return new Response(readable, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

/* R71 (F6): the one act of the page that asks for approval again: a new `POST /begin` carrying what the run was, after which
   the run continues from where it stopped. It carries the choices the run held, never a credential. */
function approvePanel(body) {
  const label = body.mode === "update" ? word("act.bootstrap.label.update") : word("act.bootstrap.label.install");
  return `<div class="ng-acts"><button class="cs-btn" data-tone="primary" data-begin="${esc(JSON.stringify(body))}">${esc(label)}</button></div><p class="err" id="begin-err" role="alert"></p>`;
}

/* R84 (6): the account of this run. One account is used; with several the founder chooses one by name (a new `POST /begin`
   carrying the choice, as every choice is) and nothing is touched meanwhile. Answers the account, or null after drawing the choice. */
async function accountOf(emit, accts, chosen) {
  const pick = pickAccount(accts, chosen);
  if (pick.acct) { emit.ok("acct", word("installer.account.using", { account: pick.acct.name })); return pick.acct; }
  emit.no("acct", accountSentence());
  await emit.done(accountPanel(pick.choose, emit.body()));
  return null;
}
/* R84: a readiness stop, drawn as the install's stops are: one sentence and the way on; an unmet permission asks to approve again
   (R71); every other ends with "Check again", which begins the run again with the choices kept (`emit.retry`). */
async function halt(emit, step, stop) {
  emit.no(step);
  if (stop.approveAgain) throw Object.assign(new Error(stop.said), { approveAgain: true, said: stop.said });
  await emit.fail(stop.said, stop.d || "");
  if (stop.retry) await emit.retry(stop.retry);
}

/* ---------------------------------------------------------- provisioning */


/* DIST-9: say which way the organisation `ai` credential went — never its value. */
async function instanceAiNotice(emit, mode, carried) {
  await emit.step("ai", word("installer.step.aikey"));
  if (carried) return emit.ok("ai", word("installer.ai.given"));
  emit.ok("ai", mode === "update" ? word("installer.ai.none.update") : word("installer.ai.none.install"));
}

/* K1541, R36 and R17 (T36) on an update: the seal secret added only where none was held, and every retired binding an
   earlier installer left (RETIRED_BINDINGS: a team-wide Claude credential, the shared member key, the assistant choice)
   removed. Each outcome is said; an unread settings page is said as unread, never as "none". */
async function accountSecretsNotice(emit, token, acct, slug, held, seal) {
  await emit.step("keys", word("installer.step.memberkeys"));
  if (!held) return emit.no("keys", word("installer.keys.unread"));
  const said = [seal ? word("installer.keys.sealed.new") : word("installer.keys.sealed.kept")];
  let ok = true;
  for (const [name, kind] of RETIRED_BINDINGS) {
    const type = held.get(name);
    if (!type) continue;
    const what = word(`installer.keys.retired.${kind}`);
    /* A plain value is not kept by the update's upload, which did not restate it: it is gone already. */
    if (type !== "secret_text") { said.push(word("installer.keys.retired.gone", { what })); continue; }
    try {
      await cf(token, `/accounts/${acct}/workers/scripts/${slug}/secrets/${name}`, { method: "DELETE" });
      said.push(word("installer.keys.retired.removed", { what }));
    } catch (e) {
      ok = false;
      said.push(word("installer.keys.retired.refused", { what, said: e.message, name }));
    }
  }
  said.push(ASSISTANT_OWN_ACCOUNTS);
  return ok ? emit.ok("keys", said.join(" ")) : emit.no("keys", said.join(" "));
}

/* R37 (T36; N721, DEC-172; K1957): the installer takes no choice about the assistant and binds no Claude credential
   (R36); the page says where its two settings are made, in the install page's own words (ui.mjs, ASSISTANT_OFFER). */
export const ASSISTANT_OWN_ACCOUNTS = ASSISTANT_OFFER.replace(/\s+/g, " ").trim();
async function assistantNotice(emit) {
  await emit.step("assist", word("installer.step.assistant"));
  emit.ok("assist", ASSISTANT_OWN_ACCOUNTS);
}

/* ----------------------------------------------------------- what is missing is found first (R70; F2, F3, F7) */

/* The release version an update from the "already holds a copy" page installs: the repository's newest when it is newer than
   the built-in, else the built-in (the update itself verifies it, R55). */
async function newestVersion() {
  try { const man = await patiently(async () => { const r = await fetch(CFG.RELEASE_LATEST + "/RELEASE.json", { redirect: "follow", headers: relHeaders });
      if (!r.ok) throw Object.assign(new Error("manifest http " + r.status), { status: r.status }); return r.json(); }, { minutes: 0.2 });
    if (man && versionOk(String(man.version)) && vcmp(man.version, RELEASE_VERSION) > 0) return String(man.version);
  } catch { /* the built-in stands */ }
  return RELEASE_VERSION;
}
const memberNamesOf = (release) => [...new Set([...BINDING_OF.keys(), ...RELEASE_MANIFEST.fleet.map((m) => m.member),
  ...(Array.isArray(release?.man?.fleet) ? release.man.fleet.map((m) => m && m.member).filter((m) => typeof m === "string") : [])])];

/* R74 (N1239; DEC-329 (7); BOB's reading, K3892) — WHAT AN UPDATE STOPS FOR AS FOREIGN. Before any upload, an update lists the
   container applications the account holds on the Durable Object namespaces of the copy's own Workers (the plane's and each
   member's: the list R65 deletes by) and stops when one carries a name that is not one of the copy's names for that member's
   class (`names.app`, R64: the fixed names for a copy that keeps them): the copy holds something not recognized as this copy's. An
   application under the copy's names for a class the chosen release no longer has is a retired part, not foreign: it is left in
   place, and is answered in `retired` for the update's checks to say. Nothing is deleted or changed. A list the permission cannot
   read is not a stop (R74 stops on what it finds); an application on another copy's Workers (R64) is not this copy's to judge. */
async function foreignContainers(api, names, release, loaded) {
  const memberScripts = new Map(memberNamesOf(release).map((m) => [names.member(m), m]));
  const [spaces, apps, scripts] = await Promise.all([listNamespaces(api), listApps(api), listScripts(api)]);
  const mine = new Map(spaces.filter((s) => s && (s.script === names.slug || memberScripts.has(s.script))).map((s) => [s.id, s]));
  const wanted = new Set((loaded?.members || []).flatMap((L) => (L.classes || []).map((c) => `${L.m.member}/${c.class_name}`)));
  const retired = [];
  for (const a of apps) {
    const ns = a && a.durable_objects ? mine.get(a.durable_objects.namespace_id) : null;
    if (!ns) continue;
    const member = memberScripts.get(ns.script);
    const own = member !== undefined && (a.name === names.app(member, ns.class, false) || a.name === names.app(member, ns.class, true));
    if (!own) return { foreign: true, retired };
    if (!wanted.has(`${member}/${ns.class}`)) retired.push(a.name);
  }
  /* F11: the Workers on the copy's member names are examined too. One of this installer's carries the `VERSION` it was
     uploaded with (every member upload states it); a Worker on a member's name that does not is something else standing on the
     copy's name: foreign. A Worker with the mark on the name of a member this release no longer has is a retired part: named, left.
     A Worker whose settings cannot be read is not judged (R74 stops on what it finds). */
  const inRelease = new Set((release?.man?.fleet || []).map((m) => m && m.member));
  for (const [script, member] of memberScripts) {
    if (!scripts.has(script)) continue;
    const bindings = await bindingsOf(api, script);
    if (bindings === null) continue;
    if (!bindings.some((b) => b.name === "VERSION" && b.type === "plain_text")) return { foreign: true, retired };
    if (!inRelease.has(member) && !(loaded?.members || []).some((L) => L.m.member === member)) retired.push(script);
  }
  return { foreign: false, retired };
}

/* R62, R63: what the account already holds, drawn: each copy by its own worker's answers (stored nowhere), and the installer's
   own counts where the worker states none. */
async function describeHeld(token, acct, inv, memberNames, only = null, onWait = null) {
  const api = apiOf(token, acct);
  let prefix = null;
  try { prefix = (await cf(token, `/accounts/${acct}/workers/subdomain`))?.subdomain || null; } catch (e) { if (special(e)) throw e; }
  const [spaces, apps] = await Promise.all([listNamespaces(api), listApps(api).catch((e) => { if (special(e)) throw e; return []; })]);
  const out = [];
  for (const copy of allCopies(inv)) {
    if (only && copy.slug !== only) continue;
    const address = copy.plane && prefix ? `https://${copy.slug}.${prefix}.workers.dev` : null;
    const facts = await readCopyFacts(address, onWait);
    const fallback = ["projects", "documents", "published", "members"].some((k) => facts[k].known) ? null
      : await countsViaApi(api, copy, memberNames, inv.scripts, spaces, apps);
    out.push({ ...describeCopy(copy, address, facts, fallback), plane: copy.plane, team: facts.team.known ? facts.team.value : null });
  }
  return out;
}

/* ---------------------------------------------------------------- the install */

async function runInstall(emit0, code, saved) {
  const guard = { drop: null };
  try { return await installRun(emit0, code, saved, guard); }
  finally { if (guard.drop) await guard.drop(); }
}

async function installRun(emit0, code, saved, guard) {
  const slug = saved.slug;
  const alongside = saved.al === 1;
  const names = namesFor(slug, SLUG_SCHEME);
  let token, scope, api;
  /* R66: a wait on Cloudflare is drawn once as it begins, and the lock (R69) is touched with it. */
  const onWait = async (waited) => {
    if (api) touchLock(api, saved.lock.id).catch(() => {});
    if (waited === 0) await emit0.wait(word("screen.install.progress.retrying", { minutes: WAIT_BOUND_MINUTES }));
  };
  const emit = { ...emit0, step: async (id, label) => { if (api) await touchLock(api, saved.lock.id).catch(() => {}); return emit0.step(id, label); } };

  await emit.step("auth", word("installer.step.auth"));
  try { const ex = await exchange(code, saved.v, onWait); token = new Session(ex.token, onWait); scope = ex.scope; emit.ok("auth"); }
  catch (e) {
    emit.no("auth");
    if (special(e)) throw e;
    return emit.fail(word("installer.install.stopped.permission", { said: e.message }));
  }
  /* R84 (5): before the first call, the permission granted is compared with what every install needs. */
  const lacking = scopesStop(scope, CFG.SCOPES);
  if (lacking) throw Object.assign(new Error(lacking.said), { approveAgain: true, said: lacking.said });

  await emit.step("acct", word("installer.step.acct"));
  let acct;
  try {
    const accts = await cf(token, "/accounts");
    if (!accts?.length) throw new Error(word("installer.account.none"));
    acct = await accountOf(emit, accts, saved.ac);
    if (!acct) return;
  } catch (e) {
    if (special(e)) throw e;
    emit.no("acct");
    return emit.fail(word("installer.install.stopped.account", { said: e.message }));
  }
  api = apiOf(token, acct.id);

  /* R69 (F9): one run at a time. */
  try {
    if (!(await takeLock(api, saved.lock))) return emit.fail(word("installer.stopped.running"));
    guard.drop = () => dropLock(api);
  } catch (e) { if (special(e)) throw e; /* a lock that cannot be taken is not a reason to refuse the install */ }

  /* R84 (1): the account's storage, read without writing, before anything else reads the account (the look at what it holds lists
     its buckets, which an account without R2 refuses). */
  await emit.step("ready", word("installer.step.storage"));
  try {
    const stop = await storageReady(token, acct.id);
    if (stop) return await halt(emit, "ready", stop);
    emit.ok("ready");
  } catch (e) {
    if (special(e)) throw e;
    emit.no("ready");
    return emit.fail(word("installer.install.stopped.lookup", { said: e.message }));
  }

  /* R62, R64, R69, R70 (F7): what the account already holds, read before anything is created. */
  await emit.step("fresh", word("installer.step.fresh"));
  const memberNames = memberNamesOf(null);
  let resumed = false;
  try {
    const inv = await inventory(api, memberNames);
    const ours = inv.planes.find((p) => p.slug === slug);
    const partial = inv.orphans.slugged.has(slug);
    const taken = new Set([...inv.scripts.keys(), ...inv.planes.map((p) => p.slug), ...inv.orphans.slugged.keys()]);
    const nametaken = () => { const free = freeName(slug, taken, slugOk);
      emit.no("fresh");
      return emit.fail(word("screen.install.stopped.nametaken", { name: slug }), free ? word("screen.install.stopped.nametaken.do", { free }) : ""); };
    /* A Worker by this name that is not a Civicsmith's (the lookup, R5: one that fails is a refusal, caught below). */
    if (!ours && (inv.scripts.has(slug) || await scriptExists(token, acct.id, slug))) return nametaken();
    if (ours && ours.finished) {
      if (alongside) return nametaken();                                 /* R64: a name a copy already holds */
    } else if (ours || partial) resumed = true;                          /* R69: begun here under this name, not finished */
    if (!resumed && !alongside && (inv.planes.length || inv.orphans.legacy.length || inv.orphans.slugged.size)) {
      /* R62: nothing is created or changed; the page offers the three ways on. */
      emit.no("fresh", word("screen.install.stopped.exists"));
      const held = await describeHeld(token, acct.id, inv, memberNames, null, onWait);
      return emit.done(existsPanel({ copies: held, version: await newestVersion(), slug, account: saved.ac }));
    }
    emit.ok("fresh", alongside ? word("installer.install.fresh.alongside") : word("screen.install.progress.single"));
  } catch (e) {
    if (special(e)) throw e;
    emit.no("fresh");
    return emit.fail(word("installer.install.stopped.lookup", { said: e.message }));
  }
  if (resumed) await emit.says(word("screen.install.resumed"));

  /* R70, R6 (DIST-3 / DEC-42): the plan check comes BEFORE the first thing this flow creates (the buckets, below), so a
     Free-plan account is refused while there is genuinely nothing to clean up. Refusing IS the fix: the D-106 failure this
     guards is a group getting something quietly different from every description of it — a copy that looks installed and
     degrades under load it was told it could carry. */
  await emit.step("plan", word("installer.step.plan"));
  let planAnswer;
  try { planAnswer = await establishPlan(token, acct.id); }
  catch (e) { if (special(e)) throw e; planAnswer = { plan: "unknown", detail: e.message }; }
  if (planAnswer.plan === "free") {
    emit.no("plan");
    await emit.fail(word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"), word("screen.install.stopped.plan.do"));
    return emit.retry(word("screen.install.stopped.plan.done"));
  }
  if (planAnswer.plan === "unknown") {
    emit.no("plan");
    return emit.fail(word("installer.install.stopped.planunknown", { said: planAnswer.detail }));
  }
  emit.ok("plan", word("screen.install.progress.plan") + (planAnswer.leftover ? ". " + word("installer.probe.leftover", { name: PLAN_PROBE }) : ""));

  /* R84, R70 (F2, F3): the account ready before anything is created: its storage, its Containers, its limits, then its address,
     each unmet condition a walk-through that says nothing was created and offers "Check again". */
  await emit.step("room", word("installer.step.room"));
  let registered = null;
  try {
    const stops = [
      async () => containersStop(await containersState(api), {
        said: word("screen.install.stopped.plan") + " " + word("installer.install.stopped.plan.why"),
        d: word("screen.install.stopped.plan.do"), retry: word("screen.install.stopped.plan.done") }),
      async () => { const limit = await limitReached(api);
        return limit ? { said: word("screen.install.stopped.limit", { limit }), d: word("screen.install.stopped.limit.do"), retry: CHECK_AGAIN() } : null; },
    ];
    for (const check of stops) { const stop = await check(); if (stop) return await halt(emit, "room", stop); }
    /* (4) last, because it is the one check that writes: the name the founder chose with a click is registered before any upload. */
    const address = await addressReady(token, acct.id, slug, saved.sd);
    if (address.ask) {
      emit.no("room", addressSentence(address.ask.taken, address.ask.name));
      return await emit.done(addressPanel(address.ask, emit.body()));
    }
    registered = address.registered || null;
    emit.ok("room");
  } catch (e) {
    if (special(e)) throw e;
    emit.no("room");
    return emit.fail(word("installer.install.stopped.lookup", { said: e.message }));
  }


  /* R20 with R4: the release is chosen before the first thing this flow creates, so a release that states no readable limits
     refuses the install while there is genuinely nothing to clean up. */
  const release = await selectRelease(emit);
  if (release.refused) {
    return emit.fail(word("installer.install.stopped.nolimits", { refusal: release.refused }));
  }
  /* R84 (7): the plane itself, against Cloudflare's size limit for one Worker, before anything is created. */
  const tooBig = planeTooBig(release);
  if (tooBig) return emit.fail(tooBig.said);
  /* R71 (F5), R61: the whole fleet of this release verified and fetched now; a source that stays down ends the run here. */
  let loaded;
  try { loaded = leaveOutOversize(await loadFleet(release, onWait)); }
  catch (e) {
    if (e && e.source) return emit.fail(word("screen.install.stopped.source"), word("screen.install.stopped.source.do"));
    throw e;
  }
  /* R74 (F11): an install that continues an unfinished copy meets the same check as an update, before it creates anything. */
  let retiredParts = [];
  if (resumed) {
    try {
      const found = await foreignContainers(api, names, release, loaded);
      if (found.foreign) return emit.fail(word("installer.install.stopped.foreign"));
      retiredParts = found.retired;
    } catch (e) { if (special(e)) throw e; /* the list could not be read: R74 stops on what it finds */ }
  }

  /* Evidence storage is part of what a team's copy IS: captured documents, web pages, and their timestamp certificates
     live there. If storage cannot be created, nothing is installed, and the page explains the one Cloudflare prerequisite in
     plain terms. */
  await emit.step("r2", word("installer.step.storage"));
  const completed = [];
  try { const there = await ensureBuckets(token, acct.id, names); if (there.length) completed.push(word("installer.partial.what.storage")); emit.ok("r2", word("screen.install.progress.storage")); }
  catch (e) {
    if (special(e)) throw e;
    emit.no("r2");
    return emit.fail(word("installer.install.stopped.storage", { said: e.message }));
  }

  await emit.step("gen", word("installer.step.credentials"));
  /* R9 (T36): four credentials; no shared member key. */
  const secrets = { boot: rand(32), probe: rand(32), daemon: rand(32), seal: rand(32),
                    ...(instanceAiOk(saved.ai) ? { instanceAi: saved.ai } : {}) };
  emit.ok("gen");

  /* DIST-6, step 1: bind only the members this account already holds (see BINDING_OF for the order). */
  const present = await membersPresent(token, acct.id, names);
  if (present.length) completed.push(present.length === 1 ? word("installer.partial.what.programs.one") : word("installer.partial.what.programs.other", { n: present.length }));
  const profiles = Array.isArray(saved.p) && !profilesRefusal(saved.p, "install") ? saved.p : [];
  /* R83: the place /begin read from the founder's request, handed to the creating upload (an upload of a script that exists restates the one it holds). */
  const storeLocation = typeof saved.sl === "string" && saved.sl ? saved.sl : null;
  let selfRefused = false;
  await emit.step("install", word("screen.install.progress.placing"));
  /* R67, R69: the plane is uploaded unless the account already holds exactly this release's deployed state (its bytes, its
     bindings); bytes that match with a binding missing are uploaded, never skipped (S7). */
  const held = (await bindingsOf(api, slug));
  const sync = held ? await planeInSync(token, acct.id, slug, release, held, { names, members: present, profiles }) : false;
  const planeNotes = [];
  const note = planeNote(planeNotes);
  try {
    if (held && sync) {
      completed.push(word("installer.partial.what.software"));
      await rotateSecrets(token, acct.id, slug, secrets, held);
      emit.ok("install", word("installer.install.inplace"));
    } else if (held) {
      completed.push(word("installer.partial.what.connections"));
      await uploadUpdate(token, acct.id, slug, true, release, { names, members: present, secrets, profiles, note });
      emit.ok("install");
    } else {
      await uploadInstall(token, acct.id, slug, secrets, release, { members: present, profiles, names, note, storeLocation });
      emit.ok("install");
    }
  } catch (e) {
    if (special(e)) throw e;
    /* An install carries a service binding to the script this very upload
       creates. That self-reference cannot be rehearsed here — the only way to
       know Cloudflare accepts it is a real install, which is deploy-gated — so
       the ONE thing it must not do is cost a team their copy. Retry once
       without it: a copy that installs and monitors nothing is recoverable (the
       update path binds SELF, so their next update arms it), and a copy that
       never installed is not. Same doctrine as the storage arm of the update:
       an install is never refused over something it can complete later. */
    let degraded = false;
    try {
      if (held) await uploadUpdate(token, acct.id, slug, true, release, { names, members: present, secrets, profiles, noSelf: true, note });
      else await uploadInstall(token, acct.id, slug, secrets, release, { noSelf: true, members: present, profiles, names, note, storeLocation });
      degraded = true;
    } catch (e2) { if (special(e2)) throw e2; /* the original refusal is the one worth reporting */ }
    selfRefused = degraded;
    if (!degraded) {
      emit.no("install");
      return emit.fail(word("installer.install.stopped.refused", { said: e.message }));
    }
    emit.ok("install", word("installer.install.noschedule", { said: e.message }));
  }

  /* R33: the plane just uploaded, read back and hashed against the release; a mismatch is a lag the verdict names. */
  const byteLags = [];
  const readBackInto = async () => { const lag = await readBack(token, acct.id, slug, release);
    if (lag && !byteLags.includes(lag)) byteLags.push(lag); };
  await readBackInto();

  /* IC-82/D-297: the fleet rides the same act. Per-member degradation lives inside installFleet — it never fails the install. */
  const fleet = await installFleet(emit, token, acct.id, slug, release, loaded, { scope, plan: { plan: "paid" }, vpc: saved.vpc, names });
  if (fleet) completed.push(...fleet.completed.filter((m) => !present.includes(m)).map((name) => word("installer.partial.what.helper", { name })));

  /* R14, then R47: the address is enabled before the plane's last upload, so that upload can tell the copy its own
     hosts; with no address the copy is told none, and the page says so. */
  await emit.step("addr", word("installer.step.address.install"));
  let base = null, addrError = null;
  try {
    const { sub, registered: made } = await ensureSubdomain(token, acct.id, slug);
    base = `https://${slug}.${sub}.workers.dev`;
    emit.ok("addr", registered || made ? word("installer.address.prefix", { prefix: registered || made }) : word("screen.install.progress.address"));
  } catch (e) { if (special(e)) throw e; addrError = e; emit.no("addr"); }
  const ownHosts = base ? [hostOf(base)] : null;

  /* DIST-6, step 3: the plane re-PUT bound to every member now present, and (R47) to its own hosts. The buckets exist
     (the r2 step refuses the install otherwise), the DAEMON_TOKEN restated is the one just generated, and SELF is
     restated only if the install kept it. */
  const bound = await bindMembers(emit, token, acct.id, slug, release, present, fleet,
    { withR2: true, daemon: secrets.daemon, noSelf: selfRefused, profiles, ownHosts, writeHosts: true, names });
  if (bound.put) await readBackInto();
  /* DIST-9: told only AFTER the upload that carried it succeeded — never "stored" ahead of the act. */
  await instanceAiNotice(emit, "install", !!secrets.instanceAi);
  await assistantNotice(emit);

  if (addrError) {
    return emit.fail(word("installer.install.stopped.noaddress", { said: addrError.message }), "", "addr");
  }

  /* R69 (F8): what an earlier run left, completed, said. */
  if (resumed && completed.length) await emit.says(word("installer.partial.completed", { what: [...new Set(completed)].join(", ") }));

  /* R46: before `verify` can succeed, no Logpush job may keep a record of each request to the copy's Workers. */
  const logs = await logsStep(emit, token, acct.id, copyWorkers(slug, release, names));
  const logLags = logs.lags;

  await emit.step("verify", word("screen.install.progress.answers"));
  const st = await verifyInstall(base, secrets.probe, onWait);
  /* D-116: answering is not serving. Once the address answers, each part's OWN build is read back — the record
     store's, and each capability worker's through the plane's binding — and a part that is not on this release is
     named. A release that cannot report those builds says so (UNDETERMINED_BUILDS) rather than claiming them. */
  const capable = release.capable;
  /* An install has always taken the selftest as its "answers"; a release that cannot report builds adds nothing to
     read, so the verdict is the selftest's plus the stated undetermined remainder — no new refusal is invented. */
  /* DIST-6: a bindable member whose upload failed is a lag on either branch, never a success over it. */
  const failed = fleet?.left || [];
  const served = !st ? null
    : capable ? await verifyServing(base, release.version, fleet?.done || [], capable, failed, onWait)
    : ((lags) => ({ confirmed: lags.length === 0, lags, capable: false }))(failedLags(failed));
  /* R33's read-back, R46's named jobs and R68's container images: each a lag, and no success while one stands. */
  /* S9: a container member still running the old build after the rollout is restarted, or named as a lag. */
  const boxes = st ? await confirmContainers(token, acct.id, base, release, fleet, onWait) : { lags: [] };
  const verdict = withByteLags(served, [...byteLags, ...logLags, ...(fleet?.imageLags || []), ...boxes.lags], capable);
  if (st && verdict.confirmed) emit.ok("verify", capable ? undefined : word("installer.verify.answers") + " " + UNDETERMINED_BUILDS);
  else if (st) emit.no("verify", word("installer.verify.unconfirmed"));
  else emit.no("verify", word("screen.install.stopped.lasting") + " " + word("screen.install.stopped.lasting.do"));

  /* R78: with the address answering, the installer records the team's short name itself; where it could not, the telling is drawn (R18). */
  const recorded = st ? await recordTeam(emit, base, secrets.boot, slug) : "refused";


  /* R51: the checks the finished panel shows, each as it came out. */
  const servingLags = served ? served.lags.length : null;
  const checks = [
    { r: st ? "ok" : "no", text: st ? word("screen.install.ready.answers") + "." : word("installer.check.noanswer") },
    !st ? { r: "no", text: word("installer.check.builds.notchecked") }
      : !capable ? { r: "und", text: word("installer.check.builds.undetermined") }
      : servingLags === 0 ? { r: "ok", text: word("installer.check.builds.all", { version: release.version }) }
      : { r: "no", text: word("installer.check.builds.some") },
    { r: byteLags.length ? "no" : "ok", text: byteLags.length ? word("installer.check.bytes.no") : word("installer.check.bytes.ok", { version: release.version }) },
    { r: logs.state === "clear" ? "ok" : logs.state === "named" ? "no" : "und",
      text: logs.state === "clear" ? word("screen.install.ready.nolog") + "."
        : logs.state === "named" ? word("installer.check.log.no")
        : word("installer.check.log.undetermined") },
  ];
  /* R61: every part and its version, from the one release's own statement. */
  const parts = [{ name: "civicsmith", version: release.version }, ...((fleet?.done || []).map((m) => ({ name: m, version: String(release.man?.version ?? release.version) })))];
  /* R69 (K3747): the mark written last. Without it a later run takes this copy for one this installer did not finish. */
  let markLag = null;
  try { await putSecret(token, acct.id, slug, MARK, release.version); }
  catch (e) { if (approve(e)) throw e; markLag = word("installer.mark.failed", { said: e.message }); }
  /* F12: the telling says "run the installer again" only when the mark failed (the copy is unfinished, so a run resumes and records it). */
  const told = recorded === "recorded" ? "" : groupNotice("refused", slug, undefined, markLag !== null);
  emit.done(successPanel(base, secrets, !!st, verdict, saved.vpc, checks, parts,
    [...(retiredParts.length ? [word("installer.update.retired", { parts: retiredParts.join(", ") })] : []), ...(markLag ? [markLag] : []), ...planeNotes], told));
}

/* G54: the plane's upload reads the account's settings back for the logs it switched on; when they cannot be read the upload goes on and
   the step says so through `opts.note`, and the founder reads it among the run's other notes (the final panel, the update's page). */
const planeNote = (notes) => (said) => { if (!notes.includes(said)) notes.push(said); };
const NO_KEY = word("installer.success.nokey");
/* R45 (T36): the security-tools paragraph of the final panel and the update's last screen: where the organization's own
   tools are added (setup-page R30), that the installer takes none, and what the operator's VPC choice did. */
function securityToolsNote(vpc) {
  return `<div class="card" id="security-tools"><p style="margin:0">${esc(SECURITY_TOOLS.replace(/\s+/g, " ").trim())} ${esc(vpcServiceOk(vpc)
    ? word("installer.security.note.named")
    : word("installer.security.note.none"))}</p></div>`;
}
/* R51 (DEC-201 (4)): the finished panel. What the checks found (R15's head and lags, then each check as a line), the
   one-time password and the address, once, the probe key folded behind "most teams never need it", R45's security-tools
   note, R34's block, and the hand-over to `<address>/app/setup#boot=<password>` (screens-entry's setup reads it there;
   the page's script reads the password from `out-boot` at the click, so it is written into the page once). */
const CHECK_WORD = Object.freeze({ ok: word("installer.check.passed"), no: word("installer.check.notyet"), und: word("installer.check.undetermined") });
const checkRows = (checks) => `<h2 id="checks-heading">${esc(word("installer.checks.heading"))}</h2><div class="cs-sheet ng-log" id="checks">${checks.map((c) =>
  `<div class="cs-row" data-r="${c.r === "und" ? "go" : c.r}"><span class="mk">${CHECK_WORD[c.r]}</span><span>${esc(c.text)}</span><span></span></div>`).join("")}</div>`;
export const HANDOVER_PATH = "/app/setup";
function successPanel(base, secrets, verified, verdict = null, vpc = null, checks = [], parts = [], notes = [], told = "") {
  const lagging = !!(verdict && !verdict.confirmed);
  const lives = word("installer.success.lives");
  const head = verified && !lagging
    ? `<b>${esc(word("installer.success.running"))}</b> ${esc(word("screen.install.ready.sub"))} ${esc(lives)} ${esc(NO_KEY)}`
      + (verdict && !verdict.capable ? ` ${esc(UNDETERMINED_BUILDS)}` : "")
    : lagging
    ? `<b>${esc(verified ? word("installer.success.lagging.answering") : word("installer.success.lagging"))}</b>
${esc(verified ? word("installer.success.lagging.asked") : word("installer.success.lagging.asleep"))}${lagList(verdict)}${esc(word("installer.success.save"))} ${esc(lives)} ${esc(NO_KEY)}`
    : `<b>${esc(word("installer.success.asleep"))}</b> ${esc(word("installer.success.asleep.why"))} ${esc(lives)} ${esc(NO_KEY)}`;
  return `<h2>${esc(verified && !lagging ? word("installer.success.title.ready") : word("installer.success.title.installed"))}</h2>
<div class="${lagging ? "notice" : "okbox"}"><p>${head}</p></div>
${checks.length ? checkRows(checks) : ""}
${parts.length ? partRows(parts) : ""}
${notes.map((n) => `<div class="notice"><p>${esc(n)}</p></div>`).join("")}
${told}
<section class="cs-section ng-sec" id="one-time">
<h2 id="otp-head">${esc(word("screen.install.otp.head"))}</h2>
<p id="otp-what">${esc(word("screen.install.otp.what"))}</p>
<div class="card">
 <div class="kv"><span class="k">${esc(word("installer.success.otp"))}</span><span class="v" id="out-boot">${secrets.boot}</span><button class="copy" data-copy="out-boot">${esc(word("installer.success.copy"))}</button></div>
 <div class="kv"><span class="k">${esc(word("installer.success.address"))}</span><span class="v" id="out-url">${esc(base)}</span><button class="copy" data-copy="out-url">${esc(word("installer.success.copy"))}</button></div>
</div>
<p class="help" id="otp-help">${esc(word("screen.install.otp.help"))}</p>
<p class="help">${esc(word("screen.install.address.help"))}</p>
</section>
<details class="ng-fold" id="probe-fold"><summary>${esc(word("screen.install.probe.summary"))}</summary>
<div class="card"><div class="kv"><span class="k">${esc(word("installer.success.probe"))}</span><span class="v" id="out-probe">${secrets.probe}</span><button class="copy" data-copy="out-probe">${esc(word("screen.install.probe.copy"))}</button></div></div>
<p class="help">${esc(word("screen.install.probe.help"))}</p></details>
${securityToolsNote(vpc)}
${/* R34 (DEC-109, K1038): before the hand-over to where the founder chooses a password, who really controls your team's
   Civicsmith, in instance-setup's words; nothing asks for or records an acknowledgement of it. */ hostingControlBlock("notice", { deployer: true })}
<p class="small">${esc(word("screen.install.ready.note"))}</p>
<div class="ng-acts"><button id="handover" class="cs-btn" data-tone="primary" data-url="${esc(base)}${HANDOVER_PATH}">${esc(word("screen.install.continue"))}</button></div>`;
}

/* R61: every part the release installed, with its version, from the release's own statement. */
const partRows = (parts) => `<h2 id="parts-heading">${esc(word("installer.parts.heading"))}</h2><div class="cs-sheet ng-log" id="parts">${parts.map((p) =>
  `<div class="cs-row" data-r="ok"><span class="mk"></span><span class="mono">${esc(p.name)} ${esc(p.version)}</span><span></span></div>`).join("")}</div>`;

/* D-436 / IC-172, R18, R78 — RECORDING WHICH TEAM PRODUCES THE RECORD, AND WHAT IS SAID WHEN IT IS NOT RECORDED.
 *
 * A copy records its producing team ONCE: at its store's first boot, from the INSTANCE_NAME `uploadInstall` binds in the
 * same PUT that creates the worker, or, for a store that already held a record when the value arrived, by one act of its
 * root of trust, op=instancegroupseed (the ADMIN_TOKEN credential held in the hosting account: no session of any role
 * reaches it, `UNATTENDED_BY_DECISION`). A run that holds the ADMIN_TOKEN it generated (an install, a resumed install: R9, R69)
 * makes that act itself with the run's own short name (R78, K3868); an update binds no new ADMIN_TOKEN (it would re-arm the
 * claim step, Membership §4.6, §9, K3892), so it reads what the copy records, with no credential (op=instancegroup answers
 * the public projection), and tells the operator when the copy records none (R18). The telling is drawn only for a copy the
 * run could not record, and says to run the installer again: it records the name it was installed under. */
const FIRST_GROUP_RELEASE = "0.71.0";
const SEMVER = /^\d+\.\d+\.\d+$/;
/* What an update says of the team's recording: nothing when the copy records a group; the telling when it records none, or
   when the read was not answered. `recorded` is `readGroup`'s answer. `before` (the version read before the upload) says which
   paragraph explains it. */
function groupUnrecorded(recorded, before) {
  if (recorded === "recorded") return null;
  if (recorded === "unread" || before === null || !SEMVER.test(String(before))) return "unknown";
  return vcmp(before, FIRST_GROUP_RELEASE) < 0 ? "certain" : "unknown";
}
/* F12 (R18, R78, K3892): `runAgain` is true only for a copy KNOWN to be unfinished, where running the installer again resumes it and
   records the name. A finished copy (or one the run could not tell) is sent to the "already holds a copy" page by that advice,
   which records nothing: it is told `installer.team.unrecorded.how.finished` in its place (DEC-365). */
function groupNotice(kind, slug, before, runAgain = false) {
  if (!kind) return "";
  const why = kind === "certain" ? word("installer.team.unrecorded.certain", { before, first: FIRST_GROUP_RELEASE })
    : kind === "unknown" ? word("installer.team.unrecorded.unknown", { first: FIRST_GROUP_RELEASE }) : "";
  return `<div class="notice" id="team-unrecorded"><p style="margin:0 0 .6em"><b>${esc(word("installer.team.unrecorded.head"))}</b></p>
<p>${esc(why ? why + " " : "")}${esc(word("installer.team.unrecorded.effect"))}</p>
<p>${esc(runAgain ? word("installer.team.unrecorded.how") : word("installer.team.unrecorded.how.finished"))}</p>
<p class="small">${esc(word("installer.team.unrecorded.suggest", { slug }))}</p></div>`;
}

/* R78 (K3868, K3878): the copy's own answer about its producing team, read with `Authorization: Bearer` only when a
   credential is given (never in an address, R15, `admission` R20). "recorded" (a group), "none" (`group: null`), or
   "unread" (no address, no answer, an answer that is no object). */
async function readGroup(base, credential = null) {
  if (!base) return "unread";
  try {
    const r = await fetch(`${base}/api/?op=instancegroup`, credential ? { headers: { authorization: `Bearer ${credential}` } } : undefined);
    const j = await r.json();
    /* The copy answers its envelope, `{ ok, result: { ok, group }, store }`: the group is read inside `result`. */
    const g = j && typeof j === "object" ? j.result : null;
    if (!r.ok || !g || typeof g !== "object") return "unread";
    return typeof g.group === "string" && g.group ? "recorded" : g.group === null ? "none" : "unread";
  } catch { return "unread"; }
}
/* R78: the install's step that records the short name. Already recorded: nothing is done and nothing is said. */
async function recordTeam(emit, base, boot, slug) {
  const seen = await readGroup(base, boot);
  if (seen === "recorded") return "recorded";
  await emit.step("record", word("installer.step.record"));
  let said = null;
  if (seen === "unread") said = word("installer.fact.unknown.silent");
  else {
    try {
      const r = await fetch(`${base}/api/?op=instancegroupseed`, { method: "POST",
        headers: { authorization: `Bearer ${boot}`, "content-type": "application/json" }, body: JSON.stringify({ slug }) });
      const j = await r.json().catch(() => null);
      const g = j && typeof j.result === "object" && j.result ? j.result : j;
      if (!j || !(j.ok === true || g.code === "GROUP_ALREADY_RECORDED" || j.code === "GROUP_ALREADY_RECORDED")) said = String((j && (g.code || j.code || g.error || j.error || g.detail || j.detail)) || r.status);
    } catch (e) { said = String(e && e.message || e); }
  }
  if (said === null && (await readGroup(base, boot)) !== "recorded") said = word("installer.fact.unknown.silent");
  if (said === null) { emit.ok("record", word("installer.step.record.done", { slug })); return "recorded"; }
  emit.no("record", word("installer.step.record.refused", { slug, said }));
  return "refused";
}

/* R52 (DEC-201 (8)): the version before and after, as two lines, on the update's last screen; the version before is the
   one `op=bootstrap` answered before the upload (R17), or said unread. */
function versionLines(before, after) {
  const signed = ARMED_SIGNERS.length ? word("installer.update.after.signed") : "";
  const bold = (v) => `<b class="id">${esc(v)}</b>`;
  return `<div class="cs-sheet ng-log" id="versions">`
    + `<div class="cs-row" data-r="ok"><span class="mk">${esc(word("installer.update.label.before"))}</span><span>${before
      ? around(word("installer.update.before.known", { version: SLOT }), bold(before))
      : esc(word("installer.update.before.unknown"))}</span><span></span></div>`
    + `<div class="cs-row" data-r="ok"><span class="mk">${esc(word("installer.update.label.after"))}</span><span>${around(word("installer.update.after", { version: SLOT, signed: "\u0002" }), bold(after)).replace("\u0002", esc(signed))}</span><span></span></div></div>`;
}

async function runUpdate(emit0, code, saved) {
  const guard = { drop: null };
  try { return await updateRun(emit0, code, saved, guard); }
  finally { if (guard.drop) await guard.drop(); }
}

async function updateRun(emit00, code, saved, guard) {
  const slug = saved.slug, V = saved.r;
  let api;
  /* R66: a wait is drawn once as it begins, and the lock (R69) is touched with it. */
  const onWait = async (waited) => {
    if (api) touchLock(api, saved.lock.id).catch(() => {});
    if (waited === 0) await emit00.wait(word("screen.install.progress.retrying", { minutes: WAIT_BOUND_MINUTES }));
  };
  const emit = { ...emit00, step: async (id, label) => { if (api) await touchLock(api, saved.lock.id).catch(() => {}); return emit00.step(id, label); } };
  /* R52, R55, R75: every stop of an update is one sentence by key, and each says that your team's Civicsmith keeps running as it
     was, before its upload changed anything. */
  const stopped = (said, d = "") => emit.fail(said, d);
  let token, scope;

  await emit.step("auth", word("installer.step.auth"));
  try { const ex = await exchange(code, saved.v, onWait); token = new Session(ex.token, onWait); scope = ex.scope; emit.ok("auth"); }
  catch (e) {
    emit.no("auth");
    if (special(e)) throw e;
    return stopped(word("installer.update.stopped.permission", { said: e.message }));
  }

  await emit.step("acct", word("installer.step.acct"));
  let acct;
  try {
    const accts = await cf(token, "/accounts");
    if (!accts?.length) throw new Error(word("installer.account.none"));
    acct = await accountOf(emit, accts, saved.ac);
    if (!acct) return;
  } catch (e) {
    if (special(e)) throw e;
    emit.no("acct");
    return stopped(word("installer.update.stopped.account", { said: e.message }));
  }
  api = apiOf(token, acct.id);

  /* R69 (F9): one run at a time. */
  try {
    if (!(await takeLock(api, saved.lock))) return stopped(word("installer.stopped.running"));
    guard.drop = () => dropLock(api);
  } catch (e) { if (special(e)) throw e; }

  await emit.step("find", word("installer.step.find", { slug }));
  try {
    if (!(await scriptExists(token, acct.id, slug))) {
      emit.no("find");
      return stopped(word("installer.update.stopped.noteam", { slug }));
    }
    emit.ok("find");
  } catch (e) {
    if (special(e)) throw e;
    emit.no("find");
    return stopped(word("installer.update.stopped.lookup", { said: e.message }));
  }

  /* R64: a copy installed under the fixed names keeps them; any other is named by its slug. Its own plane's bindings say which. */
  const held = await heldBindings(token, acct.id, slug);
  /* R17 (K4758; `installer-steps` R42): the copy's settings say what it holds, the room's place among it, and an upload cannot
     restate what it cannot read; an update whose settings do not answer is refused before anything is changed, and says why. */
  if (!held) return stopped(word("installer.update.stopped.lookup", { said: word("installer.keys.unread") }));
  let scheme = held ? schemeOf(held.list, slug) : null;
  if (!scheme) {
    /* Its plane's bindings do not say (an older copy, or settings that do not answer): the fixed names, when the account holds
       any of them and none of this slug's; this slug's otherwise. */
    try {
      const [scripts, buckets] = await Promise.all([listScripts(apiOf(token, acct.id)), listBuckets(apiOf(token, acct.id))]);
      const members = [...BINDING_OF.keys()];
      const legacy = members.some((m) => scripts.has(m)) || buckets.includes("bio-captures");
      const slugged = members.some((m) => scripts.has(`${m}-${slug}`)) || buckets.includes(`bio-captures-${slug}`);
      scheme = legacy && !slugged ? LEGACY_SCHEME : SLUG_SCHEME;
    } catch (e) { if (approve(e)) throw e; scheme = SLUG_SCHEME; }
  }
  const names = namesFor(slug, scheme);

  /* R55: the release chosen, and no other; any failure of its checks is a stop, and nothing is uploaded. */
  const release = await selectChosen(emit, V);
  if (release.stop) return stopped(release.stop);
  /* R71 (F5), R61: the whole fleet of this release fetched and verified before the upload; a source that stays down stops the
     update with nothing changed. */
  let loaded;
  try { loaded = leaveOutOversize(await loadFleet(release, onWait)); }
  catch (e) {
    if (e && e.source) return stopped(word("screen.install.stopped.source"), word("screen.install.stopped.source.do"));
    throw e;
  }

  /* R74: before any upload, the copy's container applications are told from something not recognized as this copy's. */
  let retiredParts = [];
  try {
    const held = await foreignContainers(api, names, release, loaded);
    if (held.foreign) return stopped(word("installer.update.stopped.foreign"));
    retiredParts = held.retired;
  }
  catch (e) { if (special(e)) throw e; /* the list could not be read: R74 stops on what it finds, and R67 judges what was deployed */ }

  /* R70 (F3): an update that adds members, classes, buckets or containers meets the account's limits first, with nothing changed. */
  try {
    const limit = await limitReached(api, updateNeeds(names, loaded));
    if (limit) return stopped(word("screen.install.stopped.limit", { limit }), word("screen.install.stopped.limit.do"));
  } catch (e) { if (special(e)) throw e; /* a count that cannot be read is not a stop: the platform refuses what it will not hold */ }

  /* What is it running now? Asked before the upload, so an update that changes
     nothing can say so instead of reading as a success. A no-op reported as
     "Updated to X" is worse than a plain refusal: the operator believes the
     work happened and moves on. Observed live on 2026-07-24, a 0.3.10 over
     0.3.10 update where the only honest line was easy to skim past. */
  let before = null, sub0 = null;
  await emit.step("read", word("installer.step.read"));
  try {
    sub0 = (await cf(token, `/accounts/${acct.id}/workers/subdomain`))?.subdomain || null;
    if (sub0) {
      const r = await fetch(`https://${slug}.${sub0}.workers.dev/api/?op=bootstrap`);
      if (r.ok) before = (await r.json())?.version || null;
    }
  } catch { /* not knowing is fine; it only costs the comparison */ }
  if (before !== null && !SEMVER.test(String(before))) before = null;
  if (before) emit.ok("read", UPDATE_WORDS.progressRead(before));
  else emit.no("read", word("installer.update.read.failed", { version: release.version }));
  const beforeText = before || word("installer.update.unread");
  await emit.says(UPDATE_WORDS.progressSays(beforeText, release.version, acct.name));
  const noop = before !== null && before === release.version;

  /* R17: the buckets are created where possible. After every check that can stop the update (R55), so a stop changes nothing. */
  let withR2 = false;
  try { await ensureBuckets(token, acct.id, names); withR2 = true; } catch (e) { if (special(e)) throw e; }
  /* R47: the copy's own hosts, restated from the address found; none found, none written (and the page says so). */
  const ownHosts = sub0 ? [`${slug}.${sub0}.workers.dev`] : null;

  await emit.step("up", noop ? word("installer.step.same", { version: release.version }) : UPDATE_WORDS.progressPlacing(release.version));
  /* DIST-6, step 1: restate the members the account already holds, so the update never un-binds a working copy's
     members — not for its duration, and not for good when the fleet step below cannot run. */
  const present = await membersPresent(token, acct.id, names);
  const instanceAi = instanceAiOk(saved.ai) ? saved.ai : undefined;
  /* K1541, R36 and R17: which bindings the copy holds (`held`, read before the upload, by name and type). */
  const seal = held && held.get(SEAL_BINDING) !== "secret_text" ? rand(32) : undefined;
  /* R67: the deployment the copy runs now, so an update whose new version never answers can put it back. */
  const previous = await currentDeployment(token, acct.id, slug);
  const planeNotes = [];
  try { await uploadUpdate(token, acct.id, slug, withR2, release, { members: present, instanceAi, seal, ownHosts, names, note: planeNote(planeNotes) }); emit.ok("up"); }
  catch (e) {
    if (special(e)) throw e;
    emit.no("up");
    return stopped(word("installer.update.stopped", { version: beforeText }), word("installer.cfsaid", { said: e.message }));
  }

  /* R33: as on install, the uploaded plane is read back and hashed against the release. */
  const byteLags = [];
  const readBackInto = async () => { const lag = await readBack(token, acct.id, slug, release);
    if (lag && !byteLags.includes(lag)) byteLags.push(lag); };
  await readBackInto();

  /* The update path installs OR refreshes the members — the PUT is the same
     act, and this is what heals a copy installed before the fleet existed
     (the SELF-binding precedent, now for whole workers). */
  /* R38 with R17: no plan is known on an update; it is established only if a container member would install. */
  const fleet = await installFleet(emit, token, acct.id, slug, release, loaded, { scope, vpc: saved.vpc, names });
  /* DIST-6, step 3: this is what gives a copy installed WITHOUT member bindings its bindings. */
  const bound = await bindMembers(emit, token, acct.id, slug, release, present, fleet, { withR2, ownHosts, names });
  if (bound.put) await readBackInto();
  await instanceAiNotice(emit, "update", !!instanceAi);
  await accountSecretsNotice(emit, token, acct.id, slug, held, seal);

  await emit.step("addr", word("installer.step.address.update"));
  let base = null;
  try {
    const sub = (await cf(token, `/accounts/${acct.id}/workers/subdomain`))?.subdomain;
    if (sub) base = `https://${slug}.${sub}.workers.dev`;
  } catch { /* said below: an address not found is not told to the copy */ }
  emit.ok("addr", ownHosts ? word("installer.update.address.found", { hosts: ownHosts.join(", ") }) : word("installer.update.address.none"));

  /* R46: as on install, before `verify` can succeed. */
  const logs = await logsStep(emit, token, acct.id, copyWorkers(slug, release, names));
  const logLags = [...logs.lags, ...(fleet?.imageLags || [])];

  /* D-116: confirmed means EVERY part answers the release — the address, the record store, and each capability
     worker through the plane's binding (verifyServing). The patient tone stays, because a rollout genuinely takes
     minutes; what goes is reporting an update as done while a named part still runs the old build. */
  const capable = release.capable;
  let verdict = null;
  if (base) {
    await emit.step("verify", UPDATE_WORDS.progressAnswers);
    /* R67 (S9): the new version has to answer at all. An address that gives no answer for the whole bound, after an upload that
       changed the copy, puts the previous deployment back and stops, saying so. */
    const answered = await waitForAnswer(base, onWait);
    if (!answered && previous && !noop) {
      const back = await rollBack(token, acct.id, slug, previous);
      emit.no("verify");
      return back ? stopped(word("installer.update.stopped.noanswer", { version: beforeText }))
        : stopped(word("screen.install.stopped.lasting"), word("screen.install.stopped.lasting.do"));
    }
    const boxes = await confirmContainers(token, acct.id, base, release, fleet, onWait);
    verdict = withByteLags(await verifyServing(base, release.version, fleet?.done || [], capable, fleet?.left || [], onWait),
      [...byteLags, ...logLags, ...boxes.lags], capable);
    if (verdict.confirmed) emit.ok("verify", capable ? undefined : word("installer.update.verify.answers", { version: release.version }) + " " + UNDETERMINED_BUILDS);
    else emit.no("verify", word("installer.update.verify.unconfirmed"));
  }
  /* R33: with no address to ask, a read-back lag is still named, and no success is claimed over it. */
  if (!verdict) verdict = withByteLags(null, [...byteLags, ...logLags], capable);
  const confirmed = !!(verdict && verdict.confirmed);
  const lagging = !!(verdict && !verdict.confirmed);

  /* R18, R78: this run holds no credential to record the team's short name with (an update binds no new ADMIN_TOKEN, K3892), so it
     reads what the copy records and tells the operator when it records none, or when the copy did not answer. */
  const unfinished = !!held && scheme !== LEGACY_SCHEME && !held.has(MARK);
  const told = groupNotice(groupUnrecorded(await readGroup(base), before), slug, before, unfinished);

  const version = release.version;
  emit.done(versionLines(before, version) + (noop
    ? `<div class="notice"><p style="margin:0"><b>${esc(word("installer.update.noop.head", { running: UPDATE_WORDS.running(version), version }))}</b>
${esc(word("installer.update.noop.body", { version }))}</p></div>`
      + (lagging ? `<div class="notice"><p style="margin:0">${esc(word("installer.update.lagging.noop", { version }))}</p>${lagList(verdict)}</div>` : "")
    : (lagging
    /* D-116: the upload happened, and is said; an UPDATE is not claimed while a named part runs another build. */
    ? `<div class="notice"><p style="margin:0"><b>${esc(before ? word("installer.update.lagging.head.over", { version, before }) : word("installer.update.lagging.head", { version }))}</b>
${esc(word("installer.update.lagging.body"))}</p>
${lagList(verdict)}<p>${esc(word("installer.update.lagging.after"))}</p></div>`
    /* R55: finished, in `installer.update.done.*`: the release now running, what is as it was, and the way back. Said only
       once every part answers the release (a part not yet confirmed is the notice above, never this). */
    : `<div class="okbox" id="update-done"><h2 style="margin:0">${esc(UPDATE_WORDS.doneTitle)}</h2>
<p style="margin:0">${esc(UPDATE_WORDS.doneSays(version, beforeText))}</p>
<p style="margin:0">${confirmed
  ? esc(UPDATE_WORDS.doneAnswers(version)) + ". " + (capable ? esc(word("installer.update.done.allanswer", { version })) : esc(UNDETERMINED_BUILDS))
  : esc(word("installer.update.done.unconfirmed", { version }))}</p>
<p style="margin:0">${esc(UPDATE_WORDS.doneKept)}.</p>
<p style="margin:0" class="small">${esc(UPDATE_WORDS.doneNote(version))}</p></div>`)
    + told
    /* R74: a part of an earlier release that this one no longer uses is named once and left in place. */
    + planeNotes.map((n) => `<div class="notice"><p style="margin:0">${esc(n)}</p></div>`).join("")
    + (retiredParts.length ? `<div class="notice" id="retired-parts"><p style="margin:0">${esc(word("installer.update.retired", { parts: retiredParts.join(", ") }))}</p></div>` : "")
    + securityToolsNote(saved.vpc)
    + (base ? `<div class="ng-acts"><a class="cs-btn" data-tone="primary" id="update-back" href="${esc(base)}/">${esc(UPDATE_WORDS.back)}</a></div>` : "")));
}

/* ------------------------------------------------------- R65: removal, guided, confirmed, complete */

/* `installremove`: what removing the copy at `slug` would delete, drawn and not done. The holdings are read as R63 reads them
   (the copy's own worker, else the installer's counts from Cloudflare's API), so the page lists what the exists page showed. */
async function runRemoveView(emit, code, saved) {
  const slug = saved.slug;
  let token, acct;
  await emit.step("auth", word("installer.step.auth"));
  try { const ex = await exchange(code, saved.v); token = new Session(ex.token); emit.ok("auth"); }
  catch (e) { emit.no("auth"); if (special(e)) throw e; return emit.fail(word("installer.remove.refused.permission", { said: e.message })); }
  await emit.step("acct", word("installer.step.acct"));
  try { const accts = await cf(token, "/accounts"); if (!accts?.length) throw new Error(word("installer.account.none")); acct = await accountOf(emit, accts, saved.ac); if (!acct) return; }
  catch (e) { if (special(e)) throw e; emit.no("acct"); return emit.fail(word("installer.remove.refused.account", { said: e.message })); }
  await emit.step("read", word("installer.step.remove.read"));
  let held;
  try {
    const memberNames = memberNamesOf(null);
    const inv = await inventory(apiOf(token, acct.id), memberNames);
    held = (await describeHeld(token, acct.id, inv, memberNames, slug))[0] || null;
    if (!held) { emit.no("read"); return emit.fail(word("installer.remove.refused.none", { slug })); }
  } catch (e) {
    if (special(e)) throw e;
    emit.no("read");
    return emit.fail(word("installer.remove.refused.lookup", { said: e.message }));
  }
  emit.ok("read");
  emit.done(removePanel({ copy: held, slug, account: saved.ac }));
}

/* `installremoveconfirm`: deletes every resource the copy holds in the account, each named as it goes, and, when the account is
   clear, offers the new install (a new consent). Only the typed short name reaches here (checked at /begin and again here). */
async function runRemoveRun(emit, code, saved) {
  const guard = { drop: null };
  try { return await runRemove(emit, code, saved, guard); }
  finally { if (guard.drop) await guard.drop(); }
}
async function runRemove(emit0, code, saved, guard) {
  const slug = saved.slug;
  let token, acct, api;
  const emit = { ...emit0, step: async (id, label) => { if (api) await touchLock(api, saved.lock.id).catch(() => {}); return emit0.step(id, label); } };
  await emit.step("auth", word("installer.step.auth"));
  try { const ex = await exchange(code, saved.v); token = new Session(ex.token); emit.ok("auth"); }
  catch (e) { emit.no("auth"); if (special(e)) throw e; return emit.fail(word("installer.remove.refused.permission", { said: e.message })); }
  await emit.step("acct", word("installer.step.acct"));
  try { const accts = await cf(token, "/accounts"); if (!accts?.length) throw new Error(word("installer.account.none")); acct = await accountOf(emit, accts, saved.ac); if (!acct) return; }
  catch (e) { if (special(e)) throw e; emit.no("acct"); return emit.fail(word("installer.remove.refused.account", { said: e.message })); }
  api = apiOf(token, acct.id);
  if (saved.ty !== slug) return emit.fail(word("installer.remove.refused.typed", { slug }));
  try {
    if (!(await takeLock(api, saved.lock))) return emit.fail(word("installer.remove.refused.running"));
    guard.drop = () => dropLock(api);
  } catch (e) { if (special(e)) throw e; }
  await emit.step("list", word("installer.step.remove.list"));
  let resources;
  try {
    const memberNames = memberNamesOf(null);
    const inv = await inventory(api, memberNames);
    const copy = allCopies(inv).find((c) => c.slug === slug);
    if (!copy) { emit.no("list"); return emit.fail(word("installer.remove.refused.none", { slug })); }
    resources = await resourcesOf(api, copy, memberNames);
    emit.ok("list");
  } catch (e) {
    if (special(e)) throw e;
    emit.no("list");
    return emit.fail(word("installer.remove.refused.lookup", { said: e.message }));
  }
  let n = 0;
  try {
    await deleteResources(api, resources, async (r) => {
      const id = "del" + (++n), name = r.name;
      await emit.step(id, r.kind === "app" ? word("installer.step.remove.app", { name }) : r.kind === "worker" ? word("installer.step.remove.worker", { name })
        : word("installer.step.remove.bucket", { name }));
      return emit.ok(id, word("installer.remove.progress", { what: name }));
    });
  } catch (e) {
    if (special(e)) throw e;
    return emit.fail(word("installer.remove.refused.remains", { remaining: (e.remaining || []).join(", ") }), word("installer.cfsaid", { said: e.message }));
  }
  await emit.says(word("installer.remove.done", { n }));
  emit.done(removedPanel({ team: slug }));
}

/* ---------------------------------------------------------------- routes */

/* R53 (DEC-122 (3); K3100): one of interface-assets' files (ASSET_FILES: the stylesheet, the icons, the 15 faces and their
   licences), as its own bytes and type, cacheable for good (each is frozen at ASSETS_COMMIT); null for any other name.
   Nothing is read or stored: the bytes are this bundle's. */
const ASSET_BYTES = new Map();
export function assetResponse(name) {
  if (!Object.hasOwn(ASSET_FILES, name)) return null;
  const f = ASSET_FILES[name];
  if (!ASSET_BYTES.has(name))
    ASSET_BYTES.set(name, f.encoding === "base64" ? Uint8Array.from(atob(f.body), (c) => c.charCodeAt(0)) : enc.encode(f.body));
  const type = /^text\//.test(f.type) || f.type === "image/svg+xml" ? `${f.type}; charset=utf-8` : f.type;
  return new Response(ASSET_BYTES.get(name), { headers: { "content-type": type,
    "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === ""))
      return html(WIZARD_HTML);

    /* R55: `version` alone is read from the address, and only in the form a release's version has; nothing else, and no
       credential, is read from it. Any other value draws the page that says no release was chosen. */
    if (req.method === "GET" && url.pathname === "/update")
      return html(updateHtml(url.searchParams.get("version")));

    /* R53 (and R1's one further route): interface-assets' files, byte for byte, at the path the stylesheet names them by. */
    if (req.method === "GET" && url.pathname.startsWith(ASSET_PREFIX)) {
      const served = assetResponse(url.pathname.slice(ASSET_PREFIX.length));
      if (served) return served;
    }

    /* Begin: validate, mint PKCE, park it in an HttpOnly cookie, hand the
       browser the authorize URL. The verifier belongs to this browser and
       only ever travels back to this same origin. */
    if (req.method === "POST" && url.pathname === "/begin") {
      const body = await req.json().catch(() => ({}));
      const mode = ["update", "remove", "removeconfirm"].includes(body.mode) ? body.mode : "install";
      /* R2: a slug is a string in the grammar; a number or anything else is refused, never coerced into one. */
      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      if (!slugOk(slug))
        return json({ ok: false, error: word("installer.begin.slug") }, 400);
      /* R55: an update is of the one release chosen, V of `signatures`' R47 form; none, or any other value, is refused by
         name before any sign-in. An install takes no version. */
      const chosen = typeof body.version === "string" ? body.version : "";
      /* R65: a removal is confirmed by the short name typed, exactly; any other draws nothing and deletes nothing. */
      if (mode === "removeconfirm" && body.typed !== slug)
        return json({ ok: false, error: word("installer.remove.refused.typed", { slug }) }, 400);
      if (mode === "update" && !versionOk(chosen))
        return json({ ok: false, error: NO_RELEASE_CHOSEN + " " + NO_RELEASE_BEGIN }, 400);
      const v = rand(32), s = rand(16);
      const q = new URLSearchParams({
        response_type: "code", client_id: CFG.CLIENT_ID, redirect_uri: CFG.REDIRECT,
        scope: CFG.SCOPES.join(" "), state: s,
        code_challenge: await s256(v), code_challenge_method: "S256",
      });
      /* DIST-9: an OPTIONAL organisation `ai` credential. Absent or empty is the normal case; a value that is present
         but not credential-shaped is REFUSED by name here, before any sign-in, rather than silently dropped. */
      const ai = typeof body.instanceAi === "string" ? body.instanceAi.trim() : "";
      if (ai && !instanceAiOk(ai))
        return json({ ok: false, error: word("installer.begin.ai") }, 400);
      /* R21: the chosen jurisdiction profiles (install only), refused by name when not offered, never silently dropped. */
      const profilesWhy = profilesRefusal(body.profiles, mode);
      if (profilesWhy) return json({ ok: false, error: profilesWhy }, 400);
      const p = Array.isArray(body.profiles) && body.profiles.length ? body.profiles : null;
      /* R45 (T36): the Workers VPC service the operator names for a tool reached through a tunnel, optional on the install
         and the update alike; a value present but not a service id is refused by name, never dropped. */
      const vpc = typeof body.securityVpc === "string" ? body.securityVpc.trim().toLowerCase() : "";
      if (vpc && !vpcServiceOk(vpc))
        return json({ ok: false, error: word("installer.begin.vpc") }, 400);
      /* R84 (4), (6): the account and the workers.dev name the founder chose, kept with the other choices; a value that is
         neither an account id nor a name Cloudflare could register is refused by name, never dropped. */
      const ac = typeof body.account === "string" ? body.account.trim() : "";
      if (ac && !/^[0-9A-Za-z_-]{1,64}$/.test(ac))
        return json({ ok: false, error: word("installer.begin.account") }, 400);
      const sd = typeof body.subdomain === "string" ? body.subdomain.trim().toLowerCase() : "";
      if (typeof body.subdomain === "string" && body.subdomain.trim() && !SUBDOMAIN_RE.test(sd))
        return json({ ok: false, error: word("installer.begin.subdomain") }, 400);
      /* R36, R37 (T36): nothing else /begin is sent is kept: no field carries a Claude credential, and the install takes no
         choice about the assistant (an `assistant` field is taken nowhere). */
      /* R83 (G83; K4746, K4752): the founder's own request says where on the edge they are (`cf`, set by the platform); the hint
         `installer-steps` answers from it rides the cookie to the install, which hands it to the plane's creating upload so the
         team's room is made near the team. An install only (an update restates the place the copy holds and never moves it); no
         `cf` or no hint writes nothing, and the install is then the install it was. */
      const sl = mode === "install" && req.cf && typeof req.cf === "object" ? locationHintFor(req.cf) : null;
      const cookie = b64url(enc.encode(JSON.stringify({ v, s, slug, mode, t: Date.now(), ...(ai ? { ai } : {}), ...(p ? { p } : {}),
        ...(typeof sl === "string" && sl ? { sl } : {}), ...(ac ? { ac } : {}), ...(sd ? { sd } : {}),
        ...(vpc ? { vpc } : {}), ...(mode === "update" ? { r: chosen } : {}),
        ...(mode === "install" && body.alongside === true ? { al: 1 } : {}), ...(mode === "removeconfirm" ? { ty: body.typed } : {}),
        ...(typeof body.lock === "string" && /^[0-9A-Za-z_-]{6,64}$/.test(body.lock) ? { lk: body.lock } : {}) })));
      return json({ ok: true, authorize: `${CFG.AUTHORIZE}?${q}` }, 200,
        { "set-cookie": setCookie(cookie, CFG.COOKIE_MAX_AGE_S) });
    }

    /* The return address. Only Cloudflare sends anyone here. */
    if (req.method === "GET" && url.pathname === "/callback") {
      const clear = { "set-cookie": setCookie("deleted", 0) };
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");

      let saved = null;
      const raw = readCookie(req, CFG.COOKIE);
      if (raw) {
        try { saved = JSON.parse(new TextDecoder().decode(
          Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))); }
        catch { saved = null; }
      }

      if (err)
        return html(plainPage(word("installer.callback.denied.title"),
          word("installer.callback.denied.what"),
          url.searchParams.get("error_description") || err, saved?.slug), 200, clear);

      if (!code || !saved || saved.s !== state
          || typeof saved.t !== "number" || Date.now() - saved.t > CFG.COOKIE_MAX_AGE_S * 1000)
        return html(plainPage(word("installer.callback.unverified.title"),
          word("installer.callback.unverified.what"), ""), 200, clear);

      /* R55: a cookie that names no release for an update is not one /begin wrote. */
      if (saved.mode === "update" && !versionOk(saved.r))
        return html(plainPage(NO_RELEASE_CHOSEN, word("installer.update.nothing.changed") + " " + NO_RELEASE_BEGIN, ""), 200, clear);

      const title = saved.mode === "update" ? UPDATE_WORDS.progressTitle
        : saved.mode === "remove" ? word("screen.install.remove.title") : saved.mode === "removeconfirm" ? word("installer.remove.running.title")
        : word("screen.install.progress.title");
      /* R69, R71: this run's own place on the account's lock, and the run it continues when the founder approved again. */
      saved.lock = { id: rand(8), again: typeof saved.lk === "string" && /^[0-9A-Za-z_-]{6,64}$/.test(saved.lk) ? saved.lk : null };
      /* R71 (F6): what a new approval begins again, never a credential. */
      const again = { slug: saved.slug, mode: saved.mode, lock: saved.lock.id, ...(saved.ac ? { account: saved.ac } : {}), ...(saved.sd ? { subdomain: saved.sd } : {}), ...(saved.mode === "update" ? { version: saved.r } : {}),
        ...(saved.al === 1 ? { alongside: true } : {}), ...(saved.p ? { profiles: saved.p } : {}), ...(saved.vpc ? { securityVpc: saved.vpc } : {}),
        ...(saved.mode === "removeconfirm" ? { typed: saved.ty } : {}) };
      return streamPage(clear, progressShell(title, saved.slug, saved.mode === "update" ? `/update?version=${saved.r}` : null),
        (emit) => saved.mode === "update" ? runUpdate(emit, code, saved)
          : saved.mode === "remove" ? runRemoveView(emit, code, saved)
          : saved.mode === "removeconfirm" ? runRemoveRun(emit, code, saved)
          : runInstall(emit, code, saved), again);
    }

    return html(plainPage(word("installer.notfound.title"), word("installer.notfound.what"), ""), 404);
  },
};

/* R22: a refusal page names Civicsmith (PRODUCT), and the group by the name it chose when this browser's request carried
   one; before a group has chosen a name (the 404, an unverifiable return) it speaks to "your team". */
function plainPage(head, what, detail, slug) {
  const group = typeof slug === "string" && slugOk(slug)
    ? around(word("installer.plain.forteam", { name: SLOT }), `<b class="mono" id="group">${esc(slug)}</b>`) : esc(word("installer.plain.team"));
  return `${pageHead(head, { noindex: true })}
<body class="cs"><main class="cs-frame ng">
${pageMark()}
<h1>${esc(head)}</h1><p>${esc(what)}</p>
${detail ? `<p class="small mono">${esc(detail)}</p>` : ""}
<p class="small">${group}</p>
<div class="ng-acts"><a class="cs-btn" href="/">${esc(word("installer.plain.back"))}</a></div>
${publisherFooter()}
</main></body></html>`;
}
