/* journey-check R32: `steps.mjs <address> <step file>...` runs the named walk steps against the address, in the order given,
   printing each step's requirement, follows and expects lines and then passed or failed with what it saw; it exits 0 only
   when every step passed; a file without the header is reported as not a step and not run; a sign-in a step keeps lives
   only in a folder outside the repository for that run and is never printed. The browser is a stand-in over HTTP (the
   required run holds no Chromium); the CLI is run as a process where no browser is needed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSteps, readHeader } from "../../../src/journey-check/steps.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../../..");
const FX = (n) => join(HERE, "step-fixtures", n);
const STEPS = join(REPO, "bio-plane/src/journey-check/steps.mjs");

/* The fixture copy: `/` says Welcome; `/whoami` says "Signed in" only for a kept session. */
async function fixturePage() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    res.setHeader("content-type", "text/html");
    if (u.pathname === "/") return res.end("<p>Welcome</p>");
    if (u.pathname === "/whoami") return res.end(u.searchParams.get("s") === "kept" ? "<p>Signed in</p>" : "<p>Refused: no session</p>");
    res.statusCode = 404; res.end("nothing is here");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { address: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

/* A stand-in browser over HTTP, recording the profile folder it was given. */
function standIn() {
  const seen = { folders: [], closed: 0 };
  const launch = async (folder) => {
    seen.folders.push(folder);
    let body = "";
    return { page: { goto: async (url) => { body = await (await fetch(url)).text(); }, content: async () => body }, close: async () => { seen.closed++; } };
  };
  return { seen, launch };
}

test("R32: a failing and a passing step, in the order given, print their headers and outcomes, and a file with no header is reported and not run; the run is not ok", async () => {
  const site = await fixturePage();
  const lines = [];
  const { seen, launch } = standIn();
  try {
    const r = await runSteps({ address: site.address, files: [FX("whoami.mjs"), FX("sign-in.mjs"), FX("not-a-step.mjs")], launch, write: (l) => lines.push(l) });
    assert.deepEqual({ ok: r.ok, passed: r.passed, failed: r.failed, notSteps: r.notSteps }, { ok: false, passed: 1, failed: 1, notSteps: 1 });
    const out = lines.join("\n");
    assert.match(out, /not-a-step\.mjs: not a step \(has no requirement, follows and expects lines at its top\); not run/);
    assert.doesNotMatch(out, /this must never run/);
    const at = (s) => out.indexOf(s);
    assert.ok(at("whoami.mjs\n") < at("sign-in.mjs\n"), "the steps run in the order given");
    assert.match(out, /whoami\.mjs\n  requirement: journey-check R32\n  follows: journey fixture \/ step 2\n  expects: the page says "Signed in" for the session the first step kept\n  failed: the page said: <p>Refused: no session<\/p>/);
    assert.match(out, /sign-in\.mjs\n  requirement: journey-check R32\n  follows: journey fixture \/ step 1\n  expects: the page says "Welcome", and the sign-in it gives is kept for the next step\n  passed: Welcome/);
    assert.equal(seen.folders.length, 1, "one browser for the run");
    assert.equal(seen.closed, 1);
  } finally { await site.close(); }
});

test("R32: what a step keeps is read by a later step of the same run, is never printed, and lives outside the repository only for that run", async () => {
  const site = await fixturePage();
  const lines = [];
  const { seen, launch } = standIn();
  try {
    const r = await runSteps({ address: site.address + "/", files: [FX("sign-in.mjs"), FX("whoami.mjs")], launch, write: (l) => lines.push(l) });
    assert.deepEqual({ ok: r.ok, passed: r.passed, failed: r.failed }, { ok: true, passed: 2, failed: 0 });
    assert.doesNotMatch(lines.join("\n"), /fixture-session-not-to-be-printed/);
    const [folder] = seen.folders;
    assert.ok(!folder.startsWith(REPO), `${folder} is outside the repository`);
    assert.equal(existsSync(dirname(folder)), false, "the run's folder is gone when it ends");
  } finally { await site.close(); }
});

test("R32: the header is the requirement, follows and expects lines at the file's top", () => {
  assert.deepEqual(readHeader("// requirement: orders R3\n// follows: screen checkout / basket / total\n// expects: \"Total\"\nexport default 1"),
    { requirement: "orders R3", follows: "screen checkout / basket / total", expects: "\"Total\"" });
  assert.equal(readHeader("// requirement: orders R3\n// expects: x\n"), null, "no follows line");
  assert.equal(readHeader("import x from 'y';\n// requirement: orders R3\n// follows: journey j / step 1\n// expects: x"), null, "the header comes before any code");
  assert.equal(readHeader("// requirement: orders\n// follows: journey j / step 1\n// expects: x"), null, "a requirement names its number");
});

test("R32: run as a command, a file with no header is not run and the command exits 1; an address that is not http(s) is refused before anything opens", () => {
  const notStep = spawnSync(process.execPath, [STEPS, "http://127.0.0.1:9", FX("not-a-step.mjs")], { encoding: "utf8" });
  assert.equal(notStep.status, 1);
  assert.match(notStep.stdout, /not a step .*; not run\nsteps: 0 passed, 0 failed, 1 not steps/);
  const bad = spawnSync(process.execPath, [STEPS, "file:///etc", FX("sign-in.mjs")], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /the address must be http\(s\):\/\/<host>/);
  assert.equal(spawnSync(process.execPath, [STEPS], { encoding: "utf8" }).status, 2, "usage");
});
