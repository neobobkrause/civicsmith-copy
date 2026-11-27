/* The group's bucket, as this member uses it: targets read as copies (R1, R2), from `captures/` or, for a target
 * with `area: "derived"`, from `derived/` (a safe view file-safety stored, rendered or rebuilt, N753), and the only writes it makes, under
 * `clamav/` (R6) and `reputation/` (R26) (R11). Every write and delete in the module goes through `writeObject` and
 * `deleteObject`; a test reads every storage call in the sources and finds no other. */
import { createHash } from 'node:crypto';
import { NAMESPACES, SCAN_MAX_BYTES } from './limits.mjs';

/** @typedef {{ [member: string]: unknown }} RequestBody a request's JSON body, an object whose members are of any kind until checked */
/** @typedef {{ capture_sha?: unknown, area?: unknown, parts?: unknown }} RawTarget a target as a request states it, before it is checked */
/** @typedef {'bio' | 'scratch'} StoreName a store a request may name (limits.mjs `NAMESPACES`) */

/** @typedef {{ sha256: string, bytes: number }} TargetPart one stored part of a target: its own digest and size */
/**
 * A target as `normaliseTarget` answers it: the whole's digest, its parts in order (null when it is stored whole), and
 * the area it is read from.
 * @typedef {{ capture_sha: string, parts: TargetPart[] | null, area: Area }} Target
 */
/** @typedef {'captures' | 'derived'} Area the area of a namespace a target is read from */

/** @typedef {{ size: number }} StoredHead an object's head, as the bucket's `head` answers it: its size in bytes */
/**
 * An object read from the bucket: its bytes as a stream, or whole as text or as one buffer.
 * @typedef {{ size: number, body: ReadableStream<Uint8Array | ArrayBuffer>, text: () => Promise<string>, arrayBuffer: () => Promise<ArrayBuffer> }} StoredObject
 */
/** @typedef {string | Uint8Array | ReadableStream<Uint8Array | ArrayBuffer> | null} PutBody what the bucket's `put` takes as an object's bytes */
/** @typedef {{ httpMetadata?: { contentType?: string } }} PutOptions what the bucket's `put` takes beside the bytes */
/** @typedef {{ prefix: string, delimiter: string }} ListOptions a listing's prefix and the delimiter that groups keys */
/** @typedef {{ objects?: { key: string }[], delimitedPrefixes?: string[] }} Listing what the bucket's `list` answers */
/**
 * The group's bucket, the Worker's `CAPTURES` binding, as this member uses it.
 * @typedef {Object} Bucket
 * @property {(key: string) => Promise<StoredHead | null>} head
 * @property {(key: string) => Promise<StoredObject | null>} get
 * @property {(key: string, body: PutBody, options?: PutOptions) => Promise<StoredHead | null>} put
 * @property {(key: string) => Promise<void>} delete
 * @property {(options: ListOptions) => Promise<Listing>} list
 */

/** @typedef {{ get: (name: string) => string | null }} AnswerHeaders an answer's headers, read by name */
/**
 * An answer this member reads: from one of its images, or from an outside tool.
 * @typedef {Object} Answer
 * @property {boolean} ok
 * @property {number} status
 * @property {ReadableStream<Uint8Array> | null} body
 * @property {AnswerHeaders} headers
 * @property {() => Promise<unknown>} json
 * @property {() => Promise<string>} text
 * @property {() => Promise<ArrayBuffer>} arrayBuffer
 */
/**
 * What a request to one of the images carries beside its path.
 * @typedef {{ method?: string, body?: ReadableStream<Uint8Array | ArrayBuffer>, duplex?: 'half' }} ContainerInit
 */
/** @typedef {(path: string, init?: ContainerInit) => Promise<Answer>} ContainerFetch one image's instance, as a `(path, init)` fetch */
/** @typedef {{ url: string, method: string }} OutgoingRequest a request this member sends, as its receiver reads it */
/** @typedef {{ toString: () => string }} ContainerId the id of a container class's named instance */
/** @typedef {{ fetch: (request: OutgoingRequest) => Promise<Answer> }} ContainerStub a container class's instance */
/**
 * A container class's binding (`SCANNER`, `RENDERER`): its instances by name.
 * @typedef {{ idFromName: (name: string) => ContainerId, get: (id: ContainerId) => ContainerStub }} ContainerNamespace
 */
/** @typedef {{ hostname: string, port: number }} SocketAddress a TCP connection's host and port */
/** @typedef {{ secureTransport?: string, allowHalfOpen?: boolean }} SocketOptions how a TCP connection is opened */
/**
 * An open TCP connection.
 * @typedef {{ readable: ReadableStream<Uint8Array>, writable: WritableStream<Uint8Array>, close: () => Promise<void> }} Socket
 */
/** @typedef {(address: SocketAddress, options?: SocketOptions) => Socket | Promise<Socket>} Connect opens a TCP connection */
/**
 * The Workers VPC binding (`SECURITY_VPC`) for a tunnelled tool: its fetch and, where it has one, its TCP connect.
 * @typedef {{ fetch: (request: OutgoingRequest) => Promise<Answer>, connect?: Connect }} Vpc
 */
/**
 * The Worker's bindings and vars this member reads (R10, R21).
 * @typedef {Object} Env
 * @property {Bucket} [CAPTURES] the group's bucket
 * @property {ContainerNamespace} [SCANNER] the `FileScanner` class
 * @property {ContainerNamespace} [RENDERER] the `SafeViewRenderer` class
 * @property {Vpc} [SECURITY_VPC] absent unless the installer adds it for a tunnelled tool
 * @property {string} [VERSION] the build's version
 */
/**
 * The member's dependencies but the bucket, as the Worker builds them from its bindings and the tests build them in memory.
 * @typedef {Object} DepsBase
 * @property {ContainerFetch} scanner the `FileScanner` image's scanning instance
 * @property {ContainerFetch} updater the `FileScanner` image's signature-updater instance
 * @property {ContainerFetch} renderer the `SafeViewRenderer` image's instance
 * @property {(request: OutgoingRequest) => Promise<Answer>} fetch the Worker's own fetch
 * @property {Connect} connect the Worker's own TCP connect
 * @property {Vpc | null} vpc the VPC binding, null when it is not bound
 * @property {() => number} now the clock, in milliseconds since the epoch
 * @property {string | undefined} version the build's version
 * @property {((p: Promise<unknown>) => void) | null} waitUntil keeps the invocation alive for a promise, null where there is none
 */
/** @typedef {DepsBase & { bucket: Bucket }} BoundDeps the member's dependencies, with the group's bucket bound */
/** @typedef {DepsBase & { bucket: null }} UnboundDeps the member's dependencies, with no bucket bound */
/** @typedef {BoundDeps | UnboundDeps} Deps the member's dependencies: `bucket` is null when the bucket is not bound */
/** @typedef {{ ok: true, bytes: number } | { ok: false, reason: string }} SizeResult a target's size check */
/** @typedef {{ ok: true } | { ok: false, reason: string }} Outcome how reading a target's bytes ended */

const HEX64 = /^[0-9a-f]{64}$/;
const WRITABLE = /^(clamav|reputation)\/[A-Za-z0-9._/-]+$/;

/** R2: the areas a target is read from: a capture's (no `area`), or a derived copy's (`area: "derived"`). */
export const AREAS = Object.freeze({ captures: 'captures', derived: 'derived' });
/** @param {StoreName} store @param {Area} area @param {string} sha @returns {string} */
export const objectKey = (store, area, sha) => `${store}/${AREAS[area]}/${sha}`;

/** R1: a target's shape, or null when it is malformed (`BAD_TARGET`): any `area` but `"derived"`, when one is stated. */
/** @param {unknown} t @returns {Target | null} */
export function normaliseTarget(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  /** @type {RawTarget} the object, its members not yet checked */
  const raw = t;
  if (!HEX64.test(raw.capture_sha || '')) return null;
  const asked = raw.area;
  if (asked !== undefined && asked !== 'derived') return null;
  const area = asked === 'derived' ? 'derived' : 'captures';
  const parts = raw.parts;
  if (parts === null || parts === undefined) return { capture_sha: raw.capture_sha, parts: null, area };
  if (!Array.isArray(parts) || parts.length === 0) return null;
  for (const p of parts) {
    if (!p || typeof p !== 'object' || !HEX64.test(p.sha256 || '') || !Number.isSafeInteger(p.bytes) || p.bytes < 0) return null;
  }
  return { capture_sha: raw.capture_sha, parts: parts.map((p) => ({ sha256: p.sha256, bytes: p.bytes })), area };
}

/** @param {unknown} s @returns {s is StoreName} */
export const knownStore = (s) => typeof s === 'string' && NAMESPACES.includes(s);

/** R2, before anything is read: the objects exist and the whole is within `max`. `{ok, bytes}` or `{ok:false, reason}`. */
/** @param {Bucket} bucket @param {StoreName} store @param {Target} t @param {number} [max] @returns {Promise<SizeResult>} */
export async function sizeTarget(bucket, store, t, max = SCAN_MAX_BYTES) {
  const parts = t.parts;
  if (parts) {
    const declared = parts.reduce((n, p) => n + p.bytes, 0);
    if (declared > max) return { ok: false, reason: 'TOO_LARGE' };
    let total = 0;
    for (const p of parts) {
      const h = await bucket.head(objectKey(store, t.area, p.sha256));
      if (!h) return { ok: false, reason: 'NOT_FOUND' };
      if (h.size !== p.bytes) return { ok: false, reason: 'DIGEST_MISMATCH' };
      total += h.size;
    }
    return { ok: true, bytes: total };
  }
  const h = await bucket.head(objectKey(store, t.area, t.capture_sha));
  if (!h) return { ok: false, reason: 'NOT_FOUND' };
  if (h.size > max) return { ok: false, reason: 'TOO_LARGE' };
  return { ok: true, bytes: h.size };
}

/** R2: the target's bytes as one stream, each part read in order and its own digest checked, the whole's SHA-256
 *  checked against `capture_sha`. `outcome` settles when the stream ends: `{ok:true}` or `{ok:false, reason}`; on a
 *  mismatch the stream errors, so nothing downstream takes the bytes as whole. */
/**
 * @param {Bucket} bucket @param {StoreName} store @param {Target} t
 * @returns {{ stream: ReadableStream<Uint8Array>, outcome: Promise<Outcome> }}
 */
export function targetStream(bucket, store, t) {
  const parts = t.parts;
  /** @type {[string, string | null][]} each object's key, with its own digest for a part */
  const keys = parts ? parts.map((p) => [objectKey(store, t.area, p.sha256), p.sha256]) : [[objectKey(store, t.area, t.capture_sha), null]];
  const whole = createHash('sha256');
  /** @type {(o: Outcome) => void} */
  let settle;
  /** @type {Promise<Outcome>} */
  const outcome = new Promise((r) => { settle = (o) => r(o); });
  let i = 0;
  /** @type {ReadableStreamDefaultReader<Uint8Array | ArrayBuffer> | null} */
  let reader = null;
  /** @type {typeof whole | null} */
  let part = null;
  /** @param {ReadableStreamDefaultController<Uint8Array>} controller @param {string} reason */
  const fail = (controller, reason) => {
    settle({ ok: false, reason });
    controller.error(new Error(reason));
  };
  /** @type {ReadableStream<Uint8Array>} */
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        for (;;) {
          const open = reader;
          if (!open) {
            if (i >= keys.length) {
              if (whole.digest('hex') !== t.capture_sha) return fail(controller, 'DIGEST_MISMATCH');
              settle({ ok: true });
              return controller.close();
            }
            // i is within keys here; were it not, reading its key would throw, caught below as NOT_FOUND
            const entry = keys[i];
            if (!entry) return fail(controller, 'NOT_FOUND');
            const obj = await bucket.get(entry[0]);
            if (!obj) return fail(controller, 'NOT_FOUND');
            reader = obj.body.getReader();
            part = entry[1] ? createHash('sha256') : null;
            continue; // read from the reader just opened
          }
          const hashing = part;
          const { done, value } = await open.read();
          if (done) {
            if (hashing) {
              const digest = hashing.digest('hex'), entry = keys[i];
              // i is within keys here; were it not, reading its digest would throw, caught below as NOT_FOUND
              if (!entry) return fail(controller, 'NOT_FOUND');
              if (digest !== entry[1]) return fail(controller, 'DIGEST_MISMATCH');
            }
            reader = null; i++;
            continue;
          }
          const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
          whole.update(chunk);
          if (hashing) hashing.update(chunk);
          controller.enqueue(chunk);
          return;
        }
      } catch (e) {
        return fail(controller, 'NOT_FOUND');
      }
    },
    cancel() { settle({ ok: false, reason: 'CANCELLED' }); const open = reader; if (open) open.cancel().catch(() => {}); },
  });
  return { stream, outcome };
}

/** R2's whole check over a target, reading it once and keeping nothing.
 *  @param {Bucket} bucket @param {StoreName} store @param {Target} t @returns {Promise<Outcome>} */
export async function verifyTarget(bucket, store, t) {
  const { stream, outcome } = targetStream(bucket, store, t);
  const r = stream.getReader();
  try { for (;;) { const { done } = await r.read(); if (done) break; } } catch { /* the outcome names it */ }
  return outcome;
}

/** R11: the module's one write. Refuses any key outside `clamav/` and `reputation/`.
 *  @param {Bucket} bucket @param {string} key @param {PutBody} body @param {PutOptions} [options] @returns {Promise<StoredHead | null>}
 *  @throws {Error} for a key outside the two prefixes */
export async function writeObject(bucket, key, body, options) {
  if (!WRITABLE.test(key) || key.includes('..')) throw new Error(`file-scanner never writes ${key}`);
  return bucket.put(key, body, options);
}

/** R11: the module's one delete, under the same two prefixes.
 *  @param {Bucket} bucket @param {string} key @returns {Promise<void>} @throws {Error} for a key outside the two prefixes */
export async function deleteObject(bucket, key) {
  if (!WRITABLE.test(key) || key.includes('..')) throw new Error(`file-scanner never deletes ${key}`);
  return bucket.delete(key);
}

/** A JSON object of the module's own, or null. The caller names the shape its own object has (R2: decoded here).
 *  @template T @param {Bucket} bucket @param {string} key @returns {Promise<T | null>} */
export async function readJson(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { return /** @type {T} one of the module's own objects */ (JSON.parse(await o.text())); } catch { return null; }
}
