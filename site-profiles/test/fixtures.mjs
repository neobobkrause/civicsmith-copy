/* Fixtures for site-profiles' requirement-named tests: HTML captures for the stack
 * axis, in the shapes the handlers were measured on. No place is named in them.
 */

const vs = (/** @type {string} */ v) => `<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${v}" />`;

/** A meeting calendar served by ASP.NET WebForms (CERTAIN), in the record vendor's
 *  page shape; `rows` are [id, body, "M/D/YYYY"]. `header` is the site furniture
 *  outside the document's <main> boundary.
 *  @param {string[][]} rows
 *  @param {{ state?: string, header?: string, nonce?: string }} [opts]
 *  @returns {string} */
export function calendarHtml(rows, { state = "abc", header = "site header", nonce = "n1" } = {}) {
  const tr = rows.map(([id, body, date]) =>
    `<tr><td><a href="MeetingDetail.aspx?ID=${id}&amp;GUID=x">${body}</a></td><td>${date}</td></tr>`).join("\n");
  return `<html><head><title>Calendar</title><script nonce="${nonce}"></script></head>`
    + `<body><form id="aspnetForm">${vs(state)}
<div id="ctl00_divTop">${header}</div>
<main id="mainContent" role="main">
<table>${tr}</table>
</main></form></body></html>`;
}

/** A WordPress article; `nav` is the site navigation outside the article.
 *  @param {{ nav?: string, body?: string }} [opts]
 *  @returns {string} */
export function wordpressArticle({ nav = "Home | News", body = "The harbor reopened today." } = {}) {
  return `<html><head><meta name="generator" content="WordPress 6.5" />
<link rel="stylesheet" href="/wp-content/themes/x/style.css?ver=1.2" /></head>
<body><nav>${nav}</nav><article><h1>Harbor</h1><p>${body}</p></article>
<footer>© the paper</footer></body></html>`;
}

/** A client-rendered shell: an empty mount point, a framework marker, no prose.
 *  @param {string} [stamp]
 *  @returns {string} */
export function shellHtml(stamp = "1") {
  return `<html><head><script src="/app.${stamp}.js"></script></head><body>`
    + `<div id="root"></div><script>window.__INITIAL_STATE__={}</script>`
    + "<!--" + "x".repeat(2400) + "-->" + `</body></html>`;
}

/** A page nothing recognises.
 *  @param {{ nav?: string, body?: string, nonce?: string }} [opts]
 *  @returns {string} */
export function plainHtml({ nav = "Home", body = "The harbor.", nonce = "n1" } = {}) {
  return `<html><body><script nonce="${nonce}"></script><nav>${nav}</nav><p>${body}</p>`
    + `<a href="/">home</a></body></html>`;
}
