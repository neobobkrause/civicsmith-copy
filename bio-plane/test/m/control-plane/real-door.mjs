/* control-plane's real door over a real store, in plain node (R139; K4990; after the plane-scope lane's research 23). The door is this module's own `makeFetch`, handed THIS MODULE'S
   OWN ROUTING (`routing.mjs`: `publicOp`, `gatedOp`), so an op a module's arm answers (`acquire`, `knock`, `pdfstructure`, `pagetranscribe`, `bootstrap`, ...) is answered by the product's
   own composition and no copy of it is made here. The store behind the door is store-request's published world (`storeWorld`: store-assembly's `assembleStore` over node:sqlite, memory
   buckets, a pinned clock); every request the door or an arm makes to the object is passed to `world.send` and kept, in order, in `sent`. Built only from control-plane and modules before
   it: nothing of plane is loaded. `publicInstanceGroup`, the third hook plane hands the door, is not handed here. */
import { storeWorld } from "../store-request/fixtures.mjs";
import { memoryBucket } from "../store-assembly/world.mjs";
import { makeFetch } from "../../../src/control-plane/index.mjs";
import { publicOp, gatedOp } from "../../../src/control-plane/routing.mjs";

const ORIGIN = "https://group.example";

/** `realDoor(opts)` → `{world, env, door, plane(url, init), sent}`: `opts` are `storeWorld`'s, with `hooks` (optional) a function given the real `{publicOp, gatedOp}` and
 *  answering the hooks the door is made with (by default the real ones as they are). The world's own `env` is the door's, with `STORE.get` answering a stub over `world.send` and both
 *  buckets bound, as an installation that publishes has them; `plane(url, init)` asks the door as the Worker is asked and answers its Response; `sent` holds each store request made. */
export async function realDoor({ hooks = null, ...opts } = {}) {
  const world = await storeWorld({ ...opts, env: { PUBLISHED: memoryBucket(), ...(opts.env || {}) } });
  const sent = [];
  const stub = { fetch: async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    sent.push({ url: new URL(request.url), headers: request.headers });
    return world.send(request);
  } };
  world.env.STORE = { idFromName: (n) => n, get: () => stub };
  const real = { publicOp, gatedOp };
  const door = makeFetch(hooks ? hooks(real) : real);
  const plane = (url, init = {}) => door(new Request(new URL(url, ORIGIN).href, init), world.env);
  return { world, env: world.env, door, plane, sent };
}
