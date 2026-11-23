/* R38, R23 (T46; N897 (4); `draft-T46-trial.md` §3.2) — WHETHER A CONTAINER MEMBER'S IMAGE CAN BE PULLED, AND WHAT YOUR
 * GROUP'S CIVICSMITH LACKS WITHOUT IT, held once for the fleet step (index.mjs) and the install and update pages (ui.mjs).
 *
 * A container member installs under the default scheduling policy only from a registry that policy pulls from: Docker
 * Hub, Amazon ECR, Google Artifact Registry (the Cloudflare registry is the `durable_object` policy's, which this installer
 * never uses), and only pinned to one exact build by its sha256 digest. A release whose image sits anywhere else (GitHub's
 * registry, today: there is no public registry yet, K2816 (4)) is left out by name, in words a group can read: never "not
 * a public registry image". The member names stay as the fleet statement gives them; what each provides is said beside.
 */

import { word } from "../../../bio-plane/src/setup-words/index.mjs";

const PINNED = /^[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?\/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$/;
const PULLABLE = /^(?:docker\.io|registry-1\.docker\.io|[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com|[a-z0-9-]+-docker\.pkg\.dev)\/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$/;

/* The reason's identity, never its words: the key the sentence is read by (installer.image.*), said by `imageSaid`. */
/** @type {string} */
export const IMAGE_UNPINNED = "installer.image.unpinned";
/** @type {string} */
export const IMAGE_UNPULLABLE = "installer.image.unpullable";

/**
 * The reason `why` (one of the two above) as the fragment the left-out list shows.
 * @param {string} why IMAGE_UNPINNED or IMAGE_UNPULLABLE
 * @returns {string}
 */
export const imageSaid = (why) => (why === IMAGE_UNPINNED ? word("installer.fleet.why.unpinned") : word("installer.fleet.why.unpullable"));

/**
 * null when the image installs; else why not (IMAGE_UNPINNED or IMAGE_UNPULLABLE).
 * @param {any} image the member's image reference
 * @returns {string|null}
 */
export function imageWhy(image) {
  if (typeof image !== "string" || !PINNED.test(image)) return IMAGE_UNPINNED;
  if (!PULLABLE.test(image)) return IMAGE_UNPULLABLE;
  return null;
}

/* R38 (T36): what your team's Civicsmith lacks while a container member is left out, said beside its reason; "" for a member
   whose absence names nothing the assistant lacks (R57: the assistant does not run in a container). */
/**
 * @param {string} member the container member's name
 * @returns {string}
 */
export const lacksOf = (member) => (member === "file-scanner" ? word("installer.image.lacks.scanner")
  : member === "agent-runner" ? "" : word("installer.image.lacks.other", { part: member }));
