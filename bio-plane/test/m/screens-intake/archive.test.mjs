/* screens-intake R15: the `archive` screen (DEC-167; N688's screen part) on the real served page: its reads, its rows by
 * state, the hold strip's acts, an archive refused whole, and its files opening open-file. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, main, btn, fill, press, ok, refused, rawKeys, word, hasWord, says, saysIn, dayOf } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { makeZip } from "../../make-zip.mjs";

/* The scene is the real store's: an archive is fetched from an address the world's network answers (an environment double) and opened by the owner's own `acquire` (acquisition
   lists and cuts its entries out); the files a member then keeps are held by her own acts (the recipe `hold`), so the owner states them filed under their documents; a file held
   before the archive came is the owner's `already_held`; an entry locked with a password is its `not_filed`; a name that climbs out of its folder is its `path_unsafe`. */
const CAN = ["contribute", "create_projects"];
const BODY = { agenda: "Agenda of the meeting.\n", staff: "Staff report text.\n", resolution: "Resolution text, adopted.\n", exhibit: "Exhibit A.\n" };
const entriesOf = () => [
  { name: "01_Agenda.pdf", data: BODY.agenda }, { name: "02_Staff report.pdf", data: BODY.staff }, { name: "03_Resolution.pdf", data: BODY.resolution },
  { name: "04_Attachments/", data: "", method: 0 }, { name: "04_Attachments/Exhibit A.pdf", data: BODY.exhibit },
  { name: "07_Closed session minutes.pdf", data: "locked", encrypted: "traditional" }, { name: "../../etc/passwd", data: "root\n" }];
/* `earlier` is the name the member gave the resolution when she held it before the archive came (null: she never held it); `kept` the files she holds after, by name in the archive */
async function scene({ entries = entriesOf(), earlier = "03_Resolution.pdf", kept = ["01_Agenda.pdf", "04_Attachments/Exhibit A.pdf", "02_Staff report.pdf"] } = {}) {
  const t = await members({ mai: CAN });
  const project = await t.world.recipes.project(t.mai, "The garage records");
  if (earlier) await t.world.recipes.hold(t.mai, earlier, BODY.resolution, project);
  const zip = makeZip(entries);
  t.world.script("https://files.example/", () => new Response(zip, { headers: { "content-type": "application/zip" } }));
  const opened = await t.mai.act("acquire", { body: { locator: "https://files.example/packet.zip" } });
  const sha = opened.document.capture.sha256;
  const bodyOf = (name) => entries.find((e) => e.name === name).data;
  const bundles = {};
  for (const name of kept) bundles[name] = (await t.world.recipes.hold(t.mai, name.split("/").pop(), bodyOf(name), project)).bundle;
  const list = async (query = {}) => t.mai.read("archivelist", { query: { archive: sha, ...query } });
  const entry = async (name) => (await list()).entries.find((e) => e.name === name);
  return { ...t, project, sha, zip, bundles, list, entry };
}
const at = (s, plane = {}, as = s.mai) => openWorld(`/app/archive/${s.sha}`, { world: s.world, as, plane });
const pick = async (p, id) => p.click(main(p).querySelector(`#pick-archive-${id}`));
const AGENDA = "01_Agenda.pdf", STAFF = "02_Staff report.pdf", EXHIBIT = "04_Attachments/Exhibit A.pdf", RESOLUTION = "03_Resolution.pdf", MINUTES = "07_Closed session minutes.pdf";

test("R15 reads archivelist and gradenote for the archive; a subject that is no digest reads nothing", async () => {
  const s = await scene();
  const p = await at(s);
  assert.equal(p.byOp("archivelist")[0].query.archive, s.sha);
  assert.equal(p.byOp("gradenote")[0].query.capture, s.sha);
  const n = await openWorld("/app/archive/nope", { world: s.world, as: s.mai });
  assert.equal(n.byOp("archivelist").length, 0);
  assert.ok(says(n, "shell.unavailable.nothing.title"), "R20: nothing is here");
  /* control: a refused list is drawn failed, never as an empty archive: the owner holds no such archive */
  const f = await openWorld(`/app/archive/${"9".repeat(64)}`, { world: s.world, as: s.mai });
  assert.equal(f.byOp("archivelist").length, 1);
  assert.ok(!says(f, "screen.archive.empty"));
});

test("R15 an archive that opened: its grade, summary, and each entry by state, every name as the archive states it", async () => {
  const s = await scene();
  const p = await at(s);
  const t = text(p);
  const sum = (await s.list()).summary;
  assert.deepEqual([sum.filed, sum.already_held, sum.not_filed, sum.folders], [4, 1, 1, 1], "the owner's count of the seven entries");
  assert.ok(t.includes([word("screen.archive.sum.filed", { count: sum.filed }), word("screen.archive.sum.held", { count: sum.already_held }), word("screen.archive.sum.notfiled", { count: sum.not_filed }),
                          word("screen.archive.sum.folders", { count: sum.folders })].join(", ")), "each count as its own phrase (R17)");
  /* filed rows are picked by their document */
  for (const name of [AGENDA, STAFF, EXHIBIT]) assert.ok(main(p).querySelector(`#pick-archive-${s.bundles[name]}`), name);
  assert.ok(t.includes(word("screen.archive.filed")));
  /* already held names the capture it repeats, opening open-file */
  assert.ok(t.includes(word("screen.archive.sum.held", { count: 1 })));
  assert.ok(main(p).querySelector(`a.cs-ref[href="/app/open-file/${(await s.entry(RESOLUTION)).sha256}"]`));
  /* not filed: refused, with its reason */
  assert.ok(main(p).querySelector('[data-gap="refused"]'));
  assert.ok(t.includes(word("refusal.MEMBER_ENCRYPTED")), "the entry's reason, the owner's own words");
  /* a folder with its files */
  assert.ok(t.includes(word("screen.archive.folder", { count: 1 })));
  /* a name is drawn as data, never trusted: escaped text, and a filed entry the viewer may not see is not picked */
  assert.match(t, /\.\.\/\.\.\/etc\/passwd/);
  assert.ok(t.includes(word("screen.archive.filedunseen")));
  assert.equal(main(p).querySelectorAll('input[data-shell="pick"]').length, 3);
  assert.ok(t.includes(word("screen.archive.names")));
  assert.deepEqual(rawKeys(p), []);
  /* last, so the rest is read first: the owner answers the archive's grade as a bare letter (`grade: "B"`, acquisition's archivelist) and the screen reads an object (reported) */
  assert.equal(main(p).querySelectorAll(".cs-grade")[0].textContent.endsWith("B"), true);
});

test("R15 a file of the archive opens open-file for its capture", async () => {
  const s = await scene();
  const p = await at(s);
  for (const name of [AGENDA, EXHIBIT]) {
    const a = main(p).querySelector(`a.cs-ref[href="/app/open-file/${(await s.entry(name)).sha256}"]`);
    assert.equal(a.textContent, name);
  }
});

test("R15 gradenote draws the grade note beside the grade", async () => {
  const s = await scene();
  const note = (await s.mai.read("gradenote", { query: { capture: s.sha } })).note;
  assert.ok(note, "the owner holds a note for a fetched archive");
  const p = await at(s);
  assert.ok(!text(p).includes(note));
  await press(p, "gradenote");
  assert.ok(text(p).includes(note));
  /* control: no note held is said: an archive the member kept by hand (never fetched) has none */
  const u = await scene({ earlier: null, kept: [] });
  const held = (await u.world.recipes.hold(u.mai, "set.zip", makeZip([{ name: "a.pdf", data: "aaa" }]), u.project, { type: "application/zip" })).sha;
  assert.equal((await u.mai.read("gradenote", { query: { capture: held } })).note, null);
  const q = await openWorld(`/app/archive/${held}`, { world: u.world, as: u.mai });
  await press(q, "gradenote");
  assert.ok(says(q, "screen.archive.nonote"));
});

test("R15 the hold strip offers release, heldsetaside (one reason for all picked) and archivelist \"Show only those not filed\"", async () => {
  const s = await scene();
  const p = await at(s);
  assert.equal(btn(p, "release"), null, "no strip before a pick");
  await pick(p, s.bundles[AGENDA]);
  await pick(p, s.bundles[EXHIBIT]);
  const strip = main(p).querySelector(".cs-hold");
  for (const op of ["release", "heldsetaside", "archivelist"]) assert.ok(strip.querySelector(`button[data-act="${op}"]`), op);
  assert.ok(strip.querySelector('button[data-act="archivelist"]').textContent.includes(word("screen.archive.onlynotfiledact")));
  await press(p, "heldsetaside", { reason: "Not about the transfers." });
  assert.deepEqual(p.byOp("heldsetaside")[0].body, { ids: [s.bundles[AGENDA], s.bundles[EXHIBIT]], reason: "Not about the transfers." });
  assert.ok(says(p, "screen.archive.setaside", { count: 2 }));
  await pick(p, s.bundles[STAFF]);
  await press(p, "archivelist");
  assert.equal(p.byOp("archivelist").find((r) => r.query.state).query.state, "not_filed");
  assert.ok(says(p, "screen.archive.onlynotfiled"));
  assert.doesNotMatch(text(p), /01_Agenda\.pdf/);
  assert.match(text(p), /07_Closed session minutes\.pdf/);
});

test("R15 release over the picked files: an enumerated selection, then the release with the member's acknowledgment and mitigation", async () => {
  const s = await scene();
  const p = await at(s);
  await pick(p, s.bundles[AGENDA]);
  fill(p, { "ch-ack": "Each copy is what the archive held.", "ch-mitigation": "Cut out with ordinary tools; same fingerprint." });
  await press(p, "release");
  assert.deepEqual(p.byOp("select")[0].body, { ids: [s.bundles[AGENDA]] });
  assert.ok(String(p.byOp("release")[0].body.handle).length > 0);
  assert.ok(says(p, "screen.held.released", { count: 1 }));
  /* control: nothing sent with the acknowledgment missing */
  const u = await scene();
  const q = await at(u);
  await pick(q, u.bundles[AGENDA]);
  fill(q, { "ch-ack": "", "ch-mitigation": "m" });
  await press(q, "release");
  assert.equal(q.byOp("select").length + q.byOp("release").length, 0);
});

test("R15 an archive refused whole: its refusal by its words, nothing filed, and archivelist to see what it lists", async () => {
  /* two entries that claim the same bytes: the owner refuses the archive whole */
  const s = await scene({ entries: [{ name: "a.pdf", data: "aaaa" }, { name: "b.pdf", sameDataAs: 0 }], earlier: null, kept: [] });
  const held = (await s.world.recipes.hold(s.mai, "amb.zip", makeZip([{ name: "a.pdf", data: "aaaa" }, { name: "b.pdf", sameDataAs: 0 }]), s.project, { type: "application/zip" })).sha;
  const refusedList = await s.mai.read("archivelist", { query: { archive: held } });
  assert.equal(refusedList.archive.opened, false);
  const p = await openWorld(`/app/archive/${held}`, { world: s.world, as: s.mai });
  assert.ok(main(p).querySelector('[data-gap="refused"]'));
  assert.ok(text(p).includes(refusedList.archive.refused.translation));
  assert.ok(says(p, "screen.archive.refused.none"));
  assert.equal(main(p).querySelector('input[data-shell="pick"]'), null, "nothing to pick");
  assert.doesNotMatch(text(p), /a\.pdf/);
  assert.ok(btn(p, "archivelist").textContent.includes(word("screen.archive.see")));
  await press(p, "archivelist");
  assert.equal(p.byOp("archivelist").at(-1).query.state, undefined, "the whole listing, every entry with the refusal");
  assert.match(text(p), /a\.pdf/);
});

test("R15 an already held file names the file and the date of the earlier capture when the entry states it", async () => {
  const s = await scene();
  const held = await s.entry(RESOLUTION);
  assert.ok(held.held_at && held.held_name, "the owner states when and under what name it was held");
  const p = await at(s);
  assert.ok(says(p, "screen.archive.alreadyheld", { name: RESOLUTION, date: dayOf(held.held_at) }));
});

test("R17 R15 a zero count is not drawn: an archive that opened with only filed files draws only that count", async () => {
  const s = await scene({ entries: [{ name: "01_Agenda.pdf", data: BODY.agenda }], earlier: null, kept: [AGENDA] });
  const sum = (await s.list()).summary;
  assert.deepEqual([sum.filed, sum.already_held, sum.not_filed, sum.folders], [1, 0, 0, 0]);
  const p = await at(s);
  assert.ok(text(p).includes(`${word("screen.archive.sum.filed", { count: 1 })}.`));
  assert.ok(!text(p).includes(word("screen.archive.sum.held", { count: 0 })) && !text(p).includes(word("screen.archive.sum.folders", { count: 0 })));
});

test("R26 every key the archive screen reads is a word of the list, and its states draw word(key, vars)", async () => {
  for (const k of SCREENS.find((x) => x.id === "archive").words) assert.ok(hasWord(k), k);
  const s = await scene();
  const p = await at(s);
  for (const [k, v] of [["screen.archive.files"], ["screen.archive.facts", { short: `${s.sha.slice(0, 4)}…${s.sha.slice(-4)}` }], ["screen.archive.gradeabout", { grade: (await s.list()).archive.grade }]]) assert.ok(says(p, k, v), k);
});

/* ---- T50 (T50-30): R30 ---- */
test("R30 an already held entry is drawn whole: the earlier capture's name and when it was captured, with both fills", async () => {
  const s = await scene({ earlier: "Resolution 2026-41 (earlier capture)" });
  const held = await s.entry(RESOLUTION);
  assert.equal(held.held_name, "Resolution 2026-41 (earlier capture)");
  const p = await at(s);
  assert.ok(says(p, "screen.archive.alreadyheld", { name: "Resolution 2026-41 (earlier capture)", date: dayOf(held.held_at) }), "the earlier capture's own name");
  /* the entry's own name when the earlier capture bears it */
  const u = await scene();
  const same = await u.entry(RESOLUTION);
  const q = await at(u);
  assert.ok(says(q, "screen.archive.alreadyheld", { name: RESOLUTION, date: dayOf(same.held_at) }));
});

test("R30 control: an entry stating neither draws no sentence with a blank, only the row's name and its state; one stating only a date draws none either", async () => {
  const s = await scene();
  const real = await s.list();
  /* the owner always states both for a file it held (above); an entry stating neither or only one is the owner's answer with those fields left out, the one derived answer */
  for (const extra of [{}, { held_at: null, held_name: null }, { held_at: "2026-09-30T12:00:00Z", name: "" }]) {
    const p = await at(s, { archivelist: () => ok({ ...real, entries: real.entries.map((e) => {
      if (e.state !== "already_held") return e;
      const { held_at, held_name, ...rest } = e;
      return { ...rest, ...extra };
    }) }) });
    const t = text(p);
    assert.ok(!t.includes(word("screen.archive.alreadyheld", { name: "x", date: "y" }).split("x")[0].trim()), JSON.stringify(extra));
    assert.ok(!/captured on\s*[;.]|the same file\s+captured/.test(t), `no blank fill: ${JSON.stringify(extra)}`);
    assert.ok(t.includes(word("screen.archive.sum.held", { count: 1 })), `its state is said: ${JSON.stringify(extra)}`);
    assert.ok(!t.includes("Captured directly"));
  }
  const p = await at(s, { archivelist: () => ok({ ...real, entries: real.entries.map((e) => (e.state === "already_held" ? (({ held_at, held_name, ...rest }) => rest)(e) : e)) }) });
  assert.ok(text(p).includes("03_Resolution.pdf"), "the row's name");
});
