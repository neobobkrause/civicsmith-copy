/* control-plane R100 (csv-reader R26, fix round 10; K5138, K5148; WALK-FINAL-06 cause 1): the walker's case through the real door. A member uploads `comma-minutes.txt`, four lines of
   prose with a comma on three of them, declared plain text: the file is read as prose (the reading carries no `cells` and no `dialect`), not as a table whose columns are the clauses.
   Controls: a real three-column CSV named `.txt` is still read as a table (`dialect`, `cells`); the same prose declared `text/csv` keeps csv-reader R7's presence rule and is a table. Run
   against the Miniflare plane (the seam kit), the bytes the member's own upload sent. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { makeKit } from "./r8-kit.mjs";

const kit = makeKit({ tag: "r10csvprose" });
after(() => kit.mf.dispose());

const MINUTES = [
  "The board met at 7 pm, with all members present, and approved the agenda.",
  "Ms. Reyes, the treasurer, reported a balance of $4,200.",
  "After a long discussion, the members agreed, by a show of hands, to postpone the vote, pending a legal opinion.",
  "The meeting adjourned at nine.", ""].join("\n");
/* csv-reader R27 (amends R26): declared plain text is a table only from 5 records, with fields under 40 characters on average */
const THREE_COLUMNS = "id,name,amount\n1,Ann,10\n2,Bo,20\n3,Cy,30\n4,Di,40\n5,Ed,50\n";

async function upload(auth, name, type, text) {
  const res = await kit.plane(`/api/?op=captureupload&statement=${encodeURIComponent("r10csvprose")}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    { method: "POST", headers: auth, body: kit.te(text) });
  const body = await res.json();
  assert.equal(body.result?.ok, true, JSON.stringify(body).slice(0, 400));
  return body.result.document.reading ?? {};
}

test("R100 (csv-reader R26, R27): prose with commas on most lines, uploaded as comma-minutes.txt (text/plain), is read as prose: no cells, no dialect (controls: a real CSV named .txt and the prose declared text/csv are tables)", { timeout: 300000 }, async () => {
  const own = await kit.ownerOf("r10csvprose-ann");
  const prose = await upload(own.auth, "comma-minutes.txt", "text/plain", MINUTES);
  assert.equal("cells" in prose, false, `read as prose, no table cells: ${Object.keys(prose).join(",")}`);
  assert.equal("dialect" in prose, false, "no dialect: no delimiter was decided");
  const table = await upload(own.auth, "table.txt", "text/plain", THREE_COLUMNS);
  assert.ok("dialect" in table && "cells" in table, `a real three-column CSV named .txt is a table: ${Object.keys(table).join(",")}`);
  const declared = await upload(own.auth, "comma-minutes-declared.txt", "text/csv", MINUTES);
  assert.ok("dialect" in declared, "the prose declared text/csv keeps the presence rule (csv-reader R7)");
});
