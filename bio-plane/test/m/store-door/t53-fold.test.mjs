/* R20, R21 (T53; N1264, K4599 (a)): not yet met. They rest on admission R34 (`admit` callable inside the room with the room's
   session row; not yet met) and on op-declarations' combined read `screenread` with declared per-read bounds, which no module
   serves yet; the room's RPC itself is plane's Durable Object. Named here as todos (K208), never as red tests. */
import { test } from "node:test";

test.todo("R20 (T53; N1264, K4599 (a); admission R34): one RPC `admitted(op, request)` resolves the session, judges admission, stamps and runs the op — a `whoami`, `groupidentity`, `bootstrap` and `queue` each make one call to the room, and the answer's `in_ms` and per-read times are reported as `Server-Timing`");
test.todo("R21 (T53; N1264, K4599 (a); K4354): a read in a combined answer that would run longer than its declared bound is cut, answered `ok: false, status: \"slow\"` with the bound, and the other reads answer whole");
