// R43: agent-runner/dist/ holds no committed file but its .gitignore; the bundle and manifest are built there by
// scripts/build.mjs whenever needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAgentRunner } from '../scripts/build.mjs';
import { readManifest } from '../src/manifest.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

test('R43 dist/ holds no committed file but a .gitignore that ignores everything else in it', () => {
  const committed = execFileSync('git', ['ls-files', '--', '.'], { cwd: DIST, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(committed, ['.gitignore']);
  const marker = readManifest();
  // the bundle and the manifest the member names are ignored where they are built
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--', marker.bundle.outfile, marker.bundle.manifest],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(ignored, [marker.bundle.outfile, marker.bundle.manifest]);
  // control: the .gitignore itself is not ignored
  assert.throws(() => execFileSync('git', ['check-ignore', '--no-index', '-q', '--', '.gitignore'], { cwd: DIST, stdio: 'ignore' }));
});

test('R43 scripts/build.mjs builds the bundle and its manifest into dist/, the manifest naming the bundle\'s bytes', async () => {
  const { built, manifest, bundlePath, manifestPath } = await buildAgentRunner();
  assert.ok(existsSync(bundlePath) && existsSync(manifestPath));
  const bytes = readFileSync(bundlePath);
  assert.ok(bytes.equals(built.bytes), 'the written bundle is the built one');
  const onDisk = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(onDisk, manifest);
  assert.equal(onDisk.sha256, built.sha256);
  assert.equal(onDisk.bytes, bytes.length);
  // building again gives the same bytes (the recipe is deterministic)
  const again = await buildAgentRunner();
  assert.equal(again.built.sha256, built.sha256);
});
