Length: 52 lines. Last section: "4. What is not known".

# The plane module's scope: design

The plane-scope lane's design, first written 23 Nov 2026 by civicsmith plane-scope lane #1 from the research in `research/` (index `research/README.md`). It is put to the owner on the lane's design page, https://claude.ai/artifact/X5PJuyRPjLtP9G7Wsry37L. The module list, the order and interfaces are ARCH's to decide and build; this is the lane's proposal to ARCH and the owner's choice of direction. Nothing here is built while development is halted.

## 1. What plane is for

- Plane is the shell that makes civicsmith one running program on the hosting service: the store's class (one Durable Object per team), the Worker's entry, the door's hooks, the watchdog, the build of its bundle and its deployment config. Its own code is five files, 371 lines (research 02, "Order facts"). Building every module on the store is `store-assembly`'s (K5046; research 01).
- Its own requirements are the 27 about that shell (research 01, section 2). Its proof is the tests of group A1 (27 tests; research 02).
- It is not the home of other modules' proof. Nothing in the canon says so (research 01, item 7); it holds that proof because whole-program tests use every module and only the end of the order may, and because only plane's entry starts the real runtime (research 01, section 3).

## 2. The facts the design rests on

1. 138 of plane's 147 tests load plane's own code; 108 start the Worker and store under workerd (research 02). They cannot move earlier than plane without testing a copy of the program rather than the deployed one, which the owner's real-shape ruling (K4426) and the canon's "can prove it" (Distribution §1) argue against.
2. Of the 147: 27 prove plane's own shell (A1); 27 are plane-numbered checks of other modules' behaviour at the platform's shape (A2); 86 prove other modules' requirements through the real door (B: control-plane 46, screens-inquiry 7, screens-intake 6, the rest 1 to 9 each); 7 are odd ones (D) (research 02).
3. The run is throughput-bound: about 5,520 s of file time over three slots, 33 to 43 minutes measured; plane's own folder is 27 to 31% of it; migrate-released starts workerd 69 times; one reading test waits about 280 s on a timer (research 03).
4. Every other module's run takes 2 to 4 minutes (research 03).

## 3. The choices, and the lane's recommendation

**A. Leave the tests in plane; make its run faster.** Fewer workerd starts per file, migrate-released run where it overloads nothing. Gives: least change. Costs: plane's work stays answerable for 113 tests of other modules' behaviour; its run stays near the limit and grows with every new whole-program test; a change to plane's 371 lines still runs every whole-program test.

**B. Plane keeps only its own proof; the whole-program proofs move to proof modules placed after plane.** Plane keeps A1 (27 tests). Two new modules after plane, each with its own requirements (the whole-program restatements, as A2's already are, each naming the module requirement it proves) and the kits its tests use as its code:
- a platform-shape proof module: A2, migrate-released and the odd real-runtime tests (D) — what the program does on the real runtime: large files, memory, alarms, stores from past releases;
- a door proof module: B — the walks and seams through the real door, by area.
ARCH may split either further by run time. Gives: plane's own run takes minutes; each proof run is well under the limit (expected from the shares in research 03, not measured); a failure lands on a module whose job is that proof, which reports another module's fault to ARCH as any job does. Costs: two (or more) new modules and moved requirement text, ARCH's work; each whole-program requirement is stated twice, at its owner and as a restatement; the owner module's own job still does not run the whole-program proof — the proof module, a user of everything, is told when an interface it uses changes (Process4's notice), and the walks cover the rest. That the tool follows such a module's uses is unproven.

**C. Move proof back to the owner modules by rewriting tests to run in plain Node with stand-ins.** store-assembly's Node store and a stand-in for the door's hooks. Gives: an owner's own job proves its requirement. Costs: rewriting up to 86 tests (about 14,000 lines); a stand-in can drift from the real program, so the real-shape checks still have to stay at the end; it narrows what the owner's real-shape ruling asked for.

**Recommendation: B.** It puts plane back to its purpose at once, takes plane's run far from the limit, and keeps every proof on the real program, as the owner ruled. C is not ruled out: where a module's job can prove its own requirement in its own tests without a stand-in that drifts, it does so as part of meeting that requirement; the whole-program proof stays at the end beside it.

Either way, plane's requirements file is corrected: its Purpose sentence and Uses still describe what moved to `store-assembly` (research 01, item 3). That is ARCH's requirement text.

## 4. What is not known

- The run time of each proposed module: shares in research 03 are worked out from test names (118 of 591 not matched).
- Whether the 10 store-only tests in A2 need plane's store class or only `store-assembly`'s store; if only the latter, they may sit at `store-assembly` (research 02).
- ARCH's twelve owed pieces: items 1, 4, 5 and 7 to 11a are in no file (research 02).
- Whether the time limit itself changes: a process fault now with PROCESS and the owner, not this lane's.
