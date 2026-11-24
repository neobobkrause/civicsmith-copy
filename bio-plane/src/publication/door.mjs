/* publication — the door's half of `op=caseflags` and `op=casedocument` (requirements: `build/requirements/publication.md`
 * R1, R29; `op=caseflags` answers `case-tensions` R3, was this module's R6, through the store op this module spreads
 * until the plane's op map spreads case-tensions' own). Moved from `src/index.mjs` (the legacy-index map's §4.4 move, K649 (7); §12.2), with their comments: the
 * two arms answer through this module's own store ops (`publicationOps`' `caseflags` and `casedocument`), pinned to `bio`
 * as before. The door keeps what is the door's and hands it in (control-plane, later in the order): its envelope
 * helpers (`json`, `storeSilent`, `storeRefusal`, `doAnswer`), the reader's stamp and its resolution (`readerOf`, the
 * door's `caseReader` over the presented credential, asked only for `casedocument`), the secret's hash (`sha256Hex`) and
 * the statement a member signs (`NS_RATIFY`, `caseRatifyStatement`, signatures'), so this module imports none of them.
 *
 * `publicationDoorOp(op, url, stub, helpers)` answers one of the two ops, or null for any other, so the door asks it and
 * goes on. The request's body reaches it through the helpers as `body`: the parsed JSON object, or a function answering
 * it (or a Promise of it), the control plane's to pass (R73; F1, K1874). */

import { localize } from "../setup-words/index.mjs";

/* R73: the request body's `secret`, a non-empty string, or null: a body that is absent, unreadable or not an object
   carries none. The address is never read for it: a request naming `secret` or `token` there is refused
   `CREDENTIAL_IN_ADDRESS` before this door runs (admission's gate, its R20, which the control plane runs first). */
async function bodySecret(body) {
  let b = null;
  try { b = typeof body === "function" ? await body() : await body; } catch { b = null; }
  return b && typeof b === "object" && !Array.isArray(b) && typeof b.secret === "string" && b.secret ? b.secret : null;
}

export const PUBLICATION_DOOR_OPS = Object.freeze(["caseflags", "casedocument"]);

export async function publicationDoorOp(op, url, stub, { json, storeSilent, storeRefusal, doAnswer, readerOf, sha256Hex,
                                                       NS_RATIFY, caseRatifyStatement, body = null }) {
  /* ---- CASE-4 / DEC-72: op=caseflags ----
     WHICH PUBLISHED CASES ARE CARRYING A STALE PIN, AND WHICH OWNING
     PROJECTS HAVE ACTED. Placed with the public read path above and pinned
     to `bio` for its reason: every fact in the answer is already on the
     public surface, and an instance has ONE published record, so a probe's
     scratch namespace is deliberately not readable here.

     `case=` OR `target=` OR NEITHER, and neither is a whole-store sweep of
     the FLAG TABLE only — bounded by the number of revisions that have ever
     been made to a published member, which is a small number by
     construction and never a walk of the corpus. */
  if (op === "caseflags") {
    const q = new URLSearchParams();
    const cid = (url.searchParams.get("case") || "").trim();
    const tgt = (url.searchParams.get("target") || "").trim();
    if (cid) q.set("case", cid);
    if (tgt) q.set("target", tgt);
    if (url.searchParams.get("outstanding") === "1") q.set("outstanding", "1");
    if (url.searchParams.get("limit")) q.set("limit", url.searchParams.get("limit"));
    const fOut = await doAnswer(stub.fetch(`http://do/caseflags?${q}`));
    if (fOut.refused) return storeRefusal(fOut);
    if (!fOut.answered) return storeSilent("caseflags", fOut.correlation);
    return json({ ok: true, result: fOut.result }, 200);
  }

  /* ===== CASE-5b / DEC-72: THE CASE-LEVEL SIGNING CEREMONY ================

     THE READ. A member cannot sign what they have not read, and the container
     manifest's constraint — *a case-level signature would be a signature over
     something nobody reviewed* — is answered by this op existing and by the
     document it hands back being the WHOLE document rather than a summary of
     it. The sha in the answer is the sha the signature covers. */
  if (op === "casedocument") {
    const caseId = url.searchParams.get("case") || "";
    const ed = url.searchParams.get("edition");
    if (!caseId || !ed)
      return json({ ok: false, reason: "MALFORMED",
                    detail: localize("publication.door.casedocument_requires_case_caseyyyynnnn_and", "casedocument requires case=<CASE-YYYY-NNNN> and edition=<n>") }, 400);
    /* REC-130: the viewer is STAMPED here from the credential and never read
       from the request — the inner URL is built from nothing of the caller's
       but the two keys. The store answers an unsigned document to standing
       and answers everybody else exactly as it answers a case that does not
       exist. */
    const reader = await readerOf();
    if (reader.silent) return storeSilent(reader.silent, reader.correlation);
    /* REC-126 / IC-145: A LIVE GRANT HOLDER is the second party §6A.2's
       precondition admits to an unsigned document. The secret is HASHED HERE
       and only its fingerprint crosses to the store, which judges it through
       the review copy's one live-grant predicate. Absent, the parameter is
       not sent at all and the answer is REC-130's, unchanged.
       R73 (F1, K1874; K2111): the secret is read from the request BODY's `secret` (a POST with a JSON body) and never
       from the address, whose `secret` is not read, compared or hashed and admits nothing. Its fingerprint reaches the
       store in the store request's BODY, never its address. */
    const presented = await bodySecret(body);
    const docSecret = presented !== null ? await sha256Hex(presented) : "";
    const inner = `http://do/casedocument?case=${encodeURIComponent(caseId)}&edition=${encodeURIComponent(ed)}`
      + `&viewer=${encodeURIComponent(reader.viewer)}`;
    const out = await doAnswer(docSecret
      ? stub.fetch(inner, { method: "POST", headers: { "content-type": "application/json" },
                            body: JSON.stringify({ secretSha: docSecret }) })
      : stub.fetch(inner));
    if (out.refused) return storeRefusal(out);
    if (!out.answered) return storeSilent("casedocument", out.correlation);
    const r = out.result;
    /* THE VERDICT IS DECLARED AS A LITERAL, FIRST, rather than inherited
       from the spread. D-240's detector grades a json() site by its first
       boolean-shaped property, and an answer whose verdict arrives only
       inside a spread reads as UNCLASSIFIED — which is a place this
       detector's own subject could hide. The spread still carries the
       store's own `ok`, so the two cannot disagree. */
    if (!r?.ok) return json({ ok: false, ...r }, 404);
    return json({ ok: true, ...r,
                  /* THE STATEMENT TO SIGN, PRINTED. It is the exact bytes
                     `caseRatifyStatement` builds, handed to the member so the
                     signer page, the wizard and a member at a terminal all
                     sign the same thing — the same service `op=ratify`'s own
                     clients get, one altitude up. */
                  sign: { namespace: NS_RATIFY,
                          statement: new TextDecoder().decode(
                            caseRatifyStatement(r.case_id, r.edition, r.doc_sha)) } });
  }
  return null;
}
