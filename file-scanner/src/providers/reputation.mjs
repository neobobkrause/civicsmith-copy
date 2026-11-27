/* Adapters of kind `url_reputation` (R25, R26; DEC-168 S12): only two lookups exist. `cloudflare-intel` sends the
 * address to Cloudflare's intelligence API in the group's own account; `google-web-risk` keeps the Update API's
 * hash-prefix lists in the group's bucket (`reputation/google-web-risk/`), compares an address's hashes locally, and
 * only on a local match sends the matching prefix, never the address, to confirm it. */
import { createHash } from 'node:crypto';
import { sha256hex } from '../../../bio-plane/src/tokens.mjs';
import { ToolError, jsonOf } from './net.mjs';
import { writeObject, deleteObject, readJson } from '../store.mjs';
/** @import { ToolContext } from './net.mjs' */
/** @import { Bucket } from '../store.mjs' */

/** @typedef {{listed: boolean, categories: string[], risk: string[]}} ReputationAnswer what a lookup finds (R25) */
/**
 * @typedef {{ok: boolean, list_version: string | null, fetched_at: string | null, error?: string}} RefreshAnswer
 *   a list refresh's outcome (R26)
 */
/**
 * @typedef {Object} ReputationAdapter an adapter of kind `url_reputation`
 * @property {string} lookup_privacy `cloudflare_account` or `hash_prefix` (R25)
 * @property {boolean} [localList] true for a tool that keeps a list in the group's bucket (R26)
 * @property {(ctx: ToolContext, address: string) => Promise<ReputationAnswer>} reputation
 * @property {(ctx: ToolContext) => Promise<RefreshAnswer>} [refresh] for a tool with a local list
 */
/** @typedef {Readonly<Record<string, ReputationAdapter>>} ReputationAdapters the reputation tools by `provider_id` */
/** @typedef {{tool_id: string, list_version: string | null, fetched_at: string | null, last_error: string | null}} ReputationListEntry */

// Cloudflare's answer and Web Risk's, as each adapter reads them: each field as the vendor states it, checked by the
// adapter before it is relied on.
/** @typedef {{name: string}} CfName one of Cloudflare's `{id, name}` entries, the part read */
/** @typedef {{risk_types?: CfName[], content_categories?: CfName[]}} CfResult */
/** @typedef {{result: CfResult | CfResult[]}} CfAnswer Cloudflare's `GET /intel/url` */
/** @typedef {{rawHashes: string, prefixSize: number | string}} WrRawHashes */
/** @typedef {{rawHashes: WrRawHashes[]}} WrAdditions */
/**
 * @typedef {{responseType: string, removals: {rawIndices: {indices: (number | string)[]}}, additions: WrAdditions,
 *   checksum: {sha256: string}, newVersionToken: string}} WrDiff Web Risk's `threatLists:computeDiff`
 */
/** @typedef {{threats: {hash: string, threatTypes: string[]}[]}} WrSearch Web Risk's `hashes:search` */
/** @typedef {'MALWARE' | 'SOCIAL_ENGINEERING' | 'UNWANTED_SOFTWARE'} Threat a Web Risk threat type the list keeps */

// The bucket's own objects under `reputation/<tool_id>/` (R26), as refresh() writes them.
/** @typedef {{key: string, version_token: string | null}} ListRef one threat list's object and its version */
/** @typedef {{MALWARE: ListRef, SOCIAL_ENGINEERING: ListRef, UNWANTED_SOFTWARE: ListRef}} ThreatLists */
/** @typedef {{MALWARE?: ListRef, SOCIAL_ENGINEERING?: ListRef, UNWANTED_SOFTWARE?: ListRef}} ThreatListsSoFar */
/**
 * @typedef {{lists: ThreatLists | null, list_version: string | null, fetched_at: string | null, last_error: string | null}} ListState
 */
/** @typedef {{version_token: string | null, prefixes: string[]}} StoredList one threat list: its prefixes, as hex */

// ── Cloudflare URL intelligence. The assumed answer: `result` (or its first entry) with `content_categories` and
// `risk_types`, each a list of `{id, name}`.
/** @param {CfName[] | undefined} l @returns {string[]} */
const names = (l) => (Array.isArray(l) ? l.map((x) => String(x && typeof x === 'object' ? x.name : x)).filter(Boolean) : []);
/** @type {ReputationAdapter} */
const cloudflare = {
  lookup_privacy: 'cloudflare_account',
  async reputation(ctx, address) {
    const account = String(ctx.config.account_id || '');
    if (!/^[0-9a-f]{32}$/.test(account)) throw new ToolError('SERVICE_REFUSED', { status: 400 });
    const j = /** @type {CfAnswer} */ (await jsonOf(await ctx.net.http(`https://api.cloudflare.com/client/v4/accounts/${account}/intel/url?url=${encodeURIComponent(address)}`,
      { headers: { authorization: `Bearer ${ctx.cred('api_token')}` } })));
    const result = j.result;
    /** @type {CfResult} */
    const r = Array.isArray(result) ? result[0] || {} : result || {};
    const risk = names(r.risk_types);
    return { listed: risk.length > 0, categories: names(r.content_categories), risk };
  },
};

// ── Google Web Risk, Update API.
/** @type {readonly Threat[]} */
export const THREATS = Object.freeze(['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']);
/** @param {string} toolId */
const listRoot = (toolId) => `reputation/${toolId}`;
/** @param {string} toolId */
const listState = (toolId) => `${listRoot(toolId)}/state.json`;
const API = 'https://webrisk.googleapis.com/v1';
/** @param {string} s @returns {Uint8Array} */
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** @param {Uint8Array} b @returns {string} */
const bytesToB64 = (b) => btoa(String.fromCharCode(...b));
/** @param {Uint8Array} b @returns {string} */
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
/** @param {string} h @returns {Uint8Array} */
const unhex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));

/** The prefixes a `rawHashes` addition states, as hex.
 * @param {WrAdditions | null | undefined} additions @returns {string[]} */
export function rawPrefixes(additions) {
  /** @type {string[]} */
  const out = [];
  for (const r of (additions && additions.rawHashes) || []) {
    const b = b64ToBytes(r.rawHashes || '');
    const n = Number(r.prefixSize);
    if (!(n >= 4 && n <= 32) || b.length % n) throw new ToolError('LIST_UNREADABLE');
    for (let i = 0; i < b.length; i += n) out.push(hex(b.subarray(i, i + n)));
  }
  return out;
}
/** The list's checksum as the Update API states it: SHA-256 over the sorted prefixes, concatenated.
 * @param {readonly string[]} sorted @returns {string} */
export function listChecksum(sorted) {
  const h = createHash('sha256');
  for (const p of sorted) h.update(unhex(p));
  return bytesToB64(new Uint8Array(h.digest()));
}
/** One threat list after a diff: RESET starts empty; removals index the sorted list before additions.
 * @param {readonly string[] | null | undefined} prev @param {WrDiff} diff @returns {string[]} */
export function applyDiff(prev, diff) {
  /** @type {string[]} */
  let list = diff.responseType === 'RESET' ? [] : [...(prev || [])];
  const removed = new Set(((diff.removals && diff.removals.rawIndices && diff.removals.rawIndices.indices) || []).map(Number));
  if (removed.size) list = list.filter((_, i) => !removed.has(i));
  list.push(...rawPrefixes(diff.additions));
  return [...new Set(list)].sort();
}

/** R26: the lists fetched, checked against their stated checksums, and only then made current.
 * @param {ToolContext} ctx @returns {Promise<RefreshAnswer>} */
async function refresh(ctx) {
  const now = ctx.now();
  const LIST_STATE = listState(ctx.spec.tool_id);
  /** @type {ListState | null} */
  const prev = await readJson(ctx.bucket, LIST_STATE);
  const run = `r${now}`;
  /** @type {string[]} */
  const staged = [];
  /** @type {ThreatListsSoFar} */
  const lists = {};
  try {
    for (const t of THREATS) {
      const prevLists = prev && prev.lists;
      const prevRef = prevLists && prevLists[t];
      /** @type {StoredList | null} */
      const old = prevRef ? await readJson(ctx.bucket, prevRef.key) : null;
      const q = new URLSearchParams({ threatType: t, 'constraints.supportedCompressions': 'RAW' });
      const oldToken = old && old.version_token;
      if (oldToken) q.set('versionToken', oldToken);
      const diff = /** @type {WrDiff} */ (await jsonOf(await ctx.net.http(`${API}/threatLists:computeDiff?${q}`, { headers: { 'x-goog-api-key': ctx.cred('api_key') } })));
      const list = applyDiff(old ? old.prefixes : [], diff);
      const stated = diff.checksum && diff.checksum.sha256;
      if (!stated || listChecksum(list) !== stated) throw new ToolError('LIST_CHECKSUM_MISMATCH', { detail: t });
      const key = `${listRoot(ctx.spec.tool_id)}/${run}/${t}.json`;
      await writeObject(ctx.bucket, key, JSON.stringify({ version_token: diff.newVersionToken || null, prefixes: list }));
      staged.push(key);
      lists[t] = { key, version_token: diff.newVersionToken || null };
    }
    // Every threat's list is set above before this line is reached.
    const list_version = (await sha256hex(THREATS.map((t) => lists[t]?.version_token).join(':'))).slice(0, 16);
    const fetched_at = new Date(now).toISOString();
    await writeObject(ctx.bucket, LIST_STATE, JSON.stringify({ lists, list_version, fetched_at, last_error: null }));
    for (const t of THREATS) {
      const prevLists = prev && prev.lists;
      const prevRef = prevLists && prevLists[t];
      if (prevRef) await deleteObject(ctx.bucket, prevRef.key).catch(() => {});
    }
    return { ok: true, list_version, fetched_at };
  } catch (e) {
    for (const k of staged) await deleteObject(ctx.bucket, k).catch(() => {});
    const detail = e instanceof ToolError ? e.detail : undefined;
    const status = e instanceof ToolError ? e.status : undefined;
    const error = e instanceof ToolError ? `${e.code}${detail ? `:${detail}` : ''}${status ? `:${status}` : ''}` : 'LIST_UNREADABLE';
    if (prev) await writeObject(ctx.bucket, LIST_STATE, JSON.stringify({ ...prev, last_error: error }));
    else await writeObject(ctx.bucket, LIST_STATE, JSON.stringify({ lists: null, list_version: null, fetched_at: null, last_error: error }));
    return { ok: false, list_version: prev ? prev.list_version : null, fetched_at: prev ? prev.fetched_at : null, error };
  }
}

/** An address's Web Risk expressions (host suffixes × path prefixes), canonicalised as the Update API asks.
 * @param {string} address @returns {string[]} */
export function expressions(address) {
  let s = String(address).replace(/[\t\r\n]/g, '').replace(/#.*$/, '');
  for (let i = 0; i < 16; i++) {
    /** @type {string} */
    let d;
    try { d = decodeURIComponent(s); } catch { break; } if (d === s) break; s = d;
  }
  const u = new URL(s.replace(/ /g, '%20'));
  const host = u.hostname.replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.').toLowerCase();
  const path = (u.pathname || '/').replace(/\/{2,}/g, '/');
  const query = u.search;
  const hosts = [host];
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.includes(':')) {
    const parts = host.split('.');
    const tail = parts.slice(-5);
    for (let i = 1; i < tail.length - 1 && hosts.length < 5; i++) hosts.push(tail.slice(i).join('.'));
  }
  const paths = [path + query, path];
  const segs = path.split('/').filter(Boolean);
  let acc = '/';
  paths.push(acc);
  for (let i = 0; i < segs.length - 1 && paths.length < 6; i++) { acc += `${segs[i]}/`; paths.push(acc); }
  /** @type {string[]} */
  const out = [];
  for (const h of hosts) for (const p of paths) out.push(`${h}${p}`);
  return [...new Set(out)];
}

/** @param {ToolContext} ctx @param {string} address @returns {Promise<ReputationAnswer>} */
async function lookup(ctx, address) {
  /** @type {ListState | null} */
  const st = await readJson(ctx.bucket, listState(ctx.spec.tool_id));
  const stLists = st ? st.lists : null, fetchedAt = st ? st.fetched_at : null;
  if (!st || !stLists || !fetchedAt) throw new ToolError('REPUTATION_LIST_ABSENT');
  if (!(Date.parse(fetchedAt) >= ctx.now() - ctx.maxAge)) throw new ToolError('REPUTATION_LIST_STALE');
  const full = expressions(address).map((e) => hex(new Uint8Array(createHash('sha256').update(e).digest())));
  /** @type {Set<string>} */
  const matches = new Set();
  for (const t of THREATS) {
    /** @type {StoredList | null} */
    const l = await readJson(ctx.bucket, stLists[t].key);
    if (!l) throw new ToolError('REPUTATION_LIST_ABSENT');
    const set = new Set(l.prefixes);
    const sizes = [...new Set(l.prefixes.map((p) => p.length))];
    for (const h of full) for (const n of sizes) if (set.has(h.slice(0, n))) matches.add(h.slice(0, n));
  }
  /** @type {Set<string>} */
  const risk = new Set();
  for (const prefix of matches) {
    const q = new URLSearchParams({ hashPrefix: bytesToB64(unhex(prefix)) });
    for (const t of THREATS) q.append('threatTypes', t);
    const j = /** @type {WrSearch} */ (await jsonOf(await ctx.net.http(`${API}/hashes:search?${q}`, { headers: { 'x-goog-api-key': ctx.cred('api_key') } })));
    for (const th of j.threats || []) {
      if (full.includes(hex(b64ToBytes(th.hash || '')))) for (const tt of th.threatTypes || []) risk.add(String(tt));
    }
  }
  return { listed: risk.size > 0, categories: [], risk: [...risk].sort() };
}

/** @type {ReputationAdapter} */
const webRisk = { lookup_privacy: 'hash_prefix', localList: true, reputation: lookup, refresh };

/** @type {ReputationAdapters} */
export const REPUTATIONS = Object.freeze({ 'cloudflare-intel': cloudflare, 'google-web-risk': webRisk });

/** /version's `reputation_lists` (R8): one entry per tool whose list the bucket holds.
 * @param {Bucket | null | undefined} bucket @returns {Promise<ReputationListEntry[]>} */
export async function reputationLists(bucket) {
  if (!bucket) return [];
  const listed = await bucket.list({ prefix: 'reputation/', delimiter: '/' });
  /** @type {ReputationListEntry[]} */
  const out = [];
  for (const p of (listed && listed.delimitedPrefixes) || []) {
    const tool_id = p.slice('reputation/'.length, -1);
    /** @type {ListState | null} */
    const st = await readJson(bucket, listState(tool_id));
    if (st) out.push({ tool_id, list_version: st.list_version, fetched_at: st.fetched_at, last_error: st.last_error });
  }
  return out;
}
