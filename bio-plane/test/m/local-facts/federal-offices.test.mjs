/* local-facts with the federal layer's records offices in the view (provider notice jurisdictions:40; `jurisdictions` R119:
   each federal FOIA office is a counterparty with level federal, contacts, and no hours and no time zone of its own).
   Terms and R2: an office's fact is its `hours` or its own `time_zone`; an office that holds neither has no fact. So the
   offices add no fact to what factStatus and factsDue list (R2, R4), an act on a path naming one's hours or zone is
   NO_SUCH_FACT (R1) and its status `absent` (R2), and governingPath for one answers the profile's grouping as its fallback (R6). The layer is the provider's
   real one (`jurisdictions.get`), read when the test runs. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, P } from "./fixture.mjs";
import { LOCAL_FACTS_CHECKS, factPath, parseFactPath } from "../../../src/local-facts/index.mjs";
import { get } from "../../../../jurisdictions/index.mjs";

const FED = "us-federal";
const row = (r, code) => {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, code);
  assert.equal(r.check, LOCAL_FACTS_CHECKS[code].check);
};

test("notice jurisdictions:40 R1 R2 R4 R6 the federal records offices in the view add no fact: none listed or due, an act on one's hours or zone is NO_SUCH_FACT and its status absent, governingPath falls back", () => {
  const w = world({ profiles: [FED] });
  const offices = (get(FED).counterparties || []).filter((c) => c.level === "federal");
  assert.ok(offices.length > 0, "the provider's federal layer holds its records offices");
  const office = offices.find((c) => c.hours === undefined && c.time_zone === undefined);
  assert.ok(office, "an office with no hours and no zone of its own (R119)");

  /* R2, R4: every fact of the active profiles, and none of an office's (no office path at all) */
  const listed = w.lf.factStatus({ viewer: V("bob") });
  assert.equal(listed.ok, true);
  assert.ok(listed.facts.length > 0, "the layer's own facts (its holiday years) are listed");
  for (const f of listed.facts) {
    const parts = parseFactPath(f.path);
    assert.ok(parts && parts.office === undefined, `${f.path} names no office`);
  }
  const due = w.lf.factsDue({ viewer: V("bob") });
  assert.equal(due.ok, true);
  for (const f of due.due) assert.equal(parseFactPath(f.path).office, undefined, `${f.path} names no office`);

  /* R1, R6: a path naming a federal office's hours or own zone names no fact; nothing is written */
  const of = { role: office.role, body: office.body };
  for (const path of [factPath({ profile: FED, fact: "hours", office: of }), factPath({ profile: FED, fact: "time_zone", office: of })]) {
    assert.equal(typeof path, "string");
    for (const act of ["confirm", "dispute"]) row(w.act(path, act), "NO_SUCH_FACT");
    /* R2: a path R6 names whose fact the active profiles do not hold reads `absent` */
    const s = w.status(path);
    assert.deepEqual([s.ok, s.status, s.governs], [true, "absent", null]);
  }
  assert.equal(w.count(), 0, "nothing written");

  /* R6: the office holds no fact of its own, so the fallback answers, saying so */
  const g = w.lf.governingPath({ profile: FED, fact: "hours", office: of, at: "2026-09-28T00:00:00Z", viewer: V("bob") });
  assert.notEqual(g.via, "own");

  /* control: an office of the test profile that holds hours is a fact, confirmed */
  const t = world();
  assert.equal(t.act(P.clerkHours, "confirm").ok, true);
  assert.equal(t.status(P.clerkHours).status, "confirmed");
});
