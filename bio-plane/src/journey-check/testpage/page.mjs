/* journey-check F5: the fixed test page a live walk captures by address (R9 step 5), so the walk depends on no site we do not
   control. The Worker `<slug>-testpage` (the copy `p3dev-t1`'s is `p3dev-t1-testpage`) serves the stub city's two notices (city.mjs, the local arm's own pages) at their
   paths, and answers 404 to anything else, as a council's site does. Its source is built here from city.mjs, one file with no
   import, no binding and no secret. */
import { NOTICE_PATH, NOTICE_HTML, HEAT_PATH, HEAT_HTML } from "../city.mjs";

export const TESTPAGE_SUFFIX = "-testpage";
/* `slug` is the copy's whole Worker name (`p3dev-t1`), as `deploy dev` passes it: the test page is `p3dev-t1-testpage` */
export const testpageName = (slug) => `${slug}${TESTPAGE_SUFFIX}`;
export const PAGES = Object.freeze({ [NOTICE_PATH]: NOTICE_HTML, [HEAT_PATH]: HEAT_HTML });
export const LAST_MODIFIED = "Fri, 02 Oct 2026 09:00:00 GMT";

/* The Worker's module source: a fetch handler over `PAGES`. */
export function testpageSource(pages = PAGES) {
  return `/* journey-check F5: the walk's fixed test page (built by bio-plane/src/journey-check/testpage/page.mjs; no binding, no secret) */
const PAGES = ${JSON.stringify(pages)};
export default {
  async fetch(req) {
    const u = new URL(req.url);
    const html = Object.prototype.hasOwnProperty.call(PAGES, u.pathname) ? PAGES[u.pathname] : null;
    if (html !== null && (req.method === "GET" || req.method === "HEAD"))
      return new Response(req.method === "HEAD" ? null : html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "last-modified": ${JSON.stringify(LAST_MODIFIED)} } });
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  },
};
`;
}
