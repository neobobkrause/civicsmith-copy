/* A client-rendered application, where the served HTML is a shell.
 *
 * MEASURED, oaklandca.opengov.com/transparency, 2026-07-30: the capture succeeded,
 * the bytes hashed clean, and the document carried ZERO anchors and no evidentiary
 * content of any kind. Everything a member would have wanted to cite is assembled
 * by script in a browser after the bytes arrive.
 *
 * This handler exists to say so, loudly, at capture time. It is the one case where
 * a technically perfect capture is evidentially worthless, and the danger is
 * specific: the bytes are stable, they hash consistently, monitoring will report
 * "unchanged" forever, and the record will look diligent while holding nothing.
 * Silence here is worse than any of the other failures in this package, because
 * every other one is noisy.
 *
 * Per the standing ruling, JS-rendered content IS the content and must be captured
 * as evidence at the SAME GRADE as the rest of the document, because the render
 * happened in the site's own execution environment at capture time. That needs the
 * browser-rendering path, and until a capture takes that path on this kind of
 * document, this handler's job is to report that what was captured is a shell.
 */
import { CONFIDENCE } from "../recogniser.mjs";
import { factsOf } from "../scan.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
/** @import { Confidence, Detection } from "../recogniser.mjs" */
/** @import { StackContext, StackHandler, Rule } from "../region.mjs" */

/* The signal a body with no links and no prose reports. It is read here once, so the
   check that counts it compares with the same reading the signal was written with. */
const NO_PROSE = localize("site-profiles.client-rendered.no_links_and_no_prose_in_the", "no links and no prose in the body");

/** @type {{ shell: boolean, warning: string, kind: (ctx: StackContext, confidence?: Confidence) => (string | undefined), rules: () => Rule[], renderCritical: () => boolean, ignorable: () => boolean } & StackHandler} */
const handler = {
  key: "client_rendered",
  label: localize("site-profiles.client-rendered.an_application_that_builds_its", "an application that builds its pages in the browser"),
  version: 1,
  textual: true,
  /* The flag a capture path reads to decide whether the served bytes are worth
     treating as the document at all. */
  shell: true,

  /* Linear in the text (R20): the tags and the markers are read once, by `scan.mjs`. */
  /** @param {StackContext} ctx @returns {Detection} */
  detect(ctx) {
    const f = factsOf(ctx);
    /** @type {string[]} */
    const signals = [];
    if (f.mount) signals.push("an empty mount point");
    if (f.marks.has("next_data")) signals.push("Next.js data island");
    if (f.marks.has("ng_version")) signals.push("Angular");
    if (f.marks.has("react_root")) signals.push("React root");
    if (f.marks.has("opengov")) signals.push("OpenGov reporting app");
    if (f.marks.has("hydration")) signals.push("a hydration payload");

    /* The structural test, and the one that actually matters: a document of any
       size with no anchors and no paragraphs is not a document, whatever framework
       built it. Measured on the OpenGov portal, which matched no framework marker
       this list had. Markup exists where the text opens an <html> or <body>, or holds
       a run of ten tags; a CSV or plain text has neither, so it is never a shell
       however large (G76). */
    const markup = f.htmlOrBody || f.tags >= 10;
    if (f.bodyLen > 2000 && f.anchors === 0 && f.paras <= 1 && markup) signals.push(NO_PROSE);

    if (signals.includes(NO_PROSE) && signals.length >= 2)
      return { match: true, confidence: CONFIDENCE.CERTAIN, signals };
    if (signals.length >= 2) return { match: true, confidence: CONFIDENCE.LIKELY, signals };
    if (signals.length) return { match: true, confidence: CONFIDENCE.POSSIBLE, signals };
    return { match: false, confidence: CONFIDENCE.NONE };
  },

  /* The kind `shell` is given only at CERTAIN (R2, G140): a server-rendered page with one
     framework marker is a POSSIBLE match and is not a shell. */
  /** @param {StackContext} ctx @param {Confidence} [confidence] @returns {string | undefined} */
  kind(ctx, confidence) { return confidence === CONFIDENCE.CERTAIN ? "shell" : undefined; },

  /* Nothing is normalised. There is no evidentiary region to protect and no
     furniture to discount: the whole point is that the substance is ABSENT, and a
     digest of a shell should move whenever the shell moves so nobody mistakes a
     stable hash for a stable document. */
  /** @returns {Rule[]} */
  rules() { return []; },

  /* Every part is critical, because in a shell the script IS the document, and a
     shell rendered without its script shows a blank page that would be presented
     as the source's own. */
  /** @returns {boolean} */
  renderCritical() { return true; },
  /** @returns {boolean} */
  ignorable() { return false; },

  /* What a member is told, and it is the only handler that speaks up on its own. */
  warning: localize("site-profiles.client-rendered.this_address_builds_its_page", "This address builds its page in the browser, so what was collected is the empty frame and not the figures. It cannot be relied on as evidence of what the page shows. Collecting it properly needs the page to be rendered first."),
};

export default handler;
