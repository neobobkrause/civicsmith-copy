/* translations' published fixtures (K4990, K4993): each answer is made by this module's real code when the test runs, never
   stored, so a user's test takes the answer the module gives and not one it wrote by hand. */
import assert from "node:assert/strict";
import { boot, frame } from "./fixture.mjs";
import { world as aiAccountsWorld } from "../ai-accounts/fixture.mjs";
import { interfaceWords } from "../../../src/translations/index.mjs";

/** The real `registerMemberLanguageRead` and `wordsVersion` (R11, R20). `registered` is the real answer of a first
 *  registration of a read that answers `language` for every viewer (`{ok: true}`), `words_version` the real stamp of a
 *  team that has adopted nothing, and `translations` a fresh instance of the real module with no read registered yet,
 *  for a test that hands it to its user (`more` hands in the module's providers, as `boot` takes them): it answers `registerMemberLanguageRead` and `wordsVersion` as the module does. */
export function memberLanguageRead({ language = "es", more = {} } = {}) {
  const read = () => ({ ok: true, language, set_at: null });
  const first = boot({ more }).m;
  const registered = first.registerMemberLanguageRead(read);
  return { registered, words_version: first.wordsVersion(), translations: boot({ more }).m };
}

/** The real `interfacewords` answer (R8, R19; `op=interfacewords` through `frame`, as the control plane's door meets it), for the
 *  two readers the interface shell reads it for: `default`, a member who reads no language (the default: the shell's English,
 *  so no word is held), and `other`, a member who reads `language`, after one real adoption of an ordinary word (shown at once,
 *  R5). Made over a fresh world each call, never stored: the default answer is taken before the adoption, so the stamp moves
 *  between the two (R20). */
export async function interfaceWordsAnswer({ language = "es" } = {}) {
  const c = aiAccountsWorld();
  await c.group("ruth", "sam", "tom");
  const chosen = new Map();
  const w = boot({ more: { membership: c.m, aiAccounts: c.a } });
  w.m.registerMemberLanguageRead(({ viewer } = {}) => ({ ok: true, language: chosen.get(viewer) ?? null, set_at: null }));
  w.m.translationGrant({ member: "ruth", language, by: "admin" });
  const answer = async (viewer) => (await (await frame(w.m, new Request(`http://do/interfacewords?viewer=${viewer}`))).json()).result;
  const def = await answer("tom");
  chosen.set("sam", language);
  const ordinary = interfaceWords().find((x) => !x.protected && !/\{/.test(x.en));
  assert.equal(w.m.translationAdopt({ language, key: ordinary.key, text: "Algo", by: "ruth" }).state, "shown");
  return { default: def, other: await answer("sam") };
}

/** The real `translationdraft` answer (R16, R18), for a reachable assistant (the door's `assistant`: the group's account, `on`):
 *  `to_language` asks for the words still missing in `es` by a member who holds the grant, and `to_english` asks an administrator
 *  to read the one kept protected word back into English. The platform's model turn is not built: after the first refusals and
 *  the gates the module answers `ASSISTANT_DRAFT_UNAVAILABLE` with the words the door would send, and writes nothing. Made over a
 *  fresh world each call, never stored. */
export async function translationDraftAnswer({ direction = "to_language" } = {}) {
  const c = aiAccountsWorld();
  await c.group("ruth", "sam");
  const w = boot({ more: { membership: c.m, aiAccounts: c.a } });
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  const assistant = { on: true, account: { kind: "apikey", level: "group" } };
  if (direction === "to_english") {
    const protectedWord = interfaceWords().find((x) => x.protected && !/\{/.test(x.en));
    w.m.translationAdopt({ language: "es", key: protectedWord.key, text: "Escrito", by: "ruth" });
    return w.m.translationDraft({ language: "es", direction, key: protectedWord.key, by: "admin", assistant });
  }
  return w.m.translationDraft({ language: "es", direction, by: "ruth", assistant });
}
