/* journey-check R2: one walk of a browser through journeys, a step at a time. Each step is screenshotted into the output
   directory; the walk fails on any refusal the step does not expect, at any depth of an answer whatever its status
   (R8), any 4xx or 5xx, any page whose script throws, any old page (the setup page, legacy-ui) or other address outside
   the walk reached, and any registry screen not drawn. A step whose own control is missing fails with what it looked
   for. Nothing secret is written: a step's label and a failure's detail never carry a password, a code or a token
   (`redact`). */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { designRule, groupIn, senseKeys, withoutGroupSense } from "./group-words.mjs";
import { wordPattern, pageZero } from "./words.mjs";
import { localize } from "../setup-words/index.mjs";

/* The interface page's mark: every document the copy serves to a browser is `interfacePage`, which links the shell's own
   stylesheet (interface-shell R1). A document without it is an old page. */
export const INTERFACE_MARK = "/app/assets/civicsmith.css";
/* The setup page's own title, and the legacy-ui Worker's script name, each named so the failure says which old page it was. */
export const SETUP_PAGE_TITLE = "Your accountability record";
export const LEGACY_UI_WORKER = "civicos";

export const FAIL = Object.freeze({ REFUSED: "refused", HTTP: "http", SCRIPT: "script", OLD_PAGE: "old-page", ADDRESS: "address",
  NOT_DRAWN: "not-drawn", STEP: "step", REFUSAL: "refusal",
  /* R21: a carried state the local arm, which makes its own data, could not reach */
  STATE: "state",
  /* R5: a role signed in that `whoami` does not answer as that role, or acts only an administrator is drawn not drawn */
  ROLE: "role",
  /* R6: a working screen the design mock does not draw, and the limits of a live page (design.mjs' LIMIT) */
  DESIGN: "design", WIDER: "wider", TABS: "tabs", BAND: "band", CLASS: "class", WORDS: "words",
  /* R7: `admin` drawn as a person's name or handle */
  ADMIN_NAME: "admin-name",
  /* R17: a page that says "group" for a team */
  GROUP: "group",
  /* R23: a page numbered 0 drawn */
  PAGE_ZERO: "page-zero",
  /* R28: a title, an explanation, a weight mark, a name or a graph the DEC-340 checks (checks.mjs) fail */
  DEC340: "dec340",
  /* R27: a sentence that escaped the word list in the pseudo-locale walk */
  PSEUDO: "pseudo" });

const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/* What a document is: the interface, the setup page, or another page. */
export function documentKind(html) {
  if (typeof html !== "string") return "other";
  if (html.includes(INTERFACE_MARK)) return "interface";
  const t = /<title>([^<]*)<\/title>/i.exec(html);
  if (t && t[1].trim() === SETUP_PAGE_TITLE) return "setup-page";
  return "other";
}

/* R8 (D29): the refusals an answer carries, anywhere in it: `[{code, how, at}]`, `at` the path to the object that
   carries it ("" at the top). A refusal is an object holding `ok: false`, `started: false`, `dispatched: false` or
   `found: false`, or a non-empty `withheld`; its code is its own `code` or `reason`, else what it says. Each object
   counts once, under its first sign. A reading's own `found` (whether the reader found entities) is not one (K4486). */
export const REFUSAL_FLAGS = Object.freeze(["ok", "started", "dispatched", "found"]);
export function refusalsIn(body) {
  const out = [];
  const seen = new Set();
  const visit = (v, at, depth) => {
    if (!v || typeof v !== "object" || depth > 64 || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach((x, i) => visit(x, `${at}[${i}]`, depth + 1)); return; }
    /* K4486: inside a reading (`{content_type, reader_version, found, entities, …}`), `found` is the reader's statement of whether it
       found entities: data, never a refusal. Elsewhere `found: false` says the op found no subject. */
    const reading = v.reader_version !== undefined && Array.isArray(v.entities);
    const flag = REFUSAL_FLAGS.find((k) => v[k] === false && !(reading && k === "found"));
    const w = v.withheld;
    const withheld = w === true || (Array.isArray(w) && w.length > 0) || (w && typeof w === "object" && !Array.isArray(w) && Object.keys(w).length > 0)
      || (typeof w === "string" && w.length > 0);
    if (flag || withheld) {
      const how = flag ? `${flag}: false` : "withheld";
      const own = [v.code, v.reason].find((c) => typeof c === "string" && c);
      /* a refusal that keeps its reasons in a list (`findings`, `errors`) is named by its first */
      const first = [v.findings, v.errors].find((l) => Array.isArray(l) && l.length && l[0] && typeof l[0] === "object");
      const inner = first ? first[0] : null;
      const said = [v.detail, v.translation, v.message, inner && (inner.detail || inner.message)].find((d) => typeof d === "string" && d.trim());
      const check = [v.check, inner && inner.check].find((c) => typeof c === "string" && c);
      out.push({ code: own || how, how, at, ...(check ? { check } : {}), ...(said ? { said: said.slice(0, 200) } : {}) });
    }
    for (const [k, x] of Object.entries(v)) visit(x, at ? `${at}.${k}` : k, depth + 1);
  };
  visit(body, "", 0);
  return out;
}

/* F2: the handles an answer of the store holds as content, at any depth: each string under a `handle` key, and each string of a
   `handles` list. A handle the page then draws is a person's name, not a developer's slug (design.mjs `developerWords`). */
export function handlesIn(body) {
  const out = new Set();
  const seen = new Set();
  const visit = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 64 || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v)) {
      if (k === "handle" && typeof x === "string" && x) out.add(x);
      else if (k === "handles" && Array.isArray(x)) for (const h of x) if (typeof h === "string" && h) out.add(h);
      visit(x, depth + 1);
    }
  };
  visit(body, 0);
  return [...out];
}

export class Walk {
  /* `out` the output directory; `arm` "local" or "live"; `copyHost` the instance's host (set once known); `ownHosts` the
     other hosts the walk itself serves (the installer, the consent page); `secrets` values never to be written. */
  constructor({ out, arm, ownHosts = [], secrets = [] }) {
    this.out = out; this.arm = arm; this.ownHosts = new Set(ownHosts); this.copyHost = null;
    this.secrets = [...secrets]; this.failures = []; this.steps = []; this.n = 0; this.current = null; this.pending = [];
    this.journey = "walk";
    /* R5: the latest member session `whoami` answered the browser, as the plane said it (`administer` and the rest) */
    this.whoami = null;
    /* F2: the handles the copy's own answers held as content (`handlesIn`), so a drawn handle is not read as a slug */
    this.handles = new Set();
    /* R6: the LIVE and DESIGN pairs written, relative to `out`, put to BOB before a release is called ready */
    this.pairs = [];
    /* what the walk could not walk here and says so, never a failure (R7 with no handle, K3380) */
    this.notes = [];
    /* Elements whose text is a secret (a one-time password, a probe credential, an invitation link): masked in every
       screenshot. */
    this.mask = [];
    mkdirSync(out, { recursive: true });
  }

  /* R20 (K3717, K3747): a step that needs the assistant, which does not work, is reported as not walked, never as failed */
  notWalked(name) {
    const note = localize("journey-check.walker.name_not_walked_the_assistant", "{name}: not walked, the assistant does not work (K3717)", { name: String(name) });
    this.notes.push(note);
    return note;
  }

  keepSecret(v) { if (typeof v === "string" && v.length >= 6) this.secrets.push(v); return v; }
  redact(s) { let t = String(s ?? ""); for (const v of this.secrets) t = t.split(v).join("[secret]"); return t; }
  fail(kind, detail) {
    const f = { journey: this.journey, step: this.current ? this.current.label : null, kind, detail: this.redact(detail) };
    this.failures.push(f);
    return f;
  }

  /* Watch one page (each browser context's pages are watched as they open). */
  watch(page) {
    page.on("pageerror", (e) => this.fail(FAIL.SCRIPT, `${this.redact(page.url())}: ${e.message}`));
    /* answers are judged in the order they arrive: a reading's pending state (`#pendingReadings`) is learned from the answer before it */
    page.on("response", (res) => { const p = this.#answers.then(() => this.#onResponse(res)).catch(() => {}); this.#answers = p; this.pending.push(p); });
    /* JOURNEY_DEBUG=1 prints each request's method, address and status, never a body or a header */
    if (process.env.JOURNEY_DEBUG) page.on("response", (res) => process.stderr.write(this.redact(`${res.status()} ${res.request().method()} ${res.url().replace(/#.*$/, "")}`) + "\n"));
    return page;
  }

  /* K4473 (RC-R1): the digests of captures the walk made whose answer stated the reading pending (`reading_pending: true`), until a
     reading of the digest is read; `op=reading`'s `found: false` for one of these is not a refusal. */
  #pendingReadings = new Set();
  /* a member's own testimony the walk recorded (`op=testify` answering `authored: true` and its `capture_sha`) is never read in
     (`provenance`: "nothing was read in"), so no reading of it is ever held: `op=reading`'s `found: false` for its digest is the
     plane's answer that none is held, never a refusal. */
  #authored = new Set();
  #answers = Promise.resolve();

  async #onResponse(res) {
    const url = new URL(res.url());
    const req = res.request();
    const expect = this.current?.expect || [];
    const where = `${req.method()} ${url.host}${url.pathname}${url.searchParams.get("op") ? "?op=" + url.searchParams.get("op") : ""}`;
    let body = null;
    const type = res.headers()["content-type"] || "";
    /* a JSON answer, or a stream of JSON lines (an ask's answer, `application/x-ndjson`): each line is part of the answer */
    if (/ndjson/.test(type)) {
      const text = await res.text().catch(() => "");
      body = text.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return { unreadable_line: l.slice(0, 200) }; } });
    } else if (/json/.test(type)) { try { body = JSON.parse(await res.text()); } catch { body = null; } }
    if (url.host === this.copyHost && body) for (const h of handlesIn(body)) this.handles.add(h);
    if (url.searchParams.get("op") === "whoami" && body && body.ok === true && body.result && body.result.session) this.whoami = body.result;
    /* R8: every refusal the answer carries, at any depth, whatever its status. One the step expects is excused by its
       code wherever it sits, and excuses the answer's status; each other is one failure, naming where it sits. */
    const op = url.searchParams.get("op");
    const inner = body && typeof body === "object" && body.result && typeof body.result === "object" ? body.result : body;
    if (inner && inner.reading_pending === true) {
      const sha = inner.document?.capture?.sha256 ?? inner.capture?.sha256;
      if (typeof sha === "string" && /^[0-9a-f]{64}$/.test(sha)) this.#pendingReadings.add(sha);
    }
    if (op === "testify" && inner && inner.ok !== false && inner.authored === true && typeof inner.capture_sha === "string"
      && /^[0-9a-f]{64}$/.test(inner.capture_sha)) this.#authored.add(inner.capture_sha);
    const readSha = op === "reading" ? url.searchParams.get("sha256") : null;
    const pendingRead = readSha !== null && (this.#pendingReadings.has(readSha) || this.#authored.has(readSha));
    if (pendingRead && inner && (inner.found === true || inner.reading?.found === true)) this.#pendingReadings.delete(readSha);
    const refusals = refusalsIn(body).filter((r) => !(pendingRead && r.how === "found: false"));
    const matches = (e, code) => (e instanceof RegExp ? e.test(code) : e === code);
    /* an expectation is a code (a string or a pattern), or `{at, code}`: that code where its path matches `at` */
    const expected = (r) => expect.some((e) => (e && typeof e === "object" && !(e instanceof RegExp)
      ? e.at.test(r.at) && matches(e.code, r.code) : matches(e, r.code)));
    const unexcused = refusals.filter((r) => !expected(r));
    const why = (r) => (r.check || r.said ? ` [${[r.check, r.said].filter(Boolean).join(": ")}]` : "");
    for (const r of unexcused) {
      const vars = { where: String(where), code: String(r.code), status: String(res.status()), how: String(r.how), at: String(r.at || "its top") };
      this.fail(FAIL.REFUSED, (r.at === "" && r.how === "ok: false"
        ? localize("journey-check.walker.where_answered_ok_false_code", "{where} answered ok: false ({code}, HTTP {status})", vars)
        : localize("journey-check.walker.where_answered_how_at_code", "{where} answered {how} at {at} ({code}, HTTP {status})", vars)) + why(r));
    }
    /* JOURNEY_DEBUG=bodies prints each answer that carries a refusal, JOURNEY_DEBUG_OP=<op> every answer of that op,
       redacted, to diagnose them; never into the report */
    if (process.env.JOURNEY_DEBUG_OP && url.searchParams.get("op") === process.env.JOURNEY_DEBUG_OP)
      process.stderr.write(localize("journey-check.walker.body_where_http_status_type", "BODY {where} (HTTP {status}, {type}): {redact}\n", { where: String(where), status: String(res.status()), type: String(type), redact: String(this.redact(body ? JSON.stringify(body) : "(not JSON)").slice(0, 6000)) }));
    if (process.env.JOURNEY_DEBUG === "bodies" && refusals.length) process.stderr.write(`BODY ${where}: ${this.redact(JSON.stringify(body)).slice(0, 4000)}\n`);
    const excused = refusals.some((r) => expected(r)) || (!refusals.length && expect.includes(res.status()));
    if (!unexcused.length && res.status() >= 400 && !excused) this.fail(FAIL.HTTP, `${where} answered HTTP ${res.status()}`);
    if (req.resourceType() === "document" && url.host === this.copyHost && res.status() < 300) {
      const kind = documentKind(await res.text().catch(() => null));
      if (kind === "setup-page") this.fail(FAIL.OLD_PAGE, localize("journey-check.walker.pathname_is_the_setup_page", "{pathname} is the setup page", { pathname: String(url.pathname) }));
      else if (kind !== "interface") this.fail(FAIL.OLD_PAGE, localize("journey-check.walker.pathname_is_not_the_interface", "{pathname} is not the interface page", { pathname: String(url.pathname) }));
    }
  }

  /* R17: the words the page draws (its title, its text, hidden disclosures too, the labels a screen reader reads; not script
     or style), with the rows the design's `GROUP_SENSE` keeps taken out: where one says "group" for a team, the step fails,
     naming where. The rule is read once, from the design's build. */
  async #scanGroup(page) {
    let url;
    try { url = new URL(page.url()); } catch { return; }
    let text;
    try {
      text = await page.evaluate(() => {
        const out = [document.title];
        const skip = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "TITLE"]);
        const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (n.nodeType === 3) { if (!skip.has(n.parentElement && n.parentElement.tagName)) out.push(n.nodeValue); continue; }
          for (const a of ["aria-label", "title", "placeholder", "alt", "data-tip"]) if (n.hasAttribute(a)) out.push(n.getAttribute(a));
        }
        return out.join(" \n ");
      });
    } catch { return; }
    try {
      this.group ||= { rule: designRule() };
      this.group.patterns ||= senseKeys({ rule: this.group.rule }).flatMap((k) => { try { return [wordPattern(k)]; } catch { return []; } });
      const found = groupIn(withoutGroupSense(text, this.group.patterns), { rule: this.group.rule });
      for (const f of found.slice(0, 5)) this.fail(FAIL.GROUP, localize("journey-check.walker.pathname_uses_the_retired_word", "{pathname} uses the retired word for a team: …{at}…", { pathname: String(url.pathname), at: String(f.at) }));
    } catch (e) {
      if (!this.groupUnread) { this.groupUnread = true; this.fail(FAIL.GROUP, localize("journey-check.walker.the_designs_rule_for_the_retired", "the design's rule for the retired word could not be read: {v1}", { v1: String(e.message.split("\n")[0]) })); }
    }
  }

  /* R23: no screen draws a page numbered 0, as no screen draws a slug (R6). */
  async #scanPageZero(page) {
    let url, text;
    try { url = new URL(page.url()); text = await page.evaluate(() => (document.body ? document.body.innerText : "")); } catch { return; }
    for (const f of pageZero(text).slice(0, 5)) this.fail(FAIL.PAGE_ZERO, localize("journey-check.walker.pathname_draws_a_page_numbered_0", "{pathname} draws a page numbered 0: …{at}…", { pathname: String(url.pathname), at: String(f.at) }));
  }

  /* A request the walk's router refused: an address outside the walk. */
  foreign(url) {
    const u = new URL(url);
    if (u.host.split(".")[0] === LEGACY_UI_WORKER) return this.fail(FAIL.OLD_PAGE, `${u.host} is legacy-ui`);
    return this.fail(FAIL.ADDRESS, localize("journey-check.walker.host_pathname_is_outside_the", "{host}{pathname} is outside the walk", { host: String(u.host), pathname: String(u.pathname) }));
  }

  /* One step: `fn(page)` performs it; `expect` names the refusal codes (a string or a pattern, or `{at, code}` for a code
     only where its path in the answer matches `at`) or HTTP statuses it expects. The page is
     screenshotted when it settles, whether the step held or not; a step that throws stops the journey. */
  async step(page, label, fn, { expect = [] } = {}) {
    this.current = { label, expect };
    const n = String(++this.n).padStart(2, "0");
    const file = `${n}-${this.arm}-${slugOf(this.journey)}-${slugOf(label)}.png`;
    let error = null;
    try { await fn(page); } catch (e) { error = e; }
    await settle(page);
    await Promise.all(this.pending.splice(0));
    await this.#scanGroup(page);
    await this.#scanPageZero(page);
    try { await page.screenshot({ path: join(this.out, file), fullPage: true,
      mask: this.mask.map((sel) => page.locator(sel)) }); } catch { /* a closed page has none */ }
    const failed = this.failures.filter((f) => f.step === label && f.journey === this.journey);
    if (error) this.fail(FAIL.STEP, error.message.split("\n")[0]);
    this.steps.push({ journey: this.journey, label, screenshot: file, ok: !error && failed.length === 0 });
    this.current = null;
    if (error) throw new StepFailed(label, error);
  }

  report() {
    const lines = [localize("journey-check.walker.journey_check_arm_length_steps", "journey-check ({arm}): {length} steps, {length_2} failures", { arm: String(this.arm), length: String(this.steps.length), length_2: String(this.failures.length) })];
    for (const s of this.steps) lines.push(`${s.ok ? "ok  " : "FAIL"} ${s.journey} · ${s.label} (${s.screenshot})`);
    for (const f of this.failures) lines.push(localize("journey-check.walker.kind_journey_v1_detail", "  {kind}: {journey} · {v1}: {detail}", { kind: String(f.kind), journey: String(f.journey), v1: String(f.step ?? "between steps"), detail: String(f.detail) }));
    for (const n of this.notes) lines.push(`note: ${n}`);
    if (this.pairs.length) lines.push(localize("journey-check.walker.length_pairs_live_beside_design", "{length} pairs, LIVE beside DESIGN, for BOB's comparison (R6):", { length: String(this.pairs.length) }), ...this.pairs.map((p) => `  ${p}`));
    const text = this.redact(lines.join("\n")) + "\n";
    writeFileSync(join(this.out, "report.txt"), text);
    writeFileSync(join(this.out, "report.json"), this.redact(JSON.stringify({ arm: this.arm, steps: this.steps, failures: this.failures, pairs: this.pairs, notes: this.notes }, null, 1)));
    return text;
  }
}

export class StepFailed extends Error {
  constructor(label, cause) { super(localize("journey-check.walker.step_label_failed_v1", "step \"{label}\" failed: {v1}", { label: String(label), v1: String(cause.message.split("\n")[0]) })); this.cause = cause; }
}

/* Settled: the document loaded, the network quiet for a moment, no loading state drawn. */
export async function settle(page) {
  try { await page.waitForLoadState("load", { timeout: 15000 }); } catch {}
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  try { await page.waitForFunction(() => !document.querySelector('[data-state="loading"]'), null, { timeout: 8000 }); } catch {}
}
