/* corpus-export R17, R18 through the door (T53; K5441, K5443): `exportwhole` and `exportwholepart` reached as the plane
   reaches them. The session gate admits a founder and refuses a member before any store call (admission's harness); the
   assembled store routes the founder's `exportwhole` to this module, which logs it `whole-record`, and each part the
   manifest names, fetched through `exportwholepart`, verifies alone (`verifyWholePart`). Every module is the real one.
   Written as test.todo while the tranche lacks store-assembly's spread of `wholeExportOps` (layer 11, PR 875): on layer/11 both
   pass; once that layer merges, each becomes a test and R17, R18 are struck (K208: an id not yet met is named in a todo). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "../store-assembly/fixture.mjs";
import { world, gate, refused, opCalls } from "../admission/harness.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import * as CE from "../../../src/corpus-export/index.mjs";
import { inquiryMd } from "./fixture.mjs";

const door = async (x, path) => {
  const res = await x.fetch(path, { method: "POST", body: "{}" });
  const text = await res.text();
  assert.doesNotMatch(text, /unknown op/, text.slice(0, 300));
  const j = JSON.parse(text);
  return j && j.ok === true && j.result ? j.result : j;
};
/* the assembled store with one bundle promoted, so the copy holds files */
const seeded = async () => {
  const x = await store();
  const id = "INQ-2026-0201";
  const r = promotionOf(x.ctx).promote({ bundleId: id, base: null, snapKey: "k1", author: "member:alice",
    files: [{ path: "bundle.md", text: inquiryMd(id, "Exported whole?") }], meta: { object_type: "inquiry" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return x;
};

test.todo("R17 through the door: a member's exportwhole is refused SESSION_ROLE_CANNOT_REACH_OP before any store call; the founder's is admitted and answers the whole-record manifest, logged whole-record", async () => {
  const { env, S } = world();
  for (const t of [S.ann, S.bare]) {
    const before = opCalls(env).length;
    refused(await gate(env, { op: "exportwhole", token: t }), 403, "SESSION_ROLE_CANNOT_REACH_OP", "C-38.7", [t]);
    assert.equal(opCalls(env).length, before, "no store call for a refused member");
  }
  assert.ok((await gate(env, { op: "exportwhole", token: S.founder })).caller, "the founder's session is admitted");
  const x = await seeded();
  const m = await door(x, "/exportwhole?viewer=admin&by=admin&note=through%20the%20door");
  assert.equal(m.ok, true, JSON.stringify(m).slice(0, 300));
  assert.equal(m.scope, "whole-record");
  for (const k of ["files", "parts", "placement", "counts", "bundles", "tables", "register", "not_carried"]) assert.ok(k in m, `the manifest states ${k}`);
  assert.equal(m.counts.stored_files, m.files.length);
  assert.ok(m.files.some((e) => e.bundle === "INQ-2026-0201" && e.path === "bundle.md"), "the promoted file is listed");
  const log = x.db.prepare(`SELECT scope, note, files FROM export_log ORDER BY seq DESC LIMIT 1`).get();
  assert.deepEqual([log.scope, log.note, log.files], ["whole-record", "through the door", m.files.length]);
});

test.todo("R18 through the door: each part the founder's exportwhole names, fetched alone through exportwholepart, verifies; a malformed part is refused by name", async () => {
  const x = await seeded();
  const m = await door(x, "/exportwhole?viewer=admin&by=admin");
  assert.ok(m.parts.length > 0, "control: the assembled copy holds files, so the manifest names parts");
  for (const p of m.parts) {
    const g = await door(x, `/exportwholepart?viewer=admin&by=admin&file=${p.file}&offset=${p.offset}&bytes=${p.bytes}`);
    assert.equal(g.ok, true, JSON.stringify(g).slice(0, 300));
    assert.equal(g.sha256, p.sha256, `part ${p.index}'s digest`);
    assert.equal(g.size, p.bytes, `part ${p.index}'s size`);
  }
  const p = m.parts[0];
  const direct = await CE.corpusExportOf(x.ctx).exportWholePart({ file: p.file, offset: p.offset, bytes: p.bytes });
  assert.deepEqual(CE.verifyWholePart({ part: p, bytes: direct.bytes }), { ok: true, index: p.index });
  assert.equal((await door(x, "/exportwholepart?viewer=admin&by=admin&file=nope")).reason, "EXPORT_PART_MALFORMED");
});
