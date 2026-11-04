/* docket at T53: the kinds a viewer may act on, each with the fields its act needs, and each refusal naming the field it
   lacks (R32; JOURNEYS R-94; K5558, J5 = A); each new edition recorded on the docket automatically, with its "what
   changed" text (R33; JOURNEYS R-96; K5559, J6 = A; was `publication` R83, K5571). At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, file, prepare, post, sign, V, CASE, SUBJECT, OUTCOME } from "./fixture.mjs";
import { DOCKET_CHECKS, FILE_KIND_FIELDS, PLACE_KIND_FIELDS, OUTCOME_FIELDS, RECORD_KINDS } from "../../../src/docket/index.mjs";

const WHAT = "Corrected the totals in the second table.";

/* A copy of `args` without the field `path` (`a.b` reaches into `a`). */
function without(args, path) {
  const out = structuredClone(args);
  const [head, tail] = path.split(".");
  if (!tail) delete out[head];
  else out[head] = { ...out[head] }, delete out[head][tail];
  return out;
}
/* A refusal of this module's own, naming `path` among its fields (a field named whole, or one of its parts). */
function namesField(r, path, label) {
  assert.equal(r.ok, false, `${label}: ${JSON.stringify(r).slice(0, 300)}`);
  assert.ok(DOCKET_CHECKS[r.reason], `${label}: a row of this module's own (${r.reason})`);
  assert.ok(Array.isArray(r.fields), `${label}: the refusal names its fields (${r.reason})`);
  const head = path.split(".")[0];
  assert.ok(r.fields.some((f) => f === path || f === head || f.startsWith(`${path}.`)), `${label}: names ${path}, got ${r.fields}`);
}

/* R1: each record kind's whole filing, by kind. */
const FILINGS = (w) => ({
  response: { kind: "response", edition: 1, from: { kind: "subject", entity: SUBJECT }, capture: w.cap.sha, proposed: "both", reason: "r" },
  statement: { kind: "statement", edition: 1, from: { kind: "subject", entity: SUBJECT }, capture: w.swept.sha, proposed: "both", reason: "r" },
  reaction: { kind: "reaction", edition: 1, from: { kind: "other", name: "The Daily Example" }, capture: w.cap.sha, proposed: "record", reason: "r" },
  outcome: { ...OUTCOME, edition: 1, from: { kind: "other", name: "The Daily Example" }, capture: w.cap.sha, proposed: "record", reason: "r" },
});

test("R32 the docket read answers the kinds each viewer may act on, each with the fields its act needs: a joined member the four record kinds, the manager those and the kinds the manager places directly (a correction, a withdrawal, a court order among them); a viewer who does not see the project is NO_SUCH_CASE", () => {
  const w = seeded();
  const kinds = (who) => w.docket.docketOf({ case: CASE, viewer: V(who) }).kinds;
  const bob = kinds("bob"), alice = kinds("alice");
  assert.deepEqual(bob.file.map((k) => k.kind), [...RECORD_KINDS]);
  assert.deepEqual(bob.place, [], "a joined member who is not the manager places nothing");
  assert.deepEqual(alice.file.map((k) => k.kind), [...RECORD_KINDS]);
  assert.deepEqual(alice.place.map((k) => k.kind), Object.keys(PLACE_KIND_FIELDS));
  for (const k of ["withdrawal", "court-order", "take-back", "edition"]) assert.ok(alice.place.some((x) => x.kind === k), k);
  assert.deepEqual(bob.file.find((k) => k.kind === "outcome").fields, [...FILE_KIND_FIELDS.outcome]);
  for (const f of OUTCOME_FIELDS) assert.ok(FILE_KIND_FIELDS.outcome.includes(f), `an outcome names ${f}`);
  assert.equal(w.docket.docketOf({ case: CASE, viewer: V("dave") }).reason, "NO_SUCH_CASE");
});

test("R32 each record kind, filed by a joined member and by the manager, files with the fields its kind lists, and without any one of them is refused naming that field; an outcome's refusal names its two fields", () => {
  for (const who of ["bob", "alice"]) {
    for (const kind of RECORD_KINDS) {
      const w = seeded();
      const good = FILINGS(w)[kind];
      for (const path of FILE_KIND_FIELDS[kind]) {
        const before = w.snapshot();
        const r = file(w, { ...without(good, path), ...(path.includes(".") ? {} : { [path]: null }) }, who);
        namesField(r, path, `${who} ${kind} without ${path}`);
        assert.deepEqual(w.snapshot(), before, "nothing written");
        if (path.startsWith("outcome.")) assert.deepEqual(r.fields, [...OUTCOME_FIELDS], "an outcome names the two fields it needs");
      }
      const ok = file(w, good, who);
      assert.equal(ok.ok, true, `${who} files a ${kind}: ${JSON.stringify(ok).slice(0, 300)}`);
    }
  }
});

/* R4: each kind the manager places directly, whole; `setup` leaves what it needs on the docket first. */
const PLACINGS = {
  edition: { setup: (w) => w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { whatChanged: WHAT }), args: () => ({ kind: "edition", edition: 2 }) },
  "take-back": { setup: async (w) => post(w, { kind: "standing-granted", edition: 1, holder: "A neighbour", reason: "r" }),
                 args: () => ({ kind: "take-back", edition: 1, takesBack: 1, reason: "r" }) },
  withdrawal: { args: () => ({ kind: "withdrawal", edition: 1, reason: "r" }) },
  "court-order": { args: (w) => ({ kind: "court-order", order: { effect: "remove", editions: [1] }, capture: w.cap.sha, reason: "r" }) },
  "standing-granted": { args: () => ({ kind: "standing-granted", edition: 1, holder: "A neighbour", reason: "r" }) },
  "standing-withdrawn": { setup: async (w) => post(w, { kind: "standing-granted", edition: 1, holder: "A neighbour", reason: "r" }),
                          args: () => ({ kind: "standing-withdrawn", edition: 1, grant: 1, reason: "r" }) },
  disclosure: { args: () => ({ kind: "disclosure", edition: 1, candidate: "CAND-1" }) },
};

test("R32 each kind the manager places (a correction, a withdrawal and a court order among them) is placed by one act, prepared, signed and posted; without any field its kind lists it is refused naming that field; a joined member who is not the manager is refused DOCKET_NOT_THE_MANAGER", async () => {
  assert.deepEqual(Object.keys(PLACINGS), Object.keys(PLACE_KIND_FIELDS));
  for (const [kind, { setup, args }] of Object.entries(PLACINGS)) {
    const w = seeded();
    if (setup) await setup(w);
    const good = args(w);
    const bob = prepare(w, good, "bob");
    assert.equal(bob.reason, "DOCKET_NOT_THE_MANAGER", `${kind}: bob`);
    for (const path of PLACE_KIND_FIELDS[kind]) {
      const r = prepare(w, { ...without(good, path), ...(path.includes(".") ? {} : { [path]: null }) });
      namesField(r, path, `${kind} without ${path}`);
    }
    const p = prepare(w, good);
    assert.equal(p.ok, true, `${kind}: ${JSON.stringify(p).slice(0, 300)}`);
    const r = await w.docket.docketPost({ digest: p.digest, signature: sign(p), acknowledged: true, by: V("alice"), viewer: V("alice") });
    assert.equal(r.ok, true, `${kind} posted: ${JSON.stringify(r).slice(0, 300)}`);
    assert.equal(JSON.parse(w.rows(`SELECT json FROM docket_entries WHERE case_id=? AND seq=?`, CASE, r.seq)[0].json).kind, kind);
  }
});

test("R33 docketRecordEdition files edition 2's entry with its What changed text, and edition 1's without one; a second call files none; the entry is public, answered unsigned, and the chain goes on from it", async () => {
  const w = seeded();
  w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { whatChanged: WHAT });
  const signers = w.docket.docketSigners();
  const two = w.docket.docketRecordEdition({ case: CASE, edition: 2 });
  assert.deepEqual([two.ok, two.filed, two.edition, two.seq], [true, true, 2, 1], JSON.stringify(two).slice(0, 300));
  const one = w.docket.docketRecordEdition({ case: CASE, edition: 1 });
  assert.deepEqual([one.ok, one.filed, one.edition, one.seq], [true, true, 1, 2]);
  const before = w.snapshot();
  const again = w.docket.docketRecordEdition({ case: CASE, edition: 2 });
  assert.deepEqual([again.ok, again.filed, again.seq], [true, false, 1], "a repeated call files no second entry");
  assert.deepEqual(w.snapshot(), before, "and writes nothing");
  const pub = await w.docket.docketPublic({ case: CASE, captures: "omit" });
  const ed = (n) => pub.entries.find((e) => e.fields.kind === "edition" && e.fields.edition === n);
  assert.equal(ed(2).fields.what_changed, WHAT, "edition 2's entry carries the text");
  assert.equal(ed(1).fields.what_changed, null, "edition 1's carries no change text");
  assert.equal(pub.entries.filter((e) => e.fields.kind === "edition").length, 2);
  for (const e of [ed(1), ed(2)]) {
    assert.equal(e.signature, null, "no member signed it");
    assert.deepEqual(Object.keys(e.fields).sort(), ["case", "date", "edition", "format", "group", "kind", "previous", "seq", "shelf", "what_changed"]);
    assert.equal(e.fields.shelf, "listed");
  }
  assert.equal(ed(1).fields.previous, ed(2).digest, "the chain");
  assert.deepEqual(w.docket.docketSigners(), signers, "it is no signer's");
  /* the owner's docket lists it, and coreDue owes it no more */
  assert.ok(w.docket.docketOf({ case: CASE, viewer: V("alice") }).entries.some((e) => e.fields && e.fields.kind === "edition" && e.fields.edition === 2));
  assert.equal(w.docket.coreDue({ case: CASE, viewer: V("alice") }).items.some((i) => i.kind === "edition"), false);
  /* a signed entry goes on from it */
  const g = await post(w, { kind: "standing-granted", edition: 2, holder: "A neighbour", reason: "r" });
  assert.equal(g.seq, 3);
  assert.equal(JSON.parse(g.prepared.entry).previous, ed(1).digest);
  /* the feed and the last entry read it */
  assert.ok((await w.docket.docketFeed({ case: CASE })).includes(`${CASE}:1`));
});

test("R33 controls: an edition no one has recorded stays on coreDue (R9 (b)); an edition not ratified is refused DOCKET_NO_EDITION and an absent case NO_SUCH_CASE, each filing nothing", () => {
  const w = seeded();
  w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { whatChanged: WHAT });
  const due = w.docket.coreDue({ case: CASE, viewer: V("alice") }).items.find((i) => i.kind === "edition");
  assert.deepEqual([due.edition, due.what_changed], [2, WHAT]);
  const before = w.snapshot();
  for (const edition of [3, 0, null, "two"]) {
    const r = w.docket.docketRecordEdition({ case: CASE, edition });
    assert.equal(r.reason, "DOCKET_NO_EDITION", String(edition));
    assert.equal(r.check, DOCKET_CHECKS.DOCKET_NO_EDITION.check);
    assert.deepEqual(r.fields, ["edition"]);
  }
  assert.equal(w.docket.docketRecordEdition({ case: "CASE-2026-9999", edition: 1 }).reason, "NO_SUCH_CASE");
  assert.deepEqual(w.snapshot(), before, "nothing filed");
  /* a counsel matter's case files nothing (R28) */
  w.roster.scopes.set(w.P, "counsel_matter");
  assert.equal(w.docket.docketRecordEdition({ case: CASE, edition: 2 }).reason, "COUNSEL_MATTER_NOT_PUBLISHED");
  assert.deepEqual(w.snapshot(), before);
});
