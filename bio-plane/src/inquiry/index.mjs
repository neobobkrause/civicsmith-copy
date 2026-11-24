/* inquiry — the one recursive object of case-making (requirements: `build/requirements/inquiry.md`). A question, which
 * gathers evidence and other inquiries as the legs of its basis, and may reach a conclusion. This module holds the
 * inquiry's lifecycle and its grammar (the public face of `inquiry-grammar`'s rules, `./grammar.mjs`), the basis legs, the
 * ground partition (DEC-32), the exclusions a completeness statement names, supersession and division, dated waits and
 * the documents a question waits on that were set aside (R58).
 * What the record can earn for a leg and which questions rest on a target (the earned registry, the resting-on reads,
 * the cycle walk and `inquiry_basis` with its one write) are `leg-earning`'s since T33 (K617, K1505): this module asks
 * it, and re-exports its names and reads for importers not yet re-pointed (plan Rules (9) item 4). It holds no version of a basis, no conclusion and no
 * strength: those are `basis-versions`' and `strength`'s, which read what this module holds.
 *
 * Extracted from the legacy modules (T7, layer 6; K3, K64, K83, K102, N55, N56): `store.mjs` (REC-11's basis projection
 * and cycle guard, REC-14's exclusions, REC-16's division, REC-17's live-leg predicate and superseded-by index, REC-18's
 * earned registry with REC-83/REC-88/MK-2's arms, REC-45's grounding, S-11's disposition, REC-82/REC-84's leg content,
 * REC-220's leg versions, REC-173's replay row), `schema.mjs` (the three tables, now `./schema.mjs`). The leg and entry
 * grammar is `inquiry-grammar`'s since T19 (moved from the catalogue, K766), judged at the write synchronously (R11);
 * `./grammar.mjs` is its one public face here. The legacy code's comments moved with it, shortened where they only
 * restated it.
 *
 * REACHED as `inquiryOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first call
 * with `deps`, returned to every later caller. At creation it declares its tables to purge (R36), joins every promotion
 * (R11's check, R12's projection) and every re-read that stales content (content R41's `onStale`), and registers with
 * retrieval the `legs` field's relation (R36, its R62), the migrated arm of `surfaced_in` (N405, its R56) and a
 * question's `projects` on a search page's row (R60, its R78). It offers `onMachinePassage` (R62). Its
 * questions' findings are bias's work products (R53, bias R40) through `inquiryFindings`, which `plane` registers.
 * `deps`:
 *   record, membership, promotion, content, connections, entities, retrieval, provenance   the modules it uses,
 *                (connections, entities and provenance are passed through to leg-earning; standards and duties too),
 *                through their factories on the same host unless a test passes its own (connections, entities,
 *                retrieval and provenance are reached lazily, on first use).
 *   bias         the host's bias instance the lens of a finding is read from (R53); else the one `inquiryFindings` binds,
 *                and with neither a finding records no lens. Never created here: the host builds bias with its `env`.
 *   now          the module's clock, an ISO instant at second precision (default: the wall clock). */

import { parseFrontmatter, normalizeType, OBJECT_TYPES, STATES, vocabFor, deriveInquiryTitle, BUNDLE_ID_RE,
         isMachineIdentity, createSha256,
         SHARED_ACT_CHECKS } from "../record-grammar/index.mjs";
import { checkInquiryBasis, checkInquiryExtension, supersedesEdgeFindings, divisionDisclosureFindings, INQUIRY_ROWS }
  from "./grammar.mjs";
import { INQUIRY_GRAMMARS, parseImportedFindingRef, parseOccurrenceRef, CALCULATION_REF_RE, readBiasApplied }
  from "../inquiry-grammar/index.mjs";
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal, Membership } from "../membership/index.mjs";
import { promotionOf, stepContext, PROMOTION_ROW_CHECKS } from "../promotion/index.mjs";
import { contentOf, CONTENT_EXTENT_CHECKS, CONTENT_MINTED_BY_PLANE, canonicalExtent, legContentId }
  from "../content/index.mjs";
import { connectionsOf, refsReplacedOf } from "../connections/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { legEarningOf, legCapped } from "../leg-earning/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { notADisposition, DISPOSITIONS } from "../progressions/index.mjs";
import { INQUIRY_TABLES, INQUIRY_DECLARATIONS, migrateInquiry, BUNDLE_FACTS, LEGS_RELATION } from "./schema.mjs";
import { localDay, dayRange, isCalendarDate } from "../civil-time/index.mjs";
import { combine as combineProfiles, governingZone } from "../../../jurisdictions/index.mjs";
import { INQUIRY_CONTRADICTION_CHECKS, INQUIRY_SURFACE_CHECKS, INQUIRY_BIAS_CHECKS, INQUIRY_PASSAGE_CHECKS, QUESTION_WORDS,
         INQUIRY_WARNINGS } from "./checks.mjs";
import { checkInquiryEntry, inquiryQuestionOf } from "./grammar.mjs";
import { contradictionFindings, candidateOf, readResolution, exploresOf, CANDIDATE_RE } from "./contradiction.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { partitionOfDoc, loggedChanges } from "./partition.mjs";
import { setScalar, setOrAddScalar, appendStateHistory, removeBlock, setOrAddBlock, setSection, appendSessionLog,
         spliceBasisGround, blockEntries, fmSafe, rand } from "./text.mjs";

export { INQUIRY_SCHEMA, INQUIRY_TABLES, INQUIRY_DECLARATIONS, BUNDLE_FACTS, LEGS_RELATION, SUBJECT_COLUMN, moveBundleFacts, moveSubjectEntity }
  from "./schema.mjs";
export * from "./grammar.mjs";
export { INQUIRY_CONTRADICTION_CHECKS, INQUIRY_SURFACE_CHECKS, INQUIRY_BIAS_CHECKS, INQUIRY_PASSAGE_CHECKS, QUESTION_WORDS,
         INQUIRY_WARNINGS } from "./checks.mjs";
export { CONTRADICTION_COORDINATES, PLURALITY_DIFFERENCES, DISSOLVED_BY, NORM_CANONS, RESOLUTION_KINDS, resolutionFamily,
         resolutionLines, CANDIDATE_RE, QUALIFIER_MAX, HYPOTHESIS_MAX } from "./contradiction.mjs";

/** R20, R27, R9: a reason's bound (the edge-reason bound, K57: each module holds its own copy) and the longer bound on a
 *  division's or a grouping's reason and a child's question, which are accounts rather than labels. */
export const EDGE_REASON_MAX = 160;
export const RELEASE_ACK_MAX = 500;
/** R13–R17, R39's read (T33-45; K617, K1505): the earned registry's names moved to `leg-earning` (its R1–R7), re-exported
 *  here as the same bindings for importers not yet re-pointed (plan Rules (9) item 4); this module holds no copy. */
export { legCapped, LEG_BACKFILL_MAX, EARNED_TARGETS_MAX, PROJECTS_DRAWING_MAX, AUTHORED_ROUTE_BASES }
  from "../leg-earning/index.mjs";
/** R41, R18 (N183): the most legs, stale rows past a notice's bound, or exclusions one statement reads. */
export const STALE_PAGE = 500;
/** R44 (N149): the longest member-browser agent recorded; a longer or unprintable stamp is not an agent to present. */
export const MEMBER_AGENT_MAX = 512;
const agentOf = (v) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t && t.length <= MEMBER_AGENT_MAX && !/[\u0000-\u001f\u007f]/.test(t) ? t : null;
};
/** R54, R55: the states that end every wait on an inquiry (nothing is awaited on a question no longer worked). */
export const WAIT_ENDING_STATES = Object.freeze(["concluded", "divided", "dismissed"]);
/** R58: the most questions one call reads the document waits of (a question's screen asks one, its project's list
 *  that list's ids), the page of capture R84 read per statement, and the most pages read for one question. */
export const DOCUMENT_WAITS_MAX = 200;
const HELD_ACTS_PAGE = 1000;
const HELD_ACTS_PAGES_MAX = 50;
/** R56: the longest note a look carries. */
export const LOOK_NOTE_MAX = 500;
/** R55: a member's own stamp, as the control plane writes it. */
const memberStamp = (m) => {
  const t = typeof m === "string" ? m.trim() : "";
  if (!t) return null;
  const x = /^member:([A-Za-z0-9._:-]{1,128}?)(?:\/.*)?$/.exec(t);
  return x ? `member:${x[1]}` : t.includes(":") ? null : `member:${t}`;
};
/** R54: who set a wait, as a member's own stamp; any other author (a machine) is kept as written. */
const setterOf = (author) => { const t = typeof author === "string" ? author.trim() : ""; return t ? (memberStamp(t) ?? t) : null; };

/** R20 (N285): the two dispositions, `progressions`' one list (its R35), re-exported for `affordances` (K78 (3)); this
 *  module holds no copy of its own. */
export { DISPOSITIONS };

/** R39 (K2371, K2436; H10, H38; DEC-188 (7)): the refusal of a shared disposition of a question a project shown to the
 *  caller draws on, its row held here (K174's pattern, the catalogue untouched). `DRAWN_ON_BY_SEVERAL_PROJECTS` (C-106.1)
 *  is retired, its number never reused (a different condition, T40-5). The translation is `words.json`'s
 *  `question.refused.drawnon`, read by key (`QUESTION_WORDS`); it names no project, which travel in the refusal as data.
 *  It awaits T41's stamp. */
export const INQUIRY_DISPOSE_CHECKS = {
  DRAWN_ON_BY_A_PROJECT: {
    check: 'C-106.2',
    where: 'src/inquiry/index.mjs #dispose > is-dispose-drawn-on',
    translation: QUESTION_WORDS['question.refused.drawnon'],
    key: 'question.refused.drawnon',
  },
};

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
/** R4, R12 (N522): a leg's target that is an imported finding reference (`inquiry-grammar` R11), another group's finding
 *  rather than a bundle of this record: never in `references[]`, no content row, projected as spelled. */
const isImportedRef = (t) => typeof t === "string" && parseImportedFindingRef(t) !== null;
/** R4 (T34-29; inquiry-grammar R17): a derived connection's id, 64 lowercase hex (`connection-grammar.derivedId`), the
 *  form inquiry-grammar's arm judges; whether it matches its derivation is that arm's, whether it re-derives hypotheses'. */
const DERIVED_ID_RE = /^[0-9a-f]{64}$/;
/** R4 (T33-45, T34-29; inquiry-grammar R11, R14, R15, R17): a target that is never a `references[]` entry: an imported
 *  finding, a calculation (a row, not a bundle), a duty occurrence or a derived connection. */
const unreferenced = (t) => isImportedRef(t) || (typeof t === "string"
  && (CALCULATION_REF_RE.test(t) || parseOccurrenceRef(t) !== null || DERIVED_ID_RE.test(t)));

/** The catalogue row a refusal code has, if any: its check id and canned translation travel with it (DEC-49). */
const ROW_FAMILIES = [INQUIRY_ROWS, SHARED_ACT_CHECKS, INQUIRY_DISPOSE_CHECKS, INQUIRY_CONTRADICTION_CHECKS,
                      INQUIRY_SURFACE_CHECKS, INQUIRY_BIAS_CHECKS, INQUIRY_PASSAGE_CHECKS];
function withRow(answer) {
  if (!answer || answer.ok !== false || typeof answer.reason !== "string" || answer.check) return answer;
  const row = ROW_FAMILIES.map((f) => f && f[answer.reason]).find((r) => r && r.check);
  return row ? { ...answer, check: row.check, translation: row.translation, ...(row.key ? { key: row.key } : {}) } : answer;
}

/** R16: the superseded-by column read back as a list; ONE parser, so no caller splits the string itself. */
export function supersededByOf(row) {
  const v = row && typeof row.inquiry_superseded_by === "string" ? row.inquiry_superseded_by : "";
  return v ? v.split(",").filter((x) => x !== "") : [];
}

/** R45 (D-484 / C-33.40, N186): the one site at which the plane says a thing the record would stand behind rests on
 *  nothing; `basis-versions` answers through it too. `extra` adds the caller's fields and never replaces these. */
export function actNoBasis(detail, extra = {}) {
  /* DEC-49 REGION is-act-no-basis */
  const row = SHARED_ACT_CHECKS.NO_BASIS;
  return { ...(extra && typeof extra === "object" ? extra : {}),
           ok: false, reason: "NO_BASIS", code: "NO_BASIS", check: row.check, translation: row.translation, detail };
  /* END DEC-49 REGION is-act-no-basis */
}

/** R61 (D59; K231, K2472): the one spelling of `BIAS_APPLICATION_NOT_IN_FORCE` (C-2.19), a finding inside
 *  `BASIS_REFUSED`: `statement` the bias statement id the application names, `where` the place that names it (a leg's
 *  `basis[i]`, or a caller's own label: `basis-versions` R48 and `case-disclosures` R31 answer through it). `inForce` is
 *  what `bias.statementInForce` answered (`false`, or `null` for undetermined); `scope` the lens asked. Pure; never
 *  throws. */
export function biasNotInForce(args = {}) {
  const { statement = null, where = null, inForce = false, scope = null } = args && typeof args === "object" ? args : {};
  /* DEC-49 REGION is-bias-application-in-force */
  const row = INQUIRY_BIAS_CHECKS.BIAS_APPLICATION_NOT_IN_FORCE;
  const id = typeof statement === "string" ? statement : null;
  const at = typeof where === "string" && where ? where : null;
  const lens = scope && typeof scope === "object" && scope.type === "project" && typeof scope.id === "string" && scope.id
    ? word("inquiry.text.lens_force", { id: scope.id }) : word("inquiry.text.group_lens_force");
  return { check: row.check, code: "BIAS_APPLICATION_NOT_IN_FORCE", translation: row.translation,
           statement: id, where: at, in_force: inForce === null ? null : false,
           detail: localize("inquiry.index.v1_names_the_bias_statement", "{v1} names the bias statement {v2}, {v3}", { v1: String(at ?? "a bias application"), v2: String(id === null ? "(none)" : `'${fmSafe(id)}'`), v3: String(inForce === null
                   ? localize("inquiry.index.whether_it_is_in_lens_could", "and whether it is in {lens} could not be read, so the application is refused rather than trusted", { lens })
                   : localize("inquiry.index.which_is_not_in_lens", "which is not in {lens}", { lens })) }) };
  /* END DEC-49 REGION is-bias-application-in-force */
}

/** R62 (T42; N834; K231, K2496): the one spelling of `MACHINE_PASSAGE_UNCHECKED` (C-2.20): the read registered with
 *  `onMachinePassage` threw or answered neither null nor a refusal, so whether each leg may stand as the member's own is
 *  not known and the act is refused (fail closed). `basis-versions` R49 answers through it. `extra` adds the caller's
 *  fields and never replaces these. Pure; never throws. */
export function machinePassageUnchecked(detail, extra = {}) {
  /* DEC-49 REGION is-machine-passage-checked */
  const row = INQUIRY_PASSAGE_CHECKS.MACHINE_PASSAGE_UNCHECKED;
  return { ...(extra && typeof extra === "object" ? extra : {}),
           ok: false, reason: "MACHINE_PASSAGE_UNCHECKED", code: "MACHINE_PASSAGE_UNCHECKED", check: row.check,
           translation: row.translation,
           detail: typeof detail === "string" && detail ? detail
             : localize("inquiry.index.whether_the_passages_this_act", "whether the passages this act cites were proposed by an assistant and taken up by the member could not be read, so the act is refused rather than passed on trust. Nothing was written.") };
  /* END DEC-49 REGION is-machine-passage-checked */
}

/** R64, R27 (T48; N1012; K231, K3092, K3102): the one spelling of `DIVIDED_CANNOT_RESTRUCTURE`: the question was divided
 *  and its children carry it on, so its document is closed. `ground` (R27) and R11's check of every revision of a
 *  divided question (R64) answer through it. It carries `target` (the caller's `extra.target`, else null) and
 *  `from: "divided"`; `detail` is the caller's, saying to work on the child that carries the part meant. `extra` adds the
 *  caller's fields and never replaces these. The code has no catalogue row, so no check or translation travels with it.
 *  Pure; never throws. */
export function dividedCannotRestructure(detail, extra = {}) {
  const x = extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {};
  /* DEC-49 REGION is-divided-closed */
  return { ...x, ok: false, reason: "DIVIDED_CANNOT_RESTRUCTURE", code: "DIVIDED_CANNOT_RESTRUCTURE",
           target: typeof x.target === "string" && x.target ? x.target : null, from: "divided",
           detail: typeof detail === "string" && detail ? detail
             : localize("inquiry.index.this_question_was_divided_and", "this question was divided and its children carry it on, so its document is closed: nothing in it is revised now. Work on the child that carries the part you mean. Nothing was written.") };
  /* END DEC-49 REGION is-divided-closed */
}

/* R62: the fields of a leg that name the passage it cites (its target, its content row, the capture its part was made
   against, and its part), each as the leg states it; what the machine-passage read is asked about. */
const passageOf = (leg, ord) => {
  const out = { ord, target: typeof leg.target === "string" ? leg.target.trim() : leg.target };
  for (const k of Object.keys(leg).sort())
    if ((k === "content_id" || k === "extent_capture" || k.startsWith("extent_")) && leg[k] !== undefined && leg[k] !== null)
      out[k] = leg[k];
  return out;
};
const passageKey = (p) => { const { ord, ...rest } = p; return JSON.stringify(rest); };

/* ------------------------------------------------------------------ R59: a person in no public role (D13) */

/** R59 (K2479, K2480): the line kinds and the far end's kind that make a person's role public: an office the entity
 *  holds, is responsible for or acts (speaks) for; a government body it belongs to. Read from `lines` (its R17 read
 *  contract) and the far end's kind and sector from `entities`. */
export const PUBLIC_ROLE_LINES = Object.freeze({ office: Object.freeze(["holds", "responsible_for", "acts_for"]),
                                                 government_body: Object.freeze(["belongs_to", "seat_on"]) });
/** R59: the most words of a question read as a name's run, the longest run, and the cap on persons named. */
export const PERSON_TEXT_WORDS_MAX = 120;
export const PERSON_NAME_WORDS_MAX = 8;
const ENTITY_ID_IN_TEXT = /\bENT-\d{4}-\d{4,}\b/g;
/* A name's fold for matching inside a question: lower-cased, every run of characters that is no letter or digit one
   space, trimmed (so a name matches as whole words). */
const wordsFold = (t) => (typeof t === "string" ? t.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim() : "");

/** R59 (D13): the persons in no public role that `text` names, over `entities`, the facts a caller read from the record
 *  (`{entity_id, kind, label, aliases?, public_role, named?}`): an entity of kind `person` whose `public_role` is not
 *  `true`, and that is `named` (the caller found it named: a question's subject, or matched by alias), or whose id or
 *  label or an alias occurs in `text` as whole words. Answers `[{entity_id, label}]`, by id, each once. Pure; never
 *  throws. */
export function personsInNoPublicRole(args = {}) {
  try {
    const { text = "", entities = [] } = args && typeof args === "object" ? args : {};
    const hay = ` ${wordsFold(text)} `;
    const raw = typeof text === "string" ? text : "";
    const out = new Map();
    for (const e of Array.isArray(entities) ? entities : []) {
      if (!e || typeof e !== "object" || e.kind !== "person" || e.public_role === true) continue;
      const id = typeof e.entity_id === "string" ? e.entity_id : "";
      if (!id) continue;
      const names = [e.label, ...(Array.isArray(e.aliases) ? e.aliases : [])].map(wordsFold).filter(Boolean);
      const named = e.named === true || raw.includes(id) || names.some((n) => hay.includes(` ${n} `));
      if (named && !out.has(id)) out.set(id, { entity_id: id, label: typeof e.label === "string" ? e.label : null });
    }
    return [...out.values()].sort((a, b) => (a.entity_id < b.entity_id ? -1 : 1));
  } catch { return []; }
}

/** R59 (D13; K2479): the test the promotion of a question asks, and `intent` R32 and `hypotheses` R19 ask by the same
 *  export: null when `text` (over `entities`, as `personsInNoPublicRole`) names no person in no public role; else the
 *  warning `{code: "PERSON_IN_NO_PUBLIC_ROLE", key, translation, persons}`, never an error. `viewer` is the member the
 *  warning is for, carried as the caller's (the facts are the caller's read). Pure; never throws. */
export function personWarning(args = {}) {
  const { text = "", entities = [], viewer = null } = args && typeof args === "object" ? args : {};
  const persons = personsInNoPublicRole({ text, entities });
  if (!persons.length) return null;
  const row = INQUIRY_WARNINGS.PERSON_IN_NO_PUBLIC_ROLE;
  return { code: "PERSON_IN_NO_PUBLIC_ROLE", key: row.key, translation: row.translation, persons,
           ...(typeof viewer === "string" && viewer ? { viewer } : {}) };
}

/* The files of a bundle other than bundle.md, carried unchanged into its next promotion. */
function carriedFiles(sql, bundleId) {
  const carried = [];
  for (const r of sql.exec(
    `SELECT path, content, blob_sha, sha256, bytes FROM files WHERE bundle_id=? AND path<>'bundle.md'`, bundleId))
    carried.push(r.content !== null
      ? { path: r.path, text: r.content, bytes: r.bytes, sha256: r.sha256 }
      : { path: r.path, blobSha: r.blob_sha, sha256: r.sha256, bytes: r.bytes });
  return carried;
}
const mdFile = (text) => {
  const bytes = new TextEncoder().encode(text);
  return { path: "bundle.md", text, bytes: bytes.length, sha256: createSha256().update(bytes).hex() };
};

/* R24 (N360): a leg's lines rebuilt from its parsed fields, for the one case `divide` cannot copy them from the parent's
   bytes (a replayed shape whose block does not line up with its legs): every field of the leg grammar, the passage it
   names (`content_id`, each `extent_*` field, the capture it was made against), a standard's portion and a derived
   connection's five `derivation_*` fields among them. A list is written inline. */
const LEG_FIELDS = ["target", "role", "grade", "grade_axis", "grade_source", "target_edition", "target_portion", "author", "date",
                    "ground", "derivation_kind", "derivation_from", "derivation_to", "derivation_as_of", "derivation_method"];
function legRebuilt(l) {
  const val = (v) => (Array.isArray(v) ? `[${v.map((x) => fmSafe(x).replace(/[,[\]]/g, " ")).join(", ")}]`
    : typeof v === "string" && /[:#"'\[\]{},]|^\s|\s$|^$/.test(v) ? `"${fmSafe(v)}"` : String(v));
  const keys = [...LEG_FIELDS.filter((k) => k !== "target" && k !== "role"),
                ...Object.keys(l).filter((k) => k === "content_id" || k.startsWith("extent_")).sort()];
  return [`  - target: ${l.target}`, `    role: ${l.role ?? "supports"}`,
    ...keys.filter((k) => l[k] !== undefined && l[k] !== null && l[k] !== "").map((k) => `    ${k}: ${val(l[k])}`),
    ...(typeof l.note === "string" ? [`    note: "${fmSafe(l.note)}"`] : [])];
}

/* R42 (N422): `base` with a `listeners_failed` key read through `failed()` whenever the object is read: present, as the
   list `failed()` answers, exactly while that list is not empty; every other key is `base`'s own. */
const LISTENERS_FAILED = "listeners_failed";
function liveFailures(base, failed) {
  const now = () => { const f = failed(); return f.length ? f : null; };
  return new Proxy(base, {
    get: (t, k, rcv) => (k === LISTENERS_FAILED ? (now() ?? undefined) : Reflect.get(t, k, rcv)),
    has: (t, k) => (k === LISTENERS_FAILED ? now() !== null : Reflect.has(t, k)),
    ownKeys: (t) => [...Reflect.ownKeys(t).filter((k) => k !== LISTENERS_FAILED), ...(now() ? [LISTENERS_FAILED] : [])],
    getOwnPropertyDescriptor: (t, k) => {
      if (k !== LISTENERS_FAILED) return Reflect.getOwnPropertyDescriptor(t, k);
      const f = now();
      return f ? { value: f, writable: true, enumerable: true, configurable: true } : undefined;
    },
  });
}

/** R53: a promotion's author as a member id (`member:<id>`, as the control plane stamps it), else null: a machine or
 *  an unreadable author is no principal a bias debt names. */
const MEMBER_AUTHOR = /^member:([A-Za-z0-9._:-]{1,128}?)(?:\/.*)?$/;
/** R53: the key a finding is offered to bias under, its question's id behind a prefix no run id shares (bias keys every
 *  debt by its work product's key alone). */
const FINDING_KEY = "finding:";
/** R53 (K2442, D54): the viewer an internal read takes, a machine credential's (membership R43: it sees every bundle),
 *  never the founder's `admin`, which is blind to a hidden project the founder neither was invited to nor joined. */
export const INTERNAL_VIEWER = "class:daemon";

/* ------------------------------------------------------------------ the module */

export class Inquiry {
  #onRaised = null;      // {module, fn}: reevaluation's obligation (R21, R25)
  #onGrounded = null;    // {module, fn}: strength's pair (R28)
  #bias = null;          // R53: the lens a finding is made under is read here
  #onWaitSet = null;     // {module, fn}: scheduler's arming notice (R54; scheduler R9)
  #onMachinePassage = null; // {module, fn}: whether a member may cite as hers a passage a machine proposed (R62)
  #view;                 // R55, R57: the active jurisdiction view, whose time_zone is the profile's
  #deps;

  constructor({ storage, record, membership, promotion, content, connections = null, entities = null, retrieval = null,
                provenance = null, standards = null, duties = null, legEarning = null, calculations = null, capture = null, bias = null, host = null, view = null, now } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.content = content;
    this.#deps = { connections, entities, retrieval, provenance, standards, duties, legEarning, calculations, capture, host };
    this.#bias = bias;
    this.#view = typeof view === "function" ? view : null;
    this.now = typeof now === "function" ? now : () => stampInstant("second");
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  /* connections is passed through to leg-earning, and reached by callers' fixtures through this instance */
  get connections() { return this.#deps.connections ||= connectionsOf(this.#deps.host); }
  get entities() { return this.#deps.entities ||= entitiesOf(this.#deps.host); }

  get retrieval() { return this.#deps.retrieval ||= retrievalOf(this.#deps.host); }
  /** R11, R12, R29, R39, R52 (T33-45): the earned registry, the resting-on reads and `inquiry_basis`'s one write, which
   *  are `leg-earning`'s (K1505). Built on the same host with this module's own deps unless a test passes its own. */
  get legEarning() {
    const d = this.#deps;
    return d.legEarning ||= legEarningOf(d.host, { record: this.record, membership: this.membership, promotion: this.promotion,
      content: this.content, connections: d.connections, entities: d.entities, provenance: d.provenance,
      standards: d.standards, duties: d.duties, now: this.now });
  }
  /* R11: the held standards a leg may rest on (reached on first use; the host has built it at start). */
  get standards() { return this.#deps.standards ||= (this.#deps.host ? standardsOf(this.#deps.host) : null); }
  /* R11 (T34-29): whether a `CALC-` is held, visible and accepted (calculations R31), reached on first use. */
  get calculations() { return this.#deps.calculations ||= (this.#deps.host ? calculationsOf(this.#deps.host) : null); }
  /* R58 (T34-29): the set-asides and restores recorded with a question (capture R84), reached on first use. */
  get capture() { return this.#deps.capture ||= (this.#deps.host ? captureOf(this.#deps.host) : null); }
  /** R53: the bias instance a finding's lens is read from, bound once (the first binding holds); null until bound. */
  bindBias(bias) { if (!this.#bias && bias && typeof bias.biasManifest === "function") this.#bias = bias; return this.#bias; }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #promote(pkg) { return this.promotion.promote(pkg); }
  #when() { const w = this.now(); return typeof w === "string" && w ? w : stampInstant("second"); }

  /** The tables, their migrations (with N136's move of the leg count and the superseded-by index off `bundles`, R36)
   *  and the superseded-by backfill (REC-17's boot pass, bounded by the number of `supersedes` edges, which is the
   *  number of divisions anybody has performed). Idempotent: every boot. */
  migrate() {
    migrateInquiry(this.sql);
    if (this.#rows(`PRAGMA table_info(refs)`).length > 0)
      for (const r of this.#rows(`SELECT DISTINCT target_id FROM refs WHERE kind='supersedes'`))
        this.writeSupersededBy(r.target_id);
  }

  /* ---------------------------------------------------------------- facts from later modules (N56, promotion R40) */

  /* A published case's member cannot be divided, re-grouped or set down (R35). Unprovided, it is refused, never false. */
  #caseMemberFact(id) {
    const f = this.promotion.fact("caseMember", id);
    return f.ok ? { member: !!f.value } : { unavailable: f };
  }
  #caseMember(id) {
    const f = this.#caseMemberFact(id);
    /* An unanswered fact counts as a member: the conservative arm, which refuses the act rather than moving a case. */
    return f.unavailable ? true : f.member;
  }
  #publishedRegistry(bundleId, targets) {
    const f = this.promotion.fact("publishedRegistry", bundleId, targets);
    return f.ok ? f.value : null;
  }

  /* ---------------------------------------------------------------- registrations this module offers (K31) */

  /** R21, R25: `reevaluation`'s obligation. `fn({target, cause, since, viewer})` answers the dependents raised. */
  onRaised(module, fn) {
    /* N202: membership's one site of LISTENER_MALFORMED and LISTENER_DECLARED (its R81); a one-registration slot. */
    const refused = listenerRefusal(this.#onRaised, module, fn);
    if (refused) return refused;
    this.#onRaised = { module, fn };
    return { ok: true, module };
  }
  /** R28: `strength`'s pair. `fn(inquiryId)` answers `{capture, connection, testimony?}`, each `{state, grade}`. */
  onGrounded(module, fn) {
    const refused = listenerRefusal(this.#onGrounded, module, fn);
    if (refused) return refused;
    this.#onGrounded = { module, fn };
    return { ok: true, module };
  }
  /** R62 (T42; N834; run-productions R25): the read that says whether a member may cite as hers a passage a machine
   *  proposed. One registration, by any module (membership's `listenerRefusal`, its R81). `fn({legs, author, viewer})`
   *  answers synchronously null (each leg stands) or a refusal. */
  onMachinePassage(module, fn) {
    const refused = listenerRefusal(this.#onMachinePassage, module, fn);
    if (refused) return refused;
    this.#onMachinePassage = { module, fn };
    return { ok: true, module };
  }

  /* R62: asked by R11's check of a promotion of an inquiry by an author who is not a machine, over each leg the revision
     adds or changes against the held document (a leg naming the same passage as a held leg, by target, content row,
     capture and part, whatever its position, is unchanged and never asked). Null when nothing is registered, nothing
     is asked, or `fn` answers null; a refusal from `fn` unchanged; anything else MACHINE_PASSAGE_UNCHECKED. */
  #machinePassageRefusal(bundleId, legs, author) {
    if (!this.#onMachinePassage) return null;
    if (typeof author === "string" && isMachineIdentity(author)) return null;
    const held = new Map();
    let heldText = null;
    try { heldText = this.record.readFile(bundleId, "bundle.md")?.text ?? null; } catch { heldText = null; }
    const heldFm = typeof heldText === "string" ? parseFrontmatter(heldText).data : null;
    for (const [i, l] of (heldFm && Array.isArray(heldFm.basis) ? heldFm.basis : []).entries())
      if (l && typeof l === "object") { const k = passageKey(passageOf(l, i)); held.set(k, (held.get(k) || 0) + 1); }
    const asked = [];
    legs.forEach((l, i) => {
      const p = passageOf(l, i), k = passageKey(p);
      if (held.get(k)) held.set(k, held.get(k) - 1);
      else asked.push(p);
    });
    if (!asked.length) return null;
    const who = typeof author === "string" ? author : null;
    /* DEC-49 REGION is-machine-passage-taken-up */
    let r;
    try { r = this.#onMachinePassage.fn({ legs: asked, author: who, viewer: who }); }
    catch (e) {
      return machinePassageUnchecked(`the read of whether these passages were taken up (${this.#onMachinePassage.module}) `
        + `failed: ${fmSafe(e && e.message ? e.message : e).slice(0, 200)}. Nothing was written.`,
        { legs: asked.map((p) => p.ord) });
    }
    if (r === null) return null;
    if (r && typeof r === "object" && !Array.isArray(r) && typeof r.then !== "function" && r.ok === false
        && typeof r.reason === "string" && r.reason) return r;
    return machinePassageUnchecked(`the read of whether these passages were taken up (${this.#onMachinePassage.module}) `
      + `answered neither null nor a refusal. Nothing was written.`, { legs: asked.map((p) => p.ord) });
    /* END DEC-49 REGION is-machine-passage-taken-up */
  }

  /* The re-evaluation an act raised, `{raised, failed, answer}`, or null when no module is registered to raise it. The
     listener answers the dependents (an array), or an object `{raised, listeners_failed?}` (reevaluation R8), which is
     kept itself as `answer` (N422): reevaluation writes the listeners that failed onto it after the outermost commit
     (its R8, record-core R66), so a copy taken here would miss them under a caller's transaction. A listener that
     throws is named in `failed` itself, and never undoes the act. */
  #raise(target, cause, since, viewer) {
    if (!this.#onRaised) return null;
    try {
      const r = this.#onRaised.fn({ target, cause, since, viewer });
      if (Array.isArray(r)) return { raised: r, failed: [], answer: null };
      if (r && typeof r === "object")
        return { raised: Array.isArray(r.raised) ? r.raised : [], failed: [], answer: r };
      return { raised: [], failed: [], answer: null };
    } catch { return { raised: [], failed: [this.#onRaised.module], answer: null }; }
  }
  /* R42: the `reevaluation` field of an act's answer, over what each raise answered (in order), or the absence. Its
     `listeners_failed` is read when the reply is read (N422), from each raise's own failure and from what each answer
     object names then, each module once; absent while none has failed. */
  static #reevaluation(cause, since, raises) {
    if (raises === null)
      return { reevaluation_absent: word("inquiry.reevaluation_absent") };
    return { reevaluation: liveFailures({ source: cause, since, raised: raises.flatMap((r) => r.raised) }, () => {
      const failed = [];
      for (const r of raises)
        for (const f of [...r.failed, ...(r.answer && Array.isArray(r.answer.listeners_failed) ? r.answer.listeners_failed : [])])
          if (!failed.includes(f)) failed.push(f);
      return failed;
    }) };
  }
  #reevaluationField(target, cause, since, viewer) {
    const r = this.#raise(target, cause, since, viewer);
    return Inquiry.#reevaluation(cause, since, r === null ? null : [r]);
  }
  #strength(id) {
    if (!this.#onGrounded) return null;
    try { return this.#onGrounded.fn(id) || null; } catch { return null; }
  }

  /* D-436 / C-64.1: a creation this act would make cannot name the group that produced it. */
  #groupUndetermined(act, detail) {
    /* DEC-49 REGION is-group-undetermined */
    const row = PROMOTION_ROW_CHECKS.GROUP_UNDETERMINED;
    return { ok: false, reason: "GROUP_UNDETERMINED", code: "GROUP_UNDETERMINED", check: row.check,
             translation: row.translation, act, detail };
    /* END DEC-49 REGION is-group-undetermined */
  }

  /* ---------------------------------------------------------------- R11: the check (promotion R39) */

  /** Refuses a promotion whose document breaks the leg grammar, names an unknown subject, carries a malformed or
   *  unresolved supersession, discloses a division its parent does not record, or would close a basis cycle. Asked
   *  inside the promotion's transaction, before the write. */
  check(c) {
    const { pkg, bundleId, files, promotedType } = stepContext(c);
    /* R59: the held document as it stands before this write, for the projection to tell a revised question from one
       left alone (by projection time the record holds the new bytes) */
    if (c && c.state && c.state.inquiry && c.head && promotedType === "inquiry") {
      try { c.state.inquiry.priorText = this.record.readFile(bundleId, "bundle.md")?.text ?? null; }
      catch { c.state.inquiry.priorText = null; }
    }
    const basisMd = Array.isArray(files) ? files.find((f) => f && f.path === "bundle.md") : null;
    const docFm = basisMd && typeof basisMd.text === "string" ? parseFrontmatter(basisMd.text).data : null;
    const isInquiry = promotedType === "inquiry";
    const basisFm = isInquiry ? docFm : null;
    const basisLegs = basisFm && Array.isArray(basisFm.basis) ? basisFm.basis.filter((l) => l && typeof l === "object") : [];
    const replay = !!(pkg && pkg.replay);
    /* R64 (T48; N1012; K3092, K3102): a divided question's document is closed. `divided` is terminal (R1), so every
       revision of an inquiry whose HELD state is `divided` is refused, whatever it changes and whichever door sends it
       (a sever or reinstatement through `citation`, a leg added, a conclusion, a re-grouping), before any other arm and
       before anything is written. Decided on the held head, never on the revision's bytes. `divide`'s own write of the
       parent moves it from a state that is not `divided` (R24), and its children are creations, so neither is asked; a
       migration replay is not asked, as R11's other judging arms are not. */
    const held = c && c.head;
    if (held && c.base !== null && c.base !== undefined && !replay && normalizeType(held.type) === "inquiry"
        && held.currentState === "divided")
      return this.#dividedClosed(bundleId);
    /* R11 (K681; `inquiry-grammar` R1, R2, R4): the entry arm at the WRITE, judged synchronously by inquiry-grammar's
       own `checkInquiryExtension` over the document: the entry requirements, the division block, the subject's shape and
       the leg grammar, with the published and earned registries injected (C-21.2, REC-18). The version block is
       `basis-versions`' own check at the same write (its R6), not this arm's. Shape refusals honour the replay
       exemption: the record's history must be holdable verbatim. */
    if (basisFm && !replay) {
      const bf = [];
      checkInquiryExtension({ fm: basisFm,
        publishedRegistry: this.#publishedRegistry(bundleId, basisLegs.map((l) => l.target).filter((t) => typeof t === "string")),
        earnedRegistry: this.legEarning.earnedForDoc(basisFm, basisLegs) }, bf);
      const errs = bf.filter((x) => x.severity === "error");
      if (errs.length)
        return { ok: false, reason: "BASIS_REFUSED",
                 findings: errs.map((x) => ({ check: x.check, detail: x.message,
                   /* a code with a catalogue row carries its translation (Terms); a sub-code of C-2.8 with none
                      (the testimony arms) carries its code alone, never an empty key */
                   ...(x.code ? { code: x.code } : {}),
                   ...(x.code && CONTENT_EXTENT_CHECKS[x.code]?.translation
                     ? { translation: CONTENT_EXTENT_CHECKS[x.code].translation } : {}),
                   ...(x.repairs ? { repairs: x.repairs } : {}) })) };
      /* REC-82 / REC-84: the content extent of each leg (content R27), after the grammar so a broken leg is told
         about the leg first. */
      if (basisLegs.length) {
        const cerrs = this.content.citationRefusals(basisLegs, (i) => `basis[${i}]`, this.content.citationPlan(basisLegs));
        if (cerrs.length) return { ok: false, reason: "BASIS_REFUSED", findings: cerrs };
        /* R11 (T33-45; K1447 (ii), (iii)): what the record holds behind a held standard's or a calculation's leg. */
        const hf = this.#heldLegFindings(basisLegs, c.author);
        if (hf.length) return { ok: false, reason: "BASIS_REFUSED", findings: hf };
        /* R61 (D59; inquiry-grammar R18's store-side share): each `bias_applied` statement in force for the inquiry's
           project (or the instance), the acting member as viewer; one not in force, or undetermined, refused */
        const bf2 = this.biasAppliedFindings({ legs: basisLegs, project: basisFm.project, viewer: c.author });
        if (bf2.length) return { ok: false, reason: "BASIS_REFUSED", findings: bf2 };
        /* R62 (N834): a passage a machine proposed stands as the author's only once she took it up (run-productions R25) */
        const mp = this.#machinePassageRefusal(bundleId, basisLegs, c.author);
        if (mp) return mp;
      }
    }
    /* REC-18: a subject entity the registry does not hold. */
    if (isInquiry && docFm && !replay && typeof docFm.subject_entity === "string" && docFm.subject_entity.trim() !== "") {
      const se = docFm.subject_entity.trim();
      if (!this.entities.has(se))
        return { ok: false, reason: "SUBJECT_REFUSED", target: se,
                 findings: [{ check: "C-2.8",
                   detail: localize("inquiry.index.subject_entity_se_does_not", "subject_entity '{se}' does not resolve in this store: an inquiry naming its subject names an entry in the SUBJECT REGISTRY, and this one names a key no entity has. Register the subject with op=entitycreate, or omit subject_entity — an inquiry may name no subject, and then no leg of it earns an A/B/C connection grade (DEC-15).", { se: String(se) }) }] };
    }
    /* REC-16 / R4: the supersession edge (on any document: `supersedes` is in every type's vocabulary) and the
       division disclosure, whose sibling set only the record can complete against the parent's `division.into`. */
    if (docFm && !replay) {
      const sf = [];
      supersedesEdgeFindings(docFm, sf);
      const serrs = sf.filter((x) => x.severity === "error");
      if (serrs.length)
        return { ok: false, reason: "SUPERSESSION_REFUSED", findings: serrs.map((x) => ({ check: x.check, detail: x.message })) };
      for (const r of (Array.isArray(docFm.references) ? docFm.references : [])) {
        if (!r || typeof r !== "object" || r.rel !== "supersedes") continue;
        if (r.target === bundleId)
          return { ok: false, reason: "SUPERSESSION_REFUSED", target: r.target,
                   findings: [{ check: "C-6.1", detail: localize("inquiry.index.bundleid_supersedes_itself_a_question", "{bundleId} supersedes itself: a question cannot be the thing it replaced", { bundleId: String(bundleId) }) }] };
        if (!this.record.bundleInfo(r.target))
          return { ok: false, reason: "SUPERSESSION_REFUSED", target: r.target,
                   findings: [{ check: "C-6.1",
                     detail: localize("inquiry.index.supersedes_target_target_does_not", "supersedes target '{target}' does not resolve in this store: an edge that asserts a lineage must name a question that exists, or it points a reader at nothing while claiming a replacement happened", { target: String(r.target) }) }] };
      }
      const df = [];
      divisionDisclosureFindings(docFm, df);
      const derrs = df.filter((x) => x.severity === "error");
      if (derrs.length)
        return { ok: false, reason: "NO_SIBLING_DISCLOSURE", findings: derrs.map((x) => ({ check: x.check, detail: x.message })) };
      const parentId = typeof docFm.division_parent === "string" && docFm.division_parent !== "null" ? docFm.division_parent : null;
      if (parentId) {
        const pmd = this.record.readFile(parentId, "bundle.md");
        const pfm = pmd && typeof pmd.text === "string" ? (parseFrontmatter(pmd.text).data || {}) : null;
        const into = pfm && pfm.division && Array.isArray(pfm.division.into) ? pfm.division.into.filter((x) => typeof x === "string") : null;
        if (!into || !into.includes(bundleId))
          return { ok: false, reason: "NO_SIBLING_DISCLOSURE", parent: parentId,
                   detail: localize("inquiry.index.parentid_does_not_record_bundleid", "{parentId} does not record {bundleId} as one of the questions it was divided into, so the parent and the child disagree about whether this division happened. A child names a parent that names it back, or the disclosure is a claim nobody can check.", { parentId: String(parentId), bundleId: String(bundleId) }) };
        const declared = new Set(Array.isArray(docFm.division_siblings) ? docFm.division_siblings : []);
        const missing = into.filter((x) => x !== bundleId && !declared.has(x));
        const invented = [...declared].filter((x) => !into.includes(x));
        if (missing.length || invented.length)
          return { ok: false, reason: "NO_SIBLING_DISCLOSURE", parent: parentId, missing, not_siblings: invented,
                   detail: (missing.length
                     ? localize("inquiry.index.this_child_does_not_name", "this child does not name {missing}, which {parentId} was also divided into. A reader who can see one half of a divided inquiry must be able to see that the other half EXISTS (R4). ", { missing: missing.join(", "), parentId: String(parentId) })
                     : "")
                   + (invented.length ? localize("inquiry.index.it_also_names_which_was", "it also names {invented}, which {parentId} was not divided into.", { invented: invented.join(", "), parentId: String(parentId) }) : "") };
      }
    }
    /* R3 / R29: the basis is a DAG, enforced at the write that would close the cycle, naming the path. Not exempt on
       replay: a faithfully replayed history was acyclic when it was written. */
    if (basisLegs.length) {
      /* DEC-49 REGION is-basis-acyclic — C-33.22-23. */
      for (const leg of basisLegs)
        if (leg.target === bundleId)
          return withRow({ ok: false, reason: "SELF_BASIS", path: [bundleId, bundleId],
                           detail: localize("inquiry.index.bundleid_cannot_rest_on_itself", "{bundleId} cannot rest on itself: a question is not evidence for its own answer", { bundleId: String(bundleId) }) });
      const inqTargets = [...new Set(basisLegs
        .filter((l) => typeof l.target === "string" && normalizeType(OBJECT_TYPES[l.target.split("-")[0]]) === "inquiry")
        .map((l) => l.target))];
      /* R29: leg-earning's one cycle walk (its R6) */
      const cycle = this.legEarning.cyclePath(bundleId, inqTargets);
      if (cycle)
        return withRow({ ok: false, reason: "BASIS_CYCLE", path: cycle,
                         detail: localize("inquiry.index.this_write_would_close_a", "this write would close a cycle: {cycle}. An inquiry's basis is a DAG; the chain above already rests on {bundleId}.", { cycle: String(cycle.join(" -> ")), bundleId: String(bundleId) }) });
      /* END DEC-49 REGION is-basis-acyclic */
    }
    /* R47 (N345, C-2.11–C-2.16): the contradiction arm, judged as C-2.8's entry requirements are, so every door that
       writes an inquiry (a take-up, a resolve, basis-versions' `conclude`, a member's own edit) meets it. Each finding
       carries its code and translation, inside BASIS_REFUSED. A replay is exempt, as from every shape arm above. */
    if (isInquiry && docFm && !replay) {
      const cf = contradictionFindings(docFm);
      if (cf.length) return { ok: false, reason: "BASIS_REFUSED", findings: cf };
      /* DEC-49 REGION is-candidate-taken-up — C-2.17: one candidate has one contradiction inquiry. */
      const candidate = candidateOf(docFm);
      const holder = candidate ? this.inquiryOfCandidate(candidate, bundleId) : null;
      if (holder)
        return withRow({ ok: false, reason: "CANDIDATE_ALREADY_TAKEN_UP", code: "CANDIDATE_ALREADY_TAKEN_UP",
                         candidate, inquiry: holder,
                         detail: localize("inquiry.index.the_contradiction_candidate_candidate_is", "the contradiction candidate {candidate} is already taken up as {holder}, and one conflict has one question where it is resolved. Work on it in {holder_2}.", { candidate: String(candidate), holder: String(holder), holder_2: String(holder) }) });
      /* END DEC-49 REGION is-candidate-taken-up */
    }
    return this.#surfacedByCarried(c);
  }

  /* R64: the refusal of a revision of a divided question, naming the children its held document records (its
     `division.into`) as where the work goes on. */
  #dividedClosed(bundleId) {
    let into = [];
    try {
      const md = this.record.readFile(bundleId, "bundle.md");
      const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
      into = fm && fm.division && Array.isArray(fm.division.into) ? fm.division.into.filter((x) => typeof x === "string") : [];
    } catch { into = []; }
    return dividedCannotRestructure(localize("inquiry.index.bundleid_was_divided_v1_and", "{bundleId} was divided{v1}, and its children carry the question on, so its document is closed: no revision of it lands, whatever it changes (a leg severed, reinstated or added, a conclusion, a grouping). Work on the child that carries the part you mean. Nothing was written.", { bundleId: String(bundleId), v1: String(into.length ? ` into ${into.join(", ")}` : "") }), { target: bundleId, ...(into.length ? { children: into } : {}) });
  }

  /* R11 (T33-45): the new leg kinds' record checks, after the grammar (`inquiry-grammar` R13–R15) judged their shape.
     An occurrence whose duty `duties` does not hold, or does not derive, is NO_SUCH_OCCURRENCE (leg-earning R9).
     A `STD-` target the record does not hold, or the promotion's author may not see, is refused as an unknown target
     is; a `target_portion` the standard does not hold is PORTION_UNKNOWN. A `CALC-` target is read through
     `calculations.calcStatusOf` (its R31; T34-29): not held or not visible, NO_SUCH_CALCULATION, the two answered alike
     (DEC-36); held and visible but not accepted, CALCULATION_NOT_ACCEPTED; a read that throws, answers another shape or
     cannot be reached refuses the leg as CALCULATION_NOT_ACCEPTED, never passes it (fail closed, K1601). */
  #heldLegFindings(legs, viewer) {
    const out = [];
    /* an occurrence leg: whether `duties` holds its duty and derives it, read through leg-earning's earned (its R9), once
       for every occurrence the basis names; an occurrence duties answers undetermined is held, and stands */
    const occ = [...new Set(legs.map((l) => (typeof l.target === "string" ? l.target.trim() : ""))
      .filter((t) => parseOccurrenceRef(t) !== null))];
    let derived = {};
    if (occ.length) {
      try { derived = this.legEarning.earned(null, occ)?.earned?.occurrence || {}; } catch { derived = {}; }
    }
    legs.forEach((leg, i) => {
      const t = typeof leg.target === "string" ? leg.target.trim() : "";
      if (/^STD-/.test(t)) {
        let r = null;
        try { r = this.standards ? this.standards.standardRead({ id: t, viewer }) : null; } catch { r = null; }
        if (!r || r.ok !== true)
          out.push({ check: "C-2.8", code: (r && r.reason) || "NO_SUCH_STANDARD", target: t,
                     detail: localize("inquiry.index.basis_i_rests_on_t", "basis[{i}] rests on {t}, which this record does not hold as a standard you may read", { i: String(i), t: String(t) }) });
        else if (typeof leg.target_portion === "string" && (!r.portion || r.portion.path !== leg.target_portion.trim()))
          out.push({ check: "C-2.8", code: "PORTION_UNKNOWN", target: t, portion: leg.target_portion,
                     detail: localize("inquiry.index.basis_i_names_the_portion", "basis[{i}] names the portion '{fmSafe}' of {t}, which that standard does not hold{v1}", { i: String(i), fmSafe: String(fmSafe(leg.target_portion)), t: String(t), v1: String(r.portion ? ` (it holds ${fmSafe(r.portion.path)})` : "") }) });
      } else if (parseOccurrenceRef(t) !== null) {
        const e = derived[t];
        if (!e || (e.determined !== true && e.undetermined_because !== "OCCURRENCE_UNDETERMINED"))
          out.push({ check: "C-2.8", code: "NO_SUCH_OCCURRENCE", target: t,
                     detail: localize("inquiry.index.basis_i_rests_on_t_2", "basis[{i}] rests on {t}, which the record does not hold: {v1}", { i: String(i), t: String(t), v1: String(e && e.why ? e.why
                       : localize("inquiry.index.no_duty_the_record_holds", "no duty the record holds derives it")) }) });
      } else if (CALCULATION_REF_RE.test(t) || /^CALC-/.test(t)) {
        /* R11 (T34-29; N576, N596, K1601, K1639): calculations' synchronous status read (its R31), as the author sees it */
        const s = this.#calcStatus(t, viewer);
        if (s === null)
          out.push({ check: "C-2.8", code: "CALCULATION_NOT_ACCEPTED", target: t,
                     detail: localize("inquiry.index.basis_i_rests_on_the", "basis[{i}] rests on the calculation {t}, and whether it is held, visible to you and accepted could not be read, so the leg is refused rather than passed on trust", { i: String(i), t: String(t) }) });
        else if (!s.held || !s.visible)
          /* DEC-36: a calculation the author may not see is answered exactly as one the record does not hold */
          out.push({ check: "C-2.8", code: "NO_SUCH_CALCULATION", target: t,
                     detail: localize("inquiry.index.basis_i_rests_on_t_3", "basis[{i}] rests on {t}, which this record does not hold as a calculation you may read", { i: String(i), t: String(t) }) });
        else if (!s.accepted)
          out.push({ check: "C-2.8", code: "CALCULATION_NOT_ACCEPTED", target: t,
                     detail: localize("inquiry.index.basis_i_rests_on_the_2", "basis[{i}] rests on the calculation {t}, whose acceptance is not recorded: a calculation is a leg once a member has accepted it", { i: String(i), t: String(t) }) });
      }
    });
    return out;
  }

  /* R61 (D59; K2448, K2472, K2491): every bias application of every leg, read through inquiry-grammar's one encoding
     (`readBiasApplied`, its R18: the numbered scalar keys `bias_<n>_*`), its `statement` asked of
     `bias.statementInForce` (its R49) at the inquiry's project scope (its document's `project`; else the instance),
     `viewer` the promotion's author. An answer of `in_force` false or null, a read that throws or answers another shape,
     and no bias module to ask are each refused through `biasNotInForce`, naming the leg and the statement (fail closed).
     A leg with no application asks nothing; a malformed one is inquiry-grammar R18's to refuse, so only a statement that
     is a non-empty string is asked here. Public, so an act that records a leg asks the same check before it writes; the
     promotion asks it over the document's legs. Answers the findings (empty: every statement in force); never throws. */
  biasAppliedFindings({ legs = [], project = null, viewer = null } = {}) {
    const out = [];
    if (!Array.isArray(legs)) return out;
    project = typeof project === "string" ? project.trim() : "";
    const scope = project ? { type: "project", id: project } : "instance";
    legs.forEach((leg, i) => {
      const applied = readBiasApplied(leg);
      applied.forEach((a, j) => {
        const statement = a && typeof a === "object" && typeof a.statement === "string" ? a.statement.trim() : "";
        if (!statement) return;
        let r = null;
        try {
          r = this.#bias && typeof this.#bias.statementInForce === "function"
            ? this.#bias.statementInForce({ statement, scope, viewer }) : null;
        } catch { r = null; }
        const inForce = r && typeof r === "object" && (r.in_force === true || r.in_force === false) ? r.in_force : null;
        if (inForce !== true)
          out.push(biasNotInForce({ statement, where: `basis[${i}].bias_applied[${j}]`, inForce,
                                    scope: project ? scope : { type: "instance" } }));
      });
    });
    return out;
  }

  /* R11 (calculations R31): `{held, visible, accepted}`, each a boolean, or null when the read cannot be had (no
     calculations module, a throw, or any other shape): the caller fails closed on null. */
  #calcStatus(calcId, viewer) {
    try {
      const calc = this.calculations;
      if (!calc || typeof calc.calcStatusOf !== "function") return null;
      const s = calc.calcStatusOf({ calcId, viewer });
      if (!s || typeof s !== "object" || ["held", "visible", "accepted"].some((k) => typeof s[k] !== "boolean")) return null;
      return { held: s.held, visible: s.visible, accepted: s.accepted };
    } catch { return null; }
  }

  /* R50 (REC-179 / C-66.5, INVESTIGATIVE-SESSION.md §11 item 5, rule 2's reach): A REVISION CARRIES `surfaced_by`
     FORWARD. The field records the surfacing act, decided once at the trust boundary on the creation (D-78's restamp;
     REC-173's verified replay keeps the Drive era's), so without this a revision relabelled the question and the
     surfacing row then contradicted the bytes it describes. Asked of every revision of a bundle whose CURRENT version
     is an inquiry, after the compare-and-swap (so the head is the version this revision is based on) and before any
     write. Both sides are read by the record's own parser, never a line scan a caller can step around, so a respelling
     of the same value lands and a different value is refused in either direction. An absent field and an unreadable
     document are values too. `replay` is no exemption: it is a caller's assertion (only a creation is verified as a
     replay, REC-173). Moved from legacy-store's share of every promotion (T19 layer 6). */
  #surfacedByCarried(c) {
    const { bundleId, base, files, head } = stepContext(c);
    if (!head || base === null || normalizeType(head.type) !== "inquiry") return null;
    const surfacedOf = (text) => {
      if (typeof text !== "string") return "unreadable";
      /* No catch: the parser does not throw on a string; a document it cannot read comes back `data: null`. */
      const fm = parseFrontmatter(text).data;
      if (!fm || typeof fm !== "object") return "unreadable";
      return Object.prototype.hasOwnProperty.call(fm, "surfaced_by") ? JSON.stringify(fm.surfaced_by) : "absent";
    };
    const held = this.record.readFile(bundleId, "bundle.md");
    const next = Array.isArray(files) ? files.find((f) => f && f.path === "bundle.md") : null;
    const was = surfacedOf(held ? held.text : null);
    const now = surfacedOf(next ? next.text : null);
    /* DEC-49 REGION is-promote-surfaced-by */
    if (was !== now) {
      const row = INQUIRY_SURFACE_CHECKS.SURFACED_BY_REWRITTEN;
      return { ok: false, reason: "SURFACED_BY_REWRITTEN", code: "SURFACED_BY_REWRITTEN", check: row.check,
               translation: row.translation, bundleId, current: was, revision: now,
               detail: localize("inquiry.index.the_current_version_of_bundleid", "the current version of {bundleId} records surfaced_by {was}, and this revision records {now}. Who surfaced a question is recorded once, at its creation; a revision carries it forward unchanged. Nothing was written.", { bundleId: String(bundleId), was: String(was), now: String(now) }) };
    }
    /* END DEC-49 REGION is-promote-surfaced-by */
    return null;
  }

  /* ---------------------------------------------------------------- R12: the projection (promotion R39) */

  /** In the promotion's transaction: the superseded-by index, `inquiry_basis` whole from `basis[]` with each document
   *  leg's content row, `inquiry_exclusions` from `completeness_excluded[]`, the leg count and subject entity, and a
   *  migration replay's row. The answer's keys join the promotion's. A leg on an imported finding reference (N522) is
   *  projected with its ref as `target_id`, as spelled, and no content row: content's plan reads it as no document. */
  project(c) {
    const { pkg, bundleId, meta, promotedType } = stepContext(c);
    const cur = c.head, docFm = c.docFm, isInquiry = promotedType === "inquiry";
    const basisFm = isInquiry ? docFm : null;
    const basisLegs = basisFm && Array.isArray(basisFm.basis) ? basisFm.basis.filter((l) => l && typeof l === "object") : [];
    /* REC-17: the supersedes targets this revision REPLACED (connections R19), the ones it holds now, and this
       bundle's own row (a bundle created after something already superseded it). */
    for (const t of new Set([...refsReplacedOf(c, "supersedes"),
                             ...this.#rows(`SELECT target_id FROM refs WHERE bundle_id=? AND kind='supersedes'`, bundleId)
                               .map((r) => r.target_id),
                             bundleId]))
      this.writeSupersededBy(t);

    /* REC-82 / IC-83: the prior referent of each leg, read before the delete and carried forward when the leg still
       names the SAME target and extent (and capture, when it names one, REC-220): the record never moves an authored
       edge's target without a member's act (Bob, 2026-09-14). Keyed by (target, extent), never by ord: a member who
       reorders their basis has not re-pointed anything. */
    const priorContent = new Map(), priorContentAt = new Map();
    const priorRows = this.#rows(
      `SELECT b.target_id AS t, b.content_id AS cid, c.extent AS ext, c.capture_sha AS cap
         FROM inquiry_basis b LEFT JOIN content c ON c.content_id = b.content_id
        WHERE b.bundle_id=? AND b.content_id IS NOT NULL`, bundleId);
    for (const r of priorRows)
      if (r.ext != null) {
        priorContent.set(`${r.t}\u0000${r.ext}`, r.cid);
        if (r.cap != null) priorContentAt.set(`${r.t}\u0000${r.ext}\u0000${r.cap}`, r.cid);
      }
    const contentProjected = [];
    const contentPlan = isInquiry ? this.content.citationPlan(basisLegs) : new Map();
    /* R12, R29 (K1505 (2)): the legs as rows, written whole through leg-earning's one write of `inquiry_basis` (its R12),
       which derives each row's target type; a promotion of anything else writes none, clearing any it held. */
    const rows = [];
    if (isInquiry) {
      for (let i = 0; i < basisLegs.length; i++) {
        const leg = basisLegs[i];
        if (typeof leg.target !== "string") continue;   // a replayed malformed shape: unprojectable
        /* The leg's referent: named outright (taken at its word, REC-84), carried forward, or minted (`plane`) over the
           capture content resolves. A null is stated, never a row invented to fill the column. */
        let rowId = null, carriedRow = false, minted = false, undetermined = null;
        const cp = contentPlan.get(i);
        if (cp && cp.isInfo) {
          const ext = cp.extent;
          const named = legContentId(leg);
          if (named) rowId = named;
          else {
            const held = cp.authored
              ? priorContentAt.get(`${leg.target}\u0000${canonicalExtent(ext)}\u0000${cp.captureSha}`)
              : priorContent.get(`${leg.target}\u0000${canonicalExtent(ext)}`);
            if (held) { rowId = held; carriedRow = true; }
            else if (cp.captureSha) {
              const mint = this.content.mint({ bundleId: leg.target, captureSha: cp.captureSha, extent: ext,
                mintedBy: CONTENT_MINTED_BY_PLANE, at: (meta && meta.last_updated) || null, ctx: cp.ctx });
              if (mint.ok) { rowId = mint.content_id; minted = mint.minted; undetermined = mint.undetermined || null; }
            }
          }
          if (rowId)
            contentProjected.push({ ord: i, target: leg.target, content_id: rowId, extent_kind: ext.kind, minted,
                                    carried: carriedRow, ...(undetermined ? { undetermined } : {}) });
        }
        rows.push({ ord: i, target: leg.target, role: leg.role, grade: leg.grade, grade_axis: leg.grade_axis,
                    grade_source: leg.grade_source, note: leg.note,
                    /* the document's own authored date, never the server's clock */
                    at: leg.date,
                    /* REC-42: the OR branch exactly as authored; absent is the implicit single ground, never invented */
                    ground: leg.ground, content_id: rowId });
      }
    }
    const written = this.legEarning.writeBasis(bundleId, rows);
    /* the standing of each referent, in ONE pass over the ids the loop collected */
    if (contentProjected.length) this.content.projectStandings(contentProjected);

    /* REC-14 / C-9: the exclusions, whole, by the same delete-then-insert discipline. */
    this.sql.exec(`DELETE FROM inquiry_exclusions WHERE bundle_id=?`, bundleId);
    if (isInquiry && basisFm && Array.isArray(basisFm.completeness_excluded)) {
      const comp = (basisFm.completeness && typeof basisFm.completeness === "object") ? basisFm.completeness : {};
      for (let i = 0; i < basisFm.completeness_excluded.length; i++) {
        const row = basisFm.completeness_excluded[i];
        if (!row || typeof row !== "object") continue;
        this.sql.exec(
          `INSERT INTO inquiry_exclusions (bundle_id,ord,edition,target_id,description,reason,author,at)
           VALUES (?,?,?,?,?,?,?,?)`,
          bundleId, i, Number.isInteger(basisFm.edition) ? basisFm.edition : null,
          typeof row.target === "string" ? row.target : null,
          typeof row.description === "string" ? row.description : "",
          typeof row.reason === "string" ? row.reason : "",
          typeof comp.author === "string" ? comp.author : "",
          typeof comp.at === "string" ? comp.at : "");
      }
    }
    /* REC-18: the leg count and the declared subject, from the same parsed bytes. */
    if (isInquiry) {
      const n = written && written.ok ? written.written : 0;
      const subject = basisFm && typeof basisFm.subject_entity === "string" && basisFm.subject_entity.trim()
        ? basisFm.subject_entity.trim() : null;
      /* R36, R40 (N136): the count and the subject in this module's own table, R40's read contract. */
      this.sql.exec(`INSERT INTO ${BUNDLE_FACTS} (bundle_id, inquiry_basis_count, inquiry_subject_entity) VALUES (?,?,?)
                     ON CONFLICT(bundle_id) DO UPDATE SET inquiry_basis_count=excluded.inquiry_basis_count,
                       inquiry_subject_entity=excluded.inquiry_subject_entity`, bundleId, n, subject);
    }
    /* R48 (N345): the contradiction link, its resolution while the document is concluded, and `explores`, re-derived
       whole from the document; no row for a plain inquiry. */
    this.sql.exec(`DELETE FROM inquiry_contradiction_links WHERE bundle_id=?`, bundleId);
    if (isInquiry && docFm) {
      const candidate = candidateOf(docFm), explores = exploresOf(docFm);
      if (candidate || explores) {
        const resolution = candidate && docFm.current_state === "concluded" ? readResolution(docFm.resolution) : null;
        this.sql.exec(`INSERT INTO inquiry_contradiction_links (bundle_id, candidate, resolution, explores, at) VALUES (?,?,?,?,?)`,
          bundleId, candidate, resolution ? JSON.stringify(resolution) : null, explores ? JSON.stringify(explores) : null,
          this.#when());
      }
    }
    /* REC-173: a creation admitted as a migration replay records its capture and promotion key, in its own transaction. */
    let migrated = null;
    const surfacing = typeof pkg.assistantPrincipal === "string" && pkg.assistantPrincipal.trim();
    if (!cur && isInquiry && !surfacing && pkg.migrationReplay && typeof pkg.migrationReplay === "object"
        && typeof pkg.migrationReplay.capture === "string" && pkg.migrationReplay.capture) {
      const ts = new Date().toISOString();
      const promotionKey = typeof pkg.migrationReplay.promotion === "string" ? pkg.migrationReplay.promotion : null;
      this.sql.exec(`INSERT INTO inquiry_migration_replays (bundle_id, capture_sha, promotion_key, at) VALUES (?,?,?,?)`,
        bundleId, pkg.migrationReplay.capture, promotionKey, ts);
      migrated = { capture: pkg.migrationReplay.capture, promotion: promotionKey, at: ts };
    }
    /* R59 (D13): the warning on a creation or a revision of the question naming a person in no public role, recorded
       with her choice; nothing is refused. */
    const warned = isInquiry && docFm && !pkg.replay ? this.#personWarningAt(bundleId, cur, docFm, c, pkg) : null;
    /* R54: the dated waits, re-derived from the document's recheck triggers. */
    if (isInquiry && docFm) this.#projectWaits(bundleId, docFm, c.author, this.#setIn(pkg && pkg.setIn, c.author));
    /* R53 (A9, bias R40): a finding, when the document enters `concluded` stating its project. */
    if (isInquiry && docFm && docFm.current_state === "concluded" && !(cur && cur.currentState === "concluded"))
      this.#recordFinding(bundleId, docFm, c.author, !!pkg.replay);
    /* R44 (N149): the member-browser agent, recorded at the creation from the control plane's stamp, never after. */
    const agent = !cur && isInquiry && !pkg.replay ? agentOf(pkg.memberUserAgent) : null;
    if (agent)
      this.sql.exec(`INSERT OR IGNORE INTO inquiry_member_agents (bundle_id, user_agent, at) VALUES (?,?,?)`,
        bundleId, agent, this.#when());
    return { ...(migrated ? { migration_replay: migrated } : {}),
             ...(contentProjected.length ? { content: contentProjected } : {}),
             ...(warned ? { warning: warned } : {}) };
  }

  /* R59 (D13; K2480): asked at a promotion of an inquiry that creates it, or revises its question (its `## Question`, or
     its title when it has none) or its subject entity. The warning is answered and recorded (`inquiry_person_warnings`)
     with her choice: `went_on` when the package says she saw it before the act (`personWarningSeen: true`), else
     `warned_at_act`; a machine's promotion records `pending`, and the next promotion of the question by a member (her
     taking it up) carries that warning to her and records her choice, even when it does not revise the question. Never
     throws into the promotion: a test that cannot be read warns of nothing. */
  #personWarningAt(bundleId, cur, fm, c, pkg) {
    try {
      const author = typeof c.author === "string" ? c.author.trim() : "";
      const machine = !author || isMachineIdentity(author);
      const questionOf = (text) => {
        if (typeof text !== "string") return "";
        const q = inquiryQuestionOf(text);
        if (typeof q === "string" && q.trim()) return q.trim();
        const f = parseFrontmatter(text).data;
        return f && typeof f.title === "string" ? f.title : "";
      };
      const next = Array.isArray(c.files) ? c.files.find((f) => f && f.path === "bundle.md") : null;
      const nextQ = questionOf(next && next.text);
      const subject = typeof fm.subject_entity === "string" && fm.subject_entity.trim() ? fm.subject_entity.trim() : null;
      let asked = !cur;
      if (cur) {
        const held = c.state && c.state.inquiry ? c.state.inquiry.priorText : undefined;
        const was = typeof held === "string" ? held : null;
        const wasFm = was ? parseFrontmatter(was).data || {} : {};
        const wasSubject = typeof wasFm.subject_entity === "string" && wasFm.subject_entity.trim() ? wasFm.subject_entity.trim() : null;
        asked = questionOf(was) !== nextQ || wasSubject !== subject;
      }
      let warning = asked ? personWarning({ text: nextQ, entities: this.personFacts({ text: nextQ, subject, viewer: author }),
                                            viewer: machine ? null : author }) : null;
      if (!warning && !machine) {
        /* a machine's proposal not yet taken up: the latest row of the question is a pending one */
        const last = this.#one(`SELECT persons, choice FROM inquiry_person_warnings WHERE bundle_id=? ORDER BY warning_id DESC LIMIT 1`, bundleId);
        if (last && last.choice === "pending") {
          const persons = safeJson(last.persons);
          const row = INQUIRY_WARNINGS.PERSON_IN_NO_PUBLIC_ROLE;
          if (Array.isArray(persons) && persons.length)
            warning = { code: "PERSON_IN_NO_PUBLIC_ROLE", key: row.key, translation: row.translation, persons, viewer: author,
                        proposed_by_machine: true };
        }
      }
      if (!warning) return null;
      const choice = machine ? "pending" : pkg && pkg.personWarningSeen === true ? "went_on" : "warned_at_act";
      this.sql.exec(`INSERT INTO inquiry_person_warnings (bundle_id, at, by, persons, choice) VALUES (?,?,?,?,?)`,
        bundleId, this.#when(), author || null, JSON.stringify(warning.persons), choice);
      return { ...warning, choice };
    } catch { return null; }
  }

  /** R63 (T42; N837), R59 (D13; K2479, K2480): the record's facts for the persons `text` and `subject` may name, for `personWarning`:
   *  the subject entity, every `ENT-` id written in the text, and every entity whose live alias is a run of the text's
   *  words (at most `PERSON_NAME_WORDS_MAX` words a run, over its first `PERSON_TEXT_WORDS_MAX` words), through
   *  `entities.entitiesByAlias` (its R6); each person among them `{entity_id, kind, label, public_role, named: true}`,
   *  `public_role` true when `lines` holds, not withdrawn, a line of `PUBLIC_ROLE_LINES` from it (an office it holds,
   *  is responsible for or acts for; a government body it belongs to or sits on). An id the record does not hold, or not
   *  a person, is left out; a read that fails leaves what was found standing. Writes nothing; never throws. */
  personFacts(args = {}) {
    const { text = "", subject = null, viewer = null } = args && typeof args === "object" ? args : {};
    const ids = new Set();
    try {
      if (typeof subject === "string" && subject.trim()) ids.add(subject.trim());
      for (const m of (typeof text === "string" ? text : "").matchAll(ENTITY_ID_IN_TEXT)) ids.add(m[0]);
      /* R63: the text's words as written (split on white space), each asked both as written and with the punctuation at
         its edges trimmed ("sign?" is "sign"), since entities folds an alias keeping its inner punctuation ("J. Roe",
         "the master's deputy") and only white space and case (its R6) */
      const words = (typeof text === "string" ? text : "").normalize("NFC").split(/\s+/).filter(Boolean)
        .slice(0, PERSON_TEXT_WORDS_MAX);
      const trimmed = words.map((x) => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
      const ents = this.entities;
      const tried = new Set();
      if (ents && typeof ents.entitiesByAlias === "function")
        for (let i = 0; i < words.length; i++)
          for (let n = 1; n <= PERSON_NAME_WORDS_MAX && i + n <= words.length; n++)
            for (const run of new Set([trimmed.slice(i, i + n).filter(Boolean).join(" "), words.slice(i, i + n).join(" ")])) {
              const key = run.toLowerCase();
              if (!run || tried.has(key)) continue;
              tried.add(key);
              let r = null;
              try { r = ents.entitiesByAlias({ alias: run, viewer }); } catch { r = null; }
              for (const e of (r && Array.isArray(r.entities) ? r.entities : []))
                if (e && e.kind === "person" && typeof e.entity_id === "string") ids.add(e.entity_id);
            }
    } catch { /* what was found stands */ }
    const out = [];
    for (const id of [...ids].sort()) {
      let e = null;
      try { e = this.#one(`SELECT entity_id, kind, label FROM entities WHERE entity_id=?`, id); } catch { e = null; }
      if (!e || e.kind !== "person") continue;
      out.push({ entity_id: e.entity_id, kind: e.kind, label: e.label, public_role: this.#publicRole(id), named: true });
    }
    return out;
  }

  /* R59: whether `lines` holds, not withdrawn, a public-role line from the person (PUBLIC_ROLE_LINES); false when the
     record holds no such line (a store with no lines table holds none). */
  #publicRole(id) {
    try {
      const rows = this.#rows(`SELECT l.kind, e.kind AS to_kind, e.entity_id AS to_id FROM lines l
                                 JOIN entities e ON e.entity_id = l.to_entity
                                WHERE l.from_entity=? AND l.withdrawn=0`, id);
      for (const r of rows) {
        if (r.to_kind === "office" && PUBLIC_ROLE_LINES.office.includes(r.kind)) return true;
        if (r.to_kind === "body" && PUBLIC_ROLE_LINES.government_body.includes(r.kind)) {
          let sector = null;
          try { sector = this.entities.readEntity({ entityId: r.to_id })?.entity?.sector ?? null; } catch { sector = null; }
          if (sector === "government") return true;
        }
      }
      return false;
    } catch { return false; }
  }

  /* R53: the question's finding and the project lens in force as it was made, read as an internal read (a machine
     viewer, `INTERNAL_VIEWER`), never as the founder's: the founder is blind to a hidden project it is neither invited
     nor joined to (membership R43, D54; K2442), and the lens of a finding is the project's whatever any member sees. A lens that cannot be read (no bias bound, or its read fails) and a replayed
     conclusion (not made now) record no lens; none in force records that none was. Never throws into the promotion. */
  #recordFinding(bundleId, fm, author, replay) {
    const project = typeof fm.project === "string" ? fm.project.trim() : "";
    if (!project) return;
    let state = "unreadable", sha = null;
    if (!replay && this.#bias)
      try {
        const m = this.#bias.biasManifest({ scope: "project", scopeId: project, viewer: INTERNAL_VIEWER, limit: 1 });
        if (m && m.in_force === true && typeof m.statements_sha === "string") { state = "recorded"; sha = m.statements_sha; }
        else if (m && m.in_force === false) state = "none";
      } catch { /* unreadable: no lens recorded */ }
    const who = MEMBER_AUTHOR.exec(typeof author === "string" ? author : "");
    this.sql.exec(`INSERT INTO inquiry_findings (bundle_id, project_id, lens_state, lens_sha, principal, at) VALUES (?,?,?,?,?,?)
                   ON CONFLICT(bundle_id) DO UPDATE SET project_id=excluded.project_id, lens_state=excluded.lens_state,
                     lens_sha=excluded.lens_sha, principal=excluded.principal, at=excluded.at`,
      bundleId, project, state, sha, who ? who[1] : null, this.#when());
  }

  /** R53 (A9, bias R40): this module's findings as bias's work products (bias R33), offered under kind `finding`. A
   *  finding is a question's conclusion, made under the lens of the project its document states: every question with
   *  a recorded finding (R12's row), and every concluded question stating a project that has none (concluded before
   *  findings were recorded), keyed `finding:<id>` and listed ascending. `read` answers its context (the project), its
   *  member principal, the lens in force as it was made (`{basis: "at_open", statements_sha}`, bias's comparison of a
   *  lens recorded in force, under which a lens since withdrawn has moved too), or null where no project lens was
   *  recorded (undetermined, never filled in), no re-run link, and `registered` (when it was made, null when not
   *  recorded); `visible` is the question's own sight (R33). */
  workProducts() {
    const idOf = (key) => (typeof key === "string" && key.startsWith(FINDING_KEY) ? key.slice(FINDING_KEY.length) : "");
    return {
      list: (after, limit) => this.#rows(
        `SELECT bundle_id FROM (SELECT bundle_id FROM inquiry_findings UNION SELECT bundle_id FROM bundles
           WHERE object_type='inquiry' AND current_state='concluded' AND COALESCE(project, '') <> '')
          WHERE bundle_id > ? ORDER BY bundle_id LIMIT ?`,
        idOf(String(after ?? "")) || "", Math.max(1, Math.floor(Number(limit) || 50))).map((r) => FINDING_KEY + r.bundle_id),
      read: async (key) => {
        const id = idOf(key);
        const info = id ? this.record.bundleInfo(id) : null;
        if (!info) return null;
        const f = this.#one(`SELECT * FROM inquiry_findings WHERE bundle_id=?`, id);
        const project = f ? f.project_id : info.project;
        if (!project) return null;
        return { context: { type: "project", id: project }, principal: f ? f.principal ?? null : null,
                 lens: f && f.lens_state === "recorded" && f.lens_sha ? { basis: "at_open", statements_sha: f.lens_sha } : null,
                 ranUnder: null, rerunOf: null, registered: f ? f.at : null };
      },
      visible: async (key, viewer) => { const id = idOf(key); return !!id && this.membership.inSight(id, viewer) === true; },
    };
  }

  /** R12, R16: ONE bundle's superseded-by index from the `supersedes` edges pointing at it (connections' `refs`), the
   *  ids comma-joined and sorted, NULL when nothing supersedes it, held in this module's table (R36). An id with no
   *  bundle is a no-op. */
  writeSupersededBy(targetId) {
    if (!targetId) return null;
    const ids = this.#rows(`SELECT bundle_id FROM refs WHERE target_id=? AND kind='supersedes' ORDER BY bundle_id`, targetId)
      .map((r) => r.bundle_id);
    const v = ids.length ? ids.join(",") : null;
    if (v === null) this.sql.exec(`UPDATE ${BUNDLE_FACTS} SET inquiry_superseded_by=NULL WHERE bundle_id=?`, targetId);
    else this.sql.exec(`INSERT INTO ${BUNDLE_FACTS} (bundle_id, inquiry_superseded_by)
                        SELECT bundle_id, ? FROM bundles WHERE bundle_id=?
                        ON CONFLICT(bundle_id) DO UPDATE SET inquiry_superseded_by=excluded.inquiry_superseded_by`, v, targetId);
    return ids;
  }

  /** R16: the ids that supersede `id`, from the index. */
  supersededBy(id) {
    return supersededByOf(this.#one(`SELECT inquiry_superseded_by FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, id));
  }

  /** R18 (publication R12 reads it): the exclusions naming `targetId` the viewer may see, each with its inquiry, edition,
   *  description, reason, author and date, in (inquiry, ord) order. Every one is answered; they are read a page at a
   *  time, at most `STALE_PAGE` rows per statement (N183). An absent viewer fails closed. */
  exclusionsNaming(targetId, viewer = null) {
    if (!targetId) return [];
    const gate = viewerPredicate(viewer);
    const out = [];
    for (let bid = "", ord = -1; ;) {
      const page = this.#rows(
        `SELECT x.bundle_id, x.ord, x.edition, x.description, x.reason, x.author, x.at, b.current_state, b.title
           FROM inquiry_exclusions x JOIN bundles b ON b.bundle_id = x.bundle_id
          WHERE x.target_id=? AND (${gate.sql}) AND (x.bundle_id > ? OR (x.bundle_id = ? AND x.ord > ?))
          ORDER BY x.bundle_id, x.ord LIMIT ?`, targetId, ...gate.args, bid, bid, ord, STALE_PAGE);
      out.push(...page);
      if (page.length < STALE_PAGE) return out;
      ({ bundle_id: bid, ord } = page[page.length - 1]);
    }
  }

  /** R19 (D-592): the inquiry's state transitions from its own `state_history`, each with who took it and when (a
   *  reopening is written there by promotion's `reopen`). */
  stateHistory(id, viewer = undefined) {
    if (!id) return { ok: false, reason: "NO_ID" };
    if (viewer !== undefined && !this.membership.inSight(id, viewer)) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    const info = this.record.bundleInfo(id);
    if (!info) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
    if (normalizeType(info.type) !== "inquiry") return { ok: false, reason: "NOT_AN_INQUIRY", target: id };
    const md = this.record.readFile(id, "bundle.md");
    const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
    if (!fm || typeof fm !== "object") return { ok: false, reason: "NO_DOCUMENT", target: id };
    const rows = Array.isArray(fm.state_history) ? fm.state_history.filter((r) => r && typeof r === "object") : [];
    return { ok: true, id, transitions: rows.map((r) => ({
      at: r.timestamp ?? null, from: r.from_state ?? null, to: r.to_state ?? null,
      by: r.author ?? null, reason: r.blurb ?? null })),
      /* R60 (H38): a read of a question to a viewer answers the projects R14 shows her; the in-process call names none */
      ...(viewer !== undefined ? this.#projectsField(id, viewer) : {}) };
  }

  /** R48 (N345): the inquiry's recorded `{candidate, resolution, explores}` as its latest promotion projected them, with
   *  `resolution` null unless the document was concluded; null for a plain inquiry. Not gated; for in-process callers
   *  (`contradiction`). Never throws. */
  contradictionLink(id) {
    try {
      if (!id || typeof id !== "string") return null;
      const r = this.#one(`SELECT candidate, resolution, explores FROM inquiry_contradiction_links WHERE bundle_id=?`, id);
      if (!r) return null;
      return { candidate: r.candidate ?? null, resolution: safeJson(r.resolution), explores: safeJson(r.explores) };
    } catch { return null; }
  }

  /** R48 (N345): the one inquiry whose document names `candidate`, or null (`except` leaves one inquiry out: R11's
   *  one-candidate rule asks it of every inquiry but the one being written). Not gated; never throws. */
  inquiryOfCandidate(candidate, except = null) {
    try {
      if (typeof candidate !== "string" || !CANDIDATE_RE.test(candidate)) return null;
      const r = this.#one(`SELECT bundle_id FROM inquiry_contradiction_links WHERE candidate=? AND bundle_id IS NOT ?
                            ORDER BY bundle_id LIMIT 1`, candidate, except);
      return r ? r.bundle_id : null;
    } catch { return null; }
  }

  /** R44: the member-browser agent recorded when the inquiry was created (the control plane's stamp, N149; a division's
   *  children carry their parent's), else the one its own document records (`member_user_agent`, trimmed), or null:
   *  never a default, which would be an invented client (capture-requests reads it, its R3, R14). */
  memberUserAgent(id) {
    try {
      if (!id || typeof id !== "string") return null;
      const rec = this.#one(`SELECT user_agent FROM inquiry_member_agents WHERE bundle_id=?`, id);
      if (rec && rec.user_agent) return rec.user_agent;
      const md = this.record.readFile(id, "bundle.md");
      const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
      const ua = fm && typeof fm === "object" ? fm.member_user_agent : null;
      return typeof ua === "string" && ua.trim() !== "" ? ua.trim() : null;
    } catch { return null; }
  }

  /** N405 (REC-173, INVESTIGATIVE-SESSION.md §11 item 5): the `surfaced_in` of a question whose creation was a
   *  server-verified MIGRATION REPLAY (R12's row), surfaced in the Drive era and not inside a run on this plane: said in
   *  words, with the capture and promotion the replay named. Null for any other bundle; the rest of `surfaced_in` is
   *  ai-runs' (its R27). Registered as this module's decoration of retrieval's single-bundle answer (its R56). Not gated
   *  (the answer it decorates is); never throws. */
  migratedSurfacing(id) {
    try {
      if (!id || typeof id !== "string") return null;
      const mig = this.#one(`SELECT capture_sha, promotion_key, at FROM inquiry_migration_replays WHERE bundle_id=?`, id);
      return mig ? { recorded: false, stated: word("inquiry.stated.recorded_migrated_drive"), run: null, lens: null,
                     migrated: { capture: mig.capture_sha, promotion: mig.promotion_key ?? null, at: mig.at } } : null;
    } catch { return null; }
  }

  /* ---------------------------------------------------------------- R54–R57: dated waits on an inquiry */

  /** R54 (scheduler R9): the notice a dated wait's setting raises, for `scheduler` to arm its alarm by; one registration
   *  (membership's `listenerRefusal`). `fn({inquiry, date, set_by})` is told after a promotion sets or re-dates a wait. */
  onWaitSet(module, fn) {
    const refused = listenerRefusal(this.#onWaitSet, module, fn);
    if (refused) return refused;
    this.#onWaitSet = { module, fn };
    return { ok: true, module };
  }

  /* R54: inside the promotion's transaction. Each recheck trigger carrying a calendar date is a wait. A held wait whose
     text and date the document still states keeps who set it and when (its position and description follow the
     document); one whose text is still stated under another date ends `redated`, and the new date is a new wait set by
     this promotion's author; one no longer stated ends `removed`. Ended waits are kept, with who and when. */
  #projectWaits(bundleId, fm, author, setIn = null) {
    const triggers = Array.isArray(fm.recheck_triggers) ? fm.recheck_triggers : [];
    const stated = [];
    triggers.forEach((t, i) => {
      if (!t || typeof t !== "object" || Array.isArray(t)) return;
      const date = typeof t.date === "string" ? t.date.trim() : "";
      if (!isCalendarDate(date) || typeof t.text !== "string" || !t.text.trim()) return;
      stated.push({ idx: i, text: t.text, description: typeof t.description === "string" ? t.description : "", date });
    });
    const held = this.#rows(`SELECT wait_id, text, date FROM inquiry_dated_waits WHERE bundle_id=? AND ended IS NULL
                             ORDER BY wait_id`, bundleId);
    const when = this.#when(), who = setterOf(author);
    const kept = new Set(), set = [];
    for (const w of stated) {
      const same = held.find((h) => !kept.has(h.wait_id) && h.text === w.text && h.date === w.date);
      if (same) {
        kept.add(same.wait_id);
        this.sql.exec(`UPDATE inquiry_dated_waits SET idx=?, description=? WHERE wait_id=?`, w.idx, w.description, same.wait_id);
        continue;
      }
      const moved = held.find((h) => !kept.has(h.wait_id) && h.text === w.text
                                && !stated.some((x) => x.text === h.text && x.date === h.date));
      if (moved) {
        kept.add(moved.wait_id);
        this.sql.exec(`UPDATE inquiry_dated_waits SET ended='redated', ended_by=?, ended_at=?, idx=NULL WHERE wait_id=?`,
          who, when, moved.wait_id);
      }
      this.sql.exec(`INSERT INTO inquiry_dated_waits (bundle_id, idx, text, description, date, set_by, set_at, set_in)
                     VALUES (?,?,?,?,?,?,?,?)`, bundleId, w.idx, w.text, w.description, w.date, who, when, setIn);
      set.push({ inquiry: bundleId, date: w.date, set_by: who });
    }
    for (const h of held)
      if (!kept.has(h.wait_id))
        this.sql.exec(`UPDATE inquiry_dated_waits SET ended='removed', ended_by=?, ended_at=?, idx=NULL WHERE wait_id=?`,
          who, when, h.wait_id);
    if (this.#onWaitSet) for (const n of set) { try { this.#onWaitSet.fn(n); } catch { /* never undoes the promotion */ } }
  }

  /* R54 (T41; K2480): the project the promoting act named (the package's `setIn`, which the control plane stamps from
     the request's project context), kept only when it names a project the author may see; else none. Never throws. */
  #setIn(named, author) {
    try {
      const p = typeof named === "string" ? named.trim() : "";
      if (!p) return null;
      const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, p);
      return b && b.object_type === "project" && this.membership.inSight(p, author) === true ? p : null;
    } catch { return null; }
  }

  /* R55, R57: the profile's time zone (the active jurisdiction view's `time_zone`), or null when none is held: a wait's
     day is never read as the UTC day. */
  #zone() {
    let view = null;
    try {
      if (this.#view) view = this.#view();
      else {
        const ids = this.record.getSetting("jurisdiction_profiles");
        const c = Array.isArray(ids) && ids.length ? combineProfiles(ids) : null;
        view = c && c.ok ? c.view : null;
      }
    } catch { view = null; }
    let g = null; /* K5292 (jurisdictions R98): the team's governing zone first */
    try { g = governingZone(this.record.getSetting("jurisdiction_profiles"), this.record.getSetting("team_time_zone")); } catch { g = null; }
    const z = g || (view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null);
    if (!z) return null;
    const probe = localDay("2026-01-01T00:00:00Z", z);
    return typeof probe === "string" ? z : null;
  }
  #day(instant, zone) {
    if (!zone || typeof instant !== "string") return null;
    try { const d = localDay(instant, zone); return typeof d === "string" ? d : null; } catch { return null; }
  }

  /* The open waits, each with its inquiry's state, set by `setBy` (or every setter), read whole. */
  #openWaits(setBy = null) {
    return this.#rows(`SELECT w.*, b.current_state FROM inquiry_dated_waits w JOIN bundles b ON b.bundle_id = w.bundle_id
                        WHERE w.ended IS NULL ${setBy ? "AND w.set_by=?" : ""} ORDER BY w.date, w.bundle_id, w.idx`,
                      ...(setBy ? [setBy] : []));
  }

  /** R55: the waits `member` set on inquiries `viewer` may see, each with its text and description as written, its date
   *  and its state as of `asOf`: `waiting` before its date, `due` from the start of that local day in the profile's zone,
   *  `looked` once its setter recorded a look, `ended` when the inquiry is concluded, divided or dismissed, and
   *  `undetermined` (with why) while no zone is held. Only the member who set a wait is answered it. Writes nothing;
   *  never throws. */
  datedWaits({ member = null, asOf = null, viewer = null } = {}) {
    try {
      const m = memberStamp(member);
      if (!m || typeof viewer !== "string" || !viewer.startsWith("member:") || memberStamp(viewer) !== m) return { ok: true, member: m, waits: [] };
      const zone = this.#zone();
      const at = typeof asOf === "string" && asOf ? asOf : this.#when();
      const today = this.#day(at, zone);
      const waits = [];
      for (const w of this.#openWaits(m)) {
        if (!this.membership.inSight(w.bundle_id, viewer)) continue;
        const state = WAIT_ENDING_STATES.includes(w.current_state) ? "ended"
          : w.looked_at ? "looked"
          : today === null ? "undetermined"
          : today >= w.date ? "due" : "waiting";
        waits.push({ inquiry: w.bundle_id, index: w.idx, text: w.text, description: w.description, date: w.date,
                     set_by: w.set_by, set_at: w.set_at, set_in: w.set_in ?? null, state,
                     ...(state === "looked" ? { looked_at: w.looked_at, ...(w.look_note ? { note: w.look_note } : {}) } : {}),
                     ...(state === "ended" ? { inquiry_state: w.current_state } : {}),
                     ...(state === "undetermined"
                       ? { why: word("inquiry.why.time_zone_held") } : {}) });
      }
      return { ok: true, member: m, as_of: at, zone, waits };
    } catch { return { ok: true, member: memberStamp(member), waits: [] }; }
  }

  /** R55 (T41; D17; K2480): every open dated wait on `question` to any `viewer` who may see it (R33: else answered
   *  exactly as an absent question, no waits), each with its text, description and date, its state as of `asOf`
   *  (`waiting`, `due`, `ended` or `undetermined` as R55 states them; a look is the setter's own and is not answered
   *  here), the setter's handle (`members.handle`, membership R120; null for a setter with none, a machine), and the
   *  project it was set in, `{id, name}`, only while that project is discoverable (membership R85) and the viewer's
   *  sight of it is not NONE (R44): otherwise no `set_in`, exactly as for a wait set in no project. The answer also
   *  carries R58's for that question, `document_waits` and `history`, as `documentWaits` gives them (`null` both, with
   *  `document_waits_why`, when capture's read cannot be read), and `projects` (R60, leg-earning R14). R55's due notice and R56's look stay the setter's alone. Writes nothing; never
   *  throws. */
  questionWaits(args = {}) {
    const { question = null, viewer = null, asOf = null } = args && typeof args === "object" ? args : {};
    const absent = { ok: true, question: typeof question === "string" ? question : null, waits: [] };
    try {
      if (typeof question !== "string" || !question || typeof viewer !== "string" || !viewer.trim()) return absent;
      const b = this.#one(`SELECT object_type, current_state FROM bundles WHERE bundle_id=?`, question);
      if (!b || normalizeType(b.object_type) !== "inquiry" || this.membership.inSight(question, viewer) !== true) return absent;
      const zone = this.#zone();
      const today = this.#day(typeof asOf === "string" && asOf ? asOf : this.#when(), zone);
      const ended = WAIT_ENDING_STATES.includes(b.current_state);
      const waits = this.#rows(`SELECT w.idx, w.text, w.description, w.date, w.set_by, w.set_at, w.set_in, m.handle
                                  FROM inquiry_dated_waits w LEFT JOIN members m
                                    ON 'member:' || m.member_id = w.set_by
                                 WHERE w.bundle_id=? AND w.ended IS NULL ORDER BY w.idx, w.wait_id`, question)
        .map((w) => {
          const state = ended ? "ended" : today === null ? "undetermined" : today >= w.date ? "due" : "waiting";
          const shown = this.#projectShownByName(w.set_in, viewer);
          return { index: w.idx, text: w.text, description: w.description, date: w.date, state,
                   set_by_handle: typeof w.handle === "string" && w.handle ? w.handle : null, set_at: w.set_at,
                   ...(shown ? { set_in: shown } : {}), ...(ended ? { inquiry_state: b.current_state } : {}) };
        });
      const set = this.documentWaits({ questions: [question], viewer }).questions?.[0] ?? null;
      return { ok: true, question, zone, waits,
               document_waits: set ? set.waits : [], history: set ? set.history : [],
               ...(set && set.state === "undetermined" ? { document_waits_why: set.why } : {}),
               ...this.#projectsField(question, viewer) };
    } catch { return absent; }
  }

  /* R55 (D17): a project as `{id, name}` while it is discoverable and the viewer's sight of it is not NONE, else null. */
  #projectShownByName(projectId, viewer) {
    if (typeof projectId !== "string" || !projectId) return null;
    try {
      if (this.membership.visibilityOf(projectId) !== "discoverable") return null;
      if (this.membership.sight(projectId, viewer) === Membership.SIGHT_NONE) return null;
      const r = this.#one(`SELECT title FROM bundles WHERE bundle_id=?`, projectId);
      return r ? { id: projectId, name: r.title ?? null } : null;
    } catch { return null; }
  }

  /** R60 (H38): `{projects}` for question `id` read by `viewer` (leg-earning R14's answer for her), as every read of a
   *  question here answers it; `{projects: null, projects_undetermined}` when it cannot be read. Never throws. */
  projectsOf(id, viewer) { return this.#projectsField(id, viewer); }

  /* R60 (H38): the `projects` field of a read answering a question to `viewer`: leg-earning R14's answer for that viewer,
     `{projects, projects_truncated?}`, or `{projects: null, projects_undetermined}` when it cannot be read (never an
     empty list in its place). */
  #projectsField(question, viewer) {
    const r = this.#projectsShown(question, viewer);
    if (r === null)
      return { projects: null, projects_undetermined: word("inquiry.projects_undetermined") };
    return { projects: r.projects, ...(r.truncated ? { projects_truncated: true } : {}) };
  }

  /** R56: the wait's setter records that they looked, with the instant; it reads `looked` until a later revision sets a
   *  new date. Refusals: `MACHINE_CANNOT_LOOK`, `NO_SUCH_WAIT` (absent, or on an inquiry `by` may not see, one answer),
   *  `NOT_YOUR_WAIT`, `BAD_NOTE`. It writes the look and nothing else, and moves nothing in the inquiry. */
  waitLook({ inquiry = null, index = null, note = null, by = null } = {}) {
    const who = typeof by === "string" ? by.trim() : "";
    if (!who || isMachineIdentity(who))
      return { ok: false, reason: "MACHINE_CANNOT_LOOK",
               detail: localize("inquiry.index.a_look_at_a_dated", "a look at a dated wait is the setter's own act: a member signed in, never a machine credential.") };
    const idx = Number(index);
    const w = typeof inquiry === "string" && inquiry && Number.isInteger(idx)
      ? this.#one(`SELECT * FROM inquiry_dated_waits WHERE bundle_id=? AND idx=? AND ended IS NULL`, inquiry, idx) : null;
    if (!w || !this.membership.inSight(w.bundle_id, who))
      return { ok: false, reason: "NO_SUCH_WAIT", inquiry, index,
               detail: localize("inquiry.index.no_dated_wait_is_held", "no dated wait is held at that position on that question.") };
    if (w.set_by !== memberStamp(who))
      return { ok: false, reason: "NOT_YOUR_WAIT", inquiry, index,
               detail: localize("inquiry.index.a_dated_wait_is_its", "a dated wait is its setter's own: only the member who set it records that they looked.") };
    if (note !== null && note !== undefined && (typeof note !== "string" || note.length > LOOK_NOTE_MAX))
      return { ok: false, reason: "BAD_NOTE", detail: localize("inquiry.index.a_looks_note_is_text", "a look's note is text of at most {LOOK_NOTE_MAX} characters.", { LOOK_NOTE_MAX: String(LOOK_NOTE_MAX) }) };
    const at = this.#when();
    this.sql.exec(`UPDATE inquiry_dated_waits SET looked_by=?, looked_at=?, look_note=? WHERE wait_id=?`,
      who, at, typeof note === "string" && note.trim() ? note.trim() : null, w.wait_id);
    return { ok: true, inquiry: w.bundle_id, index: w.idx, date: w.date, looked_at: at, state: "looked" };
  }

  /* R57: the waits the scheduler's consumer may mark: open, on an inquiry still worked, not looked at, not yet marked. */
  #markable() {
    return this.#openWaits().filter((w) => !WAIT_ENDING_STATES.includes(w.current_state) && !w.looked_at && !w.marked_day);
  }

  /** R57 (scheduler R21): whether any wait reaches `due` on or before `now`'s local day and is not yet marked. */
  datedWaitsDue(now) {
    try {
      const today = this.#day(now, this.#zone());
      return today !== null && this.#markable().some((w) => w.date <= today);
    } catch { return false; }
  }

  /** R57: the start of the next local day after `now`'s holding an unmarked wait, or null. */
  datedWaitsWake(now) {
    try {
      const zone = this.#zone(), today = this.#day(now, zone);
      if (today === null) return null;
      const next = this.#markable().map((w) => w.date).filter((d) => d > today).sort()[0];
      if (!next) return null;
      const r = dayRange(next, next, zone);
      return r && typeof r.start === "string" ? r.start : null;
    } catch { return null; }
  }

  /** R57: marks each newly due wait once (a second tick on the same day marks nothing) and answers those it marked. */
  datedWaitsTick(now) {
    try {
      const today = this.#day(now, this.#zone());
      if (today === null) return { marked: [] };
      const at = this.#when(), marked = [];
      for (const w of this.#markable().filter((x) => x.date <= today)) {
        this.sql.exec(`UPDATE inquiry_dated_waits SET marked_day=?, marked_at=? WHERE wait_id=? AND marked_day IS NULL`,
          today, at, w.wait_id);
        marked.push({ inquiry: w.bundle_id, index: w.idx, date: w.date, set_by: w.set_by });
      }
      return { marked };
    } catch { return { marked: [] }; }
  }

  /* ---------------------------------------------------------------- R58: a document a question waits on, set aside */

  /** R58 (T34-29; N587; DEC-141 (3), (4), K1618, K1645): for each id of `questions` (at most `DOCUMENT_WAITS_MAX`, read
   *  once each, in the order given) naming an inquiry `viewer` may see, the wait "a document it waits on was set aside",
   *  read through `capture.heldActsOf` (its R84): `waits`, one `{document, by, reason, at}` per document whose latest
   *  act recorded with the question is a set-aside and is set aside now, that set-aside's, oldest first; and `history`,
   *  every set-aside and restore recorded with the question, in order. A question at an ending state (R55's) answers its
   *  history and no wait. An id naming no inquiry, or one the viewer may not see, is left out exactly as an absent one;
   *  no viewer answers nothing (R33). A read of capture's that fails answers the question `undetermined`, with why, never
   *  as no wait. It is never a queue item, a notification, a scheduler's or a notice-producer's (DEC-94, K1618). Writes
   *  nothing; never throws. */
  documentWaits(args = {}) {
    try {
      const { questions = null, viewer = null } = args && typeof args === "object" ? args : {};
      if (typeof viewer !== "string" || !viewer.trim()) return { ok: true, questions: [] };
      const ids = [...new Set((Array.isArray(questions) ? questions : []).filter((q) => typeof q === "string" && q))];
      if (ids.length > DOCUMENT_WAITS_MAX)
        return { ok: false, reason: "TOO_MANY_QUESTIONS", bound: DOCUMENT_WAITS_MAX, asked: ids.length,
                 detail: localize("inquiry.index.a_call_reads_the_waits", "a call reads the waits of at most {DOCUMENT_WAITS_MAX} questions; ask the list in parts. Nothing was read.", { DOCUMENT_WAITS_MAX: String(DOCUMENT_WAITS_MAX) }) };
      const out = [];
      for (const id of ids) {
        const b = this.#one(`SELECT bundle_id, object_type, current_state FROM bundles WHERE bundle_id=?`, id);
        if (!b || normalizeType(b.object_type) !== "inquiry" || this.membership.inSight(id, viewer) !== true) continue;
        out.push({ ...this.#documentWait(id, b.current_state, viewer), ...this.#projectsField(id, viewer) });
      }
      return { ok: true, questions: out };
    } catch { return { ok: true, questions: [] }; }
  }

  /* R58: one question's wait and history, read whole from capture page by page (its R84's bound). */
  #documentWait(id, inquiryState, viewer) {
    const undetermined = (why) => ({ question: id, inquiry_state: inquiryState, state: "undetermined", waits: null,
                                     history: null, why });
    let capture = null;
    try { capture = this.capture; } catch { capture = null; }
    if (!capture || typeof capture.heldActsOf !== "function")
      return undetermined(word("inquiry.undetermined.documents_set_aside"));
    const acts = [], setAside = new Map();
    for (let after = null, pages = 0; ; pages++) {
      let r;
      try { r = capture.heldActsOf({ question: id, viewer, limit: HELD_ACTS_PAGE, after }); } catch { r = null; }
      if (!r || r.ok !== true || !Array.isArray(r.acts))
        return undetermined(word("inquiry.undetermined.documents_set_aside_question",
          { r: r && typeof r.reason === "string" ? ` (${r.reason})` : "" }));
      acts.push(...r.acts.filter((a) => a && typeof a === "object"));
      for (const d of (Array.isArray(r.documents) ? r.documents : []))
        if (d && typeof d.document === "string") setAside.set(d.document, d.set_aside === true);
      if (!r.truncated || typeof r.next !== "string" || !r.next) break;
      if (pages >= HELD_ACTS_PAGES_MAX)
        return undetermined(word("inquiry.undetermined.question_history_set"));
      after = r.next;
    }
    const history = acts.map((a) => ({ document: a.document, act: a.act, reason: a.reason ?? null, by: a.author ?? null,
                                       at: a.at ?? null }));
    const latest = new Map();
    for (const h of history) latest.set(h.document, h);
    if (WAIT_ENDING_STATES.includes(inquiryState))
      return { question: id, inquiry_state: inquiryState, state: "ended", waits: [], history };
    const waits = [...latest.values()].filter((h) => h.act === "set_aside" && setAside.get(h.document) === true)
      .map((h) => ({ document: h.document, by: h.by, reason: h.reason, at: h.at }))
      .sort((x, y) => (String(x.at) < String(y.at) ? -1 : String(x.at) > String(y.at) ? 1 : 0));
    return { question: id, inquiry_state: inquiryState, state: waits.length ? "waiting" : "none", waits, history };
  }

  /** R52 (1) (K861, plane R10): this module's share of the instance's figures, exported for `plane` to register under
   *  this module's name through `record-core` R63 (`registerCounts("inquiry", Inquiry.COUNT_KEYS, (hid) =>
   *  k.counts(hid))`); plane registers it under this module's name, and the module registers nothing itself. */
  static COUNT_KEYS = Object.freeze(["inquiryMigrationReplays"]);

  /** R52 (1), D-464 (A COUNT IS TAKEN THROUGH THE CALLER'S OWN SIGHT): `record-core` R63's `counts(hid)` for this
   *  module's share, registered by plane under this module's name. `inquiryMigrationReplays` is the rows of
   *  `inquiry_migration_replays` (REC-173) less those whose `bundle_id` is in `hid`, membership's `hiddenBundles`
   *  (`{sql, args}`), or null for a viewer that sees every bundle and for the direct internal call, which count whole.
   *  `COALESCE(k, '')`: a NULL key names no bundle, and `NULL NOT IN (…)` is NULL, which would drop the row. A figure
   *  whose table cannot be read is left out, and R63 answers it null, never zero. Synchronous; writes nothing; never
   *  throws. */
  counts(hid = null) {
    const out = {};
    try {
      out.inquiryMigrationReplays = hid
        ? this.#one(`SELECT count(*) AS c FROM inquiry_migration_replays WHERE COALESCE(bundle_id, '') NOT IN ${hid.sql}`,
            ...hid.args).c
        : this.#one(`SELECT count(*) AS c FROM inquiry_migration_replays`).c;
    } catch { /* unread: R63 answers it null */ }
    return out;
  }

  /** R52 (2) (K861, plane R10; retrieval R55): the leg grades `retrieval`'s `registerLegGrades` takes, for `plane` to
   *  register as `inquiry` (through `inquiryLegGrades(host)`). For legs `{grade, target_id}`, R13's `earned` is asked
   *  once, with no subject entity, over the list's distinct targets, and each leg, in order, answers R14's `legCapped`
   *  of its grade against its target's earned capture ceiling (null for a target with none). An empty list, or anything
   *  that is not a list, answers an empty list without asking. */
  legGrades(legs) {
    if (!Array.isArray(legs) || !legs.length) return [];
    const cap = this.legEarning.earned(null, [...new Set(legs.map((l) => l && l.target_id))])?.earned?.capture || {};
    return legs.map((l) => (l && Object.hasOwn(cap, l.target_id) ? legCapped(l.grade, cap[l.target_id], l.target_id) : null));
  }

  /** R17, R11 (`inquiry-grammar` R1, R2): the entry requirements over one document, judged by record-grammar's
   *  `checkBundle` with the type grammars later modules registered with record-core (its `grammars()`), as promotion's
   *  gate judges a bundle (its R27), so a grammar registered there judges an inquiry here as it does there. A slot of
   *  `inquiry-grammar`'s that no registration claims (a record nothing registered it with) is filled by its own arm
   *  (`INQUIRY_GRAMMARS`), so the inquiry is never left unjudged. A grammar whose arm throws is one error of its own,
   *  naming its module; a record that cannot answer its registrations is an error, never read as none. Never throws. */
  async checkEntry(bundleMd, opts = {}) {
    let grammars;
    try {
      grammars = this.record.grammars().map((g) => ({ module: g.module, ids: g.ids, arm: async (ctx, found) => {
        try { await g.arm(ctx, found); }
        catch (e) {
          found.push({ check: g.module, severity: "error",
                       message: word("inquiry.message.grammar_threw_judged",
                         { module: g.module, e: fmSafe(e && e.message ? e.message : e).slice(0, 200) }) });
        }
      } }));
    } catch (e) {
      return [{ check: "C-2.8", severity: "error",
                message: word("inquiry.message.registered_grammars_read",
                  { e: fmSafe(e && e.message ? e.message : e).slice(0, 200) }) }];
    }
    const claimed = new Set(grammars.flatMap((g) => (Array.isArray(g.ids) ? g.ids : [])));
    grammars = [...grammars, ...INQUIRY_GRAMMARS.filter((g) => !g.ids.some((id) => claimed.has(id)))];
    return checkInquiryEntry(bundleMd, { ...(opts && typeof opts === "object" ? opts : {}), grammars });
  }

  /* ---------------------------------------------------------------- content R41: a re-read that staled rows */

  /** Registered on content's `onStale`: the legs resting on each affected or undetermined row (and, past the notice's
   *  bound, on the capture's stale rows after `ungraded_after`) are told through `onRaised`, cause `restaled`; with
   *  none registered, the answer names them and nothing is written. Runs in content's transaction, so it never throws. */
  staled(notice) {
    try {
      const ids = new Set((Array.isArray(notice && notice.rows) ? notice.rows : [])
        .map((r) => r && r.content_id).filter((x) => typeof x === "string" && x));
      /* N183: the capture's stale rows past the bound, and then the legs, each read a page at a time (at most
         STALE_PAGE rows per statement) until every one is read. */
      if (notice && notice.ungraded && notice.ungraded_after)
        for (let after = String(notice.ungraded_after); ;) {
          const page = this.#rows(`SELECT content_id FROM content WHERE capture_sha=? AND stale=1 AND content_id > ?
                                    ORDER BY content_id LIMIT ?`, notice.capture_sha, after, STALE_PAGE);
          for (const r of page) ids.add(r.content_id);
          if (page.length < STALE_PAGE) break;
          after = page[page.length - 1].content_id;
        }
      if (!ids.size) return { citing: [] };
      const citing = [];
      const list = JSON.stringify([...ids]);
      for (let bid = "", ord = -1; ;) {
        const page = this.#rows(
          `SELECT bundle_id, ord, target_id, content_id FROM inquiry_basis
            WHERE content_id IN (SELECT value FROM json_each(?)) AND (bundle_id > ? OR (bundle_id = ? AND ord > ?))
            ORDER BY bundle_id, ord LIMIT ?`, list, bid, bid, ord, STALE_PAGE);
        citing.push(...page);
        if (page.length < STALE_PAGE) break;
        ({ bundle_id: bid, ord } = page[page.length - 1]);
      }
      const since = this.#when();
      const told = [];
      let raises = [];
      for (const id of [...new Set(citing.map((l) => l.bundle_id))]) {
        const r = this.#raise(id, "restaled", since, null);
        if (r === null) { raises = null; break; }
        told.push({ inquiry: id, raised: r.raised });
        raises.push(r);
      }
      return { citing, told, since, ...(raises ? Inquiry.#reevaluation("restaled", since, raises) : {}) };
    } catch { return { citing: [], failed: true }; }
  }


  /* S-11 step 3: bulk disposition of inquiries (né Problems, né Focuses),
   * weight `refuse`.
   *
   * The first selection-backed action to move an OBJECT's state rather than an
   * edge's. Steps 1 and 2 edited a Project's `references` block; this edits
   * `current_state` on each selected inquiry, which is heavier: an edge is a
   * claim about a relationship, and a state is a claim about where the group's
   * thinking has got to.
   *
   * WEIGHT `refuse`, hard-coded exactly as `cite` hard-codes `report`. The whole
   * set moves or none of it does, because a half-run bulk state change leaves
   * the operator unable to know which half ran.
   *
   * ONLY `deferred` AND `dismissed`. Every other inquiry state is entered by
   * its own act with its own entry requirements (REC-13/14/16 bring them),
   * never by a bulk state flip. Refused by name rather than by omission, so
   * the operator learns why.
   *
   * THE REASON IS NOT POLITENESS. C-2.8 requires a non-empty
   * `disposition_reason` for both target states, so a disposition without one
   * produces a bundle the catalog rejects. Refusing here is the difference
   * between refusing a write and writing something that fails its own checks. */
  dispose(args = {}) { return withRow(this.#dispose(args || {})); }
  #dispose({ handle, to, reason = "", viewer = null, owner = null, author = null } = {}) {
    /* DISPOSITIONS is progressions' one list (its R35), and a word outside it is answered by progressions'
       `notADisposition`, the one site that mints NOT_A_DISPOSITION with its row, C-100.20 (N285, K275): this act
       holds neither a literal of its own nor the row. */
    /* Legal transitions, IMPORTED from the catalog's own table (REC-10). The
       comment here used to claim exactly that over a literal second copy of
       the machine; DATA-MODEL.md §2.7 caught the claim being false, and this
       import is what makes it true. deferred->deferred is absent, which is
       what makes a stale view a refusal rather than a silent no-op. */
    const INQUIRY_STATES = STATES.inquiry.legal;
    const LEGAL = STATES.inquiry.edges;

    if (!INQUIRY_STATES.includes(to))
      return { ok: false, reason: "BAD_TARGET_STATE", to, legal: INQUIRY_STATES,
               detail: localize("inquiry.index.an_inquirys_state_is_one", "an inquiry's state is one of {INQUIRY_STATES}", { INQUIRY_STATES: String(INQUIRY_STATES.join(", ")) }) };
    /* R20 (N285): the one answer to a word that is no disposition, minted in `progressions.notADisposition`. */
    const undisposed = notADisposition(to);
    if (undisposed) return undisposed;

    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("inquiry.index.c_2_8_requires_a", "C-2.8 requires a non-empty disposition_reason for deferred and dismissed, so a disposition with no reason would produce a record the catalog rejects.") };
    if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: localize("inquiry.index.a_reason_is_at_most", "a reason is at most {EDGE_REASON_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { EDGE_REASON_MAX: String(EDGE_REASON_MAX) }) };

    const sel = this.retrieval.selectionResolve({ handle, viewer, owner, weight: "refuse" });
    if (!sel.ok) return sel;
    if (!sel.members.length)
      return { ok: false, reason: "EMPTY_SELECTION", handle, drift: sel.drift,
               detail: localize("inquiry.index.this_selection_resolves_to", "this selection resolves to no members, so there is nothing to dispose") };

    /* Refused WHOLE, offenders named, never narrowed to the valid subset. The
       operator picked a set; disposing part of it decides something they did
       not. Same rule cite applies to a selection carrying a non-Information. */
    const offenders = [], illegal = [], published = [];
    for (const id of sel.members) {
      const b = this.#one(`SELECT object_type, current_state FROM bundles WHERE bundle_id=?`, id);
      /* Judged by the NORMALIZED type through the catalog's own map, so a
         legacy `focus` or `problem` row (should one predate the boot
         normaliser) and a canonical `inquiry` row answer the same way. */
      if (!b || normalizeType(b.object_type) !== "inquiry") { offenders.push(id); continue; }
      /* ==== CASE-4 / DEC-72: A PUBLISHED CASE CANNOT BE QUIETLY SET DOWN, AND
         THIS GUARD EXISTS BECAUSE THE RULE LOST ITS CARRIER RATHER THAN BECAUSE
         ANYONE CHANGED IT.
         The catalog's STATES comment has said it since REC-14, in these words:
         *"DELIBERATELY NOT ADDED: `published -> deferred|dismissed`. Ageing is
         what happens to a finding NOBODY published (D-79); a published case
         cannot quietly stop being worked on, because it is already out in the
         world."* The enforcement was the EDGE TABLE — `published` had no
         disposition edges — and under DEC-72 a case member sits at `concluded`,
         which does carry them (REC-13's rule that a conclusion nobody published
         still ages). So without this, publishing a case would become the way to
         make it deferrable, and D-79's ruling would be reversed by a lifecycle
         change nobody read as reversing it.
         REFUSED BY NAME rather than as a generic ILLEGAL_TRANSITION, on
         PUBLISHED_CANNOT_DIVIDE's precedent: the two say different things to a
         member, and "this is not a legal move in the table" would be false here
         — the move IS in the table, and what forbids it is the case relation. */
      if (this.#caseMember(id)) { published.push({ id, from: b.current_state }); continue; }
      if (!(LEGAL[b.current_state] || []).includes(to)) illegal.push({ id, from: b.current_state });
    }
    /* DEC-49 REGION is-dispose-inquiries — REC-64/C-33.13. The kind check alone;
       the transition check below refuses with a code eight sites mint. */
    if (offenders.length)
      /* né NOT_PROBLEMS: REC-10's one wire change inside this op (DATA-MODEL
         §2.7 change 13 — the refusal stops naming a construct that no longer
         exists). */
      return { ok: false, reason: "NOT_INQUIRIES", offenders: offenders.sort(),
               detail: localize("inquiry.index.disposition_moves_an_inquirys_state", "disposition moves an inquiry's state, and this selection carries something else. The set is refused whole rather than narrowed to the inquiries in it.") };
    /* END DEC-49 REGION is-dispose-inquiries */
    /* CASE-4 / DEC-72. Before the generic transition refusal, for
       PUBLISHED_CANNOT_DIVIDE's reason: a member told the move is illegal would
       go looking at the state table and find the edge sitting right there. */
    if (published.length)
      return { ok: false, reason: "PUBLISHED_CANNOT_BE_SET_DOWN", to,
               offenders: published.sort((a, b) => a.id < b.id ? -1 : 1),
               detail: localize("inquiry.index.a_finding_that_is_a", "a finding that is a member of a published case cannot be deferred or dismissed. AGEING IS WHAT HAPPENS TO A FINDING NOBODY PUBLISHED (D-79): a question the team quietly stopped working is indistinguishable from one that was never asked, which is why it is made visible rather than left to vanish. A published case is already out in the world and cannot stop being worked on quietly — a reader is holding it. What IS available is the route DEC-12 built: reopen it (op=reopen), and let the next edition say what changed.") };
    if (illegal.length)
      return { ok: false, reason: "ILLEGAL_TRANSITION", to, offenders: illegal.sort((a, b) => a.id < b.id ? -1 : 1),
               detail: localize("inquiry.index.these_are_not_legal_moves", "these are not legal moves in the catalog's state table. A move to the state something is already in usually means the view was taken before someone else's disposition, so it is refused rather than treated as a no-op.") };

    /* REC-17 / D-5: THE WALK-BACK EDGES, and the criterion is the corpus's own
       rather than a preference. `SB-CORE.md:1507` says retire is "the existing
       TERMINAL transition, which already refuses on a downstream consequence
       (CITED) rather than on the actor", and that is the whole rule:
       **terminal acts on a cited inquiry REFUSE with CITED; reversible acts
       raise the re-evaluation OBLIGATION.** `dismissed` is terminal in the
       sense that matters here — the question is ABANDONED, and nothing succeeds
       it — so an inquiry a live basis leg still reasons from is refused, with
       the offenders named and the DOCUMENT PATH'S OWN REMEDY WORDING
       (SB-CORE.md:944-949, which retire's CITED already words). `deferred` is
       reversible and is NOT refused: it raises the obligation below.
       NO NEW MECHANISM AND NO NEW REFUSAL NAME — this is retire's `CITED` over
       REC-11's reverse index, which is why it is one lookup and not a walk.
       A PUBLISHED dependent counts here, and that is the point rather than a
       side effect: its basis is frozen inside a signed edition, so if the
       question beneath it is abandoned its panel names a question nobody will
       ever answer while its frozen strength still reads. That is the harm this
       item's second negative control produces on purpose. */
    if (to === "dismissed") {
      const cited = [];
      for (const id of sel.members) {
        const rests = this.legEarning.restsOnLive(id);
        if (rests.all.length) cited.push({ id, citedBy: rests.all });
      }
      if (cited.length)
        return { ok: false, reason: "CITED", to, offenders: cited.sort((a, b) => a.id < b.id ? -1 : 1),
                 detail: localize("inquiry.index.live_basis_legs_still_rest", "live basis legs still rest on these questions. Dismissing one abandons it, and a claim resting on an abandoned question would go on reading at a strength nobody will ever re-examine — the downstream consequence retire already refuses on. Withdraw those legs first (sever the citation with a reason), or DEFER instead: deferring is reversible and raises the re-evaluation obligation on every dependent rather than stranding it.") };
    }

    /* R39 (K2371, K2436; H10, H38): DEFERRAL AND DISMISSAL ARE EACH PROJECT'S OWN ACT on its own relationship to a
       question, taken through `queue`'s `op=proposedispose` project arm (its R27); this shared act moves the question's
       own state only. A member a project SHOWN to the caller draws on (`leg-earning.projectsShownOn`, its R14: a
       drawing project that is not hidden) is not moved: the set is refused naming each such member and, as data, the
       projects R14 shows her, never a hidden one. A member drawn on only by hidden projects, or by none, is moved on its
       own state, the answer the same either way (each hidden project's own relationship stands, H10). Nothing here
       counts the drawing projects, and no outcome depends on how many there are. A read of R14 that fails refuses the
       set as undetermined, naming no project and saying nothing about whether any draws (fail closed). `divide` and
       `ground` stay shared acts, because they change what the question is. */
    /* DEC-49 REGION is-dispose-drawn-on */
    const drawn = [], unread = [];
    for (const id of sel.members) {
      const shown = this.#projectsShown(id, viewer);
      if (shown === null) { unread.push(id); continue; }
      if (shown.projects.length)
        drawn.push({ id, projects: shown.projects, ...(shown.truncated ? { truncated: true } : {}) });
    }
    if (unread.length)
      return { ok: false, reason: "PROJECTS_UNDETERMINED", to, offenders: unread.sort(),
               detail: localize("inquiry.index.which_projects_draw_on_these", "which projects draw on these questions could not be read, so whether this shared act would move a question a project works on is not known, and nothing was moved. Try again.") };
    if (drawn.length)
      return withRow({ ok: false, reason: "DRAWN_ON_BY_A_PROJECT", code: "DRAWN_ON_BY_A_PROJECT", to,
                       offenders: drawn.sort((x, y) => (x.id < y.id ? -1 : 1)),
                       detail: "a project draws on these questions, and each project sets a question aside for itself "
                             + "(op=proposedispose), which leaves it as it is everywhere else. Nothing was moved." });
    /* END DEC-49 REGION is-dispose-drawn-on */

    const when = this.#when();
    const disposed = [];
    /* R22: THE WHOLE SET MOVES OR NONE OF IT DOES. Every member's promotion runs inside ONE record-core transaction
       (its R32: a nested promotion joins it), so a refusal after the first rolls back every member already moved. */
    const refusal = this.record.transact(() => {
      for (const id of sel.members) {
        const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
        const cur = this.#one(`SELECT bundle_sha, current_state FROM bundles WHERE bundle_id=?`, id);
        if (!liveMd || liveMd.content === null)
          return { ok: false, reason: "NO_DOCUMENT", bundleId: id,
                   detail: localize("inquiry.index.this_inquiry_has_no_readable", "this inquiry has no readable bundle.md, so its state cannot be moved; nothing was moved") };
        /* C-4.2: prior_state obliges a state_history ENTRY (timestamp, from_state, to_state, blurb, author). */
        let text = appendStateHistory(liveMd.content, {
          timestamp: when, from_state: cur.current_state, to_state: to, blurb: why, author: author || "member" });
        if (!text)
          return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", bundleId: id,
                   detail: localize("inquiry.index.this_documents_state_history_block", "this document's state_history block is not in a shape this grammar can extend in place, and a disposition that recorded no transition would leave prior_state pointing at a history the document does not carry (C-4.2); nothing was moved") };
        text = setScalar(text, "prior_state", cur.current_state);
        text = setScalar(text, "current_state", to);
        /* D-169: setOrAdd, because C-2.8 requires the reason and an intake document may carry no such line. */
        text = setOrAddScalar(text, "disposition_reason", `"${why}"`);
        text = setScalar(text, "last_updated", `"${when}"`);
        /* C-13.2: a moved last_updated has a Session Log entry. */
        text = appendSessionLog(text,
          localize("inquiry.index.session_when_v1_v2_trigger", "### Session {when} | {v1} | {v2}\nTrigger: selection {handle}\nChanges: state {current_state} to {to}. Reason: {why}.\n", { when: String(when), v1: String(to === "deferred" ? "Deferred" : "Dismissed"), v2: String(author || "member"), handle: String(handle), current_state: String(cur.current_state), to: String(to), why: String(why) }));
        const fm = parseFrontmatter(text).data || {};
        const promoted = this.#promote({
          bundleId: id, base: cur.bundle_sha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
          author: author || "member",
          files: [mdFile(text), ...carriedFiles(this.sql, id)],
          meta: { object_type: "inquiry", title: fm.title, current_state: to, prior_state: cur.current_state,
                  created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
        });
        if (!promoted.ok) return { ...promoted, bundleId: id, detail: localize("inquiry.index.v1_the_set_moves_whole", "{v1}The set moves whole or not at all, so nothing was moved.", { v1: String(promoted.detail ? promoted.detail + " " : "") }) };
        disposed.push(id);
      }
      return null;
    });
    if (refusal) return refusal;
    /* REC-17 / D-5, the OTHER half: a REVERSIBLE act raises the obligation (R21), a query derived from the state this
       act just moved and told to the actor; nothing is written to the dependents. `dismissed` raises none: a cited
       inquiry cannot be dismissed at all. */
    let reevaluation = {};
    if (to === "deferred") {
      let raises = [];
      for (const id of disposed) {
        const r = this.#raise(id, "deferred", when, viewer);
        if (r === null) { raises = null; break; }
        raises.push({ ...r, raised: r.raised.map((d) => ({ ...d, target: id })) });
      }
      reevaluation = Inquiry.#reevaluation("deferred", when, raises);
    }
    return { ok: true, to, reason: why, handle, disposed: disposed.sort(), weight: "refuse", drift: sel.drift,
             ...reevaluation };
  }

  /* R39, R60 (H38; leg-earning R14): the projects drawing on question `id` that `viewer` is shown, `{projects: [{id,
     name}], truncated}`, never a hidden one, or null when the read cannot be had (no such read, a throw, or no list).
     R14's answer is taken as a list, or as an object carrying `projects`; each entry as `{id, name}` (an entry that is a
     bare id is taken as its id with no name). */
  #projectsShown(id, viewer) {
    try {
      const le = this.legEarning;
      if (!le || typeof le.projectsShownOn !== "function") return null;
      const r = le.projectsShownOn({ id, viewer });
      const list = Array.isArray(r) ? r : r && typeof r === "object" && Array.isArray(r.projects) ? r.projects : null;
      if (!list) return null;
      const projects = list.map((p) => (typeof p === "string" ? { id: p, name: null }
        : p && typeof p === "object" && typeof p.id === "string" ? { id: p.id, name: typeof p.name === "string" ? p.name : null }
        : null)).filter(Boolean);
      return { projects, truncated: !!(r && r.truncated) };
    } catch { return null; }
  }

  /** R39, R11, R23 (T33-45; K617, K1505): the earned registry and the resting-on reads moved by copy to `leg-earning`
   *  (its R1–R7); each name below answers exactly what leg-earning's does, so importers not yet re-pointed read through
   *  them (plan Rules (9) item 4). This module asks leg-earning directly. */
  projectsDrawingOn(id) { return this.legEarning.projectsDrawingOn(id); }
  restsOnLive(id) { return this.legEarning.restsOnLive(id); }
  ensureLegContent(bundleId, ord) { return this.legEarning.ensureLegContent(bundleId, ord); }
  earned(subjectEntity, targetIds = [], contentIds = []) { return this.legEarning.earned(subjectEntity, targetIds, contentIds); }
  earnedForDoc(fm, legs) { return this.legEarning.earnedForDoc(fm, legs); }
  cyclePath(bundleId, targets) { return this.legEarning.cyclePath(bundleId, targets); }
  basisFor(bundleId, opts = {}) { return this.legEarning.basisFor(bundleId, opts); }
  restingOn(targetId) { return this.legEarning.restingOn(targetId); }
  earnedBasis(args = {}) { return this.legEarning.earnedBasis(args); }

  /* REC-16: DIVIDING an inquiry. open|surfaced|concluded -> `divided`, which is
   * TERMINAL (DEC-28), with the parent's legs re-homed onto children that each
   * supersede it.
   *
   * WHY THIS EXISTS AND IS NOT HOUSEKEEPING. Weakest-link composition means an
   * inquiry mixing one well-supported claim with one thin one is worth exactly
   * the thin one. Without division a member's only options are to OVERCLAIM or
   * to STAY SILENT, and both are failures of the same kind this repository's
   * threat model is about. Division is the honest third move: say that the
   * question was two questions, and answer each at what it is actually worth.
   *
   * AND THE ABUSE IS THE SAME MECHANISM (R4), which is why the disclosure below
   * is the point of this act rather than a detail. Dividing would otherwise be a
   * CHEAPER WAY TO SHED A FINDING THAT CUTS AGAINST YOU than severing it: move
   * the inconvenient leg onto a child nobody publishes and the published half
   * looks stronger, with nothing on the record saying what happened. Three
   * things close that, and all three are enforced rather than encouraged:
   *
   *   1. NO LEG MAY BE DROPPED. Every ord in the parent's basis is apportioned
   *      to at least one child, INCLUDING every `cuts_against` leg, and the
   *      refusal names the orphans (NO_APPORTIONMENT). Severance is the act that
   *      removes material and it costs a per-leg reason; division only re-homes,
   *      so it does not do severance's work at a discount (DEC-29(a)).
   *   2. EACH CHILD NAMES ITS PARENT AND EVERY SIBLING, in its own bundle.md, in
   *      the keys REC-14 reserved for exactly this and projected through the
   *      ordinary promote path. A reader who can see one half must be able to
   *      see that the other half EXISTS.
   *   3. THE PARENT RECORDS WHERE EVERY LEG WENT, in `division_apportionment`,
   *      and the catalog's `divided` entry requirements refuse the state without
   *      it — so a hand-written document cannot wear `divided` while quietly
   *      losing a leg.
   *
   * ONE AUTHORED REASON FOR THE WHOLE DIVISION (DEC-29(a)), and NO per-leg
   * reason. The per-leg judgement is already recorded per leg, in the
   * apportionment; a second one would be friction theatre on an act whose
   * disclosure is already total. Do not add one by inference.
   *
   * AUTHOR-SCOPED, SETTLED (DEC-30): any `contribute` holder, act attributed. A
   * machine credential is refused BY SHAPE (MACHINE_CANNOT_DIVIDE), the
   * MACHINE_CANNOT_CONCLUDE precedent — a machine may surface a question and may
   * never decide that the group's question was malformed. Owner-scoping was the
   * alternative and was refused for a reason worth keeping here: division is how
   * a member escapes an overclaiming mix, and de-escalation must never require
   * permission from someone whose incentive may run the other way.
   *
   * NO NEW TABLE (decision D5). The division is AUTHORED in bundle.md and the
   * children's `supersedes` edges reach `refs` through the projection that
   * already exists. A division table written by an op would be the first
   * relationship in this record that exists outside the document asserting it.
   *
   * THE MACHINE IS THE CATALOG'S, through vocabFor over the DECLARED spelling,
   * so a legacy focus/problem document — whose own vocabulary has no `divided`
   * — is refused rather than quietly given a state its contract never had. */
  divide(args = {}) { return withRow(this.#divide(args || {})); }
  #divide({ target, reason = "", children = null, viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-divide — REC-64/C-32.7. The fence alone. */
    if (!who || isMachineIdentity(who))                 /* REC-46: one predicate */
      return { ok: false, reason: "MACHINE_CANNOT_DIVIDE",
               detail: localize("inquiry.index.dividing_is_a_named_members", "dividing is a named member's judgement that the team's own question was malformed — that it was two questions — and that judgement carries a name. A machine credential may surface a question and gather what it rests on; it may not restructure the record's questions. Sign in as a member.") };
    /* END DEC-49 REGION is-machine-divide */
    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("inquiry.index.a_division_records_why_the", "a division records WHY the question was two questions. One authored reason covers the whole restructuring (DEC-29) and nothing is derived, defaulted or proposed: 'divided' with no account of why is a state change wearing a correction's clothes.") };
    if (why.length > RELEASE_ACK_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: localize("inquiry.index.the_reason_is_at_most", "the reason is at most {RELEASE_ACK_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { RELEASE_ACK_MAX: String(RELEASE_ACK_MAX) }) };
    if (!target)
      return { ok: false, reason: "NO_TARGET",
               detail: "a division restructures ONE question: pass target=<inquiry id>" };

    /* REC-25 / D-15: the same fail-closed viewer gate every read takes. An
       inquiry the viewer may not see answers NO_SUCH_BUNDLE, identical to an
       absent one, so the refusal discloses nothing. */
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state, b.bundle_sha, b.group_id FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target, object_type: b.object_type,
               detail: localize("inquiry.index.dividing_splits_a_question_and", "dividing splits a question, and only an inquiry carries one.") };

    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: localize("inquiry.index.this_inquiry_has_no_readable_2", "this inquiry has no readable bundle.md, so its state cannot be moved") };
    const parentText = liveMd.content;
    const fm = parseFrontmatter(parentText).data || {};

    /* PUBLISHED_CANNOT_DIVIDE, refused BY NAME and BEFORE the generic edge
       check, because the two say different things to the member. DEC-12 changed
       PUBLISHING — a case may be reopened and republished at a new edition — and
       it did not change this. An EDITION says the case continues; a DIVISION
       says the parent was MALFORMED. A signed edition cannot be retroactively
       declared malformed without erasing what a reader already relied on, and
       the honest route is the one DEC-12 built: reopen it, and let the next
       edition say what changed. */
    /* CASE-4 / DEC-72: THE CASE RELATION, not the state word. The refusal's
       name, its reasoning and its remedy are unchanged — what changes is that
       "is this a published case" is now asked of the pin rather than of a
       lifecycle state that no longer exists. Keying it on `published` after the
       removal would have made this refusal unreachable, and a signed edition
       would have become divisible with the suite green. */
    if (this.#caseMember(target))
      return { ok: false, reason: "PUBLISHED_CANNOT_DIVIDE", target, from: b.current_state,
               detail: localize("inquiry.index.a_published_case_cannot_be", "a published case cannot be divided. An EDITION says the case continues; a DIVISION says the parent was malformed, and a hash somebody has already relied on cannot be retroactively declared malformed. Reopen it (op=reopen) and publish what changed as a new edition, which is the act DEC-12 built for exactly this.") };

    /* THE MAP RULE: the machine is the catalog's, looked up through vocabFor
       over the DECLARED spelling, never STATES.inquiry by a raw key. */
    const spec = vocabFor(STATES, fm.object_type ?? b.object_type);
    const legalFrom = (spec?.edges?.[b.current_state]) || [];
    if (!legalFrom.includes("divided"))
      return { ok: false, reason: "ILLEGAL_TRANSITION", to: "divided", target,
               from: b.current_state, object_type: fm.object_type ?? b.object_type,
               detail: "this is not a legal move in the catalog's state table for this document's own "
                     + "vocabulary. An inquiry divides from open (or its `surfaced` alias) or from "
                     + "concluded; something deferred or dismissed is picked back up first (op=reopen), "
                     + "and a legacy focus/problem document has no divided state at all until its "
                     + "frontmatter is modernized." };

    /* REC-17 / D-5: division is TERMINAL for the parent, so it takes the same
       `CITED` refusal dismissal takes — retire's refusal on a downstream
       consequence rather than on the actor — over REC-11's reverse index. No
       new mechanism and no new refusal name.
       AND THE SET IT REFUSES ON IS NARROWER THAN DISMISSAL'S, which is this
       item's one judgment call and is reported to CONDUCT rather than buried.
       A WORKING dependent (open, concluded, deferred, dismissed) blocks:
       C-6.2's remedies for a leg whose target moved are "restore from history",
       "re-point to the successor" and "sever with a reason", and a working
       document can perform all three — so it is told now, with the offenders
       named, rather than discovering it later. A PUBLISHED dependent does NOT
       block, for the reason the two acts differ: dismissal ABANDONS a question
       and leaves nothing to re-point to, while a division CARRIES IT FORWARD
       into children that supersede it and are resolvable in both directions
       (REC-16). Refusing there would make a case's own publication the thing
       that freezes a malformed question in the record forever — the exact
       overclaim division exists to let a member escape (R4/DEC-28) — and the
       published edition is not stranded: it keeps answering with its own
       signature (DEC-12) and its authors get R7's obligation, which is what
       this item builds. */
    const restsOn = this.legEarning.restsOnLive(target);
    if (restsOn.confirmed.length)
      return { ok: false, reason: "CITED", target, offenders: restsOn.confirmed,
               detail: localize("inquiry.index.live_basis_legs_still_rest_2", "live basis legs still rest on this question. Dividing it declares it MALFORMED and ends it, and a claim resting on it would be left pointing at a question the record has withdrawn. Withdraw those legs first (sever the citation with a reason), or re-point them at the child that carries the half they rely on once it exists.") };

    /* THE CHILDREN, and the apportionment they carry. Both AUTHORED: nothing
       here proposes a split, guesses a question, or distributes a leg. */
    const kids = Array.isArray(children) ? children.filter((c) => c && typeof c === "object") : [];
    if (kids.length < 2)
      return { ok: false, reason: "TOO_FEW_CHILDREN", target, got: kids.length,
               detail: localize("inquiry.index.a_division_produces_at_least", "a division produces at least TWO questions. One child is a rename and zero is a deletion, and neither is what dividing claims about the parent.") };
    const ids = kids.map((c) => String(c.id ?? "").trim());
    for (const id of ids)
      if (!BUNDLE_ID_RE.test(id) || normalizeType(OBJECT_TYPES[id.split("-")[0]]) !== "inquiry")
        return { ok: false, reason: "BAD_CHILD_ID", target, child: id,
                 detail: localize("inquiry.index.each_child_is_named_with", "each child is named with a canonical INQ- id: a division produces questions, and the id grammar is what makes them addressable by everything that will cite them.") };
    if (new Set(ids).size !== ids.length)
      return { ok: false, reason: "BAD_CHILD_ID", target, children: ids,
               detail: localize("inquiry.index.two_children_carry_the_same", "two children carry the same id: a leg apportioned to a child named twice has one home, not two.") };
    if (ids.includes(target))
      return { ok: false, reason: "BAD_CHILD_ID", target,
               detail: localize("inquiry.index.a_divisions_child_cannot_be", "a division's child cannot be the parent itself: the parent is terminal and the children are what carry the question forward.") };
    for (const id of ids) {
      const exists = this.#one(`SELECT bundle_id FROM bundles WHERE bundle_id=?`, id);
      if (exists)
        return { ok: false, reason: "CHILD_EXISTS", target, child: id,
                 detail: localize("inquiry.index.this_id_already_names_a", "this id already names a record. A division CREATES its children, so re-using an existing id would overwrite a question somebody else is working on.") };
    }
    for (const c of kids) {
      const q = String(c.question ?? "").trim();
      if (!q)
        return { ok: false, reason: "NO_CHILD_QUESTION", target, child: String(c.id ?? ""),
                 detail: localize("inquiry.index.each_child_is_a_question", "each child is a QUESTION and its question is authored, never derived from the parent's. The whole claim a division makes is that these are two different questions, so a child that cannot state its own has not been shown to be one.") };
      if (q.length > RELEASE_ACK_MAX || /["\\\r\n]/.test(q))
        return { ok: false, reason: "BAD_CHILD_QUESTION", target, child: String(c.id ?? ""),
                 detail: localize("inquiry.index.a_childs_question_is_at", "a child's question is at most {RELEASE_ACK_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { RELEASE_ACK_MAX: String(RELEASE_ACK_MAX) }) };
    }

    /* THE APPORTIONMENT. Addressed by ORDINAL, because duplicate targets are
       legal by design (D4 — one document, two legs) and keying on the target
       would let one assignment discharge two legs. A leg may land on ONE child
       or on BOTH; what it may not do is land nowhere. */
    const legs = Array.isArray(fm.basis) ? fm.basis.filter((l) => l && typeof l === "object") : [];
    if (!legs.length)
      return { ok: false, reason: "NO_APPORTIONMENT", target, orphans: [],
               detail: localize("inquiry.index.this_inquiry_rests_on_nothing", "this inquiry rests on nothing, so there is nothing to apportion and both children would inherit nothing. A standing objective with no legs is not two questions yet (DEC-22); it is one question nobody has gathered anything for.") };
    const homes = new Map();               // ord -> [child ids], in children order
    for (let k = 0; k < kids.length; k++) {
      const raw = Array.isArray(kids[k].legs) ? kids[k].legs : null;
      if (!raw || !raw.length)
        return { ok: false, reason: "NO_APPORTIONMENT", target, child: ids[k],
                 detail: localize("inquiry.index.v1_was_apportioned_no_leg", "{v1} was apportioned no leg of the parent's basis. A child that inherits nothing is a NEW question, not a half of this one — open it as its own inquiry rather than calling it a division.", { v1: String(ids[k]) }) };
      for (const o of raw) {
        const ord = Number(o);
        if (!Number.isInteger(ord) || ord < 0 || ord >= legs.length)
          return { ok: false, reason: "BAD_APPORTIONMENT", target, child: ids[k], ord: o,
                   detail: localize("inquiry.index.a_leg_is_apportioned_by", "a leg is apportioned by its ORDINAL in the parent's basis (0..{v1}); '{o}' names none. Ordinals rather than targets, because one document legitimately carries two legs (D4).", { v1: String(legs.length - 1), o: String(o) }) };
        if (!homes.has(ord)) homes.set(ord, []);
        if (!homes.get(ord).includes(ids[k])) homes.get(ord).push(ids[k]);
      }
    }
    const orphans = [];
    for (let i = 0; i < legs.length; i++) if (!homes.has(i)) orphans.push(i);
    if (orphans.length) {
      const cutting = orphans.filter((i) => legs[i].role === "cuts_against");
      return { ok: false, reason: "NO_APPORTIONMENT", target,
               orphans: orphans.map((i) => ({ ord: i, target: legs[i].target ?? null, role: legs[i].role ?? null })),
               cuts_against_orphans: cutting.length,
               detail: localize("inquiry.index.every_leg_gets_a_home", "every leg gets a home. {length} leg(s) were apportioned to no child{v1}. Division RE-HOMES material and only severance REMOVES it, which is why dividing cannot do severance's work at a discount (R4): apportion them, or sever them with a reason, which is the act that takes material out of a question.", { length: String(orphans.length), v1: String(cutting.length ? localize("inquiry.index.and_of_them_cut_against", ", and {cutting} of them CUT AGAINST this inquiry", { cutting: String(cutting.length) }) : "") }) };
    }

    const when = this.#when();
    /* D-436: THE CHILDREN ARE CREATIONS, written AFTER the parent's revision — so whether each can name its producing
       group is asked HERE, before anything moves, and never discovered by a child refused after the parent is
       already divided. A child's bytes are derived from the parent's and carry its `group:` line; `promote` stamps
       the store's recorded group over it, or, recording none, keeps the parent's. With neither, no child could name
       one. This line was a literal fallback. */
    const pg = this.promotion.fact("producingGroup");
    if (!(pg.ok && pg.value) && !(typeof fm.group === "string" && fm.group.trim()))
      return this.#groupUndetermined("inquirydivide",
        localize("inquiry.index.target_s_children_would_be", "{target}'s children would be new documents that must name the team that produced them; this store records none and {target_2}'s own document names none, so nothing was divided.", { target: String(target), target_2: String(target) }));

    /* THE CHILDREN ARE DERIVED FROM THE PARENT'S OWN DOCUMENT, not built from a
       template here. A template would be this file's private idea of what an
       inquiry looks like, and it would fall behind the catalog's the first time
       the shape moved; deriving means a child is conformant for whatever
       contract the parent was authored under, which is the same reason every
       projection in this file reads the document rather than restating it. What
       is REPLACED is everything the child must not inherit: the parent's answer,
       the parent's history, the parent's session log. */
    /* R24 (N360): the parent's legs and groups as its bytes write them, lined up with the parsed ones (an entry of the
       basis that is not a leg is not carried, as `legs` above does not count it); null when they cannot be lined up. */
    const allBasis = Array.isArray(fm.basis) ? fm.basis : [];
    const basisRows = blockEntries(parentText, "basis");
    const rawLegs = basisRows && basisRows.length === allBasis.length
      ? allBasis.flatMap((l, i) => (l && typeof l === "object" ? [basisRows[i]] : [])) : null;
    const ordGround = legs.map((l) => (typeof l.ground === "string" && l.ground.trim() ? l.ground.trim() : null));
    const groupOrds = new Map();
    ordGround.forEach((g, i) => { if (g !== null) groupOrds.set(g, [...(groupOrds.get(g) || []), i]); });
    const groundRows = blockEntries(parentText, "grounds");
    const rawGrounds = groundRows && Array.isArray(fm.grounds) && groundRows.length === fm.grounds.length
      ? groundRows.map((lines, i) => ({ lines,
          label: fm.grounds[i] && typeof fm.grounds[i].ground === "string" ? fm.grounds[i].ground.trim() : null }))
        .filter((r) => r.label !== null)
      : null;
    const plans = [];
    for (let k = 0; k < kids.length; k++) {
      const id = ids[k];
      const q = String(kids[k].question).trim();
      const sibs = ids.filter((x) => x !== id);
      const mine = [...homes.entries()].filter(([, to]) => to.includes(id)).map(([ord]) => ord).sort((x, y) => x - y);
      const childLegs = mine.map((ord) => legs[ord]);
      let text = parentText;
      text = setScalar(text, "id", id);
      text = setScalar(text, "title", `"${fmSafe(deriveInquiryTitle(q) ?? q)}"`);
      text = setScalar(text, "current_state", "open");
      text = setScalar(text, "prior_state", "null");
      text = setOrAddScalar(text, "created", `"${when}"`);
      text = setOrAddScalar(text, "last_updated", `"${when}"`);
      /* A NEW document has no history of its own, and inheriting the parent's
         would be the child claiming transitions it never made — the append-only
         surface C-5.1 guards, filled with somebody else's past. REMOVED and
         re-opened rather than overwritten in place: a parent that has been
         concluded carries a populated BLOCK, and setting the key line alone
         would leave its indented entries behind as array items belonging to
         nothing (C-2.1's "array item outside any block", which is exactly what
         the catalog said the first time this was written the short way). */
      text = removeBlock(text, "state_history");
      text = setOrAddScalar(text, "state_history", "[]");
      /* The parent's ANSWER is not the child's. An inquiry authored before
         `concluded` existed carries neither key; one divided out of a concluded
         parent carries both, and carrying them forward would put the parent's
         conclusion on an open question nobody has answered. */
      text = setOrAddScalar(text, "conclusion", `""`);
      /* REC-136: and the reading the parent's conclusion ADOPTED (§7.1 item 6)
         is the parent's answer too — cleared for the rule above. #setScalar,
         not setOrAdd: a parent concluded before item 6 carries neither key,
         and adding two empty ones to its children would be bytes nobody asked
         for. */
      text = setScalar(text, "conclusion_version", `""`);
      text = setScalar(text, "conclusion_claim", `""`);
      text = setOrAddScalar(text, "falsifier", `""`);
      /* REC-117, AND IT IS THE SECOND HALF OF THE SAME RULE THE THREE LINES
         ABOVE STATE. A parent concluded under a falsifier override carries the
         pair; carrying it into a child would put a member's name, and their
         acceptance that no falsifier could be stated, on an OPEN question
         nobody has answered — the parent's answer arriving on the child by the
         one route the lines above exist to close. Swept rather than noticed:
         these are the only two sites in this file that write `falsifier`. */
      text = setOrAddScalar(text, "falsifier_override_by", `""`);
      text = setOrAddScalar(text, "falsifier_override_at", `""`);
      text = setOrAddScalar(text, "disposition_reason", `""`);
      /* THE DISCLOSURE (R4), in the keys REC-14 RESERVED for it with no
         producer. This act is the producer. */
      text = setOrAddScalar(text, "division_parent", target);
      text = setOrAddScalar(text, "division_siblings", `[${sibs.join(", ")}]`);
      /* references: the apportioned legs' targets, plus the supersedes edge back
         to the parent WITH ITS REASON — the requirement C-6.1 gains with this
         item, because before it `supersedes` passed on the strength of being in
         a list and had no producer at all. */
      /* R4 (N522): a leg on an imported finding reference is carried verbatim and is never a `references[]` entry. */
      const refTargets = [...new Set(childLegs.map((l) => l.target)
        .filter((t) => typeof t === "string" && !unreferenced(t)))];
      text = setOrAddBlock(text, "references", [
        ...refTargets.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"]),
        `  - target: ${target}`, "    rel: supersedes", "    status: confirmed",
        `    reason: "${fmSafe(why)}"`]);
      /* R24 (N360): THE LEGS VERBATIM — each apportioned leg's own lines from the parent's bytes, so a leg that names
         a passage (`content_id`, an extent, the capture it was made against) still names it on the child, and the
         child inherits what rests on that passage (reevaluation's passage-level causes) rather than resting on the
         whole document. Rebuilt from the parsed leg only when the parent's block cannot be lined up with its legs
         (a replayed shape), and then every field the rebuild knows, the passage among them.
         THE PARTITION TRAVELS ONLY WHOLE (R34, DEC-32). A group's row asserts that ITS legs are enough on their own,
         under a name and a date; a child given every leg of each group its legs belong to carries those groups
         verbatim, rows and labels. A child given part of a group would carry an assertion nobody made about the
         part, so it carries no partition at all: the ungrouped reading, no stronger than its weakest leg, which the
         child's own members may restructure (op=inquiryground). */
      const grouped = ordGround.some((g) => g !== null);
      /* R85, `inquiry-grammar` R68: a leg with no ground label is a cutting leg or a necessary supporting leg beside the
         grounds, so it never stops a child carrying the groups its other legs belong to whole; a labelled cutting leg
         (a document written before R85) is held to the same whole-group rule. */
      const keepGroups = grouped && !!rawGrounds && mine.some((ord) => ordGround[ord] !== null)
        && mine.every((ord) => (ordGround[ord] === null ? true
          : groupOrds.get(ordGround[ord]).every((o) => mine.includes(o))
            && rawGrounds.some((r) => r.label === ordGround[ord])));
      const legLines = (ord) => {
        const seg = rawLegs ? rawLegs[ord] : null;
        const lines = seg || legRebuilt(legs[ord]);
        return keepGroups ? lines : lines.filter((ln) => !/^\s+ground:/.test(ln));
      };
      text = setOrAddBlock(text, "basis", mine.flatMap(legLines));
      if (keepGroups) {
        const labels = new Set(mine.map((ord) => ordGround[ord]));
        text = setOrAddBlock(text, "grounds", rawGrounds.filter((r) => labels.has(r.label)).flatMap((r) => r.lines));
      } else if (!grouped && Array.isArray(fm.grounds) && fm.grounds.length === 0) {
        /* R85: a parent answered with no ground at all (`grounds: []`) passes that answer on; the child does not read as
           never partitioned */
        text = setOrAddScalar(removeBlock(text, "grounds"), "grounds", "[]");
      } else text = removeBlock(text, "grounds");
      /* The parent's division block is the PARENT's, never the child's: a child
         carrying one would claim to have been divided itself. */
      text = removeBlock(text, "division");
      text = removeBlock(text, "division_apportionment");
      /* R47, C-2.17 (N345): the parent's contradiction link and its resolution are the parent's. A child naming the same
         candidate would be a second question for one conflict, and a resolution without the link is refused (C-2.12). */
      text = removeBlock(text, "contradiction");
      text = removeBlock(text, "resolution");
      text = setSection(text, "## Question", [q]);
      /* THE DISCLOSURE FOR A PERSON TO READ, beside the frontmatter the gates
         and the projections read — the same two-places discipline op=publish
         takes with `## What This Excludes`. A disclosure only a parser can find
         is not a disclosure. */
      text = setSection(text, word("conformance.rests"), [
        word("inquiry.set_section.divided_out", { target, when, who }), "",
        why, "",
        word("inquiry.set_section.half_question_stays", { sibs: sibs.join(", "), target })]);
      text = setSection(text, "## Conclusion", []);
      text = setSection(text, word("conformance.falsify"), []);
      text = setSection(text, "## Session Log", [
        `### Session ${when} | Divided out | ${who}`,
        `Trigger: op=inquirydivide on ${target}`,
        `Changes: created from ${target}, ${childLegs.length} leg(s) apportioned here.`,
        `Parent: ${target}`,
        `Siblings: ${sibs.join(", ")}`,
        `Reason: ${why}`]);
      plans.push({ id, q, sibs, mine, legs: childLegs, text });
    }

    /* PRE-FLIGHT EVERY CHILD BEFORE ANYTHING IS WRITTEN, through the catalog's
     * own functions — the ones promote itself will run.
     *
     * WHY IT IS HERE AND NOT LEFT TO promote. The parent has to be written
     * FIRST: a child's disclosure is checked against the PARENT's own
     * `division.into`, so a child written before the parent moved would be
     * refused NO_SIBLING_DISCLOSURE by a parent that has not been divided yet.
     * That ordering is the right one — a child supersedes a parent that IS
     * divided — but it means a child refused at ITS write would leave a terminal
     * parent naming a question that does not exist. So every child is judged
     * here, against the same rules, before the parent moves; what remains after
     * this gate is the promote-internal failures (a collision, an oversize
     * inline), which cannot arise for a freshly created document of this size.
     *
     * The alternative — write the children first and skip the resolved check
     * while the parent is mid-division — was rejected outright: an exemption
     * saying "the disclosure is not checked during the act that produces
     * disclosures" is the hole this whole item exists to close. */
    for (const pl of plans) {
      const cf = parseFrontmatter(pl.text).data || {};
      const findings = [];
      supersedesEdgeFindings(cf, findings);
      divisionDisclosureFindings(cf, findings);
      /* R23 (`inquiry-grammar` R1–R2, R4): the entry arm, as the child's own promotion will judge it (R11). */
      checkInquiryExtension({ fm: cf, publishedRegistry: this.#publishedRegistry(pl.id,
        pl.legs.map((l) => l.target).filter((t) => typeof t === "string")),
        /* REC-18: the earned registry for the CHILD, judged before the parent
           moves exactly as every other rule here is. A child inherits the
           parent's subject_entity through the copied frontmatter, so an
           apportioned earned leg is re-confirmed against the record rather than
           carried across on trust. */
        earnedRegistry: this.legEarning.earnedForDoc(cf, pl.legs) }, findings);
      /* R47: the contradiction arm, as the child's promotion will judge it */
      for (const x of contradictionFindings(cf)) findings.push({ check: x.check, severity: "error", message: x.detail });
      const errs = findings.filter((x) => x.severity === "error");
      if (errs.length)
        return { ok: false, reason: "CHILD_REFUSED", target, child: pl.id,
                 findings: errs.map((x) => ({ check: x.check, detail: x.message })),
                 detail: localize("inquiry.index.the_document_this_division_would", "the document this division would create for {id} would not pass the catalog, so nothing was written: the parent is untouched and no child exists. A division that landed half-applied would leave a terminal parent naming a question nobody can open.", { id: String(pl.id) }) };
    }

    /* THE PARENT MOVES FIRST, and every child follows. The pre-flight above is
       why this order and not the other. */
    let text = parentText;
    const withHistory = appendStateHistory(text, {
      timestamp: when, from_state: b.current_state, to_state: "divided",
      blurb: why, author: who });
    if (!withHistory)
      return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", target,
               detail: "this document's state_history block cannot be extended in place, and a division "
                     + "recording no transition would leave prior_state pointing at a history the document "
                     + "does not carry (C-4.2)" };
    text = withHistory;
    text = setScalar(text, "prior_state", b.current_state);
    text = setScalar(text, "current_state", "divided");
    /* `disposition_reason` is UNTOUCHED (DEC-28). Division's reason belongs to
       the ACT; routing it through the disposition field would make one field
       carry two grammars — a stance toward a question, and an account of a
       restructuring — and every consumer of the field would have to know which
       one it was holding. */
    text = setOrAddBlock(text, "division", [
      `  reason: "${fmSafe(why)}"`,
      `  apportioned_by: ${who}`,
      `  at: "${when}"`,
      `  into: [${ids.join(", ")}]`]);
    /* WHERE EVERY LEG WENT, one row per (leg, child). A second top-level key
       rather than a member of the map above because the restricted grammar
       cannot express an array of objects inside a map — the same split REC-14's
       completeness / completeness_excluded pair takes, for the same reason.
       `role` is carried on the row so the account is readable without joining it
       back to basis[]: what a reader checks first is where the legs that CUT
       AGAINST the case went. */
    const rows = [];
    for (let i = 0; i < legs.length; i++)
      for (const to of homes.get(i))
        rows.push([`  - ord: ${i}`, `    target: ${legs[i].target}`,
                   `    role: ${legs[i].role ?? "supports"}`, `    to: ${to}`]);
    text = setOrAddBlock(text, "division_apportionment", rows.flat());
    text = setScalar(text, "last_updated", `"${when}"`);
    /* The account in the BODY as well as the frontmatter, the op=publish
       precedent: the frontmatter is what the gates and the projections read,
       this is what a person reads. The parent's own conclusion, where it had
       one, is kept above it — a division does not unsay what the group
       concluded, it says the question was two questions. */
    text = setSection(text, "## Conclusion", [
      ...(typeof fm.conclusion === "string" && fm.conclusion.trim() ? [fm.conclusion, ""] : []),
      word("inquiry.set_section.divided", { when, who, ids: ids.join(", "), why }), "",
      word("inquiry.set_section.where_leg_went"), "",
      ...legs.map((l, i) => `- ${l.target}${l.role === "cuts_against" ? " (cuts against)" : ""} -> `
                          + `${homes.get(i).join(", ")}`)]);

    const entry = localize("inquiry.index.session_when_divided_who_trigger", "### Session {when} | Divided | {who}\nTrigger: op=inquirydivide on {target}\nChanges: state {current_state} to divided (terminal).\nInto: {ids}\nReason: {why}\nApportioned: {length} leg(s), {length_2} placement(s), {length_3} cutting against.\n", { when: String(when), who: String(who), target: String(target), current_state: String(b.current_state), ids: String(ids.join(", ")), why: String(why), length: String(legs.length), length_2: String(rows.length), length_3: String(legs.filter((l) => l.role === "cuts_against").length) });
    const at = text.indexOf("## Session Log");
    if (at < 0) text += "\n## Session Log\n\n" + entry;
    else {
      const nxt = text.indexOf("\n## ", at + 1);
      const cutAt = nxt === -1 ? text.length : nxt + 1;
      text = text.slice(0, cutAt) + entry + "\n" + text.slice(cutAt);
    }

    /* R26: THE PARENT AND EVERY CHILD LAND TOGETHER OR NONE DOES. The parent is written first (a child's disclosure is
       checked against the parent's own `division.into`), and every promotion runs inside ONE record-core transaction
       (its R32), so a child refused after the parent rolls the parent back with it. */
    let promoted = null;
    const created = [];
    const refused = this.record.transact(() => {
      promoted = this.#promote({
          bundleId: target, base: b.bundle_sha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
          author: who,
          files: [mdFile(text), ...carriedFiles(this.sql, target)],
          meta: { object_type: fm.object_type ?? b.object_type,
                  title: fm.title, current_state: "divided", prior_state: b.current_state,
                  created: fm.created, last_updated: when,
                  criticality: fm.criticality ?? null },
      });
      if (!promoted.ok) return { ...promoted, target };
      for (const pl of plans) {
        const cp = this.#promote({
          bundleId: pl.id, base: null, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
          author: who,
          files: [mdFile(pl.text)],
          meta: { object_type: fm.object_type ?? b.object_type,
                  title: deriveInquiryTitle(pl.q) ?? pl.q,
                  current_state: "open", prior_state: null,
                  created: when, last_updated: when,
                  criticality: fm.criticality ?? null },
        });
        if (!cp.ok)
          return { ...cp, target, child: pl.id,
                   detail: localize("inquiry.index.v1_the_division_lands_whole", "{v1}The division lands whole or not at all, so nothing was written: the parent is untouched and no child exists.", { v1: String(cp.detail ? cp.detail + " " : "") }) };
        created.push({ id: pl.id, question: pl.q, siblings: pl.sibs, legs: pl.mine, bundleSha: cp.bundleSha });
        /* R44 (N149): the child is the parent's question asked again, in the browser the parent's was asked in. */
        this.sql.exec(`INSERT OR IGNORE INTO inquiry_member_agents (bundle_id, user_agent, at)
                       SELECT ?, user_agent, at FROM inquiry_member_agents WHERE bundle_id=?`, pl.id, target);
      }
      return null;
    });
    if (refused) return refused;

    return { ok: true, target, from: b.current_state, to: "divided", terminal: true,
             bundleSha: promoted.bundleSha,
             into: ids, children: created,
             apportionment: legs.map((l, i) => ({ ord: i, target: l.target ?? null,
               role: l.role ?? "supports", to: homes.get(i) })),
             cuts_against: legs.filter((l) => l.role === "cuts_against").length,
             reason: why, apportioned_by: who, at: when, weight: "single",
             /* REC-17: supersession is the ORIGINAL raiser of R7's obligation
                (P-64), and this act is its producer. The dependents named here
                are the FROZEN ones — a working dependent would have refused the
                act above — and nothing is written to them: the obligation is a
                query, derived from the supersedes edge the children just made,
                and their strengths are untouched. */
             ...this.#reevaluationField(target, "supersession", when, viewer),
             next: word("inquiry.next.child_open_carries") };
  }


  /* ================================================================   * REC-45 / DEC-32: `op=inquiryground` — THE ACT THAT AUTHORS THE STRUCTURE.
   *
   * REC-42 built the partition and both gates that defend it, and left one gap
   * routed rather than closed: NOTHING AUTHORED IT. Grounds reached the record
   * only through a hand-written `bundle.md` promoted by op=promote, so DEC-32
   * clause 6 — *"RESTRUCTURING AFTER SEEING THE STRENGTH IS LEGAL, RECORDED AND
   * ATTRIBUTED — never blocked… the system may NOTICE the pattern"* — was
   * unreachable in both halves at once, because neither RECORDING nor NOTICING
   * is possible without an act that carries a reason. This is that act.
   *
   * IT IS BUILT ON op=publish's STAMPING SHAPE, and the split is the same one:
   *   AUTHORED, caller-supplied, never prefilled — WHICH legs are grouped
   *   together, what each group is called, the optional STATEMENT on a group,
   *   and the REASON for a restructuring. Nothing here proposes a partition,
   *   guesses a label, or moves a leg on a member's behalf.
   *   STAMPED by the server — `asserted_by` and `at` on every group, taken from
   *   the authenticated session and the clock and NEVER from a parameter.
   *
   * AND THE STAMP IS THE POINT OF THE ITEM. REC-42's gate already refuses a
   * MACHINE asserter and an UNDATED assertion; what it cannot refuse is a
   * caller who supplies a well-formed name and a well-formed date belonging to
   * somebody else, or belonging to an hour before the strength was shown. So a
   * caller's `asserted_by`/`at` are DELETED from every row before the stamp
   * (the op=promote `ownerMemberId` precedent, and the reason it is DELETE and
   * not OVERWRITE: overwriting is a property of the code path taken, deletion
   * is a property of the input, and only the second survives somebody later
   * adding an arm). The old process's CLAUDE.md rule (archived,
   * `docs/archive/CLAUDE-2026-09-26-old-process.md`) was exactly this one — a provenance hop a
   * caller can hand us is one a caller can invent — and this is the last door
   * on the one field in the record that makes a finding STRONGER.
   *
   * WHAT COUNTS AS A RESTRUCTURE, and it is decided from the RECORD:
   * the inquiry is in FIRST AUTHORSHIP when its standing document carries NO
   * partition at all — no leg names a group and there is no `grounds` key — and
   * is being RESTRUCTURED in every other case. A reason is REQUIRED on the
   * second and required on neither half of the first; DEC-32's clause is about
   * a member who *"may legitimately realise their structure was wrong"*, and
   * there must be a structure for that to be true of. The distinction is NOT a
   * parameter and must never become one: a caller who could declare "this is my
   * first time" could walk past the reason gate on every restructuring they
   * made. REMOVING a partition is a restructure too, and takes a reason like
   * any other — it changes an authored structure, and the fact that it moves in
   * the conservative direction is a fact about the ANSWER, not about the act.
   *
   * WHAT CARRIES FORWARD AND WHAT IS RE-STAMPED, which is the other half of
   * making clause 6 legible. A group's row asserts that ITS LEGS are enough on
   * their own, so the assertion is ABOUT the legs: a group whose leg set and
   * statement are unchanged keeps the `asserted_by` and `at` it already had,
   * and a group whose membership moved becomes THIS member's assertion, NOW.
   * Re-stamping everything would erase the one thing DEC-32 says the date is
   * for — *"a structure authored after a strength was seen is a different act
   * from one authored before it, and only a date lets a reader tell"* — and
   * carrying everything forward would let a member re-cut a group under
   * somebody else's name and an older date.
   *
   * ONE GRAMMAR, AT BOTH GATES, AND NO SECOND ONE HERE. The candidate document
   * is judged by `checkInquiryBasis` — the catalog's own function, the same one
   * op=promote runs at the write and the checker runs at the gate — over the
   * SAME two registries promote injects, and it is judged BEFORE a byte moves.
   * The refusal is even called `BASIS_REFUSED`, promote's name, because one
   * function answering twice should not answer under two names. So every REC-42
   * refusal fires through this act: an unattributed label, a half-labelled
   * basis, a machine asserter, an undated assertion, a duplicate label and an
   * empty group. What is refused HERE and could not be refused there is the
   * mapping this act introduces and the document does not have — an ordinal
   * naming no leg, and one leg claimed by two groups.
   *
   * THE PARTITION IS ADDRESSED BY ORDINAL and never by target id, which is
   * REC-16's apportionment decision for REC-16's reason: D4 makes duplicate
   * targets legal, a basis legitimately cites one document for two legs, and
   * target-keying would let one instruction move two legs a member meant to
   * separate. `ord` is the leg's position in `basis[]`, which is what
   * `inquiry_basis` already keys on.
   *
   * TWO STATES REFUSE BY NAME, on op=inquirydivide's precedent that a refusal
   * should say which rule it met. `published`: the pair and the per-group
   * breakdown are inside signed, ratified bytes, and re-cutting the partition
   * underneath them would leave the document composing to something an edition
   * on the record contradicts — DEC-12's route is reopen, restructure,
   * republish. `divided`: the parent was declared MALFORMED and carried forward
   * into children, and re-deriving a terminal parent's strength moves a number
   * its children's own disclosure already pointed at.
   *
   * WHAT IS DELIBERATELY NOT HERE. No NOTICER. DEC-32 says the system MAY
   * notice a weak leg moved into its own group immediately after a strength
   * drop and surface it; this act makes that possible and does not do it, and
   * the difference matters — noticing is a derived read with a surface half
   * (UI-27's), and building it inside the act would put a judgement about the
   * member's motive in the same function that must never refuse them (*"a
   * machine may not refuse the act and must not hide it"*). What this act does
   * instead is leave the evidence a noticer needs where an append-only history
   * keeps it: the pair AS IT STOOD BEFORE the act and after it, written into
   * the Session Log entry beside the reason, and returned to the caller.
   */
  ground(args = {}) { return withRow(this.#ground(args || {})); }
  #ground({ target, grounds, reason = "", viewer = null, author = null } = {}) {
    const who = String(author ?? "").trim();
    /* DEC-49 REGION is-machine-ground — REC-64/C-32.8. The fence alone. */
    if (!who || isMachineIdentity(who))                 /* REC-46: one predicate */
      return { ok: false, reason: "MACHINE_CANNOT_GROUND",
               detail: localize("inquiry.index.grouping_is_a_named_members", "grouping is a named member's judgement that some of their reasons are enough on their own to carry their answer, and it is the one act in this record that makes a finding STRONGER. A machine credential may surface a question and gather what it rests on; it may not decide that part of the gathering was sufficient by itself. Sign in as a member.") };
    /* END DEC-49 REGION is-machine-ground */
    if (!target)
      return { ok: false, reason: "NO_TARGET",
               detail: "grouping authors the structure of ONE question: pass target=<inquiry id>" };
    if (grounds === undefined)
      return { ok: false, reason: "NO_PARTITION", target,
               detail: localize("inquiry.index.pass_grounds_an_array", "pass grounds[] — an array of groups, each naming its ground label, the legs it groups by ord, and an optional statement; one entry per group, where each ord is a leg's position in this question's basis. Pass an EMPTY array to remove the grouping entirely and let the answer read as its weakest leg again; that is a restructuring like any other and takes a reason.") };

    /* REC-25 / D-15: the same fail-closed viewer gate every read takes. An
       inquiry the viewer may not see answers NO_SUCH_BUNDLE, identical to an
       absent one, so the refusal discloses nothing. */
    const gate = viewerPredicate(viewer);
    const b = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state, b.bundle_sha FROM bundles b
       WHERE b.bundle_id=? AND (${gate.sql})`, target, ...gate.args);
    if (!b) return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(b.object_type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target, object_type: b.object_type,
               detail: localize("inquiry.index.a_basis_is_what_a", "a basis is what a QUESTION rests on, and only an inquiry carries one.") };
    /* CASE-4 / DEC-72: THE CASE RELATION, not the state word — divide's reason
       exactly, and the stakes here are higher, because this act RAISES A GRADE.
       A restructure that reached a member of a signed edition would leave the
       document composing to something the edition on the record contradicts,
       which is what the refusal below says and what the removal of the state
       would silently have permitted. */
    if (this.#caseMember(target))
      return { ok: false, reason: "PUBLISHED_CANNOT_RESTRUCTURE", target, from: b.current_state,
               detail: localize("inquiry.index.a_published_cases_composed_strength", "a published case's composed strength and its per-group breakdown are inside signed, ratified bytes. Re-cutting the structure underneath them would leave this document composing to something the edition on the record contradicts. Reopen it (op=reopen), restructure, and publish what changed as a new edition — the route DEC-12 built for exactly this.") };
    /* R27, R64 (K231): one condition, one code, minted by the one helper the write's check answers through too */
    if (b.current_state === "divided")
      return dividedCannotRestructure("this question was declared malformed and carried forward into children that "
        + "supersede it. Re-deriving its strength now would move a number its children's own disclosure already points "
        + "at. Restructure the CHILD that carries the half you mean.", { target });

    const liveMd = this.#one(`SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, target);
    if (!liveMd || liveMd.content === null)
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: localize("inquiry.index.this_inquiry_has_no_readable_3", "this inquiry has no readable bundle.md, so its structure cannot be authored") };
    let text = liveMd.content;
    const fm = parseFrontmatter(text).data || {};
    const all = Array.isArray(fm.basis) ? fm.basis : [];
    const legs = all.filter((l) => l && typeof l === "object");
    if (!legs.length)
      /* D-484: routed through the ONE governed site (see `actNoBasis`). */
      return actNoBasis(localize("inquiry.index.a_grouping_is_a_partition", "a grouping is a partition OF THE LEGS, and this question rests on nothing yet. Cite what it rests on first (op=cite); an assertion that nothing is enough on its own is not a thing the record can hold."), { target });
    if (legs.length !== all.length)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", target,
               detail: localize("inquiry.index.this_questions_basis_carries_an", "this question's basis carries an entry that is not a leg, so the ordinals a partition addresses cannot be lined up against the document. Nothing was written.") };

    /* WHAT STANDS TODAY, read from the DOCUMENT — `inquiry_basis` is a
       projection of it and never a second place to state it (D-21). */
    const standingLabel = legs.map((l) => typeof l.ground === "string" && l.ground.trim() ? l.ground.trim() : null);
    const standingRows = Array.isArray(fm.grounds) ? fm.grounds : [];
    const standingByLabel = new Map();
    for (const r of standingRows)
      if (r && typeof r === "object" && typeof r.ground === "string" && !standingByLabel.has(r.ground))
        standingByLabel.set(r.ground, r);
    /* THE DISTINCTION, decided here and from the record alone. Any standing
       label OR any standing `grounds` key — even an empty or malformed one —
       is a structure this act is about to replace. */
    const restructure = standingLabel.some((g) => g !== null)
                     || (fm.grounds !== undefined && fm.grounds !== null);

    const why = String(reason ?? "").trim();
    if (restructure && !why)
      return { ok: false, reason: "NO_REASON", target, restructure: true,
               detail: localize("inquiry.index.this_question_already_carries_an", "this question already carries an authored structure, so changing it is a REVISION and records WHY. Restructuring after seeing a strength is legal and is never blocked (DEC-32) — the defence is that it is visible, which it is not without an account of it. Nothing here is derived, defaulted or prefilled. A FIRST grouping needs no reason: there is no earlier structure for it to be a revision of.") };
    if (why && (why.length > RELEASE_ACK_MAX || /["\\\r\n]/.test(why)))
      return { ok: false, reason: "BAD_REASON", target,
               detail: localize("inquiry.index.a_reason_is_at_most_2", "a reason is at most {RELEASE_ACK_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { RELEASE_ACK_MAX: String(RELEASE_ACK_MAX) }) };

    /* ---------------- the caller's partition, mapped onto the legs ----------
       THE SHAPE ARMS BELOW ARE THE MAPPING AND NOTHING ELSE. Every rule about
       what a LABEL may say, who may assert it, and whether the partition is
       total belongs to the catalog's `checkGrounds` and is applied to the
       CANDIDATE further down — one grammar, at both gates, never a second copy
       written here because it was convenient. */
    if (!Array.isArray(grounds))
      return { ok: false, reason: "BAD_PARTITION", target,
               detail: "grounds must be an ARRAY of groups, each { ground, legs: [ord, ...] }" };
    const nextLabel = new Array(legs.length).fill(null);
    const claimed = new Map();          // ord -> the label that claimed it
    const asked = [];                   // [{ label, ords, statement }] in the caller's own order
    for (let i = 0; i < grounds.length; i++) {
      const row = grounds[i];
      if (!row || typeof row !== "object" || Array.isArray(row))
        return { ok: false, reason: "BAD_PARTITION", target, at: i,
                 detail: localize("inquiry.index.grounds_i_is_not_an", "grounds[{i}] is not an object", { i: String(i) }) };
      const label = typeof row.ground === "string" ? row.ground.trim() : row.ground;
      const ords = row.legs;
      if (!Array.isArray(ords))
        return { ok: false, reason: "BAD_PARTITION", target, at: i,
                 detail: localize("inquiry.index.grounds_i_legs_must_be", "grounds[{i}].legs must be an array of ordinals — a group is a partition OF THE LEGS, and a group naming none asserts that nothing is enough on its own. Legs are addressed by ORDINAL (their position in basis[]) and never by target id, because one document legitimately carries two legs (D4).", { i: String(i) }) };
      const stmt = row.statement === undefined || row.statement === null ? null : row.statement;
      if (stmt !== null && (typeof stmt !== "string"
          || stmt.length > EDGE_REASON_MAX || /["\\\r\n]/.test(stmt)))
        return { ok: false, reason: "BAD_STATEMENT", target, at: i,
                 detail: localize("inquiry.index.grounds_i_statement_is_at", "grounds[{i}].statement is at most {EDGE_REASON_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { i: String(i), EDGE_REASON_MAX: String(EDGE_REASON_MAX) }) };
      for (const raw of ords) {
        if (!Number.isInteger(raw) || raw < 0 || raw >= legs.length)
          return { ok: false, reason: "BAD_PARTITION", target, at: i, ord: raw ?? null, legs: legs.length,
                   detail: localize("inquiry.index.grounds_i_legs_names_ord", "grounds[{i}].legs names ord {v1}, and this question has legs 0..{v2}. An ordinal that addresses no leg groups nothing.", { i: String(i), v1: String(JSON.stringify(raw) ?? "null"), v2: String(legs.length - 1) }) };
        /* R85 (K4194): a leg that cuts against is not a reason for the answer, so no ground holds one; it is left
           unlabelled. Refused here, naming the leg, so the member is told which leg and why: the finding is the
           refusal's, never the bare code. */
        if (legs[raw].role === "cuts_against")
          return { ok: false, reason: "BASIS_REFUSED", target, ord: raw,
                   findings: [{ check: "C-2.8", ord: raw, target: typeof legs[raw].target === "string" ? legs[raw].target : null,
                     detail: localize("inquiry.index.grounds_i_legs_names_ord_which_cuts", "grounds[{i}].legs names ord {raw}, which cuts against this answer. A ground says its legs carry the answer on their own, and a leg that cuts against is not a reason for it: leave it out of every ground, and it stays in the basis as it is.", { i: String(i), raw: String(raw) }),
                     repairs: [localize("inquiry.index.take_ord_raw_out_of", "take ord {raw} out of grounds[{i}].legs", { raw: String(raw), i: String(i) })] }],
                   detail: localize("inquiry.index.this_partition_names_a_leg", "this partition names a leg that cuts against the answer, and a ground holds only legs that carry it. Nothing was written.") };
        if (claimed.has(raw))
          return { ok: false, reason: "BAD_PARTITION", target, ord: raw,
                   claimed_by: [claimed.get(raw), label],
                   detail: localize("inquiry.index.basis_raw_is_claimed_by", "basis[{raw}] is claimed by two groups. A leg belongs to exactly ONE group: a leg that is needed whatever else holds is NECESSARY, and the honest way to say so is to leave the reasons ungrouped — an ungrouped basis is read as no stronger than its weakest leg, which is the conservative reading.", { raw: String(raw) }) };
        claimed.set(raw, label);
        nextLabel[raw] = label;
      }
      asked.push({ label, ords: [...ords].sort((x, y) => x - y), statement: stmt });
    }

    /* ------------------------------------------- the stamp, and what carries */
    const when = this.#when();
    const ordsOf = (label) => standingLabel.reduce((a, g, i) => (g === label ? [...a, i] : a), []);
    const same = (a, c) => a.length === c.length && a.every((v, i) => v === c[i]);
    const rowsOut = asked.map((a) => {
      const prior = typeof a.label === "string" ? standingByLabel.get(a.label) : undefined;
      const priorStmt = prior && typeof prior.statement === "string" ? prior.statement : null;
      /* CARRIED FORWARD only when the assertion is genuinely the same one: the
         same legs and the same statement. And only when the standing row's own
         attribution is usable — a document that reached the store carrying a
         nameless or undated row (a replayed history: the gate's shape refusals
         honour the replay exemption) is re-stamped rather than trusted, which
         fails toward THIS member owning what they just authored. */
      const carry = !!prior && same(a.ords, ordsOf(a.label)) && priorStmt === a.statement
                 && typeof prior.asserted_by === "string" && prior.asserted_by.trim() !== ""
                 && typeof prior.at === "string" && prior.at.trim() !== "";
      return { ground: a.label, legs: a.ords, statement: a.statement,
               /* A caller's own `asserted_by`/`at` never appear in this object.
                  They are not overwritten from `row` — `row` is never read for
                  them at all, which is the same thing DELETE buys at the trust
                  boundary and is why R28's test (`test/m/inquiry/ground.test.mjs`)
                  asserts a caller's values are DISCARDED rather than merely
                  losing. */
               asserted_by: carry ? fmSafe(prior.asserted_by) : fmSafe(who),
               at: carry ? fmSafe(prior.at) : when,
               carried_forward: carry };
    });

    /* NOTHING MOVED, so nothing is recorded. An act that writes a reason, a
       Session Log entry and a promotion over an identical partition is a
       revision of nothing, and a record that holds one has a restructuring in
       it that never happened. */
    if (same(nextLabel.map((g) => String(g)), standingLabel.map((g) => String(g)))
        && rowsOut.every((r) => r.carried_forward)
        && standingByLabel.size === rowsOut.length
        /* R85: an empty partition is an answer the document holds (`grounds: []`), so it changes a question that holds none */
        && (rowsOut.length > 0 || Array.isArray(fm.grounds)))
      return { ok: false, reason: "PARTITION_UNCHANGED", target,
               detail: localize("inquiry.index.this_is_the_structure_this", "this is the structure this question already carries, leg for leg. Nothing was written: a revision that changes nothing would put a restructuring in the record that did not happen.") };

    /* ---------------- ONE GRAMMAR, judged before a byte moves ---------------
       The CANDIDATE frontmatter, checked by the catalog's own function over the
       same two registries op=promote injects at the write. This is the act's
       gate and the write's gate running the same rule twice on purpose (the
       checkGatheringGrammar precedent), and it is also what guarantees a label
       has passed GROUND_LABEL_RE — no quotes, no colons, no newlines — before
       any of it is written into a restricted-grammar block. */
    const grouped = nextLabel.some((g) => g !== null);
    const candidate = { ...fm,
      basis: legs.map((l, i) => {
        if (nextLabel[i] === null) { const { ground, ...rest } = l; return rest; }
        return { ...l, ground: nextLabel[i] };
      }) };
    /* R85: no ground is still an answer (DEC-32 clause 4): every supporting leg is necessary, and the document holds it as
       `grounds: []`, distinct from a question never partitioned */
    candidate.grounds = rowsOut.map((r) => ({ ground: r.ground,
      asserted_by: r.asserted_by, at: r.at, ...(r.statement === null ? {} : { statement: r.statement }) }));
    const bf = [];
    checkInquiryBasis(candidate, bf, this.#publishedRegistry(target,
      legs.map((l) => l.target).filter((t) => typeof t === "string")),
      this.legEarning.earnedForDoc(candidate, candidate.basis));
    const errs = bf.filter((x) => x.severity === "error");
    if (errs.length)
      return { ok: false, reason: "BASIS_REFUSED", target,
               findings: errs.map((x) => ({ check: x.check, ...(x.code ? { code: x.code } : {}), detail: x.message, repairs: x.repairs ?? [] })),
               detail: localize("inquiry.index.the_structure_this_would_author", "the structure this would author is refused by the SAME catalog function op=promote runs at the write, so nothing was written. Every group is a claim that its legs are enough on their own, and that claim carries a name and a date.") };

    /* ---------------------------------------------------- and now the bytes */
    /* R28: the pair before the act, from the module that holds strength (its registration); absent, said so. */
    const before = this.#strength(target);
    const spliced = spliceBasisGround(text, nextLabel);
    if (!spliced)
      return { ok: false, reason: "UNSPLICEABLE_BASIS", target,
               detail: localize("inquiry.index.this_documents_basis_block_is", "this document's basis block is not in a shape this grammar can edit in place. Nothing was written — a partial edit of a basis is worse than none.") };
    text = spliced;
    text = grounds.length
      ? setOrAddBlock(text, "grounds", rowsOut.flatMap((r) => [
          `  - ground: ${r.ground}`,
          `    asserted_by: ${r.asserted_by}`,
          `    at: "${r.at}"`,
          ...(r.statement === null ? [] : [`    statement: "${r.statement}"`])]))
      /* HELD EMPTY, not removed (R85, K5059). A question answered with no ground at all is not a question nobody has
         answered: the document wears `grounds: []`, and a basis never partitioned wears no such key. */
      : setOrAddScalar(removeBlock(text, "grounds"), "grounds", "[]");
    text = setScalar(text, "last_updated", `"${when}"`);
    /* C-13.2: last_updated moving requires a Session Log entry, and it is where
       DEC-32 clause 6's RECORD lives — this act moves no state, so there is no
       state_history entry to carry it and the log is the durable trace. THE
       PAIR AS IT STOOD BEFORE goes in beside the reason: that is the evidence a
       noticer needs (*"a weak leg moved into its own branch immediately after a
       strength drop"*), left where an append-only history keeps it rather than
       reconstructed later by something that would have to guess. */
    /* MK-2: the testimony axis joins the line ONLY when it carries something —
       the freeze's rule (publishCase), so an ordinary question's log reads
       byte for byte as it always did. */
    const w = (p) => `capture ${p.capture.state === "graded" ? p.capture.grade : p.capture.state}, `
                   + `connection ${p.connection.state === "graded" ? p.connection.grade : p.connection.state}`
                   + (p.testimony && p.testimony.state !== "unrated"
                       ? `, testimony ${p.testimony.state === "graded" ? p.testimony.grade : p.testimony.state}` : "");
    text = appendSessionLog(text,
      `### Session ${when} | ${restructure ? "Restructured" : "Grouped"} | ${who}\n`
      + `Trigger: op=inquiryground on ${target}\n`
      + `Changes: ${grounds.length ? `${rowsOut.length} group(s) over ${legs.length} leg(s) — `
          + rowsOut.map((r) => `${r.ground}: ${r.legs.join(", ")}`).join("; ")
          : `no ground; ${legs.length} leg(s) read as necessary`}.\n`
      + (restructure ? `Reason: ${why}\n` : localize("inquiry.index.first_grouping_no_earlier", "First grouping: no earlier structure to revise.\n"))
      + (before ? `Strength before: ${w(before)}.\n` : localize("inquiry.index.strength_before_not_stated", "Strength before: not stated (no module answers it here).\n")));

    /* R65: the act and the pair after it are recorded in the promotion's own transaction (the Session Log, being part of
       the bytes promoted, cannot hold the pair after), so a refusal after the write leaves neither. */
    let promoted = null, after = null;
    const refused = this.record.transact(() => {
      promoted = this.#promote({
      bundleId: target, base: b.bundle_sha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
      author: who,
      files: [mdFile(text), ...carriedFiles(this.sql, target)],
      /* NO STATE MOVES. The meta carries the document's own state forward
         unchanged — this act authors what a question rests on, not where it
         stands — which is why it is not in op-declarations' STATE_ACTIONS (`op-declarations/index.mjs`). */
      meta: { object_type: fm.object_type ?? b.object_type,
              title: fm.title, current_state: b.current_state, prior_state: fm.prior_state ?? null,
              created: fm.created, last_updated: when,
              criticality: fm.criticality ?? null },
      });
      if (!promoted.ok) return { ...promoted, target };
      after = this.#strength(target);
      const json = (v) => (v ? JSON.stringify(v) : null);
      this.sql.exec(`INSERT INTO inquiry_ground_changes (bundle_id, at, by, act, reason, groups, strength_before, strength_after)
                     VALUES (?,?,?,?,?,?,?,?)`, target, when, who, restructure ? "restructured" : "authored",
        restructure ? why : null, JSON.stringify(rowsOut.map((r) => ({ ground: r.ground, statement: r.statement,
          asserted_by: r.asserted_by, at: r.at, legs: r.legs }))), json(before), json(before && after ? after : null));
      return null;
    });
    if (refused) return refused;

    /* `weight: "single"` for conclude's reason, and here it is load-bearing
       rather than conventional: one question's structure is authored at a time,
       and a bulk grouping would raise a set of grades with one sentence
       standing for all of them. */
    return { ok: true, target, act: restructure ? "restructured" : "authored",
             grouped, grounds: rowsOut, legs: legs.length,
             reason: restructure ? why : null, asserted_by: who, at: when, weight: "single",
             bundleSha: promoted.bundleSha,
             /* DEC-32 clause 6's noticing material, returned as well as
                recorded. NOT a judgement: the act reports what the pair was and
                what it is, and says nothing about why the member moved. */
             /* MK-2: every axis, from the one list — a third axis moved by a
                restructure is the same noticing material as the other two. */
             ...(before && after
               ? { strength: { before, after } }
               : { strength_absent: word("inquiry.strength_absent") }),
             next: grouped
               ? word("inquiry.next.group_strength_weakest")
               : word("inquiry.next.question_reads_weakest") };
  }


  /** R65 (T50; N1124; DEC-32 clauses 3, 5, 6): a question's partition with the history of its changes, for the question
   *  page: `{ok: true, id, grouped, groups, ungrouped, changes, strength_now}` and R60's `projects`. `groups` and
   *  `ungrouped` are the document's (R27's ordinals); `changes` the `ground` acts recorded for it, oldest first, each
   *  `{at, by, act, reason, groups, strength_before, strength_after, strength_after_recorded}`: an act made since the
   *  table records them keeps both pairs as they stood at the act; one made before is read from the Session Log with
   *  its pair before and `strength_after: null` (`strength_after_recorded: false`), never computed. `strength_now` is the
   *  pair now; where no module answers strength, the pairs are null and `strength_absent` says so (R28). A question the
   *  viewer may not see, or that is no question, is answered as an absent one (R33). A divided or published question is
   *  read. Writes nothing; never throws. */
  partitionOf({ id = null, viewer = null } = {}) {
    try {
      if (!id || typeof id !== "string" || this.membership.inSight(id, viewer) !== true)
        return { ok: false, reason: "NO_SUCH_BUNDLE", target: id ?? null };
      const info = this.record.bundleInfo(id);
      if (!info) return { ok: false, reason: "NO_SUCH_BUNDLE", target: id };
      if (normalizeType(info.type) !== "inquiry") return { ok: false, reason: "NOT_AN_INQUIRY", target: id };
      const md = this.record.readFile(id, "bundle.md");
      const fm = md && typeof md.text === "string" ? parseFrontmatter(md.text).data : null;
      if (!fm || typeof fm !== "object") return { ok: false, reason: "NO_DOCUMENT", target: id };
      const rows = this.#rows(`SELECT * FROM inquiry_ground_changes WHERE bundle_id=? ORDER BY change_id`, id);
      const held = new Set(rows.map((r) => `${r.at}\u0000${r.by}`));
      const changes = [...loggedChanges(md.text, (at, by) => held.has(`${at}\u0000${by}`)),
        ...rows.map((r) => ({ at: r.at, by: r.by, act: r.act, reason: r.reason ?? null, groups: safeJson(r.groups) ?? [],
          strength_before: safeJson(r.strength_before), strength_after: safeJson(r.strength_after),
          strength_after_recorded: true }))];
      const now = this.#strength(id);
      return { ok: true, id, ...partitionOfDoc(fm), changes, strength_now: now,
               ...(now === null ? { strength_absent: word("inquiry.strength_absent") } : {}), ...this.#projectsField(id, viewer) };
    } catch { return { ok: false, reason: "NO_SUCH_BUNDLE", target: typeof id === "string" ? id : null }; }
  }

  /* R43: the inquiry's recorded subject, the column R12 writes from the document into this module's table (R40), or
     null; never throws. The bytes stay the authority: the write path and the gate read the document's own
     `subject_entity` (`earnedForDoc`), because at promote time the column has not been written yet. */
  subjectEntityOf(bundleId) {
    try {
      const row = this.#one(`SELECT inquiry_subject_entity FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, bundleId);
      return row && row.inquiry_subject_entity ? row.inquiry_subject_entity : null;
    } catch { return null; }
  }

}

const instances = new WeakMap();

/** The one inquiry instance for `host` (the Durable Object's `ctx`); `deps` are read on the first call only. */
export function inquiryOf(host, deps) {
  let k = instances.get(host);
  if (!k) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const content = d.content || contentOf(host, { record, membership });
    k = new Inquiry({ ...d, host, storage: d.storage || host.storage, record, membership, promotion, content });
    instances.set(host, k);
    /* R12 (K1505 (2)): leg-earning, which creates and declares `inquiry_basis`, exists before any promotion projects */
    void k.legEarning;
    record.declareTable("inquiry", INQUIRY_DECLARATIONS.map((d) => ({ ...d })));
    /* K783 (record-core R69, R45): the audit's context for each bundle's checks, the earned registry over the legs its
       basis projects (R13), null for a bundle resting on nothing. */
    if (typeof record.registerAuditContext === "function")
      record.registerAuditContext("inquiry", (id) => {
        const targets = [...k.sql.exec(`SELECT target_id FROM inquiry_basis WHERE bundle_id=?`, id)].map((r) => r.target_id);
        return { earnedRegistry: targets.length ? k.legEarning.earned(k.subjectEntityOf(id), targets) : null };
      });
    promotion.registerStep("inquiry", { check: (c) => k.check(c), project: (c) => k.project(c) });
    if (typeof content.onStale === "function") content.onStale("inquiry", (notice) => k.staled(notice));
    /* R36 (N136): the `legs` field read from this module's table (retrieval R62); N405: the migrated arm of
       `surfaced_in` on retrieval's single-bundle answer (its R56). Retrieval is created at start before any module
       reaches this one; a stand-in that offers neither registration is left alone. */
    const retrieval = k.retrieval;
    if (retrieval && typeof retrieval.registerField === "function")
      retrieval.registerField("inquiry", "legs", LEGS_RELATION);
    if (retrieval && typeof retrieval.registerProjectionDecoration === "function")
      retrieval.registerProjectionDecoration("inquiry", (row, ctx) => {
        if (!row || normalizeType(row.object_type) !== "inquiry") return {};
        const m = k.migratedSurfacing(row.bundle_id);
        /* R60 (H38): the question's document, read by a viewer, answers the projects R14 shows her */
        return { ...(m ? { surfaced_in: m } : {}), ...k.projectsOf(row.bundle_id, ctx && ctx.viewer) };
      });
    /* R60 (T42; N830; retrieval R78): a question's row in a `search` page answers the projects R14 shows the viewer; a
       row that is no question gains nothing. Synchronous, one entry per hit, keys R6's hit does not hold. */
    if (retrieval && typeof retrieval.registerSearchDecoration === "function")
      retrieval.registerSearchDecoration("inquiry", (hits, ctx) => hits.map((h) =>
        (h && normalizeType(h.object_type) === "inquiry" ? k.projectsOf(h.bundle_id, ctx && ctx.viewer) : null)));
  }
  return k;
}

/** R52 (2) (K861, plane R10): the resolver `retrieval`'s `registerLegGrades` takes, `(legs) => grades`, over the one
 *  instance for `host` (reached when the resolver is called, not when it is built). `plane` registers it under this
 *  module's name, `inquiry`; this module registers it nowhere itself. */
export function inquiryLegGrades(host) {
  return (legs) => inquiryOf(host).legGrades(legs);
}

/** R53 (A9, bias R40): this module's findings as bias's work products, for `plane` to register at start with the host's
 *  bias under this module's kind, `finding` (`registerWorkProducts("finding", inquiryFindings(host, bias))`, bias R33),
 *  as it registers R52's shares; the module registers nothing itself. Binds `bias` as the instance a finding's lens is
 *  read from (`bindBias`). The source reaches the one instance for `host` when it is asked. */
export function inquiryFindings(host, bias = null) {
  if (bias) inquiryOf(host).bindBias(bias);
  const src = () => inquiryOf(host).workProducts();
  return { list: (after, limit) => src().list(after, limit), read: (key) => src().read(key),
           visible: (key, viewer) => src().visible(key, viewer) };
}

/** Which purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function inquiryOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return INQUIRY_TABLES.includes(name);
}

/* R86 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their
   owner beside the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  inquirydivide: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.inquirydivide.does",
    fields: { accepts: ["target","reason","children"], requires: ["target","reason","children"] } },
  inquiryground: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.inquiryground.does",
    fields: { accepts: ["target","grounds","reason"], requires: ["target","grounds"] } },
});

/* The Durable Object routes this module answers (K3), as entries of plane's op map. `url` carries the control
   plane's stamps (`viewer`, `owner`, `author`); `body` the authored material. The stamps are spread AFTER the body, so a
   caller's `author` in the body is overwritten, never honoured, and a caller's `asserted_by`/`at` reach no act. */
export function inquiryOps(k, url, body) {
  const q = (key) => url.searchParams.get(key);
  const b = body && typeof body === "object" ? body : {};
  return {
    /* R16: in-process reads; the control plane routes neither (Suggestions). */
    basis: () => k.basisFor(q("id")),
    restson: () => k.restingOn(q("id")),
    earnedbasis: () => k.earnedBasis({ id: q("id"), targets: q("targets"), viewer: q("viewer") }),
    dispose: () => k.dispose({ handle: q("handle"), to: q("to"), reason: q("reason"), viewer: q("viewer"),
                               owner: q("owner"), author: q("author") }),
    inquirydivide: () => k.divide({ ...b, target: q("target") || b.target, viewer: q("viewer"), author: q("author") }),
    inquiryground: () => k.ground({ ...b, target: q("target") || b.target, viewer: q("viewer"), author: q("author") }),
    /* R65 (T50; N1124): a question's partition with the history of its changes */
    inquirypartition: () => k.partitionOf({ id: q("id") || b.id, viewer: q("viewer") }),
    /* R55 (T41; D17): every wait on a question, to a viewer who may see it */
    questionwaits: () => k.questionWaits({ question: q("question") || b.question, viewer: q("viewer"),
                                           asOf: q("asOf") || null }),
    /* R56: the look is the stamped member's own (`by` from the stamp, never the body). */
    waitlook: () => k.waitLook({ inquiry: q("inquiry") || b.inquiry, index: q("index") ?? b.index, note: b.note ?? null,
                                 by: q("author") }),
  };
}
