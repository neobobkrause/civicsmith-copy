/* record-grammar's bundle fixtures: one bundle per arm of `checkBundle`'s structural checks, and the clean bundle each is
   a change of. `expected.json` beside this file holds, for every fixture, the findings the check catalogue's own
   `checkBundle` gave before the move (T19), generated once with every type arm claimed by `STUBS` below, so the two
   are compared over the structural arms and the places of the type arms alone. T21 (N456, N458) changed it by name:
   C-6.3's `workproduct_state` arm and its findings went, the project stub re-keyed to C-2.9, C-13.2's and C-16.1's
   messages say "record", and the project machine's fixtures (R35) were added. */
import { createSha256 } from "../../../../src/record-grammar/index.mjs";
/** @import { BundleInput, BundleContext, Finding, Grammar } from "../../../../src/record-grammar/bundle.mjs" */

/** A fixture: a bundle as `checkBundle` takes it, and the schemas a narrowed one knows (its `opts.knownSchemas`, R39).
 * @typedef {BundleInput & {knownSchemas?: string[]}} Fixture */
/** What a fixture sets beside its files.
 * @typedef {{folderName?: string, nowMs?: number | undefined, maxPackageAgeDays?: number | undefined, maxReevalAgeDays?: number | undefined, elidedPaths?: Set<string> | string[] | undefined, resolveTarget?: ((id: string) => boolean) | undefined, releaseRegistry?: object | null | undefined, publishedRegistry?: object | null | undefined, publishedCaseRegistry?: object | null | undefined, earnedRegistry?: object | null | undefined, sha512?: ((bytes: Uint8Array) => Promise<Uint8Array>) | null | undefined, knownSchemas?: string[]}} More */
/** A plain value the fixtures write (R8). @typedef {string | number | boolean | null} Plain */
/** A one-level map or a flat object element (R7). @typedef {{[key: string]: Plain}} PlainMap */
/** A fixture's front matter, field by field (R7): a plain value, a map, or a list of plain values and flat objects.
 * @typedef {{[key: string]: Plain | PlainMap | (Plain | PlainMap)[]}} Fields */
/** Files by path. @typedef {{[path: string]: string}} Files */

/* Fields and files merged in order, a later part's value replacing an earlier one's in its place, as a spread does. */
/** @param {...Fields} parts @returns {Fields} */
const fields = (...parts) => {
  /** @type {Fields} */
  const out = {};
  for (const part of parts) for (const [k, v] of Object.entries(part)) out[k] = v;
  return out;
};
/** @param {...Files} parts @returns {Files} */
const filesMerged = (...parts) => {
  /** @type {Files} */
  const out = {};
  for (const part of parts) for (const [k, v] of Object.entries(part)) out[k] = v;
  return out;
};

/** 2026-06-01T00:00:00Z, the fixtures' clock. */
export const NOW = 1780272000000;
/** @param {string} s @returns {Uint8Array} */
const utf8 = (s) => new TextEncoder().encode(s);
/** @param {Uint8Array | string} v @returns {Promise<string>} */
export const sha256 = async (v) => createSha256().update(typeof v === "string" ? utf8(v) : v).hex();
/** @param {string} s @returns {string} */
const hex = (s) => createSha256().update(utf8(s)).hex();

/* The type arms, claimed by grammars that each leave one marker finding, so their places in the order are seen. C-2.7's
   grammar leaves none: its place is capture's grammar's to keep or lose (job record, J2), not the structural arms'.
   Re-keyed at T21 (N456, K904): the project slot is C-2.9 alone, so its stub claims and marks C-2.9. */
/** @param {string} check @returns {(ctx: BundleContext, findings: Finding[]) => void} */
const marker = (check) => (ctx, findings) => { findings.push({ check, severity: "info", message: `${check} arm ran` }); };
/** @type {Grammar[]} */
export const STUBS = [
  { module: "stub-information", ids: ["C-2.7"], arm: () => {} },
  { module: "stub-info2", ids: ["C-18.6", "C-18.7"], arm: marker("C-18.6") },
  { module: "stub-inquiry", ids: ["C-2.8"], arm: marker("C-2.8") },
  { module: "stub-project", ids: ["C-2.9"], arm: marker("C-2.9") },
];

/** @param {Fields} o @returns {Fields} */
const CORE = (o) => fields({
  id: "INFO-2026-0001-a", object_type: "information", schema: "information@1", title: "T", current_state: "collected",
  prior_state: "null", created: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z", produced_by: { mode: "manual",
  capability_tier: "t1" }, group: "g", references: [], state_history: [], annotations_open: 0, reeval_pending: "false",
  visuals: [] }, o);
/** @type {{[type: string]: string[]}} */
const HEAD = {
  information: ["## Summary", "## Provenance Notes", "## Session Log", "## Review Notes"],
  inquiry: ["## Question", "## What It Rests On", "## Conclusion", "## What Would Falsify This", "## Session Log", "## Review Notes"],
  focus: ["## Statement", "## Why It Matters", "## Open Questions", "## Session Log", "## Review Notes"],
  project: ["## Thesis Summary", "## Open Questions", "## Ruled Out", "## Session Log", "## Review Notes"],
  action: ["## Plan", "## Status", "## Correspondence", "## Session Log", "## Review Notes"],
  bias: ["## Statements", "## Adoption", "## What This Does Not Enforce", "## Session Log", "## Review Notes"],
};

/* The restricted grammar, written: scalars, one-level maps, arrays of scalars or of flat objects. */
/** @param {Fields} fm @returns {string} */
function yamlOf(fm) {
  /** @param {Plain} v @returns {string} */
  const sc = (v) => (v === null ? "null" : typeof v === "string" && (v === "" || /[:#]/.exec(v) !== null) ? JSON.stringify(v) : String(v));
  const out = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      out.push(`${k}:`);
      for (const e of v) {
        if (e && typeof e === "object") Object.entries(e).forEach(([ek, ev], i) => out.push(`${i ? "    " : "  - "}${ek}: ${sc(ev)}`));
        else out.push(`  - ${sc(e)}`);
      }
    } else if (v && typeof v === "object") {
      out.push(`${k}:`);
      for (const [mk, mv] of Object.entries(v)) out.push(`  ${mk}: ${sc(mv)}`);
    } else out.push(`${k}: ${sc(v)}`);
  }
  out.push("---");
  return out.join("\n");
}
/** @param {string[]} heads @param {{[heading: string]: string}} [extra] @returns {string} */
const bodyOf = (heads, extra = {}) => heads.map((h) => `${h}\n${extra[h] || ""}`).join("\n");
/** @param {Fields} fm @param {string[] | null} [heads] @param {{[heading: string]: string}} [extra] @returns {string} */
const md = (fm, heads, extra) => `${yamlOf(fm)}\n${bodyOf(heads || HEAD[String(fm.object_type)] || HEAD.information || [], extra)}`;
/** @param {Files} files @returns {Map<string, Uint8Array | string>} */
const filesOf = (files) => {
  /** @type {[string, Uint8Array | string][]} */
  const entries = Object.entries(files);
  return new Map(entries);
};
/** @param {string} folderName @param {Files} files @param {More} [more] @returns {Fixture} */
const bundle = (folderName, files, more = {}) => ({ folderName, files: filesOf(files), sha256, nowMs: NOW, ...more });
/** @param {Fields} [o] @param {Files} [files] @param {More} [more] @returns {Fixture} */
const info = (o = {}, files = {}, more = {}) => bundle(String(o.id || "INFO-2026-0001-a"), filesMerged({ "bundle.md": md(CORE(o)) }, files), more);
/** @param {string} prefix @param {string} type @param {Fields} [o] @param {Files} [files] @param {More} [more] @returns {Fixture} */
const typed = (prefix, type, o = {}, files = {}, more = {}) => {
  const id = String(o.id || `${prefix}-2026-0001-a`);
  return bundle(id, filesMerged({ "bundle.md": md(CORE(fields({ id, object_type: type, schema: `${type}@1` }, o))) }, files), more);
};
/** @param {string} ts @param {string} author @param {string} state @returns {string} */
const ann = (ts, author, state) => JSON.stringify({ id: `INFO-2026-0001-a.ann-${ts}-${author}`, state });
/** @type {(Plain | PlainMap)[]} */
const TRIGGERS = [{ text: "t", description: "d" }];
/** @param {Fields} [o] @param {Files} [files] @param {More} [more] @returns {Fixture} */
const inquiry = (o = {}, files = {}, more = {}) =>
  typed("INQ", "inquiry", fields({ current_state: "open", surfaced_by: "human", recheck_triggers: TRIGGERS }, o), files, more);
/** @type {{[heading: string]: string}} */
const SESSION = { "## Session Log": "### Session 2026-01-02 x\n" };
/** @param {PlainMap} o @returns {PlainMap} */
const ref = (o) => {
  /** @type {PlainMap} */
  const out = { rel: "cites", target: "INFO-2026-0002-b", status: "confirmed" };
  for (const [k, v] of Object.entries(o)) out[k] = v;
  return out;
};

/* A pending package whose manifest lists `files` (name -> bytes) against `base`. */
/** @param {{[name: string]: string}} files @param {{base?: string, created?: string, sha?: string, man?: {[key: string]: string | undefined}}} [o] @returns {Files} */
function pkg(files, o = {}) {
  const man = { target: "INFO-2026-0001-a", base: o.base ?? "0".repeat(64), created: o.created ?? "2026-05-30T00:00:00Z",
    author: "a", skill_version: "1", files: Object.entries(files).map(([name, b]) => ({ name, sha256: o.sha ?? hex(b) })) };
  /** @type {Files} */
  const out = { "PENDING_PROMOTION.json": JSON.stringify({ ...man, ...(o.man || {}) }) };
  for (const [name, b] of Object.entries(files)) out[`${name}.pending`] = b;
  return out;
}
/** @param {{[key: string]: string | string[]}[]} entries @returns {string} */
const histMan = (entries) => JSON.stringify({ entries });

/** Every fixture by its name. @returns {{[name: string]: Fixture}} */
export function fixtures() {
  const live = md(CORE({}));
  /** @type {{[name: string]: Fixture}} */
  const F = {
    "clean information": info(),
    "clean project": typed("PROJ", "project", { current_state: "forming" }),
    "clean action": typed("ACTN", "action", { current_state: "planned" }),
    "clean bias": typed("BIAS", "bias", { current_state: "draft" }),
    "clean inquiry": inquiry(),
    "clean action plan": typed("PLN", "action_plan", { current_state: "open" }, {}, {}),
    "legacy problem spelling": typed("PROB", "problem", { current_state: "elevated", recheck_triggers: TRIGGERS, surfaced_by: "human" }),
    "legacy focus at published-free state": typed("FOCUS", "focus", { current_state: "surfaced", recheck_triggers: TRIGGERS, surfaced_by: "human" }),
    "no bundle.md": bundle("INFO-2026-0001-a", { "data/x.json": "{}" }),
    "no frontmatter fence": bundle("INFO-2026-0001-a", { "bundle.md": "title: x\n## Summary" }),
    "frontmatter grammar errors": bundle("INFO-2026-0001-a", { "bundle.md": md(CORE({})).replace("title: T", "title: T\ntitle: U\n  status: x\njunk line") }),
    "C-1.1 folder differs from id": info({}, {}, { folderName: "INFO-2026-0009-z" }),
    "C-1.2 malformed id": info({ id: "INFO-26-1-A" }),
    "C-1.3 annotations": info({ annotations_open: 3 }, {
      "annotations/note.txt": "x", "annotations/bad.json": "{", "annotations/ann-x.json": JSON.stringify({ id: "nope" }),
      "annotations/ann-20260101T000000Z-bob.json": ann("20260101T000000Z", "bob", "pending"),
      "annotations/ann-20260101T000001Z-eve.json": JSON.stringify({ id: "INFO-2026-0002-b.ann-20260101T000001Z-eve", state: "pending" }),
      "annotations/wrong-name.json": ann("20260101T000002Z", "al", "closed") }),
    "C-2.2 core field missing, produced_by incomplete": bundle("INFO-2026-0001-a", { "bundle.md": md((() => {
      const c = CORE({ produced_by: { other: "x" } }); delete c.group; delete c.visuals; return c; })()) }),
    "C-2.3 forbidden aliases": info({ status: "x", modified: "y" }),
    "C-2.5 unknown type": info({ object_type: "memo", schema: "memo@1" }),
    "C-2.5 prefix implies another type": info({ object_type: "project", schema: "project@1" }),
    "C-2.5 bad schema stamp": info({ schema: "information" }),
    "C-2.5 schema of another type": info({ schema: "project@1" }),
    "C-2.5 unknown schema version": info({ schema: "information@9" }),
    "C-2.5 knownSchemas narrowed": info({}, {}, { knownSchemas: ["project@1"] }),
    "C-2.6 timestamps": info({ created: "2026-01-01", last_updated: "2026-01-01T00:00:00+00:00",
      state_history: [{ from_state: "a", to_state: "b", timestamp: "yesterday" }] }),
    "C-3.1 missing and extra headings": bundle("INFO-2026-0001-a", { "bundle.md": md(CORE({}), ["## Summary", "## Extra", "## Review Notes  "]) }),
    "C-3.1 case member owes the exclusion heading": inquiry({ published_strength: [{ axis: "capture" }, { axis: "connection" }] }),
    "C-3.1 case member carries it": bundle("INQ-2026-0001-a", { "bundle.md": md(CORE({ id: "INQ-2026-0001-a", object_type: "inquiry",
      schema: "inquiry@1", current_state: "open", surfaced_by: "human", recheck_triggers: TRIGGERS,
      published_strength: [{ axis: "capture" }, { axis: "connection" }, { axis: "testimony" }] }),
      [...(HEAD.inquiry ?? []), "## What This Excludes"]) }),
    "C-3.1 not a case member: one axis": inquiry({ published_strength: [{ axis: "capture" }] }),
    "C-4.1 illegal state": info({ current_state: "published" }),
    "C-4.1 inquiry legacy state is readable": inquiry({ current_state: "published" }),
    "C-4.1 focus machine on a problem": typed("PROB", "problem", { current_state: "open", recheck_triggers: TRIGGERS, surfaced_by: "human" }),
    "C-4.2 history entry not an object": info({ state_history: ["plain"] }),
    "C-13.1 last_updated precedes created and history": info({ created: "2026-02-01T00:00:00Z", last_updated: "2026-01-15T00:00:00Z",
      state_history: [{ from_state: "a", to_state: "b", timestamp: "2026-03-01T00:00:00Z" }] }),
    "C-13.2 updated without a session entry": info({ last_updated: "2026-01-02T00:00:00Z" }),
    "C-13.2 updated with a session entry": bundle("INFO-2026-0001-a", { "bundle.md": md(CORE({ last_updated: "2026-01-02T00:00:00Z" }), null, SESSION) }),
    "C-14 hygiene": info({ visuals: [{ file: "a.svg", description: "d" }, { file: "missing.svg", description: "d" }, { file: "x.svg" }] }, {
      "a.svg": "<svg/>", "b.svg": "<svg/>", "bad name.md": "x", "noext": "x", "UP.PNG": "x", "notes.md": "a \\* b", "data/x.json": "{nope" }),
    "C-16.5 stale markers": info({}, {
      "PROMOTING-x.json": JSON.stringify({ ts: "2026-05-31T23:00:00Z" }), "PRESENCE-y.json": JSON.stringify({ started_at: "2026-06-01T00:00:00Z" }),
      "GATE_PASSED-0123abcd.json": JSON.stringify({ ts: "2026-05-01T00:00:00Z" }), "GATE_PASSED-89abcdef.json": JSON.stringify({ ts: "2026-05-31T12:00:00Z" }),
      "LEASE-alice.json": JSON.stringify({ expires: "2026-05-31T00:00:00Z" }), "LEASE-bob.json": JSON.stringify({ expires: "2026-06-02T00:00:00Z" }),
      "LEASE-carol.json": "{" }),
    "C-16.4 orphaned pending": info({}, { "data/x.json.pending": "{}" }),
    "C-16.1 manifest does not parse": info({}, { "PENDING_PROMOTION.json": "{" }),
    "C-16 package checks": info({}, filesMerged(pkg({ "data/a.json": "{}", "data/b.json": "[]" }, { man: { target: "INFO-2026-0003-c", skill_version: undefined } }),
      { "data/b.json.pending": "[1]", "data/c.json.pending": "{}" })),
    "C-16 manifest entry malformed, file missing": info({}, { "PENDING_PROMOTION.json": JSON.stringify({ target: "INFO-2026-0001-a", base: "x",
      created: "2026-05-30T00:00:00Z", author: "a", skill_version: "1", files: [{ name: "data/a.json" }, { name: "data/z.json", sha256: "0" }] }) }),
    "C-16.3 old package": info({}, pkg({ "data/a.json": "{}" }, { created: "2026-01-01T00:00:00Z" })),
    "C-16.1 created not ISO": info({}, pkg({ "data/a.json": "{}" }, { created: "soon" })),
    "C-17.1 fast-forward": info({}, pkg({ "data/a.json": "{}" }, { base: hex(live) })),
    "C-17.1 divergence": info({}, pkg({ "data/a.json": "{}" }, { base: "f".repeat(64) })),
    "C-5.1 append-only surfaces": bundle("INFO-2026-0001-a", {
      "bundle.md": md(CORE({ state_history: [{ from_state: "x", to_state: "y", timestamp: "2026-01-01T00:00:00Z" }], conclusions: [] }), null,
        { "## Review Notes": "changed note\n" }),
      "_history/bundle_20260101T000000Z_aaaaaaaa.md": md(CORE({ state_history: [{ from_state: "x", to_state: "z", timestamp: "2026-01-01T00:00:00Z" }],
        conclusions: ["c1"] }), null, { "## Review Notes": "original note\n", "## Session Log": "### Session 1 gone\n" }),
      "_history/data/changes_20260101T000000Z_aaaaaaaa.json": JSON.stringify({ records: [{ a: 1 }, { b: 2 }] }),
      "data/changes.json": JSON.stringify({ records: [{ a: 1 }] }) }),
    "C-5.1 snapshot not a document": info({}, { "_history/bundle_20260101T000000Z_aaaaaaaa.md": "no fence" }),
    "C-6 references": info({ references: [ref({ rel: "knows" }), ref({ rel: "links_to" }), ref({ rel: "links_to", asserted_by: "source",
      address: "https://example.org/x", verdict: "undetermined" }), ref({ asserted_by: "source" }), ref({ status: "maybe" }),
      ref({ target: "https://example.org/doc" }), ref({ target: "folder/INFO-2026-0002-b" }), ref({ target: "INFO-2026-2-b" }), "plain",
      ref({ target: "INFO-2026-0003-c" })] }, {}, { resolveTarget: (t) => t !== "INFO-2026-0003-c" }),
    "C-6.3 retired: a distributed project with no distributions is no finding": typed("PROJ", "project", { current_state: "forming",
      workproduct_state: "distributed" }),
    "C-4.1 project legacy states are readable": typed("PROJ", "project", { current_state: "investigating" }),
    "C-4.1 project matured is readable": typed("PROJ", "project", { current_state: "matured" }),
    "clean closed project": typed("PROJ", "project", { current_state: "closed" }),
    "C-4.1 project state outside its machine": typed("PROJ", "project", { current_state: "published" }),
    "C-12.1 history with no manifest": info({}, { "_history/bundle_20260101T000000Z_aaaaaaaa.md": live }),
    "C-12.1 manifest does not parse": info({}, { "_history/manifest.json": "{" }),
    "C-12 manifest accounting": info({ last_updated: "2026-01-01T00:00:00Z" }, {
      "_history/manifest.json": histMan([
        { key: "20260102T000000Z_bbbbbbbb", kind: "promotion", created: "2026-01-02T00:00:00Z", files: [], snapshotted: ["bundle.md"] },
        { key: "20260101T000000Z_aaaaaaaa", kind: "promotion", created: "2026-01-03T00:00:00Z", files: [], snapshotted: ["bundle.md", "data/x.json"] },
        { key: "20260101T000000Z_aaaaaaaa", kind: "edit" }, { kind: "x" },
        { key: "20260104T000000Z_cccccccc", kind: "edit", created: "2026-01-04T00:00:00Z", files: [], snapshotted: ["bundle.md"] }]),
      "_history/promotion_20260102T000000Z_bbbbbbbb.json": "{}", "_history/bundle_20260102T000000Z_bbbbbbbb.md": live,
      "_history/stray_20260109T000000Z_dddddddd.md": "x", "_history/refused_20260105T000000Z_0123abcd.json": JSON.stringify({ outcome: "refused" }),
      "_history/refused_20260106T000000Z_0123abce.json": "{}", "_history/refused_20260107T000000Z_0123abcf/payload.md": "x",
      "_history/refused_unknown_0123abcd/payload.md": "x", "_history/refused_unknown_0123abcd.json": JSON.stringify({ outcome: "r" }),
      "_history/odd.txt": "x" }),
    "C-12.2 elided snapshots count as present": info({}, { "_history/manifest.json": histMan([
      { key: "20260101T000000Z_aaaaaaaa", kind: "edit", created: "2026-01-01T00:00:00Z", files: [], snapshotted: ["bundle.md"] }]) },
      { elidedPaths: ["_history/bundle_20260101T000000Z_aaaaaaaa.md"] }),
    "type arms in their places": bundle("INFO-2026-0001-a", { "bundle.md": md(CORE({ schema: "information@2", references: [ref({ rel: "knows" })] })) }),
  };
  return F;
}
