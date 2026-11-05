/* control-plane-door-reading R72 (fix round 9, DOCS A1): AN UPLOADED ARCHIVE WAITS FOR ITS DOCUMENT. The plane's `unpack` job (the daemon class)
   names no project; the door asks the record (`heldat`, by the archive's digest, as the administrator sees it) for the document that holds the
   archive. While none holds it the job is answered `ARCHIVE_NOT_FILED`, nothing unpacked; once one holds it, the members are filed under that
   document's project. Driven through the door (`makeFetch`) against control-plane's recording store. Controls throughout. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M, world, call, opCalls } from "../control-plane/harness.mjs";

const ARCHIVE = "a".repeat(64), MEMBER = "b".repeat(64);
const reply = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const member = { file: "snapshots/m", locator: `archive:${ARCHIVE}/one.txt`, profile: {},
                 capture: { sha256: MEMBER, bytes: 3, method: "unpacked" }, container: { archive_sha256: ARCHIVE, index: 0, path: "one.txt" } };
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);

function unpackWorld(held) {
  let n = 0;
  const w = world({ answer: (c) => {
    if (c.route === "heldat") return reply(held);
    if (c.route === "unpack") return reply({ ok: true, complete: true, archive: { sha256: ARCHIVE }, documents: [member] });
    if (c.route === "allocid") return reply({ ok: true, id: `INFO-2026-${String(++n).padStart(4, "0")}` });
    if (c.route === "promote") return reply({ ok: true, bundleId: c.body.bundleId });
    if (c.route === "pendingadd" || c.route === "readheldfor") return reply({ ok: true });
    return null;
  } });
  const hooks = { publicOp: async () => M.json({ ok: true }), publicInstanceGroup: async () => ({ answered: true, result: {} }), gatedOp: async () => undefined };
  return { ...w, hooks };
}
const unpack = (w, body) => call(w.env, { op: "unpack", token: w.env.DAEMON_TOKEN, method: "POST", hooks: w.hooks, body });

test("R72 (DOCS A1): an archive uploaded and not yet held by a document is answered ARCHIVE_NOT_FILED to the plane's unpack job, nothing unpacked; once a document holds it its members are filed under that document's project", async () => {
  const waiting = unpackWorld({ held: false });
  const r = await unpack(waiting, { archiveSha: ARCHIVE });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.result, { ok: true, complete: false, waiting_on: { code: "ARCHIVE_NOT_FILED" } });
  assert.equal(asked(waiting.env, "unpack").length, 0, "nothing is unpacked");
  assert.equal(asked(waiting.env, "promote").length, 0, "nothing is filed");
  const h = asked(waiting.env, "heldat");
  assert.equal(h.length, 1, "the record is asked once");
  assert.equal(h[0].params.sha256, ARCHIVE);
  assert.equal(h[0].params.viewer, "class:admin", "as the administrator sees it");

  const filed = unpackWorld({ held: true, copy: { project: "PRJ-harbour" } });
  const f = await unpack(filed, { archiveSha: ARCHIVE });
  assert.equal(f.status, 200, f.text);
  assert.equal(asked(filed.env, "unpack").length, 1, "the job goes on once a document holds the archive");
  const promoted = asked(filed.env, "promote");
  assert.equal(promoted.length, 1);
  const md = promoted[0].body.files.find((x) => x.path === "bundle.md").text;
  assert.match(md, /^project: "PRJ-harbour"$/m, "the member is filed under the holding document's project");
  assert.deepEqual(f.json.result.promoted.map((p) => p.sha256), [MEMBER]);
});

test("R72 (control): an unpack request that names its project asks the record nothing and files under the project it names", async () => {
  const named = unpackWorld({ held: false });
  const r = await unpack(named, { archiveSha: ARCHIVE, project: "PRJ-named" });
  assert.equal(r.status, 200, r.text);
  assert.equal(asked(named.env, "heldat").length, 0, "nothing asked when the project is named");
  assert.equal(asked(named.env, "unpack").length, 1);
  const md = asked(named.env, "promote")[0].body.files.find((x) => x.path === "bundle.md").text;
  assert.match(md, /^project: "PRJ-named"$/m);
});
