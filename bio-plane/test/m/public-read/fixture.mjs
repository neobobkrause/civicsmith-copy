/* public-read over `publication` as it stands (K651: the copy runs against publication's R53–R55 and its tables under
   its R40), on `publication`'s own world: the real modules over a real SQLite database shaped as workerd's storage
   (`../publication/fixture.mjs`, reused rather than copied). `w.pr` is this module's instance on the world's host;
   `w.read(op, query)` runs one of this module's ops as the plane store's op map runs it (`publicReadOps`, spread in
   `../../../src/plane/store.mjs`; control-plane's routes reach it), and `storeOps(w, url, body)` is that op map's part
   these ops share: `publicationOps` with `publicReadOps` spread beside it, which a Worker test's stub store answers
   from. */
import { planeWorld, world as bareWorld, caseDoc, V, NOW } from "../publication/fixture.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { publicReadOf, publicReadOps } from "../../../src/public-read/index.mjs";
import { caseDocumentRequiresMaterials } from "../../../src/case-grammar/index.mjs";

export { cursor, V, SIG, NOW, KEY, sha, caseDoc, inquiryMd } from "../publication/fixture.mjs";

/** A docket on its public interface (`docket` R12, R14, R15): `withdrawalOf`, `lastEntryOf`, `docketPublic`, `docketFeed`, over cases
 *  a test declares (`cases`) and the public entries and withdrawals it places (`place`). A case it does not hold answers
 *  null, as an absent one; `calls` records every read, so a test can see what was asked and that nothing was written;
 *  `publicAsked` holds each argument `docketPublic` was handed, whole, so a test sees every key it carried (R25). */
export function docketOn({ cases = [] } = {}) {
  const held = new Map(cases.map((c) => [c, []]));
  const calls = [], publicAsked = [];
  const d = {
    held, calls, publicAsked,
    hold(c) { if (!held.has(c)) held.set(c, []); return d; },
    /* a public entry: `{seq, date, kind, edition, reason, digest}` as `docket` R6 and R12 state them */
    place(c, entry) { d.hold(c); held.get(c).push({ ...entry }); return d; },
    withdrawalOf({ case: c, edition }) {
      calls.push(["withdrawalOf", c, edition]);
      const w = (held.get(c) || []).find((e) => e.kind === "withdrawal"
        && (e.edition === edition || (e.edition === "all" && (e.covers || []).includes(edition))));
      return w ? { seq: w.seq, entry: `${c}#${w.seq}`, date: w.date, reason: w.reason, digest: w.digest } : null;
    },
    /* synchronous, without any capture's bytes (`docket` R14, K1276): the latest public entry's date, or null */
    lastEntryOf({ case: c }) {
      calls.push(["lastEntryOf", c]);
      const es = held.get(c) || [];
      return es.length ? es[es.length - 1].date : null;
    },
    /* async, as `docket` answers it (B3): `{ok, case, group, entries, captures, last_entry, feed}`; each listed entry's
       capture (`capture: {sha256}`) by its hash, unless asked with `captures: "omit"` (`docket` R24): then `captures` is
       `{}` and the answer adds `captures_omitted: true` */
    async docketPublic(arg) {
      publicAsked.push(arg);
      const { case: c, captures: mode } = arg || {};
      calls.push(["docketPublic", c]);
      if (!held.has(c)) return null;
      const omit = mode === "omit";
      const entries = held.get(c).map((e) => ({ seq: e.seq, entry: `${c}#${e.seq}`, digest: e.digest ?? null,
        json: JSON.stringify(e), fields: { ...e }, signature: "-----BEGIN SSH SIGNATURE-----", published_at: e.date,
        taken_back: null }));
      const captures = {};
      if (!omit) for (const e of held.get(c)) if (e.shelf === "listed" && e.capture) captures[e.capture.sha256] = `Ynl0ZXM6${e.seq}`;
      return { ok: true, case: c, group: "parks-group", entries, captures, ...(omit ? { captures_omitted: true } : {}),
               last_entry: entries.length ? entries[entries.length - 1].fields.date : null,
               feed: `op=docketfeed&case=${encodeURIComponent(c)}` };
    },
    async docketFeed({ case: c }) {
      calls.push(["docketFeed", c]);
      if (!held.has(c)) return null;
      const es = [...held.get(c)].reverse();
      return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${c}</id>`
        + es.map((e) => `<entry><id>${c}#${e.seq}</id><updated>${e.date}</updated></entry>`).join("") + "</feed>";
    },
  };
  return d;
}

/** Court-order stamps through `publication` itself (its R62): `stamp({case, editions, entry, effect, parts?})` posts
 *  the order as `docket` does (R25), its source registered with publication as docket registers it, answering the entry
 *  posted, and stamps the editions with `publication.stampEdition`; the read side is publication's `stampsOf`. */
export function stampsOn(w) {
  const posted = [];
  const reg = w.p.registerOrderSource("docket", { courtOrderOf: (c, entry) => {
    const seq = entry && typeof entry === "object" ? Number(entry.seq) : Number(entry);
    return posted.find((o) => o.case === c && o.seq === seq) || null;
  } });
  if (!reg.ok) throw new Error(JSON.stringify(reg));
  return {
    posted,
    stamp({ case: c, editions, entry, effect, parts = null }) {
      const seq = entry && typeof entry === "object" ? Number(entry.seq) : Number(entry);
      posted.push({ case: c, seq, effect, editions, parts });
      const r = w.p.stampEdition({ case: c, editions, entry: seq, effect, parts });
      if (!r.ok) throw new Error(JSON.stringify(r));
      return r;
    },
  };
}

/* R58 (`publication`, T28): only a preparation carrying its method and materials commits: `/6`, and from T31 `/7`, identical
   to it in fields (`case-grammar` R1, `caseDocumentRequiresMaterials`; DEC-124). An edition this module's tests prepare in
   an older format is, by that format, one signed before T28, so it is signed as such an edition was (`signLegacy`, the
   rows its commit wrote then); a `/6` or `/7` one is committed as ratification commits it today. */
const FORMAT_LINE = /^format: (\S+)$/m;
function signAsOfItsFormat(w) {
  const commit = w.signCase.bind(w);
  w.signCase = (caseId, edition, opts = {}) => {
    const d = w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, caseId, edition);
    const format = d ? (FORMAT_LINE.exec(d.text) || [])[1] : null;
    return format && !caseDocumentRequiresMaterials({ format }) ? w.signLegacy(caseId, edition, opts) : commit(caseId, edition, opts);
  };
}

/** An edition signed before T28 (R58 refuses committing one now), with the signer's key and deliverer a test names:
 *  `signLegacy`'s rows, the case document's `attestor_key` then set to `attestorKey`. `deliveredBy` undefined is a
 *  commit that recorded no deliverer. */
export function legacyCaseCommit(w, { case: caseId, edition, project, roster, sigArmored, attestorKey, attestorMember,
                                      deliveredBy, at, completeness, bar = null }) {
  const r = w.signLegacy(caseId, edition, { project, roster, signer: attestorMember, sig: sigArmored, at, bar,
                                            ...(completeness ? { completeness } : {}), deliveredBy: deliveredBy ?? null });
  w.st.sql.exec(`UPDATE case_documents SET attestor_key=? WHERE case_id=? AND edition=?`, attestorKey, caseId, edition);
  return r;
}

/* STAND-INS until `publication`'s T34 job merges (it merges before this one; K1826), each a no-op once publication
   provides it: its R70 columns `signed_at`, `published_at` on `published_cases` (held never null: the commit's instant
   for both, as an edition published at signing answers), and its R64 `stampedEditions()`, answered from its own
   `stampsOf` over every published case edition, in case and edition order. */
export function publicationT34(w) {
  const cols = [...w.st.sql.exec(`PRAGMA table_info(published_cases)`)].map((c) => c.name);
  if (!cols.includes("signed_at")) {
    w.st.sql.exec(`ALTER TABLE published_cases ADD COLUMN signed_at TEXT`);
    w.st.sql.exec(`ALTER TABLE published_cases ADD COLUMN published_at TEXT`);
    w.st.sql.exec(`CREATE TRIGGER IF NOT EXISTS t34_r70_stand_in AFTER INSERT ON published_cases
                   BEGIN UPDATE published_cases SET signed_at=NEW.opened, published_at=NEW.opened
                         WHERE case_id=NEW.case_id AND edition=NEW.edition AND signed_at IS NULL; END`);
  }
  if (typeof w.p.stampedEditions !== "function")
    w.p.stampedEditions = () => ({ ok: true, editions: [...w.st.sql.exec(
      `SELECT case_id, edition FROM published_cases ORDER BY case_id, edition`)]
      .map((e) => ({ case: e.case_id, edition: Number(e.edition),
                     stamps: w.p.stampsOf({ case: e.case_id, edition: Number(e.edition) }).stamps || [] }))
      .filter((e) => e.stamps.length) });
}

/* (T39; `case-carriage` R13, K2377) A document carried whole is one this copy fetched (`provenance` R62): `receipt(sha,
   via, locator)` records a receipt through provenance (its R13), `via` default `direct`; `doc(id)` gives its capture a
   `direct` receipt unless one already answers it fetched, so a document the tests carry whole is carried as captured. A
   member's file (no receipt) is made by a test with `promote` alone. */
function withReceipts(w) {
  let r = 0;
  w.receipt = (captureSha, via = "direct", locator = null) =>
    w.prov.recordReceipt({ addressNorm: `e.org/pr${++r}`, captureSha, retrieved: NOW, via, retrievalLocator: locator });
  const doc = w.doc.bind(w);
  w.doc = (id, ...rest) => {
    const res = doc(id, ...rest);
    const cap = w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, id);
    if (cap && !w.prov.fetchedByThisCopy(cap.capture_sha).fetched) w.receipt(cap.capture_sha);
    return res;
  };
}

function withRead(w, opts = {}) {
  publicationT34(w);
  withReceipts(w);
  signAsOfItsFormat(w);
  w.docket = opts.docket || docketOn();
  /* R36: project-roster's tables, as the host's boot makes them, so a project's matter stake reads. */
  w.roster = projectRosterOf(w.host);
  w.roster.migrate();
  w.pr = publicReadOf(w.host, { publication: w.p, docket: w.docket, ...(opts.members ? { members: opts.members } : {}) });
  w.stamps = stampsOn(w);
  w.read = (name, query = {}) => {
    const url = new URL(`http://do/${name}`);
    for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
    /* R37 (K3725): the `publishedcase` op is asynchronous (it awaits the docket's public answer); `read` answers its
       synchronous part, `publishedCase`, as every earlier arm reads it, and `readOp` is the op itself. */
    if (name === "publishedcase")
      return w.pr.publishedCase({ id: url.searchParams.get("id"), edition: url.searchParams.get("edition"),
                                  caseId: url.searchParams.get("caseId") || null,
                                  sha256: (url.searchParams.get("sha256") || "").toLowerCase() || null });
    return publicReadOps(w.pr, url)[name]();
  };
  w.readOp = async (name, query = {}) => {
    const url = new URL(`http://do/${name}`);
    for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
    return publicReadOps(w.pr, url)[name]();
  };
  return w;
}

/** A world with this module on it (workerd-shaped storage, as publication's own tests use). */
export const world = (opts = {}) => withRead(planeWorld(opts), opts);
/** The same over array-answering storage. */
export const arrayWorld = (opts = {}) => withRead(bareWorld(opts), opts);

/** The plane store's op map, its part here: publication's ops, and this module's beside them (`plane/store.mjs`). */
export const storeOps = (w, url, body = null) => ({ ...publicationOps(w.p, url, body), ...publicReadOps(w.pr, url) });

/** The published store's Durable Object: the op map over this world, in the envelope the plane reads. */
export function stubOf(w, { silent = false } = {}) {
  return { async fetch(req, init) {
    if (silent) return new Response("down", { status: 500 });
    const r = typeof req === "string" ? new Request(req, init) : req;
    const url = new URL(r.url);
    const op = url.pathname.slice(1);
    const body = r.method === "POST" ? JSON.parse((await r.text()) || "{}") : null;
    const ops = storeOps(w, url, body);
    if (!ops[op]) return Response.json({ ok: false, error: `unknown op: ${op}` }, { status: 400 });
    return Response.json({ ok: true, result: await ops[op]() });
  } };
}

/** The published bucket, in memory. */
export function bucket() {
  const m = new Map();
  return { m,
    async get(k) { const v = m.get(k); return v ? { arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) } : null; },
    async head(k) { return m.has(k) ? {} : null; },
    async put(k, v) { m.set(k, v instanceof Uint8Array ? v : new TextEncoder().encode(String(v))); } };
}

/** T33-65 (R23, R26, R27, R28): a `/6` case edition of `CASE-2026-0001` over F (load-bearing) and G (supporting), signed
 *  and published, its findings' bytes in the published bucket (`env`). `extra` are front-matter lines added to the signed
 *  document (a block in `case-grammar`'s own spelling, `calculationsLines`, `timelineLines`); `opts` reach the world
 *  (`docket`). */
export function publishedSix({ extra = [], edition = 1, ...opts } = {}) {
  const CASE = "CASE-2026-0001", F = "INQ-2026-0001", G = "INQ-2026-0002";
  const w = world(opts);
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  w.inquiry(G);
  const pins = { [F]: w.head(F), [G]: w.head(G) };
  const env = { PUBLISHED: bucket() };
  const sign = (ed, lines) => {
    const text = caseDoc(CASE, ed, { format: "bio-case-document/6", project: proj,
      method: { grading: "bio-grading/1", checks: "1.57.0" }, materials: [], attestations: [],
      roles: [{ target: F, version_sha: pins[F], role: "load_bearing" }, { target: G, version_sha: pins[G], role: "supporting" }],
      strength: [{ target: F, axis: "capture", grade: "A" }, { target: F, axis: "connection", grade: "B" },
                 { target: G, axis: "capture", grade: "C" }, { target: G, axis: "connection", grade: "C" }] });
    const ls = text.split("\n");
    const close = ls.indexOf("---", 1);
    const doc = [...ls.slice(0, close), ...lines, ...ls.slice(close)].join("\n");
    const stored = w.p.storeCaseDocument({ case: CASE, edition: ed, text: doc, author: V("olive"), at: NOW });
    if (!stored.ok) throw new Error(JSON.stringify(stored));
    const signed = w.signCase(CASE, ed, { project: proj, roster: [{ bundle_id: F, version_sha: pins[F], role: "load_bearing" },
                                                                 { bundle_id: G, version_sha: pins[G], role: "supporting" }] });
    if (!signed.ok) throw new Error(JSON.stringify(signed).slice(0, 400));
    return doc;
  };
  const text = sign(1, edition === 1 ? extra : []);
  if (w.signFinding(F).ok !== true || w.signFinding(G).ok !== true) throw new Error("findings not signed");
  for (const id of [F, G]) env.PUBLISHED.m.set(`bio/published/${w.head(id)}`, new TextEncoder().encode(w.text(id)));
  for (let ed = 2; ed <= edition; ed++) sign(ed, ed === edition ? extra : []);
  return { w, env, proj, pins, text, CASE, F, G };
}
