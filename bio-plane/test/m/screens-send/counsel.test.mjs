/* screens-send R34: `counsel`, the packet for the team's lawyer, with the versions assembled for the action (the Screens page
 * deciding-and-acting, counsel C8, A2, A3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, drew, last, press, button, main, day, ok, refused, FILINGS, ACT, ACTION, READER, word, norm } from "./kit.mjs";

const PATH = "/app/counsel/" + ACTION;
const COUNSEL = { name: "A. Lawyer", organisation: "Lawyers LLP" };
const V = (o = {}) => ({ packet: "CPK-2026-0001", version: 1, purpose: "claim", counsel: COUNSEL, assembled_by: "mai", at: "2026-11-03T10:00:00Z",
  reason: "We may bring a claim.", template: null, basis_changed: null, exports: [], ...o });
/** filings' `counselpacket` answer: a claim packet whose one matter is not determined. */
const PACKET = (o = {}) => ({ ok: true, id: "CPK-2026-0001", version: 2, action: ACTION, purpose: "claim", marking: "Prepared for review by A. Lawyer, Lawyers LLP. Not legal advice. Not for filing.",
  sections: { facts: { title: "Facts", items: [{ claim: { conclusion: "The lease was renewed without a vote." }, determined: false }] } }, fileable: false, ...o });

test("R34: a claim packet sends the action, the reason and the purpose, and draws each matter with no defense section", async () => {
  const p = await open(PATH, { plane: { counselpacket: ok(PACKET()) } });
  await press(p, "counselpacket", { "cp-reason": "We may bring a claim." });
  const sent = last(p, "counselpacket");
  assert.equal(sent.body.action, ACTION);
  assert.equal(sent.body.purpose, "claim");
  assert.equal(sent.body.reason, "We may bring a claim.");
  assert.equal(sent.body.counsel, undefined, "no counsel named, none sent");
  assert.ok(text(p).includes("The lease was renewed without a vote."));
  assert.ok(drew(p, "screen.counsel.matters.undetermined"), "a matter not determined is drawn so, never stopping the packet");
  assert.ok(drew(p, "screen.counsel.marked.every"));
  assert.ok(!drew(p, "screen.counsel.defense.heading"), "a claim draws no defense section");
  assert.ok(!ops(p).some((o) => /publish/.test(o)), "the packet is never offered for publication");
});

test("R34: a defense names the challenged statement, and draws the pressure and each deadline, undetermined with why", async () => {
  const p = await open(PATH, { plane: { counselpacket: ok(PACKET({ purpose: "defence", sections: { facts: { items: [] },
    challenged: { items: [{ statement: "The council broke the lease.", findings: ["F1"], sources: [] }] }, pressure: { items: [{ at: "2026-10-20" }] },
    defence_deadlines: { items: [{ rule: "Answer to the complaint", date: null }] } } })) } });
  const purpose = p.doc.getElementById("cp-purpose");
  purpose.value = "defence"; p.fire(purpose, "change"); await p.settle();
  await press(p, "counselpacket", { "cp-reason": "We were threatened.", "cp-chal-1": "The council broke the lease.", "cp-name": COUNSEL.name, "cp-org": COUNSEL.organisation });
  const sent = last(p, "counselpacket").body;
  assert.equal(sent.purpose, "defence");
  assert.deepEqual(sent.challenged, [{ statement: "The council broke the lease." }]);
  assert.deepEqual(sent.counsel, { name: COUNSEL.name, organisation: COUNSEL.organisation });
  assert.ok(drew(p, "screen.counsel.defense.heading"));
  assert.ok(text(p).includes("Answer to the complaint"));
  assert.ok(drew(p, "screen.counsel.defense.undetermined"));
  assert.ok(text(p).includes(norm(day("2026-10-20"))));
});

test("R34: naming counsel is required at tier 3 or undetermined, optional at 1 or 2", async () => {
  for (const [tier, key] of [[1, "optional"], [2, "optional"], [3, "required"], [null, "required"], ["undetermined", "required"]]) {
    const p = await open(PATH, { plane: { action: ok(ACT({ risk_tier: tier })) } });
    assert.ok(drew(p, "screen.counsel.who." + key), `tier ${tier}: ${key}`);
    assert.ok(!drew(p, "screen.counsel.who." + (key === "required" ? "optional" : "required")));
  }
});

test("R34: a member who may read and not act may read a version, and is offered no assembling and no saving", async () => {
  const p = await open(PATH, { plane: { whoami: ok(READER), filingsfor: ok(FILINGS([], [V()])) } });
  assert.deepEqual(ops(p), ["counselpacketread"]);
});

test("R34 (C8): the versions assembled are listed newest first, each with who, when, for whom, the reason and each saving", async () => {
  const older = V({ version: 1, at: "2026-11-01T10:00:00Z", reason: "First look.", exports: [{ exported_by: "mai", at: "2026-11-02T09:00:00Z", counsel: COUNSEL, sha: "ab" }] });
  const newer = V({ version: 2, at: "2026-11-03T10:00:00Z", reason: "After the reply." });
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [older, newer])) } });
  assert.ok(drew(p, "screen.counsel.made.head") && drew(p, "screen.counsel.made.lead") && drew(p, "screen.counsel.export.note"));
  const rows = main(p).querySelectorAll("[data-packet-version]").map((e) => e.getAttribute("data-packet-version"));
  assert.deepEqual(rows, ["CPK-2026-0001~2", "CPK-2026-0001~1"]);
  assert.ok(drew(p, "screen.counsel.made.by", { who: "mai", date: day(newer.at), counsel: COUNSEL.name, organization: COUNSEL.organisation }));
  assert.ok(text(p).includes("After the reply.") && text(p).includes("First look."));
  assert.ok(drew(p, "screen.counsel.made.exported", { who: "mai", date: day("2026-11-02"), counsel: COUNSEL.name }));
  assert.equal(main(p).querySelectorAll('button[data-act="counselpacketread"]').length, 2);
  assert.equal(main(p).querySelectorAll('button[data-act="counselpacketexport"]').length, 2);
});

test("R34 (C8): a version with no counsel named, or with no organization, is drawn without inventing either", async () => {
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V({ counsel: null }), V({ version: 2, counsel: { name: "B. Advocate" } })])) } });
  assert.ok(drew(p, "screen.counsel.made.by.noorg", { who: "mai", date: day("2026-11-03"), counsel: "B. Advocate" }));
  const bare = main(p).querySelector('[data-packet-version="CPK-2026-0001~1"]');
  assert.ok(text(p, bare).includes("mai") && !text(p, bare).includes(norm(word("screen.counsel.made.by.noorg", { who: "mai", date: day("2026-11-03"), counsel: "" }))));
});

test("R34 (C8): a version whose determination was superseded says the record changed since it", async () => {
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V({ basis_changed: { causes: [{ cause: "determination_superseded", determination: "DET-2026-0004" }] } })])) } });
  assert.ok(drew(p, "screen.counsel.made.changed", { n: "1", what: word("filings.determination_superseded", { determination: "DET-2026-0004", then: "" }) }));
  const q = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V()])) } });
  assert.equal(main(q).querySelector("[data-changed]"), null, "nothing changed, nothing said");
});

test("R34 (C8): \"Read this version\" asks for that version and draws its sections and their marking; it changes nothing", async () => {
  const read = { ok: true, id: "CPK-2026-0001", version: 1, action: ACTION, marking: "Prepared for review by A. Lawyer, Lawyers LLP. Not legal advice. Not for filing.",
    sections: { facts: { title: "The matters", marking: "Prepared for review by A. Lawyer.", text: "One matter, not determined." } }, exports: [] };
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V()])), counselpacketread: ok(read) } });
  await press(p, "counselpacketread");
  assert.deepEqual(last(p, "counselpacketread").query, { op: "counselpacketread", id: "CPK-2026-0001", version: "1" });
  const shown = main(p).querySelector("[data-read]");
  assert.ok(shown, "the version is drawn in its place");
  assert.ok(text(p, shown).includes("The matters") && text(p, shown).includes("One matter, not determined."));
  assert.ok(drew(p, "screen.counsel.sections.marking", { counsel: "A. Lawyer, Lawyers LLP" }, shown));
  assert.equal(p.byOp("counselpacketexport").length + p.byOp("counselpacket").length, 0, "reading writes nothing");
});

test("R34 (C8): a version that cannot be read is refused by its words and draws nothing in its place", async () => {
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V()])), counselpacketread: refused("NO_SUCH_PACKET", "Nothing is here.") } });
  await press(p, "counselpacketread");
  assert.equal(main(p).querySelector("[data-read]"), null);
});

test("R34 (C8): \"Save as a file\" sends that version, reads the list again, and hands the member the marked file to save", async () => {
  let listed = 0;
  const bytes = "# Counsel packet CPK-2026-0001, version 1\n\nPrepared for review by A. Lawyer, Lawyers LLP. Not legal advice. Not for filing.\n";
  const p = await open(PATH, { plane: { filingsfor: () => { listed++; return ok(FILINGS([], [V()])); },
    counselpacketexport: ok({ ok: true, id: "CPK-2026-0001", version: 1, action: ACTION, format: "text/markdown", bytes, sha: "cd", fileable: false }) } });
  const before = listed;
  await press(p, "counselpacketexport");
  assert.deepEqual(last(p, "counselpacketexport").body, { id: "CPK-2026-0001", version: 1 });
  assert.ok(listed > before, "the list is read again, so the saving is shown");
  const save = main(p).querySelector("[data-saved] button");
  assert.ok(save, "the save control is drawn beside the version");
  await p.click(save);
  const file = p.files.at(-1);
  assert.equal(file.name, "CPK-2026-0001-1.md");
  assert.equal(await file.blob.text(), bytes);
});

test("R34 (C8): an export the plane refuses saves nothing", async () => {
  const p = await open(PATH, { plane: { filingsfor: ok(FILINGS([], [V()])), counselpacketexport: refused("MACHINE_CANNOT_EXPORT", "Only a member hands a packet to counsel.") } });
  const b = button(p, "counselpacketexport");
  await press(p, "counselpacketexport");
  assert.ok(b);
  assert.equal(main(p).querySelector("[data-saved]"), null);
  assert.equal(p.files.length, 0);
});

test("R34 (C8): with the list not read, the packet can still be assembled", async () => {
  const p = await open(PATH, { plane: { filingsfor: refused("NO_SUCH_ACTION", "Nothing is here.") } });
  assert.ok(ops(p).includes("counselpacket"));
  assert.equal(main(p).querySelectorAll("[data-packet-version]").length, 0);
});
