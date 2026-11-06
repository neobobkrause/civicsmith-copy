// R46: the one door out. Every outbound request of the image goes through `door.fetch`, which checks the host against
// the run's list (R45) before any connection is opened, strips nothing and follows no redirect itself. Nothing else in
// `src/` reaches the network. A refusal is logged as R34's line and counted for the run's record.
import { PATH_SEGMENT_ID_MIN } from './params.mjs';

export class EgressRefused extends Error {
  constructor(host) { super('egress refused'); this.code = 'EGRESS_REFUSED'; this.host = host; }
}

export const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, ''); } catch { return null; } };
// R30: the path with each segment longer than PATH_SEGMENT_ID_MIN characters as `:id`; never a query.
export const pathTemplate = (url) => {
  let p;
  try { p = new URL(url).pathname; } catch { return null; }
  return p.split('/').map((seg) => (seg.length > PATH_SEGMENT_ID_MIN ? ':id' : seg)).join('/');
};

// The Worker's check of a run's declared host before it widens the platform list (R45): a public DNS name over https,
// no wildcard, address, private name, port or path, and not the issuer. Answers the host name, or null.
const DNS_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const PRIVATE_SUFFIX = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.private', '.test', '.invalid', '.example'];
export function platformHost(declaredHost, issuerHost) {
  if (typeof declaredHost !== 'string') return null;
  const h = declaredHost.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '');
  if (!DNS_RE.test(h) || h === issuerHost || PRIVATE_SUFFIX.some((s) => h.endsWith(s))) return null;
  return h;
}

// The list: the issuer alone at rest; the issuer and the declared provider host, each by exact name, for a run.
export function egressList(issuerHost) {
  let hosts = [issuerHost];
  return {
    get hosts() { return [...hosts]; },
    forRun(providerHost) { hosts = [issuerHost, providerHost]; },
    atRest() { hosts = [issuerHost]; },
    allows(host) { return host !== null && hosts.includes(host); },
  };
}

// `fetchImpl` is the platform's fetch; `list` the run's egress list; `log` takes R34's line; `onRefused` counts it.
export function makeDoor({ fetchImpl = globalThis.fetch, list, log = () => {}, onRefused = () => {} }) {
  // R45: is `url`'s host on the run's list? A host off it is logged (R34) and counted, and nothing is sent.
  const check = (url, method = 'GET') => {
    const host = hostOf(url);
    if (list.allows(host)) return true;
    log({ event: 'runner.egress.refused', instance_ref: null, host, method, path_template: pathTemplate(url), status: 520 });
    onRefused(host);
    return false;
  };
  return {
    check,
    async fetch(url, init = {}) {
      if (!check(url, init.method || 'GET')) throw new EgressRefused(hostOf(url));
      return fetchImpl(url, { ...init, redirect: 'manual' });
    },
  };
}
