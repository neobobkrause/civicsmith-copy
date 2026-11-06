// One model call of a run, through the door (R46): an OpenAI-compatible chat completion at the declared host, the key
// handed in for this call only (R47) and sent as the `Authorization` header, never kept here. It answers the exchange
// the scorer reads and, apart, the raw record the capture mode keeps (R48).
//
// This is the image's stand-in for `agent-model`'s adapters and credential resolver for a declared plan (`agent-model`
// R2, BR16; `ai-gate` R8). Since PR 395 they are on tranche (`agent-model/src/provider`, `makeProvider`); routing a run's
// calls through them, and deleting this file, is R47's and R50's next attempt.
import { CAPTURED_HEADERS, isObj } from './params.mjs';
import { hostOf } from './door.mjs';

const nowIso = (now) => new Date(now()).toISOString();

export function endpointOf(declared) {
  const h = String(declared.host).trim();
  const base = /^[a-z]+:\/\//i.test(h) ? h.replace(/\/+$/, '') : `https://${h.replace(/\/+$/, '')}`;
  return `${base}/v1/chat/completions`;
}

export function keptHeaders(headers) {
  const out = {};
  for (const [k, v] of headers) if (CAPTURED_HEADERS.test(k.toLowerCase())) out[k.toLowerCase()] = v;
  return out;
}

// The item as the model is shown it: its public, synthetic fixture only (the bank's public part, R60).
function messagesOf(item) {
  return [
    { role: 'system', content: `Civicsmith gate item ${item.id} (${item.content_kind}). Answer from the record only.` },
    { role: 'user', content: JSON.stringify({ item: item.id, group: item.group, fixture: item.fixture ?? null }) },
  ];
}

const errorClassOf = (status) => (status === 429 ? 'rate_limit' : status === 529 || status === 503 ? 'overload'
  : status >= 300 && status < 400 ? 'malformed' : status >= 400 ? 'malformed' : null);

/** One call. `key()` answers the key's text for this call; `signal` ends it at the time ceiling. Never throws. */
export async function callModel({ door, declared, item, repeat, nonce, key, maxOutput = null, signal, now = Date.now }) {
  const url = endpointOf(declared);
  const body = { model: declared.model, messages: messagesOf(item), ...(maxOutput ? { max_tokens: maxOutput } : {}) };
  const sent = nowIso(now);
  const record = { request: body, response: null, status: null, headers: {}, timings: { sent, first_byte: sent, last_byte: sent },
    usage: null, outcome: 'failed', error_class: null, item_id: item.id, repeat, nonce, request_id: null };
  const exchange = { served: null, usage: null, stated_usage: [], stop_reason: null, output: null, calls: [], reports: [], error_class: null };
  const fail = (cls) => { record.error_class = cls; exchange.error_class = cls; return { exchange, record, refusedHost: null }; };
  let res;
  try {
    res = await door.fetch(url, { method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` }, body: JSON.stringify(body) });
  } catch (e) {
    if (e && e.code === 'EGRESS_REFUSED') return { ...fail('malformed'), refusedHost: e.host };
    if (signal && signal.aborted) return { ...fail('timeout'), aborted: true };
    return fail('overload');
  }
  record.timings.first_byte = nowIso(now);
  record.status = res.status;
  record.headers = keptHeaders(res.headers);
  record.request_id = record.headers['x-request-id'] ?? record.headers['request-id'] ?? null;
  // A redirect is never followed: its Location host is checked against the run's list and nothing is sent (R45).
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    await res.arrayBuffer().catch(() => {});
    record.timings.last_byte = nowIso(now);
    let target = null;
    try { target = loc ? new URL(loc, url).href : null; } catch { /* an unreadable Location is followed nowhere */ }
    if (target && !door.check(target, 'POST')) return { ...fail('malformed'), refusedHost: hostOf(target) };
    return fail('malformed');
  }
  let text;
  try { text = await res.text(); } catch { return fail(signal && signal.aborted ? 'timeout' : 'malformed'); }
  record.timings.last_byte = nowIso(now);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* kept as text */ }
  record.response = parsed ?? text;
  const cls = errorClassOf(res.status);
  if (cls) return fail(cls);
  if (!isObj(parsed)) return fail('malformed');
  const u = isObj(parsed.usage) ? parsed.usage : {};
  const usage = { input_tokens: Number.isFinite(u.prompt_tokens) ? u.prompt_tokens : null,
    output_tokens: Number.isFinite(u.completion_tokens) ? u.completion_tokens : null };
  const cost = typeof u.cost === 'number' && Number.isFinite(u.cost) ? u.cost : null;
  const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
  exchange.served = { provider: declared.provider, host: new URL(url).hostname, model: parsed.model ?? null };
  exchange.usage = usage;
  exchange.stated_usage = Object.keys(usage).filter((f) => usage[f] !== null);
  exchange.stop_reason = choice?.finish_reason === 'content_filter' ? 'filtered' : choice?.finish_reason ?? null;
  exchange.output = { text: String(choice?.message?.content ?? '') };
  record.usage = { normalised: usage, cost };
  record.outcome = 'ok';
  return { exchange, record, refusedHost: null, cost };
}
