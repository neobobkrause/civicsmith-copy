/* case-checker — the one checker of a case file (requirements: `build/requirements/case-checker.md`; DEC-112 (3)(6);
 * `BIO_Publication_v0_1.md` §5C; K1256, K1257).
 *
 * Anybody can check a published case, and recreate its findings, without a Civicsmith copy. This module is the one
 * checker:
 *
 *   checkCaseFile        R1–R11, R18, R20, R22–R24 (`./check.mjs`): a pure function Civicsmith runs on import (`case-import`);
 *   checkAccount         R24 (`./account.mjs`): the account's sentences judged against what they cite, for
 *                        `case-disclosures` R30 at the act and R1 offline;
 *   reweigh              R23 (`./check.mjs`, `./lens.mjs`; K2529): each finding's pair re-weighed under another lens, pure
 *                        and synchronous, over an answer already checked; `checkCaseFile`'s lens arm and `case-import` R4;
 *   the program          R13 (`./main.mjs`, built by `./build-program.mjs` into `./program.mjs`): the same code, one
 *                        file anyone runs offline with nothing to install; R25: held as data, read on first use;
 *   the specification    R14 (`./spec.mjs`): the readable text of each case-file format version;
 *   standards' use       R21 (`./standards.mjs`): `checkStandardsUse`, a pure check of how a case quotes the standards it
 *                        measures against and what it calls a benchmark; its caller with the record refuses (N717); each
 *                        departure carries `says: {key, vars}`, the members' words by key (R26);
 *   the public reads     R15: `casechecker` (the program) and `casefilespec` (a specification), registered once with
 *                        `public-read` (its R18) and served with no credential.
 *
 * Recreating shows a case intact and consistent, not true (R12). No place is named here (R17). */

import { programData } from "./program.mjs";
import { CASE_FILE_SPECS, CASE_FILE_SPEC_VERSIONS } from "./spec.mjs";
import { publicReadOf } from "../public-read/index.mjs";
import { localize } from "../setup-words/index.mjs";

export { checkCaseFile, RESULTS, RESULT_WORDS, CHECKER_VERSIONS, RECREATION_STATEMENT, REST_ON_ANOTHER_GROUP_STATEMENT,
         KEYS_NOT_CHECKED_STATEMENT, CHECKS_VERSION_STATEMENT, NOT_RECOMPUTED_STATEMENT, CAPTURES_NOT_CARRIED_STATEMENT, CALCULATION_RESULTS, accountStatement,
         keyFingerprint, readCaseFile, textAtExtent, reweigh } from "./check.mjs";
export { runProgram } from "./main.mjs";
export { checkAccount, ACCOUNT_CODES, DETERMINATION_WORDS, SUPPORT_WORDS, CONTRARY_WORDS } from "./account.mjs";
export { LENS_LIMIT_STATEMENT, LENS_NAMES } from "./lens.mjs";
export { checkStandardsUse, STANDARDS_USE_CODES, STANDARDS_USE_KEYS, NONCONFORMING_WORDS } from "./standards.mjs";
export { CASE_FILE_SPECS, CASE_FILE_SPEC_VERSIONS } from "./spec.mjs";

let held = null;

/**
 * R13: the program file as held.
 * @typedef {Object} ProgramText
 * @property {string} text the program's text
 * @property {string} sha256 the SHA-256 of the text's UTF-8 bytes
 * @property {string} body_sha256 the SHA-256 the program's first line names
 * @property {number} bytes the length of the text's UTF-8 bytes
 * @bound sha256, body_sha256: 64 lowercase hex
 */
/**
 * R13, R15: the program file as the public read `casechecker` serves it.
 * @typedef {Object} ProgramFile
 * @property {string} file `case-checker.mjs`
 * @property {string} media_type `text/javascript`
 * @property {string} sha256
 * @property {string} body_sha256
 * @property {number} bytes
 * @property {string} program the program's text
 * @property {string} run how to run it
 */
/**
 * R14, R15: the answer to a request for one specification. Held: `{held: true, version, media_type, text, versions}`.
 * Not held: `{held: false, version, versions, detail}`, `version` the version named (cut to 80 characters) or null,
 * `detail` why, naming the versions held.
 * @typedef {Object} CaseFileSpecAnswer
 * @property {boolean} held
 * @property {string|null} version
 * @property {string[]} versions every version held, oldest first
 * @property {string} [media_type] `text/markdown`, when held
 * @property {string} [text] the specification's Markdown text, when held
 * @property {string} [detail] when not held
 */
/**
 * R15: the public reads as `public-read` R18 registers them: each `{read, params}`, `params` the query parameters the
 * read takes.
 * @typedef {Object} CaseCheckerReads
 * @property {{read: (a?: unknown) => ProgramFile, params: string[]}} casechecker the read takes no parameter and ignores what it is handed
 * @property {{read: (a: {version?: unknown}) => CaseFileSpecAnswer, params: string[]}} casefilespec
 */

/** R13, R25: the program file, `{text, sha256, body_sha256}` (its text, its SHA-256 and the SHA-256 its first line
 *  names), frozen. The program is held as data (`./program.mjs`), so importing this module builds none of it: it is read
 *  and parsed on the first call, and the same object is answered after, reading nothing again.
 *  @returns {Readonly<ProgramText>} */
export function caseCheckerProgramText() {
  if (held === null) {
    const p = JSON.parse(programData());
    held = Object.freeze({ text: p.text, sha256: p.sha256, body_sha256: p.body_sha256, bytes: new TextEncoder().encode(p.text).length });
  }
  return held;
}

/** R13: the program file as served: its text, its SHA-256, the SHA-256 its first line names, and how to run it.
 *  @returns {ProgramFile} */
export function caseCheckerProgram() {
  const p = caseCheckerProgramText();
  return { file: "case-checker.mjs", media_type: "text/javascript", sha256: p.sha256, body_sha256: p.body_sha256,
           bytes: p.bytes, program: p.text,
           run: "node case-checker.mjs <part> [<part> ...] [--document <file> ...] [--keys <file>]" };
}

/* Why no specification is answered: no version was named, or the version named is not one this copy holds. */
const noSpecification = (v) => (v === null ? localize("case-checker.index.no_version_named", "no version was named")
  : localize("case-checker.index.no_specification", "this team's Civicsmith holds no specification of that version"));

/** R14, R15: the specification of one case-file format version. An unknown or absent version is answered, not
 *  refused, with the versions held (`held: false`), so the read raises no refusal of its own. Never throws.
 *  @param {unknown} version the version named, `bio-case-file/<n>`; anything but a string is no version named
 *  @returns {CaseFileSpecAnswer} */
export function caseFileSpec(version) {
  const v = typeof version === "string" ? version : null;
  if (v === null || !Object.hasOwn(CASE_FILE_SPECS, v))
    return { held: false, version: v === null ? null : v.slice(0, 80), versions: [...CASE_FILE_SPEC_VERSIONS],
             detail: localize("case-checker.index.holds_several", "{reason}; it holds the specifications of {head} and {last}, each named as version",
                              { reason: noSpecification(v), head: CASE_FILE_SPEC_VERSIONS.slice(0, -1).join(", "), last: CASE_FILE_SPEC_VERSIONS.at(-1) }) };
  return { held: true, version: v, media_type: "text/markdown", text: CASE_FILE_SPECS[v], versions: [...CASE_FILE_SPEC_VERSIONS] };
}

/** R15: the two credential-free public reads, as `public-read` R18 registers them.
 *  @returns {CaseCheckerReads} */
export function caseCheckerPublicReads() {
  return {
    casechecker: { read: () => caseCheckerProgram(), params: [] },
    casefilespec: { read: (a) => caseFileSpec(a.version ?? null), params: ["version"] },
  };
}

const registered = new WeakMap();

/** R15: at start, register the public reads once per host with `public-read` (its R18); the registration's answer is
 *  kept and returned, so a refused one is seen.
 *  @param {object} host the host the reads are registered for; a second call for the same host answers the first answer
 *  @param {{publicRead?: any}} [deps] `publicRead` the host's `public-read` instance (absent is `publicReadOf(host)`)
 *  @returns {{ok: boolean, module?: string|null, reason?: string, names?: string[], [more: string]: any}} `public-read`
 *    R18's answer: `{ok: true, module, names}`, or `{ok: false, reason, ...}` (`PROVIDER_MALFORMED`, `PROVIDER_DECLARED`) */
export function registerCaseCheckerPublicReads(host, deps = {}) {
  if (registered.has(host)) return registered.get(host);
  const publicRead = deps.publicRead || publicReadOf(host);
  const answer = publicRead.registerPublicReads("case-checker", caseCheckerPublicReads());
  registered.set(host, answer);
  return answer;
}
