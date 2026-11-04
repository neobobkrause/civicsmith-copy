/* signatures: a development catalogue key line kept apart from Bob's (R59, amending R50, R53, R54, R58; coordinator's
 * ruling for signatures attempt 4, ai-catalogue PR 194; build/requirements/signatures.md), tested at the module's
 * interface. Bob's two lines are copied from K5751 byte for byte. Which lines a build trusts is ai-catalogue's
 * `catalogueKeysFor` (its own export, read here as the deployment reads it); the mark is its `DEVELOPMENT_KEY_MARK`.
 * No private catalogue key is held: a signature naming a key is a blob with a wrong signature, so R3 judges the key
 * before the signature and `UNKNOWN_KEY` against a list means the list does not hold the key, while `BAD_SIGNATURE`
 * means it does. Throwaway keys are made here with WebCrypto. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

import {
  CATALOGUE_KEYS, RELEASE_KEYS, NS_AI_CATALOGUE, NS_AI_ADVISORY, normalizeKey, aiCatalogueStatement,
  aiAdvisoryStatement, aiSealKeyStatement, verifyAiCatalogue, verifyAiAdvisory, verifyAiSealKey, verifySshsig,
} from "../../../src/sshsig.mjs";
import { catalogueKeysFor, isDevelopmentKey, DEVELOPMENT_KEY_MARK, DEVELOPMENT_VAR } from "../../../src/ai-catalogue/index.mjs";

const SIGNING_LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICzjuXnpqLaVYtDu31PbDKjswFWytmmhkU2SsgdkY50J bio-ai-catalogue";
const RECOVERY_LINE =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMcDvL37Gr543+bDycYk53h83ZVfCxmIquuIlV+Ptn9c bio-ai-catalogue-recovery";
const BOB = [SIGNING_LINE, RECOVERY_LINE];

const te = new TextEncoder();
const enc = (s) => te.encode(s);
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const u8 = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? enc(v) : v; return u8(u32(b.length), b); };
const armor = (blob) =>
  `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;
const blob = (wireKey, namespace, sig) => armor(u8(enc("SSHSIG"), u32(1), sstr(wireKey), sstr(namespace),
  sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
const wireOf = (line) => new Uint8Array(Buffer.from(normalizeKey(line), "base64"));
/* A signature that names `line`'s key and is wrong: R3 judges the key first. */
const naming = (line, ns) => blob(wireOf(line), ns, new Uint8Array(64).fill(7));

async function throwaway(comment) {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  const wire = u8(sstr("ssh-ed25519"), sstr(raw));
  return { priv: kp.privateKey, wire, keyB64: b64(wire), line: `ssh-ed25519 ${b64(wire)} ${comment}` };
}
async function sign(key, namespace, message) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", message));
  const signed = u8(enc("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  return blob(key.wire, namespace, new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, signed)));
}

const SEED = Object.freeze({
  seq: 1, schema_version: 1, issued_at: "2026-11-04T00:00:00Z",
  sha256: createHash("sha256").update("seed").digest("hex"), bytes: 1024,
});
const ADVISORY = Object.freeze({
  seq: 2, target: Object.freeze({ entry_id: "entry.alpha:1" }), kind: "withdraw", reason: "unsafe_output",
  effective_at: "2026-11-05T00:00:00Z", issued_at: "2026-11-04T12:00:00Z",
});
const SEAL = Object.freeze({
  key_id: "seal.dev", public_key: b64(new Uint8Array(32).fill(5)),
  not_before: "2026-11-01T00:00:00Z", not_after: "2027-01-01T00:00:00Z", seq: 1,
});

const developmentLines = () => CATALOGUE_KEYS.filter(isDevelopmentKey);

test("R59 CATALOGUE_KEYS holds Bob's two lines first, unchanged, then at least one development line and nothing else", () => {
  assert.deepEqual(CATALOGUE_KEYS.slice(0, 2), BOB);
  const dev = CATALOGUE_KEYS.slice(2);
  assert.ok(dev.length >= 1, "a development line follows Bob's");
  for (const line of dev) {
    assert.ok(line.split(/\s+/).at(-1).endsWith(DEVELOPMENT_KEY_MARK), `${line} is marked development`);
    assert.ok(line.split(/\s+/).at(-1).startsWith("bio-ai-catalogue"), "a catalogue key's label");
    assert.equal(isDevelopmentKey(line), true);
  }
  for (const line of BOB) assert.equal(isDevelopmentKey(line), false);
  assert.deepEqual(developmentLines(), dev);
  assert.ok(Object.isFrozen(CATALOGUE_KEYS));
});

test("R59 each development line is a key R2 reads, different from Bob's lines and from every RELEASE_KEYS line", () => {
  const others = [...BOB, ...RELEASE_KEYS].map(normalizeKey);
  const dev = developmentLines().map(normalizeKey);
  assert.ok(dev.length >= 1);
  for (const n of dev) { assert.ok(n); assert.ok(!others.includes(n)); }
  assert.equal(new Set(CATALOGUE_KEYS.map(normalizeKey)).size, CATALOGUE_KEYS.length);
});

test("R59 a public release (no development variable) trusts exactly Bob's two lines; a development deployment trusts the development line too", () => {
  assert.deepEqual([...catalogueKeysFor(CATALOGUE_KEYS, {})], BOB);
  assert.deepEqual([...catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_VAR]: "1" })], [...CATALOGUE_KEYS]);
  assert.ok(catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_VAR]: "1" }).length > BOB.length);
});

test("R59 a seed naming the development key gets past the key check in a development build and is UNKNOWN_KEY in a public release", async () => {
  const stmt = aiCatalogueStatement(SEED);
  for (const line of developmentLines()) {
    const sig = naming(line, NS_AI_CATALOGUE);
    const dev = catalogueKeysFor(CATALOGUE_KEYS, { [DEVELOPMENT_VAR]: "1" });
    assert.equal((await verifySshsig(sig, stmt, NS_AI_CATALOGUE, dev)).reason, "BAD_SIGNATURE");
    assert.deepEqual(await verifyAiCatalogue(SEED, sig, 0, catalogueKeysFor(CATALOGUE_KEYS, {})),
      { ok: false, reason: "UNKNOWN_KEY", keyB64: normalizeKey(line) });
  }
});

test("R59 the verifiers' default list is Bob's lines alone: a development key is UNKNOWN_KEY for a payload, an advisory and a seal key", async () => {
  for (const line of developmentLines()) {
    const key = normalizeKey(line);
    assert.deepEqual(await verifyAiCatalogue(SEED, naming(line, NS_AI_CATALOGUE), 0),
      { ok: false, reason: "UNKNOWN_KEY", keyB64: key });
    assert.deepEqual(await verifyAiAdvisory(ADVISORY, naming(line, NS_AI_ADVISORY), 0),
      { ok: false, reason: "UNKNOWN_KEY", keyB64: key });
    assert.equal((await verifyAiSealKey(SEAL, naming(line, NS_AI_CATALOGUE))).reason, "UNKNOWN_KEY");
    /* control: passed the whole list, the same signatures get past the key check */
    assert.equal((await verifyAiCatalogue(SEED, naming(line, NS_AI_CATALOGUE), 0, CATALOGUE_KEYS)).reason,
      "BAD_SIGNATURE");
  }
  /* Bob's own keys still pass the default key check */
  for (const line of BOB) {
    assert.equal((await verifyAiCatalogue(SEED, naming(line, NS_AI_CATALOGUE), 0)).reason, "BAD_SIGNATURE");
    assert.equal((await verifyAiAdvisory(ADVISORY, naming(line, NS_AI_ADVISORY), 0)).reason, "BAD_SIGNATURE");
    assert.equal((await verifyAiSealKey(SEAL, naming(line, NS_AI_CATALOGUE))).reason, "BAD_SIGNATURE");
  }
});

test("R59 end to end with a throwaway development key: verifies in a development build, refused in a public release", async () => {
  const key = await throwaway(`bio-ai-catalogue${DEVELOPMENT_KEY_MARK}`);
  const list = [...BOB, key.line];
  const sig = await sign(key, NS_AI_CATALOGUE, aiCatalogueStatement(SEED));
  const dev = await verifyAiCatalogue(SEED, sig, 0, catalogueKeysFor(list, { [DEVELOPMENT_VAR]: "1" }));
  assert.equal(dev.ok, true);
  assert.deepEqual({ ...dev.statement }, { ...SEED });
  assert.deepEqual(await verifyAiCatalogue(SEED, sig, 0, catalogueKeysFor(list, {})),
    { ok: false, reason: "UNKNOWN_KEY", keyB64: key.keyB64 });
  assert.deepEqual(await verifyAiCatalogue(SEED, sig, 0), { ok: false, reason: "UNKNOWN_KEY", keyB64: key.keyB64 });
  const ad = await sign(key, NS_AI_ADVISORY, aiAdvisoryStatement(ADVISORY));
  assert.equal((await verifyAiAdvisory(ADVISORY, ad, 0)).reason, "UNKNOWN_KEY");
  const seal = await sign(key, NS_AI_CATALOGUE, aiSealKeyStatement(SEAL));
  assert.equal((await verifyAiSealKey(SEAL, seal)).reason, "UNKNOWN_KEY");
});
