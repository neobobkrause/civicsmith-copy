// What both images' servers share: a tiny HTTP server on the one port, a child process run with a time budget, and a
// fresh temporary directory per request, removed when the request ends (R14). Neither server opens a connection (R12):
// the classes start them with no internet, and nothing here dials out.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** @import { IncomingMessage, ServerResponse, Server } from 'node:http' */

/**
 * An open file as `fs/promises.open` hands it back: the members the images' servers use.
 * @typedef {{
 *   read(buffer: Buffer, offset: number, length: number, position: number): Promise<{bytesRead: number}>,
 *   write(data: Uint8Array): Promise<unknown>,
 *   stat(): Promise<{size: number}>,
 *   close(): Promise<void>,
 *   createReadStream(): AsyncIterable<Buffer, undefined, undefined>
 * }} FileHandle
 */
/**
 * What `run` answers: the child's exit code (null when a signal ended it, -1 when it could not start), its output and
 * error text, and whether the time budget killed it.
 * @typedef {{code: number | null, out: string, err: string, timedOut: boolean}} RunResult
 */
/**
 * How `run` runs a child: its time budget in milliseconds and the whole environment it is given.
 * @typedef {{ms?: number, env?: Record<string, string | undefined>}} RunOptions
 */
/**
 * One entry of a ZIP's central directory: its name, general-purpose flags, compression method, CRC-32, compressed and
 * uncompressed sizes, and the offset of its local header.
 * @typedef {{name: string, flags: number, method: number, crc: number, csize: number, usize: number, at: number}} ZipEntry
 */
/**
 * A ZIP's central directory as `zipDirectory` reads it: its entries, or the limit it is over.
 * @typedef {{entries: ZipEntry[], limit?: undefined} | {limit: 'ZipDirectory', entries?: undefined}} ZipDirectory
 */
/**
 * A server's routes: answers the request, handing back false when no route is its.
 * @typedef {(req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean | void>} Routes
 */

/** @type {RegExp} a name the servers accept as a path part */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Answers `body` as JSON with `status` and any further `headers`.
 * @param {ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [headers]
 * @returns {void}
 */
export function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

/**
 * Runs `cmd args`, collecting its output; past `ms` it is killed and `timedOut` is true. Never rejects.
 * @param {string} cmd
 * @param {string[]} args
 * @param {RunOptions} [options]
 * @returns {Promise<RunResult>}
 */
export function run(cmd, args, { ms = 60_000, env } = {}) {
  return new Promise((resolve) => {
    let out = '', err = '', timedOut = false;
    /** @type {NodeChild} the child, as the host's description names it */
    let child;
    try { child = spawn(cmd, args, { env: env || { PATH: process.env.PATH, HOME: process.env.HOME || '/tmp' } }); }
    catch (e) { return resolve({ code: -1, out, err: e instanceof Error ? String(e.message || e) : String(e), timedOut }); }
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, ms);
    child.stdout.on('data', (/** @type {Buffer} */ d) => { out += d; });
    child.stderr.on('data', (/** @type {Buffer} */ d) => { err += d; });
    child.on('error', (/** @type {Error} */ e) => { err += String(e.message || e); });
    child.on('close', (/** @type {number | null} */ code) => { clearTimeout(timer); resolve({ code, out, err, timedOut }); });
  });
}

/**
 * A fresh directory for one request's work.
 * @param {string} prefix
 * @returns {Promise<string>}
 */
export const freshDir = (prefix) => mkdtemp(join(process.env.FILE_SCANNER_TMP || tmpdir(), prefix));
/**
 * Removes a request's directory and all in it; never rejects.
 * @param {string} dir
 * @returns {Promise<void>}
 */
export const removeDir = (dir) => rm(dir, { recursive: true, force: true }).catch(() => {});

/**
 * Serves `routes(req, res, url)` on `port`; an unknown route or a thrown error answers as R9 does.
 * @param {number} port
 * @param {Routes} routes
 * @param {string} [host]
 * @returns {Promise<Server>}
 */
export function serve(port, routes, host = '0.0.0.0') {
  const server = createServer(async (req, res) => {
    const url = new URL(String(req.url), 'http://container');
    try {
      const handled = await routes(req, res, url);
      if (handled === false) json(res, 404, { ok: false, code: 'UNKNOWN' });
    } catch (e) {
      if (!res.headersSent) json(res, 500, { ok: false, code: 'CONTAINER_FAILED', message: (e instanceof Error ? String(e.message || e) : String(e)).slice(0, 300) });
      else res.destroy();
    }
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

/**
 * Whether `needle` is in the file, read in chunks that overlap by the needle's length (a file is never held whole).
 * @param {FileHandle} fh
 * @param {number} size
 * @param {Buffer} needle
 * @returns {Promise<boolean>}
 */
export async function fileHas(fh, size, needle) {
  const chunk = Buffer.alloc(1 << 20);
  let tail = Buffer.alloc(0);
  for (let at = 0; at < size;) {
    const { bytesRead } = await fh.read(chunk, 0, chunk.length, at);
    if (!bytesRead) break;
    if (Buffer.concat([tail, chunk.subarray(0, bytesRead)]).includes(needle)) return true;
    tail = Buffer.from(chunk.subarray(Math.max(0, bytesRead - needle.length + 1), bytesRead));
    at += bytesRead;
  }
  return false;
}

const MAX32 = 0xffffffff;
/** @type {('usize' | 'csize' | 'at')[]} the fields ZIP64's extra field holds, in its order */
const ZIP64_ORDER = ['usize', 'csize', 'at'];

/** The 64-bit values of an entry's ZIP64 extra field (id 1) in place of the fields its record gives as 0xFFFFFFFF, in the
 *  order the format states: uncompressed size, compressed size, offset. A field the extra does not hold stays as it was.
 * @param {ZipEntry} entry
 * @param {Buffer} extra
 * @returns {void} */
function zip64Fields(entry, extra) {
  for (let at = 0; at + 4 <= extra.length;) {
    const id = extra.readUInt16LE(at), len = extra.readUInt16LE(at + 2), end = at + 4 + len;
    if (id === 1 && end <= extra.length) {
      let p = at + 4;
      for (const key of ZIP64_ORDER) {
        if (entry[key] !== MAX32 || p + 8 > end) continue;
        entry[key] = Number(extra.readBigUInt64LE(p)); p += 8;
      }
      return;
    }
    at = end;
  }
}

/** A ZIP's central directory, read within `maxBytes` and for at most `maxEntries` entries (ZIP64's end record handled):
 *  `{entries: [{name, flags, method, crc, csize, usize, at}]}` (sizes and offset from the ZIP64 extra field when the record gives 0xFFFFFFFF), or `{limit: 'ZipDirectory'}` when the directory is over `maxBytes`,
 *  or `{entries: []}` when the file has no readable directory.
 * @param {FileHandle} fh
 * @param {number} size
 * @param {{maxEntries: number, maxBytes: number}} bounds
 * @returns {Promise<ZipDirectory>} */
export async function zipDirectory(fh, size, { maxEntries, maxBytes }) {
  const tailLen = Math.min(size, 65_557 + 20 + 56);
  const tail = Buffer.alloc(tailLen);
  await fh.read(tail, 0, tailLen, size - tailLen);
  const e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (e < 0) return { entries: [] };
  let count = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdAt = tail.readUInt32LE(e + 16);
  if (e >= 20 && tail.readUInt32LE(e - 20) === 0x07064b50) {
    const z = Buffer.alloc(56);
    await fh.read(z, 0, 56, Number(tail.readBigUInt64LE(e - 20 + 8)));
    if (z.readUInt32LE(0) === 0x06064b50) { count = Number(z.readBigUInt64LE(32)); cdSize = Number(z.readBigUInt64LE(40)); cdAt = Number(z.readBigUInt64LE(48)); }
  }
  if (cdSize > maxBytes) return { limit: 'ZipDirectory' };
  if (cdAt + cdSize > size) return { entries: [] };
  const cd = Buffer.alloc(cdSize);
  await fh.read(cd, 0, cdSize, cdAt);
  /** @type {ZipEntry[]} */
  const entries = [];
  for (let at = 0; entries.length < Math.min(count, maxEntries) && at + 46 <= cd.length && cd.readUInt32LE(at) === 0x02014b50;) {
    const n = cd.readUInt16LE(at + 28), x = cd.readUInt16LE(at + 30);
    /** @type {ZipEntry} */
    const entry = { name: cd.toString('utf8', at + 46, at + 46 + n), flags: cd.readUInt16LE(at + 8), method: cd.readUInt16LE(at + 10),
      crc: cd.readUInt32LE(at + 16), csize: cd.readUInt32LE(at + 20), usize: cd.readUInt32LE(at + 24), at: cd.readUInt32LE(at + 42) };
    zip64Fields(entry, cd.subarray(at + 46 + n, at + 46 + n + x));
    entries.push(entry);
    at += 46 + n + x + cd.readUInt16LE(at + 32);
  }
  return { entries };
}

/**
 * One small entry's text (stored or deflated), or null when it is encrypted, over `cap` bytes, or unreadable.
 * @param {FileHandle} fh
 * @param {ZipEntry} entry
 * @param {number} cap
 * @returns {Promise<string | null>}
 */
export async function zipText(fh, entry, cap) {
  if (entry.flags & 1 || entry.csize > cap || ![0, 8].includes(entry.method)) return null;
  try {
    const lh = Buffer.alloc(30);
    await fh.read(lh, 0, 30, entry.at);
    if (lh.readUInt32LE(0) !== 0x04034b50) return null;
    const data = Buffer.alloc(entry.csize);
    await fh.read(data, 0, entry.csize, entry.at + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28));
    return (entry.method === 0 ? data : inflateRawSync(data, { maxOutputLength: cap })).toString('utf8');
  } catch { return null; }
}
