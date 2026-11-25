/* ratification — the case-file sweep (R57; T51 fix round 6, G54). A complete published edition whose case file was not
 * built, or whose manifest was recorded and its bytes never stored, is owed (publication's ledger, `caseFilesOwed`), and this
 * is what builds it: per tick it takes a few of the oldest owed editions, one at a time, copies the materials first
 * (`copyMaterials`, R39), and runs public-read's one assembly (its R6) with what the copy found (`prior`). The assembly
 * records every attempt and its cause; this module records only what it decides itself (an edition too large to attempt,
 * an edition stopped for a material the evidence store confirms it no longer holds). It is idempotent (the assembly's `head`
 * guards skip stored files; a manifest of the same hash is recorded once) and bounded, so a tick never holds more than one
 * edition's bytes and never passes the platform's limits. Between the materials and the assembly it heals the edition's member
 * findings (R57, G57): the assembly reads each finding's `bundle.md` by hash from the published bucket, so one the act's copy
 * did not store would fail `FINDING_MISSING` at every try; the sweep copies it from the record (`textAtSha`, record-core R60). `./index.mjs` reaches it as `caseFileSweep` and `caseFileWake`;
 * `plane` registers those as a scheduler consumer (its R75). */

import { copyMaterialsDetailed } from "./ops.mjs";
import { assembleEdition, priorOf, errorText } from "./finding.mjs";

/* The tick's bounds, PROVISIONAL until the platform check P measured them (`build/plan/diagnosis-R6-g54-cause.md` 7.3; pinned by
   `g54-paths.test.mjs`): the editions a tick takes, and the files and bytes after which it takes no further edition. The
   edition too large to attempt (`TOO_LARGE`) is public-read's (its R6), and the stopping rule (the sixth `MATERIAL_MISSING`
   with the absence confirmed) is publication's writer's alone (its R15): this module only says what it found. */
export const CASEFILE_SWEEP_EDITIONS = 2;
export const CASEFILE_SWEEP_FILES = 400;
export const CASEFILE_SWEEP_BYTES = 16 * 1024 * 1024;

/** R57 (G57): a member finding's bundle part, `{path, sha256, bytes}`: the entry of its `parts` whose `sha256` is its
 *  `bundle_sha`, else `{path: "bundle.md", sha256: bundle_sha}`, the assembly's own fallback (a row with empty `parts`, as an
 *  old one is, is healed too); null when the finding names no `bundle_sha`. */
export function bundlePartOf(f) {
  const sha = f && typeof f.bundle_sha === "string" ? f.bundle_sha : "";
  if (!sha) return null;
  const part = (Array.isArray(f.parts) ? f.parts : []).find((p) => p && p.sha256 === sha);
  return { path: (part && part.path) || "bundle.md", sha256: sha, bytes: part && Number.isFinite(part.bytes) ? part.bytes : null };
}

/** R57 (G57): one owed edition's member findings healed before its assembly. Each finding's bundle part is headed in the
 *  published bucket; a present one is skipped (no record read); an absent one is read with `textAt(bundleId, sha)` (record-core's
 *  `textAtSha`, R60: the text only when it hashes to `sha`) and put as UTF-8; a part the record cannot answer is counted
 *  `unreadable`, never put, and left to the assembly to state `FINDING_MISSING`. The heal stops before a put once the tick's puts
 *  (`puts`, this edition's and the earlier ones') reach `CASEFILE_SWEEP_FILES` or its bytes (`bytes`) `CASEFILE_SWEEP_BYTES`
 *  (`incomplete`: the next tick goes on, every tick puts at least one), never on heads: an edition's heads are bounded by its
 *  member findings. A throw from the bucket is `error` (the assembly then states it, as a copy that failed). Answers
 *  `{examined, copied, bytes, unreadable, incomplete, error}`, or null when there is nothing to heal with (no reader, no bucket). */
export async function healFindings({ cs, worker, textAt, puts = 0, bytes = 0 }) {
  const bucket = worker && worker.env && worker.env.PUBLISHED;
  if (typeof textAt !== "function" || !bucket || typeof bucket.head !== "function" || typeof bucket.put !== "function") return null;
  const out = { examined: 0, copied: 0, bytes: 0, unreadable: 0, incomplete: false, error: null };
  const seen = new Set();
  for (const f of Array.isArray(cs && cs.findings) ? cs.findings : []) {
    const part = bundlePartOf(f);
    if (!part || seen.has(part.sha256)) continue;
    seen.add(part.sha256);
    try {
      const key = `${worker.storeName}/published/${part.sha256}`;
      out.examined++;
      if (await bucket.head(key)) continue;
      if (puts + out.copied >= CASEFILE_SWEEP_FILES || bytes + out.bytes >= CASEFILE_SWEEP_BYTES) { out.incomplete = true; break; }
      let text = null;
      try { text = textAt(String(f.bundle_id), part.sha256); } catch { text = null; }
      if (typeof text !== "string") { out.unreadable++; continue; }
      const body = new TextEncoder().encode(text);
      await bucket.put(key, body);
      out.copied++;
      out.bytes += part.bytes ?? body.length;
    } catch (e) { out.error = errorText(e); break; }
  }
  return out;
}

const reach = (w) => !!(w && w.env && w.storeName && w.stub);
const caseOf = (e) => String(e.case ?? e.case_id ?? e.caseId ?? "");

/** R57: whether an assembly's statement says the case file was built: it names its manifest and does not say `ok: false`. */
export const builtOf = (c) => !!(c && typeof c === "object" && c.ok !== false && typeof c.manifest_sha === "string" && c.manifest_sha);

/** R57, R42: one edition's outcome as the scheduled publisher states it, `{case, edition, built, code?}`, `code` the
 *  assembly's own for an edition not built. */
export const outcomeOf = (cs, container) => ({
  case: String(cs.caseId ?? cs.case_id ?? ""), edition: Number(cs.edition), built: builtOf(container),
  ...(builtOf(container) ? {} : { code: String((container && (container.code ?? container.reason)) ?? "NOT_ATTEMPTED") }) });

/** R57: the sweep's tick at `now` (ms). `host` reads the store: `publication` (the ledger: `caseFilesOwed`,
 *  `recordCaseFileAttempt`), `stateOf(case, edition)` (the edition's state, with its publishing group), `materialsOf(case,
 *  edition)` (the materials the commit held outside the record's text); `worker` is the Worker's reach (`env`, `stub`,
 *  `storeName`); `assemble` and `recordFailure` public-read's. Answers what the tick did, never throws: an edition that
 *  fails in an unforeseen way is recorded and the tick goes on. */
export async function sweepCaseFiles({ publication, stateOf, materialsOf, worker, now, assemble, recordFailure, textAt }) {
  const at = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  const out = { ok: true, ran: false, built: [], failed: [], healed: [], files: 0, bytes: 0 };
  let puts = 0;
  if (!reach(worker)) return out;
  out.ran = true;
  let owed;
  try {
    const read = publication.caseFilesOwed({ now: at, limit: CASEFILE_SWEEP_EDITIONS });
    owed = Array.isArray(read) ? read : Array.isArray(read && read.editions) ? read.editions : [];
  } catch (e) { return { ...out, ok: false, reason: "OWED_UNREADABLE", detail: errorText(e) }; }
  const iso = new Date(at).toISOString();
  for (const e of owed.slice(0, CASEFILE_SWEEP_EDITIONS)) {
    if (out.files >= CASEFILE_SWEEP_FILES || out.bytes >= CASEFILE_SWEEP_BYTES) break;
    const id = caseOf(e), ed = Number(e.edition);
    try {
      const cs = stateOf(id, ed);
      if (!cs || !cs.complete) continue;
      /* The materials first. What the evidence store ANSWERED absent is told to the assembly (`prior.absent`), which records
         `failed` `MATERIAL_MISSING` and lets the ledger's writer stop the edition at the bound; a copy that failed is not
         an absence and never counts toward it. */
      const copy = await copyMaterialsDetailed(worker.env, worker.storeName, materialsOf(id, ed));
      /* Then the member findings (G57): what the act's own copy did not store. Not complete this tick (the bound): nothing is
         assembled or recorded, the edition stays due and the next tick goes on. */
      const heal = await healFindings({ cs, worker, textAt, puts, bytes: out.bytes });
      if (heal) {
        out.files += heal.examined; out.bytes += heal.bytes; puts += heal.copied;
        if (heal.copied || heal.unreadable || heal.error) {
          const line = { case: id, edition: ed, examined: heal.examined, copied: heal.copied, bytes: heal.bytes, unreadable: heal.unreadable };
          out.healed.push(heal.error ? { ...line, error: heal.error } : line);
          try { console.log(JSON.stringify({ event: "casefile_heal", ...line, ...(heal.error ? { error: heal.error } : {}) })); } catch { /* a log changes nothing */ }
        }
        if (heal.incomplete) continue;
      }
      const container = await assembleEdition({ assemble, recordFailure, env: worker.env, stub: worker.stub,
        storeName: worker.storeName, cs, via: "casefilesweep",
        prior: priorOf({ missing: copy.missing, absent: copy.absent, copyError: heal && heal.error }) });
      const outcome = outcomeOf(cs, container);
      (outcome.built ? out.built : out.failed).push(outcome);
      out.files += Number(container && container.files) || 0;
      out.bytes += Array.isArray(container && container.part_addresses)
        ? container.part_addresses.reduce((n, p) => n + (Number(p && p.bytes) || 0), 0) : 0;
    } catch (x) {
      try { publication.recordCaseFileAttempt({ caseId: id, edition: ed, state: "failed", at: iso,
                                                why: { code: "UNKNOWN", step: "build", error: errorText(x) } }); } catch { /* the edition stays owed */ }
      out.failed.push({ case: id, edition: ed, built: false, code: "UNKNOWN" });
    }
  }
  return out;
}

/** R57: when the sweep next has work, in ms: now while an owed edition is due, else the ledger's earliest next try, else
 *  null (nothing owed, or no reach to the published bucket from here). Never throws. */
export function wakeOfCaseFiles({ publication, worker, now }) {
  try {
    if (!reach(worker)) return null;
    const at = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
    const due = publication.caseFilesOwed({ now: at, limit: 1 });
    if ((Array.isArray(due) ? due : Array.isArray(due && due.editions) ? due.editions : []).length) return at;
    const next = publication.caseFileNextAt();
    const t = typeof next === "number" ? next : Date.parse(next);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}
