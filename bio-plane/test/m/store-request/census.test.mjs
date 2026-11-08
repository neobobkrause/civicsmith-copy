/* store-request R21, R22: what the module imports, and the split's second half. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SRC = join(ROOT, "bio-plane/src/store-request");
const MODULES = JSON.parse(readFileSync(join(ROOT, "build/modules.json"), "utf8")).modules;
const order = MODULES.map((m) => m.id);
const ownerOf = (file) => {
  const rel = relative(ROOT, file);
  const hit = MODULES.filter((m) => m.paths.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)));
  return hit.length === 1 ? hit[0].id : null;
};
const importsOf = (text) => [...text.matchAll(/(?:^|\n)\s*(?:import|export)[^"'`;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
const census = (files) => {
  const out = [];
  for (const f of files) for (const spec of importsOf(readFileSync(f, "utf8"))) {
    if (!spec.startsWith(".")) { out.push({ file: f, spec, module: spec.startsWith("node:") ? "node" : `platform:${spec}` }); continue; }
    const target = resolve(dirname(f), spec);
    if (target.startsWith(SRC)) continue;
    out.push({ file: f, spec, module: ownerOf(target) });
  }
  return out;
};

test("R21: store-request imports only modules earlier than itself in build/modules.json, and no module of the platform", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => join(SRC, f));
  assert.ok(files.length >= 1);
  const me = order.indexOf("store-request");
  assert.ok(me > order.indexOf("store-assembly"));
  const found = census(files);
  assert.ok(found.length >= 4);
  for (const { spec, module } of found) {
    assert.ok(module && !module.startsWith("platform:") && module !== "node", `${spec}: ${module}`);
    assert.ok(order.indexOf(module) < me, `${spec} is ${module}, not earlier than store-request`);
  }
  assert.deepEqual([...new Set(found.map((x) => x.module))].sort(), ["admission", "answer-envelope", "op-declarations", "record-grammar", "setup-words", "signin-door", "skills", "subresources"]);
});

test("R21 (control): an import of a later module or of the platform is named by the census", () => {
  const probe = join(SRC, "index.mjs");
  const later = importsOf('import { makeFetch } from "../control-plane/index.mjs";\nimport { DurableObject } from "cloudflare:workers";');
  const named = later.map((spec) => (spec.startsWith(".") ? ownerOf(resolve(dirname(probe), spec)) : `platform:${spec}`));
  assert.deepEqual(named, ["control-plane", "platform:cloudflare:workers"]);
  assert.ok(order.indexOf("control-plane") > order.indexOf("store-request"));
});

/* R22 (K624): the split's second half, met by control-plane's Wave B job. control-plane/index.mjs holds no copy of the rules of
   R2 to R13, R23 and R24 (none of R24's lists, `promotedTypeOf` or `innerRequest` is declared there), makes the store's request
   by `innerRequest`, and every module that still reads R24's lists or `promotedTypeOf` imports them from here. */
const R24_NAMES = ["QUERY_STAMPS", "ACT_CLOCK_OPS", "BODY_ONLY", "BODY_DROPPED", "BODY_STAMPS", "SESSION_MEMBER_BODY_OPS",
  "MEMBERSHIP_ADMIN_ACTS", "WIZARD_AUTHOR_ACTIONS", "WIZARD_PROPOSAL_ACTIONS", "WIZARD_VIEWER_OPS", "CASE_IMPORT_ACTIONS",
  "CASE_IMPORT_READS", "BODY_ACTOR"];
const MOVED = [...R24_NAMES, "promotedTypeOf", "innerRequest"];
const CP = join(ROOT, "bio-plane/src/control-plane/index.mjs");
const declared = (text, names) => names.filter((n) => new RegExp(`(?:^|[\\s;{(])(?:const|let|var|function\\*?|class)\\s+${n}\\b`).test(text));
const importedFrom = (text, name) => [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)]
  .filter((m) => m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).includes(name)).map((m) => m[2]);
const srcFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? srcFiles(join(dir, d.name)) : d.name.endsWith(".mjs") ? [join(dir, d.name)] : []);
/* Readers: every source file but this module's and op-declarations' (whose families of the same name are its own, R24). */
const readersOffending = () => {
  const out = [];
  for (const f of srcFiles(join(ROOT, "bio-plane/src"))) {
    if (f.startsWith(SRC) || f.includes("/src/op-declarations/")) continue;
    const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    for (const n of MOVED) {
      if (!new RegExp(`\\b${n}\\b`).test(text)) continue;
      if (declared(text, [n]).length) { out.push(`${relative(ROOT, f)} declares ${n}`); continue; }
      if (!importedFrom(text, n).some((spec) => resolve(dirname(f), spec).startsWith(SRC))) out.push(`${relative(ROOT, f)} reads ${n} not from store-request`);
    }
  }
  return out;
};

test("R22: control-plane/index.mjs declares none of R24's lists, promotedTypeOf or innerRequest, and makes the store's request by innerRequest", () => {
  const text = readFileSync(CP, "utf8");
  assert.deepEqual(declared(text, MOVED), []);
  for (const n of ["innerRequest", "promotedTypeOf"]) assert.deepEqual(importedFrom(text, n), ["../store-request/index.mjs"], n);
  assert.ok((text.match(/\binnerRequest\(/g) || []).length >= 2, "the store's request and the secret doors' are innerRequest's");
});

test("R22: every module that still reads R24's lists or promotedTypeOf imports them from store-request", () => {
  assert.deepEqual(readersOffending(), []);
});

test("R22 (control): a copy of a moved rule in control-plane, or a reader importing it elsewhere, is named", () => {
  const copy = readFileSync(CP, "utf8") + "\nconst QUERY_STAMPS = [];\nfunction promotedTypeOf(b) { return b; }\n";
  assert.deepEqual(declared(copy, MOVED), ["QUERY_STAMPS", "promotedTypeOf"]);
  const stray = 'import { ACT_CLOCK_OPS } from "../op-declarations/index.mjs";';
  assert.deepEqual(importedFrom(stray, "ACT_CLOCK_OPS").map((s) => resolve(join(ROOT, "bio-plane/src/control-plane"), s).startsWith(SRC)), [false]);
});
