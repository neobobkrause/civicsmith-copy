/* The member's surface (R1–R9, R19–R31), as the plane reaches it through its `FILE_SCANNER` binding. `handle` takes
 * the request and the member's dependencies (the bucket, the two images, the network, the clock), so the tests drive
 * it as the Worker does. */
import { BOUNDS } from './limits.mjs';
import { scan, mirror, mirrorAsync, mirrorTick, signatureState } from './clamav.mjs';
import { render } from './render.mjs';
import { providerScan, sandboxSubmit, sandboxResult, providerCdr, providerReputation, providerRefresh, providerForward,
  providerTest, providersList } from './providers/routes.mjs';
import { reputationLists } from './providers/reputation.mjs';
import { PROVIDERS, REFUSED_PROVIDERS, HELD_PROVIDERS, CATALOGUE_READ_ON } from './providers/catalogue.mjs';
import scanner from '../packages-scanner.json' with { type: 'json' };
import renderer from '../packages-renderer.json' with { type: 'json' };
import { localize } from '../../bio-plane/src/setup-words/index.mjs';
/** @import { Deps, RequestBody } from './store.mjs' */
/** @import { MirrorOutcome, TickSkipped } from './clamav.mjs' */

/** @typedef {{ method: string, url: string, json: () => Promise<unknown> }} IncomingRequest a request the plane sends, as this member reads it */
/** @typedef {RequestBody | unknown[] | string | number | boolean | null} RequestJson a request's body, as JSON */
/** @typedef {(deps: Deps, body: RequestBody | null) => Promise<Response>} Route one POST route: the dependencies and the request's body, an object or null */
/** @typedef {{ readonly packages: readonly { readonly name: string, readonly version?: string }[] }} PackageList an image's package list (packages-*.json) */
/** @typedef {{ version?: string }} NamedPackage a package's entry, as far as its version */

/** A package that is not listed. @type {NamedPackage} */
const NOT_LISTED = {};

/** @param {number} status @param {object} body @returns {Response} */
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** @returns {Response} */
const UNKNOWN = () => reply(404, { ok: false, code: 'UNKNOWN' });
/** @param {PackageList} list @param {string} name @returns {string} */
const versionOf = (list, name) => (list.packages.find((p) => p.name === name) || NOT_LISTED).version || 'not reported';

/** R8. @param {Deps} deps @returns {Promise<Response>} */
async function version(deps) {
  return reply(200, { ok: true, name: 'file-scanner', version: deps.version || 'unknown',
    clamav_version: versionOf(scanner, 'clamav'),
    signatures: await signatureState(deps.bucket),
    providers: { catalogue_read_on: CATALOGUE_READ_ON, offered: PROVIDERS.map((d) => d.provider_id),
      refused: REFUSED_PROVIDERS.map((d) => d.provider_id), held: HELD_PROVIDERS.map((d) => d.provider_id) },
    reputation_lists: await reputationLists(deps.bucket),
    renderer_version: localize('file-scanner.handler.libreoffice_versionof_poppler_utils_versionof', 'libreoffice {versionOf}; poppler-utils {versionOf_2}', { versionOf: String(versionOf(renderer, 'libreoffice-core')), versionOf_2: String(versionOf(renderer, 'poppler-utils')) }),
    bounds: BOUNDS });
}

/** @type {{ readonly [path: string]: Route }} each POST route, by its path */
const POSTS = {
  '/scan': scan, '/render': render, '/provider/scan': providerScan, '/provider/sandbox': sandboxSubmit,
  '/provider/sandbox/result': sandboxResult, '/provider/cdr': providerCdr, '/provider/reputation': providerReputation,
  '/provider/refresh': providerRefresh, '/provider/forward': providerForward, '/provider/test': providerTest,
};

/** R6: the scheduled trigger's act (every ten minutes). @param {Deps} deps @returns {Promise<MirrorOutcome | TickSkipped>} */
export const scheduled = (deps) => mirrorTick(deps);

/** The member's answer to one request. @param {IncomingRequest} request @param {Deps} deps @returns {Promise<Response>} */
export async function handle(request, deps) {
  const { pathname, searchParams } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/version') return version(deps);
  if (request.method === 'GET' && pathname === '/providers') return providersList();
  if (request.method === 'POST' && pathname === '/mirror') return searchParams.get('async') === '1' ? mirrorAsync(deps) : mirror(deps);
  const route = request.method === 'POST' && Object.hasOwn(POSTS, pathname) ? POSTS[pathname] : null;
  if (!route) return UNKNOWN();
  /** @type {RequestJson} */
  let body = null;
  try { body = /** @type {RequestJson} the request's own body */ (await request.json()); } catch { body = null; }
  const read = body;
  return route(deps, read && typeof read === 'object' && !Array.isArray(read) ? read : null);
}
