/* filing-templates — the group's governed library of filing templates (requirements:
 * `build/requirements/filing-templates.md`; Bob's direction K903 (6), his answers K921 and K924; the design
 * `build/plan/draft-filing-templates.md` §3 as §5 amends it; BOB's readings K927).
 *
 * A template is wording, with named blanks, that a group may file in its own name (`use: file`, Tier 1 and 2 kinds) or
 * send to counsel as the basis of a briefing (`use: brief`, any tier). It is versioned, never edited: a version's text
 * is revised while it is a draft (every revision kept), then fixed when it goes to review; members review it, and
 * professionals review it through a revocable grant; a member who is not its sole author approves it after the
 * reviews its tier requires. Every approved version is offered for a filing (an earlier one reads `updated`), the
 * latest by default; a retired template offers none. A machine proposes wording and comments, labelled, and nothing
 * else (R22). The profile's templates are read here as approved versions, read-only (R15), and since T45 offered only
 * when attributed as v0.2 rule 11 asks, each by its own name (R26), never a court petition (R28). It also publishes the
 * closed set of blanks every template and filing uses (R19, `./blanks.mjs`). T48 (R33): it holds the quoting sentence a
 * request for comment carries and its one check, `rfcQuotingRefusal`, which approving a file version and offering a
 * profile template of that kind both answer through.
 *
 * A NEW MODULE (T21, layer 9; K921). Copied from `filings` (K624 (1)): `FILING_BLANKS` and `FILING_TEXT_MAX`
 * (`./blanks.mjs`), `templateSave`'s checks (name, kind, text, tier, name taken) into R1 and R2's judges, `templatesFor`'s
 * read into R14's, and the library's rows (`./checks.mjs`); `filings`' T21 job deleted its copies. Its migration takes
 * every template `filings` R26 saved as a draft of origin `group` (K927): offered only once reviewed and approved.
 *
 * REACHED as `filingTemplatesOf(host, deps)` (K61): one instance per host, created on the first call. At creation it
 * creates its tables, declares them to record-core's purge (R17), registers its opaque ids' seed and runs the migration.
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record          layer 2: `transact`, `mintOpaqueId`, `getSetting` (the active profiles), `declarePurge`,
 *                   `registerMintSeed`.
 *   membership      `isJoinedParticipant`, `isProjectOwner` (R54), `isAdministrator` (R64), `memberFacts` (R68),
 *                   `expertiseList` (R24), `inSight` (R80), `positionalMember` (R76); and `viewerPredicate` (R43).
 *   jurisdictions   `get` (default the module itself): R1's profiles and tiers, R15's templates.
 *   now             the instance clock, milliseconds (default `env.BIO_NOW_MS`, else the wall clock).
 *
 * READ CONTRACTS: record-core's `bundles`, through membership's sight; `filings`' `filing_templates` (its retired R26
 * library's table, written by nothing since T21; K986), read by the migration only, never written. No place, law,
 * venue or wording is named here (R18). */

import { recordOf, stampInstant, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import * as jurisdictionsModule from "../../../jurisdictions/index.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { proposalLabel } from "../record-grammar/labels.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { RISK_TIERS, PRODUCT_KINDS } from "../action-grammar/index.mjs";
import { FILING_BLANKS, FILING_TEXT_MAX, blanksOf } from "./blanks.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { FILING_TEMPLATE_CHECKS, rowOf } from "./checks.mjs";
import { FILING_TEMPLATES_TABLES, FILING_TEMPLATES_MINT_SEED, migrateFilingTemplates } from "./schema.mjs";

export { FILING_BLANKS, FILING_TEXT_MAX, blanksOf } from "./blanks.mjs";
export { FILING_TEMPLATE_CHECKS, FILING_TEMPLATES_WORDS } from "./checks.mjs";
export { FILING_TEMPLATES_SCHEMA, FILING_TEMPLATES_TABLES } from "./schema.mjs";

/* ---------------------------------------------------------------- the vocabularies (R21) */

/** R21: a version's states (the Terms; K924: an earlier approved version is `updated`, never retired). */
export const TEMPLATE_STATES = Object.freeze(["draft", "in_review", "approved", "updated", "withdrawn"]);
/** R21: a template's uses. */
export const TEMPLATE_USES = Object.freeze(["file", "brief"]);
/** R21: a review's outcomes (R9). */
export const REVIEW_OUTCOMES = Object.freeze(["no_concerns", "concerns", "changes_requested"]);
/** The Terms: where a template comes from (`imported` reserved, never written in this version). */
export const TEMPLATE_ORIGINS = Object.freeze(["group", "profile", "imported"]);

/* ---------------------------------------------------------------- bounds */

export const TEMPLATE_NAME_MAX = 200;      // R1
export const TEMPLATE_NOTES_MAX = 8000;    // R12
export const PROPOSAL_WHY_MAX = 1000;      // R6
export const GRANT_FIELD_MAX = 200;        // R8
export const REVIEW_SCOPE_MAX = 200;       // R9
export const REVIEW_COMMENT_MAX = 4000;    // R9
export const REVIEW_CREDENTIAL_MAX = 200;  // R9
export const APPROVAL_REASON_MAX = 1000;   // R10
export const ENDING_REASON_MAX = 500;      // R11
export const COMMENT_MAX = 4000;           // R13
export const COMMENTS_MAX = 500;           // R13
export const TEMPLATES_FOR_MAX = 200;      // R14
export const REVIEWS_REQUESTED_MAX = 500;  // R20
/** The note a template migrated from `filings` carries (K921, K927). */
export const MIGRATED_NOTE = "kept before templates were reviewed (K921)";
/** R14: what `state` may ask for instead of the offered versions. */
export const TEMPLATES_STATES_LISTED = Object.freeze(["draft", "in_review", "withdrawn", "retired", "proposed"]);

const KIND_RE = /^[a-z][a-z0-9_]*$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const VERSION_RE = /^(.+)@([1-9][0-9]*)$/;
const WELL_FORMED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const json = (v) => JSON.stringify(v ?? null);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const utf8 = (s) => new TextEncoder().encode(s).length;
const oneLine = (v, max) => typeof v === "string" && !!v.trim() && v.trim().length <= max && !/[\n\r]/.test(v) && !WELL_FORMED.test(v);
const textUpTo = (v, max, min = 1) => typeof v === "string" && v.trim().length >= min && v.length <= max && !WELL_FORMED.test(v);
const clamp = (v, dflt, max) => { const n = Math.floor(Number(v)); return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : dflt; };
const listOf = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => String(x ?? "").trim()).filter(Boolean);
const OFFERED = Object.freeze(["approved", "updated"]);

/* DEC-49: a refusal of this module's own carries its code, its row and the member's translation; one another module
   answered passes through as it came. */
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string" || r.check) return r;
  const row = rowOf(r.reason);
  return row ? { ...r, code: r.code ?? r.reason, check: row.check, translation: row.translation } : r;
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, detail, ...(extra || {}) });

/** R8: THE ONE DEAD ANSWER through a grant's door. A secret never issued, one revoked, one whose version left review,
 *  a malformed one, and a live one asked for another version all receive THIS, built from no argument, so its bytes
 *  cannot vary with anything the caller sent or the record holds. Writes nothing and never throws. */
export function noTemplateGrant() {
  const row = FILING_TEMPLATE_CHECKS.NO_TEMPLATE_GRANT;
  /* DEC-49 REGION is-no-template-grant */
  return { ok: false, reason: "NO_TEMPLATE_GRANT", code: "NO_TEMPLATE_GRANT", check: row.check, translation: row.translation,
           detail: localize("filing-templates.index.nothing_answers_to_this_review", "nothing answers to this review link: a link is read only while its grant is open and its version is in draft or in review; any other answers exactly as one that never existed.") };
  /* END DEC-49 REGION is-no-template-grant */
}

/** R30, R32 (K231, K3124: one code, one site): THE ONE ANSWER of C-125.4 `TEMPLATE_BLANK_UNKNOWN`, a provided service.
 *  The refusal with its row, naming the first blank of `text` outside FILING_BLANKS (`blanksOf`, R19), `extra`'s fields
 *  merged; or null when every blank `text` names is in FILING_BLANKS. R2's text check (R3, R4, R6) and R15's profile
 *  read answer through it, and `filings` calls it for a member's own words (its R56). `notOffered` says, in the
 *  detail, that the template is not offered (R15's read). Writes nothing and never throws. */
export function blankUnknownRefusal(text, extra = null, notOffered = false) {
  const { unknown } = blanksOf(text);
  if (!unknown) return null;
  /* DEC-49 REGION is-template-blank */
  return refuse("TEMPLATE_BLANK_UNKNOWN", notOffered === true
    ? localize("filing-templates.index.blank_is_not_a_blank_filings_fill_not_offered", "{{{blank}}} is not a blank filings fill, so this template is not offered", { blank: unknown })
    : localize("filing-templates.index.blank_is_not_a_blank_filings_fill", "{{{blank}}} is not a blank filings fill", { blank: unknown }),
                { ...(extra && typeof extra === "object" ? extra : {}), blank: unknown });
  /* END DEC-49 REGION is-template-blank */
}

/** R33 (T48; N880; Actions D13, H17; v0.2 rule 8): the sentence every request for comment carries, moved here from
 *  `filings` (its `KEYED["rfc.quoting"]`) unchanged. Read by key (T50, N1130; DEC-260) from `words.json`'s
 *  `filing-templates.rfc_quoting_sentence` through setup-words' `word`, the same words (K2953; `filings` R52). */
const RFC_QUOTING_KEY = "filing-templates.rfc_quoting_sentence";
export const RFC_QUOTING_SENTENCE = word(RFC_QUOTING_KEY);
/* R33: the product kind whose file templates must hold it (`action-grammar`'s PRODUCT_KINDS, its R2). */
const RFC_KIND = PRODUCT_KINDS.find((k) => k === "request_for_comment");

/** R33 (K231: one code, one site): THE ONE ANSWER of C-115.47 `RFC_QUOTING_MISSING`, a provided service (`filings` R57
 *  asks it). The refusal with its row, `extra`'s fields merged, when `text` does not hold RFC_QUOTING_SENTENCE; null
 *  when it does. Pure: writes nothing and never throws. */
export function rfcQuotingRefusal(text, extra = null) {
  if (typeof text === "string" && text.includes(RFC_QUOTING_SENTENCE)) return null;
  /* DEC-49 REGION is-rfc-quoting-missing */
  return refuse("RFC_QUOTING_MISSING", localize("filing-templates.index.a_request_for_comment_carries_the_quoting_sentence", "a request for comment carries the sentence that the reply may be quoted unless it says otherwise"),
                { ...(extra && typeof extra === "object" ? extra : {}), sentence: RFC_QUOTING_SENTENCE, key: RFC_QUOTING_KEY });
  /* END DEC-49 REGION is-rfc-quoting-missing */
}

/** R26: a template's handle: its name case-folded, each run of characters other than ASCII letters and digits one `-`,
 *  no `-` at either end ("Records request" → `records-request`); null for a name with no ASCII letter or digit. */
export function templateHandle(name) {
  if (typeof name !== "string") return null;
  const h = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return h || null;
}
/** R26: how `name` names a template: `@` and a handle. */
export const TEMPLATE_NAME_REF_RE = /^@[a-z0-9]+(-[a-z0-9]+)*$/;

/** A version's id, `<template>@<version>` (the Terms). */
export const versionId = (template, version) => `${template}@${version}`;
/** The parts of a version id, or null. */
export function parseVersionId(v) {
  const m = typeof v === "string" ? VERSION_RE.exec(v.trim()) : null;
  return m ? { template: m[1], version: Number(m[2]) } : null;
}

export class FilingTemplates {
  constructor({ storage, record, membership, jurisdictions = null, now = null, env = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.jur = jurisdictions && typeof jurisdictions === "object" ? jurisdictions : jurisdictionsModule;
    this.now = typeof now === "function" ? now : null;
    this.env = env && typeof env === "object" ? env : {};
    this.layerCache = new Map();
  }

  migrate() { migrateFilingTemplates(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #call(fn, dflt = null) { try { return fn(); } catch { return dflt; } }
  #nowMs() {
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env.BIO_NOW_MS);
    return Number.isFinite(v) && v >= 0 ? v : Date.now();
  }
  #when() { return stampInstant("second", this.#nowMs()); }

  /* ================================================================ who acts (R16, R22) */

  /* The member an identity names (membership R76), or null for a machine, the bare founder or nobody. */
  #member(identity) {
    if (!str(identity) || isMachineIdentity(identity)) return null;
    return this.#call(() => this.membership.positionalMember(null, String(identity).trim()));
  }
  /* R16: a member's name at the time of the act, by value: their handle, else their id. */
  #nameOf(memberId) {
    const f = this.#call(() => this.membership.memberFacts(memberId));
    return (f && str(f.handle)) || memberId;
  }
  #who(memberId) { return memberId ? { id: memberId, name: this.#nameOf(memberId) } : null; }

  /* R22: a machine, or a call stamped with nobody, is refused by shape before anything else is asked. `act` is the
     fence's family: drafting (R3, R4, R7, R8), reviewing (R9), or approving and ending (R10, R11). */
  #machine(act, who) {
    if (str(who) && !isMachineIdentity(who)) return null;
    /* DEC-49 REGION is-template-member */
    const code = act === "review" ? "MACHINE_CANNOT_REVIEW_TEMPLATE"
      : act === "approve" ? "MACHINE_CANNOT_APPROVE_TEMPLATE" : "MACHINE_CANNOT_DRAFT_TEMPLATE";
    return refuse(code, str(who)
      ? localize("filing-templates.index.string_is_a_machine_identity", "'{String}' is a machine identity: a machine proposes wording and comments, labeled, and nothing else", { String: String(String(who).trim().slice(0, 60)) })
      : localize("filing-templates.index.no_member_is_named_as_the_one_acting", "no member is named as the one acting: this call carries nobody"));
    /* END DEC-49 REGION is-template-member */
  }

  /* ================================================================ the one-condition answers */

  /* R3, R24, R25: absent and invisible are one answer. */
  #noTemplate(asked) {
    /* DEC-49 REGION is-no-such-template */
    return refuse("NO_SUCH_TEMPLATE", localize("filing-templates.index.no_template_by_that_id_is_readable_here", "no template by that id is readable here; one you may not see answers the same"),
                  { template: str(typeof asked === "string" ? asked : null) });
    /* END DEC-49 REGION is-no-such-template */
  }
  #scope(t, detail) {
    /* DEC-49 REGION is-template-scope */
    return refuse("TEMPLATE_SCOPE_REFUSED", detail, { template: t ? t.id : null });
    /* END DEC-49 REGION is-template-scope */
  }
  #retired(t) {
    /* DEC-49 REGION is-template-retired */
    return refuse("TEMPLATE_RETIRED", localize("filing-templates.index.the_template_was_retired_reason", "the template was retired: {reason}", { reason: String(t.retired.reason) }),
                  { template: t.id, retired: t.retired });
    /* END DEC-49 REGION is-template-retired */
  }
  #notADraft(t, n, state) {
    /* DEC-49 REGION is-not-a-draft */
    return refuse("NOT_A_DRAFT", localize("filing-templates.index.the_version_is_state_past", "the version is {state}, past draft: its text is fixed", { state: String(state) }), { version: versionId(t.id, n), state });
    /* END DEC-49 REGION is-not-a-draft */
  }
  #notInReview(t, n, state) {
    /* DEC-49 REGION is-not-in-review */
    return refuse("NOT_IN_REVIEW", localize("filing-templates.index.the_version_is_state_not", "the version is {state}, not in review", { state: String(state) }), { version: versionId(t.id, n), state });
    /* END DEC-49 REGION is-not-in-review */
  }
  #notAnApprover(t, detail) {
    /* DEC-49 REGION is-not-an-approver */
    return refuse("NOT_AN_APPROVER", detail, { template: t.id });
    /* END DEC-49 REGION is-not-an-approver */
  }
  #fromRefusal(detail) {
    /* DEC-49 REGION is-template-from */
    return refuse("TEMPLATE_FROM_REFUSED", detail);
    /* END DEC-49 REGION is-template-from */
  }

  /* ================================================================ the profiles (R1, R15) */

  #activeIds() {
    let ids = this.#call(() => this.record.getSetting("jurisdiction_profiles"));
    if (typeof ids === "string") ids = parse(ids);
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string" && x) : [];
  }
  #profile(id) { return typeof id === "string" ? this.#call(() => this.jur.get(id)) : null; }
  #kindIn(profile, kind) {
    return profile && Array.isArray(profile.action_kinds) ? profile.action_kinds.find((k) => k && k.kind === kind) || null : null;
  }
  /* The Terms: the tier of a template's kind, the strictest across the profiles it names (for a `general` one,
     across the active view), undetermined when none states one. */
  #tierOf(kind, profiles) {
    /* A general template's profiles are the active ones: the strictest across the view's profiles, which the combined
       view itself would withhold where they disagree (jurisdictions R15) and never read as the lower. */
    const tiers = [];
    for (const p of Array.isArray(profiles) ? profiles : this.#activeIds()) {
      const e = this.#kindIn(this.#profile(p), kind);
      if (e && [1, 2, 3].includes(e.tier)) tiers.push(e.tier);
    }
    return tiers.length ? Math.max(...tiers) : "undetermined";
  }

  /* R15: the profile's templates, every template each active profile's kinds carry (T45: a kind's `templates`,
     `jurisdictions` R81, or its single `template`, read as that set of one), each an approved version of origin
     `profile`, scope `group`, its profiles the profile it is in. R26 (T45): its name is its own (R87 (b)); a single
     `template` written without one is named by its kind's label, as before T45. */
  /* R37 (T53; N1257, K5458): each is read from the layer that holds it (a package's layers each read alone, so two layers'
     templates of one kind are each read), with `layer` the id of the profile it sits in, and that layer's level and place;
     a profile that is no layer is its own `layer`, with no level or place. */
  #profileTemplates() {
    const out = [];
    for (const pid of this.#activeIds()) {
      const ls = this.#layersOf(pid);
      const holders = ls.length ? ls.map((l) => ({ ...l, p: this.#profile(l.layer) })) : [{ layer: pid, level: null, place: null, p: this.#profile(pid) }];
      for (const { layer, level, place, p } of holders) {
        for (const k of p && Array.isArray(p.action_kinds) ? p.action_kinds : []) {
          if (!k) continue;
          const set = Array.isArray(k.templates) ? k.templates : k.template ? [{ ...k.template, purpose: "initial" }] : [];
          for (const t of set) {
            if (!t || typeof t !== "object" || typeof t.text !== "string" || !str(t.id)) continue;
            if (out.some((x) => x.id === t.id)) continue;
            out.push({ id: t.id, origin: "profile", kind: k.kind, use: t.use, profiles: [pid], name: str(t.name) || str(k.label) || k.kind,
                       scope: "group", project: null, bundle_id: null, widened: null, retired: null,
                       created_at: str(t.approved_at) || "", profileTemplate: t, court: !!(k.venue && k.venue.how === "court"),
                       tier: [1, 2, 3].includes(k.tier) ? k.tier : "undetermined", layer, level, place });
          }
        }
      }
    }
    return out;
  }
  /* R36, R37 (T53; `jurisdictions` R99, R114): the layers a profile id stands for, `[{layer, level, place}]`: a layer
     itself; a package its layers, in its order; [] for a profile that is no layer, or one not held. Held data is
     frozen, so each id is read once per instance. */
  #layersOf(id) {
    if (typeof id !== "string") return [];
    if (this.layerCache.has(id)) return this.layerCache.get(id);
    const p = this.#profile(id);
    let out = [];
    if (p && p.layer && typeof p.layer === "object") out = [{ layer: id, level: p.layer.level ?? null, place: p.layer.place ?? null }];
    else if (p) {
      const c = this.#call(() => this.jur.combine([id]));
      const ls = c && c.ok && c.view && Array.isArray(c.view.layers) ? c.view.layers : [];
      out = ls.filter((l) => l && str(l.id)).map((l) => ({ layer: l.id, level: l.level ?? null, place: l.place ?? null }));
    }
    this.layerCache.set(id, out);
    return out;
  }
  /* R36: the layers a group template's `profiles` expand to (a layer id itself, a package id its layers) that are not
     among the active profiles' layers, in order; [] when every one is active, for `general`, for a profile that is no
     layer (judged as before T53) and for a profile template. A template with any is not offered. */
  #layersInactive(t) {
    if (!t || t.origin === "profile" || !Array.isArray(t.profiles)) return [];
    const active = new Set(this.#activeIds().flatMap((id) => this.#layersOf(id).map((l) => l.layer)));
    return [...new Set(t.profiles.flatMap((p) => this.#layersOf(p).map((l) => l.layer)))].filter((id) => !active.has(id));
  }
  /* R28: the first profile, of those a template names (for a `general` one, the active view's), whose venue for the
     kind is filed with a court (`venue.how: court`), or null. */
  #courtIn(kind, profiles) {
    for (const p of Array.isArray(profiles) ? profiles : this.#activeIds()) {
      const e = this.#kindIn(this.#profile(p), kind);
      if (e && e.venue && e.venue.how === "court") return p;
    }
    return null;
  }
  #courtPetition(kind, profile, extra = {}) {
    /* DEC-49 REGION is-court-petition */
    return refuse("TEMPLATE_COURT_PETITION", localize("filing-templates.index.the_kinds_venue_in_the", "the kind's venue in the profile '{String}' is a court: no template the team files in its own name is kept for it until a licensed professional can certify one; a brief template may serve it", { String: String(String(profile).slice(0, 60)) }),
      { kind, profile, ...extra });
    /* END DEC-49 REGION is-court-petition */
  }
  /* R15, R38 (T53; K5528 T4): what a profile template's attribution lacks is `jurisdictions`' one judge, its R126
     `attributionLacks`, called as it stands: this module keeps no judge of its own and maps none of its words. */
  static #lacks(p) {
    const l = jurisdictionsModule.attributionLacks(p);
    return Array.isArray(l) ? l : ["writer", "sources", "professional_review", "second_approval"];
  }
  /* R15, R28: why a profile template is not offered, as a refusal, or null (a group template: null). In order: a blank
     outside FILING_BLANKS (R30, R32's one site), a file template on a court's kind, an attribution that lacks a part. */
  #profileRefusal(t) {
    if (!t || t.origin !== "profile") return null;
    const blank = blankUnknownRefusal(t.profileTemplate.text, { template: t.id }, true);
    if (blank) return blank;
    if (t.use === "file" && t.court) return this.#courtPetition(t.kind, t.profiles[0], { template: t.id });
    const lacks = FilingTemplates.#lacks(t.profileTemplate);
    /* DEC-49 REGION is-profile-offered */
    if (lacks.length)
      return refuse("TEMPLATE_NOT_REVIEWED", localize("filing-templates.index.the_profiles_template_is_not", "the profile's template is not offered: its attribution lacks {lacks}", { lacks: String(lacks.join(", ")) }),
                    { template: t.id, lacks });
    /* END DEC-49 REGION is-profile-offered */
    /* R33: a file template of the request-for-comment kind lacking the quoting sentence is not offered either */
    if (t.use === "file" && t.kind === RFC_KIND) return rfcQuotingRefusal(t.profileTemplate.text, { template: t.id });
    return null;
  }

  /* ================================================================ templates and their sight (R24) */

  #groupTemplate(id) {
    const r = typeof id === "string" ? this.#one(`SELECT * FROM tpl_templates WHERE template_id=?`, id) : null;
    if (!r) return null;
    const ev = (e) => this.#one(`SELECT actor, actor_name, detail, at FROM tpl_events WHERE template_id=? AND version IS NULL
                                  AND event=? ORDER BY eid LIMIT 1`, r.template_id, e);
    const end = (e) => (e ? { by: { id: e.actor, name: e.actor_name }, at: e.at, ...(parse(e.detail) || {}) } : null);
    const w = ev("widened"), x = ev("retired");
    const profiles = r.profiles === "general" ? "general" : parse(r.profiles) || [];
    return { id: r.template_id, origin: r.origin, kind: r.kind, use: r.use, profiles, name: r.name,
             project: r.project, bundle_id: r.bundle_id, scope: w ? "group" : { project: r.project },
             widened: end(w), retired: end(x), created_at: r.created_at,
             created_by: { id: r.created_by, name: r.created_name }, migrated_from: r.migrated_from ?? null };
  }
  /* R24: a project's template is seen by whoever may see its project (membership's one rule); a group or profile
     template by every member (a viewer the rule admits to anything). */
  #canSee(t, viewer) {
    if (!t) return false;
    if (t.origin === "profile" || t.widened) return viewerPredicate(viewer).scope !== "DENY";
    return !!t.bundle_id && this.#call(() => this.membership.inSight(t.bundle_id, viewer)) === true;
  }
  #template(id, viewer) {
    const key = str(id);
    if (!key) return null;
    const t = this.#groupTemplate(key) || this.#profileTemplates().find((p) => p.id === key) || null;
    return t && this.#canSee(t, viewer) ? t : null;
  }

  /* ================================================================ versions (R2, R5, R9, R10, R12) */

  #events(tid) { return this.#rows(`SELECT * FROM tpl_events WHERE template_id=? ORDER BY eid`, tid); }
  #stateOf(events, n) {
    const has = (e) => events.some((x) => x.version === n && x.event === e);
    return has("withdrawn") ? "withdrawn" : has("updated") ? "updated" : has("approved") ? "approved"
      : has("submitted") ? "in_review" : "draft";
  }
  #numbers(tid) { return this.#rows(`SELECT version FROM tpl_versions WHERE template_id=? ORDER BY version`, tid).map((r) => r.version); }
  #latestRevision(tid, n) {
    return this.#one(`SELECT * FROM tpl_revisions WHERE template_id=? AND version=? ORDER BY rid DESC LIMIT 1`, tid, n);
  }
  /* The version of `t` named by a version id or a number (a profile template's own number), or null. */
  #versionOf(t, asked) {
    const p = parseVersionId(asked);
    const n = p ? (p.template === t.id ? p.version : null) : /^[1-9][0-9]*$/.test(String(asked ?? "").trim()) ? Number(String(asked).trim()) : null;
    if (n === null) return null;
    if (t.origin === "profile") return n === Number(t.profileTemplate.version) ? n : null;
    return this.#one(`SELECT 1 AS x FROM tpl_versions WHERE template_id=? AND version=?`, t.id, n) ? n : null;
  }
  /* A version id the viewer may see: its template and number, or null. */
  #resolve(asked, viewer) {
    const p = parseVersionId(asked);
    const t = p ? this.#template(p.template, viewer) : null;
    const n = t ? this.#versionOf(t, asked) : null;
    return t && n !== null ? { t, n } : null;
  }
  /* The latest approved version (R14's default), or null. */
  #latestApproved(t, events) {
    if (t.origin === "profile") return Number(t.profileTemplate.version);
    const ns = this.#numbers(t.id).filter((n) => this.#stateOf(events, n) === "approved");
    return ns.length ? ns[ns.length - 1] : null;
  }
  #openVersion(t, events) {
    return this.#numbers(t.id).find((n) => ["draft", "in_review"].includes(this.#stateOf(events, n))) ?? null;
  }

  /* R5: every member who revised the version and every adopted proposal's run, in time order, each dated; written by
     R3, R4 and R6's adoption alone (it is read from their rows). */
  #contributors(tid, n) {
    const out = [], members = new Set();
    for (const r of this.#rows(`SELECT author, author_name, adopted, at FROM tpl_revisions WHERE template_id=? AND version=?
                                 ORDER BY rid`, tid, n)) {
      if (!members.has(r.author)) { members.add(r.author); out.push({ kind: "member", member: r.author, name: r.author_name, at: r.at }); }
      if (r.adopted && !out.some((c) => c.proposal === r.adopted)) {
        const p = this.#one(`SELECT * FROM tpl_proposals WHERE proposal_id=?`, r.adopted);
        if (p) out.push({ kind: "run", proposal: p.proposal_id, run: p.run ?? null, model: p.model ?? null,
                          skill_pack: p.skill_pack ?? null, label: proposalLabel(p.proposer, "template"), at: r.at });
      }
    }
    return out;
  }
  /* R9: every review of the version, each marked whether it stands (a reviewer's latest of that sha). */
  #reviews(tid, n) {
    const rows = this.#rows(`SELECT * FROM tpl_reviews WHERE template_id=? AND version=? ORDER BY rvid`, tid, n);
    const latest = new Map();
    for (const r of rows) latest.set(`${r.kind}|${r.reviewer}|${r.sha}`, r.rvid);
    return rows.map((r) => ({
      kind: r.kind, outcome: r.outcome, scope: r.scope, comment: r.comment ?? null, sha: r.sha, at: r.at,
      reviewer: r.kind === "professional"
        ? { grant: r.reviewer, name: r.reviewer_name, organisation: r.organisation, credential: r.credential ?? null,
            credential_says: word("filing-templates.credential_says.reviewer_stated_verified") }
        : { id: r.reviewer, name: r.reviewer_name, expertise: parse(r.expertise) || [] },
      stands: latest.get(`${r.kind}|${r.reviewer}|${r.sha}`) === r.rvid }));
  }
  static #summary(reviews, sha) {
    const s = { member: 0, professional: 0, no_concerns: 0, concerns: 0, changes_requested: 0 };
    for (const r of reviews) if (r.stands && (!sha || r.sha === sha)) { s[r.kind] += 1; s[r.outcome] += 1; }
    return s;
  }
  /* R12: a version's notes: the latest edit, every edit with its author and time, and the notes added after draft. */
  #notes(tid, n) {
    const edits = this.#rows(`SELECT text, author, author_name, carried, at FROM tpl_notes WHERE template_id=? AND version=?
                               ORDER BY nid`, tid, n)
      .map((e) => ({ text: e.text, by: e.author ? { id: e.author, name: e.author_name } : null, carried: e.carried === 1, at: e.at }));
    const last = edits[edits.length - 1] || null;
    const added = this.#rows(`SELECT text, author, author_name, at FROM tpl_comments WHERE template_id=? AND version=? AND note=1
                               ORDER BY cid`, tid, n).map((a) => ({ text: a.text, by: { id: a.author, name: a.author_name }, at: a.at }));
    return { text: last ? last.text : "", carried: !!(last && last.carried), edits, added };
  }

  /* R2: one version whole, with its attribution (R5, R9, R10, R12, R16). */
  #versionView(t, n, events) {
    if (t.origin === "profile") return this.#profileVersion(t);
    const v = this.#one(`SELECT * FROM tpl_versions WHERE template_id=? AND version=?`, t.id, n);
    const rev = this.#latestRevision(t.id, n);
    const state = this.#stateOf(events, n);
    const ev = (e) => events.find((x) => x.version === n && x.event === e) || null;
    const by = (e) => ({ id: e.actor, name: e.actor_name });
    const ap = ev("approved"), up = ev("updated"), wd = ev("withdrawn"), sub = ev("submitted");
    const reviews = this.#reviews(t.id, n);
    return {
      id: versionId(t.id, n), template: t.id, version: n, text: rev.text, sha: rev.sha, state,
      notes: this.#notes(t.id, n), author: { id: v.author, name: v.author_name },
      contributors: this.#contributors(t.id, n), derived_from: parse(v.derived_from), reviews,
      reviews_summary: FilingTemplates.#summary(reviews, rev.sha),
      approved: ap ? { by: by(ap), at: ap.at, ...(parse(ap.detail) || {}) } : null,
      updated_by: up ? versionId(t.id, (parse(up.detail) || {}).by) : null,
      ended: wd ? { ending: "withdrawn", by: by(wd), at: wd.at, reason: (parse(wd.detail) || {}).reason ?? null }
        : t.retired ? { ending: "retired", ...t.retired } : null,
      submitted: sub ? { by: by(sub), at: sub.at } : null,
      reviewers: this.#rows(`SELECT member, member_name, asked_by, asked_name, at FROM tpl_reviewers WHERE template_id=? AND version=?
                              ORDER BY member`, t.id, n)
        .map((r) => ({ member: r.member, name: r.member_name, asked_by: { id: r.asked_by, name: r.asked_name }, at: r.at })),
      revisions: this.#rows(`SELECT sha, author, author_name, adopted, at FROM tpl_revisions WHERE template_id=? AND version=?
                              ORDER BY rid`, t.id, n)
        .map((r) => ({ sha: r.sha, by: { id: r.author, name: r.author_name }, ...(r.adopted ? { adopted: r.adopted } : {}), at: r.at })),
      created_at: v.created_at,
    };
  }
  /* R15: a profile template as an approved version, with the attribution the profile carries. */
  #profileVersion(t) {
    const p = t.profileTemplate;
    const reviews = (Array.isArray(p.reviews) ? p.reviews : []).map((r) => ({
      kind: r.kind, outcome: r.outcome, scope: r.scope, comment: null, at: r.at ?? null, stands: true,
      reviewer: { name: r.reviewer, ...(r.organisation ? { organisation: r.organisation } : {}),
                  ...(r.credential ? { credential: r.credential, credential_says: word("filing-templates.credential_says.profile_states_verified") } : {}) } }));
    const n = Number(p.version);
    return {
      id: versionId(t.id, n), template: t.id, version: n, text: p.text, sha: sha256HexSync(p.text), state: "approved",
      notes: { text: typeof p.notes === "string" ? p.notes : "", carried: false, edits: [],
               added: this.#rows(`SELECT text, author, author_name, at FROM tpl_comments WHERE template_id=? AND version=? AND note=1
                                   ORDER BY cid`, t.id, n).map((a) => ({ text: a.text, by: { id: a.author, name: a.author_name }, at: a.at })) },
      author: { name: p.authored_by }, contributors: (Array.isArray(p.contributors) ? p.contributors : []).map((c) => ({ kind: "member", name: c })),
      derived_from: null, reviews, reviews_summary: FilingTemplates.#summary(reviews, null),
      approved: { by: { name: p.approved_by }, at: p.approved_at ?? null, tier: t.tier, profiles: t.profiles, reason: null,
                  basis: p.basis ?? null, profile: t.profiles[0] },
      updated_by: null, ended: null, submitted: null, reviewers: [], revisions: [], created_at: p.approved_at ?? null,
      sources: (Array.isArray(p.sources) ? p.sources : []).filter((x) => x && str(x.citation)).map((x) => ({ citation: x.citation })),
      purpose: str(p.purpose),
    };
  }
  /* R14: a version as a list shows it. */
  #listed(view, isDefault) {
    return { id: view.id, version: view.version, state: view.state, author: view.author, contributors: view.contributors,
             reviews: view.reviews_summary, approved: view.approved ? { by: view.approved.by, at: view.approved.at,
             tier: view.approved.tier, reason: view.approved.reason ?? null } : null,
             created_at: view.created_at, ...(view.updated_by ? { updated_by: view.updated_by } : {}),
             ...(view.ended ? { ended: view.ended } : {}), ...(isDefault ? { default: true } : {}) };
  }
  static #head(t, extra = {}) {
    return { id: t.id, kind: t.kind, use: t.use, profiles: t.profiles, name: t.name, scope: t.scope, origin: t.origin,
             ...(t.origin === "profile" && t.layer ? { layer: t.layer } : {}),
             ...(t.retired ? { retired: t.retired } : {}), ...extra };
  }

  /* ================================================================ the judges (R1, R2, R12) */

  #parseProfiles(v) {
    if (v === "general") return "general";
    const l = listOf(v);
    return l.length === 1 && l[0] === "general" ? "general" : l;
  }
  /* R1: the template's own fields, in R1's order. */
  #shapeRefusal({ kind, use, profiles, name, project }) {
    /* DEC-49 REGION is-template-shape */
    if (typeof kind !== "string" || !KIND_RE.test(kind))
      return refuse("TEMPLATE_KIND_REFUSED", localize("filing-templates.index.a_kind_is_lower_case_letters_digits_and_underscores", "a kind is lower-case letters, digits and underscores, beginning with a letter"),
                    { kind: typeof kind === "string" ? kind.slice(0, 60) : null });
    const listed = Array.isArray(profiles) ? profiles : [];
    for (const p of listed) {
      const held = this.#profile(p);
      if (held && !this.#kindIn(held, kind))
        return refuse("TEMPLATE_KIND_UNKNOWN", localize("filing-templates.index.the_profile_p_holds_no", "the profile '{p}' holds no action kind '{kind}'", { p: String(p), kind: String(kind) }), { kind, profile: p });
    }
    if (!TEMPLATE_USES.includes(use))
      return refuse("TEMPLATE_USE_REFUSED", localize("filing-templates.index.a_templates_use_is_file_or_brief", "a template's use is file or brief"), { use: typeof use === "string" ? use.slice(0, 20) : null });
    if (profiles !== "general") {
      if (!listed.length) return refuse("TEMPLATE_PROFILE_UNKNOWN", localize("filing-templates.index.a_template_names_the_profiles_it_is_written_for", "a template names the profiles it is written for, or general"), { profile: null });
      const missing = listed.find((p) => !this.#profile(p));
      if (missing) return refuse("TEMPLATE_PROFILE_UNKNOWN", localize("filing-templates.index.no_profile_missing_is_held", "no profile '{missing}' is held", { missing: String(missing.slice(0, 60)) }), { profile: missing.slice(0, 60) });
    }
    if (use === "file" && this.#tierOf(kind, profiles) === 3)
      return refuse("TEMPLATE_TIER3_FILE", localize("filing-templates.index.the_kinds_tier_is_3_no_file_template_is_kept", "the kind's tier is 3: no file template is kept for it; a brief template may serve it"), { kind });
    const court = use === "file" ? this.#courtIn(kind, profiles) : null;
    if (court) return this.#courtPetition(kind, court);
    if (!oneLine(name, TEMPLATE_NAME_MAX))
      return refuse("TEMPLATE_NAME_REFUSED", localize("filing-templates.index.a_template_is_named_in", "a template is named in one line of 1 to {TEMPLATE_NAME_MAX} characters", { TEMPLATE_NAME_MAX: String(TEMPLATE_NAME_MAX) }), { max: TEMPLATE_NAME_MAX });
    const taken = this.#rows(`SELECT template_id FROM tpl_templates WHERE project IS ? AND name=?`, project, name.trim())
      .map((r) => this.#groupTemplate(r.template_id)).find((t) => t && !t.retired && !t.widened);
    if (taken) return refuse("TEMPLATE_NAME_TAKEN", localize("filing-templates.index.the_scopes_library_already_holds_a_template_by_this_name", "the scope's library already holds a template by this name"), { name: name.trim() });
    /* END DEC-49 REGION is-template-shape */
    return null;
  }
  /* R2, R12: a text and any notes. */
  #textRefusal(text, notes) {
    /* DEC-49 REGION is-template-text */
    if (typeof text !== "string" || !text.trim() || WELL_FORMED.test(text) || utf8(text) > FILING_TEXT_MAX)
      return refuse("TEMPLATE_TEXT_REFUSED", localize("filing-templates.index.a_templates_words_are_non", "a template's words are non-empty UTF-8 text of at most {FILING_TEXT_MAX} bytes", { FILING_TEXT_MAX: String(FILING_TEXT_MAX) }),
                    { max_bytes: FILING_TEXT_MAX });
    const blank = blankUnknownRefusal(text, { blanks: Object.keys(FILING_BLANKS) });
    if (blank) return blank;
    if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > TEMPLATE_NOTES_MAX || WELL_FORMED.test(notes)))
      return refuse("TEMPLATE_NOTES_REFUSED", localize("filing-templates.index.a_versions_notes_are_text", "a version's notes are text of at most {TEMPLATE_NOTES_MAX} characters", { TEMPLATE_NOTES_MAX: String(TEMPLATE_NOTES_MAX) }), { max: TEMPLATE_NOTES_MAX });
    /* END DEC-49 REGION is-template-text */
    return null;
  }
  #notesRefusal(notes) {
    if (notes === undefined || notes === null) return null;
    return this.#textRefusal("x", notes);
  }

  /* R3, R4, R6: a proposal the viewer may see (one for a named template is seen as its template; one for a kind by every
     member), or null. */
  #proposal(id, viewer) {
    const p = str(id) ? this.#one(`SELECT * FROM tpl_proposals WHERE proposal_id=?`, str(id)) : null;
    if (!p) return null;
    if (p.template_id) return this.#template(p.template_id, viewer) ? p : null;
    return viewerPredicate(viewer).scope !== "DENY" ? p : null;
  }

  /* Opaque ids (R1, R6, R8): never a counter; one already held here, in `filings`' library or by a profile template is
     drawn again. */
  #mint(prefix, year) {
    const filings = this.#call(() => this.#rows(`PRAGMA table_info(filing_templates)`).some((c) => c.name === "template_id"), false);
    const profileIds = new Set(prefix === "TPL" ? this.#profileTemplates().map((t) => t.id) : []);
    return this.record.mintOpaqueId(prefix, year, "", (id) =>
      profileIds.has(id)
      || !!this.#one(`SELECT 1 AS x FROM tpl_templates WHERE template_id=? UNION ALL SELECT 1 FROM tpl_proposals WHERE proposal_id=?
                      UNION ALL SELECT 1 FROM tpl_grants WHERE grant_id=?`, id, id, id)
      || (filings && !!this.#one(`SELECT 1 AS x FROM filing_templates WHERE template_id=?`, id)));
  }

  /* ================================================================ R3: templateDraft */

  /** R3 (`op=templatedraft`): a new template and its first draft, or a new draft version of a named template. `from`
   *  is a version id, a proposal id, or, only through `filings`' own service (its R32), `{filing, sha}`; `via: "op"`
   *  marks a call that came through the op, where `{filing, sha}` is refused. */
  templateDraft({ template = null, project = null, kind = null, use = null, profiles = null, name = null, text = undefined,
                  from = null, notes = null, author = null, viewer = null, via = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    let t = null;
    if (template !== null && template !== undefined && template !== "") {
      t = this.#template(template, viewer);
      if (!t) return this.#noTemplate(template);
    }
    const member = this.#member(author);
    const scopeProject = t ? t.project : str(project);
    /* DEC-49 REGION is-template-draft */
    if (!scopeProject || !member || !this.#call(() => this.membership.isJoinedParticipant(scopeProject, member)))
      return this.#scope(t, t && t.origin === "profile" ? localize("filing-templates.index.a_profiles_template_is_read_only_here_draft_from_it", "a profile's template is read-only here: draft the team's own from it (from=)")
        : localize("filing-templates.index.a_template_is_drafted_by_a_joined_participant", "a template is drafted by a joined participant of its project"));
    let events = [];
    if (t) {
      events = this.#events(t.id);
      const open = this.#openVersion(t, events);
      if (open !== null)
        return refuse("TEMPLATE_DRAFT_OPEN", localize("filing-templates.index.version_open_is_stateof_finish", "version {open} is {stateOf}: finish or withdraw it first", { open: String(open), stateOf: String(this.#stateOf(events, open)) }),
                      { version: versionId(t.id, open), state: this.#stateOf(events, open) });
      if (t.retired) return this.#retired(t);
    }
    /* END DEC-49 REGION is-template-draft */
    const prof = t ? t.profiles : this.#parseProfiles(profiles);
    if (!t) {
      const shape = this.#shapeRefusal({ kind, use, profiles: prof, name, project: scopeProject });
      if (shape) return shape;
    }
    /* `from`, read before the text so an absent text takes its source's; judged after the text (R3's order). */
    let source = null, fromBad = null;
    if (from !== null && from !== undefined && from !== "") {
      if (typeof from === "object" && !Array.isArray(from)) {
        if (via === "op") fromBad = localize("filing-templates.index.a_filings_text_becomes_a_template_only_through_filings", "a filing's text becomes a template only through filings' own act (op=templatesave)");
        else if (!str(from.filing) || typeof from.sha !== "string" || !SHA_RE.test(from.sha))
          fromBad = localize("filing-templates.index.a_filing_source_is_the_approved_drafts_id_and_sha", "a filing source is {filing, sha}: the approved draft's id and its text's SHA-256");
        else source = { derived: { filing: str(from.filing), sha: from.sha }, text: undefined };
      } else if (typeof from === "string" && parseVersionId(from)) {
        const r = this.#resolve(from, viewer);
        if (!r) fromBad = localize("filing-templates.index.no_version_from_is_readable_here", "no version '{from}' is readable here", { from: from.slice(0, 80) });
        else source = { derived: { version: versionId(r.t.id, r.n) }, text: this.#versionView(r.t, r.n, this.#events(r.t.id)).text };
      } else if (typeof from === "string") {
        const p = this.#proposal(from, viewer);
        if (!p) fromBad = localize("filing-templates.index.no_proposal_from_is_readable_here", "no proposal '{from}' is readable here", { from: from.slice(0, 80) });
        else source = { derived: { proposal: p.proposal_id }, text: p.text, proposal: p.proposal_id };
      } else fromBad = localize("filing-templates.index.from_names_a_version_a_proposal_or_an_approved_filing_draft", "from names a version, a proposal, or (through filings) an approved filing draft");
    }
    const body = text === undefined || text === null ? (source ? source.text : text) : text;
    const bad = this.#textRefusal(body, notes);
    if (bad) return bad;
    if (fromBad) return this.#fromRefusal(fromBad);
    const at = this.#when();
    const name_ = this.#nameOf(member);
    return this.record.transact(() => {
      let tid = t ? t.id : null;
      if (!t) {
        tid = this.#mint("TPL", at.slice(0, 4));
        if (!tid) return mintExhausted("TPL");
        this.sql.exec(`INSERT INTO tpl_templates (template_id, bundle_id, project, kind, use, profiles, name, origin, created_by,
                         created_name, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          tid, scopeProject, scopeProject, kind, use, prof === "general" ? "general" : json(prof), name.trim(), "group", member, name_, at);
      }
      const bundle = t ? t.bundle_id : scopeProject;
      const prev = t ? Math.max(0, ...this.#numbers(tid)) : 0;
      const n = prev + 1;
      this.sql.exec(`INSERT INTO tpl_versions (template_id, version, bundle_id, author, author_name, derived_from, created_at)
                     VALUES (?,?,?,?,?,?,?)`, tid, n, bundle, member, name_, source ? json(source.derived) : null, at);
      const sha = sha256HexSync(body);
      this.sql.exec(`INSERT INTO tpl_revisions (template_id, version, bundle_id, text, sha, author, author_name, adopted, at)
                     VALUES (?,?,?,?,?,?,?,?,?)`, tid, n, bundle, body, sha, member, name_, source && source.proposal ? source.proposal : null, at);
      /* R12: a new version starts with its predecessor's notes, marked as carried; then any edit of the author's. */
      if (prev) {
        const was = this.#one(`SELECT text, author, author_name FROM tpl_notes WHERE template_id=? AND version=? ORDER BY nid DESC LIMIT 1`, tid, prev);
        if (was) this.sql.exec(`INSERT INTO tpl_notes (template_id, version, bundle_id, text, author, author_name, carried, at)
                                VALUES (?,?,?,?,?,?,1,?)`, tid, n, bundle, was.text, was.author, was.author_name, at);
      }
      if (typeof notes === "string")
        this.sql.exec(`INSERT INTO tpl_notes (template_id, version, bundle_id, text, author, author_name, carried, at)
                       VALUES (?,?,?,?,?,?,0,?)`, tid, n, bundle, notes, member, name_, at);
      return { ok: true, template: tid, version: versionId(tid, n), sha, state: "draft",
               ...(source ? { derived_from: source.derived } : {}),
               says: word("filing-templates.says.draft_offered_filing") };
    });
  }

  /* ================================================================ R4: templateRevise */

  /** R4 (`op=templaterevise`): a new revision of a draft's text (or a proposal's, `adopt`), every earlier one kept; and
   *  any edit of its notes (R12). */
  templateRevise({ version = null, text = undefined, adopt = null, notes = null, author = null, viewer = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noTemplate(parseVersionId(version)?.template ?? version);
    const { t, n } = r;
    const member = this.#member(author);
    if (!t.project || !member || !this.#call(() => this.membership.isJoinedParticipant(t.project, member)))
      return this.#scope(t, t.origin === "profile" ? localize("filing-templates.index.a_profiles_template_is_read_only_here", "a profile's template is read-only here") : localize("filing-templates.index.a_draft_is_revised_by_a_joined_participant", "a draft is revised by a joined participant of its project"));
    const state = this.#stateOf(this.#events(t.id), n);
    /* DEC-49 REGION is-template-revise */
    if (state !== "draft") return this.#notADraft(t, n, state);
    /* END DEC-49 REGION is-template-revise */
    const p = adopt !== null && adopt !== undefined && adopt !== "" ? this.#proposal(adopt, viewer) : null;
    const adopting = adopt !== null && adopt !== undefined && adopt !== "";
    const body = text !== undefined && text !== null ? text : p ? p.text : undefined;
    const notesOnly = body === undefined && !adopting && typeof notes === "string";
    if (!notesOnly) { const bad = this.#textRefusal(body, notes); if (bad) return bad; }
    else { const bad = this.#notesRefusal(notes); if (bad) return bad; }
    if (adopting && !p) return this.#fromRefusal(localize("filing-templates.index.no_proposal_from_is_readable_here", "no proposal '{from}' is readable here", { from: String(adopt).slice(0, 80) }));
    const at = this.#when();
    const name_ = this.#nameOf(member);
    return this.record.transact(() => {
      let sha = this.#latestRevision(t.id, n).sha;
      if (!notesOnly) {
        sha = sha256HexSync(body);
        this.sql.exec(`INSERT INTO tpl_revisions (template_id, version, bundle_id, text, sha, author, author_name, adopted, at)
                       VALUES (?,?,?,?,?,?,?,?,?)`, t.id, n, t.bundle_id, body, sha, member, name_, p ? p.proposal_id : null, at);
      }
      if (typeof notes === "string")
        this.sql.exec(`INSERT INTO tpl_notes (template_id, version, bundle_id, text, author, author_name, carried, at)
                       VALUES (?,?,?,?,?,?,0,?)`, t.id, n, t.bundle_id, notes, member, name_, at);
      return { ok: true, version: versionId(t.id, n), sha, state: "draft", ...(p ? { adopted: p.proposal_id } : {}),
               revisions: this.#one(`SELECT COUNT(*) AS c FROM tpl_revisions WHERE template_id=? AND version=?`, t.id, n).c };
    });
  }

  /* ================================================================ R6: templatePropose */

  /** R6 (`op=templatepropose`): any credential proposes wording, for a named template or for a kind, stored apart and
   *  labelled; it is a template's text only when a member takes it as `from` or `adopt`s it. `run`, `model` and
   *  `skill_pack` are the run's own statement of itself (R5 lists them as stated). */
  templatePropose({ template = null, kind = null, text = undefined, why = null, proposer = null, viewer = null,
                    run = null, model = null, skill_pack = null } = {}) {
    const who = str(proposer);
    /* DEC-49 REGION is-template-propose */
    if (!who) return refuse("TEMPLATE_NO_PROPOSER", localize("filing-templates.index.no_stamped_proposer_a_proposal_names_who_made_it", "no stamped proposer: a proposal names who made it"));
    let t = null;
    if (template !== null && template !== undefined && template !== "") {
      t = this.#template(template, viewer);
      if (!t) return this.#noTemplate(template);
    } else if (typeof kind !== "string" || !KIND_RE.test(kind)) {
      const r = this.#shapeRefusal({ kind: typeof kind === "string" ? kind : "" });
      if (r) return r;
    }
    const bad = this.#textRefusal(text);
    if (bad) return bad;
    if (!textUpTo(why, PROPOSAL_WHY_MAX))
      return refuse("TEMPLATE_WHY_REFUSED", localize("filing-templates.index.say_why_in_1_to", "say why in 1 to {PROPOSAL_WHY_MAX} characters", { PROPOSAL_WHY_MAX: String(PROPOSAL_WHY_MAX) }), { max: PROPOSAL_WHY_MAX });
    /* END DEC-49 REGION is-template-propose */
    const at = this.#when();
    const cut = (v) => (str(v) ? String(v).trim().slice(0, 200) : null);
    return this.record.transact(() => {
      const id = this.#mint("TPP", at.slice(0, 4));
      if (!id) return mintExhausted("TPP");
      const sha = sha256HexSync(text);
      const k = t ? t.kind : kind;
      this.sql.exec(`INSERT INTO tpl_proposals (proposal_id, bundle_id, template_id, kind, text, sha, why, proposer, run, model,
                       skill_pack, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, t ? t.bundle_id : null, t ? t.id : null, k, text, sha, why.trim(), who, cut(run), cut(model), cut(skill_pack), at);
      return { ok: true, proposal: { id, template: t ? t.id : null, kind: k, sha, why: why.trim(), at,
                                     label: proposalLabel(who, "template") },
               evidence: false, says: word("filing-templates.says.proposed_wording_stored") };
    });
  }

  /* ================================================================ R7: templateSubmit */

  /* R8: a grant is live while it is not revoked and its version is a draft or in review. */
  #liveGrants(tid, n, events) {
    if (!["draft", "in_review"].includes(this.#stateOf(events, n))) return [];
    return this.#rows(`SELECT g.* FROM tpl_grants g WHERE g.template_id=? AND g.version=?
                         AND NOT EXISTS (SELECT 1 FROM tpl_grant_revocations r WHERE r.grant_id=g.grant_id) ORDER BY g.grant_id`, tid, n);
  }

  /** R7 (`op=templatesubmit`): a draft goes to review, its text and sha fixed, with the members asked to review it. */
  templateSubmit({ version = null, reviewers = null, author = null, viewer = null } = {}) {
    const machine = this.#machine("draft", author);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noTemplate(parseVersionId(version)?.template ?? version);
    const { t, n } = r;
    const member = this.#member(author);
    if (!t.project || !member || !this.#call(() => this.membership.isJoinedParticipant(t.project, member)))
      return this.#scope(t, t.origin === "profile" ? localize("filing-templates.index.a_profiles_template_is_read_only_here", "a profile's template is read-only here") : localize("filing-templates.index.a_draft_is_submitted_by_a_joined_participant", "a draft is submitted by a joined participant of its project"));
    const events = this.#events(t.id);
    const state = this.#stateOf(events, n);
    if (state !== "draft") return this.#notADraft(t, n, state);
    const asked = [...new Set(listOf(reviewers).map((x) => (x.includes(":") ? x : `member:${x}`)))];
    const ids = [];
    /* DEC-49 REGION is-template-submit */
    for (const a of asked) {
      const id = this.#member(a);
      const facts = id ? this.#call(() => this.membership.memberFacts(id)) : null;
      const standing = id && ((facts && facts.status === "active") || this.#call(() => this.membership.isAdministrator(id)) === true);
      if (!standing || !this.#canSee(t, `member:${id}`))
        return refuse("REVIEWER_UNKNOWN", localize("filing-templates.index.a_is_not_a_member", "'{a}' is not a member who can read the template", { a: String(a.slice(0, 80)) }), { reviewer: a.slice(0, 80) });
      ids.push(id);
    }
    if (!ids.length && !this.#liveGrants(t.id, n, events).length)
      return refuse("NO_REVIEWERS", localize("filing-templates.index.name_a_member_to_review_it_or_open_a_review_grant", "name a member to review it, or open a review grant on the version first"));
    /* END DEC-49 REGION is-template-submit */
    const at = this.#when();
    const sha = this.#latestRevision(t.id, n).sha;
    const name_ = this.#nameOf(member);
    return this.record.transact(() => {
      this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                     VALUES (?,?,?,?,?,?,?,?)`, t.id, n, t.bundle_id, "submitted", member, name_, json({ sha, reviewers: ids }), at);
      for (const id of ids)
        this.sql.exec(`INSERT INTO tpl_reviewers (template_id, version, member, bundle_id, member_name, asked_by, asked_name, at)
                       VALUES (?,?,?,?,?,?,?,?)`, t.id, n, id, t.bundle_id, this.#nameOf(id), member, name_, at);
      return { ok: true, version: versionId(t.id, n), state: "in_review", sha,
               reviewers: ids.map((id) => ({ member: id, name: this.#nameOf(id) })),
               grants: this.#liveGrants(t.id, n, this.#events(t.id)).map((g) => g.grant_id) };
    });
  }

  /* ================================================================ R8: review grants */

  /** R8 (`op=templatereviewgrant`): a participant of the template's project opens a revocable door to one draft or
   *  in-review version for a named non-member, by a secret whose SHA-256 the control plane took. */
  templateReviewGrant({ version = null, recipient = null, organisation = null, secretSha = null, by = null, viewer = null } = {}) {
    const machine = this.#machine("draft", by);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noTemplate(parseVersionId(version)?.template ?? version);
    const { t, n } = r;
    const member = this.#member(by);
    if (!t.project || !member || !this.#call(() => this.membership.isJoinedParticipant(t.project, member)))
      return this.#scope(t, t.origin === "profile" ? localize("filing-templates.index.a_profiles_template_is_read_only_here", "a profile's template is read-only here") : localize("filing-templates.index.a_review_grant_is_opened_by_a_joined_participant", "a review grant is opened by a joined participant of the template's project"));
    const state = this.#stateOf(this.#events(t.id), n);
    if (!["draft", "in_review"].includes(state)) return this.#notInReview(t, n, state);
    /* DEC-49 REGION is-template-grant */
    if (!oneLine(recipient, GRANT_FIELD_MAX) || !oneLine(organisation, GRANT_FIELD_MAX))
      return refuse("GRANT_RECIPIENT_REFUSED", localize("filing-templates.index.the_reviewer_and_their_organisation", "the reviewer and their organisation, each one line of 1 to {GRANT_FIELD_MAX} characters", { GRANT_FIELD_MAX: String(GRANT_FIELD_MAX) }),
                    { max: GRANT_FIELD_MAX });
    const s = typeof secretSha === "string" ? secretSha.trim() : "";
    if (!SHA_RE.test(s) || this.#one(`SELECT 1 AS x FROM tpl_grants WHERE secret_sha=?`, s))
      return refuse("GRANT_NO_SECRET", localize("filing-templates.index.no_fresh_secret_digest_was_stamped_for_this_grant", "no fresh secret digest was stamped for this grant: your team's Civicsmith makes the secret"));
    /* END DEC-49 REGION is-template-grant */
    const at = this.#when();
    return this.record.transact(() => {
      const id = this.#mint("TRG", at.slice(0, 4));
      if (!id) return mintExhausted("TRG");
      const name_ = this.#nameOf(member);
      this.sql.exec(`INSERT INTO tpl_grants (grant_id, template_id, version, bundle_id, recipient, organisation, secret_sha, actor,
                       actor_name, at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id, t.id, n, t.bundle_id, recipient.trim(), organisation.trim(), s, member, name_, at);
      return { ok: true, grant: id, version: versionId(t.id, n), recipient: recipient.trim(), organisation: organisation.trim(),
               by: { id: member, name: name_ }, at,
               says: word("filing-templates.says.reviewer_reads_comments") };
    });
  }

  /** R8 (`op=templategrantrevoke`): a grant's revocation, recorded with the revoker and instant; a second answers the
   *  first, unchanged. */
  templateGrantRevoke({ grant = null, by = null, viewer = null } = {}) {
    const machine = this.#machine("draft", by);
    if (machine) return machine;
    const g = str(grant) ? this.#one(`SELECT * FROM tpl_grants WHERE grant_id=?`, str(grant)) : null;
    const t = g ? this.#template(g.template_id, viewer) : null;
    /* DEC-49 REGION is-template-grant-revoke */
    if (!t) return refuse("NO_SUCH_GRANT", localize("filing-templates.index.no_review_grant_by_that_id_is_readable_here", "no review grant by that id is readable here"), { grant: str(grant) });
    /* END DEC-49 REGION is-template-grant-revoke */
    const member = this.#member(by);
    if (!member || !this.#call(() => this.membership.isJoinedParticipant(t.project, member)))
      return this.#scope(t, localize("filing-templates.index.a_review_grant_is_revoked_by_a_joined_participant", "a review grant is revoked by a joined participant of the template's project"));
    const held = this.#one(`SELECT actor, actor_name, at FROM tpl_grant_revocations WHERE grant_id=?`, g.grant_id);
    if (held) return { ok: true, grant: g.grant_id, existed: true, revoked: { by: { id: held.actor, name: held.actor_name }, at: held.at } };
    const at = this.#when();
    const name_ = this.#nameOf(member);
    this.sql.exec(`INSERT INTO tpl_grant_revocations (grant_id, bundle_id, actor, actor_name, at) VALUES (?,?,?,?,?)`,
                  g.grant_id, g.bundle_id, member, name_, at);
    return { ok: true, grant: g.grant_id, existed: false, revoked: { by: { id: member, name: name_ }, at } };
  }

  /* R8: the door: a live grant for `secretSha`, as {grant, t, n}, or null (the dead answer). */
  #door(secretSha) {
    const s = typeof secretSha === "string" ? secretSha.trim() : "";
    if (!SHA_RE.test(s)) return null;
    const g = this.#one(`SELECT * FROM tpl_grants WHERE secret_sha=?
                           AND NOT EXISTS (SELECT 1 FROM tpl_grant_revocations r WHERE r.grant_id=tpl_grants.grant_id)`, s);
    const t = g ? this.#groupTemplate(g.template_id) : null;
    if (!t || !["draft", "in_review"].includes(this.#stateOf(this.#events(t.id), g.version))) return null;
    return { grant: g, t, n: g.version };
  }
  /* Through a door, a version asked must be the grant's own; absent, it is. */
  static #doorAdmits(d, asked) {
    if (asked === null || asked === undefined || asked === "") return true;
    const p = parseVersionId(asked);
    return p ? p.template === d.t.id && p.version === d.n : String(asked).trim() === String(d.n);
  }
  static #hasSecret(s) { return s !== null && s !== undefined && s !== ""; }

  /* ================================================================ R9: templateReview */

  /** R9 (`op=templatereview`): one review against the version's present sha, by a member who may see the template or
   *  through a live grant. */
  templateReview({ version = null, outcome = null, scope = null, comment = null, credential = null, sha = null,
                   author = null, secretSha = null, viewer = null } = {}) {
    let t, n, reviewer;
    if (FilingTemplates.#hasSecret(secretSha)) {
      const d = this.#door(secretSha);
      if (!d || !FilingTemplates.#doorAdmits(d, version)) return noTemplateGrant();
      ({ t, n } = d);
      reviewer = { kind: "professional", id: d.grant.grant_id, name: d.grant.recipient, organisation: d.grant.organisation };
    } else {
      const machine = this.#machine("review", author);
      if (machine) return machine;
      const r = this.#resolve(version, viewer);
      const member = this.#member(author);
      if (!r || !member) return this.#noTemplate(parseVersionId(version)?.template ?? version);
      ({ t, n } = r);
      const ex = this.#call(() => this.membership.expertiseList({ memberId: member }));
      reviewer = { kind: "member", id: member, name: this.#nameOf(member),
                   expertise: ex && Array.isArray(ex.expertise) ? ex.expertise.filter((e) => e.state !== "withdrawn")
                     .map((e) => ({ label: e.label, confirmed: e.confirmed === true })) : [] };
    }
    const state = t.origin === "profile" ? "approved" : this.#stateOf(this.#events(t.id), n);
    if (state !== "in_review") return this.#notInReview(t, n, state);
    const present = this.#latestRevision(t.id, n).sha;
    /* DEC-49 REGION is-template-review */
    if (!REVIEW_OUTCOMES.includes(outcome) || !oneLine(scope, REVIEW_SCOPE_MAX)
        || (comment !== null && comment !== undefined && !textUpTo(comment, REVIEW_COMMENT_MAX, 0))
        || (reviewer.kind === "professional" && credential !== null && credential !== undefined && !oneLine(credential, REVIEW_CREDENTIAL_MAX)))
      return refuse("REVIEW_REFUSED", localize("filing-templates.index.outcome_is_one_of_review", "outcome is one of {REVIEW_OUTCOMES}; scope 1 to {REVIEW_SCOPE_MAX} characters; comment at most {REVIEW_COMMENT_MAX}; credential at most {REVIEW_CREDENTIAL_MAX}", { REVIEW_OUTCOMES: String(REVIEW_OUTCOMES.join(", ")), REVIEW_SCOPE_MAX: String(REVIEW_SCOPE_MAX), REVIEW_COMMENT_MAX: String(REVIEW_COMMENT_MAX), REVIEW_CREDENTIAL_MAX: String(REVIEW_CREDENTIAL_MAX) }), { outcomes: REVIEW_OUTCOMES });
    if (sha !== null && sha !== undefined && sha !== "" && sha !== present)
      return refuse("REVIEW_STALE", localize("filing-templates.index.the_text_reviewed_is_not_the_versions_present_text", "the text reviewed is not the version's present text"), { sha: present });
    /* END DEC-49 REGION is-template-review */
    const at = this.#when();
    const cred = reviewer.kind === "professional" && str(credential) ? credential.trim() : null;
    this.sql.exec(`INSERT INTO tpl_reviews (template_id, version, bundle_id, sha, kind, reviewer, reviewer_name, organisation,
                     credential, expertise, outcome, scope, comment, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      t.id, n, t.bundle_id, present, reviewer.kind, reviewer.id, reviewer.name, reviewer.organisation ?? null, cred,
      reviewer.kind === "member" ? json(reviewer.expertise) : null, outcome, scope.trim(), str(comment) ? comment : null, at);
    return { ok: true, version: versionId(t.id, n), review: {
      kind: reviewer.kind, outcome, scope: scope.trim(), sha: present, at,
      reviewer: reviewer.kind === "professional"
        ? { grant: reviewer.id, name: reviewer.name, organisation: reviewer.organisation, credential: cred, credential_says: word("filing-templates.credential_says.stated_verified") }
        : { id: reviewer.id, name: reviewer.name, expertise: reviewer.expertise } } };
  }

  /* ================================================================ R10: templateApprove */

  /** R10 (`op=templateapprove`): an owner of the template's project approves an in-review version after the reviews its
   *  tier requires, the earlier approved version then `updated`; with `widen`, an administrator makes an approved
   *  project template group-wide. */
  templateApprove({ version = null, widen = false, reason = null, by = null, viewer = null } = {}) {
    const machine = this.#machine("approve", by);
    if (machine) return machine;
    const r = this.#resolve(version, viewer);
    if (!r) return this.#noTemplate(parseVersionId(version)?.template ?? version);
    const { t, n } = r;
    const member = this.#member(by);
    const events = t.origin === "profile" ? [] : this.#events(t.id);
    const state = t.origin === "profile" ? "approved" : this.#stateOf(events, n);
    const widening = widen === true || widen === "true" || widen === "1" || widen === 1;
    const name_ = member ? this.#nameOf(member) : null;
    /* DEC-49 REGION is-template-approve */
    if (widening) {
      if (t.origin === "profile") return this.#notAnApprover(t, localize("filing-templates.index.a_profiles_template_is_already_offered_to_the_whole_team", "a profile's template is already offered to the whole team"));
      if (!OFFERED.includes(state) || t.retired)
        return refuse("TEMPLATE_NOT_APPROVED", localize("filing-templates.index.the_version_is_v1_only", "the version is {v1}: only an approved project template is widened", { v1: String(t.retired ? localize("filing-templates.index.of_a_retired_template", "of a retired template") : state) }),
                      { version: versionId(t.id, n), state });
      if (!member || this.#call(() => this.membership.isAdministrator(member)) !== true)
        return this.#notAnApprover(t, localize("filing-templates.index.an_administrator_makes_a_template_team_wide", "an administrator makes a template team-wide"));
      if (t.widened) return { ok: true, template: t.id, existed: true, widened: t.widened, scope: "group" };
      const at = this.#when();
      this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                     VALUES (?,NULL,?,?,?,?,?,?)`, t.id, t.bundle_id, "widened", member, name_, json({ from: { project: t.project } }), at);
      return { ok: true, template: t.id, existed: false, scope: "group", widened: { by: { id: member, name: name_ }, at } };
    }
    if (state !== "in_review") return this.#notInReview(t, n, state);
    if (!member || this.#call(() => this.membership.isProjectOwner(t.project, member)) !== true)
      return this.#notAnApprover(t, localize("filing-templates.index.an_owner_of_the_templates_project_approves_it", "an owner of the template's project approves it"));
    const v = this.#one(`SELECT author FROM tpl_versions WHERE template_id=? AND version=?`, t.id, n);
    const others = this.#contributors(t.id, n).filter((c) => c.kind === "member" && c.member !== v.author);
    if (v.author === member && !others.length)
      return refuse("APPROVER_IS_AUTHOR", localize("filing-templates.index.you_are_the_versions_author_and_its_only_member_contributor", "you are the version's author and its only member contributor: another member approves it"),
                    { version: versionId(t.id, n) });
    const sha = this.#latestRevision(t.id, n).sha;
    const standing = this.#reviews(t.id, n).filter((x) => x.stands && x.sha === sha);
    const tier = this.#tierOf(t.kind, t.profiles);
    const why = textUpTo(reason, APPROVAL_REASON_MAX) ? reason.trim() : null;
    const needs = tier === 1 ? "member" : "professional";
    const blocking = standing.filter((x) => x.outcome === "changes_requested");
    const met = standing.some((x) => x.kind === needs && x.outcome === "no_concerns") || (needs === "professional" && !!why);
    if (blocking.length || !met)
      return refuse("REVIEWS_INSUFFICIENT", blocking.length ? localize("filing-templates.index.a_review_requesting_changes_stands", "a review requesting changes stands")
        : tier === 1 ? localize("filing-templates.index.a_tier_1_kind_needs_one_members_review", "a Tier 1 kind needs one member's review with no concerns")
        : localize("filing-templates.index.v1_needs_a_professionals_review", "{v1} needs a professional's review with no concerns, or the approver's reason for going without one (1 to {APPROVAL_REASON_MAX} characters)", { v1: String(tier === "undetermined" ? localize("filing-templates.index.an_undetermined_tier", "an undetermined tier") : localize("filing-templates.index.tier_number", "Tier {tier}", { tier: String(tier) })), APPROVAL_REASON_MAX: String(APPROVAL_REASON_MAX) }),
        { version: versionId(t.id, n), tier, needs, reviews: FilingTemplates.#summary(standing, sha) });
    /* END DEC-49 REGION is-template-approve */
    /* R33: after the reviews, a file version of the request-for-comment kind must hold the quoting sentence */
    const quoting = t.use === "file" && t.kind === RFC_KIND ? rfcQuotingRefusal(this.#latestRevision(t.id, n).text, { version: versionId(t.id, n) }) : null;
    if (quoting) return quoting;
    const at = this.#when();
    const prev = this.#latestApproved(t, events);
    return this.record.transact(() => {
      const detail = { tier, tier_words: RISK_TIERS[tier] ?? null, profiles: t.profiles, reason: why, sha };
      this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                     VALUES (?,?,?,?,?,?,?,?)`, t.id, n, t.bundle_id, "approved", member, name_, json(detail), at);
      if (prev !== null && prev !== n)
        this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                       VALUES (?,?,?,?,?,?,?,?)`, t.id, prev, t.bundle_id, "updated", member, name_, json({ by: n }), at);
      return { ok: true, version: versionId(t.id, n), state: "approved",
               approved: { by: { id: member, name: name_ }, at, ...detail },
               updated: prev !== null && prev !== n ? versionId(t.id, prev) : null,
               says: word("filing-templates.says.approved_offered_filing") };
    });
  }

  /* ================================================================ R11: templateRetire */

  /** R11 (`op=templateretire`): without `version`, an approver of its scope retires the whole template; with it, its
   *  author withdraws a draft or in-review version. Nothing is deleted. */
  templateRetire({ template = null, version = null, reason = null, by = null, viewer = null } = {}) {
    const machine = this.#machine("approve", by);
    if (machine) return machine;
    const named = template ?? parseVersionId(version)?.template ?? null;
    const t = this.#template(named, viewer);
    if (!t) return this.#noTemplate(named);
    const member = this.#member(by);
    const why = textUpTo(reason, ENDING_REASON_MAX);
    if (version === null || version === undefined || version === "") {
      const approver = t.origin !== "profile" && !!member && (t.widened
        ? this.#call(() => this.membership.isAdministrator(member)) === true
        : this.#call(() => this.membership.isProjectOwner(t.project, member)) === true);
      if (!approver) return this.#notAnApprover(t, t.origin === "profile" ? localize("filing-templates.index.a_profiles_template_is_read_only_here", "a profile's template is read-only here")
        : t.widened ? localize("filing-templates.index.an_administrator_retires_a_team_wide_template", "an administrator retires a team-wide template") : localize("filing-templates.index.an_owner_of_the_templates_project_retires_it", "an owner of the template's project retires it"));
      /* DEC-49 REGION is-template-retire */
      if (!why) return refuse("TEMPLATE_REASON_REFUSED", localize("filing-templates.index.give_the_reason_in_1", "give the reason in 1 to {ENDING_REASON_MAX} characters", { ENDING_REASON_MAX: String(ENDING_REASON_MAX) }), { max: ENDING_REASON_MAX });
      if (t.retired) return refuse("TEMPLATE_ALREADY_ENDED", localize("filing-templates.index.the_template_was_already_retired", "the template was already retired"), { template: t.id, ended: { ending: "retired", ...t.retired } });
      /* END DEC-49 REGION is-template-retire */
      const at = this.#when();
      const name_ = this.#nameOf(member);
      this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                     VALUES (?,NULL,?,?,?,?,?,?)`, t.id, t.bundle_id, "retired", member, name_, json({ reason: reason.trim() }), at);
      return { ok: true, template: t.id, retired: { by: { id: member, name: name_ }, at, reason: reason.trim() },
               says: word("filing-templates.says.retired_versions_offered") };
    }
    const n = this.#versionOf(t, version);
    if (n === null) return this.#noTemplate(named);
    const events = t.origin === "profile" ? [] : this.#events(t.id);
    const v = t.origin === "profile" ? null : this.#one(`SELECT author FROM tpl_versions WHERE template_id=? AND version=?`, t.id, n);
    if (!v || !member || v.author !== member) return this.#scope(t, localize("filing-templates.index.a_version_is_withdrawn_by_its_author", "a version is withdrawn by its author"));
    const state = this.#stateOf(events, n);
    if (OFFERED.includes(state)) return this.#notADraft(t, n, state);
    /* DEC-49 REGION is-template-retire */
    if (!why) return refuse("TEMPLATE_REASON_REFUSED", localize("filing-templates.index.give_the_reason_in_1_2", "give the reason in 1 to {ENDING_REASON_MAX} characters", { ENDING_REASON_MAX: String(ENDING_REASON_MAX) }), { max: ENDING_REASON_MAX });
    if (state === "withdrawn") {
      const e = events.find((x) => x.version === n && x.event === "withdrawn");
      return refuse("TEMPLATE_ALREADY_ENDED", localize("filing-templates.index.the_version_was_already_withdrawn", "the version was already withdrawn"), { version: versionId(t.id, n),
        ended: { ending: "withdrawn", by: { id: e.actor, name: e.actor_name }, at: e.at, reason: (parse(e.detail) || {}).reason ?? null } });
    }
    /* END DEC-49 REGION is-template-retire */
    const at = this.#when();
    const name_ = this.#nameOf(member);
    this.sql.exec(`INSERT INTO tpl_events (template_id, version, bundle_id, event, actor, actor_name, detail, at)
                   VALUES (?,?,?,?,?,?,?,?)`, t.id, n, t.bundle_id, "withdrawn", member, name_, json({ reason: reason.trim() }), at);
    return { ok: true, version: versionId(t.id, n), state: "withdrawn", withdrawn: { by: { id: member, name: name_ }, at, reason: reason.trim() } };
  }

  /* ================================================================ R12, R13: comments and notes */

  /** R13 (`op=templatecomment`): a comment on a version, attributed to the member, the grant or a labelled run; with
   *  `note`, a note added (R12) by a member who may revise, once the version has left draft. */
  templateComment({ template = null, version = null, text = null, note = false, author = null, secretSha = null, viewer = null } = {}) {
    let t, n, by;
    if (FilingTemplates.#hasSecret(secretSha)) {
      const d = this.#door(secretSha);
      if (!d || (template && str(template) !== d.t.id) || !FilingTemplates.#doorAdmits(d, version)) return noTemplateGrant();
      ({ t, n } = d);
      by = { kind: "grant", id: d.grant.grant_id, name: d.grant.recipient, organisation: d.grant.organisation };
    } else {
      t = this.#template(template ?? parseVersionId(version)?.template, viewer);
      n = t ? this.#versionOf(t, version) : null;
      if (!t || n === null) return this.#noTemplate(template);
      const who = str(author);
      const member = this.#member(author);
      by = !who ? null : isMachineIdentity(who) ? { kind: "run", id: who, name: who, label: proposalLabel(who, "template") }
        : member ? { kind: "member", id: member, name: this.#nameOf(member) } : null;
    }
    const isNote = note === true || note === "true" || note === "1" || note === 1;
    /* DEC-49 REGION is-template-comment */
    if (!by || !textUpTo(text, COMMENT_MAX))
      return refuse("COMMENT_REFUSED", by ? localize("filing-templates.index.a_comment_is_1_to", "a comment is 1 to {COMMENT_MAX} characters", { COMMENT_MAX: String(COMMENT_MAX) }) : localize("filing-templates.index.a_comment_names_who_wrote_it", "a comment names who wrote it: this call carries nobody"),
                    { max: COMMENT_MAX });
    if (isNote) {
      if (by.kind !== "member" || !t.project || !this.#call(() => this.membership.isJoinedParticipant(t.project, by.id)))
        return this.#scope(t, localize("filing-templates.index.a_note_is_added_by_a_member_who_may_revise", "a note is added by a member who may revise the template"));
      if (this.#stateOf(this.#events(t.id), n) === "draft")
        return refuse("COMMENT_REFUSED", localize("filing-templates.index.a_drafts_notes_are_edited_by_revising_it", "a draft's notes are edited by revising it (op=templaterevise, notes=)"), { max: COMMENT_MAX });
    }
    /* END DEC-49 REGION is-template-comment */
    const at = this.#when();
    this.sql.exec(`INSERT INTO tpl_comments (template_id, version, bundle_id, text, note, kind, author, author_name, organisation, at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)`, t.id, n, t.bundle_id, text, isNote ? 1 : 0, by.kind, by.id, by.name, by.organisation ?? null, at);
    return { ok: true, comment: { template: t.id, version: versionId(t.id, n), text, note: isNote, by: FilingTemplates.#by(by), at } };
  }
  static #by(b) {
    return b.kind === "grant" ? { kind: "grant", grant: b.id, name: b.name, organisation: b.organisation }
      : b.kind === "run" ? { kind: "run", label: b.label ?? proposalLabel(b.id, "template") } : { kind: "member", id: b.id, name: b.name };
  }

  /** R13 (`op=templatecomments`): a template's comments (or one version's), newest last, `limit` in [1, 500]; a grant's
   *  door reads only its own version's. */
  templateComments({ template = null, version = null, limit = null, author = null, secretSha = null, viewer = null } = {}) {
    let t, n = null;
    if (FilingTemplates.#hasSecret(secretSha)) {
      const d = this.#door(secretSha);
      if (!d || (template && str(template) !== d.t.id) || !FilingTemplates.#doorAdmits(d, version)) return noTemplateGrant();
      ({ t, n } = d);
    } else {
      t = this.#template(template ?? parseVersionId(version)?.template, viewer);
      if (!t) return this.#noTemplate(template);
      if (version !== null && version !== undefined && version !== "") { n = this.#versionOf(t, version); if (n === null) return this.#noTemplate(template); }
    }
    const max = clamp(limit, COMMENTS_MAX, COMMENTS_MAX);
    const rows = this.#rows(`SELECT * FROM tpl_comments WHERE template_id=? ${n !== null ? "AND version=?" : ""} ORDER BY cid LIMIT ?`,
                            t.id, ...(n !== null ? [n] : []), max + 1);
    return { ok: true, template: t.id, ...(n !== null ? { version: versionId(t.id, n) } : {}), limit: max,
             truncated: rows.length > max,
             comments: rows.slice(0, max).map((c) => ({ version: versionId(t.id, c.version), text: c.text, note: c.note === 1,
               by: FilingTemplates.#by({ kind: c.kind, id: c.author, name: c.author_name, organisation: c.organisation }), at: c.at })) };
  }

  /* ================================================================ R14, R15: the reads */

  #visibleTemplates(viewer) {
    const group = this.#rows(`SELECT template_id FROM tpl_templates ORDER BY created_at DESC, template_id DESC`)
      .map((r) => this.#groupTemplate(r.template_id)).filter((t) => this.#canSee(t, viewer));
    const prof = this.#profileTemplates().filter((t) => this.#canSee(t, viewer));
    return [...group, ...prof].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1));
  }

  /** R14 (`op=templates`): the templates the viewer may see, newest first, at most 200, with `truncated`. By default
   *  every offered version, the latest approved marked `default: true`; `state` lists instead drafts, versions in
   *  review, withdrawn versions, retired templates' versions, or open proposals (`proposed`). */
  templatesFor({ kind = null, profile = null, use = null, state = null, viewer = null } = {}) {
    const st = str(state);
    /* DEC-49 REGION is-templates-state */
    if (st && st !== "offered" && !TEMPLATES_STATES_LISTED.includes(st))
      return refuse("TEMPLATES_STATE_REFUSED", localize("filing-templates.index.state_is_offered_or_one", "state is offered or one of {TEMPLATES_STATES_LISTED}", { TEMPLATES_STATES_LISTED: String(TEMPLATES_STATES_LISTED.join(", ")) }), { states: TEMPLATES_STATES_LISTED });
    /* END DEC-49 REGION is-templates-state */
    const k = str(kind), p = str(profile), u = str(use);
    if (st === "proposed") {
      const rows = this.#rows(`SELECT * FROM tpl_proposals p WHERE NOT EXISTS (SELECT 1 FROM tpl_revisions r WHERE r.adopted=p.proposal_id)
                                 ORDER BY at DESC, proposal_id DESC`)
        .filter((x) => (!k || x.kind === k) && this.#proposal(x.proposal_id, viewer));
      return { ok: true, state: "proposed", kind: k, truncated: rows.length > TEMPLATES_FOR_MAX,
               proposals: rows.slice(0, TEMPLATES_FOR_MAX).map((x) => ({ id: x.proposal_id, template: x.template_id ?? null, kind: x.kind,
                 text: x.text, sha: x.sha, why: x.why, at: x.at, label: proposalLabel(x.proposer, "template") })),
               says: word("filing-templates.says.proposed_wording_offered") };
    }
    const out = [];
    for (const t of this.#visibleTemplates(viewer)) {
      if ((k && t.kind !== k) || (u && t.use !== u)) continue;
      if (p && t.profiles !== "general" && !t.profiles.includes(p)) continue;
      const events = t.origin === "profile" ? [] : this.#events(t.id);
      const numbers = t.origin === "profile" ? [Number(t.profileTemplate.version)] : this.#numbers(t.id);
      const stateOf = (n) => (t.origin === "profile" ? "approved" : this.#stateOf(events, n));
      let pick;
      if (!st || st === "offered") {
        if (t.retired || this.#profileRefusal(t) || this.#layersInactive(t).length) continue;
        pick = numbers.filter((n) => OFFERED.includes(stateOf(n)));
      } else if (st === "retired") pick = t.retired ? numbers : [];
      else pick = t.retired ? [] : numbers.filter((n) => stateOf(n) === st);
      if (!pick.length) continue;
      const dflt = !st || st === "offered" ? this.#latestApproved(t, events) : null;
      out.push(FilingTemplates.#head(t, {
        ...(p ? { written_for: t.profiles !== "general" && t.profiles.includes(p) } : {}),
        versions: pick.slice().reverse().map((n) => this.#listed(this.#versionView(t, n, events), n === dflt)) }));
    }
    /* R37: a profile template's name is shown with its layer when two offered profile templates share it */
    if (!st || st === "offered") {
      const prof = out.filter((x) => x.origin === "profile");
      const held = new Map(prof.length ? this.#profileTemplates().map((y) => [y.id, y]) : []);
      for (const x of prof) {
        const t = held.get(x.id);
        if (t && t.place && prof.some((y) => y !== x && y.name === x.name))
          x.name_shown = localize("filing-templates.index.name_in_its_layer", "{name} ({place})", { name: String(x.name), place: String(t.place) });
      }
    }
    return { ok: true, state: st || "offered", kind: k, profile: p, use: u, templates: out.slice(0, TEMPLATES_FOR_MAX),
             truncated: out.length > TEMPLATES_FOR_MAX };
  }

  /** R14, R15 (`op=templateread`): one version (the latest approved by default, else the latest) with its whole
   *  attribution, the proposals adopted into it and its comments' count; a grant's door reads only its own version. */
  templateRead({ template = null, version = null, author = null, secretSha = null, viewer = null } = {}) {
    let t, n;
    if (FilingTemplates.#hasSecret(secretSha)) {
      const d = this.#door(secretSha);
      if (!d || (template && str(template) !== d.t.id) || !FilingTemplates.#doorAdmits(d, version)) return noTemplateGrant();
      ({ t, n } = d);
    } else {
      t = this.#template(template ?? parseVersionId(version)?.template, viewer);
      if (!t) return this.#noTemplate(template);
      const events = t.origin === "profile" ? [] : this.#events(t.id);
      n = version !== null && version !== undefined && version !== "" ? this.#versionOf(t, version)
        : this.#latestApproved(t, events) ?? Math.max(...this.#numbers(t.id));
      if (n === null || !Number.isFinite(n)) return this.#noTemplate(template);
    }
    const events = t.origin === "profile" ? [] : this.#events(t.id);
    const view = this.#versionView(t, n, events);
    const adopted = this.#rows(`SELECT DISTINCT p.* FROM tpl_proposals p JOIN tpl_revisions r ON r.adopted=p.proposal_id
                                 WHERE r.template_id=? AND r.version=? ORDER BY p.proposal_id`, t.id, n)
      .map((x) => ({ id: x.proposal_id, sha: x.sha, why: x.why, at: x.at, label: proposalLabel(x.proposer, "template") }));
    const not = this.#profileRefusal(t);
    const inactive = this.#layersInactive(t);
    return { ok: true, template: FilingTemplates.#head(t), version: { ...view, proposals_adopted: adopted },
             comments: this.#one(`SELECT COUNT(*) AS c FROM tpl_comments WHERE template_id=? AND version=?`, t.id, n).c,
             offered: OFFERED.includes(view.state) && !t.retired && !not && !inactive.length,
             ...(inactive.length ? { layers_inactive: inactive } : {}),
             ...(view.state === "approved" && n === this.#latestApproved(t, events) ? { default: true } : {}),
             ...(not ? { not_offered: not } : {}),
             ...(not && not.blank ? { blank_unknown: not } : {}) };
  }

  /* ================================================================ R25: offeredVersion */

  /* R26: the one template `name` (`@<handle>`) names among those not retired that the viewer may see, the most specific
     scope first: `project`'s own templates (when given), then the group's (widened), then the active profiles'. The
     first scope holding the handle answers; two there are ambiguous. As `{t}`, or a refusal; writes nothing. */
  #byName(name, project, viewer) {
    /* DEC-49 REGION is-template-ref */
    if (typeof name !== "string" || !TEMPLATE_NAME_REF_RE.test(name))
      return refuse("TEMPLATE_REF_REFUSED", localize("filing-templates.index.a_template_is_named_as_at_and_its_names_handle", "a template is named as @ and its name's handle: lower-case letters and digits, runs joined by single hyphens"), { name: typeof name === "string" ? name.slice(0, 80) : null });
    const handle = name.slice(1), proj = str(project);
    const fits = (t) => t && !t.retired && templateHandle(t.name) === handle && this.#canSee(t, viewer);
    const group = this.#rows(`SELECT template_id FROM tpl_templates ORDER BY template_id`).map((r) => this.#groupTemplate(r.template_id));
    const scopes = [
      proj ? group.filter((t) => t && !t.widened && t.project === proj) : [],
      group.filter((t) => t && t.widened),
      this.#profileTemplates(),
    ];
    for (const scope of scopes) {
      const hits = scope.filter(fits);
      if (hits.length > 1) {
        /* R37: profile templates of different layers sharing the handle are named by their layers, neither chosen */
        const layers = [];
        for (const h of hits) if (h.origin === "profile" && h.layer && !layers.some((l) => l.layer === h.layer)) layers.push({ layer: h.layer, level: h.level, place: h.place });
        return refuse("TEMPLATE_NAME_AMBIGUOUS", localize("filing-templates.index.two_templates_you_can_see_go_by_that_name_in_the_same_scope", "two templates you can see go by that name in the same scope, so neither was chosen: name the template by its id"),
                      { name, ...(layers.length > 1 ? { layers } : {}) });
      }
      if (hits.length === 1) return { t: hits[0] };
    }
    /* END DEC-49 REGION is-template-ref */
    return this.#noTemplate(null);
  }

  /** R25 (`filings` R28, R31): the version of `template` a filing or briefing may use, with its metadata; the latest
   *  approved when `version` is absent. R26: `name` (`@<handle>`, with `project` when the draft has one) in place of
   *  `template` names it as the library does. Writes nothing. */
  offeredVersion({ template = null, name = null, project = null, version = null, viewer = null } = {}) {
    const given = (v) => v !== null && v !== undefined && v !== "";
    if (given(template) === given(name)) {
      /* DEC-49 REGION is-template-ref */
      return refuse("TEMPLATE_REF_REFUSED", given(template) ? localize("filing-templates.index.a_template_is_named_by_its_id_or_by_its_name_not_both", "a template is named by its id or by its name, not both")
        : localize("filing-templates.index.no_template_is_named_give_its_id_or_its_name", "no template is named: give its id, or @ and its name"));
      /* END DEC-49 REGION is-template-ref */
    }
    let t;
    if (given(name)) {
      const found = this.#byName(name, project, viewer);
      if (!found.t) return found;
      t = found.t;
    } else {
      t = this.#template(template, viewer);
      if (!t) return this.#noTemplate(template);
    }
    if (t.retired) return this.#retired(t);
    const not = this.#profileRefusal(t);
    if (not) return not;
    const events = t.origin === "profile" ? [] : this.#events(t.id);
    const latest = this.#latestApproved(t, events);
    const n = version === null || version === undefined || version === "" ? latest : this.#versionOf(t, version);
    const state = n === null ? null : t.origin === "profile" ? "approved" : this.#stateOf(events, n);
    const inactive = this.#layersInactive(t);
    /* DEC-49 REGION is-offered-version */
    if (n !== null && OFFERED.includes(state) && inactive.length)
      return refuse("TEMPLATE_NOT_OFFERED", localize("filing-templates.index.the_template_is_written_for_layers_not_active", "the template is written for {layers}, which the team's places do not include", { layers: String(inactive.join(", ")) }),
        { template: t.id, version: versionId(t.id, n), state, layers_inactive: inactive });
    if (n === null || !OFFERED.includes(state))
      return refuse("TEMPLATE_NOT_OFFERED", n === null ? (version ? localize("filing-templates.index.no_such_version_of_this_template", "no such version of this template") : localize("filing-templates.index.the_template_has_no_approved_version", "the template has no approved version"))
        : localize("filing-templates.index.the_version_is_state_only", "the version is {state}: only an approved or updated version is offered", { state: String(state) }),
        { template: t.id, ...(n !== null ? { version: versionId(t.id, n), state } : {}) });
    /* END DEC-49 REGION is-offered-version */
    const view = this.#versionView(t, n, events);
    const { id, version: number, ...meta } = this.#listed(view, n === latest);
    return { ok: true, template: t.id, version: id, number, use: t.use, kind: t.kind, profiles: t.profiles, origin: t.origin,
             name: t.name, sha: view.sha, text: view.text, ...meta };
  }

  /* ================================================================ R34, R35: the guide's reads */

  /* R34: the kind's own label, the kind of draft a template is: the label the first profile holding the kind gives it
     (a template's profiles, for a `general` one the active view's), else the kind itself. */
  #labelOf(t) {
    for (const p of Array.isArray(t.profiles) ? t.profiles : this.#activeIds()) {
      const e = this.#kindIn(this.#profile(p), t.kind);
      if (e && str(e.label)) return e.label.trim();
    }
    return t.kind;
  }

  /** R34 (`op=templatebyhandle`, a read for a member's session; T51-163, N1046): the text of the version `name` (`@`
   *  and a handle, R26) names, for the version R25 offers: `{template, version, sha, name, origin, default, text,
   *  blanks, label}`. Refusals are R26's and R25's in their order, writing nothing; a version not offered answers its
   *  refusal, never its text. A grant's door (R9) does not reach it: no secret is read. */
  templateByHandle({ name = null, project = null, version = null, viewer = null } = {}) {
    const o = this.offeredVersion({ name, project, version, viewer });
    if (!o.ok) return o;
    return { ok: true, template: o.template, version: o.version, sha: o.sha, name: o.name, origin: o.origin,
             default: o.default === true, text: o.text, blanks: blanksOf(o.text).blanks,
             label: this.#labelOf(this.#template(o.template, viewer)) };
  }

  /** R35 (T51-163, N858 D8; `filings` R65): the profile templates of `kind` in the active view that R15 does not offer
   *  for want of attribution, each `{handle, name, lacks}`, `lacks` what `jurisdictions`' `attributionLacks` (its
   *  R126; R38) answers, in its words and order; a kind whose venue is filed with a court
   *  answers `[]` (R28). A pure read of the view and the attribution: writes nothing and never throws. */
  unofferedFor({ kind = null, viewer = null } = {}) {
    const k = str(kind);
    if (!k || this.#courtIn(k, null)) return [];
    const out = [];
    for (const t of this.#profileTemplates()) {
      if (t.kind !== k || !this.#canSee(t, viewer)) continue;
      const lacks = FilingTemplates.#lacks(t.profileTemplate);
      if (lacks.length) out.push({ handle: templateHandle(t.name), name: t.name, lacks });
    }
    return out;
  }

  /* ================================================================ R20: reviewsRequested */

  /** R20 (`queue-producers` R20): every (version, member) pair where the member was asked to review, the version is in
   *  review, and the member has given no review of its present sha, each with the template's `project` (its scope's;
   *  null for a group template; N476); at most 500 per page in (version id, member) order after `after` (a previous
   *  page's `cursor`, or a version id, read as after all its members). Writes nothing. */
  reviewsRequested({ after = null, limit = null, viewer = null } = {}) {
    const max = clamp(limit, REVIEWS_REQUESTED_MAX, REVIEWS_REQUESTED_MAX);
    const from = str(after);
    const at = from ? /^(.+)#([^#]*)$/.exec(from) : null;
    const vid = `(r.template_id || '@' || r.version)`;
    const seek = at ? { sql: `AND (${vid} > ? OR (${vid} = ? AND r.member > ?))`, args: [at[1], at[1], at[2]] }
      : from ? { sql: `AND ${vid} > ?`, args: [from] } : { sql: "", args: [] };
    const rows = this.#rows(`SELECT r.*, ${vid} AS vid FROM tpl_reviewers r
      WHERE EXISTS (SELECT 1 FROM tpl_events e WHERE e.template_id=r.template_id AND e.version=r.version AND e.event='submitted')
        AND NOT EXISTS (SELECT 1 FROM tpl_events e WHERE e.template_id=r.template_id AND e.version=r.version
                          AND e.event IN ('approved','updated','withdrawn'))
        AND NOT EXISTS (SELECT 1 FROM tpl_reviews v WHERE v.template_id=r.template_id AND v.version=r.version AND v.kind='member'
                          AND v.reviewer=r.member AND v.sha=(SELECT x.sha FROM tpl_revisions x WHERE x.template_id=r.template_id
                            AND x.version=r.version ORDER BY x.rid DESC LIMIT 1))
        ${seek.sql}
      ORDER BY vid, r.member`, ...seek.args);
    const seen = new Map();
    const items = [];
    let truncated = false;
    for (const r of rows) {
      if (!seen.has(r.template_id)) seen.set(r.template_id, this.#template(r.template_id, viewer));
      const t = seen.get(r.template_id);
      if (!t) continue;
      if (items.length === max) { truncated = true; break; }
      /* the template's `scope`'s project (R1), as `#template` answers it: null once widened, never the `project` field */
      const project = t.scope && typeof t.scope === "object" ? t.scope.project ?? null : null;
      items.push({ template: t.id, version: r.vid, name: t.name, kind: t.kind, project, member: r.member, member_name: r.member_name,
                   asked_by: { id: r.asked_by, name: r.asked_name }, asked_at: r.at });
    }
    const tail = items[items.length - 1];
    return { ok: true, items, limit: max, truncated, cursor: truncated && tail ? `${tail.version}#${tail.member}` : null };
  }

  /* ================================================================ the migration from filings (K927) */

  /** Each template `filings` R26 saved becomes a template of origin `group` with one `draft` version, author its saver,
   *  `derived_from` its filing draft, and a carried note (K921, K927): offered only once reviewed and approved. A row
   *  already migrated is passed over, so it runs at every start and changes nothing the second time. `filings`'
   *  table is read, never written. */
  migrateFromFilings() {
    const cols = this.#call(() => this.#rows(`PRAGMA table_info(filing_templates)`).map((c) => c.name), []);
    if (!["template_id", "name", "text", "from_filing", "action_id", "author", "at"].every((c) => cols.includes(c))) return { migrated: 0 };
    const rows = this.#rows(`SELECT f.* FROM filing_templates f WHERE NOT EXISTS
                               (SELECT 1 FROM tpl_templates t WHERE t.migrated_from=f.template_id) ORDER BY f.at, f.template_id`);
    let migrated = 0;
    for (const f of rows) {
      const basis = parse(f.basis) || {};
      const project = str(basis.project);
      const bundle = project || str(f.action_id);
      const member = this.#member(f.author) || str(f.author) || "unrecorded";
      const name_ = this.#nameOf(member);
      const at = str(f.at) || this.#when();
      const ok = this.record.transact(() => {
        const id = this.#mint("TPL", at.slice(0, 4));
        if (!id) return mintExhausted("TPL");
        this.sql.exec(`INSERT INTO tpl_templates (template_id, bundle_id, project, kind, use, profiles, name, origin, created_by,
                         created_name, created_at, migrated_from) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, bundle, project, typeof f.kind === "string" && KIND_RE.test(f.kind) ? f.kind : null, "file", "general",
          String(f.name), "group", member, name_, at, f.template_id);
        const sha = sha256HexSync(String(f.text));
        this.sql.exec(`INSERT INTO tpl_versions (template_id, version, bundle_id, author, author_name, derived_from, created_at)
                       VALUES (?,1,?,?,?,?,?)`, id, bundle, member, name_, json({ filing: f.from_filing, sha }), at);
        this.sql.exec(`INSERT INTO tpl_revisions (template_id, version, bundle_id, text, sha, author, author_name, adopted, at)
                       VALUES (?,1,?,?,?,?,?,NULL,?)`, id, bundle, String(f.text), sha, member, name_, at);
        this.sql.exec(`INSERT INTO tpl_notes (template_id, version, bundle_id, text, author, author_name, carried, at)
                       VALUES (?,1,?,?,?,?,1,?)`, id, bundle, MIGRATED_NOTE, member, name_, at);
        return { ok: true };
      });
      if (ok && ok.ok) migrated++;
    }
    return { migrated };
  }
}

/* The reads and acts answer their own refusals with code, check and translation (DEC-49). */
for (const m of ["templateDraft", "templateRevise", "templatePropose", "templateSubmit", "templateReviewGrant", "templateGrantRevoke",
                 "templateReview", "templateApprove", "templateRetire", "templateComment", "templateComments", "templatesFor",
                 "templateRead", "offeredVersion", "templateByHandle", "reviewsRequested"]) {
  const fn = FilingTemplates.prototype[m];
  FilingTemplates.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it creates and declares its tables (R17), registers its opaque ids'
 *  seed (record-core R70) and runs the migration from `filings` (K927). */
export function filingTemplatesOf(host, deps) {
  let f = instances.get(host);
  if (!f) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    f = new FilingTemplates({ ...d, storage, record, membership, env: d.env ?? host.env ?? null });
    instances.set(host, f);
    f.migrate();
    record.declarePurge("filing-templates", [...FILING_TEMPLATES_TABLES]);
    record.registerMintSeed("filing-templates", FILING_TEMPLATES_MINT_SEED.map((x) => [...x]));
    f.migrateFromFilings();
  }
  return f;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function filingTemplatesOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return FILING_TEMPLATES_TABLES.includes(name);
}

/** The module's ops (K3, the `actionClocksOps` pattern): `author` and `viewer` are the control plane's stamps (`author`
 *  stands for R3's author, R6's proposer and R8, R10, R11's `by`), read from the query and never from the body, so a
 *  caller's own copy never wins. `secretSha` (R8's new grant's fingerprint and the grant doors' of R9, R13 and R14) is
 *  read from the body only, whatever the request's method, where the control plane sets it after removing any a caller
 *  sent; a `secretSha` in the query is never read, so a digest there alone mints no grant and opens no door (R27;
 *  N761). `op-declarations` declares them (its R8), `control-plane` routes them (its R44, R64) and `plane` composes
 *  them (its R11). A `{filing, sha}` source is refused here (R3). */
export function filingTemplatesOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  const has = (k) => url.searchParams.has(k);
  const b = body && typeof body === "object" ? body : {};
  const pick = (k) => (b[k] !== undefined && b[k] !== null ? b[k] : has(k) ? q(k) : null);
  const stamps = { viewer: q("viewer") };
  /* R27: the fingerprint's one channel, so no digest travels in an internal address. */
  const door = { secretSha: b.secretSha ?? null };
  return {
    templatedraft: () => m.templateDraft({ template: pick("template"), project: pick("project"), kind: pick("kind"), use: pick("use"),
      profiles: pick("profiles"), name: pick("name"), text: b.text, from: pick("from"), notes: b.notes ?? null,
      author: q("author"), via: "op", ...stamps }),
    templaterevise: () => m.templateRevise({ version: pick("version"), text: b.text, adopt: pick("adopt"), notes: b.notes ?? null,
      author: q("author"), ...stamps }),
    templatepropose: () => m.templatePropose({ template: pick("template"), kind: pick("kind"), text: b.text, why: b.why ?? null,
      run: pick("run"), model: pick("model"), skill_pack: pick("skill_pack"), proposer: q("author"), ...stamps }),
    templatesubmit: () => m.templateSubmit({ version: pick("version"), reviewers: pick("reviewers"), author: q("author"), ...stamps }),
    templatereviewgrant: () => m.templateReviewGrant({ version: pick("version"), recipient: pick("recipient"),
      organisation: pick("organisation"), by: q("author"), ...door, ...stamps }),
    templategrantrevoke: () => m.templateGrantRevoke({ grant: pick("grant"), by: q("author"), ...stamps }),
    templatereview: () => m.templateReview({ version: pick("version"), outcome: pick("outcome"), scope: pick("scope"),
      comment: b.comment ?? null, credential: pick("credential"), sha: pick("sha"), author: q("author"), ...door, ...stamps }),
    templateapprove: () => m.templateApprove({ version: pick("version"), widen: pick("widen") ?? false, reason: b.reason ?? null,
      by: q("author"), ...stamps }),
    templateretire: () => m.templateRetire({ template: pick("template"), version: pick("version"), reason: b.reason ?? null,
      by: q("author"), ...stamps }),
    templatecomment: () => m.templateComment({ template: pick("template"), version: pick("version"), text: b.text ?? null,
      note: pick("note") ?? false, author: q("author"), ...door, ...stamps }),
    /* control-plane R59: the template doors take a POST, so the two reads take their arguments from the body too */
    templatecomments: () => m.templateComments({ template: pick("template"), version: pick("version"), limit: pick("limit"),
      author: q("author"), ...door, ...stamps }),
    templates: () => m.templatesFor({ kind: q("kind"), profile: q("profile"), use: q("use"), state: q("state"), ...stamps }),
    /* R34: a member's session reads a template's text by its handle; no digest is read, so no grant's door reaches it */
    templatebyhandle: () => m.templateByHandle({ name: pick("name"), project: pick("project"), version: pick("version"), ...stamps }),
    templateread: () => m.templateRead({ template: pick("template"), version: pick("version"), author: q("author"), ...door, ...stamps }),
  };
}
