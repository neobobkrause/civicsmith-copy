// Loads the committed Worker bundle under Node, `cloudflare:*` resolved to the stubs beside this file.
import * as nodeModule from 'node:module';

const STUBS = { 'cloudflare:workers': new URL('./cloudflare-workers.mjs', import.meta.url).href,
  'cloudflare:sockets': new URL('./cloudflare-sockets.mjs', import.meta.url).href };
if (nodeModule.registerHooks) {
  nodeModule.registerHooks({ resolve: (specifier, context, next) =>
    (STUBS[specifier] ? { url: STUBS[specifier], shortCircuit: true } : next(specifier, context)) });
} else {
  nodeModule.register(new URL('./loader.mjs', import.meta.url));
}

export const loadWorker = () => import('../../dist/file-scanner.bundled.mjs');
