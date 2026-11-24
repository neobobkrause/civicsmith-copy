/* The catalogue's checks that moved to promotion (K64): C-4.2, C-17.2, C-18.8 and C-20.1, run over one bundle image
 * by the gate after `checkBundle` (R27, R30–R32) and by record-core's audit beside it (its R59), so neither loses a check. */

import { parseFrontmatter } from "../record-grammar/index.mjs";
import { checkStateHistory, checkMechanicalConformance, checkDivergence } from "./history.mjs";
import { checkReleaseSignature } from "./release.mjs";

/** `{folderName, files (path → text), raw?, releaseRegistry, sha256}` → the moved checks' findings, `{check, severity,
 *  message, repairs?}`, in the order `checkBundle` ran them. `raw`, optional, is the image as given (its blob
 *  references, C-20.1's held copies, R30). */
export async function recordChecks({ folderName, files, raw = null, releaseRegistry = null, sha256 }) {
  const findings = [];
  const md = files.get("bundle.md");
  if (md != null) {
    const fm0 = parseFrontmatter(typeof md === "string" ? md : new TextDecoder().decode(md)).data;
    const fm = fm0 && typeof fm0 === "object" ? fm0 : null;
    checkStateHistory({ fm, files }, findings);
    findings.push(...await checkReleaseSignature({ folderName, fm, files, releaseRegistry, sha256 }));
    await checkMechanicalConformance({ files, raw, sha256 }, findings);
  }
  await checkDivergence({ files, sha256 }, findings);
  return findings;
}
