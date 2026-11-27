/* The fleet member's Worker (R10): the plane reaches its default export through the `FILE_SCANNER` service binding,
 * and it hosts the two container classes, `FileScanner` (ClamAV) and `SafeViewRenderer`, each with no internet at all
 * (R12): the Worker hands them every byte they work on. The one exception is the `FileScanner` instance the daily mirror
 * (R6) starts, the signature updater: ClamAV's own `freshclam` runs in it and reaches ClamAV's database host (R34).
 * The Worker itself opens no connection to that host. Its scheduled trigger, every ten minutes, finishes an open mirror request, resumes a stopped run and otherwise mirrors once a day (R6). Its bindings:
 * `CAPTURES` (the group's bucket), `SCANNER` and `RENDERER` (the classes), and `SECURITY_VPC` (a Workers VPC binding,
 * absent unless the installer adds it for a tunnelled tool, R21). */
import { Container, ContainerProxy } from '@cloudflare/containers';
import member from '../fleet-member.json' with { type: 'json' };
import { handle, scheduled } from './handler.mjs';
import { MEMBER_LIMITS_STATEMENT } from './limits.mjs';
/** @import { Env, Deps, ContainerNamespace, ContainerFetch, ContainerInit, SocketAddress, SocketOptions, Socket } from './store.mjs' */
/** @import { IncomingRequest } from './handler.mjs' */
/** @typedef {{ waitUntil: (p: Promise<unknown>) => void }} WorkerContext the invocation's context: what keeps it alive past the answer */

export { ContainerProxy };

/** @param {string} name */
const classOf = (name) => member.containers.find((c) => c.class_name === name);

/** R6, R12, R34: the request header by which the Worker starts the image's one other instance, the signature updater,
 *  whose `freshclam` alone may reach ClamAV's database host. Every other instance, the scanning one, has no internet. */
const UPDATER_HEADER = 'x-signature-updater';

export class FileScanner extends Container {
  defaultPort = classOf('FileScanner').image.port;
  sleepAfter = '10m';
  enableInternet = false;
  /** @param {Request} request @returns {Promise<Response>} */
  async fetch(request) {
    this.enableInternet = request.headers.get(UPDATER_HEADER) === '1';
    return this.containerFetch(request, this.defaultPort);
  }
}

export class SafeViewRenderer extends Container {
  defaultPort = classOf('SafeViewRenderer').image.port;
  sleepAfter = '5m';
  enableInternet = false;
  /** @param {Request} request @returns {Promise<Response>} */
  async fetch(request) { return this.containerFetch(request, this.defaultPort); }
}

/** A class's one instance, as a `(path, init)` fetch.
 *  @param {ContainerNamespace | undefined} ns @param {string} name @param {{ [header: string]: string }} [headers]
 *  @returns {ContainerFetch} */
function container(ns, name, headers = {}) {
  if (!ns) return async () => { throw new Error('container not bound'); };
  /** @param {string} path @param {ContainerInit} [init] */
  return (path, init = {}) => {
    const req = new Request(`http://container${path}`, init);
    for (const [k, v] of Object.entries(headers)) req.headers.set(k, v);
    return ns.get(ns.idFromName(name)).fetch(req);
  };
}

/** @param {SocketAddress} address @param {SocketOptions} [options] @returns {Promise<Socket>} */
async function socketConnect(address, options) {
  const { connect } = await import('cloudflare:sockets');
  return connect(address, options);
}

/** @param {Env} env @param {WorkerContext | undefined} ctx @returns {Deps} */
function depsOf(env, ctx) {
  return {
    bucket: env.CAPTURES || null, scanner: container(env.SCANNER, 'file-scanner'),
    updater: container(env.SCANNER, 'file-scanner-signature-updater', { [UPDATER_HEADER]: '1' }), renderer: container(env.RENDERER, 'safe-view'),
    fetch: (req) => fetch(req), connect: socketConnect, vpc: env.SECURITY_VPC || null, now: () => Date.now(),
    version: env.VERSION, waitUntil: ctx && typeof ctx.waitUntil === 'function' ? (p) => ctx.waitUntil(p) : null,
  };
}

export default {
  // installer R39: the member's limits, stated in the bundle a release signs.
  limits: MEMBER_LIMITS_STATEMENT,
  /** @param {IncomingRequest} request @param {Env} env @param {WorkerContext} ctx @returns {Promise<Response>} */
  fetch(request, env, ctx) {
    return handle(request, depsOf(env, ctx));
  },
  /** @param {unknown} event @param {Env} env @param {WorkerContext} ctx @returns {void} */
  scheduled(event, env, ctx) {
    ctx.waitUntil(scheduled(depsOf(env, ctx)));
  },
};
