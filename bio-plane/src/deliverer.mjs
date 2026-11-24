/* REC-128 — THE RECORD STATES WHO AUTHORISED AND WHO DELIVERED.
 *
 * BOB #14, 2026-09-18, the honesty half of D-421. An attested act (`op=ratify`,
 * `op=caseratify`) is performed only by a HUMAN's own authenticated session — a
 * member's, or the founder's password session (the only live publishing route,
 * DEC-33) — never by a bearer token or a machine credential (REC-123, REC-125).
 * That still leaves TWO people in one act: the member whose key made the
 * SIGNATURE (who AUTHORISED) and the principal whose session carried it in (who
 * DELIVERED). A founder can deliver a member's signature, and a member can
 * deliver another member's. Before this module the record named only the signer.
 *
 * TWO NAMES FOR TWO FACTS, AND NEVER ONE FACT UNDER TWO NAMES. The liar this
 * exists to refuse is a `delivered_by` that copies the signer: it reads as a
 * second witness and it is one source copied. So the deliverer is taken FROM THE
 * SESSION and from nothing else — `deliveringPrincipal` is handed the session row
 * and has no parameter through which a signature, a key or a signer could reach
 * it. And a ratification recorded before this landed reads back UNDETERMINED,
 * STATED, and is never back-filled from its signer: `delivererOf` is handed the
 * stored column alone, for the same reason.
 *
 * THE STORED VALUE is a principal string: `member:<id>` for a member's session,
 * `founder` for the instance's founder (the bare `admin` session role, the
 * claim-step login — spelled `founder` in the record because `admin` is also the
 * name of a bearer-token CLASS and of a member ROLE, and a record that says
 * `admin` would not say which). NULL is "not recorded", and it is only ever
 * written by a plane older than this module.
 */

import { localize } from "./setup-words/index.mjs";

/* The principal whose authenticated session performed the act, from the SESSION
   ROW the admission block resolved — never from `sessMember`, which folds the
   founder's `admin` role and a member literally enrolled as `admin` into one
   string. Returns null for a role this plane does not issue, and the reads then
   say UNDETERMINED rather than guessing. */
export function deliveringPrincipal(session) {
  const role = session && typeof session.role === "string" ? session.role : "";
  if (role === "admin") return "founder";
  if (role.startsWith("member:") && role.length > "member:".length) return role;
  return null;
}

export const DELIVERER_UNDETERMINED_DETAIL = localize("publication.deliverer.who_delivered_this_ratification_was",
  "who DELIVERED this ratification was not recorded: it was ratified before the record stated the delivering principal (REC-128). Its SIGNER is known, from the signature; who carried the signature in is undetermined, and it is not inferred from the signer — a member's signature can be delivered by another member's session or by the founder's.");

/* The READ shape, from the stored column and from nothing else. One function so
   every read — the finding rows, the case document, the container that travels —
   says the same thing about the same column. */
export function delivererOf(stored) {
  if (stored === "founder") return { kind: "founder", member: null };
  if (typeof stored === "string" && stored.startsWith("member:") && stored.length > "member:".length)
    return { kind: "member", member: stored.slice("member:".length) };
  return { kind: "undetermined", member: null, detail: DELIVERER_UNDETERMINED_DETAIL };
}
