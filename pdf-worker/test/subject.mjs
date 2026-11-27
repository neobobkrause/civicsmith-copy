/* The subject of pdf-worker's HTTP suites: a fresh build of `src/index.mjs`, made by the fleet recipe
 * (`bio-plane/scripts/fleet-bundle.mjs`, the one `scripts/build.mjs` builds `dist/` with) into a temporary file, so
 * the suites test the source as it stands. No bundle is committed (R45). Not product code. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverMembers, buildMember } from "../../bio-plane/scripts/fleet-bundle.mjs";

const member = discoverMembers().find((m) => m.name === "pdf-worker");
if (!member) throw new Error("pdf-worker declares no fleet-member.json");
const built = await buildMember(member);
export const BUNDLE = join(mkdtempSync(join(tmpdir(), "pdf-worker-subject-")), "pdf-worker.bundled.mjs");
writeFileSync(BUNDLE, built.bytes);
