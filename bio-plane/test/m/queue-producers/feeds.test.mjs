/* R45 (T51; DEC-330 A62; K3806; queue R60): a producer that cannot be read is named. `feedItems` reads its producers as separate
   feeds; one whose read throws, or whose provider answers a refusal or `undetermined` instead of its list, contributes no item and
   is named in `facts.failed` as {feed, reason} (codes, never English); the other feeds' items are unchanged; a provider
   machinery-producers or action-producers names in its own `facts.failed` is carried as `partial`; a feed with no provider
   composed is named in `facts.absent`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso } from "./world.mjs";
import { busy, everyKind } from "./every.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const REASONS = ["threw", "refused", "undetermined", "partial"];
const FEEDS = ["bias-debts", "proposals", "shared-inquiries", "leads", "exports", "references", "objectives", "sources", "machinery",
  "contradictions", "signing-keys", "ai-credits-stop", "retesting-off", "action", "attribution", "docket", "cited-cases", "wizards", "schedule", "places", "projects", "members"];
/* R50: the provider read each broken feed names when its provider answers a refusal or undetermined (`<module>.<read>`). */
const READ = {
  "bias-debts": "bias.uncleared", proposals: "progressions.proposalsFeed", "shared-inquiries": "basis-versions.basisVersions",
  leads: "capture-requests.leads", exports: "corpus-export.exportLog", references: "reevaluation.notices", objectives: "intent.gaps",
  sources: "monitoring.flagged", contradictions: "contradiction.candidatesFor", docket: "docket.coreDue",
  "cited-cases": "case-import.watchItems", wizards: "wizard-scripts.brokenScripts", schedule: "publish-schedule.scheduledEditions" };
const boom = () => { throw new Error("the provider threw"); };
const ids = (r) => r.items.map((i) => i.id).sort();

/* The kinds each feed raises (R45's list), for the feeds `busy` and `everyKind` make speak. */
const KINDS = {
  "bias-debts": ["bias-debt"], proposals: ["missing_predecessor", "overdue_successor", "cardinality_exceeded"],
  "shared-inquiries": ["stance-changed-here-not-elsewhere", "new-version-arrived-from-another-team", "shared-inquiry-concluded-by-another-project"],
  leads: ["out-of-inquiry-lead"], exports: ["export-performed"], references: ["newer-capture-affects-reference"], objectives: ["objective-gap"],
  sources: ["source-modified", "source-removed"],
  contradictions: ["contradiction-duty", "contradiction-lead", "contradiction-plurality", "contradiction-duty-unseen", "contradiction-plurality-unseen",
    "side-corrected", "tension-after-publication"],
  "signing-keys": ["signer-self-registered"], attribution: ["attribution-unchosen"], docket: ["docket-core-due", "edition-withdrawn", "edition-contested"],
  "cited-cases": ["cited-newer-edition", "cited-edition-withdrawn", "followed-case-entry", "cited-docket-entry-refused", "cited-docket-unreadable"],
  wizards: ["wizard-withdrawn", "wizard-restored", "wizard-approval-requested", "wizard-base-updated"],
  schedule: ["edition-scheduled", "edition-published-as-scheduled", "scheduled-edition-stopped"], places: ["place-profile-arrived"] };

/* How each feed is made to fail: the one provider read it makes answers as `how` says. */
const BREAK = {
  "bias-debts": (how) => ({ bias: { uncleared: how } }),
  proposals: (how) => ({ progressions: { proposalsFeed: how } }),
  "shared-inquiries": (how) => ({ basisVersions: { basisVersions: how } }),
  leads: (how) => ({ captureRequests: { leads: how } }),
  exports: (how) => ({ corpusExport: { exportLog: how } }),
  references: (how) => ({ reevaluation: { notices: how } }),
  objectives: (how) => ({ intent: { gaps: how } }),
  sources: (how) => ({ monitoring: { flagged: how } }),
  contradictions: (how) => ({ contradiction: { candidatesFor: how } }),
  attribution: (how) => ({ publication: { caseDocumentFacts: how } }),
  docket: (how) => ({ docket: { coreDue: how } }),
  "cited-cases": (how) => ({ caseImport: { watchItems: how } }),
  wizards: (how) => ({ wizardScripts: { brokenScripts: how } }),
  schedule: (how) => ({ publishSchedule: { scheduledEditions: how } }) };

test("R45: a feed whose read throws contributes no item and is named {feed, reason: 'threw'}; every other feed's items are unchanged, and feedItems never throws as a whole (a monitoring.flagged that throws names `sources`)", () => {
  const base = everyKind().read("alice");
  assert.deepEqual(base.facts.failed, [{ feed: "machinery", reason: "partial" }], "this world's own baseline: the update read machinery-producers names as failed");
  for (const feed of Object.keys(BREAK)) {
    const w = everyKind();
    for (const [k, v] of Object.entries(BREAK[feed](boom))) Object.assign(w.fakes[k], v);
    const r = w.read("alice");
    /* R50: a read that threw inside a read the feed names carries that read alone (the contradictions feed names its four) */
    assert.deepEqual(r.facts.failed.filter((f) => f.feed !== "machinery"), [{ feed, reason: "threw", ...(feed === "contradictions" ? { read: READ[feed] } : {}) }], `${feed}: named, and nothing else`);
    const gone = ids(base).filter((id) => !ids(r).includes(id));
    assert.ok(gone.length > 0, `${feed}: the fixture makes it speak, so its items go`);
    const kindOf = (id) => base.items.find((x) => x.id === id).kind;
    assert.ok(gone.every((id) => KINDS[feed].includes(kindOf(id))), `${feed}: only its own items go: ${gone.map(kindOf).join(", ")}`);
    assert.deepEqual(ids(r).filter((id) => !gone.includes(id)), ids(base).filter((id) => !gone.includes(id)), `${feed}: every other feed's items stand`);
  }
});

test("R45: a provider that answers a refusal names the feed `refused`, one that answers undetermined names it `undetermined`; a refused intent.gaps names `objectives`", () => {
  /* attribution's per-edition `ok: false` is publication's NO_CASE_DOCUMENT, an edition with nothing to say, not a feed unread */
  for (const feed of Object.keys(BREAK).filter((f) => f !== "attribution")) {
    // fixtures-generic: REFUSED (a sentinel code: fourteen providers' reads each answer it in turn, and the module carries whatever code a provider gives; most of those reads have no refusal of their own to publish) */
    for (const [answer, reason] of [[() => ({ ok: false, reason: "REFUSED", detail: "x" }), "refused"], [() => ({ ok: true, state: "undetermined" }), "undetermined"]]) {
      const w = everyKind();
      for (const [k, v] of Object.entries(BREAK[feed](answer))) Object.assign(w.fakes[k], v);
      const r = w.read("alice");
      /* R50: the read it asked and, for a refusal, the code the provider gave (`REFUSED`) */
      assert.deepEqual(r.facts.failed.filter((f) => f.feed === feed), [{ feed, reason, read: READ[feed], ...(reason === "refused" ? { code: "REFUSED" } : {}) }], `${feed}: ${reason}`);
    }
  }
  const w = busy({ intent: { gaps: () => ({ ok: false, reason: "NO_PROJECT" }) } });
  const r = w.read("alice");
  assert.deepEqual(r.facts.failed.filter((f) => f.feed === "objectives"), [{ feed: "objectives", reason: "refused", read: "intent.gaps", code: "NO_PROJECT" }]);
  assert.ok(!r.items.some((i) => i.kind === "objective-gap"));
  assert.ok(r.items.some((i) => i.kind === "source-modified"), "the other feeds' items stand");
});

test("R45: the places feed, the signing-keys feed and the projects feed fail on their own: a registered read that throws, a credentials that throws, a project-roster that throws", () => {
  const w1 = world(); w1.member("ada", { role: "admin" });
  w1.p.registerPlaceArrivals(() => { throw new Error("no"); });
  const own = (r) => r.facts.failed.filter((f) => f.feed !== "machinery");   // an administrator's update read, machinery-producers' own
  assert.deepEqual(own(w1.read("ada")), [{ feed: "places", reason: "threw" }]);
  const w2 = world({ credentials: { signerList: boom } }); w2.member("ada", { role: "admin" });
  assert.deepEqual(own(w2.read("ada")), [{ feed: "signing-keys", reason: "threw" }]);
  const w3 = world({ projectRoster: { projectList: boom, projectParticipants: boom, projectRequests: boom, projectInvitations: boom } }); w3.member("alice");
  assert.deepEqual(own(w3.read("alice")), [{ feed: "projects", reason: "threw" }]);
  /* project-roster's reads never refuse (its R35, R36): for a member it holds nothing of, the real answer is an empty list, and no feed fails */
  const w4 = world(); w4.member("alice");
  assert.deepEqual([w4.roster.projectList({ viewer: "member:alice" }).ok, w4.roster.projectList({ viewer: "member:alice" }).projects], [true, []]);
  assert.deepEqual(own(w4.read("alice")), [], "an empty list is no failure");
});

test("R45: a provider the machinery or action feed names in its own facts.failed is carried under that feed's id with reason `partial`, and the items it did raise stand", () => {
  const w = world({ actionProducers: { actionItems: () => ({ items: [], facts: { failed: ["plan-review-due"] } }) } });
  w.member("alice");
  const r = w.read("alice");
  assert.deepEqual(r.facts.failed, [{ feed: "action", reason: "partial" }]);
  assert.deepEqual(r.facts.action, { failed: ["plan-review-due"] }, "action-producers' own facts ride beside, as before");
  /* a machinery that names a provider it could not read */
  const m = busy();
  assert.deepEqual(m.read("alice").facts.failed, [{ feed: "machinery", reason: "partial" }]);
  /* a machinery or an action producer that throws or answers no list is that feed failed whole */
  const t = world({ machinery: { conditionItems: boom }, actionProducers: { actionItems: () => null } });
  t.member("alice");
  assert.deepEqual(t.read("alice").facts.failed, [{ feed: "machinery", reason: "threw" }, { feed: "action", reason: "refused", read: "action-producers.actionItems" }]);
});

test("R45: every feed answering means `failed` is [] and the items are R8's as before; a feed id is a code, never a sentence, and a reason is one of threw, refused, undetermined, partial", () => {
  const w = world();
  w.member("alice");
  const r = w.read("alice");
  assert.deepEqual(r.facts.failed, []);
  const all = world();
  all.member("alice");
  for (const [k, v] of Object.entries({ ...BREAK.proposals(boom), ...BREAK.leads(boom), ...BREAK.sources(boom), ...BREAK.docket(() => ({ ok: false })) }))
    Object.assign(all.fakes[k], v);
  const failed = all.read("alice").facts.failed;
  assert.equal(failed.length, 4);
  for (const f of failed) {
    assert.ok(FEEDS.includes(f.feed), `${f.feed} is one of R45's ids`);
    assert.match(f.feed, /^[a-z]+(-[a-z]+)*$/, "a code");
    assert.ok(REASONS.includes(f.reason), f.reason);
  }
  /* the word table holds a key for `sources` only (`queue.allclear.failed`); the others have no sentence here, and none is written */
  assert.ok(hasWord("queue.allclear.failed"));
  assert.deepEqual(Object.keys(r.facts).filter((k) => k === "failed_words" || k === "failed_sentences"), []);
});

test("R45: a feed with no provider composed is named in facts.absent, neither failed nor answered: no registered places read, and a store that has not migrated its case documents", () => {
  const w = world();
  w.member("ada", { role: "admin" });
  assert.deepEqual(w.read("ada").facts.absent, ["places"], "no read registered: absent, and no item");
  assert.deepEqual(w.read("ada").facts.failed.filter((f) => f.feed !== "machinery"), []);
  w.p.registerPlaceArrivals(() => ({ ok: true, arrivals: [] }));
  assert.deepEqual(w.read("ada").facts.absent, []);
  w.run(`DROP TABLE case_documents`);
  assert.deepEqual(w.read("ada").facts.absent, ["attribution"], "publication's case documents not migrated here");
  assert.deepEqual(w.read("ada").facts.failed.filter((f) => f.feed !== "machinery"), []);
});

test("R45: with all providers answering, the items and the other facts are R8's as before (the control)", () => {
  const w = busy();
  const r = w.read("alice");
  const kinds = new Set(r.items.map((i) => i.kind));
  for (const k of ["bias-debt", "out-of-inquiry-lead", "export-performed", "objective-gap", "source-modified", "docket-core-due", "wizard-withdrawn",
                   "edition-scheduled", "place-profile-arrived", "wizard-base-updated", "newer-capture-affects-reference"])
    assert.ok(kinds.has(k), k);
  assert.deepEqual(r.facts.objective_gap, { bound: 50, truncated: false });
  assert.deepEqual(r.facts.dispositions, [{ key: "p::old", state: "dismissed" }]);
  assert.deepEqual(Object.keys(byId(r)).filter((id) => id.startsWith("CONDITION::edition-scheduled")).length, 1);
  void NOW; void iso;
});
