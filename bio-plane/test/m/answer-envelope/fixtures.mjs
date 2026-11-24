/* answer-envelope's published fixtures (the fixtures check, bio K4990, K4995, K5044; fix round 10, batch 4). A user module's
   test takes an answer of this module from here instead of hand-building one. Each value is made by this module's real
   code when a test runs; none is stored. Each is a function, or an object of functions, so every caller gets a fresh value:
   a Response is read once, and one user's read never disturbs another's. */
import { M } from "./load.mjs";

/* the real helpers, as the plane binds them (`bindPublishedPlane`, screens-publish and plane's door) */
export const planeHelpers = {
  json: M.json, doAnswer: M.doAnswer, storeSilent: M.storeSilent, requiredArgument: M.requiredArgument, StoreSilent: M.StoreSilent,
  STORE_SILENT_REASON: M.STORE_SILENT_REASON, STORE_SILENT_DETAIL: M.STORE_SILENT_DETAIL,
};

/* a store's own refusal (`ok: false` below 500), read by the real `doAnswer`:
   `{answered: false, refused: true, result: undefined, reply: {status, body}}` */
export const refusedAnswer = () =>
  M.doAnswer(new Response(JSON.stringify({ ok: false, reason: "BAD_JSON", detail: "d" }), { status: 400 }));

/* the real 502 `STORE_DID_NOT_ANSWER` for `op`, as a Response */
export const storeSilent = (op) => M.storeSilent(op);

/* the same answer, parsed: `{status, body}` */
export const storeSilentParsed = async (op) => {
  const res = M.storeSilent(op);
  return { status: res.status, body: await res.json() };
};
