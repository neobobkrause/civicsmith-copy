// Copied from control-plane's suite (test/m/control-plane/t51-reading-follows.test.mjs) when control-plane-door-reading took R120, R123 and R125 by copy (5 Nov 2026); it proves the requirement through the real plane.
/* control-plane R123 (fix round 4b, F1, F2, F6; K4487; D3; plane R77, capture R103, store-door R18): A READING FOLLOWS EVERY ENTRY INTO THE RECORD, THROUGH THE REAL
   PLANE. The Worker the product deploys, its object, its alarm and R2 under Miniflare; the network scripted. Each case is a member's own act, the way the
   screens press it, ending at `op=reading` with no further press:
     F6  a 3 MB text-layer PDF knocks at the doorbell, the member brings it into the record (`inboxpull`): its reading exists;
     F2  a 40 MB file is uploaded (five parts) and filed as the capture screen files it: the whole is held after the alarm and its reading exists;
     F1  a 3 MB PDF is captured (its reading follows by the alarm), the member files it after the alarm has given up on it (a quarter of an hour
         is more than five tries of the entry's back-off): its reading exists within one more alarm.
   F6 needs only this module. F2 is red by name until capture R103 (the upload's keep over 32 MiB) and plane R77 (the owed-work ledger) have merged, and F1
   until plane R77 has (an entry never ends by a count). The PDFs are built here from text (pdf-reader's test writer), never taken from a jurisdiction. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const MB = 1024 * 1024;
const ADM = "adm-follows-0123456789abcdef", PASSWORD = "the founder's long password, follows", ORIGIN = "https://group.example";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const later = (ms) => new Promise((r) => setTimeout(r, ms));

/* a PDF of `megabytes` MB whose text layer says `words`: one page of text and a stream the page never names, filling the file out. The
   reader is xref-free, so none is written; the font maps the codes 0x20-0x7E to themselves. */
function pdfOf(words, megabytes) {
  const pad = new Uint8Array(Math.floor(megabytes * MB));
  let x = 0x9e3779b9;
  for (let i = 0; i < pad.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; pad[i] = 0x41 + ((x >>> 24) % 26); }   /* letters: no "endstream" in it */
  const te = (t) => new TextEncoder().encode(t);
  const stream = (n, dict, data) => [te(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`), data, te("\nendstream\nendobj\n")];
  const plain = (n, body) => [te(`${n} 0 obj\n${body}\nendobj\n`)];
  const toUni = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";
  const parts = [te("%PDF-1.7\n"),
    ...plain(1, "<< /Type /Catalog /Pages 2 0 R >>"), ...plain(2, "<< /Type /Pages /Kids [100 0 R] /Count 1 >>"),
    ...plain(10, `<< /Type /Font /Subtype /TrueType /BaseFont /Plain /FirstChar 32 /Widths [${Array(95).fill(500).join(" ")}] /ToUnicode 11 0 R >>`),
    ...stream(11, "", te(toUni)),
    ...plain(100, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 10 0 R >> >> /Contents 101 0 R >>"),
    ...stream(101, "", te(`BT /F1 12 Tf 72 700 Td (${words}) Tj ET`)),
    ...stream(500, "", pad), te("trailer\n<< /Root 1 0 R >>\n%%EOF\n")];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

let served = {};
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-follows-0123456789abcdef", PROBE_TOKEN: "prb-follows-0123456789abcdef", VERSION: "4.7.4",
              INSTANCE_NAME: "follows-town", KNOCK_FINGERPRINT_KEY: "follows-fingerprint-key", GOVERNOR_APPETITE_PER_MIN: "600000",
              GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
  outboundService: (req) => {
    const b = served[new URL(req.url).pathname.split("/").pop()];
    return b ? new Response(b, { headers: { "content-type": "application/pdf", "content-length": String(b.length) } }) : new Response("not scripted", { status: 404 });
  },
});
after(() => mf.dispose());
const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

async function founder() {
  const claimed = await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) });
  await claimed.arrayBuffer();
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return { authorization: `Bearer ${signed.result.token}` };
}
const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => {
    const u = new URLSearchParams({ op, ...query });
    return (await plane(`/api/?${u}`, { method: body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                        ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json();
  } });
const readingOf = async (auth, digest) => (await (await plane(`/api/?op=reading&sha256=${digest}`, { headers: auth })).json()).result;
/* the alarm reads within a minute of a registration; wait up to `ms` for the reading to carry text */
async function readingWithText(auth, digest, ms) {
  const end = Date.now() + ms;
  let r = await readingOf(auth, digest);
  while (Date.now() < end && !(r && r.found && Array.isArray(r.text_units) && r.text_units.length > 0)) { await later(3000); r = await readingOf(auth, digest); }
  return r;
}

test("R123 F6 (inboxpull): a 3 MB text-layer PDF knocked at the doorbell and brought into the record has its reading, with its text, without a press", { timeout: 400000 }, async () => {
  const auth = await founder();
  const words = `The doorbell knock carried the board resolution ${Date.now()}`;
  const bytes = pdfOf(words, 3);
  const knocked = await (await plane("/api/?op=knock", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
    body: JSON.stringify({ contentB64: Buffer.from(bytes).toString("base64"), note: "please look", contact: "k@example.org", fileName: "resolution.pdf", mediaType: "application/pdf" }) })).json();
  const knock = knocked.result ?? knocked;
  assert.equal(knock.ok, true, JSON.stringify(knocked).slice(0, 400));
  assert.equal(knock.sha256, sha(bytes));
  const pulled = await (await plane("/api/?op=inboxpull", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ knockId: knock.knockId }) })).json();
  assert.equal(pulled.ok, true, JSON.stringify(pulled).slice(0, 400));
  assert.equal(pulled.result.ok, true, JSON.stringify(pulled).slice(0, 400));
  assert.equal(pulled.result.reading_pending, true, "a PDF over 2 MB follows by the alarm, and the answer says so");
  const r = await readingWithText(auth, sha(bytes), 150000);
  assert.equal(r.found, true, `read without a press: ${JSON.stringify(r).slice(0, 300)}`);
  assert.ok(JSON.stringify(r.text_units).includes("board resolution"), "its text is the PDF's");
});

/* R123 F2 (an upload over its kind's whole-read ceiling, read as its statement) is not copied here: since N1267 that ceiling is 100 MiB for text, past the request-body ceiling of
   one upload (R72), so it is proven at the door in this module's `r123-reading.test.mjs` and `t51-round5-door.test.mjs`, which read the ceiling from READ_BOUNDS. */

test("R123 F1 (promote): a 3 MB PDF captured, left unfiled until the alarm has given up on it, and filed then is read within one more alarm", { timeout: 900000 }, async () => {
  const auth = await founder();
  const bytes = pdfOf(`The late filing was a notice of the hearing ${Date.now()}`, 3);
  served = { "late-notice.pdf": bytes };
  const res = await plane("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ locator: "https://www.example.gov/files/late-notice.pdf" }) });
  const a = await res.json();
  assert.equal(res.status, 200, JSON.stringify(a).slice(0, 400));
  assert.equal(a.reading_pending, true, "a PDF over 2 MB follows by the alarm");
  assert.equal(a.document.capture.sha256, sha(bytes));
  /* the entry is tried while no home exists (5 tries by 225 s under the old back-off); a quarter of an hour is longer than that */
  await later(250000);
  assert.equal((await readingOf(auth, sha(bytes))).found, false, "nothing is filed, so nothing is read yet");
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screenCall(auth), { doc: a.document, title: "late-notice.pdf", locator: a.document.locator, project: "" });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 400));
  const r = await readingWithText(auth, sha(bytes), 120000);
  assert.equal(r.found, true, `read within one alarm of the filing: ${JSON.stringify(r).slice(0, 300)}`);
  assert.ok(JSON.stringify(r.text_units).includes("notice of the hearing"));
});
