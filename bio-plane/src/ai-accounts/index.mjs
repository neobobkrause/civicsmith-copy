/* ai-accounts — the AI accounts the assistant's use is paid by, sealed at rest, and the choice of the one an act uses.
 * From T53 an account is an owner's plan at a provider (R40), reached by one of five means (`gateway`, `sealed`,
 * `reference`, `issued`, `none`) and holding an ordered allow-list of the entries of `ai-catalogue`'s signed list; an
 * owner (a member, a project, the team) keeps one ordered list of accounts (R41), and which account serves an act is the
 * walk of that list under the plan's scope, the checks P1–P7, Gate 1's verdict per part, the account's switch for the kind of
 * use, the free-tier warning, the recipient's notice and the payer flag (R7, R11, R42–R57). The material limits that keep a
 * team's or a project's material away from AI (R20–R22), the notices and disclosure owed before an account pays, and each
 * account's change history (R16) are here too. Who the members are is `membership`'s; what a person signs in with, and the
 * grant an ask reads under, are `credentials`'.
 *
 * Requirements: build/requirements/ai-accounts.md (R1–R77). Split from `credentials` by copy at T48 (R1–R34; N996, K617,
 * K624, K3101); T53 (K5457, N1220; AI-DESIGN's drafts, DEC-465, DEC-466, DEC-471, DEC-476, K5478, K5493, K5501) replaced the
 * one-table-per-kind accounts with the account model of R40 on, retired twelve ops (R35) and declared the new ones (R61, R71),
 * and `migrate` converts today's rows (R59).
 *
 * SHAPE (K61). `aiAccountsOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`, reaching
 * record-core by `recordOf(ctx)` and membership by `membershipOf(ctx)` on the same `ctx`; credentials' factory creates it with
 * the Worker's seal secret (`sealSecret`, R24, R32) and `ai-catalogue`'s service (`catalogue`), and a test may pass its own
 * `{record, membership, sealSecret, catalogue}`, read on the first call only. Its first construction is this module's start:
 * it registers its two listeners with membership (R27, R77). It reads only record-grammar, record-core, membership and
 * ai-catalogue, and membership only through its services, never by SQL. Every refusal names its reason; no service throws.
 *
 * The class is built in layers, one file each, each extending the one before: base (clock, refusals, authority, seal,
 * catalogue reads, disclosure), limits (R20–R22), accounts (R40 and what is stored of one), lists (R41, R46, R49), offering
 * (R47, R51–R56), serving (R7, R11, R50, R65–R68, R74–R76), lifecycle (R27, R59, R72, R77, migrate) and, deprecated, the
 * compatibility seam of the pre-T53 names (F1). */
import { recordOf } from "../record-core/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { AiAccountsLegacy } from "./legacy.mjs";
import { deepFreeze } from "./base.mjs";

export { AI_ACCOUNTS_TABLES, AI_ACCOUNTS_MIXED_TABLES, AI_ACCOUNTS_PROJECT_TABLES, AI_ACCOUNTS_HISTORY_TABLE,
  AI_ACCOUNTS_LEGACY_SCHEMA, AI_ACCOUNTS_LEGACY_TABLES } from "./schema.mjs";
export { AI_ACCOUNT_CHECKS, AI_WORDS } from "./checks.mjs";
export { USE_KINDS, EXPLORE_VALUES, USE_SWITCHES, ACCOUNT_SWITCHES, PART_OF_KIND, KEEP_AWAY_REASON, MEANS, CHECK_IDS, HOP_REASONS,
  REFERENCE_MAX_CHARS, TERMS_NOTICE_DAYS, WORKER_CLASS, SIGNIN_TOKEN_LENGTH, HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX,
  PAYER_CAUSES, GATEWAY_ROUTES } from "./constants.mjs";

/* F1 (coordinator, 4 Nov): the last layer is the compatibility seam, the deprecated pre-T53 names its users still call,
   each over the T53 model (legacy.mjs). */
export class AiAccounts extends AiAccountsLegacy {}

/* R34 (T48; N1041, K3148): AI_KEPT_AWAY's fail-closed answer, with its row, as `aiKeptAway` answers it when the setting cannot be
   read: asked of the one site over no store, so it is that answer and never a copy of it. An in-plane caller whose call to
   `aiKeptAway` threw or could not be made answers this as given (K231). */
export const KEPT_AWAY_UNREADABLE = deepFreeze(new AiAccounts({ sql: null }).aiKeptAway());
AiAccounts.KEPT_AWAY_UNREADABLE = KEPT_AWAY_UNREADABLE;

/* K61: the one AiAccounts of a Durable Object's storage, made on first use over its `sql`, reaching record-core and membership
   by their factories on the same `ctx`; its first construction registers its listeners (R27, R77). `record`, `membership`,
   `sealSecret` and `catalogue` are read on the first call only (R32: credentials' factory passes the seal secret it is given). */
const OF = new WeakMap();
export function aiAccountsOf(ctx, { record = null, membership = null, sealSecret = null, now = null, catalogue = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let a = OF.get(storage);
  if (!a) {
    a = new AiAccounts({ sql: storage.sql, core: record ?? recordOf(ctx), membership: membership ?? membershipOf(ctx, { record }),
                         sealSecret, now, catalogue });
    OF.set(storage, a);
    a.start();
  }
  return a;
}

/* R32, R38, R61, R65–R71: the ops this module answers, as entries of the plane's one route map (spread by the plane before
   credentials'). `url` carries the control plane's stamps (`by`, `viewer`) in its query, read AFTER the body is spread, so a
   caller's own copy never wins (D-136); `body` is the parsed body; a secret or key only ever in the body, never the query.
   (R38) A member's own act takes the member from the door's stamped `by`, never the body. The in-plane reads (`accountFor`,
   `accountSecretFor`, `accountSwitchesOf`, `accountUsesOf`, `aiKeptAway`, `projectsKeptAway`, `disclosureDue`, `hopFor`,
   `gatewayServedCheck`, `creditsStopsOpen`, `termsNoticesDue`, `accountNoticesFor`, `accountsOnSummary` and R24–R26) are not
   routed; the seven ops of R35 and the five of R10, R12, R13 are not in it. Which credential reaches each op is
   op-declarations' and control-plane's. */
export function aiAccountsOps(a, url, body, env) {
  /* R39 (K5192): the store's environment is the instance clock's source (`_nowMs`). `a` is the instance, or `credentials`'
     instance, which answers through its `accounts`; both read the same clock. */
  const inst = a instanceof AiAccounts ? a : a?.accounts;
  if (inst && env && typeof env === "object") inst.env = env;
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const by = () => url.searchParams.get("by");
  const viewer = () => url.searchParams.get("viewer");
  const q = (k) => url.searchParams.get(k);
  /* a body field, only when it is a string; the arms below name what each reads */
  const s = (k) => (typeof b[k] === "string" ? b[k] : null);
  /* F2: the member a member's own act names, from the stamped `by`. The plane door stamps a session's `by` already as
     `member:<id>` (admission's resolveSession, through store-request's innerRequest), so a stamp that starts `member:` is
     the owner as it stands; a bare id (the founder's `admin`, a caller stamping the id alone) gains the prefix. Never
     `member:member:<id>`. */
  const me = () => { const v = by(); return typeof v === "string" && v.startsWith("member:") ? v : `member:${v}`; };
  const ownerOf = (who) => (who === "group" || who === "team" ? "group" : who === "member" ? me() : null);
  return {
    /* R38, R40: the team's and a project's account by the owner named in the body; a member's own from the stamp alone */
    aiaccountadd: () => (typeof b.owner === "string" && b.owner.startsWith("member:")
      ? a.accountSet({ ...b, owner: null, by: by() }) : a.accountSet({ ...b, by: by() })),
    aiownadd: () => a.accountSet({ ...b, owner: me(), by: by() }),
    aiaccountremove: () => a.accountRemove({ account_id: s("account_id"), by: by() }),
    aiaccountswitch: () => a.accountSwitch({ account_id: s("account_id"), on: b.on, by: by() }),
    /* R70: the team's list or the member's own; `owner` `group` or `member`, the member from the stamp */
    aiorderset: () => a.accountMove({ owner: ownerOf(s("owner")) ?? s("owner"), account_id: s("account_id"), position: b.position, by: by() }),
    aiprojectorder: () => a.accountOrderSet({ owner: s("project") === null ? null : `project:${s("project")}`, accounts: b.accounts, by: by() }),
    /* R46: the ceilings, and an account's own entries when the body names the account */
    aimemberallow: () => a.offeredSet({ owner: "group", entries: b.entries ?? null, by: by() }),
    aiprojectuse: () => (s("account_id") !== null ? a.accountEntriesSet({ account_id: s("account_id"), entries: b.entries, by: by() })
      : a.offeredSet({ owner: s("project") === null ? null : `project:${s("project")}`, entries: b.entries ?? null, by: by() })),
    aimineuse: () => (s("account_id") !== null ? a.accountEntriesSet({ account_id: s("account_id"), entries: b.entries, by: by() })
      : a.offeredSet({ owner: me(), entries: b.entries ?? null, by: by() })),
    /* R52, R53: the checks of the team, of a project, and of the member herself */
    aicheckset: () => a.checksSet({ level: "group", check: s("check"), ticked: b.ticked, by: by() }),
    aiprojectcheckset: () => a.checksSet({ level: s("project") === null ? null : `project:${s("project")}`, check: s("check"), ticked: b.ticked, by: by() }),
    aimycheckset: () => a.checksSet({ level: me(), check: s("check"), ticked: b.ticked, by: by() }),
    /* R44, R69: a gateway key entered (never echoed), confirmed in the dashboard, or kept sealed (R69) */
    aikeyenter: () => a.gatewayKeyEnter({ account_id: s("account_id"), key: b.key, by: by() }),
    aikeycloudflare: () => a.gatewayKeyAttest({ account_id: s("account_id"), by: by() }),
    aikeyseal: () => a.aiKeySeal({ account_id: s("account_id"), secret: b.secret, by: by() }),
    /* R56, R47: the free tier's warning, a personal subscription chosen */
    aitermsaccept: () => a.freeTierAccept({ account_id: s("account_id"), by: by() }),
    aitermswithdraw: () => a.freeTierWithdraw({ account_id: s("account_id"), by: by() }),
    aipersonalchoose: () => a.accountSet({ ...b, owner: me(), by: by() }),
    /* R68, R49, R51: the credits stop cleared, a share flag, a recipient's notice seen */
    aicreditsclear: () => a.aiCreditsClear({ account_id: s("account_id"), by: by() }),
    aioptinset: () => a.crossOwnerOptInSet({ account_id: s("account_id"), on: b.on, by: by() }),
    aisend: () => a.recipientNoticeSeen({ member: by(), provider: s("provider"), host: s("host"), by: by() }),
    /* R20, R21 (DEC-172): the keep-away acts, `by` the stamp after the body; its state, which reaches every active member
       through the op's spec (op-declarations, control-plane) */
    aikeepaway: () => a.aiKeepAwaySet({ ...b, by: by() }),
    aikeepawaystate: () => a.aiKeepAwayState(),
    projectaikeepaway: () => a.projectAiKeepAwaySet({ ...b, by: by() }),
    projectaikeepawaystate: () => a.projectAiKeepAwayState({ project: q("project"), viewer: viewer() }),
    /* R14–R17: an account's switches, its panel, its changes and its state, to its owners; `viewer` the stamp */
    accountusesset: () => a.accountUsesSet({ account_id: s("account_id"), switch: b.switch, on: b.on, by: by() }),
    accountuses: () => a.accountUses({ account_id: q("account_id"), viewer: viewer() }),
    accounthistory: () => a.accountHistory({ owner: q("owner"), viewer: viewer(), limit: q("limit") }),
    accountstate: () => a.accountState({ account_id: q("account_id"), viewer: viewer() }),
    accountsof: () => a.accountsOf({ owner: q("owner"), viewer: viewer() }),
    aichecks: () => a.checksState({ level: q("level"), viewer: viewer() }),
    aioffered: () => a.offeredOf({ owner: q("owner"), viewer: viewer() }),
    personalchoice: () => a.personalChoiceState({ account_id: q("account_id"), viewer: viewer() }),
    /* R65–R67: served to the agent Worker's principal alone; `by` is its stamp */
    aicredential: () => a.aiCredential({ account_id: s("account_id"), act: b.act ?? null, by: by() }),
    aigatewayserved: () => a.aiGatewayServed({ account_id: s("account_id"), record: b.record ?? null, act: b.act ?? null, by: by() }),
    aicredentialfailed: () => a.aiCredentialFailed({ account_id: s("account_id"), why: s("why"), act: b.act ?? null, by: by() }),
  };
}

const D = (accepts, requires, extra = {}) => ({ classes: ["admin", "member"], machineClasses: [], mutating: true, needs: null, weight: "substrate", fields: { accepts, requires }, ...extra });

/* R36, R37, R61, R71 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send,
   declared by their owner beside the ops map: each row's class, weight and description, its fields what the arm reads. The
   plane ops of R65–R67 carry no member rung (served to the Worker's principal alone) and are not declared. F5: each AI op's
   weight is the grade `op-grades` R57 states (reversible, reasoned for the three check ops, terminal `aiaccountremove`, ground
   `credential` for the three key ops), so its hand rows agree with this row. */
export const DECLARED_OPS = Object.freeze({
  accountusesset: D(["account_id", "switch", "on"], ["account_id", "switch", "on"], { description: localize("ai-accounts.declared.accountusesset", "the account's configuration: an owner sets one of its uses' switches (explore no, ask or yes); it moves no document, claim or grade") }),
  projectaikeepaway: D(["project", "on", "uses", "reason"], ["project"], { weight: "reasoned", description: localize("ai-accounts.declared.projectaikeepaway", "setting: whether a project keeps its material away from the assistant, an owner's act with a reason; moves no bundle") }),
  aikeepaway: D(["on", "uses", "reason"], [], { weight: "reasoned", description: localize("ai-accounts.declared.aikeepaway", "setting: whether the group keeps its material away from every assistant, an administrator's act with a reason; moves no bundle") }),
  aiaccountadd: D(["owner", "provider", "plan", "means", "entries", "secret", "reference", "terms_version", "account_id"], ["owner", "provider", "plan"], { weight: "reversible", description: localize("ai-accounts.declared.aiaccountadd", "credential governance: the team's or a project's AI account, an administrator's or an owner's; a secret is sealed and never answered") }),
  aiownadd: D(["provider", "plan", "means", "entries", "secret", "reference", "terms_version", "account_id"], ["provider", "plan"], { weight: "reversible", description: localize("ai-accounts.declared.aiownadd", "credential governance: a member's own AI account, never answered; the subject is a credential, not a bundle") }),
  aiaccountremove: D(["account_id"], ["account_id"], { weight: "terminal", description: localize("ai-accounts.declared.aiaccountremove", "credential governance: an owner removes an AI account; the subject is who pays for the assistant, not a bundle") }),
  aiaccountswitch: D(["account_id", "on"], ["account_id", "on"], { weight: "reversible", description: localize("ai-accounts.declared.aiaccountswitch", "the account's configuration: whether an AI account is on; its owner's; moves no document, claim or grade") }),
  aiorderset: D(["owner", "account_id", "position"], ["owner", "account_id", "position"], { weight: "reversible", description: localize("ai-accounts.declared.aiorderset", "the account list's configuration: an administrator or a member moves one account to a place in their own list; moves no document, claim or grade") }),
  aiprojectorder: D(["project", "accounts"], ["project", "accounts"], { weight: "reversible", description: localize("ai-accounts.declared.aiprojectorder", "the account list's configuration: a project's list of accounts, an owner's act; moves no document, claim or grade") }),
  aimemberallow: D(["entries"], [], { weight: "reversible", description: localize("ai-accounts.declared.aimemberallow", "the offered AIs' configuration: the team's ceiling of which AIs may be offered; an administrator's") }),
  aiprojectuse: D(["project", "entries", "account_id"], [["project", "account_id"]], { weight: "reversible", description: localize("ai-accounts.declared.aiprojectuse", "the offered AIs' configuration: a project's ceiling, or one of its accounts' entries; an owner's") }),
  aimineuse: D(["entries", "account_id"], [], { weight: "reversible", description: localize("ai-accounts.declared.aimineuse", "the offered AIs' configuration: a member's own ceiling, or one of their accounts' entries") }),
  aicheckset: D(["check", "ticked"], ["check", "ticked"], { weight: "reasoned", description: localize("ai-accounts.declared.aicheckset", "the checks' configuration: whether the team requires a check of every AI; an administrator's") }),
  aiprojectcheckset: D(["project", "check", "ticked"], ["project", "check", "ticked"], { weight: "reasoned", description: localize("ai-accounts.declared.aiprojectcheckset", "the checks' configuration: whether a project requires a check of the AIs used in it; an owner's") }),
  aimycheckset: D(["check", "ticked"], ["check", "ticked"], { weight: "reasoned", description: localize("ai-accounts.declared.aimycheckset", "the checks' configuration: whether a member requires a check of the AIs used for their own work") }),
  aikeyenter: D(["account_id", "key"], ["account_id", "key"], { weight: "credential", description: localize("ai-accounts.declared.aikeyenter", "credential governance: a key handed to the gateway and kept nowhere here; never answered") }),
  aikeycloudflare: D(["account_id"], ["account_id"], { weight: "credential", description: localize("ai-accounts.declared.aikeycloudflare", "credential governance: confirms that a key was entered in the Cloudflare dashboard; the key never reaches here") }),
  aikeyseal: D(["account_id", "secret"], ["account_id", "secret"], { weight: "credential", description: localize("ai-accounts.declared.aikeyseal", "credential governance: a key kept sealed in your team's Civicsmith; never answered") }),
  aitermsaccept: D(["account_id"], ["account_id"], { weight: "reversible", description: localize("ai-accounts.declared.aitermsaccept", "the account's configuration: its owner accepts a free plan's warning; recorded with who and when") }),
  aitermswithdraw: D(["account_id"], ["account_id"], { weight: "reversible", description: localize("ai-accounts.declared.aitermswithdraw", "the account's configuration: its owner withdraws a free plan's acceptance") }),
  aipersonalchoose: D(["provider", "plan", "means", "entries", "secret", "reference", "terms_version", "account_id"], ["provider", "plan"], { weight: "reversible", description: localize("ai-accounts.declared.aipersonalchoose", "credential governance: a member chooses to connect their own subscription; recorded with who, when, plan and terms version") }),
  aicreditsclear: D(["account_id"], ["account_id"], { weight: "reversible", description: localize("ai-accounts.declared.aicreditsclear", "the account's configuration: its manager clears a payer stop and turns the account back on; recorded with name and time") }),
  aisend: D(["provider", "host"], ["provider", "host"], { weight: "reversible", description: localize("ai-accounts.declared.aisend", "personal state, keyed by member: the notice of what a provider and host receive, seen by them") }),
  aioptinset: D(["account_id", "on"], ["account_id", "on"], { weight: "reversible", description: localize("ai-accounts.declared.aioptinset", "the account's configuration: whether its owner level shares it with lists; moves no document, claim or grade") }),
});

