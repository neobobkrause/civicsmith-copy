/* control-plane R130, R135: THE PLANE THE JOB-ROW TESTS DRIVE. The Worker the product deploys (its source read as Miniflare's script, as `t51-reading-follows.test.mjs` reads it), its
   object, its alarm and R2 under Miniflare, the network scripted by file name; `script` replaces the entry with one that wraps the same plane (a fault entry). The founder and members
   are made by the plane's own acts (`claim`, `memberadd`, `enroll`, `login`), never by a hand-written answer. The caller disposes `mf`. */
import "../../sandbox.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";

const HERE = dirname(fileURLToPath(import.meta.url));
/** @type {string} the plane's entry, as the product deploys it */
export const PLANE_ENTRY = join(HERE, "../../../src/plane/index.mjs");
/** @type {number} one mebibyte */
export const MB = 1024 * 1024;
/** @type {(a: any) => any} an answer's `result`, else the answer */
export const body = (a) => (a && a.result !== undefined ? a.result : a);
/** @type {(b: Uint8Array) => string} the whole digest */
export const sha = (b) => createHash("sha256").update(b).digest("hex");
/** @type {(t: string) => Uint8Array} */
export const te = (t) => new TextEncoder().encode(t);
const later = (ms) => new Promise((r) => setTimeout(r, ms));

/** A PDF of `bytes` bytes whose one page of text says `words`, filled out by a stream no page names (letters only, so no `endstream` falls in it). */
export function pdfOf(words, bytes) {
  const pad = new Uint8Array(Math.max(0, bytes - 1500));
  let x = 0x9e3779b9;
  for (let i = 0; i < pad.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; pad[i] = 0x41 + ((x >>> 24) % 26); }
  const stream = (n, dict, data) => [te(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`), data, te("\nendstream\nendobj\n")];
  const plain = (n, b) => [te(`${n} 0 obj\n${b}\nendobj\n`)];
  const toUni = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";
  const parts = [te("%PDF-1.7\n"), ...plain(1, "<< /Type /Catalog /Pages 2 0 R >>"), ...plain(2, "<< /Type /Pages /Kids [100 0 R] /Count 1 >>"),
    ...plain(10, `<< /Type /Font /Subtype /TrueType /BaseFont /Plain /FirstChar 32 /Widths [${Array(95).fill(500).join(" ")}] /ToUnicode 11 0 R >>`), ...stream(11, "", te(toUni)),
    ...plain(100, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 10 0 R >> >> /Contents 101 0 R >>"),
    ...stream(101, "", te(`BT /F1 12 Tf 72 700 Td (${words}) Tj ET`)), ...stream(500, "", pad), te("trailer\n<< /Root 1 0 R >>\n%%EOF\n")];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/**
 * The plane under Miniflare, with the acts these tests press.
 * @param {{tag: string, script?: string | null}} options `script`: an entry that wraps the plane (it imports `PLANE_ENTRY` by its path)
 */
export function rowsPlane({ tag, script = null }) {
  const ADM = `adm-${tag}-0123456789abcdef`, PASSWORD = `the founder's long password, ${tag}`, ORIGIN = "https://group.example";
  const upstream = new Map();
  let mf = null;
  mf = new Miniflare({
    modules: true, modulesRoot: "/",
    ...(script ? { script, scriptPath: join(HERE, `${tag}-entry.worker.mjs`) } : { scriptPath: PLANE_ENTRY, script: readFileSync(PLANE_ENTRY, "utf8") }),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: `mem-${tag}-0123456789abcdef`, PROBE_TOKEN: `prb-${tag}-0123456789abcdef`, DAEMON_TOKEN: `dmn-${tag}-0123456789abcdef`,
                VERSION: "4.8.0", INSTANCE_NAME: `${tag}-town`, KNOCK_FINGERPRINT_KEY: `knock-${tag}`, GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
    serviceBindings: { SELF: (req) => mf.dispatchFetch(req) },
    outboundService: (req) => {
      const f = upstream.get(new URL(req.url).pathname.split("/").pop());
      return f ? new Response(f.bytes, { headers: { "content-type": f.type, "content-length": String(f.bytes.length) } }) : new Response("not scripted", { status: 404 });
    },
  });
  const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);
  const serve = (name, bytes, type = "application/pdf") => upstream.set(name, { bytes, type });
  const get = async (auth, query) => (await plane(`/api/?${new URLSearchParams(query)}`, { headers: auth })).json();
  const post = async (auth, op, payload) => (await plane(`/api/?op=${op}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(payload) })).json();
  const login = async (handle, password) => {
    const signed = await post({}, "login", { handle, password, device: "own" });
    assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
    return { authorization: `Bearer ${signed.result.token}` };
  };
  let founderOnce = null;
  async function founder() {
    if (founderOnce) return founderOnce;
    await (await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
    return (founderOnce = await login("admin", PASSWORD));
  }
  /* a member as the screens make one: the founder invites, the person enrols with the invitation and signs in */
  async function member(handle) {
    const added = await post(await founder(), "memberadd", { memberId: handle, cover: `cover of ${handle}`, role: "member", capabilities: null });
    const invite = added.result && (added.result.invite || (added.result.invitation && added.result.invitation.invite));
    assert.ok(invite, "an invitation: " + JSON.stringify(added).slice(0, 300));
    const password = `${handle}-long-passphrase-rows`;
    const enrolled = await post({}, "enroll", { invite, handle, password });
    assert.equal(enrolled.ok, true, "enrolled: " + JSON.stringify(enrolled).slice(0, 300));
    return login(handle, password);
  }
  const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => sha(te(s)),
    call: async (op, { query = {}, body: b } = {}) => (await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: b === undefined ? "GET" : "POST",
      headers: { ...auth, "content-type": "application/json" }, ...(b === undefined ? {} : { body: JSON.stringify(b) }) })).json() });
  /* a project made as the screens make one: its bundle promoted by the member */
  async function projectOf(auth, title) {
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const made = await screenCall(auth).call("promote", { body: { base: null, snapKey: iso.replace(/[-:]/g, "") + "_00c0ffee", meta: { object_type: "project", title, current_state: "forming", created: iso, last_updated: iso },
      files: [{ path: "bundle.md", text: `---\nobject_type: project\ntitle: "${title}"\nobjective: "${title}"\ncurrent_state: forming\ncreated: "${iso}"\nlast_updated: "${iso}"\n---\n\n## Session Log\n\n### Session ${iso} | Formation | interactive\nTrigger: the test\nChanges: created.\n` }], register: [], visibility: "hidden" } });
    const id = (made.result && made.result.bundleId) || made.bundleId;
    assert.ok(id, "the project is made: " + JSON.stringify(made).slice(0, 300));
    return id;
  }
  const acquire = async (auth, payload) => {
    const res = await plane("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(payload) });
    return { status: res.status, body: await res.json() };
  };
  const upload = async (auth, bytes, name, type) => body(await (await plane(`/api/?op=captureupload&statement=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    { method: "POST", headers: auth, body: bytes })).json());
  async function until(fn, ms, every = 3000) {
    const end = Date.now() + ms;
    let v = await fn();
    while (Date.now() < end && !v) { await later(every); v = await fn(); }
    return v;
  }
  return { mf, plane, serve, get, post, founder, member, screenCall, projectOf, acquire, upload, until };
}
