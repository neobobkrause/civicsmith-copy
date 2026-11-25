/* answer-envelope R6 (was control-plane R51; DEC-122 (3); N528; F17, K1881), R16 (T47; N1002, N1001): every `text/html`
   response the plane serves (since T47 `interface-shell`'s `interfacePage` at `/` and `/app/*`, the setup page no longer
   served) leaves `withPagePolicy` with a policy under which a browser loads no
   script, style, font, image or connection from another origin and sends nothing elsewhere, and a `script-src` of the
   response's own fresh nonce alone; every script element of the page served carries that nonce. The policy is parsed
   and judged directive by directive, never matched as text. Driven at this module's interface over the pages' real
   bytes; the door's routes call it from control-plane (its T35 job). `interfacePage` is a later module's (`interface-shell`,
   after this one in `build/modules.json`), so it cannot be imported here: its page is driven in the shape its R1-R3 give it
   (one stylesheet of its own origin, one inline style, one script carrying `NONCE_SLOT`, its own `</script` escaped), and
   the policy over its real bytes at `/` is `control-plane` R82's test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M } from "./load.mjs";

/* A policy's directives, `{name: [sources]}`. */
const parse = (header) => Object.fromEntries(String(header || "").split(";").map((d) => d.trim()).filter(Boolean)
  .map((d) => { const [name, ...sources] = d.split(/\s+/); return [name.toLowerCase(), sources]; }));
/* The effective sources for a fetch directive (its own, else default-src's). */
const sourcesFor = (p, name) => p[name] ?? p["default-src"];
/* A source admits only this origin when it is a keyword other than a wildcard, or `data:` (no network); for images
   also `blob:`, an object address the page makes itself (R6, K3156). */
const OWN = ["'self'", "'none'", "'unsafe-inline'", "data:"];
const ownOnly = (sources, extra = []) => Array.isArray(sources) && sources.length > 0 && sources.every((s) =>
  OWN.includes(s) || extra.includes(s));
const NONCE_SOURCE = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;
/* A text with each script start tag's nonce attribute removed. */
const unNonced = (html) => html.replace(/<script\b[^>]*>/gi, (tag) => tag.replace(/\snonce(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/gi, ""));
/* Every script start tag of an HTML text, as the browser's tokeniser finds it in these pages. */
const scriptTags = (html) => html.match(/<script\b[^>]*>/gi) || [];

/* The judge: the policy admits no other origin anywhere, `script-src` is one nonce and nothing else (no 'self', no host,
   no 'unsafe-inline', no 'unsafe-eval'), and every script element of the body carries that nonce. Answers the nonce. */
function judge(header, body, where) {
  assert.equal(typeof header, "string", `${where}: no policy`);
  const p = parse(header);
  for (const d of ["style-src", "font-src", "connect-src", "frame-src", "worker-src", "media-src", "object-src",
                   "manifest-src"])
    assert.ok(ownOnly(sourcesFor(p, d)), `${where}: ${d} = ${sourcesFor(p, d)}`);
  /* images: this origin, `data:` and `blob:` (R6, K3156), nothing else */
  assert.ok(ownOnly(sourcesFor(p, "img-src"), ["blob:"]), `${where}: img-src = ${sourcesFor(p, "img-src")}`);
  /* nothing is sent elsewhere: a form posts only here, and no <base> can redirect relative addresses */
  assert.ok(ownOnly(p["form-action"]), `${where}: form-action`);
  assert.ok(ownOnly(p["base-uri"]), `${where}: base-uri`);
  assert.equal(Object.values(p).flat().includes("'unsafe-eval'"), false, `${where}: unsafe-eval`);
  const script = p["script-src"];
  assert.ok(Array.isArray(script) && script.length === 1 && NONCE_SOURCE.test(script[0]), `${where}: script-src = ${script}`);
  const nonce = NONCE_SOURCE.exec(script[0])[1];
  const tags = scriptTags(body);
  for (const tag of tags) {
    const carried = [...tag.matchAll(/\snonce\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
    assert.deepEqual(carried, [nonce], `${where}: ${tag}`);
  }
  return { nonce, scripts: tags.length };
}

const html = (text, init = {}) => new Response(text, { status: init.status ?? 200,
  headers: { "content-type": "text/html; charset=utf-8", ...(init.headers || {}) } });
/* `interfacePage`'s document as `interface-shell` R1 composes it: the program inline under the slot, any `</script` and
   `<!--` inside it escaped. */
const interfaceShaped = (screen) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title></title>
<link rel="stylesheet" href="/app/assets/civicsmith.css">
<style>.cs{margin:0}</style>
</head>
<body class="cs">
<div id="cs-root"></div>
<div class="cs-tip" id="cs-tip" role="tooltip" hidden></div>
<script nonce="${M.NONCE_SLOT}">((d, s, w) => ({ start() { w.cs = { screen: ${JSON.stringify(screen)}, t: "<\\/script>" }; } }))({}, [], window).start();</script>
</body>
</html>
`;
const pages = () => [["interfacePage at /", interfaceShaped("front")],
                     ["interfacePage at /app/home", interfaceShaped("home")], ["interfacePage at /app/settings", interfaceShaped("settings")]];

test("R6, R16: `interfacePage` (at `/` and at `/app/*`; the setup page no longer served), each served twice, carry a policy naming no other origin, a script-src of a fresh nonce alone (no 'unsafe-inline', no 'self', no host), two different nonces, and every script element of each body carrying its response's nonce; the pages are otherwise byte for byte as shipped (negative controls: the judge refuses another origin, an inline allowance, a second source and a script without the nonce)", async () => {
  for (const [where, page] of pages()) {
    const before = scriptTags(page).length;
    assert.ok(before >= 1, `${where} ships a script`);
    const seen = [];
    for (let i = 0; i < 2; i++) {
      const r = await M.withPagePolicy(html(page, { headers: { "cache-control": "no-store" } }));
      assert.equal(r.status, 200, where);
      assert.match(r.headers.get("content-type"), /^text\/html/, where);
      assert.equal(r.headers.get("cache-control"), "no-store", `${where}: the page's own headers are kept`);
      const body = await r.text();
      const { nonce, scripts } = judge(r.headers.get("content-security-policy"), body, `${where} #${i + 1}`);
      assert.equal(scripts, before, `${where}: no script element added or lost`);
      /* only the nonce moved: the script elements' nonce attributes, and the page's NONCE_SLOT wherever it stands */
      assert.equal(body.includes(M.NONCE_SLOT), false, `${where}: no slot left unfilled`);
      assert.equal(unNonced(body), unNonced(page.replaceAll(M.NONCE_SLOT, nonce)), `${where}: nothing else of the page changed`);
      seen.push(nonce);
    }
    assert.notEqual(seen[0], seen[1], `${where}: two responses, two nonces`);
  }
  /* negative controls: the judge refuses each way the policy or the page could fall short */
  const rest = "base-uri 'none'; form-action 'self'";
  const ok = `default-src 'self'; ${rest}; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='`;
  const good = '<script nonce="AAAAAAAAAAAAAAAAAAAAAA==">x()</script>';
  assert.doesNotThrow(() => judge(ok, good, "control"));
  for (const [bad, body] of [[`default-src 'self'; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA==' https://cdn.example; ${rest}`, good],
                             [`default-src 'self'; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA==' 'unsafe-inline'; ${rest}`, good],
                             [`default-src 'self'; script-src 'self' 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='; ${rest}`, good],
                             [`default-src 'self'; script-src 'self' 'unsafe-inline'; ${rest}`, good],
                             [`default-src *; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='; ${rest}`, good],
                             [`default-src 'self' https://x.example; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='; ${rest}`, good],
                             [`default-src 'self'; connect-src 'self' wss://x.example; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='; ${rest}`, good],
                             [`default-src 'self'; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA==' 'unsafe-eval'; ${rest}`, good],
                             [`default-src 'self'; ${rest}`, good],
                             [ok, "<script>x()</script>"], [ok, '<script nonce="BBBBBBBBBBBBBBBBBBBBBB==">x()</script>'],
                             [ok, `${good}<script>y()</script>`]])
    assert.throws(() => judge(bad, body, "bad"), undefined, `${bad} | ${body}`);
});

test("R6 (K3156; interface-shell R49): every HTML response's img-src is exactly 'self' data: blob:, so an image the page makes from bytes it holds (an object address) is drawn and no other origin is; no other directive admits blob: or another origin (negative controls: the judge refuses blob: in connect-src or script-src, and a host or wildcard in img-src)", async () => {
  for (const [where, page] of pages()) {
    const r = await M.withPagePolicy(html(page));
    const header = r.headers.get("content-security-policy");
    const p = parse(header);
    assert.deepEqual(p["img-src"], ["'self'", "data:", "blob:"], where);
    for (const [name, sources] of Object.entries(p)) if (name !== "img-src") assert.equal(sources.includes("blob:"), false, `${where}: ${name}`);
    assert.equal(/https?:|wss?:|\*/.test(header), false, `${where}: no other origin in ${header}`);
    judge(header, await r.text(), where);
  }
  const rest = "base-uri 'none'; form-action 'self'; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA=='";
  const good = '<script nonce="AAAAAAAAAAAAAAAAAAAAAA==">x()</script>';
  assert.doesNotThrow(() => judge(`default-src 'self'; img-src 'self' data: blob:; ${rest}`, good, "control"));
  for (const bad of [`default-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; ${rest}`,
                     `default-src 'self' blob:; img-src 'self' data: blob:; ${rest}`,
                     `default-src 'self'; img-src 'self' https://img.example; ${rest}`,
                     `default-src 'self'; img-src *; ${rest}`])
    assert.throws(() => judge(bad, good, "bad"), undefined, bad);
  assert.throws(() => judge(`default-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAA==' blob:`, good, "bad"));
});

test("R6: each nonce is 128 bits from the CSPRNG, fresh for every response (no two of 2,000 the same), in CSP's nonce grammar", async () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const r = await M.withPagePolicy(html("<script>1</script>"));
    const [, nonce] = NONCE_SOURCE.exec(parse(r.headers.get("content-security-policy"))["script-src"][0]);
    assert.equal(Buffer.from(nonce, "base64").length, 16, nonce);
    assert.equal(seen.has(nonce), false, nonce);
    seen.add(nonce);
    assert.equal(await r.text(), `<script nonce="${nonce}">1</script>`);
  }
});

test("R6: every script element of any page is given the response's nonce, whatever it carried (a slot such as interfacePage's NONCE_SLOT (interface-shell R1, was setup-page R28), another nonce, an unquoted or bare nonce), with its other attributes kept; a comment and a script's own text are passed over, so a string spelling `<script` inside a script is not a tag (negative control: an HTML answer a hook serves, at any status, is stamped the same)", async () => {
  const page = '<!doctype html><!-- <script>not a tag</script> --><SCRIPT type="module" nonce="NONCE_SLOT">'
    + 'const s = "<script>"; document.write("<script nonce=x>")</SCRIPT>'
    + "<p data-x='<script>'>t</p><script nonce=old src=\"/a.js\" defer></script><script nonce></script>"
    + '<script data-a=">" >2</script>';
  const r = await M.withPagePolicy(html(page, { status: 404 }));
  assert.equal(r.status, 404);
  const [, n] = NONCE_SOURCE.exec(parse(r.headers.get("content-security-policy"))["script-src"][0]);
  assert.equal(await r.text(),
    `<!doctype html><!-- <script>not a tag</script> --><script nonce="${n}" type="module">`
    + 'const s = "<script>"; document.write("<script nonce=x>")</SCRIPT>'
    + `<p data-x='<script>'>t</p><script nonce="${n}" src="/a.js" defer></script><script nonce="${n}"></script>`
    + `<script nonce="${n}" data-a=">" >2</script>`);
  /* a page with no script still carries the policy, with nothing added to its bytes */
  const plain = await M.withPagePolicy(html("<!doctype html><p>x</p>", { status: 500 }));
  assert.equal(plain.status, 500);
  assert.equal(await plain.text(), "<!doctype html><p>x</p>");
  judge(plain.headers.get("content-security-policy"), "", "no script");
});

test("R6 (interface-shell R1, R2, was setup-page R28; K2038): every NONCE_SLOT (`__CSP_NONCE__`) in an HTML body served is the response's nonce, in a script element's nonce attribute and wherever else the page holds it, and no slot is left (negative control: a JSON answer holding the literal is not touched)", async () => {
  assert.equal(M.NONCE_SLOT, "__CSP_NONCE__");
  const page = `<!doctype html><script nonce="${M.NONCE_SLOT}">const s = document.createElement("script"); s.nonce = "${M.NONCE_SLOT}";</script>`
    + `<p>${M.NONCE_SLOT}</p><script type="module" nonce='${M.NONCE_SLOT}'>1</script>`;
  for (let i = 0; i < 2; i++) {
    const r = await M.withPagePolicy(html(page));
    const body = await r.text();
    const { nonce, scripts } = judge(r.headers.get("content-security-policy"), body, "slots");
    assert.equal(scripts, 2);
    assert.equal(body.includes(M.NONCE_SLOT), false);
    assert.equal(body, `<!doctype html><script nonce="${nonce}">const s = document.createElement("script"); s.nonce = "${nonce}";</script>`
      + `<p>${nonce}</p><script nonce="${nonce}" type="module">1</script>`);
  }
  const j = M.json({ ok: true, v: M.NONCE_SLOT });
  assert.equal(await M.withPagePolicy(j), j);
});

test("R6: a response that is not text/html leaves exactly as it came, with no policy: JSON, plain text, bytes, a 204 and no response at all", async () => {
  const cases = [M.json({ ok: true }), new Response("1.0.0\n", { headers: { "content-type": "text/plain" } }),
                 new Response(new Uint8Array([1, 2]), { headers: { "content-type": "application/pdf" } }),
                 new Response(null, { status: 204 }), new Response("<script>x</script>", { headers: { "content-type": "application/xhtml+xml" } })];
  for (const res of cases) {
    const out = await M.withPagePolicy(res);
    assert.equal(out, res);
    assert.equal(out.headers.get("content-security-policy"), null);
  }
  for (const none of [null, undefined]) assert.equal(await M.withPagePolicy(none), none);
});

test("R6, R5: an HTML body that cannot be read is answered PLANE_INTERNAL_ERROR with a correlation id, never the page and never a stack", async () => {
  const broken = new Response(new ReadableStream({ pull(c) { c.error(new Error("SECRET /srv/x.mjs:1")); } }),
                              { headers: { "content-type": "text/html" } });
  const logged = [], was = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  let r;
  try { r = await M.withPagePolicy(broken); } finally { console.error = was; }
  assert.equal(r.status, 500);
  const text = await r.text();
  const j = JSON.parse(text);
  assert.deepEqual([j.reason, j.code, j.check], ["PLANE_INTERNAL_ERROR", "PLANE_INTERNAL_ERROR", "C-69.3"]);
  assert.equal(text.includes("SECRET") || text.includes("/srv/"), false);
  assert.equal(logged.length, 1);
  assert.equal(JSON.parse(logged[0]).correlation, j.correlation);
});

/* R6 (fix round 3, C15, P2.4; K4359): the interface page carries no inline script, so its policy names the shell's versioned script by its
   hash and carries no nonce; other HTML keeps its nonce. */
import { createHash } from "node:crypto";
const SHELL_JS = "(function(){ window.cs = 1; })();";
const HASH = "sha256-" + createHash("sha256").update(SHELL_JS).digest("base64");
const hashPage = `<!doctype html><html lang="en"><head><link rel="stylesheet" href="/app/assets/civicsmith.css"><style>.cs{margin:0}</style></head><body class="cs"><div id="cs-root"></div><script src="/app/shell-1.js" integrity="${HASH}"></script></body></html>`;
const HASH_SOURCE = /^'(sha256-[A-Za-z0-9+/]{43}=)'$/;

test("R6 (K4359) a page with no inline script and the script's hash handed in is answered `script-src 'self'` with that hash and no nonce, the bytes of the page unchanged; the script's bytes hash to the policy's hash; no other origin, 'unsafe-inline' or 'unsafe-eval'", async () => {
  for (let i = 0; i < 2; i++) {
    const r = await M.withPagePolicy(html(hashPage, { headers: { "cache-control": "no-store" } }), { scriptHashes: [HASH] });
    assert.equal(r.headers.get("cache-control"), "no-store");
    const header = r.headers.get("content-security-policy");
    const p = parse(header);
    assert.deepEqual(p["script-src"].slice(0, 1), ["'self'"]);
    const named = p["script-src"].slice(1).map((s) => HASH_SOURCE.exec(s)[1]);
    assert.deepEqual(named, [HASH]);
    assert.equal(/nonce/.test(header), false, "no nonce");
    assert.equal(createHash("sha256").update(SHELL_JS).digest("base64"), named[0].slice(7), "the script's bytes hash to it");
    assert.equal(await r.text(), hashPage, "the page is byte for byte as shipped");
    for (const [name, sources] of Object.entries(p)) if (name !== "img-src") assert.equal(sources.some((s) => /unsafe-eval|\*|https?:/.test(s)), false, name);
    assert.equal(p["script-src"].includes("'unsafe-inline'"), false);
    for (const d of ["style-src", "font-src", "connect-src", "object-src"]) assert.ok(ownOnly(sourcesFor(p, d)), d);
  }
});

test("R6 (K4359) control: another HTML route keeps its nonce; a page that still carries an inline script keeps it even when a hash is handed in; no hashes, or a malformed one, keep it", async () => {
  const inline = '<!doctype html><script>x()</script>';
  for (const [page, opts] of [[inline, { scriptHashes: [HASH] }], [hashPage, {}], [hashPage, { scriptHashes: [] }], [hashPage, { scriptHashes: ["sha256-short"] }],
                              [hashPage, { scriptHashes: [HASH, "nope"] }], [`<!doctype html><script nonce="${M.NONCE_SLOT}" src="/a.js"></script>`, { scriptHashes: [HASH] }]]) {
    const r = await M.withPagePolicy(html(page), opts);
    const body = await r.text();
    const { nonce } = judge(r.headers.get("content-security-policy"), body, "control");
    assert.ok(nonce);
  }
});
