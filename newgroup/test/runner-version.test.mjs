/* R15 against `instance-setup`'s new interface (F2, landed 2914227e80; `agent-worker` R30 as T53 amends it): agent-worker's
 * `GET /version` no longer says `runner`, and the plane's `memberVersions` now answers `agent-runner` as agent-worker's part,
 * `SERVING` with agent-worker's version, where it answered `SILENT` before. The installer's verify step reads every entry of
 * `memberVersions`, so before F2 every fresh install over a current agent-worker named agent-runner silent and claimed no
 * success. The plane's answer here is the provider's real code (`memberVersions` over agent-worker's own Worker), never a
 * hand-built entry; the rest of the answer is the fake account's, as in R15's own test. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { RELEASE_VERSION } from "../src/release.mjs";
import { word } from "../src/words.mjs";
import { memberVersions } from "../../bio-plane/src/setup.mjs";
import { bootstrapVersions } from "../../bio-plane/test/m/credentials/fixtures.mjs";
import agentWorker from "../../agent-worker/src/index.mjs";
import { run, release, armWith, restoreSigners, SIGNER, bump, jres } from "./fixture.mjs";

after(restoreSigners);
const NEXT = bump(RELEASE_VERSION);
const h = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* The plane's AGENT_WORKER binding, served by agent-worker's own Worker code at `version`. */
const realAgentWorker = (version) => ({
  fetch: (url, init) => agentWorker.fetch(new Request(url, init), { VERSION: version }, { waitUntil() {} }),
});
/* The plane's `bootstrap&members=1` answer with agent-worker's and agent-runner's entries from the plane's real `memberVersions`. */
const planeWith = (awVersion) => async (q, s) => {
  const real = await memberVersions({ AGENT_WORKER: realAgentWorker(awVersion(s.v)) });
  const members = { ...s.members, "agent-worker": real["agent-worker"], "agent-runner": real["agent-runner"] };
  return jres(await bootstrapVersions({ storeVersion: s.v, version: s.v, memberVersions: members }));
};

test("R15 a fresh install over agent-worker's real /version (no runner key) confirms every part: agent-runner is agent-worker's part, never named silent; control: agent-worker serving another build names both as lagging", async () => {
  armWith(SIGNER.line);
  const rel = await release({ version: NEXT });
  const said = await (await realAgentWorker(NEXT).fetch("https://agent-worker/version", { method: "GET" })).json();
  assert.equal("runner" in said, false, "agent-worker R30 (T53): runner is gone from /version");

  const ok = await run({ slug: "runner-now", rel, copy: { bootstrap: planeWith((v) => v) } });
  assert.equal(ok.page.status("verify"), "ok");
  assert.ok(ok.page.done.includes(h(word("installer.success.running"))));
  for (const key of ["installer.lag.member.silent", "installer.lag.member.silent.installed"])
    assert.ok(!ok.page.done.includes(h(word(key, { name: "agent-runner" }))), key);

  /* Control: the same real code at another build is a lag for agent-worker and for the runner it carries; no success is claimed. */
  const old = await run({ slug: "runner-old", rel, copy: { bootstrap: planeWith(() => "0.1.0") } });
  assert.equal(old.page.status("verify"), "no");
  for (const name of ["agent-worker", "agent-runner"])
    assert.ok(old.page.done.includes(h(word("installer.lag.member.version", { name, version: "0.1.0" }))), name);
  assert.ok(!old.page.done.includes(h(word("installer.success.running"))));
  restoreSigners();
});
