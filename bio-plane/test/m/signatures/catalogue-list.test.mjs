/* signatures: `CATALOGUE_KEYS` holds exactly Bob's two catalogue keys (R58, amending R50; K5751, the catalogue key
 * ceremony's sitting 1; build/requirements/signatures.md), tested at the module's interface. The two expected lines
 * are copied from K5751 byte for byte. Every signature is made with a throwaway key written here from PROTOCOL.sshsig
 * with WebCrypto and passed as `allowedKeys`; no test adds a key to the list. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

import {
  CATALOGUE_KEYS, RELEASE_KEYS, NS_AI_CATALOGUE, normalizeKey, aiCatalogueStatement, verifyAiCatalogue, verifySshsig,
} from "../../../src/sshsig.mjs";

const SIGNING_LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICzjuXnpqLaVYtDu31PbDKjswFWytmmhkU2SsgdkY50J bio-ai-catalogue";
const RECOVERY_LINE =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMcDvL37Gr543+bDycYk53h83ZVfCxmIquuIlV+Ptn9c bio-ai-catalogue-recovery";
/* The fingerprints K5751 records beside the lines (ssh-keygen -l's form: unpadded base64 of SHA-256 of the wire key). */
const FINGERPRINTS = ["RpBqiKYcBfY0ZXvLJVJIazLH8TCAgUMTSwbLF6x0qLM", "34muQ7LZW9VVCrllKQqOfhHpTkTKJUSugGbQ67J3Klg"];

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

async function throwaway() {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  const wire = u8(sstr("ssh-ed25519"), sstr(raw));
  return { priv: kp.privateKey, wire, keyB64: b64(wire), line: `ssh-ed25519 ${b64(wire)} throwaway` };
}
async function sign(key, namespace, message) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", message));
  const signed = u8(enc("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  return blob(key.wire, namespace, new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, signed)));
}

const CATALOGUE = Object.freeze({
  seq: 1, schema_version: 1, issued_at: "2026-10-28T15:05:00Z",
  sha256: createHash("sha256").update("seed").digest("hex"), bytes: 1024,
});

/* R59 amends R58: development lines, marked "-development", follow Bob's two; Bob's lines are R58's, unchanged. */
const BOBS = CATALOGUE_KEYS.filter((l) => !l.split(" ")[2].endsWith("-development"));

test("R58 CATALOGUE_KEYS's lines other than development lines are exactly Bob's two catalogue keys, signing key first", () => {
  assert.deepEqual([...BOBS], [SIGNING_LINE, RECOVERY_LINE]);
  assert.deepEqual(CATALOGUE_KEYS.slice(0, 2), [SIGNING_LINE, RECOVERY_LINE]);
  assert.deepEqual(BOBS.map(normalizeKey), [SIGNING_LINE, RECOVERY_LINE].map(normalizeKey));
  assert.deepEqual(BOBS.map((l) => l.split(" ")[2]), ["bio-ai-catalogue", "bio-ai-catalogue-recovery"]);
  const fp = (line) => createHash("sha256").update(Buffer.from(normalizeKey(line), "base64")).digest("base64")
    .replace(/=+$/, "");
  assert.deepEqual(BOBS.map(fp), FINGERPRINTS);
  assert.ok(Object.isFrozen(CATALOGUE_KEYS));
});

test("R58 each catalogue line differs from every RELEASE_KEYS line, and no line names a test key", () => {
  const release = RELEASE_KEYS.map(normalizeKey);
  for (const line of CATALOGUE_KEYS) {
    assert.ok(!release.includes(normalizeKey(line)));
    assert.doesNotMatch(line, /test|fixture|throwaway/i);
  }
});

test("R58 a statement signed by a throwaway key fails against the default list and verifies with that key as allowedKeys", async () => {
  const key = await throwaway();
  const sig = await sign(key, NS_AI_CATALOGUE, aiCatalogueStatement(CATALOGUE));
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, sig, 0), { ok: false, reason: "UNKNOWN_KEY", keyB64: key.keyB64 });
  assert.deepEqual(await verifyAiCatalogue(CATALOGUE, sig, 0, CATALOGUE_KEYS),
    { ok: false, reason: "UNKNOWN_KEY", keyB64: key.keyB64 });
  const ok = await verifyAiCatalogue(CATALOGUE, sig, 0, [key.line]);
  assert.equal(ok.ok, true);
  assert.deepEqual({ ...ok.statement }, { ...CATALOGUE });
});

test("R58 control: a statement signed by a release key fails against CATALOGUE_KEYS", async () => {
  /* No release private key is held here, so each release key's signature is a blob naming that key: the key is
     judged before the signature (R3), so against RELEASE_KEYS it passes the key check and fails only on its
     signature, while against CATALOGUE_KEYS it never gets past the key. */
  const stmt = aiCatalogueStatement(CATALOGUE);
  for (const line of RELEASE_KEYS) {
    const wire = new Uint8Array(Buffer.from(normalizeKey(line), "base64"));
    const sig = blob(wire, NS_AI_CATALOGUE, new Uint8Array(64).fill(7));
    assert.equal((await verifySshsig(sig, stmt, NS_AI_CATALOGUE, RELEASE_KEYS)).reason, "BAD_SIGNATURE");
    assert.deepEqual(await verifyAiCatalogue(CATALOGUE, sig, 0),
      { ok: false, reason: "UNKNOWN_KEY", keyB64: normalizeKey(line) });
  }
});
