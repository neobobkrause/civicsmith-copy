/* feedItems (R8) at its interface: what it answers, what it takes from queue, what it never carries; the bias debts
   (R1); the lead's take-up (R9); and the invariants over every producer (R10–R13), the signing key's (R14) and the
   docket's items (R30, R31) among them; and the words members see (R24, R25, R28) and the local day (R36). The Action
   layer's to-dos are action-producers' since T45 (K2781 (1)), answered through R8 (`action.test.mjs`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso, sha, homed, MONITORING, DOCKET } from "./world.mjs";
import { viewerPredicate } from "../../../src/membership/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { busy, everyKind, IMP } from "./every.mjs";
import { VERSION_NOTICE_GRADES } from "../../../src/content/index.mjs";

test("R8: every producer's items, homed through homesOf and offered optionsOf; no disposition, no catalogue_id; the facts beside them", () => {
  let feeds = 0;
  /* T45: the Action layer's to-dos, action-producers' (its R13), answered in the same one answer */
  const w = busy({ actionProducers: { actionItems: ({ homesOf, optionsOf }) => ({ facts: { failed: [] }, items: [
    { id: "OBLIGATION::plan-review-due::PLN-1::2026-08-31", class: "OBLIGATION", kind: "plan-review-due", case: homesOf ? homesOf(["PRJ-A"]) : { state: "determined", ungrouped: true, reasons: [], depth_bound: null, ancestors: [] },
      due: "2026-08-31", subject: { kind: "plan", id: "PLN-1" }, summary: "s", detail: "d", basis: { source: "plan-work.planReviewsDue" },
      age: { state: "undetermined", reason: "zone_undetermined" }, assignee: null, assignee_role: null, options: optionsOf ? optionsOf(["PLN-1"]) : [] }] }) } });
  const inner = w.fakes.progressions.proposalsFeed;
  w.fakes.progressions.proposalsFeed = (...a) => { feeds += 1; return inner(...a); };
  const before = w.statements.length;
  const r = w.read("alice");
  const kinds = new Set(r.items.map((i) => i.kind));
  for (const k of ["bias-debt", "missing_predecessor", "out-of-inquiry-lead", "stance-changed-here-not-elsewhere",
                   "new-version-arrived-from-another-team", "shared-inquiry-concluded-by-another-project", "export-performed",
                   "newer-capture-affects-reference", "objective-gap", "source-modified", "governor-holding-host",
                   "partial-capture-outstanding", "capture-completed-unattended", "render-deferred",
                   "archive-fallback-eligible", "monitoring-recheck-due", "signer-self-registered", "docket-core-due",
                   "edition-withdrawn", "edition-contested", "cited-newer-edition", "cited-edition-withdrawn",
                   "followed-case-entry", "cited-docket-entry-refused", "cited-docket-unreadable",
                   "wizard-withdrawn", "wizard-restored", "wizard-approval-requested",
                   "edition-scheduled", "edition-published-as-scheduled", "scheduled-edition-stopped", "place-profile-arrived",
                   "wizard-base-updated", "plan-review-due"])
    assert.ok(kinds.has(k), k);
  for (const it of r.items) {
    assert.ok(!("disposition" in it), `${it.id}: the mint's`);
    assert.ok(!("catalogue_id" in it), `${it.id}: queue stamps it`);
    assert.ok(["OBLIGATION", "FINDING", "CONDITION"].includes(it.class), it.id);
    assert.ok(it.id.startsWith(`${it.class}::`) , it.id);
    assert.equal(typeof it.case.state, "string", it.id);
  }
  assert.ok(w.asked.homes.length > 0 && w.asked.options.length > 0);
  // the options are exactly what optionsOf answered, except the producers' own acts (R9's take-up, the export log,
  // R14's revoke, R30's placement and decline)
  const m = byId(r);
  assert.deepEqual(m["FINDING::p::s"].options, [{ id: "opt", on: ["INF-1"] }]);
  assert.deepEqual(m["FINDING::export-performed::1"].options.map((o) => o.id), ["exportlog"]);
  assert.deepEqual(m["OBLIGATION::signer-self-registered::kim"].options.map((o) => [o.id, o.key]), [["signerset", "KEY-1"], ["signerknown", "KEY-1"]]);   /* R56 */
  assert.deepEqual(m[`OBLIGATION::docket-core-due::${DOCKET.case}::response::${DOCKET.due.items[0].ref}`].options.map((o) => o.id),
    ["docketprepare", "docketdecline"]);
  assert.deepEqual(m["FINDING::edition-withdrawn::INQ-S::CASE-W#3"].options, [{ id: "opt", on: ["INQ-S"] }]);
  assert.deepEqual(m["FINDING::edition-contested::INF-1::DKT-2026-0002"].options, [{ id: "opt", on: ["INF-1"] }]);
  /* R37's, R38's and R39's own acts (publish-schedule R3; instance-setup R14; wizard-scripts R4) */
  assert.deepEqual(m["CONDITION::edition-scheduled::CASE-SW@1"].options.map((o) => o.id), ["publishatmove", "publishatcancel"]);
  assert.deepEqual(m["CONDITION::place-profile-arrived::us-xx-riverton"].options.map((o) => o.id), ["profilesset"]);
  assert.deepEqual(m["FINDING::wizard-base-updated::WIZ-C::WIZ-1@2::alice"].options.map((o) => o.id), ["wizardread", "wizardrevise"]);
  assert.deepEqual(m["CONDITION::edition-scheduled::CASE-SW@1"].case.ancestors.map((a) => a.id), ["PRJ-A"]);
  // the homes are the walk's: the stance item is homed under both projects drawing on the question
  assert.deepEqual(m["FINDING::stance-changed-here-not-elsewhere::INQ-S::PRJ-A"].case.ancestors.map((a) => a.id), ["PRJ-A", "PRJ-B"]);
  // the facts, and one proposalsFeed read for both the findings and the dispositions
  assert.equal(feeds, 1);
  assert.deepEqual(r.facts.dispositions, [{ key: "p::old", state: "dismissed" }]);
  assert.deepEqual(r.facts.objective_gap, { bound: 50, truncated: false });
  assert.deepEqual(r.facts.contradiction, { bound: 50, truncated: false });
  assert.deepEqual(r.facts.unattributed, { count: 0, inquiries: [] });
  assert.deepEqual(r.facts.action, { failed: [] }, "action-producers' facts beside them");
  // it writes nothing
  assert.ok(!w.statements.slice(before).some((q) => /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(q)));
  // with no walk passed, no item is given a home it was not handed
  const bare = w.read("alice", "member:alice", { homes: false, options: false });
  for (const it of bare.items) assert.deepEqual(it.case.ancestors.filter((a) => a.depth > 0), [], it.id);
});

test("R1: each uncleared bias debt inside the gate whose recipients include the member or name nobody, at most 200, keyed OBLIGATION::bias-debt::<run>", () => {
  let asked = null;
  const debts = [{ run: "r1", context_type: "inquiry", context_id: "INQ-1", recipients: ["alice"], raised: iso(NOW - 1000) },
                 { run: "r2", context_type: "inquiry", context_id: "INQ-1", recipients: [], raised: iso(NOW - 2000) },
                 { run: "r3", context_type: "inquiry", context_id: "INQ-1", recipients: ["bob"], raised: iso(NOW - 3000) }];
  const w = world({ bias: { uncleared: (a) => { asked = a; return { debts, limit: a.limit, truncated: false }; } } });
  w.member("alice"); w.member("bob"); w.bundle("INQ-1", "inquiry"); w.bundle("PRJ-1", "project"); w.join("PRJ-1", "alice"); w.cite("PRJ-1", "INQ-1");
  const ids = (r) => r.items.filter((i) => i.kind === "bias-debt").map((i) => i.id);
  assert.deepEqual(ids(w.read("alice")), ["OBLIGATION::bias-debt::r1", "OBLIGATION::bias-debt::r2"]);
  assert.deepEqual(asked, { gate: viewerPredicate("member:alice"), limit: 200 });
  assert.deepEqual(ids(w.read("bob")), ["OBLIGATION::bias-debt::r2", "OBLIGATION::bias-debt::r3"]);
  assert.deepEqual(ids(w.read(null, "class:admin")), ["OBLIGATION::bias-debt::r1", "OBLIGATION::bias-debt::r2", "OBLIGATION::bias-debt::r3"]);
  const m = byId(w.read("alice"));
  const d1 = m["OBLIGATION::bias-debt::r1"], d2 = m["OBLIGATION::bias-debt::r2"];
  assert.deepEqual([d1.class, d1.kind, d1.subject.kind, d1.subject.id], ["OBLIGATION", "bias-debt", "run", "r1"]);
  assert.deepEqual(d1.recipients, ["alice"]); assert.equal(d1.recipients_stated, undefined);
  assert.deepEqual(d2.recipients, []); assert.equal(typeof d2.recipients_stated, "string");
  assert.deepEqual(d1.case.ancestors.map((a) => a.id), ["PRJ-1"], "homed through the walk over the run's context");
  assert.deepEqual(d1.age, { state: "determined", since: iso(NOW - 1000), ms: 1000 });
  assert.equal(d1.basis.source, "bias.uncleared");
});

test("R9: an out-of-inquiry-lead offers, on the inquiry it bears on, the take-up act (cite into that inquiry)", () => {
  const w = busy();
  const lead = byId(w.read("alice"))["FINDING::out-of-inquiry-lead::CR-L"];
  // the act is the take-up, cite, and nothing of optionsOf: the producer's own inquiry-grain act (queue adds the set-aside at its mint)
  assert.deepEqual(lead.options, [{ id: "cite", label: word("queue-producers.label.take_up_under"), weight: "report" }]);
  assert.ok(!w.asked.options.some((s) => s.includes("INQ-A")), "nothing is offered on the question the run was working");
  // on the inquiry it bears on: the item is about that inquiry, filed under its homes, and its basis names it apart
  assert.deepEqual([lead.subject.inquiry, lead.basis.bears_on, lead.basis.found_while_working], ["INQ-S", "INQ-S", "INQ-A"]);
  assert.deepEqual(lead.case.ancestors.map((a) => a.id), ["PRJ-A", "PRJ-B"]);
  assert.equal("options_grain" in lead, false, "no grain is declared missing: the inquiry-grain act is offered");
});

test("R10: every FINDING's basis names its source and its derivation", () => {
  const r = busy().read("alice");
  const findings = r.items.filter((i) => i.class === "FINDING");
  assert.ok(findings.length >= 9);
  for (const it of findings) {
    assert.equal(typeof it.basis.source, "string", it.id); assert.ok(it.basis.source.length > 0, it.id);
    assert.equal(typeof it.basis.detail, "string", it.id); assert.ok(it.basis.detail.length > 20, it.id);
  }
});

test("R11: no answer names a bundle the viewer may not see, and no count reveals one", () => {
  const HID = "PRJ-H";
  /* the address monitoring's real read (its published fixture) finds eligible for the archive fallback */
  const GONE = MONITORING.seeded.addresses.gone, HOST = new URL(GONE).host;
  const w = world({
    governor: { governorHolding: () => [{ host: HOST, cooloff_until: NOW + 5, refusals: 1 }] },
    capture: { liveCaptureSessions: () => [{ session: "S1", locator: GONE, primarySha: sha("c-h"), created: iso(NOW),
      updated: iso(NOW), expires: iso(NOW + 10), ticks: 1, state: {} }] },
    provenance: homed({ [sha("c-h")]: HID }),
    progressions: { proposalsFeed: () => ({ instances: [], dispositions: [], proposals: [
      { key: "p::s", progression_key: "p", progression_label: "P", stage_key: "s", stage_label: "S", required: "always",
        definition_version: 1, n: 1, kinds: ["missing_predecessor"], grade: null, grade_determined: false, overdue: false,
        overdue_count: 0, surfaced_by: "machine", prior_disposition: null, instances: [{ progression_key: "p", entity_id: "E" }] }] }) },
    monitoring: { archiveEligible: () => MONITORING.seeded.archiveEligible },
    basisVersions: { projectsDrawingOn: (inq, viewer) => Object.assign(
      [{ id: "PRJ-A", title: "A", current: { version: "v1", at: iso(NOW), by: "alice" } },
       ...(viewer === "member:alice" ? [] : [{ id: HID, title: "H", current: { version: "v2", at: iso(NOW), by: "x" } }])],
      { bound: 32, truncated: false }) },
    caseTensions: { caseTensions: () => ({ ok: true, cursor: null, cases: [{ case: "CASE-1", edition: 1, project: "PRJ-A",
      tensions: [{ case: "CASE-1", edition: 1, member: HID, candidate: "cand-h", state: "open", depth: 1 }], resolved_since: [] }] }) },
  });
  w.member("alice"); w.bundle(HID, "project"); w.bundle("INF-V"); w.bundle("INQ-S", "inquiry"); w.bundle("PRJ-A", "project");
  w.join("PRJ-A", "alice", { owner: true }); w.cite("PRJ-A", "INQ-S"); w.cite(HID, "INQ-S"); w.cite(HID, "INF-V");
  w.run(`INSERT INTO progression_instances VALUES ('p','E','s','c1',?), ('p','E','s','c2','INF-V')`, HID);
  for (const [c, b] of [["c-h", HID], ["c-v", "INF-V"]]) {
    w.run(`INSERT INTO register (capture_sha, bundle_id, path, encoding, registered, bytes) VALUES (?,?,?,'utf8',?,1)`, sha(c), b, "snapshots/x", iso(NOW));
    w.run(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved, last_retrieved, observations) VALUES (?,?,?,?,?,?,1)`,
      GONE, GONE, sha(c), "direct", iso(NOW), iso(NOW));
  }
  const man = (key, author) => w.run(`INSERT INTO manifest (bundle_id, snap_key, kind, base, author, created, files_json) VALUES (?,?, 'revision', 'b', ?, ?, '[]')`, HID, key, author, iso(NOW));
  man("k1", "alice"); man("k2", "token:daemon");
  const r = w.read("alice");
  assert.ok(!JSON.stringify(r).includes(HID), "the hidden project is named nowhere");
  const m = byId(r);
  assert.deepEqual(m[`CONDITION::governor-holding-host::${HOST}`].subject.bundles, ["INF-V"]);
  assert.deepEqual(m["FINDING::p::s"].subject.bundles, ["INF-V"]);
  assert.equal(m["CONDITION::partial-capture-outstanding::S1"], undefined, "a condition about a hidden bundle is withheld whole");
  assert.equal(m[`CONDITION::capture-completed-unattended::${HID}`], undefined);
  assert.ok(!r.items.some((i) => i.kind === "tension-after-publication"), "a tension naming only hidden members names nothing");
  // the shared-inquiry read counts no question only a hidden project makes shared (D-480)
  assert.ok(!r.items.some((i) => /stance-changed|new-version|shared-inquiry/.test(i.kind)));
  // an operator credential the gate does not filter sees it, so the fixture is not empty by accident
  assert.ok(JSON.stringify(w.read(null, "class:admin")).includes(HID));
});

test("R12: a CONDITION earns an item only where a member's act can change it: its options are the acts on the documents behind it", () => {
  const w = busy();
  const r = w.read("alice");
  const conds = r.items.filter((i) => i.class === "CONDITION");
  assert.ok(conds.length >= 6);
  for (const it of conds) {
    /* R35: a signal about a watch (no document behind it) is changed by the watch's own acts: set its address again, end it */
    if (it.subject.kind === "import") { assert.deepEqual(it.options.map((o) => o.id), ["importwatch", "importunwatch"], it.id); continue; }
    /* R37: a waiting edition is changed by its owners' acts on its time: move it, cancel it (publish-schedule R3) */
    if (it.subject.kind === "case_edition") { assert.deepEqual(it.options.map((o) => o.id), ["publishatmove", "publishatcancel"], it.id); continue; }
    /* R38: an arrival is changed by an administrator's choosing it under Places (instance-setup R14) */
    if (it.subject.kind === "place_profile") { assert.deepEqual(it.options.map((o) => o.id), ["profilesset"], it.id); continue; }
    const docs = it.subject.kind === "bundle" || it.subject.kind === "action" ? [it.subject.id] : it.subject.bundles
      || (it.subject.kind === "capture_request" || it.subject.kind === "address" ? null : []);
    if (docs) assert.deepEqual(it.options, docs.length ? [{ id: "opt", on: docs }] : [], it.id);
    else assert.ok(Array.isArray(it.options), it.id);
    assert.ok(it.options.every((o) => o.id === "opt"), `${it.id}: no act of its own`);
  }
  // a host with no documents offers nothing; a condition whose fact stops holding leaves
  assert.deepEqual(byId(r)["CONDITION::governor-holding-host::h.example"].options, []);
  w.fakes.governor.governorHolding = () => [];
  assert.equal(byId(w.read("alice"))["CONDITION::governor-holding-host::h.example"], undefined);
});

test("R13: no place is named in this module's outward text", () => {
  const text = JSON.stringify(busy().read("alice"));
  for (const place of ["Oakland", "California", "Alameda", "CPRA", "Brown Act", "Sunshine", "San Francisco", "Berkeley"])
    assert.ok(!text.includes(place), place);
});

/* Every string a member reads on an item: its summary and detail, the words of its options, and every sentence under it
   (its basis, its age, its grain, its recipients' statement, its excluded homes), never its id, class or kind. */
function memberWords(item) {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === "string") { if (!["id", "class", "kind", "source", "reason"].includes(key)) out.push([key, v]); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const [k, v] of Object.entries(item)) if (!["id", "class", "kind", "case"].includes(k)) walk(v, k);
  for (const a of (item.case && item.case.excluded) || []) walk(a.detail, "detail");
  return out;
}

test("R24 (DEC-107; DEC-131; H15, H19): no member-facing sentence of any item kind says 'obligation' or 'condition', and no summary, detail or option says 'signal'; the codes, kinds and ids are unchanged", () => {
  const r = everyKind().read("alice");
  const kinds = new Set(r.items.map((i) => i.kind));
  for (const k of ["contradiction-duty", "contradiction-lead", "contradiction-plurality", "contradiction-duty-unseen",
                   "contradiction-plurality-unseen", "side-corrected", "tension-after-publication", "bias-debt", "governor-holding-host",
                   "render-deferred", "objective-gap", "attribution-unchosen", "docket-core-due", "edition-withdrawn", "edition-contested",
                   "cited-newer-edition", "cited-edition-withdrawn", "followed-case-entry", "cited-docket-entry-refused",
                   "cited-docket-unreadable", "wizard-withdrawn", "wizard-restored", "wizard-approval-requested",
                   "edition-scheduled", "edition-published-as-scheduled", "scheduled-edition-stopped", "place-profile-arrived",
                   "wizard-base-updated"])
    assert.ok(kinds.has(k), `the world produces ${k}`);
  assert.ok(kinds.size >= 41, `every kind this module produces (${[...kinds].sort().join(", ")})`);
  /* negative control: the check catches the word it forbids */
  for (const bad of ["a signal", "Signals of the sweep", "SIGNAL"]) assert.match(bad, /\bsignals?\b/i);
  for (const it of r.items) {
    for (const [key, s] of memberWords(it))
      assert.doesNotMatch(s, /\b(obligation|condition)s?\b/i, `${it.id} ${key}: "${s}"`);
    /* DEC-131: a CONDITION item is a "status" in member text, never a "signal": its summary, detail and options' words */
    for (const [key, s] of [["summary", it.summary], ["detail", it.detail], ...(it.options || []).map((o) => ["option", o && o.label])])
      if (typeof s === "string") assert.doesNotMatch(s, /\bsignals?\b/i, `${it.id} ${key}: "${s}"`);
    /* the codes unchanged: the classes, and ids keyed by them */
    assert.ok(["OBLIGATION", "FINDING", "CONDITION"].includes(it.class), it.id);
    assert.ok(it.id.startsWith(`${it.class}::`), it.id);
  }
  const m = byId(r);
  assert.equal(m["CONDITION::governor-holding-host::h.example"].class, "CONDITION");
  assert.equal(m["OBLIGATION::contradiction::CC-D"].class, "OBLIGATION");
  assert.equal(m["OBLIGATION::contradiction-unseen::CN-D"].kind, "contradiction-duty-unseen");
  /* the re-keyed words (DEC-131): a fact about our own machinery is a status, as machinery-producers answers it (its R9) */
  assert.match(m["CONDITION::governor-holding-host::h.example"].basis.detail, /^a status is a fact about OUR OWN machinery/);
  assert.match(m["CONDITION::render-deferred::CR-R"].basis.detail, /^a status is a fact about OUR OWN machinery/);
  assert.equal(m["FINDING::contradiction::CC-L"].detail, word("queue.contradiction-lead.detail"));
  /* R38: the place's arrival calls itself a status (DEC-131) */
  assert.match(m["CONDITION::place-profile-arrived::us-xx-riverton"].detail, /\bstatus\b/);
});

test("T34-87 (DEC-149; K1784, K1811): each member-facing string that called the group's Civicsmith 'this instance' or 'this copy' says 'your group's Civicsmith'", () => {
  const r = everyKind().read("alice");
  const m = byId(r);
  const YOURS = /your team's Civicsmith/;
  const OLD = /\b(this|the) (instance|copy|plane)\b|\bserver\b/i;
  const said = [];
  /* the undetermined age's sentence (R36) moved with the Action layer's items to action-producers (T45; its R20) */
  /* :1623, export-performed's detail */
  said.push(["export-performed", m["FINDING::export-performed::1"].detail]);
  /* :3487, the cited-case finding's derivation, "a verified entry this copy read" */
  said.push(["cited-newer-edition", m[`FINDING::cited-newer-edition::INQ-S::${"c".repeat(64)}#1`].basis.detail]);
  /* :3560, the followed entry's detail; :3612, the refused entry's summary */
  said.push(["followed-case-entry", m[`FINDING::followed-case-entry::${"c".repeat(64)}#3`].detail]);
  said.push(["cited-docket-entry-refused", m[`FINDING::cited-docket-entry-refused::${"c".repeat(64)}#4`].summary]);
  /* :3741, the restored wizard's detail */
  said.push(["wizard-restored", m[`FINDING::wizard-restored::WIZ-1@1::${iso(NOW - 5)}`].detail]);
  assert.equal(said.length, 5, "every row of draft-T34-dec149.md that stays in this module (the sixth moved, T45)");
  for (const [what, s] of said) {
    assert.equal(typeof s, "string", what);
    assert.match(s, YOURS, `${what}: "${s}"`);
    assert.doesNotMatch(s, OLD, `${what}: "${s}"`);
  }
});

test("R28 (DEC-114): no member-facing sentence of any item kind calls what an action plan addresses a 'subject'; the item key `subject`, the codes and kinds are unchanged", () => {
  const SAYS_SUBJECT = /\bsubjects?\b/i;
  /* negative control: the check catches the word it forbids, in any form a sentence could carry it */
  for (const bad of ["the plan's subject", "Subjects of this plan", "a SUBJECT"]) assert.match(bad, SAYS_SUBJECT);
  assert.doesNotMatch("the plan's matters", SAYS_SUBJECT);
  const r = everyKind().read("alice");
  const m = byId(r);
  assert.ok(new Set(r.items.map((i) => i.kind)).size >= 41, "every kind this module produces");
  for (const it of r.items) {
    /* R28's words: the summary, the detail and the words of the options; and every other sentence under the item */
    const words = [["summary", it.summary], ["detail", it.detail],
                   ...(it.options || []).map((o) => ["option", o && o.label]), ...memberWords(it)];
    for (const [key, s] of words) if (typeof s === "string") assert.doesNotMatch(s, SAYS_SUBJECT, `${it.id} ${key}: "${s}"`);
    /* the key `subject` (queue's term for what an item is about) is unchanged, as are the class codes */
    assert.ok(it.subject && typeof it.subject === "object" && typeof it.subject.kind === "string", `${it.id} keeps subject`);
    assert.ok(it.id.startsWith(`${it.class}::`), it.id);
  }
});

test("R25, R36 (T45): over every kind this module produces, none carries `due`, and none changes with the zone the instance holds (west of UTC at the day boundary, UTC, none)", () => {
  const read = (zone) => {
    const w = everyKind();
    w.fakes.actions.place = () => (zone ? { time_zone: { value: zone, status: "ruled", basis: "TEST" } } : { time_zone: null });
    return w.read("alice");
  };
  const la = read("America/Los_Angeles");
  assert.ok(new Set(la.items.map((i) => i.kind)).size >= 40, "every kind this module produces");
  for (const it of la.items) assert.equal("due" in it, false, `${it.id} carries no due`);
  assert.deepEqual(read("UTC").items, la.items, "R36: no day this module answers is taken in the instance's zone, so none moves with it");
  assert.deepEqual(read(null).items, la.items, "and none is undetermined for want of one");
  for (const it of la.items) assert.equal("days" in (it.age || {}), false, `${it.id}: no day counted here`);
});

test("R8 (R22, R23; K1019): feedItems reads the unattended capture's grade note and the credit-level to-do into its one answer", () => {
  const w = everyKind();
  w.run(`INSERT INTO register (capture_sha, bundle_id, path, encoding, registered, bytes) VALUES ('z','INF-1','s','binary',?,1)`, iso(NOW));
  const m = byId(w.read("alice"));
  const unattended = m["CONDITION::capture-completed-unattended::CR-C"];
  assert.deepEqual(unattended.basis.grade_notes.map((n) => n.capture_sha), ["z"], "R22: the request's capture, held and seen");
  assert.ok(unattended.detail.includes(unattended.basis.grade_notes[0].note));
  const credit = m["OBLIGATION::attribution-unchosen::CASE-1@1::OBS-1"];
  assert.deepEqual([credit.class, credit.kind, credit.recipients], ["OBLIGATION", "attribution-unchosen", ["alice"]], "R23");
  assert.ok(!("disposition" in credit) && !("catalogue_id" in credit), "the mint's and queue's, as every item");
});

test("R2 (T33-81; K1481, K1491): the FINDING kinds T33 adds are notice-producers' (its R2–R5) and are never raised here, whatever every producer of this module answers", () => {
  const theirs = ["interest-check-noticed", "money-detector-noticed", "standing-answer", "temporal-expectation-due"];
  const w = everyKind();
  for (const [member, viewer] of [["alice", "member:alice"], [null, "class:admin"]]) {
    const r = w.read(member, viewer);
    assert.ok(r.items.length > 20, "a feed with every producer of this module answering");
    assert.deepEqual(r.items.filter((i) => theirs.includes(i.kind)).map((i) => i.id), [], "no item of a kind notice-producers raises");
    assert.ok(!r.items.some((i) => theirs.some((k) => i.id.includes(`::${k}::`))), "and no id of one");
  }
  assert.deepEqual(Object.keys(w.p).filter((k) => /notice|interest|money|standing|temporal/i.test(k)), [], "no service of theirs here");
});

test("R43 (G65): a newer-capture notice whose grade is NOT_FOUND, as content emits it, reads the word for it and never a hole after \"was read as\"", () => {
  const w = busy({ reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [
      { notice: "RN-NF", holder: "INQ-S", target: "INF-T", grade: "NOT_FOUND", affects: VERSION_NOTICE_GRADES.NOT_FOUND.affects, raised_at: iso(NOW), state: "open" }] }),
    docketDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }),
    citedCaseDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }) } });
  const item = byId(w.read("alice"))["FINDING::newer-capture-affects-reference::RN-NF"];
  assert.ok(item, "the item is raised");
  assert.ok(item.detail.includes(word("queue.fill.grade.notfound")), "the grade's word is in the sentence");
  assert.ok(!/read as\s*\./.test(item.detail), "no hole after 'was read as'");
});

test("R43 (G65): every grade content can emit has a word row under the spelling queue-producers looks up", () => {
  for (const g of Object.keys(VERSION_NOTICE_GRADES)) {
    const w = busy({ reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [
        { notice: "RN-G", holder: "INQ-S", target: "INF-T", grade: g, affects: VERSION_NOTICE_GRADES[g].affects, raised_at: iso(NOW), state: "open" }] }),
      docketDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }),
      citedCaseDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }) } });
    const item = byId(w.read("alice"))["FINDING::newer-capture-affects-reference::RN-G"];
    assert.ok(item && !/read as\s*\./.test(item.detail), `grade ${g} leaves no hole`);
  }
});
