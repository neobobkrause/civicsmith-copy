/* Settings, the index (R17), and Recovery codes (R20), at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, day, has, lacks, open as openPlain, said, textOf, SCREENS } from "./kit.mjs";
import { team, SILENT, REFUSED } from "./seed-account.mjs";

/* The doors to `watching` and `leads` are drawn where the shell knows the ops those screens (another module's) act on; this stand-in names them,
   as the composed page does (interface-shell R12). */
const stub = (id, op) => ({ id, reads: () => ({}), render: () => "", acts: [{ op, send: () => null }], words: [], parts: {} });
const open = (id, o) => openPlain(id, { ...o, screens: [...SCREENS, stub("watching", "monitoring"), stub("leads", "lead")] });
const links = (o) => all(o.tree, (e) => e.tag === "a" && e.attrs["data-screen"]).map((e) => e.attrs["data-screen"]);

test("R17 settings: \"Yours\" then, to a session that administers, \"The group's\", each a reference to its screen; a member is drawn only their own", async () => {
  const { w, founder, dev } = await team();
  const a = await open("settings", { world: w, as: founder });
  assert.deepEqual(links(a), ["account", "ties", "notes", "recovery", "group", "group-identity", "members", "places", "security", "updates", "translations", "wizards", "bias", "grouprules", "watching", "leads"]);
  for (const id of links(a)) {
    const l = all(a.tree, (e) => e.tag === "a" && e.attrs["data-screen"] === id)[0];
    assert.equal(l.attrs.href, "/app/" + id);
    assert.equal(textOf(l), said(`screen.${id}.name`), id);
  }
  const t = a.text;
  assert.ok(t.indexOf(said("screen.settings.yours")) < t.indexOf(said("screen.settings.groups")), "yours first");
  assert.ok(t.indexOf(said("screen.settings.groups")) < t.indexOf(said("screen.settings.everyone")), "then the section for every member");
  // control: a member who does not administer is drawn no group section
  const m = await open("settings", { world: w, as: dev });
  assert.deepEqual(links(m), ["account", "ties", "notes", "recovery", "bias", "grouprules", "watching", "leads"]);
  lacks(m, "screen.settings.groups"); has(m, "screen.settings.everyone");
  assert.ok(!a.html.includes('href="/"'), "no link opens the setup page");
});

test("R32 settings draws its sections as the design's link list: each its icon and its screen's name as the reference, its purpose beneath, the two never run together", async () => {
  const { w, founder, dev } = await team();
  const a = await open("settings", { world: w, as: founder });
  const lists = all(a.tree, (e) => /\bmk-links\b/.test(e.attrs.class || ""));
  assert.equal(lists.length, 3, "Yours, the team's, and for every member");
  for (const id of links(a)) {
    const l = all(a.tree, (e) => e.tag === "a" && e.attrs["data-screen"] === id)[0];
    assert.equal(all(l, (e) => e.tag === "svg").length, 1, `${id} has its icon`);
    assert.equal(textOf(l), said(`screen.${id}.name`), `${id}'s reference is its name alone`);
    // the purpose is a box of its own beside the reference, beneath it, never inside it
    const purpose = all(a.tree, (e) => e.attrs["data-purpose"] === id)[0];
    assert.ok(purpose && textOf(purpose) === said(`screen.${id}.purpose`), `${id}'s purpose`);
    assert.ok(!ancestor(purpose, (e) => e === l) && purpose.parent === l.parent, `${id}: apart from the reference`);
    const sib = l.parent.children.filter((c) => c.tag);
    assert.equal(sib[sib.indexOf(l) + 1], purpose, `${id}: the purpose follows its name`);
  }
  // control: the group's section is not drawn to a member who does not administer
  const m = await open("settings", { world: w, as: dev });
  assert.equal(all(m.tree, (e) => /\bmk-links\b/.test(e.attrs.class || "")).length, 2, "Yours, and for every member");
  assert.ok(!links(m).includes("updates"), "R27: no Updates section for a member who does not administer");
});

test("R20 recovery: the member's own codes (recoverycodesstate); new codes shown once, saying first that issuing again spends the earlier ones", async () => {
  const { w, dev, teo } = await team();
  const issued = await dev.act("recoverycodesissue");   // the member's own codes, made by the owner's act
  const state = await dev.read("recoverycodesstate");
  const m = await open("recovery", { world: w, as: dev });
  assert.ok(m.p.requests.some((r) => r.op === "recoverycodesstate"));
  assert.ok(!m.p.requests.some((r) => r.op === "adminrecoverystep"), "a member is not asked the administrators' step");
  // credentials R46 issues the codes it states: the sentence's total is theirs while the owner does not answer a total, the owner's own when it does
  assert.equal(state.total, undefined, "the owner states no total of its own");
  has(m, "screen.recovery.held", { remaining: state.remaining, total: issued.codes.length, date: day(state.issuedAt) });
  assert.equal(state.remaining, issued.codes.length);
  has(m, "screen.recovery.spends");
  assert.deepEqual(acts(m.tree).map((b) => b.attrs["data-act"]), ["recoverycodesissue"], "every member issues their own (K3060 D4)");
  const r = await m.press("recoverycodesissue");
  assert.deepEqual(r.sent[0].body, {});
  const shown = all(m.tree, (e) => e.attrs["data-shown"] === "codes")[0];
  const drawn = all(shown, (e) => e.tag === "code").map((c) => textOf(c));
  assert.equal(drawn.length, issued.codes.length);
  assert.ok(drawn.every((c) => !issued.codes.includes(c)), "issuing again gave new codes, the earlier ones spent");
  assert.ok(m.text.indexOf(said("screen.recovery.spends")) < m.text.indexOf(drawn[0]), "said before the codes");
  assert.ok(![...m.b.store.values(), ...m.b.local.values()].some((v) => drawn.some((c) => String(v).includes(c))), "never stored");
  assert.ok(!m.b.requests.some((x) => drawn.some((c) => JSON.stringify([x.url, x.body]).includes(c))), "never sent");
  // a provider that states a total of its own (a later owner than the world's) is followed: the world's owner states none, so the answer is read
  // from the world and given the total (REPORT: recoverycodesstate total)
  const read = await w.door({ url: "/api/?op=recoverycodesstate" }, dev);
  const t = await open("recovery", { world: w, as: dev, table: { recoverycodesstate: { ...read.json, result: { ...read.json.result, total: 12 } } } });
  has(t, "screen.recovery.held", { remaining: state.remaining, total: 12, date: day(state.issuedAt) });
  // none held; a read that failed
  const held = await teo.read("recoverycodesstate");
  assert.equal(held.held, false);
  const none = await open("recovery", { world: w, as: teo });
  has(none, "screen.recovery.none");
  const failed = await open("recovery", { world: w, as: teo, table: SILENT("recoverycodesstate") });
  assert.ok(all(failed.tree, (e) => e.attrs["data-state"] === "failed").length >= 1);
  lacks(failed, "screen.recovery.none");
});

test("R20 recovery: to an administrator, adminrecoverystep's note while not met; nothing once met, and a step that did not answer is never drawn as not met", async () => {
  const { w, founder } = await team();
  const step = await founder.read("adminrecoverystep");
  assert.deepEqual([step.administrators, step.met], [1, false]);
  const a = await open("recovery", { world: w, as: founder });
  const roster = (await founder.read("memberlist")).members;
  has(a, "screen.members.recovery.one", { name: roster.find((m) => m.founder === true).handle });
  // control: a step the roster cannot name is told no name, never an empty one
  const unnamed = await open("recovery", { world: w, as: founder, table: SILENT("memberlist") });
  assert.ok(!/\{\w+\}|undefined/.test(unnamed.html));
  // met: a second administrator and each holding codes (the step needs two administrators and the viewer's own codes)
  const lu = await w.signIn("lu", { admin: true });
  assert.equal((await founder.read("adminrecoverystep")).administrators, 2);
  await founder.act("recoverycodesissue");
  const now = await founder.read("adminrecoverystep");
  assert.equal(now.met, true);
  const met = await open("recovery", { world: w, as: founder });
  assert.equal(all(met.tree, (e) => e.attrs["data-note"] === "step").length, 0);
  const silent = await open("recovery", { world: w, as: lu, table: REFUSED("adminrecoverystep", "STORE_DID_NOT_ANSWER") });
  assert.equal(all(silent.tree, (e) => e.attrs["data-note"] === "step").length, 0);
});

/* R42 (T50; U3b): recovery says the codes were shown once, to the member alone */
test("R42 recovery draws screen.recovery.onlyyou once, above the act that issues new codes", async () => {
  const { w, founder, dev } = await team();
  for (const as of [dev, founder]) {
    const m = await open("recovery", { world: w, as });
    has(m, "screen.recovery.onlyyou");
    assert.equal(m.text.split(said("screen.recovery.onlyyou")).length, 2, "once");
    assert.ok(m.text.indexOf(said("screen.recovery.onlyyou")) < m.text.indexOf(said("act.recoverycodesissue.label.recovery")), "above the act");
  }
});

test("R17 C91: the doors to the watched addresses and the leads are drawn from Settings to an administrator and to a member who may use them, under 'For every member'; a session that may not write a lead is drawn no door to the leads (control)", async () => {
  const { w: world, founder, dev, teo } = await team();
  for (const as of [founder, dev]) {
    const o = await open("settings", { world, as });
    const w = all(o.tree, (e) => e.tag === "a" && e.attrs["data-screen"] === "watching")[0], l = all(o.tree, (e) => e.tag === "a" && e.attrs["data-screen"] === "leads")[0];
    assert.ok(w && l, as.handle);
    assert.deepEqual([w.attrs.href, textOf(w)], ["/app/watching", said("screen.watching.name")]);
    assert.deepEqual([l.attrs.href, textOf(l)], ["/app/leads", said("screen.leads.name")]);
    const list = ancestor(w, (e) => /\bmk-links\b/.test(e.attrs.class || ""));
    assert.ok(list && ancestor(l, (e) => e === list), "in one list");
    assert.ok(o.text.indexOf(said("screen.settings.everyone")) < o.text.indexOf(said("screen.watching.name")), "under For every member");
  }
  // control: a reader holds no capability to write a lead: watching, which anyone reads, is drawn, the leads not
  const r = await open("settings", { world, as: teo });
  assert.deepEqual(links(r).filter((id) => id === "watching" || id === "leads"), ["watching"]);
});

/* ---- T51 fix round 3: C87 (d) (R17) ---- */

test("R17 C87 (d): Settings holds a door to the team's own rules, under 'For every member', to an administrator and to a member; every screen the list names is named once (control)", async () => {
  const { w, founder, dev } = await team();
  for (const as of [founder, dev]) {
    const o = await open("settings", { world: w, as });
    const door = all(o.tree, (e) => e.tag === "a" && e.attrs["data-screen"] === "grouprules");
    assert.equal(door.length, 1, "one door");
    assert.deepEqual([door[0].attrs.href, textOf(door[0])], ["/app/grouprules", said("screen.grouprules.name")]);
    assert.ok(o.text.indexOf(said("screen.settings.everyone")) < o.text.indexOf(said("screen.grouprules.name")), "under For every member");
    has(o, "screen.grouprules.purpose");
    // a screen already linked from the list gets no second door
    const ids = links(o);
    assert.equal(new Set(ids).size, ids.length, "no screen is linked twice");
  }
});
