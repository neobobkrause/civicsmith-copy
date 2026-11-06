// The run (T53; R43–R60): one gate run per instance, from `POST /run` to the sealed bundle the person takes. Loaded by
// the entry after the server listens (R26). It holds the run's key in memory only (R47, R8), reaches the network only
// through the door (R46) with the run's two-host list (R45), asks the issuer for a challenge before any provider call
// (R49), enforces the ceilings (R51), scrubs then scans (R52), seals and signs inside (R53), shows the manifest before
// the bundle (R54), and wipes the run at discard or at the end of the review window (R55). It writes no file (R9).
import { randomUUID, createHash } from 'node:crypto';
import {
  checkDeclared, selectItems, verifyChallenge, meter, scanForSecrets, buildManifest, sealPayload, signBundle,
  PUBLIC_BANK, hasPrivate, itemById, planRun, scoreAnswerFree, suiteVersions, runPublicLine, encodeBundle, PARTS,
} from '../../ai-gate/src/index.mjs';
import { CATALOGUE_ADDRESS } from '../../bio-plane/src/ai-catalogue/index.mjs';
import {
  TRACE_HEADER, RUN_REF_HEX, KEY_CHARS_MAX, BODY_MAX, REVIEW_WINDOW_MS, CAPTURE, DEPLOYMENTS, DEFAULT_DEPLOYMENT,
  GENERIC_KEY_SHAPES, isObj,
} from './params.mjs';
import { says } from './says.mjs';
import { egressList, makeDoor, hostOf } from './door.mjs';
import { callModel } from './call.mjs';
import { scrubDeep } from './scrub.mjs';
import { SEALING_KEY } from './release.mjs';
import { versionBody } from './version.mjs';

export { selectItems };
const te = new TextEncoder();
const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];
const RUN_TIERS = ['T0', 'T1', 'T2'];
export const ISSUER_ORIGIN = new URL(CATALOGUE_ADDRESS).origin;
export const CHALLENGE_PATH = '/ai/challenge';
// The image's adapter version, named in the payload (ai-gate R55).
export const ADAPTER_VERSION = 'agent-runner-openai-compatible-1';

export const runRefOf = (id) => createHash('sha256').update(String(id)).digest('hex').slice(0, RUN_REF_HEX);
const safeTrace = (v) => (typeof v === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(v) ? v : null);
const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

const reply = (status, body, headers = {}) => ({ status, body, headers: { 'content-type': 'application/json', ...headers } });

/**
 * The runner of one instance. Options are the image's configuration and, in tests, its stubs:
 * `deployment` and `sampleAccounts` (R57, from the container's environment), `imageDigest` (R59), `issuer` (an origin),
 * `fetchImpl` (the platform's fetch, used only by the door), `now`, `log`, `bank`, `sealingKey`, `capture` (R48),
 * `localEndpoint` (R58), `reviewWindowMs`, `scrub` (R52's step; a test turns it off to prove the scan), `startedAt`.
 */
export function makeRunner({
  deployment = DEFAULT_DEPLOYMENT, sampleAccounts = [], imageDigest = null, issuer = ISSUER_ORIGIN,
  fetchImpl = globalThis.fetch, now = Date.now, log = (l) => console.log(JSON.stringify(l)), bank = PUBLIC_BANK,
  sealingKey = SEALING_KEY, capture = CAPTURE, localEndpoint = true, reviewWindowMs = REVIEW_WINDOW_MS, scrub = true,
  startedAt = now(),
} = {}) {
  if (!DEPLOYMENTS.includes(deployment)) throw new Error(`deployment ${deployment} is not one of ${DEPLOYMENTS.join(', ')}`);
  const issuerUrl = new URL(issuer);
  const list = egressList(hostOf(issuerUrl.href));
  let refusedCount = 0;
  const door = makeDoor({ fetchImpl, list, log, onRefused: () => { refusedCount += 1; } });
  let run = null;      // the live run, or a tombstone `{state, ref}` after a wipe
  let served = false;  // R29 `cold`: the first run step since the process started

  const line = (r, step, outcome, fields = {}) => {
    const cold = !served; served = true;
    log({ event: 'gate.runner', trace: r.trace, run_ref: r.ref ?? null, step, outcome, ...fields,
      cold, uptime_s: Math.round((now() - startedAt) / 1000) });
  };
  const refuse = (ctx, step, status, code, extra = {}) => {
    line(ctx, step, status >= 500 && code !== 'SEALING_KEY_MISSING' ? 'failed' : 'refused', { code, status, ms: now() - ctx.t0 });
    return reply(status, { ok: false, code, ...extra, trace: ctx.trace, detail: says(code) });
  };

  // R47, R55: the run's memory wiped: the key's bytes overwritten, the buffer, payload and bundle dropped.
  function wipe(r, state) {
    if (r.abort) r.abort.abort();
    if (r.key) r.key.fill(0);
    r.key = null; r.buffer = null; r.bundle = null; r.manifestBytes = null; r.prelim = null;
    if (r.window) clearTimeout(r.window);
    r.state = state;
    list.atRest();
  }

  /* ---------------------------------------------------------------- POST /run */
  function checkBody(body) {
    if (!isObj(body)) return ['BAD_REQUEST', 400];
    const d = body.declared;
    if (!isObj(d)) return ['BAD_RUN', 400];
    // R57, R58: the route is the deployment's, never the request's; `http` only for loopback, only on a machine.
    if (deployment !== 'machine' && d.route === 'machine') return ['BAD_RUN', 400];
    let host = String(d.host ?? '');
    let scheme = 'https';
    if (/^http:\/\//i.test(host)) {
      const h = hostOf(host);
      if (!(deployment === 'machine' && localEndpoint && LOOPBACK.includes(h))) return ['BAD_RUN', 400];
      scheme = 'http'; host = `https://${host.slice(7)}`;
    }
    if (deployment === 'machine' && !localEndpoint) return ['BAD_RUN', 400];
    const route = deployment === 'machine' ? 'machine' : (d.route ?? deployment);
    const checked = checkDeclared({ ...d, host, route }, { issuerHosts: [list.hosts[0]] });
    if (!checked.ok) return ['BAD_RUN', 400];
    if (!Array.isArray(body.tiers) || !body.tiers.length || !body.tiers.every((t) => RUN_TIERS.includes(t))) return ['BAD_RUN', 400];
    if (!Array.isArray(body.parts) || !body.parts.length || !body.parts.every((p) => PARTS.includes(p))) return ['BAD_RUN', 400];
    const c = body.ceiling;
    if (!isObj(c) || !positive(c.spend) || !positive(c.calls) || !positive(c.seconds)) return ['CEILING_REQUIRED', 400];
    const needsKey = !(deployment === 'machine' && body.key == null);
    if (needsKey && (typeof body.key !== 'string' || body.key === '' || body.key.length > KEY_CHARS_MAX)) return ['BAD_RUN', 400];
    if (deployment === 'civicsmith' && !sampleAccounts.includes(d.plan)) return ['NOT_A_SAMPLE_ACCOUNT', 403];
    return [null, null, { host: checked.host, scheme, route }];
  }

  async function postRun(ctx, text) {
    if (run && ['running', 'done', 'incomplete', 'approved'].includes(run.state)) return refuse(ctx, 'start', 409, 'RUN_IN_PROGRESS');
    let body;
    try { body = text.length > BODY_MAX ? undefined : JSON.parse(text); } catch { body = undefined; }
    const [code, status, ok] = checkBody(body);
    if (code) return refuse(ctx, 'start', status, code);
    if (!sealingKey) return refuse(ctx, 'start', 503, 'SEALING_KEY_MISSING');
    // R60: the image carries the public bank only; a bank item with an expected answer refuses the run.
    if (!Array.isArray(bank?.items) || bank.items.some(hasPrivate)) return refuse(ctx, 'start', 409, 'CHALLENGE_HAS_ANSWERS');

    // R47: the key as bytes in this one object; the request's copy is dropped.
    const key = typeof body.key === 'string' ? te.encode(body.key) : new Uint8Array(0);
    delete body.key;
    const d = body.declared;
    const declared = { provider: String(d.provider), host: ok.scheme === 'http' ? String(d.host) : ok.host, model: String(d.model),
      plan: String(d.plan), route: ok.route, scope_declared: String(d.scope_declared ?? ''), terms_page: d.terms_page ?? null,
      price: isObj(d.price) ? d.price : null };
    const id = randomUUID();
    const r = { id, ref: runRefOf(id), trace: ctx.trace, t0: ctx.t0, state: 'starting', key, declared, ceiling: { ...body.ceiling },
      estimate: body.estimate ?? null, tiersAsked: [...body.tiers], parts: [...body.parts], buffer: capture ? [] : null,
      prelim: [], usage: { calls: 0, spend: 0, spendReported: true, input: 0, output: 0, inputKnown: true, outputKnown: true },
      served: null, mismatches: 0, tier: null, items_done: 0, items_total: 0, incomplete_reason: null, tiersDone: [],
      manifestShown: false, approved: false };

    // R49: the run key pair and the challenge, before any provider call.
    const runKey = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    r.runKey = runKey;
    r.runPublic = await runPublicLine(runKey.publicKey);
    const versions = suiteVersions({ bank, image: imageDigest ?? 'unreleased' });
    r.versions = versions;
    const ask = { provider: declared.provider, plan: declared.plan, declared_model: declared.model, image_digest: imageDigest,
      bank_version: bank.version, run_public_key: r.runPublic };
    let res, answer;
    try {
      res = await door.fetch(new URL(CHALLENGE_PATH, issuerUrl).href, { method: 'POST',
        headers: { 'content-type': 'application/json', [TRACE_HEADER]: ctx.trace }, body: JSON.stringify(ask) });
      answer = await res.json().catch(() => null);
    } catch { res = null; }
    const cctx = { ...ctx, ref: r.ref };
    if (!res || res.status >= 500 || (res.status >= 300 && res.status < 400)) { key.fill(0); return refuse(cctx, 'challenge', 502, 'ISSUER_UNREACHABLE'); }
    if (res.status >= 400) {
      key.fill(0);
      const issuerCode = isObj(answer) && typeof answer.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(answer.code) ? answer.code : null;
      return refuse(cctx, 'challenge', 409, 'CHALLENGE_REFUSED', { issuer_code: issuerCode });
    }
    const v = verifyChallenge(answer, { bank_version: bank.version, at: new Date(now()).toISOString() });
    if (!v.ok) { key.fill(0); return refuse(cctx, 'challenge', 502, 'CHALLENGE_INVALID'); }
    r.challenge = { challenge_id: answer.challenge_id, nonce: answer.nonce, bank_version: answer.bank_version };
    const plan = planRun({ declared, tiers: r.tiersAsked, parts: r.parts, nonce: answer.nonce,
      selection_seed: v.selection_seed, bank, suiteVersions: versions });
    if (!plan.ok) { key.fill(0); return refuse(cctx, 'challenge', 400, 'BAD_RUN'); }
    line(cctx, 'challenge', 'ok', { status: 200, ms: now() - ctx.t0 });

    // R45: for the run, the issuer and the declared provider host, fixed until the run ends.
    list.forRun(hostOf(declared.host.startsWith('http') ? declared.host : `https://${declared.host}`));
    r.plan = plan;
    r.state = 'running';
    r.startedIso = new Date(now()).toISOString();
    r.startMs = now();
    r.abort = new AbortController();
    refusedCount = 0;
    run = r;
    line(cctx, 'start', 'ok', { status: 202, ms: now() - ctx.t0 });
    r.loop = execute(r).catch(() => { if (run === r && r.state === 'running') finish(r, 'failed'); });
    return reply(202, { ok: true, run: id, state: 'running' });
  }

  /* ---------------------------------------------------------------- the calls */
  async function execute(r) {
    const live = () => run === r && r.state === 'running';
    const price = r.declared.price;
    // R51: one call's high estimate, the run's high estimate over its planned calls; the meter caps each call's output
    // so its cost cannot pass it, and the manifest states it as the bound on the overshoot past `spend`.
    const planned = r.plan.tiers.reduce((a, t) => a + t.items.reduce((b, it) => b + it.repeats, 0), 0);
    r.callHigh = typeof r.estimate?.high === 'number' && Number.isFinite(r.estimate.high) && planned > 0 ? r.estimate.high / planned : null;
    for (const step of r.plan.tiers) {
      r.tier = step.tier;
      r.items_done = 0;
      r.items_total = step.items.reduce((a, it) => a + it.repeats, 0);
      for (const it of step.items) {
        const item = itemById(bank, it.item_id);
        for (let rep = 0; rep < it.repeats; rep++) {
          if (!live()) return;
          const elapsed = (now() - r.startMs) / 1000;
          const m = meter({ calls: r.usage.calls, seconds: elapsed,
            ...(r.usage.spendReported ? { spend_reported: r.usage.spend } : { spend_estimated: r.usage.spend }) },
          r.ceiling, { price, callHigh: r.callHigh });
          if (m.decision === 'stop') return endEarly(r, m.reason);
          const remainingMs = r.ceiling.seconds * 1000 - (now() - r.startMs);
          const timer = setTimeout(() => r.abort.abort(), Math.max(0, remainingMs));
          if (timer.unref) timer.unref();
          let out;
          try {
            out = await callModel({ door, declared: r.declared, item, repeat: rep, nonce: r.challenge.nonce,
              key: () => new TextDecoder().decode(r.key), maxOutput: m.next_max_output, signal: r.abort.signal, now });
          } finally { clearTimeout(timer); }
          if (!live()) return;
          r.usage.calls += 1;
          if (out.aborted) return endEarly(r, 'ceiling_time');
          if (r.buffer) r.buffer.push(out.record);
          const u = out.exchange.usage;
          if (u) {
            if (u.input_tokens === null) r.usage.inputKnown = false; else r.usage.input += u.input_tokens;
            if (u.output_tokens === null) r.usage.outputKnown = false; else r.usage.output += u.output_tokens;
          }
          if (typeof out.cost === 'number') r.usage.spend += out.cost;
          if (out.exchange.served) {
            r.served = out.exchange.served;
            if (out.exchange.served.model !== null && out.exchange.served.model !== r.declared.model) {
              r.mismatches += 1;
              r.prelim.push(scoreAnswerFree(item, out.exchange, []));
              r.items_done += 1;
              return endEarly(r, 'early_stop_identity');
            }
          }
          r.prelim.push(scoreAnswerFree(item, out.exchange, []));
          r.items_done += 1;
        }
      }
      r.tiersDone.push(step.tier);
      line(r, 'tier', 'ok', { status: 200, ms: now() - r.startMs, tier: step.tier, items_done: r.items_done, items_total: r.items_total });
    }
    return finish(r, null);
  }

  async function endEarly(r, reason) {
    line(r, 'ceiling', 'ok', { status: 200, ms: now() - r.startMs, incomplete_reason: reason });
    return finish(r, reason);
  }

  /* ---------------------------------------------------------------- R52, R53: scrub, scan, seal, sign */
  async function finish(r, reason) {
    if (run !== r || r.state !== 'running') return;
    const t0 = now();
    const endedIso = new Date(now()).toISOString();
    const keyText = new TextDecoder().decode(r.key ?? new Uint8Array(0));
    const secrets = keyText ? [keyText] : [];
    const decl = { provider: r.declared.provider, host: r.declared.host, model: r.declared.model, plan: r.declared.plan, route: r.declared.route };
    let payload = {
      calls: r.buffer ?? [],
      run: { image_digest: imageDigest, suiteVersions: { ...r.versions }, adapter_version: ADAPTER_VERSION, profile_version: null,
        subject: decl, challenge: { ...r.challenge }, estimate: r.estimate, ceiling: { ...r.ceiling },
        actual: { spend: r.usage.spend, calls: r.usage.calls, seconds: (now() - r.startMs) / 1000 },
        started_at: r.startedIso, ended_at: endedIso, region: null, early_stops: reason && reason !== 'failed' ? [reason] : [],
        refused_egress: refusedCount,
        usage_total: { input_tokens: r.usage.inputKnown ? r.usage.input : null, output_tokens: r.usage.outputKnown ? r.usage.output : null } },
      stub_logs: {},
      preliminary: { preliminary: true, items: r.prelim.filter((p) => p && p.ok) },
    };
    if (scrub) payload = scrubDeep(payload, secrets);
    const incomplete = reason !== null;
    const built = buildManifest({ payload, nonce: r.challenge.nonce, challenge_id: r.challenge.challenge_id,
      run_public_key: r.runPublic, sealed_to: sealingKey.key_id, started_at: r.startedIso, ended_at: endedIso,
      suiteVersions: r.versions, declared: decl, served: r.served, region: null,
      tiers: r.tiersAsked.map((t) => ({ tier: t, completed: r.tiersDone.includes(t) })),
      spend: { estimate: r.estimate, ceiling: r.ceiling.spend, actual: r.usage.spend },
      scope_declared: r.declared.scope_declared, terms_page: r.declared.terms_page, image_digest_declared: imageDigest,
      identity_mismatches: r.mismatches, incomplete_reason: incomplete ? reason : null, overshoot_bound: r.callHigh ?? null });
    const scan = built.ok ? scanForSecrets({ payload, manifest: built.manifest }, [...GENERIC_KEY_SHAPES], secrets) : null;
    if (!built.ok || !scan.clean) {
      r.incomplete_reason = 'secret_in_payload';
      r.secretHit = built.ok;
      payload = null;
      wipe(r, 'incomplete');
      run = r;
      line(r, 'seal', built.ok ? 'refused' : 'failed', { code: built.ok ? 'SECRET_IN_PAYLOAD' : built.code, status: 409, ms: now() - t0 });
      return;
    }
    const sealed = await sealPayload(payload, sealingKey);
    payload = null; r.buffer = null; r.prelim = null;  // R53: the plaintext is dropped once sealed
    if (!sealed.ok) { wipe(r, 'incomplete'); r.incomplete_reason = 'failed'; line(r, 'seal', 'failed', { code: sealed.code, status: 500, ms: now() - t0 }); return; }
    const signed = await signBundle(built.bytes, sealed.sha256, r.runKey);
    if (!signed.ok) { wipe(r, 'incomplete'); r.incomplete_reason = 'failed'; line(r, 'seal', 'failed', { code: signed.code, status: 500, ms: now() - t0 }); return; }
    r.manifestBytes = built.bytes;
    r.bundle = encodeBundle({ manifestBytes: built.bytes, signature: signed.signature, sealed: sealed.sealed });
    r.runKey = null;
    if (r.key) r.key.fill(0);
    r.key = null;
    list.atRest();
    r.state = incomplete ? 'incomplete' : 'done';
    r.incomplete_reason = incomplete ? reason : null;
    line(r, 'seal', 'ok', { status: 200, ms: now() - t0 });
    // R55: the review window; at its end the run is wiped and reads `expired`.
    r.window = setTimeout(() => { if (run === r) wipe(r, 'expired'); }, reviewWindowMs);
    if (r.window.unref) r.window.unref();
  }

  /* ---------------------------------------------------------------- the routes */
  const noRun = (ctx, step) => refuse(ctx, step, 409, 'NO_RUN');
  const hasRun = () => run && !['discarded', 'expired'].includes(run.state);

  async function handle({ method, path, headers = {}, text = async () => '' }) {
    const t0 = now();
    const ctx = { trace: safeTrace(headers[TRACE_HEADER]) || (run && hasRun() ? run.trace : null) || randomUUID(), ref: run?.ref ?? null, t0 };
    if (method === 'GET' && path === '/version') return reply(200, version());
    if (method === 'POST' && path === '/run') return postRun({ ...ctx, ref: null, trace: safeTrace(headers[TRACE_HEADER]) || randomUUID() }, await text());
    const routes = {
      'GET /run/status': () => {
        if (!run) return noRun(ctx, 'manifest');
        const body = { ok: true, state: run.state, tier: run.tier ?? null, items_done: run.items_done ?? 0, items_total: run.items_total ?? 0 };
        if (run.incomplete_reason) body.incomplete_reason = run.incomplete_reason;
        return reply(200, body);
      },
      'GET /run/manifest': () => {
        if (!hasRun()) return noRun(ctx, 'manifest');
        if (run.state === 'running') return refuse(ctx, 'manifest', 409, 'NO_MANIFEST_YET');
        if (!run.manifestBytes) return refuse(ctx, 'manifest', 409, 'SECRET_IN_PAYLOAD');
        run.manifestShown = true;
        line(ctx, 'manifest', 'ok', { status: 200, ms: now() - t0 });
        return { status: 200, body: run.manifestBytes, headers: { 'content-type': 'application/json' } };
      },
      'POST /run/approve': () => {
        if (!hasRun()) return noRun(ctx, 'approve');
        if (!run.manifestBytes && run.state !== 'running') return refuse(ctx, 'approve', 409, 'SECRET_IN_PAYLOAD');
        if (!run.manifestShown) return refuse(ctx, 'approve', 409, 'MANIFEST_NOT_SHOWN');
        run.approved = true; run.state = 'approved';
        line(ctx, 'approve', 'ok', { status: 200, ms: now() - t0 });
        return reply(200, { ok: true, state: 'approved' });
      },
      'GET /run/bundle': () => {
        if (!hasRun()) return noRun(ctx, 'bundle');
        if (!run.bundle && run.state !== 'running') return refuse(ctx, 'bundle', 409, 'SECRET_IN_PAYLOAD');
        if (!run.approved) return refuse(ctx, 'bundle', 409, 'MANIFEST_NOT_SHOWN');
        line(ctx, 'bundle', 'ok', { status: 200, ms: now() - t0 });
        return { status: 200, body: run.bundle, headers: { 'content-type': 'application/octet-stream' } };
      },
      'POST /run/discard': () => {
        if (!hasRun()) return noRun(ctx, 'discard');
        wipe(run, 'discarded');
        line(ctx, 'discard', 'ok', { status: 200, ms: now() - t0 });
        return reply(200, { ok: true, state: 'discarded' });
      },
    };
    const route = routes[`${method} ${path}`];
    if (route) return route();
    return reply(404, { ok: false, code: 'UNKNOWN' });
  }

  const version = () => versionBody({ deployment, imageDigest, capture, localEndpoint });

  return {
    handle,
    version,
    get egress() { return list.hosts; },
    get state() { return run ? run.state : null; },
    // Test hooks: what a run still holds in memory (R53, R55), and its loop's end.
    inspect() { return run ? { state: run.state, key: run.key, buffer: run.buffer, prelim: run.prelim, bundle: run.bundle } : null; },
    settled() { return run && run.loop ? run.loop : Promise.resolve(); },
  };
}
