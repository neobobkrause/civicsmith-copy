/* Settings › Members at the module's interface (R1, R2, R8 as R47 leaves them: the roster only; R12, R23, R29, R35, R47, R51): the
   screen run over the world (store-request's `storeWorld`): the team's members, keys, invitations and votes are made by the real acts
   (`seed-members.mjs`), and what each test expects is read back from what the owners answer. What it reads, what it draws, and what
   each act sends. The team's key and its account are `teamai`'s (teamai.test.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, day, has, lacks, open, panelOf, rowOf, said, squash, textOf, SCREENS } from "./kit.mjs";
import { SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { WORLD_ORIGIN } from "../store-request/fixtures.mjs";
import { team, keyed, removing, admins, joined, attempt, reauth, recorded, KEYS, rosterOf, EMPTY_ROSTER, withoutFounder, WAITING, SILENT, ARITH_REFUSED,
         keysOfAMemberWhoLeft, legacyKeys, strangersKeys, removalByStrangers } from "./seed-members.mjs";

const btn = (n, op, pred = () => true) => acts(n).filter((b) => b.attrs["data-act"] === op && pred(b));
/** The roster as the owner answers it to `as`. */
const listed = async (as) => (await as.read("memberlist")).members;
/** The counts the roster states: the active members and, of them, the administrators. */
const countOf = (rows) => { const on = rows.filter((m) => m.status === "active"); return { members: on.length, administrators: on.filter((m) => m.role === "admin").length }; };
/** A member as the screen names her from the roster: by handle; the founder holding none by the word for it; one it holds no row for by the fallback word. */
const nameIn = (rows) => (id) => { const m = rows.find((x) => x.member_id === id); return (m && m.handle) || (id === "admin" ? said("member.founder.unnamed") : said("shell.card.member")); };
/** The acts drawn with the founder's row, whose name carries no data-id button (a row with no acts): the row and the panel after it. */
const founderActs = (o) => {
  const row = rowOf(o.tree, "admin", said("member.founder.unnamed") + said("member.founder.unnamed.help"));
  assert.ok(row, "her row is drawn");
  const sib = row.parent.children.filter((c) => c.tag), next = sib[sib.indexOf(row) + 1];
  return acts(row).concat(next && /cs-panel/.test(next.attrs.class || "") ? acts(next) : []).map((b) => b.attrs["data-act"]);
};

test("R1 the reads: the roster for every member; the recovery step and the signing keys for an administrator; a member's expertise when opened; nothing of the team's key (R47)", async () => {
  const t = await team();
  const a = await open("members", { world: t.w, as: t.founder, subject: "ana" });
  // the screen's own reads, from its first (the frame's own reads, interface-shell R20, come before it)
  const all0 = a.p.requests.map((r) => [r.op, r.query]);
  const reads = all0.slice(all0.findIndex((r) => r[0] === "memberlist")).slice(0, 6);
  assert.deepEqual(reads, [["memberlist", {}], ["expertiselist", { memberId: "ana" }], ["adminrecoverystep", {}], ["signerlist", {}], ["adminarith", {}], ["adminremovalsopen", {}]]);
  // the team's key and its use are `teamai`'s reads (R47): whatever it reads beyond the roster's own and the frame's is not read here
  const admin = await t.founder.read("whoami"), member = await t.dev.read("whoami");
  const mine = Object.values(SCREENS.find((s) => s.id === "members").reads({ me: admin, subject: "ana" })).map((r) => r.op);
  const teams = Object.values(SCREENS.find((s) => s.id === "teamai").reads({ me: admin })).map((r) => r.op).filter((op) => !mine.includes(op) && !SHELL_OPS.includes(op));
  assert.ok(teams.length >= 5, "the team's account reads");
  for (const op of teams) assert.ok(!a.p.requests.some((r) => r.op === op), `${op} is teamai's (R47)`);
  const m = await open("members", { world: t.w, as: t.dev });
  const mo = m.p.requests.map((r) => r.op);
  assert.deepEqual(mo.filter((op) => !SHELL_OPS.includes(op)), ["memberlist"]);
  // what the owners refuse a member: the reads the screen asks of an administrator beyond those it asks of a member (N1073)
  const members = SCREENS.find((s) => s.id === "members");
  const adminOnly = Object.values(members.reads({ me: admin, subject: "ana" })).map((r) => r.op).filter((op) => !Object.values(members.reads({ me: member })).some((r) => r.op === op));
  assert.ok(adminOnly.includes("adminrecoverystep") && adminOnly.includes("signerlist") && adminOnly.includes("adminarith") && adminOnly.includes("adminremovalsopen"), "the administrators' reads");
  for (const op of adminOnly) assert.ok(!m.p.requests.some((r) => r.op === op), `nothing the owners refuse a member is read (${op})`);
  // and the owners refuse two of them to a member who asks
  for (const op of ["adminrecoverystep", "adminremovalsopen"]) assert.equal((await attempt(t.w, t.dev, op)).reason, "NOT_AN_ADMIN", op);
});

test("R1 the roster: each member's handle, cover (to an administrator), role, capabilities and status; no \"formerly\" (DEC-197)", async () => {
  const t = await team();
  const a = await open("members", { world: t.w, as: t.founder });
  const roster = await listed(t.founder);
  assert.deepEqual([...new Set(roster.map((m) => m.status))].sort(), ["active", "invited", "proposed", "revoked"], "every state of a member is on the roster");
  for (const m of roster) {
    const name = m.handle || said(m.member_id === "admin" ? "member.founder.unnamed" : "screen.members.nohandle");
    const row = rowOf(a.tree, m.member_id, m.member_id === "admin" ? said("member.founder.unnamed") + said("member.founder.unnamed.help") : name);
    assert.ok(row, m.member_id);
    const text = textOf(row);
    assert.ok(text.includes(name));
    if (m.cover !== undefined) assert.ok(text.includes(m.cover), `${m.member_id}'s cover`);
    assert.ok(text.includes(said(m.role === "admin" ? "screen.members.role.admin" : "screen.members.role.member")));
    // the capabilities in words; an administrator's row says all of it (R47)
    if (m.role === "admin") assert.ok(text.includes(said("screen.members.cap.all")), `${m.member_id}'s capabilities`);
    else for (const c of m.capabilities) assert.ok(text.includes(said("screen.members.cap." + c)));
    assert.ok(text.includes(said("screen.members.status." + m.status)));
  }
  has(a, "screen.members.count", countOf(roster));
  assert.ok(!/formerly/i.test(a.html), "no formerly");
  const ana = roster.find((m) => m.member_id === "ana");
  assert.ok(textOf(rowOf(a.tree, "ana")).includes(said("screen.members.expertise.declared", { label: ana.expertise[0].label })));
});

test("R47 to a member who does not administer, Members is a table of members, what each may do and their expertise, with who changes it; no key or keep-away section", async () => {
  const t = await team();
  const m = await open("members", { world: t.w, as: t.dev });
  for (const cover of (await listed(t.founder)).map((x) => x.cover).filter(Boolean)) assert.ok(!m.text.includes(cover), `no cover: ${cover}`);
  assert.ok(!m.html.includes(said("screen.members.col.cover")), "no cover column");
  const th = all(m.tree, (e) => e.tag === "th").map((e) => textOf(e));
  assert.deepEqual(th, ["column.members.member.name", "column.members.may-do.name", "column.members.expertise.name"].map((k) => said(k)));
  for (const c of ["member", "may-do", "expertise"]) assert.ok(all(m.tree, (e) => e.attrs["data-tip"] === said(`column.members.${c}.shows`)).length, `${c} is explained`);
  const dev = all(m.tree, (e) => e.tag === "tr").find((r) => textOf(r).startsWith("dev"));
  assert.ok(textOf(dev).includes(said("screen.members.cap.contribute")), "the capabilities in words");
  assert.ok(textOf(dev).includes(said("screen.members.expertise.none")), "an empty expertise is told");
  const lu = all(m.tree, (e) => e.tag === "tr").find((r) => textOf(r).startsWith("lu"));
  assert.ok(textOf(lu).includes(said("screen.members.cap.all")), "an administrator's row");
  has(m, "screen.members.member.note");
  for (const k of ["screen.members.key.heading", "screen.members.keepaway.heading", "screen.panel.usage.heading"]) lacks(m, k);
  assert.deepEqual(acts(m.tree).map((b) => b.attrs["data-act"]), []);
  // control: an administrator's roster keeps the invitations and the administrators' acts, and draws no key section either
  const a = await open("members", { world: t.w, as: t.founder });
  for (const k of ["screen.members.key.heading", "screen.members.keepaway.heading"]) lacks(a, k);
  assert.ok(btn(a.tree, "memberadd").length);
});

test("R1 the one-administrator note while the step is not met, as setup-page R16 states it; nothing once met", async () => {
  // the founder alone administers (R35): the sentence names no one while she has no handle
  const one = await admins(1);
  await one.w.signIn("ana");
  const step = await one.founder.read("adminrecoverystep");
  assert.deepEqual([step.administrators, step.codes_held, step.met], [1, false, false]);
  const a = await open("members", { world: one.w, as: one.founder });
  has(a, "screen.members.recovery.one");
  has(a, "screen.members.recovery.nocodes", { remaining: step.remaining });
  assert.ok(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "#members-invite").length === 1, "the act that meets it: adding an administrator");
  const note = all(a.tree, (e) => e.attrs["data-note"] === "recovery")[0];
  assert.ok(all(note, (e) => e.tag === "a" && e.attrs.href === "/app/recovery").length === 1, "and issuing codes, on Recovery codes");
  assert.equal(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/").length, 0, "no link opens the setup page");
  // two administrators who hold recovery codes: met
  const two = await admins(2);
  await two.founder.act("recoverycodesissue", { body: {} });
  const met = await two.founder.read("adminrecoverystep");
  assert.equal(met.met, true);
  const b = await open("members", { world: two.w, as: two.founder });
  assert.ok(!all(b.tree, (e) => e.attrs["data-note"] === "recovery").length);
  // two administrators and no codes: not met, the note says how many there are
  const many = await admins(2);
  const unmet = await many.founder.read("adminrecoverystep");
  assert.deepEqual([unmet.administrators, unmet.codes_held, unmet.met], [2, false, false]);
  const c = await open("members", { world: many.w, as: many.founder });
  has(c, "screen.members.recovery.many", { administrators: unmet.administrators });
  const dev = await many.w.signIn("dev");
  const m = await open("members", { world: many.w, as: dev });
  assert.ok(!all(m.tree, (e) => e.attrs["data-note"] === "recovery").length);
});

test("R1 each read drawn in its state: still loading, empty, could not read (never as empty), or its data", async () => {
  const t = await admins(1);
  const loading = await open("members", { world: t.w, as: t.founder, table: WAITING("memberlist") });
  assert.ok(all(loading.tree, (e) => e.attrs["data-state"] === "loading").length >= 1);
  const empty = await open("members", { world: t.w, as: t.founder, table: EMPTY_ROSTER });
  has(empty, "screen.members.empty");
  const failed = await open("members", { world: t.w, as: t.founder, table: SILENT("memberlist") });
  assert.equal(all(failed.tree, (e) => e.attrs["data-state"] === "failed").length, 1);
  lacks(failed, "screen.members.empty");
});

/* R2's act table (R47: the roster's eleven): every registry act of `members`, the state in which it applies, and where it is drawn. */
const TABLE = [
  ["passwordresetlink", "dev"], ["signerset", null], ["signeradd", null],
  ["memberadd", null], ["membercaps", "dev"], ["memberset", "dev"], ["adminendorse", "kim"], ["adminremove", "lu"], ["expertiseconfirm", "ana"],
  ["invitewithdraw", "mai-k"], ["websitekeycreate", null], ["joinlinkenable", null],
];

test("R2 every registry act is drawn for an administrator where it applies, each row's acts in its own panel; none to a member who does not administer", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder, subject: "ana" });
  assert.deepEqual([...new Set(acts(a.tree).map((b) => b.attrs["data-act"]))].sort(), TABLE.map((x) => x[0]).sort(), "exactly the registry's acts");
  for (const [op, row] of TABLE) {
    const bs = btn(a.tree, op);
    assert.ok(bs.length, op);
    if (row) assert.ok(btn(panelOf(a.tree, row), op).length, `${op} in ${row}'s panel`);
    if (row) assert.ok(bs.every((b) => ancestor(b, (p) => /cs-panel/.test(p.attrs.class || ""))), `${op} only in a row's panel`);
  }
  // no act where it does not apply: no endorsing an active administrator, no capabilities for one, none on oneself (the founder's row)
  assert.ok(!founderActs(a).includes("adminremove") && !btn(panelOf(a.tree, "lu"), "membercaps").length && !btn(panelOf(a.tree, "dev"), "adminendorse").length);
  assert.ok(!btn(panelOf(a.tree, "dev"), "invitewithdraw").length);
  const teo = await t.w.signIn("teo", { capabilities: [] });
  for (const me of [t.dev, teo]) {
    const m = await open("members", { world: t.w, as: me });
    assert.deepEqual(acts(m.tree).map((b) => b.attrs["data-act"]), [], "absent, not greyed");
  }
});

test("R2 memberadd: the short id, the cover and the capabilities ticked; the invitation answered shown once, with the sentence that no email is sent", async () => {
  const t = await team();
  const rec = recorded(t.w);
  const a = await open("members", { world: rec.world, as: t.founder });
  has(a, "screen.members.invite.noemail");
  const r = await a.press("memberadd", { values: { "mi-id": "mai-k2", "mi-cover": "Mai's cousin", "mi-caps-0": true, "mi-caps-1": true } });
  assert.deepEqual([r.sent[0].op, r.sent[0].query, r.sent[0].body, r.sent[0].method], ["memberadd", {}, { memberId: "mai-k2", cover: "Mai's cousin", capabilities: ["contribute", "publish"] }, "POST"]);
  assert.equal(r.sent[0].headers.Authorization, `Bearer ${t.founder.token}`, "the session in the header only");
  const made = rec.last("memberadd");
  assert.ok(made && made.invite, "the owner made the invitation");
  const shown = all(a.tree, (e) => e.attrs["data-shown"] === "invite")[0];
  assert.ok(textOf(shown).includes(`${WORLD_ORIGIN}/#invite=${made.invite}`));
  assert.ok(textOf(shown).includes(said("screen.members.invite.shown", { handle: "mai-k2", expires: day(made.expires) })));
  const look = await attempt(t.w, null, "invitelook", { body: { invite: made.invite } });
  assert.equal(look.cover, "Mai's cousin", "the link is the invitation the owner holds");
  const held = await a.press("memberadd", { values: { "mi-id": "", "mi-cover": "x" } });
  assert.deepEqual(held.sent, []);
  assert.equal(a.refused.key, "screen.members.invite.incomplete");
});

test("R2 the row acts send their owners' arguments: membercaps, memberset, adminendorse, adminremove (with its reason), expertiseconfirm, invitewithdraw", async () => {
  const t = await team();
  // lu has endorsed kim: the founder's endorsement is the last owed, so the owner makes the invitation
  await reauth(t.lu);
  assert.equal((await attempt(t.w, t.lu, "adminendorse", { body: { memberId: "kim" } })).reason, "CONSENSUS_REQUIRED");
  await reauth(t.founder);
  const rec = recorded(t.w);
  const a = await open("members", { world: rec.world, as: t.founder, subject: "ana" });
  // the panel's own data drive them: the buttons carry what the requests name
  assert.equal(btn(panelOf(a.tree, "ana"), "expertiseconfirm")[0].attrs["data-label"], "CPA");
  assert.equal(btn(panelOf(a.tree, "dev"), "memberset")[0].attrs["data-status"], "revoked");
  assert.equal(btn(panelOf(a.tree, "old"), "memberset")[0].attrs["data-status"], "active");
  const body = async (op, opt) => (await a.press(op, opt)).sent[0].body;
  assert.deepEqual(await body("membercaps", { data: { member: "dev" }, values: { "mc-dev-contribute": true, "mc-dev-create_projects": true } }), { memberId: "dev", capabilities: ["contribute", "create_projects"] });
  assert.deepEqual((await t.founder.read("memberlist")).members.find((m) => m.member_id === "dev").capabilities.sort(), ["contribute", "create_projects"], "the owner holds them");
  assert.deepEqual(await body("memberset", { data: { member: "dev", status: "revoked" } }), { memberId: "dev", status: "revoked" });
  assert.deepEqual(await body("memberset", { data: { member: "old", status: "active" } }), { memberId: "old", status: "active" });
  const now = await listed(t.founder);
  assert.deepEqual([now.find((m) => m.member_id === "dev").status, now.find((m) => m.member_id === "old").status], ["revoked", "active"]);
  assert.deepEqual(await body("adminendorse", { data: { member: "kim" } }), { memberId: "kim" });
  const endorsed = rec.last("adminendorse");
  has(a, "screen.members.invite.shown", { handle: "kim", expires: day(endorsed.expires) });
  assert.deepEqual(await body("adminremove", { data: { member: "lu" }, values: { "mr-lu": " Moved away " } }), { memberId: "lu", reason: "Moved away" });
  assert.deepEqual((await a.press("adminremove", { data: { member: "lu" }, values: { "mr-lu": "" } })).sent, [], "not without a reason");
  assert.deepEqual(await body("expertiseconfirm", { data: { member: "ana", label: "CPA" } }), { memberId: "ana", label: "CPA" });
  assert.equal((await t.founder.read("expertiselist", { query: { memberId: "ana" } })).expertise[0].state, "confirmed");
  assert.deepEqual(await body("invitewithdraw", { data: { member: "mai-k" } }), { memberId: "mai-k" });
  assert.equal((await listed(t.founder)).find((m) => m.member_id === "mai-k").status, "revoked");
});

test("R2 joining through the website: websitekeycreate and joinlinkenable with a daily cap; the key and the link shown once", async () => {
  const t = await admins(1);
  const rec = recorded(t.w);
  const a = await open("members", { world: rec.world, as: t.founder });
  const k = await a.press("websitekeycreate", { values: { "mw-cap": "5", "mw-days": "" } });
  assert.deepEqual(k.sent[0].body, { dailyCap: 5 });
  assert.ok(rec.last("websitekeycreate").key, "the owner made the key");
  assert.ok(textOf(all(a.tree, (e) => e.attrs["data-shown"] === "websitekey")[0]).includes(rec.last("websitekeycreate").key));
  const l = await a.press("joinlinkenable", { values: { "mw-cap": "3", "mw-days": "14" } });
  assert.deepEqual(l.sent[0].body, { dailyCap: 3, expiresInDays: 14 });
  assert.ok(textOf(all(a.tree, (e) => e.attrs["data-shown"] === "joinlink")[0]).includes(`${WORLD_ORIGIN}/#join=${rec.last("joinlinkenable").link}`));
  const none = await a.press("websitekeycreate", { values: { "mw-cap": "0" } });
  assert.deepEqual(none.sent, []);
  assert.equal(a.refused.key, "screen.members.website.nocap");
});

test("R2 a refusal is drawn beside its act and nothing else changes; R8 nothing is drawn as done before the answer", async () => {
  const t = await team();
  const a = await open("members", { world: t.w, as: t.founder });
  const before = a.text;
  // an id the team already holds: the owner refuses it EXISTS
  const r = await a.press("memberadd", { values: { "mi-id": "dev", "mi-cover": "x" } });
  assert.ok(r.refused && a.refused.text.includes(said("refusal.EXISTS")), "the refusal's key's words (interface-shell R13)");
  assert.equal(a.text.replace(a.refused.text, "").replace(/\s+/g, " "), before.replace(/\s+/g, " "), "nothing else changes");
  assert.equal(a.b.doc.getElementById("mi-id").value, "dev", "the form keeps what was typed");
  const b = await open("members", { world: t.w, as: t.founder, table: WAITING("memberset") });
  const was = b.html;
  b.press("memberset", { data: { member: "dev", status: "revoked" } });
  await new Promise((res) => setTimeout(res, 10));
  // the shell marks the pressed button busy (interface-shell R74); nothing else is drawn
  assert.equal(b.html.replace(/ aria-busy="true"/g, ""), was, "nothing drawn while the act has not answered");
});

test("R12 each row's name is the member's reference (cs.ref member, opening members/<id>), its panel opened by its own control", async () => {
  const t = await team();
  const a = await open("members", { world: t.w, as: t.founder });
  const named = (await listed(t.founder)).filter((x) => x.handle && x.member_id !== "admin");
  assert.ok(named.length >= 5);
  for (const m of named) {
    const row = rowOf(a.tree, m.member_id, m.handle);
    const ref = all(row, (e) => e.tag === "a" && e.attrs.href === "/app/members/" + m.member_id)[0];
    assert.ok(ref && textOf(ref) === m.handle, `${m.member_id}'s name is its reference`);
    assert.ok(!ancestor(ref, (p) => p.tag === "button"), "never inside its panel's control");
  }
  // control: one not joined yet has no reference
  assert.ok(!all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/members/mai-k").length);
});

test("R23 a member's row offers Make a reset link (passwordresetlink), the link shown once with the sentence that no email is sent", async () => {
  const t = await team();
  const rec = recorded(t.w);
  const a = await open("members", { world: rec.world, as: t.founder });
  assert.ok(btn(panelOf(a.tree, "dev"), "passwordresetlink").length, "in the row's panel");
  assert.ok(!founderActs(a).includes("passwordresetlink") && !btn(panelOf(a.tree, "mai-k"), "passwordresetlink").length, "not for oneself, nor one not joined");
  const r = await a.press("passwordresetlink", { data: { member: "dev" }, reason: "lost their password" });
  assert.deepEqual(r.sent[0].body.member, "dev");
  const made = rec.last("passwordresetlink");
  assert.ok(made && made.link, "the owner made the link");
  const shown = all(a.tree, (e) => e.attrs["data-shown"] === "reset")[0];
  assert.ok(textOf(shown).includes(`${WORLD_ORIGIN}/app/reset#reset=${made.link}`));
  assert.ok(textOf(shown).includes(said("screen.members.reset.shown", { handle: "dev", expires: day(made.expiresAt) })) && textOf(shown).includes(said("screen.members.reset.noemail")));
  assert.equal((await attempt(t.w, null, "passwordresetlook", { body: { link: made.link } })).ok, true, "the link is one the owner holds");
  assert.ok(![...a.b.store.values(), ...a.b.local.values()].some((v) => String(v).includes(made.link)), "kept nowhere");
  // a member who does not administer is offered none
  const m = await open("members", { world: t.w, as: t.dev });
  assert.ok(!btn(m.tree, "passwordresetlink").length);
});

test("R23 More for administrators links group, places and recovery; a member's row offers no signing-key act of its own (R55 draws them in the keys section)", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder });
  for (const id of ["group", "places", "recovery"]) assert.ok(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/" + id).length, id);
  has(a, "screen.members.more.heading");
  for (const m of await listed(t.founder)) assert.ok(!btn(panelOf(a.tree, m.member_id), "signerset").length, `${m.member_id}'s panel`);
  const m = await open("members", { world: t.w, as: t.dev });
  lacks(m, "screen.members.more.heading");
  assert.ok(!m.p.requests.some((r) => r.op === "signerlist"));
});

/* R55 (T51; K3807; DEC-330 A74, B5; DEC-332 (4); DEC-335, DEC-336 (7)): the members' signing keys, withdrawn and reactivated, and one registered for a member */
const keysSection = (o) => all(o.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => textOf(h) === said("screen.members.keys.heading")))[0];
const keyRow = (o, id) => all(keysSection(o), (e) => e.tag === "li" && e.attrs["data-member"] === id)[0];

test("R55 the keys section lists a row for each active member and the founder: who registered each active key and when, the founder named as R51 names her, and no key says so", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder });
  const rows = await listed(t.founder), named = nameIn(rows), keys = (await t.founder.read("signerlist")).signers;
  const sec = keysSection(a);
  assert.ok(sec, "drawn to an administrator");
  const active = rows.filter((m) => m.status === "active");
  assert.ok(all(sec, (e) => e.tag === "li").length === active.length && active.length === 5, "the founder, rosa, dev, ana and lu: each active member once");
  assert.ok(!keyRow(a, "kim") && !keyRow(a, "old") && !keyRow(a, "mai-k"), "no row for a member proposed, revoked or not joined");
  // the founder, named by `member.founder.unnamed` (her roster row has no handle)
  assert.ok(textOf(keyRow(a, "admin")).includes(said("member.founder.unnamed")));
  // each active key: who registered it, named by handle through the roster (the founder as R51 names her), with the day the owner states
  for (const k of keys.filter((x) => x.status === "active")) {
    assert.ok(textOf(keyRow(a, k.member_id)).includes(said("screen.members.key.registered.by.rosa.3", { member: named(k.registered_by), date: day(k.added) })), `${k.member_id}'s key`);
  }
  // an administrator registered lu's key, a day after the founder's and rosa's own
  const lu = keys.find((k) => k.member_id === "lu"), founder = keys.find((k) => k.member_id === "admin");
  assert.equal(lu.registered_by, "rosa");
  assert.notEqual(day(lu.added), day(founder.added));
  // ana has none
  assert.ok(textOf(keyRow(a, "ana")).includes(said("screen.members.no.signing.key.yet")));
  // the notes
  for (const k of ["screen.members.a.signing.key.lets.a", "screen.members.civicsmith.holds.only.the.public", "screen.members.use.this.when.a.member", "screen.members.key.react.withdraw.a.key.when.a", "screen.members.key.react.a.key.a.member.withdrew"]) has(a, k);
});

test("R55 Withdraw is offered on another member's active key and never on the viewer's own (she revokes it on account); it sends signerset revoked for that key", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder });
  const withdraw = (id) => btn(keyRow(a, id), "signerset").filter((b) => b.attrs["data-status"] === "revoked");
  assert.equal(withdraw("admin").length, 0, "not on her own key");
  for (const id of ["dev", "lu", "rosa"]) assert.equal(withdraw(id).length, 1, id);
  assert.ok(textOf(withdraw("dev")[0]).startsWith(said("screen.members.signer.withdraw", { handle: "dev" })));
  const r = await a.press("signerset", { data: { key: KEYS.dev, status: "revoked" } });
  assert.deepEqual(r.sent.find((x) => x.op === "signerset").body, { keyB64: KEYS.dev, status: "revoked" });
  assert.ok(r.sent.some((x) => x.op === "signerlist"), "the list is read again (R8)");
  assert.equal((await t.founder.read("signerlist")).signers.find((k) => k.key_b64 === KEYS.dev).status, "revoked", "the owner withdrew it");
});

test("R55 a withdrawn key reads who withdrew it and when, that it does not sign, and offers Reactivate: signerset active; never for a member who has left", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder });
  const signers = (await t.founder.read("signerlist")).signers, old = signers.find((k) => k.key_b64 === KEYS.devOld);
  assert.equal(old.status, "revoked");
  const row = keyRow(a, "dev");
  assert.ok(textOf(row).includes(said("screen.members.key.react.key.withdrawn.by.rosa.12", { member: old.status_by, date: day(old.status_at) })));
  assert.ok(textOf(row).includes(said("screen.members.key.react.it.does.not.sign")));
  const back = btn(row, "signerset").filter((b) => b.attrs["data-status"] === "active");
  assert.equal(back.length, 1);
  assert.ok(textOf(back[0]).startsWith(said("screen.members.key.react.reactivate.devs.signing.key", { member: "dev" })));
  // explained by its three sentences
  const tip = all(row, (e) => e.attrs["data-tip"] && e.attrs["data-tip"].includes(said("screen.members.key.react.help")))[0];
  assert.ok(tip && tip.attrs["data-tip"].includes(said("screen.members.key.react.help2")) && tip.attrs["data-tip"].includes(said("screen.members.key.react.help3")));
  const r = await a.press("signerset", { data: { key: KEYS.devOld, status: "active" } });
  assert.deepEqual(r.sent.find((x) => x.op === "signerset").body, { keyB64: KEYS.devOld, status: "active" });
  assert.equal((await t.founder.read("signerlist")).signers.find((k) => k.key_b64 === KEYS.devOld).status, "active", "the owner reactivated it");
  // control: a key whose member is no longer active offers no Reactivate (credentials R7 refuses it)
  const b = await keyed(await team());
  const owned = (await b.founder.read("signerlist")).signers;
  const g = await open("members", { world: b.w, as: b.founder, table: keysOfAMemberWhoLeft(owned, KEYS.devOld) });
  assert.ok(textOf(keyRow(g, "dev")).includes(said("screen.members.key.react.it.does.not.sign")));
  assert.ok(!btn(keyRow(g, "dev"), "signerset").some((x) => x.attrs["data-status"] === "active"));
});

test("R55 a registered_by or status_by of `not recorded`, or a null status_at, is never drawn as a person or a day: the unrecorded lines", async () => {
  const t = await keyed(await team());
  // keys written before the registrar and the instant were kept: dev's active key has no registrar, his withdrawn one no author or instant, lu's neither registrar nor day
  legacyKeys(t.w, { unregistered: KEYS.dev, unattributed: KEYS.devOld, undated: KEYS.lu });
  const owned = (await t.founder.read("signerlist")).signers;
  assert.equal(owned.find((k) => k.key_b64 === KEYS.dev).registered_by, "not recorded");
  assert.equal(owned.find((k) => k.key_b64 === KEYS.devOld).status_at, null);
  const a = await open("members", { world: t.w, as: t.founder });
  assert.ok(textOf(keyRow(a, "dev")).includes(said("screen.members.key.registered.unrecorded")));
  assert.ok(textOf(keyRow(a, "dev")).includes(said("screen.members.key.withdrawn.unrecorded")));
  assert.ok(textOf(keyRow(a, "lu")).includes(said("screen.members.key.registered.unrecorded")), "no day drawn");
  assert.ok(!/not recorded|null|undefined/.test(textOf(keysSection(a)).replaceAll(said("screen.members.key.registered.unrecorded"), "").replaceAll(said("screen.members.key.withdrawn.unrecorded"), "")), "nothing else says so");
});

test("R55 Register a key for this member (signeradd): the pasted line is split into keyB64 and comment, with memberId; a line not of that shape, a private key or an empty line sends nothing", async () => {
  const t = await keyed(await team());
  const a = await open("members", { world: t.w, as: t.founder });
  const rows = await listed(t.founder);
  const opts = all(all(a.tree, (e) => e.attrs.id === "ms-who")[0], (e) => e.tag === "option").map((o) => [o.attrs.value, textOf(o)]);
  assert.deepEqual(opts, rows.filter((m) => m.status === "active" && m.handle).map((m) => [m.member_id, m.handle]), "the active members who have a handle; the founder, holding none, is not among them (R64)");
  assert.ok(opts.length === 4 && !opts.some((o) => o[0] === "admin"));
  has(a, "screen.members.keys.whose"); has(a, "screen.members.keys.public"); has(a, "screen.members.keys.public.help");
  has(a, "screen.members.the.one.line.the.member"); has(a, "screen.members.the.record.shows.that.you"); has(a, "screen.members.they.see.it.under.your");
  const line = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAnaKey0000000000000000000000000000000000 ana@laptop";
  const r = await a.press("signeradd", { choose: { "ms-who": "ana" }, values: { "ms-line": line } });
  assert.deepEqual(r.sent[0].body, { memberId: "ana", keyB64: "AAAAC3NzaC1lZDI1NTE5AAAAIAnaKey0000000000000000000000000000000000", comment: "ana@laptop" });
  assert.ok(r.sent.some((x) => x.op === "signerlist"), "the section reads the list again");
  assert.ok((await t.founder.read("signerlist")).signers.some((k) => k.member_id === "ana" && k.comment === "ana@laptop"), "the owner holds it");
  const bare = await a.press("signeradd", { choose: { "ms-who": "dev" }, values: { "ms-line": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDevKey00000000000000000000000000000000000" } });
  assert.deepEqual(bare.sent[0].body, { memberId: "dev", keyB64: "AAAAC3NzaC1lZDI1NTE5AAAAIDevKey00000000000000000000000000000000000" }, "no comment is sent when there is none");
  for (const bad of ["", "AAAAC3NzaC1lZDI1NTE5", "-----BEGIN OPENSSH PRIVATE KEY----- b3BlbnNzaC1rZXktdjE=", "ssh-ed25519 not-base64!", "ssh-ed25519"]) {
    const x = await a.press("signeradd", { choose: { "ms-who": "ana" }, values: { "ms-line": bad } });
    assert.deepEqual(x.sent, [], `nothing is sent for ${JSON.stringify(bad.slice(0, 20))}`);
    assert.equal(a.refused.key, "refusal.BAD_KEY");
  }
});

test("R55 control: a member who does not administer is drawn none of it and reads no signerlist; a failed read is drawn failed, never as no keys", async () => {
  const t = await team();
  const m = await open("members", { world: t.w, as: t.dev });
  assert.equal(keysSection(m), undefined);
  assert.ok(!btn(m.tree, "signeradd").length && !btn(m.tree, "signerset").length);
  const failed = await open("members", { world: t.w, as: t.founder, table: SILENT("signerlist") });
  assert.ok(all(keysSection(failed), (e) => e.attrs["data-state"] === "failed").length === 1);
  assert.ok(!textOf(keysSection(failed)).includes(said("screen.members.no.signing.key.yet")));
});

/* R56 (T51; K3807; DEC-330 A72, B5; DEC-332 (3); DEC-335): what removing an administrator takes; a removal under way is drawn from adminremovalsopen alone */
const arithSection = (o) => all(o.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => textOf(h) === said("screen.members.what.removing.an.administrator.takes")))[0];

test("R56 with adminarith answering the live row for 4 administrators the sentence carries 3 and 4; at 3 and above it says how many votes it takes", async () => {
  const t = await admins(4);
  const live = (await t.founder.read("adminarith")).live;
  assert.equal(live.administrators, 4);
  const a = await open("members", { world: t.w, as: t.founder });
  const sec = arithSection(a);
  assert.ok(sec, "drawn to an administrator");
  assert.ok(textOf(sec).includes(said("screen.members.this.takes.3.of.4", { n: live.votesNeeded, total: live.administrators })));
  assert.ok(textOf(sec).includes(said("screen.members.nothing.here.changes.anything.explain")));
  assert.ok(all(a.tree, (e) => e.tag === "h2" && textOf(e) === said("screen.members.what.removing.an.administrator.takes") && /own rule for removing an administrator/.test(e.attrs["data-tip"])).length, "the heading is explained");
  // the fold of how it changes, with its notes
  const fold = all(sec, (e) => e.tag === "details" && textOf(e).includes(said("screen.members.how.it.changes.with.the")))[0];
  assert.ok(fold);
  for (const k of ["screen.members.removal.takes.a.majority.of", "screen.members.the.one.facing.removal.is", "screen.members.a.lone.administrator.can.never"]) assert.ok(textOf(fold).includes(said(k)), k);
  // the roster lists every counted administrator (the founder's row included): no reconcile fold
  assert.ok(!all(sec, (e) => e.tag === "details" && textOf(e).includes(said("screen.members.founder.if.the.count.is.higher"))).length);
});

test("R56 control: one administrator reads that none can be removed by vote; a roster that lists every counted administrator draws no reconcile fold; more counted than listed draws it with the difference", async () => {
  const one = await admins(1);
  const dev = await one.w.signIn("dev");
  const a = await open("members", { world: one.w, as: one.founder });
  const sec = arithSection(a);
  assert.ok(textOf(sec).includes(said("screen.members.with.1.administrator.no.administrator", { n: 1 })));
  assert.ok(textOf(sec).includes(said("screen.members.a.majority.that.leaves.out")) && textOf(sec).includes(said("screen.members.that.is.the.rule.holding")));
  assert.ok(!textOf(sec).includes(said("screen.members.this.takes.3.of.4", { n: 1, total: 1 })));
  // two counted, one listed: the founder is counted and the roster has no entry for her (membership R147 not claimed)
  const t2 = await admins(2);
  const rosa = (await listed(t2.founder)).filter((m) => m.member_id === "rosa");
  const two = await open("members", { world: t2.w, as: t2.founder, table: rosterOf(rosa) });
  const fold = all(arithSection(two), (e) => e.tag === "details" && textOf(e).includes(said("screen.members.founder.if.the.count.is.higher")))[0];
  assert.ok(fold, "more counted than listed");
  assert.ok(textOf(fold).includes(said("screen.members.founder.the.count.includes.1.administrator", { n: 1 })));
  assert.ok(!textOf(arithSection(two)).includes(said("screen.members.with.1.administrator.no.administrator", { n: 2 })), "no singular sentence for 2");
  const t5 = await admins(5);
  const counted = (await t5.founder.read("adminarith")).live.administrators;
  const three = await open("members", { world: t5.w, as: t5.founder, table: rosterOf((await listed(t5.founder)).filter((m) => m.member_id === "rosa")) });
  assert.ok(textOf(arithSection(three)).includes(said("screen.members.founder.the.count.includes.n.administrators", { n: counted - 1 })));
  // a member who does not administer is drawn none (R47's table), and reads no arithmetic
  const m = await open("members", { world: one.w, as: dev });
  assert.equal(arithSection(m), undefined);
  assert.ok(!m.p.requests.some((r) => r.op === "adminarith"));
  // no block of a removal under way is drawn, whatever the roster holds
  assert.equal(all(a.tree, (e) => e.attrs["data-removal"] !== undefined).length, 0, "no removal under way");
  // a failed read is drawn failed
  const f = await open("members", { world: one.w, as: one.founder, table: SILENT("adminarith") });
  assert.ok(all(arithSection(f), (e) => e.attrs["data-state"] === "failed").length === 1);
});

/* R29, R35, R51: the counts agree with what they name, and the founder's row is the roster's own */
test("R29 Administrators and Active members count the roster as listed, the founder's row once among them (R51)", async () => {
  const t = await admins(2);
  const dev = await t.w.signIn("dev");
  const rows = await listed(t.founder);
  assert.ok(rows.some((m) => m.member_id === "admin") && rows.some((m) => m.member_id === "rosa"));
  const a = await open("members", { world: t.w, as: t.founder });
  has(a, "screen.members.count", countOf(rows));
  assert.deepEqual(countOf(rows), { members: 3, administrators: 2 });
  // the same count to a member who does not administer
  const m = await open("members", { world: t.w, as: dev });
  has(m, "screen.members.count", countOf(await listed(dev)));
  // control: an unclaimed team's roster holds no founder row, so none is counted; a proposed or revoked administrator is not counted
  const unclaimed = withoutFounder(rows);
  const u = await open("members", { world: t.w, as: t.founder, table: rosterOf(unclaimed) });
  has(u, "screen.members.count", countOf(unclaimed));
  assert.deepEqual([countOf(unclaimed).members, countOf(unclaimed).administrators], [countOf(rows).members - 1, countOf(rows).administrators - 1], "the founder is the one not counted");
  const full = await team();
  const all8 = await listed(full.founder);
  assert.ok(all8.some((x) => x.role === "admin" && x.status === "proposed") && all8.some((x) => x.status === "revoked"));
  const f = await open("members", { world: full.w, as: full.founder });
  has(f, "screen.members.count", countOf(all8));
  assert.ok(countOf(all8).members < all8.length, "not every row is counted");
});

test("R29 control: a member with no expertise shows no Expertise, and an empty cell draws nothing", async () => {
  const t = await team();
  const a = await open("members", { world: t.w, as: t.founder });
  const cells = (key) => all(rowOf(a.tree, key), (e) => e.tag === "td").map((c) => textOf(c).trim());
  const expertise = (key) => cells(key)[5];   // handle, cover, role, may do, status, expertise (then the projects, R47)
  assert.equal(expertise("dev"), "", "dev declared nothing: the cell is empty");
  assert.ok(expertise("ana").includes("CPA"), "ana declared CPA");
  assert.ok(!textOf(rowOf(a.tree, "dev")).match(/undefined|null/));
});

test("R35, R51 a claimed team with no founder handle held draws her row from the roster, handle null: Active members 2, Administrators 1 with one other member; never named by admin", async () => {
  const t = await admins(1);
  await t.w.signIn("ana");
  const rows = await listed(t.founder);
  const row0 = rows.find((m) => m.member_id === "admin");
  assert.equal(row0.handle, null, "the owner's row for her holds no handle");
  const a = await open("members", { world: t.w, as: t.founder });
  has(a, "screen.members.count", countOf(rows));
  assert.deepEqual(countOf(rows), { members: 2, administrators: 1 });
  const row = rowOf(a.tree, "admin", said("member.founder.unnamed") + said("member.founder.unnamed.help"));
  assert.ok(row, "her row is drawn");
  assert.ok(textOf(row).includes(said("member.founder.unnamed")) && textOf(row).includes(said("member.founder.unnamed.help")), "named, and explained");
  assert.ok(textOf(row).includes(said("screen.members.role.admin")) && textOf(row).includes(said("screen.members.status.active")));
  assert.ok(!/\badmin\b/.test(a.text.replace(said("screen.members.role.admin"), "")), "never named by admin");
  assert.equal(all(a.tree, (e) => e.tag === "details" && textOf(e).includes(said("member.founder.unnamed.summary"))).length, 0, "her row stays in the roster, not folded");
  assert.equal(all(a.tree, (e) => e.tag === "tr").filter((r) => textOf(r).includes(said("member.founder.unnamed"))).length, 1, "the page adds no row of its own");
  // no act removes or resets the founder
  assert.deepEqual(founderActs(a), [], "no act on her row");
  // control: an unclaimed team's roster holds no founder row, so none is drawn
  const none = withoutFounder(rows);
  const u = await open("members", { world: t.w, as: t.founder, table: rosterOf(none) });
  has(u, "screen.members.count", countOf(none));
  assert.equal(rowOf(u.tree, "admin", said("member.founder.unnamed") + said("member.founder.unnamed.help")), null);
});

test("R35 control: with her handle held her row draws it, in her own session and wherever the roster answers it", async () => {
  const t = await team({ named: true });
  const rows = await listed(t.founder);
  assert.equal(rows.find((m) => m.member_id === "admin").handle, "founder");
  const mine = await open("members", { world: t.w, as: t.founder });
  assert.ok(textOf(rowOf(mine.tree, "admin", "founder")).includes("founder"));
  assert.ok(!mine.text.includes(said("member.founder.unnamed.help")), "no explanation once she has a handle");
  // a roster that answers her row with her handle names her to every reader
  const other = await open("members", { world: t.w, as: t.rosa });
  has(other, "screen.members.count", countOf(await listed(t.rosa)));
  assert.ok(textOf(rowOf(other.tree, "admin", "founder")).includes("founder"));
  assert.ok(!other.text.includes(said("member.founder.unnamed.help")));
});

test("R56 the scale table: a row for each count of administrators from adminarith's table, the live row marked (now) and aria-current; one administrator reads not removable", async () => {
  const t = await admins(4);
  const arith = await t.founder.read("adminarith");
  const a = await open("members", { world: t.w, as: t.founder });
  const table = all(a.tree, (e) => e.tag === "table" && e.attrs["data-list"] === "scale")[0];
  assert.ok(table);
  assert.deepEqual(all(table, (e) => e.tag === "th").map((h) => textOf(h)), ["screen.members.scale.head.admins", "screen.members.scale.head.takes", "screen.members.scale.head.who"].map((k) => said(k)));
  const rows = all(table, (e) => e.tag === "tr").slice(1);
  assert.equal(rows.length, arith.table.length);
  const cells = (r) => all(r, (e) => e.tag === "td").map((c) => textOf(c).replace(/\s+/g, " ").trim());
  const at = arith.table.findIndex((x) => x.administrators === arith.live.administrators), live = arith.table[at];
  assert.deepEqual(cells(rows[at]), [live.administrators + " " + said("screen.members.scale.now"), said("screen.members.scale.takes", { k: live.votesNeeded, n: live.administrators }), said("screen.members.scale.who", { v: live.eligibleVoters, n: live.administrators })]);
  assert.deepEqual(rows.filter((r) => r.attrs["aria-current"] === "true"), [rows[at]], "only the live row is current");
  assert.equal(arith.table[0].possible, false);
  assert.equal(cells(rows[0])[1], said("screen.members.scale.not_removable"));
  assert.equal(cells(rows[1])[2], said("screen.members.scale.no_majority"));
});

test("R56 a removal under way is drawn from adminremovalsopen alone: who it waits for, how many of those who may vote have agreed, the one facing removal counted and not voting; none under way draws no block; a failed read is drawn failed", async () => {
  const t = await removing(await team());
  const under = (await t.founder.read("adminremovalsopen")).removals;
  assert.equal(under.length, 1);
  const [removal] = under, rows = await listed(t.founder), named = nameIn(rows);
  const eligible = removal.voters.length + removal.awaiting.length;
  const a = await open("members", { world: t.w, as: t.founder });
  const block = all(a.tree, (e) => e.attrs["data-removal"] === removal.target)[0];
  assert.ok(block, "drawn from the answer");
  const tx = textOf(block).replace(/\s+/g, " ");
  const target = named(removal.target), voter = named(removal.voters[0].voter), waited = named(removal.awaiting[0]);
  assert.ok(tx.includes(said("screen.members.2.of.3.have.agreed", { n: removal.have, total: eligible })));
  assert.ok(tx.includes(said("screen.members.teo.is.counted.but.doesn", { member: target, n: eligible })));
  assert.ok(tx.includes(said("screen.members.the.removal.waits.for.ana", { member: waited })));
  assert.ok(tx.includes(said("screen.members.removal.heading")));
  assert.ok(tx.includes(said("screen.members.removal.agreed", { member: voter })) && tx.includes(day(removal.voters[0].at)), "who agreed, the day beside");
  assert.ok(tx.includes(said("screen.members.removal.notyet", { member: waited })));
  assert.ok(tx.includes(said("screen.members.removal.faces", { member: target })));
  assert.ok(tx.includes(said("screen.members.removing.teo.as.an.administrator", { member: target })));
  const everyone = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format([...removal.voters.map((v) => named(v.voter)), ...removal.awaiting.map(named), target]);
  assert.ok(tx.includes(said("screen.members.four.administrators.rosa.dev.ana", { n: eligible + 1, members: everyone })));
  assert.ok(tx.includes(said("screen.members.counted.in.the.4.doesn", { n: eligible + 1 })));
  // "Agree" is on the viewer's own row only: the founder has not voted, so she is offered it
  assert.deepEqual(removal.awaiting, ["admin"]);
  assert.equal(btn(block, "adminremove").length, 1);
  await reauth(t.founder);
  assert.deepEqual((await a.press("adminremove", { data: { member: "lu" }, values: { "rm-lu": " we agree " } })).sent[0].body, { memberId: "lu", reason: "we agree" });
  assert.equal((await listed(t.founder)).find((m) => m.member_id === "lu").status, "revoked", "the vote that carries it removes lu");
  // not drawn on another's row: with four administrators the removal waits for a third vote, and the founder, who has voted, is not offered it
  const four = await admins(4);
  await reauth(four.founder);
  const voters = [four.founder, await four.w.signIn("rosa")];
  for (const v of voters) { await reauth(v); assert.equal((await attempt(four.w, v, "adminremove", { body: { memberId: "ana2", reason: "moved away" } })).reason, "VOTES_SHORT"); }
  const other = await open("members", { world: four.w, as: four.founder });
  assert.equal(btn(all(other.tree, (e) => e.attrs["data-removal"] === "ana2")[0], "adminremove").length, 0, "not drawn on another's row");
  // control: none under way, whatever the roster holds, draws nothing
  const fresh = await team();
  const none = await open("members", { world: fresh.w, as: fresh.founder });
  assert.equal(all(none.tree, (e) => e.attrs["data-removal"] !== undefined).length, 0);
  // a failed read is drawn failed in the section, never as none under way
  const f = await open("members", { world: fresh.w, as: fresh.founder, table: SILENT("adminremovalsopen") });
  assert.equal(all(arithSection(f), (e) => e.attrs["data-state"] === "failed").length, 1);
  // a member who does not administer reads none of it
  const m = await open("members", { world: fresh.w, as: fresh.dev });
  assert.ok(!m.p.requests.some((r) => r.op === "adminremovalsopen"));
});

/* ---- T51 FR-25: C79 and DEC-386 (R63), C80 (R64), L30 (R71), T-05 (R72) ---- */

test("R63 a confirmed expertise offers Withdraw an expertise, its own act: expertisewithdraw sends memberId, label and the reason; an unconfirmed one still offers Confirm and no withdrawal (control)", async () => {
  const t = await team();
  await t.founder.act("expertiseconfirm", { body: { memberId: "ana", label: "CPA" } });
  await t.ana.act("expertisedeclare", { body: { label: "Zoning" } });
  const a = await open("members", { world: t.w, as: t.founder, subject: "ana" });
  const panel = panelOf(a.tree, "ana");
  const withdraw = btn(panel, "expertisewithdraw");
  assert.equal(withdraw.length, 1, "one withdrawal, for the confirmed label");
  assert.equal(withdraw[0].attrs["data-label"], "CPA");
  assert.ok(textOf(withdraw[0]).includes(said("act.owed_expertisewithdraw.label.members")));
  assert.deepEqual(btn(panel, "expertiseconfirm").map((b) => b.attrs["data-label"]), ["Zoning"], "control: the declared one is confirmed, not withdrawn");
  // nothing is sent until a reason is given
  const none = await a.press("expertisewithdraw", { data: { member: "ana", label: "CPA" }, reason: null });
  assert.deepEqual(none.sent, []);
  const r = await a.press("expertisewithdraw", { data: { member: "ana", label: "CPA" }, reason: "She no longer practises." });
  assert.equal(r.asked, true, "an administrator's act asks its reason (interface-shell R107)");
  assert.deepEqual([r.sent[0].op, r.sent[0].body], ["expertisewithdraw", { memberId: "ana", label: "CPA", reason: "She no longer practises." }]);
  assert.ok(r.sent.some((x) => x.op === "memberlist") && r.sent.some((x) => x.op === "expertiselist"), "the roster and the expertise are read again");
  assert.equal((await t.founder.read("expertiselist", { query: { memberId: "ana" } })).expertise.find((e) => e.label === "CPA").state, "withdrawn", "the owner took it back");
  // confirming still sends expertiseconfirm
  const c = await a.press("expertiseconfirm", { data: { member: "ana", label: "Zoning" } });
  assert.deepEqual([c.sent[0].op, c.sent[0].body], ["expertiseconfirm", { memberId: "ana", label: "Zoning" }]);
});

test("R63 control: no withdrawal for an expertise already withdrawn, nor to a member who does not administer", async () => {
  const t = await team();
  await t.founder.act("expertiseconfirm", { body: { memberId: "ana", label: "CPA" } });
  const confirmed = await open("members", { world: t.w, as: t.dev });
  assert.deepEqual(acts(confirmed.tree), []);
  assert.ok(textOf(all(confirmed.tree, (e) => e.tag === "tr").find((r) => textOf(r).startsWith("ana"))).includes(said("screen.members.expertise.confirmed", { label: "CPA" })), "the member reads it confirmed");
  await t.founder.act("expertisewithdraw", { body: { memberId: "ana", label: "CPA", reason: "no longer practises" } });
  const a = await open("members", { world: t.w, as: t.founder, subject: "ana" });
  assert.deepEqual(btn(a.tree, "expertisewithdraw"), []);
  const m = await open("members", { world: t.w, as: t.dev });
  assert.deepEqual(acts(m.tree), []);
});

test("R64 the signing-key chooser lists the founder, first, once the instance is claimed and she holds a handle; a roster without her row, or her with none, is unchanged (control)", async () => {
  const named = await team({ named: true });
  const a = await open("members", { world: named.w, as: named.founder });
  const optionsOf = (o) => all(all(o.tree, (e) => e.attrs.id === "ms-who")[0], (e) => e.tag === "option").map((x) => [x.attrs.value, textOf(x)]);
  const rows = await listed(named.founder);
  const others = rows.filter((m) => m.status === "active" && m.handle && m.member_id !== "admin").map((m) => [m.member_id, m.handle]);
  assert.deepEqual(optionsOf(a), [["admin", "founder"], ...others]);
  // a key registered for her is registered for the id the roster holds her under
  const key = "AAAAC3NzaC1lZDI1NTE5AAAAIFounderKey000000000000000000000000000001";
  const r = await a.press("signeradd", { choose: { "ms-who": "admin" }, values: { "ms-line": "ssh-ed25519 " + key } });
  assert.deepEqual(r.sent[0].body, { memberId: "admin", keyB64: key });
  assert.equal((await named.founder.read("signerlist")).signers.find((k) => k.key_b64 === key).member_id, "admin", "the owner holds it for her");
  // control: before the claim the roster holds no row for her; claimed with no handle held she is not offered
  const unclaimed = await open("members", { world: named.w, as: named.founder, table: rosterOf(withoutFounder(rows)) });
  assert.deepEqual(optionsOf(unclaimed).map((o) => o[0]), others.map((o) => o[0]));
  const nameless = await team();
  const n = await open("members", { world: nameless.w, as: nameless.founder });
  assert.ok(!optionsOf(n).some((o) => o[0] === "admin"));
});

test("R71 a member's name is a reference to their handle, not to the id they were invited under; opening that address opens that member's row", async () => {
  const t = await team();
  const newcomer = await joined(t.w, t.founder, { memberId: "journeys-newcomer", handle: "jrn-newcomer", cover: "Journeys newcomer" });
  await newcomer.act("expertisedeclare", { body: { label: "CPA" } });
  await t.founder.act("expertiseconfirm", { body: { memberId: "journeys-newcomer", label: "CPA" } });
  const a = await open("members", { world: t.w, as: t.founder, subject: "jrn-newcomer" });
  const row = rowOf(a.tree, "journeys-newcomer", "jrn-newcomer");
  const refs = all(row, (e) => e.tag === "a" && /^\/app\/members\//.test(e.attrs.href || ""));
  assert.deepEqual(refs.map((e) => e.attrs.href), ["/app/members/jrn-newcomer"], "the address carries the handle");
  assert.ok(!all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/members/journeys-newcomer").length, "never the id");
  // the row for that address is open, with its own expertise and acts
  assert.ok(btn(panelOf(a.tree, "journeys-newcomer"), "expertisewithdraw").length, "its panel is open");
  // control: an address that is the id still opens the row (a link kept from before)
  const old = await open("members", { world: t.w, as: t.founder, subject: "journeys-newcomer" });
  assert.ok(btn(panelOf(old.tree, "journeys-newcomer"), "expertisewithdraw").length);
  // control: a member whose handle equals their id is unchanged
  assert.ok(all(rowOf(a.tree, "ana", "ana"), (e) => e.tag === "a" && e.attrs.href === "/app/members/ana").length);
});

test("R72 choosing the grant that includes administering draws the confirmation and sends nothing; Go back sends nothing and unticks it; Make them an administrator sends the declared fields; a grant without administering sends at once (control)", async () => {
  const t = await admins(3);
  const a = await open("members", { world: t.w, as: t.founder });
  const fill = { "mi-id": "lee", "mi-cover": "Lee from 62nd" };
  const caps = (vocab) => [...vocab, "administer"];
  const idx = caps((await t.founder.read("whoami")).vocabulary).indexOf("administer");
  // nothing drawn before the choice; the invitation button is there
  lacks(a, "screen.members.cap.administer.confirm.head", { who: "Lee from 62nd" });
  // type who, then choose the grant
  for (const [id, v] of Object.entries(fill)) { const el = a.b.doc.getElementById(id); el.value = v; }
  const before = a.p.requests.length;
  await a.tick("mi-caps-" + idx, true);
  has(a, "screen.members.cap.administer.confirm.head", { who: "Lee from 62nd" });
  has(a, "screen.members.cap.administer.confirm", { who: "Lee from 62nd" });
  has(a, "screen.members.cap.administer.confirm.yes", { who: "Lee from 62nd" });
  has(a, "screen.members.cap.administer.confirm.no");
  assert.equal(a.p.requests.length, before, "choosing sends nothing");
  assert.deepEqual(btn(a.tree, "memberadd"), [], "the invitation waits for the answer");
  // Go back: nothing sent, the grant is unticked and the invitation button is back
  await a.tick("mi-ok-1", true);
  assert.equal(a.p.requests.length, before, "Go back sends nothing");
  lacks(a, "screen.members.cap.administer.confirm.head", { who: "Lee from 62nd" });
  assert.equal(a.b.doc.getElementById("mi-caps-" + idx).checked, false);
  assert.equal(btn(a.tree, "memberadd").length, 1);
  // choose it again and confirm: the declared fields are sent
  await a.tick("mi-caps-" + idx, true);
  await a.tick("mi-ok-0", true);
  const r = await a.press("memberadd", {});
  assert.deepEqual(r.sent[0].body, { memberId: "lee", cover: "Lee from 62nd", capabilities: ["contribute"], role: "admin" });
  // control: without administering the invitation is sent at once
  const b2 = await open("members", { world: t.w, as: t.founder });
  const plain = await b2.press("memberadd", { values: { "mi-id": "kay", "mi-cover": "Kay", "mi-caps-0": true } });
  assert.deepEqual(plain.sent[0].body, { memberId: "kay", cover: "Kay", capabilities: ["contribute"] });
  assert.equal(plain.sent[0].body.role, undefined);
  assert.ok((await listed(t.founder)).some((m) => m.member_id === "kay"), "the owner invited kay");
  // pressing the invitation with the grant ticked and no answer given sends nothing and draws the confirmation
  const c = await open("members", { world: t.w, as: t.founder });
  const stuck = await c.press("memberadd", { values: { "mi-id": "lee", "mi-cover": "Lee", ["mi-caps-" + idx]: true } });
  assert.deepEqual(stuck.sent, []);
  has(c, "screen.members.cap.administer.confirm.head", { who: "Lee" });
});

/* ---- T51 fix round 2: C89, C90, C94 ---- */

test("R2 C89: inviting a third administrator is a proposal the plane records: it is drawn as done (not as a refusal) with who must still endorse, the roster is read again and shows the proposed member; control: another refusal is still a refusal, and an invitation that is not for an administrator is unchanged", async () => {
  const t = await team();
  const rec = recorded(t.w);
  await reauth(t.founder);
  const a = await open("members", { world: rec.world, as: t.founder });
  const idx = [...(await t.founder.read("whoami")).vocabulary, "administer"].indexOf("administer");
  for (const [id, v] of Object.entries({ "mi-id": "lee", "mi-cover": "Lee from 62nd" })) a.b.doc.getElementById(id).value = v;
  await a.tick("mi-caps-" + idx, true);
  await a.tick("mi-ok-0", true);
  const before = a.p.requests.filter((r) => r.op === "memberlist").length;
  const r = await a.press("memberadd", {});
  assert.equal(a.p.requests.filter((x) => x.op === "memberadd").length, 1, "one request for the proposal");
  assert.deepEqual(r.sent.find((x) => x.op === "memberadd").body, { memberId: "lee", cover: "Lee from 62nd", capabilities: ["contribute"], role: "admin" });
  const proposal = rec.last("memberadd");
  assert.equal(proposal.reason, "CONSENSUS_REQUIRED");
  assert.ok(proposal.awaiting.length >= 2);
  const done1 = all(a.tree, (e) => e.attrs["data-state"] === "done" && e.attrs.role === "status")[0];
  assert.ok(done1, "drawn as done, in the shell's done style");
  assert.ok(!all(a.tree, (e) => e.attrs.role === "alert").length, "not drawn as a refusal");
  const named = nameIn(await listed(t.founder));
  assert.equal(squash(textOf(done1)), said("refusal.CONSENSUS_REQUIRED", { awaiting: proposal.awaiting.map(named).join(", ") }), "who must still endorse, by handle");
  assert.ok(!all(a.tree, (e) => e.attrs["data-shown"] === "proposed").length, "the screen draws no sentence of its own for it");
  assert.ok(a.p.requests.filter((x) => x.op === "memberlist").length > before, "the roster is read again");
  assert.ok((await listed(t.founder)).some((m) => m.member_id === "lee" && m.status === "proposed"));
  assert.ok(a.text.includes("Lee from 62nd") || rowOf(a.tree, "lee"), "the proposed member is in the roster");
  // control: any other refusal is drawn as one (an id the team already holds, for an administrator)
  const b = await open("members", { world: t.w, as: t.founder });
  for (const [id, v] of Object.entries({ "mi-id": "dev", "mi-cover": "Lee" })) b.b.doc.getElementById(id).value = v;
  await b.tick("mi-caps-" + idx, true);
  await b.tick("mi-ok-0", true);
  await b.press("memberadd", {});
  assert.ok(b.refused && b.refused.key === "refusal.EXISTS", JSON.stringify(b.refused));
  assert.ok(all(b.tree, (e) => e.attrs.role === "alert").length, "drawn as a refusal");
  // control: not for an administrator, sent as before
  const c = await open("members", { world: t.w, as: t.founder });
  const plain = await c.press("memberadd", { values: { "mi-id": "kay", "mi-cover": "Kay", "mi-caps-0": true } });
  assert.deepEqual(plain.sent[0].body, { memberId: "kay", cover: "Kay", capabilities: ["contribute"] });
});

test("R2 C89: endorsing a proposed administrator while others must still endorse is done, with who must still endorse by handle, and the roster is read again; control: a real refusal of the act is still a refusal", async () => {
  const t = await team();
  const rec = recorded(t.w);
  await reauth(t.founder);
  const a = await open("members", { world: rec.world, as: t.founder });
  const before = a.p.requests.filter((r) => r.op === "memberlist").length;
  const r = await a.press("adminendorse", { data: { member: "kim" } });
  assert.deepEqual(r.sent.find((x) => x.op === "adminendorse").body, { memberId: "kim" });
  const endorsed = rec.last("adminendorse");
  assert.equal(endorsed.reason, "CONSENSUS_REQUIRED");
  assert.deepEqual(endorsed.awaiting, ["lu"], "rosa proposed it and the founder endorsed it: lu is awaited");
  assert.ok(!all(a.tree, (e) => e.attrs.role === "alert").length, "not drawn as a refusal");
  const note = all(a.tree, (e) => e.attrs["data-state"] === "done" && e.attrs.role === "status")[0];
  assert.ok(note, "drawn as done");
  const named = nameIn(await listed(t.founder));
  assert.equal(squash(textOf(note)), said("refusal.CONSENSUS_REQUIRED", { awaiting: endorsed.awaiting.map(named).join(", ") }));
  assert.ok(a.p.requests.filter((x) => x.op === "memberlist").length > before, "the roster is read again");
  // control: any other refusal of the act is a refusal (a page drawn while kim was still proposed, pressed after the others endorsed her: the owner refuses it NOT_PROPOSED)
  const fresh = await team();
  const b = await open("members", { world: fresh.w, as: fresh.founder });
  for (const who of [fresh.lu, fresh.founder]) { await reauth(who); await attempt(fresh.w, who, "adminendorse", { body: { memberId: "kim" } }); }
  await b.press("adminendorse", { data: { member: "kim" } });
  assert.ok(b.refused && b.refused.key === "refusal.NOT_PROPOSED", JSON.stringify(b.refused));
  assert.ok(all(b.tree, (e) => e.attrs.role === "alert").length, "drawn as a refusal");
  assert.ok(!all(b.tree, (e) => e.attrs["data-state"] === "done" && e.attrs.role === "status").length, "no done sentence beside a refusal");
});

test("R56 C90: the vote to remove an administrator is not drawn where the plane cannot carry it (two administrators); with three, or with the count unread, it is (control)", async () => {
  const two = await admins(2);
  const o2 = await open("members", { world: two.w, as: two.founder });
  assert.equal((await two.founder.read("adminarith")).live.possible, false);
  assert.deepEqual(btn(panelOf(o2.tree, "rosa"), "adminremove"), [], "no removal vote at two administrators");
  has(o2, "screen.members.a.majority.that.leaves.out");
  const three = await admins(3);
  const o3 = await open("members", { world: three.w, as: three.founder });
  assert.equal(btn(panelOf(o3.tree, "lu"), "adminremove").length, 1);
  const unread = await open("members", { world: three.w, as: three.founder, table: ARITH_REFUSED });
  assert.equal(btn(panelOf(unread.tree, "lu"), "adminremove").length, 1, "an unread count hides nothing");
});

test("R55 R56 C94: a key's registrar and a removal's voters are named by memberName: a member the roster does not hold or who has no handle by the fallback word, never an id", async () => {
  const t = await keyed(await team());
  // dev's active key was registered by a member the roster does not hold; his withdrawn key was withdrawn by one who has no handle yet
  strangersKeys(t.w, { registeredBy: KEYS.dev, withdrawnBy: KEYS.devOld });
  const signers = (await t.founder.read("signerlist")).signers;
  const a = await open("members", { world: t.w, as: t.founder });
  const dev = textOf(all(a.tree, (e) => e.tag === "li" && e.attrs["data-member"] === "dev")[0]);
  const live = signers.find((k) => k.key_b64 === KEYS.dev), old = signers.find((k) => k.key_b64 === KEYS.devOld);
  assert.ok(dev.includes(said("screen.members.key.registered.by.rosa.3", { member: said("shell.card.member"), date: day(live.added) })), dev);
  assert.ok(dev.includes(said("screen.members.key.react.key.withdrawn.by.rosa.12", { member: said("shell.card.member"), date: day(old.status_at) })), dev);
  for (const id of ["ghost-7", "mai-k"]) assert.ok(!a.text.includes(id), id + " is not drawn");
  // a voter and the one awaited, by handle or the fallback word
  const b = await open("members", { world: t.w, as: t.founder, table: removalByStrangers });
  const block = textOf(all(b.tree, (e) => e.attrs["data-removal"] === "lu")[0]).replace(/\s+/g, " ");
  assert.ok(block.includes(said("screen.members.removal.agreed", { member: said("shell.card.member") })));
  assert.ok(block.includes(said("screen.members.removal.notyet", { member: said("shell.card.member") })));
  for (const id of ["ghost-7", "mai-k"]) assert.ok(!block.includes(id), id + " is not drawn");
});
