/* acquisition-archives R126 at `streamRegister`, with test-supplied bounds (coordinator ruling, 5 Nov 2026 17:24): the quoted
   READ_BOUNDS figures stay runtime-limits R47's, waiting on measure M-R7. Over the stream bound the piece is refused 413 with its
   size, the bound and the key, nothing stored; under a larger bound it is read; the reduced output is cut at row boundaries into
   numbered segments, the last final; a piece with no matching row stores one capture with the header and the original's fingerprint. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, network } from "../acquisition/fixture.mjs";
import { streamRegister } from "../../../src/acquisition/index.mjs";

const GIB = 1024 ** 3;
const HOST = "data.marlow-county.example";
const URL_ = `https://${HOST}/files/2025.csv`;
const HEADER = "filer,donor_name,donor_org,paid,received,form_no,donor_city,donor_state,donor_zip,donor_street,donor_tel,note";
const row = (i) => [`F${1000 + (i % 7)}`, `Donor ${i}`, i % 3 === 0 ? `Firm ${i}` : "", `${100 + i}.00`, `0${1 + (i % 9)}/15/2025`, `460-${i}`, "Port Ellery", "ME", "04101", "1 Main St", "555-0100", `note ${i}`];
const csv = (n) => `${HEADER}\n${Array.from({ length: n }, (_, i) => row(i).join(",")).join("\n")}\n`;
const enc = (s) => new TextEncoder().encode(s);
const hex = async (b) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join("");

function served(bytes, declared = bytes.length) {
  return (url, init = {}) => {
    const headers = { "content-type": "text/csv", etag: '"v1"', "content-length": String(declared) };
    return new Response((init.method || "GET").toUpperCase() === "HEAD" ? null : bytes, { status: 200, headers });
  };
}
async function setupDef() {
  const { get } = await import("../../../../jurisdictions/index.mjs");
  return structuredClone(get("test-port-ellery").registers.find((r) => r.key === "town_filings"));
}
function setup() {
  const w = world();
  w.core.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:admin");
  return w;
}
async function call(w, routes, args, bounds) {
  const net = network(routes);
  try { return await streamRegister(w.store, { piece: "all", holes: { table: "2025" }, import: "imp-1", viewer: "member:m1", ...args }, { bounds }); } finally { net.restore(); }
}
const puts = (w) => w.b.calls.filter((c) => c[0] === "put").length;

test("R126: a 6 GiB piece is refused over a 5 GiB stream bound with size, bound and key and nothing is stored; under an 8 GiB bound it is read", async () => {
  const definition = await setupDef();
  const body = enc(csv(5));
  const w = setup();
  const over = await call(w, { [URL_]: served(body, 6 * GIB) }, { definition }, { stream_max: 5 * GIB, segment_max: 64 * 1024 * 1024 });
  assert.deepEqual([over.ok, over.reason, over.status, over.size, over.bound, over.key], [false, "TOO_LARGE", 413, 6 * GIB, 5 * GIB, "register.stream_max"]);
  assert.deepEqual([w.prov.receipts.length, puts(w)], [0, 0], "nothing stored");
  const under = await call(setup(), { [URL_]: served(body, 6 * GIB) }, { definition }, { stream_max: 8 * GIB, segment_max: 64 * 1024 * 1024 });
  assert.equal(under.ok, true, "under 8 GiB it is read");
});

test("R126: the reduced output is cut at row boundaries into numbered segments within the segment bound, the last final; a piece with no matching row stores one header capture naming the original", async () => {
  const definition = await setupDef();
  const SEG = 1500;
  const w = setup();
  const out = await call(w, { [URL_]: served(enc(csv(60))) }, { definition }, { stream_max: 5 * GIB, segment_max: SEG });
  assert.equal(out.ok, true);
  assert.ok(out.segments.length >= 3, `several segments (${out.segments.length})`);
  assert.deepEqual(out.segments.map((x) => x.n), out.segments.map((_, i) => i));
  assert.deepEqual(out.segments.map((x) => x.final), out.segments.map((_, i) => i === out.segments.length - 1));
  for (const x of out.segments) {
    const t = new TextDecoder().decode(w.bytesOf(x.sha256));
    assert.ok(enc(t).length <= SEG && t.endsWith("\n"), "within the bound, cut at a row boundary");
  }
  assert.equal(out.documents.length, out.segments.length, "each segment its own capture");
  const original = csv(10);
  const none = await call(setup(), { [URL_]: served(enc(original)) }, { definition, filter: { organizations: ["No Such Firm"] } }, { stream_max: 5 * GIB, segment_max: SEG });
  assert.deepEqual([none.ok, none.segments.length, none.segments[0].rows, none.documents.length], [true, 1, 0, 1]);
  assert.equal(none.documents[0].capture.reduced.original.sha256, await hex(enc(original)));
});
