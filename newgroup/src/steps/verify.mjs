/* R27, R28, R29, R32: whether the copy answers, what each part of it serves, and the way back. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { cf, approve, special, sleep, WAIT_BOUND_MINUTES } from "./api.mjs";
import { rolloutApp } from "./containers.mjs";
import { ascii, find } from "./bytes.mjs";
import { BINDING_OF } from "./bindings.mjs";
/** @import { Release, Session, Lasting, ApproveAgain } from './api.mjs' */

/**
 * @typedef {Object} Verdict what the copy serves, read against the release
 * @property {boolean} confirmed true only when no lag is named
 * @property {string[]} lags each part not on the release, named in words
 * @property {boolean} capable whether the release's plane reports its builds
 */
/**
 * @typedef {Object} FleetFailure a member the fleet step could not upload
 * @property {string} member the member's name
 * @property {string} why what the upload said
 * @property {boolean} [out] true when R38 left it out and its upload was never attempted
 */

/* R15 (T35; F1, K1874): the probe credential travels only in the request's `Authorization: Bearer` header, the form
   admission R20 reads first, so it is in no address this installer makes, logs or shows. */
/* R66 (S5, S8): a new address takes a while to wake, so the check waits for it within the stated bound, drawing the wait,
   and never reports a not-yet-ready address as failed before the bound has passed. The wait is counted in nominal seconds. */
/** @type {number} nominal seconds between two asks of a waking address */
const WAKE_EVERY_S = 3;
/**
 * Asks `<base>/api/?op=selftest` with the probe credential until it answers `ok` with the STORE bound.
 * @param {string} base the copy's address
 * @param {string} probe the probe credential, sent only in the Authorization header
 * @param {((waited: number, bound: number) => any)|null} [onWait] drawn every 30 nominal seconds of waiting
 * @returns {Promise<any>} the selftest's reply, or null when it never answered so within the bound
 * @bound waits at most WAIT_BOUND_MINUTES minutes, counted in nominal seconds
 */
async function verifyInstall(base, probe, onWait = null) {
  const bound = WAIT_BOUND_MINUTES * 60;
  for (let waited = 0; ; waited += WAKE_EVERY_S) {
    try {
      const r = await fetch(`${base}/api/?op=selftest`, { headers: { authorization: "Bearer " + probe } });
      const j = await r.json();
      if (j.ok === true && j.bindings?.STORE === true) return j;
    } catch {}
    if (waited >= bound) return null;
    if (onWait && waited % 30 === 0) await onWait(waited === 0 ? 0 : 1, bound);
    await sleep(WAKE_EVERY_S * 1000);
  }
}

/* D-116 — WHAT EACH PART OF THE COPY ACTUALLY SERVES, NOT WHAT WAS UPLOADED (`BIO_Distribution_v0_1.md` §6, §8;
 * `CLAUDE.md` §5: a deploy verified is not a build serving).
 *
 * `op=bootstrap`'s `version` is the ROUTING isolate's build. Until D-116 that was the only thing this checked, so an
 * update whose Durable Object — the part holding the record — still ran the previous build, or whose capability
 * worker never took the new one, reported "Updated" all the same. A plane carrying D-116 answers three readings,
 * each from where it runs: `version` (the isolate), `storeVersion` (the DO's own env, never the isolate's), and on
 * `members=1`, `memberVersions` (each member's own `/version`, asked THROUGH the plane's binding). Every one must
 * equal the release, and the one that does not is NAMED; the update and the install do not report success until
 * none lags.
 *
 * WHETHER THE RELEASE CAN ANSWER is read from the plane bytes this act uploaded (`reportsBuilds`), never from a
 * version number: a release cut before D-116 landed has neither field in its source, so its store's build and its
 * members' are UNDETERMINED and the page says so in the same breath as the isolate's confirmation (UNDETERMINED_BUILDS)
 * — never a silent "confirmed", and never a refusal for lacking a field that release could not have. A plane that SHOULD answer and does not is a lag, not an absence:
 * after uploading a release that carries the fields, a reply without `storeVersion` is a DO still on older code. */
const BUILD_FIELDS = ["storeVersion", "memberVersions"];
const WORD_BYTE = (b) => (b >= 48 && b <= 57) || (b >= 65 && b <= 90) || b === 95 || (b >= 97 && b <= 122);
const hasWord = (bytes, word) => {
  const pat = ascii(word);
  for (let i = find(bytes, pat); i !== -1; i = find(bytes, pat, i + 1))
    if (!(i > 0 && WORD_BYTE(bytes[i - 1])) && !(i + pat.length < bytes.length && WORD_BYTE(bytes[i + pat.length]))) return true;
  return false;
};
/**
 * Whether the plane's source names every one of the build fields (`storeVersion`, `memberVersions`) as a whole word.
 * @param {any} source the plane bytes this act uploaded (a Uint8Array), or its text
 * @returns {boolean} false for anything that is neither
 */
export function reportsBuilds(source) {
  if (source instanceof Uint8Array) return BUILD_FIELDS.every((f) => hasWord(source, f));
  return typeof source === "string" && BUILD_FIELDS.every((f) => new RegExp("\\b" + f + "\\b").test(source));
}

/* DIST-6: `failed` is the members the fleet step could NOT upload ({member, why}). A member the plane binds whose upload
   failed is named here whatever the plane answers, because the plane's own reading of it (UNBOUND, or a previous
   build) cannot say that THIS act tried and failed — and on a release that cannot report members it is the only
   place the failure reaches the verdict. A member the plane does not bind is named at the fleet step and not here. A member
   R38 left out (`out`: its upload was never attempted) is named at the fleet step, never a lag here (R15; K3793). */
/**
 * @param {FleetFailure[]} [failed] absent is none
 * @returns {string[]} one lag for each failed member the plane binds and R38 did not leave out
 */
const failedLags = (failed = []) => failed.filter((l) => l && !l.out && BINDING_OF.has(l.member))
  .map((l) => word("installer.lag.member.failed", { name: l.member, why: l.why }));

/**
 * Reads one `op=bootstrap&members=1` reply against the release and names every part that lags.
 * @param {any} j the reply, or null when there was none
 * @param {string} want the release's version
 * @param {string[]} installed the members this act installed
 * @param {boolean} capable whether the release's plane reports its builds
 * @param {FleetFailure[]} [failed] the members the fleet step could not upload
 * @returns {Verdict}
 */
function servingVerdict(j, want, installed, capable, failed = []) {
  const lags = [];
  if (!j || typeof j !== "object") {
    lags.push(word("installer.lag.address.silent"), ...failedLags(failed));
    return { confirmed: false, lags, capable };
  }
  if (j.version !== want) lags.push(j.version ? word("installer.lag.address.version", { version: j.version }) : word("installer.lag.address.noversion"));
  lags.push(...failedLags(failed));
  if (!capable) return { confirmed: lags.length === 0, lags, capable };
  if (!("storeVersion" in j)) lags.push(word("installer.lag.store.unreported"));
  else if (j.storeVersion === null) lags.push(word("installer.lag.store.unknown"));
  else if (j.storeVersion !== want) lags.push(word("installer.lag.store.version", { version: j.storeVersion }));
  const mv = j.memberVersions;
  if (!mv || typeof mv !== "object") {
    lags.push(word("installer.lag.members.unreported"));
  } else {
    for (const [name, st] of Object.entries(mv)) {
      const s = st && st.state;
      if (s === "SERVING" && st.version !== want) lags.push(word("installer.lag.member.version", { name, version: st.version }));
      else if (s === "MISNAMED") lags.push(word("installer.lag.member.misnamed", { name, other: st.name || word("installer.lag.member.unnamed") }));
      else if (s === "SILENT") lags.push(installed.includes(name) ? word("installer.lag.member.silent.installed", { name }) : word("installer.lag.member.silent", { name }));
      else if (s === "UNBOUND" && installed.includes(name))
        lags.push(word("installer.lag.member.unbound", { name }));
    }
    for (const name of installed)
      if (!(name in mv)) lags.push(word("installer.lag.member.unknown", { name }));
  }
  return { confirmed: lags.length === 0, lags, capable };
}

/**
 * Reads the copy's builds until none lags or the bound passes.
 * @param {string} base the copy's address
 * @param {string} want the release's version
 * @param {string[]} installed the members this act installed
 * @param {boolean} capable whether the release's plane reports its builds
 * @param {FleetFailure[]} [failed] the members the fleet step could not upload
 * @param {((waited: number, bound: number) => any)|null} [onWait] drawn every 30 nominal seconds of waiting
 * @returns {Promise<Verdict>} the last verdict read
 * @bound waits at most WAIT_BOUND_MINUTES minutes, counted in nominal seconds
 */
async function verifyServing(base, want, installed, capable, failed = [], onWait = null) {
  const bound = WAIT_BOUND_MINUTES * 60, every = 2.5;
  let last = null;
  for (let waited = 0; ; waited += every) {
    let j = null;
    try { j = await (await fetch(`${base}/api/?op=bootstrap&members=1`)).json(); } catch {}
    last = servingVerdict(j, want, installed, capable, failed);
    if (last.confirmed || waited >= bound) return last;
    if (onWait && waited % 30 === 0) await onWait(waited === 0 ? 0 : 1, bound);
    await sleep(every * 1000);
  }
}

/* S9: after placement a container member's running instance has to serve the new build, and a rollout the platform answered "no
   changes" to leaves the old one running. The plane cannot report a member before step 3 binds it, so this runs after
   `bindMembers`, beside `verifyServing`: for each container member `fleetResult.done` names, it reads `memberVersions` from
   `<base>/api/?op=bootstrap&members=1` until the member is SERVING at `release.version`; one still on another build after
   CONTAINER_WAIT_S is restarted, by a further full rollout of each of its applications (`fleetResult.containers`), and read
   again within the rest of the bound; one still old after that is a lag, `installer.lag.member.version`, never success.
   A member the plane does not report (unbound, silent, not listed) is no reading and is left to the verdict.
   Answers `{confirmed, restarted, lags}`; `lags` are for `withByteLags`. */
const CONTAINER_WAIT_S = 30, POLL_S = 2.5;
/**
 * @param {Session} token the run's Session
 * @param {string} acct the account's id
 * @param {string} base the copy's address
 * @param {Release} release
 * @param {any} fleetResult the fleet step's result: `containers` ({member, id, appName, config} each) and `done` (member names)
 * @param {((waited: number, bound: number) => any)|null} [onWait] drawn every 30 nominal seconds of waiting
 * @returns {Promise<{confirmed: string[], restarted: string[], lags: string[]}>}
 * @throws {ApproveAgain} when a restart's permission has expired
 * @throws {Lasting} when a restart never came right within the bound
 * @bound restarts a member still old after CONTAINER_WAIT_S nominal seconds; waits at most WAIT_BOUND_MINUTES minutes in all
 */
async function confirmContainers(token, acct, base, release, fleetResult, onWait = null) {
  const placed = (fleetResult?.containers || []).filter((c) => (fleetResult.done || []).includes(c.member));
  const members = [...new Set(placed.map((c) => c.member))];
  if (!members.length) return { confirmed: [], restarted: [], lags: [] };
  const want = String(release.version), bound = WAIT_BOUND_MINUTES * 60;
  let waited = 0;
  /* Each member read as old: `{name, version}`; nothing read, nothing old. */
  const old = async () => {
    let j = null;
    try { j = await (await fetch(`${base}/api/?op=bootstrap&members=1`)).json(); } catch {}
    const mv = j && typeof j === "object" && j.memberVersions && typeof j.memberVersions === "object" ? j.memberVersions : {};
    return members.filter((n) => mv[n] && mv[n].state === "SERVING" && mv[n].version !== want).map((n) => ({ name: n, version: mv[n].version }));
  };
  const settle = async (limit) => {
    for (;;) {
      const still = await old();
      if (!still.length || waited >= limit) return still;
      if (onWait && waited % 30 === 0) await onWait(waited === 0 ? 0 : 1, bound);
      await sleep(POLL_S * 1000);
      waited += POLL_S;
    }
  };
  let still = await settle(CONTAINER_WAIT_S);
  const restarted = [];
  if (still.length) {
    for (const { name } of still) {
      for (const c of placed.filter((x) => x.member === name)) {
        try { await rolloutApp(token, acct, c.id, c.appName, c.config); }
        catch (e) { if (special(e)) throw e; continue; }
        if (!restarted.includes(name)) restarted.push(name);
      }
    }
    still = await settle(bound);
  }
  const names = new Set(still.map((x) => x.name));
  return { confirmed: members.filter((n) => !names.has(n)), restarted,
    lags: still.map(({ name, version }) => word("installer.lag.member.version", { name, version })) };
}

/** R67 (S9): the new version has to answer at all. Waits within the stated bound; answers the reply or null.
 * @param {string} base the copy's address
 * @param {((waited: number, bound: number) => any)|null} [onWait] drawn every 30 nominal seconds of waiting
 * @returns {Promise<any>} the reply, an object, or null when none came within the bound
 * @bound waits at most WAIT_BOUND_MINUTES minutes, counted in nominal seconds
 */
async function waitForAnswer(base, onWait = null) {
  const bound = WAIT_BOUND_MINUTES * 60, every = 2.5;
  for (let waited = 0; ; waited += every) {
    try { const r = await fetch(`${base}/api/?op=bootstrap`); if (r.ok) { const j = await r.json(); if (j && typeof j === "object") return j; } } catch {}
    if (waited >= bound) return null;
    if (onWait && waited % 30 === 0) await onWait(waited === 0 ? 0 : 1, bound);
    await sleep(every * 1000);
  }
}
/** The version a Worker runs now, as its deployments list names it (newest first), or null when that cannot be read.
 * @param {Session} token the run's Session
 * @param {string} acct the account's id
 * @param {string} slug the Worker's script name
 * @returns {Promise<string|null>}
 * @throws {ApproveAgain} when the permission has expired
 */
async function currentDeployment(token, acct, slug) {
  try {
    const r = await cf(token, `/accounts/${acct}/workers/scripts/${slug}/deployments`);
    const list = Array.isArray(r) ? r : Array.isArray(r?.deployments) ? r.deployments : [];
    return list[0]?.versions?.[0]?.version_id ?? null;
  } catch (e) { if (approve(e)) throw e; return null; }
}
/** Puts that version back, at 100%. true when Cloudflare accepted it.
 * @param {Session} token the run's Session
 * @param {string} acct the account's id
 * @param {string} slug the Worker's script name
 * @param {string} versionId the version to put back
 * @returns {Promise<boolean>}
 * @throws {ApproveAgain} when the permission has expired
 */
async function rollBack(token, acct, slug, versionId) {
  try {
    await cf(token, `/accounts/${acct}/workers/scripts/${slug}/deployments`, { method: "POST", idem: true,
      body: JSON.stringify({ strategy: "percentage", versions: [{ percentage: 100, version_id: versionId }] }) });
    return true;
  } catch (e) { if (approve(e)) throw e; return false; }
}

/* R33 with R15: the read-back's lags join the serving verdict's, first; a verdict with any is never confirmed. With no
   serving verdict (the address unread) the read-back's lags still make one, so a mismatch is always named. */
/**
 * @param {Verdict|null} verdict the serving verdict, or null when the address was not read
 * @param {string[]} byteLags the read-back's lags
 * @param {boolean} capable whether the release's plane reports its builds
 * @returns {Verdict|null} `verdict` itself when there are no byte lags
 */
function withByteLags(verdict, byteLags, capable) {
  if (!byteLags.length) return verdict;
  if (!verdict) return { confirmed: false, lags: [...byteLags], capable };
  return { ...verdict, confirmed: false, lags: [...byteLags, ...verdict.lags.filter((l) => !byteLags.includes(l))] };
}
export { WAKE_EVERY_S, verifyInstall, failedLags, servingVerdict, verifyServing, confirmContainers, waitForAnswer, currentDeployment, rollBack, withByteLags };
