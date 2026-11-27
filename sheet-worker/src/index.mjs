/* sheet-worker: a fleet member reached only through the plane's `SHEET_WORKER` service binding. Given a capture's
 * sha and a store namespace, it reads a captured `.xlsx` workbook from R2 itself, recomputes every formula with a
 * pinned build of IronCalc, and answers each formula cell's recomputed value with the engine's version, or a named
 * refusal saying the workbook is not recomputed here and why (build/requirements/sheet-worker.md). Until an
 * administrator sets `SHEET_RECOMPUTE` to "on" after the release, every recompute request is answered NOT_ENABLED.
 */
import { makeMember } from "./member.mjs";
import { SHEET_ENGINE } from "./engine.mjs";
import { MEMBER_LIMITS, MEMBER_LIMITS_STATEMENT } from "./limits.mjs";
/** @import { WorkerEnv, WorkerRequest } from './member.mjs' */

/* The member's surface: two routes, neither mutating (a member asserts nothing). `fleet-member.json` names this table. */
export const SURFACE = {
  recompute: { method: "POST", mutating: false },
  version: { method: "GET", mutating: false },
};

const member = makeMember(SHEET_ENGINE);

/* R17: the handler carries the member's limits, as the plane's door carries its own (installer R20), so bundling keeps
 * the statement as written in the bytes a release signs; the installer reads it from them. workerd takes only handlers
 * as named exports, so it rides on the default one. */
/** @type {{ fetch: (req: WorkerRequest, env: WorkerEnv) => Promise<Response>, limits: Readonly<{ cpu_ms: number }>, limitsStatement: string }} */
export default {
  fetch: (req, env) => member.fetch(req, env),
  limits: MEMBER_LIMITS,
  limitsStatement: MEMBER_LIMITS_STATEMENT,
};
