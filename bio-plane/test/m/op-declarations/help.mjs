/* R34 (affordances R48, R62, R64): an op is EXPLAINED when affordances' `ACT_HELP` holds its text, read here from affordances' own
   export (K3268), never a list of ops. (K4254) The fallback of K4070, by which the word was the text of six ops until `affordances`
   merged, is gone: `ACT_HELP` holds them. */
import { ACT_HELP } from "../../../src/affordances.mjs";

export const explained = (op) => Object.hasOwn(ACT_HELP, op) && typeof ACT_HELP[op] === "string" && ACT_HELP[op].length > 0;

/* R20, R24, R30, R41 restated for T53 (ai-accounts R35, BOB 4 Nov): the old door ops of the account seam, retired with no
   aliases. No module serves them, so none has a spec, a NEEDS row, a stamp or a session set (R6), and a registry act that
   still names one is a function its owner serves through no op (R21): it has no spec, and the job names it back to BOB. */
export const RETIRED_T53 = Object.freeze([
  "accountreferenceset", "accountreferenceremove", "accountreference",
  "groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeystate", "groupkeynotice", "groupkeynoticeseen",
  "subscriptiondisconnect",
  "projectkeyset", "projectsigninset", "projectaccountremove", "projectaccountswitch", "projectaccountstate",
  "projectkeynotice", "projectkeynoticeseen"]);
/* T53's new ai-accounts ops this module declares (ai-accounts R2, R46, R47, R52, R53, R65–R67) */
export const AI_ACCOUNTS_T53_READS = Object.freeze(["accountstate", "accountsof", "aichecks", "aioffered", "personalchoice"]);
export const AI_ACCOUNTS_PLANE_OPS = Object.freeze(["aicredential", "aigatewayserved", "aicredentialfailed"]);
