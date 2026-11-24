/* public-read — the door's half of the public read path (requirements: `build/requirements/public-read.md` R1, R4, R5,
 * R9, R10, R18, R21, R25, R30). Moved from `src/index.mjs` (the legacy-index map's §4.4 move, K649 (7); §12.2): the `verify` and
 * `publishedmanifest` arms, the REC-22 note, and the `publishedcase`/`publishedbytes` dispatch line, which hands both
 * to the Worker's `publishedRoutes` (`../publication/worker.mjs`, this module's by `paths`, K697, K702).
 * `bindPublishedPlane`'s hook hand-over stays the door's.
 *
 * `publicReadDoorOp(op, url, env, stub, helpers)` answers one of its ops, or null for any other, so the door
 * asks it and goes on. `helpers` are the door's own (`control-plane`'s, later in the order, handed in as
 * `capturePublicOp` is): `json`, `requiredArgument`, `storeSilent`, `storeRefusal`, `doAnswer`; and, optionally,
 * `publicReads`, the names of the registered reads the door routes as ops of their own (R18).
 *
 * R18: A REGISTERED PUBLIC READ is reached as `op=publicread&name=<name>`, or as `op=<name>` when the door names it in
 * `publicReads` (op-declarations declares it `classes: null`; `control-plane` R45 routes it), both through
 * `publicReadDoorRead`. Either way it is served as the four ops above are, under R10's terms: from the published store
 * the door hands in (`stub`, pinned to `bio`), with no credential. No header is forwarded, and of the query only the
 * parameters that carry neither a credential nor a stamp; the store side then hands the read only those it declared.
 *
 * R21: THE DOCKET AND ITS FEED, `op=docketpublic&case=<case>` and `op=docketfeed&case=<case>`, through
 * `publicReadDoorDocket`, under the same terms: the published store the door hands in, no credential, and of the query
 * only `case`, and for the docket `captures=omit` (R25), forwarded only when it is exactly that.
 *
 * R30: THE CREDIT PAGE, `op=credit`, answered here from `./credit.mjs` at 200 with no credential and no store hop: it
 * reads nothing of the group's record, so it is the same bytes for every group's Civicsmith and every caller. */

import { publishedRoutes } from "../publication/worker.mjs";
import { PUBLIC_READ_NAME, PUBLIC_READ_RESERVED_PARAMS, PUBLIC_READ_NOT_REGISTERED, DOCKET_FEED_MEDIA_TYPE } from "./reads.mjs";
import { creditPage } from "./credit.mjs";

export const PUBLIC_READ_DOOR_OPS = Object.freeze(["verify", "publishedmanifest", "publishedlist", "publishedcase", "publishedbytes",
                                                   "publicread", "docketpublic", "docketfeed", "credit"]);

/** R21 (DEC-116 item 8; DEC-100 item 2): a case's docket (`docketpublic`, JSON at 200) or its Atom feed (`docketfeed`,
 *  the feed's own bytes at 200 under `application/atom+xml`), relayed from the published store under R10's terms: only
 *  `case` is forwarded (and, R25, `captures=omit` for the docket), and no header. No `case` is the required-argument
 *  refusal (400). A case the docket answers null for is the store's `NOT_PUBLISHED`, relayed at 404 exactly as `op=publishedcase` relays it for an absent case, so
 *  the two answers are the same bytes. R9: the store's own refusal through `storeRefusal`; a reply that is no answer is
 *  `storeSilent`'s. */
export async function publicReadDoorDocket(op, url, env, stub, { json, requiredArgument, storeSilent, storeRefusal, doAnswer }) {
  const c = (url.searchParams.get("case") || "").trim();
  if (!c)
    return json({ ok: false, ...requiredArgument(op, "case", "<a published case's id>"),
      error: `${op} requires case=<a published case's id>` }, 400);
  /* R25 (DEC-101 (3)): the docket without its captures' bytes, for a citing copy's daily read; any other value of
     `captures` is not forwarded. */
  const q = new URLSearchParams({ case: c });
  if (op === "docketpublic" && url.searchParams.get("captures") === "omit") q.set("captures", "omit");
  const out = await doAnswer(stub.fetch(new Request(`http://do/${op}?${q}`)));
  if (out.refused) return storeRefusal(out);
  if (!out.answered) return storeSilent(op, out.correlation);
  const r = out.result;
  /* An answer with nothing in it is a silence wearing an answer's envelope (as at `publishedcase`), never a claim. */
  if (!r || typeof r !== "object" || typeof r.ok !== "boolean") return storeSilent(op);
  if (!r.ok) return json({ ok: false, ...r }, 404);
  if (op === "docketpublic") return json(r, 200);
  if (typeof r.feed !== "string") return storeSilent(op);
  return new Response(r.feed, { status: 200, headers: {
    "content-type": DOCKET_FEED_MEDIA_TYPE, "access-control-allow-origin": "*" } });
}

/** R18: one registered read, relayed from the published store under R10's terms. A name that is not a read's spelling
 *  is the required-argument refusal (400); an unregistered name is the store's `PUBLIC_READ_NOT_REGISTERED`, relayed at
 *  404; a read's own refusal at 400; the read's answer at 200, as `{ok: true, read, module, result}`. R9: the store's
 *  own refusal is relayed through `storeRefusal`, and a reply that is no answer is `storeSilent`'s. */
export async function publicReadDoorRead(name, url, env, stub, { json, requiredArgument, storeSilent, storeRefusal, doAnswer }) {
  if (typeof name !== "string" || !PUBLIC_READ_NAME.test(name))
    return json({ ok: false, ...requiredArgument("publicread", "name", "<a registered read's name: lowercase letters and digits>"),
      error: "publicread requires name=<a registered read's name: lowercase letters and digits>" }, 400);
  const q = new URLSearchParams();
  q.set("name", name);
  for (const [k, v] of url.searchParams) if (!PUBLIC_READ_RESERVED_PARAMS.includes(k)) q.append(k, v);
  const out = await doAnswer(stub.fetch(new Request(`http://do/publicread?${q}`)));
  if (out.refused) return storeRefusal(out);
  if (!out.answered) return storeSilent("publicread", out.correlation);
  const r = out.result;
  /* An answer with nothing in it is a silence wearing an answer's envelope (as at `publishedcase`), never a claim. */
  if (!r || typeof r !== "object" || typeof r.ok !== "boolean") return storeSilent("publicread");
  if (r.ok === false) return json(r, r.reason === PUBLIC_READ_NOT_REGISTERED ? 404 : 400);
  return json(r, 200);
}

export async function publicReadDoorOp(op, url, env, stub, helpers) {
  const { json, requiredArgument, storeSilent, storeRefusal, doAnswer, publicReads } = helpers;
  /* REC-22: THE PUBLIC READ PATH. Anyone, no token, no session, and — the
     part that matters — nothing withheld, because there is nothing here
     that was not deliberately published.

     WHY THIS IS SAFE WITHOUT A CREDENTIAL, stated once for both ops: every
     byte either op can reach comes from the published projection —
     published_bundles, published_shas, published_edges, and the PUBLISHED
     bucket, which the ratification act is the only writer of. The fence is
     structural in two independent layers (a table set and a bucket
     boundary), so it does not depend on a predicate being remembered. That
     is the property this module's R10 states those tables are read for, and REC-30's
     sweep classifies both ops as deliberately ungated for exactly it.

     PINNED TO `bio`, like op=verify and op=publishedmanifest below: an
     instance has ONE published record. A probe's `scratch` namespace has its
     own Durable Object and its own PUBLISHED prefix and is therefore NOT
     readable here, which is deliberate — rehearsing a publication must not
     put anything on the public surface. */
  /* 7a. Anyone, no token, no session. The DO consults only the
     published projection. */
  if (op === "verify") {
    const sha = (url.searchParams.get("sha256") || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha))
      /* D-278: C-61.1. `error` is written as a KEY here rather than passed into the helper, so the
         sentence stays readable at its site; the key after the spread is the one on the wire,
         byte-identical to the pre-D-278 answer, and `door.test.mjs`' R1 arm holds that whole answer. */
      return json({ ok: false, ...requiredArgument("verify", "sha256", "<64 lowercase hex>"),
        error: "verify requires sha256=<64 lowercase hex>" }, 400);
    /* REC-52, SITE (a). This read used to be
         `const out = await r.json(); return json({ ok: true, ...out.result }, 200);`
       with no look at `out.ok`, so a store failure left the plane as an
       HTTP 200 SUCCESS carrying nothing — no `published`, no `sha256`, no
       `matches` — and D-197's public verification surface rendered that as
       "NOT PUBLISHED … a hash that was never ratified and a hash that never
       existed are the same answer here, deliberately", a sentence that is
       true of a real absence and false of a silence. */
    const out = await doAnswer(stub.fetch(new Request(`http://do/verify?sha256=${sha}`)));
    if (out.refused) return storeRefusal(out);
    if (!out.answered) return storeSilent("verify", out.correlation);
    return json({ ok: true, ...out.result }, 200);
  }
  /* Section 8.2. Anyone, no token, no session, and nothing to withhold.
     Published material is content-addressed and its hashes are public, so
     any member or any stranger rebuilds and independently verifies the
     published record without this instance's cooperation, permission, or
     continued existence. Reads the published projection ONLY, exactly as
     op=verify above does, which is the whole safety of an open endpoint:
     working material is never consulted, so there is nothing to leak. */
  if (op === "publishedmanifest") {
    /* REC-52, and this one was NOT in the item's scope — the sweep found
       it. The re-wrap read `result: (await r.json()).result`, so a store
       failure produced `{ok:true, result:undefined}`, and `JSON.stringify`
       DROPS an undefined value: `{ok:true}` at HTTP 200 again, by a
       different route from section 7a's spread. This is the op that fills
       the published INDEX, so the rendered consequence was the whole
       record rather than one hash — which is the shape UI-37 measured as
       the worst of its three. The WRAPPED envelope is preserved on the
       success path (`door.test.mjs`' R4 arm holds that it is not flattened). */
    const out = await doAnswer(stub.fetch(new Request("http://do/publishedmanifest")));
    if (out.refused) return storeRefusal(out);
    if (!out.answered) return storeSilent("publishedmanifest", out.correlation);
    return json({ ok: true, result: out.result }, 200);
  }
  /* R2 (fix round 10, walk E R56-4; K5290): the published list is public (op-declarations `publishedlist`, classes null),
     so the door answers it here, as `verify` answers its store read: the list's own fields spread beside `ok`, the
     shape the screens read (`cases`, `bundles`). Unclaimed, it fell through to the bootstrap report. */
  if (op === "publishedlist") {
    const out = await doAnswer(stub.fetch(new Request("http://do/publishedlist")));
    if (out.refused) return storeRefusal(out);
    if (!out.answered) return storeSilent("publishedlist", out.correlation);
    return json({ ok: true, ...out.result }, 200);
  }
  if (op === "publishedcase" || op === "publishedbytes") return publishedRoutes({ op, url, env, stub });
  /* R21: the docket and its feed, by case. */
  if (op === "docketpublic" || op === "docketfeed") return publicReadDoorDocket(op, url, env, stub, helpers);
  /* R30 (DEC-146): the credit page, the same bytes for every caller; it reads nothing, so the store is not asked. */
  if (op === "credit") return json(creditPage(), 200);
  /* R18: a registered read, by `name`, or by its own op where the door names it. */
  if (op === "publicread") return publicReadDoorRead(url.searchParams.get("name") || "", url, env, stub, helpers);
  if (publicReads && typeof op === "string" && !PUBLIC_READ_DOOR_OPS.includes(op)
      && (Array.isArray(publicReads) ? publicReads.includes(op) : typeof publicReads.has === "function" && publicReads.has(op)))
    return publicReadDoorRead(op, url, env, stub, helpers);
  return null;
}
