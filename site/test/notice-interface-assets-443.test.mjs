/* Provider notice interface-assets:443 (PR 443, interface-assets F1): every text entry of ASSET_FILES now holds its
 * body behind a getter built on its first read, as the faces already did, and index.mjs is written in ASCII with the
 * values unchanged. The site reads only `.type`, `.encoding` and `.body`, so it serves each file unchanged (R8, R9).
 * Answer: confirmed, no code change. This test pins the site's side: each text file is served, on two requests,
 * byte for byte its body, with a non-ASCII character (the stylesheet's own) kept as UTF-8. */
import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_FILES } from "../../bio-plane/src/interface-assets/index.mjs";
import worker from "../src/index.mjs";

const ENV = { INSTALLER_ADDRESS: "https://install.example/start", LISTED_GROUPS: "[]" };
const get = (path) => worker.fetch(new Request(`https://site.example${path}`), ENV);

test("interface-assets:443: each text file, its body now read through a getter, is served byte for byte on every request", async () => {
  const texts = Object.entries(ASSET_FILES).filter(([, f]) => f.encoding !== "base64");
  assert.ok(texts.length >= 3);
  let nonAscii = 0;
  for (const [name, f] of texts) {
    const want = Buffer.from(f.body, "utf8");
    if (/[^\x00-\x7f]/.test(f.body)) nonAscii++;
    for (let i = 0; i < 2; i++) {
      const r = await get(`/app/assets/${name}`);
      assert.equal(r.status, 200, name);
      assert.ok(Buffer.from(await r.arrayBuffer()).equals(want), `${name} (request ${i + 1})`);
    }
  }
  assert.ok(nonAscii > 0, "a text file keeps a non-ASCII character, served as UTF-8");
});
