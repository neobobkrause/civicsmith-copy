/* store-assembly's copy of plane's T50 test: T50's composition (T50-36; N1186, N1195, N933, N1171, N1084; K3630, K3637, K3643, K3731): R41 the 15 ops and the
   reach readers, R56 the ask stream passed through, R42 the translations route. (The Store's RPC `groupFields`, plane R62, and the parallel reads through the Worker,
   plane R63, stay with plane.) Each test drives the assembled store at its interface (the
   object's routes, its door and its RPC bodies) and carries a negative control (K874). */
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store, deployed, GATE_FLAGS, GATE_SET, disclosed } from "./fixture.mjs";
import { MODULE_MAPS, ownMaps } from "./maps.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { membershipOf, projectViewer } from "../../../src/membership/index.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { followingOf } from "../../../src/following/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { publicReadOf } from "../../../src/public-read/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { askOp, assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { projectReachReaders } from "../../../src/store-assembly/wiring.mjs";

const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

/* ===== R41: the 15 ops op-declarations R73 declares, each in its owner's map ===== */

/* each op with the module whose own map serves it (`op-declarations` R60's owners) */
const T50_OPS = [["watchitem", "following"], ["secondlook", "following"], ["secondlookclear", "following"],
  ["actionstake", "action-records"], ["actioninquiry", "action-records"], ["projectstakeset", "project-roster"],
  ["lookedat", "membership"], ["opencaptures", "capture"], ["projectstake", "project-roster"],
  ["projectownersgone", "project-roster"], ["browse", "retrieval"], ["capturegrade", "capture"],
  ["inquirypartition", "inquiry"], ["instances", "progressions"], ["stakeatpreparation", "filings"]];

test("R41 (T50; op-declarations R73; amends R6): each of the 15 new ops is in the route map, served by its owner's own map alone, and answers through the door what that owner's map answers called directly; control: a probe no map serves is in none", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  assert.equal(T50_OPS.length, 15);
  const keys = Object.keys(x.s.routes(u, null));
  const q = "viewer=member:nobody&by=member:nobody&author=member:nobody&projectId=PROJ-2026-none&project=PROJ-2026-none&target=ACTN-none&action=ACTN-none&id=INQ-none&captureSha=" + "0".repeat(64) + "&set=none&item=none";
  for (const [op, owner] of T50_OPS) {
    const serving = ownMaps(x.ctx, u, null, x.env).filter(([, m]) => Object.hasOwn(m, op)).map(([n]) => n);
    assert.deepEqual(serving, [owner], `${op} is served by ${owner}'s map alone`);
    assert.ok(keys.includes(op), `the route map lacks ${op}`);
    const res = await x.fetch(`/${op}?${q}`, { method: "POST", body: JSON.stringify({}) });
    const fn = MODULE_MAPS.find(([m]) => m === owner)[1];
    let direct;
    try { direct = await fn(twin.ctx, new URL(`http://do/${op}?${q}`), {}, twin.env)[op](); }
    catch (e) { direct = { threw: String(e) }; }
    assert.ok([200, 400, 404, 403, 409].includes(res.status), `${op}: status ${res.status}`);
    if (res.status === 200) assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct ?? null }))), op);
  }
  assert.equal(keys.includes("zzprobe50"), false);
  assert.equal(ownMaps(x.ctx, u, null, x.env).some(([, m]) => Object.hasOwn(m, "zzprobe50")), false);
});

/* ===== R41: following's registration with retrieval ===== */

test("R41 (T50; following R34; retrieval R86): following is built with the plane's one retrieval and registers its watch marks with it before the first request, once; a second registration is refused naming following", async () => {
  const x = await store();
  const f = followingOf(x.ctx);
  assert.equal(f.marksRegistered.ok, true, JSON.stringify(f.marksRegistered));
  assert.equal(f.retrieval, retrievalOf(x.ctx), "following reads the plane's one retrieval instance");
  const second = retrievalOf(x.ctx).registerBrowseMarks("probe", () => ({ items: [] }));
  assert.equal(second.ok, false);
  assert.match(JSON.stringify(second), /following/, "the slot is following's");
  /* control: a plane's second registration of the same slot by following itself is also refused */
  assert.equal(retrievalOf(x.ctx).registerBrowseMarks("following", () => ({ items: [] })).ok, false);
});

/* ===== R41: the readers of a project's reach ===== */

const projMd = (title, refs = []) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
  "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, `objective: "Find out."`,
  refs.length ? "references:\n" + refs.map((r) => `  - target: ${r.target}\n    rel: ${r.rel}${r.status ? `\n    status: ${r.status}` : ""}`).join("\n") : "references: []",
  "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");

/* alice owns projects A and B; A's document cites CITED (rel cites), SEV (cites, severed) and OTHER (links_to); B's cites
   B-CITED. REC-A belongs to A and REC-B to B; LOOSE belongs to none; each holds a capture of its own. */
async function reachWorld() {
  const x = await store();
  instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "oak-watch", author: "admin" });
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('alice', 'Cover alice', 'h_alice', 'member', 'active', '["contribute"]', 't', 't')`);
  const bundle = (id, project = null) => sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, project)
    VALUES (?, 'information', 'g', ?, 'forming', 't', 't', 'sha', ?)`, id, `record ${id}`, project);
  const promote = (title, refs) => {
    const r = promotionOf(x.ctx).promote({ base: null, snapKey: `k-${title}`, author: "member:alice", ownerMemberId: "alice",
      files: [{ path: "bundle.md", text: projMd(title, refs) }], meta: { object_type: "project" } });
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.bundleId;
  };
  const A = promote("Project A", [{ target: "CITED", rel: "cites" }, { target: "SEV", rel: "cites", status: "severed" }, { target: "OTHER", rel: "links_to" }]);
  const B = promote("Project B", [{ target: "B-CITED", rel: "cites" }]);
  for (const id of ["CITED", "SEV", "OTHER", "B-CITED", "LOOSE", "LOOSE2", "HELD"]) bundle(id);
  bundle("REC-A", A); bundle("REC-B", B);
  const cap = (n, home) => sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, 'doc.txt', 'utf8', 1, '2026-09-27T00:00:00Z')`,
    createHash("sha256").update(n).digest("hex"), home);
  cap("a", "REC-A"); cap("b", "REC-B"); cap("l", "HELD"); cap("m", "LOOSE2");
  /* K3771: REC-A holds a file whose digest is the capture homed in HELD; REC-B one whose digest is homed in LOOSE; a file
     whose digest no register row names adds nothing */
  const file = (b, p, n) => sql.exec(`INSERT INTO files (bundle_id, path, content, bytes, sha256) VALUES (?, ?, 'x', 1, ?)`, b, p, n);
  file("REC-A", "held.txt", createHash("sha256").update("l").digest("hex")); file("REC-A", "none.txt", "f".repeat(64));
  file("REC-B", "b.txt", createHash("sha256").update("m").digest("hex"));
  const m = membershipOf(x.ctx);
  for (const id of [A, B, "CITED", "SEV", "OTHER", "B-CITED", "LOOSE", "REC-A", "REC-B"]) m.reindexProjectSight?.(id);
  return { ...x, A, B, m, sha: (n) => createHash("sha256").update(n).digest("hex") };
}

test("R41 (T50; membership R150): the plane registers, once each, the provenance and connections readers: a viewer carrying project A reaches A's own records and captures' homes and the records A's document cites, never project B's, never another record; control: a second registration of either reader is refused LISTENER_DECLARED", async () => {
  const w = await reachWorld();
  const reach = w.m.projectReach(w.A);
  assert.ok(reach.includes("REC-A"), "the home of a capture A's own bundle holds");
  assert.ok(reach.includes("HELD"), "the home of a capture whose digest A's bundle holds as a file (K3771)");
  assert.ok(reach.includes("CITED"), "a record A's document cites");
  for (const id of ["SEV", "OTHER", "B-CITED", "REC-B", "LOOSE", "LOOSE2"]) assert.equal(reach.includes(id), false, `${id} is not in A's reach`);
  const pv = projectViewer("member:alice", w.A);
  for (const id of ["REC-A", "CITED", "HELD"]) assert.equal(w.m.inSight(id, pv), true, `${id} is reached`);
  for (const id of ["SEV", "OTHER", "B-CITED", "REC-B", "LOOSE", "LOOSE2"]) assert.equal(w.m.inSight(id, pv), false, `${id} is not reached`);
  assert.equal(w.m.inSight("REC-B", "member:alice"), true, "control: alice's own viewer sees B's record");
  /* project B's reach is its own */
  const rb = w.m.projectReach(w.B);
  assert.ok(rb.includes("B-CITED") && rb.includes("REC-B") && rb.includes("LOOSE2"));
  assert.equal(rb.includes("HELD"), false);
  assert.equal(rb.includes("CITED"), false);
  /* a second registration of either reader is refused naming its slot */
  for (const module of ["provenance", "connections"]) {
    const again = w.m.registerProjectReach(module, () => ["LOOSE"]);
    assert.deepEqual([again.ok, again.reason, again.module], [false, "LISTENER_DECLARED", module]);
  }
  assert.equal(w.m.inSight("LOOSE", pv), false, "the refused registration widened nothing");
});

test("R41 (T50; membership R150): each reader answers a list of bundle ids and nothing else; a project with none, or a bad project, adds nothing; a reader whose instance throws adds nothing, so the reach narrows, never widens", async () => {
  const w = await reachWorld();
  const { recordOf } = await import("../../../src/record-core/index.mjs");
  const { connectionsOf } = await import("../../../src/connections/index.mjs");
  const live = projectReachReaders({ record: () => recordOf(w.ctx), provenance: () => provenanceOf(w.ctx), connections: () => connectionsOf(w.ctx), sql: () => w.ctx.storage.sql });
  for (const [name, fn] of Object.entries(live)) {
    const got = fn({ project: w.A });
    assert.ok(Array.isArray(got) && got.every((id) => typeof id === "string" && id !== ""), `${name} answers bundle ids`);
    for (const bad of [{}, { project: "" }, { project: null }, { project: 7 }, undefined]) assert.deepEqual(fn(bad), [], `${name}(${JSON.stringify(bad)})`);
    assert.deepEqual(fn({ project: "PROJ-2026-none" }).filter((id) => id !== "PROJ-2026-none"), [], `${name}: a project nothing holds adds nothing`);
  }
  assert.deepEqual(live.connections({ project: w.A }), ["CITED"], "only the cites edge not severed");
  assert.deepEqual(live.provenance({ project: w.A }).sort(), ["HELD", "REC-A"]);
  /* control: a reader whose instance throws adds nothing (membership R150 catches it), and the other reader's ids stand */
  const broken = projectReachReaders({ record: () => { throw new Error("down"); }, provenance: () => { throw new Error("down"); }, connections: () => { throw new Error("down"); } });
  for (const fn of Object.values(broken)) assert.throws(() => fn({ project: w.A }));
  const prov = provenanceOf(w.ctx), was = prov.capturesOf.bind(prov);
  prov.capturesOf = () => { throw new Error("down"); };
  try {
    const reach = w.m.projectReach(w.A);
    assert.deepEqual(reach, ["CITED"], "provenance's reader adds nothing, connections' stands; the reach narrows, never widens");
  } finally { prov.capturesOf = was; }
  assert.ok(w.m.projectReach(w.A).includes("REC-A"), "restored");
});

/* ===== R56: the ask stream passes through as written ===== */

const SESSION = "a1".repeat(32);
const LINE1 = '{"event":"step","step":"interpreting"}\n';
const LINE2 = '{"event":"answer","ok":true}\n';

/* A plane whose agent-worker writes its first line, waits `wait` ms, then writes its second; ann holds a session and an account. */
async function askWorld({ wait = 2000 } = {}) {
  const sent = [];
  const env = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-test-only",
    AGENT_WORKER: { fetch: async (u, init) => {
      /* only `/ask` streams; any other call (the sign-in door's) is answered a plain JSON refusal */
      if (!String(u).endsWith("/ask")) return new Response('{"ok":false,"reason":"NOT_SIGNED_IN"}', { status: 200, headers: { "content-type": "application/json" } });
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(ctl) { ctl.enqueue(enc.encode(LINE1)); sent.push(["first", performance.now()]);
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          ctl.enqueue(enc.encode(LINE2)); sent.push(["second", performance.now()]); ctl.close(); } });
      return new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson" } }); } } };
  const x = await store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });
  await deployed(x.ctx);
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated) VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated) VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);
  const r = await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" });
  assert.equal(r.ok, true, JSON.stringify(r));
  /* the door's arm asks the `bio` object over its RPC: here, this object. A Durable Object stub's `fetch` takes an address as
     well as a Request (the host does), as `groupIdentityOp` and `instanceGroupOp` ask it; the world answers the same. */
  x.env.STORE.get = () => new Proxy(x.s, { get: (t, k) => (k === "fetch" ? (r, init) => t.fetch(r instanceof Request ? r : new Request(r, init))
                                                                     : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  return { ...x, sent };
}

/* the first chunk the reader gets, and when */
async function firstChunk(res) {
  const reader = res.body.getReader();
  const t0 = performance.now();
  const { value } = await reader.read();
  return { text: new TextDecoder().decode(value), at: performance.now() - t0, reader };
}

test("R56 (T50; N1195; agent-worker R113; amends plane R6, R114): a producer that writes its first line then waits 2 s delivers that line to the reader before the wait ends, through the Store's RPC and through the door's arm; the whole stream arrives unchanged; control: a short answer arrives whole and unchanged", async () => {
  /* through the Store's RPC (`ask`) */
  const x = await askWorld({ wait: 2000 });
  const res = await x.s.ask({ member: "member:ann", session: SESSION, question: "Who holds the clerk's office?", conversation: [], store: null });
  assert.equal(res.status, 200);
  const first = await firstChunk(res);
  assert.equal(first.text, LINE1, "the first line, before the producer's second write");
  assert.ok(first.at < 1000, `the first line reached the reader at ${Math.round(first.at)} ms, before the 2 s wait ended`);
  assert.equal(x.sent.filter(([k]) => k === "second").length, 0, "the producer had not yet written its second line when the first was read");
  let rest = "";
  for (;;) { const { value, done } = await first.reader.read(); if (done) break; rest += new TextDecoder().decode(value); }
  assert.equal(first.text + rest, LINE1 + LINE2, "the stream is whole and as written");
  /* through the door's arm (`askOp`, the Worker's), over the same RPC */
  const y = await askWorld({ wait: 2000 });
  const req = new Request("http://door/api/?op=ask", { method: "POST", headers: { authorization: `Bearer ${SESSION}`, "content-type": "application/json" },
    body: JSON.stringify({ question: "q" }) });
  const door = await askOp({ req, url: new URL(req.url), env: y.env, viaSession: true, sessMember: "member:ann", grantMember: null });
  assert.equal(door.status, 200);
  const dfirst = await firstChunk(door);
  assert.equal(dfirst.text, LINE1);
  assert.ok(dfirst.at < 1000, `through the door: the first line at ${Math.round(dfirst.at)} ms`);
  let drest = "";
  for (;;) { const { value, done } = await dfirst.reader.read(); if (done) break; drest += new TextDecoder().decode(value); }
  assert.equal(dfirst.text + drest, LINE1 + LINE2);
  /* control: a short answer (no wait) arrives whole and unchanged */
  const z = await askWorld({ wait: 0 });
  const short = await z.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.equal(await short.text(), LINE1 + LINE2);
  assert.equal(short.headers.get("content-type"), "application/x-ndjson");
});

/* ===== R42: the plane composes translations ===== */

/* K3268 (T51): translations' routes are read from its own map (`translationsOps`), never listed here */

test("R42 (T50; N1084; translations R12; amends R2, R6): the plane builds translations on the object's storage, one instance, migrated once; its nine routes reach its handlers from its own map, each key once, and answer through the door what that map answers; control: instance-setup's copy of them is not the one that answers", async () => {
  const { translationsOf, translationsOps } = await import("../../../src/translations/index.mjs");
  const x = await store(), twin = await store();
  const u = new URL("http://do/");
  assert.equal(translationsOf(x.ctx), translationsOf(x.ctx), "one instance per storage");
  const NINE = Object.keys(translationsOps(translationsOf(x.ctx), u, null));
  assert.equal(NINE.length, 9, "the nine routes");
  const keys = Object.keys(x.s.routes(u, null));
  for (const op of NINE) assert.equal(keys.filter((k) => k === op).length, 1, `${op} once`);
  /* each is translations' handler: replaced on the instance, the route map reaches the replacement */
  const m = translationsOf(x.ctx), seen = [];
  const was = m.translations.bind(m);
  m.translations = (a) => { seen.push(a); return was(a); };
  try { await x.call("/translations?language=es&viewer=member:nobody"); } finally { m.translations = was; }
  assert.equal(seen.length, 1, "op=translations is translations' own handler");
  /* through the door, as translations' own map answers it called directly */
  for (const op of ["translations", "interfacewords"]) {
    const q = `${op}?language=es&viewer=member:nobody`;
    const res = await x.fetch(`/${q}`, { method: "POST", body: "{}" });
    const direct = await translationsOps(translationsOf(twin.ctx), new URL(`http://do/${q}`), {})[op]();
    assert.equal(res.status, 200, op);
    assert.deepEqual(JSON.parse(mask(await res.text())), JSON.parse(mask(JSON.stringify({ ok: true, result: direct }))), op);
  }
  /* the tables: made once, and a second migration changes nothing */
  const tables = () => [...x.ctx.storage.sql.exec(`SELECT name, sql FROM sqlite_master ORDER BY name`)].map((r) => [r.name, r.sql]);
  const before = tables();
  translationsOf(x.ctx).migrate();
  assert.deepEqual(tables(), before, "migrate() twice changes nothing");
  const { TRANSLATION_TABLES } = await import("../../../src/translations/index.mjs");
  for (const t of TRANSLATION_TABLES) assert.ok(before.some(([n]) => n === t), `table ${t}`);
  /* control: a probe is no route */
  assert.equal(keys.includes("zztranslation"), false);
});
