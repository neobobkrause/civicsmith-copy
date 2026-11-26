/* signatures: the release signer, `scripts/sign-sshsig.mjs` (R33–R36,
 * build/requirements/signatures.md), tested at its interface. Its output is
 * checked three independent ways: by this module's own verifier
 * (`verifySshsig`), by stock `ssh-keygen -Y verify`, and byte for byte against
 * `ssh-keygen -Y sign` with the same key (Ed25519 is deterministic). Its key
 * derivation is checked against RFC 8032's test vector and an independent
 * node:crypto derivation. Where ssh-keygen is missing, the cases that need it
 * are skipped by name. Throwaway seeds only; no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as signer from "../../../scripts/sign-sshsig.mjs";
import { verifySshsig, NS_RELEASE, NS_RATIFY, NS_FLEET, fleetStatement } from "../../../src/sshsig.mjs";

/** @import { SshsigYes, SshsigNo } from "../../../src/sshsig.mjs" */

const { signSshsig, seedFromEnvelope, signerPublicLine, keyFromSeed, publicFromKey } = signer;

const te = new TextEncoder();
const td = new TextDecoder();
/** @param {string} s @returns {Uint8Array} */
const enc = (s) => te.encode(s);
/** @param {Uint8Array} bytes @returns {string} */
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
/** The big-endian uint32 at `at`. @param {Uint8Array} b @param {number} at @returns {number} */
const u32at = (b, at) => new DataView(b.buffer, b.byteOffset + at, 4).getUint32(0);
/** The reason of a no, or "" for a yes. @param {SshsigYes | SshsigNo<string>} r @returns {string} */
const reasonOf = (r) => (r.ok ? "" : r.reason);
const HAVE_SSH_KEYGEN = !spawnSync("ssh-keygen", ["-Q"]).error;
const NO_SSH_KEYGEN = HAVE_SSH_KEYGEN ? false : "ssh-keygen is not on PATH";

const DIR = mkdtempSync(join(tmpdir(), "m-signatures-signer-"));
process.on("exit", () => rmSync(DIR, { recursive: true, force: true }));

/** @param {Uint8Array} seed @param {string} [label] @returns {string} */
const envelope = (seed, label = "bio-release") => `BIOKEY-RAW1.${label}.${b64(seed)}`;
/** @param {number} k @returns {Uint8Array} */
const seedOf = (k) => new Uint8Array(32).map((_, i) => (i * k + 7) % 256);
const SEED = seedOf(31);
const ENV = envelope(SEED);

/* RFC 8032 §7.1, TEST 1: the secret key (seed) and the public key it gives. */
const RFC8032 = {
  seed: Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex"),
  pub: Buffer.from("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "hex"),
};

/* ---- an independent reader of the SSHSIG blob, from PROTOCOL.sshsig ---- */

/**
 * @typedef {Object} BlobPart
 * @property {string} t
 * @property {Uint8Array} v
 */
/**
 * @param {string} armored
 * @returns {{ magic: string, version: number, pub: BlobPart, pubBlob: Uint8Array, namespace: string,
 *   reserved: Uint8Array, hashAlg: string, sig: BlobPart }}
 */
function readBlob(armored) {
  const m = /^-----BEGIN SSH SIGNATURE-----\n([\s\S]*)\n-----END SSH SIGNATURE-----\n$/.exec(armored);
  assert.ok(m, "armor");
  const lines = (m[1] ?? "").split("\n");
  for (const [i, l] of lines.entries()) {
    assert.match(l, /^[A-Za-z0-9+/=]+$/);
    if (i < lines.length - 1) assert.equal(l.length, 70, "wrapped at 70 columns");
    else assert.ok(l.length > 0 && l.length <= 70, "last line");
  }
  /** @type {Uint8Array} */
  const blob = Buffer.from(lines.join(""), "base64");
  assert.equal(b64(blob), lines.join(""), "canonical base64");
  let o = 0;
  /** @param {number} n @returns {Uint8Array} */
  const bytes = (n) => { assert.ok(o + n <= blob.length, "truncated"); const v = blob.subarray(o, o + n); o += n; return v; };
  const u32 = () => u32at(bytes(4), 0);
  const str = () => bytes(u32());
  const magic = td.decode(bytes(6));
  const version = u32();
  const pub = str(), namespace = td.decode(str()), reserved = str(), hashAlg = td.decode(str()), sig = str();
  assert.equal(o, blob.length, "no trailing bytes");
  /** @param {Uint8Array} b @returns {BlobPart} */
  const sub = (b) => { let p = 0; const s = () => { const n = u32at(b, p); const v = b.subarray(p + 4, p + 4 + n); p += 4 + n; return v; };
    const t = td.decode(s()), v = s(); assert.equal(p, b.length); return { t, v }; };
  return { magic, version, pub: sub(pub), pubBlob: pub, namespace, reserved, hashAlg, sig: sub(sig) };
}

/* ---- stock OpenSSH ---- */

/** @param {string} pubLine @param {string} namespace @param {string} sig @param {Uint8Array} message @returns {boolean} */
function keygenVerifies(pubLine, namespace, sig, message) {
  const d = mkdtempSync(join(DIR, "kv-"));
  writeFileSync(join(d, "allowed"), `signer@test ${pubLine.split(/\s+/).slice(0, 2).join(" ")}\n`);
  writeFileSync(join(d, "sig"), sig);
  try {
    execFileSync("ssh-keygen", ["-Y", "verify", "-f", join(d, "allowed"), "-I", "signer@test", "-n", namespace,
      "-s", join(d, "sig")], { input: Buffer.from(message), stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch { return false; }
}

/* A fresh ssh-keygen key, with its seed read out of the openssh-key-v1 file. */
/** @returns {{ dir: string, file: string, seed: Uint8Array, pubLine: string }} */
function keygenKey() {
  const d = mkdtempSync(join(DIR, "kg-"));
  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "fresh", "-f", join(d, "k"), "-q"]);
  const pem = readFileSync(join(d, "k"), "utf8");
  /** @type {Uint8Array} */
  const raw = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
  let o = 15; /* "openssh-key-v1\0" */
  const str = () => { const n = u32at(raw, o); const v = raw.subarray(o + 4, o + 4 + n); o += 4 + n; return v; };
  assert.equal(td.decode(str()), "none"); str(); str();           /* cipher, kdf, kdf options */
  assert.equal(u32at(raw, o), 1); o += 4; str();                  /* one key; its public blob */
  const priv = str(); let p = 8;                                  /* check ints */
  const pstr = () => { const n = u32at(priv, p); const v = priv.subarray(p + 4, p + 4 + n); p += 4 + n; return v; };
  assert.equal(td.decode(pstr()), "ssh-ed25519");
  const pub = pstr(), sk = pstr();
  assert.equal(sk.length, 64);
  assert.deepEqual(sk.subarray(32), pub);
  return { dir: d, file: join(d, "k"), seed: new Uint8Array(sk.subarray(0, 32)),
    pubLine: readFileSync(join(d, "k.pub"), "utf8").trim() };
}

/** @param {string} file @param {string} namespace @param {Uint8Array} message @returns {string} */
function keygenSign(file, namespace, message) {
  const m = join(mkdtempSync(join(DIR, "ks-")), "m");
  writeFileSync(m, message);
  execFileSync("ssh-keygen", ["-Y", "sign", "-f", file, "-n", namespace, m], { stdio: ["ignore", "ignore", "ignore"] });
  return readFileSync(`${m}.sig`, "utf8");
}

/* ===================================================================== R33 */

const MESSAGES = [new Uint8Array(0), enc("hello bio release\n"), new Uint8Array(70_000).map((_, i) => (i * 131 + 17) % 251),
  enc(fleetStatement({ version: "1.0.0", plane: { sha256: "a".repeat(64), bytes: 1, asset: "p.mjs" }, members: [] }))];
const NAMESPACES = [NS_RELEASE, NS_RATIFY, NS_FLEET, "x", "a-namespace-long-enough-to-move-the-wrap-points"];

test("R33 the armor and the blob: version-1 SSHSIG, ssh-ed25519 key and signature, the namespace, empty reserved, sha512", () => {
  const pubB64 = signerPublicLine(ENV).split(" ")[1];
  for (const ns of NAMESPACES) for (const msg of MESSAGES) {
    const armored = signSshsig(ENV, msg, ns);
    assert.equal(typeof armored, "string");
    const b = readBlob(armored);
    assert.equal(b.magic, "SSHSIG");
    assert.equal(b.version, 1);
    assert.equal(b.pub.t, "ssh-ed25519");
    assert.equal(b.pub.v.length, 32);
    assert.equal(b64(b.pubBlob), pubB64, "the key of R35");
    assert.equal(b.namespace, ns);
    assert.equal(b.reserved.length, 0);
    assert.equal(b.hashAlg, "sha512");
    assert.equal(b.sig.t, "ssh-ed25519");
    assert.equal(b.sig.v.length, 64);
  }
});

test("R33 verifySshsig accepts it for that namespace and key, and for no other namespace, key or message", async () => {
  const pub = signerPublicLine(ENV);
  const otherPub = signerPublicLine(envelope(seedOf(5)));
  for (const ns of NAMESPACES) for (const msg of MESSAGES) {
    const sig = signSshsig(ENV, msg, ns);
    assert.deepEqual(await verifySshsig(sig, msg, ns, [pub]), { ok: true, keyB64: pub.split(" ")[1], namespace: ns });
    for (const other of NAMESPACES.filter((n) => n !== ns)) {
      assert.equal(reasonOf(await verifySshsig(sig, msg, other, [pub])), "NAMESPACE");
    }
    assert.equal(reasonOf(await verifySshsig(sig, msg, ns, [otherPub])), "UNKNOWN_KEY");
    const changed = msg.length ? Uint8Array.from(msg, (x, i) => (i === msg.length - 1 ? x ^ 1 : x)) : enc("x");
    assert.equal(reasonOf(await verifySshsig(sig, changed, ns, [pub])), "BAD_SIGNATURE");
  }
});

test("R33 it signs the exact bytes of message, whatever byte view carries them", async () => {
  const msg = enc("exact bytes\n");
  const pub = signerPublicLine(ENV);
  const want = signSshsig(ENV, msg, NS_RELEASE);
  for (const v of [Buffer.from(msg), new Uint8Array(msg), new Uint8Array(Buffer.from("xxexact bytes\n")).subarray(2)]) {
    assert.equal(signSshsig(ENV, v, NS_RELEASE), want);
  }
  assert.equal((await verifySshsig(want, msg, NS_RELEASE, [pub])).ok, true);
});

test("R33 the same inputs give the same output, and a different seed, message or namespace a different one", () => {
  const msg = enc("deterministic\n");
  const one = signSshsig(ENV, msg, NS_RELEASE);
  for (let i = 0; i < 5; i++) assert.equal(signSshsig(ENV, msg, NS_RELEASE), one);
  assert.equal(signSshsig(`  ${ENV}\n`, msg, NS_RELEASE), one);
  assert.equal(signSshsig(envelope(SEED, "another-label"), msg, NS_RELEASE), one);
  assert.notEqual(signSshsig(envelope(seedOf(3)), msg, NS_RELEASE), one);
  assert.notEqual(signSshsig(ENV, enc("deterministic!\n"), NS_RELEASE), one);
  assert.notEqual(signSshsig(ENV, msg, NS_RATIFY), one);
});

test("R33 stock ssh-keygen -Y verify accepts it for that namespace and key, and refuses another namespace or message", { skip: NO_SSH_KEYGEN }, () => {
  for (const seed of [SEED, seedOf(97), RFC8032.seed]) {
    const env = envelope(seed);
    const pub = signerPublicLine(env);
    for (const ns of NAMESPACES) for (const msg of MESSAGES) {
      const sig = signSshsig(env, msg, ns);
      assert.equal(keygenVerifies(pub, ns, sig, msg), true, `${ns} ${msg.length}`);
    }
    const msg = enc("refuse me\n");
    const sig = signSshsig(env, msg, NS_RELEASE);
    assert.equal(keygenVerifies(pub, NS_RATIFY, sig, msg), false);
    assert.equal(keygenVerifies(pub, NS_RELEASE, sig, enc("refuse me!\n")), false);
  }
});

test("R33 with an ssh-keygen key's seed, it emits byte for byte what ssh-keygen -Y sign emits", { skip: NO_SSH_KEYGEN }, () => {
  for (let i = 0; i < 3; i++) {
    const k = keygenKey();
    const env = envelope(k.seed);
    assert.equal(signerPublicLine(env, "fresh"), k.pubLine);
    for (const ns of [NS_RELEASE, NS_FLEET]) for (const msg of MESSAGES) {
      assert.equal(signSshsig(env, msg, ns), keygenSign(k.file, ns, msg), `${ns} ${msg.length}`);
    }
  }
});

/* ===================================================================== R34 */

test("R34 seedFromEnvelope accepts the BIOKEY-RAW1 envelope a release key is held in, surrounding whitespace ignored, and returns label and seed", () => {
  /** @type {Array<[string, Uint8Array]>} */
  const cases = [["bio-release", SEED], ["bio-ratify", seedOf(9)], ["", seedOf(1)], ["any label", RFC8032.seed]];
  for (const [label, seed] of cases) {
    const env = envelope(seed, label);
    for (const text of [env, `  ${env}`, `${env}\n`, `\t\n${env} \r\n`]) {
      const r = seedFromEnvelope(text);
      assert.deepEqual(Object.keys(r).sort(), ["label", "seed"]);
      assert.equal(r.label, label);
      assert.equal(r.seed.length, 32);
      assert.deepEqual([...r.seed], [...seed]);
    }
  }
  /* The envelope as a key is written out: the label, a dot, and the base64 of the seed. */
  const written = `BIOKEY-RAW1.bio-release.${btoa(String.fromCharCode(...SEED))}`;
  assert.deepEqual([...seedFromEnvelope(written).seed], [...SEED]);
});

test("R34 any other shape is refused by name, a seed of another length by its length, and signSshsig and signerPublicLine throw the same", () => {
  const SHAPE = "release seed is not a BIOKEY-RAW1 envelope";
  const shapes = [undefined, null, "", "   ", 0, 42, {}, [], "BIOKEY-RAW1", "BIOKEY-RAW1.", "BIOKEY-RAW1.bio-release",
    "BIOKEY-RAW1.bio-release.", `BIOKEY1.bio-release.${b64(SEED)}`, `biokey-raw1.bio-release.${b64(SEED)}`,
    `BIOKEY-RAW2.bio-release.${b64(SEED)}`, `XBIOKEY-RAW1.bio-release.${b64(SEED)}`,
    `BIOKEY-RAW1.bio-release.${b64(SEED)}.extra`, `BIOKEY-RAW1.bio.release.${b64(SEED)}`,
    `BIOKEY-RAW1.bio-release.${b64(SEED).slice(0, 20)} ${b64(SEED).slice(20)}`,
    `BIOKEY-RAW1.bio-release.${b64(SEED).slice(0, 20)}\n${b64(SEED).slice(20)}`,
    `BIOKEY-RAW1.bio-release.${b64(SEED).replace("=", "")}`, `BIOKEY-RAW1.bio-release.${b64(SEED)}!`,
    `BIOKEY-RAW1.bio-release.${b64(SEED).replace(/[+/]/g, "-")}${/[+/]/.test(b64(SEED)) ? "" : "-"}`,
    `BIOKEY-RAW1.bio-release.%%%%${b64(SEED)}`, `prefix BIOKEY-RAW1.bio-release.${b64(SEED)}`];
  /** @type {Array<[number, number | null]>} */
  const lengths = [[0, null], [1, 1], [16, 16], [31, 31], [33, 33], [64, 64]];
  /** @type {Array<(e: unknown) => unknown>} */
  const calls = [(e) => seedFromEnvelope(e), (e) => signSshsig(e, enc("m"), NS_RELEASE), (e) => signerPublicLine(e)];
  for (const call of calls) {
    for (const s of shapes) {
      assert.throws(() => call(s), (/** @type {unknown} */ e) => e instanceof Error && e.message === SHAPE, String(s));
    }
    for (const [n, said] of lengths) {
      const env = `BIOKEY-RAW1.bio-release.${b64(new Uint8Array(n).fill(5))}`;
      const want = said === null ? SHAPE : `release seed is ${said} bytes, expected 32`;
      assert.throws(() => call(env), (/** @type {unknown} */ e) => e instanceof Error && e.message === want, `${n} bytes`);
    }
  }
});

/* ===================================================================== R35 */

test("R35 signerPublicLine is the ssh-ed25519 line of the envelope's key, with the comment given or bio-release", () => {
  const rfc = envelope(RFC8032.seed);
  const wire = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from("ssh-ed25519"), Buffer.from([0, 0, 0, 32]), RFC8032.pub]);
  assert.equal(signerPublicLine(rfc), `ssh-ed25519 ${b64(wire)} bio-release`);
  assert.equal(signerPublicLine(rfc, "operator@release"), `ssh-ed25519 ${b64(wire)} operator@release`);
  assert.equal(signerPublicLine(` ${rfc}\n`), signerPublicLine(rfc));
  for (const k of [3, 11, 200]) {
    const line = signerPublicLine(envelope(seedOf(k)));
    assert.match(line, /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]{43} bio-release$/);
  }
  assert.notEqual(signerPublicLine(envelope(seedOf(3))), signerPublicLine(envelope(seedOf(4))));
});

test("R35 the public line agrees with an independent node:crypto derivation of the same seed", () => {
  for (const seed of [SEED, seedOf(13), RFC8032.seed, Buffer.from(new Uint8Array(32).map((_, i) => (i * 19 + 2) % 256))]) {
    /* RFC 8410's PKCS#8 wrapper of a 32-byte Ed25519 seed. */
    const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seed)]);
    const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
    const x = Buffer.from(createPublicKey(priv).export({ format: "jwk" }).x, "base64url");
    const wire = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from("ssh-ed25519"), Buffer.from([0, 0, 0, 32]), x]);
    assert.equal(signerPublicLine(envelope(seed)), `ssh-ed25519 ${b64(wire)} bio-release`);
  }
});

test("R35 keyFromSeed gives the seed's Ed25519 private key, and publicFromKey its 32 raw public bytes", () => {
  const key = keyFromSeed(RFC8032.seed);
  assert.equal(key.type, "private");
  assert.equal(key.asymmetricKeyType, "ed25519");
  const pub = publicFromKey(key);
  assert.ok(pub instanceof Uint8Array);
  assert.equal(pub.length, 32);
  assert.deepEqual(Buffer.from(pub), RFC8032.pub);
  assert.equal(createPublicKey(key).export({ format: "jwk" }).x, Buffer.from(RFC8032.pub).toString("base64url"));
  for (const seed of [SEED, seedOf(77)]) {
    const raw = Buffer.from(signerPublicLine(envelope(seed)).split(" ")[1] ?? "", "base64").subarray(-32);
    assert.deepEqual(Buffer.from(publicFromKey(keyFromSeed(seed))), raw);
  }
});

/* ===================================================================== R36 */

test("R36 the signature and the public line carry no form of the seed or private key", () => {
  for (const seed of [SEED, seedOf(55), RFC8032.seed]) {
    const env = envelope(seed);
    const forms = [b64(seed), Buffer.from(seed).toString("hex"), Buffer.from(seed).toString("base64url"),
      b64(Buffer.concat([Buffer.from(seed), RFC8032.pub])).slice(0, 40)];
    const outputs = [signerPublicLine(env), signerPublicLine(env, "c"),
      ...NAMESPACES.map((ns) => signSshsig(env, enc("m\n"), ns))];
    for (const out of outputs) {
      for (const f of forms) assert.ok(!out.includes(f), "a textual form of the seed");
      const bytes = out.startsWith("ssh-ed25519") ? Buffer.from(out.split(" ")[1] ?? "", "base64")
        : Buffer.from(out.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
      assert.equal(bytes.indexOf(Buffer.from(seed)), -1, "the seed's bytes");
      assert.equal(bytes.indexOf(Buffer.from(seed).subarray(0, 8)), -1, "a run of the seed's bytes");
    }
    /* Errors name the shape or the length, never the bytes. */
    for (const bad of [`${env}!`, `BIOKEY-RAW1.l.${b64(Buffer.concat([Buffer.from(seed), Buffer.from([1])]))}`]) {
      try { signSshsig(bad, enc("m"), NS_RELEASE); assert.fail("did not throw"); } catch (e) {
        assert.ok(e instanceof Error);
        for (const f of forms) assert.ok(!e.message.includes(f) && !String(e.stack).includes(f));
      }
    }
  }
});

test("R36 signing and the public line print nothing and write no file", () => {
  /* In a child process, in an empty working directory and home, with every
     console and stdio write recorded. */
  const work = mkdtempSync(join(DIR, "quiet-"));
  const url = new URL("../../../scripts/sign-sshsig.mjs", import.meta.url).href;
  const child = `
    const said = [];
    for (const k of ["log", "info", "warn", "error", "debug", "trace", "dir"]) console[k] = (...a) => said.push(k);
    for (const s of [process.stdout, process.stderr]) s.write = () => { said.push("write"); return true; };
    const s = await import(${JSON.stringify(url)});
    const env = ${JSON.stringify(ENV)};
    const out = [s.signSshsig(env, new TextEncoder().encode("m"), "bio-release"), s.signerPublicLine(env)];
    s.seedFromEnvelope(env);
    s.publicFromKey(s.keyFromSeed(s.seedFromEnvelope(env).seed));
    try { s.signSshsig(env + "!", new Uint8Array(1), "bio-release"); } catch {}
    try { s.signerPublicLine("BIOKEY-RAW1.x.AAAA"); } catch {}
    const { writeSync } = await import("node:fs");
    writeSync(3, JSON.stringify({ said, n: out.length }));
  `;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", child],
    { cwd: work, env: { HOME: work, TMPDIR: work }, stdio: ["ignore", "pipe", "pipe", "pipe"], encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
  assert.deepEqual(JSON.parse(r.output[3]), { said: [], n: 2 });
  assert.deepEqual(readdirSync(work), []);
});
