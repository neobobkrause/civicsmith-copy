// @ts-check
/* record-grammar: the public-locator test (R19). Moved from the check catalogue at T18 with its comment. */

/** https-only, public hosts only (intake doctrine 0.7): forecloses lookalike
 *  origins and SSRF-shaped locators alike. The one canonical implementation;
 *  the accelerator's daemon delegates to this through the embedded gate.
 *  It judges the TEXT only (Intake Doctrine §4): what a name resolves to is the
 *  fetcher's to check. The scheme is case-insensitive, as a URL's is; the host is
 *  judged with its port dropped, lower-cased and one trailing dot dropped, so
 *  `localhost.` is `localhost`; `.local` (mDNS) and `.localhost` names are never
 *  public.
 * @param {unknown} url
 * @returns {boolean} */
export function isPublicHttpsLocator(url) {
  if (typeof url !== 'string') return false;
  const m = /^https:\/\/([^/?#]+)/i.exec(url);
  if (!m) return false;
  const hostport = m[1] ?? '';
  if (hostport.indexOf('@') !== -1) return false;
  if (hostport.charAt(0) === '[') return false;
  let host = (hostport.split(':')[0] ?? '').toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  if (host.indexOf('.') === -1) return false;
  return true;
}
