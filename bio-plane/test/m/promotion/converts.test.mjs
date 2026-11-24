/* promotion's shares of the old suites T17's legacy-tests classed CONVERT (K619 (2); `build/jobs/T17/legacy-tests.md`),
 * proved at this module's interface with requirement-named tests: d470-catalog-census (the stamp's shape, R34),
 * d526-refusal-order (R39, R19), project-disclosure (R19), project-mint (R19, R38), rec-181-promote-retire (R16),
 * inquiry (the projected title of an inquiry, R9) and subresources (C-20.1's envelope, R30). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makePromotion, doc, infoDoc, create, revise, sha, T0, T1 } from "./fixtures.mjs";
import { GATE_VERSION, CATALOG_VERSION, recordChecks, PROMOTED_TYPE_CHECKS, PROJECT_MINT_CHECKS } from "../../../src/promotion/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { MECHANICAL_APPEND_FILES } from "../../../src/promotion/history.mjs";

const ID = "INFO-2026-0001";
const pd = (title, extra = {}) => doc({ object_type: "project", title, current_state: "forming", created: T0, last_updated: T0, ...extra });
const mk = (title, extra = {}) => ({ base: null, snapKey: `p-${title}-${Math.random()}`, author: "member:iris", ownerMemberId: "iris",
  files: [{ path: "bundle.md", text: pd(title) }], meta: {}, ...extra });

test("R34 (d470): GATE_VERSION is exactly `plane-gate/1.0 (bio-checks <CATALOG_VERSION>)`, the stamp every ratification carries", () => {
  assert.equal(GATE_VERSION, `plane-gate/1.0 (bio-checks ${CATALOG_VERSION})`);
  assert.match(CATALOG_VERSION, /^\d+\.\d+\.\d+$/);
});

test("R39 (d526): promotion's own refusals are asked before any registered fence: ENVELOPE_TYPE_DISAGREES reaches no step", () => {
  const { p, record } = makePromotion();
  const asked = [];
  for (const m of ["actions", "inquiry", "bias"])
    p.registerStep(m, { check: () => { asked.push(m); return { ok: false, reason: `${m.toUpperCase()}_FENCE` }; } });
  const before = record.dump();
  for (const [text, meta] of [[infoDoc(ID), { object_type: "action" }], [infoDoc(ID), { object_type: "bias" }],
                              [doc({ id: "INQ-2026-0001", object_type: "inquiry", title: "Q", current_state: "open", created: T0, last_updated: T0 }),
                               { object_type: "information" }]]) {
    const id = parseFrontmatter(text).data.id;
    const r = p.promote(create(id, text, { meta }));
    assert.deepEqual([r.reason, r.check], ["ENVELOPE_TYPE_DISAGREES", PROMOTED_TYPE_CHECKS.ENVELOPE_TYPE_DISAGREES.check]);
  }
  assert.deepEqual(asked, [], "no registered fence was asked");
  assert.equal(record.dump(), before);
  /* With the envelope agreeing, the registered fences are asked, in the modules' order (bias, layer 5, first). */
  // fixtures-generic: BIAS_FENCE (a fence this test registers itself and makes refuse; no provider's code)
  assert.equal(p.promote(create(ID, infoDoc(ID), { meta: { object_type: "information" } })).reason, "BIAS_FENCE");
  assert.deepEqual(asked, ["bias"]);
});

test("R19 (d526): a project created with no envelope type is owned by its creator; NAME_TAKEN is answered whether or not the envelope states the type", () => {
  const { p, membership } = makePromotion();
  const made = p.promote(mk("Sewer Fund"));
  assert.deepEqual([made.ok, made.owner], [true, "iris"]);
  assert.deepEqual(membership.created, [{ projectId: made.bundleId, ownerId: "iris", visibility: null, by: "iris" }]);
  for (const meta of [{}, { object_type: "project" }]) {
    const r = p.promote(mk("sewer  FUND", { meta }));
    assert.equal(r.reason, "NAME_TAKEN", JSON.stringify(meta));
  }
});

test("R19 (project-disclosure): NAME_TAKEN is one answer, byte for byte, whichever project holds the name, and names neither its id nor its title", () => {
  const { p, membership } = makePromotion();
  const hidden = p.promote(mk("Sewer Fund Transfers"));
  const own = p.promote({ ...mk("Vera's Own"), ownerMemberId: "vera", author: "member:vera" });
  membership.hidden.add(hidden.bundleId);
  const vera = (title) => p.promote({ ...mk(title), ownerMemberId: "vera", author: "member:vera",
                                      actorIdentity: "member:vera", actorViewer: "member:vera" });
  const againstHidden = vera("sewer  FUND transfers");
  const againstOwn = vera("VERA'S OWN");
  assert.equal(againstHidden.reason, "NAME_TAKEN");
  assert.equal(JSON.stringify(againstOwn), JSON.stringify(againstHidden));
  for (const r of [againstHidden, againstOwn]) {
    assert.equal("bundleId" in r || "title" in r, false);
    assert.doesNotMatch(JSON.stringify(r), /PROJ-|Sewer Fund Transfers|Vera's Own/);
  }
  /* The fork's answer is the same one. */
  membership.joined.set(own.bundleId, ["vera"]);
  assert.equal(JSON.stringify(p.forkProject({ projectId: own.bundleId, title: "SEWER fund  transfers", by: "vera" })),
               JSON.stringify(againstHidden));
  /* Not a blanket refusal: a name nobody holds is created. */
  assert.equal(vera("Sewer Fund Transfers, revisited").ok, true);
});

test("R19, R38 (project-mint): PROJECT_ID_SUPPLIED and PROJECT_ID_IN_BYTES answer one way for a held id and a never-minted one, echo no id, and carry C-59's rows", () => {
  const { p, record } = makePromotion();
  const held = p.promote(mk("Sewer Fund")).bundleId;
  const never = "PROJ-2026-9999-never";
  const before = record.dump();
  /* Named in the request: for a project, and for any other type at a PROJ- id. */
  for (const meta of [{}, { object_type: "information" }]) {
    const a = p.promote({ ...mk("Other"), bundleId: held, meta }), b = p.promote({ ...mk("Other"), bundleId: never, meta });
    assert.deepEqual(a, b);
    assert.deepEqual([a.reason, a.check, a.translation], ["PROJECT_ID_SUPPLIED", PROJECT_MINT_CHECKS.PROJECT_ID_SUPPLIED.check,
                                                          PROJECT_MINT_CHECKS.PROJECT_ID_SUPPLIED.translation]);
    assert.doesNotMatch(JSON.stringify(a), /PROJ-2026-/);
  }
  /* Named in the bytes. */
  const inBytes = (id) => p.promote({ ...mk("Other"), files: [{ path: "bundle.md", text: pd("Other", { id }) }] });
  const bh = inBytes(held), bn = inBytes(never);
  assert.deepEqual(bh, bn);
  assert.deepEqual([bh.reason, bh.check], ["PROJECT_ID_IN_BYTES", "C-59.2"]);
  assert.equal(bh.translation, PROJECT_MINT_CHECKS.PROJECT_ID_IN_BYTES.translation);
  assert.doesNotMatch(JSON.stringify(bh), /PROJ-2026-/);
  /* No front matter to write into: refused by name. */
  const nofm = p.promote({ ...mk("Other"), files: [{ path: "bundle.md", text: "no front matter" }], meta: { object_type: "project" } });
  assert.deepEqual([nofm.reason, nofm.check], ["PROJECT_DOCUMENT_UNREADABLE", "C-59.4"]);
  assert.equal(record.dump(), before, "nothing was created at either id");
  /* A nested `id:` and a body line reading `id:` are not an id: the creation commits, its id written once, first. */
  const text = ["---", "object_type: project", 'title: "Nested"', "current_state: forming", `created: "${T0}"`, `last_updated: "${T0}"`,
                "meta:", "  id: PROJ-2026-0001-x", "---", "", "id: PROJ-2026-0002-y", ""].join("\n");
  const ok = p.promote({ ...mk("Nested"), files: [{ path: "bundle.md", text }] });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const stored = record.readFile(ok.bundleId, "bundle.md").text;
  assert.deepEqual(stored.split("\n").slice(0, 2), ["---", `id: ${ok.bundleId}`]);
  assert.equal(stored.split("\n").filter((l) => l.startsWith("id:")).length, 2, "the minted line and the body's own");
  assert.ok(stored.endsWith("\nid: PROJ-2026-0002-y\n"), "the body is untouched");
  assert.equal(ok.bundleSha, sha(stored));
});

test("R16 (rec-181): CITED carries `to: retired` and every citing id; an edit of a cited item that keeps its state lands; the fact is read at the write", () => {
  const cites = {};
  const env = makePromotion({ citedBy: cites });
  const a = env.p.promote(create(ID, infoDoc(ID, { current_state: "verified" })));
  /* An edit that keeps a cited item's state is not a retirement: it lands. */
  cites[ID] = ["INQ-2026-0001"];
  const edit = env.p.promote(revise(ID, a.bundleSha, infoDoc(ID, { current_state: "verified", title: "Edited" })));
  assert.equal(edit.ok, true, JSON.stringify(edit));
  /* A move to retired while cited: CITED, naming the citers and the state asked for. */
  cites[ID] = ["INQ-2026-0001", "INQ-2026-0002"];
  const r = env.p.promote(revise(ID, edit.bundleSha, infoDoc(ID, { current_state: "retired", title: "Edited" }), { snapKey: "k3" }));
  assert.deepEqual([r.ok, r.reason, r.to, r.offenders], [false, "CITED", "retired", [{ id: ID, citedBy: ["INQ-2026-0001", "INQ-2026-0002"] }]]);
  /* The citation index is read at the write: once no edge cites the item, the same retirement lands. */
  cites[ID] = [];
  assert.equal(env.p.promote(revise(ID, edit.bundleSha, infoDoc(ID, { current_state: "retired", title: "Edited" }), { snapKey: "k4" })).ok, true);
});

test("R9 (inquiry): an inquiry's recorded title is the one its `## Question` derives, whatever the envelope's words for it", () => {
  const { p, record } = makePromotion();
  const Q = "INQ-2026-0001";
  const text = doc({ id: Q, object_type: "inquiry", current_state: "open", created: T0, last_updated: T0, group: "test-group" },
                   "\n## Question\n\nWhere did the sewer fund go?\n\n## Session Log\n");
  const r = p.promote(create(Q, text, { meta: { title: "Where did the sewer fund go?" } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(record.head(Q).title, "Where did the sewer fund go?");
  /* A document title that differs from its question: the record holds the question's. */
  const Q2 = "INQ-2026-0002";
  const t2 = doc({ id: Q2, object_type: "inquiry", title: "Old label", current_state: "open", created: T0, last_updated: T0, group: "test-group" },
                 "\n## Question\n\nWho approved the transfer?\n\n## Session Log\n");
  assert.equal(p.promote(create(Q2, t2)).ok, true);
  assert.equal(record.head(Q2).title, "Who approved the transfer?");
  /* With no question to derive from, the document's own title stands. */
  const Q3 = "INQ-2026-0003";
  assert.equal(p.promote(create(Q3, doc({ id: Q3, object_type: "inquiry", title: "A label", current_state: "open", created: T0,
                                            last_updated: T0, group: "test-group" }))).ok, true);
  assert.equal(record.head(Q3).title, "A label");
});

test("R30 (subresources; N631): C-20.1's mechanical envelope admits data/snapshot-manifest.json, and nothing written outside it; a file carried unchanged from the pre-image is not written", async () => {
  const hex = (s) => createHash("sha256").update(s).digest("hex");
  const md = (over = {}) => ["---", "id: INFO-2026-0001-a", "object_type: information", 'title: "A"', "current_state: collected",
    "prior_state: null", `created: "${T0}"`, `last_updated: "${over.lu || T0}"`, "state_history: []", "---", "", "## Session Log", ""].join("\n");
  /* `pre`, when given, is the bytes of `name` in k2's own pre-image snapshot (a file k1 held and k2 carried). */
  const image = (name, pre) => {
    const a = md(), b = md({ lu: T1 });
    const copy = pre === undefined ? {} : { [`_history/${name.replace(/(\.[^./]*)?$/, "_k2$1")}`]: pre };
    const img = { "bundle.md": b, "_history/bundle_k2.md": a, ...copy,
      "_history/promotion_k1.json": JSON.stringify({ base: hex(""), files: [{ name: "bundle.md", sha256: hex(a) }] }),
      "_history/promotion_k2.json": JSON.stringify({ base: hex(a), writer: "mechanical", operation: "monitor-tick",
        files: [{ name: "bundle.md", sha256: hex(b) }, { name, sha256: hex(name) }] }),
      "_history/manifest.json": JSON.stringify({ entries: [
        { key: "k1", kind: "promotion", base: hex(""), created: T0, files: ["bundle.md"], seq: 1 },
        { key: "k2", kind: "promotion", base: hex(a), created: T1, files: ["bundle.md", name], seq: 2,
          writer: "mechanical", operation: "monitor-tick" }] }) };
    return new Map(Object.entries(img));
  };
  const c201 = async (name, pre) => (await recordChecks({ folderName: "INFO-2026-0001-a", files: image(name, pre), sha256: async (v) => hex(v) }))
    .filter((f) => f.check === "C-20.1" && f.severity === "error").map((f) => f.message);
  for (const inside of [...MECHANICAL_APPEND_FILES, "snapshots/page.html"])
    assert.deepEqual(await c201(inside), [], inside);
  const outside = await c201("data/notes.json");
  assert.equal(outside.length, 1);
  assert.match(outside[0], /wrote 'data\/notes\.json', outside the mechanical envelope \(bundle\.md, snapshots\/, data\/changes\.json, data\/provenance\.json, data\/snapshot-manifest\.json\)/);
  /* N631: named in the entry but carried from k2's own pre-image unchanged (its copy hashes to what k2 recorded), so
     not written; changed from that copy, it was written. */
  assert.deepEqual(await c201("data/dataset.json", "data/dataset.json"), []);
  const changed = await c201("data/dataset.json", "{\"rows\":[]}");
  assert.equal(changed.length, 1);
  assert.match(changed[0], /wrote 'data\/dataset\.json', outside the mechanical envelope/);
});

test("R27 (ratify-envelope): a reference the corpus does not hold is the gate's C-6.2 error, and ok is false; the same reference held passes it", async () => {
  const { runGate } = await import("../../../src/promotion/index.mjs");
  const G = "INFO-2026-0001-report";
  const text = doc({ id: G, object_type: "information", schema: "information@1", title: "A report", current_state: "collected",
    prior_state: null, created: T0, last_updated: T0, group: "test-group" })
    .replace("group: test-group", "group: test-group\nreferences:\n  - target: INFO-2026-0404-gone\n    rel: cites\n    status: confirmed");
  const run = (known) => runGate({ bundleId: G, image: { "bundle.md": text }, knownIds: new Set(known), hasCapture: async () => ({ present: true }),
    registers: [] });
  const dangling = await run([G]);
  assert.equal(dangling.ok, false);
  assert.ok(dangling.findings.some((f) => f.check === "C-6.2" && /INFO-2026-0404-gone/.test(f.detail)), JSON.stringify(dangling.findings));
  const held = await run([G, "INFO-2026-0404-gone"]);
  assert.equal(held.findings.some((f) => f.check === "C-6.2"), false);
});
