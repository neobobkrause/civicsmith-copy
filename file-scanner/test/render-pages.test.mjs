// The safe view's page cap with a stand-in converter (G136b; R7): the converter returns n pages for each case, so the
// cap's outcome is told for a document of the cap less one, exactly the cap, and more than the cap, whatever the real
// LibreOffice does past the end of a document, and for a converter that ignores the range it is given.
import { conversions } from './stubs/use-fake-soffice.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { handle } from '../src/handler.mjs';
import { makeZip } from '../../bio-plane/test/make-zip.mjs';
import { memoryBucket, putCapture, rendererImage, depsWith, post, rendererPresent } from './helpers.mjs';
/** @import { Answer, ContainerInit } from '../src/store.mjs' */

/** @typedef {{ convert: string, outdir: string, pages: number }} Conversion one conversion the stand-in states it made */
/** @typedef {{ r: Answer, body: unknown, made: Conversion[] }} Rendered one render: the answer, its body (the view's bytes, or the refusal as JSON) and the conversions made */

const skip = !rendererPresent && 'Poppler is not installed';
const MAX = 4;
/** @param {string} marker @returns {Uint8Array} */
const document = (marker) => makeZip([{ name: '[Content_Types].xml', data: '<Types/>', method: 0 }, { name: 'word/document.xml', data: marker, method: 0 }, { name: 'pages.txt', data: marker, method: 0 }]);
/** @param {Uint8Array} pdf @returns {number} */
const pagesIn = (pdf) => {
  const f = join(mkdtempSync(join(process.env.TMPDIR, 'pg-')), 'v.pdf');
  writeFileSync(f, pdf);
  return Number((/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [f]).toString()) || [])[1]);
};

/** @param {string} marker @param {{ max?: number }} [options] @returns {Promise<Rendered>} */
async function render(marker, { max = MAX } = {}) {
  const bucket = memoryBucket();
  const image = await rendererImage();
  const deps = depsWith({ bucket, renderer: /** @param {string} path @param {ContainerInit} [init] */ (path, init) => image.fetch(path.replace(/([?&])max=\d+/, `$1max=${max}`), init) });
  conversions();
  /** @type {Answer} */
  const r = await handle(post('/render', { store: 'bio', target: putCapture(bucket, document(marker)), route: 'office' }), deps);
  const body = r.status === 200 ? new Uint8Array(await r.arrayBuffer()) : await r.json();
  return { r, body, made: conversions() };
}
/** @param {Rendered} x @returns {(string | null)[]} */
const answer = (x) => [x.r.headers.get('x-pages'), x.r.headers.get('x-source-pages'), x.r.headers.get('x-truncated'), x.r.headers.get('x-source-pages-exact')];

test('R7 G136b the converter is asked for the cap and one page more, and the page past the cap tells a longer document from one of exactly the cap', { skip }, async () => {
  const less = await render(`PAGES:${MAX - 1}`);
  assert.deepEqual(answer(less), [String(MAX - 1), String(MAX - 1), 'false', null], 'the cap less one is whole');
  const exact = await render(`PAGES:${MAX}`);
  assert.deepEqual(answer(exact), [String(MAX), String(MAX), 'false', null], 'exactly the cap is whole, not truncated');
  const more = await render(`PAGES:${MAX + 1}`);
  assert.deepEqual([more.r.headers.get('x-pages'), more.r.headers.get('x-truncated')], [String(MAX), 'true'], 'one page more is cut to the cap');
  assert.ok(Number(more.r.headers.get('x-source-pages')) > MAX);
  assert.equal(pagesIn(more.body), MAX);
  for (const x of [less, exact, more]) {
    assert.equal(x.made.length, 1, 'one conversion: no second look at the document');
    assert.deepEqual(JSON.parse(x.made[0].convert.slice('pdf:writer_pdf_Export:'.length)), { PageRange: { type: 'string', value: `1-${MAX + 1}` } });
  }
  assert.deepEqual(made(less, exact, more), [MAX - 1, MAX, MAX + 1], 'no conversion held more than the cap and one page');
});
/** @param {...Rendered} xs @returns {number[]} */
const made = (...xs) => xs.map((x) => x.made[0].pages);

test('R7 G136b a converter that ignores the range and makes every page still yields the cap, truncated, the source said longer', { skip }, async () => {
  const all = await render(`PAGES:${MAX + 9};IGNORE_RANGE`);
  assert.deepEqual([all.r.headers.get('x-pages'), all.r.headers.get('x-truncated')], [String(MAX), 'true']);
  assert.equal(pagesIn(all.body), MAX);
  assert.equal(Number(all.r.headers.get('x-source-pages')), MAX + 9, 'it made them all, so the count is known');
  const bare = await render('PAGES:0');
  assert.equal(bare.r.status, 422);
  assert.equal(bare.body.code, 'NOT_RENDERABLE');
});
