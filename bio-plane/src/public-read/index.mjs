/* public-read — the published record served to anybody without a credential (requirements:
 * `build/requirements/public-read.md`; BIO_Publication_v0_1.md §1, §2, §3 rules 9–12 and 16). The public reads by hash,
 * by finding and by case, and the whole projection (R1–R4), and the evidence-package block beside a published case
 * (R8), and the named credential-free reads a later module registers (R18); beside a case, `docket`'s withdrawal stamp
 * and last entry (R20), and the docket and its feed served (R21); a case's criteria as `publication` froze them (R31);
 * what each published case froze for one question, with its signers and the pin check (R38).
 * It writes nothing (R16): every table it reads is `publication`'s, read under `publication` R40, and it reaches
 * `publication` and `docket` only through the services named below.
 *
 * Split from `publication` by copy (K617, K651; seam read `build/extraction/publication-split.md` §3.2): the methods
 * below are `publication/index.mjs`' `registerEvidenceBlock`, `#evidencePackage`, `publishedManifest`,
 * `#frozenPairsByCase`, `verifySha`, `publishedList`, `publishedEditions`, `publishedCase`, `#deliveredBy`,
 * `#looseEditionState`, `#resolveOneCase` and `#casesOfSha`, with their comments; `publication`'s job, after this one
 * merged, deleted its copies, and `publicReadOps` is spread in `plane`'s store op map (`../plane/store.mjs`). The legacy code's comments
 * moved with it and keep their old ids (REC-, CASE-, D-); a `publication` R id in them is named as such. The Worker
 * half (`../publication/worker.mjs`, `../container.mjs`, `../inband.mjs`: R5–R7, R9) is this module's by `paths` and
 * stays at those paths (K697, K702); the door's routes reach it through `./door.mjs`. Its refusal rows are its own,
 * in `./checks.mjs` (R17); the case document's tensions and blocks are read from `case-grammar`, and a member document's
 * cleaned copy is told by the row's stored marker, `case-grammar` R31's `obscured.kind` (R35, R3's `label_key`).
 *
 * REACHED as `publicReadOf(host, deps)` (K61): one instance per host, created on the first call with `deps`, returned
 * to every later caller. `deps`:
 *   publication    `caseEditionState` (its R53), `soleCase` (its R54), `caseDocMemberFrozen` (its R55),
 *                  `stampedEditions` (its R64, for R28: one read of every stamped edition), and its storage, whose
 *                  tables it reads under its R40, `published_cases`' `signed_at` and `published_at` among them (its R70,
 *                  for R29; K1826) (default: `publicationOf(host)`).
 *   docket         `withdrawalOf` (its R12), `lastEntryOf`, `docketPublic` (its R14, and its R24's `captures: "omit"`)
 *                  and `docketFeed` (its R15), for R20, R21 and R25:
 *                  the docket's public answers, which this module serves and never composes (N520; default:
 *                  `docketOf(host)`).
 *   record         `record-core`, for its strict `getSetting` (its R25, R83) of the one setting `declared_stake`, for R34 (default:
 *                  `recordOf(host)`, reached at the read, so a world without it reads the stake undetermined).
 *   roster         `project-roster`, for its `projectStake` (its R32), read at the call, for R36's `matter_stake` (default:
 *                  `projectRosterOf(host)`, so a world without it reads the matter stake undetermined).
 *   members        `membership`, for its `memberFacts` (`member-roster` R68, the founder's too), read at the call, for R41's
 *                  handles (default: `membershipOf(host)`; a world without it names every member by the plain word).
 *   storage        the Durable Object's storage (default: the host's).
 *
 * READ CONTRACT it reads in its own SQL, and never writes: `publication` R40's `published_bundles`, `published_cases`,
 * `published_case_members`, `cases`, `published_edges` and `published_shas`. */

import { publicationOf } from "../publication/index.mjs";
import { recordOf, SETTING_UNREADABLE } from "../record-core/index.mjs";
import { docketOf } from "../docket/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { membershipOf } from "../membership/index.mjs";
import { caseTensionsOf, caseDocumentBlocks, whatChangedOf, lensOf, LENS_HEAD,
         lensClosingSentencesOf, workingOnOf, methodOf, materialsOf, standingOf, gradingFactsOf, passagesOf,
         caseDocumentRequiresMaterials, caseDocumentStatesMemberBlocks } from "../case-grammar/index.mjs";
import { caseFilePath, caseFileEntryOf, calculationsOf, timelineOf, signedCitations } from "../case-grammar/index.mjs";
import { parseFrontmatter } from "../record-grammar/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { rowOf } from "./checks.mjs";
import { WITHHELD_SENTENCE, withholdingOf } from "./courtorders.mjs";
import { caseFileStateOf } from "./casefile.mjs";
export { CASEFILE_SENTENCES } from "./casefile-words.mjs";
import { delivererOf } from "../deliverer.mjs";
import { PUBLIC_READ_NAME, PUBLIC_READ_PARAM, PUBLIC_READ_OWN_OPS, PUBLIC_READ_RESERVED_PARAMS,
         DOCKET_FEED_MEDIA_TYPE } from "./reads.mjs";

/* CPDF-10: a column `publication` WROTE as JSON, read back; null rather than a throw on a malformed value. */
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/* R3 (DEC-101, DEC-103), R19: a signed document's front matter and body, parsed once (record-grammar); null for no text
   or no front matter, so every reader below answers its own null. */
const signedParts = (doc) => {
  if (!doc || typeof doc.text !== "string") return null;
  try { const p = parseFrontmatter(doc.text); return p.data ? { fm: p.data, body: p.body } : null; }
  catch { return null; }
};
/* R3, R35 (T47; N953; `case-grammar` R31): the key a reader's surface shows a copy's label by, chosen by what the signed
   row states, never by the label's current words. `obscured.kind` (`case-grammar` R31's stored marker) `document` is a
   member document's cleaned copy, `photo` a photo's copy. A row stating no kind (signed before T47) is a cleaned copy
   only when its signed label is, word for word, the cleaned-copy label as worded when the marker was introduced, held
   here frozen and never read from `case-carriage`, so a later re-wording of its `COPY_CLEANED_LABEL` re-keys no
   edition. A photo's copy is keyed by `case-grammar` R12's `marked` (`obscured_marked` when the row states it, else its
   label: not null is marked), so every earlier edition keys as it labels (K2527). */
export const LABEL_KEY_MARKED = "photo.obscured.label";
export const LABEL_KEY_UNMARKED = "photo.published.label";
export const LABEL_KEY_CLEANED = "document.cleaned.label";
export const CLEANED_LABEL_AT_MARKER = word("document.cleaned.label");
const photoKeyOf = (obscured) => (obscured.marked === true ? LABEL_KEY_MARKED : LABEL_KEY_UNMARKED);
const labelKeyOf = (obscured) => (obscured.kind === "document" ? LABEL_KEY_CLEANED
  : obscured.kind === "photo" ? photoKeyOf(obscured)
  : obscured.label === CLEANED_LABEL_AT_MARKER ? LABEL_KEY_CLEANED : photoKeyOf(obscured));
/* R3: the `materials` and `material_attestations` blocks as signed (`case-grammar` R11, R12), each row carried as its copy
   also answering its `label_key` beside its label; a row without `obscured` gains nothing. */
const keyedMaterialsOf = (fm) => {
  const read = materialsOf(fm);
  if (!read || !Array.isArray(read.materials)) return read;
  return { ...read, materials: read.materials.map((r) => (r.obscured != null ? { ...r, label_key: labelKeyOf(r.obscured) } : r)) };
};
/* R3 (DEC-103): the lens section of a signed body, from its head to the next `## ` heading, whole and as signed. */
const lensSection = (body) => {
  const lines = String(body ?? "").split(/\r\n|\n/);
  const at = lines.indexOf(LENS_HEAD);
  if (at < 0) return null;
  let end = at + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(at, end).join("\n").replace(/\s+$/, "");
};
/* R3 (DEC-103): what a document without the lens blocks says instead (R13: stated, never filled). */
export const LENS_FINGERPRINT_SENTENCE = word("public-read.edition_carries_lens");
export const LENS_NONE_IN_FORCE_SENTENCE = word("public-read.edition_carries_lens_fingerprint");
export const LENS_FINGERPRINT_UNDETERMINED_SENTENCE = word("public-read.edition_carries_lens_fingerprint_bias");
/* R22: a grade as the signed front matter writes it: the YAML word `null` (or nothing) is no grade. */
const gradeOf = (g) => (typeof g === "string" && g.trim() && g.trim() !== "null" ? g.trim() : null);
/* R22 (DEC-112 (4)(1)): each member's standing, from the signed document only: its role (`case_roles`), the bar the
   document records (`required_strength`, an undeclared bar is none) and its frozen pair (`case_strength`, per axis), handed
   to `case-grammar.standingOf`, the one spelling of the line. A document stating no member blocks answers null. */
export function standingsOf(fm) {
  if (!fm || !caseDocumentStatesMemberBlocks(fm)) return null;
  const rs = fm.required_strength && typeof fm.required_strength === "object" ? fm.required_strength : null;
  const declared = !!(rs && (rs.declared === true || rs.declared === "true"));
  const bar = declared ? { capture: gradeOf(rs.capture), connection: gradeOf(rs.connection) } : null;
  const rows = Array.isArray(fm.case_strength) ? fm.case_strength : [];
  const out = new Map();
  for (const r of Array.isArray(fm.case_roles) ? fm.case_roles : []) {
    if (!r || typeof r !== "object" || typeof r.target !== "string") continue;
    const pair = {};
    for (const s of rows) if (s && s.target === r.target && typeof s.axis === "string") pair[s.axis] = gradeOf(s.grade);
    out.set(r.target, standingOf({ role: gradeOf(r.role), bar, pair }));
  }
  return out;
}
/* R39 (C2): the words the signed case document states for each member's finding, `case_conclusions:` by target: its
   `claim` and its `falsifier`, a string with letters in it or null. Null for a document stating no member blocks. */
export function caseWordsOf(fm) {
  if (!fm || !caseDocumentStatesMemberBlocks(fm)) return null;
  const words = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out = new Map();
  for (const r of Array.isArray(fm.case_conclusions) ? fm.case_conclusions : [])
    if (r && typeof r === "object" && typeof r.target === "string")
      out.set(r.target, { claim: words(r.claim), falsifier: words(r.falsifier) });
  return out;
}
/* R23: a text held by `publication`'s `publishedMaterialText` (its R57), whichever shape it answers in. */
const heldText = (v) => (typeof v === "string" ? v : v && typeof v.text === "string" ? v.text : null);
const HEX64 = /^[0-9a-f]{64}$/;
/* R28 (K5148): the case-file kinds that are the grammar's scaffolding and hold no member material of their own: the criteria, and a finding's facts files (a finding's own bytes are its `finding` kind). */
const SCAFFOLD_KINDS = new Set(["criteria", "grading_facts", "passages"]);
/* R5 (T46; N906, K2832): a SHA-256 of 64 hexadecimal digits in upper or mixed case is read as its lowercase form, by
   the store as by the Worker, never refused for its case; anything else is answered as given. */
const lowerSha = (v) => (typeof v === "string" && /^[0-9a-fA-F]{64}$/.test(v) ? v.toLowerCase() : v);
/* R28 with R32 (K2145): a carried archive member's archives hold its bytes, so when an order withholds a material's
   `document` file, every `archive` and `container` file the case file carries under that material's ref (its record and
   each enclosing archive, outward) is withheld too, by the same orders. Mutates `withheld` (`withholdingOf`'s map).
   Fix round 6, G50 (B): a `document` file at a capture's own path (`materials/<ref>/<sha>/document`, only a `ref` on several
   rows of a `/4` case file has one) sits one directory deeper than the ref's chain, so the directory prefix no longer
   covers it. There only the first link is matched exactly, by the member in its path (the document's own `container`
   record, `containers/<capture>.json`); every other link (every archive, every outward record) is not resolved here, so it
   falls back to the ref level (everything under `materials/<ref>/`), except another capture's own first-link record, which
   belongs to a document this order does not name. It may therefore over-withhold a sibling capture's outward chain and never
   under-withholds. A one-row `ref` and every `/1`-`/3` file keep the directory prefix rule as it was. */
function withholdChains(withheld, manifest) {
  const files = manifest && Array.isArray(manifest.files) ? manifest.files : [];
  const entryOf = (f) => (f && typeof f.path === "string" ? caseFileEntryOf(f.path) : null);
  for (const d of files) {
    if (!d || d.kind !== "document" || typeof d.path !== "string" || !withheld.has(d.sha256)) continue;
    const at = entryOf(d);
    const captured = at && at.kind === "document" && at.capture ? at : null;
    const under = captured ? `materials/${captured.ref}/` : d.path.slice(0, d.path.lastIndexOf("/") + 1);
    const siblings = captured ? new Set(files.map(entryOf).filter((e) => e && e.kind === "document" && e.ref === captured.ref && e.capture
      && e.capture !== captured.capture).map((e) => e.capture)) : null;
    const orders = withheld.get(d.sha256);
    for (const f of files) {
      if (!f || (f.kind !== "archive" && f.kind !== "container") || typeof f.path !== "string" || !f.path.startsWith(under)) continue;
      if (siblings && f.kind === "container") { const e = entryOf(f); if (e && siblings.has(e.member)) continue; }
      const prev = withheld.get(f.sha256) || [];
      withheld.set(f.sha256, [...prev, ...orders.filter((o) => !prev.includes(o))]);
    }
  }
}
/* R21: the fixed address a case's docket is served at (its feed's is `op=docketfeed&case=`). */
export const docketAddress = (caseId) => `op=docketpublic&case=${encodeURIComponent(caseId)}`;
export const LENS_NO_DOCUMENT_SENTENCE = word("public-read.signed_case_document");

/* R28: a finding row whose bytes an order in force withholds: its id and hash stay (both public), its title, frozen
   from those bytes, is not served, and the withholding is stated with its orders. Unchanged when nothing withholds it. */
const withheldRow = (row, orders) => (orders && orders.length
  ? { ...row, title: null, withheld: { orders, detail: WITHHELD_SENTENCE } } : row);
/* R28: a case edition row with its stamps, if any (`court_orders`); an edition withheld whole states no scope, bias
   acknowledgement (nor the other content keys named) and says why. Unchanged when the edition has no stamp. */
function withheldCase(row, index, content) {
  const w = index.editions.get(`${row.case_id}\u0000${Number(row.edition)}`);
  if (!w) return row;
  const out = { ...row, court_orders: w.orders };
  if (!w.whole) return out;
  for (const k of ["scope", "bias_acknowledgement", ...content]) if (Object.hasOwn(out, k)) out[k] = null;
  return { ...out, withheld: { whole: true, detail: WITHHELD_SENTENCE } };
}

/* R31 (`publication` R72): what an edition answers of its criteria, as R53 froze them; never recomputed. */
export const CRITERIA_NOT_RECORDED_SENTENCE = word("public-read.criteria_recorded_edition");
export const CRITERIA_NOT_A_CASE_SENTENCE = word("public-read.case_states_criteria");
function criteriaOf(state, theCase, whole) {
  if (!theCase) return { criteria: null, criteria_detail: CRITERIA_NOT_A_CASE_SENTENCE };
  if (whole) return { criteria: null, criteria_detail: WITHHELD_SENTENCE };
  if (!Array.isArray(state.criteria))
    return { criteria: null, criteria_detail: typeof state.criteria_detail === "string" && state.criteria_detail
      ? state.criteria_detail : CRITERIA_NOT_RECORDED_SENTENCE };
  return { criteria: state.criteria };
}

/* R26 (D275; `calc-grammar` R10): every calculation output is a computed fact, never a finding. */
export const COMPUTED_FACT = "computed fact";
export const CALC_DISCLOSED_SENTENCE = word("public-read.calculation_agree_recomputed");
export const CALC_UNDISCLOSED_SENTENCE = word("public-read.calculation_agree_recomputed_input");
export const SHARE_NO_DENOMINATOR_SENTENCE = word("public-read.signed_document_states");
export const TIMELINE_SENTENCE = word("public-read.timeline_case_document");
/* R23: the SHA-256 of each input a `calculations:` row names (`case-grammar` R18: each input's name and hash), whether
   the row lists them as `[{name, sha256}]` or as `{name: sha256}`, in the row's order, each once. */
function inputHashes(inputs) {
  const shas = Array.isArray(inputs) ? inputs.map((i) => (i && typeof i === "object" ? (i.sha256 ?? i.sha) : i))
    : inputs && typeof inputs === "object" ? Object.values(inputs).map((i) => (i && typeof i === "object" ? (i.sha256 ?? i.sha) : i))
    : [];
  return [...new Set(shas.map((s) => String(s ?? "").toLowerCase()).filter((s) => HEX64.test(s)))];
}
/* R27: an item `case-grammar` R20 writes as placed nowhere. */
const isNowhere = (when) => when === "nowhere" || !!(when && typeof when === "object" && when.nowhere === true);
/* R26: one output, as signed, with its denominator lifted beside it (`calc-grammar` R8: `ratio` and `share` carry
   `{numerator, denominator, value}`); a group's results are answered as signed, each element likewise. */
function outputOf(key, result) {
  const one = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { result: v ?? null };
    const share = Object.hasOwn(v, "numerator") || Object.hasOwn(v, "denominator") || v.op === "share" || v.op === "ratio";
    if (!share) return { result: v };
    return { result: v, numerator: v.numerator ?? null, denominator: v.denominator ?? null,
             ...(v.denominator == null ? { denominator_detail: SHARE_NO_DENOMINATOR_SENTENCE } : {}) };
  };
  if (Array.isArray(result))
    return { key, groups: result.map((g) => ({ ...one(g), label: COMPUTED_FACT })), label: COMPUTED_FACT };
  return { key, ...one(result), label: COMPUTED_FACT };
}

/* R34 (T45; N883, N892 (d); Actions D16, D28d; v0.2 rule 21): the group's per-group fields, stated in words where they
   are undetermined or absent (R13): never a guess, never an unread stake read as none. */
export const DECLARED_STAKE_SETTING = "declared_stake";
export const GROUP_FIELDS_SENTENCE = word("public-read.group_public_identity");
export const GROUP_IDENTITY_UNDETERMINED_SENTENCE = word("public-read.group_public_identity_undetermined");
export const STAKE_NONE_SENTENCE = word("public-read.group_declared_stake");
export const STAKE_UNDETERMINED_SENTENCE = word("public-read.group_declared_stake_read");
export const GROUP_FIELDS_CURRENT_SENTENCE = word("public-read.group_public_identity_declared");

export class PublicRead {
  #evidenceBlock = null; // R8: {module, name, fn}, filled once
  #publicReads = new Map(); // R18: name -> {module, params, read}, each name registered once
  #originalsByEdition = new Map(); // R23 (T38): `case NUL edition` -> the originals of the material its signed document states as carried by copy
  #groupIdentity = null; // R34: {identity}, filled once
  #record; // R34: () => record-core, reached at the read
  #roster; // R36: () => project-roster, reached at the read
  #members; // R41: () => membership, reached at the read

  constructor({ storage, publication, docket, record = null, roster = null, members = null } = {}) {
    this.sql = storage.sql;
    this.publication = publication;
    this.docket = docket;
    this.#record = typeof record === "function" ? record : () => record;
    this.#roster = typeof roster === "function" ? roster : () => roster;
    this.#members = typeof members === "function" ? members : () => members;
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }

  /* ---------------------------------------------------------------- R36: the evidence-package block */

  /** R8 (was `publication` R36): a later module fills, once at start, one evidence-package block: `fn({caseId, edition, findings})` answers
   *  the block `publishedCase` (R3) carries under `name` beside the case, computed at the read. `filings` fills the
   *  available-actions block (its R15). Nothing it answers enters the case's own bytes. A second registration is
   *  refused `PROVIDER_DECLARED`, a malformed one `PROVIDER_MALFORMED`. */
  registerEvidenceBlock(module, name, fn) {
    if (!str(module) || !/^[a-z][a-z0-9_]{0,63}$/.test(String(name ?? "")) || typeof fn !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED",
               detail: "an evidence-package block names its module, a lowercase block name and its function" };
    if (this.#evidenceBlock)
      return { ok: false, reason: "PROVIDER_DECLARED", module: this.#evidenceBlock.module,
               detail: `the evidence-package block is already registered by ${this.#evidenceBlock.module}` };
    this.#evidenceBlock = { module: str(module), name: String(name), fn };
    return { ok: true, module: this.#evidenceBlock.module, name: this.#evidenceBlock.name };
  }

  /* R8: the package's block for one answered case edition, computed at the read. A block that throws is stated as
     unavailable, never as absent; with none registered the package says it carries no such block. */
  #evidencePackage(caseId, edition, findings) {
    if (!this.#evidenceBlock)
      return { blocks: {}, detail: localize("public-read.index.no_module_provides_an_evidence", "no module provides an evidence-package block, so this package carries none; the evidence package is the published case edition itself") };
    const { name, module, fn } = this.#evidenceBlock;
    let value;
    try { value = fn({ caseId, edition, findings: findings.map((f) => f.bundle_id) }); }
    catch (e) { value = { unavailable: true, detail: localize("public-read.index.could_not_compute_this_block", "{module} could not compute this block: {error}", { module, error: String(e && e.message || e).slice(0, 200) }) }; }
    return { blocks: { [name]: value ?? null },
             detail: localize("public-read.index.each_block_is_computed", "each block is computed at this read by the module that provides it ({module}); it is not in the case's signed bytes, and nothing of it is a claim the case makes", { module }) };
  }


  /* ---------------------------------------------------------------- R34: the group's per-group fields */

  /** R34: takes, once at start, the one source of the group's public identity: `identity()` answers it as
   *  `instance-setup`'s `groupIdentityPublic` does (its R10: `group`, `display_name`, `domain`, `domain_verified_at`).
   *  A second registration is refused `PROVIDER_DECLARED`, one without the door `PROVIDER_MALFORMED`; each registers
   *  nothing (`publication` R77's pattern). */
  registerGroupIdentity({ identity } = {}) {
    if (typeof identity !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED",
               detail: "the team's identity source is registered with its door, identity(); nothing was registered" };
    if (this.#groupIdentity)
      return { ok: false, reason: "PROVIDER_DECLARED",
               detail: "the team's identity source is already registered; the first stands, and nothing was registered" };
    this.#groupIdentity = { identity };
    return { ok: true };
  }

  /** R34: the group's per-group fields, synchronously, with no credential and no viewer: `{group, name, domain,
   *  domain_verified_at, stake, detail}`. The first four are exactly what the registered source answers (`name` its
   *  display name); with none registered, or one that throws or answers no object, all four are null and `detail` says
   *  the identity is undetermined. `stake` is `record-core`'s setting `declared_stake` as held: null when never set,
   *  `"undetermined"` when it cannot be read, never null then. It reads nothing else (R10), writes nothing and never
   *  throws.
   *  R36 (T50; N933): with a `project` given it also answers `matter_stake`, the team's own stake for that matter beside
   *  its team-wide `stake`, which it never replaces: `project-roster.projectStake(project)` (its R32) as `{stake, set_by,
   *  set_at, source: "project"}`; null with no project or a project whose latest entry is none; a stake that cannot be
   *  read is `{stake: "undetermined", ...}`, never null. */
  groupFields({ project = null } = {}) {
    const said = [];
    /* The identity, copied out of the source's answer inside the guard, so an answer that throws when read is an
       undetermined identity too, never a throw. */
    let id = null;
    try {
      const a = this.#groupIdentity ? this.#groupIdentity.identity() : null;
      if (a && typeof a === "object" && !Array.isArray(a) && typeof a.then !== "function") {
        const f = (k) => (Object.hasOwn(a, k) ? a[k] ?? null : null);
        id = { group: f("group"), name: Object.hasOwn(a, "display_name") ? f("display_name") : f("name"),
               domain: f("domain"), domain_verified_at: f("domain_verified_at"),
               detail: typeof a.detail === "string" && a.detail ? a.detail : null };
      }
    } catch { id = null; }
    if (!id) said.push(GROUP_IDENTITY_UNDETERMINED_SENTENCE);
    else if (id.detail) said.push(id.detail);
    let stake;
    try {
      const record = this.#record();
      if (!record || typeof record.getSetting !== "function") throw new Error("no record");
      /* T46 (N904; record-core R83): the strict read, so a stored value that cannot be read is told from one never
         set; `SETTING_UNREADABLE` (compared by identity) is an unread stake, never none. */
      const v = record.getSetting(DECLARED_STAKE_SETTING, { strict: true });
      if (v === SETTING_UNREADABLE) throw new Error("declared_stake unreadable");
      stake = v === undefined ? null : v;
      if (stake === null) said.push(STAKE_NONE_SENTENCE);
    } catch {
      stake = "undetermined";
      said.push(STAKE_UNDETERMINED_SENTENCE);
    }
    return { group: id ? id.group : null, name: id ? id.name : null, domain: id ? id.domain : null,
             domain_verified_at: id ? id.domain_verified_at : null, stake,
             detail: said.length ? said.join("; ") : GROUP_FIELDS_SENTENCE, matter_stake: this.#matterStake(project) };
  }

  /* R36: the matter stake of one project, read through `project-roster`'s `projectStake` (its R32); never throws. */
  #matterStake(project) {
    if (typeof project !== "string" || !project) return null;
    const unread = { stake: "undetermined", set_by: null, set_at: null, source: "project" };
    try {
      const roster = this.#roster();
      if (!roster || typeof roster.projectStake !== "function") return unread;
      const s = roster.projectStake(project);
      if (!s || typeof s !== "object") return unread;
      if (s.stake === null || s.stake === undefined) return null;
      if (s.stake === "undetermined") return unread;
      return { stake: s.stake, set_by: s.set_by ?? null, set_at: s.set_at ?? null, source: "project" };
    } catch { return unread; }
  }

  /* ---------------------------------------------------------------- R18: the registered public reads */

  /** R18: a later module registers once at start a set of named, credential-free reads, served on the public path
   *  (`op=publicread&name=<name>`, or `op=<name>` where the door is told the name; `./door.mjs`). `reads` maps each
   *  name to its read, `fn(args)` or `{params, read}`: `params` are the query parameters it takes (none by default), and
   *  `args` holds exactly those the caller sent, as strings, so a read is handed nothing else. The registration is
   *  checked whole and is all or nothing: a malformed one is refused `PROVIDER_MALFORMED` naming what is wrong (a name
   *  that is not an op's spelling or is this module's own op, a read that is no function, a parameter that is
   *  malformed or carries a credential or a stamp, R10); a name already registered, by any module, is refused
   *  `PROVIDER_DECLARED` naming who holds it, and the first stands. */
  registerPublicReads(module, reads) {
    const mod = str(module);
    const entries = reads && typeof reads === "object" && !Array.isArray(reads) ? Object.entries(reads) : [];
    const wrong = [];
    if (!mod) wrong.push("the registration names no module");
    if (!entries.length) wrong.push("it names no read");
    const specs = [];
    for (const [name, spec] of entries) {
      const read = typeof spec === "function" ? spec : spec && typeof spec.read === "function" ? spec.read : null;
      const params = typeof spec === "function" || (spec && spec.params === undefined) ? []
        : spec && Array.isArray(spec.params) ? spec.params : null;
      if (!PUBLIC_READ_NAME.test(name)) wrong.push(`${JSON.stringify(name)} is not a read's name (lowercase letters and digits)`);
      else if (PUBLIC_READ_OWN_OPS.includes(name)) wrong.push(`${name} is this module's own op`);
      if (!read) wrong.push(`${name} has no read function`);
      if (!params) { wrong.push(`${name}'s params is not a list`); continue; }
      for (const p of params) {
        if (typeof p !== "string" || !PUBLIC_READ_PARAM.test(p)) wrong.push(`${name} declares a malformed parameter`);
        else if (PUBLIC_READ_RESERVED_PARAMS.includes(p))
          wrong.push(`${name} declares ${p}, which carries a credential or a stamp and is never handed to a public read`);
      }
      if (new Set(params).size !== params.length) wrong.push(`${name} declares a parameter twice`);
      specs.push({ name, read, params: [...params] });
    }
    if (wrong.length)
      return { ok: false, reason: "PROVIDER_MALFORMED", module: mod || null, problems: wrong,
               detail: "a public-read registration names its module and each read's name, its function and the "
                     + "parameters it takes; nothing of this one was registered" };
    const taken = specs.filter((s) => this.#publicReads.has(s.name))
      .map((s) => ({ name: s.name, module: this.#publicReads.get(s.name).module }));
    if (taken.length)
      return { ok: false, reason: "PROVIDER_DECLARED", module: mod, taken,
               detail: `${taken.map((t) => `${t.name} is already registered by ${t.module}`).join("; ")}; `
                     + "the first registration stands, and nothing of this one was registered" };
    for (const s of specs) this.#publicReads.set(s.name, { module: mod, params: Object.freeze(s.params), read: s.read });
    return { ok: true, module: mod, names: specs.map((s) => s.name) };
  }

  /** R18: every registered read, `{name, module, params}`, in name order. */
  publicReads() {
    return [...this.#publicReads.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, r]) => ({ name, module: r.module, params: [...r.params] }));
  }

  /** R18 (R10's terms): one registered read, served. `query` is the caller's parameters; the read is handed only those
   *  it declared, frozen, and nothing else: no credential and no stamp can be among them. It answers
   *  `{ok: true, read, module, result}` with the read's answer as `result`; a read that refuses (`ok: false`) is
   *  relayed as its own refusal, naming the read. An unregistered name answers `PUBLIC_READ_NOT_REGISTERED` (C-98.10, its row), saying so.
   *  A read that answers a promise is answered as one; one that throws is not caught here, so the store's own internal
   *  error answers it and nothing is dressed as an absence. */
  publicRead(name, query = {}) {
    const n = String(name ?? "");
    const r = this.#publicReads.get(n);
    if (!r) {
      /* DEC-49 REGION is-public-read-not-registered
       * C-98.10 (K1149): the code a STRING LITERAL at its site, its row from this module's table (R17). */
      return { ok: false, reason: "PUBLIC_READ_NOT_REGISTERED", ...rowOf("PUBLIC_READ_NOT_REGISTERED"), name: n,
               detail: localize("public-read.index.no_public_read_named_stringify", "no public read named {stringify} is registered on this team's Civicsmith, so there is nothing to serve under that name", { stringify: String(JSON.stringify(n)) }) };
      /* END DEC-49 REGION is-public-read-not-registered */
    }
    const args = {};
    for (const p of r.params) {
      const v = query && Object.hasOwn(query, p) ? query[p] : undefined;
      if (typeof v === "string") args[p] = v;
    }
    const shape = (v) => (v && typeof v === "object" && v.ok === false
      ? { ...v, ok: false, read: n, module: r.module }
      : { ok: true, read: n, module: r.module, result: v === undefined ? null : v });
    const out = r.read(Object.freeze(args));
    return out && typeof out.then === "function" ? out.then(shape) : shape(out);
  }


  /* ---------------------------------------------------------------- R21: the docket beside a case, served */

  /** R21 (DEC-116 item 8; DEC-100 item 2): a case's docket, `docket.docketPublic` (its R14), served with no credential
   *  (R10): `{...its answer, ok: true, case}`, a promise as the docket's read is. A case the docket answers null for
   *  (absent, or with no ratified edition) is `publishedCase`'s own `NOT_PUBLISHED` answer for an absent case, taken
   *  from `publishedCase` itself, so the two are the same bytes by construction and C-98.8 keeps its one site.
   *  R25 (DEC-101 (3); N534): `captures` exactly `"omit"` is handed on as `captures: "omit"` (`docket` R24: no
   *  capture's bytes read or answered), for a citing copy's daily read; any other value, or none, hands on nothing. */
  async docketPublic(caseId, captures = null) {
    const c = str(caseId);
    const d = c ? await this.docket.docketPublic({ case: c, ...(captures === "omit" ? { captures: "omit" } : {}) }) : null;
    if (d == null) return this.#absentCase();
    return { ...d, ok: true, case: c };
  }

  /** R21 (DEC-116 item 8): a case's Atom feed, `docket.docketFeed` (its R15), one fixed address per case
   *  (`op=docketfeed&case=<case>`): `{ok: true, case, media_type, feed}`, the door serving `feed` as the response's
   *  bytes under `media_type`; a promise, as the docket's read is. Null from the docket is `NOT_PUBLISHED`, as
   *  `docketPublic`. */
  async docketFeed(caseId) {
    const c = str(caseId);
    const feed = c ? await this.docket.docketFeed({ case: c }) : null;
    if (feed == null) return this.#absentCase();
    return { ok: true, case: c, media_type: DOCKET_FEED_MEDIA_TYPE, feed: String(feed) };
  }

  /* R21: `publishedCase`'s answer for an absent case. Asked with no route, it resolves nothing, whatever the record
     holds, and so answers its `NOT_PUBLISHED` (C-98.8) from its one governed site. */
  #absentCase() { return this.publishedCase({}); }

  /* R41 (3): how the page names a member. A value that is a member's id (bare, or as `member:<id>`) is her handle, the
     founder with none held the design's word `member.founder.unnamed` and a member with none `shell.card.member`, as the
     team's own screens name her (`interface-shell` R111), never her id. A value that is no member's id (an undetermined
     deliverer, a review grant's id) stays as it is; a roster that cannot be read names her by the plain word, so no id
     is left on the page. */
  #handleOf(value, cache) {
    if (typeof value !== "string" || !value) return value;
    if (cache.has(value)) return cache.get(value);
    const id = value.startsWith("member:") ? value.slice("member:".length) : value;
    let named = value;
    try {
      const m = this.#members();
      if (!m || typeof m.memberFacts !== "function") throw new Error("no roster");
      const facts = m.memberFacts(id);
      if (facts) named = typeof facts.handle === "string" && facts.handle ? facts.handle
        : word(id === "admin" ? "member.founder.unnamed" : "shell.card.member");
    } catch { named = word("shell.card.member"); }
    cache.set(value, named);
    return named;
  }

  /* R41 (3): a stamp (an object) with the members it names under `keys` named by handle, every other field as it is. */
  #stampedByHandle(s, keys, cache) {
    return s && typeof s === "object" && !Array.isArray(s)
      ? { ...s, ...Object.fromEntries(keys.filter((k) => Object.hasOwn(s, k)).map((k) => [k, this.#handleOf(s[k], cache)])) } : s;
  }

  /* R41 (3): a completeness block with its writer, publisher and the members who read the statement named by handle. */
  #completenessByHandle(c, cache) {
    if (!c || typeof c !== "object" || Array.isArray(c)) return c;
    return { ...this.#stampedByHandle(c, ["author", "statement_by"], cache),
      ...(Array.isArray(c.acknowledgements)
        ? { acknowledgements: c.acknowledgements.map((x) => (x && x.kind === "recipient" ? x : this.#stampedByHandle(x, ["by"], cache))) } : {}) };
  }

  /* R41 (3): `publishedCase`'s answer with each member it names, by handle: the case's writer and publisher and those who
     read the statement (`completeness`), each finding's attestor and who delivered it, the case document's signer and
     its deliverer, and who acknowledged each disclosed contradiction. The signed bytes (`document.text`), the manifest and
     the blocks read from them are answered as signed. The same people are named as before and no others. */
  #byHandle(a) {
    const cache = new Map();
    const stamp = (s, keys) => this.#stampedByHandle(s, keys, cache);
    return { ...a,
      completeness: this.#completenessByHandle(a.completeness, cache),
      findings: a.findings.map((f) => ({ ...f, attestor: stamp(f.attestor, ["member"]), delivered_by: stamp(f.delivered_by, ["member"]) })),
      document: a.document && typeof a.document === "object" && !a.document.withheld
        ? { ...a.document, attestor: stamp(a.document.attestor, ["member"]), delivered_by: stamp(a.document.delivered_by, ["member"]) }
        : a.document,
      tensions: Array.isArray(a.tensions) ? a.tensions.map((t) => stamp(t, ["acknowledged_by"])) : a.tensions };
  }

  /* R20 (DEC-116 item 7): the stamp of the docket withdrawal naming one edition of a case, or null when none names it
     (and for anything that is not a case). Read from `docket.withdrawalOf` (its R12), never composed: its `seq`, `date`
     and `reason` as the docket answers them, and `entry`, the link to the withdrawal entry: its `seq`, the docket's id
     for it (`<case>#<seq>`), its digest and the fixed address the docket is served at (R21). */
  #withdrawnStamp(theCase, edition) {
    if (!theCase || edition == null) return null;
    const w = this.docket.withdrawalOf({ case: theCase, edition: Number(edition) });
    if (!w) return null;
    return { seq: w.seq, date: w.date, reason: w.reason,
             entry: { seq: w.seq, id: w.entry ?? null, digest: w.digest ?? null, docket: docketAddress(theCase) } };
  }

  /** 8.2: published-record reconstruction, requiring NOTHING.
   *
   *  Published material is content-addressed and its hashes are public, so any
   *  member or any stranger can rebuild and independently verify the published
   *  record without the cooperation, permission, or continued existence of the
   *  instance it came from. Nothing can be withheld here by construction.
   *
   *  READS THE PUBLISHED PROJECTION ONLY. That is the entire safety of an open
   *  endpoint: working material is never consulted, so there is nothing to leak,
   *  exactly as op=verify already works. */
  publishedManifest() {
    const byCase = this.#frozenPairsByCase();
    /* R28: what the court orders in force withhold, stated on the rows below (`withheldRow`, `withheldCase`). */
    const index = this.#withheldIndex();
    return { ok: true, scope: "published",
      /* REC-49, and it is CONDUCT's determination enacted rather than a
         convenience: EVERY RATIFIED FINDING CARRIES ITS OWN FROZEN PAIR HERE,
         inside the awaiting window as much as outside it.
         `published_bundles.strength` is the member's OWN signed, ratified pair —
         the same bytes op=publishedcase publishes for that finding and the same
         value the container manifest copies at assembly — so stating it composes
         nothing and makes no new claim. REC-44 already ruled that the findings
         which ratified are published and answerable NOW; an index that withheld
         their pairs until the LAST member landed would understate, for days,
         what the record actually holds.
         WHY IT MATTERS THAT IT IS HERE AND NOT ONLY IN `cases[].manifest`: the
         container's manifest does not exist until the edition completes, so a
         reader of an incomplete case would see nothing at all. A record that
         understates what it holds is still a record that does not say what is
         true, and understatement reads as modesty, which is why nobody
         questions it.
         AND THE ALTITUDE IS THE WHOLE POINT (DEC-44): the pair belongs to a
         FINDING and there is no such thing as a case-level pair. These fields
         sit on the finding rows and must NEVER appear on `cases[]`. */
      published: this.#rows(
        `SELECT p.bundle_id, p.edition, p.title, p.bundle_sha, p.ratified_at, p.attestor_key,
                p.gate_version, p.strength, p.required
         FROM published_bundles p ORDER BY p.bundle_id, p.edition`)
        .map((r) => {
          const row = { ...r,
            strength: r.strength ? JSON.parse(r.strength) : null,
            required: r.required ? JSON.parse(r.required) : null };
          /* ===== REC-170 / BIO_Publication_v0_1.md §3 rule 12 (b)–(d), with IC-74: WHERE THE
             RATIFIED CASE DOCUMENTS PINNING THESE BYTES STATE DIFFERENT FROZEN PAIRS, THE ROW
             SERVES EVERY CASE'S PAIR, EACH NAMED BY ITS CASE, AND NO SCALAR. ======================
             `published_bundles.strength` is written ONCE, at the member's FIRST ratification
             (`ON CONFLICT … DO NOTHING`), so on b5ce975a this row told a stranger one of two false
             things: a BARE NULL where the documents already disagreed at that ratification (the
             committer's `strengthUndetermined`, which reached op=ratify's answer and nothing
             else), or — measured by rec170-manifest-pair.test.mjs (since retired), and worse — THE FIRST CASE'S
             PAIR where a later case froze another, one case's reading served as THE pair (IC-74:
             a finding in several cases answers every case, never one). Rule 12 (b) makes the pair
             a fact about ONE case's reading of the finding at that sha, so where two readings
             differ the scalar is null and SAYS why (`strengthUndetermined`, a reason code, the
             `production` sentence's rule that a null is never left to be read), and
             `strengthByCase` carries each ratified case edition's own pair as its document states
             it — the same `caseDocMemberFrozen` read op=publishedcase serves.
             WHERE THE DOCUMENTS AGREE, OR ONE CASE PINS THE FINDING, NOTHING HERE RUNS and the row
             is byte-identical to what it was: an added key on an agreeing row would be a flag
             that is not true. */
          const pinned = byCase.get(`${r.bundle_id}\u0000${r.bundle_sha}`);
          const held = withheldRow(row, index.bySha.get(r.bundle_sha));
          if (!pinned || new Set(pinned.map((p) => JSON.stringify(p.strength))).size < 2) return held;
          return { ...held, strength: null, strengthUndetermined: "CASES_DISAGREE", strengthByCase: pinned };
        }),
      /* REC-44: the CASES, beside the findings rather than instead of them. The
         findings are what carry a signature and a frozen pair; the case is what
         carries the container's manifest, its own hash and the scope. A
         reconstruction needs both, and conflating them is what D-187 records. */
      cases: this.#rows(
        /* REC-47: the acknowledgement is on the PUBLIC index too, and that is
           the point of it — a reader reconstructing the record from this op
           alone must be able to see the bias each case edition was produced
           under without asking us for it. */
        /* CASE-1 / DEC-72: and WHOSE PRODUCTION the case is, on the public index,
           for the same reason the acknowledgement is on it — a reader
           reconstructing the record from this op alone must be able to see which
           project published a case, because under DEC-72 the bar the case was
           held to is THAT PROJECT'S and no other. A LEFT JOIN rather than an
           inner one, and that is the load-bearing half: a case published before
           this model has no `cases` row, and it must still appear here with its
           project stated as unknown rather than disappearing from the index
           because the record gained a table. */
        /* CASE-5 / DEC-72 clause 2: AND THE BAR, on the reconstruction index, for
           the reason the acknowledgement and the project are already on it — a
           reader rebuilding the published record from this op ALONE must be able
           to say what standard each case edition was held to, and until this
           item the only route was one member's stamped `required` block, which is
           one member's copy of a case property. `production` below states what a
           null means so a bare null cannot read as a bar of zero. */
        `SELECT c.case_id, c.edition, c.scope, c.bias_acknowledgement, c.bar, c.ratified_at,
                c.manifest_sha, c.manifest, k.project_id
         FROM published_cases c LEFT JOIN cases k ON k.case_id = c.case_id
         ORDER BY c.case_id, c.edition`)
        .map((c) => withheldCase({ ...c, bar: c.bar ? safeJson(c.bar) : null }, index, ["manifest"])),
      /* CASE-1 / DEC-72: the member's PINNED VERSION and its AUTHORED ROLE travel
         with the roster row, because they are what the roster row now IS —
         (finding id, version hash, role, ordinal). Both are null until CASE-2
         authors a role and CASE-3 pins a version, and `production` below states
         that in words rather than leaving a reader to read a bare null. */
      caseMembers: this.#rows(
        `SELECT case_id, edition, ord, bundle_id, version_sha, role FROM published_case_members
         ORDER BY case_id, edition, ord`),
      /* CASE-1 / DEC-72, and it exists because "undetermined is first-class and
         must be STATED" is not satisfied by a null. Three different facts arrive
         here as null and a reader cannot tell them apart without this sentence:
         a case nobody published as a project's production, a member nobody
         designated, and a member whose version nobody pinned. */
      /* CASE-5 / DEC-72: the fourth null, and the ONE instruction a
         reconstructor cannot do without. `caseMembers[].edition` is the
         CASE's and `published[].edition` is the FINDING's, and they are
         no longer the same number — so the join between the two tables
         is `version_sha` to `bundle_sha` and NEVER edition to edition.
         Said here rather than left to be inferred because a join on the
         old equality does not error: it silently drops exactly the
         members the pin exists for, which is the defect IC-66 measures
         in this record's own UI. */
      production: localize("public-read.index.a_case_is_a_production", "DEC-72: a case is a PRODUCTION OF A PROJECT, and the standard of evidence it was held to is that project's, told to the publishing act at the time it was made. Where `project_id` is null NO PROJECT IS RECORDED as this case's publisher — the case was published before this model, and an absent owner is not a claim that it had none, it is this record saying it does not know. Where a member's `role` is null NOBODY DESIGNATED that member load-bearing or supporting, so nothing here says whether the case rests on it: a designation is authored by the publisher and is never derived, so the record will not supply one it was not given. Where `version_sha` is null the member was rostered without a version being pinned, and the finding it names may have moved since. None of the three is a gap in this answer; each is a state of the record. Where a case edition's `bar` is null NO STANDARD OF EVIDENCE IS RECORDED for it, and that is NOT a bar of zero: the edition predates the case carrying its own bar, or none was ever declared, and a case that cleared no declared standard says so. AND THE JOIN BETWEEN `caseMembers` AND `published` IS `version_sha` TO `bundle_sha`, NEVER EDITION TO EDITION: `caseMembers.edition` is the CASE's edition and `published.edition` is the FINDING's own, and since the artifact flip a member of a case's edition 2 may be at its own edition 1. A join on the two numbers does not fail — it silently drops the members the pin exists to name."),
      /* R23 (T38): the original of a material carried as its copy is not listed, as it is not served (`verifySha`). */
      shas: ((rows, originals) => rows.filter((r) => !originals.has(r.sha256)))(
        this.#rows(`SELECT sha256, bundle_id, path, kind, bytes, published FROM published_shas ORDER BY published`),
        this.#copiedOriginals([{ kind: "archive" }])),
      /* REC-170: the one null on a finding row that is not "nothing was signed". */
      altitudes: localize("public-read.index.a_frozen_strength_pair", "a frozen strength pair belongs to a FINDING and travels on that finding's row here. A CASE has a scope, a completeness assertion, a bias acknowledgement, editions and a container; it has no strength, and composing its members' pairs into one letter would be a claim the evidence does not support. A member named in caseMembers with no row in published[] is DECLARED AND NOT YET RATIFIED: it has no pair because nothing has been signed for it, which is a state of the record and not a gap in this answer. Since the frozen pair is stated in each CASE's document (a case's reading of the finding at that hash), a finding several cases pin may carry several pairs: where their documents disagree, `strength` is null, `strengthUndetermined` says CASES_DISAGREE, and `strengthByCase` lists every ratified case edition's own pair, named by its case and edition. None of them is the finding's pair; each is that case's."),
      detail: localize("public-read.index.every_hash_here_is_verifiable", "every hash here is verifiable by anyone with ssh-keygen and the doorbell, without the cooperation or continued existence of this team's Civicsmith. Nothing unpublished appears, by construction: this reads the published projection and never the working corpus.") };
  }

  /* REC-170 / BIO_Publication_v0_1.md §3 rule 12 (b): EVERY RATIFIED CASE EDITION'S OWN FROZEN PAIR
     FOR EVERY PINNED SHA, keyed `bundle_id NUL bundle_sha`, for `publishedManifest`. One set-based read
     of the pins, then `caseDocMemberFrozen` (the one parser of the per-case facts) once per case edition
     that pins a sha SEVERAL editions pin — a sha pinned by one edition has nothing to disagree with, so
     its document is never opened here. EVERY ratified edition counts, not only a case's latest: each is
     a separate signed document that stated its own reading of those bytes. A LEGACY (/1) document states
     no pair of its own (its members carried theirs, rule 12 (e)) and is left out rather than read as an
     empty pair — which is also where this reader is blind: a /1 reading does not join the comparison. */
  #frozenPairsByCase() {
    const pins = this.#rows(
      `SELECT m.case_id, m.edition, m.bundle_id, m.version_sha FROM published_case_members m
         JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
        WHERE m.version_sha IS NOT NULL
        ORDER BY m.bundle_id, m.version_sha, m.case_id, m.edition`);
    const groups = new Map();
    for (const p of pins) {
      const k = `${p.bundle_id}\u0000${p.version_sha}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const docs = new Map();
    const out = new Map();
    for (const [k, ps] of groups) {
      if (ps.length < 2) continue;
      const stated = [];
      for (const p of ps) {
        const dk = `${p.case_id}\u0000${Number(p.edition)}`;
        if (!docs.has(dk)) docs.set(dk, this.publication.caseDocMemberFrozen(p.case_id, Number(p.edition)));
        const row = docs.get(dk) ? docs.get(dk).get(p.bundle_id) : null;
        if (row && row.version_sha === p.version_sha)
          stated.push({ case_id: p.case_id, edition: Number(p.edition), strength: row.strength });
      }
      out.set(k, stated);
    }
    return out;
  }


  /* 7a: answers ONLY from the published projection. Working material is not
     consulted, so there is nothing to leak: a hash that was never ratified
     is indistinguishable from a hash that never existed. */
  verifySha(sha) {
    sha = lowerSha(sha);
    const matches = this.#rows(
      `SELECT bundle_id, path, kind, published FROM published_shas WHERE sha256=? ORDER BY published`, sha);
    /* R23 (T38): the original of a material carried as its copy answers as a hash never published, whatever registered it (R3's NO_PUBLISHED_PART
       at `publishedbytes`, which asks here first). */
    if (matches.length && this.#copiedOriginals(matches).has(String(sha).toLowerCase()))
      return { published: false, sha256: sha, matches: [] };
    return { published: matches.length > 0, sha256: sha, matches };
  }

  /* R23 (T38; N779, K2248; R3): WHAT NO ROUTE OF THIS MODULE SERVES, because it is the original of a material
     carried as its copy (a photo, or from T39 a member document, N806): each `sha` and
     `text_sha` that a published case edition's signed `materials:` row states with `obscured` (`case-grammar` R12, the
     original's fingerprints), whatever registered those bytes (another row at the same digest, an earlier edition, another
     case), and, when `matches` (the published projection's rows for what is asked, or every row) include an archive, each
     archive the projection shows holding one of them, outward. A signed document never changes, so each edition's
     document is read once per instance. */
  #copiedOriginals(matches = []) {
    for (const e of this.#rows(`SELECT case_id, edition FROM published_cases`)) {
      const k = `${e.case_id}\u0000${Number(e.edition)}`;
      if (this.#originalsByEdition.has(k)) continue;
      const state = this.publication.caseEditionState(e.case_id, Number(e.edition));
      const doc = state ? signedParts(state.document) : null;
      if (!doc) continue;
      const rows = (materialsOf(doc.fm) || {}).materials;
      this.#originalsByEdition.set(k, (Array.isArray(rows) ? rows : []).filter((r) => r && r.obscured != null)
        .flatMap((r) => [r.sha, r.text_sha]).map((s) => String(s ?? "").toLowerCase()).filter((s) => HEX64.test(s)));
    }
    const originals = new Set([...this.#originalsByEdition.values()].flat());
    if (!originals.size || !matches.some((m) => m && m.kind === "archive")) return originals;
    const records = new Map();
    for (const r of this.#rows(`SELECT DISTINCT sha256 FROM published_shas WHERE kind='container'`)) {
      const c = safeJson(heldText(this.publication.publishedMaterialText(r.sha256)));
      const member = c && typeof c.member_sha256 === "string" ? c.member_sha256.toLowerCase() : null;
      const archive = c && typeof c.archive_sha256 === "string" ? c.archive_sha256.toLowerCase() : null;
      if (member && HEX64.test(archive ?? "") && !records.has(member)) records.set(member, { archive });
    }
    for (const a of this.#archivesHolding(originals, { records })) originals.add(a);
    return originals;
  }

  /* REC-14 / DEC-12: the public index ENUMERATES EDITIONS rather than one row
     per bundle, because an edition is a separate document and edition 1 keeps
     answering after edition 2 lands. `title` is here — the one deliberate
     divergence from DATA-MODEL 2.4.4 — so a public index is not N+1 reads of
     the bytes to learn what each case is called. */
  publishedList() {
    const index = this.#withheldIndex(), handles = new Map(); // R41 (3): members named by handle
    return { bundles: this.#rows(
      `SELECT bundle_id, edition, title, bundle_sha, ratified_at, attestor_member, delivered_by, gate_version
       FROM published_bundles ORDER BY bundle_id, edition`)
      /* REC-44: each published FINDING names the case it was published in, so a
         public index can be read as the cases it actually is. The finding rows
         stay the rows — a finding is what carries a signature and a frozen pair
         — and the case is stated beside them rather than replacing them.
         CASE-5: resolved BY THE HASH, and `case_edition` is stated beside the
         case id because it is no longer derivable from `edition` on this row —
         that number is the FINDING's. A consumer joining a member to its case on
         the equality of the two numbers is the defect IC-66 measures in the UI. */
      /* D-309 / DEC-72 clause 6: THIS CALLER WANTS **ALL** OF THEM. A public
         index whose purpose is *"so a public index can be read as the cases it
         actually is"* cannot name one case for a finding that serves two — it
         would be telling a reader the record holds less than it does, on the one
         surface a stranger browses. `cases` is the answer; the scalar pair is
         kept and is the SOLE membership or null (`soleCase`), so a consumer
         still reading it receives null rather than a guess. */
      .map((r) => {
        const cms = this.#casesOfSha(r.bundle_id, r.bundle_sha, r.edition);
        const sole = this.publication.soleCase(cms);
        return withheldRow({ ...r, attestor_member: this.#handleOf(r.attestor_member, handles),
                 delivered_by: this.#stampedByHandle(this.#deliveredBy(r), ["member"], handles),
                 case_id: sole ? sole.case_id : null, case_edition: sole ? sole.edition : null,
                 cases: cms }, index.bySha.get(r.bundle_sha));
      }),
      cases: this.#rows(
      /* R29 (DEC-147 (5); `publication` R70, K1826): each case edition's `signed_at` and `published_at`, as publication
         holds them on the row, read in this one query. */
      `SELECT case_id, edition, scope, ratified_at, signed_at, published_at, manifest_sha FROM published_cases
       ORDER BY case_id, edition`)
      .map((c) => withheldCase({ ...c, findings: this.#rows(
        `SELECT bundle_id FROM published_case_members WHERE case_id=? AND edition=? ORDER BY ord`,
        c.case_id, c.edition).map((m) => m.bundle_id) }, index, [])) };
  }

  /* One case, every edition it has ever had, each with its OWN signature,
     attestor, time and gate version, and with the frozen assertion and the
     frozen PAIR the group signed. This is what makes "edition 1 still answers"
     checkable rather than merely stated. */
  publishedEditions(bundleId) {
    if (!bundleId) return { ok: false, reason: "NO_ID", detail: "publishededitions requires ?id=" };
    const rows = this.#rows(
      `SELECT bundle_id, edition, title, bundle_sha, ratified_at, attestor_key, attestor_member,
              delivered_by, gate_version, sig_armored, strength, required
       FROM published_bundles WHERE bundle_id=? ORDER BY edition`, bundleId);
    const index = this.#withheldIndex(), handles = new Map(); // R41 (3): members named by handle
    /* REC-44: `completeness` is no longer here and that is the correction — it
       is a CASE assertion, so it is fetched from the case each edition belongs
       to rather than repeated on every member finding of it. */
    return { ok: true, bundleId, editions: rows.map((r) => {
      /* CASE-5: BY THE HASH, and the case's edition comes back WITH the case id
         rather than being taken from `r.edition`. This read is the clearest
         instance of the conflation in the file: it resolved the case at the
         FINDING's edition and then fetched `published_cases` at that same
         number, so a finding at its own edition 1 inside a case at edition 3 was
         answered with edition 1's scope, completeness and bias acknowledgement —
         a case assertion attributed to the wrong edition of the right case. */
      /* D-309: **ALL** OF THEM, and the case-level fields below stay tied to the
         SOLE membership. The scope, completeness assertion, bias acknowledgement
         and bar on this row are ONE CASE EDITION'S claims; a finding serving two
         cases has two of each, and flattening them onto one row is the exact
         defect this read's own comment records one paragraph up — *"a case
         assertion attributed to the wrong edition of the right case"*, which
         becomes "attributed to the wrong CASE" the moment clause 6 is live. So
         when the membership is set-valued those fields go NULL and `cases` names
         where to ask; when it is a single case they are unchanged. */
      const cms = this.#casesOfSha(r.bundle_id, r.bundle_sha, r.edition);
      const cm = this.publication.soleCase(cms);
      const cid = cm ? cm.case_id : null;
      const c = cm ? this.#one(
        `SELECT scope, completeness, bias_acknowledgement, bar, manifest_sha, signed_at, published_at
         FROM published_cases WHERE case_id=? AND edition=?`,
        cm.case_id, cm.edition) : null;
      /* R28: an edition an order withholds whole states no case content here; a finding whose bytes are withheld
         states no title. */
      const caseWhole = !!(cm && (index.editions.get(`${cm.case_id}\u0000${Number(cm.edition)}`) || {}).whole);
      return withheldRow({ ...r, attestor_member: this.#handleOf(r.attestor_member, handles),
               delivered_by: this.#stampedByHandle(this.#deliveredBy(r), ["member"], handles),
               case_id: cid, case_edition: cm ? cm.edition : null, cases: cms,
               bar: c && c.bar ? safeJson(c.bar) : null,
               /* The container's manifest is the CASE edition's, so it is
                  reported from there — one manifest per case per edition,
                  naming every member finding's parts. */
               manifest_sha: c ? (c.manifest_sha ?? null) : null,
               /* R29: when the sole case edition was signed and when it was published (`publication` R70); null where
                  the finding serves several cases, as the case fields above; a finding in no case is unchanged. */
               ...(cms.length ? { signed_at: c ? (c.signed_at ?? null) : null, published_at: c ? (c.published_at ?? null) : null }
                              : {}),
               scope: c && !caseWhole ? (c.scope ?? null) : null,
               bias_acknowledgement: c && !caseWhole ? (c.bias_acknowledgement ?? null) : null,
               completeness: c && c.completeness && !caseWhole ? this.#completenessByHandle(JSON.parse(c.completeness), handles) : null,
               ...(caseWhole ? { case_withheld: { orders: index.editions.get(`${cm.case_id}\u0000${Number(cm.edition)}`).orders,
                                                  detail: WITHHELD_SENTENCE } } : {}),
               strength: r.strength ? JSON.parse(r.strength) : null,
               required: r.required ? JSON.parse(r.required) : null }, index.bySha.get(r.bundle_sha));
    }) };
  }

  /** R42 (fix round 4, C48/N6; RC-R10): the one builder of a published case's public address, `/app/published/<case>/<edition>`
   *  written as the shell's route opens it (the subject one encoded part, as the screens' own links write it). `null` for a case
   *  or an edition that holds no row in the published projection (an edition prepared or signed and not published is none), and
   *  for a case or edition not named. Reads the projection only (R10). */
  publishedAddress({ case: caseId = null, edition = null } = {}) {
    const id = typeof caseId === "string" ? caseId.trim() : "";
    const n = typeof edition === "number" || (typeof edition === "string" && /^\d+$/.test(edition.trim())) ? Number(edition) : NaN;
    if (!id || !Number.isInteger(n) || n < 1) return null;
    if (!this.#one(`SELECT case_id FROM published_cases WHERE case_id=? AND edition=? LIMIT 1`, id, n)) return null;
    return "/app/published/" + encodeURIComponent(`${id}/${n}`);
  }

  /** R38 (T51-75; DEC-330 A37): what each published case froze for one question. `id` is the question's record id, the
   *  `bundle_id` of the finding published from it. One entry for every published case edition whose roster pins a
   *  published edition of that finding, in `case_id` then case `edition` order (an edition waiting to be published has
   *  no row in the published projection and is not listed, R29): the case, its `project`, `signed_at` and `published_at`
   *  (R29) and `withdrawn` (R20); `finding`, the published finding edition the pin names (the member's own edition, never
   *  the case's), `version_sha` (what the case pinned) and `pinned` (true when they are the same bytes, false when not,
   *  null when the case pinned none: never true by default, R13); `strength`, that case's frozen pair read from the
   *  signed case document where it states one (else the member's own, `strength_from`), `{capture, connection}` and
   *  `testimony` where the pair carries one, each axis as `publication` R53 gives it, never combined across cases (R11);
   *  `signed_by` (the case document's signer) and `delivered_by` beside it (R12) and `finding_signed_by`. An edition a
   *  court order withholds whole, or whose case document one withholds, states `withheld` and no pair or signer (R28).
   *  A finding in no case answers `cases: []`; no id is `NO_ID`; an id nothing published answers is `publishedCase`'s
   *  `NOT_PUBLISHED` for an absent case, byte for byte (R14). One set-based read of the pins and one `caseEditionState` per
   *  case edition; no finding's bytes are fetched. Reads the published projection only (R10, R16), writes nothing and
   *  never throws on what it reads. */
  publishedFrozen({ id = null } = {}) {
    const want = str(id);
    if (!want) return { ok: false, reason: "NO_ID", detail: "publishedfrozen requires ?id=" };
    if (!this.#one(`SELECT 1 AS x FROM published_bundles WHERE bundle_id=? LIMIT 1`, want)) return this.#absentCase();
    const index = this.#withheldIndex();
    const pins = this.#rows(
      `SELECT m.case_id, m.edition, m.version_sha FROM published_case_members m
         JOIN published_cases c ON c.case_id=m.case_id AND c.edition=m.edition
        WHERE m.bundle_id=? ORDER BY m.case_id, m.edition`, want);
    const cases = [], handles = new Map();
    for (const pin of pins) {
      const ced = Number(pin.edition);
      const state = this.publication.caseEditionState(pin.case_id, ced);
      if (!state) continue;
      const held = (state.findings || []).find((f) => f.bundle_id === want) || null;
      /* The finding edition the pin names. A pin that names nothing published leaves the member awaiting; the edition the
         signed case document states for it (`case_roles[].edition`), when that edition is published at other bytes, is
         the finding whose bytes the pin does not match (`pinned: false`); a pin and a document naming nothing published
         pin no published edition of this finding, and the case is not listed. */
      const stated = held ? null : (this.publication.caseDocMemberFrozen(pin.case_id, ced) || new Map()).get(want) || null;
      const row = held ? null : Number.isInteger(stated && stated.edition)
        ? this.#one(`SELECT edition, bundle_sha, attestor_key, attestor_member, strength FROM published_bundles
                      WHERE bundle_id=? AND edition=?`, want, stated.edition) : null;
      if (!held && !row) continue;
      const finding = held
        ? { edition: Number(held.edition), bundle_sha: held.bundle_sha }
        : { edition: Number(row.edition), bundle_sha: row.bundle_sha };
      const pair = held ? held.strength : stated.strength;
      const from = held ? held.frozen_from : "case_document";
      const attestor = held ? held.attestor : { member: row.attestor_member, key_b64: row.attestor_key };
      const version = pin.version_sha ?? null;
      const dates = this.#one(`SELECT signed_at, published_at FROM published_cases WHERE case_id=? AND edition=?`,
                              pin.case_id, ced);
      const mine = index.editions.get(`${pin.case_id}\u0000${ced}`);
      const docBy = state.document ? index.bySha.get(state.document.doc_sha) : null;
      const withheld = (mine && mine.whole) || docBy
        ? { whole: !!(mine && mine.whole), document: true, orders: mine && mine.whole ? mine.orders : docBy,
            detail: WITHHELD_SENTENCE } : null;
      const rows = Array.isArray(pair) ? pair.filter((a) => a && typeof a.axis === "string") : [];
      const strength = withheld || !rows.length ? null
        : { capture: rows.find((a) => a.axis === "capture") ?? null, connection: rows.find((a) => a.axis === "connection") ?? null,
            ...(rows.some((a) => a.axis === "testimony") ? { testimony: rows.find((a) => a.axis === "testimony") } : {}) };
      /* R41 (3), as `publishedCase` names a member: by her handle, never her id (the page that draws the question names its
         signers from here). */
      const signer = (a) => (a && (a.member != null || a.key_b64 != null)
        ? this.#stampedByHandle({ member: a.member ?? null, key_b64: a.key_b64 ?? null }, ["member"], handles) : null);
      const signedBy = withheld || !state.document ? null : signer(state.document.attestor);
      const findingBy = signer(attestor);
      cases.push({
        case_id: pin.case_id, edition: ced, project: state.project ?? null,
        signed_at: dates ? dates.signed_at ?? null : null, published_at: dates ? dates.published_at ?? null : null,
        withdrawn: this.#withdrawnStamp(pin.case_id, ced),
        finding, version_sha: version, pinned: version === null ? null : version === finding.bundle_sha,
        strength, strength_from: strength ? from : null,
        ...(!withheld && !rows.length ? { strength_detail: word("public-read.frozen.strength_detail.none") } : {}),
        signed_by: signedBy,
        delivered_by: withheld || !state.document ? null : this.#stampedByHandle(state.document.delivered_by ?? null, ["member"], handles),
        finding_signed_by: findingBy,
        ...(!withheld && (!signedBy || !findingBy)
          ? { signer_detail: word("public-read.frozen.signer_detail.unstated") } : {}),
        withheld });
    }
    return { ok: true, id: want, cases,
             detail: cases.length
               ? word("public-read.frozen.detail.cases")
               : word("public-read.frozen.detail.none") };
  }

  /* REC-22: ONE PUBLISHED EDITION, everything the public read path can say about
     it from the store side. Reads published_bundles and published_edges and
     NOTHING else -- it never joins the working corpus, never reports a working
     state, and carries no title but the one frozen into the edition -- which is
     the whole of why this answers without a credential of any kind (REC-30's
     classification, and this module's R10 states exactly that property).

     RESOLUTION, three ways and one rule (DEC-12): a bundle id alone answers with
     the LATEST edition; an id and an edition answer with that edition; a
     bundle_sha answers with THE EDITION THOSE BYTES ARE -- a hash resolves to
     its own edition and never to the current one, which is what makes "edition 1
     still answers after edition 2 lands" true rather than merely stated.

     A NOT_PUBLISHED answer is IDENTICAL for a bundle that was never published,
     an edition that does not exist and an id that never existed, and it is
     identical by construction rather than by care: there is no other table in
     this method to tell them apart with. */
  /* REC-44 / DEC-44: RESOLUTION NOW HAS A FOURTH ROUTE and the surface answers
     with a CASE. `id` may be the CASE identity or the bundle id of any member
     FINDING — a stranger who was handed one finding's id must be able to reach
     the case it was published in, since that case is the artifact the group put
     its name on. A finding id is answered WITH the case and `asked` names which
     finding was reached for, so the surface resolves without deciding on the
     reader's behalf what they meant.

     AND THERE IS NO `strength` AT THIS LEVEL. Every member finding carries its
     own frozen pair inside findings[]; a case-level letter would be R2's
     forbidden composition arriving at case altitude, and its ABSENCE from this
     answer is asserted by `published.test.mjs`' R3 and R11 arms rather than
     left to review. */
  publishedCase({ id = null, edition = null, sha256 = null, caseId = null } = {}) {
    let theCase = caseId ? String(caseId).trim() : null, ed = null, asked = null;
    /* CASE-5: the FINDING's own edition, kept apart from `ed` (the CASE's) from
       here on. The two used to be one variable on this method as well, and the
       loose-bundle fallback below reads `published_bundles` — which is keyed on
       the finding's number and would have been handed the case's. */
    let askedEdition = null;
    sha256 = lowerSha(sha256);
    if (sha256) {
      const r = this.#one(`SELECT bundle_id, edition FROM published_bundles WHERE bundle_sha=? ORDER BY edition LIMIT 1`,
                          sha256);
      /* CASE-5 / DEC-72: THE STRANGER'S OWN ROUTE, and the conflation was at its
         worst here. A caller who holds a hash and nothing else — the caller the
         whole published projection exists for — was answered by taking the
         FINDING's edition off its published row and asking for the CASE at that
         number. While the two agreed it worked; after the flip it would fetch a
         different edition of the right case, or none, and hand a stranger one
         edition's scope and completeness assertion over another edition's
         findings. Resolved by the hash the case actually pinned. */
      if (r) {
        asked = r.bundle_id;
        askedEdition = Number(r.edition);
        const cms = this.#casesOfSha(r.bundle_id, sha256, askedEdition);
        /* D-309: THIS CALLER MUST SERVE **ONE** CASE AND SO IT REFUSES RATHER
           THAN PICKS — and that is this method's own stated doctrine rather than
           a new rule. Its header already says a finding id is answered WITH the
           case *"so the surface resolves without deciding on the reader's behalf
           what they meant."* A hash that two cases froze has two honest answers;
           serving the newest would attribute one finding's support to a case the
           reader never asked about, on the surface a stranger uses to check a
           claim. Named, with both candidates, so the reader picks. */
        const got = this.#resolveOneCase(r.bundle_id, cms, caseId);
        if (!got.ok) return got;
        if (got.pick) { theCase = got.pick.case_id; ed = got.pick.edition; }
      }
    } else if (id) {
      const want = edition != null && Number.isInteger(Number(edition)) ? Number(edition) : null;
      if (this.#one(`SELECT case_id FROM published_cases WHERE case_id=? LIMIT 1`, id)) {
        theCase = id;
      } else {
        /* D-309: SITES 3 AND 4 OF CASE-6's NINE — the two spellings of
           `publishedCase()`'s finding-id resolution. SAME DECISION AS THE HASH
           ROUTE ABOVE AND FOR THE SAME REASON: a stranger handed one finding id
           that serves two cases is told BOTH and picks, because this surface
           exists to resolve without choosing for them. Note the edition here is
           the CASE's, so `AND edition=?` can match two different cases that each
           have an edition N — which is exactly the shape the old scalar would
           have resolved by whichever row SQLite handed back first. */
        /* THE TERNARY IS OUTSIDE THE CALL, not inside its argument list, and that
           is this item's own census correcting this item's own code. Written as
           `this.#rows(want != null ? \`…\` : \`…\`)` the receiving call sits behind
           the ternary CONDITION, and the walk `multicase.test.mjs` then ran
           (deleted in T20) — which found a query's kind by looking back from the
           literal to the call — could not see it and reported it UNCLASSIFIED.
           **That was the matcher being right
           rather than blunt**, so the code moved to the spelling every other
           member of the class uses instead of the matcher being widened to
           tolerate one. A census nobody can read the same way twice is not one. */
        const ms = (want != null
          ? this.#rows(`SELECT case_id, edition FROM published_case_members
                         WHERE bundle_id=? AND edition=? ORDER BY case_id`, id, want)
          : this.#rows(`SELECT case_id, edition FROM published_case_members
                         WHERE bundle_id=? ORDER BY case_id, edition`, id))
          .map((r) => ({ case_id: r.case_id, edition: Number(r.edition) }));
        const got = this.#resolveOneCase(id, ms, caseId);
        if (!got.ok) return got;
        if (got.pick) { theCase = got.pick.case_id; asked = id; }
      }
      if (want != null) ed = want;
    }
    if (theCase && ed == null) {
      const top = this.#one(`SELECT MAX(edition) AS m FROM published_cases WHERE case_id=?`, theCase);
      ed = top && top.m != null ? Number(top.m) : null;
    }
    let state = theCase && ed != null ? this.publication.caseEditionState(theCase, ed) : null;
    /* A RATIFIED BUNDLE THAT IS IN NO CASE still answers here, and it answers
       as what it is: an information bundle (or any non-inquiry) that was
       ratified and is verifiable by hash, carrying NO case identity, NO scope
       and NO completeness assertion, because it is not a case and this surface
       must not manufacture one for it. Before REC-44 it answered as a "case"
       because everything shared one table, which is the conflation D-187
       records. It is stated rather than dropped: the doorbell's promise is that
       ratified bytes answer, and that promise is not about inquiries. */
    if (!state && (asked || sha256 || id)) {
      const who = asked || id;
      /* CASE-5: the FINDING's number, never the case's. `ed` is the case
         edition this method resolved (or the one the caller asked for) and
         `published_bundles` has never been keyed on it. Before the flip the
         substitution was invisible; it is the same class as the two above. */
      const want = askedEdition != null ? askedEdition
                 : (sha256 == null && id != null && edition != null
                    && Number.isInteger(Number(edition)) ? Number(edition) : null);
      const r = sha256
        ? this.#one(`SELECT bundle_id, edition, bundle_sha FROM published_bundles WHERE bundle_sha=? ORDER BY edition LIMIT 1`, sha256)
        : want != null
          ? this.#one(`SELECT bundle_id, edition, bundle_sha FROM published_bundles WHERE bundle_id=? AND edition=?`, who, want)
          : this.#one(`SELECT bundle_id, edition, bundle_sha FROM published_bundles WHERE bundle_id=? ORDER BY edition DESC LIMIT 1`, who);
      /* D-309: THIS CALLER IS ASKING A DIFFERENT QUESTION AND NOW ASKS IT
         EXPLICITLY — not "which case" but "is this in NO case at all", which over
         a set is `length === 0` and was never really a scalar question. It was
         only ever spelled as one because a truthy scalar and a non-empty set
         happened to coincide while a finding could have at most one case. */
      if (r && this.#casesOfSha(r.bundle_id, r.bundle_sha, r.edition).length === 0) {
        const st = this.#looseEditionState(r.bundle_id, r.edition);
        if (st) { theCase = null; ed = r.edition; state = st; }
      }
    }
    /* D-561 (C-98.8): THE CODE CARRIES ITS CANNED TRANSLATION, from its row in this module's table (R17): the control plane's `json()`
       decorates by code from the catalogue only, and the row moved with this read. */
    if (!state) {
      /* DEC-49 REGION is-not-published */
      return { ok: false, reason: "NOT_PUBLISHED", ...rowOf("NOT_PUBLISHED"),
               detail: localize("public-read.index.no_published_edition_answers", "no published edition answers to that. A case that was never published, an edition that does not exist and an id that never existed are one answer here, because the published projection is the only thing this read can see.") };
      /* END DEC-49 REGION is-not-published */
    }

    /* Every edition of this CASE, so a reader holding an older one learns that a
       newer one exists WITHOUT this surface deciding on their behalf that the
       new one supersedes what they read (DEC-12: the supersession is SURFACED,
       never followed -- REC-17 renders the obligation from exactly this).
       Editions are over the CONTAINER, which DEC-44 makes their natural home. */
    const editions = theCase
      ? this.#rows(`SELECT edition, ratified_at, manifest_sha, signed_at, published_at FROM published_cases
                    WHERE case_id=? ORDER BY edition`, theCase)
      : this.#rows(`SELECT edition, ratified_at FROM published_bundles WHERE bundle_id=? ORDER BY edition`,
                   state.findings[0].bundle_id);

    /* R28 (K1480, K1493; `publication` R62): the court orders in force, read at this call. This edition's own stamps are
       served beside it; bytes any order in force withholds (`#withheldIndex`) are not served, and their withholding is
       stated where they would appear: the signed document (and everything this answer reads from it), each finding's
       bytes, each file of the manifest, the manifest itself. A whole edition withheld answers its identity, its editions
       and its orders, and none of its content. */
    const cRow = theCase
      ? this.#one(`SELECT manifest, signed_at, published_at, casefile_state, casefile_attempts, casefile_attempted_at, casefile_why
                   FROM published_cases WHERE case_id=? AND edition=?`, theCase, ed)
      : null;
    const manifestHeld = cRow && cRow.manifest ? safeJson(cRow.manifest) : null;
    const index = this.#withheldIndex();
    const mine = theCase ? index.editions.get(`${theCase}\u0000${Number(ed)}`) : null;
    const whole = !!(mine && mine.whole);
    const withheldBy = (sha) => (typeof sha === "string" && index.bySha.get(sha)) || null;
    const docWithheld = !!(state.document && (whole || withheldBy(state.document.doc_sha)));
    const manifestWithheld = whole || !!withheldBy(state.manifest_sha);
    const heldDocument = docWithheld ? null : state.document;

    /* The graph, PER FINDING. published_edges is keyed from the finding that
       cited, so a case of two findings has two graphs and they are not merged:
       merging them would attribute one finding's citations to the other, and
       R4's division disclosure is a statement about a particular finding's
       question rather than about the case. */
    const findings = state.findings.map((fnd) => {
      const serves = [], names = [], unresolved = [];
      for (const e of this.#rows(
        `SELECT to_bundle, kind, disclosure FROM published_edges WHERE from_bundle=? ORDER BY kind, to_bundle`,
        fnd.bundle_id)) {
        if (e.disclosure === "name") { names.push({ to: e.to_bundle, kind: e.kind }); continue; }
        const t = this.#one(
          `SELECT edition, title, bundle_sha, ratified_at FROM published_bundles
           WHERE bundle_id=? ORDER BY edition DESC LIMIT 1`, e.to_bundle);
        /* A SERVE edge with nothing published behind it is a CONTRADICTION in the
           index and is REPORTED rather than swallowed. Silently dropping it would
           make the write-time restriction untestable from here — an assertion that
           no served edge names working material would pass on an empty list, which
           is an outcome that costs nothing to produce. It discloses nothing new:
           every row of this table comes from that finding's OWN ratified bundle.md,
           which any caller can fetch by hash, so the id is already public in the
           bytes the group signed. The honest cause is a target published and later
           purged; the dishonest one is the restriction having been broken, and
           `published.test.mjs`' R3 arm on an unresolved edge is exactly that. */
        if (!t) { unresolved.push({ to: e.to_bundle, kind: e.kind }); continue; }
        /* CASE-5: BY THE HASH. `t.edition` is the TARGET FINDING's own edition
           and this line asked `published_cases` for a container at that number —
           so a served leg pointing at a finding inside a case whose editions ran
           ahead of the finding's would report the wrong container hash, or none,
           on the surface a reader uses to check the leg. `case_edition` is
           stated so the reader can fetch the container the hash belongs to. */
        /* D-309: **ALL** OF THEM. A served leg points at a FINDING, and under
           clause 6 that finding may be a member of several cases — the shape the
           ruling exists for, since a leg resting on a mined finding is exactly
           the "lasting value" Bob named. Naming one container would tell a reader
           checking this leg to fetch a case the leg was never about. Each entry
           carries its own `manifest_sha` because the container hash is per case
           edition, so the reader can verify whichever one they hold. The scalar
           pair is the sole membership or null, as everywhere else. */
        const tms = this.#casesOfSha(e.to_bundle, t.bundle_sha, t.edition);
        const manifestOf = (cid, ced) =>
          this.#one(`SELECT manifest_sha FROM published_cases WHERE case_id=? AND edition=?`,
                    cid, ced)?.manifest_sha ?? null;
        const tm = this.publication.soleCase(tms);
        serves.push({ to: e.to_bundle, kind: e.kind, edition: t.edition, title: t.title,
                      bundle_sha: t.bundle_sha, ratified_at: t.ratified_at,
                      case_id: tm ? tm.case_id : null, case_edition: tm ? tm.edition : null,
                      cases: tms.map((x) => ({ case_id: x.case_id, edition: x.edition,
                                               manifest_sha: manifestOf(x.case_id, x.edition) })),
                      manifest_sha: tm ? manifestOf(tm.case_id, tm.edition) : null });
      }
      /* R28: a finding whose bytes an order withholds keeps its id and hash; its title (frozen from those bytes) and
         its graph are not served, and the withholding is stated on it. */
      const by = withheldBy(fnd.bundle_sha);
      if (by)
        return { ...fnd, title: null, serves: [], names: [], unresolved: [],
                 /* R28 (K5148): the row's other content is the case document's (its strength pair, grounds, exclusion
                    text) or the member's `required`; identity facts (hash, signer, attestor, role, edition) stay. */
                 case_excludes: null, strength: null, grounds: null, required: null,
                 division: { parent: null, siblings: [], detail: WITHHELD_SENTENCE },
                 parts: (fnd.parts || []).map((p) => ({ ...p, withheld: true })),
                 withheld: { orders: by, detail: WITHHELD_SENTENCE } };
      return { ...fnd, serves, names, unresolved,
               /* R28 (K5153): under a seal of the case document, the row's document-derived content is withheld with it. */
               ...(docWithheld ? { case_excludes: null, strength: null, grounds: null, required: null } : {}),
               division: {
                 parent: names.find((n) => n.kind === "division_parent")?.to ?? null,
                 siblings: names.filter((n) => n.kind === "division_sibling").map((n) => n.to).sort(),
                 detail: localize("public-read.index.a_divisions_parent_and_siblings", "a division's parent and siblings are NAMED and never served: the parent is terminal and can never be published, a sibling may not be, and a reader who can see one half of a divided question is entitled to know the other half exists (R4)."),
               } };
    });

    /* R3 (N345): THE TENSIONS THE SIGNED DOCUMENT DISCLOSED, read from its bytes and never live; each member's own
       sentences beside it. A document before /5 answers null with its sentence (R13); no signed document, or no case,
       discloses nothing here and says so. */
    const disclosed = heldDocument && typeof heldDocument.text === "string"
      ? caseTensionsOf(heldDocument.text)
      : { tensions: null, highlighted: null, members: {}, unread: null,
          detail: docWithheld ? WITHHELD_SENTENCE
            : theCase ? localize("public-read.index.no_signed_case_document_disclosure", "no signed case document is held for this edition, so it states no disclosure here")
                      : localize("public-read.index.not_a_case_discloses", "this is not a case, so it discloses no contradiction") };
    for (const f of findings) f.tensions = disclosed.tensions === null ? null : disclosed.members[f.bundle_id] || [];
    /* R3 (N364; `case-grammar` R1): the `captures:` and `sources:` blocks as signed, from the same bytes and never live: what
       the document states of a source is what `publishableAt` answered at the commit (`publication` R51), and nothing is added. */
    const blocks = heldDocument && typeof heldDocument.text === "string"
      ? caseDocumentBlocks(heldDocument.text)
      : { captures: null, sources: null,
          detail: docWithheld ? WITHHELD_SENTENCE
            : theCase ? localize("public-read.index.no_signed_case_document_capture", "no signed case document is held for this edition, so it states no capture or source here")
                      : localize("public-read.index.not_a_case_capture", "this is not a case, so it states no capture or source") };
    const manifest = manifestWithheld ? null : manifestHeld;
    const signed = signedParts(heldDocument);
    const said = this.#editionStatements(signed, theCase, ed, editions, { docWithheld, index });
    /* R26, R27: the calculations and the timeline, read from the signed document only. */
    const calculations = signed ? this.#calculationsOf(signed.fm) : docWithheld ? null : [];
    const timeline = signed ? this.#timelineOf(signed.fm)
      : docWithheld ? null
      : { they_did: [], we_did: [], placed_nowhere: { they_did: [], we_did: [] }, detail: TIMELINE_SENTENCE };
    /* R28: the files the manifest lists, each marked where an order withholds it. A case file's manifest lists its
       files (`files`, `case-grammar` R13); a container from before T28 lists its parts. */
    const listed = manifestHeld && Array.isArray(manifestHeld.files) ? manifestHeld.files
      : manifestHeld && Array.isArray(manifestHeld.parts) ? manifestHeld.parts : [];
    const files = listed.map((p) => ({ path: p.path, sha256: p.sha256, kind: p.kind, bytes: p.bytes ?? null,
                                       finding: p.finding ?? null,
                                       ...(Number.isInteger(p.part) ? { part: p.part } : {}),
                                       ...(withheldBy(p.sha256) ? { withheld: true } : {}) }));
    const withheldFiles = files.filter((f) => f.withheld).map((f) => f.path);
    const withheldFindings = findings.filter((f) => f.withheld).map((f) => f.bundle_id);
    const withheld = whole || docWithheld || manifestWithheld || withheldFiles.length || withheldFindings.length
      ? { whole, document: docWithheld, manifest: manifestWithheld, findings: withheldFindings, files: withheldFiles,
          detail: WITHHELD_SENTENCE }
      : null;
    /* R22 (DEC-112 (4)(1)): each member's standing, `case-grammar.standingOf` over its role, the bar and its frozen pair,
       all three read from the signed document only; null where the document states no member blocks (or there is
       none). It composes no case-level strength (R11): one line per member, never one for the case. */
    const standings = signed ? standingsOf(signed.fm) : null;
    for (const f of findings) f.standing = standings ? (standings.get(f.bundle_id) ?? null) : null;
    /* R39 (C2): the claim and falsifier the signed document states for each member, for the Worker's `body.conclusion` and
       `body.falsifies` to carry before the finding's own bytes' words; null where the document states none. */
    const stated = signed ? caseWordsOf(signed.fm) : null;
    for (const f of findings) f.case_words = stated ? (stated.get(f.bundle_id) ?? null) : null;
    /* R3 (DEC-112): a `/6` document's `method` and `materials` blocks, as signed, each copy's row with its `label_key`
       (T41; DEC-185 (1)); null for any other document. */
    const six = !!(signed && caseDocumentRequiresMaterials(signed.fm));
    /* R20 (DEC-116 items 7, 8): each edition a docket withdrawal names carries its stamp; the edition is answered whole
       as before. The docket's last date is `docket` R14's `last_entry`, read synchronously and without any capture's
       bytes through its `lastEntryOf` (K1276), null when the case has no public entry. */
    const withdrawn = theCase ? new Map(editions.map((e) => [Number(e.edition), this.#withdrawnStamp(theCase, e.edition)]))
                              : new Map();
    const answer = { ok: true, caseId: theCase, edition: ed,
             /* R20: the withdrawal stamp at the top of the answer, linked to its entry; null when no withdrawal names
                this edition. */
             withdrawn: withdrawn.get(Number(ed)) ?? null,
             docket_last_entry: theCase ? (this.docket.lastEntryOf({ case: theCase }) ?? null) : null,
             /* R3 (DEC-101; Publication §5A): what changed in this edition, at the top, and the successor's statement
                beside the pointer to it; both read from signed documents, never live. */
             what_changed: said.what_changed, successor: said.successor,
             /* R28: this edition's court-order stamps, each linked to the docket entry that names its order, and what
                they withhold; `[]` and null when none. */
             court_orders: mine ? mine.orders : [],
             withheld,
             scope: whole ? null : state.scope,
             /* CASE-5 / DEC-72 clause 2, ON THE ANONYMOUS PUBLIC READ, which is
                the surface the whole ruling is FOR. Clause 4's design sentence
                is *"each claim's own derived strength displayed beside the case's
                standard"* — a reader cannot do that if the standard is not on
                the answer, and until this item the only way to reach it was to
                pick one member's `required` block and hope the others agreed.
                `project` beside it because a bar with no publisher is a
                requirement nobody asserted. Both null for a case published
                before DEC-72, and null here is the design's absent-bar posture,
                not a bar of zero: `bar_detail` below says so in words. */
             project: state.project ?? null,
             /* R19 (DEC-111; `case-grammar` R10): the notice this edition names as its project reference, read from its
                signed document with `case-grammar`'s one reading, never live; null when it names none or is not `/5`. */
             project_reference: signed ? workingOnOf(signed.fm) : null,
             bar: state.bar ?? null,
             /* D-M6 (K5265): the standard is named only when the case DECLARES one; a bar object that declares none
                (`declared: false`) answers the no-bar words, as a null bar does. */
             bar_detail: state.bar && (state.bar.declared === true || state.bar.declared === "true")
               ? localize("public-read.index.the_standard_of_evidence_this", "the standard of evidence this case was held to, read from its publishing project at the moment of publication and frozen here (DEC-72). It is the CASE's property: no bar attaches to any finding, and nothing composed it across projects. Each member's own derived pair is printed beside it inside findings[], and a member may exceed it.")
               : word("public-read.bar_recorded_case"),
             bias_acknowledgement: whole ? null : (state.bias_acknowledgement ?? null),
             /* R3 (DEC-103): the lens this edition was produced under, read from its signed document, never live. */
             lens: said.lens, lens_fingerprint: said.lens_fingerprint, lens_detail: said.lens_detail,
             /* D-712: THE SIGNED CASE DOCUMENT, SERVED. `caseEditionState` builds `document` for exactly this read (the
                ratify path and the public read must not be able to disagree), and this return picks its fields by
                name (IC-22), so it names it. NULL UNTIL RATIFIED, never a partial; null on the loose branch. */
             /* R13 (T46; N906): beside the signed text, the versions its citations rest on as signed
                (`case-grammar.signedCitations`): a document older than `/4` signed none, and says so, never filled. */
             document: docWithheld ? { withheld: true, doc_sha: state.document.doc_sha ?? null, detail: WITHHELD_SENTENCE }
                                   : state.document ? { ...state.document, citations: signedCitations(state.document.text) }
                                   : null,
             /* IC-22, 2026-08-05 (UI-40): `opened` IS NOT PUBLISHED HERE. It was
                the instant the case edition was opened, and NOTHING read it —
                re-measured across the whole repository rather than inherited
                from the item that found it: no screen of the interface reads it
                (`screens-publish`, which draws this answer, holds no read of it),
                and no test of the day asserted it. The surface renders `ratified_at`,
                which is the instant the record can actually stand behind.
                Removed rather than blanked, on REC-41's precedent: there is no
                key in the answer for a later refactor to re-expose and a caller
                cannot tell one was ever computed.

                CORRECTED 2026-08-05 (REC-58), AND THE CORRECTION IS THE WHOLE
                OF THAT ITEM. This block used to finish: "`caseEditionState`
                still carries `opened` and STILL SHOULD — [the publish-case op]
                returns it to the member who just published, which is a
                different op, a different class and a different question". The
                CONCLUSION was right and the REASON WAS FALSE. `publishCase()`
                computes no `opened`, reads none and returns none — the only
                occurrence of the letters in its whole body is the word
                "reopened" inside a refusal sentence.
                No sibling op was being spared, because no sibling op publishes
                it. REC-58 was queued off this sentence to sweep a site that
                does not exist, which is why the sentence is corrected here
                rather than quietly dropped: an item was spent on it.

                CORRECTED AGAIN 2026-08-08 (M0-12), AND THE SECOND CORRECTION IS
                WHY THAT ITEM EXISTS. Both sentences above named the op as
                `publishcase`. THERE IS NO SUCH OP. `publishcase` is the STORE'S
                DO PATH; `DO_PATH` (then in the plane's index.mjs, now `control-plane`'s) aliases `op=publish` onto it, so
                the op whose name matches the method is routed AWAY from it and
                a caller sending the path name as `op=` gets `unknown op`. The
                routing chain, in full: **`op=publish` -> DO path `publishcase`
                -> `Store.publishCase()`**. REC-58 was right about the field and
                wrong about the op — REC-41's lesson for the FOURTH time, inside
                the very correction written to close the third. The mechanical
                check was `scripts/op-claims.mjs`, driven by
                `test/op-claims.test.mjs` (both since retired), and it found this line.

                WHERE IT ACTUALLY GOES, measured: `caseEditionState` has TWO
                callers. `publish()` — the ratification committer — returns the
                state WHOLE as `case: caseState`, and that is an INTERNAL
                Durable Object hop; the control plane then builds `op=ratify`'s
                answer and the container manifest by NAMING their fields, and
                `opened` is in neither list. This method is the other caller and
                picks its fields likewise. So the field reaches no caller on any
                op, and the risk it carries is not that it IS published but that
                it BECOMES published — one `...state` spread in any of the three
                and a field with zero measured demand is on the wire with nobody
                having decided it. This read's pick is held by
                `convert-publishedcase.test.mjs` and the container's by
                `convert-multifinding.test.mjs`; `op=ratify`'s is the control
                plane's. */
             completeness: whole ? null : state.completeness, ratified_at: state.ratified_at,
             /* R31 (DEC-145 (2), (6); `publication` R72, K2011): the criteria exactly as `publication`'s R53 state froze them
                at the commit, each row with its `label` and `access_words`, in member then leg order, a standard not freely
                readable carrying only the passages R72 holds; `[]` where no member targets a standard; null for an edition
                committed before T35, stated as not recorded and never filled (R13). Nothing is re-read from `standards`.
                A whole edition an order withholds states none (R28); a loose bundle is no case and states none. */
             ...criteriaOf(state, theCase, whole),
             /* R29 (DEC-147 (5)): when this edition was signed and when it was published, exactly as `publication` R70
                holds them on its row (one instant for both for an edition published at signing or before T34); each
                `edition_index` entry carries its own. Null on the loose branch, which is no case edition. Neither is in
                the case file's bytes (R23). */
             signed_at: cRow ? (cRow.signed_at ?? null) : null, published_at: cRow ? (cRow.published_at ?? null) : null,
             complete: state.complete, awaiting: state.awaiting,
             ...(asked ? { asked } : {}),
             findings,
             tensions: disclosed.tensions, highlighted: disclosed.highlighted,
             /* K499: the member legs the conflict read could not examine, stated by the document; null where it states none. */
             tensions_unread: disclosed.unread,
             captures: blocks.captures, sources: blocks.sources,
             /* R26 (C:A-15): each calculation, its outputs labeled computed facts with their denominators; R27 (C11): the
                timeline, its two lanes apart. Both null where an order withholds the document they are read from. */
             calculations, timeline,
             method: six ? methodOf(signed.fm) : null, materials: six ? keyedMaterialsOf(signed.fm) : null,
             blocks_detail: blocks.detail
               ?? word("public-read.capture_member_rests"),
             tensions_detail: disclosed.detail
               ?? word("public-read.contradiction_edition_owner"),
             /* R8: the evidence package's block, computed at this read by the module that provides it. */
             evidence_package: this.#evidencePackage(theCase, ed, findings),
             manifest_sha: state.manifest_sha, manifest,
             /* G54 (K4426, K4565): the case file's state and a stable code only, never a sentence, a step, an error or a detail
                (the op is public; those stay in the row and the log). Null for a ratified bundle that is no case. The page's
                words for each state and code are `screens-publish`'s. */
             case_file: theCase && cRow ? caseFileStateOf({ complete: state.complete, manifest_sha: state.manifest_sha ?? null,
               state: cRow.casefile_state ?? null, attempts: cRow.casefile_attempts ?? null, attempted_at: cRow.casefile_attempted_at ?? null,
               why: cRow.casefile_why ?? null }) : null,
             files,
             editions: editions.map((e) => e.edition),
             /* R20: each case edition's row carries its own stamp, or null, so a reader of any edition sees which
                stand withdrawn; a loose bundle's rows are not a case's editions and are unchanged. */
             edition_index: theCase ? editions.map((e) => ({ ...e, withdrawn: withdrawn.get(Number(e.edition)) ?? null }))
                                    : editions,
             latest_edition: editions.length ? editions[editions.length - 1].edition : ed,
             /* R34: the group's identity and declared stake as they stand now, labeled current; never read from or
                written into the signed document or the case file (R23). */
             group_fields: { ...this.groupFields({ project: state.project ?? null }), current: true }, group_fields_detail: GROUP_FIELDS_CURRENT_SENTENCE,
             case_detail: localize("public-read.index.a_published_case_is_a", "a published case is a CONTAINER over one or more FINDINGS (DEC-44). Each finding carries its OWN conclusion, falsifier, basis and its own frozen PAIR of strengths; the case carries the scope that brought them together, the completeness assertion, and the team's acknowledgement of the bias the case was produced under — the last of these is a DISCLOSURE the reader weighs, never a verdict this team's Civicsmith reached (DEC-20, DEC-46). There is deliberately no case-level strength: composing two findings' strengths into one letter is the substitution R2 forbids."),
             graph_detail: localize("public-read.index.each_finding_serves", "each finding's serves[] is what this surface may hand over — every entry names a published edition. names[] is what it may only NAME. unresolved[] is an edge classified servable at publication with no published edition behind it now, stated rather than dropped; it should be empty.") };
    /* R41 (3): each member the answer names, by handle. */
    return this.#byHandle(answer);
  }

  /** R37 (T50; DEC-310 (6); K3683, K3725): the `publishedcase` op's answer, `publishedCase`'s with `corrections` beside it,
   *  read from `docket`'s public answer (captures omitted) at the read. The synchronous `publishedCase` method does not
   *  carry it, so its other callers are unchanged. A refusal, and an answer that is no case, are `publishedCase`'s own.
   *  `{count, last}`: the public entries of the case dated after the answered edition's `published_at` (by day) whose
   *  kind is `edition`, `withdrawal` or `court-order`, and the newest of them by (date, seq) as `{seq, kind, date}`;
   *  `{count: null, last: null, undetermined: true}` when the docket cannot be read, never `count: 0`. Never throws, writes
   *  nothing, and is the same bytes for every caller. */
  async publishedCaseWithCorrections(query = {}) {
    const a = this.publishedCase(query);
    if (!a || a.ok !== true) return a;
    /* a ratified bundle in no case has no docket: it states null, so both branches answer one key set */
    if (!a.caseId) return { ...a, corrections: null };
    return { ...a, corrections: await this.#corrections(a.caseId, a.published_at) };
  }

  async #corrections(caseId, publishedAt) {
    const unread = { count: null, last: null, undetermined: true };
    try {
      const day = /^\d{4}-\d{2}-\d{2}/.exec(typeof publishedAt === "string" ? publishedAt : "");
      if (!day) return unread;
      const d = await this.docket.docketPublic({ case: caseId, captures: "omit" });
      if (!d || d.ok !== true || !Array.isArray(d.entries)) return unread;
      const later = [];
      for (const e of d.entries) {
        const f = (e && e.fields && typeof e.fields === "object" ? e.fields : safeJson(e && e.json)) || {};
        if (!["edition", "withdrawal", "court-order"].includes(f.kind)) continue;
        if (typeof f.date !== "string" || !(f.date.slice(0, 10) > day[0])) continue;
        later.push({ seq: Number(e.seq), kind: f.kind, date: f.date });
      }
      later.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.seq - y.seq));
      return { count: later.length, last: later.length ? later[later.length - 1] : null };
    } catch { return unread; }
  }

  /** R23 (DEC-112 (3); K1315, K1316): WHAT A CASE EDITION'S CASE FILE CARRIES, read from the published projection only,
   *  for the Worker's assembly (`../publication/worker.mjs`, R6). Answers, for a complete edition with a signed `/6`
   *  document, `{ok: true, case, edition, format, document, findings, grading, passages, materials, obscured,
   *  attestations}`:
   *  - `document`: the signed text, its digest, its armored signature and its signer's key;
   *  - `findings`: each member, then each other finding a member's chain reaches (named by the document's
   *    `grading_facts:` or `passages:` rows, `case-grammar` R17), with its published row at the edition its leg names
   *    (else its latest): its bytes' parts by hash, its signature and its signer's key; a reached finding nothing
   *    published answers is `published: null`, carried as what the document states of it and nothing more;
   *  - `grading`, `passages`: each finding's rows of the two signed blocks, in `ord` order;
   *  - `materials`: each `materials:` row (`case-grammar` R12) listed `included: true`, with what `publication` holds of
   *    it (its R57): a text held inline (`publishedMaterialText`), or the hash the published bucket holds it under;
   *    a document's `archives`, the `container` records and archives its commit registered for it, outward (R32), an
   *    archive that holds a material carried as its copy answered unregistered (`holds_original`); a row at the digest of
   *    such an original answers `original_of_copy` and nothing of its bytes;
   *  - `obscured` (T37; N757): each row stating `obscured` (`case-grammar` R12), never an included material: its ref, the
   *    copy's SHA-256 and label as signed, and whether the commit registered the copy under that ref (`registered`);
   *  - (G50) in `materials` and `obscured`, an entry of a `ref` on two or more rows of the document also carries `capture`,
   *    the row's `sha` lower-cased (a copied row's is its original's), or `capture: null` with `capture_invalid: true` for
   *    a sha that is not 64 hex; an entry of a `ref` on one row carries neither;
   *  - `criteria`: the edition's frozen criteria rows, or null when not recorded (R33);
   *  - `attestations`: each `material_attestations:` row of included material, a `member` row with its signed account
   *    from the document (when the row may name one), a `co_attestation` row with each token `publication` held for
   *    that material (its R57: by hash, with its text where held inline).
   *  Anything else (no such edition, not complete, no signed document, a document before `/6`) answers
   *  `{ok: false, reason}`, so the Worker keeps the container form for an edition prepared before T28. Writes nothing. */
  caseFileFacts(caseId, edition) {
    const c = str(caseId), ed = Number(edition);
    const state = c && Number.isInteger(ed) ? this.publication.caseEditionState(c, ed) : null;
    if (!state) return { ok: false, reason: "NO_SUCH_CASE_EDITION" };
    if (!state.complete) return { ok: false, reason: "INCOMPLETE" };
    const doc = signedParts(state.document);
    if (!doc || !caseDocumentRequiresMaterials(doc.fm)) return { ok: false, reason: "NOT_A_CASE_FILE_DOCUMENT" };
    /* `case-grammar` R17's readers: each finding's rows, keyed by finding, in `ord` order. */
    const grading = new Map(Object.entries(gradingFactsOf(doc.fm) || {}));
    const passages = new Map(Object.entries(passagesOf(doc.fm) || {}));
    const members = state.findings.map((f) => ({ bundle_id: f.bundle_id, member: true, role: f.role ?? null,
      published: { edition: f.edition, bundle_sha: f.bundle_sha, sig_armored: f.sig_armored,
                   key_b64: f.attestor ? f.attestor.key_b64 : null, parts: f.parts || [] } }));
    const seen = new Set(members.map((m) => m.bundle_id));
    const reached = [];
    const legsTo = (id) => [...grading.values()].flat().filter((l) => l && l.target === id && l.target_edition != null);
    for (const id of [...grading.keys(), ...passages.keys()]) {
      if (seen.has(id)) continue;
      seen.add(id);
      const at = legsTo(id).map((l) => Number(l.target_edition)).find((n) => Number.isInteger(n));
      const r = at != null
        ? this.#one(`SELECT edition, bundle_sha, sig_armored, attestor_key, parts FROM published_bundles
                      WHERE bundle_id=? AND edition=?`, id, at)
        : this.#one(`SELECT edition, bundle_sha, sig_armored, attestor_key, parts FROM published_bundles
                      WHERE bundle_id=? ORDER BY edition DESC LIMIT 1`, id);
      reached.push({ bundle_id: id, member: false, role: null,
        published: r ? { edition: Number(r.edition), bundle_sha: r.bundle_sha, sig_armored: r.sig_armored,
                         key_b64: r.attestor_key, parts: safeJson(r.parts) || [] } : null });
    }
    const findings = [...members, ...reached];
    const mats = materialsOf(doc.fm) || {};
    const rows = Array.isArray(mats.materials) ? mats.materials : [];
    const text = (sha) => (HEX64.test(String(sha ?? "")) ? heldText(this.publication.publishedMaterialText(sha)) : null);
    /* R23 (T37; N757; DEC-180 (4)): a row stating `obscured` (`case-grammar` R12) travels as its copy and never whole,
       whatever its `included` says: it is no included material here, and its original is carried for no row. */
    const copied = rows.filter((m) => m && m.obscured != null);
    const included = rows.filter((m) => m && m.obscured == null && (m.included === true || m.included === "true"));
    /* R32 with R23 (K2223): the pool keeps only what this edition's commit held (`publication.heldMaterialsOf`, its R57),
       so no other edition's registration under a shared ref lends this one an archive or a record. */
    const heldList = this.publication.heldMaterialsOf(c, ed);
    const heldHere = new Set((Array.isArray(heldList) ? heldList : [])
      .map((x) => String(x && x.sha != null ? x.sha : "").toLowerCase()).filter((s) => HEX64.test(s)));
    const pool = this.#archivePool([...included, ...copied].map((m) => m.ref), text, heldHere);
    const originals = new Set(copied.map((m) => String(m.sha ?? "").toLowerCase()).filter((s) => HEX64.test(s)));
    /* Fix round 6, G50 (B): a `ref` on two or more rows of the document (counted over all rows, carried or not, as G47
       counts) names each of its files by the row's capture (`case-grammar` R13's `/4`): the entry carries `capture`, the
       row's `sha` lower-cased (a copied row's is its original's), or `capture: null` with `capture_invalid: true` for a sha
       that is not 64 hex, which `buildCaseFile` never spells plain. A `ref` on one row adds no key. */
    const several = new Set(rows.filter((r, i) => r && typeof r.ref === "string" && rows.findIndex((x) => x && x.ref === r.ref) !== i).map((r) => r.ref));
    const captureFields = (m) => {
      if (!several.has(m.ref)) return {};
      const c = String(m.sha ?? "").toLowerCase();
      return HEX64.test(c) ? { capture: c } : { capture: null, capture_invalid: true };
    };
    /* The narrower walk (kept, K2223): what any edition registered shows which archives hold a copy-carried original. */
    const holdsOriginal = this.#archivesHolding(originals, this.#archivePool([...included, ...copied].map((m) => m.ref), text));
    const materials = included.map((m) => originals.has(String(m.sha ?? "").toLowerCase())
      ? { ref: m.ref, kind: m.kind, sha: m.sha ?? null, text_sha: m.text_sha ?? null, original_of_copy: true, archives: [],
          ...captureFields(m) }
      : { ref: m.ref, kind: m.kind, sha: m.sha ?? null, text_sha: m.text_sha ?? null,
          bytes_text: text(m.sha), extracted_text: m.kind === "document" ? text(m.text_sha) : null,
          archives: m.kind === "document" ? this.#archiveChain(m.sha, pool, holdsOriginal) : [], ...captureFields(m) });
    /* R23 (T37): each copy, at the SHA-256 the row names, read by that hash from the published projection only: it is
       carried when the commit registered it under the row's ref as kind `obscured` (`publication` R57, through
       `case-carriage` R1), its bytes read from the published bucket, where `ratification` R39 copies them. */
    const obscured = copied.map((m) => {
      const copy = String(m.obscured && m.obscured.copy != null ? m.obscured.copy : "").toLowerCase();
      const registered = HEX64.test(copy) && !!this.#one(`SELECT 1 AS x FROM published_shas WHERE sha256=? AND bundle_id=?
        AND kind='obscured' AND path=('materials/' || sha256) LIMIT 1`, copy, m.ref);
      return { ref: m.ref, copy: HEX64.test(copy) ? copy : null, label: m.obscured ? m.obscured.label ?? null : null, registered,
               ...captureFields(m) };
    });
    const refs = new Set(included.map((m) => m.ref));
    const accounts = (caseDocumentBlocks(state.document.text).captures || [])
      .flatMap((cap) => (cap.accounts || []).map((a) => ({ capture: cap.capture, ...a })));
    /* R23 (fix round 6, G47): a row states the capture it attests (`sha`, `case-grammar` R12) only where its `ref` has two
       or more captures in the document; it then joins that capture's material and is listed only if that capture is
       included, so an excluded capture of an included `ref` is excluded. A row stating none joins by `ref`, as every
       document written before does. */
    const lower = (s) => String(s ?? "").toLowerCase();
    const captureOf = (a) => (HEX64.test(lower(a.sha)) ? lower(a.sha) : null);
    const materialOf = (a) => included.find((m) => m.ref === a.ref && (captureOf(a) === null || lower(m.sha) === captureOf(a)));
    const attestations = (Array.isArray(mats.attestations) ? mats.attestations : [])
      .filter((a) => a && refs.has(a.ref) && materialOf(a)).map((a) => {
        const named = a.by_kind === "member" && !["group", "project"].includes(a.level);
        const material = materialOf(a);
        const account = named ? accounts.find((x) => x.by === a.by && material && x.capture === material.sha) ?? null : null;
        /* K1315: each timestamp token or co-archive record `publication` held for this material (its R57), by its own
           hash, registered under the material's ref with kind `attestation`. */
        /* G47t: a row stating its capture (`sha`, 64 hex; any other value reads as none) carries the tokens `publication`
           held for that capture and those held for no one capture (`capture_sha` null: shared, or registered before the
           column); a row stating none carries every token of the `ref`, as before. */
        const cap = captureOf(a);
        const held = a.by_kind !== "co_attestation" ? [] : this.#rows(
          `SELECT sha256 FROM published_shas WHERE bundle_id=? AND kind='attestation' AND path=('materials/' || sha256)
            ${cap ? "AND (capture_sha IS NULL OR capture_sha=?)" : ""} ORDER BY sha256`, a.ref, ...(cap ? [cap] : []))
          .map((r) => ({ sha: r.sha256, text: text(r.sha256) }));
        /* a row stating no capture (`sha: null` as the reader answers it) is carried as it always was: no key added */
        const { sha: stated, ...plain } = a;
        return { row: stated == null ? plain : a, account: account ? { by: account.by, at: account.at, text: account.text,
                                              signature: account.signature } : null,
                 held };
      });
    /* R23 (C:A-12): each `calculations:` row (`case-grammar` R18) with each input it names by its SHA-256, and the input's
       text where `publication` holds it inline (its R57); the rest are read from the published bucket by hash. */
    const calculations = this.#calculationRows(doc.fm).map((row) => ({ row,
      inputs: inputHashes(row.inputs).map((sha) => ({ sha, text: text(sha) })) }));
    return { ok: true, case: c, edition: ed, format: doc.fm.format ?? null, ratified_at: state.ratified_at,
             bar: state.bar ?? null,
             document: { doc_sha: state.document.doc_sha, text: state.document.text,
                         sig_armored: state.document.sig_armored,
                         key_b64: state.document.attestor ? state.document.attestor.key_b64 : null,
                         attestor: state.document.attestor ?? null },
             findings,
             grading: Object.fromEntries(findings.map((f) => [f.bundle_id, grading.get(f.bundle_id) || []])),
             passages: Object.fromEntries(findings.map((f) => [f.bundle_id, passages.get(f.bundle_id) || []])),
             materials, obscured, attestations, calculations,
             /* R33 (K2129): the criteria exactly as R31 answers them, as `publication`'s R53 state froze them (its R72);
                null for an edition committed before T35, which carries no criteria file. */
             criteria: Array.isArray(state.criteria) ? state.criteria : null };
  }

  /* R32 (N717; K2004; `case-carriage` R8 through `publication` R57): what a carried archive member brings with it, read
     from the published projection only. The commit registered, under an included material's ref, each `container` record
     (its text held inline, canonical JSON naming the member and its archive by SHA-256) and each archive (kind
     `archive`), outward to the outermost; a record or archive two of the edition's materials share is registered once,
     under the first, so the pool is read over every included ref of the edition. `heldHere` (K2223), when given, keeps
     only the records and archives this edition's commit held. */
  #archivePool(refs, text, heldHere = null) {
    const archives = new Set(), records = new Map();
    for (const ref of [...new Set(refs.filter((r) => typeof r === "string" && r))]) {
      for (const r of this.#rows(`SELECT sha256, kind FROM published_shas WHERE bundle_id=? AND kind IN ('container','archive')
                                   AND path=('materials/' || sha256) ORDER BY sha256`, ref)) {
        if (heldHere && !heldHere.has(r.sha256)) continue;
        if (r.kind === "archive") { archives.add(r.sha256); continue; }
        const t = text(r.sha256);
        const c = safeJson(t);
        const member = c && typeof c.member_sha256 === "string" ? c.member_sha256.toLowerCase() : null;
        const archive = c && typeof c.archive_sha256 === "string" ? c.archive_sha256.toLowerCase() : null;
        if (member && HEX64.test(archive ?? "") && !records.has(member)) records.set(member, { sha: r.sha256, text: t, archive });
      }
    }
    return { archives, records, text };
  }

  /* R32: one material's chain, walked from its own digest: the record naming it as its member, then the archive that
     record names, then the record naming that archive as a member, and so on, so a ref another edition also used never
     lends this one a link. Answers `[{kind, sha, text, member}]` in walk order (`member` the digest the link is about);
     an archive a record names that the commit did not register is answered `registered: false`, so the case file names
     it unheld. A material that is no member answers `[]`. An archive already walked ends the walk (a cycle). */
  #archiveChain(sha, { archives, records, text }, holdsOriginal = new Set()) {
    const s = String(sha ?? "").toLowerCase();
    if (!HEX64.test(s)) return [];
    const chain = [], walked = new Set([s]);
    for (let cur = s; records.has(cur);) {
      const rec = records.get(cur);
      chain.push({ kind: "container", sha: rec.sha, text: rec.text, member: cur });
      if (walked.has(rec.archive)) break;
      walked.add(rec.archive);
      /* R23 (T37): an archive that holds a material this edition carries as its copy holds the original's bytes: it is carried
         for no material, named unheld, and the walk stops there (as `case-carriage` R8 holds it at the commit). */
      if (holdsOriginal.has(rec.archive)) { chain.push({ kind: "archive", sha: rec.archive, text: null, member: cur, registered: false,
                                                          holds_original: true }); break; }
      if (!archives.has(rec.archive)) { chain.push({ kind: "archive", sha: rec.archive, text: null, member: cur, registered: false }); break; }
      chain.push({ kind: "archive", sha: rec.archive, text: text(rec.archive), member: cur });
      cur = rec.archive;
    }
    return chain;
  }

  /* R23 (T37): every archive the pool shows holding one of `originals` (a material this edition carries as its copy), directly
     or through an archive it holds, outward: the records naming each original as a member, then their archives, and so
     on. An original whose record the published projection does not hold is found by no walk here; `case-carriage` R8
     registers no such archive for the edition at the commit. */
  #archivesHolding(originals, { records }) {
    const out = new Set();
    for (const o of originals) for (let cur = o; records.has(cur);) {
      const a = records.get(cur).archive;
      if (out.has(a)) break;
      out.add(a);
      cur = a;
    }
    return out;
  }

  /* R3 (DEC-101, DEC-103; K1019): THE EDITION'S OWN STATEMENTS, from its signed document through `case-grammar`'s
     readers (its R8, R9) and never live, so a bias manifest or a statement changed after signing changes nothing here.
     `what_changed` is answered for an edition above 1 only (edition 1 has nothing it changed); a document without the
     block answers null and nothing is filled in (R13). `successor` is the next edition's statement, quoted beside this
     edition's pointer to it; null on the latest edition. `lens` is the signed section whole (`print`, the print form)
     and its parts: the acknowledgement, each statement with its justification, printed citations and withheld count
     in the document's order, and the closing sentences the document prints. A withheld citation is a count; nothing
     names it. Without the blocks, `lens` is null and `lens_fingerprint` is the frozen manifest's `statements_sha`. */
  #editionStatements(doc, theCase, ed, editions, { docWithheld = false, index = null } = {}) {
    const wc = doc && Number(ed) > 1 ? whatChangedOf(doc.fm, doc.body) : null;
    const what_changed = wc ? { statement: wc.statement, began_as: wc.began_as, draft: wc.draft,
                                adopted_as_drafted: wc.adopted_as_drafted } : null;
    let successor = null;
    const next = theCase ? editions.map((e) => Number(e.edition)).filter((n) => n > Number(ed)).sort((a, b) => a - b)[0]
                         : undefined;
    if (next !== undefined) {
      const ndoc = (this.publication.caseEditionState(theCase, next) || {}).document;
      /* R28: a successor whose document an order withholds is pointed to, and its statement is not quoted. */
      const held = !(ndoc && index && (index.bySha.has(ndoc.doc_sha)
        || (index.editions.get(`${theCase}\u0000${next}`) || {}).whole));
      const nd = held ? signedParts(ndoc) : null;
      const nwc = nd ? whatChangedOf(nd.fm, nd.body) : null;
      successor = { edition: next, statement: nwc ? nwc.statement : null,
                    ...(held ? {} : { withheld: true, detail: WITHHELD_SENTENCE }) };
    }
    const l = doc ? lensOf(doc.fm) : null;
    if (l) {
      const print = lensSection(doc.body);
      const ack = doc.fm.bias_acknowledgement;
      return { what_changed, successor, lens_fingerprint: null, lens_detail: null,
               lens: { bias_acknowledgement: typeof ack === "string" ? ack : null,
                       statements: l.statements.map((x) => ({ bundle: x.bundle, id: x.id, kind: x.kind,
                         subject: x.subject, text: x.text, justification: x.justification,
                         citations: x.citations, withheld: x.withheld })),
                       closing: print ? lensClosingSentencesOf(doc.fm).filter((c) => print.includes(c)) : [],
                       print } };
    }
    if (!doc) return { what_changed, successor, lens: null, lens_fingerprint: null,
                       lens_detail: docWithheld ? WITHHELD_SENTENCE : LENS_NO_DOCUMENT_SENTENCE };
    const bm = doc.fm.bias_manifest && typeof doc.fm.bias_manifest === "object" ? doc.fm.bias_manifest : null;
    const sha = bm && typeof bm.statements_sha === "string" && /^[0-9a-f]{64}$/.test(bm.statements_sha)
      ? bm.statements_sha : null;
    const noneInForce = bm && (bm.in_force === false || bm.in_force === "false");
    return { what_changed, successor, lens: null, lens_fingerprint: sha,
             lens_detail: sha ? LENS_FINGERPRINT_SENTENCE
               : noneInForce ? LENS_NONE_IN_FORCE_SENTENCE : LENS_FINGERPRINT_UNDETERMINED_SENTENCE };
  }

  /* ---------------------------------------------------------------- R28: a court order's stamp, served */

  /* R28 (N598, K1644): every edition holding a stamp, with its stamps in order, in one read (`publication.stampedEditions`,
     its R64), keyed `case NUL edition`; an edition with none is not listed. */
  #stampedEditions() {
    const s = this.publication.stampedEditions();
    const out = new Map();
    for (const e of s && Array.isArray(s.editions) ? s.editions : [])
      if (e && Array.isArray(e.stamps) && e.stamps.length) out.set(`${e.case}\u0000${Number(e.edition)}`, e.stamps);
    return out;
  }

  /* R28: every item of a case edition that the public read serves bytes for, each a hash with the paths it is known by:
     the signed case document, the case file's or container's manifest and every file it lists, and each member finding's
     bytes and parts. */
  #editionItems(caseId, state, manifestSha, manifest) {
    const items = [];
    const doc = state && state.document;
    if (doc && HEX64.test(String(doc.doc_sha ?? "")))
      items.push({ sha256: doc.doc_sha, paths: [caseFilePath("case_document"), ...this.#rows(
        `SELECT path FROM published_shas WHERE sha256=? AND bundle_id=?`, doc.doc_sha, caseId).map((r) => r.path)] });
    if (HEX64.test(String(manifestSha ?? ""))) items.push({ sha256: manifestSha, paths: ["manifest.json", "MANIFEST.json"] });
    const files = manifest && Array.isArray(manifest.files) ? manifest.files
      : manifest && Array.isArray(manifest.parts) ? manifest.parts : [];
    /* R28 with R23 (T37; K2145's reading; fix round 6, G50 (A)): an obscured copy is the material's own copy (a photo with
       areas covered, a member document cleaned), so an order naming the material (its `document` path under the row's ref)
       or an original it was made from (that original's hash) withholds the copy too. A copy is joined to its originals by
       its OWN hash, from the signed rows, never by `ref`: a `ref` on two copied rows has two originals, and an order
       naming one capture's original withholds that capture's copy and no other. A `Set`, so that two rows with the same
       copy bytes withhold both originals' copy. */
    const originalsOfCopy = new Map();
    if (files.some((f) => f && f.kind === "obscured")) {
      const signed = signedParts(doc);
      const rows = signed ? (materialsOf(signed.fm) || {}).materials : null;
      for (const r of Array.isArray(rows) ? rows : []) {
        if (!r || r.obscured == null) continue;
        const copy = String(r.obscured.copy ?? "").toLowerCase(), original = String(r.sha ?? "").toLowerCase();
        if (!HEX64.test(copy) || !HEX64.test(original)) continue;
        if (!originalsOfCopy.has(copy)) originalsOfCopy.set(copy, new Set());
        originalsOfCopy.get(copy).add(original);
      }
    }
    for (const f of files) {
      if (!f || typeof f.sha256 !== "string") continue;
      const entry = typeof f.path === "string" ? caseFileEntryOf(f.path) : null;
      const ref = f.kind === "obscured" && entry && entry.kind === "obscured" ? entry.ref : null;
      /* G50 (B): a file at a capture's own path is also known by its kind's ref-level path, so an order naming the ref's
         path reaches every capture's file; a copy is also known by its capture's `document` path. A file without a
         capture in its path is known as it was. */
      const capture = entry && entry.capture ? entry.capture : null;
      items.push({ sha256: f.sha256, scaffold: !!(entry && SCAFFOLD_KINDS.has(entry.kind)), paths: ref ? [f.path, caseFilePath("document", ref),
        ...(capture ? [caseFilePath("document", [ref, capture])] : []),
        ...(originalsOfCopy.get(f.sha256.toLowerCase()) || [])]
        : capture ? [f.path, caseFilePath(entry.kind, entry.ref)] : [f.path] });
    }
    for (const f of (state && state.findings) || []) {
      if (typeof f.bundle_sha === "string")
        items.push({ sha256: f.bundle_sha, paths: [f.bundle_id, `${f.bundle_id}/bundle.md`, caseFilePath("finding", f.bundle_id)] });
      for (const p of f.parts || []) if (p && typeof p.sha256 === "string")
        items.push({ sha256: p.sha256, paths: [f.bundle_id, `${f.bundle_id}/${p.path}`] });
    }
    return items;
  }

  /* R28: what every court order in force withholds, read at this call: `editions` each stamped case edition's
     withholding (keyed `case NUL edition`), `bySha` each withheld hash with the orders that withhold it. A hash is one
     object, so bytes an order withholds under one edition are withheld wherever they would be served (J1 (5)). The
     stamps are one read (`#stampedEditions`); only an edition with a stamp is opened. */
  #withheldIndex() {
    const editions = new Map(), bySha = new Map(), scaffoldBy = new Map();
    const stamped = this.#stampedEditions();
    if (!stamped.size) return { editions, bySha, scaffoldBy };
    for (const e of this.#rows(`SELECT case_id, edition, manifest_sha, manifest FROM published_cases ORDER BY case_id, edition`)) {
      const stamps = stamped.get(`${e.case_id}\u0000${Number(e.edition)}`);
      if (!stamps) continue;
      const state = this.publication.caseEditionState(e.case_id, Number(e.edition));
      const manifest = safeJson(e.manifest);
      const items = this.#editionItems(e.case_id, state, e.manifest_sha, manifest);
      const w = withholdingOf(e.case_id, stamps, items, docketAddress);
      withholdChains(w.withheld, manifest);
      editions.set(`${e.case_id}\u0000${Number(e.edition)}`, w);
      /* R28 (K5148): a hash this edition holds only as scaffolding (bytes the case-file grammar generates, no member's
         material: the default `criteria.json`, a finding's facts files when it has no rows to state) is this case's own,
         however many cases share the bytes. */
      for (const it of items) if (it.scaffold && !items.some((o) => o.sha256 === it.sha256 && !o.scaffold)) {
        if (!scaffoldBy.has(it.sha256)) scaffoldBy.set(it.sha256, new Set());
        scaffoldBy.get(it.sha256).add(e.case_id);
      }
      for (const [sha, orders] of w.withheld) {
        const prev = bySha.get(sha) || [];
        bySha.set(sha, [...prev, ...orders.map((o) => ({ case: e.case_id, edition: Number(e.edition), ...o }))]);
      }
    }
    return { editions, bySha, scaffoldBy };
  }

  /** R28 (`op=withheld&sha256=<hash>[,<hash>…]`, for the Worker's `op=publishedbytes`; internal, routed by no door): of
   *  the hashes asked, each a court order in force withholds, with each order (its case, edition, effect, parts and
   *  docket entry). `{ok: true, withheld: {<sha256>: [order…]}}`; a hash nothing withholds is not listed. Writes nothing.
   *  (K5148) With `zip`, a case edition's manifest hash, the answer is for that case's zip: a hash that another case holds
   *  only as scaffolding counts under that case's orders alone, and material (a finding, a capture, a document) under any
   *  case's. */
  withheldOf(shas, zip = null) {
    const want = (Array.isArray(shas) ? shas : String(shas ?? "").split(","))
      .map((s) => String(s).trim().toLowerCase()).filter((s) => HEX64.test(s));
    if (!want.length) return { ok: true, withheld: {} };
    const { bySha, scaffoldBy } = this.#withheldIndex();
    const forCase = zip && HEX64.test(String(zip).toLowerCase())
      ? this.#one(`SELECT case_id FROM published_cases WHERE manifest_sha=?`, String(zip).toLowerCase())?.case_id ?? null : null;
    const counted = (sha) => (bySha.get(sha) || []).filter((o) => !zip || o.case === forCase || !scaffoldBy.get(sha)?.has(o.case));
    return { ok: true, withheld: Object.fromEntries(want.map((s) => [s, counted(s)]).filter(([, os]) => os.length)) };
  }

  /* ---------------------------------------------------------------- R26, R27: calculations and the timeline */

  /* R26 (C:A-15; D275): each calculation the signed document carries (`case-grammar.calculationsOf`, its R18), read from
     the document only, never recomputed: its question where the row states one, its outputs by key, each as signed (a
     count or share carries its denominator beside it inside the result, `calc-grammar` R8), lifted beside it, and a share
     whose row states no denominator answers `denominator: null` with the sentence that it is undetermined, never a share
     alone), its method version, its recompute status, the publisher's disclosure beside a differing or unbound one, and
     every output labeled a computed fact. `[]` for a document without the block. */
  /* R23, R26: the document's `calculations:` rows as `case-grammar` reads them (its R18); `[]` without the block. */
  #calculationRows(fm) {
    return calculationsOf(fm).filter((r) => r && typeof r === "object");
  }

  #calculationsOf(fm) {
    return this.#calculationRows(fm).map((r) => {
      const recipe = typeof r.recipe === "string" ? safeJson(r.recipe) : r.recipe && typeof r.recipe === "object" ? r.recipe : null;
      const results = r.results && typeof r.results === "object" ? r.results : {};
      const outputs = Object.keys(results).sort().map((key) => outputOf(key, results[key]));
      const flagged = r.recompute === "differs" || r.recompute === "unbound";
      return { calc: r.calc ?? null,
               question: typeof r.question === "string" ? r.question
                 : recipe && typeof recipe.question === "string" ? recipe.question : null,
               outputs, result_key: r.result_key ?? null, method_version: r.method_version ?? null,
               recompute: r.recompute ?? null,
               disclosed: r.disclosed ?? null,
               ...(flagged ? { disclosure_detail: r.disclosed != null ? CALC_DISCLOSED_SENTENCE : CALC_UNDISCLOSED_SENTENCE } : {}),
               label: COMPUTED_FACT };
    });
  }

  /* R27 (C11; `publication` R63): the edition's timeline as signed (`case-grammar.timelineOf`, its R20), never read from
     `events`: the two lanes apart, each in its own order, each item with its `when` as held and its source; an item placed
     nowhere listed apart, in its lane. Both lanes empty for a document without the block. */
  #timelineOf(fm) {
    const t = timelineOf(fm);
    const lane = (name) => (t && Array.isArray(t[name]) ? t[name] : []).filter((i) => i && typeof i === "object")
      .map((i) => ({ ord: i.ord ?? null, when: i.when ?? null, label: i.label ?? null, ref: i.ref ?? null,
                     source: i.source ?? null }));
    const placed = (items) => items.filter((i) => !isNowhere(i.when));
    const nowhere = (items) => items.filter((i) => isNowhere(i.when));
    const they = lane("they_did"), we = lane("we_did");
    return { they_did: placed(they), we_did: placed(we),
             placed_nowhere: { they_did: nowhere(they), we_did: nowhere(we) },
             detail: TIMELINE_SENTENCE };
  }

  /* REC-128 — THE ONE READ CHOKEPOINT FOR WHO DELIVERED A RATIFICATION. Every
     read that serves a ratification (the finding rows, the case document, the
     public case read and so the container that travels) answers through here,
     from the stored `delivered_by` column and from NOTHING ELSE: in particular
     never from `attestor_member`, so a row written before the column existed
     reads UNDETERMINED, stated, rather than back-filled from its signer.
     `published.test.mjs`' R12 and R13 arms hold that. */
  #deliveredBy(row) { return delivererOf(row ? row.delivered_by : null); }

  /* A ratified bundle that belongs to NO case, in the same shape as a case
     edition so one renderer serves both — with `caseId: null`, no scope and no
     completeness, because it is not a case and saying otherwise is the exact
     claim DEC-44 corrects. This is what an information bundle's ratification
     is: verifiable bytes with a signature and no case-level assertion. */
  #looseEditionState(bundleId, ed) {
    const r = this.#one(
      `SELECT bundle_id, title, bundle_sha, ratified_at, attestor_key, attestor_member, delivered_by, gate_version,
              sig_armored, strength, required, parts
       FROM published_bundles WHERE bundle_id=? AND edition=?`, bundleId, ed);
    if (!r) return null;
    /* REC-47: `bias_acknowledgement: null` for the same reason `scope` and
       `completeness` are null here — a ratified bundle that is not a case makes
       no case-level assertion, and inventing one would be the exact claim
       DEC-44 corrects. Stated as null rather than omitted, so a renderer sees
       "no such assertion" rather than a missing key it might read as absence of
       bias. */
    return { caseId: null, edition: ed, scope: null, completeness: null,
             bias_acknowledgement: null,
             /* D-712: no case document — this is not a case. Stated as null so both branches answer one key set. */
             document: null,
             /* CASE-5: `project` and `bar` null here for the reason `scope` and
                `completeness` already are — whose production a thing is and what
                standard it was held to are CASE assertions, and this is not a
                case. Stated rather than omitted so a renderer sees "no such
                assertion" instead of a missing key it might read as a bar of
                zero, which is the distinction the design doc's absent-bar clause
                is entirely about. */
             project: null, bar: null,
             opened: r.ratified_at, ratified_at: r.ratified_at, manifest_sha: null,
             complete: true, awaiting: [],
             findings: [{ ord: 0, bundle_id: r.bundle_id, title: r.title, bundle_sha: r.bundle_sha,
                          /* CASE-5: the same two keys `caseEditionState` serves
                             per member, so ONE renderer still serves both shapes
                             — which is this method's whole reason for existing.
                             `version_sha` is null because nothing pinned these
                             bytes: no case committed to them. `role` is null
                             because a designation is a case's partition and there
                             is no case here to be a member of. */
                          version_sha: null, role: null, edition: ed,
                          ratified_at: r.ratified_at, gate_version: r.gate_version, sig_armored: r.sig_armored,
                          attestor: { member: r.attestor_member, key_b64: r.attestor_key },
                          delivered_by: this.#deliveredBy(r),
                          strength: r.strength ? JSON.parse(r.strength) : null,
                          required: r.required ? JSON.parse(r.required) : null,
                          parts: r.parts ? JSON.parse(r.parts) : [] }],
             detail: localize("public-read.index.a_ratified_record_that_is", "this is a RATIFIED RECORD that is not a member of any published case: it was never published as a finding, so it carries no case identity, no scope statement, no completeness assertion and no bias acknowledgement — those are claims a CASE makes, and this is not one. Its bytes are verifiable by hash exactly as any other ratified bytes are.") };
  }

  /* D-309: THE READ SURFACE'S HALF OF CLAUSE 6 — one case to serve, chosen by the
     READER and never by this plane.

     `publishedCase()` serves ONE case edition: its scope, its completeness
     assertion, its bias acknowledgement, its bar, its findings. That is a single
     artifact and cannot be two. So when a finding serves several cases this
     surface has three options and only one of them is honest — serve the newest
     (a guess dressed as an answer), serve all (a container that is not an
     artifact anybody published), or SAY SO AND NAME THEM.

     THE CALLER'S OWN `caseId` WINS WHENEVER IT ANSWERS, which is what keeps this
     a resolution aid rather than a wall: a reader who already knows which case
     they mean passes it and is served, and only a reader who has not said is
     asked. That ordering matters — refusing someone who DID say would be a fence
     tighter than its rule.

     IT NEVER REFUSES AN EMPTY LIST. A finding in no case at all is not ambiguous,
     it is loose, and the loose arm further down is what answers it — refusing
     here would break the doorbell's promise that ratified bytes answer. */
  #resolveOneCase(bundleId, list, namedCase = null) {
    const rows = list || [];
    if (!rows.length) return { ok: true, pick: null };
    const named = String(namedCase ?? "").trim();
    if (named) {
      const mine = rows.filter((x) => x.case_id === named);
      if (mine.length) return { ok: true, pick: this.publication.soleCase(mine) };
    }
    const sole = this.publication.soleCase(rows);
    if (sole) return { ok: true, pick: sole };
    const cases = [...new Set(rows.map((x) => x.case_id))].sort();
    /* UI-81 / C-44.2: THE CODE NOW CARRIES ITS CANNED TRANSLATION (DEC-49). It reached the published
       case page raw — no `*_CHECKS` row named it, so the guard could not see the one refusal a stranger
       meets on that page. Built from its row (`rowOf`, C-44.2 held in this module's table, R17), so `reason` and `code` are one literal and the wire only GAINS `code`, `check` and
       `translation`; every field it carried is unchanged (IC-185). */
    /* DEC-49 REGION is-finding-in-several-cases */
    return { ok: false, reason: "FINDING_IN_SEVERAL_CASES", ...rowOf("FINDING_IN_SEVERAL_CASES"), target: bundleId, cases,
             memberships: rows.map((x) => ({ case_id: x.case_id, edition: x.edition })),
             detail: localize("public-read.index.bundleid_is_a_published_finding", "{bundleId} is a published finding of {length} cases ({cases}). A finding can serve many cases (DEC-72 clause 6), and each case is its own artifact with its own scope and completeness assertion — so this read cannot choose one for you. Ask again naming the case you mean.", { bundleId: String(bundleId), length: String(cases.length), cases: String(cases.join(", ")) }) };
    /* END DEC-49 REGION is-finding-in-several-cases */
  }

  /* CASE-5 / DEC-72: WHICH CASE EDITION A SET OF PUBLISHED BYTES BELONGS TO,
     RESOLVED BY THE HASH RATHER THAN BY A NUMBER.
     `#casesOf(bundleId, edition)` above takes a CASE edition and is still exactly
     right when a caller holds one. What its callers actually held, in four of
     the five places it was used, was a `published_bundles` row — whose `edition`
     is the FINDING'S, and passing that as the case's is the same conflation
     `caseEditionState` carried, arriving through the argument list instead of
     through a WHERE clause. Before the flip the two numbers agreed and nobody
     could see it; after it a finding at its own edition 1 inside a case at
     edition 2 would resolve to NO CASE AT ALL and read as unpublished material.
     Answers BOTH halves — the case and THE CASE'S EDITION — because every caller
     that wanted one wanted the other and was deriving it from the wrong number.
     The fallback is the pre-CASE-3 row whose pin is honestly NULL, and for those
     rows the finding's edition IS the case's, which is the model they were
     written under.
     IT USED TO SAY `ORDER BY edition DESC LIMIT 1`, described as a real bound
     rather than a formality: one sha can in principle be pinned by more than one
     case edition, so the newest membership answered. Beside it stood the sentence
     that turned out to be the most useful in the file — *"Nothing writes that
     shape today"* — and CASE-6 pointed it at the fence that kept it true.

     ===== D-309, 2026-09-10: SITES 8 AND 9 OF CASE-6's NINE, AND THE SENTENCE IS
     NOW FALSE ON PURPOSE. `FINDING_IN_ANOTHER_CASE` is gone, so something DOES
     write that shape: a finding can be pinned by case A and case B at one hash,
     which is precisely what DEC-72 clause 6 rules it may be. The cross-reference
     did its job — the two moved together, in one item, and neither drifted.

     **THE DECISION HERE IS ALL MEMBERSHIPS, RETURNED AS AN ARRAY, AND IT IS NOT
     A CHOICE BETWEEN SHAPES.** The old comment already diagnosed what would
     happen if this stayed scalar past the fence: it *"starts answering a
     set-valued question with its newest element, which reads as an answer and is
     a guess."* This helper has five callers and they want three different things
     — `publishedList` and `publishedEditions` want to REPORT every membership,
     `publishedCase`'s loose arm wants the BOOLEAN "in no case at all", and
     `publishedCase`'s resolution arms want to serve ONE case and must refuse
     rather than pick when there are two. An array serves all three; a scalar
     serves none of them honestly. Each caller's decision is argued at its own
     site, because deciding them here is how one reader's convenience becomes
     another reader's overclaim.

     THE LEGACY FALLBACK KEEPS ITS MEANING AND ITS ORDER: pre-CASE-3 rows whose
     pin is honestly NULL, for which the finding's edition IS the case's, because
     that is the model they were written under. It is consulted only when the pin
     answers nothing, exactly as before. */
  /* D-309: SITE 2's QUERY, LIFTED OUT OF `publish()` AND PUT BESIDE ITS SIBLINGS,
     AND THE REASON IS A MEASUREMENT RATHER THAN TIDINESS — stated in full because
     a reader could otherwise take it for evasion, and it is the opposite.

     `meaning-bounds.test.mjs` (deleted in T20) graded an op OPAQUE when its
     method contained a `#rows(` call and published no collection: *"rows came
     out of the store and this reader could not say what happened to them."*
     Correcting site 2 put the first `#rows(` into `publish()`'s own body, and the
     walk moved `op=publish` out of NO-COLLECTION and into OPAQUE — a blind spot
     on the heaviest act in the system, which is the state `op=airunlog` was in
     while a ratchet read green over it.

     THE OLD CLASSIFICATION WAS AND REMAINS THE TRUE ONE. These rows do NOT reach
     the wire: they drive a divergence refusal, a per-case flag discharge, and a
     scalar bar projection, and the act answers with `caseCount` — a number — and
     nothing else. `publish()` genuinely publishes no collection. The `#rows(` in
     its body was the only thing making it look otherwise, so the query moved to
     where the file's other which-case readers already live rather than the
     roster growing a member that would have been describing the wrong thing.

     IT WAS NOT HIDDEN FROM ANYTHING: `multicase.test.mjs`'s census (deleted in
     T20) counted it as a full member of CASE-6's class. Its callers' answers are
     what `published.test.mjs`' R2 and R3 arms now hold.

     WHAT IT ANSWERS: which case editions froze THESE EXACT BYTES, one entry per
     CASE at that case's newest edition holding them — the same collapse every
     other D-309 site takes, so "how many cases is this member in" has one answer
     across the file. The JOIN on `published_cases` is unchanged and still does its
     job: only case editions that exist are membership. */
  #casesOfSha(bundleId, bundleSha, fallbackEdition = null) {
    const rows = bundleSha
      ? this.#rows(`SELECT case_id, edition FROM published_case_members
                     WHERE bundle_id=? AND version_sha=? ORDER BY case_id, edition`, bundleId, bundleSha)
      : [];
    if (rows.length) return rows.map((r) => ({ case_id: r.case_id, edition: Number(r.edition) }));
    const legacy = fallbackEdition != null
      ? this.#rows(`SELECT case_id, edition FROM published_case_members
                     WHERE bundle_id=? AND edition=? AND version_sha IS NULL ORDER BY case_id`,
                   bundleId, fallbackEdition)
      : [];
    return legacy.map((r) => ({ case_id: r.case_id, edition: Number(r.edition) }));
  }

}

const instances = new WeakMap();

/** The one instance for a host (K61). The first call creates it with `deps` (a test passes its own). It owns no table,
 *  so it creates and declares none (R16). */
export function publicReadOf(host, deps) {
  let r = instances.get(host);
  if (!r) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const publication = d.publication || publicationOf(host);
    const docket = d.docket || docketOf(host);
    /* R34: record-core, reached at the read (a throw there reads the stake undetermined). */
    const record = d.record || (() => recordOf(host));
    /* R36: project-roster, reached at the read (a throw there reads the matter stake undetermined). */
    const roster = d.roster || (() => projectRosterOf(host));
    /* R41: membership, reached at the read (a throw there names every member by the plain word). */
    const members = d.members || (() => membershipOf(host));
    r = new PublicRead({ storage, publication, docket, record, roster, members });
    instances.set(host, r);
  }
  return r;
}

/** The module's ops (K3), as entries of `plane`'s store op map (`../plane/store.mjs`), every one unstamped: each reads the published
 *  projection only (R10), so it answers without a credential; `publicread` serves a registered read under the same terms
 *  (R18). */
export function publicReadOps(r, url) {
  const q = (k) => url.searchParams.get(k);
  return {
    publishededitions: () => r.publishedEditions(q("id")),
    /* R38: what each published case froze for a question, by the question's id; no credential (R10). */
    publishedfrozen: () => r.publishedFrozen({ id: q("id") }),
    /* REC-22: the public read path's store side. */
    publishedcase: () => r.publishedCaseWithCorrections({ id: q("id"), edition: q("edition"), caseId: q("caseId") || null,
                                           sha256: (q("sha256") || "").toLowerCase() || null }),
    publishedmanifest: () => r.publishedManifest(),
    verify: () => r.verifySha((q("sha256") || "").toLowerCase()),
    publishedlist: () => r.publishedList(),
    /* R18: a registered read by its name, handed only the parameters it declared (R10). */
    publicread: () => r.publicRead(q("name"), Object.fromEntries(url.searchParams)),
    /* R21: the docket and its feed, by case, under R10's terms; R25: the docket with its captures' bytes left out. */
    docketpublic: () => r.docketPublic(q("case"), q("captures")),
    docketfeed: () => r.docketFeed(q("case")),
    /* R23: what a case edition's case file carries, for the Worker's assembly (R6); internal, routed by no door. */
    casefilefacts: () => r.caseFileFacts(q("caseId"), q("edition")),
    /* R28: which of these hashes a court order in force withholds, for the Worker's `publishedbytes`; internal. */
    withheld: () => r.withheldOf(q("sha256"), q("zip")),
  };
}

/* R40 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  verify: { classes: null, mutating: false, weight: "read", description: "act.verify.label.published",
    fields: { accepts: ["sha256"], requires: [] } },
  publishedcase: { classes: null, mutating: false, weight: "read", description: "act.publishedcase.label.published",
    fields: { accepts: ["id", "edition", "caseId", "sha256"], requires: [] } },
});
