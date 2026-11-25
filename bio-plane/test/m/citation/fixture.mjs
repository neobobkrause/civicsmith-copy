/* citation's test fixture: the module over the modules it uses, each the real one (record-core, membership, promotion,
   provenance, content, retrieval with its selections), on a real SQLite database (node:sqlite) standing in for a Durable
   Object's storage, built on retrieval's own fixture world. One provider is partly the test's: `inquiry`'s R13 earned registry answers what a test
   sets in `w.earned`; its R5 leg grammar and R4 roles are inquiry's own exports (the factory's default, the real
   registry, is tested apart). With `{inquiry: true}` the real `inquiry` is booted on the host first, so its check and
   leg projection (its R11, R12) join every promotion and R13 reads the projection back (`restingOn`, K2132). Every test drives
   `citation` at its interface. */
import { world as retrievalWorld, V, sha, provDoc, T0 } from "../retrieval/fixture.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { Citation, citationOf } from "../../../src/citation/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { BASIS_ROLES, checkLegExtentGrammar, inquiryOf } from "../../../src/inquiry/index.mjs";

export { V, sha, T0 };
export const NOW = Date.parse("2026-09-28T01:02:03Z");
export const STAMP = "2026-09-28T01:02:03Z";

export function world(opts = {}) {
  const w = retrievalWorld({ members: ["ann", "vera", "ivy"], admins: ["adm"], ...opts });
  const { host, record, membership, promotion, prov, st } = w;
  w.content = contentOf(host, { record, membership, provenance: prov,
    /* With a booted inquiry its write judges a leg's part against the capture's reading (content R7): every capture is
       then read as three pages of its own text layer. */
    extraction: { readingOf: () => (opts.inquiry ? { chain: [{ step: "layer", tier: 1 }], pageCount: 3, reading: { page_boxes: null },
                                                      textContainer: null, captureFormat: null } : null), unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [],
                  onReading: () => ({ ok: true }) } });
  /* retrieval's world stands in `inquiry_basis` and `connections` with the columns its reads need; a booted inquiry
     makes the real ones (leg-earning's and connections' schemas), so the stand-ins go first. */
  if (opts.inquiry) w.st.db.exec("DROP TABLE IF EXISTS inquiry_basis; DROP TABLE IF EXISTS connections;");
  const booted = opts.inquiry
    ? inquiryOf(host, { record, membership, promotion, content: w.content, provenance: prov, retrieval: w.retrieval }) : null;
  /* inquiry's own lazy services and schemas, made and migrated now as the plane's boot does (plane R3), so the tables its
     check and projection read and write exist. */
  if (booted) { booted.connections.migrate(); booted.migrate(); }
  /* The booted inquiry itself, for a test that registers with it (its R62, `onMachinePassage`). */
  w.inquiryModule = booted;
  w.earned = {};                // target → {grade, why}: what inquiry's registry earns for a leg
  w.earnedCalls = [];
  w.inq = {
    earned: (subject, targets) => {
      w.earnedCalls.push({ subject, targets: [...targets] });
      const connection = {};
      for (const t of targets) if (w.earned[t]) connection[t] = w.earned[t];
      return { subject_entity: subject, earned: { connection } };
    },
    checkLegExtentGrammar, BASIS_ROLES,
    ...(booted ? { restingOn: (t) => booted.restingOn(t) } : {}),
  };
  w.cit = citationOf(host, { record, membership, promotion, content: w.content, retrieval: w.retrieval,
                              provenance: prov, inquiry: w.inq, now: () => NOW });
  let n = 0;
  const key = () => `c${++n}`;
  Object.assign(w, {
    /** A bundle promoted from its whole `bundle.md` text, with the captures it registers. */
    put(id, text, { captures = [], author = "member:ann", visibility, owner } = {}) {
      const files = [{ path: "bundle.md", text }];
      for (const c of captures) files.push({ path: c.path, text: c.text });
      if (captures.length)
        files.push({ path: "data/provenance.json", text: JSON.stringify({ documents: captures.map(provDoc) }, null, 2) });
      const head = id ? record.head(id) : null;
      const r = promotion.promote({ ...(id ? { bundleId: id } : {}), base: head ? head.bundleSha : null, snapKey: key(),
        author, files, meta: {}, ...(owner ? { ownerMemberId: owner } : {}), ...(visibility ? { visibility } : {}),
        register: captures.map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
      if (!r.ok) throw new Error(`fixture promote refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    /** A revision of `id`'s `bundle.md` to `text`, every other live file carried. */
    revise(id, text) {
      const files = [{ path: "bundle.md", text }];
      for (const path of record.livePaths(id)) if (path !== "bundle.md") {
        const f = record.readFile(id, path);
        files.push(typeof f.text === "string" ? { path, text: f.text } : { path, blobSha: f.blobSha, bytes: f.bytes });
      }
      const r = promotion.promote({ bundleId: id, base: record.head(id).bundleSha, snapKey: key(), author: "member:ann", files, meta: {} });
      if (!r.ok) throw new Error(`fixture revise refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r;
    },
    /** An information bundle holding one capture (so `content.captureFor` answers it); its capture sha. */
    info(id, { state = "collected", captured = true } = {}) {
      const c = { path: "snapshots/a.txt", text: `the bytes of ${id}`, sha: sha(`the bytes of ${id}`) };
      w.put(id, docMd(id, "information", state), { captures: captured ? [c] : [] });
      return captured ? c.sha : null;
    },
    inquiry(id, extra = []) { w.put(id, inqMd(id, extra)); return id; },
    /** What retrieval's "Find in this" answers for `term` over `id`'s captures (R73, kind `term`), as `viewer` sees it:
     *  each capture's text written as one indexed unit per page first (extraction's index, retrieval's fixture). */
    find(id, term, { pages = {}, viewer = V("ann") } = {}) {
      for (const [capSha, texts] of Object.entries(pages)) texts.forEach((t, i) => w.unit(capSha, id, i, t));
      const r = w.retrieval.findIn({ scope: { ids: [id] }, kinds: ["term"], term, viewer });
      if (!r.ok) throw new Error(`fixture find refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.kinds[0].items;
    },
    /** A project owned by `owner` (joined), hidden unless `visibility` says otherwise. */
    project(title = "The case", owner = "ann", { extra = [], body = "", visibility } = {}) {
      return w.put(null, projMd(title, extra, body), { author: V(owner), owner, visibility }).bundleId;
    },
    /** An enumerated selection of `ids`, owned by `owner`, made through `viewer`. */
    async select(ids, { owner = "o", viewer = V("ann") } = {}) {
      const s = await w.retrieval.selectionCreate({ owner, viewer, ids });
      if (!s.ok) throw new Error(`fixture select refused: ${JSON.stringify(s)}`);
      return s.handle;
    },
    md: (id) => record.readFile(id, "bundle.md").text,
    fm: (id) => parseFrontmatter(record.readFile(id, "bundle.md").text).data,
    /** Every table's rows, for "nothing was written" and "only these tables moved". */
    snapshot() {
      const out = {};
      for (const { name } of [...st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%fts%' ORDER BY name`)])
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM "${name}"`)]);
      return out;
    },
    /** A Citation over the same modules whose record answers `bundle.md` as `text` for `id` (a document shape the
     *  write path would not have admitted). */
    withDocument(id, text) {
      const rec = new Proxy(record, { get(t, k) {
        if (k === "readFile") return (b, p) => (b === id && p === "bundle.md" ? (text === null ? null : { text, sha256: sha(text ?? "") }) : t.readFile(b, p));
        const v = t[k]; return typeof v === "function" ? v.bind(t) : v;
      } });
      return new Citation({ record: rec, membership, promotion, content: w.content, retrieval: w.retrieval,
                            provenance: prov, inquiry: w.inq, now: () => NOW });
    },
  });
  return w;
}

export function docMd(id, type, state = "collected", extra = []) {
  return ["---", `id: ${id}`, `object_type: ${type}`, `schema: ${type}@1`, `title: "Document ${id}"`,
          `current_state: ${state}`, "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`,
          "group: test-group", "references: []", "state_history: []", "criticality: supporting", ...extra,
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function inqMd(id, extra = []) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
          "current_state: open", "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`, "group: test-group",
          "surfaced_by: human", "references: []", "state_history: []", ...extra, "---", "",
          "## Question", "", `What happened in ${id}?`, "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

export function projMd(title, extra = [], body = "") {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`, "group: test-group", "references: []",
          "state_history: []", ...extra, "---", "", "## Objective", "", "Find out.", body, ""].join("\n");
}

export function biasMd(id, state) {
  return ["---", `id: ${id}`, "object_type: bias", "schema: bias@1", 'title: "House lens"', `current_state: ${state}`,
          "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`, "group: test-group",
          "references: []", "state_history: []", "statements: []", "---", "", "## Statements", "", "The lens.", ""].join("\n");
}
