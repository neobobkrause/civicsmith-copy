/* Captures the codifier fixtures R17 names, from the codifier's open JSON API
 * (`measures-T33/time-law.md` §4–§5): one jurisdiction's code served one document per
 * section, and its charter served one document per article. Run by hand, never by a test:
 *   node doctypes/test/capture-codifier.mjs
 * It writes `fixtures/codifier.json`: for each response, the address it came from, when,
 * the sha256 and length of the bytes received, and the documents kept from it, each as the
 * codifier served it (`Id`, `Title`, `Content`). Trimmed only in which documents are kept. */
import fs from "node:fs";
import { createHash } from "node:crypto";
/** @import { CodifierCaptures, ServedDocument } from "./codifier.mjs" */

/**
 * The codifier API's latest publication of a code (`/Jobs/latest/<product>`), as much of it as is kept.
 * @typedef {Object} LatestJob
 * @property {number} Id
 * @property {string} Name
 * @property {string} BannerText
 */
/**
 * The codifier API's content of one node (`/CodesContent`): its documents.
 * @typedef {Object} CodesContent
 * @property {ServedDocument[]} Docs
 */
/**
 * One node to capture, and which of its documents to keep.
 * @typedef {Object} CaptureNode
 * @property {string} node
 * @property {(d: ServedDocument) => boolean} keep
 */

/** The codifier API's answer to `/Jobs/latest`, as that API writes it.
 *  @param {unknown} v @returns {LatestJob} */
const asLatestJob = (v) => /** @type {LatestJob} */ (v);
/** The codifier API's answer to `/CodesContent`, as that API writes it.
 *  @param {unknown} v @returns {CodesContent} */
const asCodesContent = (v) => /** @type {CodesContent} */ (v);

const API = "https://api.municode.com";
const PRODUCT = 16308;
/** @type {CaptureNode[]} */
const CAPTURES = [
  /* A chapter: every section of it, each its own document. */
  { node: "TIT2ADPE_CH2.20PUMEPURE", keep: (d) => /^\d+\.\d+\.\d+/.test(d.Title) },
  /* A second chapter's first article: its sections, each its own document. */
  { node: "TIT8HESA_CH8.22REREADEV", keep: (d) => /^8\.22\.(0\d\d|1\d\d|2\d\d) /.test(d.Title) },
  /* The charter: articles I and II, each one document holding its sections. */
  { node: "THCHOA_ARTIITHCO", keep: (d) => /^ARTICLE (I|II) - /.test(d.Title) },
];

const latest = asLatestJob(await (await fetch(`${API}/Jobs/latest/${PRODUCT}`)).json());
/** @type {CodifierCaptures} */
const out = {
  note: "Captured from the codifier's open JSON API (CodesContent), the way time-law.md §4 measured the code is served: "
      + "one document per code section, the charter one document per article. `sha256` and `bytes` are of the whole "
      + "response; `docs` keeps the documents named in capture-codifier.mjs, each exactly as served.",
  job: { id: latest.Id, name: latest.Name, banner: latest.BannerText },
  captures: [],
};
for (const c of CAPTURES) {
  const source = `${API}/CodesContent?jobId=${latest.Id}&productId=${PRODUCT}&nodeId=${c.node}`;
  const res = await fetch(source);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const body = asCodesContent(JSON.parse(new TextDecoder().decode(bytes)));
  out.captures.push({
    source, fetched: new Date().toISOString(), status: res.status,
    sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
    docs: body.Docs.filter(c.keep).map((d) => ({ Id: d.Id, Title: d.Title, Content: d.Content })),
  });
}
fs.writeFileSync(new URL("./fixtures/codifier.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
for (const c of out.captures) console.log(c.docs.length, c.source);
