/* capture — the op handlers the control plane routes to (layers.md ruling 2, K3), moved from `legacy-index` in T4.
 * Routing, authentication and the response envelope stay the control plane's: `json`, `storeSilent`,
 * `storageAbsent`, `requiredArgument`, `doAnswer` (the one reader of a Durable Object's envelope, N247: a body
 * that is not the store's `{ok: true, result}` is not an answer, and a silence is never read as an empty result,
 * REC-52) and `storeRefusal` (control-plane R23's relay of the store's own refusal) are passed in, with the stamps it
 * decided (the caller class, the viewer, the member). `store` is the Durable Object stub the op is scoped to. */
import { normalizeAddress } from "../subresources.mjs";
import { CAPTURE_CHECKS } from "./checks.mjs";
import { say } from "./words.mjs";
import { localize } from "../setup-words/index.mjs";
import { ACQUIRE_GRADE_NOTE, CAPTURE_MAX } from "../acquisition/index.mjs";
import { statement as boundStatement } from "../read-bounds.mjs";
import { PLATFORM_FIGURES } from "../byte-ledger.mjs";
import { createSha256 } from "../record-grammar/index.mjs";

/** R64 (N339, K421): the one way this module's handlers answer what `doAnswer` read that was not an answer. The
 *  store's own refusal (`refused`: `ok: false` below 500, control-plane R23) is relayed with the store's status, code
 *  and sentence, through the caller's `storeRefusal` when it hands one, else as the same answer composed here
 *  (`json(reply.body, reply.status)`, which is what `storeRefusal` answers); only a reply that is no answer is
 *  `storeSilent(op)`, carrying the correlation id `doAnswer` read from the store's internal error, when it gave one
 *  (control-plane R25; N349). A sub-read inside a longer act is relayed the same way (K444). Null when `out` is an
 *  answer. */
export function relayUnanswered(out, op, { json, storeSilent, storeRefusal }) {
  if (out.refused && out.reply)
    return typeof storeRefusal === "function" ? storeRefusal(out) : json(out.reply.body, out.reply.status);
  if (!out.answered) return storeSilent(op, out.correlation);
  return null;
}

/** R27, R29, D-701: op=links. `address=` what points at an address; `capture=` a document's outbound links with their
 *  verdicts; `host=` how a host's navigation changed between captures (R29's per-host read). Every row passes the
 *  caller's viewer before it is counted. */
export async function linksOp(url, store, { json, storeSilent, storeRefusal, doAnswer, viewer }) {
  /* N90: the caller's page, forwarded; the route bounds a read the caller did not. */
  const v = `viewer=${encodeURIComponent(viewer ?? "")}`
    + ["limit", "after"].map((k) => (url.searchParams.get(k) ? `&${k}=${encodeURIComponent(url.searchParams.get(k))}` : "")).join("");
  const address = url.searchParams.get("address");
  const capture = url.searchParams.get("capture");
  const host = url.searchParams.get("host");
  let r;
  if (address) r = await doAnswer(store.fetch(`http://x/linksto?address=${encodeURIComponent(normalizeAddress(address))}&${v}`));
  else if (host) r = await doAnswer(store.fetch(`http://x/navchanges?host=${encodeURIComponent(host)}&${v}`));
  else if (/^[0-9a-f]{64}$/.test(capture || "")) r = await doAnswer(store.fetch(`http://x/resolvelinks?capture=${capture}&${v}`));
  else return json({ ok: false, reason: "NEED_CAPTURE_OR_ADDRESS",
    detail: "pass capture=<sha256> for a document's outbound links, address=<url> for what points at it, "
          + "or host=<host> for how that host's navigation changed between captures" }, 400);
  const unanswered = relayUnanswered(r, "links", { json, storeSilent, storeRefusal });
  if (unanswered) return unanswered;
  return json({ ok: true, ...r.result });
}

/* R63 (N285, K275): the fields `evidenceAbsent` fixes, which a caller's `extra` adds beside and never replaces. */
const EVIDENCE_ABSENT_FIXED = new Set(["ok", "reason", "code", "check", "translation", "sha256", "store"]);

/** R63: THE one answer to one condition, no evidence object is held under a digest, so the code is minted at one site:
 *  this module's R21 get and extraction's R31 answer through it. Answers `{status: 404, body}`, the body
 *  `{ok: false, reason: "EVIDENCE_NOT_HELD", code, check, translation, sha256, store}` and a caller's `extra` fields
 *  beside them; the control plane's envelope sends it. The code was `NOT_FOUND`, a word any module could mint, so the
 *  door could not read this row without lending it to them (N347, K440); its row (C-118.1) and sentence are
 *  unchanged. It writes nothing and never throws. */
export function evidenceAbsent(sha, store, extra = null) {
  let own = [];
  try {
    if (extra && typeof extra === "object" && !Array.isArray(extra))
      own = Object.entries(extra).filter(([k]) => !EVIDENCE_ABSENT_FIXED.has(k));
  } catch { own = []; }
  /* DEC-49 REGION is-evidence-held */
  const row = CAPTURE_CHECKS.EVIDENCE_NOT_HELD;
  return { status: 404, body: { ok: false, reason: "EVIDENCE_NOT_HELD", code: "EVIDENCE_NOT_HELD", check: row.check,
                                translation: row.translation, sha256: sha ?? null, store: store ?? null,
                                ...Object.fromEntries(own) } };
  /* END DEC-49 REGION is-evidence-held */
}

/** R111 (fix round 9; G124b): a ceiling a caller may only LOWER (a scaled figure for a test): the real figure, or the given one when it is a whole number below it. */
const lowered = (real, given) => (Number.isSafeInteger(given) && given >= 0 && given < real ? given : real);

/** R111: the 413 a put over a ceiling is answered with: its size and the figure it was judged against (`size`, `bound`), the sentence's key and the sentence. The
 *  capture ceiling is the archive row of `READ_BOUNDS` (`CAPTURE_MAX`); the request ceiling is the platform's entry of `PLATFORM_FIGURES`; the lower is the one named. */
function putTooLarge(size, request, bound, { storeName, cls }) {
  return { ok: false, reason: "TOO_LARGE", size, bound, bytes: size, maxBytes: bound,
           key: request ? "capture.ops.body_over_request_ceiling" : boundStatement("archive", "uploaded_bytes", size).key,
           detail: request
             ? localize("capture.ops.body_over_request_ceiling", "the body is larger than the {bound} bytes one request may carry, so it was refused whole; nothing was written", { bound: String(bound) })
             : localize("capture.ops.body_over_capture_ceiling", "the body is larger than the {bound} bytes this surface keeps as one capture, so it was refused whole; nothing was written", { bound: String(bound) }),
           store: storeName, tokenClass: cls };
}

/** R21: op=capture, the evidence store by digest. A put whose body hashes to anything else is refused naming both
 *  digests; an object already held is not rewritten; a get answers the bytes (206 for a range) or R63's absence.
 *  `key` is the object key of a digest in this store's namespace.
 *
 *  R111 (fix round 9; G124b): a put is bounded BEFORE its body is held: a length it declares over the ceiling (the lower of `CAPTURE_MAX` and the platform's
 *  request-body entry of `PLATFORM_FIGURES`) is refused 413 naming its size and the figure before one byte is read, and a body that goes past it while it streams is
 *  refused and cancelled. The body is held ONCE (the old read held the request's buffer and a copy for the digest): its bytes are collected into one buffer as they
 *  arrive, hashed as they arrive, and put; the byte `ledger` (`runtime-limits`; none handed, none counted) counts what is held and is empty again when the put is
 *  answered. `bounds` only lowers the figures (a scaled bound for a test). */
export async function captureObjectOp(req, url, env, { json, storageAbsent, requiredArgument, key, storeName, cls, ledger = null, bounds = null }) {
  if (typeof env.CAPTURES?.get !== "function") return storageAbsent("capture", "R2 is not configured on this instance");
  const sha = (url.searchParams.get("sha256") || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha))
    return json({ ok: false, ...requiredArgument("capture", "sha256", "<64 lowercase hex>",
      "capture requires sha256=<64 lowercase hex>") }, 400);
  const k = key(sha);
  if (req.method === "PUT" || req.method === "POST") {
    const capMax = lowered(CAPTURE_MAX, bounds && bounds.capture), reqMax = lowered(PLATFORM_FIGURES.request_body_max.value, bounds && bounds.request);
    const ceiling = Math.min(capMax, reqMax), request = reqMax <= capMax;
    const counting = !!ledger && typeof ledger.hold === "function" && typeof ledger.release === "function";
    let held = 0;
    const hold = (n) => { if (counting && n > 0) { try { ledger.hold(n, "put"); held += n; } catch { /* a ledger that cannot count */ } } };
    const release = () => { if (counting && held > 0) { try { ledger.release(held, "put"); } catch { /* a ledger that cannot count */ } held = 0; } };
    const refuse = async (size) => {
      try { await (req.body && typeof req.body.cancel === "function" ? req.body.cancel() : null); } catch { /* already closed */ }
      return json(putTooLarge(size, request, ceiling, { storeName, cls }), 413);
    };
    try {
      const said = req.headers.get("content-length");
      const declared = typeof said === "string" && /^\d{1,15}$/.test(said.trim()) ? Number(said.trim()) : null;
      if (declared !== null && declared > ceiling) return await refuse(declared);
      let body, total = 0;
      const sum = createSha256();
      if (!req.body) body = new Uint8Array(0);
      else {
        const reader = req.body.getReader();
        /* a declared length is allocated once and filled as the body arrives; with none, the chunks are collected and joined into one buffer at the end */
        let buf = declared !== null ? new Uint8Array(declared) : null;
        if (buf) hold(declared);
        const chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > ceiling) { try { await reader.cancel(); } catch { /* already closed */ } return json(putTooLarge(total, request, ceiling, { storeName, cls }), 413); }
          sum.update(value);
          /* a body longer than its declared length goes on as an undeclared one: what was filled is kept as the first chunk (the ceiling still binds) */
          if (buf && total > buf.length) { chunks.push(buf.subarray(0, total - value.length)); buf = null; }
          if (buf) buf.set(value, total - value.length);
          else { chunks.push(value); hold(value.length); }
        }
        if (buf) body = buf.length === total ? buf : buf.subarray(0, total);
        else {
          body = new Uint8Array(total);
          hold(total);
          let at = 0;
          for (const c of chunks) { body.set(c, at); at += c.length; }
          chunks.length = 0;
        }
      }
      const digest = sum.hex();
      if (digest !== sha)
        return json({ ok: false, reason: "INTEGRITY", detail: localize("capture.ops.body_hash_mismatch", "body hash does not match the sha256 parameter"),
                      expected: sha, got: digest, store: storeName, tokenClass: cls }, 400);
      const existing = await env.CAPTURES.head(k);
      if (existing) return json({ ok: true, sha256: sha, bytes: existing.size, existed: true, store: storeName, tokenClass: cls });
      await env.CAPTURES.put(k, body, { sha256: digest });
      return json({ ok: true, sha256: sha, bytes: body.length, existed: false, store: storeName, tokenClass: cls });
    } finally { release(); }
  }
  const wantRange = req.headers.get("range");
  const obj = await env.CAPTURES.get(k, wantRange ? { range: req.headers } : undefined);
  const dl = (url.searchParams.get("dl") || "").replace(/[^\w.\- ]/g, "").slice(0, 120);
  if (!obj) { const a = evidenceAbsent(sha, storeName, { tokenClass: cls }); return json(a.body, a.status); }
  return new Response(obj.body, {
    status: wantRange ? 206 : 200,
    headers: { "content-type": "application/octet-stream", "access-control-allow-origin": "*", "x-capture-sha256": sha,
               ...(dl ? { "content-disposition": `attachment; filename="${dl}"` } : {}) },
  });
}

/* ---- the archive fallback's decision half (D-99 / ARCHIVE-FALLBACK.md) ----
 *
 * ARCHIVE.ORG IS A BACKUP SOURCE, NEVER A PRIMARY ONE (RULED). This refuses
 * unless the source-failure counter says the document has actually been
 * unreachable: three consecutive failures the SOURCE produced, or a failing
 * run of fourteen days. D-104's exclusion is what makes that fence mean
 * something, because our own governor declining to ask never advances it.
 * Without the fence, sustained politeness would load somebody else's
 * infrastructure to solve a problem we made.
 *
 * It fetches through the same governor as everything else, and its host
 * appetite is set conservatively from THEIR published figures rather than
 * discovered by probing for the wall. Bob, 2026-07-31: there is no need to
 * push traffic to the breaking point; there is plenty of time.
 * (Moved from `legacy-index` beside the op's call, N247.) */
/** R73 (`acquisition` R3): op=archivelookup, forwarded to the service. */
export async function archiveLookupOp(req, url, store, { json, storeSilent, storeRefusal, doAnswer }) {
  const body = req.method === "POST" ? await req.json().catch(() => null) : null;
  const address = body?.address || url.searchParams.get("address");
  const r = await doAnswer(store.fetch("http://x/archivelookup", { method: "POST", headers: { "content-type": "application/json" },
                                                                   body: JSON.stringify({ address }) }));
  const unanswered = relayUnanswered(r, "archivelookup", { json, storeSilent, storeRefusal });
  if (unanswered) return unanswered;
  return json(r.result.body, r.result.status);
}

/* Acquisition: the fetch layer the intake doctrine calls M2'.
 *
 * What it produces is Grade B and says so. The doctrine's Section 3 is
 * precise: Grade B is "the document bytes as fetched by a capable surface,
 * hashed at receipt, with locator and instant", and Grade A requires a WACZ
 * or equivalent chain-of-custody capture of the source as served, which a
 * Worker cannot produce. Claiming A here would be the one thing the grading
 * scheme exists to prevent, since "a claim about evidence is only as strong
 * as its weakest named layer".
 *
 * It writes no bundle state. The doctrine: "No intake path writes live
 * state; the daemon and the member are writers like every writer." So this
 * returns a provenance document and the caller promotes it.
 * (Moved from `legacy-index` beside the op's call, N247.) */
/** R99 (T51; K4234; plane R55): the door's `trace`, handed in process, reaches the store's acquire as the header
 *  `x-civicsmith-trace`, so the object holds this acquire's timings under it (plane #44). Only a printable string of at
 *  most 200 characters is sent (the shape `signin-door` R3 mints); never in the query or the body. None handed, no header. */
const TRACE_HEADER = "x-civicsmith-trace";
const TRACE_VALUE = /^[\x21-\x7e]{1,200}$/;

/** R73 (`acquisition` R1–R23), K72 (11): op=acquire, forwarded to the service with the control plane's stamps. Answers `{response}`
 *  (a refusal, a silence) or `{answer}`, the filed capture's answer, which `extraction` reads from the stored primary
 *  itself (`acquisition` R8, K49; N103: no second read of the primary here). */
export async function acquireOp(req, env, store, { json, storeSilent, storeRefusal, storageAbsent, doAnswer, cls, member, sessMember,
                                                    storeName, trace = null, viewer = null }) {
  if (req.method !== "POST") return { response: json({ ok: false, error: "acquire is a POST" }, 405) };
  if (typeof env.CAPTURES?.put !== "function")
    return { response: storageAbsent("acquire", say("capture.response.group_civicsmith_evidence")) };
  const body = await req.json().catch(() => null);
  /* G32 (R106): the caller's sight, so the held copy the fetch is made conditional on is one this caller may see; none handed sees nothing. */
  const q = new URLSearchParams({ cls: cls || "", member: member ? "1" : "0", sessMember: sessMember || "", store: storeName || "bio",
                                  viewer: typeof viewer === "string" ? viewer : "" });
  const headers = { "content-type": "application/json" };
  if (typeof trace === "string" && TRACE_VALUE.test(trace)) headers[TRACE_HEADER] = trace;
  const r = await doAnswer(store.fetch(`http://x/acquire?${q}`, { method: "POST", headers, body: JSON.stringify(body || {}) }));
  const unanswered = relayUnanswered(r, "acquire", { json, storeSilent, storeRefusal });
  if (unanswered) return { response: unanswered };
  const { status, body: answer } = r.result;
  if (!answer || answer.ok !== true || !answer.document) return { response: json(answer, status) };
  return { answer };
}

/** G27: whether a read after a kept acquire failed (it threw, answered nothing, or was reported by the reader as unanswered with a
 *  `diag`), as against answering, being refused by the store (`response`) or being deferred by the reader's own choice. */
function readFailed(read) {
  if (read && read.response) return false;
  if (!read || read.failed || !read.body || typeof read.body !== "object") return true;
  return read.body.reading_pending === true && !!read.body.diag;
}

/** G27: whether the object said it is overloaded, which Cloudflare says is not to be retried: the flag on a thrown error or on the
 *  reader's `diag`, else the words the platform gives that error. */
function readOverloaded(read) {
  const e = read && read.failed, d = read && read.body && read.body.diag;
  if ((e && e.overloaded === true) || (d && d.overloaded === true)) return true;
  const said = e ? e.message : d ? d.message : "";
  return typeof said === "string" && /overloaded/i.test(said);
}

/** K72 (8): the op's answer, the reading block's findings placed on the document beside the profile, as the answer
 *  always carried them. */
export function withReading(answer, { reading, textUnits, textUnitsOverBound }) {
  const { file, locator, retrieved, profile, ...rest } = answer.document;
  return { ...answer, document: { file, locator, retrieved, profile, reading,
    ...(textUnits ? { text_units: textUnits } : {}), ...(textUnitsOverBound ? { text_units_over_bound: textUnitsOverBound } : {}),
    ...rest } };
}

/** The legacy-index map's §4.4 plain move (K649 (7)): the dispatch of this module's gated ops, `links`, `capture`,
 *  `archivelookup` and `acquire`, moved out of `src/index.mjs`. The control plane routes and authenticates and hands in
 *  what it decided: its envelope helpers (`json`, `storeSilent`, `storeRefusal`, `doAnswer`, `storageAbsent`,
 *  `requiredArgument`), its stamps (`cls`, `member`: a member session, `sessMember`, `viewer`, `storeName`), `key` (a
 *  digest's object key in this store's namespace), `store()` (the Durable Object stub the op is scoped to, reached only
 *  by an op that asks the store) and `readAcquired(answer, store)`, the reading of what an acquire filed, which is
 *  `extraction`'s (its `acquireReadingOp`, a later module this one cannot import): the op forwards to the acquisition,
 *  hands the filed document to the reader and adds only the grade note, running no reading of its own (K72 (8), N265).
 *  Answers the op's Response, or null for an op that is not one of these four. */
export async function captureOp(op, req, url, env, store, h) {
  const { json, storeSilent, storeRefusal, doAnswer } = h;
  if (op === "links") return linksOp(url, store(), { json, storeSilent, storeRefusal, doAnswer, viewer: h.viewer });
  if (op === "capture")
    return captureObjectOp(req, url, env, { json, storageAbsent: h.storageAbsent, requiredArgument: h.requiredArgument, key: h.key,
                                            storeName: h.storeName, cls: h.cls, ledger: h.ledger ?? null, bounds: h.bounds ?? null });
  if (op === "archivelookup") return archiveLookupOp(req, url, store(), { json, storeSilent, storeRefusal, doAnswer });
  if (op === "acquire") {
    const at = store();
    const acquired = await acquireOp(req, env, at, { json, storeSilent, storeRefusal, storageAbsent: h.storageAbsent, doAnswer,
                                                     cls: h.cls, member: h.member, sessMember: h.sessMember, storeName: h.storeName,
                                                     trace: h.trace, viewer: h.viewer });
    if (acquired.response) return acquired.response;
    /* G4 (fix round 6; R73): a capture that is kept is never a failed act. A reading that throws or answers nothing is a deferral the
       answer carries (`reading_pending`, the digest, a `diag` naming the failure, not drawn), logged once for the deploy to name; a
       deferral the reader itself answers is relayed unchanged. */
    /* G27 (B27; K4604): while the acquire's render runs on in the object (`render.state` `pending`) the object's memory is the render's, so the
       kept capture is not read inline: it is answered at once as a deferral by choice (`reading_pending`, no `diag`, nothing failed) and the
       door owes the reading to the ledger as for any deferral. */
    if (acquired.answer.render && acquired.answer.render.state === "pending")
      return json({ ...acquired.answer, reading_pending: true, sha: acquired.answer.document.capture?.sha256 ?? null, note: ACQUIRE_GRADE_NOTE }, 200);
    const attempt = async (stub) => {
      try { return await h.readAcquired(acquired.answer, stub); }
      catch (e) { return { failed: e }; }
    };
    let read = await attempt(at);
    /* G27 (fix round 6; R73): an object reset mid-act leaves the stub that spoke to it answering nothing (Cloudflare: do not reuse a
       stub after it throws). The read is idempotent, so a read that failed is made once more on a fresh stub; an overloaded object is
       left alone, and a second failure is the deferral below. A deferral the reader chose itself carries no `diag` and is not a failure. */
    if (readFailed(read) && !readOverloaded(read)) read = await attempt(store());
    if (read && read.response) return read.response;
    if (!read || !read.body || typeof read.body !== "object") {
      const e = read && read.failed;
      const diag = { name: String((e && e.name) || "Error").slice(0, 80), message: String((e && e.message) || "READING_NOT_ANSWERED").slice(0, 200) };
      try { console.error(JSON.stringify({ capture: "acquire", reading: "deferred", ...diag })); } catch { /* a log that cannot be written */ }
      return json({ ...acquired.answer, reading_pending: true, sha: acquired.answer.document.capture?.sha256 ?? null, diag, note: ACQUIRE_GRADE_NOTE }, 200);
    }
    return json(Object.assign(read.body, { note: ACQUIRE_GRADE_NOTE }), 200);
  }
  return null;
}
