# following: requirement notes

## T53 (R37–R46), job/following attempt 1, 7 Nov 2026

**Met:** R37, R38, R39, R40, R41, R42, R43, R44, R46. **Open:** R45.

**R45 is open: two owners for one op.** R45 gives `following` the ops `registerwatch` and `registerwatchstop` (N1259-e §1 agrees). But `registers` already declares and serves both (`bio-plane/src/registers/ops.mjs`, its watch of a stated interest). Two problems follow:

- `op-declarations`' `registerDeclaredOps` refuses an op that two owners declare.
- `assemble.mjs` spreads `followingOps` after `registersOps`, so `following`'s arms would silently replace `registers`' at the door.

R45 can be met once `registers` drops its two rows, or once BOB rules otherwise. The functions those ops would call are already here: `followRegisterQuery` (R37) and `registerWatchStop` (R45, R46).

**Owed by other modules (not drafted here):**

- **`store-assembly`.** Hand `following` its keyed path: `keyed: {store}`, acquisition's store with `credentials`, its ledger (`store.acquisition`) and `followStanding` answered by `following.followStanding`. Without it, a docket's alert is served as a page read and says `alert: "off"` (R41's off path).
- **`events` R38.** Accept the entries' content type (`courtlistener_api`), and key an entry by the system rather than by the content type (as R41 says). Until then, R41 hands each entries capture to `followedRegister` for a proceeding the follow names. `events`' answer is reported beside the read, and its refusal does not hold the follow back.
- **`modules.json` edges (BOB's, P17).** `following` now uses `registers`, `court-doctypes` (R38's assess) and `acquisition`'s `keyedCapture`.

**Found, not acted on.** An answer that returns to bytes this host already holds cannot be landed again (`CAPTURE_HELD_BY_ANOTHER_BUNDLE` from the host's `land`). This is true for every follow kind (`#take`). So a register-query answer that reverts to an earlier version is reported as a failed read, not as a change.
