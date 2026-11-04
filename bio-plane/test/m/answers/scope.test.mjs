/* The asking scope (R1, R2), at the interface: the one closed list of plane reads an ask may make, held equal to
   credentials' grant class both ways, each op named as the plane routes it (K1505 (14); N580, K1603, K1609), and every
   read made under a grant
   answered with a member's ties, the source-to-person link and a hidden project's rows removed and uncounted. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, V } from "./fixture.mjs";
import { ASK_SCOPE, askAdmits, scrubRead } from "../../../src/answers/index.mjs";
import { AI_GRANT_OPS } from "../../../src/credentials/index.mjs";

test("R1 ASK_SCOPE is one closed list, each entry naming its op, its owner and the ruling that admitted it; askAdmits answers it, pure", () => {
  assert.ok(Object.isFrozen(ASK_SCOPE));
  const ops = ASK_SCOPE.map((e) => e.op);
  assert.deepEqual(ops, [...ops].sort());
  assert.equal(new Set(ops).size, ops.length);
  for (const e of ASK_SCOPE) {
    assert.ok(Object.isFrozen(e));
    assert.match(e.owner, /^[a-z][a-z-]*$/);
    assert.match(e.ruling, /^(K\d+|C:B-\d+|D\d+|DEC-\d+)$/);
    assert.equal(askAdmits(e.op), true);
  }
  /* the reads K1450, K1470 and C:B-3 name, R12's door among them, assembled from the scope's own declaration */
  const named = ASK_SCOPE.filter((e) => ["K1450", "K1470", "C:B-3"].includes(e.ruling)).map((e) => e.op);
  assert.ok(named.includes("rule"));
  for (const op of named) assert.equal(askAdmits(op), true, op);
  assert.equal(ASK_SCOPE.length, 27);
  /* the names the plane does not route (K1609) are not the list's */
  for (const op of ["careerof", "occurrences", "lines", "duties", "calculations", "moneyfacts"]) assert.equal(askAdmits(op), false, op);
  /* no sources op, no member history, no administrative op, no export, no write */
  for (const op of ["sources", "sourceread", "sourcepersonlink", "membertie", "memberties", "members", "memberlist", "airuns",
                    "stats", "purge", "audit", "export", "corpusexport", "promote", "standarddeclare", "entitycreate",
                    "calculationcreate", "asktallies", "aiusage", "standingset", "", null, undefined, 7, {}])
    assert.equal(askAdmits(op), false, String(op));
  assert.equal(ASK_SCOPE.some((e) => /^sources?/.test(e.op) || /export|admin|purge|stats/.test(e.op)), false);
});

/* (BOB, 4 Nov) the one op on AI_GRANT_OPS an ask never makes: the agent Worker's own credential read (ai-accounts R65) */
const WORKER_ONLY = ["aicredential"];

test("R1 the copy test: ASK_SCOPE equals credentials' AI_GRANT_OPS minus aicredential, both ways, `rule` included (N580; K1603, K1609; BOB, 4 Nov)", () => {
  const scope = ASK_SCOPE.map((e) => e.op);
  assert.deepEqual(scope, AI_GRANT_OPS.filter((op) => !WORKER_ONLY.includes(op)).sort());
  for (const op of AI_GRANT_OPS) assert.equal(askAdmits(op), !WORKER_ONLY.includes(op), op);
  for (const op of scope) assert.ok(AI_GRANT_OPS.includes(op), op);
  assert.ok(AI_GRANT_OPS.includes("rule"));
  /* the difference is exactly that op: it is on the grant's list and never in the ask's, so its answer (a secret) is never
     written into a grant's read log (ai-accounts R64, R65) */
  assert.deepEqual(AI_GRANT_OPS.filter((op) => !scope.includes(op)), WORKER_ONLY);
  assert.equal(askAdmits("aicredential"), false);
});

test("R2 a read under a grant never answers, names or counts a member's tie, the source-to-person link, or a hidden project's row", async () => {
  const w = answersWorld();
  const BOB = V("bob");
  const proj = w.project("Carol's private work", "carol");
  const hidden = w.document("a private note", { project: proj });
  const open = w.document("a public minute");
  const tie = w.people.declareTie({ entity: w.entity("Harbour Supply", "institution"), kind: "employer", note: "I worked there",
                                    attribution: "group", by: V("bob") });
  assert.equal(tie.ok, true, JSON.stringify(tie));
  const answer = {
    ok: true, total: 5, count: 5,
    hits: [
      { bundle_id: open.bundleId, title: "public" },
      { bundle_id: hidden.bundleId, title: "private" },
      { bundle_id: proj, title: "the project itself" },
      { tie_id: tie.tie_id, entity: "ENT-2026-0001", kind: "employer" },
      { source: "SRC-2026-0001abcdefgh", person: "ENT-2026-0002", evidence: "the clerk said so", sight: ["bob"] },
    ],
    ids: [open.bundleId, hidden.bundleId, tie.tie_id],
  };
  const got = w.a.logRead({ grant: "g-bob", op: "search", args: { q: "note" }, answer, viewer: BOB });
  assert.deepEqual(got.hits, [{ bundle_id: open.bundleId, title: "public" }]);
  assert.deepEqual(got.ids, [open.bundleId]);
  assert.equal(got.total, 1); assert.equal(got.count, 1);
  /* what the log recorded is what was answered: nothing hidden is in it */
  const log = w.a.readLog("g-bob");
  assert.equal(log.answered(hidden.bundleId), false);
  assert.equal(log.answered(tie.tie_id), false);
  assert.equal(log.answered("SRC-2026-0001abcdefgh"), false);
  assert.equal(log.answered(open.bundleId), true);
  /* the project's own participant sees its rows */
  const carol = w.a.logRead({ grant: "g-carol", op: "search", args: {}, answer, viewer: V("carol") });
  assert.deepEqual(carol.hits.map((h) => h.bundle_id).filter(Boolean), [open.bundleId, hidden.bundleId, proj]);
  /* a read about a hidden thing answers as for nothing held */
  assert.deepEqual(w.a.logRead({ grant: "g-bob", op: "standard", args: {}, answer: { ok: true, id: hidden.bundleId, title: "x" }, viewer: BOB }),
                   { ok: true, found: false });
  /* a read outside the scope, or naming no grant or viewer, is refused and recorded nowhere */
  assert.equal(w.a.logRead({ grant: "g-bob", op: "membertie", answer: {}, viewer: BOB }).reason, "GRANT_OP_REFUSED");
  assert.equal(w.a.logRead({ grant: null, op: "search", answer: {}, viewer: BOB }).reason, "GRANT_OP_REFUSED");
  assert.equal(w.a.logRead({ grant: "g-bob", op: "search", answer: {}, viewer: V("carol") }).reason, "GRANT_OP_REFUSED");
  /* pure over its predicate; never throws */
  assert.deepEqual(scrubRead({ rows: ["MTI-2026-0001", "x"], n: 2 }), { rows: ["x"], n: 1 });
  assert.doesNotThrow(() => scrubRead(null)); assert.doesNotThrow(() => scrubRead({ a: 1 }, () => { throw new Error("x"); }));
});
