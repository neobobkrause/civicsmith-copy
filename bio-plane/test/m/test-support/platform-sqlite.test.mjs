/* test-support R18: the preload that gives node:sqlite the platform's single-value limit
 * (bio-plane/test/platform-sqlite.mjs). Each check runs in a child, `node --import <preload> --test <fixture>`,
 * so the claim "node --test hands --import to each test file's process" is itself asserted. */
import { SANDBOX } from "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const PRELOAD = fileURLToPath(new URL("../../platform-sqlite.mjs", import.meta.url));
const FIXTURE_DIR = join(SANDBOX, "platform-sqlite-fixtures");
mkdirSync(FIXTURE_DIR, { recursive: true });

/** @param {{[name: string]: string}} [extra] */
const childEnv = (extra = {}) => {
  const env = { ...process.env };
  delete env.NODE_EXTRA_CA_CERTS;
  delete env.NODE_OPTIONS;
  delete env.NODE_TEST_CONTEXT; // the outer runner's marker makes a nested `node --test` run its file inline
  return { ...env, ...extra };
};

/** Writes `body` (the fixture test's source) and runs it under `node --test`, with `argv` before it.
 * @param {string} name
 * @param {string} body
 * @param {{argv?: string[], env?: {[name: string]: string}}} [options]
 * @returns {{status: number | null, out: string}}
 */
const runFixture = (name, body, { argv = ["--import", PRELOAD], env = {} } = {}) => {
  const file = join(FIXTURE_DIR, `${name}.fixture.test.mjs`);
  writeFileSync(file, body);
  const r = spawnSync(process.execPath, [...argv, "--test", "--test-force-exit", file], { encoding: "utf8", env: childEnv(env) });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
};

const HEAD = `import { test } from "node:test"; import assert from "node:assert/strict"; import { DatabaseSync } from "node:sqlite";
const fresh = () => { const d = new DatabaseSync(":memory:"); d.exec("create table t(a, b, c)"); return d; };
const count = (d) => d.prepare("select count(*) n from t").get().n;
`;

test("R18 a fresh DatabaseSync in a test file process refuses a 2,252,800 B bind and accepts 2,098,176 B, through every statement method", () => {
  const r = runFixture("limit", HEAD + `
test("limit", () => {
  const d = fresh();
  assert.throws(() => d.prepare("insert into t(a) values (?)").run("x".repeat(2_252_800)), (e) => e.message === "string or blob too big" && e.code === "ERR_SQLITE_ERROR");
  assert.equal(count(d), 0, "a refused statement stores nothing");
  d.prepare("insert into t(a) values (?)").run("x".repeat(2_098_176));
  assert.throws(() => d.prepare("insert into t(a) values (?)").run("x".repeat(2_098_177)), /string or blob too big/);
  assert.equal(count(d), 1);
  const big = "y".repeat(2_252_800);
  assert.throws(() => d.prepare("select ? v").get(big), /string or blob too big/);
  assert.throws(() => d.prepare("select ? v").all(big), /string or blob too big/);
  assert.throws(() => [...d.prepare("select ? v").iterate(big)], /string or blob too big/);
  assert.equal(d.prepare("select ? v").get("y".repeat(2_098_176)).v.length, 2_098_176);
  const tags = d.createTagStore();
  assert.throws(() => tags.run\`insert into t(a) values (\${big})\`, /string or blob too big/);
  assert.equal(count(d), 1);
});`);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /ℹ pass 1\b/);
});

test("R18 three 1 MB values in one INSERT are refused (the row approximation); two are accepted; an ordinary row is accepted", () => {
  const r = runFixture("sum", HEAD + `
test("sum", () => {
  const d = fresh(); const mb = "z".repeat(1_048_576);
  assert.throws(() => d.prepare("insert into t values (?, ?, ?)").run(mb, mb, mb), /string or blob too big/);
  assert.equal(count(d), 0);
  d.prepare("insert into t values (?, ?, ?)").run(mb, mb, null);
  d.prepare("insert into t values (?, ?, ?)").run("a", 7, 1.5);
  assert.equal(count(d), 2);
  assert.throws(() => d.prepare("insert into t values (:a, :b, :c)").run({ a: mb, b: mb, c: mb }), /string or blob too big/);
  assert.throws(() => d.prepare("insert into t values ($a, $b, $c)").run({ $a: mb, $b: mb, $c: mb }), /string or blob too big/);
});`);
  assert.equal(r.status, 0, r.out);
});

test("R18 a blob is judged by its bytes and a string by its UTF-8 bytes", () => {
  const r = runFixture("kinds", HEAD + `
test("kinds", () => {
  const d = fresh();
  assert.throws(() => d.prepare("insert into t(a) values (?)").run(new Uint8Array(2_252_800)), /string or blob too big/);
  assert.throws(() => d.prepare("insert into t(a) values (?)").run(Buffer.alloc(2_252_800)), /string or blob too big/);
  d.prepare("insert into t(a) values (?)").run(new Uint8Array(2_098_176));
  // 1,100,000 characters, 2,200,000 bytes
  assert.throws(() => d.prepare("insert into t(a) values (?)").run("\\u00e9".repeat(1_100_000)), /string or blob too big/);
  d.prepare("insert into t(a) values (?)").run("\\u00e9".repeat(1_049_088));
  assert.equal(count(d), 2);
});`);
  assert.equal(r.status, 0, r.out);
});

test("R18 the refusal has the shape node's own SQLITE_TOOBIG has", () => {
  const real = new DatabaseSync(":memory:", { limits: { length: 1000 } });
  real.exec("create table t(a)");
  /** @type {unknown} */
  let own;
  try { real.prepare("insert into t values (?)").run("x".repeat(2000)); } catch (e) { own = e; }
  const caught = own;
  assert.ok(caught, "node refuses a bind over its own length limit");
  const r = runFixture("shape", HEAD + `
test("shape", () => {
  let e; try { fresh().prepare("insert into t(a) values (?)").run("x".repeat(2_252_800)); } catch (x) { e = x; }
  console.log("@@SHAPE@@" + JSON.stringify({ name: e.name, message: e.message, own: Object.getOwnPropertyNames(e).filter((k) => k !== "stack").sort(), code: e.code, errcode: e.errcode, errstr: e.errstr, isError: e instanceof Error }));
});`);
  assert.equal(r.status, 0, r.out);
  const got = JSON.parse(r.out.match(/@@SHAPE@@(.*)/)?.[1] ?? "");
  const ownError = caught instanceof Error ? caught : undefined;
  assert.deepEqual(got, {
    name: ownError?.name, message: ownError?.message, own: Object.getOwnPropertyNames(caught).filter((k) => k !== "stack").sort(),
    code: ownError && "code" in ownError ? ownError.code : undefined,
    errcode: ownError && "errcode" in ownError ? ownError.errcode : undefined,
    errstr: ownError && "errstr" in ownError ? ownError.errstr : undefined, isError: true,
  });
});

test("R18 exec of a literal and a computed value are not judged (the preload's stated blind spot); numbers and null are never judged", () => {
  const r = runFixture("blind", HEAD + `
test("blind", () => {
  const d = fresh();
  d.exec("insert into t(a) values (zeroblob(2500000))");
  d.prepare("insert into t(a) values (?)").run(Number.MAX_SAFE_INTEGER);
  d.prepare("insert into t(a) values (?)").run(null);
  d.prepare("insert into t(a) values (?)").run(2n ** 40n);
  assert.equal(count(d), 4);
});`);
  assert.equal(r.status, 0, r.out);
});

test("R18 NODE_OPTIONS=--import reaches a test file's process the same way, and importing the preload twice wraps once", () => {
  const body = HEAD + `
test("env", () => { assert.throws(() => fresh().prepare("select ? v").get("x".repeat(2_252_800)), /string or blob too big/); });`;
  const viaEnv = runFixture("env", body, { argv: [], env: { NODE_OPTIONS: `--import=${PRELOAD}` } });
  assert.equal(viaEnv.status, 0, viaEnv.out);
  const twice = runFixture("twice", HEAD + `
import ${JSON.stringify(PRELOAD)};
test("twice", () => {
  const d = fresh(); const big = "x".repeat(1_500_000);
  assert.throws(() => d.prepare("select ? v").get(big + big), /string or blob too big/);
  assert.equal(d.prepare("select ? v").get(big).v.length, 1_500_000);
});`);
  assert.equal(twice.status, 0, twice.out);
});

test("R18 without the preload the same fixture is not refused (the gap the preload closes)", () => {
  const r = runFixture("without", HEAD + `
test("without", () => { assert.equal(fresh().prepare("select ? v").get("x".repeat(2_252_800)).v.length, 2_252_800); });`, { argv: [] });
  assert.equal(r.status, 0, r.out);
});
