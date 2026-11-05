/* plane G91 (fix round 9; K4807 (2), K4811 (4)), the platform check L: the plane's own Worker and `Store` booted on workerd by `r8-headofline.test.mjs` under Miniflare, with the REAL alarm.
   `Headline` is the plane's `Store` plus two debug routes and one wrapper, and nothing else: `readHeld` (the reading owner the ledger's `pending-work` consumer calls) is wrapped to COUNT its
   completed passes (`/r8/state` answers the count, so the scanner stub in the test can state how many passes had completed when it ended: an ORDER by count, never a time, R-CLOCK); `/r8/rows`
   answers the ledger's rows and the scheduler's health. Every other request is the plane's own door.
   For r8-heal-door's R102 tests (BOB, bob-120: deterministic, no wall time), three test hooks, each off unless a test turns it on:
   `/r8/hold?on=1` makes the reading owner answer `NO_HOME` without reading (the ledger's uncounted wait, re-tried after its back-off), so a
   row stays owed by construction, never by how fast a reading runs; `/r8/clock?freeze=1` / `?advance=<ms>` hands the frame's `heal` a
   test clock instead of `Date.now()`, so its once-in-five-seconds window is passed by the test's own step, never by a sleep; and
   `alarm()` counts the firings it started and ended (`/r8/counters` `fired`), so a test reads that the alarm demonstrably ran. */
import { Store } from "../../../src/plane/store.mjs";
import { pendingOf } from "../../../src/store-assembly/pending.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { createHash } from "node:crypto";
import { recordOf } from "../../../src/record-core/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { sha256HexSync } from "../../../src/record-grammar/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
export { default } from "../../../src/plane/index.mjs";

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

export class Headline extends Store {
  #passes = 0;
  #results = [];   /* what each completed `readHeld` answered (a ring of the last ten, trimmed): a pass is a call that read, not one that found no home */
  #wrapped = false;
  #counted = null;   /* the platform's alarm calls the object made, counted (G93: "storage reads counted") */
  #hold = false;     /* R102 test hook: the reading owner answers NO_HOME, reading nothing */
  #clock = null;     /* R102 test hook: the `now` handed to the frame's heal, or null for the wall clock */
  #fired = { started: 0, ended: 0 };   /* the firings `alarm()` ran */
  async alarm(...a) { this.#fired.started++; try { return await super.alarm(...a); } finally { this.#fired.ended++; } }
  #wrap() {
    if (this.#wrapped) return;
    const ex = extractionOf(this.ctx), real = ex.readHeld.bind(ex);
    ex.readHeld = async (...a) => { if (this.#hold) return { ok: true, read: false, why: "NO_HOME" }; const r = await real(...a); this.#results.push(JSON.stringify(r).slice(0, 160)); if (this.#results.length > 10) this.#results.shift(); if (r && r.ok !== false && r.reason !== "NO_HOME") this.#passes++; return r; };
    this.#wrapped = true;
  }
  /* counts the object's calls on the platform's alarm: `getAlarm` (a look), `setAlarm` (an arm), `deleteAlarm` */
  #count() {
    if (this.#counted) return this.#counted;
    const st = this.ctx.storage, c = { getAlarm: 0, setAlarm: 0, deleteAlarm: 0, wrapped: true };
    for (const k of ["getAlarm", "setAlarm", "deleteAlarm"]) {
      const real = st[k].bind(st);
      try { Object.defineProperty(st, k, { value: (...a) => { c[k]++; return real(...a); }, configurable: true, writable: true }); } catch { c.wrapped = false; }
    }
    return (this.#counted = c);
  }
  /* R102: the heal frame's own work, counted at the frame: each call, and whether it looked at the platform's alarm (`getAlarm`) and armed it
     (`setAlarm`) inside that call, so a test judges the frame and not a firing that re-arms beside it */
  #heals = null;
  #countHeals() {
    if (this.#heals) return this.#heals;
    const h = { calls: 0, looks: 0, arms: 0 }, sch = schedulerOf(this.ctx, this.env), real = sch.heal.bind(sch), c = this.#count();
    sch.heal = async (...a) => {
      h.calls++;
      const g = c.getAlarm, s = c.setAlarm;
      const r = await real(...(this.#clock === null ? a : [this.#clock]));
      if (c.getAlarm > g) h.looks++;
      if (c.setAlarm > s) h.arms++;
      return r;
    };
    return (this.#heals = h);
  }
  async fetch(req) {
    this.#count();
    this.#countHeals();
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/r8/")) { this.#wrap(); return super.fetch(req); }
    this.#wrap();
    const step = url.pathname.slice(4);
    if (step === "state") return json({ passes: this.#passes, results: this.#results });
    if (step === "counters") { const alarm = await this.ctx.storage.getAlarm(); this.#counted.getAlarm--; return json({ ...this.#counted, alarm, heals: { ...this.#heals }, fired: { ...this.#fired } }); }   /* this read is not counted */
    if (step === "hold") { this.#hold = url.searchParams.get("on") === "1"; return json({ hold: this.#hold }); }
    if (step === "clock") {
      if (url.searchParams.get("freeze") === "1") this.#clock = Date.now();
      const by = Number(url.searchParams.get("advance") || 0);
      if (this.#clock !== null && Number.isFinite(by)) this.#clock += by;
      return json({ clock: this.#clock });
    }
    if (step === "rows") {
      let health = null; try { health = await schedulerOf(this.ctx, this.env).health(Date.now()); } catch (e) { health = { error: String(e && e.message || e) }; }
      return json({ passes: this.#passes, pending: pendingOf(this.ctx).list(), health, alarm: await this.ctx.storage.getAlarm() });
    }
    if (step === "notes") return json({ notes: [...this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM fs_notes")][0].n, files: [...this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM fs_files")][0].n });
    if (step === "file") {   /* what the capture screen does after an upload: the document is filed (promoted) with the capture as its file, so the reading has a home (harness.mjs's feed) */
      const { document, sha, bytes } = await req.json(), ctx = this.ctx, hex = (b) => createHash("sha256").update(b).digest("hex"), len = (t) => new TextEncoder().encode(t).length;
      const now = "2026-10-22T00:00:00Z", title = document.file, id = recordOf(ctx).allocId("INFO", "2026").id;
      const text = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(title), "current_state: collected", "prior_state: null", "created: " + now, "last_updated: " + now,
        "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
        "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + hex(title), "source:", "  locator: " + JSON.stringify(document.locator), "  authority: member-entered", "  retrieved: " + now,
        "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", title, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
      const prov = JSON.stringify({ documents: [document] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes, locator: document.locator, sha256: sha }] });
      const files = [{ path: "bundle.md", text, bytes: len(text), sha256: hex(text) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: hex(prov) },
        { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: hex(dataset) }, { path: document.file, blobSha: sha, sha256: sha, bytes }];
      const pr = promotionOf(ctx).promote({ bundleId: id, base: null, snapKey: "20261022T000000_" + hex(id).slice(0, 8), meta: { object_type: "information", title, current_state: "collected", created: now, last_updated: now },
        files, register: [{ sha256: sha, path: document.file, encoding: "binary", bytes }], author: "ann", actorMemberId: "ann", actorIdentity: "member:ann", actorViewer: "member:ann" });
      return json({ ok: pr && pr.ok === true, pr: pr && pr.ok === true ? undefined : pr, id });
    }
    if (step === "session") {   /* a signed-in member who may contribute, as the walker is: a session row, so the test goes through the real door with a bearer token (g55-alarm-l-entry.mjs) */
      const sql = this.ctx.storage.sql, now = Date.now(), founder = new URL(req.url).searchParams.get("as") === "founder", ANN = founder ? "admin" : "member:ann";   /* the founder's session is the bare `admin` (R90) */
      const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (!founder) sql.exec("INSERT OR IGNORE INTO members (member_id, cover, handle, role, status, capabilities, created, updated) VALUES ('ann','Cover ann','h_ann','member','active','[\"contribute\"]','t','t')");
      sql.exec("INSERT INTO sessions (token_sha, role, expires, created, device, last_active) VALUES (?,?,?,?,?,?)", sha256HexSync(token), ANN, now + 3_600_000, new Date(now).toISOString(), "shared", now);
      return json({ token });
    }
    if (step === "kill-alarm") { await this.ctx.storage.deleteAlarm(); return json({ deleted: true }); }
    return json({ error: "no such step" }, 404);
  }
}
