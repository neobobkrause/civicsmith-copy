/* screens-intake: the requirements file's consolidation (5 Nov 2026, job attempt 1) keeps every requirement.
   START_BLOCKS is each R line of build/requirements/screens-intake.md at the start commit (6a6711a3), with its indented
   lines beneath, by sha256. At the head each id is present once, its block unchanged word for word, except that a mark this
   branch met may be struck (STRUCK: the mark text removed, nothing else); the unmet marks are the start's less STRUCK; and
   the text moved out is in docs/requirements-notes/screens-intake.md word for word. R61's line opens with its fix-round
   label before its id ("- **Fix round 6, G43 (K4657): R61**"), as at the start; it is read as R61. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
/* each R or F line with its indented lines beneath (blank lines between them skipped) */
function blocks(text) {
  const out = new Map();
  let cur = null;
  for (const l of text.split("\n")) {
    const m = /^- \*\*(?:Fix round [^*]*: )?([RF]\d+)\*\*/.exec(l);
    if (m) { assert.ok(!out.has(m[1]), `id ${m[1]} appears twice`); cur = m[1]; out.set(cur, [l]); continue; }
    if (cur && l.startsWith("  ")) { out.get(cur).push(l); continue; }
    if (cur && l === "") continue;
    cur = null;
  }
  return new Map([...out].map(([k, v]) => [k, v.join("\n")]));
}
const MARK = "*(not yet met";
const START_UNMET = ["R72", "R73", "R74", "R75", "R76", "R77", "R78", "R79", "R80", "R81", "R82", "R83", "R84", "R85", "R86", "R87", "R88", "R94", "R89", "R90", "R91", "R92", "R93"];
/* marks this branch met: { id: { mark, after } }, the mark's exact text removed from the first line, where it stood right after `after` */
const STRUCK = { R92: { mark: " *(not yet met: T53)*", after: "drawn beside its own explanation. Words owed." } };
const START_BLOCKS = {
  R1: "08f12af15f1475b91f2874e4617ca8e46059187dbc680c0827a196e5566105dd",
  R2: "aaf5dc39d3700e6b1baee4f9b992be8514f6f553ae38e82403b4f3d913ac46ee",
  R3: "5ec06ada59965d9aee46426af9aadc33f8732733a68edffa8c660ce8d659c790",
  R4: "129693b5c4a7d05cf024713b73da1bef422636cc0cbdda1ddd4444cb324cad17",
  R5: "dbf36137673d756528e1655299b4f97515fbd9867a50531b7a2950649302029d",
  R6: "33458ea02526ab23c3dddef64a6e59a224eefcbb119bc0b299ca733650c37f61",
  R7: "9a2c81334bd5556c91476a024f62bcec15942d37dccc571fd73d32263a56f06d",
  R8: "41e0218b64a81d236576648a02ae71e8d977eb16bae44d942d5b006321e443b0",
  R10: "821d46830621b86f89e35ed61ef85bc36b09246e3daebeca05f6bc60aa478b28",
  R11: "75f9ef1d1412c58e54bd9ac4a0a7264298e0d8fd086e7f5c257a084ff2c2de67",
  R12: "61478fc13447db5495c75183ffbf0223bc5be5e294d344b511eb08bee94f8721",
  R13: "f9036794e26e26084c7e7d190e7efe60317439a7d9741dfccdbb1ceb7b88f2ab",
  R14: "89daca6de9fbc0f815d64aad4f3cb95340081d5b5fb98bbd35457f6f485d5a69",
  R15: "0e49d5468081cf079073643dbc8988405a17978bcbc52b79db1107890caf3994",
  R16: "a51fff4affb65e01a283c4482ae19567d7c46d8e3ce4495dfc1c3b46a528fa6c",
  R17: "906c30dc17b8ca9ea8572c1dfcfc5d3a383a6941d5f69ede08c4304bfa0e42a2",
  R18: "c7e7b8a54f5c29bdcd90c7458ed4f429e82cdfafab8ad659a506fee9ca77c7cb",
  R19: "899ddb0b22f5366f6192f25fa364ab6d39fc3e1e8094ab50723fa9338b36c700",
  R20: "df702e417bc7c61b881455e61d9f661ee06423aea50f73a9a675560e314ff7be",
  R21: "a72c328a6fa68ad068730d2b9414c64be7b0ff977c6df4b545bfdfa81000020b",
  R22: "cd21faacf5c23aa8e889c4e205c306bca9f988e81de7e89eaad7f0fc355f2c0a",
  R23: "d5dd92347f4686496dc10907bd90ac18ec73c0e00034d3dd43e701aefa866a07",
  R24: "708e2a0d38dcb6a2ee64064e48aac5aa42c021dc292d6e16a987f1eb0a0d15ab",
  R25: "092afdea875e801f2a84e6901b27ef42056a2d8789db66a3285ad03749c9c646",
  R26: "5088247674ab61d6277d167b30e41ba5bf8e4015a2e04574d74c5be66668d6e1",
  R27: "edf63a64f2511a9dc1663ffd2524651d2fea3456f5ef1d4c8ae076f7d2740cc8",
  R28: "63da3b22813f59e855f68986fd4265a2788d84b8dba684104b580248110c68a5",
  R29: "f74a54885f7ac626e8f15281fb81072f0a98c9365a0531cfec4011771f6256dc",
  R30: "d0be0ce5b6e88e98db2fda2d7ac9cf086dc61ef783f6fbee9fac32f81607c33f",
  R31: "22477d1b4e06db97371866bbb552aa89cd963a12bc1424fbecbcf5a15172081c",
  R32: "d937efeae3d05da33905a1e53d0357822fbde24a0f782bd66428a3f5fc83370d",
  R33: "9f4731a2f40c314b33cf3600453ee9ed5c5d7fe030feda38cbb3c8c625a27526",
  R34: "0be6fc4276bc27b2941f908184d90ea2db1d1f6f0d5377f478e28257437a2acc",
  R35: "1ccc17d61d8f6dc7e41a3350084fefc493cbb516f11df3f734864237822a682b",
  R36: "d6ea27f774a0a50b482477f90cfb5f769cff6f5437fb3361c9f09b33294ea618",
  R37: "964b32b8b3b87cc94e21e2ca40c22788c55c893864b180ddee3dff24a6522258",
  R38: "29812c0ef982ca8cc4772b831d8acb8f2cdce354b8328e8fac73a0903a1a6141",
  R39: "a36d0dda1d403cc6d03f8a4201a07312759d77c3ccae0db10f16c672876c724a",
  R40: "87bb1d1d4961fb87929cea3ff7bcd76cfbfe2d5f87f4445093ca18f527aef09f",
  R41: "fe937f24a819f57db5992e59b88f4f9397b62ec76a264d8b7b3cb7364246158d",
  R42: "f35da4e599e95548632cda5899575a4ac2fdbc1a72a62ac855ec4cc7edc99931",
  R43: "83052df1e28f40fcdda3119bb05d961c6fbbf2bc4eaf3b9557e259b6e97dae4e",
  R44: "60f7c68dccd9c250f39b79a41b433fc608fb0d920956f346d32ec7caa4775de2",
  R45: "7ca2d143d6623920da3de7d6bac3e2869ee5a0b789decc568a83ec5305524000",
  R46: "af5414872de219e93c2dbc145d39df853d1c04401967016bb7f420a691866c64",
  R47: "fa17a09c8025797d32b6b9683c827d7e4eac90537168460b9fc1b4fe5362065c",
  R48: "25a8700138cc327b0f1d1c9bd35fbbb97023896635e96756455d8a6527ec314f",
  R49: "4ea1c6a6512d9a21ccc003238a1f0c7b3e1dc2130c51c3e4da200ce3b7ce73b2",
  R50: "d51aa1f18af6e41853b33a47065b385b213ba396374d7ed16967a7b72e2563d5",
  R51: "3921f85f5c466305a3adb7f014620c45acc18621f05b76c40dc55d16a4dc4477",
  R52: "4547c4c32d13346ab23e15c90e7150dc4730b53abff53cbf624269d8ea15b4e0",
  R53: "c4b1d2d5b7f9059e59cba8d82c4955f06120b5f4a779e5e84353522ced3f73b0",
  R54: "ba2b52245d638821c8ed8d3c7f57dda53dc25f02d35729e96fe2ce1922a848bb",
  R63: "9ff60c768430c4c9a6e5bb51805c9acffd2d24f1b64a039e924f7315c88f34ec",
  R64: "563b9b418c109857b4d96c605891390838be4c2ca8cd95e61048ceecf08967b1",
  R65: "fa9ab4de8035e161b4ea6f135e918ff41d6e9099960a077ae98be5c49eb251d5",
  R66: "f25fdfd1ab788dd47649317899e86946f0f1d54fe66c7d0e1155e90e9ed2072f",
  R67: "867a0c20821372037107774e67e28a1ad17ef0d6a1b4c79df6d2ae60563ff745",
  R68: "6025253628c9e052ff8ce83c1f28e36bb7e79060471bac81cb0500739dd4daab",
  R69: "e967816db2eca73464a04e333db3afe2b13939e4495c229c185d8565fa2f4863",
  R70: "2a0e6de4fb6af866230ae10cf59e0d22bb42a6805dee6ca06a369d8aeb1a66c4",
  R72: "aed669b2ffe88903ed00dab3e91ef1f4575c1ca8b729eb13cee821681cbcc088",
  R73: "05e165784b601122ee3f9d50b99236f016c870e2b020c2c6dbc4a50c6acb53ce",
  R74: "2ed793d43b1fa32ee6798ee988b608cca06f0387288c5dc0d30333af29f3e2bd",
  R75: "3aa1b6907c68e43431079b0018296a197fbc67cae9dd820016e6033c7e987c1b",
  R76: "e4647fafdc03628a4e2d6981fd641d1b24828aeac0bc6e2f201587f98a5f0752",
  R77: "7733381335c8302986ad47ad3a18fa3e963c86c74384571b56f54d0694bc3836",
  R78: "cc1a831bda8e5fcacf19ffaa4070735e38b75a17a664fe8f1f1c0213fb3661bd",
  R79: "6a00e27abd72f1240532f9c04306f8ef53a4c6d619a4c50c9e22993d32a40fab",
  R80: "35f7bd1551ff1ae434915131ee18653481693c2ec0921951f4e7e524e5078060",
  R81: "8454e64d5fd2dc066ac235b7bfdc43fe9aa82bd2639b803dcaccc90c1739a685",
  R82: "d3468bd1c6591bf97f41383ca5c3079a2615c40ae56253b4c29d1965ec3bd8b2",
  R83: "40523766591dca0272ed49ece580e9e303fa4683afb880178fdfb7835b1fed2d",
  R84: "e45c61e05956c3f7c5d8460be6f096542e61e8068d0412ac77f46c675d7d140d",
  R85: "e8f5a9f6369a9f1912ef29d0f9f88e3454f52e32e146d1b733199f43bbc2fefe",
  R86: "cefe6c3aa27e415d65ea5651d1369ea1e26e69927e86b690379cf2d17686ed4a",
  R87: "3909d52e3ebce06c4b184bbdc2ef5c5c72d628598a9c4a63806311876dcbe522",
  R88: "fd15029a0b6907e76aa8db7fe43bf9e3e608b0982b0bc15ab7e7732dd53eac4d",
  R94: "28f3ac968feeba688ab6a7ad1e729baf2fc75f58bd718831e2ce5ebadc273cf2",
  R89: "c6e668c8d9329e1582402a354bc6f4d4603f2656ffaa58a105ab70f1dbe3d770",
  R90: "6a1323acf999e6d040870b82d0a8147a464a9098210a78ce2977469ccb95b982",
  R91: "16d61f637f529d18cb31fe84c02efe991e23ceba323b33c157d81421804c0a0c",
  R92: "dc26e48f907f17445117c891bd3e9af2e3a141f81caabaa6c1ca41ac9fad9fe3",
  R93: "0b15ea70ef46061aa83a3c9eb7b6a7495070cd4eac4cffb6263a41c122b3150c",
  R9: "5d7ff81eb18e8395539e7a1216a29af9debcc0ecac0a103bd9b46b48c65c5d9f",
  R55: "dce8b96209c7bc6a20acfc6db393c3252a97ee7c834dc27e43e5de1c1ca995b4",
  R56: "d0537b1045d0cb3e33dcb07dfb9115438d02d909ab2adbef341237df7f24c5e1",
  R57: "4f32ff5da2cd77c178f5fa957cc9150d5c3a40f6337de8fda49afc3deadadf63",
  R58: "c7bdd70e86b784f1813ec224144b30beeaa741198a43bdf9da42eea18995b953",
  R59: "276f8600e790e27e0bc9c9bbfeb8e4afbc071c601c045a276355e3724b559140",
  R60: "7c8b28f191878bc4f4e056b5d7497804e30eb296ee793ceed1329a8ad503b259",
  R61: "dfb715d9db93a7ec1d88876b2968ff00ddf580c2daf5e6c757dd807580a6ccc2",
  R62: "3498c8deab57cbfbaef411f6135d935faf1049d0d904e272d6d976a5e0eaa2bd",
  R71: "1fea50a137ec28849905de9556e0b5f47809e4ac37d8f9360a520667ca416a02",
};
const REQ = read("build/requirements/screens-intake.md");
const NOTES = read("docs/requirements-notes/screens-intake.md");
const isR = (id) => id.startsWith("R");

test("the consolidation keeps the set of requirement ids: every R id at the start commit, and no other R id", () => {
  assert.deepEqual([...blocks(REQ).keys()].filter(isR).sort(), Object.keys(START_BLOCKS).sort());
});

test("every requirement is word for word as at the start commit, with its lines beneath; a struck mark is the one change", () => {
  for (const [id, text] of blocks(REQ)) {
    if (!isR(id)) continue;
    if (Object.hasOwn(STRUCK, id)) {
      assert.equal(text.includes(MARK), false, id + " is struck");
      const [first, ...rest] = text.split("\n");
      const { mark, after } = STRUCK[id];
      const at = first.indexOf(after) + after.length;
      assert.ok(at >= after.length, id + ": the text the mark stood after is kept");
      const back = first.slice(0, at) + mark + first.slice(at);
      assert.equal(sha([back, ...rest].join("\n")), START_BLOCKS[id], id + " differs from the start only by its mark");
    } else assert.equal(sha(text), START_BLOCKS[id], id + " is unchanged");
  }
});

test("the unmet R marks are the start commit's, less those this branch struck; control: no R mark is added", () => {
  const unmet = [...blocks(REQ)].filter(([id, t]) => isR(id) && t.split("\n")[0].includes(MARK)).map(([id]) => id);
  assert.deepEqual(unmet, START_UNMET.filter((id) => !Object.hasOwn(STRUCK, id)));
});

test("an F id, if any, is numbered on from F1 with no gap, and an unmet one carries a mark of the form `*(not yet met: <where>)*`", () => {
  const fs = [...blocks(REQ)].filter(([id]) => !isR(id));
  assert.deepEqual(fs.map(([id]) => id), fs.map((_, i) => "F" + (i + 1)));
  for (const [id, text] of fs) {
    const first = text.split("\n")[0];
    if (first.includes(MARK)) assert.match(first, /\*\(not yet met: [^)]+\)\*/, id + "'s mark");
  }
});

test("the moved text is in the notes word for word: the status, the size, the Uses, Satisfies and Suggestions; moved, not copied", () => {
  for (const head of ["## Status", "## Size", "## Uses", "## Satisfies", "## Suggestions"]) assert.ok(NOTES.includes(head), head);
  for (const l of NOTES.split("\n").filter((x) => x.startsWith("- ") || x.startsWith("**Status**") || x.startsWith("**Size") || x.startsWith("**Proposed"))) assert.equal(REQ.includes(l), false, "moved, not copied: " + l.slice(0, 60));
  assert.match(NOTES, /^\*\*Status\*\* · New in T46 \(T46-56; K657, K1043\)/m);
  assert.match(NOTES, /^- `setup-words\.word`, `setup-words\.hasWord` \(K3366, K3368\)/m);
  assert.match(NOTES, /^- `mark\.gap\.refused\.means` is drawn from this module's own row/m);
});
