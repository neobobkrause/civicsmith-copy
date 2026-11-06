# acquisition-archives — requirements notes

- **R126, 5 Nov 2026.** Struck as met with test-supplied bounds, on BOB's ruling of 17:24 (`bio-plane/test/m/acquisition-archives/r126-bounds.test.mjs`; also `bio-plane/test/m/acquisition/t53-register.test.mjs`). The figures `REGISTER_STREAM_MAX` and `REGISTER_SEGMENT_MAX` stay owed by `runtime-limits` R47, which waits on measure M-R7; until they are recorded `streamRegister` refuses `REGISTER_LIMITS_NOT_RECORDED` and fetches nothing.
