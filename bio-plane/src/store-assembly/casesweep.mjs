/* plane R87 (T51 fix round 6, G54; K4426, K4565, K4566, K4571; ratification R57, publication R15): THE CASE-FILE SWEEP, A CONSUMER OF THE OBJECT'S ALARM. A complete, signed
   edition whose case file was not built (or whose manifest was recorded over bytes never stored) is owed, and the object's own alarm builds it: `scheduler` is handed this consumer at
   composition, beside `pending-work`, before its start, so a restart re-derives the alarm of an owed edition (scheduler R11). Everything that decides what is owed, how it is built, how
   a failure backs off and when an edition is stopped belongs to `ratification` (`caseFileSweep`, `caseFileWake`), `publication` (the ledger) and `public-read` (the assembly); this
   file only gives their answers the consumer's shape `{name, key, due, wake, tick}` (scheduler R8):
     due   at the instant the sweep wants a wake that has come, else none;
     wake  the sweep's own next instant (now while an edition is due, else the ledger's earliest next try, else none) and never raised to the instant asked, so a consumer whose
           wake has not moved after its tick is held by scheduler R27 and cannot keep the alarm firing at once;
     tick  one sweep (at most two editions, ratification R57), answered under the key `casefilesweep` as `{asked, finished, retried, built, failed, files, bytes}`. `finished` counts the
           editions BUILT: a tick that built one made progress, so R27's hold never strands the owed editions that follow it (G35). A failed assembly is `retried` (its backoff is
           publication's: the wake moves), never `finished`. */
const finiteOr = (v) => (Number.isFinite(v) ? v : null);

export function casefileSweepConsumer(ratification) {
  const wakeAt = (at) => { try { return finiteOr(ratification.caseFileWake(at)); } catch { return null; } };
  return {
    name: "casefile-sweep", key: "casefilesweep",
    due: (at) => { const w = wakeAt(at); return w !== null && w <= at ? at : null; },
    wake: (at) => wakeAt(at),
    tick: async (at) => {
      const r = await ratification.caseFileSweep(at);
      const built = Array.isArray(r && r.built) ? r.built : [], failed = Array.isArray(r && r.failed) ? r.failed : [];
      return { casefilesweep: { asked: built.length + failed.length, finished: built.length, retried: failed.length,
                                built: built.map((e) => ({ case: e.case, edition: e.edition })), failed: failed.map((e) => ({ case: e.case, edition: e.edition, code: e.code ?? null })),
                                files: r && Number.isFinite(r.files) ? r.files : 0, bytes: r && Number.isFinite(r.bytes) ? r.bytes : 0,
                                ...(r && r.ok === false ? { ok: false, reason: r.reason ?? null } : {}) } };
    },
  };
}
