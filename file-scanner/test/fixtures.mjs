/* Fixtures file-scanner publishes for the tests of other modules (fixtures rule, K4990): each is made by this
 * module's real code when the test runs, never stored. */
import { handle } from '../src/handler.mjs';
import { memoryBucket, depsWith, post } from './helpers.mjs';
import { vendorNet, specs } from './vendors.mjs';

/** The real reputation provider's refresh answer `{ok:false, list_version, fetched_at, error}` for a Web Risk list that
 *  fails: `failure` is `'checksum'` (the list's checksum does not hold: `LIST_CHECKSUM_MISMATCH:<threat>`) or
 *  `'unreadable'` (the list cannot be read: `LIST_UNREADABLE`). After one good refresh, so `list_version` and
 *  `fetched_at` are those of the last good list; `prior: false` refreshes with no good list before it (both null). */
export async function reputationRefresh(failure, { prior = true } = {}) {
  const state = {};
  const net = vendorNet(state);
  const deps = depsWith({ bucket: memoryBucket(), fetch: net.fetch });
  const tool = specs()['google-web-risk'];
  const refresh = async () => (await handle(post('/provider/refresh', { tool }), deps)).json();
  if (prior) await refresh();
  if (failure === 'checksum') state.badChecksum = true;
  else if (failure === 'unreadable') state.unreadable = true;
  else throw new Error(`reputationRefresh: no failure named ${failure}`);
  return refresh();
}
