/* Settings › Who your group is at the module's interface (R14, and R11 over its draft). Over the world (store-request): the group's description is
   made by the real act that records it, and the expectations are read back from what the owners answer, never copied from a literal. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, has, lacks, open, said } from "./kit.mjs";
import { team, holdKey, SEAL, DESCRIPTION_DRAFT } from "./seed-group.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
const DESCRIBED = { kinds: ["community", "other"], otherKind: "a tenants' union", focus: "Street repair on Seminary.", purpose: "We keep the city to its word.", visibility: "members" };
/** A team that has said who it is, with the assistant reachable when it holds its own key (the real acts). */
async function described({ reachable = false } = {}) {
  const t = await team(reachable ? { env: { ACCOUNT_SEAL_SECRET: SEAL } } : {});
  await t.rosa.act("groupdescriptionset", { body: DESCRIBED });
  if (reachable) await holdKey(t.founder, t.w);
  return t;
}

test("R14 group-identity: reads groupdescription (the whole record) and groupidentity; every member reads it; only an administrator is drawn the acts", async () => {
  const t = await described({ reachable: true });
  const { w, rosa, dev } = t;
  const d = (await rosa.read("groupdescription")).description;
  assert.deepEqual([d.focus, d.purpose, d.otherKind, d.visibility], [DESCRIBED.focus, DESCRIBED.purpose, DESCRIBED.otherKind, DESCRIBED.visibility], "the record holds what was said");
  const a = await open("group-identity", { world: w, as: rosa, table: { groupdescriptiondraft: () => DESCRIPTION_DRAFT(rosa) } });
  assert.ok(a.p.all.some((r) => r.op === "groupdescription") && a.p.all.some((r) => r.op === "groupidentity"));
  assert.ok(a.text.includes(d.focus) && a.text.includes(d.purpose) && a.text.includes(d.otherKind));
  has(a, "screen.group-identity.visibility.members");
  assert.deepEqual(ops(a), ["groupdescriptiondraft", "groupdescriptionset"]);
  const m = await open("group-identity", { world: w, as: dev });
  assert.deepEqual(ops(m), [], "a member is drawn no act");
  assert.ok(m.text.includes(d.focus));
  // the draft only while the assistant is reachable (interface-shell R20)
  const off = await described();
  assert.deepEqual(ops(await open("group-identity", { world: off.w, as: off.rosa })), ["groupdescriptionset"]);
  const bare = await team();   // a group that has not said who it is
  assert.equal((await bare.rosa.read("groupdescription")).description, null);
  lacks(await open("group-identity", { world: bare.w, as: bare.rosa }), "screen.group-identity.none"); // R28: a group that has not said who it is is told nothing of it
});

test("R14 groupdescriptionset sends the whole record: kinds, the other kind, focus, purpose and who sees it", async () => {
  const t = await described();
  const a = await open("group-identity", { world: t.w, as: t.rosa });
  const r = await a.press("groupdescriptionset", { values: { "gi-k-issue": true, "gi-k-community": false, "gi-k-other": false, "gi-other": "", "gi-focus": "Repair.", "gi-purpose": "Accountability.", "gi-v-public": true } });
  assert.deepEqual(r.sent[0].body, { kinds: ["issue"], visibility: "public", focus: "Repair.", purpose: "Accountability." });
  const d = (await t.rosa.read("groupdescription")).description;
  assert.deepEqual([d.kinds, d.visibility, d.focus, d.purpose], [["issue"], "public", "Repair.", "Accountability."], "the owner holds the whole record");
});

test("R14 groupdescriptiondraft: the draft filled into the focus and purpose fields, labeled the assistant's, kept only by the administrator's own save; R11 untested beside it only when the answer carries it", async () => {
  const t = await described({ reachable: true });
  const { w, rosa, founder } = t;
  const asker = rosa.handle;   // the draft is asked in her name (WORLD GAP: the door asks no draft; the answer is the platform's, seed-group)
  const draft = DESCRIPTION_DRAFT(rosa).result;
  const a = await open("group-identity", { world: w, as: rosa, table: { groupdescriptiondraft: () => DESCRIPTION_DRAFT(rosa) } });
  const r = await a.press("groupdescriptiondraft", { values: { "gi-q-what": "We track potholes." } });
  assert.deepEqual(r.sent.filter((x) => x.op !== "memberlist").map((x) => [x.op, x.body]), [["groupdescriptiondraft", { answers: [{ question: "what", text: "We track potholes." }] }]], "nothing is saved (the roster is read for the name of who asked)");
  assert.equal(a.b.doc.getElementById("gi-focus").value, draft.focus.text);
  assert.equal(a.b.doc.getElementById("gi-purpose").value, draft.purpose.text);
  assert.equal((await rosa.read("groupdescription")).description.focus, DESCRIBED.focus, "the record is as it was");
  has(a, "screen.group-identity.draft.label", { handle: asker });
  lacks(a, "ai.label.untested");
  await a.press("groupdescriptionset", {});
  assert.equal((await rosa.read("groupdescription")).description.focus, draft.focus.text, "kept by her own save");
  lacks(a, "screen.group-identity.draft.label", { handle: asker });
  const empty = await a.press("groupdescriptiondraft", { values: { "gi-q-what": "", "gi-q-who": "", "gi-q-why": "" } });
  assert.deepEqual(empty.sent, []);
});

/* R58 (T51; DEC-331 (2), DEC-336 (1), DEC-338): the team's short name is not asked for; the screen says once whether it was recorded */
test("R58 with a recorded group group-identity says once, above its title, that the short name was recorded at installation, and draws no field or act for a short name, to an administrator and to a member", async () => {
  const t = await described();
  assert.ok((await t.rosa.read("groupidentity")).group, "the installation recorded the team's short name");
  for (const me of [t.rosa, t.dev]) {
    const a = await open("group-identity", { world: t.w, as: me });
    assert.equal(a.text.split(said("screen.group-identity.seed.recorded")).length, 2, "said once");
    lacks(a, "screen.group-identity.seed.unrecorded");
    assert.ok(a.html.indexOf(said("screen.group-identity.seed.recorded").slice(0, 20)) < a.html.indexOf("<h1"), "above its title");
    assert.ok(!ops(a).includes("instancegroupseed"), "no act for it");
    assert.ok(!all(a.tree, (e) => e.tag === "input" && /short|seed/i.test(e.attrs.id || "")).length, "no field for it");
    assert.ok(!a.p.all.some((r) => r.op === "instancegroupseed"), "nothing of the sort is sent");
  }
});

test("R58 for an older installation answering group null it says the short name is not recorded yet, in its own state, and draws no field", async () => {
  const t = await team({ instanceName: null });   // an installation that recorded no producing team
  await t.founder.act("groupnameset", { body: { name: "East Oakland Watch" } });
  const id = await t.rosa.read("groupidentity");
  assert.equal(id.group, null);
  const a = await open("group-identity", { world: t.w, as: t.rosa });
  has(a, "screen.group-identity.seed.unrecorded");
  lacks(a, "screen.group-identity.seed.recorded");
  assert.ok(!ops(a).includes("instancegroupseed"));
  // control: a read that did not answer says neither
  const none = await open("group-identity", { world: t.w, as: t.rosa, table: { groupidentity: "none" } });
  lacks(none, "screen.group-identity.seed.recorded"); lacks(none, "screen.group-identity.seed.unrecorded");
});

/* ---- T51 fix round 2: C87 ---- */

test("R14 C87: Save who your team is with nothing ticked or written sends nothing and names the box; written, it sends (control)", async () => {
  const t = await team();   // it has said nothing yet
  const a = await open("group-identity", { world: t.w, as: t.rosa });
  const r = await a.press("groupdescriptionset", { values: { "gi-k-issue": false, "gi-k-community": false, "gi-k-other": false, "gi-focus": "  ", "gi-purpose": "" } });
  assert.deepEqual(r.sent, []);
  assert.equal(a.refused.text, said("shell.field.needed", { field: said("screen.group-identity.focus.field") }), a.refused && a.refused.text);
  assert.equal((await t.rosa.read("groupdescription")).description, null, "nothing was recorded");
  // a kind alone, or one text box alone, is something to save
  assert.deepEqual((await a.press("groupdescriptionset", { values: { "gi-k-issue": true } })).sent[0].body.kinds, ["issue"]);
  assert.equal((await a.press("groupdescriptionset", { values: { "gi-k-issue": false, "gi-purpose": "Accountability." } })).sent[0].body.purpose, "Accountability.");
  assert.equal((await t.rosa.read("groupdescription")).description.purpose, "Accountability.");
});

/* ---- T51 fix round 3: C87 (c) (R14): an empty box is refused before the reason is asked ---- */

test("R14 C87 (c): Save who your team is with an empty box names the box and asks for no reason first; with the box filled the reason is asked (control)", async () => {
  const t = await team();
  const a = await open("group-identity", { world: t.w, as: t.rosa });
  // the reason is left unanswered: if the shell asked it first, the refusal would never be drawn
  const r = await a.press("groupdescriptionset", { reason: null, values: { "gi-k-issue": false, "gi-k-community": false, "gi-k-other": false, "gi-other": "", "gi-focus": "  ", "gi-purpose": "" } });
  assert.deepEqual(r.sent, [], "nothing is sent");
  assert.equal(r.asked, false, "no reason box is drawn for an empty box");
  assert.equal(a.refused.text, said("shell.field.needed", { field: said("screen.group-identity.focus.field") }), a.refused && a.refused.text);
  // control: a box filled, the act is asked as the shell asks it of an administrator's act, and sends once the reason is given
  const filled = await a.press("groupdescriptionset", { values: { "gi-focus": "Repair." } });
  assert.equal(filled.sent.filter((x) => x.op === "groupdescriptionset").length, 1);
});

test("R14 C87 (c) (interface-shell R119): the other reasoned acts with a required box refuse an empty one before any reason is asked, and send nothing", async () => {
  const t = await team({ env: { ACCOUNT_SEAL_SECRET: SEAL } });
  const cases = [
    ["members", "memberadd", {}],
    ["members", "websitekeycreate", { "mw-cap": "" }],
    ["group", "groupnameset", { "gr-name": " " }],
    ["group", "hostingaccessset", { "gr-holders": "" }],
    ["teamai", "groupkeyset", {}],
  ];
  for (const [screen, op, values] of cases) {
    const o = await open(screen, { world: t.w, as: t.founder });
    const r = await o.press(op, { reason: null, values });
    assert.equal(r.asked, false, `${op}: no reason box`);
    assert.deepEqual(r.sent, [], `${op}: nothing sent`);
    assert.ok(o.refused, `${op}: refused beside the act`);
  }
});
