/* test-support: requirement-named tests at the module's interface
 * (build/requirements/test-support.md). Each test names the requirement id it
 * checks in its title.
 *
 * The module's services are side effects on a whole process, so nearly every
 * test runs a child node process that imports the module with $TMPDIR pointed
 * at a fresh "host" directory, reports what it saw as JSON on a line of its
 * own, and exits by the path under test. The parent then inspects the host
 * directory, which nothing but the child touches. The host directories live
 * inside this process's own sandbox (the import below), so a failing test
 * leaks nothing. */
import { SANDBOX as OWN_SANDBOX } from "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readdirSync, readFileSync,
  rmSync, statSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

const SANDBOX_URL = new URL("../../sandbox.mjs", import.meta.url).href;
const STDIO_URL = new URL("../../stdio.mjs", import.meta.url).href;
const MARK = "@@RESULT@@";

/** A fresh, empty host directory for one child to use as its $TMPDIR. */
const host = () => mkdtempSync(join(tmpdir(), "host-"));

/** The environment a child is handed: this process's, plus `extra`, then `more`, without
 *  NODE_EXTRA_CA_CERTS. Node reads that file at start and warns on stderr when it
 *  cannot, which a uid that is not root does for the proxy's CA bundle; a child's
 *  silence is then the warning's, not the module's.
 * @param {{[name: string]: string | undefined}} extra
 * @param {{[name: string]: string | undefined}} [more]
 */
const childEnv = (extra, more = {}) => {
  const env = { ...process.env, ...extra, ...more };
  delete env.NODE_EXTRA_CA_CERTS;
  return env;
};

/** Runs `body` (module code) in a child with $TMPDIR = `hostDir`. `body` may
 *  call `report(obj)` to send one JSON result line on stdout.
 * @param {string} body
 * @param {{hostDir?: string, stdio?: unknown, env?: {[name: string]: string | undefined}, cwd?: string}} [options]
 */
function child(body, { hostDir, stdio, env = {}, cwd } = {}) {
  const code = `const report = (o) => process.stdout.write(${JSON.stringify(MARK)} + JSON.stringify(o) + "\\n");\n${body}`;
  const args = ["--input-type=module", "-e", code];
  const childEnvironment = childEnv({ TMPDIR: hostDir }, env);
  const r = cwd === undefined
    ? spawnSync(process.execPath, args, { env: childEnvironment, encoding: "utf8", stdio, maxBuffer: 64 * 1024 * 1024, timeout: 60_000 })
    : spawnSync(process.execPath, args, { env: childEnvironment, encoding: "utf8", stdio, cwd, maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith(MARK));
  return { ...r, result: line ? JSON.parse(line.slice(MARK.length)) : undefined };
}

/** Every path under `dir`, relative, with each file's content: a full snapshot.
 * @param {string} dir
 * @returns {{[path: string]: string}}
 */
function snapshot(dir) {
  /** @type {{[path: string]: string}} */
  const out = {};
  const walk = (/** @type {string} */ d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      const k = relative(dir, p);
      if (e.isDirectory()) { out[k] = "<dir>"; walk(p); } else out[k] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return out;
}

/** Builds a tree of files and nested directories inside the child's sandbox. */
const FILL = `
  const { mkdirSync, writeFileSync, mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const fill = (root) => {
    for (let i = 0; i < 4; i++) {
      const d = join(root, "d" + i, "e", "f");
      mkdirSync(d, { recursive: true });
      for (let j = 0; j < 8; j++) writeFileSync(join(d, "x" + j), "y".repeat(j * 100));
      writeFileSync(join(root, "d" + i, "top"), "t");
    }
  };
  fill(SANDBOX);
  fill(mkdtempSync(join(tmpdir(), "own-")));
`;

/* The ways a process can end that run exit handlers (R2), each as the code
   that ends the child after the sandbox has been filled. */
/** @type {[string, string][]} each as [name, code] */
const ENDINGS = [
  ["a normal end", ``],
  ["process.exit()", `process.exit();`],
  ["process.exit(0)", `process.exit(0);`],
  ["process.exit(7)", `process.exit(7);`],
  ["process.exitCode then a normal end", `process.exitCode = 5;`],
  ["an uncaught error", `throw new Error("boom");`],
  ["an uncaught error in a later tick", `setTimeout(() => { throw new Error("late"); }, 5);`],
  ["an unhandled rejection", `Promise.reject(new Error("rejected"));`],
  ["process.exit() from a timer", `setTimeout(() => process.exit(0), 5);`],
];

/** The code of the ending ENDINGS names `name`.
 * @param {string} name
 * @returns {string}
 */
function endingNamed(name) {
  const found = ENDINGS.find(([n]) => n === name);
  if (found === undefined) throw new Error(`no ending named ${name}`);
  return found[1];
}

/* ------------------------------------------------------------------ R1 */

test("R1 importing creates one directory under the host temp directory, named with the pid, and $TMPDIR and os.tmpdir() point inside it for the rest of the process", () => {
  const H = host();
  const r = child(`
    const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
    const { tmpdir } = await import("node:os");
    const { readdirSync, statSync, mkdtempSync } = await import("node:fs");
    const at = () => ({ env: process.env.TMPDIR, os: tmpdir() });
    const first = at();
    const entries = readdirSync(${JSON.stringify(H)});
    const isDir = statSync(SANDBOX).isDirectory();
    const made = mkdtempSync(tmpdir() + "/probe-");
    await new Promise((res) => setTimeout(res, 20));
    await new Promise((res) => setImmediate(res));
    const later = at();
    report({ SANDBOX, pid: process.pid, first, later, entries, isDir, made });
  `, { hostDir: H });
  assert.equal(r.status, 0, r.stderr);
  const { SANDBOX, pid, first, later, entries, isDir, made } = /** @type {{SANDBOX: string, pid: number, first: {env: string, os: string}, later: {env: string, os: string}, entries: string[], isDir: boolean, made: string}} what this test's child reports */ (r.result);
  assert.equal(dirname(SANDBOX), H, "created directly under the host temp directory");
  assert.equal(entries.length, 1, `exactly one directory created, saw ${entries}`);
  assert.equal(entries[0], basename(SANDBOX));
  assert.ok(isDir);
  assert.ok(basename(SANDBOX).includes(String(pid)), "named with the process id");
  assert.match(basename(SANDBOX), new RegExp(`(^|\\D)${pid}(\\D|$)`), "the pid appears as a whole number");
  for (const p of [first.env, first.os, later.env, later.os]) {
    const rel = relative(SANDBOX, p);
    assert.ok(!rel.startsWith("..") && !isAbsolute(rel), `${p} is inside ${SANDBOX}`);
  }
  assert.deepEqual(later, first, "still pointing there later in the process");
  assert.ok(!relative(SANDBOX, made).startsWith(".."), "a temp file made through os.tmpdir() lands inside");
  assert.deepEqual(readdirSync(H), [], "and it is gone after exit");
});

test("R1 a process started with a nested $TMPDIR nests its directory there rather than escaping to the system temp", () => {
  const H = host();
  const nested = join(H, "outer", "inner");
  mkdirSync(nested, { recursive: true });
  const r = child(`
    const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
    report({ SANDBOX });
  `, { hostDir: nested });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(dirname(/** @type {{SANDBOX: string}} what this test's child reports */ (r.result).SANDBOX), nested);
});

/* ------------------------------------------------------------------ R2 */

/** R2's case for one ending: the child fills its sandbox, reports, and ends by `ending`.
 * @param {string} ending
 * @returns {() => void}
 */
const removedAtEnd = (ending) => () => {
  const H = host();
  const r = child(`
      const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
      ${FILL}
      report({ SANDBOX });
      ${ending}
    `, { hostDir: H });
  const result = /** @type {{SANDBOX: string} | undefined} what this test's child reports */ (r.result);
  assert.ok(result, `child reported (status ${r.status}): ${r.stderr}`);
  assert.equal(existsSync(result.SANDBOX), false, "the sandbox is gone");
  assert.deepEqual(readdirSync(H), [], "nothing is left under the host temp directory");
  assert.equal(r.signal, null);
};

test("R2 the directory and everything in it are removed when the process ends by a normal end", removedAtEnd(endingNamed("a normal end")));
test("R2 the directory and everything in it are removed when the process ends by process.exit()", removedAtEnd(endingNamed("process.exit()")));
test("R2 the directory and everything in it are removed when the process ends by process.exit(0)", removedAtEnd(endingNamed("process.exit(0)")));
test("R2 the directory and everything in it are removed when the process ends by process.exit(7)", removedAtEnd(endingNamed("process.exit(7)")));
test("R2 the directory and everything in it are removed when the process ends by process.exitCode then a normal end", removedAtEnd(endingNamed("process.exitCode then a normal end")));
test("R2 the directory and everything in it are removed when the process ends by an uncaught error", removedAtEnd(endingNamed("an uncaught error")));
test("R2 the directory and everything in it are removed when the process ends by an uncaught error in a later tick", removedAtEnd(endingNamed("an uncaught error in a later tick")));
test("R2 the directory and everything in it are removed when the process ends by an unhandled rejection", removedAtEnd(endingNamed("an unhandled rejection")));
test("R2 the directory and everything in it are removed when the process ends by process.exit() from a timer", removedAtEnd(endingNamed("process.exit() from a timer")));

test("R2 the removal completes before the process ends even while an unawaited asynchronous removal races it (the miniflare dispose() shape), over 40 endings", () => {
  for (let i = 0; i < 40; i++) {
    const H = host();
    const r = child(`
      const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
      const { mkdirSync, writeFileSync, promises } = await import("node:fs");
      const { join } = await import("node:path");
      const trees = [];
      for (let t = 0; t < 2; t++) {
        const root = join(SANDBOX, "miniflare-" + t);
        for (let a = 0; a < 6; a++) {
          const d = join(root, "a" + a, "b", "c");
          mkdirSync(d, { recursive: true });
          for (let f = 0; f < 20; f++) writeFileSync(join(d, "f" + f), "z");
        }
        trees.push(root);
      }
      report({ SANDBOX });
      for (const t of trees) promises.rm(t, { recursive: true, force: true }).catch(() => {});
      process.exit(0);
    `, { hostDir: H });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readdirSync(H), [], `ending ${i}: left ${readdirSync(H)}`);
  }
});

test("R2 the removal is synchronous: an exit listener registered after the import sees the directory gone once exit handlers ran, and the parent sees it gone the moment the child is reaped", async () => {
  const H = host();
  /* The parent does not wait for any flush: it inspects the host directory in
     the 'exit' event, the first moment it knows the child has ended. */
  const out = await new Promise((/** @type {(value: {code: number | null, left: string[]}) => void} */ resolve, reject) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", `
      const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(SANDBOX + "/x/y", { recursive: true });
      writeFileSync(SANDBOX + "/x/y/z", "q");
      process.exit(0);
    `], { env: { ...process.env, TMPDIR: H }, stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", (/** @type {number | null} */ code) => resolve({ code, left: readdirSync(H) }));
  });
  assert.equal(out.code, 0);
  assert.deepEqual(out.left, []);
});

/** Leaves a tree in the child's sandbox that a process not running as root
 *  cannot remove as it stands: read-only and inaccessible directories at
 *  several depths, a read-only file, and the sandbox directory itself
 *  read-only. Reports, as `refused`, the code a plain removal of part of it
 *  gets, so a test can show the condition is real rather than assumed. */
const READ_ONLY = `
  const { mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const ro = join(SANDBOX, "ro");
  mkdirSync(join(ro, "a", "b", "c"), { recursive: true });
  writeFileSync(join(ro, "a", "b", "c", "f"), "x");
  chmodSync(join(ro, "a", "b", "c", "f"), 0o400);
  writeFileSync(join(ro, "a", "g"), "y");
  mkdirSync(join(ro, "none", "deep"), { recursive: true });
  writeFileSync(join(ro, "none", "deep", "h"), "z");
  chmodSync(join(ro, "a", "b", "c"), 0o500);
  chmodSync(join(ro, "a", "b"), 0o555);
  chmodSync(join(ro, "a"), 0o500);
  chmodSync(join(ro, "none", "deep"), 0o500);
  chmodSync(join(ro, "none"), 0o000);
  chmodSync(ro, 0o555);
  let refused = null;
  try { rmSync(join(ro, "a"), { recursive: true, force: true }); } catch (e) { refused = e.code; }
  chmodSync(SANDBOX, 0o500);
`;

const NOBODY = 65534;

/** Whether this host can run R2's non-root case at all. Not root, the case
 *  needs nothing more. As root it needs `setpriv` on PATH, the right to change
 *  a directory's owner (childNotRoot hands the host directory to NOBODY) and
 *  the right to drop to NOBODY; a root that lacks any of them cannot make a
 *  child that is not root, so that case is skipped by name rather than failed.
 *  Probed once, and only as far as the case itself goes. */
const DROP = (() => {
  if (process.getuid() !== 0) return { ok: true };
  const dir = mkdtempSync(join(tmpdir(), "drop-"));
  try {
    chownSync(dir, NOBODY, NOBODY);
  } catch (e) {
    return { ok: false, reason: `this root cannot change a directory's owner (${e instanceof Error && "code" in e ? e.code : undefined})` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const r = spawnSync("setpriv", [`--reuid=${NOBODY}`, `--regid=${NOBODY}`, "--clear-groups",
    process.execPath, "-e", "process.stdout.write(String(process.getuid()))"], { encoding: "utf8", timeout: 60_000 });
  const error = r.error;
  if (error) return { ok: false, reason: `setpriv cannot be run (${"code" in error ? error.code : undefined})` };
  if (r.status !== 0 || r.stdout !== String(NOBODY)) {
    return { ok: false, reason: `this root cannot drop to uid ${NOBODY}: ${(r.stderr || "").trim() || `exit ${r.status}`}` };
  }
  return { ok: true };
})();

/** Runs `body` like child(), but as a user that is not root: this process's
 *  own user when it is not root, else uid and gid 65534 through `setpriv`.
 *  A dropped child cannot traverse this process's 0700 sandbox to reach its
 *  host directory, so it is started IN the host directory (spawn changes
 *  directory before `setpriv` drops privileges) and given
 *  $TMPDIR=/proc/self/cwd, which reaches that directory without walking its
 *  ancestors.
 * @param {string} body
 * @param {string} hostDir
 */
function childNotRoot(body, hostDir) {
  const code = `const report = (o) => process.stdout.write(${JSON.stringify(MARK)} + JSON.stringify(o) + "\\n");\n${body}`;
  const nodeArgs = ["--input-type=module", "-e", code];
  const asRoot = process.getuid() === 0;
  if (asRoot) chownSync(hostDir, NOBODY, NOBODY);
  const cmd = asRoot ? "setpriv" : process.execPath;
  const args = asRoot
    ? [`--reuid=${NOBODY}`, `--regid=${NOBODY}`, "--clear-groups", process.execPath, ...nodeArgs]
    : nodeArgs;
  const r = spawnSync(cmd, args, {
    env: { ...process.env, TMPDIR: asRoot ? "/proc/self/cwd" : hostDir }, cwd: hostDir, encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.error, undefined, `the child started${asRoot ? " (setpriv must be on PATH when the tests run as root)" : ""}`);
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith(MARK));
  return { ...r, result: line ? JSON.parse(line.slice(MARK.length)) : undefined };
}

test("R2 a tree a test left read-only is removed, also when the process does not run as root, by every ending", (t) => {
  if (!DROP.ok) return t.skip(`the non-root case cannot run here: ${DROP.reason}`);
  for (const [name, ending] of ENDINGS) {
    const H = host();
    const r = childNotRoot(`
      const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
      ${READ_ONLY}
      report({ uid: process.getuid(), refused });
      ${ending}
    `, H);
    const result = /** @type {{uid: number, refused: string | null} | undefined} what this test's child reports */ (r.result);
    assert.ok(result, `${name}: child reported (status ${r.status}): ${r.stderr}`);
    assert.notEqual(result.uid, 0, `${name}: the child is not root`);
    assert.equal(result.refused, "EACCES", `${name}: a plain removal of the tree is refused`);
    assert.deepEqual(readdirSync(H), [], `${name}: nothing is left under the host temp directory`);
    assert.equal(r.signal, null, name);
  }
});

test("R2 a removal refused with EACCES makes that part of the tree writable and is retried (EACCES injected at the interface, every ending)", () => {
  for (const [name, ending] of ENDINGS) {
    const H = host();
    const out = join(host(), "result.json");
    /* The child replaces fs.rmSync, as the module sees it, with one that
       refuses as the kernel does for a user that is not root: EACCES while any
       directory in the tree lacks owner access. It records each refusal, and
       an exit listener added after the import (so it runs after the sweep)
       writes the count outside the sandbox. */
    const r = child(`
      const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
      const fs = (await import("node:fs")).default;
      const { syncBuiltinESMExports } = await import("node:module");
      const { join: j } = await import("node:path");
      const realRm = fs.rmSync;
      const locked = (p) => {
        const st = fs.lstatSync(p);
        if (!st.isDirectory()) return false;
        return (st.mode & 0o700) !== 0o700 || fs.readdirSync(p).some((n) => locked(j(p, n)));
      };
      let refusals = 0;
      fs.rmSync = (p, o) => {
        if (fs.existsSync(p) && locked(p)) {
          refusals++;
          throw Object.assign(new Error("EACCES: permission denied, rmdir '" + p + "'"), { code: "EACCES", errno: -13, syscall: "rmdir", path: p });
        }
        return realRm(p, o);
      };
      syncBuiltinESMExports();
      ${READ_ONLY}
      process.on("exit", () => fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify({ refusals, gone: !fs.existsSync(SANDBOX) })));
      report({ SANDBOX });
      ${ending}
    `, { hostDir: H });
    assert.ok(r.result, `${name}: child reported (status ${r.status}): ${r.stderr}`);
    const got = /** @type {{refusals: number, gone: boolean}} what this test's child wrote */ (JSON.parse(readFileSync(out, "utf8")));
    assert.ok(got.refusals >= 1, `${name}: the sweep met EACCES`);
    assert.equal(got.gone, true, `${name}: and still removed the sandbox before the process ended`);
    assert.deepEqual(readdirSync(H), [], `${name}: nothing is left under the host temp directory`);
  }
});

/* ------------------------------------------------------------------ R3 */

test("R3 importing more than once in one process (static, dynamic, via stdio first, and through another module) creates one directory, removes it once, and never throws", () => {
  const H = host();
  const via = join(H, "..", `via-${basename(H)}.mjs`);
  writeFileSync(via, `export { SANDBOX } from ${JSON.stringify(SANDBOX_URL)};\n`);
  const r = child(`
    await import(${JSON.stringify(STDIO_URL)});
    const a = await import(${JSON.stringify(SANDBOX_URL)});
    const b = await import(${JSON.stringify(SANDBOX_URL)});
    const c = await import(${JSON.stringify(new URL(`file://${via}`).href)});
    const d = await import(${JSON.stringify(SANDBOX_URL.replace("/test/sandbox.mjs", "/test/m/../sandbox.mjs"))});
    const { readdirSync } = await import("node:fs");
    report({ all: [a.SANDBOX, b.SANDBOX, c.SANDBOX, d.SANDBOX], entries: readdirSync(${JSON.stringify(H)}) });
    process.exit(0);
  `, { hostDir: H });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "", "nothing thrown or warned");
  const result = /** @type {{all: string[], entries: string[]}} what this test's child reports */ (r.result);
  assert.equal(new Set(result.all).size, 1, "every import sees the same directory");
  assert.equal(result.entries.length, 1, "one directory created");
  assert.deepEqual(readdirSync(H), [], "and removed");
});

test("R3 and R6 a child the suite starts is not handed NODE_EXTRA_CA_CERTS: with it set to an unreadable path the child runs silent and does not see the variable, while an unstripped child warns", () => {
  const H = host();
  const unreadable = join(H, "no-such-ca.pem");
  const saved = process.env.NODE_EXTRA_CA_CERTS;
  process.env.NODE_EXTRA_CA_CERTS = unreadable;
  try {
    /* The control: a child given the variable as it is warns, so silence below is the strip's doing. Node 26 reads the
       extra certificates only when a TLS context is first made, so the control makes one; the stripped child below
       makes one too. */
    const bare = spawnSync(process.execPath, ["-e", 'require("node:tls").createSecureContext()'], { env: { ...process.env, TMPDIR: H }, encoding: "utf8" });
    assert.notEqual(bare.stderr, "", "an unstripped child reads the unreadable file and warns");
    const r = child(`(await import("node:tls")).createSecureContext(); report({ seen: "NODE_EXTRA_CA_CERTS" in process.env });`, { hostDir: H });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "", "the child warns about nothing");
    assert.deepEqual(r.result, { seen: false }, "the variable is absent in the child");
  } finally {
    if (saved === undefined) delete process.env.NODE_EXTRA_CA_CERTS;
    else process.env.NODE_EXTRA_CA_CERTS = saved;
  }
  assert.deepEqual(readdirSync(H), [], "nothing is left under the host temp directory");
});

/* ------------------------------------------------------------------ R4 */

test("R4 SANDBOX is the absolute path of the directory R1 created", () => {
  const H = host();
  const r = child(`
    const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
    const { readdirSync, statSync, realpathSync } = await import("node:fs");
    report({ SANDBOX, type: typeof SANDBOX, entries: readdirSync(${JSON.stringify(H)}), isDir: statSync(SANDBOX).isDirectory(), real: realpathSync(SANDBOX) });
  `, { hostDir: H });
  assert.equal(r.status, 0, r.stderr);
  const { SANDBOX, type, entries, isDir } = /** @type {{SANDBOX: string, type: string, entries: string[], isDir: boolean}} what this test's child reports */ (r.result);
  assert.equal(type, "string");
  assert.ok(isAbsolute(SANDBOX));
  assert.ok(isDir);
  assert.deepEqual(entries, [basename(SANDBOX)], "it names the one directory created");
  assert.equal(join(H, entries[0] ?? ""), SANDBOX);
  /* In this very process too. */
  assert.ok(isAbsolute(OWN_SANDBOX) && statSync(OWN_SANDBOX).isDirectory());
  assert.equal(relative(OWN_SANDBOX, tmpdir()).startsWith(".."), false);
});

/* ------------------------------------------------------------------ R5 */

test("R5 sweepSandbox() removes the directory at once, never throws when repeated, and a later exit by every path does not fail because it is gone", () => {
  for (const [name, ending] of ENDINGS) {
    const H = host();
    const r = child(`
      const { SANDBOX, sweepSandbox } = await import(${JSON.stringify(SANDBOX_URL)});
      const { existsSync, readdirSync } = await import("node:fs");
      ${FILL}
      const ret = sweepSandbox();
      const goneAtOnce = !existsSync(SANDBOX);
      const left = readdirSync(${JSON.stringify(H)});
      let threw = null;
      try { sweepSandbox(); sweepSandbox(); } catch (e) { threw = String(e); }
      report({ ret: ret === undefined ? "undefined" : ret, goneAtOnce, left, threw });
      ${ending}
    `, { hostDir: H });
    const result = /** @type {{ret: string, goneAtOnce: boolean, left: string[], threw: string | null} | undefined} what this test's child reports */ (r.result);
    assert.ok(result, `${name}: child reported: ${r.stderr}`);
    assert.equal(result.ret, "undefined", `${name}: returns nothing`);
    assert.equal(result.goneAtOnce, true, `${name}: gone at once`);
    assert.deepEqual(result.left, [], `${name}: nothing left in the host directory at once`);
    assert.equal(result.threw, null, `${name}: a repeat never throws`);
    const expected = name === "process.exit(7)" ? 7 : name === "process.exitCode then a normal end" ? 5
      : (/uncaught|unhandled/.test(name) ? 1 : 0);
    assert.equal(r.status, expected, `${name}: the exit status is the ending's own, not a failure of the sweep: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /ENOENT|sweep/i, `${name}: the later exit reports no error about the sweep`);
    assert.deepEqual(readdirSync(H), []);
  }
});

test("R5 sweepSandbox() never throws when the directory was already removed from outside, or replaced by a file", () => {
  for (const tamper of [
    `rmSync(SANDBOX, { recursive: true, force: true });`,
    `rmSync(SANDBOX, { recursive: true, force: true }); writeFileSync(SANDBOX, "not a dir");`,
  ]) {
    const H = host();
    const r = child(`
      const { SANDBOX, sweepSandbox } = await import(${JSON.stringify(SANDBOX_URL)});
      const { rmSync, writeFileSync, existsSync } = await import("node:fs");
      ${tamper}
      let threw = null;
      try { sweepSandbox(); } catch (e) { threw = String(e); }
      report({ threw, gone: !existsSync(SANDBOX) });
      process.exit(0);
    `, { hostDir: H });
    assert.equal(r.status, 0, r.stderr);
    const result = /** @type {{threw: string | null, gone: boolean}} what this test's child reports */ (r.result);
    assert.equal(result.threw, null);
    assert.equal(result.gone, true);
    assert.deepEqual(readdirSync(H), []);
  }
});

/* ------------------------------------------------------------------ R6 */

/** A child that imports `url`, floods stdout and stderr with `total` bytes each
 *  in `chunk`-byte writes, prints a tally last, and calls process.exit(0).
 * @param {string} url
 * @param {number} total
 * @param {number} chunk
 * @returns {string}
 */
const FLOOD = (url, total, chunk) => `
  const m = await import(${JSON.stringify(url)});
  const s = (await import(${JSON.stringify(STDIO_URL)})).synchronousStdio();
  const line = "x".repeat(${chunk} - 1) + "\\n";
  for (let n = 0; n < ${total}; n += ${chunk}) { process.stdout.write(line); process.stderr.write(line); }
  process.stdout.write("TALLY " + JSON.stringify(s) + "\\n");
  process.stderr.write("TALLY-ERR\\n");
  process.exit(0);
`;

test("R6 synchronousStdio() makes stdout and stderr synchronous through a pipe: every byte written before process.exit() reaches the reader, the last line included, and streams names both", async () => {
  /** @type {[number, number][]} each as [total, chunk] */
  const floods = [[2_000_000, 1024], [2_000_000, 65_580], [4_000_000, 4096]];
  for (const [total, chunk] of floods) {
    const H = host();
    const got = await new Promise((/** @type {(value: {code: number | null, out: string, err: string}) => void} */ resolve, reject) => {
      const p = spawn(process.execPath, ["--input-type=module", "-e", FLOOD(STDIO_URL, total, chunk)],
        { env: childEnv({ TMPDIR: H }), stdio: ["ignore", "pipe", "pipe"] });
      /** @type {Buffer[]} */
      const out = [];
      /** @type {Buffer[]} */
      const err = [];
      /* A slow reader: pause between chunks so the child's writes outrun it. */
      p.stdout.on("data", (/** @type {Buffer} */ b) => { out.push(b); p.stdout.pause(); setTimeout(() => p.stdout.resume(), 1); });
      p.stderr.on("data", (/** @type {Buffer} */ b) => err.push(b));
      p.on("error", reject);
      p.on("close", (/** @type {number | null} */ code) => resolve({ code, out: Buffer.concat(out).toString(), err: Buffer.concat(err).toString() }));
    });
    assert.equal(got.code, 0);
    const n = Math.ceil(total / chunk) * chunk;
    const lines = got.out.split("\n");
    const tally = lines.at(-2) ?? "";
    assert.ok(tally.startsWith("TALLY "), `the final line arrived (${total}/${chunk})`);
    assert.equal(got.out.length, n + tally.length + 1, "every byte arrived");
    const s = JSON.parse(tally.slice(6));
    assert.deepEqual(s, { streams: ["stdout", "stderr"], already: true }, "the import applied it to both pipes");
    assert.ok(got.err.endsWith("TALLY-ERR\n"), "stderr's last line arrived");
    assert.equal(got.err.length, n + "TALLY-ERR\n".length);
  }
});

/* ------------------------------------------------------------------ R7 */

test("R7 a second call changes nothing and returns already:true with the same streams; repeated calls never throw", () => {
  const H = host();
  const r = child(`
    const { synchronousStdio } = await import(${JSON.stringify(STDIO_URL)});
    const calls = [];
    for (let i = 0; i < 5; i++) calls.push(synchronousStdio());
    calls[0].streams.push("mutated");
    const after = synchronousStdio();
    report({ calls: calls.slice(1), after });
  `, { hostDir: H, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(r.status, 0, r.stderr);
  const result = /** @type {{calls: unknown[], after: unknown}} what this test's child reports */ (r.result);
  for (const c of result.calls) assert.deepEqual(c, { streams: ["stdout", "stderr"], already: true });
  assert.deepEqual(result.after, { streams: ["stdout", "stderr"], already: true }, "a caller mutating a result changes nothing");
});

test("R7 a stream that is a file, or absent, is left as it is and is no error; streams names only the streams changed", () => {
  const H = host();
  const cases = [
    { name: "stdout to a file, stderr a pipe", stdio: (/** @type {number} */ f) => ["ignore", f, "pipe"], want: ["stderr"] },
    { name: "stderr to a file, stdout a pipe", stdio: (/** @type {number} */ f) => ["ignore", "pipe", f], want: ["stdout"] },
    { name: "both to a file", stdio: (/** @type {number} */ f) => ["ignore", f, f], want: [] },
    { name: "both ignored", stdio: () => ["ignore", "ignore", "ignore"], want: null },
  ];
  for (const c of cases) {
    const file = join(H, `out-${cases.indexOf(c)}.txt`);
    const resultFile = join(H, `result-${cases.indexOf(c)}.json`);
    const fd = openSync(file, "w");
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
      const { synchronousStdio } = await import(${JSON.stringify(STDIO_URL)});
      const { writeFileSync } = await import("node:fs");
      let threw = null, a, b;
      try { a = synchronousStdio(); b = synchronousStdio(); } catch (e) { threw = String(e); }
      process.stdout.write("to stdout\\n"); process.stderr.write("to stderr\\n");
      writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify({ threw, a, b }));
      process.exit(0);
    `], { env: { ...process.env, TMPDIR: H }, stdio: c.stdio(fd), encoding: "utf8" });
    closeSync(fd);
    assert.equal(r.status, 0, `${c.name}: ${r.stderr}`);
    const got = /** @type {{threw: string | null, a: unknown, b: {already: boolean, streams: string[]}}} what this test's child wrote */ (JSON.parse(readFileSync(resultFile, "utf8")));
    assert.equal(got.threw, null, c.name);
    assert.deepEqual(got.a, got.b, `${c.name}: the second call returns the same`);
    assert.equal(got.b.already, true);
    if (c.want) assert.deepEqual(got.b.streams, c.want, c.name);
    else assert.ok(got.b.streams.every((s) => ["stdout", "stderr"].includes(s)), c.name);
    const text = readFileSync(file, "utf8");
    if (c.want && !c.want.includes("stdout")) assert.match(text, /to stdout/, `${c.name}: the file stream still works`);
    if (c.want && !c.want.includes("stderr")) assert.match(text, /to stderr/, `${c.name}: the file stream still works`);
  }
});

/* ------------------------------------------------------------------ R8 */

test("R8 importing the sandbox module also applies R6: through a pipe, a flood written before process.exit() arrives whole with its tally", async () => {
  const H = host();
  const body = `
    await import(${JSON.stringify(SANDBOX_URL)});
    const s = (await import(${JSON.stringify(STDIO_URL)})).synchronousStdio();
    const line = "y".repeat(1023) + "\\n";
    for (let n = 0; n < 2_000_000; n += 1024) process.stdout.write(line);
    process.stdout.write("TALLY " + JSON.stringify(s) + "\\n");
    process.exit(0);
  `;
  const got = await new Promise((/** @type {(value: {code: number | null, out: string}) => void} */ resolve, reject) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", body],
      { env: { ...process.env, TMPDIR: H }, stdio: ["ignore", "pipe", "pipe"] });
    /** @type {Buffer[]} */
    const out = [];
    p.stdout.on("data", (/** @type {Buffer} */ b) => { out.push(b); p.stdout.pause(); setTimeout(() => p.stdout.resume(), 1); });
    p.stderr.resume();
    p.on("error", reject);
    p.on("close", (/** @type {number | null} */ code) => resolve({ code, out: Buffer.concat(out).toString() }));
  });
  assert.equal(got.code, 0);
  const tally = got.out.split("\n").at(-2) ?? "";
  assert.ok(tally.startsWith("TALLY "));
  assert.deepEqual(JSON.parse(tally.slice(6)), { streams: ["stdout", "stderr"], already: true },
    "the sandbox import had already applied it to both streams");
  assert.equal(got.out.length, Math.ceil(2_000_000 / 1024) * 1024 + tally.length + 1, "every byte arrived");
});

/* ------------------------------------------------------------------ R9 */

test("R9 nothing outside the sandbox directory is created or removed, by the import, a sweep, or any ending", () => {
  /** @type {[string, string][]} */
  const endings = [...ENDINGS, ["sweepSandbox() then process.exit(0)", `sweepSandbox(); process.exit(0);`]];
  for (const [name, ending] of endings) {
    /* The host holds neighbours an over-eager removal would take: another
       process's sandbox (a live pid's and a dead one's), lookalike names, and
       ordinary files. Its parent holds more. */
    const P = host();
    const H = join(P, "tmp");
    mkdirSync(H);
    writeFileSync(join(P, "beside-host"), "p");
    mkdirSync(join(H, `bio-battery-${process.pid}-OTHER`, "inner"), { recursive: true });
    writeFileSync(join(H, `bio-battery-${process.pid}-OTHER`, "inner", "f"), "live");
    mkdirSync(join(H, "bio-battery-999999999-DEAD"));
    mkdirSync(join(H, "bio-battery-1-x-swept"));
    writeFileSync(join(H, "plain"), "q");
    mkdirSync(join(H, "miniflare-abc"));
    const before = snapshot(P);
    const cwd = mkdtempSync(join(tmpdir(), "cwd-"));
    const r = child(`
      const { SANDBOX, sweepSandbox } = await import(${JSON.stringify(SANDBOX_URL)});
      const { readdirSync } = await import("node:fs");
      ${FILL}
      report({ SANDBOX, during: readdirSync(${JSON.stringify(H)}).sort(), cwd: readdirSync(".") });
      ${ending}
    `, { hostDir: H, cwd });
    const result = /** @type {{SANDBOX: string, during: string[], cwd: string[]} | undefined} what this test's child reports */ (r.result);
    assert.ok(result, `${name}: ${r.stderr}`);
    const s = basename(result.SANDBOX);
    assert.deepEqual(result.during.filter((e) => e !== s), Object.keys(before)
      .filter((k) => k.startsWith("tmp/") && k.split("/").length === 2).map((k) => k.slice(4)).sort(),
      `${name}: during the process only the sandbox was added to the host`);
    assert.deepEqual(snapshot(P), before, `${name}: afterwards everything outside the sandbox is exactly as it was`);
    assert.deepEqual(result.cwd, [], `${name}: nothing created in the working directory`);
  }
});

test("R9 making a refused tree writable never follows a link out of the sandbox: a linked outside directory keeps its mode and contents", () => {
  const H = host();
  const O = host();
  mkdirSync(join(O, "kept"));
  writeFileSync(join(O, "kept", "f"), "outside");
  chmodSync(join(O, "kept"), 0o500);
  chmodSync(O, 0o500);
  const before = snapshot(O);
  /* EACCES is injected as in R2's interface test, so the sweep walks a tree
     whose read-only directories hold links to the outside directory. */
  const r = child(`
    const { SANDBOX } = await import(${JSON.stringify(SANDBOX_URL)});
    const fs = (await import("node:fs")).default;
    const { syncBuiltinESMExports } = await import("node:module");
    const { join: j } = await import("node:path");
    const realRm = fs.rmSync;
    const locked = (p) => {
      const st = fs.lstatSync(p);
      if (!st.isDirectory()) return false;
      return (st.mode & 0o700) !== 0o700 || fs.readdirSync(p).some((n) => locked(j(p, n)));
    };
    fs.rmSync = (p, o) => {
      if (fs.existsSync(p) && locked(p)) throw Object.assign(new Error("EACCES"), { code: "EACCES", path: p });
      return realRm(p, o);
    };
    syncBuiltinESMExports();
    fs.mkdirSync(j(SANDBOX, "ro", "deep"), { recursive: true });
    fs.symlinkSync(${JSON.stringify(O)}, j(SANDBOX, "ro", "out"));
    fs.symlinkSync(${JSON.stringify(join(O, "kept"))}, j(SANDBOX, "ro", "deep", "kept"));
    fs.chmodSync(j(SANDBOX, "ro", "deep"), 0o500);
    fs.chmodSync(j(SANDBOX, "ro"), 0o500);
    report({ SANDBOX });
    process.exit(0);
  `, { hostDir: H });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(H), [], "the sandbox was removed");
  assert.equal(statSync(O).mode & 0o7777, 0o500, "the outside directory's mode is unchanged");
  assert.equal(statSync(join(O, "kept")).mode & 0o7777, 0o500, "and so is the one inside it");
  assert.deepEqual(snapshot(O), before, "and its contents");
  chmodSync(join(O, "kept"), 0o700);
  chmodSync(O, 0o700);
});
