/* What holds across the screens: R8 (after an act answers, the screen reads again what it changes and draws it;
   nothing is drawn as done before the answer) and R10 (no key, code or password typed on these screens is written to
   the browser's storage, an address or a later request), driven over every act of every screen. Over the world (store-request):
   each screen is opened as the member who finds it, over a team made by the real acts of its members (`seed-common`). */
import test from "node:test";
import assert from "node:assert/strict";
import { all, ancestor, day, has, open, said, textOf, walk } from "./kit.mjs";
import { env, refuse } from "./fixtures.mjs";
import { TEAMS, teamNamed, RUNS, readsOf, subjectOf, fullTeam, reauth, KEYS, G, S } from "./seed-common.mjs";
import { key as keyOf } from "./seed-members.mjs";
import { rulesTeam } from "./seed-places.mjs";
import { writingHelp } from "./seed-account.mjs";

const SECRET = "SENTINEL-SECRET-0123456789";
const TOOL_SECRET = "SENTINEL-intelix-client_secret";
const iso = (w, days) => new Date(w.now() - days * 86400000).toISOString().slice(0, 10);

/* Every act of every screen, pressed so that it is sent: { team, screen, op, who, press, table, setup, secret }. `team` names the world it is pressed over
   (`seed-common`'s TEAMS), `who` the member who presses it; `press` is `{data, values, reason, choose, wait}` (or a function of the team, for what the
   team's owners made); `table` the platform's edge (a double of the model); `setup` what the session needs before (the password asked again, a new
   session); `secret` the text typed that must be kept nowhere. Acts of one team are pressed in the order listed, over one world. */
const again = async (t) => { t.dev = await t.w.signIn("dev"); };
const asked = async (t) => { await reauth(t.founder); };
const P = (team, screen, op, press = {}, o = {}) => ({ team, screen, op, press, who: "founder", ...o });
const PRESSES = [
  P("full", "members", "memberadd", { values: { "mi-id": "x1", "mi-cover": "X", "mi-caps-0": true } }),
  P("full", "members", "membercaps", { data: { member: "dev" }, values: { "mc-dev-contribute": true } }),
  P("full", "members", "adminendorse", { data: { member: "kim" } }, { setup: asked }),
  P("full", "members", "adminremove", { data: { member: "lu" }, values: { "mr-lu": "away" } }, { setup: asked }),
  P("full", "members", "expertiseconfirm", { data: { member: "ana", label: "Zoning" } }),
  P("full", "members", "invitewithdraw", { data: { member: "mai-k" } }),
  P("full", "members", "expertisewithdraw", { data: { member: "ana", label: "CPA" } }),
  P("full", "members", "websitekeycreate", { values: { "mw-cap": "4" } }),
  P("full", "members", "joinlinkenable", { values: { "mw-cap": "4" } }),
  // T47
  P("full", "members", "passwordresetlink", { data: { member: "dev" }, reason: "lost it" }),
  P("full", "members", "signerset", { data: { key: KEYS.dev, status: "revoked" }, reason: "stolen" }),
  // T51 (R55, R61): a key registered for a member; a rule confirmed and one withdrawn (`ruledraft` and `writinghelp` of grouprules are held, J1)
  P("full", "members", "signeradd", { choose: { "ms-who": "ana" }, values: { "ms-line": "ssh-ed25519 " + keyOf("ana") + " ana@laptop" } }),
  P("full", "members", "memberset", { data: { member: "dev", status: "revoked" } }),
  P("full", "account", "memberlanguageset", { values: { "ma-lang": "es" } }, { who: "dev" }),
  P("full", "account", "infolevelset", { values: { "ma-level": "pause" } }, { who: "dev" }),
  P("full", "account", "memberpairingset", { values: { "ma-pair-1": true } }, { who: "dev" }),
  P("full", "account", "expertisedeclare", { values: { "ma-exp": "Law" } }, { who: "dev" }),
  P("full", "account", "signerregisterown", { values: { "ma-keep": true }, wait: true }, { who: "dev" }),
  P("full", "account", "signerrevokeown", { data: { key: KEYS.dev } }, { who: "dev" }),
  P("full", "account", "signout", {}, { who: "dev", setup: again }),
  P("full", "account", "signouteverywhere", {}, { who: "dev", setup: again }),
  P("full", "account", "setpassword", (t) => ({ values: { "ma-cur0": t.dev.password, "ma-new0": SECRET, "ma-again0": SECRET } }), { who: "dev", secret: SECRET, setup: again }),
  P("full", "notes", "notewrite", { values: { "mn-new": "n" } }, { who: "dev" }),
  P("full", "notes", "writinghelp", { data: { field: "new", id: "mn-new" }, values: { "mn-new": "n" } }, { who: "dev", table: (t) => writingHelp(t.dev.member) }),
  P("full", "notes", "noterevise", { data: { note: "2" }, values: { "mn-r2": "n" } }, { who: "dev" }),
  P("full", "notes", "noteturn", (t) => ({ data: { note: "2" }, values: { "mn-observation2": true, "mn-made2": t.lead2 } }), { who: "dev" }),
  P("full", "notes", "notedelete", { data: { note: "2" } }, { who: "dev" }),
  P("rules", "grouprules", "ruleconfirm", (t) => ({ data: { rule: t.ids.tier1 }, reason: "checked" }), { who: "dev" }),
  P("rules", "grouprules", "rulewithdraw", (t) => ({ data: { rule: t.ids.inForce }, reason: "repealed" }), { who: "dev" }),
  P("rules", "grouprules", "ruledraft", (t) => ({ values: { "gr-name": "Comment cutoff", "gr-amount": "5", "gr-cite": "Rule 4", "gr-eff": "2026-07-01", "gr-why": "we need it", "gr-doc": t.doc.sha, "gr-pass": "Comments close five days before the meeting." }, choose: { "gr-app": "public_comment" } }), { who: "ana" }),
  P("full", "group", "groupnameset", { values: { "gr-name": "G" } }),
  P("full", "group", "groupdomainset", { values: { "gr-domain": "g.example" } }),
  P("full", "group", "grouplanguagesset", { values: { "gr-langs": "en es" }, reason: "r" }),
  P("full", "group", "courtnoticeset", { values: { "gr-court-dont": true } }),
  P("full", "group", "hostingaccessset", { values: { "gr-holders": "Rosa" } }),
  P("full", "group", "strengthbarset", { values: { "gr-cap": "A", "gr-why": "why" } }),
  P("full", "places", "profilesset", async (t) => ({ values: { ["pl-p-" + (await t.founder.read("profiles")).choices[0].id]: true } })),
  P("full", "places", "placewanted", { values: { "pl-want": "Berkeley" } }),
  P("full", "places", "officesseed", {}),
  P("full", "places", "entitycreate", { data: { court: null }, values: { "pl-label": "L", "pl-note": "N" } }),
  P("full", "places", "entitycreate", { data: { court: "1" }, values: { "pl-court": "Alameda County Superior Court" } }),
  P("full", "recovery", "recoverycodesissue", {}),
  P("full", "group-identity", "groupdescriptionset", { values: { "gi-k-issue": true } }),
  P("full", "group-identity", "groupdescriptiondraft", { values: { "gi-q-what": "w" } }, { table: (t) => ({ groupdescriptiondraft: () => G.DESCRIPTION_DRAFT(t.founder) }) }),
  P("security", "security", "securitymap", (t) => ({ values: { "se-from": iso(t.w, 3), "se-to": iso(t.w, 2) } })),
  P("security-bare", "security", "securitytooladd", { data: { provider: "sophos-intelix" }, values: { "sa-sophos-intelix-c-region": "de", "sa-sophos-intelix-k-client_id": "SENTINEL-intelix-client_id", "sa-sophos-intelix-k-client_secret": TOOL_SECRET, "sa-sophos-intelix-keep": true } }, { secret: TOOL_SECRET }),
  P("security", "security", "securitytooltest", (t) => ({ data: { tool: t.toolId } })),
  P("security", "security", "securitytoolremove", (t) => ({ data: { tool: t.toolId } })),
  P("full", "translations", "translationadopt", { data: { key: "rail.home.name" }, values: { "tr-t-rail_home_name": "Portada" } }, { who: "dev" }),
  P("full", "translations", "translationconfirm", { data: { key: "weight.reversible.name" } }, { who: "dev" }),
  P("full", "translations", "translationrevert", { data: { key: "rail.home.name" } }),
  P("full", "translations", "translationgrant", { data: { revoke: "" }, values: { "tr-member": "ana" } }),
];
const TEAMS_OF = { rules: () => rulesTeam(), ...TEAMS };
/** The table a press is made over: the platform's edge of the press, and for translations the words the screen is about (26,000 are not drawn in a test's time). */
const tableOf = (t, p, over = {}) => ({ ...(p.screen === "translations" ? { translations: t.only } : {}), ...(p.table ? p.table(t) : {}), ...over });
const pressOf = async (t, p) => (typeof p.press === "function" ? p.press(t) : p.press);

/** Each press, over the world its team is made in: `body(t, p, o, press)` is the test of one press. The acts that change the world
 *  are pressed over one world per team and screen in the order listed (a world that is read only is shared by the tests that only read it). */
async function eachPress(body, { shared = false, over = () => ({}) } = {}) {
  let team = null, built = null;
  for (const p of PRESSES) {
    const key = p.team + "/" + p.screen + (p.fresh ? "/" + p.op : "");
    if (shared) built = await teamNamedOf(p.team);
    else if (key !== team) { team = key; built = await TEAMS_OF[p.team](); }
    if (p.setup) await p.setup(built);
    const press = await pressOf(built, p);
    const as = built[p.who];
    const o = await open(p.screen, { world: built.w, as, table: tableOf(built, p, over(p)), subject: subjectOf(p.screen) });
    await body(built, p, o, press, as);
  }
}
const readOnly = new Map();
function teamNamedOf(name) { if (!readOnly.has(name)) readOnly.set(name, name === "rules" ? rulesTeam() : teamNamed(name)); return readOnly.get(name); }

/* The reads an act changes (R8), named by what each owner's act writes. */
const CHANGES = {
  memberadd: ["roster"], membercaps: ["roster"], memberset: ["roster"], adminendorse: ["roster"], adminremove: ["roster"], expertiseconfirm: ["roster", "expertise"],
  expertisewithdraw: ["roster", "expertise"], memberpairingset: ["pairings"], invitewithdraw: ["roster"], websitekeycreate: [], joinlinkenable: [],
  accountusesset: ["uses", "history"], ailimitset: ["limits"], aikeepaway: ["keepaway"], memberlanguageset: ["language"], infolevelset: [], expertisedeclare: ["expertise"],
  setpassword: [], signout: [], signouteverywhere: [], signerregisterown: ["signers"], signerrevokeown: ["signers"],
  notewrite: ["notes"], noterevise: ["notes"], notedelete: ["notes"], noteturn: ["notes"], writinghelp: [],
  passwordresetlink: [], signerset: ["signers"], signeradd: ["signers"], ruleconfirm: ["rules"], rulewithdraw: ["rules"], ruledraft: ["rules"], groupnameset: ["identity"], groupdomainset: ["identity"], grouplanguagesset: ["languages"], courtnoticeset: ["court"],
  hostingaccessset: ["hosting"], strengthbarset: ["bar"], profilesset: ["profiles"], placewanted: ["place"], officesseed: ["offices"], entitycreate: ["offices"],
  recoverycodesissue: ["codes"], groupdescriptionset: ["description"], groupdescriptiondraft: [], securitymap: ["map"], securitytooladd: ["tools"], securitytooltest: ["tools"],
  securitytoolremove: ["tools"], translationadopt: ["words"], translationconfirm: ["words"], translationrevert: ["words"], translationgrant: [],
};

test("R8 every act of every screen, once answered, reads again what it changes and draws it", async () => {
  await eachPress(async (t, p, o, press, as) => {
    const me = await as.read("whoami"), subject = subjectOf(p.screen);
    const spec = o.s.acts.find((a) => a.op === p.op);
    for (const r of CHANGES[p.op]) assert.ok((spec.rereads || Object.keys(o.s.reads({ me, subject, ui: {} }))).includes(r), `${p.screen} ${p.op} re-reads ${r}`);
    const r = await o.press(p.op, press);
    assert.ok(r.sent.length >= 1 && !r.refused, `${p.screen} ${p.op} sent: ${JSON.stringify(o.refused)}`);
    const reread = r.sent.slice(1).map((x) => x.op);
    const reads = o.s.reads({ me, subject, ui: {} });
    for (const name of CHANGES[p.op]) if (reads[name]) assert.ok(reread.includes(reads[name].op), `${p.screen} ${p.op}: ${name} (${reads[name].op}) read again`);
  });
});

test("R8 nothing is drawn as done before the answer: while an act has not answered, the screen is unchanged", async () => {
  // the act is held at the page's edge ("pending": the request is sent and never answered), so the world is never changed and one world is read by every press
  await eachPress(async (t, p, o, press) => {
    // a path chosen first (a choice redraws the screen; that is not the act's doing)
    for (const [cid, v] of Object.entries(press.choose || {})) await o.choose(cid, v);
    const before = o.text;
    // pressed as a member would, any reason the shell asks answered; the act is sent and never answers
    await o.press(p.op, { ...press, choose: {} });
    o.redraw();
    assert.ok(o.p.all.some((r) => r.op === p.op), `${p.screen} ${p.op} sent`);
    assert.equal(o.text, before, `${p.screen} ${p.op}`);
  }, { shared: true, over: (p) => ({ [p.op]: "pending" }) });
});

test("R10 no key, code or password typed is kept in the browser's storage, put in an address, sent in a later request, or drawn again", async () => {
  for (const p of PRESSES.filter((x) => x.secret)) {
    for (const answer of ["ok", "refused"]) {
      // each world is made for one answer: an act that succeeded has changed it (a password, a key)
      const t = await TEAMS_OF[p.team]();
      if (p.setup) await p.setup(t);
      const press = await pressOf(t, p), as = t[p.who];
      // the owner's refusal is its own where it gives one; here any refusal will do: a code made up on purpose (marked where `refuse` is made)
      const over = answer === "refused" ? { [p.op]: refuse("REFUSED") } : {};
      const o = await open(p.screen, { world: t.w, as, table: tableOf(t, p, over), subject: subjectOf(p.screen) });
      const r = await o.press(p.op, press);
      const what = `${p.screen} ${p.op} (${answer})`;
      assert.ok(JSON.stringify(r.sent[0].body).includes(p.secret), `${what}: in the body`);
      assert.equal(o.b.requests.filter((x) => JSON.stringify([x.url, x.query, x.body, x.headers]).includes(p.secret)).length, 1, `${what}: in that one request only`);
      assert.ok(!o.b.requests.some((x) => x.url.includes(p.secret)), `${what}: never in an address`);
      assert.ok(!o.b.location.pathname.includes(p.secret) && !o.b.location.hash.includes(p.secret), `${what}: not in the page's address`);
      assert.ok(![...o.b.store.values(), ...o.b.local.values()].some((v) => String(v).includes(p.secret)), `${what}: not in the browser's storage`);
      assert.ok(!o.b.doc.getElementById("cs-root").innerHTML.includes(p.secret), `${what}: never drawn`);
      // once the act succeeds, its field is drawn anew, empty
      if (answer === "ok") {
        assert.ok(!o.refused, `${what}: the owner took it: ${JSON.stringify(o.refused)}`);
        for (const el of o.b.doc.querySelectorAll("input, textarea")) assert.ok(!String(el.value).includes(p.secret), `${what}: no field still holds it (${el.id})`);
      }
    }
  }
});

/* R28: the common line. Every element these screens draw uses a class a served stylesheet defines (interface-shell R56),
   and a section, list or reading that holds nothing is not drawn. */
import { readFileSync } from "node:fs";

const rootOf = new URL("../../../../", import.meta.url);
const styleOf = (src) => (/<style[^>]*>([\s\S]*?)<\/style>/.exec(src) || [, ""])[1];
// the served stylesheets: `civicsmith.css`, `shell.css` (the design page's product rules, interface-assets R7; the design's own
// source until that file is served) and the shell's own `STYLE`
const served = (() => {
  // the design's two stylesheets as `interface-assets` serves them (R1, R7: byte-identical to these files), and the shell's own `STYLE`
  const read = (p) => readFileSync(new URL(p, rootOf), "utf8");
  const css = read("docs/development/ux-substrate/visual-language/civicsmith.css");
  const shell = styleOf(read("docs/development/ux-substrate/screens/page.src.html"));
  const own = /const STYLE = `([\s\S]*?)`;/.exec(read("bio-plane/src/interface-shell/index.mjs"));
  return new Set([...(css + shell + (own ? own[1] : "")).matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
})();

// what the kit itself draws (`cs.rows`, the crumbs; interface-shell owns them and its R56 lists them), not a class this module writes
const KIT_DRAWN = new Set(["cs-panel", "cs-r", "cs-rows", "cs-crumbs", "cs-pickc"]);
// a state each read can be in: answering, or not at all (failed)
const failing = (ops) => Object.fromEntries(ops.map((k) => [k, "none"]));
const runOpen = async (id, run, over = {}) => {
  const t = await teamNamed(run.team), as = t[run.who];
  return { t, as, me: await as.read("whoami"), o: await open(id, { world: t.w, as, subject: run.subject ?? null, table: { ...(run.table ? run.table(t) : {}), ...over } }) };
};

test("R28 every element every screen draws uses a class a served stylesheet defines; a section holds something; control: a read that failed is still drawn failed", async () => {
  assert.ok(served.has("mk-note") && served.has("cs-field") && !served.has("cs-form"), "the served set is the design's");
  for (const [id, run] of RUNS) for (const what of ["ok", "failed"]) {
    const { o, me } = await runOpen(id, run, what === "ok" ? {} : failing(await readsOf(id, run)));
    const where = `${id} (${what}, ${me.administer ? "administrator" : "member"})`;
    for (const n of walk(o.tree)) {
      for (const c of String((n.attrs && n.attrs.class) || "").split(/\s+/).filter(Boolean)) assert.ok(served.has(c) || KIT_DRAWN.has(c), `${where}: the class ${c} is defined by no served stylesheet`);
      // a section that holds nothing is not drawn
      if (n.tag === "section") assert.ok(n.children.filter((c) => c.tag && c.tag !== "h2").length > 0, `${where}: an empty section ${textOf(n)}`);
      // no bare label with a help beside it (cs.field draws them apart); no cs-form
      assert.ok(!/\bcs-form\b/.test((n.attrs && n.attrs.class) || ""), `${where}: cs-form`);
    }
    if (what === "failed" && id !== "settings" && id !== "recovery") assert.ok(all(o.tree, (e) => e.attrs["data-state"] === "failed").length >= 1 || id === "group-identity" && !me.administer || id === "translations" || id === "security" && !me.administer, `${where}: drawn failed`);
  }
});

test("R28 every labeled field is drawn with cs.field: its label and its help are boxes of their own, tied by aria-describedby; a field has no bare label with a help beside it", async () => {
  for (const [id, run] of RUNS) {
    const { o } = await runOpen(id, run);
    for (const inp of all(o.tree, (e) => ["input", "textarea"].includes(e.tag) && !["checkbox", "radio", "hidden"].includes(e.attrs.type))) {
      const box = ancestor(inp, (e) => /\bcs-field\b/.test(e.attrs.class || ""));
      assert.ok(box, `${id}: ${inp.attrs.id} is not drawn with cs.field`);
      const label = all(box, (e) => e.tag === "label" && e.attrs.for === inp.attrs.id)[0];
      assert.ok(label, `${id}: ${inp.attrs.id} has its label`);
      for (const h of all(box, (e) => /\bhelp\b/.test(e.attrs.class || ""))) { assert.ok(!ancestor(h, (e) => e === label) && inp.attrs["aria-describedby"] === h.attrs.id, `${id}: ${inp.attrs.id}'s help is apart and tied`); }
    }
    for (const sel of all(o.tree, (e) => e.tag === "select")) assert.ok(ancestor(sel, (e) => /\bcs-field\b/.test(e.attrs.class || "")), `${id}: ${sel.attrs.id} is not drawn with cs.choice`);
  }
});

/* ---- T51 fix round 2: C94 (one helper, `memberName`, names a member by handle on every screen; no id is drawn) ---- */

const FALLBACK = () => said("shell.card.member");
/** The team's roster as its owner lists it: a member who joined as `m-7` and chose the handle `luisa` is not her id; `m-9` was invited and has chosen none. */
async function named(t) {
  await G.enrolled(t.w, t.founder, "m-7", "luisa");
  await G.invited(t.founder, "m-9");
  const roster = (await t.founder.read("memberlist")).members;
  assert.equal(roster.find((m) => m.member_id === "m-7").handle, "luisa");
  assert.ok(!roster.find((m) => m.member_id === "m-9").handle);
  return roster;
}

test("R27 R73 C94: updates names who allowed or skipped a release by memberName: the handle where it differs from the id, the fallback word where the member has none, never an id", async () => {
  const { w, founder } = await S.team();
  await named({ w, founder });
  // a copy that has run 0.82.0, then 0.83.0 (chosen by its founder to install), has set aside 0.83.1, and is offered 0.84.0
  S.deployed(w, "0.82.0");
  S.shipped(w, { version: "0.82.0", date: "2026-09-02" });
  S.shipped(w, { version: "0.83.0", date: "2026-09-27" });
  await founder.act("updatestart", { body: { version: "0.83.0" } });
  S.deployed(w, "0.83.0");
  S.shipped(w, { version: "0.83.1", date: "2026-10-01" });
  await founder.act("updateskip", { body: { version: "0.83.1", reason: "We wait." } });
  // SEED, no act makes it: the decisions' recorder is a member the roster knows by another handle (a session of the world acts under her handle as id)
  const by = (id) => w.sql.exec("UPDATE update_decisions SET by_member = ?, by_name = NULL", "member:" + id);
  by("m-7");
  const a = await open("updates", { world: w, as: founder });
  const n = await founder.read("updatenotice"), skipped = n.earlier.find((e) => e.skipped_at);
  has(a, "updates.running.release", { version: n.running.version, date: day(n.running.installed_at), who: "luisa" });
  has(a, "updates.earlier.skipped", { version: skipped.version, date: day(skipped.skipped_at), who: "luisa", reason: skipped.reason });
  assert.ok(!a.text.includes("m-7"));
  by("m-9");
  const b = await open("updates", { world: w, as: founder });
  has(b, "updates.running.release", { version: n.running.version, date: day(n.running.installed_at), who: FALLBACK() });
  assert.ok(!b.text.includes("m-9"));
});


test("R57 C94: a key an administrator registered for the member names the registrar by memberName: the handle where it differs from the id, the fallback word for one with none, never an id", async () => {
  const t = await fullTeam();
  await named(t);
  const { w, rosa, dev } = t;
  await rosa.act("signeradd", { body: { memberId: "dev", keyB64: KEYS.devOld } });
  const mine = (await dev.read("signerlist")).signers.find((s) => s.key_b64 === KEYS.devOld);
  assert.equal(mine.origin, "admin");
  // SEED, no act makes it: the registrar is a member the roster knows by another handle
  const by = (id) => w.sql.exec("UPDATE signers SET registered_by = ? WHERE key_b64 = ?", id, KEYS.devOld);
  by("m-7");
  const a = await open("account", { world: w, as: dev });
  has(a, "screen.account.registered.for.you.by.rosa", { member: "luisa", date: day(mine.added) });
  by("m-9");
  const b = await open("account", { world: w, as: dev });
  has(b, "screen.account.registered.for.you.by.rosa", { member: FALLBACK(), date: day(mine.added) });
  assert.ok(!a.text.includes("m-7") && !b.text.includes("m-9"));
});

test("R15 C94: a member who does not administer is told whose screen security is by the administrators' handles; an administrator with none by the fallback word, never an id", async () => {
  const { w, founder } = await S.unnamedTeam();
  const rosa = await w.signIn("rosa", { admin: true });
  await w.signIn("lu", { admin: true });
  const dev = await w.signIn("dev", { capabilities: ["contribute"] });
  // SEED, no act makes it: an administrator whose handle is not her id, and one who has chosen none (a session of the world acts under her handle as id)
  w.sql.exec("UPDATE members SET handle = 'luisa' WHERE member_id = 'rosa'");
  w.sql.exec("UPDATE members SET handle = NULL WHERE member_id = 'lu'");
  const roster = (await founder.read("memberlist")).members.filter((m) => m.role === "admin" && m.status === "active");
  assert.equal(roster.length, 3);
  const a = await open("security", { world: w, as: dev });
  has(a, "screen.security.admins", { admins: roster.map((m) => (m.founder ? said("member.founder.unnamed") : m.handle || FALLBACK())).join(", ") });
  assert.ok(!/\brosa\b/.test(a.text) && !/\blu\b/.test(a.text));
  void rosa;
});
