/* The built-in scan (R1–R4) and the signature mirror (R6). The Worker reads every byte from the group's bucket and
 * hands the `FileScanner` image copies (container/scanner.mjs): the mirrored set when the image does not hold it, then
 * one request's targets, scanned by one run that loads the set once.
 *
 * The mirror lives under `clamav/`: `clamav/current.json` names the set in use (each file's key, version, build time
 * and signature count), `clamav/state.json` the last attempt, its error and, while a run is under way, its stage,
 * `clamav/request.json` an asynchronous request not yet finished, and the files themselves sit under
 * `clamav/sets/<run>/`. A run stages what changed, has the image verify each file's digital signature, and only then
 * replaces `current.json`, so a failed run leaves the last good set. A run writes its state when it starts and at each
 * stage, so the invocation the platform cuts after the answer leaves its start and its stage behind, and the
 * scheduled trigger (`mirrorTick`) finishes what was left. */
import { SCAN_BATCH_MAX, SIGNATURES_MAX_AGE_MS, SCAN_MAX_BYTES, SCAN_LIMITS } from './limits.mjs';
import { normaliseTarget, knownStore, sizeTarget, targetStream, writeObject, deleteObject, readJson } from './store.mjs';
/** @import { Deps, BoundDeps, Bucket, ContainerFetch, ContainerInit, RequestBody, RawTarget, Answer, PutBody } from './store.mjs' */

/** @typedef {{ ok?: boolean }} ImageAnswer what every answer of the `FileScanner` image states: whether it did what was asked */
/** @typedef {{ ok?: boolean, set?: string | null, clamav_version?: string }} SigsAnswer `GET /sigs`: the set the image holds */
/** @typedef {{ result: string, findings?: string[], detail?: string }} ScannedTarget one target's answer from the image's scan */
/** @typedef {{ ok?: boolean, engine_version?: string, results: { [index: string]: ScannedTarget } }} ScanAnswer a scan run's answer, by target index */
/** @typedef {{ verified: boolean, version: string | null, build_time: string | null, sigs: string | null }} VerifiedFile what sigtool states of one file */
/** @typedef {{ ok?: boolean, files: { [file: string]: VerifiedFile } }} VerifyAnswer a verification's answer, by file */
/**
 * What the signature updater answered to a run: the files and which changed, or why it did not.
 * @typedef {{ ok?: boolean, code?: string, detail?: unknown, files?: string[], changed?: string[] }} UpdaterAnswer
 */
/**
 * One database file of a mirrored set: its key in the bucket and, once verified, what its signature states.
 * @typedef {{ key: string, last_modified?: null, version?: string | null, build_time?: string | null, sigs?: string | null }} SetFile
 */
/** @typedef {{ [name: string]: SetFile }} SetFiles a set's files, by name */
/**
 * `clamav/current.json`: the set in use.
 * @typedef {{ set: string, files: SetFiles, published: string, mirrored_at: string }} CurrentSet
 */
/**
 * `clamav/state.json`: the last attempt, its error and, while a run is under way, its stage.
 * @typedef {{ last_attempt: string, last_error: string | null, stage: string | null, stage_at: string | null }} MirrorState
 */
/** @typedef {{ requested_at: string }} MirrorRequest `clamav/request.json`: an asynchronous request not yet finished */
/** @typedef {{ attempt: string, stage?: string | null, stage_at?: string, error?: string | null }} RunRecord one run's attempt, stage and error, as it goes */
/**
 * The versions of the set's databases and when it was published.
 * @typedef {{ main: number | null, daily: number | null, bytecode: number | null, published: string }} Signatures
 */
/**
 * What every ClamAV verdict states.
 * @typedef {Object} VerdictBase
 * @property {string | null} capture_sha
 * @property {'clamav'} tool
 * @property {'clamav'} engine
 * @property {string | null} engine_version
 * @property {Signatures | null} signatures
 * @property {string} scanned_at
 * @property {string[]} findings
 * @property {number} latency_ms
 */
/** @typedef {{ result: string, reason: string }} NotScannedFields a target not scanned, and why */
/** @typedef {{ result: string, findings: string[] }} ScannedFields a target scanned: its result and the findings named */
/** @typedef {{ result: string, findings: string[], detail: string }} ScannedDetailFields a target scanned, with why it is not `clean` when ClamAV could not say */
/** @typedef {NotScannedFields | ScannedFields | ScannedDetailFields} VerdictFields what sets one verdict apart */
/** @typedef {VerdictBase & VerdictFields} Verdict one target's ClamAV verdict (R3), as `POST /scan` answers it */
/**
 * One mirror run's outcome.
 * @typedef {{ ok: boolean, versions: Signatures | null, published: string | null, error?: string | null }} MirrorOutcome
 */
/** @typedef {{ ok: boolean, skipped: string }} TickSkipped the scheduled trigger's answer when it did nothing, and why */
/** @typedef {{ ok: true, unread: true }} Unread an image's answer came before the copy was read whole */
/**
 * How staging one target ended: read whole, refused with its reason, or answered before it was read.
 * @typedef {{ ok: true, unread?: true, reason?: undefined } | { ok: false, reason: string, unread?: undefined }} StagedOutcome
 */
/**
 * /version's `signatures` (R8).
 * @typedef {Object} SignatureState
 * @property {Signatures | null} versions
 * @property {string | null} published
 * @property {string | null} mirrored_at
 * @property {string | null} last_attempt
 * @property {string | null} last_error
 * @property {string | null} stage
 * @property {string | null} stage_at
 * @property {string} [request]
 */

export const CURRENT = 'clamav/current.json';
export const STATE = 'clamav/state.json';
export const REQUEST = 'clamav/request.json';

/** R6: `last_error` while a run is under way, with its `stage` (`seed`, `download`, `stage`, `verify`) in `state.json`. */
export const RUN_STARTED = 'RUN_STARTED';
/** R6: a run whose last stage is older than this has stopped, and the tick resumes it. */
export const RUN_DEAD_MS = 15 * 60_000;
/** R6: the moment an asynchronous run, begun in the invocation the platform keeps about 30 s past the answer, is left
 *  to end before the tick finishes its open request. */
export const DOOR_RUN_MS = 90_000;
/** R6: with no request and no run under way, the scheduled trigger mirrors once in this time. */
export const MIRROR_EVERY_MS = 23 * 60 * 60_000;

/** @param {number} now @returns {string} */
const runId = (now) => `r${new Date(now).toISOString().replace(/[-:.TZ]/g, '')}${Math.random().toString(36).slice(2, 8)}`;
/** @param {number} status @param {object} body @returns {Response} */
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** `{main, daily, bytecode, published}` as the set states them.
 *  @param {CurrentSet | null} current @returns {Signatures | null} */
export function signaturesOf(current) {
  if (!current) return null;
  /** @param {string} db @returns {number | null} */
  const v = (db) => {
    const f = Object.entries(current.files).find(([n]) => n.split('.')[0] === db);
    return f && Number.isFinite(Number(f[1].version)) ? Number(f[1].version) : null;
  };
  return { main: v('main'), daily: v('daily'), bytecode: v('bytecode'), published: current.published };
}

/** A container answer as JSON, or null when the image could not be reached or answered otherwise.
 *  @template {ImageAnswer} T @param {ContainerFetch} container @param {string} path @param {ContainerInit} [init]
 *  @returns {Promise<T | null>} */
async function ask(container, path, init) {
  try {
    const r = await container(path, init);
    const body = /** @type {T | null} the image's own answer */ (await r.json().catch(() => null));
    return r.ok && body && body.ok ? body : null;
  } catch { return null; }
}

/** R4: the image holds `current`'s set, loaded from the bucket only when it does not. Answers the image's ClamAV
 *  version, or null when the set could not be loaded.
 *  @param {BoundDeps} deps @param {CurrentSet} current @returns {Promise<string | null>} */
async function ensureSet(deps, current) {
  /** @type {SigsAnswer | null} */
  const held = await ask(deps.scanner, '/sigs');
  if (!held) return null;
  const version = held.clamav_version || 'not reported';
  if (held.set === current.set) return version;
  for (const [name, f] of Object.entries(current.files)) {
    const obj = await deps.bucket.get(f.key);
    if (!obj) return null;
    const put = await ask(deps.scanner, `/sigs/${current.set}/${name}`, { method: 'PUT', body: obj.body, duplex: 'half' });
    if (!put) return null;
  }
  return (await ask(deps.scanner, `/sigs/${current.set}/load`, { method: 'POST' })) ? version : null;
}

/** POST /scan (R1–R4).
 *  @param {Deps} deps @param {RequestBody | null} body @returns {Promise<Response>} */
export async function scan(deps, body) {
  const started = deps.now();
  const store = body && body.store;
  if (!body || !knownStore(store)) return reply(400, { ok: false, code: 'NAMESPACE_UNKNOWN' });
  const targets = body.targets;
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > SCAN_BATCH_MAX) return reply(400, { ok: false, code: 'BAD_BATCH' });
  /** @type {unknown[]} the batch, each target not yet checked */
  const batch = targets;
  if (!deps.bucket) return reply(503, { ok: false, code: 'R2_NOT_CONFIGURED' });
  /** @type {CurrentSet | null} */
  const current = await readJson(deps.bucket, CURRENT);
  const signatures = signaturesOf(current);
  let engineVersion = 'not reported';
  /** @param {string | null} capture_sha @param {VerdictFields} fields @returns {Verdict} */
  const verdict = (capture_sha, fields) => ({ capture_sha, tool: 'clamav', engine: 'clamav', engine_version: null,
    signatures, scanned_at: new Date(deps.now()).toISOString(), findings: [], latency_ms: Math.max(0, deps.now() - started), ...fields });
  /** @param {unknown} sha @param {string} reason @returns {Verdict} */
  const notScanned = (sha, reason) => verdict(typeof sha === 'string' ? sha : null, { result: 'not_scanned', reason });

  /** @param {unknown} t @returns {unknown} */
  const shaOf = (t) => {
    if (!t || typeof t !== 'object') return null;
    /** @type {RawTarget} the target, its members not yet checked */
    const raw = t;
    return raw.capture_sha;
  };
  /** @type {Verdict[]} */
  const out = new Array(batch.length);
  /** @type {string | null} */
  let setReason = null;
  if (!current) setReason = 'SIGNATURES_ABSENT';
  else if (!(Date.parse(current.published) >= deps.now() - SIGNATURES_MAX_AGE_MS)) setReason = 'SIGNATURES_STALE';
  else {
    const v = await ensureSet(deps, current);
    if (v) engineVersion = v; else setReason = 'SCANNER_UNAVAILABLE';
  }
  const reason = setReason;
  const job = runId(deps.now());
  /** @type {[number, string][]} each staged target's index and digest */
  const staged = [];
  let stagedBytes = 0;
  for (let i = 0; i < batch.length; i++) {
    const t = normaliseTarget(batch[i]);
    if (!t) { out[i] = notScanned(shaOf(batch[i]), 'BAD_TARGET'); continue; }
    if (reason) { out[i] = notScanned(t.capture_sha, reason); continue; }
    const size = await sizeTarget(deps.bucket, store, t);
    if (!size.ok) { out[i] = notScanned(t.capture_sha, size.reason); continue; }
    // R2 (G136b): the targets staged for one run total at most SCAN_MAX_BYTES; one that would pass it is left for the caller to send again.
    if (stagedBytes + size.bytes > SCAN_MAX_BYTES) { out[i] = notScanned(t.capture_sha, 'BATCH_BUDGET'); continue; }
    const { stream, outcome } = targetStream(deps.bucket, store, t);
    const put = await ask(deps.scanner, `/job/${job}/${i}`, { method: 'PUT', body: stream, duplex: 'half' });
    // An image that answered before reading the copy whole took nothing to scan.
    /** @type {StagedOutcome} */
    const o = await Promise.race([outcome, new Promise(/** @param {(u: Unread) => void} res */ (res) => setTimeout(() => res({ ok: true, unread: true }), 0))]);
    if (o.unread || !o.ok || !put) {
      await ask(deps.scanner, `/job/${job}/${i}`, { method: 'DELETE' });
      out[i] = notScanned(t.capture_sha, o.ok || o.unread ? 'SCANNER_UNAVAILABLE' : o.reason);
      continue;
    }
    staged.push([i, t.capture_sha]);
    stagedBytes += size.bytes;
  }
  if (staged.length) {
    /** @type {ScanAnswer | null} */
    const r = await ask(deps.scanner, `/job/${job}/scan?set=${encodeURIComponent(current.set)}&limits=${encodeURIComponent(JSON.stringify(SCAN_LIMITS))}`, { method: 'POST' });
    if (r) engineVersion = r.engine_version || 'not reported';
    for (const [i, sha] of staged) {
      const v = r && r.results[i], detail = v ? v.detail : undefined;
      out[i] = v ? verdict(sha, { result: v.result, findings: v.findings || [], ...(detail ? { detail } : {}) })
        : notScanned(sha, 'SCANNER_UNAVAILABLE');
    }
  } else {
    await ask(deps.scanner, `/job/${job}`, { method: 'DELETE' });
  }
  for (const v of out) v.engine_version = engineVersion;
  return reply(200, { ok: true, verdicts: out });
}

// ── the mirror (R6)

/** @param {Bucket} bucket @param {string} key @param {Answer} response @returns {Promise<unknown>} */
async function putStream(bucket, key, response) {
  const len = Number(response.headers.get('content-length'));
  /** @type {PutBody} */
  let body = response.body;
  if (typeof FixedLengthStream === 'function' && Number.isSafeInteger(len) && len > 0) {
    const fixed = new FixedLengthStream(len); // eslint-disable-line no-undef
    response.body.pipeTo(fixed.writable).catch(() => {});
    body = fixed.readable;
  } else if (typeof FixedLengthStream !== 'function') {
    body = new Uint8Array(await response.arrayBuffer());
  }
  return writeObject(bucket, key, body);
}

/** What the signature updater (the image's `freshclam`, R34) answered to a run, whole: its refusal keeps its reason.
 *  @param {BoundDeps} deps @param {string} path @param {ContainerInit} [init] @returns {Promise<UpdaterAnswer>} */
async function askUpdater(deps, path, init) {
  try {
    const r = await deps.updater(path, init);
    const body = /** @type {UpdaterAnswer | null} the updater's own answer */ (await r.json().catch(() => null));
    return body && typeof body === 'object' ? body : { ok: false, code: 'UPDATER_UNAVAILABLE' };
  } catch { return { ok: false, code: 'UPDATER_UNAVAILABLE' }; }
}

/** R6: the mirrored set handed to the updater's fresh directory, so that `freshclam` brings each database up to date
 *  and does not fetch it whole. Answers false when the updater did not take a file (the run then goes on unseeded). */
/** @param {BoundDeps} deps @param {string} run @param {CurrentSet} previous @returns {Promise<boolean>} */
async function seedUpdater(deps, run, previous) {
  for (const [name, f] of Object.entries(previous.files || NO_FILES)) {
    const obj = await deps.bucket.get(f.key);
    if (!obj) return false;
    /** @type {Answer} */
    let r;
    try { r = await deps.updater(`/update/${run}/${name}`, { method: 'PUT', body: obj.body, duplex: 'half' }); } catch { return false; }
    if (!r.ok) return false;
  }
  return true;
}

/** A set with no files, for a set read back without its `files`. @type {SetFiles} */
const NO_FILES = {};

/** @param {RunRecord} run */
const stateOf = (run) => {
  const stage = run.stage;
  return stage ? { last_attempt: run.attempt, last_error: RUN_STARTED, stage, stage_at: run.stage_at }
    : { last_attempt: run.attempt, last_error: run.error || null, stage: null, stage_at: null };
};

/** R6: the run's state, written at its start and at each stage (and, with no `stage`, at its end).
 *  @param {BoundDeps} deps @param {RunRecord} run @param {string | null} stage @returns {Promise<void>} */
async function writeState(deps, run, stage) {
  if (stage) { run.stage = stage; run.stage_at = new Date(deps.now()).toISOString(); } else run.stage = null;
  await writeObject(deps.bucket, STATE, JSON.stringify(stateOf(run)));
}

/** R6: the asynchronous door's first act: the request, then the run's start in `state.json`, both before the 202.
 *  @param {BoundDeps} deps @returns {Promise<RunRecord>} */
async function begin(deps) {
  /** @type {RunRecord} */
  const run = { attempt: new Date(deps.now()).toISOString() };
  await writeObject(deps.bucket, REQUEST, JSON.stringify({ requested_at: run.attempt }));
  await writeState(deps, run, 'seed');
  return run;
}

/** One mirror run: `{ok, versions, published, error?}`. The databases come from ClamAV's own updater, `freshclam`, run
 *  in the signature-updater instance of the image under its own identity (R6, R34); the Worker opens no connection.
 *  `begun` is the state an asynchronous door already wrote.
 *  @param {BoundDeps} deps @param {RunRecord} [begun] @returns {Promise<MirrorOutcome>} */
export async function runMirror(deps, begun) {
  const now = deps.now();
  /** @type {RunRecord} */
  const run0 = begun || { attempt: new Date(now).toISOString() };
  /** @type {CurrentSet | null} */
  const previous = await readJson(deps.bucket, CURRENT);
  const run = runId(now);
  /** @type {string[]} */
  const staged = [];
  /** @type {SetFiles} */
  const files = {};
  /** @type {string | null} */
  let error = null;
  try {
    if (!begun) await writeState(deps, run0, 'seed');
    if (previous && !(await seedUpdater(deps, run, previous))) await askUpdater(deps, `/update/${run}`, { method: 'DELETE' });
    await writeState(deps, run0, 'download');
    const got = await askUpdater(deps, `/update/${run}`, { method: 'POST' });
    const names = got.files;
    if (!got.ok || !Array.isArray(names)) {
      throw new Error(got.code === 'MIRROR_REFUSED' ? `MIRROR_REFUSED:${String(got.detail || 'no reason given').slice(0, 300)}` : 'UPDATER_UNAVAILABLE');
    }
    await writeState(deps, run0, 'stage');
    try {
      // The updater names what it changed from the set it was handed; an answer without that list changed everything.
      const named = got.changed;
      const changed = new Set(Array.isArray(named) ? named : names);
      for (const name of names) {
        const held = previous && previous.files && previous.files[name];
        if (!changed.has(name) && held) { files[name] = held; continue; }
        /** @type {Answer} */
        let r;
        try { r = await deps.updater(`/update/${run}/${name}`); } catch { throw new Error(`UPDATER_UNAVAILABLE:${name}`); }
        if (r.status !== 200 || !r.body) throw new Error(`UPDATER_UNAVAILABLE:${name}`);
        const key = `clamav/sets/${run}/${name}`;
        await putStream(deps.bucket, key, r);
        staged.push(key);
        files[name] = { key, last_modified: null };
      }
    } finally { await askUpdater(deps, `/update/${run}`, { method: 'DELETE' }); }
    // Each new file's digital signature, verified by the image's sigtool before the set replaces the last good one.
    await writeState(deps, run0, 'verify');
    const fresh = Object.entries(files).filter(([, f]) => staged.includes(f.key));
    if (fresh.length) {
      for (const [db, f] of fresh) {
        const obj = await deps.bucket.get(f.key);
        if (!obj || !(await ask(deps.scanner, `/verify/${run}/${db}`, { method: 'PUT', body: obj.body, duplex: 'half' }))) {
          throw new Error(`VERIFIER_UNAVAILABLE:${db}`);
        }
      }
      /** @type {VerifyAnswer | null} */
      const v = await ask(deps.scanner, `/verify/${run}`, { method: 'POST' });
      if (!v) throw new Error('VERIFIER_UNAVAILABLE');
      for (const [db, f] of fresh) {
        const s = v.files[db];
        if (!s || !s.verified) throw new Error(`SIGNATURE_INVALID:${db}`);
        Object.assign(f, { version: s.version, build_time: s.build_time, sigs: s.sigs });
      }
    }
    const published = Object.values(files).map((f) => Date.parse(String(f.build_time))).filter(Number.isFinite);
    if (!published.length) throw new Error('NO_BUILD_TIME');
    const current = { set: fresh.length ? run : previous.set, files, published: new Date(Math.max(...published)).toISOString(),
      mirrored_at: new Date(now).toISOString() };
    await writeObject(deps.bucket, CURRENT, JSON.stringify(current));
    // The previous set's files that the new one no longer names.
    const keep = new Set(Object.values(files).map((f) => f.key));
    for (const f of Object.values((previous && previous.files) || NO_FILES)) if (!keep.has(f.key)) await deleteObject(deps.bucket, f.key);
    await writeState(deps, run0, null);
    await deleteObject(deps.bucket, REQUEST);
    return { ok: true, versions: signaturesOf(current), published: current.published };
  } catch (e) {
    const message = String(e.message || e);
    error = message;
    for (const key of staged) await deleteObject(deps.bucket, key).catch(() => {});
    run0.error = message;
    await writeState(deps, run0, null);
    await deleteObject(deps.bucket, REQUEST);
    const last = previous ? signaturesOf(previous) : null;
    return { ok: false, versions: last, published: previous ? previous.published : null, error: message };
  }
}

/** POST /mirror?async=1 (R6): the request and the run's start are written, then the run is begun and left to end after
 *  the answer; if the platform cuts it, its state names the stage it reached and the scheduled trigger finishes it.
 *  @param {Deps} deps @returns {Promise<Response>} */
export async function mirrorAsync(deps) {
  if (!deps.bucket) return reply(503, { ok: false, code: 'R2_NOT_CONFIGURED' });
  const begun = await begin(deps);
  const run = runMirror(deps, begun).catch(() => {});
  if (typeof deps.waitUntil === 'function') deps.waitUntil(run);
  return reply(202, { ok: true, started: true });
}

/** R6: the scheduled trigger, every ten minutes. It finishes an open request (once the door's own run has had its
 *  moment), resumes a run whose last stage is older than 15 minutes, and otherwise mirrors once a day. Answers the
 *  run's outcome, or `{skipped}` with the reason it did nothing.
 *  @param {Deps} deps @returns {Promise<MirrorOutcome | TickSkipped>} */
export async function mirrorTick(deps) {
  if (!deps.bucket) return { ok: false, skipped: 'R2_NOT_CONFIGURED' };
  const now = deps.now();
  /** @type {MirrorState | null} */
  const state = await readJson(deps.bucket, STATE);
  /** @type {MirrorRequest | null} */
  const request = await readJson(deps.bucket, REQUEST);
  const underWay = state && state.last_error === RUN_STARTED && state.stage;
  const age = underWay ? now - Date.parse(String(state.stage_at)) : null;
  if (request) {
    if (underWay && age < DOOR_RUN_MS) return { ok: true, skipped: 'RUN_ALIVE' };
    return runMirror(deps);
  }
  if (underWay) return age < RUN_DEAD_MS ? { ok: true, skipped: 'RUN_ALIVE' } : runMirror(deps);
  /** @type {CurrentSet | null} */
  const current = state ? null : await readJson(deps.bucket, CURRENT);
  const last = state ? Date.parse(state.last_attempt) : (current ? Date.parse(current.mirrored_at) : NaN);
  if (Number.isFinite(last) && now - last < MIRROR_EVERY_MS) return { ok: true, skipped: 'RUN_WITHIN_DAY' };
  return runMirror(deps);
}

/** POST /mirror (R6). @param {Deps} deps @returns {Promise<Response>} */
export async function mirror(deps) {
  if (!deps.bucket) return reply(503, { ok: false, code: 'R2_NOT_CONFIGURED' });
  return reply(200, await runMirror(deps));
}

/** /version's `signatures` (R8). @param {Bucket | null} bucket @returns {Promise<SignatureState>} */
export async function signatureState(bucket) {
  /** @type {CurrentSet | null} */
  const current = bucket ? await readJson(bucket, CURRENT) : null;
  /** @type {MirrorState | null} */
  const state = bucket ? await readJson(bucket, STATE) : null;
  /** @type {MirrorRequest | null} */
  const request = bucket ? await readJson(bucket, REQUEST) : null;
  return { versions: signaturesOf(current), published: current ? current.published : null,
    mirrored_at: current ? current.mirrored_at : null, last_attempt: state ? state.last_attempt : null,
    last_error: state ? state.last_error : null, stage: (state && state.stage) || null,
    stage_at: (state && state.stage_at) || null,
    ...(request && request.requested_at ? { request: request.requested_at } : {}) };
}
