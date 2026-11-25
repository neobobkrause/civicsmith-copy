/* provenance R81: the one helper that files a releasable bundle. `ratification`'s `release` refuses `ENTRY_REQUIREMENTS` a
 * collected Information document without a well-formed `content_hash`, `data/dataset.json`, a file under `snapshots/` and
 * a chain for each document (its R22); this composes all four in one place, so no filer builds them again. The dataset's
 * shape is `screens-intake`'s R23 (`{documents: [{bytes, locator, sha256}]}`, copied: that file is served to the browser
 * and keeps its own). Pure: it answers the files and the hash, writes nothing, and never throws. */

import { canonicalJson, createSha256 } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";

const SHA256_RE = /^[0-9a-f]{64}$/;
const enc = new TextEncoder();

const refusal = (reason, detail) => ({ ok: false, reason, code: reason, detail });

/** The digest of `text`'s UTF-8 bytes, hex. */
const digestOf = (text) => createSha256().update(enc.encode(text)).hex();

/** `md` with `content_hash: <hash>` set in its front matter (replacing a line already there, else added before the
 *  closing fence); null when `md` has no front matter. */
function withContentHash(md, hash) {
  const lines = String(md).split("\n");
  if (lines[0] !== "---") return null;
  const close = lines.indexOf("---", 1);
  if (close < 0) return null;
  const line = `content_hash: ${hash}`;
  const at = lines.findIndex((l, i) => i > 0 && i < close && /^content_hash:/.test(l));
  if (at >= 0) lines[at] = line; else lines.splice(close, 0, line);
  return lines.join("\n");
}

/** R81: the files of an information bundle at `collected` that `release` does not refuse `ENTRY_REQUIREMENTS`.
 *  `md` is the bundle's `bundle.md` as the filer composes it (its own front matter and body); `doc` is the document's row of
 *  `data/provenance.json` (`capture.sha256`, `capture.bytes`, `provenance_chain`); `locator` is the address the dataset
 *  names it by (default `doc.locator`); `snapshots` are the document's own files, each `{path, text | blobSha, bytes,
 *  sha256}` as `promote` takes them, every path under `snapshots/`; `indent` is `data/provenance.json`'s JSON indent
 *  (default 2). Answers `{ok: true, files, contentHash, dataset}`, `files` in `promote`'s shape (`bundle.md`,
 *  `data/provenance.json`, `data/dataset.json`, then `snapshots`), or a refusal `{ok: false, reason, code, detail}`:
 *  `NO_DOCUMENT_DIGEST` for a document with no SHA-256 digest, `NO_CHAIN` for one with no chain, `NO_SNAPSHOT` for none
 *  under `snapshots/`, `NO_FRONT_MATTER` for an `md` that has none. */
export function releasableBundle({ md, doc, locator, snapshots, indent = 2 } = {}) {
  try {
    const d = doc && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
    const cap = d.capture && typeof d.capture === "object" ? d.capture : {};
    const sha256 = typeof cap.sha256 === "string" ? cap.sha256 : "";
    if (!SHA256_RE.test(sha256))
      return refusal("NO_DOCUMENT_DIGEST",
        localize("provenance.releasable.no_digest", "this document has no SHA-256 digest, so a dataset naming it cannot be written and the bundle cannot be released."));
    if (!Array.isArray(d.provenance_chain) || !d.provenance_chain.length)
      return refusal("NO_CHAIN",
        localize("provenance.releasable.no_chain", "this document carries no provenance chain, so the bundle cannot be released."));
    const snaps = Array.isArray(snapshots) ? snapshots.filter((f) => f && typeof f.path === "string") : [];
    if (!snaps.some((f) => f.path.startsWith("snapshots/")))
      return refusal("NO_SNAPSHOT",
        localize("provenance.releasable.no_snapshot", "this bundle holds no file under snapshots/, so it cannot be released."));
    const bytes = Number.isSafeInteger(cap.bytes) ? cap.bytes : null;
    const dataset = canonicalJson({ documents: [{ bytes, locator: String(locator ?? d.locator ?? ""), sha256 }] });
    const contentHash = `sha256:${digestOf(dataset)}`;
    const stamped = withContentHash(md, contentHash);
    if (stamped === null)
      return refusal("NO_FRONT_MATTER",
        localize("provenance.releasable.no_front_matter", "this bundle's document has no front matter to carry its content hash."));
    const file = (path, text) => ({ path, text, bytes: enc.encode(text).length, sha256: digestOf(text) });
    const prov = JSON.stringify({ documents: [d] }, null, indent);
    return { ok: true, contentHash, dataset,
             files: [file("bundle.md", stamped), file("data/provenance.json", prov), file("data/dataset.json", dataset), ...snaps] };
  } catch (e) {
    return refusal("NO_DOCUMENT_DIGEST", String(e && e.message || e).slice(0, 200));
  }
}
