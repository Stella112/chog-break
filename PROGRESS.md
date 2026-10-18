# PROGRESS

## Last updated
2026-10-18 by the BUILDER (Claude Code)

## Current phase
**Phase 0: setup, facts and data.** The scaffold is done and chain facts are verified. The metadata fetch is running and the sprites come after it.

### Phase 0 plan
1. Scaffold (§B): done
2. `scripts/verify-chain.ts` → `docs/CHAIN_CHECK.md`: done
3. `scripts/build-manifest.ts` → `public/data/chogs.json` + `valid-token-ids.json`: minted set proven; metadata fetch in progress (resumable `.cache/meta`)
4. `scripts/trait-report.ts` → `docs/TRAIT_REPORT.md`: written; runs once the manifest is complete
5. `scripts/build-sprites.ts` → `public/chogs/*.webp`: written; runs after the manifest

### Phase 0 acceptance
- [x] `npm run build`, `typecheck`, `lint` and `test` pass on the scaffold (10 tests)
- [x] `docs/CHAIN_CHECK.md` exists. Every automatable §C2 row passes. MANUAL rows: burn source, fee-on-transfer (Reviewer fork test), explorer docs.
- [ ] `public/data/chogs.json` has 1,969 records and matches §C3 (pending the fetch)
- [ ] Sprites built and size reported

## Working
- RPC `https://rpc.monad.xyz` answers chainId 143. The NFT, $CHOG and Multicall3 all have code.
- `ownerOf` scan over 0..2100: exactly token IDs **1–1969** exist.
- $CHOG: symbol CHOG, decimals 18.
- Metadata: tokenURI(1) = `ipfs://bafybeid4ybujnscdipkno7ps5utqelp5ry5ryreqhay3zhgk3a6x4jruqu/1462.json`, name "CHOG #1462". The image follows the §C2 pattern.

## Broken
- Nothing known.

## Blockers
- None. The metadata fetch is slow (≈0.5 records/s) because public gateways rate-limit.

## Phase 1 (started early, allowed by §E): deterministic core
- Done: pair/pairKey, sfc32 streams, gene tables for every slot, splice (createMutant), the 16 recipes (P1 tier off by default), naming, unstable, arena rules, power budget.
- Tests pass: order independence (1,000 pairs), tier changes no stat, power budget over all 3.6M gene combos (range −1..+5), recipe order independence, unstable ≈5%, arena rules order-independent and capped at 3.
- Waiting on the real manifest: `tests/unit/manifest.test.ts` (gene distributions must equal the §D4 counts, ≥1 real pair per recipe, snapshot of 20 pairs) is skipped until chogs.json is complete.
- Still to do: RECIPE_EXAMPLES.md, curated pairs in config/game.ts, gene and recipe sections in TRAIT_REPORT.
- Decision: sfc32 discards 12 outputs after seeding (deterministic warm-up).

## Phase 2 (in progress): the Lab
- Done and checked in the browser (dev server, partial data): Home, Lab chambers, collection browser (windowed grid, search by name/#number/token ID, filters built from the manifest, Random, detail panel with genes), SPLICE, reveal timeline with SFX (alarm, electricity, impact, discovery), SKIP after the first reveal, reduced-motion crossfade, mutant canvas compositor (jagged seam, glitch bands, hue shift, tint, chromatic aberration, recipe glow, unstable holo), art-offline fallback, notebook (localStorage with try/catch), deep links `/?a=&b=`, mute toggle, 375 px layout (no horizontal scroll).
- Fixed during the browser check: React dev double-effect showed "ALREADY IN NOTEBOOK" on first view (now a once-only guard); grid clipped its last column on mobile.
- **Core change:** recipes now pin their ingredient slots to the parent that supplied them (KING BEAM always has BEAM + ROYAL). Without this, a recipe perk could have no move to modify. Recorded in DECISIONS.md.
- TRY A SECRET MUTATION is hidden until `src/config/secretPairs.json` is generated from the real manifest (`npx tsx scripts/recipe-examples.ts`).
- Not done yet: Playwright e2e, the second-profile deep-link check, compositor tuning against real sprites (needs ≥25 sprites inspected).

## Next
- Finish the manifest, run validation (any mismatch = STOP 6), then the trait report, recipe examples and sprites.
- Phase 2: compositor tuning with real sprites, then Playwright.

## Unverified facts (all in `src/config/chain.ts`)
- RPC URL works but is not yet confirmed in the official Monad docs.
- Multicall3 has code at the canonical address and multicall calls succeed (functionally verified).
- IPFS gateways are third-party: filebase works; pinata, ipfs.io and dweb.link return 429 under load.
- `eth_getLogs` works for a 100-block range and fails at 1,000.
- Block explorer and contract verification method: not yet read from the official docs.

## Needs human verification
- $CHOG `burn()`: the implementation bytecode contains the selectors, but the source was not checked. The spec still uses the dead address.
- $CHOG fee-on-transfer: needs the Reviewer fork test.

## Proposals
- (none)

## Do not touch
- `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` (Reviewer-owned)
- `../chog-hearth/` (an unrelated project)
