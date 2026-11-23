/* R11: the bindings the uploads share, and the members a plane is bound to. The binding names are instance-setup's. */
import { cf, special, approve } from "./api.mjs";
import { scriptExists } from "./probes.mjs";
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { FLEET_BINDINGS } from "../../../bio-plane/src/setup-fleet.mjs";

/** @import { Session, Names, ApproveAgain, Lasting } from './api.mjs' */
/**
 * @typedef {Object} Binding one binding of a Worker script, as an upload's metadata states it and its settings answer it
 * @property {string} type the binding's kind (`service`, `secret_text`, `plain_text`, `r2_bucket`, ...)
 * @property {string} name the name the script reads it by
 * @property {string} [text] a plain or secret text's value
 * @property {string} [service] a service binding's target Worker
 * @property {string} [bucket_name] an r2 bucket's name
 * @property {string} [class_name] a Durable Object namespace's class
 */

/* REC-26 / D-102 again: the instance name IS the worker name, so a Worker's
   binding to ITSELF names the same `slug` the group already chose. This is what
   the plane's `#monitorConfigured()` looks for, and without it BOTH monitoring
   consumers — CAP-3's archive fallback and REC-26's monitor cadence — contribute
   no wake and hold no alarm: built, tested, and wired to nothing on every
   installed instance (MACHINE-PROCESSES.md §0). A loopback service binding is the
   only way a Durable Object can reach its own control plane, which is how those
   consumers fire the SAME ops a caller uses (D-112: one path, no drift).

   THE CREDENTIAL, decided 2026-08-04 (DIST-1) and deliberately NOT a new secret:
   the plane's `#monitorToken()` is `env.MONITOR_TOKEN || env.ADMIN_TOKEN`, but its
   `classify()` recognises only the binding credentials it names (ADMIN_TOKEN, PROBE_TOKEN, DAEMON_TOKEN; no
   MEMBER_TOKEN since N711: the shared member key is retired, R9, and members sign in with their own sessions). Binding a
   MONITOR_TOKEN here — and nothing else — would make every tick SELECT a token the
   plane then refuses, while `#monitorConfigured()` stayed true: an armed alarm
   firing 401s forever, which is worse than the ADMIN_TOKEN it replaced. The scoped
   credential was a DELEGATION to RECORD (2026-08-04 DIST → RECORD) that landed as
   REC-33: classify() now recognises DAEMON_TOKEN as the daemon class, reaching
   exactly two ops, and #monitorToken() prefers it. So the constraint above is
   satisfied in the required order and BOTH upload paths bind DAEMON_TOKEN below
   (DIST-2). The ADMIN_TOKEN fallback remains in the plane until DEC-43's
   retirement conditions are measured (DIST-4's count); an instance that never
   updates keeps monitoring on ADMIN_TOKEN, which is exactly the population that
   report exists to name. */
/**
 * @param {string} slug the plane's script name
 * @returns {Binding} the service binding `SELF` to `slug`
 */
const selfBinding = (slug) => ({ type: "service", name: "SELF", service: slug });
/* DIST-11 (IC-252's owed act): the Browser Rendering binding, the same name the plane's `wrangler.jsonc` declares. */
/** @type {Readonly<Binding>} */
export const BROWSER_BINDING = Object.freeze({ type: "browser", name: "BROWSER" });

/* DIST-6 — THE PLANE IS BOUND TO THE FLEET MEMBERS INSTALLED BESIDE IT (`BIO_Distribution_v0_1.md` §2, §4).
 *
 * Until DIST-6 both upload paths below bound the plane its buckets, its secrets and SELF and NOTHING ELSE, so on a
 * group's own copy `installFleet` uploaded pdf-worker, ocr-worker and agent-worker and the plane could reach none of
 * them: tier-2/3 extraction and the assistant member did nothing there (found by D-116's worker, 2026-09-23; D-116's
 * verify step read each member UNBOUND). The binding NAMES are the plane's own, instance-setup's `FLEET_BINDINGS`,
 * imported (R30); the TARGET is the script name `installFleet` uploads each member under (`m.member`), never the
 * plane's slug and never a name in a file. A member absent from that list (a release naming a member the plane does not
 * call) is uploaded and not bound.
 *
 * THE ORDER, and the evidence it rests on. Cloudflare REFUSES an upload whose service binding names a worker that does
 * not exist — measured here, not read in a vendor page: `bio-plane/scripts/deploy-fleet.mjs` records the refusal
 * ("Service binding 'PLANE' references Worker 'bio-plane' which was not found [code: 10143]"), measured 2026-08-10
 * and re-measured 2026-09-10. And agent-worker's own manifest binds PLANE -> the plane's slug. So the fleet and the
 * plane bind EACH OTHER, and neither can be uploaded first holding a binding to the other on a fresh account: members
 * first would be refused on agent-worker's PLANE exactly as the plane-first upload would be refused on AGENT_WORKER.
 * The order that needs no assumption about binding to a missing worker is therefore THREE acts:
 *   1. the plane, bound only to the members the account ALREADY holds (`membersPresent`; none on a fresh account);
 *   2. the members (`installFleet`), whose PLANE binding now resolves;
 *   3. the plane RE-PUT, bound to every member now present (`bindMembers`) — only when step 2 added one.
 * Step 1 binding what already exists is what keeps an UPDATE from un-binding a working copy's members for the
 * duration of the update, or for good when the fleet step cannot run (the repository unreachable): `service` is not
 * in `keep_bindings`, so a member not restated in a PUT is a member dropped. */
/** @type {Map<string, string>} member -> the binding name the plane reads it by */
const BINDING_OF = new Map(FLEET_BINDINGS);
/* R64: the binding's TARGET is the member's Worker under the copy's own names (`names.member`), its NAME the plane's own. */
/**
 * @param {string[]|undefined} members the members to bind; absent is none
 * @param {Names} names the copy's names
 * @returns {Binding[]} one service binding per listed member the plane binds, in `BINDING_OF`'s order
 */
const memberBindings = (members = [], names) => [...BINDING_OF]
  .filter(([member]) => members.includes(member))
  .map(([member, name]) => ({ type: "service", name, service: names.member(member) }));

/* Which bindable members this account already holds. A lookup that fails for any reason other than "not found" is
   read as NOT PRESENT for this PUT — binding a worker whose existence is unestablished is the refusal above — and
   step 3 binds whatever step 2 then uploads. */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {Names} names the copy's names
 * @returns {Promise<string[]>} the bindable members whose Worker the account holds
 * @throws {ApproveAgain} when the permission has expired
 */
async function membersPresent(token, acct, names) {
  const present = [];
  for (const member of BINDING_OF.keys()) {
    try { if (await scriptExists(token, acct, names.member(member))) present.push(member); }
    catch (e) { if (approve(e)) throw e; /* unestablished: not bound */ }
  }
  return present;
}

/* DIST-9 — THE INSTANCE'S ORGANISATION `ai` CREDENTIAL (D-260, BOB #22; `BIO_Distribution_v0_1.md` §6 and
 * `BIO_Assistant_and_AI_Roles_v0_1.md` §6). Since D-260 the plane READS the Worker secret `INSTANCE_AI_TOKEN`
 * (`bio-plane/src/tokens.mjs`) and, with it, re-enters the woken runs that credential opened; without it every wake
 * entry says NO_INSTANCE_AI_CREDENTIAL. The installer CARRIES it, "as DAEMON_TOKEN is" — and differs from DAEMON_TOKEN
 * in the one way that matters: it NEVER GENERATES ONE. A DAEMON_TOKEN is the installer's own credential, spent only by
 * the plane over SELF, so minting it here is correct. An `ai` credential is a MEMBER's act (DEC-55 (3), DS-3): it is
 * minted on the copy by `op=aicredentialmint`, which records its principal, and a value invented here would be resolved
 * against no row and name no principal — a secret that claims to be a credential and is not one. So: a value the
 * operator supplies is bound; none supplied binds nothing and the page SAYS so (an absence not stated is
 * indistinguishable from one nobody checked). The value is never printed on any page. It rides from `/begin` to
 * `/callback` in the same HttpOnly, Secure, SameSite=Lax cookie as the PKCE verifier, which this browser alone holds and
 * the callback clears. */
/** @type {string} */
export const INSTANCE_AI_BINDING = "INSTANCE_AI_TOKEN";
const INSTANCE_AI_RE = /^[\x21-\x7e]{16,512}$/;
/**
 * @param {any} v a supplied value
 * @returns {boolean} whether `v` is a usable `ai` credential
 * @bound a string of 16 to 512 printable characters without spaces
 */
export const instanceAiOk = (v) => typeof v === "string" && INSTANCE_AI_RE.test(v);
/**
 * @param {any} v the operator's value, if any
 * @returns {Binding[]} the secret `INSTANCE_AI_TOKEN` when `instanceAiOk(v)`, else none; never a generated value
 */
const instanceAiBinding = (v) => instanceAiOk(v) ? [{ type: "secret_text", name: INSTANCE_AI_BINDING, text: v }] : [];

/* K1541 (B1) — THE SEAL SECRET. `credentials` seals each member's own Claude account or API key under a key it derives
 * from the Worker secret ACCOUNT_SEAL_SECRET; unbound, a member cannot connect one (ACCOUNT_SEAL_UNAVAILABLE). The
 * install generates it with the other credentials and never shows it (no person ever spends it). An update NEVER
 * restates it over one the copy holds: a new value would make every reference already sealed unreadable. So an update
 * binds a fresh one only when the script's own settings show the copy holds none, and sends nothing when they cannot
 * be read (the page says which). */
/** @type {string} */
export const SEAL_BINDING = "ACCOUNT_SEAL_SECRET";
/**
 * @param {any} v the seal secret, if any
 * @returns {Binding[]} the secret `ACCOUNT_SEAL_SECRET` for a non-empty string, else none
 */
const sealBinding = (v) => typeof v === "string" && v ? [{ type: "secret_text", name: SEAL_BINDING, text: v }] : [];

/* The bindings the copy's plane script holds, read from its settings, as a map from name to type (names and types
   only: a secret's value is never readable). null when the settings cannot be read or state no bindings: unknown,
   never "none". */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the plane's script name
 * @returns {Promise<any>} a `Map` from binding name to type, with `.list` the bindings themselves (`Binding[]`); null when unknown
 * @throws {ApproveAgain} when the permission has expired
 * @throws {Lasting} when a wait never mended
 */
async function heldBindings(token, acct, slug) {
  try {
    const s = await cf(token, `/accounts/${acct}/workers/scripts/${slug}/settings`);
    if (!s || !Array.isArray(s.bindings)) return null;
    const list = s.bindings.filter((b) => b && typeof b.name === "string");
    const map = new Map(list.map((b) => [b.name, b.type]));
    map.list = list;
    return map;
  } catch (e) { if (special(e)) throw e; return null; }
}

/* R47 (T36; N745, K2038) — THE COPY'S OWN HOSTS. `OWN_HOSTS`, plain text, the host names the copy answers at,
   comma-separated, so it knows its own hosts before a group domain is claimed (plane R28). Today that is its workers.dev
   address (R14), the only address this installer gives it. Written only once that address is enabled: the install's
   last plane upload, after `addr`, carries it, and an update restates it from the address it finds (plain values are
   not kept by an update's upload). No address, no binding, and the page says so. */
/** @type {string} */
export const OWN_HOSTS_BINDING = "OWN_HOSTS";
/**
 * @param {any} hosts the host names the copy answers at
 * @returns {Binding[]} the plain text `OWN_HOSTS`, comma-joined, for a non-empty list, else none
 */
const ownHostsBinding = (hosts) => Array.isArray(hosts) && hosts.length
  ? [{ type: "plain_text", name: OWN_HOSTS_BINDING, text: hosts.join(",") }] : [];
/**
 * @param {any} base an address
 * @returns {string|null} its host, or null when there is none or it is not an address
 */
const hostOf = (base) => { try { return base ? new URL(base).host : null; } catch { return null; } };

/* R21 (N10): the jurisdiction profiles the operator chose, in the order chosen, bound for the copy to record at its first
   boot (instance-setup R13). None chosen binds nothing, and R13 then records nothing. An update never sends it: only
   the install's own two plane uploads (the install PUT and its step-3 re-PUT, whose update shape keeps no `plain_text`,
   and which may precede the store's first boot) carry it. */
/** @type {string} */
export const PROFILES_BINDING = "JURISDICTION_PROFILES";
/**
 * @param {any} ids the jurisdiction profiles chosen, in order
 * @returns {Binding[]} the plain text `JURISDICTION_PROFILES`, comma-joined, for a non-empty list, else none
 */
const profilesBinding = (ids) => Array.isArray(ids) && ids.length
  ? [{ type: "plain_text", name: PROFILES_BINDING, text: ids.join(",") }] : [];

/* R41, R42 (fix round 7 G83; K4746, K4747, K4752) — WHERE THE TEAM'S RECORD OBJECT IS CREATED. Cloudflare creates it wherever
   its first `get()` runs and never moves it, so the plane is told, in one plain-text binding `STORE_LOCATION`, the hint to
   pass at every `get()`. The installer reads the founder's `cf` once, at the door, and hands the hint to the install's first
   upload; every later upload restates what the script holds (a plain text is not in `keep_bindings`), a room never moves, and
   nothing here invents a place or a generation. `LOCATION_HINTS` is this module's own copy of Cloudflare's eleven hints (R35:
   it imports no other module); a test of the suite keeps it equal to `runtime-limits`' list. A hint is where the hosting
   platform runs the room, never a jurisdiction. */
/** @type {string} */
export const LOCATION_BINDING = "STORE_LOCATION";
/** @type {string} */
export const GENERATION_BINDING = "STORE_GENERATION";
/** @type {ReadonlyArray<string>} */
export const LOCATION_HINTS = Object.freeze(["wnam", "enam", "sam", "weur", "eeur", "apac", "apac-ne", "apac-se", "oc", "afr", "me"]);
/* A longitude is a finite number or a non-blank numeric string (Cloudflare sends a string); `Number("")` is 0, so blank is missing. */
const longitudeOf = (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
/* Continent and longitude only, no country table; anything else, or a missing field, answers null: never a guess. */
/**
 * @param {any} cf the request's `cf` object (only `continent` and `longitude` are read)
 * @returns {string|null} one of `LOCATION_HINTS`, or null: never a guess
 */
function locationHintFor(cf) {
  const lon = longitudeOf(cf?.longitude);
  switch (cf?.continent) {
    case "NA": return lon === null ? null : lon < -98 ? "wnam" : "enam";
    case "EU": return lon === null ? null : lon < 20 ? "weur" : "eeur";
    case "AS": return lon === null ? null : lon < 60 ? "me" : "apac";
    case "SA": return "sam";
    case "AF": return "afr";
    case "OC": return "oc";
    default: return null;
  }
}
/**
 * @param {any} h a location hint
 * @returns {Binding[]} the plain text `STORE_LOCATION` for a hint `LOCATION_HINTS` holds, else none
 */
const storeLocationBinding = (h) => typeof h === "string" && LOCATION_HINTS.includes(h) ? [{ type: "plain_text", name: LOCATION_BINDING, text: h }] : [];

/* The place the held plane script carries, as the bindings to restate: the values of `STORE_LOCATION` and `STORE_GENERATION` it
   holds, as they are (none held, none restated). A script that does not exist holds none (404). A script whose settings cannot
   be read refuses the act here, before anything is uploaded, since a value not restated is dropped; an `approveAgain` or a
   `lasting` error is rethrown. Stand-in for the sentence: `installer.fleet.why.program`; the row owed is `installer-steps.plane.heldplace`, one line
   for "your Cloudflare account would not show what your team's Civicsmith already holds, so nothing was uploaded". */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the plane's script name
 * @returns {Promise<Binding[]>} the `STORE_LOCATION` and `STORE_GENERATION` plain texts the script holds; none for a script that does not exist
 * @throws {Error} when the script's settings cannot be read
 * @throws {ApproveAgain} when the permission has expired
 * @throws {Lasting} when a wait never mended
 */
async function heldPlace(token, acct, slug) {
  let s;
  try { s = await cf(token, `/accounts/${acct}/workers/scripts/${slug}/settings`); }
  catch (e) {
    if (special(e)) throw e;
    if (e && e.status === 404) return [];
    s = null;
  }
  if (!s || !Array.isArray(s.bindings))
    throw new Error(word("installer.fleet.why.program"));
  return s.bindings.filter((b) => b && b.type === "plain_text" && typeof b.text === "string" && (b.name === LOCATION_BINDING || b.name === GENERATION_BINDING))
    .map((b) => ({ type: "plain_text", name: b.name, text: b.text }));
}

/* R46: the copy's Workers, by script name: the plane, and every member it binds or the release names. */
/**
 * @param {string} slug the plane's script name
 * @param {{man?: any}} release the release (its manifest's `fleet` is read)
 * @param {Names} names the copy's names
 * @returns {string[]} the copy's Worker script names, each once
 */
function copyWorkers(slug, release, names) {
  const out = [slug, ...BINDING_OF.keys()].map((n) => (n === slug ? n : names.member(n)));
  for (const m of Array.isArray(release.man?.fleet) ? release.man.fleet : []) if (m && typeof m.member === "string") out.push(names.member(m.member));
  return [...new Set(out)];
}
export { selfBinding, BINDING_OF, memberBindings, membersPresent, instanceAiBinding, sealBinding, heldBindings, ownHostsBinding, hostOf, profilesBinding, copyWorkers, locationHintFor, storeLocationBinding, heldPlace };
