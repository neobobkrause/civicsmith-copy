/* public-read — THE CASE FILE (requirements: `build/requirements/public-read.md` R5, R6, R23, R24; `case-grammar` R13, R14,
 * R17; DEC-112 (2), (3); Publication §5C; K1315, K1316). What a published case edition carries so that anybody can check
 * it, and recreate its findings, without this instance: the signed case document and its signature, the complete
 * edition, each finding's published bytes, signature, grading facts and passages, every included material whole with its
 * extracted text, each material carried only as its copy (a photo's, or a member document's cleaned copy) as that
 * copy (never its original), the attestations, each calculation with every input it names, and the signing keys. Built once, by the Worker's assembly (`assembleCaseContainer`,
 * `../publication/worker.mjs`), from what the published projection holds (`PublicRead.caseFileFacts`) and the published
 * bucket; served part by part (`op=publishedbytes&sha256=<manifest>&format=zip&part=<n>`).
 *
 * THE FORMAT IS `case-grammar`'s (its R13, `CASE_FILE_FORMAT`; a stored `bio-case-file/1`, `/2` or `/3` is served as written): every path is `caseFilePath`'s, the manifest is
 * `CASE_FILE_MANIFEST_PATH` at each part's root, the files are listed in path order and each part's digest is
 * `casePartDigest`'s; this file writes the format and decides nothing it states. A `ref` on two or more rows of the case document
 * names each of its files by the row's capture (`materials/<ref>/<sha>/<leaf>`), and a case file with such a path states
 * `bio-case-file/4` (G50; `caseFileFormatFor`); every other keeps `/3`. What is this module's (K1315, reported):
 * each file sits at its path directly under the part's root; an attestation is named `<n>-<by_kind>.json` under its
 * material's ref, `n` its place among that material's rows; a key is written on one line as `<type> <base64>`.
 *
 * PARTS (R5, R23). Each part is a stored ZIP (`../container.mjs`, the plane's one serialiser) carrying the same
 * manifest at its root; files go into parts in manifest order and a new part opens before a file that would take the
 * part past the bound (64 MiB, R5). A file larger than the bound sits alone in its part, which then answers
 * `CONTAINER_TOO_LARGE` (C-98.7) at the zip while the file is still served by its own hash: a case file is never refused
 * for its size and nothing is left out. */

import { word, localize } from "../setup-words/index.mjs";
import { canonicalJson } from "../record-grammar/index.mjs";
import { CASE_FILE_FORMAT, CASE_FILE_FORMATS_ACCEPTED, CASE_FILE_MANIFEST_PATH, caseFilePath, caseFileEntryOf, casePartDigest, completeEditionOf,
         calculationFileText, provOf } from "../case-grammar/index.mjs";
import * as grammar from "../case-grammar/index.mjs";
import { CONTAINER_MAX_BYTES } from "../container.mjs";

/** R44 (G121): the most R2 calls of one kind in flight at once: the case file's reads of materials, and the writes of its files. */
export const CASEFILE_GROUP = 8;

/** R44 (G121b): a window of `CASEFILE_GROUP` calls that slides, so the next call starts the moment one ends and no call waits for a
 *  group's slowest. Runs `fn(item)` over `items`, at most `width` at a time, in order of start; answers the settled results in the
 *  items' order (`{status, value | reason}`), never throws, and starts no further call once one has failed (those in flight finish). */
export async function inWindow(items, fn, width = CASEFILE_GROUP) {
  const out = new Array(items.length);
  let next = 0, failed = false;
  const lane = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await fn(items[i], i) }; } catch (reason) { failed = true; out[i] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  return out;
}

/** R44 (G121b): an object this small is written without asking after it first (its key is its hash, so the same bytes again change
 *  nothing); a larger one is asked after, so a big file already held is not sent again. Proposed; BOB records. */
export const CASEFILE_BLIND_PUT_MAX = 256 * 1024;

const enc = new TextEncoder();
const utf8 = (s) => enc.encode(String(s));

export async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const b64 = (bytes) => { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => { try { return Uint8Array.from(atob(String(s)), (ch) => ch.charCodeAt(0)); } catch { return null; } };

/** A signing key's fingerprint as `ssh-keygen -l` prints it: `SHA256:` and the unpadded base64 of the SHA-256 of the key's
 *  wire bytes; null for a key that is not base64. */
export async function keyFingerprint(keyB64) {
  const raw = unb64(keyB64);
  if (!raw || !raw.length) return null;
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return `SHA256:${b64(d).replace(/=+$/, "")}`;
}

/* R23 (T37; T39, N806): why a material is named unheld: its bytes are those of a material this edition carries as its
   copy (a photo, or a member document). */
export const ORIGINAL_NOT_CARRIED = word("public-read.bytes_material_case");
export const ARCHIVE_HOLDS_ORIGINAL = word("public-read.archive_holds_material");

/* R6: the assembly's one statement that it built nothing, naming what it could not read. */
const notAssembled = (cause, what) => ({ ok: false, reason: "CASE_FILE_NOT_ASSEMBLED", cause, ...what,
  detail: localize("public-read.casefile.the_case_edition_is_published", "the case edition is published and its findings answer by hash; its case file was not built, because it would have left out something it must carry. Nothing was recorded for it.") });

/** A signing key on one line, as an SSH public key is written: its type (the wire blob's first string) and its base64. */
export function keyLine(keyB64) {
  const raw = unb64(keyB64);
  if (!raw || raw.length < 4) return String(keyB64 ?? "");
  const n = ((raw[0] << 24) | (raw[1] << 16) | (raw[2] << 8) | raw[3]) >>> 0;
  const type = n > 0 && n < 64 && raw.length >= 4 + n ? new TextDecoder().decode(raw.slice(4, 4 + n)) : "";
  return /^[a-z0-9@.-]+$/.test(type) ? `${type} ${keyB64}` : String(keyB64);
}

/* What `serialiseContainer` counts for one entry: its payload and both headers' copies of its name. */
const entryCost = (name, bytes) => bytes + utf8(name).length * 2 + 76;

/** R23, R24, R6: the case file for one case edition, from `facts` (`PublicRead.caseFileFacts`, the published projection)
 *  and `read(sha)` (the published bucket's bytes by hash, or null). `group` is the publishing group's slug. Answers
 *  `{ok: true, manifest, files: [{path, kind, sha256, bytes, part, content}], unheld}`, `unheld` naming each included
 *  material the projection holds no bytes for at its stated digest (the checker then shows it missing, K1316), and each
 *  obscured copy not held at its digest (T37); or
 *  `CASE_FILE_NOT_ASSEMBLED` naming what it could not read, where a part a finding published cannot be read at its hash
 *  or the signed document's bytes do not hash to its digest: a case file that would leave out what it must carry is
 *  never built. It is a statement inside an act that has committed, never a refusal (R6). `maxBytes` is the part bound
 *  (R5). */
export async function buildCaseFile({ facts, group = null, read: readStore, maxBytes = CONTAINER_MAX_BYTES }) {
  const files = [];
  /* G50 (B): one file at one path is listed once (a shared archive two captures reach, the same copy two rows name); a
     second file at the same path with other bytes is kept, and the case file's own check then states the repeated path. */
  const add = async (path, kind, content) => {
    const sha256 = await sha256Hex(content);
    if (typeof path === "string" && files.some((f) => f.path === path && f.sha256 === sha256)) return;
    files.push({ path, kind, sha256, bytes: content.length, content });
  };
  const docBytes = utf8(facts.document.text);
  if ((await sha256Hex(docBytes)) !== facts.document.doc_sha)
    return notAssembled(localize("public-read.casefile.signed_document_text_does_not", "the signed case document's text does not hash to its digest"), { sha256: facts.document.doc_sha });
  await add(caseFilePath("case_document"), "case_document", docBytes);
  await add(caseFilePath("case_signature"), "case_signature", utf8(facts.document.sig_armored ?? ""));

  /* R44 (G121): every object the assembly will read is read first, in groups of 8, each answer (or throw) kept by its hash and
     handed back at the place that asks for it, so the files, the `unheld` list and every statement are what the one-at-a-time
     read gave, in the same order, and a read that threw throws where it was asked. */
  const wanted = [];
  const inline = (sha, text) => { if (text == null) wanted.push(sha); };
  for (const f of facts.findings) if (f.published) inline(((f.published.parts || []).find((x) => x && x.sha256 === f.published.bundle_sha) ?? { sha256: f.published.bundle_sha }).sha256);
  for (const m of facts.materials) {
    if (m.original_of_copy || m.capture_invalid) continue;
    inline(m.sha, m.bytes_text);
    if (m.kind !== "observation") inline(m.text_sha, m.extracted_text);
    if (m.kind !== "observation") for (const a of m.archives || []) if (a.registered !== false) inline(a.sha, a.text);
  }
  for (const o of facts.obscured || []) if (o.registered && !o.capture_invalid) wanted.push(o.copy);
  for (const a of facts.attestations) for (const t of a.held || []) inline(t.sha, t.text);
  for (const c of facts.calculations || []) for (const i of c.inputs || []) inline(i.sha, i.text);
  const fetched = new Map();
  const todo = [...new Set(wanted)].filter((sha) => /^[0-9a-f]{64}$/.test(String(sha ?? "")));
  await inWindow(todo, async (sha) => {
    try { fetched.set(sha, { bytes: await readStore(sha) }); } catch (error) { fetched.set(sha, { error }); }
  });
  const read = async (sha) => {
    const got = fetched.get(sha);
    if (!got) return readStore(sha);
    if (got.error) throw got.error;
    return got.bytes;
  };

  for (const f of facts.findings) {
    const at = (kind) => caseFilePath(kind, f.bundle_id);
    if (f.published) {
      /* A finding's published bytes are its `bundle.md` (the part its signature covers, at `bundle_sha`). */
      const p = (f.published.parts || []).find((x) => x && x.sha256 === f.published.bundle_sha)
        ?? { path: "bundle.md", sha256: f.published.bundle_sha };
      const bytes = await read(p.sha256);
      if (!bytes || (await sha256Hex(bytes)) !== p.sha256)
        return notAssembled(localize("public-read.casefile.a_finding_s_published_bytes", "a finding's published bytes are not in the published object store at their hash"),
                            { finding: f.bundle_id, sha256: p.sha256 });
      await add(at("finding"), "finding", bytes);
      if (f.published.sig_armored) await add(at("finding_signature"), "finding_signature", utf8(f.published.sig_armored));
    }
    await add(at("grading_facts"), "grading_facts", utf8(canonicalJson(facts.grading[f.bundle_id] || [])));
    await add(at("passages"), "passages", utf8(canonicalJson(facts.passages[f.bundle_id] || [])));
  }

  /* Included material, whole, each at the digest the signed document states: bytes that do not hash to it are not
     carried (never the wrong bytes under a right name), and the material is named in `unheld`. */
  const unheld = [];
  const held = async (sha, inline) => {
    if (!/^[0-9a-f]{64}$/.test(String(sha ?? ""))) return null;
    const bytes = inline != null ? utf8(inline) : await read(sha);
    return bytes && (await sha256Hex(bytes)) === sha ? bytes : null;
  };
  /* G50 (B): the key a material's files are spelled by: the `ref`, or `[ref, capture]` for a `ref` on several rows (`facts`
     states the row's `capture`); a row whose capture is not a sha (`capture_invalid`) has none to spell, so none of its files
     is carried at a plain path: each is named in `unheld`. */
  const keyOf = (m) => (m.capture ? [m.ref, m.capture] : m.ref);
  for (const m of facts.materials) {
    const kind = m.kind === "observation" ? "observation" : "document";
    /* R23 (T37): bytes a material carried as its copy shares are its original's, which never travel. */
    if (m.original_of_copy) { unheld.push({ ref: m.ref, sha: m.sha ?? null, what: kind === "observation" ? "text" : "bytes",
                                            why: ORIGINAL_NOT_CARRIED }); continue; }
    const bytes = m.capture_invalid ? null : await held(m.sha, m.bytes_text);
    if (!bytes) unheld.push({ ref: m.ref, sha: m.sha ?? null, what: kind === "observation" ? "text" : "bytes", ...(m.capture_invalid ? { unspellable: true } : {}) });
    else await add(caseFilePath(kind, keyOf(m)), kind, bytes);
    if (kind === "document") {
      const tb = m.capture_invalid ? null : await held(m.text_sha, m.extracted_text);
      if (!tb) unheld.push({ ref: m.ref, sha: m.text_sha ?? null, what: "extracted_text", ...(m.capture_invalid ? { unspellable: true } : {}) });
      else await add(caseFilePath("extracted_text", keyOf(m)), "extracted_text", tb);
    }
    /* R32 (N717; K2004): a member document carried whole brings its `container` record and its archive, outward to the
       outermost, each under the material's ref (an archive named by its own SHA-256, a record by its member's, `case-grammar`
       R13) at the digest the commit registered (`PublicRead.caseFileFacts`); bytes
       that do not hash to it are not carried and are named in `unheld`, and an archive the commit did not register is
       named there too. The archive's tokens travel as today, in the material's attestation rows. */
    if (kind === "document" && bytes) for (const a of m.archives || []) {
      const ab = a.registered === false ? null : await held(a.sha, a.text);
      /* an archive the commit did not register (`case-carriage` R8 holds none that holds an image) is named but is not a material
         that went missing: `unregistered`, which no retry heals */
      if (!ab) unheld.push({ ref: m.ref, sha: a.sha ?? null, what: a.kind, ...(a.holds_original ? { why: ARCHIVE_HOLDS_ORIGINAL } : {}),
                            ...(a.registered === false && !a.holds_original ? { unregistered: true } : {}) });
      else await add(caseFilePath(a.kind, [m.ref, a.kind === "container" ? a.member : a.sha]), a.kind, ab);
    }
  }
  /* R23 (T37; N757; DEC-180 (4); T39, N806): each material carried as its copy (a photo's, or a member document's
     cleaned copy), one file of kind `obscured` under its row's ref, at the
     SHA-256 `obscured.copy` names, read by that hash from the published bucket and only where the commit registered it
     under that ref; never the original's bytes, its extracted text, or an archive or container record of it. A copy
     not registered, or whose bytes do not hash to that digest, is not carried and is named in `unheld`. */
  for (const o of facts.obscured || []) {
    const bytes = o.registered && !o.capture_invalid ? await held(o.copy) : null;
    if (!bytes) unheld.push({ ref: o.ref, sha: o.copy ?? null, what: "obscured", ...(o.capture_invalid ? { unspellable: true } : {}) });
    else await add(caseFilePath("obscured", keyOf(o)), "obscured", bytes);
  }
  /* R33 (K2129): the edition's criteria rows exactly as R31 answers them, once, in canonical JSON; none for an edition
     whose criteria were not recorded (committed before T35). */
  if (Array.isArray(facts.criteria)) await add(caseFilePath("criteria"), "criteria", utf8(canonicalJson(facts.criteria)));
  const nth = new Map();
  for (const a of facts.attestations) {
    const n = (nth.get(a.row.ref) || 0) + 1;
    nth.set(a.row.ref, n);
    const carried = [];
    for (const t of a.held || []) {
      const bytes = await held(t.sha, t.text);
      if (bytes) carried.push({ sha256: t.sha, bytes_b64: b64(bytes) });
      else unheld.push({ ref: a.row.ref, sha: t.sha, what: "attestation" });
    }
    await add(caseFilePath("attestation", [a.row.ref, `${n}-${a.row.by_kind}.json`]), "attestation",
              utf8(canonicalJson({ row: a.row, account: a.account ?? null, held: carried })));
  }
  /* R23 (C:A-12, C:A-13; K1632): each calculation the `calculations:` block lists (`case-grammar` R18), as its row
     (`calculationFileText`, the one spelling), and each input it names under it, by the hash the row states and only at
     it (`case-grammar` R13's `calculation` kind: `calculations/<calc>/inputs/<sha256>`), so the checker recomputes it
     (`case-checker` R20); and, once, the calculations' PROV-O rendering (`provOf`, its R19). An input the published
     projection does not hold at that hash (`publication` R22 commits them at publish) is named in `unheld`, never
     carried under a wrong name. */
  const calcs = facts.calculations || [];
  for (const c of calcs) {
    const calc = c.row && c.row.calc;
    await add(caseFilePath("calculation", calc), "calculation", utf8(calculationFileText(c.row) ?? ""));
    for (const i of c.inputs || []) {
      const bytes = await held(i.sha, i.text);
      if (!bytes) { unheld.push({ ref: calc ?? null, sha: i.sha ?? null, what: "calculation_input" }); continue; }
      await add(caseFilePath("calculation", [calc, i.sha]), "calculation", bytes);
    }
  }
  if (calcs.length) await add(caseFilePath("calculation", "prov"), "calculation", utf8(provOf(calcs.map((c) => c.row))));
  const unspelled = files.filter((f) => typeof f.path !== "string");
  if (unspelled.length)
    return notAssembled(localize("public-read.casefile.a_finding_id_a_material", "a finding id, a material's ref or a calculation's id is not one the case file's format can spell as a path"),
                        { kinds: unspelled.map((f) => f.kind) });

  /* The signing keys: the case document's signer's and each finding's, once each, in the order they are met. */
  const keys = [];
  for (const k of [facts.document.key_b64, ...facts.findings.map((f) => f.published && f.published.key_b64)]) {
    if (typeof k !== "string" || !k || keys.some((x) => x.b64 === k)) continue;
    keys.push({ b64: k, key: keyLine(k), fingerprint: await keyFingerprint(k) });
  }
  /* G50 (B): `bio-case-file/4` is declared only by a case file with a path that states a capture; every other keeps `/3`. */
  const discriminated = files.some((f) => typeof f.path === "string" && caseFileEntryOf(f.path)?.capture);
  const head = { format: discriminated ? grammar.caseFileFormatFor(files.map((f) => f.path)) : CASE_FILE_FORMAT, group, case: facts.case, edition: facts.edition,
                 case_document_sha: facts.document.doc_sha,
                 keys: keys.map((k) => ({ key: k.key, fingerprint: k.fingerprint })) };

  /* R24: the complete edition, rendered by `case-grammar` from every other file (its R14). */
  const html = completeEditionOf({ ...head,
    files: files.map((f) => ({ path: f.path, kind: f.kind, sha256: f.sha256, bytes: f.bytes, content: f.content })) });
  const ce = typeof html === "string" ? utf8(html) : html instanceof Uint8Array ? html : utf8("");
  await add(caseFilePath("complete_edition"), "complete_edition", ce);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const manifestOf = (assign, count) => {
    const rows = files.map((f, j) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes, part: assign[j], kind: f.kind }));
    return { ...head,
             parts: Array.from({ length: count }, (_, i) => ({ index: i + 1, ...casePartDigest(rows, i + 1) })),
             files: rows };
  };
  /* Packing, in path order: a part's cost is its files' and the manifest's (every part carries it). The manifest's size
     depends on the packing, so the reserve grows until the packing it gives fits under it. */
  let reserve = 4096, assign = [], count = 1;
  for (let round = 0; round < 8; round++) {
    assign = []; count = 1;
    let used = 0;
    for (const f of files) {
      const c = entryCost(f.path, f.bytes);
      if (used > 0 && used + c > maxBytes - reserve) { count += 1; used = 0; }
      assign.push(count);
      used += c;
    }
    const size = entryCost(CASE_FILE_MANIFEST_PATH, utf8(JSON.stringify(manifestOf(assign, count), null, 1)).length);
    if (size <= reserve) break;
    reserve = size + 1024;
  }
  return { ok: true, manifest: manifestOf(assign, count), unheld, files: files.map((f, j) => ({ ...f, part: assign[j] })) };
}

export const isCaseFileManifest = (manifest) => !!(manifest && CASE_FILE_FORMATS_ACCEPTED.includes(manifest.format));

/** R5, R6: one part of a case file in the shape `../container.mjs`' `containerEntries` reads (its `parts[]` and
 *  `layout`), so the part is assembled, and a missing file refused `PART_MISSING` (C-98.5), at that one governed site:
 *  the part's files in manifest order, each at its path under the part's root, the manifest at that root. `index` is the part asked for, a
 *  whole number the manifest lists; any other answers null. */
export function caseFilePartLayout(manifest, index) {
  const parts = Array.isArray(manifest.parts) ? manifest.parts.map((p) => Number(p.index)) : [];
  if (!parts.includes(index)) return null;
  return { case: manifest.case,
           layout: { root: "", manifest_at: CASE_FILE_MANIFEST_PATH, parts_at: "path" },
           parts: (Array.isArray(manifest.files) ? manifest.files : [])
             .filter((f) => f && Number(f.part) === index && typeof f.path === "string" && typeof f.sha256 === "string")
             .map((f) => ({ path: f.path, sha256: f.sha256 })) };
}

/** R5: the parts a case file's manifest lists, by index. */
export const caseFileParts = (manifest) => (Array.isArray(manifest.parts) ? manifest.parts.map((p) => Number(p.index)) : []);

/* G54 (K4426, K4565, K4566, K4571): THE CASE FILE'S STATE AS THE PUBLIC READ STATES IT. The closed set of codes a failed attempt
   is stated by, the one mapping from what `publication` stored to the state and code `publishedcase` answers, and nothing
   else of the attempt: no sentence, no `step`, no `error`, no `detail` (the op is public; those stay in the row and the log).
   The reader's sentences, by state and code, are `screens-publish`'s. */
export const CASEFILE_CODES = Object.freeze(["NO_BUCKET", "STORE_SILENT", "MATERIAL_MISSING", "FINDING_MISSING", "BUCKET_FAILED",
  "NOT_RECORDED", "INTERRUPTED", "TOO_LARGE", "UNKNOWN"]);
export const CASEFILE_PUBLIC_STATES = Object.freeze(["built", "being_prepared", "retrying", "stopped", "waiting_on_members"]);
/** A `building` older than this is an attempt that was interrupted (`publication`'s `CASEFILE_BUILDING_WAIT_MS`). */
export const CASEFILE_BUILDING_STALE_MS = 120000;
const codeOf = (why) => (why && CASEFILE_CODES.includes(why.code) ? why.code : "UNKNOWN");
/** `{state, code, attempted_at, attempts}` for one case edition: `complete`, the `manifest_sha` it records, and the ledger as
 *  `publication` stores it (`casefile_state`, `casefile_attempts`, `casefile_attempted_at`, `casefile_why` as JSON text or
 *  null); `now` in milliseconds. An edition with a manifest and no ledger state (every edition before G54) is `built`. */
export function caseFileStateOf({ complete, manifest_sha = null, state = null, attempts = null, attempted_at = null, why = null }, now = Date.now()) {
  let parsed = null;
  try { parsed = typeof why === "string" && why ? JSON.parse(why) : why && typeof why === "object" ? why : null; } catch { parsed = null; }
  const n = Number(attempts) || 0;
  const out = (st, code) => ({ state: st, code, attempted_at: attempted_at ?? null, attempts: n });
  if (!complete) return out("waiting_on_members", null);
  if (state === "stopped") return out("stopped", codeOf(parsed));
  if (state === "failed") return out("retrying", codeOf(parsed));
  if (state === "building") {
    const t = Date.parse(attempted_at ?? "");
    return out("being_prepared", Number.isFinite(t) && now - t > CASEFILE_BUILDING_STALE_MS ? "INTERRUPTED" : null);
  }
  if (state === "built" || (state == null && manifest_sha)) return out("built", null);
  return out("being_prepared", null);
}
