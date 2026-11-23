/* bundler G39 over the real plane and fleet: bundler's own fixture tests prove R2's pure-ASCII recipe; these hold the
 * plane and every real member to it, each built afresh from its source (never a committed bundle: release R46), and
 * boot the plane's bundle in raw workerd. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as bundler from "../../../scripts/fleet-bundle.mjs";
import { tokenizer, tokTypes } from "../../../src/setup-words/vendor/acorn.mjs";

const { discoverMembers, buildMember, planeMember, REPO_ROOT } = bundler;
const tmp = (tag) => mkdtempSync(join(tmpdir(), `bundler-ascii-${tag}-`));
const nonAscii = (buf) => { for (let i = 0; i < buf.length; i++) if (buf[i] > 0x7f) return i; return -1; };

test("bundler R2 (G39): the plane and every real fleet member build to a pure-ASCII bundle", async () => {
  const members = [planeMember(), ...discoverMembers(REPO_ROOT).filter((m) => m.bundle)];
  assert.ok(members.length >= 7, "plane and six members");
  for (const m of members) {
    let built;
    try { built = await buildMember(m, { write: false }); }
    catch (e) { assert.fail(`${m.name} cannot be built here (npm ci in ${m.dir}/): ${String(e.message).split("\n")[0]}`); }
    assert.equal(nonAscii(built.bytes), -1, `${m.name}: a byte over 0x7F at ${nonAscii(built.bytes)}`);
  }
});

test("bundler R2 (G39): every regex literal of the real plane keeps its pattern and flags once its escapes are read (the sites with a literal non-ASCII character among them)", async () => {
  const on = (await buildMember(planeMember(), { write: false })).bytes.toString("utf8");
  const plane = planeMember();
  plane.bundle = { ...plane.bundle, ascii: false };
  const off = (await buildMember(plane, { write: false })).bytes.toString("utf8");
  const regexes = (text) => {
    const out = [];
    for (const t of tokenizer(text, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }))
      if (t.type === tokTypes.regexp) out.push({ source: t.value.pattern, flags: t.value.flags, raw: text.slice(t.start, t.end) });
    return out;
  };
  const unesc = (s) => s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, x, y) => String.fromCodePoint(parseInt(x || y, 16)));
  const a = regexes(on), b = regexes(off);
  assert.equal(a.length, b.length, "the same regex literals");
  let changed = 0;
  a.forEach((r, i) => {
    assert.equal(r.flags, b[i].flags, `regex ${i} flags`);
    if (r.raw !== b[i].raw) {
      changed++;
      assert.equal(unesc(r.source).normalize(), unesc(b[i].source).normalize(), `regex ${i} pattern ${b[i].raw}`);
      assert.doesNotMatch(r.raw, /[^\x00-\x7f]/);
    }
  });
  assert.ok(changed >= 20, `the plane has the escaped sites the plan counts (about 20); found ${changed}`);
});

const WORKERD = join(REPO_ROOT, "bio-plane", "node_modules", ".bin", "workerd");

/** Boot `bytes` as the plane in raw workerd with V8's old space capped at `cap` MB, and ask `/version` and one Store op.
 *  Resolves `{ok, why}`. */
async function bootsAt(bytes, cap, dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "plane.mjs"), bytes);
  writeFileSync(join(dir, "main.mjs"),
    'import real, { Store as RealStore } from "plane";\n'
    + 'export class Store extends RealStore { async ping() { return JSON.stringify({ ok: true, alarm: await this.schedAlarmAt() }); } }\n'
    + 'export default { async fetch(req, env) { const u = new URL(req.url);\n'
    + '  if (u.pathname === "/store") return new Response(await env.STORE.get(env.STORE.idFromName("town")).ping());\n'
    + '  return real.fetch(req, env); } };\n');
  const port = 20000 + Math.floor(Math.random() * 20000);
  writeFileSync(join(dir, "w.capnp"), `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .w), (name = "disk", disk = (path = "${join(dir, "disk")}", writable = true))],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")],
  v8Flags = ["--max-old-space-size=${cap}"]
);
const w :Workerd.Worker = (
  modules = [(name = "main.mjs", esModule = embed "main.mjs"), (name = "plane", esModule = embed "plane.mjs")],
  compatibilityDate = "2026-07-01", compatibilityFlags = ["nodejs_compat"],
  durableObjectNamespaces = [(className = "Store", uniqueKey = "g39", enableSql = true)],
  durableObjectStorage = (localDisk = "disk"),
  bindings = [(name = "STORE", durableObjectNamespace = "Store")],
);
`);
  mkdirSync(join(dir, "disk"), { recursive: true });
  const child = spawn(WORKERD, ["serve", "--experimental", join(dir, "w.capnp")], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  child.stdout.on("data", (d) => { log += d; }); child.stderr.on("data", (d) => { log += d; });
  const get = async (path) => {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(20000) }); return { status: r.status, text: await r.text() }; }
      catch { if (child.exitCode !== null) return { status: 0, text: "workerd exited" }; await new Promise((r) => setTimeout(r, 500)); }
    }
    return { status: 0, text: "no answer" };
  };
  try {
    const v = await get("/version");
    if (!/^\d+\.\d+\.\d+/.test(v.text.trim())) return { ok: false, why: `/version ${v.status} ${v.text.slice(0, 80)} ${log.slice(0, 700)}` };
    const s = await get("/store");
    return s.status === 200 && /"ok":true/.test(s.text) ? { ok: true } : { ok: false, why: `/store ${s.status} ${s.text.slice(0, 120)} ${log.slice(0, 700)}` };
  } finally {
    /* K4828: kill the whole process group. Where `.bin/workerd` is a Node shim (npm ci --ignore-scripts), killing the
       child alone orphans the real workerd on the test's pipes and the file never exits. */
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    child.stdout.destroy(); child.stderr.destroy();
  }
}

test("bundler R2 (G39): the plane's bundle boots and answers one store op in raw workerd with V8's old space capped at 60 MB (the unstripped bundle needs 86)", { timeout: 300000 }, async () => {
  assert.ok(existsSync(WORKERD), "workerd is installed in bio-plane/node_modules (npm ci)");
  const root = tmp("workerd");
  try {
    const built = await buildMember(planeMember(), { write: false });
    const r = await bootsAt(built.bytes, 60, join(root, "at60"));
    assert.ok(r.ok, `the plane does not boot at a 60 MB old space: ${r.why}`);
    assert.equal(nonAscii(built.bytes), -1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
