/* store-assembly: the provider notice workbooks:285 (PR 285; runtime-limits' `xlsx.declared_text` row). Confirmed, no code
   change: R6 spreads `workbooksOps` over the one `workbooksOf(ctx)` instance (assemble.mjs), and the store's door answers a
   module's refusal as the module gives it (R7, R97: the assembly mints no refusal). So an xlsx whose declared text is over
   WORKBOOK_DECLARED_TEXT_MAX, added through the store's door, answers workbooks' own WORKBOOK_FILE_TOO_LARGE, condition
   `declared_text`, stated on the xlsx.declared_text row, unchanged. The package is office-readers' fixture, its sheet part
   declaring its uncompressed size in the central directory; the capture is uploaded through capture's own act. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { memoryBucket } from "./world.mjs";
import * as F from "../office-readers/fixtures.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { workbooksOf, WORKBOOK_DECLARED_TEXT_MAX } from "../../../src/workbooks/index.mjs";

const NS = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`;
const SHEET = `<?xml version="1.0"?><worksheet ${NS}><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`;
const declaring = (usize) => F.xlsx({ sheets: [{ name: "Big", xml: SHEET, cd: { usize } }] });
const projMd = (title) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
  "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  `objective: "Find out what it costs."`, "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");

const infoMd = (id, project) => ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
  `project: ${project}`, "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
  `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
  "---", "", "## Summary", "", "A document.", ""].join("\n");
const provDoc = (file, capSha) => ({ file, locator: `https://example.org/${file}`, retrieved: "2026-09-27T00:00:00Z",
  authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
  capture: { method: "acquire", grade: "B", actor_class: "session", sha256: capSha, encoding: "utf8", bytes: 1 },
  origin: { kind: "named_request" } });

async function added(usize) {
  const x = await store({ env: { CAPTURES: memoryBucket() } });
  instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "oak-watch", author: "admin" });
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('bob', 'Cover bob', 'h_bob', 'member', 'active', '["contribute"]', 't', 't')`);
  const p = promotionOf(x.ctx).promote({ base: null, snapKey: "k-rates", author: "member:bob", ownerMemberId: "bob",
    files: [{ path: "bundle.md", text: projMd("Rates") }], meta: { object_type: "project" } });
  assert.equal(p.ok, true, JSON.stringify(p));
  const up = await captureOf(x.ctx).uploadCapture({ bytes: declaring(usize), statement: "the budget office sent it", name: "big.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", by: "member:bob", at: "2026-10-24T10:00:00Z" });
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
  /* the uploaded capture filed in an information bundle of the project, as a member's promotion files it */
  const capSha = up.capture.sha256, id = "INFO-2026-0001-big", file = "snapshots/big.txt";
  const info = promotionOf(x.ctx).promote({ bundleId: id, base: null, snapKey: "k-big", author: "member:bob", project: p.bundleId,
    files: [{ path: "bundle.md", text: infoMd(id, p.bundleId) }, { path: file, text: `capture big ${capSha}` },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(file, capSha)] }) }],
    meta: { object_type: "information" }, register: [{ sha256: capSha, path: file, encoding: "utf8", bytes: up.capture.bytes }] });
  assert.equal(info.ok, true, JSON.stringify(info).slice(0, 400));
  const body = { captureSha: capSha, question: "What does it cost?", period: "FY2025", project: p.bundleId, by: "member:bob" };
  const res = await x.fetch("/workbookadd?by=member:bob&viewer=member:bob", { method: "POST", body: JSON.stringify(body) });
  const j = await res.json();
  const own = await workbooksOf(x.ctx).addWorkbook(body);
  return { door: j.result ?? j, own: JSON.parse(JSON.stringify(own)) };
}

test("notice workbooks:285 (R6, R7, R97): an xlsx declaring more text than WORKBOOK_DECLARED_TEXT_MAX, added through the store's door, answers workbooks' own WORKBOOK_FILE_TOO_LARGE, condition declared_text, stated on the xlsx.declared_text row, unchanged; control: the same through the owner's own service answers the same", async () => {
  const { door, own } = await added(WORKBOOK_DECLARED_TEXT_MAX + 1);
  assert.equal(door.ok, false, JSON.stringify(door));
  assert.equal(door.reason, "WORKBOOK_FILE_TOO_LARGE", JSON.stringify(door));
  assert.equal(door.condition, "declared_text");
  assert.equal(door.size_bytes, WORKBOOK_DECLARED_TEXT_MAX + 1);
  assert.equal(door.bound_bytes, WORKBOOK_DECLARED_TEXT_MAX);
  assert.equal(door.limit && door.limit.key, "limit.xlsx.declared_text");
  for (const k of Object.keys(own)) assert.deepEqual(door[k], own[k], `the door relays ${k} as workbooks gives it`);
});
