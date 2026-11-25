/* The fixtures pdf-worker publishes to the tests of the modules that use it (K4990, K4993, K4995, K5044). Each is made by
 * this module's real code when it is called, never stored. Not product code.
 *
 *   tier2Answer()  the worker's real `POST /structure` answer (tier 2) for the committed mixed legistar PDF
 *                  (`bio-plane/test/fixtures/cpdf20/legistar-73545.pdf`: seven pages, six of them with a text layer tier 1
 *                  cannot decode, one it can), as `{ok, tier, text: {document, pages, undetermined, counts}, ...}`. It
 *                  replaces `tier2-recorded.json`, a stored copy. */
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { hex } from "./make-pdf.mjs";

const MIXED = fileURLToPath(new URL("../../bio-plane/test/fixtures/cpdf20/legistar-73545.pdf", import.meta.url));

export async function tier2Answer() {
  const { BUNDLE } = await import("./subject.mjs");
  const worker = (await import(pathToFileURL(BUNDLE).href)).default;
  const bytes = new Uint8Array(readFileSync(MIXED));
  const sha = hex(bytes);
  const env = { CAPTURES: { get: async (key) => (key === `bio/captures/${sha}` ? { size: bytes.length, arrayBuffer: async () => bytes.slice().buffer } : null) } };
  const res = await worker.fetch(new Request("http://pdf-worker/structure", { method: "POST", body: JSON.stringify({ capture_sha: sha, store: "bio" }) }), env);
  return await res.json();
}
