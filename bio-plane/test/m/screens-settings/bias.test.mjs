/* Settings › Declared bias at the module's interface (R65): the lens in force, writing and adopting a set, drafting one from an outside
   policy, and work made under an earlier lens, over the world (store-request): the sets are written, offered and adopted by the real acts
   of members, the work under an earlier lens is a real finding whose project's lens then changed, and what the tests expect is read back
   from the owners' answers (bias R11–R21, R35, R36). */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, day, has, lacks, open, said, squash, textOf, SCREENS } from "./kit.mjs";
import { env } from "./fixtures.mjs";
import { SEAL, holdKey, biasTeam, subjectNamed, writeSet, adoptSet, debtOf } from "./seed-places.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
const part = (o, name) => all(o.tree, (e) => e.attrs["data-part"] === name)[0];
const req = (o, op) => o.p.requests.filter((r) => r.op === op);
const rows = (n) => all(n, (e) => /cs-row/.test(e.attrs.class || ""));
const lensOf = (as, scopeId = null) => as.read("biasmanifest", { query: scopeId ? { scope: "project", scopeId } : { scope: "instance" } });
const proposed = async (as) => (await as.read("list", { query: { type: "bias", state: "proposed", limit: "50" } })).bundles;
const projectsOf = async (as) => (await as.read("projectlist")).projects;
const everyProposed = async (as) => { const out = []; let after = null; do { const r = await as.read("list", { query: { type: "bias", state: "proposed", limit: "50", ...(after ? { after } : {}) } }); out.push(...r.bundles); after = r.cursor; } while (after); return out; };
const titleOf = (p) => p.title || p.name;
const short = (sha) => sha.slice(0, 4) + "…" + sha.slice(-4);
const settle = async (o) => { for (let i = 0; i < 6; i++) await o.b.settle(80); o.redraw(); };
/** The team's set in force for the whole team (written, offered, adopted by the founder). */
async function teamLens(t, over = {}) {
  const set = await writeSet(t.w, t.founder, { title: "Team set", subject: t.dept, text: "We read the Department's own reports closely, because it reports on its own conduct.", why: "It writes the figures it is judged by.", upTo: "adopted", ...over });
  await adoptSet(t.founder, set.bundleId, "We agreed.");
  return set;
}
const WRITE = (t, over = {}) => ({ "bi-name": "S", "bi-subject": t.dept, "bi-text": "T", "bi-why": "W", "bi-not": "N", ...over });

test("R65 bias lists exactly its registry acts (the red contract test holds it), and nothing is sent by drawing it beyond the lens and the projects", async () => {
  const s = SCREENS.find((x) => x.id === "bias");
  assert.deepEqual(s.acts.map((a) => a.op).sort(), ["biasadopt", "biasdebt", "biasdebtresolve", "biasinhale", "biasmanifest", "promote", "writinghelp"]);
  const t = await biasTeam();
  const a = await open("bias", { world: t.w, as: t.founder });
  assert.deepEqual(a.p.requests.map((r) => r.op).filter((op) => !["assistantstate", "aipathready"].includes(op)).sort(), ["biasmanifest", "list", "projectlist"]);
  assert.deepEqual(req(a, "list")[0].query, { type: "bias", state: "proposed", limit: "50" }, "only the bias sets, as `list` declares");
  assert.deepEqual(req(a, "biasmanifest")[0].query, { scope: "instance" });
});

test("R65 the lens in force for the whole team: each statement's kind, subject, text and reason, who adopted and when, what the set does not enforce, and the lens's number; no empty lens", async () => {
  const t = await biasTeam();
  await teamLens(t);
  const lens0 = await lensOf(t.founder), st = lens0.statements[0], b0 = lens0.bundles[0];
  const a = await open("bias", { world: t.w, as: t.founder });
  has(a, "screen.bias.the_lens_your_team_reads"); has(a, "screen.bias.it_never_blocks_work");
  const lens = part(a, "lens");
  const text = squash(textOf(lens));
  const B = "screen.bias.";
  assert.ok(text.includes(said(B + "kind." + st.kind)) && text.includes(said(B + "row.about", { subject: st.subject })) && text.includes(st.text) && text.includes(said(B + "row.why", { reason: st.justification })));
  has(a, B + "head.team"); has(a, B + "lens.label"); has(a, B + "lens.team"); has(a, B + "link.write"); has(a, B + "link.draft");
  assert.ok(text.includes(said(B + "dt.lens")) && text.includes(said(B + "by_admin_for_the_team.team", { admin: t.founder.handle, date: day(b0.adopted_at) })), "who adopted it and when, for the team");
  assert.ok(text.includes(said("screen.bias.what_this_set_does_not")) && text.includes(lens0.residue[0].text));
  assert.ok(text.includes(short(lens0.statements_sha)) && text.includes(said("screen.bias.the_same_lens_gives_the")));
  has(a, "screen.bias.to_adopt_write_or_draft"); has(a, "screen.bias.your_queue_tells_you_when");
  lacks(a, "screen.bias.when_a_project_statement_meets"); lacks(a, "screen.bias.when_an_adopted_set_is");
  assert.ok(ops(a).includes("biasmanifest"));
  assert.equal(rows(lens).length, 1);
});

test("R65 choosing a project and asking for its lens sends scope and scopeId and draws the team's statements then the project's; a project with nothing in force says so and what a case published now says, never an empty lens", async () => {
  const t = await biasTeam();
  await teamLens(t);
  const proj = await writeSet(t.w, t.dev, { title: "Project set", subject: t.dept, text: "A late reply to a request is not read as a refusal.", why: "Offices miss dates for many reasons.", upTo: "adopted", id: "p1" });
  await adoptSet(t.dev, proj.bundleId, "For this project.", t.project);   // the project's owner adopts it
  const other = await t.w.recipes.project(t.founder, "Other");
  const lens0 = await lensOf(t.founder, t.project);
  assert.equal(lens0.statements.length, 2);
  const a = await open("bias", { world: t.w, as: t.founder });
  const r = await a.press("biasmanifest", { choose: { "bi-scope": t.project } });
  assert.deepEqual(r.sent[0].query, { scope: "project", scopeId: t.project });
  assert.deepEqual(req(a, "biasmanifest").at(-1).query, { scope: "project", scopeId: t.project }, "read again for that project");
  const text = squash(textOf(part(a, "lens")));
  assert.ok(text.indexOf(lens0.statements[0].text) >= 0 && text.indexOf(lens0.statements[0].text) < text.indexOf(lens0.statements[1].text), "the team's, then the project's");
  assert.equal(rows(part(a, "lens")).length, 2);
  const mine = (await projectsOf(t.founder)).find((p) => p.id === t.project);
  has(a, "screen.bias.in_force_for_the_coliseum", { project: titleOf(mine) });
  assert.ok(text.includes(said("screen.bias.row.project")), "a project's own statement is marked");
  const [teamB, projB] = [lens0.bundles.find((b) => b.scope === "instance"), lens0.bundles.find((b) => b.scope === "project")];
  assert.ok(text.includes(said("screen.bias.by_admin_for_the_team", { admin: t.founder.handle, admin_date: day(teamB.adopted_at), owner: t.dev.handle, owner_date: day(projB.adopted_at) })), "both adoptions, the team's and the project's");
  // a project nothing is in force for
  assert.equal((await lensOf(t.founder, other)).in_force, true, "the team's lens stands under it");
  const none = await open("bias", { world: t.w, as: t.founder });
  await none.press("biasmanifest", { choose: { "bi-scope": other } });
  const quiet = await biasTeam();   // a team with no lens at all: a project with nothing in force
  const q = await quiet.w.recipes.project(quiet.founder, "Other");
  assert.equal((await lensOf(quiet.founder, q)).in_force, false);
  const nothing = await open("bias", { world: quiet.w, as: quiet.founder });
  await nothing.press("biasmanifest", { choose: { "bi-scope": q } });
  has(nothing, "screen.bias.no_lens_is_in_force", { project: "Other" }); has(nothing, "screen.bias.a_case_published_now_says");
  assert.equal(rows(part(nothing, "lens")).length, 0, "no empty lens is drawn");
});

test("R65 the folds: a project statement that met a locked one, and a set adopted while only offered, each only when the owner says so", async () => {
  const t = await biasTeam();
  await teamLens(t, { locked: true });
  const over = await writeSet(t.w, t.dev, { title: "Override", subject: t.dept, text: "We do not read it closely.", why: "w", upTo: "adopted", id: "p1", nullifies: "s1" });
  await adoptSet(t.dev, over.bundleId, "Override.", t.project);
  const offered = await t.w.recipes.project(t.founder, "Offered only");
  await adoptSet(t.founder, (await writeSet(t.w, t.founder, { title: "Only offered", subject: t.dept, text: "Offered text.", why: "w", upTo: "proposed", id: "p2" })).bundleId, "Offered.", offered);
  assert.equal((await lensOf(t.founder, t.project)).lock_violations.length, 1);
  assert.equal((await lensOf(t.founder, offered)).pins_proposed.length, 1);
  const a = await open("bias", { world: t.w, as: t.founder });
  await a.press("biasmanifest", { choose: { "bi-scope": t.project } });
  has(a, "screen.bias.when_a_project_statement_meets"); has(a, "screen.bias.a_project_statement_that_replaces"); has(a, "screen.bias.the_page_lists_it_so");
  lacks(a, "screen.bias.when_an_adopted_set_is");
  const b = await open("bias", { world: t.w, as: t.founder });
  await b.press("biasmanifest", { choose: { "bi-scope": offered } });
  has(b, "screen.bias.when_an_adopted_set_is"); has(b, "screen.bias.a_set_that_was_adopted"); has(b, "screen.bias.this_page_then_lists_it");
  lacks(b, "screen.bias.when_a_project_statement_meets");
  // a lens that cannot be computed (the owner's answer with its force unsaid) is drawn failed; derived from the world's own answer
  const bad = await open("bias", { world: t.w, as: t.founder, table: { biasmanifest: async (qy) => env({ ...(await lensOf(t.founder, qy.scopeId || null)), in_force: null }) } });
  assert.ok(all(bad.tree, (e) => e.attrs["data-state"] === "failed").length >= 1, "a lens that cannot be computed is drawn failed");
});

test("R65 writing a set: the bundle promote takes (a bias bundle offered), the subject resolved from its name, the guard accepts it; a name the record does not know is refused in place; then the saved set can be adopted for the team or a project with the member's reason", async () => {
  const t = await biasTeam({ env: SEAL });
  await holdKey(t.w, t.founder);
  const mine = await t.w.recipes.project(t.founder, "Founder's project");
  const other = await subjectNamed(t.founder, "Another Office");
  const a = await open("bias", { world: t.w, as: t.founder });
  lacks(a, "screen.bias.why_you_adopt_it");
  for (const k of ["head.write", "kind.label", "statement.label", "cites.label"]) has(a, "screen.bias." + k);
  const values = { "bi-name": "Lakeshore Tenants: how we read the city", "bi-subject": "City Housing Department", "bi-text": "We read the Department's own reports closely.", "bi-why": "It writes the figures it is judged by.", "bi-not": "It sets no bar and rules no source false." };
  const r = await a.press("promote", { data: { from: "write" }, values });
  const sent = r.sent.find((x) => x.op === "promote");
  assert.equal(sent.body.base, null);
  assert.match(sent.body.bundleId, /^BIAS-\d{4}-\d{4}-lakeshore-tenants-how-we-read-the-city$/, "the set is kept under an id the record mints");
  assert.match(sent.body.snapKey, /^\d{8}T\d{6}Z_[0-9a-f]{8}$/);
  assert.deepEqual([sent.body.meta.object_type, sent.body.meta.current_state, sent.body.meta.title], ["bias", "proposed", values["bi-name"]]);
  assert.equal(sent.body.files.length, 1);
  const text = sent.body.files[0].text;
  for (const must of ["object_type: bias", "current_state: proposed", `title: ${JSON.stringify(values["bi-name"])}`, `subject: ${JSON.stringify(t.dept)}`, `kind: "scrutiny"`, `text: ${JSON.stringify(values["bi-text"])}`, `justification: ${JSON.stringify(values["bi-why"])}`, "## What This Does Not Enforce", values["bi-not"]]) assert.ok(text.includes(must), must);
  assert.ok(r.sent.some((x) => x.op === "entitybyalias" && x.query.alias === "City Housing Department"), "the subject is looked up by its name");
  assert.ok((await proposed(t.founder)).some((b) => b.bundle_id === sent.body.bundleId && b.title === values["bi-name"]), "the record holds it, offered");
  // an unknown name is refused in place and nothing is saved
  const before = (await proposed(t.founder)).length;
  const unknown = await a.press("promote", { data: { from: "write" }, values: { ...values, "bi-subject": "Nobody Knows" } });
  assert.deepEqual(unknown.sent.filter((x) => x.op === "promote"), []);
  assert.equal(a.refused.key, "screen.bias.add_it_under_people_first");
  assert.equal((await proposed(t.founder)).length, before);
  // a registry key typed as it is needs no lookup
  const key = await a.press("promote", { data: { from: "write" }, values: { ...values, "bi-name": "Second set", "bi-subject": other, "bi-kind": "inference" } });
  assert.ok(key.sent.find((x) => x.op === "promote").body.files[0].text.includes(`subject: ${JSON.stringify(other)}`) && !key.sent.some((x) => x.op === "entitybyalias"));
  const saved = (await proposed(t.founder)).find((b) => b.title === "Second set");
  // the set saved this sitting can be adopted: the whole team, then one project, each with its reason
  has(a, "screen.bias.why_you_adopt_it"); has(a, "screen.bias.head.adopt"); has(a, "screen.bias.adoptfor.label"); has(a, "screen.bias.the_whole_team_an_administrator"); has(a, "screen.bias.one_project_the_coliseum_lease", { project: titleOf((await projectsOf(t.founder))[0]) });
  const team = await a.press("biasadopt", { values: { "bi-adwhy": "  We agreed in the meeting.  " } });
  assert.deepEqual([team.sent[0].op, team.sent[0].query, team.sent[0].body], ["biasadopt", { bundleId: saved.bundle_id, scope: "instance" }, { reason: "We agreed in the meeting." }]);
  assert.equal(team.asked, false, "the reason is the member's own field: the shell asks none");
  assert.deepEqual((await lensOf(t.founder)).pins_proposed.map((p) => p.bundle_id), [saved.bundle_id], "the world holds the adoption (the set was only offered)");
  const index = (await projectsOf(t.founder)).findIndex((p) => p.id === mine) + 1;
  const proj = await a.press("biasadopt", { values: { ["bi-adopt-" + index]: true, "bi-adwhy": "For this project." } });
  assert.deepEqual([proj.sent[0].query, proj.sent[0].body], [{ bundleId: saved.bundle_id, scope: "project", scopeId: mine }, { reason: "For this project." }]);
  assert.ok((await lensOf(t.founder, mine)).pins_proposed.some((p) => p.scope === "project" && p.bundle_id === saved.bundle_id), "and the project's");
  // no reason, or one too long, sends nothing
  assert.deepEqual((await a.press("biasadopt", { values: { "bi-adwhy": "" } })).sent, []);
  assert.deepEqual((await a.press("biasadopt", { values: { "bi-adwhy": "x".repeat(2001) } })).sent, []);
});

test("R65 the team's earlier offered sets are listed and adoptable without writing them again: the cursor is followed, the set just saved comes first, a set of another type or already adopted is not listed, an empty answer draws no list", async () => {
  const t = await biasTeam({ env: SEAL });
  await holdKey(t.w, t.founder);
  for (let i = 0; i < 52; i++) await writeSet(t.w, t.founder, { title: "Offered set " + String(i).padStart(2, "0"), subject: t.dept, text: "Statement " + i, why: "Because " + i });
  const adopted = await teamLens(t, { title: "Already adopted" });   // an adopted set is not offered any more
  const first = await t.founder.read("list", { query: { type: "bias", state: "proposed", limit: "50" } });
  const second = await t.founder.read("list", { query: { type: "bias", state: "proposed", limit: "50", after: first.cursor } });
  assert.ok(first.cursor && !second.cursor, "the owner pages them, 50 and the rest");
  const owned = [...first.bundles, ...second.bundles];
  assert.equal(owned.length, 52);
  assert.ok(!owned.some((b) => b.bundle_id === adopted.bundleId), "the owner lists no adopted set");
  const a = await open("bias", { world: t.w, as: t.founder });
  await settle(a);
  const asked = [...new Set(req(a, "list").map((r) => JSON.stringify(r.query)))].map((x) => JSON.parse(x));
  assert.deepEqual(asked, [{ type: "bias", state: "proposed", limit: "50" }, { type: "bias", state: "proposed", limit: "50", after: first.cursor }], "the next page is read by the cursor, each page once");
  assert.equal(req(a, "list").filter((r) => r.query.after).length, 1, "a page is read once and kept");
  const adopt = part(a, "adopt");
  const text = squash(textOf(adopt));
  assert.ok(text.includes(owned[0].title) && text.includes(day(owned[0].last_updated)) && text.includes(owned[51].title), "both pages' sets, with when they were last written");
  assert.ok(!text.includes("Already adopted"), "an adopted set is not listed");
  assert.equal(all(adopt, (e) => e.attrs.name === "bi-set").length, 52);
  // adopting an earlier one: its bundle id, the scope and the member's reason
  const firstPress = await a.press("biasadopt", { values: { "bi-adwhy": "The first." } });
  assert.equal(firstPress.sent[0].query.bundleId, owned[0].bundle_id, "the first listed is the one chosen unless another is");
  const r = await a.press("biasadopt", { values: { "bi-set-1": true, "bi-adwhy": "We offered it last week." } });
  assert.deepEqual([r.sent[0].query, r.sent[0].body], [{ bundleId: owned[1].bundle_id, scope: "instance" }, { reason: "We offered it last week." }]);
  // the set just saved comes first
  const b = await open("bias", { world: t.w, as: t.founder });
  await settle(b);
  await b.press("promote", { data: { from: "write" }, values: WRITE(t, { "bi-name": "Saved now", "bi-text": "T" }) });
  const saved = (await everyProposed(t.founder)).find((x) => x.title === "Saved now");
  const pressed = await b.press("biasadopt", { values: { "bi-adwhy": "Now." } });
  assert.equal(pressed.sent[0].query.bundleId, saved.bundle_id);
  // control: an empty answer draws no list and no adoption
  const empty = await biasTeam({ env: SEAL });
  await holdKey(empty.w, empty.founder);
  const none = await open("bias", { world: empty.w, as: empty.founder });
  assert.ok(!part(none, "adopt")); lacks(none, "screen.bias.why_you_adopt_it");
  // control: a list that cannot be read is drawn failed, never as no sets
  const bad = await open("bias", { world: empty.w, as: empty.founder, table: { list: "none" } });
  assert.ok(!part(bad, "adopt") && all(part(bad, "write"), (e) => e.attrs["data-state"] === "failed").length === 1);
});

test("R65 a refusal is drawn by the owner's words beside the act, and nothing else changes; a set with no name or no reason is not sent", async () => {
  const t = await biasTeam();
  const a = await open("bias", { world: t.w, as: t.founder });
  const values = WRITE(t);
  const before = (await proposed(t.founder)).length;
  const r = await a.press("promote", { data: { from: "write" }, values: { ...values, "bi-text": "Everything the Gazette prints is false." } });   // a verdict: the owner refuses it (bias R31)
  assert.ok(r.refused && a.refused.key === "refusal.BIAS_REFUSED" && a.refused.text.includes(said("refusal.BIAS_REFUSED")), JSON.stringify(a.refused));
  assert.equal((await proposed(t.founder)).length, before, "nothing was saved");
  assert.deepEqual((await a.press("promote", { data: { from: "write" }, values: { ...values, "bi-name": "" } })).sent.filter((x) => x.op === "promote"), []);
  // a member who does not administer writes a set and is refused its adoption for the team
  const adopt = await open("bias", { world: t.w, as: t.dev });
  await adopt.press("promote", { data: { from: "write" }, values });
  await adopt.press("biasadopt", { values: { "bi-adwhy": "Because." } });
  assert.ok(adopt.refused && adopt.refused.key === "refusal.NOT_AN_ADMIN", JSON.stringify(adopt.refused));
  assert.equal((await lensOf(t.founder)).in_force, false, "nothing was adopted");
});

const POLICY = "Staff verify every claim against two sources. A single source is not confirmation. A claim needs at least two independent sources before it is confirmed. Everything the Gazette prints is false. Our editors meet on Mondays at nine.";

test("R65 drafting from an outside policy: biasinhale sends the policy, where it comes from and when; the proposals are marked not yet the member's, a bar and a verdict are left out with the design's words; nothing is saved until she starts a set, which promotes a draft once each has a subject and a reason", async () => {
  const t = await biasTeam();
  const a = await open("bias", { world: t.w, as: t.founder });
  const body = { policy: POLICY, source: "Bay Courier standards page", retrieved: "October 8, 2026" };
  const r = await a.press("biasinhale", { values: { "bi-policy": body.policy, "bi-source": body.source, "bi-when": body.retrieved } });
  assert.deepEqual([r.sent[0].op, r.sent[0].body], ["biasinhale", body]);
  assert.deepEqual(r.sent.map((x) => x.op), ["biasinhale"], "nothing is saved, offered or adopted");
  const policy = await t.founder.act("biasinhale", { body });   // the owner's own reading of it
  assert.ok(policy.statements.length >= 2 && policy.bars.length >= 1 && policy.residue.some((x) => x.check) && policy.residue.some((x) => !x.check));
  const text = squash(textOf(part(a, "inhale")));
  has(a, "screen.bias.it_read_sentences_of", { read: String(policy.coverage.sentences_read), of: String(policy.coverage.sentences_total) }); has(a, "screen.bias.head.proposed"); has(a, "screen.bias.head.left_out"); has(a, "screen.bias.dt.bar"); has(a, "screen.bias.dt.verdict");
  assert.ok(text.includes(said("screen.bias.kind.scrutiny")), "a proposal's kind by its short name");
  for (const s of policy.statements) assert.ok(text.includes(s.text));
  has(a, "screen.bias.proposed_not_yet_yours"); has(a, "screen.bias.a_pattern_statement_is_never"); has(a, "screen.bias.nothing_was_saved_offered_or"); has(a, "screen.bias.starting_a_set_from_these");
  assert.ok(text.includes(policy.bars[0].text) && text.includes(said("screen.bias.it_says_how_strong_support")) && text.includes(said("screen.bias.that_is_a_bar_which")), "a bar");
  const verdict = policy.residue.find((x) => x.check), other = policy.residue.find((x) => !x.check);
  assert.ok(text.includes(verdict.text) && text.includes(said("screen.bias.it_says_a_source_is")) && text.includes(said("screen.bias.a_lens_never_says_that")), "a verdict");
  assert.ok(text.includes(other.text) && text.includes(other.why), "any other sentence left out, with the owner's why");
  assert.equal((await proposed(t.founder)).length, 0, "nothing was saved");
  // starting a set from the proposals: refused until each has a subject and a reason
  assert.deepEqual((await a.press("promote", { data: { from: "inhale" }, values: { "bi-psub0": t.dept, "bi-pwhy0": "" } })).sent.filter((x) => x.op === "promote"), []);
  const values = Object.fromEntries(policy.statements.flatMap((_, i) => [["bi-psub" + i, i === 0 ? t.dept : "City Housing Department"], ["bi-pwhy" + i, "Because " + i]]));
  const s = await a.press("promote", { data: { from: "inhale" }, values });
  const promoted = s.sent.find((x) => x.op === "promote").body;
  assert.equal(promoted.meta.current_state, "draft");
  assert.ok(promoted.files[0].text.includes("current_state: draft") && policy.statements.every((x) => promoted.files[0].text.includes(x.text)));
  // control: an empty policy sends nothing
  assert.deepEqual((await a.press("biasinhale", { values: { "bi-policy": "" } })).sent, []);
});

test("R65 work made under an earlier lens: the address names the work, its record is read, a member settles it with her own reason (1 to 4,000 characters), the assistant cannot; a settled one shows its settlement and offers no settling; unknown work draws nothing", async () => {
  const t = await biasTeam();
  const run = await debtOf(t);
  const d0 = await t.founder.read("biasdebt", { query: { run } });
  const a = await open("bias", { world: t.w, as: t.founder, subject: run });
  assert.deepEqual(req(a, "biasdebt")[0].query, { run });
  const d = part(a, "debt");
  has(a, "screen.bias.work_made_under_an_earlier"); has(a, "screen.bias.waiting_for_your_word"); has(a, "screen.bias.this_cannot_be_undone_your"); has(a, "screen.bias.the_assistant_cannot_settle_it");
  assert.ok(textOf(d).includes(said("screen.bias.earlier.made", { then: d0.lens_then.slice(0, 8), made_on: day(d0.observed), now: d0.lens_now.slice(0, 8), adopted_on: day(d0.raised), change: d0.moved_basis })), "the lens then and now, when, and the change");
  assert.deepEqual((await a.press("biasdebtresolve", { values: { "bi-dreason": "" } })).sent, []);
  assert.deepEqual((await a.press("biasdebtresolve", { values: { "bi-dreason": "x".repeat(4001) } })).sent, []);
  const rec = await a.press("biasdebt", { data: { run } });
  assert.deepEqual(rec.sent[0].query, { run });
  const r = await a.press("biasdebtresolve", { values: { "bi-dreason": "  The change does not bear on this finding.  " } });
  assert.deepEqual([r.sent[0].op, r.sent[0].body], ["biasdebtresolve", { run, reason: "The change does not bear on this finding." }]);
  assert.equal(r.asked, false, "the reason is her own field: the shell asks none");
  assert.ok(r.sent.some((x) => x.op === "biasdebt"), "the record is read again");
  const after = await t.founder.read("biasdebt", { query: { run } });
  assert.equal(after.open, false, "the world holds it settled");
  assert.equal(after.settlements[0].reason, "The change does not bear on this finding.");
  // settled: its settlement is drawn, no settling is offered
  const done = await open("bias", { world: t.w, as: t.founder, subject: run });
  assert.ok(textOf(part(done, "debt")).includes(said("screen.bias.earlier.settled", { who: t.founder.handle, date: day(after.settlements[0].at), reason: after.settlements[0].reason })));
  has(done, "screen.bias.head.settled");
  assert.ok(!ops(done).includes("biasdebtresolve")); lacks(done, "screen.bias.waiting_for_your_word");
  // work this reader cannot open (or that carries no debt): nothing is drawn of it
  const none = await open("bias", { world: t.w, as: t.founder, subject: "finding:INQ-2026-9999-none" });
  assert.ok(!ops(none).includes("biasdebtresolve") && !textOf(part(none, "debt")).includes("INQ-2026-9999"));
  // control: no address, no work-under-an-earlier-lens part and no biasdebt read
  const bare = await open("bias", { world: t.w, as: t.founder });
  assert.ok(!part(bare, "debt") && !req(bare, "biasdebt").length);
});

test("R65 control: a request that carries a field its owner does not declare is refused by the guard (promote's, biasadopt's, biasinhale's and biasdebtresolve's bodies are accepted)", async () => {
  // the guard runs in the harness on every request above; this holds that the presses used the real shapes: no FieldMismatch was raised there
  const t = await biasTeam();
  const a = await open("bias", { world: t.w, as: t.founder });
  await a.press("biasinhale", { values: { "bi-policy": "A sentence long enough to count." } });
  await a.press("promote", { data: { from: "write" }, values: WRITE(t) });
  const r = await a.press("biasadopt", { values: { "bi-adwhy": "Because." } });
  assert.equal(r.sent[0].op, "biasadopt");
  assert.equal(a.refused, null, "the owner took the adoption");
});

/* ---- T51 fix round 2: C87, C94 ---- */

test("R65 C87: Propose statements from it with the policy empty, and Save the set with a required box empty, send nothing and name the box; filled, they send (control)", async () => {
  const t = await biasTeam();
  const a = await open("bias", { world: t.w, as: t.founder });
  const named = (labelKey) => said("shell.field.needed", { field: said(labelKey) });
  const none = await a.press("biasinhale", { values: { "bi-policy": "  " } });
  assert.deepEqual(none.sent, []);
  assert.equal(a.refused.text, named("screen.bias.the_policy_in_its_own"), a.refused && a.refused.text);
  for (const [box, label] of [["bi-name", "screen.bias.name_of_the_set"], ["bi-subject", "screen.bias.who_or_what_it_is"], ["bi-text", "screen.bias.statement.label"], ["bi-why", "screen.bias.why_you_read_it_this"]]) {
    const r = await a.press("promote", { data: { from: "write" }, values: { ...WRITE(t), [box]: "" } });
    assert.deepEqual(r.sent.filter((x) => x.op === "promote"), [], box);
    assert.equal(a.refused.text, named(label), box + ": " + (a.refused && a.refused.text));
  }
  // a pattern statement must cite
  const pat = await a.press("promote", { data: { from: "write" }, values: { ...WRITE(t), "bi-kind": "pattern", "bi-cite": "" } });
  assert.deepEqual(pat.sent.filter((x) => x.op === "promote"), []);
  assert.equal(a.refused.text, named("screen.bias.cites.label"));
  // starting a set from proposals: each proposal's subject and reason are named
  await a.press("biasinhale", { values: { "bi-policy": "Staff verify every claim against two sources." } });
  const s1 = await a.press("promote", { data: { from: "inhale" }, values: { "bi-psub0": "", "bi-pwhy0": "Because." } });
  assert.deepEqual(s1.sent.filter((x) => x.op === "promote"), []);
  assert.equal(a.refused.text, named("screen.bias.who_or_what_it_is"));
  const s2 = await a.press("promote", { data: { from: "inhale" }, values: { "bi-psub0": t.dept, "bi-pwhy0": "" } });
  assert.deepEqual(s2.sent.filter((x) => x.op === "promote"), []);
  assert.equal(a.refused.text, named("screen.bias.why_you_read_it_this"));
  // control: filled sends
  assert.equal((await a.press("biasinhale", { values: { "bi-policy": "Staff verify." } })).sent.filter((x) => x.op === "biasinhale").length, 1);
  assert.equal((await a.press("promote", { data: { from: "write" }, values: { ...WRITE(t), "bi-kind": "scrutiny" } })).sent.filter((x) => x.op === "promote").length, 1);
});

test("R65 C94: who adopted a set and who settled a debt are named by memberName: the handle where it differs from the id, the fallback word where the member has none, never an id", async () => {
  const t = await biasTeam();
  const set = await teamLens(t);
  const lens = await lensOf(t.founder);
  assert.equal(lens.bundles[0].adopted_by, "admin");
  const a = await open("bias", { world: t.w, as: t.founder });
  assert.ok(a.text.includes(said("screen.bias.by_admin_for_the_team.team", { admin: t.founder.handle, date: day(lens.bundles[0].adopted_at) })), "the adopter by handle");
  assert.notEqual(t.founder.handle, "admin");
  assert.ok(!a.text.includes("admin ·") && !a.text.includes(" admin "), "never the id");
  // seeded: no act makes an adoption by a member the roster holds no handle for (a member who acts has enrolled with one)
  await t.founder.act("memberadd", { body: { memberId: "mai-k", cover: "Mai" } });   // on the roster, invited: no handle yet
  t.w.sql.exec("UPDATE bias_adoptions SET author = 'member:mai-k' WHERE bundle_id = ?", set.bundleId);
  const b = await open("bias", { world: t.w, as: t.founder });
  assert.ok(b.text.includes(said("screen.bias.by_admin_for_the_team.team", { admin: said("shell.card.member"), date: day(lens.bundles[0].adopted_at) })), "no handle: the fallback word");
  assert.ok(!b.text.includes("mai-k"));
  const run = await debtOf(t);
  await t.founder.act("biasdebtresolve", { body: { run, reason: "It does not bear on the finding." } });
  const settled = (await t.founder.read("biasdebt", { query: { run } })).settlements[0];
  const c = await open("bias", { world: t.w, as: t.founder, subject: run });
  assert.ok(c.text.includes(said("screen.bias.earlier.settled", { who: t.founder.handle, date: day(settled.at), reason: settled.reason })));
  t.w.sql.exec("UPDATE bias_debt_settlements SET actor = 'member:ghost-7' WHERE run = ?", run);
  const d = await open("bias", { world: t.w, as: t.founder, subject: run });
  assert.ok(d.text.includes(said("screen.bias.earlier.settled", { who: said("shell.card.member"), date: day(settled.at), reason: settled.reason })));
  assert.ok(!d.text.includes("ghost-7"));
});
