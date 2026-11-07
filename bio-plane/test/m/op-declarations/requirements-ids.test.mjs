/* op-declarations: the requirements file's consolidation and the two splits (4 Nov 2026) keep every id.
   START_LINES is each R and F line of build/requirements/op-declarations.md at the start commit (128357dd88c), by
   sha256 of the whole line. A kept id's line is unchanged, word for word with its mark; a moved id (R49-R75 to
   op-specs-late, R76-R93 to surface-declarations) is a one-line retirement here naming its new id, and the new id's
   line in its new module is the old line verbatim,
   with only its id and the "(moved from op-declarations:R<n>)" note changed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const idLines = (text) => {
  const m = new Map();
  for (const l of text.split("\n")) {
    const x = /^- \*\*([RF]\d+)\*\*/.exec(l);
    if (x) { assert.ok(!m.has(x[1]), `id ${x[1]} appears twice`); m.set(x[1], l); }
  }
  return m;
};
const MARK = /^- \*\*[RF]\d+\*\* \*\(not yet met: ([^)]*)\)\*/;

const START_LINES = {
  R1: "d4c0e9216b59a7c99a13809b60a7cd580bc390b863e8bae2b6f2be3d3c171bac",
  R2: "5fd6e57122aa9d4543c9c6969b4a3e3e62e49aaa16b961b5e5afdd9d08c387ea",
  R3: "048bec61ddc1d8f221f74b8a158a3c507b803cddda14d6a8fef33631432278fe",
  R4: "aa19cf7389750325105aa5f6e0b35a8f3fe75cf31c050796566be772ebfd2b12",
  R5: "b416609738411fcc8e4980b7211ecc407f34e257b3e2b8c1e40c6ffb7bae0764",
  R6: "2561dad67858e627a336ec5ae5c7162f39adb44a7a3ba62b730962990a1ccd15",
  R7: "42ff65b03fe44ae4148f0f38e6c7770b6090586333170ca0ac22f87c4172ef61",
  R8: "c1f269ae07331c88139bba5f76d6c94a5f00a9d0a151441e510e46e7fe47f5ea",
  R9: "90fe8bee9f77a2d5da76358a9ae1ff32c6cf4462477dabb7011e55acee0849fe",
  R10: "63e5723e8f9505b23305e960c8c8d896c684f114cb62f650aca565b0c632a150",
  R11: "26d604831176c3a852e8650789052d89754485c311992552f6bd23e610f28b7a",
  R12: "fdf49d5ce4ef1a890882f0f466200c5390a3f4225a19e77b7ac9c1d5d54c1f5b",
  R13: "2175a5ab75625b9b1815fb3dd28017986a199b7f1142ef86475f1eeaee469b5f",
  R14: "72aebb19233bdb7021bd725bf696a8a6079bf5df67c3b1f9f37ddbee8d6ca6c2",
  R15: "246e75c2f193bd53297b466b89b7cbefcad892bcac7882950231cdbbdfb9a2f1",
  R16: "1720d7b090c8efa85d534401c5b445920c2eb5f152c4469bb3482f5bbf1106c2",
  R17: "780f91c69e4cf86fe9b34c28378fd35fb7ac6ffefce2545eeec90ff66d9caaee",
  R18: "e2f59936168cf67c5d26508d08eec55c0f6be80db33aee1c6fd122e25985fefb",
  R19: "aa046ec1c5dbf52332e12c048b7ab4cfc1df6e95e5245d50db40378d381251dc",
  R20: "5ff426f7f8ce085141c24509fc4c0a34aba9a13a7c3b139539dc8e77963e9bc9",
  R21: "bbd86053e55d47d5d2905c93cc18528657387bd3151e8ab3240ec59c89e6d28e",
  R22: "16c8c6d58a0a3643ed77a073b595825e0311abaf95aaed0080fce12e2a0600ce",
  R23: "28c3707367b3b379f605513816593293358a1fe6c4af31d4ab09165013d98743",
  R24: "aa6beb9b7c3b265fee477b9aeb5d19d92e0e1225352dce60cc2413fbb5cd2d99",
  R25: "d23fa0cd13b4bac235ea80b0dd199c59ffc4996a1752ef2d709eb3535f44fd6f",
  R26: "33002627d46bfd6947b5d0031a60bea588d1b4acd6cb83a0a4ebc11d74c833ec",
  R27: "03ea24cac543ec98f80ea740f322d42b7249c94292b10567bf03a1ed689b8880",
  R28: "1041da5e872475c24bb85c457c9c1273dc8bd7f85981f422cc9e90ebe48e03a8",
  R29: "b4137538850cb39263f18d0814f023281aa90ccbd418fb98d947b393154018b5",
  R30: "3487821a30d177b4f0415a2934fe43d72f76b166f0ad772e1f62119f670b24de",
  R31: "1df3ca51407912aafbf2472434a55958d0034ccedc0e198dbedbc4725095e119",
  R32: "c209727c02da176a78f035e10d8c07703f5fc1d49eeb1c8a60e46fe1943a993c",
  R33: "0e89015343a907b83ccd59a2e2a383e83d0f8c3985359208d5ceef3fd7fd467a",
  R34: "9cc49305ce29c1cef91019c47e32433a55e8d93f89b9f122c134f08bcbeef4b2",
  R35: "a49105b858ddb753a18b7d7900d99919ef4f6aca17fe4a91a7960ae8be9c2089",
  R36: "a107ed454a6e5b630b076461db3bcea7356f8d11ba5366770c9ef970c47e3831",
  R37: "1f0a9601a05092a0fab70ff96516376d982c81881f998d07ab2f4afe1d2ba29c",
  R38: "1e6564798294ce71801cd9a87b5b2ac42bb278ec50fa43714ce76b447b923b1f",
  R39: "96bc2c12c86c0b353f3a5d74f89dec54d8cdcd67a9adbb69e5de9e22c72c670d",
  R40: "bdb9635743f31ffb7d92486cc976211f4c31c35dc083556d3894a44985648f63",
  R41: "1622e0011feaa61fcf04c42bbf861c5b6de7640c28ae9070b4b5a407654a0863",
  R42: "8a3fbc59b4109c9426f3b843e39bdf5fe2a7a165dbbfde31c0d9e6cac872c726",
  R43: "1752d63eb30dbd321dc9964a3bad47de7e356038a65c0f6065fdf1950702ab61",
  R45: "5241e763589a7a71d4b861bc9ce7b83eb54000f52db49b14c598d88c35ce80e6",
  R46: "6ff04a154c4214738bba1698721972c32309487aebffaf1389d976df9f5e8d80",
  R47: "fe61f8a4ae8d20d9a8d4aaa8a4ab6d5804cf9c942aec19873aad86f19690bd51",
  R48: "4af44000d97d6ee1b707683a8c63acb9574be11a4235b76aad213137ee65a808",
  R49: "0ad5599bac9cfeeb0ad26cfe5da8b1b43c5048567d5b7b264ddded4a0a70bc2c",
  R50: "833ff47235d2ac54f118b766a2b6ff457098b5f9bf1296e227918014c53d5f78",
  R51: "2e2aa53e034137b1d95bedb0bbdd68eaed7cafd3244dddeab2ea6124c0f2999f",
  R52: "9cd26dd0ee29e602d92e38ab59bc2eb27444f71f0960d2ebc30c59feb6828e21",
  R53: "835b59ac654873c81da6f39dfc888b8ae5727c36713e6890a619e0204fb384c7",
  R54: "ab81f58edd10ab5e9464ecede5897c83686c23ff02a9b1ee332ad9825a67acef",
  R55: "5c7945332ec8f6584c1a02e181d7378094c3a379594f0fc3249c26de4b03447b",
  R56: "4c6bdccd869257d43a008237c14ff6db2cd4c689a2c061ce595136d4bc25d672",
  R57: "6622a3b96f896dd575314a683c710522360ce9206105906a42fa7a3f3ebf53be",
  R58: "f84fc11af6309151a28305e304c347ef31a154e6b16b8b9d07febaa28b740b6f",
  R59: "ffc9dc21a10fdcaedbf83c43969425a840dd44cef31889e7619c4b0baa1f6623",
  R60: "0b89ed102d45c764d13b4ad546d6bc67e667f8a0d1e0a96c5cdf3845517ad9a8",
  R61: "d635f1e8bf12d448fffceb630a4e6f4fb9ec4d3b503d76d5134219483c95d9a0",
  R62: "d0ad994563ef5131224d4c8e661482028877b034850b49a694adc0ad2a396a2d",
  R63: "492417e77a3759b9aba139c930c309a245a381b228a44ea6a374b86ffb1ca5ac",
  R64: "52bad00c6fac98f609447e89ff04ef22b40fc3bfba10c7663647a44252f9d13b",
  R65: "1ef34365a24fe339aab9898d8b91076f247ac44c3c9352f2b397ddf5596e342f",
  R66: "1e4ceae569300c3376b716fe71f28c979034133c4e8a28f07f6c0582844614de",
  R67: "8fa99e4cd1e49043fb5099ba250decc07de4a057ee06ce32c34c6ac303509fba",
  R68: "5a2e44a4673b379db59daab23c5cadd7595dcd71fb57bec55b8a995a594533ba",
  R69: "98a43dd5d645f1b0674b583255ddbada3ed19357a58066a75d9c29cdf0d4074c",
  R70: "e500637e7fb82853c1494d1c75e091648a971a55b387ca9db7dc90e51af7987b",
  R71: "e197a3107e1058eff1eecbbba6dc282c5227ff641a21d7bd9de14c77cf1858c5",
  R72: "5e3323a889725fd68b7ce6e82d400a76e579bbc48d03cacdd532417da1a71b51",
  R73: "09c4213ab38458397311d3c342354d8e5ab156413edc175b4260014a29c11b9c",
  R74: "eb8df6cebfe667cdc2462b7d3ba6ce5ade43e599496f33909c04ce857cb76475",
  R75: "18f4d9b69ae6afba567e05fde3d13d0620e7f7d302b8141325b6877b4f27f951",
  R76: "90752148d6132ed0022fa53595c23332bb330ce790d0644b3013056b50bdaeff",
  R77: "cd8ee55b99c9e2ba6ca6678fc80d287beb06e5bcd6dc572c8353ddf2ae9eb523",
  R78: "2713461e58e459e3ab9d7f3a80c72ef166b3f95b51b2179e513496c1d955fd99",
  R79: "64ced5b60e406808b9eaf6f605d444afbb1870675633a9f8cece8ab711a62fb4",
  R80: "bcc5c5087c49a68273483df8e7b97e9291406a547bb5c8185133c892184330f2",
  R81: "4179e4a86016b013480d41138e8b62005f7be29ef8899cfa609266f81550637a",
  R82: "0618e3bfd716aeeb18b017c92899d6c5ade640da7ec49e3a377759ad5a5e8f52",
  R83: "d79d8f6bb1a72250c23ea180580f89c919f293711981927f1e78212ea73ecc1a",
  R84: "77d25fad1612d44da1aad6fd7e92463a67a5fe4daa66b1a84eda14323b14c1e0",
  R85: "e4d9bf0d1f545de98abf6d26e190b83dc7bcb8c44689103b1c3ed9870a914d74",
  R86: "d55e215c1c46768c7c6fef9b46006f918d31d71d7a00ebcbde30c76e30e61167",
  R87: "479a7e6e1941d0ca333f669b3605db91273be4c0b41792c1bdb485ccfbd82858",
  R88: "547463aa1859884dff2a2e9aae8c6d62cb13e2ec2d7fe84bde61ef8cd520ae4b",
  R89: "9f1c2b5e3233c035229bd7188d7b04ce9a20fc39f06932460f20b50445e98393",
  R90: "a90f05e12019bee6b0cc9e883b7122158f1485818741ed6b920184aa11c4c3bc",
  R91: "d86e40368716737c58f85e5eea8ed92d0cfb802c2b35fb0294a133c55a9d8ce9",
  R92: "70ac2b06c9c4087e59ddb7467983efe47fca6abc6edf2ff03bcebd8036f1a972",
  R93: "9282814274fe4b2d1542fe6c3e24a7cdf6fd9a1c75c55e09bea7331652bbbe63",
};
const START_UNMET = { R93: "T53" };
/* A moved id's mark is its new owner's to strike (surface-declarations struck R10, R12, R16 and R18's and reworded
   R11's at d9a45aba8): the moved line is compared with its mark removed, against these hashes of the start lines with
   their marks removed (taken from the moved lines while they still matched START_LINES with their marks). */
const STRIPPED = {
  R84: "a2ec45a9271af9f05cced661d10d50204d18d6ef493327814a31d75d49361ea5",
  R85: "03e7545bac2c005ea8d50f1f44267501e8fa1db8a377903073f7a5a2abdc4ae2",
  R86: "39c32f260aae32deb70353fcffc5833a0aaf28df260fa55c3c18768a5c621ff2",
  R87: "5ef557131fff19ae214ce56d0d436aa00f838963664c5ecedb5815e55d457628",
  R88: "9cb73888dca3a22f5c0975ce88e68cad3a28c7b6ca261ff69a12ebacaeb12f5c",
  R89: "c3248ecdbca1cb9fa5581fa3f94168b5beaa052cdcf010d066aa40570bd7c1de",
  R90: "44a48e1fb63f83737fa69b94833d9db2f31bb9f322c1ad4236aac92f3cae3011",
  R91: "883ee870db2e9e2b85f3db164911646e2fdff6bd6cd25f98203dd130d611b4d8",
  R92: "837d1395b15362575a364ff06e4c87b62c799abaad9aa5bd7d42dab0682d23f1",
  R93: "555d49e062c834639663cecbaa9d86f13ef05eca7d89d3a8260c6714464b2b04",
};
const stripMark = (l) => l.replace(/ \*\(not yet met: .*?\)\*/, "");
const MOVED = Object.fromEntries([
  ...Array.from({ length: 27 }, (_, i) => [`R${49 + i}`, ["op-specs-late", `R${1 + i}`]]),
  ...Array.from({ length: 18 }, (_, i) => [`R${76 + i}`, ["surface-declarations", `R${1 + i}`]]),
]);

const here = idLines(read("build/requirements/op-declarations.md"));
const THERE = Object.fromEntries(["op-specs-late", "surface-declarations"].map((m) => [m, idLines(read(`build/requirements/${m}.md`))]));
const there = ([mod, id]) => THERE[mod].get(id);

/* Found marks (F<n>) are admitted (coordinator, 4 Nov 23:05): a found defect is recorded as a new F id with its mark; the
   R ids, their lines and their unmet marks stay pinned to the start commit. */
const isFound = (id) => /^F\d+$/.test(id);

test("the set of R ids is the start commit's: none lost, none added; F ids (found marks, met or not) are admitted", () => {
  assert.deepEqual([...here.keys()].filter((id) => !isFound(id)).sort(), Object.keys(START_LINES).sort());
});

/* R20, R24, R30 and R41 restated for T53 by BOB's ruling (4 Nov; ai-accounts R35): each keeps its id and purpose and says so */
const RESTATED = ["R20", "R24", "R30", "R41"];
const RESTATED_NOTE = "restated for T53 (`ai-accounts` R35, BOB 4 Nov)";

test("every kept id's line is the start commit's, word for word, and the unmet marks are unchanged; the four BOB restated for T53 each name the ruling and no other line changed", () => {
  const unmet = {};
  for (const [id, l] of here) {
    if (MOVED[id] || (isFound(id) && !START_LINES[id])) continue;
    if (RESTATED.includes(id)) {
      assert.ok(l.includes(RESTATED_NOTE) && l.startsWith(`- **${id}** `), `${id} is restated without the ruling`);
      assert.notEqual(sha(l), START_LINES[id], `${id} is not restated`);
      continue;
    }
    assert.equal(sha(l), START_LINES[id], `${id} changed`);
    const m = MARK.exec(l);
    if (m) unmet[id] = m[1];
  }
  for (const [id, mark] of Object.entries(START_UNMET)) {
    if (MOVED[id]) {
      /* moved: the mark is unchanged or struck by its new owner, never another mark */
      const now = /\*\(not yet met: (.*?)\)\*/.exec(there(MOVED[id]) ?? "")?.[1];
      assert.ok(now === undefined || now === mark, `${id}'s mark`);
      continue;
    }
    assert.equal(unmet[id], mark, `${id}'s mark`);
  }
  for (const id of Object.keys(unmet)) assert.ok(START_UNMET[id] !== undefined, `${id} gained a mark`);
});

test("every retired id here names its new id, and that id exists in its new module as the old line verbatim", () => {
  for (const [old, [mod, neu]] of Object.entries(MOVED)) {
    assert.equal(here.get(old), `- **${old}** *(retired: moved to ${mod}:${neu}, split 4 Nov 2026)*`, old);
    const l = there([mod, neu]);
    assert.ok(l, `${mod} has no ${neu}`);
    const note = ` (moved from op-declarations:${old})`;
    assert.ok(l.includes(note), `${neu} does not say it moved from ${old}`);
    const back = l.replace(note, "").replace(`- **${neu}**`, `- **${old}**`);
    assert.equal(sha(stripMark(back)), STRIPPED[old] ?? START_LINES[old], `${neu} is not ${old} verbatim`);
  }
});
