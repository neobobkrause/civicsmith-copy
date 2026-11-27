// The safe view's bounds (fix round 9, G136b; R7's page cap before conversion, its byte limit, its refusal classes, R16's
// figures sent to the image), through the member's surface and the renderer image's own server with the real LibreOffice
// and Poppler. A recorder (stubs/soffice-recorder.mjs) stands between the image and LibreOffice and states each conversion
// it was asked for, so a test sees which pages were converted and not only which were shown.
import { conversions } from './stubs/use-soffice-recorder.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { handle } from '../src/handler.mjs';
import { SAFE_VIEW_PAGES_MAX, SAFE_VIEW_BYTES_MAX } from '../src/limits.mjs';
import { makePdf, content } from '../../pdf-worker/test/make-pdf.mjs';
import { memoryBucket, putCapture, rendererImage, depsWith, post, rendererPresent } from './helpers.mjs';
/** @import { Deps, RequestBody, Answer, AnswerHeaders, ContainerInit, ContainerFetch } from '../src/store.mjs' */
/** @import { PdfBody } from '../../pdf-worker/test/make-pdf.mjs' */

/** @typedef {{ ok: boolean, code: string, class?: string, message?: string }} Refusal the member's or the image's refusal, as these tests read it */
/** @typedef {{ max?: number, bytes?: number }} Figures the figures a test asks the image for in place of the table's, by the query's names */
/** @typedef {{ objects: Map<string, Uint8Array>, calls: [string, string][] }} TestBucket the in-memory bucket, as these tests read it: its objects and its recorded calls */
/** @typedef {{ status: number, headers: AnswerHeaders }} Headed an answer, as far as its status and headers */

const skip = !rendererPresent && 'LibreOffice and Poppler are not installed';
/** @param {Deps} deps @param {RequestBody} body @returns {Promise<Answer>} */
const call = (deps, body) => handle(post('/render', body), deps);
/** @param {Answer} r @returns {Promise<Uint8Array>} */
const bytesOf = async (r) => new Uint8Array(await r.arrayBuffer());
/** @param {Uint8Array} pdf @returns {number} */
const pageCount = (pdf) => {
  const f = join(mkdtempSync(join(process.env.TMPDIR, 'pc-')), 'v.pdf');
  writeFileSync(f, pdf);
  return Number((/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [f]).toString()) || [])[1]);
};
/** @param {Headed} r @returns {(string | null)[]} */
const headers = (r) => [r.headers.get('x-pages'), r.headers.get('x-source-pages'), r.headers.get('x-truncated')];

/** A PDF of `n` pages, each with text. @param {number} n @returns {Uint8Array} */
function textPdf(n) {
  const pages = Array.from({ length: n }, (_, i) => 3 + 2 * i);
  /** @type {PdfBody[]} */
  const bodies = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((p) => `${p} 0 R`).join(' ')}] /Count ${n} >>`];
  for (let i = 0; i < n; i++) {
    bodies.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${4 + 2 * i} 0 R >>`);
    bodies.push(content(`BT /F1 18 Tf 20 100 Td (Page ${i + 1}) Tj ET`));
  }
  return makePdf(bodies);
}

/** A Word document with at least `pages` pages (counted by LibreOffice itself, whole), and that count.
 *  @param {number} pages @returns {{ bytes: Buffer, total: number }} */
function wordDocument(pages) {
  const dir = mkdtempSync(join(process.env.TMPDIR, 'doc-'));
  const opts = [`-env:UserInstallation=file://${join(dir, 'p')}`, '--headless'];
  writeFileSync(join(dir, 'w.txt'), Array.from({ length: pages * 70 }, (_, i) => `Line ${i + 1} of a long document`).join('\n') + '\n');
  execFileSync('soffice', [...opts, '--convert-to', 'docx', '--outdir', dir, join(dir, 'w.txt')], { stdio: 'ignore' });
  execFileSync('soffice', [...opts, '--convert-to', 'pdf', '--outdir', dir, join(dir, 'w.docx')], { stdio: 'ignore' });
  const total = Number((/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [join(dir, 'w.pdf')]).toString()) || [])[1]);
  return { bytes: readFileSync(join(dir, 'w.docx')), total };
}

/** The member with its renderer asked for `figures` in place of the table's (the figures are the query's).
 *  @param {Figures} [figures] @returns {Promise<{ bucket: TestBucket, deps: Deps, image: { fetch: ContainerFetch } }>} */
async function rendering(figures = {}) {
  const bucket = memoryBucket();
  const image = await rendererImage();
  const deps = depsWith({ bucket, renderer: /** @param {string} path @param {ContainerInit} [init] */ (path, init) => image.fetch(path.replace(/([?&])(max|bytes)=\d+/g, /** @param {string} m @param {string} sep @param {'max' | 'bytes'} k */ (m, sep, k) => (k in figures ? `${sep}${k}=${figures[k]}` : m)), init) });
  return { bucket, deps, image };
}

test('R7 G136b only the first SAFE_VIEW_PAGES_MAX pages of an office document, and one more, are converted: a longer one costs the cap and says it is longer', { skip }, async () => {
  const doc = wordDocument(7);
  assert.ok(doc.total >= 5, `the fixture has ${doc.total} pages`);
  const cap = 2;
  const { bucket, deps } = await rendering({ max: cap });
  conversions();
  const r = await call(deps, { store: 'bio', target: putCapture(bucket, doc.bytes), route: 'office' });
  assert.equal(r.status, 200);
  const view = await bytesOf(r);
  const made = conversions();
  assert.equal(made.length, 1, 'one conversion');
  assert.match(made[0].convert, /^pdf:writer_pdf_Export:/);
  assert.deepEqual(JSON.parse(made[0].convert.slice('pdf:writer_pdf_Export:'.length)), { PageRange: { type: 'string', value: `1-${cap + 1}` } });
  assert.equal(made[0].pages, cap + 1, 'the converter made the first pages and one more: the cap applies before conversion');
  assert.equal(pageCount(view), cap);
  assert.deepEqual([r.headers.get('x-pages'), r.headers.get('x-truncated')], [String(cap), 'true']);
  assert.ok(Number(r.headers.get('x-source-pages')) > cap, 'the source is stated to be longer than the cap');
});

test('R7 G136b a document of exactly the cap and one shorter than it are whole; one page more than the cap is truncated', { skip }, async () => {
  const doc = wordDocument(4);
  /** @param {number} max */
  const at = async (max) => {
    const { bucket, deps } = await rendering({ max });
    conversions();
    const r = await call(deps, { store: 'bio', target: putCapture(bucket, doc.bytes), route: 'office' });
    await r.arrayBuffer();
    return { r, made: conversions() };
  };
  const exact = await at(doc.total);
  assert.deepEqual(headers(exact.r), [String(doc.total), String(doc.total), 'false'], 'exactly the cap');
  assert.equal(exact.r.headers.get('x-source-pages-exact'), null);
  const shorter = await at(doc.total + 3);
  assert.deepEqual(headers(shorter.r), [String(doc.total), String(doc.total), 'false'], 'shorter than the cap');
  const longer = await at(doc.total - 1);
  assert.deepEqual([longer.r.headers.get('x-pages'), longer.r.headers.get('x-truncated')], [String(doc.total - 1), 'true']);
  for (const x of [exact, shorter, longer]) assert.equal(x.made.length, 1, 'a document is converted once');
});

test('R7 G136b the safe view is cut at the last page that fits SAFE_VIEW_BYTES_MAX, truncated true; a first page over it is a final refusal', { skip }, async () => {
  const whole = await rendering();
  const t = putCapture(whole.bucket, textPdf(4));
  const full = await call(whole.deps, { store: 'bio', target: t, route: 'pdf' });
  const fullBytes = await bytesOf(full);
  assert.deepEqual(headers(full), ['4', '4', 'false']);
  assert.equal(pageCount(fullBytes), 4);
  const fits = await rendering({ bytes: fullBytes.length });
  let r = await call(fits.deps, { store: 'bio', target: putCapture(fits.bucket, textPdf(4)), route: 'pdf' });
  assert.deepEqual(headers(r), ['4', '4', 'false'], 'a view exactly at the limit is whole');
  assert.equal((await bytesOf(r)).length, fullBytes.length);
  const cut = await rendering({ bytes: fullBytes.length - 1 });
  r = await call(cut.deps, { store: 'bio', target: putCapture(cut.bucket, textPdf(4)), route: 'pdf' });
  const view = await bytesOf(r);
  assert.deepEqual(headers(r), ['3', '4', 'true'], 'one byte short: cut at the last page that fits');
  assert.ok(view.length <= fullBytes.length - 1, 'the view is within the limit');
  assert.equal(pageCount(view), 3, 'a valid PDF of the pages that fit');
  assert.equal(r.headers.get('x-derived-sha256'), (await import('node:crypto')).createHash('sha256').update(view).digest('hex'));
  const none = await rendering({ bytes: 1 });
  r = await call(none.deps, { store: 'bio', target: putCapture(none.bucket, textPdf(2)), route: 'pdf' });
  const refused = /** @type {Refusal} the member's own answer */ (await r.json());
  assert.deepEqual([r.status, refused.code, refused.class, typeof refused.message], [500, 'RENDER_FAILED', 'final', 'string']);
});

test('R7 the Worker holds the renderer\'s answer to SAFE_VIEW_BYTES_MAX: an answer that declares more is refused, one that streams more ends in an error', async () => {
  const bucket = memoryBucket();
  const pdf = putCapture(bucket, textPdf(1));
  /** @param {number} chunks @returns {ReadableStream<Uint8Array>} */
  const stream = (chunks) => new ReadableStream({ pull(c) { if (!chunks--) return c.close(); c.enqueue(new Uint8Array(1 << 20)); } });
  /** @param {{ [name: string]: string }} headers @param {number} chunks @returns {Deps} */
  const answer = (headers, chunks) => depsWith({ bucket, renderer: /** @param {string} path @param {ContainerInit} init */ async (path, init) => { await new Response(init.body).arrayBuffer(); return new Response(stream(chunks), { status: 200, headers: { 'content-type': 'application/pdf', ...headers } }); } });
  const declared = await call(answer({ 'content-length': String(SAFE_VIEW_BYTES_MAX + 1) }, 1), { store: 'bio', target: pdf, route: 'pdf' });
  assert.deepEqual([declared.status, /** @type {Refusal} the member's own answer */ (await declared.json()).class], [500, 'final']);
  const over = await call(answer({}, SAFE_VIEW_BYTES_MAX / (1 << 20) + 1), { store: 'bio', target: pdf, route: 'pdf' });
  assert.equal(over.status, 200);
  await assert.rejects(over.arrayBuffer(), /SAFE_VIEW_BYTES_MAX/);
  const within = await call(answer({}, SAFE_VIEW_BYTES_MAX / (1 << 20)), { store: 'bio', target: pdf, route: 'pdf' });
  assert.equal((await bytesOf(within)).length, SAFE_VIEW_BYTES_MAX);
});

test('R7 R16 the image refuses a render without its figures, and a render asks for the cap the table sets', { skip }, async () => {
  const image = await rendererImage();
  const r = await image.fetch('/render?route=pdf', { method: 'POST', body: textPdf(1) });
  assert.deepEqual([r.status, (await r.json()).code], [400, 'LIMITS_MISSING']);
  const part = await image.fetch('/render?route=pdf&dpi=150&max=500&bytes=100&ms=1000', { method: 'POST', body: textPdf(1) });
  assert.deepEqual([part.status, (await part.json()).code], [400, 'LIMITS_MISSING']);
  assert.equal(SAFE_VIEW_PAGES_MAX, 500);
});
