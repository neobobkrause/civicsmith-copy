/* pdf-worker's range and envelope, R6, R8, R9, R42 and R44 of build/requirements/pdf-worker.md (fix round 9, G132h, G124a;
 * CF-35; K4834): the member is asked for a range of pages, judges the file's size before any parse, opens the file once
 * through pdf-reader, and decodes at tier 2 only the pages asked.
 *
 * The counts are the ones the modules keep (R-CLOCK): `pdfWork()` (pdf-reader: scans of the file), `tier2Work()` (this
 * member: documents pdf.js opened, pages it decoded), and how many times the stored body was read; never a time. The
 * subject is the source (imported in node) for the counts, and a fresh build of it under workerd (`subject.mjs`) for the
 * runtime the member serves in. The documents are pdfgen's (test-support R19), whose truth is each page's own lines. */
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pdfWork } from "../../bio-plane/src/pdfstructure.mjs";
import { boundOf, statement } from "../../bio-plane/src/read-bounds.mjs";
import { generate } from "../../bio-plane/test/pdfgen.mjs";
import worker, { tier2Work } from "../src/index.mjs";
import { runner, hex } from "./make-pdf.mjs";
import { BUNDLE } from "./subject.mjs";

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  return await import(pathToFileURL(createRequire(planePkg).resolve("miniflare")).href);
})();
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const { t, finish } = runner("range");

const make = async (recipe) => { const g = generate({ kind: "pdf", seed: "rg", ...recipe }); return { bytes: await g.bytes(), truth: g.truth }; };
const delta = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - a[k]]));

/* A node env over a map of objects: `stated` gives the object a `size` (as R2's has), and every body read is counted. */
function envOf(objects, { stated = true, ...extra } = {}) {
  const log = { gets: [], reads: 0 };
  const CAPTURES = {
    get: async (key) => {
      log.gets.push(key);
      const b = objects[key];
      return b ? { ...(stated ? { size: b.length } : {}), arrayBuffer: async () => { log.reads++; return b.slice().buffer; } } : null;
    },
  };
  return { env: { CAPTURES, ...extra }, log };
}
const call = async (env, body) => {
  const res = await worker.fetch(new Request("http://pdf-worker/structure", { method: "POST", body: JSON.stringify(body) }), env);
  return [res.status, await res.json()];
};
const counted = async (fn) => {
  const p0 = pdfWork(), w0 = tier2Work();
  const out = await fn();
  return { out, pdf: delta(p0, pdfWork()), tier2: delta(w0, tier2Work()) };
};

const TEN = await make({ size: { pages: 10, lines: 4 } });
const TEN_SHA = hex(TEN.bytes);
const line = (truth, p, l) => truth.page(p).lines[l - 1];
const mark = (p) => `rg-p${p}-l1`;
const objects = { [`bio/captures/${TEN_SHA}`]: TEN.bytes };
const ask = (extra = {}) => ({ capture_sha: TEN_SHA, store: "bio", ...extra });

console.log("\n--- R42: the range asked ---");
{
  const { env } = envOf(objects);
  const r = await counted(() => call(env, ask({ from: 3, count: 3 })));
  const [st, out] = r.out;
  t("R42 a range of 3 pages: 200, tier 2, the document's total, from and count", [st, out.ok, out.tier, out.pages, out.from, out.count], [200, true, 2, 10, 3, 3]);
  t("R42 the answer holds those 3 pages only, by their numbers", out.text.pages.map((p) => p.page), [3, 4, 5]);
  t("R42 their words are the pages' own and no other page's",
    [out.text.document.includes(line(TEN.truth, 4, 1)), out.text.document.includes(line(TEN.truth, 6, 4)),
     [1, 2, 3, 7, 8, 9, 10].some((p) => out.text.document.includes(mark(p)))], [true, true, false]);
  t("R42 tier 2 decoded 3 pages, in one open of the file", r.tier2, { opens: 1, pagesDecoded: 3 });
  t("R6 pdf-reader scanned the file once, for the range (no whole-file tier-1 parse beside the tier-2 pass)", r.pdf.scans, 1);

  const whole = await counted(() => call(env, ask()));
  t("R42 with neither field the whole document is the range", [whole.out[1].from, whole.out[1].count, whole.out[1].text.pages.length], [0, 10, 10]);
  t("R42 (and tier 2 decoded each page once)", whole.tier2, { opens: 1, pagesDecoded: 10 });

  const clamp = await counted(() => call(env, ask({ from: 8, count: 50 })));
  t("R42 count is clamped to the pages left", [clamp.out[1].from, clamp.out[1].count, clamp.out[1].text.pages.map((p) => p.page)], [8, 2, [8, 9]]);
  t("R42 (and only those 2 pages were decoded)", clamp.tier2.pagesDecoded, 2);

  const rest = await call(env, ask({ from: 7 }));
  t("R42 count defaults to the pages left", [rest[1].from, rest[1].count], [7, 3]);

  const past = await counted(() => call(env, ask({ from: 50 })));
  t("R42 a from past the end answers no pages, decoding none and opening nothing",
    [past.out[0], past.out[1].ok, past.out[1].count, past.out[1].text.pages, past.tier2], [200, true, 0, [], { opens: 0, pagesDecoded: 0 }]);

  const zero = await counted(() => call(env, ask({ from: 2, count: 0 })));
  t("R42 count 0 is a valid range of no pages", [zero.out[0], zero.out[1].count, zero.tier2.pagesDecoded], [200, 0, 0]);

  for (const [label, extra] of [
    ["from -1", { from: -1 }], ["from 1.5", { from: 1.5 }], ["from a string", { from: "2" }], ["from null", { from: null }],
    ["count -1", { count: -1 }], ["count 2.5", { count: 2.5 }], ["count a string", { count: "3" }], ["count null", { count: null }],
    ["count true", { count: true }], ["count an array", { count: [1] }],
  ]) {
    const e = envOf(objects);
    const [bst, bout] = await call(e.env, ask(extra));
    t(`R42 ${label}: 400 BAD_RANGE, before the capture is read`, [bst, bout.ok, bout.reason, e.log.gets], [400, false, "BAD_RANGE", []]);
  }
  const order = envOf(objects);
  t("R42 BAD_RANGE is checked after R4 (an unknown namespace is named first)",
    (await call(order.env, ask({ store: "biosmoke", from: -1 })))[1].reason, "NAMESPACE_UNKNOWN");
  t("R42 BAD_RANGE is checked after R2 (a bad sha is named first)",
    (await call(order.env, ask({ capture_sha: "zz", from: -1 })))[1].reason, "BAD_SHA");
  t("R42 BAD_RANGE is checked before R5 (an absent capture with a bad range is BAD_RANGE)",
    (await call(order.env, ask({ capture_sha: "a".repeat(64), count: -1 })))[1].reason, "BAD_RANGE");
  t("R42 (and an absent capture with a good range is NOT_FOUND)",
    (await call(order.env, ask({ capture_sha: "a".repeat(64), count: 1 })))[1].reason, "NOT_FOUND");
}

console.log("\n--- R42 under workerd: the same range through the built member ---");
{
  const mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: BUNDLE, script: readFileSync(BUNDLE, "utf8"),
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"], r2Buckets: ["CAPTURES"],
  });
  await (await mf.getR2Bucket("CAPTURES")).put(`bio/captures/${TEN_SHA}`, TEN.bytes);
  const res = await mf.dispatchFetch("http://pdf-worker/structure", { method: "POST", body: JSON.stringify(ask({ from: 3, count: 3 })) });
  const out = await res.json();
  t("R42 workerd: 3 pages [3, 4, 5] of 10 at tier 2, with their words",
    [res.status, out.tier, out.pages, out.text.pages.map((p) => p.page), out.text.document.includes(line(TEN.truth, 5, 2))], [200, 2, 10, [3, 4, 5], true]);
  const bad = await mf.dispatchFetch("http://pdf-worker/structure", { method: "POST", body: JSON.stringify(ask({ from: -1 })) });
  t("R42 workerd: BAD_RANGE", [bad.status, (await bad.json()).reason], [400, "BAD_RANGE"]);
  await mf.dispose();
}

console.log("\n--- R6 and R8: the envelope is judged before any parse ---");
{
  const max = TEN.bytes.length - 1;
  for (const stated of [true, false]) {
    const { env, log } = envOf(objects, { stated, MAX_PDF_BYTES: String(max) });
    const r = await counted(() => call(env, ask({ from: 3, count: 3 })));
    const [st, out] = r.out;
    t(`R6 a file over the envelope (size ${stated ? "stated by the store" : "known by reading the body"}): no parse made at all`,
      [r.pdf, r.tier2], [{ scans: 0, objectStreamLoads: 0, innerDecodes: 0 }, { opens: 0, pagesDecoded: 0 }]);
    t(`R6 (the body is read ${stated ? "never, the store's own size being enough" : "once, to learn its size"})`, log.reads, stated ? 0 : 1);
    t("R8 the answer is 200, tier 1, final, with the over_envelope marker naming size and limit",
      [st, out.ok, out.tier, out.failure, out.text.undetermined, out.notes],
      [200, true, 1, "final", [{ page: null, reason: "over_envelope", font: null, codes: "", count: 0, bytes: TEN.bytes.length, limit: max }], ["tier2_declined_over_envelope"]]);
    t("R8 the refusal states the size, the limit and the table row's key, and a sentence for the member",
      [out.refusal.size, out.refusal.bound, out.refusal.key, typeof out.refusal.detail === "string" && out.refusal.detail.length > 0],
      [TEN.bytes.length, max, statement("pdf", "worker_bytes", 1).key, true]);
  }
  const NOT_PDF = new TextEncoder().encode("this is not a pdf at all, and it is over the envelope");
  const np = envOf({ [`bio/captures/${hex(NOT_PDF)}`]: NOT_PDF }, { MAX_PDF_BYTES: "10" });
  const [nst, nout] = await call(np.env, { capture_sha: hex(NOT_PDF), store: "bio" });
  t("R6 (a file over the envelope is answered by R8 without being opened, even if it is not a PDF)", [nst, nout.tier, nout.text.undetermined[0].reason], [200, 1, "over_envelope"]);

  const at = envOf(objects, { MAX_PDF_BYTES: String(TEN.bytes.length) });
  t("R8 exactly the envelope is within it", (await call(at.env, ask()))[1].tier, 2);
}

console.log("\n--- R8 and R44: the default envelope is the table's ---");
{
  const bound = boundOf("pdf", "worker_bytes");
  /* the store states a size one over the table's figure: nothing is allocated, nothing parsed */
  const big = { length: bound + 1, slice() { throw new Error("the body must not be read"); } };
  const sha = "b".repeat(64);
  const { env, log } = envOf({ [`bio/captures/${sha}`]: big });
  const r = await counted(() => call(env, { capture_sha: sha, store: "bio" }));
  const [st, out] = r.out;
  t("R8 one byte over boundOf('pdf', 'worker_bytes'): declined with the size and that figure",
    [st, out.tier, out.refusal.size, out.refusal.bound, out.refusal.key, out.text.undetermined[0].limit], [200, 1, bound + 1, bound, "limit.pdf.worker_bytes", bound]);
  t("R8 (nothing was read or parsed)", [log.reads, r.pdf.scans, r.tier2.opens], [0, 0, 0]);
  t("R8 the figure is 64 MiB, the alpha column's", bound, 64 * 1024 * 1024);

  /* R44: no numeric literal of the module's own is a ceiling it keeps */
  const code = readFileSync(here("../src/index.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const literals = [...code.matchAll(/(?<![\w.$"'-])(\d[\d_]*(?:\.\d+)?(?:e\d+)?)(?![\w"'])/gi)].map((m) => Number(m[1].replace(/_/g, ""))).filter((n) => n >= 1000);
  t("R44 no numeric literal of 1,000 or more in src/index.mjs", literals, []);
  t("R44 the envelope constant is read from the table by its row", /DEFAULT_MAX_PDF_BYTES\s*=\s*boundOf\(\s*"pdf"\s*,\s*"worker_bytes"\s*\)/.test(code), true);
  t("R44 the member imports the table from runtime-limits' file", /from\s+"\.\.\/\.\.\/bio-plane\/src\/read-bounds\.mjs"/.test(code), true);
}

console.log("\n--- R9: the range at tier 2, in fonts tier 1 cannot decode, and encrypted documents ---");
{
  const FONTS = await make({ size: { pages: 6, lines: 5 }, fonts: ["winansi", "macroman"] });
  const sha = hex(FONTS.bytes);
  const { env } = envOf({ [`bio/captures/${sha}`]: FONTS.bytes });
  const r = await counted(() => call(env, { capture_sha: sha, store: "bio", from: 2, count: 3 }));
  const [st, out] = r.out;
  t("R9 WinAnsi and MacRoman pages with no ToUnicode: the 3 pages of the range, tier 2", [st, out.tier, out.text.pages.map((p) => p.page)], [200, 2, [2, 3, 4]]);
  /* (pdf.js reads the ligature letters `ﬁ` and `ﬂ` as the two letters they stand for) */
  t("R9 every line of those pages is read, none of the others'",
    [[3, 4, 5].every((p) => FONTS.truth.page(p).lines.every((l) => out.text.document.includes(l.normalize("NFKC")))), [1, 2, 6].some((p) => out.text.document.includes(`rg-p${p}-l`))], [true, false]);
  t("R9 only those 3 pages were decoded", r.tier2.pagesDecoded, 3);

  for (const method of ["rc4", "aes"]) {
    const OPEN = await make({ size: { pages: 3, lines: 4 }, encryption: { method, user: "" } });
    const s1 = hex(OPEN.bytes);
    const o = await call(envOf({ [`bio/captures/${s1}`]: OPEN.bytes }).env, { capture_sha: s1, store: "bio" });
    t(`R9 ${method}: a document whose password is empty is decrypted and its pages read`,
      [o[0], o[1].tier, o[1].text.pages.length, [1, 2, 3].every((p) => OPEN.truth.page(p).lines.every((l) => o[1].text.document.includes(l)))], [200, 2, 3, true]);

    const LOCKED = await make({ size: { pages: 3, lines: 4 }, encryption: { method, user: "secret" } });
    const s2 = hex(LOCKED.bytes);
    const l = await call(envOf({ [`bio/captures/${s2}`]: LOCKED.bytes }).env, { capture_sha: s2, store: "bio" });
    t(`R9 ${method}: a document that needs a user password is stated, tier 1, nothing invented`,
      [l[0], l[1].ok, l[1].tier, l[1].text], [200, true, 1, {
        document: "", pages: [], undetermined: [{ page: null, reason: "password_required", font: null, codes: "", count: 0 }],
        counts: { chars: 0, undetermined: 1 } }]);
    t(`R9 ${method}: that is not a tier-2 failure (no tier2_error note)`, l[1].notes.some((n) => n.startsWith("tier2_error")), false);
  }
}

finish();
