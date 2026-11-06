// Copied from control-plane's suite (test/m/control-plane/r72-declared-door.test.mjs) when control-plane-door-reading took R72 by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R72 (fix round 9; capture R111, R113; B82 (3)): THE DOOR'S WORD ALONE. `declared`, the length an upload says it has, is deleted from the address for every op, and for
   `captureupload` and `captureuploadpart` it is set to the request's own Content-Length when that is a whole number. Driven through the door over the recording store: the store's route
   sees the door's figure, never the caller's; a request with no Content-Length carries none; any other op's address carries none whatever the caller sent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, call, opCalls, defaultHooks } from "../control-plane/harness.mjs";

const SHA = "c".repeat(64);
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const UNBOUND = { ...defaultHooks(), acquireBoundMs: 10 * 60_000 };
const doc = () => ({ file: `snapshots/upload-${SHA}`, locator: `upload:${SHA}`, retrieved: "2026-10-16T00:00:00Z", profile: {}, capture: { sha256: SHA, bytes: 9, method: "uploaded" } });
const landed = (c) => (c.route === "captureupload" || c.route === "captureuploadpart" ? ok({ ok: true, existed: false, capture: { sha256: SHA, bytes: 9 }, document: doc() }) : c.route === "extractread" ? ok({ ok: false }) : null);

for (const op of ["captureupload", "captureuploadpart"]) {
  test(`R72 (B82 (3)): the door replaces a caller's \`declared\` on \`${op}\` with the request's Content-Length (a caller's 1 is not the figure), and sets none when the request has no whole-number length`, async () => {
    const body = "line one\nline two";
    const w = world({ answer: landed });
    const params = { statement: "s", name: "a.txt", type: "text/plain", declared: "1", ...(op === "captureuploadpart" ? { upload: "u1", part: "1" } : {}) };
    const r = await call(w.env, { op, token: w.S.ann, method: "POST", params, body, headers: { "content-length": String(Buffer.byteLength(body)) }, hooks: UNBOUND });
    const [seen] = opCalls(w.env).filter((c) => c.route === op);
    assert.ok(seen, `the store was asked ${op}: ${r.status} ${r.text.slice(0, 200)}`);
    assert.equal(seen.params.declared, String(Buffer.byteLength(body)), "the request's own length, not the caller's");
    const w2 = world({ answer: landed });
    await call(w2.env, { op, token: w2.S.ann, method: "POST", params: { ...params, declared: "999999" }, body, headers: { "content-length": "not a number" }, hooks: UNBOUND });
    const asked = opCalls(w2.env).filter((c) => c.route === op);
    assert.ok(asked.every((c) => c.params.declared === undefined || c.params.declared === null), `no whole-number length, no declared figure: ${JSON.stringify(asked.map((c) => c.params.declared))}`);
  });
}

test("R72 (B82 (3), control): on any other op a caller's `declared` is deleted from the address and none is set", async () => {
  const w = world({ answer: (c) => (c.route === "whoami" ? ok({ ok: true }) : null) });
  await call(w.env, { op: "whoami", token: w.S.ann, params: { declared: "5" } });
  const seen = opCalls(w.env);
  assert.ok(seen.every((c) => !c.params || c.params.declared === undefined || c.params.declared === null), JSON.stringify(seen.map((c) => c.params && c.params.declared)));
});
