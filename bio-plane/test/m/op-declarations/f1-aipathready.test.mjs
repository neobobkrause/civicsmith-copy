/* op-declarations F1 (walk p3dev-t1, 4 Nov; coordinator 23:00): the frame's `op=aipathready` (interface-shell R20), a read
   act by surface-declarations R15, is declared and answered, never UNKNOWN_OP; with no path source registered it answers
   not ready, never a fabricated ready. Not yet met: its handler is ai-runs' to serve (blocked to BOB), so it is a todo. */
import { test } from "node:test";

test.todo("F1: the frame's ask of aipathready through the assembled door gets a declared answer, not UNKNOWN_OP; with no source registered it reads not ready (control: an undeclared name still answers UNKNOWN_OP)");
