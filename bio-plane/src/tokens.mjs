/* Token hygiene, shared by the control plane and the livefire battery.
 *
 * Every token value that has ever appeared in this repository is denylisted.
 * A deploy-button flow pre-fills secret prompts from files it finds in the
 * repo, and a published postmortem describes every copy of an application
 * shipping with the same leaked credential that way, silently, showing green.
 * So any value on this list is treated as NOT SET: it can never authenticate
 * and can never arm the bootstrap claim.
 *
 * Values are listed as SHA-256 so the denylist does not itself republish
 * them. If a token value ever lands in the repository again, its hash goes
 * here in the same change that removes it.
 */

import { word } from "./setup-words/index.mjs";

/** @typedef {{ readonly [binding: string]: unknown }} Bindings the Worker's bindings, as the caller holds them */
/**
 * @typedef {Object} InstanceStatus
 * @property {"instance"} level
 * @property {boolean} configured
 * @property {string} reason
 * @property {string | null} detail null exactly when configured
 */
/**
 * @typedef {Object} AiCredential
 * @property {string | null} token the live value, or null
 * @property {string | null} reason null exactly when token is a live value
 */
/**
 * @typedef {Object} UnattendedCredential
 * @property {boolean} bound
 * @property {() => Promise<string | null>} token
 */

/** @type {Set<string>} SHA-256 hex of every token value ever published here */
export const PUBLISHED_TOKEN_HASHES = new Set([
  // dist/SECRETS.txt of the 0.2.0 test deployment
  // ADMIN_TOKEN
  "34451e5e855bf8d45e93d89fca560e6bd392cf1d0cc6832e3121614d1c68d9db",
  // MEMBER_TOKEN
  "7ecc5d014e25ce4c2e8457424afa0420288742c69182db1be5f4caccd63d4c91",
  // PROBE_TOKEN
  "5910ebbfe7816d9d5e2451012f9db8ac92aaa3f65a8f50da3f7255ab8bdb26ad",
]);

/**
 * @param {string} v
 * @returns {Promise<string>} 64 lowercase hex characters
 */
export const sha256hex = async (v) => {
  /** @type {ArrayBuffer} */
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/* A token binding is LIVE only if it is a non-empty string that has never
   been published in the repository. Empty and published both mean "not set",
   so an instance that boots with a leaked or blank credential refuses every
   request on that credential rather than running open. */
/**
 * @param {unknown} v
 * @returns {Promise<boolean>}
 */
export async function liveToken(v) {
  if (typeof v !== "string" || v.length === 0) return false;
  return !PUBLISHED_TOKEN_HASHES.has(await sha256hex(v));
}

/* ---------------------------------------------------------------------------
 * DS-3 — THE ACCOUNT CASCADE'S INSTANCE LEVEL, RETIRED (K1502, T33-6; K1755, K1761).
 *
 * The group's copy binds no Claude credential in its environment. Where the assistant's account comes from is
 * `credentials`' answer, never a binding: a member's own Claude subscription or API key, held under that member, or
 * the group's one API key, which an active administrator sets (K1755). Both levels are Bob's choices, not Anthropic's
 * rules (the register `build/terms/anthropic.md`, "Bob's choices"; the group key is one the terms permit, AT-9). So the
 * instance level always answers NONE, the same answer whatever `env` carries, and the former binding
 * (`INSTANCE_CLAUDE_TOKEN`) is not read at all — not even to test it — so a value an old install left behind can
 * never be spent.
 *
 * DO NOT CONFUSE THIS WITH THE `ai` CREDENTIAL BELOW (`aik-…`, PL-11). That is BIO's own credential, which an agent
 * presents TO the plane; a Claude account is Anthropic's, which a run presents to Claude. They travel in opposite
 * directions, and only the second is retired here.
 *
 * The two services stay exported so their callers keep a stated answer until their own jobs re-point them to
 * `credentials`' account resolution; a later change may remove them.
 */

/** The stated reasons. A caller renders these; it never invents one. `CASCADE_PUBLISHED` is kept, stable, for the
 *  callers and records that name it; no service here gives it any longer (R13). */
export const CASCADE_UNSET = "NO_INSTANCE_ACCOUNT";
export const CASCADE_PUBLISHED = "INSTANCE_ACCOUNT_REVOKED_BY_PUBLICATION";

// Member-facing (DEC-149: "Your group's Civicsmith", never "the plane", "the instance" or "this group's copy"). It
// states no limit of Anthropic's plans, so it cites none (K1763); where an account comes from is R13's, K1755's.
const NO_INSTANCE_ACCOUNT_DETAIL = word("tokens.group_civicsmith_binds");

/**
 * The instance level's STATUS: always not configured, `CASCADE_UNSET`, with a detail saying where an account comes
 * from instead (a member's own, or the group's API key, both in `credentials`; K1755). `env` is accepted for the callers' sake and never read (K1502). An honest absence is STATED
 * (CLAUDE.md) — never an empty success.
 * @param {unknown} _env
 * @returns {Promise<InstanceStatus>}
 */
export async function instanceClaudeStatus(_env) {
  return { level: "instance", configured: false, reason: CASCADE_UNSET, detail: NO_INSTANCE_ACCOUNT_DETAIL };
}

/**
 * The instance level's TOKEN: always `null`. Computed from `instanceClaudeStatus`'s own answer, so the two can
 * never disagree, and no Claude credential is ever read from the copy's bindings.
 * @param {unknown} env
 * @returns {Promise<string | null>} always null
 */
export async function instanceClaudeToken(env) {
  // The status is the one answer and it is never `configured`, so there is no value to return, ever.
  await instanceClaudeStatus(env);
  return null;
}

/* ---------------------------------------------------------------------------
 * D-260 — THE INSTANCE'S ORGANISATION-PRINCIPAL `ai` CREDENTIAL (BOB #22, 2026-09-21;
 * `BIO_Assistant_and_AI_Roles_v0_1.md` §6).
 *
 * THE ONE INSTANCE-LEVEL SECRET THIS MODULE STILL ANSWERS FOR (the Claude account above is retired, K1502). It is
 * BIO's own `aik-…` credential, which `agent-worker` presents TO the plane when the plane hands it a woken run to
 * resume. The ruling: an instance MAY hold ONE
 * organisation-principal `ai` credential as a deploy secret, `DAEMON_TOKEN`'s precedent one class over — minted by
 * a member (DEC-55 (3)) and resolved through its `ai_credentials` row like any other. So this module says only
 * whether a value is present and not published; WHICH principal it is, and whether it is still standing, is the
 * RECORD's answer, asked by the one caller (`Store#aiRunResumer`) at the row.
 *
 * IT HAS NO WRITE PATH, AND THAT IS THE ENFORCEMENT RATHER THAN A CONVENTION. D-199 (3): minting and setting an
 * account credential is a MEMBER act, so there is no op, no store row and no setter here: the value arrives as a
 * Worker secret an operator places through install or update (DIST's half of D-260), and nothing an agent can call
 * reaches it. `bio-plane/test/m/runtime-limits/` (R23) pins this module's export surface and that no service writes
 * to the `env` it is given, so adding a setter here fails that test instead of quietly becoming possible.
 * PUBLICATION IS REVOCATION, as for every token here: a value on `PUBLISHED_TOKEN_HASHES` is NOT SET.
 */
export const INSTANCE_AI_BINDING = "INSTANCE_AI_TOKEN";

/** The stated reasons, secret-free. `null` when a live value is present. */
export const INSTANCE_AI_UNSET = "NO_INSTANCE_AI_CREDENTIAL";
export const INSTANCE_AI_PUBLISHED = "INSTANCE_AI_CREDENTIAL_REVOKED_BY_PUBLICATION";

/** `{ token, reason }`: the live value and `reason: null`, or `token: null` and the stated reason. The caller spends
 *  `token` and publishes only `reason` — the two come from ONE test, so they cannot disagree.
 *  @param {Bindings | null | undefined} env
 *  @returns {Promise<AiCredential>} */
export async function instanceAiCredential(env) {
  const v = env?.[INSTANCE_AI_BINDING];
  if (typeof v !== "string" || v.length === 0) return { token: null, reason: INSTANCE_AI_UNSET };
  if (!(await liveToken(v))) return { token: null, reason: INSTANCE_AI_PUBLISHED };
  return { token: v, reason: null };
}

/* ---------------------------------------------------------------------------
 * K90 (2) — THE CREDENTIAL THE INSTANCE'S UNATTENDED WORK SPENDS (N63; runtime-limits R26).
 *
 * `monitoring` and `capture-requests` fire the plane at itself with no member present, and both must spend the same
 * credential, chosen the same way, so the choice lives here once. Two questions, kept apart on purpose:
 * `bound` — is unattended work WIRED at all (presence only, synchronous, so a caller can decide whether to arm an
 * alarm without awaiting) — and `token()` — which credential do I SPEND now, liveness-checked: `DAEMON_TOKEN` first,
 * then `ADMIN_TOKEN`, a published value treated as NOT SET like every token here. The returned object holds no
 * value, only a way to ask for one, so it may be logged or passed around without leaking a credential.
 */
/** @param {Bindings | null | undefined} env @param {string} k @returns {boolean} */
const presentIn = (env, k) => { try { return !!(env && env[k]); } catch { return false; } };
/** @param {Bindings | null | undefined} env @param {string} k @returns {unknown} */
const readOf = (env, k) => { try { return env ? env[k] : undefined; } catch { return undefined; } };

/** `{ bound, token }`: `bound` is true when `DAEMON_TOKEN` or `ADMIN_TOKEN` is present on `env`; `token()` resolves to
 *  the first of the two that is a live token, or `null`. Never throws; `token()` never rejects.
 *  @param {Bindings | null | undefined} env
 *  @returns {Readonly<UnattendedCredential>} */
export function unattendedCredential(env) {
  const bound = presentIn(env, "DAEMON_TOKEN") || presentIn(env, "ADMIN_TOKEN");
  return Object.freeze({
    bound,
    async token() {
      for (const k of ["DAEMON_TOKEN", "ADMIN_TOKEN"]) {
        const v = readOf(env, k);
        if (typeof v === "string" && await liveToken(v)) return v;
      }
      return null;
    },
  });
}
