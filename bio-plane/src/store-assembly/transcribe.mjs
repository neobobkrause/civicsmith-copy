/* plane R36 (T42; N832; D21; extraction R72; reading-pipeline R29; K2484, K2611, K2613): the one transcriber the
   composition root registers with `extraction` (`registerTranscriber("plane", t)`), built on the object's own instances
   so `extraction` reaches nothing above its layer. It decides nothing about a page and holds no table: whether the AI's
   part may run is `ai-runs`' `partAdmitted("transcribe")` (R40, T46: run-rules' bar on its R75 records, or the
   test-instance exception, whose label the transcription hands `extraction`), whether a project keeps its material away is `ai-accounts`' (its R7),
   the account and its limit are `ai-accounts`' (R53, was `credentials`') and `ai-use`'s (asked by `reading-pipeline.tier4Extend`), the rendering is
   `pdf-pixels`' (a PDF page by its page renderer, a picture file by its picture renderer), the reading `agent-worker`'s, and the count `ai-use`'s (R9). The account's secret leaves the object only
   in the one `POST /transcribe` request body. */
import { recordOf } from "../record-core/index.mjs";
import { aiAccountsOf } from "../ai-accounts/index.mjs";
import { aiUseOf } from "../ai-use/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { tokenRefusal, doorHeaders } from "./ask.mjs";
import { renderPageToPixels } from "../../../pdf-worker/src/pagepixels.mjs";
import { renderPictureToPixels } from "../../../pdf-worker/src/picturepixels.mjs";
import { readRange } from "../acquisition/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { boundOf } from "../read-bounds.mjs";
import { pendingOf } from "./pending.mjs";

/** R36: at most this many pages are rendered and sent for one act, `agent-worker`'s `TRANSCRIBE_PAGES_MAX` (its R72;
 *  K2611), held equal to it by this module's test (the plane does not bundle agent-worker). */
export const TRANSCRIBE_PAGES_MAX = 8;
/** R36: a rendered page's PNG over this many bytes is not sent, `agent-worker`'s `TRANSCRIBE_IMAGE_MAX_BYTES` (its R72),
 *  held equal by this module's test. */
export const TRANSCRIBE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** R36 (T43; N853b; K2691, K2716): the long edge, in pixels, a picture file's page is reduced to at most before it is
 *  sent: the provider's standard vision tier's long edge, so no model downscales it, and under the 2,000 px a request
 *  of more than 20 images is held to (platform.claude.com, "Resolution and token cost", read 2026-10-11). */
export const TRANSCRIBE_PICTURE_EDGE = 1568;
/** The one picture kind `agent-worker` R63 admits: a PNG Civicsmith rendered itself, never the file's own stream. */
const PNG = "image/png";
const USE = "transcribe";

const idOf = (m) => (typeof m === "string" && m.startsWith("member:") ? m.slice(7) : m);

/* R36: the paying owner as `ai-use` R1 spells it, from the account `credentials.accountFor` answered. */
function ownerOf(account, member) {
  if (account && account.level === "project") return `project:${account.project}`;
  if (account && account.level === "group") return "group";
  return `member:${idOf(member)}`;
}

/* Base64 of a byte array, in chunks (no `Buffer` is assumed in the runtime). */
function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** R106 (fix round 9, G126e; K4835): the largest capture the transcriber loads into a request, the inline ceiling G126e names ("none loads a
 *  PDF over 2 MB in a request"), `READ_BOUNDS`' row `pdf.request_bytes` (RUNTIME-LIMITS #11, K4902), quoted; a capture over it is not loaded,
 *  and the pages asked are owed as a job row. */
export const TRANSCRIBE_LOAD_MAX = boundOf("pdf", "request_bytes");
/** R106: why an asked page was not sent beyond the renderer's own refusals. */
export const PAGES_MAX = "TRANSCRIBE_PAGES_MAX";
export const OWED = "OWED";

/* R36: the asked pages, whole numbers of zero or more, each once, in ascending order. */
const pagesWanted = (pages) => [...new Set((Array.isArray(pages) ? pages : []).filter((p) => Number.isInteger(p) && p >= 0))].sort((a, b) => a - b);
/* R36: at most TRANSCRIBE_PAGES_MAX of them are rendered; R106: the rest are named, never dropped. */
const pagesAsked = (pages) => pagesWanted(pages).slice(0, TRANSCRIBE_PAGES_MAX);

/* R36 (T44; N869; DEC-191 (4), (5); K2719): an asked page not sent, as `refused` names it: the renderer's refusal key
   (`pdf-pixels` R39) and, when its detail names one, the JPEG process. */
function refusalOf(page, r) {
  const reason = r && typeof r.reason === "string" && r.reason ? r.reason : "DECODE_FAILED";
  return { page, reason, ...(r && typeof r.process === "string" && r.process ? { process: r.process } : {}) };
}

/** R36: each asked page rendered by `pdf-pixels` with `decodeDct: true`, as `agent-worker` R72's `{page, media_type,
 *  data}`; a page the page renderer answers `NOT_A_PDF` for is rendered by its picture renderer instead, grey, its long
 *  edge at most TRANSCRIBE_PICTURE_EDGE (T43; N853b). A page either renderer refuses (or that throws), whose picture is
 *  not a PNG, or whose PNG is over TRANSCRIBE_IMAGE_MAX_BYTES is not sent and stays unread; (T44) each such page is
 *  answered in `refused` as `{page, reason, process?}`: the renderer's refusal, `DECODE_FAILED` for a renderer that
 *  throws or answers no PNG, `IMAGE_TOO_LARGE` for a PNG over the cap. One page is rendered at a time. */
export async function renderAsked(bytes, pages, render = renderPageToPixels, picture = renderPictureToPixels) {
  const sent = [], refused = [];
  for (const page of pagesAsked(pages)) {
    let r;
    try { r = await render(bytes, page, { decodeDct: true }); } catch { r = null; }
    if (r && r.ok === false && r.reason === "NOT_A_PDF") {
      try { r = await picture(bytes, page, { maxEdge: TRANSCRIBE_PICTURE_EDGE, grey: true }); } catch { r = null; }
    }
    if (!r || r.ok !== true) { refused.push(refusalOf(page, r)); continue; }
    const png = r.mediaType !== PNG ? null : r.bytes instanceof Uint8Array ? r.bytes : r.bytes ? new Uint8Array(r.bytes) : null;
    if (!png || png.length === 0) { refused.push({ page, reason: "DECODE_FAILED" }); continue; }
    if (png.length > TRANSCRIBE_IMAGE_MAX_BYTES) { refused.push({ page, reason: "IMAGE_TOO_LARGE" }); continue; }
    sent.push({ page, media_type: PNG, data: base64(png) });
  }
  return { sent, refused };
}

/** R36: the pages `renderAsked` sends, alone. */
export async function renderPages(bytes, pages, render = renderPageToPixels, picture = renderPictureToPixels) {
  return (await renderAsked(bytes, pages, render, picture)).sent;
}

/** R36's AI path for one act of `member`, on this object: `transcribe({account, capture_sha, store, pages, use})`.
 *  `onSha` hears the capture's digest, so the act's id can carry it. */
function aiPath(ctx, env, { member, at, act, onSha, trace = null, memberRef = null }) {
  return async function transcribe({ account = null, capture_sha = null, pages = [] } = {}) {
    const w = env && env.AGENT_WORKER;
    if (!w || typeof w.fetch !== "function") return { ok: false, reason: "AGENT_WORKER_UNBOUND" };
    const sha = typeof capture_sha === "string" ? capture_sha : "";
    onSha(sha);
    /* R106: the pages asked, those beyond TRANSCRIBE_PAGES_MAX named and owed, never dropped */
    const wanted = pagesWanted(pages), beyond = wanted.slice(TRANSCRIBE_PAGES_MAX);
    const owe = (left) => {
      if (!left.length || !/^[0-9a-f]{64}$/.test(sha)) return null;
      try { const r = pendingOf(ctx).registerJob({ kind: "ocr", sha, detail: { pages: left, next_page: left[0] }, owed: left.length }); return r && r.ok === true; }
      catch { return false; }
    };
    const stated = (sent, refused) => ({ asked: wanted, sent, ...(refused.length ? { refused } : {}) });
    const size = await sizeOf(ctx, sha);
    if (size === null) return { ok: false, reason: "EVIDENCE_ABSENT" };
    /* R106: a capture over the ceiling is not loaded into the request: every asked page is owed as a job row, and named */
    if (size > TRANSCRIBE_LOAD_MAX) {
      const owed = owe(wanted);
      return { ok: false, reason: "NO_PAGE_RENDERED", asked: wanted, sent: [], size, limit: TRANSCRIBE_LOAD_MAX,
               refused: wanted.map((page) => ({ page, reason: OWED })), owed: owed === true ? wanted : [] };
    }
    /* R106: the bytes by ranges of the capture, by its whole digest, whether it is held whole or in parts (acquisition's `readRange`) */
    const got = await readRange(captureOf(ctx), sha, 0, size).catch(() => null);
    const bytes = got instanceof Uint8Array && got.length ? got : null;
    if (!bytes) return { ok: false, reason: "EVIDENCE_ABSENT" };
    const { sent: rendered, refused: unrendered } = await renderAsked(bytes, pages);
    const refused = [...unrendered, ...beyond.map((page) => ({ page, reason: PAGES_MAX }))];
    const owedBeyond = owe(beyond) === true ? beyond : [];
    /* Nothing rendered: nothing is sent, and no account leaves the object; (T44) each asked page says why. */
    if (!rendered.length) return { ok: false, reason: "NO_PAGE_RENDERED", ...stated([], refused), owed: owedBeyond };
    const a = account && typeof account === "object" ? account : {};
    /* agent-worker R6's wire shape: `accountFor`'s `key` named `secret` (R47, T47: a sign-in's held token as an API
       key's), the acting member, no suggestions; a project's account names its project. */
    const body = JSON.stringify({ capture_sha: sha, pages: rendered,
      account: { kind: a.kind, level: a.level, ...(a.level === "project" ? { project: a.project } : {}), secret: a.key,
                 member, suggestions: false } });
    let answer, status = null;
    try {
      const res = await w.fetch("https://agent-worker/transcribe", { method: "POST",
        headers: doorHeaders({ trace, memberRef }), body });
      status = Number.isInteger(res.status) ? res.status : null;
      answer = await res.json();
    } catch { return { ok: false, reason: "AGENT_WORKER_SILENT" }; }
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { ok: false, reason: "AGENT_WORKER_SILENT" };
    /* R47 (T47; K3084; credentials R70): an answer refusing a sign-in's token has credentials drop the token it holds
       for the member whose sign-in served, as the ask and the draft do */
    tokenRefusal(aiAccountsOf(ctx), a)(answer);
    /* Whatever else it says, usage it carries is counted, in one transaction, under this act (D12). */
    if (answer.usage && typeof answer.usage === "object") {
      const entry = { owner: ownerOf(a, member), member, use: USE, mode: USE,
        model: typeof answer.engine === "string" && answer.engine ? answer.engine : null, usage: answer.usage,
        calls: answer.calls, at, act: act() };
      try { recordOf(ctx).transact(() => aiUseOf(ctx).countUsage(entry)); } catch { /* refused: rolled back, nothing counted */ }
    }
    /* R106: a posted answer names the pages asked, sent and left unread (`unread`: the renderer's refusals and those beyond the cap), and
       the pages owed; it carries no `refused`, which is the NO_PAGE_RENDERED answer's (T44) */
    if (answer.ok === true) return { ...answer, asked: wanted, sent: rendered.map((p) => p.page), ...(refused.length ? { unread: refused } : {}), owed: owedBeyond };
    /* R36 (T46; N886; extraction R75): a refusal agent-worker answers is relayed with its own HTTP status, never read from
       the body alone, so extraction answers it as that refusal at that status. */
    return { ...answer, ok: false, reason: answer.reason ?? answer.code ?? null,
             ...(status !== null && status >= 400 ? { status } : {}) };
  };
}

/* R106: the capture's size, from the store's own record (held whole: its head; held in parts: the parts the register names), or null when
   none is held; nothing of its bytes is read */
async function sizeOf(ctx, sha) {
  if (!/^[0-9a-f]{64}$/.test(sha)) return null;
  try {
    const ev = recordOf(ctx).evidenceStore();
    const head = ev && typeof ev.head === "function" ? await ev.head(sha) : null;
    if (head && Number.isSafeInteger(Number(head.size))) return Number(head.size);
    const prov = captureOf(ctx).provenance;
    const parts = prov && typeof prov.partsOf === "function" ? prov.partsOf(sha) : null;
    return Array.isArray(parts) && parts.length ? parts.reduce((n, p) => n + (Number(p.bytes) || 0), 0) : null;
  } catch { return null; }
}

/** R36: the transcriber, `{deployable(), keptAway({project, use}), transcription({member, project, at})}`. */
class Transcriber {
  #ctx; #env;
  constructor(ctx, env) { this.#ctx = ctx; this.#env = env; }

  /* R40 (T46; N897 (2)): `ai-runs.partAdmitted("transcribe")`, the one gate, read at each call; anything that throws is
     not admitted. */
  #admitted() {
    try {
      const said = aiRunsOf(this.#ctx, this.#env).partAdmitted(USE);
      return said && said.admitted === true ? { admitted: true, untested: said.untested ?? null } : { admitted: false, untested: null };
    } catch { return { admitted: false, untested: null }; }
  }

  deployable() { return this.#admitted().admitted === true; }

  keptAway({ project = null, use = null } = {}) { return aiAccountsOf(this.#ctx).aiKeptAway({ project, use }); }

  /* The act's id is minted here at `at` and carries the capture's digest once the AI path is asked for it. */
  transcription({ member = null, project = null, at = null, trace = null, memberRef = null } = {}) {
    const instant = typeof at === "string" && at ? at : new Date().toISOString();
    let prefix = "";
    const act = () => `${USE}:${prefix}:${instant}`;
    const ctx = this.#ctx, aiUse = aiUseOf(ctx);
    /* R40 (T46; extraction R74): `untested`, the test-instance label when the part runs on the exception, else null */
    const tx = { member, project, at: instant, accounts: aiAccountsOf(ctx), untested: this.#admitted().untested,
      useCheck: (q) => aiUse.useCheck(q),
      transcribe: aiPath(ctx, this.#env, { member, at: instant, act, trace, memberRef,
                          onSha: (sha) => { prefix = sha.slice(0, 16); } }) };
    Object.defineProperty(tx, "act", { get: act, enumerable: true });
    return tx;
  }
}

/* K61: one transcriber per storage. (T46; R40) A test's own set is ai-runs' (`assistantGateOf`'s, handed to ai-runs at
   its construction), never the transcriber's. */
const OF = new WeakMap();
/** R36: this object's transcriber. */
export function transcriberOf(ctx, env) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let t = OF.get(storage);
  if (!t) { t = new Transcriber(ctx, env); OF.set(storage, t); }
  return t;
}
