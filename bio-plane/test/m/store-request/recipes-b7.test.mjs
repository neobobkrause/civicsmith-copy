/* store-request R19 (STORE-REQUEST #4, B7 START; SCREENS-INQUIRY #29 J42 (c), (d), (f), STORE-REQUEST #3 J11 (2); op-tables §5.3): the states screens-inquiry's op tables
   still scripted, made by real acts through the world's door: a case published by the real ceremony and imported by another team (accepted, cited, re-run); a conflict between two
   projects told to each project on its own side, asked, revealed and answered; the writing help as the door answers it; the page's `/api/` answered by the world in a browser.
   Each recipe answers what its acts answered. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { storeWorld } from "./fixtures.mjs";

const caps = { capabilities: ["contribute", "create_projects", "publish"] };
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const refusal = (e) => JSON.parse(String(e.message).replace(/^[^{]*/, ""));

test("R19 recipes.published ratifies a case by the real ceremony and answers its case file's parts as anyone fetches them; a member without the publish capability is refused naming publish (control)", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", caps);
  const project = await w.recipes.project(ann, "Potholes");
  const found = await w.recipes.finding(ann, project);
  const made = await w.recipes.published(ann, found);
  assert.equal(made.finding, found.id);
  assert.match(made.case, /^CASE-\d{4}-\d{4}$/);
  assert.equal(made.edition, 1);
  assert.equal(made.ratified.ok, true);
  assert.equal(made.ratified.caseId, made.case);
  assert.deepEqual(made.ratified.roster, [found.id]);
  assert.equal(made.ratified.container.manifest_sha, made.manifest);
  assert.equal(made.parts.length, made.ratified.container.parts);
  assert.ok(made.parts.every((p) => p instanceof Uint8Array && p.length > 0));
  assert.ok(made.parts.every((p) => p[0] === 0x50 && p[1] === 0x4b && Buffer.from(p).includes("manifest.json")), "each part is a ZIP holding the manifest at its root");
  /* the manifest is served by its own hash to anyone */
  const served = await w.door({ url: `/api/?op=publishedbytes&sha256=${made.manifest}` });
  assert.equal(served.status, 200);
  assert.equal(sha256(served.bytes), made.manifest);
  /* control: a member who does not hold publish cannot prepare the case */
  const bo = await w.signIn("bo", { capabilities: ["contribute", "create_projects"] });
  const bp = await w.recipes.project(bo, "No publish");
  const bf = await w.recipes.finding(bo, bp);
  await assert.rejects(() => w.recipes.published(bo, bf), /publish was refused/);
});

test("R19 recipes.imported makes another team's published case, imports its case file by the real act and accepts its finding; without accept the edition stays unaccepted and a question cannot rest on it (control)", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", caps);
  const imp = await w.recipes.imported(ann, {});
  assert.match(imp.import, /^[0-9a-f]{64}$/);
  assert.equal(imp.edition, 1);
  assert.equal(imp.case, imp.source.published.case);
  assert.equal(imp.ref, `imported:${imp.import}/${imp.finding}`);
  assert.equal(imp.imported.group, imp.group);
  assert.equal(imp.imported.case, imp.source.published.case, "the import is of the case the source published");
  assert.deepEqual(imp.imported.recreation.findings.map((f) => [f.finding, f.result]), [[imp.finding, "recreated"]]);
  assert.deepEqual(imp.accepted.findings.map((f) => [f.finding, f.result]), [[imp.finding, "recreated"]]);
  const list = await ann.read("importedcases");
  assert.ok(JSON.stringify(list).includes(imp.import), "the imported case is listed");
  const one = await ann.read("importedcase", { query: { import: imp.import, edition: 1 } });
  assert.equal(one.ok, true);
  assert.ok(JSON.stringify(one).includes(imp.finding));
  /* control: not accepted, a question cannot rest on it */
  const un = await w.recipes.imported(ann, { accept: false });
  assert.equal(un.accepted, null);
  const project = await w.recipes.project(ann, "Resting");
  await assert.rejects(() => w.recipes.cited(ann, project, { from: un }), /IMPORTED_NOT_ACCEPTED/);
});

test("R19 recipes.cited rests a question on another team's accepted finding by the real act and answers its leg; the question's basis names the import and the edition", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", caps);
  const project = await w.recipes.project(ann, "Resting");
  const c = await w.recipes.cited(ann, project, {});
  assert.equal(c.cited.ok, true);
  assert.deepEqual(c.cited.cited, [c.ref]);
  assert.deepEqual(c.cited.legs.map((l) => [l.target, l.target_edition, l.role]), [[c.ref, 1, "supports"]]);
  assert.equal(c.cited.origin.case, c.case);
  assert.equal(c.cited.origin.acceptance.by, "ann");
  const basis = await ann.read("basis", { query: { id: c.question } }).catch(() => null);
  if (basis) assert.ok(JSON.stringify(basis).includes(c.import), "the question's basis names the import");
  /* a second finding's question can rest on the same import: it is held once */
  const again = await w.recipes.cited(ann, project, { from: c, title: "A second question" });
  assert.notEqual(again.question, c.question);
  assert.deepEqual(again.cited.cited, [c.ref]);
});

test("R19 recipes.rerun declares a project a re-run of an accepted import and pairs a finding of its own with the source's; through started stops at the declaration; rerunread shows both", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", caps);
  const r = await w.recipes.rerun(ann, {});
  assert.equal(r.rerun.ok, true);
  assert.equal(r.rerun.project, r.project);
  assert.equal(r.rerun.import, r.import);
  assert.equal(r.pairing.ok, true);
  assert.equal(r.pairing.source_finding, r.ref);
  assert.equal(r.pairing.own_finding, r.own.id);
  assert.equal(r.pairing.withdrawn, false);
  const read = await ann.read("rerunread", { query: { project: r.project } });
  assert.equal(read.reruns.length, 1);
  assert.equal(read.reruns[0].import, r.import);
  assert.deepEqual(read.reruns[0].findings.map((f) => [f.ref, f.paired, f.pairings.map((p) => p.own_finding)]), [[r.ref, true, [r.own.id]]], "the project's own finding is paired beside the source's");
  /* the pairing is withdrawn by the same act */
  const gone = await ann.act("rerunpair", { body: { project: r.project, source_finding: r.ref, own_finding: r.own.id, edition: r.edition, withdraw: true } });
  assert.equal(gone.withdrawn, true);
  /* control: declared and not paired */
  const s = await w.recipes.rerun(ann, { through: "started" });
  assert.equal(s.pairing, null);
  assert.equal(s.own, null);
  const none = await ann.read("rerunread", { query: { project: s.project } });
  assert.deepEqual(none.reruns[0].findings.map((f) => [f.ref, f.paired, f.pairings]), [[s.ref, false, []]], "no finding of her own is paired");
  await assert.rejects(() => w.recipes.rerun(ann, { through: "nowhere" }), /goes through "started" or "paired"/);
});

test("R19 recipes.conflict makes a conflict between two hidden projects by real acts: each project's members are told of an unseen record on their own side, and the member of both sees it whole", async () => {
  const w = await storeWorld({ ai: true });
  const admin = await w.signIn("admin");
  const c = await w.recipes.conflict(admin, {});
  const [a, b] = c.members, [pa, pb] = c.projects;
  assert.equal(c.proposal.candidates[0].key, "K3");
  assert.equal(c.proposal.candidates[0].candidate, c.candidate);
  assert.equal(c.inquiries.length, 2);
  const na = (await a.read("contradictionnotices", { query: { project: pa } })).notices;
  const nb = (await b.read("contradictionnotices", { query: { project: pb } })).notices;
  assert.equal(na.length, 1);
  assert.equal(nb.length, 1);
  assert.deepEqual([na[0].candidate, na[0].project, na[0].weight, na[0].state], [c.candidate, pa, "duty", "open"]);
  assert.equal(na[0].side.inquiry, c.inquiries[0]);
  assert.equal(nb[0].side.inquiry, c.inquiries[1]);
  assert.notEqual(na[0].side.claim, nb[0].side.claim, "each project concluded in its own words");
  assert.deepEqual([na[0].opted_in, na[0].asked_by_another, na[0].revealed], [null, false, false]);
  for (const leak of [pb, c.inquiries[1], nb[0].side.claim]) assert.ok(!JSON.stringify(na).includes(leak), "the other side is not told: " + leak);
  /* the member of both projects sees the conflict whole: a candidate, not a notice */
  assert.deepEqual((await c.principal.read("contradictionnotices", { query: { project: pa } })).notices, []);
  const whole = await c.principal.read("contradictioncandidates", { query: { candidate: c.candidate } });
  assert.deepEqual(whole.candidates.map((x) => x.candidate), [c.candidate]);
  /* controls */
  await assert.rejects(() => w.recipes.conflict(admin, { through: "nowhere" }), /goes through one of notice, asked, revealed, responded/);
  const bare = await storeWorld();
  await assert.rejects(async () => bare.recipes.conflict(await bare.signIn("admin"), {}), /storeWorld\(\{ ai: true \}\)/);
});

test("R19 recipes.conflict goes on by the real acts: the first project asks (the second is told only that another asked), the second asks (the projects are named to each other) and a member responds (the other project receives only what she shared)", async () => {
  const w = await storeWorld({ ai: true });
  const admin = await w.signIn("admin");
  const asked = await w.recipes.conflict(admin, { through: "asked" });
  const [a, b] = asked.members, [pa, pb] = asked.projects;
  assert.equal(asked.optIns.length, 1);
  assert.equal(asked.optIns[0].project, pa);
  const ma = (await a.read("contradictionnotices", { query: { project: pa } })).notices[0];
  const mb = (await b.read("contradictionnotices", { query: { project: pb } })).notices[0];
  assert.equal(ma.opted_in.member, `member:${a.member}`);
  assert.deepEqual([mb.opted_in, mb.asked_by_another, mb.revealed], [null, true, false]);
  assert.ok(!JSON.stringify(mb).includes(pa), "the asking project is not named");
  const rev = await w.recipes.conflict(admin, { through: "revealed" });
  assert.equal(rev.optIns.length, 2);
  const [ra, rb] = rev.members, [rpa, rpb] = rev.projects;
  const na = (await ra.read("contradictionnotices", { query: { project: rpa } })).notices[0];
  const nb = (await rb.read("contradictionnotices", { query: { project: rpb } })).notices[0];
  assert.equal(na.revealed, true);
  assert.deepEqual(na.parties.map((p) => p.id), [rpb]);
  assert.deepEqual(nb.parties.map((p) => p.id), [rpa]);
  assert.ok(!JSON.stringify(nb).includes(rev.inquiries[0]), "revealed, the other project's side stays withheld");
  const done = await w.recipes.conflict(admin, { through: "responded" });
  const [xa, xb] = done.members, [xpa, xpb] = done.projects;
  assert.equal(done.response.shared.cover, true);
  const mine = await xa.read("contradictionresponses", { query: { candidate: done.candidate, project: xpa } });
  assert.deepEqual(mine.responses.map((r) => [r.own, r.text]), [[true, "Our reading rests on the fee schedule."]]);
  const theirs = await xb.read("contradictionresponses", { query: { candidate: done.candidate, project: xpb } });
  assert.deepEqual(theirs.responses.map((r) => [r.own, r.text, r.project.id]), [[false, "Our reading rests on the fee schedule.", xpa]]);
  assert.ok(theirs.responses[0].cover.includes("alpha"), "the cover she chose to share is relayed");
  assert.ok(!("author" in theirs.responses[0]) && !JSON.stringify(theirs).includes("member:"), "her member id is not relayed");
  const notice = (await xb.read("contradictionnotices", { query: { project: xpb } })).notices[0];
  assert.deepEqual(notice.responses.map((r) => r.text), ["Our reading rests on the fee schedule."]);
});


test("R19 recipes.assistant sets up the team's Claude account by an administrator's real acts and recipes.writingHelp answers as the door does: no account, nothing told, an act never helped, and past every refusal the draft the world cannot ask for", async () => {
  const w = await storeWorld({ ai: true });
  const admin = await w.signIn("admin");
  const ann = await w.signIn("ann", caps);
  /* before: no Claude account serves her */
  const before = await w.recipes.writingHelp(ann, {});
  assert.equal(before.reason, "NO_ACCOUNT");
  const set = await w.recipes.assistant(admin, { readers: [ann] });
  assert.equal(set.assistant.on, true);
  assert.equal(set.key.on, true);
  assert.equal(set.key.held, true);
  const help = await w.recipes.writingHelp(ann, { op: "contradictionclarify", field: "explanation", told: "The notice is later." });
  assert.equal(help.reason, "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.equal(help.text, undefined, "the draft is asked of the Worker's assistant object, which the world does not hold");
  assert.equal((await w.recipes.writingHelp(ann, { op: "contradictionclarify", field: "explanation", told: "" })).reason, "WRITING_HELP_NOTHING_TOLD");
  assert.equal((await w.recipes.writingHelp(ann, { op: "contradictionresolve", field: "conclusion", told: "They differ in time." })).reason, "WRITING_HELP_REFUSED");
  /* a member who has not read the notice of the team's key is not served */
  const bo = await w.signIn("bo", caps);
  assert.equal((await w.recipes.writingHelp(bo, {})).reason, "GROUP_KEY_NOTICE_DUE");
  /* control: a world without the team's account sealed cannot set it up */
  const bare = await storeWorld();
  await assert.rejects(async () => bare.recipes.assistant(await bare.signIn("admin")), /storeWorld\(\{ ai: true \}\)/);
});

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  for (const home of ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"])) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}

test("R18 world.route answers a browser page's /api/ requests from the world's door, as the member signed in: a read, an act that changes the world, a refusal, and the file the store serves", async () => {
  const pw = engine();
  const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/): this test cannot drive a browser without it");
  assert.ok(existsSync(exe), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const w = await storeWorld();
  assert.equal(typeof w.route, "function", "the world answers a page's /api/ requests");
  const admin = await w.signIn("admin");
  const ann = await w.signIn("ann", caps);
  const project = await w.recipes.project(ann, "Stormwater");
  const browser = await pw.chromium.launch({ executablePath: exe });
  try {
    const page = await (await browser.newContext()).newPage();
    const asOf = (who) => page.route("**/*", (route) => (new URL(route.request().url()).pathname.startsWith("/api")
      ? w.route(who)(route) : route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>page</title>" })));
    await asOf(ann);
    await page.goto("https://group.example/app");
    const seen = await page.evaluate(async () => {
      const call = async (op, init) => { const r = await fetch("/api/?op=" + op, init); return { status: r.status, json: await r.json() }; };
      return { whoami: await call("whoami"), project: await call("projectlist"), unknown: await call("nosuchop"),
               promote: await call("allocid&prefix=INQ&year=2026") };
    });
    const mine = await ann.read("whoami");
    assert.deepEqual(seen.whoami.json.result, mine, "the page was answered as ann, the world's own whoami");
    assert.equal(seen.whoami.json.result.member, "ann");
    assert.ok(JSON.stringify(seen.project.json).includes(project), "the world's project list reaches the page");
    assert.equal(seen.unknown.status, 400);
    assert.equal(seen.unknown.json.reason, "UNKNOWN_OP");
    assert.match(seen.promote.json.result.id, /^INQ-2026-\d{4}$/);
    /* an act sent by the page changes the world */
    const named = await page.evaluate(async () => { const r = await fetch("/api/?op=memberlanguageset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: "en" }) }); return r.status; });
    assert.ok(named < 500);
    /* control: the same page as a member without the capability is refused as the world refuses her */
    await page.unroute("**/*");
    await asOf(admin);
    const as = await page.evaluate(async () => (await (await fetch("/api/?op=whoami")).json()).result.member);
    assert.equal(as, "admin", "routed as the administrator, the page is answered as her");
    /* the bytes of a file the store serves cross whole */
    const found = await w.recipes.finding(ann, project);
    const made = await w.recipes.published(ann, found);
    await page.unroute("**/*");
    await asOf(ann);
    const bytes = await page.evaluate(async (sha) => { const r = await fetch("/api/?op=publishedbytes&sha256=" + sha); return { status: r.status, type: r.headers.get("content-type"), sha: await crypto.subtle.digest("SHA-256", await r.arrayBuffer()).then((d) => [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("")) }; }, made.manifest);
    assert.equal(bytes.status, 200);
    assert.equal(bytes.sha, made.manifest, "the manifest crosses whole, byte for byte");
  } finally { await browser.close(); }
});
