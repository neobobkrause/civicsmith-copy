/* The release signer: an SSHSIG from this project's raw release seed.
 *
 * Part of the `signatures` module (R33–R36). It is run only on an operator's
 * machine, by the release assembler; it lives in `scripts/`, not `src/`, so no
 * bundle of the plane or the installer can ever reach it.
 *
 * ---- WHY THIS EXISTS, AND WHY IT IS NOT IN sshsig.mjs ----------------------
 *
 * `src/sshsig.mjs` states an invariant in its own header: "No secrets appear
 * anywhere in this module: it holds public keys and verifies." That is a
 * property worth keeping — the module ships INSIDE the plane and inside the
 * installer, where a signing path would be a liability and never an asset. So
 * the signer lives here, in a script that runs on an operator's machine, and
 * the verifier stays there.
 *
 * ---- WHY NOT JUST RUN `ssh-keygen -Y sign` --------------------------------
 *
 * Measured 2026-09-13, cutting 0.57.0: `ssh-keygen -Y sign -f <file>` wants an
 * OPENSSH PRIVATE KEY FILE and fails with "Couldn't load public key … No such
 * file or directory" when handed anything else. This project's seed is not that
 * shape — it is `BIOKEY-RAW1.<label>.<base64 32-byte ed25519 seed>`, the envelope
 * the signer page (`src/sign-release.html`) mints and reads. Converting that into
 * an openssh-key-v1 file just to hand it back to ssh-keygen is more moving parts,
 * and every one of them would be a place to get the bytes wrong silently.
 *
 * THE DOCTRINE IS UNAFFECTED, AND THAT IS THE POINT. The rule this repository
 * actually holds is that **stock `ssh-keygen -Y verify` is the acceptance
 * authority** — the reference implementation is OpenSSH, and anything we produce
 * must satisfy it. Signing with a conforming implementation and then having
 * stock OpenSSH accept the result satisfies that rule completely; a signature
 * this project could produce but OpenSSH could not check is the thing being
 * guarded against, and the release assembler verifies with stock ssh-keygen
 * immediately after signing, every time, including when it signed the bytes
 * itself.
 *
 * THE SEED NEVER LEAVES (R36). Nothing here prints or writes, and the only
 * values handed out of the two operator-facing calls are the signature and the
 * public line; an error names the envelope's shape or the seed's length, never
 * its bytes.
 */
import { createPrivateKey, createPublicKey, sign as cryptoSign, createHash } from "node:crypto";

const te = new TextEncoder();
const wStr = (bytes) => {
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length);
  out.set(bytes, 4);
  return out;
};
const cat = (...parts) => {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/** Pull the 32-byte ed25519 seed out of the `BIOKEY-RAW1.<label>.<b64>` envelope. */
export function seedFromEnvelope(envelope) {
  const text = String(envelope || "").trim();
  /* Exactly the envelope the signer page mints: canonical, padded base64 only,
     so a stray character is refused rather than silently skipped by the decoder. */
  const m = /^BIOKEY-RAW1\.([^.]*)\.((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(text);
  if (!m || !m[2]) throw new Error("release seed is not a BIOKEY-RAW1 envelope");
  const seed = Buffer.from(m[2], "base64");
  if (seed.length !== 32) throw new Error(`release seed is ${seed.length} bytes, expected 32`);
  return { label: m[1], seed };
}

/* An Ed25519 PKCS#8 private key is a fixed 16-byte prefix and the raw seed.
   Node has no "import a raw ed25519 seed" API, so this is the documented way in;
   it is checked by the fact that the signature it produces VERIFIES under stock
   ssh-keygen, which is the only claim that matters. */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export function keyFromSeed(seed) {
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed)]),
    format: "der", type: "pkcs8",
  });
}

/** The raw 32-byte public key, derived from the private one. */
export function publicFromKey(key) {
  /* A PRIVATE key object cannot export SPKI — `createPublicKey` derives the
     public half first. Measured 2026-09-13: exporting spki straight off the
     private key throws ERR_INVALID_ARG_VALUE. */
  const spki = createPublicKey(key).export({ format: "der", type: "spki" }); // 12-byte prefix + 32
  return new Uint8Array(spki.subarray(spki.length - 32));
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

/**
 * Sign `message` (Uint8Array/Buffer) in `namespace`, returning an armored
 * SSHSIG. Shapes are openssh PROTOCOL.sshsig, the same ones sshsig.mjs parses.
 */
export function signSshsig(envelope, message, namespace) {
  const { seed } = seedFromEnvelope(envelope);
  const key = keyFromSeed(seed);
  const pubRaw = publicFromKey(key);
  const pubBlob = cat(wStr(te.encode("ssh-ed25519")), wStr(pubRaw));

  const hash = new Uint8Array(createHash("sha512").update(Buffer.from(message)).digest());
  const preimage = cat(
    te.encode("SSHSIG"),
    wStr(te.encode(namespace)),
    wStr(new Uint8Array(0)),          // reserved
    wStr(te.encode("sha512")),
    wStr(hash),
  );
  const sigRaw = new Uint8Array(cryptoSign(null, Buffer.from(preimage), key));
  const sigBlob = cat(wStr(te.encode("ssh-ed25519")), wStr(sigRaw));

  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, 1);
  const blob = cat(
    te.encode("SSHSIG"), ver,
    wStr(pubBlob), wStr(te.encode(namespace)), wStr(new Uint8Array(0)),
    wStr(te.encode("sha512")), wStr(sigBlob),
  );

  const body = b64(blob).replace(/(.{70})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN SSH SIGNATURE-----\n${body}\n-----END SSH SIGNATURE-----\n`;
}

/** The signer's own public key as an authorized_keys line, for comparison
 *  against ARMED_SIGNERS. Public material only — safe to print. */
export function signerPublicLine(envelope, comment = "bio-release") {
  const { seed } = seedFromEnvelope(envelope);
  const pubRaw = publicFromKey(keyFromSeed(seed));
  return `ssh-ed25519 ${b64(cat(wStr(te.encode("ssh-ed25519")), wStr(pubRaw)))} ${comment}`;
}
