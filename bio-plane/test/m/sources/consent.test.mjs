/* sources: a claim that two sources are one person (R6), consent and its withdrawal (R7), and what may be published
   (R8). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, MACHINE, SECRET, OTHER_SECRET } from "./fixture.mjs";
import { SOURCES_CHECKS, CONSENT_STATEMENT, WITHDRAWAL_STATEMENT, AUDIENCES } from "../../../src/sources/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const rowOf = (r, code) => { assert.equal(r.check, SOURCES_CHECKS[code].check); assert.equal(r.translation, SOURCES_CHECKS[code].translation); };

test("R6 linkClaim records a pseudonym_link disclosure with its evidence and merges nothing; a presented knocker secret of either source makes its basis same_secret; NO_SUCH_SOURCE for either side", async () => {
  const w = seeded();
  const a = await w.pulled({ secret: SECRET }), b = await w.pulled();
  const hb = w.disclose(b.sourceId);
  const before = w.snapshot();
  for (const bad of [{ source: "SRC-2026-0000" }, { to: "SRC-2026-0000" }, { by: MACHINE }, { by: undefined }, { to: undefined }]) {
    const r = await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, evidence: "the same handwriting", by: "bob", ...bad });
    assert.equal(codeOf(r), "NO_SUCH_SOURCE", JSON.stringify(bad)); rowOf(r, "NO_SUCH_SOURCE");
  }
  const self = await w.s.linkClaim({ source: a.sourceId, to: a.sourceId, evidence: "e", by: "bob" });
  assert.equal(codeOf(self), "BAD_DISCLOSURE"); assert.equal(self.field, "to");
  assert.equal(codeOf(await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, by: "bob" })), "NO_EVIDENCE");
  assert.deepEqual(w.snapshot(), before, "a refused claim writes nothing");
  /* on evidence alone */
  const l1 = await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, evidence: "the same handwriting", by: "bob" });
  assert.equal(l1.ok, true);
  assert.equal(l1.kind, "pseudonym_link");
  assert.equal(l1.basis, "evidence");
  assert.equal(l1.to, b.sourceId);
  const stored = w.rows(`SELECT kind, link_to, basis, evidence_json FROM source_entries WHERE entry_id = ?`, l1.entry)[0];
  assert.deepEqual(stored, { kind: "pseudonym_link", link_to: b.sourceId, basis: "evidence",
                             evidence_json: JSON.stringify({ statement: "the same handwriting" }) });
  /* a wrong secret leaves the basis evidence; the right one of either side makes it same_secret */
  w.tick();
  assert.equal((await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, evidence: "e", by: "bob", knockerSecret: OTHER_SECRET })).basis, "evidence");
  assert.equal((await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, evidence: "e", by: "bob", knockerSecret: SECRET.slice(0, 19) })).basis,
               "evidence", "a secret under the floor proves nothing");
  const l2 = await w.s.linkClaim({ source: a.sourceId, to: b.sourceId, evidence: "presented at a meeting", by: "bob", knockerSecret: SECRET });
  assert.equal(l2.basis, "same_secret");
  const l3 = await w.s.linkClaim({ source: b.sourceId, to: a.sourceId, evidence: "e", by: "carol", knockerSecret: SECRET });
  assert.equal(l3.basis, "same_secret", "the secret may be `to`'s");
  assert.ok(!JSON.stringify(w.snapshot()).includes(SECRET), "the secret is stored nowhere");
  assert.ok(!JSON.stringify([l1, l2, l3]).includes(SECRET), "nor answered");
  /* no merge: each keeps its own history, and its own stated source */
  const ha = w.s.sourceOf({ captureSha: a.row.sha256, viewer: V("bob") });
  const hbv = w.s.sourceOf({ captureSha: b.row.sha256, viewer: V("bob") });
  assert.equal(ha.sourceId, a.sourceId);
  assert.equal(hbv.sourceId, b.sourceId);
  assert.ok(ha.history.every((e) => e.source === a.sourceId));
  assert.deepEqual(hbv.history.filter((e) => e.source === b.sourceId).map((e) => e.entry).includes(hb.entry), true);
  assert.equal(ha.history.find((e) => e.entry === hb.entry), undefined, "b's entries are not a's");
  assert.equal(w.count("sources"), 2);
  /* recordDisclosure's own pseudonym_link arm is the same entry */
  const l4 = w.s.recordDisclosure({ source: b.sourceId, revealed: { kind: "pseudonym_link", to: a.sourceId }, how: "third_party",
                                    knownTo: "member", evidence: "e", by: "bob" });
  assert.equal(l4.ok, true);
  assert.equal(l4.basis, "evidence");
});

test("R7 a consent covers one entry for one audience, stated as permanent; a withdrawal binds only later publications; CONSENT_NOT_STANDING for an entry not in the history or an audience lower than what already stands", async () => {
  const w = seeded();
  const a = await w.pulled(), b = await w.pulled();
  const e = w.disclose(a.sourceId), f = w.disclose(a.sourceId, { revealed: { kind: "attribute", attribute: "role", value: "clerk" } });
  const eb = w.disclose(b.sourceId);
  const c = (fields) => w.s.recordConsent({ source: a.sourceId, entry: e.entry, audience: "group", evidence: "a signed note", by: "bob", ...fields });
  const before = w.snapshot();
  for (const [bad, code] of [
    [{ source: "SRC-2026-0000" }, "NO_SUCH_SOURCE"], [{ by: MACHINE }, "NO_SUCH_SOURCE"],
    [{ audience: "world" }, "BAD_DISCLOSURE"], [{ audience: undefined }, "BAD_DISCLOSURE"],
    [{ evidence: "" }, "NO_EVIDENCE"],
    [{ entry: "SRCE-none" }, "CONSENT_NOT_STANDING"], [{ entry: eb.entry }, "CONSENT_NOT_STANDING"], [{ entry: undefined }, "CONSENT_NOT_STANDING"],
  ]) {
    const r = c(bad);
    assert.equal(codeOf(r), code, JSON.stringify(bad)); rowOf(r, code);
  }
  assert.equal(c({ audience: "world" }).field, "audience");
  assert.deepEqual(w.snapshot(), before, "a refused consent writes nothing");
  /* one entry, one audience, stated permanent */
  w.tick();
  const g = c({});
  assert.equal(g.ok, true);
  assert.equal(g.statement, CONSENT_STATEMENT);
  assert.match(g.statement, /permanent for anything published under it/);
  assert.equal(g.standing, "group");
  assert.equal(w.s.publishableAt({ source: a.sourceId, audience: "group" }).entries.some((x) => x.entry === f.entry), false,
               "it covers its own entry, not another");
  /* a wider audience is recorded; a lower one than stands is refused; the same one writes nothing */
  w.tick();
  assert.equal(c({ audience: "public" }).standing, "public");
  for (const audience of ["member", "group"]) {
    const r = c({ audience });
    assert.equal(codeOf(r), "CONSENT_NOT_STANDING", audience); rowOf(r, "CONSENT_NOT_STANDING");
  }
  const n = w.count("source_consents");
  assert.equal(c({ audience: "public" }).existed, true);
  assert.equal(w.count("source_consents"), n, "the same consent again writes nothing");
  /* the withdrawal: binds only later publications */
  const t1 = new Date(w.clock.now).toISOString();
  assert.equal(w.s.publishableAt({ source: a.sourceId, audience: "public" }).entries.find((x) => x.entry === e.entry).basis, "consent");
  w.tick();
  const wd = w.s.withdrawConsent({ source: a.sourceId, entry: e.entry, audience: "public", by: "bob" });
  assert.equal(wd.ok, true);
  assert.equal(wd.statement, WITHDRAWAL_STATEMENT);
  assert.equal(wd.standing, "group", "withdrawing public leaves group standing");
  w.tick();
  assert.equal(w.s.publishableAt({ source: a.sourceId, audience: "public" }).entries.some((x) => x.entry === e.entry), false,
               "a later publication is bound by the withdrawal");
  assert.equal(w.s.publishableAt({ source: a.sourceId, audience: "public", at: t1 }).entries.find((x) => x.entry === e.entry).basis,
               "consent", "what was publishable at the earlier instant stays so: what is published stays published");
  assert.equal(w.s.publishableAt({ source: a.sourceId, audience: "group" }).entries.find((x) => x.entry === e.entry).basis, "consent");
  /* after a withdrawal, consent may be given again; withdrawing what does not stand writes nothing */
  w.tick();
  assert.equal(c({ audience: "public" }).standing, "public");
  const m = w.count("source_consents");
  const none = w.s.withdrawConsent({ source: a.sourceId, entry: f.entry, audience: "member", by: "bob" });
  assert.equal(none.ok, true); assert.equal(none.withdrawn, false);
  assert.equal(w.count("source_consents"), m);
  for (const [bad, code] of [[{ entry: "SRCE-none" }, "CONSENT_NOT_STANDING"], [{ audience: "all" }, "BAD_DISCLOSURE"],
                             [{ by: undefined }, "NO_SUCH_SOURCE"]])
    assert.equal(codeOf(w.s.withdrawConsent({ source: a.sourceId, entry: e.entry, audience: "group", by: "bob", ...bad })), code);
  /* every audience, lowest to highest */
  const x = w.disclose(b.sourceId);
  for (const audience of AUDIENCES) { w.tick(); assert.equal(w.s.recordConsent({ source: b.sourceId, entry: x.entry, audience, evidence: "e", by: "carol" }).standing, audience); }
});

test("R8 publishableAt answers each entry that may be shown to the audience, with its value and its basis (consent not withdrawn at `at`, or public_elsewhere: knownTo public with a citation, never a hostile one alone); every other entry is left out; it writes nothing and never throws", async () => {
  const w = seeded();
  const { sourceId } = await w.pulled();
  const cited = w.disclose(sourceId, { knownTo: "public", evidence: { cite: "Court filing 24-1, p. 2" } });
  const told = w.disclose(sourceId, { revealed: { kind: "attribute", attribute: "employer", value: "Acme" }, knownTo: "public",
                                      evidence: "a member heard it" });
  const group = w.disclose(sourceId, { revealed: { kind: "attribute", attribute: "role", value: "clerk" }, knownTo: "group",
                                       evidence: { cite: "an internal memo" } });
  const hostile = w.disclose(sourceId, { how: "hostile", claimedBy: "a tabloid", claimedAt: "2026-09-20", knownTo: "public",
                                         revealed: { kind: "attribute", attribute: "occupation", value: "nurse" },
                                         evidence: { cite: "https://example.org/tabloid" } });
  const hostileBare = w.disclose(sourceId, { how: "hostile", claimedBy: "a rumour", knownTo: "group",
                                             revealed: { kind: "name", value: "Someone Else" } });
  const snap = w.snapshot();
  const p = w.s.publishableAt({ source: sourceId, audience: "public" });
  assert.equal(p.ok, true);
  const ids = p.entries.map((x) => x.entry);
  assert.deepEqual(ids.sort(), [cited.entry, hostile.entry].sort(),
                   "a cited public entry and a cited public claim; the uncited, the group-known and the bare claim are left out");
  assert.equal(p.entries.find((x) => x.entry === cited.entry).basis, "public_elsewhere");
  const h = p.entries.find((x) => x.entry === hostile.entry);
  assert.equal(h.confirmed, false);
  assert.equal(h.claim, "named by a tabloid on 2026-09-20; not confirmed by the team", "a hostile entry answers as R3's claim sentence");
  assert.equal(p.entries.find((x) => x.entry === cited.entry).value, "Pat Q. Example", "each publishable entry with its value");
  assert.equal(h.value, "nurse");
  const reads = w.count("source_reads");
  assert.ok(!JSON.stringify(p).includes(told.entry) && !JSON.stringify(p).includes(group.entry) && !JSON.stringify(p).includes(hostileBare.entry),
            "nothing is said about an entry left out");
  assert.equal(w.count("source_reads"), reads, "not a read under sight: nothing is logged");
  /* the group is never the first to make a detail more public: a group-known detail reaches public only by consent */
  w.tick();
  w.s.recordConsent({ source: sourceId, entry: group.entry, audience: "group", evidence: "e", by: "bob" });
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "public" }).entries.some((x) => x.entry === group.entry), false);
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "group" }).entries.find((x) => x.entry === group.entry).basis, "consent");
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "member" }).entries.find((x) => x.entry === group.entry).basis, "consent",
               "consent to an audience covers the lower ones");
  /* consent is the stronger basis where both hold */
  w.tick();
  w.s.recordConsent({ source: sourceId, entry: cited.entry, audience: "public", evidence: "e", by: "bob" });
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "public" }).entries.find((x) => x.entry === cited.entry).basis, "consent");
  /* at: an entry recorded after `at` is not answered; a superseded one is not answered */
  const early = new Date(w.clock.now).toISOString();
  w.tick();
  const newer = w.disclose(sourceId, { knownTo: "public", evidence: { cite: "a newer filing" }, revealed: { kind: "name", value: "Other" } });
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "public", at: early }).entries.some((x) => x.entry === newer.entry), false);
  const now = w.s.publishableAt({ source: sourceId, audience: "public" }).entries.map((x) => x.entry);
  assert.ok(now.includes(newer.entry));
  assert.ok(!now.includes(cited.entry), "the older name is superseded by the newer one");
  /* it writes nothing, and never throws, whatever it is asked */
  const s2 = w.snapshot();
  for (const args of [undefined, null, {}, { source: sourceId }, { source: sourceId, audience: "all" }, { source: 7, audience: "public" },
                      { source: sourceId, audience: "public", at: "yesterday" }, { source: sourceId, audience: "public", at: 5 }])
    assert.doesNotThrow(() => w.s.publishableAt(args), JSON.stringify(args));
  assert.equal(codeOf(w.s.publishableAt({ source: sourceId, audience: "all" })), "BAD_DISCLOSURE");
  assert.equal(codeOf(w.s.publishableAt({ source: "SRC-2026-0000", audience: "public" })), "NO_SUCH_SOURCE");
  assert.deepEqual(w.snapshot(), s2, "it writes nothing");
  assert.notDeepEqual(snap, s2);
});
