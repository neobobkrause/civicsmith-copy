/* sources: recording a disclosure (R2), a hostile one (R3), one known but not recorded (R4), and who reads a stored
   value, with its read log (R5). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, MACHINE, SECRET } from "./fixture.mjs";
import { SOURCES_CHECKS, KINDS, HOWS, AUDIENCES, ATTRIBUTES, NOT_RECORDED, claimSentence } from "../../../src/sources/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const rowOf = (r, code) => { assert.equal(r.check, SOURCES_CHECKS[code].check); assert.equal(r.translation, SOURCES_CHECKS[code].translation); };

test("R2 a disclosure is appended with its stamped by and instant, never edited; every kind, how and knownTo is admitted and a later entry supersedes an earlier one on read", async () => {
  const w = seeded();
  const { sourceId } = await w.pulled({ secret: SECRET });
  const other = (await w.pulled()).sourceId;
  for (const kind of KINDS) for (const how of HOWS) for (const knownTo of AUDIENCES) {
    const revealed = kind === "attribute" ? { kind, attribute: "role", value: "clerk" }
      : kind === "pseudonym_link" ? { kind, to: other } : { kind, value: "Pat" };
    const r = w.disclose(sourceId, { revealed, how, knownTo, ...(how === "hostile" ? { claimedBy: "a hostile blog" } : {}),
                                     ...(kind === "pseudonym_link" ? { sight: undefined } : {}) });
    assert.equal(r.ok, true, `${kind}/${how}/${knownTo}: ${JSON.stringify(r)}`);
    assert.equal(r.by, "bob", "by is the stamp");
    assert.equal(r.at, new Date(w.clock.now).toISOString(), "the instant is the module's clock");
    assert.equal(r.value, undefined, "the answer carries no value (R13)");
  }
  for (const attribute of ATTRIBUTES)
    assert.equal(w.disclose(sourceId, { revealed: { kind: "attribute", attribute, value: "x" } }).ok, true, attribute);
  /* the stamp: `member:<id>` and a bare id name the same member; the founder */
  assert.equal(w.disclose(sourceId, { by: V("carol"), sight: ["carol"] }).by, "carol");
  assert.equal(w.disclose(sourceId, { by: "admin", sight: ["admin"] }).by, "admin");
  /* never edited: every entry stays, in order; a later one of the same kind and attribute supersedes the earlier */
  const w2 = seeded();
  const s2 = (await w2.pulled()).sourceId;
  const e1 = w2.disclose(s2, { revealed: { kind: "name", value: "First" } });
  const snap = w2.rows(`SELECT * FROM source_entries WHERE entry_id = ?`, e1.entry);
  const a1 = w2.disclose(s2, { revealed: { kind: "attribute", attribute: "employer", value: "Acme" } });
  const e2 = w2.disclose(s2, { revealed: { kind: "name", value: "Second" } });
  const a2 = w2.disclose(s2, { revealed: { kind: "attribute", attribute: "role", value: "clerk" } });
  assert.deepEqual(w2.rows(`SELECT * FROM source_entries WHERE entry_id = ?`, e1.entry), snap, "the earlier row is unchanged");
  const h = w2.s.rungOf({ source: s2, viewer: V("bob") });
  assert.equal(h.ok, true);
  const hist = new Map(w2.s.sourceOf({ captureSha: w2.rows(`SELECT sha256 FROM inbox ORDER BY received LIMIT 1`)[0].sha256, viewer: V("bob") }).history.map((e) => [e.entry, e]));
  assert.equal(hist.size, 4, "every entry stays in the history");
  assert.equal(hist.get(e1.entry).superseded_by, e2.entry, "a later name supersedes the earlier on read");
  assert.equal(hist.get(e2.entry).superseded_by, null);
  assert.equal(hist.get(a1.entry).superseded_by, null, "an attribute of another kind is not superseded");
  assert.equal(hist.get(a2.entry).superseded_by, null);
  assert.equal(hist.get(e1.entry).value, "First", "the superseded entry keeps its value");
});

test("R2 refusals in order, each with its row and a negative control: NO_SUCH_SOURCE, BAD_DISCLOSURE naming the field, NO_EVIDENCE; nothing is written", async () => {
  const w = seeded();
  const { sourceId } = await w.pulled();
  const good = { source: sourceId, revealed: { kind: "name", value: "Pat" }, how: "self", knownTo: "group",
                 evidence: "a statement", sight: ["bob"], by: "bob" };
  const before = w.snapshot();
  /* NO_SUCH_SOURCE: an unknown id, no id, and a stamp naming no active member (a machine, none, revoked) */
  for (const bad of [{ source: "SRC-2026-0000" }, { source: undefined }, { by: MACHINE }, { by: undefined }, { by: V("dave") }, { by: "" }]) {
    const r = w.s.recordDisclosure({ ...good, ...bad });
    assert.equal(codeOf(r), "NO_SUCH_SOURCE", JSON.stringify(bad)); rowOf(r, "NO_SUCH_SOURCE");
  }
  /* BAD_DISCLOSURE naming each field */
  for (const [bad, field] of [
    [{ revealed: undefined }, "revealed.kind"], [{ revealed: { kind: "photo", value: "x" } }, "revealed.kind"],
    [{ revealed: { kind: "attribute", value: "x" } }, "revealed.attribute"],
    [{ revealed: { kind: "attribute", attribute: "age", value: "x" } }, "revealed.attribute"],
    [{ revealed: { kind: "name", attribute: "role", value: "x" } }, "revealed.attribute"],
    [{ how: "rumour" }, "how"], [{ how: undefined }, "how"],
    [{ knownTo: "world" }, "knownTo"], [{ knownTo: undefined }, "knownTo"],
    [{ recorded: "yes" }, "recorded"],
    [{ revealed: { kind: "name" } }, "revealed.value"], [{ revealed: { kind: "name", value: " " } }, "revealed.value"],
    [{ revealed: { kind: "name", value: "x".repeat(401) } }, "revealed.value"],
    [{ revealed: { kind: "name", value: "x" }, recorded: false, sight: undefined }, "revealed.value"],
    [{ revealed: { kind: "pseudonym_link", to: "SRC-2026-0000" }, sight: undefined }, "revealed.to"],
    [{ revealed: { kind: "pseudonym_link", to: sourceId }, sight: undefined }, "revealed.to"],
    [{ how: "hostile" }, "claimedBy"], [{ how: "hostile", claimedBy: "x".repeat(201) }, "claimedBy"],
    [{ how: "hostile", claimedBy: "a blog", claimedAt: "last week" }, "claimedAt"],
    [{ claimedBy: "a blog" }, "claimedBy"],
    [{ confirms: "SRCE-none" }, "confirms"],
    [{ revealed: { kind: "name", value: "x" }, recorded: false, sight: ["bob"] }, "revealed.value"],
    [{ revealed: { kind: "name" }, recorded: false, sight: ["bob"] }, "sight"],
  ]) {
    const r = w.s.recordDisclosure({ ...good, ...bad });
    assert.equal(codeOf(r), "BAD_DISCLOSURE", JSON.stringify(bad)); rowOf(r, "BAD_DISCLOSURE");
    assert.equal(r.field, field, JSON.stringify(bad));
  }
  /* NO_EVIDENCE */
  for (const evidence of [undefined, null, "", "  ", {}, { cite: "" }, { note: "only a note" }, 42, ["a"], "x".repeat(2001)]) {
    const r = w.s.recordDisclosure({ ...good, evidence });
    assert.equal(codeOf(r), "NO_EVIDENCE", JSON.stringify(evidence)); rowOf(r, "NO_EVIDENCE");
  }
  /* the order: a call wrong in every field answers the earliest */
  assert.equal(codeOf(w.s.recordDisclosure({ source: "none", how: "rumour", evidence: "" })), "NO_SUCH_SOURCE");
  assert.equal(codeOf(w.s.recordDisclosure({ ...good, how: "rumour", evidence: "" })), "BAD_DISCLOSURE");
  assert.equal(codeOf(w.s.recordDisclosure({ ...good, evidence: "", sight: [] })), "NO_EVIDENCE");
  assert.deepEqual(w.snapshot(), before, "a refused disclosure writes nothing");
  /* the negative controls */
  assert.equal(w.s.recordDisclosure(good).ok, true);
  assert.equal(w.s.recordDisclosure({ ...good, evidence: { cite: "Filing 12, p. 3", note: "the signature" } }).ok, true);
  const hostile = w.s.recordDisclosure({ ...good, how: "hostile", claimedBy: "a blog", claimedAt: "2026-09-01" });
  assert.equal(hostile.ok, true);
  assert.equal(w.s.recordDisclosure({ ...good, confirms: hostile.entry }).ok, true, "a confirmation names a hostile entry");
  assert.equal(codeOf(w.s.recordDisclosure({ ...good, how: "hostile", claimedBy: "b", confirms: hostile.entry })), "BAD_DISCLOSURE",
               "a confirmation is not itself hostile");
});

test("R3 a hostile disclosure is stored as the exposer's claim and read as \"named by <claimed_by> on <date>; not confirmed by the group\", confirmed false always; a confirmation is its own entry, publishable only by the source's consent", async () => {
  const w = seeded();
  const { sourceId, row } = await w.pulled();
  const h = w.disclose(sourceId, { how: "hostile", claimedBy: "an anonymous account", claimedAt: "2026-09-12", knownTo: "public",
                                   evidence: { cite: "https://example.org/post/1" } });
  assert.equal(h.confirmed, false);
  assert.equal(h.claim, word("sources.named_confirmed_group", { claimed_by: "an anonymous account", at: "2026-09-12" }));
  assert.equal(h.claim, claimSentence("an anonymous account", "2026-09-12"));
  const stored = w.rows(`SELECT claimed_by, claimed_at FROM source_entries WHERE entry_id = ?`, h.entry)[0];
  assert.deepEqual(stored, { claimed_by: "an anonymous account", claimed_at: "2026-09-12" }, "stored as {claimed_by, at}");
  /* claimedAt absent: the instant recorded */
  const h2 = w.disclose(sourceId, { how: "hostile", claimedBy: "a forum", revealed: { kind: "attribute", attribute: "employer", value: "Acme" } });
  assert.equal(h2.claim, claimSentence("a forum", new Date(w.clock.now).toISOString()));
  /* every read answers it unconfirmed, whatever else is recorded after it */
  const conf = w.disclose(sourceId, { confirms: h.entry, how: "self", knownTo: "public", evidence: { cite: "a filing" } });
  assert.equal(conf.ok, true);
  const hist = w.s.sourceOf({ captureSha: row.sha256, viewer: V("bob") }).history;
  const hv = hist.find((e) => e.entry === h.entry);
  assert.equal(hv.confirmed, false, "a confirmation never turns the claim confirmed");
  assert.equal(hv.claim, claimSentence("an anonymous account", "2026-09-12"));
  for (const e of hist.filter((x) => x.how === "hostile")) assert.equal(e.confirmed, false);
  const rung = w.s.rungOf({ source: sourceId, viewer: V("carol") });
  for (const c of rung.claims) assert.equal(c.confirmed, false);
  const pub = w.s.publishableAt({ source: sourceId, audience: "public" });
  const hp = pub.entries.find((e) => e.entry === h.entry);
  assert.equal(hp.confirmed, false, "published only as the claim sentence");
  assert.equal(hp.claim, hv.claim);
  /* the confirmation: no public_elsewhere basis; publishable only by consent */
  assert.equal(pub.entries.find((e) => e.entry === conf.entry), undefined, "a confirmation is not public elsewhere");
  w.tick();
  assert.equal(w.s.recordConsent({ source: sourceId, entry: conf.entry, audience: "public", evidence: "signed consent", by: "bob" }).ok, true);
  const after = w.s.publishableAt({ source: sourceId, audience: "public" });
  assert.equal(after.entries.find((e) => e.entry === conf.entry).basis, "consent", "with the source's consent it may be published");
});

test("R4 recorded: false records a detail known to the group without its value: the entry holds none and no read answers one", async () => {
  const w = seeded();
  const { sourceId, row } = await w.pulled();
  const r = w.disclose(sourceId, { recorded: false, revealed: { kind: "name" }, sight: undefined });
  assert.equal(r.ok, true);
  assert.equal(r.recorded, false);
  const stored = w.rows(`SELECT value, recorded FROM source_entries WHERE entry_id = ?`, r.entry)[0];
  assert.deepEqual(stored, { value: null, recorded: 0 }, "the entry holds no value");
  assert.equal(w.count("source_sight"), 0, "and no sight list");
  for (const viewer of [V("bob"), V("alice"), V("carol"), "admin"]) {
    const e = w.s.sourceOf({ captureSha: row.sha256, viewer }).history.find((x) => x.entry === r.entry);
    assert.equal(e.value, undefined, viewer);
    assert.equal(e.withheld, undefined, "nothing is withheld: there is nothing to withhold");
    assert.equal(e.note, NOT_RECORDED);
    assert.equal(e.note, word("sources.known_group_recorded"));
    const rung = w.s.rungOf({ source: sourceId, viewer });
    assert.ok(rung.basis.every((b) => b.value === undefined));
  }
  assert.equal(w.count("source_reads"), 0, "no read answered a value, so none is logged");
  const pub = (w.tick(), w.s.recordConsent({ source: sourceId, entry: r.entry, audience: "group", evidence: "e", by: "bob" }),
               w.s.publishableAt({ source: sourceId, audience: "group" }));
  assert.equal(pub.entries[0].value, undefined, "nor does what may be published: a recorded: false entry answers none");
  assert.equal(pub.entries[0].basis, "consent");
  /* every kind but a link can be recorded without its value */
  assert.equal(w.disclose(sourceId, { recorded: false, revealed: { kind: "attribute", attribute: "occupation" }, sight: undefined }).ok, true);
});

test("R5 a stored value needs a non-empty sight list (NO_SIGHT_LIST); only listed members read it, every other viewer reads it withheld; each read answering a value is logged, and the log is answered to listed members and administrators", async () => {
  const w = seeded();
  const { sourceId, row } = await w.pulled();
  const before = w.snapshot();
  for (const sight of [undefined, null, [], "bob", ["nobody"], ["bob", "dave"], [MACHINE], [""]]) {
    const r = w.s.recordDisclosure({ source: sourceId, revealed: { kind: "name", value: "Pat" }, how: "self", knownTo: "group",
                                     evidence: "e", sight, by: "bob" });
    assert.equal(codeOf(r), "NO_SIGHT_LIST", JSON.stringify(sight)); rowOf(r, "NO_SIGHT_LIST");
    assert.ok(!JSON.stringify(r).includes("Pat"), "the refusal carries no value (R13)");
  }
  assert.deepEqual(w.snapshot(), before);
  const e = w.disclose(sourceId, { sight: ["bob", V("carol")] });
  assert.deepEqual(e.sight, ["bob", "carol"]);
  const read = (viewer) => w.s.sourceOf({ captureSha: row.sha256, viewer }).history.find((x) => x.entry === e.entry);
  w.tick();
  assert.equal(read(V("bob")).value, "Pat Q. Example");
  assert.equal(read(V("carol")).value, "Pat Q. Example");
  for (const viewer of [V("alice"), "admin"]) {
    const v = read(viewer);
    assert.equal(v.value, undefined, `${viewer}: an administrator not listed does not read the value`);
    assert.equal(v.withheld, true);
    assert.equal(v.entry, e.entry, "the entry is answered, its value withheld");
  }
  /* rungOf answers through the same rule, and logs the same way */
  assert.equal(w.s.rungOf({ source: sourceId, viewer: V("carol") }).basis[0].value, "Pat Q. Example");
  assert.equal(w.s.rungOf({ source: sourceId, viewer: V("alice") }).basis[0].withheld, true);
  /* the log: one row per read that answered a value, {source, entry, reader, at} */
  const log = w.s.readLog({ source: sourceId, viewer: V("alice") });
  assert.equal(log.ok, true);
  assert.equal(log.scope, "all");
  assert.deepEqual(log.log.map((x) => x.reader), ["bob", "carol", "carol"]);
  assert.deepEqual(Object.keys(log.log[0]).sort(), ["at", "entry", "reader", "source"]);
  assert.ok(log.log.every((x) => x.source === sourceId && x.entry === e.entry));
  /* answered to a listed member (the reads of the entries they are listed on) and an administrator; to another member,
     none of it */
  assert.equal(w.s.readLog({ source: sourceId, viewer: V("bob") }).log.length, 3);
  const other = w.disclose(sourceId, { revealed: { kind: "attribute", attribute: "role", value: "clerk" }, sight: ["alice"] });
  w.s.sourceOf({ captureSha: row.sha256, viewer: V("alice") });
  assert.equal(w.s.readLog({ source: sourceId, viewer: V("bob") }).log.filter((x) => x.entry === other.entry).length, 0,
               "bob is not listed on alice's entry, so its reads are not his to read");
  assert.equal(w.s.readLog({ source: sourceId, viewer: V("alice") }).log.filter((x) => x.entry === other.entry).length, 1);
  w.member("erin");
  assert.deepEqual(w.s.readLog({ source: sourceId, viewer: V("erin") }).log, [], "a member listed on nothing reads nothing");
  for (const viewer of [MACHINE, undefined, V("dave")])
    assert.equal(codeOf(w.s.readLog({ source: sourceId, viewer })), "NO_SUCH_SOURCE", String(viewer));
  assert.equal(codeOf(w.s.readLog({ source: "SRC-2026-0000", viewer: V("alice") })), "NO_SUCH_SOURCE");
  /* a read that answers no value logs nothing */
  const n = w.count("source_reads");
  read(V("erin"));
  assert.equal(w.count("source_reads"), n);
});
