// Builds the Worker bundle once per test process (R36: `dist/` holds no committed bundle) by the module's own build
// script, then loads it under Node, `cloudflare:*` resolved to the stubs beside this file.
import * as nodeModule from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUBS = { 'cloudflare:workers': new URL('./cloudflare-workers.mjs', import.meta.url).href,
  'cloudflare:sockets': new URL('./cloudflare-sockets.mjs', import.meta.url).href };
if (nodeModule.registerHooks) {
  nodeModule.registerHooks({ resolve: (specifier, context, next) =>
    (STUBS[specifier] ? { url: STUBS[specifier], shortCircuit: true } : next(specifier, context)) });
} else {
  nodeModule.register(new URL('./loader.mjs', import.meta.url));
}

const MEMBER = fileURLToPath(new URL('../../', import.meta.url));
let builtOnce = false;

/** R36: builds `dist/`'s bundle and manifest by `scripts/build.mjs`, as a deployment or a release does; once per
 *  process. Its output is the build's own two lines.
 * @returns {string} */
export function buildBundle() {
  if (builtOnce) return '';
  const out = execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: MEMBER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  builtOnce = true;
  return out;
}

/** The built Worker bundle, loaded under Node; built first when this process has not built it.
 * @returns {Promise<*>} */
export const loadWorker = () => { buildBundle(); return import('../../dist/file-scanner.bundled.mjs'); };
