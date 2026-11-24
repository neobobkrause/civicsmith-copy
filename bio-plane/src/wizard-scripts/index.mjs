/* wizard-scripts — the library of wizard scripts (requirements: `build/requirements/wizard-scripts.md`; DEC-120,
 * DEC-121; Bob's answers K1364; BOB's decisions K1363, K1368).
 *
 * A wizard script is an authored list of steps a wizard walks a member through on the real screens: each step names a
 * screen, the act on it (or none), what the member does and why, and at most one labelled draft placed in a field. A
 * step never acts: a draft becomes the member's words only by the member's own act of keeping or editing it, and no
 * step submits, signs or files (K1364 B3). Two libraries: the Civicsmith library, registered at start and read-only to
 * every group (R13), and each group's own, governed as filing templates are: versioned, never edited; approved by an
 * owner of the script's project, widened by an administrator; retired, never deleted (R1–R9). A machine proposes steps
 * and nothing else (R19). The module checks every script against the screens registered at start (R12), withholds a
 * group's script that stops matching them until it matches again (R13), serves the scripts that start on a screen to
 * every member's session with no AI and no key (R11) and, in one form, to the in-process readers that explain a screen
 * or walk a member through a wizard (R21), and keeps unattributed daily tallies of use and of refusals (R15, R16). It
 * runs no wizard: the runner and the screens are the interface's.
 *
 * A NEW MODULE (T31, layer 11, first in it; K1364). REACHED as `wizardScriptsOf(host, deps)` (K61): one instance per
 * host, created on the first call. At creation it creates its tables, declares them to record-core's purge (R18) and
 * registers its opaque ids' seed. `deps` (each reached through its factory on the same host unless given):
 *   record           layer 2: `transact`, `mintOpaqueId`, `declarePurge`, `registerMintSeed`.
 *   membership       `positionalMember` (R76), `memberFacts` (R68), `isJoinedParticipant`, `isProjectOwner` (R54),
 *                    `isAdministrator` (R64), `projectOwners` (R65), `activeAdmins` (R86), `inSight` (R80); and
 *                    `viewerPredicate` (R43), `notAnAdmin` (R84), `sessionRights` (R92; R40).
 *   filingTemplates  `offeredVersion` (its R25), for a `{template}` draft (R2, R12).
 *   accounts         `ai-accounts`' `aiKeptAway` (its R7; T37, N765, K231; T48, N996): whether the group keeps its material
 *                    away from AI, read at each writing-help call (R24, R27), the one reading of keep-away; reached on
 *                    first need.
 *   aiRuns           layer 6 (T47; R34; N984): `partAdmitted` and `testInstance` (its R78), read at each writing-help
 *                    call for the test-instance label; reached on first need.
 *   now              the instance clock, milliseconds (default `env.BIO_NOW_MS`, else the wall clock).
 *
 * No place, law, venue or wording of a script is named here (R20). */

import { recordOf, stampInstant, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, notAnAdmin } from "../membership/index.mjs";
import { filingTemplatesOf } from "../filing-templates/index.mjs";
import { aiAccountsOf, KEPT_AWAY_UNREADABLE } from "../ai-accounts/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { untestedLabel } from "../run-rules/test-bar.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { proposalLabel } from "../record-grammar/labels.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { WIZARD_SCRIPTS_CHECKS, rowOf } from "./checks.mjs";
import { WIZARD_SCRIPTS_TABLES, WIZARD_SCRIPTS_TABLE_CLASSES, WIZARD_SCRIPTS_MINT_SEED, migrateWizardScripts } from "./schema.mjs";
import { CIVICSMITH_LIBRARY } from "./civicsmith-library.mjs";
import { SCREEN_REGISTRY } from "./screen-registry.mjs";
import { FRONT_DOORS, ELSEWHERE_DOOR } from "./front-doors.mjs";
import { START_ROUTES, matchesOf, proposeStart } from "./start.mjs";
import { helpRefusedActs, writingHelpAt, FIRSTHAND_ACTS, TOLD_MAX, WRITING_HELP_NAMED, KEPT_AWAY } from "./writing-help.mjs";
import { word } from "../setup-words/index.mjs";

export { WIZARD_SCRIPTS_CHECKS } from "./checks.mjs";
export { WIZARD_SCRIPTS_SCHEMA, WIZARD_SCRIPTS_TABLES, WIZARD_SCRIPTS_TABLE_CLASSES } from "./schema.mjs";
export { CIVICSMITH_LIBRARY, CIVICSMITH_LIBRARY_SOURCE, CIVICSMITH_LIBRARY_ADOPTED_SOURCES } from "./civicsmith-library.mjs";
export { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE } from "./screen-registry.mjs";
export { FRONT_DOORS, FRONT_DOORS_SOURCE, ELSEWHERE_DOOR } from "./front-doors.mjs";
export { INSTALLER_ROUTES, registryActGaps } from "./data.mjs";
export { ADMIN_ACTS, ADMIN_SCREENS } from "./admin.mjs";
export { START_ROUTES, MATCH_KINDS, MATCHES_MAX, PARTS_MAX, matchesOf, proposeStart, checkStartProposal } from "./start.mjs";
export { checkDraft, writingHelpAt, helpRefusedActs, isReasonField, factsOf, sentencesOf, FIRSTHAND_ACTS, HELP_NAMED_REFUSED, HELP_SET_TIME_REFUSED,
         WRITING_HELP_NAMED, TOLD_MAX, KEPT_AWAY } from "./writing-help.mjs";

/* ---------------------------------------------------------------- the vocabularies */

/** The Terms: a version's states. */
export const WIZARD_STATES = Object.freeze(["draft", "submitted", "approved", "updated", "withdrawn"]);
/** R1: where a script comes from (`imported` reserved, never written in this version; DEC-121 (8)). */
export const WIZARD_ORIGINS = Object.freeze(["civicsmith", "group", "imported"]);
/** R15: the events counted. There is no abandon event: stopping is a non-event (K1364 B4). */
export const WIZARD_EVENTS = Object.freeze(["start", "step", "finish"]);
/** R10: what `state` may ask for instead of the offered versions. */
export const WIZARDS_STATES_LISTED = Object.freeze(["draft", "submitted", "withdrawn", "retired", "broken", "proposed"]);
/** R2: a draft's three sources. */
export const DRAFT_SOURCES = Object.freeze(["text", "template", "machine"]);
/** R2: a step's keys (`via`, a side trip, since T34; DEC-139 (4)). */
export const STEP_KEYS = Object.freeze(["screen", "act", "what", "why", "draft", "via"]);
/** R13, R24: the two machine drafts whose exception for a refused act R12 does not grant (DEC-153 (4); K1818). */
export const HELP_DRAFTS = Object.freeze(["writinghelp", "groupdescriptiondraft"]);

/* ---------------------------------------------------------------- bounds */

export const WIZARD_NAME_MAX = 200;        // R1
export const STEP_TEXT_MAX = 300;          // R2: what, why
export const DRAFT_TEXT_MAX = 4000;        // R2: {text}
export const STEPS_MAX = 200;              // R2: a script's steps (a bound on what is stored)
export const PROPOSAL_WHY_MAX = 1000;      // R5
export const ENDING_REASON_MAX = 500;      // R9
export const WIZARDS_MAX = 200;            // R10
export const PAGE_MAX = 500;               // R13, R17
export const CANDIDATES_MAX = 20;          // R16
const NAME_FIELD_MAX = 200;                // a screen's, an act's, an op's or a code's name

const VERSION_RE = /^(.+)@([1-9][0-9]*)$/;
const WELL_FORMED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const TOKEN_RE = /^[A-Za-z0-9_.:-]{1,200}$/;
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const json = (v) => JSON.stringify(v ?? null);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const oneLine = (v, max) => typeof v === "string" && !!v.trim() && v.trim().length <= max && !/[\n\r]/.test(v) && !WELL_FORMED.test(v);
const textUpTo = (v, max, min = 1) => typeof v === "string" && v.trim().length >= min && v.length <= max && !WELL_FORMED.test(v);
const clamp = (v, dflt, max) => { const n = Math.floor(Number(v)); return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : dflt; };
const truthy = (v) => v === true || v === "true" || v === "1" || v === 1;
const OFFERED = Object.freeze(["approved"]);
/** R24, R27 (K2592; `ai-accounts` R7): the use a writing-help draft is, as the keep-away is asked of it. */
export const KEEP_AWAY_USE = "draft";
/** R34 (T47; N984; `run-rules` R29, `plane` R40's `DRAFT_KIND_OF`): the AI part a writing-help draft is, whose admission
 *  carries the test-instance label. */
export const WRITING_HELP_PART = "draft:own_words";
/* R4: how a revision that took a copy's base's newer version records it in `wiz_revisions.adopted` (a proposal id never
   starts so). */
const BASE_ADOPTION = "base:";

/* DEC-49: a refusal of this module's own carries its code, its row and the member's translation; one another module
   answered (membership's `NOT_AN_ADMIN`) passes through as it came. */
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string" || r.check) return r;
  const row = rowOf(r.reason);
  return row ? { ...r, code: r.code ?? r.reason, check: row.check, translation: row.translation } : r;
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, code, detail, ...(extra || {}) });

/** A version's id, `<script>@<version>` (the Terms). */
export const versionId = (script, version) => `${script}@${version}`;
/** The parts of a version id, or null. */
export function parseVersionId(v) {
  const m = typeof v === "string" ? VERSION_RE.exec(v.trim()) : null;
  return m ? { script: m[1], version: Number(m[2]) } : null;
}

/* ================================================================ steps (R1, R2) */

/* A draft's canonical form: exactly one of R2's three sources, or null for anything else. */
function canonicalDraft(d) {
  if (!isObj(d)) return null;
  const keys = Object.keys(d);
  if (keys.length !== 1 || !DRAFT_SOURCES.includes(keys[0])) return null;
  const v = d[keys[0]];
  if (keys[0] === "text") return typeof v === "string" ? { text: v } : null;
  return typeof v === "string" && v.trim() ? { [keys[0]]: v.trim() } : null;
}
/* A step in canonical form: R2's keys in R2's order, `act` null when none, `draft` and `via` only when present (so a
   step without them hashes as it did before `via`, T34). */
function canonicalStep(s) {
  const o = isObj(s) ? s : {};
  const out = { screen: typeof o.screen === "string" ? o.screen : null,
                act: typeof o.act === "string" && o.act !== "" ? o.act : null,
                what: typeof o.what === "string" ? o.what : "", why: typeof o.why === "string" ? o.why : "" };
  if (o.draft !== undefined && o.draft !== null) out.draft = canonicalDraft(o.draft) ?? o.draft;
  if (o.via !== undefined && o.via !== null && o.via !== "") out.via = typeof o.via === "string" ? o.via.trim() : o.via;
  return out;
}
/** R1: the steps in canonical form, as stored and hashed. */
export function canonicalSteps(steps) { return (Array.isArray(steps) ? steps : []).map(canonicalStep); }
/** R1: the SHA-256 (lowercase hex) of the steps in canonical form. */
export function stepsSha(steps) { return sha256HexSync(JSON.stringify(canonicalSteps(steps))); }
/* A step's `(screen, act)` pair, as a key. */
const pairKey = (s) => `${isObj(s) && typeof s.screen === "string" ? s.screen : ""}\u0000${isObj(s) && typeof s.act === "string" ? s.act : ""}`;
const startOf = (steps) => (Array.isArray(steps) && steps.length && isObj(steps[0]) && typeof steps[0].screen === "string" ? steps[0].screen : null);

/* R2's shape (R4, R5's `WIZARD_STEP_REFUSED`): the first step that is not a step, numbered from 1, with why; or null. A
   draft may leave `what` and `why` empty (R12 judges that); a draft's source must be one of the three. */
function stepShape(steps) {
  if (!Array.isArray(steps)) return { step: null, why: word("wizard-scripts.why.steps_list") };
  if (steps.length > STEPS_MAX) return { step: null, why: word("wizard-scripts.refusal.steps_at_most", { max: STEPS_MAX }) };
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], n = i + 1;
    if (!isObj(s)) return { step: n, why: "a step is {screen, act, what, why, draft?, via?}" };
    const extra = Object.keys(s).find((k) => !STEP_KEYS.includes(k));
    if (extra) return { step: n, why: `a step carries only screen, act, what, why, draft and via, not '${extra.slice(0, 40)}'` };
    if (s.via !== undefined && s.via !== null && s.via !== "" && !oneLine(s.via, NAME_FIELD_MAX)) return { step: n, why: word("wizard-scripts.why.side_trip_names") };
    if (!oneLine(s.screen, NAME_FIELD_MAX)) return { step: n, why: word("wizard-scripts.why.step_names_screen") };
    if (s.act !== undefined && s.act !== null && !oneLine(s.act, NAME_FIELD_MAX)) return { step: n, why: word("wizard-scripts.why.act_op_name") };
    for (const k of ["what", "why"])
      if (s[k] !== undefined && s[k] !== null && !textUpTo(s[k], STEP_TEXT_MAX, 0))
        return { step: n, why: word("wizard-scripts.refusal.step_text_length", { field: k, max: STEP_TEXT_MAX }) };
    if (s.draft !== undefined && s.draft !== null) {
      const d = canonicalDraft(s.draft);
      if (!d) return { step: n, why: "a draft is one of {text}, {template} or {machine}" };
      if (d.text !== undefined && !textUpTo(d.text, DRAFT_TEXT_MAX)) return { step: n, why: word("wizard-scripts.refusal.draft_text_length", { max: DRAFT_TEXT_MAX }) };
    }
  }
  return null;
}

/* ================================================================ the registration (R13) */

const nameSet = (v) => {
  if (v instanceof Set) return new Set([...v].filter((x) => typeof x === "string"));
  if (Array.isArray(v)) return new Set(v.map((x) => (typeof x === "string" ? x : isObj(x) ? x.op ?? x.name ?? null : null)).filter((x) => typeof x === "string"));
  if (isObj(v)) return new Set(Object.keys(v));
  return new Set();
};
/* One version of a library entry: its number, steps, author and approval (R1, R22). */
function libraryVersion(v) {
  const n = Math.floor(Number(v.version));
  return Object.freeze({ version: Number.isFinite(n) && n >= 1 ? n : 1, steps: canonicalSteps(v.steps), author: str(v.author) ?? "civicsmith",
                         approved: isObj(v.approved) ? { by: v.approved.by ?? null, at: v.approved.at ?? null,
                                                          ...(v.approved.ruling ? { ruling: v.approved.ruling } : {}) } : { by: null, at: null } });
}
/* A library entry as R1 holds it, or null for one that is not an entry: its latest version (`version`, `steps`,
   `author`, `approved`) and every version, `versions`, oldest first, each earlier one `updated` by the next (R22's
   adopted versions, K2241; R7's rule). */
function libraryEntry(e) {
  if (!isObj(e) || !str(e.id)) return null;
  const latest = libraryVersion(e);
  const earlier = (Array.isArray(e.earlier) ? e.earlier : []).filter(isObj).map(libraryVersion).filter((v) => v.version < latest.version);
  const versions = [...new Map([...earlier, latest].map((v) => [v.version, v])).values()].sort((a, b) => a.version - b.version);
  return Object.freeze({ id: str(e.id), name: typeof e.name === "string" ? e.name : "", required: e.required === true, ...latest,
                         versions: Object.freeze(versions) });
}
/* R13: a screen's registered acts: its `acts`, and each `owed` act whose op the member op table declares, at its place
   in the file's order (DEC-148; K1785); with no op table, no owed act is registered. With an op table (T37; N776,
   K2171), an act whose op the table does not hold is not registered either, owed or not, so the screens registered,
   `wizardsAt` and R12 answer one registry: no screen lists an act R12 refuses as unknown. */
function screenActs(s, ops) {
  const acts = Array.isArray(s.acts) ? [...s.acts] : [...nameSet(s.acts)];
  const owed = (Array.isArray(s.owed) ? s.owed : []).filter((o) => isObj(o) && typeof o.op === "string" && ops && ops.has(o.op));
  owed.slice().sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)).forEach((o, i) => {
    acts.splice(Math.min(Math.max(Number(o.at) || 0, 0), acts.length - i) + i, 0, o.op);
  });
  return nameSet(ops ? acts.filter((a) => ops.has(a)) : acts);
}
/** R13: a registration's parts, normalised: the screens by id, the ops (null when none was given), the acts a machine is
 *  refused, the labelled machine drafts and the library. */
export function normaliseRegistration({ screens = [], ops = null, machineRefused = [], machineDrafts = [], irreversible = [],
                                        library = [], adminActs = [], adminScreens = [] } = {}) {
  const opSet = ops === null || ops === undefined ? null : nameSet(ops);
  const sc = new Map();
  for (const s of Array.isArray(screens) ? screens : [])
    if (isObj(s) && str(s.id) && !sc.has(str(s.id))) sc.set(str(s.id), screenActs(s, opSet));
  const lib = [];
  for (const e of Array.isArray(library) ? library : []) { const x = libraryEntry(e); if (x && !lib.some((y) => y.id === x.id)) lib.push(x); }
  /* R13 (T45; Actions D25, D26): a labelled machine draft is registered once its op is declared: with an op table, one
     whose op the table does not hold is not registered (as an act is not, T37), so `{machine: <op>}` for it is refused
     until `op-declarations` declares it, and accepted with no change here once it does. */
  const drafts = nameSet(machineDrafts);
  const reg = { screens: sc, ops: opSet, machineRefused: nameSet(machineRefused),
                machineDrafts: opSet ? new Set([...drafts].filter((o) => opSet.has(o))) : drafts,
                irreversible: nameSet(irreversible), library: lib, adminActs: nameSet(adminActs), adminScreens: nameSet(adminScreens) };
  reg.helpRefused = helpRefusedActs(reg);
  reg.withheld = withheldLibrary(reg);
  return reg;
}
/* R11 (K1883): the library scripts R12 refuses against the registration, by id: not offered until they pass, as R13
   withholds a group's. A `{template}` draft is judged here by shape, as R14 judges it (whether a template is offered is
   judged at each read, for its viewer: `#libraryWithheld`, R22), and a side trip against the whole
   library, as R14 judges it: R11's grounds are a script's own acts and screens, so a required flow is never withheld
   because an optional script it visits is (the side trip to a script not offered is the runner's to skip). */
function withheldLibrary(reg) {
  const offered = reg.library.map((e) => ({ id: e.id, steps: e.steps }));
  return new Set(reg.library.filter((e) => checkScript(e.steps, { ...reg, offered, self: e.id }).refusals.length).map((e) => e.id));
}

/* ================================================================ R12: checkScript */

const finding = (code, step, detail, extra) => {
  const row = WIZARD_SCRIPTS_CHECKS[code];
  return { code, step, check: row.check, translation: row.translation, detail, ...(extra || {}) };
};

/* R12's WIZARD_VIA_REFUSED: why a side trip from the script `self` (its steps `steps`) to `via` would not return, or null.
   `offered` maps each offered script's id to its steps; a side trip whose own steps lead back to `self` through `via`,
   however far, never returns (DEC-139 (4)). */
function viaRefusal(via, self, steps, offered) {
  if (typeof via !== "string" || !via.trim()) return word("wizard-scripts.why.side_trip_names");
  if (self !== null && via === self) return word("wizard-scripts.text.side_trip_go");
  if (!offered.has(via)) return word("wizard-scripts.refusal.side_trip_not_offered", { script: via.slice(0, 80) });
  const seen = new Set(), queue = [via];
  const graph = (id) => (id === self ? steps : offered.get(id) || []);
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const t of graph(id)) {
      const next = isObj(t) && typeof t.via === "string" ? t.via : null;
      if (next === null) continue;
      if (self !== null && next === self) return word("wizard-scripts.refusal.side_trip_loops_back", { script: via.slice(0, 80) });
      queue.push(next);
    }
  }
  return null;
}

/** R12 (pure; `op=wizardcheck`): the refusals and warnings of a step list against a registration, each naming its step
 *  (from 1; null for the list). `templateOffered(ref)`, when given, says whether a `{template}` draft names a version
 *  filing-templates offers (its R25); `offered` is the offered scripts, `[{id, steps}]`, for `WIZARD_DUPLICATE` and a
 *  step's side trip (`via`); `self` the id of the script checked, if it has one. Never throws on a list; never writes. */
export function checkScript(steps, { screens = [], ops = null, machineRefused = [], machineDrafts = [], irreversible = [], offered = [],
                                     templateOffered = null, self = null } = {}) {
  const reg = screens instanceof Map ? { screens, ops: ops instanceof Set || ops === null ? ops : nameSet(ops),
                                         machineRefused: nameSet(machineRefused), machineDrafts: nameSet(machineDrafts) }
    : normaliseRegistration({ screens, ops, machineRefused, machineDrafts, irreversible });
  if (reg.ops) reg.machineDrafts = new Set([...reg.machineDrafts].filter((o) => reg.ops.has(o)));   /* R13: once declared */
  reg.helpRefused = helpRefusedActs({ machineRefused: reg.machineRefused, irreversible: irreversible instanceof Set ? irreversible : nameSet(irreversible) });
  const offeredById = new Map((Array.isArray(offered) ? offered : []).filter((o) => isObj(o) && typeof o.id === "string" && o.id !== self)
    .map((o) => [o.id, Array.isArray(o.steps) ? o.steps : []]));
  const refusals = [], warnings = [];
  /* DEC-49 REGION is-wizard-check */
  if (!Array.isArray(steps) || !steps.length) {
    refusals.push(finding("WIZARD_NO_STEPS", null, word("wizard-scripts.refusal.needs_one_step")));
    return { refusals, warnings };
  }
  steps.forEach((raw, i) => {
    const n = i + 1;
    const s = isObj(raw) ? raw : {};
    const acts = typeof s.screen === "string" ? reg.screens.get(s.screen) : undefined;
    if (!acts) refusals.push(finding("WIZARD_SCREEN_UNKNOWN", n, word("wizard-scripts.refusal.screen_unknown", { screen: String(s.screen ?? "").slice(0, 80) })));
    else if (s.act !== undefined && s.act !== null && s.act !== ""
             && (typeof s.act !== "string" || !acts.has(s.act) || (reg.ops && !reg.ops.has(s.act))))
      refusals.push(finding("WIZARD_ACT_UNKNOWN", n, word("wizard-scripts.refusal.act_unknown", { screen: s.screen, act: String(s.act).slice(0, 80) })));
    if (typeof s.what !== "string" || !s.what.trim() || typeof s.why !== "string" || !s.why.trim())
      refusals.push(finding("WIZARD_STEP_NO_WHY", n, word("wizard-scripts.refusal.step_needs_what_why")));
    if (s.draft !== undefined && s.draft !== null) {
      const d = canonicalDraft(s.draft);
      const ok = !!d && (d.text !== undefined ? textUpTo(d.text, DRAFT_TEXT_MAX)
        : d.template !== undefined ? (typeof templateOffered === "function" ? safe(() => templateOffered(d.template)) === true : true)
        : reg.machineDrafts.has(d.machine));
      if (!ok) refusals.push(finding("WIZARD_DRAFT_REFUSED", n, !d ? "a draft is one of {text}, {template} or {machine}"
        : d.template !== undefined ? word("wizard-scripts.refusal.template_not_offered", { template: d.template.slice(0, 80) })
        : d.machine !== undefined ? `'${d.machine.slice(0, 80)}' is not a registered machine draft` : word("wizard-scripts.refusal.draft_text_length_check", { max: DRAFT_TEXT_MAX })));
    }
    if (s.via !== undefined && s.via !== null && s.via !== "") {
      const why = viaRefusal(s.via, typeof self === "string" ? self : null, steps, offeredById);
      if (why) refusals.push(finding("WIZARD_VIA_REFUSED", n, why));
    }
    if (s.draft !== undefined && s.draft !== null) {
      const d = canonicalDraft(s.draft);
      const help = !!d && d.machine !== undefined && HELP_DRAFTS.includes(d.machine);
      const allowed = !!d && d.machine !== undefined && reg.machineDrafts.has(d.machine) && !help;
      if (typeof s.act === "string" && help && reg.helpRefused.has(s.act))
        refusals.push(finding("WIZARD_STEP_CONCLUDES", n, word("wizard-scripts.refusal.assistant_never_helps_act", { act: s.act })));
      else if (typeof s.act === "string" && reg.machineRefused.has(s.act) && !allowed && !help)
        refusals.push(finding("WIZARD_STEP_CONCLUDES", n, word("wizard-scripts.refusal.act_refused_to_machine", { act: s.act })));
    }
  });
  if (steps.length === 1) warnings.push(finding("WIZARD_TRIVIAL", null, word("wizard-scripts.warning.single_step")));
  const mine = steps.map(pairKey).join("\u0001");
  for (const o of Array.isArray(offered) ? offered : []) {
    if (isObj(o) && Array.isArray(o.steps) && o.steps.map(pairKey).join("\u0001") === mine) {
      warnings.push(finding("WIZARD_DUPLICATE", null, word("wizard-scripts.warning.duplicate_script"), { script: o.id ?? null }));
      break;
    }
  }
  /* END DEC-49 REGION is-wizard-check */
  return { refusals, warnings };
}
function safe(fn) { try { return fn(); } catch { return null; } }

/** R14 (pure; the plane's release suite): each required script of the library that R12 refuses, with its first
 *  refusal; `[]` when every one passes. A `{template}` draft is judged by shape only: no filing template is held at
 *  release. */
export function requiredFailures({ screens = [], ops = null, machineRefused = [], machineDrafts = [], irreversible = [], library = [] } = {}) {
  const reg = normaliseRegistration({ screens, ops, machineRefused, machineDrafts, irreversible, library });
  const offered = reg.library.map((e) => ({ id: e.id, steps: e.steps }));
  const out = [];
  for (const e of reg.library) {
    if (!e.required) continue;
    const { refusals } = checkScript(e.steps, { ...reg, offered, self: e.id });
    if (refusals.length) out.push({ id: e.id, version: versionId(e.id, e.version), name: e.name, refusal: refusals[0] });
  }
  return out;
}

/* R37 (T48; DEC-227 (4)): the pointer of the `elsewhere` route as the registered provider answers it: `{places, pointers}`,
   `places` the active places' names (`[]` when the group follows none) and `pointers` objects passed through as given;
   any other answer (a string included) is null. */
function pointerOf(v) {
  if (!isObj(v) || !Array.isArray(v.places) || !Array.isArray(v.pointers)) return null;
  if (!v.places.every((x) => typeof x === "string") || !v.pointers.every(isObj)) return null;
  return { places: [...v.places], pointers: [...v.pointers] };
}

/* ================================================================ the module */

export class WizardScripts {
  constructor({ storage, record, membership, filingTemplates = null, accounts = null, aiRuns = null, now = null, env = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.templates = filingTemplates;
    this.accounts = accounts;         /* ai-accounts, or a function reaching it on first need */
    this.aiRuns = aiRuns;             /* R34: likewise */
    this.now = typeof now === "function" ? now : null;
    this.env = env && typeof env === "object" ? env : {};
    this.reg = null;
    this.door = null;   /* R23: the front door's finder and pointer, handed in at registration */
  }

  migrate() { migrateWizardScripts(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #call(fn, dflt = null) { try { return fn(); } catch { return dflt; } }
  #nowMs() {
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env.BIO_NOW_MS);
    return Number.isFinite(v) && v >= 0 ? v : Date.now();
  }
  #when() { return stampInstant("second", this.#nowMs()); }
  /* R15, R16: the day, and nothing finer. */
  #day() { return this.#when().slice(0, 10); }
  #registration() { return this.reg || normaliseRegistration({}); }
  /* R24 item 1 (T37; N765, K231; T48, N996): `ai-accounts.aiKeptAway({use: "draft"})` (its R7) as it answers now: null, or
     its AI_KEPT_AWAY refusal; a keep-away covering only other uses (`ask`) does not refuse a draft (R27; K2592). An
     ai-accounts that cannot be reached or answers by throwing is no reading of null: it answers `KEPT_AWAY_UNREADABLE`,
     that one site's own unreadable form, which R24 reads as kept away (fail closed, K2093). */
  #keptAway() {
    try {
      if (typeof this.accounts === "function") this.accounts = this.accounts();
      const c = this.accounts;
      return c && typeof c.aiKeptAway === "function" ? c.aiKeptAway({ use: KEEP_AWAY_USE }) : KEPT_AWAY_UNREADABLE;
    } catch { return KEPT_AWAY_UNREADABLE; }
  }

  /* R34 (T47; N984; `ai-runs` R78, `run-rules` R29): the test-instance label of a writing-help draft, read at the call:
     the label `ai-runs.partAdmitted(WRITING_HELP_PART)` answers, as given and never composed here, when the part is
     admitted on the exception; null when the bar admits it, or off a test instance. A read that throws, or any other
     answer (the part not admitted, which `ai-runs` also answers for a record it cannot read), answers `run-rules`'
     label whenever `ai-runs.testInstance()` answers true: on a test instance an output is never left unmarked. An
     ai-runs that cannot be reached answers null. Writes nothing; never throws. */
  #untested() {
    let ai = null;
    try {
      if (typeof this.aiRuns === "function") this.aiRuns = this.aiRuns();
      ai = this.aiRuns;
    } catch { return null; }
    if (!ai) return null;
    let said = null;
    try { said = ai.partAdmitted(WRITING_HELP_PART); } catch { said = null; }
    if (said && said.admitted === true && isObj(said.untested)) return said.untested;
    if (said && said.admitted === true && (said.untested === null || said.untested === undefined)) return null;   /* the bar admits it */
    try { return ai.testInstance() === true ? untestedLabel(WRITING_HELP_PART) : null; } catch { return null; }
  }

  /* ================================================================ who acts (R18, R19) */

  #member(identity) {
    if (!str(identity) || isMachineIdentity(identity)) return null;
    return this.#call(() => this.membership.positionalMember(null, String(identity).trim()));
  }
  #nameOf(memberId) {
    const f = this.#call(() => this.membership.memberFacts(memberId));
    return (f && str(f.handle)) || memberId;
  }
  #isAdmin(memberId) { return !!memberId && this.#call(() => this.membership.isAdministrator(memberId)) === true; }
  #isOwner(project, memberId) { return !!memberId && !!project && this.#call(() => this.membership.isProjectOwner(project, memberId)) === true; }
  #joined(project, memberId) { return !!memberId && !!project && this.#call(() => this.membership.isJoinedParticipant(project, memberId)) === true; }

  /* R19: a machine, or a call stamped with nobody, is refused by shape before anything else is asked. */
  #machine(act, who) {
    if (str(who) && !isMachineIdentity(who)) return null;
    /* DEC-49 REGION is-wizard-member */
    return refuse(act === "approve" ? "MACHINE_CANNOT_APPROVE_WIZARD" : "MACHINE_CANNOT_DRAFT_WIZARD", str(who)
      ? `'${String(who).trim().slice(0, 60)}' is a machine identity: a machine proposes steps, labelled, and nothing else`
      : "no member is named as the one acting: this call carries nobody");
    /* END DEC-49 REGION is-wizard-member */
  }

  /* ================================================================ the one-condition answers */

  /* R20: absent and invisible are one answer. */
  #noWizard(asked) {
    /* DEC-49 REGION is-no-such-wizard */
    return refuse("NO_SUCH_WIZARD", word("wizard-scripts.refusal.no_such_script"),
                  { script: typeof asked === "string" ? (parseVersionId(asked)?.script ?? str(asked)) : null });
    /* END DEC-49 REGION is-no-such-wizard */
  }
  #scope(s, detail) {
    /* DEC-49 REGION is-wizard-scope */
    return refuse("WIZARD_SCOPE_REFUSED", detail, { script: s ? s.id : null });
    /* END DEC-49 REGION is-wizard-scope */
  }
  #notGranted(detail) {
    /* DEC-49 REGION is-wizard-editor */
    return refuse("WIZARD_EDITOR_NOT_GRANTED", detail);
    /* END DEC-49 REGION is-wizard-editor */
  }
  #notADraft(s, n, state) {
    /* DEC-49 REGION is-wizard-not-a-draft */
    return refuse("NOT_A_DRAFT", word("wizard-scripts.refusal.not_a_draft", { state }), { version: versionId(s.id, n), state });
    /* END DEC-49 REGION is-wizard-not-a-draft */
  }
  #notAnApprover(s, detail) {
    /* DEC-49 REGION is-wizard-not-an-approver */
    return refuse("NOT_AN_APPROVER", detail, { script: s.id });
    /* END DEC-49 REGION is-wizard-not-an-approver */
  }
  #notTheGroups(s) {
    /* DEC-49 REGION is-wizard-civicsmith */
    return refuse("WIZARD_NOT_THE_GROUPS", word("wizard-scripts.refusal.civicsmith_read_only"),
                  { script: s.id, origin: "civicsmith" });
    /* END DEC-49 REGION is-wizard-civicsmith */
  }
  #ended(s, ended, extra) {
    /* DEC-49 REGION is-wizard-ended */
    return refuse("WIZARD_ALREADY_ENDED", ended.ending === "retired" ? word("wizard-scripts.refusal.script_already_retired") : word("wizard-scripts.refusal.version_already_withdrawn"),
                  { script: s.id, ...(extra || {}), ended });
    /* END DEC-49 REGION is-wizard-ended */
  }
  #stepRefusal(bad) {
    /* DEC-49 REGION is-wizard-step */
    return refuse("WIZARD_STEP_REFUSED", bad.why, { step: bad.step });
    /* END DEC-49 REGION is-wizard-step */
  }
  #useRefusal(detail) {
    /* DEC-49 REGION is-wizard-use */
    return refuse("WIZARD_USE_REFUSED", detail);
    /* END DEC-49 REGION is-wizard-use */
  }
  /* R6, R7: R12's refusals as one answer: the first, naming its step, with every one. */
  static #checked(refusals, warnings, extra) {
    const first = refusals[0];
    return { ok: false, reason: first.code, code: first.code, check: first.check, translation: first.translation,
             step: first.step, detail: first.detail, refusals, warnings, ...(extra || {}) };
  }

  /* ================================================================ scripts and their sight (R1, R20) */

  #groupScript(id) {
    const r = typeof id === "string" ? this.#one(`SELECT * FROM wiz_scripts WHERE script_id=?`, id) : null;
    if (!r) return null;
    const ev = (e) => this.#one(`SELECT actor, actor_name, detail, at FROM wiz_events WHERE script_id=? AND version IS NULL
                                  AND event=? ORDER BY eid LIMIT 1`, r.script_id, e);
    const end = (e) => (e ? { by: { id: e.actor, name: e.actor_name }, at: e.at, ...(parse(e.detail) || {}) } : null);
    const w = ev("widened"), x = ev("retired");
    const c = this.#one(`SELECT based_on FROM wiz_copies WHERE script_id=?`, r.script_id);
    return { id: r.script_id, origin: "group", name: r.name, project: r.project, bundle_id: r.bundle_id,
             scope: w ? "group" : { project: r.project }, required: false, widened: end(w), retired: end(x),
             created_at: r.created_at, created_by: { id: r.created_by, name: r.created_name }, based_on: c ? c.based_on : null };
  }
  #libraryScript(id) {
    const e = this.#registration().library.find((x) => x.id === id);
    return e ? { id: e.id, origin: "civicsmith", name: e.name, project: null, bundle_id: null, scope: "group",
                 required: e.required, widened: null, retired: null, created_at: e.approved.at ?? "", entry: e, based_on: null } : null;
  }
  /* R1, R10, R21: a script's `based_on` with its base's name, `{version, name}`, or null (DEC-158 (4)). A base the viewer
     may not see is named by neither (R20): the copy still shows it is one, `{version: null, name: null}`. */
  #basedOn(s, viewer) {
    if (!s || !s.based_on) return null;
    const p = parseVersionId(s.based_on);
    const b = p ? this.#groupScript(p.script) || this.#libraryScript(p.script) : null;
    return b && this.#canSee(b, viewer) ? { version: s.based_on, name: b.name } : { version: null, name: null };
  }
  /* R20: a project's script is seen by whoever may see its project; a group or Civicsmith script by every member. */
  #canSee(s, viewer) {
    if (!s) return false;
    if (s.origin === "civicsmith" || s.widened) return viewerPredicate(viewer).scope !== "DENY";
    return !!s.bundle_id && this.#call(() => this.membership.inSight(s.bundle_id, viewer)) === true;
  }
  #script(id, viewer) {
    const key = str(id);
    if (!key) return null;
    const s = this.#groupScript(key) || this.#libraryScript(key);
    return s && this.#canSee(s, viewer) ? s : null;
  }
  /* R7, R9: who approves and retires: an administrator for a group-wide script, else an owner of its project. */
  #mayApprove(s, memberId) { return s.widened ? this.#isAdmin(memberId) : this.#isOwner(s.project, memberId); }

  /* ================================================================ versions (R1) */

  #events(sid) { return this.#rows(`SELECT * FROM wiz_events WHERE script_id=? ORDER BY eid`, sid); }
  #stateOf(events, n) {
    const has = (e) => events.some((x) => x.version === n && x.event === e);
    return has("withdrawn") ? "withdrawn" : has("updated") ? "updated" : has("approved") ? "approved"
      : has("submitted") ? "submitted" : "draft";
  }
  #numbers(sid) { return this.#rows(`SELECT version FROM wiz_versions WHERE script_id=? ORDER BY version`, sid).map((r) => r.version); }
  #latestRevision(sid, n) { return this.#one(`SELECT * FROM wiz_revisions WHERE script_id=? AND version=? ORDER BY rid DESC LIMIT 1`, sid, n); }
  #steps(s, n) {
    if (s.origin === "civicsmith") return (WizardScripts.#libVersion(s, n) || { steps: [] }).steps.map((x) => ({ ...x }));
    const r = this.#latestRevision(s.id, n);
    return r ? parse(r.steps) || [] : [];
  }
  #versionOf(s, asked) {
    const p = parseVersionId(asked);
    const n = p ? (p.script === s.id ? p.version : null)
      : /^[1-9][0-9]*$/.test(String(asked ?? "").trim()) ? Number(String(asked).trim()) : null;
    if (n === null) return null;
    if (s.origin === "civicsmith") return WizardScripts.#libVersion(s, n) ? n : null;
    return this.#one(`SELECT 1 AS x FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n) ? n : null;
  }
  #resolve(asked, viewer) {
    const p = parseVersionId(asked);
    const s = p ? this.#script(p.script, viewer) : null;
    const n = s ? this.#versionOf(s, asked) : null;
    return s && n !== null ? { s, n } : null;
  }
  #latestApproved(s, events) {
    if (s.origin === "civicsmith") return s.entry.version;
    const ns = this.#numbers(s.id).filter((n) => this.#stateOf(events, n) === "approved");
    return ns.length ? ns[ns.length - 1] : null;
  }
  /* R13: whether a group version stands broken (its last break-log row a break). */
  #isBroken(sid, n) {
    const r = this.#one(`SELECT event FROM wiz_breaks WHERE script_id=? AND version=? ORDER BY bid DESC LIMIT 1`, sid, n);
    return !!r && r.event === "broken";
  }
  /* R22: a library script's version `n`, or null; its state: the latest `approved`, an earlier one `updated` (R7). */
  static #libVersion(s, n) { return s.entry.versions.find((v) => v.version === n) || null; }
  static #libState(s, n) { return n === s.entry.version ? "approved" : WizardScripts.#libVersion(s, n) ? "updated" : null; }
  /* The state of version `n` of any script. */
  #stateAt(s, n) { return s.origin === "civicsmith" ? WizardScripts.#libState(s, n) : this.#stateOf(this.#events(s.id), n); }

  /* The Terms: the offered version's number to `viewer`, or null (retired, none approved, broken, or a library script
     R11 withholds from this viewer). */
  #offeredNumber(s, events = null, viewer = null) {
    if (s.retired) return null;
    const n = this.#latestApproved(s, events ?? (s.origin === "civicsmith" ? [] : this.#events(s.id)));
    if (n === null) return null;
    if (s.origin === "civicsmith") return this.#libraryWithheld(s, viewer) ? null : n;
    return this.#isBroken(s.id, n) ? null : n;
  }
  /* R11, R22 (K1883; T45, N858, K2781 (6)): a library script is withheld while R12 refuses it against the registration
     (`withheld`, judged once at registration) or while one of its `{template}` drafts names no template filing-templates
     offers this viewer (its R25, R26: "Get a record"'s `@records-request` until a profile offers a template of that
     handle), judged at each read, so it is offered once one is, the library data unchanged. */
  #libraryWithheld(s, viewer) {
    if (this.#registration().withheld.has(s.id)) return true;
    return s.entry.steps.some((t) => {
      const d = isObj(t) ? canonicalDraft(t.draft) : null;
      return !!d && d.template !== undefined && !this.#templateOffered(d.template, viewer);
    });
  }

  /* R5: every member who revised the version and every adopted proposal's run, in time order, each dated. Only a
     version's author revises it (R4), so another member contributes by a proposal the author adopts (or drafts from):
     a member's proposal is that member's contribution, a machine's a run's (R7's APPROVER_IS_AUTHOR reads them). */
  #contributors(sid, n) {
    const out = [], members = new Set();
    for (const r of this.#rows(`SELECT author, author_name, adopted, at FROM wiz_revisions WHERE script_id=? AND version=?
                                 ORDER BY rid`, sid, n)) {
      if (!members.has(r.author)) { members.add(r.author); out.push({ kind: "member", member: r.author, name: r.author_name, at: r.at }); }
      if (r.adopted && !out.some((c) => c.proposal === r.adopted)) {
        const p = this.#one(`SELECT * FROM wiz_proposals WHERE proposal_id=?`, r.adopted);
        const m = p ? this.#member(p.proposer) : null;
        if (p && m) {
          members.add(m);
          out.push({ kind: "member", member: m, name: this.#nameOf(m), proposal: p.proposal_id, label: WizardScripts.#label(p.proposer), at: r.at });
        } else if (p) out.push({ kind: "run", proposal: p.proposal_id, run: p.run ?? null, model: p.model ?? null,
                                 label: WizardScripts.#label(p.proposer), at: r.at });
      }
    }
    return out;
  }
  /* R5: the proposal's label, `proposalLabel(proposer, "wizard")` (record-grammar R42). */
  static #label(proposer) {
    try { return proposalLabel(proposer, "wizard"); } catch { return null; }
  }

  /* R1: one version whole, with its attribution. */
  #versionView(s, n, events) {
    if (s.origin === "civicsmith") {
      const e = WizardScripts.#libVersion(s, n);
      const next = s.entry.versions.find((v) => v.version > n);
      return { id: versionId(s.id, n), script: s.id, version: n, steps: this.#steps(s, n), sha: stepsSha(e.steps), state: WizardScripts.#libState(s, n),
               author: { name: e.author }, contributors: [], derived_from: null,
               approved: { by: { name: e.approved.by }, at: e.approved.at, ...(e.approved.ruling ? { ruling: e.approved.ruling } : {}) },
               updated_by: next ? versionId(s.id, next.version) : null, ended: null, submitted: null,
               revisions: [], recorded: null, created_at: e.approved.at, broken: false };
    }
    const v = this.#one(`SELECT * FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    const rev = this.#latestRevision(s.id, n);
    const ev = (e) => events.find((x) => x.version === n && x.event === e) || null;
    const by = (e) => ({ id: e.actor, name: e.actor_name });
    const ap = ev("approved"), up = ev("updated"), wd = ev("withdrawn"), sub = ev("submitted");
    return {
      id: versionId(s.id, n), script: s.id, version: n, steps: parse(rev.steps) || [], sha: rev.sha, state: this.#stateOf(events, n),
      author: { id: v.author, name: v.author_name }, contributors: this.#contributors(s.id, n), derived_from: parse(v.derived_from),
      approved: ap ? { by: by(ap), at: ap.at } : null,
      updated_by: up ? versionId(s.id, (parse(up.detail) || {}).by) : null,
      ended: wd ? { ending: "withdrawn", by: by(wd), at: wd.at, reason: (parse(wd.detail) || {}).reason ?? null }
        : s.retired ? { ending: "retired", ...s.retired } : null,
      submitted: sub ? { by: by(sub), at: sub.at } : null,
      revisions: this.#rows(`SELECT sha, author, author_name, adopted, at FROM wiz_revisions WHERE script_id=? AND version=? ORDER BY rid`, s.id, n)
        .map((r) => ({ sha: r.sha, by: { id: r.author, name: r.author_name }, ...WizardScripts.#adoptedView(r.adopted), at: r.at })),
      recorded: parse(v.recorded), created_at: v.created_at, broken: this.#isBroken(s.id, n),
    };
  }
  #head(s, viewer, extra = {}) {
    return { id: s.id, origin: s.origin, name: s.name, scope: s.scope, required: s.required, based_on: this.#basedOn(s, viewer),
             ...(s.widened ? { widened: s.widened } : {}), ...(s.retired ? { retired: s.retired } : {}), ...extra };
  }
  /* R4: a revision's adoption: a proposal (`adopted`), or a newer version of a copy's base (`adopted_base`). */
  static #adoptedView(a) {
    if (!a) return {};
    return a.startsWith(BASE_ADOPTION) ? { adopted_base: a.slice(BASE_ADOPTION.length) } : { adopted: a };
  }

  /* ================================================================ proposals (R5) */

  /* A proposal the viewer may see (one for a script as its script; one for a project as its project), or null. */
  #proposal(id, viewer) {
    const p = str(id) ? this.#one(`SELECT * FROM wiz_proposals WHERE proposal_id=?`, str(id)) : null;
    if (!p) return null;
    if (p.script_id) return this.#script(p.script_id, viewer) ? p : null;
    return this.#call(() => this.membership.inSight(p.project, viewer)) === true ? p : null;
  }

  /* R8: a member's live editor grant, or null. */
  #liveGrant(memberId) {
    return memberId ? this.#one(`SELECT g.* FROM wiz_editor_grants g WHERE g.member=?
                                   AND NOT EXISTS (SELECT 1 FROM wiz_editor_revocations r WHERE r.grant_id=g.grant_id)
                                   ORDER BY g.at, g.grant_id LIMIT 1`, memberId) : null;
  }

  /* Opaque ids (R1, R5, R8): never a counter; one already held here, or a Civicsmith script's, is drawn again. */
  #mint(prefix, year) {
    const lib = new Set(prefix === "WIZ" ? this.#registration().library.map((e) => e.id) : []);
    return this.record.mintOpaqueId(prefix, year, "", (id) => lib.has(id)
      || !!this.#one(`SELECT 1 AS x FROM wiz_scripts WHERE script_id=? UNION ALL SELECT 1 FROM wiz_proposals WHERE proposal_id=?
                      UNION ALL SELECT 1 FROM wiz_editor_grants WHERE grant_id=?`, id, id, id));
  }

  /* R4: the `(screen, act)` pairs a version may hold without a grant: the multiset union (each pair's largest count) of
     its recorded pairs, its source's (a version or proposal it was drafted from) and every adopted proposal's. */
  #allowedPairs(s, n, extra = []) {
    const v = this.#one(`SELECT recorded, derived_from FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    const lists = [parse(v.recorded) || []];
    const from = parse(v.derived_from);
    if (from && from.version) {
      const p = parseVersionId(from.version);
      const src = p ? this.#groupScript(p.script) || this.#libraryScript(p.script) : null;
      if (src) lists.push(this.#steps(src, p.version));
    }
    for (const r of this.#rows(`SELECT DISTINCT adopted FROM wiz_revisions WHERE script_id=? AND version=? AND adopted IS NOT NULL`, s.id, n)) {
      if (r.adopted.startsWith(BASE_ADOPTION)) {
        const b = parseVersionId(r.adopted.slice(BASE_ADOPTION.length));
        const src = b ? this.#groupScript(b.script) || this.#libraryScript(b.script) : null;
        if (src) lists.push(this.#steps(src, b.version));
        continue;
      }
      const p = this.#one(`SELECT steps FROM wiz_proposals WHERE proposal_id=?`, r.adopted);
      if (p) lists.push(parse(p.steps) || []);
    }
    lists.push(...extra);
    const allowed = new Map();
    for (const l of lists) {
      const c = new Map();
      for (const x of l) c.set(pairKey(x), (c.get(pairKey(x)) || 0) + 1);
      for (const [k, m] of c) allowed.set(k, Math.max(allowed.get(k) || 0, m));
    }
    return allowed;
  }
  static #within(steps, allowed) {
    const c = new Map();
    for (const x of steps) c.set(pairKey(x), (c.get(pairKey(x)) || 0) + 1);
    for (const [k, m] of c) if (m > (allowed.get(k) || 0)) return false;
    return true;
  }

  /* R12 against the registration: a `{template}` through filing-templates' R25 as `viewer` sees it, a ref beginning with
     `@` by its name's handle (its R26, in `project`, the script's, when it has one; K2021), an `<id>@<n>` ref split into
     template and version; the offered scripts `viewer` may see, for duplicates (the script itself left out). */
  #check(steps, viewer, self = null, project = null) {
    const reg = this.#registration();
    const templateOffered = (ref) => this.#templateOffered(ref, viewer, project);
    const offered = this.#offeredScripts(viewer).filter((x) => x.s.id !== self).map((x) => ({ id: x.s.id, steps: x.steps }));
    return checkScript(steps, { ...reg, offered, templateOffered, self });
  }
  /* R2, R12: whether filing-templates offers `viewer` the template a `{template}` draft names (its R25; by handle, R26). */
  #templateOffered(ref, viewer, project = null) {
    if (!this.templates || typeof ref !== "string") return false;
    const asked = ref.startsWith("@") ? { name: ref, ...(project ? { project } : {}) }
      : ref.includes("@") ? { template: ref.split("@")[0], version: ref.split("@")[1] } : { template: ref, version: null };
    const r = this.#call(() => this.templates.offeredVersion({ ...asked, viewer }));
    return !!r && r.ok === true;
  }
  /* The offered scripts `viewer` may see, each `{s, n, steps}`. */
  #offeredScripts(viewer) {
    const out = [];
    for (const e of this.#registration().library) {
      const s = this.#libraryScript(e.id);
      if (this.#canSee(s, viewer) && !this.#libraryWithheld(s, viewer)) out.push({ s, n: e.version, steps: this.#steps(s, e.version) });
    }
    for (const r of this.#rows(`SELECT script_id FROM wiz_scripts ORDER BY created_at, script_id`)) {
      const s = this.#groupScript(r.script_id);
      if (!this.#canSee(s, viewer)) continue;
      const n = this.#offeredNumber(s);
      if (n !== null) out.push({ s, n, steps: this.#steps(s, n) });
    }
    return out;
  }

  /* ================================================================ R13: registration */

  /** R13 (in-process; `plane` R19): the screen registry, the member op table, the acts a machine is refused, the labelled
   *  machine drafts and the Civicsmith library, once per construction, before the first request. Every offered group
   *  script is checked again: one that fails is recorded `broken` with its first refusal, one that passes again is
   *  recorded as returned. */
  wizardRegister({ screens = SCREEN_REGISTRY, ops = null, machineRefused = [], machineDrafts = [], irreversible = [],
                   library = CIVICSMITH_LIBRARY, door = null, adminActs = [], adminScreens = [] } = {}) {
    /* DEC-49 REGION is-wizard-register */
    if (this.reg) return refuse("WIZARD_ALREADY_REGISTERED", "the registration is made once per construction, and it was");
    /* END DEC-49 REGION is-wizard-register */
    this.reg = normaliseRegistration({ screens, ops, machineRefused, machineDrafts, irreversible, library, adminActs, adminScreens });
    /* R23: `door.findExisting(message, viewer)` (the existing work matching a message: `steps`' `stepsLike` and the
       record's search, as the plane composes them) and `door.pointer(viewer)` (the "not Civicsmith's" pointer, profile
       data), each optional, K31's pattern */
    const fn = (f) => (typeof f === "function" ? f : null);
    this.door = isObj(door) ? { findExisting: fn(door.findExisting), pointer: fn(door.pointer) } : { findExisting: null, pointer: null };
    const broken = [], returned = [];
    const at = this.#when();
    for (const r of this.#rows(`SELECT script_id FROM wiz_scripts ORDER BY created_at, script_id`)) {
      const s = this.#groupScript(r.script_id);
      if (s.retired) continue;
      const n = this.#latestApproved(s, this.#events(s.id));
      if (n === null) continue;
      const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
      const { refusals } = this.#check(this.#steps(s, n), `member:${v.author}`, s.id, s.project);
      const was = this.#isBroken(s.id, n);
      if (refusals.length && !was) {
        const first = { code: refusals[0].code, step: refusals[0].step, check: refusals[0].check, detail: refusals[0].detail };
        this.sql.exec(`INSERT INTO wiz_breaks (script_id, version, bundle_id, event, refusal, at) VALUES (?,?,?,?,?,?)`,
                      s.id, n, s.bundle_id, "broken", json(first), at);
        broken.push(versionId(s.id, n));
      } else if (!refusals.length && was) {
        this.sql.exec(`INSERT INTO wiz_breaks (script_id, version, bundle_id, event, refusal, at) VALUES (?,?,?,?,NULL,?)`,
                      s.id, n, s.bundle_id, "returned", at);
        returned.push(versionId(s.id, n));
      }
    }
    return { ok: true, screens: this.reg.screens.size, library: this.reg.library.length, broken, returned };
  }

  /** R13 (for `affordances` R37): the screen registry as registered, `[{id, acts}]` (an owed act among them once its op is
   *  declared); `[]` before registration. */
  registeredScreens() {
    return [...this.#registration().screens].map(([id, acts]) => ({ id, acts: [...acts] }));
  }

  /** R13 (for `queue-producers` R32; K1397): each break (`kind: "withdrawn"`) and each return (`"restored"`) of a script
   *  the viewer may see, `{script, version, kind, at, name, project, author, refusal}` (`version` the number, `project`
   *  null for a group-wide script, `author` the version's author, `refusal` the first refusal's `{code, check,
   *  translation}` or null for a return), at most 500 per page in (instant, version) order after `after` (a previous
   *  page's `cursor`). Writes nothing. */
  brokenScripts({ after = null, limit = null, viewer = null } = {}) {
    const max = clamp(limit, PAGE_MAX, PAGE_MAX);
    const from = str(after);
    const cut = from ? /^(.+)\|(.+)$/.exec(from) : null;
    const vid = `(b.script_id || '@' || b.version)`;
    const seek = cut ? { sql: `WHERE (b.at > ? OR (b.at = ? AND ${vid} > ?))`, args: [cut[1], cut[1], cut[2]] } : { sql: "", args: [] };
    const rows = this.#rows(`SELECT b.*, ${vid} AS vid, v.author FROM wiz_breaks b JOIN wiz_versions v ON v.script_id=b.script_id AND v.version=b.version
                               ${seek.sql} ORDER BY b.at, vid, b.bid`, ...seek.args);
    const seen = new Map(), entries = [];
    let truncated = false, last = null;
    for (const r of rows) {
      if (!seen.has(r.script_id)) seen.set(r.script_id, this.#script(r.script_id, viewer));
      const s = seen.get(r.script_id);
      if (!s) continue;
      if (entries.length === max) { truncated = true; break; }
      const f = parse(r.refusal);
      const row = f ? rowOf(f.code) : null;
      entries.push({ script: s.id, version: r.version, kind: r.event === "broken" ? "withdrawn" : "restored", at: r.at, name: s.name,
                     project: isObj(s.scope) ? s.scope.project : null, author: r.author,
                     refusal: f ? { code: f.code, check: row ? row.check : f.check ?? null, translation: row ? row.translation : null } : null });
      last = `${r.at}|${r.vid}`;
    }
    return { ok: true, entries, limit: max, truncated, cursor: truncated ? last : null };
  }

  /* ================================================================ R3: wizardDraft */

  #recordingRefusal(recorded) {
    /* DEC-49 REGION is-wizard-recording */
    if (!Array.isArray(recorded)) return refuse("WIZARD_STEP_REFUSED", "a recording is a list of {screen, act}", { step: null });
    if (recorded.length > STEPS_MAX) return refuse("WIZARD_STEP_REFUSED", word("wizard-scripts.refusal.steps_at_most_recording", { max: STEPS_MAX }), { step: null });
    for (let i = 0; i < recorded.length; i++) {
      const s = recorded[i];
      if (isObj(s) && Object.keys(s).some((k) => k !== "screen" && k !== "act"))
        return refuse("WIZARD_RECORDING_CARRIES_VALUES", "a recorded step holds its screen and act, never a typed value", { step: i + 1 });
    }
    for (let i = 0; i < recorded.length; i++) {
      const s = recorded[i];
      if (!isObj(s) || !oneLine(s.screen, NAME_FIELD_MAX) || (s.act !== undefined && s.act !== null && !oneLine(s.act, NAME_FIELD_MAX)))
        return refuse("WIZARD_STEP_REFUSED", "a recorded step is {screen, act}", { step: i + 1 });
    }
    /* END DEC-49 REGION is-wizard-recording */
    return null;
  }

  /** R3 (`op=wizarddraft`): a new script and its first draft, from a recording, a proposal or (with a live editor grant)
   *  nothing; or a new draft version of the script `from` names (an approved version, or a proposal for the script); or,
   *  with `copy`, a new script of the project copied from any approved version the author may see, recording its base
   *  (`based_on`; DEC-158), its pairs the draft's recorded pairs, its base unchanged and still offered. */
  wizardDraft({ project = null, name = null, recorded = undefined, from = null, copy = null, author = null, viewer = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    const recording = recorded !== undefined && recorded !== null;
    const given = (v) => v !== null && v !== undefined && v !== "";
    let source = null, target = null, proj = str(project), base = null;
    if (given(copy)) {
      const r = parseVersionId(copy) ? this.#resolve(copy, viewer) : null;
      const st = r ? this.#stateAt(r.s, r.n) : null;
      if (st !== "approved") return this.#noWizard(copy);
      base = r;
      source = { copy: versionId(r.s.id, r.n), steps: this.#steps(r.s, r.n) };
    } else if (given(from)) {
      if (parseVersionId(from)) {
        const r = this.#resolve(from, viewer);
        const st = r ? this.#stateAt(r.s, r.n) : null;
        if (!r || !["approved", "updated"].includes(st)) return this.#noWizard(from);
        target = r.s;
        source = { derived: { version: versionId(r.s.id, r.n) }, steps: this.#steps(r.s, r.n) };
      } else {
        const p = this.#proposal(from, viewer);
        if (!p) return this.#noWizard(from);
        if (p.script_id) target = this.#script(p.script_id, viewer);
        proj = p.project;
        source = { derived: { proposal: p.proposal_id }, steps: parse(p.steps) || [], proposal: p.proposal_id };
      }
      if (target && target.origin === "civicsmith") return this.#notTheGroups(target);
      if (target && target.retired) return this.#ended(target, { ending: "retired", ...target.retired });
      if (target) proj = target.project;
    }
    const member = this.#member(author);
    if (!proj || !this.#joined(proj, member)) return this.#scope(target, word("wizard-scripts.refusal.draft_joined_only"));
    if (!recording && !source && !this.#liveGrant(member))
      return this.#notGranted("a blank start needs the advanced editor, which an administrator grants");
    if (recording || (base && given(from))) {
      if (source) return refuse("WIZARD_STEP_REFUSED", "a draft starts from one of a recording, a source or a copy", { step: null });
      const bad = this.#recordingRefusal(recorded);
      if (bad) return bad;
    }
    const named = base && !given(name) ? base.s.name.slice(0, WIZARD_NAME_MAX) : name;
    /* DEC-49 REGION is-wizard-draft */
    if (!target && !oneLine(named, WIZARD_NAME_MAX))
      return refuse("WIZARD_NAME_REFUSED", word("wizard-scripts.refusal.name_length", { max: WIZARD_NAME_MAX }), { max: WIZARD_NAME_MAX });
    /* END DEC-49 REGION is-wizard-draft */
    const pairs = recording ? recorded.map((s) => ({ screen: s.screen.trim(), act: str(s.act) }))
      : base ? source.steps.map((s) => ({ screen: s.screen, act: s.act ?? null })) : null;
    const steps = canonicalSteps(recording ? pairs.map((p) => ({ ...p, what: "", why: "" })) : source ? source.steps : []);
    const at = this.#when();
    const who = this.#nameOf(member);
    return this.record.transact(() => {
      let sid = target ? target.id : null;
      if (!target) {
        sid = this.#mint("WIZ", at.slice(0, 4));
        if (!sid) return mintExhausted("WIZ");
        this.sql.exec(`INSERT INTO wiz_scripts (script_id, bundle_id, project, name, created_by, created_name, created_at)
                       VALUES (?,?,?,?,?,?,?)`, sid, proj, proj, named.trim(), member, who, at);
        if (base) this.sql.exec(`INSERT INTO wiz_copies (script_id, bundle_id, based_on, at) VALUES (?,?,?,?)`, sid, proj, source.copy, at);
      }
      const bundle = target ? target.bundle_id : proj;
      const n = (target ? Math.max(0, ...this.#numbers(sid)) : 0) + 1;
      this.sql.exec(`INSERT INTO wiz_versions (script_id, version, bundle_id, author, author_name, recorded, derived_from, created_at)
                     VALUES (?,?,?,?,?,?,?,?)`, sid, n, bundle, member, who, pairs ? json(pairs) : null, source && source.derived ? json(source.derived) : null, at);
      const sha = stepsSha(steps);
      this.sql.exec(`INSERT INTO wiz_revisions (script_id, version, bundle_id, steps, sha, author, author_name, adopted, at)
                     VALUES (?,?,?,?,?,?,?,?,?)`, sid, n, bundle, json(steps), sha, member, who, source && source.proposal ? source.proposal : null, at);
      return { ok: true, script: sid, version: versionId(sid, n), sha, state: "draft",
               ...(source && source.derived ? { derived_from: source.derived } : {}), ...(base ? { based_on: source.copy } : {}),
               says: word("wizard-scripts.says.draft_author_runs") };
    });
  }

  /* ================================================================ R4: wizardRevise */

  /** R4 (`op=wizardrevise`): a new revision of a draft's steps (or a proposal's, `adopt`), every earlier one kept. Without
   *  a live editor grant the steps may reword, delete or reorder the version's own pairs, never add one. */
  wizardRevise({ version = null, steps = undefined, adopt = null, author = null, viewer = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noWizard(version);
    const { s, n } = r;
    if (s.origin === "civicsmith") return this.#notTheGroups(s);
    const member = this.#member(author);
    const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    if (!member || v.author !== member) return this.#scope(s, word("wizard-scripts.refusal.revise_author_only"));
    const state = this.#stateOf(this.#events(s.id), n);
    if (state !== "draft") return this.#notADraft(s, n, state);
    const adopting = adopt !== null && adopt !== undefined && adopt !== "";
    const fromBase = adopting && isObj(adopt);
    const b = fromBase ? this.#newerBase(s, adopt.base, viewer) : null;
    if (fromBase && !b) return this.#noWizard(typeof adopt.base === "string" ? adopt.base : null);
    const p = adopting && !fromBase ? this.#proposal(adopt, viewer) : null;
    if (adopting && !fromBase && (!p || (p.script_id ? p.script_id !== s.id : p.project !== s.project))) return this.#noWizard(adopt);
    const taken = p ? parse(p.steps) || [] : b ? b.steps : null;
    const body = steps !== undefined && steps !== null ? steps : taken ?? undefined;
    if (Array.isArray(body) && !this.#liveGrant(member)
        && !WizardScripts.#within(body.filter(isObj), this.#allowedPairs(s, n, taken ? [taken] : [])))
      return this.#notGranted("without the advanced editor a revision may reword, delete or reorder the steps, never add one");
    const bad = stepShape(body);
    if (bad) return this.#stepRefusal(bad);
    const at = this.#when();
    const who = this.#nameOf(member);
    const canon = canonicalSteps(body);
    const sha = stepsSha(canon);
    this.sql.exec(`INSERT INTO wiz_revisions (script_id, version, bundle_id, steps, sha, author, author_name, adopted, at)
                   VALUES (?,?,?,?,?,?,?,?,?)`, s.id, n, s.bundle_id, json(canon), sha, member, who,
                  p ? p.proposal_id : b ? `${BASE_ADOPTION}${b.version}` : null, at);
    return { ok: true, version: versionId(s.id, n), sha, state: "draft", ...(p ? { adopted: p.proposal_id } : {}),
             ...(b ? { adopted_base: b.version } : {}),
             revisions: this.#one(`SELECT COUNT(*) AS c FROM wiz_revisions WHERE script_id=? AND version=?`, s.id, n).c };
  }

  /* R4 (DEC-158 (4)): a newer approved version of the base of the copy `s` (one approved after the version its `based_on`
     names, `updated` since or not) that the viewer may see, `{version, steps}`; or null. */
  #newerBase(s, asked, viewer) {
    const on = s.based_on ? parseVersionId(s.based_on) : null;
    const r = on && typeof asked === "string" ? this.#resolve(asked, viewer) : null;
    if (!r || r.s.id !== on.script || r.n <= on.version) return null;
    const st = this.#stateAt(r.s, r.n);
    return ["approved", "updated"].includes(st) ? { version: versionId(r.s.id, r.n), steps: this.#steps(r.s, r.n) } : null;
  }

  /* ================================================================ R5: wizardPropose */

  /** R5 (`op=wizardpropose`): any credential proposes steps, for a project or for a named script, stored apart and
   *  labelled; they are a script's only when a member names the proposal as `from` or adopts it. */
  wizardPropose({ project = null, script = null, steps = undefined, why = null, proposer = null, viewer = null,
                  run = null, model = null } = {}) {
    const who = str(proposer);
    /* DEC-49 REGION is-wizard-propose */
    if (!who) return refuse("WIZARD_NO_PROPOSER", "no stamped proposer: a proposal names who made it");
    /* END DEC-49 REGION is-wizard-propose */
    let s = null, proj = null;
    if (str(script)) {
      s = this.#script(script, viewer);
      if (!s) return this.#noWizard(script);
      if (s.origin === "civicsmith") return this.#notTheGroups(s);
      proj = s.project;
    } else {
      proj = str(project);
      if (!proj || this.#call(() => this.membership.inSight(proj, viewer)) !== true) return this.#noWizard(project);
    }
    const bad = Array.isArray(steps) && !steps.length ? { step: null, why: word("wizard-scripts.why.proposal_proposes_least") } : stepShape(steps);
    if (bad) return this.#stepRefusal(bad);
    /* DEC-49 REGION is-wizard-propose */
    if (!textUpTo(why, PROPOSAL_WHY_MAX))
      return refuse("WIZARD_WHY_REFUSED", word("wizard-scripts.refusal.proposal_why_length", { max: PROPOSAL_WHY_MAX }), { max: PROPOSAL_WHY_MAX });
    /* END DEC-49 REGION is-wizard-propose */
    const at = this.#when();
    const cut = (v) => (str(v) ? String(v).trim().slice(0, 200) : null);
    const canon = canonicalSteps(steps);
    return this.record.transact(() => {
      const id = this.#mint("WZP", at.slice(0, 4));
      if (!id) return mintExhausted("WZP");
      const sha = stepsSha(canon);
      this.sql.exec(`INSERT INTO wiz_proposals (proposal_id, bundle_id, project, script_id, steps, sha, why, proposer, run, model, at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`, id, proj, proj, s ? s.id : null, json(canon), sha, why.trim(), who, cut(run), cut(model), at);
      return { ok: true, proposal: { id, project: proj, script: s ? s.id : null, sha, why: why.trim(), at, label: WizardScripts.#label(who) },
               evidence: false, says: word("wizard-scripts.says.proposed_steps_stored") };
    });
  }

  /* ================================================================ R6: wizardSubmit */

  /** R6 (`op=wizardsubmit`): a draft is submitted, its steps and sha fixed, once R12 passes against the registration. */
  wizardSubmit({ version = null, author = null, viewer = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noWizard(version);
    const { s, n } = r;
    if (s.origin === "civicsmith") return this.#notTheGroups(s);
    const member = this.#member(author);
    const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    if (!member || v.author !== member) return this.#scope(s, word("wizard-scripts.refusal.submit_author_only"));
    const state = this.#stateOf(this.#events(s.id), n);
    if (state !== "draft") return this.#notADraft(s, n, state);
    const steps = this.#steps(s, n);
    const { refusals, warnings } = this.#check(steps, viewer, s.id, s.project);
    if (refusals.length) return WizardScripts.#checked(refusals, warnings, { version: versionId(s.id, n) });
    const at = this.#when();
    const sha = this.#latestRevision(s.id, n).sha;
    this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,?,?,?,?,?,?,?)`,
                  s.id, n, s.bundle_id, "submitted", member, this.#nameOf(member), json({ sha }), at);
    return { ok: true, version: versionId(s.id, n), state: "submitted", sha, warnings };
  }

  /* ================================================================ R7: wizardApprove */

  /** R7 (`op=wizardapprove`): an owner of the script's project (an administrator, for a group-wide script) approves a
   *  submitted version, the earlier approved one then `updated`; with `widen`, an administrator makes an approved
   *  project script group-wide. No review step precedes approval. */
  wizardApprove({ version = null, widen = false, by = null, viewer = null } = {}) {
    const machine = this.#machine("approve", by);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noWizard(version);
    const { s, n } = r;
    if (s.origin === "civicsmith") return this.#notTheGroups(s);
    const member = this.#member(by);
    const events = this.#events(s.id);
    const state = this.#stateOf(events, n);
    const who = member ? this.#nameOf(member) : null;
    /* DEC-49 REGION is-wizard-approve */
    if (truthy(widen)) {
      if (state !== "approved" || s.retired)
        return refuse("WIZARD_NOT_APPROVED", word("wizard-scripts.refusal.widen_not_approved", { state: s.retired ? "of a retired script" : state }),
                      { version: versionId(s.id, n), state });
      if (!this.#isAdmin(member)) return this.#notAnApprover(s, word("wizard-scripts.refusal.widen_admin_only"));
      if (s.widened) return { ok: true, script: s.id, existed: true, widened: s.widened, scope: "group" };
      const at = this.#when();
      this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,NULL,?,?,?,?,?,?)`,
                    s.id, s.bundle_id, "widened", member, who, json({ from: { project: s.project } }), at);
      return { ok: true, script: s.id, existed: false, scope: "group", widened: { by: { id: member, name: who }, at } };
    }
    if (state !== "submitted")
      return refuse("NOT_SUBMITTED", word("wizard-scripts.refusal.approve_not_submitted", { state }), { version: versionId(s.id, n), state });
    if (!this.#mayApprove(s, member))
      return this.#notAnApprover(s, s.widened ? word("wizard-scripts.refusal.approve_team_wide_admin_only") : word("wizard-scripts.refusal.approve_owner_only"));
    const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    const others = this.#contributors(s.id, n).filter((c) => c.kind === "member" && c.member !== v.author);
    if (v.author === member && !others.length)
      return refuse("APPROVER_IS_AUTHOR", word("wizard-scripts.refusal.approve_not_own_work"),
                    { version: versionId(s.id, n) });
    /* END DEC-49 REGION is-wizard-approve */
    const { refusals, warnings } = this.#check(this.#steps(s, n), viewer, s.id, s.project);
    if (refusals.length) return WizardScripts.#checked(refusals, warnings, { version: versionId(s.id, n) });
    const at = this.#when();
    const prev = this.#latestApproved(s, events);
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,?,?,?,?,?,?,?)`,
                    s.id, n, s.bundle_id, "approved", member, who, json({ sha: this.#latestRevision(s.id, n).sha }), at);
      if (prev !== null && prev !== n)
        this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,?,?,?,?,?,?,?)`,
                      s.id, prev, s.bundle_id, "updated", member, who, json({ by: n }), at);
      return { ok: true, version: versionId(s.id, n), state: "approved", approved: { by: { id: member, name: who }, at },
               updated: prev !== null && prev !== n ? versionId(s.id, prev) : null, warnings,
               says: word("wizard-scripts.says.approved_offered_member") };
    });
  }

  /* ================================================================ R8: editor grants */

  /** R8 (`op=wizardeditorgrant`): an administrator grants a member the advanced editor; a member already holding a live
   *  grant answers it, `existed: true`. */
  wizardEditorGrant({ member = null, by = null } = {}) {
    const admin = this.#member(by);
    if (!this.#isAdmin(admin)) return notAnAdmin(str(by), word("wizard-scripts.refusal.grant_admin_action"));
    const id = str(member) ? str(member).replace(/^member:/, "") : null;
    const facts = id ? this.#call(() => this.membership.memberFacts(id)) : null;
    /* DEC-49 REGION is-wizard-editor-grant */
    if (!facts) return refuse("WIZARD_EDITOR_MEMBER_UNKNOWN", word("wizard-scripts.refusal.grant_no_such_member"), { member: id ? id.slice(0, 80) : null });
    /* END DEC-49 REGION is-wizard-editor-grant */
    const held = this.#liveGrant(id);
    if (held) return { ok: true, grant: held.grant_id, existed: true, member: { id, name: held.member_name },
                       by: { id: held.actor, name: held.actor_name }, at: held.at };
    const at = this.#when();
    return this.record.transact(() => {
      const gid = this.#mint("WEG", at.slice(0, 4));
      if (!gid) return mintExhausted("WEG");
      const name = this.#nameOf(id), who = this.#nameOf(admin);
      this.sql.exec(`INSERT INTO wiz_editor_grants (grant_id, member, member_name, actor, actor_name, at) VALUES (?,?,?,?,?,?)`,
                    gid, id, name, admin, who, at);
      return { ok: true, grant: gid, existed: false, member: { id, name }, by: { id: admin, name: who }, at };
    });
  }

  /** R8 (`op=wizardeditorrevoke`): an administrator revokes a grant, appended; a second revocation answers the first. */
  wizardEditorRevoke({ grant = null, by = null } = {}) {
    const admin = this.#member(by);
    if (!this.#isAdmin(admin)) return notAnAdmin(str(by), word("wizard-scripts.refusal.revoke_admin_action"));
    const g = str(grant) ? this.#one(`SELECT * FROM wiz_editor_grants WHERE grant_id=?`, str(grant)) : null;
    /* DEC-49 REGION is-wizard-editor-grant */
    if (!g) return refuse("WIZARD_NO_SUCH_GRANT", word("wizard-scripts.refusal.revoke_no_such_grant"), { grant: str(grant) });
    /* END DEC-49 REGION is-wizard-editor-grant */
    const held = this.#one(`SELECT * FROM wiz_editor_revocations WHERE grant_id=?`, g.grant_id);
    if (held) return { ok: true, grant: g.grant_id, existed: true, revoked: { by: { id: held.actor, name: held.actor_name }, at: held.at } };
    const at = this.#when();
    const who = this.#nameOf(admin);
    this.sql.exec(`INSERT INTO wiz_editor_revocations (grant_id, actor, actor_name, at) VALUES (?,?,?,?)`, g.grant_id, admin, who, at);
    return { ok: true, grant: g.grant_id, existed: false, revoked: { by: { id: admin, name: who }, at } };
  }

  /* ================================================================ R9: wizardRetire */

  /** R9 (`op=wizardretire`): without `version`, an approver of its scope retires the whole script; with it, its author
   *  withdraws a draft or submitted version. Nothing is deleted. */
  wizardRetire({ script = null, version = null, reason = null, by = null, viewer = null } = {}) {
    const machine = this.#machine("approve", by);
    if (machine) return machine;
    const named = str(script) ?? parseVersionId(version)?.script ?? null;
    const s = this.#script(named, viewer);
    if (!s) return this.#noWizard(named);
    if (s.origin === "civicsmith") return this.#notTheGroups(s);
    const member = this.#member(by);
    const why = textUpTo(reason, ENDING_REASON_MAX);
    const reasonRefused = () => {
      /* DEC-49 REGION is-wizard-retire */
      return refuse("WIZARD_REASON_REFUSED", word("wizard-scripts.refusal.retire_reason_length", { max: ENDING_REASON_MAX }), { max: ENDING_REASON_MAX });
      /* END DEC-49 REGION is-wizard-retire */
    };
    if (version === null || version === undefined || version === "") {
      if (!this.#mayApprove(s, member))
        return this.#notAnApprover(s, s.widened ? word("wizard-scripts.refusal.retire_team_wide_admin_only") : word("wizard-scripts.refusal.retire_owner_only"));
      if (!why) return reasonRefused();
      if (s.retired) return this.#ended(s, { ending: "retired", ...s.retired });
      const at = this.#when();
      const who = this.#nameOf(member);
      this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,NULL,?,?,?,?,?,?)`,
                    s.id, s.bundle_id, "retired", member, who, json({ reason: reason.trim() }), at);
      return { ok: true, script: s.id, retired: { by: { id: member, name: who }, at, reason: reason.trim() },
               says: word("filing-templates.says.retired_versions_offered") };
    }
    const n = this.#versionOf(s, version);
    if (n === null) return this.#noWizard(named);
    const events = this.#events(s.id);
    const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, n);
    if (!member || v.author !== member) return this.#scope(s, word("wizard-scripts.refusal.withdraw_author_only"));
    const state = this.#stateOf(events, n);
    if (state === "approved" || state === "updated") return this.#notADraft(s, n, state);
    if (!why) return reasonRefused();
    if (state === "withdrawn") {
      const e = events.find((x) => x.version === n && x.event === "withdrawn");
      return this.#ended(s, { ending: "withdrawn", by: { id: e.actor, name: e.actor_name }, at: e.at, reason: (parse(e.detail) || {}).reason ?? null },
                         { version: versionId(s.id, n) });
    }
    const at = this.#when();
    const who = this.#nameOf(member);
    this.sql.exec(`INSERT INTO wiz_events (script_id, version, bundle_id, event, actor, actor_name, detail, at) VALUES (?,?,?,?,?,?,?,?)`,
                  s.id, n, s.bundle_id, "withdrawn", member, who, json({ reason: reason.trim() }), at);
    return { ok: true, version: versionId(s.id, n), state: "withdrawn", withdrawn: { by: { id: member, name: who }, at, reason: reason.trim() } };
  }

  /* ================================================================ R10: the reads */

  /* R15: a version's use, by event, over every day. */
  #useOf(vid) {
    const out = { start: 0, finish: 0 };
    for (const r of this.#rows(`SELECT event, COUNT(*) AS c FROM wiz_tallies WHERE version_id=? AND event IN ('start','finish') GROUP BY event`, vid))
      out[r.event] = Number(r.c);
    return out;
  }
  /* R10: whether `wizards` lists the script to the viewer: an owner of its project, or an administrator. */
  #listsTo(s, memberId) {
    if (this.#isAdmin(memberId)) return true;
    return s.origin === "group" && this.#isOwner(s.project, memberId);
  }
  /* R39: whether the member wrote a draft of the script, and whether version `n` is hers (a draft's author is a joined
     participant of the project, R3, not always an owner): her own drafts are hers to list whoever owns the project. */
  #draftBy(s, n, memberId) {
    return !!memberId && s.origin === "group" && !!this.#one(`SELECT 1 AS x FROM wiz_versions WHERE script_id=? AND version=? AND author=?`, s.id, n, memberId);
  }
  #hasDraftBy(s, memberId) {
    return !!memberId && s.origin === "group" && !!this.#one(`SELECT 1 AS x FROM wiz_versions WHERE script_id=? AND author=?`, s.id, memberId);
  }
  #listed(view, s) {
    return { id: view.id, version: view.version, state: view.state, start: startOf(view.steps), author: view.author,
             contributors: view.contributors, approved: view.approved, created_at: view.created_at,
             ...(view.updated_by ? { updated_by: view.updated_by } : {}), ...(view.ended ? { ended: view.ended } : {}),
             broken: view.broken, use: this.#useOf(view.id), ...(s.retired ? { retired: s.retired } : {}) };
  }

  /** R10 (`op=wizards`): newest first, at most 200, with `truncated`. By default every offered version of every script
   *  the viewer may see, to every member (R39: the Civicsmith library and each approved group script she may run, with
   *  its name, whose, `based_on` and finished count); `state` lists instead drafts, submitted, withdrawn, retired or
   *  broken versions, or open proposals (`proposed`), to the scripts' project owners and the administrators (a member's
   *  own drafts also to her). Writes nothing. */
  wizards({ state = null, viewer = null } = {}) {
    const st = str(state);
    /* DEC-49 REGION is-wizards-state */
    if (st && st !== "offered" && !WIZARDS_STATES_LISTED.includes(st))
      return refuse("WIZARDS_STATE_REFUSED", `state is offered or one of ${WIZARDS_STATES_LISTED.join(", ")}`, { states: WIZARDS_STATES_LISTED });
    /* END DEC-49 REGION is-wizards-state */
    const me = this.#member(viewer);
    if (st === "proposed") {
      const rows = this.#rows(`SELECT * FROM wiz_proposals p WHERE NOT EXISTS (SELECT 1 FROM wiz_revisions r WHERE r.adopted=p.proposal_id)
                                 ORDER BY at DESC, proposal_id DESC`)
        .filter((p) => this.#proposal(p.proposal_id, viewer) && (this.#isAdmin(me) || this.#isOwner(p.project, me)));
      return { ok: true, state: "proposed", truncated: rows.length > WIZARDS_MAX,
               proposals: rows.slice(0, WIZARDS_MAX).map((p) => ({ id: p.proposal_id, project: p.project, script: p.script_id ?? null,
                 steps: parse(p.steps) || [], sha: p.sha, why: p.why, at: p.at, label: WizardScripts.#label(p.proposer) })),
               says: word("wizard-scripts.says.proposed_steps_offered") };
    }
    /* R39 (T48; walk row 17): what is offered is listed to every member who may see it; each other state, as R10 says */
    const offered = !st || st === "offered";
    const scripts = [
      ...this.#registration().library.map((e) => this.#libraryScript(e.id)),
      ...this.#rows(`SELECT script_id FROM wiz_scripts`).map((r) => this.#groupScript(r.script_id)),
    ].filter((s) => this.#canSee(s, viewer) && (offered || this.#listsTo(s, me) || (st === "draft" && this.#hasDraftBy(s, me))))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1));
    const out = [];
    for (const s of scripts) {
      const events = s.origin === "civicsmith" ? [] : this.#events(s.id);
      const numbers = s.origin === "civicsmith" ? s.entry.versions.map((v) => v.version) : this.#numbers(s.id);
      const stateOf = (n) => (s.origin === "civicsmith" ? WizardScripts.#libState(s, n) : this.#stateOf(events, n));
      let pick;
      if (offered) { const n = this.#offeredNumber(s, events, viewer); pick = n === null ? [] : [n]; }
      else if (st === "retired") pick = s.retired ? numbers : [];
      else if (st === "broken") pick = s.origin === "group" ? numbers.filter((n) => this.#isBroken(s.id, n)) : [];
      else pick = s.retired ? [] : numbers.filter((n) => stateOf(n) === st && (st !== "draft" || this.#listsTo(s, me) || this.#draftBy(s, n, me)));
      if (!pick.length) continue;
      out.push(this.#head(s, viewer, { versions: pick.slice().reverse().map((n) => this.#listed(this.#versionView(s, n, events), s)) }));
    }
    return { ok: true, state: st || "offered", scripts: out.slice(0, WIZARDS_MAX), truncated: out.length > WIZARDS_MAX };
  }

  /** R10 (`op=wizardread`): one version (the latest approved by default, else the latest) with its steps and its whole
   *  attribution. Writes nothing. */
  wizardRead({ script = null, version = null, viewer = null } = {}) {
    const named = str(script) ?? parseVersionId(version)?.script ?? null;
    const s = this.#script(named, viewer);
    if (!s) return this.#noWizard(named);
    const events = s.origin === "civicsmith" ? [] : this.#events(s.id);
    const n = version !== null && version !== undefined && version !== "" ? this.#versionOf(s, version)
      : this.#latestApproved(s, events) ?? (s.origin === "civicsmith" ? s.entry.version : Math.max(...this.#numbers(s.id)));
    if (n === null || !Number.isFinite(n)) return this.#noWizard(named);
    const view = this.#versionView(s, n, events);
    const adopted = s.origin === "civicsmith" ? [] : this.#rows(`SELECT DISTINCT p.* FROM wiz_proposals p JOIN wiz_revisions r ON r.adopted=p.proposal_id
                                 WHERE r.script_id=? AND r.version=? ORDER BY p.proposal_id`, s.id, n)
      .map((p) => ({ id: p.proposal_id, sha: p.sha, why: p.why, at: p.at, label: WizardScripts.#label(p.proposer) }));
    return { ok: true, script: this.#head(s, viewer, { start: startOf(view.steps) }), version: { ...view, proposals_adopted: adopted },
             offered: this.#offeredNumber(s, events, viewer) === n };
  }

  /* ================================================================ R11: wizardsAt */

  /** R11 (`op=wizardsat`): the offered scripts the viewer may see whose first step is on `screen`, and the viewer's own
   *  drafts that start there (`draft: true`). An unknown screen answers none. Needs no AI credential and no key. */
  wizardsAt({ screen = null, viewer = null } = {}) {
    const sc = str(screen);
    if (!sc || !this.#registration().screens.has(sc)) return { ok: true, screen: sc, scripts: [] };
    const out = this.#startable(viewer, sc).map(({ s, n, steps, draft }) => {
      /* R52: `required` as R10 serves it; a caller's own draft is never required */
      if (draft) return { id: s.id, version: versionId(s.id, n), name: s.name, steps, approver: null, finished: 0, required: false, draft: true };
      const view = this.#versionView(s, n, s.origin === "civicsmith" ? [] : this.#events(s.id));
      return { id: s.id, version: view.id, name: s.name, steps, approver: view.approved ? view.approved.by : null,
               finished: this.#useOf(view.id).finish, required: s.required === true };
    });
    return { ok: true, screen: sc, scripts: out };
  }

  /* R11, R21: the scripts `viewer` may start, each `{s, n, steps, draft}`, in R11's order: the offered ones it may see,
     then its own drafts (`draft: true`); only those whose first step is on `screen` when one is named. */
  #startable(viewer, screen = null) {
    const on = (steps) => screen === null || startOf(steps) === screen;
    const out = this.#offeredScripts(viewer).filter((x) => on(x.steps)).map((x) => ({ ...x, draft: false }));
    const me = this.#member(viewer);
    if (me) {
      for (const r of this.#rows(`SELECT script_id, version FROM wiz_versions WHERE author=? ORDER BY script_id, version`, me)) {
        const s = this.#groupScript(r.script_id);
        if (!this.#canSee(s, viewer) || this.#stateOf(this.#events(s.id), r.version) !== "draft") continue;
        const steps = this.#steps(s, r.version);
        if (on(steps)) out.push({ s, n: r.version, steps, draft: true });
      }
    }
    return out;
  }

  /* ================================================================ R21: wizardRegistry */

  /** R21 (in-process; the registry form, Q1-7): for `answers`' explain and walk-through reads and `affordances`'
   *  no-target answer, every registered screen `{id, acts, scripts}`, each script as R11 answers it to `viewer` on that
   *  screen, `{id, version, name, start, steps: [{screen, act, what, why, via, draft?}], origin, based_on}` (and `draft:
   *  true` for the viewer's own draft), a step's `via` its side trip's script id or null (DEC-139 (4)), its `draft` its
   *  kind alone (`text`, `template` or `machine`), never its words, template or op, and `based_on` R1's with its base's
   *  name or null (DEC-158 (4)). Before registration `{registered: false, screens: []}`. Needs no AI credential and no
   *  key; runs nothing, records no use and writes nothing. */
  wizardRegistry({ viewer = null } = {}) {
    if (!this.reg) return { ok: true, registered: false, screens: [] };
    const byStart = new Map();
    for (const x of this.#startable(viewer)) {
      const start = startOf(x.steps);
      if (!byStart.has(start)) byStart.set(start, []);
      byStart.get(start).push({ id: x.s.id, version: versionId(x.s.id, x.n), name: x.s.name, start,
                                steps: x.steps.map(WizardScripts.#bareStep), origin: x.s.origin, based_on: this.#basedOn(x.s, viewer),
                                ...(x.draft ? { draft: true } : {}) });
    }
    const screens = this.registeredScreens().map((sc) => ({ ...sc, scripts: byStart.get(sc.id) || [] }));
    return { ok: true, registered: true, screens };
  }
  /* R21: a step with its draft named by its kind only. */
  static #bareStep(s) {
    const o = isObj(s) ? s : {};
    const kind = o.draft !== undefined && o.draft !== null ? Object.keys(canonicalDraft(o.draft) || {})[0] ?? null : null;
    return { screen: o.screen ?? null, act: o.act ?? null, what: o.what ?? "", why: o.why ?? "", via: typeof o.via === "string" ? o.via : null,
             ...(kind ? { draft: kind } : {}) };
  }

  /* ================================================================ R23: startFrom */

  /** R23 (`op=startfrom`; DEC-129 (7), (2); D52, D53): the first steps a member may take from the group's home, one
   *  front door for both paths: `scripts`, the offered scripts this viewer may start (R11) of the Civicsmith library
   *  that are not required, and of the group's own, each `{id, version, name, start}` (the guided starts); `doors`, the
   *  design stream's front doors naming offered scripts only (a door with none left out) and, last and for every viewer,
   *  the sixth, `elsewhere` (R37); `routes`, the six places a first message leads to by the member's choice
   *  (`START_ROUTES`, "not Civicsmith's" carrying the registered pointer for this viewer, `{places, pointers}`, or null); `blank: true` (a blank start is always allowed); `matches`, the
   *  existing work the registered finder answers for `message` as this viewer may see it (`[]` with no message or no
   *  finder); and, when the assistant's reading `parts` of the message is given, `proposal`, R28's. Needs no AI
   *  credential and no key; starts nothing, records no use, writes nothing. */
  startFrom({ viewer = null, message = null, parts = undefined } = {}) {
    /* R40: a library script whose first step is an administrator's (its act among the registration's `adminActs`, or with
       no act on an `adminScreens` screen) is offered only to a viewer who administers (membership R92) */
    const reg = this.#registration();
    const administers = this.#call(() => this.membership.sessionRights(viewer))?.administer === true;
    const adminFirst = (x) => {
      if (x.s.origin !== "civicsmith") return false;
      const t = isObj(x.steps[0]) ? x.steps[0] : {};
      return typeof t.act === "string" && t.act ? reg.adminActs.has(t.act) : reg.adminScreens.has(t.screen);
    };
    const offered = this.#offeredScripts(viewer).filter((x) => administers || !adminFirst(x));
    const scripts = offered.filter((x) => !(x.s.origin === "civicsmith" && x.s.required))
      .map((x) => ({ id: x.s.id, version: versionId(x.s.id, x.n), name: x.s.name, start: startOf(x.steps) }));
    /* R33: a door names any script offered to this viewer, a required one included (the guided starts leave those out) */
    const ids = new Set(offered.map((x) => x.s.id));
    const doors = FRONT_DOORS.map((d) => ({ door: d.door, scripts: (Array.isArray(d.scripts) ? d.scripts : []).filter((id) => ids.has(id)) }))
      .filter((d) => d.scripts.length);
    /* R37: the sixth door, the way out, is answered to every viewer after the five, whatever is offered */
    doors.push({ door: ELSEWHERE_DOOR.door, scripts: [], opens: ELSEWHERE_DOOR.opens });
    const door = this.door || {};
    const pointer = door.pointer ? pointerOf(this.#call(() => door.pointer(viewer))) : null;
    const routes = START_ROUTES.map((r) => (r.route === "elsewhere" ? { ...r, pointer } : r));
    const asked = typeof message === "string" && message.trim() ? message.trim().slice(0, 4000) : null;
    const matches = asked && door.findExisting && viewerPredicate(viewer).scope !== "DENY"
      ? matchesOf(this.#call(() => door.findExisting(asked, viewer), [])) : [];
    return { ok: true, scripts, doors, routes, blank: true, matches,
             ...(parts !== undefined && parts !== null ? { proposal: proposeStart({ parts }) } : {}) };
  }

  /* ================================================================ R26: baseUpdates */

  /* R26: the copies the viewer may see that are offered or hold a draft, each with the versions of its base approved
     after the one `based_on` names: `[{s, base, on, newer: [n]}]`. */
  #copiesBehind(viewer) {
    const out = [];
    for (const r of this.#rows(`SELECT script_id, based_on FROM wiz_copies ORDER BY script_id`)) {
      const s = this.#script(r.script_id, viewer);
      const on = parseVersionId(r.based_on);
      if (!s || s.retired || !on) continue;
      const events = this.#events(s.id);
      const live = this.#offeredNumber(s, events) !== null || this.#numbers(s.id).some((n) => this.#stateOf(events, n) === "draft");
      const base = this.#groupScript(on.script) || this.#libraryScript(on.script);
      if (!live || !base || !this.#canSee(base, viewer)) continue;   /* R20: no pair names a base the viewer may not see */
      const bev = base.origin === "civicsmith" ? [] : this.#events(base.id);
      const numbers = base.origin === "civicsmith" ? base.entry.versions.map((v) => v.version) : this.#numbers(base.id);
      const newer = numbers.filter((n) => n > on.version
        && (base.origin === "civicsmith" || ["approved", "updated"].includes(this.#stateOf(bev, n))));
      if (newer.length) out.push({ s, base, on, newer });
    }
    return out;
  }
  /* R26: the copy's recipients: its wizard editors (members with a live editor grant who may see it), else its approvers
     (R7's right: an owner of its project, or the administrators for a group-wide copy). BOB's reading (P17). Each must
     also see the base, so no one is told of a script they may not see (R20) or asked to adopt what R4 would refuse. */
  #copyRecipients(s, base) {
    const sees = (m) => this.#canSee(s, `member:${m}`) && this.#canSee(base, `member:${m}`);
    const editors = this.#rows(`SELECT DISTINCT g.member FROM wiz_editor_grants g WHERE NOT EXISTS
                                  (SELECT 1 FROM wiz_editor_revocations r WHERE r.grant_id=g.grant_id) ORDER BY g.member`)
      .map((r) => r.member).filter(sees);
    if (editors.length) return editors;
    const owners = (s.widened ? this.#call(() => this.membership.activeAdmins(), []) : this.#call(() => this.membership.projectOwners(s.project), [])) || [];
    return [...new Set(owners)].filter(sees).sort();
  }

  /** R26 (`op=baseupdates`; for `queue-producers` R39; the shape B3, K1861 (1)): each pair (copy, newer base version) of
   *  a copy the viewer may see, offered or holding a draft, whose base has a version approved after the one its
   *  `based_on` names, `{copy, copy_version, name, project, base, base_name, based_on, base_version, found_at, recipients:
   *  [member ids], steps: {copy, base}}` (`found_at` the instant the pair was first found, the one thing this writes),
   *  each pair once, at most 500 per page in (instant, copy, base version) order after `after` (a previous page's
   *  `cursor`), with `cursor` and `truncated`. Nothing is applied to a copy: the change is brought across only by a
   *  member's own revision (R4's `adopt: {base}`). */
  baseUpdates({ after = null, limit = null, viewer = null } = {}) {
    const max = clamp(limit, PAGE_MAX, PAGE_MAX);
    const at = this.#when();
    const pairs = [];
    for (const { s, base, on, newer } of this.#copiesBehind(viewer)) {
      for (const n of newer) {
        const nv = versionId(base.id, n);
        let seen = this.#one(`SELECT at FROM wiz_base_seen WHERE script_id=? AND newer=?`, s.id, nv);
        if (!seen) {
          this.sql.exec(`INSERT INTO wiz_base_seen (script_id, newer, bundle_id, at) VALUES (?,?,?,?)`, s.id, nv, s.bundle_id, at);
          seen = { at };
        }
        const events = this.#events(s.id);
        const drafts = this.#numbers(s.id).filter((k) => this.#stateOf(events, k) === "draft");
        const cv = this.#offeredNumber(s, events) ?? drafts[drafts.length - 1];
        pairs.push({ key: `${seen.at}|${s.id}|${nv}`, entry: {
          copy: s.id, copy_version: versionId(s.id, cv), name: s.name, project: isObj(s.scope) ? s.scope.project : null, base: base.id,
          base_name: base.name, based_on: versionId(on.script, on.version), base_version: nv, found_at: seen.at,
          recipients: this.#copyRecipients(s, base), steps: { copy: this.#steps(s, cv), base: this.#steps(base, n) } } });
      }
    }
    pairs.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const from = str(after);
    const rest = from ? pairs.filter((p) => p.key > from) : pairs;
    const page = rest.slice(0, max);
    const truncated = rest.length > max;
    return { ok: true, entries: page.map((p) => p.entry), cursor: truncated && page.length ? page[page.length - 1].key : null, truncated };
  }

  /* ================================================================ R24, R27: writing help */

  /** R24 (in-process): whether the assistant may help word `field` of `op` for this viewer, `{offered: true}` or
   *  `{offered: false, code}`: first `AI_KEPT_AWAY` while `ai-accounts.aiKeptAway()` answers its refusal (read here, at
   *  the call; T37, N765), then `AI_NO_ACCOUNT` where `assistant.account` names none, then the registration's refused
   *  and irreversible acts. Writes nothing; never throws. */
  writingHelpAt(args = {}) {
    return this.#helpAt(args, this.#keptAway());
  }
  #helpAt(args, away) {
    const { op = null, field = null, draftHeld = false, assistant = null } = isObj(args) ? args : {};
    return writingHelpAt({ op, field, draftHeld, assistant }, this.#registration().helpRefused, away);
  }

  /** R24 (in-process; B3, K1861 (1): `affordances` R44 reads it through `op=affordancescreens`): the acts the assistant
   *  never helps word, `{named, machine_refused, irreversible}`: `named` this module's frozen list, the other two as
   *  handed to `wizardRegister`, in registration order (`[]` before registration). */
  writingHelpRefused() {
    const reg = this.reg;
    return { named: WRITING_HELP_NAMED, machine_refused: reg ? [...reg.machineRefused] : [], irreversible: reg ? [...reg.irreversible] : [] };
  }

  /** R27 (`op=writinghelp`): a member's request for a labelled draft in one own-words field. The door routes the op
   *  itself and calls this with the POST body's `{op, field, told, draftHeld}`, its own `assistant` and the stamps (B4,
   *  K1863 (7)). `assistant` is the door's resolution whole (`store-door` R10; `answers.askAccount`): `{on, account:
   *  {kind, level}, refusal?}`, never the key, `refusal` the account's or its limit's answer when the door has one
   *  (`AI_NO_ACCOUNT`, `AI_USE_SWITCHED_OFF`, `ai-use` R3's `AI_LIMIT_REACHED`, or a fail-closed one). Refusals, in R27's
   *  order: R24's codes (a keep-away as `ai-accounts` answers it, its R7's row and `keep_away`, K231; a door's
   *  `AI_NO_ACCOUNT` as given, at R24 item 1's place); `WRITING_HELP_NOTHING_TOLD`; the door's other refusal as given,
   *  before any model turn, never re-minted here; past them, while the assistant's model turn does not exist (N686;
   *  K1837), `ASSISTANT_DRAFT_UNAVAILABLE`, the field unchanged, the answer the door turns into the draft (control-plane
   *  R57). (T47; R34) That answer carries `untested`, the test-instance label as `ai-runs` answers it for the part
   *  `draft:own_words` (`#untested`), when the part is admitted on the exception, and nothing otherwise; no refusal
   *  carries it. Writes nothing. */
  writingHelp(args = {}) {
    const { op = null, field = null, told = null, draftHeld = false, assistant = null } = isObj(args) ? args : {};
    const away = this.#keptAway();
    const door = isObj(assistant) && isObj(assistant.refusal) && assistant.refusal.ok === false ? assistant.refusal : null;
    const doorCode = door ? door.code ?? door.reason ?? null : null;
    const noAccount = doorCode === "AI_NO_ACCOUNT" || doorCode === "NO_ACCOUNT";
    /* R24 item 1 reads `account`; a door refusal of the limit or a switch is not "no account": it is answered later */
    const seen = door && !noAccount ? { ...assistant, account: assistant.account || { refused: doorCode } } : assistant;
    const at = this.#helpAt({ op, field, draftHeld, assistant: seen }, away);
    const asked = { op: typeof op === "string" ? op.slice(0, 80) : null };
    if (!at.offered && at.code === KEPT_AWAY && isObj(away) && away.ok === false) return { ...away, ...asked };
    if (!at.offered && at.code === "AI_NO_ACCOUNT" && door && noAccount) return { ...door, ...asked };
    if (!at.offered) return refuse(at.code, word("wizard-scripts.refusal.assistant_no_help_field"), asked);
    const text = typeof told === "string" ? told : Array.isArray(told) ? told.filter((x) => typeof x === "string").join("\n") : "";
    /* DEC-49 REGION is-writing-help-request */
    if (!text.trim() || text.length > TOLD_MAX)
      return refuse("WRITING_HELP_NOTHING_TOLD", word("wizard-scripts.refusal.assistant_tell_length", { max: TOLD_MAX }), { max: TOLD_MAX });
    /* END DEC-49 REGION is-writing-help-request */
    if (door) return { ...door, ...asked };
    /* DEC-49 REGION is-writing-help-request */
    const untested = this.#untested();
    return refuse("ASSISTANT_DRAFT_UNAVAILABLE", word("wizard-scripts.refusal.assistant_draft_unavailable"),
                  { firsthand: FIRSTHAND_ACTS.includes(String(op).trim()), ...(untested ? { untested } : {}) });
    /* END DEC-49 REGION is-writing-help-request */
  }

  /** R12 (`op=wizardcheck`): `checkScript` against the registration, for any credential, `ai` included. Writes nothing. */
  wizardCheck({ steps = undefined, viewer = null } = {}) {
    return { ok: true, ...this.#check(steps, viewer) };
  }

  /* ================================================================ R15, R16: use */

  /* A held version (any origin) by script and version, or null. */
  #held(script, version) {
    const p = parseVersionId(version);
    const sid = str(script) ?? p?.script ?? null;
    const s = sid ? this.#groupScript(sid) || this.#libraryScript(sid) : null;
    const n = s ? this.#versionOf(s, p ? versionId(p.script, p.version) : version) : null;
    return s && n !== null ? { s, n } : null;
  }

  /** R15 (`op=wizardprogress`): one count for (version, event, step) on this day, and nothing else of the call. A viewer,
   *  when stamped, is asked only whether it may see the script, and never kept. */
  wizardProgress({ script = null, version = null, event = null, step = null, viewer = null } = {}) {
    const h = this.#held(script, version);
    if (!h || (str(viewer) && !this.#canSee(h.s, viewer))) return this.#noWizard(str(script) ?? version);
    const steps = this.#steps(h.s, h.n);
    const k = step === null || step === undefined || step === "" ? null : Number(step);
    /* DEC-49 REGION is-wizard-progress */
    if (!WIZARD_EVENTS.includes(event))
      return refuse("WIZARD_PROGRESS_REFUSED", "use is counted as start, step or finish: stopping is not an event", { events: WIZARD_EVENTS });
    if (event === "step" ? !(Number.isInteger(k) && k >= 1 && k <= steps.length) : k !== null)
      return refuse("WIZARD_PROGRESS_REFUSED", event === "step" ? `a step reached is one of the script's, 1 to ${steps.length}`
        : "only a step reached names a step", { events: WIZARD_EVENTS });
    /* END DEC-49 REGION is-wizard-progress */
    this.sql.exec(`INSERT INTO wiz_tallies (version_id, event, step, day) VALUES (?,?,?,?)`, versionId(h.s.id, h.n), event, k, this.#day());
    return { ok: true };
  }

  /** R15 (`op=wizarduse`): a script's tallies, by version and day, to the owners of its project and its versions'
   *  authors (each author their own versions'; an administrator's, for a script with no project). */
  wizardUse({ script = null, viewer = null } = {}) {
    const s = this.#script(script, viewer);
    if (!s) return this.#noWizard(script);
    const me = this.#member(viewer);
    const all = s.origin === "civicsmith" ? this.#isAdmin(me) : this.#isOwner(s.project, me);
    const numbers = s.origin === "civicsmith" ? s.entry.versions.map((v) => v.version)
      : all ? this.#numbers(s.id) : this.#rows(`SELECT version FROM wiz_versions WHERE script_id=? AND author=? ORDER BY version`, s.id, me ?? "").map((r) => r.version);
    if (!all && !(s.origin === "group" && numbers.length))
      return this.#useRefusal(word("wizard-scripts.refusal.use_owners_authors_only"));
    const use = [];
    for (const n of numbers) {
      const days = new Map();
      for (const r of this.#rows(`SELECT event, step, day, COUNT(*) AS c FROM wiz_tallies WHERE version_id=? GROUP BY event, step, day ORDER BY day`, versionId(s.id, n))) {
        const d = days.get(r.day) || { version: versionId(s.id, n), day: r.day, start: 0, finish: 0, steps: {} };
        if (r.event === "step") d.steps[r.step] = Number(r.c); else d[r.event] = Number(r.c);
        days.set(r.day, d);
      }
      use.push(...days.values());
    }
    return { ok: true, script: s.id, use };
  }

  /** R16 (in-process): one count for (op, code) on this day, and nothing else. */
  tallyRefusal(op, code) {
    if (typeof op !== "string" || !TOKEN_RE.test(op) || typeof code !== "string" || !TOKEN_RE.test(code))
      return { ok: false };
    this.sql.exec(`INSERT INTO wiz_refusal_tallies (op, code, day) VALUES (?,?,?)`, op, code, this.#day());
    return { ok: true };
  }

  /** R16 (`op=wizardcandidates`): to project owners and administrators, the steps of offered scripts where the count drops
   *  most, and the (op, code) pairs most refused; never a member, case, target or project. */
  wizardCandidates({ viewer = null } = {}) {
    const me = this.#member(viewer);
    const owner = !!me && this.#rows(`SELECT DISTINCT project FROM wiz_scripts`).some((r) => this.#isOwner(r.project, me));
    if (!this.#isAdmin(me) && !owner) return this.#useRefusal(word("wizard-scripts.refusal.candidates_owners_admins_only"));
    const drops = [];
    for (const { s, n, steps } of this.#offeredScripts(viewer)) {
      const vid = versionId(s.id, n);
      const count = new Map();
      for (const r of this.#rows(`SELECT event, step, COUNT(*) AS c FROM wiz_tallies WHERE version_id=? GROUP BY event, step`, vid))
        count.set(r.event === "step" ? `step:${r.step}` : r.event, Number(r.c));
      const seq = [["start", 0], ...steps.map((_, i) => [`step:${i + 1}`, i + 1]), ["finish", steps.length + 1]];
      for (let i = 0; i + 1 < seq.length; i++) {
        const reached = count.get(seq[i][0]) || 0, next = count.get(seq[i + 1][0]) || 0;
        if (reached - next <= 0) continue;
        const k = seq[i][1], at = steps[Math.max(k - 1, 0)] || {};
        drops.push({ script: s.id, version: vid, step: k, screen: at.screen ?? null, act: at.act ?? null, reached, next, drop: reached - next });
      }
    }
    drops.sort((a, b) => b.drop - a.drop || (a.version < b.version ? -1 : a.version > b.version ? 1 : a.step - b.step));
    const refused = this.#rows(`SELECT op, code, COUNT(*) AS c FROM wiz_refusal_tallies GROUP BY op, code ORDER BY c DESC, op, code LIMIT ?`, CANDIDATES_MAX)
      .map((r) => ({ op: r.op, code: r.code, count: Number(r.c) }));
    return { ok: true, drops: drops.slice(0, CANDIDATES_MAX), refused };
  }

  /* ================================================================ R17: submittedFor */

  /** R17 (for `queue-producers` R33; K1397): every (version, owner) pair where the version is submitted and the owner may
   *  approve it (an owner of its project; a group-wide script's administrators), the sole author left out, each
   *  `{script, version, owner, name, author, submitted_at, project}` (`version` the number, `author` the version's,
   *  `project` null for a group-wide script), at most 500 per page in (version, owner) order after `after` (a previous
   *  page's `cursor`). Writes nothing. */
  submittedFor({ after = null, limit = null, viewer = null } = {}) {
    const max = clamp(limit, PAGE_MAX, PAGE_MAX);
    const from = str(after);
    const cut = from ? /^(.+)#([^#]*)$/.exec(from) : null;
    const rows = this.#rows(`SELECT e.script_id, e.version, e.at, (e.script_id || '@' || e.version) AS vid FROM wiz_events e
      WHERE e.event='submitted' AND NOT EXISTS (SELECT 1 FROM wiz_events x WHERE x.script_id=e.script_id AND x.version=e.version
                                                  AND x.event IN ('approved','updated','withdrawn'))
      ORDER BY vid`);
    const pairs = [];
    for (const r of rows) {
      const s = this.#script(r.script_id, viewer);
      if (!s || s.retired) continue;
      const v = this.#one(`SELECT author FROM wiz_versions WHERE script_id=? AND version=?`, s.id, r.version);
      const others = this.#contributors(s.id, r.version).some((c) => c.kind === "member" && c.member !== v.author);
      const owners = (s.widened ? this.#call(() => this.membership.activeAdmins(), []) : this.#call(() => this.membership.projectOwners(s.project), [])) || [];
      for (const o of [...new Set(owners)].sort())
        if (o !== v.author || others)
          pairs.push({ vid: r.vid, entry: { script: s.id, version: r.version, owner: o, name: s.name, author: v.author, submitted_at: r.at,
                                            project: isObj(s.scope) ? s.scope.project : null } });
    }
    pairs.sort((a, b) => (a.vid < b.vid ? -1 : a.vid > b.vid ? 1 : a.entry.owner < b.entry.owner ? -1 : a.entry.owner > b.entry.owner ? 1 : 0));
    const rest = cut ? pairs.filter((p) => p.vid > cut[1] || (p.vid === cut[1] && p.entry.owner > cut[2])) : pairs;
    const page = rest.slice(0, max);
    const truncated = rest.length > max;
    const tail = page[page.length - 1];
    return { ok: true, entries: page.map((p) => p.entry), limit: max, truncated, cursor: truncated && tail ? `${tail.vid}#${tail.entry.owner}` : null };
  }
}

/* The reads and acts answer their own refusals with code, check and translation (DEC-49). */
for (const m of ["wizardRegister", "brokenScripts", "wizardDraft", "wizardRevise", "wizardPropose", "wizardSubmit", "wizardApprove",
                 "wizardEditorGrant", "wizardEditorRevoke", "wizardRetire", "wizards", "wizardRead", "wizardsAt", "wizardCheck",
                 "wizardProgress", "wizardUse", "wizardCandidates", "submittedFor", "wizardRegistry", "startFrom", "baseUpdates",
                 "writingHelp"]) {
  const fn = WizardScripts.prototype[m];
  WizardScripts.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it creates and declares its tables with their classes (R18; record-core
 *  R21, plan T33 Rules (6)) and registers its opaque ids' seed (record-core R70). */
export function wizardScriptsOf(host, deps) {
  let w = instances.get(host);
  if (!w) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const filingTemplates = d.filingTemplates || filingTemplatesOf(host, { record, membership });
    const accounts = d.accounts || (() => aiAccountsOf(host, { record, membership }));   /* R24: on first need */
    const env = d.env ?? host.env ?? null;
    const aiRuns = d.aiRuns || (() => aiRunsOf(host, env));   /* R34: on first need */
    w = new WizardScripts({ ...d, storage, record, membership, filingTemplates, accounts, aiRuns, env });
    instances.set(host, w);
    w.migrate();
    record.declareTable("wizard-scripts", WIZARD_SCRIPTS_TABLE_CLASSES.map((t) => ({ ...t })));
    record.registerMintSeed("wizard-scripts", WIZARD_SCRIPTS_MINT_SEED.map((x) => [...x]));
  }
  return w;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function wizardScriptsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return WIZARD_SCRIPTS_TABLES.includes(name);
}

/** The module's ops (the `filingTemplatesOps` pattern): `author` and `viewer` are the control plane's stamps (`author`
 *  stands for R3, R4, R6's author, R5's proposer and R7–R9's `by`), read from the query and never from the body, so a
 *  caller's own copy never wins. `op-declarations` declares them (its R15, R28), `control-plane` routes and stamps them
 *  (its R50, R57) and `plane` composes them (its R19). `writinghelp` is not here: the door routes it itself and calls
 *  `writingHelp` with its own `assistant` (R27; B4, K1863 (7)). */
export function wizardScriptsOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  const has = (k) => url.searchParams.has(k);
  const b = body && typeof body === "object" ? body : {};
  const pick = (k) => (b[k] !== undefined && b[k] !== null ? b[k] : has(k) ? q(k) : null);
  const stamps = { viewer: q("viewer") };
  return {
    wizarddraft: () => m.wizardDraft({ project: pick("project"), name: pick("name"), recorded: b.recorded, from: pick("from"),
      copy: pick("copy"), author: q("author"), ...stamps }),
    wizardrevise: () => m.wizardRevise({ version: pick("version"), steps: b.steps, adopt: pick("adopt"), author: q("author"), ...stamps }),
    startfrom: () => m.startFrom({ message: pick("message"), parts: b.parts, ...stamps }),
    baseupdates: () => m.baseUpdates({ after: q("after"), limit: q("limit"), ...stamps }),
    wizardpropose: () => m.wizardPropose({ project: pick("project"), script: pick("script"), steps: b.steps, why: b.why ?? null,
      run: pick("run"), model: pick("model"), proposer: q("author"), ...stamps }),
    wizardsubmit: () => m.wizardSubmit({ version: pick("version"), author: q("author"), ...stamps }),
    wizardapprove: () => m.wizardApprove({ version: pick("version"), widen: pick("widen") ?? false, by: q("author"), ...stamps }),
    wizardeditorgrant: () => m.wizardEditorGrant({ member: pick("member"), by: q("author") }),
    wizardeditorrevoke: () => m.wizardEditorRevoke({ grant: pick("grant"), by: q("author") }),
    wizardretire: () => m.wizardRetire({ script: pick("script"), version: pick("version"), reason: b.reason ?? null, by: q("author"), ...stamps }),
    wizards: () => m.wizards({ state: pick("state"), ...stamps }),
    wizardread: () => m.wizardRead({ script: q("script"), version: q("version"), ...stamps }),
    wizardsat: () => m.wizardsAt({ screen: q("screen"), ...stamps }),
    wizardcheck: () => m.wizardCheck({ steps: b.steps, ...stamps }),
    wizardprogress: () => m.wizardProgress({ script: pick("script"), version: pick("version"), event: pick("event"), step: pick("step"), ...stamps }),
    wizarduse: () => m.wizardUse({ script: q("script"), ...stamps }),
    wizardcandidates: () => m.wizardCandidates({ ...stamps }),
  };
}

/* R46 (T51 fix round; K4202, K4213; op-declarations R80, op-grades R49): the ops this module serves that no owner had
   declared, declared by their owner beside the ops map. A row's class, machine classes and mutating flag are the hand
   row's (op-declarations); its weight is the op's grade (op-grades); its description is the op's `act.<op>.does` word,
   never a sentence of this module's own; its fields are what the arm reads. `writinghelp` is routed by the door, not
   by `wizardScriptsOps`, and is declared all the same. */
export const DECLARED_OPS = Object.freeze({
  wizards: { classes: ["admin", "member"], machineClasses: [], mutating: false, weight: "read",
    description: word("act.wizards.does"), fields: { accepts: ["state"], requires: [] } },
  startfrom: { classes: ["admin", "member", "probe"], mutating: false, weight: "read",
    description: word("act.startfrom.does"), fields: { accepts: ["message", "parts"], requires: [] } },
  writinghelp: { classes: ["admin", "member"], machineClasses: [], mutating: false, weight: "read",
    description: word("act.writinghelp.does"), fields: { accepts: ["op", "field", "told", "draftHeld"], requires: ["op", "told"] } },
  wizarddraft: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reversible",
    description: word("act.wizarddraft.does"), fields: { accepts: ["project", "name", "recorded", "from", "copy"], requires: [["project", "from", "copy"]] } },
  wizardrevise: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "undetermined",
    description: word("act.wizardrevise.does"), fields: { accepts: ["version", "steps", "adopt"], requires: ["version", ["steps", "adopt"]] } },
  wizardsubmit: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "undetermined",
    description: word("act.wizardsubmit.does"), fields: { accepts: ["version"], requires: ["version"] } },
  wizardapprove: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "undetermined",
    description: word("act.wizardapprove.does"), fields: { accepts: ["version", "widen"], requires: ["version"] } },
  wizardretire: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reasoned",
    description: word("act.wizardretire.does"), fields: { accepts: ["script", "version", "reason"], requires: [["version", "script"], "reason"] } },
});
