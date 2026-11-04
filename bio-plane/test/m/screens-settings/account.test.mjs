/* Settings › Your account at the module's interface (R3, R8, R10). */
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { acts, all, day, has, lacks, open, said, textOf, WORDS, registryOps } from "./kit.mjs";
import { team, freshKey, SILENT, REFUSED } from "./seed-account.mjs";
import { SCREENS } from "../../../src/screens-settings/index.mjs";
import { hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
// the kit's load-key-file helper answering that no file is chosen (interface-shell D3)
const NO_FILE = async () => ({ ok: false, word: "shell.keyfile.none" });
/** The page's view of a member who has made no act of the world's: for the specs driven with the kit's stand-in (no read, no op). */
const VIEWER = Object.freeze({ member: "dev", handle: "dev" });
/** dev's own signing key, registered by her real act `signerregisterown`; answers the key. */
async function keyed(as) { const keyB64 = freshKey(); await as.act("signerregisterown", { body: { keyB64, comment: "laptop" } }); return keyB64; }

test("R3 the reads: whoami, memberlanguage, the member's own expertiselist, signerlist", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  const reads = a.p.all.map((r) => [r.op, r.query]);
  for (const want of [["whoami", {}], ["memberlanguage", {}], ["expertiselist", { memberId: dev.member }], ["signerlist", {}]])
    assert.ok(reads.some((r) => JSON.stringify(r) === JSON.stringify(want)), JSON.stringify(want));
  assert.equal(reads.filter((r) => r[0] === "whoami").length, 1, "the shell's own and the screen's are one request (interface-shell R123)");
});

test("R3 the handle drawn fixed in DEC-197's words; no handlechange act, and no handle.changeable, handle.formerly or handle.refused.* drawn", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  assert.ok(textOf(a.tree).includes((await dev.read("whoami")).handle));
  assert.ok(hasWord("handle.fixed"), "the handle's sentence is a word of the list (R39)");
  has(a, "handle.fixed");
  assert.ok(!ops(a).includes("handlechange") && !ops(a).includes("handlecheck"));
  // the handle's other sentences (changeable, formerly, free, taken, refused…) are the word list's own `handle.*` rows, none of them drawn
  const others = WORD_ROWS.filter(([k]) => /^handle\./.test(k) && k !== "handle.fixed").map(([, en]) => String(en).split("{")[0].trim()).filter((en) => en.length >= 12);
  assert.ok(others.length > 0, "the list holds the handle's other sentences");
  for (const en of others) assert.ok(!a.text.includes(en.slice(0, 24)), en);
  assert.ok(!/formerly/i.test(a.html));
});

test("R3, R21 every registry act is drawn (memberlanguageset, setpassword, expertisedeclare, signerregisterown, signerrevokeown, the explanation level, the two sign-outs), and the link to notes (R95: connect is retired; aimine is not registered yet)", async () => {
  const { w, dev, teo } = await team();
  const mine = await keyed(dev);
  await keyed(teo);
  await dev.act("infolevelset", { body: { level: "pause" } });
  const a = await open("account", { world: w, as: dev });
  assert.deepEqual(ops(a), registryOps("account"), "the registry's acts for the screen (N1073)");
  // the member's own key only: a revoke for theirs, none for another's
  const rev = acts(a.tree).filter((b) => b.attrs["data-act"] === "signerrevokeown");
  assert.equal(rev.length, 1);
  assert.equal(rev[0].attrs["data-key"], mine);
  // aimine is screens-ai's, which registers no screen yet: not linked until it does (BOB, 4 Nov; links.test.mjs)
  assert.equal(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/aimine").length, 0, "no link to a screen not registered");
  assert.equal(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/connect").length, 0, "R95: no link to the retired connect");
  assert.ok(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/notes").length === 1);
  // R57 (4): the glossary and the ties are reached from here too, beside notes
  assert.equal(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/ties").length, 1);
  assert.equal(all(a.tree, (e) => e.tag === "a" && e.attrs.href === "/app/glossary" && textOf(e) === said("screen.glossary.name")).length, 1);
  has(a, "screen.glossary.purpose");
  // (R12) the appearance choice is the device's (interface-shell R18), never an op: the kit's own control, cs.appearance()
  const ap = all(a.tree, (e) => e.attrs["data-shell"] === "theme");
  assert.equal(ap.length, 3, "the kit's control is drawn");
  await a.b.click(a.b.doc.getElementById("cs-main").querySelector('[data-shell="theme"][data-theme-to="dark"]'));
  assert.equal(a.b.doc.documentElement.getAttribute("data-theme"), "dark");
  assert.ok(!a.p.all.some((r) => /theme/.test(JSON.stringify(r))), "never sent");
  // the level the member set is drawn selected (read by the shell, its R17)
  const lv = all(a.tree, (e) => e.attrs.id === "ma-level")[0];
  assert.equal(all(lv, (e) => e.tag === "option" && e.attrs.selected !== undefined)[0].attrs.value, "pause");
});

test("R3 the explanation level: infolevelset sent through the shell's setting, kept on the device (interface-shell R17)", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev, table: REFUSED("infolevel", "UNKNOWN_OP") });
  const lv = all(a.tree, (e) => e.attrs.id === "ma-level")[0];
  assert.equal(all(lv, (e) => e.tag === "option" && e.attrs.selected !== undefined)[0].attrs.value, "prompt", "the default while the level is not read");
  const r = await a.press("infolevelset", { values: { "ma-level": "pause" } });
  assert.deepEqual(r.sent.filter((x) => x.op === "infolevelset").map((x) => x.body), [{ level: "pause" }], "sent once");
  assert.equal((await dev.read("infolevel")).level, "pause", "kept by the owner");
  assert.equal(a.b.local.get("cs-level"), "pause", "kept for the device");
  const lv2 = all(a.tree, (e) => e.attrs.id === "ma-level")[0];
  assert.equal(all(lv2, (e) => e.tag === "option" && e.attrs.selected !== undefined)[0].attrs.value, "pause");
});

test("R3, R31 memberlanguageset sends the tag the member chose by name, or null to follow the device; no tag is drawn or typed", async () => {
  const { w, founder, dev } = await team();
  await founder.act("grouplanguagesset", { body: { languages: ["en", "es", "vi"] } });
  await dev.act("memberlanguageset", { body: { language: "es" } });
  const group = (await dev.read("grouplanguages")).languages;
  const a = await open("account", { world: w, as: dev });
  has(a, "screen.account.language.now", { language: "Español" });
  // chosen by name among the group's languages, in the member's language; the tags are values, never text
  const sel = all(a.tree, (e) => e.attrs.id === "ma-lang")[0];
  assert.deepEqual(all(sel, (e) => e.tag === "option").map((o) => textOf(o)), [said("screen.account.language.device"), "Inglés", "Español", "Vietnamita"]);
  assert.deepEqual(all(sel, (e) => e.tag === "option").map((o) => o.attrs.value), ["", ...group]);
  assert.ok(!/\b(en|es|vi)\b/.test(a.text.replace(/Español|Inglés|Vietnamita/g, "")), "no tag drawn");
  assert.equal(all(a.tree, (e) => e.tag === "input" && e.attrs.id === "ma-lang").length, 0, "no tag is typed");
  assert.deepEqual((await a.press("memberlanguageset", { values: { "ma-lang": "vi" } })).sent[0].body, { language: "vi" });
  assert.equal((await dev.read("memberlanguage")).language, "vi", "kept by the owner");
  assert.deepEqual((await a.press("memberlanguageset", { values: { "ma-lang": "" } })).sent[0].body, { language: null });
  assert.equal((await dev.read("memberlanguage")).language, null, "following the device again");
  assert.equal(a.p.requests.at(-1).op, "memberlanguage", "R8: read again after the act");
  // control: a regional tag is shown by its name too, and its tag is not
  const ana = await w.signIn("ana");
  await ana.act("memberlanguageset", { body: { language: "en-US" } });
  assert.equal((await ana.read("memberlanguage")).language, "en-US");
  const r = await open("account", { world: w, as: ana });
  assert.ok(!r.text.includes("en-US"), "a regional tag is never shown");
  assert.ok(r.text.includes("English"));
});

test("R3 setpassword: current and new, the new typed twice alike, sent only when alike (setup-page R3's rule)", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  const differ = await a.press("setpassword", { values: { "ma-cur0": dev.password, "ma-new0": "a new long password", "ma-again0": "a new long passwerd" } });
  assert.deepEqual(differ.sent, []);
  assert.equal(a.refused.key, "screen.account.password.differ");
  const empty = await a.press("setpassword", { values: { "ma-cur0": "x", "ma-new0": "", "ma-again0": "" } });
  assert.deepEqual(empty.sent, []);
  const ok = await a.press("setpassword", { values: { "ma-cur0": dev.password, "ma-new0": "a new long password", "ma-again0": "a new long password" } });
  assert.deepEqual(ok.sent[0].body, { current: dev.password, password: "a new long password" });
  has(a, "screen.account.password.changed");
  assert.ok(!a.html.includes("a new long password") && !a.html.includes(dev.password));
  // changed by the owner: the new password signs her in, the old one does not
  const login = (password) => w.door({ url: "/api/?op=login", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: dev.handle, password, device: "own" }) } });
  assert.equal((await login("a new long password")).json.result.ok, true);
  assert.equal((await login(dev.password)).json.result.ok, false);
});

test("R3 expertisedeclare; signerrevokeown for the member's own key", async () => {
  const { w, founder, dev } = await team();
  await dev.act("expertisedeclare", { body: { label: "Tenant organiser" } });
  await founder.act("expertiseconfirm", { body: { memberId: dev.member, label: "Tenant organiser" } });
  await dev.act("expertisedeclare", { body: { label: "Interpreter" } });
  const held = (await dev.read("expertiselist", { query: { memberId: dev.member } })).expertise;
  const a = await open("account", { world: w, as: dev });
  for (const e of held) has(a, e.confirmed ? "screen.account.expertise.confirmed" : "screen.account.expertise.declared", { label: e.label });
  assert.deepEqual(held.map((e) => e.confirmed).sort(), [false, true], "one confirmed, one declared");
  assert.deepEqual((await a.press("expertisedeclare", { values: { "ma-exp": " Accounting " } })).sent[0].body, { label: "Accounting" });
  assert.ok((await dev.read("expertiselist", { query: { memberId: dev.member } })).expertise.some((e) => e.label === "Accounting"), "declared to the owner");
  assert.deepEqual((await a.press("expertisedeclare", { values: { "ma-exp": "" } })).sent, []);
  const mine = await keyed(dev);
  const b = await open("account", { world: w, as: dev });
  const key = acts(b.tree).find((x) => x.attrs["data-act"] === "signerrevokeown").attrs["data-key"];
  assert.equal(key, mine);
  assert.deepEqual((await b.press("signerrevokeown", { data: { key } })).sent[0].body, { keyB64: key });
  assert.equal((await dev.read("signerlist")).signers.find((x) => x.key_b64 === key).status, "revoked", "revoked by the owner");
});

test("R3 a member without a capability an act needs is not offered it; the founder's session is", async () => {
  const { w, founder, dev, teo } = await team();
  const r = await open("account", { world: w, as: teo });
  assert.ok(ops(r).includes("setpassword"));
  const f = await open("account", { world: w, as: founder });
  assert.ok(ops(f).includes("setpassword"));
  const failed = await open("account", { world: w, as: dev, table: { ...SILENT("signerlist"), ...REFUSED("expertiselist", "NO_SUCH_MEMBER") } });
  assert.equal(all(failed.tree, (e) => e.attrs["data-state"] === "failed").length, 2);
});

test("R12 account draws the appearance control by cs.appearance(), never the shell's buttons of its own", () => {
  const spec = SCREENS.find((x) => x.id === "account");
  const kit = { w: (k) => k, esc: (x) => String(x), date: () => "", title: () => "", state: () => "", sec: (k, inner) => inner, act: () => "", choice: () => "", field: () => "", level: () => "prompt", appearance: () => "<KIT-APPEARANCE>" };
  const html = spec.render(kit, { me: VIEWER, data: {}, ui: {} });
  assert.ok(html.includes("<KIT-APPEARANCE>"), "the kit's control");
  assert.ok(!/data-shell="theme"/.test(html), "no theme button of its own");
});

test("R21 Sign out on this device (signout) and Sign out everywhere (signouteverywhere), each then drawing front's signed-out state (cs.signedOut, interface-shell R46)", async () => {
  for (const op of ["signout", "signouteverywhere"]) {
    const { w, dev } = await team();
    const a = await open("account", { world: w, as: dev });
    const r = await a.press(op);
    assert.deepEqual([r.sent[0].op, r.sent[0].body], [op, {}]);
    assert.equal((await w.door({ url: "/api/?op=whoami" }, dev)).json.session === true, false, `${op}: her session is ended by the owner`);
    const spec = a.s.acts.find((x) => x.op === op);
    let out = 0;
    spec.done({}, { ok: true, ended: 1 }, { signedOut: () => { out += 1; } });
    assert.equal(out, 1, `${op} then the signed-out state`);
  }
  // control: a refused sign-out does not draw the signed-out state
  const { w, dev } = await team();
  const no = await open("account", { world: w, as: dev, table: REFUSED("signout", "NOT_SIGNED_IN") });
  await no.press("signout");
  assert.ok(no.refused, "drawn beside the act");
});

test("R22 Register your signing key: made by the kit's signer in this browser (cs.signer.register), its public line sent with signerregisterown; no pasted line is asked; declined sends nothing", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  assert.ok(!all(a.tree, (e) => e.tag === "input" && e.attrs.id === "ma-pub").length, "no field for a pasted line");
  has(a, "signing.ceremony.keepkey");
  const r = await a.press("signerregisterown", { values: { "ma-keep": true }, wait: true });
  const body = r.sent.find((x) => x.op === "signerregisterown").body;
  assert.ok(/^AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/=]+$/.test(body.keyB64), "an Ed25519 public key made here");
  const held = (await dev.read("signerlist")).signers.find((x) => x.key_b64 === body.keyB64);
  assert.deepEqual([held.member_id, held.status, held.origin], [dev.member, "active", "self"], "registered by the owner, for her, by her own act");
  assert.equal(a.b.idb.size >= 1, true, "kept on this device, as ticked");
  assert.ok(!JSON.stringify(r.sent).includes("PRIVATE"), "nothing but the public line");
  // declined: nothing is sent
  const spec = a.s.acts.find((x) => x.op === "signerregisterown");
  assert.deepEqual(await spec.send({ ui: {} }, {}, { value: () => false, keyFile: NO_FILE, signer: { register: async () => ({ ok: false, declined: true }) } }), { refuse: "screen.account.key.declined" });
});

/* R57 (T51; K3807; DEC-330 C1, A74, A11; DEC-336 (7), (8)): the key made on the page's terms, a key registered for the member, the glossary */
const LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFreshKey0000000000000000000000000000001 mai-k";
const regSpec = () => SCREENS.find((x) => x.id === "account").acts.find((x) => x.op === "signerregisterown");
const keyHeading = (o, k) => all(o.tree, (e) => e.tag === "h2" && textOf(e) === said(k))[0];

test("R57 (1) Make your signing key: the tick, the optional passphrase field (a password field), and the act labelled for the account; the passphrase and the tick are the kit's arguments, the file deferred", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  assert.ok(keyHeading(a, "screen.account.key.make.heading"), "the heading");
  has(a, "screen.account.key.help"); has(a, "signing.ceremony.keepkey"); has(a, "screen.account.key.passphrase"); has(a, "screen.account.key.passphrase.help");
  const field = a.b.doc.getElementById("ma-pass");
  assert.equal(field.getAttribute("type"), "password", "a password field");
  const reg = acts(a.tree).find((b) => b.attrs["data-act"] === "signerregisterown");
  assert.equal(textOf(reg).startsWith(said("act.signerregisterown.label.account")), true, "Register your signing key");
  // the kit is asked with what the member typed, deferring the file
  let asked = null, pending = null;
  const kit = { value: (id) => ({ "ma-keep": false, "ma-pass": "a typed passphrase" }[id]), keyFile: NO_FILE, now: () => Date.parse("2026-10-18T10:00:00Z"), signer: { register: async (o) => { asked = o; return { ok: true, kept: false, keyB64: "AAAAC3NzaC1lZDI1NTE5AAAAIFreshKey0000000000000000000000000000001", line: LINE, file: "BIOKEY1.FILE" }; } } };
  const view = { ui: {} };
  const sent = await regSpec().send(view, {}, kit);
  assert.deepEqual(asked, { keep: false, passphrase: "a typed passphrase", defer: true });
  assert.deepEqual(sent, { body: { keyB64: "AAAAC3NzaC1lZDI1NTE5AAAAIFreshKey0000000000000000000000000000001", comment: "mai-k" } });
  pending = view.ui.madePending;
  assert.equal(pending.file, "BIOKEY1.FILE", "the file is held for the sitting");
  // control: a member who stops sends nothing
  assert.deepEqual(await regSpec().send({ ui: {} }, {}, { value: () => "", keyFile: NO_FILE, signer: { register: async () => ({ ok: false, declined: true }) } }), { refuse: "screen.account.key.declined" });
});

test("R57 (2) after it is made: its tail and day, the public line as data, Copy the public line, and Save the key file only for a key that made a file (never for one kept on the device); nothing of it in any request or storage", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  const r = await a.press("signerregisterown", { values: { "ma-keep": true, "ma-pass": "never sent" }, wait: true });
  const sent = r.sent.find((x) => x.op === "signerregisterown");
  assert.ok(/^AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/=]+$/.test(sent.body.keyB64));
  assert.ok(keyHeading(a, "screen.account.key.made.heading"), "Your key is made");
  assert.ok(all(a.tree, (e) => e.attrs["data-shown"] === "key").some((e) => textOf(e).startsWith(said("screen.account.key.held", { key: "…" + sent.body.keyB64.slice(-8), date: "" }).replace(/\s*$/, ""))), "the tail, then the day");
  has(a, "screen.account.key.save"); has(a, "screen.account.key.lost");
  assert.ok(a.text.includes(sent.body.keyB64), "the public line, as data");
  const copy = all(a.tree, (e) => e.tag === "button" && e.attrs["data-shell"] === "bind" && textOf(e) === said("screen.account.key.copyline"));
  assert.equal(copy.length, 1, "Copy the public line");
  assert.equal(all(a.tree, (e) => e.tag === "button" && textOf(e) === said("screen.account.key.savefile")).length, 0, "no file for a key kept on the device");
  assert.ok(![...a.b.store.values(), ...a.b.local.values()].some((v) => String(v).includes("never sent")), "the passphrase is kept nowhere");
  assert.ok(!JSON.stringify(r.sent).includes("never sent"), "nor sent");
  // control: a made key that has a file draws Save the key file (the kit's `cs.save`), drawn from page memory
  const spec = a.s;
  const html = spec.render({ w: (k) => k, esc: (x) => String(x), date: () => "D", title: () => "", state: () => "", sec: (k, inner) => k + "|" + inner, act: () => "", choice: () => "", field: () => "", level: () => "prompt", appearance: () => "", sounds: () => "",
    save: (n, c, o) => `<SAVE ${n} ${c} ${o.label}>`, copy: (c, o) => `<COPY ${c} ${o.label}>` }, { me: VIEWER, data: {}, ui: { made: { line: LINE, file: "BIOKEY1.FILE", tail: "…x", at: "2026-10-18T00:00:00Z" } } });
  assert.ok(html.includes("<SAVE bio-signing-key.txt BIOKEY1.FILE screen.account.key.savefile>") && html.includes("<COPY " + LINE + " screen.account.key.copyline>"));
});

test("R57 (3) a key an administrator registered for the member reads \"registered for you by <who>, an administrator, on <date>\" with the note that only she can sign with it, beside Revoke; one she made herself is drawn as before", async () => {
  /* a key an administrator registered for dev (credentials R21: `signeradd`), read back for its day and its tail */
  const registeredBy = async (registrar) => {
    const t = await team();
    const keyB64 = freshKey();
    await (registrar === "founder" ? t.founder : await t.w.signIn(registrar, { admin: true })).act("signeradd", { body: { keyB64, memberId: t.dev.member } });
    const row = (await t.dev.read("signerlist")).signers.find((x) => x.key_b64 === keyB64);
    assert.deepEqual([row.origin, row.member_id], ["admin", "dev"]);
    return { ...t, keyB64, row };
  };
  const t = await registeredBy("lu");
  const a = await open("account", { world: t.w, as: t.dev });
  has(a, "screen.account.registered.for.you.by.rosa", { member: t.row.registered_by, date: day(t.row.added) });
  assert.equal(t.row.registered_by, "lu");
  has(a, "screen.account.only.you.can.sign.with");
  assert.equal(acts(a.tree).filter((b) => b.attrs["data-act"] === "signerrevokeown").length, 1, "beside Revoke your signing key");
  // the founder, `admin`, by her handle the roster gives, else the unnamed words
  const fo = await registeredBy("founder");
  assert.equal(fo.row.registered_by, "admin");
  const roster = (await fo.dev.read("memberlist")).members;
  const named = await open("account", { world: fo.w, as: fo.dev });
  has(named, "screen.account.registered.for.you.by.rosa", { member: roster.find((m) => m.founder === true).handle, date: day(fo.row.added) });
  const f = await open("account", { world: fo.w, as: fo.dev, table: SILENT("memberlist") });
  has(f, "screen.account.registered.for.you.by.rosa", { member: said("member.founder.unnamed"), date: day(fo.row.added) });
  // a key she registered herself says no administrator did
  const mine = await team();
  const own = await keyed(mine.dev);
  const ownRow = (await mine.dev.read("signerlist")).signers.find((x) => x.key_b64 === own);
  assert.deepEqual([ownRow.origin, ownRow.registered_by], ["self", "dev"]);
  const self = await open("account", { world: mine.w, as: mine.dev });
  lacks(self, "screen.account.only.you.can.sign.with");
  has(self, "screen.account.key.held", { key: "…" + own.slice(-8), date: day(ownRow.added) });
  // one with no one recorded (a key from before the owner recorded who: no act makes it, so the row is seeded, REPORT) says no administrator did
  const old = await registeredBy("founder");
  old.w.sql.exec(`UPDATE signers SET registered_by = 'not recorded' WHERE key_b64 = ?`, old.keyB64);
  const unrec = await open("account", { world: old.w, as: old.dev });
  lacks(unrec, "screen.account.only.you.can.sign.with");
  // the day missing (no act makes it, the column holds a day always, so the row is seeded with none, REPORT): the member's own key says so, not a day
  const none = await team();
  const k = await keyed(none.dev);
  none.w.sql.exec(`UPDATE signers SET added = '' WHERE key_b64 = ?`, k);
  const nodate = await open("account", { world: none.w, as: none.dev });
  has(nodate, "screen.members.signer.held.nodate", { key: "…" + k.slice(-8) });
  // account reads the roster to name them (a member's read)
  assert.ok(a.p.requests.some((r) => r.op === "memberlist"));
});

/* R42 (T50; U3b; interface-shell R74): the Sounds setting beside Language and Appearance, kept on the device */
test("R42 account draws the Sounds choice (off by default) beside Language and Appearance, and sends nothing when it is changed; no sentence is drawn twice", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  // the kit's own control (`cs.sounds()`, interface-shell R74): a labeled pair of buttons, on and off
  const group = all(a.tree, (e) => e.attrs.role === "group" && e.attrs["aria-label"] === said("screen.account.sounds"))[0];
  assert.ok(group, "the Sounds choice is drawn, named by screen.account.sounds");
  const btn = (to) => all(group, (e) => e.tag === "button" && e.attrs["data-sounds-to"] === to)[0];
  assert.equal(textOf(btn("on")), said("screen.account.sounds.on"));
  assert.equal(textOf(btn("off")), said("screen.account.sounds.off"));
  assert.equal(btn("off").attrs["aria-pressed"], "true", "off by default");
  assert.ok(group.attrs["data-tip"] && group.attrs["data-tip"].includes(said("screen.account.sounds.help").slice(0, 25)), "explained by screen.account.sounds.help");
  const before = a.b.requests.length;
  a.b.fire(a.b.doc.querySelector('[data-sounds-to="on"]'), "click");
  await a.b.settle(40); a.redraw();
  assert.equal(a.b.requests.length, before, "nothing is sent for it");
  assert.equal(all(a.tree, (e) => e.attrs["data-sounds-to"] === "on")[0].attrs["aria-pressed"], "true", "kept as chosen");
  // beside Language and Appearance: in the same section
  const sec = all(a.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => textOf(h) === said("screen.account.language.heading")))[0];
  assert.ok(sec && all(sec, (e) => e.attrs.role === "group" && e.attrs["aria-label"] === said("screen.account.sounds")).length === 1, "in the language section");
  assert.equal(a.text.split(said("screen.account.language.help")).length, 2, "said once");
});

test("R57 (1), (2) a key made with a typed passphrase opens no dialog, sends keyB64, and offers Save the key file from page memory; the passphrase and the file are in no request or storage", async () => {
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  const r = await a.press("signerregisterown", { values: { "ma-keep": false, "ma-pass": "a typed passphrase 123" }, wait: true });
  const sent = r.sent.find((x) => x.op === "signerregisterown");
  assert.ok(sent && /^AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/=]+$/.test(sent.body.keyB64), "the public key is sent");
  assert.equal(all(a.tree, (e) => e.attrs["data-shell"] === "dialog" || /\bcs-dialog\b/.test(e.attrs.class || "")).length, 0, "no dialog of the kit's own");
  const save = all(a.tree, (e) => e.tag === "button" && e.attrs["data-shell"] === "bind" && textOf(e) === said("screen.account.key.savefile"));
  assert.equal(save.length, 1, "Save the key file, for a key that made a file");
  assert.ok(![...a.b.store.values(), ...a.b.local.values()].some((v) => String(v).includes("a typed passphrase 123") || String(v).includes("BIOKEY1.")), "kept nowhere");
  assert.ok(!JSON.stringify(r.sent).includes("a typed passphrase 123") && !JSON.stringify(r.sent).includes("BIOKEY1."), "sent nowhere");
});

/* ---- T51 FR-25: C81 (R67) ---- */

test("R67 Your cover name: the cover and handle said, the stored choice the only one preselected, and memberpairingset sends memberId and published; the state is read back", async () => {
  const { w, dev } = await team();
  const ana = await w.signIn("ana");
  await ana.act("memberpairingset", { body: { memberId: ana.member, published: true } });   // a published pairing of another member
  const mineOf = async () => (await dev.read("memberpairings")).pairings.find((p) => p.handle === dev.handle);
  const first = await mineOf();
  assert.equal(first.published, false, "kept private");
  const a = await open("account", { world: w, as: dev });
  for (const k of ["screen.account.pairing.head", "screen.account.pairing.choose", "screen.account.pairing.legend", "screen.account.pairing.private", "screen.account.pairing.public", "screen.account.pairing.change", "screen.account.pairing.undone"]) has(a, k);
  has(a, "screen.account.pairing.says", { cover: first.cover, handle: dev.handle });
  const radios = () => all(a.tree, (e) => e.tag === "input" && e.attrs.type === "radio" && /^ma-pair-/.test(e.attrs.id));
  assert.equal(radios().length, 2);
  assert.deepEqual(radios().map((r) => r.attrs.checked !== undefined), [true, false], "the stored choice (kept private) is the one chosen; nothing else is");
  assert.deepEqual(ops(a).filter((o) => o === "memberpairingset"), ["memberpairingset"]);
  assert.ok(textOf(all(a.tree, (e) => e.tag === "button" && e.attrs["data-act"] === "memberpairingset")[0]).includes(said("screen.account.pairing.save")));
  const r = await a.press("memberpairingset", { values: { "ma-pair-1": true } });
  assert.deepEqual([r.sent[0].op, r.sent[0].body], ["memberpairingset", { memberId: dev.member, published: true }]);
  assert.ok(r.sent.some((x) => x.op === "memberpairings"), "the pairings are read again");
  assert.equal((await mineOf()).published, true, "kept by the owner");
  assert.deepEqual(radios().map((r) => r.attrs.checked !== undefined), [false, true], "the state read back is the one drawn chosen");
  const back = await a.press("memberpairingset", { values: { "ma-pair-0": true } });
  assert.deepEqual(back.sent[0].body, { memberId: dev.member, published: false });
  assert.equal((await mineOf()).published, false);
});

test("R67 control: a member the pairings do not hold (the founder, who has no cover) is drawn no such section; a failed read is drawn failed, never as a choice", async () => {
  const { w, founder, dev } = await team();
  const ana = await w.signIn("ana");
  await ana.act("memberpairingset", { body: { memberId: ana.member, published: true } });
  assert.ok(!(await founder.read("memberpairings")).pairings.some((p) => p.handle === founder.handle), "the pairings hold no founder");
  const a = await open("account", { world: w, as: founder });
  lacks(a, "screen.account.pairing.head");
  assert.ok(!ops(a).includes("memberpairingset"));
  const f = await open("account", { world: w, as: dev, table: REFUSED("memberpairings", "NOT_SERVED") });
  assert.ok(!ops(f).includes("memberpairingset"), "no choice is drawn from a read that failed");
});

/* ---- T51 fix round 3: C51 (R22, R57; interface-shell R116) ---- */

/** A real Ed25519 key as the kit's unprotected key file (`BIOKEY-RAW1.`), and the public key line's base64 the kit would answer for it. */
function keyFile() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32), pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const u32 = (n) => Buffer.from([0, 0, 0, n]);
  return { text: "BIOKEY-RAW1.bio-ratify." + seed.toString("base64"), keyB64: Buffer.concat([u32(11), Buffer.from("ssh-ed25519"), u32(32), pub]).toString("base64") };
}
const chooseFile = (o, content) => { o.b.doc.getElementById("ma-keyfile").files = [{ name: "bio-signing-key.txt", size: content.length, text: async () => content }]; };
const untilRequest = async (o, op) => { for (let i = 0; i < 400 && !o.b.requests.some((r) => r.op === op); i++) { await new Promise((r) => setTimeout(r, 10)); await o.b.settle(10); } };

test("R22 R57 C51: the key section offers the member's key file, and a file chosen is read by the kit, handed to the signer (the dialog asks only the passphrase) and the key it holds is the one registered; nothing of the file is stored or sent", async () => {
  const f = keyFile();
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  const box = a.b.doc.getElementById("ma-keyfile");
  assert.equal(box.getAttribute("type"), "file", "the key file is chosen in a file box");
  has(a, "shell.signer.loadfile");
  chooseFile(a, f.text);
  const btn = a.b.doc.getElementById("cs-main").querySelectorAll('button[data-act="signerregisterown"]')[0];
  a.b.fire(btn, "click");
  await a.b.settle(80);
  const yes = a.b.doc.querySelector('[data-shell="dialog-yes"]');
  assert.ok(yes, "the kit's sign dialog is drawn");
  assert.equal(a.b.doc.getElementById("cs-key-file"), null, "no file box in the dialog: the screen handed the text over");
  a.b.fire(yes, "click");
  await untilRequest(a, "signerregisterown");
  const sent = a.b.requests.find((r) => r.op === "signerregisterown");
  assert.ok(sent, "the key is registered");
  assert.equal(sent.body.keyB64, f.keyB64, "the key the file holds, not a new one");
  assert.ok((await dev.read("signerlist")).signers.some((x) => x.key_b64 === f.keyB64 && x.status === "active"), "registered by the owner");
  assert.equal(a.b.idb.get("civicsmith-signer").get("keys").size, 0, "no second key is kept on this device");
  await a.b.settle(80); a.redraw();
  assert.ok(keyHeading(a, "screen.account.key.made.heading"), "Your key is made");
  assert.equal(all(a.tree, (e) => e.tag === "button" && textOf(e) === said("screen.account.key.savefile")).length, 0, "no file is offered: she holds it");
  assert.ok(![...a.b.store.values(), ...a.b.local.values()].some((v) => String(v).includes("BIOKEY")), "the file is kept nowhere");
  assert.ok(!JSON.stringify(a.b.requests).includes("BIOKEY"), "nor sent");
});

test("R22 R57 C51: an unreadable or empty key file is refused in the kit's word (the dialog's own, while the list lacks it) before anything is asked of the device; no file chosen makes the key as before (control)", async () => {
  const kit = (kf, known = []) => ({ w: (k) => (known.includes(k) ? "T:" + k : k), value: () => "", keyFile: kf, signer: { sign: async () => { throw new Error("signed"); }, register: async () => ({ ok: false, declined: true }) } });
  for (const word of ["shell.keyfile.unreadable", "shell.keyfile.empty"]) {
    assert.deepEqual(await regSpec().send({ ui: {} }, {}, kit(async () => ({ ok: false, word }), [word])), { refuse: word }, word + ": the helper's own word once the list holds it");
    assert.deepEqual(await regSpec().send({ ui: {} }, {}, kit(async () => ({ ok: false, word }))), { refuse: "shell.signer.notkey" }, word + ": never drawn as a key the list lacks");
  }
  // control: nothing chosen: the kit's register is asked, as before
  let registered = 0;
  const none = { ...kit(NO_FILE), signer: { sign: async () => { throw new Error("signed"); }, register: async () => { registered += 1; return { ok: false, declined: true }; } } };
  assert.deepEqual(await regSpec().send({ ui: {} }, {}, none), { refuse: "screen.account.key.declined" });
  assert.equal(registered, 1);
  // the page: an empty file chosen sends nothing and no dialog is drawn
  const { w, dev } = await team();
  const a = await open("account", { world: w, as: dev });
  chooseFile(a, "   ");
  const r = await a.press("signerregisterown");
  assert.deepEqual(r.sent, []);
  assert.equal(a.b.doc.querySelector('[data-shell="dialog-yes"]'), null, "no dialog");
  assert.ok(a.refused, "refused beside the act");
});
