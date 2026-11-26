/* record-grammar at its interface: the public-locator test (R19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicHttpsLocator } from "../../../src/record-grammar/index.mjs";

test("R19 true for an https locator with a public-shaped host", () => {
  for (const u of ["https://example.org", "https://example.org/", "https://example.org/a/b?c=d#e", "https://a.b",
    "https://EXAMPLE.ORG/x", "HTTPS://example.org", "Https://example.org", "https://example.org:8443/x",
    "https://example.org.", "https://sub.example.org.:443", "https://example.org?q", "https://example.org#f",
    "https://xn--bcher-kva.example/", "https://localhost.example.org", "https://local.example.org",
    "https://example.local.org", "https://1.2.3.4.example.org", "https://1.2.3", "https://a..b"])
    assert.equal(isPublicHttpsLocator(u), true, u);
});

test("R19 false for every other scheme, an authority with @, a local or literal host, a host with no dot", () => {
  for (const u of ["http://example.org", "ftp://example.org", "https:/example.org", "https:example.org", "//example.org",
    " https://example.org", "https//example.org", "httpss://example.org", "https://", "https:///x", "https://?x", "https://#x",
    "https://user@example.org", "https://user:pw@example.org/", "https://@example.org", "https://example.org@evil.org",
    "https://localhost", "https://LOCALHOST/", "https://localhost:443", "https://localhost.", "https://LocalHost.:8080/x",
    "https://printer.local", "https://printer.LOCAL/", "https://printer.local.", "https://a.b.local:8443",
    "https://app.localhost", "https://app.localhost.", "https://x.LOCALHOST",
    "https://[::1]", "https://[::1]:443/", "https://[2001:db8::1]/x", "https://[example.org]",
    "https://127.0.0.1", "https://10.0.0.1:8080/", "https://192.168.1.1.", "https://999.999.999.999", "https://8.8.8.8",
    "https://intranet", "https://intranet:443/x", "https://intranet.", "https://:443", "https://."])
    assert.equal(isPublicHttpsLocator(u), false, u);
});

/* N449 (T20): R19's `not yet met` mark (an upper-case scheme, `localhost.` and `.local` hosts) is met at HEAD. */
test("R19 an upper-case scheme is https, and a localhost. or .local host is never public", () => {
  assert.equal(isPublicHttpsLocator("HTTPS://a.example/x"), true);
  assert.equal(isPublicHttpsLocator("https://localhost./x"), false);
  assert.equal(isPublicHttpsLocator("https://printer.local/x"), false);
});

test("R19 a non-string is false, and nothing throws", () => {
  for (const v of [undefined, null, 1, true, {}, [], ["https://example.org"], new URL("https://example.org"),
    { toString() { return "https://example.org"; } }, Symbol("s"), { __proto__: null }, 10n])
    assert.equal(isPublicHttpsLocator(v), false, typeof v);
  for (let i = 0; i < 300; i++) {
    const s = "https://" + Array.from({ length: i % 40 }, (_, j) => "a.:@[]/?#%\u0000é"[(i * 7 + j * 13) % 13]).join("");
    assert.equal(typeof isPublicHttpsLocator(s), "boolean");
  }
});
