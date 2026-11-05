// Stubs for a run, all in-process: a stub issuer and a stub provider behind one `fetch` (the platform's, which only the
// door calls), a test sealing key whose private half the test holds, a fake clock, and a log that keeps every line.
import { verifyChallenge, PUBLIC_BANK } from '../../ai-gate/src/index.mjs';
import { makeRunner } from '../src/run.mjs';

export const ISSUER = 'https://issuer.test';
export const PROVIDER_HOST = 'api.stubmodels.net';
export const KEY = 'sk-test-SENTINELKEY-9f2c41d07ab35e88';
export const MODEL = 'stub-model-1';

const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };

export async function testSealingKey() {
  const pair = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { key_id: 'test-seal-1', public_key: b64(raw), private_key: pair.privateKey };
}

// The issuer's good challenge, as `ai-issuer` R9 answers it.
export function challengeFor(at = Date.now(), over = {}) {
  return { challenge_id: 'chl-0001', nonce: 'A'.repeat(11) + 'nonceNONCEnonce0123456789', bank_version: PUBLIC_BANK.version,
    selection_seed: 'seed-0001', issued_at: new Date(at - 1000).toISOString(), expires_at: new Date(at + 3600_000).toISOString(), ...over };
}

/**
 * The world outside the container. `issuer(req)` and `provider(req, body)` answer; every request is kept in `seen`.
 */
export function world({ issuer, provider = goodProvider() } = {}) {
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const headers = new Headers(init.headers || {});
    const body = typeof init.body === 'string' ? init.body : null;
    seen.push({ host: u.hostname, path: u.pathname, method: init.method || 'GET', headers, body, redirect: init.redirect });
    if (`${u.protocol}//${u.host}` === ISSUER) return (issuer ?? (() => Response.json(challengeFor())))({ url: u, headers, body });
    return provider({ url: u, headers, body: body ? JSON.parse(body) : null, signal: init.signal });
  };
  return { fetchImpl, seen };
}

export function goodProvider({ model = MODEL, cost = 0.001, text = 'ok', headers = {} } = {}) {
  let n = 0;
  return () => Response.json({ id: 'cmpl-1', model, choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 2, cost } }, { headers: { 'x-request-id': `req-${++n}`, ...headers } });
}

export const declared = (over = {}) => ({ provider: 'stubco', host: PROVIDER_HOST, model: MODEL, plan: 'stub-plan',
  scope_declared: 'test', route: 'team', ...over });
export const runBody = (over = {}) => ({ declared: declared(), key: KEY, tiers: ['T0'], parts: ['ask'],
  ceiling: { spend: 100, calls: 1000, seconds: 60 }, estimate: { low: 0.01, expected: 0.02, high: 0.03 }, ...over });

export async function runner(opts = {}) {
  const lines = [];
  const sealingKey = opts.sealingKey ?? await testSealingKey();
  const w = opts.world ?? world(opts);
  const r = makeRunner({ issuer: ISSUER, fetchImpl: w.fetchImpl, log: (l) => lines.push(l), sealingKey, ...opts.options });
  const call = async (method, path, body, headers = {}) => {
    const out = await r.handle({ method, path, headers, text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) });
    const json = out.body instanceof Uint8Array ? (out.headers['content-type'] === 'application/json' ? JSON.parse(new TextDecoder().decode(out.body)) : null) : out.body;
    return { ...out, json };
  };
  return { r, lines, sealingKey, world: w, call };
}

// A run started and finished: the 202, then its loop's end.
export async function finishedRun(opts = {}, body = runBody()) {
  const h = await runner(opts);
  const started = await h.call('POST', '/run', body);
  await h.r.settled();
  return { ...h, started };
}

export { verifyChallenge };
