/* R32, R33 (K1502, K1755) — WHICH CLAUDE ACCOUNT SERVES THE ACT: THE ONE THAT ARRIVED, JUDGED AT ITS OWN LEVEL.
 *
 * Bob's three options (K1755): an Anthropic API key held by an administrator for the group's copy, serving members with
 * no account of their own; a member's own API key or own Claude sign-in, used only by that member; or no AI. WHICH
 * account serves a member's act is `credentials`' choice (its R35, `accountFor`: the member's own reference when held,
 * else the group's key while it is held and on), never this module's: this module judges the ONE account that arrived,
 * at the `level` it arrived with, `member`, `project` or `group`. (T41; R71, K2373) A project's account (`credentials`
 * R54, R56) is an API key, or, while the project has one member, that member's own sign-in: it carries the `project` it
 * belongs to (an id, never a secret), and serves the member's act exactly as the group's key does. No account is read
 * from this member's environment (the copy binds no Claude credential, K1502). An act the group's or a project's key
 * serves is still the member's act (R10, R57). PURE: no network, no environment read, no state. The account arrives PER CALL from the plane
 * and is retained exactly as long as the `ai` credential is: not at all (R36).
 *
 * THE QUESTIONS ASKED OF IT are the only ones this repository can answer about a vendor's secret (DS-3's rule): is
 * there one, of a kind `agent-model` takes, and has it been published in this repository. Its format beyond that is
 * the vendor's claim, never this member's measurement. The denylist is the plane's own (`bio-plane/src/tokens.mjs`, a
 * bundle input hashed in this member's manifest), so the one list stays one list.
 *
 * STATUS CARRIES NO SECRET, AND THE REFERENCE ACCESSOR IS DERIVED FROM THE STATUS: `cascadeToken` re-runs the same
 * judgement and hands over only what `resolveClaudeCascade` would call available, so the two cannot disagree. */
import { PUBLISHED_TOKEN_HASHES, sha256hex } from "../../bio-plane/src/tokens.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** The levels an account arrives at (R32, R71; `credentials` R35, R56), in the order `credentials`' cascade tries them:
 *  a project's account, the member's own, the group's API key. Nothing else may restate them. */
export const CASCADE_ORDER = Object.freeze(["project", "member", "group"]);
/** The kinds `agent-model` takes (its R2): an API key, or (T38; N785, K2200) the member's own sign-in, which since T47
 *  carries its `secret`, the token `credentials` holds for that member (R82; K3060 D10; `agent-model` R16).
 *  `subscription` is retired (`credentials` R22). */
export const ACCOUNT_KINDS = Object.freeze(["apikey", "signin"]);
/** The kinds each level holds: the group's account is an API key only (`credentials` R33; `agent-model` R11); a
 *  project's is an API key or its one member's own sign-in (`credentials` R54; R71). */
export const LEVEL_KINDS = Object.freeze({ project: ACCOUNT_KINDS, member: ACCOUNT_KINDS, group: Object.freeze(["apikey"]) });

/** The stated reasons. A caller renders these; it never invents one. */
export const CASCADE_NO_ACCOUNT = "NO_ACCOUNT";
export const LEVEL_UNSET = "unset";
export const LEVEL_REVOKED = "revoked_by_publication";
export const LEVEL_AVAILABLE = "available";

const isObject = (a) => a !== null && typeof a === "object" && !Array.isArray(a);
const secretOf = (account) => (isObject(account) && typeof account.secret === "string" ? account.secret : "");
const memberOf = (account) => (isObject(account) && typeof account.member === "string" ? account.member : "");
/** R71: the project a project's account belongs to, an id carried beside it, never a secret. */
const projectOf = (account) => (isObject(account) && typeof account.project === "string" ? account.project : "");
/** The level an account arrived at: its own `level` when it is one of R32's, else `member` (the level judged when
 *  none, or none usable, arrived; R6 refuses an unknown level before this is asked). */
const levelOf = (account) => (isObject(account) && CASCADE_ORDER.includes(account.level) ? account.level : "member");

/** R32 — the arrived account's state at its level: `unset` (no account at a level R32 judges, no non-empty secret, or a
 *  kind its level does not hold), `revoked_by_publication` (its SHA-256 is published in this repository) or
 *  `available`. An account naming no level, or another (an instance's), is judged at no level. A `signin` account is
 *  `available` exactly when its `member` is a non-empty string, the member whose own sign-in serves the act, and (T47,
 *  R82) its `secret`, the held token, is non-empty and unpublished; `unset` otherwise. A project's account naming no
 *  project is `unset` (R71). */
async function levelState(account) {
  if (!isObject(account) || !CASCADE_ORDER.includes(account.level)) return LEVEL_UNSET;
  if (!LEVEL_KINDS[account.level].includes(account.kind)) return LEVEL_UNSET;
  if (account.level === "project" && !projectOf(account)) return LEVEL_UNSET;
  if (account.kind === "signin" && !memberOf(account)) return LEVEL_UNSET;
  const v = secretOf(account);
  if (v.length === 0) return LEVEL_UNSET;
  if (PUBLISHED_TOKEN_HASHES.has(await sha256hex(v))) return LEVEL_REVOKED;
  return LEVEL_AVAILABLE;
}

/**
 * R32 — the status, carrying no secret: `{available: true, level, kind, member, levels}` (and `project` at the project
 * level, R71) or `{available: false, reason: "NO_ACCOUNT", level, levels, detail}`, `level` the account's own (`member`
 * when none arrived). `account` is `{kind, level, secret, member, project?, suggestions?}` as the plane sends it (R6);
 * `member` is the member whose act it serves, at every level.
 */
export async function resolveClaudeCascade(account) {
  const level = levelOf(account);
  const state = await levelState(account);
  const levels = [{ level, state }];
  if (state === LEVEL_AVAILABLE)
    return { available: true, level, kind: account.kind,
             member: typeof account.member === "string" ? account.member : null,
             ...(level === "project" ? { project: projectOf(account) } : {}), levels };
  const whose = level === "group" ? localize("agent-worker.cascade.the_teams_api_key", "the team's API key")
    : level === "project" ? localize("agent-worker.cascade.the_projects_claude_account", "the project's Claude account")
    : localize("agent-worker.cascade.the_members_own_claude_account", "the member's own Claude account reference");
  return {
    available: false, reason: CASCADE_NO_ACCOUNT, level, levels,
    detail: state === LEVEL_REVOKED
      ? localize("agent-worker.cascade.whose_has_been_published_in", "{whose} has been published in this repository, which revokes it, so no model turn can run under it. {v1}", { whose: String(whose), v1: String(level === "group"
          ? localize("agent-worker.cascade.an_administrator_sets_a_new", "An administrator sets a new key for the team, or members connect their own.")
          : level === "project"
          ? localize("agent-worker.cascade.an_owner_of_the_project", "An owner of the project sets a new one; until then the member's own account, else the team's API key, serves them only while your team's Civicsmith holds it and it is on.")
          : localize("agent-worker.cascade.the_member_connects_a_new", "The member connects a new one; until then the team's API key serves them only while your team's Civicsmith holds it and it is on.")) })
      : localize("agent-worker.cascade.no_usable_claude_account_arrived", "no usable Claude account arrived for this act ({whose} was absent, empty, named no member{v1}, or of a kind its level does not hold). Which account serves a member's act is your team's Civicsmith's to answer (the project's, else the member's own, else the team's API key while it is held and on); a member whom none serves has no assistant.", { whose: String(whose), v1: String(level === "project"
          ? " or no project" : "") }),
  };
}

/**
 * R33 — `{level, reference}` exactly when R32 resolves, else null; `level` the account's own (`project`, `member` or
 * `group`). `reference` is in `agent-model`'s terms (`{kind: "apikey", key}` or, R82, `{kind: "signin", member,
 * secret}`, the member whose own runner instance runs the conversation on the token `credentials` holds; its R16), for
 * the one call it serves; never logged, echoed or kept by any state of this module (R36). A project's sign-in is that
 * one member's own and becomes exactly the member's own reference; no reference names the project (R71;
 * `agent-runner` R2).
 */
export async function cascadeToken(account) {
  const st = await resolveClaudeCascade(account);
  if (!st.available) return null;
  return { level: st.level,
           reference: account.kind === "signin" ? { kind: "signin", member: memberOf(account), secret: secretOf(account) }
                                                : { kind: "apikey", key: secretOf(account) } };
}
