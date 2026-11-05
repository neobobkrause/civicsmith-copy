// The fleet manifest's one image (R7): an install names the image only by its digest.
import { readFileSync } from 'node:fs';

export const MANIFEST_URL = new URL('../fleet-member.json', import.meta.url);
export const readManifest = () => JSON.parse(readFileSync(MANIFEST_URL, 'utf8'));
// R33: the container's instance_type, declared in wrangler.jsonc. standard-1 (1/2 vCPU, 4 GiB), the type reader-container,
// file-scanner and agent-runner's own configuration already declare: the provisional figure recorded by BOB (coordinator
// ruling, 5 Nov), revisited on measured load (the largest bank item with a full raw-exchange buffer, R48).
export const RUNNER_INSTANCE_TYPE = 'standard-1';

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = /^[a-z0-9.-]+(:[0-9]+)?\/[a-z0-9._/-]+$/;

export class ImageNotPinned extends Error {
  constructor(detail) { super(detail); this.code = 'IMAGE_NOT_PINNED'; }
}

export function imageReference(manifest) {
  const img = manifest && manifest.image;
  if (!img || typeof img.repository !== 'string' || !REPOSITORY.test(img.repository) || img.repository.includes('@'))
    throw new ImageNotPinned('the manifest names no image repository');
  if (typeof img.digest !== 'string' || !DIGEST.test(img.digest))
    throw new ImageNotPinned('the image has no sha256 digest yet; the release writes it when it publishes the image');
  return `${img.repository}@${img.digest}`;
}
