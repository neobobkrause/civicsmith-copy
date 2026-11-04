/* signatures: the AI catalogue's signed statements (R49–R56, and R1 as T53 amends it; build/requirements/signatures.md),
 * tested at the module's interface. Every signature is made with a throwaway key written here from PROTOCOL.sshsig with
 * WebCrypto; CATALOGUE_KEYS is only read. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

import * as sshsig from "../../../src/sshsig.mjs";

const {
  NS_AI_CATALOGUE, NS_AI_ADVISORY, NS_AI_RUN, CATALOGUE_KEYS, RELEASE_KEYS, NS_RELEASE, normalizeKey,
  aiCatalogueStatement, aiAdvisoryStatement, aiSealKeyStatement, runBundleStatement,
  verifyAiCatalogue, verifyAiAdvisory, verifyAiSealKey, verifyRunBundle, verifySshsig,
} = sshsig;

const te = new TextEncoder();
const td = new TextDecoder();
const enc = (s) => te.encode(s);
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

/* ------------------------------------------------ an independent SSHSIG signer */

const u8 = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? enc(v) : v; return u8(u32(b.length), b); };
const armor = (blob) =>
  `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;

async function newKey() {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  const wire = u8(sstr("ssh-ed25519"), sstr(raw));
  return { priv: kp.privateKey, raw, keyB64: b64(wire), line: `ssh-ed25519 ${b64(wire)} throwaway` };
}

async function sign(key, namespace, message) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", message));
  const signed = u8(enc("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, signed));
  return armor(u8(enc("SSHSIG"), u32(1), sstr(u8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace),
    sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
}

const KEY = await newKey();
const OTHER = await newKey();
const KEYS = [KEY.line];
const sha = (s) => createHash("sha256").update(s).digest("hex");
const D1 = sha("one"), D2 = sha("two");
const flip = (hex) => (hex[0] === "0" ? "1" : "0") + hex.slice(1);

/* ------------------------------------------------------------ fixtures */

const CATALOGUE = Object.freeze({ seq: 7, schema_version: 2, issued_at: "2026-10-27T12:30:05Z", sha256: D1, bytes: 4096 });
const ADV_ENTRY = Object.freeze({
  seq: 3, target: Object.freeze({ entry_id: "entry.alpha:1" }), kind: "withdraw", reason: "unsafe_output",
  effective_at: "2026-10-28T00:00:00Z", issued_at: "2026-10-27T12:30:05Z",
});
const ADV_PLAN = Object.freeze({ ...ADV_ENTRY, target: Object.freeze({ plan_id: "plan-9" }) });
const SEAL = Object.freeze({
  key_id: "seal.2026-10", public_key: b64(new Uint8Array(32).map((_, i) => (i * 7 + 3) % 256)),
  not_before: "2026-10-01T00:00:00Z", not_after: "2027-01-01T00:00:00Z", seq: 1,
});
const MANIFEST = enc('{"run":"fixture","parts":[1,2]}\n');

const fieldOf = (fn) => { try { fn(); } catch (e) { return String(e.message); } return null; };
const refusal = (field) => `REFUSED [AI_STATEMENT_FIELD]: ${field}`;

/* ===================================================================== R49 */

test("R49 the three AI namespaces are the compiled strings, and with every other namespace pairwise unequal (nine)", () => {
  assert.equal(NS_AI_CATALOGUE, "bio-ai-catalogue");
  assert.equal(NS_AI_ADVISORY, "bio-ai-advisory");
  assert.equal(NS_AI_RUN, "bio-ai-run");
  const all = Object.keys(sshsig).filter((k) => k.startsWith("NS_")).map((k) => sshsig[k]);
  assert.equal(all.length, 9);
  assert.equal(new Set(all).size, 9);
  assert.throws(() => { sshsig.NS_AI_CATALOGUE = NS_RELEASE; });
  assert.equal(sshsig.NS_AI_CATALOGUE, "bio-ai-catalogue");
});

test("R49 a signature made in NS_RELEASE over a catalogue statement's bytes is NAMESPACE; the same bytes in NS_AI_CATALOGUE verify", async () => {
  const stmt = aiCatalogueStatement(CATALOGUE);
  const wrong = await sign(KEY, NS_RELEASE, stmt);
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, wrong, 0, KEYS),
    { ok: false, reason: "NAMESPACE", expected: NS_AI_CATALOGUE, got: NS_RELEASE });
  const right = await sign(KEY, NS_AI_CATALOGUE, stmt);
  assert.equal((await verifyAiCatalogue(CATALOGUE, right, 0, KEYS)).ok, true);
});

/* ===================================================================== R50 */

test("R50 CATALOGUE_KEYS: lines R2 reads as allowed keys, different, none a RELEASE_KEYS line, and the list frozen", () => {
  assert.ok(CATALOGUE_KEYS.length >= 2); /* Bob's two, then development lines (R58, R59) */
  const norm = CATALOGUE_KEYS.map(normalizeKey);
  for (const n of norm) assert.ok(n);
  assert.equal(new Set(norm).size, CATALOGUE_KEYS.length);
  const release = RELEASE_KEYS.map(normalizeKey);
  for (const n of norm) assert.ok(!release.includes(n));
  assert.ok(Object.isFrozen(CATALOGUE_KEYS));
  assert.throws(() => { CATALOGUE_KEYS.push("x"); });
});

test("R50 control: a list holding a RELEASE_KEYS line fails the test's own overlap rule", () => {
  const mixed = [...CATALOGUE_KEYS, RELEASE_KEYS[0]].map(normalizeKey);
  const release = RELEASE_KEYS.map(normalizeKey);
  assert.ok(mixed.some((n) => release.includes(n)));
});

test("R50 a release key's signature over a catalogue statement is UNKNOWN_KEY against the default list", async () => {
  const stmt = aiCatalogueStatement(CATALOGUE);
  const sig = await sign(KEY, NS_AI_CATALOGUE, stmt);
  const r = await verifyAiCatalogue(CATALOGUE, sig, 0);
  assert.deepEqual(r, { ok: false, reason: "UNKNOWN_KEY", keyB64: KEY.keyB64 });
  const viaRelease = await verifyAiCatalogue(CATALOGUE, sig, 0, RELEASE_KEYS);
  assert.equal(viaRelease.reason, "UNKNOWN_KEY");
});

/* ===================================================================== R51 */

test("R51 aiCatalogueStatement is exactly the seven lines in UTF-8, the same bytes every time", () => {
  const a = aiCatalogueStatement(CATALOGUE);
  assert.ok(a instanceof Uint8Array);
  assert.equal(td.decode(a), `bio-ai-catalogue/1\nseq 7\nschema 2\nissued 2026-10-27T12:30:05Z\nsha256 ${D1}\nbytes 4096\n`);
  assert.deepEqual(aiCatalogueStatement({ ...CATALOGUE }), a);
});

test("R51 changing any one field changes the bytes", () => {
  const base = td.decode(aiCatalogueStatement(CATALOGUE));
  for (const [k, v] of [["seq", 8], ["schema_version", 3], ["issued_at", "2026-10-27T12:30:06Z"], ["sha256", D2], ["bytes", 4097]])
    assert.notEqual(td.decode(aiCatalogueStatement({ ...CATALOGUE, [k]: v })), base, k);
});

test("R51 each field it cannot state exactly is refused by name before a byte is built", () => {
  const bad = [
    ["seq", 0], ["seq", 1.5], ["seq", "7"], ["schema_version", 0], ["schema_version", -1], ["bytes", 0], ["bytes", null],
    ["issued_at", "2026-10-27"], ["issued_at", "2026-02-30T00:00:00Z"], ["issued_at", "2026-10-27T24:00:00Z"],
    ["issued_at", "2026-10-27T12:30:05+00:00"], ["sha256", D1.toUpperCase()], ["sha256", D1.slice(1)], ["sha256", 5],
  ];
  for (const [k, v] of bad) assert.equal(fieldOf(() => aiCatalogueStatement({ ...CATALOGUE, [k]: v })), refusal(k), `${k}=${v}`);
  for (const v of [null, undefined, "x", []]) assert.equal(fieldOf(() => aiCatalogueStatement(v)), refusal("statement"));
});

test("R51 its leading token is no other statement's", () => {
  const first = (b) => td.decode(b).split(/[ \n/]/)[0];
  const others = [aiAdvisoryStatement(ADV_ENTRY), aiSealKeyStatement(SEAL), runBundleStatement(MANIFEST, D1),
    sshsig.ratifyStatement("a", "b"), sshsig.caseRatifyStatement("a", 1, "b"), sshsig.captureAccountStatement("a", "b"),
    sshsig.releaseNoticeStatement({ version: "1.0.0", date: "2026-10-14", manifest: D1, security: false, notes: { members: "m", administrators: "a", must_do: "" } })];
  const lead = first(aiCatalogueStatement(CATALOGUE));
  for (const o of others) assert.notEqual(first(o), lead);
});

/* ===================================================================== R52 */

test("R52 aiAdvisoryStatement is exactly the seven lines, for an entry_id target and for a plan_id target", () => {
  assert.equal(td.decode(aiAdvisoryStatement(ADV_ENTRY)),
    "bio-ai-advisory/1\nseq 3\ntarget entry entry.alpha:1\nkind withdraw\nreason unsafe_output\neffective 2026-10-28T00:00:00Z\nissued 2026-10-27T12:30:05Z\n");
  assert.equal(td.decode(aiAdvisoryStatement(ADV_PLAN)),
    "bio-ai-advisory/1\nseq 3\ntarget plan plan-9\nkind withdraw\nreason unsafe_output\neffective 2026-10-28T00:00:00Z\nissued 2026-10-27T12:30:05Z\n");
});

test("R52 changing the reason, or any other field, changes the bytes", () => {
  const base = td.decode(aiAdvisoryStatement(ADV_ENTRY));
  for (const [k, v] of [["seq", 4], ["kind", "pause"], ["reason", "other_reason"], ["effective_at", "2026-10-29T00:00:00Z"],
    ["issued_at", "2026-10-27T12:30:06Z"], ["target", { entry_id: "entry.beta" }], ["target", { plan_id: "entry.alpha:1" }]])
    assert.notEqual(td.decode(aiAdvisoryStatement({ ...ADV_ENTRY, [k]: v })), base, k);
});

test("R52 a target holding both ids, neither, or an extra key is refused; so is every malformed field, by name", () => {
  const t = (target) => fieldOf(() => aiAdvisoryStatement({ ...ADV_ENTRY, target }));
  assert.equal(t({ entry_id: "a", plan_id: "b" }), refusal("target"));
  assert.equal(t({}), refusal("target"));
  assert.equal(t({ entry_id: "a", other: "b" }), refusal("target"));
  assert.equal(t({ other: "a" }), refusal("target"));
  assert.equal(t("a"), refusal("target"));
  assert.equal(t({ entry_id: "Upper" }), refusal("target.entry_id"));
  assert.equal(t({ plan_id: "has space" }), refusal("target.plan_id"));
  assert.equal(t({ entry_id: "" }), refusal("target.entry_id"));
  for (const [k, v] of [["seq", 0], ["kind", "With-Dash"], ["kind", ""], ["reason", "Upper"], ["reason", "a b"],
    ["effective_at", "2026-10-28"], ["issued_at", "2026-13-01T00:00:00Z"]])
    assert.equal(fieldOf(() => aiAdvisoryStatement({ ...ADV_ENTRY, [k]: v })), refusal(k), `${k}=${v}`);
  assert.equal(fieldOf(() => aiAdvisoryStatement(null)), refusal("advisory"));
});

/* ===================================================================== R53 */

test("R53 a payload and an advisory, each signed by a throwaway key in allowedKeys and newer than heldSeq, are accepted with a frozen copy", async () => {
  const p = await verifyAiCatalogue(CATALOGUE, await sign(KEY, NS_AI_CATALOGUE, aiCatalogueStatement(CATALOGUE)), 6, KEYS);
  assert.equal(p.ok, true);
  assert.deepEqual(p.statement, CATALOGUE);
  assert.ok(Object.isFrozen(p.statement));
  assert.notEqual(p.statement, CATALOGUE);
  for (const adv of [ADV_ENTRY, ADV_PLAN]) {
    const a = await verifyAiAdvisory(adv, await sign(KEY, NS_AI_ADVISORY, aiAdvisoryStatement(adv)), 0, KEYS);
    assert.equal(a.ok, true);
    assert.deepEqual(a.statement, adv);
    assert.ok(Object.isFrozen(a.statement) && Object.isFrozen(a.statement.target));
  }
});

test("R53 control: one changed digit of sha256 is BAD_SIGNATURE", async () => {
  const sig = await sign(KEY, NS_AI_CATALOGUE, aiCatalogueStatement(CATALOGUE));
  assert.deepEqual(await verifyAiCatalogue({ ...CATALOGUE, sha256: flip(D1) }, sig, 0, KEYS),
    { ok: false, reason: "BAD_SIGNATURE", keyB64: KEY.keyB64 });
  const asig = await sign(KEY, NS_AI_ADVISORY, aiAdvisoryStatement(ADV_ENTRY));
  assert.equal((await verifyAiAdvisory({ ...ADV_ENTRY, reason: "other_reason" }, asig, 0, KEYS)).reason, "BAD_SIGNATURE");
});

test("R53 control: the same bytes signed in NS_RELEASE, or in the other of the two new namespaces, are NAMESPACE", async () => {
  const cs = aiCatalogueStatement(CATALOGUE), as = aiAdvisoryStatement(ADV_ENTRY);
  for (const ns of [NS_RELEASE, NS_AI_ADVISORY, NS_AI_RUN])
    assert.deepEqual(await verifyAiCatalogue(CATALOGUE, await sign(KEY, ns, cs), 0, KEYS),
      { ok: false, reason: "NAMESPACE", expected: NS_AI_CATALOGUE, got: ns });
  for (const ns of [NS_RELEASE, NS_AI_CATALOGUE, NS_AI_RUN])
    assert.deepEqual(await verifyAiAdvisory(ADV_ENTRY, await sign(KEY, ns, as), 0, KEYS),
      { ok: false, reason: "NAMESPACE", expected: NS_AI_ADVISORY, got: ns });
});

test("R53 control: a key outside allowedKeys is UNKNOWN_KEY; seq equal to heldSeq (or below) is NOT_NEWER, judged after the signature", async () => {
  const cs = aiCatalogueStatement(CATALOGUE);
  const sig = await sign(OTHER, NS_AI_CATALOGUE, cs);
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, sig, 0, KEYS), { ok: false, reason: "UNKNOWN_KEY", keyB64: OTHER.keyB64 });
  const good = await sign(KEY, NS_AI_CATALOGUE, cs);
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, good, 7, KEYS), { ok: false, reason: "NOT_NEWER", seq: 7, heldSeq: 7 });
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, good, 9, KEYS), { ok: false, reason: "NOT_NEWER", seq: 7, heldSeq: 9 });
  assert.equal((await verifyAiCatalogue(CATALOGUE, good, undefined, KEYS)).ok, true);
  const asig = await sign(KEY, NS_AI_ADVISORY, aiAdvisoryStatement(ADV_ENTRY));
  assert.equal((await verifyAiAdvisory(ADV_ENTRY, asig, 3, KEYS)).reason, "NOT_NEWER");
  const forged = await sign(OTHER, NS_AI_CATALOGUE, cs);
  assert.equal((await verifyAiCatalogue({ ...CATALOGUE, sha256: flip(D1) }, forged, 99, KEYS)).reason, "UNKNOWN_KEY");
});

test("R53 MALFORMED names the field: a statement R51 or R52 refuses, a heldSeq that is not a whole number from 0, a signature that is not one", async () => {
  const good = await sign(KEY, NS_AI_CATALOGUE, aiCatalogueStatement(CATALOGUE));
  assert.deepEqual(await verifyAiCatalogue({ ...CATALOGUE, seq: 0 }, good, 0, KEYS), { ok: false, reason: "MALFORMED", field: "seq" });
  assert.deepEqual(await verifyAiAdvisory({ ...ADV_ENTRY, target: {} }, good, 0, KEYS), { ok: false, reason: "MALFORMED", field: "target" });
  for (const h of [-1, 1.5, "3", null]) assert.deepEqual(await verifyAiCatalogue(CATALOGUE, good, h, KEYS), { ok: false, reason: "MALFORMED", field: "heldSeq" });
  const r = await verifyAiCatalogue(CATALOGUE, "not armor", 0, KEYS);
  assert.equal(r.reason, "MALFORMED");
  assert.equal(r.field, "signature");
});

test("R53 never throws, whatever it is given; every no names its kind", async () => {
  const junk = [undefined, null, 0, "x", [], {}, () => {}, { get seq() { throw new Error("getter"); } }];
  for (const a of junk) for (const b of junk) {
    for (const r of [await verifyAiCatalogue(a, b, a, b), await verifyAiAdvisory(a, b, b, a), await verifyAiSealKey(a, b, b)]) {
      assert.equal(r.ok, false);
      assert.equal(typeof r.reason, "string");
    }
  }
});

/* ===================================================================== R54 */

test("R54 aiSealKeyStatement is exactly the seven lines; a seal-key document signed by a throwaway key in the list is accepted with a frozen copy", async () => {
  const stmt = aiSealKeyStatement(SEAL);
  assert.equal(td.decode(stmt),
    `bio-ai-seal-key/1\nkey_id seal.2026-10\npublic ${SEAL.public_key}\nnot_before 2026-10-01T00:00:00Z\nnot_after 2027-01-01T00:00:00Z\nseq 1\n`);
  const r = await verifyAiSealKey(SEAL, await sign(KEY, NS_AI_CATALOGUE, stmt), KEYS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.doc, SEAL);
  assert.ok(Object.isFrozen(r.doc));
});

test("R54 control: a changed public_key is BAD_SIGNATURE, a payload's signature over the same fields is BAD_SIGNATURE, a key outside the list is UNKNOWN_KEY", async () => {
  const sig = await sign(KEY, NS_AI_CATALOGUE, aiSealKeyStatement(SEAL));
  const swapped = { ...SEAL, public_key: b64(new Uint8Array(32).fill(9)) };
  assert.deepEqual(await verifyAiSealKey(swapped, sig, KEYS), { ok: false, reason: "BAD_SIGNATURE", keyB64: KEY.keyB64 });
  const payloadSig = await sign(KEY, NS_AI_CATALOGUE, aiCatalogueStatement(CATALOGUE));
  assert.equal((await verifyAiSealKey(SEAL, payloadSig, KEYS)).reason, "BAD_SIGNATURE");
  assert.equal((await verifyAiSealKey(SEAL, await sign(OTHER, NS_AI_CATALOGUE, aiSealKeyStatement(SEAL)), KEYS)).reason, "UNKNOWN_KEY");
  assert.equal((await verifyAiSealKey(SEAL, await sign(KEY, NS_RELEASE, aiSealKeyStatement(SEAL)), KEYS)).reason, "NAMESPACE");
  assert.equal((await verifyAiSealKey(SEAL, sig)).reason, "UNKNOWN_KEY");
});

test("R54 a field it cannot state exactly is refused by name, and is MALFORMED through the verifier; it has no NOT_NEWER", async () => {
  const bad = [["key_id", "Upper"], ["key_id", ""], ["public_key", "AAAA"], ["public_key", b64(new Uint8Array(31))],
    ["public_key", SEAL.public_key.slice(0, 42) + "B="], ["not_before", "2026-10-01"], ["not_after", "nope"], ["seq", 0], ["seq", "1"]];
  const sig = await sign(KEY, NS_AI_CATALOGUE, aiSealKeyStatement(SEAL));
  for (const [k, v] of bad) {
    assert.equal(fieldOf(() => aiSealKeyStatement({ ...SEAL, [k]: v })), refusal(k), `${k}=${v}`);
    assert.deepEqual(await verifyAiSealKey({ ...SEAL, [k]: v }, sig, KEYS), { ok: false, reason: "MALFORMED", field: k });
  }
  assert.equal(fieldOf(() => aiSealKeyStatement(null)), refusal("doc"));
  assert.equal((await verifyAiSealKey(SEAL, sig, KEYS)).ok, true);
});

test("R54 its leading token differs from the payload's and the advisory's, so they are never the same signed bytes", () => {
  const lead = (b) => td.decode(b).split("\n")[0];
  assert.notEqual(lead(aiSealKeyStatement(SEAL)), lead(aiCatalogueStatement(CATALOGUE)));
  assert.notEqual(lead(aiSealKeyStatement(SEAL)), lead(aiAdvisoryStatement(ADV_ENTRY)));
});

/* ===================================================================== R55 */

test("R55 runBundleStatement is exactly the three lines over the manifest's SHA-256 and the payload digest, byte for byte the same every time", () => {
  const a = runBundleStatement(MANIFEST, D1);
  assert.ok(a instanceof Uint8Array);
  const lines = ["bio-ai-run/1", ["manifest", createHash("sha256").update(MANIFEST).digest("hex")].join(" "), ["payload", D1].join(" ")];
  assert.equal(td.decode(a), lines.join("\n") + "\n");
  assert.deepEqual(runBundleStatement(new Uint8Array(MANIFEST), D1), a);
});

test("R55 its digest agrees with SHA-256 for lengths around every padding boundary", () => {
  for (const n of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
    const m = new Uint8Array(n).map((_, i) => (i * 31 + n) % 256);
    const want = createHash("sha256").update(m).digest("hex");
    assert.equal(td.decode(runBundleStatement(m, D1)).split("\n")[1], `manifest ${want}`, `n=${n}`);
  }
});

test("R55 control: the manifest with one byte changed, or another payload, gives different bytes; an uppercase digest and a non-Uint8Array are refused by name", () => {
  const base = td.decode(runBundleStatement(MANIFEST, D1));
  const changed = new Uint8Array(MANIFEST); changed[3] ^= 1;
  assert.notEqual(td.decode(runBundleStatement(changed, D1)), base);
  assert.notEqual(td.decode(runBundleStatement(MANIFEST, D2)), base);
  assert.equal(fieldOf(() => runBundleStatement(MANIFEST, D1.toUpperCase())), refusal("payloadSha256"));
  assert.equal(fieldOf(() => runBundleStatement(MANIFEST, 5)), refusal("payloadSha256"));
  for (const m of ["text", [1, 2], null, undefined, MANIFEST.buffer])
    assert.equal(fieldOf(() => runBundleStatement(m, D1)), refusal("manifestBytes"));
});

/* ===================================================================== R56 */

test("R56 a bundle signed with a throwaway run key verifies against that key, given as a line or as bare base64", async () => {
  const sig = await sign(KEY, NS_AI_RUN, runBundleStatement(MANIFEST, D1));
  for (const runPublicKey of [KEY.line, KEY.keyB64]) {
    const r = await verifyRunBundle({ manifestBytes: MANIFEST, payloadSha256: D1, armored: sig, runPublicKey });
    assert.deepEqual(r, { ok: true, keyB64: KEY.keyB64, namespace: NS_AI_RUN });
  }
});

test("R56 controls: one changed manifest character is BAD_SIGNATURE, a second key signing is UNKNOWN_KEY, the same bytes in NS_AI_CATALOGUE are NAMESPACE", async () => {
  const stmt = runBundleStatement(MANIFEST, D1);
  const sig = await sign(KEY, NS_AI_RUN, stmt);
  const changed = new Uint8Array(MANIFEST); changed[0] ^= 1;
  const base = { manifestBytes: MANIFEST, payloadSha256: D1, armored: sig, runPublicKey: KEY.line };
  assert.deepEqual(await verifyRunBundle({ ...base, manifestBytes: changed }), { ok: false, reason: "BAD_SIGNATURE", keyB64: KEY.keyB64 });
  assert.equal((await verifyRunBundle({ ...base, payloadSha256: D2 })).reason, "BAD_SIGNATURE");
  assert.deepEqual(await verifyRunBundle({ ...base, armored: await sign(OTHER, NS_AI_RUN, stmt) }),
    { ok: false, reason: "UNKNOWN_KEY", keyB64: OTHER.keyB64 });
  assert.deepEqual(await verifyRunBundle({ ...base, armored: await sign(KEY, NS_AI_CATALOGUE, stmt) }),
    { ok: false, reason: "NAMESPACE", expected: NS_AI_RUN, got: NS_AI_CATALOGUE });
});

test("R56 a malformed runPublicKey, manifest, payload digest or signature is MALFORMED naming the field; it never throws", async () => {
  const sig = await sign(KEY, NS_AI_RUN, runBundleStatement(MANIFEST, D1));
  const base = { manifestBytes: MANIFEST, payloadSha256: D1, armored: sig, runPublicKey: KEY.line };
  for (const k of ["runPublicKey", "manifestBytes", "payloadSha256"])
    for (const v of ["not a key", 5, null, undefined, ""]) {
      if (k === "runPublicKey" && v === "not a key") continue;
      const r = await verifyRunBundle({ ...base, [k]: v });
      assert.deepEqual(r, { ok: false, reason: "MALFORMED", field: k }, `${k}=${String(v)}`);
    }
  assert.deepEqual(await verifyRunBundle({ ...base, runPublicKey: "not a key" }), { ok: false, reason: "MALFORMED", field: "runPublicKey" });
  const r = await verifyRunBundle({ ...base, armored: "x" });
  assert.deepEqual([r.reason, r.field], ["MALFORMED", "signature"]);
  for (const v of [undefined, null, 0, "x", [], () => {}, { get armored() { throw new Error("getter"); } }]) {
    const out = await verifyRunBundle(v);
    assert.equal(out.ok, false);
    assert.equal(typeof out.reason, "string");
  }
});

test("R56 with R53's verifier: the run key verifies nothing in the catalogue's namespaces and the catalogue's keys nothing as a run bundle (R28)", async () => {
  const r = await verifySshsig(await sign(KEY, NS_AI_RUN, runBundleStatement(MANIFEST, D1)), runBundleStatement(MANIFEST, D1), NS_AI_CATALOGUE, KEYS);
  assert.equal(r.reason, "NAMESPACE");
});
