/* monitoring's published fixtures (fix round 10; K4990, K4993, K4995, K5044): each is made by monitoring's real code over the
   real modules it uses (./fixture.mjs) when a test calls it, never stored. A user takes the answer from here instead of
   hand-building monitoring's answer (an unread flagged read, a tick's answer, the plan and queue reads). Each is checked by
   `fixtures.test.mjs`, which calls it and compares the real answer. */
import { world, serve, DAEMON, NOW_MS } from "./fixture.mjs";

const DAY = 24 * 3600000;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const tick = (w, id) => w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON });
const LOC = (n) => `https://records.example.org/fx-${n}.txt`;

/** R48: `flagged({viewer, limit})` as it answers when the read cannot be made (the projection it reads is gone): `{ok: false,
 *  reason: null, items: [], limit, truncated: false, detail}`, the detail in words, never a throw. */
export function flaggedRefusal({ limit = null } = {}) {
  const w = world();
  w.st.db.exec(`DROP TABLE bundle_projection`);
  return w.m.flagged({ viewer: DAEMON, ...(limit === null ? {} : { limit }) });
}

/** R1–R10: the real `monitor({bundleId})` answer `{status, body}` of a monitored document ticked `ticks` times, one tick a
 *  day of the test's clock (the first at `NOW_MS`). `kind` is `modified` (the source serves new bytes at every tick: the
 *  answer is `modified` and carries `capture.sha256`, a distinct digest for each tick) or `unchanged` (the source serves
 *  the captured bytes: `capture` is null). `answers` has one entry per tick; `answer` is the last. */
export async function monitorAnswer({ ticks = 1, kind = "modified" } = {}) {
  if (kind !== "modified" && kind !== "unchanged") throw new Error(`monitorAnswer: no kind "${kind}"`);
  const w = world();
  const id = "INFO-2026-0601-tick", loc = LOC("tick");
  w.monitored(id, loc, "tick v0", { freq: "daily" });
  const answers = [];
  for (let i = 1; i <= ticks; i++) {
    w.clock.ms = NOW_MS + (i - 1) * DAY;
    w.net.routes[loc] = serve(kind === "modified" ? `tick v${i}` : "tick v0");
    answers.push(await tick(w, id));
  }
  return { world: w, bundleId: id, locator: loc, kind, answers, answer: answers[ticks - 1] };
}

/* The reads queue-producers, machinery-producers, queue and scheduler make of monitoring over one world, at `now`. */
const readsOf = (w, viewer, now) => ({
  monitoring: w.m.monitoring({ viewer, now }),
  archiveEligible: w.m.archiveEligible(now),
  flagged: w.m.flagged({ viewer }),
  configured: w.m.configured(),
  archiveDue: w.m.archiveDue(now),
});

/** R16, R19, R20, R32, R47, R48: the reads of monitoring for `queue`, its producers and `scheduler`, made by the real module.
 *  `empty` is a world with no monitored document (nothing listed, nothing flagged, nothing eligible). `seeded` is a world of
 *  real monitors, each in the state named: `unscheduled` (frequency `none`), `due` (never checked), `modified` and `removed`
 *  (a real tick found the source changed or gone, so the document is flagged), `quiet` (a real tick found it unchanged: not
 *  flagged, scheduled), and the addresses `gone` (three counted failures) and `young` (two failures in a young run: at the
 *  floor, not eligible), the first fallback-eligible. Each carries `monitoring`, `archiveEligible`, `flagged` (as `viewer`
 *  reads them at `now`), `configured` and `archiveDue`. */
export async function monitoringReads() {
  const now = NOW_MS, viewer = DAEMON;
  const e = world();
  const empty = { world: e, viewer, now, ...readsOf(e, viewer, now) };

  const w = world();
  const ids = { unscheduled: "INFO-2026-0611-unscheduled", due: "INFO-2026-0612-due", modified: "INFO-2026-0613-modified",
                removed: "INFO-2026-0614-removed", quiet: "INFO-2026-0615-quiet" };
  w.monitored(ids.unscheduled, LOC("unscheduled"), "unscheduled v1", { freq: "none" });
  w.monitored(ids.modified, LOC("modified"), "modified v1", { freq: "daily" });
  w.monitored(ids.removed, LOC("removed"), "removed v1", { freq: "daily" });
  w.monitored(ids.quiet, LOC("quiet"), "quiet v1", { freq: "daily" });
  w.net.routes[LOC("modified")] = serve("modified v2");
  w.net.routes[LOC("removed")] = serve("gone", "text/plain", 404);
  w.net.routes[LOC("quiet")] = serve("quiet v1");
  /* R4: a removal is confirmed by a look 24 hours or more after the first, so the first look is a day and an hour earlier */
  w.clock.ms = now - 25 * 3600e3;
  await tick(w, ids.removed);
  w.clock.ms = now;
  for (const k of ["modified", "removed", "quiet"]) await tick(w, ids[k]);
  w.monitored(ids.due, LOC("due"), "due v1", { freq: "daily" });
  const at = "2026-09-20T00:00:00Z";
  const addresses = { gone: "https://gone.example.org/fx-gone", young: "https://gone.example.org/fx-young" };
  for (let i = 0; i < 3; i++) await w.capture.recordSourceOutcome({ addressNorm: addresses.gone, outcome: "fetch_failed", at });
  for (let i = 0; i < 2; i++) await w.capture.recordSourceOutcome({ addressNorm: addresses.young, outcome: "fetch_failed", at: iso(now - DAY) });
  const seeded = { world: w, viewer, now, bundles: ids, addresses, ...readsOf(w, viewer, now) };
  return { empty, seeded };
}
