// Test support for file-scanner: the group's bucket in memory (recording every call), the member's dependencies, the
// two images' real servers run locally (ClamAV's clamscan and sigtool, LibreOffice and Poppler, as the images carry
// them), a test signature set standing as the mirror, and a recording network with stubs of the vendors' APIs.
import '../../bio-plane/test/sandbox.mjs';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export const sha = (b) => createHash('sha256').update(b).digest('hex');
export const enc = (s) => new TextEncoder().encode(s);
export const NOW = Date.parse('2026-10-07T12:00:00Z');
const EICAR_PARTS = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'];
export const EICAR = enc(EICAR_PARTS.join(''));
export const toolsPresent = (() => { try { execFileSync('clamscan', ['--version']); execFileSync('sigtool', ['--version']); return true; } catch { return false; } })();
export const rendererPresent = (() => { try { execFileSync('soffice', ['--version']); execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();

/** An R2 bucket in memory: head, get, put, delete, list; every call recorded in `calls`. */
export function memoryBucket(initial = {}) {
  const objects = new Map();
  const calls = [];
  const bodyOf = (bytes) => ({ size: bytes.length, body: new Response(bytes).body,
    text: async () => new TextDecoder().decode(bytes), arrayBuffer: async () => bytes.slice().buffer });
  const bucket = {
    calls, objects,
    async head(key) { calls.push(['head', key]); const b = objects.get(key); return b ? { size: b.length } : null; },
    async get(key) { calls.push(['get', key]); const b = objects.get(key); return b ? bodyOf(b) : null; },
    async put(key, value) {
      calls.push(['put', key]);
      const bytes = typeof value === 'string' ? enc(value) : value instanceof Uint8Array ? value
        : new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, bytes);
      return { key, size: bytes.length };
    },
    async delete(key) { calls.push(['delete', key]); objects.delete(key); },
    async list({ prefix = '', delimiter } = {}) {
      calls.push(['list', prefix]);
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
      if (!delimiter) return { objects: keys.map((key) => ({ key })), delimitedPrefixes: [] };
      const pre = new Set(keys.map((k) => k.slice(prefix.length)).filter((r) => r.includes(delimiter)).map((r) => prefix + r.slice(0, r.indexOf(delimiter) + 1)));
      return { objects: keys.filter((k) => !k.slice(prefix.length).includes(delimiter)).map((key) => ({ key })), delimitedPrefixes: [...pre] };
    },
  };
  for (const [k, v] of Object.entries(initial)) objects.set(k, typeof v === 'string' ? enc(v) : v);
  return bucket;
}

/** Stores `bytes` as a capture (whole, or in parts of `split` bytes) and answers its target. */
export function putCapture(bucket, bytes, { store = 'bio', split } = {}) {
  const capture_sha = sha(bytes);
  if (!split) { bucket.objects.set(`${store}/captures/${capture_sha}`, bytes); return { capture_sha, parts: null }; }
  const parts = [];
  for (let i = 0; i < bytes.length; i += split) {
    const p = bytes.subarray(i, i + split);
    bucket.objects.set(`${store}/captures/${sha(p)}`, p);
    parts.push({ sha256: sha(p), bytes: p.length });
  }
  return { capture_sha, parts };
}

/** Stores `bytes` as a derived copy (a safe view file-safety wrote under `derived/`, rendered or rebuilt) and answers its
 *  target, `area: "derived"` (R2). */
export function putDerived(bucket, bytes, { store = 'bio', split } = {}) {
  const capture_sha = sha(bytes);
  if (!split) { bucket.objects.set(`${store}/derived/${capture_sha}`, bytes); return { capture_sha, parts: null, area: 'derived' }; }
  const parts = [];
  for (let i = 0; i < bytes.length; i += split) {
    const p = bytes.subarray(i, i + split);
    bucket.objects.set(`${store}/derived/${sha(p)}`, p);
    parts.push({ sha256: sha(p), bytes: p.length });
  }
  return { capture_sha, parts, area: 'derived' };
}

/** The test signature set (EICAR's MD5 as an `.hdb`), placed in the bucket as the mirror's current set. */
export function mirrorTestSet(bucket, { published = new Date(NOW - 3_600_000).toISOString(), set = 'rtest1' } = {}) {
  const hdb = enc(`${createHash('md5').update(EICAR).digest('hex')}:${EICAR.length}:Eicar-Test-Signature\n`);
  const key = `clamav/sets/${set}/main.hdb`;
  bucket.objects.set(key, hdb);
  const current = { set, files: { 'main.hdb': { key, version: '62', build_time: published, sigs: '1' } }, published,
    mirrored_at: published };
  bucket.objects.set('clamav/current.json', enc(JSON.stringify(current)));
  return current;
}

let scannerServer = null, rendererServer = null;
/** The ClamAV image's server, run locally once per process. */
export async function scannerImage() {
  if (!scannerServer) {
    process.env.FILE_SCANNER_SIGS = join(mkdtempSync(join(tmpdir(), 'sigs-')), 'sigs');
    const { start } = await import('../container/scanner.mjs');
    const s = await start(0, '127.0.0.1');
    scannerServer = { server: s, base: `http://127.0.0.1:${s.address().port}`, sigs: process.env.FILE_SCANNER_SIGS };
    scannerServer.fetch = (path, init) => fetch(`${scannerServer.base}${path}`, init);
    s.unref();
  }
  return scannerServer;
}
/** The safe-view image's server, run locally once per process. */
export async function rendererImage() {
  if (!rendererServer) {
    const { start } = await import('../container/renderer.mjs');
    const s = await start(0, '127.0.0.1');
    rendererServer = { server: s, base: `http://127.0.0.1:${s.address().port}` };
    rendererServer.fetch = (path, init) => fetch(`${rendererServer.base}${path}`, init);
    s.unref();
  }
  return rendererServer;
}

/** A recording network: `routes` maps `host` to `(request, url) => Response`; every request is recorded, its body
 *  read whole (`text`) so a test can search it; an unrouted host answers a refusal and is recorded too. */
export function recordingNet(routes = {}) {
  const seen = [];
  const fetchFn = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const bytes = req.body ? new Uint8Array(await req.arrayBuffer()) : new Uint8Array(0);
    const rec = { method: req.method, url: req.url, host: url.hostname, path: url.pathname, search: url.search,
      headers: Object.fromEntries(req.headers), bytes, text: new TextDecoder('latin1').decode(bytes) };
    seen.push(rec);
    const route = routes[url.hostname] || Object.entries(routes).find(([h]) => h.startsWith('*.') && url.hostname.endsWith(h.slice(1)))?.[1];
    if (!route) return new Response('no route', { status: 599 });
    return route(rec, url);
  };
  return { seen, fetch: fetchFn };
}

/** The member's dependencies for a test. */
export function depsWith(over = {}) {
  return { bucket: memoryBucket(), scanner: async () => { throw new Error('no scanner'); },
    updater: async () => { throw new Error('no updater'); }, renderer: async () => { throw new Error('no renderer'); }, fetch: async () => { throw new Error('no network'); },
    connect: null, vpc: null, now: () => NOW, version: '0.79.0', ...over };
}

export const post = (path, body) => new Request(`https://file-scanner${path}`, { method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' } });
export const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
