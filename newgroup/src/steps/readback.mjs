/* R14: the plane's script as the account now holds it, read back and compared with the release's own bytes. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { cfRaw } from "./api.mjs";
import { hashStream, hashPart } from "./bytes.mjs";
/** @import { Session, ApproveAgain } from './api.mjs' */

/* R33 (Distribution §5, "byte-verified on read-back"; K3441): the plane's script as the account now holds it, read back and
   hashed against the release's own bytes, never believed from the upload's answer. The account answers the script
   either as the module itself or as a multipart body whose `index.mjs` part is the module (as `deploy.mjs` reads it).
   `null` when nothing readable came back: an unread script is not a matching one.

   THE HASH IS OVER THE BYTES AS DOWNLOADED. The body is never turned into a string and back: that alters bytes (WHATWG's
   "latin1" is windows-1252, which maps 0x80-0x9F to other code points, so no such hash ever matched a module holding
   them) and costs several copies of a 21 MB module, past a Worker's 128 MB. The download is read as a stream and hashed
   incrementally (R38): the part is found as the chunks arrive and its bytes go to the hash; no copy of the body is held. */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the plane's script name
 * @returns {Promise<string|null>} the SHA-256 (hex) of the script's bytes as downloaded, or null when nothing readable came back
 * @throws {ApproveAgain} when the permission has expired (from `cfRaw`)
 */
async function scriptHash(token, acct, slug) {
  /* A 429 or 5xx backs off as every call does and a 401 asks for approval again (R1); what never mends reads as nothing readable. */
  const r = await cfRaw(token, `/accounts/${acct}/workers/scripts/${slug}`, { headers: { accept: "application/javascript+module" } });
  if (!r) return null;
  const ct = r.headers.get("content-type") || "";
  if (!r.body) return null;
  if (!/multipart/i.test(ct)) return hashStream(r.body);
  const m = /boundary="?([^";]+)"?/i.exec(ct);
  return m ? hashPart(r.body, m[1]) : null;
}
/* The hash of the bytes a release uploads: a repository release carries the one it was verified against; the built-in
   release's is taken from its Blob once, and kept on the release. */
/**
 * @param {{blob: Blob, sha?: string}} release the release (only its `blob` and kept `sha` are read)
 * @returns {Promise<string>} the SHA-256 (hex) of `release.blob`, kept on `release.sha`
 */
async function releaseSha(release) {
  return (release.sha ??= await hashStream(release.blob.stream()));
}
/* After a plane upload the account accepted: up to three reads, stopping at the first that matches. Answers null when the
   bytes are the release's, else the lag to name (R15's list: no success is claimed while it stands). */
/**
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the plane's script name
 * @param {{version: string, blob: Blob, sha?: string}} release the release uploaded
 * @returns {Promise<string|null>} null when the bytes are the release's, else the lag to name, in words
 * @throws {ApproveAgain} when the permission has expired (from `cfRaw`)
 * @bound at most three reads, 1.5 s apart; the lag names the first 16 hexadecimal digits of both hashes
 */
async function readBack(token, acct, slug, release) {
  const want = await releaseSha(release);
  let got = null;
  for (let i = 0; i < 3; i++) {
    got = await scriptHash(token, acct, slug);
    if (got === want) return null;
    if (i < 2) await new Promise((res) => setTimeout(res, 1500));
  }
  return got === null
    ? word("installer.lag.bytes.unread", { version: release.version })
    : word("installer.lag.bytes.differ", { version: release.version, got: got.slice(0, 16) + "…", want: want.slice(0, 16) + "…" });
}
export { scriptHash, releaseSha, readBack };
