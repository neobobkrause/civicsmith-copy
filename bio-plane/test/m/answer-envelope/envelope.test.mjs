/* answer-envelope: the envelope (R1–R5), the rows the doors raise (R8) and the invariant (R9), driven at this module's
   interface: `json`, `dec49Attach`, `doAnswer`, `storeRefusal`, `storeSilent`, `relayAnswer`, `planeInternalError` and
   the row readers. Moved from control-plane's `envelope.test.mjs` at the split (T35-80, K1974): its cases on these
   functions, ids re-pointed (control-plane R21–R25 → R1–R5, R32's rows → R8, R33 → R9); the cases that drive
   `makeFetch` stay with the door that routes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { M } from "./load.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const reply = (o, status = 200) => () => new Response(JSON.stringify(o), { status });
const quietly = async (fn) => {
  const logged = [], was = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try { return { value: await fn(), logged }; } finally { console.error = was; }
};
const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const clone = (o) => JSON.parse(JSON.stringify(o));

/* Every answer this module builds, with what each is. */
async function answers() {
  const corr = crypto.randomUUID();
  const refused = await M.doAnswer(reply({ ok: false, reason: "BAD_JSON", detail: "d" }, 400)());
  return [["json", M.json({ ok: true, a: 1 })], ["json 207", M.json({ ok: true }, 207)],
          ["json refusal", M.json({ ok: false, reason: "UNKNOWN_OP" }, 404)],
          ["storeSilent", M.storeSilent("verify")], ["storeSilent with id", M.storeSilent("verify", corr)],
          ["storeRefusal", M.storeRefusal(refused, { store: "bio", tokenClass: "member" })],
          ["relay answered", await M.relayAnswer(reply({ ok: true, result: { a: 1 } }, 201)(), "login")],
          ["relay refused", await M.relayAnswer(reply({ ok: false, error: "unknown op: x" }, 400)(), "login")],
          ["relay silent", await M.relayAnswer(new Response("<html>"), "login")],
          ["internal error", (await quietly(() => M.planeInternalError(new Error("x"), new Request("https://p.example/api?op=index")))).value]];
}

test("R1: every answer is JSON with access-control-allow-origin *, compact, at the status given; a forwarded answer is the handler's with store and tokenClass added and its HTTP status kept", async () => {
  for (const [what, r] of await answers()) {
    assert.match(r.headers.get("content-type") ?? "", /^application\/json/, what);
    assert.equal(r.headers.get("access-control-allow-origin"), "*", what);
    const text = await r.text();
    assert.notEqual(JSON.parse(text), null, what);
    assert.equal(text, JSON.stringify(JSON.parse(text)), `${what}: compact`);
  }
  for (const [o, status] of [[{ ok: true, result: { a: 1 } }, 200], [{ ok: true, result: [1, 2], extra: "kept" }, 207],
                             [{ ok: true, result: { ok: false, reason: "NO_SUCH_BUNDLE" } }, 404], [{ ok: false }, 500]]) {
    const r = M.json(clone(o), status);
    assert.equal(r.status, status);
    assert.deepEqual(await r.json(), M.dec49Attach(clone(o)));
  }
  assert.equal(M.json({}).status, 200);
  /* the forward: the handler's body, two fields added, the status kept */
  for (const [status, body] of [[400, { ok: false, reason: "BAD_JSON", detail: "d" }], [409, { ok: false, error: "said so" }],
                                [404, { ok: false, reason: "NO_SUCH_BUNDLE", x: [1] }]]) {
    const out = await M.doAnswer(reply(body, status)());
    for (const [st, tc] of [["bio", "member"], ["scratch", "probe"], ["bio", "ai"]]) {
      const r = M.storeRefusal(out, { store: st, tokenClass: tc });
      assert.equal(r.status, status);
      assert.deepEqual(await r.json(), { ...M.dec49Attach(clone(body)), store: st, tokenClass: tc });
    }
  }
});

test("R2: a refusal (ok:false, at the top level or under result) whose reason or code has a row gains code, check and translation where absent, for every translated row the families hold; only those two levels are decorated; never overwritten, never invented, never on a success", () => {
  let rows = 0;
  for (const family of Object.values(M.CHECK_FAMILIES))
    for (const [code, row] of Object.entries(family)) {
      const want = M.dec49Row(code);
      if (!(typeof row.translation === "string" && row.translation)) { assert.equal(want, null, code); continue; }
      rows++;
      assert.deepEqual(want, { check: row.check ?? null, translation: row.translation }, code);
      assert.deepEqual(M.dec49Attach({ ok: false, reason: code }), { ok: false, reason: code, code, check: want.check, translation: want.translation }, code);
      assert.deepEqual(M.dec49Attach({ ok: false, code }), { ok: false, code, check: want.check, translation: want.translation }, code);
      assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, reason: code } }),
                       { ok: true, result: { ok: false, reason: code, code, check: want.check, translation: want.translation } }, code);
      /* the reason wins over a code the refusal also carries */
      assert.equal(M.dec49Attach({ ok: false, reason: code, code: "OTHER" }).check, want.check, code);
    }
  assert.ok(rows > 900, String(rows));
  /* the door reads module tables beside the catalogue's own: admission's C-38, capture's C-118 (N347), tasks' C-76.1 */
  assert.equal(M.dec49Attach({ ok: false, reason: "NOT_AUTHENTICATED" }).check, "C-38.1");
  assert.equal(M.dec49Attach({ ok: false, code: "CLASS_FORBIDDEN" }).check, "C-38.2");
  assert.equal(M.dec49Row("EVIDENCE_NOT_HELD").check, "C-118.1");
  assert.equal(M.dec49Row("NO_SUCH_KNOCK").check, "C-118.2");
  assert.equal(M.dec49Row("TASK_NOT_YOURS").check, "C-76.1");
  assert.equal(M.dec49Row("NOT_FOUND"), null);
  /* never overwritten */
  const mine = { ok: false, reason: "NOT_AUTHENTICATED", check: "C-0", translation: "mine", code: "X" };
  assert.deepEqual(M.dec49Attach({ ...mine }), mine);
  assert.deepEqual(M.dec49Attach({ ok: true, result: { ...mine } }), { ok: true, result: mine });
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "TASK_NOT_YOURS", check: "C-0", translation: "mine" }),
                   { ok: false, reason: "TASK_NOT_YOURS", check: "C-0", translation: "mine", code: "TASK_NOT_YOURS" });
  /* never invented, never on a success, never deeper than result, never on an array or a non-object */
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "NO_ROW_FOR_THIS_CODE" }), { ok: false, reason: "NO_ROW_FOR_THIS_CODE" });
  assert.deepEqual(M.dec49Attach({ ok: true, reason: "NOT_AUTHENTICATED" }), { ok: true, reason: "NOT_AUTHENTICATED" });
  assert.deepEqual(M.dec49Attach({ reason: "NOT_AUTHENTICATED" }), { reason: "NOT_AUTHENTICATED" });
  assert.deepEqual(M.dec49Attach({ ok: false, reason: 7 }), { ok: false, reason: 7 });
  const deep = { ok: true, result: { ok: true, rows: [{ ok: false, reason: "NOT_AUTHENTICATED" }], sub: { ok: false, reason: "SCOPE_REFUSED" } } };
  assert.deepEqual(M.dec49Attach(clone(deep)), deep);
  assert.deepEqual(M.dec49Attach([{ ok: false, reason: "NOT_AUTHENTICATED" }]), [{ ok: false, reason: "NOT_AUTHENTICATED" }]);
  for (const v of [null, undefined, 3, "s"]) assert.equal(M.dec49Attach(v), v);
  /* json() is the chokepoint: what leaves through it is decorated */
  return M.json({ ok: true, result: { ok: false, reason: "SCOPE_REFUSED" } }).json()
    .then((j) => assert.deepEqual([j.result.code, j.result.check], ["SCOPE_REFUSED", "C-38.6"]));
});

test("R3: doAnswer reads a store's reply: answered is ok === true and nothing else, refused is the store's own ok:false below 500, everything else is a silence; a silence is 502 STORE_DID_NOT_ANSWER (C-69.2) naming the op, never an absence, refusal or success, and carries the correlation id the store's internal error gave and nothing else of it; the store's own refusal is relayed at its status with its code and sentence (store-door R1's BAD_JSON among them)", async () => {
  for (const [result, status] of [[null, 200], [[], 200], [{}, 201], [0, 200], ["", 200], [{ ok: false }, 404]]) {
    const a = await M.doAnswer(new Response(JSON.stringify({ ok: true, result }), { status }));
    assert.deepEqual([a.answered, a.refused, a.result, a.reply.status, a.reply.body], [true, undefined, result, status, { ok: true, result }]);
  }
  for (const [body, status] of [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                                [{ ok: false, error: "unknown op: nosuch" }, 400], [{ ok: false, error: "e" }, 200], [{ ok: false }, 499]]) {
    const a = await M.doAnswer(new Response(JSON.stringify(body), { status }));
    assert.deepEqual(a, { answered: false, refused: true, result: undefined, reply: { status, body } });
  }
  for (const bad of [new Response("nope"), new Response(JSON.stringify({ ok: false, error: "Error: boom\n at x" }), { status: 500 }),
                     new Response(JSON.stringify({ ok: false }), { status: 503 }), new Response(JSON.stringify({ ok: "true" })),
                     new Response(JSON.stringify({ ok: "false" }), { status: 400 }), new Response(JSON.stringify({ ok: 0 }), { status: 400 }),
                     new Response(JSON.stringify({ result: 1 })), new Response(JSON.stringify([{ ok: false }]), { status: 400 }),
                     new Response("null"), new Response(""), Promise.reject(new Error("x")), null, undefined])
    assert.deepEqual(await M.doAnswer(bad), { answered: false, result: undefined });
  /* the silence: its row, the op, the detail, no statement about the record */
  const row = M.DISPATCH_CHECKS.STORE_DID_NOT_ANSWER;
  for (const op of ["verify", "publishedbytes", "claim"]) {
    const s = M.storeSilent(op);
    assert.equal(s.status, 502);
    const sj = await s.json();
    assert.deepEqual(sj, { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER", check: "C-69.2",
                           translation: row.translation, op, detail: M.STORE_SILENT_DETAIL });
    assert.equal("correlation" in sj, false);
  }
  assert.equal(M.STORE_SILENT_REASON, "STORE_DID_NOT_ANSWER");
  /* the correlation: carried from the store's own internal error only, and only when it is an id */
  const corr = crypto.randomUUID();
  const failed = { ok: false, error: "Error: boom /srv/store.mjs:1", reason: "STORE_INTERNAL_ERROR", correlation: corr };
  const read = await M.doAnswer(reply(failed, 500)());
  assert.deepEqual(read, { answered: false, result: undefined, correlation: corr });
  const sj = await M.storeSilent("knock", read.correlation).json();
  assert.deepEqual([sj.reason, sj.op, sj.correlation], ["STORE_DID_NOT_ANSWER", "knock", corr]);
  assert.equal(JSON.stringify(sj).includes("boom"), false);
  for (const bad of [{ ok: false, correlation: corr }, { ok: false, reason: "STORE_INTERNAL_ERROR", correlation: "x<script>" },
                     { ok: false, reason: "STORE_INTERNAL_ERROR", correlation: corr + "0" }, { ok: false, reason: "STORE_INTERNAL_ERROR" },
                     { ok: false, reason: "OTHER", correlation: corr }])
    assert.deepEqual(await M.doAnswer(reply(bad, 500)()), { answered: false, result: undefined }, JSON.stringify(bad));
  /* N339: what the plane hands every module's relay answers a refusal at its status with its code and sentence plus what
     the relay adds, never as STORE_DID_NOT_ANSWER */
  for (const [body, status] of [[{ ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" }, 400],
                                [{ ok: false, error: "unknown op: nosuch" }, 400], [{ ok: false, reason: "SOME_STORE_REASON", error: "said so" }, 409]]) {
    const out = await M.doAnswer(reply(body, status)());
    assert.equal(out.refused, true);
    const x = M.storeRefusal(out, { op: "knock", store: "bio" });
    assert.equal(x.status, status);
    const j = await x.json();
    assert.deepEqual(j, { ...M.dec49Attach(clone(body)), op: "knock", store: "bio" });
    assert.notEqual(j.reason, "STORE_DID_NOT_ANSWER");
  }
  /* the sentinel a renderer throws for a silence: an Error carrying the op, told apart from a genuine crash */
  const e = new M.StoreSilent("publishedcase");
  assert.ok(e instanceof Error && e instanceof M.StoreSilent);
  assert.equal(e.op, "publishedcase");
  assert.equal(new Error("x") instanceof M.StoreSilent, false);
});

test("R4: a relayed store answer answers the store's own status and its envelope, the store's own refusal at its status, and R3's 502 STORE_DID_NOT_ANSWER on a store failure, never 200 — exactly when doAnswer reads the reply so, for every relay op", async () => {
  const bodies = [["<html>", 200], [JSON.stringify({ ok: true, result: { a: 1 } }), 200], [JSON.stringify({ ok: true, result: null }), 201],
                  [JSON.stringify({ ok: true }), 200], [JSON.stringify({ ok: "true", result: 1 }), 200], [JSON.stringify({ ok: false }), 500],
                  [JSON.stringify({ ok: false, reason: "BAD_JSON", detail: "d" }), 400], [JSON.stringify({ ok: false, error: "e" }), 200],
                  [JSON.stringify({ ok: 1, result: 2 }), 200], ["", 200], ["null", 200], [JSON.stringify([{ ok: true }]), 200],
                  // fixtures-generic: WRONG_PASSWORD
                  [JSON.stringify({ ok: true, result: { ok: false, reason: "WRONG_PASSWORD" } }), 200],
                  [JSON.stringify({ ok: false, error: "x" }), 503], [JSON.stringify({}), 200]];
  for (const op of ["claim", "login", "invitelook", "enroll"])
    for (const [text, status] of bodies) {
      const mk = () => new Response(text, { status });
      const read = await M.doAnswer(mk());
      const r = await M.relayAnswer(mk(), op);
      const j = await r.json();
      if (read.answered) {
        assert.equal(r.status, status, text);
        assert.deepEqual(j, clone({ ok: true, result: read.result }), text);
      } else if (read.refused) {
        assert.equal(r.status, read.reply.status, text);
        assert.deepEqual(j, M.dec49Attach(clone(read.reply.body)), text);
      } else {
        assert.equal(r.status, 502, text);
        assert.deepEqual([j.reason, j.check, j.op], ["STORE_DID_NOT_ANSWER", "C-69.2", op], text);
      }
    }
  /* a stub that rejects or throws, and no reply at all, are silences too; the store's internal error keeps its id */
  for (const bad of [Promise.reject(new Error("x")), Promise.resolve().then(() => { throw new Error("gone"); }), null, undefined])
    assert.equal((await M.relayAnswer(bad, "enroll")).status, 502);
  const corr = crypto.randomUUID();
  const x = await M.relayAnswer(reply({ ok: false, error: "SECRET", reason: "STORE_INTERNAL_ERROR", correlation: corr }, 500)(), "enroll");
  const xj = await x.json();
  assert.deepEqual([x.status, xj.correlation, JSON.stringify(xj).includes("SECRET")], [502, corr, false]);
});

test("R5: an error thrown in the Worker's door is answered PLANE_INTERNAL_ERROR (C-69.3) with a correlation id, never the stack, the message, a path or a line, and the stack is logged server-side under the id, each throw its own id", async () => {
  const SECRET = "SQLITE_CONSTRAINT secret-value /srv/plane/src/store.mjs:4242";
  const ids = [];
  for (const [label, err, req, op] of [["error", new Error(SECRET), new Request("https://p.example/api?op=index"), "index"],
                                       ["path op", new TypeError(SECRET), new Request("https://p.example/sign"), "/sign"],
                                       ["a thrown string", SECRET, new Request("https://p.example/api?op=knock"), "knock"],
                                       ["no request", new Error(SECRET), null, ""]]) {
    const { value: r, logged } = await quietly(() => M.planeInternalError(err, req));
    assert.equal(r.status, 500, label);
    const text = await r.text();
    const j = JSON.parse(text);
    assert.deepEqual(Object.keys(j).sort(), ["check", "code", "correlation", "error", "ok", "reason", "translation"], label);
    assert.deepEqual([j.ok, j.error, j.reason, j.code, j.check], [false, "internal error", "PLANE_INTERNAL_ERROR", "PLANE_INTERNAL_ERROR", "C-69.3"], label);
    assert.equal(j.translation, M.DISPATCH_CHECKS.PLANE_INTERNAL_ERROR.translation, label);
    assert.match(j.correlation, UUID, label);
    assert.equal(/secret-value|store\.mjs|SQLITE|:4242| at /.test(text), false, label);
    assert.equal(logged.length, 1, label);
    const line = JSON.parse(logged[0]);
    assert.deepEqual([line.event, line.correlation, line.op], ["PLANE_INTERNAL_ERROR", j.correlation, op], label);
    assert.match(line.stack, /secret-value/, label);
    ids.push(j.correlation);
  }
  assert.equal(new Set(ids).size, ids.length);
  /* the answer alone, as the door's catch builds it */
  const c = crypto.randomUUID();
  assert.deepEqual(M.planeInternalAnswer(c), { ok: false, error: "internal error", reason: "PLANE_INTERNAL_ERROR",
    code: "PLANE_INTERNAL_ERROR", check: "C-69.3", translation: M.DISPATCH_CHECKS.PLANE_INTERNAL_ERROR.translation, correlation: c });
  /* a log that cannot be written changes nothing the caller is told */
  const was = console.error;
  console.error = () => { throw new Error("log down"); };
  try { assert.equal((await M.planeInternalError(new Error("x"), null).json()).reason, "PLANE_INTERNAL_ERROR"); } finally { console.error = was; }
});

/* R8's rows: code → [check, the file whose code raises it]. */
const HELD = {
  UNKNOWN_OP: ["C-69.1", "src/control-plane/index.mjs"], STORE_DID_NOT_ANSWER: ["C-69.2", "src/answer-envelope/index.mjs"],
  PLANE_INTERNAL_ERROR: ["C-69.3", "src/answer-envelope/index.mjs"], STORE_INTERNAL_ERROR: ["C-69.4", "src/store-door/dispatch.mjs"],
  PURGE_HOLD_IN_PLACE: ["C-69.5", "src/store-door/dispatch.mjs"], BOOTSTRAP_CREDENTIAL_UNSET: ["C-68.2", "src/control-plane/index.mjs"],
  BOOTSTRAP_CREDENTIAL_PUBLISHED: ["C-68.3", "src/control-plane/index.mjs"], BOOTSTRAP_CREDENTIAL_MISMATCH: ["C-68.4", "src/control-plane/index.mjs"],
  REPLAY_UNVERIFIED: ["C-66.6", "src/control-plane/index.mjs"], REQUIRED_ARGUMENT_MISSING: ["C-61.1", "src/answer-envelope/index.mjs"],
  SIGNINTRACE_NOT_TEST: ["C-69.7", "src/signin-door/index.mjs"],
};

test("R8, R16: this module's table holds exactly the rows of the checks the doors raise (C-69.1–.5, C-68.2–.4, C-66.6, C-61.1, and since T47 C-69.7 SIGNINTRACE_NOT_TEST, signin-door R5's refusal off a test instance; C-69.6 retired, R14), each code, check and translation unchanged, each `where` naming the file whose code raises it, its own sites found there by their regions; DISPATCH_CHECKS answers the rows store-door mints; each reader answers its row and refuses to invent one", async () => {
  const OWN = await import("../../../src/answer-envelope/checks.mjs");
  const rows = {};
  for (const [fam, table] of Object.entries(OWN)) if (isFamily(fam, table))
    for (const [code, row] of Object.entries(table)) { assert.equal(rows[code], undefined, code); rows[code] = row; }
  assert.deepEqual(Object.keys(rows).sort(), Object.keys(HELD).sort());
  /* unchanged: every row the snapshot of control-plane's day held reads the same check and words (C-69.5 came after it,
     and is pinned here by its words) */
  const SNAP = JSON.parse(readFileSync(new URL("./rows-before-r43.json", import.meta.url), "utf8")).rows;
  const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  for (const [code, [check, file]] of Object.entries(HELD)) {
    const row = rows[code];
    assert.equal(row.check, check, code);
    assert.ok(typeof row.translation === "string" && row.translation, code);
    if (SNAP[code]) assert.deepEqual([row.check, digest(row.translation)], SNAP[code], code);
    const [where, region] = row.where.split(" > ");
    assert.equal(where.split(" ")[0], file, code);
    assert.match(region, /^is-[a-z-]+$/, code);
    if (file.startsWith("src/answer-envelope/")) {
      const src = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
      assert.ok(src.includes(`DEC-49 REGION ${region}`) && src.includes(`END DEC-49 REGION ${region}`), `${code}: its region is in ${file}`);
      assert.ok(src.includes(`function ${where.split(" ")[1]}(`), `${code}: ${where}`);
    }
  }
  assert.equal(digest(rows.PURGE_HOLD_IN_PLACE.translation), "ae6bd47138c83f85");
  /* the families read these rows, and each decorates with its own words */
  for (const [code, row] of Object.entries(rows)) assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  /* store-door's two rows are DISPATCH_CHECKS' */
  for (const code of ["STORE_INTERNAL_ERROR", "PURGE_HOLD_IN_PLACE"]) assert.equal(M.DISPATCH_CHECKS[code], rows[code]);
  /* the readers: each its family, the row's three fields, and a throw for a code with no sentence */
  for (const [reader, family] of [[M.dispatchRow, M.DISPATCH_CHECKS], [M.installationRow, M.BOOTSTRAP_CHECKS],
                                  [M.replayRow, M.REPLAY_CHECKS], [M.requiredArgumentRow, M.REQUIRED_ARGUMENT_CHECKS]]) {
    for (const [code, row] of Object.entries(family)) assert.deepEqual(reader(code), { code, check: row.check, translation: row.translation });
    assert.throws(() => reader("NO_SUCH_CODE"), /DEC-49/);
    assert.throws(() => reader("UNKNOWN_OP" in family ? "REPLAY_UNVERIFIED" : "UNKNOWN_OP"), /DEC-49/);
  }
  /* R16 (T47; signin-door R5, connect §3): C-69.7 SIGNINTRACE_NOT_TEST, the door's next free C-69 number, its row
     DISPATCH_CHECKS', read by its reader and decorated by R2 with its own check and words */
  const trace = rows.SIGNINTRACE_NOT_TEST;
  assert.equal(M.DISPATCH_CHECKS.SIGNINTRACE_NOT_TEST, trace);
  assert.match(trace.where, /^src\/signin-door\/index\.mjs signintrace > is-signintrace-test-instance$/);
  assert.deepEqual(M.dispatchRow("SIGNINTRACE_NOT_TEST"), { code: "SIGNINTRACE_NOT_TEST", check: "C-69.7", translation: trace.translation });
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "SIGNINTRACE_NOT_TEST" }),
                   { ok: false, reason: "SIGNINTRACE_NOT_TEST", code: "SIGNINTRACE_NOT_TEST", check: "C-69.7", translation: trace.translation });
  assert.doesNotMatch(trace.translation, /trace=|token|secret/i);
  /* the door's C-69 numbers are each held once across every family; C-69.6 by none (R14) */
  const c69 = Object.values(M.CHECK_FAMILIES).flatMap((f) => Object.entries(f)).filter(([, r]) => /^C-69\./.test(r.check));
  assert.deepEqual(c69.map(([c, r]) => `${r.check} ${c}`).sort(), ["C-69.1 UNKNOWN_OP", "C-69.2 STORE_DID_NOT_ANSWER", "C-69.3 PLANE_INTERNAL_ERROR",
    "C-69.4 STORE_INTERNAL_ERROR", "C-69.5 PURGE_HOLD_IN_PLACE", "C-69.7 SIGNINTRACE_NOT_TEST"]);
  /* C-61.1's one raiser: the argument complaint, its error passed through byte for byte, nothing changed */
  const a = M.requiredArgument("capture", "sha256", "<64 lowercase hex>", "a complaint the store made");
  assert.deepEqual(a, { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", code: "REQUIRED_ARGUMENT_MISSING", check: "C-61.1",
    translation: M.REQUIRED_ARGUMENT_CHECKS.REQUIRED_ARGUMENT_MISSING.translation, error: "a complaint the store made",
    op: "capture", argument: "sha256", shape: "<64 lowercase hex>",
    detail: "op=capture needs 'sha256' in the shape <64 lowercase hex>, and this request carried none the operation could use. Nothing was changed." });
});

test("R14 (T47; DEC-198 (3), N992, N981; K3030): DISPATCH_CHECKS holds no row for DISCLOSURE_DUE and no family holds C-69.6 (its number never reused); the module-local DOOR_WORDS is gone; the code's one row is C-29.40, held since T48 by ai-accounts (R17) and read from its family, whose translation is words.json's refusal.DISCLOSURE_DUE, read by key; a DISCLOSURE_DUE the door answers at a sign-in's start, minted through dispatchRow as control-plane's door mints it until its R65 (T47-65), leaves decorated with C-29.40's check and translation (control: every other code dispatchRow does not hold still throws; negative control: the T46 row's number and words are seen nowhere)", async () => {
  const OWN = await import("../../../src/answer-envelope/checks.mjs");
  for (const [fam, table] of Object.entries(OWN)) if (isFamily(fam, table)) assert.equal(Object.hasOwn(table, "DISCLOSURE_DUE"), false, fam);
  assert.equal("DOOR_WORDS" in OWN, false);
  assert.equal("DOOR_WORDS" in M, false);
  const all = Object.values(M.CHECK_FAMILIES).flatMap((f) => Object.entries(f));
  assert.equal(all.some(([, r]) => r.check === "C-69.6"), false, "C-69.6 is held by no code");
  /* the one row: C-29.40, ai-accounts' since T48 (R17), read from its family, earlier in the order */
  const CR = await import("../../../src/ai-accounts/checks.mjs");
  const holders = M.CHECK_FAMILY_FILES.flatMap(([p, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && Object.hasOwn(v, "DISCLOSURE_DUE")).map(([k, v]) => [p, k, v.DISCLOSURE_DUE]));
  assert.equal(holders.length, 1);
  assert.equal(holders[0][0], "src/ai-accounts/checks.mjs");
  const row = holders[0][2];
  assert.equal(row.check, "C-29.40");
  assert.equal(Object.values(CR).some((v) => isFamily("X_CHECKS", v) && v.DISCLOSURE_DUE === row), true);
  const WORDS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words;
  const sentence = WORDS.find((w) => w.key === "refusal.DISCLOSURE_DUE")?.en;
  assert.ok(typeof sentence === "string" && sentence, "words.json holds refusal.DISCLOSURE_DUE");
  assert.equal(row.translation, sentence);
  assert.deepEqual(M.dec49Row("DISCLOSURE_DUE"), { check: "C-29.40", translation: sentence });
  /* the door's refusal at a sign-in's start, as control-plane builds it today, on the wire */
  const start = { ok: false, reason: "DISCLOSURE_DUE", ...M.dispatchRow("DISCLOSURE_DUE"), detail: "d" };
  const wire = await M.json(start, 409).json();
  assert.deepEqual(wire, { ok: false, reason: "DISCLOSURE_DUE", code: "DISCLOSURE_DUE", check: "C-29.40", translation: sentence, detail: "d" });
  /* the same refusal minted bare, and relayed under result, decorates the same */
  assert.deepEqual(await M.json({ ok: false, reason: "DISCLOSURE_DUE" }, 409).json(), { ok: false, reason: "DISCLOSURE_DUE", code: "DISCLOSURE_DUE", check: "C-29.40", translation: sentence });
  assert.deepEqual((await M.json({ ok: true, result: { ok: false, reason: "DISCLOSURE_DUE" } }).json()).result.check, "C-29.40");
  /* control: dispatchRow answers no other code it does not hold, a decorated one included */
  for (const code of ["NOT_AUTHENTICATED", "REAUTH_DUE", "NO_SUCH_CODE"]) assert.throws(() => M.dispatchRow(code), /DEC-49/, code);
  /* negative control: the T46 interim sentence is held by no row */
  const T46 = "Read what connecting means first: your questions and what is read to answer them go to Anthropic under your own account.";
  assert.equal(all.some(([, r]) => r.translation === T46), false);
  assert.notEqual(sentence, T46);
});

test("R9: no place is named in this module's behaviour or outward text: its source, every row it holds, the silence's detail and every answer it builds", async () => {
  const PLACES = /\b(oakland|alameda|berkeley|california|san francisco|bay area|emeryville|contra costa)\b/i;
  const dir = new URL("../../../src/answer-envelope/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  assert.deepEqual(files.sort(), ["checks.mjs", "families.mjs", "index.mjs"]);
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), PLACES, f);
  const OWN = await import("../../../src/answer-envelope/checks.mjs");
  for (const [fam, table] of Object.entries(OWN)) if (isFamily(fam, table))
    for (const [code, row] of Object.entries(table)) assert.doesNotMatch(JSON.stringify(row), PLACES, code);
  assert.doesNotMatch(M.STORE_SILENT_DETAIL, PLACES);
  for (const [what, r] of await answers()) assert.doesNotMatch(await r.text(), PLACES, what);
  /* negative control: the pattern sees a place */
  assert.match("Oakland", PLACES);
});
