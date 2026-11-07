// The container's entry (T53). It listens at once and answers `GET /version` (R5) before the run's code has loaded
// (R26); every other request waits for that load and is answered by the run (R43–R60), or 404 UNKNOWN (R6). Its
// configuration is the container's environment, replaced whole by the Worker (R8): `DEPLOYMENT`, `SAMPLE_ACCOUNTS` and
// `IMAGE_DIGEST` alone; no provider credential is read from it, ever (R47).
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { PORT, BODY_MAX, DEFAULT_DEPLOYMENT } from './params.mjs';
import { versionBody } from './version.mjs';

export function configOf(env = {}) {
  const deployment = typeof env.DEPLOYMENT === 'string' && env.DEPLOYMENT ? env.DEPLOYMENT : DEFAULT_DEPLOYMENT;
  const sampleAccounts = String(env.SAMPLE_ACCOUNTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const imageDigest = /^sha256:[0-9a-f]{64}$/.test(String(env.IMAGE_DIGEST ?? '')) ? env.IMAGE_DIGEST : null;
  return { deployment, sampleAccounts, imageDigest };
}

const readText = (req) => new Promise((resolve) => {
  const parts = []; let n = 0;
  req.on('data', (d) => { n += d.length; if (n <= BODY_MAX + 1) parts.push(d); });
  req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
  req.on('error', () => resolve(''));
});

/**
 * The server, not yet listening. `load` answers the run module (`./run.mjs`) and may take its time (R26); `options`
 * are passed to `makeRunner` beside the environment's configuration.
 */
export function serve({ env = process.env, load = () => import('./run.mjs'), options = {} } = {}) {
  const config = configOf(env);
  let runner = null;
  const ready = Promise.resolve().then(load).then((m) => { runner = m.makeRunner({ ...config, ...options }); return runner; });
  ready.catch(() => {});
  return createServer(async (req, res) => {
    const path = (req.url || '').split('?')[0];
    let out;
    if (req.method === 'GET' && path === '/version') {
      out = { status: 200, body: versionBody({ ...config, ...pick(options) }), headers: { 'content-type': 'application/json' } };
    } else {
      const r = runner ?? await ready;
      out = await r.handle({ method: req.method, path, headers: req.headers, text: () => readText(req) });
    }
    const body = out.body instanceof Uint8Array ? out.body : JSON.stringify(out.body);
    res.writeHead(out.status, out.headers);
    res.end(body);
  });
}
const pick = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => ['capture', 'localEndpoint'].includes(k)));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  serve().listen(Number(process.env.PORT) || PORT, () => {});
}
