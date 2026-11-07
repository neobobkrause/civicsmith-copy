/* question-explorer: the acts an exploring run's work goes through (R3's sight and capture door, R8, R9, R10, R12's
   actual cost, R13). Each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, capOf, Q, Q2, DOC, DOC2, HDOC, PROJ, HPROJ, ENT, PERSON, PERSON2, CAP, CAP2, HCAP, CALLER } from "./fixture.mjs";
import { EXPLORE_PERSON_CAP, EXPLORE_CHECKS } from "../../../src/question-explorer/index.mjs";
import { KEPT_AWAY_UNREADABLE } from "../../../src/ai-accounts/index.mjs";

test("R3: it reads within its principal's sight: the group's, what every member may see; a project's, its participants'", async () => {
  const w = await world().standard();
  w.project(HPROJ, ["bob"]);
  w.doc(HDOC, HCAP, { project: HPROJ });
  const g = await w.openRun("group");
  assert.equal(w.p.find({ run: g.run, kind: "capture", ref: CAP, bearing: "unclear", how: "a mention", caller: CALLER }).ok, true);
  const hidden = w.p.find({ run: g.run, kind: "capture", ref: HCAP, bearing: "unclear", how: "a mention", caller: CALLER });
  assert.equal(hidden.code, "EXPLORE_FIND_UNKNOWN", "a project's document is not what every member may see");
  /* A project's account sees what its participants see. */
  const w2 = await world().standard();
  w2.project(HPROJ, ["bob"], { owners: ["bob"] });
  w2.doc(HDOC, HCAP, { project: HPROJ });
  w2.draw(Q, HPROJ);
  await w2.setExplore("group", "no");
  const p = await w2.openRun(`project:${HPROJ}`);
  assert.equal(w2.p.find({ run: p.run, kind: "capture", ref: HCAP, bearing: "unclear", how: "a mention", caller: CALLER }).ok, true);
  /* A member's own account explores nothing yet (ai-use R6, D36), so its sight (hers) is reached by no run here. */
});

test("R3: it asks to capture only through capture-requests, each request carrying the step; an address the record does not hold is named to the members R5 reaches, who capture it", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  w.hold("https://example.org/held");
  const ok = w.p.capture({ run: o.run, address: "https://example.org/held", caller: CALLER });
  assert.equal(ok.ok, true);
  /* The real capture-requests holds the request, carrying the run, the question and the step (its R55). */
  const rows = w.rows(`SELECT run, target, step, address FROM capture_requests`);
  assert.deepEqual(rows.map((r) => [r.run, r.target, r.step, r.address]), [[o.run, Q, o.step, "https://example.org/held"]]);
  assert.equal(w.count("explore_finds"), 0, "a held address is asked, not named");
  /* Negative control: an address the record does not hold is refused there and named to the members here. */
  const not = w.p.capture({ run: o.run, address: "https://elsewhere.example/page", caller: CALLER });
  assert.equal(not.code, "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  assert.equal(not.named_to_members, true);
  const items = w.p.findsFor({ viewer: "member:alice" }).finds;
  assert.deepEqual(items.map((f) => [f.kind, f.ref]), [["page", "https://elsewhere.example/page"]]);
  assert.equal(w.p.findsFor({ viewer: "member:bob" }).finds.length, 0, "only to the members R5 reaches");
  /* Not a run the caller holds: refused, nothing asked. */
  assert.equal(w.p.capture({ run: o.run, address: "https://example.org/held", caller: "member:alice" }).code, "EXPLORE_NO_RUN");
  assert.equal(w.count("capture_requests"), 1, "the refused and the unheld asked nothing");
});

test("R8: a run stopped by a limit ends its step set_aside with the reason; only its enabling owner is told; no place is named", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  const e = await w.p.end({ run: o.run, end: "set_aside", reason: "fetches", bound: "fetches", caller: CALLER });
  assert.deepEqual([e.ok, e.end, e.reason], [true, "set_aside", "fetches"]);
  assert.deepEqual(w.calledAs("stepEnd").map((a) => [a.step, a.end, a.reason]), [[o.step, "set_aside", "fetches"]]);
  assert.equal(w.calledAs("close")[0].bound, "fetches");
  const told = w.p.stopsFor({ viewer: "member:dana" }).stops;
  assert.deepEqual(told.map((s) => [s.key, s.reason]), [[`explore-stopped:${o.run}`, "fetches"]]);
  assert.equal(w.p.stopsFor({ viewer: "member:alice" }).stops.length, 0, "negative control: not the enabling owner");
  for (const s of [...told.map((x) => x.says), ...Object.values(EXPLORE_CHECKS).map((r) => r.translation)])
    assert.doesNotMatch(s, /\b(Oakland|California|county|city of|jurisdiction)\b/i, "no place named");
  /* An ended run answers as it ended; acts under it are refused. */
  assert.equal((await w.p.end({ run: o.run, caller: CALLER })).already, true);
  assert.equal(w.p.find({ run: o.run, kind: "capture", ref: CAP, bearing: "unclear", how: "x", caller: CALLER }).code, "EXPLORE_RUN_ENDED");
  /* A normal end: ended, every outcome undetermined (none recorded by the machine). */
  const w2 = await world().standard();
  const o2 = await w2.openRun("group");
  await w2.p.end({ run: o2.run, caller: CALLER });
  const [se] = w2.calledAs("stepEnd");
  assert.deepEqual([se.end, se.outcomes, se.reason], ["ended", undefined, undefined]);
  assert.equal(w2.p.stopsFor({ viewer: "member:dana" }).stops.length, 0, "an ended run is no stop");
});

test("R9: a look aimed at a person no member tied to the question is refused EXPLORE_PERSON_NOT_TIED, recorded on the run, and the run goes on; a tied person is looked at", async () => {
  const w = await world().standard();
  w.entity(PERSON, "person");
  w.entity(PERSON2, "person");
  w.entity(ENT, "body");
  w.question(Q, { subject: PERSON, surfacedBy: "human", recipients: ["alice"] });
  const o = await w.openRun("group");
  assert.deepEqual((await w.p.look({ run: o.run, entity: PERSON, aim: "search the minutes", caller: CALLER })).person, true, "the subject a member raised");
  const no = await w.p.look({ run: o.run, entity: PERSON2, aim: "search a name", caller: CALLER });
  assert.deepEqual([no.ok, no.code, no.goes_on], [false, "EXPLORE_PERSON_NOT_TIED", true]);
  assert.deepEqual(w.p.refusalsOn(o.run).map((r) => [r.code, r.entity]), [["EXPLORE_PERSON_NOT_TIED", PERSON2]]);
  assert.equal((await w.p.look({ run: o.run, entity: ENT, caller: CALLER })).ok, true, "not a person: no tie needed");
  assert.equal(w.p.find({ run: o.run, kind: "capture", ref: CAP, bearing: "unclear", how: "x", caller: CALLER }).ok, true, "the run goes on");
  /* A member ties PERSON2 by connecting the question to a document resolving to that person (connections R53). */
  w.resolve(CAP2, DOC2, PERSON2);
  w.asserted[Q] = [{ a_bundle_id: DOC2, b_bundle_id: Q, asserted_by: "member", author: "member:alice" }];
  assert.equal((await w.p.look({ run: o.run, entity: PERSON2, caller: CALLER })).person, true);
  /* An entity the registry cannot place is read as a person (fail closed). */
  assert.equal((await w.p.look({ run: o.run, entity: "ENT-2026-19999", caller: CALLER })).code, "EXPLORE_PERSON_NOT_TIED");
});

test("R10: an exploring run gathers about at most 20 distinct persons; a look past the cap is refused EXPLORE_PERSON_CAP_REACHED and the run ends its step set_aside with that reason", async () => {
  assert.equal(EXPLORE_PERSON_CAP, 20);
  const w = await world().standard();
  const people = Array.from({ length: 21 }, (_, i) => `ENT-2026-${20000 + i}`);
  for (const [i, p] of people.entries()) { w.entity(p, "person"); w.resolve(sha64(i), DOC2, p); }
  w.asserted[Q] = [{ a_bundle_id: DOC2, b_bundle_id: Q, asserted_by: "member", author: "member:alice" }];
  const o = await w.openRun("group");
  for (const p of people.slice(0, 20)) assert.equal((await w.p.look({ run: o.run, entity: p, caller: CALLER })).ok, true);
  assert.equal((await w.p.look({ run: o.run, entity: people[3], caller: CALLER })).ok, true, "negative control: a person already gathered about is no new one");
  const past = await w.p.look({ run: o.run, entity: people[20], caller: CALLER });
  assert.deepEqual([past.code, past.cap, past.ended.end, past.ended.reason], ["EXPLORE_PERSON_CAP_REACHED", 20, "set_aside", "EXPLORE_PERSON_CAP_REACHED"]);
  assert.deepEqual(w.calledAs("stepEnd").map((a) => [a.end, a.reason]), [["set_aside", "EXPLORE_PERSON_CAP_REACHED"]]);
  assert.equal((await w.p.look({ run: o.run, entity: people[0], caller: CALLER })).code, "EXPLORE_RUN_ENDED");
});

const sha64 = (i) => String(i).padStart(64, "0");

test("R12: at its close each run carries ai-runs R76's actual cost, answered to the paying account's owners only", async () => {
  const w = await world().standard();
  w.project(PROJ, ["alice", "bob"], { owners: ["alice"] });
  w.draw(Q, PROJ);
  await w.setExplore("group", "no");
  const o = await w.openRun(`project:${PROJ}`);
  await w.p.end({ run: o.run, caller: CALLER });
  assert.deepEqual(w.p.runCost({ run: o.run, viewer: "member:alice" }).actual, { usd: 0.42 });
  assert.equal(w.p.runCost({ run: o.run, viewer: "member:bob" }), null, "a participant, not an owner");
  assert.equal(w.p.runCost({ run: o.run, viewer: "member:dana" }), null, "an administrator, not this account's owner");
});

test("R13: a run reads inside a held document through run-productions R24, a few pages at a time within its pages bound, never a document under a no-AI material limit; it says how far it read", async () => {
  const w = await world().standard();
  w.doc("INFO-2026-0003-c", capOf("long"), { pages: 45 });
  const o = await w.openRun("group");
  const r1 = w.p.read({ run: o.run, bundleId: "INFO-2026-0003-c", caller: CALLER });
  assert.deepEqual([r1.ok, r1.from, r1.read_to, r1.next_from, r1.step], [true, 0, 5, 5, o.step]);
  assert.equal(r1.pages.length, 5, "a few pages at a time");
  let last = r1;
  for (let i = 0; i < 7; i++) last = w.p.read({ run: o.run, bundleId: "INFO-2026-0003-c", from: last.next_from, caller: CALLER });
  assert.deepEqual([last.read_to, last.stopped], [40, null]);
  const past = w.p.read({ run: o.run, bundleId: "INFO-2026-0003-c", from: last.next_from, caller: CALLER });
  assert.deepEqual([past.code, past.read_to, past.allowed], ["PAGES_BOUND_REACHED", 40, 40], "it says how far it read");
  assert.equal(w.bounds.get(`${o.run}|pages`).consumed, 40, "counted as the plane counts mints");
  /* Negative control: the group keeps its material from `read`: run-rules R26's refusal, nothing counted. */
  const w2 = await world().standard();
  const o2 = await w2.openRun("group");
  assert.equal(w2.aiAccounts.aiKeepAwaySet({ on: true, uses: ["read"], reason: "a privileged file", by: "member:dana" }).ok, true);
  assert.equal(w2.p.read({ run: o2.run, bundleId: DOC, caller: CALLER }).code, "AI_RUN_READ_NO_AI");
  assert.equal(w2.bounds.get(`${o2.run}|pages`).consumed, 0);
  /* A project's own limit on `explore` keeps its documents from exploring; on `read`, run-rules R26's refusal. */
  const w3 = await world().standard();
  w3.project(PROJ, ["alice"], { owners: ["alice"] });
  w3.doc(HDOC, HCAP, { project: PROJ });
  w3.draw(Q, PROJ);
  await w3.setExplore("group", "no");
  const o3 = await w3.openRun(`project:${PROJ}`);
  assert.equal(w3.p.read({ run: o3.run, bundleId: HDOC, caller: CALLER }).ok, true);
  assert.equal(w3.aiAccounts.projectAiKeepAwaySet({ project: PROJ, on: true, uses: ["explore"], reason: "kept", by: "member:alice" }).ok, true);
  assert.equal(w3.p.read({ run: o3.run, bundleId: HDOC, caller: CALLER }).code, "EXPLORE_READ_KEPT_AWAY");
  assert.equal(w3.p.read({ run: o3.run, bundleId: DOC, caller: CALLER }).ok, true, "a document outside that project is not kept");
  assert.equal(w3.aiAccounts.projectAiKeepAwaySet({ project: PROJ, on: true, uses: ["read"], reason: "kept", by: "member:alice" }).ok, true);
  assert.equal(w3.p.read({ run: o3.run, bundleId: HDOC, caller: CALLER }).code, "AI_RUN_READ_NO_AI");
  /* Outside the paying account's sight: answered as absent. */
  assert.equal(w.p.read({ run: o.run, bundleId: "INFO-2026-0099-z", caller: CALLER }).code, "NO_SUCH_BUNDLE");
});

test("R13: what an exploring run proposes while reading is run-productions R21's, under its step (K2502); a proposed connection to a person passes R9's gate first", async () => {
  const w = await world().standard();
  w.entity(PERSON, "person");
  w.entity(PERSON2, "person");
  w.question(Q, { subject: PERSON, surfacedBy: "human", recipients: ["alice"] });
  const o = await w.openRun("group");
  const at0 = { kind: "pdf-page", page: 0, ref: "page 1" };
  const doc = { to_kind: "document", to: DOC2, how: "name", name: "page", quote: "text of page 1", source: at0 };
  const r = await w.p.propose({ run: o.run, bundleId: DOC, fn: "propose-reading", version: "0.1.0", connections: [doc], caller: CALLER });
  assert.equal(r.ok, true);
  assert.deepEqual(r.connections.map((c) => [c.to_kind, c.to, c.earned, c.verified_quote]), [["document", DOC2, "C", true]]);
  assert.equal(w.rows(`SELECT step FROM proposed_connections`)[0].step, o.step, "carrying the step it serves");
  assert.equal(w.calledAs("open")[0].bounds.find((b) => b.bound === "mints").allowed, 50, "within a mints bound");
  /* A person a member tied (the question's subject, raised by a member) may be proposed, in a public role. */
  const tied = { to_kind: "person", to: PERSON, role: "the clerk", how: "name", name: "page", quote: "text of page 2",
                 source: { kind: "pdf-page", page: 1, ref: "page 2" } };
  assert.equal((await w.p.propose({ run: o.run, bundleId: DOC, fn: "propose-reading", version: "0.1.0", connections: [tied], caller: CALLER })).ok, true);
  /* Negative control: a person no member tied is refused before anything is proposed, recorded on the run. */
  const before = w.count("proposed_connections");
  const no = await w.p.propose({ run: o.run, bundleId: DOC, fn: "propose-reading", version: "0.1.0", caller: CALLER,
                           connections: [{ ...tied, to: PERSON2, quote: "text of page 3", source: { kind: "pdf-page", page: 2, ref: "page 3" } }] });
  assert.deepEqual([no.code, no.nothing_proposed], ["EXPLORE_PERSON_NOT_TIED", true]);
  assert.equal(w.count("proposed_connections"), before);
  assert.deepEqual(w.p.refusalsOn(o.run).map((x) => [x.code, x.entity]), [["EXPLORE_PERSON_NOT_TIED", PERSON2]]);
  /* As the read: a document kept from exploring is refused before run-productions is asked. */
  const w2 = await world().standard();
  w2.project(PROJ, ["alice"], { owners: ["alice"] });
  w2.doc(HDOC, HCAP, { project: PROJ });
  w2.draw(Q, PROJ);
  await w2.setExplore("group", "no");
  const o2 = await w2.openRun(`project:${PROJ}`);
  assert.equal(w2.aiAccounts.projectAiKeepAwaySet({ project: PROJ, on: true, uses: ["explore"], reason: "kept", by: "member:alice" }).ok, true);
  assert.equal((await w2.p.propose({ run: o2.run, bundleId: HDOC, fn: "propose-reading", version: "0.1.0", connections: [doc], caller: CALLER })).code,
               "EXPLORE_READ_KEPT_AWAY");
});

test("R13: the material limit is read from ai-accounts (its R22's aiKeptAway, asked with the document's project and the use explore); a read that throws is answered its fail-closed refusal (ai-accounts R34's KEPT_AWAY_UNREADABLE), nothing read", async () => {
  const asked = [];
  const stand = { real: null, throws: false,
    accountUsesOf(a) { return stand.real.accountUsesOf(a); },
    accountHistory(a) { return stand.real.accountHistory(a); },
    aiKeptAway(a) { asked.push(a); if (stand.throws) throw new Error("unreadable"); return stand.real.aiKeptAway(a); } };
  const w = world({ aiAccounts: stand });
  stand.real = w.aiAccounts;
  await w.standard();
  w.project(PROJ, ["alice"], { owners: ["alice"] });
  w.doc(HDOC, HCAP, { project: PROJ });
  w.draw(Q, PROJ);
  await w.setExplore("group", "no");
  const o = await w.openRun(`project:${PROJ}`);
  assert.equal(w.p.read({ run: o.run, bundleId: HDOC, caller: CALLER }).ok, true, "negative control: nothing keeps it");
  assert.deepEqual(asked.at(-1), { project: PROJ, use: "explore" });
  stand.throws = true;
  const consumed = w.bounds.get(`${o.run}|pages`).consumed;
  const r = w.p.read({ run: o.run, bundleId: HDOC, caller: CALLER });
  assert.deepEqual([r.code, r.kept_away.code, r.kept_away.use], ["EXPLORE_READ_KEPT_AWAY", KEPT_AWAY_UNREADABLE.code, "explore"]);
  assert.equal((await w.p.propose({ run: o.run, bundleId: HDOC, fn: "propose-reading", version: "0.1.0", caller: CALLER })).code, "EXPLORE_READ_KEPT_AWAY");
  assert.equal(w.bounds.get(`${o.run}|pages`).consumed, consumed, "nothing read");
});
