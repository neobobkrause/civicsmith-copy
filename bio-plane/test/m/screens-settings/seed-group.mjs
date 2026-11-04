/* The world of the `group`, `group-identity` and `translations` tests (store-request's `storeWorld`, K5054): a team made by the real acts
   of its founder, and the few rows no act can make (a record's size the platform states, a recorder the installer or a machine is, a
   correction the door strips its source from). Each seed says what it replaces. */
import { storeWorld } from "./kit.mjs";

/** The sealing secret a deployment sets so that a key can be kept (ai-accounts R22; a platform binding, so a double of the environment). */
export const SEAL = "a-long-seal-secret-for-screens-settings";

/** The profile the team works under (its zone is America/Los_Angeles, as the profile holds it). */
export const PROFILE = "oakland-alameda";
export const ZONE_PATH = `${PROFILE}/time_zone`;

/** A team: its founder (the one active administrator and the root of trust), `rosa` (an administrator who is not the founder: the owner's
 *  administrator acts of instance-setup and corpus-export refuse her, membership's accept her) and `dev` (a member who does not administer),
 *  each signed in. `instanceName` is the slug the installer bound for the first boot; `null` binds none, so the team records no producing team (an older
 *  installation: `groupidentity` answers `group: null`; store-request R19's `olderInstallation`). */
export async function team({ env = {}, instanceName } = {}) {
  const w = await storeWorld({ env, ...(instanceName !== undefined ? { instanceName } : {}) });
  const founder = await w.signIn("founder");
  const rosa = await w.signIn("rosa", { admin: true });
  const dev = await w.signIn("dev", { capabilities: ["contribute"] });
  return { w, founder, rosa, dev };
}

/** The handle the roster gives a member (what the screens say for her, never the id). */
export const handleOf = async (as, id = "admin") => (await as.read("memberlist")).members.find((m) => m.member_id === id).handle;

/** The website's file, as the claim's answer gives it: what the team has to put on it for the check to find it. */
export const fileOf = async (as) => (await as.read("groupidentity")).domain_claim.well_known;

/** The team's website, answering for `domain` the file `answer()` gives (a function: a test changes what the site says between two checks;
 *  an `{status}` is a site answering that status). The network is the platform's: the world refuses every address until it is scripted. */
export function site(w, domain, answer) {
  w.script((req) => new URL(req.url).host === domain, () => {
    const a = answer();
    return a && a.status ? new Response("", { status: a.status }) : new Response(JSON.stringify(a), { status: 200, headers: { "content-type": "application/json" } });
  });
  return w;
}

/** A team the way the screens' tests find it: named, with its website claimed and verified, two languages, the court notice told, the hosting
 *  account recorded (by rosa), the bar set, the stake declared, the profile chosen and two copies of the record taken. Answers what the
 *  owners then say, for the tests to read their expectations from. */
export async function eastoak(t, { copies = true } = {}) {
  const { w, founder, rosa } = t;
  await founder.act("groupnameset", { body: { name: "East Oakland Watch" } });
  await founder.act("grouplanguagesset", { body: { languages: ["en", "es"] } });
  await founder.act("courtnoticeset", { body: { choice: "tell" } });
  await rosa.act("hostingaccessset", { body: { holders: "Rosa and Lu", note: "the shared vault" } });
  await founder.act("strengthbarset", { body: { capture: "B", connection: "C", reason: "Most of our sources are records." } });
  await founder.act("declaredstakeset", { body: { stake: null } });
  await founder.act("declaredstakeset", { body: { stake: "Several of our members rent from landlords the city regulates." } });
  await founder.act("profilesset", { body: { profiles: [PROFILE] } });
  const claimed = await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  site(w, "eastoak.example", () => claimed.well_known.body);
  await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  if (copies) {
    await founder.act("export", { query: {} });
    await founder.act("export", { query: { note: "Before the Coliseum lease hearing" } });
  }
  return t;
}

/** A member the roster knows with the handle `handle` that differs from her id (the sign-in makes the id the handle). */
export async function enrolled(w, founder, id, handle) {
  const added = await founder.act("memberadd", { body: { memberId: id, cover: `the world's member ${id}` } });
  const r = await w.door({ url: "/api/?op=enroll", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ invite: added.invite, handle, password: "a-long-passphrase-for-" + handle }) } }, null);
  if (r.status >= 400) throw new Error("enroll refused: " + JSON.stringify(r.json));
  return id;
}
/** A member who was invited and has not enrolled (the roster gives her no handle). */
export async function invited(founder, id) {
  await founder.act("memberadd", { body: { memberId: id, cover: `the world's member ${id}` } });
  return id;
}

const iso = (w) => new Date(w.now()).toISOString();

/** SEED, no act makes it: the hosting account recorded by `by` as the installer's bootstrap or a machine credential records it
 *  (membership's `hostingaccessset` refuses every machine: NOT_AN_ADMIN) or by a member whose id the roster knows by another handle. */
export function hostedBy(w, by, holders = "Rosa and Lu", note = null) {
  w.sql.exec("INSERT INTO hosting_access (holders, note, recorded_by, at) VALUES (?, ?, ?, ?)", holders, note, by, iso(w));
}
/** SEED, no act makes it: the name's latest history row set by `by` (the store records the session's member, never a machine's name). */
export function namedBy(w, by, name = "East Oakland Watch") {
  w.sql.exec("INSERT INTO group_identity_history (field, value, set_at, set_by) VALUES ('display_name', ?, ?, ?)", name, iso(w), by);
}
/** SEED, no act makes it: the stake's latest history row set by `by`, the stake itself being the one the real act declared. */
export function stakeBy(w, by) {
  const last = w.sql.exec("SELECT stake FROM declared_stake_history ORDER BY seq DESC LIMIT 1").toArray()[0];
  w.sql.exec("INSERT INTO declared_stake_history (stake, set_by, set_at) VALUES (?, ?, ?)", last ? last.stake : null, by, iso(w));
}
/** SEED, no act makes it: a copy of the record in the list with the counts given (a record's tables are the schema's and are never one). */
export function copyOf(w, { bundles, files, tables, rows = 1, note = null }, at = iso(w)) {
  w.sql.exec("INSERT INTO export_log (at, scope, bundles, files, note, tables, rows) VALUES (?, 'working-corpus', ?, ?, ?, ?, ?)", at, bundles, files, note, tables, rows);
}

/** The record's size, which the platform states and no act sets (the world's storage states 0): the world's storage stating `bytes`
 *  (a number, or null for a storage that states none). The real `stats` then answers it as `dbBytes` to the founder. */
export function sized(w, bytes) {
  Object.defineProperty(w.sql, "databaseSize", { get: () => bytes, enumerable: true, configurable: true });
  return w;
}

/** The team's own account, held (T53, R95: by `aiaccountadd`, the alpha's group key retired), by the real acts (the password asked again first, as an administrator's page does): the
 *  assistant is then reachable. The world holds `ACCOUNT_SEAL_SECRET` (`team({ env: { ACCOUNT_SEAL_SECRET: SEAL } })`). */
export async function holdKey(as, w, key = "sk-ant-api03-SENTINELKEY") {
  await as.act("reauth", { body: { password: w.password } });
  await as.act("aiaccountadd", { body: { owner: "group", provider: "anthropic", plan: "api-team", means: "sealed", secret: key } });
  return key;
}

/** WORLD GAP: the door of the world asks no draft after a draft-due act (store-request door, "no draft asked"), so the assistant's draft is
 *  answered at the platform's edge, in the shape the door's own step gives (control-plane draft: `text`, `label`, `withheld`, `note`), asked by `as`. */
export const WRITING_HELP = (as) => ({ ok: true, result: { ok: true, text: "The group's members rent in East Oakland.", label: { kind: "machine", asked_by: "member:" + as.member }, withheld: [], note: "" } });
export const DESCRIPTION_DRAFT = (as) => ({ ok: true, result: { ok: true, focus: { text: "Potholes and street repair in East Oakland.", label: { kind: "machine", asked_by: "member:" + as.member } },
  purpose: { text: "To hold the city to its repair promises.", label: { kind: "machine", asked_by: "member:" + as.member } } } });

/** A real answer of `as` for `op` with `keys` left out: a read the owner never gives in this form (a world reaches only the state the acts make,
 *  and this one the owner's answer always carries). Answers the table entry. */
export const without = (as, op, ...keys) => async () => {
  const r = { ...(await as.read(op)) };
  for (const k of keys) delete r[k];
  return { ok: true, result: r };
};

/** WORLD GAP: the interface's word list is the 26,000 words of setup-words, and the answer of `translations` lists every one; the page draws a row for
 *  each, which the test's document stand-in cannot draw in a test's time. The same real answer with only the words the test is about. */
export const onlyWords = (as, keys) => async (q) => {
  const r = await as.read("translations", { query: q });
  return { ok: true, result: { ...r, words: r.words.filter((w) => keys.includes(w.key)) } };
};

/** SEED, no act makes it (the assistant's draft is asked by the door, which the world's does not do): a draft of the word `key` in `language` as
 *  the assistant kept it, asked by `by` (translation_drafts). Answers the draft's id as the owner then lists it. */
export function draftOf(w, language, key, en, text, by) {
  return w.sql.exec("INSERT INTO translation_drafts (language, key, en, text, label, asked_by, asked_name, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING seq",
    language, key, en, text, JSON.stringify({ kind: "machine", drafter: "assistant" }), by, by, iso(w)).toArray()[0].seq;
}
/** SEED, no act makes it (the English is the release's, and a release does not change in a test): the English a kept translation was made from. */
export function englishWas(w, language, key, was) {
  w.sql.exec("UPDATE translation_adoptions SET en = ? WHERE language = ? AND key = ?", was, language, key);
}
