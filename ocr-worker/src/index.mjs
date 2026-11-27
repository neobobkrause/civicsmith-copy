/* ocr-worker — the THIRD member of the function-specific Worker fleet (I9).
 *
 * WHY THIS EXISTS, AND WHY IT IS A MEMBER RATHER THAN CODE IN THE PLANE.
 * DEC-35 ruled the in-account path the DEFAULT for Tier-3 OCR and ruled the
 * plane and `pdf-worker` OUT by bundle size; DEC-42 named wasm tesseract as the
 * engine and left it blocked only on the Free CPU ceiling, which Workers Paid
 * removes; CPDF-14 exhausted the Moondream candidates with a NO-GO on the one
 * thing this record cannot do without (a rectangle that comes back about half
 * the time cannot anchor a claim); and CPDF-15 MEASURED the remaining candidate
 * on the deployed runtime and returned GO. So the engine is `tesseract-wasm`, it
 * carries ~5.95 MB of wasm and language model that must never enter the plane's
 * module graph, and it lives here.
 *
 * WHAT IT DOES. Given a capture sha, a store namespace and the pages that have
 * no text layer, it reads the captured bytes FROM R2 ITSELF (the `CAPTURES` read
 * binding — never handed the bytes, I6's rule and the same reason), renders ONE
 * page to pixels through CPDF-12's renderer, runs the engine over that frame,
 * and answers with line-grain regions each carrying the image region a reader
 * can check them against.
 *
 * ===================================================================== *
 * WHAT IT MUST NOT DO — fleet rules 2/3, inherited from I6 and I8
 * ===================================================================== *
 *
 *   - WRITE ANYTHING. No register row, no provenance, no capture, no task. It
 *     holds no STORE (Durable Object) binding, so it structurally CANNOT write
 *     the record, and it never calls `.put`/`.delete` on R2 (asserted in the
 *     suite behaviourally AND by a source scan). It returns derived text and the
 *     PLANE decides what it means: a hop a component can hand us is a hop a
 *     component can invent (D-112).
 *   - Hold a `PUBLISHED` binding. `CAPTURES` read is the whole of its need.
 *   - Be reached by anything but the plane. No member-facing surface, no token
 *     classes of its own; the plane's op layer is the authorisation boundary.
 *   - **CLAIM ANYTHING ABOUT ITS OWN FIDELITY THAT IS NOT A MEASUREMENT.** This
 *     is the rule this member has that neither sibling does, because it is the
 *     first one whose output the record GRADES. `cap` and `measured_by` come
 *     from `contract.mjs`'s two named constants, both pointing at CPDF-15's
 *     row; a confidence number is passed through only where a classic decoder
 *     computed it and is the STATED string `none` otherwise. The plane refuses
 *     this member's answer outright if either is missing — `ocrTextFromMember`
 *     is the fence and it was built before this member existed.
 *
 * It versions and rolls out on its own (fleet rule 4), so `GET /version` exists
 * and reads `env.VERSION` — the build that is RUNNING, never a constant compiled
 * in beside it. DS-2's authority (D-116) is what keeps that value honest across
 * the fleet: this member's `package.json` and `wrangler.jsonc` are its two
 * declaring sites and `bio-plane/test/system/resolveversion.test.mjs` refuses a
 * tree where they and the plane disagree, in BOTH directions.
 */
import { makeMember } from "./member.mjs";
import { TESSERACT } from "./tessengine.mjs";
/** @import { MemberRequest, MemberEnv } from './member.mjs' */

/* The member's surface, declared: its two routes, and that neither mutates.
 * `fleet-member.json` names this table as `surface`. The fleet-coverage
 * instrument that read it (`scripts/coverage.mjs`, D-117) is retired (K739), so
 * the declaration is held by this module's own suite, which drives both routes
 * and refuses every other (R14).
 *
 * `mutating` is FALSE on every row (fleet rule 2: a member ASSERTS nothing).
 * Both rows could not be anything else — `transcribe` reads bytes and returns
 * text, `version` reads one env var. */
export const SURFACE = {
  transcribe: { method: "POST", mutating: false },
  version:    { method: "GET",  mutating: false },
};

/* The handler and the one-page pipeline live in `member.mjs`, which imports no engine, so a node-side suite can
   drive the same code with the renderer or the engine replaced. This is the one place the real engine is wired in. */
const member = makeMember(TESSERACT);

export default {
  /** @param {MemberRequest} req @param {MemberEnv} [env] */
  fetch: (req, env) => member.fetch(req, env),
};
