/* ratification — the bulk release (R20–R27; N400, K583, K636): the collected-to-verified transition of many Information
 * documents at once, over a selection (Intake Doctrine §4, "What verification asserts, and batch ratification").
 * Extracted from `legacy-store` in T18 (`Store.release`, `RELEASE_ACK_MAX` and the two front-matter helpers it calls,
 * `#appendStateHistory` and `#setScalar`); the plane's op map (`plane/store.mjs`) reaches it through `ratificationOps`
 * (§12.2). The legacy code's comments moved with it. Since T19 layer 8 the bulk retirement (`./retire.mjs`, R28–R31)
 * writes each member through the same `moveMember` below, so the two transitions splice a document one way.
 *
 * S-11 step 5, the last rung of the ladder: bulk RELEASE of Information, collected -> verified over a selection, weight
 * `refuse`, the whole set examined before anything moves (the writes are per member, R25). Decided by Bob 2026-07-27 and specified in Intake Doctrine v1.2: what legitimizes a
 * bulk release is volume plus little-to-no variance in the trustworthiness of the collection, whatever origin brought
 * it in, because verification asserts only that a document APPEARS to be what it claims to be, never accuracy.
 *
 * Four properties carry the doctrine:
 * 1. A NAMED MEMBER authors it. The author stamp arrives from the session; a machine credential's stamp is refused by
 *    shape, because the collected-to-verified transition is a member's decision (section 4, C-18.1), whatever else
 *    machines may prepare.
 * 2. The ACKNOWLEDGMENT IS A RECORD, not a dialog. The member's explicit acknowledgment of the batch's homogeneity and
 *    the mitigation steps they actually took are required parameters, refused when absent, and written into every
 *    released document's Session Log, so a batch release is permanently distinguishable from a per-document one.
 * 3. CRUCIAL NEVER RIDES A BATCH. Ratifying crucial-criticality material requires verifying its co-attestations
 *    (doctrine section 3, F4), which is per-document work, and a batch containing crucial material is by definition not
 *    a low-variance collection.
 * 4. NOTHING VERIFIED HERE AUDITS DIRTY. The verified-state entry requirements — C-2.7's (well-formed content_hash,
 *    data/dataset.json, a file in snapshots/) and, as of REC-54/D-200, C-18.9's provenance chain — are checked per
 *    member BEFORE any state moves, offenders named, set refused whole (R27).
 *
 * It reads record-core's `bundles` and `files` (its R37 read contract) and writes only through `promotion`'s `promote`
 * (R24, and R30 for the retirement). `deps` is `{sql, promotion, retrieval, contradiction}` (R22's contested arm
 * reads `candidatesFor`). A refusal with a catalogue row (C-32.1, C-33.10–C-33.12, copied into `./checks.mjs`'
 * `RELEASE_CHECKS`; C-58.4, in `RATIFY_SCOPE_CHECKS`) carries its `code`, `check` and `translation` (DEC-49). */

import { parseFrontmatter, isMachineIdentity, createSha256 } from "../record-grammar/index.mjs";
import { stampInstant } from "../record-core/index.mjs";
import { rowOf } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R20. Longer than a reason, because a release acknowledgment is a statement of what was weighed and what was checked,
   not a label. Same forbidden characters, because it is spliced into the Session Log and must stay one line per
   field. */
export const RELEASE_ACK_MAX = 500;

const rows = (sql, q, ...a) => [...sql.exec(q, ...a)];
const one = (sql, q, ...a) => rows(sql, q, ...a)[0] ?? null;
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** R20–R27: release the selection `handle` from collected to verified: the whole set examined before anything moves,
 *  then written member by member (R25). `author`, `viewer` and `owner` are the control plane's stamps, never the
 *  caller's. */
export function release(deps,
                        { handle, acknowledgment = "", mitigation = "", viewer = null, owner = null, author = null } = {}) {
  const { sql, promotion, retrieval } = deps;
  const who = String(author ?? "").trim();
  /* DEC-49 REGION is-machine-release — REC-64/C-32.1. The FENCE and only the
     fence: everything below in this method is a payload complaint and not this
     family's business. D-229 measured that the two are confusable from the
     outside, which is exactly why the governed span stops here. */
  if (!who || isMachineIdentity(who))                 /* REC-46: one predicate */
    return { ok: false, reason: "MACHINE_CANNOT_RELEASE", ...rowOf("MACHINE_CANNOT_RELEASE"),
             detail: localize("ratification.release.the_collected_to_verified_transition", "the collected-to-verified transition is a named member's decision (Intake Doctrine section 4, C-18.1). A machine credential may read and may prepare the review packet, and may not release. Sign in as a member.") };
  /* END DEC-49 REGION is-machine-release */
  const ack = String(acknowledgment ?? "").trim();
  const mit = String(mitigation ?? "").trim();
  /* DEC-49 REGION is-release-account — REC-64/C-33.10-11. What the member has
     to SAY to release a batch. The loop below refuses through a
     template-literal code and is outside the span for that reason. */
  if (!ack)
    return { ok: false, reason: "NO_ACKNOWLEDGMENT", ...rowOf("NO_ACKNOWLEDGMENT"),
             detail: localize("ratification.release.a_bulk_release_records_the", "a bulk release records the member's explicit acknowledgment that the batch is homogeneous and that the risks of releasing in bulk were weighed. Without it the record shows only that a button was pressed.") };
  if (!mit)
    return { ok: false, reason: "NO_MITIGATION", ...rowOf("NO_MITIGATION"),
             detail: localize("ratification.release.a_bulk_release_records_what", "a bulk release records what the member actually did: what was sampled, what was checked. 'Sender domains verified on a sample of twelve' can be audited later; silence cannot.") };
  /* END DEC-49 REGION is-release-account */
  for (const [name, v] of [["acknowledgment", ack], ["mitigation", mit]])
    if (v.length > RELEASE_ACK_MAX || /["\\\r\n]/.test(v))
      return { ok: false, reason: `BAD_${name.toUpperCase()}`,
               detail: localize("ratification.release.name_is_at_most_release", "{name} is at most {RELEASE_ACK_MAX} characters and cannot contain a quote, a backslash, or a newline", { name: String(name), RELEASE_ACK_MAX: String(RELEASE_ACK_MAX) }) };

  /* R21: retrieval's refuse-weight resolve, whose refusal is answered as it stands. */
  const sel = retrieval.selectionResolve({ handle, viewer, owner, weight: "refuse" });
  if (!sel.ok) return sel;
  if (!sel.members.length)
    return { ok: false, reason: "EMPTY_SELECTION", handle, drift: sel.drift,
             detail: localize("ratification.release.this_selection_resolves_to_release", "this selection resolves to no members, so there is nothing to release") };

  /* R22, R23: every member examined before any document changes, each counted under the first class it fails. */
  const failed = { NOT_INFORMATION: [], ILLEGAL_TRANSITION: [], CRUCIAL_IN_BATCH: [], CONTESTED_IN_BATCH: [],
                   ENTRY_REQUIREMENTS: [] };
  for (const id of sel.members) {
    const x = examineMember(deps, id);
    if (x) failed[x.class].push(x.offender);
  }
  const byId = (a, b) => (a.id < b.id ? -1 : 1);
  if (failed.NOT_INFORMATION.length)
    return { ok: false, reason: "NOT_INFORMATION", offenders: failed.NOT_INFORMATION.sort(),
             detail: CLASS_REASONS.NOT_INFORMATION };
  if (failed.ILLEGAL_TRANSITION.length)
    return { ok: false, reason: "ILLEGAL_TRANSITION", to: "verified",
             offenders: failed.ILLEGAL_TRANSITION.sort(byId), detail: CLASS_REASONS.ILLEGAL_TRANSITION };
  if (failed.CRUCIAL_IN_BATCH.length)
    return { ok: false, reason: "CRUCIAL_IN_BATCH", offenders: failed.CRUCIAL_IN_BATCH.sort(),
             detail: CLASS_REASONS.CRUCIAL_IN_BATCH };
  /* DEC-49 REGION is-release-contested — R22's contested arm, C-58.4 (DEC-97 (3)). */
  if (failed.CONTESTED_IN_BATCH.length)
    return { ok: false, reason: "CONTESTED_IN_BATCH", ...rowOf("CONTESTED_IN_BATCH"),
             offenders: failed.CONTESTED_IN_BATCH.sort(), detail: CLASS_REASONS.CONTESTED_IN_BATCH };
  /* END DEC-49 REGION is-release-contested */
  /* DEC-49 REGION is-release-entry — REC-64/C-33.12. */
  if (failed.ENTRY_REQUIREMENTS.length)
    return { ok: false, reason: "ENTRY_REQUIREMENTS", ...rowOf("ENTRY_REQUIREMENTS"),
             offenders: failed.ENTRY_REQUIREMENTS.sort(byId), detail: CLASS_REASONS.ENTRY_REQUIREMENTS };
  /* END DEC-49 REGION is-release-entry */

  /* R24, R25: each member released in the selection's order, at one instant for the batch; the writes are per member. */
  const when = stampInstant("second");
  const released = [];
  for (const id of sel.members) {
    const moved = moveMember({ sql, promotion }, {
      id, when, author: who, to: "verified",
      blurb: word("ratification.blurb", { handle: String(handle) }),
      sessionEntry: (from) => `### Session ${when} | Released (batch) | ${who}\n`
                            + `Trigger: selection ${handle}\n`
                            + `Changes: state ${from} to verified.\n`
                            + `Acknowledgment: ${ack}\n`
                            + `Mitigation: ${mit}\n` });
    if (moved.stop === "NO_DOCUMENT")
      return { ok: false, reason: "NO_DOCUMENT", bundleId: id, releasedSoFar: released };
    if (moved.stop === "UNSPLICEABLE_STATE_HISTORY")
      return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", bundleId: id, releasedSoFar: released,
               detail: "this document's state_history block cannot be extended in place, and a release "
                     + "recording no transition would leave prior_state pointing at a history the "
                     + "document does not carry (C-4.2)" };
    if (!moved.promoted.ok) return { ...moved.promoted, bundleId: id, releasedSoFar: released };
    released.push(id);
  }
  return { ok: true, handle, released: released.sort(), acknowledgment: ack, mitigation: mit,
           weight: "refuse", drift: sel.drift };
}

/* R22, R34: each class's reason, the one sentence the release's refusal and capture's held list (its R78) both give. */
export const CLASS_REASONS = Object.freeze({
  NOT_INFORMATION: localize("ratification.release.release_moves_an_information_state", "release moves an Information state, and this selection carries something else. The set is refused whole rather than narrowed."),
  ILLEGAL_TRANSITION: localize("ratification.release.only_collected_information_may_be", "only collected Information may be released. Something already verified has been released once and release is not repeatable; something retired is terminal."),
  CRUCIAL_IN_BATCH: localize("ratification.release.crucial_criticality_material_is_never", "crucial-criticality material is never batch-released (Intake Doctrine v1.2): ratifying it requires verifying its co-attestations, which is per-document work, and a batch containing crucial material is not a low-variance collection. Release these individually, or re-select without them."),
  CONTESTED_IN_BATCH: localize("ratification.release.contested_material_is_never_batch", "contested material is never batch-released (Intake Doctrine section 4; DEC-97): a contradiction touching each of these documents is not yet resolved, or whether one is could not be read. Resolve it, or release these individually, or re-select without them."),
  ENTRY_REQUIREMENTS: localize("ratification.release.verified_state_has_entry_requirements", "verified state has entry requirements: a well-formed content_hash, data/dataset.json, and at least one file in snapshots/ (C-2.7), and a provenance_chain naming the route for every document in the register (C-18.9). Releasing these as they stand would mint records the catalog immediately rejects."),
});

/* R22 (K1025): the viewer the contested arm reads as. The plane's own, which sees every bundle (membership R43), so a
   side no member may see still bars the batch; nothing of any side is answered. */
export const PLANE_VIEWER = "class:daemon";
const CONTESTED_STATES = ["open", "explained_not_shown", "taken_up"];

/** R22, R34: THE ONE EXAMINATION of one document, which the release counts every member by and `capture` reads as its
 *  `batch-examination` reader: null when it passes every class, else `{class, offender, reason}`, the first class it
 *  fails in R22's order (the refusal's code), its offender as the refusal lists it, and that class's reason. */
export function examineMember(deps, id) {
  const { sql } = deps;
  const fail = (cls, offender) => ({ class: cls, offender, reason: CLASS_REASONS[cls] });
  const b = one(sql, `SELECT object_type, current_state, criticality FROM bundles WHERE bundle_id=?`, id);
  if (!b || b.object_type !== "information") return fail("NOT_INFORMATION", id);
  if (b.current_state !== "collected") return fail("ILLEGAL_TRANSITION", { id, from: b.current_state });
  const md = one(sql, `SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
  const fm = md && md.content !== null ? (parseFrontmatter(md.content).data || {}) : {};
  /* R22, R27: crucial by the record's column OR by the document's own front matter, whichever says so. The column
     is what the promotion's envelope gave (promotion does not read it from the bytes), so a document declaring
     itself crucial under an envelope that did not would otherwise ride a batch; R24 writes the document's value. */
  if (b.criticality === "crucial" || fm.criticality === "crucial") return fail("CRUCIAL_IN_BATCH", id);
  /* R22's contested arm (DEC-97 (3)): a standing candidate of any shown weight with a side on the document. A read
     that fails, or is cut short with none found, is counted contested: an unread contradiction is not a resolved one. */
  for (const state of CONTESTED_STATES) {
    let r = null;
    try { r = deps.contradiction.candidatesFor({ on: { bundle: id }, state, limit: 1, viewer: PLANE_VIEWER }); } catch { r = null; }
    if (!r || r.ok === false || r.undetermined || r.truncated || (r.candidates || []).length)
      return fail("CONTESTED_IN_BATCH", id);
  }
  const missing = [];
  const ch = fm.content_hash;
  if (!(typeof ch === "string" && /^sha256:[0-9a-f]{64}$/.test(ch))) missing.push("well-formed content_hash");
  if (!one(sql, `SELECT 1 AS x FROM files WHERE bundle_id=? AND path='data/dataset.json'`, id))
    missing.push("data/dataset.json");
  if (!one(sql, `SELECT 1 AS x FROM files WHERE bundle_id=? AND path LIKE 'snapshots/%' LIMIT 1`, id))
    missing.push("a file in snapshots/");
  /* REC-54 / D-200: THE CHAIN IS AN ENTRY REQUIREMENT OF `verified`. The catalog runs at op=ratify and NOWHERE ELSE,
     so this batch path, which is the OTHER way an Information document reaches `verified`, asks C-18.9's question
     here, in the refusal shape (`ENTRY_REQUIREMENTS`, the offenders named, the set refused whole) a caller of this op
     already gets: a chain missing at release is the same KIND of fact as a missing content_hash. VERIFICATION.md 3a:
     a rule enforced in N places carries an assertion at EACH place. */
  const provRow = one(sql, `SELECT content FROM files WHERE bundle_id=? AND path='data/provenance.json'`, id);
  if (provRow && provRow.content !== null) {
    let preg = null;
    try { preg = JSON.parse(provRow.content); } catch { preg = null; }
    const pdocs = preg && Array.isArray(preg.documents) ? preg.documents : [];
    const noChain = [];
    pdocs.forEach((d, di) => {
      const chain = d && typeof d === "object" ? d.provenance_chain : undefined;
      if (!Array.isArray(chain) || chain.length === 0) noChain.push(di);
    });
    if (noChain.length)
      missing.push(`a provenance_chain for documents[${noChain.join("], documents[")}] (C-18.9)`);
  }
  return missing.length ? fail("ENTRY_REQUIREMENTS", { id, missing }) : null;
}

/** R24, R30: one member's transition, written as a new version through `promotion`'s `promote` on its held
 *  `bundle_sha`: its `state_history` gains `{timestamp: when, from_state: <its state>, to_state: to, blurb, author}`;
 *  `prior_state` is its former state, `current_state` `to`, `last_updated` the instant; `sessionEntry(from)`'s lines
 *  are placed at the end of the Session Log section (the section is added at the document's end when absent); every
 *  other file is carried unchanged, and the new version's `criticality` is the document's. Answers `{stop}` when
 *  the member's `bundle.md` is gone (`NO_DOCUMENT`) or its `state_history` cannot be extended in place
 *  (`UNSPLICEABLE_STATE_HISTORY`), each for its caller to word; else `{promoted}`, `promote`'s answer as it gave it. */
export function moveMember({ sql, promotion }, { id, when, author, to, blurb, sessionEntry }) {
  const liveMd = one(sql, `SELECT content FROM files WHERE bundle_id=? AND path='bundle.md'`, id);
  const cur = one(sql, `SELECT bundle_sha, current_state FROM bundles WHERE bundle_id=?`, id);
  if (!liveMd || liveMd.content === null) return { stop: "NO_DOCUMENT" };
  let text = appendStateHistory(liveMd.content, {
    timestamp: when, from_state: cur.current_state, to_state: to, blurb, author });
  if (!text) return { stop: "UNSPLICEABLE_STATE_HISTORY" };
  text = setScalar(text, "prior_state", cur.current_state);
  text = setScalar(text, "current_state", to);
  text = setScalar(text, "last_updated", `"${when}"`);
  const entryLog = sessionEntry(cur.current_state);
  const at = text.indexOf("## Session Log");
  if (at < 0) text += "\n## Session Log\n\n" + entryLog;
  else {
    const nxt = text.indexOf("\n## ", at + 1);
    const cutAt = nxt === -1 ? text.length : nxt + 1;
    text = text.slice(0, cutAt) + entryLog + "\n" + text.slice(cutAt);
  }

  const carried = [];
  for (const r of rows(sql,
    `SELECT path, content, blob_sha, sha256, bytes FROM files WHERE bundle_id=? AND path<>'bundle.md'`, id))
    carried.push(r.content !== null
      ? { path: r.path, text: r.content, bytes: r.bytes, sha256: r.sha256 }
      : { path: r.path, blobSha: r.blob_sha, sha256: r.sha256, bytes: r.bytes });

  const bytes = new TextEncoder().encode(text);
  const fm = parseFrontmatter(text).data || {};
  return { promoted: promotion.promote({
    bundleId: id, base: cur.bundle_sha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`,
    author,
    files: [{ path: "bundle.md", text, bytes: bytes.length,
              sha256: createSha256().update(bytes).hex() }, ...carried],
    meta: { object_type: "information", title: fm.title,
            current_state: to, prior_state: cur.current_state,
            created: fm.created, last_updated: when,
            criticality: fm.criticality ?? null },
  }) };
}

/* Append one entry to the `state_history` block, handling the inline-empty and populated shapes the corpus actually
   contains, exactly as `#spliceReferences` does for references. Returns null if the block is in a shape this restricted
   grammar cannot extend, so the caller refuses rather than guesses. */
function appendStateHistory(text, e) {
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
  /* Populated block: find its end and append, so entries stay chronological. */
  let last = at;
  for (let i = at + 1; i < end; i++) {
    if (/^\s/.test(lines[i]) && lines[i].trim() !== "") last = i;
    else break;
  }
  return [...lines.slice(0, last + 1), ...block, ...lines.slice(last + 1)].join("\n");
}

/* Rewrite ONE column-0 scalar inside the frontmatter, leaving every other byte alone. Line-oriented on purpose: this
   repo has no frontmatter SERIALIZER, only a parser, and re-emitting a parsed document would reorder keys, drop
   comments and renormalise quoting across the whole file to change one field. */
function setScalar(text, key, value) {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  for (let i = 1; i < (end === -1 ? lines.length : end); i++) {
    if (lines[i].startsWith(key + ":")) { lines[i] = `${key}: ${value}`; return lines.join("\n"); }
  }
  return text;
}
