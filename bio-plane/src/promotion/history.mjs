/* The checks that read a bundle's record of promotions, moved here from the catalogue (K64): C-20.1 (a mechanical
 * promotion held to its operation's field set and envelope), C-17.2 (a pending package's divergence classified on the
 * I-17 ladder) and C-4.2 (a document's own state history, read against the record). Requirements R30 and R32.
 *
 * WRITE ORDER (R30, record-core R16 as K65 states it): the history manifest lists entries by key, each carrying `seq`,
 * its write-order rank. A walk that needs "the promotion before" takes `seq` order, never key order, whose lexical
 * order is not a clock. An image with no `seq` on every entry is still walked, in key order, and the finding says so. */

import { parseFrontmatter, canonicalJson, normalizeType, STATES } from "../record-grammar/index.mjs";
import { EMPTY_STRING_SHA } from "../record-core/index.mjs";

const f = (check, severity, message, repairs) => ({ check, severity, message, ...(repairs ? { repairs } : {}) });
const asText = (v) => (typeof v === "string" ? v : new TextDecoder().decode(v));
const readJson = (files, path) => {
  const raw = files.get(path);
  if (raw == null) return { absent: true };
  try { return { value: JSON.parse(asText(raw)) }; } catch { return { unreadable: true }; }
};

/** The history manifest's entries in write order (`seq` on every entry, all distinct), else key order. */
export function historyWriteOrder(raw) {
  const list = Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
  const seqs = list.map((e) => e.seq);
  const write = list.length > 0 && seqs.every((s) => Number.isSafeInteger(s)) && new Set(seqs).size === list.length;
  return write ? { order: "write", entries: [...list].sort((a, b) => a.seq - b.seq) }
               : { order: "key", entries: [...list].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) };
}

/* ------------------------------------------------------------------------------------------------ C-20.1 */

/** Per-operation closed field sets (daemon slate Section 0), the registry C-20.1 and R8 read: a mechanical promotion
 *  names one of these operations and changes only its fields. `last_updated` rides every mutating set: the
 *  write-completeness law (C-12.1, C-13.2) makes it inseparable from any update. Front-matter paths in dotted form;
 *  `clock[]` denotes clock entry fields. Moved here from the catalogue in T18 (K636); the catalogue's copy was deleted in
 *  T19 (K750), so this is the one registry. */
export const MECHANICAL_FIELD_SETS = Object.freeze({
  "monitor-tick": Object.freeze(["source_status", "monitoring.last_checked", "reeval_pending.flag", "reeval_pending.since",
                                 "reeval_pending.source", "last_updated"]),
  "sweep": Object.freeze([]),
  "deadline-recheck": Object.freeze(["clock[].status", "last_updated"]),
  "member-attest": Object.freeze(["last_updated"]),
});

/** Append-only surfaces a mechanical writer may add to, beyond bundle.md and snapshots/ (daemon slate Section 0;
 *  data/snapshot-manifest.json joined with capture fidelity, 0.36.0). */
export const MECHANICAL_APPEND_FILES = ["data/changes.json", "data/provenance.json", "data/snapshot-manifest.json"];

/* Front matter as dotted scalar paths; maps one level deep, everything else by canonical JSON at its key. */
function flattenFm(fm) {
  const out = {};
  if (!fm || typeof fm !== "object") return out;
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) for (const c of Object.keys(v)) out[k + "." + c] = canonicalJson(v[c]);
    else out[k] = canonicalJson(v);
  }
  return out;
}
/* The dotted paths whose values differ; `clock` compared entry by entry, field by field. */
function fmDiffPaths(prevFm, nextFm) {
  const changed = new Set();
  const a = flattenFm(prevFm), b = flattenFm(nextFm);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "clock") {
      const pc = Array.isArray(prevFm.clock) ? prevFm.clock : [], nc = Array.isArray(nextFm.clock) ? nextFm.clock : [];
      for (let i = 0; i < Math.max(pc.length, nc.length); i++) {
        const pe = pc[i] || {}, ne = nc[i] || {};
        for (const field of new Set([...Object.keys(pe), ...Object.keys(ne)]))
          if (canonicalJson(pe[field]) !== canonicalJson(ne[field])) changed.add("clock[]." + field);
      }
      continue;
    }
    if (a[k] !== b[k]) changed.add(k);
  }
  return changed;
}
/* Body sections keyed by heading. */
function bodySections(body) {
  const out = {}, starts = [];
  const re = /^## .*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) starts.push({ h: m[0].trimEnd(), i: m.index });
  for (let i = 0; i < starts.length; i++) out[starts[i].h] = body.slice(starts[i].i, i + 1 < starts.length ? starts[i + 1].i : body.length);
  return out;
}

/* R30 (N631, K1718): whether promotion `e` wrote `name`, judged against e's own pre-image snapshot alone (the live
   files R3 copied into history under e's key), never against the previous promotion's recorded entry. `wrote` when
   the name is absent from that snapshot (new) or its copy's digest differs from the digest e's record states;
   `carried` when they agree; `undetermined` (R37) when a side cannot be read: the snapshot lists the name but the
   image holds no copy, or no digest of the copy or of what e wrote is stated. A copy held as a blob is compared by
   its stated digest (`raw`, the image's reference), never fetched. */
/* A file's copy under snap key K, as record-core R15 names it in the image: the key in the file name, before the
   extension (`data/dataset.json` → `_history/data/dataset_K.json`), the form C-12.2 reads. */
const snapCopyPath = (path, key) => {
  const cut = path.lastIndexOf("/"), dir = path.slice(0, cut + 1), name = path.slice(cut + 1), dot = name.lastIndexOf(".");
  return dot === -1 ? `_history/${dir}${name}_${key}` : `_history/${dir}${name.slice(0, dot)}_${key}${name.slice(dot)}`;
};
async function writtenBy(e, x, { files, raw, sha256 }) {
  const name = x && x.name;
  const copy = snapCopyPath(String(name), e.key);
  const listed = Array.isArray(e.snapshotted) ? e.snapshotted.includes(name) : null;
  const ref = raw && raw[copy] && typeof raw[copy] === "object" ? raw[copy] : null;
  const held = files.has(copy) || ref !== null;
  if (!held) return listed ? { undetermined: "the pre-image snapshot lists it, but the image holds no copy" } : { wrote: true };
  const was = files.has(copy) ? await sha256(files.get(copy)) : (ref.sha256 || ref.blobSha || null);
  const now = typeof x.sha256 === "string" && x.sha256 ? x.sha256 : null;
  if (!was) return { undetermined: "its pre-image copy states no digest" };
  if (!now) return { undetermined: "the promotion's record states no digest for it" };
  return was.toLowerCase() === now.toLowerCase() ? { carried: true } : { wrote: true };
}

/** C-20.1 (R30): every mechanical promotion with a recoverable pre-image stays within its operation's declared field
 *  set, touches only the Session Log in the body, and writes only inside the mechanical envelope; a file it carried
 *  unchanged from its own pre-image is not written (N631). `raw`, optional, is the image as given, whose blob
 *  references state a held copy's digest. */
export async function checkMechanicalConformance({ files, raw = null, sha256 }, findings) {
  const man = readJson(files, "_history/manifest.json");
  if (!man.value) return;
  const { order, entries } = historyWriteOrder(man.value.entries);
  if (order !== "write" && entries.length > 1)
    findings.push(f("C-20.1", "info", "the history manifest carries no write order (a seq on every entry), so mechanical promotions were audited in snap-key order, which is not a clock: \"prior\" may not be the snapshot written before (I-20)",
      ["re-export the record from a plane that writes seq into _history/manifest.json"]));
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || e.kind !== "promotion" || !e.key) continue;
    const r = readJson(files, `_history/promotion_${e.key}.json`);
    if (!r.value) continue;                                   // C-12.2 reports a missing record
    const rec = r.value, man2 = rec.manifest || rec;
    if ((man2.writer || rec.writer) !== "mechanical") continue;
    const op = man2.operation || rec.operation;
    if (!op || !Object.prototype.hasOwnProperty.call(MECHANICAL_FIELD_SETS, op)) {
      findings.push(f("C-20.1", "error", `history entry '${e.key}' is marked mechanical but names undeclared operation '${op}'`,
        ["a mechanical promotion must name a registered operation", "if hand-authored, remove the mechanical marker"]));
      continue;
    }
    /* `bundle_<key>.md` is the pre-image promotion <key> took: the state before e is e's own snapshot (absent for a
       creation), the state after it the pre-image of the next promotion, in write order, that touched bundle.md, or
       live while live still hashes to what e wrote. A gap makes the post state unknowable: skip, never blame. */
    const preSnapPath = `_history/bundle_${e.key}.md`;
    const preSnap = files.has(preSnapPath) ? files.get(preSnapPath) : null;
    const isCreation = man2.base === EMPTY_STRING_SHA || preSnap === null;
    let postRaw = null, postUnknowable = false;
    for (let j = i + 1; j < entries.length; j++) {
      const p = `_history/bundle_${entries[j].key}.md`;
      if (files.has(p)) { postRaw = files.get(p); break; }
      if ((entries[j].files || []).includes("bundle.md")) { postUnknowable = true; break; }
    }
    if (postRaw === null && !postUnknowable) {
      const live = files.get("bundle.md");
      if (live) {
        const rb = Array.isArray(man2.files) ? man2.files.find((x) => x && x.name === "bundle.md") : null;
        if (rb && rb.sha256) { if (await sha256(live) === rb.sha256) postRaw = live; }
        else postRaw = live;
      }
    }
    if (!postRaw) continue;
    const post = parseFrontmatter(asText(postRaw));
    if (isCreation) {
      if (post.data && post.data.current_state && post.data.current_state !== "collected" && post.data.object_type === "information")
        findings.push(f("C-20.1", "error", `mechanical creation '${e.key}' lands at '${post.data.current_state}', not collected (daemon creations never elevate)`,
          ["re-produce the creation at collected", "if a member released it, the release transition must be a separate member-authored promotion"]));
      continue;
    }
    const prev = parseFrontmatter(asText(preSnap));
    const allowed = new Set(MECHANICAL_FIELD_SETS[op]);
    for (const path of fmDiffPaths(prev.data || {}, post.data || {}))
      if (!allowed.has(path))
        findings.push(f("C-20.1", "error", `mechanical '${op}' promotion '${e.key}' changed frontmatter '${path}', outside its declared field set {${[...allowed].join(", ")}}`,
          ["revert the out-of-envelope change", "if the change is legitimate, it belongs to a member-authored promotion, not a mechanical one"]));
    const prevSec = bodySections(prev.body || ""), postSec = bodySections(post.body || "");
    for (const h of new Set([...Object.keys(prevSec), ...Object.keys(postSec)])) {
      if (h === "## Session Log") continue;
      if ((prevSec[h] || "") !== (postSec[h] || ""))
        findings.push(f("C-20.1", "error", `mechanical '${op}' promotion '${e.key}' changed body section '${h}'; a mechanical writer touches only the Session Log`,
          ["revert the body change outside the Session Log"]));
    }
    for (const x of (Array.isArray(man2.files) ? man2.files.map((x) => (typeof x === "string" ? { name: x } : x)) : [])) {
      const name = x && x.name;
      if (name === "bundle.md" || String(name).startsWith("snapshots/") || MECHANICAL_APPEND_FILES.includes(name)) continue;
      const w = await writtenBy(e, x, { files, raw, sha256 });
      if (w.carried) continue;
      if (w.undetermined)
        findings.push(f("C-20.1", "warn", `mechanical '${op}' promotion '${e.key}' named '${name}', outside the mechanical envelope, and whether it wrote it is undetermined: ${w.undetermined}`,
          ["re-export the record with the pre-image copy and the promotion's per-file digests, so the carry can be compared"]));
      else
        findings.push(f("C-20.1", "error", `mechanical '${op}' promotion '${e.key}' wrote '${name}', outside the mechanical envelope (bundle.md, snapshots/, ${MECHANICAL_APPEND_FILES.join(", ")})`,
          ["revert the out-of-envelope write"]));
    }
  }
}

/* ------------------------------------------------------------------------------------------------ C-17.2 */

/** The I-17 divergence ladder's mechanical rung (State Rules 5.5), walking the recorded chain in write order: a pending
 *  package whose base is not live is `disjoint-auto` only when the base resolves in recorded history and the
 *  package's files are disjoint from every intervening promotion's; otherwise `adjudicated`, with the reason. */
export function classifyDivergence(man, files) {
  const hist = readJson(files, "_history/manifest.json");
  if (hist.absent) return { rung: "adjudicated", reason: "no history manifest: disjointness unverifiable" };
  if (!hist.value) return { rung: "adjudicated", reason: "history manifest unreadable" };
  const { order, entries } = historyWriteOrder(hist.value.entries);
  const walked = entries.length;
  if (!walked) return { rung: "adjudicated", reason: "history manifest has no entries", order, walked };
  /* Anchor the base: (a) it was live just before promotion i (intervening = i..), or (b) it is what promotion i wrote
     (intervening = i+1..); the latest match keeps the intervening set smallest. */
  let start = -1, anchor = null, recordGap = false;
  for (let i = 0; i < walked; i++) if (entries[i].base === man.base) { start = i; anchor = `before ${entries[i].key}`; }
  for (let i = 0; i < walked; i++) {
    const r = readJson(files, `_history/promotion_${entries[i].key}.json`);
    if (!r.value) { recordGap = true; continue; }
    const b = Array.isArray(r.value.files) ? r.value.files.find((x) => x && x.name === "bundle.md") : null;
    if (b && b.sha256 === man.base && i + 1 > start) { start = i + 1; anchor = `after ${entries[i].key}`; }
  }
  if (start === -1)
    return { rung: "adjudicated", order, walked, reason: recordGap
      ? "package base not found in recorded history (and some promotion records are missing or unreadable: chain incomplete)"
      : "package base not found anywhere in recorded history" };
  const intervening = entries.slice(start);
  if (!intervening.length) return { rung: "adjudicated", reason: "base resolves to the chain tail yet live differs: unrecorded live edit", order, walked };
  const interveningFiles = new Set();
  for (const e of intervening) for (const n of (e.files || [])) interveningFiles.add(n);
  const names = Array.isArray(man.files) ? man.files.map((e) => e && e.name) : [];
  const overlap = names.filter((n) => interveningFiles.has(n));
  if (overlap.length) return { rung: "adjudicated", reason: `overlapping substantive divergence on {${overlap.join(", ")}}`, interveningFiles, order, walked };
  return { rung: "disjoint-auto", baseKey: anchor, intervening: intervening.map((e) => e.key), interveningFiles, order, walked };
}

/** C-17.2 (R30): a pending package (`PENDING_PROMOTION.json`) whose base is not live bundle.md is classified. */
export async function checkDivergence({ files, sha256 }, findings) {
  const pending = readJson(files, "PENDING_PROMOTION.json");
  if (!pending.value || typeof pending.value !== "object") return;       // C-16.1/C-16.4 report the rest
  const man = pending.value;
  const live = files.get("bundle.md");
  if (!live || typeof man.base !== "string" || await sha256(live) === man.base) return;
  const cls = classifyDivergence(man, files);
  if (cls.order === "key" && cls.walked > 1)
    findings.push(f("C-17.2", "info", "the history manifest carries no write order (a seq on every entry), so the divergence was classified in snap-key order, which is not a clock: its anchor and intervening set may not be the ones written (I-20)",
      ["re-export the record from a plane that writes seq into _history/manifest.json"]));
  const names = Array.isArray(man.files) ? man.files.map((e) => e && e.name) : [];
  if (cls.rung === "disjoint-auto")
    findings.push(f("C-17.2", "info", `divergence classified disjoint-auto: base found in history at ${cls.baseKey}; intervening promotion(s) [${cls.intervening.join(", ")}] touched {${[...cls.interveningFiles].join(", ")}}, package touches {${names.join(", ")}}, sets disjoint; apply in sequence recording both bases`,
      ["apply-disjoint: promote in sequence, recording base and applied-over in the history manifest entry"]));
  else
    findings.push(f("C-17.2", "warn", `divergence classified adjudicated: ${cls.reason}`,
      ["rebase via a reconciliation session", "supersede: human selects one, the other preserved as a diverged branch in _history", "apply-disjoint only if re-examination shows the overlap illusory"]));
}

/* ------------------------------------------------------------------------------------------------ C-4.2 */

/** The date each type's state-edge fence took effect (R15): bias sets' on 2026-09-24 (D-468), every other type's
 *  with this module's R15, 2026-09-26, and projects' again on 2026-10-01 (R56, N456), when the hand-written stage left
 *  the table and `forming -> investigating`, `investigating -> matured` and `closed -> investigating` stopped being
 *  edges. A move "under earlier rules" is one dated at or before its type's fence. */
export const STATE_MOVE_FENCED_SINCE = { bias: "2026-09-24", project: "2026-10-01", "*": "2026-09-26" };
const own = (o, k) => (o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const fenceOf = (t) => own(STATE_MOVE_FENCED_SINCE, t) ?? STATE_MOVE_FENCED_SINCE["*"];

/** The record's own state moves for a bundle, from its image: consecutive recorded versions of bundle.md, in write
 *  order, whose `current_state` differs, where the later promotion's base is the bundle.md digest the earlier one's
 *  record says it wrote (the chain the compare-and-swap enforced). Each is `{from, to, date, key}`, dated by the
 *  later promotion's manifest `created`. A pair with a side unrecorded, or that does not join, is no move. */
export function recordedMoves(files) {
  const man = readJson(files, "_history/manifest.json");
  if (!man.value) return [];
  const { entries } = historyWriteOrder(man.value.entries);
  const wrote = (e) => {
    const r = readJson(files, `_history/promotion_${e.key}.json`);
    const b = r.value && Array.isArray(r.value.files) ? r.value.files.find((x) => x && x.name === "bundle.md") : null;
    return b && typeof b.sha256 === "string" && b.sha256 ? b.sha256.toLowerCase() : null;
  };
  const stateOf = (raw) => {
    if (typeof raw !== "string") return null;              // absent, or held as a blob: unrecorded
    const fm = parseFrontmatter(raw).data;
    return fm && typeof fm === "object" && typeof fm.current_state === "string" ? fm.current_state : null;
  };
  const after = entries.map((e, j) => (j === entries.length - 1 ? files.get("bundle.md") : files.get(`_history/bundle_${entries[j + 1].key}.md`)));
  const moves = [];
  for (let j = 1; j < entries.length; j++) {
    const w = wrote(entries[j - 1]);
    if (w === null || w !== String(entries[j].base ?? "").toLowerCase()) continue;
    const a = stateOf(after[j - 1]), z = stateOf(after[j]);
    if (a && z && a !== z) moves.push({ from: a, to: z, date: entries[j].created ?? null, key: entries[j].key });
  }
  return moves;
}

/** C-4.2 (R32): each entry of the document's own `state_history` is whole, in order, along a declared edge, and the
 *  last one agrees with `current_state` and `prior_state`. An undeclared edge is an error, read as a move made under
 *  earlier rules (info) only where the record's own history holds the same move dated at or before its type's fence;
 *  the entry's own timestamp, a writer's, never earns that reading. Each recorded move corroborates one entry. */
export function checkStateHistory({ fm, files }, findings) {
  if (!fm || typeof fm !== "object") return;
  const ot = fm.object_type;
  /* A type the state tables do not hold as their own (R32, T39): an inherited key (`toString`, `constructor`,
     `__proto__`) names no table, so it is answered as any type with none, no finding of C-4.2's; the type check is the
     catalogue's. `vocabFor`'s lookup (the name, else its alias), held to own keys. */
  const key = own(STATES, ot) !== undefined ? ot : normalizeType(ot);
  const spec = own(STATES, key);
  if (!spec || own(spec, "edges") === undefined) return;
  const hist = Array.isArray(fm.state_history) ? fm.state_history : [];
  const fence = fenceOf(normalizeType(ot));
  const corroborating = hist.length ? recordedMoves(files) : [];
  let prevTs = null;
  for (let i = 0; i < hist.length; i++) {
    const e = hist[i];
    /* An entry that is not an object is refused by the catalogue's C-2.6 walk, whose timestamp arm needs that guard
       and keeps it (the one C-4.2 arm left in `checkStateLegality`); it is not said twice. */
    if (typeof e !== "object" || e === null) continue;
    for (const k of ["timestamp", "from_state", "to_state", "blurb", "author"])
      if (!(k in e)) findings.push(f("C-4.2", "error", `state_history[${i}] missing '${k}'`));
    if (prevTs && e.timestamp && e.timestamp < prevTs) findings.push(f("C-4.2", "error", `state_history[${i}] is out of chronological order`));
    prevTs = e.timestamp || prevTs;
    const edges = own(spec.edges, e.from_state);
    if (Array.isArray(edges) && !edges.includes(e.to_state)) {
      const k = corroborating.findIndex((m) => m.from === e.from_state && m.to === e.to_state
        && typeof m.date === "string" && m.date.slice(0, 10) <= fence);
      if (k >= 0) {
        const m = corroborating.splice(k, 1)[0];
        findings.push(f("C-4.2", "info", `transition ${e.from_state} -> ${e.to_state} is not a legal ${ot} edge: made by a path the current rules do not allow (at or before ${fence}); the record's own history holds the same move (promotion ${m.key}), dated by its writer ${m.date}`));
      } else findings.push(f("C-4.2", "error", `transition ${e.from_state} -> ${e.to_state} is not a legal ${ot} edge`));
    }
  }
  if (hist.length > 0) {
    const last = hist[hist.length - 1];
    if (last && typeof last === "object") {
      if (last.to_state !== fm.current_state) findings.push(f("C-4.2", "error", `current_state '${fm.current_state}' disagrees with last transition to '${last.to_state}'`));
      if (fm.prior_state !== last.from_state) findings.push(f("C-4.2", "error", `prior_state '${fm.prior_state}' disagrees with last transition from '${last.from_state}'`));
    }
  } else if (fm.prior_state !== null && fm.prior_state !== undefined) {
    findings.push(f("C-4.2", "error", `prior_state is '${fm.prior_state}' but state_history is empty (expected null)`));
  }
}
