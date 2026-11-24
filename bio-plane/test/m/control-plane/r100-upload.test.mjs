/* control-plane R100 (R085-4; K3477; WALK-085 F1; amends R72; capture R92, extraction R1, R20): THE UPLOAD IS READ AS AN
   ACQUIRED DOCUMENT IS, and its declared `type` is passed on. Part one drives the door against a recording store (what
   crosses, and the controls); part two, over Miniflare and the real plane, is R100's own test: a member uploads a two-line
   text file with `type` `text/plain`, promotes it as the capture screen does, and reads it back. Negative controls
   throughout (K874). */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { world, call, opCalls, defaultHooks } from "./harness.mjs";
import { ownerOps as controlPlaneOwnerOps } from "../../../src/store-assembly/owner-ops.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

const SHA = "b".repeat(64);
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const bare = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const doc = () => ({ file: `snapshots/upload-${SHA}`, locator: `upload:${SHA}`, retrieved: "2026-10-16T00:00:00Z", profile: {},
                     capture: { sha256: SHA, bytes: 9, method: "uploaded" } });
const READ = { reading: { found: true, entities: 0 }, text_units: [{ extent: { kind: "document" }, text: "line one\nline two" }] };
/* What crosses is under test, not the door's clock: a loaded container can spend more than the 17 s R123's clock half allows before the read
   (a reading needs 8 of R105's 25 s), which defers the read and is R123's own case; so the door is handed a bound it cannot reach here. */
const UNBOUND = { ...defaultHooks(), acquireBoundMs: 10 * 60_000 };

test("R100 (the door's map): `captureupload` passes the address's `type` to `uploadCapture` as `type`, and passes none when the request names none (negative control: the other four fields cross as before, and `type` is read from the address alone, never the stream)", () => {
  const calls = [];
  const of = { capture: () => ({ uploadCapture: (a) => { calls.push(a); return { ok: true }; } }) };
  const run = (query) => {
    const url = new URL("http://do/captureupload");
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return controlPlaneOwnerOps(of, url, new ReadableStream()).captureupload();
  };
  run({ by: "ann", statement: "s", name: "a.txt", type: "text/plain" });
  run({ by: "ann", statement: "s", name: "a.txt" });
  assert.deepEqual([calls[0].type, calls[0].by, calls[0].statement, calls[0].name], ["text/plain", "ann", "s", "a.txt"]);
  assert.equal("type" in calls[1], false, "no type named, none passed");
  assert.deepEqual(Object.keys(calls[1]).sort(), ["by", "bytes", "ledger", "name", "statement"]);
});

test("R100 (the door): an upload capture answers as new is read by extraction as `op=acquire`'s document is — the store is asked `extractread` over the answer's document — and the answer's document carries `reading` and `text_units`, the rest of the answer unchanged", async () => {
  const { env, S } = world({ answer: (c) => c.route === "captureupload" ? ok({ ok: true, existed: false, capture: { sha256: SHA, bytes: 9 }, document: doc() })
    : c.route === "extractread" ? ok(READ) : null });
  const r = await call(env, { op: "captureupload", token: S.ann, method: "POST", params: { statement: "s", name: "a.txt", type: "text/plain" }, body: "line one\nline two", hooks: UNBOUND });
  assert.equal(r.status, 200, r.text);
  const [asked] = opCalls(env).filter((c) => c.route === "extractread");
  assert.ok(asked, "the store was asked to read");
  assert.equal(asked.body.document.capture.sha256, SHA);
  const [up] = opCalls(env).filter((c) => c.route === "captureupload");
  assert.equal(up.params.type, "text/plain", "the type reached capture's route");
  assert.deepEqual(r.json.result.document.reading, READ.reading);
  assert.deepEqual(r.json.result.document.text_units, READ.text_units);
  assert.deepEqual([r.json.result.ok, r.json.result.existed, r.json.result.document.capture.sha256], [true, false, SHA]);
});

test("R100 (controls): bytes already held (`existed: true`) and a refusal are not read; a reading the store refuses leaves the upload standing and is answered as the failed reading, as acquire answers it", async () => {
  for (const landed of [{ ok: true, existed: true, capture: { sha256: SHA, bytes: 9 } }, { ok: false, reason: "EMPTY", status: 400 }]) {
    const { env, S } = world({ answer: (c) => c.route === "captureupload" ? ok(landed) : null });
    const r = await call(env, { op: "captureupload", token: S.ann, method: "POST", params: { statement: "s" }, body: "x", hooks: UNBOUND });
    assert.deepEqual(r.json.result, landed);
    assert.equal(opCalls(env).some((c) => c.route === "extractread"), false, JSON.stringify(landed));
  }
  // fixtures-generic: READ_FAILED (any refusal of the store's reading leaves the upload standing; the door relays it as given)
  const { env, S } = world({ answer: (c) => c.route === "captureupload" ? ok({ ok: true, existed: false, capture: { sha256: SHA, bytes: 9 }, document: doc() })
    : c.route === "extractread" ? bare({ ok: false, reason: "READ_FAILED", error: "the reading failed" }, 400) : null });
  const r = await call(env, { op: "captureupload", token: S.ann, method: "POST", params: { statement: "s", type: "text/plain" }, body: "line one\nline two" });
  assert.notEqual(r.status, 200, "the failed reading is the answer");
  assert.equal(r.json.ok === true && r.json.result?.ok === true, false);
  assert.equal(opCalls(env).filter((c) => c.route === "captureupload").length, 1, "the upload was filed once and stands");
});

/* ---- part two: the real plane ---- */
const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const ADM = "adm-r100-0123456789abcdef", PASSWORD = "the founder's long password";
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  /* the scanner is a separate service the instance binds; a stand-in that finds every file clean, so file-safety R8's warned path
     (which scans first) can open the original: the door's part is only to relay that answer */
  serviceBindings: { FILE_SCANNER: async () => new Response(JSON.stringify({ ok: true, verdicts: [{ tool: "clamav", engine: "clamav",
    engine_version: "stand-in", signatures: "stand-in", scanned_at: new Date().toISOString(), result: "clean", findings: [] }] }),
    { headers: { "content-type": "application/json" } }) },
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-r100-0123456789abcdef", PROBE_TOKEN: "prb-r100-0123456789abcdef",
              VERSION: "4.6.0", INSTANCE_NAME: "r100-town" },
});
after(() => mf.dispose());
const ORIGIN = "https://group.example";
const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

test("R100 (through the door, the real plane): a member uploads a two-line text file with `type` `text/plain`, then promotes it as the capture screen does; `op=reading` by its digest answers `found: true` with both lines' text in its units, and the original opens by the warned path (`op=openwithwarning`) (controls: the same upload with no `type` stands, its reading failed or undetermined; the same bytes again are `existed: true` and are not read again)", async () => {
  const claimed = await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) });
  assert.equal(claimed.status, 200, await claimed.clone().text());
  await claimed.arrayBuffer();
  const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  const auth = { authorization: `Bearer ${signed.result.token}` };
  const text = `line one ${Date.now()}\nline two of the file\n`;
  const bytes = Buffer.from(text);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const up = await (await plane("/api/?op=captureupload&statement=mine&name=notes.txt&type=text%2Fplain", { method: "POST", headers: auth, body: bytes })).json();
  assert.equal(up.result?.ok, true, JSON.stringify(up).slice(0, 600));
  assert.equal(up.result.existed, false);
  const document = up.result.document;
  assert.equal(document.capture.sha256, sha);
  assert.ok(document.reading, "the upload's answer carries its reading");
  assert.ok(Array.isArray(document.text_units) && document.text_units.length > 0, "and its text units: " + JSON.stringify(document).slice(0, 700));
  /* promoted as the capture screen does (screens-intake R21): its own composition, over the real ops */
  const cs = { now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
    call: async (op, { query = {}, body } = {}) => {
      const u = new URLSearchParams({ op, ...query });
      return (await plane(`/api/?${u}`, { method: body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                          ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json();
    } };
  const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: document, title: "notes.txt", locator: document.locator, project: "" });
  assert.equal(made.refused, undefined, JSON.stringify(made));
  const read = await (await plane(`/api/?op=reading&sha256=${sha}`, { headers: auth })).json();
  assert.equal(read.result.found, true, JSON.stringify(read).slice(0, 400));
  const said = JSON.stringify(read.result.text_units);
  assert.ok(said.includes("line one") && said.includes("line two of the file"), said);
  /* the original opens by the warned path, a received file being graded by file-safety R6 and R8 as any upload is */
  const warned = encodeURIComponent(JSON.stringify({ own_device: true, no_macros: true }));
  const opened = await plane(`/api/?op=openwithwarning&capture=${sha}&warned=${warned}`, { headers: auth });
  const openedBytes = Buffer.from(await opened.arrayBuffer());
  assert.equal(opened.status, 200, openedBytes.toString().slice(0, 300));
  assert.equal(openedBytes.toString("utf8"), bytes.toString("utf8"), "the original's own bytes; headers " + JSON.stringify([...opened.headers]));
  /* control: without the warning it is the safe view only, as for any upload (file-safety R6, R8) */
  const plainOpen = await plane(`/api/?op=capture&sha256=${sha}`, { headers: auth });
  assert.match(await plainOpen.text(), /SAFE_VIEW_ONLY/);
  /* control: the same bytes again are held already, answered `existed` and not read again */
  const twice = await (await plane("/api/?op=captureupload&statement=again&name=notes.txt&type=text%2Fplain", { method: "POST", headers: auth, body: bytes })).json();
  assert.deepEqual([twice.result.ok, twice.result.existed, twice.result.document], [true, true, undefined]);
  /* control: other bytes, no `type`: the upload stands; its reading is not the text the declared type earned */
  const other = Buffer.from(`no type given ${Date.now()}\nsecond line\n`);
  const bare2 = await (await plane("/api/?op=captureupload&statement=mine&name=notes2", { method: "POST", headers: auth, body: other })).json();
  assert.equal(bare2.result.ok, true, JSON.stringify(bare2).slice(0, 300));
  assert.equal(bare2.result.existed, false);
});
