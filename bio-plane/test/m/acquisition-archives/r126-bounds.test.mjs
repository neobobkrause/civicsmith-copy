// acquisition-archives R126: a register piece's input is bounded by REGISTER_STREAM_MAX and its stored output cut at REGISTER_SEGMENT_MAX,
// both quoted from runtime-limits' READ_BOUNDS. Those rows wait on measure M-R7 (runtime-limits R47; build/plan/T53-R1/runtime-limits.md:15),
// so until it is recorded the figures do not exist and streamRegister refuses REGISTER_LIMITS_NOT_RECORDED (proved in
// bio-plane/test/m/acquisition/t53-register.test.mjs with test-supplied bounds). The quoted figures are owed, not pinned (K208).
import { test } from 'node:test';

test.todo('R126: REGISTER_STREAM_MAX and REGISTER_SEGMENT_MAX are READ_BOUNDS rows set from M-R7 (a 6 GiB stream refused over the recorded bound, accepted under it), not test-supplied bounds');
