/* screens-intake R43 (T51 fix round; DEC-375 C17): the `about-knocker` screen on the real served page. Each act sends the fields its
 * owner declares (the shell's guard accepts them); each refusal is drawn by its words; a sentence is asserted by its key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, main, btn, fill, press, refused, word, says, saysIn, rawKeys } from "./page.mjs";

/* The scene is the real store's: a knocker rings the doorbell (the public `knock` op, with a secret the doorbell makes), a member pulls the knock into the record
   (`inboxpull`), and the capture it makes is the one the screen is opened for; `sourceof` mints the source. What became known is written by the members' own
   `sourcedisclose` acts (dev, who may read the values she stores), and read back as the owner answers it. */
async function scene() {
  const t = await members({ mai: ["contribute"], dev: [] });
  const k = await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.5" },
    body: JSON.stringify({ contentText: "A tip about the garage.", generateSecret: true }) } }, null);
  const pulled = await t.mai.act("inboxpull", { body: { knockId: k.json.knockId } });
  const sha = pulled.capture.sha256;
  const source = (await t.mai.read("sourceof", { query: { capture: sha } })).sourceId;
  const disclose = (body) => t.dev.act("sourcedisclose", { body: { source, knownTo: "group", evidence: "She told Dev at the meeting.", ...body } });
  const history = async (as = t.dev) => (await as.read("sourceof", { query: { capture: sha } })).history;
  const people = async () => (await t.mai.read("peopledirectory", { query: { show: "people" } })).rows;
  return { ...t, sha, source, disclose, history, people };
}
const occupation = (value = "school custodian") => ({ revealed: { kind: "attribute", attribute: "occupation", value }, how: "self", recorded: true, sight: ["dev"] });
const hostile = { revealed: { kind: "name" }, how: "hostile", recorded: false, claimedBy: "the landlord's lawyer", claimedAt: "2026-10-06", evidence: "A letter." };
/* the page, opened as dev (who may read what she stored) over the capture's address */
const open = (s, plane = {}, path = `/app/about-knocker/${s.sha}`, as = s.dev) => openWorld(path, { world: s.world, as, plane });
/* the checkbox of a member in the form's list is the position the member list answers her at */
const boxOf = async (s, who) => (await s.mai.read("memberlist")).members.findIndex((m) => m.member_id === who.member);
const rungNow = (p) => main(p).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent;

test("R43 nothing known: the ladder at the source's rung and the form to record what became known; no list, no consent, no heading for what is not there", async () => {
  const s = await scene();
  const p = await open(s);
  const rung = (await s.mai.read("sourcerung", { query: { source_id: s.source } })).rung;
  assert.equal(rung, "same_knocker", "the secret proved the pseudonym, nothing else is known");
  assert.equal(rungNow(p), word("screen.inbox.ladder.same"), "the ladder stands where sourcerung puts it");
  assert.ok(says(p, "screen.about-knocker.intro1") && says(p, "screen.about-knocker.intro2"));
  assert.ok(btn(p, "sourcedisclose"));
  assert.ok(!says(p, "screen.about-knocker.publish.heading"), "nothing to consent to yet");
  assert.ok(!main(p).querySelector("h2") || !Array.from(main(p).querySelectorAll("h2")).some((h) => h.textContent === word("screen.about-knocker.known.head")), "no empty list of what became known");
  assert.deepEqual(rawKeys(p), []);
});

test("R43 what became known and how: each current entry with its value, how it became known and to whom; a hostile claim as a claim, never as a fact", async () => {
  const s = await scene();
  await s.disclose(occupation());
  await s.disclose(hostile);
  const p = await open(s);
  const t = text(p);
  assert.ok(t.includes(word("screen.about-knocker.attribute.occupation")) && t.includes("school custodian"));
  assert.ok(t.includes(word("screen.about-knocker.how.self")) && t.includes(word("screen.about-knocker.knownto.group")));
  assert.ok(t.includes("the landlord's lawyer"));
  assert.ok(t.includes(word("screen.about-knocker.how.hostile")), "the hostile entry is drawn as someone hostile's claim");
  assert.ok(main(p).querySelector("#ab-confirms"), "a hostile claim can be confirmed");
  /* a superseded entry is not drawn as current: the owner supersedes an entry by a later one of the same attribute */
  const u = await scene();
  await u.disclose(occupation("old value"));
  await u.disclose(occupation("new value"));
  assert.ok((await u.history()).some((e) => e.superseded_by), "the owner marks the earlier entry superseded");
  const q = await open(u);
  assert.ok(text(q).includes("new value") && !text(q).includes("old value"));
});

test("R43 recording what became known sends the fields sourcedisclose declares: stored with the members who may read it, or known and not stored", async () => {
  const s = await scene();
  const p = await open(s);
  const dev = await boxOf(s, s.dev);
  fill(p, { "ab-kind": "attribute", "ab-attr": "employer", "ab-value": "the school district", "ab-how": "third_party", "ab-known": "group", "ab-evidence": "She told Dev at the meeting.", [`ab-sight-${dev}`]: true });
  await press(p, "sourcedisclose");
  assert.deepEqual(p.byOp("sourcedisclose").map((r) => r.body), [{ source: s.source, revealed: { kind: "attribute", attribute: "employer", value: "the school district" },
    how: "third_party", knownTo: "group", recorded: true, evidence: "She told Dev at the meeting.", sight: [s.dev.member] }]);
  const kept = (await s.history()).filter((e) => e.attribute === "employer");
  assert.deepEqual(kept.map((e) => [e.value, e.how, e.knownTo, e.recorded, e.by]), [["the school district", "third_party", "group", true, s.dev.member]], "the owner holds what the page sent");
  const u = await scene();
  const q = await open(u);
  fill(q, { "ab-kind": "name", "ab-how": "hostile", "ab-by": "the landlord's lawyer", "ab-at": "2026-10-06", "ab-evidence": "A letter.", "ab-store-0": false, "ab-store-1": true, "ab-known": "member" });
  await press(q, "sourcedisclose");
  assert.deepEqual(q.byOp("sourcedisclose").map((r) => r.body), [{ source: u.source, revealed: { kind: "name" }, how: "hostile", knownTo: "member", recorded: false, evidence: "A letter.", claimedBy: "the landlord's lawyer", claimedAt: "2026-10-06" }]);
  assert.deepEqual((await u.history()).map((e) => [e.how, e.recorded, e.claimed_by]), [["hostile", false, "the landlord's lawyer"]]);
  /* control: no evidence, nothing is sent */
  const v = await scene();
  const r = await open(v);
  fill(r, { "ab-value": "x", "ab-evidence": "" });
  const m = await press(r, "sourcedisclose");
  assert.equal(r.byOp("sourcedisclose").length, 0);
  assert.ok(saysIn(m.slot(), "capture.fieldneeded", { field: word("screen.about-knocker.evidence.label") }));
  assert.deepEqual(await v.history(), [], "nothing was recorded");
});

test("R43 consent given and withdrawn: the detail, the audience and the evidence are sent; a consent standing is drawn beside the entry", async () => {
  const s = await scene();
  const entry = (await s.disclose(occupation())).entry;
  await s.dev.act("sourceconsent", { body: { source: s.source, entry, audience: "group", evidence: "She agreed at the meeting." } });
  const p = await open(s);
  assert.ok(says(p, "screen.about-knocker.consent.members"), "consent given is drawn");
  fill(p, { "ab-cdetail": entry, "ab-caud": "public", "ab-cev": "She wrote to the doorbell." });
  await press(p, "sourceconsent");
  assert.deepEqual(p.byOp("sourceconsent").map((r) => r.body), [{ source: s.source, entry, audience: "public", evidence: "She wrote to the doorbell." }]);
  assert.equal((await s.dev.read("sourcepublishable", { query: { source_id: s.source, audience: "public" } })).entries.length, 1, "the owner holds the public consent");
  fill(p, { "ab-cdetail": entry, "ab-caud": "public" });
  await press(p, "sourceconsentwithdraw", { reason: "She took it back." });
  assert.deepEqual(p.byOp("sourceconsentwithdraw").map((r) => ({ source: r.body.source, entry: r.body.entry, audience: r.body.audience })), [{ source: s.source, entry, audience: "public" }]);
  assert.equal((await s.dev.read("sourcepublishable", { query: { source_id: s.source, audience: "public" } })).entries.length, 0, "the owner no longer holds it");
  /* control: no consent standing, none is drawn */
  const u = await scene();
  await u.disclose(occupation());
  const q = await open(u);
  assert.ok(!says(q, "screen.about-knocker.consent.members"));
});

test("R43 linked to a person: the person, the evidence and the members who may read it are sent; an organization is refused in the design's words", async () => {
  const s = await scene();
  await s.disclose(occupation());
  const dana = (await s.mai.act("entitycreate", { body: { kind: "person", label: "Dana Ortiz", note: "A school custodian named in the record." } })).entity_id;
  const school = (await s.mai.act("entitycreate", { body: { kind: "institution", label: "Oakland Unified", note: "The school district." } })).entity_id;
  const p = await open(s);
  const dev = await boxOf(s, s.dev);
  fill(p, { "ab-person": dana, "ab-pev": "The badge in the council video.", [`ab-psight-${dev}`]: true });
  await press(p, "sourcepersonlink");
  assert.deepEqual(p.byOp("sourcepersonlink").map((r) => r.body), [{ source: s.source, person: dana, evidence: "The badge in the council video.", sight: [s.dev.member] }]);
  assert.equal((await s.dev.read("sourcepersonlinks", { query: { source_id: s.source, person: dana } })).links.length, 1, "the owner holds the link");
  /* the list offers people; the institution is put in the field as a member could type its id, and the owner refuses it */
  const q = await open(s);
  fill(q, { "ab-person": school, "ab-pev": "e", [`ab-psight-${dev}`]: true });
  const r = await press(q, "sourcepersonlink");
  assert.ok(saysIn(r.slot(), "screen.about-knocker.person.refused.org") && saysIn(r.slot(), "screen.about-knocker.person.refused.org.next"));
  assert.ok(!r.slot().textContent.includes(school), "not the owner's detail, which names the entity");
});

test("R43 each refusal is drawn by its words, never the builder's detail: BAD_DISCLOSURE, NO_EVIDENCE, NO_SIGHT_LIST, NO_SUCH_SOURCE, CONSENT_NOT_STANDING", async () => {
  const seen = new Set();
  const drawn = async (code, mk) => {
    const s = await scene();
    const entry = (await s.disclose(occupation())).entry;
    const { plane = {}, op, fields } = await mk(s, entry);
    const p = await open(s, plane);
    fill(p, fields);
    const r = await press(p, op);
    assert.ok(saysIn(r.slot(), `refusal.${code}`), code);
    assert.ok(!r.slot().textContent.includes("builder detail"), code);
    seen.add(r.slot().textContent);
    return s;
  };
  /* what the owner refuses for the real acts: a hostile claim dated in words, not as a date (BAD_DISCLOSURE); a stored detail with no member ticked to read it (NO_SIGHT_LIST);
     consent to an audience below the one already standing (CONSENT_NOT_STANDING) */
  await drawn("BAD_DISCLOSURE", () => ({ op: "sourcedisclose", fields: { "ab-kind": "name", "ab-how": "hostile", "ab-by": "the landlord's lawyer", "ab-at": "last Tuesday", "ab-value": "v", "ab-evidence": "e" } }));
  await drawn("NO_SIGHT_LIST", () => ({ op: "sourcedisclose", fields: { "ab-value": "v", "ab-evidence": "e" } }));
  const standing = await drawn("CONSENT_NOT_STANDING", async (s, entry) => {
    await s.dev.act("sourceconsent", { body: { source: s.source, entry, audience: "public", evidence: "She agreed." } });
    return { op: "sourceconsent", fields: { "ab-cdetail": entry, "ab-caud": "member", "ab-cev": "e" } };
  });
  assert.equal((await standing.dev.read("sourcepublishable", { query: { source_id: standing.source, audience: "public" } })).entries.length, 1, "the consent that stood is unchanged");
  /* the two the page cannot make the owner give: the page sends its evidence field as the reason, so a blank is stopped before the owner; a source the capture lacks
     cannot be reached from a page opened over one it has. The owner's refusal is a fault, the one scripted answer */
  for (const [code, op, fields] of [["NO_EVIDENCE", "sourcedisclose", { "ab-value": "v", "ab-evidence": "e" }], ["NO_SUCH_SOURCE", "sourcedisclose", { "ab-value": "v", "ab-evidence": "e" }]])
    await drawn(code, async (s) => ({ op, plane: { [op]: refused(code, "builder detail") }, fields: { ...fields, [`ab-sight-${await boxOf(s, s.dev)}`]: true } }));
  assert.equal(seen.size, 5);
});

test("R43 opened bare, the shell's Nothing is here with the way back", async () => {
  const s = await scene();
  const p = await open(s, {}, "/app/about-knocker");
  assert.ok(says(p, "shell.unavailable.nothing.says"));
  assert.equal(p.byOp("sourceof").length, 0);
});
