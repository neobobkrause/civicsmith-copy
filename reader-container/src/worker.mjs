/* The fleet member's Worker (K5637): the plane reaches its default export through the `READER_CONTAINER` service
 * binding, and it hosts the one container class, `ReaderContainer`, which has no internet at all (R2, R8): the caller
 * hands it every byte it reads. Each request is passed unchanged to one of the class's instances (the image's own
 * routes, container/server.mjs), except GET /version, which the Worker answers itself (F1); a request for any other
 * route is answered 404 here. The caller side of the
 * conversation, the bounds and the stated refusals, is `reader.mjs`, which the plane calls with this binding as its
 * `container`. */
import { Container, ContainerProxy } from '@cloudflare/containers';
import member from '../fleet-member.json' with { type: 'json' };
import packages from '../packages.json' with { type: 'json' };

export { ContainerProxy };

const ROUTES = Object.freeze({ 'POST /convert': true, 'POST /frames': true, 'POST /archive': true, 'GET /version': true });
const UNKNOWN = JSON.stringify({ ok: false, code: 'UNKNOWN' });

/* F1: GET /version is answered by the Worker itself, never by waking an instance: the release's `VERSION` (bundler R12),
 * the image it runs by digest, and the image's tools as its package statement names them. The rollout check reads
 * `version` within its bound; a cold container start no longer stands between a deploy and the build it confirms. */
const TOOLS = Object.freeze(Object.fromEntries(packages.packages.map((p) => [p.name, p.version])));
function version(env) {
  const body = { ok: true, name: member.name, version: String(env?.VERSION || 'unknown'), image: member.image.digest, tools: TOOLS };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export class ReaderContainer extends Container {
  defaultPort = member.image.port;
  sleepAfter = '5m';
  enableInternet = false;
  async fetch(request) { return this.containerFetch(request, this.defaultPort); }
}

/* one of the class's instances, spread over `max_instances` names: a conversion, a decode and an unpacking each hold
 * one instance for their request */
export function instanceOf(ns, pick = Math.random) {
  const n = Math.max(1, member.max_instances);
  return ns.get(ns.idFromName(`reader-${Math.floor(pick() * n) % n}`));
}

export default {
  // installer R39: the member's limits, stated in the bundle a release signs (wrangler.jsonc's `limits`).
  limits: 'bio-member-limits/1 cpu_ms=300000',
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!ROUTES[`${request.method} ${url.pathname}`]) return new Response(UNKNOWN, { status: 404, headers: { 'content-type': 'application/json' } });
    if (request.method === 'GET' && url.pathname === '/version') return version(env);
    if (!env?.READER) return new Response(JSON.stringify({ ok: false, code: 'UNREACHABLE' }), { status: 503, headers: { 'content-type': 'application/json' } });
    return instanceOf(env.READER).fetch(request);
  },
};
