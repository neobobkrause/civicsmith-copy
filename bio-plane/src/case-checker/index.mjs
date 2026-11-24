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

/** R13, R25: the program file, `{text, sha256, body_sha256}` (its text, its SHA-256 and the SHA-256 its first line
 *  names), frozen. The program is held as data (`./program.mjs`), so importing this module builds none of it: it is read
 *  and parsed on the first call, and the same object is answered after, reading nothing again. */
export function caseCheckerProgramText() {
  if (held === null) {
    const p = JSON.parse(programData());
    held = Object.freeze({ text: p.text, sha256: p.sha256, body_sha256: p.body_sha256, bytes: new TextEncoder().encode(p.text).length });
  }
  return held;
}

/** R13: the program file as served: its text, its SHA-256, the SHA-256 its first line names, and how to run it. */
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
 *  refused, with the versions held (`held: false`), so the read raises no refusal of its own. */
export function caseFileSpec(version) {
  const v = typeof version === "string" ? version : null;
  if (v === null || !Object.hasOwn(CASE_FILE_SPECS, v))
    return { held: false, version: v === null ? null : v.slice(0, 80), versions: [...CASE_FILE_SPEC_VERSIONS],
             detail: localize("case-checker.index.holds_several", "{reason}; it holds the specifications of {head} and {last}, each named as version",
                              { reason: noSpecification(v), head: CASE_FILE_SPEC_VERSIONS.slice(0, -1).join(", "), last: CASE_FILE_SPEC_VERSIONS.at(-1) }) };
  return { held: true, version: v, media_type: "text/markdown", text: CASE_FILE_SPECS[v], versions: [...CASE_FILE_SPEC_VERSIONS] };
}

/** R15: the two credential-free public reads, as `public-read` R18 registers them. */
export function caseCheckerPublicReads() {
  return {
    casechecker: { read: () => caseCheckerProgram(), params: [] },
    casefilespec: { read: (a) => caseFileSpec(a.version ?? null), params: ["version"] },
  };
}

const registered = new WeakMap();

/** R15: at start, register the public reads once per host with `public-read` (its R18); the registration's answer is
 *  kept and returned, so a refused one is seen. */
export function registerCaseCheckerPublicReads(host, deps = {}) {
  if (registered.has(host)) return registered.get(host);
  const publicRead = deps.publicRead || publicReadOf(host);
  const answer = publicRead.registerPublicReads("case-checker", caseCheckerPublicReads());
  registered.set(host, answer);
  return answer;
}
