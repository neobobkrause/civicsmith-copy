// The Workers runtime around the Worker bundle (R12), under Node: `cloudflare:workers` (through the loader), the
// globals the container library uses (`WebSocketPair`, `IdentityTransformStream`, a `Response` that carries
// `webSocket` and status 101), and a Durable Object `ctx` whose container's port is the real runner image's server,
// so every request the class passes on is answered by the image itself.
import * as nodeModule from 'node:module';

const STUB = new URL('./cloudflare-workers.mjs', import.meta.url).href;
if (nodeModule.registerHooks) {
  nodeModule.registerHooks({ resolve: (specifier, context, next) =>
    (specifier === 'cloudflare:workers' ? { url: STUB, shortCircuit: true } : next(specifier, context)) });
} else {
  nodeModule.register(new URL('./loader.mjs', import.meta.url));
}

const NodeResponse = globalThis.Response;
class WorkersResponse extends NodeResponse {
  constructor(body, init = {}) {
    const status = init && init.status;
    super(body, status === 101 ? { ...init, status: 200 } : init);
    if (status === 101) Object.defineProperty(this, 'status', { value: 101 });
    this.webSocket = (init && init.webSocket) ?? null;
  }
}

// A runtime WebSocket end: accept(), send(), close(), addEventListener(); its peer receives what it sends.
function end() {
  const listeners = { message: [], close: [], error: [] };
  const e = {
    peer: null, closed: false, sent: [],
    accept() {},
    addEventListener(type, f) { (listeners[type] ||= []).push(f); },
    emit(type, ev) { for (const f of listeners[type] || []) f(ev); },
    send(data) { if (e.closed) throw new Error('closed'); e.sent.push(data); queueMicrotask(() => e.peer.emit('message', { data })); },
    close(code = 1000, reason = '') {
      if (e.closed) return;
      e.closed = true;
      queueMicrotask(() => { e.peer.closed = true; e.peer.emit('close', { code, reason }); });
    },
  };
  return e;
}
class WebSocketPair {
  constructor() { const a = end(), b = end(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; }
}

export function installRuntime() {
  const saved = { Response: globalThis.Response, WebSocketPair: globalThis.WebSocketPair,
    IdentityTransformStream: globalThis.IdentityTransformStream };
  globalThis.Response = WorkersResponse;
  globalThis.WebSocketPair = WebSocketPair;
  globalThis.IdentityTransformStream = TransformStream;
  return () => Object.assign(globalThis, saved);
}

export const loadWorker = () => import('../../dist/agent-runner.bundled.mjs');

// A Node WebSocket to the image, seen as the runtime's: what the container's port answers an upgrade with.
function imageSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onerror = () => reject(new Error('the image refused the connection'));
    ws.onopen = () => resolve({
      accept() {},
      addEventListener: (type, f) => ws.addEventListener(type, f),
      send: (d) => ws.send(d),
      close: (code, reason) => ws.close(code === 1005 || code === 1006 ? 1000 : code, reason),
    });
  });
}

// The Durable Object state: storage in memory, and a container whose port `port` is the runner at `base`.
export function fakeCtx(base) {
  const store = new Map(), kv = new Map();
  let running = false;
  const seen = { starts: [], requests: [], intercepts: [] };
  const ctx = {
    seen,
    id: { toString: () => 'agent-runner-test-instance' },
    storage: {
      get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async (k) => store.delete(k),
      kv: { get: (k) => kv.get(k), put: (k, v) => kv.set(k, v), delete: (k) => kv.delete(k) },
      setAlarm: async () => {}, getAlarm: async () => null, deleteAlarm: async () => {}, sync: async () => {},
      sql: { exec: () => [] },
    },
    blockConcurrencyWhile: async (f) => f(), waitUntil: () => {}, abort: () => {},
    exports: { ContainerProxy: (init) => ({ init }) },
    container: {
      get running() { return running; },
      start(config) { seen.starts.push(config); running = true; },
      monitor: () => new Promise(() => {}),
      getTcpPort: (port) => ({
        fetch: async (url, request) => {
          if (!(request instanceof Request)) {               // the library's readiness probe
            const r = await fetch(`http://${base}/version`); await r.arrayBuffer();
            return new WorkersResponse(null, { status: 200 });
          }
          seen.requests.push({ port, url, request });
          const u = new URL(url);
          if (/\bwebsocket\b/i.test(request.headers.get('upgrade') || '')) {
            const ws = await imageSocket(`ws://${base}${u.pathname}${u.search}`).catch(() => null);
            if (!ws) return new WorkersResponse('{"ok":false,"code":"UNKNOWN"}', { status: 404 });
            return new WorkersResponse(null, { status: 101, webSocket: ws });
          }
          const r = await fetch(`http://${base}${u.pathname}${u.search}`,
            { method: request.method, headers: request.headers, body: request.body, duplex: 'half' });
          return new WorkersResponse(await r.arrayBuffer(), { status: r.status, headers: r.headers });
        },
      }),
      interceptOutboundHttp: async (host, f) => { seen.intercepts.push({ scheme: 'http', host, props: f.init.props }); },
      interceptOutboundHttps: async (host, f) => { seen.intercepts.push({ scheme: 'https', host, props: f.init.props }); },
      interceptAllOutboundHttp: async (f) => { seen.intercepts.push({ scheme: 'http', host: '*', props: f.init.props }); },
      destroy: async () => { running = false; }, signal() {},
    },
  };
  return ctx;
}

// A conversation through the class: the caller's side of the WebSocket the binding answers with.
export async function conversationThrough(runner, req, onRelay = () => ({ content: 'ok' })) {
  const res = await runner.fetch(new Request('https://agent-runner/conversation', { headers: { Upgrade: 'websocket' } }));
  const ws = res.webSocket;
  if (!ws) return { status: res.status, frames: [], final: undefined };
  return new Promise((resolve, reject) => {
    const frames = [];
    ws.accept();
    ws.addEventListener('message', async (ev) => {
      const f = JSON.parse(ev.data);
      frames.push(f);
      if (f.tool_use) ws.send(JSON.stringify({ tool_result: { id: f.tool_use.id, ...(await onRelay(f.tool_use)) } }));
    });
    ws.addEventListener('close', (ev) => resolve({ status: res.status, frames, code: ev.code, final: frames.find((f) => 'ok' in f) }));
    ws.send(typeof req === 'string' ? req : JSON.stringify(req));
    setTimeout(() => reject(new Error('conversation timed out')), 5000);
  });
}
