/* signatures: the release keys and the release notice (R45–R48, and R1 as T48 amends it;
 * build/requirements/signatures.md), tested at the module's interface. Notices are signed three independent ways:
 * by the release signer the module provides (`scripts/sign-sshsig.mjs`, the one the release assembler runs), by a
 * small SSHSIG signer written here from PROTOCOL.sshsig with WebCrypto throwaway keys, and by stock ssh-keygen where
 * it is on PATH. Throwaway keys and seeds only; the release keys are only read. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as sshsig from "../../../src/sshsig.mjs";
import { canonicalJson } from "../../../src/record-grammar/index.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";

const {
  RELEASE_KEYS, NS_RELEASE_NOTICE, RELEASE_NOTES_MAX, releaseNoticeStatement, verifyReleaseNotice, verifySshsig,
  normalizeKey, NS_RELEASE, NS_RATIFY, NS_FLEET, NS_NOTICE, NS_DOCKET, ratifyStatement, caseRatifyStatement,
  noticeStatement, docketStatement, captureAccountStatement, fleetStatement,
} = sshsig;

const te = new TextEncoder();
const td = new TextDecoder();
const enc = (s) => te.encode(s);
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const HAVE_SSH_KEYGEN = !spawnSync("ssh-keygen", ["-Q"]).error;
const NO_SSH_KEYGEN = HAVE_SSH_KEYGEN ? false : "ssh-keygen is not on PATH";

const DIR = mkdtempSync(join(tmpdir(), "m-signatures-notice-"));
process.on("exit", () => rmSync(DIR, { recursive: true, force: true }));

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

/* A throwaway release seed for the release signer, in the envelope the signer page mints. */
const ENV = `BIOKEY-RAW1.bio-release.${b64(new Uint8Array(32).map((_, i) => (i * 41 + 9) % 256))}`;
const ENV_PUB = signerPublicLine(ENV);

/* ------------------------------------------------------------- a notice */

const MANIFEST = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const NOTICE = Object.freeze({
  version: "0.85.0", date: "2026-10-14", manifest: MANIFEST, security: true,
  notes: Object.freeze({
    members: "Searching your records is faster.\nA citation now shows its page.",
    administrators: "Updates are checked once a day; you decide when to apply one.",
    must_do: "",
  }),
});
const withField = (k, v) => ({ ...NOTICE, [k]: v });
const withNote = (k, v) => ({ ...NOTICE, notes: { ...NOTICE.notes, [k]: v } });
const want = (n) => `bio-release-notice/1\nversion ${n.version}\ndate ${n.date}\nmanifest ${n.manifest}\n`
  + `security ${n.security ? "yes" : "no"}\nnotes ${canonicalJson(n.notes)}\n`;
const refusesField = (notice, field, why) => assert.throws(() => releaseNoticeStatement(notice),
  (e) => e instanceof Error && e.message === `REFUSED [NOTICE_FIELD]: ${field}`, why ?? field);

const REASONS_NOTICE = ["MALFORMED", "NAMESPACE", "UNKNOWN_KEY", "BAD_SIGNATURE", "CRYPTO_UNAVAILABLE", "NOT_NEWER"];
/* Every "no" verifyReleaseNotice gives in these tests, checked at the end (R29's rule, R48's reasons). */
const NOES = [];
const judge = async (...a) => {
  const r = await verifyReleaseNotice(...a);
  if (!r.ok) NOES.push(r);
  return r;
};

/* ===================================================================== R45 */

/* The two lines the installer's ARMED_SIGNERS holds at T48's opening (installer R43; K2922, K2930). */
const T48_ARMED_SIGNERS = [
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICiA6JRm52rE3agZAKqb/4ATA34c8jEp3Yef0KZyCe18 bio-release",
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMdvnsYToN22fqksnV1gLYWEJJmQA6vMyXnThPJMm7yJ bio-release-recovery",
];

test("R45 RELEASE_KEYS is exactly the release key and the recovery key, each an ed25519 line R2 reads, the two different, and the list frozen", () => {
  assert.ok(Array.isArray(RELEASE_KEYS));
  assert.deepEqual([...RELEASE_KEYS], T48_ARMED_SIGNERS);
  const norm = RELEASE_KEYS.map(normalizeKey);
  for (const [i, line] of RELEASE_KEYS.entries()) {
    assert.match(line, /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]{43} \S+$/, "R35's form");
    assert.equal(norm[i], line.split(" ")[1], "R2 reads it as the key it names");
  }
  assert.equal(new Set(norm).size, 2, "two different keys");
  assert.deepEqual(RELEASE_KEYS.map((l) => l.split(" ")[2]), ["bio-release", "bio-release-recovery"]);
  /* Frozen: no caller can add, remove or replace a key, nor rebind the list. */
  assert.ok(Object.isFrozen(RELEASE_KEYS));
  assert.throws(() => { RELEASE_KEYS.push(KEY.line); });
  assert.throws(() => { RELEASE_KEYS[0] = KEY.line; });
  assert.throws(() => { RELEASE_KEYS.length = 0; });
  assert.throws(() => { sshsig.RELEASE_KEYS = [KEY.line]; });
  assert.deepEqual([...RELEASE_KEYS], T48_ARMED_SIGNERS);
});

test("R45 a signature by a key outside RELEASE_KEYS is UNKNOWN_KEY against it, for a release, a fleet statement and a release notice", async () => {
  const fleet = enc(fleetStatement({ version: "0.85.0", plane: { sha256: MANIFEST, bytes: 1, asset: "p.mjs" }, members: [] }));
  for (const [ns, m] of [[NS_RELEASE, enc("asset bytes")], [NS_FLEET, fleet], [NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE)]]) {
    const r = await verifySshsig(signSshsig(ENV, m, ns), m, ns, RELEASE_KEYS);
    assert.deepEqual(r, { ok: false, reason: "UNKNOWN_KEY", keyB64: ENV_PUB.split(" ")[1] });
  }
});

/* ===================================================================== R46 */

const NAMESPACES = [NS_RELEASE, NS_RATIFY, NS_FLEET, NS_NOTICE, NS_DOCKET];

test("R46 NS_RELEASE_NOTICE is bio-release-notice, a compiled constant distinct from every other namespace, and a notice signature verifies only in it", async () => {
  assert.equal(NS_RELEASE_NOTICE, "bio-release-notice");
  for (const ns of NAMESPACES) assert.notEqual(ns, NS_RELEASE_NOTICE);
  assert.throws(() => { sshsig.NS_RELEASE_NOTICE = NS_RELEASE; });
  assert.equal(sshsig.NS_RELEASE_NOTICE, "bio-release-notice");
  const stmt = releaseNoticeStatement(NOTICE);
  const sig = await sign(KEY, NS_RELEASE_NOTICE, stmt);
  assert.deepEqual(await verifySshsig(sig, stmt, NS_RELEASE_NOTICE, [KEY.line]),
    { ok: true, keyB64: KEY.keyB64, namespace: NS_RELEASE_NOTICE });
  /* A notice's signature never verifies as anything else, nor anything else's as a notice. */
  for (const ns of NAMESPACES) {
    assert.deepEqual(await verifySshsig(sig, stmt, ns, [KEY.line]),
      { ok: false, reason: "NAMESPACE", expected: ns, got: NS_RELEASE_NOTICE });
    const theirs = await sign(KEY, ns, stmt);
    assert.deepEqual(await verifySshsig(theirs, stmt, NS_RELEASE_NOTICE, [KEY.line]),
      { ok: false, reason: "NAMESPACE", expected: NS_RELEASE_NOTICE, got: ns });
  }
});

test("R1 (T48) six namespaces: NS_RELEASE_NOTICE joins the five, distinct from every one, and the release signer's signatures in it are refused in each of them", async () => {
  const six = Object.keys(sshsig).filter((k) => k.startsWith("NS_")).map((k) => sshsig[k]);
  assert.equal(six.length, 6);
  assert.equal(new Set(six).size, 6);
  assert.ok(six.includes(NS_RELEASE_NOTICE));
  const stmt = releaseNoticeStatement(NOTICE);
  const sig = signSshsig(ENV, stmt, NS_RELEASE_NOTICE);
  for (const ns of six) {
    const r = await verifySshsig(sig, stmt, ns, [ENV_PUB]);
    if (ns === NS_RELEASE_NOTICE) assert.equal(r.ok, true);
    else assert.equal(r.reason, "NAMESPACE");
  }
});

/* ===================================================================== R47 */

test("R47 releaseNoticeStatement is exactly the six lines, the notes as record-grammar's canonical JSON, in UTF-8, the same bytes every time", () => {
  const notices = [NOTICE, withField("security", false), withNote("must_do", "Re-enter the mail key under Settings."),
    { ...NOTICE, version: "0.0.0", date: "2000-02-29" }, { ...NOTICE, version: "10.200.3000", date: "2024-02-29" },
    withNote("members", "Café — 東京 — 🌉, \"quoted\", a\\backslash, <b>not markup</b>, a NUL \u0000 and a tab\t."),
    withNote("administrators", "x".repeat(RELEASE_NOTES_MAX)), withNote("members", "🌉".repeat(RELEASE_NOTES_MAX))];
  for (const n of notices) {
    const out = releaseNoticeStatement(n);
    assert.ok(out instanceof Uint8Array);
    assert.deepEqual([...out], [...Buffer.from(want(n), "utf8")]);
    assert.deepEqual(releaseNoticeStatement(structuredClone(n)), out, "the same bytes every time");
    /* The notes line is one line: the notes' own newlines are escaped inside the JSON. */
    assert.equal(td.decode(out).split("\n").length, 7);
  }
  assert.equal(td.decode(releaseNoticeStatement(NOTICE)), "bio-release-notice/1\nversion 0.85.0\ndate 2026-10-14\n"
    + `manifest ${MANIFEST}\nsecurity yes\nnotes {"administrators":"Updates are checked once a day; you decide when to apply one.",`
    + `"members":"Searching your records is faster.\\nA citation now shows its page.","must_do":""}\n`);
  /* The notes' key order, and fields beyond R47's, change nothing. */
  const reordered = { notes: { must_do: "", members: NOTICE.notes.members, administrators: NOTICE.notes.administrators },
    security: true, manifest: MANIFEST, date: NOTICE.date, version: NOTICE.version, signature: "ignored", extra: 1 };
  assert.deepEqual(releaseNoticeStatement(reordered), releaseNoticeStatement(NOTICE));
});

test("R47 changing any field, a character of the notes included, changes the bytes", () => {
  const base = td.decode(releaseNoticeStatement(NOTICE));
  const changed = [withField("version", "0.85.1"), withField("date", "2026-10-15"), withField("manifest", "0".repeat(64)),
    withField("security", false), withNote("members", NOTICE.notes.members.replace("faster", "fast")),
    withNote("members", `${NOTICE.notes.members} `), withNote("administrators", NOTICE.notes.administrators.slice(1)),
    withNote("must_do", " "), withNote("must_do", "\n")];
  const seen = new Set([base]);
  for (const n of changed) {
    const s = td.decode(releaseNoticeStatement(n));
    assert.notEqual(s, base);
    seen.add(s);
  }
  assert.equal(seen.size, changed.length + 1);
  /* Every single-character change of a note's text gives other bytes. */
  const text = NOTICE.notes.members;
  for (let i = 0; i < text.length; i++) {
    const t = text.slice(0, i) + String.fromCharCode(text.charCodeAt(i) ^ 1) + text.slice(i + 1);
    assert.notEqual(td.decode(releaseNoticeStatement(withNote("members", t))), base);
  }
});

test("R47 a version that is not <n>.<n>.<n> is refused by name", () => {
  for (const v of [undefined, null, 1, 1.2, "", "1", "1.2", "1.2.3.4", "v1.2.3", "1.2.3-rc1", "1.2.3+b", " 1.2.3", "1.2.3 ",
    "1.2.3\n", "01.2.3", "1.02.3", "1.2.03", "00.0.0", "1..3", "1.2.", ".1.2", "-1.2.3", "1.2.x", "１.2.3", "١.2.3",
    ["1", "2", "3"], { toString: () => "1.2.3" }]) {
    refusesField(withField("version", v), "version", String(v));
  }
  for (const v of ["0.0.0", "0.84.0", "1.0.0", "10.0.12345678901234567890"]) {
    assert.doesNotThrow(() => releaseNoticeStatement(withField("version", v)));
  }
});

test("R47 a date that is not a YYYY-MM-DD that exists is refused by name", () => {
  for (const d of [undefined, null, 20261014, "", "2026-10-14T00:00:00Z", "2026-10-1", "2026-1-14", "26-10-14", "2026/10/14",
    " 2026-10-14", "2026-10-14\n", "2026-00-10", "2026-13-01", "2026-10-00", "2026-10-32", "2026-04-31", "2026-06-31",
    "2026-09-31", "2026-11-31", "2026-02-29", "2027-02-29", "1900-02-29", "2100-02-29", "2026-02-30", "２０２６-10-14",
    "+2026-10-14", "12026-10-14", new Date(0)]) {
    refusesField(withField("date", d), "date", String(d));
  }
  for (const d of ["2026-10-14", "2024-02-29", "2000-02-29", "2026-12-31", "2026-01-01", "2026-02-28", "0000-01-01", "9999-12-31"]) {
    assert.doesNotThrow(() => releaseNoticeStatement(withField("date", d)), d);
  }
});

test("R47 a manifest that is not 64 lowercase hex, and a security mark that is not a boolean, are refused by name", () => {
  for (const m of [undefined, null, 0, "", "0".repeat(63), "0".repeat(65), MANIFEST.toUpperCase(), `g${MANIFEST.slice(1)}`,
    ` ${MANIFEST}`, `${MANIFEST}\n`, [MANIFEST], Buffer.from(MANIFEST, "hex")]) {
    refusesField(withField("manifest", m), "manifest", String(m));
  }
  for (const s of [undefined, null, 0, 1, "yes", "no", "true", "", [], {}, new Boolean(true)]) {
    refusesField(withField("security", s), "security", String(s));
  }
});

test("R47 the notes are exactly {members, administrators, must_do}, strings of at most RELEASE_NOTES_MAX characters, members and administrators non-empty", () => {
  assert.equal(RELEASE_NOTES_MAX, 8000);
  for (const notes of [undefined, null, "notes", [], ["a", "b", "c"], new Map(), {},
    { members: "m", administrators: "a" }, { members: "m", must_do: "" }, { administrators: "a", must_do: "" },
    { ...NOTICE.notes, extra: "" }, { ...NOTICE.notes, Members: "m" }, Object.create(NOTICE.notes)]) {
    refusesField(withField("notes", notes), "notes", JSON.stringify(notes) ?? String(notes));
  }
  for (const k of ["members", "administrators", "must_do"]) {
    for (const v of [undefined, null, 0, ["text"], { text: "x" }, "x".repeat(RELEASE_NOTES_MAX + 1),
      "🌉".repeat(RELEASE_NOTES_MAX + 1), `${"x".repeat(RELEASE_NOTES_MAX)}y`]) {
      refusesField(withNote(k, v), `notes.${k}`, `${k} ${String(v).slice(0, 20)}`);
    }
    assert.doesNotThrow(() => releaseNoticeStatement(withNote(k, "x".repeat(RELEASE_NOTES_MAX))));
    assert.doesNotThrow(() => releaseNoticeStatement(withNote(k, "🌉".repeat(RELEASE_NOTES_MAX))), "characters, not UTF-16 units");
  }
  refusesField(withNote("members", ""), "notes.members");
  refusesField(withNote("administrators", ""), "notes.administrators");
  assert.doesNotThrow(() => releaseNoticeStatement(withNote("must_do", "")), "must_do may be empty");
});

test("R47 anything else is refused before a byte is built: a notice that is not an object, or one whose fields cannot be read", () => {
  for (const n of [undefined, null, "notice", 7, [], [NOTICE], () => NOTICE]) refusesField(n, "notice", String(n));
  const hostile = { ...NOTICE };
  Object.defineProperty(hostile, "version", { get() { throw new Error("hostile"); }, enumerable: true });
  refusesField(hostile, "notice");
  /* The first field refused is named, in R47's order. */
  refusesField({ ...NOTICE, version: "x", date: "x", notes: null }, "version");
  refusesField({ ...NOTICE, date: "x", security: "x" }, "date");
  refusesField({ ...NOTICE, manifest: "x", notes: null }, "manifest");
  /* A field read twice could differ; each is read once, so what is judged is what is signed. */
  let reads = 0;
  const shifty = { ...NOTICE };
  Object.defineProperty(shifty, "version", { get() { reads++; return reads === 1 ? "1.0.0" : "not a version"; }, enumerable: true });
  assert.match(td.decode(releaseNoticeStatement(shifty)), /^bio-release-notice\/1\nversion 1\.0\.0\n/);
  assert.equal(reads, 1);
});

test("R47 a release notice's leading token is no other statement's, so it is never the same signed bytes", () => {
  const notice = td.decode(releaseNoticeStatement(NOTICE));
  const lead = (s) => s.split(/[ \n]/)[0];
  const id = "CASE-2026-3091";
  const others = [ratifyStatement(id, MANIFEST), caseRatifyStatement(id, 1, MANIFEST), noticeStatement(id, 1, MANIFEST),
    docketStatement(id, 1, MANIFEST), captureAccountStatement(MANIFEST, notice)].map((b) => td.decode(b))
    .concat(fleetStatement({ version: NOTICE.version, plane: { sha256: MANIFEST, bytes: 1, asset: "a" }, members: [] }));
  for (const other of others) {
    assert.notEqual(other, notice);
    assert.notEqual(lead(other), lead(notice));
  }
});

/* ===================================================================== R48 */

test("R48 a notice signed with a key in allowedKeys, newer than the running version, is accepted with a frozen copy of its fields", async () => {
  const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE));
  const r = await judge({ ...NOTICE, signature: sig, extra: "dropped" }, sig, "0.84.0", [KEY.line]);
  assert.deepEqual(r, { ok: true, notice: { version: NOTICE.version, date: NOTICE.date, manifest: MANIFEST, security: true,
    notes: { ...NOTICE.notes } } });
  assert.deepEqual(Object.keys(r.notice), ["version", "date", "manifest", "security", "notes"]);
  assert.deepEqual(Object.keys(r.notice.notes), ["members", "administrators", "must_do"]);
  assert.ok(Object.isFrozen(r.notice));
  assert.ok(Object.isFrozen(r.notice.notes));
  /* A copy: changing what was passed in afterwards changes nothing in the answer. */
  const mine = structuredClone(NOTICE);
  const r2 = await judge(mine, sig, "0.84.0", [KEY.line]);
  mine.notes.members = "rewritten";
  mine.version = "9.9.9";
  assert.equal(r2.notice.notes.members, NOTICE.notes.members);
  assert.equal(r2.notice.version, NOTICE.version);
  /* Any allowed key that signed it will do. */
  assert.equal((await judge(NOTICE, sig, "0.84.0", [OTHER.line, KEY.keyB64])).ok, true);
});

test("R48 control: the same notice with one character of its notes changed is BAD_SIGNATURE", async () => {
  const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE));
  for (const n of [withNote("members", NOTICE.notes.members.replace("faster", "fastex")),
    withNote("administrators", `${NOTICE.notes.administrators}!`), withNote("must_do", "x"),
    withField("security", false), withField("manifest", "0".repeat(64)), withField("date", "2026-10-13"),
    withField("version", "0.86.0")]) {
    assert.deepEqual(await judge(n, sig, "0.84.0", [KEY.line]), { ok: false, reason: "BAD_SIGNATURE", keyB64: KEY.keyB64 });
  }
});

test("R48 control: a correctly signed notice of an older version, or of the running one (a replay), is NOT_NEWER", async () => {
  for (const [version, running] of [["0.84.0", "0.84.0"], ["0.83.9", "0.84.0"], ["0.9.0", "0.10.0"], ["1.99.99", "2.0.0"],
    ["0.84.0", "0.84.1"], ["0.0.0", "0.0.0"], ["10.0.12345678901234567889", "10.0.12345678901234567890"]]) {
    const n = withField("version", version);
    const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(n));
    assert.deepEqual(await judge(n, sig, running, [KEY.line]), { ok: false, reason: "NOT_NEWER", version, running });
  }
  /* Newer, part by part as numbers, never as text. */
  for (const [version, running] of [["0.10.0", "0.9.0"], ["2.0.0", "1.99.99"], ["0.84.1", "0.84.0"], ["1.0.0", "0.999.999"],
    ["0.85.0", "0.84.10"], ["10.0.12345678901234567890", "10.0.12345678901234567889"], ["10.0.0", "9.0.0"]]) {
    const n = withField("version", version);
    const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(n));
    assert.equal((await judge(n, sig, running, [KEY.line])).ok, true, `${version} over ${running}`);
  }
});

test("R48 control: the same bytes signed in NS_RELEASE are NAMESPACE; a key outside allowedKeys is UNKNOWN_KEY", async () => {
  const stmt = releaseNoticeStatement(NOTICE);
  for (const ns of [NS_RELEASE, NS_FLEET, NS_RATIFY, NS_NOTICE, NS_DOCKET]) {
    assert.deepEqual(await judge(NOTICE, await sign(KEY, ns, stmt), "0.84.0", [KEY.line]),
      { ok: false, reason: "NAMESPACE", expected: NS_RELEASE_NOTICE, got: ns });
  }
  const sig = await sign(KEY, NS_RELEASE_NOTICE, stmt);
  for (const keys of [[OTHER.line], [], [OTHER.keyB64, "junk"], null, "not a list"]) {
    assert.deepEqual(await judge(NOTICE, sig, "0.84.0", keys), { ok: false, reason: "UNKNOWN_KEY", keyB64: KEY.keyB64 });
  }
});

test("R48 with no allowedKeys, RELEASE_KEYS decides: a throwaway key's notice is UNKNOWN_KEY, the same as against RELEASE_KEYS", async () => {
  const stmt = releaseNoticeStatement(NOTICE);
  for (const [sig, key] of [[await sign(KEY, NS_RELEASE_NOTICE, stmt), KEY.keyB64],
    [signSshsig(ENV, stmt, NS_RELEASE_NOTICE), ENV_PUB.split(" ")[1]]]) {
    const want = { ok: false, reason: "UNKNOWN_KEY", keyB64: key };
    assert.deepEqual(await judge(NOTICE, sig, "0.84.0"), want);
    assert.deepEqual(await judge(NOTICE, sig, "0.84.0", undefined), want);
    assert.deepEqual(await judge(NOTICE, sig, "0.84.0", RELEASE_KEYS), want);
  }
  assert.equal(verifyReleaseNotice.length, 3, "allowedKeys is optional");
});

test("R48 a notice R47 refuses, or a running version not of its form, is MALFORMED naming the field; a malformed signature is MALFORMED", async () => {
  const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE));
  for (const [n, field] of [[null, "notice"], ["x", "notice"], [withField("version", "1.2"), "version"],
    [withField("date", "2026-02-29"), "date"], [withField("manifest", MANIFEST.toUpperCase()), "manifest"],
    [withField("security", "yes"), "security"], [withField("notes", {}), "notes"], [withNote("members", ""), "notes.members"],
    [withNote("administrators", "x".repeat(RELEASE_NOTES_MAX + 1)), "notes.administrators"], [withNote("must_do", null), "notes.must_do"]]) {
    assert.deepEqual(await judge(n, sig, "0.84.0", [KEY.line]), { ok: false, reason: "MALFORMED", field });
  }
  for (const running of [undefined, null, "", "0.84", "v0.84.0", "0.84.0 ", "00.84.0", 84, ["0", "84", "0"]]) {
    assert.deepEqual(await judge(NOTICE, sig, running, [KEY.line]), { ok: false, reason: "MALFORMED", field: "running" });
  }
  for (const bad of [undefined, null, "", "not armor", "-----BEGIN SSH SIGNATURE-----\nAAAA\n-----END SSH SIGNATURE-----", 42]) {
    const r = await judge(NOTICE, bad, "0.84.0", [KEY.line]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "MALFORMED");
    assert.equal(r.field, "signature");
  }
});

test("R48 CRYPTO_UNAVAILABLE when the runtime refuses to import the key, as verifySshsig names it", async (t) => {
  const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE));
  t.mock.method(globalThis.crypto.subtle, "importKey", async () => { throw new Error("Ed25519 not supported"); });
  const r = await judge(NOTICE, sig, "0.84.0", [KEY.line]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "CRYPTO_UNAVAILABLE");
});

test("R48 the signature is judged before the version: an old notice that is not correctly signed is never NOT_NEWER", async () => {
  const old = withField("version", "0.1.0");
  const stmt = releaseNoticeStatement(old);
  assert.equal((await judge(withNote("members", "tampered"), await sign(KEY, NS_RELEASE_NOTICE, stmt), "0.84.0", [KEY.line])).reason,
    "BAD_SIGNATURE");
  assert.equal((await judge(old, await sign(KEY, NS_RELEASE, stmt), "0.84.0", [KEY.line])).reason, "NAMESPACE");
  assert.equal((await judge(old, await sign(OTHER, NS_RELEASE_NOTICE, stmt), "0.84.0", [KEY.line])).reason, "UNKNOWN_KEY");
  assert.equal((await judge(old, await sign(KEY, NS_RELEASE_NOTICE, stmt), "0.84.0", [KEY.line])).reason, "NOT_NEWER");
});

test("R48 never throws, whatever it is given", async () => {
  const sig = await sign(KEY, NS_RELEASE_NOTICE, releaseNoticeStatement(NOTICE));
  const hostile = { ...NOTICE };
  Object.defineProperty(hostile, "notes", { get() { throw new Error("hostile"); }, enumerable: true });
  const notices = [undefined, null, 0, "x", [], {}, NOTICE, hostile, withNote("members", { toString() { throw new Error("no"); } }),
    new Proxy({}, { get() { throw new Error("trap"); }, ownKeys() { throw new Error("trap"); } })];
  const sigs = [undefined, null, 0, {}, sig, sig.replace(/[A-Z]/g, "a"), { toString() { throw new Error("hostile"); } }];
  const runnings = [undefined, null, "0.84.0", 7, {}, { toString() { throw new Error("hostile"); } }];
  const keyLists = [undefined, null, "x", [KEY.line], [null, 3, {}, KEY.line], { length: 1 }];
  for (const n of notices) for (const s of sigs) for (const run of runnings) for (const k of keyLists) {
    let r;
    await assert.doesNotReject(async () => { r = await judge(n, s, run, k); });
    assert.equal(typeof r.ok, "boolean");
    if (r.ok) assert.ok(n === NOTICE && s === sig && run === "0.84.0");
  }
});

test("R48 a notice signed by the release signer the assembler runs is accepted under its key, and by stock ssh-keygen in bio-release-notice only", { skip: NO_SSH_KEYGEN }, async () => {
  const stmt = releaseNoticeStatement(NOTICE);
  const sig = signSshsig(ENV, stmt, NS_RELEASE_NOTICE);
  assert.equal((await judge(NOTICE, sig, "0.84.0", [ENV_PUB])).ok, true);
  const d = mkdtempSync(join(DIR, "kv-"));
  writeFileSync(join(d, "allowed"), `release@test ${ENV_PUB.split(" ").slice(0, 2).join(" ")}\n`);
  writeFileSync(join(d, "sig"), sig);
  const verify = (ns, bytes) => { try {
    execFileSync("ssh-keygen", ["-Y", "verify", "-f", join(d, "allowed"), "-I", "release@test", "-n", ns, "-s", join(d, "sig")],
      { input: Buffer.from(bytes), stdio: ["pipe", "ignore", "ignore"] });
    return true; } catch { return false; } };
  assert.equal(verify(NS_RELEASE_NOTICE, stmt), true);
  assert.equal(verify(NS_RELEASE, stmt), false);
  assert.equal(verify(NS_RELEASE_NOTICE, releaseNoticeStatement(withNote("must_do", "x"))), false);
  /* And a notice signed by stock ssh-keygen is accepted by verifyReleaseNotice. */
  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "fresh", "-f", join(d, "k"), "-q"]);
  writeFileSync(join(d, "m"), stmt);
  execFileSync("ssh-keygen", ["-Y", "sign", "-f", join(d, "k"), "-n", NS_RELEASE_NOTICE, join(d, "m")], { stdio: "ignore" });
  const pub = readFileSync(join(d, "k.pub"), "utf8").trim();
  assert.equal((await judge(NOTICE, readFileSync(join(d, "m.sig"), "utf8"), "0.84.0", [pub])).ok, true);
  assert.equal((await judge(withNote("members", "x"), readFileSync(join(d, "m.sig"), "utf8"), "0.84.0", [pub])).reason, "BAD_SIGNATURE");
});

test("R48 (R29) every no verifyReleaseNotice gave in these tests names which kind of no", () => {
  assert.ok(NOES.length > 100);
  for (const r of NOES) {
    assert.equal(r.ok, false);
    assert.ok(REASONS_NOTICE.includes(r.reason), JSON.stringify(r));
    if (r.reason === "MALFORMED") assert.equal(typeof r.field, "string");
    if (r.reason === "NAMESPACE") assert.ok("expected" in r && "got" in r);
    if (r.reason === "UNKNOWN_KEY" || r.reason === "BAD_SIGNATURE") assert.equal(typeof r.keyB64, "string");
    if (r.reason === "NOT_NEWER") assert.ok(typeof r.version === "string" && typeof r.running === "string");
  }
  for (const reason of REASONS_NOTICE) {
    assert.ok(NOES.some((r) => r.reason === reason), reason);
  }
});
