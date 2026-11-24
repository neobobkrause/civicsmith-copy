/* screens-intake T51 fix round 5, E7 through the door (BOB #250's B28; R-SEAM, K4427 (2)): the capture screen's address press on a held copy that has no
 * reading, over the REAL plane (Miniflare) and the real merged providers, no scripted `heldat`, `reading` or `readheld`. The copy is made by the member's
 * own acts: `acquire` of an address (the outbound fetch is the only stand-in, answering the page's bytes), the screen's own promotion
 * (`CAPTURE_SCREEN.parts.promoteDocument`) with the whole object deleted from `CAPTURES` first, so the copy is stored with no reading (the door's read after
 * `promote` finds no whole; it is owed to the alarm), and the whole put back before the press, as screens-inquiry's `fr5-seam` does. The page is
 * interface-shell's served page over a forwarder that sends every op it asks to the real door as the founder and records it. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { boot } from "../interface-shell/harness.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), registerDeclaredOps);

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const ADM = "adm-e7-0123456789abcdef", PASSWORD = "the founder's long password, E7", ORIGIN = "https://group.example";
const ADDRESS = "https://docs.example.org/pub/estimated-tax.txt";
const LINES = `Estimated Tax for Individuals ${Date.now()}\nPayment vouchers are due in four instalments\nthe third line of the form\n`;
const BYTES = Buffer.from(LINES);
const SHA = createHash("sha256").update(BYTES).digest("hex");
const WORDS = "Payment vouchers are due in four instalments";

const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-e7-0123456789abcdef", PROBE_TOKEN: "prb-e7-0123456789abcdef", VERSION: "4.7.2", INSTANCE_NAME: "e7-town",
              GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
  outboundService: (req) => new URL(req.url).pathname.endsWith("/estimated-tax.txt")
    ? new Response(BYTES, { headers: { "content-type": "text/plain", "content-length": String(BYTES.length) } }) : new Response("not scripted", { status: 404 }),
});
after(() => mf.dispose());
const door = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);

async function founder() {
  const claimed = await door("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) });
  await claimed.arrayBuffer();
  const signed = await (await door("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  return { authorization: `Bearer ${signed.result.token}` };
}
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
/* every op the page asks, forwarded to the real door as the founder, and noted */
const forwarded = (auth, seen) => Object.fromEntries(Object.keys(OPS).map((op) => [op, async (req) => {
  seen.push(op);
  const u = new URLSearchParams({ ...req.query, op });
  const r = await door(`/api/?${u}`, { method: req.body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                       ...(req.body === undefined ? {} : { body: JSON.stringify(req.body) }) });
  return { status: r.status, json: await r.json().catch(() => null) };
}]));
const main = (p) => p.doc.getElementById("cs-main");
const fill = (p, values) => { for (const [id, v] of Object.entries(values)) p.doc.getElementById(id).value = v; };
/* press the act and let every request it makes be answered by the real door */
async function press(p, op) {
  await p.click(main(p).querySelector(`button[data-act="${op}"]`));
  for (let i = 0; i < 12; i++) { await p.settle(20); await new Promise((r) => setTimeout(r, 20)); }
}
const readingOf = async (auth) => (await (await door(`/api/?op=reading&sha256=${SHA}`, { headers: auth })).json()).result;

test("R38 (E7, the real plane) the address press on a held copy stored with no reading sends readheld and op=reading then has the words in text_units; pressed again, nothing more is sent", async () => {
  const auth = await founder();
  const cs = screenCall(auth);
  const first = await (await door("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ locator: ADDRESS }) })).json();
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 400));
  assert.equal(first.document.capture.sha256, SHA);
  /* the member's capture screen promotes the document with the whole gone from the store: stored with no reading (as a record filed before R123, or a reading deferred) */
  const { reading: _r, text_units: _t, ...bare } = first.document;
  const captures = await mf.getR2Bucket("CAPTURES"), key = `bio/captures/${SHA}`;
  assert.ok(await captures.head(key), "the capture is held whole under its digest");
  await captures.delete(key);
  const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: bare, title: "estimated-tax.txt", locator: bare.locator, project: "" });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 400));
  assert.equal((await readingOf(auth)).found, false, "before: the stored copy holds no reading (the walker's INFO-2026-0042)");
  await captures.put(key, BYTES);

  const seen = [];
  const p = await boot({ screens: SCREENS, plane: forwarded(auth, seen), path: "/app/capture/address" });
  await until(p, () => !!p.doc.getElementById("ci-address"));
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  await until(p, () => main(p).querySelectorAll('[data-reading="read"]').length === 1);
  assert.ok(!seen.includes("acquire"), "nothing is fetched or captured again: the address is held");
  assert.equal(seen.filter((o) => o === "readheld").length, 1, "readheld is sent, once");
  const after = await readingOf(auth);
  assert.equal(after.found, true, "the reading is stored");
  assert.ok(JSON.stringify(after.text_units).includes(WORDS), "and the words are in text_units (R-STOP)");
  assert.equal(main(p).querySelectorAll('[data-reading="read"]').length, 1, "the page says the text now held");

  /* control: the copy now has text; pressing again sends nothing more */
  await press(p, "acquire");
  await until(p, () => seen.filter((o) => o === "heldat").length >= 2);
  assert.equal(seen.filter((o) => o === "readheld").length, 1, "a copy with text sends no readheld");
  assert.ok(!seen.includes("acquire"));
});
