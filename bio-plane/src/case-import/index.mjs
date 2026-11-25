/* case-import — another group's case file, imported into a read-only project (requirements:
 * `build/requirements/case-import.md` R1–R24; DEC-112 (6), DEC-96 items 1, 2, 4, DEC-92, DEC-45, DEC-46 (3), DEC-101 (3),
 * DEC-116 item 8; `BIO_Publication_v0_1.md` §5A, §5C "Import"; N520, N522, N534, K1256, K1257, K1273, K1339, K1366).
 *
 * A member imports another group's case file (R1). The copy holds it as an IMPORT, one per source group, case and lens,
 * its id the SHA-256 of canonical `{group, case, lens}`, with each EDITION side by side and never replaced. It confirms
 * each finding by recreating it through `case-checker` and records each result (R3); it shows each finding against
 * this group's own bar, never the source's as this group's (R4, R11). A document fetched later that matches a missing
 * material's fingerprint completes it, and the edition is checked again (R5). The group may accept an edition for the
 * findings that recreated, by a reasoned act, and withdraw that acceptance, and may flag and clear issues on it (R6–R8).
 * Recreating is not endorsing, and an acceptance changes no grade.
 *
 * Each calculation the case carries is recreated too, never trusted (R21; C:A-14, K1448): its recipe is evaluated again
 * by `calc-grammar` over the inputs the case file carries, each first checked against its stated SHA-256, and recorded
 * `recreated`, `differs` or `not_recreated`. The source's stated values are held only as the source's statement, beside
 * what was recomputed; no act here writes a `CALC-`, a money fact or any record row from them.
 *
 * An edition may be accepted whole (R22; D62): `findings: "all"` accepts, in one act with one reason, every finding that
 * recreated and each recreated in part with its gaps stated, and answers the rest with why. Each finding is also read under
 * this group's own lens (R23; D59): the statements in force here (`bias` R49), the case's applications of them applied and
 * the rest read as removed, re-weighed by `case-checker` (its R23) beside the source's lens and this group's bar; an
 * undetermined statement is stated, never read as false, and nothing about the finding changes.
 *
 * A member may watch an import (R17): `monitoring` then reads the publisher's public docket for that case daily and hands
 * each read to `recordDocketRead` (R18), which verifies each new entry (its digest and form, its signature against the
 * key it embeds, labeled `key_listed` when a held manifest lists that key, and its chain) and records it verified or
 * refused. A verified new edition or withdrawal is a publisher move: `reevaluation` is told of it (its R33) and reads the
 * moves through `accepted-work` (R16's `moves`). Every other entry reaches only the watch's setter (R20). The reads say
 * what was seen and when a docket could not be read, never that nothing changed (R19).
 *
 * Nothing an import holds is a record bundle (R2): it lives in this module's own tables, append-only (R12), and no act
 * here edits, promotes, ratifies or publishes it. `accepted-work` (layer 6) reads it for the modules before this one
 * through the registration this module fills at start (R16, R24); `case-authoring` reads `acceptanceOf` and `openFlagsOn`
 * directly (R9).
 *
 * (T51; K4169; UC-076) A member may read an imported edition under another lens (R27, R28): `regradeImported` re-weighs it
 * through `case-checker`'s `reweigh` as published, with the source's bias removed, or under this group's own lens, and
 * names for each finding the statement that moved it. A project of this group may be declared a rerun of an imported
 * edition by its owner (R29), a member of the project may pair one of its findings with one of the source's (R30), and
 * `rerunRead` (R31) shows the pairs side by side with the difference between the two printed lenses, as a difference the
 * system computed and never a cause it established. None of it edits an import, a bundle or a grade (R32).
 *
 * A NEW MODULE (T28, layer 8, directly after `case-checker`). REACHED as `caseImportOf(host, deps)` (K61): one instance
 * per host. At creation it creates its tables, declares them to record-core's purge (whole store only, R13), registers
 * its figures (record-core R63) and fills `accepted-work`'s registration (R16). `deps` (each reached through its factory
 * on the same host unless given; a test passes its own):
 *   record          `transact`, `declarePurge`, `registerCounts`.
 *   membership      `positionalMember`, `memberFacts`, `isAdministrator` (who is an active member of this group).
 *   strength        `strengthBarOf` (its R16): this group's default bar (R4).
 *   acceptedWork    `registerAcceptedWork` (its R1; R16).
 *   reevaluation    `acceptanceWithdrawn` (its R31; R7), `citedCaseMoved` (its R33; R18).
 *   checkCaseFile   `case-checker.checkCaseFile` (its R1), pure; it answers a promise. Default: case-checker's own.
 *   bias            `statementInForce` (its R49; R23), synchronous.
 *   reweigh         `case-checker`'s synchronous re-weighing under a reader lens (its R23; R23 here). Default: its own.
 *   caseFileManifestCheck   `case-grammar.caseFileManifestCheck` (its R13), pure.
 * (T46; N903) An import may carry the source's `group_fields` (`public-read` R34), read by the caller at `read_at`: they
 * are recorded with the edition, the source's own statement, when in R34's shape and naming the manifest's group, and
 * answered per edition (R4); they never refuse an import, and nothing is fetched. No edge to `public-read`: its shape only.
 *   now             the clock, milliseconds (default `env.BIO_NOW_MS`, else the wall clock).
 *
 * The words a member sees (the origin marks, "another group's", the statement that recreating is not endorsing) are the
 * UX design stream's; this module answers facts and the checker's statement, never their final words. No place is named
 * here (R15). */

import { recordOf, stampInstant, instantOrder } from "../record-core/index.mjs";
import { membershipOf, Membership, noSuchProject } from "../membership/index.mjs";
import { strengthOf } from "../strength/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { acceptedWorkOf } from "../accepted-work/index.mjs";
import { importedFindingRef, parseImportedFindingRef } from "../inquiry-grammar/index.mjs";
import * as caseGrammar from "../case-grammar/index.mjs";
import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { createSha256, sha256HexSync } from "../record-grammar/sha256.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { BASIS_GRADES } from "../record-grammar/index.mjs";
import { isPublicHttpsLocator } from "../record-grammar/index.mjs";
import { verifySshsig, NS_DOCKET, docketStatement, normalizeKey } from "../sshsig.mjs";
import { DOCKET_UNREADABLE, ENTRY_FORMATS } from "../docket/index.mjs";
import { CASE_IMPORT_CHECKS, rowOf } from "./checks.mjs";
import { say } from "./words.mjs";
import { boundOf } from "../read-bounds.mjs";
import { CASE_IMPORT_TABLES, BLOB_CHUNK, migrateCaseImport } from "./schema.mjs";
import * as caseChecker from "../case-checker/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { evaluate as evaluateRecipe, resultKey, METHOD as CALC_METHOD } from "../calc-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";

const { checkCaseFile, readCaseFile } = caseChecker;

export { CASE_IMPORT_CHECKS } from "./checks.mjs";
export { CASE_IMPORT_SCHEMA, CASE_IMPORT_TABLES } from "./schema.mjs";

/* ---------------------------------------------------------------- the vocabularies and bounds */

/** `case-checker` R11's results. */
export const RESULTS = Object.freeze(["recreated", "recreated_in_part", "did_not_recreate"]);
/** R1: the part bound, `public-read` R5's 64 MiB. */
export const PART_MAX = 64 * 1024 * 1024;
/** R6–R8: a member's words, DEC-88's bound. */
export const WORDS_MAX = 2000;
/** R16: the most withdrawals one page answers, and the default. */
export const WITHDRAWALS_PAGE_MAX = 1000, WITHDRAWALS_PAGE = 200;
/** R4: the label every statement of the source's own bar carries (DEC-45). */
export const SOURCE_BAR = say("case-import.source_bar");
/** R23: the labels of the two lenses an edition is read under (DEC-45's kind: the source's is never this group's). */
export const SOURCE_LENS = say("case-import.source_lens");
export const OWN_LENS = say("case-import.own_lens");
/** R23 (`case-checker` R23): the limit every re-weighing states. */
export const LENS_LIMIT = say("case-checker.lens_limit_statement");
/** R23: undetermined, stated and never read as false (`bias` R49's `in_force: null`). */
export const LENS_UNDETERMINED = say("case-import.lens_undetermined");
/** R23: when the re-weighing could not be made. */
export const LENS_NOT_REWEIGHED = say("case-import.lens_not_reweighed");
/** R4: this group's own bar, the group default, when none is set (K1134 reading 3). */
export const NO_OWN_BAR = say("case-import.no_own_bar");
/** R1 (`case-checker` R1): the checker's statement when no answer carries one; its words are the UX stream's. */
export const STATEMENT = say("case-import.statement");
/** R22 (D62): the `findings` value that takes every finding of the edition. */
export const ALL_FINDINGS = "all";
/** R22: why a finding was not accepted under `findings: "all"`. */
export const NOT_ACCEPTED_WHY = Object.freeze({
  did_not_recreate: say("case-import.did_not_recreate"),
  gaps_unstated: say("case-import.gaps_unstated"),
});
const AXES = Object.freeze(["capture", "connection", "testimony"]);
const ID = { acceptance: "IMA", withdrawal: "IMW", flag: "IMF", move: "IMM", rerun: "IMR", pairing: "IMQ" };
/** R18 check 1: the docket entry's format, one format under two labels, as `docket` spells them (its R6; DEC-124, K1365). */
export const DOCKET_ENTRY_FORMATS = ENTRY_FORMATS;
/** R17: the query a watch's docket address carries: the route `public-read` R21 and R25 serve, answering `docket` R24's
 *  public answer (N951). */
export const docketAddressOf = (publisher, caseId) =>
  `${publisher}?op=docketpublic&case=${encodeURIComponent(caseId)}&captures=omit`;
/** R18: the two kinds of verified entry that are publisher moves (K1339, K1366 F1). */
export const MOVE_KINDS = Object.freeze(["edition", "withdrawal"]);
/** R18: the outcomes of a docket read, and the checks an entry can fail. */
export const READ_OUTCOMES = Object.freeze(["read", "unreadable"]);
export const ENTRY_CHECKS = Object.freeze(["digest", "form", "signature", "chain", "seq"]);
/** R16, R18: the most watches or moves one page answers, and the default. */
export const WATCH_PAGE_MAX = 200;
/** R19: what an import's reads say beside a `publisher` of null (DEC-116 item 8: never that nothing changed). */
export const NO_MOVE_SEEN = say("case-import.no_move_seen");
export { DOCKET_UNREADABLE };

/* ================================================================ R27–R31 (T51; K4169): regrade and rerun */

/** R27: the lenses an edition can be regraded under: R23's three. */
export const REGRADE_LENSES = Object.freeze(["as_published", "removed", "own"]);
/** R27: the sentence a finding the case file records no application for carries (nothing in any lens touches it). */
export const REGRADE_UNTOUCHED = localize("case-import.index.nothing_in_lens_touches", "nothing in the lens touches this finding: the case file records no statement applied to it");
/** R28: `own` with no group statement in force reads as `removed`, and says so. */
export const REGRADE_NO_OWN_LENS = localize("case-import.index.team_lens_holds_none", "this team's lens holds none of the statements this case applies, so under it every one reads as removed");
/** R31: what every rerun read states about the disagreement it names. */
export const RERUN_DISAGREEMENT = localize("case-import.index.disagreement_is_lens_difference", "the disagreement shown is the difference between the two printed lenses and the members' pairings, not a cause the system established");
/** R31: when a lens cannot be read, the difference between the two is not stated, and never read as none. */
export const RERUN_LENS_UNREADABLE = localize("case-import.index.lens_difference_not_stated", "a lens could not be read, so the difference between the two lenses is not stated");
/** R31: the axes a pairing compares. */
const PAIR_AXES = Object.freeze(["capture", "connection"]);
/** R30: the most findings of a project read, and the page. */
const PROJECT_FINDINGS_PAGE = 500;

/* ================================================================ R4 (T46; N903): the source group's identity and stake */

/** R4 (`public-read` R34): the keys of a group's `group_fields`, and the instant the caller read them. */
export const GROUP_FIELD_KEYS = Object.freeze(["group", "name", "domain", "domain_verified_at", "stake", "detail"]);
/** R4: the label the recorded fields carry: the source's declaration as current when read, never as of the signing. */
export const GROUP_FIELDS_LABEL = say("case-import.group_fields_label");
/** R4: why an edition answers `group_fields: null` (never a guess; `conformance` R32 reads identity null, stake undetermined). */
export const GROUP_FIELDS_NONE = say("case-import.group_fields_none");
/* R4: the bounds this module keeps on what it records (R34 states none): a text field, and the stake as held. */
const GROUP_TEXT_MAX = 2000, GROUP_STAKE_MAX = 8192;

/** R25 (`public-read` R36): the keys of a matter stake as the source's `groupFields` carries it. */
export const MATTER_STAKE_KEYS = Object.freeze(["stake", "set_by", "set_at", "source"]);

/** R25: a `matter_stake` as given, checked against `public-read` R36's shape: `null`, or `{stake, set_by, set_at, source:
 *  "project"}` (an unread stake is `stake: "undetermined"` with `set_by` and `set_at` null). Answers `{value}` to record, or
 *  `{malformed: true}`, never a refusal. Pure; never throws. */
function matterStakeOf(v) {
  try {
    if (v === null) return { value: null };
    if (!isObj(v)) return { malformed: true };
    const keys = Object.keys(v);
    if (keys.length !== MATTER_STAKE_KEYS.length || !MATTER_STAKE_KEYS.every((k) => Object.hasOwn(v, k))) return { malformed: true };
    const text = (x) => typeof x === "string" && x.length > 0 && x.length <= GROUP_TEXT_MAX && !LONE_SURROGATE.test(x);
    const orNull = (x) => x === null || text(x);
    if (!text(v.stake) || !orNull(v.set_by) || !orNull(v.set_at) || v.source !== "project") return { malformed: true };
    return { value: { stake: v.stake, set_by: v.set_by, set_at: v.set_at, source: v.source } };
  } catch { return { malformed: true }; }
}

/** R4: the source group's `group_fields` as given with an import, checked against `public-read` R34's shape and the slug
 *  the manifest names. Answers `{fields, read_at}` to record, or `{why}` naming why they are not recorded. Pure; never
 *  throws. Absent fields answer `{why: "none_given"}`. R25: the fields may also carry `matter_stake` (R36's shape or
 *  `null`); `fields.matter_stake` is it as recorded, `null` when absent or malformed, and `matter_stake_malformed` marks
 *  a malformed one, which never makes the other fields unrecorded. */
export function groupFieldsOf(given, manifestGroup) {
  try {
    if (given === null || given === undefined) return { why: "none_given" };
    if (!isObj(given)) return { why: "not_an_object" };
    const extra = Object.keys(given).filter((k) => !GROUP_FIELD_KEYS.includes(k) && k !== "read_at" && k !== "matter_stake");
    const absent = [...GROUP_FIELD_KEYS, "read_at"].filter((k) => !Object.hasOwn(given, k));
    if (extra.length || absent.length) return { why: "not_its_shape", ...(extra.length ? { extra } : {}), ...(absent.length ? { absent } : {}) };
    const text = (v) => v === null || (typeof v === "string" && v.length <= GROUP_TEXT_MAX && !LONE_SURROGATE.test(v));
    const bad = ["group", "name", "domain", "domain_verified_at", "detail"].filter((k) => !text(given[k]));
    let stakeJson = null;
    try { stakeJson = canonicalJson(given.stake); } catch { stakeJson = null; }
    if (given.stake === undefined || typeof stakeJson !== "string" || stakeJson.length > GROUP_STAKE_MAX || LONE_SURROGATE.test(stakeJson))
      bad.push("stake");
    if (bad.length) return { why: "not_its_shape", malformed: bad };
    if (given.group !== manifestGroup) return { why: "another_group" };
    const ms = typeof given.read_at === "string" ? Date.parse(given.read_at) : NaN;
    if (!Number.isFinite(ms) || ms < 0) return { why: "no_read_at" };
    const fields = {};
    for (const k of GROUP_FIELD_KEYS) fields[k] = k === "stake" ? JSON.parse(stakeJson) : given[k];
    const matter = given.matter_stake === undefined ? { value: null } : matterStakeOf(given.matter_stake);
    fields.matter_stake = matter.malformed ? null : matter.value;
    return { fields, read_at: stampInstant("second", ms), ...(matter.malformed ? { matter_stake_malformed: true } : {}) };
  } catch { return { why: "not_its_shape" }; }
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const words = (v) => typeof v === "string" && !!v.trim() && v.length <= WORDS_MAX && !LONE_SURROGATE.test(v);
const int = (v) => {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^[1-9][0-9]{0,8}$/.test(v.trim())) return Number(v.trim());
  return null;
};
const isSha = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const parse = (s, dflt = null) => { if (s && typeof s === "object") return s; try { return JSON.parse(s); } catch { return dflt; } };
const idOf = (kind, rn) => `${ID[kind]}-${rn}`;
const rnOf = (kind, id) => {
  const m = typeof id === "string" ? new RegExp(`^${ID[kind]}-([1-9][0-9]{0,15})$`).exec(id.trim()) : null;
  return m ? Number(m[1]) : null;
};

/** The SHA-256 of bytes, lowercase hex (record-grammar R20). */
export function shaOf(bytes) { return createSha256().update(bytes).hex(); }

/** Bytes as given: a `Uint8Array`, an `ArrayBuffer`, a byte array, or standard base64 text; null for anything else. */
export function bytesOf(v) {
  try {
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    if (Array.isArray(v) && v.every((b) => Number.isInteger(b) && b >= 0 && b < 256)) return Uint8Array.from(v);
    if (typeof v === "string" && /^[A-Za-z0-9+/\s]*={0,2}\s*$/.test(v)) {
      const bin = atob(v.replace(/\s+/g, ""));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch { /* not bytes */ }
  return null;
}

/* DEC-49: a refusal of this module's own carries its code, its row and the member's translation. */
export function withRow(r) {
  if (!r || typeof r !== "object" || r.ok !== false || typeof r.reason !== "string" || r.check) return r;
  const row = rowOf(r.reason);
  return row ? { ...r, code: r.code ?? r.reason, check: row.check, translation: row.translation } : r;
}
const refuse = (code, detail, extra) => withRow({ ok: false, reason: code, detail, ...(extra || {}) });

/** The import id (Provides, "An import"): the SHA-256 of canonical JSON `{group, case, lens}`. */
export function importIdOf({ group, case: caseId, lens }) {
  return sha256HexSync(canonicalJson({ group, case: caseId, lens: lens ?? null }));
}

/* R4: a bar's declared axes, `{axis: letter}`, or null for no bar. */
function barAxes(bar) {
  if (!isObj(bar)) return null;
  const out = {};
  for (const axis of ["capture", "connection"]) if (BASIS_GRADES.includes(bar[axis])) out[axis] = bar[axis];
  return Object.keys(out).length ? out : null;
}
/** R4: a finding against a bar, as `case-checker` R6 reads it, through `case-grammar`'s one spelling (`standingOf`, its
 *  R15): `no_bar` with no axis declared, `not_asked` for a supporting finding, else whether each declared axis is
 *  reached, `short` naming each axis that is not. */
export function againstBar(role, pair, bar) {
  const s = caseGrammar.standingOf({ role, bar, pair });
  return { meets: s.meets, bar: s.bar, short: s.short };
}

/* R16 (`accepted-work` R1): a finding's per-axis pair as its published bytes freeze it (`published_strength`). */
function publishedPairOf(fm) {
  const rows = isObj(fm) && Array.isArray(fm.published_strength) ? fm.published_strength : null;
  if (!rows) return null;
  const pair = {};
  for (const r of rows) if (isObj(r) && AXES.includes(r.axis) && !(r.axis in pair))
    pair[r.axis] = { state: typeof r.state === "string" ? r.state : null, grade: BASIS_GRADES.includes(r.grade) ? r.grade : null };
  return Object.keys(pair).length ? pair : null;
}

/* R5: the fingerprints a `missing` entry names: each 64-hex value it carries (a material's or a file's SHA-256). */
function fingerprintsOf(entry, out = new Set(), depth = 0) {
  if (depth > 4) return out;
  if (typeof entry === "string") { for (const m of entry.match(/\b[0-9a-f]{64}\b/g) || []) out.add(m); return out; }
  if (Array.isArray(entry)) { for (const x of entry) fingerprintsOf(x, out, depth + 1); return out; }
  if (isObj(entry)) for (const v of Object.values(entry)) fingerprintsOf(v, out, depth + 1);
  return out;
}

/* ================================================================ R21: a carried calculation, recreated */

/** R4, R21: the label every statement of a source's calculation carries: its values are the source's (DEC-45's kind). */
export const SOURCE_CALCULATION = say("case-import.source_calculation");
/** R21: a calculation's results as recreated here. */
export const CALC_RESULTS = Object.freeze(["recreated", "differs", "not_recreated"]);
/* `case-checker` R20's answers, read against R21's. */
const CHECKER_CALC = { agrees: "recreated", differs: "differs", not_recomputed: "not_recreated" };
/* The most bytes one carried input is read as (a table within a Worker's heap, as `calculations` R1 bounds a table). */
export const CALC_INPUT_MAX = boundOf("table", "bytes");

/* R21: a row's inputs as `[{name, sha}]` (a list of `{name, sha256}` or a `{name: sha}` map), or null. */
function inputsOfRow(v) {
  const list = Array.isArray(v) ? v.map((x) => (isObj(x) ? { name: str(x.name), sha: x.sha256 ?? x.sha ?? null } : null))
    : isObj(v) ? Object.entries(v).map(([name, sha]) => ({ name: str(name), sha })) : null;
  return list && list.every((x) => x && x.name) && new Set(list.map((x) => x.name)).size === list.length ? list : null;
}

/* R21: the source's stated values, compared by name. `case-grammar` R18's "results by key": the result stored under the
   row's result key, compared as its output, as `case-checker` R20 reads it (a key-addressed map without that key states
   no result). Else `calculations` R4's stored shape, `output` and each named step, or a plain map read as steps of those
   names. */
function statedValues(results, resultKeyStated) {
  if (!isObj(results)) return null;
  const out = new Map();
  const keys = Object.keys(results);
  if (keys.length && keys.every((k) => isSha(k))) {
    out.set("output", typeof resultKeyStated === "string" && Object.hasOwn(results, resultKeyStated) ? results[resultKeyStated] : undefined);
    return out;
  }
  if ("output" in results || isObj(results.steps)) {
    if ("output" in results) out.set("output", results.output);
    if (isObj(results.steps)) for (const [k, v] of Object.entries(results.steps)) out.set(`steps.${k}`, v);
  } else for (const [k, v] of Object.entries(results)) out.set(k === "output" ? "output" : `steps.${k}`, v);
  return out.size ? out : null;
}

/** R21: recreates each calculation a case carries, never trusting it. Each row's recipe is evaluated by `calc-grammar`
 *  (the evaluator `calculations.evaluate` runs, which writes nothing) over the inputs the case file carries, each found
 *  by the SHA-256 the row states among the case file's files and the documents supplied for it, and first checked
 *  against that hash. Each answers `{calc, result, missing[], differs[], recomputed, stated}`: `recreated` when every
 *  result and the result key recompute equal, `differs` naming each result with the source's value and the recomputed
 *  one, `not_recreated` naming each input missing or differing from its hash, or a method version this copy does not
 *  hold. `stated` is the source's statement, held only as the source's. Pure: it reads nothing but its arguments, writes
 *  nothing and never throws. `files` are `{path, sha256, content, detail?}` (the manifest's stated SHA-256 beside the
 *  bytes; a file whose bytes differ from it carries `content: null`, as `case-checker` R19 reads one); `documents` are
 *  bytes. */
export function recreateCalculations({ rows = [], files = [], documents = [] } = {}) {
  const byContent = new Map(), byStated = new Map();
  for (const f of Array.isArray(files) ? files : []) {
    if (!isObj(f)) continue;
    /* a file the reader found differing from its manifest row carries no content (`case-checker` R19) */
    const got = f.content instanceof Uint8Array ? shaOf(f.content) : null;
    if (got && !byContent.has(got)) byContent.set(got, f.content);
    if (isSha(f.sha256) && got !== f.sha256 && !byStated.has(f.sha256))
      byStated.set(f.sha256, { path: f.path ?? null, got, detail: typeof f.detail === "string" ? f.detail.slice(0, 400) : null });
  }
  for (const d of Array.isArray(documents) ? documents : []) {
    const b = bytesOf(d);
    if (b) { const got = shaOf(b); if (!byContent.has(got)) byContent.set(got, b); }
  }
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((row, ord) => {
    try { out.push(recreateOne(row, ord, byContent, byStated)); }
    catch (e) {
      out.push({ calc: isObj(row) ? str(row.calc) ?? `#${ord + 1}` : `#${ord + 1}`, result: "not_recreated", differs: [], recomputed: null,
                 missing: [{ what: "evaluation", why: say("case-import.why.evaluated", { e: String(e && e.message || e).slice(0, 200) }) }],
                 stated: statedOf(row) });
    }
  });
  return out;
}
function statedOf(row) {
  const r = isObj(row) ? row : {};
  return { whose: "source", label: SOURCE_CALCULATION, method_version: r.method_version ?? null, results: r.results ?? null,
           result_key: r.result_key ?? null, recompute: r.recompute ?? null, disclosed: r.disclosed ?? null };
}
function recreateOne(row, ord, byContent, byStated) {
  const calc = isObj(row) ? str(row.calc) ?? `#${ord + 1}` : `#${ord + 1}`;
  const stated = statedOf(row);
  const missing = [];
  const done = (result, differs = [], recomputed = null) => ({ calc, result, missing, differs, recomputed, stated });
  if (!isObj(row)) { missing.push({ what: "row", why: say("case-import.why.case_states_calculation") }); return done("not_recreated"); }
  const method = str(row.method_version);
  if (method !== CALC_METHOD)
    missing.push({ what: "method_version", method_version: method, why: method
      ? say("case-import.why.group_civicsmith_hold", { method, calc_method: CALC_METHOD })
      : say("case-import.why.case_states_method") });
  const recipe = isObj(row.recipe) ? row.recipe : null;
  if (!recipe) missing.push({ what: "recipe", why: say("case-import.why.case_states_recipe") });
  const inputs = inputsOfRow(row.inputs);
  if (!inputs) missing.push({ what: "inputs", why: say("case-import.why.case_states_list") });
  const bound = {}, hashes = {};
  for (const inp of inputs || []) {
    hashes[inp.name] = inp.sha;
    if (!isSha(inp.sha)) { missing.push({ input: inp.name, sha: null, why: localize("case-import.index.case_states_no_sha", "the case states no SHA-256 for this input") }); continue; }
    let b = byContent.get(inp.sha);
    if (!b) {
      const listed = byStated.get(inp.sha);
      missing.push(listed
        ? { input: inp.name, sha: inp.sha, carried: listed.got, path: listed.path, why: say("case-import.why.file_carried_input"),
            ...(listed.detail ? { detail: listed.detail } : {}) }
        : { input: inp.name, sha: inp.sha, why: localize("case-import.index.case_file_lacks_input", "the case file does not carry this input; bytes with this SHA-256 complete it") });
      continue;
    }
    if (b.length > CALC_INPUT_MAX) { missing.push({ input: inp.name, sha: inp.sha, why: say("case-import.why.input_over_bytes", { calc_input_max: CALC_INPUT_MAX }) }); continue; }
    const v = (() => { try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b)); } catch { return undefined; } })();
    if (v === undefined) { missing.push({ input: inp.name, sha: inp.sha, why: say("case-import.why.input_bytes_canonical") }); continue; }
    bound[inp.name] = v;
  }
  if (missing.length) return done("not_recreated");
  const e = evaluateRecipe(recipe, bound, {});
  if (!isObj(e) || e.refused) {
    missing.push({ what: "evaluation", refused: isObj(e) ? e.refused : null,
                   why: say("case-import.why.calc_grammar_evaluate", { why: isObj(e) && e.why ? `: ${e.why}` : "" }) });
    return done("not_recreated");
  }
  const key = resultKey(recipe, hashes, { methodVersion: method });
  const steps = {};
  for (const t of Array.isArray(e.trace) ? e.trace : []) steps[t.step] = t.step === recipe.output ? e.result : t.output;
  const recomputed = { result_key: key, output: e.result, steps };
  const differs = [];
  if (row.result_key !== null && row.result_key !== undefined && row.result_key !== key)
    differs.push({ result: "result_key", source: row.result_key, recomputed: key });
  const values = statedValues(row.results, row.result_key);
  if (!values && (row.result_key === null || row.result_key === undefined)) {
    missing.push({ what: "results", why: say("case-import.why.case_states_result") });
    return done("not_recreated", [], recomputed);
  }
  for (const [name, v] of values || []) {
    const r = name === "output" ? e.result : name.startsWith("steps.") && Object.hasOwn(steps, name.slice(6)) ? steps[name.slice(6)] : undefined;
    if (v === undefined || r === undefined || canonicalJson(r) !== canonicalJson(v)) differs.push({ result: name, source: v ?? null, recomputed: r ?? null });
  }
  return done(differs.length ? "differs" : "recreated", differs, recomputed);
}

/* R21: case-checker's own answer for one calculation (its R20), read against this copy's, or null when it gave none. */
function checkerCalcOf(answer, calc, result) {
  const list = isObj(answer) && Array.isArray(answer.calculations) ? answer.calculations : null;
  const c = list ? list.find((x) => isObj(x) && x.calc === calc) : null;
  if (!c) return null;
  const read = CHECKER_CALC[c.result] ?? null;
  return { result: c.result ?? null, agrees_with_this_copy: read === result };
}

/* R4 (DEC-92): whether the case document's signature verified, as the checker answers it; null when it does not say. */
function signatureVerified(answer) {
  const s = isObj(answer) ? answer.signatures : null;
  const c = isObj(s) ? (isObj(s.case) ? s.case : isObj(s.case_document) ? s.case_document : null) : null;
  for (const k of ["verified", "ok", "valid"]) if (c && typeof c[k] === "boolean") return c[k];
  return null;
}

export class CaseImport {
  #deps;

  constructor({ storage, record, membership, host = null, env = null, now = null, ...deps } = {}) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.env = env && typeof env === "object" ? env : {};
    this.now = typeof now === "function" ? now : null;
    this.#deps = { host, ...deps };
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get strength() { return this.#deps.strength ||= strengthOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get reevaluation() { return this.#deps.reevaluation ||= reevaluationOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get acceptedWork() { return this.#deps.acceptedWork ||= acceptedWorkOf(this.#deps.host, { record: this.record }); }
  get bias() { return this.#deps.bias ||= biasOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  /* R30: the questions a project draws on (`basis-versions` R41), the one reader of which inquiries are a project's */
  get basisVersions() { return this.#deps.basisVersions ||= basisVersionsOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get #checkCaseFile() { return this.#deps.checkCaseFile || checkCaseFile; }
  /* R23: `case-checker`'s synchronous re-weighing under a lens (its R23), a test passes its own; the carried applications
     are `case-grammar`'s reading (its R24) */
  get #reweigh() { return this.#deps.reweigh || caseChecker.reweigh; }
  get #applicationsOf() { return caseGrammar.biasApplicationsOf; }
  get #manifestCheck() { return this.#deps.caseFileManifestCheck || caseGrammar.caseFileManifestCheck; }

  migrate() { migrateCaseImport(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #call(fn, dflt = null) { try { return fn(); } catch { return dflt; } }
  #nowMs() {
    if (this.now) { const n = Number(this.now()); if (Number.isFinite(n) && n >= 0) return n; }
    const v = Number(this.env.BIO_NOW_MS);
    return Number.isFinite(v) && v >= 0 ? v : Date.now();
  }
  #stamp() { return stampInstant("second", this.#nowMs()); }

  /* ================================================================ who may act and read */

  /* The member an identity names, or null for a machine, an AI credential, an operator token or nobody (R1). */
  #member(identity) {
    if (!str(identity) || isMachineIdentity(identity)) return null;
    const id = String(identity).trim();
    /* the founder's viewer is the bare `admin` (membership R43), whose member is `member:admin` (REC-132): both name her */
    return this.#call(() => this.membership.positionalMember(null, id === Membership.ROOT_ADMIN ? `member:${id}` : id));
  }
  /* An active member of this group: the founder and every administrator, and every member whose status is active. */
  #isActiveMember(identity) {
    const m = this.#member(identity);
    if (!m) return false;
    if (this.#call(() => this.membership.isAdministrator(m), false)) return true;
    const f = this.#call(() => this.membership.memberFacts(m));
    return !!f && f.status === "active";
  }
  /* R4, R9, R16: who may read an import. A viewer never sent is an internal caller, the plane reading for itself (as
     `membership` treats one), and is answered; any viewer sent is answered only as an active member. */
  #sees(viewer) {
    if (viewer === null || viewer === undefined) return true;
    return this.#isActiveMember(viewer);
  }

  /* R1's first two refusals, shared by every act (R5–R8). */
  #callerRefusal({ by, viewer }) {
    const member = this.#member(by);
    /* DEC-49 REGION is-import-caller */
    if (!member)
      return { refusal: refuse("MACHINE_CANNOT_IMPORT", str(by)
        ? localize("case-import.index.import_is_a_members_act", "an import, and every act on one, is a member's, signed in as themselves; this caller is not one")
        : localize("case-import.index.no_member_named_acting", "no member is named as the one acting: this call carries nobody")) };
    if (!this.#isActiveMember(str(viewer) || by))
      return { refusal: refuse("IMPORT_NOT_A_MEMBER", localize("case-import.index.only_active_member_imports", "only an active member of this team imports, or acts on an import")) };
    /* END DEC-49 REGION is-import-caller */
    return { member };
  }

  /* ================================================================ the bytes */

  /* Bytes by SHA-256, once; chunked, append-only. Called inside a transaction. */
  #putBlob(sha, bytes) {
    if (this.#one(`SELECT 1 AS x FROM case_import_blobs WHERE sha=? AND chunk=0`, sha)) return;
    /* each chunk bound as its own ArrayBuffer, the plane's SQL type for a BLOB */
    for (let i = 0, c = 0; c === 0 || i < bytes.length; i += BLOB_CHUNK, c++)
      this.sql.exec(`INSERT INTO case_import_blobs (sha, chunk, data) VALUES (?,?,?)`, sha, c, bytes.slice(i, i + BLOB_CHUNK).buffer);
  }
  #blob(sha) {
    const rows = this.#rows(`SELECT data FROM case_import_blobs WHERE sha=? ORDER BY chunk`, sha);
    if (!rows.length) return null;
    const parts = rows.map((r) => (r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data)));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  #parts(importId, edition) {
    return this.#rows(`SELECT sha FROM case_import_parts WHERE import_id=? AND edition=? ORDER BY idx`, importId, edition)
      .map((p) => this.#blob(p.sha));
  }
  #documents(importId, edition) {
    return this.#rows(`SELECT sha FROM case_import_documents WHERE import_id=? AND edition=? ORDER BY at, sha`, importId, edition)
      .map((d) => this.#blob(d.sha)).filter(Boolean);
  }
  /** R1, R13: a file of an imported edition, by its path, as held: `{path, kind, sha, bytes}`, or null. The file is
   *  read from the parts held for the edition, by the one reader of the format (`case-checker` R19). */
  fileOf({ import: importId = null, edition = null, path = null } = {}) {
    const ed = int(edition);
    const f = str(importId) && ed && str(path)
      ? this.#one(`SELECT * FROM case_import_files WHERE import_id=? AND edition=? AND path=?`, str(importId), ed, str(path)) : null;
    if (!f) return null;
    const parts = this.#parts(f.import_id, ed);
    if (parts.some((p) => !p)) return null;
    const got = this.#call(() => readCaseFile(parts).files.find((x) => x.path === f.path));
    const bytes = got && got.content instanceof Uint8Array ? got.content : null;
    return bytes && shaOf(bytes) === f.sha ? { path: f.path, kind: f.kind ?? null, sha: f.sha, bytes } : null;
  }

  /* ================================================================ R3: one recreation */

  /* The checker's answer over the edition's parts and the documents supplied for it, or what stands for none. The
     checker is pure and never throws (its R1); it answers a promise (a signature is verified by WebCrypto). One that
     throws, or is absent, answers every finding as unknown here. */
  async #recreate(parts, documents) {
    const fn = this.#checkCaseFile;
    try {
      if (typeof fn !== "function") return { findings: [], unread: say("case-import.unread.case_checker_composed") };
      const a = await fn({ parts, documents });
      return isObj(a) ? a : { findings: [], unread: say("case-import.unread.case_checker_gave") };
    } catch (e) {
      return { findings: [], unread: say("case-import.unread.case_checker_failed", { e: String(e && e.message ? e.message : e).slice(0, 200) }) };
    }
  }

  /* R3, R12: records one recreation, inside the caller's transaction: its run, and each finding's result with what is
     missing, what differs, the recomputed pair and the checker's versions; each finding's published pair beside it
     (R16). Answers the run's number. */
  #recordCheck(importId, edition, answer, { cause, document = null, by, at, published, calcs = [] }) {
    const { findings = [], ...rest } = answer;
    const checker = isObj(rest.checker) ? rest.checker : null;
    this.sql.exec(`INSERT INTO case_import_checks (import_id, edition, cause, document_sha, checker, answer, checked_by, checked_at)
                   VALUES (?,?,?,?,?,?,?,?)`, importId, edition, cause, document,
                  canonicalJson({ grading_versions: checker?.grading_versions ?? null, checks_version: checker?.checks_version ?? null,
                                  ...(checker && checker.calc_versions !== undefined ? { calc_versions: checker.calc_versions } : {}) }),
                  canonicalJson(rest), by, at);
    const rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_checks`).rn);
    /* R21: each carried calculation as recreated here, with the checker's own answer for it beside */
    calcs.forEach((c, ord) => this.sql.exec(`INSERT INTO case_import_calculations (check_rn, ord, calc, result, missing, differs,
                                                 recomputed, stated, checker) VALUES (?,?,?,?,?,?,?,?,?)`,
      rn, ord, c.calc, c.result, canonicalJson(c.missing), canonicalJson(c.differs),
      c.recomputed === null ? null : canonicalJson(c.recomputed), canonicalJson(c.stated),
      (() => { const k = checkerCalcOf(rest, c.calc, c.result); return k ? canonicalJson(k) : null; })()));
    (Array.isArray(findings) ? findings : []).forEach((f, ord) => {
      const id = isObj(f) ? str(f.finding) : null;
      if (!id) return;
      const result = RESULTS.includes(f.result) ? f.result : "did_not_recreate";
      this.sql.exec(`INSERT INTO case_import_results (check_rn, ord, finding, role, result, missing, differs, pair, published)
                     VALUES (?,?,?,?,?,?,?,?,?)`, rn, ord, id, str(f.role), result,
                    canonicalJson(Array.isArray(f.missing) ? f.missing : []), canonicalJson(Array.isArray(f.differs) ? f.differs : []),
                    f.pair === undefined ? null : canonicalJson(f.pair), published.has(id) ? canonicalJson(published.get(id)) : null);
    });
    return rn;
  }

  /* R16: each finding's published pair, from the edition's `finding` files (`{kind, content}`). */
  #publishedPairs(files) {
    const out = new Map();
    for (const f of files) {
      if (f.kind !== "finding" || !(f.content instanceof Uint8Array)) continue;
      const fm = this.#call(() => parseFrontmatter(new TextDecoder().decode(f.content)).data);
      const id = isObj(fm) ? str(fm.id) : null;
      const pair = publishedPairOf(fm);
      if (id && pair && !out.has(id)) out.set(id, pair);
    }
    return out;
  }
  /* R21: the edition's carried calculations recreated, from its case document's `calculations:` rows (`case-grammar`
     R18), over its files (each with the SHA-256 its manifest states) and the documents supplied for it. */
  #calculationsOf(files, manifest, documents) {
    const listed = new Map(CaseImport.#manifestFiles(manifest).map((f) => [f.path, f.sha]));
    const doc = files.find((f) => f.kind === "case_document" && f.content instanceof Uint8Array);
    const fm = doc ? this.#call(() => parseFrontmatter(new TextDecoder().decode(doc.content)).data) : null;
    const rows = isObj(fm) ? this.#call(() => caseGrammar.calculationsOf(fm), []) : [];
    return recreateCalculations({ rows: Array.isArray(rows) ? rows : [], documents,
      files: files.filter(isObj).map((f) => ({ path: f.path, sha256: listed.get(f.path) ?? null,
                                                content: f.content instanceof Uint8Array ? f.content : null, detail: f.detail ?? null })) });
  }

  /* ================================================================ R1: the import */

  /* The manifest's list of files, each `{path, kind, sha, bytes, part}` (`case-grammar` R13). */
  static #manifestFiles(manifest) {
    const list = isObj(manifest) && Array.isArray(manifest.files) ? manifest.files : [];
    return list.filter(isObj).map((f) => ({ path: str(f.path), kind: str(f.kind), sha: str(f.sha ?? f.sha256), part: int(f.part) ?? 0 }))
      .filter((f) => f.path);
  }
  /* R18 check 2: the signing keys a manifest lists (`case-grammar` R13), as wire base64. */
  static #manifestKeys(manifest) {
    const list = isObj(manifest) && Array.isArray(manifest.keys) ? manifest.keys : [];
    return [...new Set(list.map((k) => normalizeKey(isObj(k) ? k.key : k)).filter(Boolean))].sort();
  }
  static #manifestIdentity(manifest) {
    const m = isObj(manifest) ? manifest : {};
    return { group: str(m.group ?? m.source_group), case: str(m.case ?? m.case_id), edition: int(m.edition ?? m.case_edition) };
  }

  /** R1: imports a case file's parts into this group's read-only import of that case and lens, recreating each finding.
   *  The same edition with the same bytes answers `existed: true` and writes nothing. */
  async importCaseFile({ parts = null, by = null, viewer = null, groupFields = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const list = Array.isArray(parts) ? parts.map(bytesOf) : [];
    /* DEC-49 REGION is-import-case-file */
    if (!list.length || list.some((p) => !p))
      return refuse("IMPORT_NOT_A_CASE_FILE", localize("case-import.index.parts_are_the_case_files", "parts are the case file's parts, each as bytes"),
                    { departures: [!list.length ? say("refusal.IMPORT_NOT_A_CASE_FILE.noparts")
                                   : say("refusal.IMPORT_NOT_A_CASE_FILE.notbytes", { n: list.findIndex((p) => !p) + 1 })] });
    /* The manifest, by the one reader of the format (`case-checker` R19), checked by `case-grammar` R13's check. A file
       whose bytes differ from the manifest is the checker's to report (its R2), never a refusal here. */
    const read = this.#call(() => readCaseFile(list), { manifest: null, files: [], departures: [say("case-import.departures")] });
    const check = this.#manifestCheck;
    const checked = !isObj(read.manifest) ? (Array.isArray(read.departures) && read.departures.length ? read.departures : [say("case-import.text.manifest_found")])
      : typeof check === "function" ? this.#call(() => check(read.manifest), [say("case-import.call.manifest_checked")])
      : [say("case-import.text.copy_holds_check")];
    const named = Array.isArray(checked) ? checked : checked ? [checked] : [];
    if (named.length)
      return refuse("IMPORT_NOT_A_CASE_FILE", localize("case-import.index.parts_carry_no_manifest", "the parts do not carry a manifest that meets the case-file format"), { departures: named });
    const big = list.findIndex((p) => p.length > PART_MAX);
    if (big >= 0)
      return refuse("IMPORT_PART_TOO_LARGE", localize("case-import.index.part_big_is_length_bytes", "part {big} is {length} bytes, over the part bound of {PART_MAX}", { big: String(big), length: String(list[big].length), PART_MAX: String(PART_MAX) }),
                    { part: big, bytes: list[big].length, bound: PART_MAX });
    const who = CaseImport.#manifestIdentity(read.manifest);
    if (!who.group || !who.case || !who.edition)
      return refuse("IMPORT_NOT_A_CASE_FILE", localize("case-import.index.manifest_departs_format", "the manifest departs from the case-file format"),
                    { departures: [say("refusal.IMPORT_NOT_A_CASE_FILE.manifest")] });
    /* END DEC-49 REGION is-import-case-file */
    const listed = new Map(CaseImport.#manifestFiles(read.manifest).map((f) => [f.path, f]));
    const files = (Array.isArray(read.files) ? read.files : []).filter((f) => isObj(f) && str(f.path) && f.content instanceof Uint8Array);
    const docFile = files.find((f) => f.kind === "case_document");
    const docBytes = docFile ? docFile.content : null;
    const fm = docBytes ? this.#call(() => parseFrontmatter(new TextDecoder().decode(docBytes)).data) : null;
    const lensSha = isObj(fm) && isObj(fm.bias_manifest) && isSha(fm.bias_manifest.statements_sha) ? fm.bias_manifest.statements_sha : null;
    const importId = importIdOf({ group: who.group, case: who.case, lens: lensSha });
    const manifestSha = sha256HexSync(canonicalJson(read.manifest));
    const held = this.#one(`SELECT manifest_sha FROM case_import_editions WHERE import_id=? AND edition=?`, importId, who.edition);
    if (held && held.manifest_sha === manifestSha)
      return { ok: true, existed: true, import: importId, group: who.group, case: who.case, lens: lensSha, edition: who.edition,
               manifest_sha: manifestSha, wrote: false };
    /* R4 (T46): the source's fields, recorded only in R34's shape and naming the manifest's group; never a refusal */
    const gf = groupFieldsOf(groupFields, who.group);
    /* DEC-49 REGION is-import-case-file */
    if (held)
      return refuse("IMPORT_EDITION_DIFFERS", localize("case-import.index.edition_edition_of_this_case", "edition {edition} of this case is held with other bytes; an edition never changes", { edition: String(who.edition) }),
                    { import: importId, edition: who.edition, held: held.manifest_sha, given: manifestSha });
    /* END DEC-49 REGION is-import-case-file */
    const answer = await this.#recreate(list, []);
    const calcs = this.#calculationsOf(Array.isArray(read.files) ? read.files : [], read.manifest, []);
    const at = this.#stamp();
    const published = this.#publishedPairs(files);
    const sourceBar = isObj(fm) && isObj(fm.required_strength) ? fm.required_strength : null;
    const out = this.record.transact(() => {
      if (this.#one(`SELECT 1 AS x FROM case_import_editions WHERE import_id=? AND edition=?`, importId, who.edition))
        return { ok: false, reason: "RACED", detail: localize("case-import.index.edition_imported_meanwhile", "the edition was imported meanwhile") };
      if (!this.#one(`SELECT 1 AS x FROM case_imports WHERE import_id=?`, importId))
        this.sql.exec(`INSERT INTO case_imports (import_id, source_group, case_id, lens, created_by, created_at) VALUES (?,?,?,?,?,?)`,
                      importId, who.group, who.case, lensSha, k.member, at);
      this.sql.exec(`INSERT INTO case_import_editions (import_id, edition, manifest_sha, format, case_doc_sha, source_bar, imported_by,
                                                       imported_at) VALUES (?,?,?,?,?,?,?,?)`,
                    importId, who.edition, manifestSha, str(read.manifest.format), docBytes ? shaOf(docBytes) : null,
                    sourceBar ? canonicalJson(sourceBar) : null, k.member, at);
      list.forEach((bytes, idx) => {
        const sha = shaOf(bytes);
        this.#putBlob(sha, bytes);
        this.sql.exec(`INSERT INTO case_import_parts (import_id, edition, idx, sha, bytes) VALUES (?,?,?,?,?)`,
                      importId, who.edition, idx, sha, bytes.length);
      });
      this.sql.exec(`INSERT INTO case_import_edition_keys (import_id, edition, keys) VALUES (?,?,?)`,
                    importId, who.edition, canonicalJson(CaseImport.#manifestKeys(read.manifest)));
      for (const f of files)
        this.sql.exec(`INSERT OR IGNORE INTO case_import_files (import_id, edition, path, kind, sha, bytes, part) VALUES (?,?,?,?,?,?,?)`,
                      importId, who.edition, f.path, str(f.kind), shaOf(f.content), f.content.length, listed.get(f.path)?.part ?? 0);
      if (gf.fields)
        this.sql.exec(`INSERT INTO case_import_group_fields (import_id, edition, fields, read_at) VALUES (?,?,?,?)`,
                      importId, who.edition, canonicalJson(gf.matter_stake_malformed ? { ...gf.fields, matter_stake_malformed: true } : gf.fields),
                      gf.read_at);
      this.#recordCheck(importId, who.edition, answer, { cause: "import", by: k.member, at, published, calcs });
      return { ok: true };
    });
    if (!out || out.ok !== true) {
      const again = this.#one(`SELECT manifest_sha FROM case_import_editions WHERE import_id=? AND edition=?`, importId, who.edition);
      if (again && again.manifest_sha === manifestSha)
        return { ok: true, existed: true, import: importId, group: who.group, case: who.case, lens: lensSha, edition: who.edition,
                 manifest_sha: manifestSha, wrote: false };
      return again ? refuse("IMPORT_EDITION_DIFFERS", localize("case-import.index.edition_edition_of_this_case_2", "edition {edition} of this case is held with other bytes", { edition: String(who.edition) }),
                            { import: importId, edition: who.edition, held: again.manifest_sha, given: manifestSha }) : out;
    }
    return { ok: true, existed: false, import: importId, group: who.group, case: who.case, lens: lensSha, edition: who.edition,
             manifest_sha: manifestSha, imported_at: at, imported_by: k.member,
             group_fields: gf.fields ? { recorded: true, read_at: gf.read_at } : { recorded: false, why: gf.why },
             recreation: this.#recreationView(importId, who.edition) };
  }

  /* ================================================================ the rows read back */

  #import(importId) { return str(importId) ? this.#one(`SELECT * FROM case_imports WHERE import_id=?`, str(importId)) : null; }
  #edition(importId, edition) {
    const ed = int(edition);
    return str(importId) && ed ? this.#one(`SELECT * FROM case_import_editions WHERE import_id=? AND edition=?`, str(importId), ed) : null;
  }
  #latestCheck(importId, edition) {
    return this.#one(`SELECT * FROM case_import_checks WHERE import_id=? AND edition=? ORDER BY rn DESC LIMIT 1`, importId, edition);
  }
  #results(rn) {
    return this.#rows(`SELECT * FROM case_import_results WHERE check_rn=? ORDER BY ord`, rn).map((r) => ({
      finding: r.finding, role: r.role ?? null, result: r.result, missing: parse(r.missing, []), differs: parse(r.differs, []),
      pair: r.pair === null ? null : parse(r.pair), published: r.published === null ? null : parse(r.published) }));
  }
  /* R21: one recreation's calculations, as recorded. */
  #calculations(rn) {
    return this.#rows(`SELECT * FROM case_import_calculations WHERE check_rn=? ORDER BY ord`, rn).map((c) => ({
      calc: c.calc, result: c.result, missing: parse(c.missing, []), differs: parse(c.differs, []),
      recomputed: c.recomputed === null ? null : parse(c.recomputed), source: parse(c.stated, {}),
      checker: c.checker === null ? null : parse(c.checker) }));
  }
  #calcsOf(importId, edition) {
    const c = this.#latestCheck(importId, edition);
    return c ? this.#calculations(c.rn) : [];
  }
  /* The latest recreation's result per finding, by id. */
  #resultsOf(importId, edition) {
    const c = this.#latestCheck(importId, edition);
    return c ? this.#results(c.rn) : [];
  }

  /* R3: the latest recreation, as recorded. */
  #recreationView(importId, edition) {
    const c = this.#latestCheck(importId, edition);
    if (!c) return null;
    const answer = parse(c.answer, {});
    return { check: Number(c.rn), cause: c.cause, document: c.document_sha ?? null, checked_at: c.checked_at,
             checker: parse(c.checker, {}), statement: str(answer.statement) ?? STATEMENT,
             ...(answer.unread ? { unread: answer.unread } : {}), findings: this.#results(c.rn).map(({ published, ...r }) => r),
             calculations: this.#calculations(c.rn) };
  }

  /* R6, R9: each acceptance of the edition in force (not withdrawn), oldest first. */
  #acceptancesInForce(importId, edition) {
    const withdrawn = new Set(this.#rows(`SELECT acceptances FROM case_import_withdrawals WHERE import_id=? AND edition=?`, importId, edition)
      .flatMap((w) => parse(w.acceptances, [])));
    return this.#rows(`SELECT * FROM case_import_acceptances WHERE import_id=? AND edition=? ORDER BY rn`, importId, edition)
      .filter((a) => !withdrawn.has(idOf("acceptance", a.rn)));
  }
  /* R9: the acceptance in force for one finding: the latest naming it. */
  #acceptanceFor(importId, edition, finding) {
    const a = this.#acceptancesInForce(importId, edition).filter((x) => parse(x.findings, []).includes(finding)).pop();
    if (!a) return null;
    const gaps = parse(a.gaps, {});
    return { acceptance: idOf("acceptance", a.rn), by: a.by_member, at: a.at, reason: a.reason, checked: a.checked,
             gaps: Array.isArray(gaps[finding]) ? gaps[finding] : [] };
  }
  /* R8, R9: the open flags on an edition, the edition's own and its findings', oldest first. */
  #openFlags(importId, edition) {
    return this.#rows(`SELECT f.* FROM case_import_flags f LEFT JOIN case_import_clears c ON c.flag_rn = f.rn
                        WHERE f.import_id=? AND f.edition=? AND c.flag_rn IS NULL ORDER BY f.rn`, importId, edition)
      .map((f) => ({ flag: idOf("flag", f.rn), finding: f.finding ?? null, issue: f.issue, by: f.by_member, at: f.at }));
  }

  /* ================================================================ R4: the reads */

  /** R4, R26: every import, with its source group, case, lens, its `latest_edition` and its editions, each with when and by
   *  whom it was imported (`importer`) and its findings counted by result, so the list draws with no read per case. A
   *  viewer who is not an active member is answered as if no import exists. Writes nothing. */
  importedCases({ viewer = null } = {}) {
    if (!this.#isActiveMember(viewer)) return { ok: true, imports: [], count: 0, wrote: false };
    const imports = this.#rows(`SELECT * FROM case_imports ORDER BY source_group, case_id, import_id`).map((i) => {
      const wf = this.#watchFacts(i);
      const editions = this.#editionsOf(i, wf);
      const latest = editions.length ? editions[editions.length - 1].edition : null;
      return { import: i.import_id, group: i.source_group, case: i.case_id, scope: this.#scopeOf(i.import_id, latest), lens: i.lens ?? null,
               latest_edition: latest, editions, ...wf.facts };
    });
    return { ok: true, imports, count: imports.length, wrote: false };
  }

  /* R6–R8 and R4: an edition this import does not hold, answered the same whatever the reason. */
  #noSuchEdition(importId, edition) {
    /* DEC-49 REGION is-import-edition */
    return refuse("IMPORT_NO_SUCH_EDITION", localize("case-import.index.no_edition_answers_here", "no imported edition answers here by that import and edition"),
                  { import: str(importId), edition: int(edition) });
    /* END DEC-49 REGION is-import-edition */
  }
  #editionRefusal(importId, edition) {
    const e = this.#edition(importId, edition);
    return e ? { e } : { refusal: this.#noSuchEdition(importId, edition) };
  }

  /** R4: one import's editions, and the latest (or the one named) in full: each finding's role, result, what is missing
   *  or differs and its recomputed pair; the source's bar labeled as the source's; each finding against this group's
   *  own bar; its origin mark facts; and the checker's statement. A viewer who is not an active member, an import not
   *  held and an edition not held are answered alike. Writes nothing. */
  importedCase({ import: importId = null, edition = null, viewer = null } = {}) {
    const i = this.#isActiveMember(viewer) ? this.#import(importId) : null;
    const wf = i ? this.#watchFacts(i) : null;
    const editions = i ? this.#editionsOf(i, wf) : [];
    const named = edition === null || edition === undefined || edition === "" ? (editions.length ? editions[editions.length - 1].edition : null)
      : int(edition);
    const e = i && named ? this.#edition(i.import_id, named) : null;
    if (!e) return this.#noSuchEdition(importId, edition);
    return { ok: true, import: i.import_id, group: i.source_group, case: i.case_id, scope: this.#scopeOf(i.import_id, Number(e.edition)),
             lens: i.lens ?? null, editions,
             edition: { ...this.#editionView(i, e, viewer), ...wf.publisher(Number(e.edition)) }, ...wf.facts, wrote: false };
  }

  /* R4: the case's scope, its reading name: the `case_scope` of the edition's case document; null where the edition holds no
     document or it states none, never the id. */
  #scopeOf(importId, ed) {
    const fm = ed === null || ed === undefined ? null : this.#documentFront(importId, ed);
    return fm ? str(fm.case_scope) : null;
  }

  /* R26: who imported an edition, as the list draws it: the member and the handle `membership.memberFacts` gives (null
     where none is held); the founder (`admin`) by `founderHandle()` (its R144), with `founder: true`. */
  #importerOf(member) {
    if (member === Membership.ROOT_ADMIN)
      return { member, handle: this.#call(() => this.membership.founderHandle()) ?? null, founder: true };
    return { member, handle: this.#call(() => this.membership.memberFacts(member))?.handle ?? null };
  }
  /* R26: an edition's findings counted over the latest recreation recorded for it (R3), each `null` where none is. */
  #countsOf(importId, edition) {
    const c = this.#latestCheck(importId, edition);
    if (!c) return { findings: null, recreated: null, recreated_in_part: null, did_not_recreate: null };
    const by = Object.fromEntries(RESULTS.map((r) => [r, 0]));
    let findings = 0;
    for (const r of this.#rows(`SELECT result, COUNT(*) AS n FROM case_import_results WHERE check_rn=? GROUP BY result`, c.rn)) {
      findings += Number(r.n);
      if (r.result in by) by[r.result] = Number(r.n);
    }
    return { findings, ...by };
  }

  /* R4, R19, R26: an import's editions, each with when and by whom it was imported, the counts of its findings by result,
     the source's group fields and its publisher facts. */
  #editionsOf(i, wf) {
    return this.#rows(`SELECT edition, imported_at, imported_by FROM case_import_editions WHERE import_id=? ORDER BY edition`, i.import_id)
      .map((e) => ({ edition: Number(e.edition), imported_at: e.imported_at, imported_by: e.imported_by,
                     importer: this.#importerOf(e.imported_by), ...this.#countsOf(i.import_id, Number(e.edition)),
                     ...this.#groupFields(i.import_id, Number(e.edition)), ...wf.publisher(Number(e.edition)) }));
  }

  /* R4 (T46; N903): an edition's recorded `group_fields` with `read_at` and their label, or null with the sentence why. */
  #groupFields(importId, edition) {
    const r = this.#one(`SELECT fields, read_at FROM case_import_group_fields WHERE import_id=? AND edition=?`, importId, edition);
    const f = r ? parse(r.fields, null) : null;
    if (!isObj(f)) return { group_fields: null, group_fields_note: GROUP_FIELDS_NONE };
    const out = {};
    for (const k of GROUP_FIELD_KEYS) out[k] = Object.hasOwn(f, k) ? f[k] : null;
    /* R25: an edition recorded before T50 carries no matter stake, which reads `null` and is no fault */
    out.matter_stake = isObj(f.matter_stake) ? f.matter_stake : null;
    return { group_fields: { ...out, read_at: r.read_at }, group_fields_label: GROUP_FIELDS_LABEL,
             ...(f.matter_stake_malformed === true ? { group_fields_note: say("caseimport.stake.unreadable") } : {}) };
  }

  /* R4: one edition in full. */
  #editionView(i, e, viewer = null) {
    const ed = Number(e.edition);
    const rec = this.#recreationView(i.import_id, ed);
    const lastAnswer = parse(this.#latestCheck(i.import_id, ed)?.answer, {});
    const own = this.#ownBar();
    const lens = this.#ownLens(i, ed, rec, lastAnswer, own, viewer);
    const flags = this.#openFlags(i.import_id, ed);
    const verified = signatureVerified(lastAnswer);
    const sourceBar = e.source_bar ? parse(e.source_bar) : null;
    const findings = (rec ? rec.findings : []).map((f) => ({
      ...f,
      ref: importedFindingRef(i.import_id, f.finding),
      /* R4 (K5148): the finding's title from its file's front matter (R31's rule), null where none, never the id */
      title: this.#findingTitle(i.import_id, ed, f.finding),
      against_own_bar: againstBar(f.role, f.pair, own.bar),
      /* R23: the finding under this group's own lens, beside the source's (its recorded result and pair) and this bar */
      own_lens: lens.finding(f),
      origin: {
        another_groups: { group: i.source_group, case: i.case_id, edition: ed, signature_verified: verified },
        acceptance: this.#acceptanceFor(i.import_id, ed, f.finding),
        flags: flags.filter((x) => x.finding === null || x.finding === f.finding),
      },
    }));
    return {
      edition: ed, manifest_sha: e.manifest_sha, format: e.format ?? null, case_document_sha: e.case_doc_sha ?? null,
      imported_at: e.imported_at, imported_by: e.imported_by, ...this.#groupFields(i.import_id, ed),
      checked_at: rec ? rec.checked_at : null, checker: rec ? rec.checker : null, ...(rec && rec.unread ? { unread: rec.unread } : {}),
      statement: rec ? rec.statement : STATEMENT,
      source_bar: { whose: "source", label: SOURCE_BAR, group: i.source_group, stated: sourceBar,
                    bar: barAxes(sourceBar) },
      own_bar: own,
      source_lens: { whose: "source", label: SOURCE_LENS, group: i.source_group, statements_sha: i.lens ?? null },
      own_lens: lens.edition,
      documents: this.#rows(`SELECT sha, bytes, by_member, at FROM case_import_documents WHERE import_id=? AND edition=? ORDER BY at, sha`,
                            i.import_id, ed).map((d) => ({ sha: d.sha, bytes: Number(d.bytes), by: d.by_member, at: d.at })),
      findings,
      /* R4, R21: each calculation the edition carries, as recreated here, beside the value the source states (its own) */
      calculations: rec ? rec.calculations : [],
      flags,
    };
  }

  /* ================================================================ R23: this group's own lens */

  /* R23 (D59, D62; K2471): the edition re-weighed under this group's own lens. The carried applications (`case-grammar`
     R24) are read from the case document; each statement is asked of `bias.statementInForce` (its R49) at scope
     `instance` with the reading member as viewer. The reader lens (`case-checker` R23) names the statements in force, so
     the carried applications of them stand as published, and a carried application whose statement is not in force is
     reversed: it reads as removed. The carried rows are not passed again as the reader's own applications, which
     `case-checker` would apply a second time (an excluded leg left out of a pair the published facts count it in). A
     statement whose answer is undetermined (`in_force: null`) is stated, never read as false: a finding resting on one,
     at its own legs or through another finding, answers no pair and no `bar_met` under this lens. The re-weighing is
     `case-checker`'s, synchronous, over the recorded as-published answer, so no signature is verified again and the
     lens read is always the one in force. It changes nothing: the acceptance, the published pair and the recorded
     results stand. Answers `{edition, finding(f)}`. Never throws. */
  #ownLens(i, ed, rec, lastAnswer, own, viewer) {
    const none = (stated) => ({
      edition: { whose: "this_group", scope: "instance", label: OWN_LENS, determined: false, stated, statements: [],
                 statements_sha: null, limit: LENS_LIMIT, not_applied: [] },
      finding: (f) => ({ whose: "this_group", applications: { in_force: [], removed: [], undetermined: [] }, determined: false, stated,
                         pair: null, bar_met: null, against_own_bar: null, changed_by: [], lens_changes: [] }) });
    try {
      if (!rec) return none(LENS_NOT_REWEIGHED);
      const fm = this.#documentFront(i.import_id, ed);
      const readApps = this.#applicationsOf;
      if (!isObj(fm) || typeof readApps !== "function") return none(LENS_NOT_REWEIGHED);
      const read = this.#call(() => readApps(fm), null);
      const apps = (Array.isArray(read) ? read : []).filter((a) => isObj(a) && str(a.finding) && str(a.statement));
      /* each statement the edition applies, asked once of the lens in force here */
      const asked = new Map();
      for (const id of [...new Set(apps.map((a) => str(a.statement)))].sort())
        asked.set(id, this.#call(() => this.bias.statementInForce({ statement: id, scope: "instance", viewer }),
                                 { ok: true, statement: id, in_force: null, stated: localize("case-import.index.lens_could_not_be_read", "undetermined: the lens in force could not be read") }));
      const stateOf = (a) => { const v = asked.get(str(a.statement)); return v && (v.in_force === true || v.in_force === false) ? v.in_force : null; };
      const inForce = [...asked.values()].filter((v) => v && v.in_force === true);
      const reader = { statements: inForce.map((v) => v.statement), applications: [] };
      const sha = [...asked.values()].map((v) => (v && isSha(v.statements_sha) ? v.statements_sha : null)).find(Boolean) ?? null;
      const undeterminedIds = [...asked.values()].filter((v) => !v || v.in_force === null).map((v) => v?.statement ?? null);
      const undetermined = new Set(undeterminedIds);
      /* case-checker's re-weighing, over the recorded answer with its findings, synchronous */
      const fn = this.#reweigh;
      let out = null, failed = null;
      if (typeof fn !== "function") failed = LENS_NOT_REWEIGHED;
      else {
        const parts = this.#parts(i.import_id, ed);
        if (parts.some((p) => !p)) failed = LENS_NOT_REWEIGHED;
        else {
          try {
            const answer = { ...lastAnswer, findings: rec.findings.map((f) => ({ ...f })) };
            out = fn({ parts, documents: this.#documents(i.import_id, ed), answer, lens: reader });
            if (out && typeof out.then === "function") { out = null; failed = LENS_NOT_REWEIGHED; }
            else if (isObj(out) && isObj(out.lens) && str(out.lens.departure)) failed = `${LENS_NOT_REWEIGHED} (${str(out.lens.departure)})`;
          } catch (err) { failed = `${LENS_NOT_REWEIGHED} (${String(err && err.message ? err.message : err).slice(0, 200)})`; }
        }
      }
      const byFinding = new Map(isObj(out) && Array.isArray(out.findings) ? out.findings.filter(isObj).map((x) => [x.finding, x]) : []);
      const limit = isObj(out) && str(out.lens_statement) ? str(out.lens_statement) : LENS_LIMIT;
      const notApplied = isObj(out) && isObj(out.lens) && Array.isArray(out.lens.not_applied) ? out.lens.not_applied : [];
      return {
        edition: { whose: "this_group", scope: "instance", label: OWN_LENS, determined: !failed && !undeterminedIds.length,
                   ...(failed ? { stated: failed } : undeterminedIds.length ? { stated: LENS_UNDETERMINED } : {}),
                   statements: [...asked.values()].map((v) => ({ statement: v?.statement ?? null, in_force: v ? v.in_force ?? null : null,
                                                                 kind: v?.kind ?? null, text: v?.text ?? null,
                                                                 ...(v && v.in_force !== true && v.stated ? { stated: v.stated } : {}) })),
                   statements_sha: sha, limit, not_applied: notApplied },
        finding: (f) => {
          const mine = apps.filter((a) => a.finding === f.finding);
          const applications = { in_force: mine.filter((a) => stateOf(a) === true), removed: mine.filter((a) => stateOf(a) === false),
                                 undetermined: mine.filter((a) => stateOf(a) === null) };
          const head = { whose: "this_group", applications };
          const r = byFinding.get(f.finding);
          const changes = r && Array.isArray(r.lens_changes) ? r.lens_changes.filter(isObj) : [];
          const unsure = (x) => ({ ...head, determined: false, stated: x, pair: null, bar_met: null, against_own_bar: null, changed_by: [],
                                   lens_changes: [] });
          /* undetermined at its own legs, or through a finding it rests on (left out of the lens, so reversed there) */
          if (applications.undetermined.length || changes.some((c) => undetermined.has(str(c.statement)))) return unsure(LENS_UNDETERMINED);
          if (failed || !r) return unsure(failed || LENS_NOT_REWEIGHED);
          const pair = r.pair === undefined ? null : r.pair;
          return { ...head, determined: true, pair, bar_met: r.bar_met === undefined ? null : r.bar_met,
                   against_own_bar: againstBar(f.role, pair, own.bar),
                   changed_by: [...new Set(changes.map((c) => str(c.statement)).filter(Boolean))], lens_changes: changes };
        },
      };
    } catch (err) {
      return none(LENS_NOT_REWEIGHED);
    }
  }

  /* R4 (K1134 reading 3): this group's own bar, the group default (`strength` R16, no project), or that none is set. */
  #ownBar() {
    const r = this.#call(() => this.strength.strengthBarOf({}));
    const bar = r && r.ok && isObj(r.bar) ? barAxes(r.bar) : null;
    return bar ? { whose: "this_group", group: r.group ?? null, bar, set: true }
      : { whose: "this_group", group: r && r.ok ? r.group ?? null : null, bar: null, set: false, stated: NO_OWN_BAR };
  }

  /* R23, R27, R31: the case document's front matter of an edition as held, or null when the edition holds none. */
  #documentFront(importId, ed) {
    const docRow = this.#one(`SELECT path FROM case_import_files WHERE import_id=? AND edition=? AND kind='case_document'`, importId, ed);
    const doc = docRow ? this.fileOf({ import: importId, edition: ed, path: docRow.path }) : null;
    const fm = doc ? this.#call(() => parseFrontmatter(new TextDecoder().decode(doc.bytes)).data) : null;
    return isObj(fm) ? fm : null;
  }
  /* R27, R31: the applications the case document carries (`case-grammar` R24), each naming a finding and a statement. */
  #applicationsIn(fm) {
    const read = fm ? this.#call(() => this.#applicationsOf(fm), null) : null;
    return (Array.isArray(read) ? read : []).filter((a) => isObj(a) && str(a.finding) && str(a.statement));
  }
  /* R27, R31: the statements the edition prints as its lens (`case-grammar` R9), or null when it prints none. */
  #printedLens(fm) {
    const l = fm ? this.#call(() => caseGrammar.lensOf(fm), null) : null;
    return isObj(l) && Array.isArray(l.statements) ? l.statements : null;
  }
  /* R27: a printed statement an application names, by its id or by its key (`case-grammar` R9). */
  static #printedStatement(printed, statement) {
    return (printed || []).find((r) => r.id === statement || caseGrammar.lensStatementKey(r.bundle, r.id) === statement) ?? null;
  }

  /* ================================================================ R27, R28: regrade another group's case under a lens */

  /* R27: whether a pair meets a bar, as `meets`; null (undetermined, never false) when the finding has no pair. */
  #meets(role, pair, bar) {
    return pair === null || pair === undefined ? null : againstBar(role, pair, bar).meets;
  }

  /** R27, R28 (K4169; UC-076): one imported edition read under `lens` (`as_published`, `removed` or `own`, R23's reader
   *  lens), each finding with its pair and its standing against this group's bar and against the source's, as the
   *  source published it and under the lens, whether it moved, and the statements that moved it. A viewer who is not an
   *  active member, an import not held and an edition not held are answered as R4 answers. Writes nothing; never throws. */
  regradeImported({ import: importId = null, edition = null, lens = null, viewer = null } = {}) {
    const i = this.#isActiveMember(viewer) ? this.#import(importId) : null;
    const e = i ? this.#edition(i.import_id, edition) : null;
    if (!e) return this.#noSuchEdition(importId, edition);
    /* DEC-49 REGION is-regrade-lens */
    if (!REGRADE_LENSES.includes(lens))
      return refuse("REGRADE_LENS_UNKNOWN", localize("case-import.index.lens_is_as_published_removed", "lens is as_published, removed or own"),
                    { lens: typeof lens === "string" ? lens.slice(0, 40) : null });
    /* END DEC-49 REGION is-regrade-lens */
    const ed = Number(e.edition);
    const rec = this.#recreationView(i.import_id, ed);
    const own = this.#ownBar();
    const sourceBar = barAxes(e.source_bar ? parse(e.source_bar) : null);
    const bars = (role, pair) => ({ own: this.#meets(role, pair, own.bar), source: this.#meets(role, pair, sourceBar) });
    const head = { ok: true, import: i.import_id, group: i.source_group, case: i.case_id, edition: ed, requested_lens: lens,
                   source_bar: { whose: "source", label: SOURCE_BAR, group: i.source_group, bar: sourceBar }, own_bar: own,
                   limit: LENS_LIMIT, wrote: false };
    const base = (rec ? rec.findings : []).map((f) => ({ finding: f.finding, ref: importedFindingRef(i.import_id, f.finding), role: f.role ?? null,
                                                          published: { pair: f.pair ?? null, bar_met: bars(f.role, f.pair ?? null) } }));
    /* R28: a lens that cannot be read is stated, and no finding is read as moved or as unmoved */
    const undetermined = (stated) => ({ ...head, lens: "undetermined", stated, findings: base.map((f) => ({ ...f, pair: null, bar_met: null })) });
    try {
      if (!rec) return undetermined(LENS_NOT_REWEIGHED);
      const fm = this.#documentFront(i.import_id, ed);
      const apps = this.#applicationsIn(fm);
      const printed = this.#printedLens(fm);
      let reader = lens, note = null;
      if (lens === "own") {
        /* each statement the edition applies, asked once of the lens in force here, as R23 asks */
        const asked = new Map();
        for (const id of [...new Set(apps.map((a) => str(a.statement)))].sort())
          asked.set(id, this.#call(() => this.bias.statementInForce({ statement: id, scope: "instance", viewer }), null));
        if ([...asked.values()].some((v) => !v || v.in_force === null)) return undetermined(LENS_UNDETERMINED);
        const inForce = [...asked.values()].filter((v) => v.in_force === true).map((v) => v.statement);
        reader = { statements: inForce, applications: [] };
        if (!inForce.length) note = REGRADE_NO_OWN_LENS;
      }
      const fn = this.#reweigh;
      const parts = this.#parts(i.import_id, ed);
      if (typeof fn !== "function" || parts.some((p) => !p)) return undetermined(LENS_NOT_REWEIGHED);
      const lastAnswer = parse(this.#latestCheck(i.import_id, ed)?.answer, {});
      const out = fn({ parts, documents: this.#documents(i.import_id, ed), answer: { ...lastAnswer, findings: rec.findings.map((f) => ({ ...f })) }, lens: reader });
      if (!isObj(out) || typeof out.then === "function" || (isObj(out.lens) && str(out.lens.departure))) return undetermined(LENS_NOT_REWEIGHED);
      const byFinding = new Map((Array.isArray(out.findings) ? out.findings.filter(isObj) : []).map((x) => [x.finding, x]));
      const findings = base.map((f) => {
        const r = byFinding.get(f.finding);
        if (!r) return { ...f, pair: null, bar_met: null };
        const pair = r.pair === undefined ? null : r.pair;
        const barMet = bars(f.role, pair);
        const because = (Array.isArray(r.lens_changes) ? r.lens_changes.filter(isObj) : []).map((c) => {
          const row = CaseImport.#printedStatement(printed, str(c.statement));
          return { statement: str(c.statement), kind: row?.kind ?? null, subject: row?.subject ?? null, text: row?.text ?? null,
                   touched: { target: c.target ?? null, ord: c.ord ?? null, effect: c.effect ?? null, from: c.from ?? null, to: c.to ?? null,
                              ...(c.through !== undefined ? { through: c.through } : {}) } };
        });
        const moved = canonicalJson(pair) !== canonicalJson(f.published.pair) || canonicalJson(barMet) !== canonicalJson(f.published.bar_met);
        return { ...f, pair, bar_met: barMet, moved, because, ...(apps.some((a) => a.finding === f.finding) ? {} : { stated: REGRADE_UNTOUCHED }) };
      });
      return { ...head, lens, findings, ...(note ? { lens_note: note } : {}) };
    } catch {
      return undetermined(LENS_NOT_REWEIGHED);
    }
  }

  /* ================================================================ R29–R31: re-running another group's work */

  /* R29, R30: the caller of a rerun act, a member and no machine (R1's first refusal, in the rerun's own code). */
  #rerunCaller(by) {
    const member = this.#member(by);
    /* DEC-49 REGION is-rerun-caller */
    if (!member)
      return { refusal: refuse("MACHINE_CANNOT_RERUN", str(by)
        ? localize("case-import.index.rerun_is_a_members_act", "a re-run, and every pairing in one, is a member's act, signed in as themselves; this caller is not one")
        : localize("case-import.index.no_member_named_rerunning", "no member is named as the one acting: this call carries nobody")) };
    /* END DEC-49 REGION is-rerun-caller */
    return { member };
  }
  /* R29, R30: the identity `membership.projectAuthority` is asked of: the founder's bare `admin` is `member:admin`. */
  #identityOf(by) {
    const id = String(by).trim();
    return id === Membership.ROOT_ADMIN ? `member:${id}` : id;
  }
  /* R29–R31: the project a viewer sees at FULL (`membership.inSight`) and the record holds as a project; else `membership` R78's
     one answer, the same for a project absent, one not seen and an id that is no project. */
  #projectSeen(project, viewer) {
    const pid = str(project);
    const info = pid && this.membership.inSight(pid, viewer) ? this.#call(() => this.record.bundleInfo(pid)) : null;
    return info && info.type === "project" ? { pid } : { refusal: noSuchProject(pid) };
  }
  /* R30: the findings a project draws on, as `basis-versions` R41 reads them, all pages. */
  #projectFindings(pid) {
    const out = [];
    let after = null;
    for (let n = 0; n < 100; n++) {
      const page = this.#call(() => this.basisVersions.projectQuestions({ project: pid, after, limit: PROJECT_FINDINGS_PAGE }), null);
      if (!page || !Array.isArray(page.items)) break;
      out.push(...page.items.map((x) => x.inquiry).filter(Boolean));
      if (!page.cursor) break;
      after = page.cursor;
    }
    return out;
  }
  /* R30: the one place NO_SUCH_SOURCE_FINDING is minted. */
  #noSuchSource(detail, extra) {
    /* DEC-49 REGION is-rerun-source-finding */
    return refuse("NO_SUCH_SOURCE_FINDING", detail, extra);
    /* END DEC-49 REGION is-rerun-source-finding */
  }

  /** R29 (K4169): declares a project of this group a rerun of an imported edition. The owner's act; it records one row of
   *  this module's own and nothing else: the import stays read-only, the project's record is not touched, and a rerun is
   *  no acceptance. */
  rerunStart({ project = null, import: importId = null, edition = null, by = null, viewer = null } = {}) {
    const k = this.#rerunCaller(by);
    if (k.refusal) return k.refusal;
    const seen = this.#projectSeen(project, viewer);
    if (seen.refusal) return seen.refusal;
    const denied = this.membership.projectAuthority(seen.pid, this.#identityOf(by), "owner", "rerunstart");
    if (denied) return denied;
    const i = this.#isActiveMember(viewer) ? this.#import(importId) : null;
    const e = i ? this.#edition(i.import_id, edition) : null;
    if (!e) return this.#noSuchEdition(importId, edition);
    const ed = Number(e.edition);
    const held = () => this.#one(`SELECT 1 AS x FROM case_import_reruns WHERE project=? AND import_id=? AND edition=?`, seen.pid, i.import_id, ed);
    const already = () => {
      /* DEC-49 REGION is-rerun-already */
      return refuse("RERUN_ALREADY", localize("case-import.index.project_is_already_declared_edition", "this project is already declared a re-run of edition {edition}; a later edition can be declared", { edition: String(ed) }),
                    { project: seen.pid, import: i.import_id, edition: ed });
      /* END DEC-49 REGION is-rerun-already */
    };
    if (held()) return already();
    const at = this.#stamp();
    let rn = null;
    const out = this.record.transact(() => {
      if (held()) return already();
      this.sql.exec(`INSERT INTO case_import_reruns (project, import_id, edition, by_member, at) VALUES (?,?,?,?,?)`, seen.pid, i.import_id, ed, k.member, at);
      rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_reruns`).rn);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, rerun: idOf("rerun", rn), project: seen.pid, import: i.import_id, group: i.source_group, case: i.case_id, edition: ed,
             by: k.member, at };
  }

  /** R30 (K4169): a member of the project states that one of its findings answers the same claim as one imported finding of
   *  a rerun, or takes that statement back. Appended, never rewritten; the latest entry for a pair stands. */
  rerunPair({ project = null, source_finding: sourceFinding = null, own_finding: ownFinding = null, edition = null, withdraw = false,
              by = null, viewer = null } = {}) {
    const k = this.#rerunCaller(by);
    if (k.refusal) return k.refusal;
    const seen = this.#projectSeen(project, viewer);
    if (seen.refusal) return seen.refusal;
    const denied = this.membership.projectAuthority(seen.pid, this.#identityOf(by), "joined", "rerunpair");
    if (denied) return denied;
    const ref = typeof sourceFinding === "string" ? parseImportedFindingRef(sourceFinding.trim()) : null;
    if (!ref)
      return this.#noSuchSource(localize("case-import.index.source_finding_is_reference", "source_finding is the reference of an imported finding"), { source_finding: str(sourceFinding) });
    const declared = this.#rows(`SELECT edition FROM case_import_reruns WHERE project=? AND import_id=? ORDER BY edition`, seen.pid, ref.import)
      .map((r) => Number(r.edition));
    const named = !(edition === null || edition === undefined || edition === "");
    const asked = named ? int(edition) : null;
    const ed = !named ? declared.at(-1) : asked !== null && declared.includes(asked) ? asked : undefined;
    /* DEC-49 REGION is-not-a-rerun */
    if (ed === undefined)
      return refuse("NOT_A_RERUN", localize("case-import.index.project_is_declared_no_rerun", "this project is declared no re-run of that edition of that import"),
                    { project: seen.pid, import: ref.import, edition: asked });
    /* END DEC-49 REGION is-not-a-rerun */
    if (!this.#resultsOf(ref.import, ed).some((r) => r.finding === ref.finding))
      return this.#noSuchSource(localize("case-import.index.source_finding_not_this_edition", "source_finding is not a finding of the edition this project re-runs"),
                                { source_finding: str(sourceFinding), import: ref.import, edition: ed });
    const own = str(ownFinding);
    /* DEC-49 REGION is-rerun-own-finding */
    if (!own || !this.membership.inSight(own, viewer) || !this.#projectFindings(seen.pid).includes(own))
      return refuse("NO_SUCH_OWN_FINDING", localize("case-import.index.own_finding_is_finding_of_project", "own_finding is a finding of this project, and one you can see"),
                    { project: seen.pid, own_finding: own });
    /* END DEC-49 REGION is-rerun-own-finding */
    const withdrawn = withdraw === true || withdraw === "true" || withdraw === 1 || withdraw === "1";
    const at = this.#stamp();
    let rn = null;
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT INTO case_import_rerun_pairs (project, import_id, edition, source_finding, own_finding, withdrawn, by_member, at)
                     VALUES (?,?,?,?,?,?,?,?)`, seen.pid, ref.import, ed, ref.finding, own, withdrawn ? 1 : 0, k.member, at);
      rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_rerun_pairs`).rn);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, pairing: idOf("pairing", rn), project: seen.pid, import: ref.import, edition: ed,
             source_finding: importedFindingRef(ref.import, ref.finding), own_finding: own, withdrawn, by: k.member, at };
  }

  /* R31: the project's own effective lens (`bias.biasManifest` at project scope) as `[{kind, subject, text}]`; `[]` where no
     manifest is in force there; null where it cannot be read (undetermined, never none). */
  #projectLens(pid, viewer) {
    try {
      const statements = [];
      for (let offset = 0, n = 0; n < 50; n++) {
        const m = this.bias.biasManifest({ scope: "project", scopeId: pid, viewer, limit: 2000, offset });
        if (!isObj(m) || m.ok !== true || m.in_force === null || m.in_force === undefined) return null;
        if (m.in_force !== true) return [];
        statements.push(...(Array.isArray(m.statements) ? m.statements.filter(isObj) : []));
        if (m.truncated !== true || !Number(m.count)) break;
        offset += Number(m.count);
      }
      return statements.map((s) => ({ kind: s.kind ?? null, subject: s.subject ?? null, text: s.text ?? null }));
    } catch { return null; }
  }
  /* R31: an own finding's pair on the capture and connection axes (`strength.strengthOf`, read now), or null. */
  #ownPair(id) {
    const r = this.#call(() => this.strength.strengthOf(id), null);
    if (!isObj(r) || r.ok === false) return null;
    const norm = (x) => ({ state: isObj(x) ? x.state ?? null : null, grade: isObj(x) ? x.grade ?? null : null });
    return Object.fromEntries(PAIR_AXES.map((a) => [a, norm(r[a])]));
  }
  /* R31: whether two pairs agree on both axes: true, false, or "undetermined" where either is not graded on both. */
  static #agree(source, own) {
    const graded = (p) => isObj(p) && PAIR_AXES.every((a) => isObj(p[a]) && p[a].state === "graded" && typeof p[a].grade === "string");
    if (!graded(source) || !graded(own)) return "undetermined";
    return PAIR_AXES.every((a) => source[a].grade === own[a].grade);
  }
  /* R31: the statements of two lenses that only one holds, and the count both hold, matching by kind, subject and text. */
  static #lensDifference(source, own) {
    if (!Array.isArray(source) || !Array.isArray(own)) return null;
    const key = (s) => canonicalJson([s.kind ?? null, s.subject ?? null, s.text ?? null]);
    const row = (s) => ({ kind: s.kind ?? null, subject: s.subject ?? null, text: s.text ?? null });
    const ownKeys = new Set(own.map(key)), sourceKeys = new Set(source.map(key));
    return { only_source: source.filter((s) => !ownKeys.has(key(s))).map(row), only_own: own.filter((s) => !sourceKeys.has(key(s))).map(row),
             shared: [...sourceKeys].filter((x) => ownKeys.has(x)).length };
  }

  /* R31: a finding's title, from the `title` of its file's front matter in the imported edition; null when the file or the
     title is absent, never the id. */
  #findingTitle(importId, ed, finding) {
    const path = caseGrammar.caseFilePath("finding", finding);
    const file = path ? this.fileOf({ import: importId, edition: ed, path }) : null;
    const fm = file ? this.#call(() => parseFrontmatter(new TextDecoder().decode(file.bytes)).data) : null;
    return isObj(fm) ? str(fm.title) : null;
  }

  /* R31: one declared rerun, read. */
  #rerunView(r, projectLens) {
    const i = this.#import(r.import_id);
    const ed = Number(r.edition);
    const e = i ? this.#edition(i.import_id, ed) : null;
    if (!e) return null;
    const fm = this.#documentFront(i.import_id, ed);
    const apps = this.#applicationsIn(fm);
    const printed = this.#printedLens(fm);
    const history = this.#rows(`SELECT * FROM case_import_rerun_pairs WHERE project=? AND import_id=? AND edition=? ORDER BY rn`, r.project, i.import_id, ed);
    const latest = new Map();
    for (const h of history) latest.set(`${h.source_finding}\u0000${h.own_finding}`, h);
    const standing = [...latest.values()].filter((h) => Number(h.withdrawn) === 0).sort((a, b) => Number(a.rn) - Number(b.rn));
    const ownPairs = new Map();
    const findings = this.#resultsOf(i.import_id, ed).map((f) => {
      const pairings = standing.filter((h) => h.source_finding === f.finding).map((h) => {
        if (!ownPairs.has(h.own_finding)) ownPairs.set(h.own_finding, this.#ownPair(h.own_finding));
        const pair = ownPairs.get(h.own_finding);
        return { own_finding: h.own_finding, pair, agree: CaseImport.#agree(f.pair, pair) };
      });
      const lensStatements = [...new Set(apps.filter((a) => a.finding === f.finding).map((a) => str(a.statement)))].map((id) => {
        const row = CaseImport.#printedStatement(printed, id);
        return { statement: id, kind: row?.kind ?? null, subject: row?.subject ?? null, text: row?.text ?? null };
      });
      return { finding: f.finding, ref: importedFindingRef(i.import_id, f.finding), title: this.#findingTitle(i.import_id, ed, f.finding),
               role: f.role ?? null, source: { pair: f.pair ?? null, lens_statements: lensStatements }, paired: pairings.length > 0, pairings };
    });
    const difference = CaseImport.#lensDifference(printed, projectLens);
    return { rerun: idOf("rerun", r.rn), project: r.project, import: i.import_id, group: i.source_group, case: i.case_id, edition: ed,
             declared_by: r.by_member, declared_at: r.at, findings, lens_difference: difference,
             ...(difference === null ? { lens_difference_stated: RERUN_LENS_UNREADABLE } : {}),
             pairing_history: history.map((h) => ({ pairing: idOf("pairing", h.rn), source_finding: importedFindingRef(i.import_id, h.source_finding),
                                                     own_finding: h.own_finding, withdrawn: Number(h.withdrawn) === 1, by: h.by_member, at: h.at })) };
  }

  /** R31 (K4169): a project's reruns, to a viewer who sees the project at FULL. Per declared rerun and source finding: the
   *  source's pair as published and its lens statements, each standing pairing with the own finding's pair and whether
   *  the two agree; once per rerun the difference between the edition's printed lens and the project's own. Every
   *  answer says the disagreement is that difference and the members' pairings, not a cause. Writes nothing. */
  rerunRead({ project = null, viewer = null } = {}) {
    const seen = this.#projectSeen(project, viewer);
    if (seen.refusal) return seen.refusal;
    const tail = { limit: LENS_LIMIT, disagreement_note: RERUN_DISAGREEMENT, wrote: false };
    try {
      const projectLens = this.#projectLens(seen.pid, viewer);
      const reruns = this.#rows(`SELECT * FROM case_import_reruns WHERE project=? ORDER BY rn`, seen.pid)
        .map((r) => this.#rerunView(r, projectLens)).filter(Boolean);
      return { ok: true, project: seen.pid, reruns, ...tail };
    } catch {
      return { ok: true, project: seen.pid, reruns: [], complete: false, ...tail };
    }
  }

  /* ================================================================ R5: completion */

  /** R5: stores a document whose SHA-256 matches a material the edition records as missing, and checks every finding of
   *  the edition again. Nothing else about the edition changes. */
  async completeImportedDocument({ import: importId = null, edition = null, bytes = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const b = bytesOf(bytes);
    const sha = b ? shaOf(b) : null;
    const e = this.#edition(importId, edition);
    const missing = new Set();
    if (e) for (const r of this.#resultsOf(e.import_id, Number(e.edition))) for (const m of r.missing) fingerprintsOf(m, missing);
    /* R5, R21 (K1828): a calculation's input the case file lacks, or carries with bytes other than its stated hash, is a
       missing material too, named by the hash its row states (as `case-checker` R9 fills it) */
    if (e) for (const c of this.#calcsOf(e.import_id, Number(e.edition))) for (const m of c.missing) if (isObj(m) && isSha(m.sha)) missing.add(m.sha);
    /* DEC-49 REGION is-import-document */
    if (!b || !e || !missing.has(sha))
      return refuse("IMPORT_DOCUMENT_NOT_MISSING", localize("case-import.index.bytes_match_no_missing", "the bytes match no material this imported edition records as missing"),
                    { import: str(importId), edition: int(edition), fingerprint: sha });
    /* END DEC-49 REGION is-import-document */
    const ed = Number(e.edition);
    const at = this.#stamp();
    const parts = this.#parts(e.import_id, ed);
    const documents = [...this.#documents(e.import_id, ed), b];
    const answer = await this.#recreate(parts, documents);
    const held = parts.some((p) => !p) ? null : this.#call(() => readCaseFile(parts), null);
    const heldFiles = held && Array.isArray(held.files) ? held.files : [];
    const published = this.#publishedPairs(heldFiles);
    const calcs = this.#calculationsOf(heldFiles, held ? held.manifest : null, documents);
    const out = this.record.transact(() => {
      this.#putBlob(sha, b);
      if (!this.#one(`SELECT 1 AS x FROM case_import_documents WHERE import_id=? AND edition=? AND sha=?`, e.import_id, ed, sha))
        this.sql.exec(`INSERT INTO case_import_documents (import_id, edition, sha, bytes, by_member, at) VALUES (?,?,?,?,?,?)`,
                      e.import_id, ed, sha, b.length, k.member, at);
      this.#recordCheck(e.import_id, ed, answer, { cause: "completion", document: sha, by: k.member, at, published, calcs });
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, import: e.import_id, edition: ed, document: sha, bytes: b.length, completed_by: k.member, at,
             recreation: this.#recreationView(e.import_id, ed) };
  }

  /* ================================================================ R6, R7: acceptance and its withdrawal */

  /** R6: records the acceptance of one edition for the named findings, each recreated, or recreated in part with every
   *  gap stated in the member's words. It changes no grade. R22: `findings: "all"` accepts, in one act with one reason,
   *  every finding of the edition that can be accepted, and answers the rest under `not_accepted`, each with why. */
  acceptImported({ import: importId = null, edition = null, findings = null, checked = null, reason = null, gaps = null,
                   by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const er = this.#editionRefusal(importId, edition);
    if (er.refusal) return er.refusal;
    const { e } = er;
    const ed = Number(e.edition);
    /* DEC-49 REGION is-import-accept */
    if (!words(checked) || !words(reason))
      return refuse("IMPORT_ACCEPT_NO_REASON", localize("case-import.index.what_was_checked_and_the", "what was checked and the reason are each 1 to {WORDS_MAX} characters", { WORDS_MAX: String(WORDS_MAX) }),
                    { missing: [!words(checked) ? "checked" : null, !words(reason) ? "reason" : null].filter(Boolean) });
    /* END DEC-49 REGION is-import-accept */
    const results = new Map(this.#resultsOf(e.import_id, ed).map((r) => [r.finding, r]));
    const stated = isObj(gaps) ? gaps : typeof gaps === "string" ? parse(gaps, {}) : {};
    /* R6: each missing entry of a finding recreated in part that `gaps` leaves unstated in the member's words, in order */
    const unstatedOf = (f) => {
      const r = results.get(f);
      if (r.result !== "recreated_in_part") return [];
      const said = Array.isArray(stated[f]) ? stated[f] : [];
      return r.missing.flatMap((m, i) => (words(said[i]) ? [] : [{ finding: f, entry: i, missing: m }]));
    };
    /* R22 (D62): `findings: "all"` takes every finding of the edition: one act, one reason, accepting each that recreated,
       and each recreated in part with its gaps stated; the rest are answered, each with why */
    const all = typeof findings === "string" && findings.trim() === ALL_FINDINGS;
    let named, notAccepted = null;
    if (all) {
      named = [];
      notAccepted = [];
      const unstatedAll = [];
      for (const [f, r] of results) {
        const unstated = unstatedOf(f);
        if (r.result === "did_not_recreate")
          notAccepted.push({ finding: f, ref: importedFindingRef(e.import_id, f), result: r.result, why: NOT_ACCEPTED_WHY.did_not_recreate });
        else if (unstated.length) {
          unstatedAll.push(...unstated);
          notAccepted.push({ finding: f, ref: importedFindingRef(e.import_id, f), result: r.result, why: NOT_ACCEPTED_WHY.gaps_unstated,
                             unstated: unstated.map(({ entry, missing }) => ({ entry, missing })) });
        } else named.push(f);
      }
      /* DEC-49 REGION is-import-finding */
      if (!results.size)
        return refuse("IMPORT_NO_SUCH_FINDING", localize("case-import.index.edition_holds_no_finding", "this edition holds no finding to accept"), { import: e.import_id, edition: ed, findings: [] });
      /* END DEC-49 REGION is-import-finding */
      /* DEC-49 REGION is-import-accept */
      if (!named.length && unstatedAll.length)
        return refuse("IMPORT_ACCEPT_GAPS_UNSTATED", localize("case-import.index.no_finding_accepted_until_gaps", "no finding of this edition can be accepted until each missing entry of a finding recreated in part is stated in the member's words, in order"), { import: e.import_id, edition: ed, unstated: unstatedAll,
            not_accepted: notAccepted });
      if (!named.length)
        return refuse("IMPORT_ACCEPT_NOT_RECREATED", localize("case-import.index.no_finding_recreated", "no finding of this edition recreated, wholly or in part"),
                      { import: e.import_id, edition: ed, findings: notAccepted.map((x) => x.finding), not_accepted: notAccepted });
      /* END DEC-49 REGION is-import-accept */
    } else {
      const asked = (typeof findings === "string" ? (findings.trim().startsWith("[") ? parse(findings, null) : [findings]) : findings);
      named = Array.isArray(asked) ? [...new Set(asked.map((f) => (typeof f === "string" ? f.trim() : f)))] : [];
      const unknown = named.filter((f) => typeof f !== "string" || !results.has(f));
      /* DEC-49 REGION is-import-finding */
      if (!named.length || unknown.length)
        return refuse("IMPORT_NO_SUCH_FINDING", named.length ? localize("case-import.index.finding_named_not_this_edition", "a finding named is not one of this edition's") : localize("case-import.index.no_finding_is_named", "no finding is named"),
                      { import: e.import_id, edition: ed, findings: unknown.map((f) => (typeof f === "string" ? f : null)) });
      /* END DEC-49 REGION is-import-finding */
      const notRecreated = named.filter((f) => results.get(f).result === "did_not_recreate");
      /* DEC-49 REGION is-import-accept */
      if (notRecreated.length)
        return refuse("IMPORT_ACCEPT_NOT_RECREATED", localize("case-import.index.only_recreated_is_accepted", "only a finding that recreated, wholly or in part, is accepted"),
                      { import: e.import_id, edition: ed, findings: notRecreated });
      const unstated = named.flatMap(unstatedOf);
      if (unstated.length)
        return refuse("IMPORT_ACCEPT_GAPS_UNSTATED", localize("case-import.index.each_gap_stated_in_order", "each missing entry of a finding recreated in part is stated in the member's words, in order"), { import: e.import_id, edition: ed, unstated });
      /* END DEC-49 REGION is-import-accept */
    }
    const kept = {};
    for (const f of named) if (results.get(f).result === "recreated_in_part") kept[f] = stated[f].slice(0, results.get(f).missing.length).map((s) => s.trim());
    const at = this.#stamp();
    let rn = null;
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT INTO case_import_acceptances (import_id, edition, findings, checked, reason, gaps, by_member, at)
                     VALUES (?,?,?,?,?,?,?,?)`, e.import_id, ed, canonicalJson(named), checked.trim(), reason.trim(), canonicalJson(kept),
                    k.member, at);
      rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_acceptances`).rn);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, acceptance: idOf("acceptance", rn), import: e.import_id, edition: ed, by: k.member, at,
             checked: checked.trim(), reason: reason.trim(), gaps: kept,
             findings: named.map((f) => ({ finding: f, ref: importedFindingRef(e.import_id, f), result: results.get(f).result })),
             ...(all ? { scope: ALL_FINDINGS, not_accepted: notAccepted } : {}),
             grades: say("case-import.grades") };
  }

  /** R7: withdraws every acceptance of the edition in force, with a reason; each stays in the history. After the
   *  withdrawal commits, `reevaluation` is told (its R31), and its answer is carried as `reevaluation`. */
  withdrawAcceptance({ import: importId = null, edition = null, reason = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const er = this.#editionRefusal(importId, edition);
    if (er.refusal) return er.refusal;
    const { e } = er;
    const ed = Number(e.edition);
    /* DEC-49 REGION is-import-withdraw */
    if (!words(reason))
      return refuse("IMPORT_ACCEPT_NO_REASON", localize("case-import.index.the_reason_for_withdrawing_is", "the reason for withdrawing is 1 to {WORDS_MAX} characters", { WORDS_MAX: String(WORDS_MAX) }), { missing: ["reason"] });
    if (!this.#acceptancesInForce(e.import_id, ed).length)
      return refuse("IMPORT_NOTHING_ACCEPTED", localize("case-import.index.no_acceptance_in_force", "no acceptance of this edition is in force"), { import: e.import_id, edition: ed });
    /* END DEC-49 REGION is-import-withdraw */
    const at = this.#stamp();
    let rn = null, ids = [], refs = [];
    const out = this.record.transact(() => {
      const live = this.#acceptancesInForce(e.import_id, ed);
      if (!live.length) return refuse("IMPORT_NOTHING_ACCEPTED", localize("case-import.index.acceptance_withdrawn_meanwhile", "the acceptance was withdrawn meanwhile"), { import: e.import_id, edition: ed });
      ids = live.map((a) => idOf("acceptance", a.rn));
      refs = [...new Set(live.flatMap((a) => parse(a.findings, [])))].sort()
        .map((f) => importedFindingRef(e.import_id, f)).filter(Boolean);
      this.sql.exec(`INSERT INTO case_import_withdrawals (import_id, edition, acceptances, refs, reason, by_member, at) VALUES (?,?,?,?,?,?,?)`,
                    e.import_id, ed, canonicalJson(ids), canonicalJson(refs), reason.trim(), k.member, at);
      rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_withdrawals`).rn);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    const withdrawal = idOf("withdrawal", rn);
    let told;
    try {
      told = this.reevaluation.acceptanceWithdrawn({ withdrawal });
    } catch (err) {
      told = { ok: false, told: false, listeners_failed: [{ module: "reevaluation",
        error: String(err && err.message ? err.message : err).slice(0, 200) }] };
    }
    return { ok: true, withdrawal, import: e.import_id, edition: ed, acceptances: ids, refs, reason: reason.trim(), by: k.member, at,
             reevaluation: told ?? { ok: false, told: false } };
  }

  /* ================================================================ R8: flags */

  /* R8's refusals after R1's: the issue or reason, then the edition and the finding. */
  #flagRefusal(text, what) {
    /* DEC-49 REGION is-import-flag */
    if (!words(text)) return refuse("IMPORT_FLAG_NO_ISSUE", localize("case-import.index.what_is_1_to_words", "{what} is 1 to {WORDS_MAX} characters", { what: String(what), WORDS_MAX: String(WORDS_MAX) }));
    /* END DEC-49 REGION is-import-flag */
    return null;
  }

  /** R8: a member's flag on an edition, or on one of its findings, naming the specific issue. */
  flagImported({ import: importId = null, edition = null, finding = null, issue = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const fr = this.#flagRefusal(issue, "the issue");
    if (fr) return fr;
    const er = this.#editionRefusal(importId, edition);
    if (er.refusal) return er.refusal;
    const { e } = er;
    const ed = Number(e.edition);
    const f = finding === null || finding === undefined || finding === "" ? null : str(finding);
    /* DEC-49 REGION is-import-finding */
    if ((finding !== null && finding !== undefined && finding !== "" && !f)
        || (f && !this.#resultsOf(e.import_id, ed).some((r) => r.finding === f)))
      return refuse("IMPORT_NO_SUCH_FINDING", localize("case-import.index.finding_named_is_not_this_edition", "the finding named is not one of this edition's"),
                    { import: e.import_id, edition: ed, findings: [typeof finding === "string" ? finding : null] });
    /* END DEC-49 REGION is-import-finding */
    const at = this.#stamp();
    let rn = null;
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT INTO case_import_flags (import_id, edition, finding, issue, by_member, at) VALUES (?,?,?,?,?,?)`,
                    e.import_id, ed, f, issue.trim(), k.member, at);
      rn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_flags`).rn);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, flag: idOf("flag", rn), import: e.import_id, edition: ed, finding: f, issue: issue.trim(), by: k.member, at };
  }

  /** R8: clears an open flag with a reason; the flag stays in the history. */
  clearFlag({ flag = null, reason = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const fr = this.#flagRefusal(reason, "the reason for clearing");
    if (fr) return fr;
    const rn = rnOf("flag", flag);
    const open = () => (rn ? this.#one(`SELECT f.* FROM case_import_flags f LEFT JOIN case_import_clears c ON c.flag_rn = f.rn
                                         WHERE f.rn=? AND c.flag_rn IS NULL`, rn) : null);
    /* DEC-49 REGION is-import-flag-open */
    const notOpen = () => refuse("IMPORT_FLAG_NOT_OPEN", localize("case-import.index.no_open_flag_by_id", "no open flag answers by that id"), { flag: str(flag) });
    /* END DEC-49 REGION is-import-flag-open */
    const f = open();
    if (!f) return notOpen();
    const at = this.#stamp();
    const out = this.record.transact(() => {
      if (!open()) return notOpen();
      this.sql.exec(`INSERT INTO case_import_clears (flag_rn, reason, by_member, at) VALUES (?,?,?,?)`, rn, reason.trim(), k.member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, flag: idOf("flag", rn), import: f.import_id, edition: Number(f.edition), finding: f.finding ?? null,
             cleared: { reason: reason.trim(), by: k.member, at } };
  }

  /* ================================================================ R9: the services for later modules */

  /** R9: the acceptance in force for one finding of an edition (who, when, why, what was checked, the gaps), or null.
   *  Read as the plane. Writes nothing and never throws. */
  acceptanceOf({ import: importId = null, edition = null, finding = null } = {}) {
    try {
      const e = this.#edition(importId, edition);
      const f = str(finding);
      return e && f ? this.#acceptanceFor(e.import_id, Number(e.edition), f) : null;
    } catch { return null; }
  }

  /** R9: the open flags on an edition, the edition's own and its findings', each with its issue; `complete: false` when
   *  they could not be read. Read as the plane. Writes nothing and never throws. */
  openFlagsOn({ import: importId = null, edition = null } = {}) {
    try {
      const e = this.#edition(importId, edition);
      return { flags: e ? this.#openFlags(e.import_id, Number(e.edition)) : [], complete: true };
    } catch { return { flags: [], complete: false }; }
  }

  /* ================================================================ R17–R20: watching the publisher's docket (N534) */

  /* R17: the watch in force on an import: its latest watch, unless that one has ended. */
  #watchInForce(importId) {
    const w = this.#one(`SELECT * FROM case_import_watches WHERE import_id=? ORDER BY rn DESC LIMIT 1`, importId);
    return w && !this.#one(`SELECT 1 AS x FROM case_import_watch_ends WHERE watch_rn=?`, w.rn) ? w : null;
  }
  /* R18: the latest read made under a watch, as `{at, outcome, reason}`, or null. */
  #lastRead(watchRn) {
    const r = this.#one(`SELECT at, outcome, reason FROM case_import_docket_reads WHERE watch_rn=? ORDER BY rn DESC LIMIT 1`, watchRn);
    return r ? { at: r.at, outcome: r.outcome, reason: r.reason ?? null } : null;
  }
  /* R17, R18: an import that is held, or IMPORT_NOT_WATCHED's refusal (one site for both acts and the service). */
  #notWatched(importId, detail, extra = {}) {
    /* DEC-49 REGION is-import-watched */
    return refuse("IMPORT_NOT_WATCHED", detail, { import: str(importId), ...extra });
    /* END DEC-49 REGION is-import-watched */
  }

  /** R17: a member's standing request that this copy read the publisher's docket for one import. The same docket
   *  address already in force answers `existed: true` and writes nothing; another address replaces the watch in force.
   *  Every watch stays in the history. */
  watchImport({ import: importId = null, publisher = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const i = this.#import(importId);
    if (!i) return this.#noSuchEdition(importId, null);
    const p = typeof publisher === "string" ? publisher.trim() : null;
    /* DEC-49 REGION is-import-watch-address */
    if (!p || !isPublicHttpsLocator(p) || /[?#\s]/.test(p))
      return refuse("IMPORT_WATCH_BAD_ADDRESS", localize("case-import.index.publisher_address_is_public", "the publisher's address is the public https address of their copy, with no query and no fragment"), { publisher: typeof publisher === "string" ? publisher.slice(0, 400) : null });
    /* END DEC-49 REGION is-import-watch-address */
    const docket = docketAddressOf(p, i.case_id);
    const held = this.#watchInForce(i.import_id);
    if (held && held.docket === docket)
      return { ok: true, existed: true, import: i.import_id, group: i.source_group, case: i.case_id, publisher: held.publisher,
               docket, set_by: held.set_by, set_at: held.set_at, wrote: false };
    const at = this.#stamp();
    const out = this.record.transact(() => {
      this.sql.exec(`INSERT INTO case_import_watches (import_id, publisher, docket, set_by, set_at) VALUES (?,?,?,?,?)`,
                    i.import_id, p, docket, k.member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, existed: false, import: i.import_id, group: i.source_group, case: i.case_id, publisher: p, docket,
             set_by: k.member, set_at: at, replaced: held ? held.docket : null };
  }

  /** R17: ends the watch in force; it stays in the history. */
  unwatchImport({ import: importId = null, by = null, viewer = null } = {}) {
    const k = this.#callerRefusal({ by, viewer });
    if (k.refusal) return k.refusal;
    const i = this.#import(importId);
    if (!i) return this.#noSuchEdition(importId, null);
    const w = this.#watchInForce(i.import_id);
    if (!w) return this.#notWatched(i.import_id, localize("case-import.index.no_watch_in_force", "no watch of this import is in force"));
    const at = this.#stamp();
    const out = this.record.transact(() => {
      if (!this.#watchInForce(i.import_id)) return this.#notWatched(i.import_id, localize("case-import.index.watch_ended_meanwhile", "the watch ended meanwhile"));
      this.sql.exec(`INSERT INTO case_import_watch_ends (watch_rn, by_member, at) VALUES (?,?,?)`, w.rn, k.member, at);
      return { ok: true };
    });
    if (!out || out.ok !== true) return out;
    return { ok: true, import: i.import_id, docket: w.docket, ended_by: k.member, ended_at: at };
  }

  /** R18: each watch in force, in import order after `after`, at most `limit` (1–200, default 200), with `cursor` the
   *  last import listed when more follow. Read as the plane; writes nothing and never throws. */
  watchedImports({ after = null, limit = null } = {}) {
    try {
      const cap = Math.min(int(limit) ?? WATCH_PAGE_MAX, WATCH_PAGE_MAX);
      const rows = this.#rows(`SELECT w.*, i.source_group, i.case_id FROM case_import_watches w
                                 JOIN case_imports i ON i.import_id = w.import_id
                                WHERE w.rn = (SELECT MAX(x.rn) FROM case_import_watches x WHERE x.import_id = w.import_id)
                                  AND NOT EXISTS (SELECT 1 FROM case_import_watch_ends e WHERE e.watch_rn = w.rn)
                                  AND w.import_id > ? ORDER BY w.import_id LIMIT ?`, str(after) ?? "", cap + 1);
      const more = rows.length > cap;
      if (more) rows.length = cap;
      return { watches: rows.map((w) => ({ import: w.import_id, group: w.source_group, case: w.case_id, docket: w.docket,
                                           set_by: w.set_by, set_at: w.set_at, last_read: this.#lastRead(w.rn) })),
               cursor: more ? rows[rows.length - 1].import_id : null };
    } catch { return { watches: [], cursor: null, complete: false }; }
  }

  /* R18 check 2: the keys any held edition's manifest lists. An edition imported before the keys were kept is read from
     its parts. */
  #listedKeys(importId) {
    const out = new Set();
    for (const e of this.#rows(`SELECT edition FROM case_import_editions WHERE import_id=?`, importId)) {
      const k = this.#one(`SELECT keys FROM case_import_edition_keys WHERE import_id=? AND edition=?`, importId, e.edition);
      const keys = k ? parse(k.keys, [])
        : this.#call(() => CaseImport.#manifestKeys(readCaseFile(this.#parts(importId, Number(e.edition))).manifest), []);
      for (const x of keys) out.add(x);
    }
    return [...out];
  }

  /* R18: checks the entries of one answer that this import does not yet hold, in `seq` order. An entry already recorded
     with the same bytes (seq, digest, json and signature) is not recorded again, so a refused copy never hides a genuine
     one served later; a `seq` held by a verified entry with another digest is
     refused `differs`, and the held one stands. Answers the rows to record. */
  async #checkEntries(i, list) {
    const verified = new Map(), seen = new Set();
    /* an entry is the same entry only when every byte served is: its seq, digest, json and signature */
    const served = (seq, digest, json, signature) => sha256HexSync(canonicalJson([seq ?? null, digest ?? null, json ?? null, signature ?? null]));
    for (const r of this.#rows(`SELECT seq, digest, json, signature, status FROM case_import_docket_entries WHERE import_id=?`, i.import_id)) {
      seen.add(served(r.seq === null ? null : Number(r.seq), r.digest, r.json, r.signature));
      if (r.status === "verified") verified.set(Number(r.seq), r.digest);
    }
    const listed = this.#listedKeys(i.import_id);
    const seqOf = (e) => (isObj(e) && Number.isInteger(e.seq) && e.seq > 0 ? e.seq : null);
    const ordered = list.map((e, n) => ({ e, n })).sort((a, b) => ((seqOf(a.e) ?? Infinity) - (seqOf(b.e) ?? Infinity)) || (a.n - b.n));
    const out = [];
    for (const { e } of ordered) {
      const seq = seqOf(e);
      const digest = isObj(e) && typeof e.digest === "string" ? e.digest.slice(0, 128) : null;
      const json = isObj(e) && typeof e.json === "string" && e.json.length <= 65536 ? e.json : null;
      const signature = isObj(e) && typeof e.signature === "string" && e.signature.length <= 16384 ? e.signature : null;
      const key = served(seq, digest, json, signature);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = json ? parse(json, null) : null;
      const row = { seq, digest, json, signature, published_at: isObj(e) ? str(e.published_at) : null, status: "refused",
                    failed: null, detail: null, held_digest: null, kind: isObj(f) ? str(f.kind) : null,
                    edition: isObj(f) && (f.edition === "all" || Number.isInteger(f.edition)) ? String(f.edition) : null,
                    date: isObj(f) ? str(f.date) : null, key_b64: null, key_listed: null, chain: null };
      const fail = (check, detail) => { row.failed = check; row.detail = detail; out.push(row); };
      if (seq !== null && verified.has(seq) && verified.get(seq) !== digest) {
        row.held_digest = verified.get(seq);
        fail("seq", localize("case-import.index.entry_seq_is_held_with", "entry {seq} is held with digest {held_digest}; this one has {digest}; the held entry stands", { seq: String(seq), held_digest: String(row.held_digest), digest: String(digest) }));
        continue;
      }
      /* check 1: the digest and the form */
      if (!json || !isSha(digest) || sha256HexSync(json) !== digest) { fail("digest", localize("case-import.index.entry_digest_not_its", "the SHA-256 of the entry's JSON is not its digest")); continue; }
      if (!isObj(f) || !DOCKET_ENTRY_FORMATS.includes(f.format) || f.group !== i.source_group || f.case !== i.case_id
          || seq === null || f.seq !== seq) {
        fail("form", localize("case-import.index.entry_not_a_docket_entry", "the entry is not a docket entry of this team's case at its number")); continue;
      }
      /* check 2: the signature, against the key it embeds; listed when a held manifest lists that key */
      let statement = null;
      try { statement = docketStatement(i.case_id, seq, digest); } catch { statement = null; }
      let v = statement && signature ? await verifySshsig(signature, statement, NS_DOCKET, listed) : { ok: false, reason: "MALFORMED" };
      let keyListed = v.ok === true;
      if (!v.ok && v.reason === "UNKNOWN_KEY" && v.keyB64) {
        v = await verifySshsig(signature, statement, NS_DOCKET, [v.keyB64]);
        keyListed = false;
      }
      if (!v.ok) { fail("signature", localize("case-import.index.the_signature_does_not_verify", "the signature does not verify over the entry's statement ({reason})", { reason: String(v.reason) })); continue; }
      row.key_b64 = v.keyB64;
      row.key_listed = keyListed;
      /* check 3: the chain */
      const prev = f.previous ?? null;
      if (seq === 1) {
        if (prev !== null) { fail("chain", localize("case-import.index.entry_one_names_previous", "entry 1 names a previous entry")); continue; }
        row.chain = "checked";
      } else if (!verified.has(seq - 1)) row.chain = "unchecked";
      else if (verified.get(seq - 1) !== prev) { fail("chain", localize("case-import.index.previous_is_not_the_digest", "previous is not the digest of the held entry {v1}", { v1: String(seq - 1) })); continue; }
      else row.chain = "checked";
      row.status = "verified";
      verified.set(seq, digest);
      out.push(row);
    }
    return out;
  }

  /** R18: records one docket read of a watched import, made by `monitoring` (its R67), and every entry it saw that this
   *  import does not yet hold, each verified or refused. After the read commits, `reevaluation.citedCaseMoved` (its R33) is
   *  told of each new move; a throw there never undoes the read and is named under `listeners_failed`. Read as the plane;
   *  never throws. */
  async recordDocketRead({ import: importId = null, docket = null, at = null, outcome = null, reason = null, answer = null } = {}) {
    try {
      const i = this.#import(importId);
      if (!i) return this.#noSuchEdition(importId, null);
      const w = this.#watchInForce(i.import_id);
      if (!w || str(docket) !== w.docket)
        return this.#notWatched(i.import_id, w ? localize("case-import.index.watch_names_another_address", "the watch in force names another docket address") : localize("case-import.index.no_watch_in_force", "no watch of this import is in force"),
                                { docket: str(docket) });
      const atMs = typeof at === "string" ? Date.parse(at) : NaN;
      const readAt = Number.isFinite(atMs) ? stampInstant("second", atMs) : this.#stamp();
      let out = READ_OUTCOMES.includes(outcome) ? outcome : "unreadable";
      let why = outcome === "unreadable" ? (typeof reason === "string" ? reason.slice(0, 200) : null)
        : out === "read" ? null : "outcome_unknown";
      let list = null;
      if (out === "read") {
        if (!isObj(answer) || !Array.isArray(answer.entries)) { out = "unreadable"; why = "not_a_docket"; }
        else if (answer.group !== i.source_group || answer.case !== i.case_id) { out = "unreadable"; why = "not_this_case"; }
        else list = answer.entries;
      }
      const checked = list ? await this.#checkEntries(i, list) : [];
      const recordedAt = this.#stamp();
      const rns = [];
      const res = this.record.transact(() => {
        const now = this.#watchInForce(i.import_id);
        if (!now || now.rn !== w.rn) return this.#notWatched(i.import_id, localize("case-import.index.watch_changed_meanwhile", "the watch changed meanwhile"), { docket: str(docket) });
        this.sql.exec(`INSERT INTO case_import_docket_reads (import_id, watch_rn, docket, at, outcome, reason, entries_seen, last_entry,
                                                            recorded_at) VALUES (?,?,?,?,?,?,?,?,?)`,
                      i.import_id, w.rn, w.docket, readAt, out, why, isObj(answer) && Array.isArray(answer.entries) ? answer.entries.length : 0,
                      isObj(answer) && typeof answer.last_entry === "string" ? answer.last_entry.slice(0, 64) : null, recordedAt);
        const readRn = Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_docket_reads`).rn);
        for (const r of checked) {
          this.sql.exec(`INSERT INTO case_import_docket_entries (import_id, read_rn, seq, digest, json, signature, published_at, status,
                           failed, detail, held_digest, kind, edition, date, key_b64, key_listed, chain, recorded_at)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                        i.import_id, readRn, r.seq, r.digest, r.json, r.signature, r.published_at, r.status, r.failed, r.detail,
                        r.held_digest, r.kind, r.edition, r.date, r.key_b64, r.key_listed === null ? null : r.key_listed ? 1 : 0,
                        r.chain, recordedAt);
          rns.push(Number(this.#one(`SELECT MAX(rn) AS rn FROM case_import_docket_entries`).rn));
        }
        return { ok: true };
      });
      if (!res || res.ok !== true) return res;
      const rows = rns.length ? this.#rows(`SELECT * FROM case_import_docket_entries WHERE rn >= ? AND rn <= ? AND import_id=? ORDER BY rn`,
                                           Math.min(...rns), Math.max(...rns), i.import_id) : [];
      const moves = rows.filter((r) => r.status === "verified" && MOVE_KINDS.includes(r.kind));
      const told = [], failed = [];
      if (moves.length) {
        const backs = this.#takeBacks(i.import_id);
        for (const r of moves) {
          const move = this.#moveOf(r, i, backs);
          try {
            const a = this.reevaluation.citedCaseMoved({ move });
            told.push(a ?? null);
            if (a && Array.isArray(a.listeners_failed)) failed.push(...a.listeners_failed);
          } catch (err) {
            failed.push({ module: "reevaluation", move: move.move, error: String(err && err.message ? err.message : err).slice(0, 200) });
          }
        }
      }
      return { ok: true, import: i.import_id, at: readAt, outcome: out, ...(why ? { reason: why } : {}),
               new_entries: rows.length, new_moves: moves.length, new_refused: rows.filter((r) => r.status === "refused").length,
               ...(moves.length ? { reevaluation: told } : {}), ...(failed.length ? { listeners_failed: failed } : {}) };
    } catch (err) {
      return { ok: false, failed: true, detail: localize("case-import.index.the_read_could_not_be", "the read could not be recorded: {String}", { String: String(String(err && err.message ? err.message : err).slice(0, 200)) }) };
    }
  }

  /* R18: a verified take-back naming the seq of an entry, stated beside it as `taken_back: {seq, date}`. */
  #takeBacks(importId) {
    const out = new Map();
    for (const r of this.#rows(`SELECT json, seq, date FROM case_import_docket_entries WHERE import_id=? AND status='verified'
                                  AND kind='take-back' ORDER BY rn`, importId)) {
      const f = parse(r.json, null);
      if (isObj(f) && Number.isInteger(f.takes_back) && !out.has(f.takes_back)) out.set(f.takes_back, { seq: Number(r.seq), date: r.date ?? null });
    }
    return out;
  }
  static #editionOf(v) { return v === "all" ? "all" : v === null || v === undefined ? null : Number(v); }
  /* R16 (`accepted-work` R8): one publisher move, as recorded. */
  #moveOf(r, i, backs) {
    const f = parse(r.json, {}) || {};
    return { move: idOf("move", r.rn), import: r.import_id, group: i.source_group, case: i.case_id, kind: r.kind,
             edition: CaseImport.#editionOf(r.edition), seq: Number(r.seq), date: r.date ?? null, at: r.recorded_at,
             what_changed: r.kind === "edition" && typeof f.what_changed === "string" ? f.what_changed : null,
             reason: r.kind === "withdrawal" && typeof f.reason === "string" ? f.reason : null,
             key_listed: Number(r.key_listed) === 1, taken_back: backs.get(Number(r.seq)) ?? null };
  }
  /* R19: every entry seen for an import, in the order seen. */
  #entriesSeen(importId) {
    const backs = this.#takeBacks(importId);
    return this.#rows(`SELECT * FROM case_import_docket_entries WHERE import_id=? ORDER BY rn`, importId).map((r) => {
      const f = parse(r.json, null);
      const verified = r.status === "verified";
      return { seq: r.seq === null ? null : Number(r.seq), digest: r.digest ?? null, status: r.status, kind: r.kind ?? null,
               edition: CaseImport.#editionOf(r.edition), date: r.date ?? null, published_at: r.published_at ?? null,
               recorded_at: r.recorded_at,
               ...(verified ? { key_listed: Number(r.key_listed) === 1, chain: r.chain,
                                ...(r.kind === "edition" ? { what_changed: isObj(f) && typeof f.what_changed === "string" ? f.what_changed : null } : {}),
                                ...(r.kind === "withdrawal" ? { reason: isObj(f) && typeof f.reason === "string" ? f.reason : null } : {}),
                                ...(r.kind === "take-back" ? { takes_back: isObj(f) && Number.isInteger(f.takes_back) ? f.takes_back : null } : {}),
                                taken_back: backs.get(Number(r.seq)) ?? null }
                 : { failed: r.failed, detail: r.detail, ...(r.failed === "seq" ? { differs: true, held_digest: r.held_digest } : {}) }) };
    });
  }
  /* R19: an import's moves, in the order recorded. */
  #movesOf(i) {
    const backs = this.#takeBacks(i.import_id);
    return this.#rows(`SELECT * FROM case_import_docket_entries WHERE import_id=? AND status='verified' AND kind IN ('edition','withdrawal')
                        ORDER BY rn`, i.import_id).map((r) => this.#moveOf(r, i, backs));
  }
  /* R19: one edition's `publisher`: the newest edition move naming a later edition, and the withdrawal move covering it
     by `reevaluation` R33's rule; null when neither has been seen. */
  static #publisherOf(moves, n) {
    const newest = (list) => list.reduce((a, m) => (!a || m.seq > a.seq ? m : a), null);
    const ed = newest(moves.filter((m) => m.kind === "edition" && typeof m.edition === "number" && m.edition > n));
    const wd = newest(moves.filter((m) => m.kind === "withdrawal" && (m.edition === n || (m.edition === "all"
      && !moves.some((e) => e.kind === "edition" && e.edition === n && e.seq > m.seq)))));
    if (!ed && !wd) return null;
    return { edition: ed ? { seq: ed.seq, edition: ed.edition, date: ed.date, what_changed: ed.what_changed, key_listed: ed.key_listed,
                             taken_back: ed.taken_back } : null,
             withdrawal: wd ? { seq: wd.seq, edition: wd.edition, date: wd.date, reason: wd.reason, key_listed: wd.key_listed,
                                taken_back: wd.taken_back } : null };
  }
  /* R19: what a member reads of an import's watch: the watch, the docket unreadable, the entries seen, and a function
     answering an edition's `publisher` facts. */
  #watchFacts(i) {
    const w = this.#watchInForce(i.import_id);
    const last = w ? this.#lastRead(w.rn) : null;
    const moves = this.#movesOf(i);
    const publisher = (n) => {
      const p = CaseImport.#publisherOf(moves, n);
      return p ? { publisher: p } : { publisher: null, publisher_note: NO_MOVE_SEEN, last_read: last };
    };
    return {
      facts: { watch: w ? { docket: w.docket, publisher: w.publisher, set_by: w.set_by, set_at: w.set_at, last_read: last } : null,
               ...(last && last.outcome === "unreadable"
                 ? { docket_unreadable: { sentence: DOCKET_UNREADABLE, reason: last.reason, at: last.at } } : {}),
               docket_entries: this.#entriesSeen(i.import_id) },
      publisher,
    };
  }

  /** R20: the watch's items for `queue-producers` (its R35): each verified entry seen, with `seen_at`, the instant of the
   *  docket read that first recorded it (N546), each refused entry, with its `seen_at` too (K1419), and each watch in
   *  force whose latest read is unreadable, each naming the import, its group and case, and the watch's `set_by`. A viewer who is not an active
   *  member is answered empty. Read as the plane; writes nothing and never throws. */
  watchItems({ viewer = null } = {}) {
    const empty = { entries: [], refused: [], unreadable: [] };
    try {
      if (!this.#sees(viewer)) return empty;
      const out = { entries: [], refused: [], unreadable: [] };
      const imports = new Map(this.#rows(`SELECT * FROM case_imports`).map((i) => [i.import_id, i]));
      const backs = new Map();
      for (const r of this.#rows(`SELECT e.*, d.at AS read_at, w.set_by AS watch_set_by FROM case_import_docket_entries e
                                    JOIN case_import_docket_reads d ON d.rn = e.read_rn
                                    JOIN case_import_watches w ON w.rn = d.watch_rn ORDER BY e.rn`)) {
        const i = imports.get(r.import_id);
        if (!i) continue;
        const head = { import: i.import_id, group: i.source_group, case: i.case_id, set_by: r.watch_set_by,
                       seq: r.seq === null ? null : Number(r.seq) };
        if (r.status === "verified") {
          if (!backs.has(i.import_id)) backs.set(i.import_id, this.#takeBacks(i.import_id));
          const f = parse(r.json, {}) || {};
          out.entries.push({ ...head, kind: r.kind, edition: CaseImport.#editionOf(r.edition), date: r.date ?? null,
                             key_listed: Number(r.key_listed) === 1, seen_at: r.read_at, move: MOVE_KINDS.includes(r.kind),
                             ...(r.kind === "edition" ? { what_changed: typeof f.what_changed === "string" ? f.what_changed : null } : {}),
                             ...(r.kind === "withdrawal" ? { reason: typeof f.reason === "string" ? f.reason : null } : {}),
                             taken_back: backs.get(i.import_id).get(Number(r.seq)) ?? null });
        } else out.refused.push({ ...head, failed: r.failed, detail: r.detail, seen_at: r.read_at });
      }
      for (const w of this.#allWatches())
        if (w.last_read && w.last_read.outcome === "unreadable")
          out.unreadable.push({ import: w.import, group: w.group, case: w.case, set_by: w.set_by, docket: w.docket,
                                sentence: DOCKET_UNREADABLE, reason: w.last_read.reason, at: w.last_read.at });
      return out;
    } catch { return { ...empty, complete: false }; }
  }
  /* R18, R20: every watch in force, through each page. */
  #allWatches() {
    const out = [];
    let after = null;
    for (;;) {
      const p = this.watchedImports({ after, limit: WATCH_PAGE_MAX });
      out.push(...p.watches);
      if (!p.cursor) return out;
      after = p.cursor;
    }
  }

  /** R16 (`accepted-work` R8's `moves`): the publisher moves, in the order this copy recorded them, after `after` (a move
   *  id; null or "" from the first), at most `limit` (1–200, default 200), with `cursor` the last listed when more
   *  follow. Read as the plane; writes nothing. */
  moves({ after = null, limit = null } = {}) {
    const cap = Math.min(int(limit) ?? WATCH_PAGE_MAX, WATCH_PAGE_MAX);
    const from = rnOf("move", after) ?? 0;
    const rows = this.#rows(`SELECT * FROM case_import_docket_entries WHERE rn > ? AND status='verified' AND kind IN ('edition','withdrawal')
                              ORDER BY rn LIMIT ?`, from, cap + 1);
    const more = rows.length > cap;
    if (more) rows.length = cap;
    const imports = new Map(), backs = new Map();
    const moves = [];
    for (const r of rows) {
      if (!imports.has(r.import_id)) { imports.set(r.import_id, this.#import(r.import_id)); backs.set(r.import_id, this.#takeBacks(r.import_id)); }
      const i = imports.get(r.import_id);
      if (i) moves.push(this.#moveOf(r, i, backs.get(r.import_id)));
    }
    return { moves, cursor: more ? idOf("move", rows[rows.length - 1].rn) : null };
  }

  /* ================================================================ R16: the registration with accepted-work */

  /** R16 (`accepted-work` R1's `finding`): one imported finding at one edition, with its published pair and the
   *  acceptance in force, or null when it is not held there or the viewer may not see the import. */
  findingFacts({ ref = null, edition = null, viewer = null } = {}) {
    if (!this.#sees(viewer)) return null;
    const p = typeof ref === "string" ? parseImportedFindingRef(ref.trim()) : null;
    if (!p || !Number.isInteger(edition) || edition < 1) return null;
    const i = this.#import(p.import);
    const e = i ? this.#edition(i.import_id, edition) : null;
    const r = e ? this.#resultsOf(i.import_id, edition).find((x) => x.finding === p.finding) : null;
    if (!r) return null;
    const a = this.#acceptanceFor(i.import_id, edition, p.finding);
    return { ref: ref.trim(), import: i.import_id, group: i.source_group, case: i.case_id, edition, finding: p.finding,
             manifest_sha: e.manifest_sha, result: r.result, pair: r.published ?? r.pair ?? null,
             acceptance: a ? { by: a.by, at: a.at, reason: a.reason, checked: a.checked, gaps: a.gaps } : null };
  }

  /** R16 (`accepted-work` R1's `openFlags`): the open flags on the edition a ref names, the edition's own and the named
   *  finding's; null when the viewer may not see the import. */
  openFlagsFacts({ ref = null, edition = null, viewer = null } = {}) {
    if (!this.#sees(viewer)) return null;
    const p = typeof ref === "string" ? parseImportedFindingRef(ref.trim()) : null;
    const e = p && Number.isInteger(edition) ? this.#edition(p.import, edition) : null;
    const flags = e ? this.#openFlags(e.import_id, edition).filter((f) => f.finding === null || f.finding === p.finding)
      .map(({ flag, finding, issue, at }) => ({ flag, finding, issue, at })) : [];
    return { flags, complete: true };
  }

  /** R24 (`accepted-work` R9; `case-carriage` R19): every flag on the edition a ref names, the edition's own and the named
   *  finding's, that was open at any instant from `since` through the read, open now or cleared since, in the order
   *  flagged, each `{flag, finding, issue, opened_at, cleared_at}` (`cleared_at` null while open), with `complete: true`.
   *  A `since` that is not an instant `record-core` stamps (R47, either precision) answers `complete: false` and no flags;
   *  a viewer who may not see the import, null. A clear is stamped to the second, so it is compared with `since` at the
   *  second: a flag cleared in the second `since` falls in is answered, never dropped. Read as the plane; writes nothing
   *  and never throws. */
  flagHistoryFacts({ ref = null, edition = null, since = null, viewer = null } = {}) {
    try {
      if (!this.#sees(viewer)) return null;
      const ms = typeof since === "string" ? Date.parse(since) : NaN;
      if (!Number.isFinite(ms) || ms < 0 || (stampInstant("second", ms) !== since && stampInstant("millisecond", ms) !== since))
        return { flags: [], complete: false };
      const from = stampInstant("second", ms);
      const p = typeof ref === "string" ? parseImportedFindingRef(ref.trim()) : null;
      const e = p && Number.isInteger(edition) ? this.#edition(p.import, edition) : null;
      if (!e) return { flags: [], complete: true };
      const flags = this.#rows(`SELECT f.rn, f.finding, f.issue, f.at, c.at AS cleared_at FROM case_import_flags f
                                  LEFT JOIN case_import_clears c ON c.flag_rn = f.rn
                                 WHERE f.import_id=? AND f.edition=? AND (f.finding IS NULL OR f.finding=?) ORDER BY f.rn`,
                                e.import_id, Number(e.edition), p.finding)
        .filter((f) => f.cleared_at === null || f.cleared_at === undefined || instantOrder(f.cleared_at, from) >= 0)
        .map((f) => ({ flag: idOf("flag", f.rn), finding: f.finding ?? null, issue: f.issue, opened_at: f.at,
                       cleared_at: f.cleared_at ?? null }));
      return { flags, complete: true };
    } catch { return { flags: [], complete: false }; }
  }

  /** R16 (`accepted-work` R1's `withdrawals`): the withdrawals of acceptances, in withdrawal order after `after`, at most
   *  `limit` (1 to 1,000, default 200), with `cursor` the last one listed when more follow. Read as the plane. */
  withdrawals({ after = null, limit = null } = {}) {
    const n = int(limit);
    const cap = Math.min(n ?? WITHDRAWALS_PAGE, WITHDRAWALS_PAGE_MAX);
    const from = rnOf("withdrawal", after) ?? 0;
    const rows = this.#rows(`SELECT * FROM case_import_withdrawals WHERE rn > ? ORDER BY rn LIMIT ?`, from, cap + 1);
    const more = rows.length > cap;
    if (more) rows.length = cap;
    return { withdrawals: rows.map((w) => ({ withdrawal: idOf("withdrawal", w.rn), import: w.import_id, edition: Number(w.edition),
                                             refs: parse(w.refs, []), at: w.at })),
             cursor: more ? idOf("withdrawal", rows[rows.length - 1].rn) : null };
  }

  /** R16: fills `accepted-work`'s registration (its R1) once, each function synchronous, with R24's `flagHistory` (its R9);
   *  the answer is kept. */
  start() {
    if (this.registration) return this.registration;
    this.registration = this.#call(() => this.acceptedWork.registerAcceptedWork("case-import", {
      finding: (q) => this.findingFacts(q || {}),
      openFlags: (q) => this.openFlagsFacts(q || {}),
      withdrawals: (q) => this.withdrawals(q || {}),
      moves: (q) => this.moves(q || {}),
      flagHistory: (q) => this.flagHistoryFacts(q || {}) }), { ok: false, reason: "REGISTRATION_FAILED" });
    return this.registration;
  }
}

/* The member acts and reads answer their own refusals with code, check and translation (DEC-49). */
for (const m of ["importedCase", "acceptImported", "withdrawAcceptance", "flagImported", "clearFlag", "watchImport", "unwatchImport",
                 "regradeImported", "rerunStart", "rerunPair", "rerunRead"]) {
  const fn = CaseImport.prototype[m];
  CaseImport.prototype[m] = function (...a) { return withRow(fn.apply(this, a)); };
}
for (const m of ["importCaseFile", "completeImportedDocument", "recordDocketRead"]) {
  const fn = CaseImport.prototype[m];
  CaseImport.prototype[m] = async function (...a) { return withRow(await fn.apply(this, a)); };
}

const instances = new WeakMap();

/** K61: the one instance per host; at creation it creates and declares its tables (whole store only, R13), registers
 *  its figures, and fills accepted-work's registration (R16). */
export function caseImportOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    c = new CaseImport({ ...d, host, storage, record, membership, env: d.env ?? host.env ?? null });
    instances.set(host, c);
    c.migrate();
    c.purgeDeclaration = record.declarePurge("case-import", CASE_IMPORT_TABLES.map((name) => ({ name, keys: [] })));
    c.countsRegistration = record.registerCounts("case-import",
      ["caseImports", "caseImportEditions", "caseImportAcceptances", "caseImportFlags"], () => {
        const n = (t) => Number([...storage.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n);
        return { caseImports: n("case_imports"), caseImportEditions: n("case_import_editions"),
                 caseImportAcceptances: n("case_import_acceptances"), caseImportFlags: n("case_import_flags") };
      });
    c.start();
  }
  return c;
}

/** Which purge declaration names one of this module's tables (record-core R21). */
export function caseImportOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return CASE_IMPORT_TABLES.includes(name);
}

/** R2: the member ops `caseImportOps` answers, by name (the test set of ops is this declaration): the ten of T28–T34 and
 *  R27, R29, R30 and R31's four. */
export const CASE_IMPORT_OPS = Object.freeze(["caseimport", "caseimportdocument", "importaccept", "importacceptwithdraw",
  "importedcase", "importedcases", "importflag", "importflagclear", "importregrade", "importunwatch", "importwatch",
  "rerunpair", "rerunread", "rerunstart"]);

/** The module's member ops: `by` and `viewer` are the control plane's stamps, read from the query, never the
 *  body. `op-declarations` declares them, `control-plane` routes them and `plane` composes them (L11). Bytes arrive in
 *  the body as base64 text (`parts`, a list; `bytes`). */
export function caseImportOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  const pick = (k) => (b[k] !== undefined && b[k] !== null ? b[k] : url.searchParams.has(k) ? q(k) : null);
  const by = q("by") ?? q("author"), viewer = q("viewer");
  return {
    caseimport: () => m.importCaseFile({ parts: Array.isArray(b.parts) ? b.parts : null, by, viewer,
      groupFields: b.groupFields ?? b.group_fields ?? null }),
    importedcases: () => m.importedCases({ viewer }),
    importedcase: () => m.importedCase({ import: q("import"), edition: q("edition"), viewer }),
    caseimportdocument: () => m.completeImportedDocument({ import: pick("import"), edition: pick("edition"),
      bytes: b.bytes ?? null, by, viewer }),
    importaccept: () => m.acceptImported({ import: pick("import"), edition: pick("edition"), findings: pick("findings"),
      checked: pick("checked"), reason: pick("reason"), gaps: pick("gaps"), by, viewer }),
    importacceptwithdraw: () => m.withdrawAcceptance({ import: pick("import"), edition: pick("edition"), reason: pick("reason"),
      by, viewer }),
    importflag: () => m.flagImported({ import: pick("import"), edition: pick("edition"), finding: pick("finding"),
      issue: pick("issue"), by, viewer }),
    importflagclear: () => m.clearFlag({ flag: pick("flag"), reason: pick("reason"), by, viewer }),
    importwatch: () => m.watchImport({ import: pick("import"), publisher: pick("publisher"), by, viewer }),
    importunwatch: () => m.unwatchImport({ import: pick("import"), by, viewer }),
    /* R27, R29–R31 (T51; K4169): regrade another group's case, and re-run its work in a project of this group */
    importregrade: () => m.regradeImported({ import: pick("import"), edition: pick("edition"), lens: pick("lens"), viewer }),
    rerunstart: () => m.rerunStart({ project: pick("project"), import: pick("import"), edition: pick("edition"), by, viewer }),
    rerunpair: () => m.rerunPair({ project: pick("project"), source_finding: pick("source_finding"), own_finding: pick("own_finding"),
      edition: pick("edition"), withdraw: pick("withdraw"), by, viewer }),
    rerunread: () => m.rerunRead({ project: pick("project"), viewer }),
  };
}

/* R33 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops this module serves that a screen sends or this
   tranche adds, declared beside the ops map. Of the five that have hand rows (`op-declarations`, `op-grades`) each row's
   classes, `mutating`, weight and description are theirs, copied (`op-grades`' act help, which a declaration must equal); of the four new ones they are R32's table, and each also gives its stamps and capability. `fields.accepts` is every field the arm reads from `url` and `body` (the stamps
   `viewer` and `by` excluded), `fields.requires` each field it refuses without. */
/* the one sentence `op-grades` holds for each of the five ops (its act help), which a declaration must equal (its R50) */
const IMPORT_DIRECTED = localize("case-import.declared.import_directed", "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle");
export const DECLARED_OPS = Object.freeze({
  caseimport: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "undetermined",
    description: IMPORT_DIRECTED,
    fields: { accepts: ["parts", "groupFields", "group_fields"], requires: ["parts"] } },
  importaccept: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reasoned", refusal: "IMPORT_ACCEPT_NO_REASON",
    description: IMPORT_DIRECTED,
    fields: { accepts: ["import", "edition", "findings", "checked", "reason", "gaps"], requires: ["import", "edition", "findings", "checked", "reason"] } },
  importacceptwithdraw: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reasoned", refusal: "IMPORT_ACCEPT_NO_REASON",
    description: IMPORT_DIRECTED,
    fields: { accepts: ["import", "edition", "reason"], requires: ["import", "edition", "reason"] } },
  importflag: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reasoned", refusal: "IMPORT_FLAG_NO_ISSUE",
    description: IMPORT_DIRECTED,
    fields: { accepts: ["import", "edition", "finding", "issue"], requires: ["import", "edition", "issue"] } },
  importwatch: { classes: ["admin", "member"], machineClasses: [], mutating: true, weight: "reversible",
    description: IMPORT_DIRECTED,
    fields: { accepts: ["import", "publisher"], requires: ["import", "publisher"] } },
  importregrade: { classes: ["admin", "member"], machineClasses: [], mutating: false, stamps: ["viewer"], needs: null, weight: "read",
    description: localize("case-import.declared.importregrade", "read: one imported case read under a lens (as the source published it, with the source's bias removed, or under this team's own), each finding that moved with the statement that moved it; writes nothing"),
    fields: { accepts: ["import", "edition", "lens"], requires: ["import", "edition", "lens"] } },
  rerunstart: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["viewer", "by"], needs: "contribute", weight: "reversible",
    description: localize("case-import.declared.rerunstart", "project-directed: an owner declares one of the team's projects a re-run of an imported edition's work, keyed by project and import; writes this module's rows and moves no bundle"),
    fields: { accepts: ["project", "import", "edition"], requires: ["project", "import", "edition"] } },
  rerunpair: { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["viewer", "by"], needs: "contribute", weight: "reversible",
    description: localize("case-import.declared.rerunpair", "project-directed: a member of a re-run's project states that one of its findings answers the same claim as an imported finding, or takes that statement back; appended, never rewritten"),
    fields: { accepts: ["project", "source_finding", "own_finding", "edition", "withdraw"], requires: ["project", "source_finding", "own_finding"] } },
  rerunread: { classes: ["admin", "member"], machineClasses: [], mutating: false, stamps: ["viewer"], needs: null, weight: "read",
    description: localize("case-import.declared.rerunread", "read: a project's re-runs of imported editions, the source's findings beside the project's paired findings, and the difference between the two lenses; writes nothing"),
    fields: { accepts: ["project"], requires: ["project"] } },
});
