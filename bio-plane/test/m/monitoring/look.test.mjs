/* monitoring R11–R13: the look (`recordLook`, the store route `monitorlook`), and N164's share (R12's receipt makes
   reevaluation's notice sweep pending). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, sha, DAEMON } from "./fixture.mjs";
import { monitorObservationFor, monitoringOps } from "../../../src/monitoring/index.mjs";
import { reevaluationOf } from "../../../src/reevaluation/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const LOC = "https://records.example.org/agenda.txt";
const ADDR = "https://records.example.org/agenda.txt";
const H = (c) => sha(c);

test("R11 one observation row per look, authority sweep naming the bundle, level document, subject the address; each outcome's state", () => {
  const w = world();
  const id = "INFO-2026-0100-look";
  const b = w.monitored(id, LOC, "look-v1");
  const look = (o) => w.m.recordLook({ bundleId: id, address: ADDR, baseline: b.cap, actorClass: "machine", actor: DAEMON, ...o });
  const n0 = w.looks().length;
  const u = look({ outcome: "unchanged", seen: b.cap });
  assert.equal(u.written, true);
  const row = w.looks().at(-1);
  assert.deepEqual([row.authority_kind, row.authority, row.level, row.subject_kind, row.subject, row.state, row.result_kind, row.result_ref],
                   ["sweep", id, "document", "address", ADDR, "PRESENT", "capture", b.cap]);
  assert.deepEqual([row.actor_class, row.actor], ["machine", DAEMON]);
  const c = look({ outcome: "changed", seen: H("other") });
  assert.equal(c.state, "PRESENT");
  assert.equal(w.looks().at(-1).result_ref, b.cap, "an uncaptured change refers to the baseline");
  assert.match(w.looks().at(-1).detail, new RegExp(`served sha256 ${H("other")}`));
  assert.equal(look({ outcome: "removed", httpStatus: 404 }).state, "LOOKED_ABSENT");
  assert.equal(look({ outcome: "unreachable", reason: "timeout" }).state, "LOOKED_INDETERMINATE");
  assert.equal(look({ outcome: "unmonitorable", seen: H("s") }).state, "LOOKED_INDETERMINATE");
  const g = look({ outcome: "governed", reason: "cooling_off" });
  assert.equal(g.state, "LOOKED_INDETERMINATE");
  const gr = w.looks().at(-1);
  assert.deepEqual([gr.governed, gr.condition], [1, "source-unreachable-governed"]);
  assert.equal(w.looks().length, n0 + 6);
  /* unchanged or changed with no baseline, and any other outcome, write nothing and say why */
  const nb = w.m.recordLook({ bundleId: id, address: ADDR, outcome: "unchanged" });
  assert.deepEqual([nb.written, nb.why], [false, word("monitoring.why.captured_baseline_look")]);
  assert.equal(w.m.recordLook({ bundleId: id, address: ADDR, outcome: "changed" }).written, false);
  const other = w.m.recordLook({ bundleId: id, address: ADDR, outcome: "unbaselined", baseline: b.cap });
  assert.deepEqual([other.written, other.why], [false, "no observation is recorded for the outcome 'unbaselined'"]);
  assert.equal(w.looks().length, n0 + 6);
  /* a look naming no bundle or no address writes nothing and says why, in member-read words (K899 (1)) */
  for (const missing of [{ bundleId: null }, { address: null }])
    assert.deepEqual(w.m.recordLook({ bundleId: id, address: ADDR, outcome: "removed", ...missing }),
                     { ok: false, written: false, why: word("monitoring.why.monitor_look_needs") });
  assert.equal(w.looks().length, n0 + 6);
  /* a rendered tick's detail says frame and that the content is undetermined */
  assert.equal(monitorObservationFor({ outcome: "unchanged", baseline: b.cap, scope: "frame" }).detail, "frame unchanged; content undetermined");
  assert.match(monitorObservationFor({ outcome: "changed", baseline: b.cap, seen: H("x"), scope: "frame" }).detail, /^frame changed; .*; content undetermined$/);
  /* the route: the actor is the control plane's stamp from the query */
  const url = new URL(`http://do/monitorlook?actorClass=member&actor=member:alice`);
  const r = monitoringOps(w.m, url, { bundleId: id, address: ADDR, outcome: "removed", httpStatus: 410, actor: "forged" }).monitorlook();
  assert.equal(r.written, true);
  assert.deepEqual([w.looks().at(-1).actor_class, w.looks().at(-1).actor], ["member", "member:alice"]);
});

test("R12 a changed look names a capture only when the register holds it under this bundle and it is the digest seen; it then records the version once", async () => {
  const w = world();
  const id = "INFO-2026-0110-cap";
  const b = w.monitored(id, LOC, "cap-v1");
  const other = "INFO-2026-0111-other";
  const o = w.monitored(other, "https://records.example.org/other.txt", "belongs-elsewhere");
  const look = (captured, seen) => w.m.recordLook({ bundleId: id, address: ADDR, locator: LOC, outcome: "changed", baseline: b.cap,
                                                   seen, captured });
  const notSeen = look({ sha256: o.cap }, H("zzz"));
  assert.deepEqual([notSeen.captured, notSeen.uncaptured], [null, word("monitoring.capture_offered_sha")]);
  const elsewhere = look({ sha256: o.cap }, o.cap);
  assert.deepEqual([elsewhere.captured, elsewhere.uncaptured], [null, word("monitoring.served_bytes_registered")]);
  assert.equal(w.looks().at(-1).result_ref, b.cap);
  assert.equal(w.rows(`SELECT count(*) c FROM captured_locators WHERE capture_sha=?`, o.cap)[0].c, 0, "no version recorded");
  /* a tick that captured: the look names the new capture and the version is recorded at the address, once */
  w.net.routes[LOC] = serve("cap-v2");
  const r = await w.m.monitor({ bundleId: id, viewer: DAEMON, actor: DAEMON });
  const s2 = H("cap-v2");
  assert.equal(r.body.observation.captured, s2);
  assert.equal(w.looks().at(-1).result_ref, s2);
  assert.match(w.looks().at(-1).detail, /^changed; captured by the monitor; compared against baseline sha256 /);
  const v = w.rows(`SELECT address_norm, capture_sha, observations FROM captured_locators WHERE capture_sha=?`, s2);
  assert.deepEqual(v, [{ address_norm: ADDR, capture_sha: s2, observations: 1 }]);
  assert.equal(w.looks().filter((l) => l.result_ref === s2).length, 1, "one look, one row");
});

test("R12 (N164's share): the version R12 records is a provenance receipt, so reevaluation's notice sweep counts it", async () => {
  const w = world();
  w.st.db.exec(`CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT, ord INTEGER, content_id TEXT)`);
  const re = reevaluationOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, provenance: w.prov,
    inquiry: { onRaised: () => ({ ok: true }) } });
  const seq = () => w.rows(`SELECT receipt_seq FROM reevaluation_sweep WHERE id=1`)[0]?.receipt_seq ?? 0;
  const id = "INFO-2026-0112-n164";
  w.monitored(id, LOC, "n164-v1");
  w.net.routes[LOC] = serve("n164-v1");
  await w.m.monitor({ bundleId: id, viewer: DAEMON, actor: DAEMON });
  assert.equal(seq(), 0, "an unchanged tick records no version");
  w.net.routes[LOC] = serve("n164-v2");
  const r = await w.m.monitor({ bundleId: id, viewer: DAEMON, actor: DAEMON });
  assert.equal(r.body.capture.registered, true);
  assert.equal(seq(), 1, "the captured version reached reevaluation's receipt count");
  assert.equal(typeof re.noticeSweepDue, "function");
});

test("R13 what a tick read the address as is kept per normalised address; undetermined never erases; an unknown contract word is undetermined with the word", () => {
  const w = world();
  const id = "INFO-2026-0120-type";
  const b = w.monitored(id, LOC, "type-v1");
  const look = (content, basis = null) => w.m.recordLook({ bundleId: id, address: ADDR, locator: LOC, outcome: "unchanged",
                                                          baseline: b.cap, seen: b.cap, content, contentBasis: basis });
  const at = () => w.rows(`SELECT address_norm, address, content_type, contract, basis FROM monitor_address_type`);
  look(null, "could not tell");
  assert.deepEqual(at(), [{ address_norm: ADDR, address: LOC, content_type: null, contract: null, basis: "could not tell" }]);
  look({ type: "meeting_calendar", confidence: "certain", contract: "membership" });
  assert.deepEqual(at().map((r) => [r.content_type, r.contract, r.basis]), [["meeting_calendar", "membership", null]]);
  look(null, "unreachable today");
  assert.deepEqual(at().map((r) => [r.content_type, r.contract]), [["meeting_calendar", "membership"]], "undetermined does not erase");
  look({ type: "memo", confidence: "likely", contract: "substance" });
  assert.equal(at()[0].contract, "substance", "a determined reading replaces");
  /* a word the catalogue gives no frequency is undetermined, with the word in its basis (on an address holding nothing) */
  w.m.recordLook({ bundleId: id, address: "https://x.example.org/y", locator: "https://x.example.org/y", outcome: "unchanged",
                   baseline: b.cap, seen: b.cap, content: { type: "t", contract: "sometimes" } });
  const row = w.rows(`SELECT contract, basis FROM monitor_address_type WHERE address_norm=?`, "https://x.example.org/y")[0];
  assert.deepEqual([row.contract, row.basis], [null, "the tick read the contract 'sometimes', which this plane gives no frequency"]);
  /* a look that read nothing (content absent) leaves the reading alone */
  const n = at().length;
  w.m.recordLook({ bundleId: id, address: "https://z.example.org/", outcome: "governed" });
  assert.equal(at().length, n);
});
