/* The seed for Settings › Security, Updates and The team's assistant over the world (store-request's `storeWorld`, K5054): the worlds
   these screens' tests need, made by the real acts; and the few faults a world cannot make (an answer that never comes). */
import { storeWorld, teamAccountOn } from "./kit.mjs";

/** The sealing secret a deployment sets so that a key can be kept (ai-accounts R22; a platform binding, so a double of the environment). */
export const SEAL = "a-long-seal-secret-for-screens-settings";

/** A team with its founder (the one active administrator), signed in; `env` is handed to the world as platform doubles. */
export async function team(env = {}) {
  const w = await storeWorld({ env });
  const founder = await w.signIn("founder");
  return { w, founder };
}

/** The founder's handle as the roster gives it (what the screens say for the founder, never the id). */
export const handleOf = async (as, id = "admin") => (await as.read("memberlist")).members.find((m) => m.member_id === id).handle;

/** The team's own account, held (T53, R95: by `aiaccountadd`, the alpha's group key retired), by the real acts (the password asked again first, as an administrator's page does). */
export async function holdKey(as, w, key = "sk-ant-api03-SENTINELKEY") {
  await teamAccountOn(as, w, key);   // aiaccountadd, then aiaccountswitch on, on the store's own catalogue (the kit's `storeWorld`)
  return key;
}

/** The team's spend, as a counter row of the day (WORLD GAP: only a model call's recording makes one, and the model is a platform the
 *  world does not hold; nothing else is seeded). `day` defaults to the first of the month the world's clock stands in. */
export function spend(w, dollars, day = new Date(w.now()).toISOString().slice(0, 8) + "01") {
  w.sql.exec("INSERT INTO ai_usage (owner, member, day, use, mode, calls, cost_micro_usd) VALUES ('group', 'admin', ?, 'ask', 'ask', 3, ?)", day, Math.round(dollars * 1e6));
}

/* ---- Updates ---- */

/** A founder with no handle (the claim chose none): her session is `admin`, and the screens name her by `member.founder.unnamed`. */
export async function unnamedTeam(env = {}) {
  const w = await storeWorld({ claimed: false, env });
  await w.claim({ password: "a-long-enough-passphrase-for-the-founder" });
  return { w, founder: await w.signIn("admin") };
}

/** The release notes a release carries (three parts; `must_do` may be empty). */
export const notesOf = (members, administrators, must_do = "") => ({ members, administrators, must_do });

/** A signed release notice found by the daily check (WORLD GAP: the check verifies a notice against the release keys, whose private
 *  halves no test holds, so the stored notice is seeded exactly as `release_notices` holds it; the fetch itself is unreachable here). */
export function shipped(w, { version, date, security = false, notes = notesOf("M.", "A."), at = new Date(w.now()).toISOString() }) {
  w.sql.exec("INSERT INTO release_notices (version, date, manifest, security, notes, sig, found_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
             version, date, "m".repeat(64), security ? 1 : 0, JSON.stringify(notes), "seeded", at);
}

/** A release that begins to run (WORLD GAP: only a new deployment's start records one; `VERSION` is a platform binding, a double of the
 *  environment): the binding set and the first sighting recorded as the start records it, at the world's clock. */
export function deployed(w, version) {
  w.env.VERSION = version;
  w.sql.exec("INSERT INTO running_releases (version, first_seen_at) VALUES (?, ?)", version, new Date(w.now()).toISOString());
}

/** The team's hosting account held by `holders` (a membership act, the password asked again first). */
export async function holdsHosting(as, w, holders) {
  await as.act("reauth", { body: { password: w.password } });
  await as.act("hostingaccessset", { body: { holders } });
}

/** A day passes and the daily check runs (the scheduler's real tick; no network, so it records that the notice was unreachable); the
 *  sessions of the day before are over, so the member signs in again. */
export async function aDayLater(w, handle = "founder") {
  await w.tick(86400000);
  return w.signIn(handle);
}

/** A parts' double, as the platform's service binding answers `GET /version`. */
export const serving = (name, version, extra = {}) => ({ fetch: async () => new Response(JSON.stringify({ name, version, ...extra }), { status: 200, headers: { "content-type": "application/json" } }) });
export const gone = (why) => ({ fetch: async () => { throw new Error(why); } });

/** What the runtime measures (WORLD GAP: the door's and the capture work's timing is the Worker's own instrumentation, which a world
 *  does not run): `runtime_observations` rows as `recordRuntimeObservation` writes them. */
export function measured(w, rows) {
  for (const r of rows) w.sql.exec("INSERT INTO runtime_observations (metric, peak_ms, peak_at, peak_detail, last_ms, last_at, samples, total_ms, unit) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)",
    r.metric, r.peak, r.peak_at, r.last, r.last_at, r.samples, r.total, r.unit);
}

/** The subrequest ceiling the platform taught by refusing (WORLD GAP: only a refused subrequest of the platform records it). */
export function ceiling(w, observed) {
  w.sql.exec("INSERT INTO capture_limits (runtime, observed, observed_at, first_seen, samples, since_probe) VALUES ('subrequests', ?, ?, ?, 1, 0)",
             observed, new Date(w.now()).toISOString(), new Date(w.now()).toISOString());
}

/* ---- Security ---- */
import { handle as scannerHandle } from "../../../../file-scanner/src/handler.mjs";
import { memoryBucket, depsWith, json, mirrorTestSet } from "../../../../file-scanner/test/helpers.mjs";
import { vendorNet } from "../../../../file-scanner/test/vendors.mjs";

const hang = () => new Promise(() => {});

/* The platform's clock, which `file-safety` reads as `Date.now()` (the assembly hands it no clock; credentials read the world's `BIO_NOW_MS`): a test that
   lets minutes go by without the cron coming (`pass`) moves both, so the two agree. Reset by each `scannerTeam`. */
const realNow = Date.now.bind(Date);
const skew = { ms: 0 };
Date.now = () => realNow() + skew.ms;
/** freshclam, as the image's updater answers a run: refused with its lines, or never answering (a download that outlasts the invocation).
 *  The image's updater has no egress in a test: the one stand-in, at the platform's edge. */
export const refusing = (detail) => async (path, init = {}) => ((init.method || "GET") === "POST" ? json({ ok: false, code: "MIRROR_REFUSED", detail }) : json({ ok: true }));
export const stuck = async (path, init = {}) => ((init.method || "GET") === "POST" ? hang() : json({ ok: true }));

/** `pass(ms)`: time goes by and the platform's cron has not yet come (the clock binding moves, no scheduler consumer runs), as the minutes between
 *  two crons are; `tick(ms)` is the cron coming too.
 *  A team (founder signed in) whose `FILE_SCANNER` binding is the real file-scanner handler over one bucket (every request its own
 *  invocation, the asynchronous mirror's cut `cutAfterMs` after its response, as the platform cuts `waitUntil`), the vendors' APIs it
 *  calls answered by `net` (a fetch; the outside world), and the clock the world's, pinned at the real present (the page reads
 *  `Date.now()`, so a period it asks is one the store's clock admits). `state(now)` is the mirror's record as the bucket holds it;
 *  `signatures` the age in ms of the signature set the mirror holds, if any. `scanner`: "bound", "unreachable" (a binding that does not
 *  answer) or "absent" (no binding). The scanner is a platform binding: the real handler is the double (as `file-safety`'s tests give it). */
export async function scannerTeam({ state = null, cutAfterMs = 20, env = {}, signatures = null, scanner = "bound", net = vendorNet(), now = Date.now() } = {}) {
  skew.ms = 0;
  let world = null;
  const bucket = memoryBucket();
  const env0 = { updater: stuck };
  const deps = (over = {}) => depsWith({ bucket, now: () => world.now(), updater: env0.updater, ...(net ? { fetch: net.fetch } : {}), ...over });
  const bound = {
    async fetch(input, init) {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (!(url.pathname === "/mirror" && url.searchParams.get("async") === "1")) return scannerHandle(request, deps());
      let cut = false;
      const guard = (fn) => (...a) => (cut ? hang() : fn(...a));
      const b = deps().bucket;
      const d = deps({ bucket: { ...b, head: guard(b.head), get: guard(b.get), put: guard(b.put), delete: guard(b.delete), list: guard(b.list) },
        updater: guard(env0.updater), waitUntil: () => {} });
      const res = await scannerHandle(request, d);
      setTimeout(() => { cut = true; }, cutAfterMs);
      return res;
    },
  };
  const FILE_SCANNER = scanner === "bound" ? bound : scanner === "unreachable" ? { fetch: async () => { throw new Error("the scanner did not answer"); } } : undefined;
  world = await storeWorld({ now, env: { ACCOUNT_SEAL_SECRET: SEAL, ...(FILE_SCANNER ? { FILE_SCANNER } : {}), ...env } });
  if (state) await bucket.put("clamav/state.json", JSON.stringify(state(world.now())));
  if (signatures !== null) mirrorTestSet(bucket, { published: new Date(world.now() - signatures).toISOString() });
  const founder = await world.signIn("founder");
  const sigs = async () => (await scannerHandle(new Request("https://file-scanner/version"), deps()).then((r) => r.json())).signatures;
  return { w: world, founder, bucket, env0, deps, sigs, bound, tick: (ms) => world.tick(ms), pass: (ms) => { world.env.BIO_NOW_MS += ms; skew.ms += ms; }, settle: (ms = 60) => new Promise((r) => setTimeout(r, ms)) };
}

/** Hard tries at signing in: `n` sign-ins with a wrong password, as strangers make them (the real `login` refusing each), counted by
 *  the credentials module as the security map's `signin`. `country` is the stamp the edge gives. */
export async function hardTries(w, n, { country = null } = {}) {
  for (let i = 0; i < n; i++)
    await w.door({ url: "/api/?op=login", init: { method: "POST", headers: { "content-type": "application/json", ...(country ? { "cf-ipcountry": country } : {}) },
      body: JSON.stringify({ handle: "founder", password: "not-the-password-" + i, device: "own" }) } });
}

/** A team whose usual for an hour is not nothing, then a burst of `n` hard tries that hour (real `login`s refused), and the clock on to the
 *  present: the period asked by default then holds an unusual hour that is over. The days before are seeded (WORLD GAP: a day lived in a
 *  world costs the daily update check's several seconds of the host governor's spacing, so sixteen days are not lived): one counted hard
 *  try at that hour on each of `days` days, as `security_counts` holds a day's. */
export async function burstTeam({ days = 16, n = 12, ...o } = {}) {
  const HOUR = 3600000, DAY = 24 * HOUR;
  const s = await scannerTeam({ ...o, now: Date.now() - 3 * HOUR });
  const hour = Math.floor(s.w.now() / HOUR);
  for (let i = 1; i <= days; i++) s.w.sql.exec("INSERT INTO security_counts (kind, hour, country, count) VALUES ('signin', ?, '', 1)", hour - 24 * i);
  await hardTries(s.w, n);
  await s.w.tick(3 * HOUR);
  s.founder = await s.w.signIn("founder");
  return s;
}
