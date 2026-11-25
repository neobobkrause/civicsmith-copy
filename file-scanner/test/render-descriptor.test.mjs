// F-B14 (R7, office route): a Word or PowerPoint file written the way the corpus generators write it (ZIP64 packages) reaches
// the converter as a plain ZIP, which the pinned LibreOffice 7.4.7 loads, so its safe view is made. The converter here is
// stubs/soffice-74.mjs, which behaves as 7.4.7 measured in the pinned image.
import './stubs/use-soffice-74.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { handle } from '../src/handler.mjs';
import { buildFixture } from '../../bio-plane/test/corpus.mjs';
import { officeInfo, plainPackage } from '../container/renderer.mjs';
import { zipDirectory } from '../container/common.mjs';
import { memoryBucket, putCapture, rendererImage, depsWith, post, rendererPresent } from './helpers.mjs';

const skip = !rendererPresent && 'LibreOffice and Poppler are not installed';
const call = (deps, body) => handle(post('/render', body), deps);
const FIGURES = { entries: 10000, directory: 16 * 1024 * 1024 };

/** Whether the package ends with a ZIP64 locator: the form the stand-in for 7.4.7 cannot load. */
const zip64 = (buf) => buf.readUInt32LE(buf.length - 42) === 0x07064b50;

async function rendering() {
  const bucket = memoryBucket();
  const image = await rendererImage();
  return { bucket, deps: depsWith({ bucket, renderer: image.fetch }) };
}

/** A package of the generators for `kind`, built by their real code. */
const generated = async (kind) => readFileSync((await buildFixture({ kind, size: 10, seed: 1 })).path);

/** A Word document made by the real LibreOffice, a plain ZIP. */
function plainDocx() {
  const dir = mkdtempSync(join(process.env.TMPDIR, 'plain-'));
  writeFileSync(join(dir, 'w.txt'), 'A plain document\n');
  execFileSync('soffice', [`-env:UserInstallation=file://${join(dir, 'p')}`, '--headless', '--convert-to', 'docx', '--outdir', dir, join(dir, 'w.txt')], { stdio: 'ignore' });
  return readFileSync(join(dir, 'w.docx'));
}

for (const kind of ['docx', 'pptx']) {
  test(`R7 F-B14 a generated ${kind} (a ZIP64 package) is rendered by the 7.4.7 converter`, { skip }, async () => {
    const bytes = await generated(kind);
    assert.ok(zip64(bytes), `the generator's ${kind} is a ZIP64 package, the case that failed`);
    const { bucket, deps } = await rendering();
    const r = await call(deps, { store: 'bio', target: putCapture(bucket, bytes), route: 'office' });
    assert.equal(r.status, 200, JSON.stringify(r.status === 200 ? {} : await r.clone().json()));
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.ok(Number(r.headers.get('x-pages')) >= 1, 'at least one page is drawn');
  });
}

test('R7 F-B14 a plain package is rendered as before', { skip }, async () => {
  const bytes = plainDocx();
  assert.ok(!zip64(bytes));
  const { bucket, deps } = await rendering();
  const r = await call(deps, { store: 'bio', target: putCapture(bucket, bytes), route: 'office' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-pages'), '1');
});

test('R7 F-B14 the plain package holds the same entries, byte for byte once inflated, in the same order', async () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'plain-'));
  for (const kind of ['docx', 'pptx', 'odt']) {
    const from = join(dir, `s.${kind}`);
    writeFileSync(from, await generated(kind));
    const a = await open(from, 'r');
    const size = (await a.stat()).size;
    const info = await officeInfo(a, size, 'zip', FIGURES);
    assert.ok(await plainPackage(from, size, info.entries, join(dir, `p.${kind}`)), kind);
    const b = await open(join(dir, `p.${kind}`), 'r');
    const plain = await zipDirectory(b, (await b.stat()).size, { maxEntries: 10000, maxBytes: 1 << 24 });
    assert.deepEqual(plain.entries.map((e) => e.name), info.entries.map((e) => e.name), `${kind}: the same entries in the same order`);
    const inflated = async (fh, e) => {
      const lh = Buffer.alloc(30);
      await fh.read(lh, 0, 30, e.at);
      const raw = Buffer.alloc(e.csize);
      await fh.read(raw, 0, e.csize, e.at + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28));
      return e.method === 0 ? raw : inflateRawSync(raw);
    };
    for (let i = 0; i < plain.entries.length; i++) {
      assert.equal(plain.entries[i].flags & 8, 0, 'no data descriptor');
      assert.equal(plain.entries[i].method, info.entries[i].method);
      assert.ok((await inflated(b, plain.entries[i])).equals(await inflated(a, info.entries[i])), `${kind}: ${plain.entries[i].name}`);
    }
    assert.ok(!zip64(readFileSync(join(dir, `p.${kind}`))), 'no ZIP64 locator');
    await a.close(); await b.close();
  }
});

test('R7 F-B14 the directory states a ZIP64 entry\'s real sizes and offset, not 0xFFFFFFFF', async () => {
  const from = join(mkdtempSync(join(process.env.TMPDIR || '/tmp', 'plain-')), 's.docx');
  writeFileSync(from, await generated('docx'));
  const fh = await open(from, 'r');
  const d = await zipDirectory(fh, (await fh.stat()).size, { maxEntries: 10000, maxBytes: 1 << 24 });
  assert.ok(d.entries.length > 1);
  for (const e of d.entries) assert.ok(e.csize < 0xffffffff && e.usize < 0xffffffff && e.at < 0xffffffff, e.name);
  assert.equal(d.entries[0].at, 0);
  assert.ok(d.entries[1].at > d.entries[0].at);
  await fh.close();
});

test('R7 F-B14 a package whose values do not fit a plain ZIP is left as it is', async () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'plain-'));
  const from = join(dir, 's.docx');
  writeFileSync(from, await generated('docx'));
  const fh = await open(from, 'r');
  const size = (await fh.stat()).size;
  const info = await officeInfo(fh, size, 'zip', FIGURES);
  await fh.close();
  const huge = info.entries.map((e, i) => (i === 0 ? { ...e, usize: 0x1_0000_0000 } : e));
  assert.equal(await plainPackage(from, size, huge, join(dir, 'p.docx')), false);
  const lost = info.entries.map((e, i) => (i === 1 ? { ...e, at: e.at + 1 } : e));
  assert.equal(await plainPackage(from, size, lost, join(dir, 'q.docx')), false, 'a header not where the directory says');
});
