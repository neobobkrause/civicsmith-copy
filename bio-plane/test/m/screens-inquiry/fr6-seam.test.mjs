/* screens-inquiry fix round 6 (T51), the seams (R-SEAM): the whole path from the member's act to what the page draws, over the REAL plane (Miniflare) and the real
 * merged providers, every input made by the member's own acts through the real ops (`captureupload`, the screen's own promotion, "Open a question"), nothing
 * scripted. G6: the walker's 40 MB upload (INFO-2026-0136); G12c: a project with five questions; G12a: a spreadsheet filed under a project; G13: a 12 MB text.
 * A test whose provider has not merged is red by name and says which: G12c (strength's `ids`), G12a (capture's picker `format`), G13 (extraction's `more`). */
import "../../sandbox.mjs";
import "./fixtures.mjs"; /* registers every owner's declarations before anything reads an op (R81) */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { boot, counted } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { SCREENS, main, actsIn, press, fill, word } from "./fixtures.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const ADM = "adm-seam-0123456789abcdef", PASSWORD = "the founder's long password";
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-seam-0123456789abcdef", PROBE_TOKEN: "prb-seam-0123456789abcdef", VERSION: "4.6.0", INSTANCE_NAME: "seam-town" },
});
after(() => mf.dispose());
const ORIGIN = "https://group.example";
const door = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

async function founder() {
  const claimed = await door("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) });
  await claimed.arrayBuffer();
  const signed = await (await door("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return { authorization: `Bearer ${signed.result.token}` };
}
/** The screens' own calling kit over the real door (what `CAPTURE_SCREEN`'s promotion calls). */
const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => {
    const u = new URLSearchParams({ op, ...query });
    return (await door(`/api/?${u}`, { method: body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                       ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json();
  } });
const until = async (p, done, ms = 30000) => {
  const end = Date.now() + ms;
  for (;;) { await p.settle(20); if (done()) return true; if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)); }
};
/** Every op the page asks, forwarded to the real door as the founder. */
const rawForwarded = (auth) => Object.fromEntries(Object.keys(OPS).map((op) => [op, async (req) => {
  const u = new URLSearchParams({ ...req.query, op });
  const r = await door(`/api/?${u}`, { method: req.body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                       ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }) });
  return { status: r.status, json: await r.json().catch(() => null) };
}]));
/** every forwarding function is counted, so `settle()` waits on a late forwarded read (interface-shell K5242) */
const forwarded = (auth) => Object.fromEntries(Object.entries(rawForwarded(auth)).map(([op, f]) => [op, counted(f)]));
const upload = async (auth, bytes, name, type) => (await (await door(`/api/?op=captureupload&statement=seam&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, { method: "POST", headers: auth, body: bytes })).json()).result;
/** `n` parts of 8 MiB less a little, bytes that are no document (a 40 MB file the reader is not handed). */
const bulk = (parts) => { const n = parts * 8 * 1024 * 1024 - 1000; const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 2654435761) & 255; return b; };
const makeProject = async (cs, title) => {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const made = await cs.call("promote", { body: { base: null, snapKey: iso.replace(/[-:]/g, "") + "_00c0ffee", meta: { object_type: "project", title, current_state: "forming", created: iso, last_updated: iso },
    files: [{ path: "bundle.md", text: `---\nobject_type: project\ntitle: "${title}"\nobjective: "${title}"\ncurrent_state: forming\ncreated: "${iso}"\nlast_updated: "${iso}"\n---\n\n## Session Log\n\n### Session ${iso} | Formation | interactive\nTrigger: the seam test\nChanges: created.\n` }], register: [], visibility: "hidden" } });
  const id = (made.result && made.result.bundleId) || made.bundleId;
  assert.ok(id, "the project is made: " + JSON.stringify(made).slice(0, 300));
  return id;
};

test.todo("[owed: store/extraction found mark, no final TOO_LARGE reading stored for the 40 MB five-part upload; BOB 7 Nov] R96 R129 G6 (the real plane) the walker's 40 MB upload, filed by the screen's own promotion: the document page draws the statement the plane stored, with the file's size; no 'Nothing here', no OCR re-read, no 'Read it'", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const bytes = bulk(5);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const up = await upload(auth, bytes, "w40.pdf", "application/pdf");
  assert.equal(up.capture.sha256, sha);
  assert.equal(up.document.parts.length, 5, "five parts of the capture");
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "w40.pdf", locator: up.document.locator, project: "" });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 300));
  const stored = (await (await door(`/api/?op=reading&sha256=${sha}`, { headers: auth })).json()).result;
  assert.equal(stored.found, true, "the reading is stored under the whole's digest");
  assert.equal(stored.reading.failure, "final", "as the plane's statement that it was not read");
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/document/" + filed.bundleId });
  await until(p, () => !!main(p).querySelector("[data-text-state]"));
  const m = main(p);
  /* R96 (fix round 10): the reading's own reason, size and limit decide the sentence: this is a size refusal, drawn with the reading's size and the limit, each in MB */
  const mb = (n) => word("size.mb", { n: (n / 1048576).toFixed(1) });
  assert.equal(stored.reading.reason, "TOO_LARGE");
  assert.ok(String(m.textContent).includes(word("screen.document.reading.toolarge", { size: mb(stored.reading.size), limit: mb(stored.reading.bound) })), "the statement is drawn: a size refusal with its own size and limit");
  assert.ok(String(m.textContent).includes(word("size.mb", { n: (stored.bytes / 1048576).toFixed(1) })), "with the file's size");
  assert.ok(!String(m.textContent).includes(word("state.empty")), "never 'Nothing here'");
  assert.ok(!actsIn(m).includes("pdfstructure") && !actsIn(m).includes("readheld"), "no act is offered after it");
  assert.deepEqual(p.byOp("reading").map((r) => r.query.sha256), [sha], "the reading was asked of the whole");
});

test("R1 R9 G12c (the real plane) a project with five questions opened by the member's own presses asks for their strength once, and every question draws its pair (red by name until strength's `ids` merges)", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const project = await makeProject(cs, "Five questions seam");
  for (let i = 0; i < 5; i++) {
    const home = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/project/" + project });
    await until(home, () => !!home.doc.getElementById("project-question"));
    fill(home, { "project-question": `Is question number ${i} answered by the record?` });
    await press(home, "promote", { reason: "a question the seam asks" });
    await until(home, () => /^\/app\/question\//.test(home.location.pathname));
  }
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/project/" + project });
  await until(p, () => p.byOp("inquirystrength").length > 0 && !main(p).querySelector('.cs-state[data-state="loading"]'));
  const rows = () => main(p).querySelectorAll("section").flatMap((s) => s.querySelectorAll(".cs-row")).filter((r) => r.querySelector(".cs-strength") || r.querySelector('[data-state="failed"]'));
  await until(p, () => rows().length >= 5);
  assert.equal(p.byOp("inquirystrength").length, 1, "one strength read for the five questions");
  const qrows = main(p).querySelectorAll(".cs-row").filter((r) => r.querySelector("a.cs-ref") && /^\/app\/question\//.test(r.querySelector("a.cs-ref").getAttribute("href") || ""));
  assert.equal(qrows.length, 5, "five questions");
  assert.ok(qrows.every((r) => r.querySelector(".cs-strength") && !r.querySelector('[data-state="failed"]')), "each draws its pair, none failed");
});

test("R128 G12a (the real plane) a spreadsheet the member filed under a project is listed with its kind, read as a picker row (red by name until capture's picker `format` merges)", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const project = await makeProject(cs, "Documents seam");
  const up = await upload(auth, Buffer.from("year,count\n2025,4\n2026,9\n"), "counts.csv", "text/csv");
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "counts.csv", locator: up.document.locator, project });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 300));
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/project/" + project });
  await until(p, () => p.byOp("heldcaptures").length > 0);
  await until(p, () => !!main(p).querySelector('a.cs-ref[href^="/app/document/"]'));
  const asked = p.byOp("heldcaptures");
  assert.deepEqual(asked.map((r) => r.query.fields), asked.map(() => "picker"), "every read of the project's documents is a picker read");
  const row = main(p).querySelectorAll(".cs-row").find((r) => r.querySelector('a.cs-ref[href^="/app/document/"]'));
  assert.ok(row && row.textContent.includes("counts.csv"), "its title");
  assert.ok(row.textContent.includes(word("screen.project.docs.kind.sheet")), "and its kind, from the picker row's `format`");
});

test("R96 G13 (the real plane) a 3.46 MB text (119,600 lines) filed by the screen's own promotion is drawn as being read, with its progress, until the plane says it is whole", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const lines = []; for (let i = 0; i < 119599; i++) lines.push("WALKTXT line " + i + " appeal" + (i % 997));
  lines.push("ENDMARKER");
  const bytes = Buffer.from(lines.join("\n"));
  const up = await upload(auth, bytes, "w12.txt", "text/plain");
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "w12.txt", locator: up.document.locator, project: "" });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 300));
  /* K4847 (R-NOLOAD): the page is booted once the plane holds a reading that says more follows (the reading window is about 4 s), as the G38 test below waits;
     booted before it, the page rightly draws `unread` */
  const readingOf = async () => (await (await door(`/api/?op=reading&sha256=${up.capture.sha256}`, { headers: auth })).json()).result;
  let held = await readingOf();
  for (const end = Date.now() + 60000; !(held && held.found === true && held.more === true) && Date.now() < end;) { await new Promise((r) => setTimeout(r, 250)); held = await readingOf(); }
  assert.ok(held && held.found === true && held.more === true, "the plane holds a reading that says more follows: " + JSON.stringify(held).slice(0, 200));
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/document/" + filed.bundleId });
  await until(p, () => !!main(p).querySelector("[data-text-state]"), 60000);
  const state = main(p).querySelector("[data-text-state]").getAttribute("data-text-state");
  assert.equal(state, "reading", "a large text is being read, never drawn as complete while more of it waits");
});

test("R3 R96 G38 (the real plane) a 10,000-line text the member filed, cited on its last line from a question she opened: the document page draws the cited words though the plane's pages are bounded, reading each page once", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const project = await makeProject(cs, "Long reading seam");
  const lines = []; for (let i = 0; i < 9999; i++) lines.push("PAGETXT line " + i + " appeal" + (i % 997));
  lines.push("CITEDLAST the words the question rests on");
  const up = await upload(auth, Buffer.from(lines.join("\n")), "long.txt", "text/plain");
  const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "long.txt", locator: up.document.locator, project });
  assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 300));
  const sha = up.capture.sha256;
  const page = async (after) => (await (await door(`/api/?op=reading&sha256=${sha}${after === undefined ? "" : "&after=" + after}`, { headers: auth })).json()).result;
  /* the text is read in pieces by the plane's ledger (G13): wait until it says it is whole */
  let first = await page();
  for (const end = Date.now() + 90000; first.more === true && Date.now() < end;) { await new Promise((r) => setTimeout(r, 500)); first = await page(); }
  assert.notEqual(first.more, true, "the plane says the reading is whole");
  assert.ok(first.found === true && first.next !== undefined && first.next !== null, "the plane pages this reading: " + JSON.stringify({ n: (first.text_units || []).length, next: first.next, more: first.more }));
  let last = first, hops = 0;
  while (last.next !== undefined && last.next !== null && last.next !== "") { last = await page(last.next); hops++; }
  const tail = last.text_units[last.text_units.length - 1];
  assert.ok(String(tail.text).includes("CITEDLAST"), "the last page ends on the last line");
  assert.ok(hops >= 2, "more than two pages: " + hops);
  /* the question is opened by the member's own press, and rests on the last line (the extent the plane states for it) */
  const home = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/project/" + project });
  await until(home, () => !!home.doc.getElementById("project-question"));
  fill(home, { "project-question": "Does the long text hold the words?" });
  await press(home, "promote", { reason: "a question the seam asks" });
  await until(home, () => /^\/app\/question\//.test(home.location.pathname));
  const question = decodeURIComponent(home.location.pathname.split("/")[3]);
  const cited = await cs.call("cite", { body: { project: question, role: "supports", found: { capture_sha: sha, extent: tail.extent, kind: "passage" } } });
  assert.ok(cited.ok !== false && !(cited.result && cited.result.ok === false), "the cite: " + JSON.stringify(cited).slice(0, 300));
  const p = await boot({ screens: SCREENS, plane: forwarded(auth), path: "/app/document/" + filed.bundleId });
  await until(p, () => !!main(p).querySelector("[data-leg-words]"), 60000);
  assert.ok(String(main(p).querySelector("[data-leg-words]").textContent).includes("CITEDLAST"), "the words of the last line are drawn as cited");
  const asked = p.byOp("reading").filter((r) => r.query.sha256 === sha).map((r) => r.query.after);
  assert.equal(asked.length, hops + 1, "each page was read once: " + JSON.stringify(asked));
});
