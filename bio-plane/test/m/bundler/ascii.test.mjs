/* bundler G39: a fleet bundle is pure ASCII (R2, R4, R6 as T51 fix round 6 amends them). Each test drives the module's
 * interface: buildMember over a fixture member and over the real fleet, and the plane's own bundle in raw workerd. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as bundler from "../../../scripts/fleet-bundle.mjs";
import { tokenizer, tokTypes } from "../../../src/setup-words/vendor/acorn.mjs";

const { discoverMembers, buildMember, manifestFrom, verifyStatic, planeMember, REPO_ROOT } = bundler;
const tmp = (tag) => mkdtempSync(join(tmpdir(), `bundler-ascii-${tag}-`));
const nonAscii = (buf) => { for (let i = 0; i < buf.length; i++) if (buf[i] > 0x7f) return i; return -1; };

/** A fixture member whose source holds non-ASCII in every place a bundle can: a comment, a string, a regex (BMP and
 *  astral, with and without `u`), an untagged and a tagged (`String.raw`) template, and a licence banner. */
const SOURCE = [
  "/*! LICENCE (c) fixture: kept */",
  "// a comment with an em dash — and a box rule ──",
  "/* a block comment § */",
  "export const STR = 'dash — section § astral 😀';",
  "export const TPL = `cooked — ${STR.length} é`;",
  "export const RAW = String.raw`raw \\n — ${STR.length}`;",
  "const tag = (s, ...v) => s.raw.join('|') + s.join('|') + v.join(',');",
  "export const TAGGED = tag`a—${1}bé`;",
  "export const RE_BMP = /[−–—]+/g;",
  "export const RE_CLASS = /(?:[$€£¥])\\s?\\d+/i;",
  "export const RE_U = /\\p{L}+’s/u;",
  "export const RE_ASTRAL_U = /^😀+$/u;",
  "export const RE_ASTRAL = /😀/;",
  "export default { fetch() { return new Response('ok'); } };",
  "",
].join("\n");

function fixtureMember(root, { marker = true, ascii } = {}) {
  const abs = join(root, "probe");
  mkdirSync(join(abs, "src"), { recursive: true });
  writeFileSync(join(abs, "src/index.mjs"), SOURCE);
  writeFileSync(join(abs, "package-lock.json"), JSON.stringify({ name: "probe", lockfileVersion: 3 }) + "\n");
  const bundle = { entry: "src/index.mjs", outfile: "dist/probe.bundled.mjs", manifest: "dist/probe.bundle.json" };
  if (ascii !== undefined) bundle.ascii = ascii;
  writeFileSync(join(abs, "fleet-member.json"), JSON.stringify({ name: "probe", entry: "src/index.mjs", bundle }));
  const m = discoverMembers(root).find((x) => x.name === "probe");
  if (!marker) delete m.marker;
  return m;
}

const load = async (bytes, dir, name) => {
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return import(pathToFileURL(p).href);
};

test("R2 (G39): a member's built bundle holds no byte over 0x7F: comments stripped, templates lowered, every remaining character escaped", async () => {
  const root = tmp("pure");
  try {
    const built = await buildMember(fixtureMember(root), { write: false });
    assert.equal(nonAscii(built.bytes), -1, "a non-ASCII byte is in the bundle");
    const text = built.bytes.toString("utf8");
    assert.ok(!/a comment with an em dash/.test(text) && !/block comment/.test(text), "comments are stripped");
    assert.ok(text.includes("LICENCE (c) fixture"), "the licence banner is kept");
    assert.ok(!text.includes("`"), "no template literal is left");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R2 (G39): the ASCII bundle behaves as the source does: strings, templates, String.raw and tagged templates equal in value; every regex has the same pattern and flags once its escapes are read", async () => {
  const root = tmp("same");
  try {
    const on = await buildMember(fixtureMember(root), { write: false });
    const off = await buildMember(fixtureMember(root, { ascii: false }), { write: false });
    assert.notEqual(nonAscii(off.bytes), -1, "control: the opt-out build keeps the non-ASCII");
    const a = await load(on.bytes, root, "on.mjs"), b = await load(off.bytes, root, "off.mjs");
    for (const k of ["STR", "TPL", "RAW", "TAGGED"]) assert.equal(a[k], b[k], k);
    const unesc = (s) => s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, x, y) => String.fromCodePoint(parseInt(x || y, 16)));
    for (const k of ["RE_BMP", "RE_CLASS", "RE_U", "RE_ASTRAL_U", "RE_ASTRAL"]) {
      assert.equal(a[k].flags, b[k].flags, `${k} flags`);
      assert.equal(a[k].source.includes("\\u") ? unesc(a[k].source).normalize() : a[k].source, unesc(b[k].source).normalize(), `${k} source`);
    }
    for (const [k, yes, no] of [["RE_BMP", "a—b", "a-b"], ["RE_CLASS", "€ 5", "x 5"], ["RE_U", "Paul’s", "Paul's"],
      ["RE_ASTRAL_U", "😀😀", "😀\ud83d"], ["RE_ASTRAL", "x😀", "x\ud83d"]]) {
      assert.equal(a[k].test(yes), b[k].test(yes), `${k} on ${JSON.stringify(yes)}`);
      assert.equal(a[k].test(no), b[k].test(no), `${k} on ${JSON.stringify(no)}`);
      assert.equal(a[k].test(yes), true);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R2 (G39): a non-ASCII character the pass cannot escape without changing the program (an unlowered template's raw text) refuses the build, never edits it", () => {
  assert.equal(typeof bundler.asciiOutput, "function", "asciiOutput is provided");
  assert.deepEqual(bundler.asciiOptions(), { charset: "ascii", legalComments: "eof", minifyWhitespace: true, supported: { "template-literal": false } });
  assert.throws(() => bundler.asciiOutput(Buffer.from("export const x = `raw — ${1}`;\n")), /NON_ASCII_REMAINS/);
  assert.throws(() => bundler.asciiOutput(Buffer.from("export const café = 1;\n")), /NON_ASCII_REMAINS/);
  const ok = bundler.asciiOutput(Buffer.from("export const x = \"a—b\"; export const r = /[—😀]/u; const d = 4 / 2 / 1;\n"));
  assert.equal(ok.toString("utf8"), "export const x = \"a\\u2014b\"; export const r = /[\\u2014\\u{1f600}]/u; const d = 4 / 2 / 1;\n");
});

test("R2 (G39): the standalone case checker's descriptor (neither a fleet member nor the plane) keeps its form, and bundle.ascii overrides either way", async () => {
  const root = tmp("optout");
  try {
    const alone = await buildMember(fixtureMember(root, { marker: false }), { write: false });
    assert.notEqual(nonAscii(alone.bytes), -1, "a descriptor that is not a fleet member is not made ASCII");
    assert.ok(alone.bytes.toString("utf8").includes("`"), "its templates stay unlowered");
    const forced = await buildMember(fixtureMember(root, { marker: false, ascii: true }), { write: false });
    assert.equal(nonAscii(forced.bytes), -1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R4 (G39): the manifest's recipe records the ASCII options, and R6: a committed manifest without them is stale", async () => {
  const root = tmp("recipe");
  try {
    const m = fixtureMember(root);
    const built = await buildMember(m, { write: true });
    const manifest = manifestFrom(m, built);
    assert.ok(manifest.recipe.ascii && typeof manifest.recipe.ascii === "object", "recipe.ascii is recorded");
    assert.deepEqual(Object.keys(manifest.recipe.ascii).sort(), ["charset", "legalComments", "minifyWhitespace", "templateLiterals"]);
    writeFileSync(join(m.abs, m.bundle.manifest), JSON.stringify(manifest, null, 2));
    assert.deepEqual(verifyStatic(m).findings, []);
    const old = { ...manifest, recipe: { ...manifest.recipe } };
    delete old.recipe.ascii;
    writeFileSync(join(m.abs, m.bundle.manifest), JSON.stringify(old, null, 2));
    assert.ok(verifyStatic(m).findings.some((f) => /recipe\.ascii/.test(f)), "a manifest recording no ASCII recipe is named stale");
    const off = fixtureMember(root, { ascii: false });
    const offBuilt = await buildMember(off, { write: false });
    assert.equal(manifestFrom(off, offBuilt).recipe.ascii, false, "the opt-out records false");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R2 (G39): the plane and every real fleet member build to a pure-ASCII bundle", async () => {
  const members = [planeMember(), ...discoverMembers(REPO_ROOT).filter((m) => m.bundle)];
  assert.ok(members.length >= 7, "plane and six members");
  for (const m of members) {
    let built;
    try { built = await buildMember(m, { write: false }); }
    catch (e) { assert.fail(`${m.name} cannot be built here (npm ci in ${m.dir}/): ${String(e.message).split("\n")[0]}`); }
    assert.equal(nonAscii(built.bytes), -1, `${m.name}: a byte over 0x7F at ${nonAscii(built.bytes)}`);
  }
});

test("R2 (G39): every regex literal of the real plane keeps its pattern and flags once its escapes are read (the sites with a literal non-ASCII character among them)", async () => {
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

test("R8 (G39): unresolvableSpecifiers still lists an undeclared external in a minified ASCII bundle, and nothing for the declared ones", async () => {
  const root = tmp("spec");
  try {
    const m = fixtureMember(root);
    writeFileSync(join(m.abs, "src/index.mjs"), 'import { env } from "cloudflare:workers";\nimport { x } from "somewhere-else";\nimport fs from "node:fs";\n'
      + 'export default { fetch() { return new Response(String(x) + typeof env + typeof fs); } };\n');
    m.bundle.external = ["cloudflare:workers", "node:*", "somewhere-else"];
    const text = (await buildMember(m, { write: false })).bytes.toString("utf8");
    assert.deepEqual(bundler.unresolvableSpecifiers(text, ["cloudflare:workers", "node:*"]), ["somewhere-else"]);
    assert.deepEqual(bundler.unresolvableSpecifiers(text, m.bundle.external), []);
    assert.deepEqual(bundler.unresolvableSpecifiers('function f(){return 1}import{y}from"after-a-brace";export{f}', []), ["after-a-brace"], "a statement after a closing brace");
  } finally { rmSync(root, { recursive: true, force: true }); }
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

test("R2 (G39): the plane's bundle boots and answers one store op in raw workerd with V8's old space capped at 60 MB (the unstripped bundle needs 86)", { timeout: 300000 }, async () => {
  assert.ok(existsSync(WORKERD), "workerd is installed in bio-plane/node_modules (npm ci)");
  const root = tmp("workerd");
  try {
    const built = await buildMember(planeMember(), { write: false });
    const r = await bootsAt(built.bytes, 60, join(root, "at60"));
    assert.ok(r.ok, `the plane does not boot at a 60 MB old space: ${r.why}`);
    assert.equal(nonAscii(built.bytes), -1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
