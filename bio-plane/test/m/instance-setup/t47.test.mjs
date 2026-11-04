/* T47 (T47-75): the group's logo (R84), the languages its members use (R85), and the disclosure read the composition
   root registers with ai-accounts (R54's T47 clause, re-pointed in T48, N996), at the module's interface. R82 and R83 are tested in t46.test.mjs
   and page.test.mjs beside the requirements they amend. Every refusal has a control (K874). */
import test from "node:test";
import { TRANSLATIONS_CHECKS } from "../../../src/translations/checks.mjs";
import assert from "node:assert/strict";
import { boot, frame, io, envOver, stubOver, instanceSetupOps } from "./fixture.mjs";
import { InstanceSetup, INSTANCE_SETUP_CHECKS, INSTANCE_SETUP_TABLES, INSTANCE_SETUP_TABLE_DECLARATIONS, GROUP_LOGO_MAX_BYTES,
         GROUP_LANGUAGES_SETTING, GROUP_LANGUAGES_MAX, ASSISTANT_DISCLOSURE, DISCLOSURE_READER, disclosureReadOf,
         groupLogoAsset } from "../../../src/setup.mjs";
import { list as heldProfiles, get as heldProfile } from "../../../../jurisdictions/index.mjs";
import { world as aiAccountsWorld } from "../ai-accounts/fixture.mjs";

const call = async (m, path, body) => (await frame(m, new Request(`http://do/${path}`,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))).json();
const b64 = (bytes) => Buffer.from(Uint8Array.from(bytes)).toString("base64");
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0];
const setLogo = (w, raw, by, rawType) => w.m.groupLogoSet({ raw, rawType, by });
const logoRows = (w) => w.st.db.prepare(`SELECT * FROM group_logos`).all();

/* ---- R84: the group's logo ---- */

test("R84 grouplogoset: an administrator sets a PNG, read back by groupLogo with its type and bytes and by groupidentity as logo: true; a JPEG sent as a stream replaces it; raw: null clears it to logo: false; each act appended with who and when", async () => {
  let now = "2026-10-14T09:00:00Z";
  const w = await boot({ env: { INSTANCE_NAME: "river-town" }, now: () => Date.parse(now) });
  assert.deepEqual(w.m.groupLogo(), { ok: true, logo: null });
  assert.equal(w.m.groupIdentityPublic().logo, false);
  const set = await setLogo(w, Uint8Array.from(PNG), "admin", "image/png");
  assert.deepEqual([set.ok, set.logo, set.type, set.bytes, set.set_by, set.set_at],
    [true, true, "image/png", PNG.length, "admin", "2026-10-14T09:00:00.000Z"]);
  assert.match(set.sha256, /^[0-9a-f]{64}$/);
  const got = w.m.groupLogo().logo;
  assert.deepEqual([got.type, got.bytes, got.data, got.sha256], ["image/png", PNG.length, b64(PNG), set.sha256]);
  assert.equal(w.m.groupIdentityPublic().logo, true);
  assert.equal(w.m.groupIdentity().logo, true, "the credentialed read answers it too (R11 carries R10)");
  /* R86: the bytes as a stream (the request body as the door hands it on), no declared type; a JPEG known by its magic bytes */
  now = "2026-10-14T10:00:00Z";
  const jpeg = await setLogo(w, new Blob([Uint8Array.from(JPEG)]).stream(), "member:ada");
  assert.deepEqual([jpeg.ok, jpeg.type, w.m.groupLogo().logo.type], [true, "image/jpeg", "image/jpeg"]);
  now = "2026-10-14T11:00:00Z";
  const clear = await setLogo(w, null, "admin");
  assert.deepEqual([clear.ok, clear.logo], [true, false]);
  assert.deepEqual(w.m.groupLogo(), { ok: true, logo: null });
  assert.equal(w.m.groupIdentityPublic().logo, false);
  assert.deepEqual(logoRows(w).map((r) => [r.type, r.set_by, r.set_at]), [["image/png", "admin", "2026-10-14T09:00:00.000Z"],
    ["image/jpeg", "member:ada", "2026-10-14T10:00:00.000Z"], [null, "admin", "2026-10-14T11:00:00.000Z"]]);
});

test("R84 R86 refusals, each writing nothing: a member or a machine NOT_AN_ADMIN; a GIF, text, malformed base64, empty or missing bytes, a picture over 200 KB (as bytes or as a stream), and a declared type its magic bytes contradict LOGO_REFUSED (C-64.30); control: a PNG of exactly the bound is kept", async () => {
  const w = await boot();
  for (const by of [null, "", "member:ruth", "class:ai", "class:admin"]) {
    const r = await setLogo(w, Uint8Array.from(PNG), by);
    assert.deepEqual([r.ok, r.code], [false, "NOT_AN_ADMIN"], String(by));
  }
  const row = INSTANCE_SETUP_CHECKS.LOGO_REFUSED;
  assert.deepEqual([row.check, row.where], ["C-64.30", "src/setup.mjs groupLogoSet > is-group-logo"]);
  assert.match(row.translation, /Nothing was changed\.$/);
  assert.doesNotMatch(row.translation, /\b(copy|instance|plane|server)\b/i);
  const big = new Uint8Array(GROUP_LOGO_MAX_BYTES + 1); big.set(PNG);
  for (const [raw, rawType] of [[Uint8Array.from(GIF)], [new TextEncoder().encode("hello, a logo")], ["not base64!"], [new Uint8Array(0)],
                                 [undefined], [42], [Uint8Array.from(PNG.slice(0, 4))], [big], [new Blob([big]).stream()], [b64(big)],
                                 [Uint8Array.from(PNG), "image/jpeg"], [Uint8Array.from(JPEG), "image/gif"], [Uint8Array.from(PNG), 7]]) {
    const r = await setLogo(w, raw, "admin", rawType);
    const image = `${raw && raw.constructor ? raw.constructor.name : raw} ${rawType}`;
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "LOGO_REFUSED", "LOGO_REFUSED", row.check, row.translation],
      image);
    assert.equal(typeof r.detail, "string");
  }
  assert.equal(logoRows(w).length, 0, "nothing written on a refusal");
  assert.equal(GROUP_LOGO_MAX_BYTES, 200_000);
  const edge = new Uint8Array(GROUP_LOGO_MAX_BYTES); edge.set(PNG);
  const ok = await setLogo(w, edge, "admin", "image/png; charset=binary");
  assert.deepEqual([ok.ok, ok.bytes], [true, GROUP_LOGO_MAX_BYTES]);
});

test("R84 R86 through the routes: grouplogoset takes the raw bytes as the body with rawType stamped in the query, or JSON {raw, rawType} (base64, null clears), by the control plane's stamp (a body naming another sets nothing for them); the store-internal grouplogo answers the bytes with their content-type, or 404; control-plane R84's serving relays them, a silence a silence; R28 group_logos declared exempt from purge", async () => {
  const w = await boot();
  const ops = (path, body) => instanceSetupOps(w.m, new URL(`http://do/${path}`), body);
  const refused = await call(w.m, "grouplogoset?by=member:ruth", { raw: b64(PNG), by: "admin" });
  assert.equal(refused.result.code, "NOT_AN_ADMIN");
  const env = envOver(stubOver(w.m));
  assert.equal((await ops("grouplogo").grouplogo()).status, 404);
  assert.equal((await groupLogoAsset(env, "bio", io)).status, 404);
  /* the raw body, as store-door hands a streamed body on */
  const streamed = await ops("grouplogoset?by=admin&rawType=image%2Fpng", new Blob([Uint8Array.from(PNG)]).stream()).grouplogoset();
  assert.deepEqual([streamed.ok, streamed.type], [true, "image/png"]);
  const own = await ops("grouplogo").grouplogo();
  assert.deepEqual([own.status, own.headers.get("content-type"), own.headers.get("x-content-type-options")], [200, "image/png", "nosniff"]);
  assert.deepEqual([...new Uint8Array(await own.arrayBuffer())], PNG);
  const served = await groupLogoAsset(envOver({ fetch: async (u) => ops("grouplogo").grouplogo() }), "bio", io);
  assert.deepEqual([served.status, served.headers.get("content-type"), served.headers.get("x-content-type-options")],
    [200, "image/png", "nosniff"]);
  assert.deepEqual([...new Uint8Array(await served.arrayBuffer())], PNG);
  /* JSON: base64, then null clears */
  assert.equal((await call(w.m, "grouplogoset?by=admin", { raw: b64(JPEG), rawType: "image/jpeg" })).result.type, "image/jpeg");
  assert.equal((await call(w.m, "grouplogoset?by=admin", { raw: null })).result.logo, false);
  assert.equal((await ops("grouplogo").grouplogo()).status, 404);
  /* a silent store is a silence, never a 404 */
  const silent = await groupLogoAsset(envOver({ fetch: async () => new Response("boom", { status: 500 }) }), "bio", io);
  assert.equal(silent.status, 502);
  assert.equal(INSTANCE_SETUP_TABLES.includes("group_logos"), true);
  const d = INSTANCE_SETUP_TABLE_DECLARATIONS.find((t) => t.name === "group_logos");
  assert.deepEqual([d.purge, d.version_chain], ["exempt", true]);
});

/* ---- R85: the languages the group's members use ---- */

const REAL = heldProfiles().filter((p) => p.test !== true);
const localeOf = (p) => (p.locale && typeof p.locale === "object" ? p.locale.value : p.locale);

test("R85 R86 grouplanguagesset: an administrator sets 1 to 20 tags, recorded through setSetting (group_languages) in their canonical form, each once; grouplanguages answers the list in public; control: the profiles are unchanged", async () => {
  const w = await boot();
  w.m.profilesSet({ profiles: [REAL[0].id], by: "admin" });
  const before = w.m.profiles().profiles;
  const r = w.m.groupLanguagesSet({ languages: ["en", "es", "vi", "zh-hant", "es"], by: "admin" });
  assert.deepEqual([r.ok, r.languages, r.set_by], [true, ["en", "es", "vi", "zh-Hant"], "admin"]);
  assert.deepEqual(w.record.getSetting(GROUP_LANGUAGES_SETTING), ["en", "es", "vi", "zh-Hant"]);
  assert.equal(GROUP_LANGUAGES_SETTING, "group_languages");
  /* R86: grouplanguages answers {languages: [tags]} */
  assert.deepEqual(w.m.groupLanguages(), { ok: true, languages: ["en", "es", "vi", "zh-Hant"] });
  assert.deepEqual((await call(w.m, "grouplanguages")).result, { ok: true, languages: ["en", "es", "vi", "zh-Hant"] });
  /* control: the places whose rules apply are not changed */
  assert.deepEqual(w.m.profiles().profiles, before);
  /* a later set replaces it */
  assert.equal(w.m.groupLanguagesSet({ languages: ["fr"], by: "member:ada" }).ok, true);
  assert.deepEqual(w.m.groupLanguages().languages, ["fr"]);
});

test("R85 while none is set, grouplanguages answers the active profiles' languages (each profile's locale), or none with why when no profile states one", async () => {
  const w = await boot();
  assert.deepEqual(w.m.groupLanguages(), { ok: true, languages: [] });
  const withLocale = REAL.map((p) => heldProfile(p.id)).find((p) => typeof localeOf(p) === "string");
  assert.ok(withLocale, "a held profile states its locale");
  w.m.profilesSet({ profiles: [withLocale.id], by: "admin" });
  assert.deepEqual(w.m.groupLanguages(), { ok: true, languages: [Intl.getCanonicalLocales(localeOf(withLocale))[0]] });
  /* control, with a profile reader handed in: two profiles, their locales in order, each once */
  const juris = { list: () => [{ id: "a" }, { id: "b" }, { id: "c" }], combine: () => ({ ok: true, conflicts: [] }),
                  get: (id) => ({ a: { id: "a", locale: { value: "es-US" } }, b: { id: "b", locale: { value: "en-US" } }, c: { id: "c", locale: { value: "es-us" } } })[id] };
  const v = await boot({ more: { jurisdictions: juris } });
  v.record.setSetting("jurisdiction_profiles", ["a", "b", "c"], "admin");
  assert.deepEqual(v.m.groupLanguages(), { ok: true, languages: ["es-US", "en-US"] });
});

test("R85 refusals, each writing nothing: a member or a machine NOT_AN_ADMIN; no list, an empty list, more than 20 tags or a tag isLocale refuses LANGUAGE_MALFORMED (R64's row); control: 20 tags are kept", async () => {
  const w = await boot();
  for (const by of [null, "member:ruth", "class:ai"])
    assert.equal(w.m.groupLanguagesSet({ languages: ["en"], by }).code, "NOT_AN_ADMIN", String(by));
  const tags20 = ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "da", "fi", "pl", "cs", "ru", "uk", "el", "tr", "ar", "he", "hi", "vi"];
  assert.equal(tags20.length, GROUP_LANGUAGES_MAX);
  const row = TRANSLATIONS_CHECKS.LANGUAGE_MALFORMED;
  for (const languages of [undefined, "en", [], [...tags20, "ko"], ["en", "not a tag!"], ["en", 7], [""]]) {
    const r = w.m.groupLanguagesSet({ languages, by: "admin" });
    assert.deepEqual([r.ok, r.code, r.check, r.translation], [false, "LANGUAGE_MALFORMED", row.check, row.translation], JSON.stringify(languages));
  }
  assert.equal(w.record.getSetting(GROUP_LANGUAGES_SETTING), null, "nothing recorded on a refusal");
  assert.deepEqual(w.m.groupLanguagesSet({ languages: tags20, by: "admin" }).languages, tags20);
  /* through the route, by the stamp */
  assert.equal((await call(w.m, "grouplanguagesset?by=member:ruth", { languages: ["en"], by: "admin" })).result.code, "NOT_AN_ADMIN");
});

/* ---- R54 (T47; T48, N996): the disclosure read registered with ai-accounts ---- */

test("R54 (T47; T48, N996) disclosureReadOf(m) is the one read ai-accounts asks: registered by the composition root with the real ai-accounts (its R23), a member with no disclosure recorded is refused DISCLOSURE_DUE at accountreferenceset, and her key is held once disclosureShown records it; this module registers nothing with ai-accounts itself", async () => {
  const c = await aiAccountsWorld().group("ann");
  const m = new InstanceSetup(c.ctx, {}, { record: c.core, membership: c.m, aiAccounts: c.a });
  m.migrate();
  assert.equal(DISCLOSURE_READER, "instance-setup");
  assert.equal(c.a.disclosureDue({ member: "ann" }), null, "nothing registered: this module registered nothing itself");
  assert.deepEqual(c.a.registerDisclosureRead(DISCLOSURE_READER, disclosureReadOf(m)), { ok: true, module: "instance-setup" });
  /* the member's own account, set through ai-accounts' own act as its published world sets it (T53: accountSet, R40) */
  const set = () => c.own("ann", { secret: "sk-ant-T47-IS-0123456789" });
  const before = c.snapshot();
  const due = await set();
  assert.deepEqual([due.ok, due.code], [false, "DISCLOSURE_DUE"]);
  assert.equal(c.snapshot(), before, "refused: no account held, nothing written");
  /* control: once shown at the current version, the key is held */
  assert.equal(m.disclosureShown({ member: "ann", version: ASSISTANT_DISCLOSURE.version, by: "ann" }).ok, true);
  assert.equal(disclosureReadOf(m)({ member: "ann" }).shown, true);
  const ok = await set();
  assert.deepEqual([ok.ok, ok.owner, ok.means], [true, "member:ann", "sealed"]);
  /* an earlier version shown is not the current one */
  const n = new InstanceSetup((await aiAccountsWorld().group("bea")).ctx, {}, {});
  n.migrate();
  n.disclosureShown({ member: "bea", version: "D311-0", by: "bea" });
  assert.equal(disclosureReadOf(n)({ member: "bea" }).shown, false);
});
