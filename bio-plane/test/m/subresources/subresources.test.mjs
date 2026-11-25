/* subresources: requirement-named tests at the module's interface
 * (build/requirements/subresources.md). Each test names the requirement id it
 * checks in its title. No network and no store: every callback is a fake. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  captureSubresources, normalizeAddress, normalizeCitation, originOf, linkWrapper, LINK_TYPES,
  SUBRESOURCE_CAP, SUBRESOURCE_MAX, SUBRESOURCE_BUDGET,
} from "../../../src/subresources.mjs";

const BASE = "https://example.org/docs/page.html";
const ORIGIN = "https://example.org";
const enc = (s) => new TextEncoder().encode(s);
const hex = (b) => createHash("sha256").update(b).digest("hex");
const isPublic = (u) => /^https:\/\//.test(u) && !/^https:\/\/(localhost|10\.|127\.|192\.168\.)/.test(u);

const FAILED = ["SOURCE_REFUSED", "FETCH_FAILED", "TOO_LARGE"];
const REFUSED = ["REFUSED_SCHEME", "REFUSED_LOCATOR", "UNRESOLVABLE"];
const SKIPPED = ["OUTSIDE_THE_DOCUMENT", "THIRD_PARTY", "COLLAPSED_SRCSET_FAMILY", "CAP_REACHED",
  "BUDGET_EXHAUSTED", "PLATFORM_LIMIT", "DEFERRED"];

/** Runs a capture against a fake source. `site` maps an absolute URL to a body
 *  string, `{bytes, contentType}`, `{ok:false,...}`, or a function returning one. */
async function run(html, { site = {}, ...opts } = {}) {
  const calls = [], puts = new Map(), checked = [];
  const out = await captureSubresources({
    html, base: BASE, primarySha: "p".repeat(64), primaryFile: "snapshots/page.html",
    fetchOne: async (u) => {
      calls.push(u);
      let v = site[u];
      if (typeof v === "function") v = await v(u);
      if (v === undefined) return { ok: true, status: 200, bytes: enc(`body of ${u}`), contentType: "image/png" };
      if (typeof v === "string")
        return { ok: true, status: 200, bytes: enc(v), contentType: u.endsWith(".css") ? "text/css" : "application/octet-stream" };
      if (v.ok === false) return v;
      return { ok: true, status: 200, ...v };
    },
    put: async (sha, bytes) => { const existed = puts.has(sha); puts.set(sha, bytes); return { existed }; },
    sha256: async (b) => hex(b),
    isPublic: (u) => { checked.push(u); return isPublic(u); },
    now: () => new Date("2026-09-26T12:00:00Z"),
    ...opts,
  });
  const rec = (path) => out.subresources.filter((r) => r.url === (path.startsWith("http") ? path : ORIGIN + path));
  return { out, calls, puts, checked, rec, one: (p) => rec(p)[0] };
}

test("R1: every rendering reference is discovered, comments and raw text excluded, stylesheets followed to depth 2", async () => {
  const html = `<html><head>
<link rel="stylesheet" href="/a.css">
<link rel="preload" as="style" href="/pre.css"><link rel="preload" as="image" href="/pre.png">
<link rel="preload" as="font" href="/f.woff2"><link rel="icon" href="/fav.ico">
<link rel="preload" as="image" imagesrcset="/lp-1.png 1x, /lp-2.png 2x">
<style>@import "/imp.css"; body{background:url(/bg.png)} /* url(/commented-css.png) */</style>
<!-- <link rel="stylesheet" href="/commented.css"> -->
</head><body><main>
<img src="/i.png"><picture><source srcset="/s.png"><img src="/p.png"></picture>
<video src="/v.mp4" poster="/poster.png"><source src="/v2.mp4"><track src="/t.vtt"></video><audio src="/au.mp3"></audio>
<svg><image href="/svg.png"/><use href="/sprite.svg#x"/><use href="#local"/></svg>
<input type="image" src="/btn.png"><input type="text" src="/not.png">
<div style="background:url('/inline.png')"></div>
<script src="/app.js"></script><script>document.write('<img src="/in-script.png">')</script>
</main></body></html>`;
  const site = {
    [ORIGIN + "/a.css"]: "@import url(/deep.css); .x{background:url(img/a-bg.png)}",
    [ORIGIN + "/deep.css"]: ".y{background:url(/too-deep.png)} @import '/deeper.css';",
  };
  const { out, calls } = await run(html, { site });
  const urls = new Set(out.subresources.map((r) => r.url.replace(ORIGIN, "")));
  for (const p of ["/a.css", "/pre.css", "/pre.png", "/f.woff2", "/fav.ico", "/lp-2.png", "/imp.css", "/bg.png",
    "/i.png", "/s.png", "/p.png", "/v.mp4", "/poster.png", "/v2.mp4", "/t.vtt", "/au.mp3", "/svg.png", "/sprite.svg",
    "/btn.png", "/inline.png", "/app.js", "/deep.css", "/img/a-bg.png"])
    assert.ok(urls.has(p), `discovered ${p}`);
  for (const p of ["/commented.css", "/commented-css.png", "/in-script.png", "/not.png", "/too-deep.png", "/deeper.css"])
    assert.ok(!urls.has(p), `not discovered ${p}`);
  assert.ok(!calls.includes(BASE), "a bare #fragment is not a reference to fetch");
  const kind = (p) => out.subresources.find((r) => r.url === ORIGIN + p).kind;
  assert.equal(kind("/a.css"), "stylesheet");
  assert.equal(kind("/imp.css"), "stylesheet");
  assert.equal(kind("/deep.css"), "stylesheet");
  assert.equal(kind("/bg.png"), "css-asset");
  assert.equal(kind("/f.woff2"), "font");
  assert.equal(kind("/fav.ico"), "icon");
  assert.equal(kind("/v2.mp4"), "media");
  assert.equal(kind("/s.png"), "image");
  assert.equal(kind("/app.js"), "script");
  assert.equal(out.subresources.find((r) => r.url === ORIGIN + "/deep.css").depth, 2);
});

test("R2: a srcset family is one reference: the largest descriptor is fetched, the rest collapsed and never fetched", async () => {
  const html = `<main><img srcset="/s-200.png 200w, /s-800.png 800w, /s-400.png 400w" src="/s-fallback.png">
<img srcset="/x-1.png, /x-2.png 2x"></main>`;
  const { out, calls, one } = await run(html);
  assert.equal(one("/s-800.png").ok, true);
  assert.equal(one("/x-2.png").ok, true, "a candidate with no descriptor scores 1");
  for (const p of ["/s-200.png", "/s-400.png", "/s-fallback.png", "/x-1.png"]) {
    assert.deepEqual([one(p).ok, one(p).reason], [false, "COLLAPSED_SRCSET_FAMILY"]);
    assert.ok(!calls.includes(ORIGIN + p));
  }
  assert.equal(out.subresources.length, 6);
});

test("R3: references are attempted in fetch-priority order, furniture after the document's own of the same kind", async () => {
  const html = `<body><nav><link rel="stylesheet" href="/nav.css"><link rel="icon" href="/nav.ico"></nav>
<main><script src="/a.js"></script><video src="/m.mp4"></video><img src="/i1.png"><link rel="icon" href="/i.ico">
<div style="background:url(/ca.png)"></div><link rel="preload" as="font" href="/f.woff">
<link rel="stylesheet" href="/s.css"><img src="/i2.png"></main></body>`;
  const { calls } = await run(html);
  assert.deepEqual(calls.map((u) => u.replace(ORIGIN, "")),
    ["/s.css", "/nav.css", "/ca.png", "/f.woff", "/i.ico", "/nav.ico", "/i1.png", "/i2.png", "/m.mp4", "/a.js"]);
  const cut = await run(html, { cap: 3 });
  assert.deepEqual(cut.calls.map((u) => u.replace(ORIGIN, "")), ["/s.css", "/nav.css", "/ca.png"]);
  assert.equal(cut.one("/a.js").reason, "CAP_REACHED", "the least necessary is the one given up");
});

test("R4: after cap attempts every further reference is CAP_REACHED, unfetched, and the manifest is truncated", async () => {
  const html = "<main>" + [1, 2, 3, 4, 5].map((i) => `<img src="/n${i}.png">`).join("") + "</main>";
  const { out, calls } = await run(html, { cap: 2 });
  assert.equal(calls.length, 2);
  const capped = out.subresources.filter((r) => r.reason === "CAP_REACHED");
  assert.equal(capped.length, 3);
  assert.ok(capped.every((r) => r.ok === false && r.cap === 2));
  assert.equal(out.manifest.truncated, true);
  assert.equal(out.truncated, true);
});

test("R5: an oversized body is TOO_LARGE and not stored; once the budget is reached the rest are BUDGET_EXHAUSTED", async () => {
  const big = new Uint8Array(50).fill(1);
  const { one, puts } = await run(`<main><img src="/big.png"><img src="/ok.png"></main>`,
    { perMax: 40, site: { [ORIGIN + "/big.png"]: { bytes: big, contentType: "image/png" } } });
  assert.deepEqual([one("/big.png").ok, one("/big.png").reason, one("/big.png").bytes, one("/big.png").maxBytes],
    [false, "TOO_LARGE", 50, 40]);
  assert.ok(![...puts.keys()].includes(hex(big)));
  assert.equal(one("/ok.png").ok, true);

  const b = await run(`<main><img src="/a.png"><img src="/b.png"><img src="/c.png"></main>`, {
    budget: 10, site: { [ORIGIN + "/a.png"]: { bytes: new Uint8Array(10), contentType: "image/png" } } });
  assert.equal(b.one("/a.png").ok, true);
  for (const p of ["/b.png", "/c.png"]) assert.deepEqual([b.one(p).reason, b.one(p).budgetBytes], ["BUDGET_EXHAUSTED", 10]);
  assert.equal(b.calls.length, 1);
  assert.equal(b.out.manifest.budget_exhausted, true);
});

test("R6: refused schemes, unresolvable references and non-public locators are recorded and never fetched", async () => {
  const schemes = ["javascript:", "data:", "blob:", "about:", "mailto:", "tel:", "file:", "ftp:", "ws:", "wss:",
    "chrome:", "chrome-extension:", "view-source:"];
  const html = "<main>" + schemes.map((s, i) => `<img src="${s}x${i}">`).join("")
    + `<img src="https://exa mple.org/u.png"><img src="https://localhost/p.png"><img src="http://example.org/h.png"></main>`;
  const { out, calls } = await run(html);
  assert.equal(calls.length, 0);
  for (const [i, s] of schemes.entries()) {
    const r = out.subresources.find((x) => x.url === `${s}x${i}`);
    assert.deepEqual([r.ok, r.reason, r.scheme], [false, "REFUSED_SCHEME", s]);
  }
  assert.equal(out.subresources.find((r) => r.url === "https://exa mple.org/u.png").reason, "UNRESOLVABLE");
  assert.equal(out.subresources.find((r) => r.url === "https://localhost/p.png").reason, "REFUSED_LOCATOR");
  assert.equal(out.subresources.find((r) => r.url === "http://example.org/h.png").reason, "REFUSED_LOCATOR");
});

test("R7: the document boundary: layout always fetched, third-party script/image/media refused, furniture images skipped", async () => {
  const html = `<body><footer><link rel="stylesheet" href="https://cdn.other.net/f.css"><img src="/logo.png">
<img src="/shared.png"><link rel="icon" href="https://cdn.other.net/i.ico"></footer>
<main><script src="https://ads.other.net/ad.js"></script><img src="https://ads.other.net/px.png">
<video src="https://ads.other.net/v.mp4"></video><script src="/own.js"></script><img src="/shared.png"></main></body>`;
  const { out, one, calls } = await run(html);
  const r = (u) => out.subresources.find((x) => x.url === u);
  assert.equal(r("https://cdn.other.net/f.css").ok, true);
  assert.equal(r("https://cdn.other.net/i.ico").ok, true);
  for (const u of ["https://ads.other.net/ad.js", "https://ads.other.net/px.png", "https://ads.other.net/v.mp4"]) {
    assert.equal(r(u).reason, "THIRD_PARTY");
    assert.ok(!calls.includes(u));
  }
  assert.equal(one("/logo.png").reason, "OUTSIDE_THE_DOCUMENT");
  assert.ok(!calls.includes(ORIGIN + "/logo.png"));
  assert.equal(one("/shared.png").ok, true, "the same image found in a body region is fetched");
  assert.equal(one("/own.js").ok, true);
  assert.ok(!out.companionText.includes(`about:capture#${one("/own.js").sha256}`));
  assert.match(out.companionText, /about:capture#unavailable/);
});

test("R8: region: landmarks and roles, role outranks name, body wins anywhere on the stack, roles close on their own end tag", async () => {
  const html = `<body>
<nav><img src="/nav.png"></nav><header><img src="/hdr.png"></header><aside><img src="/aside.png"></aside>
<div role="navigation"><div><img src="/rn1.png"></div><img src="/rn2.png"></div><img src="/after-div.png">
<div role="banner"><img src="/banner.png"></div><div role="contentinfo"><img src="/ci.png"></div>
<div role="complementary"><img src="/comp.png"></div><div role="search"><img src="/search.png"></div>
<article><footer><img src="/byline.png"></footer></article>
<article role="navigation"><img src="/role-over-name.png"></article>
<nav><div role="main"><img src="/main-in-nav.png"></div></nav><img src="/loose.png">
</body>`;
  const { one } = await run(html);
  for (const p of ["/nav.png", "/hdr.png", "/aside.png", "/rn1.png", "/rn2.png", "/banner.png", "/ci.png", "/comp.png",
    "/search.png", "/role-over-name.png"]) {
    assert.equal(one(p).region, "furniture", p);
    assert.equal(one(p).reason, "OUTSIDE_THE_DOCUMENT", p);
  }
  for (const p of ["/after-div.png", "/byline.png", "/main-in-nav.png", "/loose.png"]) {
    assert.equal(one(p).region, "body", p);
    assert.equal(one(p).ok, true, p);
  }
  assert.equal(one("/role-over-name.png").region_basis, "role=navigation");
  assert.equal(one("/byline.png").region_basis, "<article>");
});

test("R9: one resolved address is fetched once, and every reference to it resolves to the same record", async () => {
  const r = await run(`<main><img src="/x.png"><img src="https://example.org/x.png"><img src="/x.png#y"></main>`);
  assert.equal(r.calls.length, 1);
  assert.equal(r.rec("/x.png").length, 1);
  const sha = r.one("/x.png").sha256;
  assert.equal(r.out.companionText.split(`about:capture#${sha}`).length - 1, 3);
});

test("R10: a known platform ceiling defers before the limit; a thrown limit is recorded once and observed", async () => {
  const html = "<main>" + Array.from({ length: 12 }, (_, i) => `<img src="/n${i}.png">`).join("") + "</main>";
  const k = await run(html, { platformCeiling: 10, platformMargin: 2, subrequestsAlreadySpent: 1 });
  assert.equal(k.calls.length, 7);
  assert.equal(k.out.subresources.filter((r) => r.reason === "DEFERRED").length, 5);
  assert.equal(k.out.manifest.platform.limited, false);
  assert.equal(k.out.manifest.platform.observed_ceiling, null);
  const d = await run(html, { platformCeiling: 10 });
  assert.equal(d.calls.length, 4, "platformMargin defaults to 5 and subrequestsAlreadySpent to 1");

  let n = 0;
  const site = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${ORIGIN}/n${i}.png`, () => {
    if (++n > 3) throw new Error("Too many subrequests by single Worker invocation.");
    return { bytes: enc("x" + n), contentType: "image/png" };
  }]));
  const t = await run(html, { site, subrequestsAlreadySpent: 1 });
  assert.equal(t.calls.length, 4, "never re-attempted after the refusal");
  assert.equal(t.out.manifest.platform.limited, true);
  assert.equal(t.out.manifest.platform.observed_ceiling, 5);
  assert.equal(t.out.subresources.filter((r) => r.reason === "PLATFORM_LIMIT").length, 1, "reported once");
  assert.equal(t.out.subresources.filter((r) => r.reason === "DEFERRED").length, 8);
  assert.equal(t.out.subresources.filter((r) => r.reason === "FETCH_FAILED").length, 0);
  const plain = await run("<main><img src=/e.png></main>", { site: { [ORIGIN + "/e.png"]: () => { throw new Error("boom"); } } });
  assert.equal(plain.one("/e.png").reason, "FETCH_FAILED");
  assert.equal(plain.out.manifest.platform.limited, false);
});

test("R11: furniture kinds seen across enough documents within the window are reused, never evidence kinds", async () => {
  const known = { sha256: "c".repeat(64), bytes: 9, content_type: "text/css", documents: 2,
    last_fetched: "2026-09-26T06:00:00Z", last_fetched_by: "capture-7", stable_since: "2026-09-01T00:00:00Z" };
  const lookup = (over = {}) => async (a) => (/\.(css|ico|js|png|mp4)$/.test(a) && !a.includes("from-reused") ? { ...known, ...over } : null);
  const html = `<main><link rel="stylesheet" href="/s.css"><link rel="icon" href="/i.ico"><img src="/img.png">
<script src="/a.js"></script><video src="/v.mp4"></video></main>`;
  const r = await run(html, { siteLookup: lookup(), readBack: async () => ".z{background:url(/from-reused.png)}" });
  for (const p of ["/s.css", "/i.ico"]) {
    const x = r.one(p);
    assert.deepEqual([x.ok, x.fetched_this_capture, x.reused_from, x.reused_from_fetched_at],
      [true, false, "capture-7", "2026-09-26T06:00:00Z"]);
    assert.ok(!r.calls.includes(ORIGIN + p));
  }
  for (const p of ["/img.png", "/a.js", "/v.mp4"]) assert.equal(r.one(p).fetched_this_capture, true, p);
  assert.equal(r.one("/from-reused.png").ok, true, "a reused stylesheet's own url() targets are still discovered");
  assert.equal(r.out.reused, 2);

  const unnamed = await run(html, { siteLookup: async () => ({ ...known, last_fetched_by: undefined }) });
  assert.equal(unnamed.one("/s.css").reused_from, null);
  const stale = await run(html, { siteLookup: lookup({ last_fetched: "2026-09-25T11:00:00Z" }) });
  assert.equal(stale.one("/s.css").fetched_this_capture, true, "outside the default 24h of now()");
  const wide = await run(html, { siteLookup: lookup({ last_fetched: "2026-09-25T11:00:00Z" }), reuseFreshWindowMs: 48 * 3600e3 });
  assert.equal(wide.one("/s.css").fetched_this_capture, false);
  const single = await run(html, { siteLookup: lookup({ documents: 1 }) });
  assert.equal(single.one("/s.css").fetched_this_capture, true, "reuseMinDocuments defaults to 2");
  const floor = await run(html, { siteLookup: lookup({ documents: 2 }), reuseMinDocuments: 3 });
  assert.equal(floor.one("/s.css").fetched_this_capture, true);
  const past = await run(html, { siteLookup: lookup({ last_fetched: "2019-01-01T06:00:00Z" }),
    now: () => new Date("2019-01-01T12:00:00Z") });
  assert.equal(past.one("/s.css").fetched_this_capture, false, "the window is measured from the injected now()");
});

test("R12: a resumed capture keeps what was recorded, restores the queue and replaces each DEFERRED row", async () => {
  const html = `<main><a href="/other">o</a>` + Array.from({ length: 6 }, (_, i) => `<img src="/n${i}.png">`).join("") + "</main>";
  const first = await run(html, { platformCeiling: 9 });
  assert.equal(first.calls.length, 3);
  const second = await run(html, { resume: first.out.resumeState });
  assert.deepEqual(second.calls.map((u) => u.replace(ORIGIN, "")), ["/n3.png", "/n4.png", "/n5.png"]);
  assert.equal(second.out.subresources.length, 6);
  assert.equal(second.out.subresources.filter((r) => r.reason === "DEFERRED").length, 0);
  assert.ok(second.out.subresources.every((r) => r.ok));
  assert.equal(second.out.links.filter((l) => l.type === "deferred").length, 1);
  assert.equal(second.out.siteObservations.length, 6);

  let n = 0;
  const site = { [ORIGIN + "/n1.png"]: () => { if (++n === 1) throw new Error("subrequest limit"); return { bytes: enc("n1") }; } };
  const t = await run(html, { site });
  const again = await run(html, { site, resume: t.out.resumeState });
  assert.equal(again.one("/n1.png").ok, true, "the reference the runtime refused is retried, not lost");
  assert.equal(again.out.subresources.filter((r) => r.reason === "PLATFORM_LIMIT" || r.reason === "DEFERRED").length, 0);
});

test("R13: resumeState is non-null exactly when something is outstanding", async () => {
  const html = "<main><img src=/a.png><img src=/b.png></main>";
  assert.equal((await run(html)).out.resumeState, null);
  const d = await run(html, { platformCeiling: 7 });
  assert.ok(d.out.resumeState && d.out.resumeState.queue.length === 1);
});

test("R14: the render companion strips executables, rewrites every reference, and opens with the CSP and banner", async () => {
  const html = `<html><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=/x">
<link rel="stylesheet" href="/s.css" integrity="sha384-x" nonce="n1"><style>.a{background:url(/bg.png)} .b{background:url(/gone.png)}</style>
</head><body onload="x()"><main>
<script src="/a.js"></script><script>alert(1)</script><iframe src="/f.html"><p>in frame</p></iframe>
<object data="/o.swf"></object><embed src="/e.swf"><applet code="x"></applet><frameset><frame src="/fr.html"></frameset>
<noembed>ne</noembed><img src="/i.png" onclick="y()" style="border-image:url(/bi.png)"><img src="/missing.png">
</main></body></html>`;
  const site = { [ORIGIN + "/missing.png"]: { ok: false, status: 404 }, [ORIGIN + "/gone.png"]: { ok: false, status: 404 } };
  const { out, one } = await run(html, { site });
  const c = out.companionText;
  for (const bad of ["<script", "<iframe", "in frame", "<object", "<embed", "<applet", "<frame", "<noembed", "<base",
    "http-equiv=\"refresh\"", "onload", "onclick", "integrity", "nonce", "/a.js", "/s.css\"", "/i.png"])
    assert.ok(!c.includes(bad), `companion carries no ${bad}`);
  for (const p of ["/s.css", "/bg.png", "/i.png", "/bi.png"]) assert.ok(c.includes(`about:capture#${one(p).sha256}`), p);
  assert.equal(one("/a.js").ok, true);
  assert.ok(!c.includes(one("/a.js").sha256));
  assert.ok(c.includes(`url("about:capture#unavailable")`), "a reference whose bytes are not held");
  assert.match(c, /<img src="about:capture#unavailable">/);
  const after = c.slice(c.indexOf("<head>") + "<head>".length);
  assert.match(after, /^\n<!-- DERIVED ARTIFACT[\s\S]*?p{64}[\s\S]*?at 2026-09-26T12:00:00Z[\s\S]*?-->\n<meta http-equiv="Content-Security-Policy"/);
  const bare = await run(`<p><img src="/i.png"></p>`);
  assert.match(bare.out.companionText, /^<!-- DERIVED ARTIFACT[\s\S]*?-->\n<meta http-equiv="Content-Security-Policy"[^>]*>\n<p>/);
});

test("R15: every link is classified anchor, intra, deferred or refused, recorded once per citation, and wrapped", async () => {
  const html = `<main><img src="/held.png"><a href="#sec">a</a><a href="#sec">a2</a><a href="/held.png">h</a>
<a href="/doc#findings">f</a><a href="/doc#method">m</a><a href="/doc#findings">f2</a><a href="javascript:x()">j</a>
<a href="https://localhost/in">l</a><area href="/map-target"></main>`;
  const { out, one } = await run(html);
  const by = (t) => out.links.filter((l) => l.type === t);
  assert.equal(by("anchor").length, 1);
  assert.deepEqual([by("anchor")[0].fragment, by("anchor")[0].address], ["sec", BASE]);
  assert.equal(by("intra").length, 1);
  assert.equal(by("intra")[0].sha256, one("/held.png").sha256);
  assert.deepEqual(by("deferred").map((l) => l.citation).sort(),
    [ORIGIN + "/doc#findings", ORIGIN + "/doc#method", ORIGIN + "/map-target"]);
  assert.deepEqual(by("refused").map((l) => [l.reason, l.scheme ?? null]).sort(),
    [["REFUSED_LOCATOR", null], ["REFUSED_SCHEME", "javascript:"]]);
  for (const l of out.links) {
    assert.ok(LINK_TYPES.includes(l.type));
    for (const k of ["ref", "type", "address", "as_of"]) assert.ok(k in l, k);
  }
  const c = out.companionText;
  assert.ok(c.includes(`href="#sec"`));
  assert.ok(c.includes(`href="${linkWrapper.intra(one("/held.png").sha256)}"`));
  assert.ok(c.includes(`href="${linkWrapper.deferred(ORIGIN + "/doc")}"`));
  assert.ok(c.includes(`href="${linkWrapper.refused()}"`));
});

test("R16: the output's shape, one bucket per record, completeness, the per-clock spread, and the renditions", async () => {
  const html = `<body><nav><img src="/nav.png"></nav><main><img srcset="/a.png 1x, /b.png 2x">
<img src="https://ads.other.net/p.png"><img src="data:x"><img src="https://localhost/q.png"><img src="https://exa mple.org/u">
<img src="/404.png"><img src="/cool.png"><img src="/ok.png"><link rel="stylesheet" href="/s.css"></main></body>`;
  const site = { [ORIGIN + "/404.png"]: { ok: false, status: 404 }, [ORIGIN + "/cool.png"]: { ok: false, status: 0, reason: "HOST_COOLING_OFF" } };
  const { out } = await run(html, { site, siteLookup: async (a) => a.endsWith("/s.css")
    ? { sha256: "d".repeat(64), documents: 3, last_fetched: "2026-09-26T10:00:00Z" } : null });
  for (const k of ["subresources", "links", "siteObservations", "reused", "meter", "resumeState", "manifest", "manifestSha",
    "manifestBytes", "companionText", "companionSha", "companionBytes", "truncated", "discovered", "attempted", "renditions"])
    assert.ok(k in out, k);
  const m = out.manifest;
  for (const r of out.subresources) {
    const n = [r.ok, !r.ok && FAILED.includes(r.reason), !r.ok && REFUSED.includes(r.reason), !r.ok && SKIPPED.includes(r.reason)]
      .filter(Boolean).length;
    assert.equal(n, 1, `${r.url} ${r.reason}`);
  }
  assert.equal(m.counts.fetched + m.counts.failed + m.counts.refused + m.counts.skipped, out.subresources.length);
  assert.equal(m.complete, true);
  assert.deepEqual(out.siteObservations.map((o) => [o.address, o.reused]).sort(),
    [[ORIGIN + "/b.png", false], [ORIGIN + "/ok.png", false], [ORIGIN + "/s.css", true]]);
  for (const o of out.siteObservations) for (const k of ["address", "address_norm", "sha256", "kind", "reused"]) assert.ok(k in o);
  const sp = m.part_fetch_spread;
  assert.equal(sp.state, "two_clocks_not_compared");
  assert.deepEqual([sp.earliest, sp.latest], [null, null]);
  assert.equal(sp.clocks.record.earliest, "2026-09-26T10:00:00Z");
  assert.equal(sp.clocks.capture.earliest, "2026-09-26T12:00:00Z");
  const one = await run("<main><img src=/a.png></main>");
  assert.deepEqual([one.out.manifest.part_fetch_spread.state, one.out.manifest.part_fetch_spread.clock], ["one_clock", "capture"]);
  const odd = await run("<main><img src=/a.png><img src=/b.png></main>", { resume: { records: [
    { url: ORIGIN + "/old.png", kind: "image", ok: true, sha256: "e".repeat(64), fetched_at: "not a time" }],
    queue: [{ ref: "/b.png", kind: "image", where: "img[src]", depth: 1, from: "snapshots/page.html", against: BASE }] } });
  assert.equal(odd.out.manifest.part_fetch_spread.undetermined, 1);
  for (const [opt, why] of [[{ cap: 1 }, "cap"], [{ budget: 1 }, "budget"], [{ platformCeiling: 7 }, "deferred"]])
    assert.equal((await run("<main><img src=/a.png><img src=/b.png></main>", opt)).out.manifest.complete, false, why);
  assert.equal(out.renditions.length, 2);
  assert.deepEqual(out.renditions.map((r) => r.sha256), [out.companionSha, out.manifestSha]);
  for (const r of out.renditions) for (const k of ["sha256", "bytes", "content_type", "transform", "reason"]) assert.ok(r[k] !== undefined, k);
});

test("R17: only a record whose fetch was issued this run carries fetched_at (D-603)", async () => {
  let n = 0;
  const html = `<body><nav><img src="/nav.png"></nav><main><link rel="stylesheet" href="/s.css">
<img srcset="/a.png 1x, /b.png 2x"><img src="https://ads.other.net/p.png"><img src="data:x">
<img src="https://localhost/q.png"><img src="https://exa mple.org/u"><img src="/404.png"><img src="/big.png">`
    + Array.from({ length: 8 }, (_, i) => `<img src="/n${i}.png">`).join("") + "</main></body>";
  const site = { [ORIGIN + "/404.png"]: { ok: false, status: 404 }, [ORIGIN + "/big.png"]: { bytes: new Uint8Array(99) } };
  const lookup = async (a) => a.endsWith("/s.css") ? { sha256: "d".repeat(64), documents: 3, last_fetched: "2026-09-26T10:00:00Z" } : null;
  const check = (r) => {
    for (const x of r.out.subresources) {
      const issued = r.calls.includes(x.url) && x.reason !== "PLATFORM_LIMIT";
      assert.equal("fetched_at" in x, issued, `${x.url} ${x.reason ?? "ok"}`);
      if (issued) assert.equal(x.fetched_at, "2026-09-26T12:00:00Z");
      assert.equal(x.considered_at, "2026-09-26T12:00:00Z");
    }
  };
  const a = await run(html, { site, siteLookup: lookup, perMax: 50, cap: 6 });
  assert.ok(a.out.subresources.some((x) => x.reason === "CAP_REACHED"));
  assert.ok(a.out.subresources.some((x) => x.fetched_this_capture === false));
  check(a);
  const b = await run(html, { site, perMax: 50, budget: 1 });
  assert.ok(b.out.subresources.some((x) => x.reason === "BUDGET_EXHAUSTED"));
  check(b);
  const c = await run(html, { site, perMax: 50, platformCeiling: 10 });
  assert.ok(c.out.subresources.some((x) => x.reason === "DEFERRED"));
  check(c);
  const d = await run(html, { perMax: 50, site: { ...site, [ORIGIN + "/n2.png"]: () => { if (++n) throw new Error("subrequest limit"); } } });
  assert.ok(d.out.subresources.some((x) => x.reason === "PLATFORM_LIMIT"));
  check(d);
});

test("R18: normalizeAddress lowercases scheme and host, drops fragment and default port, sorts the query, touches nothing else", () => {
  assert.equal(normalizeAddress("HTTPS://Example.ORG:443/A/b/?z=1&a=2&a=1#frag"), "https://example.org/A/b/?a=1&a=2&z=1");
  assert.equal(normalizeAddress("http://Example.org:80/x"), "http://example.org/x");
  assert.equal(normalizeAddress("https://example.org:8443/x"), "https://example.org:8443/x");
  assert.equal(normalizeAddress("https://example.org/x/"), "https://example.org/x/");
  assert.equal(normalizeAddress("https://example.org/x?v=3&q=a+b&r=a%20b&flag"), "https://example.org/x?flag&q=a+b&r=a%20b&v=3");
  assert.equal(normalizeAddress("https://h/V.ashx?M=F&ID=1&GUID=g"), "https://h/V.ashx?GUID=g&ID=1&M=F");
  assert.equal(normalizeAddress("  not a url  "), "not a url");
  assert.equal(normalizeAddress(null), "null");
});

test("R19: normalizeCitation keeps the trimmed, non-empty fragment on the normalised address", () => {
  assert.equal(normalizeCitation("HTTPS://Example.org:443/r?b=1&a=2#findings"), "https://example.org/r?a=2&b=1#findings");
  assert.notEqual(normalizeCitation("https://e.org/r#findings"), normalizeCitation("https://e.org/r#method"));
  assert.equal(normalizeCitation("https://e.org/r#  sec  "), "https://e.org/r#sec");
  assert.equal(normalizeCitation("https://e.org/r#"), "https://e.org/r");
  assert.equal(normalizeCitation("https://e.org/r#   "), "https://e.org/r");
  assert.equal(normalizeCitation("https://e.org/r"), "https://e.org/r");
});

test("R20: originOf: same_host, approximate same_site by the last two labels, third_party otherwise", () => {
  assert.deepEqual(originOf("https://WWW.Example.org/x", "www.example.ORG"), { origin: "same_host", host: "www.example.org" });
  assert.deepEqual(originOf("https://cdn.example.org/x", "www.example.org"), { origin: "same_site", host: "cdn.example.org", approximate: true });
  assert.deepEqual(originOf("https://a.other.co.uk/x", "b.example.co.uk"), { origin: "same_site", host: "a.other.co.uk", approximate: true });
  assert.deepEqual(originOf("https://other.net/x", "example.org"), { origin: "third_party", host: "other.net" });
});

test("R21: originOf of an unparseable url is unknown with no host", () => {
  assert.deepEqual(originOf("not a url", "example.org"), { origin: "unknown", host: null });
  assert.deepEqual(originOf(undefined, "example.org"), { origin: "unknown", host: null });
});

test("R22: linkWrapper.anchor returns the fragment unchanged", () => {
  assert.equal(linkWrapper.anchor("#sec"), "#sec");
});

test("R23: linkWrapper.intra wraps a sha256 as about:capture#", () => {
  assert.equal(linkWrapper.intra("a".repeat(64)), "about:capture#" + "a".repeat(64));
});

test("R24: linkWrapper.deferred wraps the encoded url as about:link#", () => {
  const u = "https://e.org/a b?x=1&y=2#f";
  assert.equal(linkWrapper.deferred(u), "about:link#" + encodeURIComponent(u));
});

test("R24: a lone surrogate in the url is U+FFFD in the wrapper, never a URIError, the same every call", () => {
  const forms = ["\uD800", "\uDFFF", "a\uD800b", "a\uDC00\uD800b", "https://e.org/\uD83D", "https://e.org/\uDE00?q=\uD800#\uDC00"];
  for (const u of forms) {
    const w = linkWrapper.deferred(u);
    assert.equal(w, linkWrapper.deferred(u));
    assert.ok(w.startsWith("about:link#"));
    assert.ok(w.includes("%EF%BF%BD"));
    assert.equal(w, "about:link#" + encodeURIComponent(u.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")));
  }
  /* A well-formed pair is not a lone surrogate. */
  assert.equal(linkWrapper.deferred("x\uD83D\uDE00"), "about:link#" + encodeURIComponent("x\uD83D\uDE00"));
});

test("R36: a failure that comes of an address's own bytes is a final record and never a throw", async () => {
  const bad = ["\uD800", "http://\uD800/", "https://exa mple.org/u.png", "https://[::1/x"];
  for (const u of bad) {
    assert.doesNotThrow(() => normalizeAddress(u));
    assert.doesNotThrow(() => normalizeCitation(u + "#\uDC00"));
    assert.doesNotThrow(() => linkWrapper.deferred(u));
  }
  const html = "<main>" + bad.map((u) => `<img src="${u}"><a href="${u}">l</a>`).join("")
    + `<a href="https://example.org/p?q=\uD800#\uDC00">x</a><img src="/ok\uD800.png"></main>`;
  const first = await run(html);
  const second = await run(html);
  for (const u of ["https://exa mple.org/u.png", "https://[::1/x"]) {
    const r = first.out.subresources.find((x) => x.url === u);
    assert.deepEqual([r.ok, r.reason, r.final], [false, "UNRESOLVABLE", true]);
  }
  assert.equal(first.out.companionSha, second.out.companionSha);
  assert.equal(first.out.manifestSha, second.out.manifestSha);
  /* Every link is classified and wrapped like any other. */
  assert.ok(first.out.links.some((l) => l.type === "deferred" && l.address.includes("%EF%BF%BD")));
  const total = ["fetched", "failed", "refused", "skipped"].reduce((n, k) => n + first.out.manifest.counts[k], 0)
    + first.out.manifest.counts.platform_limited * 0;
  assert.equal(total, first.out.subresources.length);
});

test("R25: linkWrapper.refused is about:link#refused", () => {
  assert.equal(linkWrapper.refused(), "about:link#refused");
});

test("R26: LINK_TYPES is exactly the four partitions, in order, and linkWrapper covers exactly them", () => {
  assert.deepEqual(LINK_TYPES, ["anchor", "intra", "deferred", "refused"]);
  assert.deepEqual(Object.keys(linkWrapper).sort(), [...LINK_TYPES].sort());
});

test("R27: the appetite ceilings and their use as captureSubresources' defaults", async () => {
  assert.equal(SUBRESOURCE_CAP, 400);
  assert.equal(SUBRESOURCE_MAX, 8 * 1024 * 1024);
  assert.equal(SUBRESOURCE_BUDGET, 64 * 1024 * 1024);
  const { out } = await run("<main><img src=/a.png></main>");
  assert.deepEqual([out.manifest.limits.cap, out.manifest.limits.per_max_bytes, out.manifest.limits.budget_bytes],
    [SUBRESOURCE_CAP, SUBRESOURCE_MAX, SUBRESOURCE_BUDGET]);
  assert.equal(out.manifest.platform.ceiling_used, null, "no platform number is declared");
});

test("R35: called without cap, a page naming more than 400 fetchable references gets exactly 400 fetches, the rest CAP_REACHED", async () => {
  assert.equal(SUBRESOURCE_CAP, 400);
  const N = 457;
  const html = "<main>" + Array.from({ length: N }, (_, i) => `<img src="/n${i}.png">`).join("") + "</main>";
  const { out, calls } = await run(html);
  assert.equal(calls.length, 400);
  assert.equal(new Set(calls).size, 400, "400 distinct references, each fetched once");
  assert.equal(out.subresources.length, N);
  const capped = out.subresources.filter((r) => r.reason === "CAP_REACHED");
  assert.equal(capped.length, N - 400);
  for (const r of capped) {
    assert.deepEqual([r.ok, r.reason, r.cap], [false, "CAP_REACHED", 400], r.url);
    assert.ok(!calls.includes(r.url), `${r.url} is not fetched`);
  }
  assert.equal(out.subresources.filter((r) => r.ok).length, 400);
  assert.equal(out.attempted, 400);
  assert.equal(out.manifest.truncated, true);
  assert.equal(out.manifest.limits.cap, 400);
  assert.equal(out.manifest.complete, false);
});

test("R28: no network and no store of its own; the same inputs and callback outputs give the same outputs", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("the module reached the network itself"); };
  try {
    const html = `<head><link rel="stylesheet" href="/s.css"></head><main><img src="/a.png"><a href="/x">x</a></main>`;
    const site = { [ORIGIN + "/s.css"]: ".a{background:url(/bg.png)}" };
    const a = await run(html, { site }), b = await run(html, { site });
    assert.equal(a.out.companionText, b.out.companionText);
    assert.equal(a.out.manifestSha, b.out.manifestSha);
    assert.deepEqual(a.out.subresources, b.out.subresources);
    assert.deepEqual([...a.puts.keys()].sort(), [...b.puts.keys()].sort());
  } finally { globalThis.fetch = realFetch; }
});

test("R29: the companion is a separate artifact declaring its derivation and unable to reach the network or run a script", async () => {
  const html = `<html><head><title>t</title></head><main><img src="/a.png"></main></html>`;
  const { out, puts } = await run(html);
  assert.notEqual(out.companionSha, "p".repeat(64));
  assert.equal(out.companionSha, hex(out.companionBytes));
  assert.ok(puts.has(out.companionSha));
  assert.ok(![...puts.values()].some((b) => new TextDecoder().decode(b) === html), "the primary is never re-stored rewritten");
  const csp = /Content-Security-Policy" content="([^"]*)"/.exec(out.companionText)[1];
  for (const d of ["default-src 'none'", "script-src 'none'", "frame-src 'none'", "object-src 'none'", "base-uri 'none'"])
    assert.ok(csp.includes(d), d);
  assert.ok(!/https?:/.test(csp));
  assert.match(out.companionText, /DERIVED ARTIFACT, not evidence[\s\S]*p{64}/);
});

test("R30: isPublic fences every reference at every depth", async () => {
  const site = { [ORIGIN + "/s.css"]: "@import '/t.css'; .a{background:url(https://localhost/p.png)} .b{background:url(/ok.png)}",
    [ORIGIN + "/t.css"]: "" };
  const { out, checked, calls } = await run(`<head><link rel="stylesheet" href="/s.css"></head>`, { site });
  for (const r of out.subresources) if (r.url.startsWith("http")) assert.ok(checked.includes(r.url), r.url);
  assert.equal(out.subresources.find((r) => r.url === "https://localhost/p.png").reason, "REFUSED_LOCATOR");
  assert.ok(!calls.includes("https://localhost/p.png"));
});

test("R31: stylesheets and their assets are fetched whatever region they are in", async () => {
  const site = { [ORIGIN + "/nav.css"]: ".n{background:url(/sprite.png)}" };
  const { one } = await run(`<nav><link rel="stylesheet" href="/nav.css"><div style="background:url(/nbg.png)"></div>
<link rel="preload" as="font" href="/f.woff"><link rel="icon" href="/i.ico"></nav>`, { site });
  for (const p of ["/nav.css", "/sprite.png", "/nbg.png", "/f.woff", "/i.ico"]) {
    assert.equal(one(p).ok, true, p);
    assert.equal(one(p).region, "furniture", p);
  }
});

test("R32: the honesty fields are never approximated", async () => {
  const { out } = await run("<main><link rel=stylesheet href=/s.css><img src=/a.png></main>",
    { siteLookup: async (a) => a.endsWith("/s.css") ? { sha256: "d".repeat(64), documents: 2, last_fetched: "2026-09-26T11:00:00Z" } : null });
  for (const r of out.subresources.filter((x) => x.ok))
    assert.equal(r.fetched_this_capture, r.url.endsWith("/a.png"));
  const reused = out.subresources.find((r) => r.fetched_this_capture === false);
  assert.equal(reused.reused_from, null);
  assert.equal(out.manifest.platform.observed_ceiling, null);
  assert.equal(out.manifest.platform.limited, false);
});

test("R33: every record not fetched names a reason from the closed set, never the source's refusal for our choice", async () => {
  const html = `<body><nav><img src="/nav.png"></nav><main><img srcset="/a.png 1x, /b.png 2x"><img src="https://ads.other.net/p.png">
<img src="/cool.png"><img src="/404.png"><img src="/x.png"><img src="/y.png"></main></body>`;
  const site = { [ORIGIN + "/cool.png"]: { ok: false, status: 0, reason: "HOST_COOLING_OFF" }, [ORIGIN + "/404.png"]: { ok: false, status: 404 } };
  const { out, one } = await run(html, { site, cap: 4 });
  for (const r of out.subresources.filter((x) => !x.ok)) assert.ok([...FAILED, ...REFUSED, ...SKIPPED].includes(r.reason), r.reason);
  assert.deepEqual([one("/cool.png").reason, one("/cool.png").fetch_reason], ["FETCH_FAILED", "HOST_COOLING_OFF"]);
  assert.equal(one("/404.png").reason, "SOURCE_REFUSED");
  for (const p of ["/nav.png", "/a.png"]) assert.notEqual(one(p).reason, "SOURCE_REFUSED");
  assert.equal(out.subresources.filter((r) => r.reason === "SOURCE_REFUSED").length, 1);
});

test("R34: every link carries its containment: chrome with the furniture region's basis by R8's rule, else explicitly none", async () => {
  const html = `<body>
<nav><a href="/n">n</a><a href="#top">t</a><a href="javascript:x()">j</a><a href="/held.png">h</a></nav>
<header><a href="/h">h</a></header><aside><a href="/as">a</a></aside>
<div role="navigation"><div><a href="/rn1">1</a></div><a href="/rn2">2</a></div><a href="/after-div">x</a>
<div role="banner"><a href="/ban">b</a></div><div role="contentinfo"><a href="/ci">c</a></div>
<div role="complementary"><a href="/comp">c</a></div><div role="search"><area href="/srch"></div>
<article><footer><a href="/byline">b</a></footer></article>
<article role="navigation"><a href="/role-over-name">r</a></article>
<nav><div role="main"><a href="/main-in-nav">m</a></div></nav>
<!-- <nav><a href="/commented">c</a></nav> --><a href="/commented">c</a>
<main><img src="/held.png"><a href="/both">b</a><a href="/rel">r</a><a href="/twice">t</a></main>
<nav><a href="/both">b</a><a href="https://example.org/rel">r</a></nav>
<footer><a href="/twice">t</a></footer><nav><a href="/twice">t</a></nav>
<a href="/loose">l</a>
</body>`;
  const { out } = await run(html);
  const link = (ref) => {
    const hits = out.links.filter((l) => l.ref === ref);
    assert.equal(hits.length, 1, ref);
    return hits[0];
  };
  for (const l of out.links) {
    assert.equal(typeof l.chrome, "boolean", l.ref);
    assert.equal(l.chrome_basis === null, !l.chrome, `${l.ref}: a basis exactly when contained`);
  }
  const contained = { "/n": "<nav>", "#top": "<nav>", "javascript:x()": "<nav>", "/held.png": "<nav>", "/h": "<header>",
    "/as": "<aside>", "/rn1": "role=navigation", "/rn2": "role=navigation", "/ban": "role=banner", "/ci": "role=contentinfo",
    "/comp": "role=complementary", "/srch": "role=search", "/role-over-name": "role=navigation",
    "/both": "<nav>", "/rel": "<nav>", "/twice": "<footer>" };
  for (const [ref, basis] of Object.entries(contained))
    assert.deepEqual([link(ref).chrome, link(ref).chrome_basis], [true, basis], ref);
  for (const ref of ["/after-div", "/byline", "/main-in-nav", "/commented", "/loose"])
    assert.deepEqual([link(ref).chrome, link(ref).chrome_basis], [false, null], ref);
  assert.deepEqual(["#top", "javascript:x()", "/held.png", "/n"].map((r) => link(r).type), ["anchor", "refused", "intra", "deferred"],
    "every partition carries it");
  assert.equal(out.links.filter((l) => l.citation === ORIGIN + "/rel").length, 1, "one citation written two ways is one link");

  /* A classification, never a filter: the same page with no furniture records the same links, uncontained. */
  const flat = await run(html.replace(/<(\/?)(nav|header|aside|footer)\b/g, "<$1div").replace(/ role="[a-z]+"/g, ""));
  const strip = (ls) => ls.map(({ chrome, chrome_basis, ...l }) => l);
  assert.deepEqual(strip(flat.out.links), strip(out.links));
  assert.ok(flat.out.links.every((l) => l.chrome === false && l.chrome_basis === null));

  /* Resumed: restored links keep their containment, and a link that changes partition between ticks carries it. */
  const page = `<nav><a href="/n5.png">5</a></nav><main>` + Array.from({ length: 6 }, (_, i) => `<img src="/n${i}.png">`).join("") + "</main>";
  const first = await run(page, { platformCeiling: 9 });
  assert.deepEqual(first.out.links.map((l) => [l.type, l.chrome, l.chrome_basis]), [["deferred", true, "<nav>"]]);
  const second = await run(page, { resume: first.out.resumeState });
  assert.deepEqual(second.out.links.map((l) => [l.type, l.chrome, l.chrome_basis]),
    [["deferred", true, "<nav>"], ["intra", true, "<nav>"]]);
  const older = { ...first.out.resumeState, links: first.out.resumeState.links.map(({ chrome, chrome_basis, ...l }) => l) };
  const third = await run(page, { resume: older });
  assert.deepEqual(third.out.links.map((l) => [l.type, l.chrome, l.chrome_basis]),
    [["deferred", true, "<nav>"], ["intra", true, "<nav>"]], "a restored link that predates the field is given it");
});

test("Errors: a missing callback is a TypeError; nothing about a reference or the source ever throws", async () => {
  const base = { html: "<p>no refs</p>", base: BASE, primarySha: "p".repeat(64), primaryFile: "f",
    fetchOne: async () => ({ ok: true }), put: async () => ({}), sha256: async (b) => hex(b), isPublic };
  for (const k of ["fetchOne", "put", "sha256", "isPublic"])
    await assert.rejects(captureSubresources({ ...base, [k]: undefined }), TypeError, k);
  const html = `<main><img src="/rej.png"><img src="/big.png"><img src="javascript:x"><img src="https://localhost/p"></main>`;
  const site = { [ORIGIN + "/rej.png"]: () => Promise.reject(new Error("net down")), [ORIGIN + "/big.png"]: { bytes: new Uint8Array(9) } };
  const { one } = await run(html, { site, perMax: 4 });
  assert.equal(one("/rej.png").reason, "FETCH_FAILED");
  assert.equal(one("/big.png").reason, "TOO_LARGE");
  assert.doesNotThrow(() => { normalizeAddress({}); normalizeCitation(undefined); originOf(null, null); });
});

/* Fix round 10, cause R15 (G3, R24 (c)): a page that opens markup and never closes it was read
 * to its end from every opening, quadratic: 240 KB of `<div` held the object for 27 seconds.
 * Time is asserted as a ratio between two sizes of the same page (R-CLOCK), with a floor so a
 * run too fast to measure cannot fail it, and as a ceiling a hundredth of what the page cost. */
const timed = async (html) => {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    await run(html);
    best = Math.min(best, performance.now() - t);
  }
  return best;
};

test("R1, R14, R15: a page of unclosed tags is walked in time that grows with its size, and its references are unchanged", async () => {
  const lead = `<html><body><img src="/a.png"><a href="/next">n</a><link rel="stylesheet" href="/c.css">`;
  const junk = (n) => "<div".repeat(n);
  assert.ok(await timed(lead + junk(60000)) < 1000, "240 KB of unclosed <div is read in under a second");
  const small = await timed(lead + junk(30000));
  const large = await timed(lead + junk(60000));
  assert.ok(large < 3 * Math.max(small, 20), `twice the page took ${large.toFixed(0)} ms against ${small.toFixed(0)} ms`);
  /* The references the page does carry are those it carries without the tail. */
  const [plain, junky] = [await run(lead + "</body></html>"), await run(lead + junk(60000))];
  assert.deepEqual(junky.calls, plain.calls);
  assert.deepEqual(junky.out.links.map((l) => l.address), plain.out.links.map((l) => l.address));
  assert.equal(junky.out.manifest.counts.fetched, plain.out.manifest.counts.fetched);
});

test("R1, R14, R15: every shape of opening that is never closed costs time that grows with the page", async () => {
  const shapes = {
    comment: "<!--", style: "<style>", scriptTag: "<script ", scriptEl: "<script>", meta: "<meta ", base: "<base ",
    quote: '<d "', apos: "<d '", attr: '<a href="x" ',
  };
  for (const [name, unit] of Object.entries(shapes)) {
    const page = (n) => "<html><body>" + unit.repeat(n);
    assert.ok(await timed(page(30000)) < 1500, `${name}: ${unit.length * 30000} bytes in under a second and a half`);
  }
  for (const [name, unit] of Object.entries({ url: "url(", comment: "/*", imp: "@import ", quoted: 'url("' })) {
    const page = (n) => `<html><body><style>${unit.repeat(n)}</style><p style="${unit.repeat(n)}">`;
    assert.ok(await timed(page(30000)) < 1500, `css ${name}: in under a second and a half`);
  }
  const srcset = (n) => `<img srcset="a.png 1x, ${",".repeat(n)}x, b.png 2x">`;
  assert.ok(await timed(srcset(200000)) < 1500, "a srcset with a long run of commas");
});

test("R1, R14: a `>` inside a quoted value does not end a tag, and a quote never closed opens no tag after it", async () => {
  const { one, out } = await run(`<main><img alt="a > b" src="/q.png"><img alt='x"y>z' src='/r.png'/></main>`);
  assert.ok(one("/q.png").ok && one("/r.png").ok);
  assert.ok(out.companionText.includes('alt="a > b"'));
  const closed = await run(`<main><img src="/x.png"/><img src="/y.png"></main><img src=/z.png alt="`);
  assert.ok(closed.one("/x.png").ok && closed.one("/y.png").ok);
  assert.equal(closed.one("/z.png"), undefined);
});

test("R3: a page naming many references takes them in priority order without reading the whole list each time", async () => {
  const imgs = Array.from({ length: 40000 }, (_, i) => `<img src="/i${i}.png">`).join("");
  const html = `<main>${imgs}<link rel=stylesheet href=/late.css></main>`;
  const t = performance.now();
  const { out, calls } = await run(html, { cap: 3 });
  assert.ok(performance.now() - t < 3000);
  assert.equal(calls[0], ORIGIN + "/late.css", "the stylesheet is attempted first");
  assert.deepEqual(calls.slice(1), [ORIGIN + "/i0.png", ORIGIN + "/i1.png"], "then the images in discovery order");
  assert.equal(out.manifest.truncated, true);
});
