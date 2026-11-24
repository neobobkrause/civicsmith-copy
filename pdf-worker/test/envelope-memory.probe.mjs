/* pdf-worker R8, the envelope: the smallest V8 old space in which the committed bundle reads a PDF's text at tier 2
 * (`POST /structure`, the real handler) under raw workerd, so `MAX_PDF_BYTES` is measured and not chosen. A probe, not a
 * test (it boots workerd many times):
 *   node envelope-memory.probe.mjs <dir> <file.pdf>...
 * Each file is copied to <dir>/pdfs and served by a disk service; a CAPTURES shim fetches it into the isolate as an R2 get
 * does (`obj.arrayBuffer()`), and the handler runs with `MAX_PDF_BYTES` high enough that tier 2 is attempted. The smallest
 * `--max-old-space-size` (MB) in which the answer is a tier-2 text is found by bisection; the object's need is that heap
 * plus the file's bytes (held outside old space) under 128 MB. One line per file: bytes, heap, heap + bytes, request ms and
 * the characters read. `PROBE_BUNDLE` names the bundle to measure (default: the committed one). The numbers are recorded in
 * build/jobs/T51/pdf-worker.md. */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const [dir, ...files] = process.argv.slice(2);
if (!dir || !files.length) { console.error("usage: envelope-memory.probe.mjs <dir> <file.pdf>..."); process.exit(2); }
const BIN = here("../node_modules/.bin/");
mkdirSync(join(dir, "pdfs"), { recursive: true });
copyFileSync(process.env.PROBE_BUNDLE || here("../dist/pdf-worker.bundled.mjs"), join(dir, "pdf-worker.bundled.mjs"));
writeFileSync(join(dir, "worker.mjs"), `
import pdfWorker from "./pdf-worker.bundled.mjs";
export default { async fetch(req, env) {
  const u = new URL(req.url);
  if (u.pathname === "/idle") return Response.json({ ok: true });
  const sha = u.searchParams.get("sha");
  const CAPTURES = { get: async (key) => {
    const r = await env.DISK.fetch("http://disk/" + u.searchParams.get("f"));
    return { arrayBuffer: () => r.arrayBuffer() };
  } };
  const t = Date.now();
  const res = await pdfWorker.fetch(new Request("http://x/structure", { method: "POST", body: JSON.stringify({ capture_sha: sha, store: "bio" }) }),
    { CAPTURES, MAX_PDF_BYTES: "1073741824" });
  const j = await res.json();
  return Response.json({ ok: true, status: res.status, tier: j.tier, chars: j.text?.counts?.chars ?? null,
    undetermined: j.text?.counts?.undetermined ?? null, notes: j.notes, ms: Date.now() - t });
} };`);

async function run(file, sha, oldSpaceMB) {
  const port = 19000 + Math.floor(Math.random() * 900);
  writeFileSync(join(dir, "config.capnp"), `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .w), (name = "disk", disk = (path = ${JSON.stringify(join(dir, "pdfs"))}, writable = false))],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")],
  v8Flags = ["--max-old-space-size=${oldSpaceMB}"]);
const w :Workerd.Worker = (modules = [(name = "worker", esModule = embed "worker.mjs"), (name = "./pdf-worker.bundled.mjs", esModule = embed "pdf-worker.bundled.mjs")],
  compatibilityDate = "2026-07-01", compatibilityFlags = ["nodejs_compat"], bindings = [(name = "DISK", service = "disk")]);
`);
  const p = spawn(BIN + "workerd", ["serve", join(dir, "config.capnp")], { stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/idle`)).ok; } catch { await new Promise((r) => setTimeout(r, 200)); } }
    if (!up) return null;
    const r = await fetch(`http://127.0.0.1:${port}/?f=${file}&sha=${sha}`).then((x) => x.json()).catch(() => null);
    if (process.env.PROBE_DEBUG) console.error(oldSpaceMB, JSON.stringify(r));
    return r && r.ok && r.tier === 2 ? r : null;
  } finally { p.kill("SIGKILL"); }
}
for (const f of files) {
  const file = basename(f);
  copyFileSync(f, join(dir, "pdfs", file));
  const sha = createHash("sha256").update(readFileSync(f)).digest("hex");
  const mb = statSync(f).size / 1048576;
  let lo = 16, hi = Number(process.env.PROBE_HI || 320);
  let best = await run(file, sha, hi);
  if (!best) { console.log(`${file}: ${mb.toFixed(1)} MiB does not read at tier 2 even with ${hi} MB of old space`); continue; }
  while (hi - lo > 4) { const mid = (lo + hi) >> 1; const r = await run(file, sha, mid); if (r) { hi = mid; best = r; } else lo = mid; }
  console.log(`${file}: ${mb.toFixed(1)} MiB, tier 2 from ${hi} MB of old space; heap + bytes ~ ${(hi + mb).toFixed(0)} MB (object limit 128); ${best.ms} ms, ${best.chars} chars, ${best.undetermined} undetermined`);
}
