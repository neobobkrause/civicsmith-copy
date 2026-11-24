/* case-checker's published fixtures (K4990, K4993, K4995, K5044): what the checker answers to a caller that hands it a
   malformed argument, made by the checker's own code when the test runs and never stored. A user's test takes the
   answer from here and does not write it by hand. Each is called by a test of case-checker's own, `fixtures.test.mjs`,
   which checks the real answer. */
import { checkAccount } from "../../../src/case-checker/account.mjs";

/* `checkAccount` given an `account:` that is not a list of rows: the answer MALFORMED, naming the field (R24; account.mjs:205). */
export function checkAccountMalformed() {
  return checkAccount({ account: "x" });
}
