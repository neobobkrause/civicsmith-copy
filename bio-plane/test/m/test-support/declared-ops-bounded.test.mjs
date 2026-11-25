/* test-support R16, R17: the bounded form of the collector and the registration call,
 * `declaredOpsOf(root, upTo)` and `registerDeclared(root, upTo, ...registrations)`, read from
 * `process/modules/order.txt` up to the module named (process/modules/test-support.md).
 * Each tree is written into the sandbox; only this repository's own read stops at test-support. */
import { SANDBOX } from "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { declaredOpsOf, registerDeclared } from "../../declared-ops.mjs";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

let treeN = 0;
/** A tree laid out as the process's module list: `process/modules/order.txt` and one entry for each module. */
function listed(entries, files) {
  const root = join(SANDBOX, `bounded-${++treeN}`);
  mkdirSync(join(root, "process", "modules"), { recursive: true });
  writeFileSync(join(root, "process", "modules", "order.txt"), entries.map((e) => e.name).join("\n") + "\n");
  for (const e of entries) writeFileSync(join(root, "process", "modules", `${e.name}.json`), JSON.stringify({ tests: [], public: [], uses: [], ...e }));
  for (const [name, text] of Object.entries(files)) {
    const p = join(root, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}
const declares = (...ops) => `export const DECLARED_OPS = Object.freeze({${ops.map((o) => `${o}: {fields: {accepts: [], requires: []}}`).join(",")}});\n`;
const imported = (what) => `throw new Error("${what} was imported");\n`;

/* alpha owns src/ but beta owns src/beta/ (a longer path); gamma comes after beta. */
const ordered = () => listed(
  [
    { name: "alpha", files: ["src/"], tests: ["test/alpha/"] },
    { name: "beta", files: ["src/beta/", "lib/beta.mjs"] },
    { name: "gamma", files: ["gamma/"] },
  ],
  {
    "src/ops.mjs": declares("foo", "bar"),
    "src/plain.mjs": imported("a file without the export text"),
    "src/node_modules/x/index.mjs": declares("hidden"),
    "src/beta/ops.mjs": declares("bar", "baz"),
    "lib/beta.mjs": declares("lib"),
    "test/alpha/fixture.mjs": declares("intest") + imported("alpha's test file"),
    "gamma/ops.mjs": declares("late") + imported("gamma, after the bound,"),
  },
);

/* ---------------------------------------------------------------- R16 */

test("R16 upTo reads the order file's modules up to and including the one named, each from its entry's files", async () => {
  const root = ordered();
  const { ops, owners, duplicates } = await declaredOpsOf(root, "beta");
  assert.deepEqual(Object.keys(ops).sort(), ["bar", "baz", "foo", "lib"]);
  assert.deepEqual(owners, { foo: "alpha", bar: "alpha", baz: "beta", lib: "beta" });
  assert.deepEqual(duplicates, [{ op: "bar", owners: ["alpha", "beta"] }]);
  assert.equal(ops.bar, (await import(pathToFileURL(join(root, "src/ops.mjs")).href)).DECLARED_OPS.bar, "the first in order keeps the op");
});

test("R16 upTo: the longest listed path decides a file's owner, so a later module's file inside an earlier folder is not read", async () => {
  const root = ordered();
  const { owners } = await declaredOpsOf(root, "alpha");
  assert.deepEqual(owners, { foo: "alpha", bar: "alpha" }, "src/beta/ops.mjs is beta's, after the bound, and is not read");
});

test("R16 upTo a module that is not on the order file is refused, naming it", async () => {
  const root = ordered();
  await assert.rejects(declaredOpsOf(root, "delta"), /"delta"/);
  await assert.rejects(declaredOpsOf(root, ""), /order\.txt/);
});

test("R16 upTo: a file with the export text that exports no object DECLARED_OPS rejects naming the file", async () => {
  const root = listed([{ name: "bad", files: ["bad.mjs"] }], { "bad.mjs": "export const DECLARED_OPS = null;\n" });
  await assert.rejects(declaredOpsOf(root, "bad"), /bad\.mjs/);
});

test("R16 upTo with no declaration up to the bound gives empty answers", async () => {
  const root = listed([{ name: "solo", files: ["solo.mjs"] }], { "solo.mjs": "export const x = 1;\n" });
  assert.deepEqual(await declaredOpsOf(root, "solo"), { ops: {}, owners: {}, duplicates: [] });
});

test("R16 upTo on this repository reads the order file up to test-support and answers the three parts", async () => {
  const { ops, owners, duplicates } = await declaredOpsOf(REPO, "test-support");
  assert.deepEqual(Object.keys(owners).sort(), Object.keys(ops).sort());
  const order = readFileSync(join(REPO, "process/modules/order.txt"), "utf8").split("\n");
  const bound = order.indexOf("test-support");
  for (const owner of Object.values(owners)) assert.ok(order.indexOf(owner) <= bound, `${owner} is at or before test-support`);
  assert.ok(Array.isArray(duplicates));
});

/* ---------------------------------------------------------------- R17 */

const recorder = () => {
  const calls = [];
  const registration = (pairs) => { calls.push(pairs); };
  return { calls, registration };
};
const shape = (pairs) => pairs.map(([owner, DECLARED_OPS]) => [owner, Object.keys(DECLARED_OPS)]);

test("R17 registerDeclared(root, upTo, ...) gives the pairs of R16's bounded reading, in order-file order, once per registration", async () => {
  const root = ordered();
  const bounded = recorder();
  await registerDeclared(root, "beta", bounded.registration);
  assert.equal(bounded.calls.length, 1);
  assert.deepEqual(shape(bounded.calls[0]), [["alpha", ["foo", "bar"]], ["beta", ["bar", "baz"]], ["beta", ["lib"]]]);
  const narrower = recorder();
  await registerDeclared(root, "alpha", narrower.registration);
  assert.deepEqual(shape(narrower.calls[0]), [["alpha", ["foo", "bar"]]]);
  await registerDeclared(root, "beta", bounded.registration);
  assert.equal(bounded.calls.length, 1, "already called, so not called again");
});

test("R17 bounded: a registration's refusal propagates naming what it refused, and the rest of that call's registrations are not called", async () => {
  const root = ordered();
  const after = recorder();
  const refuses = (pairs) => {
    const owners = pairs.filter(([, DECLARED_OPS]) => "bar" in DECLARED_OPS).map(([owner]) => owner);
    if (owners.length > 1) throw new Error(`DECLARED_OP_DUPLICATE: "bar" is declared by ${owners.join(" and ")}`);
  };
  await assert.rejects(registerDeclared(root, "beta", refuses, after.registration), /DECLARED_OP_DUPLICATE: "bar"/);
  assert.equal(after.calls.length, 0);
});

test("R17 registerDeclared with an upTo not on the order file is refused naming it, and calls nothing", async () => {
  const root = ordered();
  const none = recorder();
  await assert.rejects(registerDeclared(root, "delta", none.registration), /"delta"/);
  assert.equal(none.calls.length, 0);
});

test("R17 a registration that is not a function is refused before anything is read or called", async () => {
  const root = ordered();
  const first = recorder();
  await assert.rejects(registerDeclared(root, "alpha", first.registration, "beta"), TypeError);
  assert.equal(first.calls.length, 0);
});
