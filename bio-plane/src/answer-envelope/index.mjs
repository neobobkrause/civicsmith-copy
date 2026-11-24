/* answer-envelope: THE SHAPE OF EVERY ANSWER THE PLANE GIVES (R1–R9). Split from `control-plane` by copy with no change
   of meaning (T35-80; K617, K1907, K1943, K1974; `plan/draft-T35-splits.md` C-1): the module-level code of `control-plane/
   index.mjs` that reads none of `makeFetch`'s locals (the page policy, `json` and the D-262 decoration, the REC-52 block,
   the internal-error answer and the row readers), with `checks.mjs` and `families.mjs` beside it. It routes nothing and
   admits no one: `control-plane`, `store-door` and `plane` call it. */
/* R2, R7 (K585 (1)): the composed catalogue and the one reader of a code's row. */
import { CHECK_FAMILIES, CHECK_FAMILY_FILES, dec49Row } from "./families.mjs";
/* R8: the doors' own rows. */
import { DISPATCH_CHECKS, BOOTSTRAP_CHECKS, REPLAY_CHECKS, REQUIRED_ARGUMENT_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R6 (was control-plane R51; DEC-122 (3); N528; F17, K1881): the policy every `text/html` response the plane serves
   carries, so a browser loads no script, style, font, image or connection from another origin and sends nothing
   elsewhere. The pages served (since T47 `interface-shell`'s `interfacePage` at `/` and `/app/*`, the setup page no longer
   served, R16; and the signer page) carry their script and style inline or from their own origin, fetching only `/api`
   on it. `img-src` also admits `blob:` (K3156; `interface-shell` R49's `cs.image`): an object address the page makes
   itself from bytes it holds, which names no other origin; no other directive admits it.
   Since T35 a script runs only by the response's own nonce: `script-src` is `'nonce-<n>'` alone (no `'self'`, no host,
   no `'unsafe-inline'`, no `'unsafe-eval'`), the nonce fresh for every response (128 bits from the platform's CSPRNG),
   and every `<script>` element of the page served is given it here, so the pages run as before and a script they did
   not ship does not. Styles stay inline (`style-src` is not F17's). */
const PAGE_POLICY = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; "
  + "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";
const pagePolicy = (nonce) => `${PAGE_POLICY}; script-src 'nonce-${nonce}'`;
/* R6 (fix round 3, C15, P2.4; K4359): the interface page carries no inline script, so its policy names the shell's versioned script by
   its hash (`interface-shell` exports it) with this origin, and no nonce */
const SCRIPT_HASH = /^sha256-[A-Za-z0-9+/]{43}=$/;
const hashPolicy = (hashes) => PAGE_POLICY + "; script-src " + ["'self'", ...hashes.map((h) => "'" + h + "'")].join(" ");

/* `interfacePage`'s slot (`interface-shell` R1, R2; was `setup-page` R28, K2038): the literal the page holds in each
   script element's `nonce` attribute, which every HTML body served gets the response's nonce in place of, wherever it
   stands. */
const NONCE_SLOT = "__CSP_NONCE__";

/* 16 bytes from `crypto.getRandomValues`, in base64 (CSP's nonce grammar). */
function pageNonce() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b));
}

/* Every `<script …>` start tag of `html` given `nonce="<nonce>"`, replacing any nonce it carried (`interface-shell`'s
   `NONCE_SLOT` among them, whatever the slot's spelling). Read as HTML is tokenised: each tag runs to the first `>`
   outside a quoted attribute value, a comment is passed over whole, and the text of a script, style, textarea or title
   element up to its end tag is never read as tags, so a string spelling `<script` inside a script, an attribute or a
   comment is not a tag. Nothing else of the page changes. */
const MARKUP = /<!--|<\/?[A-Za-z][^\s/>]*/g;
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
const NONCE_ATTR = /\snonce(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?(?=[\s/>])/gi;
function stampScripts(html, nonce) {
  let out = "", i = 0;
  for (;;) {
    MARKUP.lastIndex = i;
    const m = MARKUP.exec(html);
    if (!m) return out + html.slice(i);
    out += html.slice(i, m.index);
    if (m[0] === "<!--") {
      const end = html.indexOf("-->", m.index + 4);
      i = end < 0 ? html.length : end + 3;
      out += html.slice(m.index, i);
      continue;
    }
    /* the tag runs to the first `>` outside a quoted attribute value */
    let j = m.index + m[0].length, quote = null;
    for (; j < html.length; j++) {
      const ch = html[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
    }
    const name = m[0].slice(1).toLowerCase();
    if (name === "script") {
      const attrs = `${html.slice(m.index + m[0].length, j)}>`.replace(NONCE_ATTR, "").slice(0, -1);
      out += `<script nonce="${nonce}"${attrs}`;
    } else out += html.slice(m.index, j);
    if (j >= html.length) return out;
    i = j;
    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, j + 1);
      const stop = close < 0 ? html.length : close;
      out += html.slice(j, stop);
      i = stop;
    }
  }
}

/* An HTML answer leaves with a fresh nonce, its policy naming it and its script elements carrying it; any other answer
   leaves as it came. A body that cannot be read is the door's fault, answered as R5's. */
/* whether an HTML text holds a script element with text of its own (no `src`), whatever its spelling */
const hasInlineScript = (html) => (html.replace(/<!--[\s\S]*?-->/g, "").match(/<script\b[^>]*>/gi) || []).some((tag) => !/\ssrc\s*=/i.test(tag)) || html.includes(NONCE_SLOT);
async function withPagePolicy(res, opts = {}) {
  const type = res && res.headers ? res.headers.get("content-type") || "" : "";
  if (!/^\s*text\/html\b/i.test(type)) return res;
  let text;
  try { text = await res.text(); } catch (e) { return planeInternalError(e, null); }
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  /* R6: hashes handed in by the page's owner, every one well formed, and a page with no inline script: the hash policy, no nonce, the
     page's bytes as shipped. Any other HTML keeps the nonce rule. */
  const hashes = Array.isArray(opts && opts.scriptHashes) ? opts.scriptHashes : [];
  if (hashes.length && hashes.every((h) => typeof h === "string" && SCRIPT_HASH.test(h)) && !hasInlineScript(text)) {
    headers.set("content-security-policy", hashPolicy(hashes));
    return new Response(text, { status: res.status, statusText: res.statusText, headers });
  }
  const nonce = pageNonce();
  headers.set("content-security-policy", pagePolicy(nonce));
  return new Response(stampScripts(text.replaceAll(NONCE_SLOT, nonce), nonce), { status: res.status, statusText: res.statusText, headers });
}

/* N630 (K1717, K1864 (1)): compact JSON, no indentation, so no answer carries whitespace it does not need. */
const json = (o, status = 200) =>
  new Response(JSON.stringify(dec49Attach(o)), {
    status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

/* =========================================================================
 * D-262 — THE CATALOGUE ROW, ATTACHED ON THE WAY OUT. ONE PLACE.
 *
 * WHAT WAS WRONG, MEASURED RATHER THAN SUSPECTED. Twelve `MACHINE_CANNOT_*`
 * fences fire; twelve carry a catalogued C-number and a canned translation
 * (REC-64 wrote eleven of them); **exactly ONE put either on the wire.** That
 * one — `MACHINE_CANNOT_MOVE_VERSION` — is the only site in the family that
 * refuses through a helper that reads the catalogue row. The other eleven build
 * `{ ok: false, reason: "MACHINE_CANNOT_…", detail: … }` by hand, and a hand
 * cannot carry a row it does not read. So a member's agent met the string
 * `MACHINE_CANNOT_RELEASE` and nothing else, which is the exact failure DEC-49
 * exists to prevent, surviving inside the mechanism built to prevent it.
 *
 * WHY A DECORATION AND NOT ELEVEN EDITS — decided by measurement, and the
 * measurement is the reversal cost as much as the write cost. Eleven site edits
 * are eleven places to be right and eleven places to be wrong, and they close
 * ELEVEN sites out of a plane that mints hundreds of refusals in eight
 * separately-written `refuse` closures; the twelfth site proves the per-site fix
 * does not generalise, because it was written and the other eleven still were
 * not. This file already rules on the shape: `doAnswer`'s own header says *"the
 * fix is a CHOKEPOINT, not twenty-four remembered checks, because a rule that
 * must be remembered at every site is a rule that will be forgotten at the
 * twenty-fifth."* `json()` is that chokepoint on the way OUT — **MEASURED
 * 2026-08-09: 118 of `control-plane/index.mjs`'s 125 response returns go through `json()`, and
 * the other 7 are `new Response(...)` returning a 204, a version string, two
 * HTML pages and three byte bodies — not one of them a refusal carrier.** It
 * covers the generic store forward AND the 36 `doAnswer` handlers that never
 * reach that forward. Eleven site edits would have closed the generic forward's
 * eleven and left every one of the 36 exactly as it was.
 *
 * WHAT IT COSTS TO REVERSE: delete this block and the one call above. Nothing
 * else in the plane depends on it, because nothing in the plane READS these
 * three fields — they exist for the caller. That is the asymmetry that decided
 * it: the decoration's blast radius is one function, and eleven site edits'
 * blast radius is eleven member-facing methods.
 *
 * WHAT IT DELIBERATELY DOES NOT DO, and each is a fence rather than an omission:
 *
 *   - **IT NEVER OVERWRITES.** A field already present is left exactly as the
 *     site wrote it. So a site that says something DIFFERENT from the catalogue
 *     is not silently corrected into agreement — R2's tests
 *     (`test/m/answer-envelope/envelope.test.mjs`) drive a field already present
 *     and see it kept. A decoration that overwrote would make a comparison of
 *     what the caller RECEIVED against the row unable to fail, which is the
 *     "equality that costs nothing" this project refuses.
 *   - **IT NEVER INVENTS.** A code with no catalogue row is left bare and is
 *     reported by the instrument as census. Untranslated codes are REC-64's
 *     remaining sweep; making one up here would hide that work rather than do
 *     it.
 *   - **IT ADDS NO CODE OF ITS OWN**, so it mints nothing DEC-49 must catalogue
 *     and it moves no floor in the guard.
 *   - **IT DOES NOT MAKE A SITE'S CODE INVISIBLE.** Every code stays a STRING
 *     LITERAL at its site; arm C of the DEC-49 guard still COMPARES it. This
 *     decoration is downstream of the guard's whole subject and replaces none
 *     of it.
 *
 * REACH, STATED PLAINLY BECAUSE IT IS NOT TOTAL: this covers what leaves through
 * `json()`. The eight `new Response(...)` returns in `control-plane/index.mjs` (bytes, HTML, the
 * setup and signing pages) do not pass through it and are not refusal carriers;
 * a future one that IS would be outside this and is exactly what the
 * instrument's op sweep would find.
 * ========================================================================= */

/* A REFUSAL is `ok: false` carrying a code — and `ok: false` is required rather
   than inferred from the presence of a `reason`, because an ANSWER may carry a
   `reason` field for something that is not a refusal at all, and decorating one
   of those would put a member-facing sentence on a success. A refusal shape that
   does NOT say `ok: false` is therefore out of reach here, and the instrument
   prints it rather than quietly covering for it. */
function dec49Decorate(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return;
  if (r.ok !== false) return;
  const code = typeof r.reason === "string" ? r.reason
             : typeof r.code === "string" ? r.code : null;
  if (!code) return;
  const row = dec49Row(code);
  if (!row) return;
  if (r.code === undefined) r.code = code;
  if (r.check === undefined) r.check = row.check;
  if (r.translation === undefined) r.translation = row.translation;
}

/* TWO LEVELS AND NO MORE. The control plane answers a refusal in exactly two
   shapes: its own, at the top level, and the store's, forwarded UNDER `result`
   by the generic tail (the Durable Object's envelope is `{ok:true, result:…}`
   even when the method inside it refused, which is precisely why `result.ok`
   has to be looked at). A general deep walk would reach into arrays of rows and
   sub-objects that are DATA rather than refusals — `residue` entries, per-part
   verdicts, a run's steps — and put a member-facing sentence on something no
   member is being refused. Bounded on purpose. */
function dec49Attach(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  dec49Decorate(o);
  if (o.result && typeof o.result === "object") dec49Decorate(o.result);
  return o;
}

/* ===============================================================   REC-52: A FAILURE TO ANSWER IS NOT AN ANSWER, AND THE PLANE MUST NOT
   CONVERT ITS OWN INTO A CLAIM ABOUT THE RECORD.
   ===============================================================
   THE DEFECT THIS CLOSES, stated once so the next reader does not have to
   reconstruct it. The Durable Object answers in exactly one envelope:

       { ok: true,  result: <whatever the method returned> }        // it answered
       { ok: false, error: <stack> }                       500      // it threw
       { ok: false, error: "unknown op: <op>" }            400      // no such method
       { ok: false, reason: "BAD_JSON", detail: … }        400      // unreadable body

   Twenty-four handlers in `control-plane/index.mjs` used to read `.result` off that envelope
   WITHOUT LOOKING AT `ok`, and JavaScript makes both failure modes silent:

     - `json({ ok: true, ...out.result })` spreads `undefined`, which is a
       no-op, so what leaves the control plane is `{ok:true}` at HTTP 200 —
       a SUCCESSFUL envelope carrying nothing. Section 7a (`op=verify`) was
       the measured instance, and UI-37 could not fix its own defect by making
       the transport throw on `ok:false` BECAUSE THERE WAS NO `ok:false` TO
       THROW ON; the motivating case sailed straight past.

     - `(c || { reason: "NOT_PUBLISHED" })` and `if (!v || !v.published)
       return notFound()` turn an absent answer into a SUBSTANTIVE NEGATIVE:
       the plane telling a stranger that the record does not hold that part,
       when in fact the plane failed to ask. This is the defect this project
       ranks worst — the record asserting something it does not know — and it
       sits at the layer BENEATH every surface, where no surface can correct
       it. A surface that faithfully renders what it received will faithfully
       render a lie.

   THE FIX IS A CHOKEPOINT, not twenty-four remembered checks, because a rule
   that must be remembered at every site is a rule that will be forgotten at
   the twenty-fifth. `doAnswer` is the ONLY place in `control-plane/index.mjs` that opens a
   Durable Object envelope, and R3's tests (`test/m/answer-envelope/envelope.test.mjs`)
   drive every relay with a store that answers nothing, a non-JSON body, a stack and
   its own refusal.

   `answered` is `ok === true` AND NOTHING ELSE. It is deliberately NOT
   "result is present and non-empty": a store method may legitimately answer
   `null`, `[]` or `{}`, and treating a real empty answer as a non-answer
   would be this same collapse running in the opposite direction — which is
   one character away and is asserted against in its own arm.

   WHAT THE CALLER IS TOLD, and why it says so little. `storeSilent` reports
   the state of the EXCHANGE and makes no statement about the record at all,
   because there is none to make. It does NOT echo the Durable Object's
   `error`: that field is a raw stack trace (`String(e && e.stack || e)`),
   and every op below that can reach this refusal — verify, publishedcase,
   publishedbytes, publishedmanifest, bootstrap — is reachable with NO
   credential of any kind. An anonymous stack trace is a disclosure, and a
   diagnostic a stranger cannot act on is not worth one. */
const STORE_SILENT_REASON = "STORE_DID_NOT_ANSWER";
const STORE_SILENT_DETAIL =
  localize("answer-envelope.index.this_teams_civicsmith_could_not", "this team's Civicsmith could not consult its own record, so nothing here is a statement about the record. It is NOT a claim that what you asked for is absent, unpublished, unknown or refused — those are answers, and this is the absence of one. The question stands unanswered; ask again.");

/* Takes the Response (or a promise of one) from a Durable Object stub fetch and
   returns `{ answered, result }`. A body that is not JSON at all is not an
   answer either, which is why the parse is guarded rather than allowed to throw
   into whatever catch happens to be nearest.
   R3 (K421): a JSON reply with `ok: false` below 500 is the store's OWN REFUSAL (`BAD_JSON`, `unknown op: <op>`), not
   a silence: it comes back `refused`, and `reply` (its status and envelope) is what a relay answers with. An `ok: false`
   at 500 or above is the store's catch, whose `error` is a stack (control-plane R30): a silence, never relayed. An
   answer carries its `reply` too, so a relay keeps the store's status and envelope without opening the reply a second
   time. */
async function doAnswer(res) {
  let r = null, out = null;
  try { r = await res; out = await r.json(); } catch { out = null; }
  if (!out || typeof out !== "object" || Array.isArray(out)) return { answered: false, result: undefined };
  const reply = { status: typeof r.status === "number" ? r.status : 200, body: out };
  if (out.ok === true) return { answered: true, result: out.result, reply };
  if (out.ok === false && reply.status < 500) return { answered: false, refused: true, result: undefined, reply };
  /* R5 (N333): the store's own internal error carries a correlation id, which the silence carries on (and nothing else
     of the store's envelope), so an operator can find the logged stack. */
  const correlation = out.reason === "STORE_INTERNAL_ERROR" && typeof out.correlation === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(out.correlation) ? out.correlation : undefined;
  return correlation ? { answered: false, result: undefined, correlation } : { answered: false, result: undefined };
}

/* R3 (K421): the store's own refusal, relayed with its status, code and sentence; `extra` is what the relay adds (R1). */
function storeRefusal(out, extra = {}) {
  return json({ ...out.reply.body, ...extra }, out.reply.status);
}

/* 502 rather than 500: the control plane is intact and reachable — what failed
   is the store BEHIND it, which is precisely the distinction this refusal
   exists to draw. `op` is named so an operator reading a log knows which read
   went silent without the answer implying anything about what it was reading. */
/* D-561 (C-69.2): THE CODE IS NOW A STRING LITERAL AT THIS SITE and carries its canned translation, because every
   public read meets this refusal and its reader is often a member of the public. `STORE_SILENT_REASON` still names
   the same code for the three post-commit sub-reports in `ratify` and `recordcasemanifest` — the SAME condition
   (the store did not answer), stated inside an answer rather than refused; the DEC-49 guard's arm G declares the two
   spellings one condition by name. The wire only GAINS `code`, `check` and `translation`. */
/* R5 (N333): `correlation`, when `doAnswer` read one from the store's own internal error, is carried. */
function storeSilent(op, correlation = undefined) {
  /* DEC-49 REGION is-store-silent */
  return json({ ok: false, reason: "STORE_DID_NOT_ANSWER", ...dispatchRow("STORE_DID_NOT_ANSWER"),
                op, detail: STORE_SILENT_DETAIL, correlation }, 502);
  /* END DEC-49 REGION is-store-silent */
}

/* R3, R4 (D-679): a store answer RELAYED to the caller. `claim`, `login`, `invitelook` and `enroll` answered
   `json(await r.json(), 200)` — the store's envelope at HTTP 200 WITHOUT READING `ok`, so a store that failed told an
   anonymous caller "success" in the status line. An answer (a refusal the store returned inside `ok: true` included)
   is re-wrapped in the envelope the store answers, `{ok: true, result}`, at the store's own status; the store's own
   refusal (R3) is relayed at its status; anything else is `storeSilent`, never 200. */
async function relayAnswer(res, op) {
  /* REC-52: the store's envelope is opened by `doAnswer` and nowhere else. */
  const out = await doAnswer(res);
  if (out.refused) return storeRefusal(out);
  if (!out.answered) return storeSilent(op, out.correlation);
  return json({ ok: true, result: out.result }, out.reply.status);
}

/* D-629 / DEC-49 (C-69.3, R5) — THE WORKER'S OUTERMOST CATCH, which it did not have: a throw anywhere in the door
   reached the Workers runtime as an uncaught exception (the platform's own error page), no BIO answer at all. A throw
   is logged server-side with its stack under a CORRELATION id, and the caller receives the code, the canned
   translation and the id — no stack, no message, no path. A named refusal is RETURNED, never thrown, so none passes
   through here. */
function planeInternalError(e, req) {
  const correlation = crypto.randomUUID();
  let op = "";
  try { const u = new URL(req.url); op = u.searchParams.get("op") || u.pathname; } catch { /* no op to name */ }
  const answer = planeInternalAnswer(correlation);
  /* The log line names the code by READING the answer, never by a second literal. */
  try {
    console.error(JSON.stringify({ event: answer.reason, correlation, op: String(op).slice(0, 200),
                                   stack: String(e && e.stack || e) }));
  } catch { /* a log that cannot be written never changes what the caller is told */ }
  return json(answer, 500);
}
function planeInternalAnswer(correlation) {
  /* DEC-49 REGION is-plane-internal-error */
  return { ok: false, error: "internal error", reason: "PLANE_INTERNAL_ERROR", ...dispatchRow("PLANE_INTERNAL_ERROR"),
           correlation };
  /* END DEC-49 REGION is-plane-internal-error */
}

/* D-512: C-66.6's row — a replay the plane could not verify — on `identityFenceRow`'s shape and its refusal to invent. */
const replayRow = (code) => {
  const row = REPLAY_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`replayRow: ${code} has no REPLAY_CHECKS row with a canned translation `
                  + `(DEC-49). A code with no sentence behind it must not reach a member.`);
  return { code, check: row.check, translation: row.translation };
};

/* D-270 / C-61 (control-plane R39; moved from legacy-index with the row, K621, K636): the argument complaint's row
   reader, `admissionRow`'s shape and its refusal to invent — a code with no sentence behind it throws here rather than
   reaching a member. */
const requiredArgumentRow = (code) => {
  const row = REQUIRED_ARGUMENT_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`requiredArgumentRow: ${code} has no REQUIRED_ARGUMENT_CHECKS row with a canned `
                  + `translation (DEC-49). A code with no sentence behind it must not reach a member.`);
  return { code, check: row.check, translation: row.translation };
};

/* THE ARGUMENT COMPLAINT (C-61). ONE code for the whole condition with the argument in `argument` and the shape in
 * `shape`, rather than a row per op — `AI_BEYOND_TASK_SCOPE` is the standing precedent for one code whose producers
 * are told apart by a field. A HELPER and not edited sites, for the `where` field's sake: a DEC-49 row holds ONE
 * `where` naming the SMALLEST SPAN. Every module that answers this complaint is handed this one function. */
function requiredArgument(op, argument, shape, error) {
  /* DEC-49 REGION is-required-argument
   * THE SPAN `REQUIRED_ARGUMENT_MISSING` names. Code a STRING LITERAL at its site. `error` is passed in BYTE-IDENTICAL
   * from the call site, so every legacy sentence survives unaltered and no consumer reading `error` moves. */
  return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING",
           ...requiredArgumentRow("REQUIRED_ARGUMENT_MISSING"),
           error, op, argument, shape,
           detail: localize("answer-envelope.index.op_op_needs_argument_in", "op={op} needs '{argument}' in the shape {shape}, and this request carried none the operation could use. Nothing was changed.", { op: String(op), argument: String(argument), shape: String(shape) }) };
  /* END DEC-49 REGION is-required-argument */
}

/* D-278 / C-68 and C-69: the same reader again, one per family, and the same
   refusal to invent. */
/* C-68.2–.4 are held here (R8; raised by `control-plane`, its R15). */
const installationRow = (code) => {
  const row = BOOTSTRAP_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`installationRow: ${code} has no BOOTSTRAP_CHECKS row with a canned translation `
                  + `(DEC-49). A code with no sentence behind it must not reach a member.`);
  return { code, check: row.check, translation: row.translation };
};
/* R14 (T47; DEC-198 (3), K3030): C-69.6 retired. Until `control-plane` answers through `credentials.disclosureDue` (its
   R65, T47-65) its door still mints `DISCLOSURE_DUE` through this reader; the code's row is then the one R2 decorates it
   with (`credentials`' C-29.40, read from the families), never a row of this table. No other code is answered so. */
const dispatchRow = (code) => {
  if (code === "DISCLOSURE_DUE") {
    const held = dec49Row(code);
    if (held && held.check !== "C-69.6") return { code, check: held.check, translation: held.translation };
  }
  const row = DISPATCH_CHECKS[code];
  if (!row || typeof row.translation !== "string" || !row.translation)
    throw new Error(`dispatchRow: ${code} has no DISPATCH_CHECKS row with a canned translation `
                  + `(DEC-49). A code with no sentence behind it must not reach a member.`);
  return { code, check: row.check, translation: row.translation };
};

/* Some of these reads happen INSIDE a per-item renderer that returns a rendered
   object rather than a Response, so it has no way to refuse on its own behalf.
   Rather than let it fabricate a rendering from an answer it never got, it
   throws this and the handler that owns the Response turns it into the same
   refusal. A sentinel class and not a bare string, so a genuine crash on the
   same path is re-thrown instead of being reported as a polite silence. */
class StoreSilent extends Error {
  constructor(op) { super(word("publication.super.store_did_answer", { op: String(op) })); this.op = op; }
}

export { PAGE_POLICY, pagePolicy, withPagePolicy, NONCE_SLOT, json, dec49Attach, dec49Row, CHECK_FAMILIES, CHECK_FAMILY_FILES,
         doAnswer, storeRefusal, storeSilent, relayAnswer, STORE_SILENT_REASON, STORE_SILENT_DETAIL,
         planeInternalError, planeInternalAnswer, replayRow, requiredArgumentRow, requiredArgument, installationRow,
         dispatchRow, StoreSilent };
export { DISPATCH_CHECKS, BOOTSTRAP_CHECKS, REPLAY_CHECKS, REQUIRED_ARGUMENT_CHECKS } from "./checks.mjs";
