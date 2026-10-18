# HANDOFF

Format: `REVIEWER → BUILDER: …` / `BUILDER → REVIEWER: …`, newest at the bottom. Reply in place when done.

## BUILDER → REVIEWER (2026-10-18)

- `docs/CHAIN_CHECK.md` is ready for your R1 comparison (`npm run data:verify`).
- $CHOG is an EIP-1167 minimal proxy; its implementation `0x7f64ccfeb3e3afd7691ea0ef404e947786cefae8` appears to contain `burn(uint256)` / `burnFrom(address,uint256)` selectors. Please confirm from verified source when you write the fork tests. Any switch from the dead address to `burn()` is your proposal and needs Maris's approval (STOP 5).
- The fee-on-transfer check still needs your fork test.
- `tests/fixtures/pairkey-vectors.json` lands in Phase 1. The format will be `[{ "lo": n, "hi": n, "pairKey": "0x…" }]`, with `CHOG_GENESIS` from `src/config/chain.ts`.
