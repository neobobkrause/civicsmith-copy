/* interface-shell: the requirements file's consolidation (4 Nov 2026, job attempt 1) keeps every requirement.
   START_BLOCKS is each R line of build/requirements/interface-shell.md at the start commit (7b41d33c), with its indented
   lines beneath, by sha256. At the head each id is present once, its block unchanged word for word, except that a mark this
   branch met may be struck (STRUCK: the mark text removed, nothing else); the unmet marks are the start's less STRUCK; and
   the text moved out is in docs/requirements-notes/interface-shell.md word for word.
   Attempt 4 (walk p3dev-t1, 4 Nov): found marks (F ids) are admitted. Every R id, block and unmet R mark stays pinned to the start commit;
   an F id is new requirement text, held once each, and its mark is checked for its form only. */
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
    const m = /^- \*\*([RF]\d+)\*\*/.exec(l);
    if (m) { assert.ok(!out.has(m[1]), `id ${m[1]} appears twice`); cur = m[1]; out.set(cur, [l]); continue; }
    if (cur && l.startsWith("  ")) { out.get(cur).push(l); continue; }
    if (cur && l === "") continue;
    cur = null;
  }
  return new Map([...out].map(([k, v]) => [k, v.join("\n")]));
}
const MARK = "*(not yet met";
const START_UNMET = ["R20", "R136", "R137", "R138", "R139", "R140", "R141", "R142", "R143", "R144", "R145", "R146", "R147", "R148", "R149", "R150", "R151"];
/* marks this branch met, each struck as " *(not yet met: T53)*" removed */
/* R138 and R141 struck by interface-shell-t53 attempt 2 (7 Nov; ledger paths widened, PR 851) */
const STRUCK = { R20: " *(not yet met: T53)*", R138: " *(not yet met: T53)*", R141: " *(not yet met: T53)*" };
const START_BLOCKS = {
  R1: "a5090be8e683b94c922c748e173c267036f3d774b9360b4fb2891bfa78eb02b0",
  R2: "1d65572987784ee80c4bf337410b563979942aed214f2f565a8497dd0fe112c4",
  R3: "b76f13004dde5bc4834ae5f35c4bc318778948e59151584fe9109b946166ca5f",
  R4: "b9d072ec826e69e997e9721f13358f669e11521465205406e7163969c05d9fbd",
  R5: "abb92049d5ae0771938664c91b4a1137d42abe74249c8f0e378eead5e8f370b3",
  R6: "b7a6a81ce915684cb13ce5de4ef163a49dc96196fce8e5cf91aa91403d5a55de",
  R7: "cb14c9d70853d22746fcd9d4aa1a41c27035996b55837b7dbc0285dd1e975fcd",
  R8: "1814a9bc17d117cfe7c292737ac9901e3b6eb5e92dc1e5451531175efeacecc4",
  R9: "ab2c03434031901f3b389cce86e9dea0f5487cb0da873c2b944a74c473a8dd36",
  R25: "9f588f7052b327a639bbdd0a94cf396995b682b9a86593b575d30334e0121fcc",
  R26: "8138007d9f405bc029d917bb0d482447008e09f4dfc85f3ebd0d5eb3f9542354",
  R10: "2e6937a597326cad0d8a6a05fcf8dba5f377067ffab615e89e43eeb7ce404a28",
  R11: "33148180c3c0133c497fb8c6d6127c2f319a6448de2cf65e520f9241a00a5b30",
  R12: "4f9b0e0c44ef113bf3b82b2750f16f3a67f4c86e6a86ffef2a6c952060970e1e",
  R13: "921c52899fb30f0e79050617ffb020d4728df234fea6e53145e75a3942cc03b6",
  R14: "6bad162dcf6adb2a18d1f85deb19424a20bc9edc3f44e90ab37c3895ca2b4315",
  R15: "95542bb0e7661f87b253712eb4121e859f89193e483c729ec1801228e4b3b27a",
  R16: "6cf71defebe5bf83e075cbaa484b60ffbb104ded35859e341a40d6c42873923d",
  R17: "187b6273eaa64ebe46feca26a7b84dfa1f538b246a8da9344b2dbc1a3fd82f85",
  R18: "f9d5fa4279ae85bc147d47b5ad8615bd003a5b4333e6f55c89adeba6a94f4178",
  R19: "8975f7a05f924c591fc7773414e58f026b4166b5e8c21ef6a7b807c886a24a50",
  R20: "809ec5aaf04ba1a3c8e853e89af11aba8769346f8a1ad6f3f3a0455c292e99de",
  R21: "78422f1f6d5857b27200246beff80829228225707e576933619847ae3736c2fc",
  R22: "6511964ba0be49aed020a79383d1a6f603f1c7dd57e152a4425419779bca662f",
  R27: "2df56d2170bb1162f093cdfc9ca07b4200536f25341f0d46217c0fc57ef4ecbe",
  R28: "434f947f4d8f67135f3dbbe007c92db3b8fde8296785ad75a46466cc02b3241b",
  R29: "bb1ad2c4bbe3dc1e83d71e21b046aff14ac202eec5ef519c297dd61070058945",
  R30: "29d1bdffba50df843850523ee6ba5b21e7e93ac4bb1df647944833a7f760ea36",
  R31: "9de306bb2a4c725462713a53fafba328a3a15bc8d84a2558355edb73fe4d29a8",
  R32: "581b28f6040210e3e8855ff317efcb3672f544803b159217d2a1970c8458d5b6",
  R33: "9272ea56b796217975a9213ffff63823527ce465698ac967e0f127b48fc5127c",
  R34: "5b69bf20533871dac37046d21aa60cb93415787d032d7a6b3669bfb669642e9d",
  R35: "d64cf706cb26e7aa6530cb8c4699487b3aa3f472e1e0e509993f1c2dce1491db",
  R36: "549018389a0743b86a5f1cc1358d678564968360f2f3202a50007d8f75973f17",
  R37: "d3711243d380443f6298ec3d80e651b914411dfccc2c80ce8ce34cec75154a56",
  R38: "abfe67937ebaa4830257d175426824a2a964ce034c4aac24ead459fbad46fad4",
  R39: "19d928c1e1973d36758ea2cadeb7781a548761bd2ecd092cf05f16be70ec0039",
  R40: "d97d3b66650789bddc9f9b58eb55e0a802fb76c51c22505511ad2b316f476b6c",
  R41: "f9cae563ad7e3179a37c64f545c04d095ad831a5292981deaea3d7beb6bce272",
  R42: "18ab8dc46dae800a34b686936aa2efecc6f6129e361c1ce7e32fefbf3dabef2c",
  R43: "86776741e57fa05798a99eeed8bd1b43d117a93d18a1ffd409ac3e94cabe902c",
  R44: "5ba2d30e65f8700d3844acc7275708b8d13c68be5920d45795317a8b13bfa554",
  R45: "60873eafc889dfd22cdeac45d2474342786e15bdc8c62c08c46b2bfd340b165f",
  R46: "b67a9ca1f16633acbcb442a35c55fe17737fffb04a854ac3b4f3d761bb8e1d3a",
  R47: "336110ea90d5e40ce8a4b6241c56b71642f5cb98c5eaaf33ba1f1cd78357ba1f",
  R48: "2b8be26c99cb351aa7bacae0467c8f01339b9bf5604a226c92474c05a64f9ef0",
  R49: "936c06ef1493f5389c2237d2e366f09c9c560b58c22cc4574fe7bf98844d7b70",
  R50: "895d86d38b8c94b8b18204ba5115947dcde2613d4045b1f89e7312be477e7c23",
  R51: "52a287d7f189ec19c9adb128e6c3083fbe0e9182c55511ca49184edf77975927",
  R52: "bf100197e7c06b5bcf43d8489759b87ec28fd4a1d4781c55cbef6b59b0e82c87",
  R53: "10071f8220175dcc54ce147cbb41949fc1c9ed6626daa273bc7f9c90965fc287",
  R54: "0276fee089171d4c38da6b04dc3197ec7b19e110659dd186a331d2121d8581d2",
  R55: "485cbdc2c24a7005fe5337b493c3235a32c503a8a4e8d33c9e8ebda0c28fbfd4",
  R56: "a995aaecb0779351852b10cfe2ba3b0f2d3dc9fcde55d079834e62ad9dddfc9a",
  R57: "5f799fbf16e176ce051c531a0827f2188d70b872d7056281a53aedf78843d019",
  R58: "272fafafdfe679dfcf752639733ea220e3e0671964c715ae12124af932aaab6a",
  R59: "be4c31b5aa9da9528bb778da78ef5399ce11f923cd21dad86f7d1143eb362045",
  R60: "d3ff1d1aa915b307b80dafaa6ecb8de5b201af7d6fa7defc69d01c992ae74466",
  R61: "fa0f39175936602ae3d8c31b5b84f4c608e2cd8523fcdd1b812383f41d13cf26",
  R62: "13a98cd0051b453d66d4f04ee6b64ca7c354a718cb7be56b774b36c0eac5a85b",
  R63: "ad0369bc087a4109c909aea34594c703bb3c473d3b77ed60246e687eb852bf1e",
  R64: "59cc9977bfde6737fa1eaba288cb3ab9193abf133b3843c58f3d35afde4b7a97",
  R65: "f61a0c5adf896ccdee348fcdc7b8094b3c5cc669beeb648e586a13844e06c6d5",
  R66: "fe714a2bab71479cede21ee5479008f723ceaf927a7e43b065023a63e548c136",
  R67: "c4e842acc6026440798f3521e3eae5207386d55a15acd4fe9ed6dc3b27e704a0",
  R68: "0676b492ba1b7afc162b844c5cb485f696d7f74d8c6330eb6fb87cf0b5c932ac",
  R69: "af9c6433c759cf0ac1e27ebc5ddef63f9ef4e5d43a49c58fc47a537b3065ef49",
  R70: "7198171b61c64876ed5cfa6fff8b70168ae57bbd8a0adb3e1b1d8ed0f77d16a4",
  R71: "382e2ffe8bdd3cca5d07fb9478e4bf80ed287a765455fd44a755508457010dcb",
  R72: "b1f722ac7b5612b7b6bd67a879676a3eaf8429b0af5a1f866e734f857c869c21",
  R73: "4140836f5f43f55c2650daef06fc1589a7faca0c33a3dd0236581c258b34d972",
  R74: "bbd8b7c364732886bb66022cf6e38c78b24009f253c3900f5d661d7f7415acb1",
  R75: "4019a54a194ca5c6ebc9f11bfafa166dcb71cc8e640cbd701638e9a9eb3ee787",
  R76: "ffa27c7dba7c378994fc75f910920310ac218e0ee9d42880ee3b6476958f7a38",
  R77: "a3a4afdc2b38ae1d4d22fe0d8cdeed242b3df56d2ea6044531fd20980ee6b7b3",
  R78: "c367887966f4d04b05aec94fe6806dc3861b52abec34a4d63c45237ffb9b5412",
  R79: "b4026d97050a96fba1615fe6175191ef82e8029dce00850866adce9dc0bfb8f2",
  R80: "042ba7d1117b0095bb6db59aa4b1b897d7a0149963d8e7def2383c0637b1f319",
  R81: "e49fd5f8d7f06cb74230e918f94f73fafcc0111f059c3bbd7060ca5c6fa81fec",
  R82: "c61c7153baec12578bb778b0f9a55475efd83a9c30c7835600ad204502a845f4",
  R83: "eaa33d59f1bc51bb78f5e852dad2a84253f6130fc454ee35bfdc96eabd7faa5c",
  R84: "9cebc8bb8d895c09414f13973554584b6f3d007b1d4ba58993888a9a321f950c",
  R85: "adcf64fff5232570a93d4257e4f6ae021e5efaee47a7e1cc33046bf7cc90f870",
  R86: "b9a5ee41a8c77d287b9519ee5fc497c17c055a6cd8df6b9075f71390f4beecc3",
  R87: "5ed894986223954b3c0e3edd7ab3d9b34e973bc7447c71a0d0c7a59e54d10786",
  R88: "1f3640c6dc5da3e93b497be2eaf2d7835b72a01f8a0c01097c4c12134acca965",
  R89: "bdea461c6ff5ab0eeb8e6d322824513d22c07566bce1db1efd27c51a7d8feff5",
  R90: "720bebe659f383237c5db6c9d9e9fb685d6d7d5c9ce16f251f600442a5b86ae3",
  R91: "51004b6844aaf56900b47240458bca596055d434ff1ff4e762240037f2bc12cf",
  R92: "102518571ae3c36bb9be7c31f3c34b14ceab40b9ec7e3d9ef9c6ec4fb9cdc28f",
  R93: "38fb03da72285bf207fe6af4bbfd3783ea1197a9e4c57928d296a3a8a1349010",
  R94: "9b5d3dc439ea1bbfdfedcbe8ba71e722920224664a1d3454c20f60b0092245e7",
  R95: "e64eafca1b55f3b170ed8ed90e5593af86501c8cd586b0fc5e728b5ff7828590",
  R96: "9a1f8e8eb890366768fa1f91e6e4fefc551afe4843c1a82acef565d0135b026e",
  R97: "fb31bc0678d385a637326cb90388153964d507ffe662669f1dd5011bedd2122a",
  R98: "07e03f86cde7d9993e4454ebb500a97ccbb32d048b7a8af7f509a364870a6514",
  R99: "4e100b0f7141912400f5c2d2b14148c24410594271a00d0fe4cc3dfced8f8252",
  R100: "53204f3edd47acfedd9a277800c8502deb9d91cbc5b409576ee2c708f0148915",
  R101: "6cfa5ef6d8ee14fde25bde0220662d8afcbb380ac511a3784cc4981ce7445f22",
  R102: "3e427f65885687f68f8af5fedbf15b9277b1e16433bd37038e84bf604c18cc50",
  R103: "0940b9dc486405c8c07c4155fe70179a0ff99f6003dd11e247cb14859d3f7d69",
  R104: "d18c55ecbd75b4227f76035f0744545b73a44d3e5e76fdf4d7583545bc0cf7f2",
  R105: "929736fb000f3446038e48d78a580e819287634107e0498df5a17b0d56e84ef3",
  R106: "f6fec772e00f089bd093f39c2f5b2bf4bceef209edb0ac448eea819ec6df76be",
  R107: "2dc1dcc6a14ce1d2a30a15ba489767b1a7201e9c53be02e4b7e4aeecf90e0adf",
  R108: "3ee77b7846d95b04f7964fc458087cb0a2632e82f4c12965355c5eac457163c3",
  R109: "5c236be884c67130dafbdfba6885e92a01a6b0f220d38d0e984e7b8061c3e5d9",
  R110: "56378eac7d3b9e4572482b4ea2d3988f794fb4c44d2a6b7a2dedbb8da0c95fe4",
  R111: "4dd8198cb843cf198faf59ed3e93c4dff4942c422998898e82eacdc7c1a5bbb4",
  R117: "be07f1e74d0fa58c87d30a421397349ca7ac7befdbfce35155be8ade117f4014",
  R118: "360d0160d8c60f53b04227fdac72123d00eadfb9e1533b569141e802f3bb0713",
  R119: "480d627b187c1a9c6d65f30dd1af52a4ee81bb909d3d94506801ec45adabd732",
  R120: "69a71d92d15ebeb11f406aa4f20b9ee6b73a2c32947c4dcaf430e5aa89b64553",
  R122: "cf852e0dee1e953fac112503ea86d4379a2bf6d830810a269635fec595fecd32",
  R123: "ab336133aeaf3a3cbe1aa86dab2539c2d47ed74dedd14600b6621a681c2f2cca",
  R124: "177ceb0d8386b0376bca47e00f999a5019835bd1f2b27f387c2741f2d5bdfc1d",
  R125: "5f9a2dc373ec7fd43cb0de579fb666dbcf572c0a485bb93db22021fcc61765d4",
  R128: "a9422b3fb53081df19a3ff72f704e389f5340b7f27c66a67ec5e0518e93730f6",
  R129: "6e7ed349ef4e0679d955fd902f097730a4ef9ec286728e56a083fc15711edfca",
  R130: "77aebe67a49bed9c81580045182d56dee1eb79823d288a37c73656d2cceb1846",
  R131: "8918699ca1f30456efff55408b508c379b412a4b800bb47326f0041f6b20b50e",
  R132: "54714aa338aa1621c48adb128234ebb3f96ff75c5dcd390629d1b7fc7ca25873",
  R133: "f5a9129178081a4f7cf8174d2cca5259cbde7a6554de2f87fde523a8e24c5111",
  R134: "cba522f51175eac3729faa99bd56811e17d653e9dc1f9300b5a6f8e1d2735a1a",
  R135: "a9a18954edecab7779007662ee1c5f681ca212da202f87564a26b487077333d6",
  R136: "702f0b2d78652ae017951002de20c1d0cdada0f945edeb48dd09d74d751f8a24",
  R137: "3094cb5e75c699390c956f174e94968584721b97fbaaa0492704239fb1e1f203",
  R138: "c5870f10a47cbc571d145d2162e4871eed6c9caecb0597d8b2063d9b6113154e",
  R139: "50a67371146f064a7ef139ab3e7b52dc5f86d2cab9e1eca934c964a901712424",
  R140: "ea1e77f09e7b6beac862ea1ce9c17520a9d567bae26cd4ab8a7613a551e32fd9",
  R141: "bb54e68b5cb83e20b2de7894a447f65e0b26722d7e114a7d3cbb5a0eb55be7a5",
  R142: "d179ce687a1256a0979f0f8df2bf150966380cebfc6429f099a6c315a9e64e32",
  R143: "1822b17e09f9fea9f9bb559abf34cf8c4dcc5f74b7d30f277b93c348c1198af7",
  R144: "7fdb52869c5c823d1756fd0ff903c926d9b750553753651432b196c850d61d3f",
  R145: "9ef300bfd1d9927c482e80c2d6e24d3b05066823eb59bc37b1e89b93f1a30f70",
  R146: "4ab5924d0f30016050d268bc5355caa5c9fd88bca89a7ef542d8ef7bae29ce5e",
  R147: "abae3f757c757f23e486deca6a923fd57a7bb72499c41a71e322c54b2b904c25",
  R148: "39f7cf7b8610ea97b24b5b75373ae0266c013e3ea57a3a02bd19cfa2fa99b556",
  R149: "2847cae228d2ff7ccfa9f30d10a55fd9504ae4480487ea0a944f074abf325cab",
  R150: "643ac118d83c2c56a64950e9af6b4cb2abc634ce1732bb1c00b6a0663470f985",
  R151: "3d2eea3299cd18cde29c5e574c6b468d80035a6bf75b378e3d45139ebdb77fd0",
  R23: "9e01f45f291d806a4eef47f6fbf817e3e47e92610d0a37f671b03abe7fb91ed9",
  R24: "2e35a9a2dd10751c7b690dd1ea7e4d4ccee3b2b1550807a015d9623e24f54121",
  R112: "067b9a2d9c3a89fcd20f3602193c51cc151b5a698f34a3499e4229e6dd0011c2",
  R113: "84aedd8539dad6bafc3cd263b8bcede4549fd3aa37d446428277ef88d0446b48",
  R114: "3003a9c0aba6f6d93fc6b521bede3db8b2ff94074dc3cc773834d532a23050c9",
  R115: "68858bf61d0870474463f55b3cf5081a52367d19a5266f7e23d7c8cf27ce353c",
  R116: "9871a6c1fee998e606375655997ef917f6475d89c1bd546c1ecf9f29b524b1e6",
  R126: "e2d99cd995732343ca407932a63ebebb4d1201c6c23f687f1e094b4d72249b36",
  R127: "669a7c09febf96e206cd0ba4cee1a9da4844fe23ab111ed0c9e51897f54a5c9a",
};
/* Attempt 8 (coordinator rulings 5 Nov 2026 17:20, 18:05): R73-R111, R117-R120, R122-R125 and R128-R135 live in
   interface-shell-t50-t51.md and R136-R151 in interface-shell-t53.md, removed from the parent with one pointer line each.
   The R blocks are read across the parent and its two split files: same hashes, same id set, same unmet set. */
const PARENT = read("build/requirements/interface-shell.md");
const SPLITS = { "interface-shell-t50-t51.md": read("build/requirements/interface-shell-t50-t51.md"), "interface-shell-t53.md": read("build/requirements/interface-shell-t53.md") };
const REQ = [PARENT, ...Object.values(SPLITS)].join("\n\n");
const NOTES = read("docs/requirements-notes/interface-shell.md");

const isR = (id) => id.startsWith("R");

test("the consolidation keeps the set of requirement ids: every R id at the start commit, and no other R id", () => {
  assert.deepEqual([...blocks(REQ).keys()].filter(isR).sort(), Object.keys(START_BLOCKS).sort());
});

/* this branch's found marks (attempt 4, walk p3dev-t1; F4 at BOB's word after the review), pinned as the R ids are: each held, in this order, and the unmet ones exactly these,
   each with its mark; a later found mark is admitted after them (F5 on), numbered on with no gap */
const BRANCH_F = ["F1", "F2", "F3", "F4"];
const BRANCH_F_UNMET = { F2: "*(not yet met: walk p3dev-t1 4 Nov)*", F4: "*(not yet met: walk p3dev-t1 4 Nov; R103 placement has no clear place)*" };

test("this branch's found marks F1-F4 are each held, in order, and only F2 and F4 are unmet, each with its mark; a later F id is admitted after them, numbered on from F5 with no gap, and an unmet one carries a mark of the form `*(not yet met: <where>)*`", () => {
  const fs = [...blocks(REQ)].filter(([id]) => !isR(id));
  const ids = fs.map(([id]) => id);
  assert.deepEqual(ids.slice(0, BRANCH_F.length), BRANCH_F, "F1-F4 held, in order");
  assert.deepEqual(ids, ids.map((_, i) => "F" + (i + 1)), "numbered on with no gap");
  for (const [id, text] of fs) {
    const first = text.split("\n")[0];
    if (BRANCH_F.includes(id)) {
      if (Object.hasOwn(BRANCH_F_UNMET, id)) assert.ok(first.includes(BRANCH_F_UNMET[id]), id + " keeps its mark");
      else assert.equal(first.includes(MARK), false, id + " is met");
    } else if (first.includes(MARK)) assert.match(first, /\*\(not yet met: [^)]+\)\*/, id + "'s mark");
  }
});

test("every requirement is word for word as at the start commit, with its lines beneath; a struck mark is the one change", () => {
  for (const [id, text] of blocks(REQ)) {
    if (!isR(id)) continue;
    if (Object.hasOwn(STRUCK, id)) {
      assert.equal(text.includes(MARK), false, id + " is struck");
      const first = text.split("\n")[0];
      const at = first.indexOf(" Test:");
      const back = at >= 0 ? first.slice(0, at) + STRUCK[id] + first.slice(at) : first + STRUCK[id];
      assert.equal(sha([back, ...text.split("\n").slice(1)].join("\n")), START_BLOCKS[id], id + " differs from the start only by its mark");
    } else assert.equal(sha(text), START_BLOCKS[id], id + " is unchanged");
  }
});

test("the unmet R marks are the start commit's, less those this branch struck; control: no R mark is added", () => {
  const unmet = [...blocks(REQ)].filter(([id, t]) => isR(id) && t.split("\n")[0].includes(MARK)).map(([id]) => id);
  assert.deepEqual(unmet, START_UNMET.filter((id) => !Object.hasOwn(STRUCK, id)));
});

test("the moved text is in the notes word for word: the status, the size, the Uses, Satisfies and the Suggestions that are no requirement", () => {
  for (const head of ["## Status", "## Size", "## Uses", "## Satisfies", "## Suggestions"]) assert.ok(NOTES.includes(head), head);
  for (const l of NOTES.split("\n").filter((x) => x.startsWith("- ") || x.startsWith("**Status**") || x.startsWith("**Size"))) assert.equal(REQ.includes(l), false, "moved, not copied: " + l.slice(0, 60));
  assert.match(NOTES, /^\*\*Status\*\* · Fix round 10 \(T51; K5046 \(c\), \(d\)\)/m);
});

const SPLIT_IDS = {
  "interface-shell-t50-t51.md": [[73, 111], [117, 120], [122, 125], [128, 135]],
  "interface-shell-t53.md": [[136, 151]],
};
const ids = (runs) => runs.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => "R" + (a + i)));

test("the split: each split file holds exactly its runs of R ids and no F id; the parent holds none of them, names each split file in one pointer line, and is under the 70000-byte cap", () => {
  const parent = [...blocks(PARENT).keys()];
  for (const [file, runs] of Object.entries(SPLIT_IDS)) {
    const want = ids(runs);
    assert.deepEqual([...blocks(SPLITS[file]).keys()], want, file + " holds its runs, in order");
    for (const id of want) assert.equal(parent.includes(id), false, id + " removed from the parent");
    assert.equal(PARENT.split("\n").filter((l) => l.includes("`build/requirements/" + file + "`")).length, 1, "one pointer line to " + file);
  }
  for (const h of ["#### T50 (T50-27)", "#### T51 (T51-113)", "#### T51 fix round 8"]) assert.equal(PARENT.includes(h), false, h + " moved with its run");
  assert.ok(Buffer.byteLength(PARENT) < 70000, "parent under the cap");
});
