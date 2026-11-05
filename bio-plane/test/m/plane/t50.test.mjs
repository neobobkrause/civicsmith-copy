/* plane R62, R63 (T50-36; N933; K3664, K3731): the Store's RPC `groupFields` takes a project (R62), and a burst of the
   widest screen's own reads answers every one with no 503 (R63). Each drives the plane at its interface (the object's RPC and
   door) and carries a negative control (K874). The composition tests of T50 are `store-assembly`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store, deployed, GATE_FLAGS, GATE_SET, disclosed, withCatalogue } from "./fixture.mjs";

import { promotionOf } from "../../../src/promotion/index.mjs";

import { publicReadOf } from "../../../src/public-read/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { assistantGateOf } from "../../../src/store-assembly/ask.mjs";

/* ===== R58: the readers of a project's reach ===== */

const projMd = (title, refs = []) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
  "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, `objective: "Find out."`,
  refs.length ? "references:\n" + refs.map((r) => `  - target: ${r.target}\n    rel: ${r.rel}${r.status ? `\n    status: ${r.status}` : ""}`).join("\n") : "references: []",
  "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");

/* alice owns projects A and B; A's document cites CITED (rel cites), SEV (cites, severed) and OTHER (links_to); B's cites
   B-CITED. REC-A belongs to A and REC-B to B; LOOSE belongs to none; each holds a capture of its own. */

/* ===== R59: the ask stream passes through as written ===== */

const SESSION = "a1".repeat(32);
const TOKEN = SESSION;
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
  await withCatalogue(x.ctx);   /* T53 (BOB, MSG bob-82 (2)): ai-accounts reads ai-catalogue's published fixture, as the assembled store composes it */
  const r = await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann", by: "member:ann" });
  assert.equal(r.ok, true, JSON.stringify(r));
  /* the door's arm asks the `bio` object over its RPC: here, this object. A Durable Object stub's `fetch` takes an address as
     well as a Request (the host does), as `groupIdentityOp` and `instanceGroupOp` ask it; the world answers the same. */
  x.env.STORE.get = () => new Proxy(x.s, { get: (t, k) => (k === "fetch" ? (r, init) => t.fetch(r instanceof Request ? r : new Request(r, init))
                                                                     : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  return { ...x, sent };
}

/* ===== R62: the Store's RPC `groupFields` takes a project ===== */

test("R62 (T50; N933; control-plane R102; public-read R36; amends R114): the Store's RPC groupFields({project}) answers public-read's groupFields of the object for that project, its `matter_stake` among its keys; with none it answers `matter_stake: null`; control: a project whose latest stake is cleared answers null, a name that is no project answers null", async () => {
  const x = await store();
  instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "oak-watch", author: "admin" });
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('alice', 'Cover alice', 'h_alice', 'member', 'active', '["contribute"]', 't', 't')`);
  const p = promotionOf(x.ctx).promote({ base: null, snapKey: "k-r62", author: "member:alice", ownerMemberId: "alice",
    files: [{ path: "bundle.md", text: projMd("Budget watch") }], meta: { object_type: "project" } });
  assert.equal(p.ok, true, JSON.stringify(p));
  const P = p.bundleId;
  const KEYS = ["detail", "domain", "domain_verified_at", "group", "matter_stake", "name", "stake"];
  /* none: as before, and `matter_stake` null */
  const none = await x.s.groupFields();
  assert.deepEqual(Object.keys(none).sort(), KEYS);
  assert.equal(none.matter_stake, null);
  assert.deepEqual(none, publicReadOf(x.ctx).groupFields());
  assert.deepEqual(await x.s.groupFields({}), none);
  assert.deepEqual(await x.s.groupFields({ project: "" }), none, "an empty project is none");
  assert.deepEqual(await x.s.groupFields({ project: 7 }), none, "a project that is no string is none");
  /* a project with no stake set answers null, as one set and cleared does */
  assert.equal((await x.s.groupFields({ project: P })).matter_stake, null);
  const set = projectRosterOf(x.ctx).projectStakeSet({ projectId: P, stake: "We live next to the plant.", by: "alice", viewer: "member:alice" });
  assert.equal(set.ok, true, JSON.stringify(set));
  const withProject = await x.s.groupFields({ project: P });
  assert.deepEqual(Object.keys(withProject).sort(), KEYS);
  assert.deepEqual(withProject, publicReadOf(x.ctx).groupFields({ project: P }), "public-read's own answer for the project");
  assert.deepEqual([withProject.matter_stake.stake, withProject.matter_stake.source], ["We live next to the plant.", "project"]);
  assert.equal(withProject.stake, none.stake, "the team-wide stake is not replaced");
  /* control: cleared, null; an id that names no project, null */
  assert.equal(projectRosterOf(x.ctx).projectStakeSet({ projectId: P, stake: null, by: "alice", viewer: "member:alice" }).ok, true);
  assert.equal((await x.s.groupFields({ project: P })).matter_stake, null);
  assert.equal((await x.s.groupFields({ project: "PROJ-2026-none" })).matter_stake, null);
  /* a spy shows the RPC is public-read's answer for the project, not a copy */
  const pr = publicReadOf(x.ctx), was = pr.groupFields.bind(pr), seen = [];
  pr.groupFields = (a) => { seen.push(a); return was(a); };
  try { await x.s.groupFields({ project: P }); await x.s.groupFields(); } finally { pr.groupFields = was; }
  assert.deepEqual(seen, [{ project: P }, {}], "the project is passed on; none passes none");
});

/* ===== R63: parallel reads answer, none a 503 (V3 B-24; M-T50-7) ===== */

/* The widest screen's reads: each screen's `reads` function names the ops it reads (`cs.call`); the ops it names that
   `OPS` declares, counted per screen over the nine screen modules. */
async function widestScreen() {
  const { OPS } = await import("../../../src/op-declarations/index.mjs");
  let best = { n: 0, id: null, ops: [] };
  for (const m of ["screens-entry", "screens-settings", "screens-intake", "screens-daily", "screens-inquiry", "screens-wizards",
                   "screens-investigate", "screens-publish", "screens-action"]) {
    const { SCREENS } = await import(`../../../src/${m}/index.mjs`);
    for (const s of SCREENS) {
      const set = new Set();
      for (const hit of (typeof s.reads === "function" ? String(s.reads) : "").matchAll(/["'`]([a-z]{3,40})["'`]/g)) if (Object.hasOwn(OPS, hit[1])) set.add(hit[1]);
      if (set.size > best.n) best = { n: set.size, id: `${m}:${s.id}`, ops: [...set] };
    }
  }
  return best;
}

test("R63 (T50; V3 B-24; M-T50-7; K3664; admission R27; amends R5): a burst of the widest screen's own reads, plus four, sent at once through the assembled plane by a signed-in member, is every one answered, none a 503 and none a silence; control: a read a gate refuses is answered its own refusal at every count, not a 503", async () => {
  const x = await askWorld({ wait: 0 });
  const worker = (await import("../../../src/plane/index.mjs")).default;
  const widest = await widestScreen();
  assert.ok(widest.n >= 10, `the widest screen reads ${widest.n} ops (${widest.id})`);
  const call = (op) => worker.fetch(new Request(`https://bio.example.workers.dev/api/?op=${op}`, { headers: { authorization: `Bearer ${TOKEN}` } }), x.env, { waitUntil() {} })
    .then(async (r) => { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ } return { op, status: r.status, code: j && (j.code || j.reason) || (j && j.ok === true ? "ok" : null), json: j !== null, inner: j && j.result && typeof j.result === "object" ? j.result : null }; });
  const measured = [];
  for (const n of [1, 2, 4, 8, 16, widest.n + 4]) {
    const ops = Array.from({ length: n }, (_, i) => widest.ops[i % widest.ops.length]);
    const t0 = performance.now();
    const out = await Promise.all(ops.map(call));
    const tally = {};
    for (const o of out) tally[o.status] = (tally[o.status] || 0) + 1;
    measured.push(`${n}: ${JSON.stringify(tally)} in ${Math.round(performance.now() - t0)} ms`);
    for (const o of out) {
      assert.notEqual(o.status, 503, `${o.op} at ${n} in flight answered 503`);
      assert.ok(o.status < 500, `${o.op} at ${n} in flight answered ${o.status} (${o.code})`);
      assert.equal(o.json, true, `${o.op} at ${n} in flight answered JSON`);
    }
  }
  console.log(`M-T50-7 after (assembled plane, ${widest.id}'s ${widest.n} reads, in flight: ${measured.join("; ")}); before, on biosmoke8 (public reads only, J1): none up to 16, cold or warm`);
  /* control: a read a gate refuses is answered its own refusal at every count */
  for (const n of [1, 8, widest.n + 4]) {
    const out = await Promise.all(Array.from({ length: n }, () => call("securitymap")));
    for (const o of out) assert.deepEqual([o.status, o.inner && o.inner.ok, o.inner && o.inner.code], [200, false, "NOT_AN_ADMIN"], `securitymap at ${n}: its own refusal, in the store's envelope`);
  }
});

/* ===== R61: the plane composes translations ===== */

/* K3268 (T51): translations' routes are read from its own map (`translationsOps`), never listed here */

