/* control-plane R105, R123 (fix round 7, G58, G59, G60, G61, G62, G63, G64, G66, G74, G75, G79; K4736; R-SEAM, R-STOP, R-CLOCK): THE WALKER'S CASES THROUGH THE REAL PLANE. The Worker the
   product deploys, its object, its alarm and R2 under Miniflare, as `t51-round6-seam.test.mjs` runs them; every case is a member's own act through the door and ends at the
   record's own reads. Inputs are made by the acts, never by a hand-written answer shape. R-CLOCK: the times asserted are the test's own, taken outside the object.
     G58  the founder's `op=owedwork` (with and without `sha`) carries the five watchdog fields; a member's carries none; an enrolled administrator's carries them;
     G60  a case whose cited document holds a finding the case gate sees at signing is refused `GATE_REFUSED` with its findings, and the ceremony draws them;
     G61  a member's Queue after a finished ingest, and after a finished large fetch, answers 200 and holds the notice; the administrator's holds neither;
     G64  a tab-delimited source declared as a table has the declared columns and the data rows only;
     G63  `moneyingest` over 10,000 rows answers `ingesting` quickly, after a restart too, beside a trivial member act (the floor).
   Red by name until the providers have merged: G58 (plane's `administers`), G61 (queue's catalogue), G64 (calculations' delimiter), G63 (calculations' started path). */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { PARTS } from "../../../src/screens-publish/parts.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import "./register-declared.mjs";
import * as CE from "../screens-publish/fixtures.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const MB = 1024 * 1024;
const ADM = "adm-r7seam-0123456789abcdef", PASSWORD = "the founder's long password, round seven", ORIGIN = "https://group.example";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const later = (ms) => new Promise((r) => setTimeout(r, ms));
const te = (t) => new TextEncoder().encode(t);

/* the network: a file by its last path segment, served at once or throttled, with its Content-Length or without */
const upstream = new Map();
function serve(name, bytes, { rate = null, length = true, type = "application/pdf" } = {}) { upstream.set(name, { bytes, rate, length, type }); }
function slowBody(bytes, rate) {
  const chunk = 64 * 1024;
  let at = 0;
  return new ReadableStream({
    async pull(c) {
      if (at >= bytes.length) { c.close(); return; }
      const end = Math.min(at + chunk, bytes.length);
      c.enqueue(bytes.subarray(at, end));
      at = end;
      await later((chunk / rate) * 1000);
    },
  }, new CountQueuingStrategy({ highWaterMark: 0 }));
}
const OPTIONS = {
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-r7seam-0123456789abcdef", PROBE_TOKEN: "prb-r7seam-0123456789abcdef", VERSION: "4.7.6",
              INSTANCE_NAME: "r7seam-town", GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
  outboundService: (req) => {
    const name = new URL(req.url).pathname.split("/").pop();
    const f = upstream.get(name);
    if (!f) return new Response("not scripted", { status: 404 });
    const headers = { "content-type": f.type, ...(f.length ? { "content-length": String(f.bytes.length) } : {}) };
    return new Response(f.rate ? slowBody(f.bytes, f.rate) : f.bytes, { headers });
  },
};
const mf = new Miniflare(OPTIONS);
after(() => mf.dispose());
const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

let founderOnce = null;
async function founder() {
  if (founderOnce) return founderOnce;
  await (await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return (founderOnce = { authorization: `Bearer ${signed.result.token}` });
}
/* a member made as the screens make one: the founder invites (`memberadd`), the person enrols with the invitation, then signs in */
const people = new Map();
async function person(handle, role = "member", capabilities = null) {
  if (people.has(handle)) return people.get(handle);
  const adm = await founder();
  /* making an administrator is "changing administrators", which asks for the password again (C-29.42): the founder
     gives it first, as the screens do (`reauth`) */
  if (role === "admin") {
    const ra = await (await plane("/api/?op=reauth", { method: "POST", headers: { ...adm, "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) })).json();
    assert.equal(ra.ok, true, "the founder's password again: " + JSON.stringify(ra).slice(0, 300));
  }
  const added = await (await plane("/api/?op=memberadd", { method: "POST", headers: { ...adm, "content-type": "application/json" },
    body: JSON.stringify({ memberId: handle, cover: `cover of ${handle}`, role, capabilities }) })).json();
  const invite = added.result && (added.result.invite || (added.result.invitation && added.result.invitation.invite));
  assert.ok(invite, "an invitation: " + JSON.stringify(added).slice(0, 400));
  const pw = `${handle}-long-passphrase-r7`;
  const enrolled = await (await plane("/api/?op=enroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invite, handle, password: pw }) })).json();
  assert.equal(enrolled.ok, true, "enrolled: " + JSON.stringify(enrolled).slice(0, 400));
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle, password: pw, device: "own" }) })).json();
  assert.equal(signed.ok, true, "signed in: " + JSON.stringify(signed).slice(0, 400));
  const auth = { authorization: `Bearer ${signed.result.token}` };
  people.set(handle, auth);
  return auth;
}
const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => (await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
    headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() });
const get = async (auth, query) => (await plane(`/api/?${new URLSearchParams(query)}`, { headers: auth })).json();
const post = async (auth, op, body, query = {}) => {
  const res = await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
async function until(fn, ms, every = 3000) {
  const end = Date.now() + ms;
  let v = await fn();
  while (Date.now() < end && !v) { await later(every); v = await fn(); }
  return v;
}
const WATCHDOG = ["last_run", "alarm_at", "stale", "oldest_overdue", "watchdog_seen"];
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* ---- G58 ---- */

test("R105 (G58): the founder's `op=owedwork`, with and without `sha`, carries the five watchdog fields as own properties (null allowed); an enrolled administrator's too; an ordinary member's carries none", { timeout: 300000 }, async () => {
  const adm = await founder();
  for (const query of [{ op: "owedwork" }, { op: "owedwork", sha: "0".repeat(64) }]) {
    const r = (await get(adm, query)).result;
    for (const k of WATCHDOG) assert.ok(has(r, k), `the founder's ${JSON.stringify(query)} carries ${k}: ${JSON.stringify(r).slice(0, 300)}`);
  }
  const second = await person("second-admin", "admin");
  const a = (await get(second, { op: "owedwork" })).result;
  for (const k of WATCHDOG) assert.ok(has(a, k), `an enrolled administrator's carries ${k}: ${JSON.stringify(a).slice(0, 300)}`);
  const member = await person("plain-ann");
  const m = (await get(member, { op: "owedwork" })).result;
  for (const k of WATCHDOG) assert.equal(has(m, k), false, `a member's carries no ${k}`);
});

/* ---- the member's money flow: upload a CSV, file it, mint its content, declare the table, adopt the binding, ingest ---- */

const FIELDS = [{ name: "payer", type: "string" }, { name: "payee", type: "string" }, { name: "amount", type: "number" }];
const HEADER = FIELDS.map((f) => f.name);
const ROLES = { payer: { role: "payer", scheme: "ellery_person" }, payee: { role: "payee", scheme: "ellery_person" }, amount: { role: "amount" } };
const BIND = { amount: "amount", payer: "payer", payee: "payee", kind: { value: "payment" }, phase: { value: "actual" },
  stage: { value: "paid" }, basis: { value: "cash" }, currency: { value: "USD" }, period: { value: "2025-07-01/2026-06-30" } };
/* a CSV of `rows` data rows under the declared header, in the delimiter `sep`, made distinct by `tag` */
function csvOf(rows, tag, sep = ",") {
  const lines = [HEADER.join(sep)];
  for (let i = 0; i < rows; i++) lines.push([`P${tag}${String(i).padStart(6, "0")}`, "P002", (i % 97) + 1].join(sep));
  return te(lines.join("\n") + "\n");
}
/* the member's upload as the screen presses it, answered with the filed document's bundle */
async function uploadCsv(auth, bytes, name, project = "") {
  const res = await plane(`/api/?op=captureupload&statement=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}&type=text%2Fcsv`, { method: "POST", headers: auth, body: bytes });
  const up = (await res.json()).result;
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 400));
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screenCall(auth), { doc: up.document, title: name, locator: up.document.locator, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 400));
  return { up, made, sha: sha(bytes) };
}
const bindingKey = (body) => { const r = body.result || body; const k = r.binding_key || r.binding || r.key || (r.binding && r.binding.binding_key); assert.ok(k, "the binding's key: " + JSON.stringify(body).slice(0, 300)); return k; };
async function declareFrom(auth, filed, { header = HEADER } = {}) {
  const bundleId = (filed.made && (filed.made.bundleId || (filed.made.result && filed.made.result.bundleId))) || filed.up.document.bundleId;
  assert.ok(bundleId, "the document's bundle: " + JSON.stringify(filed.made).slice(0, 300));
  const minted = await post(auth, "contentmint", { bundleId });
  const contentId = minted.body.result && (minted.body.result.id || minted.body.result.content_id || minted.body.result.contentId);
  assert.ok(contentId, "content minted: " + JSON.stringify(minted.body).slice(0, 400));
  const declared = await post(auth, "tabledeclare", { source: contentId, schema: { fields: FIELDS }, header, roles: ROLES });
  return { contentId, declared: declared.body.result || declared.body, status: declared.status };
}
async function ingestAs(auth, bytes, name) {
  /* a period names the day in the team's time zone (calculations R105's binding read), which the team's profile gives: the instance has chosen one, as setup does */
  await profileSet(["oakland-alameda"]);
  const filed = await uploadCsv(auth, bytes, name);
  const d = await declareFrom(auth, filed);
  assert.equal(d.declared.ok, true, "table declared: " + JSON.stringify(d.declared).slice(0, 400));
  const adopted = await post(auth, "bindingadopt", { table: d.declared.sha, roles: BIND });
  assert.equal((adopted.body.result || adopted.body).ok, true, "binding adopted: " + JSON.stringify(adopted.body).slice(0, 400));
  const binding = bindingKey(adopted.body);
  const t0 = Date.now();
  const started = await post(auth, "moneyingest", { binding, rows: "all", reason: "round 7 seam" });
  return { filed, d, started, ms: Date.now() - t0 };
}
const ingestState = async (auth, ingest) => ((await get(auth, { op: "moneyingestread", ingest })).result || {});

/* ---- G61 ---- */

test("R105 (G61): a member's 18,098-row money ingest, once done, leaves the member's Queue (and its count) answering 200 with `FINDING::ingest-done::<ingest>`; the administrator's Queue is 200 without it", { timeout: 900000 }, async () => {
  const ann = await person("ingest-ann");
  const run = await ingestAs(ann, csvOf(18098, "G61"), "g61.csv");
  const result = run.started.body.result || run.started.body;
  assert.ok(result.ingest, "the act answers with its ingest: " + JSON.stringify(run.started.body).slice(0, 400));
  const done = await until(async () => { const s = await ingestState(ann, result.ingest); return s.state === "done" || s.written != null ? s : null; }, 300000, 2000);
  assert.ok(done, "the ingest finishes by the object's own alarm");
  const q = await plane(`/api/?op=queue`, { headers: ann });
  assert.equal(q.status, 200, "the member's whole Queue is not refused: " + (await q.clone().text()).slice(0, 400));
  const feed = JSON.stringify((await q.json()).result);
  assert.ok(feed.includes(`FINDING::ingest-done::${result.ingest}`), `the notice is in the feed: ${feed.slice(0, 400)}`);
  const counted = await plane(`/api/?op=queue&count=true`, { headers: ann });
  assert.equal(counted.status, 200, "the count: " + (await counted.clone().text()).slice(0, 300));
  const adm = await plane(`/api/?op=queue`, { headers: await founder() });
  assert.equal(adm.status, 200);
  assert.equal(JSON.stringify((await adm.json()).result).includes(`FINDING::ingest-done::${result.ingest}`), false, "the administrator did not run it");
});

/* ---- G64 ---- */

test("R105 (G64): a tab-delimited source declared over a three-column header is a three-column table of the data rows only, the header line dropped (comma control: the same rows; one cell per line against the header is refused naming the delimiter and the columns)", { timeout: 600000 }, async () => {
  const bob = await person("table-bob");
  const rows = 120;
  const readTable = async (sha256) => (await get(bob, { op: "table", sha256, sha: sha256 })).result || {};
  const comma = await declareFrom(bob, await uploadCsv(bob, csvOf(rows, "G64C"), "g64-comma.csv"));
  assert.equal(comma.declared.ok, true, JSON.stringify(comma.declared).slice(0, 300));
  assert.equal(comma.declared.rows, rows, `control: a comma file with a matching header holds exactly its data rows: ${JSON.stringify(comma.declared).slice(0, 1200)}`);
  for (const [sep, label] of [["\t", "tab"], [";", "semicolon"], ["|", "pipe"]]) {
    const d = await declareFrom(bob, await uploadCsv(bob, csvOf(rows, `G64${label[0].toUpperCase()}`, sep), `g64-${label}.csv`));
    assert.equal(d.declared.ok, true, `${label}: ${JSON.stringify(d.declared).slice(0, 300)}`);
    assert.equal(d.declared.rows, rows, `${label}: the header line is not a data row`);
    assert.equal((d.declared.header || HEADER).length, 3, `${label}: three declared columns`);
  }
  /* one cell per line against a three-column header, under no delimiter: refused with its reason */
  const lines = te(["payer", ...Array.from({ length: 30 }, (_, i) => `solo${i}`)].join("\n") + "\n");
  const one = await declareFrom(bob, await uploadCsv(bob, lines, "g64-solo.csv"));
  assert.equal(one.declared.ok, false, "a one-cell-per-line source is not accepted as a three-column table");
  assert.ok(JSON.stringify(one.declared).toLowerCase().includes("delimiter"), `the refusal names the delimiter: ${JSON.stringify(one.declared).slice(0, 300)}`);
  void readTable;
});

/* ---- G63 ---- */

test("R105 (G63): `moneyingest` over 10,000 rows answers `ingesting` in under 2 s by the test's own clock, after the plane's restart (cold table cache) too, and is reported beside a trivial member act through the same door (the floor)", { timeout: 900000 }, async () => {
  const cy = await person("ingest-cy");
  const bytes = csvOf(12000, "G63");
  const filed = await uploadCsv(cy, bytes, "g63.csv");
  const d = await declareFrom(cy, filed);
  assert.equal(d.declared.ok, true, JSON.stringify(d.declared).slice(0, 300));
  const adopted = await post(cy, "bindingadopt", { table: d.declared.sha, roles: BIND });
  assert.equal((adopted.body.result || adopted.body).ok, true);
  await mf.setOptions(OPTIONS); /* the plane restarts: the object's storage is kept, the table cache (process memory) is cold */
  const floorAt = Date.now();
  await (await plane("/api/?op=whoami", { headers: cy })).arrayBuffer();
  const floor = Date.now() - floorAt;
  const t0 = Date.now();
  const started = await post(cy, "moneyingest", { binding: bindingKey(adopted.body), rows: "all", reason: "round 7 cold" });
  const ms = Date.now() - t0;
  const r = started.body.result || started.body;
  assert.equal(r.state, "ingesting", JSON.stringify(started.body).slice(0, 300));
  console.log(`G63: moneyingest over ${12000} rows after a restart answered in ${ms} ms; a trivial member act through the same door ${floor} ms`);
  assert.ok(ms < 2000, `answered in ${ms} ms beside a trivial act's ${floor} ms (the walker's was 4.1 s)`);
});

/* ---- G61, the latent twin: a large capture's finished fetch, run AS AN ENROLLED MEMBER ---- */

/* a PDF of `bytes` bytes whose one page of text says `words`, filled out by a stream no page names */
function pdfOf(words, bytes) {
  const pad = new Uint8Array(Math.max(0, bytes - 1500));
  let x = 0x9e3779b9;
  for (let i = 0; i < pad.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; pad[i] = 0x41 + ((x >>> 24) % 26); }
  const stream = (n, dict, data) => [te(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`), data, te("\nendstream\nendobj\n")];
  const plain = (n, body) => [te(`${n} 0 obj\n${body}\nendobj\n`)];
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
const acquire = async (auth, body) => {
  const t = Date.now();
  const res = await plane("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ms: Date.now() - t, status: res.status, body: await res.json() };
};
async function projectOf(auth, title) {
  const cs = screenCall(auth);
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const made = await cs.call("promote", { body: { base: null, snapKey: iso.replace(/[-:]/g, "") + "_00c0ffee", meta: { object_type: "project", title, current_state: "forming", created: iso, last_updated: iso },
    files: [{ path: "bundle.md", text: `---\nobject_type: project\ntitle: "${title}"\nobjective: "${title}"\ncurrent_state: forming\ncreated: "${iso}"\nlast_updated: "${iso}"\n---\n\n## Session Log\n\n### Session ${iso} | Formation | interactive\nTrigger: the seam test\nChanges: created.\n` }], register: [], visibility: "hidden" } });
  const id = (made.result && made.result.bundleId) || made.bundleId;
  assert.ok(id, "the project is made: " + JSON.stringify(made).slice(0, 300));
  return id;
}

test("R105, R124 (G61 twin): a large capture opened by an enrolled member and finished by the alarm leaves the opener's Queue answering 200 with a `fetch-done` item for that capture", { timeout: 1200000 }, async () => {
  const dee = await person("fetch-dee", "member", ["contribute", "create_projects"]);
  const project = await projectOf(dee, "Round seven large capture");
  const big = pdfOf(`G61 the large budget volume the clerk read the notice ${Date.now()}`, 15932155);
  const name = `BUDGET-R7-${Date.now()}.pdf`;
  serve(name, big, { rate: 0.7 * MB });
  const first = await acquire(dee, { locator: `https://www.example.gov/files/${name}`, project });
  assert.equal(first.status, 200, JSON.stringify(first.body).slice(0, 400));
  assert.ok(first.body.fetch_pending, JSON.stringify(first.body).slice(0, 400));
  const held = await until(async () => (JSON.stringify((await get(dee, { op: "heldcaptures", project })).result).includes(sha(big)) ? true : null), 600000, 5000);
  assert.ok(held, "the document is in the project after the tick");
  /* the opener is told once the fetch's row ends; the Queue is read until then, and never refused */
  let last = "";
  const told = await until(async () => {
    const q = await plane("/api/?op=queue", { headers: dee });
    last = await q.text();
    assert.equal(q.status, 200, `the opener's Queue is not refused: ${last.slice(0, 400)}`);
    return last.includes("fetch-done") ? true : null;
  }, 180000, 5000);
  assert.ok(told, `the opener is told, by the item's kind (fetch-done): ${last.slice(0, 600)}`);
});

/* ---- the owner's chain: project, upload, vouch, question, citation, conclusion, case edition ---- */

/* a member who may create projects and publish (the vocabulary the whoami lists), made as `person` makes one */
const owners = new Map();
async function ownerOf(handle) {
  if (owners.has(handle)) return owners.get(handle);
  const adm = await founder();
  const added = await post(adm, "memberadd", { memberId: handle, cover: `cover of ${handle}`, role: "member", capabilities: ["contribute", "publish", "create_projects"] });
  const invite = added.body.result && (added.body.result.invite || (added.body.result.invitation && added.body.result.invitation.invite));
  assert.ok(invite, "an invitation: " + JSON.stringify(added.body).slice(0, 400));
  const pw = `${handle}-long-passphrase-r7`;
  const enrolled = await post({}, "enroll", { invite, handle, password: pw });
  assert.equal(enrolled.body.ok, true, "enrolled: " + JSON.stringify(enrolled.body).slice(0, 400));
  const signed = await post({}, "login", { handle, password: pw, device: "own" });
  assert.equal(signed.body.ok, true, "signed in: " + JSON.stringify(signed.body).slice(0, 400));
  const auth = { authorization: `Bearer ${signed.body.result.token}` };
  owners.set(handle, { auth, password: pw });
  return owners.get(handle);
}
/* an Ed25519 SSH signer (PROTOCOL.sshsig), as the signer kit signs a sitting; as test/m/ratification/fixture.mjs makes one */
const u8 = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? te(v) : v; return u8(u32(b.length), b); };
const armor = (blob) => `-----BEGIN SSH SIGNATURE-----\n${Buffer.from(blob).toString("base64").replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;
async function newKey() {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  return { priv: kp.privateKey, raw, keyB64: Buffer.from(u8(sstr("ssh-ed25519"), sstr(raw))).toString("base64") };
}
async function signText(key, message, namespace) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", te(message)));
  const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, u8(te("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h))));
  return armor(u8(te("SSHSIG"), u32(1), sstr(u8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
}
const R = (a) => (a && a.result !== undefined ? a.result : a);

/* "Open a question" on the project page: `allocid`, `promote` of the inquiry document, then `drawquestion` (src/screens-inquiry/project.mjs `promote`) */
async function questionOf(auth, project, question) {
  const cs = screenCall(auth);
  const title = question.replace(/\s+/g, " ").slice(0, 120);
  const now = new Date().toISOString().split(".")[0] + "Z";
  const a = R(await cs.call("allocid", { query: { prefix: "INQ", year: String(new Date().getUTCFullYear()) } }));
  assert.ok(a && a.id, "an id: " + JSON.stringify(a));
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/, "");
  const id = a.id + (slug ? "-" + slug : "");
  const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(title), "current_state: open", "prior_state: null",
    "created: " + now, "last_updated: " + now, "project: " + project, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "surfaced_by: human", "recheck_triggers:",
    "  - text: " + JSON.stringify(word("file.recheck.revisit")), "    description: " + JSON.stringify(word("file.recheck.none")), "---", ""];
  ["## Question", word("conformance.rests"), "## Conclusion", word("conformance.falsify"), "## Session Log", "## Review Notes"].forEach((h, i) => { lines.push(h, ""); if (i === 0) lines.push(question, ""); });
  const stamp = now.replace(/[-:]/g, "") + "_" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const p = await cs.call("promote", { body: { bundleId: id, base: null, snapKey: stamp, meta: { object_type: "inquiry", title, current_state: "open", created: now, last_updated: now }, files: [{ path: "bundle.md", text: lines.join("\n") }] } });
  assert.ok(p.ok !== false && R(p).ok !== false, "the question is filed: " + JSON.stringify(p).slice(0, 400));
  const d = await cs.call("drawquestion", { query: { project, inquiry: id, note: "" } });
  assert.ok(d.ok !== false && R(d).ok !== false, "the project draws on it: " + JSON.stringify(d).slice(0, 400));
  return id;
}

/* G60: a member's own revision of her filed document that leaves a history file no manifest entry lists. Since record-grammar R65 a history file maps to its
   entry by the key the manifest lists, whatever its form, so a revision under an odd snap key alone is coherent; a file under `_history/` whose key the
   manifest does not list is still a C-12.2 error (R65's control). The record keeps it; the case gate, which reads each cited member's image at signing, finds
   it. The revision carries the document's stored bytes by their address, as the screens carry them. */
async function reviseUnnamed(cs, bundle, size) {
  const img = R(await cs.call("image", { query: { id: bundle } }));
  const row = R(await cs.call("list", {})).find((b) => b.bundle_id === bundle);
  assert.ok(row && row.bundle_sha, "the document's head: " + JSON.stringify(row));
  const files = Object.keys(img).filter((k) => !k.startsWith("_history/")).map((path) => ({ path,
    ...(path === "bundle.md" ? { text: img[path] + "\n" } : path.startsWith("snapshots/upload-") ? { blobSha: path.slice(17), sha256: path.slice(17), bytes: size } : { text: img[path] }) }));
  files.push({ path: "_history/bundle_unlisted-key.md", text: img["bundle.md"] });   /* a history file whose key ("unlisted-key") no manifest entry lists */
  const done = R(await cs.call("promote", { body: { bundleId: bundle, base: row.bundle_sha, snapKey: "not-a-stamp", meta: { object_type: "information" }, files } }));
  assert.equal(done.ok, true, "the revision is kept: " + JSON.stringify(done).slice(0, 400));
}

/* the owner's own chain to a prepared case edition: a text uploaded and filed in her project, vouched or not, one sentence of it cited in a question she opened and
   concluded, the case drafted in the editor and prepared by the ceremony's `publish` (src/screens-publish/case-editor.mjs, ceremony.mjs) */
const BIAS = "This group holds that contracts should be adopted in public session.";
async function preparedEdition(handle, tag, { vouch, prepare = true, spoil = false }) {
  const { auth, password } = await ownerOf(handle);
  const cs = screenCall(auth);
  const project = await projectOf(auth, `Round seven ${tag} project`);
  /* a 356-byte text, two paragraphs, made distinct by the tag (its upload's own snapshot file is `snapshots/upload-<sha>`, dotless) */
  const first = "The clerk stamped the amended contract RECEIVED before the council voted on it.";
  const body = [first, `The minutes of the meeting were filed on Tuesday morning, and the register ${tag} was signed by the deputy clerk, the city attorney and the chair of the council.`];
  let text = body.join("\n\n");
  text += " ".repeat(Math.max(0, 356 - te(text).length));
  const bytes = te(text);
  const up = (await (await plane(`/api/?op=captureupload&statement=${encodeURIComponent(tag)}&name=${encodeURIComponent(tag + "-minutes")}&type=text%2Fplain`, { method: "POST", headers: auth, body: bytes })).json()).result;
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 400));
  assert.equal(up.document.file, "snapshots/upload-" + sha(bytes), "the upload's own snapshot file is dotless");
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: `${tag}-minutes`, locator: up.document.locator, project });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 400));
  const bundle = filed.bundleId;
  if (vouch) {
    /* the Document screen's "Confirm": `select` the document, then `release` with the handle, her acknowledgment and her mitigation (document.mjs `release`) */
    const sel = R(await cs.call("select", { body: { ids: [bundle] } }));
    assert.ok(sel && sel.handle, "a selection: " + JSON.stringify(sel).slice(0, 300));
    const rel = await cs.call("release", { query: { handle: sel.handle, acknowledgment: "I checked this file is the minutes as filed.", mitigation: "Nothing in it names a private person." } });
    assert.ok(rel.ok !== false && R(rel).ok !== false && R(rel).released.includes(bundle), "vouched: " + JSON.stringify(rel).slice(0, 400));
  }
  if (spoil) await reviseUnnamed(cs, bundle, bytes.length);
  const question = await questionOf(auth, project, "Did the clerk stamp the contract before the vote?");
  /* Find in this document (a term), then "Cite in the question" the one sentence found (document.mjs `cite`: project = the question, role, found) */
  const found = R(await cs.call("findin", { body: { scope: { capture: sha(bytes) }, kinds: ["term"], term: "stamped the amended contract" } }));
  const item = found.kinds[0].items[0];
  assert.equal(item.words, first, "one sentence of the document is found: " + JSON.stringify(item).slice(0, 300));
  const cited = R(await cs.call("cite", { body: { project: question, role: "supports", found: item } }));
  assert.deepEqual(cited.cited, [bundle], "the question rests on the document: " + JSON.stringify(cited).slice(0, 300));
  const concl = R(await cs.call("conclude", { query: { target: question, project, reading: "The clerk stamped the contract before the vote.",
    falsifier: "A received-log showing a later stamp would overturn this.", reason: "The minutes say so." } }));
  assert.equal(concl.ok, true, "concluded: " + JSON.stringify(concl).slice(0, 400));
  /* the case editor's "Prepare the draft", then the ceremony's Ties step: `publish` with `tieAttested` */
  const draft = R(await cs.call("casedraft", { body: { project, targets: [question], scope: "Whether the contract was stamped before the vote, on the documents in hand.",
    statement: "This case covers the stamp only; it leaves out the later amendments.", subjectPosition: "sought_and_answered",
    subjectJustification: "We put the question to the Clerk and printed the answer.", roles: { [question]: "load_bearing" }, excluded: [] } }));
  assert.ok(draft.draftId, "a draft: " + JSON.stringify(draft).slice(0, 300));
  if (!prepare) return { auth, password, cs, project, question, bundle, draft: draft.draftId, prepared: null };
  const prepared = R(await cs.call("publish", { body: { draft: draft.draftId, project, tieAttested: true, biasAcknowledgement: BIAS } }));
  assert.equal(prepared.ok, true, "the edition is prepared: " + JSON.stringify(prepared).slice(0, 600));
  return { auth, password, cs, project, question, bundle, draft: draft.draftId, prepared };
}

/* the Sign step's sitting, as the ceremony's `caseratify` send makes it: `casedocument`, the sitting list (`PARTS.sitting`), one signature a statement by her own key */
async function sitAndSign(e) {
  const { cs, prepared: p } = e;
  const key = await newKey();
  const reg = R(await cs.call("signerregisterown", { body: { keyB64: key.keyB64 } }));
  assert.equal(reg.ok, true, "her signing key is registered: " + JSON.stringify(reg).slice(0, 300));
  const doc = R(await cs.call("casedocument", { query: { case: p.caseId, edition: String(p.edition) } }));
  const list = PARTS.sitting(doc, { findings: p.findings.map((f) => ({ target: f.target, bundleSha: f.bundleSha })) });
  assert.ok(list && list.length >= 2, "a sitting: " + JSON.stringify(doc).slice(0, 300));
  const sigs = [];
  for (const x of list) sigs.push(await signText(key, x.text, x.namespace));
  /* the password again, as the ceremony asks it before a signature */
  const ra = R(await cs.call("reauth", { body: { password: e.password } }));
  assert.equal(ra.ok, true, "re-authenticated: " + JSON.stringify(ra).slice(0, 200));
  const res = await post(e.auth, "caseratify", { caseId: p.caseId, edition: Number(p.edition), expectedSha: doc.doc_sha, sig: sigs[0],
    members: list.slice(1).map((x, i) => ({ id: x.id, sha: x.sha, signature: sigs[i + 1] })) });
  return { res, list, doc };
}
const gateLine = (res) => `${res.status} ${JSON.stringify(res.body).slice(0, 700)}`;

/* ---- G59 ---- */

test("R105 (G59): a case citing one sentence of a VOUCHED upload (356 bytes, a dotless snapshot file) is signed: `caseratify` answers 200, the case is published, with its finding and complete", { timeout: 600000 }, async () => {
  const e = await preparedEdition("g59-ann", "g59a", { vouch: true });
  const { res } = await sitAndSign(e);
  assert.equal(res.status, 200, `the vouched upload does not stop the signing (C-12.2 on its history snapshot): ${gateLine(res)}`);
  assert.equal(res.body.ok, true, gateLine(res));
  const pub = R(await get(e.auth, { op: "publishedcase", id: e.prepared.caseId }));
  assert.equal(pub.caseId, e.prepared.caseId, "the case is published: " + JSON.stringify(pub).slice(0, 300));
  assert.ok(Array.isArray(pub.findings) && pub.findings.length >= 1, "its finding is published: " + JSON.stringify(Object.keys(pub)));
  assert.equal(pub.complete, true, "complete: " + JSON.stringify({ complete: pub.complete, awaiting: pub.awaiting }));
});

test("R105 (G59 control): the same case citing the same kind of upload NOT vouched is signed: 200, published, its finding, complete", { timeout: 600000 }, async () => {
  const e = await preparedEdition("g59-bea", "g59b", { vouch: false });
  const { res } = await sitAndSign(e);
  assert.equal(res.status, 200, gateLine(res));
  assert.equal(res.body.ok, true, gateLine(res));
  const pub = R(await get(e.auth, { op: "publishedcase", id: e.prepared.caseId }));
  assert.equal(pub.caseId, e.prepared.caseId, "the case is published: " + JSON.stringify(pub).slice(0, 300));
  assert.ok(Array.isArray(pub.findings) && pub.findings.length >= 1, "its finding is published: " + JSON.stringify(Object.keys(pub)));
  assert.equal(pub.complete, true, "complete: " + JSON.stringify({ complete: pub.complete, awaiting: pub.awaiting }));
});

/* ---- G62 ---- */

/* the instance's active profiles, set the way instance setup sets them (`profilesset`, the administrator's act) */
async function profileSet(ids) {
  const set = await post(await founder(), "profilesset", { profiles: ids });
  assert.equal(R(set.body).ok, true, "the profile is chosen: " + JSON.stringify(set.body).slice(0, 300));
}
/* what the ceremony's Sign step reads: `publishpreflight`'s step that carries `publish_at` (ceremony.mjs `stepWith("publish_at")`) */
const signStepOf = (answer) => (R(answer).steps || []).find((x) => x && typeof x === "object" && "publish_at" in x) || {};

/* the Sign step's pre-flight body as the ceremony builds it (ceremony.mjs: `P.caseArgs(copy, draft)` from the draft's `reviewcopy`, the declared bias the member attested, and
   `tieAttested: true` once the Ties step is confirmed, that is once the edition is prepared) */
async function ceremonyPreflight(e, { tied }) {
  const copy = R(await e.cs.call("reviewcopy", { query: { draft: e.draft } }));
  assert.ok(copy && copy.case, "the draft's copy: " + JSON.stringify(copy).slice(0, 300));
  const body = Object.assign({}, PARTS.caseArgs(copy, e.draft), { biasAcknowledgement: BIAS }, tied ? { tieAttested: true } : {});
  return e.cs.call("publishpreflight", { body });
}

test("R105 (G62): with the instance's profile `oakland-alameda` chosen and the Ties step confirmed (the edition prepared), the Sign step's pre-flight, its body built as the ceremony builds it, offers a publishing time in `America/Los_Angeles` and states its source", { timeout: 600000 }, async () => {
  await profileSet(["oakland-alameda"]);
  const e = await preparedEdition("g62-cy", "g62a", { vouch: false });
  const asked = await ceremonyPreflight(e, { tied: true });
  const step = signStepOf(asked);
  assert.ok("publish_at" in step, "the Sign step is in the answer: " + JSON.stringify(R(asked).steps).slice(0, 600));
  assert.ok(step.publish_at, `the Sign step states the time it offers (null reads as no zone: ${JSON.stringify(step.publish_at_stated || null)}; first: ${JSON.stringify(R(asked).first).slice(0, 200)})`);
  assert.equal(step.publish_at.offered, true, JSON.stringify(step.publish_at));
  assert.equal(step.publish_at.zone, "America/Los_Angeles", JSON.stringify(step.publish_at));
  assert.ok(["local-facts", "profiles"].includes(step.publish_at.source), `publish_at states where the zone came from (local-facts | profiles): ${JSON.stringify(step.publish_at)}`);
});

test("R105 (G62 control): before the Ties step is confirmed (a draft not yet prepared) the same pre-flight reaches only `TIE_ATTESTATION_MISSING` and the Sign step's `publish_at` is null with the reason stated", { timeout: 600000 }, async () => {
  await profileSet(["oakland-alameda"]);
  const e = await preparedEdition("g62-dee", "g62b", { vouch: false, prepare: false });
  const asked = await ceremonyPreflight(e, { tied: false });
  assert.equal(R(asked).first && R(asked).first.reason, "TIE_ATTESTATION_MISSING", JSON.stringify(R(asked).first).slice(0, 300));
  const step = signStepOf(asked);
  assert.equal(step.publish_at, null, JSON.stringify(step).slice(0, 400));
  assert.ok(typeof step.publish_at_stated === "string" && step.publish_at_stated.length > 0, "the reason is stated, never silence");
});

/* ---- helpers from the round-6 file ---- */

const textOf = (line, megabytes) => {
  const l = te(line + "\n"), out = new Uint8Array(Math.floor(megabytes * MB));
  for (let at = 0; at < out.length; at += l.length) out.set(l.subarray(0, Math.min(l.length, out.length - at)), at);
  return out;
};
async function uploadAndFile(auth, bytes, name, type, project = "") {
  const t = Date.now();
  const res = await plane(`/api/?op=captureupload&statement=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: auth, body: bytes });
  const up = await res.json();
  const ms = Date.now() - t;
  const a = up.result;
  assert.equal(a.ok, true, JSON.stringify(up).slice(0, 400));
  assert.equal(a.document.capture.sha256, sha(bytes));
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screenCall(auth), { doc: a.document, title: name, locator: a.document.locator, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 400));
  return { answer: a, ms, status: res.status, made };
}
const readingOf = async (auth, digest) => (await get(auth, { op: "reading", sha256: digest })).result;

/* ---- G74 ---- */

/* the member's filing as the Add screen's file tab presses it: upload, then promote the document naming the project; answers both, refusal unmasked */
async function uploadThenFile(auth, bytes, name, type, project) {
  const res = await plane(`/api/?op=captureupload&statement=${encodeURIComponent(name)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: auth, body: bytes });
  const up = (await res.json()).result;
  assert.equal(up.ok, true, "the upload: " + JSON.stringify(up).slice(0, 400));
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screenCall(auth), { doc: up.document, title: name, locator: up.document.locator, project });
  return { up, made, digest: sha(bytes) };
}
const heldRows = async (auth, project) => {
  const r = (await get(auth, { op: "heldcaptures", project })).result || {};
  return Array.isArray(r.held) ? r.held : [];
};
const inRows = (rows, digest) => rows.filter((x) => JSON.stringify(x).includes(digest));

test("R105 (G74): a member who is NOT in the project files a CSV naming it: `promote` is refused and no bundle is written for her upload in that project", { timeout: 300000 }, async () => {
  const adm = await founder();
  const project = await projectOf(adm, "G74 round seven closed project");
  const bea = await person("g74-bea");
  const csv = csvOfG74("G74OUT");
  const f = await uploadThenFile(bea, csv, "g74-outsider.csv", "text/csv", project);
  assert.notEqual(f.made.refused, undefined, `the filing into a project she is not in is refused (today it is accepted): ${JSON.stringify(f.made).slice(0, 500)}`);
  const why = f.made.refused || {};
  assert.ok(why.code || why.reason || why.translation || why.ok === false, `a member's refusal in the answer's own shape: ${JSON.stringify(why).slice(0, 400)}`);
  const rows = inRows(await heldRows(adm, project), f.digest);
  assert.equal(rows.length, 0, `no bundle holds her upload in that project: ${JSON.stringify(rows).slice(0, 400)}`);
  assert.equal(f.made.bundleId, undefined, "no bundle id is answered");
});

test("R105 (G74 control): a member who has JOINED the project (invited by its owner, then `projectjoin`) files a CSV into it and it is held there", { timeout: 300000 }, async () => {
  const adm = await founder();
  const project = await projectOf(adm, "G74 round seven joined project");
  const cal = await person("g74-cal");
  const inv = await post(adm, "projectinvite", {}, { projectId: project, handle: "g74-cal" });
  assert.equal(inv.status, 200, "the owner's invitation: " + JSON.stringify(inv.body).slice(0, 400));
  assert.notEqual((inv.body.result || inv.body).ok, false, "invited: " + JSON.stringify(inv.body).slice(0, 400));
  const join = await post(cal, "projectjoin", {}, { projectId: project });
  assert.equal(join.status, 200, "she joins: " + JSON.stringify(join.body).slice(0, 400));
  assert.notEqual((join.body.result || join.body).ok, false, "joined: " + JSON.stringify(join.body).slice(0, 400));
  const f = await uploadThenFile(cal, csvOfG74("G74JOIN"), "g74-joined.csv", "text/csv", project);
  assert.equal(f.made.refused, undefined, `a joined member's filing is accepted: ${JSON.stringify(f.made).slice(0, 400)}`);
  assert.ok(f.made.bundleId, "a bundle");
  const rows = inRows(await heldRows(cal, project), f.digest);
  assert.equal(rows.length, 1, `it is held in the project: ${JSON.stringify(await heldRows(cal, project)).slice(0, 400)}`);
});

test("R105 (G74 control): a member INVITED but not yet joined also files into the project (gathering stays open, K4557)", { timeout: 300000 }, async () => {
  const adm = await founder();
  const project = await projectOf(adm, "G74 round seven invited project");
  const dee = await person("g74-dee");
  const inv = await post(adm, "projectinvite", {}, { projectId: project, handle: "g74-dee" });
  assert.notEqual((inv.body.result || inv.body).ok, false, "invited: " + JSON.stringify(inv.body).slice(0, 400));
  const f = await uploadThenFile(dee, csvOfG74("G74INV"), "g74-invited.csv", "text/csv", project);
  assert.equal(f.made.refused, undefined, `an invited member's filing is accepted: ${JSON.stringify(f.made).slice(0, 400)}`);
  assert.ok(f.made.bundleId, "a bundle");
});
function csvOfG74(tag) { return te(`a,b,c\n${tag}-${Date.now()}-${Math.random()},2,3\n${tag}-x,5,6\n`); }

/* ---- G75 ---- */

/* the title a filed document's own bundle states, read through the door's `image` (the front matter's `title:`, a JSON string as promoteDocument writes it) */
async function bundleTitle(auth, bundleId) {
  const img = (await get(auth, { op: "image", id: bundleId })).result || {};
  const md = String(img["bundle.md"] || "");
  const m = /^title:\s*(.*)$/m.exec(md);
  assert.ok(m, `the filed bundle states a title: ${md.slice(0, 300)}`);
  let t = m[1].trim();
  try { t = JSON.parse(t); } catch { /* as it stands */ }
  return t;
}

test("R105 (G75): a fetched PDF over 8 MB is delivered by the alarm; `heldcaptures` then names it by the title the delivery filed it under, not null / 'Untitled capture'", { timeout: 600000 }, async () => {
  const adm = await founder();
  const ann = await person("g75-ann");
  const project = await projectOf(adm, "G75 round seven delivered title");
  const inv = await post(adm, "projectinvite", {}, { projectId: project, handle: "g75-ann" });
  assert.notEqual((inv.body.result || inv.body).ok, false, "invited: " + JSON.stringify(inv.body).slice(0, 300));
  await post(ann, "projectjoin", {}, { projectId: project });
  const name = `download${Date.now()}`; /* the address names no file: /files/download<n>?doc=17 */
  const bytes = pdfOf(`G75 the council minutes of the budget hearing ${Date.now()}`, 9 * MB);
  const digest = sha(bytes);
  serve(name, bytes);
  const first = await acquire(ann, { locator: `https://www.example.gov/files/${name}?doc=17`, project });
  assert.equal(first.status, 200, JSON.stringify(first.body).slice(0, 400));
  assert.ok(first.body.fetch_pending, `parked for the alarm (a fetch over 8 MB): ${JSON.stringify(first.body).slice(0, 400)}`);
  const row = await until(async () => inRows(await heldRows(ann, project), digest)[0] || null, 300000, 3000);
  assert.ok(row, "the delivery filed the document in the project");
  console.log("G75 held row:", JSON.stringify(row).slice(0, 600));
  const filedTitle = await bundleTitle(ann, row.bundle_id);
  console.log("G75 filed bundle title:", JSON.stringify(filedTitle));
  assert.ok(typeof filedTitle === "string" && filedTitle.length > 0, "the filed document has a title");
  assert.ok(typeof row.title === "string" && row.title.trim() !== "", `the held row carries a title (today null): ${JSON.stringify(row.title)}`);
  assert.notEqual(row.title, "Untitled capture", "not the untitled word");
  assert.equal(/\[object Object\]|undefined|null/.test(row.title), false, `the title is words, no unfilled placeholder: ${JSON.stringify(row.title)}`);
  assert.equal(row.title, filedTitle, "the held row's title is the title the delivery filed the document under");
});

test("R105 (G75 control): a small fetched PDF captured inside the request and filed as the Add screen files it is held under its filed title", { timeout: 300000 }, async () => {
  const adm = await founder();
  const project = await projectOf(adm, "G75 round seven inline title");
  const name = `G75-SMALL-${Date.now()}.pdf`;
  const bytes = pdfOf(`G75 small notice of the zoning hearing ${Date.now()}`, 6000);
  serve(name, bytes);
  const address = `https://www.example.gov/files/${name}`;
  const r = await acquire(adm, { locator: address, project });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.body.document, `captured inside the request: ${JSON.stringify(r.body).slice(0, 300)}`);
  /* doneAcquire's own step: the screen names it (`titleOf`) and files it (`promoteDocument`) */
  const cs = { ...screenCall(adm), w: (k, v) => word(k, v), date: (d) => d };
  const title = CAPTURE_SCREEN.parts.titleOf(cs, { reading: r.body.reading, doc: r.body.document, address });
  const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: r.body.document, title, locator: address, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 300));
  const row = inRows(await heldRows(adm, project), sha(bytes))[0];
  console.log("G75 control held row:", JSON.stringify(row).slice(0, 400), "title named:", JSON.stringify(title));
  assert.ok(row, "held in the project");
  assert.equal(row.title, await bundleTitle(adm, made.bundleId));
  assert.ok(row.title && row.title.trim() !== "", "titled");
});

/* ---- G66 ---- */

const pageOf = (first) => te(`<html><head><title>Zoning notice</title></head><body><p>${first}</p><p>The commission also reviewed the harbor lease and the parking study for the east district.</p><p>Public comment closes at noon on the last day of the month.</p></body></html>`);
/* a question as the project screen's "ask" press writes it (allocid, promote of the inquiry, then drawquestion) */
async function askQuestion(auth, project, text) {
  const cs = screenCall(auth);
  const now = new Date().toISOString().split(".")[0] + "Z";
  const minted = (await cs.call("allocid", { query: { prefix: "INQ", year: now.slice(0, 4) } })).result;
  assert.ok(minted && minted.id, "an id: " + JSON.stringify(minted));
  const id = minted.id + "-" + text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/, "");
  const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(text), "current_state: open", "prior_state: null",
    "created: " + now, "last_updated: " + now, "project: " + project, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "surfaced_by: human", "recheck_triggers:",
    "  - text: " + JSON.stringify(word("file.recheck.revisit")), "    description: " + JSON.stringify(word("file.recheck.none")), "---", ""];
  ["## Question", word("conformance.rests"), "## Conclusion", word("conformance.falsify"), "## Session Log", "## Review Notes"].forEach((h, i) => { lines.push(h, ""); if (i === 0) lines.push(text, ""); });
  const stamp = now.replace(/[-:]/g, "") + "_" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const p = await cs.call("promote", { body: { bundleId: id, base: null, snapKey: stamp, meta: { object_type: "inquiry", title: text, current_state: "open", created: now, last_updated: now },
    files: [{ path: "bundle.md", text: lines.join("\n") }] } });
  assert.notEqual((p.result || p).ok, false, "the question is filed: " + JSON.stringify(p).slice(0, 400));
  const drew = await post(auth, "drawquestion", {}, { project, inquiry: id, note: "" });
  assert.notEqual((drew.body.result || drew.body).ok, false, "drawn into the project: " + JSON.stringify(drew.body).slice(0, 400));
  return id;
}
/* the Add screen's acquire press, then doneAcquire's own filing step for a document that came in the answer */
async function captureAndFile(auth, address, project) {
  const r = await acquire(auth, { locator: address, project });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.ok(r.body.document, `captured inside the request: ${JSON.stringify(r.body).slice(0, 400)}`);
  const cs = { ...screenCall(auth), w: (k, v) => word(k, v), date: (d) => d };
  const title = CAPTURE_SCREEN.parts.titleOf(cs, { reading: r.body.reading, doc: r.body.document, address });
  const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: r.body.document, title, locator: address, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 400));
  return { r, made, digest: r.body.document.capture.sha256 };
}

test("R105 (G66): a newer capture of a page a question cites in paragraph 0 raises a `newer-capture-affects-reference` Queue item for the question's owner (`op=queue` answers 200)", { timeout: 600000 }, async () => {
  const adm = await founder();
  const eve = await person("g66-eve");
  const project = await projectOf(adm, "G66 round seven newer copy");
  await post(adm, "projectinvite", {}, { projectId: project, handle: "g66-eve" });
  await post(eve, "projectjoin", {}, { projectId: project });
  const stamp = Date.now();
  const name = "page";
  const address = `https://www.example.gov/${name}?x=1`;
  serve(name, pageOf(`The commission set the zoning hearing for the first Tuesday ${stamp}.`), { type: "text/html" });
  const one = await captureAndFile(eve, address, project);
  const question = await askQuestion(eve, project, `Did the commission set the zoning hearing ${stamp}`);
  /* find-in over the document (a term), as document.mjs's press sends it, then cite the first hit */
  const found = (await post(eve, "findin", { scope: { capture: one.digest }, kinds: ["term"], term: "zoning hearing" })).body.result || {};
  const items = ((found.kinds || []).find((k) => k && k.kind === "term") || {}).items || [];
  console.log("G66 findin items:", items.length, JSON.stringify(items[0] || found).slice(0, 500));
  assert.ok(items.length > 0, "the find holds a passage to cite: " + JSON.stringify(found).slice(0, 400));
  const cited = await post(eve, "cite", { project: question, role: "supports", found: items[0] });
  console.log("G66 cite:", cited.status, JSON.stringify(cited.body).slice(0, 500));
  assert.equal(cited.status, 200, JSON.stringify(cited.body).slice(0, 400));
  assert.notEqual((cited.body.result || cited.body).ok, false, JSON.stringify(cited.body).slice(0, 400));
  /* the copy changes in paragraph 0 and is captured again ("Capture the new copy": acquire with the same body) and filed */
  await later(2500); /* a member's second press comes seconds later, never inside the first capture's own second (the chain orders captures by their retrieved stamp, whole seconds) */
  serve(name, pageOf(`The commission moved the zoning hearing to the second Wednesday ${stamp}.`), { type: "text/html" });
  const two = await captureAndFile(eve, address, project);
  assert.notEqual(two.digest, one.digest, "the second copy is another capture");
  /* the object's own alarm runs; the owner's Queue answers 200 and holds the notice */
  let last = "";
  const waited0 = Date.now();
  const item = await until(async () => {
    const q = await plane("/api/?op=queue", { headers: eve });
    last = await q.text();
    assert.equal(q.status, 200, "the member's Queue is not refused: " + last.slice(0, 400));
    let feed; try { feed = JSON.parse(last).result; } catch { return null; }
    const rows = [];
    (function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") { if (v.kind === "newer-capture-affects-reference") rows.push(v); Object.values(v).forEach(walk); } })(feed);
    const mine = rows.find((x) => JSON.stringify(x).includes(question));
    if (mine) console.log("G66 queue item after", Date.now() - waited0, "ms:", JSON.stringify(mine).slice(0, 500));
    return mine || null;
  }, 240000, 5000);
  if (!item) console.log("G66 diagnostic owedwork:", JSON.stringify((await get(adm, { op: "owedwork" })).result).slice(0, 300), "versionnotice:", JSON.stringify((await get(eve, { op: "versionnotice", target: question })).result).slice(0, 2500));
  assert.ok(item, `a newer-capture-affects-reference item for ${question} is in the owner's Queue: ${last.slice(0, 600)}`);
});

/* ---- G79 ---- */

test("R105 (G79): a 24 MiB text (three 8 MiB parts) uploaded through `captureupload` states its size and capture sha, is `existed` on a second identical upload; a 40 MB five-part upload likewise; wall times are reported, not bars (smoke)", { timeout: 240000 }, async () => {
  const ann = await person("g79-ann");
  const stamp = Date.now();
  for (const [label, bytes] of [["24 MiB", textOf(`G79 the board approved the long minutes 24 ${stamp}`, 24)], ["40 MB", textOf(`G79 the board approved the long minutes 40 ${stamp}`, 40)]]) {
    const digest = sha(bytes);
    const t0 = Date.now();
    const up = await uploadAndFile(ann, bytes, `g79-${label.replace(" ", "")}.txt`, "text/plain");
    const ms = Date.now() - t0;
    console.log(`G79 ${label}: upload answered in ${up.ms} ms (upload + filing ${ms} ms), parts ${(up.answer.document.parts || []).length}, bytes ${up.answer.document.capture.bytes}`);
    assert.equal(up.status, 200);
    assert.equal(up.answer.ok, true);
    assert.equal(up.answer.document.capture.sha256, digest, "the answer carries the capture's sha");
    assert.equal(up.answer.document.capture.bytes, bytes.length, "and the stated size");
    assert.ok((up.answer.document.parts || []).length >= 3, `${label}: held in parts: ${(up.answer.document.parts || []).length}`);
    const t1 = Date.now();
    const again = (await (await plane(`/api/?op=captureupload&statement=again&name=g79.txt&type=text%2Fplain`, { method: "POST", headers: ann, body: bytes })).json()).result;
    console.log(`G79 ${label}: second identical upload answered in ${Date.now() - t1} ms`);
    assert.equal(again.ok, true, JSON.stringify(again).slice(0, 300));
    assert.equal(again.existed, true, "the second identical upload is `existed`");
    console.log(`G79 ${label}: the existed answer: ${JSON.stringify(again).slice(0, 300)}`);
    const againSha = (again.document && again.document.capture && again.document.capture.sha256) || (again.capture && again.capture.sha256) || again.sha256 || again.sha;
    assert.equal(againSha, digest, "the existed answer names the same capture");
    const r = await until(async () => { const x = await readingOf(ann, digest); return x && x.found ? x : null; }, 60000, 1500);
    assert.ok(r, "the capture reads back through the door (stated)");
  }
});

/* ---- G60 ---- */

/* the ceremony of screens-publish, drawn over its own fixtures' reads, with the door's answer to the press (`caseratify`) given as the door made it */
const CEREMONY = `/app/ceremony/${CE.P}/${CE.DR}`;
async function ceremonySigned(answer) {
  const p = await CE.open(CEREMONY, { boot: { idb: await CE.keptKey() }, plane: { caseratify: answer } });
  CE.tick(p, "ce-tie", "yes");
  await CE.press(p, "publish", { reason: "because" });
  const { slot } = await CE.press(p, "caseratify", { reason: "because" });
  await CE.answerSign(p, true, "caseratify");
  await p.settle();
  return { p, slot: slot() };
}

test("R105 (G60): a case whose cited document the case gate finds a problem in passes the pre-flight, is refused at `caseratify` with GATE_REFUSED and its findings, and the ceremony, given that answer, draws the refusal and each finding's check, text and repairs", { timeout: 600000 }, async () => {
  const e = await preparedEdition("g60-ann", "g60a", { vouch: true, spoil: true });
  const asked = R(await ceremonyPreflight(e, { tied: true }));
  assert.equal(asked.first, null, "the pre-flight, which reads the case's own bytes, finds nothing to stop on: " + JSON.stringify(asked.first).slice(0, 400));
  const { res } = await sitAndSign(e);
  assert.equal(res.status, 409, gateLine(res));
  assert.equal(res.body.reason, "GATE_REFUSED", gateLine(res));
  const found = res.body.findings;
  assert.ok(Array.isArray(found) && found.length >= 1, "the refusal carries what the gate found: " + gateLine(res));
  assert.ok(found.every((x) => typeof x.check === "string" && x.check && typeof x.detail === "string" && x.detail), "each finding names its check and its text: " + JSON.stringify(found).slice(0, 500));
  assert.ok(found.some((x) => x.check === "C-12.2"), "the held finding is the history's: " + JSON.stringify(found).slice(0, 500));
  const pub = await get(e.auth, { op: "publishedcase", id: e.prepared.caseId });
  assert.ok(!R(pub) || R(pub).caseId === undefined || R(pub).ok === false, "nothing is published on the refusal: " + JSON.stringify(pub).slice(0, 300));
  const { p, slot } = await ceremonySigned({ status: res.status, json: res.body });
  assert.ok(slot.textContent.includes(CE.word("refusal.GATE_REFUSED")), "the refusal's own sentence is drawn");
  assert.ok(slot.textContent.includes(CE.word("ceremony.gate.heading")), "under the heading the ceremony lists its stops by");
  const items = slot.querySelectorAll("[data-gate-finding]");
  assert.deepEqual(items.map((i) => i.getAttribute("data-gate-finding")), found.map((x) => x.check), "one line a finding, each by its check");
  items.forEach((item, i) => {
    assert.ok(item.textContent.includes(found[i].detail), "the finding's text, as the gate stated it, is drawn");
    for (const r of [].concat(found[i].repairs || [])) assert.ok(item.textContent.includes(r), "each repair the gate stated is drawn");
  });
  assert.equal(CE.main(p).querySelector("[data-signed]"), null, "nothing is drawn signed on a refusal");
});

test("R105 (G60 control): the same case with no held finding is signed: `caseratify` answers 200 and the ceremony, given that answer, draws no refusal and no finding", { timeout: 600000 }, async () => {
  const e = await preparedEdition("g60-bea", "g60b", { vouch: true });
  const { res } = await sitAndSign(e);
  assert.equal(res.status, 200, gateLine(res));
  assert.equal(res.body.ok, true, gateLine(res));
  assert.equal(res.body.findings, undefined, "a signing carries no refusal's findings");
  const { p } = await ceremonySigned({ status: res.status, json: res.body });
  assert.equal(CE.main(p).textContent.includes(CE.word("refusal.GATE_REFUSED")), false, "no refusal is drawn");
  assert.equal(CE.main(p).querySelectorAll("[data-gate-finding]").length, 0, "no finding is drawn");
  assert.ok(CE.main(p).querySelector("[data-signed]"), "the signing is drawn as signed");
});
