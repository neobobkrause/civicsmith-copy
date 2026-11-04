/* case-import: provider notice docket:266 (docket R32, R33; PR 266). `docket` R33's `docketRecordEdition` files a case's
   `edition` entry automatically; as built at the notice it stores the entry with an empty signature and no signing key,
   and the public read serves it as `signature: null`. R18 records an entry `verified` only when its signature verifies
   (check 2): an entry that fails a check is recorded `refused`, naming the check, and is never a move. Confirmed with no
   code change (BOB's ruling, bob-105: R18 stands; the signing is docket's, PR 278): an unsigned edition entry is refused
   at the signature and is never a move; the same entry signed verifies and is a move. The entry is built in the shape
   `docket` R24 answers and `docketRecordEdition` files (its R6 fields for an `edition` entry), as watch.test.mjs builds
   its entries. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { seeded, imp, caseFile, V, SOURCE, CASE } from "./fixture.mjs";
import { DOCKET_ENTRY_FORMATS, docketAddressOf } from "../../../src/case-import/index.mjs";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { NS_DOCKET, docketStatement } from "../../../src/sshsig.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";

const PUB = "https://source.example.org";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const seed = createHash("sha256").update("seed:manager").digest();
const ENV = `BIOKEY-RAW1.bio-ratify.${seed.toString("base64")}`;
const LINE = signerPublicLine(ENV);
const B64 = LINE.split(" ")[1];
const MANAGER = { key: LINE,
  fingerprint: `SHA256:${createHash("sha256").update(Buffer.from(B64, "base64")).digest("base64").replace(/=+$/, "")}` };

/** The `edition` entry docketRecordEdition files for edition 2: exactly its R6 fields, served with `signature`. */
function editionEntry(signature) {
  const f = { format: DOCKET_ENTRY_FORMATS[0], group: SOURCE, case: CASE, seq: 1, previous: null, shelf: "listed",
              kind: "edition", edition: 2, date: "2026-11-03", what_changed: "the payroll figure corrected" };
  const json = canonicalJson(f);
  const digest = sha(json);
  const sig = signature === "sign" ? signSshsig(ENV, docketStatement(CASE, 1, digest), NS_DOCKET) : signature;
  return { seq: 1, entry: `${CASE}#1`, digest, json, fields: JSON.parse(json), signature: sig,
           published_at: "2026-11-03T10:00:00Z", taken_back: null };
}
const answer = (entries) => ({ ok: true, case: CASE, group: SOURCE, entries, captures: {}, captures_omitted: true,
  last_entry: "2026-11-03", feed: "x" });

async function watched() {
  const w = seeded();
  const a = await imp(w, caseFile({ manifestExtra: { keys: [MANAGER] } }));
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  w.ci.watchImport({ import: a.import, publisher: PUB, by: V("alice"), viewer: V("alice") });
  const read = (ans) => w.ci.recordDocketRead({ import: a.import, docket: docketAddressOf(PUB, CASE),
    at: "2026-11-04T06:00:00Z", outcome: "read", answer: ans });
  return { w, a, read };
}

test("notice docket:266 (R18 check 2, R19): an edition entry served unsigned, as docketRecordEdition files it (signature null or empty), is recorded refused at the signature and is never a move", async () => {
  for (const signature of [null, ""]) {
    const { w, a, read } = await watched();
    const r = await read(answer([editionEntry(signature)]));
    assert.deepEqual([r.ok, r.outcome, r.new_entries, r.new_moves, r.new_refused], [true, "read", 1, 0, 1], JSON.stringify(signature));
    const ic = w.ci.importedCase({ import: a.import, viewer: V("bob") });
    assert.deepEqual(ic.docket_entries.map((e) => [e.seq, e.status, e.failed]), [[1, "refused", "signature"]]);
    assert.equal(w.reeval.moved.length, 0, "a refused entry is never a move");
    assert.ok(!ic.edition.publisher || ic.edition.publisher.edition == null, "no edition move is seen");
  }
});

test("notice docket:266 control: the same edition entry, signed in NS_DOCKET by the manifest's key, verifies and is a move", async () => {
  const { w, a, read } = await watched();
  const r = await read(answer([editionEntry("sign")]));
  assert.deepEqual([r.new_entries, r.new_moves, r.new_refused], [1, 1, 0]);
  const e = w.ci.importedCase({ import: a.import, viewer: V("bob") }).docket_entries[0];
  assert.deepEqual([e.status, e.kind, e.edition, e.key_listed], ["verified", "edition", 2, true]);
  assert.equal(w.reeval.moved.length, 1);
});
