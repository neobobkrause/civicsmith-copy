/* run-rules: the AI run's rules without a store (build/requirements/run-rules.md). The pure rules and vocabulary
 * (`./rules.mjs`, R1–R8, R10, R13, R17, R18, R23, R26, R28, R35), the one deployment order, the modes `ask`, `draft` and
 * `enquire`, the verification that enables the next mode, the draft's kinds, whether a draft may read and whether a kind
 * is deployed (`./deployment.mjs`, R9, R14, R16, R19, R21, R22, R24, R25, R27, R33), the test bar and Civicsmith's test set
 * (`./test-bar.mjs`, `./test-set.mjs`, R19 as amended), the one deploy gate with the test-instance exception, its label
 * and its refusal (`./test-bar.mjs`, R29, R30), the test bar per AI and part, `GATE_PART_OF` and `PART_WITHDRAWN` (`./test-bar.mjs`, R19 and R29 as T53 amends them, R36, R37), and the table of every run refusal's row, with the words it reads by key
 * (`./checks.mjs`, R11, R15, R20, R28, R30, R31, R32, R35). Pure: no storage, no clock, no viewer. */
export * from "./rules.mjs";
export * from "./deployment.mjs";
export * from "./test-set.mjs";
export * from "./test-bar.mjs";
export * from "./checks.mjs";
