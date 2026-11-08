/* Settings › Your group at the module's interface (R18): every member reads it; an administrator's acts each send their
   owner's arguments; a member is drawn none. Over the world (store-request): the team is made by the real acts of its founder, and the
   expectations are read back from what the owners answer, never copied from a literal. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, day, has, lacks, open, said, squash, textOf, SCREENS } from "./kit.mjs";
import { team, eastoak, site, fileOf, handleOf, enrolled, invited, hostedBy, namedBy, stakeBy, copyOf, holdKey, without,
         SEAL, PROFILE, WRITING_HELP } from "./seed-group.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
// the acts the screen draws: its own declaration (contract.test holds it to the registry's)
// (writinghelp only while the assistant is reachable, R40)
// (an administrator who is not the founder is offered no `export`: a copy is taken by the founder, R66)
const ALL = SCREENS.find((s) => s.id === "group").acts.map((a) => a.op).filter((op) => op !== "writinghelp" && op !== "export").sort();
/** A language by its name in `lang`, as the screen draws it (the browser's own names, the first letter capital). */
const named = (tags, lang = "en") => tags.map((t) => { const n = new Intl.DisplayNames([lang], { type: "language" }).of(t); return n.charAt(0).toUpperCase() + n.slice(1); }).join(", ");
const timeOf = (iso) => /T(\d{2}:\d{2})/.exec(iso)[1];

/** The copy of a whole record is a large answer: waits (bounded) until the page draws it, not for a fixed number of ticks. */
async function copyDrawn(o) {
  const until = Date.now() + 20000;
  for (o.redraw(); Date.now() < until && !all(o.tree, (x) => x.attrs["data-shown"] === "copy").length; o.redraw()) await o.b.settle(100);
}

test("R18 group: what the group chose is drawn to every member; the acts only to an administrator (control: a member is drawn none)", async () => {
  const t = await eastoak(await team());
  const { w, rosa, dev } = t;
  const id = await rosa.read("groupidentity"), langs = await rosa.read("grouplanguages"), court = await rosa.read("courtnotice");
  const hosting = (await rosa.read("hostingaccess")).current, bar = (await rosa.read("strengthbarof")).bar;
  const a = await open("group", { world: w, as: rosa });
  for (const op of ["groupidentity", "grouplanguages", "courtnotice", "hostingaccess", "strengthbarof"]) assert.ok(a.p.all.some((r) => r.op === op), op);
  has(a, "screen.group.name.now", { name: id.display_name });
  assert.ok(id.domain_verified_at, "the website's check found its file");
  has(a, "screen.group.domain.verified", { domain: id.domain, date: day(id.domain_verified_at) });
  has(a, "screen.group.languages.now", { languages: named(langs.languages) });
  assert.equal(court.choice, "tell");
  has(a, "screen.group.court.tell");
  assert.ok(a.text.includes(hosting.holders));
  assert.ok(a.text.includes(bar.reason));
  assert.deepEqual(ops(a), ALL);
  const m = await open("group", { world: w, as: dev });
  assert.deepEqual(ops(m), [], "absent, not greyed");
  has(m, "screen.group.admins");
  has(m, "screen.group.name.now", { name: id.display_name });
});

test("R18 group: groupnameset, groupdomainset, grouplanguagesset, courtnoticeset, hostingaccessset and strengthbarset (reasoned) send their owners' arguments", async () => {
  const t = await eastoak(await team());
  const a = await open("group", { world: t.w, as: t.founder });
  // a reason given wherever the shell asks one (its R11, by op-grades' rung)
  const body = async (op, values, data = {}) => { const r = await a.press(op, { values, data, reason: "as agreed" }); if (!r.sent.length) return null; const { reason, ...b } = r.sent[0].body; return op === "strengthbarset" ? r.sent[0].body : b; };
  assert.deepEqual(await body("groupnameset", { "gr-name": " East Oakland Watch Collective " }), { name: "East Oakland Watch Collective" });
  assert.equal(await body("groupnameset", { "gr-name": " " }), null);
  assert.equal(a.refused.key, "screen.group.name.empty");
  assert.deepEqual(await body("groupdomainset", { "gr-domain": "watch.example" }), { domain: "watch.example" });
  // the languages are ticked by name; the tags are the boxes' ids and the body's values only (R31)
  assert.deepEqual(await body("grouplanguagesset", { "gr-lang-vi": true }), { languages: ["en", "es", "vi"] });
  assert.equal(await body("grouplanguagesset", { "gr-lang-en": false, "gr-lang-es": false, "gr-lang-vi": false }), null, "one at least");
  assert.equal(a.refused.key, "screen.group.languages.count");
  const many = Object.fromEntries(["zh", "yue", "vi", "tl", "ko", "ja", "fr", "ar", "ru", "pt", "hi", "so", "am", "ti", "fa", "uk", "hy", "km", "th", "ht", "de"].map((t) => ["gr-lang-" + t, true]));
  assert.equal(await body("grouplanguagesset", many), null, "twenty at most");
  assert.deepEqual(await body("courtnoticeset", { "gr-court-dont": true }), { choice: "dont" });
  assert.deepEqual(await body("courtnoticeset", { "gr-court-tell": true }), { choice: "tell" });
  assert.deepEqual(await body("hostingaccessset", { "gr-holders": "Rosa", "gr-hnote": "" }), { holders: "Rosa" });
  assert.deepEqual(await body("hostingaccessset", { "gr-holders": "Rosa", "gr-hnote": "vault" }), { holders: "Rosa", note: "vault" });
  assert.deepEqual(await body("strengthbarset", { "gr-cap": "A", "gr-con": "", "gr-why": "We publish only firsthand records." }), { capture: "A", connection: null, reason: "We publish only firsthand records." });
  assert.equal(await body("strengthbarset", { "gr-cap": "A", "gr-con": "", "gr-why": "" }), null, "reasoned: no reason, nothing sent");
  assert.equal(a.refused.key, "screen.group.bar.noreason");
  assert.equal(await body("strengthbarset", { "gr-cap": "", "gr-con": "", "gr-why": "x" }), null);
  assert.equal(a.s.acts.find((x) => x.op === "strengthbarset").reasonField, "reason");
  // what the acts did, read back from the owners
  assert.equal((await t.founder.read("groupidentity")).display_name, "East Oakland Watch Collective");
  assert.deepEqual((await t.founder.read("grouplanguages")).languages, ["en", "es", "vi"]);
  assert.equal((await t.founder.read("courtnotice")).choice, "tell");
  assert.deepEqual([(await t.founder.read("hostingaccess")).current.holders, (await t.founder.read("hostingaccess")).current.note], ["Rosa", "vault"]);
  assert.equal((await t.founder.read("strengthbarof")).bar.capture, "A");
});

// a 1 x 1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("R18 group: grouplogoset sends the chosen PNG or JPEG's own bytes as the body with its type, nothing in the address; another type sends nothing", async () => {
  const t = await eastoak(await team());
  const a = await open("group", { world: t.w, as: t.founder });
  const spec = a.s.acts.find((x) => x.op === "grouplogoset");
  const png = { type: "image/png", size: 1200, name: "logo.png" };
  const cs = { file: () => png };
  assert.deepEqual(spec.send({}, {}, cs), { raw: png, rawType: "image/png" });
  assert.deepEqual(spec.send({}, {}, { file: () => ({ type: "image/jpeg", size: 1 }) }).rawType, "image/jpeg");
  assert.deepEqual(spec.send({}, {}, { file: () => ({ type: "image/gif", size: 1 }) }), { refuse: "screen.group.logo.type" });
  assert.deepEqual(spec.send({}, {}, { file: () => ({ type: "image/png", size: 200 * 1024 + 1 }) }), { refuse: "screen.group.logo.size" });
  assert.deepEqual(spec.send({}, {}, { file: () => null }), { refuse: "screen.group.logo.nofile" });
  lacks(a, "screen.group.logo.set");
  // the logo set by the owner's act (R86: the bytes as `raw`, base64, with their type)
  await t.founder.act("grouplogoset", { body: { raw: PNG.toString("base64"), rawType: "image/png" } });
  assert.equal((await t.founder.read("groupidentity")).logo, true);
  has(await open("group", { world: t.w, as: t.founder }), "screen.group.logo.set");
});

test("R31 group: every language is shown by its name in the member's language and ticked by name; a tag such as en-US is never shown or typed", async () => {
  const t = await team();
  const { w, founder, rosa, dev } = t;
  await founder.act("grouplanguagesset", { body: { languages: ["en-US", "es", "vi"] } });
  const tags = (await rosa.read("grouplanguages")).languages;
  assert.deepEqual(tags, ["en-US", "es", "vi"]);
  const a = await open("group", { world: w, as: rosa });
  assert.ok(a.text.includes("English") && a.text.includes("Spanish") && a.text.includes("Vietnamese"));
  assert.ok(!/\ben-US\b|\bvi\b|\bes\b/.test(a.text), "no tag is drawn");
  assert.equal(all(a.tree, (e) => e.tag === "input" && e.attrs.type === "text" && /lang/.test(e.attrs.id || "")).length, 0, "no tag is typed");
  const boxes = all(a.tree, (e) => e.tag === "input" && e.attrs.type === "checkbox" && /^gr-lang-/.test(e.attrs.id));
  assert.ok(boxes.length >= 20 && boxes.every((b) => a.tree && all(a.tree, (l) => l.tag === "label" && l.attrs.for === b.attrs.id).length === 1), "each box has its label, the language's name");
  assert.deepEqual(boxes.filter((b) => "checked" in b.attrs).map((b) => b.attrs.id), tags.map((x) => "gr-lang-" + x), "the languages set are ticked");
  // in the member's language
  await rosa.act("memberlanguageset", { body: { language: "es" } });
  assert.equal((await rosa.read("memberlanguage")).language, "es");
  const es = await open("group", { world: w, as: rosa });
  has(es, "screen.group.languages.now", { languages: named(tags, "es") });
  // a member who does not administer reads them too, with no box
  const m = await open("group", { world: w, as: dev });
  has(m, "screen.group.languages.now", { languages: named(tags) });
  assert.equal(all(m.tree, (e) => e.tag === "input").length, 0);
});

test("R33, R75 group: a hosting account recorded at setup or by the system is set at setup or by the system (its own words), never a credential's name", async () => {
  const { w, rosa, dev } = await team();
  const at = () => w.sql.exec("SELECT at FROM hosting_access ORDER BY seq DESC LIMIT 1").toArray()[0].at;
  // the installer's bootstrap and the machines record it; the latest row is the account (membership refuses every machine its act: no act makes these)
  for (const [by, key] of [["bootstrap", "screen.group.hosting.now.setup"], ["", "screen.group.hosting.now.setup"], ["token:setup-1", "screen.group.hosting.now.system"], ["class:daemon", "screen.group.hosting.now.system"]]) {
    hostedBy(w, by);
    const a = await open("group", { world: w, as: dev });
    has(a, key, { date: day(at()) });
    assert.ok(!/\badmin\b|token:|class:/.test(a.text), `${JSON.stringify(by)} is not drawn`);
  }
  // control: a member who recorded it is named
  await rosa.act("hostingaccessset", { body: { holders: "Rosa and Lu", note: "the shared vault" } });
  const current = (await rosa.read("hostingaccess")).current;
  assert.equal(current.recorded_by, "rosa");
  const r = await open("group", { world: w, as: dev });
  has(r, "screen.group.hosting.now", { by: "rosa", date: day(current.at) });
});

test("R28 group: a section that holds nothing is not drawn, and nothing says there is none", async () => {
  const { w, dev } = await team();   // a team that has chosen nothing yet
  const m = await open("group", { world: w, as: dev });
  for (const k of ["screen.group.name.none", "screen.group.logo.none", "screen.group.domain.none", "screen.group.languages.none", "screen.group.hosting.none", "screen.group.bar.none"]) assert.ok(!m.text.includes(said(k)), k);
  for (const k of ["name", "domain", "languages", "hosting", "bar"]) assert.equal(all(m.tree, (e) => e.tag === "h2" && e.children.some((c) => (c.text || "").includes(said("screen.group." + k + ".heading")))).length, 0, `no ${k} section`);
  // control: a read that failed is still drawn as failed
  const f = await open("group", { world: w, as: dev, table: { groupidentity: "none" } });
  assert.ok(all(f.tree, (e) => e.attrs["data-state"] === "failed").length >= 1);
});

/* R40 (T49; DEC-231; instance-setup R11, R77): the group's declared stake */
test("R40 the statement is drawn with who set it and when, or that none is declared; a member reads it and is drawn no act", async () => {
  const t = await eastoak(await team());
  const { w, founder, rosa, dev } = t;
  const id = await rosa.read("groupidentity"), STAKE = id.declared_stake.stake;
  assert.ok(STAKE && id.declared_stake_history.length === 2, "declared after a clear");
  const a = await open("group", { world: w, as: rosa });
  assert.ok(a.text.includes(said("stake.group.title")) && a.text.includes(STAKE));
  has(a, "stake.set", { who: await handleOf(rosa), date: day(id.declared_stake.set_at) });
  has(a, "stake.history", { n: id.declared_stake_history.length - 1 });
  assert.ok(acts(a.tree).some((b) => b.attrs["data-act"] === "declaredstakeset") && a.text.includes(said("stake.group.label")));
  const m = await open("group", { world: w, as: dev });
  assert.ok(m.text.includes(STAKE));
  assert.deepEqual(ops(m), [], "control: a member is drawn no act");
  // none declared; a read that does not carry it is told unreadable, never none
  const bare = await team();
  await bare.founder.act("groupnameset", { body: { name: "East Oakland Watch" } });
  assert.equal((await bare.rosa.read("groupidentity")).declared_stake.stake, null);
  const none = await open("group", { world: bare.w, as: bare.rosa });
  has(none, "stake.none");
  // WORLD GAP: the owner always carries the stake; the same answer without it
  const unread = await open("group", { world: bare.w, as: bare.rosa, table: { groupidentity: without(bare.rosa, "groupidentity", "declared_stake", "declared_stake_history") } });
  has(unread, "stake.unreadable");
  assert.ok(!unread.text.includes(said("stake.none")));
});

test("R40 declaredstakeset saves the statement; an emptied field clears it (null); STAKE_MALFORMED and NOT_AN_ADMIN are drawn by their words", async () => {
  const t = await eastoak(await team());
  const a = await open("group", { world: t.w, as: t.founder });
  assert.deepEqual((await a.press("declaredstakeset", { values: { "gr-stake": "  We rent in the flats.  " } })).sent[0].body, { stake: "We rent in the flats." });
  assert.equal((await t.founder.read("groupidentity")).declared_stake.stake, "We rent in the flats.");
  assert.deepEqual((await a.press("declaredstakeset", { values: { "gr-stake": "" } })).sent[0].body, { stake: null });
  assert.equal((await t.founder.read("groupidentity")).declared_stake.stake, null);
  // the owner's refusals: a statement that is not one line of 1,000 characters at most; a session that is not an active administrator of the setup
  const long = await open("group", { world: t.w, as: t.founder });
  await long.press("declaredstakeset", { values: { "gr-stake": "x".repeat(1001) } });
  assert.ok(long.refused.text.includes(said("refusal.STAKE_MALFORMED")), "STAKE_MALFORMED");
  const r = await open("group", { world: t.w, as: t.rosa });
  await r.press("declaredstakeset", { values: { "gr-stake": "x" } });
  assert.ok(r.refused.text.includes(said("refusal.NOT_AN_ADMIN")), "NOT_AN_ADMIN");
});

test("R40 writinghelp under the field only while the assistant is reachable; its draft in the field, labeled, untested where the answer says so, kept only by the administrator's own save", async () => {
  const off = await eastoak(await team());
  assert.ok(!ops(await open("group", { world: off.w, as: off.founder })).includes("writinghelp"));
  // the assistant is reachable once the team holds its own key, switched on (the real acts)
  const t = await eastoak(await team({ env: { ACCOUNT_SEAL_SECRET: SEAL } }));
  await holdKey(t.founder, t.w);
  const draft = WRITING_HELP(t.founder).result;
  const a = await open("group", { world: t.w, as: t.founder, table: { writinghelp: () => WRITING_HELP(t.founder) } });   // WORLD GAP: the door asks no draft (seed-group)
  assert.ok(ops(a).includes("writinghelp"));
  const r = await a.press("writinghelp", { data: { field: "stake", id: "gr-stake" }, values: { "gr-stake": "we rent" }, reason: "we rent" });
  assert.deepEqual(r.sent.map((x) => [x.op, x.body]), [["writinghelp", { op: "declaredstakeset", field: "stake", told: "we rent" }]], "nothing is saved: no declaredstakeset");
  assert.equal(a.b.doc.getElementById("gr-stake").value, draft.text);
  has(a, "screen.group-identity.draft.label", { handle: t.founder.handle });
  lacks(a, "ai.label.untested");
  const before = (await t.founder.read("groupidentity")).declared_stake.stake;
  assert.notEqual(before, draft.text, "nothing was saved");
  const k = await a.press("declaredstakeset", { values: {} });
  assert.deepEqual(k.sent[0].body, { stake: draft.text }, "kept by the administrator's own save");
  assert.equal((await t.founder.read("groupidentity")).declared_stake.stake, draft.text);
});

/* R44 (T50; U4; DEC-290): defined terms where they appear */
const headingOf = (o, key) => all(o.tree, (e) => e.tag === "h2" && textOf(e) === said(key))[0];
test("R44 group: the hosting account and the bar carry their card on the heading; each section opens with its sentence; the card is not said again in the body", async () => {
  const t = await eastoak(await team());
  const a = await open("group", { world: t.w, as: t.rosa });
  const card = (key) => said(key).slice(0, 30);
  assert.ok(headingOf(a, "screen.group.hosting.heading").attrs["data-tip"].includes(card("term.hostingaccount.means")), "the hosting account's card");
  assert.ok(headingOf(a, "screen.group.bar.heading").attrs["data-tip"].includes(card("term.bar.team.means")), "the bar's card");
  has(a, "screen.group.hosting.says");
  has(a, "screen.group.court.says");
  const body = textOf(a.tree);
  assert.ok(!body.includes(said("term.hostingaccount.means")) && !body.includes(said("term.bar.team.means")), "the card is not repeated in the body");
  // a member reads them too
  const m = await open("group", { world: t.w, as: t.dev });
  assert.ok(headingOf(m, "screen.group.hosting.heading").attrs["data-tip"].includes(card("term.hostingaccount.means")));
  has(m, "screen.group.hosting.says");
  // the screen's purpose is the reworded one, in Settings
  const st = await open("settings", { world: t.w, as: t.rosa });
  has(st, "screen.group.purpose");
});

/* R45 (T50; N1181): the team's time zone, named and never coded */
const ZONES7 = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];

/** A team that has chosen its profile and nothing else (no name set: the name's own setup line is not the zone's). */
async function zoned() {
  const t = await team();
  await t.founder.act("profilesset", { body: { profiles: [PROFILE] } });
  return t;
}

test("R45 the zone that governs is shown by its name, never its id: the design's seven by label.timezones.*, any other by its generic name and its city", async () => {
  const t = await zoned();
  const { w, rosa, dev, founder } = t;
  // the profile's own `time_zone` fact as `factstatus` lists it (since T53 the layer that holds it, `us-california`), named by its layer's name
  const zoneFact = (facts) => facts.find((f) => f.fact && f.fact.fact === "time_zone" && !f.fact.office);
  const held = zoneFact((await rosa.read("factstatus")).facts);
  const correct = async (z) => { const r = await founder.act("factconfirm", { body: { act: "correct", value: z, how: "read on the city's site", source: "oaklandca.gov", path: held.path, reason: "r" } }); assert.ok(r.ok !== false, "the owner takes the correction"); };
  const answer = await rosa.read("profiles");
  const place = [...answer.profiles, ...(answer.layers ?? [])].find((p) => p.id === held.fact.profile).name;
  assert.equal(held.governs.origin, "profile");
  assert.ok(place && place !== held.fact.profile, "control: the place has a name of its own");
  // the profile's own zone, followed by the setup line
  const own = await open("group", { world: w, as: dev });
  has(own, "screen.group.timezone.governs.profile", { zone: said(`label.timezones.${held.governs.value}`), profile: place });
  has(own, "settings.set.line.setup");
  assert.ok(!own.text.includes(held.governs.value) && !/\bUTC\b/.test(own.text), "no id, no UTC");
  assert.ok(!own.text.includes(held.fact.profile), "the place by its name, never its id");
  // a correction (the latest governs): every zone of the design, then one the design does not name
  for (const z of ZONES7.filter((z) => z !== held.governs.value)) {
    await correct(z);
    assert.equal(zoneFact((await rosa.read("factstatus")).facts).governs.value, z);
    const a = await open("group", { world: w, as: dev });
    has(a, "screen.group.timezone.governs.local", { zone: said(`label.timezones.${z}`) });
    assert.ok(!a.text.includes(z) && !/\bUTC\b/.test(a.text), `${z}: no id, no UTC`);
  }
  await correct("Europe/Berlin");
  const other = await open("group", { world: w, as: dev });
  assert.ok(other.text.includes("Berlin") && !other.text.includes("Europe/Berlin"), "the city, not the id");
  // a corrected zone is not followed by the setup line (control: it is the profile's that is)
  const c = await open("group", { world: w, as: dev });
  lacks(c, "settings.set.line.setup");
  has(c, "screen.group.timezone.help");
});

test("R45 a correction sends factconfirm with act correct, the zone, how and source on the team's own path (a place's zone is only the default); then the zone is read again and named as saved", async () => {
  const t = await zoned();
  const { w, founder } = t;
  const a = await open("group", { world: w, as: founder });
  const r = await a.press("factconfirm", { choose: { "gr-tz0": "America/Denver" }, values: { "gr-tz-how0": "read on the city's site", "gr-tz-src0": "oaklandca.gov" }, reason: "r" });
  assert.deepEqual(r.sent[0].body, { act: "correct", value: "America/Denver", how: "read on the city's site", source: "oaklandca.gov", path: "@team/time_zone", reason: "r" });
  assert.ok(r.sent.slice(1).some((x) => x.op === "factstatus"), "read again");
  assert.equal((await founder.read("factstatus", { query: { path: "@team/time_zone" } })).governs.value, "America/Denver");
  has(a, "screen.group.timezone.saved", { zone: said("label.timezones.America/Denver") });
  has(a, "screen.group.timezone.governs.local", { zone: said("label.timezones.America/Denver") });
  lacks(a, "settings.set.line.setup");
  // the owner's refusals are drawn by their words: no source, no way of checking, no fact held
  const press = async (world, values) => { const x = await open("group", { world: world.w, as: world.founder }); await x.press("factconfirm", { choose: { "gr-tz0": "America/Denver" }, values, reason: "r" }); return x; };
  const noSource = await press(t, { "gr-tz-how0": "h", "gr-tz-src0": "" });
  assert.ok(noSource.refused && noSource.refused.text.includes(said("refusal.FACT_VALUE_REFUSED")), "FACT_VALUE_REFUSED");
  const noHow = await press(t, { "gr-tz-how0": "", "gr-tz-src0": "s" });
  assert.ok(noHow.refused && noHow.refused.text.includes(said("refusal.FACT_HOW_REFUSED")), "FACT_HOW_REFUSED");
  // the team's own path is stated whether or not a place is held, so the owner no longer answers NO_SUCH_FACT to the screen's correction (local-facts R21)
  const noPlace = await open("group", { world: w, as: founder });
  await founder.act("profilesset", { body: { profiles: [] } });
  await noPlace.press("factconfirm", { choose: { "gr-tz0": "America/Chicago" }, values: { "gr-tz-how0": "h", "gr-tz-src0": "s" }, reason: "r" });
  assert.ok(!noPlace.refused, "a place let go after the page drew it does not refuse the correction");
});

test("R45 none held: a fold, the choice below it, no UTC; a member who does not administer is drawn no correction", async () => {
  const t = await team();
  // none held (no profile chosen): the world's own answer
  const none = await open("group", { world: t.w, as: t.rosa });
  const nf = all(none.tree, (e) => e.tag === "details" && e.attrs["data-state"] === "tznone")[0];
  assert.ok(nf && "open" in nf.attrs && textOf(nf).includes(said("screen.group.timezone.none.summary")) && textOf(nf).includes(said("screen.group.timezone.none")));
  assert.ok(!/\bUTC\b/.test(none.text), "no UTC in its place");
  assert.equal(all(none.tree, (e) => e.tag === "button" && e.attrs["data-act"] === "factconfirm").length, 1, "the choice is drawn");
  // control: a member who does not administer is drawn no correction, whatever zone the profile gives
  const z = await zoned();
  const m = await open("group", { world: z.w, as: z.dev });
  assert.deepEqual(ops(m), []);
  assert.equal(all(m.tree, (e) => e.tag === "input" || e.tag === "select").length, 0);
});

const TEAM_ZONE = "@team/time_zone";
/* D-B1 (walk-T51-alpha; local-facts R21, K5282): a team with no place chosen states its own zone from the screen */
test("R45 D-B1 no place chosen: the zone is stated from the screen on the team's own path, the owner takes it, and the screen then names it as the team's", async () => {
  const t = await team();
  const { w, founder } = t;
  assert.equal((await founder.read("factstatus", { query: { path: TEAM_ZONE } })).status, "absent", "no zone held, no place");
  const a = await open("group", { world: w, as: founder });
  assert.equal(all(a.tree, (e) => e.tag === "details" && e.attrs["data-state"] === "tznone").length, 1, "none held is said");
  const r = await a.press("factconfirm", { choose: { "gr-tz0": "America/Denver" }, values: { "gr-tz-how0": "read on the city's site", "gr-tz-src0": "oaklandca.gov" }, reason: "r" });
  assert.deepEqual(r.sent[0].body, { act: "correct", value: "America/Denver", how: "read on the city's site", source: "oaklandca.gov", path: TEAM_ZONE, reason: "r" });
  assert.ok(!a.refused, "the owner takes it: not NO_SUCH_FACT");
  const held = await founder.read("factstatus", { query: { path: TEAM_ZONE } });
  assert.equal(held.status, "corrected");
  assert.equal(held.governs.value, "America/Denver");
  has(a, "screen.group.timezone.saved", { zone: said("label.timezones.America/Denver") });
  has(a, "screen.group.timezone.governs.local", { zone: said("label.timezones.America/Denver") });
  assert.equal(all(a.tree, (e) => e.tag === "details" && e.attrs["data-state"] === "tznone").length, 0, "no longer said to be none");
  assert.ok(!/\bUTC\b/.test(a.text), "no UTC");
});

/* R52 (T50; N1106, N1183): values not set by a member, and the name acknowledged */
test("R52 a value not set by a member is said as set at setup or by the system, never by a credential's name; a value set by a member is not", async () => {
  const t = await team();
  const { w, founder, rosa, dev } = t;
  await founder.act("groupnameset", { body: { name: "East Oakland Watch" } });   // by the founder: recorded as "admin", the setup
  await founder.act("profilesset", { body: { profiles: [PROFILE] } });   // the zone's own line is the profile's: setup
  const lineSetup = said("settings.set.line.setup"), lineSystem = said("settings.set.line.system");
  const count = (o) => o.text.split(lineSetup).length - 1;
  const seen = async (by) => { if (by) namedBy(w, by); return open("group", { world: w, as: dev }); };
  const f = await seen(null);
  assert.ok(f.text.includes(lineSetup) && !f.text.includes(lineSystem), "admin");
  assert.equal(count(f), 2, "the name's line and the time zone's own");
  // SEED: the store records the session's member; a prefixed id, a machine or a seed are rows the installer or a daemon wrote
  const m1 = await seen("member:admin"); assert.ok(m1.text.includes(lineSetup) && !m1.text.includes(lineSystem), "member:admin");
  for (const by of ["class:daemon", "token:abc", "seed"]) { const o = await seen(by); assert.ok(o.text.includes(lineSystem), by); assert.ok(!/class:|token:|seed\b/.test(o.text), `${by} is not drawn`); }
  // control: a member's own change (rosa, an administrator who is not the founder) draws no such line
  await rosa.act("groupnameset", { body: { name: "East Oakland Watch" } });
  const m = await seen(null);
  assert.ok(!m.text.includes(lineSystem) && count(m) === 1, "control: a member's own change draws no such line (the time zone's own line is the one)");
});

test("R52 after groupnameset answers, the new name is said (screen.group.name.saved); the same name says nothing changed, in a fold open whenever drawn", async () => {
  const t = await eastoak(await team());
  const a = await open("group", { world: t.w, as: t.founder });
  await a.press("groupnameset", { values: { "gr-name": "East Oakland Watch Collective" }, reason: "r" });
  assert.equal((await t.founder.read("groupidentity")).display_name, "East Oakland Watch Collective");
  has(a, "screen.group.name.saved", { name: "East Oakland Watch Collective" });
  lacks(a, "screen.group.name.same");
  const name = (await t.founder.read("groupidentity")).display_name;
  const b = await open("group", { world: t.w, as: t.founder });
  await b.press("groupnameset", { values: { "gr-name": name }, reason: "r" });
  const fold = all(b.tree, (e) => e.tag === "details" && e.attrs["data-state"] === "namesame")[0];
  assert.ok(fold && "open" in fold.attrs && textOf(fold).includes(said("screen.group.name.same.summary")) && textOf(fold).includes(said("screen.group.name.same")));
  lacks(b, "screen.group.name.saved", { name });
});

/* ---- T51 FR-25: C30 (R66), C11 (R69), T-18 (R75) ---- */

const copyRows = (o) => all(o.tree, (e) => /cs-row/.test(e.attrs.class || "") && all(e, (x) => /mk-data/.test(x.attrs.class || "")).length >= 4).map((e) => squash(textOf(e)));

test("R66 the founder is drawn the copy of the record (a field for her words, Take a copy of the record, that it cannot be undone) and the list of copies; the list shows each copy's time, its counts and her words, newest first", async () => {
  const t = await eastoak(await team());
  const { w, founder } = t;
  const a = await open("group", { world: w, as: founder });
  has(a, "screen.group.export.head"); has(a, "screen.group.export.says");
  has(a, "screen.group.export.note.label"); has(a, "screen.group.export.note.cut");
  has(a, "screen.group.export.undone"); has(a, "screen.group.export.undone.why");
  assert.deepEqual(ops(a).filter((o) => o === "export" || o === "exportlog"), ["export", "exportlog"]);
  lacks(a, "screen.group.export.log.cap");
  const r = await a.press("exportlog", {});
  assert.deepEqual(r.sent.map((x) => x.op), ["exportlog"], "the list is a read");
  const log = (await founder.read("exportlog")).exports;
  assert.equal(log.length, 2);
  const t0 = copyRows(a);
  assert.equal(t0.length, 2);
  assert.ok(log[0].seq > log[1].seq, "the owner lists the newest first");
  log.forEach((c, i) => {
    assert.ok(t0[i].includes(day(c.at)) && t0[i].includes(String(c.bundles)) && t0[i].includes(String(c.files)) && t0[i].includes(String(c.tables)), `copy ${c.seq}: its time and its counts`);
    if (c.note) assert.ok(t0[i].includes(c.note), "her words");
  });
  assert.ok(log[0].note && !log[1].note);
  has(a, "screen.group.export.log.cap");
  // taking a copy sends her words (cut by the owner, not here), and the list is read again to show it
  const e = await a.press("export", { values: { "gr-exnote": "  Before the hearing  " } });
  assert.deepEqual([e.sent[0].op, e.sent[0].query], ["export", { note: "Before the hearing" }], "C85: the owner reads the note from the query");
  assert.ok(e.sent.some((x) => x.op === "exportlog"), "the list is read again: the copy is in it");
  const after = (await founder.read("exportlog")).exports;
  assert.equal(after.length, 3);
  assert.equal(after[0].note, "Before the hearing");
  // nothing kept of the copy on the page
  assert.ok(!a.html.includes("working-corpus"));
  // no words: the body names none
  const bare = await a.press("export", { values: { "gr-exnote": "" } });
  assert.deepEqual(bare.sent[0].query, {});
});

test("R66 control: an administrator who is not the founder is drawn the list and no act to take a copy, and who can; a member is drawn none of it; a refusal is drawn in the design's words", async () => {
  const t = await eastoak(await team());
  const { w, founder, rosa, dev } = t;
  const a = await open("group", { world: w, as: rosa });
  assert.ok(ops(a).includes("exportlog") && !ops(a).includes("export"));
  has(a, "screen.group.export.head"); has(a, "screen.group.export.refused.founder"); has(a, "screen.group.export.refused.next");
  lacks(a, "screen.group.export.undone");
  const m = await open("group", { world: w, as: dev });
  lacks(m, "screen.group.export.head");
  assert.ok(!ops(m).includes("export") && !ops(m).includes("exportlog"));
  assert.ok(!m.p.requests.some((r) => r.op === "exportlog"));
  // the owner refuses a credential that is not the root of trust: its words, beside the act
  // (rosa, whom the owner refuses it, is drawn no act; the founder's own session is the root of trust, so no act makes the refusal: WORLD GAP)
  const direct = await w.door({ url: "/api/?op=export", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, rosa);
  assert.equal(direct.json.reason, "ROOT_OF_TRUST_REQUIRED");
  const f = await open("group", { world: w, as: founder, table: { export: { ok: false, status: 403, code: "ROOT_OF_TRUST_REQUIRED" } } });
  await f.press("export", {});
  assert.ok(f.refused && f.refused.text.includes(said("screen.group.export.refused.founder")) && f.refused.text.includes(said("screen.group.export.refused.next")), JSON.stringify(f.refused));
  // an empty list is told nothing (no rows, no count): only the note
  const bare = await team();
  assert.deepEqual((await bare.founder.read("exportlog")).exports, []);
  const none = await open("group", { world: bare.w, as: bare.founder });
  await none.press("exportlog", {});
  assert.equal(copyRows(none).length, 0);
});

const folds = (o) => all(o.tree, (e) => e.tag === "details" && "data-domainfile" in e.attrs);
const gapsOf = (n) => all(n, (e) => /\bcs-gap\b/.test(e.attrs.class || "")).map((e) => squash(textOf(e)));
const VERIFIER = ["malformed", "absent", "mismatched", "undetermined", "notadmin"].map((k) => "screen.domainfile.refused." + k);

test("R69 group draws the team's website file as instance-setup answers it (well_known), a save and a copy of it, and the steps to place it; the file follows the answer, the page builds none", async () => {
  for (const group of ["wk-sentinel-slug", "wk-other-slug"]) {
    const t = await team({ instanceName: group });
    await t.founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
    const wk = await fileOf(t.rosa);
    assert.equal(wk.body.group, group, "the file names the team the instance produces");
    const o = await open("group", { world: t.w, as: t.rosa });
    const [fold] = folds(o);
    assert.equal(folds(o).length, 1);
    assert.equal(textOf(all(fold, (e) => e.tag === "summary")[0]), said("screen.domainfile.summary"));
    has(o, "screen.domainfile.what"); has(o, "screen.domainfile.steps"); has(o, "screen.domainfile.daily");
    const segs = wk.path.split("/").filter(Boolean);
    const pre = all(fold, (e) => e.tag === "pre")[0];
    assert.deepEqual(JSON.parse(textOf(pre)), wk.body, "the file's text is the answer's body");
    assert.ok(textOf(fold).includes(segs.at(-1)), "named by the last segment of the answer's path");
    const binds = all(fold, (e) => e.tag === "button" && e.attrs["data-shell"] === "bind");
    assert.deepEqual(binds.map(textOf).sort(), [said("screen.domainfile.download"), said("shell.copy")].sort(), "a save and a copy of the file");
    assert.deepEqual(all(fold, (e) => e.tag === "li").map((e) => squash(textOf(e))), [
      said("screen.domainfile.step1"), said("screen.domainfile.step2", { folder: segs[0] }), said("screen.domainfile.step3"),
      said("screen.domainfile.step4", { address: "https://eastoak.example" + wk.path }), said("screen.domainfile.step5")]);
    const inner = all(fold, (e) => e.tag === "details" && e !== fold)[0];
    assert.deepEqual(gapsOf(inner), VERIFIER.map((k) => said(k)), "each refusal of the check in its fold");
    assert.ok(!o.p.requests.some((r) => r.op === "groupdomainset"), "drawing the file asks nothing of the team");
  }
});

test("R69 control: an answer with no file draws the steps without one; no claim draws no fold; a member reads the file as well, and is offered no act; groupdomainset refused draws the design's words", async () => {
  const old = await team({ instanceName: null });   // an installation that records no producing team: the claim has no file to look for
  await old.founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  assert.equal((await fileOf(old.rosa)), null);
  const o = await open("group", { world: old.w, as: old.rosa });
  const [fold] = folds(o);
  assert.equal(all(fold, (e) => e.tag === "pre").length, 0);
  assert.equal(all(fold, (e) => e.tag === "button").length, 0, "no save, no copy");
  assert.deepEqual(all(fold, (e) => e.tag === "li").map((e) => squash(textOf(e))), [said("screen.domainfile.step1"), said("screen.domainfile.step3"), said("screen.domainfile.step5")]);
  const t = await team();
  const none = await open("group", { world: t.w, as: t.rosa });
  assert.equal(folds(none).length, 0);
  lacks(none, "screen.domainfile.summary");
  await t.founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  const member = await open("group", { world: t.w, as: t.dev });
  assert.equal(folds(member).length, 1, "a member reads the file as well");
  assert.deepEqual(ops(member), []);
  // the owner's refusals, drawn by the design's words: an address that is not a domain; a session that is not an active administrator of the setup
  const x = await open("group", { world: t.w, as: t.founder });
  const p = await x.press("groupdomainset", { values: { "gr-domain": "https://eastoak.example/page" } });
  assert.equal(p.sent[0].op, "groupdomainset");
  assert.equal(x.refused.text, said("screen.domainfile.refused.malformed"));
  // WORLD GAP: the owner lets rosa (an administrator of membership) set the domain, so no act makes NOT_AN_ADMIN here: its refusal as a fault
  const n = await open("group", { world: t.w, as: t.rosa, table: { groupdomainset: { ok: false, status: 409, code: "NOT_AN_ADMIN" } } });
  const q = await n.press("groupdomainset", { values: { "gr-domain": "eastoak.example" } });
  assert.equal(q.sent[0].op, "groupdomainset");
  assert.equal(n.refused.text, said("screen.domainfile.refused.notadmin"));
});

test("R75 the hosting account recorded at setup or by Civicsmith itself says so, in its own words; one a member recorded keeps today's (control)", async () => {
  const { w, rosa } = await team();
  const at = () => w.sql.exec("SELECT at FROM hosting_access ORDER BY seq DESC LIMIT 1").toArray()[0].at;
  // (C88: "admin" and "member:admin" are the founder, a member who may have recorded it long after setup: named, see the C88 test)
  for (const by of ["bootstrap", "setup", ""]) {
    hostedBy(w, by, "Rosa and Lu");   // SEED: the installer's bootstrap records it; no act of a session does
    const o = await open("group", { world: w, as: rosa });
    has(o, "screen.group.hosting.now.setup", { date: day(at()) });
    lacks(o, "screen.group.hosting.now", { by: said("settings.set.setup"), date: day(at()) });
  }
  for (const by of ["daemon", "class:daemon", "token:abc", "seed", "system"]) {
    hostedBy(w, by, "Rosa and Lu");   // SEED: a machine credential's record (membership refuses a machine its act)
    const o = await open("group", { world: w, as: rosa });
    has(o, "screen.group.hosting.now.system", { date: day(at()) });
  }
  await rosa.act("hostingaccessset", { body: { holders: "Rosa and Lu" } });
  const m = await open("group", { world: w, as: rosa });
  has(m, "screen.group.hosting.now", { by: "rosa", date: day(at()) });
  lacks(m, "screen.group.hosting.now.setup", { date: day(at()) });
  lacks(m, "screen.group.hosting.now.system", { date: day(at()) });
});

/* ---- T51 fix round 2: C85, C86, C88, C94 ---- */

test("R66 C85: Take a copy of the record sends her words as the query's note, offers the answer (the manifest) as a download, and labels its counts; the list is read again; control: no words sends no note, a note in the body is no request", async () => {
  const t = await team();
  const { w, founder } = t;
  const a = await open("group", { world: w, as: founder });
  const e = await a.press("export", { values: { "gr-exnote": "  Before the hearing  " } });
  assert.equal(e.sent[0].op, "export");
  assert.deepEqual(e.sent[0].query, { note: "Before the hearing" }, "the owner reads the note from the query");
  assert.ok(!e.sent[0].body || Object.keys(e.sent[0].body).length === 0, "the body carries nothing");
  assert.ok(e.sent.some((x) => x.op === "exportlog"), "the list is read again");
  const copy = (await founder.read("exportlog")).exports[0];
  assert.equal(copy.note, "Before the hearing");
  // the answer is offered as a file, whole
  const save = all(a.tree, (x) => x.tag === "button" && x.attrs["data-shell"] === "bind" && textOf(x).includes(said("shell.save")))[0];
  assert.ok(save, "a download is offered");
  a.b.fire(a.b.doc.querySelector(`[data-bi="${save.attrs["data-bi"]}"]`), "click");
  await a.b.settle(40);
  assert.equal(a.b.files.length, 1);
  assert.match(a.b.files[0].name, /\.json$/);
  const manifest = JSON.parse(await a.b.files[0].blob.text());
  assert.equal(manifest.at, copy.at, "the file is the answer: the copy the list holds");
  assert.deepEqual([manifest.counts.bundles, manifest.counts.files, manifest.counts.tables, manifest.counts.rows], [copy.bundles, copy.files, copy.tables, copy.rows]);
  // the counts are labelled
  const offered = squash(textOf(all(a.tree, (x) => x.attrs["data-shown"] === "copy")[0]));
  const label = (n, one, other) => (n === 1 ? said(one) : said(other, { n: String(n) }));
  assert.ok(offered.includes(label(manifest.counts.bundles, "queue.export-performed.records.one", "queue.export-performed.records.other")) && offered.includes(label(manifest.counts.files, "queue.export-performed.files.one", "queue.export-performed.files.other")) && offered.includes(label(manifest.counts.tables, "screen.group.export.count.tables.one", "screen.group.export.count.tables.other")), offered);
  // control: no words, no note
  const bare = await open("group", { world: w, as: founder });
  const r = await bare.press("export", { values: { "gr-exnote": "" } });
  assert.deepEqual(r.sent[0].query, {});
  assert.ok(!r.sent[0].body || Object.keys(r.sent[0].body).length === 0);
  assert.equal((await founder.read("exportlog")).exports[0].note, null);
  // control: the file is not drawn into the page
  assert.ok(!a.html.includes(manifest.scope));
});

test("R18 C86: the latest check of the website draws when it was made and the plane's own verdict (file not found, 404), read again after Verify the website; control: a verified check draws no verdict line", async () => {
  const t = await team();
  const { w, founder, rosa } = t;
  let site_ = { status: 404 };
  site(w, "eastoak.example", () => site_);   // the team's website, which the platform answers for
  await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  const latest = async () => (await rosa.read("groupidentity")).domain_claim.latest;
  const absent = await latest();
  assert.equal(absent.verdict, "absent");
  const a = await open("group", { world: w, as: rosa });
  has(a, "screen.group.domain.verdict.absent");
  const line = squash(textOf(all(a.tree, (e) => e.attrs["data-state"] === "domainverdict")[0]));
  assert.ok(line.includes(said("screen.group.domain.checked", { date: day(absent.checked_at), time: timeOf(absent.checked_at) })), "when: " + line);
  assert.ok(line.includes(absent.detail), "the plane's verdict: " + line);
  // after the act the check made then is the one drawn
  w.tick(7 * 60 * 1000);   // a later check; the sessions stay (an own device idles out at 30 minutes)
  site_ = { instance: "https://elsewhere.example", group: "another-team" };
  const b = await open("group", { world: w, as: founder });
  await b.press("groupdomainset", { values: { "gr-domain": "eastoak.example" } });
  const later = await latest();
  assert.equal(later.verdict, "mismatched");
  assert.notEqual(later.checked_at, absent.checked_at);
  const line2 = squash(textOf(all(b.tree, (e) => e.attrs["data-state"] === "domainverdict")[0]));
  assert.ok(line2.includes(said("screen.group.domain.checked", { date: day(later.checked_at), time: timeOf(later.checked_at) })) && line2.includes(later.detail), line2);
  has(b, "screen.group.domain.verdict.mismatched");
  // control: verified draws the verified sentence and no verdict line
  site_ = (await fileOf(rosa)).body;
  await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  assert.equal((await latest()).verdict, "verified");
  const v = await open("group", { world: w, as: rosa });
  assert.equal(all(v.tree, (e) => e.attrs["data-state"] === "domainverdict").length, 0);
});

test("R75 C88: the hosting account is not said to be recorded at setup when a founder recorded it later; it is recorded on its date by the member named, the founder named by memberName; a bootstrap recorder and a machine keep their words", async () => {
  const { w, founder, dev } = await team();
  const at = () => w.sql.exec("SELECT at FROM hosting_access ORDER BY seq DESC LIMIT 1").toArray()[0].at;
  // the founder, who may have recorded it again long after setup: her handle, not "when set up"
  await founder.act("hostingaccessset", { body: { holders: "Rosa" } });
  assert.equal((await founder.read("hostingaccess")).current.recorded_by, "admin");
  const f = await open("group", { world: w, as: founder });
  has(f, "screen.group.hosting.now.date", { date: day(at()) });
  lacks(f, "screen.group.hosting.now.setup", { date: day(at()) });
  hostedBy(w, "member:admin", "Rosa");   // SEED: the store records the bare id; the prefixed one is how an older record kept it
  const g = await open("group", { world: w, as: dev });
  has(g, "screen.group.hosting.now.date", { date: day(at()) });
  assert.ok(!/\badmin\b/.test(g.text));
  // control: no one / the machines
  hostedBy(w, "", "Rosa");
  has(await open("group", { world: w, as: dev }), "screen.group.hosting.now.setup", { date: day(at()) });
  hostedBy(w, "class:daemon", "Rosa");
  has(await open("group", { world: w, as: dev }), "screen.group.hosting.now.system", { date: day(at()) });
});

test("R40 R75 C94: who set the stake and who recorded the hosting account are named by memberName: the handle where it differs from the id, the fallback word where the member has none, never an id", async () => {
  const { w, founder, dev } = await team();
  await enrolled(w, founder, "m-7", "luisa");   // her id is not her handle
  await invited(founder, "m-9");   // invited, and has not chosen a handle
  const roster = (await founder.read("memberlist")).members;
  assert.equal(roster.find((m) => m.member_id === "m-7").handle, "luisa");
  assert.ok(!roster.find((m) => m.member_id === "m-9").handle);
  await founder.act("declaredstakeset", { body: { stake: "We rent." } });
  const at = (sql) => w.sql.exec(sql).toArray()[0].at;
  // SEED: the recorder is a member the roster knows by another handle; no session of the world acts under an id that is not her handle
  stakeBy(w, "member:m-7"); hostedBy(w, "member:m-7");
  const a = await open("group", { world: w, as: dev });
  has(a, "stake.set", { who: "luisa", date: day(at("SELECT set_at AS at FROM declared_stake_history ORDER BY seq DESC LIMIT 1")) });
  has(a, "screen.group.hosting.now", { by: "luisa", date: day(at("SELECT at FROM hosting_access ORDER BY seq DESC LIMIT 1")) });
  assert.ok(!a.text.includes("m-7"));
  stakeBy(w, "member:m-9"); hostedBy(w, "member:m-9");
  const b = await open("group", { world: w, as: dev });
  has(b, "stake.set", { who: said("shell.card.member"), date: day(at("SELECT set_at AS at FROM declared_stake_history ORDER BY seq DESC LIMIT 1")) });
  has(b, "screen.group.hosting.now", { by: said("shell.card.member"), date: day(at("SELECT at FROM hosting_access ORDER BY seq DESC LIMIT 1")) });
  assert.ok(!b.text.includes("m-9"));
});

/* ---- T51 fix round 3: C85 (R66), the counts of the copies ---- */

test("R66 C85: each count of a copy in the list is drawn with its label (records, files, tables), one or many, a zero as any other; the copy just taken says its tables after a comma", async () => {
  const t = await team();
  const { w, founder } = t;
  const label = (n, one, other) => (n === 1 ? said(one) : said(other, { n: String(n) }));
  const counts = (c) => [label(c.bundles, "queue.export-performed.records.one", "queue.export-performed.records.other"), label(c.files, "queue.export-performed.files.one", "queue.export-performed.files.other"), label(c.tables, "screen.group.export.count.tables.one", "screen.group.export.count.tables.other")].join(" · ");
  await founder.act("export", { query: {} });
  copyOf(w, { bundles: 38, files: 112, tables: 14 }, "2026-10-18T14:05:00Z");   // SEED: a record with 38 bundles and a schema of 14 tables is not the world's
  const a = await open("group", { world: w, as: founder });
  await a.press("exportlog", {});
  const log = (await founder.read("exportlog")).exports;
  const rows = copyRows(a);
  assert.equal(rows.length, log.length);
  log.forEach((c, i) => assert.ok(rows[i].includes(counts(c)), rows[i]));
  assert.ok(log.some((c) => c.bundles === 0 && c.files === 0), "a zero is drawn as any other");
  // one of each takes the singular word
  copyOf(w, { bundles: 1, files: 1, tables: 1 }, "2026-10-19T00:00:00Z");   // SEED: as above
  const one = await open("group", { world: w, as: founder });
  await one.press("exportlog", {});
  const singles = copyRows(one).filter((r) => r.includes(counts({ bundles: 1, files: 1, tables: 1 })));
  assert.equal(singles.length, 1);
  assert.ok(singles[0].includes([said("queue.export-performed.records.one"), said("queue.export-performed.files.one"), said("screen.group.export.count.tables.one")].join(" · ")), singles[0]);
  // the copy just taken: the sentence's records and files, then a comma, then its tables
  const taken = await open("group", { world: w, as: founder });
  await taken.press("export", { values: { "gr-exnote": "" } });
  await copyDrawn(taken);   // the copy of a whole record is a large answer: the page has it when it has settled
  const copy = (await founder.read("exportlog")).exports[0];
  const said1 = squash(textOf(all(taken.tree, (x) => x.attrs["data-shown"] === "copy")[0]));
  const sentence = said("queue.export-performed.summary", { date: day(copy.at), records: label(copy.bundles, "queue.export-performed.records.one", "queue.export-performed.records.other"), files: label(copy.files, "queue.export-performed.files.one", "queue.export-performed.files.other") });
  assert.ok(said1.includes(sentence + ", " + label(copy.tables, "screen.group.export.count.tables.one", "screen.group.export.count.tables.other")), said1);
  // control: one table says the singular (WORLD GAP: a record's tables are the schema's: the real copy's answer with the counts of a small record)
  const small = async () => { const m = await founder.act("export", { query: {} }); return { ok: true, result: { ...m, counts: { bundles: 1, files: 1, tables: 1, rows: 1 } } }; };
  const single = await open("group", { world: w, as: founder, table: { export: small } });
  await single.press("export", { values: { "gr-exnote": "" } });
  await copyDrawn(single);
  const said2 = squash(textOf(all(single.tree, (x) => x.attrs["data-shown"] === "copy")[0]));
  assert.ok(said2.includes(", " + said("screen.group.export.count.tables.one")) && said2.includes(said("queue.export-performed.records.one")), said2);
});
