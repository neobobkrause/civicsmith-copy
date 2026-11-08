/* control-plane R75 (T46; N897 (1); DEC-122 (3); N559): the member interface's routes, driven through `makeFetch(hooks)` over
   the harness's store: `GET /app` and `/app/<path>` answer interface-shell's page over the four screen modules' screens,
   under answer-envelope's page policy naming the shell's script by its hash (fix round 3, C15); `GET /app/assets/<name>` answers interface-assets' files. The
   end-to-end suite over Miniflare and the real plane is `t46-e2e.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import "./register-declared.mjs";
import { world, call, refused } from "./harness.mjs";
const { appPage } = await import("../../../src/control-plane/app.mjs");
const { interfacePage } = await import("../../../src/interface-shell/index.mjs");
const { ASSET_FILES } = await import("../../../src/interface-assets/index.mjs");
const { SCREENS: S1 } = await import("../../../src/screens-settings/index.mjs");
const { SCREENS: S2 } = await import("../../../src/screens-intake/index.mjs");
const { SCREENS: S3 } = await import("../../../src/screens-daily/index.mjs");
const { SCREENS: S4 } = await import("../../../src/screens-inquiry/index.mjs");
const { SCREENS: E } = await import("../../../src/screens-entry/index.mjs");
const { SCREENS: W, GUIDE } = await import("../../../src/screens-wizards/index.mjs");
const { SCREENS: I } = await import("../../../src/screens-investigate/index.mjs");
const { SCREENS: P } = await import("../../../src/screens-publish/index.mjs");
const { SCREENS: A } = await import("../../../src/screens-action/index.mjs");
const { SCREENS: AI } = await import("../../../src/screens-ai/index.mjs");
/* R81 (T47; K3137, K3169): the five screen modules T47 adds, and screens-wizards' guide (interface-shell R31) */
/* and screens-ai's, which the door serves after them (BOB's found mark, 7 Nov; screens-ai PR 881) */
const NINE = [...E, ...S1, ...S2, ...S3, ...S4, ...W, ...I, ...P, ...A, ...AI];

const { interfaceScript, interfaceScriptHash, scriptPath } = await import("../../../src/interface-shell/index.mjs");
const SCRIPT = /<script\b[^>]*>/gi;
const HASHED = /^'sha256-([A-Za-z0-9+/]{43}=)'$/;
/* R75 (fix round 3, C15, P2.4): the page policy names the shell's script by its hash and this origin, in place of a nonce */
const policyHashes = (r) => {
  const csp = r.headers.get("content-security-policy") || "";
  const d = Object.fromEntries(csp.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const [n, ...v] = x.split(/\s+/); return [n, v]; }));
  for (const k of ["default-src", "style-src", "font-src", "img-src", "connect-src"])
    assert.ok((d[k] ?? d["default-src"]).every((s) => ["'self'", "'unsafe-inline'", "data:", "'none'", ...(k === "img-src" ? ["blob:"] : [])]
      .includes(s)), `${k}: ${d[k]}`);
  /* (T47; K3164; answer-envelope R6) `blob:` in `img-src` alone */
  for (const [k, v] of Object.entries(d)) if (k !== "img-src") assert.equal(v.includes("blob:"), false, `${k} admits blob:`);
  const src = d["script-src"] ?? [];
  assert.equal(src[0], "'self'", "this origin, for the script's own address");
  assert.equal(src.some((s) => /^'nonce-/.test(s) || s === "'unsafe-inline'" || s === "'unsafe-eval'"), false, `no nonce, no unsafe: ${src}`);
  return src.slice(1).map((s) => s.match(HASHED)[1]);
};
const fetchRaw = async (env, path, headers = {}, method = "GET") => {
  const { makeFetch } = await import("../../../src/control-plane/index.mjs");
  return makeFetch({})(new Request(`https://plane.example${path}`, { method, headers }), env);
};

test("R75, R81 (T46, T47; N897 (1); K3137; fix round 3, C15, P2.4): `GET /app` and `GET /app/<path>` answer interface-shell's page over the nine screen modules' screens (entry, settings, intake, daily, inquiry, wizards, investigate, publish, action) with screens-wizards' guide, `text/html`, `cache-control: no-store`, under a page policy that names the shell's script by its hash in place of a nonce; the page loads one external script at the release's address, carries no inline script and no nonce, and is the same for every path below `/app` (the routing is the page's own); no store is asked and no credential read, a presented session changing nothing", async () => {
  const { env, S } = world();
  const options = { guide: GUIDE, version: env.VERSION };
  const want = interfacePage(NINE, options);
  const hash = interfaceScriptHash(NINE, options);
  /* control: the four T46 modules alone are not the page served */
  const four = interfacePage([...S1, ...S2, ...S3, ...S4], { version: env.VERSION });
  for (const [path, headers] of [["/app", {}], ["/app/", {}], ["/app/home", {}], ["/app/project/PRJ-1", {}], ["/app/no-such-screen", {}],
                                 ["/app", { authorization: `Bearer ${S.ann}` }]]) {
    env.calls.length = 0;
    const r = await call(env, { path, headers });
    assert.equal(r.status, 200, `${path}: ${r.text.slice(0, 200)}`);
    assert.match(r.headers.get("content-type"), /^text\/html/);
    assert.equal(r.headers.get("cache-control"), "no-store", "the page keeps no-store");
    assert.deepEqual(policyHashes(r), [hash.slice("sha256-".length)], `${path}: the policy names the script's hash`);
    const tags = r.text.match(SCRIPT) || [];
    assert.equal(tags.length, 1, `${path}: one script element`);
    assert.ok(tags[0].includes(`src="${scriptPath(env.VERSION)}"`) && tags[0].includes(`integrity="${hash}"`), tags[0]);
    assert.equal(/\bnonce\b/.test(r.text) || r.text.includes("__CSP_NONCE__"), false, "no nonce, no slot");
    assert.equal(r.text, want, `${path}: interface-shell's page over the nine modules' screens and the guide`);
    assert.notEqual(r.text, four);
    assert.ok(r.text.includes(`href="/app/assets/civicsmith.css"`));
    assert.deepEqual(env.calls, [], `${path}: no store asked, no credential read`);
  }
});

test("R75 (fix round 3, C15, P2.4; interface-shell R1): the shell's script is served at the address that carries the release version, `text/javascript` with `cache-control: public, max-age=31536000, immutable`; its bytes are interface-shell's `interfaceScript` and hash to the value the page policy names; a second load is served the same bytes with the same `immutable` header (a caller that holds it is not sent it again); the page itself keeps `no-store`, and the assets and an op's answer carry no `immutable` (negative controls: another release's address is 404, a HEAD has no body, a POST is no script)", async () => {
  const { env, S } = world();
  const options = { guide: GUIDE, version: env.VERSION };
  const source = interfaceScript(NINE, options);
  const hash = interfaceScriptHash(NINE, options);
  const at = scriptPath(env.VERSION);
  assert.equal(at, "/app/shell-9.8.7.js");
  const page = await fetchRaw(env, "/app");
  const policy = policyHashes(page);
  for (const round of [1, 2]) {
    env.calls.length = 0;
    const r = await fetchRaw(env, at);
    assert.equal(r.status, 200, `load ${round}`);
    assert.match(r.headers.get("content-type"), /^text\/javascript/);
    assert.equal(r.headers.get("cache-control"), "public, max-age=31536000, immutable", `load ${round}`);
    const body = await r.text();
    assert.equal(body, source, "interface-shell's script, unchanged");
    assert.equal("sha256-" + createHash("sha256").update(body).digest("base64"), hash);
    assert.deepEqual([hash.slice("sha256-".length)], policy, "the script's hash is the one the page policy names");
    assert.deepEqual(env.calls, [], "no store asked, no credential read");
  }
  /* the same under the namespace and address gates as the page (admission R1, R20) */
  refused(await call(env, { path: at, params: { store: "elsewhere" } }), 400, "NAMESPACE_UNKNOWN", "C-78.1");
  refused(await call(env, { path: at, params: { token: env.ADMIN_TOKEN } }), 400, "CREDENTIAL_IN_ADDRESS", "C-38.10");
  /* controls */
  assert.equal(page.headers.get("cache-control"), "no-store");
  const asset = await fetchRaw(env, "/app/assets/civicsmith.css");
  assert.equal(asset.headers.get("cache-control"), "no-cache");
  const op = await call(env, { op: "whoami", token: S.ann });
  assert.equal((op.headers.get("cache-control") ?? "").includes("immutable"), false, "an op's answer is not kept");
  assert.equal((await fetchRaw(env, "/app/shell-1.0.0.js")).status, 404, "another release's address");
  assert.equal((await fetchRaw({ ...env, VERSION: "1.0.0" }, at)).status, 404, "a script is served at its own release's address only");
  assert.equal((await fetchRaw({ ...env, VERSION: "1.0.0" }, "/app/shell-1.0.0.js")).status, 200, "and a new release has a new address");
  const head = await fetchRaw(env, at, {}, "HEAD");
  assert.deepEqual([head.status, (await head.text()).length, head.headers.get("cache-control")], [200, 0, "public, max-age=31536000, immutable"]);
  const posted = await call(env, { path: at, method: "POST", body: {} });
  assert.notEqual(posted.headers.get("content-type")?.startsWith("text/javascript"), true);
});

test("R81 (T47; interface-shell R30): a public-frame screen's address — `/app/doorbell`, `/app/published/<case>` — is served the same page, no credential read and no store asked, with or without a session presented; every screen id the nine modules register is drawn by the page's script", async () => {
  const { env, S } = world();
  const page = (await call(env, { path: "/app" })).text;
  for (const [path, headers] of [["/app/doorbell", {}], ["/app/published/CASE-2026-1", {}], ["/app/doorbell", { authorization: `Bearer ${S.ann}` }]]) {
    env.calls.length = 0;
    const r = await call(env, { path, headers });
    assert.equal(r.status, 200, path);
    assert.equal(r.text, page, path);
    assert.deepEqual(env.calls, [], `${path}: nothing read`);
  }
  const script = await (await fetchRaw(env, scriptPath(env.VERSION))).text();
  for (const id of new Set(NINE.map((sc) => sc.id))) assert.ok(script.includes(JSON.stringify(id)), `${id} is in the page's script`);
  for (const id of ["doorbell", "published", "front"]) assert.ok(NINE.some((sc) => sc.id === id), `${id} is registered`);
});

test("R75: `/app` takes the namespace and address gates `/` takes (admission R1, R20): an unknown `store=` is NAMESPACE_UNKNOWN (C-78.1) and a credential in the address CREDENTIAL_IN_ADDRESS (C-38.10), on the page and on an asset, nothing served; `store=scratch` serves the same page (negative control); a POST to `/app` is no page (it reaches the op door, an op named `app` there being unknown)", async () => {
  const { env } = world();
  for (const path of ["/app", "/app/home", "/app/assets/icons.svg"]) {
    refused(await call(env, { path, params: { store: "elsewhere" } }), 400, "NAMESPACE_UNKNOWN", "C-78.1");
    refused(await call(env, { path, params: { token: env.ADMIN_TOKEN } }), 400, "CREDENTIAL_IN_ADDRESS", "C-38.10");
    const ok = await call(env, { path, params: { store: "scratch" } });
    assert.equal(ok.status, 200, path);
  }
  const posted = await call(env, { path: "/app", method: "POST", body: {} });
  assert.notEqual(posted.headers.get("content-type")?.startsWith("text/html"), true);
  assert.equal(posted.json.ok, false);
});

test("R75: `GET /app/assets/<name>` answers every file of interface-assets' map with its content type and its bytes (a face's decoded from base64), `cache-control: no-cache` and an `etag` of the plane's version and the name, answered 304 with no body when the browser presents that etag and the version is unchanged, and the file again once the version moves; any other name is 404 with nothing of the record's (negative controls: a name not in the map, a near name, a path out of the folder)", async () => {
  const { env } = world();
  const names = Object.keys(ASSET_FILES);
  assert.ok(names.length >= 20 && names.some((n) => n.startsWith("fonts/")));
  for (const name of names) {
    const file = ASSET_FILES[name];
    const r = await fetchRaw(env, `/app/assets/${name}`);
    assert.equal(r.status, 200, name);
    assert.equal(r.headers.get("content-type"), file.type, name);
    assert.equal(r.headers.get("cache-control"), "no-cache");
    const bytes = new Uint8Array(await r.arrayBuffer());
    const want = file.encoding === "base64" ? Uint8Array.from(Buffer.from(file.body, "base64")) : new TextEncoder().encode(file.body);
    assert.deepEqual(bytes, want, name);
    const etag = r.headers.get("etag");
    assert.equal(etag, `"${env.VERSION}:${name}"`);
    const again = await fetchRaw(env, `/app/assets/${name}`, { "if-none-match": etag });
    assert.deepEqual([again.status, (await again.arrayBuffer()).byteLength], [304, 0], name);
    const moved = await fetchRaw({ ...env, VERSION: "99.0.0" }, `/app/assets/${name}`, { "if-none-match": etag });
    assert.equal(moved.status, 200, `${name}: a new version is fetched again`);
  }
  for (const path of ["/app/assets/nope.css", "/app/assets/civicsmith.CSS", "/app/assets/", "/app/assets/fonts/", "/app/assets/..%2fversion", "/app/assets/fonts%2f..%2f..%2fversion"]) {
    env.calls.length = 0;
    const r = await fetchRaw(env, path);
    assert.equal(r.status, 404, path);
    assert.deepEqual(env.calls, [], path);
  }
});

test("R75 (R25): a page that cannot be built (`interfacePage` throws for a broken screen) is never served: the throw leaves `appPage` (negative control: the real screens build)", () => {
  const broken = [{ id: "no-such-screen", reads: () => ({}), render: () => "", acts: [], words: [] }];
  assert.throws(() => appPage(new Request("https://x/app"), { interfacePage, screens: broken }));
  assert.equal(appPage(new Request("https://x/app"), { interfacePage, screens: [...S1, ...S2, ...S3, ...S4] }).status, 200);
});
