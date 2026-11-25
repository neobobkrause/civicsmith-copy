/* pdf-worker — the first member of the function-specific Worker fleet (I6).
 *
 * WHY THIS EXISTS. The plane stays a lean control/record Worker. `unpdf`
 * (pdf.js) is heavy and cannot live in the plane: adding it to the plane's
 * module graph broke 21 miniflare suites, because a bare npm specifier does not
 * resolve in the plane's un-bundled source (MEASUREMENTS.md, 2026-07-31). So the
 * dependency-laden Tier-2 text path moves into THIS dedicated Worker, which the
 * plane calls over a service binding. A fleet, not a monolith.
 *
 * WHAT IT DOES. Given a capture sha and a store namespace, it reads the captured
 * bytes FROM R2 ITSELF (the `CAPTURES` read binding — never handed the bytes,
 * because the document too large to hold in the plane is exactly the document
 * this exists for, I6) and returns the record's I2 structure+text shape — the
 * record's own vocabulary, never a pdf.js object (fleet rule 1). Tier 2 handles
 * the residue Tier 1 cannot decode: CID / no-/ToUnicode fonts, and permission-
 * only ENCRYPTED PDFs (pdf.js decrypts an empty-user-password PDF transparently;
 * CPDF-5).
 *
 * WHAT IT MUST NOT DO (fleet rules 2/3, I6):
 *   - WRITE ANYTHING. No register row, no provenance, no capture, no task. It
 *     returns derived structure and the plane decides what it means; a hop a
 *     component can hand us is a hop a component can invent (D-112). It holds no
 *     STORE (Durable Object) binding, so it structurally CANNOT write the record,
 *     and it never calls .put/.delete on R2 (R37 in `test/structure.test.mjs`:
 *     CAPTURES is only ever .get, and the bucket is unchanged after calls).
 *   - Hold a `PUBLISHED` binding. `CAPTURES` read is the whole of its need; every
 *     Worker inside the private fence must stay named and minimal.
 *   - Be reached by anything but the plane. It has no member-facing surface and
 *     no token classes; the plane's op layer is the authorisation boundary.
 *
 * It versions and deploys SEPARATELY (fleet rule 4): a verification must
 * establish which build ANSWERED for the member as well as the plane — so
 * `GET /version` exists, added by CPDF-9 (IC-33). Until then that rule was
 * UNVERIFIABLE here: nothing on this member's wire named its build, while
 * `wrangler.jsonc` had carried `vars.VERSION` since the member was written and
 * no handler ever read it. D-108 is what that costs — a byte-identical
 * verification of 0.52.0 followed seconds later by `/version` answering 0.51.0,
 * one component out and with no endpoint to ask.
 */

// pdf.js (unpdf) calls Math.sumPrecise, a TC39 Stage-4 proposal present on the
// Workers runtime (workerd) but NOT on node v26.5.0 — the exact
// `Math.sumPrecise is not a function` a CPDF-5 oracle hit running pdf.js in
// node. Guarded so it only defines the function where the runtime lacks it; on
// workerd (where this Worker actually runs) the native one is used. This
// neutralises the runtime artifact the CPDF-5 heed named, in either runtime.
if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = (values) => { let s = 0; for (const v of values) s += v; return s; };
}

import { getDocumentProxy, extractText } from "unpdf";
import { openPdfRange } from "../../bio-plane/src/pdfstructure.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { boundOf, statement } from "../../bio-plane/src/read-bounds.mjs";

/* The member's surface, declared: hand it a capture, get back the I2
 * structure+text shape, and ask it which build is answering. `fleet-member.json`
 * names this table as `surface`. The fleet-coverage instrument that read it
 * (`scripts/coverage.mjs`, D-117) is retired (K739); this module's own suite now
 * holds both routes and refuses every other (R12, R35).
 *
 * `mutating` is FALSE on every row (fleet rule 2: a member ASSERTS nothing).
 * `version` is a GET that reads one env var, so it could not be anything else. */
export const SURFACE = {
  structure: { method: "POST", mutating: false },
  version:   { method: "GET",  mutating: false },
};

/* The Tier-2 envelope (R8, R44). pdf.js pulls the WHOLE document into memory, so a document over this size is declined
 * rather than risking the Worker memory ceiling — and it is declined HONESTLY: the text field comes back `undetermined`
 * (reason "over_envelope", with `bytes` and `limit`), never silently truncated (I6), so the caller can state the size as
 * the reason. The figure is the table's (`READ_BOUNDS`, pdf / worker_bytes; runtime-limits R29-R31), not this module's.
 * MEASURED (G34, T51; `test/envelope-memory.probe.mjs`, raw workerd with the V8 heap limited as the 128 MB isolate limits
 * it): the smallest old space in which `POST /structure` reads at tier 2 is 20 MB for a 23.8 MiB text file in WinAnsi
 * fonts and 64 MiB files of 5 and 300 pages, 21 / 30 / 39 MB for 23 MiB files of 400 / 1,000 / 1,600 text-dense pages;
 * heap plus the file's bytes is at most 84 MB for a 64 MiB file, under 128 MB with 44 MB left for the isolate itself.
 * Overridable via env. */
const DEFAULT_MAX_PDF_BYTES = boundOf("pdf", "worker_bytes");

/* D-478 — THE NAMESPACES THIS MEMBER WILL READ FROM: EXACTLY `bio` OR `scratch`, AND NOTHING ELSE.
 *
 * WHAT WAS WRONG, AND WHY IT IS A RECORD DEFECT RATHER THAN A WRITE DEFECT. The store test here read
 * `/^[a-z0-9_-]+$/i` — "a namespace token" — so `biosmoke`, `Scratch` and any other well-shaped name was accepted
 * and spent as the R2 key prefix `<store>/captures/<sha>`. Nothing was ever written (this member holds no STORE
 * binding and never calls .put/.delete; IC-237 measured it), so the bucket was safe — but the ANSWER was not:
 * a bucket with no key under a prefix that does not exist answers the same 404 `NOT_FOUND` as a capture that is
 * genuinely absent from a real namespace. That is the one conflation CLAUDE.md §1 names outright — *not found* is
 * not *absent* — and it is the worse half of the pair, because the caller reads a fact about the CAPTURE where
 * the truth is a fact about the NAME it asked under. A member that answers NOT_FOUND under a namespace no
 * instance holds is the record claiming more than it can support.
 *
 * WHY THE PLANE'S SPELLING IS HONEST HERE. The plane's set is not per instance: `namespaceGate` holds
 * `Object.freeze(["bio", SCRATCH])` in code, so the fact this member states — "no such namespace exists" — is the
 * same fact on every instance it can be bound to (D-456, C-78.1, IC-237; the member side for `agent-worker` is
 * D-462/IC-253 and this is its I6 half). It is kept here as a COPY because a fleet member cannot import the
 * plane's `index.mjs`, and a copy ages; `test/structure.test.mjs` reads the plane's `NAMESPACES` from its source
 * and requires this set to equal it, so the day the plane gains a namespace this member's suite goes red. The set
 * is exact and case-sensitive for the plane's reason: a Durable Object name, and an R2 key, is an exact string.
 *
 * NOT NAMING ONE IS A DIFFERENT CONDITION and keeps its old code, BAD_STORE — but it is now the condition it
 * always claimed to be: `store` ABSENT or not a string. An empty `store: ""` is a NAMED value and meets
 * NAMESPACE_UNKNOWN with the rest, which is the same line `agent-worker` draws. */
const NAMESPACES = Object.freeze(["bio", "scratch"]);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

function overEnvelopeText(bytes, limit) {
  const marker = { page: null, reason: "over_envelope", font: null, codes: "", count: 0, bytes, limit };
  return { document: "", pages: [], undetermined: [marker], counts: { chars: 0, undetermined: 1 } };
}

/* What tier 2 has done, as counts (R-CLOCK): documents opened by pdf.js and pages decoded. The answer never depends on it. */
const WORK = { opens: 0, pagesDecoded: 0 };
export function tier2Work() { return { ...WORK }; }

/* R10 (fix round 10, cause 8): a file cut before its trailer. pdf.js throws `InvalidPDFException` on it (no trailer names
 * the catalog, so the objects it indexed have no root), and tier 1 cannot decode a font with no ToUnicode, so the whole file
 * answered nothing. The repaired view is the bytes up to the last complete object, with a trailer naming the last catalog
 * found: the objects that are there, without the cross-reference that is not. */
const bytesOf = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const ENDOBJ = bytesOf("endobj"), CATALOG = bytesOf("/Catalog"), STARTXREF = bytesOf("startxref"), PAGES = bytesOf("/Pages");
function indexOfBytes(bytes, pat, from = 0, to = bytes.length) {
  for (let i = from, last = Math.min(to, bytes.length) - pat.length; i <= last; i++) {
    let k = 0;
    while (k < pat.length && bytes[i + k] === pat[k]) k++;
    if (k === pat.length) return i;
  }
  return -1;
}
function lastIndexOfBytes(bytes, pat) {
  for (let i = bytes.length - pat.length; i >= 0; i--) {
    let k = 0;
    while (k < pat.length && bytes[i + k] === pat[k]) k++;
    if (k === pat.length) return i;
  }
  return -1;
}
function latin1(bytes, from, to) {
  let out = "";
  for (let i = Math.max(0, from); i < Math.min(to, bytes.length); i += 512) out += String.fromCharCode(...bytes.subarray(i, Math.min(i + 512, to, bytes.length)));
  return out;
}
/* A file with a trailer ends with `startxref` and its offset, within pdf.js's own search of the file's last two blocks of 512. */
const lacksStartxref = (bytes) => indexOfBytes(bytes, STARTXREF, Math.max(0, bytes.length - 2 * 512)) < 0;

function repairedView(bytes) {
  const end = lastIndexOfBytes(bytes, ENDOBJ);
  if (end < 0) return null;
  const cutAt = end + ENDOBJ.length;
  let root = null;
  for (let at = indexOfBytes(bytes, CATALOG, 0, cutAt); at >= 0; at = indexOfBytes(bytes, CATALOG, at + 1, cutAt)) {
    const m = /(\d+)\s+(\d+)\s+obj\s*<<(?:(?!\bobj\b)[^])*$/.exec(latin1(bytes, at - 256, at));
    if (m) root = `${m[1]} ${m[2]}`;
  }
  if (!root) return null;
  const trailer = bytesOf(`\ntrailer\n<< /Root ${root} R >>\n%%EOF\n`);
  const view = new Uint8Array(cutAt + trailer.length);
  view.set(bytes.subarray(0, cutAt));
  view.set(trailer, cutAt);
  return { view, cutAt };
}

/* The page count the page tree's root declares (its `/Count`), which a cut file may no longer hold the pages of; null when
 * no root states one in the bytes that are there. */
function declaredPages(view) {
  let best = null;
  for (let at = indexOfBytes(view, PAGES, 0); at >= 0; at = indexOfBytes(view, PAGES, at + 1)) {
    const from = lastIndexOfBytes(view.subarray(0, at), bytesOf(" obj"));
    const stop = indexOfBytes(view, ENDOBJ, at);
    const dict = latin1(view, from < 0 ? at : from, stop < 0 ? view.length : stop);
    if (!/\/Type\s*\/Pages\b/.test(dict) || /\/Parent\b/.test(dict)) continue;
    const n = /\/Count\s+(\d+)/.exec(dict);
    if (n) best = Math.max(best ?? 0, Number(n[1]));
  }
  return best;
}

/* pdf.js opens the bytes it is handed and detaches them, so a file that may be cut keeps a copy for the repaired view. */
async function openDocument(bytes) {
  const mayBeCut = lacksStartxref(bytes);
  const spare = mayBeCut ? bytes.slice() : null;
  try {
    return { pdf: await getDocumentProxy(bytes), repaired: null };
  } catch (e) {
    if (!spare || !e || e.name !== "InvalidPDFException") throw e;
    const r = repairedView(spare);
    if (!r) throw e;
    const declared = declaredPages(r.view);
    try {
      return { pdf: await getDocumentProxy(r.view), repaired: { cutAt: r.cutAt, declared } };
    } catch { throw e; }
  }
}

/* unpdf/pdf.js text, reshaped into the RECORD's terms (fleet rule 1): the same
 * `text` shape Tier 1 emits, not pdf.js's. A page pdf.js recovered nothing for
 * is a no-text-layer (scanned/image) page — OCR territory neither tier provides,
 * NAMED as undetermined rather than returned as a silent blank. Only the pages
 * [from, from + count) are decoded (R9, R42); pdf.js opens the document lazily,
 * so the bytes it decodes are the range's. `open` is false for a range with no page in it.
 * On a file cut before its trailer (R10) the pages that cannot be read are named `truncated`, and `partial` is true. */
async function tier2Text(bytes, from, count, open) {
  const pages = [];
  const undetermined = [];
  let partial = false;
  if (open) {
    WORK.opens++;
    const { pdf, repaired } = await openDocument(bytes);
    const total = Math.max(pdf.numPages, repaired?.declared ?? 0);
    const last = Math.min(repaired ? total : pdf.numPages, from + count);
    for (let i = from; i < last; i++) {
      WORK.pagesDecoded++;
      let content = null;
      try {
        content = await (await pdf.getPage(i + 1)).getTextContent();
      } catch (e) {
        if (!repaired) throw e;
      }
      if (!content) {
        const marker = { page: i, reason: "truncated", font: null, codes: "", count: 0 };
        undetermined.push(marker);
        pages.push({ page: i, text: "", undetermined: [marker] });
        partial = true;
        continue;
      }
      const pageText = content.items.filter((item) => item.str != null).map((item) => item.str + (item.hasEOL ? "\n" : "")).join("");
      const u = [];
      if (pageText.trim().length === 0) {
        const marker = { page: i, reason: "no_text_layer", font: null, codes: "", count: 0 };
        u.push(marker);
        undetermined.push(marker);
      }
      pages.push({ page: i, text: pageText, undetermined: u });
    }
    if (repaired) partial = true;
  }
  const document = pages.map((p) => p.text).filter((t) => t.length).join("\n");
  return { text: { document, pages, undetermined, counts: { chars: document.length, undetermined: undetermined.length } }, partial };
}

/* R8 (G124a): the answer for a file over the envelope, made before any parse: tier 1, no text, the size and the limit
 * stated, and final (a retry reads the same file). The sentence is a stand-in keyed through `localize`; its row is owed. */
function overEnvelopeAnswer(size, max) {
  const { key } = statement("pdf", "worker_bytes", size);
  return json({
    ok: true, container: "pdf", tier: 1, failure: "final",
    text: overEnvelopeText(size, max),
    notes: ["tier2_declined_over_envelope"],
    refusal: {
      size, bound: max, key,
      detail: localize("pdf-worker.index.over_envelope", "this document is {size} bytes and this member reads up to {bound} bytes, so its text was not read here.", { size: String(size), bound: String(max) }),
    },
  });
}

/* R42: `from` and `count`, when named, are non-negative integers. */
const wholeNumber = (v) => Number.isSafeInteger(v) && v >= 0;

async function handleStructure(req, env) {
  if (typeof env.CAPTURES?.get !== "function")
    return json({ ok: false, reason: "R2_NOT_CONFIGURED" }, 503);

  const body = await req.json().catch(() => null);
  const sha = typeof body?.capture_sha === "string" ? body.capture_sha.toLowerCase() : "";
  const store = typeof body?.store === "string" ? body.store : "";
  if (!/^[0-9a-f]{64}$/.test(sha))
    return json({ ok: false, reason: "BAD_SHA", detail: "capture_sha must be 64 lowercase hex" }, 400);
  if (typeof body?.store !== "string")
    return json({ ok: false, reason: "BAD_STORE",
                  detail: localize("pdf-worker.index.a_capture_lives_inside_one", "a capture lives inside one namespace and this member guesses none: the caller must say which. A default namespace here would read the real record for a caller who believed it was reading a scratch one.") }, 400);
  /* D-478: a NAMED namespace that is not exactly one of NAMESPACES — `biosmoke`, `Scratch`, the empty string — is
     refused by the plane's own code, with `asked` and `namespaces` beside it, and R2 was never touched. Before
     this, such a name reached R2 as a key prefix and came back NOT_FOUND: a statement about the capture where the
     truth was a statement about the namespace. */
  if (!NAMESPACES.includes(store))
    return json({ ok: false, reason: "NAMESPACE_UNKNOWN",
                  detail: localize("pdf-worker.index.a_capture_is_read_from", "a capture is read from the namespace the caller names, and no namespace by that name exists on any instance this member can be bound to, so nothing was read. There are two: the record itself and a scratch area kept apart for testing, and the name must match one of them exactly; they are listed beside this message. This is NOT the same answer as NOT_FOUND, which says the namespace exists and holds no such capture."),
                  asked: store.slice(0, 80), namespaces: [...NAMESPACES] }, 400);

  /* R42: the range asked, checked after R4 and before R5. */
  if ((body.from !== undefined && !wholeNumber(body.from)) || (body.count !== undefined && !wholeNumber(body.count)))
    return json({ ok: false, reason: "BAD_RANGE", detail: localize("pdf-worker.index.from_and_count_are_whole", "the range asked is two whole numbers, the page to start at and how many pages, neither below zero.") }, 400);
  const from = body.from ?? 0;

  // I1 §2: the R2 key shape, promoted here from documentation to a load-bearing
  // dependency with a second consumer. READ ONLY — never head/put/delete.
  const obj = await env.CAPTURES.get(`${store}/captures/${sha}`);
  if (!obj) return json({ ok: false, reason: "NOT_FOUND", capture_sha: sha, store }, 404);

  /* R6, R8: the size is judged before any parse, and before the body is read when the object states its size. */
  const max = Number(env.MAX_PDF_BYTES) || DEFAULT_MAX_PDF_BYTES;
  if (Number.isFinite(obj.size) && obj.size > max) return overEnvelopeAnswer(obj.size, max);
  const bytes = new Uint8Array(await obj.arrayBuffer());
  if (bytes.length > max) return overEnvelopeAnswer(bytes.length, max);

  /* R6: pdf-reader opens the file once and reads the range asked: no whole-file tier-1 parse beside the tier-2 pass. */
  const opened = await openPdfRange(bytes);
  if (!opened.ok) return json(opened, 422); // NOT_A_PDF / NOT_BYTES — stated, not faked.
  const structure = await opened.range({ from, ...(body.count !== undefined ? { count: body.count } : {}) });
  structure.notes = [...(structure.notes ?? [])]; // pdf-reader's own notes for the range, kept; this member's are appended
  const asked = body.count ?? Infinity;
  /* a range with no page in it opens nothing; a document tier 1 found no page in is still opened, for pdf.js may find them */
  const open = opened.pages === 0 || Math.min(asked, opened.pages - from) > 0;

  try {
    const read = await tier2Text(bytes, from, asked, open);
    structure.text = read.text;
    structure.tier = 2;
    if (read.partial) {
      structure.partial = true;
      structure.notes = [...structure.notes, "pdf_truncated"];
    }
  } catch (e) {
    if (e && e.name === "PasswordException") {
      /* R9: a document that needs a user password is not a tier-2 failure; nothing is invented. */
      structure.text = {
        document: "", pages: [],
        undetermined: [{ page: null, reason: "password_required", font: null, codes: "", count: 0 }],
        counts: { chars: 0, undetermined: 1 },
      };
      structure.tier = 1;
      return json(structure);
    }
    // Tier 2 itself failed (corruption, a runtime artifact): SAY so, keep the
    // structure, do not crash and do not invent text.
    structure.text = {
      document: "", pages: [],
      undetermined: [{ page: null, reason: "tier2_extraction_error", font: null, codes: "", count: 0 }],
      counts: { chars: 0, undetermined: 1 },
    };
    structure.tier = 1;
    structure.notes = [...structure.notes, `tier2_error:${String(e && e.message || e).slice(0, 80)}`];
  }
  return json(structure);
}

/* Fleet rule 4: each member versions and rolls out on its own, so "a deploy
   verified is not a build serving" (D-108) has a second face — the plane can be
   current while the sibling it calls is still serving the previous build, and
   that window is invisible to both. This is how this member answers the question
   about ITSELF, and it is deliberately the same three lines and the same shape
   `agent-worker` answers with (I8): two members answering one question two ways
   is how a rollout gate learns to special-case its fleet.
   The value comes from `env.VERSION` (wrangler.jsonc `vars`), so what it reports
   is the build that is RUNNING and never a constant compiled in beside it. */
function handleVersion(env) {
  return json({ ok: true, name: "pdf-worker", version: env.VERSION || "0.0.0" });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, "");
    if (req.method === "GET" && path === "version") return handleVersion(env);
    if (req.method === "POST" && (path === "structure" || path === "")) {
      return handleStructure(req, env);
    }
    return json({ ok: false, reason: "UNKNOWN", detail: "POST /structure or GET /version only" }, 404);
  },
};
