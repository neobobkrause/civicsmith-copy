/* connections: the op handler moved out of `src/index.mjs` into `src/connections/ops.mjs` (legacy-index map §4.4 move,
   K649 (7)), driven at its interface with a fake Durable Object stub and control-plane-shaped stamps; and the
   connections share of the old suite `test/subresources.test.mjs` (op=linkproject, R24–R29; the links_to edge's write),
   converted. The stamps below mimic control-plane's `json`, `doAnswer`, `storeRefusal` and `storeSilent` (not imported:
   control-plane is a later module); the end-to-end store mimics control-plane's Durable Object frame (`dispatch`: a
   route of the map answers `{ok: true, result}`, an unknown one 400, a throw 500) over the real `connectionsOps`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { world, V, MACHINE } from "./fixture.mjs";
import { CONNECTIONS_OPS, connectionsOp } from "../../../src/connections/ops.mjs";
import { connectionsOps } from "../../../src/connections/index.mjs";
import { checkBundle } from "../../../src/record-grammar/bundle.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b";
const CAP = "ab".repeat(32);
const UUID = "0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0";

/* ------------------------------------------------------------------ control-plane-shaped stamps */

function stamps(o = {}) {
  /* A stamp given as undefined or null is handed as given (an absent stamp), never defaulted. */
  const viewer = "viewer" in o ? o.viewer : MACHINE, identity = "identity" in o ? o.identity : MACHINE;
  const calls = { json: [], storeRefusal: [], storeSilent: [], doAnswer: 0 };
  const json = (obj, status = 200) => {
    calls.json.push({ obj, status });
    return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
  };
  /* control-plane's reading of the store's envelope: an answer, the store's own refusal (ok:false below 500), else a
     silence carrying a correlation only from the store's own internal error. */
  const doAnswer = async (res) => {
    calls.doAnswer++;
    let r = null, out = null;
    try { r = await res; out = await r.json(); } catch { out = null; }
    if (!out || typeof out !== "object" || Array.isArray(out)) return { answered: false, result: undefined };
    const reply = { status: typeof r.status === "number" ? r.status : 200, body: out };
    if (out.ok === true) return { answered: true, result: out.result, reply };
    if (out.ok === false && reply.status < 500) return { answered: false, refused: true, result: undefined, reply };
    return out.reason === "STORE_INTERNAL_ERROR" && typeof out.correlation === "string"
      ? { answered: false, result: undefined, correlation: out.correlation } : { answered: false, result: undefined };
  };
  const storeRefusal = (p) => { calls.storeRefusal.push(p); return json({ ...p.reply.body }, p.reply.status); };
  // fixtures-contract: answer-envelope door-helpers
  const storeSilent = (op, correlation = undefined) => {
    calls.storeSilent.push({ op, correlation });
    return json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op, correlation }, 502);
  };
  return { calls, s: { json, doAnswer, storeRefusal, storeSilent, viewer, identity } };
}

/* A fake Durable Object stub answering `reply(path)` (a Response, a promise of one, or a throw). */
function fakeStore(reply = () => Response.json({ ok: true, result: { projected: 0, edges: [] } })) {
  const store = { paths: [], got: 0, fetch(path) { store.paths.push(path); return reply(path); } };
  const getStore = () => { store.got++; return store; };
  return { store, getStore };
}

/* The store over the fixture's world: `projectlinks` (and every other route) is the real `connectionsOps`. */
function worldStore(w) {
  return fakeStore(async (path) => {
    const url = new URL(path);
    const op = url.pathname.slice(1);
    try {
      const map = connectionsOps(w.k, url, null, {});
      if (!Object.hasOwn(map, op)) return Response.json({ ok: false, error: "unknown op: " + op }, { status: 400 });
      return Response.json({ ok: true, result: await map[op]() });
    } catch (e) {
      // fixtures-contract: store-door store-replies
      return Response.json({ ok: false, reason: "STORE_INTERNAL_ERROR", correlation: UUID }, { status: 500 });
    }
  });
}

const req = (q) => new URL(`http://x/api/?op=linkproject&token=mem${q ? "&" + q : ""}`);
const body = async (res) => ({ status: res.status, body: await res.json() });

/* ------------------------------------------------------------------ the op handler (legacy-index map §4.4 move) */

test("R24 (legacy-index map §4.4 move): CONNECTIONS_OPS is exactly [\"linkproject\"], frozen", () => {
  assert.deepEqual([...CONNECTIONS_OPS], ["linkproject"]);
  assert.equal(Object.isFrozen(CONNECTIONS_OPS), true);
});

test("R24 (legacy-index map §4.4 move): connectionsOp answers null for any op not its own, and never reaches the store", async () => {
  for (const op of ["links", "projectlinks", "connect", "backlinks", "LinkProject", "linkproject ", "", undefined, null]) {
    const { store, getStore } = fakeStore();
    const { calls, s } = stamps();
    assert.equal(await connectionsOp(op, req(`capture=${CAP}`), getStore, s), null, `op ${JSON.stringify(op)}`);
    assert.equal(store.got, 0); assert.deepEqual(store.paths, []);
    assert.equal(calls.doAnswer, 0); assert.equal(calls.json.length, 0);
  }
});

test("R24 (legacy-index map §4.4 move): a capture that is not 64 lowercase hex is 400 NEED_CAPTURE, and the store is never asked", async () => {
  for (const q of ["", "capture=", `capture=${CAP.toUpperCase()}`, `capture=${CAP.slice(1)}`, `capture=${CAP}0`,
                   `capture=${"g".repeat(64)}`, `capture=%20${CAP}`, `capture=${CAP.slice(0, 32)}-${CAP.slice(33)}`]) {
    const { store, getStore } = fakeStore();
    const { calls, s } = stamps();
    const r = await body(await connectionsOp("linkproject", req(q), getStore, s));
    assert.equal(r.status, 400, q);
    assert.equal(r.body.ok, false); assert.equal(r.body.reason, "NEED_CAPTURE");
    assert.deepEqual(store.paths, [], `the store is not fetched for ${q}`);
    assert.equal(calls.doAnswer, 0);
  }
});

test("R26, R27 (legacy-index map §4.4 move): the store is asked projectlinks with the capture, the bundle (encoded) only when given, and the HANDED viewer and identity stamps — never the query string's", async () => {
  const viewer = "member:b&ob=1", identity = "member:c l#?";
  /* The request tries to name its own viewer and identity; only the stamps reach the store. */
  const forged = "viewer=class%3Aadmin&identity=member%3Amallory";
  const { store, getStore } = fakeStore();
  const { s } = stamps({ viewer, identity });
  await connectionsOp("linkproject", req(`capture=${CAP}&${forged}`), getStore, s);
  const bundle = "INFO-2026-0001-a&viewer=class:admin";
  await connectionsOp("linkproject", req(`capture=${CAP}&bundle=${encodeURIComponent(bundle)}&${forged}`), getStore, s);
  await connectionsOp("linkproject", req(`capture=${CAP}&bundle=&${forged}`), getStore, s);
  assert.equal(store.paths.length, 3);
  const [plain, named, empty] = store.paths.map((p) => new URL(p));
  for (const u of [plain, named, empty]) {
    assert.equal(u.pathname, "/projectlinks");
    assert.deepEqual(u.searchParams.getAll("capture"), [CAP]);
    assert.deepEqual(u.searchParams.getAll("viewer"), [viewer], "one viewer, the stamp");
    assert.deepEqual(u.searchParams.getAll("identity"), [identity], "one identity, the stamp");
  }
  assert.equal(plain.searchParams.has("bundle"), false, "no bundle unless one is given");
  assert.equal(empty.searchParams.has("bundle"), false, "an empty bundle is none");
  assert.deepEqual(named.searchParams.getAll("bundle"), [bundle], "the bundle, encoded whole");
  assert.deepEqual([...named.searchParams.keys()].sort(), ["bundle", "capture", "identity", "viewer"]);
});

test("R24 (legacy-index map §4.4 move): the store's own refusal is relayed through storeRefusal at its status", async () => {
  // fixtures-contract: store-door store-replies
  const refusal = { ok: false, reason: "BAD_JSON", detail: "the request body is not valid JSON" };
  const { getStore } = fakeStore(() => Response.json(refusal, { status: 400 }));
  const { calls, s } = stamps();
  const r = await body(await connectionsOp("linkproject", req(`capture=${CAP}`), getStore, s));
  assert.equal(calls.storeRefusal.length, 1); assert.equal(calls.storeSilent.length, 0);
  assert.deepEqual(r, { status: 400, body: refusal });
});

test("R24 (REC-52; legacy-index map §4.4 move): a store that does not answer is storeSilent(\"linkproject\", correlation), never a projection of nothing", async () => {
  // fixtures-contract: store-door store-replies
  const silences = [
    [() => Response.json({ ok: false, reason: "STORE_INTERNAL_ERROR", correlation: UUID, error: "stack" }, { status: 500 }), UUID],
    [() => new Response("not json", { status: 200 }), undefined],
    [() => Response.json([1, 2], { status: 200 }), undefined],
    [() => Promise.reject(new Error("the stub threw")), undefined],
    [() => Response.json({ ok: false, reason: "STORE_INTERNAL_ERROR" }, { status: 500 }), undefined],
  ];
  for (const [reply, correlation] of silences) {
    const { getStore } = fakeStore(reply);
    const { calls, s } = stamps();
    const r = await body(await connectionsOp("linkproject", req(`capture=${CAP}`), getStore, s));
    assert.deepEqual(calls.storeSilent, [{ op: "linkproject", correlation }]);
    assert.equal(calls.storeRefusal.length, 0);
    assert.equal(r.status, 502); assert.equal(r.body.ok, false);
    assert.equal("projected" in r.body, false, "no counts on a silence");
  }
});

test("R24 (legacy-index map §4.4 move): the store's answer is json({ok: true, ...result})", async () => {
  const result = { projected: 2, edges: [{ from: A, to: B, rel: "links_to" }], skipped_self: 0, note: "n" };
  const { getStore } = fakeStore(() => Response.json({ ok: true, result }));
  const { calls, s } = stamps();
  const r = await body(await connectionsOp("linkproject", req(`capture=${CAP}`), getStore, s));
  assert.deepEqual(r, { status: 200, body: { ok: true, ...result } });
  assert.deepEqual(calls.json.map((c) => c.status), [200]);
  assert.equal(calls.storeSilent.length + calls.storeRefusal.length, 0);
});

/* ------------------------------------------------------------------ end to end over the fixture's world */

/* A source document linking to a held target, an address the record does not hold, and itself (edges.test's). The
   promotions' R29 notices are let run BEFORE the links are recorded, so no system re-projection lands mid-test. */
async function linked(w) {
  const [s] = w.doc(A, ["source"]);
  const [t] = w.doc(B, ["target"]);
  await w.settle(); await w.settle();
  w.receipt("https://example.org/b", t, "2026-09-26T00:00:00Z");
  w.links(s, A, ["https://example.org/b", "https://example.org/not-held", "https://example.org/a"]);
  w.receipt("https://example.org/a", s, "2026-09-26T12:00:00Z");
  return { s, t };
}
const op = (w, q, st) => { const { getStore } = worldStore(w); const { s } = stamps(st); return connectionsOp("linkproject", req(q), getStore, s).then(body); };
const FORGED = `viewer=${encodeURIComponent(MACHINE)}&identity=${encodeURIComponent(V("alice"))}`;

test("R24, R28 (legacy-index map §4.4 move): end to end, the op projects the source's resolved link into one links_to edge, written into the source's document in the stamped identity's name", async () => {
  const w = world();
  const { s } = await linked(w);
  const r = await op(w, `capture=${s}&identity=member%3Amallory`, { viewer: MACHINE, identity: V("alice") });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.projected, 1);
  assert.deepEqual(r.body.edges.map((e) => [e.from, e.to, e.rel, e.asserted_by, e.address]),
    [[A, B, "links_to", "source", "https://example.org/b"]]);
  assert.deepEqual([r.body.skipped_self, r.body.unresolved], [1, 1]);
  assert.deepEqual(w.rows(`SELECT bundle_id, target_id, kind FROM refs WHERE kind='links_to'`),
    [{ bundle_id: A, target_id: B, kind: "links_to" }]);
  const md = w.record.readFile(A, "bundle.md").text;
  assert.match(md, /member:alice/, "the log names the stamped identity");
  assert.equal(md.includes("mallory"), false, "never the query string's");
});

test("R26 (legacy-index map §4.4 move): end to end, the store reads through the STAMPED viewer — a hidden source or target stays hidden however the query names a viewer, and an absent stamp fails closed", async () => {
  const w = world();
  w.member("alice"); w.member("bob");
  const { s } = await linked(w);
  const before = w.snapshot(["refs", "asserted_connections", "files"]);
  /* An absent viewer stamp, the query naming the machine: fails closed, writes nothing. */
  for (const viewer of [null, undefined, ""]) {
    const r = await op(w, `capture=${s}&${FORGED}`, { viewer, identity: V("alice") });
    assert.deepEqual(r, { status: 200, body: { ok: true, projected: 0, edges: [] } }, `viewer ${JSON.stringify(viewer)}`);
  }
  /* The source's bundle hidden from bob: answered as a capture not held, nothing written. */
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, A);
  assert.deepEqual(await op(w, `capture=${s}&${FORGED}`, { viewer: V("bob"), identity: V("bob") }),
    { status: 200, body: { ok: true, projected: 0, edges: [] } });
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "files"]), before);
  w.st.sql.exec(`UPDATE bundles SET object_type='information' WHERE bundle_id=?`, A);
  /* The target hidden from bob: neither listed nor counted. */
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, B);
  const r = await op(w, `capture=${s}&${FORGED}`, { viewer: V("bob"), identity: V("bob") });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.projected, 0); assert.equal(r.body.skipped_unregistered, 0);
  assert.equal(JSON.stringify(r.body).includes(B), false);
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "files"]), before);
});

test("R27 (legacy-index map §4.4 move): end to end, a named bundle the stamped viewer cannot see answers exactly as one not held, and a project source asks the STAMPED identity's joining", async () => {
  const w = world();
  w.member("alice"); w.member("bob"); w.member("carl");
  const { s } = await linked(w);
  const p = w.project("Carol's work", "alice");
  await w.settle(); await w.settle();
  const before = w.snapshot(["refs", "asserted_connections", "files"]);
  const hidden = await op(w, `capture=${s}&bundle=${p}&${FORGED}`, { viewer: V("bob"), identity: V("bob") });
  const none = await op(w, `capture=${s}&bundle=INFO-2026-0404-z&${FORGED}`, { viewer: V("bob"), identity: V("bob") });
  assert.equal(hidden.body.ok, false); assert.equal(hidden.body.reason, "NO_SUCH_DOCUMENT");
  assert.deepEqual({ ...hidden, body: { ...hidden.body, target: 0 } }, { ...none, body: { ...none.body, target: 0 } });
  /* The query names alice (the project's owner); the stamp is carl, who has not joined. */
  const denied = await op(w, `capture=${s}&bundle=${p}&${FORGED}`, { viewer: V("alice"), identity: V("carl") });
  assert.equal(denied.body.ok, false); assert.equal(denied.body.reason, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "files"]), before, "nothing written by any refusal");
});

/* ------------------------------------------------------------------ converted from test/subresources.test.mjs */

test("R24, R25, R27 (converted, subresources.test \"a resolved link becomes an edge\"): through the op, an unregistered capture projects nothing and says why; a named, held source bundle whose targets no bundle registered projects nothing, counted and explained; projecting leaves capture's resolution as it was", async () => {
  const w = world();
  /* An unregistered capture (acquired, never promoted), linking to an address the record holds. */
  const loose = "7".repeat(64);
  const [t] = w.doc(B, ["target"]);
  await w.settle(); await w.settle();
  w.receipt("https://example.org/b", t);
  w.links(loose, null, ["https://example.org/b"]);
  const orphan = await op(w, `capture=${loose}`, { viewer: MACHINE });
  assert.equal(orphan.body.ok, true); assert.equal(orphan.body.projected, 0);
  assert.equal(orphan.body.note, localize("connections.note.capture_registered_record", "this capture is not registered to a record, so there is no canonical source to hang an edge on"));
  /* A held source whose two element-links resolve to bytes no bundle claims, one address the record does not hold. */
  const [s] = w.doc(A, ["source"]);
  await w.settle(); await w.settle();
  const unclaimed = "9".repeat(64);
  w.receipt("https://example.org/c", unclaimed, "2026-09-26T00:00:00Z");
  w.links(s, A, ["https://example.org/c#s1", "https://example.org/c#s2", "https://example.org/gone"]);
  const seenBefore = JSON.stringify(w.capture.resolveLinks({ sourceCapture: s, viewer: MACHINE }).links);
  const proj = await op(w, `capture=${s}&bundle=${A}`, { viewer: MACHINE, identity: V("alice") });
  assert.equal(proj.body.ok, true);
  assert.equal(proj.body.projected, 0);
  assert.ok(proj.body.skipped_unregistered >= 1, "counted, not a silent zero");
  assert.equal(proj.body.unresolved, 1);
  assert.equal(proj.body.note, localize("connections.index.only_resolved_links_project_and", "only resolved links project, and only to a target some record has registered. skipped_unregistered counts targets whose BYTES the record holds while no record claims them: those become edges when the target is promoted. Each edge is written into the source document's references as links_to and never cites, because the source asserted it and not the team; a member promoting it to cites is a member's act."));
  assert.equal(w.count("refs"), 0);
  assert.equal(JSON.stringify(w.capture.resolveLinks({ sourceCapture: s, viewer: MACHINE }).links), seenBefore,
    "resolution is still computed at read time, unchanged by projecting");
});

test("R24, R28 (C-6.1's links_to arm; converted, subresources.test \"a links_to edge missing asserted_by/the address/the verdict is refused\"): the references[] entry the projection writes is asserted by the source on its face, with the address and the verdict, so record-grammar's C-6.1 admits the source document", async () => {
  const w = world();
  const { s } = await linked(w);
  const r = w.k.projectLinks({ sourceCapture: s, viewer: MACHINE, identity: V("alice") });
  assert.equal(r.references_written, 1);
  const refs = parseFrontmatter(w.record.readFile(A, "bundle.md").text).data.references;
  const entry = refs.find((x) => x.rel === "links_to" && x.target === B);
  assert.ok(entry, "the edge is a references[] entry");
  assert.deepEqual({ asserted_by: entry.asserted_by, address: entry.address, verdict: entry.verdict },
    { asserted_by: "source", address: r.edges[0].address, verdict: r.edges[0].verdict },
    "R24: asserted by the source — stated on the entry, with the address the source wrote and its verdict");
  const files = new Map(w.record.livePaths(A).map((p) => [p, w.record.readFile(A, p).text]));
  /* record-grammar's `checkBundle` (R39): the links_to arm is its structural C-6.1, which runs with no grammar
     registered; no type grammar is passed, since none of their findings is asked about here. */
  const { findings } = await checkBundle({ folderName: A, files,
    sha256: async (v) => createHash("sha256").update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v)).digest("hex"),
    sha512: async (b) => new Uint8Array(await webcrypto.subtle.digest("SHA-512", b)), resolveTarget: () => true }, { grammars: [] });
  assert.deepEqual(findings.filter((f) => f.check === "C-6.1" && f.severity === "error").map((f) => f.message), []);
});
