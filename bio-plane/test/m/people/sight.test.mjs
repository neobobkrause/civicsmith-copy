/* people's members' ties, the protected source link and sight at its interface: R20, R21, R31. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, doc, ANN, OUT, BOSS, MACHINE } from "./fixture.mjs";
import { TIE_KINDS, ATTRIBUTION_LEVELS, peopleOps } from "../../../src/people/index.mjs";


test("R20 a member declares only their own tie (MTI-), to a registered entity, of kind employer, relative, business or other, with a note and the attribution level they choose; by is the stamp and no field names another member; a machine is refused; seen only by its member and administrators, any other viewer answered exactly as for no tie; tiesConcerning answers the member's ties to given entities with their levels", () => {
  const w = world();
  const co = w.entity("institution", "Harbour Co"), aunt = w.person("Pat Lee");
  const base = { entity: co, kind: "employer", note: "I worked there 2019", attribution: "cover", by: ANN };
  assert.equal(w.p.declareTie({ ...base, by: MACHINE }).reason, "MEMBER_ACT_ONLY");
  assert.equal(w.p.declareTie({ ...base, by: null }).reason, "MEMBER_ACT_ONLY");
  assert.equal(w.p.declareTie({ ...base, entity: "" }).reason, "NO_ENTITY");
  assert.equal(w.p.declareTie({ ...base, entity: "ENT-2026-9999" }).reason, "NO_SUCH_ENTITY");
  const k = w.p.declareTie({ ...base, kind: "friend" });
  assert.equal(k.reason, "UNKNOWN_TIE_KIND");
  for (const t of TIE_KINDS) assert.ok(k.detail.includes(t));
  assert.equal(w.p.declareTie({ ...base, note: " " }).reason, "NO_NOTE");
  assert.equal(w.p.declareTie({ ...base, attribution: "public" }).reason, "UNKNOWN_ATTRIBUTION");
  const t1 = w.p.declareTie({ ...base, member: "out" });
  assert.match(t1.tie_id, /^MTI-2026-\d{4,}$/);
  assert.equal(t1.member, "ann", "the stamp names the member; a field naming another is never read");
  const t2 = w.p.declareTie({ ...base, entity: aunt, kind: "relative", attribution: "group" });
  for (const level of ATTRIBUTION_LEVELS) assert.equal(w.p.declareTie({ ...base, attribution: level, kind: "other" }).ok, true);
  assert.equal(w.p.tiesOf({ member: "ann", viewer: ANN }).count, 6);
  assert.equal(w.p.tiesOf({ viewer: ANN }).count, 6, "a member's own ties by default");
  assert.equal(w.p.tiesOf({ member: "ann", viewer: BOSS }).count, 6, "an administrator sees them");
  assert.deepEqual(w.p.tiesOf({ member: "ann", viewer: OUT }), { ok: true, member: "ann", count: 0, ties: [] }, "exactly as for no tie");
  assert.deepEqual(w.p.tiesOf({ member: "nobody", viewer: OUT }), { ok: true, member: "nobody", count: 0, ties: [] });
  assert.deepEqual(w.p.tiesOf({ member: "ann", viewer: MACHINE }).ties, []);
  const tc = w.p.tiesConcerning({ entities: [aunt, "ENT-2026-0404"], member: "ann", viewer: ANN });
  assert.deepEqual(tc.ties.map((t) => [t.tie_id, t.attribution]), [[t2.tie_id, "group"]]);
  assert.deepEqual(w.p.tiesConcerning({ entities: [aunt], member: "ann", viewer: OUT }).ties, []);
  assert.equal(w.p.withdrawTie({ tieId: t2.tie_id, reason: "not mine", by: OUT }).reason, "NO_SUCH_TIE", "another's tie answers as absent");
  assert.equal(w.p.withdrawTie({ tieId: t2.tie_id, reason: "", by: ANN }).reason, "NO_REASON");
  assert.equal(w.p.withdrawTie({ tieId: t2.tie_id, reason: "she moved away", by: ANN }).ok, true);
  assert.equal(w.p.withdrawTie({ tieId: t2.tie_id, reason: "x", by: ANN }).already, true);
  assert.deepEqual(w.p.tiesConcerning({ entities: [aunt], member: "ann", viewer: ANN }).ties, []);
  assert.ok(w.p.tiesOf({ member: "ann", viewer: ANN }).ties.find((t) => t.tie_id === t2.tie_id).withdrawn, "kept, shown withdrawn");
});

test("R21 a source is linked to a registered person with evidence and a non-empty sight list (NO_SIGHT_LIST); only the listed members read it; every other viewer, every other read and the export answer exactly as if no link were held; being a source is never stated by personAt or any other person read; a later link of the pair governs and the one it replaced is kept (N617)", () => {
  const w = world();
  const p = w.person("Quinn Roe");
  w.S.add("SRC-2026-1234abcd");
  const base = { source: "SRC-2026-1234abcd", person: p, evidence: "the same handwriting", sight: ["member:ann"], by: ANN };
  assert.equal(w.p.linkSourceToPerson({ ...base, source: "SRC-2026-none" }).reason, "NO_SUCH_SOURCE");
  assert.equal(w.p.linkSourceToPerson({ ...base, person: w.entity("office", "Clerk") }).reason, "NOT_A_PERSON");
  assert.equal(w.p.linkSourceToPerson({ ...base, evidence: "" }).reason, "NO_EVIDENCE");
  assert.equal(w.p.linkSourceToPerson({ ...base, sight: [] }).reason, "NO_SIGHT_LIST");
  assert.equal(w.p.linkSourceToPerson({ ...base, sight: null }).reason, "NO_SIGHT_LIST");
  assert.equal(w.p.linkSourceToPerson({ ...base, by: MACHINE }).reason, "MEMBER_ACT_ONLY");
  assert.equal(w.p.linkSourceToPerson(base).ok, true);
  assert.equal(w.p.sourceLinksOf({ person: p, viewer: ANN }).count, 1);
  assert.equal(w.p.sourceLinksOf({ source: "SRC-2026-1234abcd", viewer: ANN }).links[0].person, p);
  for (const v of [OUT, BOSS, MACHINE, null]) {
    assert.deepEqual(w.p.sourceLinksOf({ person: p, viewer: v }), { ok: true, count: 0, links: [] }, String(v));
    assert.deepEqual(w.p.sourceLinksOf({ source: "SRC-2026-1234abcd", viewer: v }), { ok: true, count: 0, links: [] });
  }
  assert.equal(w.record.declaredTables().find((d) => d.name === "source_person_links").export, "never");
  const reads = JSON.stringify([w.p.personAt({ entityId: p, at: "2020-01-01", viewer: ANN }), w.p.careerOf({ entityId: p, viewer: ANN }),
    w.p.identityOf({ entityId: p, viewer: ANN }), w.p.interestsOf({ entityId: p, viewer: ANN }), w.p.credentialsOf({ entityId: p, viewer: ANN }),
    w.p.statementsOf({ entityId: p, viewer: ANN }), w.p.samePersonCandidates({ entityId: p, viewer: ANN }),
    w.p.peopleDirectory({ viewer: ANN })]);
  assert.ok(!reads.includes("SRC-2026-1234abcd") && !/\bsource_link|is a source|as a source\b/i.test(reads), "no person read states it, even to a listed member");
  /* corrected forward: the later link governs; the one it replaced is kept with who replaced it and when */
  const first = w.one(`SELECT * FROM source_person_links WHERE person=?`, p);
  const again = w.p.linkSourceToPerson({ ...base, sight: ["member:out"], evidence: "a second letter", by: OUT });
  assert.equal(again.ok, true);
  assert.deepEqual(again.replaced, { by: ANN, at: first.at });
  assert.equal(w.p.sourceLinksOf({ person: p, viewer: ANN }).count, 0, "the later sight list governs");
  assert.equal(w.p.sourceLinksOf({ person: p, viewer: OUT }).links[0].evidence, "a second letter");
  const kept = w.rows(`SELECT * FROM source_person_link_history WHERE person=?`, p);
  assert.equal(kept.length, 1);
  assert.deepEqual([kept[0].evidence, kept[0].sight_json, kept[0].by_actor, kept[0].replaced_by], ["the same handwriting", JSON.stringify(["ann"]), ANN, OUT]);
  assert.equal(w.record.declaredTables().find((d) => d.name === "source_person_link_history").export, "never");
});

test("R34 sourceLinkSight(person) is a synchronous internal read, never an op: null when no link to the person is held (and for an unregistered or malformed id), else the members every held link to that person admits (the intersection of their sight lists); it takes no viewer, writes nothing and never throws", () => {
  const w = world();
  const p = w.person("Sol Tran"), q = w.person("Tia Ueda");
  for (const s of ["SRC-2026-aaaa0001", "SRC-2026-aaaa0002"]) w.S.add(s);
  assert.equal(w.p.sourceLinkSight(p), null, "no link held");
  for (const bad of [undefined, null, "", 7, {}, "ENT-2026-9999"]) assert.equal(w.p.sourceLinkSight(bad), null, String(bad));
  w.p.linkSourceToPerson({ source: "SRC-2026-aaaa0001", person: p, evidence: "e", sight: ["member:ann", "out", "boss"], by: ANN });
  const r = w.p.sourceLinkSight(p);
  assert.ok(!(r instanceof Promise), "synchronous");
  assert.deepEqual(r, ["ann", "boss", "out"]);
  w.p.linkSourceToPerson({ source: "SRC-2026-aaaa0002", person: p, evidence: "e", sight: ["boss", "ann"], by: ANN });
  assert.deepEqual(w.p.sourceLinkSight(p), ["ann", "boss"], "with several links, the members every one admits");
  w.p.linkSourceToPerson({ source: "SRC-2026-aaaa0002", person: q, evidence: "e", sight: ["boss"], by: ANN });
  assert.deepEqual(w.p.sourceLinkSight(q), ["boss"], "a link that does not admit ann: a list without her, not null");
  assert.equal(w.p.sourceLinkSight.length, 1, "takes the person only, no viewer");
  const census = () => JSON.stringify(["source_person_links", "source_person_link_history"].map((t) => w.rows(`SELECT * FROM ${t}`)));
  const before = census();
  w.p.sourceLinkSight(p);
  assert.equal(census(), before, "writes nothing");
  const ops = peopleOps(w.p, new URL("https://plane.example/"), {});
  assert.ok(!Object.keys(ops).some((k) => /sight/i.test(k)), "never an op");
  /* never throws: a store it cannot read answers a link admitting no one, never "no link" (fail closed) */
  w.st.sql.exec(`ALTER TABLE source_person_links RENAME TO source_person_links_away`);
  assert.deepEqual(w.p.sourceLinkSight(p), []);
  w.st.sql.exec(`ALTER TABLE source_person_links_away RENAME TO source_person_links`);
});

test("R31 sight: the registry is group-wide; a fact follows its document's visibility; identity claims, testimony and check results inside a project the viewer may not see are not answered and not counted; ties and the source link take their own narrowest sight; every withheld item answers exactly as an absent one", () => {
  const w = world();
  const p = w.person("Ray Sun"), q = w.person("Ray Sun");
  const open = w.capture("open"), fenced = w.capture("fenced", { fenced: true });
  const valid = { from: "2000-01-01", to: "2030-01-01", precision: "day", zone: "UTC" };
  w.p.recordPersonFact({ person: p, kind: "locality", value: "Open Town", valid, citation: doc(open), by: ANN });
  w.p.recordPersonFact({ person: p, kind: "locality", value: "Hidden Town", valid, citation: doc(fenced), by: ANN });
  w.p.claimIdentity({ a: p, b: q, kind: "same_as", basis: "testimony", note: "n", by: ANN, project: w.project() });
  const ann = w.p.personAt({ entityId: p, at: "2020-01-01", viewer: ANN }), out = w.p.personAt({ entityId: p, at: "2020-01-01", viewer: OUT });
  assert.deepEqual(ann.facts.map((f) => f.value).sort(), ["Hidden Town", "Open Town"]);
  assert.deepEqual(out.facts.map((f) => f.value), ["Open Town"]);
  assert.deepEqual(ann.cluster.members, [p, q].sort());
  assert.deepEqual(out.cluster.members, [p], "the fenced claim is neither shown nor counted");
  /* an outsider's answer for a person with only fenced claims equals that for a person with none */
  const lone = w.person("Ray Sun");
  const strip = (r) => JSON.stringify({ ...r, entity_id: null, members: r.members.length, links: r.links.length });
  assert.equal(strip(w.p.identityOf({ entityId: q, viewer: OUT })), strip(w.p.identityOf({ entityId: lone, viewer: OUT })));
  /* the registry is group-wide: every member reads the person and its names */
  assert.deepEqual(out.names.map((n) => n.name), ["Ray Sun"]);
  /* reads fail closed with no viewer */
  for (const r of [w.p.personAt({ entityId: p, at: "2020-01-01" }), w.p.careerOf({ entityId: p }), w.p.identityOf({ entityId: p })])
    assert.equal(r.ok, false);
});

test("R21 (K5148) the read by source takes source_id (source is a door stamp the door deletes from every query), reads the link to a listed member and none to another; a read naming neither source_id nor person is refused, never answered as empty", () => {
  const w = world();
  const p = w.person("Quinn Roe");
  w.S.add("SRC-2026-1234abcd");
  assert.equal(w.p.linkSourceToPerson({ source: "SRC-2026-1234abcd", person: p, evidence: "the same handwriting", sight: ["member:ann"], by: ANN }).ok, true);
  const read = (query) => peopleOps(w.p, new URL(`https://plane.example/?${query}`), null).sourcepersonlinks();
  const listed = read(`source_id=SRC-2026-1234abcd&viewer=${encodeURIComponent(ANN)}`);
  assert.equal(listed.count, 1);
  assert.equal(listed.links[0].person, p);
  assert.equal(read(`source_id=SRC-2026-1234abcd&viewer=${encodeURIComponent(OUT)}`).count, 0, "control: a member the sight list does not name reads none");
  assert.equal(read(`person=${p}&viewer=${encodeURIComponent(ANN)}`).count, 1, "the read by person is unchanged");
  for (const q of [`viewer=${encodeURIComponent(ANN)}`, `source=SRC-2026-1234abcd&viewer=${encodeURIComponent(ANN)}`]) {
    const r = read(q);
    assert.equal(r.ok, false, q);
    assert.equal(r.reason, "NO_LINK_SUBJECT", q);
    assert.ok(typeof r.detail === "string" && r.detail.length > 0);
  }
  assert.equal(w.p.sourceLinksOf({ viewer: ANN }).reason, "NO_LINK_SUBJECT");
});
