// R5: `GET /version`, answered by the entry before the run's code has loaded (R26). It carries no key, nonce, run or
// host of a run: only the image's version, the deployment it was configured as, the digest it states and its features.
import pkg from '../package.json' with { type: 'json' };
import { NAME, DEFAULT_DEPLOYMENT, CAPTURE } from './params.mjs';

export const VERSION = pkg.version;

// Each optional feature this image carries: `capture` exactly when R48's mode is built in, `local-endpoint` exactly
// when R58's machine route is, and `egress-door` because the in-process door enforces the run's list (R46).
export function capabilitiesOf({ capture = CAPTURE, localEndpoint = true } = {}) {
  return [...(capture ? ['capture'] : []), ...(localEndpoint ? ['local-endpoint'] : []), 'egress-door'];
}

export const VERSION_KEYS = Object.freeze(['ok', 'name', 'version', 'deployment', 'image_digest_declared', 'capabilities']);

export function versionBody({ deployment = DEFAULT_DEPLOYMENT, imageDigest = null, capture = CAPTURE, localEndpoint = true } = {}) {
  return { ok: true, name: NAME, version: VERSION, deployment, image_digest_declared: imageDigest,
    capabilities: capabilitiesOf({ capture, localEndpoint }) };
}
