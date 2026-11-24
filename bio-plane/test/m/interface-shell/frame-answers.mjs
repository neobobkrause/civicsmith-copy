/* The frame's four reads, answered by their owners' published fixtures (K5217, K5219): `groupidentity` by instance-setup, `interfacewords`
   (no language) by translations, `queue` by queue (one item: the list, or the count when asked), `signout` by credentials. Each call makes
   the answers over fresh worlds, never stored; a test takes them as its plane's answers and reads its expectations from them. */
import { groupIdentityAnswer } from "../instance-setup/fixtures.mjs";
import { interfaceWordsAnswer } from "../translations/fixtures.mjs";
import { feedWithItem, countWithItem } from "../queue/fixtures.mjs";
import { signout } from "../credentials/fixtures.mjs";
import { ok } from "./harness.mjs";

export async function frameAnswers() {
  const words = await interfaceWordsAnswer();
  const ended = await signout();
  return {
    groupidentity: ok(await groupIdentityAnswer()),
    interfacewords: ok(words.default),
    queue: (req) => (req.query && req.query.count ? ok(countWithItem()) : ok(feedWithItem())),
    signout: ok(ended.answer),
  };
}
