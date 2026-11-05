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
  return {
    async fetch(url, init = {}) {
      const host = hostOf(url);
      if (!list.allows(host)) {
        log({ event: 'runner.egress.refused', instance_ref: null, host, method: init.method || 'GET',
          path_template: pathTemplate(url), status: 520 });
        onRefused(host);
        throw new EgressRefused(host);
      }
      return fetchImpl(url, { ...init, redirect: 'manual' });
    },
  };
}
