/* mail-door — a member's private address and her waiting mail (layer 3, after `doorbell`; N824, K5504-K5506, K5527,
 * K5530 G, K5534). Mail sent to a member's private address under the team's mail domain waits privately, seen by its
 * owner alone, until she brings it into the record with her statement (`capture.emailCapture`, capture R116) or it is
 * removed after 14 days. It is the mail twin of the doorbell and the upload, and files nothing itself. Nothing here is
 * AI, and the product sends no mail. Requirements: build/requirements/mail-door.md (R1-R15).
 *
 * SHAPE. `mailDoorOf(ctx, deps)` answers the one instance for a Durable Object's storage. It reaches `capture`'s
 * instance for the same storage (`captureOf(ctx)`, or `deps.capture`), from which it reads `env` at each use (the
 * `CAPTURES` evidence bucket, `MAIL_ADDRESS_KEY`, `BIO_NOW_MS`) and through which it files a message; record-core
 * (`transact`, `declarePurge`) is capture's; membership's instance for the storage answers who administers (R9). The
 * mail domain and the on/off switch are the composition's, handed in as `deps.settings()` answering
 * `{mail_domain, mail_door}` (instance-setup R114); this module uses neither `instance-setup` nor `scheduler`, which use
 * it. No member's own email address is asked for, stored or used (K5505): the address a message was sent to says who
 * it is for, and `envelope_from` is read for nothing. */
import { readMessage } from "../mail-reader/index.mjs";
import { boundOf, statement as boundStatement } from "../read-bounds.mjs";
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { INSTALLATION_CHECKS } from "../acquisition/index.mjs";
import { membershipOf, notAnAdmin } from "../membership/index.mjs";
import { viewerMember } from "../member-roster/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { evidenceAbsent } from "../capture/ops.mjs";
import { MAIL_CHECKS, rowOf } from "./checks.mjs";
import { MAIL_DOOR_SCHEMA, MAIL_DOOR_EXEMPT_TABLES } from "./schema.mjs";
import { localize } from "../setup-words/index.mjs";
export { MAIL_CHECKS } from "./checks.mjs";
export { MAIL_DOOR_SCHEMA, MAIL_DOOR_EXEMPT_TABLES } from "./schema.mjs";

const te = new TextEncoder();
const hexOf = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const HOUR = 3600000, DAY = 86400000;

/* R4: the header fields a row and the owner's view answer. */
const FIELDS = ["from", "to", "cc", "date", "date_utc", "subject", "message_id", "received", "authentication_results"];
/* R7 (K5692): a header's text with every email address taken out, and the brackets left empty by it; a display name
   stays. An array is cleaned item by item; null stays null. */
const ADDRESS = /<?\s*(?:mailto:)?[^\s<>"'(),;:@\[\]]+@[^\s<>"'(),;:@\[\]]+\s*>?/gi;
export function withoutAddresses(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(withoutAddresses);
  return String(v).replace(ADDRESS, " ").replace(/\(\s*\)|<\s*>/g, " ").replace(/\s+([,;])/g, "$1").replace(/\s{2,}/g, " ").trim() || null;
}

/* The figures, each read from `runtime-limits` (its R37, R46) when it is needed, never written here (R6, R8). */
const MAIL_BOUND = () => boundOf("mail", "message_bytes");
const PER_MEMBER_HOUR = () => boundOf("mail", "per_member_hour");
const PER_TEAM_DAY = () => boundOf("mail", "per_team_day");
const WAITING_DAYS = () => boundOf("mail", "waiting_days");

/* R1: the private address's local part: `m-` and 12 characters of Crockford's base32 (60 bits), lower case. */
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";
const base32Of = (bytes) => {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};
export const LOCAL_PART = Object.freeze({ prefix: "m-", chars: 12 });

/* R3: a waiting list's page, at most 200 rows (`limit` clamped 1 to 200). */
export const WAITING_PAGE_MAX = 200;
/* R6: a clearing's batch, default 200, clamped 1 to 1000. */
export const CLEAR_LIMIT = Object.freeze({ default: 200, max: 1000 });
/* R15: how many days a clearing's kept owners are answered. */
export const CLEARED_KEEP_DAYS = 30;
/* R9: how many UTC days the tally keeps. */
export const TALLY_DAYS = 30;

const cursorOf = (parts) => btoa(String.fromCharCode(...te.encode(JSON.stringify(parts)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const keyOf = (cursor) => {
  try {
    const k = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(cursor).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    return Array.isArray(k) && k.length === 2 && Number.isSafeInteger(k[0]) && typeof k[1] === "string" ? k : null;
  } catch { return null; }
};

/* A member's id from a stamp the control plane wrote (`member:<id>` or the bare id), or null: absent, not a string,
   blank, naming no member, or a machine identity (capture R86's fence, as `captureupload` reads it). */
export function memberOf(stamp) {
  if (typeof stamp !== "string" || isMachineIdentity(stamp)) return null;
  const id = stamp.replace(/^member:/, "").trim();
  return id && !isMachineIdentity(id) ? id : null;
}

/* R1, R5: the member-session fence, as capture R86 states it. */
const memberSessionRequired = () => ({ ok: false, reason: "MEMBER_SESSION_REQUIRED", status: 403,
  detail: localize("mail-door.index.member_session_required", "your private address and your waiting mail are a signed-in member's own; this caller is not one, so nothing was read or written") });

/* R13: a refusal of this module's family, its row read at the moment it is raised. */
const refusal = (code, extra = {}) => { const row = rowOf(code); return { ok: false, reason: code, code, check: row.check, translation: row.translation, ...extra }; };

/* R11, MAIL_WITHIN_FAILED (no C row, as K2452 keeps UPLOAD_WITHIN_FAILED): the one sentence a failed `within` answers. */
export const MAIL_WITHIN_FAILED_DETAIL = localize("mail-door.index.within_failed", "the act run with this one did not complete, so it was rolled back and nothing was written");
const WITHIN_FAULT = Symbol("within's fault");

const instances = new WeakMap();

/** The one MailDoor for this object's storage. `deps`: `capture` (`captureOf(ctx)` by default; its `env` is read at
 *  each use), `record` (capture's own), `membership` (`membershipOf` for the storage, reached when first needed),
 *  `settings` (a function answering `{mail_domain, mail_door}`; none: the door is off, R12). */
export function mailDoorOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let d = instances.get(storage);
  if (d) return d;
  const capture = deps.capture ?? captureOf(ctx);
  d = new MailDoor(storage, { capture, record: deps.record ?? capture.core, membership: deps.membership ?? null, settings: deps.settings ?? null });
  d.migrate();
  instances.set(storage, d);
  return d;
}

export class MailDoor {
  #sql; #storage; #declared = false;

  constructor(storage, { capture, record = null, membership = null, settings = null } = {}) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.capture = capture;
    this.core = record;
    this.membership = membership;
    this.settings = settings;
  }

  get env() { return (this.capture && this.capture.env) || {}; }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #tx(fn) { return this.core && typeof this.core.transact === "function" ? this.core.transact(fn) : this.#storage.transactionSync(fn); }

  /** This module's tables, idempotent, declared to record-core's purge as exempt (a refusal throws, naming the table). */
  migrate() {
    const bare = MAIL_DOOR_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    if (!this.#declared && this.core && typeof this.core.declarePurge === "function") {
      const answer = this.core.declarePurge("mail-door", [], { exempt: [...MAIL_DOOR_EXEMPT_TABLES] });
      if (answer && answer.ok === false) throw new Error(`mail-door: record-core refused its purge declaration: ${answer.reason} (${answer.table})`);
      this.#declared = true;
    }
  }

  /* ---- the clock (R14: capture R115's) and the settings (R12) ---- */

  /** R14: the instant, in epoch milliseconds: a `now` the caller hands (a finite number from 0, or an ISO instant), else
   *  the environment's `BIO_NOW_MS`, else the wall clock. */
  nowMs(now = null) {
    const n = typeof now === "string" && now !== "" && !/^\d+$/.test(now) ? Date.parse(now) : Number(now);
    if (now != null && now !== "" && Number.isFinite(n) && n >= 0) return n;
    const pinned = Number(this.env.BIO_NOW_MS);
    if (this.env.BIO_NOW_MS != null && this.env.BIO_NOW_MS !== "" && Number.isFinite(pinned) && pinned >= 0) return pinned;
    return Date.now();
  }

  /** R12: `{on, domain}`: the door is on only with the switch on and a mail domain set; a settings reader that fails
   *  or answers anything else reads off. */
  doorState() {
    let s = null;
    try { s = typeof this.settings === "function" ? this.settings() : null; } catch { s = null; }
    const domain = s && typeof s.mail_domain === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.mail_domain.trim()) ? s.mail_domain.trim().toLowerCase() : null;
    return { domain, on: !!domain && !!s && s.mail_door === true };
  }

  /* ---- the instance key and the digests (R1, R8) ---- */

  #key() {
    const bound = typeof this.env.MAIL_ADDRESS_KEY === "string" && this.env.MAIL_ADDRESS_KEY;
    if (bound) return te.encode(bound);
    let r = this.#one(`SELECT key_hex FROM mail_key WHERE id = 1`);
    if (!r) {
      const k = new Uint8Array(32);
      crypto.getRandomValues(k);
      this.#tx(() => this.#sql.exec(`INSERT OR IGNORE INTO mail_key (id, key_hex, created) VALUES (1, ?, ?)`, hexOf(k), new Date().toISOString()));
      r = this.#one(`SELECT key_hex FROM mail_key WHERE id = 1`);
    }
    return Uint8Array.from(r.key_hex.match(/../g).map((h) => parseInt(h, 16)));
  }

  async #mac(text) {
    const k = await crypto.subtle.importKey("raw", this.#key(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(text)));
  }

  /* R1: the address a salt names under the instance key and the domain. */
  async #addressOf(salt, domain) {
    return `${LOCAL_PART.prefix}${base32Of(await this.#mac(`local:${salt}`)).slice(0, LOCAL_PART.chars)}@${domain}`;
  }

  /** R1: the keyed digest of an address (lower-cased, trimmed), what the door matches; never the address. */
  async addressDigest(address) { return hexOf(await this.#mac(`addr:${String(address ?? "").trim().toLowerCase()}`)); }

  /* ==================================================================== *
   * R1: a member's private address
   * ==================================================================== */

  /** R1: the viewer's own live address, to her alone: `{ok: true, address}` (null when she has none, or the door has no
   *  domain); a viewer asking of another member answers nothing (`address: null`). Writes nothing. */
  async mailAddressOf({ member = null, viewer = null } = {}) {
    const me = memberOf(viewer);
    if (!me) return memberSessionRequired();
    const of = member == null || member === "" ? me : memberOf(member);
    const { domain } = this.doorState();
    if (of !== me || !domain) return { ok: true, address: null };
    const row = this.#one(`SELECT salt FROM mail_address WHERE member_id = ? AND live = 1`, me);
    return { ok: true, address: row ? await this.#addressOf(row.salt, domain) : null };
  }

  /** R1: a new address for `by`, the old one turned off in the same act. Refused: the member-session fence;
   *  `MAIL_NOT_SET_UP` with no mail domain or the switch off (R12). `within` (synchronous) is called inside the act's
   *  transaction; its `{ok: false}` rolls the act back and is the answer, a throw or a promise `MAIL_WITHIN_FAILED`. */
  async mailAddressMake({ by = null, within = null } = {}) {
    const me = memberOf(by);
    if (!me) return memberSessionRequired();
    const { domain, on } = this.doorState();
    /* DEC-49 REGION is-mail-set-up */
    if (!domain || !on) return refusal("MAIL_NOT_SET_UP", { status: 409 });
    /* END DEC-49 REGION is-mail-set-up */
    const r = new Uint8Array(16);
    crypto.getRandomValues(r);
    const salt = hexOf(r);
    const address = await this.#addressOf(salt, domain);
    const digest = await this.addressDigest(address);
    const when = new Date(this.nowMs()).toISOString();
    try {
      const done = this.#tx(() => {
        this.#sql.exec(`UPDATE mail_address SET live = 0, off_at = ? WHERE member_id = ? AND live = 1`, when, me);
        this.#sql.exec(`INSERT INTO mail_address (digest, member_id, salt, live, made) VALUES (?, ?, ?, 1, ?)`, digest, me, salt, when);
        if (typeof within !== "function") return { ok: true };
        const w = MailDoor.#callWithin(within, { member: me, made: when });
        return w && typeof w === "object" && w.ok === false ? w : { ok: true, within: w ?? null };
      });
      if (!done.ok) return done;
      return { ok: true, address, made: when, ...("within" in done ? { within: done.within } : {}) };
    } catch (e) {
      if (e && typeof e === "object" && WITHIN_FAULT in e) return { ok: false, reason: "MAIL_WITHIN_FAILED", status: 500, detail: MAIL_WITHIN_FAILED_DETAIL };
      throw e;
    }
  }

  /** R1: turn `by`'s live address off. `{ok: true, off}`: whether one was live. */
  mailAddressOff({ by = null } = {}) {
    const me = memberOf(by);
    if (!me) return memberSessionRequired();
    const when = new Date(this.nowMs()).toISOString();
    let off = false;
    this.#tx(() => {
      off = !!this.#one(`SELECT 1 AS x FROM mail_address WHERE member_id = ? AND live = 1`, me);
      this.#sql.exec(`UPDATE mail_address SET live = 0, off_at = ? WHERE member_id = ? AND live = 1`, when, me);
    });
    return { ok: true, off };
  }

  /* ==================================================================== *
   * R2, R8, R9, R10: the door
   * ==================================================================== */

  /* R8: the two windows a message is asked against: its address's hour and the team's day, each the current bucket and
     the previous one, keyed by the address's keyed digest, never the address. */
  #windows(digest, nowMs) {
    const wm = Math.floor(nowMs / HOUR), wt = Math.floor(nowMs / DAY);
    return { m: `m:${digest.slice(0, 32)}:${wm}`, mPrev: `m:${digest.slice(0, 32)}:${wm - 1}`, mFrac: (nowMs - wm * HOUR) / HOUR, wm,
             t: `t:${wt}`, tPrev: `t:${wt - 1}`, tFrac: (nowMs - wt * DAY) / DAY, wt };
  }

  /* R8: the two-bucket weighted sliding window (`doorbell` R2's estimate): `prev x (1 - elapsed/W) + cur`, refused at
     the bound. The refusal answers its row and the figure only in `stated`. */
  #rateRefusal(w) {
    const cnt = (b) => this.#one(`SELECT count FROM mail_rate WHERE bucket = ?`, b)?.count || 0;
    const est = (cur, prev, frac) => cnt(prev) * (1 - Math.min(1, Math.max(0, frac))) + cnt(cur);
    /* DEC-49 REGION is-mail-rate */
    if (est(w.m, w.mPrev, w.mFrac) >= PER_MEMBER_HOUR())
      return refusal("MAIL_RATE_MEMBER", { status: 429, stated: localize("mail-door.stated.per_member_hour", "At most {n} messages in any hour to one private address, estimated by a sliding window.", { n: String(PER_MEMBER_HOUR()) }) });
    if (est(w.t, w.tPrev, w.tFrac) >= PER_TEAM_DAY())
      return refusal("MAIL_RATE_TEAM", { status: 429, stated: localize("mail-door.stated.per_team_day", "At most {n} messages in any day to the whole team, estimated by a sliding window.", { n: String(PER_TEAM_DAY()) }) });
    /* END DEC-49 REGION is-mail-rate */
    return null;
  }

  /* R8: asked again inside the act's transaction and, when it admits, one message counted in both windows; buckets
     older than the previous one are pruned. */
  #count(w) {
    const late = this.#rateRefusal(w);
    if (late) return late;
    for (const b of [w.m, w.t]) this.#sql.exec(`INSERT INTO mail_rate (bucket, count) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET count = count + 1`, b);
    this.#sql.exec(`DELETE FROM mail_rate WHERE (bucket LIKE 'm:%' AND bucket NOT LIKE '%:' || ? AND bucket NOT LIKE '%:' || ?)
                     OR (bucket LIKE 't:%' AND bucket NOT IN (?, ?))`, String(w.wm), String(w.wm - 1), w.t, w.tPrev);
    return null;
  }

  /* R9: one refusal counted in the day's tally, `address` or `size_or_rate`; days past the last 30 dropped. A count that
     cannot be written changes nothing. */
  #tally(kind, nowMs) {
    try {
      const day = new Date(nowMs).toISOString().slice(0, 10);
      const oldest = new Date(Date.parse(`${day}T00:00:00Z`) - (TALLY_DAYS - 1) * DAY).toISOString().slice(0, 10);
      const col = kind === "address" ? "address" : "size_or_rate";
      this.#tx(() => {
        this.#sql.exec(`INSERT INTO mail_tally (day, ${col}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + 1`, day);
        this.#sql.exec(`DELETE FROM mail_tally WHERE day < ?`, oldest);
      });
    } catch { /* the tally is status, never a gate */ }
  }

  /* R2: the bytes of `raw` (a Uint8Array, an ArrayBuffer or a ReadableStream), read to the bound: past it the stream is
     cancelled and `{over: true, size}` answered. */
  static async #readBounded(raw, bound) {
    if (raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
      const b = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      return b.length > bound ? { over: true, size: b.length } : { bytes: b };
    }
    if (!raw || typeof raw.getReader !== "function") return { bytes: new Uint8Array(0) };
    const reader = raw.getReader();
    const parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const c = value instanceof Uint8Array ? value : new Uint8Array(value);
      n += c.length;
      if (n > bound) { try { await reader.cancel(); } catch { /* cancelled */ } return { over: true, size: n }; }
      parts.push(c);
    }
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return { bytes: out };
  }

  static async #cancel(raw) { try { if (raw && typeof raw.cancel === "function") await raw.cancel(); } catch { /* cancelled */ } }

  /** R2: mail at the door. Refused in order, each writing nothing but R9's tally: the door off (`MAIL_OFF`); `envelope_to`
   *  not a live member address (`MAIL_NO_SUCH_ADDRESS`, one answer for unknown and switched off); the member's hourly or
   *  the team's daily bound (R8); a declared `size` over the bound before a byte is read, and a stream passing it
   *  (cancelled) (`MAIL_TOO_LARGE`); zero bytes (`MAIL_EMPTY`); `mail-reader`'s nesting refusal, relayed unchanged
   *  (R10). Otherwise one waiting row (R3), or the existing one for the same bytes and owner (`existed: true`, R10).
   *  `envelope_from` is read for nothing and kept nowhere. Nothing is sent. */
  async receiveMail({ raw = null, envelope_to = null, envelope_from: _unread = null, size = null, now = null } = {}) {
    const nowMs = this.nowMs(now);
    const turnedAway = async (kind, answer) => { await MailDoor.#cancel(raw); this.#tally(kind, nowMs); return answer; };
    const { on } = this.doorState();
    /* DEC-49 REGION is-mail-door-open */
    if (!on) return turnedAway("address", refusal("MAIL_OFF", { status: 503 }));
    /* END DEC-49 REGION is-mail-door-open */
    const digest = await this.addressDigest(envelope_to);
    const addr = typeof envelope_to === "string" ? this.#one(`SELECT member_id FROM mail_address WHERE digest = ? AND live = 1`, digest) : null;
    /* DEC-49 REGION is-mail-address-live */
    if (!addr) return turnedAway("address", refusal("MAIL_NO_SUCH_ADDRESS", { status: 404 }));
    /* END DEC-49 REGION is-mail-address-live */
    const w = this.#windows(digest, nowMs);
    const early = this.#rateRefusal(w);
    if (early) return turnedAway("size_or_rate", early);
    const bound = MAIL_BOUND();
    const declared = Number(size);
    /* DEC-49 REGION is-mail-within-bound */
    if (size != null && Number.isFinite(declared) && declared > bound)
      return turnedAway("size_or_rate", refusal("MAIL_TOO_LARGE", { status: 413, ...boundStatement("mail", "message_bytes", declared) }));
    const got = await MailDoor.#readBounded(raw, bound);
    if (got.over) return turnedAway("size_or_rate", refusal("MAIL_TOO_LARGE", { status: 413, ...boundStatement("mail", "message_bytes", got.size) }));
    /* END DEC-49 REGION is-mail-within-bound */
    const bytes = got.bytes;
    /* DEC-49 REGION is-mail-not-empty */
    if (!bytes.length) return turnedAway("size_or_rate", refusal("MAIL_EMPTY", { status: 400 }));
    /* END DEC-49 REGION is-mail-not-empty */
    /* R3, R4, R10: mail-reader before anything is kept; its nesting refusal relayed unchanged; any other failure to read
       leaves every header null with its reason, the message kept whole. */
    const read = await readMessage(bytes, { route: "address" });
    if (!read.ok && read.reason === "MAIL_TOO_NESTED") return turnedAway("size_or_rate", read);
    const bucket = typeof this.env.CAPTURES?.put === "function" ? this.env.CAPTURES : null;
    if (!bucket) {
      const row = INSTALLATION_CHECKS.EVIDENCE_STORAGE_NOT_CONFIGURED;
      return { ok: false, reason: "EVIDENCE_STORAGE_NOT_CONFIGURED", code: "EVIDENCE_STORAGE_NOT_CONFIGURED", check: row.check, translation: row.translation, status: 503,
               detail: localize("mail-door.index.no_evidence_storage", "this team's Civicsmith has no evidence storage configured, so a message cannot be held; nothing was received") };
    }
    const sha = hexOf(await crypto.subtle.digest("SHA-256", bytes));
    const owner = addr.member_id;
    const key = `bio/mail/${sha}`;
    let stored = false;
    try {
      if (!(await bucket.head(key))) { await bucket.put(key, bytes, { sha256: await crypto.subtle.digest("SHA-256", bytes) }); stored = true; }
    } catch {
      return { ok: false, reason: "MAIL_NOT_STORED", status: 502, detail: localize("mail-door.index.not_stored", "the message could not be stored, so nothing was received") };
    }
    const facts = MailDoor.#factsOf(read);
    const mailId = `MAIL-${new Date(nowMs).toISOString().slice(0, 10)}-${hexOf(crypto.getRandomValues(new Uint8Array(4)))}`;
    const answer = this.#tx(() => {
      const late = this.#count(w);
      if (late) return late;
      const had = this.#one(`SELECT mail_id FROM mail_waiting WHERE owner = ? AND sha256 = ?`, owner, sha);
      if (had) return { ok: true, existed: true, id: had.mail_id };
      this.#sql.exec(`INSERT INTO mail_waiting (mail_id, owner, sha256, bytes, received, received_ms, status, headers, automatic)
                      VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
                     mailId, owner, sha, bytes.length, new Date(nowMs).toISOString(), nowMs, JSON.stringify(facts.stated), facts.automatic ? 1 : 0);
      return { ok: true, existed: false, id: mailId };
    });
    if (!answer.ok) {
      if (stored && !this.#one(`SELECT 1 AS x FROM mail_waiting WHERE sha256 = ?`, sha)) { try { await bucket.delete?.(key); } catch { /* content-addressed */ } }
      this.#tally("size_or_rate", nowMs);
      return answer;
    }
    return { ...answer, bytes: bytes.length, sha256: sha, automatic: facts.automatic };
  }

  /* R4, R7, R10: what a row keeps of mail-reader's answer: the headers as the message states them with every email
     address taken out (a display name stays; R7, K5692: no row but the stored bytes holds a person's address), the reason
     any could not be read, and whether the message says it is automatic. The owner's own view reads the whole headers
     from the stored bytes (`mailRead`). */
  static #factsOf(read) {
    if (!read || !read.ok) {
      return { automatic: false, stated: { headers: Object.fromEntries(FIELDS.map((f) => [f, null])), unreadable: { message: read?.reason ?? "MAIL_MALFORMED" }, attachments: [] } };
    }
    const h = read.headers || {};
    const auto = (h.auto_submitted != null && String(h.auto_submitted).trim().toLowerCase().split(/[;\s]/)[0] !== "no")
      || /^(bulk|junk)$/i.test(String(h.precedence ?? "").trim()) || h.list_id != null || h.return_path === "<>";
    return { automatic: !!auto,
             stated: { headers: Object.fromEntries(FIELDS.map((f) => [f, f === "message_id" ? h[f] ?? null : withoutAddresses(h[f])])), unreadable: read.unreadable || {},
                       attachments: (read.attachments || []).map((a) => ({ index: a.index, name_stated: withoutAddresses(a.name_stated), type_stated: a.type_stated ?? null, size: a.size ?? null })) } };
  }

  /* ==================================================================== *
   * R3, R4: the waiting list
   * ==================================================================== */

  /* R3: NO_SUCH_MAIL, one answer for absent and not hers. */
  #noSuchMail(id) {
    /* DEC-49 REGION is-mail-yours */
    return refusal("NO_SUCH_MAIL", { status: 404, id: typeof id === "string" ? id : null });
    /* END DEC-49 REGION is-mail-yours */
  }

  #own(id, me) {
    if (typeof id !== "string" || !id || !me) return null;
    const r = this.#one(`SELECT * FROM mail_waiting WHERE mail_id = ?`, id);
    return r && r.owner === me ? r : null;
  }

  /* R3, R4: a row as its owner reads it. */
  #view(r, nowMs) {
    let stated = null;
    try { stated = r.headers ? JSON.parse(r.headers) : null; } catch { stated = null; }
    const left = Math.max(0, WAITING_DAYS() - Math.floor((nowMs - Number(r.received_ms)) / DAY));
    return {
      id: r.mail_id, received: r.received, bytes: Number(r.bytes), sha256: r.sha256, status: r.status,
      days_left: r.status === "waiting" ? left : null, automatic: !!r.automatic,
      headers: stated ? stated.headers : null, unreadable: stated ? stated.unreadable : null,
      stated_by: localize("mail-door.index.as_the_message_states_it", "as the message states it"),
      capture: r.capture_sha ? { sha256: r.capture_sha, brought_by: r.brought_by, brought_at: r.brought_at } : null,
    };
  }

  /** R3: the viewer's own rows only, newest first, at most 200 a page, with `next`. */
  mailWaiting({ viewer = null, limit = null, after = null, now = null } = {}) {
    const me = memberOf(viewer);
    if (!me) return memberSessionRequired();
    const n = Math.floor(Number(limit));
    const cap = limit != null && limit !== "" && Number.isFinite(n) && n > 0 ? Math.min(WAITING_PAGE_MAX, n) : WAITING_PAGE_MAX;
    const from = after ? keyOf(after) : null;
    if (after && !from) return { ok: false, reason: "BAD_CURSOR", status: 400, detail: localize("mail-door.index.bad_cursor", "`after` is not a cursor this read answered as `next`") };
    const found = this.#rows(`SELECT * FROM mail_waiting WHERE owner = ? ${from ? "AND (received_ms, mail_id) < (?, ?)" : ""}
                              ORDER BY received_ms DESC, mail_id DESC LIMIT ?`, me, ...(from || []), cap + 1);
    const rows = found.slice(0, cap), last = rows[rows.length - 1], nowMs = this.nowMs(now);
    return { ok: true, mail: rows.map((r) => this.#view(r, nowMs)), limit: cap, truncated: found.length > cap,
             next: found.length > cap ? cursorOf([Number(last.received_ms), last.mail_id]) : null };
  }

  /** R3, R4: one row's headers, text and attachment list (name and size as stated, never opened), to its owner only. */
  async mailRead({ id = null, viewer = null, now = null } = {}) {
    const me = memberOf(viewer);
    if (!me) return memberSessionRequired();
    const r = this.#own(id, me);
    if (!r) return this.#noSuchMail(id);
    const view = this.#view(r, this.nowMs(now));
    const bytes = await this.#bytesOf(r.sha256);
    const read = bytes ? await readMessage(bytes, { route: "address" }) : null;
    let stated = null;
    try { stated = JSON.parse(r.headers); } catch { stated = null; }
    const whole = read && read.ok ? { headers: Object.fromEntries(FIELDS.map((f) => [f, read.headers[f] ?? null])), unreadable: read.unreadable || {} } : {};
    return { ok: true, mail: { ...view, ...whole,
      text: read && read.ok ? read.body.text : null,
      text_basis: read && read.ok ? null : bytes ? localize("mail-door.index.text_unreadable", "the message's text could not be read; it is kept whole as received")
        : localize("mail-door.index.text_in_record", "the message is in the record now; read it there"),
      attachments: read && read.ok ? read.attachments.map((a) => ({ index: a.index, name_stated: a.name_stated ?? null, size: a.size ?? null })) : (stated?.attachments ?? []).map((a) => ({ index: a.index, name_stated: a.name_stated, size: a.size })) } };
  }

  async #bytesOf(sha) {
    const bucket = typeof this.env.CAPTURES?.get === "function" ? this.env.CAPTURES : null;
    try {
      const obj = bucket ? await bucket.get(`bio/mail/${sha}`) : null;
      if (!obj) return null;
      const b = new Uint8Array(await obj.arrayBuffer());
      return hexOf(await crypto.subtle.digest("SHA-256", b)) === sha ? b : null;
    } catch { return null; }
  }

  /* R5, R6: the private bytes deleted, unless another waiting row still names them. */
  async #dropBytes(sha) {
    if (this.#one(`SELECT 1 AS x FROM mail_waiting WHERE sha256 = ? AND status = 'waiting'`, sha)) return false;
    try { await this.env.CAPTURES?.delete?.(`bio/mail/${sha}`); return true; } catch { return false; }
  }

  /* ==================================================================== *
   * R5: bring a message into the record
   * ==================================================================== */

  /** R5: `by`'s waiting message filed through `capture.emailCapture` (capture R116) with her statement. Refused in order,
   *  each writing nothing: the member-session fence; `NO_SUCH_MAIL` (not hers answers the same); `MAIL_ALREADY_IN`
   *  (with the capture, `existed: true`); then capture's own refusals, relayed (`MAIL_NO_STATEMENT`, C-118.12, is
   *  capture's row). Inside capture's act the row reads `brought_in`; the answer is capture's. Once the capture's job
   *  rows are registered (its answer), the private bytes are deleted. */
  async mailBringIn({ id = null, statement = null, by = null, within = null } = {}) {
    const me = memberOf(by);
    if (!me) return memberSessionRequired();
    const r = this.#own(id, me);
    if (!r) return this.#noSuchMail(id);
    /* DEC-49 REGION is-mail-waiting */
    if (r.status === "brought_in")
      return refusal("MAIL_ALREADY_IN", { status: 409, id: r.mail_id, existed: true, capture: { sha256: r.capture_sha } });
    /* END DEC-49 REGION is-mail-waiting */
    if (typeof this.capture?.emailCapture !== "function")
      throw new Error("mail-door: capture's emailCapture (capture R116) is not on this capture instance; the composition is wrong");
    const bytes = await this.#bytesOf(r.sha256);
    if (!bytes) return evidenceAbsent(r.sha256, "mail", { id: r.mail_id, status: 404 }).body;
    let stated = null;
    try { stated = JSON.parse(r.headers); } catch { stated = null; }
    const mark = (at) => this.#sql.exec(`UPDATE mail_waiting SET status = 'brought_in', capture_sha = ?, brought_by = ?, brought_at = ?
                                          WHERE mail_id = ? AND status = 'waiting'`, r.sha256, me, at, r.mail_id);
    const at = new Date(this.nowMs()).toISOString();
    const inner = (document) => { mark(at); return typeof within === "function" ? within(document) : undefined; };
    const read = await readMessage(bytes, { route: "address" });
    const headers = read.ok ? Object.fromEntries(FIELDS.map((f) => [f, read.headers[f] ?? null])) : stated ? stated.headers : null;
    const answer = await this.capture.emailCapture({ bytes, headers, statement, by, within: inner });
    if (!answer || answer.ok !== true) return answer;
    /* bytes the record already held: capture did not call `within`, so the row is marked here */
    if (this.#one(`SELECT status FROM mail_waiting WHERE mail_id = ?`, r.mail_id)?.status === "waiting") this.#tx(() => mark(at));
    await this.#dropBytes(r.sha256);
    return answer;
  }

  /* ==================================================================== *
   * R6: removal
   * ==================================================================== */

  /** R6: `by` deletes her own waiting message at once, with its bytes: no reason, no record. A message already brought
   *  in answers `MAIL_ALREADY_IN` and is kept. */
  async mailDelete({ id = null, by = null } = {}) {
    const me = memberOf(by);
    if (!me) return memberSessionRequired();
    const r = this.#own(id, me);
    if (!r) return this.#noSuchMail(id);
    if (r.status !== "waiting") return refusal("MAIL_ALREADY_IN", { status: 409, id: r.mail_id, existed: true, capture: { sha256: r.capture_sha } });
    this.#tx(() => this.#sql.exec(`DELETE FROM mail_waiting WHERE mail_id = ?`, r.mail_id));
    await this.#dropBytes(r.sha256);
    return { ok: true, id: r.mail_id, deleted: true };
  }

  #dueBefore(nowMs) { return nowMs - WAITING_DAYS() * DAY; }

  /** R6: whether any waiting message is due for removal at `now`. */
  mailClearDue(now = null) {
    return !!this.#one(`SELECT 1 AS x FROM mail_waiting WHERE status = 'waiting' AND received_ms <= ? LIMIT 1`, this.#dueBefore(this.nowMs(now)));
  }

  /** R6: the instant (epoch ms) the next waiting message falls due, at or before `now` when one already is; null when none waits. */
  mailClearWake(now = null) {
    const r = this.#one(`SELECT MIN(received_ms) AS m FROM mail_waiting WHERE status = 'waiting'`);
    return r && r.m != null ? Number(r.m) + WAITING_DAYS() * DAY : null;
  }

  /** R6: each waiting message older than `MAIL_WAITING_DAYS` deleted with its bytes, oldest first, at most `limit`
   *  (default 200, clamped 1 to 1000): `{ok, cleared, truncated, owners}`, `owners` each removed message's owner with
   *  the count and the received instants, never a sender, subject or text. A brought-in message is never removed.
   *  Writes no record and no receipt, and calls no notice module (a `notice-producers` line reads `owners`). */
  async clearWaitingMail({ now = null, limit = null } = {}) {
    const n = Math.floor(Number(limit));
    const cap = limit != null && limit !== "" && Number.isFinite(n) ? Math.min(CLEAR_LIMIT.max, Math.max(1, n)) : CLEAR_LIMIT.default;
    const found = this.#rows(`SELECT mail_id, owner, sha256, received FROM mail_waiting WHERE status = 'waiting' AND received_ms <= ?
                              ORDER BY received_ms, mail_id LIMIT ?`, this.#dueBefore(this.nowMs(now)), cap + 1);
    const due = found.slice(0, cap);
    const owners = new Map();
    for (const r of due) {
      const o = owners.get(r.owner) || { owner: r.owner, count: 0, received: [] };
      o.count += 1; o.received.push(r.received);
      owners.set(r.owner, o);
    }
    const nowMs = this.nowMs(now), clearedAt = new Date(nowMs).toISOString();
    this.#tx(() => {
      for (const r of due) this.#sql.exec(`DELETE FROM mail_waiting WHERE mail_id = ? AND status = 'waiting'`, r.mail_id);
      /* R15: each owner's count kept for notice-producers, in the same act; entries past CLEARED_KEEP_DAYS dropped */
      for (const o of owners.values())
        this.#sql.exec(`INSERT INTO mail_cleared (owner, count, received_dates, cleared_at, cleared_ms) VALUES (?, ?, ?, ?, ?)`,
          o.owner, o.count, JSON.stringify(o.received), clearedAt, nowMs);
      this.#sql.exec(`DELETE FROM mail_cleared WHERE cleared_ms < ?`, nowMs - CLEARED_KEEP_DAYS * DAY);
    });
    for (const sha of new Set(due.map((r) => r.sha256))) await this.#dropBytes(sha);
    return { ok: true, cleared: due.length, truncated: found.length > cap, owners: [...owners.values()] };
  }

  /** R15: the clearing's kept owners, in order of `cleared_at`, to the producer's stamp (a machine identity) alone; a
   *  member, or no viewer, is answered nothing. `after` is the `cursor` of an earlier page; `limit` clamped 1 to 1000
   *  (default 200). `{ok, entries: [{owner, count, received_dates, cleared_at}], cursor, truncated}`; an entry made more
   *  than 30 days before `now` is not answered. Writes nothing; never throws. */
  clearedOwners({ after = null, limit = null, viewer = null, now = null } = {}) {
    const none = { ok: true, entries: [], cursor: null, truncated: false };
    try {
      if (typeof viewer !== "string" || !isMachineIdentity(viewer)) return none;
      const n = Math.floor(Number(limit));
      const cap = limit != null && limit !== "" && Number.isFinite(n) ? Math.min(CLEAR_LIMIT.max, Math.max(1, n)) : CLEAR_LIMIT.default;
      let fromMs = -1, fromSeq = -1;
      if (after != null && after !== "") {
        const m = /^(\d+)\.(\d+)$/.exec(String(after));
        if (!m) return none;
        fromMs = Number(m[1]); fromSeq = Number(m[2]);
      }
      const oldest = this.nowMs(now) - CLEARED_KEEP_DAYS * DAY;
      const found = this.#rows(`SELECT seq, owner, count, received_dates, cleared_at, cleared_ms FROM mail_cleared
                                WHERE cleared_ms >= ? AND (cleared_ms > ? OR (cleared_ms = ? AND seq > ?))
                                ORDER BY cleared_ms, seq LIMIT ?`, oldest, fromMs, fromMs, fromSeq, cap + 1);
      const page = found.slice(0, cap);
      const last = page[page.length - 1];
      return { ok: true,
               entries: page.map((r) => ({ owner: r.owner, count: Number(r.count), received_dates: JSON.parse(r.received_dates), cleared_at: r.cleared_at })),
               cursor: last ? `${Number(last.cleared_ms)}.${Number(last.seq)}` : (after ?? null), truncated: found.length > cap };
    } catch { return none; }
  }

  /* ==================================================================== *
   * R9: the tally
   * ==================================================================== */

  #membership() {
    if (!this.membership) this.membership = membershipOf({ storage: this.#storage }, { record: this.core });
    return this.membership;
  }

  /** R9: the kept days with a refusal, newest first, to a signed-in administrator only. Writes nothing. */
  mailTally({ viewer = null, now = null } = {}) {
    const m = viewer === "admin" ? "admin" : viewerMember(viewer);
    let admin = false;
    try { admin = !!m && this.#membership().isAdministrator(m); } catch { admin = false; }
    if (!admin) return notAnAdmin(viewer ?? null, localize("mail-door.index.reading_mail_tally", "reading the tally of mail turned away"));
    const today = new Date(this.nowMs(now)).toISOString().slice(0, 10);
    const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - (TALLY_DAYS - 1) * DAY).toISOString().slice(0, 10);
    return { ok: true, days: this.#rows(`SELECT day, address, size_or_rate FROM mail_tally WHERE day >= ? ORDER BY day DESC`, oldest)
      .map((r) => ({ day: r.day, address: Number(r.address), size_or_rate: Number(r.size_or_rate) })) };
  }

  /* `within`, called inside the act's transaction with its own copy of the argument; a throw or a promise is tagged. */
  static #callWithin(within, arg) {
    let w;
    try { w = within(structuredClone(arg)); } catch { throw { [WITHIN_FAULT]: true }; }
    if (w && typeof w.then === "function") { Promise.resolve(w).catch(() => {}); throw { [WITHIN_FAULT]: true }; }
    return w;
  }
}

/** R12: the member acts on the plane's route map, each a function of no arguments. `url` carries the control plane's
 *  stamps (`by`, `viewer`), never the body's; `body` the parsed body. The mail entry (`receiveMail`) is not an op. */
export function mailDoorOps(d, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body || {};
  const arg = (k) => (b[k] !== undefined ? b[k] : q(k));
  return {
    mailaddress: () => {
      const act = arg("act");
      if (act === "make") return d.mailAddressMake({ by: q("by") });
      if (act === "off") return d.mailAddressOff({ by: q("by") });
      if (act != null && act !== "" && act !== "read")
        return { ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op: "mailaddress", argument: "act", shape: "read | make | off", status: 400,
                 detail: localize("mail-door.index.act_shape", "op=mailaddress takes act read, make or off; nothing was read or changed") };
      return d.mailAddressOf({ viewer: q("viewer") });
    },
    mailwaiting: () => d.mailWaiting({ viewer: q("viewer"), limit: arg("limit"), after: arg("after") }),
    mailread: () => d.mailRead({ id: arg("id"), viewer: q("viewer") }),
    mailbringin: () => d.mailBringIn({ id: arg("id"), statement: b.statement ?? q("statement"), by: q("by") }),
    maildelete: () => d.mailDelete({ id: arg("id"), by: q("by") }),
    mailtally: () => d.mailTally({ viewer: q("viewer") }),
  };
}

/* R12 (`op-declarations` R80-R81, `op-grades` R49-R50): the ops this module serves, declared by their owner beside the
   ops map. `contribute` is the act's capability (member-roster R1), named in `needs` and checked at the door by the op's
   class as `captureupload` is (control-plane R72, `store-assembly`'s declaration): member sessions only, no machine class. */
export const DECLARED_OPS = Object.freeze({
  mailaddress: { classes: ["admin", "member"], machineClasses: [], stamps: ["viewer", "by"], needs: "contribute", mutating: true, weight: "reversible",
    description: localize("mail-door.declared.mailaddress", "a member's own private mail address: read it, make a new one (the old one off in the same act) or turn it off; answered to her alone"),
    fields: { accepts: ["act"], requires: [] } },
  mailwaiting: { classes: ["admin", "member"], machineClasses: [], stamps: ["viewer", "by"], needs: "contribute", mutating: false, weight: "read",
    description: localize("mail-door.declared.mailwaiting", "read: the viewer's own waiting mail, newest first, bounded and paged; writes nothing"),
    fields: { accepts: ["limit", "after"], requires: [] } },
  mailread: { classes: ["admin", "member"], machineClasses: [], stamps: ["viewer", "by"], needs: "contribute", mutating: false, weight: "read",
    description: localize("mail-door.declared.mailread", "read: one of the viewer's own waiting messages, its headers as stated, text and attachment list, keyed by id; writes nothing"),
    fields: { accepts: ["id"], requires: ["id"] } },
  mailbringin: { classes: ["admin", "member"], machineClasses: [], stamps: ["viewer", "by"], needs: "contribute", mutating: true, weight: "undetermined",
    description: localize("mail-door.declared.mailbringin", "a member brings one of her waiting messages into the record with her statement of where it came from, keyed by id: filed as a capture, whole, headers included"),
    fields: { accepts: ["id", "statement"], requires: ["id", "statement"] } },
  maildelete: { classes: ["admin", "member"], machineClasses: [], stamps: ["viewer", "by"], needs: "contribute", mutating: true, weight: "reversible",
    description: localize("mail-door.declared.maildelete", "a member deletes one of her own waiting messages at once, with its bytes, keyed by id; no reason and no record"),
    fields: { accepts: ["id"], requires: ["id"] } },
  mailtally: { classes: ["admin"], machineClasses: [], stamps: ["viewer"], mutating: false, weight: "read",
    description: localize("mail-door.declared.mailtally", "read: the count-only tally of mail turned away, by day, for an administrator; holds no sender, address or message, and writes nothing"),
    fields: { accepts: [], requires: [] } },
});
