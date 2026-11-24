/* control-plane (fix round 8, K4427; R-SEAM, R-ONE): THE SEAM KIT. The helpers the round's through-the-door tests share, taken from `t51-round7-seam.test.mjs` as they stand (a member made by the
   founder's `memberadd` and her own `enroll` and `login`; a project and a question by the screens' own acts; a prepared case edition and its sitting; a fetch served at a scripted pace),
   over a Miniflare plane of its own: `makeKit({tag, counting, bindings, outbound})` answers `{mf, plane, ...helpers}`. `counting: true` runs the counting door (`wrap-entry.mjs`) in place of the
   plane's entry, so every answer carries `x-wrap-calls`. The caller disposes `mf` (`after(() => kit.mf.dispose())`). Inputs are made by the member's acts, never by a hand-written answer. */
import "../../sandbox.mjs";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { PARTS } from "../../../src/screens-publish/parts.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import "./register-declared.mjs";
import { wrapScript } from "./wrap-entry.mjs";

const SRC = fileURLToPath(new URL("../../../src/plane/index.mjs", import.meta.url));
export const MB = 1024 * 1024;
export const BIAS = "This group holds that contracts should be adopted in public session.";

export function makeKit({ tag = "r8kit", counting = false, bindings = {}, outbound = null, serviceBindings = null, workers = null } = {}) {
  const ADM = `adm-${tag}-0123456789abcdef`, PASSWORD = `the founder's long password, ${tag}`, ORIGIN = "https://group.example";
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const later = (ms) => new Promise((r) => setTimeout(r, ms));
  const te = (t) => new TextEncoder().encode(t);
  /* the network: a file by its last path segment, served at once or throttled, with its Content-Length or without */
  const upstream = new Map();
  function serve(name, bytes, { rate = null, length = true, type = "application/pdf", disposition = null } = {}) { upstream.set(name, { bytes, rate, length, type, disposition }); }
  function slowBody(bytes, rate) {
    const chunk = 64 * 1024;
    let at = 0;
    return new ReadableStream({
      async pull(c) {
        if (at >= bytes.length) { c.close(); return; }
        const end = Math.min(at + chunk, bytes.length);
        c.enqueue(bytes.subarray(at, end));
        at = end;
        await later((chunk / rate) * 1000);
      },
    }, new CountQueuingStrategy({ highWaterMark: 0 }));
  }
  let founderOnce = null;
  async function founder() {
    if (founderOnce) return founderOnce;
    await (await plane("/api/?op=claim", { method: "POST", body: JSON.stringify({ bootstrapToken: ADM, password: PASSWORD }) })).arrayBuffer();
    const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "admin", password: PASSWORD, device: "own" }) })).json();
    assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
    return (founderOnce = { authorization: `Bearer ${signed.result.token}` });
  }
  /* a member made as the screens make one: the founder invites (`memberadd`), the person enrols with the invitation, then signs in */
  const people = new Map();
  async function person(handle, role = "member", capabilities = null) {
    if (people.has(handle)) return people.get(handle);
    const adm = await founder();
    /* making an administrator is "changing administrators", which asks for the password again (C-29.42): the founder
       gives it first, as the screens do (`reauth`) */
    if (role === "admin") {
      const ra = await (await plane("/api/?op=reauth", { method: "POST", headers: { ...adm, "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) })).json();
      assert.equal(ra.ok, true, "the founder's password again: " + JSON.stringify(ra).slice(0, 300));
    }
    const added = await (await plane("/api/?op=memberadd", { method: "POST", headers: { ...adm, "content-type": "application/json" },
      body: JSON.stringify({ memberId: handle, cover: `cover of ${handle}`, role, capabilities }) })).json();
    const invite = added.result && (added.result.invite || (added.result.invitation && added.result.invitation.invite));
    assert.ok(invite, "an invitation: " + JSON.stringify(added).slice(0, 400));
    const pw = `${handle}-long-passphrase-r7`;
    const enrolled = await (await plane("/api/?op=enroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invite, handle, password: pw }) })).json();
    assert.equal(enrolled.ok, true, "enrolled: " + JSON.stringify(enrolled).slice(0, 400));
    const signed = await (await plane("/api/?op=login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle, password: pw, device: "own" }) })).json();
    assert.equal(signed.ok, true, "signed in: " + JSON.stringify(signed).slice(0, 400));
    const auth = { authorization: `Bearer ${signed.result.token}` };
    people.set(handle, auth);
    return auth;
  }
  const screenCall = (auth) => ({ now: () => Date.now(), digest: async (s) => createHash("sha256").update(s).digest("hex"),
    call: async (op, { query = {}, body } = {}) => (await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: body === undefined ? "GET" : "POST",
      headers: { ...auth, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json() });
  const get = async (auth, query) => (await plane(`/api/?${new URLSearchParams(query)}`, { headers: auth })).json();
  const post = async (auth, op, body, query = {}) => {
    const res = await plane(`/api/?${new URLSearchParams({ op, ...query })}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  async function until(fn, ms, every = 3000) {
    const end = Date.now() + ms;
    let v = await fn();
    while (Date.now() < end && !v) { await later(every); v = await fn(); }
    return v;
  }
  /* a PDF of `bytes` bytes whose one page of text says `words`, filled out by a stream no page names */
  function pdfOf(words, bytes) {
    const pad = new Uint8Array(Math.max(0, bytes - 1500));
    let x = 0x9e3779b9;
    for (let i = 0; i < pad.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; pad[i] = 0x41 + ((x >>> 24) % 26); }
    const stream = (n, dict, data) => [te(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`), data, te("\nendstream\nendobj\n")];
    const plain = (n, body) => [te(`${n} 0 obj\n${body}\nendobj\n`)];
    const toUni = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";
    const parts = [te("%PDF-1.7\n"), ...plain(1, "<< /Type /Catalog /Pages 2 0 R >>"), ...plain(2, "<< /Type /Pages /Kids [100 0 R] /Count 1 >>"),
      ...plain(10, `<< /Type /Font /Subtype /TrueType /BaseFont /Plain /FirstChar 32 /Widths [${Array(95).fill(500).join(" ")}] /ToUnicode 11 0 R >>`), ...stream(11, "", te(toUni)),
      ...plain(100, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 10 0 R >> >> /Contents 101 0 R >>"),
      ...stream(101, "", te(`BT /F1 12 Tf 72 700 Td (${words}) Tj ET`)), ...stream(500, "", pad), te("trailer\n<< /Root 1 0 R >>\n%%EOF\n")];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const acquire = async (auth, body) => {
    const t = Date.now();
    const res = await plane("/api/?op=acquire", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ms: Date.now() - t, status: res.status, body: await res.json() };
  };
  async function projectOf(auth, title) {
    const cs = screenCall(auth);
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const made = await cs.call("promote", { body: { base: null, snapKey: iso.replace(/[-:]/g, "") + "_00c0ffee", meta: { object_type: "project", title, current_state: "forming", created: iso, last_updated: iso },
      files: [{ path: "bundle.md", text: `---\nobject_type: project\ntitle: "${title}"\nobjective: "${title}"\ncurrent_state: forming\ncreated: "${iso}"\nlast_updated: "${iso}"\n---\n\n## Session Log\n\n### Session ${iso} | Formation | interactive\nTrigger: the seam test\nChanges: created.\n` }], register: [], visibility: "hidden" } });
    const id = (made.result && made.result.bundleId) || made.bundleId;
    assert.ok(id, "the project is made: " + JSON.stringify(made).slice(0, 300));
    return id;
  }
  /* ---- the owner's chain: project, upload, vouch, question, citation, conclusion, case edition ---- */

  /* a member who may create projects and publish (the vocabulary the whoami lists), made as `person` makes one */
  const owners = new Map();
  async function ownerOf(handle) {
    if (owners.has(handle)) return owners.get(handle);
    const adm = await founder();
    const added = await post(adm, "memberadd", { memberId: handle, cover: `cover of ${handle}`, role: "member", capabilities: ["contribute", "publish", "create_projects"] });
    const invite = added.body.result && (added.body.result.invite || (added.body.result.invitation && added.body.result.invitation.invite));
    assert.ok(invite, "an invitation: " + JSON.stringify(added.body).slice(0, 400));
    const pw = `${handle}-long-passphrase-r7`;
    const enrolled = await post({}, "enroll", { invite, handle, password: pw });
    assert.equal(enrolled.body.ok, true, "enrolled: " + JSON.stringify(enrolled.body).slice(0, 400));
    const signed = await post({}, "login", { handle, password: pw, device: "own" });
    assert.equal(signed.body.ok, true, "signed in: " + JSON.stringify(signed.body).slice(0, 400));
    const auth = { authorization: `Bearer ${signed.body.result.token}` };
    owners.set(handle, { auth, password: pw });
    return owners.get(handle);
  }
  /* an Ed25519 SSH signer (PROTOCOL.sshsig), as the signer kit signs a sitting; as test/m/ratification/fixture.mjs makes one */
  const u8 = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const sstr = (v) => { const b = typeof v === "string" ? te(v) : v; return u8(u32(b.length), b); };
  const armor = (blob) => `-----BEGIN SSH SIGNATURE-----\n${Buffer.from(blob).toString("base64").replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;
  async function newKey() {
    const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
    return { priv: kp.privateKey, raw, keyB64: Buffer.from(u8(sstr("ssh-ed25519"), sstr(raw))).toString("base64") };
  }
  async function signText(key, message, namespace) {
    const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", te(message)));
    const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, u8(te("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h))));
    return armor(u8(te("SSHSIG"), u32(1), sstr(u8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
  }
  const R = (a) => (a && a.result !== undefined ? a.result : a);

  /* "Open a question" on the project page: `allocid`, `promote` of the inquiry document, then `drawquestion` (src/screens-inquiry/project.mjs `promote`) */
  async function questionOf(auth, project, question) {
    const cs = screenCall(auth);
    const title = question.replace(/\s+/g, " ").slice(0, 120);
    const now = new Date().toISOString().split(".")[0] + "Z";
    const a = R(await cs.call("allocid", { query: { prefix: "INQ", year: String(new Date().getUTCFullYear()) } }));
    assert.ok(a && a.id, "an id: " + JSON.stringify(a));
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-+$/, "");
    const id = a.id + (slug ? "-" + slug : "");
    const lines = ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", "title: " + JSON.stringify(title), "current_state: open", "prior_state: null",
      "created: " + now, "last_updated: " + now, "project: " + project, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []",
      "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "surfaced_by: human", "recheck_triggers:",
      "  - text: " + JSON.stringify(word("file.recheck.revisit")), "    description: " + JSON.stringify(word("file.recheck.none")), "---", ""];
    ["## Question", word("conformance.rests"), "## Conclusion", word("conformance.falsify"), "## Session Log", "## Review Notes"].forEach((h, i) => { lines.push(h, ""); if (i === 0) lines.push(question, ""); });
    const stamp = now.replace(/[-:]/g, "") + "_" + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    const p = await cs.call("promote", { body: { bundleId: id, base: null, snapKey: stamp, meta: { object_type: "inquiry", title, current_state: "open", created: now, last_updated: now }, files: [{ path: "bundle.md", text: lines.join("\n") }] } });
    assert.ok(p.ok !== false && R(p).ok !== false, "the question is filed: " + JSON.stringify(p).slice(0, 400));
    const d = await cs.call("drawquestion", { query: { project, inquiry: id, note: "" } });
    assert.ok(d.ok !== false && R(d).ok !== false, "the project draws on it: " + JSON.stringify(d).slice(0, 400));
    return id;
  }

  /* G60: a member's own revision of her filed document under a snap key the history cannot name (a promotion's `snapKey` is any non-blank string; the history
     files it writes are named by it, and C-12.2 maps each back to a manifest entry by the stamp's shape). The record keeps it; the case gate, which reads each
     cited member's image at signing, finds it. The revision carries the document's stored bytes by their address, as the screens carry them. */
  async function reviseUnnamed(cs, bundle, size) {
    const img = R(await cs.call("image", { query: { id: bundle } }));
    const row = R(await cs.call("list", {})).find((b) => b.bundle_id === bundle);
    assert.ok(row && row.bundle_sha, "the document's head: " + JSON.stringify(row));
    const files = Object.keys(img).filter((k) => !k.startsWith("_history/")).map((path) => ({ path,
      ...(path === "bundle.md" ? { text: img[path] + "\n" } : path.startsWith("snapshots/upload-") ? { blobSha: path.slice(17), sha256: path.slice(17), bytes: size } : { text: img[path] }) }));
    const done = R(await cs.call("promote", { body: { bundleId: bundle, base: row.bundle_sha, snapKey: "not-a-stamp", meta: { object_type: "information" }, files } }));
    assert.equal(done.ok, true, "the revision is kept: " + JSON.stringify(done).slice(0, 400));
  }

  /* the owner's own chain to a prepared case edition: a text uploaded and filed in her project, vouched or not, one sentence of it cited in a question she opened and
     concluded, the case drafted in the editor and prepared by the ceremony's `publish` (src/screens-publish/case-editor.mjs, ceremony.mjs) */
  const BIAS = "This group holds that contracts should be adopted in public session.";
  async function preparedEdition(handle, tag, { vouch, prepare = true, spoil = false }) {
    const { auth, password } = await ownerOf(handle);
    const cs = screenCall(auth);
    const project = await projectOf(auth, `Round seven ${tag} project`);
    /* a 356-byte text, two paragraphs, made distinct by the tag (its upload's own snapshot file is `snapshots/upload-<sha>`, dotless) */
    const first = "The clerk stamped the amended contract RECEIVED before the council voted on it.";
    const body = [first, `The minutes of the meeting were filed on Tuesday morning, and the register ${tag} was signed by the deputy clerk, the city attorney and the chair of the council.`];
    let text = body.join("\n\n");
    text += " ".repeat(Math.max(0, 356 - te(text).length));
    const bytes = te(text);
    const up = (await (await plane(`/api/?op=captureupload&statement=${encodeURIComponent(tag)}&name=${encodeURIComponent(tag + "-minutes")}&type=text%2Fplain`, { method: "POST", headers: auth, body: bytes })).json()).result;
    assert.equal(up.ok, true, JSON.stringify(up).slice(0, 400));
    assert.equal(up.document.file, "snapshots/upload-" + sha(bytes), "the upload's own snapshot file is dotless");
    const filed = await CAPTURE_SCREEN.parts.promoteDocument(cs, { doc: up.document, title: `${tag}-minutes`, locator: up.document.locator, project });
    assert.equal(filed.refused, undefined, JSON.stringify(filed).slice(0, 400));
    const bundle = filed.bundleId;
    if (vouch) {
      /* the Document screen's "Confirm": `select` the document, then `release` with the handle, her acknowledgment and her mitigation (document.mjs `release`) */
      const sel = R(await cs.call("select", { body: { ids: [bundle] } }));
      assert.ok(sel && sel.handle, "a selection: " + JSON.stringify(sel).slice(0, 300));
      const rel = await cs.call("release", { query: { handle: sel.handle, acknowledgment: "I checked this file is the minutes as filed.", mitigation: "Nothing in it names a private person." } });
      assert.ok(rel.ok !== false && R(rel).ok !== false && R(rel).released.includes(bundle), "vouched: " + JSON.stringify(rel).slice(0, 400));
    }
    if (spoil) await reviseUnnamed(cs, bundle, bytes.length);
    const question = await questionOf(auth, project, "Did the clerk stamp the contract before the vote?");
    /* Find in this document (a term), then "Cite in the question" the one sentence found (document.mjs `cite`: project = the question, role, found) */
    const found = R(await cs.call("findin", { body: { scope: { capture: sha(bytes) }, kinds: ["term"], term: "stamped the amended contract" } }));
    const item = found.kinds[0].items[0];
    assert.equal(item.words, first, "one sentence of the document is found: " + JSON.stringify(item).slice(0, 300));
    const cited = R(await cs.call("cite", { body: { project: question, role: "supports", found: item } }));
    assert.deepEqual(cited.cited, [bundle], "the question rests on the document: " + JSON.stringify(cited).slice(0, 300));
    const concl = R(await cs.call("conclude", { query: { target: question, project, reading: "The clerk stamped the contract before the vote.",
      falsifier: "A received-log showing a later stamp would overturn this.", reason: "The minutes say so." } }));
    assert.equal(concl.ok, true, "concluded: " + JSON.stringify(concl).slice(0, 400));
    /* the case editor's "Prepare the draft", then the ceremony's Ties step: `publish` with `tieAttested` */
    const draft = R(await cs.call("casedraft", { body: { project, targets: [question], scope: "Whether the contract was stamped before the vote, on the documents in hand.",
      statement: "This case covers the stamp only; it leaves out the later amendments.", subjectPosition: "sought_and_answered",
      subjectJustification: "We put the question to the Clerk and printed the answer.", roles: { [question]: "load_bearing" }, excluded: [] } }));
    assert.ok(draft.draftId, "a draft: " + JSON.stringify(draft).slice(0, 300));
    if (!prepare) return { auth, password, cs, project, question, bundle, draft: draft.draftId, prepared: null };
    const prepared = R(await cs.call("publish", { body: { draft: draft.draftId, project, tieAttested: true, biasAcknowledgement: BIAS } }));
    assert.equal(prepared.ok, true, "the edition is prepared: " + JSON.stringify(prepared).slice(0, 600));
    return { auth, password, cs, project, question, bundle, draft: draft.draftId, prepared };
  }

  /* the Sign step's sitting, as the ceremony's `caseratify` send makes it: `casedocument`, the sitting list (`PARTS.sitting`), one signature a statement by her own key */
  async function sitAndSign(e) {
    const { cs, prepared: p } = e;
    const key = await newKey();
    const reg = R(await cs.call("signerregisterown", { body: { keyB64: key.keyB64 } }));
    assert.equal(reg.ok, true, "her signing key is registered: " + JSON.stringify(reg).slice(0, 300));
    const doc = R(await cs.call("casedocument", { query: { case: p.caseId, edition: String(p.edition) } }));
    const list = PARTS.sitting(doc, { findings: p.findings.map((f) => ({ target: f.target, bundleSha: f.bundleSha })) });
    assert.ok(list && list.length >= 2, "a sitting: " + JSON.stringify(doc).slice(0, 300));
    const sigs = [];
    for (const x of list) sigs.push(await signText(key, x.text, x.namespace));
    /* the password again, as the ceremony asks it before a signature */
    const ra = R(await cs.call("reauth", { body: { password: e.password } }));
    assert.equal(ra.ok, true, "re-authenticated: " + JSON.stringify(ra).slice(0, 200));
    const res = await post(e.auth, "caseratify", { caseId: p.caseId, edition: Number(p.edition), expectedSha: doc.doc_sha, sig: sigs[0],
      members: list.slice(1).map((x, i) => ({ id: x.id, sha: x.sha, signature: sigs[i + 1] })) });
    return { res, list, doc };
  }
  const gateLine = (res) => `${res.status} ${JSON.stringify(res.body).slice(0, 700)}`;

  /* G60: a member's own revision of her filed document under a snap key the history cannot name (a promotion's `snapKey` is any non-blank string; the history
     files it writes are named by it, and C-12.2 maps each back to a manifest entry by the stamp's shape). The record keeps it; the case gate, which reads each
     cited member's image at signing, finds it. The revision carries the document's stored bytes by their address, as the screens carry them. */
  async function reviseUnnamed(cs, bundle, size) {
    const img = R(await cs.call("image", { query: { id: bundle } }));
    const row = R(await cs.call("list", {})).find((b) => b.bundle_id === bundle);
    assert.ok(row && row.bundle_sha, "the document's head: " + JSON.stringify(row));
    const files = Object.keys(img).filter((k) => !k.startsWith("_history/")).map((path) => ({ path,
      ...(path === "bundle.md" ? { text: img[path] + "\n" } : path.startsWith("snapshots/upload-") ? { blobSha: path.slice(17), sha256: path.slice(17), bytes: size } : { text: img[path] }) }));
    const done = R(await cs.call("promote", { body: { bundleId: bundle, base: row.bundle_sha, snapKey: "not-a-stamp", meta: { object_type: "information" }, files } }));
    assert.equal(done.ok, true, "the revision is kept: " + JSON.stringify(done).slice(0, 400));
  }
  /* the instance's active profiles, set the way instance setup sets them (`profilesset`, the administrator's act) */
  async function profileSet(ids) {
    const set = await post(await founder(), "profilesset", { profiles: ids });
    assert.equal(R(set.body).ok, true, "the profile is chosen: " + JSON.stringify(set.body).slice(0, 300));
  }
  /* what the ceremony's Sign step reads: `publishpreflight`'s step that carries `publish_at` (ceremony.mjs `stepWith("publish_at")`) */
  const signStepOf = (answer) => (R(answer).steps || []).find((x) => x && typeof x === "object" && "publish_at" in x) || {};

  /* the Sign step's pre-flight body as the ceremony builds it (ceremony.mjs: `P.caseArgs(copy, draft)` from the draft's `reviewcopy`, the declared bias the member attested, and
     `tieAttested: true` once the Ties step is confirmed, that is once the edition is prepared) */
  async function ceremonyPreflight(e, { tied }) {
    const copy = R(await e.cs.call("reviewcopy", { query: { draft: e.draft } }));
    assert.ok(copy && copy.case, "the draft's copy: " + JSON.stringify(copy).slice(0, 300));
    const body = Object.assign({}, PARTS.caseArgs(copy, e.draft), { biasAcknowledgement: BIAS }, tied ? { tieAttested: true } : {});
    return e.cs.call("publishpreflight", { body });
  }
  const entry = counting ? wrapScript() : { scriptPath: SRC, script: readFileSync(SRC, "utf8") };
  const OPTIONS = {
    modules: true, modulesRoot: "/", ...entry,
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { ADMIN_TOKEN: ADM, MEMBER_TOKEN: `mem-${tag}-0123456789abcdef`, PROBE_TOKEN: `prb-${tag}-0123456789abcdef`, VERSION: "4.8.0",
                INSTANCE_NAME: `${tag}-town`, GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0", ...bindings },
    ...(serviceBindings ? { serviceBindings } : {}),
    outboundService: outbound ?? ((req) => {
      const name = new URL(req.url).pathname.split("/").pop();
      const f = upstream.get(name);
      if (!f) return new Response("not scripted", { status: 404 });
      const headers = { "content-type": f.type, ...(f.disposition ? { "content-disposition": f.disposition } : {}), ...(f.length ? { "content-length": String(f.bytes.length) } : {}) };
      return new Response(f.rate ? slowBody(f.bytes, f.rate) : f.bytes, { headers });
    }),
  };
  /* `workers`: other workers hosted beside the plane under the one Miniflare (a fleet member from its committed bundle, bound by name in `serviceBindings`) */
  const mf = new Miniflare(workers ? { workers: [{ name: "plane", ...OPTIONS }, ...workers] } : OPTIONS);
  const plane = (url, init = {}) => mf.dispatchFetch(new URL(url, ORIGIN).href, init);
  return { mf, OPTIONS, plane, ADM, PASSWORD, founder, person, screenCall, get, post, until, later, sha, te, serve, slowBody, upstream, pdfOf, acquire, projectOf, ownerOf, questionOf,
           preparedEdition, sitAndSign, gateLine, reviseUnnamed, profileSet, signStepOf, ceremonyPreflight, newKey, signText, R, MB };
}
