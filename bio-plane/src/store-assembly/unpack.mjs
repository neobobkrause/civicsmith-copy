/* plane (K1951, K2042, K2046; capture R15, R45; acquisition R40; control-plane's `op=unpack`): the drain of capture's
   `archive-unpack` events, an automatic unpack continued past one call. It is a scheduler consumer the composition root
   registers (scheduler R8), and it holds no construct: each event is asked of the Worker as `op=unpack`, as the daemon,
   through the object's loopback binding (`SELF`), so control-plane's door runs it and promotes what it unpacks; and the
   event leaves capture's queue only through capture's own calls (`taskEventRemove`, `taskEventAttempt`, its R45).

   The daemon's credential travels in the `Authorization` header, never in the address (admission R20, F1). Without
   `SELF` or `DAEMON_TOKEN` bound the drain is not configured: it calls nothing and wants no wake. The queue is read in
   pages past capture's opaque `cursor` (R25), so a full head of events at the retry limit hides none behind it.

   What ends an event (K2046): an answer `ok` (the call done; a continuation is a new event capture enqueues), or a
   refusal that a retry will not change (a 4xx other than 408 and 429). Anything else (a 5xx, 408, 429, a member that
   does not answer, an answer that is not JSON) is an attempt, retried with tasks R18's back-off: an event tried `a`
   times is due at its last try + `UNPACK_BACKSTOP_MS` × 2^(a−1), and one tried `UNPACK_RETRY_LIMIT` times wants no
   wake (it stays queued, as capture holds it, and is tried again on any tick that runs for another reason). */

export const ARCHIVE_UNPACK = "archive-unpack";
export const UNPACK_BACKSTOP_MS = 60000;
export const UNPACK_RETRY_LIMIT = 8;
export const UNPACK_BATCH = 10;
/* R25: the page the drain reads capture's queue in, capture R45's largest `limit`. */
export const UNPACK_PAGE = 1000;

const stamp = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

/** When an event is next due, in milliseconds, or null when it has met the retry limit. Never tried: now. */
export function unpackDueAt(ev, now) {
  const a = Number(ev && ev.attempts) || 0;
  if (a <= 0) return now;
  if (a >= UNPACK_RETRY_LIMIT) return null;
  const last = Date.parse(ev && ev.lastTry);
  return Number.isFinite(last) ? last + UNPACK_BACKSTOP_MS * 2 ** (a - 1) : now;
}

/** How a Worker answer ends an event: `remove` (done, or refused for good) or `attempt` (try again later). */
export function unpackOutcome(status, body) {
  if (status >= 200 && status < 300 && !(body && body.ok === false)) return "remove";
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return "remove";
  return "attempt";
}

/** The consumer `{name, key, due, wake, tick}` over capture's queue and the object's environment. */
export function archiveUnpackConsumer({ capture, env }) {
  const configured = () => !!(env && env.SELF && typeof env.SELF.fetch === "function"
                              && typeof env.DAEMON_TOKEN === "string" && env.DAEMON_TOKEN !== "");
  /* R25 (K2097; capture R45): every queued event, read in pages of `UNPACK_PAGE`, each page after the `cursor` of the last
     page's last event while a page comes back full, so the events at the retry limit, which stay queued at the head,
     never hide the newer ones behind them; a cursor that does not move on ends the read, so none is read twice. */
  const events = () => {
    const all = [];
    try {
      let after = null;
      for (;;) {
        const page = capture().taskEvents({ kind: ARCHIVE_UNPACK, limit: UNPACK_PAGE, ...(after !== null ? { after } : {}) }) || [];
        all.push(...page);
        const last = page.length ? page[page.length - 1].cursor : null;
        if (page.length < UNPACK_PAGE || typeof last !== "string" || last === "" || last === after) break;
        after = last;
      }
    } catch { /* what was read stands */ }
    return all;
  };
  const next = (now) => {
    let at = null;
    for (const ev of events()) { const d = unpackDueAt(ev, now); if (d !== null && (at === null || d < at)) at = d; }
    return at;
  };
  return {
    name: ARCHIVE_UNPACK, key: "archiveunpack",
    due: (now) => { if (!configured()) return null; const at = next(now); return at !== null && at <= now ? now : null; },
    wake: (now) => { if (!configured()) return null; const at = next(now); return at === null ? null : Math.max(at, now); },
    tick: async (now) => {
      if (!configured())
        return { archiveunpack: { configured: false, why: "SELF or DAEMON_TOKEN is not bound, so no archive is unpacked by the daemon" } };
      const due = events().filter((ev) => { const d = unpackDueAt(ev, now); return d !== null && d <= now; }).slice(0, UNPACK_BATCH);
      const out = { configured: true, asked: 0, removed: 0, retried: 0, results: [] };
      for (const ev of due) {
        out.asked++;
        let status = 0, body = null;
        try {
          const res = await env.SELF.fetch(new Request("https://self/api/?op=unpack", { method: "POST",
            headers: { authorization: `Bearer ${env.DAEMON_TOKEN}`, "content-type": "application/json" },
            /* G129e: the project the archive was filed under, when its event names one, rides with the call, so a continuation's members land in it */
            body: JSON.stringify({ archiveSha: ev.captureSha, ...(typeof ev.project === "string" && ev.project ? { project: ev.project } : {}) }) }));
          status = res.status;
          try { body = await res.json(); } catch { body = null; status = status >= 200 && status < 300 ? 502 : status; }
        } catch { status = 0; }
        const outcome = unpackOutcome(status, body);
        if (outcome === "remove") { capture().taskEventRemove({ kind: ARCHIVE_UNPACK, captureSha: ev.captureSha }); out.removed++; }
        else { capture().taskEventAttempt({ kind: ARCHIVE_UNPACK, captureSha: ev.captureSha, at: stamp(now) }); out.retried++; }
        out.results.push({ archive: ev.captureSha, status, outcome, ...(body && body.reason ? { reason: body.reason } : {}) });
      }
      return { archiveunpack: out };
    },
  };
}
