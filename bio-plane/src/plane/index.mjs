/* plane R6: the Worker's module. Its default export is `control-plane`'s door (`makeFetch`) over the hooks the door takes,
   each composed from the arms' owners' handlers (`door.mjs`); `Store` is the Durable Object class `wrangler.jsonc` binds
   (R1). The published read is handed its plane binding (`bindPublishedPlane`, public-read's) when this module loads. Its
   default export also carries `scheduled`, the watchdog's cron handler (R79, `watchdog.mjs`). A `captureupload` request is stated in a line on
   arrival (`arrival.mjs`, R24 d). No other export. (R105) Each answer
   states the calls its request made to the object, `object-calls;dur=<n>` in its `Server-Timing`. */
import "../store-assembly/index.mjs";   /* store-assembly R83 (was plane R68; T51; K4168): its first import is the start's registration of the owners' op declarations, before control-plane reads the op tables when it loads */
import { makeFetch, PUBLISHED_STORE } from "../control-plane/index.mjs";
import { json, doAnswer, storeSilent, storeRefusal, requiredArgument, STORE_SILENT_REASON,
         STORE_SILENT_DETAIL } from "../answer-envelope/index.mjs";   /* K1907, K2041: the envelope's */
import { bindPublishedPlane } from "../publication/worker.mjs";
import { publicInstanceGroup } from "../setup.mjs";
import { publicOp, gatedOp } from "./door.mjs";
import { watchdog } from "./watchdog.mjs";
import { logArrival } from "./arrival.mjs";

export { Store } from "./store.mjs";

bindPublishedPlane({ json, doAnswer, storeSilent, storeRefusal, requiredArgument, STORE_SILENT_REASON,
                     STORE_SILENT_DETAIL, PUBLISHED_STORE });

const door = makeFetch({ publicOp, gatedOp,
  publicInstanceGroup: (env, storeName, projection) => publicInstanceGroup(env, storeName, projection, doAnswer) });

/** R105 (fix round 9, G123g; K4848 (2)): the `Server-Timing` entry naming how many calls a request made to the object. */
const OBJECT_CALLS = "object-calls";

/* R105: the request's `env`, its `STORE` namespace's stubs counting each `fetch` to the object (RPC methods are not route calls and are not
   counted). Every other binding is the env's own. */
function counted(env, tally) {
  if (!env || typeof env !== "object" || !env.STORE || typeof env.STORE.get !== "function") return env;
  const ns = env.STORE;
  const STORE = new Proxy(ns, { get(target, key) {
    const v = target[key];
    if (key !== "get" || typeof v !== "function") return typeof v === "function" ? v.bind(target) : v;
    return (...a) => {
      const stub = v.apply(target, a);
      return new Proxy(stub, { get(st, k) {
        const f = st[k];
        if (k === "fetch" && typeof f === "function") return (...b) => { tally.n++; return f.apply(st, b); };
        return typeof f === "function" ? f.bind(st) : f;
      } });
    };
  } });
  return new Proxy(env, { get(target, key) { return key === "STORE" ? STORE : target[key]; } });
}

/* R105: the answer with `object-calls;dur=<n>` added to its `Server-Timing`, the calls counted until the answer was made; none when the
   request made no call (never 0). Calls after the answer (`waitUntil`) belong to no request. */
function stated(res, n) {
  if (!(res instanceof Response) || !(n > 0)) return res;
  const entry = `${OBJECT_CALLS};dur=${n}`;
  const was = res.headers.get("server-timing");
  const value = was ? `${was}, ${entry}` : entry;
  try { res.headers.set("server-timing", value); return res; }
  catch {
    const headers = new Headers(res.headers);
    headers.set("server-timing", value);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

/* the door's own properties (its `limits`) stay readable on the fetch the Worker exports */
const fetch = Object.assign(async function fetch(req, env, ctx) {
  logArrival(req);   /* R24 (d): an upload's arrival, stated before anything is awaited */
  const tally = { n: 0 };
  const res = await door(req, counted(env, tally));   /* control-plane's door takes the request and its env (PlaneDoor) */
  return stated(res, tally.n);
}, door);

export default { fetch, scheduled: (controller, env) => watchdog(controller, env) };
