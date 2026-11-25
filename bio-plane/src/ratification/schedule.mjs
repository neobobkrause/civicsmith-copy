/* ratification — publishing a signed case edition at a set time (requirements: R40–R46, R48; DEC-147, K1784, K1790,
 * K1811, K1816). What signing read is recorded as `checked` (R41) so the scheduled publisher (R42) compares like with
 * like, each part in canonical JSON with every list in a stated order; the comparison names what changed; and the
 * C-58.6–C-58.10 answers are built here, at one site each (DEC-49). The reads are handed in by the caller (`./index.mjs`),
 * so nothing here touches the store, and a read that fails is answered as unreadable, never as a clear one. */

import { canonicalJson, createSha256, b64ToBytes } from "../record-grammar/index.mjs";
import { caseDocumentBlocks, acceptedWorkOf, peopleOf, memberTiesOf } from "../case-grammar/index.mjs";
import { rowOf } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

/** R41: the parts of `checked`, in the order they are recorded and compared. */
export const CHECKED_PARTS = Object.freeze(["sources", "ties", "holds", "signer_key", "approvals"]);

/* R50 (T41; D60): the `approvals` part with no rule in force, which a waiting edition signed before the part existed
   is read as recording (no approval was asked then, and none is lost by reading it so). */
export const NO_APPROVAL_RULE = canonicalJson({ rule: null, approvals: [] });

/* R42: the stop code a part that differs answers with (`signer_key` cannot differ under a signature that verifies). */
const DIFFERS = Object.freeze({ sources: "SCHEDULED_SOURCES_CHANGED", ties: "SCHEDULED_TIES_CHANGED",
                                holds: "SCHEDULED_HOLD_CHANGED", signer_key: "SCHEDULED_CHECK_REFUSED",
                                approvals: "SCHEDULED_CHECK_REFUSED" });

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const byJson = (a, b) => { const x = canonicalJson(a), y = canonicalJson(b); return x < y ? -1 : x > y ? 1 : 0; };
const listOf = (x, key) => (Array.isArray(x) ? x : x && typeof x === "object" && x.ok !== false && Array.isArray(x[key])
  ? x[key] : null);

/** R41: an SSH key's fingerprint as `ssh-keygen -l` prints it, `SHA256:` and the unpadded base64 of the SHA-256 of the
 *  key blob (given as its base64); null when there is no key. */
export function keyFingerprint(keyB64) {
  if (!str(keyB64)) return null;
  const hex = createSha256().update(b64ToBytes(keyB64.trim())).hex();
  const bytes = Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));
  return `SHA256:${btoa(String.fromCharCode(...bytes)).replace(/=+$/, "")}`;
}

/* The money facts the signed `people:` block names as a place (`money <MNY-id>`, case-disclosures' `placesStated`). */
function moneyFactsNamed(people) {
  const out = new Set();
  for (const p of people)
    for (const place of String(p.places ?? "").split(";"))
      { const m = /^\s*money\s+(\S+)\s*$/.exec(place); if (m) out.add(m[1]); }
  return [...out].sort();
}

/** R41: what signing read, read again by R42 the same way. `reads` are the caller's: `sourcesLapsed(text, at)` and
 *  `acceptedWorkLapsed(fm, signer)` (case-carriage, as publication R51 and R59 read them), `tiesConcerning(args)`
 *  (people R20), `readFact(args)` (money), `holdsOn({project})` (R45's reader, or null), `stampsOf({case, edition})`
 *  (publication R62), `ratifiedEditions(case)` and `approvals()` (`./refusals.mjs` `approvalsRead` over R50's reader, at
 *  the signed `doc_sha`). Answers `{ok: true, checked}`, each part canonical JSON, or
 *  `{ok: false, unreadable: [{part, what}]}` naming every part that could not be read. Never throws. */
export function checkedOf({ text, fm, caseId, project, signer, keyB64, at, reads }) {
  const unreadable = [];
  const ask = (part, what, fn) => { try { return fn(); } catch { unreadable.push({ part, what }); return undefined; } };
  const parts = {};

  /* sources: each `sources:` row with whether it still holds, and each `accepted_work:` row's standing */
  {
    const rows = (caseDocumentBlocks(text).sources || []);
    const lapsed = ask("sources", word("ratification.ask.published_sources"), () => reads.sourcesLapsed(text, at));
    const accepted = acceptedWorkOf(fm).rows;
    const standing = accepted.length
      ? ask("sources", word("ratification.ask.acceptances_groups_work"), () => reads.acceptedWorkLapsed(fm, signer)) : null;
    if (lapsed !== undefined && !Array.isArray(lapsed))
      unreadable.push({ part: "sources", what: word("ratification.ask.published_sources") });
    else if (standing !== undefined && standing !== null
             && (!Array.isArray(standing.withdrawn) || !Array.isArray(standing.undisclosed)))
      unreadable.push({ part: "sources", what: word("ratification.ask.acceptances_groups_work") });
    else if (lapsed !== undefined && standing !== undefined) {
      const key = (r) => canonicalJson([r.capture ?? null, r.stated ?? null, r.basis ?? null]);
      const gone = new Set(lapsed.map(key));
      const pair = (r) => canonicalJson([r.ref ?? null, Number.isInteger(r.edition) ? r.edition : null]);
      const withdrawn = new Set((standing ? standing.withdrawn : []).map(pair));
      const seen = new Set();
      parts.sources = {
        sources: rows.map((r) => ({ capture: r.capture ?? null, stated: r.stated ?? null, basis: r.basis ?? null,
                                    standing: !gone.has(key(r)) })).sort(byJson),
        accepted_work: accepted.filter((r) => !seen.has(pair(r)) && seen.add(pair(r))).map((r) => ({
          ref: r.ref ?? null, edition: Number.isInteger(r.edition) ? r.edition : null,
          in_force: !withdrawn.has(pair(r)),
          undisclosed_flags: (standing ? standing.undisclosed : []).filter((u) => pair(u) === pair(r))
            .map((u) => u.flag ?? null).sort() })).sort(byJson) };
    }
  }

  /* ties: each signing member's declared ties to what the signed document names */
  {
    const people = peopleOf(fm);
    const entities = new Set([...people.map((p) => p.person),
                              ...memberTiesOf(fm).filter((t) => t.row === "tie").map((t) => t.entity)].filter(str));
    let ok = true;
    if (!str(signer)) { unreadable.push({ part: "ties", what: word("ratification.what.signing_member") }); ok = false; }
    for (const factId of ok ? moneyFactsNamed(people) : []) {
      const f = ask("ties", `money fact ${factId}`, () => reads.readFact({ factId, viewer: `member:${signer}` }));
      if (f === undefined) { ok = false; continue; }
      if (!f || f.ok === false || !f.found || !f.fact) { unreadable.push({ part: "ties", what: `money fact ${factId}` }); ok = false; continue; }
      for (const side of ["from", "to"]) if (f.fact[side] && str(f.fact[side].entity)) entities.add(f.fact[side].entity);
    }
    if (ok) {
      const t = entities.size
        ? ask("ties", word("ratification.ask.ties_declared", { signer: String(signer) }), () => reads.tiesConcerning({ entities: [...entities].sort(),
            member: signer, viewer: `member:${signer}` }))
        : { ok: true, ties: [] };
      const ties = t === undefined ? undefined : listOf(t, "ties");
      if (ties === null) unreadable.push({ part: "ties", what: word("ratification.ask.ties_declared", { signer: String(signer) }) });
      else if (ties !== undefined)
        parts.ties = [{ member: signer, ties: ties.map((x) => ({ tie_id: x.tie_id ?? null, entity: x.entity ?? null,
                                                                  withdrawn: !!x.withdrawn })).sort(byJson) }];
    }
  }

  /* holds: the litigation holds over the case's project (R45) and every court-order stamp on any of its editions */
  {
    let holds;
    if (!project) holds = { held: false };   /* a document naming no project is refused before here (R3) */
    else if (!reads.holdsOn) unreadable.push({ part: "holds", what: "the litigation holds: no hold reader is registered (R45)" });
    else {
      /* actions R69: `{held: true, since, recorded_by}` or `{held: false}`, null when the read could not complete */
      const h = ask("holds", word("ratification.ask.litigation_holds"), () => reads.holdsOn({ project }));
      if (h !== undefined && (!h || typeof h !== "object" || typeof h.held !== "boolean"))
        unreadable.push({ part: "holds", what: word("ratification.ask.litigation_holds") });
      else if (h !== undefined)
        holds = h.held ? { held: true, since: h.since ?? null, recorded_by: h.recorded_by ?? null } : { held: false };
    }
    const editions = ask("holds", word("ratification.ask.case_ratified_editions"), () => reads.ratifiedEditions(caseId));
    const stamps = [];
    for (const edition of Array.isArray(editions) ? editions : []) {
      const s = ask("holds", word("ratification.ask.stamps_edition", { edition: String(edition) }), () => reads.stampsOf({ case: caseId, edition }));
      const list = s === undefined ? undefined : listOf(s, "stamps");
      if (list === null) unreadable.push({ part: "holds", what: word("ratification.ask.stamps_edition", { edition: String(edition) }) });
      else if (list !== undefined) stamps.push({ edition, stamps: list });
    }
    if (!unreadable.some((u) => u.part === "holds") && holds !== undefined)
      parts.holds = { project: holds, stamps };
  }

  /* approvals (R50): the group's rule in force and the approvals given at the signed bytes */
  {
    const a = ask("approvals", word("ratification.ask.group_approvals"), () => reads.approvals ? reads.approvals() : null);
    if (a && a.unreadable) unreadable.push({ part: "approvals", what: a.unreadable });
    else if (a !== undefined)
      parts.approvals = a ? { rule: { approvers: a.approvers }, approvals: a.approvals } : { rule: null, approvals: [] };
  }

  parts.signer_key = keyFingerprint(keyB64);
  if (unreadable.length) return { ok: false, unreadable };
  return { ok: true, checked: Object.fromEntries(CHECKED_PARTS.map((p) => [p, canonicalJson(parts[p] ?? null)])) };
}

/* The items one part holds, each as canonical JSON, so two readings can be told apart item by item. */
function itemsOf(part, json) {
  let v = null;
  try { v = JSON.parse(json); } catch { return [String(json)]; }
  if (part === "sources" && v) return [...(v.sources || []).map((r) => canonicalJson({ source: r })),
                                       ...(v.accepted_work || []).map((r) => canonicalJson({ accepted_work: r }))];
  if (part === "ties" && Array.isArray(v)) return v.flatMap((m) => (m.ties || []).map((t) => canonicalJson({ member: m.member, tie: t.tie_id, withdrawn: t.withdrawn })));
  if (part === "approvals" && v) return [canonicalJson({ rule: v.rule ?? null }),
                                         ...(v.approvals || []).map((x) => canonicalJson({ approval: x }))];
  if (part === "holds" && v) return [canonicalJson({ hold: v.project ?? null }),
                                     ...(v.stamps || []).flatMap((e) => (e.stamps || []).map((s) => canonicalJson({ edition: e.edition, stamp: s })))];
  return [canonicalJson(v)];
}

/** R42: each part of `then` (what signing recorded) that `now` answers differently, `[{part, code, changed}]`, `changed`
 *  the items present in one reading and not the other (at most 50), each naming a source, a tie by its id, a hold or a
 *  stamp, an approval or the rule. A part missing from `then` is a part signing could not have recorded, so it differs;
 *  but `approvals`, added in T41, is read as no rule when an edition signed before then does not record it. */
export function checkedDiffers(then, now) {
  const out = [];
  for (const part of CHECKED_PARTS) {
    const a = then && typeof then[part] === "string" ? then[part]
      : part === "approvals" && then && typeof then === "object" ? NO_APPROVAL_RULE : null;
    const b = now[part];
    if (a === b) continue;
    const was = new Set(a === null ? [] : itemsOf(part, a)), is = new Set(itemsOf(part, b));
    const changed = [...[...was].filter((x) => !is.has(x)).map((x) => ({ was: JSON.parse(x) })),
                     ...[...is].filter((x) => !was.has(x)).map((x) => ({ now: JSON.parse(x) }))].slice(0, 50);
    out.push({ part, code: DIFFERS[part], changed });
  }
  return out;
}

/** R40 / C-58.6: part of what signing records cannot be read now, so nothing is signed for a later time. */
export function scheduleUncheckableRefusal(caseId, edition, unreadable) {
  /* DEC-49 REGION is-schedule-uncheckable */
  return { ok: false, reason: "SCHEDULE_UNCHECKABLE", ...rowOf("SCHEDULE_UNCHECKABLE"), caseId, edition,
    unreadable: unreadable.slice(0, 50),
    detail: localize("ratification.schedule.publishing_case_caseid_edition_edition", "publishing case {caseId} edition {edition} at a set time means checking again at that time what is checked now, and {map} cannot be read now. Nothing was signed for later: publish it now (op=caseratify), or try again later.", { caseId: String(caseId), edition: String(edition), map: String(unreadable.map((u) => u.what).join("; ")) }) };
  /* END DEC-49 REGION is-schedule-uncheckable */
}

/** R42 / C-58.7–C-58.10: one entry of a stop, `{code, check, translation, cause?, changed?}`. */
export function scheduledStop(code, extra = {}) {
  /* DEC-49 REGION is-scheduled-stop */
  return { ...rowOf(code), ...extra };
  /* END DEC-49 REGION is-scheduled-stop */
}

/** R42: the stop entry for a refusal one of signing's checks, or the commit itself, answers at the set time: its `cause`
 *  carries the refusal's own code, and its check and translation exactly as it answered them, when it has a row (the
 *  commit's C-122.6 `PHOTO_MARKS_CHANGED_SINCE` among them; T39, N805, K2308). */
export function refusedStop(refusal) {
  const r = refusal && typeof refusal === "object" ? refusal : {};
  return scheduledStop("SCHEDULED_CHECK_REFUSED", { cause: { code: r.reason ?? r.code ?? "UNREADABLE",
    ...(typeof r.check === "string" ? { check: r.check } : {}),
    ...(typeof r.translation === "string" ? { translation: r.translation } : {}),
    ...(typeof r.detail === "string" ? { detail: r.detail } : {}),
    ...(Array.isArray(r.findings) ? { findings: r.findings } : {}) } });
}

/** R42 (K2370): the stop entries for a refusal of the commit itself, one per refusal it answers: each of its
 *  `refusals` (publication R57 answers C-122.6 and C-122.7 there when both hold, the first also at top level), else
 *  the one refusal it is. */
export function commitStops(refusal) {
  const list = refusal && typeof refusal === "object" && Array.isArray(refusal.refusals)
    ? refusal.refusals.filter((r) => r && typeof r === "object") : [];
  return (list.length ? list : [refusal]).map(refusedStop);
}

/** R42: the stop entry for what could not be read at the set time: a read that fails stops, never passes. */
export function unreadableStop(what) {
  return scheduledStop("SCHEDULED_CHECK_REFUSED", { cause: { code: "UNREADABLE", what: (Array.isArray(what) ? what : [what])
    .map((w) => (typeof w === "string" ? w : w && w.what ? w.what : String(w))).slice(0, 50) } });
}
