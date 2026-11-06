// R52: scrub a secret from every string of a value, in the forms R47 names (as is, percent-encoded, and base64 and
// base64url at each of the three byte alignments), before `ai-gate` `scanForSecrets` looks at the whole payload.
const te = new TextEncoder();
const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
export const SCRUBBED = '[scrubbed]';

export function secretForms(secret) {
  const forms = [secret, encodeURIComponent(secret)];
  const bytes = te.encode(secret);
  for (let k = 0; k < 3; k++) {
    const pad = new Uint8Array(k + bytes.length); pad.set(bytes, k);
    const enc = b64(pad);
    const start = Math.ceil((k * 4) / 3) + (k ? 1 : 0);
    const end = enc.replace(/=+$/, '').length - ((bytes.length + k) % 3 ? 1 : 0);
    const core = enc.slice(start, end);
    if (core.length >= 8) { forms.push(core); forms.push(core.replace(/\+/g, '-').replace(/\//g, '_')); }
  }
  return [...new Set(forms)].sort((a, b) => b.length - a.length);
}

export function scrubText(text, secrets) {
  let out = String(text);
  for (const s of secrets) {
    if (typeof s !== 'string' || s.length < 4) continue;
    for (const f of secretForms(s)) out = out.split(f).join(SCRUBBED);
  }
  return out;
}

// A deep copy of `value` with every string (keys included) scrubbed.
export function scrubDeep(value, secrets) {
  if (typeof value === 'string') return scrubText(value, secrets);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, secrets));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[scrubText(k, secrets)] = scrubDeep(v, secrets);
    return o;
  }
  return value;
}
