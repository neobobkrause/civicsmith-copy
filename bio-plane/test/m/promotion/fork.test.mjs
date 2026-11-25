/* promotion's `forkProject` (entry N16, Membership v2 §7.12) — requirement-named tests (R41–R44, K68). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makePromotion, doc, T0 } from "./fixtures.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { noSuchProject, notAParticipant } from "../../../src/membership/index.mjs";

const NOW = "2026-09-26T08:00:00.000Z";
function origin(files = [{ path: "notes.md", text: "kept" }], refs = "[]") {
  const env = makePromotion({ now: () => NOW });
  const r = env.p.promote({ base: null, snapKey: "o", author: "member:ann", ownerMemberId: "ann",
    files: [{ path: "bundle.md", text: doc({ object_type: "project", title: "Sewer Fund", current_state: "forming",
      created: T0, last_updated: T0, references: refs }) }, ...files], meta: {} });
  assert.equal(r.ok, true, JSON.stringify(r));
  env.membership.joined.set(r.bundleId, ["bob"]);
  return { ...env, id: r.bundleId };
}

test("R41: a named newId is refused PROJECT_FORK_ID_SUPPLIED before anything is looked up, echoing no id", () => {
  const { p, record, id } = origin();
  const before = record.dump();
  const a = p.forkProject({ projectId: id, newId: "PROJ-2026-0001-x", title: "Fork", by: "bob" });
  const b = p.forkProject({ projectId: "PROJ-2026-9999-none", newId: "PROJ-2026-0001-x", title: "Fork", by: "nobody" });
  assert.deepEqual([a.reason, a.check], ["PROJECT_FORK_ID_SUPPLIED", "C-59.3"]);
  assert.deepEqual(a, b);
  assert.doesNotMatch(JSON.stringify(a), /PROJ-2026-0001-x|PROJ-2026-9999/);
  assert.equal(record.dump(), before);
});

test("R42: sight before position — existence answers PROJECT_SEEN_NOT_A_PARTICIPANT; unseen and absent answer NO_SUCH_PROJECT identically; no viewer is internal", () => {
  const { p, membership, id } = origin();
  membership.hidden.add(id);
  const unseen = p.forkProject({ projectId: id, title: "Other", by: "dee", viewer: "member:dee" });
  const absent = p.forkProject({ projectId: "PROJ-2026-9999-none", title: "Other", by: "dee", viewer: "member:dee" });
  assert.equal(unseen.reason, "NO_SUCH_PROJECT");
  assert.deepEqual({ ...unseen, project: null }, { ...absent, project: null });
  /* NO_SUCH_PROJECT is minted once, by membership (its R78, N208): the answer is membership's own, byte for byte. */
  assert.deepEqual(unseen, noSuchProject(id));
  assert.deepEqual(absent, noSuchProject("PROJ-2026-9999-none"));
  membership.discoverable.add(id);
  const ex = p.forkProject({ projectId: id, title: "Other", by: "dee", viewer: "member:dee" });
  assert.deepEqual([ex.reason, ex.project, ex.name], ["PROJECT_SEEN_NOT_A_PARTICIPANT", id, "Sewer Fund"]);
  /* C-70.1 is minted once, by membership (R77): the answer is membership's own, byte for byte. */
  assert.deepEqual(ex, membership.existenceAct(id, "member:dee"));
  /* Position is not asked of a caller who cannot see: dee is no participant, and is not told so. */
  assert.notEqual(ex.reason, "NOT_A_PARTICIPANT");
  /* An internal caller (no viewer) is not asked sight. */
  assert.equal(p.forkProject({ projectId: id, title: "Other", by: "bob" }).ok, true);
});

test("R43: each refusal by its reason, participation read through membership, NOT_A_PARTICIPANT through membership.notAParticipant", () => {
  const { p, membership, record, id } = origin();
  membership.invited.set(id, ["cid"]);
  membership.leaving.set(id, ["lee"]);
  const info = "INFO-2026-0001";
  p.promote({ bundleId: info, base: null, snapKey: "i", author: "member:ann", meta: {},
    files: [{ path: "bundle.md", text: doc({ id: info, object_type: "information", title: "I", current_state: "collected", created: T0, last_updated: T0 }) }] });
  assert.equal(p.forkProject({ projectId: info, title: "F", by: "bob" }).reason, "NOT_A_PROJECT");
  /* NOT_A_PARTICIPANT is minted once, by membership (its R87, C-56.3): the answer is membership's own, byte for byte,
     and nothing is written. */
  const before = record.dump();
  const none = p.forkProject({ projectId: id, title: "F", by: "dee" });
  assert.deepEqual(none, notAParticipant(id, "dee"));
  assert.deepEqual([none.reason, none.code, none.check, none.project], ["NOT_A_PARTICIPANT", "NOT_A_PARTICIPANT", "C-56.3", id]);
  assert.equal(typeof none.translation, "string");
  assert.equal(record.dump(), before);
  assert.deepEqual([p.forkProject({ projectId: id, title: "F", by: "cid" }).reason, p.forkProject({ projectId: id, title: "F", by: "cid" }).state], ["NOT_JOINED", "invited"]);
  assert.deepEqual([p.forkProject({ projectId: id, title: "F", by: "lee" }).reason, p.forkProject({ projectId: id, title: "F", by: "lee" }).state], ["NOT_JOINED", "leaving"]);
  assert.equal(p.forkProject({ projectId: id, title: "   ", by: "bob" }).reason, "NO_TITLE");
  const taken = p.forkProject({ projectId: id, title: " sewer  FUND ", by: "bob" });
  assert.equal(taken.reason, "NAME_TAKEN");
  assert.doesNotMatch(JSON.stringify(taken), /PROJ-|Sewer Fund/);
  const blob = origin();
  blob.record.db.prepare("UPDATE files SET content=NULL, blob_sha='b' WHERE bundle_id=? AND path='bundle.md'").run(blob.id);
  assert.equal(blob.p.forkProject({ projectId: blob.id, title: "F", by: "bob" }).reason, "NO_DOCUMENT");
  const odd = origin(undefined, "someScalar");
  assert.equal(odd.p.forkProject({ projectId: odd.id, title: "F", by: "bob" }).reason, "UNSPLICEABLE_REFERENCES");
});

test("R44: the fork is a creation through promote — minted id, forming, created now, a derived_from edge, carried files, the forker sole owner, visibility read back", () => {
  const { p, record, membership, id } = origin();
  const f = p.forkProject({ projectId: id, title: "Sewer Fund, again", by: "bob", visibility: "discoverable" });
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.match(f.newId, /^PROJ-2026-\d{4}-sewer-fund-again$/);
  assert.deepEqual([f.owner, f.participantsCopied, f.visibility, f.rel, f.origin, f.projectId], ["bob", 0, "discoverable", "derived_from", id, id]);
  const text = record.readFile(f.newId, "bundle.md").text;
  const fm = parseFrontmatter(text).data;
  assert.deepEqual([fm.id, fm.title, fm.current_state, fm.created, fm.last_updated], [f.newId, "Sewer Fund, again", "forming", NOW, NOW]);
  assert.deepEqual(fm.references.map((r) => [r.rel, r.target, r.note]), [["derived_from", id, "forked by bob"]]);
  assert.match(text, new RegExp(`### Session ${NOW} \\| forked from ${id} \\| bob`));
  assert.equal(record.readFile(f.newId, "notes.md").text, "kept");
  assert.deepEqual(membership.created.at(-1), { projectId: f.newId, ownerId: "bob", visibility: "discoverable", by: "bob" });
  assert.equal(record.head(f.newId).bundleSha, f.bundleSha);
  /* Absent visibility is hidden. */
  assert.equal(p.forkProject({ projectId: id, title: "Third", by: "bob" }).visibility, "hidden");
  /* `title` set: the document states the forker's title as the grammar reads it back, whatever characters it holds
     (PROMOTION #42: a quote or a backslash was written as a JSON string, whose escapes the grammar keeps, and the fork
     was refused ENVELOPE_TITLE_DISAGREES against its own meta). */
  for (const t of ['Sewer "Fund", forked', "Back\\slash fund", "It's the fund", "Fund: 東京 #2", '"Quoted" fund']) {
    const g = p.forkProject({ projectId: id, title: t, by: "bob" });
    assert.equal(g.ok, true, `${t}: ${JSON.stringify(g)}`);
    assert.equal(parseFrontmatter(record.readFile(g.newId, "bundle.md").text).data.title, t);
    assert.equal(g.title, t);
  }
  /* Every rule of promote applies, its refusal returned. */
  p.registerStep("later", { check: () => ({ ok: false, reason: "LATER_SAYS_NO" }) });
  assert.equal(p.forkProject({ projectId: id, title: "Fourth", by: "bob" }).reason, "LATER_SAYS_NO");
});
