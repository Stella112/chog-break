# ChogBreakRegistry: Builder self-review

**This is the Builder's own review of code the Builder wrote. It is not an independent audit.** It follows the topics of spec §F R3 so a Reviewer (`docs/SECURITY.md`, Reviewer-owned) can check it point by point. Read it before you deploy (`docs/DEPLOY.md`).

Contract: `contracts/src/ChogBreakRegistry.sol` (≈180 lines). Tests: `contracts/test/ChogBreakRegistry.t.sol` (29) and `contracts/test/Fork.t.sol` (5, Monad mainnet fork).

## What it can and cannot do

- It **never holds funds**. Every `recordSplice` moves the fee straight from the caller to four recipients in the same transaction. `test_payoutsExact` asserts the registry's balance is 0 afterwards.
- It has no withdraw or rescue function, no upgradeability, no `delegatecall` and no `selfdestruct`.
- **Admin powers** (owner, two-step transfer) are limited to:
  - `setFee`, never above the immutable `MAX_FEE`
  - `setPrizeRecipient`, never the zero address
  - `pause` / `unpause`, which only block new recordings

  The owner cannot move anyone's tokens or change past records (`test_onlyOwnerAdmin`, `test_setFeeAboveMaxFails`, `test_ownershipIsTwoStep`).

## R3 topics

| Topic | Finding | Evidence |
|---|---|---|
| **Approvals** | The app approves **exactly** the current fee, never unlimited. If the owner raises the fee after a user approved, the recording reverts instead of taking more. | `registry.ts`; `recorded.spec` checks the approve calldata amount; `test_feeRaiseAfterApprovalFails` |
| **Transfers** | `SafeERC20.safeTransferFrom` from the caller; zero amounts are skipped. $CHOG moves exact amounts (no fee-on-transfer) on mainnet. $CHOG is an EIP-1167 minimal proxy, which points to a fixed implementation. | `test_zeroFeePath`; fork `test_fork_chogTransferIsExact` |
| **Reentrancy** | `nonReentrant` on `recordSplice`; state updated before transfers. A malicious token that re-enters is rejected. | `test_reentrancyViaMaliciousTokenFails` |
| **Ownership resolution** | Both parents' owners come from `CHOG_GENESIS.ownerOf` at call time, never from input. Nonexistent IDs (0, 1970) revert there, with no hard-coded range. | `test_ownerCannotBeSpoofed`, `test_nonexistentTokensRejectedViaOwnerOf` |
| **Fee accounting** | 35% + 35% + 10% are floored; the prize takes the remainder, so no dust is ever lost. For a 7-wei fee the split is 2 / 2 / 0 / 3. | `testFuzz_oddFeeNoDust` (256 runs), `test_oddFeeExample` |
| **Pair replay** | Recording a pair again is allowed: it pays the owners again and increments counts, but `firstDiscoverer` and its time never change. | `test_firstDiscovererSetOnceAndTimeRecorded`, `test_secondSpliceIncrementsCount` |
| **Dead address** | 10% goes to `0x…dEaD` with a plain transfer. Docs and UI say "sent to the dead address", never "burned". $CHOG's `burn()` is unconfirmed (open Reviewer item), so it isn't used. | `test_deadAddressAllocation`; `docs:check` |
| **RPC spoofing** | The frontend reads owners and the fee only for display. Payouts are decided on-chain by the contract. A lying RPC could only show wrong numbers before the wallet prompt, and the user signs the real call. `simulateContract` runs first. | `registry.ts` |
| **Events** | `PairDiscovered` and `SpliceRecorded` carry the exact values moved, checked field by field. Constructor and admin changes emit `FeeUpdated` / `PrizeRecipientUpdated`. | `test_eventsCarryCorrectArgs`, `test_adminEvents` |
| **Frontend address config** | `REGISTRY_ADDRESS` lives only in `src/config/chain.ts` and is `null` until deployed. Before it is set, `npm run registry:verify -- <addr>` checks the deployed bytecode against this repo (immutables masked), plus the immutables, settings and pair-key parity. | `scripts/verify-registry.ts` (tried against a good and a wrong contract) |
| **Secrets** | No keys in the repo or tests: tests use impersonated accounts. Deploying uses Foundry's encrypted keystore (`--account`). The deploy script aborts unless `CONFIRM_MAINNET_DEPLOY=YES` and chain 143. | `.env.example`, `Deploy.s.sol` |

## Known limits (by design, disclosed)

- **First-discoverer race:** two people recording the same new pair in the same block: the first transaction included wins. Front-running only costs the front-runner the fee, and it pays the parent owners.
- **Squatting:** anyone can pay to record many pairs first. That's the intended game: the credit costs real $CHOG and pays holders.
- **Prize pool:** it is a plain address. Automatic weekly distribution is roadmap and never claimed.
- **Coverage:** `forge coverage` could not run. Foundry 1.8.3's analyser rejects the standard `Ownable(owner)` constructor call through `Ownable2Step`, which is a tool bug. Every function and branch has at least one test above.

## Before deploying

1. Run both test suites (`docs/DEPLOY.md` step 1).
2. Choose `MAX_FEE` carefully: it can never be raised.
3. Use a hardware wallet or a fresh keystore account as `OWNER`, and plan who will hold it.
