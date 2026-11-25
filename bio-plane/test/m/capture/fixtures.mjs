/* capture's published fixtures (K4990, K4993, K4995, K5044): each is made by capture's real code when a test runs and never stored. A later module's test
   takes the answer from here instead of hand-building capture's answer (a refusal with a code, a scripted arm, an unreadable set-aside history). Each is
   checked by `fixtures.test.mjs`, which calls it and compares the real answer. A test that needs the instance itself takes it from the fixture's return. */
import { fresh, bucket, network, sha, H, register, receipt, governor, granted, newKey, sshsign, signer } from "./fixture.mjs";
import { Capture, captureAccountStatement } from "../../../src/capture/index.mjs";
import { NS_RATIFY } from "../../../src/sshsig.mjs";
import { ARCHIVE_SAVE_BASE, TSA_ENDPOINTS } from "../../../src/tsa.mjs";

export { sha };

const OPTS = Object.freeze({ cls: "member", member: true, sessMember: "m1", storeName: "bio" });
const ENV = { INSTANCE_NAME: "inst", VERSION: "9.9.9" };

/** `acquireRefusal`: the real `{status, body}` that `acquire` refuses a render with, by code. `RENDER_DEFERRED` (the day's allowance cannot be read, so the
 *  render is deferred: 429, `render.state` "deferred"), `RENDER_NO_RENDERER` (no renderer bound: 501) or `RENDER_HOST_COOLING_OFF` (the host is cooling off:
 *  429). Each is the answer of `capture.acquire({locator, render: true})`, nothing fetched. */
export async function acquireRefusal({ code = "RENDER_DEFERRED", locator = "https://r.example/page" } = {}) {
  const renderer = { fetch: async () => new Response("{}") };
  const w = code === "RENDER_NO_RENDERER" ? fresh({ evidence: bucket(), env: ENV })
    : fresh({ evidence: bucket(), env: { ...ENV, RENDERER: renderer }, ...(code === "RENDER_HOST_COOLING_OFF" ? { gov: { governorAdmit: () => ({ admitted: false, reason: "cooling_off", retry_in_ms: 5000 }), governorReport: () => ({ recorded: true }), isHeld: () => false } } : {}) });
  if (code === "RENDER_DEFERRED") w.c.renderAdmit = () => { throw new Error("the allowance cannot be read"); };
  if (!["RENDER_DEFERRED", "RENDER_NO_RENDERER", "RENDER_HOST_COOLING_OFF"].includes(code)) throw new Error(`acquireRefusal: no render refusal ${code}`);
  const n = network({});
  try { return await w.c.acquire({ locator, render: true }, OPTS); } finally { n.restore(); }
}

/** `storageNotConfigured`: the real `{status, body}` of `acquire` on an instance with no evidence store: EVIDENCE_STORAGE_NOT_CONFIGURED, 503. */
export async function storageNotConfigured({ locator = "https://s.example/doc" } = {}) {
  const w = fresh({ env: ENV });
  const n = network({});
  try { return await w.c.acquire({ locator }, OPTS); } finally { n.restore(); }
}

/** `captureArm`: a real capture over a real record, a scripted network and an evidence store. `arm.acquire(body, opts)` is capture's own `acquire` with the
 *  network of `arm.routes` (`{url: () => Response}`; set a route to script an address) and each call recorded in `arm.calls` (`{body, opts}`);
 *  `arm.registerReader(slot, module, fn)` is capture's own, each registration recorded in `arm.readers`. `arm.capture` is the instance. */
export function captureArm({ routes = {}, env = {} } = {}) {
  const w = fresh({ evidence: bucket(), env: { ...ENV, ...env } });
  const calls = [], readers = [], arm = { calls, readers, routes, capture: w.c, world: w };
  arm.registerReader = (slot, module, fn) => { const r = w.c.registerReader(slot, module, fn); readers.push({ slot, module, fn }); return r; };
  arm.acquire = async (body, opts) => {
    calls.push({ body, opts });
    const n = network(arm.routes);
    try { return await w.c.acquire(body, { ...OPTS, ...(opts || {}) }); } finally { n.restore(); }
  };
  return arm;
}

/** `heldActsUnreadable`: the real answer of `heldActsOf(question)` over a store that cannot be read: `{ok: false, reason: "HELD_ACTS_UNREADABLE", acts: null}`. */
export function heldActsUnreadable({ question = "INQ-1" } = {}) {
  const w = fresh({ env: ENV });
  w.s.sql.exec(`DROP TABLE held_act_questions`);
  return w.c.heldActsOf({ question });
}

/** `heldSetAside`: the real answer of `setAside` for documents waited on by a question: `{ok: true, act: "set_aside", ids, reason, author, at, documents:
 *  [{document, captured_for, waiting}]}`, `waiting` being `{questions: [{question, title, asker}], withheld}`. The `waiting` option is `[{question, title, asker}]`, the questions the captured-for reader (registered here) answers as
 *  waiting on each document. */
export function heldSetAside({ ids = ["INFO-2026-0002-budget"], reason = "Wrong year.", author = "member:mai", waiting = [{ question: "INQ-1", title: "Were the transfers authorised?", asker: "member:ana" }] } = {}) {
  const w = fresh({ env: ENV });
  w.s.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('mai', 'c', 'member', 'active', '2026-01-01', '2026-01-01')`);
  ids.forEach((id, i) => w.s.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
                                       VALUES (?, 'information', 'g', ?, 'collected', ?, ?, 'x', 1)`, id, `title ${id}`, `2026-01-0${i + 1}T00:00:00Z`, `2026-01-0${i + 1}T00:00:00Z`));
  w.c.registerReader("captured-for", "capture-requests", () => ({ questions: waiting.map((q) => ({ question: q.question, title: q.title, asker: q.asker, visible: true, waiting: true })) }));
  return w.c.setAside({ ids, reason, author, viewer: "class:admin" });
}

/* R2's multipart upload, as much of it as a parted upload reaches */
function partedBucket() {
  const b = bucket(), ups = new Map(); let seq = 0;
  const handle = (id) => { const u = ups.get(id);
    return { key: u.key, uploadId: id,
      async uploadPart(n, v) { u.parts.set(n, new Uint8Array(v)); return { partNumber: n, etag: `e-${id}-${n}` }; },
      async complete(list) { b.held.set(u.key, new Uint8Array(Buffer.concat(list.map((p) => u.parts.get(p.partNumber))))); u.state = "done"; },
      async abort() { u.state = "aborted"; } }; };
  b.createMultipartUpload = async (key) => { const id = `u${++seq}`; ups.set(id, { key, parts: new Map(), state: "open" }); return handle(id); };
  b.resumeMultipartUpload = (key, id) => handle(id);
  return b;
}

/** `partRefusal`: the real refusals of capture's part upload through a parted upload, each produced by uploading a wrong or repeated part. The answer is
 *  `{PART_DIGEST_MISMATCH, PART_CONFLICT, PART_OUT_OF_ORDER, UPLOAD_UNKNOWN, UPLOAD_LOST}`, each the `putUploadPart` answer (`{ok: false, reason, status, ...}`):
 *  a part whose bytes are not its digest is a 400 with `expected` and `got`; another part's bytes under a held index is a 409 `PART_CONFLICT`; a part past the
 *  next is a 409 `PART_OUT_OF_ORDER`; a part of an upload aborted is `UPLOAD_UNKNOWN` (404); a part of an upload whose hashing state is gone is a 409
 *  `UPLOAD_LOST`. Parts are 1,000 bytes (the upload is begun under a ceiling of 1,000). */
export async function partRefusal() {
  const file = new Uint8Array(2500).map((_, i) => (7 + (i % 251)) & 255);
  const parts = [file.subarray(0, 1000), file.subarray(1000, 2000), file.subarray(2000)];
  const w = fresh({ evidence: partedBucket(), env: ENV });
  w.c.evidenceKey = (d) => `bio/captures/${d}`;
  const begin = (bytes = file) => w.c.beginPartedUpload({ sha256: sha(bytes), bytes: bytes.length, statement: "a file the clerk handed me", by: "m1", bounds: { request: 1000 } });
  const put = (upload, index, bytes, digest = sha(bytes)) => w.c.putUploadPart({ upload, index, bytes, sha256: digest, by: "m1" });
  const a = await begin();
  const wrong = await put(a.upload, 0, parts[0], sha("another part"));
  await put(a.upload, 0, parts[0]);
  const conflict = await put(a.upload, 0, parts[1]);
  const ahead = await put(a.upload, 2, parts[2]);
  const b = await begin(new Uint8Array(2500).map((_, i) => (9 + (i % 241)) & 255));
  await w.c.abortPartedUpload({ upload: b.upload, by: "m1" });
  const unknown = await put(b.upload, 0, parts[0]);
  const lostFile = new Uint8Array(2500).map((_, i) => (11 + (i % 239)) & 255);
  const l = await begin(lostFile);
  await w.c.putUploadPart({ upload: l.upload, index: 0, bytes: lostFile.subarray(0, 1000), sha256: sha(lostFile.subarray(0, 1000)), by: "m1" });
  w.s.db.prepare(`UPDATE parted_uploads SET hash_state = NULL WHERE upload = ?`).run(l.upload);
  const again = new Capture(w.s, { record: w.core, env: { ...w.c.env }, governor: w.c.governor, provenance: w.c.provenance, credentials: w.c.credentials });
  again.evidenceKey = w.c.evidenceKey;
  const lost = await again.putUploadPart({ upload: l.upload, index: 1, bytes: lostFile.subarray(1000, 2000), sha256: sha(lostFile.subarray(1000, 2000)), by: "m1" });
  return { PART_DIGEST_MISMATCH: wrong, PART_CONFLICT: conflict, PART_OUT_OF_ORDER: ahead, UPLOAD_UNKNOWN: unknown, UPLOAD_LOST: lost };
}

/** `recordReuseVerdicts`: capture's real `reusedparts` and `recordreuseverdicts` reads over seeded reused parts of one bundle, in the shape of the ops table a
 *  later module is handed (`ops.reusedparts()` answers `{bundleId, parts}`; `ops.recordreuseverdicts(url, body)` records through capture's own
 *  `recordReuseVerdicts`). `recorded()` reads back what was recorded from capture's record (`reuseVerdicts`), never a pushed copy. `parts` is
 *  `[{address, text}]`: a part reused by a capture of the bundle from a source capture, its bytes `text`. */
export function recordReuseVerdicts({ bundleId = "INFO-1", host = "x.example", parts = [{ address: "https://x.example/a.css", text: "body{}" }, { address: "https://x.example/b.js", text: "run()" }] } = {}) {
  const w = fresh({ env: ENV });
  const source = H("5");
  const seeded = parts.map((p, i) => {
    const primary = H(`a${i}`), norm = p.address.replace(/^https?:\/\//, "");
    register(w.s, primary, bundleId);
    receipt(w.s, { address: "https://x.example/page", capture: primary, first: "2026-01-01T00:00:00Z" });
    w.c.recordSiteAssets({ host, primarySha: primary, observations: [{ address_norm: p.address, address: p.address, sha256: sha(p.text), kind: "stylesheet", bytes: p.text.length, reused: true, reused_from: source }], at: "2026-01-01T00:00:00Z" });
    return { ...p, primary_sha: primary, address_norm: p.address, host, reused_sha: sha(p.text), norm };
  });
  const ops = {
    reusedparts: () => w.c.reusedParts(bundleId),
    recordreuseverdicts: (_url, body) => w.c.recordReuseVerdicts({ ...body, bundleId: body.bundleId ?? bundleId }),
  };
  return { ops, capture: w.c, parts: seeded, bundleId, recorded: () => w.c.reuseVerdicts({ bundleId }).verdicts };
}

/** The bytes `uploadProvenance` brings by default: a 1 x 1 PNG (its signature and header are what the profile reads). */
export const UPLOAD_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** `uploadProvenance`: the provenance document capture's real `uploadCapture` writes for one upload, made when the test runs. A member brings `bytes` under
 *  `name` with no declared type, so the bytes decide what the file is. Answers the document: `file` (`snapshots/upload-<sha>`), `locator`, `retrieved`,
 *  `capture` (method uploaded, graded received, no `content_type`), `profile` (acquisition's profile of the bytes, its `format` and `source_content_type` the
 *  bytes' own, none declared), `source`, `origin`, `origin_statement` and `name_stated`. Defaults: `UPLOAD_PNG` named `street.png`. */
export async function uploadProvenance({ bytes = UPLOAD_PNG, name = "street.png", statement = "a photo the clerk took at the counter", by = "m1", at = "2026-10-09T12:00:00Z" } = {}) {
  const w = fresh({ evidence: bucket(), env: ENV });
  const r = await w.c.uploadCapture({ bytes, statement, name, by, at });
  if (r.ok !== true) throw new Error(`uploadProvenance: the upload was refused ${r.reason}`);
  return r.document;
}

const REATTEST_LOCATOR = "https://a.example/page";
const REATTEST_ARCHIVED = "https://web.archive.org/web/20260930110001/https://a.example/page";
const REATTEST_REPLAY = "https://web.archive.org/web/20260930110001id_/https://a.example/page";

/** `reattest`: the real answer of capture's `reattest({captureSha, locator, by})` for a held capture, made when the test runs over attestation's real
 *  `attest` and a scripted network. By default the capture's attestation is unacknowledged: every timestamp authority refuses and the archive's save is
 *  refused, so the answer is `{ok: true, attested: false, late_attestations: [...failed attempts, late], note}` with no `attestation`. With
 *  `acknowledged: true` the first authority grants a token bound to the digest and the archive saves and replays the same bytes, so the answer is
 *  `{ok: true, attested: true, attestation, late_attestations: [timestamp ok, co_archive ok and matching], note}`. `captureSha` is the held capture's digest. */
export async function reattest({ acknowledged = false, by = "m1" } = {}) {
  const b = bucket();
  const w = fresh({ evidence: b, gov: governor(), env: { INSTANCE_NAME: "i" } });
  const bytes = new TextEncoder().encode("the captured page");
  const captureSha = sha(bytes);
  b.held.set(`bio/captures/${captureSha}`, bytes);
  const n = network((url) => {
    const i = TSA_ENDPOINTS.indexOf(url);
    if (i >= 0) return acknowledged && i === 0 ? new Response(granted(captureSha)) : new Response("", { status: 500 });
    if (url === ARCHIVE_SAVE_BASE + REATTEST_LOCATOR)
      return acknowledged ? new Response("", { headers: { "content-location": REATTEST_ARCHIVED.replace("https://web.archive.org", "") } }) : new Response("", { status: 523 });
    if (url === REATTEST_REPLAY && acknowledged) return new Response(bytes);
    return null;
  });
  try { return { ...(await w.c.reattest({ captureSha, locator: REATTEST_LOCATOR, by })), captureSha }; } finally { n.restore(); }
}

/** `captureAccount`: the real answer of capture's `recordCaptureAccount` for a capture's actor: `{ok: true, captureSha, seq: 1, key_b64, ...}`. The capture is
 *  recorded as `by`'s, `by` holds an attesting key, and the account is signed over `captureAccountStatement(captureSha, text)` in the ratify namespace. The
 *  answer is the member's first account of that capture, and `capture` is the instance, to read `captureAccountsOf` back. */
export async function captureAccount({ text = "I saved this page from the clerk's site at 9:14, logged in as myself.", by = "m1", at = "2026-09-02T00:00:00Z" } = {}) {
  const w = fresh({ env: ENV });
  const captureSha = H("c1");
  w.c.recordCaptureActor({ captureSha, actor: by, at: "2026-09-01T00:00:00Z" });
  const key = await newKey();
  signer(w.s, by, key.keyB64);
  const signature = await sshsign(key, captureAccountStatement(captureSha, text), NS_RATIFY);
  return { ...(await w.c.recordCaptureAccount({ captureSha, text, signature, by, at })), captureSha, capture: w.c };
}
