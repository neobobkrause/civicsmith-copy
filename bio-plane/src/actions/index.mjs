/* actions — the Action object (requirements: `build/requirements/actions.md`; State Rules v1.5 §4.4): what the group
 * sends or does outside the system, to whom, why, under which laws, at what legal exposure, by when, and what came
 * back. A member decides every move; a machine prepares and never advances, testifies, sets a tier or states a law.
 *
 * Extracted from the legacy modules (T8, layer 9; K3, K4, K6, K23, K31, K57, K61, K64, K75 (2), K79, K102):
 * `store.mjs` (the clock rule, `#actionDerived`, `actionMove` … `#spliceCorrespondence`, the governing-laws fence, the
 * action, risk-tier and `responds_to` arms of the promotion step and its three projections, the purge list entries and
 * the dispatch) and `schema.mjs` (the four tables, now `./schema.mjs`). The legacy code's comments moved with it. The
 * action document's grammar, its arms, readers and rows are `action-grammar`'s (T19 layer 9), read from there.
 *
 * REACHED as `actionsOf(host, deps)` (K61): one instance per host, created on the first call. At creation it creates
 * its tables and declares them to record-core's purge (R36), registers its check and projection with promotion (R1–R3,
 * R7, R11, R33), action-grammar's audit arm with record-core (R51), its facts and projection decoration with retrieval (R12,
 * R25; retrieval R53, R56), its "what we did" and trigger sources with events and duties (R66, R67), its none-exists
 * reader with intent (R71), and its own-act reader and own-sending check with consequences and standards (R97); and it
 * creates `action-records` (T47, N961; its R15), whose proposals, receipts, scopes and promises the read answers and
 * whose four judgments its acts ask (R18, R23, R64, R70; the getter `records`), whose `stakeOf` the read answers as
 * `own_stake` (R105) and whose `noSuchAction` this module re-exports (R107, R43). The
 * pressure marks and litigation holds, their reads and their registrations with doorbell and ratification, are
 * `action-holds`' since T45 (R48, R52, R54–R60, R69; K2781 (1)). `place()` and `zoneOf` give the group's zone to modules
 * with no office (R68); `actionZone` is the one zone an action's clock is read in (R100; `action-clocks` reads it).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `transact`, `acquireLease`, `releaseLease`, `head`, `readFile`, `livePaths`,
 *                                   `declarePurge`, `registerAuditCheck`, `getSetting`, `bundleInfo`; `viewerPredicate`,
 *                                   `memberFacts`, `listenerRefusal` (R45, R94, R95); `promote`, `registerStep`.
 *   retrieval      `registerActionFacts`, `registerProjectionDecoration` (its R53, R56).
 *   content        `captureFor` (R11).
 *   conformance    `determinationRead` (R8, R30, R75, R76), when provided (see R8 below); its module-level
 *                  `determinationSuperseded` (its R20) and `determinationVoided` (its R33), through which R8 answers.
 *   entities       `readEntity` (its R5): whether an addressee's `entity_id` names a person, an office or an
 *                  organisation (R9, R77, R78).
 *   consequences   `successRecordRead` (its R20; R8 (e), R93), `registerOwnActReader` (its R19; R97).
 *   standards      `standardRead`, `inForceAt` (R64), `registerOwnSendingCheck` (its R53; R97).
 *   project-roster `projectScope` (its R23): a counsel matter's acts are never in R66's items.
 *   local-facts    `governingView` (its R12): the view of kinds, venues, records laws and statuses (R10).
 *   progressions  `readProgression` (its R5): the progressions and stages a records request's `seeks` names (R70).
 *   intent         `registerNoneExistsReader` (its R33): the reader of requests answered that none exists (R71);
 *                  `null` registers none.
 *   now            the instance clock, milliseconds (default: `env.BIO_NOW_MS`, else the wall clock).
 *   env            the instance bindings.
 *
 * READ CONTRACTS it joins in its own SQL: record-core's `bundles` (`bundle_id`, `object_type`, `current_state`) and
 * `files` (`bundle_id`, `path`, `content`), its R37; provenance's `register` (`capture_sha`, `bundle_id`), its R48;
 * connections' `refs` (`bundle_id`, `target_id`, `kind`) for R25's `responses`. */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { contentOf, citationExtent, canonicalExtent, checkContentExtent } from "../content/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { conformanceOf, determinationSuperseded, determinationVoided } from "../conformance/index.mjs";
import { consequencesModule } from "../consequences/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { localFactsOf } from "../local-facts/index.mjs";
import { entitiesOf, noSuchEntity, notAProceeding, ORGANISATION_KINDS } from "../entities/index.mjs";
import { linesOf } from "../lines/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { progressionsOf } from "../progressions/index.mjs";
import { intentOf } from "../intent/index.mjs";
import { localDay, overdueOn, isCalendarDate, bounds } from "../civil-time/index.mjs";
import { combine, governingZone, get as profileOf } from "../../../jurisdictions/index.mjs";
import { parseFrontmatter, normalizeType, vocabFor, STATES, OBJECT_TYPES, isMachineIdentity,
         createSha256, idPattern } from "../record-grammar/index.mjs";
import { RISK_TIERS, riskTierState, RESOLUTIONS, CORRESPONDENCE_DIRECTIONS, actionBasisFindings,
         correspondenceFindings, isQuoteEntry, quoteValue, quoteFindings, lifecycleFindings,
         CITATION_MAX, RISK_TIER_REASON_MAX, RISK_TIER_HISTORY_MAX, riskTierHistoryOf,
         governingLawsOf, requestLifecycleOf, consequenceState, respondsToEdgeFindings, checkActionExtension,
         recordsLawRefusal, recordsLawOf, counterpartyName, counterpartyFindings, actionKinds, addresseeIsOffice,
         counterpartyOffice, LAW_LAYER_MAX, LAW_LEVELS,
         clockMovesNotMechanical, ACTION_FENCE_CHECKS, ACTION_ACT_CHECKS, GOVERNING_LAW_CHECKS, QUOTE_CHECKS,
         LIFECYCLE_CHECKS, RISK_TIER_REVISION_CHECKS, RECORDS_LAW_FENCE_CHECKS,
         ACTION_CATALOGUE_CHECKS, seeksOf, OVERRIDE_GROUNDS, SUCCESS_RECORD_ID_RE,
         premiseOverrideOf, overrideGroundFindings, copiedFindings, partnersFindings, pressTermsFindings,
         entryFieldFindings, actionFieldFindings, stageInLaw } from "../action-grammar/index.mjs";
import { ACTIONS_TABLES, migrateActions } from "./schema.mjs";
import { actionRecordsOf, noSuchAction } from "../action-records/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { ACTIONS_SCHEMA, ACTIONS_TABLES } from "./schema.mjs";
/* R107 (T50; N1178): `noSuchAction` is `action-records`' function (its R18), re-exported: one function, one answer, one
   row; only its home moved, because `action-records` is earlier in the order and answers the condition at seven sites. */
export { noSuchAction };

/** R13, R15: the longest reason, account, medium or party (the value of the retired legacy store's `RELEASE_ACK_MAX`). */
export const NOTE_MAX = 500;
/* REC-24: how long op=actioncorrespond holds the courtesy lock while it rewrites one document. Short on purpose — the
   op is a single append with no human step inside it. It is a COURTESY: promote's CAS on `base` is what actually
   prevents a lost update, and this only stops two members interleaving two accounts of the same exchange. */
export const CORRESPOND_LEASE_MS = 30000;
/** R27: the most quotes one read answers. */
export const QUOTES_MAX = 500;
/** R30: the most actions one page lists. */
export const ACTIONS_PAGE_MAX = 200;
/** R3 (N237, K351): the most `action_basis` and `correspondence` entries one action's document holds. */
export const ACTION_LEGS_MAX = 500;
export const ACTION_LEDGER_MAX = 500;
/** R46, R61 (S0-5): a plan's id, the core record-grammar's one id table answers for `PLN` (its R47), with or without a
 *  slug (`action-plans` mints it). No pattern of this module's own: a counter of four or more digits is accepted. */
const PLAN_ID_RE = new RegExp(`^${idPattern("PLN").source.slice(1, -1)}(-[a-z0-9]+)*$`);
/** R9: an entity id of the registry's `ENT-` form (record-grammar's `idPattern`). */
const ENTITY_ID_RE = idPattern("ENT");
/** R48 (K597 (1)): the kinds of pressure a received entry may be marked with. */
export const PRESSURE_KINDS = Object.freeze(["legal", "retaliation", "discrediting", "other"]);
/** R71 (intent R33): the most answers `noneExistsFor` gives. */
export const NONE_EXISTS_MAX = 50;
/** R74 (T45): the quick route offered beside `OVERRIDE_NO_GROUND` (reconciliation R16). */
export const QUICK_ROUTE = Object.freeze({ kind: "one_finding_case" });
/** R92 (T45): the most open items one read answers. */
export const OPEN_ITEMS_MAX = 200;
/** R108 (T51): the longest meeting name of the minutes a reply on a public comment carries. */
export const MINUTES_MEETING_MAX = 200;
/** R108: the kind a reply carries minutes on (the vocabulary's id for a public comment, action-grammar's `ACTION_KINDS`). */
const PUBLIC_COMMENT = "public_comment";
/* R108: the scalar fields of a passage's extent the entry holds flat (K2849), read back by content's `citationExtent`. */
const MINUTES_EXTENT_FIELDS = Object.freeze(["ref", "page", "sheet", "cell", "slide", "shape", "para", "run", "range", "table",
  "part", "space", "cited_as"]);
const isMinutesKey = (k) => typeof k === "string" && k.startsWith("minutes_");
/* R74: the flat keys a premise override's ground is held under (K2849). */
/* R81, R83, R94: the flat keys an entry's T45 fields are held under (K2849). */
const ENTRY_FIELD_KEYS = Object.freeze(["speaker", "office_words", "office_status", "found_elsewhere", "found_elsewhere_note"]);
const OVERRIDE_KEYS = Object.freeze(["ground_kind", "ground_citation", "ground_date", "ground_what", "ground_when"]);
/* R99 (T46; DEC-194, N913): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`) this module
   answers its keyed sentences with, each `en` verbatim, read by key, as membership's `HANDLE_WORDS` and extraction's
   `TRANSCRIBE_WORDS` are. The design stream's words: re-worded there, then re-taken here by key, never a copy.
   `{reason}` is left for the screen, with the member's reason as recorded answered beside it (R82). */
export const ACTIONS_WORDS = Object.freeze({
  "actions.override.ground_not_stated": word("actions.override.ground_not_stated"),
  "actions.reply.not_owed": word("actions.reply.not_owed", { reason: "{reason}" }),
  "actions.openitems.not_office": word("actions.openitems.not_office"),
  "actions.recognition.promise_only": word("actions.recognition.promise_only"),
});
/* The member-facing sentences T45 added (R74, R82, R92, R93; R87's `actions.scope.published_stays` is `action-records`'
   since T47, its R14), each answered as its key and the words `words.json`
   holds for it (R99): filings and the surfaces render the key, `says` its words. */
const keyed = (key) => Object.freeze({ key, says: ACTIONS_WORDS[key] });
export const T45_SENTENCES = Object.freeze({
  ground_not_stated: keyed("actions.override.ground_not_stated"),
  reply_not_owed: keyed("actions.reply.not_owed"),
  openitems_not_office: keyed("actions.openitems.not_office"),
  recognition_promise_only: keyed("actions.recognition.promise_only"),
});
/** R82, R99: the member's reason for `reply_owed: false` as recorded, the `{reason}` beside `actions.reply.not_owed`;
 *  null when none is held. */
const replyOwedReason = (fm) => (fm && typeof fm.reply_owed_reason === "string" && fm.reply_owed_reason.trim()
  ? fm.reply_owed_reason.trim() : null);

/* D-149: the one write that may set or change an action's governing laws is `actionLaws`, and it says so to `promote`
   under this Symbol. A Symbol: no JSON body a caller sends can carry one, so `op=promote` cannot claim to be the act. */
const LAWS_ACT = Symbol("d149-laws-act");
/* REC-214: the one write that may change an action's risk tier after intake, or append to its history, is
   `actionRiskTier`, and it says so to `promote` under this Symbol, for LAWS_ACT's reason. */
const RISK_TIER_ACT = Symbol("rec214-risk-tier-act");

/* The catalogue-backed refusals: each carries its code, check and translation (the Provides' "Terms"). */
const ROWS = Object.assign({}, ACTION_FENCE_CHECKS, ACTION_ACT_CHECKS, GOVERNING_LAW_CHECKS, QUOTE_CHECKS,
  LIFECYCLE_CHECKS, RISK_TIER_REVISION_CHECKS, RECORDS_LAW_FENCE_CHECKS, ACTION_CATALOGUE_CHECKS);
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string") return r;
  const row = ROWS[r.reason];
  if (!row) return r;
  return { ...r, code: r.code ?? r.reason, check: r.check ?? row.check, translation: r.translation ?? row.translation };
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, detail, ...(extra || {}) });

/* R43 (N217, K275; R107, T50): `noSuchAction`, the one answer to one condition (no action the caller may see answers to
   an id: absent, invisible, or a bundle that is not an action, alike), is `action-records`' (its R18) and re-exported
   above. This module answers through it at R29's read and at R86's link. */

/* R45 (N427, K711). THE ONE ANSWER TO ONE CONDITION: an action's stated contact names no member of the instance. This
   write answers it through here, and so does every later module asking it (`action-plans` R18), so
   `CONTACT_NOT_A_MEMBER` is minted at one site with its one row (C-117.11). The detail is this write's own fixed
   sentence; `extra` adds a caller's fields beside these and never replaces one. Writes nothing and never throws. */
const CONTACT_NOT_A_MEMBER_DETAIL = localize("actions.index.contact_names_a_member_of", "contact names a member of your team by member id, and this one names none. Nothing was written.");
const CONTACT_NOT_A_MEMBER_FIXED = new Set(["ok", "reason", "code", "check", "translation", "detail"]);
export function contactNotAMember(extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !CONTACT_NOT_A_MEMBER_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-contact-member */
  const row = ACTION_CATALOGUE_CHECKS.CONTACT_NOT_A_MEMBER;
  return { ok: false, reason: "CONTACT_NOT_A_MEMBER", code: "CONTACT_NOT_A_MEMBER", check: row.check,
           translation: row.translation, ...Object.fromEntries(own), detail: CONTACT_NOT_A_MEMBER_DETAIL };
  /* END DEC-49 REGION is-contact-member */
}
/** R45 (N427): a stated contact's member id, `member:<id>` or bare, or null. Never throws. */
export function contactId(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().replace(/^member:/, "");
}
const findingsOf = (list) => list.filter((x) => x.severity === "error")
  .map((x) => ({ check: x.check, detail: x.message, ...(x.code ? { code: x.code } : {}), ...(x.repairs ? { repairs: x.repairs } : {}) }));

/* R12, REC-24 (f): the clock, read from the DOCUMENT and never from a second store. The next PENDING deadline is the
   earliest date on a clock[] entry still marked pending. Pure over the frontmatter, so the projection writer, the
   read-time derivation and any later consumer compute one number by construction rather than by agreement. */
export function actionClockNext(fm) {
  const pending = (Array.isArray(fm?.clock) ? fm.clock : [])
    .filter((e) => e && typeof e === "object" && e.status === "pending"
                && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => e.date)
    .sort();
  return pending.length ? pending[0] : null;
}
/** An instant of `nowMs`, to the second, in record-grammar's `ISO_TS_RE` form (civil-time reads no other). */
export function instantOf(nowMs) {
  const n = Number(nowMs);
  return new Date(Math.floor((Number.isFinite(n) ? n : 0) / 1000) * 1000).toISOString().replace(".000Z", "Z");
}
/** R68 (N611, K1681; T47, N960): the IANA zone a place states: a view's (`place()`'s) `time_zone` value, or null when
 *  it states none (none held, or the active profiles disagree, so it is withheld). A string is read as the zone itself.
 *  The read for a module with no office; an action's clock is read in R100's `actionZone`. Writes nothing; never throws. */
export function zoneOf(place) {
  try {
    if (typeof place === "string") return place.trim() || null;
    const tz = place && typeof place === "object" ? place.time_zone : null;
    const v = tz && typeof tz === "object" ? tz.value : tz;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch { return null; }
}
/** R113–R115 (T53; N1257; K5458): the layers a list of profile ids stands for, in `combine`'s level order, each the layer's
 *  own profile (`jurisdictions` R99; a package, R114, expanded into its layers). `resolve` reads a profile by id: jurisdictions'
 *  `get`, or one a test passes for layers no profile holds. Empty for a list that does not combine or holds no layer (an
 *  earlier, unlayered profile). Writes nothing; never throws. */
export function layersOf(ids, resolve = profileOf) {
  try {
    if (!Array.isArray(ids) || !ids.length) return [];
    const read = (id) => { try { return typeof id === "string" ? profileOf(id) || (resolve !== profileOf ? resolve(id) : null) : id; } catch { return null; } };
    const list = ids.map((id) => (typeof id === "string" && profileOf(id) ? id : read(id) || id));
    const c = combine(list);
    if (!c || !c.ok || !c.view || !Array.isArray(c.view.layers)) return [];
    const given = new Map(list.filter((p) => p && typeof p === "object").map((p) => [p.id, p]));
    return c.view.layers.map((l) => given.get(l.id) || read(l.id))
      .filter((p) => p && typeof p === "object" && p.layer && typeof p.layer === "object");
  } catch { return []; }
}
const layerTag = (l) => ({ layer: l.id, level: l.layer.level ?? null, place: l.layer.place ?? null });
const ambiguous = (givers) => ({ ok: false, reason: "NAME_AMBIGUOUS", layers: givers.map(layerTag) });
const UNKNOWN = Object.freeze({ ok: false, reason: "NAME_UNKNOWN" });
/** R115 (T53; `jurisdictions` R121): the layer that gives an office addressee `cp` and its `counterparties` entry, among
 *  `layers`: the office's stated `layer` where it states one, else the one layer that gives its role and body. Answers
 *  `{ok: true, layer, entry}`, or `NAME_AMBIGUOUS` with the layers (two give it: never the first), or `NAME_UNKNOWN`. Pure. */
export function officeLayer(cp, layers) {
  try {
    const o = counterpartyOffice(cp);
    if (!o || !o.role || !Array.isArray(layers)) return UNKNOWN;
    const gives = (l) => (Array.isArray(l.counterparties) ? l.counterparties : [])
      .find((c) => c && c.role === o.role && (o.body === null || c.body === o.body)) || null;
    const stated = cp && typeof cp.layer === "string" && cp.layer.trim() ? cp.layer.trim() : null;
    const pool = stated ? layers.filter((l) => l.id === stated) : layers;
    const givers = pool.filter(gives);
    if (givers.length === 1) return { ok: true, layer: givers[0].id, entry: gives(givers[0]) };
    return givers.length > 1 ? ambiguous(givers) : UNKNOWN;
  } catch { return UNKNOWN; }
}
/** R113, R114 (T53; `jurisdictions` R121): the layer that gives a law named `law` (its citation, else its name) among
 *  `layers`, and its `records_laws` entry: in `layer` where one is stated; else at `level` where one is given; else the one
 *  layer that gives it. Answers as `officeLayer` does. Pure. */
export function lawLayer({ law, layer = null, level = null } = {}, layers) {
  try {
    const t = typeof law === "string" ? law.trim() : "";
    if (!t || !Array.isArray(layers)) return UNKNOWN;
    const pool = layers.filter((l) => (layer ? l.id === layer : true) && (level ? l.layer.level === level : true));
    for (const key of ["citation", "name"]) {
      const gives = (l) => (Array.isArray(l.records_laws) ? l.records_laws : []).find((e) => e && e[key] === t) || null;
      const givers = pool.filter(gives);
      if (givers.length === 1) return { ok: true, layer: givers[0].id, entry: gives(givers[0]) };
      if (givers.length > 1) return ambiguous(givers);
    }
    return UNKNOWN;
  } catch { return UNKNOWN; }
}
/* R112: a zone value that is an IANA name (`jurisdictions`' own test, through `governingZone`), else null. */
const zoneValue = (z) => { const v = z && typeof z === "object" ? z.value : z; return typeof v === "string" && governingZone([], v) === v ? v : null; };
/* R112: the zone of a layer's branch: the layer's own `time_zone`, else the nearest layer above it that states one. */
function branchZone(id, layers) {
  const seen = new Set();
  for (let l = layers.find((x) => x.id === id); l && !seen.has(l.id); l = layers.find((x) => x.id === l.layer.within)) {
    seen.add(l.id);
    const z = zoneValue(l.time_zone);
    if (z) return z;
  }
  return null;
}
/** R112, R115 (T53; N1257; DEC-404; amends R100): the zone an action's clock is read in, and which zone it is. For an
 *  office addressee over layered profiles: the zone the office's own entry states (`from: "office"`), else the zone of the
 *  layer that gives it, read on its branch (`"layer"`), else the team's zone, `view`'s, which `governingView` answers through
 *  `governingZone` (`"team"`); an office two active layers give with no `layer` stated is `NAME_AMBIGUOUS`, its zone
 *  undetermined, never the first's. `layers` are the layers active on the action's creation date (`jurisdictions` R121),
 *  else `view`'s. Otherwise R100's reading: the profile that gives the office or the kind's venue, else the team's.
 *  Answers `{zone, from, layer, why, says}` (`zone` null, `from` null with none held: never the UTC day; `ambiguous` with
 *  the layers). Writes nothing; never throws. */
export function actionZoneRead(fm, view, layers = null) {
  const out = (zone, from, layer, extra = {}) => {
    const why = zone ? `actions.zone.${from}` : extra.ambiguous ? "actions.zone.ambiguous" : "actions.zone.undetermined";
    const says = !zone ? (extra.ambiguous
        ? localize("actions.zone.ambiguous", "More than one active layer gives this office, and the action does not say which, so the day its clock is read on is undetermined.")
        : localize("actions.zone.undetermined", "No time zone is held for this action's office or for the team, so the day its clock is read on is undetermined."))
      : from === "office" ? localize("actions.zone.office", "The clock is read in {zone}, the zone the addressed office states.", { zone })
      : from === "layer" ? localize("actions.zone.layer", "The clock is read in {zone}, the zone of the layer that gives the addressed office.", { zone })
      : localize("actions.zone.team", "The clock is read in {zone}, the team's time zone: the addressed office states no zone of its own.", { zone });
    return { zone, from: zone ? from : null, layer: layer ?? null, why, says, ...extra };
  };
  try {
    const v = view && typeof view === "object" ? view : null;
    const fmv = fm && typeof fm === "object" ? fm : null;
    const ls = Array.isArray(layers) ? layers
      : v && Array.isArray(v.layers) ? v.layers.map((l) => { try { return profileOf(l && l.id); } catch { return null; } })
        .filter((p) => p && p.layer && typeof p.layer === "object") : [];
    const cp = fmv && fmv.counterparty && typeof fmv.counterparty === "object" ? fmv.counterparty : null;
    if (ls.length && counterpartyOffice(cp) && addresseeIsOffice(cp)) {
      const r = officeLayer(cp, ls);
      if (r.reason === "NAME_AMBIGUOUS") return out(null, null, null, { ambiguous: r });
      if (r.ok) {
        const own = zoneValue(r.entry && r.entry.time_zone);
        if (own) return out(own, "office", r.layer);
        const z = branchZone(r.layer, ls);
        if (z) return out(z, "layer", r.layer);
        const t = zoneOf(v);
        return out(t, "team", r.layer);
      }
    }
    if (!v) return out(null, null, null);
    let pid = null;
    if (cp && cp.state === "named" && (cp.kind === undefined || cp.kind === null || cp.kind === "office")
        && typeof cp.role === "string" && cp.role.trim()) {
      const role = cp.role.trim(), body = typeof cp.body === "string" ? cp.body.trim() : null;
      const c = (Array.isArray(v.counterparties) ? v.counterparties : [])
        .find((x) => x && x.role === role && (body === null || x.body === body));
      pid = c && typeof c.profile === "string" ? c.profile : null;
    } else {
      const k = (Array.isArray(v.action_kinds) ? v.action_kinds : [])
        .find((x) => x && x.kind === (fmv ? fmv.action_kind : null) && x.venue);
      pid = k && typeof k.profile === "string" ? k.profile : null;
    }
    if (pid) {
      let p = null;
      try { p = profileOf(pid); } catch { p = null; }
      const z = zoneOf(p);
      if (z) return out(z, "layer", pid);
    }
    return out(zoneOf(v), "team", null);
  } catch { return out(null, null, null); }
}
/** R100 (T47; N960; K1444 (iii); K3027 doubt 12): the IANA zone an action's clock is read in, the one spelling of it
 *  (`action-clocks` reads it, its R21): `actionZoneRead`'s `zone` (R112, R115), null when none is held, and every local day
 *  read through it is then undetermined, never the UTC day. `view` is the view R10 reads. Writes nothing; never throws. */
export function actionZone(fm, view, layers = null) {
  return actionZoneRead(fm, view, layers).zone;
}
/** R12, R25 (K1444 (iii)): the local day of `nowMs` in `zone`, or null with no zone or an unreadable one. */
export function localToday(nowMs, zone) {
  if (!zone) return null;
  const d = localDay(instantOf(nowMs), zone);
  return typeof d === "string" ? d : null;
}
const COB_RE = /close\s+of\s+business/i;
const WEEKDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/* R12 (K1444 (iii); civil-time R14): the close of the counterparty office's hours on `day`, `HH:MM`, from the view's
   `counterparties` entry for its role and body; null when the view holds no hours for it, or none that day. */
function closeOf(fm, day, place) {
  const cp = fm && fm.counterparty && typeof fm.counterparty === "object" ? fm.counterparty : null;
  const list = place && typeof place === "object" && Array.isArray(place.counterparties) ? place.counterparties : [];
  if (!cp) return null;
  const role = typeof cp.role === "string" ? cp.role.trim() : typeof cp.name === "string" ? cp.name.trim() : "";
  const body = typeof cp.body === "string" ? cp.body.trim() : null;
  const office = list.find((c) => c && c.role === role && (body === null || c.body === body));
  const weekly = office && office.hours && Array.isArray(office.hours.weekly) ? office.hours.weekly : null;
  if (!weekly) return null;
  const [y, m, d] = day.split("-").map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const closes = weekly.filter((h) => h && h.day === wd && typeof h.close === "string").map((h) => h.close).sort();
  return closes.length ? closes[closes.length - 1] : null;
}
/** R12 (K1444 (iii)): whether the next pending deadline has passed at `nowMs`, on the local day of the office's zone,
 *  never the UTC day: a deadline is met by anything on its day, and an entry whose basis says "close of business" is
 *  overdue from the close of the office's hours that day (`civil-time.overdueOn`, side `body`). `place` is the
 *  view R10 reads (its `counterparties`, `action_kinds` and `time_zone`), read in R100's `actionZone`, or a zone. True,
 *  false, or null when no zone is held or the comparison is undetermined. */
export function actionOverdue(fm, nowMs, place = null, layers = null) {
  /* R110: an entry stored `overdue` (R33's mechanical recheck; neither met nor waived) makes the clock overdue whatever
     `clock_next` is, and needs no zone to say so. */
  if ((Array.isArray(fm?.clock) ? fm.clock : []).some((e) => e && typeof e === "object" && e.status === "overdue")) return true;
  const next = actionClockNext(fm);
  if (!next) return false;
  const zone = typeof place === "string" ? zoneOf(place) : actionZone(fm, place, layers);
  if (!zone) return null;
  const at = instantOf(nowMs);
  const entries = (Array.isArray(fm.clock) ? fm.clock : [])
    .filter((e) => e && typeof e === "object" && e.status === "pending" && e.date === next);
  let undetermined = false;
  for (const e of entries.length ? entries : [{ date: next }]) {
    const close = typeof e.basis === "string" && COB_RE.test(e.basis) ? closeOf(fm, next, place) : null;
    const due = close ? { value: `${next}T${close}`, precision: "minute", zone } : { value: next, precision: "day", zone };
    let r;
    try { r = overdueOn({ due, at, side: "body" }); } catch { r = null; }
    if (r === "overdue") return true;
    if (r !== "not_overdue") undetermined = true;
  }
  return undetermined ? null : false;
}

const DUE_AT_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
/** R98 (T46; N922; `action-clocks` R3, its `dueAtOf`): the instant, in milliseconds, a clock entry's time of day
 *  (`due_at`, `YYYY-MM-DDTHH:MM[:SS]` on the entry's own date) falls at in the entry's `due_zone` where it states one,
 *  else in `zone` (R12's); null for an entry with a date only, or one whose time of day cannot be read, or whose wall
 *  time that zone skips or repeats that day (read by its date alone, never moved early). Pure; never throws. */
export function dueInstant(e, zone) {
  try {
    const m = e && typeof e === "object" && typeof e.due_at === "string" ? DUE_AT_RE.exec(e.due_at) : null;
    if (!m || m[1] !== e.date) return null;
    const z = typeof e.due_zone === "string" && e.due_zone.trim() ? e.due_zone.trim() : zone;
    if (typeof z !== "string" || !z) return null;
    const precision = m[3] ? "second" : "minute";
    const b = bounds({ value: m[0], precision, zone: z });
    const lo = b && typeof b.earliest === "string" ? Date.parse(b.earliest) : NaN;
    const hi = b && typeof b.latest === "string" ? Date.parse(b.latest) : NaN;
    return Number.isFinite(lo) && hi - lo === (precision === "minute" ? 60000 : 1000) ? lo : null;
  } catch { return null; }
}
/* R98: whether a held entry's time of day has passed at `nowMs`: the instant is reached (`monitoring` R34 marks an entry
   due at it). */
function timedEntryPassed(e, zone, nowMs) {
  const at = dueInstant(e, zone);
  return at !== null && Number.isFinite(nowMs) && nowMs >= at;
}

/** R12: the six facts retrieval projects for an action, pure; all null for another type or an unparsable document.
 *  `place` is the view R10 reads (or a zone) the caller passes; `clock_overdue` is read in R100's zone, and without one
 *  it is null. */
export function actionFacts(documentText, nowMs, place = null) {
  const none = { kind: null, risk_tier: null, counterparty_state: null, resolution: null, clock_next: null, clock_overdue: null };
  let fm = null;
  try { fm = typeof documentText === "string" ? parseFrontmatter(documentText).data : null; } catch { fm = null; }
  if (!fm || typeof fm !== "object" || normalizeType(fm.object_type) !== "action") return none;
  const tier = riskTierState(fm.risk_tier);
  const cp = fm.counterparty && typeof fm.counterparty === "object" && !Array.isArray(fm.counterparty) ? fm.counterparty : {};
  return { kind: typeof fm.action_kind === "string" ? fm.action_kind : null,
           risk_tier: tier === 1 || tier === 2 || tier === 3 ? tier : null,
           counterparty_state: typeof cp.state === "string" ? cp.state : null,
           resolution: typeof fm.resolution === "string" ? fm.resolution : null,
           clock_next: actionClockNext(fm), clock_overdue: actionOverdue(fm, nowMs, place) };
}

const clampLimit = (v, dflt, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : dflt; };

export class Actions {
  #deps;
  /* R95 (T45): the response listeners, one per module (K31's pattern). */
  #responseListeners = [];

  constructor({ storage, record, membership, promotion, host = null, records = null, retrieval = null, content = null,
                conformance = null, entities = null, lines = null, events = null, standards = null, duties = null,
                progressions = null, consequences = null, projectRoster = null, localFacts = null, now = null,
                env = null, profiles = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.#deps = { host, records, retrieval, content, conformance: conformance ?? undefined, entities, lines, events, standards, duties,
                   progressions, consequences, projectRoster, localFacts };
    this.env = env && typeof env === "object" ? env : {};
    this.now = typeof now === "function" ? now : null;
    /* R113–R115 (T53): the reader of a profile or layer by id, jurisdictions' `get` unless a test passes its own (for
       layers no held profile gives, such as `jurisdictions`' test forest). */
    this.#profiles = typeof profiles === "function" ? profiles : profileOf;
  }
  #profiles;

  get retrieval() { return this.#deps.retrieval ||= retrievalOf(this.#deps.host); }
  /* T47 (N961; split map §3): what this module records apart from the action's document, `action-records` (its R15):
     the proposals, receipts, scopes and promises the read answers (R25, R66, R30), and the four single-site judgments
     (R18, R23, R64, R70). Created at this module's creation (`actionsOf`); a test may pass its own. */
  get records() {
    return this.#deps.records ||= actionRecordsOf(this.#deps.host, { storage: { sql: this.sql }, record: this.record,
      membership: this.membership, progressions: this.#deps.progressions || null,
      standards: this.#deps.standards || null, now: this.now, env: this.env });
  }
  get content() { return this.#deps.content ||= contentOf(this.#deps.host); }
  /* R9: the subject registry's `readEntity` (entities R5), for an addressee's `entity_id`. */
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host); }

  /* R9, R62, R65 (T33-73): the dated lines (`holderAt`, `structureAt`, `linesOf`), the events (`proceedingStatusAt`,
     `registerEventSource`), the held standards (`standardRead`, `inForceAt`) and the duties (`registerTriggerSource`),
     each reached on the same host unless a test passes its own; a host on which one cannot be created answers null, and
     what it would have answered is answered undetermined, never guessed. */
  #reach(name, make) {
    if (this.#deps[name] === undefined || this.#deps[name] === null) {
      try { this.#deps[name] = make(this.#deps.host); } catch { this.#deps[name] = false; }
    }
    return this.#deps[name] || null;
  }
  get lines() { return this.#reach("lines", (h) => linesOf(h)); }
  get events() { return this.#reach("events", (h) => eventsOf(h)); }
  get standards() { return this.#reach("standards", (h) => standardsOf(h)); }
  get duties() { return this.#reach("duties", (h) => dutiesOf(h)); }
  /* R70: the progression definitions (`readProgression`, its R5), reached on the same host unless a test passes its own. */
  get progressions() { return this.#reach("progressions", (h) => progressionsOf(h)); }
  /* T45: the success records and the own-act registration (consequences R19, R20), the projects' scopes (project-roster
     R23) and the group's governing view (local-facts R12), each reached on the same host unless a test passes its own. */
  get consequences() {
    return this.#reach("consequences", (h) => consequencesModule(h, { record: this.record, membership: this.membership,
                                                                      promotion: this.promotion }));
  }
  get projectRoster() { return this.#reach("projectRoster", (h) => projectRosterOf(h, { record: this.record, membership: this.membership })); }
  get localFacts() { return this.#reach("localFacts", (h) => localFactsOf(h, { record: this.record, membership: this.membership })); }

  /* R9: the kind the registry holds `entityId` as, or null when it holds none or cannot be read. */
  #entityKind(entityId) {
    let r = null;
    try { r = this.entities.readEntity({ entityId }); } catch { r = null; }
    return r && r.ok && r.found && r.entity && typeof r.entity.kind === "string" ? r.entity.kind : null;
  }
  #namesPerson(entityId) { return this.#entityKind(entityId) === "person"; }
  /* R8, R30: conformance's `determinationRead` (its R9; K252). Reached on the same host unless a test passes its own; a
     host on which it cannot be created answers null, and R8 then refuses, never passes. */
  get conformance() {
    if (this.#deps.conformance === undefined || this.#deps.conformance === null) {
      try { this.#deps.conformance = conformanceOf(this.#deps.host); } catch { this.#deps.conformance = false; }
    }
    return this.#deps.conformance || null;
  }

  migrate() {
    migrateActions(this.sql);
    /* R11: the leg's pinned capture, on a table created before it had the column. */
    const cols = [...this.sql.exec(`PRAGMA table_info(action_basis)`)].map((r) => r.name);
    if (!cols.includes("extent_capture")) this.sql.exec(`ALTER TABLE action_basis ADD COLUMN extent_capture TEXT`);
    /* R74 (T45): an override's ground, on a table created before it had the column. */
    const ocols = [...this.sql.exec(`PRAGMA table_info(action_overrides)`)].map((r) => r.name);
    if (!ocols.includes("ground")) this.sql.exec(`ALTER TABLE action_overrides ADD COLUMN ground TEXT`);
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* The instance clock: an explicit `now` (the caller's as-of), then the injected clock, then `env.BIO_NOW_MS`, then
     the wall. An ABSENT param is null or "" and falls through, never read as the epoch. */
  #nowMs(explicit) {
    if (explicit !== undefined && explicit !== null && explicit !== "") {
      const e = Number(explicit);
      if (Number.isFinite(e) && e >= 0) return e;
    }
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env && this.env.BIO_NOW_MS);
    if (Number.isFinite(v) && v >= 0) return v;
    return Date.now();
  }

  /* R10: the active profiles' combined view (record-core R26), or null with none active or none combinable. */
  #view() {
    let ids = null;
    try { ids = this.record.getSetting("jurisdiction_profiles"); } catch { ids = null; }
    if (typeof ids === "string") { try { ids = JSON.parse(ids); } catch { ids = null; } }
    if (!Array.isArray(ids) || !ids.length) return null;
    const c = combine(this.#profileList(ids));
    return c && c.ok ? c.view : null;
  }
  /* R113–R115 (T53): the setting's ids as `combine` reads them: a held id as itself, any other as the profile the reader
     answers for it (none: the id, which `combine` then refuses as before). */
  #profileList(ids) {
    if (this.#profiles === profileOf) return ids;
    return ids.map((id) => { if (typeof id !== "string" || profileOf(id)) return id;
                             try { return this.#profiles(id) || id; } catch { return id; } });
  }
  /** R113–R115 (T53; N1257; `jurisdictions` R121, `record-core` R92): the layers active on the date of the action whose
   *  document is `fm` (its `created`, read through `getSettingAt`), expanded into layers; with no date, or none set by
   *  then, the layers active today. Empty with no layered profile. Never throws. */
  #layersAt(fm = null) {
    const parse = (v) => { if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } } return v; };
    let ids = null;
    try {
      const at = fm && typeof fm === "object" && typeof fm.created === "string" ? fm.created.trim() : "";
      if (at) { const v = parse(this.record.getSettingAt("jurisdiction_profiles", at)); if (Array.isArray(v) && v.length) ids = v; }
      if (!ids) ids = parse(this.record.getSetting("jurisdiction_profiles"));
    } catch { ids = null; }
    return layersOf(Array.isArray(ids) ? ids : [], this.#profiles);
  }
  /** R112, R115 (T53): the zone the action whose document is `fm` is read in, and which: R100's `actionZoneRead` over the
   *  view R10 reads and the layers active on the action's date. Never throws. */
  zoneRead(fm) {
    try { return actionZoneRead(fm, this.governingView(), this.#layersAt(fm)); } catch { return actionZoneRead(null, null, []); }
  }
  /** R68 (K1444 (iii); N611, K1681; T47, N960): the active profiles' combined view as they stand at the call (K1649),
   *  the read for a module with no office (its `time_zone` the group's zone, `zoneOf(place())`), or null when none can
   *  be read. An action's clock is never read in it: it is read in R100's `actionZone`. Writes nothing; never throws. */
  place() {
    try { return this.#teamZoned(this.#view()); } catch { return null; }
  }
  /* R68, K5292 (jurisdictions R98): `view` with its `time_zone` the team's governing zone: `governingZone` over the active
     profiles and record-core's `team_time_zone` (local-facts R22), so the team's stated zone governs when no profile gives
     one (a view of nothing but that zone then) and a profile's zone stands when no team zone is set. Never throws. */
  #teamZoned(view) {
    let z = null;
    try {
      let ids = this.record.getSetting("jurisdiction_profiles");
      if (typeof ids === "string") { try { ids = JSON.parse(ids); } catch { ids = null; } }
      z = governingZone(Array.isArray(ids) ? this.#profileList(ids) : ids, this.record.getSetting("team_time_zone"));
    } catch { z = null; }
    if (!z || (view && view.time_zone && view.time_zone.value === z)) return view;
    return { ...(view || {}), time_zone: { ...(view && typeof view.time_zone === "object" ? view.time_zone : {}), value: z } };
  }
  /** R10 (T45; N858; reconciliation R7): the view this module reads for kinds, counterparties, venues, records laws and
   *  response statuses: `local-facts.governingView` (its R12), so a group's confirmed rule governs here as in
   *  `action-clocks`; with no group rule it is `combine`'s own answer. A host on which local-facts cannot be reached, or
   *  a view it cannot answer, reads the combined view. Null with none. */
  #governing() {
    const lf = this.localFacts;
    let v = null;
    try { v = lf && typeof lf.governingView === "function" ? lf.governingView() : null; } catch { v = null; }
    if (v && v.ok === true && v.view && typeof v.view === "object") return v.view;
    return this.#view();
  }
  /** R10, R100: the view this module reads (`#governing`), for R100's `actionZone`; null with none. Never throws. */
  governingView() {
    try { return this.#teamZoned(this.#governing()); } catch { return null; }
  }
  /* R81 (T45): the response statuses the governing view holds for `kind` (jurisdictions R58, R77: an entry with no
     `applies_to` applies to every kind), as tokens; null when the view holds none. */
  #responseStatuses(kind) {
    const v = this.#governing();
    const list = v && v.vocabulary && Array.isArray(v.vocabulary.response_statuses) ? v.vocabulary.response_statuses : [];
    const held = list.filter((s) => s && typeof s.status === "string"
      && (s.applies_to === undefined || s.applies_to === null || s.applies_to === kind)).map((s) => s.status);
    return held.length ? held : null;
  }
  /* R85 (T45; my reading, J1 7), R114 (T53; K5458): the stages the records law of the request whose document is `fm` lists
     (jurisdictions R76), with how the law was found. Over layered profiles: the law in `law_layer` where the request states
     it (the layer may since have left the active set), else in the layers active on the action's creation date
     (`jurisdictions` R121): its citation, else its name; two layers giving it is `NAME_AMBIGUOUS`, its stages null
     (undetermined), never the first's. Otherwise, or where no layer gives it, the governing view's entry whose citation is
     `law`, else whose name is. `{stages, ambiguous?}`, `stages` null when none is matched or it lists none. */
  #lawStages(fm) {
    const law = fm && typeof fm.law === "string" ? fm.law.trim() : "";
    if (!law) return { stages: null };
    const stated = fm && typeof fm.law_layer === "string" && fm.law_layer.trim() ? fm.law_layer.trim() : null;
    let layers = this.#layersAt(fm);
    if (stated && !layers.some((l) => l.id === stated)) {
      let extra = null;
      try { extra = this.#profiles(stated); } catch { extra = null; }
      if (extra && extra.layer && typeof extra.layer === "object") layers = [...layers, extra];
    }
    if (layers.length) {
      const r = lawLayer({ law, layer: stated }, layers);
      if (r.ok) return { stages: Array.isArray(r.entry.stages) ? r.entry.stages : null, layer: r.layer };
      if (r.reason === "NAME_AMBIGUOUS") return { stages: null, ambiguous: r };
    }
    const v = this.#governing();
    const laws = v && Array.isArray(v.records_laws) ? v.records_laws : [];
    const e = laws.find((l) => l && l.citation === law) || laws.find((l) => l && l.name === law);
    return { stages: e && Array.isArray(e.stages) ? e.stages : null };
  }
  /* R9, R93 (T45): the governing view's entry for an action kind, or null. */
  #kindEntry(kind) {
    const v = this.#governing();
    const list = v && Array.isArray(v.action_kinds) ? v.action_kinds : [];
    return list.find((k) => k && k.kind === kind) || null;
  }
  /** R10, R42 (N231; action-grammar R1's `actionKinds`): the kinds this instance accepts now: the product's own and the active profiles' combined
   *  view. Writes nothing and never throws: a view that cannot be read answers the product's kinds alone. */
  kinds() {
    let view = null;
    try { view = this.#governing(); } catch { view = null; }
    try { return actionKinds(view); } catch { return actionKinds(null); }
  }

  /* The held version's `bundle_sha`, the compare-and-swap base (record-core R41). */
  #baseOf(id) { const h = this.record.head(id); return h ? h.bundleSha : null; }
  /* Every live file but bundle.md, carried byte for byte into a revision (record-core R13, R43). */
  #carried(id) {
    const out = [];
    for (const path of this.record.livePaths(id) || []) {
      if (path === "bundle.md") continue;
      const f = this.record.readFile(id, path);
      if (!f) continue;
      out.push(typeof f.text === "string" ? { path, text: f.text, bytes: new TextEncoder().encode(f.text).length, sha256: f.sha256 }
                                          : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    return out;
  }
  /* R16 (N261): the courtesy lock is given back through record-core's own release (its R61), which never throws. */
  #releaseLease(id, who) { this.record.releaseLease(id, who); }
  #heldFm(id) {
    const f = this.record.readFile(id, "bundle.md");
    if (!f || typeof f.text !== "string") return null;
    const fm = parseFrontmatter(f.text).data;
    return fm && typeof fm === "object" ? fm : null;
  }
  #visibleAction(id, viewer) {
    const gate = viewerPredicate(viewer);
    return this.#one(`SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
                     id, ...gate.args);
  }

  /* K57's small helpers, copied from the retired legacy store at the extraction; this module keeps its own copy. */
  static #appendStateHistory(text, e) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    const block = [`  - timestamp: "${e.timestamp}"`,
                   `    from_state: ${e.from_state}`,
                   `    to_state: ${e.to_state}`,
                   `    blurb: "${e.blurb}"`,
                   `    author: ${e.author}`];
    let at = -1;
    for (let i = 1; i < end; i++) if (/^state_history:/.test(lines[i])) { at = i; break; }
    if (at === -1) return [...lines.slice(0, end), "state_history:", ...block, ...lines.slice(end)].join("\n");
    const rest = lines[at].slice("state_history:".length).trim();
    if (rest === "[]") return [...lines.slice(0, at), "state_history:", ...block, ...lines.slice(at + 1)].join("\n");
    if (rest !== "") return null;
    let last = at;
    for (let i = at + 1; i < end; i++) {
      if (/^\s/.test(lines[i]) && lines[i].trim() !== "") last = i;
      else break;
    }
    return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
  }
  static #setScalar(text, key, value) {
    const lines = text.split("\n");
    const end = lines.indexOf("---", 1);
    for (let i = 1; i < (end === -1 ? lines.length : end); i++) {
      if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
    }
    return text;
  }
  static #setOrAddScalar(text, key, value) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return text;
    const end = lines.indexOf("---", 1);
    if (end === -1) return text;
    for (let i = 1; i < end; i++)
      if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
    return [...lines.slice(0, end), `${key}: ${value}`, ...lines.slice(end)].join("\n");
  }
  static #spliceReferences(text, additions) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    const block = additions.map((a) =>
      localize("actions.index.rel_rel_target_target_status", "  - rel: {rel}\n    target: {target}\n    status: {status}\n    note: \"{v1}\"", { rel: String(a.rel), target: String(a.target), status: String(a.status), v1: String(a.note ?? "") }));
    let ref = -1;
    for (let i = 1; i < end; i++) if (/^references:/.test(lines[i])) { ref = i; break; }
    if (ref === -1) return [...lines.slice(0, end), "references:", ...block, ...lines.slice(end)].join("\n");
    const rest = lines[ref].slice("references:".length).trim();
    if (rest === "[]") return [...lines.slice(0, ref), "references:", ...block, ...lines.slice(ref + 1)].join("\n");
    if (rest !== "") return null;
    let last = ref;
    for (let i = ref + 1; i < end; i++) {
      if (lines[i].trim() === "") continue;
      if (/^\s/.test(lines[i])) { last = i; continue; }
      break;
    }
    return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
  }
  static #fmSafe(s) { return String(s ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "'").trim(); }
  static #rand(n = 32) {
    return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  /* One Session Log appender for this module's writers. */
  static #appendSessionLog(text, entry) {
    const at = text.indexOf("## Session Log");
    if (at < 0) return localize("actions.index.text_session_log_entry", "{text}\n## Session Log\n\n{entry}", { text: String(text), entry: String(entry) });
    const nxt = text.indexOf("\n## ", at + 1);
    const cut = nxt === -1 ? text.length : nxt + 1;
    return text.slice(0, cut) + entry + "\n" + text.slice(cut);
  }
  /* A revision of `id` through promotion, carrying every other live file (R14, R16, R18, R24). */
  #revise(id, text, fm, b, when, who, marks = {}, state = null) {
    const bytes = new TextEncoder().encode(text);
    return this.promotion.promote({
      bundleId: id, base: this.#baseOf(id), snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who, viewer: marks.viewer ?? who, ...marks,
      files: [{ path: "bundle.md", text, bytes: bytes.length, sha256: createSha256().update(bytes).hex() },
              ...this.#carried(id)],
      meta: { object_type: fm.object_type ?? b.object_type, title: fm.title,
              current_state: state ?? fm.current_state ?? b.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
  }

  /* ================================================================ the write: promotion's step (R1–R3, R7, R11, R33) */

  /** R2: the governing-laws block as one comparable value (`[]` and absent are one state). */
  static #lawsKey(fm) {
    if (!fm || typeof fm !== "object") return "unreadable";
    const g = fm.governing_laws;
    const l = Array.isArray(g) && g.length ? g : (g === undefined || g === null || (Array.isArray(g) && !g.length)) ? null : g;
    return JSON.stringify([l, fm.governing_laws_by ?? null, fm.governing_laws_at ?? null]);
  }

  /* D-149 / C-73.1 (R2) — AN ACTION'S GOVERNING LAWS ARE SET BY `op=actionlaws` AND BY NOTHING ELSE. Asked of every
     creation and revision of an action, replay included: any difference not carried under LAWS_ACT is refused. */
  #lawsFence(c, heldFm, nextFm, isAction) {
    const { pkg, bundleId, head } = c;
    const heldAction = head && normalizeType(head.type) === "action";
    if (pkg[LAWS_ACT] || !(heldAction || (!head && isAction))) return null;
    const was = head ? Actions.#lawsKey(heldFm) : JSON.stringify([null, null, null]);
    const now = Actions.#lawsKey(nextFm);
    /* DEC-49 REGION is-promote-governing-laws */
    if (was !== now)
      return refuse("GOVERNING_LAWS_REWRITTEN",
        `${head ? "this revision of" : "this creation of"} ${bundleId} sets or changes its governing laws without `
        + "op=actionlaws. The laws that govern a request are a member's authored statement, set by that act and "
        + "carried forward unchanged by every other write. Nothing was written.", { bundleId });
    /* END DEC-49 REGION is-promote-governing-laws */
    return null;
  }

  /* REC-189 / C-32.19 — ONLY A MEMBER'S AUTHORED ACT SETS OR REVISES A RISK TIER. Two callers ask it: the write's
   * tier fence (`act` false) and `actionRiskTier` (`act` true). At the write it asks a CHANGE, never a presence: a
   * machine may carry a member's tier forward unchanged, and may leave undetermined a tier no member ever set; it may
   * not set one, change one, or drop a member's 1, 2 or 3. At the act a machine is refused whatever it asks for. */
  #machineRiskTierRefusal({ who, nextTier, heldTier, cur, act }) {
    const heldSet = heldTier === 1 || heldTier === 2 || heldTier === 3;
    /* DEC-49 REGION is-machine-set-risk-tier */
    if ((!who || isMachineIdentity(who))
        && (act || (((nextTier === 1 || nextTier === 2 || nextTier === 3) || heldSet) && nextTier !== heldTier)))
      return refuse("MACHINE_CANNOT_SET_RISK_TIER",
        localize("actions.index.v1_a_risk_tier_is", "{v1} A risk tier is a member's assessment of the legal exposure of filing this action, and only a member's authored act sets 1, 2 or 3. A machine credential may carry a member's tier forward unchanged, and may leave the tier unstated (undetermined) only where no member has set one; it may not remove a member's tier. Nothing was written.", { v1: String(act ? `op=actionrisktier is a member's authored revision of this action's risk tier (held: ${heldTier}).`
             : cur ? `this revision states risk_tier ${nextTier} where the version it replaces states ${heldTier}.`
                   : `this creation states risk_tier ${nextTier}.`) }), { risk_tier: nextTier, held: cur ? heldTier : null });
    /* END DEC-49 REGION is-machine-set-risk-tier */
    return null;
  }

  /* REC-214 / C-90.1 (R1) — AFTER INTAKE, A TIER CHANGES THROUGH `op=actionrisktier` AND NOTHING ELSE. */
  #tierFence(c, heldFm, nextFm, who) {
    const { pkg, bundleId, head } = c;
    const nextTier = riskTierState(nextFm.risk_tier);
    const heldTier = riskTierState(heldFm ? heldFm.risk_tier : undefined);
    const machine = this.#machineRiskTierRefusal({ who, nextTier, heldTier, cur: !!head, act: false });
    if (machine) return machine;
    if (pkg[RISK_TIER_ACT]) return null;
    const histKey = (x) => JSON.stringify(x && typeof x === "object" && x.risk_tier_history !== undefined
                                          && x.risk_tier_history !== null ? x.risk_tier_history : []);
    const tierMoved = head ? nextTier !== heldTier : false;
    const histMoved = histKey(nextFm) !== (head ? histKey(heldFm) : "[]");
    /* DEC-49 REGION is-promote-risk-tier */
    if (tierMoved || histMoved)
      return refuse("RISK_TIER_REWRITTEN",
        (tierMoved ? `this revision of ${bundleId} states risk_tier ${nextTier} where the version it replaces states ${heldTier}`
                   : `this ${head ? "revision" : "creation"} of ${bundleId} ${head ? "changes" : "states"} its risk_tier_history`)
        + " without op=actionrisktier. After intake a risk tier is revised by that act alone — it records who, when "
        + "and why, and keeps every earlier tier readable. Nothing was written.",
        { bundleId, ...(head ? { held: heldTier } : {}), risk_tier: nextTier });
    /* END DEC-49 REGION is-promote-risk-tier */
    return null;
  }

  /* D-689 / C-32.20 (R5): a machine or unstamped author may not state `law` on a creation, nor change or remove it. */
  #machineRecordsLawRefusal(heldFm, nextFm, who, creation) {
    const lawOf = (fm) => (fm && typeof fm.law === "string" && fm.law.trim() ? fm.law.trim() : null);
    const was = creation ? null : lawOf(heldFm), now = lawOf(nextFm);
    /* R114 (T53; K5458): the law's layer is stated by the same member act as the law, so a machine states neither. */
    const layerOf = (fm) => (fm && fm.law_layer !== undefined && fm.law_layer !== null && fm.law_layer !== "" ? JSON.stringify(fm.law_layer) : null);
    const layerMoved = (creation ? null : layerOf(heldFm)) !== layerOf(nextFm);
    /* DEC-49 REGION is-machine-state-records-law */
    if ((!who || isMachineIdentity(who)) && (was !== now || layerMoved))
      return refuse("MACHINE_CANNOT_STATE_RECORDS_LAW",
        "which law governs a records request is a member's statement. A machine credential may write a "
        + "records_request stating no law, and may propose one (op=actionlawspropose); it may not state, change or "
        + "remove the law. Nothing was written.", { held: was, law: now });
    /* END DEC-49 REGION is-machine-state-records-law */
    return null;
  }

  /* R6, R7, R9, R10, R33: the C-2.10 arms enforced at the write (C-73.6, C-101), each by its own name, carrying the
     arm's own findings. A MISSING counterparty and a pending entry PAST its date land; the audit reports them (R51). */
  #writeArms(c, heldFm, nextFm, who) {
    const { head, writer, operation } = c;
    const creation = !head;
    /* R6 (N297; action-grammar R3): the law arm's one refusal, minted by `recordsLawRefusal` alone. */
    const law = recordsLawRefusal(nextFm);
    if (law) return law;
    /* R114 (T53; K5458; action-grammar R31): `law_layer` names the layer that gave a records request's stated law: a
       non-empty single-line id of at most LAW_LAYER_MAX characters, on a records_request stating `law`. */
    const ll = nextFm.law_layer;
    if (ll !== undefined && ll !== null && ll !== "") {
      const shape = typeof ll === "string" && ll.trim() && ll.length <= LAW_LAYER_MAX && !/["\\\r\n]/.test(ll);
      const lawStated = nextFm.action_kind === "records_request" && typeof nextFm.law === "string" && nextFm.law.trim();
      if (!shape || !lawStated) {
        const detail = !shape
          ? localize("actions.index.law_layer_is_not_a", "law_layer is not a layer's id of 1 to {max} characters with no quote, backslash or line break (R114)", { max: String(LAW_LAYER_MAX) })
          : localize("actions.index.law_layer_is_stated_with", "law_layer names the layer that gave a records request's stated law, and this action states no law or is not a records_request (R114)");
        return refuse("RECORDS_LAW_REFUSED", `${detail}. Nothing was written.`,
          { findings: [{ check: "C-2.10", detail, repairs: ["state the law's layer by its id, beside the law", "or remove law_layer"] }] });
      }
    }
    /* DEC-49 REGION is-promote-action-kind */
    const kindMoved = creation || !heldFm || heldFm.action_kind !== nextFm.action_kind;
    if (kindMoved) {
      const kinds = this.kinds();
      if (!kinds.includes(nextFm.action_kind))
        return refuse("ACTION_KIND_UNKNOWN", localize("actions.index.action_kind_string_is_not", "action_kind '{String}' is not a kind your team's Civicsmith offers: one of {kinds}. Nothing was written.", { String: String(String(nextFm.action_kind).slice(0, 40)), kinds: String(kinds.join(", ")) }), { legal: kinds });
    }
    /* END DEC-49 REGION is-promote-action-kind */
    /* DEC-49 REGION is-promote-tier-vocabulary */
    if (riskTierState(nextFm.risk_tier) === null)
      return refuse("RISK_TIER_REFUSED", `risk_tier '${String(nextFm.risk_tier).slice(0, 20)}' is not 1, 2, 3 or `
        + "undetermined. Nothing was written.", { legal: Object.keys(RISK_TIERS) });
    /* END DEC-49 REGION is-promote-tier-vocabulary */
    /* DEC-49 REGION is-promote-counterparty */
    const cp = nextFm.counterparty;
    const cpMoved = creation || !heldFm || JSON.stringify(heldFm.counterparty ?? null) !== JSON.stringify(cp ?? null);
    if (cpMoved && cp !== undefined && cp !== null) {
      const cf = [];
      counterpartyFindings(nextFm, cf);
      /* R9: a NEW named office states its role and body (the earlier `{state: named, name}` reads, never written). */
      const office = cp && typeof cp === "object" && !Array.isArray(cp) && cp.state === "named"
        && (cp.kind === undefined || cp.kind === null || cp.kind === "office")
        && !(typeof cp.role === "string" && cp.role.trim() && typeof cp.body === "string" && cp.body.trim());
      /* R9: never a private individual: an `entity_id` the subject registry holds as a person (entities R5). */
      const eid = cp && typeof cp === "object" && !Array.isArray(cp) && typeof cp.entity_id === "string" ? cp.entity_id.trim() : "";
      const eidKind = !cf.length && eid ? this.#entityKind(eid) : null;
      if (!cf.length && eid && eidKind === "person")
        cf.push({ check: "C-2.10", severity: "error", message: localize("actions.index.counterparty_entity_id_eid_names", "counterparty.entity_id '{eid}' names a person in the subject registry: an action is addressed to an office, an organisation or an audience, never a private individual (R9, arm: person)", { eid: String(eid.slice(0, 40)) }) });
      /* R9 (K1484 row 5; B1a.14): an office arm's entity id names an office entity the registry holds. */
      else if (!cf.length && eid && addresseeIsOffice(cp) && eidKind !== "office")
        cf.push({ check: "C-2.10", severity: "error", message: localize("actions.index.counterparty_entity_id_eid_names_2", "counterparty.entity_id '{eid}' names {v1}: an office addressee's entity is an office entity (R9, arm: office)", { eid: String(eid.slice(0, 40)), v1: String(eidKind ? `an entity of kind ${eidKind}` : "no entity the subject registry holds") }) });
      /* R115 (T53; K5458): an office arm may name the layer that gave the office, by its id; no other arm carries one. */
      const lay = cp && typeof cp === "object" && !Array.isArray(cp) ? cp.layer : undefined;
      if (!cf.length && lay !== undefined && lay !== null && lay !== "") {
        if (!addresseeIsOffice(cp))
          cf.push({ check: "C-2.10", severity: "error", message: localize("actions.index.counterparty_carries_layer_only", "counterparty carries layer: only an office addressee names the layer that gave it (R9, arm: layer)") });
        else if (typeof lay !== "string" || !lay.trim() || lay.length > LAW_LAYER_MAX || /["\\\r\n]/.test(lay))
          cf.push({ check: "C-2.10", severity: "error", message: localize("actions.index.counterparty_layer_is_not", "counterparty.layer is not a layer's id of 1 to {max} characters with no quote, backslash or line break (R9, arm: layer)", { max: String(LAW_LAYER_MAX) }) });
      }
      if (cf.length || office)
        return refuse("COUNTERPARTY_REFUSED", cf.length ? cf[0].message
          : localize("actions.index.a_named_counterparty_is_an", "a named counterparty is an office, stated by its official role and the body it belongs to (R9). Nothing was written."),
          { findings: findingsOf(cf.length ? cf : [{ check: "C-2.10", severity: "error", message: "counterparty names no office (role and body)" }]) });
    }
    /* END DEC-49 REGION is-promote-counterparty */
    /* DEC-49 REGION is-promote-action-resolution */
    if (nextFm.current_state === "resolved" && !RESOLUTIONS.includes(nextFm.resolution))
      return refuse("ACTION_RESOLUTION_REFUSED", localize("actions.index.a_resolved_action_names_how", "a resolved action names how it ended: one of {RESOLUTIONS}. Nothing was written.", { RESOLUTIONS: String(RESOLUTIONS.join(", ")) }), { legal: RESOLUTIONS });
    /* END DEC-49 REGION is-promote-action-resolution */
    /* DEC-49 REGION is-promote-clock */
    const clock = nextFm.clock;
    if (clock !== undefined && clock !== null) {
      const bad = [];
      if (!Array.isArray(clock)) bad.push({ check: "C-11.1", detail: "clock is not a list of entries" });
      else clock.forEach((e, i) => {
        if (!e || typeof e !== "object" || !e.text || !e.description) bad.push({ check: "C-11.1", detail: `clock[${i}] lacks the {text, description} shape` });
        else {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) bad.push({ check: "C-11.1", detail: localize("actions.index.clock_i_date_date_is", "clock[{i}].date '{date}' is not YYYY-MM-DD", { i: String(i), date: String(e.date) }) });
          if (typeof e.basis !== "string" || !e.basis.trim()) bad.push({ check: "C-11.1", detail: `clock[${i}] has no basis (the statute, order, or commitment the date derives from)` });
          if (!["pending", "met", "overdue", "waived"].includes(e.status)) bad.push({ check: "C-11.1", detail: `clock[${i}].status '${e.status}' is not one of: pending, met, overdue, waived` });
        }
      });
      if (bad.length) return refuse("CLOCK_REFUSED", bad[0].detail, { findings: bad });
    }
    /* END DEC-49 REGION is-promote-clock */
    /* DEC-49 REGION is-promote-clock-mechanical */
    if (!creation && (!who || isMachineIdentity(who) || writer === "mechanical")) {
      /* R33, R98, R100 (K1444 (iii)): "passed" on the local day of the action's zone; with none held no entry has passed. */
      const nowMs = this.#nowMs(null), zone = this.zoneRead(heldFm || nextFm).zone;
      const today = localToday(nowMs, zone) ?? "0000-00-00";
      const heldClock = heldFm && Array.isArray(heldFm.clock) ? heldFm.clock : [];
      const nextClock = Array.isArray(clock) ? clock : [];
      const recheck = writer === "mechanical" && operation === "deadline-recheck";
      /* R98 (N922): a pending entry carrying a time of day is also moved once that instant has passed in its zone. */
      const moved = clockMovesNotMechanical(heldClock, nextClock, today).filter((m) => !(m.from === "pending"
        && m.to === "overdue" && timedEntryPassed(heldClock[m.ord], zone, nowMs)));
      const reshaped = heldClock.length !== nextClock.length
        || heldClock.some((e, i) => Actions.#clockShape(e) !== Actions.#clockShape(nextClock[i]));
      if (moved.length || reshaped || (!recheck && JSON.stringify(heldClock) !== JSON.stringify(nextClock)))
        return refuse("CLOCK_STATUS_NOT_MECHANICAL", localize("actions.index.a_machine_write_may_move", "a machine write may move a pending clock entry whose date, or stated time of day, has passed to overdue, and nothing else: it never adds, removes or re-dates an entry or sets another status. Nothing was written."), { moves: moved });
    }
    /* END DEC-49 REGION is-promote-clock-mechanical */
    return null;
  }

  /* R33: a clock entry with its status left out, so a comparison sees every other key. */
  static #clockShape(e) {
    if (!e || typeof e !== "object") return JSON.stringify(e ?? null);
    return JSON.stringify(Object.keys(e).filter((k) => k !== "status").sort().map((k) => [k, e[k]]));
  }

  /** R8, R74 (T45): the premise override a document states, `{ground, reason}`, or null when it states none. The bytes
   *  hold the ground flat on the override (`ground_kind`, `ground_citation`, `ground_date`, `ground_what`,
   *  `ground_when`: the restricted grammar holds no map inside a map; K2849), presented as R74's object by
   *  action-grammar's `premiseOverrideOf`; `ground` is null for an override written before T45 with its reason alone. */
  static overrideOf(fm) {
    const o = fm && typeof fm === "object" ? fm.premise_override : null;
    if (!(o && typeof o === "object" && !Array.isArray(o) && typeof o.reason === "string" && o.reason.trim())) return null;
    return { ground: premiseOverrideOf(o).ground, reason: o.reason.trim() };
  }

  /* R8 (K600 (a)), R74 (T45), R9 (D1): the premise override and a breach action's addressee. The override is stated by
     a member on the write that first sets `breach: true`, with a ground and a reason, and then never edited, removed or
     added; a breach action that states its addressee addresses an office. */
  #overrideAndAddressee(heldFm, nextFm, who) {
    const key = (fm) => JSON.stringify(fm && fm.premise_override !== undefined ? fm.premise_override : null);
    const held = key(heldFm), next = key(nextFm);
    if (held !== next) {
      /* DEC-49 REGION is-machine-override */
      if (!who || isMachineIdentity(who))
        return refuse("MACHINE_CANNOT_OVERRIDE", localize("actions.index.a_premise_override_is_a", "a premise override is a member's open statement that the team acts on a breach it has not determined, on a stated ground and with the reason why. A machine credential may not state or change one. Nothing was written."));
      /* END DEC-49 REGION is-machine-override */
      const o = nextFm.premise_override;
      /* DEC-49 REGION is-premise-override */
      const firstBreach = nextFm.breach === true && !(heldFm && heldFm.breach === true);
      if (held !== "null" || !firstBreach)
        return refuse("PREMISE_OVERRIDE_REWRITTEN", held !== "null"
          ? "this write edits or removes the action's premise override. It is stated once and kept as it was. Nothing was written."
          : "a premise override is stated on the creation or revision that first marks the action a breach, and on no "
            + "other write. Nothing was written.");
      const keys = o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : null;
      if (!keys || keys.some((k) => k !== "reason" && !OVERRIDE_KEYS.includes(k)) || typeof o.reason !== "string"
          || !o.reason.trim() || o.reason.length > NOTE_MAX || /["\\\r\n]/.test(o.reason))
        return refuse("PREMISE_OVERRIDE_REFUSED", `premise_override is {ground, reason}: the reason 1 to ${NOTE_MAX} `
          + "characters with no quote, backslash or line break, and nothing else beside them. Nothing was written.",
          { max: NOTE_MAX });
      /* END DEC-49 REGION is-premise-override */
      /* R74 (T45; N884; v0.2 rule 2): one of two grounds (action-grammar R15). With none, or another kind, the refusal
         names both and carries the quick route (a case of one finding run through every publication check, on which a
         member may determine; `action-clocks` answers the deadline's window beside it, reconciliation R16); a malformed
         ground is refused by the grammar's first finding, naming the part. */
      const found = [];
      overrideGroundFindings(Actions.overrideOf(nextFm), found);
      const errors = found.filter((x) => x.severity === "error");
      /* DEC-49 REGION is-override-ground */
      if (errors.length)
        return refuse(errors[0].code, localize("actions.index.message_nothing_was_written", "{message}. Nothing was written.", { message: String(errors[0].message) }), { findings: findingsOf(errors),
          ...(errors[0].code === "OVERRIDE_NO_GROUND" ? { grounds: [...OVERRIDE_GROUNDS], quick_route: { ...QUICK_ROUTE } } : {}) });
      /* END DEC-49 REGION is-override-ground */
    }
    const cp = nextFm.counterparty;
    /* DEC-49 REGION is-breach-addressee */
    if (nextFm.breach === true && cp !== undefined && cp !== null && !addresseeIsOffice(cp))
      return refuse("ADDRESSEE_NOT_AN_OFFICE", localize("actions.index.an_action_recorded_for_a", "an action recorded for a breach is addressed to the office responsible, by its official role and body; this one is addressed to {v1}. Nothing was written.", { v1: String(cp && typeof cp === "object" && cp.state === "named" ? `a ${cp.kind}` : `${cp && cp.state ? `an addressee ${cp.state}` : "no office"}`) }), { counterparty_state: cp && typeof cp === "object" ? cp.state ?? null : null });
    /* END DEC-49 REGION is-breach-addressee */
    return null;
  }

  /* R45 (D5), R46 (Bob's ruling 1 of 2026-09-29): the group's contact, set or changed by a member and naming one; the
     plan and option an action was started from, set on its creation and never changed or removed. */
  #contactAndPlan(c, heldFm, nextFm, who) {
    const same = (k) => JSON.stringify(heldFm && heldFm[k] !== undefined ? heldFm[k] : null)
      === JSON.stringify(nextFm[k] !== undefined ? nextFm[k] : null);
    if (!same("contact")) {
      /* DEC-49 REGION is-machine-contact */
      if (!who || isMachineIdentity(who))
        return refuse("MACHINE_CANNOT_SET_CONTACT", localize("actions.index.the_teams_contact_for_an", "the team's contact for an action is a member's choice; a machine credential may not set or change it. Nothing was written."));
      /* END DEC-49 REGION is-machine-contact */
      const id = contactId(nextFm.contact);
      let facts = null;
      if (id) { try { facts = this.membership.memberFacts(id); } catch { facts = null; } }
      if ((nextFm.contact !== undefined && nextFm.contact !== null) && !facts) return contactNotAMember();
    }
    const has = (fm, k) => fm && fm[k] !== undefined && fm[k] !== null && fm[k] !== "";
    /* DEC-49 REGION is-plan-link */
    if (c.head) {
      if (!same("plan") || !same("option"))
        return refuse("PLAN_LINK_REWRITTEN", "the plan and option an action was started from are set when it is created "
          + "and never set, changed or removed by a revision. Nothing was written.");
    } else if (has(nextFm, "plan") || has(nextFm, "option")) {
      const plan = nextFm.plan, option = nextFm.option;
      if (typeof plan !== "string" || !PLAN_ID_RE.test(plan)
          || !((typeof option === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(option)) || Number.isInteger(option)))
        return refuse("PLAN_LINK_REFUSED", "plan is a PLN- id and option a token of 1 to 80 letters, digits, '_', '.', ':' "
          + "or '-', stated together. Nothing was written.");
    }
    /* END DEC-49 REGION is-plan-link */
    return null;
  }

  /* R64 (K1446), R65 (C1): the records-request law's held standard (`law_standard`) and the `proceeding`, each set or
     changed only by a member and naming a record the author may see: a standard through `standards.standardRead`
     (`NO_SUCH_STANDARD`, minted by `standards.noSuchStandard`), a proceeding through the registry (`NO_SUCH_ENTITY`,
     minted by `entities.noSuchEntity`; another kind through `entities.notAProceeding`, R104). Asked only when the value moved. */
  #heldLinks(heldFm, nextFm, who, viewer) {
    const val = (fm, k) => (fm && typeof fm[k] === "string" && fm[k].trim() ? fm[k].trim() : fm && fm[k] !== undefined && fm[k] !== null && fm[k] !== "" ? fm[k] : null);
    const lawStd = val(nextFm, "law_standard");
    if (JSON.stringify(val(heldFm, "law_standard")) !== JSON.stringify(lawStd)) {
      if (!who || isMachineIdentity(who))
        return refuse("MACHINE_CANNOT_STATE_RECORDS_LAW", "which law governs a records request, and the held standard it "
          + "names, are a member's statement. A machine credential may propose one (op=actionlawspropose); it may not "
          + "state, change or remove it. Nothing was written.", { held: val(heldFm, "law_standard"), law_standard: lawStd });
      if (lawStd !== null && (nextFm.action_kind !== "records_request" || typeof nextFm.law !== "string" || !nextFm.law.trim()))
        return refuse("RECORDS_LAW_REFUSED", "law_standard names the held standard of a records request's stated law; "
          + "this action states no law, or is not a records_request. Nothing was written.",
          { findings: [{ check: "C-2.10", detail: "law_standard is stated with no law on a records_request (R64)",
                         repairs: ["state the law by its citation", "or remove law_standard"] }] });
      if (lawStd !== null) {
        const r = this.records.standardSeen(lawStd, viewer);
        if (r) return r;
      }
    }
    const proc = val(nextFm, "proceeding");
    if (JSON.stringify(val(heldFm, "proceeding")) !== JSON.stringify(proc)) {
      /* DEC-49 REGION is-machine-set-proceeding */
      if (!who || isMachineIdentity(who))
        return refuse("MACHINE_CANNOT_SET_PROCEEDING", "the proceeding an action belongs to is a member's statement; a "
          + "machine credential may not set, change or remove it. Nothing was written.");
      /* END DEC-49 REGION is-machine-set-proceeding */
      if (proc !== null) {
        const r = this.#proceedingRefusal(proc);
        if (r) return r;
      }
    }
    return null;
  }
  /* R65: null when `id` is a registered entity of kind `proceeding`, else the refusal. */
  #proceedingRefusal(id) {
    const pid = typeof id === "string" ? id.trim() : "";
    const kind = pid ? this.#entityKind(pid) : null;
    if (!kind) return noSuchEntity(pid || null, { end: "proceeding" });
    /* R104 (T48; K231, K3207): `entities.notAProceeding` is the one site minting `NOT_A_PROCEEDING`. */
    if (kind !== "proceeding")
      return notAProceeding(`proceeding names an entity of kind ${kind}; an action belongs to an entity of `
        + "kind proceeding. Nothing was written.", { entity_id: pid, kind });
    return null;
  }

  /* R70, R72 (H30 (1); K2505, K2552, K2553, K2561): a creation or revision stating `seeks`, or changing or removing it,
     is judged before any write: a machine or unstamped author may not (R72: what a request asks the records for is a
     member's statement; a machine proposes it, `action-records` R3); then `action-records.seeksRefusal` (R70, its R10). Asked only when `seeks` moved, so a later
     revision is never refused for a progression's later version. */
  #seeksFence(heldFm, nextFm, who) {
    const key = (fm) => JSON.stringify(fm && fm.seeks !== undefined && fm.seeks !== null ? fm.seeks : null);
    if (key(heldFm) === key(nextFm)) return null;
    /* DEC-49 REGION is-machine-state-seeks */
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_STATE_SEEKS", "which stages a records request asks the records for is a member's "
        + "statement; a machine credential may not state, change or remove it, and may propose it "
        + "(op=actionseekspropose). Nothing was written.");
    /* END DEC-49 REGION is-machine-state-seeks */
    /* R70 (T47; N961): the judgment is `action-records.seeksRefusal` (its R10); the fence is this module's. */
    return this.records.seeksRefusal(nextFm);
  }

  /* T45: the errors of an action-grammar arm (R15, R20–R23), as the refusal reads them. */
  static #errors(list) { return (Array.isArray(list) ? list : []).filter((x) => x && x.severity === "error"); }
  static #pushed(fn, ...args) { const out = []; fn(...args, out); return Actions.#errors(out); }
  /* T45: the refusal minted from a grammar arm's first finding, every finding carried; `dflt` when it names no code. */
  static #fromFindings(errors, dflt, extra = {}) {
    return errors.length ? refuse(errors[0].code || dflt, errors[0].message, { findings: findingsOf(errors), ...extra }) : null;
  }

  /* T45 (R33, R77–R79, R82, R86, R94; R81, R83 at the write): the fields an action states beside its addressee, each
     asked only when it moved, so a later revision is never refused for a field it carries forward. A machine or
     unstamped author states none of them (R33); each shape is action-grammar's (R20–R23), each refusal minted here from
     its first finding; what only the record can answer (an entity's kind, a member, an action the author may see) is
     asked here. */
  #t45Fields(c, heldFm, nextFm, who, viewer) {
    const machine = !who || isMachineIdentity(who);
    const moved = (k) => JSON.stringify(heldFm && heldFm[k] !== undefined ? heldFm[k] : null)
      !== JSON.stringify(nextFm[k] !== undefined ? nextFm[k] : null);
    const stated = (k) => nextFm[k] !== undefined && nextFm[k] !== null;
    /* R77: copied offices, checked as the counterparty is; never the addressee. */
    if (moved("copied")) {
      /* DEC-49 REGION is-machine-set-copied */
      if (machine) return refuse("MACHINE_CANNOT_SET_COPIED", "the offices an action copies are a member's statement; a "
        + "machine credential may not set or change them. Nothing was written.");
      /* END DEC-49 REGION is-machine-set-copied */
      if (stated("copied")) {
        const r = Actions.#fromFindings(Actions.#pushed(copiedFindings, nextFm), "COUNTERPARTY_REFUSED");
        if (r) return r;
        const bad = (Array.isArray(nextFm.copied) ? nextFm.copied : []).map((e, i) => ({ e, i }))
          .find(({ e }) => e && typeof e.entity_id === "string" && e.entity_id.trim()
            && (this.#entityKind(e.entity_id.trim()) === "person"
                || (addresseeIsOffice(e) && this.#entityKind(e.entity_id.trim()) !== "office")));
        if (bad) return refuse("COUNTERPARTY_REFUSED", localize("actions.index.copied_i_entity_id_names", "copied[{i}].entity_id names a person or no office the subject registry holds: a copied office is an office, never a private individual (R77, R9). Nothing was written.", { i: String(bad.i) }),
          { findings: [{ check: "C-2.10", detail: localize("actions.index.copied_i_entity_id_not", "copied[{i}].entity_id: not an office entity (R9, arm: office)", { i: String(bad.i) }) }] });
      }
    }
    /* R78: partners, organisations by role, stated by a member. */
    if (moved("partners")) {
      /* DEC-49 REGION is-machine-set-partners */
      if (machine) return refuse("MACHINE_CANNOT_SET_PARTNERS", "the partner organisations of a joint action are a "
        + "member's statement; a machine credential may not set or change them. Nothing was written.");
      /* END DEC-49 REGION is-machine-set-partners */
      if (stated("partners")) {
        const r = Actions.#fromFindings(Actions.#pushed(partnersFindings, nextFm), "PARTNERS_REFUSED");
        if (r) return r;
        const list = Array.isArray(nextFm.partners) ? nextFm.partners : [];
        for (let i = 0; i < list.length; i++) {
          const eid = list[i] && typeof list[i].entity_id === "string" ? list[i].entity_id.trim() : "";
          if (!eid) continue;
          const kind = this.#entityKind(eid);
          /* DEC-49 REGION is-partners-entity */
          if (!ORGANISATION_KINDS.includes(kind))
            return refuse("PARTNERS_REFUSED", `partners[${i}].entity_id names ${kind ? `an entity of kind ${kind}` : "no entity "
              + "the subject registry holds"}: a partner is an organisation, never a person. Nothing was written.`,
              { entry: i, findings: [{ check: "C-2.10", detail: `partners[${i}].entity_id is not an organisation (R78)` }] });
          /* END DEC-49 REGION is-partners-entity */
        }
      }
    }
    /* R79: press terms, on a press action, stated by a member; each change kept in the history (R36). */
    if (moved("press_terms")) {
      /* DEC-49 REGION is-machine-set-press-terms */
      if (machine) return refuse("MACHINE_CANNOT_SET_PRESS_TERMS", "the terms agreed with the press are a member's "
        + "statement; a machine credential may not set or change them. Nothing was written.");
      /* END DEC-49 REGION is-machine-set-press-terms */
      if (stated("press_terms")) {
        const r = Actions.#fromFindings(Actions.#pushed(pressTermsFindings, nextFm), "PRESS_TERMS_REFUSED");
        if (r) return r;
      }
    }
    /* R82: whether the body owes the group a reply, with the member's reason (`reply_owed_reason`). */
    if (moved("reply_owed") || moved("reply_owed_reason")) {
      /* DEC-49 REGION is-machine-set-reply-owed */
      if (machine) return refuse("MACHINE_CANNOT_SET_REPLY_OWED", localize("actions.index.whether_a_body_owes_the", "whether a body owes the team a reply is a member's statement; a machine credential may not set or change it. Nothing was written."));
      /* END DEC-49 REGION is-machine-set-reply-owed */
      /* the value and its reason are judged together by action-grammar R23 (K2861): one site for REPLY_OWED_REFUSED */
      const r = Actions.#fromFindings(Actions.#pushed(actionFieldFindings,
        { reply_owed: nextFm.reply_owed, reply_owed_reason: nextFm.reply_owed_reason }, { bundleId: c.bundleId }), "REPLY_OWED_REFUSED");
      if (r) return r;
    }
    /* R86: the earlier action this one follows, stated on its creation and never changed. */
    if (moved("follows_action")) {
      /* DEC-49 REGION is-follows-action-rewritten */
      if (heldFm) return refuse("FOLLOWS_ACTION_REWRITTEN", "the action an action follows is stated when it is created "
        + "and never set, changed or removed by a revision. Nothing was written.");
      /* END DEC-49 REGION is-follows-action-rewritten */
      if (stated("follows_action")) {
        const r = Actions.#fromFindings(Actions.#pushed(actionFieldFindings, { follows_action: nextFm.follows_action },
          { bundleId: c.bundleId }), "FOLLOWS_ACTION_REFUSED");
        if (r) return r;
        const f = nextFm.follows_action;
        const target = f && typeof f === "object" && typeof f.action === "string" ? f.action.trim() : "";
        const b = target ? this.#visibleAction(target, viewer) : null;
        if (!b || normalizeType(b.object_type) !== "action") return noSuchAction(target || null);
      }
    }
    /* R81, R83, R94: the fields of an entry new or changed in this version (speaker, office_status, found_elsewhere). */
    const heldLedger = heldFm && Array.isArray(heldFm.correspondence) ? heldFm.correspondence : [];
    const ledger = Array.isArray(nextFm.correspondence) ? nextFm.correspondence : [];
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      if (!e || typeof e !== "object" || JSON.stringify(e) === JSON.stringify(heldLedger[i] ?? null)) continue;
      if (!ENTRY_FIELD_KEYS.some((k) => e[k] !== undefined) && !Object.keys(e).some(isMinutesKey)) continue;
      const r = this.#entryFieldRefusal(ledger, i, nextFm.action_kind, who,
        JSON.stringify(e.speaker ?? null) !== JSON.stringify(heldLedger[i] ? heldLedger[i].speaker ?? null : null));
      if (r) return r;
    }
    return null;
  }

  /* R81, R83, R94 (T45): an entry's T45 fields, as the act and the write judge them: a speaker set by a member only and
     naming one (`contactNotAMember`), then action-grammar's R22 over the entry with the governing view's response
     statuses for the action's kind. */
  #entryFieldRefusal(ledger, i, kind, who, speakerMoved) {
    const e = ledger[i];
    if (speakerMoved && e.speaker !== undefined && e.speaker !== null) {
      /* DEC-49 REGION is-machine-contact-speaker */
      if (!who || isMachineIdentity(who))
        return refuse("MACHINE_CANNOT_SET_CONTACT", localize("actions.index.who_spoke_for_the_team", "who spoke for the team in a sending is a member's statement; a machine credential may not set it. Nothing was written."));
      /* END DEC-49 REGION is-machine-contact-speaker */
    }
    /* R108: minutes only on a received entry of a public comment, the date a real day (the write's half; the act judges
       the passage). */
    if (Object.keys(e).some(isMinutesKey)) {
      if (e.direction !== "received" || kind !== PUBLIC_COMMENT || !this.kinds().includes(PUBLIC_COMMENT))
        return refuse("MINUTES_NOT_PUBLIC_COMMENT", word("screen.action.minutes.notpublic"), { field: `correspondence[${i}]` });
      if (!isCalendarDate(String(e.minutes_date ?? "")))
        return this.records.correspondEntryRefusal({ at: String(e.minutes_date ?? ""), artifactSha: "", account: "x" },
          { target: null, detail: CORRESPOND_DETAIL });
    }
    const r = Actions.#fromFindings(Actions.#errors(entryFieldFindings(ledger, i,
      { responseStatuses: this.#responseStatuses(kind) || [] })), "CORRESPONDENCE_REFUSED");
    if (r) return r;
    if (speakerMoved && e.speaker !== undefined && e.speaker !== null) {
      const id = contactId(e.speaker);
      let facts = null;
      if (id) { try { facts = this.membership.memberFacts(id); } catch { facts = null; } }
      if (!facts) return contactNotAMember({ field: `correspondence[${i}].speaker` });
    }
    return null;
  }

  /** R108 (T51): the minutes an entry holds, `{meeting, date, passage: {captureSha, extent}}`, from the flat keys the bytes
   *  carry (`minutes_meeting`, `minutes_date`, `minutes_capture`, `minutes_extent_*`; K2849), the extent read by content's
   *  one reader of a flat extent (`citationExtent`); null for an entry holding none. Pure; never throws. */
  static minutesOf(e) {
    try {
      if (!e || typeof e !== "object" || !Object.keys(e).some(isMinutesKey)) return null;
      const leg = { extent_kind: e.minutes_extent_kind };
      for (const f of [...MINUTES_EXTENT_FIELDS, "rect"])
        if (e[`minutes_extent_${f}`] !== undefined) leg[`extent_${f}`] = e[`minutes_extent_${f}`];
      return { meeting: e.minutes_meeting ?? null, date: e.minutes_date ?? null,
               passage: { captureSha: e.minutes_capture ?? null, extent: citationExtent(leg),
                          content_id: e.minutes_content_id ?? null } };
    } catch { return null; }
  }

  /* R108: the minutes as the act is given them, an object or its JSON: `{meeting, date, passage: {captureSha, extent}}`.
     Only the shape is judged here (`{ok: false}`, which `actionCorrespond` answers as `BAD_MINUTES`). */
  static #minutesGiven(v) {
    if (v === null || v === undefined || v === "") return { ok: true, minutes: null };
    let m = v;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch { m = null; } }
    const line = (x) => typeof x === "string" && x.trim() !== "" && x.trim().length <= MINUTES_MEETING_MAX && !/["\\\r\n]/.test(x);
    const sha = m && typeof m === "object" && m.passage && typeof m.passage.captureSha === "string"
      ? m.passage.captureSha.trim().replace(/^sha256:/, "").toLowerCase() : "";
    const ext = m && typeof m === "object" && m.passage ? m.passage.extent : null;
    if (!m || typeof m !== "object" || Array.isArray(m) || !line(m.meeting) || typeof m.date !== "string"
        || !/^[0-9a-f]{64}$/.test(sha) || !ext || typeof ext !== "object" || Array.isArray(ext))
      return { ok: false };
    return { ok: true, minutes: { meeting: m.meeting.trim(), date: m.date.trim(), passage: { captureSha: sha, extent: ext } } };
  }

  /* R108: null when `minutes` may be kept on this entry; else the refusal. Only a received entry of a public comment carries
     them (`MINUTES_NOT_PUBLIC_COMMENT`); the passage cites a capture the author sees, an unseen one answered as an absent one
     (`NO_SUCH_BUNDLE`), at an extent content's grammar admits (its refusals, as content answers them), and one the entry can
     hold flat. */
  #minutesRefusal(minutes, viewer) {
    const { captureSha, extent } = minutes.passage;
    const gate = viewerPredicate(viewer);
    const home = this.#one(`SELECT r.bundle_id FROM register r JOIN bundles b ON b.bundle_id = r.bundle_id
        WHERE r.capture_sha=? AND (${gate.sql}) LIMIT 1`, captureSha, ...gate.args);
    if (!home) return { foreign: { ok: false, reason: "NO_SUCH_BUNDLE", target: captureSha } };
    const context = this.content.contentContextFor(captureSha);
    const bad = checkContentExtent(extent, context);
    if (bad) return { foreign: bad };
    const kept = Actions.#minutesKept(minutes);
    const back = Actions.minutesOf(kept);
    let same = false;
    try { same = !!back && canonicalExtent(back.passage.extent) === canonicalExtent(extent); } catch { same = false; }
    if (!same) return { bad: "passage" };
    /* R108 (K4041): the passage is recorded as content by the author's act (mint or find, content R12, R13), and the row's
       id is kept beside the capture and the extent, so a reader of the minutes (filings R64) reads its text by that id. */
    const m = this.content.mint({ bundleId: home.bundle_id, captureSha, extent, mintedBy: viewer, context });
    if (!m || m.ok === false) return m ? { foreign: m } : { bad: "passage" };
    minutes.passage.content_id = m.content_id;
    return null;
  }

  /* R108: the flat keys an entry holds `minutes` under; an extent field that is not a plain token, a number or four numbers
     is left out, so `#minutesRefusal`'s read-back finds the extent changed and refuses. */
  static #minutesKept(minutes) {
    const x = minutes.passage.extent;
    const out = { minutes_meeting: minutes.meeting, minutes_date: minutes.date, minutes_capture: minutes.passage.captureSha,
                  minutes_extent_kind: String(x.kind),
                  ...(minutes.passage.content_id ? { minutes_content_id: minutes.passage.content_id } : {}) };
    for (const f of [...MINUTES_EXTENT_FIELDS, "rect"]) {
      const v = x[f];
      if (v === undefined || v === null || v === "") continue;
      const text = typeof v === "string" && v.length <= MINUTES_MEETING_MAX && !/["\\\r\n]/.test(v);
      if (typeof v === "number" || text || (f === "rect" && Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number")))
        out[`minutes_extent_${f}`] = v;
    }
    return out;
  }

  /** R81, R83, R94 (T45): an entry with its T45 fields as R22 names them: `office_status: {words, status?}` and
   *  `found_elsewhere: {kind, note?}` from the flat keys the bytes hold (`office_words`, `office_status`,
   *  `found_elsewhere`, `found_elsewhere_note`; J2's reading), `speaker` as written. Other keys as they are. */
  static entryFields(e) {
    if (!e || typeof e !== "object") return e;
    const { office_words, office_status, found_elsewhere, found_elsewhere_note, pressure_kind, pressure_note, ...held } = e;
    const rest = Object.fromEntries(Object.entries(held).filter(([k]) => !isMinutesKey(k)));
    const out = { ...rest };
    const minutes = Actions.minutesOf(e);
    if (minutes) out.minutes = minutes;
    if (pressure_kind !== undefined || pressure_note !== undefined)
      out.pressure = { ...(pressure_kind !== undefined ? { kind: pressure_kind } : {}),
                       ...(pressure_note !== undefined ? { note: pressure_note } : {}) };
    if (office_words !== undefined || office_status !== undefined)
      out.office_status = { ...(office_words !== undefined ? { words: office_words } : {}),
                            ...(office_status !== undefined ? { status: office_status } : {}) };
    if (found_elsewhere !== undefined || found_elsewhere_note !== undefined)
      out.found_elsewhere = { ...(found_elsewhere !== undefined ? { kind: found_elsewhere } : {}),
                              ...(found_elsewhere_note !== undefined ? { note: found_elsewhere_note } : {}) };
    return out;
  }

  /* R3 (N237, K351): a document holding more legs or entries than the projection reads is refused where it is authored
     or revised, with the count and the limit; a replay is never asked (the projection skips it whole). */
  #tooLarge(fm) {
    const legs = Array.isArray(fm.action_basis) ? fm.action_basis.length : 0;
    const ledger = Array.isArray(fm.correspondence) ? fm.correspondence.length : 0;
    if (legs <= ACTION_LEGS_MAX && ledger <= ACTION_LEDGER_MAX) return null;
    const part = legs > ACTION_LEGS_MAX ? "action_basis" : "correspondence";
    const count = part === "action_basis" ? legs : ledger;
    const limit = part === "action_basis" ? ACTION_LEGS_MAX : ACTION_LEDGER_MAX;
    /* DEC-49 REGION is-action-too-large */
    return refuse("ACTION_TOO_LARGE", localize("actions.index.this_actions_part_holds_count", "this action's {part} holds {count} entries; an action holds at most {limit}. Nothing was written.", { part: String(part), count: String(count), limit: String(limit) }), { part, count, limit });
    /* END DEC-49 REGION is-action-too-large */
  }

  /** R1–R3, R5–R8, R33: this module's check, run inside every promotion before the write (promotion R39). */
  check(c) {
    const { pkg, meta, author, bundleId, files, head } = c;
    const md = (files || []).find((f) => f && f.path === "bundle.md");
    const nextFm = c.docFm && typeof c.docFm === "object" ? c.docFm
      : (md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null);
    const heldFm = head ? this.#heldFm(bundleId) : null;
    const isAction = normalizeType(meta && meta.object_type) === "action"
      || (nextFm && typeof nextFm === "object" && normalizeType(nextFm.object_type) === "action");
    const laws = this.#lawsFence(c, heldFm, nextFm, isAction);
    if (laws) return laws;
    const who = String(author ?? "").trim();
    /* D-505: both spellings of "this is an action", and the union can only add refusals. Replay is exempt from the
       shape arms: the record's own history must be holdable verbatim. */
    if (isAction && nextFm && typeof nextFm === "object" && !pkg.replay) {
      const tier = this.#tierFence(c, heldFm, nextFm, who);
      if (tier) return tier;
      const law = this.#machineRecordsLawRefusal(heldFm, nextFm, who, !head);
      if (law) return law;
      const arms = this.#writeArms(c, heldFm, nextFm, who);
      if (arms) return arms;
      const premise = this.#overrideAndAddressee(heldFm, nextFm, who);
      if (premise) return premise;
      const link = this.#contactAndPlan(c, heldFm, nextFm, who);
      if (link) return link;
      const t33 = this.#heldLinks(heldFm, nextFm, who, pkg.actorViewer ?? pkg.viewer ?? c.viewer ?? (who || null));
      if (t33) return t33;
      const seeks = this.#seeksFence(heldFm, nextFm, who);
      if (seeks) return seeks;
      const t45 = this.#t45Fields(c, heldFm, nextFm, who, pkg.actorViewer ?? pkg.viewer ?? c.viewer ?? (who || null));
      if (t45) return t45;
      const large = this.#tooLarge(nextFm);
      if (large) return large;
      /* REC-24: the legs (ACTION_BASIS_REFUSED), the ledger (CORRESPONDENCE_REFUSED) and what only the record can
         resolve — a leg or a hash naming nothing it holds. */
      const af = []; actionBasisFindings(nextFm, af);
      if (af.some((x) => x.severity === "error")) return refuse("ACTION_BASIS_REFUSED", undefined, { findings: findingsOf(af) });
      const cf = []; correspondenceFindings(nextFm, cf);
      if (cf.some((x) => x.severity === "error")) return refuse("CORRESPONDENCE_REFUSED", undefined, { findings: findingsOf(cf) });
      for (const leg of (Array.isArray(nextFm.action_basis) ? nextFm.action_basis : [])) {
        if (!leg || typeof leg.target !== "string") continue;
        if (!this.#one(`SELECT bundle_id FROM bundles WHERE bundle_id=?`, leg.target)
            && !(leg.kind === "rests_on" && this.#successRecord(leg.target, pkg.actorViewer ?? pkg.viewer ?? c.viewer ?? (who || null))))
          return refuse("ACTION_BASIS_REFUSED", undefined, { target: leg.target, findings: [{ check: "C-2.10",
            detail: `action_basis target '${leg.target}' does not resolve in this store: an action that names why it `
                  + "exists names something that exists, or it points a reader at nothing while claiming a reason" }] });
      }
      for (const e of (Array.isArray(nextFm.correspondence) ? nextFm.correspondence : [])) {
        if (!e || typeof e.artifact_sha !== "string" || !e.artifact_sha.trim()) continue;
        const sha = e.artifact_sha.trim().replace(/^sha256:/, "").toLowerCase();
        if (!this.#one(`SELECT capture_sha FROM register WHERE capture_sha=?`, sha))
          return refuse("CORRESPONDENCE_REFUSED", undefined, { artifact_sha: sha, findings: [{ check: "C-2.10",
            detail: localize("actions.index.correspondence_artifact_sha_sha_does", "correspondence artifact_sha '{sha}...' does not resolve in the register: an entry claiming captured bytes names bytes this store holds, or it is testimony and says so with an account and an author (DEC-13)", { sha: String(sha.slice(0, 16)) }),
            repairs: ["capture the artifact first (op=capture), then record its sha", "or record a named account instead"] }] });
      }
      /* R8 (K256, N271): the determination is read as the act's viewer sees it: the session's viewer the control plane
         stamps on `op=promote` (`actorViewer`, promotion's "For callers"), else the viewer this module's own acts pass;
         a write that names neither reads as its author. */
      const breach = this.#breachRefusal(nextFm, pkg.actorViewer ?? pkg.viewer ?? c.viewer ?? (who || null));
      if (breach) return breach;
    }
    /* REC-24 (g) / C-6.1: a responds_to edge's shape from the catalogue, its resolution from the record. */
    if (nextFm && typeof nextFm === "object" && !pkg.replay) {
      const rf = []; respondsToEdgeFindings(nextFm, rf);
      if (rf.some((x) => x.severity === "error")) return refuse("RESPONDS_TO_REFUSED", undefined, { findings: findingsOf(rf) });
      for (const r of (Array.isArray(nextFm.references) ? nextFm.references : [])) {
        if (!r || typeof r !== "object" || r.rel !== "responds_to") continue;
        if (!this.#one(`SELECT bundle_id FROM bundles WHERE bundle_id=?`, r.target))
          return refuse("RESPONDS_TO_REFUSED", undefined, { target: r.target, findings: [{ check: "C-6.1",
            detail: `responds_to target '${r.target}' does not resolve in this store: this document claims to be `
                  + "what came back from an ask that is not here" }] });
      }
    }
    return null;
  }

  /* R8 (e), R93 (T45): the live success record `id` names, as the viewer reads it (`consequences.successRecordRead`, its
     R20), or null when it names none the viewer may see, none is live, or no success record can be read here. Its answer
     nests the record under `success`, where `live` and `superseded_by` stand (a superseded record reads ok with live false). */
  #successRecord(id, viewer) {
    const cons = this.consequences;
    if (!cons || typeof cons.successRecordRead !== "function" || typeof id !== "string" || !SUCCESS_RECORD_ID_RE.test(id)) return null;
    let r = null;
    try { r = cons.successRecordRead({ id, viewer }); } catch { r = null; }
    const s = r && r.ok !== false && r.success && typeof r.success === "object" ? r.success : null;
    return s && s.live === true && !s.superseded_by ? s : null;
  }

  /* R8: an action recorded for a breach (`breach: true`) rests on a live conformance determination the author may see,
     noncompliant for at least one standard it names (T45 (a); K2781 (4)) and not void (T45 (b), conformance R33). With no
     conformance provider the determination cannot be read, and the write is refused, never passed. Each leg is asked
     superseded, then void, then noncompliant (J1 1: a void determination reads every outcome undetermined); the act
     passes on any leg that is all three, else the first condition found in that order answers. */
  #breachRefusal(fm, viewer) {
    if (fm.breach !== true) return null;
    /* R8 (K600 (a)), R74: a member's premise override, judged by `#overrideAndAddressee` before this, stands in for the
       determination; it is disclosed on everything prepared from the action (`filings` R24, R75 here). */
    if (Actions.overrideOf(fm)) return null;
    const legs = (Array.isArray(fm.action_basis) ? fm.action_basis : [])
      .filter((l) => l && typeof l === "object" && l.kind === "rests_on" && typeof l.target === "string");
    const conf = this.conformance;
    const readable = !!conf && typeof conf.determinationRead === "function";
    let superseded = null, voided = null, notNoncompliant = null;
    for (const l of (readable ? legs : [])) {
      let d = null;
      try { d = conf.determinationRead({ id: l.target, viewer }); } catch { d = null; }
      if (!d || d.ok === false) continue;
      if (d.live === false || d.superseded_by) { superseded ||= { id: l.target, by: d.superseded_by ?? null }; continue; }
      if (d.void) { voided ||= { id: l.target, causes: Array.isArray(d.void.causes) ? d.void.causes : [] }; continue; }
      if (!Actions.#noncompliant(d)) { notNoncompliant ||= l.target; continue; }
      return null;
    }
    /* N312 (K275): the condition is conformance's, and its answer is minted there (its R20). */
    if (superseded) return determinationSuperseded(superseded.id, superseded.by);
    /* T45 (b): the void determination's answer is conformance's own (its R33). */
    if (voided) return determinationVoided(voided.id, voided.causes);
    /* DEC-49 REGION is-breach-not-noncompliant */
    if (notNoncompliant)
      return refuse("DETERMINATION_NOT_NONCOMPLIANT", "an action recorded for a breach rests on a determination that the "
        + "government acted out of conformance with at least one standard it names; the determination it names records "
        + "no noncompliant outcome. Nothing was written.", { determination: notNoncompliant });
    /* END DEC-49 REGION is-breach-not-noncompliant */
    /* DEC-49 REGION is-breach-determination */
    return refuse("ACTION_NO_DETERMINATION", readable
      ? "an action recorded for a breach rests on a live conformance determination you may see, as a rests_on leg. "
        + "None of its legs names one. Nothing was written."
      : localize("actions.index.an_action_recorded_for_a_2", "an action recorded for a breach rests on a conformance determination, and no determination can be read on your team's Civicsmith yet, so none could be found. Nothing was written."),
      readable ? {} : { cause: "CONFORMANCE_UNAVAILABLE" });
    /* END DEC-49 REGION is-breach-determination */
  }
  /* R8 (a): a determination noncompliant for at least one standard, as `determinationRead` answers its outcomes. */
  static #noncompliant(d) {
    return (Array.isArray(d.outcomes) ? d.outcomes : []).some((o) => o && o.outcome === "noncompliant");
  }
  /* R8, R75, R76, R93: each `rests_on` leg's determination as the viewer reads it, `{id, d}`; legs naming none skipped. */
  #legDeterminations(fm, viewer) {
    const conf = this.conformance;
    if (!conf || typeof conf.determinationRead !== "function") return [];
    const out = [];
    for (const l of (Array.isArray(fm && fm.action_basis) ? fm.action_basis : [])) {
      if (!l || typeof l !== "object" || l.kind !== "rests_on" || typeof l.target !== "string") continue;
      let d = null;
      try { d = conf.determinationRead({ id: l.target, viewer }); } catch { d = null; }
      if (d && d.ok !== false) out.push({ id: l.target, d });
    }
    return out;
  }

  /** R3, R11: this module's projection, in the promotion's transaction after the write: legs, ledger and quotes
   *  replaced whole from the document. A malformed replayed entry is skipped, never half-written. It reads at most
   *  `ACTION_LEGS_MAX` legs and `ACTION_LEDGER_MAX` entries (N237): a replayed document holding more is skipped whole,
   *  its rows cleared and none written, never half-projected (the write refuses one, `#tooLarge`). */
  project(c) {
    const { bundleId, promotedType } = c;
    const fm = c.docFm;
    /* R11: a leg's pinned capture is kept as it was first stamped; a leg new in this version is stamped now. The rows
       held are this projection's own, so never more than it writes. */
    const held = new Map(this.#rows(`SELECT target_id, kind, extent_capture FROM action_basis WHERE bundle_id=?
      ORDER BY ord LIMIT ?`, bundleId, ACTION_LEGS_MAX)
      .map((r) => [`${r.target_id}\u0000${r.kind}`, r.extent_capture]));
    this.sql.exec(`DELETE FROM action_basis WHERE bundle_id=?`, bundleId);
    this.sql.exec(`DELETE FROM correspondence WHERE bundle_id=?`, bundleId);
    this.sql.exec(`DELETE FROM action_quotes WHERE bundle_id=?`, bundleId);
    if (promotedType !== "action" || !fm || typeof fm !== "object") return null;
    /* R8: who stated the premise override and when, stamped once, the first time a version carries it. */
    const ov = Actions.overrideOf(fm);
    if (ov) this.sql.exec(`INSERT INTO action_overrides (bundle_id, reason, ground, stated_by, at) VALUES (?,?,?,?,?)
      ON CONFLICT(bundle_id) DO NOTHING`, bundleId, ov.reason, ov.ground ? JSON.stringify(ov.ground) : null,
      c.author ? String(c.author) : null, stampInstant("second", this.#nowMs(null)));
    /* R79, R82 (T45): who changed the press terms or the reply-owed state, and when, appended when this version's value
       differs from the latest held; never rewritten (R36). */
    for (const [field, value, reason] of [["press_terms", fm.press_terms ?? null, null],
                                          ["reply_owed", fm.reply_owed ?? null, fm.reply_owed_reason ?? null]]) {
      const last = this.#one(`SELECT seq, value FROM action_field_history WHERE bundle_id=? AND field=? ORDER BY seq DESC
        LIMIT 1`, bundleId, field);
      const v = JSON.stringify(value);
      if (last ? last.value === v : value === null) continue;
      this.sql.exec(`INSERT INTO action_field_history (bundle_id, field, seq, value, reason, by, at) VALUES (?,?,?,?,?,?,?)`,
        bundleId, field, last ? last.seq + 1 : 1, v, typeof reason === "string" ? reason : null,
        c.author ? String(c.author) : null, stampInstant("second", this.#nowMs(null)));
    }
    if ((Array.isArray(fm.action_basis) && fm.action_basis.length > ACTION_LEGS_MAX)
        || (Array.isArray(fm.correspondence) && fm.correspondence.length > ACTION_LEDGER_MAX)) return null;
    const alegs = Array.isArray(fm.action_basis) ? fm.action_basis : [];
    for (let i = 0; i < alegs.length; i++) {
      const leg = alegs[i];
      if (!leg || typeof leg.target !== "string") continue;
      const type = normalizeType(OBJECT_TYPES[leg.target.split("-")[0]]) ?? "";
      const key = `${leg.target}\u0000${typeof leg.kind === "string" ? leg.kind : ""}`;
      let pinned = typeof leg.extent_capture === "string" && /^[0-9a-f]{64}$/.test(leg.extent_capture) ? leg.extent_capture : null;
      if (!pinned && held.has(key)) pinned = held.get(key) ?? null;
      else if (!pinned && !held.has(key) && type === "information") {
        try { pinned = this.content.captureFor(leg.target) || null; } catch { pinned = null; }
      }
      this.sql.exec(`INSERT INTO action_basis (bundle_id,ord,target_id,target_type,kind,note,at,extent_capture) VALUES (?,?,?,?,?,?,?,?)`,
        bundleId, i, leg.target, type, typeof leg.kind === "string" ? leg.kind : "",
        typeof leg.note === "string" ? leg.note : null, leg.date != null ? String(leg.date) : null, pinned);
    }
    const entries = Array.isArray(fm.correspondence) ? fm.correspondence : [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || typeof e !== "object") continue;
      const sha = typeof e.artifact_sha === "string" && e.artifact_sha.trim()
        ? e.artifact_sha.trim().replace(/^sha256:/, "").toLowerCase() : null;
      const reg = sha ? this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, sha) : null;
      this.sql.exec(
        `INSERT INTO correspondence (bundle_id,ord,direction,at,medium,party,artifact_bundle_id,artifact_sha,account,author,recorded_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        bundleId, i, typeof e.direction === "string" ? e.direction : "", e.at != null ? String(e.at) : "",
        typeof e.medium === "string" ? e.medium : null, typeof e.party === "string" ? e.party : null,
        reg ? reg.bundle_id : (typeof e.artifact_bundle_id === "string" ? e.artifact_bundle_id : null), sha,
        typeof e.account === "string" && e.account.trim() ? e.account : null,
        typeof e.author === "string" && e.author.trim() ? e.author : null,
        typeof e.recorded_at === "string" ? e.recorded_at : null);
    }
    const cpName = counterpartyName(fm.counterparty);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!isQuoteEntry(e) || quoteFindings(entries, i).length) continue;
      this.sql.exec(
        `INSERT INTO action_quotes (bundle_id,ord,amount,value,currency,basis,answers_ord,revises_ord,counterparty,at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        bundleId, i, String(e.quote_amount).trim(), quoteValue(e.quote_amount), String(e.quote_currency).trim(),
        e.quote_basis !== undefined && e.quote_basis !== null && String(e.quote_basis).trim() ? String(e.quote_basis) : null,
        Number(String(e.quote_answers).trim()),
        e.quote_revises !== undefined && e.quote_revises !== null && String(e.quote_revises).trim() !== ""
          ? Number(String(e.quote_revises).trim()) : null,
        cpName, e.at != null ? String(e.at) : "");
    }
    return null;
  }

  /** R51: the audit's action arm over one bundle image (record-core R59): C-2.10's arms and C-11.1 over an action,
   *  and C-6.1's `responds_to` arm over any document. */
  audit(image) {
    const files = image && image.files instanceof Map ? image.files : null;
    const md = files ? files.get("bundle.md") : null;
    const text = typeof md === "string" ? md : md instanceof Uint8Array ? new TextDecoder().decode(md) : null;
    if (text === null) return [];
    let fm = null;
    try { fm = parseFrontmatter(text).data; } catch { fm = null; }
    if (!fm || typeof fm !== "object") return [];
    const findings = [];
    respondsToEdgeFindings(fm, findings);
    if (fm.object_type === "action")
      /* R51, R100 (K1444 (iii)): the zone of the action's office or venue, as R12 reads it; none held, none handed. */
      checkActionExtension({ fm, nowMs: this.#nowMs(null), actionKinds: this.kinds(), zone: this.zoneRead(fm).zone },
        findings);
    return findings;
  }

  /* REC-24 (c): MOVING AN ACTION THROUGH ITS OWN STATE MACHINE — the first op
   * in this plane whose subject is an action at all.
   *
   * WHY IT EXISTS. `STATES.action` has carried five states and seven edges since
   * the catalog was written, and NOTHING wrote them: SB-OUTPUT §4 measured the
   * whole diagram as dashed, with the creation of the bundle the only node that
   * ran. An act the table permits and no caller can perform is the state machine
   * lying, which is exactly what REC-31 said about `deferred -> open`.
   *
   * THE EDGE TABLE IS THE CATALOG'S AND THERE IS NO SECOND COPY. This is the
   * NAMED hazard of this item, not a general principle: `op=dispose` held its own
   * literal copy of the disposition set until REC-10 rewired it, and the whole
   * cost of that copy was that the publication and the refusal could disagree
   * about what was legal. So legality here comes from `vocabFor(STATES, …)` over
   * the DECLARED object_type — the MAP RULE, sixth consulting site — and this
   * method contains no state list of its own. Grep it: NO string from the action
   * vocabulary appears in this method at all.
   *
   * CORRECTED 2026-08-05 (REC-39), and the old sentence is worth keeping as the
   * receipt: it read "the only strings from the action vocabulary in this file
   * below are the four RESOLUTIONS, which are C-2.10's and are imported nowhere
   * because they are checked by the catalog itself a moment later". Every clause
   * was true and the conclusion was wrong. Being re-checked downstream makes a
   * copy HARMLESS at the write; it does not make it one array. The refusal this
   * method returns carries `legal:` — the option set a surface renders — so the
   * copy was load-bearing on the way OUT even though it was redundant on the way
   * in, and a word changed in the catalog would have left this act offering the
   * old one. RESOLUTIONS is imported now.
   *
   * THE REASON IS REQUIRED AND NEVER PREFILLED, op=reopen's rule and for its
   * reason: an action moving is the group deciding to send something outside the
   * system, or deciding it is finished, and a move with no account of why cannot
   * be checked by anyone including its author. Nothing is derived, defaulted or
   * proposed.
   *
   * A NAMED MEMBER MOVES IT. The author stamp arrives from the session and a
   * machine credential's is `token:<class>`, refused BY SHAPE. This follows
   * MACHINE_CANNOT_CONCLUDE / _RELEASE / _REOPEN and it is the same judgement:
   * an action is the one construct that reaches OUTSIDE this system and touches
   * people who never agreed to be in it, so a scheduler must not be able to
   * advance one. A machine may surface, gather and prepare (D-78, DEC-24); it
   * may not decide that the group is now asking somebody for something.
   *
   * WHAT IT DELIBERATELY DOES NOT DO: it does not touch the clock. A clock entry
   * that has fallen past due is a REAL finding about the document (C-11.1) and
   * this op neither suppresses it nor quietly marks it met — that would be the
   * machine authoring the answer to the question the deadline asked. Overdue is
   * DERIVED on read (see #actionDerived) and what to do about it is the member's. */
  actionMove({ target, to, reason = "", resolution = "", viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-move-action — REC-64/C-32.3. The fence alone. */
    if (!who || isMachineIdentity(who))                 /* REC-46: one predicate */
      return { ok: false, reason: "MACHINE_CANNOT_MOVE_ACTION",
               detail: "moving an action is a named member's decision to reach outside this system, or to "
                     + "declare that reaching out is finished. A machine credential may prepare an action and "
                     + "may never advance one. Sign in as a member." };
    /* END DEC-49 REGION is-machine-move-action */
    const why = String(reason ?? "").trim();
    /* DEC-49 REGION is-move-reason — R13 (N217, K275): this act's own condition, under its own code. */
    if (!why)
      return { ok: false, reason: "ACTION_MOVE_NO_REASON",
               detail: "an action moves for a stated reason, authored by the member moving it and never "
                     + "prefilled. A state change with no account of why cannot be checked by anyone." };
    /* END DEC-49 REGION is-move-reason */
    if (why.length > NOTE_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: `reason is at most ${NOTE_MAX} characters and cannot contain a quote, a `
                     + `backslash, or a newline: the restricted frontmatter grammar has no escapes` };
    if (!target)
      return { ok: false, reason: "NO_TARGET", detail: "one action moves at a time: pass target=<action id>" };

    /* REC-25 / D-15: the same fail-closed viewer gate every read takes; an
       invisible action answers exactly as an absent one. */
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", target, object_type: b.object_type,
               detail: "only an action has an action's state machine." };

    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: "this action has no readable bundle.md, so its state cannot be moved" };
    let text = liveMd.content;
    const fm = parseFrontmatter(text).data || {};

    /* THE MAP RULE. The declared spelling first, so a document is judged by the
       contract it was authored under and not by the type its id prefix implies. */
    const spec = vocabFor(STATES, fm.object_type ?? b.object_type);
    const legal = spec?.legal || [];
    if (!legal.includes(to))
      return { ok: false, reason: "BAD_TARGET_STATE", to, target, legal,
               detail: `an action's state is one of ${legal.join(", ")}` };
    const legalFrom = (spec?.edges?.[b.current_state]) || [];
    if (!legalFrom.includes(to))
      return { ok: false, reason: "ILLEGAL_TRANSITION", to, target, from: b.current_state,
               object_type: fm.object_type ?? b.object_type, legal_from: legalFrom,
               detail: "this is not a legal move in the catalog's state table for this document's own "
                     + "vocabulary. The table is the catalog's and this op holds no copy of it." };

    /* C-2.10's entry requirement for `resolved`, checked BEFORE anything moves so
       this op never mints a bundle the catalog immediately rejects (conclude's
       fourth property). The four words are the catalog's; they are compared
       here and enforced again by C-2.10 on the document that lands.
       REC-39: they are now IMPORTED rather than transcribed. The line that
       stood here was a local literal copy, and the comment above it said the
       words were the catalog's while the array was this file's — which is the
       DISPOSITIONS arrangement REC-11 unwound, and it survived here because
       nothing published the set, so nothing could pin the two identical. */
    const res = String(resolution ?? "").trim();
    /* DEC-49 REGION is-move-resolution — REC-64/C-33.3-4. The two conditions on
       HOW an action ended, which are this pair's whole subject. */
    if (to === "resolved" && !RESOLUTIONS.includes(res))
      return { ok: false, reason: "NO_RESOLUTION", target, legal: RESOLUTIONS,
               detail: "an action that is resolved says HOW it resolved: one of "
                     + `${RESOLUTIONS.join(", ")}. C-2.10 requires it in the resolved state, so a move `
                     + "without one would produce a record the catalog rejects." };
    if (to !== "resolved" && res)
      return { ok: false, reason: "RESOLUTION_WITHOUT_RESOLVING", target, to,
               detail: "a resolution describes how an action ENDED; supplying one on a move to "
                     + `${to} would record an outcome the action has not reached.` };
    /* END DEC-49 REGION is-move-resolution */

    const when = stampInstant("second", this.#nowMs(null));
    const withHistory = Actions.#appendStateHistory(text, {
      timestamp: when, from_state: b.current_state, to_state: to, blurb: why, author: who });
    if (!withHistory)
      return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", target,
               detail: "this document's state_history block cannot be extended in place, and a move recording "
                     + "no transition would leave prior_state pointing at a history the document does not "
                     + "carry (C-4.2)" };
    text = withHistory;
    text = Actions.#setOrAddScalar(text, "prior_state", b.current_state);   /* R14: set, or added where absent */
    text = Actions.#setScalar(text, "current_state", to);
    /* setOrAdd, not set: an action authored before this op existed carries no
       `resolution` key at all, and #setScalar alone would move the state and
       leave the requirement unmet — the bundle the catalog then rejects (the
       REC-13 lesson, verbatim). */
    if (to === "resolved") text = Actions.#setOrAddScalar(text, "resolution", res);
    text = Actions.#setScalar(text, "last_updated", `"${when}"`);
    const entry = `### Session ${when} | Action ${b.current_state} to ${to} | ${who}\n`
                + `Trigger: op=actionmove on ${target}\n`
                + `Changes: state ${b.current_state} to ${to}.`
                + `${to === "resolved" ? ` Resolution: ${res}.` : ""}\n`
                + `Reason: ${why}\n`;
    text = Actions.#appendSessionLog(text, entry);

    const carried = this.#carried(target);

    const bytes = new TextEncoder().encode(text);
    const promoted = this.promotion.promote({
      bundleId: target, base: this.#baseOf(target), snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who, viewer: viewer ?? who,
      files: [{ path: "bundle.md", text, bytes: bytes.length,
                sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: { object_type: fm.object_type ?? b.object_type,
              title: fm.title, current_state: to, prior_state: b.current_state,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    if (!promoted.ok) return { ...promoted, target };
    return { ok: true, target, from: b.current_state, to, reason: why,
             ...(to === "resolved" ? { resolution: res } : {}),
             author: who, at: when, weight: "single" };
  }

  /* REC-24 (d): APPENDING ONE ENTRY TO AN ACTION'S CORRESPONDENCE LEDGER.
   *
   * APPEND ONLY, AND THAT IS THE WHOLE DESIGN. This op adds an entry and can
   * never rewrite one: a correspondence entry that changed is ITSELF A FACT, so
   * a correction is a new dated entry saying so and the earlier statement stays
   * where it was. #spliceCorrespondence appends after the block's last line and
   * touches nothing else, exactly as #spliceBasis does for legs.
   *
   * LEASE THEN PROMOTE. The courtesy lock is taken under the acting member
   * before the document is rewritten, so two members recording what came back at
   * the same moment do not silently lose one entry — and promote's CAS on `base`
   * is still the integrity mechanism, because a lease is a courtesy and not a
   * guarantee (D-61's own wording).
   *
   * CAPTURE OR TESTIFY, REFUSED HERE AND AT THE GATE. The entry carries the
   * bytes we hashed OR a named member's account, never neither and never both.
   * It is refused at this op so the member is told before anything is written,
   * and again by C-2.10 over the document that lands, and again at promote where
   * the hash is resolved against the register — three gates, one rule, in the
   * one construct where "we have it in writing" and "somebody remembers it" are
   * different kinds of evidence and must not be able to be confused.
   *
   * AND THE NON-RESPONSE IS A FIRST-CLASS ENTRY (DEC-13). A refusal to reply is
   * a dated first-party fact about the body and is frequently the more useful
   * one, so it is RECORDED with the date it was due rather than left as an
   * absence a reader has to infer. It takes the testimony arm by construction:
   * nothing arrived, so there are no bytes to hash.
   *
   * THE PRODUCER OF `responds_to` IS HERE. A RECEIVED entry whose artifact
   * resolves to a bundle in this store writes a responds_to edge on THAT
   * document, pointing back at this action — the direction SB-OUTPUT's A10 row
   * specifies, and the reason the relation is no longer a string the vocabulary
   * merely tolerates. Idempotent: an edge already there is not written twice.
   *
   * D-148: A RECEIVED ENTRY MAY CARRY A QUOTE (`quote_amount`, `quote_currency`,
   * `quote_basis`, `quote_answers`, `quote_revises`). The rule is the catalog's
   * `quoteFindings`, run here over the ledger as it WOULD stand, so a member is
   * refused by the C-72 name before anything is written, and the same function
   * reports C-2.10 over the document that lands. An entry with no quote
   * parameter writes exactly the bytes it wrote before D-148.
   *
   * D-147: AND IT MAY CARRY ITS PLACE IN THE RECORDS-REQUEST LIFECYCLE (`stage`,
   * `follows`, `outcome`, `exemptions`, `due_by`, `due_cite`) — the catalog's
   * `lifecycleFindings`, run here the same way. A due date's citation is judged
   * HERE against the action's governing laws as they stand when it is stated
   * (DUE_CITE_NOT_GOVERNING), and only here: see the catalog's comment for why
   * the document-level rule does not. No due date is ever computed. An entry
   * with no lifecycle parameter writes exactly the bytes it wrote before. */
  actionCorrespond({ target, direction = "", at = "", medium = "", party = "",
                     artifactSha = "", account = "", quoteAmount = "", quoteCurrency = "",
                     quoteBasis = "", quoteAnswers = "", quoteRevises = "",
                     stage = "", follows = "", outcome = "", exemptions = "", dueBy = "", dueCite = "",
                     speaker = "", officeStatus = null, foundElsewhere = null, minutes = null,
                     pressure = null, viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    /* R101 (T48; N1024, K231): C-32.4 is `action-records.correspondFence`'s, the one site, its `detail` this act's own. */
    const fence = this.records.correspondFence(who, { detail: CORRESPOND_DETAIL.MACHINE_CANNOT_CORRESPOND });
    if (fence) return fence;
    if (!target)
      return { ok: false, reason: "NO_TARGET", detail: "one entry at a time: pass target=<action id>" };
    /* DEC-49 REGION is-correspond-direction — C-33.5 stays this act's own, its region drawn around the direction alone. */
    if (!CORRESPONDENCE_DIRECTIONS.includes(direction))
      return { ok: false, reason: "BAD_DIRECTION", legal: CORRESPONDENCE_DIRECTIONS, direction,
               detail: localize("actions.index.direction_is_one_of_correspondence", "direction is one of {CORRESPONDENCE_DIRECTIONS}. A reply that never came is recorded as no_response with the date it was due, not omitted (DEC-13).", { CORRESPONDENCE_DIRECTIONS: String(CORRESPONDENCE_DIRECTIONS.join(", ")) }) };
    /* END DEC-49 REGION is-correspond-direction */
    const day = String(at ?? "").trim();
    const sha = String(artifactSha ?? "").trim().replace(/^sha256:/, "").toLowerCase();
    const acct = String(account ?? "").trim();
    /* R101: C-33.6, C-33.7 and C-33.8 are `action-records.correspondEntryRefusal`'s, a date only (R15). */
    const entryRefusal = this.records.correspondEntryRefusal({ at: day, artifactSha: sha, account: acct },
      { target, detail: CORRESPOND_DETAIL });
    if (entryRefusal) return entryRefusal;
    if (sha && !/^[0-9a-f]{64}$/.test(sha))
      return { ok: false, reason: "BAD_SHA", detail: "artifact_sha is a sha256 hash (64 hex characters)" };
    if (sha && direction === "no_response")
      return { ok: false, reason: "NO_RESPONSE_HAS_NO_BYTES", target,
               detail: localize("actions.index.nothing_arrived_so_there_are", "nothing arrived, so there are no bytes to hash. A non-response is recorded as a named account with its date (DEC-13).") };
    for (const [name, v] of [["account", acct], ["medium", String(medium ?? "")], ["party", String(party ?? "")]])
      if (v.length > NOTE_MAX || /["\\\r\n]/.test(v))
        return { ok: false, reason: `BAD_${name.toUpperCase()}`,
                 detail: `${name} is at most ${NOTE_MAX} characters and cannot contain a quote, `
                       + `a backslash, or a newline: the restricted frontmatter grammar has no escapes` };
    /* R108 (T51; N880 (U4); DEC-340): the minutes' account of a public comment, kept on a received entry. Its shape and its
       date are judged here with the entry's other values; what needs the action (its kind) and the record (the capture
       the passage cites) is judged once the action is found. */
    const minutesGiven = Actions.#minutesGiven(minutes);
    /* D-148: the quote, as the entry will carry it. Only keys a caller SENT are
       written, so an entry with no quote parameter is byte-identical to before. */
    const quote = {};
    for (const [k, v] of [["quote_amount", quoteAmount], ["quote_currency", quoteCurrency],
                          ["quote_basis", quoteBasis], ["quote_answers", quoteAnswers],
                          ["quote_revises", quoteRevises]]) {
      const t = String(v ?? "").trim();
      if (t) quote[k] = t;
    }
    /* D-147: the lifecycle keys, likewise only those a caller SENT. */
    const life = {};
    for (const [k, v] of [["stage", stage], ["follows", follows], ["outcome", outcome],
                          ["exemptions", exemptions], ["due_by", dueBy], ["due_cite", dueCite]]) {
      const t = String(v ?? "").trim();
      if (t) life[k] = t;
    }
    const refusal = (code, detail, extra) => {
      const row = QUOTE_CHECKS[code] || LIFECYCLE_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation,
               target, detail, ...(extra || {}) };
    };
    /* DEC-49 REGION is-lifecycle-writable — D-147/C-94.11. The two prose values
       a stage carries are written quoted into a grammar with no escapes; the four
       tokens are bare, so each must be the token its grammar names before any
       byte is spliced (the grammar below judges which token). */
    for (const [k, max] of [["exemptions", NOTE_MAX], ["due_cite", CITATION_MAX]])
      if (life[k] !== undefined && (life[k].length > max || /["\\\r\n]/.test(life[k])))
        return refusal("LIFECYCLE_TEXT_UNWRITABLE",
          `${k} is at most ${max} characters and cannot contain a quote, a backslash, or a newline: the `
          + `restricted frontmatter grammar has no escapes`, { field: k });
    /* END DEC-49 REGION is-lifecycle-writable */
    for (const k of ["stage", "follows", "outcome", "due_by"])
      if (life[k] !== undefined && !/^[a-z0-9_-]{1,40}$/.test(life[k])) {
        /* DEC-49 REGION is-lifecycle-token — D-688/C-94.12 (R22): the token case, under its own name. */
        return refusal("LIFECYCLE_TOKEN_MALFORMED",
          `${k} is a single token of 1 to 40 lower-case letters, digits, underscores or hyphens`, { field: k });
        /* END DEC-49 REGION is-lifecycle-token */
      }
    /* DEC-49 REGION is-quote-writable — D-148/C-72.6. The two prose values a
       quote carries are written quoted into a grammar with no escapes. */
    for (const k of ["quote_currency", "quote_basis"])
      if (quote[k] !== undefined && (quote[k].length > NOTE_MAX || /["\\\r\n]/.test(quote[k])))
        return refusal("QUOTE_TEXT_UNWRITABLE",
          `${k} is at most ${NOTE_MAX} characters and cannot contain a quote, a backslash, or a `
          + `newline: the restricted frontmatter grammar has no escapes`, { field: k });
    /* END DEC-49 REGION is-quote-writable */
    /* R48 (`action-holds` R1): a pressure mark stated with the entry, judged as `action-holds`' `actionPressure` judges one. */
    const mark = pressure === null || pressure === undefined || pressure === "" ? null : Actions.#pressureOf(pressure);
    if (pressure !== null && pressure !== undefined && pressure !== "") {
      const pr = this.#pressureRefusal({ who, mark, direction });
      if (pr) return { ...pr, target };
    }

    /* R81, R83, R94 (T45): the entry's own fields, as given, held flat in the bytes (J2's reading). */
    const t45 = Actions.#entryT45(speaker, officeStatus, foundElsewhere);
    if (!t45.ok) return { ...t45, target };
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", target, object_type: b.object_type,
               detail: "a correspondence ledger belongs to an action: it records what that ask sent and what "
                     + "came back." };
    /* R108: a reply carries minutes only on a received entry of a public comment, and the passage is of a capture the
       author sees, an extent the content grammar admits. */
    let minutesFields = {};
    /* DEC-49 REGION is-minutes */
    if (minutes !== null && minutes !== undefined && minutes !== "") {
      const badMinutes = (detail) => refuse("BAD_MINUTES", detail, { target, max: MINUTES_MEETING_MAX });
      if (!minutesGiven.ok)
        return badMinutes(localize("actions.index.minutes_are_the_meeting_one", "minutes are a meeting, a date and a passage: the meeting named on one line of 1 to 200 characters with no quote or backslash, the day it was held, and the passage of the minutes as a capture and the part of it. Nothing was written."));
      const held = this.#heldFm(target);
      if (direction !== "received" || !held || held.action_kind !== PUBLIC_COMMENT || !this.kinds().includes(PUBLIC_COMMENT))
        return refuse("MINUTES_NOT_PUBLIC_COMMENT", word("screen.action.minutes.notpublic"), { target, direction });
      const dateRefusal = this.records.correspondEntryRefusal({ at: minutesGiven.minutes.date, artifactSha: "", account: "x" },
        { target, detail: CORRESPOND_DETAIL });
      if (dateRefusal) return dateRefusal;
      const r = this.#minutesRefusal(minutesGiven.minutes, viewer ?? who);
      if (r && r.foreign) return { target, ...r.foreign };
      if (r)
        return badMinutes(localize("actions.index.the_passage_has_a_part", "the passage has a part that cannot be kept on the reply's entry: name it by its kind and the fields that kind has. Nothing was written."));
      minutesFields = Actions.#minutesKept(minutesGiven.minutes);
    }
    /* END DEC-49 REGION is-minutes */
    /* Resolved here as well as at promote, so the member is told which half of
       the capture-or-testify choice failed rather than being handed a write
       refusal after the lease was taken. */
    /* R101: C-33.9 is `action-records.unregisteredArtifact`'s. */
    const unregistered = this.records.unregisteredArtifact(sha, { target, detail: CORRESPOND_DETAIL.UNREGISTERED_ARTIFACT });
    if (unregistered) return unregistered;

    /* THE COURTESY LOCK, under the acting member. */
    const lease = this.record.acquireLease(target, who, CORRESPOND_LEASE_MS);
    if (!lease.ok)
      return { ok: false, reason: "LEASE_HELD", target, heldBy: lease.heldBy, until: lease.until,
               detail: "another member is writing to this action right now. The ledger is append-only, so a "
                     + "second writer would not lose an entry — but it would interleave two accounts of the "
                     + "same exchange with no way to tell which was written first." };

    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null) {
      this.#releaseLease(target, who);
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: "this action has no readable bundle.md, so nothing can be appended to it" };
    }
    const fm = parseFrontmatter(liveMd.content).data || {};
    /* R82 (T45; v0.2 rule 6): a body that owes the group no reply is never recorded as not replying. */
    /* DEC-49 REGION is-no-reply-owed */
    if (direction === "no_response" && fm.reply_owed === false) {
      this.#releaseLease(target, who);
      return refuse("NO_REPLY_OWED", localize("actions.index.this_action_states_that_the", "this action states that the body owes the team no reply, so silence is never recorded as a non-response. Nothing was written."), { target, reply_owed: false, ...T45_SENTENCES.reply_not_owed,
          reply_owed_reason: replyOwedReason(fm) });
    }
    /* END DEC-49 REGION is-no-reply-owed */
    const when = stampInstant("second", this.#nowMs(null));
    const ledgerNow = Array.isArray(fm.correspondence) ? fm.correspondence : [];
    const ord = ledgerNow.length;
    const entryFm = {
      direction, at: day,
      ...(String(medium ?? "").trim() ? { medium: String(medium).trim() } : {}),
      ...(String(party ?? "").trim() ? { party: String(party).trim() } : {}),
      ...(sha ? { artifact_sha: sha } : {}),
      ...(acct ? { account: acct } : {}),
      ...quote,
      ...life,
      ...t45.fields,
      ...minutesFields,
      /* R48 (moved to `action-holds` R1, T45; K2781 (1)): a pressure mark stated with the entry stays on the entry, flat
         (K2849), and `action-holds` reads it through `actionRead`; its act and table are that module's. */
      ...(mark ? { pressure_kind: mark.kind, pressure_note: mark.note } : {}),
      /* SERVER-STAMPED. Present on both arms — who put this entry on the record
         is part of the record even when the record is bytes. */
      author: who,
      recorded_at: when,
    };
    /* D-148: the catalog's ONE quote rule, over the ledger as it would stand with
       this entry appended. The lease is given back on a refusal: nothing was
       written and a refused write holds nothing worth protecting. */
    const qf = quoteFindings([...ledgerNow, entryFm], ord);
    if (qf.length) {
      this.#releaseLease(target, who);
      const has = (c) => qf.find((x) => x.code === c);
      const all = { findings: qf };
      /* DEC-49 REGION is-quote-grammar — D-148/C-72.1-5. The first finding, by the
         name the catalog reports over the document too. */
      if (has("QUOTE_NOT_ON_RECEIVED"))
        return refusal("QUOTE_NOT_ON_RECEIVED", has("QUOTE_NOT_ON_RECEIVED").message, all);
      if (has("QUOTE_AMOUNT_NOT_A_NUMBER"))
        return refusal("QUOTE_AMOUNT_NOT_A_NUMBER", has("QUOTE_AMOUNT_NOT_A_NUMBER").message, all);
      if (has("QUOTE_NO_CURRENCY"))
        return refusal("QUOTE_NO_CURRENCY", has("QUOTE_NO_CURRENCY").message, all);
      if (has("QUOTE_ANSWERS_NO_SENT"))
        return refusal("QUOTE_ANSWERS_NO_SENT", has("QUOTE_ANSWERS_NO_SENT").message, all);
      if (has("QUOTE_REVISES_NO_QUOTE"))
        return refusal("QUOTE_REVISES_NO_QUOTE", has("QUOTE_REVISES_NO_QUOTE").message, all);
      /* END DEC-49 REGION is-quote-grammar */
    }
    /* D-147: the catalog's ONE lifecycle rule, over the ledger as it would stand. */
    const lf = lifecycleFindings([...ledgerNow, entryFm], ord);
    if (lf.length) {
      this.#releaseLease(target, who);
      const has = (c) => lf.find((x) => x.code === c);
      const all = { findings: lf };
      /* DEC-49 REGION is-lifecycle-grammar — D-147/C-94.1-9. The first finding, by
         the name the catalog reports over the document too. */
      if (has("STAGE_NOT_OF_DIRECTION"))
        return refusal("STAGE_NOT_OF_DIRECTION", has("STAGE_NOT_OF_DIRECTION").message, all);
      if (has("FOLLOWS_NO_ENTRY"))
        return refusal("FOLLOWS_NO_ENTRY", has("FOLLOWS_NO_ENTRY").message, all);
      if (has("APPEAL_NAMES_NO_DECISION"))
        return refusal("APPEAL_NAMES_NO_DECISION", has("APPEAL_NAMES_NO_DECISION").message, all);
      if (has("OUTCOME_NOT_ON_RECEIVED"))
        return refusal("OUTCOME_NOT_ON_RECEIVED", has("OUTCOME_NOT_ON_RECEIVED").message, all);
      if (has("OUTCOME_NOT_IN_VOCABULARY"))
        return refusal("OUTCOME_NOT_IN_VOCABULARY", has("OUTCOME_NOT_IN_VOCABULARY").message, all);
      if (has("DECISION_WITHOUT_OUTCOME"))
        return refusal("DECISION_WITHOUT_OUTCOME", has("DECISION_WITHOUT_OUTCOME").message, all);
      if (has("FEE_ESTIMATE_WITHOUT_QUOTE"))
        return refusal("FEE_ESTIMATE_WITHOUT_QUOTE", has("FEE_ESTIMATE_WITHOUT_QUOTE").message, all);
      if (has("DUE_HALF_STATED"))
        return refusal("DUE_HALF_STATED", has("DUE_HALF_STATED").message, all);
      if (has("DUE_NOT_A_DATE"))
        return refusal("DUE_NOT_A_DATE", has("DUE_NOT_A_DATE").message, all);
      /* END DEC-49 REGION is-lifecycle-grammar */
    }
    /* D-147: a stated due date names ONE OF THE ACTION'S citations (D-149), read
       from the action's own bytes as they stand now. With no list stated, no
       citation can be one of it, so the date cannot be stated yet — the refusal
       says to state the laws first. Nothing is inferred from the kind. */
    const cited = life.due_cite;
    const listed = governingLawsOf(fm).laws.map((l) => l.citation);
    const onList = cited ? listed.includes(cited) : true;
    if (!onList) {
      this.#releaseLease(target, who);
      /* DEC-49 REGION is-lifecycle-due-cite — D-147/C-94.10. */
      return refusal("DUE_CITE_NOT_GOVERNING",
        `due_cite '${cited.slice(0, 60)}' is not one of this action's stated governing laws`,
        { governing_laws: listed });
      /* END DEC-49 REGION is-lifecycle-due-cite */
    }
    /* R81, R83, R94 (T45): the entry's T45 fields, by action-grammar's R22, then the speaker a member. */
    if (Object.keys(t45.fields).length) {
      const r = this.#entryFieldRefusal([...ledgerNow, entryFm], ord, fm.action_kind, who, t45.fields.speaker !== undefined);
      if (r) { this.#releaseLease(target, who); return { ...r, target }; }
    }
    /* R85 (T45; S1 §C 18, §D 15): a records request's stage is one its law lists, where the profile lists them. */
    if (life.stage !== undefined && fm.action_kind === "records_request") {
      const inLaw = stageInLaw(life.stage, this.#lawStages(fm).stages);
      /* DEC-49 REGION is-stage-in-law */
      if (inLaw === "not_in_law") {
        this.#releaseLease(target, who);
        return refuse("STAGE_NOT_IN_LAW", localize("actions.index.stage_stage_is_not_one", "stage '{stage}' is not one the law this request is made under lists, as your team's jurisdiction states it. Nothing was written.", { stage: String(life.stage) }), { target, stage: life.stage,
            stages: (this.#lawStages(fm).stages || []).map((x) => x && x.stage) });
      }
      /* END DEC-49 REGION is-stage-in-law */
    }
    let text = Actions.#spliceCorrespondence(liveMd.content, entryFm);
    if (!text) this.#releaseLease(target, who);
    if (!text)
      return { ok: false, reason: "UNSPLICEABLE_CORRESPONDENCE", target,
               detail: "this action's correspondence block is not in a shape this grammar can extend in "
                     + "place. Appending never rewrites the rest of the document, so nothing was written." };
    text = Actions.#setScalar(text, "last_updated", `"${when}"`);
    text = Actions.#appendSessionLog(text,
      `### Session ${when} | Correspondence ${direction} | ${who}\n`
      + `Trigger: op=actioncorrespond on ${target}\n`
      + `Changes: correspondence[${ord}] recorded, dated ${day}`
      + `${String(party ?? "").trim() ? `, with ${String(party).trim()}` : ""}.\n`
      + `Held as: ${sha ? `captured bytes ${sha.slice(0, 16)}...` : `testimony from ${who}`}\n`
      + `${life.stage ? `Stage: ${life.stage}${life.follows !== undefined ? `, following correspondence[${life.follows}]` : ""}.\n` : ""}`);

    const carried = this.#carried(target);
    const bytes = new TextEncoder().encode(text);
    const promoted = this.promotion.promote({
      bundleId: target, base: this.#baseOf(target), snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who, viewer: viewer ?? who,
      files: [{ path: "bundle.md", text, bytes: bytes.length,
                sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: { object_type: fm.object_type ?? b.object_type,
              title: fm.title, current_state: b.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    /* THE LOCK IS GIVEN BACK, and this is not tidiness. The lease exists to
       stop two members interleaving two accounts of ONE exchange inside one
       write; the write is over. Leaving it to expire would lock the ledger for
       the rest of the TTL against the second member recording what they heard,
       which is the opposite of what an append-only ledger is for — and the
       member would be told "another member is writing to this action right now"
       when nobody is. Released whether the promote succeeded or failed, for the
       same reason: a refused write holds nothing worth protecting. */
    this.#releaseLease(target, who);
    if (!promoted.ok) return { ...promoted, target };

    /* REC-24 (g)'s PRODUCER. Only on a RECEIVED entry: a SENT artifact is our
       own letter and responds to nothing. */
    /* R83 (T45): a response found elsewhere is linked by the member to the action, never by a responds_to edge. */
    const responded = direction === "received" && sha && t45.fields.found_elsewhere === undefined
      ? this.#respondsToInto(sha, target, who) : null;
    const marked = mark ? { kind: mark.kind, note: mark.note } : null;
    const answer = { ok: true, target, ord, direction, at: day, author: who, recorded_at: when,
             held_as: sha ? "capture" : "testimony",
             ...(sha ? { artifact_sha: sha } : { account: acct }),
             ...(Object.keys(quote).length ? { quote } : {}),
             ...(Object.keys(life).length ? { lifecycle: life } : {}),
             ...(responded ? { responds_to: responded } : {}),
             ...(marked ? { pressure: marked } : {}),
             ...(t45.fields.speaker !== undefined ? { speaker: t45.fields.speaker } : {}),
             ...Actions.#presentedT45(t45.fields),
             ...(minutesGiven.minutes ? { minutes: Actions.minutesOf(minutesFields) } : {}),
             weight: "single" };
    if (direction === "received") this.#tellResponse({ action: target, ord, recorder: who, at: day });
    return answer;
  }

  /* R81, R83, R94 (T45): the entry's T45 fields as the act is given them, flat for the bytes (K2849): `speaker` a member
     id; `officeStatus` `{words, status?}` and `foundElsewhere` `{kind, note?}`, each an object or its JSON. Their shape is
     action-grammar's R22, asked with the ledger before any byte is spliced; what the restricted grammar cannot hold in
     its quoted text (a quote or backslash, which R22's line rule lets through) is refused here first by R22's code. */
  static #entryT45(speaker, officeStatus, foundElsewhere) {
    const obj = (v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "string") { try { v = JSON.parse(v); } catch { return { bad: true }; } }
      return v && typeof v === "object" && !Array.isArray(v) ? v : { bad: true };
    };
    const text = (v) => v === undefined || (typeof v === "string" && !/["\\\r\n]/.test(v));
    const tok = (v) => v === undefined || /^[A-Za-z0-9_.:-]{1,200}$/.test(String(v));
    const fields = {};
    const sp = String(speaker ?? "").trim();
    if (sp) fields.speaker = sp;
    const os = obj(officeStatus), fe = obj(foundElsewhere);
    /* DEC-49 REGION is-entry-writable */
    if (sp && !tok(sp))
      return refuse("SPEAKER_REFUSED", localize("actions.index.speaker_is_the_member_id", "speaker is the member id of the member who spoke for the team in this sending. Nothing was written."));
    if (os && (os.bad || !text(os.words) || !tok(os.status)))
      return refuse("OFFICE_STATUS_WITHOUT_OUTCOME", "office_status is {words, status?}: the office's own wording, with no "
        + "quote, backslash or line break, and a status the profile holds. Nothing was written.");
    if (fe && (fe.bad || !tok(fe.kind ?? "") || !text(fe.note)))
      return refuse("FOUND_ELSEWHERE_REFUSED", "found_elsewhere is {kind, note?}: a kind and a note with no quote, backslash "
        + "or line break. Nothing was written.");
    /* END DEC-49 REGION is-entry-writable */
    if (os && os.words !== undefined) fields.office_words = os.words;
    if (os && os.status !== undefined) fields.office_status = String(os.status);
    if (fe) fields.found_elsewhere = String(fe.kind);
    if (fe && fe.note !== undefined) fields.found_elsewhere_note = fe.note;
    return { ok: true, fields };
  }
  /* R25: the T45 fields of an entry, presented as R22 names them. */
  static #presentedT45(e) {
    const p = Actions.entryFields(e);
    return { ...(p.office_status ? { office_status: p.office_status } : {}),
             ...(p.found_elsewhere ? { found_elsewhere: p.found_elsewhere } : {}) };
  }

  /** R48: a pressure mark as given (`{kind, note}`, or its JSON), trimmed, or null when it is not one. */
  static #pressureOf(p) {
    let v = p;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return { kind: typeof v.kind === "string" ? v.kind.trim() : "", note: typeof v.note === "string" ? v.note.trim() : "",
             raw: typeof v.note === "string" ? v.note : "" };
  }

  /* R48 (K597 (1); `action-holds` R1): the conditions on a pressure mark stated at `actionCorrespond`; `actionPressure` is
     `action-holds`' since T45 and judges its own. */
  #pressureRefusal({ who, mark, direction }) {
    /* DEC-49 REGION is-pressure */
    if (!who || isMachineIdentity(who))
      return refuse("MACHINE_CANNOT_MARK_PRESSURE", localize("actions.index.marking_pressure_directed_at_the", "marking pressure directed at the team is a member's judgement; a machine credential may not mark it. Nothing was written."));
    if (!mark || !PRESSURE_KINDS.includes(mark.kind) || !mark.note || mark.note.length > NOTE_MAX || /["\\\r\n]/.test(mark.raw))
      return refuse("PRESSURE_REFUSED", `a pressure mark is {kind, note}: kind one of ${PRESSURE_KINDS.join(", ")}, the note `
        + `1 to ${NOTE_MAX} characters with no quote, backslash or line break. Nothing was written.`,
        { legal: PRESSURE_KINDS, max: NOTE_MAX });
    if (direction !== "received")
      return refuse("PRESSURE_NOT_RECEIVED", localize("actions.index.pressure_is_marked_on_a", "pressure is marked on a received entry; this one is {v1}. Nothing was written.", { v1: String(direction || "not one") }));
    /* END DEC-49 REGION is-pressure */
    return null;
  }

  /** R47: `actionCreate` is the same write as a promotion of an action document (R1–R3, R5–R11, R45, R46 and action-grammar R3 and R6 at the act): the plane
   *  mints the action's id and writes it into the document; the refusals are the promotion's. Answers `{ok, id}`. */
  actionCreate({ document = null, viewer = null, author = null } = {}) {
    const text = typeof document === "string" ? document : null;
    let fm = null;
    try { fm = text ? parseFrontmatter(text).data : null; } catch { fm = null; }
    if (!fm || typeof fm !== "object" || normalizeType(fm.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", detail: "op=actioncreate takes an action's bundle.md, whose object_type "
        + "is action. Nothing was written." };
    const when = stampInstant("second", this.#nowMs(null));
    const minted = this.record.allocId("ACTN", when.slice(0, 4));
    const id = minted && minted.id;
    if (!id) return { ok: false, reason: "NO_ID", detail: "no action id could be allocated. Nothing was written." };
    let withId = Actions.#setOrAddScalar(text, "id", id);
    const who = String(author ?? "").trim();
    /* R9 (K1484 row 5): an office arm stating no entity id has it filled from the office entity held for its role and
       body (the bridge), here where this module writes the bytes; written without one, and said so, when none is. */
    const office = counterpartyOffice(fm.counterparty);
    let addressee = null;
    if (office && !office.legacy && !office.entity_id) {
      addressee = this.#bridge(office.role, office.body, viewer ?? (who || null));
      if (addressee.entity_id) {
        const filled = Actions.#fillEntityId(withId, addressee.entity_id);
        if (filled) withId = filled;
        else addressee = { entity_id: null, filled: "unspliceable",
                           says: word("actions.says.office_entity_found") };
      }
    }
    const bytes = new TextEncoder().encode(withId);
    const r = this.promotion.promote({
      bundleId: id, base: null, snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who || null, viewer: viewer ?? (who || null),
      /* R47 (promotion R53, G74): the member who files is stamped, so promotion asks whether she is in the project the
         document names or invited to it; a machine credential is no member and is not asked. */
      actorIdentity: who || null, actorViewer: viewer ?? (who || null),
      actorMemberId: who ? this.membership.positionalMember(viewer ?? who, who) : null,
      files: [{ path: "bundle.md", text: withId, bytes: bytes.length, sha256: createSha256().update(bytes).hex() }],
      meta: { object_type: fm.object_type, title: fm.title, current_state: fm.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created ?? when, last_updated: fm.last_updated ?? when, criticality: fm.criticality ?? null },
    });
    if (!r.ok) return r;
    return { ok: true, id, ...(addressee ? { addressee } : {}) };
  }

  /* R9: add `entity_id` as the last line of the top-level `counterparty:` block; null for any other shape. */
  static #fillEntityId(text, entityId) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    let ci = -1;
    for (let i = 1; i < end; i++) if (/^counterparty:\s*$/.test(lines[i])) { ci = i; break; }
    if (ci === -1) return null;
    let last = ci, indent = null;
    for (let i = ci + 1; i < end; i++) {
      if (/^\s+\S/.test(lines[i])) { last = i; indent ??= lines[i].match(/^\s+/)[0]; continue; }
      break;
    }
    if (last === ci || /^\s+entity_id:/m.test(lines.slice(ci + 1, last + 1).join("\n"))) return null;
    return [...lines.slice(0, last + 1), `${indent}entity_id: ${entityId}`, ...lines.slice(last + 1)].join("\n");
  }

  /** R9 (K1484 row 5; the bridge, `instance-setup` R50): the office entity held for `{role, body}`: the one entity of
   *  kind `office` holding the role as an alias with a live `post_in` line to an entity holding the body as an alias.
   *  Answers `{entity_id, filled, says}`, `filled` `bridge`, `none` or `ambiguous` (never a guess between several). */
  #bridge(role, body, viewer) {
    const none = (filled, says) => ({ entity_id: null, filled, says });
    if (!role || !body) return none("none", word("actions.office_found_role"));
    let offices = [], bodies = new Set();
    try {
      offices = (this.entities.entitiesByAlias({ alias: role }).entities || []).filter((e) => e.kind === "office").map((e) => e.entity_id);
      bodies = new Set((this.entities.entitiesByAlias({ alias: body }).entities || []).map((e) => e.entity_id));
    } catch { return none("none", word("actions.subject_registry_read")); }
    const lines = this.lines;
    const found = [];
    for (const o of offices) {
      let r = null;
      try { r = lines ? lines.linesOf({ entity: o, kinds: ["post_in"], direction: "from", limit: 500, viewer: viewer ?? "class:admin" }) : null; }
      catch { r = null; }
      if (r && r.ok && (r.lines || []).some((l) => !l.withdrawn && bodies.has(l.to))) found.push(o);
    }
    if (found.length === 1)
      return { entity_id: found[0], filled: "bridge", says: word("actions.says.office_entity_record") };
    return found.length
      ? none("ambiguous", word("actions.office_entities_held", { found: String(found.length) }))
      : none("none", word("actions.office_entity_held"));
  }

  /* D-149 (Bob, 2026-09-22; BIO_Case_Making_v0_1.md §2, *A RECORDS REQUEST NAMES EVERY LAW THAT GOVERNS IT*):
   * SETTING THE LIST OF LAWS THAT GOVERN AN ACTION.
   *
   * *"ALL records laws apply."* The layers follow the AGENCY ASKED — federal FOIA governs federal agencies, the
   * CPRA a California state or local agency, and a city's sunshine ordinance adds its own — so a request carries
   * a LIST, each law named by CITATION and stated at its level. This act is how the list is set, and the ONLY
   * way: `promote` refuses a creation or a revision that sets or changes it without this act
   * (GOVERNING_LAWS_REWRITTEN), so an action nobody stated a list for is undetermined IN ITS BYTES.
   *
   * A NAMED MEMBER SETS IT. The design: *set by a member's authored act; the machine may propose the list from
   * the counterparty, labelled as machine work, and never sets it*. So a machine credential is refused BY NAME
   * (MACHINE_CANNOT_SET_LAWS), the actionMove precedent. No proposal is built.
   *
   * THE WHOLE LIST, REPLACED. A member states the laws that govern the request as a set; adding one later is a
   * new statement of the set, attributed and dated anew, and the Session Log keeps what it replaced. There is
   * no act that clears it: an empty list is the undetermined state, and a member does not "set" it — nobody
   * having stated the laws is what it means.
   *
   * THE PLANE ENCODES NO LAW'S RULES. A citation is stored as the member wrote it and never parsed for a fee,
   * a clock or an appeal route, and nothing is inferred from the counterparty or the kind. */
  actionLaws({ target, laws = null, viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-set-laws — D-149/C-32.18. The fence alone. */
    if (!who || isMachineIdentity(who))                 /* REC-46: one predicate */
      return { ok: false, reason: "MACHINE_CANNOT_SET_LAWS",
               detail: "which laws govern a request is a named member's authored statement (D-149). A machine "
                     + "credential may gather what the agency is and may not state the laws. Sign in as a member." };
    /* END DEC-49 REGION is-machine-set-laws */
    if (!target)
      return { ok: false, reason: "NO_TARGET", detail: "one action at a time: pass target=<action id>" };
    /* R18 (T47; N961): the list's shape is `action-records.lawEntries` (its R7), the one site of C-73.2–C-73.5. */
    const read = this.records.lawEntries(laws);
    if (!read.ok && read.reason !== "BAD_CITATION") return read;
    /* R113 (T53; K5458; `jurisdictions` R121): each entry's layer, judged after its level and before the rest of its shape. */
    const layered = this.#lawsLayers(laws);
    if (!layered.ok) return layered;
    if (!read.ok) return read;
    const entries = read.entries.map((e, i) => (layered.layers[i] ? { ...e, layer: layered.layers[i] } : e));

    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", target, object_type: b.object_type,
               detail: "governing laws belong to an action: they are the laws its request is made under." };
    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: "this action has no readable bundle.md, so its governing laws cannot be set" };
    const fm = parseFrontmatter(liveMd.content).data || {};
    /* R64: each named standard is one the author may read (`action-records.standardSeen`, its R9). */
    for (const e of entries) {
      if (!e.standard) continue;
      const r = this.records.standardSeen(e.standard, viewer ?? who);
      if (r) return { ...r, target };
    }
    const before = governingLawsOf(fm);
    const when = stampInstant("second", this.#nowMs(null));
    let text = Actions.#replaceGoverningLaws(liveMd.content, entries);
    if (!text)
      return { ok: false, reason: "UNSPLICEABLE_GOVERNING_LAWS", target,
               detail: "this action's governing_laws block is not in a shape this grammar can replace in place, "
                     + "so nothing was written." };
    text = Actions.#setOrAddScalar(text, "governing_laws_by", `"${Actions.#fmSafe(who)}"`);
    text = Actions.#setOrAddScalar(text, "governing_laws_at", `"${when}"`);
    text = Actions.#setScalar(text, "last_updated", `"${when}"`);
    text = Actions.#appendSessionLog(text,
      `### Session ${when} | Governing laws stated | ${who}\n`
      + `Trigger: op=actionlaws on ${target}\n`
      + `Changes: governing_laws set to ${entries.map((e) => `${e.level} ${e.citation}`).join("; ")}.\n`
      + `Replaced: ${before.state === "stated"
          ? before.laws.map((e) => `${e.level} ${e.citation}`).join("; ") + ` (stated by ${before.by ?? "nobody recorded"})`
          : "nothing: the list was undetermined"}\n`);

    const carried = this.#carried(target);
    const bytes = new TextEncoder().encode(text);
    const promoted = this.promotion.promote({
      bundleId: target, base: this.#baseOf(target), snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who, viewer: viewer ?? who, [LAWS_ACT]: true,
      files: [{ path: "bundle.md", text, bytes: bytes.length,
                sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: { object_type: fm.object_type ?? b.object_type,
              title: fm.title, current_state: b.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    if (!promoted.ok) return { ...promoted, target };
    return { ok: true, target, laws: entries, by: who, at: when,
             replaced: before.state === "stated" ? before.laws : null, weight: "single" };
  }

  /* R113 (T53; N1257; K5458; `jurisdictions` R121): the layer of each governing law in `laws` (the act's own list). A
     stated `layer` is a layer today's profiles or the profile reader hold, at the entry's own level, else `BAD_LAW_LEVEL`
     naming the index; with none stated, a citation two active layers give at that level is `NAME_AMBIGUOUS` naming them
     (never the first's), and one layer or none giving it is written with no layer. `{ok: true, layers}` (by index, null
     where none is stated) or the refusal. Writes nothing. */
  #lawsLayers(laws) {
    let list = laws;
    if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = null; } }
    if (!Array.isArray(list)) return { ok: true, layers: [] };
    const active = this.#layersAt(null);
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i] && typeof list[i] === "object" ? list[i] : {};
      const level = String(e.level ?? "").trim();
      const citation = typeof e.citation === "string" ? e.citation.trim() : "";
      if (e.layer !== undefined && e.layer !== null && e.layer !== "") {
        const id = typeof e.layer === "string" && e.layer.length <= LAW_LAYER_MAX && !/["\\\r\n]/.test(e.layer) ? e.layer.trim() : "";
        let l = id ? active.find((x) => x.id === id) : null;
        if (!l && id) { try { l = this.#profiles(id); } catch { l = null; } }
        if (!l || !l.layer || typeof l.layer !== "object" || l.layer.level !== level)
          return refuse("BAD_LAW_LEVEL", localize("actions.index.laws_i_layer_is_not", "laws[{i}].layer is not a layer at the entry's level, {level}", { i: String(i), level }),
            { index: i, level, layer: typeof e.layer === "string" ? e.layer.slice(0, LAW_LAYER_MAX) : null, legal: [...LAW_LEVELS] });
        out.push(id);
        continue;
      }
      out.push(null);
      if (!citation) continue;
      const r = lawLayer({ law: citation, level }, active);
      /* DEC-49 REGION is-law-name-ambiguous */
      if (r.reason === "NAME_AMBIGUOUS")
        return { ok: false, reason: "NAME_AMBIGUOUS", code: "NAME_AMBIGUOUS", index: i, citation, layers: r.layers,
                 detail: localize("actions.index.laws_i_citation_is_given", "laws[{i}].citation is given by {n} active layers at that level; name the one it is made under as the entry's layer. Nothing was written.", { i: String(i), n: String(r.layers.length) }) };
      /* END DEC-49 REGION is-law-name-ambiguous */
    }
    return { ok: true, layers: out };
  }

  /* D-149: REPLACE the top-level `governing_laws:` block (the key line and its indented rows) with `entries`,
     or open it before the closing fence when absent — `#spliceCorrespondence`'s grammar, whole-block. Returns
     null for a block it cannot read as that shape (an inline value other than `[]`), refusing rather than
     guessing: the grammar has no escapes and a wrong guess corrupts the document silently. */
  static #replaceGoverningLaws(text, entries) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    const block = ["governing_laws:", ...entries.flatMap((e) => [
      `  - level: ${e.level}`,
      `    citation: "${e.citation}"`,
      ...(e.standard ? [`    standard: ${e.standard}`] : []),
      ...(e.layer ? [`    layer: "${e.layer}"`] : []),
    ])];
    let gi = -1;
    for (let i = 1; i < end; i++) if (/^governing_laws:/.test(lines[i])) { gi = i; break; }
    if (gi === -1) return [...lines.slice(0, end), ...block, ...lines.slice(end)].join("\n");
    const rest = lines[gi].slice("governing_laws:".length).trim();
    if (rest !== "" && rest !== "[]") return null;
    let last = gi;
    if (rest === "")
      for (let i = gi + 1; i < end; i++) {
        if (lines[i].trim() === "") continue;
        if (/^\s/.test(lines[i])) { last = i; continue; }
        break;
      }
    return [...lines.slice(0, gi), ...block, ...lines.slice(last + 1)].join("\n");
  }

  /** op=actionrisktier — REC-214 (BOB #33, 2026-09-24, "Risk-tier revision"; `BIO_Case_Making_v0_1.md` §2,
   *  `risk_tier`): A MEMBER REVISES AN ACTION'S RISK TIER, AS AN AUTHORED, APPEND-ONLY ACT.
   *
   *  The tier carries legal exposure — 3 is "do not file without counsel" — so the record must show that it was
   *  changed, by whom, when and why. A member may revise ANY tier, up or down, and the act:
   *   - writes `risk_tier` through the one front-matter path every reader derives the tier from (`riskTierState`
   *     over the document's own bytes; `#projectRow`'s `action_risk_tier` column; `op=search q=risk:`);
   *   - APPENDS one entry to `risk_tier_history[]` — the tier set, the tier replaced (`prior`), who, when and the
   *     REQUIRED reason — and never edits or drops an earlier one, so the prior tier, its author and its reason stay
   *     readable (`riskTierHistoryOf`); `promote` refuses any other writer that changes either (C-90.1);
   *   - records the revision in the Session Log as well, as every act on an action does.
   *  A machine credential is refused by C-32.19's own code. The act states 1, 2 or 3: `undetermined` is what an
   *  action reads when nobody has assessed it, and a member does not "set" it — actionLaws' rule for an empty list.
   *  A revision to the tier already held is refused: it would append a change that is not one. What a machine may
   *  PROPOSE is REC-215's, read beside this history and never written into it. */
  actionRiskTier({ target, tier = null, reason = null, viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    const machine = this.#machineRiskTierRefusal({ who, nextTier: riskTierState(tier), heldTier: null,
                                                   cur: false, act: true });
    if (machine) return { ...machine, target };
    if (!target)
      return { ok: false, reason: "NO_TARGET", detail: "one action at a time: pass target=<action id>" };
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "action")
      return { ok: false, reason: "NOT_AN_ACTION", target, object_type: b.object_type,
               detail: "a risk tier belongs to an action: it is the legal exposure of filing it." };
    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: "this action has no readable bundle.md, so its risk tier cannot be revised" };
    const fm = parseFrontmatter(liveMd.content).data || {};
    const held = riskTierState(fm.risk_tier);
    const before = riskTierHistoryOf(fm);
    /* The query string carries every value as a string; the act's tier is a NUMBER in the bytes (a quoted "2" is
       refused by C-2.10), so the wire's "2" is read as 2 here and nowhere else. */
    const asked = typeof tier === "string" && /^[123]$/.test(tier.trim()) ? Number(tier.trim()) : tier;
    const next = riskTierState(asked);
    const why = typeof reason === "string" ? reason.trim() : "";
    const text0 = Actions.#appendRiskTierHistory(liveMd.content, null);
    /* R23 (T47; N961): C-90.2 is answered by `action-records.badRiskTier` (its R8), its one site. */
    if (next !== 1 && next !== 2 && next !== 3) return this.records.badRiskTier(target, tier, "the act");
    /* DEC-49 REGION is-risk-tier-act */
    if (!why || why.length > RISK_TIER_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "RISK_TIER_REASON_REFUSED", target, max: RISK_TIER_REASON_MAX,
               detail: `a revision of a risk tier carries a reason of 1 to ${RISK_TIER_REASON_MAX} characters, with no `
                     + "quote, backslash or line break: the restricted frontmatter grammar has no escapes. It is kept "
                     + "beside the change for as long as the record lasts." };
    if (next === held)
      return { ok: false, reason: "RISK_TIER_UNCHANGED", target, risk_tier: held,
               detail: `this action's risk tier is already ${held}; a revision changes it, and the history was not touched.` };
    if (text0 === null || before.revisions.length >= RISK_TIER_HISTORY_MAX)
      return { ok: false, reason: "RISK_TIER_HISTORY_UNSPLICEABLE", target, revisions: before.revisions.length,
               max: RISK_TIER_HISTORY_MAX,
               detail: "this action's risk_tier_history is not a block the act can append to in place (or it holds "
                     + `${RISK_TIER_HISTORY_MAX} revisions already); the act only appends, so nothing was written.` };
    /* END DEC-49 REGION is-risk-tier-act */

    const when = stampInstant("second", this.#nowMs(null));
    const entry = { tier: next, prior: held, by: Actions.#fmSafe(who), at: when, reason: why };
    let text = Actions.#appendRiskTierHistory(liveMd.content, entry);
    text = Actions.#setOrAddScalar(text, "risk_tier", String(next));
    text = Actions.#setScalar(text, "last_updated", `"${when}"`);
    text = Actions.#appendSessionLog(text,
      `### Session ${when} | Risk tier revised | ${who}\n`
      + `Trigger: op=actionrisktier on ${target}\n`
      + `Changes: risk_tier ${held} (${RISK_TIERS[held]}) -> ${next} (${RISK_TIERS[next]}).\n`
      + `Reason: ${why}\n`);

    const carried = this.#carried(target);
    const bytes = new TextEncoder().encode(text);
    const promoted = this.promotion.promote({
      bundleId: target, base: this.#baseOf(target), snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`,
      author: who, viewer: viewer ?? who, [RISK_TIER_ACT]: true,
      files: [{ path: "bundle.md", text, bytes: bytes.length,
                sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: { object_type: fm.object_type ?? b.object_type,
              title: fm.title, current_state: b.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    if (!promoted.ok) return { ...promoted, target };
    const after = parseFrontmatter(text).data || {};
    return { ok: true, target, risk_tier: next, risk_tier_words: RISK_TIERS[next], prior: held,
             prior_words: RISK_TIERS[held] ?? null, by: who, at: when, reason: why,
             risk_tier_history: riskTierHistoryOf(after), weight: "single" };
  }

  /* REC-214: APPEND one entry to the top-level `risk_tier_history:` block, or open the block before the closing
     fence when absent — `#replaceGoverningLaws`' grammar, but it only ever ADDS rows after the last one. With
     `entry` null it answers only whether the block can be appended to (the act asks before it refuses anything
     that would write). Returns null for a block it cannot read as that shape — an inline value other than `[]` —
     refusing rather than guessing: the grammar has no escapes, and a wrong guess rewrites history silently. */
  static #appendRiskTierHistory(text, entry) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    const rows = entry ? [
      `  - tier: ${entry.tier}`,
      `    prior: ${entry.prior}`,
      `    by: "${entry.by}"`,
      `    at: "${entry.at}"`,
      `    reason: "${entry.reason}"`,
    ] : [];
    let hi = -1;
    for (let i = 1; i < end; i++) if (/^risk_tier_history:/.test(lines[i])) { hi = i; break; }
    if (hi === -1) return [...lines.slice(0, end), "risk_tier_history:", ...rows, ...lines.slice(end)].join("\n");
    const rest = lines[hi].slice("risk_tier_history:".length).trim();
    if (rest !== "" && rest !== "[]") return null;
    let last = hi;
    if (rest === "")
      for (let i = hi + 1; i < end; i++) {
        if (lines[i].trim() === "") continue;
        if (/^\s/.test(lines[i])) { last = i; continue; }
        break;
      }
    return [...lines.slice(0, hi), "risk_tier_history:", ...lines.slice(hi + 1, last + 1), ...rows,
            ...lines.slice(last + 1)].join("\n");
  }

  /* REC-24 (g): write the `responds_to` edge onto the CAPTURED REPLY, pointing
     back at the action it answered. The edge lives on the responding document
     because that is what the relation says — this document is what came back —
     and because refs is a projection of the CITING document's own frontmatter,
     so an edge stated anywhere else would be a second place the relationship
     lives (D-21).
     Returns null when the capture is not part of a bundle in this store, which
     is a legitimate state rather than a failure: bytes may be registered against
     a bundle that has since been purged, and the ledger entry stands on its own
     hash either way. Idempotent by inspection, so re-recording does not
     duplicate an edge. */
  #respondsToInto(captureSha, actionId, who) {
    const reg = this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, captureSha);
    if (!reg || !reg.bundle_id || reg.bundle_id === actionId) return null;
    const doc = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state, f.content
         FROM bundles b JOIN files f ON f.bundle_id=b.bundle_id AND f.path='bundle.md'
        WHERE b.bundle_id=?`, reg.bundle_id);
    if (!doc || doc.content === null) return null;
    const fm = parseFrontmatter(doc.content).data || {};
    const refs = Array.isArray(fm.references) ? fm.references : [];
    if (refs.some((r) => r && typeof r === "object" && r.rel === "responds_to" && r.target === actionId))
      return { bundle_id: doc.bundle_id, already: true };
    const when = stampInstant("second", this.#nowMs(null));
    let text = Actions.#spliceReferences(doc.content,
      [{ rel: "responds_to", target: actionId, status: "confirmed", note: "" }]);
    if (!text) return null;
    text = Actions.#setScalar(text, "last_updated", `"${when}"`);
    text = Actions.#appendSessionLog(text,
      `### Session ${when} | Recorded as a response | ${who}\n`
      + `Trigger: op=actioncorrespond on ${actionId}\n`
      + `Changes: responds_to edge added to ${actionId}.\n`);
    const carried = this.#carried(doc.bundle_id);
    const bytes = new TextEncoder().encode(text);
    const p = this.promotion.promote({
      bundleId: doc.bundle_id, base: this.#baseOf(doc.bundle_id),
      snapKey: `${when.replace(/[-:]/g, "")}_${Actions.#rand(4)}`, author: who, viewer: who,
      files: [{ path: "bundle.md", text, bytes: bytes.length,
                sha256: createSha256().update(bytes).hex() }, ...carried],
      meta: { object_type: fm.object_type ?? doc.object_type,
              title: fm.title, current_state: fm.current_state ?? doc.current_state,
              prior_state: fm.prior_state ?? null, created: fm.created, last_updated: when,
              criticality: fm.criticality ?? null },
    });
    return p.ok ? { bundle_id: doc.bundle_id, already: false } : { bundle_id: doc.bundle_id, refused: p.reason };
  }

  /* D-148: A FEE QUOTE IS EVIDENCE — THE READ (`BIO_Case_Making_v0_1.md` §2).
   *
   * Quotes set side by side by ONE axis at a time: `counterparty=` (the action's
   * own named counterparty, matched exactly as written) or `request=` (an action,
   * optionally `answers=` one sent entry of it). One indexed lookup each, over
   * the `action_quotes` projection and gated by the viewer through the action.
   *
   * IT JUDGES NOTHING. Each row says what was quoted, by whom, when, for which
   * request, how it is held (captured bytes or a member's account), and which
   * later quotes revise it — a waiver is a revision to zero, and both rows are
   * returned. Whether two requests sought the same records, or a quote exceeds
   * what a law allows, is a member's claim in an inquiry (DEC-24), so no field
   * here compares one quote to another.
   *
   * AN EMPTY ANSWER SAYS WHICH LEVEL WAS EMPTY. By request, it names how many
   * sent and received entries the ledger holds, so "no quote" is distinguishable
   * from "no reply". By counterparty, it says an action whose counterparty is
   * stated undetermined is reachable only by its request. */
  actionQuotes({ counterparty = null, request = null, answers = null, viewer = null } = {}) {
    const cp = String(counterparty ?? "").trim();
    const req = String(request ?? "").trim();
    const ans = String(answers ?? "").trim();
    const refusal = (code, detail, extra) => {
      const row = QUOTE_CHECKS[code];
      return { ok: false, reason: code, code, check: row.check, translation: row.translation,
               detail, ...(extra || {}) };
    };
    /* DEC-49 REGION is-quote-read-axis — D-148/C-72.7-8. One axis at a time: a read
       answering from both would be neither question the caller asked; and answers=
       names a position in a ledger, so it is a whole number or it names nothing. */
    if ((!cp && !req) || (cp && req))
      return refusal("QUOTE_READ_UNASKED",
        "quotes are read by counterparty= or by request= (optionally with answers=), one at a time",
        { axes: ["counterparty", "request"] });
    if (ans && !/^\d+$/.test(ans))
      return refusal("QUOTE_ANSWERS_NOT_AN_ORD",
        "answers= is the position of a sent entry in the action's correspondence, a whole number",
        { answers: ans.slice(0, 20) });
    /* END DEC-49 REGION is-quote-read-axis */
    const gate = viewerPredicate(viewer);
    const max = QUOTES_MAX;
    let rows;
    let absence = null;
    if (req) {
      const b = this.#one(
        `SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
        req, ...gate.args);
      if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: req };
      if (normalizeType(b.object_type) !== "action")
        return { ok: false, reason: "NOT_AN_ACTION", target: req, object_type: b.object_type };
      rows = this.#rows(
        `SELECT q.* FROM action_quotes q WHERE q.bundle_id=?${ans ? " AND q.answers_ord=?" : ""}
          ORDER BY q.ord LIMIT ?`, req, ...(ans ? [Number(ans)] : []), max + 1);
      if (!rows.length) {
        const n = (d) => this.#one(`SELECT COUNT(*) AS n FROM correspondence WHERE bundle_id=? AND direction=?`,
          req, d).n;
        const sent = n("sent"), received = n("received");
        absence = { level: sent === 0 ? "no_request" : received === 0 ? "no_reply" : "no_quote",
                    sent, received,
                    says: sent === 0 ? word("actions.says.action_ledger_records")
                      : received === 0 ? word("actions.says.action_ledger_records_reply")
                      : word("actions.says.action_ledger_records_replies") };
      }
    } else {
      rows = this.#rows(
        `SELECT q.* FROM action_quotes q JOIN bundles b ON b.bundle_id=q.bundle_id
          WHERE q.counterparty=? AND (${gate.sql}) ORDER BY q.bundle_id, q.ord LIMIT ?`,
        cp, ...gate.args, max + 1);
      if (!rows.length)
        absence = { level: "no_quote_by_name",
                    says: word("actions.says.action_read_names") };
    }
    const truncated = rows.length > max;
    const quotes = rows.slice(0, max).map((q) => {
      const entry = this.#one(
        `SELECT artifact_sha, artifact_bundle_id, account, author, party FROM correspondence
          WHERE bundle_id=? AND ord=?`, q.bundle_id, q.ord) || {};
      const sent = this.#one(
        `SELECT at, artifact_sha, account FROM correspondence WHERE bundle_id=? AND ord=?`,
        q.bundle_id, q.answers_ord) || {};
      return {
        action: q.bundle_id, ord: q.ord, at: q.at,
        amount: q.amount, value: q.value, currency: q.currency, basis: q.basis,
        counterparty: q.counterparty, party: entry.party ?? null,
        held_as: entry.artifact_sha ? "capture" : "testimony",
        ...(entry.artifact_sha ? { artifact_sha: entry.artifact_sha, artifact_bundle_id: entry.artifact_bundle_id ?? null }
                               : { account: entry.account ?? null }),
        author: entry.author ?? null,
        answers: { ord: q.answers_ord, at: sent.at ?? null },
        revises: q.revises_ord,
        revised_by: this.#rows(`SELECT ord FROM action_quotes WHERE bundle_id=? AND revises_ord=? ORDER BY ord`,
          q.bundle_id, q.ord).map((r) => r.ord),
      };
    });
    return { ok: true, by: req ? "request" : "counterparty", ...(req ? { request: req } : { counterparty: cp }),
             ...(ans ? { answers: Number(ans) } : {}),
             quotes, count: quotes.length, truncated, max,
             ...(absence ? { absence } : {}),
             says: localize("actions.index.the_record_asserts_only_what", "the record asserts only what was quoted, by whom, when, and for which request. It sets quotes side by side and judges none of them (DEC-24).") };
  }

  /* REC-24 (d): APPEND one entry to the `correspondence` block, touching nothing
     else — #spliceBasis line for line, and a twin rather than a generalisation
     for the reason stated there: the ELEMENT shapes differ, and a parameterised
     splicer would hide that behind an option in a grammar with no serializer.
     A KEY IS RENDERED ONLY IF THE ENTRY CARRIES IT, so an entry held as
     testimony carries no artifact_sha at all rather than an empty one — the
     capture-or-testify choice is visible in the bytes and not only in a table.
     Values are emitted quoted where they are prose (account, medium, party) and
     bare where they are tokens, matching what the restricted grammar's parser
     reads back. */
  static #spliceCorrespondence(text, e) {
    const lines = text.split("\n");
    if (lines[0] !== "---") return null;
    const end = lines.indexOf("---", 1);
    if (end === -1) return null;
    const block = [
      `  - direction: ${e.direction}`,
      `    at: ${e.at}`,
      ...(e.medium ? [`    medium: "${e.medium}"`] : []),
      ...(e.party ? [`    party: "${e.party}"`] : []),
      ...(e.artifact_sha ? [`    artifact_sha: ${e.artifact_sha}`] : []),
      ...(e.account ? [`    account: "${e.account}"`] : []),
      /* D-148: a quote's keys, each only if carried. The amount is QUOTED so the
         parser keeps the text as the body wrote it (`1083.00` stays `1083.00`);
         the two ords are bare tokens. */
      ...(e.quote_amount !== undefined ? [`    quote_amount: "${e.quote_amount}"`] : []),
      ...(e.quote_currency !== undefined ? [`    quote_currency: "${e.quote_currency}"`] : []),
      ...(e.quote_basis !== undefined ? [`    quote_basis: "${e.quote_basis}"`] : []),
      ...(e.quote_answers !== undefined ? [`    quote_answers: ${e.quote_answers}`] : []),
      ...(e.quote_revises !== undefined ? [`    quote_revises: ${e.quote_revises}`] : []),
      /* D-147: the lifecycle keys, each only if carried. Stage, follows and
         outcome are bare tokens (judged tokens before this splice); the date and
         the two prose values are quoted so the parser keeps them as written. */
      ...(e.stage !== undefined ? [`    stage: ${e.stage}`] : []),
      ...(e.follows !== undefined ? [`    follows: ${e.follows}`] : []),
      ...(e.outcome !== undefined ? [`    outcome: ${e.outcome}`] : []),
      ...(e.exemptions !== undefined ? [`    exemptions: "${e.exemptions}"`] : []),
      ...(e.due_by !== undefined ? [`    due_by: "${e.due_by}"`] : []),
      ...(e.due_cite !== undefined ? [`    due_cite: "${e.due_cite}"`] : []),
      /* R81, R83, R94 (T45): the entry's T45 fields, flat (J2's reading): tokens bare, text quoted. */
      ...(e.speaker !== undefined ? [`    speaker: ${e.speaker}`] : []),
      ...(e.office_words !== undefined ? [`    office_words: "${e.office_words}"`] : []),
      ...(e.office_status !== undefined ? [`    office_status: ${e.office_status}`] : []),
      ...(e.found_elsewhere !== undefined ? [`    found_elsewhere: ${e.found_elsewhere}`] : []),
      ...(e.found_elsewhere_note !== undefined ? [`    found_elsewhere_note: "${e.found_elsewhere_note}"`] : []),
      /* R108 (T51): the minutes' account flat (K2849): text quoted, the date, capture and numbers bare, a rectangle inline. */
      ...(e.minutes_meeting !== undefined ? [`    minutes_meeting: "${e.minutes_meeting}"`] : []),
      ...(e.minutes_date !== undefined ? [`    minutes_date: ${e.minutes_date}`] : []),
      ...(e.minutes_capture !== undefined ? [`    minutes_capture: ${e.minutes_capture}`] : []),
      ...(e.minutes_content_id !== undefined ? [`    minutes_content_id: ${e.minutes_content_id}`] : []),
      ...(e.minutes_extent_kind !== undefined ? [`    minutes_extent_kind: ${e.minutes_extent_kind}`] : []),
      ...[...MINUTES_EXTENT_FIELDS, "rect"].filter((f) => e[`minutes_extent_${f}`] !== undefined).map((f) => {
        const v = e[`minutes_extent_${f}`];
        return `    minutes_extent_${f}: ${Array.isArray(v) ? `[${v.join(", ")}]` : typeof v === "number" ? String(v) : `"${v}"`}`;
      }),
      ...(e.pressure_kind !== undefined ? [`    pressure_kind: ${e.pressure_kind}`] : []),
      ...(e.pressure_note !== undefined ? [`    pressure_note: "${e.pressure_note}"`] : []),
      `    author: ${e.author}`,
      `    recorded_at: "${e.recorded_at}"`,
    ];
    let ci = -1;
    for (let i = 1; i < end; i++) if (/^correspondence:/.test(lines[i])) { ci = i; break; }
    if (ci === -1)
      return [...lines.slice(0, end), "correspondence:", ...block, ...lines.slice(end)].join("\n");
    const rest = lines[ci].slice("correspondence:".length).trim();
    if (rest === "[]")
      return [...lines.slice(0, ci), "correspondence:", ...block, ...lines.slice(ci + 1)].join("\n");
    if (rest !== "") return null;
    let last = ci;
    for (let i = ci + 1; i < end; i++) {
      if (lines[i].trim() === "") continue;
      if (/^\s/.test(lines[i])) { last = i; continue; }
      break;
    }
    return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
  }
  /* ================================================================ the read (R25, R26, R29, R30) */

  /** R25, REC-24 (f)/(g): everything about ONE action that is DERIVED rather than stored — the clock's verdict at a
   *  named instant, the action's own outcome (DEC-14), the ledger, the legs, and what responded. `row` is the
   *  projection row retrieval answers (`bundle_id`, `fm_json`, `action_*` columns); the cached flag is reported beside
   *  the derivation, never in place of it (R35). */
  derived(row, nowMs = null, viewer = null) {
    let fm = {};
    try { fm = row && row.fm_json ? (JSON.parse(row.fm_json) || {}) : {}; } catch { fm = {}; }
    if ((!fm || !Object.keys(fm).length) && row && row.bundle_id) fm = this.#heldFm(row.bundle_id) || {};
    const now = this.#nowMs(nowMs);
    /* R25, R100: the clock and the lifecycle day are read in the action's zone. */
    const view = this.governingView();
    /* R112, R115 (T53): the zone, and which zone, over the layers active on the action's date. */
    const layersAt = this.#layersAt(fm);
    const zoneRead = actionZoneRead(fm, view, layersAt);
    /* R111: each row also carries, from the entry as the record holds it (the table keeps none of these), its stage,
       outcome, exemptions, due date and citation and quote, each null when the entry states none. */
    const held = Array.isArray(fm.correspondence) ? fm.correspondence : [];
    const ledger = this.#rows(
      `SELECT ord, direction, at, medium, party, artifact_bundle_id, artifact_sha, account, author, recorded_at
         FROM correspondence WHERE bundle_id=? ORDER BY ord`, row.bundle_id).map((r) => {
      const e = held[r.ord] && typeof held[r.ord] === "object" && !Array.isArray(held[r.ord]) ? held[r.ord] : {};
      const of = (k) => (e[k] === undefined || e[k] === null || String(e[k]).trim() === "" ? null : String(e[k]).trim());
      return { ...r, stage: of("stage"), outcome: of("outcome"), exemptions: of("exemptions"),
               due_by: of("due_by"), due_cite: of("due_cite"), quote_amount: of("quote_amount"),
               quote_currency: of("quote_currency"), quote_basis: of("quote_basis") };
    });
    const legs = this.#rows(
      `SELECT ord, target_id, target_type, kind, note, at, extent_capture FROM action_basis WHERE bundle_id=? ORDER BY ord`,
      row.bundle_id).map((l) => ({ ...l, extent_capture: l.extent_capture ?? null,
        ...(l.target_type === "information" && !l.extent_capture ? { version: "undetermined" } : {}) }));
    const tier = riskTierState(fm.risk_tier);
    const cp = fm.counterparty && typeof fm.counterparty === "object" && !Array.isArray(fm.counterparty) ? fm.counterparty : {};
    return {
      kind: typeof fm.action_kind === "string" ? fm.action_kind : (row.action_kind ?? null),
      /* D-182: read from the stored DOCUMENT, never defaulted; the words travel with the value. */
      risk_tier: tier, risk_tier_words: RISK_TIERS[tier] ?? null,
      risk_tier_history: riskTierHistoryOf(fm),
      counterparty_state: typeof cp.state === "string" ? cp.state : (row.action_counterparty_state ?? null),
      resolution: typeof fm.resolution === "string" ? fm.resolution : (row.action_resolution ?? null),
      clock_next: actionClockNext(fm),
      clock_overdue: actionOverdue(fm, now, view, layersAt),
      /* R112 (T53): the zone the clock is read in and which zone it is, with its sentence; undetermined says so. */
      clock_zone: zoneRead,
      clock_overdue_cached: row.action_clock_overdue === null || row.action_clock_overdue === undefined
        ? null : !!row.action_clock_overdue,
      as_of: new Date(now).toISOString(),
      basis: legs,
      correspondence: ledger,
      governing_laws: governingLawsOf(fm),
      /* R25 (T47; N961): the proposals stored apart are `action-records`' (its R1–R3), read through it. */
      governing_laws_proposals: this.records.lawProposalsFor(row.bundle_id),
      /* R105 (T50; N933; `action-records` R17): the action's own stake, apart from its project's: `{stake, set_by, set_at,
         history}`, `stake: null` when it states none, `"undetermined"` when unreadable. */
      own_stake: this.records.stakeOf(row.bundle_id),
      risk_tier_proposals: this.records.riskProposalsFor(row.bundle_id),
      /* R70, R73: what a records request seeks, as a member stated it, and the proposals of it stored apart. */
      seeks: seeksOf(fm),
      seeks_proposals: this.records.seeksProposalsFor(row.bundle_id),
      records_law: fm.action_kind === "records_request" ? recordsLawOf(fm, this.#lawAuthor(row.bundle_id, fm)) : null,
      lifecycle: requestLifecycleOf(fm, localToday(now, zoneRead.zone) ?? ""),
      /* R26, DEC-14: the ACTION'S OWN OUTCOME, never the breach's consequence (which `consequences` holds). */
      own_outcome: consequenceState(fm),
      responses: this.#rows(`SELECT bundle_id FROM refs WHERE target_id=? AND kind='responds_to' ORDER BY bundle_id`,
        row.bundle_id).map((r) => r.bundle_id),
      /* R45: the group's contact, a member id; it grants nothing. */
      contact: typeof fm.contact === "string" && fm.contact.trim() ? fm.contact.trim() : null,
      /* R46: the plan and option the action was started from, as created. */
      plan: typeof fm.plan === "string" ? fm.plan : null,
      option: fm.option === undefined || fm.option === null ? null : fm.option,
      /* R8: the premise override, with who stated it and when. */
      premise_override: this.#overrideRead(row.bundle_id, fm),
      /* T33-73: the action's date (R9, R64, R65), the office addressee's entity and holder on it (R9), each law's held
         standard with its in-force state on it (R64), and the proceeding with its status on it (R65). */
      ...this.#t33Read(fm, viewer),
      ...this.#t45Read(row.bundle_id, fm, viewer, ledger),
    };
  }

  /* R25 (T45): what T45 adds to the read: the gate's ground and its disclosures (R74–R76, R8 (d)), the addressing
     (R9's press holder and venue delivery point, R77–R79), receipt, reply owed and responses (R80–R83, R85, R86, R94),
     the scope and promises (R87, R88), and recognition's basis (R93). Each derived on read, never written. */
  #t45Read(id, fm, viewer, ledger) {
    const dets = this.#legDeterminations(fm, viewer);
    const live = dets.filter(({ d }) => d.live !== false && !d.superseded_by);
    const cp = fm.counterparty && typeof fm.counterparty === "object" && !Array.isArray(fm.counterparty) ? fm.counterparty : null;
    const kindEntry = this.#kindEntry(fm.action_kind);
    const inLaw = fm.action_kind === "records_request" ? this.#lawStages(fm) : { stages: null };
    const stages = inLaw.stages;
    const history = (field) => this.#rows(`SELECT seq, value, reason, by, at FROM action_field_history WHERE bundle_id=? AND field=?
      ORDER BY seq`, id, field).map((r) => { let v = null; try { v = JSON.parse(r.value); } catch { v = null; }
        return { seq: r.seq, value: v, ...(r.reason !== null ? { reason: r.reason } : {}), by: r.by, at: r.at }; });
    const owed = fm.reply_owed === false ? false : true;
    const out = {
      /* R8 (d): the live noncompliant determinations a breach action rests on, beside any override. */
      breach_rests_on: live.filter(({ d }) => !d.void && Actions.#noncompliant(d)).map(({ id: x }) => x),
      disclosures: this.#disclosures(fm, live, id),
      basis_void: dets.filter(({ d }) => d.void).map(({ id: x, d }) => ({ determination: x,
        causes: Array.isArray(d.void.causes) ? d.void.causes : [] })),
      press_holder: cp && cp.kind === "press" && typeof cp.holder === "string" && cp.holder.trim() ? { name: cp.holder.trim() } : null,
      copied: Array.isArray(fm.copied) ? fm.copied : [],
      partners: Array.isArray(fm.partners) ? fm.partners : [],
      press_terms: fm.press_terms && typeof fm.press_terms === "object" ? fm.press_terms : null,
      press_terms_history: history("press_terms"),
      reply_owed: { owed, ...(owed ? {} : { ...T45_SENTENCES.reply_not_owed, reason: replyOwedReason(fm) }),
                    history: history("reply_owed") },
      /* R25 (T47; N961): the receipts, scope and promises are `action-records`' (its R4–R6), read through it. */
      receipts: this.records.receiptsOf(id),
      entries: (Array.isArray(fm.correspondence) ? fm.correspondence : []).map((e, ord) => {
        const p = Actions.entryFields(e) || {};
        return { ord, ...(p.speaker !== undefined ? { speaker: p.speaker } : {}),
                 ...(p.office_status ? { office_status: p.office_status } : {}),
                 ...(p.found_elsewhere ? { found_elsewhere: p.found_elsewhere } : {}),
                 ...(p.pressure ? { pressure: p.pressure } : {}),
                 ...(p.minutes ? { minutes: p.minutes } : {}),
                 ...(fm.action_kind === "records_request" && typeof p.stage === "string"
                   ? { stage_in_law: stageInLaw(p.stage, stages),
                       ...(inLaw.ambiguous ? { law_ambiguous: inLaw.ambiguous } : {}) } : {}) };
      }).filter((x) => Object.keys(x).length > 1),
      follows_action: fm.follows_action && typeof fm.follows_action === "object" ? fm.follows_action : null,
      followed_by: this.#followedBy(id, viewer),
      /* action-records R5 (was R87; K2850): the latest scope statement, false with none, and its statements. */
      confidential: this.records.confidential(id),
      scope: this.records.scopeOf(id),
      promises: this.records.promisesOf(id),
    };
    /* R9 (T45): the venue's delivery point beside an office addressee, where the profile's venue for the kind states one. */
    const facts = kindEntry && kindEntry.venue && Array.isArray(kindEntry.venue.facts) ? kindEntry.venue.facts : [];
    const dp = facts.find((f) => f && f.fact === "delivery_point");
    if (dp && counterpartyOffice(cp))
      out.delivery_point = { value: dp.value, citation: dp.citation ?? null,
                             says: word("actions.says.delivered_venue_states") };
    /* R93: a kind the view marks `shape: recognition`: what the recognition rests on. Nothing is refused for it. */
    if (kindEntry && kindEntry.shape === "recognition") {
      const compliant = live.some(({ d }) => !d.void && (Array.isArray(d.outcomes) ? d.outcomes : []).some((o) => o && o.outcome === "compliant"));
      const success = !compliant && (Array.isArray(fm.action_basis) ? fm.action_basis : [])
        .some((l) => l && l.kind === "rests_on" && typeof l.target === "string" && this.#successRecord(l.target, viewer));
      out.recognition_basis = compliant ? { basis: "compliant" } : success ? { basis: "success" }
        : { basis: "promise_only", ...T45_SENTENCES.recognition_promise_only };
    }
    void ledger;
    return out;
  }

  /* R75 (T45; N828, N883; v0.2 rule 3): one disclosure per distinct held check and per distinct accepted source edition
     among the live determinations' findings (conformance R9's `basis`, read as the viewer reads each determination,
     J1 8), and the override's; published findings carry none. */
  #disclosures(fm, live, id) {
    const out = [], seen = new Set();
    for (const { d } of live)
      for (const f of Array.isArray(d.findings) ? d.findings : []) {
        const b = f && f.basis && typeof f.basis === "object" ? f.basis : null;
        if (!b) continue;
        if (b.kind === "checked_held") {
          const k = `c\u0000${b.check ?? ""}\u0000${b.checked_at ?? ""}`;
          if (!seen.has(k)) { seen.add(k); out.push({ kind: "checked_held", checked_at: b.checked_at ?? null }); }
        } else if (b.kind === "accepted") {
          const k = `a\u0000${b.group ?? ""}\u0000${b.case ?? ""}\u0000${b.edition ?? ""}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ kind: "accepted", group: b.group ?? null, edition_date: b.edition_date ?? null,
                       accepted_at: b.accepted_at ?? null, identity: b.identity ?? null, stake: b.stake ?? "undetermined",
                       /* R105 (T50; N933; `conformance` R41): the source's matter stake as the finding's basis answers it. */
                       matter_stake: b.matter_stake ?? null });
          }
        }
      }
    const o = this.#overrideRead(id, fm);
    if (o) out.push({ kind: "override", ground: o.ground, reason: o.reason, by: o.by, at: o.at });
    return out;
  }

  /* R86 (T45): the actions the viewer may see that state they follow `id`. */
  #followedBy(id, viewer) {
    if (viewer === null || viewer === undefined || viewer === "") return [];
    const gate = viewerPredicate(viewer);
    const out = [];
    for (const r of this.#rows(`SELECT b.bundle_id, f.content FROM bundles b JOIN files f ON f.bundle_id = b.bundle_id
        AND f.path = 'bundle.md' WHERE b.object_type = 'action' AND (${gate.sql}) AND f.content LIKE '%follows_action%'
        ORDER BY b.bundle_id`, ...gate.args)) {
      let fm = null;
      try { fm = parseFrontmatter(r.content).data; } catch { fm = null; }
      const f = fm && fm.follows_action;
      if (f && typeof f === "object" && f.action === id) out.push({ action: r.bundle_id, ...(f.ord !== undefined ? { ord: f.ord } : {}) });
    }
    return out;
  }

  /** R9, R64, R65: "the action's date": the first `sent` entry's day, else the day it was created; null when neither
   *  is a calendar day. Answered with its basis. */
  static actionDate(fm) {
    const sent = (Array.isArray(fm && fm.correspondence) ? fm.correspondence : [])
      .find((e) => e && typeof e === "object" && e.direction === "sent" && isCalendarDate(String(e.at ?? "").slice(0, 10)));
    if (sent) return { date: String(sent.at).slice(0, 10), basis: word("actions.why.first_sent_correspondence") };
    const c = typeof (fm && fm.created) === "string" ? fm.created.slice(0, 10) : "";
    return isCalendarDate(c) ? { date: c, basis: word("actions.why.day_action_created") }
      : { date: null, basis: word("actions.why.action_states_date") };
  }

  #t33Read(fm, viewer) {
    const asOf = Actions.actionDate(fm);
    const date = asOf.date;
    /* R9: an office addressee, its entity (stated, or the bridge's at read), and who held it on the action's date. */
    const office = counterpartyOffice(fm.counterparty);
    let addressee = null;
    if (office) {
      const stated = office.entity_id ? { entity_id: office.entity_id, filled: "stated" }
        : office.legacy ? { entity_id: null, filled: "none", says: word("actions.says.earlier_addressee_named") }
        : this.#bridge(office.role, office.body, viewer);
      let holder;      if (!stated.entity_id) holder = { holder: null, undetermined: true, why: { key: "actions.office_entity_held_addressee", vars: {} } };
      else if (!date) holder = { holder: null, undetermined: true, why: { key: "actions.why.action_states_date", vars: {} } };
      else {
        let h = null;
        try { h = this.lines ? this.lines.holderAt({ office: stated.entity_id, at: date, viewer }) : null; } catch { h = null; }        holder = !h ? { holder: null, undetermined: true, why: { key: "actions.dated_lines_read", vars: {} } }
          : h.ok === false ? { holder: null, undetermined: true, why: { key: "actions.dated_lines_read", vars: {} }, refused: h.reason }
          : h.holder ? { holder: h.holder, line: h.line ? h.line.line_id : null, capacity: h.capacity ?? null }
          : { holder: null, undetermined: true, why: h.why, ...(h.lines ? { lines: h.lines } : {}) };
      }
      addressee = { role: office.role, body: office.body, ...stated,
                    holder_on_date: { ...holder, on: date,
                      says: word("actions.says.held_office_action") } };
    }
    /* R64: each law naming a held standard, with that standard's in-force state on the action's date. */
    const named = [];
    for (const l of Array.isArray(fm.governing_laws) ? fm.governing_laws : [])
      if (l && typeof l === "object" && typeof l.standard === "string" && l.standard.trim())
        named.push({ law: "governing", level: l.level ?? null, citation: l.citation ?? null, standard: l.standard.trim() });
    if (typeof fm.law_standard === "string" && fm.law_standard.trim())
      named.push({ law: "records", citation: typeof fm.law === "string" ? fm.law : null, standard: fm.law_standard.trim() });
    const law_standards = named.map((n) => {
      if (this.records.standardSeen(n.standard, viewer))
        return { ...n, in_force: null, says: word("actions.says.standard_read_answers") };
      let f = null;
      try { f = date ? this.standards.inForceAt({ standard: n.standard, date, viewer }) : null; } catch { f = null; }
      return { ...n, in_force: f ? { state: f.state ?? "undetermined", why: f.why ?? null, on: date }
                                 : { state: "undetermined", why: date ? word("actions.why.standard_period_read") : asOf.basis, on: date } };
    });
    /* R65: the proceeding, with its status on the action's date. */
    let proceeding = null;
    if (typeof fm.proceeding === "string" && fm.proceeding.trim()) {
      const pid = fm.proceeding.trim();
      let st = null;
      try { st = date && this.events ? this.events.proceedingStatusAt({ proceeding: pid, at: date, viewer }) : null; } catch { st = null; }
      proceeding = { entity_id: pid, on: date,
                     status: !st ? { stage: "undetermined", why: date ? word("actions.why.events_read") : asOf.basis }
                       : st.ok === false ? { stage: "undetermined", why: st.detail || st.reason }
                       : { stage: st.stage, ...(st.why ? { why: st.why } : {}), ...(st.label ? { label: st.label } : {}) } };
    }
    return { as_of_date: asOf, addressee, law_standards, proceeding };
  }

  /** R71 (H30 (1); intent R33; K2505): registered with `intent.registerNoneExistsReader`: the `records_request` actions
   *  the viewer may see whose `seeks` (action-grammar's `seeksOf`) names that progression, entity and stage and whose
   *  correspondence holds a `received` entry with outcome `none_exists`, each `{action, ord, at}` (the entry's position
   *  and date), oldest first, at most 50. No viewer sees none. Writes nothing and never throws; a read that fails
   *  answers `[]`, so no stage is met this way. */
  noneExistsFor({ progression = null, entity = null, stage = null, viewer = null } = {}) {
    try {
      const want = [progression, entity, stage];
      if (want.some((x) => typeof x !== "string" || !x) || viewer === null || viewer === undefined || viewer === "") return [];
      const gate = viewerPredicate(viewer);
      const rows = this.#rows(`SELECT b.bundle_id, f.content FROM bundles b
        JOIN files f ON f.bundle_id = b.bundle_id AND f.path = 'bundle.md'
        WHERE b.object_type = 'action' AND (${gate.sql}) AND f.content LIKE '%none_exists%' AND f.content LIKE '%seeks%'
        ORDER BY b.bundle_id`, ...gate.args);
      const out = [];
      for (const r of rows) {
        let fm = null;
        try { fm = parseFrontmatter(r.content).data; } catch { fm = null; }
        if (!fm || typeof fm !== "object" || fm.action_kind !== "records_request") continue;
        if (!seeksOf(fm).some((x) => x.progression === progression && x.entity === entity && x.stage === stage)) continue;
        (Array.isArray(fm.correspondence) ? fm.correspondence : []).forEach((e, ord) => {
          if (e && typeof e === "object" && e.direction === "received" && e.outcome === "none_exists")
            out.push({ action: r.bundle_id, ord, at: e.at === undefined || e.at === null ? null : String(e.at) });
        });
      }
      out.sort((p, q) => (String(p.at) < String(q.at) ? -1 : String(p.at) > String(q.at) ? 1
        : p.action < q.action ? -1 : p.action > q.action ? 1 : p.ord - q.ord));
      return out.slice(0, NONE_EXISTS_MAX);
    } catch { return []; }
  }

  /* R8: the override as the document states it, stamped with who and when from this module's table; null when the
     document states none. */
  #overrideRead(id, fm) {
    const o = Actions.overrideOf(fm);
    if (!o) return null;
    const r = this.#one(`SELECT stated_by, at FROM action_overrides WHERE bundle_id=?`, id);
    return { ground: o.ground, reason: o.reason, by: r ? r.stated_by : null, at: r ? r.at : null,
             /* R74: an override written before T45 reads as written, its ground not stated, never re-asked. */
             ...(o.ground ? {} : { ground_not_stated: T45_SENTENCES.ground_not_stated }),
             says: word("actions.says.rests_unestablished_premise") };
  }

  /* R5: the recorded author class of the action's creation (record-core R15–R16's manifest, first by `seq`): a law
     written before C-32.20's fence was written with the action, and since the fence no machine can state one. */
  #lawAuthor(id, fm) {
    if (!fm || typeof fm.law !== "string" || !fm.law.trim()) return null;
    let entries = [];
    try {
      const im = this.record.readImage(id);
      const m = im ? im["_history/manifest.json"] : null;
      entries = (JSON.parse(typeof m === "string" ? m : m && m.text ? m.text : "{}").entries) || [];
    } catch { entries = []; }
    const first = [...entries].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))[0];
    return first && typeof first.author === "string" ? first.author : null;
  }

  /** R29: one action's block (R25) for a viewer. */
  actionRead({ id, viewer = null, now = null } = {}) {
    /* R106 (T50; N1178): an id no action the caller may see answers to (absent, invisible, or a bundle that is no action)
       is answered through R43, `NO_SUCH_ACTION`, the same bytes for the three. */
    const b = id ? this.#visibleAction(id, viewer) : null;
    if (!b || normalizeType(b.object_type) !== "action") return noSuchAction(id ?? null);
    const fm = this.#heldFm(id) || {};
    const d = this.derived({ bundle_id: id }, now, viewer);
    /* R29 (K248): R25's keys, and the document's own values its users read (filings, escalation). */
    /* R102 (T48; N1035, K3145): the action's project (`record-core` R34, null when none) and title (the document's, as held). */
    let project = null;
    try { project = this.record.bundleInfo(id)?.project ?? null; } catch { project = null; }
    return { ok: true, id, current_state: b.current_state, ...d, project,
             title: typeof fm.title === "string" ? fm.title : null,
             counterparty: fm.counterparty ?? null, clock: Array.isArray(fm.clock) ? fm.clock : [],
             legs: d.basis.map((l) => ({ target: l.target_id, kind: l.kind, note: l.note ?? null, at: l.at ?? null,
                                         target_type: l.target_type, extent_capture: l.extent_capture })),
             law: typeof fm.law === "string" ? fm.law : null, breach: fm.breach === true,
             /* K248, B4 (filings R9's chronology): the state moves in order, each {state, at, by}. */
             state_history: (Array.isArray(fm.state_history) ? fm.state_history : [])
               .filter((e) => e && typeof e === "object")
               .map((e) => ({ state: e.to_state ?? null, at: e.timestamp ?? null, by: e.author ?? null })) };
  }

  /** R30: visible actions by filters, in id order, at most 200 per page, `truncated` by reading one past. */
  actionsFor({ determination = null, counterparty = null, state = null, kind = null, after = null, limit = null,
               proceeding = null, basis_void = null, follows = null, viewer = null } = {}) {
    const max = clampLimit(limit, ACTIONS_PAGE_MAX, ACTIONS_PAGE_MAX);
    const gate = viewerPredicate(viewer);
    const where = [`b.object_type='action'`, `(${gate.sql})`, `b.bundle_id>?`], fixed = [...gate.args];
    const tail = [];
    if (state) { where.push(`b.current_state=?`); tail.push(String(state)); }
    if (determination) { where.push(`EXISTS (SELECT 1 FROM action_basis l WHERE l.bundle_id=b.bundle_id AND l.kind='rests_on' AND l.target_id=?)`); tail.push(String(determination)); }
    const out = [];
    let truncated = false;
    /* kind and counterparty are read from the document, so the page is filled by reading on in id order. */
    let from = after ? String(after) : "";
    for (;;) {
      const rows = this.#rows(`SELECT b.bundle_id, b.current_state FROM bundles b WHERE ${where.join(" AND ")}
        ORDER BY b.bundle_id LIMIT ?`, ...fixed, from, ...tail, max + 1);
      for (const r of rows) {
        from = r.bundle_id;
        const fm = this.#heldFm(r.bundle_id) || {};
        if (kind && fm.action_kind !== kind) continue;
        if (counterparty && counterpartyName(fm.counterparty) !== counterparty) continue;
        /* R65: the actions belonging to a proceeding. */
        if (proceeding && fm.proceeding !== proceeding) continue;
        /* R86 (T45): the actions that follow `follows`. */
        if (follows && !(fm.follows_action && typeof fm.follows_action === "object" && fm.follows_action.action === follows)) continue;
        /* R76 (T45): the actions resting on a determination conformance answers void, derived on this read. */
        const voids = basis_void === true || basis_void === "true"
          ? this.#legDeterminations(fm, viewer).filter(({ d }) => d.void).map(({ id: x, d }) =>
              ({ determination: x, causes: Array.isArray(d.void.causes) ? d.void.causes : [] })) : null;
        if (voids && !voids.length) continue;
        if (out.length === max) { truncated = true; break; }
        const cp = fm.counterparty && typeof fm.counterparty === "object" ? fm.counterparty : null;
        out.push({ id: r.bundle_id, state: r.current_state, kind: fm.action_kind ?? null,
                   counterparty: counterpartyName(fm.counterparty), counterparty_state: fm.counterparty?.state ?? null,
                   /* R9 (T45): a press addressee's holder, kept inside the group: the read and this list only. */
                   ...(cp && cp.kind === "press" && typeof cp.holder === "string" && cp.holder.trim() ? { holder: { name: cp.holder.trim() } } : {}),
                   ...(voids ? { basis_void: voids } : {}), confidential: this.records.confidential(r.bundle_id) });
      }
      if (truncated || rows.length <= max) break;
    }
    const cursor = out.length ? out[out.length - 1].id : null;
    return { ok: true, items: out, limit: max, truncated, cursor,
             ...(determination && !this.conformance ? { determination_read: "undetermined",
                 says: word("actions.says.legs_matched_determination") } : {}) };
  }

  /** R62 (A ORG): the offices the record holds as `custodian_of` or `responsible_for` a subject (an entity, or a record
   *  the action rests on, read through the entities its captures resolve to at an established grade), each as R9's
   *  office arm with the line it rests on and that line's two grades, valid on the action's date or today
   *  (`lines.structureAt`); undetermined ones apart, with why. A suggestion: it writes nothing and sets nothing. */
  addresseeSuggest({ action = null, subject = null, viewer = null } = {}) {
    const subj = typeof subject === "string" ? subject.trim() : "";
    /* DEC-49 REGION is-addressee-subject */
    if (!subj) return refuse("NO_SUBJECT", "an addressee is suggested for a subject: an entity (ENT-) or a record the "
      + "action rests on. Nothing was read.");
    /* END DEC-49 REGION is-addressee-subject */
    let at = null, basis = "today";
    if (action) {
      const b = this.#visibleAction(String(action), viewer);
      if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: action };
      if (normalizeType(b.object_type) !== "action") return { ok: false, reason: "NOT_AN_ACTION", target: action };
      const d = Actions.actionDate(this.#heldFm(String(action)) || {});
      if (d.date) { at = d.date; basis = d.basis; }
    }
    if (!at) at = localToday(this.#nowMs(null), zoneOf(this.place())) ?? instantOf(this.#nowMs(null));
    let entities;
    if (ENTITY_ID_RE.test(subj)) {
      const kind = this.#entityKind(subj);
      if (!kind) return noSuchEntity(subj, { end: "subject" });
      /* R111 (amends R62): a subject that is itself an office is the office, answered as named. */
      if (kind === "office") {
        const r = this.entities.readEntity({ entityId: subj });
        const role = r && r.found && r.entity ? r.entity.label : null;
        const { body, why } = this.#officeBody(subj, at, viewer);
        const r1 = body ? officeLayer({ state: "named", kind: "office", role, body }, this.#layersAt(null)) : null;
        const named = body ? [{ addressee: { state: "named", kind: "office", role, body, entity_id: subj, layer: r1 && r1.ok ? r1.layer : null },
                                concerns: subj, line: null }] : [];
        return { ok: true, subject: subj, at, at_basis: basis, offices: named,
                 undetermined: body ? [] : [{ office: subj, concerns: subj, line: null, why }], suggestion: true,
                 says: word("actions.says.offices_record_holds") };
      }
      entities = [subj];
    } else {
      const b = this.#visibleAction(subj, viewer);
      if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: subj };
      try {
        entities = this.#rows(`SELECT DISTINCT entity_id FROM resolutions WHERE bundle_id=? AND established=1 ORDER BY entity_id LIMIT 51`, subj)
          .map((r) => r.entity_id);
      } catch { entities = []; }
    }
    const lines = this.lines;
    const offices = [], undetermined = [];
    const seen = new Set();
    /* R115 (T53): each office answered with the layer that gives it (`officeLayer` over today's layers), null when none
       or more than one does. */
    const active = this.#layersAt(null);
    const withLayer = (a) => { const r = officeLayer(a, active); return { ...a, layer: r.ok ? r.layer : null }; };
    const label = (id) => { let r = null; try { r = this.entities.readEntity({ entityId: id }); } catch { r = null; }
                            return r && r.found && r.entity ? r.entity.label : null; };
    const bodyOf = (office) => this.#officeBody(office, at, viewer);
    for (const e of entities.slice(0, 50)) {
      let r = null;
      try { r = lines ? lines.structureAt({ entity: e, at, kinds: ["custodian_of", "responsible_for"], viewer }) : null; } catch { r = null; }
      if (!r || r.ok === false) { undetermined.push({ subject: e, why: word("actions.dated_lines_read") }); continue; }
      for (const l of r.held || []) {
        if (l.to !== e || this.#entityKind(l.from) !== "office" || seen.has(`${l.from}|${l.line_id}`)) continue;
        seen.add(`${l.from}|${l.line_id}`);
        const line = { line_id: l.line_id, kind: l.kind, grades: { assertion: l.assertion, ends: l.ends } };
        const b = bodyOf(l.from);
        if (b.body) offices.push({ addressee: withLayer({ state: "named", kind: "office", role: label(l.from), body: b.body, entity_id: l.from }),
                                   concerns: e, line });
        else undetermined.push({ office: l.from, concerns: e, line, why: b.why });
      }
      for (const u of r.undetermined || [])
        if (u.line && u.line.to === e) undetermined.push({ office: u.line.from, concerns: e,
          line: { line_id: u.line.line_id, kind: u.line.kind, grades: { assertion: u.line.assertion, ends: u.line.ends } }, why: u.why });
    }
    return { ok: true, subject: subj, at, at_basis: basis, offices, undetermined, suggestion: true,
             says: offices.length || undetermined.length
               ? word("actions.says.offices_record_holds")
               : word("actions.says.record_holds_custodian") };
  }

  /* R62, R111: the body an office is a post in on a day (`lines.structureAt`, `post_in`), or why none is read. */
  #officeBody(office, at, viewer) {
    let r = null;
    try { r = this.lines.structureAt({ entity: office, at, kinds: ["post_in"], viewer }); } catch { r = null; }
    const held = r && r.ok ? (r.held || []).filter((l) => l.from === office) : [];
    return held.length === 1 ? { body: this.#entityLabel(held[0].to) } : { why: held.length ? word("actions.why.office_held_body")
      : word("actions.why.line_date_places") };
  }
  #entityLabel(id) {
    let r = null;
    try { r = this.entities.readEntity({ entityId: id }); } catch { r = null; }
    return r && r.found && r.entity ? r.entity.label : null;
  }

  /* R66, R67: the visible actions, each with its document, in id order (the sources read the group's own acts). */
  #visibleActions(viewer) {
    if (viewer === null || viewer === undefined || viewer === "") return [];
    const gate = viewerPredicate(viewer);
    return this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='action' AND (${gate.sql}) ORDER BY b.bundle_id`,
      ...gate.args).map((r) => ({ id: r.bundle_id, fm: this.#heldFm(r.bundle_id) || {} }));
  }
  static #inWindow(day, from, to) {
    const d = String(day ?? "").slice(0, 10);
    if (!isCalendarDate(d)) return false;
    if (from && d < String(from).slice(0, 10)) return false;
    if (to && d > String(to).slice(0, 10)) return false;
    return true;
  }

  /** R66 (EVENTS 2a; K1494): "what we did", for `events.timeline`: the group's own acts (each correspondence entry and
   *  each move) on the actions the viewer may see whose office entity, `proceeding` or a leg's target is in `set`, each
   *  `{at, label, ref, kind}` at the entry's own date, within `from`–`to`, at most `limit`. No viewer: nothing (R36).
   *  (T45; S1 §D 9; v0.2 rule 15) For every caller it never answers a confidential action (R87), an action of a counsel
   *  matter (`project-roster.projectScope`, its R23), an action never sent (plan deliberation), nor a move before the
   *  action's first sending; no item carries a contact, speaker, press holder, promise, pressure note or hold. Under
   *  `audience: "public"` it answers the group's outward acts only (its sent entries and its moves from the first
   *  sending; J1 9), each marked `public: true` (case-authoring R57). */
  eventSource({ set = null, from = null, to = null, limit = null, viewer = null, audience = null } = {}) {
    const ids = new Set((Array.isArray(set) ? set : typeof set === "string" ? set.split(",") : []).map((x) => String(x).trim()).filter(Boolean));
    const max = clampLimit(limit, 100, 500);
    const pub = audience === "public";
    const items = [];
    if (!ids.size) return items;
    for (const { id, fm } of this.#visibleActions(viewer)) {
      const office = counterpartyOffice(fm.counterparty);
      const ends = [office && office.entity_id, typeof fm.proceeding === "string" ? fm.proceeding : null,
                    ...(Array.isArray(fm.action_basis) ? fm.action_basis : []).map((l) => (l && typeof l.target === "string" ? l.target : null))];
      if (!ends.some((x) => x && ids.has(x))) continue;
      const ledger = Array.isArray(fm.correspondence) ? fm.correspondence : [];
      const firstSent = ledger.filter((e) => e && typeof e === "object" && e.direction === "sent")
        .map((e) => String(e.at ?? "").slice(0, 10)).filter(isCalendarDate).sort()[0];
      /* R66 (T47; N961): confidential is `action-records.confidential` (its R5). */
      if (!firstSent || this.records.confidential(id) || this.#counselMatter(id)) continue;
      ledger.forEach((e, ord) => {
        if (!e || typeof e !== "object" || !Actions.#inWindow(e.at, from, to)) return;
        if (pub && e.direction !== "sent") return;
        items.push({ at: String(e.at).slice(0, 10), kind: `correspondence_${e.direction}`, ref: `${id}#correspondence/${ord}`,
                     label: `${e.direction === "sent" ? "we sent" : e.direction === "received" ? "we received" : "no response recorded"}`
                       + ` (${counterpartyName(fm.counterparty) ?? "addressee undetermined"})`, ...(pub ? { public: true } : {}) });
      });
      (Array.isArray(fm.state_history) ? fm.state_history : []).forEach((h, i) => {
        if (!h || typeof h !== "object" || !Actions.#inWindow(h.timestamp, from, to)) return;
        if (String(h.timestamp).slice(0, 10) < firstSent) return;
        items.push({ at: String(h.timestamp), kind: "move", ref: `${id}#move/${i}`,
                     label: word("actions.label.moved_action", { from_state: String(h.from_state), to_state: String(h.to_state) }), ...(pub ? { public: true } : {}) });
      });
    }
    items.sort((p, q) => (String(p.at) < String(q.at) ? -1 : String(p.at) > String(q.at) ? 1 : p.ref < q.ref ? -1 : 1));
    return items.slice(0, max);
  }
  /* R66 (T45; reconciliation R8): whether the action's project (record-core R34) is a counsel matter (project-roster
     R23). A project that cannot be read is read as one, so nothing of a counsel matter is answered by chance. */
  #counselMatter(id) {
    try {
      const project = this.record.bundleInfo(id)?.project ?? null;
      if (!project) return false;
      const roster = this.projectRoster;
      if (!roster || typeof roster.projectScope !== "function") return false;
      return roster.projectScope(project).scope === "counsel_matter";
    } catch { return true; }
  }

  /** R67 (K1466; duties R16): the items that trigger a body's response duty: each `sent` correspondence entry of an
   *  action of the duty's trigger kinds (`trigger.action_kinds`, else `records_request`) addressed to the duty's obligor
   *  office, `{ref, date, label}`, within `from`–`to`. An action the viewer may not see contributes nothing. */
  triggerSource({ duty = null, from = null, to = null, viewer = null } = {}) {
    const obligor = duty && typeof duty.obligor === "string" ? duty.obligor : null;
    if (!obligor) return [];
    const t = duty.trigger && typeof duty.trigger === "object" ? duty.trigger : {};
    const kinds = Array.isArray(t.action_kinds) && t.action_kinds.length ? t.action_kinds
      : typeof t.action_kind === "string" ? [t.action_kind] : ["records_request"];
    const out = [];
    for (const { id, fm } of this.#visibleActions(viewer)) {
      const office = counterpartyOffice(fm.counterparty);
      if (!kinds.includes(fm.action_kind) || !office || office.entity_id !== obligor) continue;
      (Array.isArray(fm.correspondence) ? fm.correspondence : []).forEach((e, ord) => {
        if (!e || e.direction !== "sent" || !Actions.#inWindow(e.at, from, to)) return;
        out.push({ ref: `${id}#correspondence/${ord}`, date: String(e.at).slice(0, 10),
                   label: word("actions.label.group_sent", { action_kind: String(fm.action_kind), counterparty: String(counterpartyName(fm.counterparty)) }) });
      });
    }
    return out;
  }

  /* ================================================================ T45: open items, listeners (receipt, scope and promises are
     `action-records`' since T47, its R4–R6) */

  /** R95 (T45; Actions D21; v0.2 rule 16): `registerResponseListener(module, fn)`, one registration per module (K31's
   *  pattern, `membership.listenerRefusal`). After a `received` entry is promoted by `actionCorrespond`, each `fn({action,
   *  ord, project, recorder, at})` is called once, after the write's transaction. */
  registerResponseListener(module, fn) {
    const refused = listenerRefusal(this.#responseListeners, module, fn, { slot: "response_listener" });
    if (refused) return refused;
    this.#responseListeners.push({ module, fn });
    return { ok: true, module };
  }
  /* R95: a listener that throws is logged and never undoes or refuses the entry; a Promise's rejection likewise. */
  #tellResponse({ action, ord, recorder, at }) {
    if (!this.#responseListeners.length) return;
    let project = null;
    try { project = this.record.bundleInfo(action)?.project ?? null; } catch { project = null; }
    for (const l of this.#responseListeners) {
      try {
        const r = l.fn({ action, ord, project, recorder, at });
        if (r && typeof r.then === "function") r.then(null, (e) => Actions.#logListener(l.module, e));
      } catch (e) { Actions.#logListener(l.module, e); }
    }
  }
  static #logListener(module, e) {
    try { console.error(`actions: response listener of ${module} threw: ${String(e && e.message || e).slice(0, 200)}`); } catch { /* the entry stands */ }
  }

  /** R92 (T45; N892 (a); Actions D28a; v0.2 rule 21): the group's open actions the viewer may see addressed to the same
   *  office as `counterparty` (an addressee, or its JSON) or as `action`'s addressee: equal `entity_id`, else equal role
   *  and body. Each with its kind, state, first sent date and whether its reply is overdue (R12), and the count of
   *  overdue replies. Facts, never a block: no act is refused on it. */
  openItemsWith({ counterparty = null, action = null, viewer = null } = {}) {
    let cp = counterparty;
    if (typeof cp === "string") { try { cp = JSON.parse(cp); } catch { cp = null; } }
    let self = null;
    if (!cp && action) {
      const b = this.#visibleAction(String(action), viewer);
      if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target: action };
      if (normalizeType(b.object_type) !== "action") return { ok: false, reason: "NOT_AN_ACTION", target: action };
      self = String(action);
      cp = (this.#heldFm(self) || {}).counterparty ?? null;
    }
    if (!cp && !action) return { ok: false, reason: "NO_TARGET", detail: "pass counterparty=<an addressee> or action=<action id>" };
    const office = counterpartyOffice(cp);
    if (!office || office.legacy)
      return { ok: true, items: [], overdue_replies: 0, truncated: false, ...T45_SENTENCES.openitems_not_office };
    const now = this.#nowMs(null), view = this.governingView();
    const items = [];
    let truncated = false;
    for (const { id, fm } of this.#visibleActions(viewer)) {
      if (id === self || !Actions.#sameOffice(office, counterpartyOffice(fm.counterparty))) continue;
      const st = this.#one(`SELECT current_state FROM bundles WHERE bundle_id=?`, id);
      const state = st ? st.current_state : fm.current_state ?? null;
      if (state === "resolved" || state === "abandoned") continue;
      if (items.length === OPEN_ITEMS_MAX) { truncated = true; break; }
      const sent = (Array.isArray(fm.correspondence) ? fm.correspondence : []).find((e) => e && e.direction === "sent");
      items.push({ action: id, kind: fm.action_kind ?? null, state, first_sent: sent ? String(sent.at).slice(0, 10) : null,
                   clock_overdue: actionOverdue(fm, now, view) });
    }
    return { ok: true, office: { role: office.role, body: office.body, entity_id: office.entity_id ?? null }, items,
             overdue_replies: items.filter((x) => x.clock_overdue === true).length, truncated, limit: OPEN_ITEMS_MAX,
             says: word("actions.says.group_open_actions") };
  }
  /* R92: R9's office equality: equal entity ids where both state one, else equal role and body. */
  static #sameOffice(a, b) {
    if (!a || !b || b.legacy) return false;
    if (a.entity_id && b.entity_id) return a.entity_id === b.entity_id;
    return !!a.role && !!a.body && a.role === b.role && a.body === b.body;
  }

  /** R97 (T45; consequences R19): of `ids`, those that are an action bundle of this instance or the capture of one of its
   *  `sent` entries, whatever the viewer; it names nothing back but what it was given, and throws only when it cannot read. */
  ownActIds({ ids = [] } = {}) {
    const asked = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))];
    return asked.filter((x) => this.#one(`SELECT 1 AS y FROM bundles WHERE bundle_id=? AND object_type='action'`, x)
      || this.#one(`SELECT 1 AS y FROM correspondence WHERE direction='sent' AND artifact_sha=?`,
                   x.replace(/^sha256:/, "").toLowerCase()));
  }
  /** R97 (T45; standards R53): whether `captureSha` is the capture of one of this instance's `sent` entries; throws only
   *  when it cannot read (standards then reads the capture as the group's own). */
  ownSending({ captureSha = null } = {}) {
    const sha = typeof captureSha === "string" ? captureSha.trim().replace(/^sha256:/, "").toLowerCase() : "";
    if (!sha) return false;
    return !!this.#one(`SELECT 1 AS y FROM correspondence WHERE direction='sent' AND artifact_sha=?`, sha);
  }

}

/* The acts answer their catalogue-backed refusals with code, check and translation (the Provides' "Terms"). */
for (const m of ["actionMove", "actionCorrespond", "actionLaws", "actionRiskTier", "actionQuotes", "actionCreate", "check"]) {
  const fn = Actions.prototype[m];
  Actions.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it declares its tables, registers its step, audit, facts and
 *  decoration (R3, R12, R25, R36, R51; retrieval R53, R56), its litigation-hold reader (R55; doorbell R3), its reader of
 *  holds over a project (R69; ratification R45) and its none-exists reader (R71; intent R33). */
export function actionsOf(host, deps) {
  let a = instances.get(host);
  if (!a) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    a = new Actions({ ...d, host, storage, record, membership, promotion });
    instances.set(host, a);
    a.migrate();
    void a.conformance;   /* R8: conformance joins the host before this module's step runs (K252) */
    record.declarePurge("actions", [...ACTIONS_TABLES]);
    /* T47 (N961; split map §7 risk 1): `action-records` is created here, so its six tables exist and are declared at
       every boot, in the same change that drops them from ACTIONS_TABLES (its R15). */
    void a.records;
    promotion.registerStep("actions", { check: (c) => a.check(c), project: (c) => a.project(c) });
    record.registerAuditCheck("actions", (image) => a.audit(image));
    const retrieval = d.retrieval === null ? null : a.retrieval;
    if (retrieval) {
      retrieval.registerActionFacts("actions", (md, nowMs) => actionFacts(md, nowMs, a.governingView()));
      retrieval.registerProjectionDecoration("actions", (row, { nowMs, viewer } = {}) =>
        (normalizeType(row && row.object_type) === "action" ? { action: a.derived(row, nowMs, viewer ?? null) } : {}));
    }
    /* R66, R67 (T33-73): the "what we did" source with events and the trigger source with duties, once per host; a
       registration either refuses (this module's already held) leaves the earlier one standing. A host on which either
       cannot be created registers nothing there. */
    const events = d.events === null ? null : a.events;
    if (events && typeof events.registerEventSource === "function")
      events.registerEventSource("actions", (args) => a.eventSource(args || {}));
    const duties = d.duties === null ? null : a.duties;
    if (duties && typeof duties.registerTriggerSource === "function")
      duties.registerTriggerSource("actions", (args) => a.triggerSource(args || {}));
    /* R97 (T45; consequences R19, standards R53): once per host, the reader of the group's own acts and the check of its
       own sendings, each reached as ratification is (the composition root's environment, or given), so this module never
       makes either before its composer does. A registration either refuses (this module's already held) leaves the
       earlier one standing; a host on which either cannot be created registers nothing there. */
    const consequences = d.consequences === null || !(d.consequences || d.env) ? null : a.consequences;
    if (consequences && typeof consequences.registerOwnActReader === "function")
      consequences.registerOwnActReader((args) => a.ownActIds(args || {}));
    const standards = d.standards === null || !(d.standards || d.env) ? null : a.standards;
    if (standards && typeof standards.registerOwnSendingCheck === "function")
      standards.registerOwnSendingCheck("actions", (args) => a.ownSending(args || {}));
    /* R71 (intent R33; K2505): once per host, the reader of records requests answered that no such record exists,
       reached as ratification is (the composition root's environment, or given); a reader already held
       (`NONE_EXISTS_READER_DECLARED`) stands. */
    let intent = null;
    if (d.intent !== null && (d.intent || d.env)) {
      try { intent = d.intent || intentOf(host); } catch { intent = null; }
    }
    if (intent && typeof intent.registerNoneExistsReader === "function")
      intent.registerNoneExistsReader((args) => a.noneExistsFor(args || {}));
  }
  return a;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function actionsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return ACTIONS_TABLES.includes(name);
}

/* R101: this act's own sentences for the five conditions `action-records` R16 answers, kept as `actionCorrespond` worded them. */
const CORRESPOND_DETAIL = Object.freeze({
  MACHINE_CANNOT_CORRESPOND: "a correspondence entry is a named member's statement that this exchange happened — "
    + "and on the testimony arm it IS the evidence. A machine credential may capture bytes "
    + "and may not testify to an exchange. Sign in as a member.",
  BAD_DATE: "every entry in this ledger is dated YYYY-MM-DD, a day the calendar has, including a "
    + "non-response, which is dated by when the reply was due",
  CAPTURE_AND_TESTIMONY: localize("actions.index.an_entry_carries_the_captured", "an entry carries the captured bytes OR a named account, never both: what comes back is CAPTURED, not summarised (DEC-13). A paraphrase beside the bytes is what a reader would quote instead of the thing the team can defend."),
  NEITHER_CAPTURE_NOR_TESTIMONY: "an entry carries either an artifact_sha that resolves in the register or an account "
    + "with an author. Neither is an entry that asserts an exchange and offers no way "
    + "to check that it happened.",
  UNREGISTERED_ARTIFACT: "this hash names no capture in this store. Capture the artifact first (op=capture), or "
    + "record a named account instead — those are the two honest ways to hold an exchange.",
});

/** The module's ops (K3), as entries of the plane's one route map (plane R5: `routes` spreads them in, and
 *  control-plane's `dispatch` answers every store request over it). `viewer`, `author` and `proposer` are the control
 *  plane's stamps, read from the query, so a caller's own copy never wins. */
export function actionsOps(a, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  return {
    /* R103 (T48; N1040, K3147): this module's own arms only; the plane spreads `actionRecordsOps` (its R45) beside them. */
    actionmove: () => a.actionMove({ target: q("target"), to: q("to"), reason: q("reason"), resolution: q("resolution"),
                                     viewer: q("viewer"), author: q("author") }),
    actionlaws: () => a.actionLaws({ target: q("target") || b.target, laws: b.laws, viewer: q("viewer"), author: q("author") }),
    actionrisktier: () => a.actionRiskTier({ target: q("target") || b.target, tier: q("tier") ?? b.tier ?? null,
                                             reason: q("reason") ?? b.reason ?? null, viewer: q("viewer"), author: q("author") }),
    actioncorrespond: () => a.actionCorrespond({ target: q("target"), direction: q("direction"), at: q("at"),
      medium: q("medium"), party: q("party"), artifactSha: q("artifact_sha"), account: q("account"),
      quoteAmount: q("quote_amount"), quoteCurrency: q("quote_currency"), quoteBasis: q("quote_basis"),
      quoteAnswers: q("quote_answers"), quoteRevises: q("quote_revises"),
      stage: q("stage"), follows: q("follows"), outcome: q("outcome"), exemptions: q("exemptions"),
      dueBy: q("due_by"), dueCite: q("due_cite"),
      speaker: q("speaker") ?? b.speaker ?? "", officeStatus: b.office_status ?? q("office_status"),
      foundElsewhere: b.found_elsewhere ?? q("found_elsewhere"), minutes: b.minutes ?? q("minutes"),
      pressure: b.pressure ?? (q("pressure_kind") !== null || q("pressure_note") !== null
        ? { kind: q("pressure_kind") ?? "", note: q("pressure_note") ?? "" } : null),
      viewer: q("viewer"), author: q("author") }),
    /* R47: the action's creation as a promotion, its read and its list, with the stamps the control plane makes. */
    actioncreate: () => a.actionCreate({ document: typeof b.document === "string" ? b.document : null,
                                         viewer: q("viewer"), author: q("author") }),
    action: () => a.actionRead({ id: q("id") || q("target") || b.id || null, viewer: q("viewer"), now: q("now") }),
    actions: () => a.actionsFor({ determination: q("determination"), counterparty: q("counterparty"), state: q("state"),
                                  kind: q("kind"), after: q("after"), limit: q("limit"),
                                  proceeding: q("proceeding"), basis_void: q("basis_void"), follows: q("follows"),
                                  viewer: q("viewer") }),
    /* R62: the offices the record holds as custodian of or responsible for a subject, suggested; a read. */
    addresseesuggest: () => a.addresseeSuggest({ action: q("action") || b.action || null, subject: q("subject") || b.subject || null,
                                                 viewer: q("viewer") }),
    actionquotes: () => a.actionQuotes({ counterparty: q("counterparty"), request: q("request"), answers: q("answers"),
                                         viewer: q("viewer") }),
    /* R42 (N231): the kinds this instance accepts, a read for every signed-in class (the op's spec is the control
       plane's). */
    actionkinds: () => ({ ok: true, kinds: a.kinds() }),
    /* R92 (T45): the open items with an office, a read. */
    openitemswith: () => a.openItemsWith({ counterparty: b.counterparty ?? q("counterparty"), action: q("action") ?? b.action ?? null,
      viewer: q("viewer") }),
  };
}

/* R109 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  actionmove: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.actionmove.does",
    fields: { accepts: ["target","to","reason","resolution"], requires: ["target","to","reason"] } },
  actionlaws: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: "act.actionlaws.does",
    fields: { accepts: ["target","laws"], requires: ["target","laws"] } },
  actionrisktier: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.actionrisktier.does",
    fields: { accepts: ["target","tier","reason"], requires: ["target","tier","reason"] } },
  actioncorrespond: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.actioncorrespond.does",
    fields: { accepts: ["target","direction","at","medium","party","artifact_sha","account","quote_amount","quote_currency","quote_basis","quote_answers","quote_revises","stage","follows","outcome","exemptions","due_by","due_cite","speaker","office_status","found_elsewhere","minutes","pressure","pressure_kind","pressure_note"], requires: ["target","direction","at",["account","artifact_sha"]] } },
  actioncreate: { classes: ["admin","member","probe"], mutating: true, weight: "undetermined", description: localize("actions.declared.actioncreate", "creation: a member creates an action from its document, the same write as its promotion; acts on no existing bundle"),
    fields: { accepts: ["document"], requires: ["document"] } },
  addresseesuggest: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("actions.declared.addresseesuggest", "read: the offices the record holds as responsible for an action's subject on its date, as a suggestion; writes nothing"),
    fields: { accepts: ["action","subject"], requires: ["subject"] } },
});
