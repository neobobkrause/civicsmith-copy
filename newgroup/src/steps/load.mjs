/* R17, R18: the release's fleet, verified in full before anything is created and held as hashes, not as bytes. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { RELEASE_LATEST } from "./api.mjs";
import { releaseSha } from "./readback.mjs";
import { memberLimits } from "./statements.mjs";
import { containerPartsOf, DESCRIPTOR_PARTS, WORKER_PART, containerClasses, workerDescriptor } from "./containers.mjs";
import { PART_MIME, fetchVerified } from "./members.mjs";
import { ARMED_SIGNERS } from "./signers.mjs";
import { verifySshsig, NS_FLEET, fleetStatement } from "../../../bio-plane/src/sshsig.mjs";
/** @import { Release, ApproveAgain } from './api.mjs' */
/** @import { SourceUnavailable } from './members.mjs' */

/**
 * @typedef {Object} LoadedFleet what `loadFleet` answers and `installFleet` installs: `skip`, or `members` and `fleet`
 * @property {string} [skip] a sentence saying why no member is installed this time
 * @property {any} [members] a list, one entry for each member of the statement: `{m, error}` when it is left out, named; else
 *   `{m, box, limits, own, classes, workerPart, bytes}`, `bytes()` answering `{bundle, partBytes}` fetched again and checked
 * @property {Set<string>} [fleet] the names of every member the statement states
 */

/* R61, R71 — THE FLEET OF THE RELEASE R8 CHOSE, VERIFIED AND FETCHED IN FULL BEFORE ANYTHING IS CREATED.
 *
 * Every part comes from ONE release's own signed fleet statement: the plane just chosen, and the statement its own manifest
 * carries (the built-in release carries its own, embedded with it and signed with it: `RELEASE_MANIFEST`), never the plane of
 * one release paired with the statement of another (S3). The statement is rebuilt from the manifest and verified in the fleet
 * namespace, its plane must be the plane this act installs and its version this release's, and each member's bundle and
 * parts are fetched and hashed against it. A source that is slow or down is waited on and then named (`SourceUnavailable`,
 * F5): the caller stops with nothing created. What cannot be loaded for one member leaves that member out, named (R11).
 * Answers `{skip}` (a sentence saying why no member is installed this time) or `{members, fleet}`. */
/**
 * @param {Release} release the release R8 chose
 * @param {((waited: number, bound: number) => any)|null} [onWait] draws each wait on the source, as OnWait
 * @returns {Promise<LoadedFleet>}
 * @throws {SourceUnavailable} when the source stays slow or unavailable for the whole bound
 * @throws {ApproveAgain} when the permission has expired
 */
async function loadFleet(release, onWait = null) {
  const man = release.man;
  if (!man) return { skip: word("installer.fleet.skip.unreachable") };
  if (!Array.isArray(man.fleet) || man.fleet.length === 0 || !man.fleetSig) return { skip: word("installer.fleet.skip.none") };
  if (!ARMED_SIGNERS.length) return { skip: word("installer.fleet.skip.nokey") };
  /* The statement is REBUILT from the manifest by the same function that
     produced it at the cut — producer/verifier agreement, and the /2 facts
     (compat, part types) are required by construction: a manifest stripped of
     them, or a pre-/2 manifest, refuses BY NAME right here. */
  let payload;
  try {
    payload = fleetStatement({ version: man.version,
      plane: { sha256: man.sha256, bytes: man.bytes, asset: man.asset || "bio-plane.bundled.mjs" },
      members: man.fleet });
  } catch (e) {
    return { skip: word("installer.fleet.skip.manifest.reason", { reason: word("installer.fleet.why.part") }) };
  }
  const v = await verifySshsig(man.fleetSig, new TextEncoder().encode(payload), NS_FLEET, ARMED_SIGNERS);
  if (!v.ok) return { skip: word("installer.fleet.skip.signature", { reason: v.reason || "invalid" }) };
  /* The pairing (R61): the signed statement names the plane these members were built against, and it must be the plane
     THIS act just installs, of this release's version. */
  const planeSha = await releaseSha(release);
  if (planeSha !== man.sha256 || String(man.version) !== String(release.version)) return { skip: word("installer.fleet.skip.pairing") };
  /* R38: container members first, because a member bound to a container's class is refused while the class is not there. */
  const fleet = [...man.fleet].sort((a, b) => (containerPartsOf(b).length ? 1 : 0) - (containerPartsOf(a).length ? 1 : 0));
  const base = release.base || RELEASE_LATEST;
  const members = [];
  for (const m of fleet) {
    try {
      const badType = (m.parts || []).find((pp) => !PART_MIME[pp.type] && !DESCRIPTOR_PARTS.has(pp.type));
      if (badType) throw new Error(word("installer.fleet.why.part"));
      const box = containerPartsOf(m);
      const workerParts = (m.parts || []).filter((pp) => pp.type === WORKER_PART);
      if (workerParts.length > 1) throw new Error(word("installer.fleet.why.program"));
      const fetchBundle = () => fetchVerified(base + "/" + m.asset, m.sha256, m.member, onWait);
      const bundle = await fetchBundle();
      /* R39: read from the verified bytes; a statement that cannot be read leaves this member out, named. */
      const stated = memberLimits(bundle);
      if (!stated.ok) throw new Error(stated.why);
      const partBytes = {};
      const fetchPart = (pp) => fetchVerified(base + "/" + m.member + "/" + pp.path, pp.sha256, m.member + " " + pp.path, onWait);
      for (const pp of m.parts || []) partBytes[pp.path] = await fetchPart(pp);
      /* R44, R45: the member's own buckets, schedule and private-network binding, as its signed `Worker` part states them. */
      let own = { r2_buckets: [], crons: [] };
      if (workerParts.length) {
        const w = workerDescriptor(partBytes[workerParts[0].path]);
        if (!w.ok) throw new Error(w.why);
        own = w.d;
      }
      let classes = null;
      if (box.length) {
        const read = containerClasses(box, (path) => partBytes[path]);
        if (!read.ok) throw new Error(read.why);
        classes = read.classes;
      }
      /* R18: what is kept is what the later steps read, parsed and small; the bundle and the parts' bytes are let go here and
         fetched again, and checked against the same hashes, at this member's upload (`bytes`). */
      const bytes = async () => {
        const again = { bundle: await fetchBundle(), partBytes: {} };
        for (const pp of m.parts || []) if (!DESCRIPTOR_PARTS.has(pp.type)) again.partBytes[pp.path] = await fetchPart(pp);
        return again;
      };
      members.push({ m, box, limits: stated.limits, own, classes, workerPart: workerParts.length > 0, bytes });
    } catch (e) {
      if (e && (e.source || e.approveAgain)) throw e;
      members.push({ m, error: String(e && e.fleetWhy ? e.fleetWhy : e && e.message || e) });
    }
  }
  return { members, fleet: new Set(man.fleet.map((x) => x.member)) };
}
export { loadFleet };
