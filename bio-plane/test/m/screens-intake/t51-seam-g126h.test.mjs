/* screens-intake fix round 9, G126h (K4835, K4922; R61, R-SEAM): a member uploads a 2 MiB spreadsheet by `captureupload` and the screen's own promotion files it. Over the
 * REAL plane (Miniflare, real DO and R2), loaded from its file path as `t51-seam-e7.test.mjs` does. The door gives the first look and the job row reads the rest: the
 * no-cursor door read that cut a sheet at 128 Ki and indexed it `whole` with `truncated: 1`, the last row not found, is gone. WRITTEN FIRST AND RED BY NAME until
 * control-plane R131 (job 38: the door's gate defers a sheet past it) and plane's job table (job 37, plane R97: the `reading` row, `op=owedwork`) merge; the screen's
 * part (the dead arms of `promoteDocument` removed) is tested beside it, at its interface, in `t51-fix7.test.mjs`. */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { registerDeclared } from "../../declared-ops.mjs";
import { registerDeclaredOps } from "../../../src/op-declarations/index.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";

await registerDeclared(fileURLToPath(new URL("../../../../", import.meta.url)), registerDeclaredOps);

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
const ADM = "adm-g126h-0123456789abcdef", PASSWORD = "the founder's long password, G126h", ORIGIN = "https://group.example";
/* a sheet past the gate's inline ceiling for a non-PDF kind (control-plane R131 (1): READ_BOUNDS text/request_bytes), one MiB over it */
const SIZE = boundOf("text", "request_bytes") + 1048576;
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: "mem-g126h-0123456789abcdef", PROBE_TOKEN: "prb-g126h-0123456789abcdef", VERSION: "4.7.2", INSTANCE_NAME: "g126h-town" },
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
/* the screen's calling kit over the real door; every promote request is noted */
const screenCall = (auth, promoted) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
  call: async (op, { query = {}, body } = {}) => {
    if (op === "promote") promoted.push(body);
    const u = new URLSearchParams({ op, ...query });
    return (await door(`/api/?${u}`, { method: body === undefined ? "GET" : "POST", headers: { ...auth, "content-type": "application/json" },
                                       ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json();
  } });
const upload = async (auth, bytes, name, type) => (await (await door(`/api/?op=captureupload&statement=g126h&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  { method: "POST", headers: auth, body: bytes })).json()).result;

/* exactly SIZE bytes of ordinary rows (about 40 B each, none long), the last row `LASTROWMARK`, padded in its own short field to the length */
function csv() {
  const out = ["id,name,amount"];
  let n = out[0].length + 1;
  for (let i = 0; SIZE - n > 300; i++) { const r = `${i},row number ${i},${(i * 37) % 1000}`; out.push(r); n += r.length + 1; }
  const tail = "LASTROWMARK,";
  out.push(tail + "x".repeat(SIZE - n - tail.length));
  const buf = Buffer.from(out.join("\n"));
  return buf;
}


let filing;
const filed = () => filing ||= (async () => {
  const auth = await founder(), promoted = [];
  const cs = screenCall(auth, promoted);
  const bytes = csv();
  const up = await upload(auth, bytes, "big.csv", "text/csv");
  const made = up && up.document ? await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "big.csv", locator: up.document.locator, project: "" }) : null;
  return { auth, promoted, bytes, up, made, sha: createHash("sha256").update(bytes).digest("hex") };
})();

test("R61 (G126h, the real plane) a sheet past the gate's ceiling through the no-cursor door makes no inline read: the first look only, the answer says its reading follows", async () => {
  const { bytes, up, made } = await filed();
  assert.equal(bytes.length, SIZE);
  assert.ok(up && up.document, JSON.stringify(up).slice(0, 300));
  assert.ok(!Array.isArray(up.document.text_units) || up.document.text_units.length === 0, "no inline read: the door gave the first look, no units");
  assert.equal(up.reading_pending, true, "and the reading follows");
  assert.equal(made.refused, undefined, "the screen files it: " + JSON.stringify(made).slice(0, 300));
  assert.ok(made.bundleId, "a bundle");
});

test("R61 (G126h, the real plane; red by name until job 38 and job 37 merge) a `reading` row exists for the sheet in op=owedwork, and after the ticks its last row is found by op=search", async () => {
  const { auth, made, sha } = await filed();
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 300));
  const owed = await (await door(`/api/?op=owedwork&sha=${sha}`, { headers: auth })).json();
  assert.ok(JSON.stringify(owed).includes('"kind":"reading"'), "the job row: " + JSON.stringify(owed).slice(0, 300));
  /* the ticks run on the object's alarm; the wait is bounded by a count of asks */
  let found = false;
  for (let i = 0; i < 120 && !found; i++) {
    const hit = await (await door(`/api/?op=search&q=LASTROWMARK`, { headers: auth })).json();
    found = JSON.stringify(hit).includes("LASTROWMARK");
    if (!found) await new Promise((x) => setTimeout(x, 500));
  }
  assert.ok(found, "the last row is found after the ticks, whole, not a truncated part (K4571)");
});

test("R61 control (the real plane): a small text file the gate admits is still read inline, and filed with its reading", async () => {
  const auth = await founder(), promoted = [];
  const cs = screenCall(auth, promoted);
  const up = await upload(auth, Buffer.from("alpha,beta\n1,2\n3,4\nCONTROLMARK,5\n"), "small.csv", "text/csv");
  assert.ok(up && up.document, JSON.stringify(up).slice(0, 300));
  assert.ok(Array.isArray(up.document.text_units) && up.document.text_units.length > 0, "read inline");
  const made = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: "small.csv", locator: up.document.locator, project: "" });
  assert.equal(made.refused, undefined);
  assert.equal(made.readingDropped, undefined);
});
