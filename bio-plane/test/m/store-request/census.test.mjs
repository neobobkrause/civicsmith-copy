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

/* R22: the split's second half, read from the files as text (nothing of a later module is imported). The rules of R2 to R13, R23 and
   R24 live here alone: control-plane's door calls innerRequest and imports what it reads, and no file of the product outside this module
   declares a constant of R24 or promotedTypeOf of its own. op-declarations' families of the same name are its own (R24: its export of
   each must equal ours), so its declarations of them are not copies. */
const PRODUCT = join(ROOT, "bio-plane");
const R24_NAMES = ["QUERY_STAMPS", "ACT_CLOCK_OPS", "BODY_ONLY", "BODY_DROPPED", "BODY_STAMPS", "SESSION_MEMBER_BODY_OPS", "MEMBERSHIP_ADMIN_ACTS",
  "WIZARD_AUTHOR_ACTIONS", "WIZARD_PROPOSAL_ACTIONS", "WIZARD_VIEWER_OPS", "CASE_IMPORT_ACTIONS", "CASE_IMPORT_READS", "BODY_ACTOR", "promotedTypeOf"];
const FAMILIES_OF_OP_DECLARATIONS = ["WIZARD_PROPOSAL_ACTIONS", "CASE_IMPORT_ACTIONS", "CASE_IMPORT_READS"];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.name === "node_modules" || e.name === "dist" ? []
  : e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".mjs") ? [join(dir, e.name)] : []);
/* a declaration of `name` of a file's own: `const|let|var|function|class name` (exported or not) */
const declares = (text, name) => new RegExp(`(?:^|[\\s;{(])(?:const|let|var|function\\*?|class)\\s+${name}\\b`).test(text);
const copiesOf = (files) => {
  const out = [];
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (rel.startsWith("bio-plane/src/store-request/") || rel.startsWith("bio-plane/test/m/store-request/")) continue;
    const text = readFileSync(f, "utf8");
    for (const name of R24_NAMES) {
      if (rel.startsWith("bio-plane/src/op-declarations/") && FAMILIES_OF_OP_DECLARATIONS.includes(name)) continue;
      if (declares(text, name)) out.push(`${rel}: ${name}`);
    }
  }
  return out;
};
const DOOR = join(PRODUCT, "src/control-plane/index.mjs");

test("R22: control-plane's door imports innerRequest, promotedTypeOf and the constants it reads from store-request, and calls innerRequest", () => {
  const text = readFileSync(DOOR, "utf8");
  const fromHere = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\.\/store-request\/index\.mjs["']/g)]
    .flatMap((m) => m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean));
  assert.ok(fromHere.includes("innerRequest") && fromHere.includes("promotedTypeOf"), `imported: ${fromHere.join(", ")}`);
  for (const name of R24_NAMES) if (new RegExp(`\\b${name}\\b`).test(text)) assert.ok(fromHere.includes(name), `control-plane reads ${name} without importing it from here`);
  assert.ok((text.match(/\binnerRequest\(/g) || []).length >= 2, "the forward and the public reads each call innerRequest");
});

test("R22: control-plane's door holds none of the rules of R2, R5 and R23 (the renamed routes, the credential headers, the grant's digest stamp)", () => {
  const text = readFileSync(DOOR, "utf8");
  for (const said of ["inboxlist", "publishcase", "inboxpullfile", "x-bio-session", "x-bio-grant"])
    assert.ok(!text.includes(`"${said}"`) && !text.includes(`'${said}'`) && !text.includes(`/${said}`), `control-plane names ${said}`);
  assert.ok(!/searchParams\.set\(\s*["']bySecret["']/.test(text), "control-plane stamps bySecret itself");
});

test("R22: no file of the product outside store-request declares a constant of R24 or promotedTypeOf of its own", () => {
  const files = [...walk(join(PRODUCT, "src")), ...walk(join(PRODUCT, "test"))];
  assert.ok(files.length > 100);
  assert.deepEqual(copiesOf(files), []);
});

test("R22 (control): a copy of a constant of R24 is named, an import of it is not, and op-declarations' own family is not", () => {
  assert.ok(declares('export const QUERY_STAMPS = ["viewer"];', "QUERY_STAMPS"));
  assert.ok(declares("function promotedTypeOf(b) {}", "promotedTypeOf"));
  assert.ok(!declares('import { QUERY_STAMPS } from "../store-request/index.mjs";\nfor (const k of QUERY_STAMPS) q.delete(k);', "QUERY_STAMPS"));
  assert.ok(!declares("const QUERY_STAMPS_SEEN = 1;", "QUERY_STAMPS"));
  assert.ok(FAMILIES_OF_OP_DECLARATIONS.every((n) => R24_NAMES.includes(n)));
});
