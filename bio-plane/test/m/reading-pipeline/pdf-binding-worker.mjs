/* A test-only Worker for `pdf-binding.test.mjs`: reading-pipeline's `read` (R3, R16) run on workerd, the bytes read
   from the real R2 binding `CAPTURES` under the key record-core's `evidenceStore()` fixes (`<store>/captures/<digest>`),
   and tier 2 reached only through the `PDF_WORKER` service binding the test binds, or leaves unbound. It loads only
   reading-pipeline and the modules before it (`jurisdictions` for the empty view a caller composes, `extraction` R18).
   POST a capture document as JSON; it answers `read`'s whole answer as JSON. Not product code. */
import { read } from "../../../src/reading-pipeline/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const STORE = "bio";

export default {
  async fetch(request, env) {
    const document = await request.json();
    const at = (d) => `${STORE}/captures/${d}`;
    const evidence = { head: (d) => env.CAPTURES.head(at(d)), get: (d, options) => env.CAPTURES.get(at(d), options) };
    const answer = await read(document, { evidence, env, storeName: STORE, view: combine([]).view,
                                          planeVersion: env.VERSION || null, liveCalibration: null });
    return new Response(JSON.stringify(answer), { headers: { "content-type": "application/json" } });
  },
};
