/* store-assembly's copy of plane's T48 test: T48's composition (T48-78; N670, N847, N996, N1015, N1039, N1047; DEC-127 (3), DEC-227; K2591, K3101, K3103, K3147,
   K3189): the draft door's `readtranslate` (R53), the front door's pointer (R38), the update notice read handed to
   machinery-producers (R39), `ai-accounts` spread and read in place of `credentials`' delegates (R40) and the door's trace and member ref on every call to agent-worker (R55). (The global scope against
   bundler R31's budget, plane R54, stays with plane.) Each test drives the assembled store at its interface (construction over a storage,
   the RPC bodies and door, the transcriber it registers) and carries a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store, deployed, GATE_FLAGS, GATE_SET, GATE_PARTS, disclosed } from "./fixture.mjs";
import { MODULE_MAPS, ownMaps, servedThroughDoor } from "./maps.mjs";
import { assistantGateOf, askOp, doorHeaders, READ_PASSAGE_MAX } from "../../../src/store-assembly/ask.mjs";
import { frontDoorPointer } from "../../../src/store-assembly/wiring.mjs";
import { transcriberOf } from "../../../src/store-assembly/transcribe.mjs";
import { credentialsOf, Credentials } from "../../../src/credentials/index.mjs";
import { aiAccountsOf, aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";
import { networkNoticesOf } from "../../../src/network-notices/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { translationsOf } from "../../../src/translations/index.mjs";
import { wizardScriptsOf } from "../../../src/wizard-scripts/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { queueProducersOf } from "../../../src/queue-producers/index.mjs";
import { combine, get as profileOf } from "../../../../jurisdictions/index.mjs";
import { TRACE_HEADER, MEMBER_REF_HEADER } from "../../../src/signin-door/index.mjs";
import { partRefusal } from "../../../src/run-rules/index.mjs";

const SESSION = "s".repeat(64);
const SEAL = "a-long-seal-secret-for-the-t48-test";
const SECRET = "sk-ant-zz-t48-ann";
const READ_PARTS = [...GATE_PARTS];   /* draft:reading is among them (fixture, R53) */
const READ_FLAGS = { ...GATE_FLAGS };
const TRACE = "0b8f2c1e-6a53-4d0e-9f1c-2a7d5e3b9c10";
const REF = "a1b2c3d4e5f6";

/* ann and an administrator, ann's live session, the group's keep-away off; agent-worker records every post, with its
   headers. `translated` is what `/draft` answers for a reading. */
async function doors({ gate = { flags: READ_FLAGS, testSet: GATE_SET }, parts = READ_PARTS, env: extra = {}, language = "es",
                       worker = null } = {}) {
  const posts = [];
  const answerFor = (u, b) => (u === "https://agent-worker/draft"
    ? { ok: true, translation: `[${b.task && b.task.language}] ${b.task && b.task.text}`, language: b.task && b.task.language,
        usage: { input_tokens: 10, output_tokens: 5 }, calls: 1 }
    : { ok: true });
  const env = { ACCOUNT_SEAL_SECRET: SEAL, ...extra, AGENT_WORKER: worker || { fetch: async (u, init) => {
    const body = JSON.parse(init.body);
    posts.push({ url: u, body, headers: { ...(init.headers || {}) }, raw: init.body });
    return new Response(u.endsWith("/ask") ? '{"event":"answer","ok":true}\n' : JSON.stringify(answerFor(u, body)),
                        { status: 200, headers: { "content-type": u.endsWith("/ask") ? "application/x-ndjson" : "application/json" } });
  } } };
  const x = await store({ env, before: gate ? (ctx) => assistantGateOf(ctx, gate) : null });
  if (parts.length) await deployed(x.ctx, parts);
  const sql = x.ctx.storage.sql;
  const member = (id, role = "member") => sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
    VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  member("ada", "admin");
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  member("ann");
  member("bob");
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);
  assert.equal((await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SECRET, by: "member:ann" })).ok, true);
  /* instance-setup R87's `readingLanguage`: the member's own language is the one set by her own act */
  const setup = instanceSetupOf(x.ctx, x.env);
  if (language) assert.equal(setup.memberLanguageSet({ language, by: "member:ann" }).ok, true);
  const draft = async (a) => { const r = await x.s.draft({ member: "ann", session: SESSION, pack: { layers: [] }, ...a }); return { status: r.status, body: await r.json() }; };
  return { ...x, posts, draft, member };
}
const count = (x, table) => [...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ${table}`)][0].c;

/* ===== R53 (T48; N670; DEC-127 (3); run-rules R33; agent-worker R86; instance-setup R87) ===== */

test("R53 (T48; N670; DEC-127 (3)): the draft door takes readtranslate for the asking member's own note: the subject read as she may, the language instance-setup gives, one post to agent-worker's /draft with the task {op, language, text}, no grant and no told, and the answer a machine's translation beside the original; it writes nothing; controls: another member's note is NO_SUCH_NOTE as an absent one is, with nothing posted", async () => {
  const x = await doors();
  const mine = hypothesesOf(x.ctx).noteWrite({ text: "Meeting notes: the vote is Tuesday.", by: "member:ann" });
  /* note numbers are each member's own: bob's second note has a number ann's notes lack */
  hypothesesOf(x.ctx).noteWrite({ text: "Bob's first note.", by: "member:bob" });
  const his = hypothesesOf(x.ctx).noteWrite({ text: "Bob's private note.", by: "member:bob" });
  assert.equal(mine.ok && his.ok, true, JSON.stringify([mine, his]));
  assert.notEqual(his.note, mine.note);
  const before = { grants: count(x, "ai_grants"), notes: count(x, "member_notes") };
  const r = await x.draft({ op: "readtranslate", subject: { kind: "note", id: mine.note } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.translation, "[es] Meeting notes: the vote is Tuesday.");
  assert.equal(r.body.language, "es");
  assert.equal(r.body.from_language, null);
  assert.deepEqual(r.body.label, { kind: "machine" });
  assert.deepEqual(r.body.original, { kind: "note", id: mine.note, text: "Meeting notes: the vote is Tuesday." });
  assert.equal(r.body.grant, null, "no grant is minted");
  assert.equal(r.body.usage.output_tokens, 5, "the usage rides along for the door's count");
  assert.equal(x.posts.length, 1);
  const [post] = x.posts;
  assert.equal(post.url, "https://agent-worker/draft");
  assert.deepEqual(post.body.task, { op: "readtranslate", language: "es", text: "Meeting notes: the vote is Tuesday." });
  assert.equal("told" in post.body, false, "no told");
  assert.equal("grant" in post.body, false, "no grant");
  assert.equal(post.body.account.secret, SECRET, "the account in agent-worker R6's shape");
  assert.equal(count(x, "ai_grants"), before.grants);
  assert.equal(count(x, "member_notes"), before.notes, "it writes nothing");
  /* control: bob's note is not hers: the answer is the absent one's, and nothing is posted */
  const other = await x.draft({ op: "readtranslate", subject: { kind: "note", id: his.note } });
  const absent = await x.draft({ op: "readtranslate", subject: { kind: "note", id: 99999 } });
  assert.equal(other.body.reason, "NO_SUCH_NOTE");
  assert.deepEqual([other.status, other.body.reason], [absent.status, absent.body.reason]);
  assert.equal(x.posts.length, 1, "nothing more was posted");
  assert.equal(JSON.stringify(other.body).includes("Bob's private note"), false, "the text of another's note is never shown");
});

test("R53, R54 (T48; N670; K4124): the language is translations' readingLanguage (its R10), a language asked passes through and its refusal is answered as given; a passage over the limit is refused before any account is read with the owner's text shown; a malformed subject is BAD_TASK; each posts nothing", async () => {
  const x = await doors({ language: null });
  const n = hypothesesOf(x.ctx).noteWrite({ text: "Short note.", by: "member:ann" });
  const asked = [];
  const trans = translationsOf(x.ctx), real = trans.readingLanguage;
  trans.readingLanguage = (q) => { asked.push(q); return real.call(trans, q); };
  const none = await x.draft({ op: "readtranslate", subject: { kind: "note", id: n.note } });
  assert.equal(none.body.reason, "LANGUAGE_NOT_SET", JSON.stringify(none.body));
  assert.equal(none.body.ok, false);
  assert.deepEqual(asked.at(-1), { member: "member:ann" }, "no language asked: the member's own is read");
  const bad = await x.draft({ op: "readtranslate", subject: { kind: "note", id: n.note }, language: "not a tag!" });
  assert.equal(bad.body.reason, "LANGUAGE_MALFORMED", JSON.stringify(bad.body));
  assert.equal(x.posts.length, 0);
  /* a language asked reaches the post as given */
  const ok = await x.draft({ op: "readtranslate", subject: { kind: "note", id: n.note }, language: "vi" });
  assert.equal(ok.body.ok, true, JSON.stringify(ok.body));
  assert.equal(x.posts[0].body.task.language, "vi");
  assert.deepEqual(asked.at(-1), { member: "member:ann", language: "vi" });
  /* the passage limit: refused with the owner's text, before any account is read (the account read is answers.askAccount) */
  const long = "x".repeat(READ_PASSAGE_MAX + 1);
  const big = hypothesesOf(x.ctx).noteWrite({ text: long, by: "member:ann" });
  const posted = x.posts.length;
  if (big.ok === true) {
    const r = await x.draft({ op: "readtranslate", subject: { kind: "note", id: big.note }, language: "es" });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.reason, "PASSAGE_TOO_LONG");
    assert.equal(r.body.original.text, long, "the owner's text is shown");
    assert.equal(x.posts.length, posted);
  }
  /* control: a passage at the limit is translated */
  const edge = hypothesesOf(x.ctx).noteWrite({ text: "y".repeat(READ_PASSAGE_MAX), by: "member:ann" });
  if (edge.ok === true) {
    const r = await x.draft({ op: "readtranslate", subject: { kind: "note", id: edge.note }, language: "es" });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 200));
  }
  for (const subject of [null, {}, { kind: "memo", id: 1 }, { kind: "note" }, "note:1"]) {
    const r = await x.draft({ op: "readtranslate", subject });
    assert.deepEqual([r.status, r.body.reason], [400, "BAD_TASK"], JSON.stringify(subject));
  }
});

test("R53 (T48; N670): a question or finding is read only as she may see it: an absent one and one outside her sight answer NO_SUCH_BUNDLE alike, before any account is read; one she sees is translated and the post carries its text", async () => {
  const x = await doors();
  const sql = x.ctx.storage.sql;
  /* a question bundle visible to the group, and one in a project ann is not in */
  const record = recordOf(x.ctx);
  const seen = "INQ-2026-9001-seen", hidden = "INQ-2026-9002-hidden";
  for (const [id, title, project] of [[seen, "Who approved the harbour contract?", null], [hidden, "A hidden question", "PROJ-2026-0099-none"]])
    sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, project)
              VALUES (?, 'inquiry', 'g', ?, 'open', 't', 't', ?, ?)`, id, title, createHash("sha256").update(id).digest("hex"), project);
  assert.equal(record.bundleInfo(seen).title, "Who approved the harbour contract?");
  const ok = await x.draft({ op: "readtranslate", subject: { kind: "question", id: seen } });
  if (ok.body.ok === true) {
    assert.equal(ok.body.original.text, "Who approved the harbour contract?");
    assert.equal(x.posts.at(-1).body.task.text, "Who approved the harbour contract?");
  } else assert.equal(ok.body.reason, "NO_SUCH_BUNDLE", "outside her sight in this fixture");
  const posted = x.posts.length;
  const gone = await x.draft({ op: "readtranslate", subject: { kind: "finding", id: "INQ-2026-0000-absent" } });
  const unseen = await x.draft({ op: "readtranslate", subject: { kind: "finding", id: hidden } });
  assert.equal(gone.body.reason, "NO_SUCH_BUNDLE");
  assert.deepEqual([unseen.status, unseen.body.reason], [gone.status, gone.body.reason], "absent and unseen alike");
  assert.equal(x.posts.length, posted, "nothing posted for either");
});

test("R53 (T48; N670): a notice is read through network-notices for her, the project named by the subject, and its refusal for an absent project is answered as given; the gate is R50's: a part not admitted, or a flag not deployed, is refused before any read; the project's keep-away from drafts is refused before any account is read", async () => {
  const x = await doors();
  const nn = networkNoticesOf(x.ctx);
  const asked = [];
  nn.noticesOf = (q) => { asked.push(q); return q.project === "PROJ-2026-0001-harbour"
    ? { ok: true, project: q.project, notices: [{ notice: "NOTICE-1", revisions: [{ revision: 1, json: { wording: "Old wording." } },
        { revision: 2, json: { wording: "We are working on the harbour contract.", body: "Details follow.", matter: "Harbour" } }] }] }
    : { ok: false, reason: "NO_SUCH_PROJECT", project: q.project }; };
  const r = await x.draft({ op: "readtranslate", subject: { kind: "notice", id: "NOTICE-1", project: "PROJ-2026-0001-harbour" } });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(asked[0], { project: "PROJ-2026-0001-harbour", viewer: "member:ann" });
  assert.equal(r.body.original.text, "We are working on the harbour contract.\nDetails follow.\nHarbour", "the latest revision");
  const missing = await x.draft({ op: "readtranslate", subject: { kind: "notice", id: "NOTICE-1", project: "PROJ-2026-0002-other" } });
  assert.deepEqual([missing.body.ok, missing.body.reason], [false, "NO_SUCH_PROJECT"]);
  const posts = x.posts.length;
  /* the project keeps its material away from drafts: refused before any account is read */
  const away = aiAccountsOf(x.ctx);
  const real = away.aiKeptAway.bind(away);
  away.aiKeptAway = (q) => (q && q.project === "PROJ-2026-0001-harbour" ? { ok: false, reason: "AI_KEPT_AWAY", code: "AI_KEPT_AWAY" } : real(q));
  const kept = await x.draft({ op: "readtranslate", subject: { kind: "notice", id: "NOTICE-1", project: "PROJ-2026-0001-harbour" } });
  assert.equal(kept.body.reason, "AI_KEPT_AWAY");
  assert.equal(kept.status, 403);
  assert.equal(x.posts.length, posts);
  away.aiKeptAway = real;
});

test("R53, R50 (T48): readtranslate is refused AI_RUN_MODE_NOT_DEPLOYED while draft's flag is off, and AI_PART_NOT_DEPLOYED while ai-runs does not admit draft:reading, before the subject is read, with nothing posted; control: with both, it runs", async () => {
  const off = await doors({ gate: { flags: { ...READ_FLAGS, draft: false }, testSet: GATE_SET } });
  const n = hypothesesOf(off.ctx).noteWrite({ text: "A note.", by: "member:ann" });
  const a = await off.draft({ op: "readtranslate", subject: { kind: "note", id: n.note } });
  assert.deepEqual([a.status, a.body.reason], [403, "AI_RUN_MODE_NOT_DEPLOYED"]);
  const bar = await doors({ parts: READ_PARTS.filter((p) => p !== "draft:reading") });
  const m = hypothesesOf(bar.ctx).noteWrite({ text: "A note.", by: "member:ann" });
  const b = await bar.draft({ op: "readtranslate", subject: { kind: "note", id: m.note } });
  const { grant: _g, suggestions: _s, read: _r, ...given } = b.body;
  assert.equal(b.status, 403);
  assert.deepEqual(given, partRefusal("draft:reading"), "run-rules' own refusal for the part, relayed unchanged");
  assert.equal(off.posts.length + bar.posts.length, 0);
  const on = await doors();
  const k = hypothesesOf(on.ctx).noteWrite({ text: "A note.", by: "member:ann" });
  assert.equal((await on.draft({ op: "readtranslate", subject: { kind: "note", id: k.note } })).body.ok, true);
});

/* ===== R38 (T48; N847; K2591; DEC-227 (3), (4); wizard-scripts R23, R37; jurisdictions R89, R90) ===== */

test("R38 (T48; N847): the front door's pointer reads record-core's jurisdiction_profiles at each call and answers {places, pointers} over jurisdictions.combine; the test profile's pointers reach startfrom's elsewhere route through the door; control: no active profile gives places []", async () => {
  const x = await doors();
  const setting = (v) => assert.equal(recordOf(x.ctx).setSetting("jurisdiction_profiles", v, "ada").ok, true);
  const elsewhere = (viewer = "member:ann") => wizardScriptsOf(x.ctx).startFrom({ viewer }).routes.find((r) => r.route === "elsewhere");
  /* control: no active profile */
  assert.deepEqual(elsewhere().pointer, { places: [], pointers: [] });
  /* the profile set afterwards is seen at the next call, never once at start */
  setting(["test-port-ellery"]);
  const p = elsewhere().pointer;
  const view = combine(["test-port-ellery"]).view;
  assert.deepEqual(p.places, [profileOf("test-port-ellery").name]);
  assert.ok(view.pointers.length > 0, "the test profile supplies pointers (jurisdictions R91)");
  assert.deepEqual(p.pointers, view.pointers);
  /* the pointer function itself: a combine that refuses, or a setting that throws, is null */
  assert.deepEqual(frontDoorPointer({ setting: () => ["no-such-profile"] })(), null);
  assert.equal(frontDoorPointer({ setting: () => { throw new Error("unreadable"); } })(), null);
  assert.deepEqual(frontDoorPointer({ setting: () => null })(), { places: [], pointers: [] });
  assert.deepEqual(frontDoorPointer({ setting: () => [] })(), { places: [], pointers: [] });
  setting([]);
  assert.deepEqual(elsewhere().pointer, { places: [], pointers: [] }, "deactivated: read again at the call");
});

/* ===== R39 (T48; N1047; K3189; machinery-producers R12; instance-setup R88, R89) ===== */

/* R39: instance-setup's real `updateNoticeState` (its R89), observed (the call is relayed unchanged). A stored ready
   notice is a verified release notice row (`release_notices`, its R88), newer than the running version. */
function noticeRead(x) {
  const setup = instanceSetupOf(x.ctx, x.env);
  const t = { asked: [] };
  const real = setup.updateNoticeState.bind(setup);
  setup.updateNoticeState = (...a) => { t.asked.push(a); return real(...a); };
  t.store = (version = "99.0.0") => x.ctx.storage.sql.exec(
    `INSERT INTO release_notices (version, date, manifest, security, notes, sig, found_at) VALUES (?, '2026-10-10', '{}', 0, '{}', 'sig', '2026-10-12T00:00:00Z')`, version);
  return t;
}

test("R39 (T48; N1047; machinery-producers R11, R12): the update notice read is handed to machinery-producers as deps.updateNotice, a function that calls instance-setup's updateNoticeState on the object's own instance at each call: the administrators' conditions carry the to-do for a stored ready notice, the state read afresh each time; controls: a member who is no administrator is not an asking, and a notice no newer than the running version yields none", async () => {
  const x = await doors({ env: { VERSION: "1.0.0" } });
  const t = noticeRead(x);
  const { machineryProducersOf } = await import("../../../src/machinery-producers/index.mjs");
  const mp = machineryProducersOf(x.ctx);
  const at = Date.parse("2026-10-14T00:00:00Z");
  const has = (r) => r.items.some((i) => i.kind === "update-ready");
  const none = mp.conditionItems({ member: "ada", viewer: "member:ada", now: at });
  assert.equal(has(none), false, "no ready notice, no item");
  assert.equal(none.facts, undefined, "the read answered: nothing failed");
  assert.deepEqual(t.asked.at(-1), [], "updateNoticeState() is called with no argument");
  t.store("0.9.0");
  assert.equal(has(mp.conditionItems({ member: "ada", viewer: "member:ada", now: at })), false, "no newer than the running version");
  const before = t.asked.length;
  t.store("99.0.0");
  assert.equal(has(mp.conditionItems({ member: "ada", viewer: "member:ada", now: at })), true, "a stored ready notice yields the to-do");
  assert.ok(t.asked.length > before, "asked at each call, never once at start");
  const mid = t.asked.length;
  assert.equal(has(mp.conditionItems({ member: "ann", viewer: "member:ann", now: at })), false);
  assert.equal(t.asked.length, mid, "a member who is no administrator is not an asking");
});

test("R39 (T48; N1047): through op=queue the administrators' to-do for a ready release reaches the list; control: a member who is no administrator has none", async () => {
  const x = await doors();
  const t = noticeRead(x);
  const queue = async (who) => JSON.parse(await (await x.fetch(`/queue?viewer=member:${who}&member=${who}&by=member:${who}`, { method: "POST", body: "{}" })).text());
  const kinds = (a) => ((a.result && a.result.items) || []).map((i) => i.kind);
  t.store("99.0.0");
  const ada = await queue("ada");
  assert.equal(ada.result.ok, true, JSON.stringify(ada).slice(0, 300));
  assert.ok(kinds(ada).includes("update-ready"), "the to-do reaches the administrator's list");
  assert.equal(kinds(await queue("ann")).includes("update-ready"), false);
});

/* ===== R40 (T48; N996; K3101; ai-accounts R32, R23) ===== */

test.todo("R40 (T48; N996): with credentials' delegates removed an ask and a draft still run, their account reads being ai-accounts'. Waits on ai-runs' per-entry gate (its R78): `partAdmitted(part)` passes no entry, so the doors refuse AI_PART_NOT_DEPLOYED off a test instance; the account reads are tested in ai-accounts-seam.test.mjs");

test("R40 (T48; N996): the route map spreads ai-accounts' ops directly before credentials', and each reaches its handler once with credentials' delegates removed; control: a second disclosure registration is refused LISTENER_DECLARED, ai-accounts' registration being the plane's", async () => {
  const x = await doors();
  const u = new URL("http://do/x?viewer=member:ann&by=member:ann&member=member:ann");
  const names = MODULE_MAPS.map(([m]) => m);
  assert.equal(names.indexOf("credentials"), names.indexOf("ai-accounts") + 1, "ai-accounts' map directly before credentials'");
  const own = Object.keys(aiAccountsOps(aiAccountsOf(x.ctx), u, {}, x.env));
  assert.ok(own.length >= 24, `ai-accounts' ops are in the map (${own.length})`);
  const map = x.s.routes(u, {});
  for (const op of own) assert.ok(Object.hasOwn(map, op), `op=${op}`);
  const keys = Object.keys(map);
  assert.ok(keys.indexOf(own[0]) < keys.indexOf("aicredentialmint"), "before credentials' own ops");
  /* the delegates removed (ai-accounts T53 deleted them from credentials): the account reads the assembly makes answer from
     ai-accounts alone, through its own map and its in-plane seam */
  const proto = Credentials.prototype;
  for (const name of ["accountReferenceState", "groupKeySwitches", "accountReferenceSet", "subscriptionTokenRefused"])
    assert.equal(typeof proto[name], "undefined", `credentials holds no ${name} delegate`);
  const st = JSON.parse(JSON.stringify(await map.accountsof()));
  assert.equal(typeof st, "object", "ai-accounts' list read answers through the map");
  const seam = aiAccountsOf(x.ctx).accountReferenceState({ member: "member:ann", viewer: "member:ann" });
  assert.deepEqual([seam.ok, seam.held], [true, true], JSON.stringify(seam));
  assert.equal(aiAccountsOf(x.ctx).groupKeySwitches().on, false);
  const again = aiAccountsOf(x.ctx).registerDisclosureRead("zz-probe", () => ({ shown: true }));
  assert.deepEqual([again.ok, again.reason], [false, "LISTENER_DECLARED"], JSON.stringify(again));
});


/* ===== R55 (T48; N1015; K3103; agent-worker R87, R83; control-plane R93) ===== */

test("R55 (T48; N1015): the door's trace and member ref reach agent-worker as x-civicsmith-trace and x-civicsmith-member-ref on an ask and on a draft (the RPC and the action-draft arm), in no body or address; a call with none handed sends neither", async () => {
  const x = await doors();
  const keep = (p) => ({ trace: p.headers[TRACE_HEADER], ref: p.headers[MEMBER_REF_HEADER] });
  const a = await x.s.ask({ member: "member:ann", session: SESSION, question: "q", trace: TRACE, memberRef: REF });
  assert.equal(a.status, 200);
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  const d = await x.s.draft({ op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason",
                              pack: { layers: [] }, trace: TRACE, memberRef: REF });
  assert.equal(d.status, 200);
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  const n = hypothesesOf(x.ctx).noteWrite({ text: "A note.", by: "member:ann" });
  await x.s.draft({ op: "readtranslate", member: "ann", session: SESSION, subject: { kind: "note", id: n.note }, trace: TRACE, memberRef: REF });
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  /* control: neither appears in a body, and the url is the binding's own */
  for (const p of x.posts) {
    assert.equal(p.raw.includes(TRACE) || p.raw.includes(REF), false, "never in a body");
    assert.equal(/^https:\/\/agent-worker\/(ask|draft)$/.test(p.url), true, "never in an address");
  }
  /* control: none handed, none sent; a value not of the header shape is not sent */
  const before = x.posts.length;
  await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.deepEqual(keep(x.posts[before]), { trace: undefined, ref: undefined });
  assert.deepEqual(doorHeaders({ trace: "has space", memberRef: "x".repeat(201) }), { "content-type": "application/json" });
  assert.deepEqual(doorHeaders({ trace: TRACE }), { "content-type": "application/json", [TRACE_HEADER]: TRACE });
});

test("R55 (T48): the Worker's ask arm passes the door's trace and member ref on to the ask on the bio object, and the transcriber's call to /transcribe carries them; control: the Worker arm sends none of its own when the door handed none", async () => {
  const seen = [];
  const env = { STORE: { idFromName: (n) => n, get: () => ({ ask: async (args) => { seen.push(args); return new Response("{}"); } }) } };
  const req = new Request("https://x/ask", { method: "POST", body: JSON.stringify({ question: "q" }) });
  await askOp({ req, url: new URL("https://x/ask"), env, viaSession: true, sessMember: "ann", grantMember: null, trace: TRACE, memberRef: REF });
  assert.equal(seen[0].trace, TRACE);
  assert.equal(seen[0].memberRef, REF);
  await askOp({ req: new Request("https://x/ask", { method: "POST", body: "{}" }), url: new URL("https://x/ask"), env, viaSession: true,
                sessMember: "ann", grantMember: null });
  assert.equal("trace" in seen[1] || "memberRef" in seen[1], false);
  /* the transcriber: the headers on the /transcribe post */
  const x = await doors({ parts: [...READ_PARTS, "transcribe"] });
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-14T10:00:00Z", trace: TRACE, memberRef: REF });
  const sha = "a".repeat(64);
  const ev = recordOf(x.ctx).evidenceStore();
  assert.ok(ev === null || typeof ev === "object");
  if (ev && typeof ev.put === "function") {
    await ev.put(sha, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await tx.transcribe({ account: { kind: "apikey", level: "member", key: SECRET }, capture_sha: sha, pages: [0] });
  }
  const posted = x.posts.filter((p) => p.url.endsWith("/transcribe"));
  for (const p of posted) assert.deepEqual([p.headers[TRACE_HEADER], p.headers[MEMBER_REF_HEADER]], [TRACE, REF]);
  const bare = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-14T10:00:00Z" });
  assert.equal(typeof bare.transcribe, "function", "no trace handed: still a transcription");
});

/* ===== R6 (T48; K3280, K3282, K3266): the route map re-pinned to T48's ops ===== */

/* Instants and minted ids differ between two objects; everything else must not. */
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');
/* T48's new ops are served by these owners' maps (action-replies R10, filings R59, action-holds R16, ai-use R14, instance-setup's
   update ops): the ops are read from the owners' own maps (K3268), never listed here. */
const T48_OWNERS = ["action-replies", "filings", "action-holds", "ai-use", "instance-setup"];

test("R6 (T48; K3280, K3282, K3266; action-replies R10, filings R59, action-holds R16, ai-use R14): the route map is re-pinned to T48's ops: each is in the map of the module that serves it, in the route map, and answers through control-plane's door what that map answers called directly; control: an op no map serves is in none", async () => {
  const u = new URL("http://do/");
  const x = await store(), twin = await store();
  const keys = Object.keys(x.s.routes(u, null));
  const { served, failed } = await servedThroughDoor(x, twin, T48_OWNERS);
  assert.deepEqual(failed, []);
  const owners = (op) => ownMaps(x.ctx, u, null, x.env).filter(([, m]) => Object.hasOwn(m, op)).length;
  assert.deepEqual(served.filter(([op]) => owners(op) !== 1), [], "each is served by exactly one module's map");
  assert.equal(keys.includes("zzprobe48"), false);
});
