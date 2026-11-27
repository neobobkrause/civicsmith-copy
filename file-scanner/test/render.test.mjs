// POST /render (R7), with the safe-view image's own server (LibreOffice, Poppler) run locally; R14's removal; and R17's
// "the renderer's PDF holds images only".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { handle } from '../src/handler.mjs';
import { SAFE_VIEW_DPI, SAFE_VIEW_PAGES_MAX, SAFE_VIEW_BYTES_MAX, RENDER_TIME_MS, SCAN_MAX_BYTES, SCAN_LIMITS } from '../src/limits.mjs';
import { makePdf, content } from '../../pdf-worker/test/make-pdf.mjs';
import { memoryBucket, putCapture, putDerived, rendererImage, depsWith, post, enc, sha, rendererPresent } from './helpers.mjs';
/** @import { Deps, RequestBody, Answer, ContainerInit } from '../src/store.mjs' */
/** @import { PdfBody } from '../../pdf-worker/test/make-pdf.mjs' */

/** @typedef {{ objects: Map<string, Uint8Array>, calls: [string, string][] }} TestBucket the in-memory bucket, as these tests read it: its objects and its recorded calls */
/** @typedef {{ ok: boolean, code: string, class?: string, message: string }} Refusal the member's refusal, as these tests read it; `message` is read only where a test expects one */

const skip = !rendererPresent && 'LibreOffice and Poppler are not installed';
const FONT = '/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >>';

/** A PDF of `n` pages, each with text, a link and a form field; the document has a script, an attachment and metadata.
 *  @param {number} n @returns {Uint8Array} */
function richPdf(n) {
  const pages = Array.from({ length: n }, (_, i) => 4 + 2 * i);
  /** @type {PdfBody[]} */
  const bodies = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R /AcroForm << /Fields [] >> /Names << /EmbeddedFiles << /Names [(a.txt) << /Type /Filespec /F (a.txt) >>] >> >> >>',
    `<< /Type /Pages /Kids [${pages.map((p) => `${p} 0 R`).join(' ')}] /Count ${n} >>`,
    '<< /S /JavaScript /JS (app.alert\\(1\\)) >>',
  ];
  for (let i = 0; i < n; i++) {
    bodies.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << ${FONT} >> /Contents ${5 + 2 * i} 0 R `
      + '/Annots [<< /Type /Annot /Subtype /Link /Rect [10 10 100 30] /A << /S /URI /URI (https://example.org/x) >> >>] >>');
    bodies.push(content(`BT /F1 18 Tf 20 100 Td (Secret text page ${i + 1}) Tj ET`));
  }
  bodies.push('<< /Title (Hidden title) /Author (Someone) >>');
  return makePdf(bodies, { trailer: `/Info ${bodies.length} 0 R` });
}

/** @returns {Promise<{ bucket: TestBucket, deps: Deps }>} */
async function rendering() {
  const bucket = memoryBucket();
  const image = await rendererImage();
  return { bucket, deps: depsWith({ bucket, renderer: image.fetch }) };
}
/** @param {Deps} deps @param {RequestBody} body @returns {Promise<Answer>} */
const call = (deps, body) => handle(post('/render', body), deps);
/** @param {Answer} r @returns {Promise<Uint8Array>} */
const bodyOf = async (r) => new Uint8Array(await r.arrayBuffer());

/** Every object of the safe view, by Poppler and by its own bytes: one image per page, no text, nothing else.
 *  @param {Uint8Array} pdf @param {number} pages @returns {void} */
function assertImagesOnly(pdf, pages) {
  const dir = mkdtempSync(join(process.env.TMPDIR, 'check-'));
  writeFileSync(join(dir, 'v.pdf'), pdf);
  assert.equal(execFileSync('pdftotext', [join(dir, 'v.pdf'), '-']).toString().trim(), '', 'no text layer');
  const listed = execFileSync('pdfimages', ['-list', join(dir, 'v.pdf')]).toString().trim().split('\n').slice(2);
  assert.equal(listed.length, pages, 'one image per page');
  const text = Buffer.from(pdf).toString('latin1');
  for (const banned of ['/JS', '/JavaScript', '/URI', '/Annots', '/AcroForm', '/EmbeddedFiles', '/OpenAction', '/Info', '/Font', '/Title', '/Metadata', 'Secret text']) {
    assert.ok(!text.includes(banned), `the safe view holds no ${banned}`);
  }
  const objs = [...text.matchAll(/\d+ 0 obj\n(<<[^]*?>>)/g)].map((m) => m[1]);
  assert.equal(objs.length, 2 + 3 * pages, 'catalog, page tree, and per page its page, content and image');
  const info = execFileSync('pdfinfo', [join(dir, 'v.pdf')]).toString();
  assert.match(info, new RegExp(`Pages:\\s+${pages}\\b`));
}

test('R7 a PDF becomes a new PDF of page images at SAFE_VIEW_DPI and nothing else of the source', { skip }, async () => {
  const { bucket, deps } = await rendering();
  const t = putCapture(bucket, richPdf(3));
  const r = await call(deps, { store: 'bio', target: t, route: 'pdf' });
  assert.equal(r.status, 200);
  const pdf = await bodyOf(r);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(r.headers.get('x-derived-sha256'), sha(pdf));
  assert.deepEqual([r.headers.get('x-pages'), r.headers.get('x-source-pages'), r.headers.get('x-truncated')], ['3', '3', 'false']);
  assertImagesOnly(pdf, 3);
  // 300×200 points at SAFE_VIEW_DPI: each page image is 625×417 pixels, and its page the source page's size.
  const dir = mkdtempSync(join(process.env.TMPDIR, 'dpi-'));
  writeFileSync(join(dir, 'v.pdf'), pdf);
  const row = execFileSync('pdfimages', ['-list', join(dir, 'v.pdf')]).toString().trim().split('\n')[2].trim().split(/\s+/);
  assert.deepEqual([row[3], row[4]], [String(Math.round(300 * SAFE_VIEW_DPI / 72)), String(Math.round(200 * SAFE_VIEW_DPI / 72))]);
  assert.match(execFileSync('pdfinfo', [join(dir, 'v.pdf')]).toString(), /Page size:\s+300 x 200/);
});

test('R7 the office route renders a Word document; R17 the renderer\'s PDF holds images only', { skip }, async () => {
  const { bucket, deps } = await rendering();
  const dir = mkdtempSync(join(process.env.TMPDIR, 'doc-'));
  writeFileSync(join(dir, 'w.txt'), 'A Word document\nwith two lines\n');
  execFileSync('soffice', ['--headless', `-env:UserInstallation=file://${join(dir, 'p')}`, '--convert-to', 'docx', '--outdir', dir, join(dir, 'w.txt')], { stdio: 'ignore' });
  const t = putCapture(bucket, readFileSync(join(dir, 'w.docx')));
  const r = await call(deps, { store: 'bio', target: t, route: 'office' });
  assert.equal(r.status, 200);
  const pdf = await bodyOf(r);
  assert.equal(r.headers.get('x-pages'), '1');
  assertImagesOnly(pdf, 1);
});

test('R7 pages beyond SAFE_VIEW_PAGES_MAX are not rendered, and the headers say so', { skip }, async () => {
  /** @type {string[]} */
  const seen = [];
  const image = await rendererImage();
  const bucket = memoryBucket();
  const deps = depsWith({ bucket, renderer: /** @param {string} path @param {ContainerInit} [init] */ (path, init) => { seen.push(path); return image.fetch(path.replace(`max=${SAFE_VIEW_PAGES_MAX}`, 'max=2'), init); } });
  const t = putCapture(bucket, richPdf(4));
  const r = await call(deps, { store: 'bio', target: t, route: 'pdf' });
  assert.equal(seen.length, 1);
  const asked = new URL(`http://x${seen[0]}`);
  assert.equal(asked.pathname, '/render');
  assert.deepEqual(Object.fromEntries(asked.searchParams), { route: 'pdf', dpi: String(SAFE_VIEW_DPI), max: String(SAFE_VIEW_PAGES_MAX), bytes: String(SAFE_VIEW_BYTES_MAX),
    ms: String(RENDER_TIME_MS), entries: String(SCAN_LIMITS.max_files), directory: String(SCAN_LIMITS.zip_directory) }, 'the member asks with every figure, quoted from the table');
  assert.deepEqual([r.headers.get('x-pages'), r.headers.get('x-source-pages'), r.headers.get('x-truncated')], ['2', '4', 'true']);
  assertImagesOnly(await bodyOf(r), 2);
});

test('R7 refusals by name: R1\'s and R2\'s, ENCRYPTED, NOT_RENDERABLE, TIME_LIMIT, RENDER_FAILED', { skip }, async () => {
  const { bucket, deps } = await rendering();
  /** @param {RequestBody} body @param {Deps} [d] @returns {Promise<[number, Refusal]>} */
  const answer = async (body, d = deps) => { const r = await call(d, body); return [r.status, /** @type {Refusal} the member's own answer */ (await r.json())]; };
  const pdf = putCapture(bucket, richPdf(1));
  assert.deepEqual(await answer({ store: 'x', target: pdf, route: 'pdf' }), [400, { ok: false, code: 'NAMESPACE_UNKNOWN' }]);
  assert.deepEqual(await answer({ store: 'bio', target: { capture_sha: 'z' }, route: 'pdf' }), [400, { ok: false, code: 'BAD_TARGET' }]);
  assert.deepEqual(await answer({ store: 'bio', target: pdf, route: 'pdf' }, depsWith({ bucket: null })), [503, { ok: false, code: 'R2_NOT_CONFIGURED' }]);
  assert.deepEqual(await answer({ store: 'bio', target: { capture_sha: '1'.repeat(64), parts: null }, route: 'pdf' }), [404, { ok: false, code: 'NOT_FOUND' }]);
  const tampered = putCapture(bucket, enc('%PDF-1.4 tampered'), { split: 5 });
  bucket.objects.set(`bio/captures/${tampered.parts[0].sha256}`, enc('%PDF!'));
  assert.deepEqual(await answer({ store: 'bio', target: tampered, route: 'pdf' }), [409, { ok: false, code: 'DIGEST_MISMATCH' }]);
  const huge = { capture_sha: '2'.repeat(64), parts: [{ sha256: '3'.repeat(64), bytes: SCAN_MAX_BYTES + 1 }] };
  assert.deepEqual(await answer({ store: 'bio', target: huge, route: 'pdf' }), [413, { ok: false, code: 'TOO_LARGE' }]);
  const enc1 = putCapture(bucket, readFileSync(new URL('./fixtures/encrypted.pdf', import.meta.url)));
  assert.deepEqual(await answer({ store: 'bio', target: enc1, route: 'pdf' }), [422, { ok: false, code: 'ENCRYPTED', class: 'final' }]);
  const text = putCapture(bucket, enc('just some text'));
  const notPdf = (await answer({ store: 'bio', target: text, route: 'pdf' }))[1];
  assert.deepEqual([notPdf.ok, notPdf.code, notPdf.class, typeof notPdf.message], [false, 'NOT_RENDERABLE', 'final', 'string']);
  assert.deepEqual((await answer({ store: 'bio', target: text, route: 'office' }))[1].code, 'NOT_RENDERABLE');
  assert.deepEqual((await answer({ store: 'bio', target: pdf, route: 'spreadsheet' }))[1].code, 'NOT_RENDERABLE');
  // TIME_LIMIT: the image stops a render past its budget.
  process.env.RENDER_TIME_MS = '1';
  try { assert.deepEqual(await answer({ store: 'bio', target: pdf, route: 'pdf' }), [504, { ok: false, code: 'TIME_LIMIT', class: 'transient' }]); }
  finally { delete process.env.RENDER_TIME_MS; }
  // RENDER_FAILED carries the converter's message, at most 300 characters.
  const failing = depsWith({ bucket, renderer: async () => new Response(JSON.stringify({ ok: false, code: 'RENDER_FAILED', message: 'x'.repeat(900) }), { status: 500 }) });
  const [s, b] = await answer({ store: 'bio', target: pdf, route: 'pdf' }, failing);
  assert.deepEqual([s, b.code, b.class, b.message.length], [500, 'RENDER_FAILED', 'final', 300]);
  // an unreachable renderer is a refusal a later try can answer
  const unreachable = depsWith({ bucket, renderer: async () => { throw new Error('no route to the renderer'); } });
  const [s2, b2] = await answer({ store: 'bio', target: pdf, route: 'pdf' }, unreachable);
  assert.deepEqual([s2, b2.code, b2.class], [503, 'RENDER_FAILED', 'transient']);
});

test('R7 R2 a derived target (area "derived") renders from ${store}/derived/<sha> as a capture does; any other area is BAD_TARGET', { skip }, async () => {
  const { bucket, deps } = await rendering();
  const view = putDerived(bucket, richPdf(1));
  const r = await call(deps, { store: 'bio', target: view, route: 'pdf' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-pages'), '1');
  await r.arrayBuffer();
  assert.ok(bucket.calls.every(([, k]) => !k.includes('/captures/')), 'nothing read under captures/');
  const capture = putCapture(bucket, richPdf(2));
  assert.deepEqual([(await call(deps, { store: 'bio', target: { ...capture, area: 'derived' }, route: 'pdf' })).status], [404]);
  for (const area of ['captures', 'x', false]) {
    const b = await call(deps, { store: 'bio', target: { ...view, area }, route: 'pdf' });
    assert.deepEqual([b.status, await b.json()], [400, { ok: false, code: 'BAD_TARGET' }], String(area));
  }
});

test('R14 the render\'s directory is gone when its answer arrives', { skip }, async () => {
  const { bucket, deps } = await rendering();
  const t = putCapture(bucket, richPdf(1));
  await bodyOf(await call(deps, { store: 'bio', target: t, route: 'pdf' }));
  const enc1 = putCapture(bucket, readFileSync(new URL('./fixtures/encrypted.pdf', import.meta.url)));
  await (await call(deps, { store: 'bio', target: enc1, route: 'pdf' })).json();
  assert.deepEqual(readdirSync(process.env.TMPDIR).filter((n) => n.startsWith('render-')), []);
});

test('R7 R11c a NOT_RENDERABLE refusal of the renderer reaches the answer with its message, at most 300 characters, class final', async () => {
  const bucket = memoryBucket();
  const pdf = putCapture(bucket, enc('%PDF-1.4 stub'));
  /** @param {string} [message] @returns {Deps} */
  const refusing = (message) => depsWith({ bucket, renderer: async () => new Response(JSON.stringify({ ok: false, code: 'NOT_RENDERABLE', ...(message === undefined ? {} : { message }) }), { status: 422 }) });
  /** @param {Deps} d @returns {Promise<[number, Refusal]>} */
  const answer = async (d) => { const r = await call(d, { store: 'bio', target: pdf, route: 'office' }); return [r.status, /** @type {Refusal} the member's own answer */ (await r.json())]; };
  assert.deepEqual(await answer(refusing('the converter produced no PDF')), [422, { ok: false, code: 'NOT_RENDERABLE', class: 'final', message: 'the converter produced no PDF' }]);
  assert.equal((await answer(refusing('x'.repeat(900))))[1].message.length, 300);
  assert.deepEqual(await answer(refusing()), [422, { ok: false, code: 'NOT_RENDERABLE', class: 'final' }], 'a refusal without a message states none');
});
