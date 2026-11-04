/* R17: the listed groups exclude a standing withdrawal. The register is drawn in the shape `stewards` R13 gives it
 * (`GET /steward/withdrawals`: `{register, sha256}`, the register's canonical JSON, keys sorted, and its SHA-256), made
 * here by the test's own steps (withdraw, reinstate) because the site does not use the stewards module (BOB, PR #79's
 * gate: no import of stewards' fixture). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { word } from "../../bio-plane/src/setup-words/index.mjs";
import worker, { check, withdrawn, ConfigError } from "../src/index.mjs";
import { parse, find, esc } from "../build.mjs";

const GROUP_A = { name: "Group A", place: "Place A", focus: "Focus A", cases: 1, address: "https://a.example/" };
const GROUP_B = { name: "Group B", place: "Place B", focus: "Focus B", cases: 2, address: "https://b.example/" };
const BASE = { INSTALLER_ADDRESS: "https://install.example/", LISTED_GROUPS: JSON.stringify([GROUP_A, GROUP_B]) };
const CHECK = new URL("../check.mjs", import.meta.url).pathname;

const cls = (e) => (e.attrs.class || "").split(/\s+/).filter(Boolean);
const textOf = (n) => (typeof n === "string" ? n : n.kids.map(textOf).join(""));
async function groups(env) {
  const r = await worker.fetch(new Request("https://site.example/groups"), env);
  const t = await r.text();
  const main = find(parse(t.slice(t.indexOf("<main"), t.lastIndexOf("</main>") + 7)), (e) => e.tag === "main")[0];
  return { status: r.status, t, rows: main ? find(main, (e) => cls(e).includes("cs-row")).map(textOf) : [] };
}

/* The stewards' register as R13 answers it: each standing withdrawal `{service, item, since, ref, kind}`, newest first. */
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
    : JSON.stringify(v));
function stewards() {
  let standing = [], t = Date.UTC(2026, 10, 1);
  const register = () => {
    const body = canonical(standing);
    return canonical({ register: standing, sha256: createHash("sha256").update(body).digest("hex") });
  };
  return {
    withdraw: (item, service = "public_listing") => {
      standing = [{ service, item, since: (t += 1000), ref: `r-${standing.length + 1}`, kind: "spam" }, ...standing];
      return register();
    },
    reinstate: (item, service = "public_listing") => {
      standing = standing.filter((x) => !(x.service === service && x.item === item));
      return register();
    },
  };
}

/* The deploy check as Bob's deploy runs it (`npm run deploy` runs it first): over a deploy configuration with these vars. */
function deployCheck(vars) {
  const dir = mkdtempSync(join(tmpdir(), "site-check-"));
  const cfg = join(dir, "wrangler.jsonc");
  writeFileSync(cfg, `// a deploy configuration\n${JSON.stringify({ name: "civicsmith-site", vars }, null, 2)}\n`);
  return spawnSync(process.execPath, [CHECK, cfg], { encoding: "utf8", timeout: 60_000 });
}

test("R17: two listed groups and a register withdrawing one draw one row and no word of the other; after reinstatement both draw; a malformed register fails the deploy check", async () => {
  const st = stewards();
  const reg = await st.withdraw(GROUP_B.address);
  assert.deepEqual([...(await withdrawn({ WITHDRAWAL_REGISTER: reg }))], [GROUP_B.address]);

  const one = await groups({ ...BASE, WITHDRAWAL_REGISTER: reg });
  assert.equal(one.status, 200);
  assert.equal(one.rows.length, 1);
  assert.ok(one.rows[0].includes(GROUP_A.name));
  /* no trace of the withdrawn row: its name, place, focus or address, and no word of a withdrawal */
  for (const x of [GROUP_B.name, GROUP_B.place, GROUP_B.focus, GROUP_B.address]) assert.ok(!one.t.includes(esc(x)), x);
  assert.doesNotMatch(one.t, /withdr|reinstat|public_listing/i);
  /* the listed state still: its listing note */
  assert.ok(one.t.includes(esc(word("screen.site.groups.listing"))));
  /* the deploy check passes it */
  const ok = deployCheck({ ...BASE, WITHDRAWAL_REGISTER: reg });
  assert.equal(ok.status, 0, ok.stderr);

  /* every listed group withdrawn: R13's empty state, no row and no listing note */
  const both = await groups({ ...BASE, LISTED_GROUPS: JSON.stringify([GROUP_B]), WITHDRAWAL_REGISTER: reg });
  assert.equal(both.rows.length, 0);
  assert.ok(both.t.includes(esc(word("screen.site.groups.none"))));
  assert.ok(!both.t.includes(esc(word("screen.site.groups.listing"))));

  /* reinstatement: the register empty, both rows draw */
  const after = await st.reinstate(GROUP_B.address);
  assert.equal(JSON.parse(after).register.length, 0);
  const two = await groups({ ...BASE, WITHDRAWAL_REGISTER: after });
  assert.equal(two.rows.length, 2);
  assert.ok(two.rows[1].includes(GROUP_B.name));

  /* a withdrawal of another service, even naming the same identifier, withdraws no listing */
  const other = await st.withdraw(GROUP_B.address, "template_library");
  assert.equal((await groups({ ...BASE, WITHDRAWAL_REGISTER: other })).rows.length, 2);

  /* malformed: not JSON, not the stewards' shape, an entry out of shape, or a digest not the register's own */
  const real = JSON.parse(reg);
  const malformed = [
    "{", "[]", "null", JSON.stringify({ register: real.register }), JSON.stringify({ ...real, extra: 1 }),
    JSON.stringify({ ...real, sha256: "0".repeat(64) }),
    JSON.stringify({ ...real, register: [...real.register, { ...real.register[0], item: "https://c.example/" }] }),
    JSON.stringify({ ...real, register: [{ ...real.register[0], item: "" }] }),
    JSON.stringify({ ...real, register: [{ ...real.register[0], since: "today" }] }),
    reg.replace(GROUP_B.address, GROUP_A.address),
  ];
  for (const bad of malformed) {
    const r = deployCheck({ ...BASE, WITHDRAWAL_REGISTER: bad });
    assert.equal(r.status, 1, bad);
    assert.match(r.stderr, /site deploy check failed: site: WITHDRAWAL_REGISTER/, bad);
    await assert.rejects(check({ ...BASE, WITHDRAWAL_REGISTER: bad }), ConfigError, bad);
    /* never the listing drawn whole */
    const g = await groups({ ...BASE, WITHDRAWAL_REGISTER: bad });
    assert.equal(g.status, 500, bad);
    assert.ok(!g.t.includes(esc(GROUP_B.name)));
  }
  /* the check names the fault and prints no value */
  const r = deployCheck({ ...BASE, WITHDRAWAL_REGISTER: reg.replace(GROUP_B.address, GROUP_A.address) });
  assert.ok(!r.stderr.includes(GROUP_A.address));
});

test("R17 control: with no register both rows draw and R13's empty-state rules hold", async () => {
  for (const unset of [undefined, null, ""]) {
    const env = { ...BASE, WITHDRAWAL_REGISTER: unset };
    assert.equal((await withdrawn(env)).size, 0);
    const g = await groups(env);
    assert.equal(g.rows.length, 2);
    assert.ok(g.t.includes(esc(word("screen.site.groups.listing"))));
    assert.doesNotMatch(g.t, /withdr|reinstat/i);
    const empty = await groups({ ...env, LISTED_GROUPS: "[]" });
    assert.equal(empty.rows.length, 0);
    assert.ok(empty.t.includes(esc(word("screen.site.groups.none"))));
    assert.ok(!empty.t.includes(esc(word("screen.site.groups.listing"))));
  }
  /* the deploy configuration in this directory passes its own check */
  const r = spawnSync(process.execPath, [CHECK], { encoding: "utf8", timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  /* and `npm run deploy` runs the check first */
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.predeploy, "node check.mjs");
});
