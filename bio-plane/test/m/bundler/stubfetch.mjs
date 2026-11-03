/* Preloaded (`node --import`) into a bundler command under test: a stand-in for the Cloudflare API and a
 * workers.dev host, so no test reaches a real account. The scenario is the JSON file `$BUNDLER_STUB`;
 * every request is appended to `$BUNDLER_STUB_LOG` as one JSON line (the bearer token is recorded only
 * as present or absent). Timers are cut to a millisecond so the commands' retry and rollout waits run fast.
 *
 * Scenario: { subdomain, scripts: { <name>: { body?, settings? (limits?, bindings?), settingsStatus?, scriptStatus? } },
 *             put: "accept" | "ignore", settingsAfterPut?: object, serving: { <name>: string },
 *             servingAfterPut?: "version" | "never", unreachable?: [<substring>], containers?: <status>,
 *             schedulesPut?: "accept" | "ignore" | "reject", schedulesStored?: [<cron>], schedulesGet?: <status>,
 *             scriptPutClearsSchedules?: boolean, observabilityAfterPut?: object, settingsUnreadableAfterPut?: boolean,
 *             startupTimeMs?: number | "none" (G84: the upload's answer carries `result.startup_time_ms`, as Cloudflare's documented answer does; "none" leaves the field out) }
 * A script's cron schedules are `scripts.<name>.schedules` (an array of cron strings). Its schedules endpoint (G1) answers
 * PUT by storing what was sent (`schedulesPut` "ignore" answers 200 and stores nothing, "reject" answers 403, and
 * `schedulesStored` stores that list instead of what was sent) and GET with the stored list (`schedulesGet` names a status
 * to fail with); a script that does not exist answers 404. `scriptPutClearsSchedules` makes a script PUT clear them, the
 * platform behaviour the plan leaves unconfirmed.
 * Workers Logs (G54): a script PUT stores the metadata's `observability` in the script's settings, and a PUT whose metadata
 * has none leaves the settings without the key, which is how the platform reports Workers Logs off (measured on biosmoke8,
 * 2026-10-20). `observabilityAfterPut` states another value after the PUT; `settingsUnreadableAfterPut` makes the settings
 * endpoint answer 500 once the PUT has landed.
 * A script with no entry does not exist (404). A PUT the scenario accepts stores the uploaded module as
 * the script's body, the metadata's limits as its settings (unless `settingsAfterPut` says otherwise),
 * and, unless `servingAfterPut` is "never", the metadata's VERSION as what the instance serves. The account's
 * Containers applications (R26) answer `containers` (403 when the scenario names none: a token without the scope).
 * Its R2 buckets are `buckets` (names); a POST creates one. */
import { readFileSync, appendFileSync } from "node:fs";

const file = process.env.BUNDLER_STUB;
const logFile = process.env.BUNDLER_STUB_LOG;
const S = file ? JSON.parse(readFileSync(file, "utf8")) : {};
S.scripts ||= {};
S.serving ||= {};
const log = (entry) => { if (logFile) appendFileSync(logFile, JSON.stringify(entry) + "\n"); };
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, _ms, ...args) => realSetTimeout(fn, 1, ...args);

globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init.method || "GET").toUpperCase();
  const auth = init.headers && (init.headers.authorization || init.headers.Authorization);
  const entry = { method, url, bearer: typeof auth === "string" && auth.startsWith("Bearer ") };
  if ((S.unreachable || []).some((s) => url.includes(s))) { log({ ...entry, threw: true }); throw new TypeError("fetch failed"); }

  const host = new URL(url).host;
  if (host.endsWith(".workers.dev")) {
    const name = host.split(".")[0];
    log(entry);
    const v = S.serving[name];
    return v === undefined ? new Response("no such worker", { status: 404 }) : new Response(v, { status: 200 });
  }
  if (host !== "api.cloudflare.com") { log({ ...entry, foreign: true }); throw new TypeError(`stubfetch: no route to ${url}`); }

  const path = new URL(url).pathname;
  let m;
  if (/\/workers\/subdomain$/.test(path)) {
    log(entry);
    return S.subdomain ? json(200, { success: true, result: { subdomain: S.subdomain } }) : json(500, { success: false });
  }
  if (/\/containers\/applications$/.test(path)) {
    log(entry);
    const st = S.containers ?? 403;
    return st === 200 ? json(200, { success: true, result: [] }) : json(st, { success: false, errors: [{ code: 10000, message: "Authentication error" }] });
  }
  if ((m = path.match(/\/workers\/scripts\/([^/]+)\/settings$/))) {
    log(entry);
    const s = S.scripts[m[1]];
    if (s && s.settingsStatus) return json(s.settingsStatus, { success: false });
    if (!s) return json(404, { success: false });
    return json(200, { success: true, result: s.settings ?? {} });
  }
  if ((m = path.match(/\/workers\/scripts\/([^/]+)\/schedules$/))) {
    const s = S.scripts[m[1]];
    if (method === "PUT") {
      const sent = JSON.parse(String(init.body));
      log({ ...entry, schedules: sent });
      if (!s) return json(404, { success: false, errors: [{ code: 10007, message: "This Worker does not exist" }] });
      if (S.schedulesPut === "reject") return json(403, { success: false, errors: [{ code: 10000, message: "Authentication error" }] });
      if (S.schedulesPut !== "ignore") s.schedules = S.schedulesStored ?? sent.map((x) => x.cron);
      return json(200, { success: true, result: { schedules: (s.schedules || []).map((cron) => ({ cron })) } });
    }
    log(entry);
    if (S.schedulesGet) return json(S.schedulesGet, { success: false });
    if (!s) return json(404, { success: false });
    return json(200, { success: true, result: { schedules: (s.schedules || []).map((cron) => ({ cron })) } });
  }
  if ((m = path.match(/\/workers\/scripts\/([^/]+)$/))) {
    const name = m[1];
    if (method === "PUT") {
      const fd = init.body;
      const metadata = JSON.parse(await fd.get("metadata").text());
      const module = await fd.get("index.mjs").text();
      log({ ...entry, metadata, moduleBytes: Buffer.byteLength(module) });
      if (S.put === "accept") {
        const s = (S.scripts[name] ||= {});
        s.body = module;
        if (S.scriptPutClearsSchedules) s.schedules = [];
        const obs = S.observabilityAfterPut ?? metadata.observability;
        s.settings = S.settingsAfterPut ?? { limits: metadata.limits, bindings: metadata.bindings, ...(obs !== undefined ? { observability: obs } : {}) };
        if (S.settingsUnreadableAfterPut) s.settingsStatus = 500;
        const v = metadata.bindings.find((b) => b.name === "VERSION");
        if (S.servingAfterPut !== "never" && v) S.serving[name] = v.text;
      }
      return json(200, { success: true, result: { id: name, ...(S.startupTimeMs !== undefined && S.startupTimeMs !== "none" ? { startup_time_ms: S.startupTimeMs } : {}) } });
    }
    log(entry);
    const s = S.scripts[name];
    if (s && s.scriptStatus) return new Response("<html>gateway</html>", { status: s.scriptStatus, headers: { "content-type": "text/html" } });
    if (!s || s.body == null) return json(404, { success: false });
    return new Response(s.body, { status: 200, headers: { "content-type": "application/javascript+module" } });
  }
  /* R2 buckets (a test deploy's, p3dev.mjs): `buckets` lists the account's; GET answers 200 or 404, POST creates one. */
  if ((m = path.match(/\/r2\/buckets\/([^/]+)$/))) {
    log(entry);
    return (S.buckets || []).includes(m[1]) ? json(200, { success: true, result: { name: m[1] } }) : json(404, { success: false });
  }
  if (/\/r2\/buckets$/.test(path) && method === "POST") {
    const { name } = JSON.parse(String(init.body));
    log({ ...entry, bucket: name });
    (S.buckets ||= []).push(name);
    return json(200, { success: true, result: { name } });
  }
  log({ ...entry, unrouted: true });
  return json(404, { success: false });
};
