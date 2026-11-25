/* ratification — the bulk retirement (R28–R31, R33; K653 BOB-3): the verified-to-retired transition of many Information
 * documents at once, over a selection, at weight `refuse` (State Rules v1.5 §4.1: a retired item is not citable, and
 * `retired` is terminal). Extracted from `legacy-store` in T19 layer 8 (`Store.retire`, `#retirementCitedBy`,
 * `EDGE_REASON_MAX`; its `CITED` detail is `promotion`'s `RETIRE_CITED_DETAIL`, the words `promotion` R16 answers),
 * as the bulk release was in T18 (`./release.mjs`, whose `moveMember` writes each member here too); the plane's op
 * map (`plane/store.mjs`) reaches it through `ratificationOps` (§12.2). The legacy code's comments moved with it.
 *
 * S-11 step 4: bulk RETIREMENT of Information, weight `refuse`.
 *
 * Heavier than step 3's disposition for one structural reason: `retired` is TERMINAL in the catalog's table (collected
 * -> verified -> retired, and retired -> nothing), where every Problem disposition is reversible. A wrong disposition
 * is corrected by disposing again. A wrong retirement cannot be undone through the state machine at all, so every
 * refusal here is worth more than the equivalent refusal there.
 *
 * TWO GUARDS, and the second is the doctrinal one.
 *
 * First, only `verified` -> `retired`, because that is the only legal edge. Retiring something merely `collected`
 * would skip the step where a human looked at it, which is precisely what the intake doctrine exists to protect.
 *
 * Second, INFORMATION A PROJECT STILL CITES IS REFUSED. Nothing in the catalog stops this, and that is why it matters:
 * C-6.2 treats an unresolvable reference target as an ERROR whose remediations are "restore target from history",
 * "re-point to the successor", or "sever the edge with a reason note". A bulk retirement that silently stranded live
 * citations would manufacture exactly that error condition at whatever scale the operator happened to select. The
 * citing Projects are NAMED, because an operator told only "refused" cannot act, and severing is C-6.2's own remedy.
 *
 * A SEVERED edge does not count as a citation. Severing is the recorded decision to stop relying on something, so
 * treating a severed edge as a live dependency would make the refusal unclearable by the very act doctrine prescribes
 * for clearing it.
 *
 * As built, no author's class is asked (a machine or absent author is not refused here, unlike the release's C-32.1),
 * and the refusals carry no catalogue row. `deps` is `{sql, promotion, retrieval, connections}`. */

import { stampInstant } from "../record-core/index.mjs";
import { RETIRE_CITED_DETAIL } from "../promotion/index.mjs";
import { moveMember } from "./release.mjs";
import { localize } from "../setup-words/index.mjs";

/* R28: a retirement's reason is one line of a Session Log entry and a `state_history` blurb, bounded as an edge's
   reason is. */
export const EDGE_REASON_MAX = 160;

const one = (sql, q, ...a) => [...sql.exec(q, ...a)][0] ?? null;

/** R28–R31: retire the selection `handle` from verified: the whole set examined before anything moves, then written
 *  member by member (R30). `author`, `viewer` and `owner` are the control plane's stamps, never the caller's. */
export function retire({ sql, promotion, retrieval, connections },
                       { handle, reason = "", viewer = null, owner = null, author = null } = {}) {
  /* R28: the reason, trimmed, asked before anything else is read. */
  const why = String(reason ?? "").trim();
  if (!why)
    return { ok: false, reason: "NO_REASON",
             detail: localize("ratification.retire.retirement_is_terminal_in_the", "retirement is terminal in the state machine, so it records WHY. There is no move back out of retired, and an unexplained one-way change is not a record.") };
  if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
    return { ok: false, reason: "BAD_REASON",
             detail: localize("ratification.retire.a_reason_is_at_most", "a reason is at most {EDGE_REASON_MAX} characters and cannot contain a quote, a backslash, or a newline", { EDGE_REASON_MAX: String(EDGE_REASON_MAX) }) };

  /* R29: retrieval's refuse-weight resolve, whose refusal is answered as it stands. */
  const sel = retrieval.selectionResolve({ handle, viewer, owner, weight: "refuse" });
  if (!sel.ok) return sel;
  if (!sel.members.length)
    return { ok: false, reason: "EMPTY_SELECTION", handle, drift: sel.drift,
             detail: localize("ratification.retire.this_selection_resolves_to_retire", "this selection resolves to no members, so there is nothing to retire") };

  /* R29, R33: every member examined before any document changes, each counted under the first class it fails. */
  const notInfo = [], illegal = [], cited = [];
  for (const id of sel.members) {
    const b = one(sql, `SELECT object_type, current_state FROM bundles WHERE bundle_id=?`, id);
    if (!b || b.object_type !== "information") { notInfo.push(id); continue; }
    if (b.current_state !== "verified") { illegal.push({ id, from: b.current_state }); continue; }
    /* Live citations only, through connections' ONE `citesInto` predicate (shared with op=affordances, which
       publishes retire's availability from it, and with promotion R16's `citedBy` fact): a severed edge is a
       recorded decision to stop relying and does not block. */
    const citedBy = connections.citesInto(id).confirmed;
    if (citedBy.length) cited.push({ id, citedBy });
  }
  if (notInfo.length)
    return { ok: false, reason: "NOT_INFORMATION", offenders: notInfo.sort(),
             detail: localize("ratification.retire.retirement_moves_an_information_state", "retirement moves an Information state, and this selection carries something else. The set is refused whole rather than narrowed.") };
  if (illegal.length)
    return { ok: false, reason: "ILLEGAL_TRANSITION", to: "retired",
             offenders: illegal.sort((a, b) => a.id < b.id ? -1 : 1),
             detail: localize("ratification.retire.only_verified_information_may_be", "only verified Information may be retired. Something still collected has not been verified by anyone, and retiring it would skip that step; something already retired has nowhere further to go, because retired is terminal.") };
  if (cited.length)
    return { ok: false, reason: "CITED", offenders: cited.sort((a, b) => a.id < b.id ? -1 : 1),
             detail: RETIRE_CITED_DETAIL };

  /* R30: each member retired in the selection's order, at one instant for the call; the writes are per member. */
  const when = stampInstant("second");
  const who = author || "member";
  const retired = [];
  for (const id of sel.members) {
    const moved = moveMember({ sql, promotion }, {
      id, when, author: who, to: "retired", blurb: why,
      sessionEntry: (from) => `### Session ${when} | Retired | ${who}\n`
                            + `Trigger: selection ${handle}\n`
                            + `Changes: state ${from} to retired. Reason: ${why}.\n` });
    if (moved.stop === "NO_DOCUMENT")
      return { ok: false, reason: "NO_DOCUMENT", bundleId: id, retiredSoFar: retired };
    if (moved.stop === "UNSPLICEABLE_STATE_HISTORY")
      return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", bundleId: id, retiredSoFar: retired,
               detail: "this document's state_history block cannot be extended in place, and a "
                     + "retirement recording no transition would leave prior_state pointing at a "
                     + "history the document does not carry (C-4.2)" };
    if (!moved.promoted.ok) return { ...moved.promoted, bundleId: id, retiredSoFar: retired };
    retired.push(id);
  }
  /* R31 */
  return { ok: true, reason: why, handle, retired: retired.sort(), weight: "refuse", drift: sel.drift };
}
