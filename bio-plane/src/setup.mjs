/* instance-setup: what a team's Civicsmith is and whose it is (R1–R19, R26–R31, R33–R43, R47, R50–R55, R60, R62–R66, R76–R86,
 * R88–R101; R67–R75 and R87 are `translations`', R94).
 *
 * `/` answers the interface (R83, R86; N1002, K3171), so this module composes and serves no page and exports none. What it
 * keeps is R47's one holder of the words on who controls the team's Civicsmith (`HOSTING_CONTROL`, in `setup-fleet.mjs`,
 * re-exported here), which `screens-entry` and the installer read. Every sentence it answers that a member or an
 * administrator reads is read by key (R96): `word(key, vars)` for a row of the design's list, `localize(id, en, vars)`
 * for one written first here.
 */

/* The Civicsmith agent's one composer is acquisition's (its R24), read there and never copied. */
import { civicsmithUserAgent } from "./acquisition/index.mjs";
/* R64 (N700): a language tag is read by jurisdictions' `isLocale` (its R37), never by a reading of this module's own. */
import { list as heldProfiles, get as heldProfile, combine as combineProfiles, governingZone, isLocale } from "../../jurisdictions/index.mjs";
import { recordOf, stampInstant } from "./record-core/index.mjs";
import { membershipOf, notAnAdmin } from "./membership/index.mjs";
import { credentialsOf } from "./credentials/index.mjs";
/* N996 §5 (T48; ai-accounts R7, R21): whether the group keeps its material away from AI, and the disclosure read's
   registration, are `ai-accounts`', read there and never copied; `credentials` stays for `recoveryCodesState` (R66). */
import { aiAccountsOf } from "./ai-accounts/index.mjs";
/* R88 (T48; signatures R45, R48): the release notice is verified with the one list of release keys. */
import { verifyReleaseNotice, RELEASE_KEYS } from "./sshsig.mjs";
/* R90 (T48): the start of the next local day, for a security release set aside. */
import { localDay, bounds as dayBounds } from "./civil-time/index.mjs";
import { promotionOf } from "./promotion/index.mjs";
import { governorOf } from "./host-governor/index.mjs";
import { schedulerOf } from "./scheduler/index.mjs";
import { captureOf } from "./capture/index.mjs";
import { entitiesOf } from "./entities/index.mjs";
import { linesOf, CAPACITIES as LINE_CAPACITIES } from "./lines/index.mjs";
import { provenanceOf } from "./provenance/index.mjs";
import { normAlias as termFold, extractionOf } from "./extraction/index.mjs";
import { parse as legistarParse, readPages as legistarPages, readBodyName as legistarBodyName, KEY as LEGISTAR_KEY,
         BASIS as LEGISTAR_BASIS } from "../../legistar-reader/index.mjs";
/* R65 (K1837): the no-added-fact check and the one row both assistant drafts answer until the model turn lands are
   wizard-scripts' (its R25, its rows), read there and never copied. */
import { checkDraft, WIZARD_SCRIPTS_CHECKS } from "./wizard-scripts/index.mjs";
/* R63 (T50; N1116, K3366): each row's sentence is read by its key from setup-words, never held here. */
import { word, localize } from "./setup-words/index.mjs";
import { cpuProbe } from "./cpu.mjs";
import { liveToken } from "./tokens.mjs";
/* R102 (fix round 7 G83; runtime-limits R27, R28): the team's room is obtained only through the one helper, which passes the
   configured location hint and names the room by its generation. */
import { storeStub, storeHint, storeGeneration } from "./store-place.mjs";
import { livefire } from "./livefire.mjs";
import { GROUP_SLUG_RE, FLEET_BINDINGS, HOSTING_CONTROL, hostingControlBlock } from "./setup-fleet.mjs";
/* A machine is told apart by record-grammar's one predicate, never by a reading of this module's own. */
import { isMachineIdentity } from "./record-grammar/index.mjs";
/* R94 (T50; N1084; CR-12; R99): the translation workspace is `translations'`; this module keeps the registration of the member's
   language (R64) and, for `store-door`'s test until it re-points, a re-export of the word list. */
import { translationsOf } from "./translations/index.mjs";
import { TRANSLATIONS_CHECKS } from "./translations/checks.mjs";
/* R76 (T45; grammar doubt 11): whether a records law's stages are stages of a records request is action-grammar's check
   (its R25), read there and never copied. */
import { lawStagesFindings } from "./action-grammar/index.mjs";
/* R78 (T45; K2832): the group's public identity is registered at start with public-read (its R34). */
import { publicReadOf, DECLARED_STAKE_SETTING } from "./public-read/index.mjs";
/* R80 (T46; ai-runs R78): whether this is a test instance is ai-runs' one computation, asked of its own method. */
import { AiRuns } from "./ai-runs/index.mjs";

/* R47, R83: the words on who controls the group's Civicsmith, held once in the leaf the installer imports, re-exported for
   the screens that show them (`screens-entry`). */
export { HOSTING_CONTROL, hostingControlBlock };
export { interfaceWords } from "./translations/index.mjs";

/* ============================================================================================================
 * THE INSTANCE: WHAT A GROUP'S CIVICSMITH IS AND WHOSE IT IS (instance-setup R1–R42). The module's own store-side and
 * Worker-side code, moved in from `legacy-store` and `legacy-index` at its extraction (K69, N38).
 * ============================================================================================================ */

/* The slug grammar and the fleet's binding names live in the import-free leaf the installer imports (N234, K405). */
export { GROUP_SLUG_RE, FLEET_BINDINGS };

/* D-116 — EACH FLEET MEMBER'S BUILD, READ BACK THROUGH THE BINDING THIS PLANE ACTUALLY HOLDS.
 *
 * A member versions and rolls out on its own (`BIO_Distribution_v0_1.md` §4 rule 1), and an installer that uploaded
 * one has only Cloudflare's word that it landed — never the member's, and never the PLANE's view of it, which is the
 * one that decides whether a group's PDFs, OCR and assistant do what every description of them says (D-115). So the
 * question is asked where it matters: over `env.<BINDING>`, `GET /version`, the route every member has served since
 * CPDF-9 / FL-2 / CPDF-10. Each answer is the MEMBER'S OWN reply — its `name` and `version` fields, copied — and never
 * this isolate's env.VERSION: a plane that filled these in from its own env would make every member agree for free.
 *
 * States, per member, each a first-class statement rather than a missing key:
 *   SERVING   the member answered through the binding, under its own name, with `version`.
 *   UNBOUND   this plane holds no binding by that name — the member is unreachable FROM HERE whatever the account holds.
 *   SILENT    bound, and it did not answer a readable version within the bound (`why` says what happened).
 *   MISNAMED  something answered through the binding, but under another name — the binding points at the wrong worker.
 * Read whole only on `op=bootstrap&members=1`, so the anonymous answer a browser polls does not fan out to every member;
 * since T46 (R81, R82) that answer asks the two members whose parts the screens show before sign-in (agent-worker for the
 * sign-in's runner, file-scanner for scanning and the safe view), each within the same bound. */
const MEMBER_VERSION_WAIT_MS = 4000;
/* One member's own `/version`, asked through its binding within the bound: `{report, body}`, `report` its state as
   above and `body` the member's answer when it served (agent-worker's carries `runner`, R17). */
async function askMemberVersion(env, member, binding) {
  const b = env[binding];
  if (!b || typeof b.fetch !== "function") return { report: { binding, state: "UNBOUND" }, body: null };
  let timer;
  try {
    const r = await Promise.race([
      b.fetch(`https://${member}/version`, { method: "GET" }),
      new Promise((_, no) => { timer = setTimeout(() => no(new Error(`no answer within ${MEMBER_VERSION_WAIT_MS} ms`)),
                                                  MEMBER_VERSION_WAIT_MS); }),
    ]);
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || typeof j.version !== "string" || !j.version)
      return { report: { binding, state: "SILENT", why: localize("instance-setup.setup.answered_http_status_without_a", "answered HTTP {status} without a version", { status: String(r.status) }) }, body: null };
    if (j.name !== member)
      return { report: { binding, state: "MISNAMED", name: typeof j.name === "string" ? j.name : null, version: j.version }, body: null };
    return { report: { binding, state: "SERVING", version: j.version }, body: j };
  } catch (e) {
    return { report: { binding, state: "SILENT", why: String(e && e.message || e).slice(0, 200) }, body: null };
  } finally { clearTimeout(timer); }
}

/* R17 (T46; N897 (4); agent-worker R30): `agent-runner` is a Container the plane does not bind; agent-worker does, and
   says so in its `/version` as `runner`. So the runner's state is read from agent-worker's answer: `SERVING` with
   agent-worker's version on `runner: true`, `UNBOUND` on `runner: false`, and agent-worker's own state when it did not
   serve. An agent-worker that served but said neither (a build before R30) leaves the runner unread: `SILENT`, said so,
   never `SERVING`. */
const RUNNER_MEMBER = "agent-runner";
const RUNNER_HOST = "agent-worker";
function runnerReport(host) {
  const via = { binding: host.report.binding, via: RUNNER_HOST };
  if (host.report.state !== "SERVING") return { ...host.report, ...via };
  const runner = host.body ? host.body.runner : undefined;
  if (runner === true) return { ...via, state: "SERVING", version: host.report.version };
  if (runner === false) return { ...via, state: "UNBOUND" };
  return { ...via, state: "SILENT", why: localize("instance-setup.setup.runner_host_answered_its_version", "{RUNNER_HOST} answered its version without saying whether the runner is bound", { RUNNER_HOST: String(RUNNER_HOST) }) };
}

export async function memberVersions(env) {
  const out = {};
  const asked = new Map();
  const ask = (member, binding) => {
    if (!asked.has(member)) asked.set(member, askMemberVersion(env, member, binding));
    return asked.get(member);
  };
  const hostBinding = (FLEET_BINDINGS.find(([m]) => m === RUNNER_HOST) || [])[1];
  await Promise.all(FLEET_BINDINGS.map(async ([member, binding]) => {
    out[member] = member === RUNNER_MEMBER ? runnerReport(await ask(RUNNER_HOST, hostBinding))
      : (await ask(member, binding)).report;
  }));
  return out;
}

/* R81, R82 (T47; N989, N982; K3027): which optional parts this Civicsmith has installed, answered as three flat scalar
   keys, `part_signin`, `part_scanner` and `part_safe_view`, each `true`, `false` or `null` (could not be read), and no
   nested value, so membership R132's pre-auth invariants hold whole. `part_signin` follows R17's `agent-runner`
   answer; `part_scanner` and `part_safe_view` are one part today (`file-scanner` both scans and renders the safe view,
   and its `/version` names no separate renderer), so both follow `FILE_SCANNER`'s answer and are always alike. Each:
   `SERVING` true, `UNBOUND` false, otherwise null. No reason beyond the part. */
export const PARTS = Object.freeze([["part_signin", RUNNER_MEMBER], ["part_scanner", "file-scanner"], ["part_safe_view", "file-scanner"]]);
const presentOf = (report) => (report && report.state === "SERVING" ? true : report && report.state === "UNBOUND" ? false : null);
/* R104 (fix round 8, G118; fix round 9, G118b; K4817, K4853: 60 s, BOB's figure): the fleet's versions are asked at most once a minute
   for the whole copy. `op=bootstrap` is every screen's frame, and its two asks of the fleet (agent-worker and file-scanner, each
   bounded at 4 s) were awaited on every call. A Worker is served from many isolates, so an isolate's memory alone could keep them
   only once a minute per isolate: the answer is also kept in the team's object, which every isolate visits, as a value with the
   object's own time (the object answers its age, so no two isolates' clocks are compared). The isolate's `WeakMap` stays as the
   first look; a call that finds neither asks the fleet itself, and then tells the object, once. A call that finds the ask still
   running shares it, never starts a second. The first after a cold object waits as before. A read given its `versions`
   (`members=1`, which asks the whole fleet itself) is not kept: it asks nothing here. */
export const PARTS_KEPT_MS = 60_000;
const keptParts = new WeakMap();
const PART_KEYS = Object.freeze(PARTS.map(([key]) => key));
const NO_PARTS = Object.freeze(Object.fromEntries(PART_KEYS.map((k) => [k, null])));
const askParts = async (env, v) => {
  const need = [...new Set(PARTS.map(([, m]) => m))].filter((m) => !v[m]);
  if (need.length) {
    const host = need.includes(RUNNER_MEMBER) ? FLEET_BINDINGS.find(([m]) => m === RUNNER_HOST) : null;
    const hostAsked = host ? askMemberVersion(env, host[0], host[1]) : null;
    await Promise.all(need.map(async (m) => {
      if (m === RUNNER_MEMBER) { v[m] = runnerReport(await hostAsked); return; }
      const pair = FLEET_BINDINGS.find(([x]) => x === m);
      v[m] = pair ? (await askMemberVersion(env, pair[0], pair[1])).report : null;
    }));
  }
  return Object.fromEntries(PARTS.map(([key, m]) => [key, presentOf(v[m])]));
};
/* The parts as the object keeps them: exactly the three flat keys, each `true`, `false` or `null`; anything else is no parts. */
const flatParts = (v) => (v && typeof v === "object" && !Array.isArray(v) && PART_KEYS.every((k) => v[k] === true || v[k] === false || v[k] === null)
  ? Object.fromEntries(PART_KEYS.map((k) => [k, v[k]])) : null);
/* Whether asking the fleet cost anything here: with neither member bound the ask is answered at once, `UNBOUND`, and the object is not told. */
const fleetBound = (env) => !!env && [RUNNER_HOST, "file-scanner"].some((m) => {
  const b = env[(FLEET_BINDINGS.find(([x]) => x === m) || [])[1]];
  return !!b && typeof b.fetch === "function";
});
/* The first look: this isolate's entry for `env` when it is live (`owner` false), else a new entry this call owns (`owner` true). */
function claimParts(env, now) {
  const at = now();
  const held = keptParts.get(env);
  if (held && at - held.at < PARTS_KEPT_MS && at >= held.at) return { entry: held, owner: false };
  const entry = { at, parts: null, asking: null, how: null, askMs: 0 };
  keptParts.set(env, entry);
  return { entry, owner: true };
}
/* The owner's work: the object's kept parts first (`readKept` answers `{parts, age_ms}` or null), else the fleet, told to the
   object afterwards (`writeKept`). It never rejects: a failure leaves no entry and answers every part `null`. */
function runOwner(entry, env, now, { readKept, writeKept }) {
  entry.asking = (async () => {
    try {
      let kept = null;
      try { kept = await readKept(); } catch { kept = null; }
      const shared = kept ? flatParts(kept.parts) : null;
      if (shared && Number.isFinite(kept.age_ms) && kept.age_ms >= 0 && kept.age_ms < PARTS_KEPT_MS) {
        entry.at -= kept.age_ms; entry.how = "shared"; entry.parts = shared;
        return shared;
      }
      const t = now();
      const parts = await askParts(env, {});
      entry.askMs = Math.max(0, now() - t); entry.how = "asked"; entry.parts = parts;
      if (fleetBound(env)) { try { await writeKept(parts); } catch { /* the object not told is only a later isolate asking again */ } }
      return parts;
    } catch {
      if (keptParts.get(env) === entry) keptParts.delete(env);
      return { ...NO_PARTS };
    }
  })();
}
/* `{parts, kept, ms}`: `kept` is true when no ask of the fleet was made or awaited by this call (the answer was already held, here or in the
   object); `ms` the time this call spent on the fleet. */
async function partsResult(claim, env, versions, now, since) {
  if (!claim) return { parts: await askParts(env, versions ? { ...versions } : {}), kept: false, ms: Math.max(0, now() - since) };
  const e = claim.entry;
  if (claim.owner) { const parts = await e.asking; return { parts: { ...parts }, kept: e.how === "shared", ms: e.how === "asked" ? e.askMs : 0 }; }
  if (e.parts) return { parts: { ...e.parts }, kept: true, ms: 0 };
  const parts = await e.asking;
  return { parts: { ...parts }, kept: false, ms: Math.max(0, now() - since) };
}
const claimable = (env, versions) => !versions && !!env && typeof env === "object";
/* `partsReport(env, versions, {now, stub, doAnswer})`: the parts alone. With the object (`stub`, `doAnswer`) the keep is shared with every
   isolate as `bootstrap` shares it; without, it is this isolate's. */
export async function partsReport(env, versions = null, { now = () => Date.now(), stub = null, doAnswer = null } = {}) {
  const since = now();
  const claim = claimable(env, versions) ? claimParts(env, now) : null;
  if (claim && claim.owner) {
    const shared = stub && typeof doAnswer === "function";
    runOwner(claim.entry, env, now, {
      readKept: async () => (shared ? (await bootstrapFactsOf(stub, doAnswer, { facts: false, viewer: null, parts: true })).kept : null),
      writeKept: async (parts) => { if (shared) await keepPartsOf(stub, doAnswer, parts); },
    });
  }
  return (await partsResult(claim, env, versions, now, since)).parts;
}
/* G118b (R-LOG): which isolate answered. The id is made once per isolate, at its first use; the age is its own. */
let isolateMark = null;
const isolateOf = (now) => {
  if (!isolateMark) isolateMark = { id: Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join(""), at: now() };
  return isolateMark;
};

/* R80 (T46; N897 (2); ai-runs R78): whether this is a test instance, asked of `ai-runs`' own `testInstance` over this
   isolate's environment (the one computation, never a copy of its condition); a read that throws is `false`. */
export function testInstanceOf(env) {
  try { return AiRuns.prototype.testInstance.call({ env: env || {} }) === true; } catch { return false; }
}

/* ============================================================================================================
 * THE CHECKS THIS MODULE HOLDS (R30, K6). C-64.2, C-64.3 and C-64.5–C-64.7 moved here from the catalogue's
 * `INSTANCE_GROUP_CHECKS`, code, condition and translation unmoved, their `where`s now this file's. C-64.1
 * (GROUP_UNDETERMINED, raised at the write) stays with the catalogue's family for `promotion`; C-64.4 (a bearer on
 * the two sets) is `control-plane`'s. C-119 is the jurisdiction profiles' (R14), a family of its own.
 * ============================================================================================================ */
export const INSTANCE_SETUP_CHECKS = Object.freeze({
  GROUP_SLUG_MALFORMED: {
    check: 'C-64.2',
    where: 'src/setup.mjs instanceGroupSeed > is-instance-group-seed',
    translation: word('refusal.GROUP_SLUG_MALFORMED'),
  },
  GROUP_ALREADY_RECORDED: {
    check: 'C-64.3',
    where: 'src/setup.mjs instanceGroupSeed > is-instance-group-seed',
    translation: word('refusal.GROUP_ALREADY_RECORDED'),
  },
  GROUP_IDENTITY_NOT_ADMIN: {
    check: 'C-64.5',
    where: 'src/setup.mjs #groupIdentityGate > is-group-identity-admin',
    translation: word('refusal.GROUP_IDENTITY_NOT_ADMIN'),
  },
  GROUP_DISPLAY_NAME_MALFORMED: {
    check: 'C-64.6',
    where: 'src/setup.mjs groupNameSet > is-group-display-name',
    translation: word('refusal.GROUP_DISPLAY_NAME_MALFORMED'),
  },
  GROUP_DOMAIN_MALFORMED: {
    check: 'C-64.7',
    where: 'src/setup.mjs groupDomainSet > is-group-domain',
    translation: word('refusal.GROUP_DOMAIN_MALFORMED'),
  },
  /* R14 (N10, K102): the list of jurisdiction profiles this copy reads its local facts from. */
  PROFILES_NOT_ADMIN: {
    check: 'C-119.1',
    where: 'src/setup.mjs profilesSet > is-profiles-admin',
    translation: word('refusal.PROFILES_NOT_ADMIN'),
  },
  NOT_A_LIST: {
    check: 'C-119.2',
    where: 'src/setup.mjs profilesSet > is-profiles-list',
    translation: word('refusal.NOT_A_LIST'),
  },
  UNKNOWN_PROFILE: {
    check: 'C-119.3',
    where: 'src/setup.mjs profilesSet > is-profiles-list',
    translation: word('refusal.UNKNOWN_PROFILE'),
  },
  PROFILE_IS_TEST: {
    check: 'C-119.4',
    where: 'src/setup.mjs profilesSet > is-profiles-list',
    translation: word('refusal.PROFILE_IS_TEST'),
  },
  /* R53–R55 (DEC-172; K1957, K2093; D311): the assistant, read from whether the group keeps its material away from AI
     (credentials R52), and each member's disclosure. C-119.6 (`ASSISTANT_SWITCH_MALFORMED`) retired with the switch
     (T36-34); C-119.5 (`ASSISTANT_OFF`) retired in T37 (N765, K231): the gate answers credentials' `AI_KEPT_AWAY` (its
     R35), the one site. Neither number is reused. */
  DISCLOSURE_NOT_THE_MEMBERS: {
    check: 'C-119.7',
    where: 'src/setup.mjs disclosureShown > is-disclosure-shown',
    translation: word('refusal.DISCLOSURE_NOT_THE_MEMBERS'),
  },
  /* R51, R52: the captures a seeding reads. */
  SEED_CAPTURE_UNREADABLE: {
    check: 'C-119.9',
    where: 'src/setup.mjs seatsSeed > is-seed-capture',
    translation: word('refusal.SEED_CAPTURE_UNREADABLE'),
  },
  SEED_CAPTURE_NOT_LEGISTAR: {
    check: 'C-119.10',
    where: 'src/setup.mjs seatsSeed > is-seed-capture',
    translation: word('refusal.SEED_CAPTURE_NOT_LEGISTAR'),
  },
  DISCLOSURE_MALFORMED: {
    check: 'C-119.8',
    where: 'src/setup.mjs disclosureShown > is-disclosure-shown',
    translation: word('refusal.DISCLOSURE_MALFORMED'),
  },
  /* R60 (DEC-150 (1)): the name of a place the group works in that no held profile covers. */
  PLACE_NAME_MALFORMED: {
    check: 'C-64.8',
    where: 'src/setup.mjs placeWantedSet > is-place-name',
    translation: word('refusal.PLACE_NAME_MALFORMED'),
  },
  /* R65 (DEC-152): the assistant's draft of the group's focus and purpose, from the administrator's answers. */
  GROUP_DRAFT_NO_ANSWERS: {
    check: 'C-64.9',
    where: 'src/setup.mjs groupDescriptionDraft > is-group-draft-answers',
    translation: word('refusal.GROUP_DRAFT_NO_ANSWERS'),
  },
  GROUP_DRAFT_ANSWERS_MALFORMED: {
    check: 'C-64.10',
    where: 'src/setup.mjs groupDescriptionDraft > is-group-draft-answers',
    translation: word('refusal.GROUP_DRAFT_ANSWERS_MALFORMED'),
  },
  /* R64 (DEC-127 (1)): the language a member chooses for the screens, the member's own act. */
  MACHINE_CANNOT_SET_LANGUAGE: {
    check: 'C-119.11',
    where: 'src/setup.mjs memberLanguageSet > is-member-language',
    translation: word('refusal.MACHINE_CANNOT_SET_LANGUAGE'),
  },
  /* R79 (T46; DEC-162, DEC-175): how quickly explanations open for a member, the member's own act; the next free C-64
     numbers, awaiting T47's stamp. */
  MACHINE_CANNOT_SET_INFO_LEVEL: {
    check: 'C-64.28',
    where: 'src/setup.mjs infoLevelSet > is-info-level',
    translation: word('refusal.MACHINE_CANNOT_SET_INFO_LEVEL'),
  },
  INFO_LEVEL_UNKNOWN: {
    check: 'C-64.29',
    where: 'src/setup.mjs infoLevelSet > is-info-level',
    translation: word('refusal.INFO_LEVEL_UNKNOWN'),
  },
  /* R84 (T47; DEC-205 (2), DEC-201 (8)): the group's logo, a PNG or a JPEG of at most 200 KB; the next free C-64 number,
     awaiting T48's stamp. */
  LOGO_REFUSED: {
    check: 'C-64.30',
    where: 'src/setup.mjs groupLogoSet > is-group-logo',
    translation: word('refusal.LOGO_REFUSED'),
  },
  /* R90 (T48; N1047; DEC-226): the update acts, BOB's drafts, re-wordable by the design stream, awaiting T49's stamp. */
  UPDATE_NOT_READY: {
    check: 'C-64.32',
    where: 'src/setup.mjs #updateReady > is-update-ready',
    translation: word('refusal.UPDATE_NOT_READY'),
  },
  UPDATE_SKIP_NO_REASON: {
    check: 'C-64.33',
    where: 'src/setup.mjs updateSkip > is-update-skip',
    translation: word('refusal.UPDATE_SKIP_NO_REASON'),
  },
  /* R77 (T45; N892 (d); Actions D28d; v0.2 rule 21): the group's declared stake, the next free C-64 number, awaiting
     T46's stamp. */
  STAKE_MALFORMED: {
    check: 'C-64.27',
    where: 'src/setup.mjs declaredStakeSet > is-declared-stake',
    translation: word('refusal.STAKE_MALFORMED'),
  },
});

const refusal = (code, detail, extra) => {
  const row = INSTANCE_SETUP_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
};
/* R64, R85 (T50; K3674, K3696): `LANGUAGE_MALFORMED` (C-119.12) is `translations`' row, built from its export, never a row of
   this module's own. */
const languageMalformed = (detail) => {
  const row = TRANSLATIONS_CHECKS.LANGUAGE_MALFORMED;
  return { ok: false, reason: "LANGUAGE_MALFORMED", code: "LANGUAGE_MALFORMED", check: row.check, translation: row.translation, detail };
};
/* R65: a refusal in one of wizard-scripts' rows (its R25's codes, and `ASSISTANT_DRAFT_UNAVAILABLE`), with its check and
   translation as that module holds them. */
const scriptRefusal = (code, detail) => {
  const row = WIZARD_SCRIPTS_CHECKS[code] || {};
  return { ok: false, reason: code, code, check: row.check ?? null, translation: row.translation ?? null, detail };
};
const draftUnavailable = (detail) => scriptRefusal("ASSISTANT_DRAFT_UNAVAILABLE", detail);
const draftRefused = (checked) => (checked && typeof checked.code === "string"
  ? scriptRefusal(checked.code, localize("instance-setup.setup.the_draft_did_not_pass", "the draft did not pass the check that it adds no fact, so nothing is offered."))
  : draftUnavailable(localize("instance-setup.setup.the_draft_could_not_be", "the draft could not be checked, so nothing is offered.")));
/* R65, R67 (T40: N812, K2373): a draft carries no project. The door resolves the account for a draft with no project
   (`credentials` R56, `store-door` R10), so an account it hands in that is a project's (`level: "project"`, or naming a
   `project`) serves no draft here: `{project: true}`, and nothing is drafted. Otherwise the account handed on is the
   door's `{kind, level}` as given, never carrying a project. */
const draftAccount = (assistant) => {
  const a = assistant && typeof assistant === "object" ? assistant.account ?? null : null;
  if (!a || typeof a !== "object") return { account: null };
  if (a.level === "project" || (a.project !== undefined && a.project !== null)) return { project: true };
  const { project: _none, ...account } = a;
  return { account };
};
const projectAccount = (what) => draftUnavailable(localize("instance-setup.setup.a_draft_carries_no_project", "a draft carries no project, and the account resolved for this one is a project's, so nothing was drafted and {what}.", { what: String(what) }));

/* R60: the longest name a place is given, in characters. R65: the answers' bounds, and membership R109's limits on
   the focus and the purpose a draft must fit. */
export const PLACE_NAME_MAX = 200;
export const GROUP_DRAFT_ANSWERS_MAX = 20;
export const GROUP_DRAFT_ANSWER_MAX = 1000;
export const GROUP_FOCUS_MAX = 1000;
export const GROUP_PURPOSE_MAX = 4000;
/* R77: the longest declared stake, in characters. The setting it is recorded under is public-read's name for it (its
   R34, the reader), one binding, re-exported. */
export const DECLARED_STAKE_MAX = 1000;
/* R79 (DEC-162, DEC-175): the two explanation levels, and where a new member starts. */
export const INFO_LEVELS = Object.freeze(["prompt", "pause"]);
export const INFO_LEVEL_DEFAULT = "prompt";
export { DECLARED_STAKE_SETTING };
/* R84 (DEC-205 (2)): the logo's bound in bytes (200 KB read as 200,000, the stricter reading), and the two pictures it may
   be, each known by its magic bytes alone, never by what the sender says it is. */
export const GROUP_LOGO_MAX_BYTES = 200_000;
export const GROUP_LOGO_TYPES = Object.freeze([
  Object.freeze({ type: "image/png", magic: Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }),
  Object.freeze({ type: "image/jpeg", magic: Object.freeze([0xff, 0xd8, 0xff]) }),
]);
/* R85 (DEC-205 (1)): the languages a group's members use, record-core's setting of that name, 1 to 20 tags. */
export const GROUP_LANGUAGES_SETTING = "group_languages";
export const GROUP_LANGUAGES_MAX = 20;

/* R88 (T48; N1047; DEC-226 (2)): the one public address of Civicsmith's release notice (the file `bundler` R32 writes
   beside a release's assets, in the release directory the installer reads its releases from), and the daily check's bounds.
   The address names no group, member or setting, and is fetched whole by the check, never with anything added to it. */
export const RELEASE_NOTICE_ADDRESS = "https://raw.githubusercontent.com/believeinoakland/bio/main/release/NOTICE.json";
export const RELEASE_NOTICE_MAX_BYTES = 65536;
/* The check sends this and an `accept` header, and nothing else: no cookie, no `Authorization`, and not the user agent
   `acquisition` composes, which names the group (R88). */
export const UPDATE_CHECK_USER_AGENT = "Civicsmith-update-check/1";
export const UPDATE_CHECK_EVERY_MS = 86_400_000;
/* R90 (T48): the installer's update page; `updatestart` answers it with `?version=<version>` and nothing else. A release
   set aside by "Not now" returns after this many days, or at the start of the next local day for a security release. */
export const INSTALLER_UPDATE_ADDRESS = "https://newgroup.believeinoakland.workers.dev/update";
export const UPDATE_LATER_DAYS = 14;
/* R89: the earlier releases an answer lists, at most. */
export const UPDATE_EARLIER_MAX = 50;
/* R90: a skip's reason, in characters. */
export const UPDATE_SKIP_REASON_MAX = 1000;
export const UPDATE_DECISION_KINDS = Object.freeze(["start", "later", "skip"]);

/* ============================================================================================================
 * THE TABLES (K4, `build/layers.md` ruling 3: each module owns its tables), created by `migrate` at start. Every one
 * is declared to record-core exempt from purge, in both forms (R28, R41): the instance's identity and its
 * measurements of the runtime are not derived from the corpus, in the family of `seq` and the settings.
 * ============================================================================================================ */
export const INSTANCE_SETUP_TABLES = Object.freeze(["instance_group", "group_identity_history", "group_domain_checks",
  "runtime_observations", "cpu_probe_runs", "cpu_probe_steps", "assistant_switch", "assistant_disclosures",
  "place_wanted", "place_seen", "place_arrivals", "member_languages",
  /* R79 (T46): each member's explanation level, appended. */
  "member_info_levels",
  /* R77, R11 (T45): who set the declared stake and when, each act appended beside record-core's setting. */
  "declared_stake_history",
  /* R84 (T47): the group's logo, each set or clear appended. */
  "group_logos",
  /* R88–R91 (T48; N1047): the daily update check's slot, the release notices it stored, each check, the releases that
     ran, and each administrator's decision, append-only. */
  "update_check_slot", "release_notices", "update_checks", "running_releases", "update_decisions"]);
/* Each table's classes, declared explicitly through record-core's `declareTable` (its R21; plan T33, Rules (6)). Every
   one is exempt from purge (R28, R41); none is a cache of anything; the append-only ones keep every version (R26, R53,
   R54). A member's disclosure record is theirs and the group's, never exported (it names who connected an account). */
const TABLE_CLASSES = Object.freeze({
  instance_group: { export: "admin-only", version_chain: false },
  group_identity_history: { export: "admin-only", version_chain: true },
  group_domain_checks: { export: "admin-only", version_chain: true },
  runtime_observations: { export: "admin-only", version_chain: false },
  cpu_probe_runs: { export: "admin-only", version_chain: false },
  cpu_probe_steps: { export: "admin-only", version_chain: false },
  /* R53 (T36): the retired switch's rows, kept and no longer read. */
  assistant_switch: { export: "admin-only", version_chain: true },
  assistant_disclosures: { export: "never", version_chain: true },
  /* R60, R62 (DEC-150): the place the group named, held only in its own Civicsmith, never exported (R60). */
  place_wanted: { export: "never", version_chain: true },
  place_seen: { export: "never", version_chain: false },
  place_arrivals: { export: "never", version_chain: true },
  /* R64 (DEC-127 (1)): each member's own choice of language, appended. */
  member_languages: { export: "admin-only", version_chain: true },
  /* R79 (DEC-162, DEC-175): each member's own explanation level, appended, R64's class. */
  member_info_levels: { export: "admin-only", version_chain: true },
  /* R77: the group's settings' class, exempt from purge; the stake is public, who set it is the administrators'. */
  declared_stake_history: { export: "admin-only", version_chain: true },
  /* R84: the group's settings' class, exempt from purge; the logo is public once set, who set it the administrators'. */
  group_logos: { export: "admin-only", version_chain: true },
  /* R91: the group's own running, exempt from purge as R28's are; the slot is a random value never exported. */
  update_check_slot: { export: "never", version_chain: false },
  release_notices: { export: "admin-only", version_chain: true },
  update_checks: { export: "admin-only", version_chain: true },
  running_releases: { export: "admin-only", version_chain: true },
  update_decisions: { export: "admin-only", version_chain: true },
});
/* R50–R52: the seeding ledgers name entities and lines of the registry (`entities`, `lines`), which a whole-store purge
   clears, so a whole-store purge clears them with it and a later seeding starts afresh; a bundle's purge touches none. */
export const INSTANCE_SETUP_SEED_TABLES = Object.freeze(["seed_entities", "seed_lines", "seed_offices", "seed_bodies"]);
export const INSTANCE_SETUP_TABLE_DECLARATIONS = Object.freeze([
  ...INSTANCE_SETUP_TABLES.map((name) => Object.freeze({
    name, purge: "exempt", expunge: "none", sight: "group", derive: "stored", ...TABLE_CLASSES[name] })),
  ...INSTANCE_SETUP_SEED_TABLES.map((name) => Object.freeze({
    name, purge: "clear", expunge: "none", export: "admin-only", sight: "group", derive: "stored",
    version_chain: false })),
]);
export const INSTANCE_SETUP_SCHEMA = `
-- D-436 (State Rules v1.5 section 3.1, the core field group): THE PRODUCING GROUP'S SLUG, ONE VALUE FOR THE WHOLE
-- INSTANCE. Every bundle this instance writes names it as its team, in the bytes that get signed, and nothing else may
-- supply that name: not a literal in the code, and not a deploy-time variable, which a redeploy could move silently.
-- One row, id=1, WRITTEN ONCE: every writer is an INSERT that does nothing on conflict, and no statement anywhere
-- updates or deletes it (R26).
--   source  'bootstrap'  recorded at the store's FIRST BOOT (record-core's isFirstBoot, its R54), from the slug the
--                        installer bound as INSTANCE_NAME, read at that moment only (R2)
--           'seed'       recorded once by op=instancegroupseed, the root of trust's act, on a store that already held
--                        the schema when this table arrived (R4)
--   recorded_by  NULL for bootstrap, the server-stamped credential for a seed
CREATE TABLE IF NOT EXISTS instance_group (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  slug         TEXT NOT NULL,
  recorded_at  TEXT NOT NULL,
  source       TEXT NOT NULL,
  recorded_by  TEXT
);
-- REC-164: THE PUBLISHING GROUP'S DISPLAY NAME AND ITS DOMAIN (BIO_Publication_v0_1.md section 7 points 2 and 3). Two
-- durable values, each with a dated history: a value is the LATEST row for its field, and no statement updates or
-- deletes a row (R26), so every revision stays readable with its date and the administrator who made it.
--   field             'display_name' or 'domain'
--   set_by            the member the control plane stamped from the signed-in session, never a caller's statement
--   instance_address  a domain row only: the origin the administrator's session reached, stamped by the control
--                     plane, which the well-known file must name
CREATE TABLE IF NOT EXISTS group_identity_history (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  field             TEXT NOT NULL CHECK (field IN ('display_name','domain')),
  value             TEXT NOT NULL,
  set_at            TEXT NOT NULL,
  set_by            TEXT NOT NULL,
  instance_address  TEXT
);
-- Every verdict on a claimed domain, dated (R8). 'undetermined' is recorded as what it is and never as 'absent'.
--   trigger  'set' (the administrator's act) or 'alarm' (the reconciling re-check, R9)
CREATE TABLE IF NOT EXISTS group_domain_checks (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  domain      TEXT NOT NULL,
  verdict     TEXT NOT NULL CHECK (verdict IN ('verified','absent','mismatched','undetermined')),
  checked_at  TEXT NOT NULL,
  trigger     TEXT NOT NULL,
  status      INTEGER,
  detail      TEXT
);
-- What the runtime was observed to COST (R33, R34), measured rather than assumed. capture_limits (capture's) holds
-- ceilings found by being refused; this holds consumption found by measuring. The columns are named *_ms for the
-- metric that first wrote them; each metric carries its own UNIT, and a count of work is never read as a time.
CREATE TABLE IF NOT EXISTS runtime_observations (
  metric     TEXT PRIMARY KEY,
  peak_ms    REAL NOT NULL,
  peak_at    TEXT NOT NULL,
  peak_detail TEXT,
  last_ms    REAL NOT NULL,
  last_at    TEXT NOT NULL,
  samples    INTEGER NOT NULL DEFAULT 1,
  total_ms   REAL NOT NULL DEFAULT 0,
  unit       TEXT
);
-- The stepped CPU probe's durable trail (R35–R40), ONE RUN APART FROM ANOTHER. Exceeding the CPU limit TERMINATES the
-- isolate, so no run can record its own death: a run is started, each step it completes is written before the next
-- begins, and its end is written when it returns. A run with no end is one the isolate did not survive, and the
-- ceiling lies between its last completed step and the next, each timed from that run's own start.
CREATE TABLE IF NOT EXISTS cpu_probe_runs (
  run         TEXT PRIMARY KEY,
  started_at  TEXT NOT NULL,
  iterations  INTEGER,
  budget_ms   REAL,
  ended_at    TEXT,
  reason      TEXT,
  completed   INTEGER,
  elapsed_ms  REAL
);
CREATE TABLE IF NOT EXISTS cpu_probe_steps (
  run         TEXT NOT NULL,
  step        INTEGER NOT NULL,
  elapsed_ms  REAL NOT NULL,
  iterations  INTEGER NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (run, step)
);
-- R53 (K1502; retired in T36, DEC-172): the switch that recorded whether the assistant was enabled, each set appended
-- with who and when. Its rows are kept and no longer read; nothing writes it. No row updates or deletes another.
CREATE TABLE IF NOT EXISTS assistant_switch (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  on_     INTEGER NOT NULL CHECK (on_ IN (0, 1)),
  set_by  TEXT NOT NULL,
  set_at  TEXT NOT NULL
);
-- R50–R52: what this module seeded, so a repeat is answered already and the offices it seeded can be named (K1683).
-- seed_entities: one row per scheme identifier this module seeded an entity under (or found one holding).
CREATE TABLE IF NOT EXISTS seed_entities (
  scheme     TEXT NOT NULL,
  id         TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  kind       TEXT NOT NULL,
  label      TEXT NOT NULL,
  source     TEXT NOT NULL,
  seeded_at  TEXT NOT NULL,
  PRIMARY KEY (scheme, id)
);
-- seed_lines: one row per line this module recorded, keyed by its kind, its ends and the source row it rests on.
CREATE TABLE IF NOT EXISTS seed_lines (
  key          TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  from_entity  TEXT NOT NULL,
  to_entity    TEXT NOT NULL,
  line_id      TEXT NOT NULL,
  seeded_at    TEXT NOT NULL
);
-- seed_offices: each profile office (jurisdictions R24's counterparty) seeded, by its profile, role and body.
CREATE TABLE IF NOT EXISTS seed_offices (
  profile        TEXT NOT NULL,
  role           TEXT NOT NULL,
  body           TEXT NOT NULL,
  entry          TEXT NOT NULL,
  office_entity  TEXT NOT NULL,
  body_entity    TEXT NOT NULL,
  seeded_at      TEXT NOT NULL,
  PRIMARY KEY (profile, role, body)
);
-- R50, R51: each profile body seeded under the profile's own identifier for it (ids.body), with or without its office,
-- so R51 finds the body a Legistar body is matched to even where the profile gives its office no identifier.
CREATE TABLE IF NOT EXISTS seed_bodies (
  profile      TEXT NOT NULL,
  role         TEXT NOT NULL,
  body         TEXT NOT NULL,
  entry        TEXT NOT NULL,
  body_entity  TEXT NOT NULL,
  seeded_at    TEXT NOT NULL,
  PRIMARY KEY (profile, role, body)
);
-- R60 (DEC-150 (1)): the place the team works in that no held profile covers, named by an administrator; the latest row
-- is the name, and a row with name NULL clears it. Held only here: nothing reads it outward. Append-only.
CREATE TABLE IF NOT EXISTS place_wanted (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT,
  set_by  TEXT NOT NULL,
  set_at  TEXT NOT NULL
);
-- R62 (DEC-150 (3)): the held profiles as last compared (at the set of a name, then at each start), one row.
CREATE TABLE IF NOT EXISTS place_seen (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  profiles  TEXT NOT NULL,
  seen_at   TEXT NOT NULL
);
-- R62: each held profile found matching the named place that was not held before, recorded once per name (place_seq,
-- the place_wanted row it matched); it leaves when the profile is made active or the name is cleared or changed.
CREATE TABLE IF NOT EXISTS place_arrivals (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  place_seq  INTEGER NOT NULL,
  name       TEXT NOT NULL,
  profile    TEXT NOT NULL,
  found_at   TEXT NOT NULL,
  left_at    TEXT,
  left_why   TEXT,
  UNIQUE (place_seq, profile)
);
-- R64 (DEC-127 (1)): the language each member chose for the screens, by their own act; the latest row per member is the
-- choice, and a row with language NULL clears it. Append-only.
CREATE TABLE IF NOT EXISTS member_languages (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  member    TEXT NOT NULL,
  language  TEXT,
  set_at    TEXT NOT NULL
);
-- R79 (T46; DEC-162, DEC-175): how quickly explanations open for each member, by their own act; the latest row per
-- member is the level. asked_at is the instant the one first-month question was answered (DEC-162 (2)), carried
-- forward on every later row once recorded, so the latest row answers it. Append-only.
CREATE TABLE IF NOT EXISTS member_info_levels (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  member    TEXT NOT NULL,
  level     TEXT NOT NULL CHECK (level IN ('prompt','pause')),
  asked_at  TEXT,
  set_at    TEXT NOT NULL
);
-- R77, R11 (T45; N892 (d)): each set or clear of the team's declared stake, with who and when, appended after
-- record-core's setting 'declared_stake' recorded it (the value public-read reads). stake NULL is a clear. Append-only.
CREATE TABLE IF NOT EXISTS declared_stake_history (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  stake   TEXT,
  set_by  TEXT NOT NULL,
  set_at  TEXT NOT NULL
);
-- R84 (T47; DEC-205 (2)): the team's logo, each set or clear by an administrator appended; the latest row is the logo,
-- and a row with data NULL clears it. 'data' is the picture's bytes in base64, 'type' read from its magic bytes.
CREATE TABLE IF NOT EXISTS group_logos (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  data    TEXT,
  type    TEXT,
  bytes   INTEGER,
  sha256  TEXT,
  set_by  TEXT NOT NULL,
  set_at  TEXT NOT NULL
);
-- R88 (T48; N1047): the minute of the day (UTC, 0 to 1439) the daily check runs at, drawn at random once and kept, never
-- computed from the slug or anything sent. One row, written once and never updated.
CREATE TABLE IF NOT EXISTS update_check_slot (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  minute    INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 1439),
  drawn_at  TEXT NOT NULL
);
-- R88, R91: each release notice the check verified and stored, exactly as signed (notes as the JSON text signed, never
-- interpreted). Append-only.
CREATE TABLE IF NOT EXISTS release_notices (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  version   TEXT NOT NULL,
  date      TEXT NOT NULL,
  manifest  TEXT NOT NULL,
  security  INTEGER NOT NULL CHECK (security IN (0, 1)),
  notes     TEXT NOT NULL,
  sig       TEXT NOT NULL,
  found_at  TEXT NOT NULL
);
-- R88: one row for every run of the check: its instant and its outcome ('found', 'none', or the refusal).
CREATE TABLE IF NOT EXISTS update_checks (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  outcome  TEXT NOT NULL,
  version  TEXT,
  detail   TEXT
);
-- R88: each release that ran, with the instant it was first seen running.
CREATE TABLE IF NOT EXISTS running_releases (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  version        TEXT NOT NULL,
  first_seen_at  TEXT NOT NULL
);
-- R90: an administrator's decision on a release, with who and when (the name by value beside the id, R75's form);
-- until_at is set for 'later'; reason is set for 'skip'. Never changed, never deleted: a later decision is another row.
CREATE TABLE IF NOT EXISTS update_decisions (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  version    TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('start','later','skip')),
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL,
  until_at   TEXT,
  reason     TEXT
);
-- R54 (D311): each time the assistant's disclosure was shown to a member before they connected their own account: who,
-- the disclosure's version, who recorded it and when. Append-only.
CREATE TABLE IF NOT EXISTS assistant_disclosures (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  member    TEXT NOT NULL,
  version   TEXT NOT NULL,
  shown_by  TEXT NOT NULL,
  shown_at  TEXT NOT NULL
);
`;


/* One line: no control character and no line or paragraph separator. */
const oneLine = (t) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(t);
/* A language tag in its canonical form, so `pt-br` and `pt-BR` are one language; the tag as given when it has none. */
const canonicalTag = (t) => { try { return Intl.getCanonicalLocales(t)[0] || t; } catch { return t; } };
async function sha256OfBytes(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/* R84, R86: a logo as sent, read: `{raw, type, bytes}` or `{why}`. `raw` is the file's bytes (a Uint8Array, an
   ArrayBuffer, or the request's own stream, read only up to the bound), or, where the bytes reach the store inside JSON,
   their base64; `rawType` is the type the sender declared, which must agree with the magic bytes when given. The type is
   the magic bytes' alone. */
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
async function bytesOfLogo(raw) {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw && typeof raw.getReader === "function") {
    const reader = raw.getReader();
    const parts = [];
    let held = 0;
    try {
      while (held <= GROUP_LOGO_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        parts.push(chunk);
        held += chunk.length;
      }
    } finally { try { await reader.cancel(); } catch { /* already closed */ } }
    const all = new Uint8Array(held);
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.length; }
    return all;
  }
  if (typeof raw === "string") {
    const b64 = raw.replace(/\s+/g, "");
    if (b64.length > Math.ceil((GROUP_LOGO_MAX_BYTES + 1) / 3) * 4 + 4) return new Uint8Array(GROUP_LOGO_MAX_BYTES + 1);
    if (!BASE64_RE.test(b64)) return null;
    try { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch { return null; }
  }
  return null;
}
async function readLogo(raw, rawType) {
  if (raw === undefined) return { why: word("setup.why.logo_sent_file") };
  const bytes = await bytesOfLogo(raw);
  if (!bytes) return { why: word("setup.why.logo_sent_file_bytes") };
  if (!bytes.length) return { why: word("setup.why.logo_sent_empty") };
  if (bytes.length > GROUP_LOGO_MAX_BYTES) return { why: word("setup.why.logo_over_bytes", { group_logo_max_bytes: String(GROUP_LOGO_MAX_BYTES) }) };
  const kind = GROUP_LOGO_TYPES.find((t) => bytes.length > t.magic.length && t.magic.every((b, i) => bytes[i] === b));
  if (!kind) return { why: word("setup.why.logo_neither_png") };
  const said = typeof rawType === "string" ? rawType.split(";")[0].trim().toLowerCase() : rawType == null ? "" : null;
  if (said === null || (said && said !== kind.type))
    return { why: word("setup.why.logo_picture_sent", { jpeg: String(kind.type === "image/png" ? "PNG" : "JPEG"), raw_type: String(String(rawType).slice(0, 40)) }) };
  return { raw: bytes, type: kind.type, bytes: bytes.length };
}
const base64Of = (bytes) => { let t = ""; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(t); };

/* R54 (D311): the assistant's disclosure. Its words are the design stream's (NOTICE to UX-DESIGN) and are shown by the
   surface; this module holds the version a shown disclosure is recorded against, and the meaning the words carry. A new
   version of the words is a new `version`, and a member shown only an earlier one reads `shown: false` until shown again. */
export const ASSISTANT_DISCLOSURE = Object.freeze({
  version: "D311-1",
  meaning: word("setup.meaning.questions_material_read"),
});

/* R50–R52: the machine's stamp on what it seeds (DEC-52), and the Legistar schemes the profiles declare for a body's
   `BodyId`, a person's `PersonId` and a seat's `OfficeRecordId` (jurisdictions R52; K1682's reading 2). */
export const SEED_MACHINE = "class:admin";
/* A profile's zone (jurisdictions R41: `time_zone`, its `value` an IANA name), or null when it states none. */
const zoneOf = (p) => {
  const z = p && p.time_zone;
  const v = z && typeof z === "object" ? z.value : z;
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
export const LEGISTAR_SCHEMES = Object.freeze({ body: "legistar_body_id", person: "legistar_person_id", seat: "legistar_office_record_id" });

/* The probe run the trail held before runs were kept apart (R40): its rows, keyed on the step alone, become one run. */
export const LEGACY_PROBE_RUN = "legacy";

/* A metric's unit, for the metrics that predate the unit column (R34): a `_bytes` metric counts bytes. */
const unitOfMetric = (metric) => (/_bytes$/.test(String(metric)) ? "bytes" : "ms");

/* =====================================================================
 * D-436 / IC-172 — THE PRODUCING GROUP, ONE RECORDED VALUE FOR THE WHOLE INSTANCE (R1–R4).
 *
 * State Rules v1.5 §3.1: every bundle.md carries `group`, the producing group's slug, and it travels with every
 * distributed copy — so it is in the SIGNED bytes. There is ONE value, the `instance_group` row, and every default and
 * every stamp reads it through `producingGroup()`, which this module registers with promotion as the fact
 * `producingGroup` (promotion R40, R1 here). Nothing in the plane names a group of its own.
 *
 * DECISION (a), WHERE IT COMES FROM (K102). It is written ONCE, at the store's FIRST BOOT (record-core's `isFirstBoot`,
 * its R54): on that boot and on no other, the slug the installer bound as INSTANCE_NAME is recorded, the worker name
 * the group chose (D-102), which `newgroup` binds in the SAME upload that creates the worker. It is checked against the
 * installer's own slug grammar first, and a missing or malformed name records NOTHING — the store then says so.
 *   NEVER A DEPLOY-TIME VARIABLE AS ITS SOURCE. INSTANCE_NAME is the channel the slug ARRIVES by, read at one moment;
 *   every later boot ignores it. So a redeploy that moves the binding moves nothing already recorded.
 *   WHY THE FIRST BOOT AND NOT op=claim. The scratch namespace is a Durable Object of its own that no claim ever
 *   reaches; the root of trust can write before anyone claims; and a claim is RE-ARMED by rotating ADMIN_TOKEN, so
 *   "the first claim" would need a witness of its own. The store's birth is witnessed by the schema itself.
 *
 * DECISION (b), A STORE THAT PREDATES THE VALUE. A store that already held the schema when this table arrived records
 * NOTHING at boot, even with INSTANCE_NAME bound: the binding and the record can disagree, and choosing between them is
 * a person's act, not a boot's. It is recorded ONCE by the root of trust (`instanceGroupSeed`), and refused a second
 * time. The documents already written are not rewritten: their bytes are signed.
 *
 * DECISION (c), NOTHING RECORDED. A write that must name the producing group is never given a default (C-64.1,
 * promotion's): the fact answers null, and the writer refuses by name.
 * ===================================================================== */

/* What a store recording no group SAYS, in ONE copy: the credentialed read and the public reads both answer with it. */
export const NO_GROUP_RECORDED = localize("instance-setup.setup.no_producing_team_is_recorded", "no producing team is recorded for this store. A store records it once: at its first boot, from the slug its installer bound, or — on a store that already held documents when the value arrived — by one act of the root of trust (op=instancegroupseed). Until then a write that must name its producing team is given no default: a caller's own statement of its team is kept as the caller's, and a write stating none is refused.");

/* REC-164 — THE DISPLAY NAME AND THE DOMAIN (R5–R11): the bounds and the file. */
export const GROUP_DISPLAY_NAME_MAX = 120;
/* A bare lowercase host name with at least one dot, labels of 1-63 letters, digits and hyphens: no scheme, path, port
   or IP literal. The last label must begin with a letter, which is what excludes a dotted-quad. */
export const GROUP_DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/* R8 (DEC-124; K1365 (5)): the file a group publishes, and the one it published before T31, read only when the first is
   `absent` so a group that already published it stays verified. The second answer decides. */
export const GROUP_WELL_KNOWN_PATH = "/.well-known/civicsmith-group.json";
export const GROUP_WELL_KNOWN_PATH_BEFORE_T31 = "/.well-known/civicos-group.json";
export const GROUP_WELL_KNOWN_MAX_BYTES = 16384;
export const GROUP_DOMAIN_RECHECK_MS = 86_400_000;   // chosen, not measured: once a day
/* IC-246: the check log answered newest first, cut at a NAMED bound and the cut PUBLISHED (R11). */
export const GROUP_DOMAIN_CHECKS_MAX = 20;

/* The instance's own address as the control plane stamped it: an origin, lowercased, no trailing slash. */
function instanceAddress(origin) {
  try {
    const u = new URL(String(origin ?? ""));
    return (u.protocol === "https:" || u.protocol === "http:") ? `${u.protocol}//${u.host}`.toLowerCase() : null;
  } catch { return null; }
}

/* R100 (C11, DEC-374; K4164): the one website file the verifier accepts for a claim, `{path, body: {instance, group}}`, from the
   address the claim was made from and the producing slug; null when either is missing. The verifier's comparison (R8) and the
   answers of `groupdomainset` and `groupidentity` (R7, R11) all read it here, so the file shown and the file accepted cannot
   drift. The path is the current file's; the file from before T31 (R8) is read with the same body. */
function groupWellKnownFile(address, slug) {
  if (typeof address !== "string" || !address || typeof slug !== "string" || !slug) return null;
  return { path: GROUP_WELL_KNOWN_PATH, body: { instance: address, group: slug } };
}
/* R8, R100: why a claim has no file to look for, the verdict's own reason by key: no producing slug, else no recorded address. */
const wellKnownWhy = (slug) => (!slug ? word("instance-setup.domain.detail.no_team_name") : word("instance-setup.domain.detail.no_address"));
/* R100: the answers' `well_known`: the file, or null with `well_known_detail`, the reason. */
function wellKnownOf(address, slug) {
  const file = groupWellKnownFile(address, slug);
  return file ? { well_known: file } : { well_known: null, well_known_detail: wellKnownWhy(slug) };
}

/* At most `max` bytes of a response body, decoded as UTF-8; the rest is never read (R8: at most 16 KiB). */
async function boundedText(res, max) {
  const body = res && res.body;
  if (!body || typeof body.getReader !== "function")
    return String(await res.text().catch(() => "")).slice(0, max);
  const reader = body.getReader();
  const parts = [];
  let held = 0;
  try {
    while (held < max) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      parts.push(chunk.subarray(0, Math.min(chunk.length, max - held)));
      held += Math.min(chunk.length, max - held);
    }
  } catch { /* what was read stands */ }
  try { await reader.cancel(); } catch { /* already closed */ }
  const all = new Uint8Array(held);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return new TextDecoder().decode(all);
}

/* R88: at most `max` bytes of a response body, read as bytes: `{bytes, over}`, `over` true when the body held more than
   `max` (one more byte is read to know, and the rest never is). */
async function boundedBytes(res, max) {
  const body = res && res.body;
  let all;
  if (!body || typeof body.getReader !== "function") {
    all = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
  } else {
    const reader = body.getReader();
    const parts = [];
    let held = 0;
    try {
      while (held <= max) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        parts.push(chunk);
        held += chunk.length;
      }
    } catch { /* what was read stands */ }
    try { await reader.cancel(); } catch { /* already closed */ }
    all = new Uint8Array(held);
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.length; }
  }
  return { bytes: all.subarray(0, max), over: all.length > max };
}

/* R88–R90: two versions of the form `<n>.<n>.<n>` compared part by part as numbers: -1, 0 or 1 (a part that is not a
   number counts as 0; `signatures` R47 holds the form, so a stored version is always one). */
function cmpVersion(a, b) {
  const x = String(a).split(".").map((n) => Number(n) || 0), y = String(b).split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i += 1) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/* =====================================================================
 * THE MODULE ON ONE DURABLE OBJECT'S STORAGE (K61): `instanceSetupOf(ctx, env, deps)`.
 * `deps` lets a test hand its own record-core, membership, promotion, governor, scheduler, capture, `fetch` and
 * `sleep`; each defaults to the module's own factory on the same `ctx`.
 * ===================================================================== */
export class InstanceSetup {
  #ctx; #env; #deps; #sql; #started = false; #languageRegistered = null; #fleetKept = null;

  constructor(ctx, env = {}, deps = {}) {
    this.#ctx = ctx;
    this.#env = env || {};
    this.#deps = deps || {};
    this.#sql = (ctx && ctx.storage ? ctx.storage : ctx).sql;
  }

  #record() { return this.#deps.record ?? recordOf(this.#ctx); }
  #membership() { return this.#deps.membership ?? membershipOf(this.#ctx); }
  #credentials() { return this.#deps.credentials ?? credentialsOf(this.#ctx, { record: this.#record(), membership: this.#membership() }); }
  /* N996 §5 (T48): the keep-away reads and the account reference's disclosure order are `ai-accounts`'. */
  #aiAccounts() { return this.#deps.aiAccounts ?? aiAccountsOf(this.#ctx, { record: this.#record(), membership: this.#membership() }); }
  #promotion() { return this.#deps.promotion ?? promotionOf(this.#ctx); }
  #governor() { return this.#deps.governor ?? governorOf(this.#ctx); }
  #scheduler() { return this.#deps.scheduler ?? schedulerOf(this.#ctx, this.#env); }
  #capture() { return this.#deps.capture ?? captureOf(this.#ctx, { env: this.#env }); }
  #queueProducers() { return this.#deps.queueProducers ?? null; }
  /* R78: public-read's one instance on this storage (the plane builds it first); a test hands its own, or null. */
  #publicRead() { return this.#deps.publicRead !== undefined ? this.#deps.publicRead : publicReadOf(this.#ctx); }
  /* R76: action-grammar's check, as imported; a test may hand its own. */
  #lawStagesFindings(stages) { return (this.#deps.lawStagesFindings ?? lawStagesFindings)(stages); }
  #fetch(...a) { return (this.#deps.fetch ?? globalThis.fetch)(...a); }
  #sleep(ms) { return this.#deps.sleep ? this.#deps.sleep(ms) : new Promise((s) => setTimeout(s, ms)); }
  #now() { return this.#deps.now ? this.#deps.now() : Date.now(); }
  /* The instance clock (K5132): an injected clock, then `env.BIO_NOW_MS`, then the wall. Every instant the module records
     reads it; a measured duration reads `#now()`, which stays on the wall. An absent value falls through, never the epoch. */
  #instant() {
    if (this.#deps.now) return this.#deps.now();
    const raw = this.#env.BIO_NOW_MS;
    if (raw !== undefined && raw !== null && raw !== "") { const v = Number(raw); if (Number.isFinite(v) && v >= 0) return v; }
    return Date.now();
  }
  #iso() { return new Date(this.#instant()).toISOString(); }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* ---- start (the Suggestions' "Factory and start") ---- */

  /** This module's tables, and the migrations of the two that predate a column (R34) or a key (R40). Idempotent. */
  migrate() {
    const bare = INSTANCE_SETUP_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const stmt of bare.split(";").map((x) => x.trim()).filter(Boolean)) this.#sql.exec(stmt);
    /* R34: a store written before the unit column holds its rows unit-less; each takes its metric's unit. */
    const cols = this.#rows(`PRAGMA table_info(runtime_observations)`).map((r) => r.name);
    if (!cols.includes("unit")) this.#sql.exec(`ALTER TABLE runtime_observations ADD COLUMN unit TEXT`);
    for (const r of this.#rows(`SELECT metric FROM runtime_observations WHERE unit IS NULL`))
      this.#sql.exec(`UPDATE runtime_observations SET unit = ? WHERE metric = ?`, unitOfMetric(r.metric), r.metric);
    /* R50: a body seeded with its office before the body ledger existed is held there too, so R51 finds it. */
    this.#sql.exec(`INSERT OR IGNORE INTO seed_bodies (profile, role, body, entry, body_entity, seeded_at)
                    SELECT profile, role, body, entry, body_entity, seeded_at FROM seed_offices`);
    /* R40: the trail that predates runs, keyed on the step alone, becomes one run of its own, and its table goes. */
    if (this.#rows(`PRAGMA table_info(cpu_probe)`).length) {
      const old = this.#rows(`SELECT step, elapsed_ms, iterations, at FROM cpu_probe ORDER BY step`);
      if (old.length && !this.#one(`SELECT run FROM cpu_probe_runs WHERE run = ?`, LEGACY_PROBE_RUN)) {
        this.#sql.exec(`INSERT INTO cpu_probe_runs (run, started_at, iterations, reason) VALUES (?, ?, ?, 'unrecorded')`,
                       LEGACY_PROBE_RUN, old[0].at, old[0].iterations);
        for (const r of old)
          this.#sql.exec(`INSERT OR IGNORE INTO cpu_probe_steps (run, step, elapsed_ms, iterations, at) VALUES (?, ?, ?, ?, ?)`,
                         LEGACY_PROBE_RUN, r.step, r.elapsed_ms, r.iterations, r.at);
      }
      this.#sql.exec(`DROP TABLE cpu_probe`);
    }
  }

  /** At start, once: the tables; the purge exemptions (R28, R41); the fact `producingGroup` (R1); the scheduler
   *  consumers `group-domain-recheck` (R9) and `update-check` (R88), scheduler R8; the release now running (R88); capture's compute listener (R42); at the first boot, R2 and R13;
   *  and last the scheduler's own `start` (its R11), so the reconcile sees this consumer and starts no probe. */
  async start({ firstBoot } = {}) {
    if (this.#started) return { ok: true, started: false, detail: "this module had already started on this storage" };
    this.#started = true;
    this.migrate();
    const out = { ok: true, started: true };
    out.purge = this.#record().declareTable("instance-setup", INSTANCE_SETUP_TABLE_DECLARATIONS.map((t) => ({ ...t })));
    out.fact = this.#promotion().registerFact("producingGroup", "instance-setup", () => this.producingGroup());
    out.consumer = this.#scheduler().register("instance-setup", { name: "group-domain-recheck", key: "groupdomain",
      due: () => this.groupDomainWake(), wake: () => this.groupDomainWake(), tick: () => this.groupDomainTick() });
    /* R88 (T48): the daily update check, one consumer, due at the group's own minute of the day (scheduler R8). */
    out.updateCheck = this.#scheduler().register("instance-setup", { name: "update-check", key: "updatecheck",
      due: () => this.updateCheckWake(), wake: () => this.updateCheckWake(), tick: (now) => this.updateCheckTick(now) });
    try { out.slot = { minute: this.#checkMinute() }; }   /* the group's minute of the day is drawn at its first start and kept */
    catch (e) { out.slot = { drawn: false, detail: localize("instance-setup.setup.the_minute_of_the_day", "the minute of the day could not be drawn: {reason}", { reason: String(String(e && e.message || e).slice(0, 200)) }) }; }
    try { out.running = this.#recordRunning(); }
    catch (e) { out.running = { recorded: false, detail: localize("instance-setup.setup.the_running_release_could_not", "the running release could not be recorded: {reason}", { reason: String(String(e && e.message || e).slice(0, 200)) }) }; }
    out.compute = this.#capture().on("compute", "instance-setup",
      (m) => this.recordRuntimeObservation({ metric: m && m.metric, ms: m && m.value, detail: m && m.detail,
                                            unit: unitOfMetric(m && m.metric) }));
    const first = firstBoot === undefined ? this.#record().isFirstBoot() : firstBoot === true;
    if (first) {
      out.group = this.#recordGroupAtFirstBoot();
      out.profiles = this.#recordProfilesAtFirstBoot();
      /* R50: at setup, the offices the profiles just recorded name are seeded (the machine's act, DEC-52). */
      if (out.profiles && out.profiles.recorded === true) {
        try { out.offices = this.officesSeed({ boot: true }); }
        catch (e) { out.offices = { ok: false, detail: localize("instance-setup.setup.the_offices_could_not_be", "the offices could not be seeded at setup: {reason}", { reason: String(String(e && e.message || e).slice(0, 200)) }) }; }
      }
    }
    /* R62: at each start, with a place named, the profiles that arrived for it; and once, the read `queue-producers`
       raises the administrators' one Status item from (its R38), read as the plane. */
    try { out.places = this.#comparePlaces(); }
    catch (e) { out.places = { compared: false, detail: localize("instance-setup.setup.the_place_could_not_be", "the place could not be compared: {reason}", { reason: String(String(e && e.message || e).slice(0, 200)) }) }; }
    out.arrivals = this.#registerArrivals();
    out.identity = this.#registerIdentity();
    out.language = this.#registerLanguage();
    /* The instance's start reconciles (scheduler R11), now that this consumer is registered: never `arm`, the producers'
       door, which would start the test seam's probe at every boot (K419). */
    try { out.armed = await this.#scheduler().start(); } catch { out.armed = null; /* the next arm reconciles */ }
    return out;
  }

  /* ---- R1–R4: the producing group ---- */

  /* R62: `placeArrivals` registered once with `queue-producers` (its R38; K31's pattern), read as the plane. */
  #registerArrivals() {
    const qp = this.#queueProducers();
    if (!qp || typeof qp.registerPlaceArrivals !== "function") return { ok: false, detail: "no producers to register with" };
    try { return qp.registerPlaceArrivals(({ viewer = null } = {}) => this.placeArrivals({ viewer })); }
    catch (e) { return { ok: false, detail: String(e && e.message || e).slice(0, 200) }; }
  }

  /* R78 (T45; K2832; public-read R34): registered once at start as public-read's group-identity source, its door
     answering R10's `groupIdentityPublic`. A refusal or a throw is answered in the start's report, never thrown. */
  #registerIdentity() {
    let pr = null;
    try { pr = this.#publicRead(); } catch (e) { return { ok: false, detail: localize("instance-setup.setup.public_read_could_not_be", "public-read could not be reached: {reason}", { reason: String(String(e && e.message || e).slice(0, 200)) }) }; }
    if (!pr || typeof pr.registerGroupIdentity !== "function") return { ok: false, detail: "no public-read to register with" };
    try { return pr.registerGroupIdentity({ identity: () => this.groupIdentityPublic() }); }
    catch (e) { return { ok: false, detail: String(e && e.message || e).slice(0, 200) }; }
  }

  /** R1: THE ONE READER — the recorded slug, or null. It reads the store and nothing else, never `env`. */
  producingGroup() {
    const r = this.#one(`SELECT slug FROM instance_group WHERE id=1`);
    return r && typeof r.slug === "string" && r.slug ? r.slug : null;
  }

  /* R2: DECISION (a)'s write, at the first boot only. */
  #recordGroupAtFirstBoot() {
    const slug = String(this.#env.INSTANCE_NAME ?? "").trim();
    if (!GROUP_SLUG_RE.test(slug)) return { recorded: false };
    this.#sql.exec(`INSERT INTO instance_group (id, slug, recorded_at, source, recorded_by)
                    VALUES (1, ?, ?, 'bootstrap', NULL) ON CONFLICT(id) DO NOTHING`, slug, this.#iso());
    return { recorded: true, group: slug };
  }

  /** R3, op=instancegroup: what this store records — and when it records nothing, that it records nothing. */
  instanceGroup() {
    const r = this.#one(`SELECT slug, recorded_at, source, recorded_by FROM instance_group WHERE id=1`);
    if (r) return { ok: true, group: r.slug, recorded_at: r.recorded_at, source: r.source, recorded_by: r.recorded_by ?? null };
    return { ok: true, group: null, recorded_at: null, source: null, recorded_by: null, detail: NO_GROUP_RECORDED };
  }

  /** R3, REC-163 / IC-174: the PUBLIC projection (Publication §7 point 1: the slug is public, and nothing else in the
   *  row is). It reads through the one reader and selects nothing else. */
  instanceGroupPublic() {
    const slug = this.producingGroup();
    return slug ? { ok: true, group: slug } : { ok: true, group: null, detail: NO_GROUP_RECORDED };
  }

  /** R4, op=instancegroupseed: DECISION (b), the root of trust's one act. The control plane stamps `author`. */
  instanceGroupSeed({ slug = null, author = null } = {}) {
    const s = typeof slug === "string" ? slug.trim() : "";
    /* DEC-49 REGION is-instance-group-seed */
    if (!GROUP_SLUG_RE.test(s))
      return refusal("GROUP_SLUG_MALFORMED", s
        ? localize("instance-setup.setup.slug_not_in_grammar", "'{slug}' is not a slug in the installer's grammar (3 to 40 of a-z, 0-9 and '-', beginning and ending with a letter or digit). Nothing was recorded.", { slug: s.slice(0, 60) })
        : localize("instance-setup.setup.slug_none_given", "The request names no slug. A team is recorded under a slug in the installer's grammar (3 to 40 of a-z, 0-9 and '-', beginning and ending with a letter or digit). Nothing was recorded."));
    const held = this.#one(`SELECT slug, recorded_at, source FROM instance_group WHERE id=1`);
    if (held)
      return refusal("GROUP_ALREADY_RECORDED",
        localize("instance-setup.setup.this_store_has_recorded_its", "this store has recorded its producing team since {recorded_at} ({source}), and it is recorded once. Nothing was changed.", { recorded_at: String(held.recorded_at), source: String(held.source) }), { group: held.slug, recorded_at: held.recorded_at, source: held.source });
    /* END DEC-49 REGION is-instance-group-seed */
    const at = this.#iso();
    const who = typeof author === "string" && author.trim() ? author.trim() : null;
    this.#sql.exec(`INSERT INTO instance_group (id, slug, recorded_at, source, recorded_by)
                    VALUES (1, ?, ?, 'seed', ?) ON CONFLICT(id) DO NOTHING`, s, at, who);
    return { ok: true, group: s, recorded_at: at, source: "seed", recorded_by: who,
             note: word("setup.note.document_store_writes") };
  }

  /* =====================================================================
   * REC-164 — THE PUBLISHING GROUP'S DISPLAY NAME AND ITS VERIFIED DOMAIN (R5–R11). `BIO_Publication_v0_1.md` §7
   * points 2 and 3, resting on point 1's public slug.
   *
   * TWO DURABLE VALUES, EACH WITH A DATED HISTORY: the value is the latest row for its field, and nothing updates or
   * deletes a row. Each is set by an ADMINISTRATOR'S SESSION ACT, and `by` is the control plane's stamp (R29), asked of
   * membership's `isAdministrator` (its R64) — a bearer is refused before this (C-64.4, control-plane's).
   *
   * THE DISPLAY NAME is presentation only (R27): it is written into no signed bytes, and the public read shows it WITH
   * the slug and never without one. THE DOMAIN is a CLAIM, shown publicly only while the latest verdict on the current
   * claim is `verified`. The verifier fetches the well-known file through the per-host governor at the set act and on
   * the reconciling alarm, because a check made once certifies a file the domain can change the next minute. Its
   * verdicts: `verified`, `absent`, `mismatched` and a FOURTH, `undetermined`, which says nothing about the domain and
   * is never recorded as `absent`.
   * ===================================================================== */

  #groupDomainRecheckMs() {
    const v = Number(this.#env.GROUP_DOMAIN_RECHECK_MS);
    return Number.isFinite(v) && v > 0 ? v : GROUP_DOMAIN_RECHECK_MS;
  }

  /* R5: WHO MAY SET EITHER VALUE — an administrator, named by the control plane's stamp, asked before anything is
     read or validated, so a caller with no standing learns nothing about what is recorded. */
  #groupIdentityGate(by) {
    /* DEC-49 REGION is-group-identity-admin */
    if (!by || !this.#membership().isAdministrator(by))
      return refusal("GROUP_IDENTITY_NOT_ADMIN",
        localize("instance-setup.setup.setting_the_teams_display_name", "setting the team's display name or claiming its domain is an administrator's act (Publication §7), and your team's Civicsmith stamps who is asking from the signed-in session rather than taking it from the caller. This caller is not one of the active administrators."), { by: by ?? null });
    /* END DEC-49 REGION is-group-identity-admin */
    return null;
  }

  #identityCurrent(field) {
    return this.#one(`SELECT value, set_at, set_by, instance_address FROM group_identity_history
                      WHERE field=? ORDER BY seq DESC LIMIT 1`, field) || null;
  }
  #identityHistory(field) {
    return this.#rows(`SELECT value, set_at, set_by FROM group_identity_history WHERE field=? ORDER BY seq`, field)
      .map((r) => ({ value: r.value, set_at: r.set_at, set_by: r.set_by }));
  }
  #domainLatestCheck(domain) {
    const r = this.#one(`SELECT domain, verdict, checked_at, trigger, status, detail FROM group_domain_checks
                         WHERE domain=? ORDER BY seq DESC LIMIT 1`, domain);
    return r ? { ...r } : null;
  }

  /** R6, op=groupnameset — §7 point 2. `by` is the control plane's stamp. */
  groupNameSet({ name = null, by = null } = {}) {
    const gate = this.#groupIdentityGate(by);
    if (gate) return gate;
    const s = typeof name === "string" ? name.trim() : "";
    const chars = [...s].length;
    /* DEC-49 REGION is-group-display-name */
    if (!s || chars > GROUP_DISPLAY_NAME_MAX || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s))
      return refusal("GROUP_DISPLAY_NAME_MALFORMED", s
        ? localize("instance-setup.setup.name_not_one_line", "A name of {chars} characters is not one line of 1 to {max} characters with no control characters. Nothing was set.", { chars, max: GROUP_DISPLAY_NAME_MAX })
        : localize("instance-setup.setup.name_none_given", "The request names no display name. A display name is one line of 1 to {max} characters with no control characters. Nothing was set.", { max: GROUP_DISPLAY_NAME_MAX }));
    /* END DEC-49 REGION is-group-display-name */
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO group_identity_history (field, value, set_at, set_by) VALUES ('display_name', ?, ?, ?)`,
                   s, at, by);
    return { ok: true, display_name: s, set_at: at, set_by: by, history: this.#identityHistory("display_name"),
             note: word("setup.note.presentation_signed_bytes") };
  }

  /** R7, op=groupdomainset — §7 point 3. `by` and `origin` are the control plane's stamps: `origin` is the address the
   *  administrator's session reached, which the domain's well-known file must name. Recorded, checked at once (R8),
   *  and the scheduler armed for the re-check (R9; scheduler R9: a later producer arms itself). */
  async groupDomainSet({ domain = null, by = null, origin = null } = {}) {
    const gate = this.#groupIdentityGate(by);
    if (gate) return gate;
    const d = typeof domain === "string" ? domain.trim().toLowerCase().replace(/\.$/, "") : "";
    /* DEC-49 REGION is-group-domain */
    if (!GROUP_DOMAIN_RE.test(d))
      return refusal("GROUP_DOMAIN_MALFORMED", d
        ? localize("instance-setup.setup.domain_not_bare_host", "'{domain}' is not a bare host name (letters, digits, hyphens and dots, with no scheme, path, port or IP address). Nothing was recorded.", { domain: d.slice(0, 80) })
        : localize("instance-setup.setup.domain_none_given", "The request names no domain. A domain is claimed as a bare host name (letters, digits, hyphens and dots, with no scheme, path, port or IP address). Nothing was recorded."));
    /* END DEC-49 REGION is-group-domain */
    const address = instanceAddress(origin);
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO group_identity_history (field, value, set_at, set_by, instance_address)
                    VALUES ('domain', ?, ?, ?, ?)`, d, at, by, address);
    const check = await this.#checkGroupDomain("set");
    try { await this.#scheduler().arm(); } catch { /* the check above stands; the next arm reconciles */ }
    return { ok: true, domain: d, set_at: at, set_by: by, instance_address: address, check,
             shown_publicly: !!check && check.verdict === "verified", history: this.#identityHistory("domain"),
             ...wellKnownOf(address, this.producingGroup()) };
  }

  /** R8, THE VERIFIER: a governed fetch of the current claim's well-known file, the file from before T31 fetched the
   *  same way only when the first answer is `absent` (the second answer then decides), and one dated verdict. */
  async #checkGroupDomain(trigger) {
    const cur = this.#identityCurrent("domain");
    if (!cur) return null;
    const domain = cur.value;
    const slug = this.producingGroup();
    const address = cur.instance_address || null;
    let verdict = "undetermined", status = null, detail;
    if (!slug || !address) {
      detail = wellKnownWhy(slug);
    } else {
      const first = await this.#readWellKnown(domain, GROUP_WELL_KNOWN_PATH, address, slug);
      let answer = first;
      if (first.verdict === "absent") {
        const before = await this.#readWellKnown(domain, GROUP_WELL_KNOWN_PATH_BEFORE_T31, address, slug);
        answer = { ...before, detail: word("instance-setup.domain.detail.both_paths", { first: first.detail, second: before.detail }) };
      }
      ({ verdict, status, detail } = answer);
    }
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO group_domain_checks (domain, verdict, checked_at, trigger, status, detail)
                    VALUES (?, ?, ?, ?, ?, ?)`, domain, verdict, at, trigger, status, detail);
    return { domain, verdict, checked_at: at, trigger, status, detail };
  }

  /* R8: ONE governed read of one well-known file on the claimed domain (admit, then report the status), following no
     redirect and reading at most 16 KiB, answered as `{verdict, status, detail}`. */
  async #readWellKnown(domain, path, address, slug) {
    let g;
    try { g = this.#governor().governorAdmit({ host: domain }); }
    catch (e) { g = { admitted: false, reason: localize("instance-setup.setup.the_governor_did_not_answer", "the governor did not answer ({reason})", { reason: String(String(e && e.message || e).slice(0, 120)) }) }; }
    if (!g || !g.admitted)
      return { verdict: "undetermined", status: null,
               detail: word("instance-setup.domain.detail.held", { domain, reason: String(g && g.reason) }) };
    if (g.wait_ms) await this.#sleep(g.wait_ms);
    let res = null;
    try {
      res = await this.#fetch(`https://${domain}${path}`, { redirect: "manual",
        headers: { "user-agent": civicsmithUserAgent(this.#env.VERSION, this.#env.INSTANCE_NAME, "group-domain") } });
    } catch { res = null; }
    if (!res)
      return { verdict: "undetermined", status: null,
               detail: word("instance-setup.domain.detail.not_finished", { path }) };
    const status = res.status;
    try { this.#governor().governorReport({ host: domain, status }); } catch { /* an unrecorded outcome is not a verdict */ }
    if (status === 404 || status === 410 || (status >= 300 && status < 400))
      return { verdict: "absent", status,
               detail: status < 400 ? word("instance-setup.domain.detail.redirected", { path, status })
                                    : word("instance-setup.domain.detail.no_file", { path, status }) };
    if (!(status >= 200 && status < 300))
      return { verdict: "undetermined", status,
               detail: word("instance-setup.domain.detail.other_answer", { path, status }) };
    const text = await boundedText(res, GROUP_WELL_KNOWN_MAX_BYTES);
    let f = null;
    try { f = JSON.parse(text); } catch { f = null; }
    const isObject = !!f && typeof f === "object" && !Array.isArray(f);
    const inst = isObject && typeof f.instance === "string" ? instanceAddress(f.instance) : null;
    const grp = isObject && typeof f.group === "string" ? f.group.trim() : null;
    const want = groupWellKnownFile(address, slug).body;
    if (inst === want.instance && grp === want.group)
      return { verdict: "verified", status, detail: word("instance-setup.domain.detail.verified", { path, address, slug }) };
    return { verdict: "mismatched", status,
             detail: !isObject
               ? word("instance-setup.domain.detail.not_json", { path })
               : word("instance-setup.domain.detail.mismatch", { path, found_address: JSON.stringify(inst ?? f.instance ?? null).slice(0, 120),
                                                                  found_team: JSON.stringify(grp).slice(0, 60), address, slug }) };
  }

  /** R9, the alarm consumer's two halves: the next re-check is due one interval after the current claim's latest
   *  verdict, and an instance claiming no domain holds no wake. */
  groupDomainWake() {
    const cur = this.#identityCurrent("domain");
    if (!cur) return null;
    const last = this.#domainLatestCheck(cur.value);
    const from = Date.parse((last && last.checked_at) || cur.set_at);
    return (Number.isFinite(from) ? from : 0) + this.#groupDomainRecheckMs();
  }
  async groupDomainTick() {
    return { groupdomain: await this.#checkGroupDomain("alarm") };
  }

  /** R10, op=groupidentity's PUBLIC projection: the slug, the display name only beside a slug, and the domain only
   *  while the latest verdict on the current claim is `verified`. */
  groupIdentityPublic() {
    const slug = this.producingGroup();
    const name = this.#identityCurrent("display_name");
    const dom = this.#identityCurrent("domain");
    const last = dom ? this.#domainLatestCheck(dom.value) : null;
    /* THE VERDICT GATE: the one line that decides whether a claimed domain reaches a stranger. */
    const verified = !!(slug && dom && last && last.verdict === "verified");
    return { ok: true, group: slug,
             display_name: slug && name ? name.value : null,
             domain: verified ? dom.value : null,
             domain_verified_at: verified ? last.checked_at : null,
             /* R84: whether the group has a logo set; its bytes are served at /app/assets/group-logo. */
             logo: this.#logoCurrent() !== null,
             ...(slug ? {} : { detail: NO_GROUP_RECORDED }) };
  }

  /** R11, op=groupidentity for a credentialed reader: R10, and the claim, its state and both histories. */
  groupIdentity() {
    const pub = this.groupIdentityPublic();
    /* Read at `max + 1` so `truncated` is measured, never inferred from the count equalling the bound. */
    const max = GROUP_DOMAIN_CHECKS_MAX;
    const checks = this.#rows(`SELECT domain, verdict, checked_at, trigger, status, detail
                                 FROM group_domain_checks ORDER BY seq DESC LIMIT ?`, max + 1);
    const dom = this.#identityCurrent("domain");
    return { ...pub,
             display_name_recorded: this.#identityCurrent("display_name")?.value ?? null,
             display_name_history: this.#identityHistory("display_name"),
             domain_claim: dom ? { domain: dom.value, set_at: dom.set_at, set_by: dom.set_by,
                                   instance_address: dom.instance_address ?? null,
                                   latest: this.#domainLatestCheck(dom.value),
                                   ...wellKnownOf(dom.instance_address ?? null, this.producingGroup()) } : null,
             domain_history: this.#identityHistory("domain"),
             domain_checks: checks.slice(0, max).map((r) => ({ ...r })),
             domain_checks_limit: max, domain_checks_truncated: checks.length > max,
             ...this.#declaredStake() };
  }

  /* =====================================================================
   * THE GROUP'S DECLARED STAKE (R77, R11; T45; N892 (d); Actions D28d; v0.2 rule 21). What the group itself has at stake
   * in the matters it works on, in its own words, set by an administrator and carried beside its public identity on
   * everything it sends or publishes (`public-read` R34 reads the setting). The value is record-core's setting
   * `declared_stake` (its R25), the one value its readers read; who set it and when, and every earlier value, are this
   * module's append-only history beside it. A change applies to what is sent or published after it; nothing already
   * signed, sent or published changes. Never set, it is `null`, never a default or an empty text.
   * ===================================================================== */

  /* R11: `declared_stake: {stake, set_by, set_at}` (the three null when none is set) and its history, oldest first. */
  #declaredStake() {
    const value = this.#record().getSetting(DECLARED_STAKE_SETTING);
    const stake = typeof value === "string" ? value : null;
    const history = this.#rows(`SELECT stake, set_by, set_at FROM declared_stake_history ORDER BY seq`)
      .map((r) => ({ stake: r.stake ?? null, set_by: r.set_by, set_at: r.set_at }));
    const last = history.length ? history[history.length - 1] : null;
    return { declared_stake: { stake, set_by: last ? last.set_by : null, set_at: last ? last.set_at : null },
             declared_stake_history: history };
  }

  /** R77, op=declaredstakeset: an administrator records the group's declared stake, or clears it with `stake: null`.
   *  `by` is the control plane's stamp (R29). Refusals, each writing nothing: `NOT_AN_ADMIN` (a machine included);
   *  `STAKE_MALFORMED`. Recorded through record-core's `setSetting` with `by`, then appended with who and when. */
  declaredStakeSet({ stake = undefined, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    if (!who || isMachineIdentity(who) || !this.#isAdmin(who))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_declaring_stake", "declaring what your team has at stake"));
    let value = null;
    if (stake !== null) {
      const s = typeof stake === "string" ? stake.trim() : "";
      const chars = [...s].length;
      /* DEC-49 REGION is-declared-stake */
      if (!s || chars > DECLARED_STAKE_MAX || !oneLine(s))
        return refusal("STAKE_MALFORMED", typeof stake !== "string"
          ? localize("instance-setup.setup.stake_none_given", "The request names no stake. A stake is one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { max: DECLARED_STAKE_MAX })
          : !s ? localize("instance-setup.setup.stake_empty", "An empty stake is not a stake. A stake is one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { max: DECLARED_STAKE_MAX })
          : oneLine(s) ? localize("instance-setup.setup.stake_too_long", "A stake of {chars} characters is not one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { chars, max: DECLARED_STAKE_MAX })
          : localize("instance-setup.setup.stake_many_lines", "A stake of {chars} characters over more than one line is not one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { chars, max: DECLARED_STAKE_MAX }));
      /* END DEC-49 REGION is-declared-stake */
      value = s;
    }
    const set = this.#record().setSetting(DECLARED_STAKE_SETTING, value, who);
    if (!set || set.ok !== true) return set;
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO declared_stake_history (stake, set_by, set_at) VALUES (?, ?, ?)`, value, who, at);
    return { ok: true, stake: value, set_by: who, set_at: at, history: this.#declaredStake().declared_stake_history,
             note: value === null
               ? word("setup.note.stake_declared_now")
               : word("setup.note.carried_beside_group") };
  }

  /* =====================================================================
   * THE GROUP'S LOGO (R84; T47; DEC-205 (2), DEC-201 (8)). Shown beside the group's name on its page, its masthead and
   * its published cases; optional, and with none the name stands alone. An administrator sets it (a PNG or a JPEG, known
   * by its magic bytes, at most 200 KB) or clears it with `image: null`; each act is appended with who and when, and
   * the latest is the logo. `groupidentity` answers `logo: true|false` (R10, R11), and control-plane serves the bytes in
   * public at `/app/assets/group-logo` (its R84) through `groupLogo()`.
   * ===================================================================== */

  #logoCurrent() {
    const r = this.#one(`SELECT data, type, bytes, sha256, set_by, set_at FROM group_logos ORDER BY seq DESC LIMIT 1`);
    return r && typeof r.data === "string" && r.data ? r : null;
  }

  /** R84, R86, op=grouplogoset: an administrator sets the group's logo, `raw` the file's bytes as the request body and
   *  `rawType` its declared type, or clears it with `raw: null`. `by` is the control plane's stamp (R29). Refusals, each
   *  writing nothing: `NOT_AN_ADMIN` (a machine included); `LOGO_REFUSED` for anything that is not a PNG or a JPEG of at
   *  most `GROUP_LOGO_MAX_BYTES`, or whose declared type is not what its magic bytes say. */
  async groupLogoSet({ raw = undefined, rawType = null, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    if (!who || isMachineIdentity(who) || !this.#isAdmin(who))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_setting_logo", "setting your team's logo"));
    let logo = null;
    if (raw !== null) {
      const read = await readLogo(raw, rawType);
      /* DEC-49 REGION is-group-logo */
      if (read.why) return refusal("LOGO_REFUSED", localize("instance-setup.setup.why_nothing_was_changed", "{why}. Nothing was changed.", { why: String(read.why) }));
      /* END DEC-49 REGION is-group-logo */
      logo = { ...read, data: base64Of(read.raw), sha256: await sha256OfBytes(read.raw) };
    }
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO group_logos (data, type, bytes, sha256, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?)`,
                   logo ? logo.data : null, logo ? logo.type : null, logo ? logo.bytes : null, logo ? logo.sha256 : null, who, at);
    return { ok: true, logo: !!logo, ...(logo ? { type: logo.type, bytes: logo.bytes, sha256: logo.sha256 } : {}),
             set_by: who, set_at: at,
             note: logo ? word("setup.note.shown_beside_group")
                        : word("setup.note.logo_now_group") };
  }

  /** R84, in-process: `{ok: true, logo: {type, bytes, sha256, data, set_at}}` with the picture in base64, or `logo: null`
   *  when none is set. Writes nothing. */
  groupLogo() {
    const r = this.#logoCurrent();
    return { ok: true, logo: r ? { type: r.type, bytes: r.bytes, sha256: r.sha256, data: r.data, set_at: r.set_at } : null };
  }

  /** R86, the store-internal route `grouplogo` (no spec): the logo's bytes with their `content-type`, `no-store` and
   *  `nosniff`, or 404 with no body when none is set; `control-plane` R84 serves it at `/app/assets/group-logo`. */
  groupLogoResponse() {
    const r = this.#logoCurrent();
    if (!r) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)), { status: 200,
      headers: { "content-type": r.type, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }

  /* =====================================================================
   * THE LANGUAGES THE GROUP'S MEMBERS USE (R85; T47; DEC-205 (1)). Civicsmith's own words are shown in each, and members
   * choose among them when they join. The places whose rules apply (the profiles, R12–R14) are not changed. The list is
   * record-core's setting `group_languages`, set by an administrator; while none is set, the active profiles' languages
   * (each profile's `locale`, jurisdictions R37) are answered.
   * ===================================================================== */

  /** R85, op=grouplanguagesset: an administrator sets the languages, 1 to 20 tags `jurisdictions.isLocale` accepts, kept
   *  in their canonical form, in order, each once. `by` is the control plane's stamp (R29). Refusals, each writing
   *  nothing: `NOT_AN_ADMIN` (a machine included); `LANGUAGE_MALFORMED`. Recorded through `setSetting` with `by`. */
  groupLanguagesSet({ languages = undefined, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    if (!who || isMachineIdentity(who) || !this.#isAdmin(who))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_setting_languages", "setting the languages your team's members use"));
    const tags = Array.isArray(languages) ? languages.map((t) => (typeof t === "string" ? t.trim() : t)) : null;
    const bad = tags ? tags.find((t) => typeof t !== "string" || !isLocale(t)) : undefined;
    if (!tags || tags.length < 1 || tags.length > GROUP_LANGUAGES_MAX || bad !== undefined)
      return languageMalformed(!tags
        ? localize("instance-setup.setup.languages_not_a_list", "The languages are sent as a list of 1 to {max} well-formed BCP 47 language tags (en, es, zh-Hant). Nothing was changed.", { max: GROUP_LANGUAGES_MAX })
        : tags.length < 1
        ? localize("instance-setup.setup.languages_empty_list", "An empty list names no language. The languages are 1 to {max} well-formed BCP 47 language tags (en, es, zh-Hant). Nothing was changed.", { max: GROUP_LANGUAGES_MAX })
        : tags.length > GROUP_LANGUAGES_MAX
        ? localize("instance-setup.setup.languages_too_many", "A list of {count} names is too many. The languages are 1 to {max} well-formed BCP 47 language tags (en, es, zh-Hant). Nothing was changed.", { count: tags.length, max: GROUP_LANGUAGES_MAX })
        : localize("instance-setup.setup.languages_bad_tag", "'{tag}' is not a well-formed BCP 47 language tag (en, es, zh-Hant). The languages are 1 to {max} of them. Nothing was changed.", { tag: String(bad).slice(0, 40), max: GROUP_LANGUAGES_MAX }));
    const list = [...new Set(tags.map(canonicalTag))];
    const set = this.#record().setSetting(GROUP_LANGUAGES_SETTING, list, who);
    if (!set || set.ok !== true) return set;
    return { ...this.groupLanguages(), set_by: who,
             note: word("setup.note.civicsmith_words_shown") };
  }

  /** R85, R86, op=grouplanguages (public): `{ok: true, languages: [tags]}`, the list an administrator set, or, while none
   *  is set, the active profiles' languages in their order, each once (`[]` when no profile states one). Writes nothing;
   *  never throws. */
  groupLanguages() {
    try {
      const held = this.#record().getSetting(GROUP_LANGUAGES_SETTING);
      if (Array.isArray(held) && held.length && held.every((t) => typeof t === "string"))
        return { ok: true, languages: [...held] };
      const out = [];
      for (const { p } of this.#activeProfiles()) {
        const l = p && p.locale;
        const v = l && typeof l === "object" ? l.value : l;
        if (typeof v === "string" && isLocale(v.trim())) {
          const tag = canonicalTag(v.trim());
          if (!out.includes(tag)) out.push(tag);
        }
      }
      return { ok: true, languages: out };
    } catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("instance-setup.setup.the_languages_could_not_be", "the languages could not be read ({reason}).", { reason: String(String(e && e.message || e).slice(0, 160)) }) };
    }
  }

  /* =====================================================================
   * N10 — THE JURISDICTION PROFILES THIS COPY READS ITS LOCAL FACTS FROM (R12–R16). `build/layers.md`, "No
   * jurisdiction in the product", rule 2: an instance setting chosen at install. The list is record-core's setting
   * `jurisdiction_profiles` (its R26), which `extraction`, `monitoring`, `actions` and `standards` read; this module is
   * its one writer: at the first boot from the installer's binding (R13), and by an administrator's act (R14).
   * No profile is ever chosen for a group: an empty list is valid, and every consumer then answers undetermined.
   * ===================================================================== */

  /* The note R13 leaves when the installer's binding could not be recorded, so R12 can say why. */
  static PROFILES_BOOT_NOTE = "jurisdiction_profiles_boot";

  #checkProfileList(list) {
    const ids = list.map((v) => (typeof v === "string" ? v.trim() : v));
    const J = this.#juris();
    const unknown = ids.filter((id) => typeof id !== "string" || !id || !J.get(id));
    const tests = ids.filter((id) => typeof id === "string" && J.get(id) && J.get(id).test === true);
    return { ids, unknown, tests };
  }

  /* R13: at the first boot, the installer's comma-separated binding, recorded when every id is held and none is a
     test profile; otherwise nothing is recorded, and the note says why. */
  #recordProfilesAtFirstBoot() {
    const raw = this.#env.JURISDICTION_PROFILES;
    if (typeof raw !== "string" || !raw.trim()) return { recorded: false, bound: false };
    const { ids, unknown, tests } = this.#checkProfileList(raw.split(",").map((s) => s.trim()).filter(Boolean));
    const unique = [...new Set(ids)];
    let why = null;
    if (unknown.length) why = word("setup.why.installer_bound_group", { x: String(unknown.map((x) => JSON.stringify(x)).join(", ")) });
    else if (tests.length) why = word("setup.why.installer_bound_profile", { tests: String(tests.join(", ")) });
    const core = this.#record();
    if (why) {
      core.setSetting(InstanceSetup.PROFILES_BOOT_NOTE, { bound: raw, recorded: false, why, at: this.#iso() }, "bootstrap");
      return { recorded: false, bound: true, why };
    }
    const set = core.setSetting("jurisdiction_profiles", unique, "bootstrap");
    return set && set.ok ? { recorded: true, profiles: unique } : { recorded: false, bound: true, why: set && set.reason };
  }

  /** R12, R16: the active profiles, each with its name and what it covers, the conflicts `jurisdictions.combine`
   *  reports over them, the facts of their combined view `agent-worker` reads (`view`, N420), and the held profiles an
   *  administrator may choose among (R15), from the namespace addressed. */
  profiles() {
    const core = this.#record();
    const set = core.getSetting("jurisdiction_profiles");
    const ids = Array.isArray(set) ? set.filter((x) => typeof x === "string") : [];
    const J = this.#juris();
    const choices = J.list().filter((p) => p.test !== true).map((p) => ({ id: p.id, name: p.name, covers: p.covers }));
    const active = ids.map((id) => {
      const p = J.get(id);
      return p ? { id, name: p.name, covers: p.covers } : { id, name: null, covers: null, held: false };
    });
    const combined = ids.length ? J.combine(ids) : { ok: true, conflicts: [] };
    const out = { ok: true, profiles: active, conflicts: combined.ok ? combined.conflicts : [],
                  ...(combined.ok ? {} : { errors: combined.errors }), view: profileView(combined), choices,
                  ...this.#stageFindings(combined) };
    if (!ids.length) {
      out.detail = word("instance-setup.profiles.detail.none_active");
      const note = core.getSetting(InstanceSetup.PROFILES_BOOT_NOTE);
      if (note && note.recorded === false && typeof note.why === "string")
        out.boot = { recorded: false, why: note.why, bound: note.bound ?? null };
    }
    return out;
  }

  /* R76 (T45; N858; v0.2 §5, rule 11; grammar doubt 11): for each records law of the combined view that carries
     `stages` (jurisdictions R76), each finding action-grammar's `lawStagesFindings` answers, as `{law, check:
     "LAW_STAGE_UNKNOWN", stage}`; `[]` when every law's stages are known or none carries any. It reports and refuses
     nothing, writes nothing and never throws: a check that throws is `stage_findings: null` with why, never `[]`. */
  #stageFindings(combined) {
    const v = combined && combined.ok === true && combined.view && typeof combined.view === "object" ? combined.view : null;
    const laws = v && Array.isArray(v.records_laws) ? v.records_laws : [];
    const out = [];
    try {
      for (const law of laws) {
        if (!law || typeof law !== "object" || !Array.isArray(law.stages)) continue;
        /* Each stage is checked on its own, so each finding names the stage it is about. */
        for (const item of law.stages) {
          const findings = this.#lawStagesFindings([item]);
          if (!Array.isArray(findings)) throw new Error("the check answered no list");
          if (findings.some((f) => f && f.code === "LAW_STAGE_UNKNOWN"))
            out.push({ law: law.name ?? null, check: "LAW_STAGE_UNKNOWN",
                       stage: item && typeof item === "object" ? item.stage ?? null : item ?? null });
        }
      }
    } catch (e) {
      return { stage_findings: null, stage_findings_detail: word("instance-setup.profiles.detail.stages_unchecked", { why: String(e && e.message || e).slice(0, 160) }) };
    }
    return { stage_findings: out };
  }

  /** R14, op=profilesset: replaces the list. `by` is the control plane's stamp of an administrator's own session. */
  profilesSet({ profiles = undefined, by = null } = {}) {
    /* DEC-49 REGION is-profiles-admin */
    if (typeof by !== "string" || !by || !this.#membership().isAdministrator(by))
      return refusal("PROFILES_NOT_ADMIN",
        localize("instance-setup.setup.choosing_the_jurisdiction_profiles_is", "choosing the jurisdiction profiles is an administrator's act, and your team's Civicsmith stamps who is asking from the signed-in session. This caller is not one of the active administrators."), { by: by ?? null });
    /* END DEC-49 REGION is-profiles-admin */
    /* DEC-49 REGION is-profiles-list */
    if (!Array.isArray(profiles))
      return refusal("NOT_A_LIST", localize("instance-setup.setup.the_profiles_are_sent_as", "the profiles are sent as a list of profile ids, in the order they are read; an empty list chooses none. Nothing was changed."));
    const { ids, unknown, tests } = this.#checkProfileList(profiles);
    if (unknown.length)
      return refusal("UNKNOWN_PROFILE", localize("instance-setup.setup.your_teams_civicsmith_holds_no", "your team's Civicsmith holds no profile {map}. Nothing was changed.", { map: String(unknown.map((x) => JSON.stringify(x)).join(", ")) }), { profiles: unknown });
    if (tests.length)
      return refusal("PROFILE_IS_TEST", tests.length > 1
        ? localize("instance-setup.setup.profiles_made_up_for_testing", "{tests} are profiles made up for testing. Nothing was changed.", { tests: tests.join(", ") })
        : localize("instance-setup.setup.profile_made_up_for_testing", "{tests} is a profile made up for testing. Nothing was changed.", { tests: tests.join(", ") }), { profiles: tests });
    /* END DEC-49 REGION is-profiles-list */
    const unique = [...new Set(ids)];
    const set = this.#record().setSetting("jurisdiction_profiles", unique, by);
    if (!set || set.ok !== true) return set;
    /* R62: an arrival leaves when an administrator makes that profile active. */
    this.#leaveArrivals(word("setup.leave_arrivals.profile_made_active"), this.#iso(), unique);
    return { ...this.profiles(), set_by: by, ...(unique.length < ids.length ? { collapsed: true } : {}),
             note: unique.length
               ? word("setup.note.local_facts_read")
               : word("setup.note.profile_active_now") };
  }

  /* =====================================================================
   * THE BRIDGE AND THE SEATS (R50–R52; A ORG 1a and 1b; K1443, K1468, K1485; K1682's readings 1–4).
   *
   * What the active profiles name is seeded into the registry as identified entities and dated lines, by the machine
   * (DEC-52: `class:admin`) from a system rule, never from a name match (lines R4): the profile's offices and bodies
   * (R50), the Legistar bodies matched to them after normalisation (R51), and the Council's and committees' seats and
   * holders from Legistar's own records (R52). Every entity is found or seeded under a scheme identifier the profile
   * declares (`identifier_schemes`), so a repeat is answered `already` and nothing is seeded twice; nothing is deleted,
   * and an office a profile stops naming keeps its lines as they stand. What cannot be seeded is said, with why: an
   * entry with no identifier seeds nothing, and a `MemberType` the profile does not map records no holder.
   * ===================================================================== */

  #juris() { return this.#deps.jurisdictions ?? { list: heldProfiles, get: heldProfile, combine: combineProfiles }; }
  #entities() { return this.#deps.entities ?? entitiesOf(this.#ctx); }
  #lines() { return this.#deps.lines ?? linesOf(this.#ctx); }

  /* The active profiles, in order, each with its held definition (none for an id no longer held). */
  #activeProfiles() {
    const set = this.#record().getSetting("jurisdiction_profiles");
    const ids = Array.isArray(set) ? set.filter((x) => typeof x === "string" && x) : [];
    return ids.map((id) => ({ id, p: this.#juris().get(id) || null })).filter((x) => x.p);
  }

  /* A profile's scheme by name (jurisdictions R52), or null. */
  static #scheme(p, name) {
    return (Array.isArray(p.identifier_schemes) ? p.identifier_schemes : [])
      .find((x) => x && typeof x === "object" && x.scheme === name) || null;
  }
  /* `{scheme, id}` as a profile states it, or null when it is not one. */
  static #ident(x) {
    return x && typeof x === "object" && typeof x.scheme === "string" && x.scheme.trim()
      && (typeof x.id === "string" ? x.id.trim() : Number.isFinite(x.id))
      ? { scheme: x.scheme.trim(), id: String(x.id).trim() } : null;
  }

  /* Why an identifier cannot hold an entity of `kind` under profile `p`, or null when it can (checked before anything is
     created, so a refusal leaves no entity behind it): the scheme is declared, it identifies that kind, and it names the
     system a machine's identifier rests on (entities R43, K1443). */
  static #identWhy(p, ident, kind) {
    const sch = InstanceSetup.#scheme(p, ident.scheme);
    if (!sch) return word("setup.text.profile_declares_identifier", { scheme: String(ident.scheme) });
    if (!(Array.isArray(sch.entity_kinds) && sch.entity_kinds.includes(kind)))
      return word("setup.text.scheme_identifies", { scheme: String(ident.scheme), kind: String((sch.entity_kinds || []).join(", ") || "no kind"), kind3: String(kind) });
    if (!(Array.isArray(sch.systems) && sch.systems.length))
      return word("setup.text.scheme_names_system", { scheme: String(ident.scheme) });
    return null;
  }

  /* One entity found or seeded under one identifier: the entity already holding it (a member's, or this module's from
     an earlier run) is `already`; else it is created, machine-declared, and the identifier held on it with the
     system's row as its basis. Answers `{state: seeded | already | unseeded, entity_id?, why?}`. */
  #seedEntity({ p, ident, kind, label, note, row, source, sector, forumKind }) {
    const why = InstanceSetup.#identWhy(p, ident, kind);
    if (why) return { state: "unseeded", why };
    const E = this.#entities();
    const mine = this.#one(`SELECT entity_id FROM seed_entities WHERE scheme = ? AND id = ?`, ident.scheme, ident.id);
    let held = null;
    try { held = E.entityByIdentifier({ scheme: ident.scheme, id: ident.id }); } catch { held = null; }
    if (held && held.undetermined)
      return { state: "unseeded", why: word("setup.why.entity_holds_meant", { scheme: String(ident.scheme), id: String(ident.id) }),
               candidates: held.candidates ?? [] };
    if (held && typeof held.entity_id === "string") {
      if (!mine) this.#ledgerEntity(ident, held.entity_id, kind, label, source);
      return { state: "already", entity_id: held.entity_id };
    }
    let entityId = mine ? mine.entity_id : null;
    if (!entityId) {
      const made = E.createEntity({ kind, label, note, declaredBy: SEED_MACHINE, ...(sector ? { sector } : {}),
                                    ...(forumKind ? { forum_kind: forumKind } : {}) });
      if (!made || made.ok !== true) return { state: "unseeded", why: word("setup.why.registry_refused_entity", { made: String(made && (made.reason || made.detail)) }) };
      entityId = made.entity_id;
      this.#ledgerEntity(ident, entityId, kind, label, source);
    }
    const sch = InstanceSetup.#scheme(p, ident.scheme);
    const id = E.addIdentifier({ entityId, scheme: ident.scheme, id: ident.id, by: SEED_MACHINE,
                                 basis: { system: sch.systems[0], row } });
    if (!id || id.ok !== true)
      return { state: "unseeded", entity_id: entityId,
               why: word("setup.why.registry_refused_identifier", { scheme: String(ident.scheme), id: String(ident.id), id3: String(id && (id.reason || id.detail)) }) };
    return { state: id.already ? "already" : "seeded", entity_id: entityId };
  }
  #ledgerEntity(ident, entityId, kind, label, source) {
    this.#sql.exec(`INSERT INTO seed_entities (scheme, id, entity_id, kind, label, source, seeded_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(scheme, id) DO NOTHING`, ident.scheme, ident.id, entityId, kind, label, JSON.stringify(source), this.#iso());
  }

  /* One line recorded once, keyed by its kind, its ends and the source row it rests on (`lines.recordLine`, machine
     from a system rule whose two ends the identifiers name, lines R4). Answers like `#seedEntity`. */
  #seedLine({ key, kind, from, to, capacity, valid, basis }) {
    const held = this.#one(`SELECT line_id FROM seed_lines WHERE key = ?`, key);
    if (held) return { state: "already", line_id: held.line_id };
    const r = this.#lines().recordLine({ kind, from, to, ...(capacity ? { capacity } : {}), ...(valid ? { valid } : {}),
                                         basis, by: SEED_MACHINE });
    if (!r || r.ok !== true) return { state: "unseeded", why: word("setup.why.lines_refused", { r: String(r && (r.reason || r.detail)) }) };
    this.#sql.exec(`INSERT INTO seed_lines (key, kind, from_entity, to_entity, line_id, seeded_at) VALUES (?, ?, ?, ?, ?, ?)`,
                   key, kind, from, to, r.line_id, this.#iso());
    return { state: "seeded", line_id: r.line_id };
  }

  /** R50, op=officesseed: each office the active profiles name (jurisdictions R24) seeded as an `office`, its body as a
   *  `body`, each under the profile's identifier for it, with `post_in` from the office to its body and `part_of` from
   *  the body to the organisation the profile names it within. An administrator's act (`by`, the control plane's stamp);
   *  at setup the boot runs it once after R13 (`boot: true`). Answers what was seeded, already held, and could not be. */
  officesSeed({ by = null, boot = false } = {}) {
    if (!boot && (typeof by !== "string" || !by || !this.#membership().isAdministrator(by)))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_seeding_offices", "seeding the offices the jurisdiction profiles name"));
    const out = { ok: true, seeded: [], already: [], unseeded: [], by: boot ? SEED_MACHINE : by };
    const put = (r, item) => { out[r.state === "seeded" ? "seeded" : r.state === "already" ? "already" : "unseeded"].push(
      { ...item, ...(r.entity_id ? { entity_id: r.entity_id } : {}), ...(r.line_id ? { line_id: r.line_id } : {}),
        ...(r.why ? { why: r.why } : {}), ...(r.candidates ? { candidates: r.candidates } : {}) }); };
    const active = this.#activeProfiles();
    if (!active.length) out.detail = word("instance-setup.offices.detail.no_profile");
    for (const { id: profile, p } of active) {
      const cps = Array.isArray(p.counterparties) ? p.counterparties : [];
      cps.forEach((cp, i) => {
        const entry = `counterparties[${i}]`;
        const role = cp && typeof cp.role === "string" ? cp.role.trim() : "";
        const body = cp && typeof cp.body === "string" ? cp.body.trim() : "";
        const where = { profile, entry, role, body };
        const ids = cp && cp.ids && typeof cp.ids === "object" ? cp.ids : {};
        const officeId = InstanceSetup.#ident(ids.office), bodyId = InstanceSetup.#ident(ids.body);
        const source = { profile, entry };
        const cite = cp.basis
          ? localize("instance-setup.setup.cite_office_basis", "jurisdiction profile {profile}, {entry} (basis: {basis})", { profile, entry, basis: String(cp.basis) })
          : localize("instance-setup.setup.cite_office", "jurisdiction profile {profile}, {entry}", { profile, entry });
        /* Each entity is seeded when, and only when, the profile gives its own identifier for it: the body under
           `ids.body` whether or not the office has one, the office under `ids.office` (K1682's reading 1; N613). */
        const noIdent = (what, field) => ({ state: "unseeded", why: word("setup.why.profile_names_identifier", { what: String(what), field: String(field) }) });
        const b = bodyId ? this.#seedEntity({ p, ident: bodyId, kind: "body", label: body, sector: "government", source,
          row: `${profile}/${entry}/body`, note: word("setup.note.body_office_belongs", { role: String(role), cite: String(cite) }) })
          : noIdent("body", "ids.body");
        put(b, { what: "body", ...where, ...(bodyId ? { ident: bodyId } : {}) });
        const bodyHeld = !!b.entity_id && b.state !== "unseeded";
        if (bodyHeld)
          this.#sql.exec(`INSERT INTO seed_bodies (profile, role, body, entry, body_entity, seeded_at)
                          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(profile, role, body) DO NOTHING`,
                         profile, role, body, entry, b.entity_id, this.#iso());
        const o = officeId ? this.#seedEntity({ p, ident: officeId, kind: "office", label: `${role}, ${body}`, source,
          row: `${profile}/${entry}/office`, note: word("setup.note.office_action_addressed", { cite: String(cite) }) })
          : noIdent("office", "ids.office");
        put(o, { what: "office", ...where, ...(officeId ? { ident: officeId } : {}) });
        const officeHeld = !!o.entity_id && o.state !== "unseeded";
        /* K1683: the office's row names its body's entity, or '' when the body is not held under an identifier. */
        if (officeHeld)
          this.#sql.exec(`INSERT INTO seed_offices (profile, role, body, entry, office_entity, body_entity, seeded_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile, role, body) DO NOTHING`,
                         profile, role, body, entry, o.entity_id, bodyHeld ? b.entity_id : "", this.#iso());
        const zone = zoneOf(p) ? { zone: zoneOf(p) } : null;
        const rule = (ids2) => ({ rule: "a jurisdiction profile's office entry, seeded at setup", source, ids: ids2 });
        /* A line needs both its ends held under identifiers. Neither held: the two entities' answers say why, and no
           line is named; one held: the line is answered could-not-be-seeded, naming the end that is missing. */
        if (officeHeld && bodyHeld)
          put(this.#seedLine({ key: `post_in|${o.entity_id}|${b.entity_id}|${profile}`, kind: "post_in",
                               from: o.entity_id, to: b.entity_id, valid: zone, basis: rule({ from: officeId, to: bodyId }) }),
              { what: "post_in", ...where });
        else if (officeHeld || bodyHeld)
          put({ state: "unseeded", why: word("setup.why.held_under_identifier", { office: String(officeHeld ? "body" : "office") }) }, { what: "post_in", ...where });
        if (!bodyHeld) return;
        const within = cp.within && typeof cp.within === "object" ? cp.within : null;
        const withinId = within ? InstanceSetup.#ident(within.ids) : null;
        if (!within) {
          put({ state: "unseeded", why: word("setup.why.profile_names_organization") },
              { what: "part_of", ...where });
          return;
        }
        const wLabel = typeof within.label === "string" && within.label.trim() ? within.label.trim() : null;
        const wKind = ["institution", "body", "movement"].includes(within.kind) ? within.kind : "institution";
        if (!withinId || !wLabel) {
          put({ state: "unseeded", why: word("setup.why.profile_names_organization_body", { ids: !wLabel ? "label" : "identifier (within.ids)" }) }, { what: "part_of", ...where });
          return;
        }
        const w = this.#seedEntity({ p, ident: withinId, kind: wKind, label: wLabel, sector: "government", source,
          row: `${profile}/${entry}/within`, note: word("setup.note.organization_body_part", { body, cite }) });
        put(w, { what: "organisation", ...where, label: wLabel, ident: withinId });
        if (!w.entity_id || w.state === "unseeded") {
          put({ state: "unseeded", why: word("setup.why.organization_held_under") },
              { what: "part_of", ...where });
          return;
        }
        put(this.#seedLine({ key: `part_of|${b.entity_id}|${w.entity_id}|${profile}`, kind: "part_of",
                             from: b.entity_id, to: w.entity_id, valid: zone, basis: rule({ from: bodyId, to: withinId }) }),
            { what: "part_of", ...where });
      });
    }
    out.forums = this.#seedForums(active, put);
    out.counts = { seeded: out.seeded.length, already: out.already.length, unseeded: out.unseeded.length };
    return out;
  }

  /* R93 (T50; N1190; jurisdictions R94; entities R54): each forum the active profiles' combined view holds
     (`{label, forum_kind, ids?, basis}`) is seeded as a `body` entity carrying `forum_kind`, under its first identifier
     (a scheme of the profile that declares it, the profile entry as basis) with any further identifiers held on it,
     machine-attributed as R50's are. A forum already held under the identifier is `already` and writes nothing; one with
     no identifier, or that the registry refuses, is `unseeded` with why. Answers the forums as listed beside offices. */
  #seedForums(active, put) {
    const listed = [];
    if (!active.length) return listed;
    let combined = null;
    try { combined = this.#juris().combine(active.map((a) => a.id)); } catch { combined = null; }
    const forums = combined && combined.ok === true && combined.view && Array.isArray(combined.view.forums) ? combined.view.forums : [];
    for (const f of forums) {
      if (!f || typeof f.label !== "string" || !f.label.trim() || typeof f.forum_kind !== "string") continue;
      const label = f.label.trim();
      const where = { what: "forum", label, forum_kind: f.forum_kind };
      const idents = (Array.isArray(f.ids) ? f.ids : []).map((x) => InstanceSetup.#ident(x)).filter(Boolean);
      if (!idents.length) {
        const r = { state: "unseeded", why: word("setup.why.profile_names_identifier", { what: "forum", field: "ids" }) };
        put(r, where); listed.push({ ...where, state: r.state, why: r.why });
        continue;
      }
      const owner = (id) => active.find((a) => InstanceSetup.#scheme(a.p, id.scheme)) ?? active[0];
      const first = owner(idents[0]);
      const source = { profile: first.id, forum: label };
      const row = `${first.id}/forums/${f.forum_kind}/${label}`;
      const cite = f.basis
        ? localize("instance-setup.setup.cite_forum_basis", "jurisdiction profile {id}, forum {label} (basis: {basis})", { id: first.id, label, basis: String(f.basis) })
        : localize("instance-setup.setup.cite_forum", "jurisdiction profile {id}, forum {label}", { id: first.id, label });
      let r = this.#seedEntity({ p: first.p, ident: idents[0], kind: "body", label, sector: "government", source, row, forumKind: f.forum_kind,
        note: localize("instance-setup.setup.the_forum_kind_label_a", "The {forum_kind} {label}, a forum as the active {cite} names it; seeded at setup.", { forum_kind: String(f.forum_kind), label: String(label), cite: String(cite) }) });
      for (const more of idents.slice(1)) {
        if (!r.entity_id || r.state === "unseeded") break;
        const o = owner(more);
        const why = InstanceSetup.#identWhy(o.p, more, "body");
        if (why) { r = { state: "unseeded", entity_id: r.entity_id, why }; break; }
        const sch = InstanceSetup.#scheme(o.p, more.scheme);
        const got = this.#entities().addIdentifier({ entityId: r.entity_id, scheme: more.scheme, id: more.id, by: SEED_MACHINE,
                                                     basis: { system: sch.systems[0], row } });
        if (!got || got.ok !== true) r = { state: "unseeded", entity_id: r.entity_id, why: word("setup.why.registry_refused_identifier", { scheme: more.scheme, id: more.id, id3: String(got && (got.reason || got.detail)) }) };
        else if (!got.already && r.state === "already") r = { state: "seeded", entity_id: r.entity_id };
      }
      put(r, { ...where, ident: idents[0] });
      listed.push({ ...where, state: r.state, ...(r.entity_id ? { entity_id: r.entity_id } : {}), ...(r.why ? { why: r.why } : {}) });
    }
    return listed;
  }

  /** K1683: the office a seeded office entity is, as `{role, body}` (with its profile), or null for an entity this
   *  module did not seed from a profile office (`profile` given: from that profile only). Writes nothing; never throws. */
  officeOf(entityId, profile = null) {
    try {
      if (typeof entityId !== "string" || !entityId) return null;
      const rows = this.#rows(`SELECT profile, role, body FROM seed_offices WHERE office_entity = ? ORDER BY profile, role, body`, entityId)
        .filter((r) => profile == null || r.profile === profile);
      return rows.length ? { role: rows[0].role, body: rows[0].body, profile: rows[0].profile } : null;
    } catch { return null; }
  }

  /** K1683: the office entity seeded for a profile office `{role, body}`, or null: none seeded, or more than one
   *  entity seeded under that role and body (two profiles naming it with different identifiers), which is not
   *  settled here. Writes nothing; never throws. */
  officeEntityOf({ role = null, body = null } = {}) {
    try {
      const r = typeof role === "string" ? role.trim() : "", b = typeof body === "string" ? body.trim() : "";
      if (!r || !b) return null;
      const ids = [...new Set(this.#rows(`SELECT office_entity FROM seed_offices WHERE role = ? AND body = ?`, r, b).map((x) => x.office_entity))];
      return ids.length === 1 ? ids[0] : null;
    } catch { return null; }
  }

  /* A held capture's text, locator and instant (`deps.readCapture`, else the record's evidence store and the receipt
     provenance holds for it), or null. */
  async #readCapture(sha) {
    if (typeof this.#deps.readCapture === "function") return this.#deps.readCapture(sha);
    const store = this.#record().evidenceStore ? this.#record().evidenceStore() : null;
    const obj = store ? await store.get(sha) : null;
    if (!obj) return null;
    const text = new TextDecoder().decode(new Uint8Array(await obj.arrayBuffer()));
    /* N756 (K2101): the one capture's receipts (provenance R60), never every receipt. */
    const got = (this.#deps.provenance ?? provenanceOf(this.#ctx)).receiptsOfCapture({ captureSha: sha });
    const first = (got && Array.isArray(got.rows) ? got.rows : []).filter((r) => r && r.capture_sha === sha)
      .sort((a, b) => Date.parse(a.first_retrieved) - Date.parse(b.first_retrieved))[0];
    return first ? { text, locator: first.address, at: first.first_retrieved } : null;
  }

  /* R51: the profile bodies (the active profiles' counterparty bodies) matched to the Legistar bodies of one parsed
     `bodies` capture, by exact equality of normalised forms: a Legistar body's form is the organisation the
     body-variant map names for it, else its marker-stripped base name folded; a profile body's forms are its own name
     folded and, where its entry names one, its `organisation` key. One form's several `BodyId`s are one match. */
  #matchBodies(parsed, active) {
    const groups = new Map();
    for (const r of parsed.rows) {
      const f = r.facts || {};
      const form = typeof f.organisation === "string" && f.organisation ? `organisation:${f.organisation}`
        : `name:${termFold(f.base ?? f.name ?? "")}`;
      if (form === "name:") continue;
      if (!groups.has(form)) groups.set(form, []);
      groups.get(form).push({ BodyId: f.BodyId, name: f.name, source: r.source });
    }
    const out = [];
    for (const { id: profile, p } of active) {
      const view = { vocabulary: p.vocabulary || {} };
      (Array.isArray(p.counterparties) ? p.counterparties : []).forEach((cp, i) => {
        const body = cp && typeof cp.body === "string" ? cp.body.trim() : "";
        if (!body) return;
        const read = legistarBodyName(body, { view });
        const forms = new Set([`name:${termFold(read.base)}`, `name:${termFold(body)}`]);
        for (const o of [cp.organisation, read.organisation]) if (typeof o === "string" && o) forms.add(`organisation:${o}`);
        const hits = [...forms].filter((f) => groups.has(f));
        const entry = `counterparties[${i}]`;
        const role = typeof cp.role === "string" ? cp.role.trim() : "";
        /* R52: the body's organisation, for the MemberType map: the counterparty's own key, else the one its name reads as. */
        const organisation = [cp.organisation, read.organisation, hits.length === 1 && hits[0].startsWith("organisation:")
          ? hits[0].slice("organisation:".length) : null].find((o) => typeof o === "string" && o) ?? null;
        if (hits.length === 1) { out.push({ profile, entry, role, body, matched: true, form: hits[0], organisation, bodies: groups.get(hits[0]) }); return; }
        const terms = termFold(body).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
        const near = hits.length > 1 ? hits.flatMap((h) => groups.get(h))
          : [...groups.values()].flat().filter((g) => terms.length && terms.every((t) => termFold(g.name).includes(t)));
        out.push({ profile, entry, role, body, matched: false, candidates: near.slice(0, 20).map((g) => ({ BodyId: g.BodyId, name: g.name })),
          why: hits.length > 1 ? word("setup.why.normalized_forms_equal") : word("setup.why.legistar_body_normalized") });
      });
    }
    return out;
  }

  /** R51, R52, op=seatsseed: from held captures of the client's `bodies`, `persons` and `officerecords` (each a sha, the
   *  office records one or more pages), the profile bodies matched to Legistar bodies (R51), each match's `BodyId`s held
   *  on the body entity, and each seat on a matched body seeded with its holder (R52). An administrator's act. */
  async seatsSeed({ bodies = null, persons = null, officerecords = null, by = null } = {}) {
    if (typeof by !== "string" || !by || !this.#membership().isAdministrator(by))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_seeding_seats", "seeding the seats Legistar records"));
    const active = this.#activeProfiles();
    const want = { bodies: [bodies], persons: [persons], officerecords: Array.isArray(officerecords) ? officerecords : [officerecords] };
    const parsed = {};
    for (const [endpoint, shas] of Object.entries(want)) {
      const list = shas.filter((x) => x !== null && x !== undefined);
      /* DEC-49 REGION is-seed-capture */
      if (!list.length || list.some((x) => typeof x !== "string" || !x.trim()))
        return refusal("SEED_CAPTURE_UNREADABLE", localize("instance-setup.setup.the_request_names_no_capture", "the request names no capture of Legistar's {endpoint}. Nothing was seeded.", { endpoint: String(endpoint) }), { endpoint });
      const pages = [];
      for (const sha of list) {
        let cap = null;
        try { cap = await this.#readCapture(sha.trim().toLowerCase()); } catch { cap = null; }
        if (!cap || typeof cap.text !== "string")
          return refusal("SEED_CAPTURE_UNREADABLE", localize("instance-setup.setup.the_record_holds_no_readable", "the record holds no readable capture {sha}. Nothing was seeded.", { sha: String(sha.slice(0, 64)) }),
                         { endpoint, capture: sha });
        let one = null;
        try {
          one = legistarParse({ locator: cap.locator, text: cap.text, at: cap.at ?? null,
                                view: { vocabulary: Object.assign({}, ...active.map(({ p }) => p.vocabulary || {})) } });
        } catch (e) { one = { why: String(e && e.message || e) }; }
        if (!one || one.why || one.endpoint !== endpoint)
          return refusal("SEED_CAPTURE_NOT_LEGISTAR", one && one.why
            ? localize("instance-setup.setup.capture_not_legistar_why", "capture {sha} is not a Legistar {endpoint} list ({why}). Nothing was seeded.", { sha: sha.slice(0, 64), endpoint, why: one.why.slice(0, 200) })
            : one && one.endpoint
            ? localize("instance-setup.setup.capture_not_legistar_other", "capture {sha} is not a Legistar {endpoint} list (it is {found}). Nothing was seeded.", { sha: sha.slice(0, 64), endpoint, found: one.endpoint })
            : localize("instance-setup.setup.capture_not_legistar", "capture {sha} is not a Legistar {endpoint} list. Nothing was seeded.", { sha: sha.slice(0, 64), endpoint }),
            { endpoint, capture: sha });
        /* END DEC-49 REGION is-seed-capture */
        pages.push({ ...one, sha: sha.trim().toLowerCase(), at: cap.at ?? null });
      }
      parsed[endpoint] = pages;
    }
    const out = { ok: true, matches: [], unmatched: [], seeded: [], already: [], unseeded: [], holders_undetermined: [],
                  bodies_without_records: [], same_names: [], by };
    const put = (r, item) => { out[r.state === "seeded" ? "seeded" : r.state === "already" ? "already" : "unseeded"].push(
      { ...item, ...(r.entity_id ? { entity_id: r.entity_id } : {}), ...(r.line_id ? { line_id: r.line_id } : {}),
        ...(r.why ? { why: r.why } : {}) }); };
    if (!active.length) { out.detail = word("instance-setup.bodies.detail.no_profile"); return out; }
    const bodiesCap = parsed.bodies[0];
    const instant = (at) => (typeof at === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(at) ? `${at.slice(0, 19)}Z` : null);
    /* R51: the matches, each BodyId held on the profile's seeded body entity. */
    const seatBodies = new Map();   // BodyId → {entity, p, profile, label, ident}
    for (const m of this.#matchBodies(bodiesCap, active)) {
      if (!m.matched) { out.unmatched.push(m); continue; }
      const { p } = active.find((a) => a.id === m.profile);
      const sch = InstanceSetup.#scheme(p, LEGISTAR_SCHEMES.body);
      const office = this.#one(`SELECT body_entity FROM seed_bodies WHERE profile = ? AND role = ? AND body = ?`, m.profile, m.role, m.body);
      const match = { profile: m.profile, entry: m.entry, role: m.role, body: m.body, form: m.form,
                      bodies: m.bodies.map((b) => ({ BodyId: b.BodyId, name: b.name })) };
      out.matches.push(match);
      if (!office) { match.why = word("setup.why.profile_names_identifier", { what: "body", field: "ids.body" }); continue; }
      if (!sch) { match.why = word("setup.why.profile_declares_identifier", { body: String(LEGISTAR_SCHEMES.body) }); continue; }
      for (const b of m.bodies) {
        const ident = { scheme: LEGISTAR_SCHEMES.body, id: String(b.BodyId) };
        const why = InstanceSetup.#identWhy(p, ident, "body");
        let r;
        if (why) r = { state: "unseeded", why };
        else {
          const got = this.#entities().addIdentifier({ entityId: office.body_entity, scheme: ident.scheme, id: ident.id, by: SEED_MACHINE,
                                                       basis: { system: sch.systems[0], row: `legistar:body:${b.BodyId}` } });
          r = got && got.ok === true ? { state: got.already ? "already" : "seeded", entity_id: office.body_entity }
            : { state: "unseeded", why: word("setup.why.registry_refused_identifier_2", { got: String(got && (got.reason || got.detail)) }) };
          if (r.state !== "unseeded") {
            this.#ledgerEntity(ident, office.body_entity, "body", m.body, { capture: bodiesCap.sha, row: b.source });
            seatBodies.set(b.BodyId, { entity: office.body_entity, p, profile: m.profile, label: m.body, ident,
                                       organisation: m.organisation });
          }
        }
        put(r, { what: "body_identifier", profile: m.profile, body: m.body, ident });
      }
    }
    /* R52: the seats of the matched bodies, and their holders. */
    const people = new Map();
    for (const r of parsed.persons[0].rows) people.set(r.facts.PersonId, r);
    const records = legistarPages(parsed.officerecords);
    const recRows = Array.isArray(records.rows) ? records.rows : [];
    out.records = { pages: records.pages, complete: records.complete, conflicts: records.conflicts, refused: records.refused,
                    ...(records.why ? { why: records.why } : {}) };
    const pageOf = (row) => parsed.officerecords.find((pg) => pg.rows.includes(row)) || parsed.officerecords[0];
    const seen = new Set();
    for (const row of recRows) {
      const f = row.facts || {};
      const sb = seatBodies.get(f.BodyId);
      if (!sb) continue;
      seen.add(f.BodyId);
      const page = pageOf(row) || parsed.officerecords[0];
      const recordedAt = instant(page.at);
      const seatIdent = { scheme: LEGISTAR_SCHEMES.seat, id: String(f.OfficeRecordId) };
      const memberType = typeof f.role === "string" ? f.role.trim() : "";
      const seat = this.#seedEntity({ p: sb.p, ident: seatIdent, kind: "office", label: `${memberType || "Seat"}, ${sb.label}`,
        source: { capture: page.sha, row: row.source }, row: row.key,
        note: word("setup.note.seat_legistar_office", { label: String(sb.label), office_record_id: String(f.OfficeRecordId), legistar_basis: String(LEGISTAR_BASIS), given: String(memberType || "not given") }) });
      const where = { OfficeRecordId: f.OfficeRecordId, BodyId: f.BodyId, PersonId: f.PersonId ?? null };
      put(seat, { what: "seat", ...where });
      if (!seat.entity_id || seat.state === "unseeded") continue;
      const basis = (ids) => ({ rule: "a Legistar office record", source: page.sha, system: LEGISTAR_KEY, recorded_at: recordedAt,
                                row: row.source, ids });
      put(this.#seedLine({ key: `seat_on|${seat.entity_id}|${sb.entity}|${row.key}`, kind: "seat_on", from: seat.entity_id,
                           to: sb.entity, basis: basis({ from: seatIdent, to: sb.ident }) }), { what: "seat_on", ...where });
      const pr = people.get(f.PersonId);
      if (!Number.isInteger(f.PersonId) || !pr) {
        out.holders_undetermined.push({ ...where, why: Number.isInteger(f.PersonId)
          ? word("setup.why.persons_capture_holds", { person_id: String(f.PersonId) }) : word("setup.why.office_record_names") });
        continue;
      }
      const name = pr.facts.name_normal || pr.facts.name || word("setup.text.legistar_person", { person_id: f.PersonId });
      const others = Array.isArray(pr.same_name_as) ? pr.same_name_as : [];
      const personIdent = { scheme: LEGISTAR_SCHEMES.person, id: String(f.PersonId) };
      const person = this.#seedEntity({ p: sb.p, ident: personIdent, kind: "person", label: name,
        source: { capture: parsed.persons[0].sha, row: pr.source }, row: pr.key,
        note: others.length
          ? `${word("setup.note.legistar_person", { person_id: f.PersonId, basis: LEGISTAR_BASIS })} ${word("setup.note.legistar_lists_under", { x: others.map((x) => `PersonId ${x}`).join(", ") })}`
          : word("setup.note.legistar_person", { person_id: f.PersonId, basis: LEGISTAR_BASIS }) });
      if (others.length && !out.same_names.some((s2) => s2.PersonId === f.PersonId))
        out.same_names.push({ PersonId: f.PersonId, name, same_name_as: others });
      put(person, { what: "person", ...where });
      if (!person.entity_id || person.state === "unseeded") continue;
      /* jurisdictions R60 (K1729): an entry for the seat's body's organisation is read before one for all bodies. */
      const types = (sb.p.vocabulary && Array.isArray(sb.p.vocabulary.member_types) ? sb.p.vocabulary.member_types : [])
        .filter((x) => x && x.member_type === memberType);
      const map = (sb.organisation ? types.find((x) => x.organisation === sb.organisation) : null)
        ?? types.find((x) => x.organisation === undefined || x.organisation === null);
      const capacity = map && LINE_CAPACITIES.includes(map.capacity) ? map.capacity : null;
      if (!capacity) {
        out.holders_undetermined.push({ ...where, person: person.entity_id, seat: seat.entity_id,
          why: word("setup.why.profile_maps_capacity", { member_type: String(JSON.stringify(memberType)), body: sb.organisation ? ` on ${sb.organisation}` : ` ${word("setup.why.body")}` }) });
        continue;
      }
      const zone = zoneOf(sb.p) ?? undefined;
      put(this.#seedLine({ key: `holds|${person.entity_id}|${seat.entity_id}|${row.key}`, kind: "holds", from: person.entity_id,
                           to: seat.entity_id, capacity,
                           valid: { from: f.start ?? null, to: f.end ?? null, precision: "day", ...(zone ? { zone } : {}) },
                           basis: basis({ from: personIdent, to: seatIdent }) }),
          { what: "holds", ...where, capacity, start: f.start ?? null, end: f.end ?? null, dated: `${LEGISTAR_BASIS} on ${recordedAt}` });
    }
    for (const [bodyId, sb] of seatBodies)
      if (!seen.has(bodyId)) out.bodies_without_records.push({ BodyId: bodyId, body: sb.label,
        why: word("setup.why.legistar_holds_office") });
    out.counts = { matched: out.matches.length, unmatched: out.unmatched.length, seeded: out.seeded.length,
                   already: out.already.length, unseeded: out.unseeded.length, holders_undetermined: out.holders_undetermined.length };
    return out;
  }

  /* =====================================================================
   * THE ASSISTANT, AND EACH MEMBER'S DISCLOSURE (R53–R55; DEC-172, K1957, K2093; D311).
   *
   * Since T36 the assistant has no switch of its own (DEC-172): it is off exactly while the group keeps its material away
   * from every assistant, `credentials`' setting (its R51, R52), and a keep-away that cannot be read is read as kept
   * away (K2093). Your group's Civicsmith holds no Claude credential: each member who wants the assistant connects their
   * own account (credentials R22), and whether an account then serves an act is `credentials` R35's. While it is off,
   * every ask and every run is refused by name through `assistantGate`, which answers credentials' `AI_KEPT_AWAY`
   * (ai-accounts R7, the one site; T37, N765, K231; moved there in T48, N996) as given, carrying the administrator's reason; it ends nothing recorded.
   * ===================================================================== */

  /** R53: `{ok, on, set_by, set_at, reason}` from `ai-accounts.aiKeepAwayState()` (its R21; T48, N996): `on: false` exactly while
   *  the group keeps its material away from AI, with that setting's who, when and reason; a keep-away `on` other than
   *  `false` (not read, K2093) is `on: false` with the three null; otherwise `on: true` and the three null. Writes
   *  nothing and never throws. */
  assistantState() {
    let k = null;
    try { k = this.#aiAccounts().aiKeepAwayState(); } catch { k = null; }
    if (k && k.on === false) return { ok: true, on: true, set_by: null, set_at: null, reason: null };
    if (k && k.on === true)
      return { ok: true, on: false, set_by: k.set_by ?? null, set_at: k.set_at ?? null, reason: k.reason ?? null };
    return { ok: true, on: false, set_by: null, set_at: null, reason: null, read: false,
             detail: word("instance-setup.assistant.detail.keep_away_unread") };
  }

  /** R55 (T37; N765, K231, K2201; T48, N996): `ai-accounts.aiKeptAway()` (its R7) as given: null while the group does not keep its
   *  material away, otherwise that service's one `AI_KEPT_AWAY` refusal with its row and `keep_away: {reason, set_by,
   *  set_at}` (null, and said so, when the setting could not be read). This module holds no copy of the condition and
   *  no row of its own for it. A provider that throws, which credentials R35 says it never does, is the store's
   *  silence (R43), never an open gate. Writes nothing. */
  assistantGate() {
    try { return this.#aiAccounts().aiKeptAway(); }
    catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("instance-setup.setup.whether_your_team_keeps_its", "whether your team keeps its material away from every assistant did not answer ({reason}), so no ask is put to an assistant and no run starts.", { reason: String(String(e && e.message || e)
                 .slice(0, 160)) }) };
    }
  }

  /** R54, op=disclosureshown: the disclosure was shown to `member` before they connected their own account (a reference
   *  set, or her own Claude subscription signed in: T46, N897 (3)). `by` is
   *  the control plane's stamp and must be that member's own session: no one records it on another's behalf. */
  disclosureShown({ member = null, version = null, by = null } = {}) {
    const m = typeof member === "string" ? member.trim() : "";
    const v = typeof version === "string" ? version.trim() : "";
    /* DEC-49 REGION is-disclosure-shown */
    if (!m || !v)
      return refusal("DISCLOSURE_MALFORMED", !m
        ? localize("instance-setup.setup.disclosure_no_member", "The request names no member. Nothing was recorded.")
        : localize("instance-setup.setup.disclosure_no_version", "The request names no version of the disclosure's words. Nothing was recorded."));
    if (typeof by !== "string" || by !== m || /^class:/.test(by))
      return refusal("DISCLOSURE_NOT_THE_MEMBERS", localize("instance-setup.setup.the_disclosure_is_recorded_by", "the disclosure is recorded by the member it was shown to, from their own signed-in session. Nothing was recorded."), { member: m, by: by ?? null });
    /* END DEC-49 REGION is-disclosure-shown */
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO assistant_disclosures (member, version, shown_by, shown_at) VALUES (?, ?, ?, ?)`,
                   m, v.slice(0, 80), by, at);
    return { ok: true, member: m, version: v.slice(0, 80), shown_at: at, shown: v.slice(0, 80) === ASSISTANT_DISCLOSURE.version };
  }

  /** R54: whether the disclosure at the current version (or `version`) was recorded as shown to `member`. A member with
   *  none recorded is `shown: false`, never assumed. (T46; N897 (3)) It answers alike before a reference is set and
   *  before a sign-in to her own Claude subscription starts (credentials R43): it reads only what `disclosureShown`
   *  recorded, never whether an account is connected. (T47; N981; K3030; T48, N996) The disclosure-first order is held by
   *  `ai-accounts` (its R23), which asks this read through the registration the composition root makes
   *  (`disclosureReadOf`), so its R1 and `control-plane` R65 refuse `DISCLOSURE_DUE` while it answers `shown: false`.
   *  Writes nothing and never throws. */
  disclosureOf({ member = null, version = ASSISTANT_DISCLOSURE.version } = {}) {
    const m = typeof member === "string" ? member.trim() : "";
    const v = typeof version === "string" && version.trim() ? version.trim() : ASSISTANT_DISCLOSURE.version;
    let r = null;
    try {
      r = m ? this.#one(`SELECT version, shown_at FROM assistant_disclosures WHERE member = ? AND version = ?
                         ORDER BY seq DESC LIMIT 1`, m, v) : null;
    } catch { r = null; }
    return r ? { ok: true, member: m, version: v, shown: true, shown_at: r.shown_at }
             : { ok: true, member: m || null, version: v, shown: false, shown_at: null,
                 detail: m ? word("instance-setup.disclosure.detail.not_shown") : word("instance-setup.disclosure.detail.no_member") };
  }

  /* =====================================================================
   * A PLACE NOT YET HELD (R60, R62; DEC-150). An administrator may name the place the group works in when no held
   * profile covers it. The name is held only here: no public read, notice, submission, edition, export or request to
   * another host carries it, and it is never a profile, a jurisdiction or a local fact. At each start, a held profile
   * that matches it and was not held before is recorded once as an arrival, which `queue-producers` (its R38) raises to
   * the administrators as one Status item through the read this module registers; it leaves when that profile is made
   * active (R14) or the name is cleared or changed.
   * ===================================================================== */

  #placeCurrent() {
    return this.#one(`SELECT seq, name, set_by, set_at FROM place_wanted ORDER BY seq DESC LIMIT 1`) || null;
  }
  /* The held profiles a place can arrive as: every held profile that is not a test profile, by id. */
  #heldPlaceIds() {
    return this.#juris().list().filter((p) => p && p.test !== true && typeof p.id === "string").map((p) => p.id);
  }
  #seePlaces(at) {
    this.#sql.exec(`INSERT INTO place_seen (id, profiles, seen_at) VALUES (1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET profiles = excluded.profiles, seen_at = excluded.seen_at`,
                   JSON.stringify(this.#heldPlaceIds()), at);
  }
  #leaveArrivals(why, at, profiles = null) {
    for (const r of this.#rows(`SELECT seq, profile FROM place_arrivals WHERE left_at IS NULL`))
      if (!profiles || profiles.includes(r.profile))
        this.#sql.exec(`UPDATE place_arrivals SET left_at = ?, left_why = ? WHERE seq = ?`, at, why, r.seq);
  }
  /* R62: a profile matches the named place when its name or one of its covers, folded as extraction's term fold, is
     exactly the name folded the same way. */
  static #placeMatches(p, name) {
    const want = termFold(name);
    return !!want && [p && p.name, ...(p && Array.isArray(p.covers) ? p.covers : [])]
      .some((x) => typeof x === "string" && termFold(x) === want);
  }

  /** R60, op=placewanted: an administrator names the place the group works in that no held profile covers, or clears
   *  it with `name: null`. `by` is the control plane's stamp (R29). Each set or clear is appended with who and when. */
  placeWantedSet({ name = undefined, by = null } = {}) {
    if (typeof by !== "string" || !by || !this.#membership().isAdministrator(by))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_naming_place", "naming the place your team works in"));
    let value = null;
    if (name !== null) {
      const s = typeof name === "string" ? name.trim() : "";
      const chars = [...s].length;
      /* DEC-49 REGION is-place-name */
      if (!s || chars > PLACE_NAME_MAX || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s))
        return refusal("PLACE_NAME_MALFORMED", s
          ? localize("instance-setup.setup.place_not_one_line", "A name of {chars} characters is not one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { chars, max: PLACE_NAME_MAX })
          : localize("instance-setup.setup.place_none_given", "The request names no place. A place is named in one line of 1 to {max} characters with no control characters; null clears it. Nothing was changed.", { max: PLACE_NAME_MAX }));
      /* END DEC-49 REGION is-place-name */
      value = s;
    }
    const at = this.#iso();
    const before = this.#placeCurrent();
    this.#sql.exec(`INSERT INTO place_wanted (name, set_by, set_at) VALUES (?, ?, ?)`, value, by, at);
    /* R62: the open arrivals leave when the name is cleared or changed; the profiles held now are what a later start
       compares against, so a profile already held when the name is set is not an arrival. */
    if (before && before.name !== null && before.name !== value)
      this.#leaveArrivals(value === null ? word("setup.leave_arrivals.name_cleared") : word("setup.leave_arrivals.name_changed"), at);
    this.#seePlaces(at);
    return { ok: true, name: value, set_by: by, set_at: at,
             history: this.#rows(`SELECT name, set_by, set_at FROM place_wanted ORDER BY seq`).map((r) => ({ ...r })),
             note: value === null
               ? word("setup.note.place_named_ever")
               : word("setup.note.name_kept_group") };
  }

  /** R60, op=placewantedstate: the named place, to an administrator only, with R62's open arrivals as `matches`. */
  placeWanted({ viewer = null } = {}) {
    if (typeof viewer !== "string" || !viewer || !this.#membership().isAdministrator(viewer))
      return notAnAdmin(viewer ?? null, localize("instance-setup.setup.what_reading_place", "reading the place your team named"));
    const cur = this.#placeCurrent();
    return { ok: true, name: cur ? cur.name : null, set_by: cur ? cur.set_by : null, set_at: cur ? cur.set_at : null,
             matches: this.placeArrivals({ viewer }).arrivals };
  }

  /** R62: `{ok, arrivals}`, the open arrivals (those that have not left), each with the profile's name and covers: to
   *  an administrator, and to the plane's own in-process read (`viewer: null`, as `queue-producers` R38 reads it, which
   *  addresses its item to the administrators); `arrivals: []` to anyone else. Writes nothing; never throws. */
  placeArrivals({ viewer = null } = {}) {
    try {
      if (viewer !== null && viewer !== undefined
          && (typeof viewer !== "string" || !viewer || !this.#membership().isAdministrator(viewer))) return { ok: true, arrivals: [] };
      return { ok: true, arrivals: this.#rows(`SELECT name, profile, found_at FROM place_arrivals WHERE left_at IS NULL ORDER BY seq`).map((r) => {
        const p = this.#juris().get(r.profile);
        return { name: r.name, profile: r.profile, profile_name: p ? p.name ?? null : null,
                 covers: p && Array.isArray(p.covers) ? [...p.covers] : [], found_at: r.found_at };
      }) };
    } catch { return { ok: true, arrivals: [] }; }
  }

  /* R62, at each start with a place named: every held non-test profile matching the name, not held at the last compare
     (or at the set), and not active, is recorded once as an arrival; then the profiles held now are what the next start
     compares against. */
  #comparePlaces() {
    const cur = this.#placeCurrent();
    if (!cur || cur.name === null) return { compared: false };
    const at = this.#iso();
    const seenRow = this.#one(`SELECT profiles FROM place_seen WHERE id = 1`);
    let seen = null;
    try { seen = seenRow ? JSON.parse(seenRow.profiles) : null; } catch { seen = null; }
    const active = new Set(this.#activeIds());
    let found = 0;
    if (Array.isArray(seen))
      for (const id of this.#heldPlaceIds()) {
        if (seen.includes(id) || active.has(id) || !InstanceSetup.#placeMatches(this.#juris().get(id), cur.name)) continue;
        const r = this.#rows(`INSERT INTO place_arrivals (place_seq, name, profile, found_at) VALUES (?, ?, ?, ?)
                              ON CONFLICT(place_seq, profile) DO NOTHING RETURNING seq`, cur.seq, cur.name, id, at);
        found += r.length;
      }
    this.#seePlaces(at);
    return { compared: true, arrived: found };
  }
  #activeIds() {
    const set = this.#record().getSetting("jurisdiction_profiles");
    return Array.isArray(set) ? set.filter((x) => typeof x === "string") : [];
  }

  /* =====================================================================
   * A MEMBER'S LANGUAGE (R64; DEC-127 (1)). The language a member chooses for the screens, by their own act; the screens
   * show each word in it where a translation is held and in English where none is. `null` clears the choice.
   * ===================================================================== */

  /** R64, op=memberlanguageset: `by` (the control plane's stamp) is the member, and nobody sets it for another. */
  memberLanguageSet({ language = undefined, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    /* DEC-49 REGION is-member-language */
    if (!who || /^class:/.test(who))
      return refusal("MACHINE_CANNOT_SET_LANGUAGE", localize("instance-setup.setup.the_language_of_the_screens", "the language of the screens is set by the member, from their own signed-in session. Nothing was changed."), { by: by ?? null });
    let tag = null;
    if (language !== null) {
      tag = typeof language === "string" ? language.trim() : "";
      if (!isLocale(tag))
        return languageMalformed(tag
          ? localize("instance-setup.setup.language_not_a_tag", "'{tag}' is not a well-formed BCP 47 language tag (en, es, zh-Hant); null clears the choice. Nothing was changed.", { tag: tag.slice(0, 40) })
          : localize("instance-setup.setup.language_none_given", "The request names no language. A language is chosen as one well-formed BCP 47 language tag (en, es, zh-Hant); null clears the choice. Nothing was changed.", {}));
    }
    /* END DEC-49 REGION is-member-language */
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO member_languages (member, language, set_at) VALUES (?, ?, ?)`, who, tag, at);
    return { ok: true, member: who, language: tag, set_at: at,
             note: tag === null
               ? word("setup.note.language_chosen_screens")
               : word("setup.note.screens_show_word") };
  }

  /** R64, op=memberlanguage: the viewer's own choice, `{language, set_at}`, and nobody else's. Writes nothing. */
  memberLanguage({ viewer = null } = {}) {
    const who = typeof viewer === "string" ? viewer.trim() : "";
    let r = null;
    try {
      r = who && !/^class:/.test(who)
        ? this.#one(`SELECT language, set_at FROM member_languages WHERE member = ? ORDER BY seq DESC LIMIT 1`, who) : null;
    } catch { r = null; }
    return { ok: true, language: r ? r.language ?? null : null, set_at: r ? r.set_at : null };
  }

  /* =====================================================================
   * A MEMBER'S EXPLANATION LEVEL (R79; T46; DEC-162, DEC-175). How quickly explanations open for a member: `prompt`
   * ("Explain promptly", where every member starts) or `pause` (guidance on a longer pause, so less opens while she
   * moves; nothing is ever hidden). The member's own act, beside her language (R64). `asked: true` records, in the same
   * act, that the set answers the one question the interface asks after her first month (DEC-162 (2)); its instant is
   * kept from then on, whatever later sets say.
   * ===================================================================== */

  /** R79, op=infolevelset: `by` (the control plane's stamp, R29) is the member, and nobody sets it for another. Refusals,
   *  each writing nothing: a missing or machine `by` `MACHINE_CANNOT_SET_INFO_LEVEL`; a `level` other than `prompt` or
   *  `pause`, or an `asked` other than absent, `true` or `false`, `INFO_LEVEL_UNKNOWN` (K2996). Each set is appended with
   *  when. */
  infoLevelSet({ level = undefined, asked = undefined, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    /* DEC-49 REGION is-info-level */
    if (!who || isMachineIdentity(who))
      return refusal("MACHINE_CANNOT_SET_INFO_LEVEL", localize("instance-setup.setup.how_quickly_explanations_open_is", "how quickly explanations open is set by the member, from their own signed-in session. Nothing was changed."), { by: by ?? null });
    if (!INFO_LEVELS.includes(level))
      return refusal("INFO_LEVEL_UNKNOWN", typeof level === "string" && level
        ? localize("instance-setup.setup.level_not_one_of", "'{level}' is not one of {levels}. Nothing was changed.", { level: level.slice(0, 40), levels: INFO_LEVELS.join(" or ") })
        : localize("instance-setup.setup.level_none_given", "The request names no level. A level is chosen as one of {levels}. Nothing was changed.", { levels: INFO_LEVELS.join(" or ") }));
    /* K2996: `asked` is absent, `true` or `false`; anything else is no answer to the first-month question. */
    if (asked !== undefined && asked !== null && asked !== true && asked !== false)
      return refusal("INFO_LEVEL_UNKNOWN", localize("instance-setup.setup.whether_this_set_answers_the", "whether this set answers the first-month question is said as true or false, or not at all. Nothing was changed."));
    /* END DEC-49 REGION is-info-level */
    const before = this.#infoLevelRow(who);
    const at = this.#iso();
    const askedAt = before && before.asked_at ? before.asked_at : asked === true ? at : null;
    this.#sql.exec(`INSERT INTO member_info_levels (member, level, asked_at, set_at) VALUES (?, ?, ?, ?)`, who, level, askedAt, at);
    return { ok: true, member: who, level, set_at: at, asked_at: askedAt,
             note: level === "prompt" ? word("setup.note.explanations_open_promptly")
               : word("setup.note.explanations_open_longer") };
  }

  #infoLevelRow(who) {
    return this.#one(`SELECT level, asked_at, set_at FROM member_info_levels WHERE member = ? ORDER BY seq DESC LIMIT 1`, who);
  }

  /** R79, op=infolevel: the viewer's own `{level, set_at, asked_at}`, and nobody else's: `prompt` with `set_at` null
   *  when none is set, `asked_at` null until the first-month question is answered. Writes nothing; never throws. */
  infoLevel({ viewer = null } = {}) {
    const who = typeof viewer === "string" ? viewer.trim() : "";
    let r = null;
    try { r = who && !isMachineIdentity(who) ? this.#infoLevelRow(who) : null; } catch { r = null; }
    return { ok: true, level: r ? r.level : INFO_LEVEL_DEFAULT, set_at: r ? r.set_at : null, asked_at: r ? r.asked_at ?? null : null };
  }

  /* =====================================================================
   * TWO ADMINISTRATORS, EACH HOLDING RECOVERY CODES (R66; K1888, DEC-134 (2), (6)). The one-time recommendation of a
   * second administrator is a step of setting up the group, answered to each administrator: how many administrators the
   * group has (`membership.activeAdmins`, its R86) and whether the viewer's own role holds unspent recovery codes
   * (`credentials.recoveryCodesState`, its R46). It gates nothing: a group may run with one administrator.
   * ===================================================================== */

  /** R66, op=adminrecoverystep: `{ok: true, administrators, codes_held, remaining, met}` to an administrator (`viewer`,
   *  the control plane's stamp, R29), `NOT_AN_ADMIN` to anyone else, a machine credential included. A provider that does
   *  not answer is the store's silence (R43), never `met: false`. Writes nothing and never throws. */
  adminRecoveryStep({ viewer = null } = {}) {
    const silent = (what, e) => ({ ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
      detail: localize("instance-setup.setup.what_did_not_answer_string", "{what} did not answer ({reason}), so whether the step is met is not known", { what: String(what), reason: String(String(e && e.message || e).slice(0, 160)) }) });
    const who = typeof viewer === "string" ? viewer.trim() : "";
    let admin;
    try { admin = !!who && !/^class:/.test(who) && this.#membership().isAdministrator(who) === true; }
    catch (e) { return silent("the membership read of who is an administrator", e); }
    if (!admin) return notAnAdmin(viewer ?? null, localize("instance-setup.setup.what_reading_recovery_step", "reading the step of two administrators holding recovery codes"));
    let admins, codes;
    try { admins = this.#membership().activeAdmins(); }
    catch (e) { return silent("the membership read of the administrators", e); }
    try { codes = this.#credentials().recoveryCodesState({ by: who }); }
    catch (e) { return silent("the read of your recovery codes", e); }
    if (!Array.isArray(admins)) return silent("the membership read of the administrators", "no list");
    if (!codes || codes.ok !== true || typeof codes.held !== "boolean") return silent("the read of your recovery codes", "no answer");
    const administrators = admins.length;
    const remaining = Number.isInteger(codes.remaining) && codes.remaining > 0 ? codes.remaining : 0;
    const codes_held = codes.held === true && remaining > 0;
    return { ok: true, administrators, codes_held, remaining, met: administrators >= 2 && codes_held };
  }

  /* =====================================================================
   * THE ASSISTANT DRAFTS THE GROUP'S DESCRIPTION (R65; DEC-152, K1818, K1837, K1841 (2)). On "Who your group is", an
   * administrator answers a few questions and asks for a labeled draft of the group's focus and purpose
   * (`membership` R109). It writes nothing: the words become the group's only when the administrator keeps them through
   * `op=groupdescriptionset`. The draft is built from the answers and, while the suggestions switch of the account that
   * serves the administrator is on, what the group holds, and it passes `wizard-scripts`' no-added-fact check. In T35
   * (N686, K1974) the door routes the draft past every refusal to `agent-worker`'s `POST /draft` (its R59; `control-plane`
   * R57): it may hand that call in as `turn`, and a draft it cannot serve (no turn, no answer, or one over the limits)
   * answers `ASSISTANT_DRAFT_UNAVAILABLE`, so the page's fields are unchanged.
   * ===================================================================== */

  /** R65, op=groupdescriptiondraft, which the door routes itself and calls here in-process (control-plane R57): `by` and
   *  `viewer` are its stamps (R29) and `assistant` is `{on, account}` as it resolved them (never the key); `answers` is
   *  the request's. The refusals, in order: NOT_AN_ADMIN, AI_KEPT_AWAY (R55's gate), the door's NO_ACCOUNT
   *  (credentials', relayed as given, K2577), AI_USE_SWITCHED_OFF and AI_LIMIT_REACHED (T40: answered there, never minted here), GROUP_DRAFT_ANSWERS_MALFORMED or
   *  GROUP_DRAFT_NO_ANSWERS; then the draft, or, when the draft cannot be served, ASSISTANT_DRAFT_UNAVAILABLE. A draft
   *  carries no project (T40): a project's account handed in serves none. `turn` is the door's call to agent-worker's
   *  `/draft` (`{answers, account, holdings}` → `{focus, purpose, readLog}`), else the one this module was built with. */
  async groupDescriptionDraft({ answers = undefined, assistant = null, viewer = null, by = null, turn = null } = {}) {
    if (typeof by !== "string" || !by || !this.#membership().isAdministrator(by))
      return notAnAdmin(by ?? null, localize("instance-setup.setup.what_asking_draft", "asking the assistant to draft your team's description"));
    const off = this.assistantGate();
    if (off) return off;
    /* The door resolved no assistant for this request (store-door R10's `{on}`), though the gate now answers open: the
       keep-away changed between the two reads, so no draft is asked for and nothing is minted here (K231). */
    if (assistant && typeof assistant === "object" && assistant.on === false)
      return draftUnavailable(localize("instance-setup.setup.the_assistant_was_not_on", "the assistant was not on when this request was resolved, so nothing was drafted and the fields are as they were."));
    const served = draftAccount(assistant);
    if (served.project) return projectAccount(localize("instance-setup.setup.fields_as_they_were", "the fields are as they were"));
    /* DEC-49 REGION is-group-draft-answers */
    const given = Array.isArray(answers) && answers.length <= GROUP_DRAFT_ANSWERS_MAX ? answers : null;
    if (!given || given.some((a) => !a || typeof a !== "object" || typeof a.question !== "string"
                                    || typeof a.text !== "string" || [...a.text].length > GROUP_DRAFT_ANSWER_MAX))
      return refusal("GROUP_DRAFT_ANSWERS_MALFORMED", localize("instance-setup.setup.draft_answers_malformed", "The answers are a list of at most {max_answers} {question, text}, each text at most {max_text} characters. Nothing was saved.", { max_answers: GROUP_DRAFT_ANSWERS_MAX, max_text: GROUP_DRAFT_ANSWER_MAX }));
    if (given.every((a) => !a.text.trim()))
      return refusal("GROUP_DRAFT_NO_ANSWERS", localize("instance-setup.setup.every_answer_is_empty_so", "every answer is empty, so there is nothing to draft from. Nothing was saved."));
    /* END DEC-49 REGION is-group-draft-answers */
    const unavailable = () => draftUnavailable(localize("instance-setup.setup.the_assistant_could_not_serve", "the assistant could not serve a draft of the team's description, so nothing was drafted and the fields are as they were."));
    const draftTurn = typeof turn === "function" ? turn : this.#deps.groupDraftTurn;
    if (typeof draftTurn !== "function") return unavailable();
    const account = served.account;
    const suggestions = !!(account && account.suggestions === true);
    let got = null;
    try { got = await draftTurn({ answers: given.map((a) => ({ question: a.question, text: a.text })), account, holdings: suggestions }); }
    catch { got = null; }
    if (!got || typeof got !== "object") return unavailable();
    const told = given.map((a) => a.text);
    /* R65: the label names who asked by their handle, as R67's readings do (the id itself for the founder). */
    const askedBy = this.#nameOf(by);
    const readLog = Array.isArray(got.readLog) ? got.readLog : [];
    const out = { ok: true, withheld: [] };
    for (const [field, max] of [["focus", GROUP_FOCUS_MAX], ["purpose", GROUP_PURPOSE_MAX]]) {
      const text = typeof got[field] === "string" ? got[field] : "";
      const checked = checkDraft(text, { told, readLog, firsthand: false, suggestions, askedBy: by });
      if (!checked || checked.ok !== true) return draftRefused(checked);
      if ([...checked.text].length > max) return unavailable();
      out[field] = { text: checked.text, label: { kind: "machine", asked_by: askedBy } };
      out.withheld.push(...(checked.withheld || []).map((w) => ({ field, ...w })));
    }
    out.note = word("setup.note.draft_saved_until");
    return out;
  }

  /* Who someone is, by value, beside their id (R75): their handle, or the id itself for the founder. */
  #nameOf(id) {
    try { const f = this.#membership().memberFacts?.(id); if (f && typeof f.handle === "string" && f.handle) return f.handle; }
    catch { /* the id stands */ }
    return id;
  }
  #isAdmin(id) {
    try { return typeof id === "string" && !!id && this.#membership().isAdministrator(id) === true; } catch { return false; }
  }


  /* =====================================================================
   * THE TRANSLATION WORKSPACE IS `translations`' (R94; T50; N1084; K3696; R99). No delegate remains: the routes and the
   * plane's reading of a member's language are `translations`' own.
   * ===================================================================== */

  /* R94, R64: `memberLanguage` registered once with `translations` (its R11), at start, so the translations read the member's
     own language through it; a second registration is only `PROVIDER_DECLARED`, harmless. Answered in the start's report. */
  #translationsSvc() {
    const me = this;
    /* `aiAccounts` is a getter: `translations` asks for it only when a draft reaches the keep-away gate. */
    return this.#deps.translations ?? translationsOf(this.#ctx, { record: this.#record(), membership: this.#membership(),
      get aiAccounts() { return me.#aiAccounts(); }, jurisdictions: this.#deps.jurisdictions, now: this.#deps.now });
  }
  #registerLanguage() {
    if (this.#languageRegistered) return this.#languageRegistered;
    try {
      const t = this.#translationsSvc();
      this.#languageRegistered = t.registerMemberLanguageRead(({ viewer = null } = {}) => this.memberLanguage({ viewer }));
    } catch (e) { return { ok: false, detail: String(e && e.message || e).slice(0, 200) }; }
    return this.#languageRegistered;
  }

  /* =====================================================================
   * UPDATES OF THE GROUP'S CIVICSMITH (R88–R91; T48; N1047; K3158, Bob's; DEC-226; K3189; `build/plan/draft-updates.md`).
   * Once a day, at a minute fixed once for the group from a random value it keeps, the group's Civicsmith asks for the
   * release notice at the one fixed public address, a plain GET that sends nothing about the group (R88). It stores a
   * notice only when `signatures` verifies it against the release keys, in its own namespace, as newer than the running
   * release (a downgrade and a replay are refused). Administrators read the notice (R89) and choose (R90): update,
   * not now, or skip with a reason. Nothing here installs anything and this module holds no credential that could
   * deploy code: the installer installs, with Cloudflare's consent (R91). Every table is append-only.
   * ===================================================================== */

  /* The version this isolate runs: R17's `VERSION`, `0.0.0` when unset. */
  #runningVersion() { return String(this.#env.VERSION || "0.0.0"); }

  /* R88: the group's minute of the day (UTC, 0 to 1439), drawn once at random and kept; never computed from the slug or
     anything sent. Uniform: a draw past the last whole multiple of 1440 is drawn again. */
  #checkMinute() {
    const held = this.#one(`SELECT minute FROM update_check_slot WHERE id = 1`);
    if (held) return held.minute;
    let minute = null;
    if (typeof this.#deps.drawMinute === "function") {
      const d = Number(this.#deps.drawMinute());
      minute = Number.isInteger(d) && d >= 0 && d < 1440 ? d : null;
    }
    const buf = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / 1440) * 1440;
    while (minute === null) { crypto.getRandomValues(buf); if (buf[0] < limit) minute = buf[0] % 1440; }
    this.#sql.exec(`INSERT INTO update_check_slot (id, minute, drawn_at) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING`,
                   minute, this.#iso());
    return this.#one(`SELECT minute FROM update_check_slot WHERE id = 1`).minute;
  }

  /** R88, the scheduler consumer's `due` and `wake`: the instant of the group's next daily check, the first of its
   *  minute of the day after the latest check (after the draw, before any check). Never null. */
  updateCheckWake() {
    const minute = this.#checkMinute();
    const last = this.#one(`SELECT at FROM update_checks ORDER BY seq DESC LIMIT 1`);
    const drawn = this.#one(`SELECT drawn_at FROM update_check_slot WHERE id = 1`);
    const from = Date.parse(last ? last.at : drawn.drawn_at);
    let t = Math.floor(from / UPDATE_CHECK_EVERY_MS) * UPDATE_CHECK_EVERY_MS + minute * 60_000;
    if (t <= from) t += UPDATE_CHECK_EVERY_MS;
    return t;
  }

  /** R88, R92 (T50; N1113), the consumer's `tick`: one check at the alarm's `now` (milliseconds), answered under the
   *  consumer's key. A failed or tampered fetch stores no notice and raises no item; the next day's run tries again. */
  async updateCheckTick(now) { return { updatecheck: await this.#runUpdateCheck(now) }; }

  /* R92: the check's recorded instant is the alarm's `now` when one is handed in, else a read of the clock. */
  async #runUpdateCheck(now) {
    const at = Number.isFinite(now) ? new Date(now).toISOString() : this.#iso();
    let got;
    try { got = await this.#askNotice(); }
    catch (e) { got = { outcome: "unreachable", detail: localize("instance-setup.setup.check_did_not_complete", "The check did not complete ({why}).", { why: String(e && e.message || e).slice(0, 160) }) }; }
    this.#sql.exec(`INSERT INTO update_checks (at, outcome, version, detail) VALUES (?, ?, ?, ?)`,
                   at, got.outcome, got.version ?? null, got.detail ? String(got.detail).slice(0, 300) : null);
    return { at, outcome: got.outcome, ...(got.version ? { version: got.version } : {}), ...(got.detail ? { detail: got.detail } : {}) };
  }

  /* R88: ask for the notice and judge it: `{outcome, version?, detail?}`. The request is a GET of the fixed address with
     an `accept` and a fixed `user-agent` and nothing else, no redirect followed, at most 64 KiB read; the notice is
     stored only when `signatures.verifyReleaseNotice` says `ok` (R48) and it is newer than any notice already held. */
  async #askNotice() {
    const running = this.#runningVersion();
    const host = new URL(RELEASE_NOTICE_ADDRESS).host;
    let g;
    try { g = this.#governor().governorAdmit({ host }); }
    catch (e) { g = { admitted: false, reason: localize("instance-setup.setup.the_governor_did_not_answer_2", "the governor did not answer ({reason})", { reason: String(String(e && e.message || e).slice(0, 120)) }) }; }
    if (!g || !g.admitted)
      return { outcome: "unreachable", detail: word("instance-setup.updates.detail.held", { host, reason: String(g && g.reason) }) };
    if (g.wait_ms) await this.#sleep(g.wait_ms);
    let res = null;
    try {
      res = await this.#fetch(RELEASE_NOTICE_ADDRESS, { method: "GET", redirect: "manual",
        headers: { accept: "application/json", "user-agent": UPDATE_CHECK_USER_AGENT } });
    } catch { res = null; }
    if (!res) return { outcome: "unreachable", detail: word("instance-setup.updates.detail.not_fetched") };
    const status = res.status;
    try { this.#governor().governorReport({ host, status }); } catch { /* an unrecorded outcome is not a verdict */ }
    if (!(status >= 200 && status < 300))
      return { outcome: "unreachable", detail: status >= 300 && status < 400
        ? word("instance-setup.updates.detail.redirected", { status }) : word("instance-setup.updates.detail.answered", { status }) };
    const read = await boundedBytes(res, RELEASE_NOTICE_MAX_BYTES);
    if (read.over) return { outcome: "MALFORMED", detail: word("instance-setup.updates.detail.too_big", { bytes: RELEASE_NOTICE_MAX_BYTES }) };
    let f = null;
    try { f = JSON.parse(new TextDecoder().decode(read.bytes)); } catch { f = null; }
    if (!f || typeof f !== "object" || Array.isArray(f)) return { outcome: "MALFORMED", detail: word("instance-setup.updates.detail.not_object") };
    if (typeof f.sig !== "string" || !f.sig) return { outcome: "MALFORMED", detail: word("instance-setup.updates.detail.no_signature") };
    const v = await verifyReleaseNotice({ version: f.version, date: f.date, manifest: f.manifest, security: f.security, notes: f.notes },
                                        f.sig, running, this.#deps.releaseKeys ?? RELEASE_KEYS);
    if (!v.ok) {
      /* the release the feed names is the one running: nothing newer, which is the steady state; an older one is a replay */
      if (v.reason === "NOT_NEWER" && v.version === v.running)
        return { outcome: "none", version: v.version, detail: word("instance-setup.updates.detail.up_to_date") };
      return { outcome: String(v.reason), ...(typeof v.version === "string" ? { version: v.version } : {}),
               detail: v.reason === "MALFORMED" ? word("instance-setup.updates.detail.malformed", { field: String(v.field ?? "notice").slice(0, 40) })
                 : v.reason === "NOT_NEWER" ? word("instance-setup.updates.detail.older_than_running", { running: String(v.running) }) : String(v.detail ?? v.reason).slice(0, 160) };
    }
    const n = v.notice;
    const held = this.#noticeRows()[0] ?? null;
    if (held) {
      const c = cmpVersion(n.version, held.version);
      if (c === 0) return { outcome: "none", version: n.version, detail: word("instance-setup.updates.detail.already_held") };
      if (c < 0) return { outcome: "NOT_NEWER", version: n.version, detail: word("instance-setup.updates.detail.older_than_held", { held: String(held.version) }) };
    }
    this.#sql.exec(`INSERT INTO release_notices (version, date, manifest, security, notes, sig, found_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                   n.version, n.date, n.manifest, n.security ? 1 : 0, JSON.stringify(n.notes), f.sig, this.#iso());
    return { outcome: "found", version: n.version };
  }

  /* R88: at each start, when the version running differs from the last recorded, the release now running is recorded
     with the instant it was first seen. */
  #recordRunning() {
    const version = this.#runningVersion();
    const last = this.#one(`SELECT version FROM running_releases ORDER BY seq DESC LIMIT 1`);
    if (last && last.version === version) return { recorded: false, version };
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO running_releases (version, first_seen_at) VALUES (?, ?)`, version, at);
    return { recorded: true, version, first_seen_at: at };
  }

  /* The notices held, newest release first. */
  #noticeRows() {
    return this.#rows(`SELECT seq, version, date, manifest, security, notes, found_at FROM release_notices ORDER BY seq`)
      .sort((a, b) => cmpVersion(b.version, a.version) || b.seq - a.seq);
  }
  #noticeOut(r) {
    return { version: r.version, date: r.date, security: r.security === 1, notes: JSON.parse(r.notes), signed: true, found_at: r.found_at };
  }
  /* A release's decisions, oldest first. */
  #decisionsOf(version) {
    return this.#rows(`SELECT version, kind, by_member, by_name, at, until_at, reason FROM update_decisions WHERE version = ? ORDER BY seq`, version)
      .map((d) => ({ version: d.version, kind: d.kind, by: d.by_member, by_name: d.by_name ?? d.by_member, at: d.at,
                     until: d.until_at ?? null, reason: d.reason ?? null }));
  }
  /* The newest release held, when it is newer than the running one and not skipped: the one ready to install (R89). A
     skip is final; a release an administrator has chosen to start stays ready until it is the one running. */
  #readyNotice() {
    const newest = this.#noticeRows()[0] ?? null;
    if (!newest || cmpVersion(newest.version, this.#runningVersion()) <= 0) return null;
    return this.#decisionsOf(newest.version).some((d) => d.kind === "skip") ? null : newest;
  }
  /* R89: the ready release as both reads answer it: the notice, and `decision`, the latest decision on it or null. */
  #readyOut(row) {
    const ds = this.#decisionsOf(row.version);
    return { ...this.#noticeOut(row), decision: ds.length ? ds[ds.length - 1] : null };
  }
  /* R89: the version running, when it was first seen, and the administrator whose `updatestart` chose it. */
  #runningOut() {
    const version = this.#runningVersion();
    const seen = this.#one(`SELECT first_seen_at FROM running_releases WHERE version = ? ORDER BY seq DESC LIMIT 1`, version);
    const by = this.#one(`SELECT by_member, by_name FROM update_decisions WHERE version = ? AND kind = 'start' ORDER BY seq DESC LIMIT 1`, version);
    return { version, installed_at: seen ? seen.first_seen_at : null, allowed_by: by ? by.by_name ?? by.by_member : null };
  }
  /* R106: the release the copy was set up with, the oldest `running_releases` records (R88's first sighting), or null. */
  #setupOut() {
    const first = this.#one(`SELECT version, first_seen_at FROM running_releases ORDER BY seq ASC LIMIT 1`);
    return first ? { version: first.version, installed_at: first.first_seen_at } : null;
  }
  /** R95 (T51; N1239; K3777): what this copy already holds, as the seven flat scalars `op=bootstrap` states to a
   *  credentialed caller (the door's to ask, `bootstrapReport`). The team's name as its members read it (R10); the instant
   *  the running release was first seen (R88); the newest activity of any session held (`credentials` R65); and the
   *  copy's own projects, documents, published case editions and active members, each taken whole, never through a
   *  viewer's sight. A fact that cannot be read now is `null`, never omitted and never `0`; no value names a member,
   *  handle or role, and none is nested. Writes nothing; never throws. */
  /** R105 (fix round 10, K5170; extraction R110): each migration's counts, read only, as extraction states them. The Worker's
   *  `selftest` asks this through the store's route, for an administrator; the store is the only place extraction is held. */
  selftestMigrations() { return extractionOf(this.#ctx).migrationCounts(); }

  bootstrapFacts({ facts = true, viewer = null, parts = false } = {}) {
    const read = (f) => { try { return f(); } catch { return null; } };
    const text = (f) => { const v = read(f); return typeof v === "string" && v ? v : null; };
    const count = (f) => { const n = read(f); return Number.isInteger(n) && n >= 0 ? n : null; };
    /* R103: a signed-in viewer's own screen language (R64) and the stamp of the team's adoptions (`translations` R20), in the
       same answer so `bootstrap` makes one hop for both; a stamp that cannot be read is `null`, never guessed. */
    const viewerOut = viewer ? { language: text(() => this.memberLanguage({ viewer }).language),
                                 words_version: text(() => this.#translationsSvc().wordsVersion()) } : {};
    /* R104 (G118b): the fleet's parts the object keeps, in the same visit, only when asked; the default answer is unchanged. */
    const keptOut = parts ? { kept_parts: this.keptFleetParts() } : {};
    if (!facts) return { ...viewerOut, ...keptOut };
    return {
      ...viewerOut,
      ...keptOut,
      team_name: text(() => this.groupIdentityPublic().display_name),
      installed_at: text(() => this.#runningOut().installed_at),
      last_used_at: text(() => this.#credentials().lastActivity()),
      count_projects: count(() => this.#countProjects()),
      count_documents: count(() => (this.#deps.provenance ?? provenanceOf(this.#ctx)).counts(null).register),
      count_published: count(() => { const l = this.#publicRead().publishedList(); return Array.isArray(l && l.cases) ? l.cases.length : null; }),
      count_members: count(() => { const l = this.#membership().memberList({ administer: false });
        return Array.isArray(l && l.members) ? l.members.filter((x) => x && x.status === "active").length : null; }),
    };
  }
  /** R104 (fix round 9, G118b; K4853): the fleet's parts, kept for every isolate. The isolate that asked the fleet tells the object
   *  (`keepFleetParts`), by the three flat keys; the object keeps them with its own time, in memory (a restart loses them, and the
   *  next call asks the fleet once). `keptFleetParts` answers them with their age by the object's clock, or `null` when none is
   *  kept or they are past `PARTS_KEPT_MS`. Neither writes the record, throws, or answers any key but the three and the age. */
  keptFleetParts() {
    const k = this.#fleetKept;
    if (!k) return null;
    const age = this.#now() - k.at;
    return age >= 0 && age < PARTS_KEPT_MS ? { ...k.parts, age_ms: age } : null;
  }
  keepFleetParts(parts) {
    const flat = flatParts(parts);
    if (!flat) return { ok: false, reason: "PARTS_NOT_KEPT" };
    this.#fleetKept = { at: this.#now(), parts: flat };
    return { ok: true };
  }
  /* R95: every project the record holds, paged whole through record-core's `listByType`. */
  #countProjects() {
    const record = this.#record();
    let n = 0, after = "";
    for (;;) {
      const page = record.listByType({ type: "project", after, limit: 200 });
      if (!page || !Array.isArray(page.ids)) return null;
      n += page.ids.length;
      if (!page.ids.length || !page.cursor) return n;
      after = page.cursor;
    }
  }

  #updateSilence(what, e) {
    return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
             detail: localize("instance-setup.setup.what_could_not_be_read", "{what} could not be read ({reason}), so it is not known.", { what: String(what), reason: String(String(e && e.message || e).slice(0, 160)) }) };
  }

  /** R89, op=updatenotice: to an administrator only (`NOT_AN_ADMIN`, a machine included), what Settings › Updates draws:
   *  `running`, `last_check`, `ready` (with `decision`, the latest on it, or null), `earlier` (newest first, at most 50),
   *  `holder` (who holds the hosting account, as `membership.hostingAccess` records it) and `viewer_holds`. A store that
   *  does not answer is the store's silence (R43). Writes nothing; never throws. */
  updateNotice({ viewer = null } = {}) {
    const who = typeof viewer === "string" ? viewer.trim() : "";
    if (!who || isMachineIdentity(who) || !this.#isAdmin(who))
      return notAnAdmin(viewer ?? null, localize("instance-setup.setup.what_reading_updates", "reading the updates of your team's Civicsmith"));
    try {
      const running = this.#runningOut();
      const last = this.#one(`SELECT at, outcome FROM update_checks ORDER BY seq DESC LIMIT 1`);
      const readyRow = this.#readyNotice();
      const ready = readyRow ? this.#readyOut(readyRow) : null;
      const newest = this.#noticeRows();
      const rest = newest.filter((r) => !readyRow || r.version !== readyRow.version);
      const earlier = rest.slice(0, UPDATE_EARLIER_MAX).map((r) => {
        const ds = this.#decisionsOf(r.version);
        const base = { version: r.version, date: r.date, security: r.security === 1 };
        const skip = ds.find((d) => d.kind === "skip");
        if (skip) return { ...base, skipped_at: skip.at, skipped_by: skip.by_name, reason: skip.reason };
        if (cmpVersion(r.version, running.version) <= 0) {
          const seen = this.#one(`SELECT first_seen_at FROM running_releases WHERE version = ? ORDER BY seq DESC LIMIT 1`, r.version);
          const start = [...ds].reverse().find((d) => d.kind === "start");
          return { ...base, installed_at: seen ? seen.first_seen_at : null, allowed_by: start ? start.by_name : null };
        }
        return { ...base, replaced_by: newest[0].version };
      });
      let holder = null, viewerHolds = null;
      try {
        const h = this.#membership().hostingAccess({ limit: 1 });
        if (h && h.ok === true) {
          holder = h.recorded && h.current ? { holders: h.current.holders, note: h.current.note ?? null,
                                               recorded_by: h.current.recorded_by, at: h.current.at } : null;
          viewerHolds = holder ? this.#namesMember(holder.holders, who) : false;
        }
      } catch { holder = null; viewerHolds = null; }
      return { ok: true, running, setup: this.#setupOut(), last_check: last ? { at: last.at, outcome: last.outcome } : null, ready, earlier,
               earlier_limit: UPDATE_EARLIER_MAX, earlier_truncated: rest.length > UPDATE_EARLIER_MAX, holder, viewer_holds: viewerHolds };
    } catch (e) { return this.#updateSilence(localize("instance-setup.setup.what_the_updates", "the updates of your team's Civicsmith"), e); }
  }

  /* R89: whether the text a group recorded as who holds the hosting account names `id`, by the member's id or handle as a
     whole word (the record is free text, so this is the one exact reading it allows). */
  #namesMember(text, id) {
    const words = new Set(String(text ?? "").toLowerCase().split(/[^\p{L}\p{N}_:.-]+/u).filter(Boolean));
    return [id, this.#nameOf(id)].some((x) => typeof x === "string" && x && words.has(x.toLowerCase()));
  }

  /** R89, in-process, for `machinery-producers` R12 through the plane's composition: `{ok, running, ready, decisions}`
   *  for the newest release ready to install, naming no viewer: `ready` as `updateNotice` answers it (with `decision`),
   *  `decisions` every decision on it oldest first, each `{version, kind, by, by_name, at, until, reason}` (`ready: null`
   *  and `decisions: []` when none). A store
   *  that does not answer is the store's silence (R43). Writes nothing; never throws. */
  updateNoticeState() {
    try {
      const readyRow = this.#readyNotice();
      return { ok: true, running: this.#runningOut(), ready: readyRow ? this.#readyOut(readyRow) : null,
               decisions: readyRow ? this.#decisionsOf(readyRow.version) : [] };
    } catch (e) { return this.#updateSilence(localize("instance-setup.setup.what_the_updates", "the updates of your team's Civicsmith"), e); }
  }

  /* R90: an update act is an administrator's (`by` the control plane's stamp, R29): `{who}`, or `NOT_AN_ADMIN` first, a
     machine included. */
  #updateActor(by, what) {
    const who = typeof by === "string" ? by.trim() : "";
    if (!who || isMachineIdentity(who) || !this.#isAdmin(who)) return { refused: notAnAdmin(by ?? null, what) };
    return { who };
  }
  /* R90: the release an act names must be the one ready to install (R89), else `UPDATE_NOT_READY`. */
  #updateReady(version) {
    const v = typeof version === "string" ? version.trim() : "";
    const ready = this.#readyNotice();
    /* DEC-49 REGION is-update-ready */
    if (!ready || !v || ready.version !== v)
      return { refused: refusal("UPDATE_NOT_READY", !ready
          ? localize("instance-setup.setup.update_none_ready", "No release is ready to install. Nothing was recorded.")
          : v ? localize("instance-setup.setup.update_not_the_ready_one", "'{version}' is not the release ready to install, which is {ready}. Nothing was recorded.", { version: v.slice(0, 40), ready: ready.version })
          : localize("instance-setup.setup.update_no_version", "The request names no version, and a release is decided by its version. The release ready to install is {ready}. Nothing was recorded.", { ready: ready.version }),
        { version: v || null }) };
    /* END DEC-49 REGION is-update-ready */
    return { ready };
  }
  #decide(version, kind, who, { until = null, reason = null } = {}) {
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO update_decisions (version, kind, by_member, by_name, at, until_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                   version, kind, who, this.#nameOf(who), at, until, reason);
    return at;
  }

  /** R90, op=updatestart: an administrator chooses to update to the release ready, and gets the installer's update page
   *  set to that release and no other. Nothing is installed by this act, which carries no credential, slug or member. */
  updateStart({ version = null, by = null } = {}) {
    const a = this.#updateActor(by, localize("instance-setup.setup.what_choosing_update", "choosing to update your team's Civicsmith"));
    if (a.refused) return a.refused;
    const r = this.#updateReady(version);
    if (r.refused) return r.refused;
    const at = this.#decide(r.ready.version, "start", a.who);
    return { ok: true, version: r.ready.version, kind: "start", by: a.who, at,
             address: `${INSTALLER_UPDATE_ADDRESS}?version=${encodeURIComponent(r.ready.version)}`,
             note: word("setup.note.installed_whoever_holds") };
  }

  /** R90, op=updatelater: an administrator sets the release ready aside: for 14 days, or, for a security release, until
   *  the start of the next local day (`civil-time`, the profile's zone, else UTC). A newer release replaces it at once. */
  updateLater({ version = null, by = null } = {}) {
    const a = this.#updateActor(by, localize("instance-setup.setup.what_setting_aside_update", "setting aside an update of your team's Civicsmith"));
    if (a.refused) return a.refused;
    const r = this.#updateReady(version);
    if (r.refused) return r.refused;
    const now = this.#instant();
    let until, zone = null;
    if (r.ready.security === 1) ({ until, zone } = this.#nextLocalDay(now));
    else until = new Date(now + UPDATE_LATER_DAYS * 86_400_000).toISOString();
    const at = this.#decide(r.ready.version, "later", a.who, { until });
    return { ok: true, version: r.ready.version, kind: "later", by: a.who, at, until, ...(zone ? { zone } : {}) };
  }
  /* R90: the start of the next local day after `nowMs` in the first active profile's zone, UTC when none states one. */
  #nextLocalDay(nowMs) {
    const iso = `${new Date(nowMs).toISOString().slice(0, 19)}Z`;
    /* K5292 (jurisdictions R98): the team's governing zone first, then each active profile's own */
    const rec = this.#record();
    let team = null;
    try { team = governingZone(rec.getSetting("jurisdiction_profiles"), rec.getSetting("team_time_zone")); } catch { team = null; }
    const zones = [...(team ? [team] : []), ...this.#activeProfiles().map(({ p }) => zoneOf(p)).filter(Boolean), "UTC"];
    for (const zone of zones) {
      const day = localDay(iso, zone);
      if (typeof day !== "string") continue;
      const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      const b = dayBounds({ value: next, precision: "day", zone });
      if (b && typeof b.earliest === "string") return { until: b.earliest, zone };
    }
    return { until: new Date(nowMs + 86_400_000).toISOString(), zone: "UTC" };
  }

  /** R90, op=updateskip: an administrator skips the release ready, with a reason (1 to 1,000 characters on one line):
   *  recorded with who and when and never erased; the release is never ready again, and the next one is offered. */
  updateSkip({ version = null, reason = null, by = null } = {}) {
    const a = this.#updateActor(by, localize("instance-setup.setup.what_skipping_update", "skipping an update of your team's Civicsmith"));
    if (a.refused) return a.refused;
    const r = this.#updateReady(version);
    if (r.refused) return r.refused;
    const why = typeof reason === "string" ? reason.trim() : "";
    /* DEC-49 REGION is-update-skip */
    if (!why || [...why].length > UPDATE_SKIP_REASON_MAX || !oneLine(why))
      return refusal("UPDATE_SKIP_NO_REASON", typeof reason !== "string" || !why
          ? localize("instance-setup.setup.skip_no_reason", "No reason was given. A release is skipped with a reason of one line of 1 to {max} characters. Nothing was recorded.", { max: UPDATE_SKIP_REASON_MAX })
          : oneLine(why) ? localize("instance-setup.setup.skip_reason_too_long", "A reason of {chars} characters is not one line of 1 to {max} characters, and a release is skipped with one. Nothing was recorded.", { chars: [...why].length, max: UPDATE_SKIP_REASON_MAX })
          : localize("instance-setup.setup.skip_reason_many_lines", "A reason of {chars} characters over more than one line is not one line of 1 to {max} characters, and a release is skipped with one. Nothing was recorded.", { chars: [...why].length, max: UPDATE_SKIP_REASON_MAX }),
        { version: r.ready.version });
    /* END DEC-49 REGION is-update-skip */
    const at = this.#decide(r.ready.version, "skip", a.who, { reason: why });
    return { ok: true, version: r.ready.version, kind: "skip", by: a.who, at, reason: why };
  }

  /* =====================================================================
   * THE INSTANCE'S OWN LIMITS (K98; R33–R40). What runs here COST, measured, and where the CPU ceiling lies, found
   * by walking into it. They are measurements of the runtime, not of the corpus (R41).
   * ===================================================================== */

  /** R33: record what a run cost. The peak is kept beside the last because the peak is the run that will die first
   *  and a mean would hide it. `unit` is the metric's (R34), fixed by its first observation. Never throws. */
  recordRuntimeObservation({ metric, ms, detail = null, at = null, unit = null } = {}) {
    try {
      if (typeof metric !== "string" || !metric || typeof ms !== "number" || !Number.isFinite(ms)) return { recorded: false };
      const now = at || stampInstant("second", this.#now());
      const cur = this.#one(`SELECT * FROM runtime_observations WHERE metric = ?`, metric);
      if (!cur) {
        this.#sql.exec(
          `INSERT INTO runtime_observations (metric, peak_ms, peak_at, peak_detail, last_ms, last_at, samples, total_ms, unit)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, metric, ms, now, detail, ms, now, ms,
          typeof unit === "string" && unit ? unit : unitOfMetric(metric));
        return { metric, peak_ms: ms, last_ms: ms, samples: 1, new_peak: true };
      }
      const isPeak = ms > cur.peak_ms;
      this.#sql.exec(
        `UPDATE runtime_observations SET last_ms = ?, last_at = ?, samples = samples + 1, total_ms = total_ms + ?
         ${isPeak ? ", peak_ms = ?, peak_at = ?, peak_detail = ?" : ""} WHERE metric = ?`,
        ...(isPeak ? [ms, now, ms, ms, now, detail, metric] : [ms, now, ms, metric]));
      return { metric, peak_ms: isPeak ? ms : cur.peak_ms, last_ms: ms, samples: cur.samples + 1, new_peak: isPeak };
    } catch { return { recorded: false }; }
  }

  /** R34: every metric in name order, each with the unit it was recorded in. A time is also given under its `_ms`
   *  names; a count of work never is, so a count is never described as a time. */
  runtimeObservations() {
    const metrics = this.#rows(`SELECT * FROM runtime_observations ORDER BY metric`).map((r) => {
      const unit = r.unit || unitOfMetric(r.metric);
      const mean = r.samples ? r.total_ms / r.samples : null;
      return { metric: r.metric, unit, peak: r.peak_ms, peak_at: r.peak_at, peak_detail: r.peak_detail ?? null,
               last: r.last_ms, last_at: r.last_at, samples: r.samples, total: r.total_ms, mean,
               ...(unit === "ms" ? { peak_ms: r.peak_ms, last_ms: r.last_ms, total_ms: r.total_ms, mean_ms: mean } : {}) };
    });
    return { metrics,
      note: localize("instance-setup.setup.each_metric_is_stated_in", "each metric is stated in its own unit. A metric in ms is measured wall time across synchronous compute segments, not billed CPU time; a metric in bytes is a count of the work a run handled, not a time. peak is the run that would die first if a ceiling were near; a mean would hide it.") };
  }

  /** R40: a probe run begins. Its steps are numbered and timed from this run's own start. */
  recordCpuProbeStart({ run, iterations = null, budgetMs = null, at = null } = {}) {
    if (typeof run !== "string" || !run) return { recorded: false };
    this.#sql.exec(`INSERT INTO cpu_probe_runs (run, started_at, iterations, budget_ms) VALUES (?, ?, ?, ?)
                    ON CONFLICT(run) DO NOTHING`, run, at || stampInstant("second", this.#now()), iterations, budgetMs);
    return { run, recorded: true };
  }

  /** R35: one completed step of one run (`run`, R40): its number, its elapsed time from its run's start, its
   *  iterations and the instant. Never throws for a well-formed call. */
  recordCpuProbeStep({ run = LEGACY_PROBE_RUN, step, elapsedMs, iterations, at = null } = {}) {
    const now = at || stampInstant("second", this.#now());
    /* A step with no recorded start (a caller that names no run) belongs to a run whose end is not known either. */
    if (!this.#one(`SELECT run FROM cpu_probe_runs WHERE run = ?`, run))
      this.#sql.exec(`INSERT INTO cpu_probe_runs (run, started_at, iterations, reason) VALUES (?, ?, ?, 'unrecorded')`,
                     run, now, iterations);
    this.#sql.exec(
      `INSERT INTO cpu_probe_steps (run, step, elapsed_ms, iterations, at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(run, step) DO UPDATE SET elapsed_ms = excluded.elapsed_ms, at = excluded.at`,
      run, step, elapsedMs, iterations, now);
    return { run, step, elapsed_ms: elapsedMs };
  }

  /** R40: a probe run returned, with what it completed and why it stopped. A run with no end is one cut off. */
  recordCpuProbeEnd({ run, completed = null, elapsedMs = null, reason = null, at = null } = {}) {
    if (typeof run !== "string" || !run) return { recorded: false };
    this.#sql.exec(`UPDATE cpu_probe_runs SET ended_at = ?, completed = ?, elapsed_ms = ?, reason = ? WHERE run = ?`,
                   at || stampInstant("second", this.#now()), completed, elapsedMs, reason, run);
    return { run, recorded: true };
  }

  /** R36, R40: where the probe got to, and so what is known about the ceiling. Writes nothing. */
  cpuProbeState() {
    const runs = this.#rows(`SELECT * FROM cpu_probe_runs ORDER BY started_at, run`);
    const steps = this.#rows(`SELECT run, step, elapsed_ms, iterations, at FROM cpu_probe_steps ORDER BY run, step`);
    const byRun = new Map(runs.map((r) => [r.run, []]));
    for (const s of steps) (byRun.get(s.run) || byRun.set(s.run, []).get(s.run)).push(s);
    const rows = [];
    let top = null;
    const runOut = runs.map((r) => {
      const own = (byRun.get(r.run) || []).map((s) => ({ step: s.step, elapsed_ms: s.elapsed_ms, iterations: s.iterations, at: s.at }));
      for (const s of own) {
        rows.push({ run: r.run, ...s });
        if (!top || s.elapsed_ms > top.elapsed_ms) top = s;
      }
      const last = own[own.length - 1] || null;
      const returned = r.ended_at ? true : r.reason === "unrecorded" ? null : false;
      return { run: r.run, started_at: r.started_at, iterations: r.iterations, budget_ms: r.budget_ms ?? null,
               steps: own, returned,
               ...(r.ended_at ? { ended: { at: r.ended_at, completed: r.completed, elapsed_ms: r.elapsed_ms, reason: r.reason } } : {}),
               ...(returned === false ? { bracket: { last_completed_step: last ? last.step : 0,
                                                     above_ms: last ? last.elapsed_ms : 0,
                                                     next_step: (last ? last.step : 0) + 1 } } : {}) };
    });
    const cut = runOut.filter((r) => r.returned === false && r.steps.length);
    return { steps: rows.length, highest_completed: top ? top.step : 0, elapsed_at_highest_ms: top ? top.elapsed_ms : 0,
      rows, runs: runOut,
      note: !rows.length
        ? "the probe has never run, so nothing is known about the ceiling by measurement"
        : cut.length
          ? localize("instance-setup.setup.probe_cut_off", "a run completed a step {elapsed_ms} ms into its own isolate, so the ceiling lies above elapsed_at_highest_ms. A run with no recorded end was cut off: the ceiling lies within its bracket, above its last completed step's elapsed time and below what its next step would have cost.", { elapsed_ms: top.elapsed_ms })
          : localize("instance-setup.setup.probe_none_cut_off", "a run completed a step {elapsed_ms} ms into its own isolate, so the ceiling lies above elapsed_at_highest_ms. No run has been cut off yet, so the ceiling is above everything tried.", { elapsed_ms: top.elapsed_ms }) };
  }
}

/* R12 (N420): the three facts of the active profiles' combined view that `agent-worker` R51 reads (and, since fix round
   4, `records_laws`, `records_help` and `name` for the screens): `deadlines` and
   `legal_organisations` as `jurisdictions.combine` gives them (its R29, R34), and `venues`, each `{kind, venue}` of a
   combined `action_kinds` entry that gives one (its R25, R29). A fact no active profile states, or that `combine`
   withholds (a conflict) or cannot give (its errors), is ABSENT, never an empty list: the reader then reads it
   undetermined, which is what it is. Nothing here chooses between profiles or supplies a default. */
function profileView(combined) {
  const view = {};
  const v = combined && combined.ok === true && combined.view && typeof combined.view === "object" ? combined.view : null;
  if (!v) return view;
  for (const fact of ["deadlines", "legal_organisations"])
    if (Array.isArray(v[fact]) && v[fact].length) view[fact] = v[fact];
  const venues = (Array.isArray(v.action_kinds) ? v.action_kinds : [])
    .filter((k) => k && typeof k.kind === "string" && k.venue && typeof k.venue === "object")
    .map((k) => ({ kind: k.kind, venue: k.venue }));
  if (venues.length) view.venues = venues;
  /* (fix round 4, C64-law) the law picker, "Change the law" and the records help read these three, as `combine` gives them */
  if (Array.isArray(v.records_laws) && v.records_laws.length) view.records_laws = v.records_laws;
  if (v.records_help && typeof v.records_help === "object") view.records_help = v.records_help;
  if (typeof v.name === "string" && v.name) view.name = v.name;
  return view;
}

const INSTANCES = new WeakMap();

/** The one instance of this module for a Durable Object's storage (K61). `deps` is read on the first call only. */
export function instanceSetupOf(ctx, env = null, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let m = INSTANCES.get(storage);
  if (!m) { m = new InstanceSetup(ctx, env || {}, deps); INSTANCES.set(storage, m); }
  return m;
}

/** R54 (T47; N981; K3030; T48, N996; `ai-accounts` R23): the one read `ai-accounts` asks before a member's own account
 *  is connected, `disclosureOf({member})` of this module's instance on the storage. This module registers nothing with
 *  `ai-accounts` itself: the composition root registers it, `ai-accounts.registerDisclosureRead(DISCLOSURE_READER,
 *  disclosureReadOf(m))` (`plane`'s T48-78), and `ai-accounts` R1 and `control-plane` R65 then refuse `DISCLOSURE_DUE`
 *  through `ai-accounts.disclosureDue` while it answers `shown: false`. */
export const DISCLOSURE_READER = "instance-setup";
export function disclosureReadOf(m) {
  return ({ member = null } = {}) => m.disclosureOf({ member });
}

/** This module's Durable Object routes (the `membershipOps` pattern). The stamps (`author`, `by`, `origin`) are the
 *  control plane's, read from the query AFTER the body is spread, so a body naming its own is overwritten (R29).
 *  The map joins `control-plane`'s one route map (its R35; N348), so every route passes its frame: R26's body read,
 *  R27's existence read, the envelope and R25's catch. This module keeps no door or Durable Object class of its own. */
export function instanceSetupOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    instancegroup: () => m.instanceGroup(),
    instancegrouppublic: () => m.instanceGroupPublic(),
    instancegroupseed: () => m.instanceGroupSeed({ ...(body || {}), author: q("author") }),
    groupnameset: () => m.groupNameSet({ ...(body || {}), by: q("by") }),
    groupdomainset: () => m.groupDomainSet({ ...(body || {}), by: q("by"), origin: q("origin") }),
    groupidentity: () => m.groupIdentity(),
    groupidentitypublic: () => m.groupIdentityPublic(),
    profiles: () => m.profiles(),
    profilesset: () => m.profilesSet({ ...(body || {}), by: q("by") }),
    runtimeobservations: () => m.runtimeObservations(),
    cpuprobestate: () => m.cpuProbeState(),
    cpuprobestart: () => m.recordCpuProbeStart(body || {}),
    recordcpuprobestep: () => m.recordCpuProbeStep(body || {}),
    cpuprobeend: () => m.recordCpuProbeEnd(body || {}),
    assistantstate: () => m.assistantState(),
    disclosureshown: () => m.disclosureShown({ ...(body || {}), by: q("by") }),
    disclosureof: () => m.disclosureOf({ member: q("member") ?? (body || {}).member, version: q("version") ?? (body || {}).version }),
    officesseed: () => m.officesSeed({ ...(body || {}), boot: false, by: q("by") }),
    seatsseed: () => m.seatsSeed({ ...(body || {}), by: q("by") }),
    placewanted: () => m.placeWantedSet({ ...(body || {}), by: q("by") }),
    placewantedstate: () => m.placeWanted({ viewer: q("viewer") }),
    memberlanguageset: () => m.memberLanguageSet({ ...(body || {}), by: q("by") }),
    memberlanguage: () => m.memberLanguage({ viewer: q("viewer") }),
    /* R79 (T46): a member's own explanation level. */
    infolevelset: () => m.infoLevelSet({ ...(body || {}), by: q("by") }),
    infolevel: () => m.infoLevel({ viewer: q("viewer") }),
    adminrecoverystep: () => m.adminRecoveryStep({ viewer: q("viewer") }),
    /* R95 (T51): the seven facts `op=bootstrap` states to a credentialed caller; a store-internal route (no spec), asked
       by `bootstrapReport` only for such a caller. */
    /* R105 (fix round 10, K5170): the migrations' counts `op=selftest` states to an administrator; a store-internal route (no spec). */
    selftestmigrations: () => m.selftestMigrations(),
    bootstrapfacts: () => (body && typeof body === "object" && !Array.isArray(body) && body.keep !== undefined
      ? m.keepFleetParts(body.keep)
      : m.bootstrapFacts({ facts: q("facts") !== "0", viewer: q("viewer"), parts: q("parts") === "1" })),
    /* R84, R85 (T47; DEC-205): the group's logo and languages; `grouplogo` is the read control-plane serves. */
    /* R86: the logo's bytes are the request's body (a stream or bytes as the door hands them on, with `rawType` its
       content-type stamped in the query), or a JSON `{raw, rawType}` (`raw` base64, or null to clear). */
    grouplogoset: () => (body && typeof body === "object" && !ArrayBuffer.isView(body) && !(body instanceof ArrayBuffer)
      && typeof body.getReader !== "function"
      ? m.groupLogoSet({ raw: body.raw, rawType: body.rawType ?? null, by: q("by") })
      : m.groupLogoSet({ raw: body ?? undefined, rawType: q("rawType"), by: q("by") })),
    grouplogo: () => m.groupLogoResponse(),
    grouplanguagesset: () => m.groupLanguagesSet({ ...(body || {}), by: q("by") }),
    grouplanguages: () => m.groupLanguages(),
    /* R77 (T45): the administrators' act setting the group's declared stake. */
    declaredstakeset: () => m.declaredStakeSet({ ...(body || {}), by: q("by") }),
    /* R89, R90 (T48; N1047): the update notice and the administrators' three choices; `by` and `viewer` are the stamps. */
    updatenotice: () => m.updateNotice({ viewer: q("viewer") }),
    updatestart: () => m.updateStart({ ...(body || {}), by: q("by") }),
    updatelater: () => m.updateLater({ ...(body || {}), by: q("by") }),
    updateskip: () => m.updateSkip({ ...(body || {}), by: q("by") }),
  };
}

/* R101 (T51 fix round; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that the screens send,
   declared by their owner beside the ops map. Each row's classes, machine classes and mutating are the op's rows in
   `op-declarations`, its weight and description the op's in `op-grades` (copied, never chosen); its fields are what the arm
   reads from the request: the stamps (`viewer`, `by`, `origin`) are the control plane's and are no field, and a field a call
   cannot do without is one the arm refuses without, `null` being an answer where it clears (`stake`, `raw`, `language`,
   `name` of a place). `runtime` and `selftest` are answered at the Worker (`instanceSetupOp`) and read nothing from the
   request; they are reads, so their weight is `read`. `officesseed` forces its own `boot`. */
const ADMIN_ACT = Object.freeze(["admin", "member"]);
const STAMPED_ACT = Object.freeze(["admin", "member", "probe"]);
export const DECLARED_OPS = Object.freeze({
  declaredstakeset: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reversible",
    description: localize("instance-setup.declared.declaredstakeset", "setting: the group's declared stake in its own words, carried beside its public identity on what it sends or publishes from then; an administrator's act, every earlier value kept; moves no bundle"),
    fields: { accepts: ["stake"], requires: ["stake"] } },
  disclosureshown: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "caller-owned",
    description: localize("instance-setup.declared.disclosureshown", "personal state, keyed by member: the assistant's disclosure shown to them, with its version"),
    fields: { accepts: ["member", "version"], requires: ["member", "version"] } },
  groupdomainset: { classes: STAMPED_ACT, mutating: true, weight: "substrate",
    description: localize("instance-setup.declared.groupdomainset", "the group's claimed domain — the subject is the instance's identity, not a bundle"),
    fields: { accepts: ["domain"], requires: ["domain"] } },
  grouplanguagesset: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reversible",
    description: localize("instance-setup.declared.grouplanguagesset", "setting: the languages the group works in; an administrator's act, a later one replacing it; moves no bundle"),
    fields: { accepts: ["languages"], requires: ["languages"] } },
  grouplogoset: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reversible",
    description: localize("instance-setup.declared.grouplogoset", "setting: the group's logo, PNG or JPEG, or none; an administrator's act, a later one replacing it; moves no bundle"),
    fields: { accepts: ["raw", "rawType"], requires: ["raw"] } },
  groupnameset: { classes: STAMPED_ACT, mutating: true, weight: "substrate",
    description: localize("instance-setup.declared.groupnameset", "the group's public display name — the subject is the instance's identity, not a bundle"),
    fields: { accepts: ["name"], requires: ["name"] } },
  infolevelset: { classes: STAMPED_ACT, machineClasses: [], mutating: true, weight: "caller-owned",
    description: localize("instance-setup.declared.infolevelset", "personal state, keyed by member: how quickly explanations open, promptly or after a longer pause; nothing is hidden"),
    fields: { accepts: ["level", "asked"], requires: ["level"] } },
  memberlanguageset: { classes: STAMPED_ACT, machineClasses: [], mutating: true, weight: "caller-owned",
    description: localize("instance-setup.declared.memberlanguageset", "personal state, keyed by member: the language the interface speaks to them"),
    fields: { accepts: ["language"], requires: ["language"] } },
  officesseed: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "substrate",
    description: localize("instance-setup.declared.officesseed", "the instance's configuration: seeds the active profiles' offices and bodies as entities; an administrator's"),
    fields: { accepts: [], requires: [] } },
  placewanted: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "substrate",
    description: localize("instance-setup.declared.placewanted", "the instance's configuration: the place the group wants its profile for; an administrator's"),
    fields: { accepts: ["name"], requires: ["name"] } },
  profilesset: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "substrate",
    description: localize("instance-setup.declared.profilesset", "the instance's active jurisdiction profiles — the subject is the instance's configuration, not a bundle; refused PROFILES_NOT_ADMIN to a caller who is not an administrator"),
    fields: { accepts: ["profiles"], requires: ["profiles"] } },
  runtime: { classes: STAMPED_ACT, mutating: false, weight: "read",
    description: localize("instance-setup.declared.runtime", "read: what the instance was measured to cost and where its limits lie (the runtime's measurements, the CPU probe's trail, the subrequest ceiling)"),
    fields: { accepts: [], requires: [] } },
  selftest: { classes: STAMPED_ACT, mutating: false, weight: "read",
    description: localize("instance-setup.declared.selftest", "read: whether the deployment is healthy (its bindings, the store's stats and a storage round trip); it never returns a secret"),
    fields: { accepts: [], requires: [] } },
  updatelater: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reversible",
    description: localize("instance-setup.declared.updatelater", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"),
    fields: { accepts: ["version"], requires: ["version"] } },
  updateskip: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reasoned", refusal: "UPDATE_SKIP_NO_REASON",
    description: localize("instance-setup.declared.updateskip", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"),
    fields: { accepts: ["version", "reason"], requires: ["version", "reason"] } },
  updatestart: { classes: ADMIN_ACT, machineClasses: [], mutating: true, weight: "reversible",
    description: localize("instance-setup.declared.updatestart", "release-directed: keyed by a verified release notice, reached from Settings › Updates and the administrators' queue; an administrator's choice, recorded with who and when; installs nothing (the installer installs, with Cloudflare's consent)"),
    fields: { accepts: ["version"], requires: ["version"] } },
});

/* ============================================================================================================
 * THE INSTANCE'S REPORTS, WORKER SIDE (R17–R19, R37, R38). The credential, the namespace and the envelope are the
 * control plane's: each function takes the `{json, storeSilent, doAnswer, storeRefusal}` it hands them (capture's
 * `knockOp` pattern) and the store it resolved, and answers a Response.
 * ============================================================================================================ */

/* R43 (N339, N349; control-plane R23, R25): what a relay answers for a store reply `doAnswer` did not read as an
   answer. The store's own refusal (`ok: false` below 500) is relayed with its status, code and sentence, through the
   plane's `storeRefusal` when it is handed one, else as that function answers it (`json(body, status)`); anything
   else is a silence, carrying the correlation id `doAnswer` read from the store's internal error, when it gave one.
   One rule for every relay, a sub-read inside a longer act included (K444). */
function notAnswered(out, op, { json, storeSilent, storeRefusal }) {
  if (out && out.refused === true && out.reply)
    return typeof storeRefusal === "function" ? storeRefusal(out) : json(out.reply.body, out.reply.status);
  return storeSilent(op, out ? out.correlation : undefined);
}

/* REC-163 / IC-174 / D-596 — THE PUBLIC READ OF THE PRODUCING GROUP, ONE READER FOR THE SURFACES THAT SHOW IT TO A
   STRANGER: op=instancegroup's and op=groupidentity's public arms (R3, R10).
   Exactly two projections may be named; any other value is answered as a silence rather than forwarded, so a typo
   cannot reach a Durable Object path. An instance with no store binding cannot be asked, and that is a silence too. */
export const PUBLIC_GROUP_PROJECTIONS = Object.freeze(["instancegrouppublic", "groupidentitypublic"]);
export async function publicInstanceGroup(env, storeName, projection = "instancegrouppublic", doAnswer) {
  if (!PUBLIC_GROUP_PROJECTIONS.includes(projection)) return { answered: false, result: undefined };
  let stub = null;
  try { stub = storeStub(env, storeName); } catch { stub = null; }
  if (!stub) return { answered: false, result: undefined };
  return doAnswer(stub.fetch(`http://do/${projection}`));
}

/** R3 over the wire: a credentialed reader (`viewer` set by the control plane) is answered the whole row; anybody
 *  else the public projection. A silence is a silence (REC-52), never "no group is recorded". */
export async function instanceGroupOp(env, storeName, { viewer = null, cls = null } = {}, io) {
  const { json, doAnswer } = io;
  if (viewer) {
    const out = await doAnswer(storeStub(env, storeName).fetch("http://do/instancegroup"));
    if (!out.answered) return notAnswered(out, "instancegroup", io);
    return json({ ok: true, result: out.result, store: storeName, tokenClass: cls }, 200);
  }
  const pub = await publicInstanceGroup(env, storeName, "instancegrouppublic", doAnswer);
  if (!pub.answered) return notAnswered(pub, "instancegroup", io);
  return json({ ok: true, result: pub.result, store: storeName }, 200);
}

/** R10, R11 over the wire: the credentialed read (R11) or the public projection (R10). */
export async function groupIdentityOp(env, storeName, { viewer = null, cls = null } = {}, io) {
  const { json, doAnswer } = io;
  const out = await doAnswer(storeStub(env, storeName)
    .fetch(viewer ? "http://do/groupidentity" : "http://do/groupidentitypublic"));
  if (!out.answered) return notAnswered(out, "groupidentity", io);
  return json({ ok: true, result: out.result, store: storeName, ...(viewer ? { tokenClass: cls } : {}) }, 200);
}

/** R84, R86 (control-plane R84): the group's logo as served in public at `/app/assets/group-logo`, the store-internal
 *  route `grouplogo`'s bytes and headers relayed as given; 404 with no body when none is set; any other answer, or none,
 *  is a silence (R43). */
export async function groupLogoAsset(env, storeName, io) {
  let res = null;
  try { res = await storeStub(env, storeName).fetch("http://do/grouplogo"); } catch { res = null; }
  const type = res ? String(res.headers.get("content-type") || "").split(";")[0].trim() : "";
  if (res && res.status === 200 && GROUP_LOGO_TYPES.some((t) => t.type === type))
    return new Response(res.body, { status: 200, headers: { "content-type": type, "cache-control": "no-store",
                                                            "x-content-type-options": "nosniff" } });
  if (res && res.status === 404) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  return io.storeSilent("grouplogo");
}

/** R17, op=bootstrap: this isolate's `version`, `bootstrapConfigured` (a live ADMIN_TOKEN), membership's
 *  `bootstrapState` and the store's own `storeVersion` from the Durable Object's route, and with `members` each
 *  member's own build (D-116: THREE BUILDS, EACH READ FROM WHERE IT RUNS — `storeVersion` is never written here).
 *  R95 (T51): to a credentialed `caller` only (`{cls: "admin"}` for an admin-class token, `{administrator: true}` for an
 *  administrator's signed-in session, as the control plane resolved it) it adds the seven flat facts of the copy, read from
 *  the store's own `bootstrapfacts` route; a caller with none, or of another class, is answered exactly R132's key set. */
export async function bootstrapReport(env, fp, { members = false, stub, json, storeSilent, doAnswer, storeRefusal, caller = null, stateTiming = null, now = () => Date.now() }) {
  /* R104: `stateTiming(name, ms)`, when the door hands one, is told `fleet` (the time of the parts' ask, 0 when kept) and `facts` (the
     time of this report's hops to the store), which the door states in `Server-Timing` (`fleet;dur`, `facts;dur`). G118b (R-LOG): and
     `isolate`, this isolate's age, with its id as the third argument (`desc`), so a deploy shows how many isolates answer. */
  const tell = (name, ms, desc) => { try { if (typeof stateTiming === "function") stateTiming(name, Math.max(0, Math.round(ms)), desc); } catch { /* a sink never fails the report */ } };
  const tellIsolate = () => { const iso = isolateOf(now); tell("isolate", now() - iso.at, iso.id); };
  let storeMs = 0;
  const hop = async (f) => { const t = now(); try { return await f(); } finally { storeMs += now() - t; } };
  /* The first look at the parts is made before the hops. A signed-in caller's call that must ask the fleet reads the object's keep in the
     one visit it already makes for the facts, and tells the object once after an ask (K4870); a stranger's keeps to this isolate and makes
     no visit of its own for it, and a call that finds this isolate's entry reads none. */
  const since = now();
  const claim = !members && claimable(env, null) ? claimParts(env, now) : null;
  const owner = !!claim && claim.owner;
  const signedIn = credentialedCaller(caller) || !!signedInViewer(caller);
  const outHop = hop(() => doAnswer(stub.fetch(new Request(`http://do/bootstrap?fp=${fp}`))));
  const factsHop = hop(() => bootstrapFactsOf(stub, doAnswer, { facts: credentialedCaller(caller), viewer: signedInViewer(caller), parts: owner && signedIn }));
  if (owner) runOwner(claim.entry, env, now, {
    readKept: async () => (signedIn ? (await factsHop).kept : null),
    writeKept: async (parts) => { if (signedIn) await hop(() => keepPartsOf(stub, doAnswer, parts)); },
  });
  const out = await outHop;
  if (!out.answered) { await factsHop; tell("facts", storeMs); tellIsolate(); return notAnswered(out, "bootstrap", { json, storeSilent, storeRefusal }); }
  const versions = members ? await memberVersions(env) : null;
  /* R80, R82: the deployment's facts are this isolate's alone, so a store answer naming any of them sets nothing, and
     the retired nested `parts` (R81) is never relayed. R95: nor does it set any of the seven facts, which only a
     credentialed caller is told, from the store's own route for them; R103: nor `language` or `words_version`. */
  const { parts: _retired, test_instance: _t, part_signin: _s, part_scanner: _c, part_safe_view: _v, ...held } =
    out.result && typeof out.result === "object" ? out.result : {};
  const store = Object.fromEntries(Object.entries(held).filter(([k]) => !BOOTSTRAP_FACT_KEYS.includes(k) && !BOOTSTRAP_VIEWER_KEYS.includes(k)));
  const [parts, facts] = await Promise.all([partsResult(claim, env, versions, now, since), factsHop]);
  tell("fleet", parts.ms);
  tell("facts", storeMs);
  tellIsolate();
  return json({ ok: true, service: "bio-plane", version: env.VERSION || "0.0.0",
                bootstrapConfigured: await liveToken(env.ADMIN_TOKEN), ...store,
                test_instance: testInstanceOf(env), ...parts.parts, ...facts.out,
                ...(members ? { memberVersions: versions } : {}) }, 200);
}

/* R95: the seven facts of a copy, by the wire names the installer reads (`newgroup/src/account.mjs`' `FACT_KEYS`). */
export const BOOTSTRAP_FACT_KEYS = Object.freeze(["team_name", "installed_at", "last_used_at", "count_projects",
  "count_documents", "count_published", "count_members"]);
/* R95: a caller the door admits as the deployer's or an administrator's: an `admin`-class token (`cls`), or an
   administrator's signed-in session (`administrator`). The control plane hands both in as it resolved them; a caller that
   presented no credential, or one of another class, is told none of the seven. */
const credentialedCaller = (caller) => !!caller && typeof caller === "object" && (caller.cls === "admin" || caller.administrator === true);
/* R103 (fix round 8, G114): the keys of a signed-in caller, the viewer's screen language (R64) and the words stamp
   (`translations` R20); never in a stranger's answer. */
export const BOOTSTRAP_VIEWER_KEYS = Object.freeze(["language", "words_version"]);
/* R103: a caller the door signed in as a member: the control plane's `viewer` stamp, a member's id (never a machine identity). */
const signedInViewer = (caller) => {
  const v = caller && typeof caller === "object" && typeof caller.viewer === "string" ? caller.viewer.trim() : "";
  return v && !isMachineIdentity(v) ? v : null;
};
/* R95, R103: the store's answer, in one hop. With `facts` the seven, each key a non-empty string or a non-negative integer,
   else `null`; with a `viewer` the viewer's `language` and the `words_version`, each a non-empty string or `null`. A read
   that does not answer states every key asked `null`, never leaving a key out and never inventing a count; nothing asked,
   no hop. R104 (G118b): with `parts` the same visit also asks the fleet's parts the object keeps for every isolate, answered
   as `kept`: `{parts, age_ms}` (the three flat keys and the age by the object's own clock), or `null` when none is kept, they
   are past the minute, or the visit was not answered. `{out, kept}`: `out` is what the answer states, `kept` is read by the owner of the ask. */
async function bootstrapFactsOf(stub, doAnswer, { facts = true, viewer = null, parts = false } = {}) {
  if (!facts && !viewer && !parts) return { out: {}, kept: null };
  let got = null;
  try {
    const q = new URLSearchParams({ facts: facts ? "1" : "0", ...(viewer ? { viewer } : {}), ...(parts ? { parts: "1" } : {}) });
    const a = await doAnswer(stub.fetch(new Request(`http://do/bootstrapfacts?${q}`)));
    got = a.answered && a.result && typeof a.result === "object" ? a.result : null;
  } catch { got = null; }
  const text = (v) => (typeof v === "string" && v !== "" ? v : null);
  const out = {};
  if (facts) for (const k of BOOTSTRAP_FACT_KEYS) {
    const v = got ? got[k] : null;
    const ok = k === "team_name" || k === "installed_at" || k === "last_used_at" ? typeof v === "string" && v !== "" : Number.isInteger(v) && v >= 0;
    out[k] = ok ? v : null;
  }
  if (viewer) for (const k of BOOTSTRAP_VIEWER_KEYS) out[k] = text(got ? got[k] : null);
  const k = parts && got && got.kept_parts && typeof got.kept_parts === "object" ? got.kept_parts : null;
  const flat = k ? flatParts(k) : null;
  return { out, kept: flat && Number.isFinite(k.age_ms) ? { parts: flat, age_ms: k.age_ms } : null };
}
/* R104 (G118b): the owner of an ask tells the object what the fleet answered, the three flat keys, so every other isolate reads it. */
async function keepPartsOf(stub, doAnswer, parts) {
  const a = await doAnswer(stub.fetch(new Request("http://do/bootstrapfacts", { method: "POST", body: JSON.stringify({ keep: parts }) })));
  return a.answered === true;
}

/** R18, op=selftest: deployment health as JSON, so "did the deploy work" is a link rather than a command. It
 *  reports every binding, relays the store's stats (under op=stats' stamps: `capacity` for the admin class and the
 *  caller's `viewer`), and round-trips R2 under the scratch prefix; it never returns a secret. `ok` is false when
 *  exactly one bucket is bound, when the store does not answer, when the round trip fails, or when a required token
 *  binding is not live. */
export async function selftest(env, storeName, { cls = null, viewer = "", scratch = "scratch" } = {}, { json, doAnswer }) {
  /* R2 is optional by design: "not configured" is a first-class healthy state, distinct from "configured and
     broken", and the buckets are only ever added as a pair. */
  const r2Configured = typeof env.CAPTURES?.get === "function" && typeof env.PUBLISHED?.get === "function";
  const out = {
    ok: true, service: "bio-plane", version: env.VERSION || "0.0.0", time: new Date().toISOString(), tokenClass: cls,
    bindings: {
      STORE: typeof env.STORE?.idFromName === "function",
      CAPTURES: typeof env.CAPTURES?.get === "function" ? true : "not configured",
      PUBLISHED: typeof env.PUBLISHED?.get === "function" ? true : "not configured",
      ADMIN_TOKEN: await liveToken(env.ADMIN_TOKEN),
      PROBE_TOKEN: await liveToken(env.PROBE_TOKEN),
      /* REC-33: REPORTED, and deliberately NOT required: an instance that predates this class runs monitoring on the
         ADMIN_TOKEN fallback and is healthy. */
      DAEMON_TOKEN: (typeof env.DAEMON_TOKEN === "string" && env.DAEMON_TOKEN.length > 0)
        ? await liveToken(env.DAEMON_TOKEN) : "not configured",
    },
    r2Configured,
    /* R102: what this copy is configured with for its team's room: the location hint it asks the platform for when the room is
       first created (`null` when none is configured) and the generation of the room it uses. Configuration only, never where
       the room runs, and never a secret. */
    store_location: storeHint(env),
    store_generation: storeGeneration(env),
    store_place_note: localize("instance-setup.selftest.store_place_note", "store_location and store_generation are what this copy is configured with for where its team's room is first created and which room it uses. They do not say where the room runs."),
  };
  /* Half a fence is a defect, not an option. */
  if ((typeof env.CAPTURES?.get === "function") !== (typeof env.PUBLISHED?.get === "function")) {
    out.ok = false;
    out.r2 = "MISCONFIGURED: one bucket bound without the other; the fence requires both or neither";
  }
  try {
    /* REC-52: a store that answered `ok:false`, or did not answer, is a failure of the health check, never healthy. */
    const sOut = await doAnswer(storeStub(env, storeName)
      .fetch(`http://x/stats?capacity=${cls === "admin" ? "1" : "0"}&viewer=${encodeURIComponent(viewer ?? "")}`));
    if (!sOut.answered) { out.ok = false; out.store = "ERR the store did not answer /stats"; }
    else out.store = sOut.result;
  } catch (e) { out.ok = false; out.store = "ERR " + String(e && e.message || e); }
  /* R105 (K5170; extraction R110): an administrator is told each migration's counts, read only; a store that does not answer
     states none, which is not a health failure. */
  if (cls === "admin") {
    out.migrations = null;
    try {
      const mOut = await doAnswer(storeStub(env, storeName).fetch("http://x/selftestmigrations"));
      if (mOut.answered && mOut.result && Array.isArray(mOut.result.migrations)) out.migrations = mOut.result.migrations;
    } catch { out.migrations = null; }
  }
  if (r2Configured) {
    try {
      const key = `${scratch}/selftest-${Date.now()}`;
      await env.CAPTURES.put(key, "ok");
      const back = await env.CAPTURES.get(key);
      out.captures = (await back.text()) === "ok" ? "read-write ok" : "MISMATCH";
      if (out.captures !== "read-write ok") out.ok = false;
      await env.CAPTURES.delete(key);
    } catch (e) { out.ok = false; out.captures = "ERR " + String(e && e.message || e); }
  } else {
    out.captures = "not configured";
  }
  /* Required for health: the store and two live token bindings. R2 is reported but not required. (T36; N711) The
     shared member key is no binding: a member acts under their own session or an `aik-` credential, so it is neither
     read, reported nor required here. */
  out.bindingsAllPresent = out.bindings.STORE === true && out.bindings.ADMIN_TOKEN === true
    && out.bindings.PROBE_TOKEN === true;
  if (!out.bindingsAllPresent) out.ok = false;
  return json(out, out.ok ? 200 : 500);
}

/* The sentence R37 states: the subrequest ceiling is known by being refused, the CPU ceiling by op=cpuprobe. */
export const RUNTIME_ASYMMETRY = "a refused subrequest throws and is caught, so the subrequest ceiling is known by "
  + "having hit it. Exceeding the CPU limit TERMINATES the isolate, so no run can report its own death: consumption "
  + "is measured on every run and the ceiling is found by op=cpuprobe, whose checkpoints survive the kill.";

/** R37, op=runtime: R34's measurements, R36's probe state and capture's subrequest ceiling (capture R23), through one
 *  surface. When any of the three reads does not answer, the op answers the store-silence refusal (REC-52); the first
 *  of them, in read order, that is the store's own refusal or a silence is relayed as R43 says (K444). */
export async function runtimeOp(stub, io) {
  const { json, doAnswer } = io;
  const obsOut = await doAnswer(stub.fetch("http://x/runtimeobservations"));
  const probeOut = await doAnswer(stub.fetch("http://x/cpuprobestate"));
  const limOut = await doAnswer(stub.fetch("http://x/capturelimit?runtime=subrequests"));
  const miss = [obsOut, probeOut, limOut].find((o) => !o.answered);
  if (miss) return notAnswered(miss, "runtime", io);
  return json({ ok: true, measured: obsOut.result, cpu_probe: probeOut.result, subrequests: limOut.result,
                asymmetry: RUNTIME_ASYMMETRY });
}

/** R38–R40, op=cpuprobe: find the CPU ceiling by walking into it. R36 is read first (a store that does not answer
 *  burns nothing); a new run is started under its own id, each completed step is written, and CONFIRMED, before the
 *  next begins (R39: an unconfirmed checkpoint ends the probe); its end is written when it returns. */
export async function cpuProbeOp(stub, { iterations = null, budget_ms = null, run = null, probe = cpuProbe } = {},
                                 io) {
  const { json, storeSilent, doAnswer } = io;
  const beforeOut = await doAnswer(stub.fetch("http://x/cpuprobestate"));
  if (!beforeOut.answered) return notAnswered(beforeOut, "cpuprobe", io);
  if (!beforeOut.result) return storeSilent("cpuprobe");
  const iters = Math.max(100000, Number(iterations) || 2000000);
  const budget = Math.max(50, Number(budget_ms) || 20000);
  const id = typeof run === "string" && run ? run
    : `${new Date().toISOString().slice(0, 19)}Z~${crypto.randomUUID().slice(0, 8)}`;
  const post = (path, body) => doAnswer(stub.fetch(`http://x/${path}`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const started = await post("cpuprobestart", { run: id, iterations: iters, budgetMs: budget });
  if (!started.answered) return notAnswered(started, "cpuprobe", io);
  if (!started.result || started.result.recorded !== true) return storeSilent("cpuprobe");
  let confirmed = 0;
  const UNCONFIRMED = Symbol("unconfirmed");
  let r;
  try {
    r = await probe({
      startStep: 0, iterationsPerStep: iters, budgetMs: budget,
      checkpoint: async (step, elapsed) => {
        const w = await post("recordcpuprobestep", { run: id, step, elapsedMs: elapsed, iterations: iters });
        if (!w.answered || !w.result || w.result.step !== step) throw UNCONFIRMED;
        confirmed = step;
      },
    });
  } catch (e) {
    if (e !== UNCONFIRMED) throw e;
    r = null;
  }
  /* R39: a probe the store stopped confirming returned no result of its own; the trail says how far it got. */
  const complete = r !== null;
  if (!complete) r = { completed: confirmed, elapsed_ms: null, reason: null };
  if (complete) await post("cpuprobeend", { run: id, completed: r.completed, elapsedMs: r.elapsed_ms, reason: r.reason });
  const afterOut = await doAnswer(stub.fetch("http://x/cpuprobestate"));
  if (!afterOut.answered) return notAnswered(afterOut, "cpuprobe", io);
  return json({ ok: true, run: { ...r, id }, state: afterOut.result, trail_complete: complete,
    ...(complete ? {} : { last_confirmed_step: confirmed }),
    note: complete
      ? localize("instance-setup.setup.this_run_returned_so_the", "this run RETURNED, so the ceiling is above its elapsed time. If a later run does not return, its last recorded step is the last one that fit and the ceiling lies just above that step's elapsed_ms.")
      : localize("instance-setup.setup.the_store_did_not_confirm", "the store did not confirm step {next}, so the probe stopped there and burned nothing more: the trail is incomplete, and the last step the store confirmed is {confirmed}.", { next: confirmed + 1, confirmed }) });
}

/* ============================================================================================================
 * THE REPORT OPS' DISPATCH (the legacy-index map's §4.4 plain move, K649 (7)): which of this module's Worker functions
 * answers each report op, moved out of `src/index.mjs`. The door resolves the store, the class and the viewer stamp
 * (`control-plane`'s) and hands them in; who may call each op is `op-declarations`' and `admission`'s.
 * ============================================================================================================ */

/* The admitted ops this module answers at the Worker. `bootstrap` is the public door's default answer (below). */
export const INSTANCE_SETUP_OPS = Object.freeze(["selftest", "livefire", "runtime", "cpuprobe"]);

/** One of INSTANCE_SETUP_OPS, answered. `storeName` is the namespace the door resolved, `cls` the caller's class,
 *  `viewer` the door's viewer stamp for that caller, `scratch` the rehearsal namespace's name. */
export async function instanceSetupOp(op, url, env, storeName, { cls = null, viewer = "", scratch = "scratch", json,
                                                                  doAnswer, storeSilent, storeRefusal } = {}) {
  const io = { json, doAnswer, storeSilent, storeRefusal };
  const store = () => storeStub(env, storeName);
  /* selftest reports deployment health as JSON, so "did the deploy work" is a
     link rather than a command. It asserts every binding is present and that
     the store answers, and it never returns a secret. */
  if (op === "selftest") return selftest(env, storeName, { cls, scratch, viewer }, { json, doAnswer });

  if (op === "livefire") {
    const out = await livefire(env, storeName, { capacity: cls === "admin", viewer });
    /* D-506 / IC-265, on BOB #32's ruling of 2026-09-24 06:07Z. This read `out.ok ? 200 : 500`, and
       `out.ok` WAS the canary's verdict — which is why a failing canary answered `ok:false` with no
       code of any kind to every consumer that reads `ok:false` as a refusal. `out.ok` is now
       `true` whenever the op answered, and the verdict lives in `out.verdict` / `out.failing`.
       THE STATUS IS KEYED TO THE VERDICT, so it is byte-for-byte what it was for every outcome: a
       DIST gate or a curl that reads the status alone loses nothing to this change, which is the
       whole point of moving the verdict to keys of its own rather than deleting it from the wire. */
    return json(out, out.verdict === "pass" ? 200 : 500);
  }

  /* What runs here have COST, measured. A read, and the honest counterpart to
     the store's `capturelimit` read — a DO PATH and not an op, M0-12; nothing
     on the control plane reaches it — : that one reports a ceiling found by
     being refused, this one reports consumption found by measuring, because
     CPU has no catchable refusal to find a ceiling with. */
  if (op === "runtime") return runtimeOp(store(), io);

  /* Find the CPU ceiling by walking into it. Each completed step is
     checkpointed durably BEFORE the next begins, so when the isolate is killed
     the trail shows the last step that finished and the ceiling is bracketed.
     Probe class only: it burns compute on purpose and belongs nowhere near a
     member's session. */
  if (op === "cpuprobe") return cpuProbeOp(store(),
    { iterations: url.searchParams.get("iterations"), budget_ms: url.searchParams.get("budget_ms") }, io);

  return null;
}

/** R17 at the public door: op=bootstrap, the default answer of an unauthenticated call. REC-52: the same spread as
 *  the store reads'. A store silence used to leave a `{ok:true}` carrying the service name, the version and the
 *  bootstrap flag and NOTHING the store knows — an instance answering "here is what I am" while unable to say
 *  anything about itself. The installer and `newgroup` both read this op, so the false success reached a caller
 *  deciding whether an instance was ready. `members=1` adds each member's own build. */
export function bootstrapOp(url, env, fp, { stub, json, storeSilent, storeRefusal, doAnswer, caller = null, stateTiming = null }) {
  return bootstrapReport(env, fp, { members: url.searchParams.get("members") === "1", stub, json, storeSilent,
                                    storeRefusal, doAnswer, caller, stateTiming });
}
