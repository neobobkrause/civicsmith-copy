Length: 95 lines. Last section: "Suggestions".

# host-governor: requirements

Next number: 31

## Public

### Purpose

Paces this instance's outbound fetches, one host at a time, so it leans on another party's server no harder than a person would, and learns that party's capacity only by being refused. It holds one token bucket and one cool-off per host, decides admission, records the capacity signal in each outcome, and answers which hosts it is holding. It says nothing about whether a source is reachable: its refusal is a fact about this instance, never about the source.

### Provides

**governorAdmit({host}) → `{admitted: true, wait_ms, appetite_per_min}` or `{admitted: false, reason, retry_in_ms, …}`**
- **R1** [met] With no `host` (absent or empty), returns `{admitted: false, reason: "no host named"}` and writes nothing.
- **R2** [met] On first contact with a host, creates its state with a full burst of `burstTokens` (3) tokens, no cool-off and no refusals, before deciding.
- **R3** [met] The host's appetite (grants per minute) is, in order: the host's configured appetite (R11); else the instance binding `GOVERNOR_APPETITE_PER_MIN` when it is a positive finite number; else the default, 12. A binding that is absent, empty, non-numeric, zero or negative falls back to the default and is never obeyed.
- **R4** [met] While the host's cool-off lies in the future, refuses with `{admitted: false, reason: "cooling_off", retry_in_ms: cooloff_until − now, refusals, last_refusal_status}`, whatever the token balance and whatever appetite is configured; spends no token and adds one to `refused_total`.
- **R5** [met] Otherwise tokens refill continuously at the appetite per minute from the last refill, capped at `burstTokens`. With fewer than 1 token, refuses with `{admitted: false, reason: "appetite", retry_in_ms}`, `retry_in_ms` = ceil((1 − tokens) / appetite × 60,000), records the refilled balance, and adds one to `refused_total`.
- **R6** [met] Otherwise admits: spends one token, adds one to `granted`, and returns `wait_ms` = max(0, round(gap − time since the previous grant)), where gap = (60,000 / appetite) × j and j is drawn uniformly from [0.6, 1.5) on each grant (a jittered gap, never a fixed one). The grant is recorded as taking place at now + `wait_ms`, so the next grant is spaced from when this fetch goes out.
- **R29** [met] (fix round 3, C13, P4b; K4356; amends R1–R6, R15) **An admission may be asked without booking, and a host visit books once.** `governorAdmit({host, peek: true})` answers exactly as R1–R6 would at that instant (the same `admitted`, `wait_ms` and `appetite_per_min`, or the same refusal and `retry_in_ms`) and writes nothing: it spends no token, records no grant (`last_grant_at` and `granted` unchanged), adds nothing to `refused_total`, changes no cool-off, and creates no state for a host it has not met (R2's full burst is answered). A host visit that asks for its admission before it fetches (the render arm's, `acquisition` R5) and then fetches (R16) books one grant for the visit, not two: its token is spent once and its gap from the previous grant is judged once. A plain fetch (R15, R16) books as before. Test: a peek at a host with 3 tokens leaves `tokens`, `last_grant_at` and `granted` as they were; a peek and then `governedFetch` for one visit leave `granted` one higher; a peek at a host in cool-off answers R4's refusal and leaves `refused_total` as it was. Control: two plain `governedFetch` calls book two grants spaced as R6 spaces them.
- Errors: never throws on its own logic.

**governorReport({host, status, retry_after_ms}) → `{recorded, …}`**
- **R7** [met] With no `host`, returns `{recorded: false}` and writes nothing.
- **R8** [met] `status` 200–399: resets the host's consecutive refusals to 0 and returns `{recorded: true, refusals: 0}`. It does not shorten a cool-off.
- **R9** [met] `status` 429, 403 or 503: adds one to the host's consecutive refusals (n), records `last_refusal_at` and `last_refusal_status`, and sets the cool-off to end at the later of the cool-off already standing and now + max(min(cap, base × 2^(n−1)), `retry_after_ms`) (R21: no outcome shortens a cool-off; K122), where base/cap are 60 s / 1 h for 429 and 30 s / 30 min for 403 and 503. A counterparty's `Retry-After` is honoured when longer than the escalation, never when shorter. Returns `{recorded: true, refusals: n, cooloff_until, cooloff_ms}`.
- **R10** [met] Any other `status` (404, 500, and 0 for a fetch that produced no response) changes nothing and returns `{recorded: true, ignored: status}`: it is an outcome for monitoring, not a capacity signal.
- Errors: never throws on its own logic.

**governorConfig({host, appetite_per_min}) → `{configured, host, appetite_per_min}` or refusal**
- **R11** [met] With no `host`, returns `{configured: false}`; no global appetite can be set. With a host, creates its state if absent and sets its appetite to `appetite_per_min`, or, when it is `null` or omitted, clears it so R3's instance precedence applies again; returns `{configured: true, host, appetite_per_min}` (`null` when cleared).
- **R12** [met] A value that is present and not a positive finite number is refused with `BAD_APPETITE` and nothing is written.
- Errors: never throws.

**governorState({host}) → `{hosts: [row…]}`**
- **R13** [met] With `host`, answers that host's row, or none; it never creates one. Without, answers every row ordered by host. A row carries `host`, `appetite_per_min` (`null` means R3's precedence), `tokens`, `refilled_at`, `last_grant_at`, `cooloff_until`, `refusals`, `last_refusal_at`, `last_refusal_status`, `granted`, `refused_total`, `updated_at`.
- Errors: never throws.

**governorHolding({now}) → `[row…]`; isHeld(host, now) → boolean**
- **R14** [met] `governorHolding` answers every host whose cool-off ends after `now`, ordered by host, each as R13's row. `isHeld` answers whether one host's cool-off ends after `now`, `false` for a host with no state. Both use exactly R4's test (`cooloff_until > now`), spend no token and write nothing. (Today these are direct reads of the table by their consumers, `store.mjs` `#conditionsGovernorHolding` and `#captureRequestHostHeld`, and `index.mjs`'s subresource fetch through `governorstate`; extraction gives them this one interface.)
- Errors: never throws.

**governedFetch(target, {userAgent, fetch, governor}) → `{res}` or `{refusedByGovernor: true, reason, retry_in_ms, last_refusal_status}`**
- **R15** [met] Asks R1–R6 for the target's host (its URL `host`), through `governor` (`{admit, report}`, this module's R1–R6 as the caller reaches them: in process, or through the Durable Object from a Worker; K72). When refused, returns the refusal with nothing fetched.
- **R16** [met] When admitted, waits `wait_ms`, then fetches the target once, following redirects, with the user agent the caller supplied (this module composes none), and reports the response's status to R8–R10 with its `Retry-After` converted to milliseconds (delta-seconds × 1000, or an HTTP-date minus now, never below 0; `null` when absent). Returns `{res}`.
- **R17** [met] A governor that cannot be reached, or a target whose host cannot be read, never blocks the fetch: it proceeds ungoverned, and a report that cannot be recorded is dropped (politeness, not coordination; K47). A fetch that throws propagates its error, and nothing is reported.

**op=governorstate** (a read)
- **R18** [met] Reached by the `admin` and `probe` classes and by every session (a member's included; no `member` class since T36, admission R5) and by every session. `host=` narrows to one host; absent, all. Answers `{ok: true, hosts}` from R13. A store that does not answer is reported as silence (`storeSilent`), never as an empty `{ok: true}`, which would claim the instance is holding nothing.
- **R28** [met] (T47; N983; K3027) `op=governorstate` is evaluated at the server's instant, since its answer may gate an act (an operator's or a screen's choice to wait on a host): it takes no instant from the request, and a `now` or `nowMs` in the query or the body is ignored, never read, so a request carrying one answers exactly as the same request without it. Any judgement of time its answer carries is made at this module's own clock (R26's `now`, which tests set through `governorOf`), never at a caller's. (Today the answer is R13's rows as recorded, which judge no instant; R28 holds that, and holds any later field that does.)

**op=governorconfig** (a write)
- **R19** [met] Reached by the `admin` and `probe` classes and, among sessions, by the founder's session alone; an enrolled administrator's and a member's session are refused (the refusal and its wording are the session gate's, `admission` R8, split from `control-plane`, K624). Refuses a missing `host` with `NEED_HOST` and a present `appetite_per_min` that is not a positive number with `BAD_APPETITE`; an absent one clears the host's appetite (R11). A store that does not answer is reported as silence, never `{ok: true}`.

**How the module is reached: governorOf(ctx, opts?) → the instance** (K61)

- **R26** [met] (N132; K287) Answers the one `HostGovernor` for a Durable Object's storage (another handle on the same storage answers the same instance). `opts` is `{env, now, random, record}`: the bindings R3 reads, the clock, the jitter source, and record-core's instance (`recordOf(ctx)` by default). An option a caller supplies after the instance exists is never silently dropped: an `env`, `now` or `random` the instance took by default is adopted from the first later caller that supplies it (an `env` with no bindings counts as supplied), and R3 reads the adopted `env` from the next admission on; one that differs from what an earlier caller supplied (an `env` differs when any binding differs; `now` or `random` when it is another function), or any `record` other than the one held, is refused by a throw naming the option, before the caller gets an instance, and a refused call changes nothing. A call supplying nothing answers the instance unchanged.
- **R30** [met] (fix round 4, N-slow-refuse; K4429; amends R4, R9, R15, R16) **A refused host answers at once.** `governedFetch` for a host that refuses (a status 403 or 429, R9) or that stands in a cool-off (R4) returns the refusal to its caller within 3 seconds with `retry_in_ms` (R4's field; a first 403 or 429 answer carries it beside `res`), and never sleeps out a cool-off or a `Retry-After` inside the request; R6's pacing gap is waited only up to `maxWaitMs` (default 8 s, the whole gap at the default appetite, so a second capture from one site in quick succession waits and succeeds; K4437), and a longer wait (a low appetite) is refused as R5 refuses. The cool-off is recorded as R9 records it. Test: a fixture host answering 403, and one answering 429 with `Retry-After: 60`, are each refused to the caller in under 3 s with `retry_in_ms`; a second request to the cooling host is refused at once. Control: an admitted fetch waits `wait_ms` as R16 says; an unrefused status changes nothing.

## Private

### Uses

- `record-core.declarePurge`: declares `host_governor` exempt from purge (R24).

### Invariants

- **R20** [met] One bucket and one cool-off per host for the whole instance: admissions are serialised, so two admissions never spend the same token (the Durable Object serialises; a bucket in Worker memory would govern nothing).
- **R21** [met] Our appetite is a configured constant; their capacity is learned only from refusals (R9). No outcome raises an appetite or shortens a cool-off, and nothing probes a host to find its ceiling.
- **R22** [met] A configured appetite never outlasts a counterparty's refusal: R4 refuses during a cool-off whatever R11 set.
- **R23** [met] The governor records capacity signals only. It holds no verdict on whether a source is reachable, and none of its refusals is a statement about the source.
- **R24** [met] `host_governor` is this module's own table and no other module writes it. It is declared to `record-core` exempt from `purge` (K47), as today: a cool-off is a counterparty's refusal, and a purged instance still honours it.
- **R25** [met] No jurisdiction and no named counterparty: no host is named in this module. A per-host figure (the archive's 24/min) is set by the module that owns the knowledge of that counterparty, through R11.
- **R27** [met] (N339, K421) A store answer this module's Worker handlers relay that is the store's own refusal (`answer-envelope` R3: `ok: false` below 500) is answered with the store's status, code and sentence through `storeRefusal`; only a reply that is no answer is `STORE_DID_NOT_ANSWER`, with the store's correlation id when it gave one (`store-door` R6; N349). It reads the store's answer through the plane's `doAnswer`, handed in as `capture`'s handlers take it (K445).

### Satisfies

- `docs/architecture/BIO_System_Design.md` §3, construct 14 ("the host governor") and construct 2 (intake: who fetches, and how).
- `docs/architecture/BIO_Membership_Architecture_v2.md` §4, the 4.9 block (RULED 2026-09-21 by BOB #23): `governorconfig` is the operator's (R19); a host's configured appetite outranks the instance binding (R3); a configured appetite never outlasts a counterparty's refusal (R22); an administrator keeps sight through `governorstate` (R18).
- `docs/development/ARCHIVE-FALLBACK.md` §Rate limits: THIRD-PARTY FIGURES, not ours (appetite is ours, capacity is discovered by polite use being refused, never by probing; a 429 is never ignored, R9, R21), and §The scaling problem a per-instance governor cannot solve (it governs this instance only).
- `docs/development/SOURCE-ACCESS.md`, the rulings (the honest Civicsmith agent by default; the member-browser agent for publicly available documents under DEC-47's access-parity amendment): R16 sends the agent the caller chose.
- `docs/development/NOTIFICATIONS.md` §The catalogue ("governor is holding a host — the capture is PACED, not broken", CONDITION, D-103; "source unreachable, and distinguishably: governed by our own pacing", D-104) and §What the three classes actually ARE (a pacing governor is *shown in place*: the condition disposition `NOTIFICATIONS.md` calls "noticed", internally `shown-in-place` since N493, DEC-110 (3), so as not to clash with the member-facing "Noticed"): R14 supplies the fact, R23 keeps it about us.
- `docs/development/CLIENT-RENDERED.md` §RULED 2026-09-23 by BOB #32, item 3 (an unattended render goes through the host governor): the render arm asks R1–R6.
- `docs/architecture/BIO_Publication_v0_1.md` §7 (the group-domain verifier fetches through the per-host governor; a governor hold makes the verdict `undetermined`).

### Suggestions

- Inject the clock and the jitter source (`now()`, `random()`) so R5, R6 and R9 are testable exactly; today they read `Date.now()` and `Math.random()`.
- Obligations on callers, for their own requirements (convention 2): a governed refusal is never counted as a source failure (D-104; `capture`'s `recordSourceOutcome`, C-22.2 in `legacy-checks`); a page's subresources ride the primary fetch's admission rather than taking a token each, take a small jittered stagger (`GOVERNOR_SUBRESOURCE_STAGGER_MS`, default 50–250 ms), stop when `isHeld` becomes true, and report every outcome (`capture`, `index.mjs`'s subresource `fetchOne`); the archive lookup sets web.archive.org's appetite to 24 (`capture`); the queue's `governor-holding-host` item is built by `queue` from R14.
- `governedFetch` and the subresource `fetchOne` each parse `Retry-After`; one helper here removes the second copy.
- The host key is the string given; callers pass a URL's `host` (lowercased, port kept). The group-domain verifier passes the claimed domain as stored. Normalising the key here would make that uniform.
- **T47 (T47-68).** No route of this module reads a caller's instant today: `governorOp` forwards only `host`, and the store route hands `governorState` the body, which reads only `host`. R28 is therefore met by the code as it stands and made a requirement with its test at the interface (a `governorstate` request carrying `now` answers as one without). `governorHolding({now})` and `isHeld(host, now)` (R14) are in-plane reads whose callers pass their own clock (`machinery-producers`); no request reaches them, so N983 does not touch them.
- `bio-plane/test/governor.test.mjs` holds today's tests; `modules.json` places this module's at `bio-plane/test/m/host-governor/`. The chosen constants are recorded as chosen in `docs/development/MEASUREMENTS.md` (reference).
