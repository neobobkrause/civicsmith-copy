// The Worker that hosts the container (R12, R13): the Container Durable Object class `AgentRunner`. Each instance runs
// this module's image and passes every request it receives to the image's one port unchanged, so R5, R6 and R43 answer
// exactly as the image answers them. It adds no route, answer or tool of its own and holds no credential (R8): the
// image's environment is replaced whole by three configuration values, none a secret. Its exceptions:
// - R15's default export, answering 404 UNKNOWN to anything reaching the Worker other than through the class;
// - R26's JSON 503 RUNNER_NOT_STARTED when the library cannot start the container or reach its port;
// - R45's platform list: the issuer alone at rest, and for a run the issuer and the declared provider host, read from
//   the run request's `declared.host` before it is passed on (the body itself is passed on unread and unchanged);
// - R55's hold: the container stays awake through a run and its review window, with a closed marker in storage;
// - R30's lines, one per lifecycle event and per egress request, and R34's per refused request.
import { DurableObject } from 'cloudflare:workers';
import { Container, ContainerProxy } from '@cloudflare/containers';
import member from '../fleet-member.json' with { type: 'json' };
import { CATALOGUE_ADDRESS } from '../../bio-plane/src/ai-catalogue/index.mjs';
import { REVIEW_WINDOW_MS, TRACE_HEADER, RUN_REF_HEX, DEPLOYMENTS, DEFAULT_DEPLOYMENT } from './params.mjs';
import { pathTemplate, hostOf, platformHost } from './door.mjs';
import { says } from './says.mjs';

const ISSUER_HOST = new URL(CATALOGUE_ADDRESS).hostname;
const UNKNOWN = JSON.stringify({ ok: false, code: 'UNKNOWN' });
// R55: the one key of the class's own storage, the closed marker `{run_ref, deadline, state}`.
const MARKER_KEY = 'run';
const REFUSED_WORDS = 'Origin is disallowed';

const log = (line) => console.log(JSON.stringify(line));
// The first 12 hex characters of the Durable Object id (R30).
const instanceRef = (id) => String(id ?? '').replace(/[^0-9a-f]/gi, '').slice(0, 12).toLowerCase();
const traceOf = (request) => { const v = request.headers.get(TRACE_HEADER); return v && /^[A-Za-z0-9._:-]{1,128}$/.test(v) ? v : crypto.randomUUID(); };
const sha256Ref = async (id) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(id))))]
  .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, RUN_REF_HEX);
const isJson = (res) => /^application\/json\b/i.test(res.headers.get('content-type') || '');

// R30: every request the platform lets out (the allow-list gates first, R45) is passed to `fetch` unchanged and logged
// with its host, method, path template and status, never its query, headers or body.
async function egressLogged(request, env, ctx) {
  const t0 = Date.now();
  const line = { event: 'runner.egress', instance_ref: instanceRef(ctx && ctx.containerId), host: hostOf(request.url),
    method: request.method, path_template: pathTemplate(request.url) };
  try {
    const res = await fetch(request);
    log({ ...line, status: res.status, ms: Date.now() - t0 });
    return res;
  } catch (e) {
    log({ ...line, status: null, ms: Date.now() - t0 });
    throw e;
  }
}

// R34: the library's refusal of a host off the list (520 "Origin is disallowed") is returned unchanged, with one line.
class RefusalLoggingProxy extends ContainerProxy {
  async fetch(request) {
    const res = await super.fetch(request);
    try {
      if (res.status === 520 && (await res.clone().text()) === REFUSED_WORDS) {
        const props = (this.ctx && this.ctx.props) || {};
        log({ event: 'runner.egress.refused', instance_ref: instanceRef(props.containerId), host: hostOf(request.url),
          method: request.method, path_template: pathTemplate(request.url), status: 520 });
      }
    } catch { /* a log line never changes the answer */ }
    return res;
  }
}
export { RefusalLoggingProxy as ContainerProxy };

export class AgentRunner extends Container {
  defaultPort = member.image.port;
  sleepAfter = '2m';
  enableInternet = false;
  interceptHttps = true;
  allowedHosts = [ISSUER_HOST];
  static { this.outbound = egressLogged; }
  static MARKER_KEY = MARKER_KEY;

  constructor(ctx, env) {
    super(ctx, env);
    // R8, R57: the image's whole environment; the deployment is the configuration's, never a request's.
    const e = env || {};
    this.envVars = {
      DEPLOYMENT: DEPLOYMENTS.includes(e.DEPLOYMENT) ? e.DEPLOYMENT : DEFAULT_DEPLOYMENT,
      SAMPLE_ACCOUNTS: typeof e.SAMPLE_ACCOUNTS === 'string' ? e.SAMPLE_ACCOUNTS : '',
      IMAGE_DIGEST: typeof member.image.digest === 'string' ? member.image.digest : '',
    };
  }

  now() { return Date.now(); }
  get instanceRef() { return instanceRef(this.ctx.id); }
  async marker() { try { return (await this.ctx.storage.get(MARKER_KEY)) ?? null; } catch { return null; } }
  async held(m) {
    m = m === undefined ? await this.marker() : m;
    if (!m) return false;
    if (m.state === 'running') return true;
    return ['done', 'incomplete', 'approved'].includes(m.state) && typeof m.deadline === 'number' && this.now() < m.deadline;
  }
  async lifecycle(what, extra = {}) {
    log({ event: 'runner.lifecycle', instance_ref: this.instanceRef, what, ...extra, run_hold: await this.held().catch(() => false) });
  }

  // Every request to the image's one port; a caller cannot pick another.
  async fetch(request) {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    if (route !== 'POST /run') return this.forward(request, route);
    // R45, R55: one run start at a time, to its answer and marker, so a second request cannot change the list it set.
    const turn = (this.runStarts ?? Promise.resolve()).then(() => this.startRun(request));
    this.runStarts = turn.catch(() => {});
    return turn;
  }

  // R45: the platform list is widened only for a host that passes the check, and never while a run holds the instance.
  async startRun(request) {
    const widened = !(await this.held()) && await this.allowFor(request);
    const res = await this.forward(request, 'POST /run');
    if (widened && res.status !== 202) await this.setAllowedHosts([ISSUER_HOST]);
    return res;
  }

  async forward(request, route) {
    let res;
    try { res = await this.containerFetch(request, this.defaultPort); }
    catch { res = new Response('the container could not be reached', { status: 500 }); }
    const bytes = route === 'GET /run/bundle' && res.status === 200 && /^application\/octet-stream\b/i.test(res.headers.get('content-type') || '');
    if (!isJson(res) && !bytes) {
      await res.arrayBuffer().catch(() => {});
      return new Response(JSON.stringify({ ok: false, code: 'RUNNER_NOT_STARTED', status: res.status, trace: traceOf(request),
        detail: says('RUNNER_NOT_STARTED') }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    if (isJson(res)) await this.observe(route, res);
    return res;
  }

  // R45: the platform's list for the run, only for a declared host that passes `platformHost` (a public DNS name over
  // https, not the issuer); the image checks it again in full. Only `declared.host` is read; the request goes on unchanged.
  async allowFor(request) {
    let host = null;
    try { host = platformHost(JSON.parse(await request.clone().text())?.declared?.host, ISSUER_HOST); } catch { /* not JSON */ }
    if (!host) return false;
    await this.setAllowedHosts([ISSUER_HOST, host]);
    return true;
  }

  // R55: the marker, from the image's answers' status and closed fields alone.
  async observe(route, res) {
    let body = null;
    try { body = await res.clone().json(); } catch { return; }
    const m = await this.marker();
    if (route === 'POST /run') {
      if (res.status === 202 && body && typeof body.run === 'string')
        await this.ctx.storage.put(MARKER_KEY, { run_ref: await sha256Ref(body.run), deadline: null, state: 'running' });
      return;
    }
    if (!m) return;
    if (route === 'POST /run/discard' && res.status === 200) {
      await this.ctx.storage.put(MARKER_KEY, { ...m, state: 'discarded', deadline: null });
      await this.setAllowedHosts([ISSUER_HOST]);
      await this.stop();
      return;
    }
    if (route === 'GET /run/status' && res.status === 200 && body) await this.track(m, body.state);
    if (res.status === 409 && body && body.code === 'NO_RUN' && m.state === 'running') await this.track(m, 'expired');
  }

  async track(m, state) {
    if (['done', 'incomplete', 'approved'].includes(state)) {
      const deadline = typeof m.deadline === 'number' ? m.deadline : this.now() + REVIEW_WINDOW_MS;
      await this.ctx.storage.put(MARKER_KEY, { ...m, state, deadline });
      await this.setAllowedHosts([ISSUER_HOST]);
    } else if (['discarded', 'expired'].includes(state)) {
      await this.ctx.storage.put(MARKER_KEY, { ...m, state, deadline: null });
      await this.setAllowedHosts([ISSUER_HOST]);
    }
  }

  // R55: the sleep timer never ends a run or its review window; past the window the run is expired and the container stops.
  async onActivityExpired() {
    let m = await this.marker();
    if (m && m.state === 'running') {
      try {
        const res = await this.containerFetch(new Request('http://container/run/status'), this.defaultPort);
        if (isJson(res)) { const b = await res.json(); if (res.status === 200) await this.track(m, b.state); else if (b.code === 'NO_RUN') await this.track(m, 'expired'); }
      } catch { /* the run is still held */ }
      m = await this.marker();
    }
    if (await this.held(m)) {
      await this.lifecycle('held_awake');
      this.renewActivityTimeout();
      return;
    }
    if (m && ['running', 'done', 'incomplete', 'approved'].includes(m.state))
      await this.ctx.storage.put(MARKER_KEY, { ...m, state: 'expired', deadline: null });
    await this.lifecycle('activity_expired');
    return super.onActivityExpired();
  }

  // R30: the lifecycle, one line each.
  async startAndWaitForPorts(...args) {
    this.startedAt = Date.now();
    await this.lifecycle('start');
    return super.startAndWaitForPorts(...args);
  }
  async onStart() {
    await this.lifecycle('started', this.startedAt ? { ms: Date.now() - this.startedAt } : {});
    return super.onStart();
  }
  async onStop(params) {
    // R55: a run lost to a platform stop reads `expired` in its marker; nothing of it was persisted.
    const m = await this.marker();
    if (m && ['running', 'done', 'incomplete', 'approved'].includes(m.state))
      await this.ctx.storage.put(MARKER_KEY, { ...m, state: 'expired', deadline: null });
    await this.lifecycle('stop');
    return super.onStop(params);
  }
  async onError(error) {
    const head = String(error && error.message ? error.message : error).replace(/[?#]\S*/g, '').replace(/[A-Za-z0-9._-]{32,}/g, '[redacted]').slice(0, 120);
    await this.lifecycle('error', { error_head: head });
    throw error;
  }
}

// R42 (retired) / R13: the `RemoteSession` stub stays exported while `agent-worker`'s `REMOTE` binding still names it
// (agent-worker/wrangler.jsonc), so the fleet's bundles keep every bound class (bundler R39). It answers every request
// 503 REMOTE_UNAVAILABLE and holds no state. It and its migration go in the change that removes `REMOTE` (agent-worker PR 364).
export class RemoteSession extends DurableObject {
  async fetch() {
    return new Response(JSON.stringify({ ok: false, code: 'REMOTE_UNAVAILABLE' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
}

// R15: the module's default export, so wrangler deploys the class and its container. It holds no state.
export default {
  fetch() {
    return new Response(UNKNOWN, { status: 404, headers: { 'content-type': 'application/json' } });
  },
};
