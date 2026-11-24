/* test-support R15, R16, R17: the op-declaration helper, the collector and the
 * registration call (build/requirements/test-support.md). The fixture ops are plain functions
 * `call(fields) -> answer`, standing in for an op run as the door runs it. */
import { SANDBOX } from "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { declaredOpHolds, declaredOpsOf, registerDeclared } from "../../declared-ops.mjs";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

const decl = (accepts, requires) => ({ fields: { accepts, requires } });

/** An op that honestly accepts `accepts`, refuses without a `requires` entry naming it, and drops the rest. */
function honest({ accepts, requires }) {
  return (fields) => {
    for (const r of requires) {
      const alts = Array.isArray(r) ? r : [r];
      if (!alts.some((f) => f in fields)) return { code: "MISSING_FIELD", detail: `${alts.join(" or ")} is required` };
    }
    return { ok: true, got: accepts.filter((f) => f in fields) };
  };
}

const holds = (args) => declaredOpHolds({ op: "fixture", ...args });

test("R15 an op that honestly accepts {a} and requires {a} passes", async () => {
  const d = decl(["a"], ["a"]);
  await holds({ declaration: d, call: honest({ accepts: ["a"], requires: ["a"] }) });
});

test("R15 an op that reads b while declaring it absent fails naming the op and b; dropping it passes", async () => {
  const d = decl(["a"], ["a"]);
  const reads = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" } : { ok: true, b: f.b });
  await assert.rejects(holds({ declaration: d, call: reads, outside: ["b"] }), (e) => {
    assert.match(e.message, /fixture/);
    assert.match(e.message, /\bb\b/);
    return true;
  });
  await holds({ declaration: d, call: honest({ accepts: ["a"], requires: ["a"] }), outside: ["b"] });
});

test("R15 an outside field the op refuses naming it passes; one it refuses without naming it fails", async () => {
  const d = decl(["a"], ["a"]);
  const strict = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" }
    : Object.keys(f).some((k) => k !== "a") ? { code: "UNKNOWN_FIELD", detail: "zed is not a field" } : { ok: true });
  await holds({ declaration: d, call: strict, outside: ["zed"] });
  const vague = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" }
    : Object.keys(f).some((k) => k !== "a") ? { code: "BAD_REQUEST", detail: "no" } : { ok: true });
  await assert.rejects(holds({ declaration: d, call: vague, outside: ["zed"] }), /zed/);
});

test("R15 by default one generated unknown field is probed and the op that reads any field fails", async () => {
  const d = decl(["a"], ["a"]);
  const greedy = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" } : { ok: true, extra: Object.keys(f).length });
  await assert.rejects(holds({ declaration: d, call: greedy }), /fixture/);
});

test("R15 a declared required field the op does not refuse without fails naming it", async () => {
  const d = decl(["a", "b"], ["a", "b"]);
  const lax = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" } : { ok: true });
  await assert.rejects(holds({ declaration: d, call: lax }), (e) => {
    assert.match(e.message, /fixture/);
    assert.match(e.message, /\bb\b/);
    return true;
  });
  await holds({ declaration: d, call: honest({ accepts: ["a", "b"], requires: ["a", "b"] }) });
});

test("R15 a refusal that names a declared field when only the requires are given fails naming it", async () => {
  const d = decl(["a", "c"], ["a"]);
  const moody = () => ({ code: "BAD_REQUEST", detail: "c is not allowed here" });
  await assert.rejects(holds({ declaration: d, call: moody }), /\bc\b/);
});

test("R15 a list of alternatives is satisfied by its first and must be refused without all of them", async () => {
  const d = decl(["x", "y"], [["x", "y"]]);
  const seen = [];
  const op = honest({ accepts: ["x", "y"], requires: [["x", "y"]] });
  await holds({ declaration: d, call: (f) => (seen.push(Object.keys(f).sort().join()), op(f)) });
  assert.ok(seen.includes("x"), "satisfied with the first alternative alone");
  assert.ok(seen.includes(""), "called with none of the alternatives");
  assert.ok(!seen.includes("y"), "no call is made with only the second alternative");
  const lax = () => ({ ok: true });
  await assert.rejects(holds({ declaration: d, call: lax }), /\bx\b|\by\b/);
});

test("R15 a list of alternatives is held with the first alternative alone, an op needing only that one passes", async () => {
  const d = decl(["x", "y"], [["x", "y"]]);
  const onlyX = (f) => ("x" in f ? { ok: true } : { code: "MISSING_FIELD", detail: "x is required" });
  await holds({ declaration: d, call: onlyX });
});

test("R15 refusedNaming is the module's own way to tell a refusal that names a field", async () => {
  const d = decl(["a"], ["a"]);
  const op = (f) => (f.a === undefined ? { problems: [{ at: "a" }] } : { ok: true });
  await assert.rejects(holds({ declaration: d, call: op }), /\ba\b/);
  await holds({ declaration: d, call: op, refusedNaming: (answer, field) => answer.problems?.some((p) => p.at === field) === true });
});

test("R15 a Response answer is read as {status, ...body} and the default reads its code or detail", async () => {
  const d = decl(["a"], ["a"]);
  const op = async (f) => (f.a === undefined
    ? new Response(JSON.stringify({ code: "MISSING_FIELD", detail: "a is required" }), { status: 400 })
    : new Response(JSON.stringify({ ok: true }), { status: 200 }));
  await holds({ declaration: d, call: op });
  const lax = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  await assert.rejects(holds({ declaration: d, call: lax }), /\ba\b/);
});

test("R15 values give each field its sample, and the default is a string made from the name", async () => {
  const d = decl(["n", "s"], ["n", "s"]);
  const got = [];
  const op = honest({ accepts: ["n", "s"], requires: ["n", "s"] });
  await holds({ declaration: d, call: (f) => (got.push(f), op(f)), values: { n: 7 } });
  const full = got.find((f) => "n" in f && "s" in f);
  assert.equal(full.n, 7);
  assert.equal(typeof full.s, "string");
  assert.ok(full.s.includes("s"));
});

test("R15 same decides whether an op dropped an outside field", async () => {
  const d = decl(["a"], ["a"]);
  const stamped = (f) => (f.a === undefined ? { code: "MISSING_FIELD", detail: "a is required" } : { ok: true, at: Math.random() });
  await assert.rejects(holds({ declaration: d, call: stamped, outside: ["z"] }), /\bz\b/);
  await holds({ declaration: d, call: stamped, outside: ["z"], same: (x, y) => x.ok === y.ok });
});

test("R15 a declaration without the fields arrays rejects naming the op; the helper's own breach names the op", async () => {
  await assert.rejects(declaredOpHolds({ op: "publish", declaration: {}, call: () => ({}) }), /publish/);
  await assert.rejects(declaredOpHolds({ op: "publish", declaration: { fields: { accepts: [] } }, call: () => ({}) }), /publish/);
  await assert.rejects(declaredOpHolds({ op: "publish", declaration: decl(["a"], ["a"]), call: () => ({ ok: true }) }), /publish/);
});

test("R15 an op with no required fields has only (a) and (c) to hold", async () => {
  const d = decl(["q"], []);
  await holds({ declaration: d, call: () => ({ ok: true }) });
});

/* ---------------------------------------------------------------- R16 */

let treeN = 0;
function tree(modules, files) {
  const root = join(SANDBOX, `tree-${++treeN}`);
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "build", "modules.json"), JSON.stringify({ modules }));
  for (const [name, text] of Object.entries(files)) {
    const p = join(root, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}
const declares = (...ops) => `export const DECLARED_OPS = Object.freeze({${ops.map((o) => `${o}: {fields: {accepts: [], requires: []}}`).join(",")}});\n`;

test("R16 two fake modules with one duplicate: the duplicate is listed and a file lacking the export, or only mentioning the phrase, is not imported", async () => {
  const root = tree(
    [
      { id: "alpha", paths: ["alpha/"] },
      { id: "beta", paths: ["beta/ops.mjs", "beta/readme.md"] },
      { id: "gamma", paths: ["gamma/index.mjs", "gamma/mentions.mjs"] },
    ],
    {
      "alpha/ops.mjs": declares("foo", "bar"),
      "alpha/deep/more.mjs": declares("deep"),
      "alpha/node_modules/x/index.mjs": declares("hidden"),
      "alpha/plain.mjs": 'throw new Error("alpha/plain.mjs was imported");\n',
      "beta/ops.mjs": declares("bar", "baz"),
      "beta/readme.md": "export const DECLARED_OPS = nonsense",
      "gamma/index.mjs": 'throw new Error("gamma was imported");\n',
      "gamma/mentions.mjs": '// export const DECLARED_OPS is what owners write\nexport const NOTE = "export const DECLARED_OPS";\nthrow new Error("mentions was imported");\n',
    },
  );
  const { ops, owners, duplicates } = await declaredOpsOf(root);
  assert.deepEqual(Object.keys(ops).sort(), ["bar", "baz", "deep", "foo"]);
  assert.deepEqual(owners, { foo: "alpha", bar: "alpha", deep: "alpha", baz: "beta" });
  assert.deepEqual(duplicates, [{ op: "bar", owners: ["alpha", "beta"] }]);
});

test("R16 no duplicate gives an empty list, and a tree with no declaration gives empty answers", async () => {
  const one = tree([{ id: "solo", paths: ["solo.mjs"] }], { "solo.mjs": declares("only") });
  assert.deepEqual((await declaredOpsOf(one)).duplicates, []);
  const none = tree([{ id: "solo", paths: ["solo.mjs"] }], { "solo.mjs": "export const x = 1;\n" });
  assert.deepEqual(await declaredOpsOf(none), { ops: {}, owners: {}, duplicates: [] });
});

test("R16 a file with the export text that exports no object DECLARED_OPS rejects naming the file", async () => {
  const root = tree([{ id: "bad", paths: ["bad.mjs"] }], { "bad.mjs": "export const DECLARED_OPS = 5;\n" });
  await assert.rejects(declaredOpsOf(root), /bad\.mjs/);
});

test("R16 on this repository it answers the three parts from build/modules.json with no module listed by hand", async () => {
  const { ops, owners, duplicates } = await declaredOpsOf(REPO);
  assert.equal(typeof ops, "object");
  assert.deepEqual(Object.keys(owners).sort(), Object.keys(ops).sort());
  assert.ok(Array.isArray(duplicates));
});

/* ---------------------------------------------------------------- R17 */

const recorder = () => {
  const calls = [];
  const registration = (pairs) => { calls.push(pairs); };
  return { calls, registration };
};
const shape = (pairs) => pairs.map(([owner, DECLARED_OPS]) => [owner, Object.keys(DECLARED_OPS)]);

test("R17 each registration is called once with every owner's pairs, duplicates included, in modules.json order", async () => {
  const root = tree(
    [{ id: "alpha", paths: ["alpha.mjs"] }, { id: "beta", paths: ["beta.mjs"] }],
    { "alpha.mjs": declares("foo", "bar"), "beta.mjs": declares("bar", "baz") },
  );
  const first = recorder();
  const second = recorder();
  await registerDeclared(root, first.registration, second.registration);
  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 1);
  assert.deepEqual(shape(first.calls[0]), [["alpha", ["foo", "bar"]], ["beta", ["bar", "baz"]]]);
  assert.deepEqual(shape(second.calls[0]), shape(first.calls[0]));
});

test("R17 a second call in the same process is a no-op for a registration already called; a new one is called", async () => {
  const root = tree([{ id: "solo", paths: ["solo.mjs"] }], { "solo.mjs": declares("only") });
  const old = recorder();
  const added = recorder();
  await registerDeclared(root, old.registration);
  await registerDeclared(root, old.registration, added.registration);
  assert.equal(old.calls.length, 1, "already called, so not called again");
  assert.equal(added.calls.length, 1, "not yet called, so called once");
  assert.deepEqual(shape(added.calls[0]), [["solo", ["only"]]]);
});

test("R17 a registration's own refusal propagates, naming the op it refused", async () => {
  const root = tree(
    [{ id: "alpha", paths: ["alpha.mjs"] }, { id: "beta", paths: ["beta.mjs"] }],
    { "alpha.mjs": declares("bar"), "beta.mjs": declares("bar") },
  );
  const refuses = (pairs) => {
    const owners = pairs.filter(([, DECLARED_OPS]) => "bar" in DECLARED_OPS).map(([owner]) => owner);
    if (owners.length > 1) throw new Error(`DECLARED_OP_DUPLICATE: "bar" is declared by ${owners.join(" and ")}`);
  };
  await assert.rejects(registerDeclared(root, refuses), (e) => {
    assert.match(e.message, /DECLARED_OP_DUPLICATE/);
    assert.match(e.message, /\bbar\b/);
    return true;
  });
});

test("R17 a call with no registrations reads nothing, so a root with no modules.json does not throw", async () => {
  await registerDeclared(join(SANDBOX, "no-such-root"));
});
