/* reading-pipeline: the opt-in after-read hook (R25–R27; T33-23, B1a.4; K1468, D177) at the module's interface:
   `readHooksOf(ctx)`'s `onRead` and `afterRead`, and `read` beside a registry holding hooks. Each test names the
   requirement ids it checks in its title. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadHooks, readHooksOf } from "../../../src/reading-pipeline/index.mjs";
import { listenerRefusal, MODULE_ORDER } from "../../../src/membership/index.mjs";
import { fresh, hold, doc, member, withEntry, i2, noText, ocrAnswer } from "./fixture.mjs";
import { registerDoctype } from "../../../../docprofile/registry.mjs";
import { registerDoctypes } from "../../../../doctypes/index.mjs";

/* K1737: docprofile registers no content type of its own, so this suite registers doctypes' readers, as the plane's
   store does. */
registerDoctypes(registerDoctype);

const noop = () => {};
/* The refusal membership's R81 answers for the same registration, so this module mints neither code itself. */
const r81 = (held, module, fn) => listenerRefusal(held, module, fn, { slot: "onRead" });

test("R25: onRead registers once per module for the capture classes it names; a malformed registration, an empty or non-list captureClasses, is LISTENER_MALFORMED and a second by the same module LISTENER_DECLARED naming it, both as membership's listenerRefusal answers; a refused registration records nothing", async () => {
  const h = new ReadHooks();
  const ok = h.onRead("events", noop, { captureClasses: ["minutes", "agenda"] });
  assert.equal(ok.ok, true);
  assert.equal(ok.module, "events");
  assert.deepEqual(ok.captureClasses, ["minutes", "agenda"]);

  const malformed = [
    ["", noop, { captureClasses: ["minutes"] }],
    [null, noop, { captureClasses: ["minutes"] }],
    [42, noop, { captureClasses: ["minutes"] }],
    ["lines", "not a function", { captureClasses: ["minutes"] }],
    ["lines", null, { captureClasses: ["minutes"] }],
    ["lines", noop, { captureClasses: [] }],
    ["lines", noop, { captureClasses: "minutes" }],
    ["lines", noop, { captureClasses: null }],
    ["lines", noop, {}],
    ["lines", noop, undefined],
    ["lines", noop, { captureClasses: ["minutes", 7] }],
    ["lines", noop, { captureClasses: ["minutes", ""] }],
    ["lines", noop, { captureClasses: { 0: "minutes", length: 1 } }],
  ];
  for (const [m, fn, opts] of malformed) {
    const r = h.onRead(m, fn, opts);
    assert.equal(r.ok, false, `refused: ${JSON.stringify([m, typeof fn, opts])}`);
    assert.equal(r.code, "LISTENER_MALFORMED");
    assert.deepEqual(r, r81([], typeof m === "string" ? m : m, null));
  }

  const again = h.onRead("events", () => {}, { captureClasses: ["budget"] });
  assert.equal(again.ok, false);
  assert.equal(again.code, "LISTENER_DECLARED");
  assert.equal(again.module, "events");
  assert.deepEqual(again, r81([{ module: "events" }], "events", noop));
  /* A second registration with malformed classes is still refused, and nothing changes. */
  assert.equal(h.onRead("events", noop, { captureClasses: [] }).code, "LISTENER_MALFORMED");

  /* Nothing a refusal saw was recorded: only the first registration runs, for its own classes only. */
  const ran = await h.afterRead({ captureSha: "a".repeat(64), captureClass: "budget", reading: {}, committed: true });
  assert.deepEqual(ran, { ran: [], failed: [] });
  const calls = [];
  const h2 = new ReadHooks();
  h2.onRead("lines", noop, { captureClasses: [] });
  assert.equal(h2.onRead("lines", (e) => calls.push(e.captureClass), { captureClasses: ["minutes"] }).ok, true);
  await h2.afterRead({ captureSha: "b", captureClass: "minutes", reading: {}, committed: true });
  assert.deepEqual(calls, ["minutes"]);
});

test("R25 R26: the registry is one per storage: readHooksOf answers the same registry for a storage, another for another storage, so a module registers once in each and one storage's afterRead never runs another's hooks", async () => {
  const s1 = {}, s2 = {};
  assert.equal(readHooksOf({ storage: s1 }), readHooksOf({ storage: s1 }));
  assert.equal(readHooksOf({ storage: s1 }), readHooksOf(s1));
  assert.notEqual(readHooksOf({ storage: s1 }), readHooksOf({ storage: s2 }));
  const seen = [];
  assert.equal(readHooksOf({ storage: s1 }).onRead("events", () => seen.push("s1"), { captureClasses: ["c"] }).ok, true);
  assert.equal(readHooksOf({ storage: s2 }).onRead("events", () => seen.push("s2"), { captureClasses: ["c"] }).ok, true);
  assert.equal(readHooksOf({ storage: s1 }).onRead("events", noop, { captureClasses: ["c"] }).code, "LISTENER_DECLARED");
  assert.deepEqual(await readHooksOf({ storage: s2 }).afterRead({ captureSha: "x", captureClass: "c", reading: {}, committed: true }),
                   { ran: ["events"], failed: [] });
  assert.deepEqual(seen, ["s2"]);
  /* No object, no registry to share: each answer is a fresh, empty one. */
  assert.notEqual(readHooksOf(null), readHooksOf(null));
  assert.deepEqual(await readHooksOf(undefined).afterRead({ captureClass: "c", committed: true }), { ran: [], failed: [] });
});

test("R26: afterRead runs only after a commit (committed: true; any other value runs nothing and answers {ran: []}), calls each hook whose classes hold the capture class one at a time in MODULE_ORDER whatever order they registered in, with {captureSha, captureClass, reading}, never one for another class; a hook that throws or rejects is named in failed and stops no later hook; nothing registered answers {ran: [], failed: []}", async () => {
  const h = new ReadHooks();
  assert.deepEqual(await h.afterRead({ captureSha: "s", captureClass: "minutes", reading: {}, committed: true }), { ran: [], failed: [] });

  const log = [];
  let active = 0, overlap = false;
  const hook = (name, { fail = null, delay = 0 } = {}) => async (e) => {
    active++; if (active > 1) overlap = true;
    log.push([name, e]);
    await new Promise((r) => setTimeout(r, delay));
    active--;
    if (fail === "throw") throw new Error(`${name} broke`);
    if (fail === "reject") return Promise.reject(new Error(`${name} rejected`));
    return { from: name };
  };
  /* Registered out of the total order, and one module outside it, which runs last. */
  const order = ["people", "events", "content", "money", "duties"];
  assert.ok(order.every((m) => MODULE_ORDER.includes(m)));
  h.onRead("people", hook("people", { delay: 5 }), { captureClasses: ["minutes"] });
  h.onRead("not-a-module", hook("not-a-module"), { captureClasses: ["minutes"] });
  h.onRead("events", hook("events", { fail: "reject", delay: 5 }), { captureClasses: ["minutes", "agenda"] });
  h.onRead("content", hook("content", { fail: "throw" }), { captureClasses: ["minutes"] });
  h.onRead("money", hook("money"), { captureClasses: ["budget"] });
  /* A synchronous hook that throws, too. */
  h.onRead("duties", () => { log.push(["duties"]); throw new TypeError("sync"); }, { captureClasses: ["minutes"] });

  const reading = { content_type: "minutes", found: true, entities: [{ key: "k" }] };
  for (const committed of [false, undefined, null, 1, "true", {}]) {
    assert.deepEqual(await h.afterRead({ captureSha: "s", captureClass: "minutes", reading, committed }), { ran: [] });
  }
  assert.deepEqual(await h.afterRead(), { ran: [] });
  assert.equal(log.length, 0);

  const out = await h.afterRead({ captureSha: "s1", captureClass: "minutes", reading, committed: true });
  const want = MODULE_ORDER.filter((m) => ["people", "events", "content", "duties"].includes(m));
  assert.deepEqual(log.map(([n]) => n), [...want, "not-a-module"]);
  assert.equal(overlap, false);
  assert.ok(!log.some(([n]) => n === "money"));
  for (const [n, e] of log) if (e) assert.deepEqual(e, { captureSha: "s1", captureClass: "minutes", reading }, n);
  assert.deepEqual(out.ran, MODULE_ORDER.filter((m) => m === "people").concat(["not-a-module"]));
  assert.deepEqual(out.failed.map((f) => f.module), want.filter((m) => m !== "people"));
  assert.deepEqual(Object.fromEntries(out.failed.map((f) => [f.module, f.error])),
                   { events: "events rejected", content: "content broke", duties: "sync" });
  assert.deepEqual(Object.keys(out).sort(), ["failed", "ran"]);

  /* A hook's change to what it was handed never reaches the caller or a later hook. */
  const h2 = new ReadHooks();
  const seen = [];
  h2.onRead("entities", (e) => { e.reading.found = false; e.reading.entities.length = 0; }, { captureClasses: ["c"] });
  h2.onRead("events", (e) => { seen.push(structuredClone(e.reading)); }, { captureClasses: ["c"] });
  const r = { found: true, entities: [1, 2] };
  assert.deepEqual(await h2.afterRead({ captureSha: "s", captureClass: "c", reading: r, committed: true }),
                   { ran: ["entities", "events"], failed: [] });
  assert.deepEqual(r, { found: true, entities: [1, 2] });
  assert.deepEqual(seen, [{ found: true, entities: [1, 2] }]);

  /* Another class runs only its own hooks; an absent class runs none. */
  log.length = 0;
  assert.deepEqual(await h.afterRead({ captureSha: "s", captureClass: "budget", reading, committed: true }),
                   { ran: ["money"], failed: [] });
  assert.deepEqual(await h.afterRead({ captureSha: "s", reading, committed: true }), { ran: [], failed: [] });
});

test("R27: a hook never runs inside read: read's answer, for a text capture, a PDF read through tiers 2 and 3, and a failed reading, is byte for byte the same whatever is registered, and no hook is called by it", async () => {
  const calls = [];
  const register = (ctx) => {
    const h = readHooksOf(ctx);
    for (const m of ["entities", "events", "content"])
      h.onRead(m, (e) => { calls.push(m); e.reading.found = "changed"; }, { captureClasses: ["minutes", "pdf", "html", "text/html", "application/pdf"] });
  };
  const pages = i2([{ page: 0, text: "Agenda of the council" }, { page: 1, text: "", undetermined: [noText(1)] }]);
  const pdfEntry = { format: "pdf", structure: async () => ({ ok: true, text: structuredClone(pages), pages: 2, notes: [] }) };

  const readAll = async () => {
    const w = fresh({ env: { OCR_WORKER: member((b) => ocrAnswer(b.pages)), PDF_WORKER: member(() => ({ ok: false })) } });
    const html = "<html><head><title>Minutes</title></head><body><p>The council met.</p></body></html>";
    const dh = await hold(w.evidence, html);
    const a = await w.read(doc({ digest: dh, bytes: html.length, fromText: true }));
    const dp = await hold(w.evidence, "%PDF-1.7 fixed bytes");
    const b = await withEntry(pdfEntry, () => w.read(doc({ digest: dp, bytes: 20, ct: "application/pdf", format: "pdf" })));
    const c = await w.read(doc({ digest: "f".repeat(64), bytes: 1 }));
    return JSON.stringify([a, b, c]);
  };

  const before = await readAll();
  const [text, pdf, gone] = JSON.parse(before);
  assert.equal(text.reading.read_from_text, true);
  assert.equal(pdf.reading.text_tier, 3);
  assert.equal(gone.reading.found, false);
  const storage = {};
  register({ storage });
  register({});
  const after = await readAll();
  assert.equal(after, before);
  assert.deepEqual(calls, []);
  /* The registered hooks are live: they run when the committing module calls afterRead, and only then. */
  const out = await readHooksOf({ storage }).afterRead({ captureSha: "s", captureClass: "minutes", reading: JSON.parse(before)[0].reading, committed: true });
  assert.deepEqual(out, { ran: MODULE_ORDER.filter((m) => ["entities", "events", "content"].includes(m)), failed: [] });
  assert.equal(calls.length, 3);
  assert.equal(await readAll(), before);
});

test("R43: wants(captureClass) answers true exactly when a registered hook's classes include the class; false for null, a non-string, a class no hook holds and an empty registry; it runs nothing and registers nothing", async () => {
  const h = new ReadHooks();
  assert.equal(h.wants("minutes"), false, "no hook registered");
  const calls = [];
  assert.equal(h.onRead("events", (e) => calls.push(e), { captureClasses: ["minutes", "agenda"] }).ok, true);
  assert.equal(h.wants("minutes"), true);
  assert.equal(h.wants("agenda"), true);
  assert.equal(h.wants("generic"), false);
  assert.equal(h.wants(null), false);
  assert.equal(h.wants(undefined), false);
  assert.equal(h.wants(42), false);
  assert.equal(h.wants(["minutes"]), false);
  assert.equal(h.wants(""), false);
  assert.deepEqual(calls, [], "nothing ran");
  assert.equal(h.onRead("lines", noop, { captureClasses: [] }).code, "LISTENER_MALFORMED");
  assert.equal(h.wants("generic"), false, "a refused registration holds no class");
  assert.deepEqual(await h.afterRead({ captureSha: "s", captureClass: "generic", reading: {}, committed: true }), { ran: [], failed: [] });
  assert.equal(readHooksOf({ storage: {} }).wants("minutes"), false);
});
