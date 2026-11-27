/* pdf-reader R43 (fix round 6, G26): the smallest V8 old space in which `extractPdfRange` reads a whole PDF N pages a call
 * under workerd (every range in turn, the file's bytes held once beside), a probe, not a test (it boots workerd):
 *   node workerd-range.probe.mjs <dir> <pdf path> [pagesPerCall=100]
 * The object's need is that old space + the file's bytes, under 128 MB less the plane's own baseline. */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, basename } from "node:path";

/** What the worker answers: whether `ok` is set, and for a reading the pages, characters, calls and the slowest call's milliseconds.
 *  @typedef {{ ok: boolean, pages: number | undefined, chars: number | undefined, calls: number | undefined, slowest: number | undefined }} ProbeAnswer */
/** A number the worker answered, or undefined where it answered none; a thrown failure naming `what` for anything else.
 *  @param {unknown} v
 *  @param {string} what
 *  @returns {number | undefined} */
function numberOrNone(v, what) {
  if (v !== undefined && typeof v !== "number") throw new Error(`${what}: not a number`);
  return v;
}
/** The JSON object a text holds, or null where it holds another value.
 *  @param {string} text
 *  @returns {object | null} */
function objectIn(text) {
  /** @type {unknown} */
  const v = JSON.parse(text);
  return typeof v === "object" ? v : null;
}
/** The worker's answer, read from its text (`ok` false where it is not an object); a thrown failure naming a member that is
 *  not a number.
 *  @param {string} text
 *  @returns {ProbeAnswer} */
function probeAnswer(text) {
  const v = objectIn(text);
  if (v === null) return { ok: false, pages: undefined, chars: undefined, calls: undefined, slowest: undefined };
  return { ok: "ok" in v ? !!v.ok : false, pages: numberOrNone("pages" in v ? v.pages : undefined, "pages"), chars: numberOrNone("chars" in v ? v.chars : undefined, "chars"),
    calls: numberOrNone("calls" in v ? v.calls : undefined, "calls"), slowest: numberOrNone("slowest" in v ? v.slowest : undefined, "slowest") };
}

/** @param {string} p
 *  @returns {string} */
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const [dirArg, path, n = "100"] = process.argv.slice(2);
if (!dirArg || !path) { console.error("usage: workerd-range.probe.mjs <dir> <pdf> [pages per call]"); process.exit(2); throw new Error("usage"); }
const dir = dirArg;
const BIN = here("../../../node_modules/.bin/");
/** A pause of `ms` milliseconds while workerd starts.
 *  @param {number} ms
 *  @returns {Promise<void>} */
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(join(dir, "pdfs"), { recursive: true });
writeFileSync(join(dir, "worker.mjs"), `
import { extractPdfRange } from ${JSON.stringify(here("../../../src/pdfstructure.mjs"))};
export default { async fetch(req, env) {
  const u = new URL(req.url);
  if (u.pathname === "/idle") return Response.json({ ok: true });
  const r = await env.DISK.fetch("http://disk/" + u.searchParams.get("f"));
  const bytes = new Uint8Array(await r.arrayBuffer());
  const count = Number(u.searchParams.get("n"));
  let pages = 0, chars = 0, slowest = 0, calls = 0;
  for (let from = 0; ; from += count) {
    const t0 = Date.now();
    const x = await extractPdfRange(bytes, { from, count });
    slowest = Math.max(slowest, Date.now() - t0); calls++;
    pages = x.pages; chars += x.text.counts.chars;
    if (x.count === 0 || from + count >= x.pages) break;
  }
  return Response.json({ ok: true, pages, chars, calls, slowest });
} };`);
execFileSync(BIN + "esbuild", [join(dir, "worker.mjs"), "--bundle", "--format=esm", "--platform=neutral", "--main-fields=module,main",
  "--conditions=workerd,worker,import", "--external:node:*", `--outfile=${join(dir, "worker.bundle.mjs")}`, "--log-level=warning"]);
const file = basename(path);
copyFileSync(path, join(dir, "pdfs", file));
/** The worker's answer with `oldSpaceMB` of V8 old space, or null when it did not complete.
 *  @param {number} oldSpaceMB
 *  @returns {Promise<ProbeAnswer | null>} */
async function run(oldSpaceMB) {
  const port = 19000 + Math.floor(Math.random() * 900);
  writeFileSync(join(dir, "config.capnp"), `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .w), (name = "disk", disk = (path = ${JSON.stringify(join(dir, "pdfs"))}, writable = false))],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")],
  v8Flags = ["--max-old-space-size=${oldSpaceMB}"]);
const w :Workerd.Worker = (modules = [(name = "worker", esModule = embed "worker.bundle.mjs")],
  compatibilityDate = "2026-07-01", compatibilityFlags = ["nodejs_compat"], bindings = [(name = "DISK", service = "disk")]);
`);
  const p = spawn(BIN + "workerd", ["serve", join(dir, "config.capnp")], { stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/idle`)).ok; } catch { await pause(200); } }
    if (!up) return null;
    return await fetch(`http://127.0.0.1:${port}/?f=${file}&n=${n}`).then((x) => x.text()).then(probeAnswer).catch(() => null);
  } finally { p.kill("SIGKILL"); }
}
let lo = 16, hi = Number(process.env.PROBE_HI || 320);
const top = await run(hi);
if (!top || !top.ok) { console.log(`${file}: does not complete even with ${hi} MB of old space`); process.exit(1); }
while (hi - lo > 4) { const mid = (lo + hi) >> 1; const r = await run(mid); if (r && r.ok) hi = mid; else lo = mid; }
const mb = statSync(join(dir, "pdfs", file)).size / 1048576;
console.log(`${file}: ${top.pages} pages, ${mb.toFixed(1)} MB, ${top.calls} calls of ${n}, slowest ${top.slowest} ms, ${top.chars} chars: completes from ${hi} MB of old space; + bytes ~ ${(hi + mb).toFixed(0)} MB (object 128, less 20 for the plane: 108)`);
