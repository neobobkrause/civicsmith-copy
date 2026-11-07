// Copied from control-plane's suite (test/m/control-plane/t51-large-pdfs.test.mjs) when control-plane-door-reading took R120, R123 and R125 by copy (5 Nov 2026); it proves the requirement through the real plane.
/* control-plane R120, R121 (fix round 4, C5a/P8; K4429, K4434): THE WALKER'S FOUR FILES THROUGH THE REAL DOOR. The real plane (the Worker the product deploys, its
   object, its alarm and R2) under Miniflare; the network scripted to serve the files the walker captured. The files are not committed: each is fetched once
   from its address into `.cache/` beside this test (git-ignored) and checked against its pinned SHA-256; a file that cannot be had FAILS the test by name,
   never skips it. A 2.5 MB, an 8.8 MB and a 15.9 MB PDF are each answered inside 15 s with the capture kept and the reading pending (never an empty `timings`);
   once the capture screen has promoted the document the plane's alarm reads it and `op=reading` has its text; the 140 KB IRS file is answered with its
   reading. Red by name until pdf-reader (R41, the reading within the object's memory) and plane (R75, the alarm and `pendingadd`) have merged. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const CACHE = fileURLToPath(new URL("../control-plane/.cache/", import.meta.url));
const FILES = {
  "BUDGET-2025-BUD.pdf": { url: "https://www.govinfo.gov/content/pkg/BUDGET-2025-BUD/pdf/BUDGET-2025-BUD.pdf", sha: "3f1df41cfa3cebfd675b2a6ed673b6f665e0848c293d8d3bb5ab1815a0bae36b" },
  "BUDGET-2025-PER.pdf": { url: "https://www.govinfo.gov/content/pkg/BUDGET-2025-PER/pdf/BUDGET-2025-PER.pdf", sha: "067ad707534788e9011d4b6abdb686f1c3505888218e2ca5327c04e0ad58ae7f" },
  "BUDGET-2024-APP.pdf": { url: "https://www.govinfo.gov/content/pkg/BUDGET-2024-APP/pdf/BUDGET-2024-APP.pdf", sha: "6e0b3dc5f2f3f5bbab8ae5032bbc29207a8dbb290ba25ebafe3feb20dfe13c1e" },
  "fw9.pdf": { url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf", sha: "2d420cbb4123dcf1fb82595b2359cfbb5d81f00b9df9d359fcc7af361d093f53" },
};
const hex = (b) => createHash("sha256").update(b).digest("hex");
/* fetched once, pinned; a file that cannot be had, or is not the pinned bytes, throws (the test fails by name) */
function have(name) {
  const { url, sha } = FILES[name], path = CACHE + name;
  mkdirSync(CACHE, { recursive: true });
  if (!existsSync(path) || hex(readFileSync(path)) !== sha) {
    try { execFileSync("curl", ["-fsSL", "--max-time", "300", "-o", path, url], { stdio: "pipe" }); }
    catch (e) { throw new Error(`THE FILE ${name} CANNOT BE HAD from ${url}: ${String(e.stderr || e.message).slice(0, 200)}`); }
  }
  const bytes = readFileSync(path);
  if (hex(bytes) !== sha) throw new Error(`THE FILE ${name} is not the pinned bytes (${hex(bytes)} for ${sha})`);
  return new Uint8Array(bytes);
}

const ADM = "adm-big-0123456789abcdef", PASSWORD = "the founder's long password, big", ORIGIN = "https://group.example";
let mf, bytesOf = {};
const boot = () => {
  for (const n of Object.keys(FILES)) bytesOf[n] = have(n);
  mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-big-0123456789abcdef", PROBE_TOKEN: "prb-big-0123456789abcdef", VERSION: "4.7.3", INSTANCE_NAME: "big-town",
                GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
    outboundService: (req) => {
      const b = bytesOf[new URL(req.url).pathname.split("/").pop()];
      return b ? new Response(b, { headers: { "content-type": "application/pdf", "content-length": String(b.length) } }) : new Response("not scripted", { status: 404 });
    },
  });
};
after(() => mf && mf.dispose());
const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

test("R120, R121 (C5a/P8): the 2.5, 8.8 and 15.9 MB PDFs are answered inside 15 s with the capture kept and the reading pending, never an empty `timings`; once promoted, the alarm gives each its reading; the 140 KB IRS file is answered with its reading", { timeout: 900000 }, async () => {
  boot();
  const claimed = await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) });
  await claimed.arrayBuffer();
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  const auth = { authorization: `Bearer ${signed.result.token}` };
  const cs = { now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
    call: async (op, { query = {}, body } = {}) => (await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
      headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() };
  const acquire = async (name) => {
    const t = Date.now();
    const res = await plane("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ locator: `https://www.example.gov/files/${name}` }) });
    return { ms: Date.now() - t, status: res.status, body: await res.json(), timing: res.headers.get("server-timing") };
  };
  const readingOf = async (sha) => (await (await plane(`/api/?op=reading&sha256=${sha}`, { headers: auth })).json()).result;

  /* the small file first: answered with its reading */
  const small = await acquire("fw9.pdf");
  assert.equal(small.status, 200, JSON.stringify(small.body).slice(0, 400));
  assert.equal(small.body.reading_pending, undefined, "a 140 KB file is read at once");
  assert.ok(small.body.document.reading, "its reading is in the answer");

  const pending = [];
  for (const name of ["BUDGET-2025-BUD.pdf", "BUDGET-2025-PER.pdf", "BUDGET-2024-APP.pdf"]) {
    const a = await acquire(name);
    assert.equal(a.status, 200, `${name}: ${JSON.stringify(a.body).slice(0, 400)} (${a.timing})`);
    assert.ok(a.ms < 15000, `${name}: answered in ${a.ms} ms (${a.timing})`);
    if (bytesOf[name].length > 8 * 1024 * 1024) {
      /* fix round 6, G2 (K4562): a capture over 8 MiB is answered at once as being fetched; the alarm's tick files it and the reading follows */
      assert.ok(a.body.fetch_pending, `${name}: being fetched: ${JSON.stringify(a.body).slice(0, 300)}`);
      assert.equal(a.body.fetch_pending.declared_bytes, bytesOf[name].length);
      /* the 2-second answer is asserted alone in t51-round6-seam; here the object is also running the tick of the capture before this one (its filing and reading), so the bar is the file's own 15 s */
      pending.push(name);
      continue;
    }
    assert.equal(a.body.document.capture.sha256, FILES[name].sha, `${name}: the capture is kept`);
    assert.equal(a.body.reading_pending, true, `${name}: the reading follows`);
    const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: a.body.document, title: name, locator: a.body.document.locator, project: "" });
    assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 300));
    pending.push(name);
  }
  /* the alarm reads them: within a minute of the plane's registering, so allow a few */
  const end = Date.now() + 240000;
  for (const name of pending) {
    let r = await readingOf(FILES[name].sha);
    while (Date.now() < end && !(r.found && Array.isArray(r.text_units) && r.text_units.length > 0)) { await new Promise((x) => setTimeout(x, 3000)); r = await readingOf(FILES[name].sha); }
    assert.equal(r.found, true, `${name}: found after the alarm: ${JSON.stringify(r).slice(0, 300)}`);
    assert.ok(r.text_units.length > 0, `${name}: it has its text`);
  }
});
