/* screens-intake R5, R6: the `open-file` screen on the real served page: its reads, its three states and its five acts.
 * Fix round 10 (K5054): over the REAL store. The files are held by the member's real acts (an upload, or `acquire` of an address the world's network
 * answers, then the promotion); file-safety's own answers come of them: the scan note of the scanner service (an environment double, the scanner's
 * `/version`, `/scan` and `/render`, bound as `FILE_SCANNER`; the daemon's `scanbatch` runs the scan), a scan hold of a finding, the two administrators
 * of its release, a deeper check by an outside tool an administrator added, the safe view. Every figure and sentence the assertions need is read from
 * those answers. What the owner cannot be made to say stays scripted, each said where it is. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openWorld, members, html, text, main, btn, fill, press, ok, refused, bytes, rawKeys, word, hasWord, says, saysIn, dayOf } from "./page.mjs";
import { makeZip } from "../../make-zip.mjs";

const sha = (v) => createHash("sha256").update(v).digest("hex");
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

/* The scanner service (file-scanner), bound as `FILE_SCANNER`: `verdict(sha)` is what its ClamAV answers for a file (clean unless a test says otherwise, or "hang"),
   `render(sha)` the bytes of the safe view it makes; the outside tool `scanii` it relays answers clean. */
function scanner() {
  const s = { verdicts: new Map(), calls: [] };
  s.fetch = async (req) => {
    const u = new URL(req.url);
    const body = req.method === "POST" ? await req.json() : null;
    s.calls.push(u.pathname);
    if (u.pathname === "/version") return json({ ok: true, name: "file-scanner", version: "1.0.0", clamav_version: "1.4.2", signatures: { versions: { main: 62 }, published: new Date(Date.now() - 3600000).toISOString() }, providers: {}, reputation_lists: [], bounds: {} });
    if (u.pathname === "/scan") {
      const out = [];
      for (const t of body.targets) {
        const v = s.verdicts.get(t.capture_sha) || { result: "clean", findings: [] };
        if (v === "hang") return new Promise(() => {});
        out.push({ capture_sha: t.capture_sha, tool: "clamav", engine: "ClamAV", engine_version: "1.4.2", signatures: { main: 62, daily: 1, bytecode: 1, published: new Date().toISOString() }, scanned_at: new Date().toISOString(), latency_ms: 1, findings: [], ...v });
      }
      return json({ ok: true, verdicts: out });
    }
    /* a renderer that refuses the file, as the service does (`renderer.mjs`'s classed refusal: `{code, message}`, 422); set by a test, an environment double's setting */
    if (u.pathname === "/render" && s.refuse) return json({ ok: false, code: s.refuse, message: "The renderer refused the file." }, 422);
    if (u.pathname === "/render") { const b = new TextEncoder().encode(`%PDF-1.4 safe view of ${body.target.capture_sha}`); return new Response(b, { status: 200, headers: { "content-type": "application/pdf", "x-derived-sha256": sha(b), "x-pages": "1", "x-source-pages": "1", "x-truncated": "false" } }); }
    if (u.pathname === "/provider/test") return json({ ok: true, passed: true, detail: "ok" });
    if (u.pathname === "/provider/scan") return json({ ok: true, verdicts: [{ capture_sha: body.target.capture_sha, tool: "scanii", engine: "scanii", engine_version: "1", scanned_at: new Date().toISOString(), result: "clean", findings: [], latency_ms: 1 }] });
    return json({ ok: false, code: "NOT_FOUND" }, 404);
  };
  return s;
}
/* a world of the members named, with the scanner bound (`scan: true`) or none installed, and the team's Claude account's seal secret when an outside tool is to be added */
async function team({ scan = true, tool = false, spec = { mai: ["contribute"], rosa: ["contribute"] } } = {}) {
  const S = scan ? scanner() : null;
  const t = await members(spec, { ...(S ? { env: { FILE_SCANNER: S } } : {}), ...(tool ? { ai: true } : {}) });
  t.S = S;
  if (tool) {
    t.ada = await t.world.signIn("ada", { admin: true });
    const offered = (await t.ada.read("securitytoolcatalogue")).offered.find((d) => d.provider_id === "scanii");
    const added = await t.ada.act("securitytooladd", { body: { providerId: "scanii", config: { region: "eu1" }, credentials: { api_key: "k", api_secret: "s" }, handlingDigest: offered.handling_digest } });
    await t.ada.act("securitytooltest", { body: { toolId: added.tool_id } });
  }
  return t;
}
/* the daemon's own acts, with its credential: the scans, the safe views, the deeper checks that are due */
const daemon = (t, op) => t.world.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: t.world.env.DAEMON_TOKEN }).then((r) => r.json.result);
const scan = (t) => daemon(t, "scanbatch");

/* A document held by the member's real acts: its bytes taken from `address` by `acquire` (the world's network answers it), or uploaded (`captureupload`); then
   promoted at `collected` (`allocid`, `promote`), as the recipe `hold` does. Answers `{sha, bundle}`. */
async function hold(t, as, { address = null, bytes: content, type = "text/plain", name = "notice" } = {}) {
  const world = t.world;
  let doc;
  if (address) {
    world.script(address, () => new Response(content, { status: 200, headers: { "content-type": type } }));
    doc = (await as.act("acquire", { body: { locator: address } })).document;
  } else {
    const up = await world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: typeof content === "string" ? new TextEncoder().encode(content) : content } }, as);
    doc = up.json && up.json.result && up.json.result.document;
  }
  if (!doc || !doc.capture) throw new Error(`${name} was not captured`);
  const now = new Date(world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = (await as.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cap = doc.capture.sha256;
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(name), "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + cap,
    "source:", "  locator: " + JSON.stringify(doc.locator || "upload"), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    "---", "", "## Summary", "", name, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: cap }] });
  const len = (v) => new TextEncoder().encode(v).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: sha(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: sha(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: sha(dataset) }, { path: doc.file, blobSha: cap, sha256: cap, bytes: doc.capture.bytes }];
  const made = await as.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sha(id).slice(0, 8),
    meta: { object_type: "information", title: name, current_state: "collected", created: now, last_updated: now }, files, register: [{ sha256: cap, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  return { sha: cap, bundle: made.bundleId || id };
}
/* the files of the states the screen draws */
const NOTICE = "A notice of the Council meeting.\n";
const DOCM = "application/vnd.ms-word.document.macroEnabled.12";
const docm = () => makeZip([{ name: "[Content_Types].xml", data: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>` },
  { name: "word/document.xml", data: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>` }, { name: "word/vbaProject.bin", data: "VBA" }]);
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const xlsx = (cells) => makeZip([{ name: "[Content_Types].xml", data: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>` },
  { name: "xl/workbook.xml", data: `<workbook xmlns="${MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="FY22" sheetId="1" r:id="rId1"/></sheets></workbook>` },
  { name: "xl/_rels/workbook.xml.rels", data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
  { name: "xl/worksheets/sheet1.xml", data: `<worksheet xmlns="${MAIN}"><sheetData>${cells.map(([r, v], i) => `<row r="${i + 1}"><c r="${r}" t="inlineStr"><is><t>${v}</t></is></c></row>`).join("")}</sheetData></worksheet>` }]);
const lowFile = async (t, as = t.mai) => { const h = await hold(t, as, { address: "https://city.example/notice.txt", bytes: NOTICE, name: "notice" }); if (t.S) await scan(t); return h; };
const warnedFile = async (t, as = t.mai) => { const h = await hold(t, as, { address: "https://city.example/form.docm", bytes: docm(), type: DOCM, name: "form" }); if (t.S) await scan(t); return h; };
const upload = (t, as, name, content, type = "text/plain") => hold(t, as, { bytes: content, type, name });
/* a deeper check by the outside tool that ended clean, on an uploaded text file (high for being handed in): the check opens the original by override */
const deeperFile = async (t) => {
  const h = await upload(t, t.mai, "notes", "Council notes\n");
  await t.mai.act("deepercheck", { query: { capture: h.sha } });
  await daemon(t, "deeperbatch");
  return h;
};
const at = (t, h, as = t.mai, plane = {}) => openWorld(`/app/open-file/${h.sha}`, { world: t.world, as, plane });
const threat = (as, h) => as.read("threatof", { query: { capture: h.sha } });
const notes = async (as, h) => (await as.read("verdictnotes", { query: { capture: h.sha } })).notes;

test("R5 reads threatof, originalstate, verdictnotes and scanfindings for the capture; scanstatus only for a session that administers", async () => {
  const t = await team();
  const f = await lowFile(t);
  const p = await at(t, f);
  for (const op of ["threatof", "originalstate", "verdictnotes"]) assert.equal(p.byOp(op)[0].query.capture, f.sha, op);
  assert.equal(p.byOp("scanfindings").length, 1);
  assert.equal(p.byOp("scanstatus").length, 0);
  /* an administrator's session reads the scanners' state: files handed in and not yet scanned wait for the scan */
  const ada = await t.world.signIn("ada", { admin: true });
  for (const n of [1, 2, 3]) await upload(t, t.mai, `waiting${n}`, `A file waiting for its scan, ${n}.\n`);
  const a = await at(t, f, ada);
  assert.equal(a.byOp("scanstatus").length, 1);
  const s = await ada.read("scanstatus");
  assert.ok(s.queued > 0, "the owner counts files waiting for the scan");
  const parts = [["queued", s.queued], ["overdue", s.overdue], ["held", s.held]].filter(([, n]) => n > 0).map(([k, n]) => word(`screen.open-file.status.${k}`, { count: n })).join(", ");
  assert.ok(says(a, "screen.open-file.status.line", { parts }));
  /* control: no capture named, nothing read */
  const n = await openWorld("/app/open-file", { world: t.world, as: t.mai });
  assert.equal(n.byOp("threatof").length, 0);
  assert.ok(says(n, "shell.unavailable.nothing.title"), "R20: nothing is here");
});

test("R5 a low-risk file draws openoriginal with its checks, and offers no warned path and no release", async () => {
  const t = await team();
  const f = await lowFile(t);
  const p = await at(t, f);
  const note = (await notes(t.mai, f))[0];
  assert.ok(main(p).querySelector('[data-risk="low"]'));
  assert.ok(btn(p, "openoriginal"));
  assert.ok(says(p, "screen.open-file.note.line", { tool: word("screen.open-file.tool.clamav"), result: word("screen.open-file.result.clean") }));
  assert.ok(text(p).includes(`${word("screen.open-file.note.at")} ${dayOf(note.scanned_at)}`));
  assert.equal(btn(p, "openwithwarning"), null);
  assert.equal(btn(p, "releasescanhold"), null);
  assert.deepEqual(rawKeys(p), []);
});

/* ---- T51 (CHANGE B15): R53 ---- */
test("R53 each scan result draws the note's line by key: its tool and its result are words, never the note's raw result", async () => {
  for (const result of ["clean", "found", "failed", "not_scanned"]) {
    const t = await team();
    const f = await hold(t, t.mai, { address: "https://city.example/notice.txt", bytes: NOTICE });
    t.S.verdicts.set(f.sha, { result, findings: result === "found" ? ["Eicar-Test-Signature"] : [], ...(result === "not_scanned" || result === "failed" ? { reason: "scanner_busy" } : {}) });
    await scan(t);
    assert.equal((await notes(t.mai, f))[0].result, result, `the owner records the scanner's ${result}`);
    const p = await at(t, f);
    assert.ok(says(p, "screen.open-file.note.line", { tool: word("screen.open-file.tool.clamav"), result: word(`screen.open-file.result.${result}`) }), result);
    assert.ok(!text(p).includes(`${word("screen.open-file.result.clean")}: ${result}`), "no raw result in the line");
    if (result === "not_scanned") assert.doesNotMatch(text(p), /not_scanned/, "never the raw state");
  }
});

test("R53 a scan that ran draws its engine, version and date; a note not scanned draws none of them", async () => {
  const t = await team();
  const f = await lowFile(t);
  const clean = await at(t, f);
  const note = (await notes(t.mai, f))[0];
  assert.ok(text(clean).includes(`${note.engine} ${note.engine_version}`), "the engine and its version");
  assert.ok(text(clean).includes(`${word("screen.open-file.note.at")} ${dayOf(note.scanned_at)}`), "the date");
  const u = await team();
  const g = await hold(u, u.mai, { address: "https://city.example/notice.txt", bytes: NOTICE });
  u.S.verdicts.set(g.sha, { result: "not_scanned", reason: "scanner_busy" });
  await scan(u);
  const none = await at(u, g);
  assert.ok(says(none, "screen.open-file.note.line", { tool: word("screen.open-file.tool.clamav"), result: word("screen.open-file.result.not_scanned") }));
  assert.ok(!text(none).includes("ClamAV"), "no engine");
  assert.ok(!text(none).includes(word("screen.open-file.note.at")), "no date");
  /* control: a tool the words do not hold is not drawn raw: the shell's "could not be read" */
  const v = await team();
  const h = await hold(v, v.mai, { address: "https://city.example/notice.txt", bytes: NOTICE });
  v.S.verdicts.set(h.sha, { result: "clean", tool: "zzz-scanner" });
  await scan(v);
  assert.equal((await notes(v.mai, h))[0].tool, "zzz-scanner", "the owner records the tool the scanner named");
  const unknown = await at(v, h);
  assert.ok(says(unknown, "shell.unread"));
  assert.ok(!text(unknown).includes("zzz-scanner"));
});

test("R5 a high-risk file draws safeview first and deepercheck; openwithwarning only on the warned path, sent only with both confirmations", async () => {
  const t = await team({ tool: true });
  const f = await warnedFile(t);
  const p = await at(t, f);
  const h = html(p);
  assert.ok(main(p).querySelector('[data-risk="high"]'));
  assert.ok(h.indexOf('data-act="safeview"') < h.indexOf('data-act="deepercheck"'));
  assert.ok(h.indexOf('data-act="safeview"') < h.indexOf('data-act="openwithwarning"'));
  const reason = (await threat(t.mai, f)).reasons[0].translation;
  assert.ok(text(p).includes(reason), "the reason is data the owner gave");
  fill(p, { "co-device": true });
  const r = await press(p, "openwithwarning");
  assert.equal(p.byOp("openwithwarning").length, 0, "nothing sent before both are ticked");
  assert.ok(saysIn(r.slot(), "screen.open-file.warn.both"));
  fill(p, { "co-device": true, "co-macros": true });
  await press(p, "openwithwarning");
  const q = p.byOp("openwithwarning")[0];
  assert.equal(q.query.capture, f.sha);
  assert.deepEqual(q.body, { warned: { own_device: true, no_macros: true } });
  assert.equal(p.files.length, 1, "handed to the browser as a file");
  /* control: no path open (not checked this week; the team has no scanner): no warned path, no original; the reason stated */
  const u = await team({ scan: false });
  const g = await warnedFile(u);
  const c = await at(u, g);
  assert.equal(btn(c, "openwithwarning"), null);
  assert.equal(btn(c, "openoriginal"), null);
  assert.ok(says(c, "screen.open-file.closed", { why: "NOT_SCANNED" }));
  /* the deeper path (a fresh clean deeper check) opens the original by override */
  const k = await deeperFile(t);
  assert.equal((await t.mai.read("originalstate", { query: { capture: k.sha } })).path, "deeper");
  const d = await at(t, k);
  await press(d, "openoriginal");
  assert.equal(d.byOp("openoriginal")[0].query.override, "1");
  assert.equal(d.files.length, 1);
});

test("R5 a file held after a finding: no way to open the original, the finding named, releasescanhold with a reason", async () => {
  const t = await team({ spec: {} });
  const ada = await t.world.signIn("ada", { admin: true }), bob = await t.world.signIn("bob", { admin: true });
  const f = await hold(t, ada, { address: "https://city.example/notice.txt", bytes: NOTICE, name: "notice" });
  const other = await hold(t, ada, { address: "https://city.example/other.txt", bytes: "Another file.\n", name: "other" });
  t.S.verdicts.set(f.sha, { result: "found", findings: ["Xls.Downloader.Agent-917"] });
  t.S.verdicts.set(other.sha, { result: "found", findings: ["Other"] });
  await scan(t);
  const p = await at(t, f, ada);
  assert.ok(main(p).querySelector('[data-risk="held"]'));
  assert.equal(btn(p, "openoriginal"), null);
  assert.equal(btn(p, "openwithwarning"), null);
  assert.ok(says(p, "screen.open-file.findings", { names: "Xls.Downloader.Agent-917" }));
  assert.doesNotMatch(text(p), /Other/, "another capture's finding is not this file's");
  await press(p, "releasescanhold", { reason: "The city's own file." });
  const q = p.byOp("releasescanhold")[0];
  assert.equal(q.query.capture, f.sha);
  assert.deepEqual(q.body, { reason: "The city's own file." });
  assert.ok(says(p, "screen.open-file.release.pending"));
  /* the second administrator's release, as the owner counts it */
  const r = await at(t, f, bob);
  await press(r, "releasescanhold", { reason: "Second." });
  assert.deepEqual((await ada.read("originalstate", { query: { capture: f.sha } })).may_open, true, "the owner released it");
  assert.ok(says(r, "screen.open-file.release.done"));
  /* control: offered only while file-safety answers the file held */
  const u = await team();
  const w = await warnedFile(u);
  assert.equal(btn(await at(u, w), "releasescanhold"), null);
});

test("R5 the safe view: marked machine work, a safe copy derived from the original, cite the original; a sheet drawn as data", async () => {
  const t = await team();
  /* a workbook handed in is high risk; its safe view is its sheet's cells */
  const f = await upload(t, t.mai, "Transfers", xlsx([["A1", "Transfer"]]), XLSX);
  const p = await at(t, f);
  assert.ok(main(p).querySelector('[data-origin="machine"]'));
  assert.ok(says(p, "screen.open-file.safe.origin"));
  assert.ok(says(p, "screen.open-file.safe.cite"));
  await press(p, "safeview", { reason: "to read it" });
  assert.equal(p.byOp("safeview")[0].query.capture, f.sha);
  assert.ok(says(p, "screen.open-file.safe.sheet", { name: "FY22" }));
  assert.match(html(p), /<td>A1<\/td><td>Transfer<\/td>/);
  assert.equal(p.files.length, 0, "a sheet is drawn, not downloaded");
  /* a document's safe view is a file made by the scanner's renderer: asked at once it is not made yet (the owner's own refusal, drawn in its words); then it is handed over */
  const w = await warnedFile(t);
  const r = await at(t, w);
  await press(r, "safeview", { reason: "to read it" });
  const pending = (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: w.sha })}` }, t.mai)).json.result;
  assert.equal(pending.reason, "SAFE_VIEW_PENDING");
  assert.ok(hasWord(`refusal.${pending.reason}`) ? says(r, `refusal.${pending.reason}`) : text(r).includes(pending.translation), "the owner's refusal is drawn in words");
  assert.equal(r.files.length, 0);
  await daemon(t, "renderbatch");
  const q = await at(t, w);
  await press(q, "safeview", { reason: "to read it" });
  assert.equal(q.files.length, 1);
  assert.ok(says(q, "screen.open-file.safe.ready"));
});

test("R5 deepercheck asks for the capture and draws its state", async () => {
  const t = await team({ tool: true });
  const f = await upload(t, t.mai, "notes", "Council notes\n");
  const p = await at(t, f);
  await press(p, "deepercheck", { reason: "check it" });
  assert.equal(p.byOp("deepercheck")[0].query.capture, f.sha);
  assert.ok(says(p, "screen.open-file.deeper.state", { state: word("screen.open-file.deeper.queued") }));
});

test("R6 opening the original is a download under the session header, its address naming only the capture; its object address released; no link carries a token", async () => {
  const t = await team({ tool: true });
  const f = await lowFile(t);
  const p = await at(t, f);
  await press(p, "openoriginal");
  const q = p.byOp("openoriginal")[0];
  assert.deepEqual(Object.keys(q.query).sort(), ["capture", "op"]);
  assert.equal(q.headers.Authorization, `Bearer ${t.mai.token}`);
  assert.doesNotMatch(q.url, new RegExp(t.mai.token));
  assert.equal(p.files.length, 1);
  assert.ok(p.objectUrls.every((u) => u.released), "the object address is released");
  assert.ok(says(p, "screen.open-file.opened"));
  /* the five states the screen draws, none of them carrying the token: a low-risk file, a warned one, a deeper one, a held one, and one no path opens */
  const held = await hold(t, t.mai, { address: "https://city.example/held.txt", bytes: "A file with a finding.\n", name: "held" });
  t.S.verdicts.set(held.sha, { result: "found", findings: ["Eicar-Test-Signature"] });
  await scan(t);
  const u = await team({ scan: false });
  const closed = await warnedFile(u);
  for (const [w, file] of [[t, f], [t, await warnedFile(t)], [t, await deeperFile(t)], [t, held], [u, closed]])
    assert.doesNotMatch((await at(w, file)).root().innerHTML, new RegExp(w.mai.token));
  /* a refusal is drawn beside the act with the owner's words, and nothing is saved: the owner's own refusal while the scan has not finished (the scanner does not answer) */
  const v = await team();
  const slow = await hold(v, v.mai, { address: "https://city.example/slow.txt", bytes: "A file the scanner is slow over.\n", name: "slow" });
  v.S.verdicts.set(slow.sha, "hang");
  const r = await at(v, slow);
  await press(r, "openoriginal");
  assert.equal(r.files.length, 0);
  const pending = (await v.world.door({ url: `/api/?${new URLSearchParams({ op: "openoriginal", capture: slow.sha })}` }, v.mai)).json;
  assert.equal(pending.result ? pending.result.code : pending.code, "SCAN_PENDING", "the owner refuses it while the scan is not done");
  /* a code the table holds is drawn by its word, not by the answer's text (DEC-342) */
  assert.ok(hasWord("refusal.SCAN_PENDING"));
  assert.ok(says(r, "refusal.SCAN_PENDING"));
  assert.ok(!text(r).includes((pending.result || pending).detail || "\u0000"), "not the owner's detail");
  /* a code with no word is drawn in the owner's text; the owner holds none such for an opening, so this one refusal is scripted */
  const w = await at(t, f, t.mai, { openoriginal: refused("SCAN_PENDING_NOT_WORDED", "It is being checked.") });
  await press(w, "openoriginal");
  assert.equal(w.files.length, 0);
  assert.match(text(w), /It is being checked\./);
});

test("R39 matching bytes open and the screen says the fingerprint was checked; the sentence that the original was handed over stays its own", async () => {
  const t = await team();
  const f = await lowFile(t);
  const p = await at(t, f);
  assert.ok(!says(p, "screen.open-file.digest.checked"), "nothing is said before an opening");
  await press(p, "openoriginal");
  assert.equal(p.files.length, 1);
  assert.ok(says(p, "screen.open-file.digest.checked"));
  assert.ok(says(p, "screen.open-file.opened"));
  /* the warned path is checked the same way */
  const g = await warnedFile(t);
  const w = await at(t, g);
  fill(w, { "co-device": true, "co-macros": true });
  await press(w, "openwithwarning");
  assert.equal(w.files.length, 1);
  assert.ok(says(w, "screen.open-file.digest.checked"));
});

test("R39 altered bytes hand nothing over: refusal.DIGEST_MISMATCH beside the act, nothing said as checked or opened, and the act is usable again", async () => {
  /* the owner always serves the bytes it holds, so bytes that are not the capture's are the one scripted answer of this test (a fault of the way) */
  const t = await team();
  const f = await lowFile(t);
  const p = await at(t, f, t.mai, { openoriginal: bytes("altered bytes") });
  await press(p, "openoriginal");
  assert.equal(p.files.length, 0, "nothing is saved");
  assert.ok(says(p, "refusal.DIGEST_MISMATCH"));
  assert.ok(!says(p, "refusal.DIGEST_MISMATCH.unheld"));
  assert.ok(!says(p, "screen.open-file.digest.checked") && !says(p, "screen.open-file.opened"));
  assert.ok(!btn(p, "openoriginal").hasAttribute("disabled"), "the act stays usable");
  assert.deepEqual(p.byOp("heldat").map((r) => r.query), [{ op: "heldat", sha256: f.sha }], "the one read made to tell which sentence: by digest, no check, nothing of the member's");
  assert.equal((await t.mai.read("heldat", { query: { sha256: f.sha } })).held, true, "the team holds the file under that fingerprint");
  /* where the team holds no file under that fingerprint, its own sentence (`refusal.DIGEST_MISMATCH.unheld`): the owner answers heldat as not held only for a fingerprint its record has no file under, and the page offers the act only for a file it holds (measured: a file set aside is still held), so no act makes the state and the case is removed (fix round 10, K5245) */
  /* a warned opening of altered bytes is refused the same way */
  const g = await warnedFile(t);
  const w = await at(t, g, t.mai, { openwithwarning: bytes("altered bytes", "application/msword") });
  fill(w, { "co-device": true, "co-macros": true });
  await press(w, "openwithwarning");
  assert.equal(w.files.length, 0);
  assert.ok(says(w, "refusal.DIGEST_MISMATCH"));
});

test("R39 controls: the safe view is not verified against the original's digest; no digest of the member's is kept", async () => {
  const t = await team();
  const f = await warnedFile(t);
  await daemon(t, "renderbatch");
  const p = await at(t, f);
  await press(p, "safeview", { reason: "to read it" });
  assert.equal(p.files.length, 1, "the safe view downloads though its bytes are not the original's");
  assert.ok(!says(p, "refusal.DIGEST_MISMATCH") && !says(p, "screen.open-file.digest.checked"));
  assert.equal(p.byOp("heldat").length, 0);
  assert.deepEqual([...p.store.keys()].filter((k) => k !== "bio-session:frame"), []);
  for (const k of p.local.keys()) assert.match(k, /^(cs-|bio-session(:active)?$)/);
});

test("R26 every key the open-file screen reads is a word of the list, and its three states draw word(key, vars)", async () => {
  const { SCREENS } = await import("../../../src/screens-intake/index.mjs");
  for (const k of SCREENS.find((x) => x.id === "open-file").words) assert.ok(hasWord(k), k);
  const t = await team();
  const held = await hold(t, t.mai, { address: "https://city.example/held.txt", bytes: "A file with a finding.\n", name: "held" });
  t.S.verdicts.set(held.sha, { result: "found", findings: ["Eicar-Test-Signature"] });
  const files = { low: await lowFile(t), high: await warnedFile(t), held };
  await scan(t);
  for (const [state, kind] of [["low", "low"], ["high", "high"], ["held", "held"]]) {
    const p = await at(t, files[state]);
    assert.ok(says(p, `screen.open-file.risk.${kind}`), kind);
    assert.ok(says(p, `screen.open-file.risk.${kind}.means`), kind);
  }
});

/* ---- T50 (T50-30): R36 ---- */
/* a file the viewer added: handed in by her own upload, on a team with no scanner installed (nothing has scanned it); the page is opened as she opens it */
const mine = async (plane = {}, { name = "Notice", content = NOTICE, type = "text/plain", spec } = {}) => {
  const t = await team({ scan: false, ...(spec ? { spec } : {}) });
  const f = await upload(t, t.mai, name, content, type);
  return { t, f, p: await at(t, f, t.mai, plane) };
};

test("R36 a file the viewer added opens as her own: High risk with the yours sentence, the next steps, the safe view primary and a deeper check; checks said in words", async () => {
  /* an administrator's own file, so that the page reads the scanners' state too: it is not drawn for a file she added */
  const t = await team({ scan: false, spec: {} });
  const ada = await t.world.signIn("ada", { admin: true });
  const f = await upload(t, ada, "Notice", NOTICE);
  const p = await at(t, f, ada);
  const s = await ada.read("scanstatus");
  assert.ok(s.queued >= 1, "the owner counts her file as waiting");
  assert.equal(p.byOp("scanstatus").length, 1);
  assert.ok(main(p).querySelector('[data-risk="high"]'));
  assert.ok(says(p, "screen.open-file.risk.high"));
  assert.ok(says(p, "screen.open-file.high.yours"));
  assert.ok(!says(p, "screen.open-file.risk.high.means"), "the generic line is replaced");
  assert.ok(says(p, "screen.open-file.next.head"));
  assert.ok(says(p, "screen.open-file.next.yours"));
  assert.equal(btn(p, "safeview").getAttribute("data-tone"), "primary", "Read the safe view is primary");
  assert.ok(btn(p, "deepercheck"));
  assert.ok(btn(p, "safeview").textContent.includes(word("act.safeview.label.open-file")));
  assert.ok(says(p, "screen.open-file.check.notyet"), "its checks, in words");
  const x = text(p);
  assert.doesNotMatch(x, /not_scanned|NOT_SCANNED|SAFE_VIEW_ONLY/i, "never a scanner's raw state");
  assert.ok(!x.includes(word("screen.open-file.status.queued", { count: s.queued })), "never '1 files waiting'");
  assert.equal(btn(p, "openoriginal"), null, "the original never opens before a check");
  assert.deepEqual(rawKeys(p), []);
  assert.equal(p.byOp("captureaccounts")[0].query.capture, f.sha);
});

test("R36 the safe view of a plain-text file is drawn as text, line by line, nothing in it run or followed; the cut is said when the file was longer", async () => {
  const lines = ["first line of the notice", "<script>alert(1)</script>", "[a link](http://x.example/)"];
  const { t, p } = await mine({}, { content: lines.join("\n") });
  await press(p, "safeview");
  assert.equal(p.byOp("safeview")[0].query.capture, (await t.mai.read("heldcaptures", { query: { limit: 5 } })).held[0].capture.sha256);
  assert.ok(says(p, "screen.open-file.safetext"));
  assert.ok(!says(p, "screen.open-file.safetext.cut"));
  const shown = main(p).querySelectorAll('[data-safetext] p').map((e) => e.textContent);
  assert.deepEqual(shown, lines, "each line as text");
  assert.equal(main(p).querySelector("[data-safetext] script"), null, "nothing is run");
  assert.equal(main(p).querySelector("[data-safetext] a"), null, "nothing is followed");
  assert.equal(p.files.length, 0, "drawn, not downloaded");
  const long = await mine({}, { content: "a line of a long minute\n".repeat(20000) });
  await press(long.p, "safeview");
  assert.ok(says(long.p, "screen.open-file.safetext.cut"));
});

test("R36 a file with no safe view draws refusal.NO_SAFE_VIEW; any other refusal its own words, an answer with none the shell's — never nothing", async () => {
  /* a picture is told at once (F-B15, below); a text file in another encoding passes the page's kind test and meets the owner's refusal at the press */
  const a = await mine({}, { name: "Letter", content: Buffer.from("caf\xe9 notice \xe0 la carte\n", "latin1"), type: "text/plain" });
  await press(a.p, "safeview");
  const none = (await a.t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: a.f.sha })}` }, a.t.mai)).json.result;
  assert.equal(none.reason, "NO_SAFE_VIEW", "the owner makes no safe view of a text file that is not UTF-8");
  assert.ok(says(a.p, "refusal.NO_SAFE_VIEW"));
  /* a document whose safe view the scanner's renderer has not made yet: the owner's own refusal, in its words */
  const t = await team();
  const f = await upload(t, t.mai, "Form", docm(), DOCM);
  const b = await at(t, f);
  await press(b, "safeview");
  const pending = (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: f.sha })}` }, t.mai)).json.result;
  assert.equal(pending.reason, "SAFE_VIEW_PENDING");
  assert.ok(hasWord(`refusal.${pending.reason}`) ? says(b, `refusal.${pending.reason}`) : text(b).includes(pending.translation));
  /* an answer that is a refusal with no words of its own: no owner gives one, so it is scripted */
  const c = await mine({ safeview: refused("SOMETHING", "") });
  await press(c.p, "safeview");
  assert.ok(says(c.p, "shell.unread"));
});

test("R36 controls: a file the team's Civicsmith fetched, or one another member added, is not worded as the viewer's own", async () => {
  const t = await team();
  const fetched = await warnedFile(t);
  assert.deepEqual((await t.mai.read("captureaccounts", { query: { capture: fetched.sha } })).actors.map((a) => a.actor), ["mai"], "the viewer also captured it");
  const p = await at(t, fetched);
  assert.ok(!says(p, "screen.open-file.high.yours"), "a fetched file the viewer also captured has active content, not 'added by you'");
  assert.ok(says(p, "screen.open-file.risk.high.means"));
  /* a file rosa added, read by mai: nothing has scanned it */
  const u = await team({ scan: false });
  const hers = await upload(u, u.rosa, "Notice", NOTICE);
  const other = await at(u, hers);
  assert.deepEqual((await u.mai.read("captureaccounts", { query: { capture: hers.sha } })).actors.map((a) => a.actor), ["rosa"]);
  assert.ok(!says(other, "screen.open-file.high.yours"));
  assert.ok(!says(other, "screen.open-file.next.head"));
  assert.ok(says(other, "screen.open-file.closed", { why: "NOT_SCANNED" }), "the generic line for a file that is not hers");
  /* who added it unknown: the owner's answer that it cannot say is a fault the real act cannot make, scripted */
  const mineAgain = await at(u, await upload(u, u.mai, "Mine", "Another notice of mine.\n"), u.mai, { captureaccounts: refused("STORE_SILENT", "x") });
  assert.ok(!says(mineAgain, "screen.open-file.high.yours"), "who added it unknown: not worded as hers");
});

/* ---- fix round 10, cause 14 (G3; walk C7): an added file's other reasons are said ---- */
/* the design's line "its inside could not be checked" is owed (K4269); until its row is held the reasons' own words say it, so the line is asserted where the row is held */
const INSIDE = "screen.open-file.check.inside";
const insideSaid = (p) => text(p).includes(word(INSIDE));
/* a file the member handed in, scanned clean by the scanner (a clean note stands beside the reasons) */
const handedIn = async (content, type, name) => {
  const t = await team();
  const f = await upload(t, t.mai, name, content, type);
  await scan(t);
  return { t, f, p: await at(t, f), threat: await threat(t.mai, f) };
};
const OLE = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...new Array(600).fill(0)]);
const pdfWith = (objs) => { let out = "%PDF-1.4\n"; const offs = []; objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; }); const x = out.length;
  return out + `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF\n`; };
const encryptedPdf = async () => { const { generate } = await import("../../pdfgen.mjs"); return generate({ kind: "pdf", seed: "enc", size: { pages: 1, lines: 2 }, kinds: ["text"], encryption: { method: "aes", user: "secret" } }).bytes(); };

test("R5 R36 cause 14: a file the viewer added, with a clean scanner note, still says that its inside could not be checked, and the other reason's words", async () => {
  for (const [other, content, type] of [["encrypted", await encryptedPdf(), "application/pdf"], ["active:vba-project", docm(), DOCM], ["format_unchecked", OLE, "application/msword"]]) {
    const { f, t, p, threat: th } = await handedIn(content, type, other.replace(/\W/g, ""));
    const others = th.reasons.filter((r) => r.code !== "source_not_fetched");
    const reason = th.reasons.find((r) => r.code === other);
    assert.ok(reason, `${other}: the owner gives the reason`);
    assert.ok(says(p, "screen.open-file.high.yours"), `${other}: still her own file`);
    assert.ok(text(p).includes(reason.translation), `${other}: the reason is said in the owner's words`);
    assert.ok(says(p, "screen.open-file.why", { reasons: others.map((r) => r.translation).join("; ") }), `${other}: beside the "why" line`);
    if (hasWord(INSIDE)) assert.ok(insideSaid(p), `${other}: the scanner's "Clean" does not stand for the inside`);
    assert.ok(says(p, "screen.open-file.note.line", { tool: word("screen.open-file.tool.clamav"), result: word("screen.open-file.result.clean") }), `${other}: the note stays`);
    assert.equal((await notes(t.mai, f))[0].result, "clean");
  }
});

test("R5 R36 cause 14 control: source_not_fetched alone draws no empty why line and no inside line; a reason that does not hide the inside draws only its words", async () => {
  const { p: alone } = await handedIn(NOTICE, "text/plain", "plain");
  assert.ok(says(alone, "screen.open-file.high.yours"));
  assert.ok(!text(alone).includes(word("screen.open-file.why", { reasons: "" })), "no empty why line");
  assert.ok(!main(alone).querySelector(".mk-small[data-risk], p.mk-small:empty"), "and no empty paragraph");
  assert.ok(!hasWord(INSIDE) || !insideSaid(alone));
  /* a script in a readable file: its inside was checked */
  const { p: script, threat: th } = await handedIn(pdfWith(["<</Type/Catalog/Pages 2 0 R/OpenAction 4 0 R>>", "<</Type/Pages/Kids[3 0 R]/Count 1>>", "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>", "<</S/JavaScript/JS(app.alert\\(1\\))>>"]), "application/pdf", "script");
  assert.ok(th.reasons.some((r) => r.code === "active:javascript"));
  assert.ok(text(script).includes(th.reasons.find((r) => r.code === "active:javascript").translation));
  assert.ok(!hasWord(INSIDE) || !insideSaid(script), "a script in a readable file: its inside was checked");
  /* a file that is not hers keeps the one line for every reason: a fetched, encrypted file */
  const t = await team();
  const hers = await hold(t, t.mai, { address: "https://city.example/locked.pdf", bytes: await encryptedPdf(), type: "application/pdf", name: "locked" });
  await scan(t);
  assert.ok((await threat(t.mai, hers)).reasons.some((r) => r.code === "encrypted"));
  assert.ok(!hasWord(INSIDE) || insideSaid(await at(t, hers)), "a fetched file with an encrypted inside says it too");
});

/* ---- fix round 10, walk-T51-alpha F-B14, F-B15 (R36): the safe view's reason, and a kind with no safe view ---- */
test("R36 F-B14 a safe view the renderer refused draws the renderer's reason beside the sentence that says it is stated beside it — never nothing", async () => {
  const t = await team();
  t.S.refuse = "NOT_RENDERABLE";
  const f = await upload(t, t.mai, "Form", docm(), DOCM);
  await daemon(t, "renderbatch");
  const p = await at(t, f);
  await press(p, "safeview");
  const owner = (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: f.sha })}` }, t.mai)).json.result;
  assert.equal(owner.reason, "SAFE_VIEW_FAILED", "the owner's own refusal: " + JSON.stringify(owner).slice(0, 300));
  assert.equal(owner.renderer_reason, "NOT_RENDERABLE", "naming why");
  /* R71: the owner's reason is a whole sentence of the list (`refusal.NOT_RENDERABLE`), drawn in place of the translation, with no reason beside it */
  assert.equal(main(p).querySelectorAll("[data-renderer-reason]").length, 0, "no second reason beside the sentence");
  assert.ok(hasWord(`refusal.${owner.renderer_reason}`) && says(p, `refusal.${owner.renderer_reason}`));
  assert.ok(!text(p).includes(owner.translation || "\u0000"), "the owner's translation is not drawn beside it");
  assert.ok(!text(p).includes(owner.renderer_detail || "\u0000"), "the renderer's own message is never drawn raw");
  assert.deepEqual(rawKeys(p), []);
});

test("R36 F-B14 control: the reasons the size sentence already states draw no second reason; a reason with a held word draws that word", async () => {
  /* scripted: the owner's TOO_LARGE answer carries the figures it draws from (g44 draws the same answer from the real owner); ENCRYPTED needs a file nothing here can make */
  const a = await mine({ safeview: refused("SAFE_VIEW_FAILED", "refused", 422, { renderer_reason: "TOO_LARGE", size: 50 * 1048576, bound: 20 * 1048576 }) });
  await press(a.p, "safeview");
  assert.ok(says(a.p, "screen.open-file.safe.notdrawn", { size: "50.0", bound: "20.0" }));
  assert.equal(main(a.p).querySelectorAll("[data-renderer-reason]").length, 0);
  const b = await mine({ safeview: refused("SAFE_VIEW_FAILED", "refused", 422, { renderer_reason: "ENCRYPTED" }) });
  await press(b.p, "safeview");
  assert.ok(hasWord("refusal.ENCRYPTED"));
  assert.equal(main(b.p).querySelectorAll('[data-renderer-reason="ENCRYPTED"]').length, 1);
  assert.ok(says(b.p, "refusal.ENCRYPTED"));
  /* the owner's spreadsheet reasons are lower-case words (`renderer_reason: s.why`), drawn like the others */
  const c = await mine({ safeview: refused("SAFE_VIEW_FAILED", "refused", 422, { renderer_reason: "no_sheets" }) });
  await press(c.p, "safeview");
  assert.ok(says(c.p, "refusal.no_sheets"), "R71: the lower-case spreadsheet reason is a whole sentence of the list");
  assert.equal(main(c.p).querySelectorAll("[data-renderer-reason]").length, 0);
});

test("R36 F-B15 a kind the owner makes no safe view of says so once and is not sent to the safe view; every kind it does make one of still is", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const kinds = [["Photo", png, "image/png", false], ["Page", "<html><body>Hello</body></html>", "text/html", false],
                 ["Notice", NOTICE, "text/plain", true], ["Form", docm(), DOCM, true], ["Figures", xlsx([["A1", "x"]]), XLSX, true]];
  for (const [name, content, type, has] of kinds) {
    const { t, f, p } = await mine({}, { name, content, type });
    const owner = (await t.world.door({ url: `/api/?${new URLSearchParams({ op: "safeview", capture: f.sha })}` }, t.mai)).json.result;
    /* the page agrees with the owner: the act is drawn exactly where the owner makes a safe view */
    assert.equal(owner.reason === "NO_SAFE_VIEW", !has, `${name}: the owner answers ${JSON.stringify(owner).slice(0, 160)}`);
    assert.equal(!!btn(p, "safeview"), has, name);
    assert.equal(says(p, "screen.open-file.next.yours"), has, `${name}: "Read it in the safe view below" only where there is one`);
    assert.equal(main(p).querySelectorAll("[data-nosafeview]").length, has ? 0 : 1, `${name}: said once`);
    assert.equal(says(p, "refusal.NO_SAFE_VIEW"), !has, name);
    assert.ok(btn(p, "deepercheck"), `${name}: a deeper check is still offered`);
    assert.deepEqual(rawKeys(p), [], name);
  }
});


/* ---- fix round 10 (R71; DEC-439, DEC-440, DEC-441; U481-U484): the picture's risk lines and the renderer's whole-sentence refusals ---- */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("R71 a picture another member added draws the high line of the safe copy of the picture; a held picture the held line; a text file's lines are unchanged", async () => {
  const u = await team({ scan: false });
  const photo = await upload(u, u.rosa, "Photo", PNG, "image/png");
  const real = await threat(u.mai, photo);
  assert.equal(real.format, "image", "the owner names a picture: " + JSON.stringify(real).slice(0, 200));
  assert.equal(real.threat, "high");
  const high = await at(u, photo);
  assert.ok(says(high, "screen.open-file.risk.high.means.picture"));
  assert.ok(!says(high, "screen.open-file.risk.high.means"), "not the line about a picture of each page");
  /* a scan hold needs a finding of the scanner: the owner's real answer, with the hold the real act would add, scripted (said here) */
  const held = await at(u, photo, u.mai, { threatof: ok({ ...real, scan_hold: true }) });
  assert.ok(main(held).querySelector('[data-risk="held"]'));
  assert.ok(says(held, "screen.open-file.risk.held.means.picture"));
  assert.ok(!says(held, "screen.open-file.risk.held.means"));
  assert.deepEqual(rawKeys(high).concat(rawKeys(held)), []);
  /* control: a text file's risk line is unchanged, high and held */
  const note = await upload(u, u.rosa, "Notice", NOTICE);
  const textReal = await threat(u.mai, note);
  const plain = await at(u, note);
  assert.ok(says(plain, "screen.open-file.risk.high.means") && !says(plain, "screen.open-file.risk.high.means.picture"));
  const plainHeld = await at(u, note, u.mai, { threatof: ok({ ...textReal, scan_hold: true }) });
  assert.ok(says(plainHeld, "screen.open-file.risk.held.means") && !says(plainHeld, "screen.open-file.risk.held.means.picture"));
});

test("R71 the renderer's refusals NOT_RENDERABLE (the real renderer's), NOT_TEXT and no_sheets are drawn by refusal.<reason>, whole, with nothing of the owner's words beside them; control: another reason keeps its sentence and its reason beside it", async () => {
  const t = await team();
  t.S.refuse = "NOT_RENDERABLE";
  const f = await upload(t, t.mai, "Form", docm(), DOCM);
  await daemon(t, "renderbatch");
  const p = await at(t, f);
  await press(p, "safeview");
  assert.ok(says(p, "refusal.NOT_RENDERABLE"));
  assert.equal(main(p).querySelectorAll("[data-renderer-reason]").length, 0);
  /* NOT_TEXT and no_sheets are what the owner answers for a file the real acts cannot make (a text file whose start is not UTF-8 after the gate; a workbook with no sheet): scripted, each said */
  for (const reason of ["NOT_TEXT", "no_sheets"]) {
    const m = await mine({ safeview: refused("SAFE_VIEW_FAILED", "The owner's translation.", 422, { renderer_reason: reason }) });
    await press(m.p, "safeview");
    assert.ok(says(m.p, "refusal." + reason), reason);
    assert.ok(!text(m.p).includes("The owner's translation."), reason);
    assert.equal(main(m.p).querySelectorAll("[data-renderer-reason]").length, 0, reason);
    assert.deepEqual(rawKeys(m.p), [], reason);
  }
  /* control: a reason whose row is not the whole sentence keeps the owner's sentence and the reason beside it */
  const c = await mine({ safeview: refused("SAFE_VIEW_FAILED", "The owner's translation.", 422, { renderer_reason: "ENCRYPTED" }) });
  await press(c.p, "safeview");
  assert.ok(text(c.p).includes("The owner's translation."));
  assert.equal(main(c.p).querySelectorAll('[data-renderer-reason="ENCRYPTED"]').length, 1);
});
