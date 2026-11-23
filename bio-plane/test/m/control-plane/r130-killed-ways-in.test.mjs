/* control-plane R130 (fix round 9, G126a-c; K4811 (6), K4835 (2)): EACH WAY IN, KILLED BETWEEN THE PUT AND THE FILING, FINDS ONE JOB ROW. Through the real plane under
   Miniflare (the seam kit, `r8-kit.mjs`), the object's own R2 and `/promote` route made to fail once by a fault entry of this file's own (the plane under it is the real one).
   control-plane #1 proved the clause for `captureupload`; this file proves it for the other four ways in R130 names:
     acquire       the fetched capture's put fails: the first answer promises no reading and no row stands; the member asks again: one `reading` row; again (held): still one
     the pull      `inboxpull`'s put of the knock's bytes under their digest fails (`PULL_NOT_STORED`): no row; the pull again: one row
     promote       the capture screen's promotion of an uploaded document dies before it files: the follow registers nothing twice; promoted again: one row
     archive door  one member's put fails while an archive is unpacked: the member stays owed (`unpack_pending`), the plane's tick files it, and every member ends with one row
   Rows are read by `owedwork` by digest, owed and last run together (a row that has ended stands in `last`, G164). Counts and fields, never a wall time (R-CLOCK). */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeKit } from "./r8-kit.mjs";
import { makeZip } from "../../make-zip.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANE = join(HERE, "../../../src/plane/index.mjs");
const MB = 1024 * 1024;
const body = (a) => (a && a.result !== undefined ? a.result : a);
const textOf = (v) => JSON.stringify(v ?? null).slice(0, 500);

/* The fault entry: the plane as deployed, its `CAPTURES` bucket's `put` of a key naming a listed digest rejected `times` times (a key naming `except` is never failed, so a
   knock's inbox copy is kept and only the pull's put under the digest dies), and its `/promote` route thrown `times` times for a body naming a listed digest. */
const FAULTS = (cfg) => `import plane, { Store as Base } from ${JSON.stringify(PLANE)};
const CFG = ${JSON.stringify(cfg)};
const left = new Map();
const take = (key, times) => { const r = left.has(key) ? left.get(key) : times; if (r <= 0) return false; left.set(key, r - 1); return true; };
const wrappers = new WeakMap();   /* one wrapper for each bucket, so the plane sees the same object at every read */
const guard = (b) => {
  if (!b || typeof b !== "object") return b;
  if (wrappers.has(b)) return wrappers.get(b);
  const w = new Proxy(b, { get(t, k) {
    const v = t[k];
    if (typeof v !== "function") return v;
    return (...a) => {
      if (k === "put" && typeof a[0] === "string") for (const f of CFG.putFail || []) {
        if (a[0].includes(f.sha) && !(f.except && a[0].includes(f.except)) && take("put" + f.sha, f.times ?? 1)) return Promise.reject(new Error("injected put failure"));
      }
      return v.apply(t, a);
    };
  } });
  wrappers.set(b, w);
  return w;
};
export class Store extends Base {
  constructor(ctx, env) { super(ctx, new Proxy(env, { get(t, k) { return k === "CAPTURES" ? guard(t[k]) : t[k]; } })); }
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/promote" && req.method === "POST") {
      const text = await req.clone().text();
      for (const f of CFG.promoteFail || []) if (text.includes('"' + f.sha + '"') && take("promote" + f.sha, f.times ?? 1)) throw new Error("injected promote failure");
    }
    return super.fetch(req);
  }
}
export default plane;
`;

/* one plane for the four ways in; each case's bytes are its own, so each fault touches one case */
const tag = `r130k${Date.now().toString(36)}`;
let k = null;
k = makeKit({ tag, bindings: { DAEMON_TOKEN: `dmn-${tag}-0123456789abcdef`, KNOCK_FINGERPRINT_KEY: `knock-${tag}` },
              serviceBindings: { SELF: (req) => k.mf.dispatchFetch(req) } });
after(() => { try { k.mf.dispose(); } catch { /* gone */ } });
const pdf = (words) => k.pdfOf(`${words} ${tag}`, 3 * MB);   /* a PDF over the inline ceiling: its reading follows by the job table */
const ACQ = pdf("The acquired agenda of the water board");
const KNOCK = pdf("The knocked letter about the hearing");
const UP = pdf("The uploaded minutes of the finance committee");
const entries = Array.from({ length: 4 }, (_, i) => ({ name: `m${i + 1}.txt`, data: k.te(`Member ${i + 1} of the archive ${tag}. Marker R130M${i + 1}${tag}.\n`) }));
const ZIP = makeZip(entries);
const sha = k.sha;
const STRUCK = sha(entries[1].data);
const ready = k.mf.setOptions({ ...k.OPTIONS, script: FAULTS({
  putFail: [{ sha: sha(ACQ), times: 1 }, { sha: sha(KNOCK), times: 1, except: "inbox/" }, { sha: STRUCK, times: 1 }],
  promoteFail: [{ sha: sha(UP), times: 1 }],
}), scriptPath: join(HERE, "r130-fault-entry.worker.mjs") });

/* the `reading` rows a digest has, by its digest: those owed, or, when none is owed, the last run of the one that has ended (a `last` entry is the digest's own and names
   no digest; the plane keeps one for each kind, so an ended row counts once). Read as the administrator, who sees every digest's rows: a capture no document holds yet is
   absent to a member (DEC-36), and the clause is about the rows, not about sight. */
async function readingRows(_auth, digest) {
  const w = body(await k.get(await k.founder(), { op: "owedwork", sha: digest })) || {};
  const owed = (w.owed || []).filter((r) => r.kind === "reading");
  return owed.length ? owed.map((r) => r.sha) : (w.last || []).filter((r) => r.kind === "reading").map(() => digest);
}
let annOnce = null;
const ann = async () => { await ready; return (annOnce ??= (await k.ownerOf("r130-ann")).auth); };

test("R130 (G126; acquire): an acquire whose capture's put dies promises no reading and leaves no row; asked again it registers exactly one `reading` row, and the bytes asked a third time leave one", { timeout: 600000 }, async () => {
  const auth = await ann();
  const digest = sha(ACQ);
  k.serve("agenda.pdf", ACQ);
  const first = await k.acquire(auth, { locator: "https://www.example.gov/files/agenda.pdf" });
  assert.notEqual(first.body.ok === true && first.body.reading_pending, true, "a capture not kept promises no reading: " + textOf(first.body));
  assert.deepEqual(await readingRows(auth, digest), [], "no row for a capture the put did not keep");
  const second = await k.acquire(auth, { locator: "https://www.example.gov/files/agenda.pdf" });
  assert.equal(second.body.ok, true, textOf(second.body));
  assert.equal(second.body.reading_pending, true, "the reading is owed, and the answer says so only while its row is held: " + textOf(second.body));
  assert.deepEqual(await readingRows(auth, digest), [digest], "exactly one row, keyed by the whole digest");
  const third = await k.acquire(auth, { locator: "https://www.example.gov/files/agenda.pdf" });
  assert.equal(third.body.ok, true, textOf(third.body));
  assert.equal((await readingRows(auth, digest)).length, 1, "the same bytes again leave one row");
});

test("R130 (G126; the pull): a pull whose put under the knock's digest dies is answered `PULL_NOT_STORED` with no row; the pull again registers exactly one `reading` row", { timeout: 600000 }, async () => {
  const auth = await ann();
  const digest = sha(KNOCK);
  const knocked = await (await k.plane("/api/?op=knock", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9" },
    body: JSON.stringify({ contentB64: Buffer.from(KNOCK).toString("base64"), note: "please look", contact: "k@example.org", fileName: "letter.pdf", mediaType: "application/pdf" }) })).json();
  const knock = body(knocked);
  assert.equal(knock.ok, true, textOf(knocked));
  assert.equal(knock.sha256, digest);
  const pull = async () => body((await k.post(auth, "inboxpull", { knockId: knock.knockId })).body);
  const first = await pull();
  assert.equal(first.ok, false, "the pull that died is not answered as a pull: " + textOf(first));
  assert.equal(first.reason, "PULL_NOT_STORED", textOf(first));
  assert.deepEqual(await readingRows(auth, digest), [], "no row for bytes the pull did not keep");
  const second = await pull();
  assert.equal(second.ok, true, textOf(second));
  assert.equal(second.reading_pending, true, textOf(second));
  assert.deepEqual(await readingRows(auth, digest), [digest], "exactly one row, keyed by the whole digest");
});

test("R130 (G126; promote's follow): a promotion that dies before it files leaves the upload's one row and no second; promoted again, the follow registers nothing twice: one `reading` row", { timeout: 600000 }, async () => {
  const auth = await ann();
  const digest = sha(UP);
  const res = await k.plane(`/api/?op=captureupload&statement=minutes&name=minutes.pdf&type=${encodeURIComponent("application/pdf")}`, { method: "POST", headers: auth, body: UP });
  const up = body(await res.json());
  assert.equal(up.ok, true, textOf(up));
  const before = await readingRows(auth, digest);
  assert.ok(before.length <= 1, "at most one row before the filing: " + textOf(before));
  const promote = () => CAPTURE_SCREEN.parts.promoteDocument(k.screenCall(auth), { doc: up.document, title: "minutes.pdf", locator: up.document.locator, project: "" });
  const died = await promote();
  assert.ok(died.refused || !died.bundleId, "the promotion that died filed nothing: " + textOf(died));
  assert.equal((await readingRows(auth, digest)).length, before.length, "the promotion that died registered no row");
  const made = await promote();
  assert.equal(made.refused, undefined, textOf(made));
  assert.ok(made.bundleId, textOf(made));
  assert.deepEqual(await readingRows(auth, digest), [digest], "exactly one row after the filing, keyed by the whole digest");
});

test("R130 (G126; the archive door): a member whose put dies while an archive is unpacked stays owed (`unpack_pending`), the plane's tick files it, and each member ends with exactly one `reading` row", { timeout: 900000 }, async () => {
  const auth = await ann();
  const project = await k.projectOf(auth, `R130 archive ${tag}`);
  k.serve("bundle.zip", ZIP, { type: "application/zip" });
  const press = await k.acquire(auth, { locator: "https://www.example.gov/files/bundle.zip", project });
  assert.equal(press.status, 200, textOf(press.body));
  assert.equal(press.body.unpack_pending, true, "the member whose put died is owed to the archive's `unpack` row: " + textOf(press.body));
  const filed = await k.until(async () => {
    const list = body(await k.get(auth, { op: "archivelist", archive: sha(ZIP), limit: "1000" })) || {};
    const files = (list.entries || []).filter((e) => e.kind === "file");
    return files.length === entries.length && files.every((e) => e.state === "filed") ? files : null;
  }, 300000, 3000);
  assert.ok(filed, "every member is filed in the end");
  for (const e of entries) {
    const digest = sha(e.data);
    assert.deepEqual(await readingRows(auth, digest), [digest], `${e.name}${digest === STRUCK ? " (its put died)" : ""}: exactly one row`);
  }
});
