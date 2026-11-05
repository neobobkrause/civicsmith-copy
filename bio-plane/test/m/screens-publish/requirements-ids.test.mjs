/* screens-publish: the requirements file's consolidation (job screens-publish, attempt 1, 5 Nov 2026) changes no requirement.
   START_LINES is each R and F line of build/requirements/screens-publish.md at the start commit (48566a017fc), by sha256
   of the whole line with its "not yet met" mark taken out, so a mark struck when its requirement is met keeps the line.
   START_UNMET is the marks at that commit: a line may lose its mark, never gain one it did not have. The Status history,
   Size, Satisfies and Suggestions moved word for word to docs/requirements-notes/screens-publish.md. The R lines alone
   are over the 70,000-byte cap, so the cap is not asserted here; the split proposal is in the notes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const MARK = / ?\*\(not yet met: ([^)]*)\)\*/;
const idLines = (text) => {
  const m = new Map();
  for (const l of text.split("\n")) {
    const x = /^- \*\*([RF]\d+)\*\*/.exec(l);
    if (x) { assert.ok(!m.has(x[1]), `id ${x[1]} appears twice`); m.set(x[1], l); }
  }
  return m;
};

const START_LINES = {
  R1: "8669d739fc639983fb7fc9bae8df1b9eea116f474c0a31493afc2ff8575c677b",
  R2: "2991edee38b4bbf6bb81944be5252e6b3d7ce8c5531aa088d8cd70f07d9f2fde",
  R3: "2f1bafa45496d2e92a32f13637823223c5120539a348913e7ae7eb5a6efc3967",
  R4: "7db3736b7d7609cc2edb50ffa5dcbc1d165029d152521a2010d35c02a17818f3",
  R5: "fc78dc28ee972667ff1589f699ee8e084b2b7d71f4fab0324f09804961f4adb6",
  R6: "0c1fe30c436cbe4d28d32191eabfaf6ebc4204e026ce07e58ef03e7a25221c5a",
  R7: "5c68df23fe22748d4d251019d5ca62d61547c917444758783f7b38e259564b00",
  R8: "604ee4eb63a09265985fc601b0515179465b2e555e79e6039e6ebf17671c28a3",
  R9: "223e6b28df1b498f7c734818d165d7bbc65ab0ba211be6102841a6263c7063d6",
  R10: "09cd854d55a7c49566cbbbcc5e2a584a76bc0da6890249f5c879a0b4ad8602a5",
  R12: "309bfc761f672844b37f10785e017e04aa7c4bc0d68ccacaa53f58ac20cb7783",
  R13: "0099f9e7c22e4a0b9995f211bfa82df328a6cc1708e15ee145aa2830da6adcf8",
  R14: "aade8cfe44ef070a746b7e06e5f108737bfb3f1bdbc7b18b7f9693a61f6a4fe3",
  R15: "f00480d35e43bfd7e4d5ea6c57c79eba47243c63f603035f1c29d3e582b79e54",
  R16: "b0ee301b95438dde7af1e4f67bbf82bfc6fc3d2d711515d76005993395d91918",
  R17: "202401cfb25c4e82b0ed5ef2ab72fc719287bdd1b029e0a02999b21e1cbac776",
  R18: "f7a918a1507c876f24c878317dc59f066930116c5772760003ee00b0195dea9a",
  R19: "ee832835baa761aa8ad765f76a04094ca85e392486aa2c590931c99220315d56",
  R20: "214f181dddeac7d7decedc74173f64b287fbecd79aec52daa65e04e3b69f3b4f",
  R21: "3eb7c8d6d846b30b4bf3d08c1c3cda3d03040ffc294c577b0e60355131f35b39",
  R22: "d31782627dfa012149e0d6b3bd109a603115e32f8df3df5253f54ceab6461ec6",
  R23: "2f0e4158168d6cce11666fae24c40356dd69125e058398b0281f134766066bd5",
  R24: "ca38db7149e144de21e12cd16c3811ababaadbc71a8b58f0a8bc42d9235e14b9",
  R25: "dd131f322c6f35458d11bcb3887f7b42296e5efa72686282c202a9bb36320396",
  R26: "55fa2f6dbfb8386551b3ad6c35d5c0f5aa1de19958cf0d80afdc053927c9c92d",
  R27: "c8da92e13cd2c5947468a051b8c660770a76e9bb4515887482cac67be9818f5f",
  R28: "6a12e617948faf4a15902b458d1564c235fa6a67fb57d8c58796bc31e3875186",
  R29: "f7699162c9ead98f263b5050da75e0ad91ec20fd1e2758c15d3edf5d82af9480",
  R30: "067025ef53edaca3c01278ae3206a84755456a0067125120d42383b1198b1056",
  R31: "27604861a2423da92b1d045489946015bcb9a03f04271bf0ac8760241e57a99b",
  R32: "a854f71e7b8cb4b9c0a244d9360cc93f385649c8ec8c63b283b19d36e111302e",
  R33: "f63ff9a424b087a18c9686355064c32368654ae9e90c03d618e5359583eca1b8",
  R34: "d1d7f078c585d62a0a280ffd7b3ca0d67c6696f05c5e9023b0510acadcad2364",
  R35: "dd3347b0570107472976c622ddb29cd7db78f2fc003a54455ae6473b35c0603e",
  R36: "60465091455137f31ad6d297acf51d7e8c6bb603987744fee191a7fda09491cf",
  R37: "7b4b61d00dd4b919fdff82f9e2cf7f6b2e827243728ab1287e2a5ecbb9b2689e",
  R38: "6e7913cd9b93caa1102f87c7a7aba1582fa2cc129ba308d425338d97d3c91e2e",
  R39: "06deccc267f26c3b75d2ed70e198478bbd8972f5418dffe7b1b91d72190cc7ba",
  R40: "c315dd367326b13533674ca38fa938b6469a8892ebbede58d9d1cb7a72b9dea8",
  R41: "208afae21894247d4b3a7539f2cde093912c70cc200848824b8b86b49594f324",
  R42: "4ab829946222cad4727e0753b69e253bdd5899a36edcf2eee745ba9ae06ca3a7",
  R43: "f4377684abe6e2bae49d044c974cb404f5f28ecad74ef63e1b548099a12501e8",
  R44: "615de497311e21450e26389d5a18f7e0014e81207c20a787d0ccec5f0b62440a",
  R45: "e02fb1b135b6d518aa6ccc4eb711f719e5598aa3607e2a99f4b17ddad6b768e0",
  R46: "836b1a24eafc4a16d5af07161cf6c4c84bad8eae6fe39f8442427c4b73ce1d21",
  R47: "c170141cb337d8828e08b9aea219432af3673eed432c1cb90822041da78c2e55",
  R48: "d5a2ff08fec13c7f05b5fb4ee014386840e9c8a24efb37b93d98b3034344bb2c",
  R49: "905b2b47cbf874fa2a13bd64c80213e66b3ea50f05b90dfb96df357b009899e8",
  R50: "92022079d486e2b4c46776773f4c359b0dcc7d910c591aeec6ee459fb33a8dc0",
  R51: "4ed463cca1d6b6345284777cf780a225db1833656cf8ea364bfe2fa917a36271",
  R52: "a7ae85025c68b94fc10f1080bde9d385085d6bec76ac0320a979250f2af9beb5",
  R53: "a9b1ee40726978566d07edb621aab11fd8c417140b09a9392c557bbf24686da3",
  R54: "53b436d48d1b45462c80ced7edc63109ebff64728984cb3a8dff34dc50c30675",
  R55: "97d3f1f98b4f25ab1cf6df81ed76330782592feb271ecabf1ea42e764b3e8ad5",
  R56: "ea895caa67318421b240fc3524ae445f26c844003bf75807b5c62599861b552f",
  R57: "cca0f19aa247bc6ddaefcb4da0bf33100302590879b35180f8f429d8e6ec7a0c",
  R58: "34b6dd984c9039f9101563733f85d093c414e273e7ca274f663875b8421a21b4",
  R59: "984db9b5b0ec7db1e46f5d741c3ab6eef092268c360cb2e2d1b255cc0c4bd19e",
  R60: "ab122e7e2f12d94a509c8c20a653af7cef9ab552fa52bb074eb537c51f402d14",
  R61: "21dee16047c2a5f2f89ec2ceee33c4c9d7f12a6ad56374f016a98eb6c237044b",
  R62: "54613c7f4e37469a5978609d33b952cf3d535cc48f23ebfd9c8926ed1dd7e426",
  R63: "4fa97acec0bd642bc49fd0d9155d1cdda44ad6643b3871397cc747b861c70eca",
  R64: "2d7c174358e0d0b38ee09a5bf34bb8e7d0a4ea40f9e7cf3d0923be504f23da22",
  R65: "52f20f77756cf423ac4d55837dc17594bd96752cd025b70a4996802b1cd14280",
  R66: "a7139099426962997019fd7c29e14c1111499016b6b979022700e790bd811252",
  R67: "c6b6bfb5cfb05f1f4c713ac114c32b37543e66ae5a6b241222fecb32b8c0a13f",
  R68: "cdbb8d12673783834f2fc48bb8293fb44ca27abb1ce971f957f63371331d266d",
  R69: "bea691f098ad8c262c1a859f8a4d92f6912cacc3fd869e535f8b396802e43cb7",
  R70: "64c54a9aa41699a9f01a09f489f6cb9bfbd049bc2f23ed680300dc534af04ee8",
  R71: "ad8d961b8e060dc9b0e1532b8e8e87ab1e64338123ca29afa5aed4e67f2f71d8",
  R72: "79c35757b98334ec4e764ad68cc557bd23dbcec57623655b68aa7c4c2d570b88",
  R80: "cf45cc803f5a13726b989528d570865a7c9ea2b56a3cb674ce9aa95dfa071188",
  R82: "8dd2dfa1262b2eb501367b8c2fd93da02cd7868474c411d6be7d2552ffe2ff79",
  R83: "0ec70aa4edadc552026b5a398bc153c053fde63c1d8e2a64c5faa8a92c6c138b",
  R84: "06d1c8daed1d762361cfd747f952440c9b96416f790eb2e67a26aca7787644ff",
  R85: "06bba58da48bc62b689b078c6bd926837c4dbadfa2079017869f95143d4d0e9d",
  R86: "54d26477d4a98b6f81ce9bbe1ccdd9ae381f2b32760d8ac401f4e275037dc3a4",
  R87: "83d0711addaab1e2751bb317e0ba63ac58a2b3912336edada25e8358f317a9a8",
  R88: "8b7aad3eb13448ac55dd33e0079fc947c8a5e1a4a34727dd7522ac2c12b24c7e",
  R89: "bd0577733f1f1106eafc19906dd437a38e7f2f6fb9e14672bfdf53e891ae8ec0",
  R90: "a21c6f7bfe024f3544a8fe2b66bdbb3a941748175ff7a66b82cf24219da0e3e1",
  R91: "b0d2fc919676e9ac75c19c857dca831ecbd0d8c216f5acd7dda3f8a8303f2a0d",
  R92: "6b57f06a7da3ca588ddc551f6db7fd5eb4b713705fba9a9bbdb1060cd974a8f7",
  R93: "6d0450f436e7d0d65f9bc3427367e13ab8a5e15f75853ed3ae5927af2ba962be",
  R94: "caa98cbd3b17c86c7222c921e8f1b29840b837dcae0462a737e1848474b32a26",
  R95: "0b680021f8ea8693ec0fa7618eb49dc5879ed03b80da3448fb686255ba58a178",
  R96: "b11eed97d4b31e086f5cbd7652db5832c96a0b76a5a8ec618f080fd4ab4e9fc8",
  R97: "8a964993e1664d55fe626194b189d0dddcda195e5d5e07513d9b9d10c4a718bf",
  R98: "8d11035b8e4769605a6c247a72bd1b9971d68ea0036e13150a9004220e31c159",
  R99: "f8a66a75c7eefc63031756a7945b15face0d708233e5dcffe9bd3cdf2cd8521b",
  R100: "13a6c0032fd6be605621bb2d32c5720bcd92909215ebbf05840e88e03287ceb5",
  R101: "524d7fecd1fd532a1700e2f4c080028dd87534b0111d31cbeed23513aa5c0d78",
  R102: "8ad1717944dd48f770559b0693dbfe0d9a7b7ebdd84f731cd67868e38f91c57c",
  R103: "3e3ffad307692c766c898f84e11ddc54755eebd89d3453e10d58234cef896092",
  R104: "281ef2743efbe09632f4566cdce55d009c33b18e9a36b1a0f5a8f86eaad2437d",
  R105: "626963d63aa8c048af0749f793fffcc5069782e1145f31d4997e47978c490c5b",
  R106: "5877bb52c1018828b206f837cd71e0c5d62592d57eacfac753da49d50b24bf47",
  R11: "309f2d20282659061ce9aa39a554d7b303b6dc4d52156384408b2658dc33d61d",
  R73: "d2e6735d8234c6ab3a7957adf47060bf13a23a4d28a878c250e99814d1e74647",
  R74: "ce5cb490d4a504b22798d949b3888f503a94069625993b7afd06c023ede55be9",
  R75: "70c8aeba407e52c9897b004ffc76ab325e6cc47cca2e8107e9eb158fae351612",
  R76: "4c78e1e25113442e7c5b380bf9752b2e3df9ea4b7ced62b7af3dbf26bb3de330",
  R77: "fd2ada12b305cd0ce89339f68e7933c5be36b09fa8e3e18feafe0189dfdf5a97",
  R78: "eca7e1aae04004f9d3d61541126c5efea7b9f82a310bc8c70c0470a2709210a4",
  R79: "e535bb4ddbe3c8a1b91898d31e68724ea2d195cfc77d320341fc228d8372f0c1",
  R81: "1f0c877b84f76f40e2a8d68ba35a2300be42ab8a7cd965c5837419990bb5bba0",
};
const START_UNMET = {"R82":"T53", "R83":"T53", "R84":"T53", "R85":"T53", "R86":"T53", "R87":"T53", "R88":"T53", "R89":"T53", "R90":"T53", "R91":"T53", "R92":"T53", "R93":"T53", "R94":"T53", "R95":"T53", "R96":"T53", "R97":"T53", "R98":"T53", "R99":"T53", "R100":"T53", "R101":"T53", "R102":"T53", "R103":"T53", "R104":"T53", "R105":"T53", "R106":"T53"};
const MOVED = ["444ff146155d060eb346504594bafd64e3668314efc68234fa4ccee36f50a3b4","d54f6cd7b37f0ffc9718f777c8f1820b1a1eea2393c347f0def9ed15d530c89a"]; // the Status and Size paragraphs at the start commit

test("consolidation: every start id is kept, in its start order, its line word for word but for a struck mark", () => {
  const now = idLines(read("build/requirements/screens-publish.md"));
  const ids = [...now.keys()].filter((id) => id in START_LINES);
  assert.deepEqual(ids, Object.keys(START_LINES));
  for (const [id, h] of Object.entries(START_LINES)) assert.equal(sha(now.get(id).replace(MARK, "")), h, id);
});

test("consolidation: no start line gained an unmet mark", () => {
  for (const [id, l] of idLines(read("build/requirements/screens-publish.md"))) {
    const m = MARK.exec(l);
    if (m && id in START_LINES) assert.equal(START_UNMET[id], m[1], id);
  }
});

test("consolidation: the moved notes are in docs/requirements-notes and no longer in the requirements file", () => {
  const req = read("build/requirements/screens-publish.md").split("\n").map(sha);
  const notes = read("docs/requirements-notes/screens-publish.md").split("\n").map(sha);
  for (const h of MOVED) { assert.ok(notes.includes(h)); assert.ok(!req.includes(h)); }
  assert.doesNotMatch(read("build/requirements/screens-publish.md"), /^### (Satisfies|Suggestions)$/m);
});
