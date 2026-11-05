/* capture: the requirements file's consolidation for size (job capture, attempt 1, 5 Nov 2026) keeps every id and mark;
   after the cap split (PR 474) the moved ids are retired lines here, held verbatim by held-captures and member-upload.
   START_LINES is each R line of build/requirements/capture.md at the start commit (f2e87913578), by sha256 of the
   line with any indented continuation lines under it. Every id stays, word for word with its mark; the set of unmet
   marks is unchanged; the text moved out (status history, size, uses, satisfies, suggestions) is in
   docs/requirements-notes/capture.md, verbatim, and no longer in the requirements file. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const REQ = "build/requirements/capture.md";
const NOTES = "docs/requirements-notes/capture.md";

// Each id's line with its indented continuation lines (R73's and R91's sub-bullets), in file order.
const idBlocks = (text) => {
  const m = new Map();
  let cur = null;
  for (const l of text.split("\n")) {
    const x = /^\s*- \*\*([RF]\d+)\*\*/.exec(l);
    if (x) { assert.ok(!m.has(x[1]), `id ${x[1]} appears twice`); cur = x[1]; m.set(cur, [l]); }
    else if (/^  /.test(l) && cur) m.get(cur).push(l);
    else cur = null;
  }
  return new Map([...m].map(([k, v]) => [k, v.join("\n")]));
};
const unmet = (blocks) => [...blocks].filter(([, b]) => b.split("\n")[0].includes("*(not yet met")).map(([k]) => k).sort();

const START_LINES = {
  R1: "a22606a209d86857f0bdc3d0d3ec1787c740613ea176a910af4688a2d747cfd8",
  R2: "6ca1884bf4503f07a424fc84effe93fa1a233476be2d6ba0551bd746a798de95",
  R3: "00a9d156a90cf277912e65ac065af7b4bbd982ec62c43817700f03ada9c35a0c",
  R4: "d1be04e4791f6fd5596e255e0568045fd3aa0ef7bbb33994198ea09701ae3f07",
  R5: "8a39454909de83bf760c4a57ed9e6806dfc49150d182a6eb81ba7370fd106ac2",
  R6: "4314e37d7f40ee0f4ea09f7916b6a09cd068b2db5a773a467151876c00a07dc4",
  R41: "ffe1e0c65b2da782ed3626e9b07caa8a406a4157685fbf4bbc876d4e0f38ab56",
  R42: "098ebe39c3e706a4b8a761929aa82680ab373f655f9ce1f01165b15044e27515",
  R7: "e22b3b1b46d3f0638af0d75710eef0b5f2ac3da04f8a7b03eca07dcb5588755c",
  R8: "c0da0e920c9c0658bb147b919d80133935172203c49d5968349498090ff03c96",
  R90: "7b696d26c4fc78b854e90cd6c7ab9f13ff7827b494706e5cb1d4a743a83c97ba",
  R9: "061f3fdd77d0a0b3c25619813156af5c1c6bd009e49a1a7cb1493deb8fd9795f",
  R10: "0578da051eec333a40183128a0ba388c29267b9e6373c4f545e104614b100338",
  R11: "4db22d89cba00cff4f9f9aea2d653a8f113aed85a0a8e5038fa8264954860f75",
  R12: "5e82fd272a9aa97bd93265eb30bbdd8b33bf4d54b5bf2059a47bf9e66b9607b7",
  R13: "0aec60bfbfd2ac1d60027fbe02745920f5dd9e5bbeefd9af98dde16aff122745",
  R14: "349481ca14c9879dd787f255d601a4c401dbfb301fe97514de766a9ccfb7d149",
  R15: "0a91e592aaebadf913d4967b0416d39217facffeda63aabe28503cd18d35e88c",
  R16: "2eea8ca2aed0748dfc80e2b7109d332e90198a28b2a9e255a0a07356023623ed",
  R17: "970f0acb191afff1f70022cc14ab6b3f6b681bb4defbf1b54bde4b5fce8d22ca",
  R18: "f309a824e89f8183286e6ee5ace4cd0097996d490945a03933ffea8bbaa64a02",
  R19: "0996ef2c294e2d8f16cdf8f3661ecdac343a8657ee12d8e348b1d038b50ce39e",
  R20: "2d114addf918be71b9b289fda506859d921686ef884f73e208df50404740600d",
  R21: "1a1c3416e32d602948bf90829a14b5e90b085279bcc635c4270e48683ed28d8b",
  R22: "823fae59ef1652fadd30950eb021bd170451581ef33ef53af784917db71b5cf5",
  R23: "d60a378153c650cd4fd9e31095c3519e4778f25e23bc0553b52477f0035ecb54",
  R24: "5a2f1c76ff7664004115ae26891cfc4af7e102df9848fae54564751c0a9a35b5",
  R25: "8ace24134edafe677b881d7f8e8f33fd36bcf714b182b9ecda2efa9b68560821",
  R26: "13e4cb4a418741a63be96166d2ea5737e42435d5a48e4ca923dd750b80569893",
  R27: "ac85c5118c334dec4c205bd4a433e97cd8cf93fe0998f317fbb55b854ef050fc",
  R28: "8550bc8626d8f975fb648443da1f3503538f5a79aa2a60760f8aed59d9dd9de9",
  R29: "5279ecae3eb2bc999552f19b721f269e76c10aaa84e4463617fefa36b30eb433",
  R39: "35799b850e7ee9305b98bf0bdb1f917c9752d9fda3f9d788e2fa3cbef45e502b",
  R40: "7fc5f2c430a73bc66837cd9ea576fc6c739ee36a342a81b7cc06ac45e84d0b25",
  R30: "7d2936f10f34d2b5ae87eb9ecfebd560d265feb73fa1c222427312157c21001c",
  R31: "16a29e14fdb1ccf10bb19e7c9b31659760bd22659d5adf41456394e9f54571e2",
  R32: "fd6d62488c0fd3d97ceda445d88a83945e175a0217d6644151e6acbf26155878",
  R53: "d8e1b2b6ccafce3ad34e909c2295d0660dd0ae5f7276a0d96abdb0d7c27110ef",
  R54: "f96faf0a77c6fc51bce27e748e442fe1f7cdd96db12e06130e6ce42eebb3d545",
  R80: "48e91c7fe7efdd5c1fb2043be6ec0931fc2be9a84211955e7e882e52e306a79e",
  R85: "e7e994c723cc2caa0f156960d3bb0fcecc73a3a99e3ae9384a68674623dbc7e7",
  R65: "cab63733411b51e5f4c06221be6ece7929229c4095cf43ad09200cfc1ebf00d6",
  R66: "fa81cd448cf290400356a9b9b1f0968eb6bd0cf3cc3ef2a46428baa8b956f96f",
  R67: "309c383bb744927233b8ff468b388f52fa4c90c6d380803a1c937b75ef71d371",
  R68: "2eed6bfd0fac01c4c9b592b195ddbbf31701031a5398ad65656b48eb066bad33",
  R69: "53484de7113b71820ee6971840c6928b480607174124c633238cad37119496be",
  R71: "816bc377ccd03278c22d5798275737300bcd480e86b72f97c597e84e37aaabe5",
  R72: "7783540e4c5f94f3e53ced1e8bf475edce3fae5bc151ccfea012b0d4bc6fc19b",
  R73: "497b7b9fe407e37b9247653ba70afc893552ab19db5e496871badd9e06e28b44",
  R86: "2c0f7e3fc128f1eee67225f78de6665d1f08f5080b141cdc944e5c89e209ed9c",
  R76: "ae60703424577a55a7e6c558a2397a0ea44af54a38dbb15f64b68139644d70dd",
  R77: "aac03ca9308acfcff992665835d182ab26097d4cd0d005e05b36005efef79d61",
  R88: "176427d7413a0e69538050b31b48f756f9b3d08a7f2441e2808f0bb7317bd948",
  R91: "bff0c2656a4e9bba5c5a67ea830b736fde5dc1edd01b8ba9b1b7852ba9b6d5cd",
  R78: "c7a695e62d2d19f1c5c9063950b92a5cfffa070921e8ca340f3d8e54d0d458a2",
  R79: "6a622f44ff050b5e0f50282db72e9f735d4393ba6f74f40f9d31af7591ce7c3c",
  R81: "56f0a8835e5889981875defd1c9e5aed0991f62781dc4373b23e11e8cc5a9352",
  R82: "198871cf2fb7f409905958f53840e326332cd019d5bd92f1009fe624e3b409f2",
  R83: "1fa92caadf99921890fc6c8d04ae2444579f807a5570e3ac1d21e7b65728a8a0",
  R84: "61d12f4119fc04e337ca2cb2c6c0c12c2a3338b7afdf1dbed462d0a0a798bcf4",
  R43: "47db818facb315131e4cc42329b98a9c71528f23165ed77d84275533f50be339",
  R44: "c6876b34eb577ac7e98e4e517762f5eba87eaf9328e23be6e39f8ea9fa728f33",
  R45: "a7ddd8d875207ce2b9f3c76103b94fe575c99e5969072150ae830a05e0f6c33f",
  R46: "54b3c99dfeb832a983f89c5608ecfdf6a664d4ad1b5ef0b40ba75a648fa34b86",
  R55: "8b8d150923b939efe17d7edb906760b9628935a3f5d611ac2e8da0bc153b53b9",
  R56: "42b171ead0b58ca09b14405a87131659d5baa6ba30639e872864e4668bcb36bd",
  R89: "375905756f3281a495320ed94e3503a736e4ac4b2891d6cbfad6a6d18e778d2f",
  R87: "fbb59a7dc198f4f69b75252413ede5d8f1aad8628b751866036b1656c7e6b67f",
  R57: "f401bee3aafe5ed0fe6d3e10e6d7701313e1ea87f632de97d4876517576d27f9",
  R58: "b7068814be921eff2086905a71d5092839306bfd955135866ae1087d125e131f",
  R59: "fdbfa45e1025f56d30b5b39bde5d4f61e8321b319a6b19f467b1e539f143f86a",
  R60: "ed01def4f411ab2ca4bdf829e3ef95a6316387bd9d72415952ba25f1c535185b",
  R61: "570da009010e8a8115b80d703c4805a16c1d9053f673450cc523f6170a025219",
  R62: "97e87881963eac887389b81ff2f6a1354b6b57c3ad896a2a80521d7b7de716d3",
  R63: "efd3c52e689957850a75998a10d19b1d491d62626ae45da8f6a2b4e756eca7ac",
  R75: "f129e398903648af7118d173906fa0f3585394ed85a1db52a7fbf022144b8816",
  R92: "ddfbbb9e85de979f4398cc399a5c9c9668c548b2c914172bd17aad8b31d8a9b4",
  R93: "a36141dad9c95ac73b3998fed038ee4dd3e677e037dc45209ba8648060fde544",
  R94: "a83bbcfe5ca352ffbf5d3b2e8dacc25f6e93cec88cda20f352880b8895b6ead0",
  R95: "21ad9e002fcd2566101498a93a564b0fb51ea463c24f0959f8bc236c69fe8cea",
  R96: "c509d33c0f37fbe6ce0d46161f1e5db3397d0f9649a76ddfa9f1452ee936a822",
  R100: "94b094a3da13ab555b5c2fe5e1181a4f62a09687214f27d259a469e0361b0639",
  R33: "7290b9f779145f64f099c5004926783859944179ade060f19b0d4bdb5d1490a8",
  R34: "93e0a59b9808f90fb50299a3874d2cc71fb44cc465475c3e50ff9950570d40d4",
  R35: "0fd15fa54d1e326f5448b07bea3aa5ffa92228a93ed6a8b62c4636a8afbe4d8d",
  R36: "7a274af0ab4443617a85a030be21d5992e3d448347be6133c80b814283b3ddfd",
  R37: "4236bb869a5ed662b0cc701dadefe953daa09852dac8532a34cb1800438f7374",
  R47: "676bc7385e46e44eae1df53af78b0e4328cf919333bb9644ec2e6d18332fbd1e",
  R48: "745b149d61ccbdb5c3b4221fea20800e384eb4c79fc4a5a7e65fbdf6f191840a",
  R49: "f8d903c1794abe71d8a838f6361bc2470f826ddbca704f4ab5ca2bfd1a04cb76",
  R50: "9b1527a21b727c25e69078097167b5d1974f904cee0290a8ec90a9dd2199f74f",
  R51: "8d31a2ae589aa8d3702f03630ef3554802f71e9d67802913db3ee9ccab77fad0",
  R52: "c5381d018f5d177aa13bde427d998f722829ea4dbb149da70eb6ebd598e7d47a",
  R38: "2d778be0f6b8efef4150734398874fc0dbe8c9ce8c5333ddae7731cd0066093d",
  R64: "503f4ae51c972ea2e74bf1943e1724441f7d9931fc74cb3d4eacf4ccadd69f0d",
  R70: "9acc025a811cb85ce52d9638f25f8f1e1ea138e87e40963dabcb39b9c2e46c12",
  R74: "6daac315cacec0230bef74535453132205b0ed77f47483f1121565547e5ae418",
  R97: "fcdf7975ad60d7a7a2f308e4fad45927cb6a45b5ceac75e11a74e2dafd882c29",
  R98: "5f652c62da4d87ba9cf02aae1a334eebf676ab9730ff2e5a0819fd85912f5100",
  R99: "7d6f8a1199e6cfbd6a4edc49cdcba620ed5f7a1634ab95078cd0aba334b21deb",
  R101: "87b50275f811f0756265895fc6d56e57a2768cbcf6503dbb09fd01325c9585a3",
  R102: "9697be216ec097fa87e7e5bd054b69b482ed59e034771ffe9d33cbaf0d1bf635",
  R103: "c54ed3a855b41ada7ebb8dea430bb1634f6715f71bf8a3c1cc9f8696f7c20b2e",
  R104: "68d8f4fa33d1e952338b33748cf3e982d14e955c497b55e485f414db02721ec7",
  R105: "f3abf360bfeb35329d090a29939c1e39790a39ea99fe562f29dad31e58cf3566",
  R106: "147f4835f8b6c3204ce4e61c98af9b11899c41e12e1eb8be892f23c16f209b26",
  R107: "28f0f8acf04c2cb3e0662ba9396c70e326891fc1891f2e4d9a0457a32ad898ae",
  R108: "ec6f76fc4eb74a9f6056153801411af3ba91f54cea7a6a17344007cb0700752b",
  R109: "2a3f3ed99115c7dacbc99b126787a0381eac3418a3d583e22cdc440949ac9454",
  R110: "6fedeaa7b97e5359d36a87b9cb36d276fd8bd63cdf984c94dc59bfa3264413ed",
  R111: "d13c284e1ddc4314339cf5b06fe2ae9902767933f83d3abe653cee3c3af28da7",
  R112: "dbd3faced3c7d0f8181ede848fc0f4c25544430e439faad4ba1fce41e8bbfc04",
  R113: "4c3f2b4271e47bdfc39f79f03e6e5fa92fc51d5f080d6b781ce1ca5924ef78c8",
  R114: "209c0f150c97fbc93817a72be591087d7e43e156abddada046e4938ae66a36ca",
  R115: "d422cb4568175d787f550859241be608c986c11439081696303da6db763718cd",
  R116: "833f37fdd41ebe39b32e73d6169fc2ab5ef15bbe1614aa7bc3ac8a04b2e83713",
  R117: "02c5bce674eae92545cbd6cfcf5ff0f85246c554697432a4f6ea229c220d735d",
  R118: "f25d55fee47579ff1802867358a6b17e4ecb937c99d878acf9ba26c6664f953e",
  R119: "3e45bc8a2e3c8e599fa20108308f545d96bbbfa638798abeffdee339164fca8b",
  R120: "83471253ce9195916160c27f0265b662912175c3370726b7c91240fa34acdf23",
  R121: "fd6ae6352ca6fc4c37e8471fe8c38e45dec6a16343d83797dd793f7ef0cd4b4b",
};
const START_UNMET = ["R117", "R120"];

/* Amended since the start, each by a mark this module met: F1 (found on tranche 5 Nov 2026, member-upload R117's ruling) widened R76's list of received
   routes to email and email-attachment, and is itself struck. Each such line is held here by its sha256 as it reads now. */
const AMENDED = {
  R76: "307526e2f3161cfbb093d9d9fa7271a9d619a5b9a5234efd44e7e6dde42c059e",
  F1: "c62ea4df0ad50fc57eb6221572dbfb8437686f2bae22e5399fc4688c5dc90dd5",
};

// The cap split (PR 474, 5 Nov 2026) copied these ids verbatim into two new modules; here each is one retired line.
const MOVED = {
  "held-captures": ["R77", "R78", "R79", "R81", "R82", "R83", "R84", "R88", "R91", "R100", "R101", "R102"],
  "member-upload": ["R86", "R92", "R93", "R103", "R107", "R108", "R109", "R110", "R111", "R113", "R114", "R116", "R117", "R118", "R119", "R120"],
};
const MOVED_TO = new Map(Object.entries(MOVED).flatMap(([mod, ids]) => ids.map((id) => [id, mod])));

test("capture requirements: every R id at the start commit stays, word for word with its mark, or is retired naming the module that holds it verbatim", () => {
  const now = idBlocks(read(REQ));
  assert.deepEqual([...now.keys()].sort(), [...new Set([...Object.keys(START_LINES), ...Object.keys(AMENDED)])].sort(), "the set of ids is the start's and the found marks'");
  for (const id of Object.keys(AMENDED).filter((id) => !(id in START_LINES))) assert.equal(sha(now.get(id)), AMENDED[id], `${id}'s line is as struck`);
  const there = Object.fromEntries(Object.keys(MOVED).map((mod) => [mod, idBlocks(read(`build/requirements/${mod}.md`))]));
  for (const [id, h] of Object.entries(START_LINES)) {
    const mod = MOVED_TO.get(id);
    if (!mod) { assert.equal(sha(now.get(id)), AMENDED[id] ?? h, `${id}'s line is verbatim${AMENDED[id] ? " as amended" : ""}`); continue; }
    assert.equal(now.get(id), `- **${id}** *(retired: moved to ${mod} ${id}, cap split 5 Nov 2026, PR 474)*`, `${id} is retired here, naming ${mod}`);
    assert.equal(sha(there[mod].get(id)), h, `${id} is verbatim in ${mod}`);
  }
});

test("capture requirements: the unmet marks are the start's, those moved now held by member-upload", () => {
  assert.deepEqual(unmet(idBlocks(read(REQ))), [], "capture keeps no unmet mark");
  const moved = unmet(idBlocks(read("build/requirements/member-upload.md")));
  assert.deepEqual(moved, START_UNMET.filter((id) => MOVED_TO.get(id) === "member-upload").sort());
});

test("capture requirements: the non-requirement text lives in the notes, and the file is under the cap", () => {
  const req = read(REQ), notes = read(NOTES);
  for (const marker of [
    "**Size (P6).** As the code stands",
    "Its second split for size (T42, K2607; N826)",
    "- `acquisition`: `acquire`, `archiveLookup` (R73)",
    "- `docs/architecture/BIO_System_Design.md` §3, construct 2.",
    "- **The op handlers move here** (layers ruling 2)",
  ]) {
    assert.ok(notes.includes(marker), `the notes hold: ${marker}`);
    assert.ok(!req.includes(marker), `the requirements file no longer holds: ${marker}`);
  }
  assert.ok(!/^\s*- \*\*[RF]\d+\*\*/m.test(notes), "the notes hold no requirement line");
  assert.ok(Buffer.byteLength(req) < 70000, "the requirements file is under the 70,000-byte cap");
});
