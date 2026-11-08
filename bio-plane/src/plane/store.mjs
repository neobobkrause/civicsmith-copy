/* plane R1, R4, R95, R102, R111, R114: the instance's Durable Object class. Its constructor builds the store by calling
   `store-assembly`'s `assembleStore(ctx, env, {deliver})` (R1) and holds no construction, route map or frame of its own: the
   one frame every store request passes is `store-door`'s `dispatch`, through the assembled store's. The class keeps what is the
   hosting platform's: the retirement of a room of another generation (R95), the RPC methods (R111, R114), `alarm` and
   `onAlarm` (R4), the watchdog's and the heal's hooks (R79, R102) and the headers an answer carries (R78, R96). It writes no
   row and answers no op itself (R9); the composition body moved to `store-assembly` (K5046 (a), K624). */
import { DurableObject } from "cloudflare:workers";
import { assembleStore, namespaceOf, askOnObject, draftOnObject, traceStamped } from "../store-assembly/index.mjs";
import { schedulerOf } from "../scheduler/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { publicReadOf } from "../public-read/index.mjs";
import { deliverOwedRender } from "../control-plane/index.mjs";
import { registerPathSource } from "./path-source.mjs";

/** R78 (K4530, B34; fix round 6, G12e): the response header `server-timing: object;dur=<ms>`, the milliseconds of I/O time the object spent on a
 *  route; control-plane reads it and adds `in-<route>` beside its `do-<route>`. It is I/O time and nothing more: workerd freezes `Date.now()` during
 *  synchronous work (runtime-limits' `cpu.mjs`), so no clock in the object counts compute. Compute is `do-<route>` minus `in-<route>` minus the hop
 *  to the object (about 115 to 160 ms); a heavy read whose `in-` is small beside its `do-` was computing, not waiting. */
export const OBJECT_TIMING_HEADER = "server-timing";
/** R96 (fix round 8, G106, G120; control-plane R129): beside it, `object-age;dur=<ms>`, the milliseconds since this object instance started (an instant taken
 *  when the Store is constructed), so the door can say a request met a cold object (`cold.object_ms`). It is read at the answer, from the same clock. */
const objectTiming = (t0, startedAt) => `object;dur=${Math.max(0, Date.now() - t0)}, object-age;dur=${Math.max(0, Date.now() - startedAt)}`;

/* R95: what a retired room says to a caller: a refusal naming it (no sentence: the reason is the code), status 410 */
const retiredBody = () => ({ ok: false, reason: "ROOM_RETIRED", code: "ROOM_RETIRED", retired: true });
const retiredAnswer = () => new Response(JSON.stringify(retiredBody()), { status: 410, headers: { "content-type": "application/json" } });

export class Store extends DurableObject {
  /* R95: a room of another generation is inert (set at construction) */
  #retired = false;
  /* R96: the instant this instance started, for `object-age;dur` */
  #startedAt = Date.now();
  /* R1: the assembled store (`store-assembly` R1); absent in a retired room */
  #assembled = null;
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    /* R95 (fix round 7, G83; review2 D4): a retired room registers no consumers, migrates nothing and writes nothing; its alarm is deleted when it
       fires and every request is refused, its data left as it is (removing the generation makes it the current room again). */
    if (this.#isRetired()) { this.#retired = true; return; }
    this.#assembled = assembleStore(ctx, env, { deliver: deliverOwedRender });
    /* CR2-29 (ai-runs R97, R98, F1): the plane serves `op=aipathready`'s source, agent-model's health read over the Worker,
       registered once at start with this object's ai-runs; without it the path reads `unregistered` and the assistant is never
       reachable. */
    registerPathSource(aiRunsOf(ctx, env), env);
  }

  /* B2 (K1674, K1684): `op=ask`'s work on the `bio` object, reached over the object's RPC from the door's arm (no route:
     store-assembly R6). */
  async ask(args) { if (this.#retired) return retiredAnswer(); return askOnObject(this.ctx, this.env, args || {}); }
  /* R19 (N686; K2038; control-plane R57): a draft's account and grant on the `bio` object, reached over the object's
     RPC by control-plane's door (no route). */
  async draft(args) {
    if (this.#retired) return retiredAnswer();
    return draftOnObject(this.ctx, this.env, args || {}, { read: (op, params) => this.#assembled.read(op, params) });
  }

  /* R40 (T46; K2999; control-plane R77), R46 (T47; N955; ai-runs R18, credentials R63): a member's own run's segment
     dispatched by ai-runs in the object addressed (`dispatchMemberRun`, its R18), reached over the object's RPC by
     control-plane's door. It takes no credential: only `run`, `by`, `viewer` and `at` are passed, so a `credential` in
     `args` is neither read nor handed on; the segment's credential is minted here, in the plane, by ai-runs. */
  async dispatchMemberRun(args) {
    if (this.#retired) return retiredBody();
    const a = args && typeof args === "object" ? args : {};
    const asked = {};
    for (const k of ["run", "by", "viewer", "at"]) if (a[k] !== undefined) asked[k] = a[k];
    /* R55 (T48; N1015; control-plane R93): the door's `trace` and member ref ride beside them, strings only; never a credential */
    for (const k of ["trace", "memberRef"]) if (typeof a[k] === "string" && a[k] !== "") asked[k] = a[k];
    return aiRunsOf(this.ctx, this.env).dispatchMemberRun(asked);
  }
  /* R114, R62 (T50; N933; `control-plane` R102, public-read R36): public-read's group fields of this object (the door asks the
     `bio` object's); `project`, when named, is passed on so the answer carries that matter's `matter_stake` (null with none). */
  async groupFields(args) {
    if (this.#retired) return retiredBody();
    const project = args && typeof args === "object" && typeof args.project === "string" && args.project !== "" ? args.project : null;
    return publicReadOf(this.ctx).groupFields(project ? { project } : {});
  }

  /* R4: scheduler's. */
  async alarm() { if (this.#retired) { await this.ctx.storage.deleteAlarm(); return; } await schedulerOf(this.ctx, this.env).alarm(); }
  async onAlarm(now) { if (this.#retired) { await this.ctx.storage.deleteAlarm(); return retiredBody(); } return await schedulerOf(this.ctx, this.env).onAlarm(now); }
  /* R79 (fix round 6, G1; scheduler R29): the Worker's cron asks this once a cycle, over the object's RPC (`watchdog.mjs`): the scheduler's `watch(at)`. */
  async watchdog(at) { if (this.#retired) { await this.ctx.storage.deleteAlarm(); return retiredBody(); } return await schedulerOf(this.ctx, this.env).watch(at); }
  /* scheduler's alarm read (its R13), reached over the object's RPC by scheduler's plane test. */
  async schedAlarmAt() { if (this.#retired) return null; return await schedulerOf(this.ctx, this.env).alarmAt(); }

  /* R1: every store request passes the assembled store's one frame (`store-assembly` R7). */
  async fetch(req0) {
    if (this.#retired) return retiredAnswer();
    const t0 = Date.now();
    /* R102 (fix round 9, G93; K4565; scheduler R28): ANY REQUEST RE-ARMS. The scheduler's `heal` looks at the alarm at most once in five
       seconds for the instance and never during a firing, arming a lost or spent one; it never raises the request's answer. */
    try { await schedulerOf(this.ctx, this.env).heal(Date.now()); } catch { /* the watchdog's cron is the backstop */ }
    const req = await traceStamped(req0);   /* store-assembly R60: `acquire`'s trace, from the header capture sends */
    const res = await this.#assembled.dispatch(req);
    /* R78 (fix round 5, E10; K4530; fix round 6, G12e): the I/O time this object spent on the route, to its response (a stream's, to its first
       byte), whole milliseconds, as `server-timing: object;dur=<ms>`, which the door reads; compute is not in it. The object sets it; a value carried in is replaced. */
    try { res.headers.set(OBJECT_TIMING_HEADER, objectTiming(t0, this.#startedAt)); return res; }
    catch { const headers = new Headers(res.headers); headers.set(OBJECT_TIMING_HEADER, objectTiming(t0, this.#startedAt)); return new Response(res.body, { status: res.status, statusText: res.statusText, headers }); }
  }

  /** R95: a RETIRED room is a team's room of another generation: an object that is a room by its name (`bio`, `scratch`, or either
   *  with a `~g<n>` suffix) and is neither current room. A suite's private instance is no room, and is never retired. */
  #isRetired() {
    if (namespaceOf(this.ctx, this.env) !== null) return false;
    const name = this.ctx && this.ctx.id ? this.ctx.id.name : undefined;
    return typeof name === "string" && /^(bio|scratch)(~g[1-9][0-9]*)?$/.test(name);
  }
}
